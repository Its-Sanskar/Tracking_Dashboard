const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const { authenticateParent, authenticateDevice } = require('../middleware/auth');
const { emitDeviceTelemetry } = require('../services/socket.service');

// POST /api/devices/generate-pairing
// Parent requests a 6-digit pairing code to enter on the child's phone
router.post('/generate-pairing', authenticateParent, async (req, res) => {
  try {
    const { deviceName } = req.body;
    const pairingCode = Device.generatePairingCode();
    const pairingExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    // Create a provisional device slot or reuse unlinked slot
    const device = await Device.create({
      parentId: req.parent._id,
      deviceName: deviceName || "Child's Phone",
      deviceUuid: 'pending_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      pairingCode,
      pairingExpiresAt,
      isOnline: false
    });

    return res.status(201).json({
      success: true,
      pairingCode,
      expiresAt: pairingExpiresAt,
      deviceId: device._id,
      message: 'Pairing code generated. Enter this 6-digit code in the Child Android App.'
    });
  } catch (err) {
    console.error('[Device] Generate pairing error:', err);
    return res.status(500).json({ success: false, message: 'Could not generate pairing code.' });
  }
});

// POST /api/devices/pair
// Called by Child Android App with the 6-digit pairing code
router.post('/pair', async (req, res) => {
  try {
    const { pairingCode, deviceUuid, deviceName, deviceModel } = req.body;

    if (!pairingCode || !deviceUuid) {
      return res.status(400).json({ success: false, message: 'Pairing code and hardware Device UUID are required.' });
    }

    // Find device slot matching pairing code that hasn't expired
    const device = await Device.findOne({
      pairingCode,
      pairingExpiresAt: { $gt: new Date() }
    });

    if (!device) {
      return res.status(400).json({ success: false, message: 'Invalid or expired pairing code. Please generate a new code from the web portal.' });
    }

    // Generate permanent cryptographic token for the device
    const deviceToken = Device.generateDeviceToken();

    device.deviceUuid = deviceUuid;
    if (deviceName) device.deviceName = deviceName;
    if (deviceModel) device.deviceModel = deviceModel;
    device.deviceToken = deviceToken;
    device.pairingCode = undefined; // Invalidate code after pairing
    device.pairingExpiresAt = undefined;
    device.isOnline = true;
    device.lastSyncAt = new Date();
    await device.save();

    // Broadcast updated telemetry to parent web dashboard
    emitDeviceTelemetry(device.parentId, {
      deviceId: device._id,
      deviceName: device.deviceName,
      batteryLevel: device.batteryLevel,
      isOnline: true,
      lastSyncAt: device.lastSyncAt
    });

    return res.status(200).json({
      success: true,
      message: 'Device successfully paired to parent account!',
      deviceId: device._id,
      deviceToken
    });
  } catch (err) {
    console.error('[Device] Pairing handshake error:', err);
    return res.status(500).json({ success: false, message: 'Device pairing failed due to an internal error.' });
  }
});

// GET /api/devices
// Parent fetches all their registered devices
router.get('/', authenticateParent, async (req, res) => {
  try {
    const devices = await Device.find({ parentId: req.parent._id })
      .select('-deviceToken -pairingCode')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      devices
    });
  } catch (err) {
    console.error('[Device] Fetch devices error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch registered devices.' });
  }
});

// POST /api/devices/heartbeat
// Child phone pings periodically with battery % and online status
router.post('/heartbeat', authenticateDevice, async (req, res) => {
  try {
    const { batteryLevel } = req.body;
    const device = req.device;

    if (typeof batteryLevel === 'number') {
      device.batteryLevel = Math.min(100, Math.max(0, batteryLevel));
    }
    device.isOnline = true;
    device.lastSyncAt = new Date();
    await device.save();

    // Emit live telemetry to parent web dashboard
    emitDeviceTelemetry(device.parentId._id, {
      deviceId: device._id,
      deviceName: device.deviceName,
      batteryLevel: device.batteryLevel,
      isOnline: true,
      lastSyncAt: device.lastSyncAt
    });

    return res.json({ success: true, message: 'Heartbeat received.' });
  } catch (err) {
    console.error('[Device] Heartbeat error:', err);
    return res.status(500).json({ success: false, message: 'Heartbeat processing failed.' });
  }
});

// DELETE /api/devices/:id
// Parent unlinks a device
router.delete('/:id', authenticateParent, async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({
      _id: req.params.id,
      parentId: req.parent._id
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    return res.json({ success: true, message: 'Device successfully removed.' });
  } catch (err) {
    console.error('[Device] Unlink error:', err);
    return res.status(500).json({ success: false, message: 'Failed to unlink device.' });
  }
});

module.exports = router;
