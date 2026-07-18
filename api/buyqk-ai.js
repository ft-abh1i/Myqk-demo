const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
const MAX_OUTPUT_TOKENS = 2048;

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

function getFinishReason(data) {
  return data?.candidates?.[0]?.finishReason || '';
}

function looksIncomplete(text, finishReason) {
  const clean = String(text || '').trim();
  if (!clean) return true;
  if (finishReason === 'MAX_TOKENS') return true;
  if (clean.length < 90) return true;

  const lastWord = clean.split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, '');
  return ['from', 'under', 'with', 'for', 'and', 'or', 'to', 'of', 'the', 'a', 'an'].includes(lastWord);
}

function compactContext(context) {
  return JSON.stringify(context || {}, null, 2).slice(0, 5000);
}

function compactHistory(history) {
  if (!Array.isArray(history)) return 'No previous chat.';

  return history
    .slice(-4)
    .map((item) => `${item.role === 'assistant' ? 'BuyQK AI' : 'Customer'}: ${String(item.content || '').slice(0, 500)}`)
    .join('\n') || 'No previous chat.';
}

function buildPrompt({ message, history, contextText, retry = false }) {
  return `Customer message: ${message}

Recent chat history:
${compactHistory(history)}

Current BuyQK app context:
${contextText}

Answer as BuyQK AI in clear, simple English only. Give the complete answer, not only the opening line. If the exact live catalog is limited, say that clearly and still give a useful practical basket suggestion. Use short sections or bullet points when useful. Do not end mid-sentence.${retry ? '\n\nThe previous response looked incomplete, so rewrite it fully from start to finish.' : ''}`;
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
          text: 'You are BuyQK AI, a helpful shopping assistant inside a local delivery app in India. Always reply in clear, simple English only. Help users find products, build budget baskets, understand order status, and make practical purchase suggestions. If live catalog data is limited, do not stop early. Give a complete practical answer with example items, estimated totals, and a clear note that availability should be checked in the app.'
        }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.6
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

  let lastError = 'Gemini request failed.';

  for (const model of configuredModels()) {
    try {
      let prompt = buildPrompt({
        message,
        history: body.history,
        contextText
      });

      let { response, data } = await callGemini({ apiKey, model, prompt });
      if (!response.ok) {
        lastError = data?.error?.message || `Gemini request failed with status ${response.status}.`;
        continue;
      }

      let reply = extractGeminiText(data);
      let finishReason = getFinishReason(data);

      if (looksIncomplete(reply, finishReason)) {
        prompt = buildPrompt({
          message,
          history: body.history,
          contextText,
          retry: true
        });
        const retryResult = await callGemini({ apiKey, model, prompt });
        if (retryResult.response.ok) {
          const retryReply = extractGeminiText(retryResult.data);
          const retryFinishReason = getFinishReason(retryResult.data);
          if (!looksIncomplete(retryReply, retryFinishReason)) {
            reply = retryReply;
            finishReason = retryFinishReason;
          }
        }
      }

      res.status(200).json({
        model,
        reply: reply || 'I could not generate a complete response. Please try again.',
        finishReason
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
