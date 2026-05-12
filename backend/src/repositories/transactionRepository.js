async function listTransactions(db) {
  const [rows] = await db.query(
    `SELECT t.id, t.date, t.time, t.cashier_id, t.subtotal, t.cash, t.change_amount,
            u.name AS cashier_name
     FROM transactions t
     LEFT JOIN users u ON u.id = t.cashier_id
     ORDER BY t.date, t.time, t.id`
  );
  return rows;
}

async function findTransactionById(db, id) {
  const [rows] = await db.query(
    `SELECT t.id, t.date, t.time, t.cashier_id, t.subtotal, t.cash, t.change_amount,
            u.name AS cashier_name
     FROM transactions t
     LEFT JOIN users u ON u.id = t.cashier_id
     WHERE t.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listTransactionItems(db, transactionId) {
  const where = transactionId ? 'WHERE transaction_id = ?' : '';
  const params = transactionId ? [transactionId] : [];
  const [rows] = await db.query(
    `SELECT transaction_id, product_id, product_name, qty, price, cost, total, cost_total
     FROM transaction_items
     ${where}
     ORDER BY id`,
    params
  );
  return rows;
}

async function insertTransaction(db, payload) {
  await db.query(
    `INSERT INTO transactions (id, date, time, cashier_id, subtotal, cash, change_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [payload.id, payload.date, payload.time, payload.cashierId, payload.subtotal, payload.cash, payload.change]
  );
}

async function insertTransactionItem(db, payload) {
  await db.query(
    `INSERT INTO transaction_items (transaction_id, product_id, product_name, qty, price, cost, total, cost_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.transactionId,
      payload.productId,
      payload.name,
      payload.qty,
      payload.price,
      payload.cost,
      payload.total,
      payload.costTotal,
    ]
  );
}

async function insertStockMovement(db, payload) {
  await db.query(
    `INSERT INTO stock_movements (product_id, type, qty, note, movement_date, movement_time, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.productId,
      payload.type,
      payload.qty,
      payload.note,
      payload.date,
      payload.time,
      payload.createdBy,
    ]
  );
}

async function findCashierName(db, cashierId) {
  const [rows] = await db.query('SELECT name FROM users WHERE id = ? LIMIT 1', [cashierId]);
  return rows.length ? rows[0].name : 'Unknown';
}

module.exports = {
  listTransactions,
  findTransactionById,
  listTransactionItems,
  insertTransaction,
  insertTransactionItem,
  insertStockMovement,
  findCashierName,
};
