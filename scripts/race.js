require('dotenv').config();
const mongoose = require('mongoose');
const Batch = require('../src/models/Batch');
const Order = require('../src/models/Order');
const Ledger = require('../src/models/Ledger');
const Idempotency = require('../src/models/Idempotency');
const { createOrderReservation } = require('../src/services/reservationService');

async function runRaceTest() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB Atlas');

  const runId = Date.now();
  const testDistributorId = `dist-race-${runId}`;

  try {
    // 1. Create a controlled batch of 10 kg (10,000 grams)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const deliveryDate = tomorrow.toISOString().split('T')[0];

    const testBatch = await Batch.create({
      product: 'oyster',
      grade: 'A',
      harvestedAt: now,
      expiresAt,
      totalGrams: 10000,
      remainingGrams: 10000,
    });

    await Ledger.create({
      batchId: testBatch._id,
      movementType: 'ADDED',
      grams: 10000,
    });

    console.log(`Created test batch ${testBatch._id} with 10,000g stock`);
    console.log('Firing 50 parallel orders of 1,000g each...');

    // 2. Fire 50 parallel orders of 1,000g each
    const orderPromises = Array.from({ length: 50 }, (_, i) => {
      const idempotencyKey = `race-${runId}-order-${i}`;
      return createOrderReservation({
        distributorId: testDistributorId,
        product: 'oyster',
        grade: 'A',
        grams: 1000,
        deliveryDate,
        allowPartial: false,
        idempotencyKey,
        requestBody: { runId, orderIndex: i, grams: 1000 },
      });
    });

    // 3. Wait for all requests to finish
    const results = await Promise.allSettled(orderPromises);

    // 4. Calculate total allocated stock
    let successfulOrders = 0;
    let failedOrders = 0;
    let totalAllocatedGrams = 0;

    for (const res of results) {
      if (res.status === 'fulfilled') {
        successfulOrders++;
        totalAllocatedGrams += res.value.response.lines.reduce((s, l) => s + l.grams, 0);
      } else {
        failedOrders++;
      }
    }

    // Check DB state
    const freshBatch = await Batch.findById(testBatch._id);

    // 5. Print results
    console.log('\n=== RACE TEST RESULTS ===');
    console.log(`Initial stock:          10,000 grams`);
    console.log(`Total orders fired:     50 (1,000g each)`);
    console.log(`Successful orders:      ${successfulOrders}`);
    console.log(`Failed / rejected:      ${failedOrders}`);
    console.log(`Total allocated stock:  ${totalAllocatedGrams} grams`);
    console.log(`Remaining batch stock:  ${freshBatch.remainingGrams} grams`);

    // 6. Verification
    if (totalAllocatedGrams > 10000) {
      console.error(`\n❌ OVERSELLING DETECTED! Total allocated: ${totalAllocatedGrams}g > 10,000g`);
      process.exit(1);
    }

    if (freshBatch.remainingGrams < 0) {
      console.error(`\n❌ NEGATIVE STOCK DETECTED! Remaining: ${freshBatch.remainingGrams}g`);
      process.exit(1);
    }

    if (totalAllocatedGrams + freshBatch.remainingGrams !== 10000) {
      console.error(`\n❌ STOCK CONSERVATION VIOLATED!`);
      process.exit(1);
    }

    console.log('\n✅ VERIFICATION PASSED: No overselling occurred. Stock conservation holds.');

    // Cleanup test data
    await Batch.deleteOne({ _id: testBatch._id });
    await Order.deleteMany({ distributorId: testDistributorId });
    await Ledger.deleteMany({ batchId: testBatch._id });
    await Idempotency.deleteMany({ distributorId: testDistributorId });
    console.log('Cleaned up race test records.');
  } finally {
    await mongoose.disconnect();
  }
}

runRaceTest().catch((err) => {
  console.error('Race test failed:', err);
  process.exit(1);
});
