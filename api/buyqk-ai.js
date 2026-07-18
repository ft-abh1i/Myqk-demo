const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
const DEFAULT_MAX_OUTPUT_TOKENS = 1600;
const MAX_CONTEXT_CHARS = 12000;

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
      if (raw.length > 100000) raw = raw.slice(0, 100000);
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
    .filter((part) => part?.text && part?.thought !== true)
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function getFinishReason(data) {
  return data?.candidates?.[0]?.finishReason || '';
}

function compactContext(context) {
  try {
    return JSON.stringify(context || {}, null, 2).slice(0, MAX_CONTEXT_CHARS);
  } catch {
    return '{}';
  }
}

function compactHistory(history) {
  if (!Array.isArray(history)) return 'No previous chat.';

  return history
    .filter((item) => item && ['user', 'assistant'].includes(item.role))
    .slice(-6)
    .map((item) => `${item.role === 'assistant' ? 'BuyQK AI' : 'Customer'}: ${String(item.content || '').slice(0, 700)}`)
    .join('\n') || 'No previous chat.';
}

function outputTokenLimit() {
  const configured = Number.parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '', 10);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(configured, 4096);
}

function normalizeMessage(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isBuyQkRelated(message) {
  const text = message.toLowerCase();
  return /(buyqk|myqk|shop|shopping|store|product|item|price|₹|rs\.?|rupee|budget|basket|cart|order|delivery|deliver|track|rider|merchant|stock|available|availability|grocery|grocer|snack|breakfast|lunch|dinner|milk|bread|egg|fruit|vegetable|medicine|pharmacy|beverage|drink|chips|biscuit|atta|rice|dal|oil|add|checkout|place an order|how to order|buy now)/i.test(text);
}

function isOrderStatusQuestion(message) {
  return /(where|track|status|current|live|what happened).{0,25}order|order.{0,25}(where|track|status|current|live)/i.test(message);
}

function isPlaceOrderQuestion(message) {
  return /(how|where|can i|want to).{0,25}(place|make|create).{0,12}order|how to order|place an order|checkout process/i.test(message);
}

function cleanReply(value) {
  let text = String(value || '').trim();
  if (!text) return '';

  text = text
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text.slice(0, 6000);
}

function parseReply(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return '';

  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(withoutFence);
    if (typeof parsed === 'string') return cleanReply(parsed);
    if (parsed && typeof parsed.reply === 'string') return cleanReply(parsed.reply);
    if (parsed && typeof parsed.answer === 'string') return cleanReply(parsed.answer);
  } catch {
    // Fall back to plain text for providers/models that ignored JSON mode.
  }

  return cleanReply(withoutFence);
}

function looksBroken(text, finishReason) {
  const clean = String(text || '').trim();
  if (!clean || clean.length < 18) return true;
  if (finishReason === 'MAX_TOKENS') return true;
  if (/```|\*\*|\{\s*"(?:reply|answer)"\s*:/.test(clean)) return true;
  if (/\/\s*₹\s*$/.test(clean)) return true;

  const lastWord = clean.split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, '');
  return ['from', 'under', 'with', 'for', 'and', 'or', 'to', 'of', 'the', 'a', 'an'].includes(lastWord);
}

function getOrders(context) {
  return Array.isArray(context?.orders) ? context.orders : [];
}

function getProducts(context) {
  const products = context?.catalog?.products;
  if (!Array.isArray(products)) return [];
  return products
    .map((product) => ({
      name: normalizeMessage(product?.name),
      brand: normalizeMessage(product?.brand),
      unit: normalizeMessage(product?.unit),
      category: normalizeMessage(product?.category),
      price: Number(product?.price || 0),
      storeId: product?.storeId || null
    }))
    .filter((product) => product.name && Number.isFinite(product.price) && product.price > 0);
}

function localAppAnswer(message, context) {
  if (isOrderStatusQuestion(message)) {
    const active = getOrders(context).find((order) => !['Delivered', 'Cancelled', 'Rejected by store', 'completed', 'cancelled', 'merchant_rejected'].includes(order?.status));
    if (!active) {
      return 'You do not have an active order right now. Open the Orders tab to view previous orders, or place a new order from the Store tab.';
    }

    const number = active.orderNumber || 'your order';
    const status = active.status || 'processing';
    const store = active.storeName ? ` from ${active.storeName}` : '';
    return `Order #${number}${store} is currently ${status}. Open the Track tab for the latest live status and rider details.`;
  }

  if (isPlaceOrderQuestion(message)) {
    return [
      'To place an order:',
      '1. Open the Store tab and choose a store.',
      '2. Add the products you need to the cart.',
      '3. Open the cart and review the items.',
      '4. Enter the receiver name and a valid 10-digit phone number.',
      '5. Select your delivery location, then tap Place order.',
      'BuyQK currently allows products from one store per order, and payment is Cash on Delivery.'
    ].join('\n');
  }

  return '';
}

