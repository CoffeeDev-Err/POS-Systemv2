async function listCategories(db) {
  const [rows] = await db.query('SELECT id, name FROM categories ORDER BY name');
  return rows;
}

async function findById(db, id) {
  const [rows] = await db.query('SELECT id, name FROM categories WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function findByName(db, name) {
  const [rows] = await db.query('SELECT id, name FROM categories WHERE name = ? LIMIT 1', [name]);
  return rows[0] || null;
}

async function createCategory(db, name) {
  const [result] = await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
  return { id: result.insertId, name };
}

async function deleteCategoryById(db, id) {
  await db.query('DELETE FROM categories WHERE id = ?', [id]);
}

async function countProductsByCategory(db, categoryId) {
  const [rows] = await db.query('SELECT COUNT(*) AS cnt FROM products WHERE category_id = ?', [categoryId]);
  return Number(rows[0]?.cnt || 0);
}

module.exports = {
  listCategories,
  findById,
  findByName,
  createCategory,
  deleteCategoryById,
  countProductsByCategory,
};
