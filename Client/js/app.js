// ===================== إعدادات =====================
const API_BASE = '/api';
const VAPID_PUBLIC_KEY = 'BF7IlardTlVn6X4dNtcTad2ixM09jH87Q-vKyo5ScWY9uzLw3y-goXcgPmC8gxBpFWIGVgFWKxwC2pTDXNYnlD4';

let map;
let selectedCoords = null;
let currentView = '';

// ===================== صوت الإشعار =====================
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const frequencies = [600, 800, 1000, 1200];
    frequencies.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.3);
    });
  } catch(e) {}
}

// ===================== دوال مساعدة =====================
function getTimeLeft(expiryTime) {
  const expiry = new Date(expiryTime);
  const now = new Date();
  const diffMs = expiry - now;
  if (diffMs <= 0) return 'انتهت';
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

function formatExpiryDate(expiryTime) {
  const d = new Date(expiryTime);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${month}/${day}/${year}`;
}

function tempDisplay(temp) {
  return temp === 'hot' ? '🔥 ساخن' : '❄️ بارد';
}

function sizeDisplay(size) {
  return size === 'bike' ? '🛵 تكفي دراجة نارية' : '🚗 تحتاج سيارة';
}

// ===================== نافذة منبثقة =====================
function showPopupNotification(ad, type = 'info') {
  if (!ad || !ad.foodType) {
    if (ad && ad._id) {
      api.getAd(ad._id).then(fullAd => showPopupNotification(fullAd, type)).catch(() => {});
    }
    return;
  }

  const old = document.querySelector('.popup-notification');
  if (old) old.remove();

  const timeLeft = getTimeLeft(ad.expiryTime);
  const expiryDate = formatExpiryDate(ad.expiryTime);
  const mapsUrl = ad.coords ? `https://www.google.com/maps?q=${ad.coords.lat},${ad.coords.lng}` : '#';
  const tempText = ad.temp ? tempDisplay(ad.temp) : '';
  const sizeText = ad.size ? sizeDisplay(ad.size) : '';

  const popup = document.createElement('div');
  popup.className = 'popup-notification';
  popup.innerHTML = `
    <div class="popup-overlay"></div>
    <div class="popup-content popup-${type} popup-compact">
      <span class="popup-close" id="popup-close-btn">&times;</span>
      <div class="popup-icon">🔔</div>
      <h3>${type === 'warning' ? 'تم حجز إعلانك!' : 'إعلان جديد متاح!'}</h3>
      <div class="popup-details">
        <p><strong>🍲 النوع:</strong> ${ad.foodType}</p>
        <p><strong>📦 الكمية:</strong> ${ad.quantity} وجبة</p>
        <p><strong>🌡️ الحالة:</strong> ${tempText} | <strong>📏</strong> ${sizeText}</p>
        <p><strong>📍 الموقع:</strong> ${ad.locationName}</p>
        <p><strong>👤 المُتبرع:</strong> ${ad.donorName}</p>
        <p><strong>📞 الهاتف:</strong> <a href="tel:${ad.donorPhone}" style="color:#2d6a4f;">${ad.donorPhone || 'غير متوفر'}</a></p>
        <p><strong>⏳ الوقت المتبقي:</strong> ${timeLeft}</p>
        <p><strong>🕒 تاريخ الانتهاء:</strong> ${expiryDate}</p>
        <p><a href="${mapsUrl}" target="_blank" class="map-link-popup">🗺️ عرض الموقع على الخريطة</a></p>
      </div>
      <div class="popup-actions">
        <button class="popup-btn claim-popup-btn" id="popup-claim-btn">أقبل الإعلان</button>
        <button class="popup-btn ignore-popup-btn" id="popup-ignore-btn">تجاهل</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);

  document.getElementById('popup-close-btn').addEventListener('click', () => popup.remove());
  document.getElementById('popup-ignore-btn').addEventListener('click', () => popup.remove());
  document.getElementById('popup-claim-btn').addEventListener('click', async () => {
    try {
      await api.claimAd(ad._id);
      popup.remove();
      alert('تم قبول الإعلان بنجاح!');
      const card = document.querySelector(`.card[data-id="${ad._id}"]`);
      if (card) card.remove();
      router();
    } catch (err) {
      alert('عذراً: ' + err.message);
      popup.remove();
    }
  });
}

// ===================== المصادقة والتخزين =====================
let currentUser = null;

function loadUser() {
  const userStr = localStorage.getItem('faddel_user');
  if (userStr) currentUser = JSON.parse(userStr);
  return currentUser;
}

function saveUser(user) {
  currentUser = user;
  localStorage.setItem('faddel_user', JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem('faddel_token');
}

function isLoggedIn() {
  return !!getToken();
}

function logout() {
  localStorage.removeItem('faddel_token');
  localStorage.removeItem('faddel_user');
  currentUser = null;
  window.location.hash = '#/login';
}

// ===================== API =====================
async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('faddel_token');
    localStorage.removeItem('faddel_user');
    window.location.hash = '#/login';
    throw new Error('يرجي مراجعة معلومات الدخول');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'حدث خطأ' }));
    throw new Error(err.error || 'فشل الطلب');
  }
  return res.json();
}

const api = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  savePushSubscription: (sub) => request('/auth/push-subscription', { method: 'PUT', body: JSON.stringify({ subscription: sub }) }),
  createAd: (data) => request('/ads', { method: 'POST', body: JSON.stringify(data) }),
  getAvailableAds: () => request('/ads/available'),
  claimAd: (adId) => request(`/ads/${adId}/claim`, { method: 'PUT' }),
  getMyClaims: () => request('/ads/my-claims'),
  getMyDonations: () => request('/ads/my-donations'),
  deleteAd: (adId) => request(`/ads/${adId}`, { method: 'DELETE' }),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: () => request('/auth/account', { method: 'DELETE' }),
  sendMessage: (adId, text, receiverId) => request('/messages', { method: 'POST', body: JSON.stringify({ adId, text, receiverId }) }),
  getMessages: (adId) => request(`/messages/${adId}`),
  getNotifications: () => request('/notifications'),
  markNotificationsRead: () => request('/notifications/read-all', { method: 'PUT' }),
  deleteNotifications: () => request('/notifications', { method: 'DELETE' }),
  deleteAllClaims: () => request('/ads/my-claims/all', { method: 'DELETE' }),
  deleteAllDonations: () => request('/ads/my-donations/all', { method: 'DELETE' }),
  getAd: (id) => request(`/ads/${id}`)
};

// ===================== إشعارات Web Push =====================
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await api.savePushSubscription(subscription);
    console.log('✅ تم الاشتراك في الإشعارات');
  } catch (err) {
    console.error('فشل الاشتراك في الإشعارات:', err);
  }
}

// ===================== عناصر DOM =====================
const app = document.getElementById('app');
const addBtn = document.getElementById('add-btn');
const modal = document.getElementById('add-modal');
const closeModalBtn = document.querySelector('.close');
const addForm = document.getElementById('add-form');
const mainNav = document.getElementById('main-nav');

// جرس الإشعارات
let notificationCount = 0;
let notificationsList = [];
const notifBell = document.createElement('div');
notifBell.id = 'notif-bell';
notifBell.innerHTML = '🔔 <span id="notif-count" class="notif-badge">0</span>';
document.body.appendChild(notifBell);
const notifDropdown = document.createElement('div');
notifDropdown.id = 'notif-dropdown';
notifDropdown.className = 'notif-dropdown';
notifDropdown.innerHTML = '<div class="notif-list"></div><div class="notif-actions"><button id="mark-read">تحديد الكل كمقروء</button><button id="clear-all">مسح الكل</button></div>';
document.body.appendChild(notifDropdown);

function updateNotifBadge(count) {
  document.getElementById('notif-count').textContent = count;
  notifBell.style.display = count > 0 ? 'flex' : 'none';
}

function renderNotifications() {
  const list = notifDropdown.querySelector('.notif-list');
  list.innerHTML = '';
  if (notificationsList.length === 0) {
    list.innerHTML = '<p style="padding:10px;text-align:center;">لا توجد إشعارات</p>';
  } else {
    notificationsList.forEach(n => {
      const item = document.createElement('div');
      item.className = `notif-item ${n.read ? '' : 'unread'}`;
      item.textContent = n.message;
      list.appendChild(item);
    });
  }
}

async function loadNotifications() {
  try {
    const notifs = await api.getNotifications();
    notificationsList = notifs;
    notificationCount = notifs.filter(n => !n.read).length;
    updateNotifBadge(notificationCount);
    renderNotifications();
  } catch(e) {}
}

notifBell.addEventListener('click', () => {
  notifDropdown.classList.toggle('open');
  loadNotifications();
});

document.getElementById('mark-read').addEventListener('click', async (e) => {
  e.stopPropagation();
  await api.markNotificationsRead();
  notificationsList.forEach(n => n.read = true);
  notificationCount = 0;
  updateNotifBadge(0);
  renderNotifications();
});

document.getElementById('clear-all').addEventListener('click', async (e) => {
  e.stopPropagation();
  await api.deleteNotifications();
  notificationsList = [];
  notificationCount = 0;
  updateNotifBadge(0);
  renderNotifications();
  notifDropdown.classList.remove('open');
});

window.addEventListener('click', (e) => {
  if (!notifBell.contains(e.target) && !notifDropdown.contains(e.target)) {
    notifDropdown.classList.remove('open');
  }
});

// ===================== التوجيه =====================
let globalEventSource = null;
let donorEventSource = null;
let notificationEventSource = null;

function router() {
  const hash = window.location.hash || '#/available';
  const parts = hash.substring(2).split('/');
  currentView = parts[0];

  if (globalEventSource) globalEventSource.close();
  if (donorEventSource) donorEventSource.close();
  if (notificationEventSource) notificationEventSource.close();

  renderNav();

  if (isLoggedIn() && currentView !== 'login' && currentView !== 'register') {
    setupNotificationSSE();
  }

  switch (currentView) {
    case 'login': renderLogin(); break;
    case 'register': renderRegister(); break;
    case 'profile':
      if (!isLoggedIn()) { window.location.hash = '#/login'; return; }
      renderProfile();
      break;
    case 'available':
      if (!isLoggedIn()) { window.location.hash = '#/login'; return; }
      renderAvailableAds();
      setupGlobalSSE();
      break;
    case 'my-claims':
      if (!isLoggedIn()) { window.location.hash = '#/login'; return; }
      renderMyClaims();
      break;
    case 'my-donations':
      if (!isLoggedIn()) { window.location.hash = '#/login'; return; }
      renderMyDonations();
      setupDonorSSE();
      break;
    case 'chat':
      if (!isLoggedIn()) { window.location.hash = '#/login'; return; }
      const adId = parts[1];
      if (adId) renderChat(adId);
      else window.location.hash = '#/available';
      break;
    default:
      window.location.hash = '#/available';
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', () => {
  loadUser();
  if (isLoggedIn()) subscribeToPush();
  router();
});

// ===================== SSE =====================
function buildAdCard(ad) {
  const timeLeft = getTimeLeft(ad.expiryTime);
  const expiryDate = formatExpiryDate(ad.expiryTime);
  const mapsUrl = `https://www.google.com/maps?q=${ad.coords.lat},${ad.coords.lng}`;
  const tempText = ad.temp ? tempDisplay(ad.temp) : '';
  const sizeText = ad.size ? sizeDisplay(ad.size) : '';

  return `
    <div class="card" data-id="${ad._id}">
      <div class="card-header">
        <h3>${ad.foodType} (${ad.quantity} وجبة)</h3>
        <span class="expiry">⏳ ${timeLeft}</span>
      </div>
      <div class="card-body">
        <p><span>🌡️</span> ${tempText} | <span>📏</span> ${sizeText}</p>
        <p><span>📍</span> ${ad.locationName}</p>
        <p><span>👤</span> ${ad.donorName}</p>
        <p><span>📞</span> <a href="tel:${ad.donorPhone}" style="color:var(--primary);">${ad.donorPhone || 'غير متوفر'}</a></p>
        <p><span>🕒</span> ${expiryDate}</p>
        <p><a href="${mapsUrl}" target="_blank" rel="noopener" class="map-link">🗺️ عرض الموقع على الخريطة</a></p>
      </div>
      <button class="claim-btn" onclick="claimAd('${ad._id}')">أقبل</button>
    </div>
  `;
}

function setupGlobalSSE() {
  const token = getToken();
  if (!token) return;
  globalEventSource = new EventSource(`/api/ads/events?token=${encodeURIComponent(token)}`);
  globalEventSource.addEventListener('new-ad', (e) => {
    const ad = JSON.parse(e.data);
    if (currentUser && ad.donorId === currentUser.id) return;
    playNotificationSound();
    showPopupNotification(ad, 'info');
    const adsGrid = document.querySelector('.ads-grid');
    if (adsGrid) {
      const cardHTML = buildAdCard(ad);
      adsGrid.insertAdjacentHTML('afterbegin', cardHTML);
      const emptyMsg = adsGrid.querySelector('.empty-message');
      if (emptyMsg) emptyMsg.remove();
    }
  });
}

function setupDonorSSE() {
  const user = loadUser();
  if (!user) return;
  const token = getToken();
  if (!token) return;
  if (donorEventSource) donorEventSource.close();
  donorEventSource = new EventSource(`/api/ads/events/${user.id}?token=${encodeURIComponent(token)}`);
  
  donorEventSource.addEventListener('ad-claimed', (e) => {
    const ad = JSON.parse(e.data);
    playNotificationSound();
    showPopupNotification(ad, 'warning');
    if (currentView === 'my-donations') renderMyDonations();
  });
  
  donorEventSource.addEventListener('new-message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      loadNotifications();
      if (currentView === 'chat' && window.location.hash.endsWith(msg.adId)) {
        const list = document.getElementById('messages-list');
        if (list) {
          const isSent = msg.senderId === currentUser.id;
          const div = document.createElement('div');
          div.className = `message ${isSent ? 'sent' : 'received'}`;
          div.innerHTML = `<div class="message-text">${msg.text}</div><div class="message-time">${new Date(msg.createdAt).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}</div>`;
          list.appendChild(div);
          list.scrollTop = list.scrollHeight;
        }
      }
    } catch(err) {}
  });
}