function extractBudget(message) {
  const matches = [...String(message || '').matchAll(/(?:under|within|below|budget(?:\s+of)?|₹|rs\.?|rupees?)\s*[:\-]?\s*(\d{2,6})/gi)];
  if (matches.length) return Number(matches[matches.length - 1][1]);
  const trailing = String(message || '').match(/\b(\d{2,6})\b/);
  return trailing ? Number(trailing[1]) : 0;
}

function basketTerms(message) {
  const text = String(message || '').toLowerCase();
  const terms = new Set(text.match(/[a-z]{3,}/g) || []);

  const groups = {
    snack: ['snack', 'chips', 'biscuit', 'cookie', 'namkeen', 'nuts', 'chocolate', 'popcorn'],
    breakfast: ['breakfast', 'milk', 'bread', 'egg', 'oats', 'cereal', 'banana', 'fruit', 'tea'],
    grocery: ['grocery', 'atta', 'rice', 'dal', 'oil', 'salt', 'sugar'],
    drink: ['drink', 'beverage', 'juice', 'water', 'tea', 'coffee']
  };

  Object.entries(groups).forEach(([key, words]) => {
    if (text.includes(key)) words.forEach((word) => terms.add(word));
  });

  ['want', 'week', 'weekly', 'under', 'budget', 'suggest', 'please', 'find', 'basket', 'items'].forEach((word) => terms.delete(word));
  return [...terms];
}

