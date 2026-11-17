# TripSketch: Normalization & Schema Design Report

**Course:** Applied Programming (AP) · B.Tech 2nd Year  
**Checkpoint:** CP1 — Normalization (1NF → 2NF → 3NF & BCNF)  
**Deliverable:** `dbms/01_normalization.md`  
**Application:** TripSketch (Offbeat & Budget-Friendly Travel Planning Platform)  
**Database Engine:** PostgreSQL 15+  
**Schema Version:** 1.0.0 (3NF / BCNF Compliant)  

---

## 1. Data Dictionary & Table Specifications

Every table below is defined with its exact PostgreSQL data types, nullability, keys, constraints, and the precise design rationale for each decision.

### 1.1 `states`
Lookup table representing administrative states and union territories in India.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `state_id` | `SERIAL` | `PRIMARY KEY` | Surrogate auto-incrementing integer identifier for efficient foreign key indexing. |
| `name` | `VARCHAR(100)` | `NOT NULL, UNIQUE` | State name; unique constraint prevents duplicate geographic administrative entries. |

### 1.2 `locations`
Standardized geographical areas or cities within a specific state.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `location_id` | `SERIAL` | `PRIMARY KEY` | Surrogate key identifying distinct urban or rural travel zones. |
| `area_name` | `VARCHAR(150)` | `NOT NULL` | Local area, valley, or town name (e.g., "Zanskar", "Kumta"). |
| `state_id` | `INT` | `NOT NULL, REFERENCES states(state_id) ON DELETE RESTRICT` | Foreign key referencing state; `RESTRICT` prevents deleting states with active areas. |
| — | — | `UNIQUE (area_name, state_id)` | Composite unique constraint avoids registering duplicate area entries in the same state. |

### 1.3 `vibes`
Categorical classification for experiential travel themes.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `vibe_id` | `SERIAL` | `PRIMARY KEY` | Compact integer primary key for indexing and fast join resolution. |
| `name` | `VARCHAR(50)` | `NOT NULL, UNIQUE, CHECK (name IN ('nature','adventure','food','culture'))` | Enforces domain integrity restricting values strictly to approved platform vibes. |

### 1.4 `crowd_levels`
Categorical classification for visitor density and crowd tolerance.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `crowd_level_id` | `SERIAL` | `PRIMARY KEY` | Compact integer surrogate key. |
| `name` | `VARCHAR(20)` | `NOT NULL, UNIQUE, CHECK (name IN ('low','medium','high'))` | Enforces standard tiers: low (quiet), medium (moderate), high (lively). |

### 1.5 `spots`
Primary entity storing detailed destination records.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `spot_id` | `SERIAL` | `PRIMARY KEY` | Unique surrogate key identifying each travel destination. |
| `name` | `VARCHAR(150)` | `NOT NULL` | Official name of the travel spot (e.g., "Zanskar Valley"). |
| `location_id` | `INT` | `NOT NULL, REFERENCES locations(location_id) ON DELETE RESTRICT` | FK mapping spot to its geographic area; `RESTRICT` prevents accidental orphan spots. |
| `vibe_id` | `INT` | `NOT NULL, REFERENCES vibes(vibe_id) ON DELETE RESTRICT` | FK referencing travel vibe; indexed for sub-millisecond category filtering. |
| `crowd_level_id` | `INT` | `NOT NULL, REFERENCES crowd_levels(crowd_level_id) ON DELETE RESTRICT` | FK referencing crowd tier. |
| `budget_per_day` | `NUMERIC(10,2)` | `NOT NULL, CHECK (budget_per_day >= 0)` | Accurate monetary representation in INR; check constraint prevents negative budgets. |
| `rating` | `NUMERIC(3,2)` | `NOT NULL, CHECK (rating >= 0.0 AND rating <= 5.0)` | Two-decimal precision rating constrained strictly between 0.00 and 5.00 stars. |
| `popularity` | `INT` | `NOT NULL, CHECK (popularity >= 0 AND popularity <= 100)` | Engagement percentile constrained between 0 and 100. |
| `description` | `TEXT` | `NOT NULL` | Comprehensive narrative description of the spot's unique appeal. |
| `image_url` | `TEXT` | `NULL` | External high-resolution image URL (Unsplash/Wikimedia CDN). |
| `image_keyword` | `VARCHAR(100)` | `NULL` | Fallback semantic search tag for Wikipedia/LoremFlickr dynamic asset retrieval. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Audit timestamp with timezone offset for reproducible creation tracking. |
| — | — | `UNIQUE (name, location_id)` | Natural composite key preventing duplicate spots registered within the same area. |

