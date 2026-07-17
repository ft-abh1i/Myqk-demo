import { authReady, db } from './customer-firebase.js';
import { collection, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const ACTIVE_STATUSES = ['accepted', 'arrived_pickup', 'picked_up'];
const STALE_AFTER_MS = 75_000;
let liveOrder = null;
let currentTab = 'darkstore';

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function locationOf(value) {
  const latitude = Number(value?.latitude ?? value?.lat);
  const longitude = Number(value?.longitude ?? value?.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude, accuracy: Number(value?.accuracy || 0) }
    : null;
}

function radians(value) { return value * Math.PI / 180; }

function distanceKm(from, to) {
  if (!from || !to) return 0;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function freshness(order) {
  const time = timestampMs(order?.riderLocationUpdatedAt || order?.riderLocation?.updatedAt);
  if (!time) return { stale: true, text: 'Location unavailable' };
  const age = Date.now() - time;
  const seconds = Math.max(0, Math.round(age / 1000));
  return {
    stale: age > STALE_AFTER_MS,
    text: seconds < 10 ? 'Updated just now' : seconds < 60 ? `Updated ${seconds}s ago` : `Updated ${Math.floor(seconds / 60)} min ago`
  };
}

function routeStats(order, rider, pickup, drop) {
  if (!rider || !pickup || !drop) return { distance: null, eta: null };
  const direct = order.status === 'picked_up'
    ? distanceKm(rider, drop)
    : distanceKm(rider, pickup) + distanceKm(pickup, drop);
  const roadDistance = direct * 1.25;
  const speedKmH = order.status === 'picked_up' ? 22 : 20;
  const eta = Math.max(2, Math.round((roadDistance / speedKmH) * 60));
  return { distance: roadDistance, eta };
}

function projectedPoints(points) {
  const valid = points.filter((point) => point.location);
  if (!valid.length) return points;
  const lats = valid.map((point) => point.location.latitude);
  const lngs = valid.map((point) => point.location.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.002);
  const lngSpan = Math.max(maxLng - minLng, 0.002);
  return points.map((point) => {
    if (!point.location) return point;
    return {
      ...point,
      x: 12 + ((point.location.longitude - minLng) / lngSpan) * 76,
      y: 82 - ((point.location.latitude - minLat) / latSpan) * 64
    };
  });
}

function mapMarkup(order, rider, pickup, drop) {
  const points = projectedPoints([
    { key: 'pickup', label: 'Pickup', location: pickup, className: 'pickup' },
    { key: 'rider', label: 'Rider', location: rider, className: 'rider' },
    { key: 'drop', label: 'You', location: drop, className: 'drop' }
  ]);
  const available = points.filter((point) => Number.isFinite(point.x));
  const line = available.map((point) => `${point.x},${point.y}`).join(' ');
  return `<div class="uq-route-map">
    <svg viewBox="0 0 100 92" role="img" aria-label="Pickup, rider and delivery locations">
      <defs><pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="#dce4ec" stroke-width=".35"/></pattern></defs>
      <rect width="100" height="92" fill="url(#grid)"/>
      ${line ? `<polyline points="${line}" fill="none" stroke="#071a3b" stroke-width="1.6" stroke-dasharray="3 2" stroke-linecap="round"/>` : ''}
      ${available.map((point) => `<g class="uq-map-marker ${point.className}" transform="translate(${point.x} ${point.y})"><circle r="5.3"/><text y="1.7" text-anchor="middle">${point.key === 'rider' ? 'R' : point.key === 'pickup' ? 'P' : 'D'}</text><rect x="-9" y="7" width="18" height="6" rx="3"/><text class="label" y="11.2" text-anchor="middle">${point.label}</text></g>`).join('')}
    </svg>
  </div>`;
}

function directionsUrl(rider, pickup, drop, status) {
  if (!rider || !drop) return '#';
  const origin = `${rider.latitude},${rider.longitude}`;
  const destination = `${drop.latitude},${drop.longitude}`;
  const waypoint = status === 'picked_up' || !pickup ? '' : `&waypoints=${encodeURIComponent(`${pickup.latitude},${pickup.longitude}`)}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoint}&travelmode=driving`;
}

function ensureStyles() {
  if (document.getElementById('uqLiveRiderStyles')) return;
  const style = document.createElement('style');
  style.id = 'uqLiveRiderStyles';
  style.textContent = `
    .uq-rider-map-card{margin-bottom:12px;background:#fff;border:1px solid #e8ebf0;border-radius:16px;overflow:hidden;box-shadow:0 5px 18px rgba(15,23,42,.04)}
    .uq-rider-map-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid #eef0f3}.uq-rider-map-head small{display:block;color:#94a3b8;font-size:9px;font-weight:800}.uq-rider-map-head strong{display:block;margin-top:3px;color:#111827;font-size:13px}.uq-live-state{padding:5px 8px;border-radius:999px;background:#ecfdf3;color:#15803d;font-size:9px;font-weight:900}.uq-live-state.warn{background:#fff7ed;color:#c2410c}
    .uq-location-warning{margin:12px 14px 0;padding:10px 12px;border-radius:11px;background:#fff7ed;color:#9a3412;font-size:10px;line-height:1.45;font-weight:700}.uq-location-warning.danger{background:#fef2f2;color:#b91c1c}
    .uq-route-map{height:235px;background:#edf2f7}.uq-route-map svg{display:block;width:100%;height:100%}.uq-map-marker circle{fill:#fff;stroke:#071a3b;stroke-width:1.8}.uq-map-marker.rider circle{fill:#f8cb46}.uq-map-marker.pickup circle{fill:#dbeafe}.uq-map-marker.drop circle{fill:#dcfce7}.uq-map-marker text{font-size:4px;font-weight:900;fill:#071a3b}.uq-map-marker rect{fill:#fff;stroke:#d7dee7;stroke-width:.4}.uq-map-marker .label{font-size:3px;font-weight:800}
    .uq-route-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 14px;border-top:1px solid #eef0f3}.uq-route-stats div{padding:10px;border-radius:11px;background:#f8fafc}.uq-route-stats small{display:block;color:#94a3b8;font-size:8px;font-weight:800}.uq-route-stats strong{display:block;margin-top:4px;color:#111827;font-size:14px}.uq-rider-map-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px 13px}.uq-rider-map-foot p{margin:0;color:#64748b;font-size:10px}.uq-rider-map-foot a{padding:9px 12px;border-radius:10px;background:#071a3b;color:#fff;text-decoration:none;font-size:10px;font-weight:800}.uq-rider-map-foot a.disabled{pointer-events:none;opacity:.45}
  `;
  document.head.appendChild(style);
}

function cardMarkup(order) {
  const rider = locationOf(order?.riderLocation);
  const pickup = locationOf(order?.pickup?.location || order?.pickupLocation);
  const drop = locationOf(order?.drop?.location || order?.dropLocation);
  const riderName = order?.assignedRiderName || order?.riderName || 'QK Rider';
  const fresh = freshness(order);
  const stats = routeStats(order, rider, pickup, drop);
  const warning = !rider
    ? '<div class="uq-location-warning danger">Rider location is unavailable. The rider may have disabled GPS or closed the app.</div>'
    : fresh.stale
      ? '<div class="uq-location-warning">Rider location has not updated recently. GPS may be off, network may be weak, or the rider app may be in the background.</div>'
      : '';
  return `<section class="uq-rider-map-card" id="uqRiderMapCard">
    <div class="uq-rider-map-head"><div><small>LIVE DELIVERY MAP</small><strong>${riderName}</strong></div><span class="uq-live-state ${fresh.stale ? 'warn' : ''}">${fresh.stale ? 'LOCATION ISSUE' : 'LIVE'}</span></div>
    ${warning}
    ${mapMarkup(order, rider, pickup, drop)}
    <div class="uq-route-stats"><div><small>REMAINING DISTANCE</small><strong>${stats.distance === null ? 'Calculating…' : `${stats.distance.toFixed(1)} km`}</strong></div><div><small>ESTIMATED ARRIVAL</small><strong>${stats.eta === null ? 'Waiting…' : `${stats.eta} min`}</strong></div></div>
    <div class="uq-rider-map-foot"><p>${fresh.text}${rider?.accuracy ? ` · ±${Math.round(rider.accuracy)}m` : ''}</p><a class="${rider && drop ? '' : 'disabled'}" href="${directionsUrl(rider, pickup, drop, order.status)}" target="_blank" rel="noopener">Open route</a></div>
  </section>`;
}

function renderRiderMap() {
  if (currentTab !== 'track') return;
  const trackView = document.querySelector('.uq-track-view');
  if (!trackView || !liveOrder) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = cardMarkup(liveOrder);
  const existing = document.getElementById('uqRiderMapCard');
  if (existing) existing.replaceWith(wrapper.firstElementChild);
  else trackView.querySelector('.uq-page-head')?.insertAdjacentElement('afterend', wrapper.firstElementChild);
}

function scheduleRender() { window.setTimeout(renderRiderMap, 40); }

async function start() {
  ensureStyles();
  const user = await authReady;
  if (!user) return;
  const ordersQuery = query(collection(db, 'orders'), where('customerId', '==', user.uid));
  onSnapshot(ordersQuery, (snapshot) => {
    liveOrder = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .filter((order) => ACTIVE_STATUSES.includes(order.status))
      .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))[0] || null;
    scheduleRender();
  }, (error) => console.error('Customer rider location listener failed:', error));

  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]')?.dataset.tab;
    if (!tab) return;
    currentTab = tab;
    scheduleRender();
  });

  new MutationObserver(() => {
    if (currentTab === 'track' && liveOrder && !document.getElementById('uqRiderMapCard')) scheduleRender();
  }).observe(document.getElementById('appMain'), { childList: true, subtree: true });

  window.setInterval(() => {
    if (currentTab === 'track' && liveOrder) renderRiderMap();
  }, 25_000);
}

document.addEventListener('DOMContentLoaded', start);
