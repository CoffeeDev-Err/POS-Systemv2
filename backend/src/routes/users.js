const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const {
	listUsers,
	createUser,
	updateUser,
	updateUserStatus,
} = require('../controllers/usersController');

const router = express.Router();

router.get('/', requireRole(['superadmin']), listUsers);
router.post('/', requireRole(['superadmin']), createUser);
router.put('/:id', requireRole(['superadmin']), updateUser);
router.patch('/:id/status', requireRole(['superadmin']), updateUserStatus);

module.exports = router;
