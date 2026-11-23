const mongoose = require('mongoose');

const orderLineSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
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
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'amountPaise must be an integer',
      },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    distributorId: {
      type: String,
      required: true,
      index: true,
    },
    product: {
      type: String,
      required: true,
      enum: ['oyster', 'button', 'dried'],
    },
    grade: {
      type: String,
      required: true,
      enum: ['A', 'B'],
    },
    requestedGrams: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'requestedGrams must be an integer',
      },
    },
    allocatedGrams: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'allocatedGrams must be an integer',
      },
    },
    shortfallGrams: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'shortfallGrams must be an integer',
      },
    },
    lines: {
      type: [orderLineSchema],
      required: true,
    },
    totalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'totalPaise must be an integer',
      },
    },
    status: {
      type: String,
      required: true,
      enum: ['RESERVED', 'CONFIRMED', 'EXPIRED'],
      default: 'RESERVED',
      index: true,
    },
    reservedUntil: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding expired reservations efficiently
orderSchema.index(
  { status: 1, reservedUntil: 1 },
  { name: 'expired_reservations' }
);

module.exports = mongoose.model('Order', orderSchema);