function buildBasketFallback(message, context) {
  const products = getProducts(context);
  if (!products.length) {
    return 'I could not read the live catalog right now. Open the Store tab to check current products and prices, then try BuyQK AI again.';
  }

  const budget = extractBudget(message);
  const terms = basketTerms(message);
  const ranked = products
    .map((product) => {
      const haystack = `${product.name} ${product.brand} ${product.category}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 3 : 0), 0);
      return { product, score };
    })
    .filter((entry) => !terms.length || entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price);

  const candidates = ranked.length ? ranked.map((entry) => entry.product) : products.sort((a, b) => a.price - b.price);
  const selected = [];
  let total = 0;
  const limit = budget > 0 ? budget : Number.POSITIVE_INFINITY;

  for (const product of candidates) {
    if (selected.length >= 6) break;
    if (total + product.price > limit) continue;
    selected.push(product);
    total += product.price;
  }

  if (!selected.length) {
    const cheapest = candidates[0];
    return budget > 0
      ? `The cheapest matching live item I found is ${cheapest.name}${cheapest.unit ? ` (${cheapest.unit})` : ''} at ₹${Math.round(cheapest.price)}, which is above your ₹${budget} budget.`
      : `I found ${cheapest.name}${cheapest.unit ? ` (${cheapest.unit})` : ''} at ₹${Math.round(cheapest.price)} in the live catalog. Open the Store tab to check availability.`;
  }

  const lines = selected.map((product) => `• ${product.name}${product.unit ? ` (${product.unit})` : ''} — ₹${Math.round(product.price)}`);
  const budgetLine = budget > 0 ? `This stays within your ₹${budget} budget.` : 'Check the Store tab for live availability.';
  return ['Here is a basket using current catalog prices:', ...lines, `Estimated total: ₹${Math.round(total)}.`, budgetLine].join('\n');
}

function buildFallback(message, context) {
  if (/(budget|basket|snack|breakfast|grocery|find|under|₹|rs\.?)/i.test(message)) {
    return buildBasketFallback(message, context);
  }

  return 'I can help with BuyQK products, budget baskets, your cart, orders, delivery tracking, and how to use the app.';
}

function buildPrompt({ message, history, contextText, retry = false }) {
  return `You are BuyQK AI, the shopping assistant inside an Indian local-delivery app.

Current customer message:
${message}

Recent chat history (context only; answer the current message):
${compactHistory(history)}

Current BuyQK app data:
${contextText}

Rules:
1. Answer only about BuyQK shopping, products, prices, budget baskets, cart, orders, delivery, tracking, or app usage.
2. Do not answer unrelated school, grammar, coding, entertainment, or general-knowledge questions. For those, briefly explain your BuyQK scope.
3. Use live catalog product names and prices when they are present in the app data. Never invent an item as currently available.
4. For a budget basket, show useful items, each price, an estimated total, and keep the total at or below the requested budget.
5. For app instructions, give complete numbered steps.
6. Use clear, simple English. Do not use Markdown bold markers, headings with #, code fences, or unfinished fragments.
7. Return ONLY valid JSON in this exact shape: {"reply":"your complete answer"}.
${retry ? '\nThe previous output was malformed or incomplete. Rebuild the answer fully and verify the final JSON before returning it.' : ''}`;
}

function configuredModels() {
  const primary = process.env.GEMINI_MODEL?.trim();
  return primary
    ? [primary, ...DEFAULT_MODELS.filter((model) => model !== primary)]
    : DEFAULT_MODELS;
}

function generationConfig(model) {
  const config = {
    maxOutputTokens: outputTokenLimit(),
    temperature: 0.2,
    topP: 0.8,
    responseMimeType: 'application/json'
  };

  if (/gemini-2\.5/i.test(model)) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  return config;
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
          text: 'You are BuyQK AI. Stay inside BuyQK shopping and delivery support. Give complete, accurate answers based on the supplied app data, and return the requested JSON only.'
        }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: generationConfig(model)
    })
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  const message = normalizeMessage(body.message);
  const context = body.context && typeof body.context === 'object' ? body.context : {};

  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  if (!isBuyQkRelated(message)) {
    res.status(200).json({
      model: 'buyqk-scope-guard',
      reply: 'I am BuyQK’s shopping assistant. I can help with products, budget baskets, your cart, orders, delivery tracking, and how to use the app.',
      finishReason: 'LOCAL_GUARDRAIL'
    });
    return;
  }

  const appAnswer = localAppAnswer(message, context);
  if (appAnswer) {
    res.status(200).json({
      model: 'buyqk-app-guide',
      reply: appAnswer,
      finishReason: 'LOCAL_APP_ANSWER'
    });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  const contextText = compactContext(context);
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

      let reply = parseReply(extractGeminiText(data));
      let finishReason = getFinishReason(data);

      if (looksBroken(reply, finishReason)) {
        prompt = buildPrompt({
          message,
          history: body.history,
          contextText,
          retry: true
        });
        const retryResult = await callGemini({ apiKey, model, prompt });
        if (retryResult.response.ok) {
          const retryReply = parseReply(extractGeminiText(retryResult.data));
          const retryFinishReason = getFinishReason(retryResult.data);
          if (!looksBroken(retryReply, retryFinishReason)) {
            reply = retryReply;
            finishReason = retryFinishReason;
          }
        }
      }

      if (looksBroken(reply, finishReason)) {
        reply = buildFallback(message, context);
        finishReason = 'LOCAL_FALLBACK';
      }

      res.status(200).json({
        model,
        reply,
        finishReason
      });
      return;
    } catch (error) {
      lastError = error?.message || 'Gemini request failed.';
    }
  }

  res.status(200).json({
    model: 'buyqk-local-fallback',
    reply: buildFallback(message, context),
    finishReason: 'PROVIDER_UNAVAILABLE',
    providerError: lastError
  });
};
