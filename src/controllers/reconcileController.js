const { reconcileStock } = require('../services/allocationService');

async function reconcile(req, res, next) {
  try {
    const result = await reconcileStock();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { reconcile };
