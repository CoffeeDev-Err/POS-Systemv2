const { getPool } = require('../config/db');
const { logAudit } = require('../utils/audit');

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    cost: Number(row.cost),
    unit: row.unit,
    stock: Number(row.stock),
    lowStockAlert: Number(row.lowStockAlert),
    active: Number(row.active) === 1,
  };
}

async function ensureCategoryId(pool, name) {
  const [rows] = await pool.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [name]);
  if (rows.length) return rows[0].id;
  const [result] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
  return result.insertId;
}

async function listProducts(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT p.id, p.name, c.name AS category, p.price, p.cost, p.unit, p.stock,
              p.low_stock_alert AS lowStockAlert, p.active
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.id`
    );
    return res.json(rows.map(mapProduct));
  } catch (err) {
    return next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const { name, category, price, cost, unit, stock, lowStockAlert, active } = req.body;
    const categoryName = String(category || '').trim();

    if (!name || !categoryName || !unit) {
      return res.status(400).json({ message: 'Name, category, and unit are required.' });
    }

    const pool = getPool();
    const categoryId = await ensureCategoryId(pool, categoryName);

    const [result] = await pool.query(
      `INSERT INTO products (name, category_id, price, cost, unit, stock, low_stock_alert, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [
        name,
        categoryId,
        Number(price || 0),
        Number(cost || 0),
        unit,
        Number(stock || 0),
        Number(lowStockAlert || 0),
        active === false ? 0 : 1,
      ]
    );

    const [rows] = await pool.query(
      `SELECT p.id, p.name, c.name AS category, p.price, p.cost, p.unit, p.stock,
              p.low_stock_alert AS lowStockAlert, p.active
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [result.insertId]
    );

    await logAudit(req.user.id, `Added product: ${name}`);
    return res.status(201).json(mapProduct(rows[0]));
  } catch (err) {
    return next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid product id.' });
    }

    const { name, category, price, cost, unit, stock, lowStockAlert, active } = req.body;
    const categoryName = String(category || '').trim();
    if (!name || !categoryName || !unit) {
      return res.status(400).json({ message: 'Name, category, and unit are required.' });
    }

    const pool = getPool();
    const categoryId = await ensureCategoryId(pool, categoryName);

    const [result] = await pool.query(
      `UPDATE products
       SET name = ?, category_id = ?, price = ?, cost = ?, unit = ?, stock = ?, low_stock_alert = ?, active = ?
       WHERE id = ?`,
      [
        name,
        categoryId,
        Number(price || 0),
        Number(cost || 0),
        unit,
        Number(stock || 0),
        Number(lowStockAlert || 0),
        active === false ? 0 : 1,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const [rows] = await pool.query(
      `SELECT p.id, p.name, c.name AS category, p.price, p.cost, p.unit, p.stock,
              p.low_stock_alert AS lowStockAlert, p.active
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [id]
    );

    await logAudit(req.user.id, `Updated product: ${name}`);
    return res.json(mapProduct(rows[0]));
  } catch (err) {
    return next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid product id.' });
    }

    const pool = getPool();
    const [rows] = await pool.query('SELECT name FROM products WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    await logAudit(req.user.id, `Deleted product: ${rows[0].name}`);
    return res.json({ message: 'Product deleted.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };
