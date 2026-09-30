const { ZodError } = require("zod");

// Central error handler. Every route uses express-async-errors so thrown/rejected
// errors land here instead of crashing the process or hanging the request.
module.exports = function errorHandler(err, req, res, next) {
  if (err instanceof ZodError || err.name === "ZodError") {
    return res.status(400).json({
      error: "Validation error",
      details: err.errors || err.issues,
    });
  }

  const status = err.status || 500;
  if (status >= 500 && process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  return res
    .status(status)
    .json({ error: err.message || "Internal server error" });
};
