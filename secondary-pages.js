'use strict';

(() => {
  const LANGUAGE_KEY = 'qkProfileLanguage';
  const SECONDARY_TABS = new Set(['orders', 'track', 'ai', 'profile']);
  const TITLES = {
    English: { orders: 'Orders', track: 'Track', ai: 'AI', profile: 'Profile', back: 'Back to Dark Store' },
    Hindi: { orders: 'ऑर्डर', track: 'ट्रैक', ai: 'AI', profile: 'प्रोफाइल', back: 'डार्क स्टोर पर वापस जाएं' }
  };

  let main = null;
  let nav = null;
  let observer = null;
  let syncing = false;

  function getLanguage() {
    return localStorage.getItem(LANGUAGE_KEY) === 'Hindi' ? 'Hindi' : 'English';
  }

  function getActiveTab() {
    return nav?.querySelector('[data-tab].active')?.dataset.tab || 'darkstore';
  }

  function headerMarkup(tab) {
    const text = TITLES[getLanguage()];
    return `
      <header class="secondary-topbar" data-secondary-header="true">
        <button class="secondary-back" type="button" aria-label="${text.back}">
          <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 class="secondary-title">${text[tab]}</h1>
      </header>`;
  }

  function goToDarkStore() {
    const darkStoreButton = nav?.querySelector('[data-tab="darkstore"]');
    if (darkStoreButton) darkStoreButton.click();
  }

  function ensureHeader(tab) {
    if (!main || !SECONDARY_TABS.has(tab)) return;

    let header = main.querySelector(':scope > [data-secondary-header="true"]');
    const expectedTitle = TITLES[getLanguage()][tab];

    if (!header) {
      main.insertAdjacentHTML('afterbegin', headerMarkup(tab));
      header = main.querySelector(':scope > [data-secondary-header="true"]');
    }

    const title = header?.querySelector('.secondary-title');
    if (title && title.textContent !== expectedTitle) title.textContent = expectedTitle;

    const backButton = header?.querySelector('.secondary-back');
    if (backButton) {
      backButton.setAttribute('aria-label', TITLES[getLanguage()].back);
      if (!backButton.dataset.bound) {
        backButton.dataset.bound = 'true';
        backButton.addEventListener('click', goToDarkStore);
      }
    }
  }

  function removeHeader() {
    main?.querySelector(':scope > [data-secondary-header="true"]')?.remove();
  }

  function syncSecondaryPage() {
    if (syncing || !main || !nav) return;
    syncing = true;

    const tab = getActiveTab();
    const active = SECONDARY_TABS.has(tab);
    document.body.classList.toggle('secondary-tab-active', active);
    document.body.dataset.secondaryTab = active ? tab : '';

    if (active) {
      ensureHeader(tab);
      main.scrollTop = 0;
    } else {
      removeHeader();
    }

    syncing = false;
  }

  function initialize() {
    main = document.getElementById('appMain');
    nav = document.getElementById('bottomNav');
    if (!main || !nav) {
      console.error('QK secondary page header could not initialize.');
      return;
    }

    document.addEventListener('click', (event) => {
      if (event.target.closest('#bottomNav [data-tab]')) {
        window.requestAnimationFrame(syncSecondaryPage);
      }
    }, true);

    window.addEventListener('storage', (event) => {
      if (event.key === LANGUAGE_KEY) syncSecondaryPage();
    });
    window.addEventListener('qk:languagechange', syncSecondaryPage);

    observer = new MutationObserver(() => {
      window.queueMicrotask(syncSecondaryPage);
    });
    observer.observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    observer.observe(main, { childList: true });

    syncSecondaryPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();