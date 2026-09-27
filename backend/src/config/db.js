const mongoose = require('mongoose');
const dns = require('dns');

let memoryServer = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/child_tracker';
  
  // Fix for Windows querySrv ECONNREFUSED on mongodb+srv:// Atlas strings
  if (uri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (dnsErr) {
      console.warn('[Database] Custom DNS setup skipped:', dnsErr.message);
    }
  }

  try {
    const maskedUri = uri.replace(/:[^:@]+@/, ':****@');
    console.log(`[Database] Attempting connection to: ${maskedUri}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[Database] Connected successfully to MongoDB.');
  } catch (err) {
    console.warn(`[Database] Could not connect to external MongoDB: ${err.message}`);

    if (process.env.NODE_ENV !== 'production') {
      try {
        console.log('[Database] Starting local in-memory MongoDB server for testing/development...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        const memUri = memoryServer.getUri();
        await mongoose.connect(memUri);
        console.log(`[Database] Connected to In-Memory MongoDB at: ${memUri}`);
        console.log('[Database] (Note: You can configure a permanent MongoDB Atlas or local URI in backend/.env)');
      } catch (memErr) {
        console.error('[Database] Failed to initialize in-memory MongoDB:', memErr.message);
        throw memErr;
      }
    } else {
      throw err;
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('[Database] MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB disconnected.');
  });
}

async function closeDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
}

module.exports = { connectDB, closeDB };