function setupNotificationSSE() {
  const token = getToken();
  if (!token) return;
  if (notificationEventSource) notificationEventSource.close();
  notificationEventSource = new EventSource(`/api/notifications/events?token=${encodeURIComponent(token)}`);
  notificationEventSource.addEventListener('notification', (e) => {
    try {
      const notif = JSON.parse(e.data);
      notificationsList.unshift(notif);
      notificationCount = notificationsList.filter(n => !n.read).length;
      updateNotifBadge(notificationCount);
      if (notifDropdown.classList.contains('open')) {
        renderNotifications();
      }
    } catch(err) {}
  });
}

// ===================== شريط التنقل =====================
function renderNav() {
  const user = loadUser();
  if (user) {
    mainNav.innerHTML = `
      <button onclick="window.location.hash='#/available'">الإعلانات</button>
      <button onclick="window.location.hash='#/my-claims'">محجوزاتي</button>
      <button onclick="window.location.hash='#/my-donations'">تبرعاتي</button>
      <button onclick="window.location.hash='#/profile'">حسابي</button>
      <span>مرحباً، ${user.name}</span>
      <button onclick="logout()">تسجيل الخروج</button>
    `;
    addBtn.style.display = 'block';
  } else {
    mainNav.innerHTML = `
      <button onclick="window.location.hash='#/login'">دخول</button>
      <button onclick="window.location.hash='#/register'">حساب جديد</button>
    `;
    addBtn.style.display = 'none';
  }
}

