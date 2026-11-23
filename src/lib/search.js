// src/lib/search.js
// Calls backend AI proxy to analyze natural language queries into structured parameters.

const API_BASE = '/api';

export const analyzeSearchQuery = async (query) => {
  try {
    const res = await fetch(`${API_BASE}/ai/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('[search] Error analyzing query:', error);
    return null;
  }
};
