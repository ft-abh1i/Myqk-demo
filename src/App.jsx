import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useMyQKData from './useMyQKData.js';
import {
  AI_QUICK_PROMPTS,
  CATEGORIES,
  CUSTOMER_CANCELLABLE_STATUSES,
  GROCERY_CATEGORIES,
  NAV_TABS,
  TERMINAL_STATUSES,
  formatOrderDate,
  initials,
  money,
  normalizeAiText,
  orderItemCount,
  orderNumber,
  statusLabel,
  statusMeta,
  statusProgress,
  storeAddress,
} from './appData.js';
import './react-app.css';

function NavIcon({ id }) {
  if (id === 'darkstore') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>;
  if (id === 'orders') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>;
  if (id === 'track') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>;
  if (id === 'ai') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.8L18.5 10l-4.7 2.2L12 17l-1.8-4.8L5.5 10l4.7-2.2L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>;
}

function EmptyState({ icon, title, subtitle, action }) {
  return <div className="view empty-state"><div className="emoji">{icon}</div><div className="title">{title}</div><div className="sub">{subtitle}</div>{action}</div>;
}

function Preloader({ visible, progress }) {
  if (!visible) return null;
  return (
    <section id="qkPreloader" className="qk-preloader" aria-label="Loading BuyQK" aria-live="polite">
      <div className="qk-image-splash">
        <img className="qk-image-splash__art" src="/buyqk-splash.webp" alt="BuyQK — Local stores, faster delivery" fetchPriority="high" draggable="false" />
        <div className="qk-image-splash__loader" role="progressbar" aria-label="Loading BuyQK" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="qk-image-splash__status">Preparing BuyQK…</p>
      </div>
    </section>
  );
}

function Header({ location, cartCount, onLocation, onCart }) {
  return (
    <header className="app-header" id="appHeader">
      <button className="location-btn" id="locationBtn" type="button" aria-label="Select delivery location" onClick={onLocation}>
        <span className="location-pin" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 22s7-7.58 7-13A7 7 0 1 0 5 9c0 5.42 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg></span>
        <span className="location-text"><span className="location-label">Delivering to</span><span className="location-address"><span id="locationAddress">{location || 'Select your area'}</span><svg className="chevron" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></span></span>
      </button>
      <button className="cart-btn" id="cartBtn" type="button" aria-label="Open cart" onClick={onCart}>
        <svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="21" r="1.4"/><circle cx="18" cy="21" r="1.4"/></svg>
        <span className={`cart-badge ${cartCount ? 'show' : ''}`} id="cartBadge">{cartCount}</span>
      </button>
    </header>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div className="search-wrap" id="searchWrap">
      <label className="search-bar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="searchInput" type="search" placeholder="Search products or stores" autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} />
        <button className={`search-clear ${value ? 'show' : ''}`} id="searchClear" type="button" aria-label="Clear search" onClick={() => onChange('')}>×</button>
      </label>
    </div>
  );
}

function CategoryStrip({ activeCategory, onSelect }) {
  return (
    <div className="home-category-strip" id="categoryNav">
      {CATEGORIES.map((category, index) => (
        <button key={category.id} className={`home-category ${activeCategory === category.id ? 'active' : ''} category-${index + 1}`} type="button" onClick={() => onSelect(category.id)}>
          <span className="home-category-icon"><img src={category.image} alt="" loading="lazy" /></span><span>{category.label}</span>
        </button>
      ))}
    </div>
  );
}

