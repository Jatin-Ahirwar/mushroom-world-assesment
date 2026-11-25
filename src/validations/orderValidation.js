const { z } = require('zod');
const { VALID_PRODUCTS, VALID_GRADES } = require('../config/products');

const orderHeadersSchema = z.object({
  distributorId: z.string().trim().min(1, 'X-Distributor-Id header is required'),
  idempotencyKey: z.string().trim().min(1, 'Idempotency-Key header is required'),
});

const createOrderSchema = z.object({
  product: z.enum(VALID_PRODUCTS),
  grade: z.enum(VALID_GRADES),
  grams: z.number().int().positive(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deliveryDate must be in YYYY-MM-DD format'),
  allowPartial: z.boolean(),
  allowSubstitute: z.boolean().optional().default(false),
});

module.exports = {
  orderHeadersSchema,
  createOrderSchema,
};
