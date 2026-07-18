const DEFAULT_MODEL = 'gpt-5-mini';

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

function extractText(data) {
  if (data?.output_text) return data.output_text;

  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.text) parts.push(content.text);
    }
  }

  return parts.join('\n').trim();
}

function compactContext(context) {
  return JSON.stringify(context || {}, null, 2).slice(0, 6500);
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
    return;
  }

  const body = await readBody(req);
  const message = String(body.message || '').trim();
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const contextText = compactContext(body.context);

  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  const input = [
    {
      role: 'system',
      content: 'You are BuyQK AI, a concise shopping assistant inside a local delivery app in India. Help users find products, build budget baskets, understand order status, and make practical purchase suggestions. Reply in the same language style as the user, usually Hinglish for Hindi-English mixed messages. Do not claim a product is available unless it appears in the provided catalog context. Keep answers short and actionable.'
    },
    ...history.map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || '').slice(0, 900)
    })),
    {
      role: 'user',
      content: `Customer message: ${message}\n\nCurrent BuyQK app context:\n${contextText}`
    }
  ];

  try {
    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input,
        max_output_tokens: 420,
        store: false
      })
    });

    const data = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      res.status(aiResponse.status).json({
        error: data?.error?.message || 'OpenAI request failed.'
      });
      return;
    }

    res.status(200).json({
      reply: extractText(data) || 'I could not generate a response. Try again.'
    });
  } catch (error) {
    res.status(500).json({
      error: error?.message || 'AI request failed.'
    });
  }
};
