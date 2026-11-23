const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    product: {
      type: String,
      required: true,
      enum: ['oyster', 'button', 'dried'],
      index: true,
    },
    grade: {
      type: String,
      required: true,
      enum: ['A', 'B'],
      index: true,
    },
    harvestedAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    totalGrams: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'totalGrams must be an integer',
      },
    },
    remainingGrams: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'remainingGrams must be an integer',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for FEFO allocation queries:
// find batches by product + grade with remaining stock, sorted by expiresAt
batchSchema.index(
  { product: 1, grade: 1, remainingGrams: 1, expiresAt: 1 },
  { name: 'fefo_allocation' }
);

module.exports = mongoose.model('Batch', batchSchema);
