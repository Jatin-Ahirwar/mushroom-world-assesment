const { createOrderReservation, confirmOrderReservation } = require('../services/reservationService');
const { VALID_PRODUCTS, VALID_GRADES } = require('../config/products');
const { AppError } = require('../middleware/errorMiddleware');

async function createOrder(req, res, next) {
  try {
    const distributorId = req.header('X-Distributor-Id') || req.header('x-distributor-id');
    const idempotencyKey = req.header('Idempotency-Key') || req.header('idempotency-key');

    if (!distributorId) {
      throw new AppError('X-Distributor-Id header is required', 400, 'INVALID_INPUT');
    }
    if (!idempotencyKey) {
      throw new AppError('Idempotency-Key header is required', 400, 'INVALID_INPUT');
    }

    const { product, grade, grams, deliveryDate, allowPartial, allowSubstitute } = req.body;

    if (!product || !VALID_PRODUCTS.includes(product)) {
      throw new AppError(`Invalid product: ${product}`, 400, 'INVALID_INPUT');
    }
    if (!grade || !VALID_GRADES.includes(grade)) {
      throw new AppError(`Invalid grade: ${grade}`, 400, 'INVALID_INPUT');
    }
    if (!grams || !Number.isInteger(grams) || grams <= 0) {
      throw new AppError('grams must be a positive integer', 400, 'INVALID_INPUT');
    }
    if (!deliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(deliveryDate))) {
      throw new AppError('deliveryDate must be in YYYY-MM-DD format', 400, 'INVALID_INPUT');
    }
    if (typeof allowPartial !== 'boolean') {
      throw new AppError('allowPartial must be a boolean', 400, 'INVALID_INPUT');
    }
    if (allowSubstitute !== undefined && typeof allowSubstitute !== 'boolean') {
      throw new AppError('allowSubstitute must be a boolean', 400, 'INVALID_INPUT');
    }

    const { response, statusCode } = await createOrderReservation({
      distributorId,
      product,
      grade,
      grams,
      deliveryDate,
      allowPartial,
      allowSubstitute: allowSubstitute || false,
      idempotencyKey,
      requestBody: req.body,
    });

    return res.status(statusCode || 201).json(response);
  } catch (err) {
    next(err);
  }
}

async function confirmOrder(req, res, next) {
  try {
    const { id } = req.params;
    const response = await confirmOrderReservation(id);
    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  confirmOrder,
};
