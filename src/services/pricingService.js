const {
  getBasePrices,
  GRADE_DISCOUNTS,
  DISTRIBUTOR_TIER_DISCOUNTS,
  EXPIRY_DISCOUNT_PERCENT,
  MAX_DISCOUNT_PERCENT,
} = require('../config/products');
const { getDistributorTier } = require('../config/distributors');

function calculateLinePrice({
  product,
  grade,
  grams,
  batchExpiresAt,
  orderTime = new Date(),
  distributorTier,
  distributorId,
}) {
  if (!grams || grams <= 0 || !Number.isInteger(grams)) {
    throw new Error('grams must be a positive integer');
  }

  const basePrices = getBasePrices();
  const basePricePerKg = basePrices[product];
  if (!basePricePerKg) {
    throw new Error(`Unknown product: ${product}`);
  }

  const tier = distributorTier || (distributorId ? getDistributorTier(distributorId) : 'silver');
  const gradeDiscount = GRADE_DISCOUNTS[grade] ?? 0;
  const tierDiscount = DISTRIBUTOR_TIER_DISCOUNTS[tier] ?? 0;

  let expiryDiscount = 0;
  if (batchExpiresAt) {
    const expiresMs = new Date(batchExpiresAt).getTime();
    const orderMs = new Date(orderTime).getTime();
    const msRemaining = expiresMs - orderMs;
    if (msRemaining < 24 * 60 * 60 * 1000) {
      expiryDiscount = EXPIRY_DISCOUNT_PERCENT;
    }
  }

  const totalDiscountPercent = Math.min(
    gradeDiscount + tierDiscount + expiryDiscount,
    MAX_DISCOUNT_PERCENT
  );

  const baseAmountPaise = (grams * basePricePerKg) / 1000;
  const discountFactor = (100 - totalDiscountPercent) / 100;
  const finalAmountPaise = Math.round(baseAmountPaise * discountFactor);

  return {
    amountPaise: finalAmountPaise,
    baseAmountPaise: Math.round(baseAmountPaise),
    totalDiscountPercent,
    effectiveDiscountPercent: totalDiscountPercent,
  };
}

function calculateOrderTotal(lines) {
  if (!Array.isArray(lines)) {
    return 0;
  }
  return lines.reduce((sum, line) => sum + (line.amountPaise || 0), 0);
}

module.exports = {
  calculateLinePrice,
  calculateOrderTotal,
};
