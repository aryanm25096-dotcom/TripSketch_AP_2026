// routes/auth.js
// Handles user registration, login, and profile fetching with bcrypt and JWT.

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Helper to generate a 7-day JWT token
const generateToken = (userId, email) => {
  const secret = process.env.JWT_SECRET || 'tripsketch_default_secret_key';
  return jwt.sign({ userId, email }, secret, { expiresIn: '7d' });
};

// Simple email validation regex
const isValidEmail = (email) => {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// POST /api/auth/register - Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await db.query('SELECT user_id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash the password with bcrypt (salt rounds = 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user into PostgreSQL
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, name, email, created_at',
      [name.trim(), normalizedEmail, passwordHash]
    );

    const newUser = result.rows[0];
    const token = generateToken(newUser.user_id, newUser.email);

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.user_id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login - Authenticate existing user and return JWT
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Query user by email
    const result = await db.query(
      'SELECT user_id, name, email, password_hash, created_at FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Compare provided password with stored bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.user_id, user.email);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me - Get currently authenticated user's profile
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT user_id, name, email, created_at FROM users WHERE user_id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    return res.status(200).json({
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
