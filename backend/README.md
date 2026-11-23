# TripSketch Backend API

Backend REST API for **TripSketch**, built with Node.js, Express, and PostgreSQL using the plain `pg` library.

---

## 🛠️ Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (relational 3NF design via `pg` pool)
- **Security**: JWT (`jsonwebtoken`), password hashing (`bcryptjs`), CORS
- **AI Integration**: Groq Cloud API (server-side proxy for trip planning, NLP search, guide Q&A, and weather)

---

## 🚀 Setup & Installation

### 1. Install Dependencies
```bash
cd TripSketch_AP_2026/backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update values in `.env`:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tripsketch_ap
JWT_SECRET=your_jwt_secret_key_change_in_production
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Initialize Database
Ensure PostgreSQL is running and database `tripsketch_ap` is created (`createdb tripsketch_ap`). Then run:
```bash
npm run db:setup
```
This runs `database/schema.sql` (12 tables + indexes), `database/seed.sql` (lookups + 24 authentic spots + tags), and creates the demo user:
- **Email**: `demo@tripsketch.com`
- **Password**: `demo1234`

### 4. Start the Server
- Development mode (with live reload via nodemon):
  ```bash
  npm run dev
  ```
- Production mode:
  ```bash
  npm start
  ```
Server runs by default at `http://localhost:5000`.

---

## 📡 API Endpoints Reference

### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new user with name, email, and password | No |
| `POST` | `/api/auth/login` | Authenticate an existing user and receive a 7-day JWT | No |
| `GET` | `/api/auth/me` | Fetch currently logged-in user profile | Yes (Bearer) |

**Example Register Request:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "password": "password123"}'
```
**Example Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": 2,
    "name": "Alice",
    "email": "alice@example.com",
    "createdAt": "2026-11-23T06:30:00.000Z"
  }
}
```

---

### 📍 Spots (`/api/spots`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/spots` | List spots with filters (`vibe`, `maxBudget`, `crowd`, `tag`, `search`, `sort`, `page`, `limit`) | No |
| `GET` | `/api/spots/:id` | Get full details of a single spot by ID | No |

**Query Parameters for `GET /api/spots`:**
- `vibe`: `nature` | `adventure` | `food` | `culture` | `all`
- `maxBudget`: Number (e.g. `2500`)
- `crowd`: `low` | `medium` | `high` (or `quiet`, `moderate`, `lively`)
- `tag`: String (e.g. `trekking`, `peaceful`, `stargazing`)
- `search`: Keyword matching name, area, state, or description
- `sort`: `price_asc` | `price_desc` | `rating_desc` | `popularity_desc`
- `page`: Page number (default: `1`)
- `limit`: Items per page (default: `10`)

**Example Request:**
```bash
curl "http://localhost:5000/api/spots?vibe=nature&maxBudget=3000&sort=rating_desc"
```
**Example Response (200 OK):**
```json
{
  "total": 6,
  "page": 1,
  "limit": 10,
  "spots": [
    {
      "id": 16,
      "name": "Mechuka Valley",
      "location": "Shi-Yomi, Arunachal Pradesh",
      "vibe": "Nature",
      "budget": 3000,
      "crowdLevel": "Low",
      "tags": ["peaceful", "remote", "trekking"],
      "rating": 4.9,
      "popularity": 71,
      "description": "Enchanting frontier alpine valley...",
      "image": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
      "imageKeyword": "mechuka_valley"
    }
  ]
}
```

---

### ❤️ Favourites (`/api/favourites`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/favourites` | Get all saved favourite spots for the authenticated user | Yes (Bearer) |
| `POST` | `/api/favourites/:spotId` | Bookmark a spot to user favourites | Yes (Bearer) |
| `DELETE` | `/api/favourites/:spotId` | Remove a spot from user favourites | Yes (Bearer) |

**Example Bookmark Request:**
```bash
curl -X POST http://localhost:5000/api/favourites/7 \
  -H "Authorization: Bearer <token>"
```
**Example Response (201 Created):**
```json
{
  "message": "Spot added to favourites",
  "spotId": 7
}
```

---

### 🗺️ Itineraries (`/api/itineraries`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/itineraries` | List all user itineraries with computed total budget | Yes (Bearer) |
| `POST` | `/api/itineraries` | Create a new empty itinerary (`{ title }`) | Yes (Bearer) |
| `GET` | `/api/itineraries/:id` | Get itinerary with day-by-day items and calculated budget | Yes (Bearer) |
| `DELETE` | `/api/itineraries/:id` | Delete an itinerary and its items | Yes (Bearer) |
| `POST` | `/api/itineraries/:id/items` | Add a spot to an itinerary (`{ spotId, dayNumber }`) | Yes (Bearer) |
| `DELETE` | `/api/itineraries/:id/items/:itemId` | Remove an item from an itinerary | Yes (Bearer) |

**Example Add Item Request:**
```bash
curl -X POST http://localhost:5000/api/itineraries/1/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"spotId": 7, "dayNumber": 1}'
```
**Example Response (201 Created):**
```json
{
  "message": "Item added to itinerary",
  "item": {
    "id": 1,
    "itineraryId": 1,
    "spotId": 7,
    "dayNumber": 1,
    "position": 1
  }
}
```

---

### 🕒 Recently Viewed (`/api/recent`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/recent/:spotId` | Record that the user viewed a spot (upserts timestamp) | Yes (Bearer) |
| `GET` | `/api/recent` | Get the user's last 5 viewed spots (newest first) | Yes (Bearer) |

**Example Request:**
```bash
curl http://localhost:5000/api/recent \
  -H "Authorization: Bearer <token>"
```
**Example Response (200 OK):**
```json
[
  {
    "id": 7,
    "name": "Gokarna Coastal Trail",
    "location": "Kumta, Karnataka",
    "vibe": "Nature",
    "budget": 2100,
    "crowdLevel": "Medium",
    "tags": ["chill", "coastal-trek", "sunset"],
    "rating": 4.6,
    "popularity": 90,
    "description": "Series of secluded rocky coves...",
    "image": "https://images.unsplash.com/photo-1519046904884-53103b34b206",
    "imageKeyword": "gokarna_beach"
  }
]
```

---

### 🤖 AI Proxy (`/api/ai`)

*Calls Groq LLM server-side so API keys are never exposed in browser clients.*

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/ai/plan` | Generate a detailed day-by-day Markdown itinerary | No |
| `POST` | `/api/ai/ask` | Ask local guide question about a place (concise answer) | No |
| `POST` | `/api/ai/search` | Parse natural query into `{ vibe, maxBudget, tags }` | No |
| `GET` | `/api/ai/weather` | Query weather and vibe estimate (`?place=Gokarna`) | No |

**Example Ask Request:**
```bash
curl -X POST http://localhost:5000/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"placeName": "Zanskar Valley", "question": "What is the best month to visit?"}'
```
**Example Response (200 OK):**
```json
{
  "placeName": "Zanskar Valley",
  "question": "What is the best month to visit?",
  "answer": "The best time to visit Zanskar Valley is from June to September when the mountain passes are clear and roads are accessible. For the famous Chadar frozen river trek, visit in January and February."
}
```
*(If `GROQ_API_KEY` is not configured, AI routes return a clean 503 status code with `{ "error": "GROQ_API_KEY is not configured on the server..." }`).*
