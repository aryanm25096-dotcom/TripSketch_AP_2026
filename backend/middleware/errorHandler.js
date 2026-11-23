// middleware/errorHandler.js
// Centralized error-handling middleware that returns clean JSON responses.

// Express error-handling middleware has 4 arguments: (err, req, res, next)
const errorHandler = (err, req, res, next) => {
  console.error('Server error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
};

module.exports = errorHandler;
