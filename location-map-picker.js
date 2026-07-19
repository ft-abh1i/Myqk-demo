'use strict';

(() => {
  const LEAFLET_VERSION = '1.9.4';
  const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
  const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
  const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
  const DEFAULT_ZOOM = 18;
  const NOMINATIM_MIN_INTERVAL = 1100;

  let leafletLoadPromise = null;
  let picker = null;
  let map = null;
  let tileLayer = null;
  let accuracyCircle = null;
  let selectedCoordinates = null;
  let selectedAddress = '';
  let reverseTimer = null;
  let reverseRequestId = 0;
  let gpsAccuracy = 0;
  let lastNominatimRequestAt = 0;
  let nominatimQueue = Promise.resolve();
  const reverseCache = new Map();

  function byId(id) {
    return document.getElementById(id);
  }

  function showToast(message, error = false) {
    if (typeof toast === 'function') {
      toast(message, error);
      return;
    }

    const element = byId('toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    element.classList.toggle('error', error);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => element.classList.remove('show', 'error'), 2800);
  }

  function readCoordinates() {
    try {
      const value = JSON.parse(localStorage.getItem('qkLocationCoords') || 'null');
      if (!value) return null;
      const latitude = Number(value.latitude);
      const longitude = Number(value.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return {
        latitude,
        longitude,
        accuracy: Number(value.accuracy || 0)
      };
    } catch {
      return null;
    }
  }

  function setAddressFieldsMode(mode) {
    const box = byId('manualAddressBox');
    const house = byId('houseInput');
    const street = byId('streetInput');
    const title = box?.querySelector('p');

    if (!box || !house || !street) return;

    house.placeholder = 'House / Flat / Floor *';
    house.setAttribute('aria-label', 'House, flat or floor');
    house.required = true;

    if (mode === 'map') {
      if (title) title.textContent = 'Add delivery details';
      street.placeholder = 'Landmark (optional)';
      street.setAttribute('aria-label', 'Landmark, optional');
      street.required = false;
      box.dataset.addressMode = 'map';
    } else {
      if (title) title.textContent = 'Add exact address';
      street.placeholder = 'Street / Area / Landmark *';
      street.setAttribute('aria-label', 'Street, area or landmark');
      street.required = true;
      box.dataset.addressMode = 'manual';
    }
  }

  function ensurePickerUi() {
    if (picker) return picker;

    const section = document.createElement('section');
    section.id = 'qkMapPicker';
    section.className = 'qk-map-picker';
    section.setAttribute('role', 'dialog');
    section.setAttribute('aria-modal', 'true');
    section.setAttribute('aria-labelledby', 'qkMapPickerTitle');
    section.innerHTML = `
      <div class="qk-map-picker-shell">
        <header class="qk-map-picker-head">
          <button id="qkMapPickerBack" class="qk-map-picker-back" type="button" aria-label="Back">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            <h2 id="qkMapPickerTitle">Confirm delivery location</h2>
            <p>Move the map so the pin is on your building.</p>
          </div>
        </header>

        <form id="qkMapSearchForm" class="qk-map-search" autocomplete="off">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="qkMapSearchInput" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Search area, building or landmark">
          <button type="submit">Search</button>
        </form>

        <div class="qk-map-stage">
          <div id="qkLeafletMap" class="qk-google-map" aria-label="OpenStreetMap location picker"></div>
          <div class="qk-map-center-pin" aria-hidden="true"><span></span></div>
          <button id="qkMapRecenter" class="qk-map-recenter" type="button" aria-label="Use my current location">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
          </button>
          <div id="qkMapLoading" class="qk-map-loading">Loading free map…</div>
        </div>

        <div class="qk-map-picker-foot">
          <div class="qk-selected-address">
            <span>SELECTED LOCATION</span>
            <strong id="qkSelectedAddress">Finding your address…</strong>
          </div>
          <p id="qkMapStatus" class="qk-map-status" aria-live="polite"></p>
          <button id="qkConfirmMapLocation" class="qk-confirm-map" type="button" disabled>Confirm location</button>
        </div>
      </div>`;

    document.body.appendChild(section);
    picker = section;

    byId('qkMapPickerBack')?.addEventListener('click', closePicker);
    byId('qkMapRecenter')?.addEventListener('click', requestAndCenterCurrentLocation);
    byId('qkConfirmMapLocation')?.addEventListener('click', confirmMapLocation);
    byId('qkMapSearchForm')?.addEventListener('submit', searchAddress);

    return picker;
  }

  function loadLeaflet() {
    if (window.L?.map) return Promise.resolve(window.L);
    if (leafletLoadPromise) return leafletLoadPromise;

    leafletLoadPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-qk-leaflet="true"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS;
        link.dataset.qkLeaflet = 'true';
        document.head.appendChild(link);
      }

      const existing = document.querySelector('script[data-qk-leaflet="true"]');
      if (existing) {
        if (window.L?.map) resolve(window.L);
        else {
          existing.addEventListener('load', () => window.L?.map ? resolve(window.L) : reject(new Error('LEAFLET_LOAD_FAILED')), { once: true });
          existing.addEventListener('error', () => reject(new Error('LEAFLET_LOAD_FAILED')), { once: true });
        }
        return;
      }

      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.dataset.qkLeaflet = 'true';
      script.addEventListener('load', () => window.L?.map ? resolve(window.L) : reject(new Error('LEAFLET_LOAD_FAILED')), { once: true });
      script.addEventListener('error', () => reject(new Error('LEAFLET_LOAD_FAILED')), { once: true });
      document.head.appendChild(script);
    }).catch((error) => {
      leafletLoadPromise = null;
      throw error;
    });

    return leafletLoadPromise;
  }

  function updateSelectedAddress(address, loading = false) {
    const addressElement = byId('qkSelectedAddress');
    const confirmButton = byId('qkConfirmMapLocation');
    if (addressElement) addressElement.textContent = address || (loading ? 'Finding your address…' : 'Address not found');
    if (confirmButton) confirmButton.disabled = loading || !selectedCoordinates;
  }

  function setMapStatus(message = '', error = false) {
    const status = byId('qkMapStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function setMapLoading(loading, text = 'Loading free map…') {
    const overlay = byId('qkMapLoading');
    if (!overlay) return;
    overlay.textContent = text;
    overlay.classList.toggle('hidden', !loading);
  }

  function mapCenterCoordinates() {
    const center = map?.getCenter?.();
    if (!center) return null;
    const latitude = Number(center.lat.toFixed(6));
    const longitude = Number(center.lng.toFixed(6));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  }

  function cacheKey(latitude, longitude) {
    return `${Number(latitude).toFixed(5)},${Number(longitude).toFixed(5)}`;
  }

  function nominatimFetch(path, parameters) {
    const request = async () => {
      const elapsed = Date.now() - lastNominatimRequestAt;
      if (elapsed < NOMINATIM_MIN_INTERVAL) {
        await new Promise((resolve) => window.setTimeout(resolve, NOMINATIM_MIN_INTERVAL - elapsed));
      }

      lastNominatimRequestAt = Date.now();
      const query = new URLSearchParams(parameters);
      const response = await fetch(`${NOMINATIM_BASE}${path}?${query.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('ADDRESS_SERVICE_FAILED');
      return response.json();
    };

    const task = nominatimQueue.then(request, request);
    nominatimQueue = task.catch(() => {});
    return task;
  }

  function queueReverseGeocode() {
    window.clearTimeout(reverseTimer);
    selectedCoordinates = mapCenterCoordinates();
    updateSelectedAddress('', true);
    reverseTimer = window.setTimeout(reverseGeocodeMapCenter, 650);
  }

  async function reverseGeocodeMapCenter() {
    const coordinates = mapCenterCoordinates();
    if (!coordinates) return;

    selectedCoordinates = coordinates;
    const key = cacheKey(coordinates.latitude, coordinates.longitude);
    const cached = reverseCache.get(key);
    if (cached) {
      selectedAddress = cached;
      updateSelectedAddress(selectedAddress, false);
      setMapStatus('Pin ko exact building par set karke confirm karo.');
      return;
    }

    const requestId = ++reverseRequestId;
    try {
      const data = await nominatimFetch('/reverse', {
        format: 'jsonv2',
        lat: String(coordinates.latitude),
        lon: String(coordinates.longitude),
        zoom: '18',
        addressdetails: '1'
      });
      if (requestId !== reverseRequestId) return;

      selectedAddress = data?.display_name || `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
      reverseCache.set(key, selectedAddress);
      updateSelectedAddress(selectedAddress, false);
      setMapStatus('Pin ko exact building par set karke confirm karo.');
    } catch (error) {
      if (requestId !== reverseRequestId) return;
      console.warn('OpenStreetMap reverse geocoding failed:', error);
      selectedAddress = `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
      updateSelectedAddress(selectedAddress, false);
      setMapStatus('Address service unavailable hai. Pin verify karke confirm karo.', true);
    }
  }

  function updateAccuracyCircle(center, accuracy) {
    if (!map || !window.L) return;
    if (accuracyCircle) {
      accuracyCircle.remove();
      accuracyCircle = null;
    }
    if (!Number.isFinite(accuracy) || accuracy <= 0) return;

    accuracyCircle = L.circle(center, {
      radius: Math.min(accuracy, 500),
      color: '#1f7a4d',
      weight: 1,
      fillColor: '#1f7a4d',
      fillOpacity: 0.08,
      interactive: false
    }).addTo(map);
  }

  async function initializeMap(center) {
    await loadLeaflet();
    ensurePickerUi();

    const mapElement = byId('qkLeafletMap');
    if (!mapElement) throw new Error('MAP_CONTAINER_MISSING');

    if (!map) {
      map = L.map(mapElement, {
        center: [center.lat, center.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true
      });

      tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
      }).addTo(map);

      tileLayer.on('tileerror', () => {
        setMapStatus('Map tiles load nahi ho rahe. Internet check karo.', true);
      });

      map.on('movestart', () => {
        setMapStatus('Pin move ho raha hai…');
        updateSelectedAddress('', true);
      });
      map.on('moveend zoomend', queueReverseGeocode);
    } else {
      map.setView([center.lat, center.lng], DEFAULT_ZOOM, { animate: false });
    }

    selectedCoordinates = {
      latitude: Number(center.lat),
      longitude: Number(center.lng)
    };
    updateAccuracyCircle([center.lat, center.lng], gpsAccuracy);
    setMapLoading(false);
    window.setTimeout(() => map.invalidateSize({ pan: false }), 50);
    queueReverseGeocode();
  }

  async function openPickerFromCoordinates(coordinates) {
    ensurePickerUi();
    selectedCoordinates = null;
    selectedAddress = '';
    gpsAccuracy = Number(coordinates.accuracy || 0);
    setMapStatus('Map load ho raha hai…');
    setMapLoading(true);
    updateSelectedAddress('', true);
    picker.classList.add('open');
    document.body.classList.add('qk-map-picker-open');

    try {
      await initializeMap({ lat: coordinates.latitude, lng: coordinates.longitude });
    } catch (error) {
      console.error('Free map picker failed:', error);
      closePicker();
      setAddressFieldsMode('manual');

      if (typeof requestCustomerLocation === 'function') {
        showToast('Free map load nahi hua. Current location flow use ho raha hai.', true);
        requestCustomerLocation();
      } else {
        byId('manualAddressBox')?.classList.remove('hidden');
        showToast('Location map load nahi hua. Address manually add karo.', true);
      }
    }
  }

  function closePicker() {
    picker?.classList.remove('open');
    document.body.classList.remove('qk-map-picker-open');
  }

  function geolocationErrorMessage(error) {
    if (error?.code === 1) return 'Location permission blocked hai. Browser settings se permission allow karo.';
    if (error?.code === 2) return 'Phone location/GPS ON karke dobara try karo.';
    if (error?.code === 3) return 'Location detect hone me time lag raha hai. Dobara try karo.';
    return 'Current location detect nahi ho saki.';
  }

  function requestLocationThenOpenMap() {
    const allowButton = byId('allowLocationBtn');
    if (!navigator.geolocation) {
      setAddressFieldsMode('manual');
      byId('manualAddressBox')?.classList.remove('hidden');
      showToast('Is browser me location support nahi hai. Address manually add karo.', true);
      return;
    }

    if (allowButton) {
      allowButton.disabled = true;
      allowButton.textContent = 'Detecting location…';
    }

    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (allowButton) {
        allowButton.disabled = false;
        allowButton.textContent = 'Give location access';
      }

      openPickerFromCoordinates({
        latitude: Number(coords.latitude.toFixed(6)),
        longitude: Number(coords.longitude.toFixed(6)),
        accuracy: Math.round(coords.accuracy || 0)
      });
    }, (error) => {
      if (allowButton) {
        allowButton.disabled = false;
        allowButton.textContent = 'Try location access again';
      }
      setAddressFieldsMode('manual');
      byId('manualAddressBox')?.classList.remove('hidden');
      showToast(geolocationErrorMessage(error), true);
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000
    });
  }

  function requestAndCenterCurrentLocation() {
    if (!navigator.geolocation) return;
    const button = byId('qkMapRecenter');
    if (button) button.disabled = true;
    setMapStatus('Current location dobara detect ho rahi hai…');

    navigator.geolocation.getCurrentPosition(({ coords }) => {
      gpsAccuracy = Math.round(coords.accuracy || 0);
      const center = [
        Number(coords.latitude.toFixed(6)),
        Number(coords.longitude.toFixed(6))
      ];
      map?.setView(center, DEFAULT_ZOOM, { animate: true });
      updateAccuracyCircle(center, gpsAccuracy);
      if (button) button.disabled = false;
    }, (error) => {
      setMapStatus(geolocationErrorMessage(error), true);
      if (button) button.disabled = false;
    }, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15000
    });
  }

  async function searchAddress(event) {
    event.preventDefault();
    const input = byId('qkMapSearchInput');
    const query = input?.value?.trim();
    if (!query || !map) return;

    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setMapStatus('Location search ho rahi hai…');

    try {
      const results = await nominatimFetch('/search', {
        format: 'jsonv2',
        q: query,
        countrycodes: 'in',
        addressdetails: '1',
        limit: '5'
      });
      const result = Array.isArray(results) ? results[0] : null;
      const latitude = Number(result?.lat);
      const longitude = Number(result?.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setMapStatus('Location nahi mili. Area ya landmark ka naam dobara likho.', true);
        return;
      }

      map.setView([latitude, longitude], DEFAULT_ZOOM, { animate: true });
      selectedAddress = result.display_name || query;
      selectedCoordinates = { latitude, longitude };
      updateSelectedAddress(selectedAddress, false);
      setMapStatus('Pin ko exact building par adjust karo.');
    } catch (error) {
      console.warn('OpenStreetMap search failed:', error);
      setMapStatus('Location search abhi available nahi hai. Map ko manually move karo.', true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  function confirmMapLocation() {
    const coordinates = mapCenterCoordinates() || selectedCoordinates;
    if (!coordinates) {
      showToast('Map par location select karo.', true);
      return;
    }

    const address = selectedAddress || `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
    const coordinatePayload = {
      latitude: Number(coordinates.latitude.toFixed(6)),
      longitude: Number(coordinates.longitude.toFixed(6)),
      accuracy: gpsAccuracy
    };

    localStorage.setItem('qkLocationCoords', JSON.stringify(coordinatePayload));
    localStorage.setItem('qkDetectedLocation', address);
    localStorage.setItem('qkLocationSource', 'openstreetmap_picker');
    localStorage.setItem('qkAddressDetails', JSON.stringify({
      formattedAddress: address,
      latitude: coordinatePayload.latitude,
      longitude: coordinatePayload.longitude,
      accuracy: coordinatePayload.accuracy,
      houseOrFlat: '',
      landmark: '',
      source: 'openstreetmap_picker',
      updatedAt: Date.now()
    }));

    const detectedText = byId('detectedLocationText');
    if (detectedText) detectedText.textContent = address;
    byId('detectedLocationBox')?.classList.remove('hidden');
    byId('manualAddressBox')?.classList.remove('hidden');
    byId('allowLocationBtn')?.classList.add('hidden');
    setAddressFieldsMode('map');
    closePicker();

    window.setTimeout(() => byId('houseInput')?.focus(), 120);
  }

  function validateAndStoreExactAddress(event) {
    const house = byId('houseInput')?.value?.trim() || '';
    const landmark = byId('streetInput')?.value?.trim() || '';
    const detected = localStorage.getItem('qkDetectedLocation')?.trim() || '';
    const mode = byId('manualAddressBox')?.dataset.addressMode || (detected ? 'map' : 'manual');

    if (!house) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('House / Flat / Floor add karo.', true);
      byId('houseInput')?.focus();
      return;
    }

    if (mode === 'manual' && !landmark) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('Street / Area / Landmark add karo.', true);
      byId('streetInput')?.focus();
      return;
    }

    const coordinates = readCoordinates();
    const details = {
      formattedAddress: detected,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      accuracy: coordinates?.accuracy || 0,
      houseOrFlat: house,
      landmark,
      source: detected ? (localStorage.getItem('qkLocationSource') || 'detected_location') : 'manual_address',
      updatedAt: Date.now()
    };
    localStorage.setItem('qkAddressDetails', JSON.stringify(details));
  }

  function install() {
    ensurePickerUi();
    setAddressFieldsMode(localStorage.getItem('qkDetectedLocation') ? 'map' : 'manual');

    const allowButton = byId('allowLocationBtn');
    allowButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      requestLocationThenOpenMap();
    }, true);

    byId('saveAddressBtn')?.addEventListener('click', validateAndStoreExactAddress, true);

    const sheet = byId('locationSheet');
    sheet?.addEventListener('transitionend', () => {
      if (!sheet.classList.contains('show')) closePicker();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
