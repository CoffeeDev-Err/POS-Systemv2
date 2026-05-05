const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');
const { logAudit } = require('../utils/audit');
const { formatDate } = require('../utils/format');

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

async function listUsers(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, username, role, active, created_at FROM users ORDER BY id'
    );
    return res.json(rows.map(mapUser));
  } catch (err) {
    return next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { name, username, password, role, active } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ message: 'Name, username, and password are required.' });
    }

    const allowedRoles = ['superadmin', 'admin', 'cashier'];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role.' });
    }

    const pool = getPool();
    const [exists] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (exists.length) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (name, username, password, role, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [
        name,
        username,
        passwordHash,
        role || 'cashier',
        active === false ? 0 : 1,
        formatDate(new Date()),
      ]
    );

    const [rows] = await pool.query(
      'SELECT id, name, username, role, active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    await logAudit(req.user.id, `Added user: ${name}`);
    return res.status(201).json(mapUser(rows[0]));
  } catch (err) {
    return next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }

    const { name, username, password, role, active } = req.body;
    if (!name || !username || !role) {
      return res.status(400).json({ message: 'Name, username, and role are required.' });
    }

    const allowedRoles = ['superadmin', 'admin', 'cashier'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role.' });
    }

    const pool = getPool();
    const [exists] = await pool.query(
      'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
      [username, id]
    );
    if (exists.length) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET name = ?, username = ?, password = ?, role = ?, active = ? WHERE id = ?`,
        [name, username, passwordHash, role, active === false ? 0 : 1, id]
      );
    } else {
      await pool.query(
        `UPDATE users SET name = ?, username = ?, role = ?, active = ? WHERE id = ?`,
        [name, username, role, active === false ? 0 : 1, id]
      );
    }

    const [rows] = await pool.query(
      'SELECT id, name, username, role, active, created_at FROM users WHERE id = ?',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await logAudit(req.user.id, `Updated user: ${rows[0].name}`);
    return res.json(mapUser(rows[0]));
  } catch (err) {
    return next(err);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }

    const pool = getPool();
    let nextActive;

    if (typeof req.body.active === 'boolean') {
      nextActive = req.body.active ? 1 : 0;
    } else {
      const [rows] = await pool.query('SELECT active FROM users WHERE id = ? LIMIT 1', [id]);
      if (!rows.length) {
        return res.status(404).json({ message: 'User not found.' });
      }
      nextActive = Number(rows[0].active) === 1 ? 0 : 1;
    }

    await pool.query('UPDATE users SET active = ? WHERE id = ?', [nextActive, id]);

    const [rows] = await pool.query(
      'SELECT id, name, username, role, active, created_at FROM users WHERE id = ?',
      [id]
    );

    await logAudit(req.user.id, `${rows[0].name} set to ${nextActive === 1 ? 'active' : 'inactive'}`);
    return res.json(mapUser(rows[0]));
  } catch (err) {
    return next(err);
  }
}

module.exports = { listUsers, createUser, updateUser, updateUserStatus };
