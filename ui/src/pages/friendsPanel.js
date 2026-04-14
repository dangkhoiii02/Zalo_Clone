import { icons } from '../icons.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast } from '../main.js';

export async function renderFriendsPanel() {
  const content = document.getElementById('sidebar-content');
  
  content.innerHTML = `
    <div class="friends-panel">
      <!-- Search Users -->
      <div class="friends-section search-users">
        <h3 class="section-title">Thêm bạn bè</h3>
        <div class="search-wrapper">
          <input type="text" id="add-friend-search" class="search-input" placeholder="Tìm bằng email hoặc tên..." />
          <button id="btn-search-users" class="btn btn-primary" style="margin-left: 8px; padding: 0 12px; height: 36px;">Tìm</button>
        </div>
        <div id="search-results" class="search-results-list"></div>
      </div>

      <!-- Pending Requests -->
      <div class="friends-section pending-requests">
        <h3 class="section-title">
          Lời mời kết bạn 
          <span class="badge" id="requests-count-badge" style="display:none">0</span>
        </h3>
        <div id="requests-list" class="requests-list">
          <!-- Populated via JS -->
          <div class="empty-state"><div class="spinner"></div></div>
        </div>
      </div>

      <!-- Friends List -->
      <div class="friends-section friends-list-section">
        <h3 class="section-title">Danh sách bạn bè</h3>
        <div id="friends-list" class="friends-list">
          <div class="empty-state"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  // Attach search event
  const searchBtn = document.getElementById('btn-search-users');
  const searchInput = document.getElementById('add-friend-search');
  
  const handleSearch = async () => {
    const q = searchInput.value.trim();
    if (!q) return;
    searchBtn.innerHTML = '<div class="spinner" style="width:16px; height:16px"></div>';
    
    try {
      const resp = await api.searchUsers(q);
      store.set('usersSearchResult', resp.users || []);
    } catch(e) {
      showToast('Lỗi khi tìm kiếm: ' + e.message, 'error');
    } finally {
      searchBtn.innerHTML = 'Tìm';
    }
  };

  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // Subscribe to changes
  store.subscribe('usersSearchResult', renderSearchResults);
  store.subscribe('pendingRequests', renderRequestsList);
  store.subscribe('friends', renderFriendsList);

  // Fetch initial data
  await fetchFriendsData();
}

async function fetchFriendsData() {
  try {
    const [friendsData, requestsData] = await Promise.all([
      api.getFriends(),
      api.getPendingRequests()
    ]);
    
    if (friendsData && friendsData.friends) store.set('friends', friendsData.friends);
    if (requestsData && requestsData.requests) {
      store.set('pendingRequests', requestsData.requests);
      // Update badge on sidebar nav if exists
      const badge = document.getElementById('friend-requests-badge');
      if (badge) {
        badge.textContent = requestsData.requests.length;
        badge.style.display = requestsData.requests.length > 0 ? 'inline-block' : 'none';
      }
    }
  } catch (error) {
    console.error("Failed to load friends data", error);
  }
}

function renderSearchResults() {
  const container = document.getElementById('search-results');
  if(!container) return;
  const users = store.get('usersSearchResult') || [];

  if (users.length === 0) {
    container.innerHTML = `<div class="empty-state">Không tìm thấy người dùng nào</div>`;
    return;
  }

  // Filter out self, and already friends (basic check)
  const myId = store.get('user').id;
  const friendIds = new Set(store.get('friends').map(f => f.user_id));
  
  const filteredUsers = users.filter(u => u.id !== myId);

  container.innerHTML = filteredUsers.map(u => `
    <div class="user-card-item">
      <div class="avatar">${u.username ? u.username[0].toUpperCase() : 'U'}</div>
      <div class="user-info">
        <div class="user-name">${u.username}</div>
        <div class="user-email">${u.email}</div>
      </div>
      <div class="user-actions">
        ${friendIds.has(u.id) 
            ? `<span class="badge">Bạn bè</span>`
            : `<button class="btn btn-outline btn-send-request" data-id="${u.id}">${icons.userPlus}</button>`
         }
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-send-request').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      e.currentTarget.disabled = true;
      e.currentTarget.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-color:var(--primary)"></div>';
      try {
        await api.sendFriendRequest(id);
        showToast('Đã gửi lời mời kết bạn!', 'success');
        e.currentTarget.parentElement.innerHTML = '<span class="badge">Đã gửi</span>';
      } catch(err) {
        showToast('Lỗi: ' + err.message, 'error');
        e.currentTarget.disabled = false;
        e.currentTarget.innerHTML = icons.userPlus;
      }
    });
  });
}

