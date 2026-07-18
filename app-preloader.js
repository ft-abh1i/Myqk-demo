'use strict';

(() => {
  const root = document.documentElement;
  const body = document.body;
  const preloader = document.getElementById('qkPreloader');
  const startedAt = performance.now();
  const minimumVisibleMs = 900;
  const maximumWaitMs = 10000;
  const splashImageUrl = '/buyqk-splash.webp';

  let catalogReady = false;
  let windowLoaded = document.readyState === 'complete';
  let released = false;
  let progressValue = 8;
  let progressTimer = null;
  let status = null;
  let progressBar = null;
  let progressShell = null;

  // Download the local splash immediately and reuse this node in the preloader.
  const splashImage = new Image(941, 1672);
  splashImage.src = splashImageUrl;
  splashImage.alt = 'BuyQK — Local stores, faster delivery';
  splashImage.className = 'qk-image-splash__art';
  splashImage.loading = 'eager';
  splashImage.decoding = 'async';
  splashImage.fetchPriority = 'high';
  splashImage.draggable = false;

  function installSplashStyles() {
    if (document.getElementById('qk-image-splash-styles')) return;

    const style = document.createElement('style');
    style.id = 'qk-image-splash-styles';
    style.textContent = `
      .qk-preloader {
        display: block !important;
        background: #031630 !important;
      }

      .qk-image-splash {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #031630;
      }

      .qk-image-splash__art {
        position: absolute;
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
        max-width: none;
        object-fit: cover;
        object-position: center;
        image-rendering: auto;
        user-select: none;
        -webkit-user-drag: none;
      }

      /* Positioned between the category icons and the printed loading text. */
      .qk-image-splash__loader {
        position: absolute;
        top: 88.5%;
        left: 50%;
        width: min(54vw, 270px);
        height: 5px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, .13);
        border-radius: 999px;
        background: rgba(255, 255, 255, .18);
        box-shadow: 0 4px 18px rgba(0, 0, 0, .22);
        transform: translate(-50%, -50%);
      }

      .qk-image-splash__loader > span {
        display: block;
        width: 8%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #f4aa00 0%, #ffc629 55%, #ffe08a 100%);
        box-shadow: 0 0 12px rgba(255, 190, 35, .56);
        transition: width .3s cubic-bezier(.22, 1, .36, 1);
      }

      .qk-image-splash__status {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      @media (min-width: 560px) {
        .qk-image-splash {
          left: 50%;
          width: min(100%, var(--qk-app-max-width));
          transform: translateX(-50%);
        }
      }

      @media (max-height: 680px) {
        .qk-image-splash__loader {
          top: 88.5%;
          width: min(50vw, 238px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .qk-image-splash__loader > span {
          transition-duration: .01ms;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildSplashScreen() {
    if (!preloader) return;

    installSplashStyles();

    const splash = document.createElement('div');
    splash.className = 'qk-image-splash';

    const loader = document.createElement('div');
    loader.id = 'qkPreloaderProgressShell';
    loader.className = 'qk-image-splash__loader';
    loader.setAttribute('role', 'progressbar');
    loader.setAttribute('aria-label', 'Loading BuyQK');
    loader.setAttribute('aria-valuemin', '0');
    loader.setAttribute('aria-valuemax', '100');
    loader.setAttribute('aria-valuenow', '8');

    const bar = document.createElement('span');
    bar.id = 'qkPreloaderProgress';
    loader.appendChild(bar);

    const statusText = document.createElement('p');
    statusText.id = 'qkPreloaderStatus';
    statusText.className = 'qk-image-splash__status';
    statusText.textContent = 'Preparing BuyQK…';

    splash.append(splashImage, loader, statusText);
    preloader.replaceChildren(splash);

    status = statusText;
    progressBar = bar;
    progressShell = loader;
  }

  function setViewportHeight() {
    const viewportHeight = Math.round(
      window.visualViewport?.height
      || window.innerHeight
      || document.documentElement.clientHeight
      || 0
    );

    if (viewportHeight > 0) {
      root.style.setProperty('--qk-viewport-height', `${viewportHeight}px`);
    }
  }

  function setProgress(value, message) {
    progressValue = Math.max(progressValue, Math.min(100, Math.round(value)));
    if (progressBar) progressBar.style.width = `${progressValue}%`;
    if (progressShell) progressShell.setAttribute('aria-valuenow', String(progressValue));
    if (status && message) status.textContent = message;
  }

  function startMeasuredProgress() {
    setProgress(14, 'Starting BuyQK…');

    progressTimer = window.setInterval(() => {
      const ceiling = catalogReady && windowLoaded
        ? 94
        : catalogReady || windowLoaded
          ? 78
          : 48;

      if (progressValue >= ceiling) return;
      setProgress(progressValue + (progressValue < 35 ? 4 : 2));
    }, 240);
  }

  function stopMeasuredProgress() {
    if (!progressTimer) return;
    clearInterval(progressTimer);
    progressTimer = null;
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

  async function waitForSplashImage() {
    await waitForImage(splashImage);
    if (!splashImage.complete || !splashImage.naturalWidth || !splashImage.decode) return;
    await splashImage.decode().catch(() => undefined);
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
    stopMeasuredProgress();
    setProgress(90, 'Finishing setup…');

    await Promise.all([waitForFonts(), waitForRenderedImages(), waitForSplashImage()]);
    setProgress(100, 'Opening BuyQK…');

    const remaining = Math.max(0, minimumVisibleMs - (performance.now() - startedAt));
    if (remaining) await delay(remaining);
    await delay(120);

    body.classList.remove('qk-preloading');
    body.classList.add('qk-ready');
    preloader?.classList.add('is-leaving');
    setTimeout(() => preloader?.remove(), 280);
  }

  buildSplashScreen();
  setViewportHeight();
  startMeasuredProgress();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setProgress(28, 'Preparing the app…');
    }, { once: true });
  } else {
    setProgress(28, 'Preparing the app…');
  }

  window.addEventListener('resize', setViewportHeight, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 80);
    setTimeout(setViewportHeight, 350);
  }, { passive: true });
  window.visualViewport?.addEventListener('resize', setViewportHeight, { passive: true });

  window.addEventListener('load', () => {
    windowLoaded = true;
    setProgress(catalogReady ? 88 : 62, 'Loading interface…');
    release();
  }, { once: true });

  window.addEventListener('qk:catalog-ready', (event) => {
    catalogReady = true;
    setProgress(windowLoaded ? 88 : 70, event.detail?.message || 'Preparing nearby stores…');
    release();
  }, { once: true });

  if (windowLoaded) setProgress(62, 'Loading interface…');

  setTimeout(() => {
    if (released) return;
    windowLoaded = true;
    catalogReady = true;
    setProgress(92, 'Opening with the available connection…');
    release(true);
  }, maximumWaitMs);
})();