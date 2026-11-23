// routes/spots.js
// Provides endpoints to retrieve spots with search, filters, sorting, and pagination.

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Helper to format a database row into the exact spot shape used by the React frontend
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

// GET /api/spots - List spots with multi-parameter filtering, search, sorting, and pagination
router.get('/', async (req, res, next) => {
  try {
    const {
      vibe,
      maxBudget,
      crowd,
      tag,
      search,
      sort,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = [];
    const params = [];

    // Filter by Vibe (e.g., 'nature', 'Nature', 'adventure', etc.)
    if (vibe && vibe.toLowerCase() !== 'all') {
      params.push(vibe.toLowerCase());
      whereClauses.push(`LOWER(v.name) = $${params.length}`);
    }

    // Filter by Max Budget
    if (maxBudget && !isNaN(Number(maxBudget))) {
      params.push(Number(maxBudget));
      whereClauses.push(`s.budget_per_day <= $${params.length}`);
    }

    // Filter by Crowd Level (maps UI words like 'quiet', 'moderate', 'lively' to 'low', 'medium', 'high')
    if (crowd && crowd.toLowerCase() !== 'any') {
      let crowdVal = crowd.toLowerCase();
      if (crowdVal === 'quiet') crowdVal = 'low';
      if (crowdVal === 'moderate') crowdVal = 'medium';
      if (crowdVal === 'lively') crowdVal = 'high';
      params.push(crowdVal);
      whereClauses.push(`LOWER(cl.name) = $${params.length}`);
    }

    // Filter by Tag using subquery so spot still retrieves all its associated tags
    if (tag && tag.trim()) {
      params.push(tag.trim().toLowerCase());
      whereClauses.push(`EXISTS (
        SELECT 1 FROM spot_tags stg2
        JOIN tags t2 ON stg2.tag_id = t2.tag_id
        WHERE stg2.spot_id = s.spot_id AND LOWER(t2.name) = $${params.length}
      )`);
    }

    // Search query matches spot name, location area, state, or description
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`(
        s.name ILIKE $${params.length} OR
        l.area_name ILIKE $${params.length} OR
        st.name ILIKE $${params.length} OR
        s.description ILIKE $${params.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // First: count total matching spots
    const countSql = `
      SELECT COUNT(DISTINCT s.spot_id) AS total
      FROM spots s
      JOIN locations l ON s.location_id = l.location_id
      JOIN states st ON l.state_id = st.state_id
      JOIN vibes v ON s.vibe_id = v.vibe_id
      JOIN crowd_levels cl ON s.crowd_level_id = cl.crowd_level_id
      ${whereSql}
    `;
    const countRes = await db.query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    // Sorting logic
    let orderBy = 's.spot_id ASC';
    if (sort === 'price_asc' || sort === 'price-asc') {
      orderBy = 's.budget_per_day ASC';
    } else if (sort === 'price_desc' || sort === 'price-desc') {
      orderBy = 's.budget_per_day DESC';
    } else if (sort === 'rating_desc' || sort === 'rating-desc') {
      orderBy = 's.rating DESC, s.popularity DESC';
    } else if (sort === 'popularity_desc' || sort === 'popularity-desc') {
      orderBy = 's.popularity DESC';
    }

    // Main query with JOINs, array_agg for tags, and pagination
    params.push(limitNum);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataSql = `
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
        COALESCE(
          array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
          '{}'
        ) AS tags
      FROM spots s
      JOIN locations l ON s.location_id = l.location_id
      JOIN states st ON l.state_id = st.state_id
      JOIN vibes v ON s.vibe_id = v.vibe_id
      JOIN crowd_levels cl ON s.crowd_level_id = cl.crowd_level_id
      LEFT JOIN spot_tags stg ON s.spot_id = stg.spot_id
      LEFT JOIN tags t ON stg.tag_id = t.tag_id
      ${whereSql}
      GROUP BY s.spot_id, l.area_name, st.name, v.name, cl.name
      ORDER BY ${orderBy}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const dataRes = await db.query(dataSql, params);
    const spots = dataRes.rows.map(formatSpot);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      spots,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/spots/:id - Retrieve a single spot by ID
router.get('/:id', async (req, res, next) => {
  try {
    const spotId = parseInt(req.params.id, 10);
    if (isNaN(spotId)) {
      return res.status(400).json({ error: 'Invalid spot ID' });
    }

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
        COALESCE(
          array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
          '{}'
        ) AS tags
      FROM spots s
      JOIN locations l ON s.location_id = l.location_id
      JOIN states st ON l.state_id = st.state_id
      JOIN vibes v ON s.vibe_id = v.vibe_id
      JOIN crowd_levels cl ON s.crowd_level_id = cl.crowd_level_id
      LEFT JOIN spot_tags stg ON s.spot_id = stg.spot_id
      LEFT JOIN tags t ON stg.tag_id = t.tag_id
      WHERE s.spot_id = $1
      GROUP BY s.spot_id, l.area_name, st.name, v.name, cl.name
    `;

    const result = await db.query(sql, [spotId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    res.status(200).json(formatSpot(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
