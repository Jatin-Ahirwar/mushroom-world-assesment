/**
 * Standardised API response helpers.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {object} data
 */
function sendSuccess(res, statusCode, data) {
  return res.status(statusCode).json(data);
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} error - Machine-readable error code
 * @param {string} [message] - Human-readable message (omitted in production)
 */
function sendError(res, statusCode, error, message) {
  const body = { error };
  if (message && process.env.NODE_ENV !== 'production') {
    body.message = message;
  }
  return res.status(statusCode).json(body);
}

module.exports = {
  sendSuccess,
  sendError,
};
