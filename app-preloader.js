'use strict';

(() => {
  const root = document.documentElement;
  const body = document.body;
  const preloader = document.getElementById('qkPreloader');
  const status = document.getElementById('qkPreloaderStatus');
  const startedAt = performance.now();
  const minimumVisibleMs = 650;
  const maximumWaitMs = 10000;

  let catalogReady = false;
  let windowLoaded = document.readyState === 'complete';
  let released = false;

  function setViewportHeight() {
    const viewportHeight = Math.round(
      window.visualViewport?.height
      || window.innerHeight
      || document.documentElement.clientHeight
      || 0
    );
    if (viewportHeight > 0) root.style.setProperty('--qk-viewport-height', `${viewportHeight}px`);
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function waitForFonts() {
    if (!document.fonts?.ready) return Promise.resolve();
    return Promise.race([document.fonts.ready.catch(() => undefined), delay(2500)]);
  }

  function waitForImage(image) {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => resolve();
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
      setTimeout(finish, 3500);
    });
  }

  async function waitForRenderedImages() {
    const images = [...document.querySelectorAll('#app img')];
    if (!images.length) return;
    await Promise.all(images.map(waitForImage));
  }

  async function release(force = false) {
    if (released) return;
    if (!force && (!catalogReady || !windowLoaded)) return;

    released = true;
    if (status) status.textContent = 'Opening MyQK…';

    await Promise.all([waitForFonts(), waitForRenderedImages()]);
    const remaining = Math.max(0, minimumVisibleMs - (performance.now() - startedAt));
    if (remaining) await delay(remaining);

    body.classList.remove('qk-preloading');
    body.classList.add('qk-ready');
    preloader?.classList.add('is-leaving');
    setTimeout(() => preloader?.remove(), 280);
  }

  setViewportHeight();
  window.addEventListener('resize', setViewportHeight, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 80);
    setTimeout(setViewportHeight, 350);
  }, { passive: true });
  window.visualViewport?.addEventListener('resize', setViewportHeight, { passive: true });

  window.addEventListener('load', () => {
    windowLoaded = true;
    release();
  }, { once: true });

  window.addEventListener('qk:catalog-ready', (event) => {
    catalogReady = true;
    if (status) status.textContent = event.detail?.message || 'Preparing nearby stores…';
    release();
  }, { once: true });

  setTimeout(() => {
    if (released) return;
    if (status) status.textContent = 'Opening with the available connection…';
    windowLoaded = true;
    catalogReady = true;
    release(true);
  }, maximumWaitMs);
})();