// ===================== صفحات المصادقة =====================
function renderLogin() {
  app.innerHTML = `
    <div class="auth-form">
      <h2>تسجيل الدخول</h2>
      <form id="login-form">
        <input type="email" id="login-email" placeholder="البريد الإلكتروني" required>
        <input type="password" id="login-password" placeholder="كلمة المرور" required>
        <button type="submit">دخول</button>
      </form>
      <p>ليس لديك حساب؟ <a href="#/register">إنشاء حساب</a></p>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
      const data = await api.login({ email, password });
      localStorage.setItem('faddel_token', data.token);
      saveUser(data.user);
      await subscribeToPush();
      window.location.hash = '#/available';
    } catch (err) { alert(err.message); }
  });
}

function renderRegister() {
  app.innerHTML = `
    <div class="auth-form">
      <h2>إنشاء حساب</h2>
      <form id="register-form">
        <input type="text" id="reg-name" placeholder="الاسم الكامل" required>
        <input type="email" id="reg-email" placeholder="البريد الإلكتروني" required>
        <input type="password" id="reg-password" placeholder="كلمة المرور" required>
        <input type="text" id="reg-phone" placeholder="رقم الهاتف">
        <label>نوع المركبة:</label>
        <select id="reg-vehicle">
          <option value="car">🚗 سيارة</option>
          <option value="bike">🛵 دراجة نارية</option>
        </select>
        <button type="submit">إنشاء حساب</button>
      </form>
      <p>لديك حساب؟ <a href="#/login">تسجيل الدخول</a></p>
    </div>
  `;
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;
    const vehicle = document.getElementById('reg-vehicle').value;
    try {
      const data = await api.register({ name, email, password, phone, vehicle });
      localStorage.setItem('faddel_token', data.token);
      saveUser(data.user);
      await subscribeToPush();
      window.location.hash = '#/available';
    } catch (err) { alert(err.message); }
  });
}

// ===================== صفحة حسابي =====================
function renderProfile() {
  const user = loadUser();
  if (!user) return;
  app.innerHTML = `
    <div class="auth-form">
      <h2>تعديل الملف الشخصي</h2>
      <form id="profile-form">
        <input type="text" id="prof-name" placeholder="الاسم الكامل" value="${user.name}" required>
        <input type="email" id="prof-email" value="${user.email}" disabled style="background:#f0f0f0;">
        <input type="text" id="prof-phone" placeholder="رقم الهاتف" value="${user.phone || ''}">
        <label>نوع المركبة:</label>
        <select id="prof-vehicle">
          <option value="car" ${user.vehicle === 'car' ? 'selected' : ''}>🚗 سيارة</option>
          <option value="bike" ${user.vehicle === 'bike' ? 'selected' : ''}>🛵 دراجة نارية</option>
        </select>
        <input type="password" id="prof-password" placeholder="كلمة مرور جديدة (اترك فارغاً)">
        <button type="submit">حفظ التعديلات</button>
      </form>
      <button id="delete-account-btn" style="background:#c44; color:white; border:none; padding:10px 20px; border-radius:20px; margin-top:15px; width:100%; cursor:pointer;">🗑️ حذف حسابي</button>
    </div>
  `;
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('prof-name').value.trim();
    const phone = document.getElementById('prof-phone').value.trim();
    const vehicle = document.getElementById('prof-vehicle').value;
    const password = document.getElementById('prof-password').value;
    try {
      const result = await api.updateProfile({ name, phone, password: password || undefined, vehicle });
      saveUser(result.user);
      alert('تم تحديث الملف الشخصي بنجاح');
      router();
    } catch (err) { alert(err.message); }
  });
  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    if (confirm('هل أنت متأكد من حذف حسابك نهائياً؟ لا يمكن التراجع.')) {
      try {
        await api.deleteAccount();
        localStorage.clear();
        alert('تم حذف الحساب');
        window.location.hash = '#/login';
      } catch (err) { alert(err.message); }
    }
  });
}

// ===================== الإعلانات المتاحة =====================
async function renderAvailableAds() {
  app.innerHTML = '<p>جاري تحميل الإعلانات...</p>';
  try {
    const ads = await api.getAvailableAds();
    let html = '<div class="ads-grid">';
    if (ads.length === 0) {
      html += '<p class="empty-message">لا توجد إعلانات متاحة حالياً.</p>';
    } else {
      ads.forEach(ad => html += buildAdCard(ad));
    }
    html += '</div>';
    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = '<p>خطأ في تحميل الإعلانات</p>';
  }
}

window.claimAd = async function(adId) {
  try {
    await api.claimAd(adId);
    alert('تم قبول الإعلان بنجاح');
    router();
  } catch (err) { alert(err.message); }
};

// ===================== محجوزاتي =====================
async function renderMyClaims() {
  app.innerHTML = '<p>جاري التحميل...</p>';
  try {
    const ads = await api.getMyClaims();
    if (ads.length === 0) {
      app.innerHTML = '<p>لم تحجز أي إعلان بعد.</p>';
      return;
    }
    let html = '<h2>الإعلانات التي حجزتها</h2>';
    html += '<button id="delete-all-claims" style="margin-bottom:15px; background:#c44; color:white; border:none; padding:8px 16px; border-radius:20px; cursor:pointer;">🗑️ حذف جميع المحجوزات القديمة</button>';
    html += '<div class="ads-grid">';
    ads.forEach(ad => {
      const expiryDate = formatExpiryDate(ad.expiryTime);
      const mapsUrl = `https://www.google.com/maps?q=${ad.coords.lat},${ad.coords.lng}`;
      html += `
        <div class="card claimed">
          <div class="card-header"><h3>${ad.foodType} (${ad.quantity} وجبة)</h3></div>
          <div class="card-body">
            <p>📍 ${ad.locationName}</p>
            <p><a href="${mapsUrl}" target="_blank" class="map-link">🗺️ الموقع</a></p>
            <p>🕒 ${expiryDate}</p>
            <button class="donor-info-btn" onclick="showDonorInfo('${ad._id}')">إظهار بيانات المتبرع</button>
            <div id="donor-${ad._id}" class="donor-details" style="display:none;">
              <p><strong>الاسم:</strong> ${ad.donorName}</p>
              <p><strong>الهاتف:</strong> <a href="tel:${ad.donorPhone}">${ad.donorPhone || 'غير متوفر'}</a></p>
              <p><strong>الموقع:</strong> <a href="${mapsUrl}" target="_blank">عرض على الخريطة</a></p>
            </div>
            <button class="claim-btn" style="margin-top:10px;" onclick="window.location.hash='#/chat/${ad._id}'">💬 محادثة</button>
            <div class="quick-reply">
              <input type="text" id="quick-msg-${ad._id}" placeholder="رد سريع...">
              <button onclick="sendQuickMessage('${ad._id}', '${ad.donorId}')">إرسال</button>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    app.innerHTML = html;

    document.getElementById('delete-all-claims').addEventListener('click', async () => {
      if (confirm('هل أنت متأكد من حذف جميع المحجوزات القديمة؟')) {
        try {
          const res = await api.deleteAllClaims();
          alert(res.message);
          router();
        } catch (err) { alert(err.message); }
      }
    });
  } catch (err) {
    app.innerHTML = '<p>خطأ في تحميل المحجوزات</p>';
  }
}

// ===================== تبرعاتي =====================
async function renderMyDonations() {
  app.innerHTML = '<p>جاري التحميل...</p>';
  try {
    const ads = await api.getMyDonations();
    if (ads.length === 0) {
      app.innerHTML = '<p>لم تنشر أي إعلان بعد.</p>';
      return;
    }
    let html = '<h2>إعلاناتي المنشورة</h2>';
    html += '<button id="delete-all-donations" style="margin-bottom:15px; background:#c44; color:white; border:none; padding:8px 16px; border-radius:20px; cursor:pointer;">🗑️ حذف جميع التبرعات القديمة</button>';
    html += '<div class="ads-grid">';
    ads.forEach(ad => {
      let statusText;
      switch (ad.status) {
        case 'available': statusText = '🟢 متاح'; break;
        case 'claimed': statusText = '🔴 محجوز'; break;
        case 'expired': statusText = '⏳ منتهي الصلاحية'; break;
      }
      const expiryDate = formatExpiryDate(ad.expiryTime);
      const mapsUrl = `https://www.google.com/maps?q=${ad.coords.lat},${ad.coords.lng}`;
      html += `
        <div class="card">
          <div class="card-header">
            <h3>${ad.foodType} (${ad.quantity} وجبة) - ${statusText}</h3>
          </div>
          <div class="card-body">
            <p>📍 ${ad.locationName}</p>
            <p>🕒 ${expiryDate}</p>
            <p><a href="${mapsUrl}" target="_blank" class="map-link">🗺️ الموقع</a></p>
            ${ad.status === 'available' ? 
              `<button class="delete-btn" onclick="deleteAd('${ad._id}')" style="margin-top:8px;">🗑️ حذف الإعلان</button>` 
              : ad.status === 'claimed' ? 
                `<button class="claim-btn" onclick="window.location.hash='#/chat/${ad._id}'">💬 محادثة</button>`
              : ''}
            ${ad.status === 'claimed' ? 
              `<div class="quick-reply">
                <input type="text" id="quick-msg-${ad._id}" placeholder="رد سريع...">
                <button onclick="sendQuickMessage('${ad._id}', '${ad.recipientId}')">إرسال</button>
              </div>` 
              : ''}
          </div>
        </div>
      `;
    });
    html += '</div>';
    app.innerHTML = html;

    document.getElementById('delete-all-donations').addEventListener('click', async () => {
      if (confirm('هل أنت متأكد من حذف جميع التبرعات القديمة؟')) {
        try {
          const res = await api.deleteAllDonations();
          alert(res.message);
          router();
        } catch (err) { alert(err.message); }
      }
    });
  } catch (err) {
    app.innerHTML = '<p>خطأ في تحميل التبرعات</p>';
  }
}

