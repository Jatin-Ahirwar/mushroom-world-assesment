const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
    movementType: {
      type: String,
      required: true,
      enum: ['ADDED', 'RESERVED', 'RELEASED', 'CONFIRMED'],
    },
    grams: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'grams must be an integer',
      },
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    // Disable updatedAt since ledger is append-only
    timestamps: false,
    // Prevent updates and deletes at the schema level
    strict: true,
  }
);

// Compound index for reconciliation: group by batchId, sort by time
ledgerSchema.index({ batchId: 1, createdAt: 1 }, { name: 'reconciliation' });

module.exports = mongoose.model('Ledger', ledgerSchema);
