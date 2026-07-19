'use strict';

(() => {
  const HOUSE_KEY = 'qkMapHouseOrFlat';
  const STREET_KEY = 'qkMapStreetOrArea';
  const LANDMARK_KEY = 'qkMapLandmark';
  let observer = null;
  let statusObserver = null;
  let pendingDetails = null;

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

  function installStyles() {
    if (byId('qkMapDetailsStyles')) return;

    const style = document.createElement('style');
    style.id = 'qkMapDetailsStyles';
    style.textContent = `
      .qk-map-center-pin {
        z-index: 700 !important;
      }

      .qk-map-recenter {
        z-index: 750 !important;
      }

      .qk-map-loading {
        z-index: 900 !important;
      }

      .qk-map-address-fields {
        margin-top: 10px;
        display: grid;
        gap: 9px;
      }

      .qk-map-address-field {
        display: grid;
        gap: 5px;
      }

      .qk-map-address-field > span {
        color: var(--soft, #6b7a72);
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: .02em;
      }

      .qk-map-address-field input {
        width: 100%;
        min-height: 44px;
        padding: 0 12px;
        border: 1px solid var(--border, #e7ece8);
        border-radius: 13px;
        outline: 0;
        background: #ffffff;
        color: var(--ink, #16261f);
        font: inherit;
        font-size: 13px;
        -webkit-user-select: text;
        user-select: text;
      }

      .qk-map-address-field input:focus {
        border-color: var(--primary, #1f7a4d);
        box-shadow: 0 0 0 3px rgba(31, 122, 77, .09);
      }

      .qk-map-status:empty {
        display: none;
      }

      .qk-map-picker-foot {
        max-height: 55dvh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      @media (max-height: 720px) {
        .qk-map-address-fields {
          gap: 7px;
        }

        .qk-map-address-field input {
          min-height: 40px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizePart(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^[-,\s]+|[-,\s]+$/g, '')
      .trim();
  }

  function looksLikeAdministrativePart(value) {
    return /\b(india|district|division|west bengal|bihar|uttar pradesh|maharashtra|assam|odisha|jharkhand|rajasthan|punjab|haryana|gujarat|madhya pradesh|chhattisgarh|karnataka|kerala|tamil nadu|telangana|andhra pradesh)\b/i.test(value)
      || /^\d{6}$/.test(value);
  }

  function deriveStreetOrArea(address) {
    const parts = String(address || '')
      .split(',')
      .map(normalizePart)
      .filter(Boolean)
      .filter((part) => !looksLikeAdministrativePart(part));

    const roadLike = parts.find((part) => /\b(road|street|lane|highway|nh\s?\d+|sh\s?\d+|marg|path|colony|nagar|market|bazar|chowk|station|more|turn|bridge)\b/i.test(part));
    if (roadLike) return roadLike;

    return parts.slice(0, 2).join(', ');
  }

  function removeRedundantStatus(status) {
    if (!status) return;
    const text = normalizePart(status.textContent);
    if (/^pin ko exact building\b/i.test(text)) status.textContent = '';
  }

  function enhancePicker() {
    const picker = byId('qkMapPicker');
    const selectedAddress = byId('qkSelectedAddress');
    const foot = picker?.querySelector('.qk-map-picker-foot');
    if (!picker || !selectedAddress || !foot) return false;

    if (!byId('qkMapAddressFields')) {
      selectedAddress.closest('.qk-selected-address')?.insertAdjacentHTML('afterend', `
        <div id="qkMapAddressFields" class="qk-map-address-fields">
          <label class="qk-map-address-field">
            <span>HOUSE / FLAT / FLOOR *</span>
            <input id="qkMapHouseInput" type="text" maxlength="100" autocomplete="address-line1" placeholder="Example: Flat 302, 3rd floor">
          </label>
          <label class="qk-map-address-field">
            <span>STREET / ROAD / AREA *</span>
            <input id="qkMapStreetInput" type="text" maxlength="120" autocomplete="address-line2" placeholder="Example: Station Road or Ward 4">
          </label>
          <label class="qk-map-address-field">
            <span>NEARBY LANDMARK (OPTIONAL)</span>
            <input id="qkMapLandmarkInput" type="text" maxlength="120" autocomplete="off" placeholder="Example: Near school, market or temple">
          </label>
        </div>`);

      const houseInput = byId('qkMapHouseInput');
      const streetInput = byId('qkMapStreetInput');
      const landmarkInput = byId('qkMapLandmarkInput');
      houseInput.value = localStorage.getItem(HOUSE_KEY) || '';
      streetInput.value = localStorage.getItem(STREET_KEY) || '';
      landmarkInput.value = localStorage.getItem(LANDMARK_KEY) || '';

      streetInput.addEventListener('input', () => {
        streetInput.dataset.touched = 'true';
      });
    }

    if (!selectedAddress.dataset.qkDetailsObserved) {
      selectedAddress.dataset.qkDetailsObserved = 'true';
      observer = new MutationObserver(() => {
        const streetInput = byId('qkMapStreetInput');
        if (!streetInput || streetInput.dataset.touched === 'true') return;
        const detected = deriveStreetOrArea(selectedAddress.textContent);
        if (detected) streetInput.value = detected;
      });
      observer.observe(selectedAddress, { childList: true, characterData: true, subtree: true });
    }

    const mapStatus = byId('qkMapStatus');
    if (mapStatus && !mapStatus.dataset.qkInstructionObserved) {
      mapStatus.dataset.qkInstructionObserved = 'true';
      statusObserver = new MutationObserver(() => removeRedundantStatus(mapStatus));
      statusObserver.observe(mapStatus, { childList: true, characterData: true, subtree: true });
      removeRedundantStatus(mapStatus);
    }

    const detected = deriveStreetOrArea(selectedAddress.textContent);
    const streetInput = byId('qkMapStreetInput');
    if (streetInput && !streetInput.value && detected) streetInput.value = detected;

    return true;
  }

  function validateConfirm(event) {
    const button = event.target.closest('#qkConfirmMapLocation');
    if (!button) return;

    const house = normalizePart(byId('qkMapHouseInput')?.value);
    const street = normalizePart(byId('qkMapStreetInput')?.value);
    const landmark = normalizePart(byId('qkMapLandmarkInput')?.value);

    if (!house) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('House / Flat / Floor add karo.', true);
      byId('qkMapHouseInput')?.focus();
      return;
    }

    if (!street) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('Street / Road / Area ka naam add karo.', true);
      byId('qkMapStreetInput')?.focus();
      return;
    }

    pendingDetails = { house, street, landmark };
  }

  function readCoordinates() {
    try {
      const coordinates = JSON.parse(localStorage.getItem('qkLocationCoords') || 'null');
      const latitude = Number(coordinates?.latitude);
      const longitude = Number(coordinates?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return {
        latitude,
        longitude,
        accuracy: Number(coordinates?.accuracy || 0)
      };
    } catch {
      return null;
    }
  }

  function finishLocationSelection(event) {
    if (!event.target.closest('#qkConfirmMapLocation') || !pendingDetails) return;

    const { house, street, landmark } = pendingDetails;
    pendingDetails = null;

    const detected = normalizePart(localStorage.getItem('qkDetectedLocation'));
    const detectedWithStreet = detected.toLowerCase().includes(street.toLowerCase())
      ? detected
      : [street, detected].filter(Boolean).join(', ');
    const fullAddress = [house, landmark, detectedWithStreet].filter(Boolean).join(', ');
    const coordinates = readCoordinates();

    localStorage.setItem(HOUSE_KEY, house);
    localStorage.setItem(STREET_KEY, street);
    localStorage.setItem(LANDMARK_KEY, landmark);
    localStorage.setItem('qkDetectedLocation', detectedWithStreet);
    localStorage.setItem('qkLiveLocation', fullAddress);
    localStorage.setItem('qkAddressDetails', JSON.stringify({
      formattedAddress: detectedWithStreet,
      fullAddress,
      houseOrFlat: house,
      streetOrArea: street,
      landmark,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      accuracy: coordinates?.accuracy || 0,
      source: localStorage.getItem('qkLocationSource') || 'openstreetmap_picker',
      updatedAt: Date.now()
    }));

    const locationAddress = byId('locationAddress');
    if (locationAddress) locationAddress.textContent = fullAddress;

    const detectedText = byId('detectedLocationText');
    if (detectedText) detectedText.textContent = detectedWithStreet;

    const oldHouseInput = byId('houseInput');
    const oldStreetInput = byId('streetInput');
    if (oldHouseInput) oldHouseInput.value = house;
    if (oldStreetInput) oldStreetInput.value = landmark;

    byId('manualAddressBox')?.classList.add('hidden');
    byId('locationSheet')?.classList.remove('show');
    byId('qkMapPicker')?.classList.remove('open');
    document.body.classList.remove('qk-map-picker-open');

    const name = byId('customerNameInput')?.value?.trim() || '';
    const phone = byId('customerPhoneInput')?.value?.replace(/\D/g, '') || '';
    if (name && phone.length === 10 && typeof saveCustomerProfile === 'function') {
      saveCustomerProfile(name, phone, fullAddress).catch(() => {});
    }

    showToast('Delivery location saved.');
  }

  function install() {
    installStyles();

    if (!enhancePicker()) {
      const bodyObserver = new MutationObserver(() => {
        if (enhancePicker()) bodyObserver.disconnect();
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('click', validateConfirm, true);
    document.addEventListener('click', finishLocationSelection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