window.sendQuickMessage = async function(adId, receiverId) {
  const input = document.getElementById(`quick-msg-${adId}`);
  const text = input.value.trim();
  if (!text) return;
  try {
    await api.sendMessage(adId, text, receiverId);
    input.value = '';
    alert('تم الإرسال');
  } catch(e) { alert(e.message); }
};

// ===================== صفحة المحادثة =====================
async function renderChat(adId) {
  app.innerHTML = '<p>جاري تحميل المحادثة...</p>';
  try {
    const [claims, donations] = await Promise.all([api.getMyClaims(), api.getMyDonations()]);
    const allAds = [...claims, ...donations];
    const ad = allAds.find(a => a._id === adId);
    if (!ad) {
      app.innerHTML = '<p>الإعلان غير موجود أو لا تملك صلاحية الوصول إليه.</p>';
      return;
    }
    const otherPartyName = ad.donorId === currentUser.id ? (ad.donorName || 'المتلقي') : ad.donorName;
    const otherPartyId = ad.donorId === currentUser.id ? ad.recipientId : ad.donorId;

    const messages = await api.getMessages(adId);
    let html = `
      <div class="chat-container">
        <div class="chat-header">💬 محادثة حول "${ad.foodType}" - ${otherPartyName}</div>
        <div class="messages-list" id="messages-list">
    `;
    messages.forEach(msg => {
      const isSent = msg.senderId._id === currentUser.id || msg.senderId === currentUser.id;
      html += `
        <div class="message ${isSent ? 'sent' : 'received'}">
          <div class="message-text">${msg.text}</div>
          <div class="message-time">${new Date(msg.createdAt).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      `;
    });
    html += `
        </div>
        <div class="chat-input">
          <input type="text" id="chat-input-text" placeholder="اكتب رسالتك...">
          <button id="chat-send-btn">إرسال</button>
        </div>
      </div>
    `;
    app.innerHTML = html;

    setupDonorSSE();

    document.getElementById('chat-send-btn').addEventListener('click', async () => {
      const text = document.getElementById('chat-input-text').value.trim();
      if (!text) return;
      try {
        await api.sendMessage(adId, text, otherPartyId);
        document.getElementById('chat-input-text').value = '';
      } catch (err) {
        alert(err.message);
      }
    });
  } catch (err) {
    app.innerHTML = '<p>خطأ في تحميل المحادثة</p>';
  }
}

