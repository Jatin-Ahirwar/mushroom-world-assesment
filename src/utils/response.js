function sendSuccess(res, statusCode, data) {
  return res.status(statusCode).json(data);
}

function sendError(res, statusCode, error, message) {
  const body = { error };
  if (message && process.env.NODE_ENV !== 'production') {
    body.message = message;
  }
  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess, sendError };
