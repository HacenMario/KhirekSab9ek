const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ad = require('../models/Ad');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// تسجيل حساب جديد
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, vehicle } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      role: 'both',
      vehicle: vehicle || 'car'
    });
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        vehicle: user.vehicle
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        vehicle: user.vehicle
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// تحديث الملف الشخصي
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, password, vehicle } = req.body;
    const user = req.user;
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (password) user.password = await bcrypt.hash(password, 10);
    if (vehicle) user.vehicle = vehicle;
    await user.save();
    res.json({
      message: 'تم تحديث الملف الشخصي',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        vehicle: user.vehicle
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// حذف الحساب
router.delete('/account', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    // حذف جميع إعلاناته
    await Ad.deleteMany({ donorId: userId });
    // حذف الرسائل التي أرسلها أو استقبلها
    await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });
    // حذف الإشعارات
    await Notification.deleteMany({ userId });
    // حذف المستخدم نفسه
    await User.findByIdAndDelete(userId);
    res.json({ message: 'تم حذف الحساب وجميع بياناته بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حفظ اشتراك الإشعارات
router.put('/push-subscription', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    req.user.pushSubscription = subscription;
    await req.user.save();
    res.json({ message: 'تم حفظ اشتراك الإشعارات' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;