// ===================== النافذة المنبثقة للإضافة =====================
addBtn.addEventListener('click', () => {
  const user = loadUser();
  if (!user) return;
  modal.style.display = 'block';
  setTimeout(initMap, 200);
});

closeModalBtn.addEventListener('click', () => { modal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

function buildAddForm() {
  addForm.innerHTML = `
    <input type="text" id="foodType" placeholder="نوع الطعام" required>
    <input type="number" id="quantity" placeholder="الكمية" required>
    <input type="text" id="locationName" placeholder="وصف الموقع" required>
    <div class="date-confirm">
      <input type="datetime-local" id="expiryInput" required>
      <button type="button" id="confirm-date-btn">تأكيد التاريخ</button>
    </div>
    <p id="confirmed-date-display" style="font-size:0.9rem; color:var(--primary); margin-bottom:10px;"></p>
    <label>حالة الطعام:</label>
    <select id="tempSelect">
      <option value="hot">ساخن</option>
      <option value="cold">بارد</option>
    </select>
    <label>حجم الوجبة:</label>
    <select id="sizeSelect">
      <option value="bike">🛵 تكفي دراجة نارية</option>
      <option value="car">🚗 تحتاج سيارة</option>
    </select>
    <button type="button" class="location-btn" id="use-location-btn">📍 استخدام موقعي الحالي</button>
    <label>حدد الموقع على الخريطة:</label>
    <div id="map-container"></div>
    <p id="coords-display">الإحداثيات: لم تُحدد بعد</p>
    <button type="submit">نشر الإعلان</button>
  `;

  document.getElementById('confirm-date-btn').addEventListener('click', () => {
    const val = document.getElementById('expiryInput').value;
    if (val) {
      const d = new Date(val);
      const formatted = formatExpiryDate(d.toISOString());
      document.getElementById('confirmed-date-display').textContent = `التاريخ المختار: ${formatted}`;
    }
  });

  document.getElementById('use-location-btn').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        selectedCoords = { lat, lng };
        updateCoordsDisplay(lat, lng);
        if (map) {
          map.setView([lat, lng], 15);
          if (map._marker) map._marker.setLatLng([lat, lng]);
        }
      }, err => {
        alert('لم يتمكن من الحصول على موقعك: ' + err.message);
      });
    } else {
      alert('متصفحك لا يدعم تحديد الموقع');
    }
  });

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const foodType = document.getElementById('foodType').value.trim();
    const quantity = parseInt(document.getElementById('quantity').value);
    const locationName = document.getElementById('locationName').value.trim();
    const expiryLocal = document.getElementById('expiryInput').value;
    const temp = document.getElementById('tempSelect').value;
    const size = document.getElementById('sizeSelect').value;
    if (!foodType || !quantity || !locationName || !expiryLocal) { alert('املأ جميع الحقول'); return; }
    if (!selectedCoords) { alert('حدد الموقع على الخريطة'); return; }

    const body = {
      foodType,
      quantity,
      locationName,
      expiryTime: new Date(expiryLocal).toISOString(),
      coords: selectedCoords,
      temp,
      size
    };
    try {
      await api.createAd(body);
      addForm.reset();
      modal.style.display = 'none';
      alert('تم نشر الإعلان بنجاح');
      router();
    } catch (err) { alert(err.message); }
  });
}

