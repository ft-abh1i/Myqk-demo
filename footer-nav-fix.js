'use strict';

const footerIcons = {
  darkstore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>',
  orders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  track: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  ai: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.8L18.5 10l-4.7 2.2L12 17l-1.8-4.8L5.5 10l4.7-2.2L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>'
};

const aiMessages = [];
const aiQuickPrompts = [
  'Suggest a breakfast basket under ₹300',
  'Where is my current order?',
  'Find milk, bread, and eggs',
  'Suggest snacks on a budget'
];
let aiRequestInFlight = false;

function ensureAiStylesheet() {
  if (document.querySelector('link[href^="ai-assistant.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'ai-assistant.css?v=20260718-ai-fixed-results-1';
  document.head.appendChild(link);
}

function ensureAiNavTab() {
  if (typeof navTabs === 'undefined' || !Array.isArray(navTabs)) return;
  if (navTabs.some(([id]) => id === 'ai')) return;

  const aiTab = ['ai', 'AI', footerIcons.ai];
  const trackIndex = navTabs.findIndex(([id]) => id === 'track');
  navTabs.splice(trackIndex >= 0 ? trackIndex + 1 : navTabs.length, 0, aiTab);
}

function getCartContext() {
  if (typeof state === 'undefined' || !state.cart) return [];
  return Object.values(state.cart).map(({ product, quantity }) => ({
    name: product?.name || 'Product',
    unit: product?.unit || '',
    price: Number(product?.price || 0),
    quantity: Number(quantity || 0),
    storeId: product?.storeId || null
  }));
}

function getOrderContext() {
  if (typeof state === 'undefined' || !Array.isArray(state.orders)) return [];
  return state.orders.slice(0, 8).map((order) => ({
    orderNumber: order.orderNumber || order.id,
    storeName: order.storeName || 'MyQK Store',
    status: typeof statusLabel === 'function' ? statusLabel(order.status) : order.status,
    rawStatus: order.status || '',
    itemCount: Number(order.itemCount || order.items?.length || 0),
    totalAmount: Number(order.totalAmount || 0)
  }));
}

function aiQueryTerms(message = '') {
  const ignored = new Set(['the', 'and', 'for', 'with', 'under', 'find', 'want', 'need', 'please', 'suggest', 'basket', 'budget', 'week', 'weekly']);
  return (String(message).toLowerCase().match(/[a-z0-9]{2,}/g) || [])
    .filter((term) => !ignored.has(term));
}

function getCatalogContext(message = '') {
  const visibleStores = Array.isArray(window.stores) ? window.stores : (typeof stores !== 'undefined' ? stores : []);
  const visibleProducts = Array.isArray(window.products) ? window.products : (typeof products !== 'undefined' ? products : []);
  const terms = aiQueryTerms(message);

  const rankedProducts = visibleProducts
    .map((product) => {
      const searchable = `${product?.name || ''} ${product?.brand || ''} ${product?.unit || ''} ${product?.category || ''}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (searchable.includes(term) ? 3 : 0), 0);
      return { product, score };
    })
    .sort((a, b) => b.score - a.score || Number(a.product?.price || 0) - Number(b.product?.price || 0));

  return {
    stores: visibleStores.slice(0, 15).map((store) => ({
      id: store.id,
      name: store.name,
      category: store.rawCategory || store.category || '',
      time: store.time || '',
      minimumOrder: Number(store.minimumOrder || 0)
    })),
    products: rankedProducts.slice(0, 80).map(({ product }) => ({
      id: product.id || product.key || '',
      name: product.name || '',
      brand: product.brand || '',
      unit: product.unit || '',
      category: product.category || '',
      price: Number(product.price || 0),
      storeId: product.storeId || null,
      available: product.active !== false && product.inStock !== false
    }))
  };
}

function buildAiContext(message = '') {
  return {
    app: 'BuyQK customer app',
    deliveryLocation: localStorage.getItem('qkLiveLocation') || document.getElementById('locationAddress')?.textContent || 'Not selected',
    appRules: {
      orderFlow: 'Choose one store, add products, open cart, enter receiver name and 10-digit phone number, select delivery location, then tap Place order.',
      oneStorePerOrder: true,
      paymentMode: 'Cash on Delivery'
    },
    cart: getCartContext(),
    orders: getOrderContext(),
    catalog: getCatalogContext(message)
  };
}

function normalizeAiText(value) {
  let text = String(value || '').trim();
  if (!text) return '';

  const withoutFence = text
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(withoutFence);
    if (typeof parsed === 'string') text = parsed;
    else if (typeof parsed?.reply === 'string') text = parsed.reply;
    else if (typeof parsed?.answer === 'string') text = parsed.answer;
    else text = withoutFence;
  } catch {
    text = withoutFence;
  }

  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function aiMessageMarkup(message) {
  const content = normalizeAiText(message.content) || 'I could not generate a response. Please try again.';
  return `<div class="ai-message ${message.role === 'user' ? 'user' : 'assistant'}"><div>${escapeHtml(content)}</div></div>`;
}

function renderAiMessages() {
  const box = document.getElementById('aiMessages');
  if (!box) return;

  const starter = aiMessages.length ? '' : `
    <div class="ai-welcome-card">
      <strong>Ask BuyQK AI</strong>
      <span>Shopping help, product suggestions, budget baskets, and order support.</span>
    </div>`;

  box.innerHTML = `${starter}${aiMessages.map(aiMessageMarkup).join('')}`;
  box.scrollTop = box.scrollHeight;
}

function setAiBusy(busy) {
  aiRequestInFlight = busy;
  const sendButton = document.getElementById('aiSend');
  const input = document.getElementById('aiInput');
  if (sendButton) sendButton.disabled = busy;
  if (input) input.disabled = busy;
  document.querySelectorAll('[data-ai-prompt]').forEach((button) => {
    button.disabled = busy;
  });
}

function renderAiAssistant() {
  ensureAiStylesheet();
  $('appMain').innerHTML = `<div class="view ai-view">
    <div class="ai-quick-row">
      ${aiQuickPrompts.map((prompt) => `<button type="button" data-ai-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join('')}
    </div>
    <section class="ai-chat-card" aria-label="BuyQK AI chat">
      <div class="ai-messages" id="aiMessages"></div>
      <form class="ai-form" id="aiForm">
        <input id="aiInput" type="text" maxlength="240" autocomplete="off" placeholder="Ask BuyQK AI...">
        <button id="aiSend" type="submit">Send</button>
      </form>
    </section>
  </div>`;
  renderAiMessages();
  setAiBusy(aiRequestInFlight);
}

async function askBuyQkAi(text) {
  const message = String(text || '').trim();
  if (!message || aiRequestInFlight) return;

  const previousMessages = aiMessages.slice(-8);
  aiMessages.push({ role: 'user', content: message });
  aiMessages.push({ role: 'assistant', content: 'Thinking…' });
  renderAiMessages();
  setAiBusy(true);

  try {
    const response = await fetch('/api/buyqk-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: previousMessages,
        context: buildAiContext(message)
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'AI is temporarily unavailable.');

    const reply = normalizeAiText(data.reply);
    if (!reply) throw new Error('AI returned an empty response.');

    aiMessages[aiMessages.length - 1] = {
      role: 'assistant',
      content: reply
    };
  } catch (error) {
    const messageText = error?.message || '';
    aiMessages[aiMessages.length - 1] = {
      role: 'assistant',
      content: messageText.includes('GEMINI_API_KEY') || messageText.includes('GOOGLE_API_KEY')
        ? 'BuyQK AI is not configured on the server yet.'
        : 'BuyQK AI is temporarily unavailable. Please try again.'
    };
  } finally {
    setAiBusy(false);
    renderAiMessages();
    document.getElementById('aiInput')?.focus();
  }
}

function installAiTabRenderer() {
  if (typeof renderMain !== 'function' || renderMain.qkAiWrapped) return;

  const originalRenderMain = renderMain;
  renderMain = function renderMainWithAiTab() {
    if (typeof state !== 'undefined' && state.activeTab === 'ai') {
      renderAiAssistant();
      return;
    }

    return originalRenderMain();
  };
  renderMain.qkAiWrapped = true;
}

function polishFooterNav() {
  document.querySelectorAll('#bottomNav .nav-item').forEach((button) => {
    const tab = button.dataset.tab;
    const iconSlot = button.firstElementChild;
    const label = button.querySelector('.nav-label');
    const icon = footerIcons[tab];

    if (iconSlot && icon && iconSlot.innerHTML !== icon) iconSlot.innerHTML = icon;
    if (tab === 'darkstore' && label && label.textContent !== 'Store') label.textContent = 'Store';
  });
}

ensureAiStylesheet();
ensureAiNavTab();
installAiTabRenderer();

document.addEventListener('submit', (event) => {
  if (event.target?.id !== 'aiForm') return;
  event.preventDefault();
  const input = document.getElementById('aiInput');
  const value = input?.value || '';
  if (input) input.value = '';
  askBuyQkAi(value);
});

document.addEventListener('click', (event) => {
  const quickPrompt = event.target.closest('[data-ai-prompt]');
  if (quickPrompt && !quickPrompt.disabled) {
    askBuyQkAi(quickPrompt.dataset.aiPrompt || quickPrompt.textContent || '');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  ensureAiStylesheet();
  ensureAiNavTab();
  installAiTabRenderer();

  const nav = document.getElementById('bottomNav');
  if (nav) {
    polishFooterNav();
    new MutationObserver(polishFooterNav).observe(nav, { childList: true });
  }

  if (!document.querySelector('script[src="app-history.js"]')) {
    const historyScript = document.createElement('script');
    historyScript.src = 'app-history.js';
    document.body.appendChild(historyScript);
  }
});
