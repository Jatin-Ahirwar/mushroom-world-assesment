const Batch = require('../models/Batch');
const Ledger = require('../models/Ledger');

async function reconcile(req, res, next) {
  try {
    const batches = await Batch.find({});
    const ledgerEntries = await Ledger.find({});

    const ledgerTotalsByBatch = {};
    for (const entry of ledgerEntries) {
      const bId = entry.batchId.toString();
      if (!ledgerTotalsByBatch[bId]) {
        ledgerTotalsByBatch[bId] = 0;
      }

      if (entry.movementType === 'ADDED') {
        ledgerTotalsByBatch[bId] += entry.grams;
      } else if (entry.movementType === 'RESERVED') {
        ledgerTotalsByBatch[bId] -= entry.grams;
      } else if (entry.movementType === 'RELEASED') {
        ledgerTotalsByBatch[bId] += entry.grams;
      }
      // CONFIRMED movements do not modify remaining stock because stock was already reserved
    }

    const mismatches = [];

    for (const batch of batches) {
      const bId = batch._id.toString();
      const expectedRemaining = ledgerTotalsByBatch[bId] ?? 0;
      const actualRemaining = batch.remainingGrams;

      if (expectedRemaining !== actualRemaining) {
        mismatches.push({
          batchId: bId,
          product: batch.product,
          grade: batch.grade,
          expectedRemainingGrams: expectedRemaining,
          actualRemainingGrams: actualRemaining,
          difference: actualRemaining - expectedRemaining,
        });
      }
    }

    return res.status(200).json({
      reconciled: mismatches.length === 0,
      totalBatchesChecked: batches.length,
      mismatchCount: mismatches.length,
      mismatches,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  reconcile,
};
