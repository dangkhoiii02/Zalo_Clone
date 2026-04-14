import { icons } from '../icons.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast } from '../main.js';

export function renderNewGroupModal() {
  // Check if modal container exists
  let modalContainer = document.getElementById('modal-root');
  if(!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'modal-root';
    document.body.appendChild(modalContainer);
  }

  const friends = store.get('friends') || [];

  modalContainer.innerHTML = `
    <div class="modal-overlay active" id="new-group-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Tạo nhóm mới</h3>
          <button class="btn-close-modal" id="btn-close-group-modal">${icons.x}</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Tên nhóm</label>
            <input type="text" id="new-group-name" class="search-input" placeholder="Nhập tên nhóm..." style="width: 100%" />
          </div>
          
          <div class="form-group" style="margin-top: 16px;">
            <label>Chọn bạn bè</label>
            <div class="friends-selector" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px;">
              ${friends.length === 0 ? '<p class="text-muted">Bạn chưa có người bạn nào để tạo nhóm.</p>' : ''}
              ${friends.map(f => `
                <label class="friend-select-item" style="display: flex; align-items: center; padding: 8px; cursor: pointer; gap: 12px; border-radius: 4px;">
                  <input type="checkbox" class="friend-checkbox" value="${f.user_id}" />
                  <div class="avatar" style="width:24px; height:24px; font-size: 10px;">${f.username[0].toUpperCase()}</div>
                  <span style="flex: 1;">${f.username}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px; border-top: 1px solid var(--border);">
          <button class="btn btn-outline" id="btn-cancel-group">Huỷ</button>
          <button class="btn btn-primary" id="btn-submit-group" disabled>Tạo nhóm</button>
        </div>
      </div>
    </div>
  `;

  // Logic
  const closeBtn = document.getElementById('btn-close-group-modal');
  const cancelBtn = document.getElementById('btn-cancel-group');
  const submitBtn = document.getElementById('btn-submit-group');
  const nameInput = document.getElementById('new-group-name');
  const checkboxes = document.querySelectorAll('.friend-checkbox');

  const closeModal = () => {
    modalContainer.innerHTML = '';
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Validate form
  const validate = () => {
    const selectedCount = Array.from(checkboxes).filter(c => c.checked).length;
    submitBtn.disabled = selectedCount === 0 || nameInput.value.trim().length === 0;
  };

  nameInput.addEventListener('input', validate);
  checkboxes.forEach(c => c.addEventListener('change', validate));

  // Submit
  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div>';
    try {
      const name = nameInput.value.trim();
      const selectedIds = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
      selectedIds.push(store.get('user').id); // Add self

      await api.createConversation('group', selectedIds, name);
      
      showToast('Tạo nhóm thành công', 'success');
      
      // Refresh conversations
      const convRes = await api.getConversations();
      store.set('conversations', convRes.conversations || []);
      
      closeModal();
    } catch(err) {
      showToast('Lỗi tạo nhóm: ' + err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Tạo nhóm';
    }
  });

  // Highlight selected items
  checkboxes.forEach(c => {
    c.addEventListener('change', (e) => {
      if(e.target.checked) {
        e.target.parentElement.style.backgroundColor = 'var(--bg-hover)';
      } else {
        e.target.parentElement.style.backgroundColor = 'transparent';
      }
    });
  });
}
