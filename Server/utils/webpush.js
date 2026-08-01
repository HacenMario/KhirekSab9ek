const webpush = require('web-push');
const User = require('../models/User');

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

webpush.setVapidDetails(
  'mailto:stevenhacen@gmail.com', // يمكن تغييره
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

/**
 * إرسال إشعار لمستخدم واحد
 * @param {Object} subscription - كائن الاشتراك
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 */
async function sendPushNotification(subscription, title, body, data = {}) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, data }));
  } catch (err) {
    console.error('فشل إرسال الإشعار:', err);
  }
}

/**
 * إرسال إشعار لجميع المستخدمين الذين لديهم اشتراك Push
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 */
async function sendPushToAll(title, body) {
  try {
    const users = await User.find({ pushSubscription: { $ne: null } });
    const promises = users.map(user =>
      sendPushNotification(user.pushSubscription, title, body).catch(() => {})
    );
    await Promise.allSettled(promises);
  } catch (err) {
    console.error('خطأ في الإرسال الجماعي:', err);
  }
}

module.exports = { sendPushNotification, sendPushToAll };