# Perishable Stock & Order Allocation System (Part B)

Production-ready Node.js, Express, and MongoDB system for perishable stock management, FEFO (First Expiry, First Out) inventory allocation, and transaction-safe order reservations.

---

## Architecture Overview

- **Runtime & Framework**: Node.js, Express.js (CommonJS)
- **Database & ODM**: MongoDB Atlas Replica Set via Mongoose
- **Inventory Principle**: First Expiry, First Out (FEFO)
- **Concurrency & Safety**: MongoDB Transactions (`session.withTransaction`) + Conditional Atomic Updates (`remainingGrams >= requestedGrams`)
- **Ledger Accounting**: Append-only double-entry style stock movements (`ADDED`, `RESERVED`, `RELEASED`, `CONFIRMED`)
- **Idempotency**: Distributed request deduplication using `{ distributorId, key }` unique compound index and SHA-256 request hashing
- **Automatic Expiration**: Background worker with transactional recovery that survives process restarts

---

## Getting Started

### 1. Prerequisites

- Node.js (v18+)
- MongoDB Atlas cluster (M0 or higher with replica set enabled for transaction support)

### 2. Installation

```bash
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set the following variables:

| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP port for Express | `5000` |
| `MONGODB_URI` | MongoDB Atlas connection string with replica set | `mongodb+srv://user:pass@cluster.mongodb.net/perishable-stock?retryWrites=true&w=majority` |
| `NODE_ENV` | Environment mode | `development` / `production` / `test` |
| `PRODUCT_BASE_PRICES_PAISE` | Product base prices in paise per kg (1 INR = 100 paise) | `oyster:50000,button:40000,dried:80000` |

### 4. Running the Application

```bash
# Start in development mode
npm run dev

# Start in production mode
npm start
```

---

## Business Rules & Implementation Decisions

### Products & Shelf Life

| Product | Shelf Life | Expiry Calculation |
|---|---|---|
| `oyster` | 72 hours | `harvestedAt + 72 * 3600 * 1000` |
| `button` | 120 hours | `harvestedAt + 120 * 3600 * 1000` |
| `dried` | 180 days | `harvestedAt + 180 * 86400 * 1000` |

### IST Delivery Date Cutoff

- `deliveryDate` is interpreted as an Indian Standard Time (IST, UTC+5:30) calendar date.
- A batch is eligible only if `expiresAt >= 23:59:59.999 IST` on the specified date.
- Cutoff is computed directly in UTC (`UTC = IST - 5:30`, so 23:59:59.999 IST = 18:29:59.999 UTC) without dependency on host machine timezone or system locale.

### FEFO Allocation Strategy

1. Query all eligible batches matching `product`, `grade`, and `expiresAt >= cutoff` with `remainingGrams > 0`.
2. Sort strictly by `{ expiresAt: 1, harvestedAt: 1, _id: 1 }`.
3. If `allowPartial: false` and total available stock across eligible batches is less than requested, the request is immediately rejected with HTTP 409 (`INSUFFICIENT_STOCK`) without modifying stock or writing ledger entries.
4. Stock is allocated sequentially from the earliest expiring batch using conditional atomic decrement (`$gte` and `$inc`).
5. Grade A and Grade B batches are strictly isolated and never mixed.

### Pricing Rules & Assumptions

1. **Base Prices Configuration**: Since `POST /batches` does not provide batch-level pricing and no `Product` collection exists, base prices are managed via `PRODUCT_BASE_PRICES_PAISE` environment variable in integer paise per kilogram (defaults: Oyster = 50,000 paise/kg, Button = 40,000 paise/kg, Dried = 80,000 paise/kg).
2. **Distributor Tiers**: Mapped explicitly in `src/config/distributors.js`:
   - `silver`: 0% discount
   - `gold`: 5% discount
   - `platinum`: 8% discount
   - Unregistered distributors default to `silver`.
3. **Grade Discounts**:
   - Grade A: 0% discount
   - Grade B: 15% discount
4. **Expiry Discount**: 20% discount if less than 24 hours remain from order time to batch expiry.
5. **Maximum Discount Cap**: Total discount percentage on any single line item is strictly capped at 25% of the original base price.
6. **Integer Arithmetic & Deterministic Rounding**: All calculations are performed in integer paise using standard half-up rounding (`Math.round`) per line. The order total is the exact integer sum of line amounts.

