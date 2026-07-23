import { useEffect } from 'react';
import { startLegacyRuntime } from './legacyRuntime.js';

function Header() {
  return (
    <header className="app-header" id="appHeader">
      <button className="location-btn" id="locationBtn" type="button" aria-label="Select delivery location">
        <span className="location-pin" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 22s7-7.58 7-13A7 7 0 1 0 5 9c0 5.42 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>
        </span>
        <span className="location-text">
          <span className="location-label">Delivering to</span>
          <span className="location-address">
            <span id="locationAddress">Select your area</span>
            <svg className="chevron" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
          </span>
        </span>
      </button>
      <button className="cart-btn" id="cartBtn" type="button" aria-label="Open cart">
        <svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="21" r="1.4"/><circle cx="18" cy="21" r="1.4"/></svg>
        <span className="cart-badge" id="cartBadge">0</span>
      </button>
    </header>
  );
}

function SearchBar() {
  return (
    <div className="search-wrap" id="searchWrap">
      <label className="search-bar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="searchInput" type="search" placeholder="Search products or stores" autoComplete="off" />
        <button className="search-clear" id="searchClear" type="button" aria-label="Clear search">×</button>
      </label>
    </div>
  );
}

function CartOverlay() {
  return (
    <section className="cart-overlay" id="cartOverlay" aria-label="Cart">
      <div className="overlay-header">
        <button className="round-back" id="cartClose" type="button" aria-label="Close cart"><svg viewBox="0 0 24 24"><path d="m15 19-7-7 7-7"/></svg></button>
        <h2>Your Cart</h2>
      </div>
      <div className="cart-body" id="cartBody" />
      <div className="cart-footer" id="cartFooter">
        <section className="customer-details-card" aria-labelledby="customerDetailsTitle">
          <div className="checkout-section-head"><div><small>DELIVERY DETAILS</small><strong id="customerDetailsTitle">Who should receive this order?</strong></div><span>Required</span></div>
          <label className="checkout-field"><span>Full name</span><input id="customerNameInput" type="text" maxLength="60" autoComplete="name" placeholder="Enter your name" /></label>
          <label className="checkout-field"><span>Phone number</span><input id="customerPhoneInput" type="tel" inputMode="numeric" maxLength="10" autoComplete="tel" placeholder="10-digit mobile number" /></label>
          <p className="checkout-hint">Your order will be verified and sent directly to the selected merchant.</p>
        </section>
        <section className="bill-details-card" aria-label="Bill details">
          <div className="checkout-section-head"><div><small>PAYMENT SUMMARY</small><strong>Bill details</strong></div></div>
          <div className="bill-row"><span>Item subtotal</span><strong id="cartSubtotal">₹0</strong></div>
          <div className="bill-row"><span>Delivery fee</span><strong id="cartDeliveryFee">₹0</strong></div>
          <div className="bill-row"><span>Platform fee</span><strong id="cartPlatformFee">₹0</strong></div>
          <div className="bill-row bill-total"><span>To pay</span><strong id="cartPayable">₹0</strong></div>
        </section>
        <div className="checkout-error hidden" id="checkoutError" role="alert" />
        <div className="cart-total"><span>Total</span><strong id="cartTotal">₹0</strong></div>
        <button className="checkout-btn" id="checkoutBtn" type="button">Place order</button>
      </div>
    </section>
  );
}

function LocationSheet() {
  return (
    <section className="sheet" id="locationSheet" role="dialog" aria-modal="true" aria-labelledby="locationTitle">
      <div className="sheet-panel">
        <div className="sheet-head"><h2 id="locationTitle">Select location</h2><button className="sheet-close" id="locationClose" type="button" aria-label="Close location sheet">×</button></div>
        <button className="location-access-btn" id="allowLocationBtn" type="button">Give location access</button>
        <div className="detected-location hidden" id="detectedLocationBox"><small>DETECTED LOCATION</small><strong id="detectedLocationText" /></div>
        <div className="manual-address hidden" id="manualAddressBox">
          <p>Add exact address</p>
          <input id="houseInput" type="text" placeholder="House / Flat / Floor" autoComplete="address-line1" />
          <input id="streetInput" type="text" placeholder="Street / Area / Landmark" autoComplete="address-line2" />
          <button className="save-address-btn" id="saveAddressBtn" type="button">Save address</button>
        </div>
        <p className="location-status" id="locationStatus">Tap Give location access to detect your area.</p>
      </div>
    </section>
  );
}

export default function App() {
  useEffect(() => {
    document.body.classList.add('qk-preloading');
    document.body.oncontextmenu = () => false;
    startLegacyRuntime();

    return () => {
      document.body.oncontextmenu = null;
    };
  }, []);

  return (
    <>
      <section id="qkPreloader" className="qk-preloader" aria-label="Loading BuyQK" aria-live="polite" />
      <div id="app">
        <Header />
        <SearchBar />
        <section className="live-order-banner hidden" id="liveOrderBanner" aria-live="polite" />
        <main className="app-main" id="appMain" />
        <nav className="bottom-nav" id="bottomNav" aria-label="Primary navigation" />
      </div>
      <div className="toast" id="toast" role="status" aria-live="polite" />
      <CartOverlay />
      <LocationSheet />
    </>
  );
}
