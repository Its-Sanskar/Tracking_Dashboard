const jwt = require('jsonwebtoken');
const Parent = require('../models/Parent');
const Device = require('../models/Device');

// Middleware to protect routes for Parent Web Portal
async function authenticateParent(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please provide a valid Bearer token.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'child_guard_super_secure_jwt_secret_key_2026_!#');

    const parent = await Parent.findById(decoded.id).select('-passwordHash');
    if (!parent) {
      return res.status(401).json({ success: false, message: 'Parent account not found or token expired.' });
    }

    req.parent = parent;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}

// Middleware to authenticate Child Android Device
async function authenticateDevice(req, res, next) {
  try {
    const deviceToken = req.headers['x-device-token'] || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
    if (!deviceToken) {
      return res.status(401).json({ success: false, message: 'Device authentication token required.' });
    }

    const device = await Device.findOne({ deviceToken }).populate('parentId', 'email fullName');
    if (!device) {
      return res.status(401).json({ success: false, message: 'Device not recognized or token revoked.' });
    }

    req.device = device;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Device authentication failed.' });
  }
}

module.exports = {
  authenticateParent,
  authenticateDevice
};
