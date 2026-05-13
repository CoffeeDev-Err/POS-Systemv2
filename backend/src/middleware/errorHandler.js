function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Unexpected error.';
  res.status(status).json({ message });
}

module.exports = { errorHandler };
