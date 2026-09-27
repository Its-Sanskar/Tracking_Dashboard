const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Parent = require('../models/Parent');
const { authenticateParent } = require('../middleware/auth');

function generateToken(parentId) {
  return jwt.sign({ id: parentId }, process.env.JWT_SECRET || 'child_guard_super_secure_jwt_secret_key_2026_!#', {
    expiresIn: '30d'
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const existing = await Parent.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await Parent.hashPassword(password);
    const parent = await Parent.create({
      email: email.toLowerCase(),
      passwordHash,
      fullName: fullName || 'Parent User'
    });

    const token = generateToken(parent._id);

    return res.status(201).json({
      success: true,
      message: 'Parent account registered successfully.',
      token,
      parent: {
        id: parent._id,
        email: parent.email,
        fullName: parent.fullName
      }
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both email and password.' });
    }

    const parent = await Parent.findOne({ email: email.toLowerCase() });
    if (!parent) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await parent.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(parent._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      parent: {
        id: parent._id,
        email: parent.email,
        fullName: parent.fullName
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateParent, async (req, res) => {
  return res.json({
    success: true,
    parent: {
      id: req.parent._id,
      email: req.parent.email,
      fullName: req.parent.fullName,
      createdAt: req.parent.createdAt
    }
  });
});

module.exports = router;
