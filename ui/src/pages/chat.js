import { icons } from '../icons.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { wsManager } from '../websocket.js';
import { showToast } from '../main.js';
import { renderFriendsPanel } from './friendsPanel.js';
import { renderNewGroupModal } from './newGroupModal.js';
import { startCallFlow } from './videoCall.js';

// ===========================
// EMOJI DATA
// ===========================
const EMOJI_DATA = {
  'Hay dùng': ['😀','😂','🤣','😍','🥰','😘','😎','🤩','😭','😤','🥺','😱','🤔','👍','👎','❤️','🔥','💯','🎉','👏','🙏','💪','✨','😈'],
  'Mặt cười': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  'Tay & Cử chỉ': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💪'],
  'Trái tim': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝'],
  'Động vật': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦅','🦆','🦉','🦇','🐺','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜'],
  'Đồ ăn': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🌽','🌶️','🫑','🥒','🧄','🧅','🥔','🍠','🍕','🍔','🍟','🌭','🍿','🧂','🥚','🍳','🥞','🧇','🥓','🍖','🍗','🥩','🍱','🍣','🍜','🍝','🍛','🍲'],
};

const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','😡'];

// ===========================
// SOUND EFFECTS
// ===========================
class SoundManager {
  constructor() {
    this.enabled = true;
    this.audioCtx = null;
  }

  getContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioCtx;
  }

  playMessageTing() {
    if (!this.enabled || document.hasFocus()) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch(e) { /* Ignore audio errors */ }
  }

  playSendSound() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch(e) { /* Ignore */ }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

const soundManager = new SoundManager();

// ===========================
// LOCAL REACTIONS STORE
// ===========================
const messageReactions = {}; // messageId -> { emoji: count, users: [] }

function addReaction(messageId, emoji) {
  if (!messageReactions[messageId]) {
    messageReactions[messageId] = {};
  }
  if (!messageReactions[messageId][emoji]) {
    messageReactions[messageId][emoji] = 1;
  } else {
    messageReactions[messageId][emoji]++;
  }
  renderMessagesList();
}


