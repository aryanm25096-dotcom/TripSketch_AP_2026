# TripSketch Database Documentation

## How to Create and Initialize the Database

1. Ensure PostgreSQL is installed and running on your system.
2. Create the database:
   ```bash
   createdb tripsketch_ap
   ```
3. Run the schema and seed scripts using `psql`:
   ```bash
   psql -d tripsketch_ap -f database/schema.sql
   psql -d tripsketch_ap -f database/seed.sql
   ```
   *(Or simply run `npm run db:setup` from the `backend/` folder to run both automatically).*

---

## 10-Line Explanation of the 12 Tables

1. **`states`**: Stores unique Indian states and union territories (e.g., Ladakh, Kerala, Himachal Pradesh).
2. **`locations`**: Represents regional areas or cities within a specific state, enforcing 3NF normalization.
3. **`vibes`**: Lookup table for four core travel vibes (`nature`, `adventure`, `food`, `culture`).
4. **`crowd_levels`**: Lookup table for traveler crowd density preferences (`low`, `medium`, `high`).
5. **`spots`**: Primary entity storing travel destinations with daily budgets, ratings (0-5), popularity, descriptions, and images.
6. **`tags`**: Stores unique activity and thematic keywords (e.g., `trekking`, `peaceful`, `stargazing`).
7. **`spot_tags`**: Many-to-many junction table associating spots with descriptive tags using cascading foreign keys.
8. **`users`**: Manages registered travelers with unique emails, bcrypt password hashes, and registration timestamps.
9. **`favourites`**: Many-to-many table recording saved bookmarks linking users to spots they love.
10. **`itineraries`**: Tracks user-created custom trip plans (total budgets are never stored; they are computed dynamically with `SUM`).
11. **`itinerary_items`**: Maps spots into specific days and sequence positions within a user's itinerary.
12. **`recently_viewed`**: Logs user browsing history with timestamps to display recent destinations.
