/**
 * Reservation service: handles automatic reservation expiry.
 * Full implementation in Phase 5.
 */

/**
 * Start the periodic worker that expires stale reservations.
 * Uses setInterval to poll MongoDB every 60 seconds for RESERVED orders
 * whose reservedUntil has passed. This survives server restarts because
 * it re-queries MongoDB on each tick rather than relying on in-memory timers.
 */
function startExpirationWorker() {
  // Will be implemented in Phase 5
}

module.exports = {
  startExpirationWorker,
};
