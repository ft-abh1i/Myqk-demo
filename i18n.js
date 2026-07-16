'use strict';

(() => {
  const LANGUAGE_KEY = 'qkProfileLanguage';
  const textOriginal = new WeakMap();
  const textLastApplied = new WeakMap();
  const attributeState = new WeakMap();
  let observer = null;
  let refreshQueued = false;

  const HI = Object.freeze({
    'Delivering to': 'यहाँ डिलीवरी',
    'Select your area': 'अपना क्षेत्र चुनें',
    'Search products or stores': 'प्रोडक्ट या स्टोर खोजें',
    'All Stores': 'सभी स्टोर',
    'Medical & Pharmacy': 'मेडिकल और फार्मेसी',
    'Grocery': 'किराना',
    'Vegetables': 'सब्ज़ियाँ',
    'Fruits': 'फल',
    'Snacks': 'स्नैक्स',
    'Dairy': 'डेयरी',
    'Beverages': 'पेय पदार्थ',
    'Stores near you': 'आपके पास के स्टोर',
    'No stores here yet': 'अभी यहाँ कोई स्टोर नहीं है',
    'We are adding more stores in this category.': 'हम इस श्रेणी में और स्टोर जोड़ रहे हैं।',
    'Fresh fruits, dairy and daily essentials': 'ताज़े फल, डेयरी और रोज़मर्रा का सामान',
    'Groceries, snacks and beverages': 'किराना, स्नैक्स और पेय पदार्थ',
    'Farm-fresh vegetables sourced daily': 'रोज़ आने वाली खेतों से ताज़ी सब्ज़ियाँ',
    'Apples': 'सेब',
    'Bananas': 'केले',
    'Milk': 'दूध',
    'Bread': 'ब्रेड',
    'Eggs': 'अंडे',
    'Basmati Rice': 'बासमती चावल',
    'Potato Chips': 'आलू चिप्स',
    'Cold Drink': 'कोल्ड ड्रिंक',
    'Cooking Oil': 'खाना पकाने का तेल',
    'Green Tea': 'ग्रीन टी',
    'Tomatoes': 'टमाटर',
    'Potato': 'आलू',
    'Onion': 'प्याज़',
    'Spinach': 'पालक',
    '1 kg': '1 किग्रा',
    '6 pcs': '6 पीस',
    '500 ml': '500 मि.ली.',
    '400 g': '400 ग्राम',
    '52 g': '52 ग्राम',
    '750 ml': '750 मि.ली.',
    '1 L': '1 लीटर',
    '25 bags': '25 बैग',
    '250 g': '250 ग्राम',
    'Dark Store': 'डार्क स्टोर',
    'Orders': 'ऑर्डर',
    'Track': 'ट्रैक',
    'Profile': 'प्रोफाइल',
    'Add': 'जोड़ें',
    'Buy Now': 'अभी खरीदें',
    'Stores': 'स्टोर',
    'Products': 'प्रोडक्ट',
    'Try a different product or store name.': 'किसी दूसरे प्रोडक्ट या स्टोर का नाम खोजें।',
    'Your Cart': 'आपकी कार्ट',
    'Total': 'कुल',
    'Proceed to Buy': 'खरीदारी जारी रखें',
    'Your cart is empty': 'आपकी कार्ट खाली है',
    'Add products from a store to see them here.': 'स्टोर से प्रोडक्ट जोड़ें, वे यहाँ दिखाई देंगे।',
    'No orders yet': 'अभी कोई ऑर्डर नहीं है',
    'Your order history will appear here after checkout.': 'चेकआउट के बाद आपके ऑर्डर यहाँ दिखाई देंगे।',
    'Nothing to track': 'अभी ट्रैक करने के लिए कुछ नहीं है',
    'Live order tracking will appear after you place an order.': 'ऑर्डर करने के बाद लाइव ट्रैकिंग यहाँ दिखाई देगी।',
    'Guest User': 'अतिथि उपयोगकर्ता',
    'Sign in to sync your account': 'अपना अकाउंट सिंक करने के लिए साइन इन करें',
    'Edit': 'बदलें',
    'My Orders': 'मेरे ऑर्डर',
    'Saved Addresses': 'सेव किए गए पते',
    'Payment Methods': 'भुगतान के तरीके',
    'Notifications': 'सूचनाएँ',
    'Help & Support': 'सहायता और सपोर्ट',
    'Log Out': 'लॉग आउट',
    'Coming soon': 'जल्द आ रहा है',
    'Select location': 'स्थान चुनें',
    'Give location access': 'लोकेशन की अनुमति दें',
    'DETECTED LOCATION': 'मिला हुआ स्थान',
    'Add exact address': 'पूरा पता जोड़ें',
    'House / Flat / Floor': 'मकान / फ्लैट / मंज़िल',
    'Street / Area / Landmark': 'गली / क्षेत्र / लैंडमार्क',
    'Save address': 'पता सेव करें',
    'Tap Give location access to detect your area.': 'अपना क्षेत्र पता करने के लिए लोकेशन की अनुमति दें।',
    'Location detected. Add house/flat/floor and street/area.': 'स्थान मिल गया। मकान/फ्लैट/मंज़िल और गली/क्षेत्र जोड़ें।',
    'Location is not supported on this device.': 'इस डिवाइस पर लोकेशन उपलब्ध नहीं है।',
    'Detecting your location...': 'आपकी लोकेशन पता की जा रही है...',
    'Detecting…': 'पता किया जा रहा है…',
    'Could not process your location. Please try again.': 'आपकी लोकेशन प्रोसेस नहीं हो सकी। फिर से कोशिश करें।',
    'Location permission is required. Allow access and try again.': 'लोकेशन अनुमति आवश्यक है। अनुमति देकर फिर कोशिश करें।',
    'Please add house/flat or street/area.': 'कृपया मकान/फ्लैट या गली/क्षेत्र जोड़ें।',
    'Exact address saved.': 'पूरा पता सेव हो गया।',
    'Order placed! Demo checkout complete.': 'ऑर्डर हो गया! डेमो चेकआउट पूरा हुआ।',
    'Back to stores': 'स्टोर पर वापस जाएँ',
    'Decrease quantity': 'मात्रा घटाएँ',
    'Increase quantity': 'मात्रा बढ़ाएँ',
    'Open cart': 'कार्ट खोलें',
    'Close cart': 'कार्ट बंद करें',
    'Select delivery location': 'डिलीवरी स्थान चुनें',
    'Clear search': 'खोज साफ़ करें',
    'Primary navigation': 'मुख्य नेविगेशन',
    'Store categories': 'स्टोर श्रेणियाँ',
    'Language': 'भाषा',
    'English': 'English',
    'Hindi': 'हिंदी',
    'Choose your language': 'अपनी भाषा चुनें',
    'Close language menu': 'भाषा मेनू बंद करें',
    'Personal Details': 'व्यक्तिगत जानकारी',
    'Full Name': 'पूरा नाम',
    'Enter your name': 'अपना नाम डालें',
    'Phone Number': 'फोन नंबर',
    'Add phone number': 'फोन नंबर जोड़ें',
    'Email': 'ईमेल',
    'Add email address': 'ईमेल एड्रेस जोड़ें',
    'Save Details': 'जानकारी सेव करें',
    'Edit Details': 'जानकारी बदलें',
    'Logout': 'लॉगआउट',
    'Report an issue or contact QK support': 'समस्या रिपोर्ट करें या QK सपोर्ट से संपर्क करें',
    'Back to Dark Store': 'डार्क स्टोर पर वापस जाएँ'
  });

  const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'aria-label', 'title'];

  function language() {
    return localStorage.getItem(LANGUAGE_KEY) === 'Hindi' ? 'Hindi' : 'English';
  }

  function translateCore(value) {
    if (language() !== 'Hindi' || !value) return value;
    if (HI[value]) return HI[value];

    let match = value.match(/^(\d+)\s+mins(?:\s*·\s*(.*))?$/);
    if (match) return `${match[1]} मिनट${match[2] ? ` · ${match[2]}` : ''}`;

    match = value.match(/^Added\s+(\d+)\s+×\s+(.+)$/);
    if (match) return `${match[1]} × ${HI[match[2]] || match[2]} कार्ट में जोड़ा गया`;

    match = value.match(/^No results for “(.+)”$/);
    if (match) return `“${match[1]}” के लिए कोई परिणाम नहीं मिला`;

    return value;
  }

  function translatePreservingWhitespace(value) {
    const leading = value.match(/^\s*/)?.[0] || '';
    const trailing = value.match(/\s*$/)?.[0] || '';
    const core = value.trim();
    return core ? `${leading}${translateCore(core)}${trailing}` : value;
  }

  function shouldSkipText(node) {
    const parent = node.parentElement;
    return !parent || Boolean(parent.closest('script, style, noscript, svg'));
  }

  function translateTextNode(node) {
    if (shouldSkipText(node)) return;

    const current = node.nodeValue || '';
    const lastApplied = textLastApplied.get(node);
    if (!textOriginal.has(node) || current !== lastApplied) textOriginal.set(node, current);

    const original = textOriginal.get(node) || '';
    const next = language() === 'Hindi' ? translatePreservingWhitespace(original) : original;
    if (current !== next) node.nodeValue = next;
    textLastApplied.set(node, next);
  }

  function getAttributeRecord(element) {
    if (!attributeState.has(element)) attributeState.set(element, new Map());
    return attributeState.get(element);
  }

  function translateAttributes(element) {
    if (!(element instanceof Element) || element.closest('svg')) return;
    const record = getAttributeRecord(element);

    TRANSLATABLE_ATTRIBUTES.forEach((name) => {
      if (!element.hasAttribute(name)) return;
      const current = element.getAttribute(name) || '';
      const state = record.get(name);
      if (!state || current !== state.lastApplied) record.set(name, { original: current, lastApplied: current });

      const latest = record.get(name);
      const next = language() === 'Hindi' ? translateCore(latest.original) : latest.original;
      if (current !== next) element.setAttribute(name, next);
      latest.lastApplied = next;
    });
  }

  function applyTo(root = document.body) {
    if (!root) return;
    document.documentElement.lang = language() === 'Hindi' ? 'hi' : 'en';

    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);

    const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = textWalker.nextNode();
    while (textNode) {
      translateTextNode(textNode);
      textNode = textWalker.nextNode();
    }

    if (root.querySelectorAll) root.querySelectorAll('[placeholder], [aria-label], [title]').forEach(translateAttributes);
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.queueMicrotask(() => {
      refreshQueued = false;
      applyTo(document.body);
    });
  }

  function initialize() {
    applyTo(document.body);

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') translateTextNode(mutation.target);
        if (mutation.type === 'attributes') translateAttributes(mutation.target);
        mutation.addedNodes?.forEach((node) => applyTo(node));
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-profile-language]')) return;
      window.setTimeout(() => {
        queueRefresh();
        window.dispatchEvent(new CustomEvent('qk:languagechange', { detail: { language: language() } }));
      }, 0);
    }, true);

    window.addEventListener('storage', (event) => {
      if (event.key === LANGUAGE_KEY) queueRefresh();
    });

    window.addEventListener('qk:languagechange', queueRefresh);
  }

  window.QKI18n = Object.freeze({ refresh: queueRefresh, getLanguage: language });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
