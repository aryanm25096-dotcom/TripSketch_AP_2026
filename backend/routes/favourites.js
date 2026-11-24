// routes/favourites.js
// Handles user saved/favourite spots (requires JWT authentication).

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Protect all favourite routes
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
  savedAt: row.saved_at,
});

// GET /api/favourites - List all favourite spots saved by the authenticated user
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
        f.saved_at,
        COALESCE(
          array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
          '{}'
        ) AS tags
      FROM favourites f
      JOIN spots s ON f.spot_id = s.spot_id
      JOIN locations l ON s.location_id = l.location_id
      JOIN states st ON l.state_id = st.state_id
      JOIN vibes v ON s.vibe_id = v.vibe_id
      JOIN crowd_levels cl ON s.crowd_level_id = cl.crowd_level_id
      LEFT JOIN spot_tags stg ON s.spot_id = stg.spot_id
      LEFT JOIN tags t ON stg.tag_id = t.tag_id
      WHERE f.user_id = $1
      GROUP BY s.spot_id, l.area_name, st.name, v.name, cl.name, f.saved_at
      ORDER BY f.saved_at DESC
    `;

    const result = await db.query(sql, [userId]);
    const favourites = result.rows.map(formatSpot);

    res.status(200).json(favourites);
  } catch (err) {
    next(err);
  }
});

// POST /api/favourites/:spotId or /api/favourites - Save a spot to user favourites
router.post(['/', '/:spotId'], async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const rawSpotId = req.params.spotId || req.body.spotId || req.body.spot?.id;
    const spotId = parseInt(rawSpotId, 10);

    let finalSpotId = spotId;

    // Check if spot exists in database
    let spotCheck = !isNaN(spotId) 
      ? await db.query('SELECT spot_id FROM spots WHERE spot_id = $1', [spotId])
      : { rows: [] };

    // If spot doesn't exist yet (e.g. dynamic AI-generated spot), safely upsert it
    if (spotCheck.rows.length === 0) {
      const s = req.body.spot || req.body;
      if (s && s.name) {
        const locResult = await db.query('SELECT location_id FROM locations LIMIT 1');
        const vibeResult = await db.query('SELECT vibe_id FROM vibes WHERE LOWER(name) = LOWER($1) LIMIT 1', [s.vibe || 'Nature']);
        const crowdResult = await db.query('SELECT crowd_level_id FROM crowd_levels LIMIT 1');

        const locId = locResult.rows[0]?.location_id || 1;
        const vibeId = vibeResult.rows[0]?.vibe_id || 1;
        const crowdId = crowdResult.rows[0]?.crowd_level_id || 1;

        const insertSpot = await db.query(
          `INSERT INTO spots (name, location_id, vibe_id, crowd_level_id, budget_per_day, rating, popularity, description, image_url, image_keyword)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (name, location_id) DO UPDATE SET image_url = EXCLUDED.image_url
           RETURNING spot_id`,
          [
            s.name,
            locId,
            vibeId,
            crowdId,
            Number(s.budget) || 2000,
            Number(s.rating) || 4.7,
            Number(s.popularity) || 80,
            s.description || 'Saved travel spot',
            s.image || null,
            (s.name || '').toLowerCase().replace(/\s+/g, '_')
          ]
        );
        finalSpotId = insertSpot.rows[0].spot_id;
      } else {
        return res.status(404).json({ error: 'Spot not found' });
      }
    }

    // Insert into favourites (idempotent with ON CONFLICT)
    await db.query(
      `INSERT INTO favourites (user_id, spot_id, saved_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, spot_id) DO NOTHING`,
      [userId, finalSpotId]
    );

    res.status(201).json({ message: 'Spot added to favourites', spotId: finalSpotId });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/favourites/:spotId or /api/favourites - Remove a spot from user favourites
router.delete(['/', '/:spotId'], async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const rawSpotId = req.params.spotId || req.body.spotId || req.query.spotId;
    const spotId = parseInt(rawSpotId, 10);

    if (isNaN(spotId)) {
      return res.status(400).json({ error: 'Invalid spot ID' });
    }

    const result = await db.query(
      'DELETE FROM favourites WHERE user_id = $1 AND spot_id = $2',
      [userId, spotId]
    );

    res.status(200).json({ message: 'Spot removed from favourites', spotId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
