const { getPool } = require('../config/db');
const { formatTimestamp } = require('../utils/format');

async function listAuditLogs(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT a.id, a.action, a.created_at, u.name AS user_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC`
    );

    const logs = rows.map(row => ({
      id: row.id,
      user: row.user_name || 'System',
      action: row.action,
      timestamp: formatTimestamp(row.created_at),
    }));

    return res.json(logs);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listAuditLogs };
