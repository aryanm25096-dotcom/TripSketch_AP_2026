// src/lib/weather.js
// Queries the backend AI proxy for weather estimates and fetches Wikipedia images.

import { getWikipediaImage } from './wikipedia.js';

const API_BASE = '/api';

export const getWeatherAndInfo = async (location) => {
  try {
    const res = await fetch(`${API_BASE}/ai/weather?place=${encodeURIComponent(location)}`);
    if (!res.ok) {
      return null;
    }

    const weatherData = await res.json();
    const image = await getWikipediaImage(weatherData.wikiTitle, weatherData.searchTerms);

    return {
      ...weatherData,
      image:
        image ||
        `https://loremflickr.com/1200/600/${encodeURIComponent(location)},landscape/all`,
    };
  } catch (error) {
    console.error('[weather] Error fetching weather & info:', error);
    return null;
  }
};
