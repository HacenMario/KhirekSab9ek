const API_BASE = 'https://khireksab9ek-va82.onrender.com/api'; // غيّر عند النشر

function getToken() {
  return localStorage.getItem('faddel_token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('faddel_token');
    localStorage.removeItem('faddel_user');
    window.location.hash = '#/login';
    throw new Error('انتهت الجلسة');
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
  savePushSubscription: (subscription) =>
    request('/auth/push-subscription', { method: 'PUT', body: JSON.stringify({ subscription }) }),
  createAd: (data) => request('/ads', { method: 'POST', body: JSON.stringify(data) }),
  getAvailableAds: () => request('/ads/available'),
  claimAd: (adId) => request(`/ads/${adId}/claim`, { method: 'PUT' }),
  getMyClaims: () => request('/ads/my-claims'),
  getMyDonations: () => request('/ads/my-donations'),
};
