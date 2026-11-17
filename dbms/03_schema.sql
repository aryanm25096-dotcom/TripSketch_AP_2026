-- =====================================================================
-- TripSketch DBMS Project: Checkpoint 1 (Schema & Normalization)
-- Database Engine: PostgreSQL 15+
-- File: sql/01_schema.sql
-- Description: Complete 3NF/BCNF relational schema with strict constraints,
--              referential integrity, and performant indexes.
-- =====================================================================

-- Clean slate: Drop existing tables in reverse dependency order
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

-- ---------------------------------------------------------------------
-- 1. states
-- Lookup table for normalized administrative states/UTs in India
-- ---------------------------------------------------------------------
CREATE TABLE states (
    state_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- 2. locations
-- Normalized geographical regions (Area/City within a State)
-- Enforces 3NF: area_name determines state_id; spots reference location_id
-- ---------------------------------------------------------------------
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    area_name VARCHAR(150) NOT NULL,
    state_id INT NOT NULL REFERENCES states(state_id) ON DELETE RESTRICT,
    CONSTRAINT uq_location_area_state UNIQUE (area_name, state_id)
);

-- ---------------------------------------------------------------------
-- 3. vibes
-- Standardized travel vibe classifications (nature, adventure, food, culture)
-- ---------------------------------------------------------------------
CREATE TABLE vibes (
    vibe_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    CONSTRAINT chk_vibe_name CHECK (name IN ('nature', 'adventure', 'food', 'culture'))
);

-- ---------------------------------------------------------------------
-- 4. crowd_levels
-- Normalized crowd tolerance tiers (low, medium, high)
-- ---------------------------------------------------------------------
CREATE TABLE crowd_levels (
    crowd_level_id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    CONSTRAINT chk_crowd_level_name CHECK (name IN ('low', 'medium', 'high'))
);

-- ---------------------------------------------------------------------
-- 5. spots
-- Core entity storing destination places with ratings, budget, and metrics
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 6. tags
-- Normalized descriptive tags (e.g. trekking, quiet, scenic, heritage)
-- ---------------------------------------------------------------------
CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- 7. spot_tags
-- Junction table implementing M:N relationship between spots and tags
-- ---------------------------------------------------------------------
CREATE TABLE spot_tags (
    spot_id INT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (spot_id, tag_id)
);

-- ---------------------------------------------------------------------
-- 8. users
-- Registered travelers and account holders
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ---------------------------------------------------------------------
-- 9. favourites
-- M:N relationship tracking spots saved by users
-- ---------------------------------------------------------------------
CREATE TABLE favourites (
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    spot_id INT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, spot_id)
);

-- ---------------------------------------------------------------------
-- 10. itineraries
-- User trip plans consisting of multi-day schedules
-- ---------------------------------------------------------------------
CREATE TABLE itineraries (
    itinerary_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 11. itinerary_items
-- Day-wise scheduled spots within an itinerary (sequential order)
-- ---------------------------------------------------------------------
CREATE TABLE itinerary_items (
    item_id SERIAL PRIMARY KEY,
    itinerary_id INT NOT NULL REFERENCES itineraries(itinerary_id) ON DELETE CASCADE,
    spot_id INT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
    day_number INT NOT NULL CHECK (day_number >= 1),
    position INT NOT NULL CHECK (position >= 1),
    CONSTRAINT uq_itinerary_day_position UNIQUE (itinerary_id, day_number, position)
);

-- ---------------------------------------------------------------------
-- 12. recently_viewed
-- Ephemeral history of spots inspected/viewed by users
-- ---------------------------------------------------------------------
CREATE TABLE recently_viewed (
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    spot_id INT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, spot_id)
);

-- =====================================================================
-- INDEXES
-- Covering Foreign Keys and critical filtering / sorting query paths
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

-- Performance Indexes for Search, Filter, and Sort (Vibe, Budget, Rating)
CREATE INDEX idx_spots_budget ON spots(budget_per_day);
CREATE INDEX idx_spots_rating ON spots(rating DESC);
CREATE INDEX idx_spots_vibe_budget ON spots(vibe_id, budget_per_day);
CREATE INDEX idx_spots_popularity ON spots(popularity DESC);
