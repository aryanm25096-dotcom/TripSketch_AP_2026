// server.js
// Main entry point for the TripSketch Express API server.

const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
// The other routes will be imported as they are created
let spotsRoutes, favouritesRoutes, itinerariesRoutes, recentRoutes, aiRoutes;
try { spotsRoutes = require('./routes/spots'); } catch (e) {}
try { favouritesRoutes = require('./routes/favourites'); } catch (e) {}
try { itinerariesRoutes = require('./routes/itineraries'); } catch (e) {}
try { recentRoutes = require('./routes/recent'); } catch (e) {}
try { aiRoutes = require('./routes/ai'); } catch (e) {}

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '127.0.0.1';

// Middleware: Enable CORS for the Vite React frontend (http://localhost:5173) and curl/Postman
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

// Middleware: Parse JSON request bodies
app.use(express.json());

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'TripSketch API is up and running' });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
if (spotsRoutes) app.use('/api/spots', spotsRoutes);
if (favouritesRoutes) app.use('/api/favourites', favouritesRoutes);
if (itinerariesRoutes) app.use('/api/itineraries', itinerariesRoutes);
if (recentRoutes) app.use('/api/recent', recentRoutes);
if (aiRoutes) app.use('/api/ai', aiRoutes);

// Central error-handling middleware
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`TripSketch backend server running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
