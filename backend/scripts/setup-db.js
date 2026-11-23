// scripts/setup-db.js
// Sets up the PostgreSQL database by running schema.sql, seed.sql, and creating a demo user.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function setupDatabase() {
  console.log('--- TripSketch Database Setup ---');

  try {
    // 1. Path to SQL files in database/ directory
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const seedPath = path.join(__dirname, '../../database/seed.sql');

    if (!fs.existsSync(schemaPath) || !fs.existsSync(seedPath)) {
      throw new Error(`Schema or seed file not found. Checked:\n  ${schemaPath}\n  ${seedPath}`);
    }

    // 2. Read schema.sql
    console.log('Reading and executing database/schema.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schemaSql);
    console.log(' Schema created successfully (12 tables + indexes).');

    // 3. Read seed.sql
    console.log('Reading and executing database/seed.sql...');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await db.query(seedSql);
    console.log(' Seed data inserted successfully (lookup values + 24 authentic spots + tags).');

    // 4. Insert or update demo user
    console.log('Configuring demo user (demo@tripsketch.com / demo1234)...');
    const demoEmail = 'demo@tripsketch.com';
    const demoPassword = 'demo1234';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(demoPassword, saltRounds);

    const userSql = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT (email)
      DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
      RETURNING user_id, name, email;
    `;
    const userResult = await db.query(userSql, ['Demo Traveler', demoEmail, passwordHash]);
    const demoUser = userResult.rows[0];
    console.log(` Demo user ready (ID: ${demoUser.user_id}, Email: ${demoUser.email}).`);

    console.log('--- Database Setup Completed Successfully! ---');
  } catch (err) {
    console.error('Error during database setup:', err);
    process.exitCode = 1;
  } finally {
    // Always close database pool connection so the process terminates
    await db.pool.end();
  }
}

setupDatabase();
