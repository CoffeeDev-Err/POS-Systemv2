const { getPool } = require('../config/db');
const { formatDate } = require('../utils/format');

function mapExpense(row) {
  return {
    id: row.id,
    date: formatDate(row.expense_date),
    amount: Number(row.amount),
    category: row.category,
    note: row.note,
    createdBy: row.created_by,
    createdByName: row.user_name || 'System',
  };
}

async function listExpenses(req, res, next) {
  try {
    const { from, to } = req.query;
    const pool = getPool();

    let sql = `SELECT e.id, e.expense_date, e.amount, e.category, e.note, e.created_by, u.name AS user_name
               FROM expenses e
               LEFT JOIN users u ON u.id = e.created_by`;
    const params = [];

    if (from && to) {
      sql += ' WHERE e.expense_date BETWEEN ? AND ?';
      params.push(from, to);
    } else if (from) {
      sql += ' WHERE e.expense_date >= ?';
      params.push(from);
    } else if (to) {
      sql += ' WHERE e.expense_date <= ?';
      params.push(to);
    }

    sql += ' ORDER BY e.expense_date DESC, e.id DESC';

    const [rows] = await pool.query(sql, params);
    return res.json(rows.map(mapExpense));
  } catch (err) {
    return next(err);
  }
}

async function createExpense(req, res, next) {
  try {
    const { date, amount, category, note } = req.body;
    const expenseDate = String(date || '').trim();
    const categoryName = String(category || '').trim();
    const amountValue = Number(amount || 0);

    if (!expenseDate || !categoryName || !amountValue || amountValue <= 0) {
      return res.status(400).json({ message: 'Date, category, and amount are required.' });
    }

    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO expenses (expense_date, amount, category, note, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [expenseDate, amountValue, categoryName, note || null, req.user.id]
    );

    const [rows] = await pool.query(
      `SELECT e.id, e.expense_date, e.amount, e.category, e.note, e.created_by, u.name AS user_name
       FROM expenses e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.id = ?`,
      [result.insertId]
    );

    return res.status(201).json(mapExpense(rows[0]));
  } catch (err) {
    return next(err);
  }
}

module.exports = { listExpenses, createExpense };
