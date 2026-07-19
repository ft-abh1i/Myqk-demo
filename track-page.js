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
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
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

  function freshnessText(order) {
    const updated = timestampMs(order.riderLocationUpdatedAt)
      || timestampMs(order.riderLocation && order.riderLocation.updatedAt);
    if (!updated) return 'Location will update here';
    const seconds = Math.max(0, Math.round((Date.now() - updated) / 1000));
    if (seconds < 12) return 'Updated just now';
    if (seconds < 60) return 'Updated ' + seconds + ' sec ago';
    return 'Updated ' + Math.floor(seconds / 60) + ' min ago';
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

  function directionsUrl(order, route) {
    if (!route.rider || !route.drop) return '';
    const origin = route.rider.latitude + ',' + route.rider.longitude;
    const destination = route.drop.latitude + ',' + route.drop.longitude;
    const waypoint = order.status === 'picked_up' || !route.pickup
      ? ''
      : '&waypoints=' + encodeURIComponent(route.pickup.latitude + ',' + route.pickup.longitude);
    return 'https://www.google.com/maps/dir/?api=1&origin='
      + encodeURIComponent(origin)
      + '&destination='
      + encodeURIComponent(destination)
      + waypoint
      + '&travelmode=driving';
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

  function mapMarkup(order, route) {
    const projection = projectedPoints(order, route);
    const routePoints = projection.points.map((point) => point.x + ',' + point.y).join(' ');
    const mapLink = directionsUrl(order, route);
    const markers = projection.points.map((point) => (
      '<g class="qk-track-marker ' + point.key + '" transform="translate(' + point.x + ' ' + point.y + ')">'
      + '<circle r="5.4"></circle>'
      + '<text text-anchor="middle" y="1.7">' + (point.key === 'rider' ? 'R' : point.key === 'store' ? 'S' : 'H') + '</text>'
      + '<rect x="-10" y="7" width="20" height="6.5" rx="3.25"></rect>'
      + '<text class="qk-track-marker-label" text-anchor="middle" y="11.4">' + markerLabel(point.key) + '</text>'
      + '</g>'
    )).join('');

    return '<section class="qk-track-map-card">'
      + '<div class="qk-track-map-head">'
      + '<div><strong>' + (projection.live ? 'Live delivery map' : 'Delivery route') + '</strong>'
      + '<span>' + escapeValue(freshnessText(order)) + '</span></div>'
      + '<span class="qk-track-live-pill ' + (projection.live ? 'is-live' : '') + '"><i></i>'
      + (projection.live ? 'LIVE' : 'PREVIEW') + '</span>'
      + '</div>'
      + '<div class="qk-track-map">'
      + '<svg viewBox="0 0 100 72" role="img" aria-label="Store, delivery partner and delivery location">'
      + '<defs><pattern id="qkTrackGrid" width="9" height="9" patternUnits="userSpaceOnUse">'
      + '<path d="M9 0H0V9" fill="none" stroke="#dfe9e3" stroke-width=".45"></path>'
      + '</pattern></defs>'
      + '<rect width="100" height="72" fill="url(#qkTrackGrid)"></rect>'
      + '<path class="qk-track-road" d="M-4 18C20 28 22 5 48 14S77 36 104 22"></path>'
      + '<path class="qk-track-road" d="M4 68C27 48 43 66 59 49S79 38 101 44"></path>'
      + '<polyline class="qk-track-route-line" points="' + routePoints + '"></polyline>'
      + markers
      + '</svg>'
      + '</div>'
      + '<div class="qk-track-map-foot">'
      + '<div><small>ESTIMATED ARRIVAL</small><strong>' + escapeValue(etaText(order, route)) + '</strong></div>'
      + (route.distance != null
        ? '<div><small>REMAINING ROUTE</small><strong>' + route.distance.toFixed(1) + ' km</strong></div>'
        : '<div><small>TRACKING</small><strong>' + (hasRider(order) ? 'Partner assigned' : 'Starts after assignment') + '</strong></div>')
      + (mapLink
        ? '<a href="' + escapeValue(mapLink) + '" target="_blank" rel="noopener" aria-label="Open live route in maps">Open map</a>'
        : '')
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

  function renderBuyQkTrack() {
    const main = document.getElementById('appMain');
    if (!main) return;
    const order = activeTrackingOrder();
    if (!order) {
      main.innerHTML = emptyMarkup();
      return;
    }

    const route = routeInformation(order);
    main.innerHTML = '<div class="view qk-track-view"><div class="qk-track-scroll">'
      + heroMarkup(order)
      + mapMarkup(order, route)
      + riderMarkup(order)
      + tripMarkup(order)
      + '</div></div>';
  }

  if (typeof renderTrack === 'function') {
    renderTrack = renderBuyQkTrack;
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-track-view-order]');
    if (!button) return;
    document.dispatchEvent(new CustomEvent('qk:openorderdetails', {
      detail: { orderId: button.dataset.trackViewOrder }
    }));
  });
})();