---

## Concurrency & Reservation Safety

To eliminate race conditions, double reservations, and overselling:

1. **MongoDB Transactions**: Every stock reservation runs inside a Mongoose transaction session (`session.withTransaction`).
2. **Conditional Updates**: Deductions execute via `Batch.findOneAndUpdate({ _id, remainingGrams: { $gte: take } }, { $inc: { remainingGrams: -take } })`. If another concurrent request reduces remaining stock before commitment, the conditional update fails safely and triggers re-evaluation.
3. **Append-Only Ledger**: Every stock change creates an immutable ledger row (`ADDED`, `RESERVED`, `RELEASED`, `CONFIRMED`). Ledger documents have no `updatedAt` and are never modified or deleted.
4. **All-or-Nothing Guarantee**: If any step in order placement fails or stock is insufficient under `allowPartial: false`, the transaction is aborted cleanly.

---

## Automatic Reservation Expiry

- Orders remain in `RESERVED` status for 15 minutes (`Date.now() + 15 * 60 * 1000`).
- A background worker runs periodically (every 15 seconds) querying `{ status: 'RESERVED', reservedUntil: { $lte: new Date() } }`.
- When an expired reservation is identified, it executes an atomic transaction that:
  1. Sets order status to `EXPIRED`.
  2. Increments `remainingGrams` back into the respective batches.
  3. Writes `RELEASED` entries in the ledger.
- **Crash Recovery**: Because the worker polls MongoDB directly, unconfirmed expired reservations are cleanly released even after a server crash or restart.
- **Double-Release Prevention**: Conditional status matching ensures each expired order is released exactly once.

---

## API Reference

### 1. Create Stock Batch
`POST /batches`

**Request Body:**
```json
{
  "product": "oyster",
  "grade": "A",
  "grams": 50000,
  "harvestedAt": "2026-11-21T06:00:00+05:30"
}
```

**Response (201 Created):**
```json
{
  "batchId": "655f...",
  "product": "oyster",
  "grade": "A",
  "totalGrams": 50000,
  "remainingGrams": 50000,
  "harvestedAt": "2026-11-21T00:30:00.000Z",
  "expiresAt": "2026-11-24T00:30:00.000Z"
}
```

---

### 2. Place / Reserve Order
`POST /orders`

**Headers:**
- `X-Distributor-Id`: e.g. `dist-gold-01`
- `Idempotency-Key`: e.g. `uuid-v4-or-unique-string`

**Request Body:**
```json
{
  "product": "oyster",
  "grade": "A",
  "grams": 12500,
  "deliveryDate": "2026-11-22",
  "allowPartial": false
}
```

**Response (201 Created):**
```json
{
  "orderId": "655f...",
  "status": "RESERVED",
  "reservedUntil": "2026-11-22T10:15:00.000Z",
  "lines": [
    {
      "batchId": "655f...",
      "grams": 12500,
      "amountPaise": 593750
    }
  ],
  "totalPaise": 593750,
  "shortfallGrams": 0
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input or missing headers
- `409 Conflict`: `{"error": "INSUFFICIENT_STOCK"}`
- `422 Unprocessable Entity`: `{"error": "IDEMPOTENCY_KEY_REUSED"}`

---

### 3. Confirm Reservation
`POST /orders/:id/confirm`

**Response (200 OK):**
```json
{
  "orderId": "655f...",
  "status": "CONFIRMED"
}
```

**Error Response:**
- `410 Gone`: `{"error": "RESERVATION_EXPIRED"}`

---

### 4. Stock Reconciliation
`GET /reconcile`

Rebuilds expected stock balances from the immutable ledger and compares them against `Batch.remainingGrams`.

**Response (200 OK):**
```json
{
  "reconciled": true,
  "totalBatchesChecked": 12,
  "mismatchCount": 0,
  "mismatches": []
}
```

---

## Running Automated Tests & Race Script

### Automated Unit & Integration Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Race-Condition Test

The race script proves concurrency safety under high load:
1. Seeds 10 kg (10,000 grams) in a test batch.
2. Dispatches 50 simultaneous order requests of 1 kg each.
3. Asserts total allocated stock never exceeds 10,000 grams.
4. Cleans up all test artifacts.

```bash
npm run race
```