// ===========================
// MAIN RENDER
// ===========================
export function renderChatPage() {
  const app = document.getElementById('app');
  const user = store.get('user');

  app.innerHTML = `
    <div class="chat-page chat-open" id="chat-page-root">
      
      <!-- SIDEBAR -->
      <aside class="sidebar" id="sidebar">
        <!-- Header -->
        <header class="sidebar-header">
          <div class="sidebar-user" id="user-profile-btn">
            <div class="avatar">
              ${user?.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}" />` : user?.username?.[0] || 'U'}
              <div class="avatar-status online"></div>
            </div>
            <div class="sidebar-user-name">${user?.username || 'User'}</div>
          </div>
          <div class="sidebar-actions">
            <button class="sidebar-action-btn" title="Tạo nhóm mới" id="btn-new-group">
              ${icons.userPlus}
            </button>
            <button class="sidebar-action-btn" title="Cài đặt" id="btn-settings">
              ${icons.settings}
            </button>
          </div>
        </header>

        <!-- Search -->
        <div class="sidebar-search">
          <div class="search-wrapper">
            <span class="search-icon">${icons.search}</span>
            <input type="text" class="search-input" id="search-input" placeholder="Tìm kiếm bạn bè, tin nhắn..." />
          </div>
        </div>

        <!-- Tabs -->
        <nav class="sidebar-nav">
          <button class="sidebar-nav-tab active" data-tab="chats">
            Trò chuyện
          </button>
          <button class="sidebar-nav-tab" data-tab="friends">
            Bạn bè
            <span class="badge" id="friend-requests-badge" style="display:none">0</span>
          </button>
        </nav>

        <!-- Content Area -->
        <main class="sidebar-content" id="sidebar-content">
          <!-- Populated by JS -->
        </main>
      </aside>

      <!-- CHAT PANEL -->
      <main class="chat-panel" id="chat-panel">
        <!-- Rendered when conversation is selected -->
        ${renderWelcomeScreen()}
      </main>

      <!-- INFO PANEL (right sidebar) -->
      <aside class="chat-info-panel" id="chat-info-panel">
        <!-- Rendered when info button is clicked -->
      </aside>

    </div>
  `;

  initSidebarEvents();
  loadConversations();
  setupWebSocket();

  // Bind New Group Button
  const btnNewGroup = document.getElementById('btn-new-group');
  if (btnNewGroup) {
    btnNewGroup.addEventListener('click', renderNewGroupModal);
  }

  // Bind Settings Button (Logout Dropdown)
  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', (e) => {
      let dropdown = document.getElementById('settings-dropdown');
      if (dropdown) {
        dropdown.remove();
        return;
      }
      
      dropdown = document.createElement('div');
      dropdown.id = 'settings-dropdown';
      dropdown.className = 'user-dropdown';
      // Position it below the settings button
      const rect = btnSettings.getBoundingClientRect();
      dropdown.style.bottom = 'auto';
      dropdown.style.top = (rect.bottom + 8) + 'px';
      dropdown.style.left = (rect.left) + 'px';
      
      dropdown.innerHTML = `
        <button class="user-dropdown-item" id="btn-toggle-sound">
          ${soundManager.enabled ? icons.volume : icons.volumeOff} ${soundManager.enabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
        </button>
        <div class="user-dropdown-divider"></div>
        <button class="user-dropdown-item danger" id="btn-logout">
          ${icons.logout} Đăng xuất
        </button>
      `;
      
      document.body.appendChild(dropdown);
      
      // Handle clicks outside
      const closeDropdown = (evt) => {
        if (!dropdown.contains(evt.target) && evt.target !== btnSettings && !btnSettings.contains(evt.target)) {
          dropdown.remove();
          document.removeEventListener('click', closeDropdown);
        }
      };
      setTimeout(() => document.addEventListener('click', closeDropdown), 10);
      
      // Handle sound toggle
      document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
        const isOn = soundManager.toggle();
        showToast(isOn ? 'Đã bật âm thanh thông báo' : 'Đã tắt âm thanh thông báo', 'info');
        dropdown.remove();
      });

      // Handle logout click
      document.getElementById('btn-logout').addEventListener('click', () => {
         store.reset();
         wsManager.disconnect();
         window.location.reload();
      });
    });
  }

  // Handle cross-component events
  window.addEventListener('open-chat', (e) => {
    openConversation(e.detail);
  });

  // Close context menu on click anywhere
  document.addEventListener('click', closeContextMenu);
}

// ===========================
// WEBSOCKET INTEGRATION
// ===========================
function setupWebSocket() {
  const token = store.get('token');
  if(!token) return;

  // Connect to WS
  wsManager.connect(token);

  wsManager.on('connected', () => {
    store.set('wsConnected', true);
  });

  wsManager.on('disconnected', () => {
    store.set('wsConnected', false);
  });

  // Handle incoming messages
  wsManager.on('message', (msg) => {
    const myId = store.get('user')?.id;
    
    // If this is my own message echoed back, replace the temp message
    if (msg.sender_id === myId) {
      // Find and replace the temp message with the real one from server
      const convMsgs = store.get('messages')[msg.conversation_id] || [];
      const tempIdx = convMsgs.findIndex(m => m.id?.startsWith('temp-') && m.content === msg.content);
      if (tempIdx !== -1) {
        convMsgs[tempIdx] = msg;
        store.notify('messages', store.get('messages'));
        if (store.get('activeConversationId') === msg.conversation_id) {
          renderMessagesList();
        }
        return; // Don't add duplicate
      }
    }
    
    store.addMessage(msg.conversation_id, msg);
    
    // Play sound for new messages from others
    if (msg.sender_id !== myId) {
      soundManager.playMessageTing();
    }
    
    // If it's the active conversation, scroll to bottom
    if(store.get('activeConversationId') === msg.conversation_id) {
      renderMessagesList();
      if(msg.sender_id !== myId) {
        wsManager.sendRead(msg.conversation_id, msg.id);
      }
    } else {
      // It's a background message, re-render sidebar to update text/bolding
      renderSidebarConversations();
    }
  });

  wsManager.on('typing', (data) => {
    store.setTyping(data.conversation_id, data.user_id, data.username);
    if(store.get('activeConversationId') === data.conversation_id) {
       renderTypingIndicator();
    }
  });

  // Handle incoming video call notification
  wsManager.on('incoming_call', (data) => {
    showIncomingCallNotification(data);
  });
}


// ===========================
// SIDEBAR LOGIC
// ===========================
function initSidebarEvents() {
  const tabs = document.querySelectorAll('.sidebar-nav-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      // Remove active from all
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      
      const tabName = e.target.dataset.tab;
      store.set('sidebarTab', tabName);
      
      if(tabName === 'chats') {
        renderSidebarConversations();
      } else {
        renderFriendsPanel();
      }
    });
  });

  // Listen to state changes
  store.subscribe('conversations', renderSidebarConversations);
}

async function loadConversations() {
  // Show skeleton loading first
  renderSkeletonSidebar();

  try {
    // Load conversations AND friends in parallel
    // We need friends to display names for direct chats
    const [convData, friendsData] = await Promise.all([
      api.getConversations(),
      api.getFriends().catch(() => null),
    ]);
    
    if (friendsData?.friends) {
      store.set('friends', friendsData.friends);
    }
    
    if (convData?.conversations) {
      store.set('conversations', convData.conversations);
    }
  } catch (error) {
    console.error("Failed to load conversations", error);
  }
}

function renderSkeletonSidebar() {
  const content = document.getElementById('sidebar-content');
  if (!content) return;
  
  const skeletons = Array.from({length: 6}, () => `
    <div class="skeleton-conversation">
      <div class="skeleton skeleton-avatar"></div>
      <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
        <div class="skeleton skeleton-text" style="width:60%"></div>
        <div class="skeleton skeleton-text short" style="width:40%"></div>
      </div>
    </div>
  `).join('');
  
  content.innerHTML = `<div class="conversation-list">${skeletons}</div>`;
}

function renderSkeletonMessages() {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;
  
  const skeletons = [
    { side: 'left', w: '180px' },
    { side: 'right', w: '220px' },
    { side: 'left', w: '260px' },
    { side: 'right', w: '150px' },
    { side: 'left', w: '200px' },
    { side: 'right', w: '240px' },
  ].map(s => `
    <div class="skeleton-message ${s.side}">
      ${s.side === 'left' ? '<div class="skeleton skeleton-avatar" style="width:28px;height:28px"></div>' : ''}
      <div class="skeleton skeleton-bubble" style="width:${s.w}"></div>
    </div>
  `).join('');
  
  container.innerHTML = skeletons;
}

// Helper: get a nice display name for conversations
function getConversationDisplayName(conv) {
  if (conv.name) return conv.name;
  
  // For direct chats without name, try to derive from participants
  const myId = store.get('user')?.id;
  if (conv.type === 'direct' && Array.isArray(conv.participants)) {
    // Participants are strings (user IDs)
    const otherId = conv.participants.find(p => p !== myId);
    if (otherId) {
      // Check if we have this friend's info
      const friends = store.get('friends') || [];
      const friend = friends.find(f => f.user_id === otherId);
      if (friend) return friend.username;
      return 'Chat';
    }
  }
  return 'Group Chat';
}

function renderSidebarConversations() {
  if (store.get('sidebarTab') !== 'chats') return;

  const content = document.getElementById('sidebar-content');
  const convs = store.get('conversations') || [];

  if (convs.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icons.messageCircle}</div>
        <p>Bạn chưa có cuộc trò chuyện nào.</p>
      </div>
    `;
    return;
  }

  const activeId = store.get('activeConversationId');

  const html = `
    <div class="conversation-list">
      ${convs.map(c => {
        const displayName = getConversationDisplayName(c);
        return `
        <div class="conversation-item ${activeId === c.id ? 'active' : ''}" data-id="${c.id}">
          <div class="avatar">
            ${displayName[0]?.toUpperCase() || 'G'}
            <div class="avatar-status online"></div>
          </div>
          <div class="conversation-info">
            <div class="conversation-name">${displayName}</div>
            <div class="conversation-preview">${c.last_message?.content || 'Chưa có tin nhắn'}</div>
          </div>
          <div class="conversation-meta">
            <div class="conversation-time">${formatTime(c.last_message?.created_at || c.created_at)}</div>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  `;

  content.innerHTML = html;

  content.querySelectorAll('.conversation-item').forEach(item => {
    item.addEventListener('click', () => {
      openConversation(item.dataset.id);
    });
  });
}


// ===========================
// CHAT PANEL LOGIC
// ===========================
function renderWelcomeScreen() {
  return `
    <div class="chat-welcome">
      <div class="chat-welcome-icon">
        ${icons.chat}
      </div>
      <h2>Chào mừng đến với Zalo Clone</h2>
      <p>Bắt đầu trò chuyện bằng cách chọn một liên hệ hoặc tạo nhóm chat mới.</p>
    </div>
  `;
}

async function openConversation(id) {
  store.set('activeConversationId', id);
  
  // Re-render sidebar to update active state
  renderSidebarConversations();
  
  // Update chat-page classes for mobile responsiveness
  document.getElementById('chat-page-root').classList.add('chat-open');

  const conv = store.getActiveConversation();
  const panel = document.getElementById('chat-panel');

  if (!conv) {
     panel.innerHTML = renderWelcomeScreen();
     return;
  }

  // Set loading UI with skeleton
  panel.innerHTML = `
    <header class="chat-header">
      <div class="chat-header-info">
        <button class="chat-header-btn mobile-only" id="btn-back-sidebar" style="margin-right:8px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg></button>
        <div class="avatar">${conv.name ? conv.name[0].toUpperCase() : 'G'}</div>
        <div>
          <div class="chat-header-name">${conv.name || 'Group'}</div>
          <div class="chat-header-status">Đang tải...</div>
        </div>
      </div>
    </header>
    <div class="chat-messages" id="chat-messages-container" style="align-items:stretch">
    </div>
    <div class="chat-input-area"></div>
  `;

  renderSkeletonMessages();

  // Attach back button
  document.getElementById('btn-back-sidebar')?.addEventListener('click', () => {
    document.getElementById('chat-page-root').classList.remove('chat-open');
    store.set('activeConversationId', null);
    renderSidebarConversations();
    document.getElementById('chat-panel').innerHTML = renderWelcomeScreen();
  });


  // Fetch Messages
  try {
     const res = await api.getMessages(id, 50, 0);
     const msgs = (res.messages || []).reverse(); // Oldest first
     
     // Put in store manually without array spread to set initial state
     store.update('messages', m => ({...m, [id]: msgs}));

  } catch(e) {
    console.error('Failed to load messages', e);
  }

  renderActiveChat();
}

let typingTimeout = null;
let emojiPickerOpen = false;

function renderActiveChat() {
  const panel = document.getElementById('chat-panel');
  const conv = store.getActiveConversation();
  if(!conv) return;

  const convDisplayName = getConversationDisplayName(conv);

  panel.innerHTML = `
    <!-- HEADER -->
    <header class="chat-header">
      <div class="chat-header-info">
        <button class="chat-header-btn mobile-only" id="btn-back-sidebar" style="margin-right:8px; display: none;">${icons.arrowLeft}</button>
        <div class="avatar">
          ${convDisplayName[0]?.toUpperCase() || 'G'}
           <div class="avatar-status online"></div>
        </div>
        <div>
          <div class="chat-header-name">${convDisplayName}</div>
          <div class="chat-header-status online">Hoạt động</div>
        </div>
      </div>
      <div class="chat-header-actions">
        <button class="chat-header-btn" title="Gọi video" id="btn-video-call">${icons.video}</button>
        <button class="chat-header-btn" title="Thông tin hội thoại" id="btn-toggle-info">${icons.panelRight}</button>
      </div>
    </header>

    <!-- MESSAGES (with drag & drop) -->
    <div class="chat-messages" id="chat-messages-container">
      <!-- Generated by renderMessagesList() -->
    </div>

    <!-- TYPING INDICATOR -->
    <div id="typing-container"></div>

    <!-- INPUT -->
    <div class="chat-input-area" style="position:relative;">
      <!-- Emoji Picker will be injected here -->
      <div id="emoji-picker-container"></div>
      <form class="chat-input-wrapper" id="chat-form">
        <div class="chat-input-actions">
          <button type="button" class="chat-input-btn" id="btn-emoji-picker" title="Chọn emoji">${icons.smile}</button>
          <button type="button" class="chat-input-btn" id="btn-attach-file" title="Đính kèm file">${icons.paperclip}</button>
          <button type="button" class="chat-input-btn" title="Gửi ảnh">${icons.image}</button>
        </div>
        
        <textarea class="chat-text-input" id="chat-input-field" placeholder="Nhập tin nhắn..." rows="1"></textarea>
        
        <button type="submit" class="chat-send-btn" id="chat-send-btn" disabled>
          ${icons.send}
        </button>
      </form>
    </div>
  `;

  // Fix mobile display of back button
  const backBtn = document.getElementById('btn-back-sidebar');
  if (window.innerWidth <= 768 && backBtn) {
     backBtn.style.display = 'flex';
  }

  backBtn?.addEventListener('click', () => {
    document.getElementById('chat-page-root').classList.remove('chat-open');
    store.set('activeConversationId', null);
    renderSidebarConversations();
    document.getElementById('chat-panel').innerHTML = renderWelcomeScreen();
  });

  renderMessagesList();
  renderTypingIndicator();

  // ---- Video call ----
  const btnVideoCall = document.getElementById('btn-video-call');
  if (btnVideoCall) {
    btnVideoCall.addEventListener('click', () => {
      const myId = store.get('user').id;
      // conv.participants is string[] (user IDs), not objects
      const participants = conv.participants || [];
      const otherParticipantId = participants.find(p => p !== myId);
      if(otherParticipantId) {
        startCallFlow(otherParticipantId);
      } else {
        showToast('Không thể gọi video cho nhóm hoặc cuộc trò chuyện này.', 'error');
      }
    });
  }

  // ---- Info Panel Toggle ----
  const btnToggleInfo = document.getElementById('btn-toggle-info');
  if (btnToggleInfo) {
    btnToggleInfo.addEventListener('click', () => {
      const root = document.getElementById('chat-page-root');
      if (root.classList.contains('info-open')) {
        root.classList.remove('info-open');
      } else {
        root.classList.add('info-open');
        renderInfoPanel(conv);
      }
    });
  }

  // ---- Emoji Picker ----
  const btnEmoji = document.getElementById('btn-emoji-picker');
  if (btnEmoji) {
    btnEmoji.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleEmojiPicker();
    });
  }

  // ---- Drag & Drop ----
  setupDragAndDrop();

  // ---- Input Events ----
  const inputEl = document.getElementById('chat-input-field');
  const sendBtn = document.getElementById('chat-send-btn');
  const form = document.getElementById('chat-form');

  inputEl.addEventListener('input', () => {
    // Auto resize
    inputEl.style.height = 'auto';
    inputEl.style.height = (inputEl.scrollHeight) + 'px';
    
    sendBtn.disabled = inputEl.value.trim().length === 0;

    // Send typing event (throttle it)
    if(!typingTimeout) {
      wsManager.sendTyping(conv.id);
      typingTimeout = setTimeout(() => { typingTimeout = null }, 2000);
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if(!sendBtn.disabled) form.dispatchEvent(new Event('submit'));
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = inputEl.value.trim();
    if(!content) return;

    wsManager.sendMessage(conv.id, content);
    soundManager.playSendSound();
    
    // Optimistic UI
    const tempMsg = {
       id: 'temp-' + Date.now(),
       conversation_id: conv.id,
       sender_id: store.get('user').id,
       content: content,
       type: 'text',
       created_at: new Date().toISOString(),
       _status: 'sending',
    };
    store.addMessage(conv.id, tempMsg);
    
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;
    renderMessagesList();

    // Simulate status change to "sent" after a short delay
    setTimeout(() => {
      const msgs = store.get('messages')[conv.id] || [];
      const idx = msgs.findIndex(m => m.id === tempMsg.id);
      if (idx !== -1) {
        msgs[idx]._status = 'sent';
        store.notify('messages', store.get('messages'));
      }
    }, 800);
  });

  store.subscribe('messages', () => {
    renderMessagesList();
  });

  store.subscribe('typingUsers', () => {
    renderTypingIndicator();
  });
}

// ===========================
// MESSAGES LIST
// ===========================
function renderMessagesList() {
  const container = document.getElementById('chat-messages-container');
  if(!container) return;

  const msgs = store.getActiveMessages();
  const userId = store.get('user').id;

  if (msgs.length === 0) {
     container.innerHTML = `<div class="empty-state"><p>Chưa có tin nhắn nào</p></div>`;
     return;
  }

  const html = msgs.map((m, idx) => {
    const isMine = m.sender_id === userId;
    const reactions = messageReactions[m.id] || {};
    const reactionChips = Object.entries(reactions).map(([emoji, count]) =>
      `<span class="message-reaction-chip" data-msg-id="${m.id}" data-emoji="${emoji}">${emoji}<span class="reaction-count">${count > 1 ? count : ''}</span></span>`
    ).join('');

    // Message status
    let statusHtml = '';
    if (isMine) {
      const status = m._status || 'sent';
      if (status === 'sending') {
        statusHtml = `<span class="message-status sending">${icons.check}</span>`;
      } else if (status === 'seen') {
        statusHtml = `<span class="message-status seen">${icons.checkDouble}</span>`;
      } else {
        statusHtml = `<span class="message-status sent">${icons.check}</span>`;
      }
    }

    return `
      <div class="message-row ${isMine ? 'sent' : 'received'}" data-msg-id="${m.id}" data-msg-idx="${idx}" style="animation-delay:${Math.min(idx * 0.03, 0.3)}s">
        ${!isMine ? `
          <div class="avatar" style="width:28px;height:28px;font-size:12px;">
             ${m.sender_name?.[0]?.toUpperCase() || 'U'}
          </div>
        ` : ''}
        
        <div style="display:flex; flex-direction:column; max-width:100%; position:relative;">
          ${!isMine && m.sender_name ? `<div class="message-sender">${m.sender_name}</div>` : ''}
          <div class="message-bubble" data-msg-id="${m.id}">
            <div class="message-text">${escapeHtml(m.content)}</div>
            <div class="message-meta">
              <span class="message-time">${formatTime(m.created_at)}</span>
              ${statusHtml}
            </div>
          </div>
          ${reactionChips ? `<div class="message-reactions">${reactionChips}</div>` : ''}
        </div>

        <!-- Reaction bar (shows on hover) -->
        <div class="message-reaction-bar-trigger">
          <div class="reaction-bar">
            ${REACTION_EMOJIS.map(emoji => 
              `<button class="reaction-btn" data-msg-id="${m.id}" data-emoji="${emoji}" title="${emoji}">${emoji}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Attach context menu on right-click
  container.querySelectorAll('.message-bubble').forEach(bubble => {
    bubble.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const msgId = bubble.dataset.msgId;
      const msg = msgs.find(m => m.id === msgId);
      showContextMenu(e.clientX, e.clientY, msg);
    });
  });

  // Attach reaction button events
  container.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addReaction(btn.dataset.msgId, btn.dataset.emoji);
    });
  });

  // Attach reaction chip click (toggle)
  container.querySelectorAll('.message-reaction-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      addReaction(chip.dataset.msgId, chip.dataset.emoji);
    });
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// ===========================
// CONTEXT MENU
// ===========================
function showContextMenu(x, y, msg) {
  closeContextMenu();
  
  const isMine = msg?.sender_id === store.get('user').id;

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'chat-context-menu';

  // Adjust position to keep on screen
  const menuW = 200, menuH = 220;
  if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  
  menu.innerHTML = `
    <button class="context-menu-item" data-action="reply">
      ${icons.reply} Trả lời
    </button>
    <button class="context-menu-item" data-action="copy">
      ${icons.copy} Sao chép
    </button>
    ${isMine ? `
      <button class="context-menu-item" data-action="recall">
        ${icons.undo} Thu hồi
      </button>
    ` : ''}
    <div class="context-menu-divider"></div>
    <button class="context-menu-item danger" data-action="delete">
      ${icons.trash} Xóa
    </button>
  `;
  
  document.body.appendChild(menu);

  // Action handlers
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const action = item.dataset.action;
      handleContextAction(action, msg);
      closeContextMenu();
    });
  });
}

function closeContextMenu() {
  const existing = document.getElementById('chat-context-menu');
  if (existing) existing.remove();
}

function handleContextAction(action, msg) {
  if (!msg) return;
  switch(action) {
    case 'copy':
      navigator.clipboard?.writeText(msg.content).then(() => {
        showToast('Đã sao chép tin nhắn', 'success');
      }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = msg.content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('Đã sao chép tin nhắn', 'success');
      });
      break;
    case 'reply':
      const input = document.getElementById('chat-input-field');
      if (input) {
        input.focus();
        input.placeholder = `Trả lời: "${msg.content.substring(0, 30)}..."`;
      }
      showToast('Đã chọn tin nhắn để trả lời', 'info');
      break;
    case 'recall':
      showToast('Đã thu hồi tin nhắn', 'info');
      break;
    case 'delete':
      showToast('Đã xóa tin nhắn (phía bạn)', 'info');
      break;
  }
}

// ===========================
// EMOJI PICKER
// ===========================
function toggleEmojiPicker() {
  const container = document.getElementById('emoji-picker-container');
  if (!container) return;
  
  if (emojiPickerOpen) {
    container.innerHTML = '';
    emojiPickerOpen = false;
    return;
  }

  emojiPickerOpen = true;
  const categories = Object.entries(EMOJI_DATA);
  
  container.innerHTML = `
    <div class="emoji-picker" id="emoji-picker">
      <div class="emoji-picker-header">
        <input type="text" class="emoji-picker-search" id="emoji-search" placeholder="Tìm kiếm emoji..." />
      </div>
      <div style="flex:1; overflow-y:auto;">
        ${categories.map(([cat, emojis]) => `
          <div class="emoji-picker-category-label">${cat}</div>
          <div class="emoji-grid">
            ${emojis.map(e => `<button type="button" class="emoji-item" data-emoji="${e}">${e}</button>`).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Click emoji → insert into input
  container.querySelectorAll('.emoji-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const emoji = btn.dataset.emoji;
      const input = document.getElementById('chat-input-field');
      if (input) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
        input.dispatchEvent(new Event('input'));
      }
    });
  });

  // Search filter
  const searchInput = document.getElementById('emoji-search');
  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    container.querySelectorAll('.emoji-item').forEach(item => {
      item.style.display = q === '' || item.dataset.emoji.includes(q) ? 'flex' : 'none';
    });
  });

  // Close on outside click
  setTimeout(() => {
    const close = (e) => {
      const picker = document.getElementById('emoji-picker');
      const emojiBtn = document.getElementById('btn-emoji-picker');
      if (picker && !picker.contains(e.target) && e.target !== emojiBtn && !emojiBtn?.contains(e.target)) {
        container.innerHTML = '';
        emojiPickerOpen = false;
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 10);
}

// ===========================
// DRAG & DROP
// ===========================
function setupDragAndDrop() {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;

  let dragCounter = 0;

  panel.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    showDropZone();
  });

  panel.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      hideDropZone();
      dragCounter = 0;
    }
  });

  panel.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  panel.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    hideDropZone();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleDroppedFiles(files);
    }
  });
}

function showDropZone() {
  const panel = document.getElementById('chat-panel');
  if (!panel || document.getElementById('drop-zone-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'drop-zone-overlay';
  overlay.id = 'drop-zone-overlay';
  overlay.innerHTML = `
    ${icons.upload}
    <div class="drop-text">Thả file vào đây</div>
    <div class="drop-subtext">Ảnh, video, tài liệu...</div>
  `;
  panel.style.position = 'relative';
  panel.appendChild(overlay);
}

function hideDropZone() {
  const overlay = document.getElementById('drop-zone-overlay');
  if (overlay) overlay.remove();
}

function handleDroppedFiles(files) {
  const fileNames = Array.from(files).map(f => f.name).join(', ');
  showToast(`Đã nhận ${files.length} file: ${fileNames}`, 'info');
  
  // For each file, show as a chat message (simulated)
  const conv = store.getActiveConversation();
  if (!conv) return;
  
  Array.from(files).forEach(file => {
    const tempMsg = {
      id: 'file-' + Date.now() + '-' + Math.random(),
      conversation_id: conv.id,
      sender_id: store.get('user').id,
      content: `📎 ${file.name} (${formatFileSize(file.size)})`,
      type: 'file',
      created_at: new Date().toISOString(),
      _status: 'sending',
    };
    store.addMessage(conv.id, tempMsg);
  });
  
  renderMessagesList();

  // Simulate upload complete
  setTimeout(() => {
    showToast('Đã gửi file thành công!', 'success');
  }, 1500);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}


// ===========================
// CONVERSATION INFO PANEL
// ===========================
function renderInfoPanel(conv) {
  const infoPanel = document.getElementById('chat-info-panel');
  if (!infoPanel) return;

  const participants = conv.participants || [];
  const memberCount = participants.length;
  const convDisplayName = getConversationDisplayName(conv);
  
  // Resolve participant IDs to names using friends list
  const friends = store.get('friends') || [];
  const myUser = store.get('user');
  const resolvedMembers = participants.map(pid => {
    if (pid === myUser?.id) return { id: pid, name: myUser.username || 'Bạn' };
    const f = friends.find(fr => fr.user_id === pid);
    return { id: pid, name: f?.username || pid.substring(0, 8) };
  });

  infoPanel.innerHTML = `
    <div class="info-panel-header">
      <h3>Thông tin hội thoại</h3>
      <button class="info-panel-close" id="btn-close-info">${icons.x}</button>
    </div>
    <div class="info-panel-body">
      <!-- Profile Section -->
      <div class="info-profile">
        <div class="avatar">${convDisplayName[0]?.toUpperCase() || 'G'}</div>
        <div class="info-profile-name">${convDisplayName}</div>
        <div class="info-profile-status">${memberCount > 0 ? memberCount + ' thành viên' : 'Hoạt động'}</div>
      </div>

      <!-- Quick Actions -->
      <div class="info-section">
        <div class="info-action-row" id="info-action-pin">
          ${icons.pin} Ghim hội thoại
        </div>
        <div class="info-action-row" id="info-action-bell">
          ${icons.bell} Thông báo
        </div>
      </div>

      <!-- Media Gallery -->
      <div class="info-section">
        <div class="info-section-header">
          <div class="info-section-title">${icons.image} Kho lưu trữ</div>
          <div class="info-section-toggle">${icons.chevronDown}</div>
        </div>
        
        <div class="info-tabs">
          <button class="info-tab active" data-tab="photos">Ảnh</button>
          <button class="info-tab" data-tab="files">File</button>
          <button class="info-tab" data-tab="links">Liên kết</button>
        </div>

        <div id="info-media-content">
          <div class="info-media-grid">
            ${Array.from({length: 6}, (_, i) => `
              <div class="info-media-item">
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                  ${icons.image}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Members (if group) -->
      ${memberCount > 0 ? `
        <div class="info-section">
          <div class="info-section-header">
            <div class="info-section-title">${icons.users} Thành viên (${memberCount})</div>
            <div class="info-section-toggle">${icons.chevronDown}</div>
          </div>
          <div id="info-members-list">
            ${resolvedMembers.map(m => `
              <div class="info-action-row">
                <div class="avatar" style="width:32px;height:32px;font-size:12px;">
                  ${m.name[0]?.toUpperCase() || 'U'}
                </div>
                ${m.name}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Danger zone -->
      <div class="info-section" style="margin-top: var(--space-lg);">
        <div class="info-action-row danger">
          ${icons.trash} Xóa hội thoại
        </div>
      </div>
    </div>
  `;

  // Close button
  document.getElementById('btn-close-info')?.addEventListener('click', () => {
    document.getElementById('chat-page-root').classList.remove('info-open');
  });

  // Tab switching
  infoPanel.querySelectorAll('.info-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      infoPanel.querySelectorAll('.info-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabType = tab.dataset.tab;
      const mediaContent = document.getElementById('info-media-content');
      
      if (tabType === 'photos') {
        mediaContent.innerHTML = `
          <div class="info-media-grid">
            ${Array.from({length: 6}, () => `
              <div class="info-media-item">${icons.image}</div>
            `).join('')}
          </div>
        `;
      } else if (tabType === 'files') {
        mediaContent.innerHTML = `
          <div style="padding: var(--space-sm) 0;">
            <div class="info-action-row">${icons.file} document.pdf</div>
            <div class="info-action-row">${icons.file} report.xlsx</div>
            <div class="info-action-row">${icons.file} design.fig</div>
          </div>
        `;
      } else if (tabType === 'links') {
        mediaContent.innerHTML = `
          <div style="padding: var(--space-sm) 0;">
            <div class="info-action-row">${icons.link} https://example.com</div>
            <div class="info-action-row">${icons.link} https://github.com</div>
          </div>
        `;
      }
    });
  });

  // Action handlers
  document.getElementById('info-action-pin')?.addEventListener('click', () => {
    showToast('Đã ghim hội thoại', 'success');
  });
  document.getElementById('info-action-bell')?.addEventListener('click', () => {
    showToast('Đã tắt thông báo', 'info');
  });
}


// ===========================
// TYPING INDICATOR
// ===========================
function renderTypingIndicator() {
   const container = document.getElementById('typing-container');
   if(!container) return;
   
   const activeId = store.get('activeConversationId');
   const typingData = store.get('typingUsers')[activeId];

   if(typingData) {
     container.innerHTML = `
      <div class="typing-indicator">
        <div class="avatar" style="font-size:12px;">${typingData.username[0].toUpperCase()}</div>
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
     `;
     const scrollContainer = document.getElementById('chat-messages-container');
     scrollContainer.scrollTop = scrollContainer.scrollHeight;
   } else {
     container.innerHTML = '';
   }
}


// ===========================
// UTILS
// ===========================
// UTILITIES
// ===========================
function formatTime(isoString) {
  if(!isoString) return '';
  const d = new Date(isoString);
  let h = d.getHours();
  let m = d.getMinutes();
  h = h < 10 ? '0'+h : h;
  m = m < 10 ? '0'+m : m;
  return `${h}:${m}`;
}

function escapeHtml(unsafe) {
    if(!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }


// ===========================
// INCOMING CALL NOTIFICATION
// ===========================
let incomingCallTimeout = null;

function showIncomingCallNotification(data) {
  // data: { room_name, caller_id, caller_name }
  const callerName = data.caller_name || 'Người dùng';
  const roomName = data.room_name;

  // Play ring sound
  playRingSound();

  // Create overlay
  let overlay = document.getElementById('incoming-call-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'incoming-call-overlay';
  overlay.innerHTML = `
    <div class="incoming-call-card">
      <div class="incoming-call-pulse"></div>
      <div class="incoming-call-avatar">
        ${callerName[0]?.toUpperCase() || 'U'}
      </div>
      <div class="incoming-call-info">
        <div class="incoming-call-label">Cuộc gọi video đến</div>
        <div class="incoming-call-name">${escapeHtml(callerName)}</div>
      </div>
      <div class="incoming-call-actions">
        <button class="incoming-call-btn reject" id="btn-reject-call" title="Từ chối">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <button class="incoming-call-btn accept" id="btn-accept-call" title="Chấp nhận">
          ${icons.video}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Auto dismiss after 30 seconds
  incomingCallTimeout = setTimeout(() => {
    dismissIncomingCall();
    showToast('Cuộc gọi nhỡ từ ' + callerName, 'warning');
  }, 30000);

  // Accept
  document.getElementById('btn-accept-call')?.addEventListener('click', async () => {
    dismissIncomingCall();
    try {
      // Import joinCallFlow dynamically
      const { joinCallFlow } = await import('./videoCall.js');
      await joinCallFlow(roomName);
    } catch(err) {
      showToast('Lỗi khi tham gia cuộc gọi: ' + err.message, 'error');
    }
  });

  // Reject
  document.getElementById('btn-reject-call')?.addEventListener('click', () => {
    dismissIncomingCall();
    showToast('Đã từ chối cuộc gọi', 'info');
  });
}

function dismissIncomingCall() {
  clearTimeout(incomingCallTimeout);
  const overlay = document.getElementById('incoming-call-overlay');
  if (overlay) {
    overlay.classList.add('dismissing');
    setTimeout(() => overlay.remove(), 300);
  }
}

function playRingSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    // Ring pattern: two short tones
    for (let i = 0; i < 3; i++) {
      playTone(784, ctx.currentTime + i * 0.5, 0.15);
      playTone(988, ctx.currentTime + i * 0.5 + 0.15, 0.15);
    }
  } catch(e) { /* ignore audio errors */ }
}
