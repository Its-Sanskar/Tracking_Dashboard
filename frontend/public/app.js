// State Management
let currentUser = null;
let authToken = localStorage.getItem('childguard_token') || null;
let socket = null;

let currentDeviceFilter = 'all';
let currentAppFilter = 'all';
let currentSearchQuery = '';
let currentPage = 1;
let totalPages = 1;
let devicesList = [];
let registeredKeywords = [];

// DOM Elements
const authView = document.getElementById('authView');
const dashboardView = document.getElementById('dashboardView');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authFullName = document.getElementById('authFullName');
const fullNameGroup = document.getElementById('fullNameGroup');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authError = document.getElementById('authError');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const btnLogout = document.getElementById('btnLogout');

const deviceSelect = document.getElementById('deviceSelect');
const deviceStatusPill = document.getElementById('deviceStatusPill');
const deviceBatteryLevel = document.getElementById('deviceBatteryLevel');
const deviceLastSync = document.getElementById('deviceLastSync');

const statTotal = document.getElementById('statTotal');
const statToday = document.getElementById('statToday');
const statFlagged = document.getElementById('statFlagged');
const statAppsCount = document.getElementById('statAppsCount');

const countAll = document.getElementById('countAll');
const countWhatsApp = document.getElementById('countWhatsApp');
const countInstagram = document.getElementById('countInstagram');
const countSnapchat = document.getElementById('countSnapchat');
const countSms = document.getElementById('countSms');
const countFlagged = document.getElementById('countFlagged');

const notificationFeed = document.getElementById('notificationFeed');
const feedEmptyState = document.getElementById('feedEmptyState');
const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const btnRefreshFeed = document.getElementById('btnRefreshFeed');

const feedPagination = document.getElementById('feedPagination');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const pageInfo = document.getElementById('pageInfo');

// Modals
const pairingModal = document.getElementById('pairingModal');
const btnPairDevice = document.getElementById('btnPairDevice');
const btnGenerateCode = document.getElementById('btnGenerateCode');
const pairingDeviceName = document.getElementById('pairingDeviceName');
const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
const pairingCodeDigits = document.getElementById('pairingCodeDigits');

const simulatorModal = document.getElementById('simulatorModal');
const btnOpenSimulator = document.getElementById('btnOpenSimulator');
const simulatorForm = document.getElementById('simulatorForm');
const simApp = document.getElementById('simApp');
const simSender = document.getElementById('simSender');
const simContent = document.getElementById('simContent');

const keywordModal = document.getElementById('keywordModal');
const btnOpenAddKeyword = document.getElementById('btnOpenAddKeyword');
const keywordForm = document.getElementById('keywordForm');
const kwInput = document.getElementById('kwInput');
const kwSeverity = document.getElementById('kwSeverity');
const keywordsList = document.getElementById('keywordsList');

let isRegisterMode = false;

// ============================================================================
// Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  if (authToken) {
    const verified = await checkAuthSession();
    if (verified) {
      initDashboard();
      return;
    }
  }
  showAuthView();
});

function setupEventListeners() {
  // Auth tabs
  tabLogin.addEventListener('click', () => setAuthMode(false));
  tabRegister.addEventListener('click', () => setAuthMode(true));
  authForm.addEventListener('submit', handleAuthSubmit);
  btnLogout.addEventListener('click', handleLogout);

  // App Filters
  document.querySelectorAll('.app-filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.app-filter-btn').forEach((b) => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      currentAppFilter = target.getAttribute('data-app');
      currentPage = 1;
      fetchNotifications(1, true);
    });
  });

  // Device selector
  deviceSelect.addEventListener('change', (e) => {
    currentDeviceFilter = e.target.value;
    updateTelemetryView();
    currentPage = 1;
    fetchNotifications(1, true);
  });

  // Search input with debounce
  let searchTimeout = null;
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    btnClearSearch.style.display = val ? 'block' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearchQuery = val;
      currentPage = 1;
      fetchNotifications(1, true);
    }, 350);
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    btnClearSearch.style.display = 'none';
    currentSearchQuery = '';
    currentPage = 1;
    fetchNotifications(1, true);
  });

  btnRefreshFeed.addEventListener('click', () => {
    fetchNotifications(1, true);
    fetchStats();
    fetchDevices();
  });

  // Pagination
  btnPrevPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchNotifications(currentPage, true);
    }
  });

  btnNextPage.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      fetchNotifications(currentPage, true);
    }
  });

  // Modal Closers
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      document.getElementById(modalId).style.display = 'none';
    });
  });

  // Modals Openers
  btnPairDevice.addEventListener('click', () => {
    pairingModal.style.display = 'flex';
    pairingCodeDisplay.style.display = 'none';
  });

  btnGenerateCode.addEventListener('click', handleGeneratePairingCode);

  btnOpenSimulator.addEventListener('click', () => {
    simulatorModal.style.display = 'flex';
  });

  btnOpenAddKeyword.addEventListener('click', () => {
    keywordModal.style.display = 'flex';
  });

  // Simulator Form & Presets
  simulatorForm.addEventListener('submit', handleSimulateNotification);
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      applySimulatorPreset(preset);
    });
  });

  // Keyword Form
  keywordForm.addEventListener('submit', handleAddKeyword);
}

