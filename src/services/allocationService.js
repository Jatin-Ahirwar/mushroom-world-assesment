const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const Ledger = require('../models/Ledger');
const { calculateExpiry, getDeliveryDateCutoff } = require('../utils/expiry');
const { calculateLinePrice } = require('./pricingService');
const { AppError } = require('../middleware/errorMiddleware');

async function createBatchStock({ product, grade, grams, harvestedAt }) {
  const expiresAt = calculateExpiry(product, harvestedAt);
  const session = await mongoose.startSession();
  let batch;

  try {
    await session.withTransaction(async () => {
      const [created] = await Batch.create(
        [{
          product,
          grade,
          harvestedAt: new Date(harvestedAt),
          expiresAt,
          totalGrams: grams,
          remainingGrams: grams,
        }],
        { session }
      );
      batch = created;

      await Ledger.create(
        [{ batchId: batch._id, movementType: 'ADDED', grams }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    batchId: batch._id.toString(),
    product: batch.product,
    grade: batch.grade,
    totalGrams: batch.totalGrams,
    remainingGrams: batch.remainingGrams,
    harvestedAt: batch.harvestedAt.toISOString(),
    expiresAt: batch.expiresAt.toISOString(),
  };
}

async function reserveFromBatches({ product, grade, grams, deliveryDate, orderTime, distributorId, isSubstituted, session }) {
  const cutoff = getDeliveryDateCutoff(deliveryDate);

  const batches = await Batch.find({
    product,
    grade,
    expiresAt: { $gte: cutoff },
    remainingGrams: { $gt: 0 },
  })
    .sort({ expiresAt: 1, harvestedAt: 1, _id: 1 })
    .session(session);

  let needed = grams;
  const lines = [];

  for (const batch of batches) {
    if (needed <= 0) break;

    let take = Math.min(batch.remainingGrams, needed);
    let updated = await Batch.findOneAndUpdate(
      { _id: batch._id, remainingGrams: { $gte: take } },
      { $inc: { remainingGrams: -take } },
      { session, new: true }
    );

    if (!updated) {
      const fresh = await Batch.findById(batch._id).session(session);
      if (!fresh || fresh.remainingGrams <= 0) continue;

      take = Math.min(fresh.remainingGrams, needed);
      updated = await Batch.findOneAndUpdate(
        { _id: batch._id, remainingGrams: { $gte: take } },
        { $inc: { remainingGrams: -take } },
        { session, new: true }
      );
      if (!updated) continue;
    }

    const price = calculateLinePrice({
      product,
      grade: batch.grade,
      grams: take,
      batchExpiresAt: batch.expiresAt,
      orderTime,
      distributorId,
    });

    lines.push({
      batchId: batch._id,
      grams: take,
      amountPaise: price.amountPaise,
      grade: batch.grade,
      isSubstituted,
    });
    needed -= take;
  }

  return { lines, remaining: needed };
}

async function allocateStock({
  distributorId,
  product,
  grade,
  grams,
  deliveryDate,
  allowPartial = false,
  allowSubstitute = false,
  orderTime = new Date(),
  session,
}) {
  const primary = await reserveFromBatches({
    product, grade, grams, deliveryDate, orderTime,
    distributorId, isSubstituted: false, session,
  });

  let lines = primary.lines;
  let needed = primary.remaining;

  if (needed > 0 && allowSubstitute && grade === 'A') {
    const substitute = await reserveFromBatches({
      product, grade: 'B', grams: needed, deliveryDate, orderTime,
      distributorId, isSubstituted: true, session,
    });
    lines = lines.concat(substitute.lines);
    needed = substitute.remaining;
  }

  if ((needed > 0 && !allowPartial) || lines.length === 0) {
    throw new AppError('Insufficient stock', 409, 'INSUFFICIENT_STOCK');
  }

  const allocatedGrams = grams - needed;
  const shortfallGrams = needed;
  const totalPaise = lines.reduce((sum, l) => sum + l.amountPaise, 0);

  return { lines, allocatedGrams, shortfallGrams, totalPaise };
}

const MOVEMENT_SIGN = { ADDED: 1, RESERVED: -1, RELEASED: 1, CONFIRMED: 0 };

async function reconcileStock() {
  const [batches, ledgerEntries] = await Promise.all([
    Batch.find({}),
    Ledger.find({}),
  ]);

  const expectedByBatch = {};
  for (const entry of ledgerEntries) {
    const id = entry.batchId.toString();
    const sign = MOVEMENT_SIGN[entry.movementType] ?? 0;
    expectedByBatch[id] = (expectedByBatch[id] || 0) + sign * entry.grams;
  }

  const mismatches = [];
  for (const batch of batches) {
    const id = batch._id.toString();
    const expected = expectedByBatch[id] ?? 0;
    if (expected !== batch.remainingGrams) {
      mismatches.push({
        batchId: id,
        product: batch.product,
        grade: batch.grade,
        expectedRemainingGrams: expected,
        actualRemainingGrams: batch.remainingGrams,
        difference: batch.remainingGrams - expected,
      });
    }
  }

  return {
    reconciled: mismatches.length === 0,
    totalBatchesChecked: batches.length,
    mismatchCount: mismatches.length,
    mismatches,
  };
}

module.exports = { createBatchStock, allocateStock, reconcileStock };
