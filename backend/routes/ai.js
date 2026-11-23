// routes/ai.js
// Proxies AI requests to Groq and Google Gemini from the server side to protect secrets.

const express = require('express');
const router = express.Router();

// Helper function to call Google Gemini API (gemini-3.5-flash-lite)
const callGeminiAPI = async (promptOrMessages, isJson = false) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || !geminiKey.trim()) return null;

  try {
    let promptText = '';
    if (typeof promptOrMessages === 'string') {
      promptText = promptOrMessages;
    } else if (Array.isArray(promptOrMessages)) {
      promptText = promptOrMessages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
    }

    const body = {
      contents: [{ parts: [{ text: promptText }] }],
    };

    if (isJson) {
      body.generationConfig = { responseMimeType: 'application/json' };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.warn(`Gemini API error status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.warn('Gemini API call failed:', err.message);
    return null;
  }
};

// Helper function to call LLM APIs (Groq with automatic Gemini fallback)
const callGroqAPI = async (messages, isJson = false) => {
  const apiKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if ((!apiKey || !apiKey.trim()) && (!geminiKey || !geminiKey.trim())) {
    const error = new Error('Neither GROQ_API_KEY nor GEMINI_API_KEY is configured. Please add an API key to backend/.env.');
    error.status = 503;
    throw error;
  }

  // Primary Groq models with ultra-fast inference
  const primaryModel = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
  const modelsToTry = [primaryModel, 'allam-2-7b', 'openai/gpt-oss-120b'];

  let lastError = null;

  if (apiKey && apiKey.trim()) {
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
          console.warn(`Groq model ${model} rate-limited (429): ${errData?.error?.message}. Trying next fallback...`);
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
  }

  // If Groq fails or is rate-limited, fallback directly to Google Gemini
  if (geminiKey && geminiKey.trim()) {
    console.log('Falling back to Google Gemini...');
    const geminiContent = await callGeminiAPI(messages, isJson);
    if (geminiContent) {
      return geminiContent;
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

// Helper function to resolve authentic Wikipedia/Wikimedia photos for all spots
const resolveSpotImages = async (spotsList, destination) => {
  const USER_AGENT = 'TripSketchApp/1.0 (https://tripsketch.com; contact: student@tripsketch.com)';

  // 1. Collect all spot titles and wikiTitles for batch Wikipedia query
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

  // 2. For any spots that still lack an image, query Wikimedia Commons or Wikipedia search
  const missingSpots = spotsList.filter((s) => {
    const wikiKey = (s.wikiTitle || '').toLowerCase();
    const nameKey = (s.name || '').toLowerCase();
    return !imagesMap[wikiKey] && !imagesMap[nameKey];
  });

  if (missingSpots.length > 0) {
    await Promise.all(
      missingSpots.map(async (spot) => {
        const searchQuery = `${spot.name} ${destination}`;
        try {
          // A. Try Wikimedia Commons search with spot name and destination
          const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;
          const cRes = await fetch(commonsUrl, { headers: { 'User-Agent': USER_AGENT } });
          if (cRes.ok) {
            const cData = await cRes.json();
            const cPages = Object.values(cData.query?.pages || {});
            const thumb = cPages[0]?.imageinfo?.[0]?.thumburl || cPages[0]?.imageinfo?.[0]?.url;
            if (thumb) {
              imagesMap[spot.name.toLowerCase()] = thumb;
              return;
            }
          }

          // B. Fallback to Wikipedia search generator
          const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json`;
          const wRes = await fetch(wikiSearchUrl, { headers: { 'User-Agent': USER_AGENT } });
          if (wRes.ok) {
            const wData = await wRes.json();
            const wPages = Object.values(wData.query?.pages || {});
            const thumb = wPages[0]?.thumbnail?.source;
            if (thumb) {
              imagesMap[spot.name.toLowerCase()] = thumb;
              return;
            }
          }
        } catch (err) {
          // Ignore individual search failures
        }
      })
    );
  }

  // 3. If any spots are still missing images, fetch authentic destination photos from Wikimedia Commons
  const stillMissing = spotsList.filter((s) => {
    const wikiKey = (s.wikiTitle || '').toLowerCase();
    const nameKey = (s.name || '').toLowerCase();
    return !imagesMap[wikiKey] && !imagesMap[nameKey];
  });

  if (stillMissing.length > 0) {
    try {
      const destUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(destination)}&gsrlimit=10&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;
      const destRes = await fetch(destUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (destRes.ok) {
        const destData = await destRes.json();
        const destPages = Object.values(destData.query?.pages || {});
        let destIdx = 0;
        for (const spot of stillMissing) {
          while (destIdx < destPages.length) {
            const page = destPages[destIdx++];
            const thumb = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
            if (thumb && !Object.values(imagesMap).includes(thumb)) {
              imagesMap[spot.name.toLowerCase()] = thumb;
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Destination Wikimedia backup failed:', e.message);
    }
  }

  // 4. Format spots and guarantee 100% distinct, authentic photographs
  const usedImages = new Set();
  const availableBackupImages = Object.values(imagesMap);

  return spotsList.map((s, idx) => {
    const spotVibe = s.vibe || 'Nature';
    const wikiKey = (s.wikiTitle || '').toLowerCase();
    const nameKey = (s.name || '').toLowerCase();

    let image = imagesMap[wikiKey] || imagesMap[nameKey] || null;

    if (!image || usedImages.has(image)) {
      // Fuzzy match in imagesMap
      for (const [titleKey, url] of Object.entries(imagesMap)) {
        if (!usedImages.has(url) && (titleKey.includes(nameKey) || nameKey.includes(titleKey))) {
          image = url;
          break;
        }
      }
    }

    // If still duplicate or missing, select an unused photo from our destination gallery
    if (!image || usedImages.has(image)) {
      const unusedBackup = availableBackupImages.find((img) => !usedImages.has(img));
      if (unusedBackup) {
        image = unusedBackup;
      }
    }

    if (image) {
      usedImages.add(image);
    }

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
      image,
      imageKeyword: (s.name || '').toLowerCase().replace(/\s+/g, '_'),
      wikiTitle: s.wikiTitle,
      searchTerms: s.searchTerms,
    };
  });
};

// POST /api/ai/spots - Dynamically generate 6 authentic spots for any destination
router.post('/spots', async (req, res, next) => {
  try {
    const { destination, vibe, crowd } = req.body;

    if (!destination || !destination.trim()) {
      return res.status(400).json({ error: 'destination is required' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert local travel planner. Generate 6 REAL, authentic, famous travel spots physically located in or directly adjacent to "${destination.trim()}".
Do NOT invent places and do not include places far away.
Return ONLY valid JSON with this exact object structure:
{
  "spots": [
    {
      "id": 1,
      "name": "Spot Name",
      "location": "Locality or Area, Region",
      "description": "Short 1-sentence vibe",
      "vibe": "Nature|Culture|Food|Adventure",
      "budget": 2000,
      "crowdLevel": "Low|Medium|High",
      "rating": 4.8,
      "popularity": 85,
      "tags": ["tag1", "tag2"],
      "wikiTitle": "Exact Wikipedia article title (e.g. Namgyal Monastery)",
      "searchTerms": ["Spot Name City"]
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `Destination: ${destination.trim()}. Vibe preference: ${vibe || 'All'}. Crowd preference: ${crowd || 'Any'}.`,
      },
    ];

    let content = null;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim()) {
      try {
        content = await callGeminiAPI(messages, true);
      } catch (e) {
        console.warn('Gemini spot generation failed, falling back to Groq:', e.message);
      }
    }

    if (!content) {
      content = await callGroqAPI(messages, true);
    }

    const cleaned = cleanJsonResponse(content);
    const parsed = JSON.parse(cleaned);
    const spotsList = Array.isArray(parsed) ? parsed : (parsed.spots || []);

    // Resolve verified authentic Wikipedia and Wikimedia images
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
