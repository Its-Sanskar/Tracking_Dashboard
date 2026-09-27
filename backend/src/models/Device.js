const mongoose = require('mongoose');
const crypto = require('crypto');

const DeviceSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
      required: true,
      index: true
    },
    deviceName: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
      default: "Child's Phone"
    },
    deviceModel: {
      type: String,
      trim: true,
      default: 'Android Device'
    },
    deviceUuid: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    deviceToken: {
      type: String,
      unique: true,
      sparse: true
    },
    pairingCode: {
      type: String,
      index: true
    },
    pairingExpiresAt: {
      type: Date
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    lastSyncAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Helper to generate a new 6-digit pairing code
DeviceSchema.statics.generatePairingCode = function () {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper to generate a secure device token
DeviceSchema.statics.generateDeviceToken = function () {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = mongoose.model('Device', DeviceSchema);
