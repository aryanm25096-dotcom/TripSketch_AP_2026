// src/lib/askPlace.js
// Calls the backend AI proxy to get concise local guide answers about a place.

const API_BASE = '/api';

export const askAboutPlace = async (placeName, question) => {
  try {
    const res = await fetch(`${API_BASE}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeName, question }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to get answer');
    }

    const data = await res.json();
    return data.answer;
  } catch (error) {
    console.error('[askPlace] Error asking about place:', error);
    return "I'm having trouble retrieving that information right now!";
  }
};
