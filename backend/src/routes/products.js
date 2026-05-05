const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const {
	listProducts,
	createProduct,
	updateProduct,
	deleteProduct,
} = require('../controllers/productsController');

const router = express.Router();

router.get('/', listProducts);
router.post('/', requireRole(['superadmin', 'admin']), createProduct);
router.put('/:id', requireRole(['superadmin', 'admin']), updateProduct);
router.delete('/:id', requireRole(['superadmin', 'admin']), deleteProduct);

module.exports = router;
