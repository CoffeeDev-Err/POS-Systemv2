const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const {
	listStockMovements,
	createStockMovement,
} = require('../controllers/stockMovementsController');

const router = express.Router();

router.get('/', requireRole(['superadmin', 'admin']), listStockMovements);
router.post('/', requireRole(['superadmin', 'admin']), createStockMovement);

module.exports = router;