// ============================================================================
// Authentication
// ============================================================================
function setAuthMode(register) {
  isRegisterMode = register;
  tabLogin.classList.toggle('active', !register);
  tabRegister.classList.toggle('active', register);
  fullNameGroup.style.display = register ? 'flex' : 'none';
  authSubmitBtn.textContent = register ? 'Create Account' : 'Sign In';
  authError.style.display = 'none';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  authError.style.display = 'none';
  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = 'Processing...';

  const email = authEmail.value.trim();
  const password = authPassword.value;
  const fullName = authFullName.value.trim();

  const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
  const payload = isRegisterMode ? { email, password, fullName } : { email, password };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Authentication request failed');
    }

    authToken = data.token;
    currentUser = data.parent;
    localStorage.setItem('childguard_token', authToken);

    initDashboard();
  } catch (err) {
    authError.textContent = err.message;
    authError.style.display = 'block';
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isRegisterMode ? 'Create Account' : 'Sign In';
  }
}

async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error('Session expired');
    const data = await res.json();
    currentUser = data.parent;
    return true;
  } catch (e) {
    localStorage.removeItem('childguard_token');
    authToken = null;
    return false;
  }
}

function handleLogout() {
  localStorage.removeItem('childguard_token');
  authToken = null;
  currentUser = null;
  if (socket) socket.disconnect();
  showAuthView();
}

function showAuthView() {
  authView.style.display = 'flex';
  dashboardView.style.display = 'none';
}

// ============================================================================
// Dashboard Initialization
// ============================================================================
function initDashboard() {
  authView.style.display = 'none';
  dashboardView.style.display = 'flex';

  initSocketConnection();
  fetchDevices();
  fetchNotifications(1, true);
  fetchStats();
  fetchKeywords();
}

// ============================================================================
// Socket.io Real-Time Layer
// ============================================================================
function initSocketConnection() {
  if (socket) socket.disconnect();

  if (typeof io === 'undefined') {
    console.warn('Socket.io client script not found.');
    return;
  }

  socket = io({
    auth: { token: authToken }
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected with ID:', socket.id);
    if (currentUser?.id) {
      socket.emit('join_parent_room', { parentId: currentUser.id });
    }
  });

  socket.on('new_notification', (data) => {
    console.log('[Socket] New notification received:', data);
    handleLiveNotification(data.notification);
  });

  socket.on('device_telemetry', (data) => {
    console.log('[Socket] Live device telemetry:', data);
    updateDeviceTelemetryFromSocket(data);
  });

  socket.on('safety_alert', (data) => {
    console.warn('[Socket] Urgent safety alert:', data);
    playAlertTone();
  });
}

function handleLiveNotification(notif) {
  // Update stats counters
  incrementStats(notif);

  // Check if notification matches current filters
  const matchesDevice = currentDeviceFilter === 'all' || notif.deviceId === currentDeviceFilter;
  const matchesApp =
    currentAppFilter === 'all' ||
    (currentAppFilter === 'flagged_only' && notif.isFlagged) ||
    notif.packageName === currentAppFilter;

  if (matchesDevice && matchesApp) {
    if (feedEmptyState) feedEmptyState.style.display = 'none';
    const card = createNotificationCard(notif);
    notificationFeed.insertAdjacentElement('afterbegin', card);
  }
}

