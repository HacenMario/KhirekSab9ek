const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Ad = require('../models/Ad');
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adEvents = require('../utils/events');
const { sendPushNotification } = require('../utils/webpush');

router.post('/', auth, async (req, res) => {
  try {
    const { adId, text, receiverId } = req.body;
    if (!adId || !text || !receiverId) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    const ad = await Ad.findById(adId);
    if (!ad) return res.status(404).json({ error: 'الإعلان غير موجود' });
    const userId = req.user._id.toString();
    if (ad.donorId.toString() !== userId && ad.recipientId?.toString() !== userId)
      return res.status(403).json({ error: 'غير مصرح' });

    const message = new Message({ adId, senderId: req.user._id, receiverId, text });
    await message.save();

    const notif = await Notification.create({
      userId: receiverId,
      type: 'new_message',
      message: `رسالة جديدة من ${req.user.name} بخصوص "${ad.foodType}"`,
      data: { adId, senderId: req.user._id }
    });
    adEvents.emit('notification', notif);
    adEvents.emit('new-message', { message, receiverId });

const receiver = await User.findById(receiverId);
if (receiver?.pushSubscription) {
  sendPushNotification(
    receiver.pushSubscription,
    '💬 رسالة جديدة',
    `${req.user.name}: ${text.substring(0, 50)}`,
    { adId } // إرسال adId كبيانات إضافية
  );
}
    res.status(201).json(message);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:adId', auth, async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.adId);
    if (!ad) return res.status(404).json({ error: 'الإعلان غير موجود' });
    const userId = req.user._id.toString();
    if (ad.donorId.toString() !== userId && ad.recipientId?.toString() !== userId)
      return res.status(403).json({ error: 'غير مصرح' });
    const messages = await Message.find({ adId: req.params.adId }).sort({ createdAt: 1 }).populate('senderId', 'name');
    res.json(messages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SSE للمحادثة (خاص بمستخدم)
router.get('/events/:userId', auth, (req, res) => {
  if (req.user._id.toString() !== req.params.userId) return res.status(403).json({ error: 'غير مصرح' });
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  const listener = ({ message, receiverId }) => {
    if (receiverId === req.params.userId) res.write(`event: new-message\ndata: ${JSON.stringify(message)}\n\n`);
  };
  adEvents.on('new-message', listener);
  req.on('close', () => adEvents.off('new-message', listener));
});

module.exports = router;