const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const {
	listTransactions,
	getTransaction,
	createTransaction,
} = require('../controllers/transactionsController');

const router = express.Router();

router.get('/', requireRole(['superadmin', 'admin']), listTransactions);
router.get('/:id', requireRole(['superadmin', 'admin']), getTransaction);
router.post('/', requireRole(['superadmin', 'admin', 'cashier']), createTransaction);

module.exports = router;
