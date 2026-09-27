const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket middleware for auth verification (optional during connect or via join-room)
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'child_guard_super_secure_jwt_secret_key_2026_!#');
        socket.parentId = decoded.id;
      } catch (err) {
        console.warn('[Socket] Token verification failed on socket handshake:', err.message);
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id} (Parent ID: ${socket.parentId || 'Unauthenticated'})`);

    if (socket.parentId) {
      socket.join(`parent_${socket.parentId}`);
      console.log(`[Socket] Socket ${socket.id} joined room parent_${socket.parentId}`);
    }

    socket.on('join_parent_room', (data) => {
      const parentId = data?.parentId || socket.parentId;
      if (parentId) {
        socket.join(`parent_${parentId}`);
        console.log(`[Socket] Explicit join for parent room: parent_${parentId}`);
        socket.emit('joined_room', { success: true, room: `parent_${parentId}` });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
}

// Broadcast new captured notification directly to the parent's web dashboard
function emitNewNotification(parentId, notificationLog) {
  if (!io) return;
  io.to(`parent_${parentId}`).emit('new_notification', {
    notification: notificationLog,
    timestamp: Date.now()
  });
}

// Broadcast device battery and online status
function emitDeviceTelemetry(parentId, telemetry) {
  if (!io) return;
  io.to(`parent_${parentId}`).emit('device_telemetry', {
    deviceId: telemetry.deviceId,
    deviceName: telemetry.deviceName,
    batteryLevel: telemetry.batteryLevel,
    isOnline: telemetry.isOnline,
    lastSyncAt: telemetry.lastSyncAt
  });
}

// Broadcast urgent safety alert
function emitSafetyAlert(parentId, alertData) {
  if (!io) return;
  io.to(`parent_${parentId}`).emit('safety_alert', {
    alert: alertData,
    timestamp: Date.now()
  });
}

module.exports = {
  initSocket,
  getIO,
  emitNewNotification,
  emitDeviceTelemetry,
  emitSafetyAlert
};
