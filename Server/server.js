const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const https = require('https');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB متصل'))
  .catch(err => console.error('❌ فشل الاتصال:', err));

// المسارات
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));

// نقطة نهاية للفحص الصحي (Health Check)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===================== آلية منع السكون =====================
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `https://khireksab9ek.onrender.com`; // 

function keepAlive() {
  // نستخدم URL نقطة الفحص الصحي لأنها خفيفة ولا تستهلك موارد
  const url = `${APP_URL}/health`;
  
  https.get(url, (res) => {
    console.log(`🔄 تم إرسال طلب منع السكون. رمز الحالة: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('❌ فشل طلب منع السكون:', err.message);
  });
}

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  
  // بدء دورة منع السكون (كل 08 دقيقة
  setInterval(keepAlive, 8 * 60 * 1000);
  
  // إرسال أول طلب بعد 30 ثانية من التشغيل
  setTimeout(keepAlive, 30000);
});
