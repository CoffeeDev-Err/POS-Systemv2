const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const {
	listCategories,
	createCategory,
	deleteCategory,
} = require('../controllers/categoriesController');

const router = express.Router();

router.get('/', listCategories);
router.post('/', requireRole(['superadmin', 'admin']), createCategory);
router.delete('/:id', requireRole(['superadmin', 'admin']), deleteCategory);

module.exports = router;
