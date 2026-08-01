const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const adEvents = require('../utils/events');

// جلب إشعارات المستخدم
router.get('/', auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحديد الكل كمقروء
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ message: 'تم تحديد الكل كمقروء' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// مسح الكل
router.delete('/', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    res.json({ message: 'تم مسح جميع الإشعارات' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE للإشعارات (خاص بالمستخدم)
router.get('/events', auth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const listener = (notif) => {
    if (notif.userId.toString() === req.user._id.toString()) {
      res.write(`event: notification\ndata: ${JSON.stringify(notif)}\n\n`);
    }
  };

  adEvents.on('notification', listener);
  req.on('close', () => adEvents.off('notification', listener));
});

module.exports = router;