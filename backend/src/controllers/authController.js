const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');
const { formatDate } = require('../utils/format');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '12h';

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    active: Number(row.active) === 1,
    createdAt: formatDate(row.created_at),
  };
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'Server misconfigured: JWT_SECRET missing.' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, username, password, role, active, created_at FROM users WHERE username = ? AND active = 1',
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const passwordOk = await bcrypt.compare(password, rows[0].password);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = mapUser(rows[0]);
    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.json({ user, token });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, username, role, active, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ user: mapUser(rows[0]) });
  } catch (err) {
    return next(err);
  }
}

function logout(req, res) {
  res.json({ message: 'Logged out.' });
}

module.exports = { login, me, logout };
