const express = require('express');
const router = express.Router();
const NotificationLog = require('../models/NotificationLog');
const { authenticateParent, authenticateDevice } = require('../middleware/auth');
const { scanContentForAlerts } = require('../services/keywordAlert.service');
const { emitNewNotification, emitSafetyAlert } = require('../services/socket.service');

// POST /api/notifications/sync
// Ingestion endpoint used by Child Android App to batch upload captured notifications
router.post('/sync', authenticateDevice, async (req, res) => {
  try {
    const { notifications } = req.body;
    const device = req.device;
    const parentId = device.parentId._id || device.parentId;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of notifications expected.' });
    }

    const insertedRecords = [];
    const flaggedRecords = [];

    for (const item of notifications) {
      const packageName = item.packageName || 'unknown';
      const senderTitle = (item.title || item.senderTitle || '').trim();
      const messageContent = (item.content || item.messageContent || item.text || '').trim();
      const subText = (item.subText || '').trim();
      const postTime = item.postTime || Date.now();
      const appDisplayName = item.appName || NotificationLog.resolveAppName(packageName);

      // Skip blank or ping notifications
      if (!senderTitle && !messageContent) {
        continue;
      }

      // Check content against Safety Alert Engine
      const fullTextToScan = `${senderTitle} ${messageContent} ${subText}`;
      const safetyCheck = await scanContentForAlerts(parentId, fullTextToScan);

      try {
        // Attempt insert with deduplication
        const record = await NotificationLog.findOneAndUpdate(
          {
            deviceId: device._id,
            packageName,
            postTime,
            senderTitle
          },
          {
            $setOnInsert: {
              deviceId: device._id,
              parentId,
              packageName,
              appDisplayName,
              senderTitle,
              messageContent,
              subText,
              postTime,
              isFlagged: safetyCheck.isFlagged,
              flagReason: safetyCheck.flagReason,
              extras: item.extras || {}
            }
          },
          {
            upsert: true,
            new: true,
            rawResult: true
          }
        );

        // If it was newly inserted (not an existing duplicate)
        const doc = record.value || record;
        if (!record.lastErrorObject || !record.lastErrorObject.updatedExisting) {
          insertedRecords.push(doc);

          // Broadcast live over Socket.io
          emitNewNotification(parentId, doc);

          if (doc.isFlagged) {
            flaggedRecords.push(doc);
            emitSafetyAlert(parentId, {
              notificationId: doc._id,
              deviceName: device.deviceName,
              appName: doc.appDisplayName,
              sender: doc.senderTitle,
              messageSnippet: doc.messageContent.substring(0, 80),
              reason: doc.flagReason,
              postTime: doc.postTime
            });
          }
        }
      } catch (insertErr) {
        // Duplicate key or write collision, safely ignore duplicate
        if (insertErr.code !== 11000) {
          console.warn('[Notification Ingestion] Warning on insert:', insertErr.message);
        }
      }
    }

    // Update device lastSyncAt
    device.lastSyncAt = new Date();
    device.isOnline = true;
    await device.save();

    return res.status(200).json({
      success: true,
      message: `Batch sync complete. Processed ${notifications.length} notifications.`,
      newlySaved: insertedRecords.length,
      flaggedCount: flaggedRecords.length
    });
  } catch (err) {
    console.error('[Notification Ingestion] Sync error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process notification batch.' });
  }
});

// GET /api/notifications
// Parent queries notifications with rich filters and pagination
router.get('/', authenticateParent, async (req, res) => {
  try {
    const parentId = req.parent._id;
    const {
      deviceId,
      packageName,
      search,
      flaggedOnly,
      page = 1,
      limit = 50,
      fromDate,
      toDate
    } = req.query;

    const query = { parentId };

    if (deviceId) {
      query.deviceId = deviceId;
    }

    if (packageName && packageName !== 'all') {
      query.packageName = packageName;
    }

    if (flaggedOnly === 'true' || flaggedOnly === true) {
      query.isFlagged = true;
    }

    if (search && search.trim()) {
      query.$or = [
        { senderTitle: { $regex: search.trim(), $options: 'i' } },
        { messageContent: { $regex: search.trim(), $options: 'i' } },
        { appDisplayName: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    if (fromDate || toDate) {
      query.postTime = {};
      if (fromDate) query.postTime.$gte = Number(fromDate) || new Date(fromDate).getTime();
      if (toDate) query.postTime.$lte = Number(toDate) || new Date(toDate).getTime();
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [notifications, totalCount] = await Promise.all([
      NotificationLog.find(query)
        .populate('deviceId', 'deviceName deviceModel batteryLevel isOnline')
        .sort({ postTime: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      NotificationLog.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: notifications,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalRecords: totalCount,
        hasMore: skip + notifications.length < totalCount
      }
    });
  } catch (err) {
    console.error('[Notification] Query error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
});

// GET /api/notifications/stats
// High-level analytics summary for parent dashboard
router.get('/stats', authenticateParent, async (req, res) => {
  try {
    const parentId = req.parent._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalAllTime, totalToday, flaggedCount, appBreakdown] = await Promise.all([
      NotificationLog.countDocuments({ parentId }),
      NotificationLog.countDocuments({ parentId, createdAt: { $gte: todayStart } }),
      NotificationLog.countDocuments({ parentId, isFlagged: true }),
      NotificationLog.aggregate([
        { $match: { parentId } },
        {
          $group: {
            _id: '$appDisplayName',
            packageName: { $first: '$packageName' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    return res.json({
      success: true,
      stats: {
        totalAllTime,
        totalToday,
        flaggedCount,
        appBreakdown: appBreakdown.map((item) => ({
          appName: item._id,
          packageName: item.packageName,
          count: item.count
        }))
      }
    });
  } catch (err) {
    console.error('[Notification] Stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to compute stats.' });
  }
});

module.exports = router;
