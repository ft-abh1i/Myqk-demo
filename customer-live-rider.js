import { authReady, db } from './customer-firebase.js';
import { collection, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const ACTIVE_STATUSES = ['accepted', 'arrived_pickup', 'picked_up'];
let liveOrder = null;
let currentTab = 'darkstore';

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function validLocation(location) {
  const latitude = Number(location?.latitude ?? location?.lat);
  const longitude = Number(location?.longitude ?? location?.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude, accuracy: Number(location?.accuracy || 0) }
    : null;
}

function updatedText(order) {
  const time = timestampMs(order?.riderLocationUpdatedAt || order?.riderLocation?.updatedAt || order?.updatedAt);
  if (!time) return 'Waiting for rider location';
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 10) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.floor(seconds / 60)} min ago`;
}

function mapUrl(location) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}&z=16&output=embed`;
}

function openMapUrl(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
}

function ensureStyles() {
  if (document.getElementById('uqLiveRiderStyles')) return;
  const style = document.createElement('style');
  style.id = 'uqLiveRiderStyles';
  style.textContent = `
    .uq-rider-map-card{margin-bottom:12px;background:#fff;border:1px solid #e8ebf0;border-radius:16px;overflow:hidden;box-shadow:0 5px 18px rgba(15,23,42,.04)}
    .uq-rider-map-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid #eef0f3}.uq-rider-map-head small{display:block;color:#94a3b8;font-size:9px;font-weight:800;letter-spacing:.05em}.uq-rider-map-head strong{display:block;margin-top:3px;color:#111827;font-size:13px}.uq-rider-live-dot{display:flex;align-items:center;gap:6px;color:#15803d;font-size:9px;font-weight:900}.uq-rider-live-dot:before{content:"";width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.14)}
    .uq-rider-map-frame{position:relative;height:245px;background:#e8edf3}.uq-rider-map-frame iframe{width:100%;height:100%;border:0;display:block}.uq-rider-map-pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-68%);pointer-events:none;width:44px;height:44px;border-radius:50% 50% 50% 0;rotate:-45deg;background:#071a3b;border:4px solid #fff;box-shadow:0 8px 20px rgba(7,26,59,.28)}.uq-rider-map-pin:after{content:"R";position:absolute;inset:5px;border-radius:50%;display:grid;place-items:center;background:#f8cb46;color:#071a3b;font-size:12px;font-weight:900;rotate:45deg}
    .uq-rider-map-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px}.uq-rider-map-foot p{margin:0;color:#64748b;font-size:10px}.uq-rider-map-foot a{flex:0 0 auto;padding:9px 12px;border-radius:10px;background:#071a3b;color:#fff;text-decoration:none;font-size:10px;font-weight:800}.uq-rider-location-wait{padding:24px 16px;text-align:center}.uq-rider-location-wait strong{display:block;color:#111827;font-size:13px}.uq-rider-location-wait p{margin:5px 0 0;color:#64748b;font-size:10px;line-height:1.45}
  `;
  document.head.appendChild(style);
}

function cardMarkup(order) {
  const location = validLocation(order?.riderLocation);
  const riderName = order?.assignedRiderName || order?.riderName || 'QK Rider';
  if (!location) {
    return `<section class="uq-rider-map-card" id="uqRiderMapCard"><div class="uq-rider-map-head"><div><small>LIVE RIDER LOCATION</small><strong>${riderName}</strong></div><span class="uq-rider-live-dot">CONNECTING</span></div><div class="uq-rider-location-wait"><strong>Waiting for live location</strong><p>The rider location will appear after the next GPS update.</p></div></section>`;
  }
  return `<section class="uq-rider-map-card" id="uqRiderMapCard"><div class="uq-rider-map-head"><div><small>LIVE RIDER LOCATION</small><strong>${riderName}</strong></div><span class="uq-rider-live-dot">LIVE</span></div><div class="uq-rider-map-frame"><iframe title="Rider live location" loading="eager" referrerpolicy="no-referrer-when-downgrade" src="${mapUrl(location)}"></iframe><span class="uq-rider-map-pin" aria-hidden="true"></span></div><div class="uq-rider-map-foot"><p>${updatedText(order)}${location.accuracy ? ` · ±${Math.round(location.accuracy)}m` : ''}</p><a href="${openMapUrl(location)}" target="_blank" rel="noopener">Open map</a></div></section>`;
}

function renderRiderMap() {
  if (currentTab !== 'track') return;
  const trackView = document.querySelector('.uq-track-view');
  if (!trackView || !liveOrder) return;
  const existing = document.getElementById('uqRiderMapCard');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = cardMarkup(liveOrder);
  const next = wrapper.firstElementChild;
  if (existing) existing.replaceWith(next);
  else trackView.querySelector('.uq-page-head')?.insertAdjacentElement('afterend', next);
}

function scheduleRender() {
  window.setTimeout(renderRiderMap, 40);
}

async function start() {
  ensureStyles();
  const user = await authReady;
  if (!user) return;
  const ordersQuery = query(collection(db, 'orders'), where('customerId', '==', user.uid));
  onSnapshot(ordersQuery, (snapshot) => {
    const active = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((order) => ACTIVE_STATUSES.includes(order.status))
      .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
    liveOrder = active[0] || null;
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
