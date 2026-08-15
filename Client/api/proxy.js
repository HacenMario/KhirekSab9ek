// هذا الملف يعمل كوكيل لجميع طلبات /api/* ويعيد توجيهها إلى Render
export default async function handler(req, res) {
  const targetUrl = `https://khireksab9ek-j684.onrender.com${req.url.replace('/api', '/api')}`;
  
  const headers = {};
  // نسخ الرؤوس المهمة
  if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.text();
    res.status(response.status).setHeader('Content-Type', 'application/json').send(data);
  } catch (error) {
    res.status(500).json({ error: 'فشل الاتصال بالخادم' });
  }
}
