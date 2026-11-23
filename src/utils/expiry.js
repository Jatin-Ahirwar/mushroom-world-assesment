const { PRODUCTS } = require("../config/products");

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

function getDeliveryDateCutoff(deliveryDate) {
  if (!deliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(deliveryDate))) {
    throw new Error(
      `Invalid deliveryDate format: ${deliveryDate}. Expected YYYY-MM-DD`,
    );
  }

  const parts = String(deliveryDate).split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  // 23:59:59.999 IST = 18:29:59.999 UTC
  const utcMs =
    Date.UTC(year, month, day, 23, 59, 59, 999) - (5 * 60 + 30) * 60 * 1000;
  return new Date(utcMs);
}

module.exports = {
  calculateExpiry,
  getDeliveryDateCutoff,
};