### 1.6 `tags`
Dictionary of descriptive semantic keywords.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `tag_id` | `SERIAL` | `PRIMARY KEY` | Compact integer primary key. |
| `name` | `VARCHAR(50)` | `NOT NULL, UNIQUE` | Canonical lowercase tag name (e.g., "trekking", "living-root-bridges"). |

### 1.7 `spot_tags`
Junction table implementing the Many-to-Many ($M:N$) relationship between `spots` and `tags`.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `spot_id` | `INT` | `NOT NULL, REFERENCES spots(spot_id) ON DELETE CASCADE` | FK to spots; `CASCADE` cleans up tag mappings if a spot is deleted. |
| `tag_id` | `INT` | `NOT NULL, REFERENCES tags(tag_id) ON DELETE CASCADE` | FK to tags; `CASCADE` cleans up mappings if a tag is removed. |
| — | — | `PRIMARY KEY (spot_id, tag_id)` | Composite primary key preventing duplicate tag associations for the same spot. |

### 1.8 `users`
Registered platform accounts.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `user_id` | `SERIAL` | `PRIMARY KEY` | Unique integer identifier for user accounts. |
| `name` | `VARCHAR(100)` | `NOT NULL` | Full display name of the traveler. |
| `email` | `VARCHAR(255)` | `NOT NULL, UNIQUE, CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')` | Unique login credential validated against standard RFC 5322 regex syntax. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Account creation timestamp with timezone. |

### 1.9 `favourites`
User saved/bookmarked spots ($M:N$).

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `user_id` | `INT` | `NOT NULL, REFERENCES users(user_id) ON DELETE CASCADE` | FK to user; `CASCADE` cleans bookmarks when user account is deleted. |
| `spot_id` | `INT` | `NOT NULL, REFERENCES spots(spot_id) ON DELETE CASCADE` | FK to spot; `CASCADE` cleans bookmark when spot is removed. |
| `saved_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Timestamp indicating when the spot was bookmarked. |
| — | — | `PRIMARY KEY (user_id, spot_id)` | Composite PK enforcing idempotent single bookmarking per user-spot pair. |

### 1.10 `itineraries`
Trip schedule containers created by users.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `itinerary_id` | `SERIAL` | `PRIMARY KEY` | Unique surrogate identifier for multi-day itineraries. |
| `user_id` | `INT` | `NOT NULL, REFERENCES users(user_id) ON DELETE CASCADE` | FK identifying itinerary author; `CASCADE` removes trips if user profile is purged. |
| `title` | `VARCHAR(200)` | `NOT NULL` | Human-readable trip title (e.g., "High Altitude Himalayan Escape"). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Creation timestamp. |

### 1.11 `itinerary_items`
Sequential spot scheduling per day within an itinerary.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `item_id` | `SERIAL` | `PRIMARY KEY` | Surrogate identifier for individual itinerary schedule entries. |
| `itinerary_id` | `INT` | `NOT NULL, REFERENCES itineraries(itinerary_id) ON DELETE CASCADE` | FK to itinerary; `CASCADE` removes items when the parent itinerary is deleted. |
| `spot_id` | `INT` | `NOT NULL, REFERENCES spots(spot_id) ON DELETE CASCADE` | FK referencing scheduled destination spot. |
| `day_number` | `INT` | `NOT NULL, CHECK (day_number >= 1)` | 1-indexed day sequence (Day 1, Day 2, etc.). |
| `position` | `INT` | `NOT NULL, CHECK (position >= 1)` | 1-indexed intra-day visit order (1st spot, 2nd spot). |
| — | — | `UNIQUE (itinerary_id, day_number, position)` | Enforces temporal scheduling integrity: prevents overlapping slots on the same day. |

### 1.12 `recently_viewed`
Ephemeral inspection history tracking recently viewed destinations.

| Column | Data Type | Constraints | Design Rationale |
|---|---|---|---|
| `user_id` | `INT` | `NOT NULL, REFERENCES users(user_id) ON DELETE CASCADE` | FK referencing inspecting user. |
| `spot_id` | `INT` | `NOT NULL, REFERENCES spots(spot_id) ON DELETE CASCADE` | FK referencing inspected spot. |
| `viewed_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Timestamp of latest spot interaction for MRU (Most Recently Used) ordering. |
| — | — | `PRIMARY KEY (user_id, spot_id)` | Enforces uniqueness per user-spot; updating `viewed_at` preserves deduplicated history. |

---

