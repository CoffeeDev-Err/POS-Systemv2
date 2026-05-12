async function findByUsername(db, username) {
  const [rows] = await db.query(
    'SELECT id, name, username, password, role, active, created_at FROM users WHERE username = ? AND active = 1',
    [username]
  );
  return rows[0] || null;
}

async function findById(db, id) {
  const [rows] = await db.query(
    'SELECT id, name, username, role, active, created_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

module.exports = { findByUsername, findById };
