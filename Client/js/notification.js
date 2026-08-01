const VAPID_PUBLIC_KEY = 'BF7IlardTlVn6X4dNtcTad2ixM09jH87Q-vKyo5ScWY9uzLw3y-goXcgPmC8gxBpFWIGVgFWKxwC2pTDXNYnlD4';

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('المتصفح لا يدعم الإشعارات');
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    // حفظ الاشتراك في الخادم باستخدام api.savePushSubscription
    await api.savePushSubscription(subscription);
    console.log('تم الاشتراك في الإشعارات');
  } catch (err) {
    console.error('فشل الاشتراك في الإشعارات:', err);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}