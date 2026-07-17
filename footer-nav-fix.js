'use strict';

const footerIcons = {
  darkstore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>',
  orders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  track: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>'
};

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

document.addEventListener('DOMContentLoaded', () => {
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