function updateDeviceTelemetryFromSocket(telemetry) {
  const dev = devicesList.find((d) => d._id === telemetry.deviceId);
  if (dev) {
    dev.batteryLevel = telemetry.batteryLevel;
    dev.isOnline = telemetry.isOnline;
    dev.lastSyncAt = telemetry.lastSyncAt;
  }
  updateTelemetryView();
}

// ============================================================================
// API Calls & Data Fetching
// ============================================================================
async function fetchDevices() {
  try {
    const res = await fetch('/api/devices', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) return;

    devicesList = data.devices || [];
    renderDeviceSelector();
  } catch (err) {
    console.error('Fetch devices error:', err);
  }
}

function renderDeviceSelector() {
  deviceSelect.innerHTML = '<option value="all">📱 All Monitored Devices</option>';
  devicesList.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d._id;
    opt.textContent = `📱 ${d.deviceName} (${d.batteryLevel || 100}%)`;
    if (d._id === currentDeviceFilter) opt.selected = true;
    deviceSelect.appendChild(opt);
  });
  updateTelemetryView();
}

function updateTelemetryView() {
  if (devicesList.length === 0) {
    deviceStatusPill.textContent = '● No device paired';
    deviceStatusPill.className = 'status-pill';
    deviceBatteryLevel.textContent = '🔋 --%';
    deviceLastSync.textContent = 'Never';
    return;
  }

  let active = devicesList[0];
  if (currentDeviceFilter !== 'all') {
    const found = devicesList.find((d) => d._id === currentDeviceFilter);
    if (found) active = found;
  }

  deviceStatusPill.textContent = active.isOnline ? '● Online' : '○ Offline';
  deviceStatusPill.className = `status-pill ${active.isOnline ? 'online' : 'offline'}`;
  deviceBatteryLevel.textContent = `🔋 ${active.batteryLevel || 100}%`;
  deviceLastSync.textContent = formatTimeAgo(active.lastSyncAt);
}

