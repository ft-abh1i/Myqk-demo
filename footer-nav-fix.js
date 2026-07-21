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
let aiViewportBaseline = 0;
let aiWindowScrollTop = 0;

function ensureAiStylesheet() {
  if (document.querySelector('link[href^="ai-assistant.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'ai-assistant.css?v=20260721-ios-keyboard-1';
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

function aiProductMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function currentAiProducts() {
  const catalog = Array.isArray(window.products)
    ? window.products
    : (typeof products !== 'undefined' && Array.isArray(products) ? products : []);
  return catalog.filter((product) => product
    && product.key
    && product.storeId
    && Number(product.price || 0) > 0
    && Number(product.stockQuantity || 0) > 0);
}

function recommendedProductsForMessage(message, content) {
  if (message.role !== 'assistant' || content === 'Thinking…') return [];
  const catalog = currentAiProducts();
  if (!catalog.length) return [];

  const chosen = [];
  const chosenKeys = new Set();
  const chosenNames = new Set();
  const references = Array.isArray(message.recommendations) ? message.recommendations : [];
  references.forEach((reference) => {
    const product = catalog.find((item) => String(item.id) === String(reference?.id || '')
      && String(item.storeId) === String(reference?.storeId || ''));
    if (!product || chosenKeys.has(product.key)) return;
    chosenKeys.add(product.key);
    chosenNames.add(aiProductMatchText(product.name));
    chosen.push(product);
  });

  const replyText = ` ${aiProductMatchText(content)} `;
  const textMatches = catalog.map((product) => ({
    product,
    productName: aiProductMatchText(product.name)
  })).filter(({ productName }) => productName && replyText.includes(` ${productName} `));
  const matchCountByStore = new Map();
  textMatches.forEach(({ product, productName }) => {
    if (!matchCountByStore.has(product.storeId)) matchCountByStore.set(product.storeId, new Set());
    matchCountByStore.get(product.storeId).add(productName);
  });
  const preferredStoreId = chosen[0]?.storeId || [...matchCountByStore.entries()]
    .sort((a, b) => b[1].size - a[1].size)[0]?.[0];

  textMatches.forEach(({ product, productName }) => {
    if (chosen.length >= 6 || chosenKeys.has(product.key)) return;
    if (product.storeId !== preferredStoreId || chosenNames.has(productName)) return;
    chosenKeys.add(product.key);
    chosenNames.add(productName);
    chosen.push(product);
  });
  return chosen.slice(0, 6);
}

function aiStoreName(storeId) {
  const catalogStores = Array.isArray(window.stores)
    ? window.stores
    : (typeof stores !== 'undefined' && Array.isArray(stores) ? stores : []);
  return catalogStores.find((store) => store.id === storeId)?.name || 'BuyQK Store';
}

function aiProductImage(product) {
  if (product.image) return product.image;
  if (typeof placeholderImage === 'function') return placeholderImage(product.name || 'Product', 'product');
  return '';
}

function aiProductCartControl(product) {
  const quantity = Number(
    typeof state !== 'undefined' && state.cart?.[product.key]?.quantity
      ? state.cart[product.key].quantity
      : 0
  );
  const key = escapeHtml(product.key);
  const name = escapeHtml(product.name || 'product');
  if (quantity > 0) {
    return `<div class="ai-product-quantity" aria-label="${name} quantity ${quantity}">
      <button type="button" data-cart-change="${key}" data-ai-cart-change data-delta="-1" aria-label="Remove one ${name}">−</button>
      <strong>${quantity}</strong>
      <button type="button" data-cart-change="${key}" data-ai-cart-change data-delta="1" aria-label="Add one more ${name}">+</button>
    </div>`;
  }
  return `<button class="ai-product-add" type="button" data-add="${key}" data-ai-add aria-label="Add ${name} to cart">
    <span>ADD</span><b>+</b>
  </button>`;
}

function aiProductCardMarkup(product) {
  const detail = [product.brand, product.unit].filter(Boolean).join(' · ') || 'Available now';
  const price = typeof money === 'function' ? money(product.price) : `₹${Math.round(Number(product.price || 0))}`;
  return `<article class="ai-product-card">
    <div class="ai-product-image">
      <img src="${escapeHtml(aiProductImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy">
      <span>AI PICK</span>
    </div>
    <div class="ai-product-info">
      <small>${escapeHtml(aiStoreName(product.storeId))}</small>
      <strong>${escapeHtml(product.name)}</strong>
      <p>${escapeHtml(detail)}</p>
      <div class="ai-product-footer"><b>${escapeHtml(price)}</b>${aiProductCartControl(product)}</div>
    </div>
  </article>`;
}

function aiRecommendationsMarkup(productsToShow) {
  if (!productsToShow.length) return '';
  return `<section class="ai-recommendations" aria-label="Recommended products">
    <div class="ai-recommendation-head">
      <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.8L18.5 10l-4.7 2.2L12 17l-1.8-4.8L5.5 10l4.7-2.2L12 3Z"></path></svg></span>
      <div><strong>Recommended products</strong><small>Add directly to your cart</small></div>
    </div>
    <div class="ai-product-row">${productsToShow.map(aiProductCardMarkup).join('')}</div>
  </section>`;
}

function aiMessageMarkup(message) {
  const content = normalizeAiText(message.content) || 'I could not generate a response. Please try again.';
  const role = message.role === 'user' ? 'user' : 'assistant';
  const recommendations = recommendedProductsForMessage(message, content);
  const productClass = recommendations.length ? ' has-products' : '';
  return `<div class="ai-message ${role}${productClass}"><div class="ai-message-copy">${escapeHtml(content)}</div>${aiRecommendationsMarkup(recommendations)}</div>`;
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

function resizeAiInput(input) {
  if (!input) return;
  input.style.height = '42px';
  input.style.height = `${Math.min(Math.max(input.scrollHeight, 42), 84)}px`;
}

function currentAiViewportHeight() {
  return Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight);
}

function syncAiKeyboardLayout() {
  const input = document.getElementById('aiInput');
  const focused = Boolean(input && document.activeElement === input);
  const visualViewport = window.visualViewport;
  const viewportHeight = currentAiViewportHeight();
  const viewportOffsetTop = Math.max(0, Math.round(visualViewport?.offsetTop || 0));

  if (!focused && viewportHeight > aiViewportBaseline) aiViewportBaseline = viewportHeight;
  if (!aiViewportBaseline) aiViewportBaseline = viewportHeight;

  const heightLoss = Math.max(0, aiViewportBaseline - viewportHeight);
  const layoutHeight = Math.max(aiViewportBaseline, viewportHeight + viewportOffsetTop);
  document.documentElement.style.setProperty('--qk-ai-viewport-height', `${viewportHeight}px`);
  document.documentElement.style.setProperty('--qk-ai-viewport-offset-top', `${focused ? viewportOffsetTop : 0}px`);
  document.documentElement.style.setProperty('--qk-ai-layout-height', `${layoutHeight}px`);
  document.body.classList.toggle('qk-ai-input-focused', focused);
  document.body.classList.toggle('qk-ai-keyboard-open', focused && heightLoss > 100);

  if (focused) {
    window.requestAnimationFrame(() => {
      document.getElementById('aiMessages')?.scrollTo({ top: document.getElementById('aiMessages')?.scrollHeight || 0 });
    });
  }
}

function clearAiKeyboardLayout() {
  document.body.classList.remove('qk-ai-input-focused', 'qk-ai-keyboard-open');
  document.documentElement.style.removeProperty('--qk-ai-viewport-height');
  document.documentElement.style.removeProperty('--qk-ai-viewport-offset-top');
  document.documentElement.style.removeProperty('--qk-ai-layout-height');

  window.requestAnimationFrame(() => {
    if (Math.abs(window.scrollY - aiWindowScrollTop) > 1) {
      window.scrollTo({ top: aiWindowScrollTop, left: 0, behavior: 'auto' });
    }
  });
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
      <form class="ai-form" id="aiForm" autocomplete="off" novalidate>
        <textarea id="aiInput" name="buyqk_chat_query" rows="1" maxlength="240" autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true" enterkeyhint="send" inputmode="text" aria-label="Ask BuyQK AI" placeholder="Ask BuyQK AI..." data-lpignore="true" data-1p-ignore="true"></textarea>
        <button id="aiSend" type="submit">Send</button>
      </form>
    </section>
  </div>`;
  renderAiMessages();
  setAiBusy(aiRequestInFlight);
  resizeAiInput(document.getElementById('aiInput'));
  syncAiKeyboardLayout();
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
      content: reply,
      recommendations: Array.isArray(data.recommendations) ? data.recommendations.slice(0, 6) : []
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
    const input = document.getElementById('aiInput');
    if (input) {
      input.focus({ preventScroll: true });
      resizeAiInput(input);
    }
    syncAiKeyboardLayout();
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

    clearAiKeyboardLayout();
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
  if (input) {
    input.value = '';
    resizeAiInput(input);
  }
  askBuyQkAi(value);
});

document.addEventListener('keydown', (event) => {
  if (event.target?.id !== 'aiInput') return;
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    event.target.form?.requestSubmit();
  }
});

document.addEventListener('input', (event) => {
  if (event.target?.id === 'aiInput') resizeAiInput(event.target);
});

document.addEventListener('focusin', (event) => {
  if (event.target?.id !== 'aiInput') return;
  aiWindowScrollTop = window.scrollY;
  aiViewportBaseline = Math.max(aiViewportBaseline, currentAiViewportHeight());
  document.body.classList.add('qk-ai-input-focused');
  syncAiKeyboardLayout();
  window.setTimeout(syncAiKeyboardLayout, 50);
  window.setTimeout(syncAiKeyboardLayout, 250);
  window.setTimeout(syncAiKeyboardLayout, 450);
});

document.addEventListener('focusout', (event) => {
  if (event.target?.id !== 'aiInput') return;
  window.setTimeout(() => {
    if (document.activeElement?.id !== 'aiInput') clearAiKeyboardLayout();
  }, 100);
});

document.addEventListener('click', (event) => {
  const aiCartControl = event.target.closest('[data-ai-add], [data-ai-cart-change]');
  if (aiCartControl) {
    window.requestAnimationFrame(() => {
      if (typeof state !== 'undefined' && state.activeTab === 'ai') renderAiMessages();
    });
    return;
  }

  const quickPrompt = event.target.closest('[data-ai-prompt]');
  if (quickPrompt && !quickPrompt.disabled) {
    askBuyQkAi(quickPrompt.dataset.aiPrompt || quickPrompt.textContent || '');
  }
});

window.visualViewport?.addEventListener('resize', syncAiKeyboardLayout);
window.visualViewport?.addEventListener('scroll', syncAiKeyboardLayout);
window.visualViewport?.addEventListener('scrollend', syncAiKeyboardLayout);
window.addEventListener('resize', syncAiKeyboardLayout);

document.addEventListener('DOMContentLoaded', () => {
  ensureAiStylesheet();
  ensureAiNavTab();
  installAiTabRenderer();
  aiViewportBaseline = currentAiViewportHeight();

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
