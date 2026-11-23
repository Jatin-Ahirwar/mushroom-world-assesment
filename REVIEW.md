# Code Review

## 1. Async Handling

**Old:**

```js
batches.forEach(async (batch) => {
  await batch.save();
});
```

**New:**

```js
for (const batch of batches) {
  await batch.save();
}
```

**Difference:** Waits for all database operations before continuing.

## 2. Reservation Expiry

**Old:**

```js
Date.now() + 15 * 60;
```

**New:**

```js
Date.now() + 15 * 60 * 1000;
```

**Difference:** Correctly sets the reservation expiry to 15 minutes.

## 3. Stock Consistency

**Old:**

```js
await batch.save();
const order = await Order.create(orderData);
```

**New:**

```js
await session.withTransaction(async () => {
  await batch.save({ session });
  await Order.create([orderData], { session });
});
```

**Difference:** Both operations succeed or roll back together.

## 4. Batch Selection (FEFO)

**Old:**

```js
.sort({ harvestedAt: 1 })
```

**New:**

```js
.sort({ expiresAt: 1, harvestedAt: 1 })
```

**Difference:** Prioritizes batches that expire earlier.

## 5. Partial Order Validation

**Old:**

```js
if (needed > 0 && !allowPartial) {
  throw new Error("Insufficient stock");
}
```

**New:**

```js
if (needed > 0 && !allowPartial) {
  throw new Error("Insufficient stock");
}

if (lines.length === 0) {
  throw new Error("No stock available");
}
```

**Difference:** Also prevents creating orders when no stock is available.

## 6. Concurrent Stock Updates

**Old:**

```js
batch.remainingGrams -= take;
await batch.save();
```

**New:**

```js
await Batch.updateOne(
  {
    _id: batch._id,
    remainingGrams: { $gte: take },
  },
  {
    $inc: { remainingGrams: -take },
  },
);
```

**Difference:** Prevents stock from being reduced below the requested quantity. Check `modifiedCount` to confirm the update succeeded.

## 7. Price Validation

**Old:**

```js
const perKg = batch.product.basePricePerKg;
```

**New:**

```js
const perKg = batch.product.basePricePerKg;

if (typeof perKg !== "number" || !Number.isFinite(perKg) || perKg < 0) {
  throw new Error("Invalid product price");
}
```

**Difference:** Avoids incorrect calculations due to invalid product prices.
