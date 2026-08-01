const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // جلب الرمز من الترويسة أو من معامل الرابط (لحالات SSE)
    let token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token && req.query.token) {
      token = req.query.token;
    }
    if (!token) throw new Error('لم يتم توفير رمز');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) throw new Error('المستخدم غير موجود');

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول' });
  }
};