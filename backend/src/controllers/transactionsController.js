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

function generateTxnId(now) {
  const dateKey = formatDate(now).replace(/-/g, '');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `TXN-${dateKey}-${hh}${mm}${ss}-${rand}`;
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
    const { id, items, cash } = req.body;
    const cashierId = req.body.cashierId || req.user.id;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items are required.' });
    }

    const invalidItem = items.find(item => Number(item.qty || 0) <= 0 || (!item.productId && !item.name));
    if (invalidItem) {
      return res.status(400).json({ message: 'Each item must have a product and quantity.' });
    }

    const now = new Date();
    const date = formatDate(now);
    const time = formatTime(now);

    await conn.beginTransaction();

    const requestedItems = items.map(item => ({
      productId: item.productId ? Number(item.productId) : null,
      name: String(item.name || '').trim(),
      qty: Number(item.qty || 0),
    }));

    const idList = Array.from(new Set(requestedItems.filter(i => i.productId).map(i => i.productId)));
    const nameList = Array.from(new Set(requestedItems.filter(i => !i.productId && i.name).map(i => i.name)));
    if (!idList.length && !nameList.length) {
      return res.status(400).json({ message: 'No valid products in transaction.' });
    }

    const whereParts = [];
    const params = [];
    if (idList.length) {
      whereParts.push(`id IN (${idList.map(() => '?').join(',')})`);
      params.push(...idList);
    }
    if (nameList.length) {
      whereParts.push(`name IN (${nameList.map(() => '?').join(',')})`);
      params.push(...nameList);
    }

    const [productRows] = await conn.query(
      `SELECT id, name, price, cost, stock FROM products WHERE ${whereParts.join(' OR ')}`,
      params
    );

    const productById = new Map(productRows.map(p => [p.id, p]));
    const productByName = new Map(productRows.map(p => [p.name, p]));

    const requiredQty = new Map();
    const normalizedItems = requestedItems.map(item => {
      const product = item.productId
        ? productById.get(item.productId)
        : productByName.get(item.name);

      if (!product) {
        const err = new Error(`Product not found: ${item.name || item.productId}`);
        err.status = 400;
        throw err;
      }

      const prevQty = requiredQty.get(product.id) || 0;
      requiredQty.set(product.id, prevQty + item.qty);

      const price = Number(product.price || 0);
      const cost = Number(product.cost || 0);
      const total = Number((price * item.qty).toFixed(2));
      const costTotal = Number((cost * item.qty).toFixed(2));

      return {
        productId: product.id,
        name: product.name,
        qty: item.qty,
        price,
        total,
        cost,
        costTotal,
      };
    });

    for (const [productId, qty] of requiredQty.entries()) {
      const product = productById.get(productId);
      if (Number(product.stock) < qty) {
        const err = new Error(`Insufficient stock for ${product.name}.`);
        err.status = 400;
        throw err;
      }
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);
    const cashValue = Number(cash || 0);
    const changeValue = cashValue - subtotal;

    if (cashValue < subtotal) {
      await conn.rollback();
      return res.status(400).json({ message: 'Cash amount is less than subtotal.' });
    }

    let txnId = id;
    let inserted = false;
    let attempts = 0;

    while (!inserted && attempts < 5) {
      attempts += 1;
      if (!txnId) txnId = generateTxnId(now);
      try {
        await conn.query(
          `INSERT INTO transactions (id, date, time, cashier_id, subtotal, cash, change_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [txnId, date, time, cashierId, subtotal, cashValue, changeValue]
        );
        inserted = true;
      } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY' && !id) {
          txnId = null;
          continue;
        }
        throw err;
      }
    }

    if (!inserted) {
      throw new Error('Failed to generate transaction id.');
    }

    const updatedProductIds = new Set();

    for (const item of normalizedItems) {
      const productId = item.productId;
      await conn.query(
        `INSERT INTO transaction_items (transaction_id, product_id, product_name, qty, price, cost, total, cost_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [txnId, productId, item.name, item.qty, item.price, item.cost, item.total, item.costTotal]
      );

      if (productId) {
        await conn.query(
          `INSERT INTO stock_movements (product_id, type, qty, note, movement_date, movement_time, created_by)
           VALUES (?, 'sale', ?, ?, ?, ?, ?)`,
          [productId, item.qty, `Sale ${txnId}`, date, time, cashierId]
        );
      }

      updatedProductIds.add(productId);
    }

    for (const [productId, qty] of requiredQty.entries()) {
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, productId]);
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
