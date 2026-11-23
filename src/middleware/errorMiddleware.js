/**
 * Centralised error-handling middleware.
 *
 * Catches all errors thrown or passed via next(err) in controllers/services.
 * Maps known application errors to proper HTTP status codes.
 * Never exposes database errors or stack traces in production.
 */

function errorMiddleware(err, req, res, _next) {
  // If response headers have already been sent, delegate to Express default
  if (res.headersSent) {
    return _next(err);
  }

  // Application errors carry a statusCode property
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_ERROR';

  const body = { error: errorCode };

  // Include human-readable message only in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    body.message = err.message;
    body.stack = err.stack;
  }

  // Log unexpected errors
  if (statusCode >= 500) {
    console.error(`[ERROR] ${err.message}`, err.stack);
  }

  return res.status(statusCode).json(body);
}

/**
 * Factory for application errors with status code and error code.
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.name = 'AppError';
  }
}

module.exports = {
  errorMiddleware,
  AppError,
};
