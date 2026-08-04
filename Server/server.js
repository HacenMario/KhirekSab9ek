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

// ===== أضف هذا المسار للرابط الرئيسي =====
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>خيرك سبقك - الخادم نشط</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 40px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        h1 {
          font-size: 3em;
          margin-bottom: 20px;
        }
        .status {
          font-size: 1.2em;
          background: rgba(0, 255, 0, 0.2);
          padding: 10px 30px;
          border-radius: 50px;
          display: inline-block;
          border: 2px solid #00ff88;
        }
        .time {
          margin-top: 20px;
          opacity: 0.8;
          font-size: 0.9em;
        }
        .emoji {
          font-size: 4em;
          display: block;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <span class="emoji">✅</span>
        <h1>خيرك سبقك</h1>
        <div class="status">🟢 الخادم يعمل بنشاط</div>
        <div class="time">🕐 آخر تحديث: ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</div>
        <div style="margin-top: 20px; font-size: 0.8em; opacity: 0.6;">
          ⚡ نظام منع السكون مفعل | يتم التحديث تلقائيًا
        </div>
      </div>
    </body>
    </html>
  `);
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
