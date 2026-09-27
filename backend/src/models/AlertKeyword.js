const mongoose = require('mongoose');

const AlertKeywordSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
      required: true,
      index: true
    },
    keyword: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'HIGH'
    }
  },
  {
    timestamps: true
  }
);

// Unique keyword per parent
AlertKeywordSchema.index({ parentId: 1, keyword: 1 }, { unique: true });

module.exports = mongoose.model('AlertKeyword', AlertKeywordSchema);
