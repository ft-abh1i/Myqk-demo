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
        padding-bottom: 12px !important;
      }

      .qk-map-confirm-bar {
        flex: 0 0 auto;
        padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
        border-top: 1px solid var(--border, #e7ece8);
        background: #ffffff;
        box-shadow: 0 -8px 22px rgba(22, 38, 31, .08);
      }

      .qk-map-confirm-bar .qk-confirm-map {
        width: 100%;
        margin: 0;
      }

      @media (max-height: 720px) {
        .qk-map-picker-head {
          min-height: 58px !important;
        }

        .qk-map-confirm-bar {
          padding-top: 8px;
          padding-bottom: calc(8px + env(safe-area-inset-bottom));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function polishPicker() {
    const picker = byId('qkMapPicker');
    const shell = picker?.querySelector('.qk-map-picker-shell');
    const confirmButton = byId('qkConfirmMapLocation');
    if (!picker || !shell || !confirmButton) return false;

    picker.querySelector('.qk-map-picker-head p')?.remove();

    let confirmBar = byId('qkMapConfirmBar');
    if (!confirmBar) {
      confirmBar = document.createElement('div');
      confirmBar.id = 'qkMapConfirmBar';
      confirmBar.className = 'qk-map-confirm-bar';
      shell.appendChild(confirmBar);
    }

    if (confirmButton.parentElement !== confirmBar) {
      confirmBar.appendChild(confirmButton);
    }

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
