const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const { getSettings, updateSettings } = require('../controllers/settingsController');

const router = express.Router();

router.get('/', requireRole(['superadmin']), getSettings);
router.put('/', requireRole(['superadmin']), updateSettings);

module.exports = router;
