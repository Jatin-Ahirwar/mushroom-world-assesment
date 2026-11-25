const { ZodError } = require('zod');

function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError || err.name === 'ZodError') {
    const body = { error: 'INVALID_INPUT' };
    if (process.env.NODE_ENV !== 'production') {
      const issues = err.issues || err.errors || [];
      body.message = issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
    }
    return res.status(400).json(body);
  }

  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_ERROR';
  const body = { error: errorCode };

  if (process.env.NODE_ENV !== 'production' && statusCode < 500) {
    body.message = err.message;
  }

  if (statusCode >= 500) {
    console.error(`[ERROR] ${err.message}`, err.stack);
  }

  return res.status(statusCode).json(body);
}

class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.name = 'AppError';
  }
}

module.exports = { errorMiddleware, AppError };
