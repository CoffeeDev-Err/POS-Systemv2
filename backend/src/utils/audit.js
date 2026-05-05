const { getPool } = require('../config/db');

async function logAudit(userId, action) {
  try {
    const pool = getPool();
    await pool.query('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)', [userId || null, action]);
  } catch (err) {
    console.error('[audit] failed:', err.message);
  }
}

module.exports = { logAudit };
