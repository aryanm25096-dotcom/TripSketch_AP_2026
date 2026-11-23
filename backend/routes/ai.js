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

  const body = {
    model: 'llama-3.1-8b-instant',
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

module.exports = router;
