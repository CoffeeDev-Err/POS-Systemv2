const { getPool } = require('../config/db');

async function logAudit(userId, action) {
  try {
    const pool = getPool();
    await pool.query('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)', [userId || null, action]);
  } catch {
    // audit failures should not block primary operations
  }
}

module.exports = { logAudit };
