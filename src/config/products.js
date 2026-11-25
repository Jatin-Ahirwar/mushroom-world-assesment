const PRODUCTS = {
  oyster: { shelfLifeMs: 72 * 60 * 60 * 1000 },
  button: { shelfLifeMs: 120 * 60 * 60 * 1000 },
  dried: { shelfLifeMs: 180 * 24 * 60 * 60 * 1000 },
};

const DEFAULT_BASE_PRICES_PAISE = {
  oyster: 50000,
  button: 40000,
  dried: 80000,
};

function getBasePrices() {
  const envVal = process.env.PRODUCT_BASE_PRICES_PAISE;
  if (!envVal) return { ...DEFAULT_BASE_PRICES_PAISE };

  const prices = { ...DEFAULT_BASE_PRICES_PAISE };
  for (const pair of envVal.split(',')) {
    const [product, priceStr] = pair.trim().split(':');
    const price = parseInt(priceStr, 10);
    if (product && !isNaN(price) && price > 0) {
      prices[product.trim()] = price;
    }
  }
  return prices;
}

const GRADE_DISCOUNTS = { A: 0, B: 15 };
const DISTRIBUTOR_TIER_DISCOUNTS = { silver: 0, gold: 5, platinum: 8 };
const DEFAULT_DISTRIBUTOR_TIER = 'silver';
const EXPIRY_DISCOUNT_PERCENT = 20;
const MAX_DISCOUNT_PERCENT = 25;
const RESERVATION_TTL_MS = 15 * 60 * 1000;
const PLATINUM_RESERVATION_TTL_MS = 30 * 60 * 1000;

module.exports = {
  PRODUCTS,
  getBasePrices,
  GRADE_DISCOUNTS,
  DISTRIBUTOR_TIER_DISCOUNTS,
  DEFAULT_DISTRIBUTOR_TIER,
  EXPIRY_DISCOUNT_PERCENT,
  MAX_DISCOUNT_PERCENT,
  RESERVATION_TTL_MS,
  PLATINUM_RESERVATION_TTL_MS,
  VALID_PRODUCTS: Object.keys(PRODUCTS),
  VALID_GRADES: Object.keys(GRADE_DISCOUNTS),
};
