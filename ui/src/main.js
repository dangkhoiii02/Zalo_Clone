import { store } from './store.js';
import { api } from './api.js';
import { renderAuthPage } from './pages/auth.js';
import { renderChatPage } from './pages/chat.js';

// ===========================
// GLOBAL APP ORCHESTRATOR
// ===========================

async function init() {
  const token = store.get('token');
  if (token) {
    // Try to fetch user to validate token
    try {
      const data = await api.getMe();
      store.set('user', data);
      store.set('isAuthenticated', true);
      store.set('currentView', 'chat');
    } catch (e) {
      // Invalid token
      store.reset();
    }
  }

  // Initial Render
  render();

  // Listen to major view changes
  store.subscribe('currentView', render);
}

function render() {
  const view = store.get('currentView');
  
  if (view === 'auth') {
    renderAuthPage();
  } else if (view === 'chat') {
    renderChatPage();
  }
}

// Global Toast utility
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if(!container) return;

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      ${icons[type] || icons.info}
    </div>
    <div class="toast-content">
      ${message}
    </div>
    <button class="toast-close">
      <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  `;

  container.appendChild(toast);

  // Close logic
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  });

  // Auto remove
  setTimeout(() => {
    if(toast.parentElement) {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Start app
document.addEventListener('DOMContentLoaded', init);
