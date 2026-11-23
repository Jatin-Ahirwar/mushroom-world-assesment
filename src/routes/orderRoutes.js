const express = require('express');
const router = express.Router();
const { createOrder, confirmOrder } = require('../controllers/orderController');

router.post('/', createOrder);
router.post('/:id/confirm', confirmOrder);

module.exports = router;
