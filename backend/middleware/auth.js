// middleware/auth.js
// Verifies JSON Web Token (JWT) from the Authorization header to protect private routes.

const jwt = require('jsonwebtoken');

// Middleware to check for a valid Bearer token in the request header
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // The header format is "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'tripsketch_default_secret_key';
    const decoded = jwt.verify(token, secret);
    // Attach decoded user info ({ userId, email }) to the request object
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = authenticateToken;