function initMap() {
  if (map) return;
  const defaultLat = 36.7538;
  const defaultLng = 3.0588;
  map = L.map('map-container').setView([defaultLat, defaultLng], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);
  map._marker = marker;
  selectedCoords = { lat: defaultLat, lng: defaultLng };
  updateCoordsDisplay(defaultLat, defaultLng);
  marker.on('dragend', (e) => {
    const pos = marker.getLatLng();
    selectedCoords = { lat: pos.lat, lng: pos.lng };
    updateCoordsDisplay(pos.lat, pos.lng);
  });
  map.on('click', (e) => {
    marker.setLatLng(e.latlng);
    selectedCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    updateCoordsDisplay(e.latlng.lat, e.latlng.lng);
  });
}

function updateCoordsDisplay(lat, lng) {
  document.getElementById('coords-display').textContent = `الإحداثيات: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

buildAddForm();

window.showDonorInfo = function(adId) {
  const div = document.getElementById(`donor-${adId}`);
  if (div) div.style.display = div.style.display === 'none' ? 'block' : 'none';
};

window.deleteAd = async function(adId) {
  if (!confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return;
  try {
    await api.deleteAd(adId);
    alert('تم حذف الإعلان');
    router();
  } catch (err) { alert('خطأ: ' + err.message); }
};
