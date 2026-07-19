'use strict';

(() => {
  const MAP_CONFIG_ENDPOINT = '/api/maps-config';
  const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
  const DEFAULT_ZOOM = 18;

  let mapsLoadPromise = null;
  let picker = null;
  let map = null;
  let geocoder = null;
  let selectedCoordinates = null;
  let selectedAddress = '';
  let reverseTimer = null;
  let reverseRequestId = 0;
  let gpsAccuracy = 0;

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
          <div id="qkGoogleMap" class="qk-google-map" aria-label="Google Map location picker"></div>
          <div class="qk-map-center-pin" aria-hidden="true">
            <span></span>
          </div>
          <button id="qkMapRecenter" class="qk-map-recenter" type="button" aria-label="Use my current location">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
          </button>
          <div id="qkMapLoading" class="qk-map-loading">Loading Google Maps…</div>
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

  async function fetchMapsKey() {
    const response = await fetch(MAP_CONFIG_ENDPOINT, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.enabled || !data.apiKey) {
      throw new Error('MAPS_NOT_CONFIGURED');
    }
    return data.apiKey;
  }

  function loadGoogleMaps() {
    if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
    if (mapsLoadPromise) return mapsLoadPromise;

    mapsLoadPromise = fetchMapsKey().then((apiKey) => new Promise((resolve, reject) => {
      const callbackName = '__qkGoogleMapsReady';
      const existing = document.querySelector('script[data-qk-google-maps="true"]');

      window[callbackName] = () => {
        delete window[callbackName];
        if (window.google?.maps?.Map) resolve(window.google.maps);
        else reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
      };

      if (existing) {
        if (window.google?.maps?.Map) resolve(window.google.maps);
        else existing.addEventListener('error', () => reject(new Error('GOOGLE_MAPS_LOAD_FAILED')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.dataset.qkGoogleMaps = 'true';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callbackName}&language=en&region=IN&auth_referrer_policy=origin`;
      script.addEventListener('error', () => {
        delete window[callbackName];
        reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
      }, { once: true });
      document.head.appendChild(script);
    })).catch((error) => {
      mapsLoadPromise = null;
      throw error;
    });

    return mapsLoadPromise;
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

  function setMapLoading(loading, text = 'Loading Google Maps…') {
    const overlay = byId('qkMapLoading');
    if (!overlay) return;
    overlay.textContent = text;
    overlay.classList.toggle('hidden', !loading);
  }

  function mapCenterCoordinates() {
    const center = map?.getCenter?.();
    if (!center) return null;
    const latitude = Number(center.lat().toFixed(6));
    const longitude = Number(center.lng().toFixed(6));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  }

  function queueReverseGeocode() {
    window.clearTimeout(reverseTimer);
    updateSelectedAddress('', true);
    reverseTimer = window.setTimeout(reverseGeocodeMapCenter, 350);
  }

  function reverseGeocodeMapCenter() {
    const coordinates = mapCenterCoordinates();
    if (!coordinates || !geocoder) return;

    selectedCoordinates = coordinates;
    const requestId = ++reverseRequestId;
    geocoder.geocode({
      location: { lat: coordinates.latitude, lng: coordinates.longitude },
      region: 'IN'
    }, (results, status) => {
      if (requestId !== reverseRequestId) return;

      if (status === 'OK' && results?.[0]?.formatted_address) {
        selectedAddress = results[0].formatted_address;
        updateSelectedAddress(selectedAddress, false);
        setMapStatus('Pin ko exact building par set karke confirm karo.');
        return;
      }

      selectedAddress = `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
      updateSelectedAddress(selectedAddress, false);
      setMapStatus('Exact address nahi mila. Pin verify karke confirm karo.', true);
    });
  }

  async function initializeMap(center) {
    await loadGoogleMaps();
    ensurePickerUi();

    if (!geocoder) geocoder = new google.maps.Geocoder();

    const mapElement = byId('qkGoogleMap');
    if (!mapElement) throw new Error('MAP_CONTAINER_MISSING');

    if (!map) {
      map = new google.maps.Map(mapElement, {
        center,
        zoom: DEFAULT_ZOOM,
        clickableIcons: false,
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        rotateControl: false,
        scaleControl: false,
        zoomControl: true,
        gestureHandling: 'greedy',
        backgroundColor: '#e9ecef'
      });

      map.addListener('dragstart', () => {
        setMapStatus('Pin move ho raha hai…');
        updateSelectedAddress('', true);
      });
      map.addListener('idle', queueReverseGeocode);
    } else {
      map.setCenter(center);
      map.setZoom(DEFAULT_ZOOM);
      google.maps.event.trigger(map, 'resize');
    }

    selectedCoordinates = {
      latitude: Number(center.lat),
      longitude: Number(center.lng)
    };
    setMapLoading(false);
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
      console.error('Google Maps picker failed:', error);
      closePicker();
      setAddressFieldsMode('manual');

      if (typeof requestCustomerLocation === 'function') {
        showToast(error?.message === 'MAPS_NOT_CONFIGURED'
          ? 'Google Maps key setup pending. Current location flow use ho raha hai.'
          : 'Google Maps load nahi hua. Current location flow use ho raha hai.', true);
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
      const center = {
        lat: Number(coords.latitude.toFixed(6)),
        lng: Number(coords.longitude.toFixed(6))
      };
      map?.panTo(center);
      map?.setZoom(DEFAULT_ZOOM);
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

  function searchAddress(event) {
    event.preventDefault();
    const input = byId('qkMapSearchInput');
    const query = input?.value?.trim();
    if (!query || !geocoder || !map) return;

    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setMapStatus('Location search ho rahi hai…');

    geocoder.geocode({ address: `${query}, India`, region: 'IN' }, (results, status) => {
      if (submitButton) submitButton.disabled = false;
      if (status !== 'OK' || !results?.[0]?.geometry?.location) {
        setMapStatus('Location nahi mili. Area ya landmark ka naam dobara likho.', true);
        return;
      }

      const result = results[0];
      map.panTo(result.geometry.location);
      map.setZoom(DEFAULT_ZOOM);
      selectedAddress = result.formatted_address || query;
      updateSelectedAddress(selectedAddress, false);
      setMapStatus('Pin ko exact building par adjust karo.');
    });
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
    localStorage.setItem('qkLocationSource', 'google_maps_picker');
    localStorage.setItem('qkAddressDetails', JSON.stringify({
      formattedAddress: address,
      latitude: coordinatePayload.latitude,
      longitude: coordinatePayload.longitude,
      accuracy: coordinatePayload.accuracy,
      houseOrFlat: '',
      landmark: '',
      source: 'google_maps_picker',
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
