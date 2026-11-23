// src/lib/spots.js
// 100% Dynamic AI Spot Discovery powered by Groq and real Wikipedia photography via backend.

const API_BASE = '/api';

export const generateSpots = async (destination = '', vibe = 'All', crowd = 'Any') => {
  try {
    const target = destination && destination.trim() ? destination.trim() : 'Gokarna';

    const res = await fetch(`${API_BASE}/ai/spots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: target,
        vibe: vibe || 'All',
        crowd: crowd || 'Any',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server responded with ${res.status}`);
    }

    const data = await res.json();
    return data.spots || [];
  } catch (error) {
    console.error('[spots] Error generating spots with AI:', error);
    return [];
  }
};