function renderRequestsList() {
  const container = document.getElementById('requests-list');
  const countBadge = document.getElementById('requests-count-badge');
  if(!container) return;
  
  const requests = store.get('pendingRequests') || [];
  
  if(countBadge) {
     countBadge.textContent = requests.length;
     countBadge.style.display = requests.length > 0 ? 'inline-block' : 'none';
  }

  if (requests.length === 0) {
    container.innerHTML = `<div class="empty-state">Không có lời mời nào</div>`;
    return;
  }

  container.innerHTML = requests.map(req => `
    <div class="user-card-item">
      <div class="avatar">${req.username ? req.username[0].toUpperCase() : 'U'}</div>
      <div class="user-info">
        <div class="user-name">${req.username}</div>
        <div class="user-email">${req.email}</div>
      </div>
      <div class="user-actions" style="display:flex; gap: 4px;">
        <button class="btn btn-primary btn-accept" data-id="${req.friendship_id}">Đồng ý</button>
        <button class="btn btn-outline btn-reject" data-id="${req.friendship_id}" style="border:none; color: var(--danger)">Từ chối</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-accept').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const friendshipId = e.target.dataset.id;
      try {
        await api.acceptFriendRequest(friendshipId);
        showToast('Đã chấp nhận kết bạn', 'success');
        fetchFriendsData(); // Refresh both lists
      } catch(err) {
        showToast('Lỗi: ' + err.message, 'error');
      }
    });
  });

  container.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const friendshipId = e.target.dataset.id;
      try {
        await api.removeFriend(friendshipId);
        showToast('Đã xoá lời mời', 'success');
        fetchFriendsData();
      } catch(err) {
        showToast('Lỗi: ' + err.message, 'error');
      }
    });
  });
}

function renderFriendsList() {
  const container = document.getElementById('friends-list');
  if(!container) return;
  
  const friends = store.get('friends') || [];

  if (friends.length === 0) {
    container.innerHTML = `<div class="empty-state">Bạn chưa có người bạn nào</div>`;
    return;
  }

  container.innerHTML = friends.map(f => `
    <div class="user-card-item">
      <div class="avatar">
         ${f.username ? f.username[0].toUpperCase() : 'F'}
         <div class="avatar-status ${store.get('onlineUsers')[f.user_id] ? 'online' : ''}"></div>
      </div>
      <div class="user-info">
        <div class="user-name">${f.username}</div>
        <div class="user-email">${f.email}</div>
      </div>
      <div class="user-actions">
        <button class="btn btn-outline btn-chat" data-id="${f.user_id}" data-name="${f.username}" style="border:none" title="Nhắn tin">${icons.messageCircle}</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-chat').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      // Find or create direct conversation
      const participantId = e.currentTarget.dataset.id;
      const participantName = e.currentTarget.dataset.name;
      try {
        // check if direct conv already exists (participants is string[])
        const convs = store.get('conversations') || [];
        let existingConv = convs.find(c => c.type === 'direct' && Array.isArray(c.participants) && c.participants.includes(participantId));
        
        let convId;
        if(existingConv) {
          convId = existingConv.id;
        } else {
          // create new
          const res = await api.createConversation('direct', [store.get('user').id, participantId]);
          convId = res.id;
          // Refresh conversations
          const convRes = await api.getConversations();
          store.set('conversations', convRes.conversations || []);
        }

        // Switch to "chats" tab and open conv
        document.querySelector('.sidebar-nav-tab[data-tab="chats"]').click();
        
        // Let chat.js openConversation handle it by firing a custom event or importing openConversation
        // We can just rely on the existing sidebar click or window dispatch
        window.dispatchEvent(new CustomEvent('open-chat', {detail: convId}));

      } catch(err) {
        showToast('Không thể mở chat: ' + err.message, 'error');
      }
    });
  });
}
