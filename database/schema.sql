-- =====================================================================
-- TripSketch Database Schema (3NF Normalized)
-- Database Engine: PostgreSQL
-- =====================================================================

-- Drop tables in reverse dependency order to ensure clean re-runnability
DROP TABLE IF EXISTS recently_viewed CASCADE;
DROP TABLE IF EXISTS itinerary_items CASCADE;
DROP TABLE IF EXISTS itineraries CASCADE;
DROP TABLE IF EXISTS favourites CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS spot_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS spots CASCADE;
DROP TABLE IF EXISTS crowd_levels CASCADE;
DROP TABLE IF EXISTS vibes CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS states CASCADE;

-- 1. States table
CREATE TABLE states (
    state_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- 2. Locations table (Area within a State)
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    area_name VARCHAR(150) NOT NULL,
    state_id INT NOT NULL REFERENCES states(state_id) ON DELETE RESTRICT,
    CONSTRAINT uq_location_area_state UNIQUE (area_name, state_id)
);

-- 3. Vibes table (nature, adventure, food, culture)
CREATE TABLE vibes (
    vibe_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    CONSTRAINT chk_vibe_name CHECK (name IN ('nature', 'adventure', 'food', 'culture'))
);

-- 4. Crowd Levels table (low, medium, high)
CREATE TABLE crowd_levels (
    crowd_level_id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    CONSTRAINT chk_crowd_level_name CHECK (name IN ('low', 'medium', 'high'))
);

-- 5. Spots table
CREATE TABLE spots (
    spot_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location_id INT NOT NULL REFERENCES locations(location_id) ON DELETE RESTRICT,
    vibe_id INT NOT NULL REFERENCES vibes(vibe_id) ON DELETE RESTRICT,
    crowd_level_id INT NOT NULL REFERENCES crowd_levels(crowd_level_id) ON DELETE RESTRICT,
    budget_per_day NUMERIC(10, 2) NOT NULL CHECK (budget_per_day >= 0),
    rating NUMERIC(3, 2) NOT NULL CHECK (rating >= 0.0 AND rating <= 5.0),
    popularity INT NOT NULL CHECK (popularity >= 0 AND popularity <= 100),
    description TEXT NOT NULL,
    image_url TEXT,
    image_keyword VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_spot_name_location UNIQUE (name, location_id)
);

-- 6. Tags table
CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- 7. Spot Tags junction table (Many-to-Many relationship between spots and tags)
CREATE TABLE spot_tags (
    spot_id INT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (spot_id, tag_id)
);

-- 8. Users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Favourites table (User saved spots)
CREATE TABLE favourites (
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    spot_id INT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, spot_id)
);

-- 10. Itineraries table (User custom trip plans)
-- Note: Totals are never stored in the table; they are computed dynamically with SUM()
CREATE TABLE itineraries (
    itinerary_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Itinerary Items table (Spots added to specific days of an itinerary)
CREATE TABLE itinerary_items (
    item_id SERIAL PRIMARY KEY,
    itinerary_id INT NOT NULL REFERENCES itineraries(itinerary_id) ON DELETE CASCADE,
    spot_id INT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
    day_number INT NOT NULL CHECK (day_number >= 1),
    position INT NOT NULL DEFAULT 1 CHECK (position >= 1)
);

-- 12. Recently Viewed table (User spot browsing history)
CREATE TABLE recently_viewed (
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    spot_id INT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, spot_id)
);

-- =====================================================================
-- Indexes for Performance & Query Optimization
-- =====================================================================

-- Foreign Key Indexes
CREATE INDEX idx_locations_state_id ON locations(state_id);
CREATE INDEX idx_spots_location_id ON spots(location_id);
CREATE INDEX idx_spots_vibe_id ON spots(vibe_id);
CREATE INDEX idx_spots_crowd_level_id ON spots(crowd_level_id);
CREATE INDEX idx_spot_tags_tag_id ON spot_tags(tag_id);
CREATE INDEX idx_favourites_spot_id ON favourites(spot_id);
CREATE INDEX idx_itineraries_user_id ON itineraries(user_id);
CREATE INDEX idx_itinerary_items_itinerary_id ON itinerary_items(itinerary_id);
CREATE INDEX idx_itinerary_items_spot_id ON itinerary_items(spot_id);
CREATE INDEX idx_recently_viewed_spot_id ON recently_viewed(spot_id);

-- Filter & Sort Indexes (vibe, budget, rating)
CREATE INDEX idx_spots_budget ON spots(budget_per_day);
CREATE INDEX idx_spots_rating ON spots(rating DESC);
CREATE INDEX idx_spots_popularity ON spots(popularity DESC);
