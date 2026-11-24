// src/lib/favourites.js
// Manages favourites with hybrid persistence (Backend API + LocalStorage fallback)

export const getFavourites = async () => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const res = await fetch('/api/favourites', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.favourites || []);
        // Also cache locally for offline instant load
        localStorage.setItem('tripsketch_favourites', JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn('Could not fetch favourites from backend, using local storage:', e);
    }
  }

  // Local storage fallback
  try {
    const raw = localStorage.getItem('tripsketch_favourites');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveFavourite = async (spot) => {
  if (!spot) return;

  // 1. Save in local storage
  try {
    const raw = localStorage.getItem('tripsketch_favourites');
    const list = raw ? JSON.parse(raw) : [];
    if (!list.some(s => s.id === spot.id || (s.name && s.name === spot.name))) {
      list.unshift(spot);
      localStorage.setItem('tripsketch_favourites', JSON.stringify(list));
    }
    localStorage.setItem(`saved_${spot.id}`, 'true');
    if (spot.name) localStorage.setItem(`saved_${spot.name}`, 'true');
  } catch (e) {
    console.error('Error saving local favourite:', e);
  }

  // 2. Sync to backend if token present
  const token = localStorage.getItem('token');
  if (token) {
    try {
      await fetch(`/api/favourites/${spot.id || ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ spotId: spot.id, spot })
      });
    } catch (e) {
      console.warn('Error syncing favourite to backend:', e);
    }
  }

  window.dispatchEvent(new Event('favourites_updated'));
};

export const removeFavourite = async (spotId, spotName) => {
  // 1. Remove from local storage
  try {
    const raw = localStorage.getItem('tripsketch_favourites');
    const list = raw ? JSON.parse(raw) : [];
    const updated = list.filter(s => s.id !== spotId && (!spotName || s.name !== spotName));
    localStorage.setItem('tripsketch_favourites', JSON.stringify(updated));
    localStorage.removeItem(`saved_${spotId}`);
    if (spotName) localStorage.removeItem(`saved_${spotName}`);
  } catch (e) {
    console.error('Error removing local favourite:', e);
  }

  // 2. Sync to backend if token present
  const token = localStorage.getItem('token');
  if (token && spotId) {
    try {
      await fetch(`/api/favourites/${spotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.warn('Error removing favourite from backend:', e);
    }
  }

  window.dispatchEvent(new Event('favourites_updated'));
};

export const isSpotSaved = (spot) => {
  if (!spot) return false;
  if (localStorage.getItem(`saved_${spot.id}`) === 'true') return true;
  if (spot.name && localStorage.getItem(`saved_${spot.name}`) === 'true') return true;
  try {
    const raw = localStorage.getItem('tripsketch_favourites');
    const list = raw ? JSON.parse(raw) : [];
    return list.some(s => s.id === spot.id || (s.name && s.name === spot.name));
  } catch {
    return false;
  }
};
