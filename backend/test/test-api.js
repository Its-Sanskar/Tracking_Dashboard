/**
 * Automated Phase 1 Verification Script
 * Tests DB models, Auth, Device Pairing, Ingestion, and Keyword Flagging
 */
const http = require('http');
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, closeDB } = require('../src/config/db');
const { initSocket } = require('../src/services/socket.service');

const TEST_PORT = 5055;

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 1 Backend Verification Suite');
  console.log('======================================================\n');

  let server;
  try {
    await connectDB();
    server = http.createServer(app);
    initSocket(server);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
    console.log(`[Test Runner] Temporary test server active on port ${TEST_PORT}\n`);

    const baseUrl = `http://localhost:${TEST_PORT}`;

    // Test 1: Health Check
    console.log('▶ Test 1: GET /api/health');
    const health = await request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/health',
      method: 'GET'
    });
    console.log(`  Status: ${health.status}, Response:`, health.data);
    if (health.status !== 200) throw new Error('Health check failed');
    console.log('  ✔ Health check passed\n');

    // Test 2: Register Parent
    console.log('▶ Test 2: POST /api/auth/register');
    const testEmail = `parent_${Date.now()}@example.com`;
    const regRes = await request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        email: testEmail,
        password: 'Password123!',
        fullName: 'Test Parent'
      }
    );
    console.log(`  Status: ${regRes.status}, Message:`, regRes.data.message);
    if (regRes.status !== 201 || !regRes.data.token) throw new Error('Registration failed');
    const parentToken = regRes.data.token;
    console.log('  ✔ Parent registration passed\n');

    // Test 3: Generate Device Pairing Code
    console.log('▶ Test 3: POST /api/devices/generate-pairing');
    const pairCodeRes = await request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/devices/generate-pairing',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parentToken}`
        }
      },
      { deviceName: "Sanskar's Phone" }
    );
    console.log(`  Status: ${pairCodeRes.status}, Pairing Code:`, pairCodeRes.data.pairingCode);
    if (pairCodeRes.status !== 201 || !pairCodeRes.data.pairingCode) throw new Error('Pairing code generation failed');
    const pairingCode = pairCodeRes.data.pairingCode;
    console.log('  ✔ Pairing code generation passed\n');

    // Test 4: Child App Pairs Using Code
    console.log('▶ Test 4: POST /api/devices/pair (Child Handshake)');
    const pairHandshake = await request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/devices/pair',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        pairingCode,
        deviceUuid: `hardware_uuid_${Date.now()}`,
        deviceName: "Sanskar's Galaxy S23",
        deviceModel: 'Samsung SM-S911B'
      }
    );
    console.log(`  Status: ${pairHandshake.status}, Message:`, pairHandshake.data.message);
    if (pairHandshake.status !== 200 || !pairHandshake.data.deviceToken) throw new Error('Child pairing failed');
    const deviceToken = pairHandshake.data.deviceToken;
    const deviceId = pairHandshake.data.deviceId;
    console.log('  ✔ Device handshake successfully established\n');

    // Test 5: Child Heartbeat (Battery & Online status)
    console.log('▶ Test 5: POST /api/devices/heartbeat');
    const heartbeat = await request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/devices/heartbeat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': deviceToken
        }
      },
      { batteryLevel: 89 }
    );
    console.log(`  Status: ${heartbeat.status}, Message:`, heartbeat.data.message);
    if (heartbeat.status !== 200) throw new Error('Heartbeat failed');
    console.log('  ✔ Device telemetry heartbeat passed\n');

    // Test 6: Ingest Batch Notifications (WhatsApp, Instagram, Snapchat + Flagged message)
    console.log('▶ Test 6: POST /api/notifications/sync (Ingestion with Safety Detection)');
    const now = Date.now();
    const sampleNotifications = [
      {
        packageName: 'com.whatsapp',
        appName: 'WhatsApp',
        title: 'Mom',
        content: 'Remember to pack your water bottle for school!',
        postTime: now - 300000
      },
      {
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        title: 'jake_adams',
        content: 'Sent you a reel: Check this out haha',
        postTime: now - 200000
      },
      {
        packageName: 'com.snapchat.android',
        appName: 'Snapchat',
        title: 'Chloe',
        content: 'New Snap received 📸',
        postTime: now - 100000
      },
      {
        packageName: 'com.whatsapp',
        appName: 'WhatsApp',
        title: 'Unknown Contact',
        content: 'Hey secret meet behind the park today? Dont tell your parents',
        postTime: now - 50000
      }
    ];

    const syncRes = await request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/notifications/sync',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': deviceToken
        }
      },
      { notifications: sampleNotifications }
    );
    console.log(`  Status: ${syncRes.status}, Newly Saved: ${syncRes.data.newlySaved}, Flagged: ${syncRes.data.flaggedCount}`);
    if (syncRes.status !== 200 || syncRes.data.flaggedCount < 1) throw new Error('Notification sync or flagging failed');
    console.log('  ✔ Batch notification ingestion & safety flagging passed\n');

    // Test 7: Parent Query Notifications with Filter
    console.log('▶ Test 7: GET /api/notifications (Query as Parent)');
    const queryRes = await request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/notifications?packageName=com.whatsapp',
      method: 'GET',
      headers: { Authorization: `Bearer ${parentToken}` }
    });
    console.log(`  Status: ${queryRes.status}, WhatsApp Count: ${queryRes.data.data.length}`);
    if (queryRes.status !== 200 || queryRes.data.data.length !== 2) throw new Error('Query filtering failed');
    console.log('  ✔ Parent notification querying with filters passed\n');

    // Test 8: Parent Query Stats
    console.log('▶ Test 8: GET /api/notifications/stats');
    const statsRes = await request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/notifications/stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${parentToken}` }
    });
    console.log(`  Status: ${statsRes.status}, Total: ${statsRes.data.stats.totalAllTime}, Flagged: ${statsRes.data.stats.flaggedCount}`);
    console.log('  App Breakdown:', statsRes.data.stats.appBreakdown);
    if (statsRes.status !== 200 || statsRes.data.stats.totalAllTime !== 4) throw new Error('Stats computation failed');
    console.log('  ✔ Analytics stats computation passed\n');

    console.log('======================================================');
    console.log('🎉 ALL PHASE 1 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await closeDB();
  }
}

runTests();
