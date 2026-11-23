// src/lib/itinerary.js
// Calls the backend AI proxy to generate full markdown itineraries.

const API_BASE = '/api';

export const generateTripItinerary = async (prompt) => {
  try {
    const res = await fetch(`${API_BASE}/ai/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate itinerary');
    }

    const data = await res.json();
    return data.itinerary;
  } catch (error) {
    console.error('[itinerary] Error generating itinerary:', error);
    return "Oops! We couldn't generate the itinerary right now. " + (error.message || '');
  }
};
