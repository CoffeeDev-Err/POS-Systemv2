const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use('/auth', require('./auth'));

router.use(requireAuth);
router.use('/products', require('./products'));
router.use('/categories', require('./categories'));
router.use('/users', require('./users'));
router.use('/transactions', require('./transactions'));
router.use('/stock-movements', require('./stockMovements'));
router.use('/settings', require('./settings'));
router.use('/audit-logs', require('./auditLogs'));
router.use('/expenses', require('./expenses'));

module.exports = router;
