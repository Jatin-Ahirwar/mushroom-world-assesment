const PRODUCTS = {
  oyster: {
    shelfLifeMs: 72 * 60 * 60 * 1000, // 72 hours
  },
  button: {
    shelfLifeMs: 120 * 60 * 60 * 1000, // 120 hours
  },
  dried: {
    shelfLifeMs: 180 * 24 * 60 * 60 * 1000, // 180 days
  },
};

// Default base prices in paise per kg (used when env var is absent)
const DEFAULT_BASE_PRICES_PAISE = {
  oyster: 50000, // ₹500/kg
  button: 40000, // ₹400/kg
  dried: 80000, // ₹800/kg
};

/**
 * Parse PRODUCT_BASE_PRICES_PAISE env var.
 * Format: "oyster:50000,button:40000,dried:80000"
 */
function parseBasePrices() {
  const envVal = process.env.PRODUCT_BASE_PRICES_PAISE;
  if (!envVal) return { ...DEFAULT_BASE_PRICES_PAISE };

  const prices = {};
  const pairs = envVal.split(",");
  for (const pair of pairs) {
    const [product, priceStr] = pair.trim().split(":");
    const price = parseInt(priceStr, 10);
    if (product && !isNaN(price) && price > 0) {
      prices[product.trim()] = price;
    }
  }
  return { ...DEFAULT_BASE_PRICES_PAISE, ...prices };
}

function getBasePrices() {
  return parseBasePrices();
}

/**
 * Grade discounts (percentage off base price).
 */
const GRADE_DISCOUNTS = {
  A: 0,
  B: 15,
};

/**
 * Distributor tier discounts (percentage off base price).
 * Tier is determined by distributorId lookup.
 */
const DISTRIBUTOR_TIER_DISCOUNTS = {
  silver: 0,
  gold: 5,
  platinum: 8,
};

/**
 * Default tier when distributorId has no explicit mapping.
 */
const DEFAULT_DISTRIBUTOR_TIER = "silver";

/**
 * Expiry discount: applied when less than 24 hours remain at order time.
 */
const EXPIRY_DISCOUNT_PERCENT = 20;

/**
 * Maximum total discount cap (percentage of original base price).
 */
const MAX_DISCOUNT_PERCENT = 25;

/**
 * Reservation TTL in milliseconds (15 minutes).
 */
const RESERVATION_TTL_MS = 15 * 60 * 1000;

/**
 * Valid product names.
 */
const VALID_PRODUCTS = Object.keys(PRODUCTS);

/**
 * Valid grades.
 */
const VALID_GRADES = Object.keys(GRADE_DISCOUNTS);

module.exports = {
  PRODUCTS,
  getBasePrices,
  GRADE_DISCOUNTS,
  DISTRIBUTOR_TIER_DISCOUNTS,
  DEFAULT_DISTRIBUTOR_TIER,
  EXPIRY_DISCOUNT_PERCENT,
  MAX_DISCOUNT_PERCENT,
  RESERVATION_TTL_MS,
  VALID_PRODUCTS,
  VALID_GRADES,
};
