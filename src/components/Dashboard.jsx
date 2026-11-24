import { useEffect, useMemo, useState } from 'react';
import TripCard from './TripCard';
import {
  Heart, Menu, Sun, Moon, MapPin,
  Sparkles, Search, Grid, Map,
  CloudSun
} from 'lucide-react';
import { getWeatherAndInfo } from '../lib/weather.js';
import { generateSpots } from '../lib/spots.js';
import { generateTripItinerary } from '../lib/itinerary.js';
import { getFavourites, ensureAuthToken } from '../lib/favourites.js';
import ReactMarkdown from 'react-markdown';

export default function Dashboard() {
  const [theme, setTheme] = useState('light');
  const [spots, setSpots] = useState([]);
  const [destination, setDestination] = useState('');
  const [vibe, setVibe] = useState('All');
  const [crowd, setCrowd] = useState('Any');
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('default');
  const [error, setError] = useState(null);
  const [itinerary, setItinerary] = useState(null);
  const [isGeneratingItinerary, setIsGeneratingItinerary] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);
  const [savedItineraryId, setSavedItineraryId] = useState(null);
  const [itineraryTitle, setItineraryTitle] = useState('');
  const [itineraryMsg, setItineraryMsg] = useState('');
  const [favourites, setFavourites] = useState([]);
  const [showFavourites, setShowFavourites] = useState(false);
  const [recentlyViewed] = useState(() => {
    try {
      const raw = localStorage.getItem('recently_viewed');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const vibes = ['All', 'Nature', 'Culture', 'Food', 'Adventure'];
  const crowds = ['Any', 'Quiet', 'Moderate', 'Lively'];

  const filteredSpots = useMemo(() => {
    let result = [...spots];

    // Filter within current spots using the feed's mini-search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          String(s.name || '').toLowerCase().includes(q) ||
          String(s.location || '').toLowerCase().includes(q) ||
          String(s.description || '').toLowerCase().includes(q) ||
          (Array.isArray(s.tags) && s.tags.some((t) => String(t).toLowerCase().includes(q)))
      );
    }

    if (sortOrder === 'price-asc') {
      result.sort((a, b) => a.budget - b.budget);
    } else if (sortOrder === 'price-desc') {
      result.sort((a, b) => b.budget - a.budget);
    } else if (sortOrder === 'rating-desc') {
      result.sort((a, b) => b.rating - a.rating);
    }

    return result;
  }, [spots, searchQuery, sortOrder]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Generate initial AI spots on page load
  useEffect(() => {
    fetchSpots('Gokarna', 'All', 'Any');
  }, []);

  // Load and synchronize favourites
  useEffect(() => {
    const loadFavs = async () => {
      const list = await getFavourites();
      setFavourites(list);
    };
    loadFavs();
    window.addEventListener('favourites_updated', loadFavs);
    return () => window.removeEventListener('favourites_updated', loadFavs);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const fetchSpots = async (dest, v, c) => {
    setIsSearching(true);
    setWeatherInfo(null);
    setError(null);

    try {
      const newSpots = await generateSpots(dest, v, c);
      if (newSpots && newSpots.length > 0) {
        setSpots(newSpots);
      } else {
        setSpots([]);
        setError("We couldn't generate spots for that destination right now. Try another place!");
      }

      if (dest && dest.trim()) {
        const weather = await getWeatherAndInfo(dest);
        if (weather) setWeatherInfo(weather);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Something went wrong. Check your connection!");
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateItinerary = async () => {
    const target = destination.trim() || 'Gokarna';
    setIsGeneratingItinerary(true);
    setShowItinerary(true);
    setSavedItineraryId(null);
    setItineraryTitle(`${target} 3-Day Plan`);
    setItineraryMsg('');
    try {
      const result = await generateTripItinerary(`A ${vibe !== 'All' ? vibe : ''} trip to ${target} with ${crowd !== 'Any' ? crowd : 'moderate'} crowd preference.`);
      setItinerary(result);
    } catch (e) {
      console.error(e);
      setItinerary("Failed to generate itinerary. Please try again.");
    } finally {
      setIsGeneratingItinerary(false);
    }
  };

  const handleSaveItinerary = async () => {
    try {
      const token = await ensureAuthToken();
      const title = itineraryTitle.trim() || `${destination || 'Trip'} Plan`;
      const res = await fetch('/api/itineraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const data = await res.json();
        setSavedItineraryId(data.id);
        setItineraryTitle(data.title);
        setItineraryMsg('Saved! (POST 201 Created)');
      }
    } catch (e) {
      console.error(e);
      setItineraryMsg('Failed to save');
    }
  };

  const handleUpdateItinerary = async () => {
    if (!savedItineraryId) return;
    try {
      const token = await ensureAuthToken();
      const updatedTitle = `${itineraryTitle.replace(' (Updated)', '')} (Updated)`;
      const res = await fetch(`/api/itineraries/${savedItineraryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: updatedTitle })
      });
      if (res.ok) {
        setItineraryTitle(updatedTitle);
        setItineraryMsg('Updated! (PUT 200 OK)');
      }
    } catch (e) {
      console.error(e);
      setItineraryMsg('Failed to update');
    }
  };

  const handleDeleteItinerary = async () => {
    if (!savedItineraryId) return;
    try {
      const token = await ensureAuthToken();
      const res = await fetch(`/api/itineraries/${savedItineraryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setSavedItineraryId(null);
        setItineraryTitle('');
        setItineraryMsg('Deleted! (DELETE 200 OK)');
      }
    } catch (e) {
      console.error(e);
      setItineraryMsg('Failed to delete');
    }
  };

  const handleOpenFavourites = async () => {
    setShowFavourites(true);
    const list = await getFavourites();
    setFavourites(list);
  };

  const handleExplore = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!destination.trim()) return;
    await fetchSpots(destination, vibe, crowd);
  };

  const handleVibeChange = (v) => {
    setVibe(v);
    if (destination.trim()) {
      fetchSpots(destination, v, crowd);
    }
  };

  const handleCrowdChange = (c) => {
    setCrowd(c);
    if (destination.trim()) {
      fetchSpots(destination, vibe, c);
    }
  };

  const handleSurpriseMe = async () => {
    const surprises = [
      'Gokarna, Karnataka',
      'Spiti Valley',
      'Zanskar, Ladakh',
      'Varkala, Kerala',
      'Hampi, Karnataka',
      'Tirthan Valley',
      'Bir Billing',
      'Landour',
    ];
    const randomDest = surprises[Math.floor(Math.random() * surprises.length)];
    setDestination(randomDest);
    setVibe('All');
    setCrowd('Any');
    await fetchSpots(randomDest, 'All', 'Any');
  };

  return (
    <div className={`dashboard ${theme}`}>
      {/* Top Navigation */}
      <nav className="dash-nav">
        <div className="dash-logo">TripSketch</div>
        <div className="dash-icons">
          <button 
            className={`icon-btn ${showFavourites ? 'active' : ''}`} 
            onClick={handleOpenFavourites}
            title="Saved Favourites"
            style={{ position: 'relative' }}
          >
            <Heart 
              size={20} 
              fill={favourites.length > 0 ? '#ff4757' : 'none'} 
              color={favourites.length > 0 ? '#ff4757' : 'currentColor'} 
            />
            {favourites.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ff4757',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: '700',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 5px rgba(255, 71, 87, 0.4)'
              }}>
                {favourites.length}
              </span>
            )}
          </button>
          <button className="icon-btn"><Menu size={20} /></button>
          <button className="icon-btn theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="dash-hero">
        <h1>Where to <span>next?</span></h1>
        <p>Tell us your vibe. We'll find the hidden gems.</p>
      </div>

      {/* Search Card */}
      <div className="search-card">
        <form onSubmit={handleExplore}>
          <div className="input-group">
            <label>Destination</label>
            <div className="location-input">
              <MapPin size={20} color="var(--color-text-muted)" />
              <input
                type="text"
                placeholder="Where do you want to go?"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
          </div>

          <div className="filters-row">
            <div className="filter-group">
              <label>Vibe</label>
              <div className="pills-container">
                {vibes.map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`pill ${vibe === v ? 'active' : ''}`}
                    onClick={() => handleVibeChange(v)}
                  >
                    {v === 'All' ? '🌍' : v === 'Nature' ? '🌿' : v === 'Culture' ? '🏛️' : v === 'Food' ? '🍜' : '⛺'} {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <label>Crowd Tolerance</label>
              <div className="pills-container">
                {crowds.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`pill ${crowd === c ? 'active' : ''}`}
                    onClick={() => handleCrowdChange(c)}
                  >
                    {c === 'Quiet' ? '🧘' : c === 'Moderate' ? '👫' : c === 'Lively' ? '🎉' : ''} {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="action-row">
            <button type="button" className="btn-surprise" onClick={handleSurpriseMe} disabled={isSearching}>
              <Sparkles size={18} /> Surprise Me
            </button>
            <button type="submit" className="btn-explore" disabled={isSearching}>
              <Search size={18} /> {isSearching ? 'Exploring...' : 'Explore'}
            </button>
          </div>
        </form>
      </div>

      {/* Weather Card */}
      {weatherInfo && (
        <div className="weather-card-container">
          <div className="weather-card-image">
            <img src={weatherInfo.image} alt={destination} />
            <div className="weather-overlay">
              <div className="weather-badge">
                <CloudSun size={24} color="#f1c40f" />
                <span>{weatherInfo.temp}</span>
              </div>
            </div>
          </div>
          <div className="weather-info">
            <h4>{destination}</h4>
            <div className="weather-condition">{weatherInfo.condition}</div>
            <div className="weather-desc">{weatherInfo.description}</div>
          </div>
        </div>
      )}

      /* Recently Viewed */
      {recentlyViewed.length > 0 && spots.length === 0 && (
        <div style={{ maxWidth: '1200px', margin: '0 auto 3rem' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', marginBottom: '1rem' }}>Recently Viewed</h3>
          <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
            {recentlyViewed.map(spot => (
              <div key={spot.id} style={{ minWidth: '300px', flex: '0 0 auto' }}>
                <TripCard spot={spot} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed Header */}
      <div className="feed-header">
        <div className="feed-title">
          <h2>Places in <span>{destination || 'Explore'}</span></h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <p>{filteredSpots.length} spots found</p>
            {destination && (
              <button
                className="btn-itinerary"
                onClick={handleGenerateItinerary}
                disabled={isGeneratingItinerary}
              >
                <Sparkles size={14} /> {isGeneratingItinerary ? 'Writing Plan...' : 'Create Full Itinerary'}
              </button>
            )}
          </div>
        </div>
        <div className="feed-controls">

          <div className="mini-search">
            <Search size={16} color="var(--color-text-muted)" />
            <input
              type="text"
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>


          <select
            className="sort-dropdown"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="default">Sort: Default</option>
            <option value="rating-desc">Rating: High to Low</option>
          </select>

          <div className="view-toggles">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>
              <Grid size={18} />
            </button>
            <button className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>
              <Map size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Fix 5: Map view now actually renders differently */}
      {spots.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="sketchbook-grid">
            {filteredSpots.map(spot => (
              <TripCard key={`${spot.id}-${spot.name}`} spot={spot} />
            ))}
          </div>
        ) : (
          <div className="map-placeholder" style={{
            textAlign: 'center',
            padding: '3rem',
            background: 'var(--color-surface)',
            borderRadius: '1rem',
            margin: '1rem 0',
            color: 'var(--color-text-muted)'
          }}>
            <Map size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <p>Map view coming soon — integrate Leaflet.js here</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              {filteredSpots.length} spots ready to be pinned
            </p>
          </div>
        )
      ) : (
        <div className="empty-state">
          {error ? (
            <div className="error-message" style={{ color: 'var(--color-sunset)', textAlign: 'center' }}>
              <p>{error}</p>
              <button className="btn-surprise" onClick={() => setError(null)} style={{ marginTop: '1rem', borderStyle: 'solid' }}>
                Dismiss
              </button>
            </div>
          ) : (
            <>
              <Sparkles size={48} color="var(--color-accent)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <h3>No hidden gems found here yet.</h3>
              <p>Try searching for a destination like Gokarna, Spiti, or Meghalaya!</p>
              <button className="btn-surprise" onClick={handleSurpriseMe} style={{ marginTop: '1.5rem', margin: '1.5rem auto 0' }}>
                Try Surprise Me!
              </button>
            </>
          )}
        </div>
      )}
      {/* Itinerary Modal */}
      {showItinerary && (
        <div className="itinerary-overlay" onClick={() => setShowItinerary(false)}>
          <div className="itinerary-modal" onClick={e => e.stopPropagation()}>
            <div className="itinerary-header">
              <h3>Your <span>{destination}</span> Plan</h3>
              <button className="close-modal" onClick={() => setShowItinerary(false)}>×</button>
            </div>
            <div className="itinerary-body">
              {isGeneratingItinerary ? (
                <div className="itinerary-loader">
                  <div className="spinner"></div>
                  <p>Sketching your perfect journey...</p>
                </div>
              ) : (
                <ReactMarkdown>{itinerary}</ReactMarkdown>
              )}
            </div>
            <div className="itinerary-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {!savedItineraryId ? (
                  <button className="btn-surprise" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }} onClick={handleSaveItinerary}>
                    💾 Save Plan (POST)
                  </button>
                ) : (
                  <>
                    <button className="btn-surprise" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: 'var(--color-ocean, #0077b6)', color: '#fff' }} onClick={handleUpdateItinerary}>
                      ✏️ Rename Plan (PUT)
                    </button>
                    <button className="btn-surprise" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: '#ff4757', color: '#fff' }} onClick={handleDeleteItinerary}>
                      🗑️ Delete Plan (DELETE)
                    </button>
                  </>
                )}
                {itineraryMsg && (
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-leaf, #2ecc71)' }}>
                    {itineraryMsg}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-print" onClick={() => window.print()}>Download PDF</button>
                <button className="btn-close-full" onClick={() => setShowItinerary(false)}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Favourites Modal */}
      {showFavourites && (
        <div className="itinerary-overlay" onClick={() => setShowFavourites(false)}>
          <div className="itinerary-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1000px', maxHeight: '85vh' }}>
            <div className="itinerary-header">
              <h3>Your <span>Saved Favourites</span> ({favourites.length})</h3>
              <button className="close-modal" onClick={() => setShowFavourites(false)}>×</button>
            </div>
            <div className="itinerary-body" style={{ overflowY: 'auto', padding: '1.5rem' }}>
              {favourites.length > 0 ? (
                <div className="sketchbook-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {favourites.map(spot => (
                    <TripCard key={`fav-${spot.id || spot.name}`} spot={spot} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-text-muted)' }}>
                  <Heart size={54} color="#ff4757" style={{ opacity: 0.35, marginBottom: '1rem' }} />
                  <h4 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: 'var(--color-text-main)' }}>No favourites saved yet!</h4>
                  <p style={{ maxWidth: '400px', margin: '0 auto', fontSize: '0.95rem', lineHeight: '1.5' }}>
                    Click the heart icon on any destination card to bookmark your dream spots and access them anytime.
                  </p>
                </div>
              )}
            </div>
            <div className="itinerary-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-close-full" onClick={() => setShowFavourites(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}