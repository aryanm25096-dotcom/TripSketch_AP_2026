-- =====================================================================
-- TripSketch DBMS: Application Workload Queries
-- Course: Applied Programming (AP) · B.Tech 2nd Year
-- Deliverable: dbms/04_queries.sql
-- Format: Every query marked with -- READ or -- WRITE and id (R1, W1...)
-- =====================================================================

-- ---------------------------------------------------------------------
-- R1: READ - Filter spots by Vibe, Crowd Level, and Maximum Daily Budget
-- Used by: Home explore feed & multi-faceted filter drawer
-- ---------------------------------------------------------------------
-- READ
SELECT 
    s.spot_id,
    s.name AS spot_name,
    l.area_name,
    st.name AS state_name,
    v.name AS vibe,
    cl.name AS crowd_level,
    s.budget_per_day,
    s.rating,
    s.popularity,
    s.description,
    s.image_url
FROM spots s
JOIN locations l ON s.location_id = l.location_id
JOIN states st ON l.state_id = st.state_id
JOIN vibes v ON s.vibe_id = v.vibe_id
JOIN crowd_levels cl ON s.crowd_level_id = cl.crowd_level_id
WHERE v.name = 'nature'
  AND cl.name = 'low'
  AND s.budget_per_day <= 2500.00
ORDER BY s.rating DESC, s.popularity DESC;

-- ---------------------------------------------------------------------
-- R2: READ - Search spots by Tag / Keyword with Aggregated Tags
-- Used by: Search bar type-ahead and tag pills click
-- ---------------------------------------------------------------------
-- READ
SELECT 
    s.spot_id,
    s.name AS spot_name,
    l.area_name,
    st.name AS state_name,
    s.budget_per_day,
    s.rating,
    ARRAY_AGG(t.name ORDER BY t.name) AS tags
FROM spots s
JOIN locations l ON s.location_id = l.location_id
JOIN states st ON l.state_id = st.state_id
JOIN spot_tags stg ON s.spot_id = stg.spot_id
JOIN tags t ON stg.tag_id = t.tag_id
GROUP BY s.spot_id, s.name, l.area_name, st.name, s.budget_per_day, s.rating
HAVING 'trekking' = ANY(ARRAY_AGG(t.name))
ORDER BY s.rating DESC;

-- ---------------------------------------------------------------------
-- R3: READ - Retrieve User Bookmarked Favourites with Spot Metadata
-- Used by: "My Saved Trips / Favourites" modal
-- ---------------------------------------------------------------------
-- READ
SELECT 
    f.saved_at,
    s.spot_id,
    s.name AS spot_name,
    l.area_name,
    st.name AS state_name,
    v.name AS vibe,
    s.budget_per_day,
    s.rating
FROM favourites f
JOIN spots s ON f.spot_id = s.spot_id
JOIN locations l ON s.location_id = l.location_id
JOIN states st ON l.state_id = st.state_id
JOIN vibes v ON s.vibe_id = v.vibe_id
WHERE f.user_id = 1
ORDER BY f.saved_at DESC;

-- ---------------------------------------------------------------------
-- R4: READ - Retrieve User Recently Viewed Destinations (MRU Order)
-- Used by: "Recently Viewed" horizontal carousel
-- ---------------------------------------------------------------------
-- READ
SELECT 
    rv.viewed_at,
    s.spot_id,
    s.name AS spot_name,
    l.area_name,
    st.name AS state_name,
    s.budget_per_day,
    s.rating,
    s.image_url
FROM recently_viewed rv
JOIN spots s ON rv.spot_id = s.spot_id
JOIN locations l ON s.location_id = l.location_id
JOIN states st ON l.state_id = st.state_id
WHERE rv.user_id = 1
ORDER BY rv.viewed_at DESC
LIMIT 10;

-- ---------------------------------------------------------------------
-- R5: READ - Retrieve Multi-Day Itinerary with Dynamic Total Budget
-- Used by: Itinerary viewer & budget summary card
-- ---------------------------------------------------------------------
-- READ
SELECT 
    i.itinerary_id,
    i.title AS itinerary_title,
    u.name AS traveler_name,
    ii.day_number,
    ii.position,
    s.name AS spot_name,
    l.area_name,
    s.budget_per_day,
    SUM(s.budget_per_day) OVER (PARTITION BY i.itinerary_id) AS total_itinerary_budget
FROM itineraries i
JOIN users u ON i.user_id = u.user_id
JOIN itinerary_items ii ON i.itinerary_id = ii.itinerary_id
JOIN spots s ON ii.spot_id = s.spot_id
JOIN locations l ON s.location_id = l.location_id
WHERE i.itinerary_id = 1
ORDER BY ii.day_number, ii.position;

-- ---------------------------------------------------------------------
-- R6: READ - Explore Filter Metadata (Lookup values for UI selects)
-- Used by: Filter bar initialization
-- ---------------------------------------------------------------------
-- READ
SELECT 
    v.name AS vibe_name,
    cl.name AS crowd_name,
    COUNT(s.spot_id) AS total_spots,
    ROUND(AVG(s.budget_per_day), 2) AS avg_budget
FROM spots s
JOIN vibes v ON s.vibe_id = v.vibe_id
JOIN crowd_levels cl ON s.crowd_level_id = cl.crowd_level_id
GROUP BY v.name, cl.name
ORDER BY v.name, cl.name;

-- ---------------------------------------------------------------------
-- W1: WRITE - User Registration (RFC 5322 Email Validation)
-- Used by: User sign-up flow
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO users (name, email)
VALUES ('Kabir Sen', 'kabir.sen@gmail.com')
ON CONFLICT (email) DO NOTHING
RETURNING user_id, name, email, created_at;

-- ---------------------------------------------------------------------
-- W2: WRITE - Add Destination to Favourites (Bookmark)
-- Used by: Heart / Bookmark button click
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO favourites (user_id, spot_id)
VALUES (1, 5)
ON CONFLICT (user_id, spot_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- W3: WRITE - Remove Destination from Favourites (Unbookmark)
-- Used by: Heart / Bookmark toggle off
-- ---------------------------------------------------------------------
-- WRITE
DELETE FROM favourites
WHERE user_id = 1 AND spot_id = 5;

-- ---------------------------------------------------------------------
-- W4: WRITE - Record or Update Recently Viewed Spot
-- Used by: Spot card click / detail modal open
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO recently_viewed (user_id, spot_id, viewed_at)
VALUES (1, 3, CURRENT_TIMESTAMP)
ON CONFLICT (user_id, spot_id)
DO UPDATE SET viewed_at = EXCLUDED.viewed_at;

-- ---------------------------------------------------------------------
-- W5: WRITE - Create New Itinerary Container
-- Used by: "New Trip" button in Itinerary Builder
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO itineraries (user_id, title)
VALUES (1, 'Winter Trek in Zanskar & Spiti')
RETURNING itinerary_id, user_id, title, created_at;

-- ---------------------------------------------------------------------
-- W6: WRITE - Add Destination Spot to Itinerary Day Schedule
-- Used by: "Add to Itinerary" action
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO itinerary_items (itinerary_id, spot_id, day_number, position)
VALUES (1, 1, 1, 1)
ON CONFLICT (itinerary_id, day_number, position)
DO UPDATE SET spot_id = EXCLUDED.spot_id;
