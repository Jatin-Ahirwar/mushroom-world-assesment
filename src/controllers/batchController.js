const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const Ledger = require('../models/Ledger');
const { calculateExpiry } = require('../utils/expiry');
const { VALID_PRODUCTS, VALID_GRADES } = require('../config/products');
const { AppError } = require('../middleware/errorMiddleware');

async function createBatch(req, res, next) {
  try {
    const { product, grade, grams, harvestedAt } = req.body;

    if (!product || !VALID_PRODUCTS.includes(product)) {
      throw new AppError(`Invalid product: ${product}`, 400, 'INVALID_INPUT');
    }
    if (!grade || !VALID_GRADES.includes(grade)) {
      throw new AppError(`Invalid grade: ${grade}`, 400, 'INVALID_INPUT');
    }
    if (!grams || !Number.isInteger(grams) || grams <= 0) {
      throw new AppError('grams must be a positive integer', 400, 'INVALID_INPUT');
    }
    if (!harvestedAt || isNaN(new Date(harvestedAt).getTime())) {
      throw new AppError('Invalid harvestedAt timestamp', 400, 'INVALID_INPUT');
    }

    const expiresAt = calculateExpiry(product, harvestedAt);

    const session = await mongoose.startSession();
    let batch;

    try {
      await session.withTransaction(async () => {
        const batchDocs = await Batch.create(
          [
            {
              product,
              grade,
              harvestedAt: new Date(harvestedAt),
              expiresAt,
              totalGrams: grams,
              remainingGrams: grams,
            },
          ],
          { session }
        );
        batch = batchDocs[0];

        await Ledger.create(
          [
            {
              batchId: batch._id,
              movementType: 'ADDED',
              grams,
            },
          ],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return res.status(201).json({
      batchId: batch._id.toString(),
      product: batch.product,
      grade: batch.grade,
      totalGrams: batch.totalGrams,
      remainingGrams: batch.remainingGrams,
      harvestedAt: batch.harvestedAt.toISOString(),
      expiresAt: batch.expiresAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBatch,
};
