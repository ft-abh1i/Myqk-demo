export const NAV_TABS = [
  { id: 'darkstore', label: 'Store' },
  { id: 'orders', label: 'Orders' },
  { id: 'track', label: 'Track' },
  { id: 'ai', label: 'AI' },
  { id: 'profile', label: 'Profile' },
];

export const CATEGORIES = [
  { id: 'all', label: 'All Stores', image: 'https://i.ibb.co/ksPGNTh1/file-00000000e5e47207b913f9b20e24648a.png' },
  { id: 'groceries', label: 'Grocery', image: 'https://i.ibb.co/DPM7XHp1/file-000000002e407207b364dac899ed1521.png' },
  { id: 'pharmacy', label: 'Pharmacy', image: 'https://i.ibb.co/LXzpZ7wM/file-00000000142071fa904cffc2ac9358b3.png' },
  { id: 'beauty', label: 'Beauty', image: 'https://i.ibb.co/Q7kN67Gz/file-000000001c7071fa83e0b592537c937c.png' },
  { id: 'kids', label: 'Kids', image: 'https://i.ibb.co/WWGpBHDk/file-00000000d90471fa96565410954cb120.png' },
  { id: 'electronics', label: 'Electronics', image: 'https://i.ibb.co/9Hg19qZp/file-0000000049ec71fab3f2e2e7de8d5ac0.png' },
];

export const GROCERY_CATEGORIES = [
  { label: 'Vegetables & Fruits', image: '/assets/vegetables-fruits.webp' },
  { label: 'Atta, Rice & Dal', image: '/assets/atta-rice-dal-optimized.webp' },
  { label: 'Dairy, Bread & Eggs', image: '/assets/dairy-bread-eggs-transparent.webp' },
];

export const AI_QUICK_PROMPTS = [
  'Suggest a breakfast basket under ₹300',
  'Where is my current order?',
  'Find milk, bread, and eggs',
  'Suggest snacks on a budget',
];

export const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'merchant_rejected']);
export const CUSTOMER_CANCELLABLE_STATUSES = new Set(['pending_merchant', 'merchant_accepted', 'preparing', 'ready_for_pickup']);

export const STATUS_META = {
  pending_merchant: { title: 'Order placed', description: 'Waiting for the store to confirm your order', tone: 'active', step: 0 },
  merchant_accepted: { title: 'Order confirmed', description: 'The store has accepted your order', tone: 'active', step: 1 },
  preparing: { title: 'Being packed', description: 'The store is getting your items ready', tone: 'active', step: 2 },
  ready_for_pickup: { title: 'Ready for pickup', description: 'Your order is ready for the delivery partner', tone: 'active', step: 2 },
  accepted: { title: 'Delivery partner assigned', description: 'Your delivery partner is heading to the store', tone: 'active', step: 2 },
  arrived_pickup: { title: 'Delivery partner at store', description: 'Your order will be picked up shortly', tone: 'active', step: 2 },
  picked_up: { title: 'Out for delivery', description: 'Your order is on its way to you', tone: 'active', step: 3 },
  completed: { title: 'Delivered', description: 'Your order was delivered successfully', tone: 'success', step: 4 },
  merchant_rejected: { title: 'Not accepted', description: 'The store could not accept this order', tone: 'failed', step: -1 },
  cancelled: { title: 'Cancelled', description: 'This order was cancelled', tone: 'failed', step: -1 },
};

export function money(value) {
  return `₹${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-IN')}`;
}

export function normalizeCategory(value = '') {
  const category = String(value).toLowerCase();
  if (['grocery', 'fruit', 'vegetable', 'dairy', 'bakery'].some((term) => category.includes(term))) return 'groceries';
  if (category.includes('medical') || category.includes('pharmacy')) return 'pharmacy';
  if (category.includes('beauty') || category.includes('cosmetic')) return 'beauty';
  if (category.includes('kid') || category.includes('baby')) return 'kids';
  if (category.includes('electronic')) return 'electronics';
  return 'all';
}

export function initials(value = 'QK') {
  return String(value).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'QK';
}

