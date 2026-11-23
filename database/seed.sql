-- =====================================================================
-- TripSketch Database Seed Data
-- Database Engine: PostgreSQL
-- Description: Inserts lookup values, states, locations, 24 offbeat spots,
--              tags, and spot-tag relationships.
-- =====================================================================

-- 1. Vibes Lookups
INSERT INTO vibes (vibe_id, name) VALUES
(1, 'nature'),
(2, 'adventure'),
(3, 'food'),
(4, 'culture')
ON CONFLICT (vibe_id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval('vibes_vibe_id_seq', (SELECT COALESCE(MAX(vibe_id), 1) FROM vibes));

-- 2. Crowd Levels Lookups
INSERT INTO crowd_levels (crowd_level_id, name) VALUES
(1, 'low'),
(2, 'medium'),
(3, 'high')
ON CONFLICT (crowd_level_id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval('crowd_levels_crowd_level_id_seq', (SELECT COALESCE(MAX(crowd_level_id), 1) FROM crowd_levels));

-- 3. States Lookups
INSERT INTO states (state_id, name) VALUES
(1, 'Ladakh'),
(2, 'Himachal Pradesh'),
(3, 'Meghalaya'),
(4, 'Tamil Nadu'),
(5, 'Uttarakhand'),
(6, 'Assam'),
(7, 'Karnataka'),
(8, 'Nagaland'),
(9, 'Andhra Pradesh'),
(10, 'Goa'),
(11, 'Manipur'),
(12, 'Rajasthan'),
(13, 'Kerala'),
(14, 'Madhya Pradesh'),
(15, 'Arunachal Pradesh'),
(16, 'Gujarat')
ON CONFLICT (state_id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval('states_state_id_seq', (SELECT COALESCE(MAX(state_id), 1) FROM states));

-- 4. Locations Lookups (Area within State)
INSERT INTO locations (location_id, area_name, state_id) VALUES
(1, 'Zanskar', 1),
(2, 'Kullu', 2),
(3, 'East Khasi Hills', 3),
(4, 'Sivaganga', 4),
(5, 'Rudraprayag', 5),
(6, 'Brahmaputra', 6),
(7, 'Kumta', 7),
(8, 'Lahaul and Spiti', 2),
(9, 'Kohima', 8),
(10, 'Kadapa', 9),
(11, 'Ponda', 10),
(12, 'Senapati', 11),
(13, 'Hadoti', 12),
(14, 'Thiruvananthapuram', 13),
(15, 'Dhar', 14),
(16, 'Shi-Yomi', 15),
(17, 'Kangra', 2),
(18, 'Dehradun', 5),
(19, 'Vijayanagara', 7),
(20, 'Rameswaram', 4),
(21, 'Panchmahal', 16),
(22, 'Kottayam', 13),
(23, 'Indore', 14),
(24, 'Thrissur', 13)
ON CONFLICT (location_id) DO UPDATE SET area_name = EXCLUDED.area_name, state_id = EXCLUDED.state_id;

SELECT setval('locations_location_id_seq', (SELECT COALESCE(MAX(location_id), 1) FROM locations));

-- 5. Tags Lookups
INSERT INTO tags (tag_id, name) VALUES
(1, 'trekking'),
(2, 'glacier'),
(3, 'remote'),
(4, 'river'),
(5, 'peaceful'),
(6, 'living-root-bridges'),
(7, 'clean-village'),
(8, 'tribal'),
(9, 'spicy-cuisine'),
(10, 'heritage-mansions'),
(11, 'architecture'),
(12, 'snow-trek'),
(13, 'river-island'),
(14, 'satras'),
(15, 'coastal-trek'),
(16, 'chill'),
(17, 'monasteries'),
(18, 'stargazing'),
(19, 'ecotourism'),
(20, 'canyon'),
(21, 'gorge'),
(22, 'spices'),
(23, 'organic-lunch'),
(24, 'seasonal-flowers'),
(25, 'stepwells'),
(26, 'frescoes'),
(27, 'red-cliff'),
(28, 'sunset'),
(29, 'jahaz-mahal'),
(30, 'paragliding'),
(31, 'tibetan-cafes'),
(32, 'bakehouse'),
(33, 'colonial'),
(34, 'unesco-heritage'),
(35, 'ghost-town'),
(36, 'backwaters'),
(37, 'birdwatching'),
(38, 'street-food'),
(39, 'waterfalls'),
(40, 'rainforest')
ON CONFLICT (tag_id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval('tags_tag_id_seq', (SELECT COALESCE(MAX(tag_id), 1) FROM tags));

-- 6. Seed 24 Authentic Offbeat Indian Spots
INSERT INTO spots (spot_id, name, location_id, vibe_id, crowd_level_id, budget_per_day, rating, popularity, description, image_url, image_keyword) VALUES
(1, 'Zanskar Valley', 1, 2, 1, 3500.00, 4.90, 88, 'Rugged trans-Himalayan gorge landscape featuring high-altitude treks, frozen river trails, and ancient Tibetan monasteries.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', 'zanskar_valley'),
(2, 'Tirthan Valley', 2, 1, 1, 2200.00, 4.80, 82, 'Verdant river valley bordered by the Great Himalayan National Park, famed for trout streams and tranquil alpine woodlands.', 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800', 'tirthan_valley'),
(3, 'Mawlynnong', 3, 4, 2, 1800.00, 4.70, 85, 'Renowned as Asia''s cleanest village, highlighted by indigenous Khasi living root bridges and eco-friendly bamboo treehouses.', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05', 'mawlynnong'),
(4, 'Chettinad Heritage Trail', 4, 3, 1, 2500.00, 4.80, 80, 'Aristocratic district known for 19th-century limestone mansions, vibrant Athangudi tiles, and world-renowned peppery delicacies.', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef', 'chettinad'),
(5, 'Chopta Meadow', 5, 2, 1, 2000.00, 4.80, 86, 'Known as the Mini Switzerland of Uttarakhand, an alpine pasture serving as the base for the sacred Tungnath temple trek.', 'https://images.unsplash.com/photo-1426604966848-d7adac402bff', 'chopta'),
(6, 'Majuli Island', 6, 4, 1, 1600.00, 4.70, 78, 'World''s largest inhabited river island preserving Neo-Vaishnavite monastic institutions, clay mask crafting, and pastoral wetlands.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', 'majuli_island'),
(7, 'Gokarna Coastal Trail', 7, 1, 2, 2100.00, 4.60, 90, 'Series of secluded rocky coves including Om, Half Moon, and Paradise beaches connected by panoramic cliffside walking paths.', 'https://images.unsplash.com/photo-1519046904884-53103b34b206', 'gokarna_beach'),
(8, 'Spiti Valley', 8, 2, 2, 3500.00, 4.90, 92, 'Cold desert mountain terrain studded with dramatic whitewashed gompas, fossil settlements, and pristine starry night skies.', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b', 'spiti_valley'),
(9, 'Khonoma Green Village', 9, 4, 1, 1900.00, 4.80, 75, 'Historic Angami settlement celebrated as India''s pioneer green village with community-conserved virgin tragopan forests.', 'https://images.unsplash.com/photo-1511497584788-87676104235f', 'khonoma_village'),
(10, 'Gandikota Gorge', 10, 2, 1, 1700.00, 4.60, 84, 'Massive canyon cut through the Erramala hills by the Pennar River, crowned by an imposing 13th-century red granite fortress.', 'https://images.unsplash.com/photo-1518457607834-6e8d80c183c5', 'gandikota_canyon'),
(11, 'Old Goa Spice Plantations', 11, 3, 2, 2400.00, 4.50, 81, 'Lush tropical spice farms along the Mandovi river basin offering curated botanical tours, vanilla groves, and Goan thalis.', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd', 'spice_plantations'),
(12, 'Dzukou Valley', 12, 1, 1, 2600.00, 4.80, 79, 'Rolling emerald sanctuary situated along the Nagaland-Manipur border famous for rare seasonal lilies and serpentine streams.', 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8', 'dzukou_valley'),
(13, 'Bundi Heritage Town', 13, 4, 1, 1900.00, 4.60, 76, 'Historic royal retreat famed for stepwells (baoris), intricate miniature palace murals, and quiet cobbled heritage alleyways.', 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da', 'bundi_palace'),
(14, 'Varkala Cliff', 14, 1, 2, 2800.00, 4.70, 89, 'Dramatic coastal red laterite bluffs overlooking the Arabian Sea, bordered by coconut palms and cliffside seafood cafes.', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470', 'varkala_cliff'),
(15, 'Mandu Fortress Citadel', 15, 4, 1, 1600.00, 4.50, 73, 'Ancient hilltop ruin featuring Jahaz Mahal, Afghan architecture, and romantic legend monuments overlooking the Nimar plains.', 'https://images.unsplash.com/photo-1548013146-72479768bada', 'mandu_fort'),
(16, 'Mechuka Valley', 16, 1, 1, 3200.00, 4.90, 71, 'Enchanting frontier alpine valley inhabited by the Memba tribe, encircled by snow-clad peaks, pine forests, and wooden bridges.', 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e', 'mechuka_valley'),
(17, 'Bir Billing', 17, 2, 3, 3400.00, 4.80, 94, 'Internationally acclaimed paragliding launch site offering scenic Himalayan flights, Tibetan Buddhist monasteries, and ecocafes.', 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99', 'bir_billing'),
(18, 'Landour Colonial Settlement', 18, 3, 2, 3100.00, 4.70, 88, 'Quiet cantonment town perched above Mussoorie, known for deodar forest walks, historic bakeries, and panoramic Himalayan vistas.', 'https://images.unsplash.com/photo-1448375240586-882707db888b', 'landour_hills'),
(19, 'Hampi Heritage Ruins', 19, 4, 3, 2000.00, 4.80, 95, 'UNESCO World Heritage complex of Vijayanagara kingdom ruins set among striking boulder-strewn hills and Tungabhadra riverbanks.', 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220', 'hampi_ruins'),
(20, 'Dhanushkodi Ghost Town', 20, 2, 1, 1500.00, 4.60, 83, 'Hauntingly scenic abandoned coastal settlement at the tip of Pamban Island where the Bay of Bengal meets the Indian Ocean.', 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9', 'dhanushkodi'),
(21, 'Champaner-Pavagadh', 21, 4, 1, 1400.00, 4.50, 74, 'Archeological park with pre-Mughal Islamic architecture, fortified sandstone gates, sacred hill shrines, and deep water tanks.', 'https://images.unsplash.com/photo-1564507592333-c60657eea523', 'champaner_pavagadh'),
(22, 'Kumarakom Backwaters', 22, 1, 2, 3000.00, 4.70, 86, 'Serene archipelago on Vembanad Lake hosting migratory bird sanctuaries, mangrove waterways, and slow-paced canal boat journeys.', 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2', 'kumarakom_backwaters'),
(23, 'Sarafa Night Food Street', 23, 3, 3, 1200.00, 4.80, 93, 'Vibrant midnight street food market converting historic jewelry bazaar into a gourmet haven for Garadu, Poha-Jalebi, and sweets.', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836', 'sarafa_bazaar'),
(24, 'Athirappilly Rainforest Falls', 24, 1, 2, 2200.00, 4.70, 87, 'Majestic 80-foot wide curtain waterfall crashing through dense Western Ghats jungle on the Chalakudy river.', 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9', 'athirappilly_waterfall')
ON CONFLICT (spot_id) DO UPDATE SET
    name = EXCLUDED.name,
    location_id = EXCLUDED.location_id,
    vibe_id = EXCLUDED.vibe_id,
    crowd_level_id = EXCLUDED.crowd_level_id,
    budget_per_day = EXCLUDED.budget_per_day,
    rating = EXCLUDED.rating,
    popularity = EXCLUDED.popularity,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    image_keyword = EXCLUDED.image_keyword;

SELECT setval('spots_spot_id_seq', (SELECT COALESCE(MAX(spot_id), 1) FROM spots));

-- 7. Spot Tags Associations (M:N)
INSERT INTO spot_tags (spot_id, tag_id) VALUES
(1, 1), (1, 2), (1, 3),        -- Zanskar: trekking, glacier, remote
(2, 4), (2, 5), (2, 1),        -- Tirthan: river, peaceful, trekking
(3, 6), (3, 7), (3, 8),        -- Mawlynnong: living-root-bridges, clean-village, tribal
(4, 9), (4, 10), (4, 11),      -- Chettinad: spicy-cuisine, heritage-mansions, architecture
(5, 1), (5, 12), (5, 5),       -- Chopta: trekking, snow-trek, peaceful
(6, 13), (6, 14), (6, 8),      -- Majuli: river-island, satras, tribal
(7, 15), (7, 16), (7, 28),     -- Gokarna: coastal-trek, chill, sunset
(8, 17), (8, 18), (8, 1),      -- Spiti: monasteries, stargazing, trekking
(9, 7), (9, 8), (9, 19),       -- Khonoma: clean-village, tribal, ecotourism
(10, 20), (10, 21), (10, 1),   -- Gandikota: canyon, gorge, trekking
(11, 22), (11, 23), (11, 16),  -- Old Goa: spices, organic-lunch, chill
(12, 24), (12, 1), (12, 5),    -- Dzukou: seasonal-flowers, trekking, peaceful
(13, 25), (13, 26), (13, 11),  -- Bundi: stepwells, frescoes, architecture
(14, 27), (14, 28), (14, 16),  -- Varkala: red-cliff, sunset, chill
(15, 29), (15, 11), (15, 10),  -- Mandu: jahaz-mahal, architecture, heritage-mansions
(16, 1), (16, 3), (16, 5),     -- Mechuka: trekking, remote, peaceful
(17, 30), (17, 31), (17, 28),  -- Bir Billing: paragliding, tibetan-cafes, sunset
(18, 32), (18, 33), (18, 5),   -- Landour: bakehouse, colonial, peaceful
(19, 34), (19, 11), (19, 1),   -- Hampi: unesco-heritage, architecture, trekking
(20, 35), (20, 3), (20, 15),   -- Dhanushkodi: ghost-town, remote, coastal-trek
(21, 34), (21, 25), (21, 11),  -- Champaner: unesco-heritage, stepwells, architecture
(22, 36), (22, 37), (22, 5),   -- Kumarakom: backwaters, birdwatching, peaceful
(23, 38), (23, 9), (23, 16),   -- Sarafa: street-food, spicy-cuisine, chill
(24, 39), (24, 40), (24, 4)    -- Athirappilly: waterfalls, rainforest, river
ON CONFLICT (spot_id, tag_id) DO NOTHING;
