const { PRODUCTS } = require('../config/products');

/**
 * Calculate expiry date from harvestedAt timestamp and product type.
 *
 * expiresAt = harvestedAt + product shelf life
 *
 * @param {string} product - Product name (oyster, button, dried)
 * @param {Date|string} harvestedAt - Harvest timestamp
 * @returns {Date} Expiry date
 */
function calculateExpiry(product, harvestedAt) {
  const config = PRODUCTS[product];
  if (!config) {
    throw new Error(`Unknown product: ${product}`);
  }

  const harvestDate = new Date(harvestedAt);
  if (isNaN(harvestDate.getTime())) {
    throw new Error(`Invalid harvestedAt date: ${harvestedAt}`);
  }

  return new Date(harvestDate.getTime() + config.shelfLifeMs);
}

/**
 * Calculate the IST end-of-day cutoff for a delivery date.
 *
 * A batch is eligible only if its expiresAt >= 23:59:59.999 IST on deliveryDate.
 * IST is UTC+05:30, so 23:59:59.999 IST = 18:29:59.999 UTC on the same date.
 *
 * We do NOT rely on the server's local timezone. We calculate the UTC equivalent
 * of IST end-of-day explicitly.
 *
 * @param {string} deliveryDate - Date string in YYYY-MM-DD format
 * @returns {Date} The UTC Date representing 23:59:59.999 IST on that day
 */
function getDeliveryDateCutoff(deliveryDate) {
  // Parse the date components to avoid timezone interpretation
  const parts = deliveryDate.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid deliveryDate format: ${deliveryDate}. Use YYYY-MM-DD.`);
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid deliveryDate: ${deliveryDate}`);
  }

  // Build 23:59:59.999 IST as UTC
  // IST = UTC + 5:30, so UTC = IST - 5:30
  // 23:59:59.999 IST = 23:59:59.999 - 05:30:00 = 18:29:59.999 UTC
  const utcMs = Date.UTC(year, month, day, 23, 59, 59, 999) - (5 * 60 + 30) * 60 * 1000;

  return new Date(utcMs);
}

module.exports = {
  calculateExpiry,
  getDeliveryDateCutoff,
};
