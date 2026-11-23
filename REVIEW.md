
# Code Review – Order Service

## 1. Async Handling

**Problem:** `forEach(async ...)` does not wait for async operations.

**Production Impact:** Order may be created before batch updates finish, resulting in incorrect order details.

**Severity:** High

**Fix:**
```js
for (const batch of batches) {
    await batch.save();
}
```

## 2. Reservation Expiry

**Problem:** Incorrect time calculation (`15 * 60`).

**Production Impact:** Reservations expire after 900 milliseconds instead of 15 minutes.

**Severity:** High

**Fix:**
```js
Date.now() + 15 * 60 * 1000
```

## 3. Stock Consistency

**Problem:** Stock updates and order creation are not handled in a transaction.

**Production Impact:** Stock may be deducted even if order creation fails.

**Severity:** High

**Fix:** Use MongoDB transactions to handle stock updates and order creation together.

```js
await session.withTransaction(async () => {
    // Update stock and create order
});
```

## 4. Batch Selection (FEFO)

**Problem:** Batches are sorted by `harvestedAt` instead of expiry date.

**Production Impact:** Batches expiring earlier may remain unused while newer batches are allocated.

**Severity:** Medium

**Fix:**
```js
.sort({ expiresAt: 1, harvestedAt: 1 })
```

## 5. Concurrent Stock Updates

**Problem:** Stock is updated without checking whether enough stock is still available.

**Production Impact:** Multiple orders may reserve the same stock, causing incorrect inventory quantities.

**Severity:** High

**Fix:** Use conditional atomic updates.

```js
{
    _id: batch._id,
    remainingGrams: { $gte: take }
}
```

## 6. Partial Order Validation

**Problem:** No check for an empty allocation before creating an order.

**Production Impact:** An order with no stock lines and a zero total could be created.

**Severity:** Medium

**Fix:**
```js
if (lines.length === 0) {
    throw new Error("No stock available");
}
```

## 7. Product Price Access

**Problem:** `batch.product.basePricePerKg` assumes product data is available.

**Production Impact:** If `product` is only an ObjectId, price calculation may return an undefined value or produce `NaN`.

**Severity:** High

**Fix:** Populate the product reference or fetch its price separately before calculating the order total.
