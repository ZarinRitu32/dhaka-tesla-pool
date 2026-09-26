// Central error handler. Every route uses express-async-errors so thrown/rejected
// errors land here instead of crashing the process or hanging the request.
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ error: err.message || "Internal server error" });
};
