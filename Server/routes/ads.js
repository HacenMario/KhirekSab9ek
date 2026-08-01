const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const adEvents = require('../utils/events');
const { sendPushToAll } = require('../utils/webpush');

// إنشاء إعلان جديد
router.post('/', auth, async (req, res) => {
  try {
    const { foodType, quantity, locationName, expiryTime, coords, temp, size } = req.body;
    if (!foodType || !quantity || !locationName || !expiryTime) {
      return res.status(400).json({ error: 'جميع الحقول الأساسية مطلوبة' });
    }

    const ad = new Ad({
      foodType,
      quantity,
      locationName,
      expiryTime,
      temp: temp || 'hot',
      size: size || 'bike',
      coords: coords || { lat: 24.7136, lng: 46.6753 },
      donorId: req.user._id,
      donorName: req.user.name,
      donorPhone: req.user.phone || ''
    });
    await ad.save();

    // بث الإعلان عبر SSE
    adEvents.emit('new-ad', ad.toObject());

    // إرسال إشعارات push للجميع
    sendPushToAll(
      '🍲 إعلان طعام جديد!',
      `${ad.foodType} (${ad.quantity} وجبة) متاح في ${ad.locationName}`
    ).catch(err => console.error('خطأ في إرسال الإشعارات الجماعية:', err));

    res.status(201).json(ad);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// الإعلانات المتاحة (لا تظهر إعلاناته، وتُصفى حسب المركبة)
router.get('/available', auth, async (req, res) => {
  try {
    const now = new Date();
    await Ad.updateMany(
      { status: 'available', expiryTime: { $lte: now } },
      { $set: { status: 'expired' } }
    );

    let filter = {
      status: 'available',
      expiryTime: { $gt: now },
      donorId: { $ne: req.user._id }
    };

    if (req.user.vehicle === 'bike') {
      filter.size = 'bike';
    }

    const ads = await Ad.find(filter).sort({ expiryTime: 1 }).limit(20);
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حجز إعلان
router.put('/:id/claim', auth, async (req, res) => {
  try {
    const now = new Date();
    const updatedAd = await Ad.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'available',
        expiryTime: { $gt: now }
      },
      {
        $set: {
          status: 'claimed',
          recipientId: req.user._id,
          claimedAt: new Date()
        }
      },
      { new: true }
    ).populate('donorId', 'pushSubscription name');

    if (!updatedAd) {
      return res.status(409).json({ error: 'هذا الإعلان لم يعد متاحاً' });
    }

    // إشعار للمتبرع
    await Notification.create({
      userId: updatedAd.donorId._id,
      type: 'ad_claimed',
      message: `تم حجز إعلانك "${updatedAd.foodType}" من قبل ${req.user.name}`,
      data: { adId: updatedAd._id }
    });

    adEvents.emit('ad-claimed', updatedAd.toObject(), updatedAd.donorId._id.toString());
    res.json(updatedAd);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// محجوزاتي
router.get('/my-claims', auth, async (req, res) => {
  try {
    const ads = await Ad.find({ recipientId: req.user._id }).sort({ claimedAt: -1 });
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تبرعاتي
router.get('/my-donations', auth, async (req, res) => {
  try {
    const now = new Date();
    await Ad.updateMany(
      { donorId: req.user._id, status: 'available', expiryTime: { $lte: now } },
      { $set: { status: 'expired' } }
    );
    const ads = await Ad.find({ donorId: req.user._id }).sort({ createdAt: -1 });
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف إعلان واحد
router.delete('/:id', auth, async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'الإعلان غير موجود' });
    if (ad.donorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'لا يمكنك حذف إعلان غير خاص بك' });
    }
    await Ad.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف الإعلان بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف جميع المحجوزات القديمة
router.delete('/my-claims/all', auth, async (req, res) => {
  try {
    const now = new Date();
    // حذف المحجوزات التي انتهت صلاحيتها أو مضى على حجزها أكثر من 24 ساعة
    const result = await Ad.deleteMany({
      recipientId: req.user._id,
      status: 'claimed',
      $or: [
        { expiryTime: { $lte: now } },
        { claimedAt: { $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }
      ]
    });
    res.json({ message: `تم حذف ${result.deletedCount} إعلاناً محجوزاً قديماً.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف جميع التبرعات القديمة
router.delete('/my-donations/all', auth, async (req, res) => {
  try {
    const now = new Date();
    // حذف التبرعات المنتهية الصلاحية أو التي تم حجزها منذ أكثر من 24 ساعة
    const result = await Ad.deleteMany({
      donorId: req.user._id,
      status: { $in: ['expired', 'claimed'] },
      $or: [
        { expiryTime: { $lte: now } },
        { claimedAt: { $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }
      ]
    });
    res.json({ message: `تم حذف ${result.deletedCount} إعلاناً متبرعاً به قديماً.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE: الأحداث العامة (إعلانات جديدة)
router.get('/events', auth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const listener = (ad) => {
    res.write(`event: new-ad\ndata: ${JSON.stringify(ad)}\n\n`);
  };
  adEvents.on('new-ad', listener);
  req.on('close', () => adEvents.off('new-ad', listener));
});

// SSE: أحداث خاصة بالمستخدم (حجز + رسائل)
router.get('/events/:userId', auth, (req, res) => {
  if (req.user._id.toString() !== req.params.userId) {
    return res.status(403).json({ error: 'غير مصرح' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const claimedListener = (ad, donorId) => {
    if (donorId === req.params.userId) {
      res.write(`event: ad-claimed\ndata: ${JSON.stringify(ad)}\n\n`);
    }
  };

  const msgListener = ({ message, receiverId }) => {
    if (receiverId === req.params.userId) {
      res.write(`event: new-message\ndata: ${JSON.stringify(message)}\n\n`);
    }
  };

  adEvents.on('ad-claimed', claimedListener);
  adEvents.on('new-message', msgListener);

  req.on('close', () => {
    adEvents.off('ad-claimed', claimedListener);
    adEvents.off('new-message', msgListener);
  });
});

module.exports = router;