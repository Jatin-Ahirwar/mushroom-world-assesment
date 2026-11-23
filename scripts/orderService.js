// orderService.js

const Batch = require("./models/Batch");
const Order = require("./models/Order");

async function placeOrder({
  distributorId,
  product,
  grade,
  qtyKg,
  deliveryDate,
  allowPartial,
}) {
  const batches = await Batch.find({
    product,
    grade,
    expiresAt: { $gte: new Date(deliveryDate) },
    remainingGrams: { $gt: 0 },
  }).sort({ harvestedAt: 1 });

  let needed = qtyKg * 1000;
  const lines = [];

  batches.forEach(async (b) => {
    if (needed <= 0) return;

    const take = Math.min(b.remainingGrams, needed);

    b.remainingGrams -= take;
    await b.save();

    lines.push({
      batchId: b._id,
      grams: take,
      price: priceFor(b, take),
    });

    needed -= take;
  });

  if (needed > 0 && !allowPartial) {
    throw new Error("Insufficient stock");
  }

  const total = lines.reduce((sum, l) => sum + l.price, 0);

  return Order.create({
    distributorId,
    lines,
    total,
    status: "RESERVED",
    reservedUntil: Date.now() + 15 * 60,
  });
}

function priceFor(batch, grams) {
  const perKg = batch.product.basePricePerKg;

  let price = (grams / 1000) * perKg;

  if (batch.grade === "B") {
    price = price * 0.85;
  }

  const hoursLeft = (batch.expiresAt - Date.now()) / 3600000;

  if (hoursLeft < 24) {
    price = price - price * 0.2;
  }

  return Math.round(price * 100) / 100;
}

module.exports = { placeOrder };
