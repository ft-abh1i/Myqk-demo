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
        min-height: 66px !important;
      }

      .qk-map-picker-head > div {
        display: flex;
        align-items: center;
      }

      .qk-map-picker-foot {
        min-height: 0 !important;
        padding-bottom: calc(86px + env(safe-area-inset-bottom)) !important;
      }

      .qk-map-confirm-bar {
        flex: 0 0 0 !important;
        width: 0 !important;
        height: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      .qk-map-picker.open #qkConfirmMapLocation {
        position: fixed !important;
        left: 50% !important;
        right: auto !important;
        bottom: calc(10px + env(safe-area-inset-bottom)) !important;
        z-index: 1400 !important;
        width: min(calc(100vw - 28px), 532px) !important;
        min-height: 52px !important;
        margin: 0 !important;
        transform: translateX(-50%) !important;
        box-shadow: 0 8px 24px rgba(22, 38, 31, .22) !important;
      }

      @media (max-height: 720px) {
        .qk-map-picker-head {
          min-height: 58px !important;
        }

        .qk-map-picker-foot {
          padding-bottom: calc(82px + env(safe-area-inset-bottom)) !important;
        }

        .qk-map-picker.open #qkConfirmMapLocation {
          min-height: 48px !important;
          bottom: calc(8px + env(safe-area-inset-bottom)) !important;
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