## 2. Normalization Analysis: Proof of 3NF & BCNF

The initial unnormalized structure of a destination card in JSON form was:
$$\text{SpotCard}(\text{id}, \text{name}, \text{location}, \text{vibe}, \text{budget}, \text{crowdLevel}, \text{tags}[], \text{rating}, \text{popularity}, \text{description}, \text{imageKeyword}, \text{image})$$

### 2.1 First Normal Form (1NF)
- **Violation in Original Data:** `location` contained composite attributes (`"Area, State"`), and `tags` contained non-atomic multivalued arrays (`['trekking', 'remote', 'glacier']`).
- **Resolution:**
  1. Atomic decomposition: `location` split into atomic values: `area_name` and `state_name`.
  2. Repeating group elimination: `tags` extracted into independent entity `tags(tag_id, name)` and mapped through an associative bridge table `spot_tags(spot_id, tag_id)` with single atomic scalar values in every tuple.
- **Result:** Every column contains exclusively atomic, indivisible values, satisfying **1NF**.

### 2.2 Second Normal Form (2NF)
- **Requirement:** Must be in 1NF, and every non-prime attribute must be fully functionally dependent on the entire primary key (no partial dependencies on composite keys).
- **Composite Key Evaluation:**
  - `spot_tags(spot_id, tag_id)`: Contains only primary key components forming composite key; no non-prime attributes exist.
  - `favourites(user_id, spot_id)`: Non-prime attribute `saved_at` depends on the entire composite key $(\text{user\_id}, \text{spot\_id})$. A user saves a specific spot at a specific time.
  - `recently_viewed(user_id, spot_id)`: Non-prime attribute `viewed_at` depends on $(\text{user\_id}, \text{spot\_id})$.
  - `itinerary_items(item_id)`: Uses surrogate PK `item_id`; all attributes (`itinerary_id`, `spot_id`, `day_number`, `position`) depend entirely on `item_id`.
- **Result:** All partial key dependencies are eliminated. Schema satisfies **2NF**.

### 2.3 Third Normal Form (3NF)
- **Requirement:** Must be in 2NF, and no non-prime attribute may be transitively dependent on the primary key ($X \to Y$ and $Y \to Z$ where $Z$ is non-prime).
- **Transitive Dependency Elimination in Geography:**
  - In a naive schema: $\text{spot\_id} \to \text{area\_name} \to \text{state\_name}$.
  - Here, $\text{state\_name}$ was transitively dependent on $\text{spot\_id}$ through $\text{area\_name}$.
  - **Resolution:** Decomposed into three distinct relation tiers:
    1. $\text{states}(\underline{\text{state\_id}}, \text{name})$
    2. $\text{locations}(\underline{\text{location\_id}}, \text{area\_name}, \text{state\_id})$
    3. $\text{spots}(\underline{\text{spot\_id}}, \dots, \text{location\_id})$
  - Now, $\text{location\_id} \to \text{state\_id}$ lives in `locations`, and `spots` holds only direct reference $\text{spot\_id} \to \text{location\_id}$.
- **Transitive Dependency Elimination in Vibes & Crowd Levels:**
  - Free-text vibe strings and crowd strings were decomposed into `vibes` and `crowd_levels` tables to prevent redundant multi-tuple update anomalies.
- **Result:** Every non-prime attribute is non-transitively dependent on the primary key. Schema satisfies **3NF**.

### 2.4 Boyce-Codd Normal Form (BCNF)
- **Requirement:** For every non-trivial functional dependency $X \to Y$, the determinant $X$ must be a superkey.
- **Proof per Table:**
  - `states`: Only candidate key is `state_id` (and natural key `name`). $\text{state\_id} \to \text{name}$ and $\text{name} \to \text{state\_id}$. Both determinants are candidate keys. $\to$ **BCNF holds.**
  - `locations`: Candidate keys are `location_id` and $(\text{area\_name}, \text{state\_id})$. Determinants are candidate keys. $\to$ **BCNF holds.**
  - `vibes`: Candidate keys are `vibe_id` and `name`. Both are candidate keys. $\to$ **BCNF holds.**
  - `crowd_levels`: Candidate keys are `crowd_level_id` and `name`. Both are candidate keys. $\to$ **BCNF holds.**
  - `spots`: Candidate key is `spot_id` (and $(\text{name}, \text{location\_id})$). All attributes depend strictly on `spot_id`. Determinant is a candidate key. $\to$ **BCNF holds.**
  - `tags`: Candidate keys are `tag_id` and `name`. $\to$ **BCNF holds.**
  - `spot_tags`: Primary key is $(\text{spot\_id}, \text{tag\_id})$. No non-trivial dependencies with non-superkey determinants. $\to$ **BCNF holds.**
  - `users`: Candidate keys are `user_id` and `email`. Both determinants are candidate keys. $\to$ **BCNF holds.**
  - `favourites`: PK is $(\text{user\_id}, \text{spot\_id})$. Determinant is a candidate key. $\to$ **BCNF holds.**
  - `itineraries`: PK is `itinerary_id`. Determinant is a candidate key. $\to$ **BCNF holds.**
  - `itinerary_items`: Candidate keys are `item_id` and $(\text{itinerary\_id}, \text{day\_number}, \text{position})$. Determinants are candidate keys. $\to$ **BCNF holds.**
  - `recently_viewed`: PK is $(\text{user\_id}, \text{spot\_id})$. Determinant is a candidate key. $\to$ **BCNF holds.**

