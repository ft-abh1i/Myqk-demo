'use strict';

const footerIcons = {
  darkstore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>',
  orders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  track: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  ai: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.8L18.5 10l-4.7 2.2L12 17l-1.8-4.8L5.5 10l4.7-2.2L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>'
};

function ensureAiNavTab() {
  if (typeof navTabs === 'undefined' || !Array.isArray(navTabs)) return;
  if (navTabs.some(([id]) => id === 'ai')) return;

  const aiTab = ['ai', 'AI', footerIcons.ai];
  const trackIndex = navTabs.findIndex(([id]) => id === 'track');
  navTabs.splice(trackIndex >= 0 ? trackIndex + 1 : navTabs.length, 0, aiTab);
}

function installAiTabRenderer() {
  if (typeof renderMain !== 'function' || renderMain.qkAiWrapped) return;

  const originalRenderMain = renderMain;
  renderMain = function renderMainWithAiTab() {
    if (typeof state !== 'undefined' && state.activeTab === 'ai') {
      $('appMain').innerHTML = empty('✦', 'BuyQK AI', 'Coming soon: smart shopping help, product suggestions, and order support.');
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

ensureAiNavTab();
installAiTabRenderer();

document.addEventListener('DOMContentLoaded', () => {
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