const express = require('express');
const router = express.Router();
const AlertKeyword = require('../models/AlertKeyword');
const { authenticateParent } = require('../middleware/auth');
const { DEFAULT_SAFETY_KEYWORDS } = require('../services/keywordAlert.service');

// GET /api/keywords
// Fetch parent's custom keywords and default safety watchlist
router.get('/', authenticateParent, async (req, res) => {
  try {
    const customKeywords = await AlertKeyword.find({ parentId: req.parent._id }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      customKeywords,
      defaultKeywords: DEFAULT_SAFETY_KEYWORDS
    });
  } catch (err) {
    console.error('[Keyword] Fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch keywords.' });
  }
});

// POST /api/keywords
// Add a custom alert keyword
router.post('/', authenticateParent, async (req, res) => {
  try {
    const { keyword, severity } = req.body;

    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ success: false, message: 'Keyword text is required.' });
    }

    const cleanKeyword = keyword.trim().toLowerCase();

    const existing = await AlertKeyword.findOne({
      parentId: req.parent._id,
      keyword: cleanKeyword
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'Keyword already exists in your safety watchlist.' });
    }

    const newKeyword = await AlertKeyword.create({
      parentId: req.parent._id,
      keyword: cleanKeyword,
      severity: severity || 'HIGH'
    });

    return res.status(201).json({
      success: true,
      keyword: newKeyword,
      message: 'Safety keyword added successfully.'
    });
  } catch (err) {
    console.error('[Keyword] Create error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create keyword.' });
  }
});

// DELETE /api/keywords/:id
// Remove a custom alert keyword
router.delete('/:id', authenticateParent, async (req, res) => {
  try {
    const deleted = await AlertKeyword.findOneAndDelete({
      _id: req.params.id,
      parentId: req.parent._id
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Keyword not found.' });
    }

    return res.json({ success: true, message: 'Keyword removed from watchlist.' });
  } catch (err) {
    console.error('[Keyword] Delete error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete keyword.' });
  }
});

module.exports = router;