---

## 3. Strict Absence of Stored Derived Attributes

In adherence to pure 3NF principles, the schema strictly refuses to store derived or redundant values:
1. **Total Itinerary Cost:** NOT stored in `itineraries`. Storing a `total_cost` column introduces write anomalies whenever a spot's daily rate is updated or an item is reordered. Instead, it is dynamically computed using SQL aggregation:
   ```sql
   SELECT i.itinerary_id, i.title, SUM(s.budget_per_day) AS total_budget
   FROM itineraries i
   JOIN itinerary_items ii ON i.itinerary_id = ii.itinerary_id
   JOIN spots s ON ii.spot_id = s.spot_id
   GROUP BY i.itinerary_id, i.title;
   ```
2. **Total Saved / Favorite Count:** NOT stored in `spots`. Calculated dynamically via `COUNT(*)` over `favourites WHERE spot_id = ?`.
3. **Number of Scheduled Days:** NOT stored in `itineraries`. Dynamically computed using `MAX(ii.day_number)`.

---

## 4. Verification & Integrity Test Results

The schema was loaded and validated twice in sequence against a local PostgreSQL server with 0 errors.

### Test 1: Record Count Assertions
```sql
SELECT 'spots' AS entity, COUNT(*) AS count FROM spots
UNION ALL
SELECT 'tags', COUNT(*) FROM tags
UNION ALL
SELECT 'spot_tags', COUNT(*) FROM spot_tags
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'itineraries', COUNT(*) FROM itineraries;
```
**Output:**
```
   entity    | count 
-------------+-------
 spots       |    24
 tags        |    40
 spot_tags   |    72
 users       |     5
 itineraries |     2
```

### Test 2: Multi-Criteria Filter Query Execution
```sql
SELECT s.spot_id, s.name, v.name AS vibe, l.area_name, st.name AS state, s.budget_per_day, s.rating
FROM spots s
JOIN vibes v ON s.vibe_id = v.vibe_id
JOIN locations l ON s.location_id = l.location_id
JOIN states st ON l.state_id = st.state_id
WHERE v.name = 'nature' AND s.budget_per_day <= 2500
ORDER BY s.rating DESC;
```
**Output:**
```
 spot_id |             name              |  vibe  | area_name |      state       | budget_per_day | rating 
---------+-------------------------------+--------+-----------+------------------+----------------+--------
       2 | Tirthan Valley                | nature | Kullu     | Himachal Pradesh |        2200.00 |   4.80
      24 | Athirappilly Rainforest Falls | nature | Thrissur  | Kerala           |        2200.00 |   4.70
       7 | Gokarna Coastal Trail         | nature | Kumta     | Karnataka        |        2100.00 |   4.60
```

### Test 3: Dynamic Itinerary Total Budget Calculation
```sql
SELECT i.itinerary_id, i.title, u.name AS created_by,
       COUNT(ii.item_id) AS total_spots,
       SUM(s.budget_per_day) AS total_estimated_budget
FROM itineraries i
JOIN users u ON i.user_id = u.user_id
JOIN itinerary_items ii ON i.itinerary_id = ii.itinerary_id
JOIN spots s ON ii.spot_id = s.spot_id
GROUP BY i.itinerary_id, i.title, u.name;
```
**Output:**
```
 itinerary_id |                 title                 | created_by  | total_spots | total_estimated_budget 
--------------+---------------------------------------+-------------+-------------+------------------------
            1 | High Altitude Himalayan Escape        | Aarav Patel |           4 |               13000.00
            2 | Coastal Cliffs and Backwaters Getaway | Priya Nair  |           3 |                7900.00
```