async function fetchNotifications(page = 1, clearFeed = true) {
  try {
    let url = `/api/notifications?page=${page}&limit=20`;
    if (currentDeviceFilter !== 'all') url += `&deviceId=${currentDeviceFilter}`;
    if (currentAppFilter === 'flagged_only') {
      url += `&flaggedOnly=true`;
    } else if (currentAppFilter !== 'all') {
      url += `&packageName=${encodeURIComponent(currentAppFilter)}`;
    }
    if (currentSearchQuery.trim()) {
      url += `&search=${encodeURIComponent(currentSearchQuery.trim())}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) return;

    totalPages = data.pagination?.totalPages || 1;
    currentPage = data.pagination?.currentPage || 1;

    renderNotifications(data.data || [], clearFeed);
    renderPagination(data.pagination);
  } catch (err) {
    console.error('Fetch notifications error:', err);
  }
}

function renderNotifications(list, clear) {
  if (clear) {
    notificationFeed.innerHTML = '';
  }

  if (list.length === 0 && clear) {
    notificationFeed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h4>No notifications found</h4>
        <p>No messages match the selected filters or search query.</p>
      </div>
    `;
    return;
  }

  list.forEach((item) => {
    const card = createNotificationCard(item);
    notificationFeed.appendChild(card);
  });
}

function createNotificationCard(item) {
  const card = document.createElement('div');
  card.className = `notification-card ${item.isFlagged ? 'is-flagged' : ''}`;

  const appClass = getAppTagClass(item.packageName);
  const deviceName = item.deviceId?.deviceName || 'Child Phone';
  const timeFormatted = formatTimeAgo(item.postTime);

  card.innerHTML = `
    <div class="card-header">
      <div class="app-badge-group">
        <span class="app-tag ${appClass}">${escapeHtml(item.appDisplayName || 'App')}</span>
        <span class="device-tag">📱 ${escapeHtml(deviceName)}</span>
      </div>
      <span class="time-stamp">${timeFormatted}</span>
    </div>
    <div class="card-sender">${escapeHtml(item.senderTitle || 'Unknown Contact')}</div>
    <div class="card-message">${escapeHtml(item.messageContent || '')}</div>
    ${
      item.isFlagged
        ? `<div class="card-flag-alert">⚠️ <strong>Threat Flagged:</strong> ${escapeHtml(item.flagReason || 'Sensitive word detected')}</div>`
        : ''
    }
  `;

  return card;
}

function renderPagination(pagination) {
  if (!pagination || pagination.totalPages <= 1) {
    feedPagination.style.display = 'none';
    return;
  }

  feedPagination.style.display = 'flex';
  pageInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
  btnPrevPage.disabled = pagination.currentPage <= 1;
  btnNextPage.disabled = pagination.currentPage >= pagination.totalPages;
}

// ============================================================================
// Stats & App Counts
// ============================================================================
async function fetchStats() {
  try {
    const res = await fetch('/api/notifications/stats', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) return;

    const stats = data.stats;
    statTotal.textContent = stats.totalAllTime;
    statToday.textContent = stats.totalToday;
    statFlagged.textContent = stats.flaggedCount;
    countFlagged.textContent = stats.flaggedCount;
    countAll.textContent = stats.totalAllTime;

    let waCount = 0;
    let igCount = 0;
    let scCount = 0;
    let smsCount = 0;

    stats.appBreakdown.forEach((item) => {
      const pkg = item.packageName;
      if (pkg.includes('whatsapp')) waCount += item.count;
      else if (pkg.includes('instagram')) igCount += item.count;
      else if (pkg.includes('snapchat')) scCount += item.count;
      else if (pkg.includes('messaging')) smsCount += item.count;
    });

    countWhatsApp.textContent = waCount;
    countInstagram.textContent = igCount;
    countSnapchat.textContent = scCount;
    countSms.textContent = smsCount;
    statAppsCount.textContent = stats.appBreakdown.length;
  } catch (e) {
    console.error('Fetch stats error:', e);
  }
}

function incrementStats(item) {
  statTotal.textContent = Number(statTotal.textContent || 0) + 1;
  statToday.textContent = Number(statToday.textContent || 0) + 1;
  countAll.textContent = Number(countAll.textContent || 0) + 1;

  if (item.isFlagged) {
    statFlagged.textContent = Number(statFlagged.textContent || 0) + 1;
    countFlagged.textContent = Number(countFlagged.textContent || 0) + 1;
  }

  const pkg = item.packageName || '';
  if (pkg.includes('whatsapp')) countWhatsApp.textContent = Number(countWhatsApp.textContent || 0) + 1;
  if (pkg.includes('instagram')) countInstagram.textContent = Number(countInstagram.textContent || 0) + 1;
  if (pkg.includes('snapchat')) countSnapchat.textContent = Number(countSnapchat.textContent || 0) + 1;
  if (pkg.includes('messaging')) countSms.textContent = Number(countSms.textContent || 0) + 1;
}

// ============================================================================
// Keywords Watchlist
// ============================================================================
async function fetchKeywords() {
  try {
    const res = await fetch('/api/keywords', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) return;

    registeredKeywords = data.customKeywords || [];
    renderKeywords(data.customKeywords, data.defaultKeywords);
  } catch (e) {
    console.error('Fetch keywords error:', e);
  }
}

function renderKeywords(custom = [], defaults = []) {
  keywordsList.innerHTML = '';

  // Custom keywords first
  custom.forEach((k) => {
    const tag = document.createElement('span');
    tag.className = 'keyword-tag danger';
    tag.innerHTML = `
      ${escapeHtml(k.keyword)}
      <button class="btn-remove-tag" data-id="${k._id}" title="Remove keyword">✕</button>
    `;
    tag.querySelector('.btn-remove-tag').addEventListener('click', () => removeKeyword(k._id));
    keywordsList.appendChild(tag);
  });

  // Default keywords as subtle tags
  defaults.slice(0, 10).forEach((kw) => {
    const tag = document.createElement('span');
    tag.className = 'keyword-tag';
    tag.textContent = kw;
    keywordsList.appendChild(tag);
  });
}

async function handleAddKeyword(e) {
  e.preventDefault();
  const keyword = kwInput.value.trim();
  const severity = kwSeverity.value;

  try {
    const res = await fetch('/api/keywords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ keyword, severity })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to add keyword');
    }

    kwInput.value = '';
    keywordModal.style.display = 'none';
    fetchKeywords();
  } catch (err) {
    alert(err.message);
  }
}

