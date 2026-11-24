# Checkpoint 4: Application Query Timings & Performance Analysis

**Course:** Applied Programming (AP) · B.Tech 2nd Year  
**Checkpoint:** CP4 — Query Execution & Performance Analysis  
**Application:** TripSketch (Offbeat & Budget Travel Planning Platform)  
**Database Name:** `tripsketch_db`  
**Database Engine:** PostgreSQL 18.4  
**Benchmark Suite:** `dbms/04_queries.sql` (`R1`–`R6` reads, `W1`–`W6` writes)  
**Execution Mode:** `EXPLAIN (ANALYZE, BUFFERS)` with 3 runs per query; write queries wrapped in `BEGIN; ... ROLLBACK;`  
**Raw Execution Plans:** Stored in [`dbms/plans/`](plans/) (`R1.txt` ... `R6.txt`, `W1.txt` ... `W6.txt`)  

---

## 1. Query Timing Table

| Query | Type | What it does | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Average (ms) | Scan Type / Access Method |
|:---|:---:|:---|---:|---:|---:|---:|:---|
| **R1** | READ | Filter spots by Vibe (nature), Crowd (low), and Budget ($\le$ ₹2,500) | 0.087 | 0.069 | 0.063 | **0.073** | `Seq Scan on spots` \| `Seq Scan on vibes` \| `Seq Scan on crowd_levels` |
| **R2** | READ | Search spots by Tag (#trekking) with array aggregation | 0.148 | 0.147 | 0.155 | **0.150** | `Seq Scan on spot_tags` \| `Seq Scan on tags` \| `Seq Scan on spots` |
| **R3** | READ | Retrieve user bookmarked favorites with spot details | 0.092 | 0.076 | 0.079 | **0.082** | `Seq Scan on favourites` \| `Seq Scan on spots` \| `Seq Scan on locations` |
| **R4** | READ | Retrieve user recently viewed spots in MRU order | 0.057 | 0.060 | 0.075 | **0.064** | `Seq Scan on recently_viewed` \| `Seq Scan on spots` \| `Seq Scan on locations` |
| **R5** | READ | Retrieve multi-day itinerary with window-aggregated total budget | 0.086 | 0.089 | 0.082 | **0.086** | `Seq Scan on itineraries` \| `Seq Scan on itinerary_items` \| `WindowAgg` |
| **R6** | READ | Explore filter metadata (aggregate spot counts & average budget) | 0.091 | 0.115 | 0.091 | **0.099** | `HashAggregate` on `vibes` and `crowd_levels` |
| **W1** | WRITE | User registration (RFC 5322 regex validation & conflict check) | 0.175 | 0.137 | 0.123 | **0.145** | Unique Index Check on `users(email)` |
| **W2** | WRITE | Bookmark destination spot to favorites | 0.596 | 0.563 | 0.662 | **0.607** | Composite PK Check on `favourites(user_id, spot_id)` |
| **W3** | WRITE | Remove destination spot from favorites | 0.060 | 0.063 | 0.041 | **0.055** | `Seq Scan on favourites` (point deletion) |
| **W4** | WRITE | Record or update recently viewed spot interaction timestamp | 0.694 | 0.619 | 0.666 | **0.660** | Upsert Index Check on `recently_viewed(user_id, spot_id)` |
| **W5** | WRITE | Create new multi-day itinerary container | 0.362 | 0.350 | 0.340 | **0.351** | Single-row insert into `itineraries` |
| **W6** | WRITE | Schedule spot into itinerary day position (with slot conflict check) | 0.554 | 0.469 | 0.454 | **0.492** | Unique slot constraint on `(itinerary_id, day_number, position)` |

---

## 2. Analysis of Execution Plans

1. **Sub-Millisecond Read Latencies:**
   - All read queries execute in **under 0.15 ms**, demonstrating that the 3NF/BCNF decomposed relational schema adds virtually zero join overhead for active working sets while guaranteeing strict normalization.
2. **Buffer Hits and Caching:**
   - As documented in the raw plan logs in [`dbms/plans/`](plans/), all queries achieve **100% shared buffer hits** (`shared hit=...`), meaning data resides entirely in memory without disk paging.
3. **Write Concurrency & Integrity:**
   - Write queries (`W1`, `W2`, `W4`, `W6`) successfully leverage unique indexes to enforce domain and relational integrity checks (`ON CONFLICT DO NOTHING / UPDATE`) in **under 0.7 ms**.
