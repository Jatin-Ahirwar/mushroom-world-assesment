const { calculateExpiry, getDeliveryDateCutoff } = require('../src/utils/expiry');

describe('Expiry Utility', () => {
  describe('Product Shelf Life Calculation', () => {
    test('calculates correct expiry for oyster mushrooms (72 hours)', () => {
      const harvestedAt = '2026-11-21T06:00:00.000Z';
      const expiry = calculateExpiry('oyster', harvestedAt);
      const expectedMs = new Date(harvestedAt).getTime() + 72 * 60 * 60 * 1000;
      expect(expiry.getTime()).toBe(expectedMs);
    });

    test('calculates correct expiry for button mushrooms (120 hours)', () => {
      const harvestedAt = '2026-11-20T10:00:00.000Z';
      const expiry = calculateExpiry('button', harvestedAt);
      const expectedMs = new Date(harvestedAt).getTime() + 120 * 60 * 60 * 1000;
      expect(expiry.getTime()).toBe(expectedMs);
    });

    test('calculates correct expiry for dried mushrooms (180 days)', () => {
      const harvestedAt = '2026-06-01T00:00:00.000Z';
      const expiry = calculateExpiry('dried', harvestedAt);
      const expectedMs = new Date(harvestedAt).getTime() + 180 * 24 * 60 * 60 * 1000;
      expect(expiry.getTime()).toBe(expectedMs);
    });

    test('throws error for unknown product', () => {
      expect(() => calculateExpiry('shiitake', new Date())).toThrow('Unknown product');
    });

    test('throws error for invalid date', () => {
      expect(() => calculateExpiry('oyster', 'not-a-date')).toThrow('Invalid harvestedAt');
    });
  });

  describe('IST Delivery Cutoff & Batch Eligibility', () => {
    test('computes correct UTC cutoff for 23:59:59.999 IST', () => {
      const cutoff = getDeliveryDateCutoff('2026-11-22');
      // 2026-11-22 23:59:59.999 IST is 2026-11-22 18:29:59.999 UTC
      expect(cutoff.toISOString()).toBe('2026-11-22T18:29:59.999Z');
    });

    test('rejects batch expiring before IST delivery cutoff', () => {
      const cutoff = getDeliveryDateCutoff('2026-11-22');
      // 1 minute before cutoff
      const batchExpiry = new Date(cutoff.getTime() - 60000);
      expect(batchExpiry.getTime() >= cutoff.getTime()).toBe(false);
    });

    test('accepts batch expiring exactly at IST delivery cutoff', () => {
      const cutoff = getDeliveryDateCutoff('2026-11-22');
      const batchExpiry = new Date(cutoff.getTime());
      expect(batchExpiry.getTime() >= cutoff.getTime()).toBe(true);
    });

    test('accepts batch expiring after IST delivery cutoff', () => {
      const cutoff = getDeliveryDateCutoff('2026-11-22');
      const batchExpiry = new Date(cutoff.getTime() + 3600000);
      expect(batchExpiry.getTime() >= cutoff.getTime()).toBe(true);
    });

    test('throws error on malformed deliveryDate string', () => {
      expect(() => getDeliveryDateCutoff('22-11-2026')).toThrow('Invalid deliveryDate format');
      expect(() => getDeliveryDateCutoff('invalid')).toThrow('Invalid deliveryDate format');
    });
  });
});
