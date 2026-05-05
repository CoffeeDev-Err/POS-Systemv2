const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const { listExpenses, createExpense } = require('../controllers/expensesController');

const router = express.Router();

router.get('/', requireRole(['superadmin', 'admin']), listExpenses);
router.post('/', requireRole(['superadmin', 'admin']), createExpense);

module.exports = router;
