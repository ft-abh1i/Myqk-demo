import './ai-chat-enhancements.css';

const AI_CHAT_STORAGE_KEY = 'qkAiChatHistoryV1';
const MAX_STORED_MESSAGES = 60;
const historySnapshots = new WeakMap();

function cleanMessage(message) {
  const role = message?.role === 'user' ? 'user' : 'assistant';
  const content = String(message?.content || '').trim();
  if (!content || content === 'Thinking…') return null;
  return {
    role,
    content,
    at: Number(message?.at || Date.now()),
  };
}

function readStoredHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_CHAT_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(cleanMessage).filter(Boolean).slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

function writeStoredHistory(messages) {
  try {
    localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // Chat should continue to work even if browser storage is unavailable.
  }
}

function appendStoredMessage(role, content) {
  const nextMessage = cleanMessage({ role, content, at: Date.now() });
  if (!nextMessage) return;

  const history = readStoredHistory();
  const previous = history[history.length - 1];
  const isAccidentalDuplicate = previous
    && previous.role === nextMessage.role
    && previous.content === nextMessage.content
    && nextMessage.at - previous.at < 2000;

  if (!isAccidentalDuplicate) history.push(nextMessage);
  writeStoredHistory(history);
}

function uniqueConversation(messages) {
  const unique = [];
  messages.forEach((message) => {
    const cleaned = cleanMessage(message);
    if (!cleaned) return;
    const previous = unique[unique.length - 1];
    if (previous?.role === cleaned.role && previous.content === cleaned.content) return;
    unique.push({ role: cleaned.role, content: cleaned.content });
  });
  return unique;
}

function makeHistoryBlock(messages) {
  const block = document.createElement('div');
  block.className = 'ai-history-block';
  block.dataset.qkAiHistory = 'true';

  messages.forEach((message) => {
    const bubble = document.createElement('div');
    bubble.className = `ai-message ${message.role}`;
    bubble.dataset.qkAiSavedMessage = 'true';

    const copy = document.createElement('div');
    copy.className = 'ai-message-copy';
    copy.textContent = message.content;

    bubble.appendChild(copy);
    block.appendChild(bubble);
  });

  return block;
}

function restoreHistory(container) {
  if (!(container instanceof HTMLElement)) return;

  if (!historySnapshots.has(container)) {
    historySnapshots.set(container, readStoredHistory());
  }

  const snapshot = historySnapshots.get(container) || [];
  if (!snapshot.length || container.querySelector('[data-qk-ai-history]')) return;

  container.querySelector('.ai-welcome-card')?.remove();
  container.prepend(makeHistoryBlock(snapshot));
  container.scrollTop = container.scrollHeight;
}

let restoreQueued = false;
function queueHistoryRestore() {
  if (restoreQueued) return;
  restoreQueued = true;
  window.requestAnimationFrame(() => {
    restoreQueued = false;
    document.querySelectorAll('.ai-messages').forEach(restoreHistory);
  });
}

const pageObserver = new MutationObserver(queueHistoryRestore);
pageObserver.observe(document.documentElement, { childList: true, subtree: true });
queueHistoryRestore();

const originalFetch = window.fetch.bind(window);
window.fetch = async function qkFetch(resource, options = {}) {
  const url = typeof resource === 'string' ? resource : String(resource?.url || '');
  const isAiRequest = url.includes('/api/buyqk-ai') && String(options?.method || 'GET').toUpperCase() === 'POST';
  if (!isAiRequest) return originalFetch(resource, options);

  let payload = null;
  try {
    payload = JSON.parse(String(options?.body || '{}'));
  } catch {
    return originalFetch(resource, options);
  }

  const currentMessage = String(payload?.message || '').trim();
  if (currentMessage) appendStoredMessage('user', currentMessage);

  const storedHistory = readStoredHistory().filter((message) => !(message.role === 'user' && message.content === currentMessage));
  const suppliedHistory = Array.isArray(payload?.history) ? payload.history : [];
  const mergedHistory = uniqueConversation([...storedHistory, ...suppliedHistory]).slice(-8);
  const requestOptions = {
    ...options,
    body: JSON.stringify({ ...payload, history: mergedHistory }),
  };

  try {
    const response = await originalFetch(resource, requestOptions);
    response.clone().json().then((data) => {
      if (response.ok && data?.reply) {
        appendStoredMessage('assistant', data.reply);
      } else {
        appendStoredMessage('assistant', 'BuyQK AI is temporarily unavailable. Please try again.');
      }
    }).catch(() => {
      if (!response.ok) appendStoredMessage('assistant', 'BuyQK AI is temporarily unavailable. Please try again.');
    });
    return response;
  } catch (error) {
    appendStoredMessage('assistant', 'BuyQK AI is temporarily unavailable. Please try again.');
    throw error;
  }
};

// On mobile, blurring the textarea changes the keyboard layout before the normal
// click event reaches the Send button. Submit on pointer-down so one tap always works.
document.addEventListener('pointerdown', (event) => {
  const sendButton = event.target instanceof Element ? event.target.closest('#aiSend') : null;
  if (!sendButton || sendButton.disabled) return;
  event.preventDefault();
  event.stopPropagation();
  sendButton.form?.requestSubmit(sendButton);
}, true);

document.addEventListener('click', (event) => {
  const sendButton = event.target instanceof Element ? event.target.closest('#aiSend') : null;
  if (!sendButton) return;
  event.preventDefault();
  event.stopPropagation();
}, true);