function GroceryKitchen() {
  return (
    <section className="home-section grocery-kitchen-section" aria-labelledby="groceryKitchenTitle">
      <div className="home-section-head"><h2 id="groceryKitchenTitle">Grocery &amp; Kitchen</h2></div>
      <div className="grocery-category-grid" aria-label="Grocery and Kitchen categories">
        {GROCERY_CATEGORIES.map((category) => (
          <article className="grocery-category-card" key={category.label}>
            <div className="grocery-category-image"><img src={category.image} alt={category.label} loading="lazy" decoding="async" /></div>
            <span className="grocery-category-label">{category.label}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function HomeView({ stores, loading, search, activeCategory, onCategory, onStore, onNotice }) {
  const visibleStores = useMemo(() => {
    const query = search.trim().toLowerCase();
    return stores.filter((store) => (activeCategory === 'all' || store.category === activeCategory)
      && (!query || `${store.name} ${store.rawCategory} ${store.description}`.toLowerCase().includes(query)));
  }, [activeCategory, search, stores]);

  return (
    <div className="view home-view">
      <CategoryStrip activeCategory={activeCategory} onSelect={onCategory} />
      {loading && !stores.length ? <EmptyState icon="…" title="Loading nearby stores" subtitle="Connecting to MyQK merchants." /> : null}
      {!loading && !stores.length ? <EmptyState icon="⌂" title="No stores available yet" subtitle="Open merchant stores will appear here automatically." /> : null}
      {stores.length ? (
        <>
          <section className="home-section">
            <div className="home-section-head"><h2>Available Stores</h2><button type="button" onClick={() => onNotice('Showing all currently available stores.')}>View all</button></div>
            <div className="featured-store-row">
              {visibleStores.map((store) => (
                <button className="featured-store-card" type="button" key={store.id} onClick={() => onStore(store.id)}>
                  <img src={store.image} alt={store.name} loading="lazy" />
                  <div className="featured-store-info"><strong>{store.name}</strong><span className="store-clock">◷ {store.time}</span><span className="free-delivery">Live inventory</span></div>
                </button>
              ))}
              {!visibleStores.length ? <p className="home-no-result">No matching stores found.</p> : null}
            </div>
          </section>
          <GroceryKitchen />
        </>
      ) : null}
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  return (
    <article className="best-product-card">
      <div className="best-product-image"><img src={product.image} alt={product.name} loading="lazy" /></div>
      <strong>{product.name}</strong>
      <span>{[product.brand, product.unit].filter(Boolean).join(' · ')}</span>
      <div className="best-product-foot"><b>{money(product.price)}</b><button type="button" onClick={() => onAdd(product)} aria-label={`Add ${product.name}`}>+</button></div>
    </article>
  );
}

function StoreView({ store, products, search, onBack, onAdd }) {
  const list = products.filter((product) => product.storeId === store.id && (!search.trim() || `${product.name} ${product.unit} ${product.brand} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase())));
  return (
    <div className="view home-view">
      <section className="home-section">
        <div className="home-section-head"><div><button className="round-back" type="button" aria-label="Back to stores" onClick={onBack}>←</button><h2>{store.name}</h2></div><span>{store.time}</span></div>
        <p className="store-desc">{storeAddress(store) || store.description || 'Local MyQK store'}</p>
        <div className="best-product-row">
          {list.map((product) => <ProductCard key={product.key} product={product} onAdd={onAdd} />)}
          {!list.length ? <p className="home-no-result">This store has no available products.</p> : null}
        </div>
      </section>
    </div>
  );
}

function SecondaryHeader({ title, onBack }) {
  return <header className="secondary-topbar" data-secondary-header="true"><button className="secondary-back" type="button" aria-label="Back to Store" onClick={onBack}><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><h1 className="secondary-title">{title}</h1></header>;
}

function OrderPreview({ order }) {
  const items = Array.isArray(order.items) ? order.items.slice(0, 4) : [];
  return <div className="qk-order-preview">{items.length ? items.map((item, index) => <span className={`qk-order-mini-item tone-${(index % 4) + 1}`} key={`${item.productId || item.name}-${index}`}>{item.image ? <img src={item.image} alt="" loading="lazy" /> : <b>{initials(item.name)}</b>}</span>) : <span className="qk-order-mini-item tone-1"><b>QK</b></span>}</div>;
}

function OrdersView({ orders, selectedOrder, onSelect, onBack, onCancel, cancelling }) {
  if (selectedOrder) {
    const meta = statusMeta(selectedOrder.status);
    const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
    const canCancel = CUSTOMER_CANCELLABLE_STATUSES.has(selectedOrder.status) && !selectedOrder.assignedRiderId;
    return (
      <>
        <SecondaryHeader title="Back to all orders" onBack={onBack} />
        <div className="view qk-orders-view qk-order-detail-view">
          <section className={`qk-order-ended ${meta.tone}`}><span className={`qk-order-status-icon ${meta.tone}`}><NavIcon id={meta.tone === 'success' ? 'orders' : 'track'} /></span><div><strong>{meta.title}</strong><p>{meta.description}</p></div></section>
          <section className="qk-order-detail-card">
            <div className="qk-order-detail-head"><div><small>ORDER #{orderNumber(selectedOrder)}</small><strong>{selectedOrder.storeName || 'BuyQK Store'}</strong><p>{formatOrderDate(selectedOrder, true)}</p></div><b>{money(selectedOrder.totalAmount)}</b></div>
            <div className="qk-order-timeline">{['Placed', 'Confirmed', 'Packed', 'On the way', 'Delivered'].map((label, index) => <div className={`qk-order-step ${index <= meta.step ? 'done' : ''} ${index === meta.step && selectedOrder.status !== 'completed' ? 'current' : ''}`} key={label}><span>{index < meta.step || selectedOrder.status === 'completed' ? '✓' : ''}</span><div><strong>{label}</strong>{index === meta.step && selectedOrder.status !== 'completed' ? <p>{meta.description}</p> : null}</div></div>)}</div>
          </section>
          <section className="qk-order-detail-card"><div className="qk-order-section-title"><strong>Items</strong><span>{orderItemCount(selectedOrder)} total</span></div>{items.map((item, index) => { const quantity = Math.max(1, Number(item.quantity) || 1); return <div className="qk-order-item-row" key={`${item.productId || item.name}-${index}`}><span className={`qk-order-item-image tone-${(index % 4) + 1}`}>{item.image ? <img src={item.image} alt="" loading="lazy" /> : <b>{initials(item.name)}</b>}</span><div className="qk-order-item-copy"><strong>{item.name || 'Item'}</strong><p>{[item.unit, `Qty ${quantity}`].filter(Boolean).join(' · ')}</p></div><strong className="qk-order-item-price">{money(item.lineTotal ?? Number(item.unitPrice || 0) * quantity)}</strong></div>; })}</section>
          <section className="qk-order-detail-card"><div className="bill-row"><span>Item subtotal</span><strong>{money(selectedOrder.subtotal)}</strong></div><div className="bill-row"><span>Delivery fee</span><strong>{Number(selectedOrder.deliveryFee) ? money(selectedOrder.deliveryFee) : 'FREE'}</strong></div><div className="bill-row"><span>Platform fee</span><strong>{money(selectedOrder.platformFee)}</strong></div><div className="bill-row bill-total"><span>Total paid</span><strong>{money(selectedOrder.totalAmount)}</strong></div></section>
          {canCancel ? <button className="qk-order-cancel-button" type="button" disabled={cancelling} onClick={() => onCancel(selectedOrder.id)}>{cancelling ? 'Cancelling…' : 'Cancel order'}</button> : null}
        </div>
      </>
    );
  }

  return (
    <>
      <SecondaryHeader title="Orders" onBack={onBack} />
      <div className="view qk-orders-view"><div className="qk-orders-scroll">
        {orders.length ? <><div className="qk-orders-list-meta"><strong>Recent orders</strong><span>{orders.length} total</span></div><div className="qk-orders-list">{orders.map((order) => { const meta = statusMeta(order.status); const items = Array.isArray(order.items) ? order.items : []; const names = items.slice(0, 2).map((item) => item.name).filter(Boolean); return <button className="qk-order-card" type="button" key={order.id} onClick={() => onSelect(order.id)}><div className="qk-order-card-status"><span className={`qk-order-status-icon ${meta.tone}`}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.5l3 1.8"/></svg></span><div className="qk-order-status-copy"><strong>{meta.title}</strong><p>{meta.description}</p></div><span className="qk-order-chevron">›</span></div><div className="qk-order-card-body"><div className="qk-order-store-line"><div><strong>{order.storeName || 'BuyQK Store'}</strong><span>{formatOrderDate(order)}</span></div><small>{orderItemCount(order)} items</small></div><div className="qk-order-items-preview"><OrderPreview order={order} /><p>{names.join(', ') || `${orderItemCount(order)} items`}</p></div></div><div className="qk-order-card-foot"><span>Order #{orderNumber(order)}</span><strong>{money(order.totalAmount)}</strong></div></button>; })}</div></> : <div className="qk-orders-empty"><div className="qk-orders-empty-art"><svg viewBox="0 0 64 64"><path d="M18 12h28l-2 39H20l-2-39Z"/><path d="M25 12a7 7 0 0 1 14 0M26 25h12M26 33h8"/></svg></div><strong>No orders yet</strong><p>Your orders will appear here after checkout.</p><button type="button" onClick={onBack}>Start shopping</button></div>}
      </div></div>
    </>
  );
}

function TrackView({ order, onBack }) {
  if (!order) return <><SecondaryHeader title="Track" onBack={onBack} /><EmptyState icon="⌖" title="Nothing to track" subtitle="Your current live order will appear here." /></>;
  const meta = statusMeta(order.status);
  const rider = order.assignedRiderName || order.riderName || order.rider?.name;
  const riderLocation = order.riderLocation;
  const phone = String(order.assignedRiderPhone || order.riderPhone || order.rider?.phone || '').replace(/[^\d+]/g, '');
  return (
    <>
      <SecondaryHeader title="Track" onBack={onBack} />
      <div className="view qk-track-view">
        <section className="qk-track-hero"><small>ORDER #{orderNumber(order)}</small><strong>{meta.title}</strong><p>{meta.description}</p><div className="qk-track-progress"><span style={{ width: `${statusProgress(order.status)}%` }} /></div><div className="qk-track-progress-meta"><span>{order.storeName || 'BuyQK Store'}</span><b>{statusProgress(order.status)}%</b></div></section>
        <section className="qk-track-map-card"><div className="qk-track-map-head"><div><strong>{riderLocation ? 'Live delivery map' : 'Delivery route'}</strong><span>{riderLocation ? 'Rider location received' : 'Location will update here'}</span></div><span className={`qk-track-live-pill ${riderLocation ? 'is-live' : ''}`}><i />{riderLocation ? 'LIVE' : 'PREVIEW'}</span></div><div className="qk-track-map-shell"><div className="qk-track-map"><svg viewBox="0 0 100 72" role="img" aria-label="Store, delivery partner and delivery location"><defs><pattern id="qkTrackGridReact" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M9 0H0V9" fill="none" stroke="#dfe9e3" strokeWidth=".45" /></pattern></defs><rect width="100" height="72" fill="url(#qkTrackGridReact)"/><path className="qk-track-road" d="M-4 18C20 28 22 5 48 14S77 36 104 22"/><path className="qk-track-road" d="M4 68C27 48 43 66 59 49S79 38 101 44"/><polyline className="qk-track-route-line" points="18,56 47,44 84,19"/><g className="qk-track-marker store" transform="translate(18 56)"><circle r="5.4"/><text textAnchor="middle" y="1.7">S</text></g>{rider ? <g className="qk-track-marker rider" transform="translate(47 44)"><circle r="5.4"/><text textAnchor="middle" y="1.7">R</text></g> : null}<g className="qk-track-marker home" transform="translate(84 19)"><circle r="5.4"/><text textAnchor="middle" y="1.7">H</text></g></svg></div></div><div className="qk-track-map-foot"><div><small>ESTIMATED ARRIVAL</small><strong>{order.estimatedArrival || (order.status === 'picked_up' ? 'Arriving soon' : 'Updating shortly')}</strong></div><div><small>TRACKING</small><strong>{rider ? 'Partner assigned' : 'Starts after assignment'}</strong></div></div></section>
        {rider ? <section className="qk-track-card qk-track-rider-card"><span className="qk-track-rider-avatar">{initials(rider)}</span><div><small>YOUR DELIVERY PARTNER</small><strong>{rider}</strong><p><span className="qk-track-verified-dot" />Verified BuyQK partner</p></div>{phone ? <a href={`tel:${phone}`} aria-label="Call delivery partner"><svg viewBox="0 0 24 24"><path d="M8.5 4.5 6 6c-.8.5-.8 1.3-.5 2.2 1.5 4.7 5.6 8.8 10.3 10.3.9.3 1.7.3 2.2-.5l1.5-2.5-4-2-1.3 1.7c-2.4-1-4.4-3-5.4-5.4l1.7-1.3-2-4Z"/></svg></a> : null}</section> : null}
        <section className="qk-track-card"><small>DELIVERING TO</small><strong>{order.drop?.name || order.customerName || 'Customer'}</strong><p>{order.drop?.address || order.deliveryAddress || 'Your saved delivery address'}</p></section>
      </div>
    </>
  );
}

function ProfileView({ onBack, customerProfile, saveProfile, onNotice }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('qkProfileLanguage') === 'Hindi' ? 'Hindi' : 'English');
  const [name, setName] = useState(() => localStorage.getItem('qkProfileName') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('qkProfilePhone') || '');
  const [email, setEmail] = useState(() => localStorage.getItem('qkProfileEmail') || '');
  const [locked, setLocked] = useState(() => Boolean(localStorage.getItem('qkProfileName') || localStorage.getItem('qkProfilePhone') || localStorage.getItem('qkProfileEmail')));
  const [languageOpen, setLanguageOpen] = useState(false);

  useEffect(() => {
    if (!customerProfile) return;
    if (!name && customerProfile.fullName) setName(customerProfile.fullName);
    if (!phone && customerProfile.phone) setPhone(customerProfile.phone);
    if (!email && customerProfile.email) setEmail(customerProfile.email);
  }, [customerProfile, email, name, phone]);

  const text = language === 'Hindi' ? {
    title: 'प्रोफाइल', personal: 'व्यक्तिगत जानकारी', fullName: 'पूरा नाम', phone: 'फोन नंबर', email: 'ईमेल', save: 'जानकारी सेव करें', edit: 'जानकारी बदलें', language: 'भाषा', help: 'सहायता और सपोर्ट', helpText: 'समस्या रिपोर्ट करें या QK सपोर्ट से संपर्क करें', logout: 'लॉगआउट', choose: 'अपनी भाषा चुनें', saved: 'प्रोफाइल जानकारी सेव हो गई', invalid: 'सही 10 अंकों का फोन नंबर डालें', cleared: 'प्रोफाइल जानकारी हटा दी गई',
  } : {
    title: 'Profile', personal: 'Personal Details', fullName: 'Full Name', phone: 'Phone Number', email: 'Email', save: 'Save Details', edit: 'Edit Details', language: 'Language', help: 'Help & Support', helpText: 'Report an issue or contact QK support', logout: 'Logout', choose: 'Choose your language', saved: 'Profile details saved', invalid: 'Enter a valid 10-digit phone number', cleared: 'Profile details cleared',
  };

  const handleSave = async () => {
    if (locked) return setLocked(false);
    if (phone && !/^[6-9]\d{9}$/.test(phone)) return onNotice(text.invalid, true);
    localStorage.setItem('qkProfileName', name.trim());
    localStorage.setItem('qkProfilePhone', phone);
    localStorage.setItem('qkProfileEmail', email.trim());
    try { await saveProfile({ name, phone, email, address: localStorage.getItem('qkLiveLocation') || '' }); } catch (error) { console.warn(error); }
    setLocked(true);
    onNotice(text.saved);
  };

  const logout = () => {
    ['qkProfileName', 'qkProfilePhone', 'qkProfileEmail'].forEach((key) => localStorage.removeItem(key));
    setName(''); setPhone(''); setEmail(''); setLocked(false); onNotice(text.cleared);
  };

  return (
    <>
      <SecondaryHeader title={text.title} onBack={onBack} />
      <section className="view profile-v2" data-profile-enhanced="true"><div className="profile-v2-content">
        <section className="profile-v2-form-card"><h2>{text.personal}</h2>
          <div className="profile-v2-group"><label htmlFor="profileNameInput">{text.fullName}</label><div className={`profile-v2-field ${locked ? 'locked' : ''}`}><NavIcon id="profile"/><input id="profileNameInput" type="text" maxLength="60" autoComplete="name" placeholder="Enter your name" value={name} disabled={locked} onChange={(event) => setName(event.target.value)} /></div></div>
          <div className="profile-v2-group"><label htmlFor="profilePhoneInput">{text.phone}</label><div className={`profile-v2-field ${locked ? 'locked' : ''}`}><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0 1 22 16.9z"/></svg><input id="profilePhoneInput" type="tel" inputMode="numeric" maxLength="10" autoComplete="tel" placeholder="Add phone number" value={phone} disabled={locked} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} /></div></div>
          <div className="profile-v2-group"><label htmlFor="profileEmailInput">{text.email}</label><div className={`profile-v2-field ${locked ? 'locked' : ''}`}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="m4 7 8 6 8-6"/></svg><input id="profileEmailInput" type="email" maxLength="120" autoComplete="email" placeholder="Add email address" value={email} disabled={locked} onChange={(event) => setEmail(event.target.value)} /></div></div>
          <button className={`profile-v2-save ${locked ? 'edit-mode' : ''}`} type="button" onClick={handleSave}>{locked ? text.edit : text.save}</button>
        </section>
        <section className="profile-v2-menu-card"><button className="profile-v2-menu-row" type="button" onClick={() => setLanguageOpen(true)}><span className="profile-v2-menu-left"><span className="profile-v2-menu-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/></svg></span><span className="profile-v2-menu-copy"><strong>{text.language}</strong><small>{language}</small></span></span><span className="profile-v2-arrow">›</span></button><button className="profile-v2-menu-row" type="button" onClick={() => onNotice('Help & Support — coming soon')}><span className="profile-v2-menu-left"><span className="profile-v2-menu-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c-.7 1.2-2.1 1.7-2.6 2.7"/><path d="M12 17h.01"/></svg></span><span className="profile-v2-menu-copy"><strong>{text.help}</strong><small>{text.helpText}</small></span></span><span className="profile-v2-arrow">›</span></button></section>
        <button className="profile-v2-logout" type="button" onClick={logout}>{text.logout}</button>
      </div></section>
      <section className={`profile-language-sheet ${languageOpen ? 'show' : ''}`} role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) setLanguageOpen(false); }}><div className="profile-language-panel"><div className="profile-language-head"><h2>{text.choose}</h2><button className="profile-language-close" type="button" onClick={() => setLanguageOpen(false)}>×</button></div>{['English', 'Hindi'].map((option) => <button className={`profile-language-choice ${language === option ? 'active' : ''}`} type="button" key={option} onClick={() => { setLanguage(option); localStorage.setItem('qkProfileLanguage', option); setLanguageOpen(false); }}><span>{option}</span><span className="profile-language-check">✓</span></button>)}</div></section>
    </>
  );
}

function AiProductCard({ product, storeName, quantity, onAdd, onChange }) {
  return <article className="ai-product-card"><div className="ai-product-image"><img src={product.image} alt={product.name} loading="lazy"/><span>AI PICK</span></div><div className="ai-product-info"><small>{storeName}</small><strong>{product.name}</strong><p>{[product.brand, product.unit].filter(Boolean).join(' · ') || 'Available now'}</p><div className="ai-product-footer"><b>{money(product.price)}</b>{quantity ? <div className="ai-product-quantity"><button type="button" onClick={() => onChange(product.key, -1)}>−</button><strong>{quantity}</strong><button type="button" onClick={() => onChange(product.key, 1)}>+</button></div> : <button className="ai-product-add" type="button" onClick={() => onAdd(product)}><span>ADD</span><b>+</b></button>}</div></div></article>;
}

function AiView({ onBack, stores, products, cart, orders, location, onAdd, onChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight }); }, [messages]);
  const resizeInput = () => { const element = inputRef.current; if (!element) return; element.style.height = '42px'; element.style.height = `${Math.min(Math.max(element.scrollHeight, 42), 84)}px`; };
  useEffect(resizeInput, [input]);

  const resolveRecommendations = (message) => {
    const refs = Array.isArray(message.recommendations) ? message.recommendations : [];
    return refs.map((reference) => products.find((product) => String(product.id) === String(reference?.id || '') && String(product.storeId) === String(reference?.storeId || ''))).filter(Boolean).slice(0, 6);
  };

  const ask = async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || busy) return;
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: 'user', content: text }, { role: 'assistant', content: 'Thinking…' }]);
    setInput(''); setBusy(true);
    try {
      const response = await fetch('/api/buyqk-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, history, context: { app: 'BuyQK customer app', deliveryLocation: location || 'Not selected', appRules: { orderFlow: 'Choose one store, add products, open cart, enter receiver name and phone, select delivery location, then place the order.', oneStorePerOrder: true, paymentMode: 'Cash on Delivery' }, cart: Object.values(cart).map(({ product, quantity }) => ({ name: product.name, unit: product.unit, price: product.price, quantity, storeId: product.storeId })), orders: orders.slice(0, 8).map((order) => ({ orderNumber: orderNumber(order), storeName: order.storeName, status: statusLabel(order.status), itemCount: orderItemCount(order), totalAmount: order.totalAmount })), catalog: { stores: stores.slice(0, 15), products: products.slice(0, 80).map(({ id, name, brand, unit, category, price, storeId }) => ({ id, name, brand, unit, category, price, storeId, available: true })) } } }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'AI is temporarily unavailable.');
      const reply = normalizeAiText(data.reply);
      if (!reply) throw new Error('AI returned an empty response.');
      setMessages((current) => current.map((message, index) => index === current.length - 1 ? { role: 'assistant', content: reply, recommendations: Array.isArray(data.recommendations) ? data.recommendations.slice(0, 6) : [] } : message));
    } catch (error) {
      const fallback = String(error?.message || '').includes('API_KEY') ? 'BuyQK AI is not configured on the server yet.' : 'BuyQK AI is temporarily unavailable. Please try again.';
      setMessages((current) => current.map((message, index) => index === current.length - 1 ? { role: 'assistant', content: fallback } : message));
    } finally { setBusy(false); window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0); }
  };

  return (
    <>
      <SecondaryHeader title="BuyQK AI" onBack={onBack} />
      <div className="view ai-view"><div className="ai-quick-row">{AI_QUICK_PROMPTS.map((prompt) => <button type="button" key={prompt} disabled={busy} onClick={() => ask(prompt)}>{prompt}</button>)}</div><section className="ai-chat-card" aria-label="BuyQK AI chat"><div className="ai-messages" id="aiMessages" ref={messagesRef}>{!messages.length ? <div className="ai-welcome-card"><strong>Ask BuyQK AI</strong><span>Shopping help, product suggestions, budget baskets, and order support.</span></div> : null}{messages.map((message, index) => { const recommendations = resolveRecommendations(message); return <div className={`ai-message ${message.role === 'user' ? 'user' : 'assistant'} ${recommendations.length ? 'has-products' : ''}`} key={`${message.role}-${index}`}><div className="ai-message-copy">{normalizeAiText(message.content)}</div>{recommendations.length ? <section className="ai-recommendations"><div className="ai-recommendation-head"><span><NavIcon id="ai"/></span><div><strong>Recommended products</strong><small>Add directly to your cart</small></div></div><div className="ai-product-row">{recommendations.map((product) => <AiProductCard key={product.key} product={product} storeName={stores.find((store) => store.id === product.storeId)?.name || 'BuyQK Store'} quantity={cart[product.key]?.quantity || 0} onAdd={onAdd} onChange={onChange} />)}</div></section> : null}</div>; })}</div><form className="ai-form" onSubmit={(event) => { event.preventDefault(); ask(input); }}><textarea ref={inputRef} id="aiInput" rows="1" maxLength="240" autoComplete="off" enterKeyHint="send" placeholder="Ask BuyQK AI..." value={input} disabled={busy} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} onFocus={() => document.body.classList.add('qk-ai-input-focused')} onBlur={() => document.body.classList.remove('qk-ai-input-focused')} /><button id="aiSend" type="submit" disabled={busy}>Send</button></form></section></div>
    </>
  );
}

function CartOverlay({ open, cart, customerName, customerPhone, placing, onClose, onName, onPhone, onChange, onCheckout }) {
  const items = Object.values(cart);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryFee = items.length ? (subtotal >= 299 ? 0 : 25) : 0;
  const platformFee = items.length ? 3 : 0;
  const total = subtotal + deliveryFee + platformFee;
  return (
    <section className={`cart-overlay ${open ? 'open' : ''}`} id="cartOverlay" aria-label="Cart">
      <div className="overlay-header"><button className="round-back" id="cartClose" type="button" aria-label="Close cart" onClick={onClose}><svg viewBox="0 0 24 24"><path d="m15 19-7-7 7-7"/></svg></button><h2>Your Cart</h2></div>
      <div className="cart-body" id="cartBody">{items.length ? <div className="product-list">{items.map(({ product, quantity }) => <article className="product-card" data-cart-product key={product.key}><div className="product-thumb"><img src={product.image} alt="" /></div><div className="product-info"><div className="product-name">{product.name}</div><div className="product-unit">{product.unit}</div><div className="product-price">{money(product.price * quantity)}</div><div className="card-actions"><button type="button" onClick={() => onChange(product.key, -1)}>−</button><strong>Qty {quantity}</strong><button type="button" onClick={() => onChange(product.key, 1)}>+</button></div></div></article>)}</div> : <EmptyState icon="🛒" title="Your cart is empty" subtitle="Add products from a merchant store." />}</div>
      <div className="cart-footer" id="cartFooter" style={{ display: items.length ? '' : 'none' }}><section className="customer-details-card" aria-labelledby="customerDetailsTitle"><div className="checkout-section-head"><div><small>DELIVERY DETAILS</small><strong id="customerDetailsTitle">Who should receive this order?</strong></div><span>Required</span></div><label className="checkout-field"><span>Full name</span><input id="customerNameInput" type="text" maxLength="60" autoComplete="name" placeholder="Enter your name" value={customerName} onChange={(event) => onName(event.target.value)} /></label><label className="checkout-field"><span>Phone number</span><input id="customerPhoneInput" type="tel" inputMode="numeric" maxLength="10" autoComplete="tel" placeholder="10-digit mobile number" value={customerPhone} onChange={(event) => onPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} /></label><p className="checkout-hint">Your order will be sent directly to the selected merchant.</p></section><section className="bill-details-card" aria-label="Bill details"><div className="checkout-section-head"><div><small>PAYMENT SUMMARY</small><strong>Bill details</strong></div></div><div className="bill-row"><span>Item subtotal</span><strong id="cartSubtotal">{money(subtotal)}</strong></div><div className="bill-row"><span>Delivery fee</span><strong id="cartDeliveryFee">{deliveryFee ? money(deliveryFee) : 'FREE'}</strong></div><div className="bill-row"><span>Platform fee</span><strong id="cartPlatformFee">{money(platformFee)}</strong></div><div className="bill-row bill-total"><span>To pay</span><strong id="cartPayable">{money(total)}</strong></div></section><div className="cart-total"><span>Total</span><strong id="cartTotal">{money(total)}</strong></div><button className="checkout-btn" id="checkoutBtn" type="button" disabled={placing} onClick={onCheckout}>{placing ? 'Placing order…' : 'Place order'}</button></div>
    </section>
  );
}

function LocationSheet({ open, savedLocation, detected, detecting, manualVisible, house, street, onClose, onDetect, onHouse, onStreet, onSave }) {
  return <section className={`sheet ${open ? 'show' : ''}`} id="locationSheet" role="dialog" aria-modal="true" aria-labelledby="locationTitle"><div className="sheet-panel"><div className="sheet-head"><h2 id="locationTitle">Select location</h2><button className="sheet-close" id="locationClose" type="button" aria-label="Close location sheet" onClick={onClose}>×</button></div><button className={`location-access-btn ${detected ? 'hidden' : ''}`} id="allowLocationBtn" type="button" disabled={detecting} onClick={onDetect}>{detecting ? 'Detecting location…' : 'Give location access'}</button><div className={`detected-location ${detected ? '' : 'hidden'}`} id="detectedLocationBox"><small>DETECTED LOCATION</small><strong id="detectedLocationText">{detected}</strong></div><div className={`manual-address ${manualVisible ? '' : 'hidden'}`} id="manualAddressBox"><p>Add exact address</p><input id="houseInput" type="text" placeholder="House / Flat / Floor" autoComplete="address-line1" value={house} onChange={(event) => onHouse(event.target.value)} /><input id="streetInput" type="text" placeholder="Street / Area / Landmark" autoComplete="address-line2" value={street} onChange={(event) => onStreet(event.target.value)} /><button className="save-address-btn" id="saveAddressBtn" type="button" onClick={onSave}>Save address</button></div><p className="location-status" id="locationStatus">{savedLocation ? 'Your delivery address is saved.' : 'Tap Give location access to detect your area.'}</p></div></section>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('darkstore');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [location, setLocation] = useState(() => localStorage.getItem('qkLiveLocation') || '');
  const [detected, setDetected] = useState(() => localStorage.getItem('qkDetectedLocation') || '');
  const [detecting, setDetecting] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [house, setHouse] = useState('');
  const [street, setStreet] = useState('');
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('qkCustomerName') || '');
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('qkCustomerPhone') || '');
  const [placing, setPlacing] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState({ message: '', error: false, show: false });
  const [preloading, setPreloading] = useState(true);
  const [preloadProgress, setPreloadProgress] = useState(8);
  const [liveBannerDismissed, setLiveBannerDismissed] = useState(false);
  const toastTimer = useRef(null);

  const showNotice = useCallback((message, error = false) => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, error, show: true });
    toastTimer.current = window.setTimeout(() => setToast((current) => ({ ...current, show: false })), 2600);
  }, []);

  const { stores, products, orders, catalogLoading, customerProfile, saveCustomerProfile, createOrder, cancelOrder } = useMyQKData(showNotice);
  const activeStore = stores.find((store) => store.id === activeStoreId) || null;
  const activeOrder = orders.find((order) => !TERMINAL_STATUSES.has(order.status)) || null;
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null;
  const cartCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    document.body.classList.toggle('secondary-tab-active', activeTab !== 'darkstore');
    document.body.dataset.secondaryTab = activeTab !== 'darkstore' ? activeTab : '';
    if (activeTab !== 'darkstore') setActiveStoreId(null);
    if (activeTab !== 'orders') setSelectedOrderId(null);
    return () => { document.body.classList.remove('secondary-tab-active'); delete document.body.dataset.secondaryTab; };
  }, [activeTab]);

  useEffect(() => {
    document.body.oncontextmenu = () => false;
    return () => { document.body.oncontextmenu = null; window.clearTimeout(toastTimer.current); };
  }, []);

  useEffect(() => {
    if (!customerProfile) return;
    if (!customerName && customerProfile.fullName) setCustomerName(customerProfile.fullName);
    if (!customerPhone && customerProfile.phone) setCustomerPhone(customerProfile.phone);
    if (!location && customerProfile.address) { setLocation(customerProfile.address); localStorage.setItem('qkLiveLocation', customerProfile.address); }
  }, [customerName, customerPhone, customerProfile, location]);

  useEffect(() => { localStorage.setItem('qkCustomerName', customerName); }, [customerName]);
  useEffect(() => { localStorage.setItem('qkCustomerPhone', customerPhone); }, [customerPhone]);

  useEffect(() => {
    const interval = window.setInterval(() => setPreloadProgress((value) => Math.min(catalogLoading ? 76 : 96, value + (value < 40 ? 5 : 2))), 220);
    const release = window.setTimeout(() => {
      if (!catalogLoading) { setPreloadProgress(100); window.setTimeout(() => { setPreloading(false); document.body.classList.remove('qk-preloading'); }, 180); }
    }, 900);
    const force = window.setTimeout(() => { setPreloadProgress(100); setPreloading(false); document.body.classList.remove('qk-preloading'); }, 10000);
    return () => { window.clearInterval(interval); window.clearTimeout(release); window.clearTimeout(force); };
  }, [catalogLoading]);

  useEffect(() => { setLiveBannerDismissed(false); }, [activeOrder?.id]);

  const switchTab = (tab) => { setActiveTab(tab); setSearch(tab === 'darkstore' ? search : ''); };
  const addProduct = (product) => {
    setCart((current) => {
      const existing = Object.values(current);
      const next = existing.length && existing[0].product.storeId !== product.storeId ? {} : { ...current };
      if (existing.length && existing[0].product.storeId !== product.storeId) showNotice('Previous store cart cleared. One store per order.');
      next[product.key] = { product, quantity: (next[product.key]?.quantity || 0) + 1 };
      return next;
    });
    showNotice(`${product.name} added to cart`);
  };
  const changeCart = (key, delta) => setCart((current) => { const item = current[key]; if (!item) return current; const quantity = Math.max(0, item.quantity + delta); const next = { ...current }; if (!quantity) delete next[key]; else next[key] = { ...item, quantity }; return next; });

  const reverseGeocode = async (latitude, longitude) => {
    try { const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`); const data = await response.json(); return data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`; } catch { return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`; }
  };
  const detectLocation = () => {
    if (!navigator.geolocation) { setManualVisible(true); return showNotice('Location is not supported on this device.', true); }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const coordinates = { latitude: Number(coords.latitude.toFixed(6)), longitude: Number(coords.longitude.toFixed(6)), accuracy: Math.round(coords.accuracy || 0) };
      localStorage.setItem('qkLocationCoords', JSON.stringify(coordinates));
      const nextDetected = await reverseGeocode(coords.latitude, coords.longitude);
      setDetected(nextDetected); setManualVisible(true); setDetecting(false); localStorage.setItem('qkDetectedLocation', nextDetected);
    }, () => { setManualVisible(true); setDetecting(false); showNotice('Location access was not granted. Add your address manually.', true); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  };
  const saveAddress = async () => {
    const exact = [house.trim(), street.trim()].filter(Boolean).join(', ');
    if (!exact) return showNotice('Add your exact address.', true);
    const full = [exact, detected.trim()].filter(Boolean).join(', ');
    setLocation(full); localStorage.setItem('qkLiveLocation', full); setLocationOpen(false);
    if (customerName && customerPhone.length === 10) saveCustomerProfile({ name: customerName, phone: customerPhone, address: full }).catch(() => {});
  };
  const closeLocation = () => { if (!location) return showNotice('Select a delivery location first.', true); setLocationOpen(false); };

  const checkout = async () => {
    const items = Object.values(cart);
    if (!items.length) return showNotice('Cart is empty.', true);
    if (!customerName.trim()) return showNotice('Enter receiver name.', true);
    if (!/^[6-9]\d{9}$/.test(customerPhone)) return showNotice('Enter a valid 10-digit phone number.', true);
    if (!location) { setCartOpen(false); setLocationOpen(true); return showNotice('Select delivery location first.', true); }
    const store = stores.find((entry) => entry.id === items[0].product.storeId);
    if (!store) return showNotice('This store is currently unavailable.', true);
    if (items.some((item) => item.product.storeId !== store.id)) return showNotice('Only one store is allowed per order.', true);
    setPlacing(true);
    try { const number = await createOrder({ cartItems: items, store, name: customerName.trim(), phone: customerPhone, address: location }); setCart({}); setCartOpen(false); setActiveTab('orders'); showNotice(`Order #${number} placed successfully.`); } catch (error) { console.error(error); showNotice(error?.message || 'Order could not be placed. Try again.', true); } finally { setPlacing(false); }
  };

  const handleCancel = async (orderId) => { setCancelling(true); try { await cancelOrder(orderId); setSelectedOrderId(null); showNotice('Order cancelled.'); } catch (error) { console.error(error); showNotice('Order could not be cancelled.', true); } finally { setCancelling(false); } };
  const goBackFromSecondary = () => { if (activeTab === 'orders' && selectedOrderId) setSelectedOrderId(null); else setActiveTab('darkstore'); };

  let mainContent;
  if (activeTab === 'darkstore') mainContent = activeStore ? <StoreView store={activeStore} products={products} search={search} onBack={() => setActiveStoreId(null)} onAdd={addProduct} /> : <HomeView stores={stores} loading={catalogLoading} search={search} activeCategory={activeCategory} onCategory={(category) => { setActiveCategory(category); setActiveStoreId(null); }} onStore={setActiveStoreId} onNotice={showNotice} />;
  else if (activeTab === 'orders') mainContent = <OrdersView orders={orders} selectedOrder={selectedOrder} onSelect={setSelectedOrderId} onBack={goBackFromSecondary} onCancel={handleCancel} cancelling={cancelling} />;
  else if (activeTab === 'track') mainContent = <TrackView order={activeOrder} onBack={goBackFromSecondary} />;
  else if (activeTab === 'ai') mainContent = <AiView onBack={goBackFromSecondary} stores={stores} products={products} cart={cart} orders={orders} location={location} onAdd={addProduct} onChange={changeCart} />;
  else mainContent = <ProfileView onBack={goBackFromSecondary} customerProfile={customerProfile} saveProfile={saveCustomerProfile} onNotice={showNotice} />;

  return (
    <>
      <Preloader visible={preloading} progress={preloadProgress} />
      <div id="app">
        <Header location={location} cartCount={cartCount} onLocation={() => { setLocationOpen(true); setManualVisible(false); }} onCart={() => setCartOpen(true)} />
        {activeTab === 'darkstore' ? <SearchBar value={search} onChange={setSearch} /> : null}
        {activeOrder && !liveBannerDismissed ? <section className="live-order-banner" id="liveOrderBanner" aria-live="polite"><button type="button" onClick={() => setActiveTab('track')}><strong>Order #{orderNumber(activeOrder)}</strong><span>{statusLabel(activeOrder.status)}</span></button><button className="qk-live-order-dismiss" type="button" aria-label="Dismiss live order banner" onClick={() => setLiveBannerDismissed(true)}>×</button></section> : null}
        <main className="app-main" id="appMain">{mainContent}</main>
        <nav className="bottom-nav" id="bottomNav" aria-label="Primary navigation">{NAV_TABS.map((tab) => <button className={`nav-item ${activeTab === tab.id ? 'active' : ''}`} type="button" key={tab.id} onClick={() => switchTab(tab.id)}><span className="nav-icon"><NavIcon id={tab.id} /></span><span className="nav-label">{tab.label}</span></button>)}</nav>
      </div>
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.error ? 'error' : ''}`} id="toast" role="status" aria-live="polite">{toast.message}</div>
      <CartOverlay open={cartOpen} cart={cart} customerName={customerName} customerPhone={customerPhone} placing={placing} onClose={() => setCartOpen(false)} onName={setCustomerName} onPhone={setCustomerPhone} onChange={changeCart} onCheckout={checkout} />
      <LocationSheet open={locationOpen} savedLocation={location} detected={detected} detecting={detecting} manualVisible={manualVisible} house={house} street={street} onClose={closeLocation} onDetect={detectLocation} onHouse={setHouse} onStreet={setStreet} onSave={saveAddress} />
    </>
  );
}
