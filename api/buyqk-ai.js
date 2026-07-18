const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

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

function compactHistory(history) {
  if (!Array.isArray(history)) return 'No previous chat.';

  return history
    .slice(-6)
    .map((item) => `${item.role === 'assistant' ? 'BuyQK AI' : 'Customer'}: ${String(item.content || '').slice(0, 700)}`)
    .join('\n') || 'No previous chat.';
}

function buildPrompt({ message, history, contextText }) {
  return `Customer message: ${message}

Recent chat history:
${compactHistory(history)}

Current BuyQK app context:
${contextText}

Answer as BuyQK AI. Keep it short, practical, and in the same language style as the customer.`;
}

function configuredModels() {
  const primary = process.env.GEMINI_MODEL?.trim();
  return primary
    ? [primary, ...DEFAULT_MODELS.filter((model) => model !== primary)]
    : DEFAULT_MODELS;
}

async function callGemini({ apiKey, model, prompt }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
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
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: 420,
        temperature: 0.7
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
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

  const prompt = buildPrompt({
    message,
    history: body.history,
    contextText
  });

  let lastError = 'Gemini request failed.';

  for (const model of configuredModels()) {
    try {
      const { response, data } = await callGemini({ apiKey, model, prompt });
      if (!response.ok) {
        lastError = data?.error?.message || `Gemini request failed with status ${response.status}.`;
        continue;
      }

      res.status(200).json({
        model,
        reply: extractGeminiText(data) || 'I could not generate a response. Try again.'
      });
      return;
    } catch (error) {
      lastError = error?.message || 'Gemini request failed.';
    }
  }

  res.status(502).json({
    error: lastError
  });
};
