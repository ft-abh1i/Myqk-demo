'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const cartBody = document.getElementById('cartBody');
  const cartFooter = document.getElementById('cartFooter');
  const customerNameInput = document.getElementById('customerNameInput');
  const customerPhoneInput = document.getElementById('customerPhoneInput');
  const subtotalEl = document.getElementById('cartSubtotal');
  const deliveryFeeEl = document.getElementById('cartDeliveryFee');
  const platformFeeEl = document.getElementById('cartPlatformFee');
  const payableEl = document.getElementById('cartPayable');
  const cartTotal = document.getElementById('cartTotal');
  if (!cartBody || !cartFooter) return;

  customerNameInput.value = localStorage.getItem('qkCustomerName') || '';
  customerPhoneInput.value = localStorage.getItem('qkCustomerPhone') || '';

  customerNameInput.addEventListener('input', () => {
    localStorage.setItem('qkCustomerName', customerNameInput.value.trimStart());
  });
  customerPhoneInput.addEventListener('input', () => {
    customerPhoneInput.value = customerPhoneInput.value.replace(/\D/g, '').slice(0, 10);
    localStorage.setItem('qkCustomerPhone', customerPhoneInput.value);
  });

  function money(value) {
    return `₹${Math.max(0, Math.round(value))}`;
  }

  function readSubtotal() {
    return [...cartBody.querySelectorAll('[data-cart-product] .product-price')]
      .reduce((sum, element) => sum + (Number(element.textContent.replace(/[^0-9.]/g, '')) || 0), 0);
  }

  function updateBill() {
    const subtotal = readSubtotal();
    const hasItems = Boolean(cartBody.querySelector('[data-cart-product]'));
    const deliveryFee = hasItems ? (subtotal >= 299 ? 0 : 25) : 0;
    const platformFee = hasItems ? 3 : 0;
    const total = subtotal + deliveryFee + platformFee;

    subtotalEl.textContent = money(subtotal);
    deliveryFeeEl.textContent = deliveryFee ? money(deliveryFee) : 'FREE';
    platformFeeEl.textContent = money(platformFee);
    payableEl.textContent = money(total);
    cartTotal.textContent = money(total);
    cartFooter.dataset.subtotal = String(subtotal);
    cartFooter.dataset.deliveryFee = String(deliveryFee);
    cartFooter.dataset.platformFee = String(platformFee);
    cartFooter.dataset.payable = String(total);
  }

  new MutationObserver(updateBill).observe(cartBody, { childList: true, subtree: true, characterData: true });
  updateBill();
});