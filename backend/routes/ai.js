// routes/ai.js
// Proxies AI requests to the Groq API from the server side to protect secrets.

const express = require('express');
const router = express.Router();

// Helper function to call the Groq LLM API
const callGroqAPI = async (messages, isJson = false) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    const error = new Error('GROQ_API_KEY is not configured on the server. Please add your Groq API key to backend/.env.');
    error.status = 503;
    throw error;
  }

  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

  const body = {
    model,
    messages,
    max_tokens: 3000,
  };

  if (isJson) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    const error = new Error(errData?.error?.message || `Groq API responded with status ${response.status}`);
    error.status = response.status >= 500 ? 502 : response.status;
    throw error;
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

// Helper function to clean markdown fences from LLM JSON responses
const cleanJsonResponse = (str) => {
  try {
    let cleaned = str.replace(/```json|```/g, '').trim();
    const startIdx = cleaned.search(/[[{]/);
    if (startIdx === -1) return cleaned;
    const closingChar = cleaned[startIdx] === '[' ? ']' : '}';
    const endIdx = cleaned.lastIndexOf(closingChar);
    if (endIdx === -1) return cleaned;
    cleaned = cleaned.substring(startIdx, endIdx + 1);
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
    return cleaned;
  } catch {
    return str;
  }
};

// POST /api/ai/plan - Generate a detailed Markdown travel itinerary
router.post('/plan', async (req, res, next) => {
  try {
    const { destination, vibe, crowd, prompt } = req.body;
    let queryPrompt = prompt;

    if (!queryPrompt && destination) {
      queryPrompt = `A ${vibe && vibe !== 'All' ? vibe : ''} trip to ${destination} with ${crowd && crowd !== 'Any' ? crowd : 'moderate'} crowd preference.`;
    }

    if (!queryPrompt || !queryPrompt.trim()) {
      return res.status(400).json({ error: 'destination or prompt is required' });
    }

    const messages = [
      {
        role: 'system',
        content:
          'You are an expert, local-vibe travel planner. Return a detailed, day-by-day itinerary with offbeat spots, food, and stay suggestions. Keep the tone warm, adventurous, and visually descriptive. Format the response beautifully using Markdown.',
      },
      {
        role: 'user',
        content: `Plan a trip: ${queryPrompt}`,
      },
    ];

    const itinerary = await callGroqAPI(messages, false);
    res.status(200).json({ itinerary });
  } catch (err) {
    if (err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

// POST /api/ai/ask - Ask a question about a specific spot (concise local guide answer)
router.post('/ask', async (req, res, next) => {
  try {
    const { placeName, question } = req.body;

    if (!placeName || !placeName.trim()) {
      return res.status(400).json({ error: 'placeName is required' });
    }
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are a friendly local guide for ${placeName}. Give a helpful, concise answer in under 3 sentences.`,
      },
      {
        role: 'user',
        content: question.trim(),
      },
    ];

    const answer = await callGroqAPI(messages, false);
    res.status(200).json({ placeName, question, answer });
  } catch (err) {
    if (err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

// POST /api/ai/search - Analyze a natural language search query into structured search filters
router.post('/search', async (req, res, next) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }

    const messages = [
      {
        role: 'system',
        content: `Analyze the user's travel search query and extract key JSON parameters. 
Return ONLY a valid JSON object with this structure:
{"vibe":"chill|adventure|food|nature|any","maxBudget":number|null,"tags":["solo","group","pet-friendly","couple"]}
If a field is not mentioned, use null or "any".`,
      },
      {
        role: 'user',
        content: query.trim(),
      },
    ];

    const content = await callGroqAPI(messages, true);
    const cleaned = cleanJsonResponse(content);
    const parsed = JSON.parse(cleaned);

    res.status(200).json(parsed);
  } catch (err) {
    if (err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

// GET /api/ai/weather - Retrieve weather and vibe estimate for a given location
router.get('/weather', async (req, res, next) => {
  try {
    const place = req.query.place || req.query.location;

    if (!place || !place.trim()) {
      return res.status(400).json({ error: 'place query parameter is required (e.g. /api/ai/weather?place=Gokarna)' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are a travel AI. Return ONLY a valid JSON object for the weather/vibe of the given location.
Structure: {
  "temp": "31°C",
  "condition": "Sunny",
  "description": "A quick 1-sentence vibe/weather summary.",
  "wikiTitle": "Exact Wikipedia page title for this destination",
  "searchTerms": ["City Name India", "Destination Landmark"]
}
Make an educated guess for the current season.`,
      },
      {
        role: 'user',
        content: `Weather and vibe for: ${place.trim()}`,
      },
    ];

    const content = await callGroqAPI(messages, true);
    const cleaned = cleanJsonResponse(content);
    const parsed = JSON.parse(cleaned);

    res.status(200).json(parsed);
  } catch (err) {
    if (err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

// Helper function to fetch real Wikipedia photos for a place
const fetchWikipediaImage = async (wikiTitle, searchTerms = [], fallbackVibe = 'Nature') => {
  const candidates = [wikiTitle, ...searchTerms].filter(Boolean);

  for (const query of candidates) {
    try {
      // 1. Direct Wikipedia page summary (accurate and fast)
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const summaryRes = await fetch(summaryUrl, {
        headers: { 'User-Agent': 'TripSketch/1.0 (Travel discovery app; student project)' },
      });

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        if (data.thumbnail?.source) {
          // Request high-resolution image instead of tiny thumbnail
          return data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
        }
        if (data.originalimage?.source) {
          return data.originalimage.source;
        }
      }

      // 2. Wikipedia search API to locate matching article
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=2`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'TripSketch/1.0 (Travel discovery app; student project)' },
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const bestTitle = searchData.query?.search?.[0]?.title;
        if (bestTitle && bestTitle !== query) {
          const matchedSummary = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`,
            { headers: { 'User-Agent': 'TripSketch/1.0 (Travel discovery app; student project)' } }
          );
          if (matchedSummary.ok) {
            const mData = await matchedSummary.json();
            if (mData.thumbnail?.source) {
              return mData.thumbnail.source.replace(/\/\d+px-/, '/800px-');
            }
            if (mData.originalimage?.source) {
              return mData.originalimage.source;
            }
          }
        }
      }
    } catch (e) {
      // Continue to next candidate term
    }
  }

  // Beautiful scenic vibe-based fallbacks if Wikipedia doesn't have a photo
  const vibeFallbacks = {
    nature: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800',
    adventure: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800',
    culture: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&q=80&w=800',
    food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800',
  };
  return vibeFallbacks[String(fallbackVibe).toLowerCase()] || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800';
};

// POST /api/ai/spots - Dynamically generate 6 authentic spots for any destination using Groq
router.post('/spots', async (req, res, next) => {
  try {
    const { destination, vibe, crowd } = req.body;

    if (!destination || !destination.trim()) {
      return res.status(400).json({ error: 'destination is required' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert local travel planner. Generate 6 REAL, authentic travel spots in or near the destination.
Return ONLY valid JSON with this exact object structure:
{
  "spots": [
    {
      "id": 1,
      "name": "Spot Name",
      "location": "Area, Region",
      "description": "Short 1-sentence vibe",
      "vibe": "Nature|Culture|Food|Adventure",
      "budget": 2000,
      "crowdLevel": "Low|Medium|High",
      "rating": 4.8,
      "popularity": 85,
      "tags": ["tag1", "tag2"],
      "wikiTitle": "Exact Wikipedia page name",
      "searchTerms": ["Spot Name City"]
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `Destination: ${destination.trim()}. Vibe: ${vibe || 'All'}. Crowd tolerance: ${crowd || 'Any'}.`,
      },
    ];

    const content = await callGroqAPI(messages, true);
    const cleaned = cleanJsonResponse(content);
    const parsed = JSON.parse(cleaned);
    const spotsList = Array.isArray(parsed) ? parsed : (parsed.spots || []);

    // Resolve real Wikipedia photos in parallel for each spot
    const formatted = await Promise.all(
      spotsList.map(async (s, idx) => {
        const spotVibe = s.vibe || 'Nature';
        const realImage = await fetchWikipediaImage(
          s.wikiTitle || s.name,
          s.searchTerms || [s.name, `${s.name} ${destination}`],
          spotVibe
        );

        return {
          id: s.id || (idx + 100),
          name: s.name,
          location: s.location || destination,
          vibe: spotVibe,
          budget: Number(s.budget) || 2000,
          crowdLevel: s.crowdLevel || 'Low',
          tags: Array.isArray(s.tags) ? s.tags : [],
          rating: Number(s.rating) || 4.7,
          popularity: Number(s.popularity) || 80,
          description: s.description,
          image: realImage,
          imageKeyword: (s.name || '').toLowerCase().replace(/\s+/g, '_'),
          wikiTitle: s.wikiTitle,
          searchTerms: s.searchTerms,
        };
      })
    );

    res.status(200).json({ total: formatted.length, spots: formatted });
  } catch (err) {
    if (err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