async function removeKeyword(id) {
  try {
    await fetch(`/api/keywords/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    fetchKeywords();
  } catch (e) {
    console.error('Delete keyword error:', e);
  }
}

// ============================================================================
// Device Pairing Handshake
// ============================================================================
async function handleGeneratePairingCode() {
  const deviceName = pairingDeviceName.value.trim() || "Child's Phone";

  try {
    btnGenerateCode.disabled = true;
    btnGenerateCode.textContent = 'Generating...';

    const res = await fetch('/api/devices/generate-pairing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ deviceName })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Could not generate code');

    pairingCodeDigits.textContent = data.pairingCode;
    pairingCodeDisplay.style.display = 'block';
    fetchDevices();
  } catch (e) {
    alert(e.message);
  } finally {
    btnGenerateCode.disabled = false;
    btnGenerateCode.textContent = 'Generate Pairing Code';
  }
}

// ============================================================================
// Live Simulator (For instant browser validation)
// ============================================================================
function applySimulatorPreset(preset) {
  if (preset === 'whatsapp-normal') {
    simApp.value = 'com.whatsapp|WhatsApp';
    simSender.value = 'Mom';
    simContent.value = 'Dinner is ready, please come downstairs.';
  } else if (preset === 'instagram-dm') {
    simApp.value = 'com.instagram.android|Instagram';
    simSender.value = 'alex_99';
    simContent.value = 'Check out this hilarious video I sent you 😂';
  } else if (preset === 'danger-keyword') {
    simApp.value = 'com.whatsapp|WhatsApp';
    simSender.value = 'Stranger_X';
    simContent.value = 'Where do you live? Secret meet behind the park, dont tell your parents!';
  }
}

async function handleSimulateNotification(e) {
  e.preventDefault();

  const [packageName, appName] = simApp.value.split('|');
  const title = simSender.value.trim();
  const content = simContent.value.trim();

  // If no device exists yet, auto-create one for simulation
  let targetDevice = devicesList[0];
  let deviceToken = targetDevice?.deviceToken;

  if (!targetDevice) {
    // Generate pairing & pair mock device automatically
    const pairRes = await fetch('/api/devices/generate-pairing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ deviceName: "Sanskar's Galaxy S23 (Simulated)" })
    });
    const pairData = await pairRes.json();

    const handshake = await fetch('/api/devices/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairingCode: pairData.pairingCode,
        deviceUuid: 'sim_' + Date.now(),
        deviceName: "Sanskar's Galaxy S23 (Simulated)",
        deviceModel: 'Samsung Galaxy S23'
      })
    });
    const handshakeData = await handshake.json();
    deviceToken = handshakeData.deviceToken;
    await fetchDevices();
  }

  // Submit notification to /sync endpoint
  try {
    const syncRes = await fetch('/api/notifications/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': deviceToken || 'simulated-token'
      },
      body: JSON.stringify({
        notifications: [
          {
            packageName,
            appName,
            title,
            content,
            postTime: Date.now()
          }
        ]
      })
    });

    const syncData = await syncRes.json();
    if (!syncRes.ok) throw new Error(syncData.message || 'Sync failed');

    simulatorModal.style.display = 'none';
  } catch (err) {
    alert('Simulator Error: ' + err.message);
  }
}

// ============================================================================
// Helper Utilities
// ============================================================================
function getAppTagClass(pkg = '') {
  if (pkg.includes('whatsapp')) return 'whatsapp';
  if (pkg.includes('instagram')) return 'instagram';
  if (pkg.includes('snapchat')) return 'snapchat';
  if (pkg.includes('messaging')) return 'sms';
  return 'default-app';
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function playAlertTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // AudioContext blocked by browser autoplay policy until user interaction
  }
}
