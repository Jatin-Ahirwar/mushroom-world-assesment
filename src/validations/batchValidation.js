const { z } = require('zod');
const { VALID_PRODUCTS, VALID_GRADES } = require('../config/products');

const createBatchSchema = z.object({
  product: z.enum(VALID_PRODUCTS),
  grade: z.enum(VALID_GRADES),
  grams: z.number().int().positive(),
  harvestedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid harvestedAt timestamp',
  }),
});

module.exports = { createBatchSchema };
