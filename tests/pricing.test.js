const { calculateLinePrice, calculateOrderTotal } = require('../src/services/pricingService');

describe('Pricing Service', () => {
  const baseOrderTime = new Date('2026-11-22T10:00:00.000Z');
  // 48 hours remaining (no expiry discount)
  const farExpiry = new Date('2026-11-24T10:00:00.000Z');
  // 12 hours remaining (< 24h, triggers 20% expiry discount)
  const nearExpiry = new Date('2026-11-22T22:00:00.000Z');

  describe('Grade Discounts (Base: Oyster @ 50,000 paise/kg)', () => {
    test('Grade A gets 0% discount with Silver tier', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'A',
        grams: 1000,
        batchExpiresAt: farExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'silver',
      });

      expect(result.totalDiscountPercent).toBe(0);
      expect(result.amountPaise).toBe(50000);
    });

    test('Grade B gets 15% discount with Silver tier', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'B',
        grams: 1000,
        batchExpiresAt: farExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'silver',
      });

      // 50,000 - 15% = 42,500
      expect(result.totalDiscountPercent).toBe(15);
      expect(result.amountPaise).toBe(42500);
    });
  });

  describe('Distributor Tiers', () => {
    test('Silver distributor gets 0% tier discount', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'A',
        grams: 1000,
        batchExpiresAt: farExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'silver',
      });
      expect(result.totalDiscountPercent).toBe(0);
      expect(result.amountPaise).toBe(50000);
    });

    test('Gold distributor gets 5% tier discount', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'A',
        grams: 1000,
        batchExpiresAt: farExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'gold',
      });
      // 50,000 - 5% = 47,500
      expect(result.totalDiscountPercent).toBe(5);
      expect(result.amountPaise).toBe(47500);
    });

    test('Platinum distributor gets 8% tier discount', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'A',
        grams: 1000,
        batchExpiresAt: farExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'platinum',
      });
      // 50,000 - 8% = 46,000
      expect(result.totalDiscountPercent).toBe(8);
      expect(result.amountPaise).toBe(46000);
    });

    test('combines Grade B and Gold tier (15% + 5% = 20%)', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'B',
        grams: 1000,
        batchExpiresAt: farExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'gold',
      });
      // 50,000 - 20% = 40,000
      expect(result.totalDiscountPercent).toBe(20);
      expect(result.amountPaise).toBe(40000);
    });

    test('combines Grade B and Platinum tier (15% + 8% = 23%)', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'B',
        grams: 1000,
        batchExpiresAt: farExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'platinum',
      });
      // 50,000 - 23% = 38,500
      expect(result.totalDiscountPercent).toBe(23);
      expect(result.amountPaise).toBe(38500);
    });
  });

  describe('Expiry Discount & 25% Maximum Cap', () => {
    test('applies 20% expiry discount when less than 24h remain', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'A',
        grams: 1000,
        batchExpiresAt: nearExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'silver',
      });
      // 50,000 - 20% = 40,000
      expect(result.totalDiscountPercent).toBe(20);
      expect(result.amountPaise).toBe(40000);
    });

    test('caps discount at 25% when Grade B + expiry (15% + 20% = 35% -> 25%)', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'B',
        grams: 1000,
        batchExpiresAt: nearExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'silver',
      });
      // 50,000 - 25% = 37,500
      expect(result.totalDiscountPercent).toBe(25);
      expect(result.amountPaise).toBe(37500);
    });

    test('caps discount at 25% for Platinum + Grade B + expiry (8% + 15% + 20% = 43% -> 25%)', () => {
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'B',
        grams: 1000,
        batchExpiresAt: nearExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'platinum',
      });
      expect(result.totalDiscountPercent).toBe(25);
      expect(result.amountPaise).toBe(37500);
    });
  });

  describe('Integer Arithmetic & Deterministic Rounding', () => {
    test('rounds line amount to nearest integer paise deterministically', () => {
      // 1234 grams of button mushroom @ 40,000 paise/kg with Grade B (15% off)
      // Base: (1234 * 40000) / 1000 = 49360 paise
      // Discount 15%: 49360 * 0.85 = 41956 paise
      const result = calculateLinePrice({
        product: 'button',
        grade: 'B',
        grams: 1234,
        batchExpiresAt: farExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'silver',
      });
      expect(Number.isInteger(result.amountPaise)).toBe(true);
      expect(result.amountPaise).toBe(41956);
    });

    test('calculates fractional paise rounding properly', () => {
      // 333 grams of oyster @ 50,000 paise/kg with Grade A and Gold tier (5%)
      // Base: (333 * 50000) / 1000 = 16650 paise
      // 16650 * 0.95 = 15817.5 paise -> rounds to 15818 paise
      const result = calculateLinePrice({
        product: 'oyster',
        grade: 'A',
        grams: 333,
        batchExpiresAt: farExpiry,
        orderTime: baseOrderTime,
        distributorTier: 'gold',
      });
      expect(Number.isInteger(result.amountPaise)).toBe(true);
      expect(result.amountPaise).toBe(15818);
    });
  });

  describe('Order Total Calculation', () => {
    test('order total exactly equals sum of line amounts', () => {
      const lines = [
        { batchId: 'b1', grams: 5000, amountPaise: 250000 },
        { batchId: 'b2', grams: 2500, amountPaise: 118750 },
      ];
      expect(calculateOrderTotal(lines)).toBe(368750);
    });

    test('returns 0 for empty lines', () => {
      expect(calculateOrderTotal([])).toBe(0);
      expect(calculateOrderTotal(null)).toBe(0);
    });
  });
});
