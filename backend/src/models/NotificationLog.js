const mongoose = require('mongoose');

const KNOWN_PACKAGES = {
  'com.whatsapp': 'WhatsApp',
  'com.whatsapp.w4b': 'WhatsApp Business',
  'com.instagram.android': 'Instagram',
  'com.snapchat.android': 'Snapchat',
  'com.facebook.orca': 'Messenger',
  'org.telegram.messenger': 'Telegram',
  'org.thunderdog.challegram': 'Telegram X',
  'com.google.android.apps.messaging': 'Messages (SMS)',
  'com.samsung.android.messaging': 'Samsung Messages',
  'com.twitter.android': 'X (Twitter)',
  'com.discord': 'Discord',
  'com.google.android.youtube': 'YouTube',
  'com.zhiliaoapp.musically': 'TikTok',
  'com.ss.android.ugc.trill': 'TikTok'
};

const NotificationLogSchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
      index: true
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
      required: true,
      index: true
    },
    packageName: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    appDisplayName: {
      type: String,
      required: true,
      trim: true
    },
    senderTitle: {
      type: String,
      default: '',
      trim: true
    },
    messageContent: {
      type: String,
      default: '',
      trim: true
    },
    subText: {
      type: String,
      default: '',
      trim: true
    },
    postTime: {
      type: Number,
      required: true,
      index: true
    },
    isFlagged: {
      type: Boolean,
      default: false,
      index: true
    },
    flagReason: {
      type: String,
      default: null
    },
    extras: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Helper static method to resolve app display name
NotificationLogSchema.statics.resolveAppName = function (packageName) {
  if (!packageName) return 'Unknown App';
  if (KNOWN_PACKAGES[packageName]) {
    return KNOWN_PACKAGES[packageName];
  }
  // Try to generate friendly name from package (e.g. com.example.coolapp -> Coolapp)
  const parts = packageName.split('.');
  const lastPart = parts[parts.length - 1];
  return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
};

// Compound index for chronological timeline per device
NotificationLogSchema.index({ deviceId: 1, postTime: -1 });

// Compound index for chronological timeline per parent
NotificationLogSchema.index({ parentId: 1, postTime: -1 });

// Compound index for deduplication: deviceId + packageName + postTime + senderTitle
NotificationLogSchema.index(
  { deviceId: 1, packageName: 1, postTime: 1, senderTitle: 1 },
  { unique: true }
);

// Text index for full-text search across sender and message content
NotificationLogSchema.index({
  senderTitle: 'text',
  messageContent: 'text',
  appDisplayName: 'text'
});

module.exports = mongoose.model('NotificationLog', NotificationLogSchema);
