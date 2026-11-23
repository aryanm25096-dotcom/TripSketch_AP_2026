// routes/recent.js
// Handles recently viewed spots for authenticated users.

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Protect all recent routes
router.use(authenticateToken);

// Helper to format a spot row into frontend shape
const formatSpot = (row) => ({
  id: row.spot_id,
  name: row.name,
  location: `${row.area_name}, ${row.state_name}`,
  vibe: row.vibe_name ? row.vibe_name.charAt(0).toUpperCase() + row.vibe_name.slice(1).toLowerCase() : '',
  budget: Number(row.budget_per_day),
  crowdLevel: row.crowd_level_name ? row.crowd_level_name.charAt(0).toUpperCase() + row.crowd_level_name.slice(1).toLowerCase() : '',
  tags: Array.isArray(row.tags) ? row.tags : [],
  rating: Number(row.rating),
  popularity: Number(row.popularity),
  description: row.description,
  image: row.image_url,
  imageKeyword: row.image_keyword,
  viewedAt: row.viewed_at,
});

// POST /api/recent/:spotId - Record that a user viewed a spot (upserts viewed_at timestamp)
router.post('/:spotId', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const spotId = parseInt(req.params.spotId, 10);

    if (isNaN(spotId)) {
      return res.status(400).json({ error: 'Invalid spot ID' });
    }

    // Verify spot exists
    const spotCheck = await db.query('SELECT spot_id FROM spots WHERE spot_id = $1', [spotId]);
    if (spotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    // Upsert into recently_viewed table
    const sql = `
      INSERT INTO recently_viewed (user_id, spot_id, viewed_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, spot_id)
      DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
    `;
    await db.query(sql, [userId, spotId]);

    res.status(200).json({ message: 'Recorded view', spotId });
  } catch (err) {
    next(err);
  }
});

// GET /api/recent - Get the last 5 recently viewed spots for the authenticated user (newest first)
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const sql = `
      SELECT 
        s.spot_id,
        s.name,
        s.budget_per_day,
        s.rating,
        s.popularity,
        s.description,
        s.image_url,
        s.image_keyword,
        l.area_name,
        st.name AS state_name,
        v.name AS vibe_name,
        cl.name AS crowd_level_name,
        rv.viewed_at,
        COALESCE(
          array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
          '{}'
        ) AS tags
      FROM recently_viewed rv
      JOIN spots s ON rv.spot_id = s.spot_id
      JOIN locations l ON s.location_id = l.location_id
      JOIN states st ON l.state_id = st.state_id
      JOIN vibes v ON s.vibe_id = v.vibe_id
      JOIN crowd_levels cl ON s.crowd_level_id = cl.crowd_level_id
      LEFT JOIN spot_tags stg ON s.spot_id = stg.spot_id
      LEFT JOIN tags t ON stg.tag_id = t.tag_id
      WHERE rv.user_id = $1
      GROUP BY s.spot_id, l.area_name, st.name, v.name, cl.name, rv.viewed_at
      ORDER BY rv.viewed_at DESC
      LIMIT 5
    `;

    const result = await db.query(sql, [userId]);
    const recentSpots = result.rows.map(formatSpot);

    res.status(200).json(recentSpots);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
