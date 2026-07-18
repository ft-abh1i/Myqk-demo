'use strict';

(() => {
  const main = document.getElementById('appMain');
  if (!main) return;

  let sent = false;
  let settleTimer = null;

  function hasFinishedInitialRender() {
    const loadingTitle = main.querySelector('.empty-state .title');
    if (loadingTitle?.textContent.trim().toLowerCase() === 'loading nearby stores') return false;

    return Boolean(
      main.querySelector('.featured-store-card')
      || main.querySelector('.store-card')
      || main.querySelector('.home-no-result')
      || loadingTitle
    );
  }

  function announceReady() {
    if (sent || !hasFinishedInitialRender()) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (sent || !hasFinishedInitialRender()) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (sent) return;
        sent = true;
        window.dispatchEvent(new CustomEvent('qk:catalog-ready', {
          detail: { message: 'Loading store photos…' }
        }));
        observer.disconnect();
      }));
    }, 140);
  }

  const observer = new MutationObserver(announceReady);
  observer.observe(main, { childList: true, subtree: true, characterData: true });
  announceReady();
})();
