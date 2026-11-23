const mongoose = require('mongoose');
const Batch = require('../src/models/Batch');
const Order = require('../src/models/Order');
const Ledger = require('../src/models/Ledger');
const { allocateStock } = require('../src/services/allocationService');
const { createOrderReservation } = require('../src/services/reservationService');

jest.setTimeout(30000);

describe('Allocation Service & Concurrency Safety', () => {
  const testDistributor = 'dist-alloc-test';

  beforeAll(async () => {
    require('dotenv').config();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    }
  }, 30000);

  afterAll(async () => {
    await Batch.deleteMany({ product: 'oyster' });
    await Order.deleteMany({ distributorId: testDistributor });
    await Ledger.deleteMany({});
    await mongoose.disconnect();
  }, 30000);

  beforeEach(async () => {
    await Batch.deleteMany({ product: 'oyster' });
    await Order.deleteMany({ distributorId: testDistributor });
    await Ledger.deleteMany({});
  }, 30000);

  test('allocates stock using FEFO (First Expiry, First Out)', async () => {
    const b1 = await Batch.create({
      product: 'oyster',
      grade: 'A',
      harvestedAt: new Date('2026-11-20T00:00:00.000Z'),
      expiresAt: new Date('2026-11-23T00:00:00.000Z'),
      totalGrams: 10000,
      remainingGrams: 10000,
    });

    const b2 = await Batch.create({
      product: 'oyster',
      grade: 'A',
      harvestedAt: new Date('2026-11-21T00:00:00.000Z'),
      expiresAt: new Date('2026-11-24T00:00:00.000Z'),
      totalGrams: 20000,
      remainingGrams: 20000,
    });

    const session = await mongoose.startSession();
    let allocation;
    await session.withTransaction(async () => {
      allocation = await allocateStock({
        distributorId: testDistributor,
        product: 'oyster',
        grade: 'A',
        grams: 5000,
        deliveryDate: '2026-11-22',
        session,
      });
    });
    await session.endSession();

    expect(allocation.lines).toHaveLength(1);
    expect(allocation.lines[0].batchId.toString()).toBe(b1._id.toString());
    expect(allocation.lines[0].grams).toBe(5000);

    const freshB1 = await Batch.findById(b1._id);
    const freshB2 = await Batch.findById(b2._id);
    expect(freshB1.remainingGrams).toBe(5000);
    expect(freshB2.remainingGrams).toBe(20000);
  });

  test('splits order across multiple batches when needed', async () => {
    const b1 = await Batch.create({
      product: 'oyster',
      grade: 'A',
      harvestedAt: new Date('2026-11-20T00:00:00.000Z'),
      expiresAt: new Date('2026-11-23T00:00:00.000Z'),
      totalGrams: 5000,
      remainingGrams: 5000,
    });

    const b2 = await Batch.create({
      product: 'oyster',
      grade: 'A',
      harvestedAt: new Date('2026-11-21T00:00:00.000Z'),
      expiresAt: new Date('2026-11-24T00:00:00.000Z'),
      totalGrams: 15000,
      remainingGrams: 15000,
    });

    const session = await mongoose.startSession();
    let allocation;
    await session.withTransaction(async () => {
      allocation = await allocateStock({
        distributorId: testDistributor,
        product: 'oyster',
        grade: 'A',
        grams: 12000,
        deliveryDate: '2026-11-22',
        session,
      });
    });
    await session.endSession();

    expect(allocation.lines).toHaveLength(2);
    expect(allocation.lines[0].batchId.toString()).toBe(b1._id.toString());
    expect(allocation.lines[0].grams).toBe(5000);
    expect(allocation.lines[1].batchId.toString()).toBe(b2._id.toString());
    expect(allocation.lines[1].grams).toBe(7000);
    expect(allocation.allocatedGrams).toBe(12000);
    expect(allocation.shortfallGrams).toBe(0);
  });

  test('strictly enforces grade separation (Grade A and B are never mixed)', async () => {
    await Batch.create({
      product: 'oyster',
      grade: 'A',
      harvestedAt: new Date('2026-11-20T00:00:00.000Z'),
      expiresAt: new Date('2026-11-23T00:00:00.000Z'),
      totalGrams: 5000,
      remainingGrams: 5000,
    });

    await Batch.create({
      product: 'oyster',
      grade: 'B',
      harvestedAt: new Date('2026-11-20T00:00:00.000Z'),
      expiresAt: new Date('2026-11-23T00:00:00.000Z'),
      totalGrams: 20000,
      remainingGrams: 20000,
    });

    const session = await mongoose.startSession();
    await expect(
      session.withTransaction(async () => {
        await allocateStock({
          distributorId: testDistributor,
          product: 'oyster',
          grade: 'A',
          grams: 10000,
          deliveryDate: '2026-11-22',
          allowPartial: false,
          session,
        });
      })
    ).rejects.toThrow('Insufficient stock');
    await session.endSession();
  });

  test('handles partial allocation when allowPartial is true', async () => {
    const b1 = await Batch.create({
      product: 'oyster',
      grade: 'A',
      harvestedAt: new Date('2026-11-20T00:00:00.000Z'),
      expiresAt: new Date('2026-11-23T00:00:00.000Z'),
      totalGrams: 7000,
      remainingGrams: 7000,
    });

    const session = await mongoose.startSession();
    let allocation;
    await session.withTransaction(async () => {
      allocation = await allocateStock({
        distributorId: testDistributor,
        product: 'oyster',
        grade: 'A',
        grams: 10000,
        deliveryDate: '2026-11-22',
        allowPartial: true,
        session,
      });
    });
    await session.endSession();

    expect(allocation.allocatedGrams).toBe(7000);
    expect(allocation.shortfallGrams).toBe(3000);
    expect(allocation.lines[0].grams).toBe(7000);

    const freshB1 = await Batch.findById(b1._id);
    expect(freshB1.remainingGrams).toBe(0);
  });

  test('rejects without allocating anything when stock is insufficient and allowPartial is false', async () => {
    const b1 = await Batch.create({
      product: 'oyster',
      grade: 'A',
      harvestedAt: new Date('2026-11-20T00:00:00.000Z'),
      expiresAt: new Date('2026-11-23T00:00:00.000Z'),
      totalGrams: 5000,
      remainingGrams: 5000,
    });

    await expect(
      createOrderReservation({
        distributorId: testDistributor,
        product: 'oyster',
        grade: 'A',
        grams: 10000,
        deliveryDate: '2026-11-22',
        allowPartial: false,
        requestBody: { product: 'oyster', grade: 'A', grams: 10000 },
      })
    ).rejects.toThrow('Insufficient stock');

    const freshB1 = await Batch.findById(b1._id);
    expect(freshB1.remainingGrams).toBe(5000);

    const orders = await Order.find({ distributorId: testDistributor });
    expect(orders).toHaveLength(0);

    const ledgers = await Ledger.find({ batchId: b1._id });
    expect(ledgers).toHaveLength(0);
  });

  test('concurrent allocation safety: prevents negative stock and overselling', async () => {
    const b = await Batch.create({
      product: 'oyster',
      grade: 'A',
      harvestedAt: new Date('2026-11-20T00:00:00.000Z'),
      expiresAt: new Date('2026-11-23T00:00:00.000Z'),
      totalGrams: 5000,
      remainingGrams: 5000,
    });

    const promises = Array.from({ length: 5 }, (_, i) =>
      createOrderReservation({
        distributorId: testDistributor,
        product: 'oyster',
        grade: 'A',
        grams: 2000,
        deliveryDate: '2026-11-22',
        allowPartial: false,
        idempotencyKey: `race-test-${Date.now()}-${i}`,
        requestBody: { orderNum: i, grams: 2000 },
      })
        .then((res) => ({ success: true, res }))
        .catch((err) => ({ success: false, error: err.errorCode || err.message }))
    );

    const results = await Promise.all(promises);
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    expect(successful.length).toBeLessThanOrEqual(2);
    expect(failed.length).toBeGreaterThanOrEqual(3);

    const freshBatch = await Batch.findById(b._id);
    expect(freshBatch.remainingGrams).toBeGreaterThanOrEqual(0);
    expect(freshBatch.remainingGrams).toBe(5000 - successful.length * 2000);
  });
});
