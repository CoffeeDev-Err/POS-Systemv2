const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing auth token.' });
  }

  const token = header.slice(7);

  if (!JWT_SECRET) {
    return res.status(500).json({ message: 'Server misconfigured: JWT_SECRET missing.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.sub || payload.id;

    if (!userId) {
      return res.status(401).json({ message: 'Invalid auth token.' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, username, role, active, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!rows.length || Number(rows[0].active) !== 1) {
      return res.status(401).json({ message: 'User not active.' });
    }

    req.user = {
      id: rows[0].id,
      name: rows[0].name,
      username: rows[0].username,
      role: rows[0].role,
      active: Number(rows[0].active) === 1,
      createdAt: rows[0].created_at,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid auth token.' });
  }
}

module.exports = { requireAuth };
