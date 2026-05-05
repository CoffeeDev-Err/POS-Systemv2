const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const { listAuditLogs } = require('../controllers/auditLogsController');

const router = express.Router();

router.get('/', requireRole(['superadmin']), listAuditLogs);

module.exports = router;
