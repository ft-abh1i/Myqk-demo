'use strict';

(() => {
  const LOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 30000
  };

  let retryWhenVisible = false;
  let requestInProgress = false;

  const element = (id) => document.getElementById(id);

  function installLocationRequestStyles() {
    if (document.getElementById('qk-location-request-styles')) return;

    const style = document.createElement('style');
    style.id = 'qk-location-request-styles';
    style.textContent = `
      .location-status.qk-location-info,
      .location-status.qk-location-warning,
      .location-status.qk-location-error,
      .location-status.qk-location-success {
        min-height: 0;
        padding: 11px 12px;
        border: 1px solid transparent;
        border-radius: 13px;
        font-weight: 650;
      }

      .location-status.qk-location-info {
        border-color: #cfe0ff;
        background: #f2f7ff;
        color: #28558f;
      }

      .location-status.qk-location-warning {
        border-color: #f5d88a;
        background: #fff8df;
        color: #72520a;
      }

      .location-status.qk-location-error {
        border-color: #f2c2bd;
        background: #fff1ef;
        color: #9f2d24;
      }

      .location-status.qk-location-success {
        border-color: #bce1c9;
        background: #edf9f1;
        color: #17633a;
      }

      .location-access-btn.qk-location-retry {
        background: #f8c944;
        color: #061a3b;
        box-shadow: 0 8px 18px rgba(248, 201, 68, .26);
      }

      .location-access-btn:disabled {
        cursor: wait;
        opacity: .72;
      }
    `;
    document.head.appendChild(style);
  }

  function setStatus(message, type = 'info') {
    const status = element('locationStatus');
    if (!status) return;

    status.textContent = message;
    status.classList.remove(
      'qk-location-info',
      'qk-location-warning',
      'qk-location-error',
      'qk-location-success'
    );
    status.classList.add(`qk-location-${type}`);
  }

  function prepareButton(text, retry = false) {
    const button = element('allowLocationBtn');
    if (!button) return;

    button.classList.remove('hidden');
    button.classList.toggle('qk-location-retry', retry);
    button.disabled = false;
    button.textContent = text;
  }

  function openLocationRequestSheet() {
    const sheet = element('locationSheet');
    const detected = element('detectedLocationBox');
    const manual = element('manualAddressBox');

    sheet?.classList.add('show');
    detected?.classList.add('hidden');
    manual?.classList.add('hidden');
    prepareButton('Allow location access');
    setStatus('BuyQK ko nearby stores aur accurate delivery ke liye aapki location chahiye.', 'info');
  }

  async function reverseGeocode(latitude, longitude) {
    const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return fallback;
      const data = await response.json();
      return data.display_name || fallback;
    } catch {
      return fallback;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function handleLocationSuccess(position) {
    retryWhenVisible = false;

    const { latitude, longitude, accuracy } = position.coords;
    const coordinates = {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      accuracy: Math.round(accuracy || 0)
    };

    localStorage.setItem('qkLocationCoords', JSON.stringify(coordinates));

    const button = element('allowLocationBtn');
    const detectedBox = element('detectedLocationBox');
    const detectedText = element('detectedLocationText');
    const manualBox = element('manualAddressBox');

    if (button) button.classList.add('hidden');
    detectedBox?.classList.remove('hidden');
    manualBox?.classList.remove('hidden');

    setStatus('Location mil gayi. Ab apna exact house, flat ya landmark add karo.', 'success');

    const detectedLocation = await reverseGeocode(latitude, longitude);
    if (detectedText) detectedText.textContent = detectedLocation;
    localStorage.setItem('qkDetectedLocation', detectedLocation);
  }

  function handleLocationError(error) {
    const manual = element('manualAddressBox');
    manual?.classList.remove('hidden');

    switch (Number(error?.code)) {
      case 1:
        retryWhenVisible = false;
        setStatus(
          'Location permission blocked hai. Address bar ke site controls me jaakar Location ko Allow karo, phir retry karo.',
          'error'
        );
        prepareButton('Permission allow karke retry', true);
        break;

      case 2:
        retryWhenVisible = true;
        setStatus(
          'Phone ki Location/GPS OFF lag rahi hai. Quick Settings se Location ON karo. App par wapas aate hi hum dobara check karenge.',
          'warning'
        );
        prepareButton('Location ON karke retry', true);
        break;

      case 3:
        retryWhenVisible = false;
        setStatus(
          'Location detect hone me zyada time lag raha hai. Network check karke ya open area me dobara try karo.',
          'warning'
        );
        prepareButton('Location dobara detect karo', true);
        break;

      default:
        retryWhenVisible = false;
        setStatus('Location detect nahi ho saki. Location ON karke dobara try karo.', 'error');
        prepareButton('Try location again', true);
    }
  }

  function requestRequiredLocation() {
    if (requestInProgress) return;

    const sheet = element('locationSheet');
    const button = element('allowLocationBtn');
    if (!sheet || !button) return;

    sheet.classList.add('show');

    if (!window.isSecureContext) {
      element('manualAddressBox')?.classList.remove('hidden');
      setStatus('Live location ke liye secure HTTPS connection required hai.', 'error');
      prepareButton('Location unavailable', true);
      return;
    }

    if (!navigator.geolocation) {
      element('manualAddressBox')?.classList.remove('hidden');
      setStatus('Is browser me live location support nahi hai. Address manually add karo.', 'error');
      prepareButton('Location unavailable', true);
      return;
    }

    requestInProgress = true;
    button.classList.remove('qk-location-retry');
    button.disabled = true;
    button.textContent = 'Checking location…';
    setStatus('Location permission aur GPS status check ho raha hai…', 'info');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        requestInProgress = false;
        handleLocationSuccess(position).catch(() => {
          setStatus('Location mil gayi. Ab exact delivery address add karo.', 'success');
        });
      },
      (error) => {
        requestInProgress = false;
        handleLocationError(error);
      },
      LOCATION_OPTIONS
    );
  }

  function bindLocationRequestFlow() {
    installLocationRequestStyles();

    const allowButton = element('allowLocationBtn');
    const locationButton = element('locationBtn');

    allowButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      requestRequiredLocation();
    }, { capture: true });

    locationButton?.addEventListener('click', () => {
      if (!localStorage.getItem('qkLiveLocation')?.trim()) {
        window.setTimeout(() => {
          prepareButton('Allow location access');
          setStatus('BuyQK ko nearby stores aur accurate delivery ke liye aapki location chahiye.', 'info');
        }, 0);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (
        !document.hidden
        && retryWhenVisible
        && element('locationSheet')?.classList.contains('show')
        && !localStorage.getItem('qkLiveLocation')?.trim()
      ) {
        window.setTimeout(requestRequiredLocation, 350);
      }
    });

    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
        permission.addEventListener?.('change', () => {
          if (
            permission.state === 'granted'
            && element('locationSheet')?.classList.contains('show')
            && !localStorage.getItem('qkLiveLocation')?.trim()
          ) {
            requestRequiredLocation();
          }
        });
      }).catch(() => {});
    }

    const savedLocation = localStorage.getItem('qkLiveLocation')?.trim();
    if (savedLocation) return;

    window.setTimeout(() => {
      openLocationRequestSheet();

      if (sessionStorage.getItem('qkLocationAutoRequestAttempted') === '1') return;
      sessionStorage.setItem('qkLocationAutoRequestAttempted', '1');
      window.setTimeout(requestRequiredLocation, 450);
    }, 550);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLocationRequestFlow, { once: true });
  } else {
    bindLocationRequestFlow();
  }
})();
