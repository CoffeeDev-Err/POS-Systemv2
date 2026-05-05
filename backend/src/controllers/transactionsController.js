const { getPool } = require('../config/db');
const { logAudit } = require('../utils/audit');
const { formatDate, formatTime } = require('../utils/format');

function mapTransactionRow(row, items) {
  return {
    id: row.id,
    date: formatDate(row.date),
    time: formatTime(row.time),
    cashierId: row.cashier_id,
    cashierName: row.cashier_name || 'Unknown',
    items,
    subtotal: Number(row.subtotal),
    cash: Number(row.cash),
    change: Number(row.change_amount),
  };
}

async function listTransactions(req, res, next) {
  try {
    const pool = getPool();
    const [txRows] = await pool.query(
      `SELECT t.id, t.date, t.time, t.cashier_id, t.subtotal, t.cash, t.change_amount,
              u.name AS cashier_name
       FROM transactions t
       LEFT JOIN users u ON u.id = t.cashier_id
       ORDER BY t.date, t.time, t.id`
    );

    const [itemRows] = await pool.query(
      `SELECT transaction_id, product_id, product_name, qty, price, cost, total, cost_total
       FROM transaction_items
       ORDER BY id`
    );

    const itemMap = new Map();
    itemRows.forEach(row => {
      const entry = itemMap.get(row.transaction_id) || [];
      entry.push({
        productId: row.product_id,
        name: row.product_name,
        qty: Number(row.qty),
        price: Number(row.price),
        cost: Number(row.cost),
        total: Number(row.total),
        costTotal: Number(row.cost_total),
      });
      itemMap.set(row.transaction_id, entry);
    });

    const result = txRows.map(row => mapTransactionRow(row, itemMap.get(row.id) || []));
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getTransaction(req, res, next) {
  try {
    const id = req.params.id;
    const pool = getPool();

    const [txRows] = await pool.query(
      `SELECT t.id, t.date, t.time, t.cashier_id, t.subtotal, t.cash, t.change_amount,
              u.name AS cashier_name
       FROM transactions t
       LEFT JOIN users u ON u.id = t.cashier_id
       WHERE t.id = ?
       LIMIT 1`,
      [id]
    );

    if (!txRows.length) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    const [itemRows] = await pool.query(
      `SELECT transaction_id, product_id, product_name, qty, price, cost, total, cost_total
       FROM transaction_items
       WHERE transaction_id = ?
       ORDER BY id`,
      [id]
    );

    const items = itemRows.map(row => ({
      productId: row.product_id,
      name: row.product_name,
      qty: Number(row.qty),
      price: Number(row.price),
      cost: Number(row.cost),
      total: Number(row.total),
      costTotal: Number(row.cost_total),
    }));

    return res.json(mapTransactionRow(txRows[0], items));
  } catch (err) {
    return next(err);
  }
}

async function createTransaction(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const { id, items, cash, change } = req.body;
    const cashierId = req.body.cashierId || req.user.id;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items are required.' });
    }

    const invalidItem = items.find(item => !item.name || Number(item.qty || 0) <= 0);
    if (invalidItem) {
      return res.status(400).json({ message: 'Each item must have a name and quantity.' });
    }

    const now = new Date();
    const date = formatDate(now);
    const time = formatTime(now);

    await conn.beginTransaction();

    let txnId = id;
    if (!txnId) {
      const dateKey = date.replace(/-/g, '');
      const [countRows] = await conn.query('SELECT COUNT(*) AS cnt FROM transactions WHERE date = ?', [date]);
      const nextNum = Number(countRows[0].cnt) + 1;
      txnId = `TXN-${dateKey}-${String(nextNum).padStart(4, '0')}`;
    }

    const normalizedItems = items.map(item => {
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const total = Number(item.total || qty * price);
      return {
        productId: item.productId || null,
        name: item.name,
        qty,
        price,
        total,
        cost: 0,
        costTotal: 0,
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);
    const cashValue = Number(cash || 0);
    const changeValue = Number(change !== undefined ? change : cashValue - subtotal);

    if (cashValue < subtotal) {
      await conn.rollback();
      return res.status(400).json({ message: 'Cash amount is less than subtotal.' });
    }

    await conn.query(
      `INSERT INTO transactions (id, date, time, cashier_id, subtotal, cash, change_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [txnId, date, time, cashierId, subtotal, cashValue, changeValue]
    );

    const updatedProductIds = new Set();

    for (const item of normalizedItems) {
      let productId = item.productId;
      let itemCost = 0;

      if (!productId && item.name) {
        const [pRows] = await conn.query('SELECT id, stock, cost FROM products WHERE name = ? LIMIT 1', [item.name]);
        if (pRows.length) {
          productId = pRows[0].id;
          const currentStock = Number(pRows[0].stock);
          if (currentStock < item.qty) {
            throw new Error(`Insufficient stock for ${item.name}.`);
          }
          itemCost = Number(pRows[0].cost || 0);
          await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, productId]);
          updatedProductIds.add(productId);
        }
      } else if (productId) {
        const [pRows] = await conn.query('SELECT stock, cost FROM products WHERE id = ? LIMIT 1', [productId]);
        if (pRows.length) {
          const currentStock = Number(pRows[0].stock);
          if (currentStock < item.qty) {
            throw new Error(`Insufficient stock for ${item.name}.`);
          }
          itemCost = Number(pRows[0].cost || 0);
          await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, productId]);
          updatedProductIds.add(productId);
        }
      }

      item.cost = itemCost;
      item.costTotal = Number((itemCost * item.qty).toFixed(2));

      await conn.query(
        `INSERT INTO transaction_items (transaction_id, product_id, product_name, qty, price, cost, total, cost_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [txnId, productId || null, item.name, item.qty, item.price, item.cost, item.total, item.costTotal]
      );

      if (productId) {
        await conn.query(
          `INSERT INTO stock_movements (product_id, type, qty, note, movement_date, movement_time, created_by)
           VALUES (?, 'sale', ?, ?, ?, ?, ?)`,
          [productId, item.qty, `Sale ${txnId}`, date, time, cashierId]
        );
      }
    }

    let updatedProducts = [];
    if (updatedProductIds.size > 0) {
      const ids = Array.from(updatedProductIds);
      const [rows] = await conn.query(
        `SELECT p.id, p.name, c.name AS category, p.price, p.cost, p.unit, p.stock,
                p.low_stock_alert AS lowStockAlert, p.active
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      updatedProducts = rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        price: Number(row.price),
        cost: Number(row.cost),
        unit: row.unit,
        stock: Number(row.stock),
        lowStockAlert: Number(row.lowStockAlert),
        active: Number(row.active) === 1,
      }));
    }

    await conn.commit();
    await logAudit(req.user.id, `Transaction ${txnId} completed`);

    let cashierName = req.user && req.user.id === cashierId ? req.user.name : null;
    if (!cashierName) {
      const [uRows] = await pool.query('SELECT name FROM users WHERE id = ? LIMIT 1', [cashierId]);
      cashierName = uRows.length ? uRows[0].name : 'Unknown';
    }
    const transaction = {
      id: txnId,
      date,
      time,
      cashierId,
      cashierName,
      items: normalizedItems,
      subtotal,
      cash: cashValue,
      change: changeValue,
    };

    return res.status(201).json({ transaction, updatedProducts });
  } catch (err) {
    await conn.rollback();
    return next(err);
  } finally {
    conn.release();
  }
}

module.exports = { listTransactions, getTransaction, createTransaction };
