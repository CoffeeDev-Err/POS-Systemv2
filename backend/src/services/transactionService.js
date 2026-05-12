const { getPool } = require('../config/db');
const { ApiError } = require('../utils/errors');
const { logAudit } = require('../utils/audit');
const { formatDate, formatTime } = require('../utils/format');
const productRepository = require('../repositories/productRepository');
const transactionRepository = require('../repositories/transactionRepository');

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

async function listTransactions() {
  const pool = getPool();
  const txRows = await transactionRepository.listTransactions(pool);
  const itemRows = await transactionRepository.listTransactionItems(pool);

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

  return txRows.map(row => mapTransactionRow(row, itemMap.get(row.id) || []));
}

async function getTransaction(id) {
  const pool = getPool();
  const txnRow = await transactionRepository.findTransactionById(pool, id);
  if (!txnRow) {
    throw ApiError.notFound('Transaction not found.');
  }

  const itemRows = await transactionRepository.listTransactionItems(pool, id);
  const items = itemRows.map(row => ({
    productId: row.product_id,
    name: row.product_name,
    qty: Number(row.qty),
    price: Number(row.price),
    cost: Number(row.cost),
    total: Number(row.total),
    costTotal: Number(row.cost_total),
  }));

  return mapTransactionRow(txnRow, items);
}

/**
 * Create a transaction with stock movement and cost tracking.
 * @param {{ id?: string, items: Array, cash: number, cashierId?: number }} payload
 * @param {number} userId
 */
async function createTransaction(payload, userId) {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const { id, items, cash } = payload;
    const cashierId = payload.cashierId || userId;

    if (!Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('Items are required.');
    }

    const invalidItem = items.find(item => Number(item.qty || 0) <= 0 || (!item.productId && !item.name));
    if (invalidItem) {
      throw ApiError.badRequest('Each item must have a product and quantity.');
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
      throw ApiError.badRequest('No valid products in transaction.');
    }

    const productRows = await productRepository.listByIdsOrNames(conn, idList, nameList);
    const productById = new Map(productRows.map(p => [p.id, p]));
    const productByName = new Map(productRows.map(p => [p.name, p]));

    const requiredQty = new Map();
    const normalizedItems = requestedItems.map(item => {
      const product = item.productId
        ? productById.get(item.productId)
        : productByName.get(item.name);

      if (!product) {
        throw ApiError.badRequest(`Product not found: ${item.name || item.productId}`);
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
        throw ApiError.badRequest(`Insufficient stock for ${product.name}.`);
      }
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);
    const cashValue = Number(cash || 0);
    const changeValue = cashValue - subtotal;

    if (cashValue < subtotal) {
      throw ApiError.badRequest('Cash amount is less than subtotal.');
    }

    let txnId = id;
    let inserted = false;
    let attempts = 0;

    while (!inserted && attempts < 5) {
      attempts += 1;
      if (!txnId) txnId = generateTxnId(now);
      try {
        await transactionRepository.insertTransaction(conn, {
          id: txnId,
          date,
          time,
          cashierId,
          subtotal,
          cash: cashValue,
          change: changeValue,
        });
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
      throw ApiError.internal('Failed to generate transaction id.');
    }

    const updatedProductIds = new Set();

    for (const item of normalizedItems) {
      await transactionRepository.insertTransactionItem(conn, {
        transactionId: txnId,
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        price: item.price,
        cost: item.cost,
        total: item.total,
        costTotal: item.costTotal,
      });

      await transactionRepository.insertStockMovement(conn, {
        productId: item.productId,
        type: 'sale',
        qty: item.qty,
        note: `Sale ${txnId}`,
        date,
        time,
        createdBy: cashierId,
      });

      updatedProductIds.add(item.productId);
    }

    for (const [productId, qty] of requiredQty.entries()) {
      await productRepository.updateStock(conn, productId, -qty);
    }

    await conn.commit();
    await logAudit(userId, `Transaction ${txnId} completed`);

    const cashierName = await transactionRepository.findCashierName(pool, cashierId);

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

    let updatedProducts = [];
    if (updatedProductIds.size > 0) {
      const ids = Array.from(updatedProductIds);
      const rows = await Promise.all(ids.map(productId => productRepository.findById(pool, productId)));
      updatedProducts = rows.filter(Boolean).map(row => ({
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

    return { transaction, updatedProducts };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { listTransactions, getTransaction, createTransaction };
