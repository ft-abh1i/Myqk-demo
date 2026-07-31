import './ai-chat-enhancements.css';

const AI_CHAT_STORAGE_KEY = 'qkAiChatHistoryV1';
const MAX_STORED_MESSAGES = 60;
const historySnapshots = new WeakMap();

function cleanMessage(message) {
  const role = message?.role === 'user' ? 'user' : 'assistant';
  const content = String(message?.content || '').trim();
  if (!content || content === 'Thinking…') return null;
  return { role, content };
}

function uniqueConversation(messages) {
  const unique = [];
  messages.forEach((message) => {
    const cleaned = cleanMessage(message);
    if (!cleaned) return;
    const previous = unique[unique.length - 1];
    if (previous?.role === cleaned.role && previous.content === cleaned.content) return;
    unique.push(cleaned);
  });
  return unique.slice(-MAX_STORED_MESSAGES);
}

function readStoredHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_CHAT_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? uniqueConversation(parsed) : [];
  } catch {
    return [];
  }
}

function writeStoredHistory(messages) {
  try {
    localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(uniqueConversation(messages)));
  } catch {
    // Chat remains usable when browser storage is unavailable.
  }
}

function renderedMessages(container) {
  return [...container.querySelectorAll('.ai-message:not([data-qk-ai-saved-message])')]
    .map((bubble) => cleanMessage({
      role: bubble.classList.contains('user') ? 'user' : 'assistant',
      content: bubble.querySelector('.ai-message-copy')?.textContent || '',
    }))
    .filter(Boolean);
}

function ensureHistorySnapshot(container) {
  if (!historySnapshots.has(container)) {
    historySnapshots.set(container, readStoredHistory());
  }
  return historySnapshots.get(container) || [];
}

function persistRenderedHistory(container) {
  const savedBeforeThisChat = ensureHistorySnapshot(container);
  const currentChat = renderedMessages(container);
  if (!currentChat.length) return;
  writeStoredHistory([...savedBeforeThisChat, ...currentChat]);
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
  const snapshot = ensureHistorySnapshot(container);
  if (!snapshot.length || container.querySelector('[data-qk-ai-history]')) return;

  container.querySelector('.ai-welcome-card')?.remove();
  container.prepend(makeHistoryBlock(snapshot));
  container.scrollTop = container.scrollHeight;
}

let restoreQueued = false;
function syncAiHistory() {
  if (restoreQueued) return;
  restoreQueued = true;
  window.requestAnimationFrame(() => {
    restoreQueued = false;
    document.querySelectorAll('.ai-messages').forEach((container) => {
      persistRenderedHistory(container);
      restoreHistory(container);
    });
  });
}

const appRoot = document.getElementById('root');
if (appRoot) {
  new MutationObserver(syncAiHistory).observe(appRoot, { childList: true, subtree: true });
}
syncAiHistory();

// On mobile, blurring the textarea changes the keyboard layout before the normal
// click event reaches the Send button. Submit on pointer-down so one tap works.
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
