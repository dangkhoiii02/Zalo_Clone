// ===========================
// API Client — REST API wrapper
// ===========================

const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    return this.token;
  }

  async request(method, path, body = null) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = { method, headers };
    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${path}`, config);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.error || `HTTP ${res.status}`;
      throw new Error(errorMsg);
    }

    return data;
  }

  // Auth
  async register(username, email, password) {
    return this.request('POST', '/auth/register', { username, email, password });
  }

  async login(email, password) {
    return this.request('POST', '/auth/login', { email, password });
  }

  async getMe() {
    return this.request('GET', '/auth/me');
  }

  // Users
  async updateProfile(data) {
    return this.request('PUT', '/users/profile', data);
  }

  async searchUsers(query) {
    return this.request('GET', `/users/search?q=${encodeURIComponent(query)}`);
  }

  // Friends
  async sendFriendRequest(friendId) {
    return this.request('POST', '/friends/request', { friend_id: friendId });
  }

  async acceptFriendRequest(friendshipId) {
    return this.request('PUT', `/friends/accept/${friendshipId}`);
  }

  async removeFriend(friendshipId) {
    return this.request('DELETE', `/friends/${friendshipId}`);
  }

  async getFriends() {
    return this.request('GET', '/friends');
  }

  async getPendingRequests() {
    return this.request('GET', '/friends/requests');
  }

  // Conversations
  async createConversation(type, participants, name = '') {
    return this.request('POST', '/conversations', { type, participants, name });
  }

  async getConversations() {
    return this.request('GET', '/conversations');
  }

  async getMessages(conversationId, limit = 50, offset = 0) {
    return this.request('GET', `/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`);
  }

  // Calls
  async startCall(calleeId) {
    return this.request('POST', '/calls/start', { callee_id: calleeId });
  }

  async joinCall(roomName) {
    return this.request('POST', `/calls/join/${roomName}`);
  }
}

export const api = new ApiClient();
