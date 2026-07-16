'use strict';

(() => {
  const LANGUAGE_KEY = 'qkProfileLanguage';
  const TICKETS_KEY = 'qkSupportTickets';
  const CONFIG = Object.assign({
    phone: '',
    whatsapp: '',
    email: 'support@buyqk.com'
  }, window.QK_SUPPORT_CONFIG || {});

  const copy = {
    English: {
      title: 'Help & Support',
      contactTitle: 'Contact Support',
      call: 'Call Support',
      callSub: 'Speak with the QK support team',
      whatsapp: 'WhatsApp Support',
      whatsappSub: 'Chat with us on WhatsApp',
      email: 'Email Support',
      emailSub: 'Send your concern by email',
      formTitle: 'Raise a Support Ticket',
      issueType: 'Issue type',
      chooseIssue: 'Select an issue',
      orderIssue: 'Order issue',
      paymentIssue: 'Payment or refund',
      deliveryIssue: 'Delivery issue',
      productIssue: 'Product quality',
      accountIssue: 'Account or profile',
      otherIssue: 'Other',
      orderId: 'Order ID (optional)',
      orderPlaceholder: 'Example: QK10234',
      message: 'Tell us what happened',
      messagePlaceholder: 'Describe the issue clearly...',
      submit: 'Submit Ticket',
      ticketRequired: 'Select an issue and enter a description.',
      ticketSubmitted: 'Ticket submitted successfully.',
      ticketNumber: 'Your ticket ID is',
      faqTitle: 'FAQs',
      faq: [
        ['How do I cancel an order?', 'Open Orders, select the active order and use the cancel option. Cancellation may not be available after packing or dispatch starts.'],
        ['When will I receive my refund?', 'Refunds generally take 3–7 working days, depending on the payment method and bank processing time.'],
        ['Why is QK unavailable in my area?', 'QK currently serves selected areas. New dark stores and delivery zones will be added gradually.'],
        ['How do I report a damaged or wrong product?', 'Submit a support ticket with the order ID and describe the product issue. Keep the product and packaging until support responds.']
      ],
      safeNote: 'For medical emergencies, dangerous reactions or immediate safety concerns, contact a doctor or emergency service first. QK support should be used for order and service complaints.',
      notConfigured: 'This support channel is not configured yet.',
      close: 'Close support page'
    },
    Hindi: {
      title: 'सहायता और सपोर्ट',
      contactTitle: 'सपोर्ट से संपर्क करें',
      call: 'कॉल सपोर्ट',
      callSub: 'QK सपोर्ट टीम से बात करें',
      whatsapp: 'व्हाट्सऐप सपोर्ट',
      whatsappSub: 'व्हाट्सऐप पर हमसे चैट करें',
      email: 'ईमेल सपोर्ट',
      emailSub: 'अपनी समस्या ईमेल से भेजें',
      formTitle: 'सपोर्ट टिकट दर्ज करें',
      issueType: 'समस्या का प्रकार',
      chooseIssue: 'समस्या चुनें',
      orderIssue: 'ऑर्डर की समस्या',
      paymentIssue: 'पेमेंट या रिफंड',
      deliveryIssue: 'डिलीवरी की समस्या',
      productIssue: 'प्रोडक्ट क्वालिटी',
      accountIssue: 'अकाउंट या प्रोफाइल',
      otherIssue: 'अन्य',
      orderId: 'ऑर्डर आईडी (वैकल्पिक)',
      orderPlaceholder: 'उदाहरण: QK10234',
      message: 'हमें पूरी समस्या बताएं',
      messagePlaceholder: 'समस्या को स्पष्ट रूप से लिखें...',
      submit: 'टिकट सबमिट करें',
      ticketRequired: 'समस्या चुनें और उसका विवरण लिखें।',
      ticketSubmitted: 'टिकट सफलतापूर्वक सबमिट हो गया।',
      ticketNumber: 'आपका टिकट आईडी है',
      faqTitle: 'अक्सर पूछे जाने वाले सवाल',
      faq: [
        ['ऑर्डर कैसे कैंसल करें?', 'ऑर्डर पेज खोलें, सक्रिय ऑर्डर चुनें और कैंसल विकल्प का उपयोग करें। पैकिंग या डिस्पैच शुरू होने के बाद कैंसलेशन उपलब्ध नहीं हो सकता।'],
        ['रिफंड कब मिलेगा?', 'पेमेंट माध्यम और बैंक प्रोसेसिंग के अनुसार रिफंड में आमतौर पर 3–7 कार्य दिवस लगते हैं।'],
        ['मेरे क्षेत्र में QK उपलब्ध क्यों नहीं है?', 'QK अभी चुनिंदा क्षेत्रों में सेवा देता है। नए डार्क स्टोर और डिलीवरी ज़ोन धीरे-धीरे जोड़े जाएंगे।'],
        ['गलत या खराब प्रोडक्ट की शिकायत कैसे करें?', 'ऑर्डर आईडी के साथ सपोर्ट टिकट दर्ज करें और प्रोडक्ट की समस्या लिखें। सपोर्ट के जवाब तक प्रोडक्ट और पैकेजिंग संभालकर रखें।']
      ],
      safeNote: 'मेडिकल इमरजेंसी, खतरनाक रिएक्शन या तुरंत सुरक्षा संबंधी समस्या होने पर पहले डॉक्टर या इमरजेंसी सेवा से संपर्क करें। QK सपोर्ट का उपयोग ऑर्डर और सेवा संबंधी शिकायतों के लिए करें।',
      notConfigured: 'यह सपोर्ट चैनल अभी कॉन्फ़िगर नहीं किया गया है।',
      close: 'सपोर्ट पेज बंद करें'
    }
  };

  let page = null;

  function getLanguage() {
    return localStorage.getItem(LANGUAGE_KEY) === 'Hindi' ? 'Hindi' : 'English';
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function contactRow(action, icon, title, subtitle) {
    return `
      <button class="support-contact-row" type="button" data-support-action="${action}">
        <span class="support-contact-left">
          <span class="support-contact-icon">${icon}</span>
          <span class="support-contact-copy"><strong>${title}</strong><small>${subtitle}</small></span>
        </span>
        <span class="support-arrow">›</span>
      </button>`;
  }

  function supportMarkup(language) {
    const text = copy[language];
    const phoneIcon = '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0 1 22 16.9z"/></svg>';
    const whatsappIcon = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20l1.2-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M8.5 8.8c.3 2.5 2.2 4.4 4.7 4.9"/></svg>';
    const emailIcon = '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="m4 7 8 6 8-6"/></svg>';

    return `
      <div class="support-screen">
        <header class="support-topbar">
          <button class="support-back" id="supportBack" type="button" aria-label="${text.close}">
            <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 class="support-title">${text.title}</h1>
        </header>

        <main class="support-content">
          <section class="support-section">
            <h2 class="support-section-title">${text.contactTitle}</h2>
            <div class="support-card">
              ${contactRow('call', phoneIcon, text.call, text.callSub)}
              ${contactRow('whatsapp', whatsappIcon, text.whatsapp, text.whatsappSub)}
              ${contactRow('email', emailIcon, text.email, text.emailSub)}
            </div>
          </section>

          <section class="support-section">
            <h2 class="support-section-title">${text.formTitle}</h2>
            <form class="support-card support-form-card" id="supportTicketForm" novalidate>
              <div class="support-form-group">
                <label for="supportIssueType">${text.issueType}</label>
                <select id="supportIssueType" required>
                  <option value="">${text.chooseIssue}</option>
                  <option value="order">${text.orderIssue}</option>
                  <option value="payment">${text.paymentIssue}</option>
                  <option value="delivery">${text.deliveryIssue}</option>
                  <option value="product">${text.productIssue}</option>
                  <option value="account">${text.accountIssue}</option>
                  <option value="other">${text.otherIssue}</option>
                </select>
              </div>
              <div class="support-form-group">
                <label for="supportOrderId">${text.orderId}</label>
                <input id="supportOrderId" type="text" maxlength="30" placeholder="${text.orderPlaceholder}">
              </div>
              <div class="support-form-group">
                <label for="supportMessage">${text.message}</label>
                <textarea id="supportMessage" maxlength="800" placeholder="${text.messagePlaceholder}" required></textarea>
              </div>
              <button class="support-submit" type="submit">${text.submit}</button>
              <div class="support-ticket-success" id="supportTicketSuccess" role="status"></div>
            </form>
          </section>

          <section class="support-section">
            <h2 class="support-section-title">${text.faqTitle}</h2>
            <div class="support-card">
              ${text.faq.map(([question, answer]) => `
                <div class="support-faq-item">
                  <button class="support-faq-question" type="button">
                    <span>${question}</span><span class="support-faq-plus">+</span>
                  </button>
                  <p class="support-faq-answer">${answer}</p>
                </div>`).join('')}
            </div>
            <div class="support-safe-note">${text.safeNote}</div>
          </section>
        </main>
      </div>`;
  }

  function ensurePage() {
    if (page) return;
    page = document.createElement('section');
    page.id = 'supportPage';
    page.className = 'support-page';
    page.setAttribute('aria-hidden', 'true');
    document.body.appendChild(page);
  }

  function saveTicket(ticket) {
    let tickets = [];
    try {
      tickets = JSON.parse(localStorage.getItem(TICKETS_KEY) || '[]');
      if (!Array.isArray(tickets)) tickets = [];
    } catch (error) {
      tickets = [];
    }
    tickets.unshift(ticket);
    localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets.slice(0, 20)));
  }

  function bindPage(language) {
    const text = copy[language];
    const back = page.querySelector('#supportBack');
    const form = page.querySelector('#supportTicketForm');

    back.addEventListener('click', closeSupport);

    page.querySelectorAll('[data-support-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.supportAction;
        if (action === 'call') {
          if (!CONFIG.phone) return showToast(text.notConfigured);
          window.location.href = `tel:${CONFIG.phone}`;
        }
        if (action === 'whatsapp') {
          if (!CONFIG.whatsapp) return showToast(text.notConfigured);
          window.open(`https://wa.me/${String(CONFIG.whatsapp).replace(/\D/g, '')}`, '_blank', 'noopener,noreferrer');
        }
        if (action === 'email') {
          if (!CONFIG.email) return showToast(text.notConfigured);
          window.location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('QK Support Request')}`;
        }
      });
    });

    page.querySelectorAll('.support-faq-question').forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('.support-faq-item');
        const wasOpen = item.classList.contains('open');
        page.querySelectorAll('.support-faq-item.open').forEach((openItem) => openItem.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const issue = page.querySelector('#supportIssueType').value;
      const orderId = page.querySelector('#supportOrderId').value.trim();
      const message = page.querySelector('#supportMessage').value.trim();
      if (!issue || !message) {
        showToast(text.ticketRequired);
        return;
      }

      const id = `QK-${Date.now().toString(36).slice(-6).toUpperCase()}`;
      saveTicket({ id, issue, orderId, message, createdAt: new Date().toISOString(), status: 'open' });
      const success = page.querySelector('#supportTicketSuccess');
      success.textContent = `${text.ticketSubmitted} ${text.ticketNumber} ${id}.`;
      success.classList.add('show');
      form.reset();
      showToast(text.ticketSubmitted);
    });
  }

  function openSupport() {
    ensurePage();
    const language = getLanguage();
    page.innerHTML = supportMarkup(language);
    bindPage(language);
    page.classList.add('show');
    page.setAttribute('aria-hidden', 'false');
    document.body.classList.add('locked');
    page.querySelector('.support-screen').scrollTop = 0;
  }

  function closeSupport() {
    if (!page) return;
    page.classList.remove('show');
    page.setAttribute('aria-hidden', 'true');
    const anotherOverlay = document.querySelector('.sheet.show, .cart-overlay.open, .profile-language-sheet.show');
    if (!anotherOverlay) document.body.classList.remove('locked');
  }

  document.addEventListener('click', (event) => {
    const helpButton = event.target.closest('#profileHelpBtn');
    if (!helpButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openSupport();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && page?.classList.contains('show')) closeSupport();
  });

  window.QKSupport = Object.freeze({ open: openSupport, close: closeSupport });
})();
