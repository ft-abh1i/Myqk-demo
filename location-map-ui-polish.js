'use strict';

(() => {
  function byId(id) {
    return document.getElementById(id);
  }

  function installStyles() {
    if (byId('qkMapUiPolishStyles')) return;

    const style = document.createElement('style');
    style.id = 'qkMapUiPolishStyles';
    style.textContent = `
      .qk-map-picker-head p {
        display: none !important;
      }

      .qk-map-picker-head {
        min-height: 62px !important;
      }

      .qk-map-picker-head > div {
        display: flex;
        align-items: center;
      }

      .qk-map-picker-foot {
        flex: 0 1 auto !important;
        min-height: 0 !important;
        max-height: min(55dvh, 390px) !important;
        padding-bottom: calc(10px + env(safe-area-inset-bottom)) !important;
      }

      .qk-map-picker.open #qkConfirmMapLocation {
        position: static !important;
        width: 100% !important;
        min-height: 46px !important;
        margin: 0 !important;
        transform: none !important;
        box-shadow: 0 6px 16px rgba(31, 122, 77, .16) !important;
      }

      @media (max-height: 720px) {
        .qk-map-picker-head {
          min-height: 54px !important;
        }

        .qk-map-picker-foot {
          max-height: 58dvh !important;
          padding-bottom: calc(8px + env(safe-area-inset-bottom)) !important;
        }

        .qk-map-picker.open #qkConfirmMapLocation {
          min-height: 44px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function polishPicker() {
    const picker = byId('qkMapPicker');
    const confirmButton = byId('qkConfirmMapLocation');
    if (!picker || !confirmButton) return false;

    picker.querySelector('.qk-map-picker-head p')?.remove();
    confirmButton.setAttribute('aria-label', 'Confirm delivery location');
    return true;
  }

  function install() {
    installStyles();

    if (polishPicker()) return;

    const observer = new MutationObserver(() => {
      if (polishPicker()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
