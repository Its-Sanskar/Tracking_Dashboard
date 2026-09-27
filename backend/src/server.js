require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initSocket } = require('./services/socket.service');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Create HTTP Server
    const server = http.createServer(app);

    // 3. Initialize Socket.io
    const io = initSocket(server);

    // 4. Start Listening
    server.listen(PORT, () => {
      console.log('====================================================');
      console.log(`🚀 Child Tracker Backend running on port ${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`🌐 Web Dashboard: http://localhost:${PORT}`);
      console.log('====================================================');
    });

    // Graceful Shutdown
    const shutdown = async () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('[Server] Fatal error on startup:', err);
    process.exit(1);
  }
}

startServer();
