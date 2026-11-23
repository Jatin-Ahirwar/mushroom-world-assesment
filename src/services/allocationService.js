const Batch = require('../models/Batch');
const { getDeliveryDateCutoff } = require('../utils/expiry');
const { calculateLinePrice } = require('./pricingService');
const { AppError } = require('../middleware/errorMiddleware');

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

  for (const b of batches) {
    if (needed <= 0) break;

    const take = Math.min(b.remainingGrams, needed);

    const updated = await Batch.findOneAndUpdate(
      { _id: b._id, remainingGrams: { $gte: take } },
      { $inc: { remainingGrams: -take } },
      { session, new: true }
    );

    if (!updated) {
      const fresh = await Batch.findById(b._id).session(session);
      if (!fresh || fresh.remainingGrams <= 0) continue;

      const retryTake = Math.min(fresh.remainingGrams, needed);
      const retryUpdated = await Batch.findOneAndUpdate(
        { _id: b._id, remainingGrams: { $gte: retryTake } },
        { $inc: { remainingGrams: -retryTake } },
        { session, new: true }
      );
      if (!retryUpdated) continue;

      const price = calculateLinePrice({
        product, grade: b.grade, grams: retryTake,
        batchExpiresAt: b.expiresAt, orderTime, distributorId,
      });

      lines.push({
        batchId: b._id, grams: retryTake, amountPaise: price.amountPaise,
        grade: b.grade, isSubstituted,
      });
      needed -= retryTake;
    } else {
      const price = calculateLinePrice({
        product, grade: b.grade, grams: take,
        batchExpiresAt: b.expiresAt, orderTime, distributorId,
      });

      lines.push({
        batchId: b._id, grams: take, amountPaise: price.amountPaise,
        grade: b.grade, isSubstituted,
      });
      needed -= take;
    }
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

  // Part C: if Grade A is short and substitution is allowed, fill from Grade B
  if (needed > 0 && allowSubstitute && grade === 'A') {
    const substitute = await reserveFromBatches({
      product, grade: 'B', grams: needed, deliveryDate, orderTime,
      distributorId, isSubstituted: true, session,
    });
    lines = lines.concat(substitute.lines);
    needed = substitute.remaining;
  }

  if (needed > 0 && !allowPartial) {
    throw new AppError('Insufficient stock', 409, 'INSUFFICIENT_STOCK');
  }

  if (lines.length === 0) {
    throw new AppError('Insufficient stock', 409, 'INSUFFICIENT_STOCK');
  }

  const allocatedGrams = grams - needed;
  const shortfallGrams = needed;
  const totalPaise = lines.reduce((sum, l) => sum + l.amountPaise, 0);

  return { lines, allocatedGrams, shortfallGrams, totalPaise };
}

module.exports = {
  allocateStock,
};
