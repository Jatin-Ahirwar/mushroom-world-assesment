const { orderHeadersSchema, createOrderSchema } = require('../validations/orderValidation');
const { createOrderReservation, confirmOrderReservation } = require('../services/reservationService');

async function createOrder(req, res, next) {
  try {
    const { distributorId, idempotencyKey } = orderHeadersSchema.parse({
      distributorId: req.header('X-Distributor-Id'),
      idempotencyKey: req.header('Idempotency-Key'),
    });

    const body = createOrderSchema.parse(req.body);

    const { response, statusCode } = await createOrderReservation({
      ...body,
      distributorId,
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
    const response = await confirmOrderReservation(req.params.id);
    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, confirmOrder };
