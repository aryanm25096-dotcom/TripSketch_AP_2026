// routes/itineraries.js
// Handles user itineraries and day-by-day itinerary items (requires JWT authentication).

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Protect all itinerary routes
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
});

// GET /api/itineraries - Get all itineraries for the authenticated user with computed total budget
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Use SUM() on spots.budget_per_day to compute total budget dynamically
    const sql = `
      SELECT 
        i.itinerary_id,
        i.title,
        i.created_at,
        COUNT(ii.item_id) AS item_count,
        COALESCE(SUM(s.budget_per_day), 0) AS total_budget
      FROM itineraries i
      LEFT JOIN itinerary_items ii ON i.itinerary_id = ii.itinerary_id
      LEFT JOIN spots s ON ii.spot_id = s.spot_id
      WHERE i.user_id = $1
      GROUP BY i.itinerary_id, i.title, i.created_at
      ORDER BY i.created_at DESC
    `;

    const result = await db.query(sql, [userId]);
    const itineraries = result.rows.map((row) => ({
      id: row.itinerary_id,
      title: row.title,
      createdAt: row.created_at,
      itemCount: parseInt(row.item_count, 10),
      totalBudget: Number(row.total_budget),
    }));

    res.status(200).json(itineraries);
  } catch (err) {
    next(err);
  }
});

