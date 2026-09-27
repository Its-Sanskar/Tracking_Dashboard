const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const deviceRoutes = require('./routes/device.routes');
const notificationRoutes = require('./routes/notification.routes');
const keywordRoutes = require('./routes/keyword.routes');

const app = express();

// Middlewares
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Child Guard Notification Backend'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/keywords', keywordRoutes);

const fs = require('fs');

// Serve Frontend Static Files if available (for Parent Web Dashboard)
const candidatePaths = [
  path.join(__dirname, '../../frontend/public'),
  path.join(__dirname, '../frontend/public'),
  path.join(process.cwd(), 'frontend/public'),
  path.join(__dirname, 'public')
];
const frontendPublicPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];
app.use(express.static(frontendPublicPath));

// Fallback for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(frontendPublicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[App Error Handler]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;
