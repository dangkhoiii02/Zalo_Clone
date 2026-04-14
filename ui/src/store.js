// ===========================
// Simple Reactive State Store
// ===========================

class Store {
  constructor() {
    this.state = {
      // Auth
      user: null,
      token: localStorage.getItem('token') || null,
      isAuthenticated: false,

      // Conversations
      conversations: [],
      activeConversationId: null,

      // Messages (keyed by conversationId)
      messages: {},

      // Friends
      friends: [],
      pendingRequests: [],
      usersSearchResult: [],

      // Presence
      onlineUsers: {},    // userId -> true

      // Typing
      typingUsers: {},    // conversationId -> { userId, username, timeout }

      // UI state
      currentView: 'auth', // 'auth' | 'chat'
      sidebarTab: 'chats', // 'chats' | 'friends'
      isLoading: false,
      wsConnected: false,
    };

    this.listeners = new Map();
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.notify(key, value, oldValue);
  }

  update(key, updater) {
    const oldValue = this.state[key];
    this.state[key] = updater(oldValue);
    this.notify(key, this.state[key], oldValue);
  }

  // Subscribe to a specific key
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  notify(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => cb(newValue, oldValue));
    }
  }

  // Get messages for active conversation
  getActiveMessages() {
    const id = this.state.activeConversationId;
    return id ? (this.state.messages[id] || []) : [];
  }

  // Get active conversation object
  getActiveConversation() {
    const id = this.state.activeConversationId;
    return this.state.conversations.find(c => c.id === id) || null;
  }

  // Add message to a conversation
  addMessage(conversationId, message) {
    this.update('messages', (msgs) => {
      const updated = { ...msgs };
      if (!updated[conversationId]) {
        updated[conversationId] = [];
      }
      // Avoid duplicates
      if (!updated[conversationId].find(m => m.id === message.id)) {
        updated[conversationId] = [...updated[conversationId], message];
      }
      return updated;
    });

    // Update conversation last message and sort
    this.update('conversations', (convs) => {
      return convs.map(c => {
        if (c.id === conversationId) {
          return {
            ...c,
            last_message: {
              content: message.content,
              sender_id: message.sender_id,
              created_at: message.created_at,
            },
          };
        }
        return c;
      }).sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime) - new Date(aTime);
      });
    });
  }

  // Set typing user for a conversation
  setTyping(conversationId, userId, username) {
    const existing = this.state.typingUsers[conversationId];
    if (existing?.timeout) {
      clearTimeout(existing.timeout);
    }

    const timeout = setTimeout(() => {
      this.clearTyping(conversationId);
    }, 3000);

    this.update('typingUsers', (typing) => ({
      ...typing,
      [conversationId]: { userId, username, timeout },
    }));
  }

  clearTyping(conversationId) {
    this.update('typingUsers', (typing) => {
      const updated = { ...typing };
      delete updated[conversationId];
      return updated;
    });
  }

  // Reset state (logout)
  reset() {
    this.state.user = null;
    this.state.token = null;
    this.state.isAuthenticated = false;
    this.state.conversations = [];
    this.state.activeConversationId = null;
    this.state.messages = {};
    this.state.friends = [];
    this.state.pendingRequests = [];
    this.state.usersSearchResult = [];
    this.state.onlineUsers = {};
    this.state.typingUsers = {};
    this.state.currentView = 'auth';
    this.state.sidebarTab = 'chats';
    this.state.wsConnected = false;
    localStorage.removeItem('token');
  }
}

export const store = new Store();
