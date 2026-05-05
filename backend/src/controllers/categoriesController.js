const { getPool } = require('../config/db');
const { logAudit } = require('../utils/audit');

async function listCategories(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT name FROM categories ORDER BY name');
    const categories = rows.map(r => r.name);
    return res.json(categories);
  } catch (err) {
    return next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Category name is required.' });
    }

    const pool = getPool();
    const [exists] = await pool.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [name]);
    if (exists.length) {
      return res.status(200).json({ name });
    }

    await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
    await logAudit(req.user.id, `Added category: ${name}`);
    return res.status(201).json({ name });
  } catch (err) {
    return next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const idOrName = req.params.id;
    const pool = getPool();

    let categoryRow = null;
    if (/^\d+$/.test(idOrName)) {
      const [rows] = await pool.query('SELECT id, name FROM categories WHERE id = ? LIMIT 1', [Number(idOrName)]);
      categoryRow = rows[0];
    } else {
      const [rows] = await pool.query('SELECT id, name FROM categories WHERE name = ? LIMIT 1', [idOrName]);
      categoryRow = rows[0];
    }

    if (!categoryRow) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    const [inUse] = await pool.query('SELECT COUNT(*) AS cnt FROM products WHERE category_id = ?', [categoryRow.id]);
    if (Number(inUse[0].cnt) > 0) {
      return res.status(409).json({ message: 'Cannot delete a category with products.' });
    }

    await pool.query('DELETE FROM categories WHERE id = ?', [categoryRow.id]);
    await logAudit(req.user.id, `Deleted category: ${categoryRow.name}`);
    return res.json({ message: 'Category deleted.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listCategories, createCategory, deleteCategory };
