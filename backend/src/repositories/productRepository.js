async function listProducts(db) {
  const [rows] = await db.query(
    `SELECT p.id, p.name, c.name AS category, p.price, p.cost, p.unit, p.stock,
            p.low_stock_alert AS lowStockAlert, p.active
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ORDER BY p.id`
  );
  return rows;
}

async function findById(db, id) {
  const [rows] = await db.query(
    `SELECT p.id, p.name, c.name AS category, p.price, p.cost, p.unit, p.stock,
            p.low_stock_alert AS lowStockAlert, p.active
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function createProduct(db, payload) {
  const [result] = await db.query(
    `INSERT INTO products (name, category_id, price, cost, unit, stock, low_stock_alert, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
    [
      payload.name,
      payload.categoryId,
      payload.price,
      payload.cost,
      payload.unit,
      payload.stock,
      payload.lowStockAlert,
      payload.active,
    ]
  );
  return result.insertId;
}

async function updateProduct(db, id, payload) {
  const [result] = await db.query(
    `UPDATE products
     SET name = ?, category_id = ?, price = ?, cost = ?, unit = ?, stock = ?, low_stock_alert = ?, active = ?
     WHERE id = ?`,
    [
      payload.name,
      payload.categoryId,
      payload.price,
      payload.cost,
      payload.unit,
      payload.stock,
      payload.lowStockAlert,
      payload.active,
      id,
    ]
  );
  return result.affectedRows;
}

async function deleteProduct(db, id) {
  await db.query('DELETE FROM products WHERE id = ?', [id]);
}

async function deleteProductsByIds(db, ids) {
  if (!ids.length) return;
  await db.query('DELETE FROM products WHERE id IN (?)', [ids]);
}

async function findByCategoryId(db, categoryId) {
  const [rows] = await db.query('SELECT id FROM products WHERE category_id = ?', [categoryId]);
  return rows;
}

async function listByIdsOrNames(db, ids, names) {
  const whereParts = [];
  const params = [];
  if (ids.length) {
    whereParts.push(`id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  if (names.length) {
    whereParts.push(`name IN (${names.map(() => '?').join(',')})`);
    params.push(...names);
  }
  const [rows] = await db.query(
    `SELECT id, name, price, cost, stock FROM products WHERE ${whereParts.join(' OR ')}`,
    params
  );
  return rows;
}

async function updateStock(db, productId, qtyDelta) {
  await db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [qtyDelta, productId]);
}

module.exports = {
  listProducts,
  findById,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductsByIds,
  findByCategoryId,
  listByIdsOrNames,
  updateStock,
};
