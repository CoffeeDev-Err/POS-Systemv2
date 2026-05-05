const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
      dateStrings: ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME'],
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

async function ping() {
  const p = getPool();
  await p.query('SELECT 1');
}

module.exports = { getPool, ping };
