'use strict';

(() => {
  const STORAGE = {
    name: 'qkProfileName',
    phone: 'qkProfilePhone',
    email: 'qkProfileEmail',
    language: 'qkProfileLanguage'
  };

  const copy = {
    English: {
      title: 'Profile', personal: 'Personal Details', fullName: 'Full Name', namePlaceholder: 'Enter your name',
      phone: 'Phone Number', phonePlaceholder: 'Add phone number', email: 'Email', emailPlaceholder: 'Add email address',
      save: 'Save Details', edit: 'Edit Details', language: 'Language', help: 'Help & Support',
      helpText: 'Report an issue or contact QK support', logout: 'Logout', chooseLanguage: 'Choose your language',
      saved: 'Profile details saved', invalidPhone: 'Enter a valid 10-digit phone number', loggedOut: 'Profile details cleared'
    },
    Hindi: {
      title: 'प्रोफाइल', personal: 'व्यक्तिगत जानकारी', fullName: 'पूरा नाम', namePlaceholder: 'अपना नाम डालें',
      phone: 'फोन नंबर', phonePlaceholder: 'फोन नंबर जोड़ें', email: 'ईमेल', emailPlaceholder: 'ईमेल एड्रेस जोड़ें',
      save: 'जानकारी सेव करें', edit: 'जानकारी बदलें', language: 'भाषा', help: 'सहायता और सपोर्ट',
      helpText: 'समस्या रिपोर्ट करें या QK सपोर्ट से संपर्क करें', logout: 'लॉगआउट', chooseLanguage: 'अपनी भाषा चुनें',
      saved: 'प्रोफाइल जानकारी सेव हो गई', invalidPhone: 'सही 10 अंकों का फोन नंबर डालें', loggedOut: 'प्रोफाइल जानकारी हटा दी गई'
    }
  };

  let main = null;
  let observer = null;
  let mounting = false;
  let languageSheet = null;

  function getLanguage() {
    const saved = localStorage.getItem(STORAGE.language);
    return saved === 'Hindi' ? 'Hindi' : 'English';
  }

  function getValue(key) {
    return localStorage.getItem(STORAGE[key]) || '';
  }

  function setValue(key, value) {
    localStorage.setItem(STORAGE[key], value);
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function isProfileActive() {
    return Boolean(document.querySelector('#bottomNav [data-tab="profile"].active'));
  }

  function profileMarkup(language, locked) {
    const text = copy[language];
    const name = getValue('name');
    const phone = getValue('phone');
    const email = getValue('email');

    return `
      <section class="view profile-v2" data-profile-enhanced="true">
        <h1 class="profile-v2-title">${text.title}</h1>
        <div class="profile-v2-content">
          <section class="profile-v2-form-card">
            <h2>${text.personal}</h2>

            <div class="profile-v2-group">
              <label for="profileNameInput">${text.fullName}</label>
              <div class="profile-v2-field ${locked ? 'locked' : ''}">
                <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input id="profileNameInput" type="text" maxlength="60" autocomplete="name" placeholder="${text.namePlaceholder}" value="${escapeAttribute(name)}" ${locked ? 'disabled' : ''}>
              </div>
            </div>

            <div class="profile-v2-group">
              <label for="profilePhoneInput">${text.phone}</label>
              <div class="profile-v2-field ${locked ? 'locked' : ''}">
                <svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0 1 22 16.9z"/></svg>
                <input id="profilePhoneInput" type="tel" inputmode="numeric" maxlength="10" autocomplete="tel" placeholder="${text.phonePlaceholder}" value="${escapeAttribute(phone)}" ${locked ? 'disabled' : ''}>
              </div>
            </div>

            <div class="profile-v2-group">
              <label for="profileEmailInput">${text.email}</label>
              <div class="profile-v2-field ${locked ? 'locked' : ''}">
                <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="m4 7 8 6 8-6"/></svg>
                <input id="profileEmailInput" type="email" maxlength="120" autocomplete="email" placeholder="${text.emailPlaceholder}" value="${escapeAttribute(email)}" ${locked ? 'disabled' : ''}>
              </div>
            </div>

            <button class="profile-v2-save ${locked ? 'edit-mode' : ''}" id="profileSaveBtn" type="button">${locked ? text.edit : text.save}</button>
          </section>

          <section class="profile-v2-menu-card">
            <button class="profile-v2-menu-row" id="profileLanguageBtn" type="button">
              <span class="profile-v2-menu-left">
                <span class="profile-v2-menu-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/></svg></span>
                <span class="profile-v2-menu-copy"><strong>${text.language}</strong><small>${language}</small></span>
              </span>
              <span class="profile-v2-arrow">›</span>
            </button>

            <button class="profile-v2-menu-row" id="profileHelpBtn" type="button">
              <span class="profile-v2-menu-left">
                <span class="profile-v2-menu-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c-.7 1.2-2.1 1.7-2.6 2.7"/><path d="M12 17h.01"/></svg></span>
                <span class="profile-v2-menu-copy"><strong>${text.help}</strong><small>${text.helpText}</small></span>
              </span>
              <span class="profile-v2-arrow">›</span>
            </button>
          </section>

          <button class="profile-v2-logout" id="profileLogoutBtn" type="button">${text.logout}</button>
        </div>
      </section>`;
  }

  function escapeAttribute(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  function hasSavedDetails() {
    return Boolean(getValue('name') || getValue('phone') || getValue('email'));
  }

  function mountProfile(forceEdit = false) {
    if (!main || !isProfileActive() || mounting) return;
    if (main.querySelector('[data-profile-enhanced="true"]') && !forceEdit) return;

    mounting = true;
    const language = getLanguage();
    const locked = hasSavedDetails() && !forceEdit;
    main.innerHTML = profileMarkup(language, locked);
    bindProfileEvents(locked);
    mounting = false;
  }

  function bindProfileEvents(locked) {
    const nameInput = document.getElementById('profileNameInput');
    const phoneInput = document.getElementById('profilePhoneInput');
    const emailInput = document.getElementById('profileEmailInput');
    const saveButton = document.getElementById('profileSaveBtn');
    const languageButton = document.getElementById('profileLanguageBtn');
    const helpButton = document.getElementById('profileHelpBtn');
    const logoutButton = document.getElementById('profileLogoutBtn');

    if (!nameInput || !phoneInput || !emailInput || !saveButton || !languageButton || !helpButton || !logoutButton) {
      console.error('QK profile module could not bind required controls.');
      return;
    }

    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    });

    saveButton.addEventListener('click', () => {
      if (locked) {
        mountProfile(true);
        window.setTimeout(() => document.getElementById('profileNameInput')?.focus(), 0);
        return;
      }

      const language = getLanguage();
      const text = copy[language];
      const phone = phoneInput.value.trim();
      if (phone && phone.length !== 10) {
        showToast(text.invalidPhone);
        phoneInput.focus();
        return;
      }

      setValue('name', nameInput.value.trim());
      setValue('phone', phone);
      setValue('email', emailInput.value.trim());
      showToast(text.saved);
      mountProfile(false);
    });

    languageButton.addEventListener('click', openLanguageSheet);
    helpButton.addEventListener('click', () => showToast('Help & Support — coming soon'));
    logoutButton.addEventListener('click', () => {
      const language = getLanguage();
      localStorage.removeItem(STORAGE.name);
      localStorage.removeItem(STORAGE.phone);
      localStorage.removeItem(STORAGE.email);
      showToast(copy[language].loggedOut);
      mountProfile(true);
    });
  }

  function ensureLanguageSheet() {
    if (languageSheet) return;
    languageSheet = document.createElement('section');
    languageSheet.className = 'profile-language-sheet';
    languageSheet.id = 'profileLanguageSheet';
    languageSheet.setAttribute('role', 'dialog');
    languageSheet.setAttribute('aria-modal', 'true');
    document.body.appendChild(languageSheet);

    languageSheet.addEventListener('click', (event) => {
      if (event.target === languageSheet) closeLanguageSheet();
    });
  }

  function renderLanguageSheet() {
    ensureLanguageSheet();
    const language = getLanguage();
    const text = copy[language];
    languageSheet.innerHTML = `
      <div class="profile-language-panel">
        <div class="profile-language-head">
          <h2>${text.chooseLanguage}</h2>
          <button class="profile-language-close" type="button" aria-label="Close language menu">×</button>
        </div>
        ${['English', 'Hindi'].map((option) => `
          <button class="profile-language-choice ${language === option ? 'active' : ''}" type="button" data-profile-language="${option}">
            <span>${option}</span><span class="profile-language-check">✓</span>
          </button>`).join('')}
      </div>`;

    languageSheet.querySelector('.profile-language-close').addEventListener('click', closeLanguageSheet);
    languageSheet.querySelectorAll('[data-profile-language]').forEach((button) => {
      button.addEventListener('click', () => {
        localStorage.setItem(STORAGE.language, button.dataset.profileLanguage);
        closeLanguageSheet();
        mountProfile(false);
      });
    });
  }

  function openLanguageSheet() {
    renderLanguageSheet();
    languageSheet.classList.add('show');
    document.body.classList.add('locked');
  }

  function closeLanguageSheet() {
    if (!languageSheet) return;
    languageSheet.classList.remove('show');
    document.body.classList.remove('locked');
  }

  function initialize() {
    main = document.getElementById('appMain');
    if (!main) {
      console.error('QK profile module could not find appMain.');
      return;
    }

    observer = new MutationObserver(() => {
      if (isProfileActive() && !main.querySelector('[data-profile-enhanced="true"]')) {
        window.queueMicrotask(() => mountProfile(false));
      }
    });
    observer.observe(main, { childList: true });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && languageSheet?.classList.contains('show')) closeLanguageSheet();
    });

    if (isProfileActive()) mountProfile(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
