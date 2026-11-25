const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Batch = require('../models/Batch');
const Ledger = require('../models/Ledger');
const Idempotency = require('../models/Idempotency');
const { allocateStock } = require('./allocationService');
const { AppError } = require('../middleware/errorMiddleware');
const { RESERVATION_TTL_MS, PLATINUM_RESERVATION_TTL_MS } = require('../config/products');
const { getDistributorTier } = require('../config/distributors');

function hashRequest(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

async function expireOrderInSession(order, session) {
  order.status = 'EXPIRED';
  await order.save({ session });

  for (const line of order.lines) {
    await Batch.findByIdAndUpdate(
      line.batchId,
      { $inc: { remainingGrams: line.grams } },
      { session }
    );
  }

  const releaseEntries = order.lines.map((line) => ({
    batchId: line.batchId,
    movementType: 'RELEASED',
    grams: line.grams,
    orderId: order._id,
  }));
  await Ledger.insertMany(releaseEntries, { session });
}

async function createOrderReservation({
  distributorId,
  product,
  grade,
  grams,
  deliveryDate,
  allowPartial = false,
  allowSubstitute = false,
  idempotencyKey,
  requestBody,
}) {
  const reqHash = hashRequest(requestBody);

  if (idempotencyKey) {
    const existing = await Idempotency.findOne({ distributorId, key: idempotencyKey });
    if (existing) {
      if (existing.requestHash !== reqHash) {
        throw new AppError('IDEMPOTENCY_KEY_REUSED', 422, 'IDEMPOTENCY_KEY_REUSED');
      }
      return { response: existing.response, statusCode: 201 };
    }
  }

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const orderTime = new Date();
      const tier = getDistributorTier(distributorId);
      const ttl = tier === 'platinum' ? PLATINUM_RESERVATION_TTL_MS : RESERVATION_TTL_MS;
      const reservedUntil = new Date(orderTime.getTime() + ttl);

      const allocation = await allocateStock({
        distributorId, product, grade, grams, deliveryDate,
        allowPartial, allowSubstitute, orderTime, session,
      });

      const [order] = await Order.create(
        [{
          distributorId,
          product,
          grade,
          requestedGrams: grams,
          allocatedGrams: allocation.allocatedGrams,
          shortfallGrams: allocation.shortfallGrams,
          lines: allocation.lines,
          totalPaise: allocation.totalPaise,
          status: 'RESERVED',
          reservedUntil,
        }],
        { session }
      );

      const ledgerEntries = allocation.lines.map((line) => ({
        batchId: line.batchId,
        movementType: 'RESERVED',
        grams: line.grams,
        orderId: order._id,
      }));
      await Ledger.insertMany(ledgerEntries, { session });

      result = {
        orderId: order._id.toString(),
        status: order.status,
        reservedUntil: order.reservedUntil.toISOString(),
        lines: allocation.lines.map((l) => {
          const line = { batchId: l.batchId.toString(), grams: l.grams, amountPaise: l.amountPaise };
          if (l.grade) line.grade = l.grade;
          if (l.isSubstituted) line.isSubstituted = true;
          return line;
        }),
        totalPaise: order.totalPaise,
        shortfallGrams: order.shortfallGrams,
      };

      if (idempotencyKey) {
        await Idempotency.create(
          [{ distributorId, key: idempotencyKey, requestHash: reqHash, response: result }],
          { session }
        );
      }
    });

    return { response: result, statusCode: 201 };
  } finally {
    await session.endSession();
  }
}

async function confirmOrderReservation(orderId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new AppError('Invalid order ID', 400, 'INVALID_INPUT');
  }

  const session = await mongoose.startSession();
  let expiredDuringConfirm = false;
  let response;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new AppError('Order not found', 404, 'NOT_FOUND');
      }

      if (order.status === 'EXPIRED') {
        expiredDuringConfirm = true;
        return;
      }

      if (order.status === 'CONFIRMED') {
        response = { orderId: order._id.toString(), status: 'CONFIRMED' };
        return;
      }

      if (order.reservedUntil.getTime() <= Date.now()) {
        await expireOrderInSession(order, session);
        expiredDuringConfirm = true;
        return;
      }

      order.status = 'CONFIRMED';
      await order.save({ session });

      const confirmEntries = order.lines.map((line) => ({
        batchId: line.batchId,
        movementType: 'CONFIRMED',
        grams: line.grams,
        orderId: order._id,
      }));
      await Ledger.insertMany(confirmEntries, { session });

      response = { orderId: order._id.toString(), status: 'CONFIRMED' };
    });

    if (expiredDuringConfirm) {
      throw new AppError('RESERVATION_EXPIRED', 410, 'RESERVATION_EXPIRED');
    }

    return response;
  } finally {
    await session.endSession();
  }
}

async function releaseExpiredReservations() {
  const expiredOrders = await Order.find({
    status: 'RESERVED',
    reservedUntil: { $lte: new Date() },
  });

  for (const order of expiredOrders) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const fresh = await Order.findOne({ _id: order._id, status: 'RESERVED' }).session(session);
        if (!fresh) return;
        await expireOrderInSession(fresh, session);
      });
    } catch (err) {
      console.error(`Failed to expire order ${order._id}:`, err.message);
    } finally {
      await session.endSession();
    }
  }
}

let expirationInterval = null;

function startExpirationWorker(pollMs = 15000) {
  if (expirationInterval) return;
  expirationInterval = setInterval(() => {
    releaseExpiredReservations().catch((err) => {
      console.error('Error in expiration worker:', err.message);
    });
  }, pollMs);
  if (expirationInterval.unref) {
    expirationInterval.unref();
  }
}

function stopExpirationWorker() {
  if (expirationInterval) {
    clearInterval(expirationInterval);
    expirationInterval = null;
  }
}

module.exports = {
  createOrderReservation,
  confirmOrderReservation,
  releaseExpiredReservations,
  startExpirationWorker,
  stopExpirationWorker,
};
