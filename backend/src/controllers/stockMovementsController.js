const { getPool } = require('../config/db');
const { logAudit } = require('../utils/audit');
const { formatDate, formatTime } = require('../utils/format');

function mapMovement(row) {
  return {
    id: row.id,
    productId: row.product_id,
    product: row.product_name,
    type: row.type,
    qty: Number(row.qty),
    note: row.note,
    date: formatDate(row.movement_date),
    time: formatTime(row.movement_time),
    createdBy: row.created_by,
    createdByName: row.user_name || 'System',
  };
}

async function listStockMovements(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT sm.id, sm.product_id, p.name AS product_name, sm.type, sm.qty, sm.note,
              sm.movement_date, sm.movement_time, sm.created_by, u.name AS user_name
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       LEFT JOIN users u ON u.id = sm.created_by
       ORDER BY sm.movement_date, sm.movement_time, sm.id`
    );

    return res.json(rows.map(mapMovement));
  } catch (err) {
    return next(err);
  }
}

async function createStockMovement(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const { productId, qty, type, note } = req.body;
    const movementType = type || 'stock-in';
    const allowedTypes = ['stock-in', 'stock-out', 'sale', 'adjustment'];
    if (!allowedTypes.includes(movementType)) {
      return res.status(400).json({ message: 'Invalid stock movement type.' });
    }
    const qtyValue = Number(qty || 0);

    if (!productId || !qtyValue || qtyValue <= 0) {
      return res.status(400).json({ message: 'Product and quantity are required.' });
    }

    const now = new Date();
    const date = formatDate(now);
    const time = formatTime(now);

    await conn.beginTransaction();

    const [pRows] = await conn.query('SELECT stock, name FROM products WHERE id = ? LIMIT 1', [productId]);
    if (!pRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Product not found.' });
    }

    const currentStock = Number(pRows[0].stock);
    let nextStock = currentStock;

    if (movementType === 'stock-in' || movementType === 'adjustment') {
      nextStock = currentStock + qtyValue;
    } else {
      nextStock = currentStock - qtyValue;
    }

    if (nextStock < 0) {
      throw new Error('Insufficient stock for this movement.');
    }

    await conn.query('UPDATE products SET stock = ? WHERE id = ?', [nextStock, productId]);

    const [result] = await conn.query(
      `INSERT INTO stock_movements (product_id, type, qty, note, movement_date, movement_time, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [productId, movementType, qtyValue, note || null, date, time, req.user.id]
    );

    await conn.commit();
    await logAudit(req.user.id, `Stock movement (${movementType}) for ${pRows[0].name} qty ${qtyValue}`);

    const [movementRows] = await conn.query(
      `SELECT sm.id, sm.product_id, p.name AS product_name, sm.type, sm.qty, sm.note,
              sm.movement_date, sm.movement_time, sm.created_by, u.name AS user_name
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       LEFT JOIN users u ON u.id = sm.created_by
       WHERE sm.id = ?`,
      [result.insertId]
    );

    const movement = mapMovement(movementRows[0]);

    const [productRows] = await conn.query(
      `SELECT p.id, p.name, c.name AS category, p.price, p.unit, p.stock,
              p.low_stock_alert AS lowStockAlert, p.active
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [productId]
    );

    const product = {
      id: productRows[0].id,
      name: productRows[0].name,
      category: productRows[0].category,
      price: Number(productRows[0].price),
      unit: productRows[0].unit,
      stock: Number(productRows[0].stock),
      lowStockAlert: Number(productRows[0].lowStockAlert),
      active: Number(productRows[0].active) === 1,
    };

    return res.status(201).json({ movement, product });
  } catch (err) {
    await conn.rollback();
    return next(err);
  } finally {
    conn.release();
  }
}

module.exports = { listStockMovements, createStockMovement };