// POST /api/itineraries - Create a new empty itinerary
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Itinerary title is required' });
    }

    const sql = `
      INSERT INTO itineraries (user_id, title)
      VALUES ($1, $2)
      RETURNING itinerary_id, user_id, title, created_at
    `;

    const result = await db.query(sql, [userId, title.trim()]);
    const created = result.rows[0];

    res.status(201).json({
      id: created.itinerary_id,
      userId: created.user_id,
      title: created.title,
      createdAt: created.created_at,
      totalBudget: 0,
      items: [],
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/itineraries/:id - Get a specific itinerary with all items and computed budget
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const itineraryId = parseInt(req.params.id, 10);

    if (isNaN(itineraryId)) {
      return res.status(400).json({ error: 'Invalid itinerary ID' });
    }

    // Check itinerary existence and ownership
    const itinCheck = await db.query(
      'SELECT itinerary_id, user_id, title, created_at FROM itineraries WHERE itinerary_id = $1',
      [itineraryId]
    );

    if (itinCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const itin = itinCheck.rows[0];
    if (itin.user_id !== userId) {
      return res.status(403).json({ error: 'Access forbidden: you do not own this itinerary' });
    }

    // Fetch items with joined spot data
    const itemsSql = `
      SELECT 
        ii.item_id,
        ii.day_number,
        ii.position,
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
        COALESCE(
          array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
          '{}'
        ) AS tags
      FROM itinerary_items ii
      JOIN spots s ON ii.spot_id = s.spot_id
      JOIN locations l ON s.location_id = l.location_id
      JOIN states st ON l.state_id = st.state_id
      JOIN vibes v ON s.vibe_id = v.vibe_id
      JOIN crowd_levels cl ON s.crowd_level_id = cl.crowd_level_id
      LEFT JOIN spot_tags stg ON s.spot_id = stg.spot_id
      LEFT JOIN tags t ON stg.tag_id = t.tag_id
      WHERE ii.itinerary_id = $1
      GROUP BY ii.item_id, ii.day_number, ii.position, s.spot_id, l.area_name, st.name, v.name, cl.name
      ORDER BY ii.day_number ASC, ii.position ASC, ii.item_id ASC
    `;

    const itemsRes = await db.query(itemsSql, [itineraryId]);

    let totalBudget = 0;
    const items = itemsRes.rows.map((row) => {
      const spotObj = formatSpot(row);
      totalBudget += spotObj.budget;
      return {
        id: row.item_id,
        dayNumber: row.day_number,
        position: row.position,
        spot: spotObj,
      };
    });

    res.status(200).json({
      id: itin.itinerary_id,
      title: itin.title,
      createdAt: itin.created_at,
      totalBudget,
      items,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/itineraries/:id - Update an itinerary title (CRUD Update)
router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const itineraryId = parseInt(req.params.id, 10);
    const { title } = req.body;

    if (isNaN(itineraryId) || !title || !title.trim()) {
      return res.status(400).json({ error: 'Valid itinerary ID and title are required' });
    }

    const result = await db.query(
      'UPDATE itineraries SET title = $1 WHERE itinerary_id = $2 AND user_id = $3 RETURNING itinerary_id, title',
      [title.trim(), itineraryId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found or access forbidden' });
    }

    res.status(200).json({ message: 'Itinerary updated successfully', itinerary: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/itineraries/:id - Delete an entire itinerary
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const itineraryId = parseInt(req.params.id, 10);

    if (isNaN(itineraryId)) {
      return res.status(400).json({ error: 'Invalid itinerary ID' });
    }

    // Check ownership
    const itinCheck = await db.query(
      'SELECT user_id FROM itineraries WHERE itinerary_id = $1',
      [itineraryId]
    );

    if (itinCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    if (itinCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Access forbidden: you do not own this itinerary' });
    }

    await db.query('DELETE FROM itineraries WHERE itinerary_id = $1', [itineraryId]);

    res.status(200).json({ message: 'Itinerary deleted successfully', itineraryId });
  } catch (err) {
    next(err);
  }
});

// POST /api/itineraries/:id/items - Add a spot to an itinerary
router.post('/:id/items', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const itineraryId = parseInt(req.params.id, 10);
    const { spotId, dayNumber } = req.body;

    if (isNaN(itineraryId)) {
      return res.status(400).json({ error: 'Invalid itinerary ID' });
    }

    const spotIdNum = parseInt(spotId, 10);
    const dayNum = parseInt(dayNumber, 10);

    if (isNaN(spotIdNum) || isNaN(dayNum) || dayNum < 1) {
      return res.status(400).json({ error: 'Valid spotId and dayNumber (>= 1) are required' });
    }

    // Verify itinerary ownership
    const itinCheck = await db.query(
      'SELECT user_id FROM itineraries WHERE itinerary_id = $1',
      [itineraryId]
    );
    if (itinCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    if (itinCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Access forbidden: you do not own this itinerary' });
    }

    // Verify spot exists
    const spotCheck = await db.query('SELECT spot_id FROM spots WHERE spot_id = $1', [spotIdNum]);
    if (spotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    // Determine the next position for this day
    const posRes = await db.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM itinerary_items WHERE itinerary_id = $1 AND day_number = $2',
      [itineraryId, dayNum]
    );
    const position = posRes.rows[0].next_pos;

    // Insert item
    const insertSql = `
      INSERT INTO itinerary_items (itinerary_id, spot_id, day_number, position)
      VALUES ($1, $2, $3, $4)
      RETURNING item_id, itinerary_id, spot_id, day_number, position
    `;
    const result = await db.query(insertSql, [itineraryId, spotIdNum, dayNum, position]);

    res.status(201).json({
      message: 'Item added to itinerary',
      item: {
        id: result.rows[0].item_id,
        itineraryId: result.rows[0].itinerary_id,
        spotId: result.rows[0].spot_id,
        dayNumber: result.rows[0].day_number,
        position: result.rows[0].position,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/itineraries/:id/items/:itemId - Remove an item from an itinerary
router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const itineraryId = parseInt(req.params.id, 10);
    const itemId = parseInt(req.params.itemId, 10);

    if (isNaN(itineraryId) || isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid itinerary or item ID' });
    }

    // Verify itinerary ownership
    const itinCheck = await db.query(
      'SELECT user_id FROM itineraries WHERE itinerary_id = $1',
      [itineraryId]
    );
    if (itinCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    if (itinCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Access forbidden: you do not own this itinerary' });
    }

    const deleteRes = await db.query(
      'DELETE FROM itinerary_items WHERE item_id = $1 AND itinerary_id = $2 RETURNING item_id',
      [itemId, itineraryId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary item not found' });
    }

    res.status(200).json({ message: 'Item removed from itinerary', itemId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
