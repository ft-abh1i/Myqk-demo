'use strict';

(() => {
  const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'merchant_rejected']);
  const STATUS_META = {
    pending_merchant: {
      title: 'Order placed',
      description: 'Waiting for the store to confirm your order.',
      progress: 10
    },
    merchant_accepted: {
      title: 'Order confirmed',
      description: 'The store has accepted your order.',
      progress: 26
    },
    preparing: {
      title: 'Your items are being packed',
      description: 'The store is carefully getting your order ready.',
      progress: 40
    },
    ready_for_pickup: {
      title: 'Ready for pickup',
      description: 'We are finding a delivery partner near the store.',
      progress: 56
    },
    accepted: {
      title: 'Delivery partner assigned',
      description: 'Your delivery partner is heading to the store.',
      progress: 68
    },
    arrived_pickup: {
      title: 'Delivery partner at the store',
      description: 'Your order will be picked up shortly.',
      progress: 76
    },
    picked_up: {
      title: 'Order is on the way',
      description: 'Your delivery partner is coming to you.',
      progress: 88
    },
    completed: {
      title: 'Order delivered',
      description: 'Your order was delivered successfully.',
      progress: 100
    }
  };
  const LIVE_LOCATION_MAX_AGE_MS = 45_000;
  const liveMapState = {
    map: null,
    tileLayer: null,
    riderMarker: null,
    pickupMarker: null,
    dropMarker: null,
    routeLine: null,
    animationFrame: null,
    followRider: true,
    orderId: null
  };
  let renderedOrderId = null;
  let renderedOrderStatus = null;
  let latestOrder = null;
  let freshnessTimer = null;
  let leafletDisabled = false;

  function escapeValue(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function timestampMs(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && value.seconds) return Number(value.seconds) * 1000;
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function activeTrackingOrder() {
    const orders = Array.isArray(state && state.orders) ? state.orders : [];
    return orders.find((order) => order && !TERMINAL_STATUSES.has(order.status)) || null;
  }

  function metaFor(status) {
    return STATUS_META[status] || {
      title: typeof statusLabel === 'function' ? statusLabel(status) : 'Order in progress',
      description: 'We will update this page as your order moves forward.',
      progress: 8
    };
  }

  function orderNumber(order) {
    return order.orderNumber || String(order.id || '').slice(0, 8).toUpperCase();
  }

  function storeName(order) {
    return order.storeName || (order.pickup && order.pickup.name) || 'BuyQK Store';
  }

  function itemCount(order) {
    const saved = Number(order.itemCount);
    if (Number.isFinite(saved) && saved > 0) return saved;
    const items = Array.isArray(order.items) ? order.items : [];
    return items.reduce((total, item) => total + Math.max(1, Number(item && item.quantity) || 1), 0);
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) ? '₹' + Math.round(number).toLocaleString('en-IN') : '—';
  }

  function addressText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return [
      value.house,
      value.street,
      value.area,
      value.city,
      value.state,
      value.pincode
    ].filter(Boolean).join(', ');
  }

  function deliveryAddress(order) {
    return addressText(order.drop && order.drop.address)
      || addressText(order.deliveryAddress)
      || 'Your saved delivery address';
  }

  function hasRider(order) {
    return Boolean(
      order.assignedRiderId
      || order.assignedRiderUid
      || order.riderId
      || (order.rider && order.rider.id)
    );
  }

  function riderName(order) {
    return order.assignedRiderName
      || order.riderName
      || (order.rider && order.rider.name)
      || 'BuyQK delivery partner';
  }

  function initials(value) {
    return String(value || 'QK')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'QK';
  }

  function locationOf(value) {
    if (!value || typeof value !== 'object') return null;
    const latitude = Number(value.latitude != null ? value.latitude : value.lat);
    const longitude = Number(value.longitude != null ? value.longitude : value.lng);
    if (!Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || latitude < -90
      || latitude > 90
      || longitude < -180
      || longitude > 180) return null;
    return {
      latitude: latitude,
      longitude: longitude,
      accuracy: Math.max(0, Number(value.accuracy || 0))
    };
  }

  function radians(value) {
    return value * Math.PI / 180;
  }

  function distanceKm(from, to) {
    if (!from || !to) return null;
    const latitude = radians(to.latitude - from.latitude);
    const longitude = radians(to.longitude - from.longitude);
    const a = Math.sin(latitude / 2) * Math.sin(latitude / 2)
      + Math.cos(radians(from.latitude))
      * Math.cos(radians(to.latitude))
      * Math.sin(longitude / 2)
      * Math.sin(longitude / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function routeInformation(order) {
    const rider = locationOf(order.riderLocation);
    const pickup = locationOf((order.pickup && order.pickup.location) || order.pickupLocation);
    const drop = locationOf((order.drop && order.drop.location) || order.dropLocation);
    let distance = null;

    if (rider && drop) {
      if (order.status === 'picked_up' || !pickup) {
        distance = distanceKm(rider, drop);
      } else {
        const firstLeg = distanceKm(rider, pickup);
        const secondLeg = distanceKm(pickup, drop);
        if (firstLeg != null && secondLeg != null) distance = firstLeg + secondLeg;
      }
    }

    if (distance != null) distance *= 1.22;
    const eta = distance == null
      ? null
      : Math.max(3, Math.round((distance / (order.status === 'picked_up' ? 22 : 19)) * 60));

    return {
      rider: rider,
      pickup: pickup,
      drop: drop,
      distance: distance,
      eta: eta
    };
  }

  function locationFreshness(order) {
    const updated = timestampMs(order.riderLocationUpdatedAt)
      || timestampMs(order.riderLocation && order.riderLocation.updatedAt);
    if (!updated) {
      return {
        text: 'Location will update here',
        label: 'PREVIEW',
        live: false,
        delayed: false
      };
    }
    const seconds = Math.max(0, Math.round((Date.now() - updated) / 1000));
    const text = seconds < 12
      ? 'Updated just now'
      : seconds < 60
        ? 'Updated ' + seconds + ' sec ago'
        : 'Updated ' + Math.floor(seconds / 60) + ' min ago';
    const delayed = Date.now() - updated > LIVE_LOCATION_MAX_AGE_MS;
    return {
      text: text,
      label: delayed ? 'DELAYED' : 'LIVE',
      live: !delayed,
      delayed: delayed
    };
  }

  function etaText(order, route) {
    const estimatedAt = timestampMs(order.estimatedArrivalAt || order.estimatedDeliveryAt);
    if (estimatedAt > Date.now()) {
      return new Date(estimatedAt).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit'
      });
    }
    if (route.eta != null) return route.eta + ' min';
    if (order.status === 'picked_up') return 'Arriving soon';
    if (hasRider(order)) return 'After pickup';
    if (order.status === 'ready_for_pickup') return 'Finding a rider';
    return 'Updating shortly';
  }

  function projectedPoints(order, route) {
    const livePoints = [
      { key: 'store', location: route.pickup },
      { key: 'rider', location: route.rider },
      { key: 'home', location: route.drop }
    ].filter((point) => point.location);

    if (route.pickup && route.drop && livePoints.length >= 2) {
      const latitudes = livePoints.map((point) => point.location.latitude);
      const longitudes = livePoints.map((point) => point.location.longitude);
      const minLatitude = Math.min.apply(null, latitudes);
      const maxLatitude = Math.max.apply(null, latitudes);
      const minLongitude = Math.min.apply(null, longitudes);
      const maxLongitude = Math.max.apply(null, longitudes);
      const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.002);
      const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.002);
      return {
        live: Boolean(route.rider),
        points: livePoints.map((point) => ({
          key: point.key,
          x: 14 + ((point.location.longitude - minLongitude) / longitudeSpan) * 72,
          y: 59 - ((point.location.latitude - minLatitude) / latitudeSpan) * 44
        }))
      };
    }

    const riderPosition = order.status === 'picked_up'
      ? { key: 'rider', x: 62, y: 31 }
      : order.status === 'arrived_pickup'
        ? { key: 'rider', x: 22, y: 54 }
        : { key: 'rider', x: 37, y: 48 };
    const points = [
      { key: 'store', x: 18, y: 56 },
      { key: 'home', x: 84, y: 19 }
    ];
    if (hasRider(order)) points.splice(1, 0, riderPosition);
    return { live: false, points: points };
  }

  function markerLabel(key) {
    if (key === 'store') return 'Store';
    if (key === 'rider') return 'Rider';
    return 'You';
  }

  function leafletAvailable() {
    return !leafletDisabled
      && Boolean(globalThis.L)
      && typeof globalThis.L.map === 'function'
      && typeof globalThis.L.tileLayer === 'function';
  }

  function latLng(location) {
    return [location.latitude, location.longitude];
  }

  function activeRoutePoints(order, route) {
    const points = [];
    if (route.rider) points.push(latLng(route.rider));
    if (order.status !== 'picked_up' && route.pickup) points.push(latLng(route.pickup));
    if (route.drop) points.push(latLng(route.drop));
    return points;
  }

  function liveMarkerHtml(kind) {
    const icon = kind === 'rider'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 17-7-3.5L5 20 12 3Z"></path></svg>'
      : kind === 'store'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16M5 10v10h14V10M3.5 10l2-6h13l2 6M9 20v-5h6v5"></path></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7M6 10v10h12V10M10 20v-6h4v6"></path></svg>';
    return '<span class="qk-live-marker-core ' + kind + '">' + icon + '</span>'
      + '<span class="qk-live-marker-label">' + markerLabel(kind) + '</span>';
  }

  function liveMarkerIcon(kind) {
    return globalThis.L.divIcon({
      className: 'qk-live-div-icon',
      html: liveMarkerHtml(kind),
      iconSize: [48, 58],
      iconAnchor: [24, 29]
    });
  }

  function destroyLiveMap() {
    if (liveMapState.animationFrame != null) {
      globalThis.cancelAnimationFrame(liveMapState.animationFrame);
    }
    liveMapState.animationFrame = null;
    if (liveMapState.map) {
      try {
        liveMapState.map.remove();
      } catch (error) {
        console.warn('Live map cleanup failed:', error);
      }
    }
    liveMapState.map = null;
    liveMapState.tileLayer = null;
    liveMapState.riderMarker = null;
    liveMapState.pickupMarker = null;
    liveMapState.dropMarker = null;
    liveMapState.routeLine = null;
    liveMapState.followRider = true;
    liveMapState.orderId = null;
  }

  function animateRiderMarker(location) {
    const marker = liveMapState.riderMarker;
    if (!marker) return;
    const target = { lat: location.latitude, lng: location.longitude };
    const start = marker.getLatLng();
    const latitudeChange = target.lat - start.lat;
    const longitudeChange = target.lng - start.lng;
    if (Math.abs(latitudeChange) + Math.abs(longitudeChange) < 0.000001
      || typeof globalThis.requestAnimationFrame !== 'function') {
      marker.setLatLng(target);
      return;
    }

    if (liveMapState.animationFrame != null) {
      globalThis.cancelAnimationFrame(liveMapState.animationFrame);
    }
    const startedAt = globalThis.performance && typeof globalThis.performance.now === 'function'
      ? globalThis.performance.now()
      : Date.now();
    const duration = 900;
    const step = (now) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      marker.setLatLng({
        lat: start.lat + latitudeChange * eased,
        lng: start.lng + longitudeChange * eased
      });
      if (progress < 1) {
        liveMapState.animationFrame = globalThis.requestAnimationFrame(step);
      } else {
        liveMapState.animationFrame = null;
      }
    };
    liveMapState.animationFrame = globalThis.requestAnimationFrame(step);
  }

  function updateMapMarkers(order, route, animate) {
    const L = globalThis.L;
    if (!liveMapState.map || !L) return;

    if (route.rider) {
      if (!liveMapState.riderMarker) {
        liveMapState.riderMarker = L.marker(latLng(route.rider), {
          icon: liveMarkerIcon('rider'),
          zIndexOffset: 900
        }).addTo(liveMapState.map);
      } else if (animate) {
        animateRiderMarker(route.rider);
      } else {
        liveMapState.riderMarker.setLatLng(latLng(route.rider));
      }
    }

    if (route.pickup && !liveMapState.pickupMarker) {
      liveMapState.pickupMarker = L.marker(latLng(route.pickup), {
        icon: liveMarkerIcon('store'),
        zIndexOffset: 500
      }).addTo(liveMapState.map);
    }
    if (route.drop && !liveMapState.dropMarker) {
      liveMapState.dropMarker = L.marker(latLng(route.drop), {
        icon: liveMarkerIcon('home'),
        zIndexOffset: 500
      }).addTo(liveMapState.map);
    }

    const points = activeRoutePoints(order, route);
    if (!liveMapState.routeLine) {
      liveMapState.routeLine = L.polyline(points, {
        color: '#1f7a4d',
        weight: 5,
        opacity: 0.82,
        dashArray: '8 9',
        lineCap: 'round'
      }).addTo(liveMapState.map);
    } else {
      liveMapState.routeLine.setLatLngs(points);
    }
  }

  function initializeLiveMap(order, route) {
    const element = document.getElementById('qkLiveOrderMap');
    if (!element || !route.rider || !leafletAvailable()) return;
    destroyLiveMap();

    try {
      const L = globalThis.L;
      element.innerHTML = '';
      liveMapState.map = L.map(element, {
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: true,
        attributionControl: true,
        tap: false
      });
      liveMapState.orderId = String(order.id || '');
      liveMapState.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(liveMapState.map);
      L.control.zoom({ position: 'topright' }).addTo(liveMapState.map);
      updateMapMarkers(order, route, false);

      const points = activeRoutePoints(order, route);
      if (points.length > 1) {
        liveMapState.map.fitBounds(L.latLngBounds(points), {
          padding: [38, 38],
          maxZoom: 15,
          animate: false
        });
      } else {
        liveMapState.map.setView(latLng(route.rider), 15, { animate: false });
      }
      liveMapState.map.on('dragstart', () => {
        liveMapState.followRider = false;
      });
      globalThis.setTimeout(() => liveMapState.map?.invalidateSize(), 80);
    } catch (error) {
      console.warn('Live street map could not start; showing route preview instead.', error);
      leafletDisabled = true;
      destroyLiveMap();
      renderedOrderId = null;
      globalThis.setTimeout(renderBuyQkTrack, 0);
    }
  }

  function updateLiveMap(order, route) {
    if (!liveMapState.map || !route.rider) return;
    updateMapMarkers(order, route, true);
    if (liveMapState.followRider) {
      liveMapState.map.panTo(latLng(route.rider), { animate: true, duration: 0.7 });
    }
  }

  function fallbackMapMarkup(projection) {
    const routePoints = projection.points.map((point) => point.x + ',' + point.y).join(' ');
    const markers = projection.points.map((point) => (
      '<g class="qk-track-marker ' + point.key + '" transform="translate(' + point.x + ' ' + point.y + ')">'
      + '<circle r="5.4"></circle>'
      + '<text text-anchor="middle" y="1.7">' + (point.key === 'rider' ? 'R' : point.key === 'store' ? 'S' : 'H') + '</text>'
      + '<rect x="-10" y="7" width="20" height="6.5" rx="3.25"></rect>'
      + '<text class="qk-track-marker-label" text-anchor="middle" y="11.4">' + markerLabel(point.key) + '</text>'
      + '</g>'
    )).join('');

    return '<svg viewBox="0 0 100 72" role="img" aria-label="Store, delivery partner and delivery location">'
      + '<defs><pattern id="qkTrackGrid" width="9" height="9" patternUnits="userSpaceOnUse">'
      + '<path d="M9 0H0V9" fill="none" stroke="#dfe9e3" stroke-width=".45"></path>'
      + '</pattern></defs>'
      + '<rect width="100" height="72" fill="url(#qkTrackGrid)"></rect>'
      + '<path class="qk-track-road" d="M-4 18C20 28 22 5 48 14S77 36 104 22"></path>'
      + '<path class="qk-track-road" d="M4 68C27 48 43 66 59 49S79 38 101 44"></path>'
      + '<polyline class="qk-track-route-line" points="' + routePoints + '"></polyline>'
      + markers
      + '</svg>';
  }

  function mapMarkup(order, route) {
    const projection = projectedPoints(order, route);
    const freshness = locationFreshness(order);
    const realMap = Boolean(route.rider && leafletAvailable());
    const badgeLabel = route.rider && freshness.label === 'PREVIEW' ? 'GPS' : freshness.label;
    const badgeClass = freshness.live ? ' is-live' : freshness.delayed ? ' is-delayed' : '';
    const mapBody = realMap
      ? '<div class="qk-track-map qk-track-leaflet-map" id="qkLiveOrderMap" role="region" aria-label="Live rider location map">'
        + '<div class="qk-track-map-loading"><i></i><span>Loading live map…</span></div></div>'
        + '<button class="qk-track-recenter" type="button" data-track-recenter aria-label="Recenter map on delivery partner">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path></svg></button>'
      : '<div class="qk-track-map">' + fallbackMapMarkup(projection) + '</div>';

    return '<section class="qk-track-map-card">'
      + '<div class="qk-track-map-head">'
      + '<div><strong>' + (projection.live ? 'Live delivery map' : 'Delivery route') + '</strong>'
      + '<span data-track-freshness>' + escapeValue(freshness.text) + '</span></div>'
      + '<span class="qk-track-live-pill' + badgeClass + '" data-track-live-pill><i></i>'
      + badgeLabel + '</span>'
      + '</div>'
      + '<div class="qk-track-map-shell">' + mapBody + '</div>'
      + '<div class="qk-track-map-foot">'
      + '<div><small>ESTIMATED ARRIVAL</small><strong data-track-eta>' + escapeValue(etaText(order, route)) + '</strong></div>'
      + (route.distance != null
        ? '<div><small data-track-distance-label>REMAINING ROUTE</small><strong data-track-distance>' + route.distance.toFixed(1) + ' km</strong></div>'
        : '<div><small data-track-distance-label>TRACKING</small><strong data-track-distance>' + (hasRider(order) ? 'Partner assigned' : 'Starts after assignment') + '</strong></div>')
      + '</div>'
      + '</section>';
  }

  function riderMarkup(order) {
    if (!hasRider(order)) return '';

    const name = riderName(order);
    const phone = String(
      order.assignedRiderPhone
      || order.riderPhone
      || (order.rider && order.rider.phone)
      || ''
    ).replace(/[^\d+]/g, '');
    return '<section class="qk-track-card qk-track-rider-card">'
      + '<span class="qk-track-rider-avatar">' + escapeValue(initials(name)) + '</span>'
      + '<div><small>YOUR DELIVERY PARTNER</small><strong>' + escapeValue(name) + '</strong>'
      + '<p><span class="qk-track-verified-dot"></span>Verified BuyQK partner</p></div>'
      + (phone ? '<a href="tel:' + escapeValue(phone) + '" aria-label="Call delivery partner">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4.5 6 6c-.8.5-.8 1.3-.5 2.2 1.5 4.7 5.6 8.8 10.3 10.3.9.3 1.7.3 2.2-.5l1.5-2.5-4-2-1.3 1.7c-2.4-1-4.4-3-5.4-5.4l1.7-1.3-2-4Z"></path></svg>'
        + '</a>' : '')
      + '</section>';
  }

  function tripMarkup(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const itemNames = items.slice(0, 2).map((item) => item && item.name).filter(Boolean);
    const extra = Math.max(0, items.length - itemNames.length);
    const summary = itemNames.length
      ? itemNames.join(', ') + (extra ? ' +' + extra + ' more' : '')
      : itemCount(order) + ' item' + (itemCount(order) === 1 ? '' : 's');

    return '<section class="qk-track-card qk-track-trip-card">'
      + '<div class="qk-track-card-head"><div><small>DELIVERY DETAILS</small><h2>Your order</h2></div></div>'
      + '<div class="qk-track-trip-row">'
      + '<span class="qk-track-trip-icon store"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16M5 10v10h14V10M3.5 10l2-6h13l2 6M9 20v-5h6v5"></path></svg></span>'
      + '<div><small>PICKUP</small><strong>' + escapeValue(storeName(order)) + '</strong></div></div>'
      + '<div class="qk-track-trip-line"></div>'
      + '<div class="qk-track-trip-row">'
      + '<span class="qk-track-trip-icon home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7M6 10v10h12V10M10 20v-6h4v6"></path></svg></span>'
      + '<div><small>DROP-OFF</small><strong>' + escapeValue(deliveryAddress(order)) + '</strong></div></div>'
      + '<div class="qk-track-order-summary"><div><strong>' + itemCount(order) + ' item'
      + (itemCount(order) === 1 ? '' : 's') + '</strong><p>' + escapeValue(summary) + '</p></div>'
      + '<strong>' + money(order.totalAmount) + '</strong></div>'
      + '<button class="qk-track-view-order" type="button" data-track-view-order="' + escapeValue(order.id) + '">'
      + 'View order details<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>'
      + '</button></section>';
  }

  function heroMarkup(order) {
    const meta = metaFor(order.status);
    return '<section class="qk-track-hero">'
      + '<span class="qk-track-hero-orb one"></span><span class="qk-track-hero-orb two"></span>'
      + '<div class="qk-track-hero-top"><span><i></i>ORDER IN PROGRESS</span>'
      + '<small>#' + escapeValue(orderNumber(order)) + '</small></div>'
      + '<h1>' + escapeValue(meta.title) + '</h1>'
      + '<p>' + escapeValue(meta.description) + '</p>'
      + '<div class="qk-track-progress-bar"><i style="width:' + meta.progress + '%"></i></div>'
      + '<div class="qk-track-hero-foot"><span>' + escapeValue(storeName(order)) + '</span>'
      + '<strong>' + meta.progress + '% complete</strong></div>'
      + '</section>';
  }

  function emptyMarkup() {
    return '<div class="view qk-track-view"><div class="qk-track-scroll qk-track-empty-wrap">'
      + '<section class="qk-track-empty">'
      + '<span aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 54s17-16.5 17-30a17 17 0 1 0-34 0c0 13.5 17 30 17 30Z"></path><circle cx="32" cy="24" r="6"></circle><path d="M19 54h26"></path></svg></span>'
      + '<strong>No active delivery</strong>'
      + '<p>Your live order and delivery partner will appear here.</p>'
      + '<button type="button" data-tab="orders">View your orders</button>'
      + '<button type="button" data-tab="darkstore">Start shopping</button>'
      + '</section></div></div>';
  }

  function updateTrackingView(order, route) {
    latestOrder = order;
    const freshness = locationFreshness(order);
    const freshnessElement = document.querySelector('[data-track-freshness]');
    const badge = document.querySelector('[data-track-live-pill]');
    const eta = document.querySelector('[data-track-eta]');
    const distanceLabel = document.querySelector('[data-track-distance-label]');
    const distance = document.querySelector('[data-track-distance]');

    if (freshnessElement) freshnessElement.textContent = freshness.text;
    if (badge) {
      const label = route.rider && freshness.label === 'PREVIEW' ? 'GPS' : freshness.label;
      badge.classList.toggle('is-live', freshness.live);
      badge.classList.toggle('is-delayed', freshness.delayed);
      badge.innerHTML = '<i></i>' + label;
    }
    if (eta) eta.textContent = etaText(order, route);
    if (distanceLabel) distanceLabel.textContent = route.distance != null ? 'REMAINING ROUTE' : 'TRACKING';
    if (distance) {
      distance.textContent = route.distance != null
        ? route.distance.toFixed(1) + ' km'
        : hasRider(order) ? 'Partner assigned' : 'Starts after assignment';
    }
    updateLiveMap(order, route);
  }

  function keepFreshnessCurrent() {
    if (freshnessTimer != null) return;
    freshnessTimer = globalThis.setInterval(() => {
      if (!latestOrder || !document.querySelector('.qk-track-view')) return;
      updateTrackingView(latestOrder, routeInformation(latestOrder));
    }, 10_000);
  }

  function renderBuyQkTrack() {
    const main = document.getElementById('appMain');
    if (!main) return;
    const order = activeTrackingOrder();
    if (!order) {
      destroyLiveMap();
      renderedOrderId = null;
      renderedOrderStatus = null;
      latestOrder = null;
      main.innerHTML = emptyMarkup();
      return;
    }

    const route = routeInformation(order);
    const nextOrderId = String(order.id || order.orderNumber || '');
    const needsRealMap = Boolean(route.rider && leafletAvailable());
    const hasRealMapContainer = Boolean(document.getElementById('qkLiveOrderMap'));
    const currentView = main.querySelector('.qk-track-view');
    if (currentView
      && renderedOrderId === nextOrderId
      && renderedOrderStatus === order.status
      && needsRealMap === hasRealMapContainer) {
      updateTrackingView(order, route);
      return;
    }

    destroyLiveMap();
    renderedOrderId = nextOrderId;
    renderedOrderStatus = order.status;
    latestOrder = order;
    main.innerHTML = '<div class="view qk-track-view"><div class="qk-track-scroll">'
      + heroMarkup(order)
      + mapMarkup(order, route)
      + riderMarkup(order)
      + tripMarkup(order)
      + '</div></div>';
    keepFreshnessCurrent();
    if (needsRealMap) {
      globalThis.requestAnimationFrame(() => initializeLiveMap(order, route));
    }
  }

  if (typeof renderTrack === 'function') {
    renderTrack = renderBuyQkTrack;
  }

  document.addEventListener('click', (event) => {
    const recenter = event.target.closest('[data-track-recenter]');
    if (recenter && liveMapState.map && latestOrder) {
      const route = routeInformation(latestOrder);
      if (route.rider) {
        liveMapState.followRider = true;
        liveMapState.map.flyTo(
          latLng(route.rider),
          Math.max(15, liveMapState.map.getZoom()),
          { animate: true, duration: 0.7 }
        );
      }
      return;
    }

    const navigation = event.target.closest('#bottomNav [data-tab]');
    if (navigation && navigation.dataset.tab !== 'track') destroyLiveMap();

    const button = event.target.closest('[data-track-view-order]');
    if (!button) return;
    destroyLiveMap();
    document.dispatchEvent(new CustomEvent('qk:openorderdetails', {
      detail: { orderId: button.dataset.trackViewOrder }
    }));
  });
})();
