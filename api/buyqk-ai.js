const DEFAULT_MODEL = 'gemini-2.5-flash';

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve({});
    }
  }

  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function extractGeminiText(data) {
  return (data?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function compactContext(context) {
  return JSON.stringify(context || {}, null, 2).slice(0, 6500);
}

function toGeminiContents(history, message, contextText) {
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  return [
    ...safeHistory.map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(item.content || '').slice(0, 900) }]
    })),
    {
      role: 'user',
      parts: [{ text: `Customer message: ${message}\n\nCurrent BuyQK app context:\n${contextText}` }]
    }
  ];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  const body = await readBody(req);
  const message = String(body.message || '').trim();
  const contextText = compactContext(body.context);

  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const aiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'You are BuyQK AI, a concise shopping assistant inside a local delivery app in India. Help users find products, build budget baskets, understand order status, and make practical purchase suggestions. Reply in the same language style as the user, usually Hinglish for Hindi-English mixed messages. Do not claim a product is available unless it appears in the provided catalog context. Keep answers short and actionable.'
          }]
        },
        contents: toGeminiContents(body.history, message, contextText),
        generationConfig: {
          maxOutputTokens: 420,
          temperature: 0.7
        }
      })
    });

    const data = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      res.status(aiResponse.status).json({
        error: data?.error?.message || 'Gemini request failed.'
      });
      return;
    }

    res.status(200).json({
      reply: extractGeminiText(data) || 'I could not generate a response. Try again.'
    });
  } catch (error) {
    res.status(500).json({
      error: error?.message || 'AI request failed.'
    });
  }
};