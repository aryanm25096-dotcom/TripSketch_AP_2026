// config/db.js
// Manages the connection pool to PostgreSQL using the pg library.

const { Pool } = require('pg');
require('dotenv').config();

// Create a new connection pool using the DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connection and log any errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Helper function to run SQL queries with parameters
const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query,
};
