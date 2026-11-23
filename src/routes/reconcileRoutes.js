const express = require('express');
const router = express.Router();
const { reconcile } = require('../controllers/reconcileController');

router.get('/', reconcile);

module.exports = router;
