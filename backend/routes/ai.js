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

  // qwen/qwen3.8-27b provides ultra-fast inference with no hidden reasoning token overhead
  const primaryModel = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
  const modelsToTry = [primaryModel, 'allam-2-7b', 'openai/gpt-oss-120b'];

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const body = {
        model,
        messages,
        max_tokens: 2000,
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

      if (response.status === 429) {
        const errData = await response.json().catch(() => null);
        console.warn(`Groq model ${model} rate-limited (429): ${errData?.error?.message}. Trying next fallback model...`);
        lastError = new Error(errData?.error?.message || 'Rate limit reached on AI model');
        lastError.status = 429;
        continue;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const error = new Error(errData?.error?.message || `Groq API responded with status ${response.status}`);
        error.status = response.status >= 500 ? 502 : response.status;
        throw error;
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      if (err.status === 429 && modelsToTry.indexOf(model) < modelsToTry.length - 1) {
        continue;
      }
      lastError = err;
      break;
    }
  }

  throw lastError || new Error('All AI models failed');
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

// Helper function to resolve authentic Wikipedia/Wikimedia photos for all spots in one batch request
const resolveSpotImages = async (spotsList, destination) => {
  const USER_AGENT = 'TripSketchApp/1.0 (https://tripsketch.com; contact: student@tripsketch.com)';

  // 1. Collect all spot titles and wikiTitles for a single batch Wikipedia query
  const titleMap = new Map();
  spotsList.forEach((s) => {
    if (s.wikiTitle) titleMap.set(s.wikiTitle.toLowerCase(), s.wikiTitle);
    if (s.name) titleMap.set(s.name.toLowerCase(), s.name);
  });

  const titlesArray = Array.from(titleMap.values());
  const imagesMap = {};

  if (titlesArray.length > 0) {
    try {
      const titlesParam = titlesArray.map((t) => encodeURIComponent(t)).join('|');
      const batchUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&pithumbsize=800&format=json&titles=${titlesParam}`;
      const res = await fetch(batchUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (res.ok) {
        const data = await res.json();
        const pages = data.query?.pages || {};
        for (const page of Object.values(pages)) {
          if (page.thumbnail?.source && page.title) {
            imagesMap[page.title.toLowerCase()] = page.thumbnail.source;
          }
        }
      }
    } catch (e) {
      console.warn('Batch Wikipedia query warning:', e.message);
    }
  }

  // 2. Format spots and match thumbnail images
  return spotsList.map((s, idx) => {
    const spotVibe = s.vibe || 'Nature';
    const wikiKey = (s.wikiTitle || '').toLowerCase();
    const nameKey = (s.name || '').toLowerCase();

    let image = imagesMap[wikiKey] || imagesMap[nameKey] || null;

    if (!image) {
      // Fuzzy match in imagesMap
      for (const [titleKey, url] of Object.entries(imagesMap)) {
        if (titleKey.includes(nameKey) || nameKey.includes(titleKey)) {
          image = url;
          break;
        }
      }
    }

    // Dynamic high quality scenic travel fallback tailored to spot vibe if Wikipedia has no photo
    const vibeFallbacks = {
      nature: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800',
      adventure: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800',
      culture: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&q=80&w=800',
      food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800',
    };

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
      image: image || vibeFallbacks[spotVibe.toLowerCase()] || vibeFallbacks.nature,
      imageKeyword: (s.name || '').toLowerCase().replace(/\s+/g, '_'),
      wikiTitle: s.wikiTitle,
      searchTerms: s.searchTerms,
    };
  });
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
      "wikiTitle": "Exact Wikipedia page title with a photo of this spot",
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

    // Resolve verified authentic Wikipedia images in a single batch request
    const formatted = await resolveSpotImages(spotsList, destination.trim());

    res.status(200).json({ total: formatted.length, spots: formatted });
  } catch (err) {
    if (err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
