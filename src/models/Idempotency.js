const mongoose = require('mongoose');

const idempotencySchema = new mongoose.Schema(
  {
    distributorId: {
      type: String,
      required: true,
    },
    key: {
      type: String,
      required: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    response: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: one key per distributor
idempotencySchema.index(
  { distributorId: 1, key: 1 },
  { unique: true, name: 'unique_idempotency_key' }
);

module.exports = mongoose.model('Idempotency', idempotencySchema);
