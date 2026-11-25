const { createBatchSchema } = require('../validations/batchValidation');
const { createBatchStock } = require('../services/allocationService');

async function createBatch(req, res, next) {
  try {
    const data = createBatchSchema.parse(req.body);
    const batch = await createBatchStock(data);
    return res.status(201).json(batch);
  } catch (err) {
    next(err);
  }
}

module.exports = { createBatch };