export function placeholderImage(label, kind = 'store') {
  const background = kind === 'store' ? '#f8cb46' : '#f3f4f6';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" rx="28" fill="${background}"/><text x="160" y="132" text-anchor="middle" font-family="Arial,sans-serif" font-size="62" font-weight="700" fill="#111827">${initials(label)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function storeAddress(store) {
  if (!store) return '';
  return typeof store.address === 'string' ? store.address : store.address?.fullAddress || '';
}

export function timestampValue(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  return Number(value) || 0;
}

export function statusMeta(status) {
  return STATUS_META[status] || { title: status || 'Processing', description: 'We will update this order as it moves forward', tone: 'active', step: 0 };
}

export function statusLabel(status) {
  return statusMeta(status).title;
}

export function statusProgress(status) {
  const meta = statusMeta(status);
  if (meta.tone === 'failed') return 100;
  return [10, 25, 55, 88, 100][Math.max(0, meta.step)] || 5;
}

export function orderNumber(order) {
  return order?.orderNumber || String(order?.id || '').slice(0, 8).toUpperCase();
}

export function orderItemCount(order) {
  const stored = Number(order?.itemCount);
  if (stored > 0) return stored;
  return (order?.items || []).reduce((sum, item) => sum + Math.max(1, Number(item?.quantity) || 1), 0);
}

export function formatOrderDate(order, full = false) {
  const time = timestampValue(order?.createdAt) || Number(order?.createdAtMs) || 0;
  if (!time) return 'Just now';
  return new Date(time).toLocaleString('en-IN', full
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function readCoordinates() {
  try {
    const value = JSON.parse(localStorage.getItem('qkLocationCoords') || 'null');
    const latitude = Number(value?.latitude);
    const longitude = Number(value?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude, accuracy: Number(value?.accuracy || 0) };
  } catch {
    return null;
  }
}

export function coordinatesFrom(value) {
  if (!value || typeof value !== 'object') return null;
  const latitude = Number(value.latitude ?? value.lat);
  const longitude = Number(value.longitude ?? value.lng);
  if (!Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180) return null;
  return { latitude, longitude };
}

export function distanceKm(first, second) {
  const from = coordinatesFrom(first);
  const to = coordinatesFrom(second);
  if (!from || !to) return Infinity;
  const radians = (value) => value * Math.PI / 180;
  const latitudeDistance = radians(to.latitude - from.latitude);
  const longitudeDistance = radians(to.longitude - from.longitude);
  const calculation = Math.sin(latitudeDistance / 2) ** 2
    + Math.cos(radians(from.latitude))
    * Math.cos(radians(to.latitude))
    * Math.sin(longitudeDistance / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation));
}

export function projectTrackPoints({ pickup, rider, drop }) {
  const source = {
    pickup: coordinatesFrom(pickup),
    rider: coordinatesFrom(rider),
    drop: coordinatesFrom(drop),
  };
  const valid = Object.values(source).filter(Boolean);
  if (valid.length < 2) {
    return {
      pickup: { x: 18, y: 56 },
      rider: { x: 47, y: 44 },
      drop: { x: 84, y: 19 },
      live: false,
    };
  }

  const latitudes = valid.map((point) => point.latitude);
  const longitudes = valid.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.001);
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.001);
  const project = (point, fallback) => point ? {
    x: 16 + ((point.longitude - minLongitude) / longitudeSpan) * 68,
    y: 58 - ((point.latitude - minLatitude) / latitudeSpan) * 42,
  } : fallback;

  const pickupPoint = project(source.pickup, { x: 18, y: 56 });
  const dropPoint = project(source.drop, { x: 84, y: 19 });
  return {
    pickup: pickupPoint,
    rider: project(source.rider, {
      x: (pickupPoint.x + dropPoint.x) / 2,
      y: (pickupPoint.y + dropPoint.y) / 2,
    }),
    drop: dropPoint,
    live: Boolean(source.rider && source.pickup && source.drop),
  };
}

export function normalizeAiText(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  const withoutFence = text.replace(/^```(?:json|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(withoutFence);
    text = typeof parsed === 'string' ? parsed : parsed?.reply || parsed?.answer || withoutFence;
  } catch {
    text = withoutFence;
  }
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^\s*#{1,6}\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
