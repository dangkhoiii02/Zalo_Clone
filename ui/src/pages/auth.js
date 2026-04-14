// ===========================
// Auth Page — Login & Register
// ===========================

import { api } from '../api.js';
import { store } from '../store.js';
import { showToast } from '../main.js';
import { icons } from '../icons.js';

export function renderAuthPage() {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-bg">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
      </div>

      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">
            ${icons.chat}
          </div>
          <h1>Zalo Clone</h1>
          <p>Kết nối mọi lúc, mọi nơi</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-login" data-tab="login">Đăng nhập</button>
          <button class="auth-tab" id="tab-register" data-tab="register">Đăng ký</button>
        </div>

        <!-- Login Form -->
        <form class="auth-form" id="login-form">
          <div class="form-group">
            <label for="login-email">Email</label>
            <div class="form-input-wrapper">
              <input type="email" id="login-email" class="form-input" placeholder="your@email.com" required autocomplete="email" />
              <span class="form-input-icon">${icons.email}</span>
            </div>
            <span class="form-error" id="login-email-error"></span>
          </div>

          <div class="form-group">
            <label for="login-password">Mật khẩu</label>
            <div class="form-input-wrapper">
              <input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password" />
              <span class="form-input-icon">${icons.lock}</span>
            </div>
            <span class="form-error" id="login-password-error"></span>
          </div>

          <button type="submit" class="auth-submit" id="login-submit">
            <span class="btn-text">Đăng nhập</span>
            <div class="spinner"></div>
          </button>
        </form>

        <!-- Register Form (hidden) -->
        <form class="auth-form hidden" id="register-form">
          <div class="form-group">
            <label for="register-username">Tên hiển thị</label>
            <div class="form-input-wrapper">
              <input type="text" id="register-username" class="form-input" placeholder="Username" required minlength="3" maxlength="50" autocomplete="username" />
              <span class="form-input-icon">${icons.user}</span>
            </div>
            <span class="form-error" id="register-username-error"></span>
          </div>

          <div class="form-group">
            <label for="register-email">Email</label>
            <div class="form-input-wrapper">
              <input type="email" id="register-email" class="form-input" placeholder="your@email.com" required autocomplete="email" />
              <span class="form-input-icon">${icons.email}</span>
            </div>
            <span class="form-error" id="register-email-error"></span>
          </div>

          <div class="form-group">
            <label for="register-password">Mật khẩu</label>
            <div class="form-input-wrapper">
              <input type="password" id="register-password" class="form-input" placeholder="Tối thiểu 6 ký tự" required minlength="6" autocomplete="new-password" />
              <span class="form-input-icon">${icons.lock}</span>
            </div>
            <span class="form-error" id="register-password-error"></span>
          </div>

          <button type="submit" class="auth-submit" id="register-submit">
            <span class="btn-text">Tạo tài khoản</span>
            <div class="spinner"></div>
          </button>
        </form>

        <div class="auth-footer" id="auth-footer">
          Chưa có tài khoản? <a id="auth-switch">Đăng ký ngay</a>
        </div>
      </div>
    </div>
  `;

  initAuthEvents();
}

function initAuthEvents() {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const authFooter = document.getElementById('auth-footer');
  const authSwitch = document.getElementById('auth-switch');

  let currentTab = 'login';

  function switchTab(tab) {
    currentTab = tab;
    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      authFooter.innerHTML = 'Chưa có tài khoản? <a id="auth-switch">Đăng ký ngay</a>';
    } else {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      authFooter.innerHTML = 'Đã có tài khoản? <a id="auth-switch">Đăng nhập</a>';
    }
    // Re-attach switch event
    document.getElementById('auth-switch')?.addEventListener('click', () => {
      switchTab(currentTab === 'login' ? 'register' : 'login');
    });
  }

  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));
  authSwitch.addEventListener('click', () => switchTab('register'));

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('login-submit');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    clearErrors(loginForm);
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const data = await api.login(email, password);
      api.setToken(data.token);
      store.set('token', data.token);
      store.set('user', data.user);
      store.set('isAuthenticated', true);
      store.set('currentView', 'chat');
      showToast('Đăng nhập thành công!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  // Register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('register-submit');
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    clearErrors(registerForm);

    if (username.length < 3) {
      showFieldError('register-username', 'Tên phải có ít nhất 3 ký tự');
      return;
    }
    if (password.length < 6) {
      showFieldError('register-password', 'Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const data = await api.register(username, email, password);
      api.setToken(data.token);
      store.set('token', data.token);
      store.set('user', data.user);
      store.set('isAuthenticated', true);
      store.set('currentView', 'chat');
      showToast('Đăng ký thành công! Chào mừng bạn 🎉', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });
}

function clearErrors(form) {
  form.querySelectorAll('.form-group').forEach(g => g.classList.remove('error'));
  form.querySelectorAll('.form-error').forEach(e => e.textContent = '');
}

function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const group = input.closest('.form-group');
  const error = group.querySelector('.form-error');
  group.classList.add('error');
  error.textContent = message;
}
