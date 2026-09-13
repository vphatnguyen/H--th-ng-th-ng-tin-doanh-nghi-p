/* ============================================================
   app.js – Router, State Management, Auth & Utilities
   ============================================================ */

let state = { token: null, user: null, customer: null, currentPage: null };

// ========== UTILITIES ==========
function api(method, url, body) {
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  });
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showModal(title, bodyHtml, wide = false) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const modal = document.getElementById('modal');
  modal.style.maxWidth = wide ? '720px' : '560px';
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
}

function formatCurrency(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

function formatDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('vi-VN');
}

function renderStars(r) {
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function roleBadge(role) {
  const map = { ADMIN: 'badge-admin', MANAGER: 'badge-manager', CUSTOMER: 'badge-customer' };
  const label = { ADMIN: '👑 Admin', MANAGER: '📊 Manager', CUSTOMER: '🛍️ Khách hàng' };
  return `<span class="badge ${map[role] || ''}">${label[role] || role}</span>`;
}

function statusBadge(status) {
  const map = { ACTIVE: 'badge-active', LOCKED: 'badge-locked', INACTIVE: 'badge-inactive' };
  const label = { ACTIVE: '✓ Hoạt động', LOCKED: '🔒 Bị khóa', INACTIVE: '✕ Ngừng HĐ' };
  return `<span class="badge ${map[status] || ''}">${label[status] || status}</span>`;
}

function launchBadge(s) {
  return s === 'UPCOMING'
    ? `<span class="badge badge-upcoming">⏳ Sắp ra mắt</span>`
    : `<span class="badge badge-official">✓ Chính thức</span>`;
}

function surveyStatusBadge(s) {
  const map = { DRAFT: 'badge-draft', ACTIVE: 'badge-active', CLOSED: 'badge-closed' };
  const label = { DRAFT: '📝 Nháp', ACTIVE: '🟢 Đang mở', CLOSED: '🔴 Đã đóng' };
  return `<span class="badge ${map[s] || ''}">${label[s] || s}</span>`;
}

function membershipBadge(tier) {
  if (!tier) return '';
  const label = { BRONZE: '🥉 Bronze', SILVER: '🥈 Silver', GOLD: '🥇 Gold', PLATINUM: '💎 Platinum' };
  return `<span class="badge badge-${tier.toLowerCase()}">${label[tier] || tier}</span>`;
}

function getCategoryIcon(cat) {
  const map = {
    'Son môi': '💄', 'Kem dưỡng da': '🧴', 'Serum': '✨', 'Kem chống nắng': '☀️',
    'Phấn phủ': '✨', 'Sữa rửa mặt': '🫧', 'Toner': '💧', 'Mặt nạ': '🎭',
    'Mascara': '👁️', 'Phấn má hồng': '🌸',
  };
  return map[cat] || '🌿';
}

// ========== AUTH ==========
async function login(username, password) {
  const btn = document.getElementById('login-btn');
  if (btn) { btn.textContent = 'Đang xử lý...'; btn.disabled = true; }
  try {
    const data = await api('POST', '/api/auth/login', { username, password });
    state.token = data.token;
    state.user = data.user;
    state.customer = data.customer;
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('crm_user', JSON.stringify(data.user));
    localStorage.setItem('crm_customer', JSON.stringify(data.customer));
    enterApp();
  } catch (e) {
    document.getElementById('login-error').textContent = e.message;
  } finally {
    if (btn) { btn.textContent = 'Đăng nhập'; btn.disabled = false; }
  }
}

async function quickLogin(username, password) {
  state.token = null; state.user = null; state.customer = null;
  localStorage.clear();
  document.getElementById('login-username').value = username;
  document.getElementById('login-password').value = password;
  await login(username, password);
}

function logout() {
  state = { token: null, user: null, customer: null, currentPage: null };
  localStorage.clear();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

function showRegister() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('register-screen').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

function tryAutoLogin() {
  const token = localStorage.getItem('crm_token');
  const user = localStorage.getItem('crm_user');
  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
    state.customer = JSON.parse(localStorage.getItem('crm_customer') || 'null');
    enterApp();
  }
}

// ========== APP ENTRY ==========
function enterApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  buildSidebar();
  navigateToDefault();
}

function buildSidebar() {
  const { user } = state;
  // Avatar
  document.getElementById('user-avatar-sidebar').textContent = user.full_name.charAt(0).toUpperCase();
  document.getElementById('sidebar-user-name').textContent = user.full_name;
  document.getElementById('sidebar-username').textContent = `@${user.username}`;

  // Role badge
  const roleBadgeEl = document.getElementById('sidebar-role-badge');
  const labels = { ADMIN: 'Admin', MANAGER: 'Manager', CUSTOMER: 'Khách hàng' };
  const cls = { ADMIN: '', MANAGER: 'manager', CUSTOMER: 'customer' };
  roleBadgeEl.textContent = labels[user.role];
  roleBadgeEl.className = `sidebar-role-badge ${cls[user.role] || ''}`;

  // Nav items by role
  const navMap = {
    ADMIN: [
      { label: 'PHÂN HỆ ADMIN', type: 'section' },
      { id: 'admin-accounts', icon: '👥', label: 'Quản lý Tài khoản' },
      { id: 'admin-products', icon: '💄', label: 'Quản lý Sản phẩm' },
      { id: 'admin-suppliers', icon: '🏪', label: 'Nhà cung cấp' },
      { id: 'admin-database', icon: '🗄️', label: 'Sao lưu & Phục hồi DB' },
    ],
    MANAGER: [
      { label: 'PHÂN HỆ QUẢN LÝ CRM', type: 'section' },
      { id: 'manager-dashboard', icon: '📊', label: 'Dashboard & Báo cáo' },
      { id: 'manager-customers', icon: '👩', label: 'Quản lý Khách hàng' },
      { id: 'manager-surveys', icon: '📋', label: 'Chiến dịch Khảo sát' },
      { id: 'manager-feedbacks', icon: '💬', label: 'Phản hồi & Đánh giá' },
    ],
    CUSTOMER: [
      { label: 'PHÂN HỆ KHÁCH HÀNG', type: 'section' },
      { id: 'customer-home', icon: '🏠', label: 'Trang chủ' },
      { id: 'customer-surveys', icon: '📋', label: 'Bài khảo sát của tôi' },
      { id: 'customer-feedback', icon: '💬', label: 'Phản hồi của tôi' },
      { id: 'customer-profile', icon: '👤', label: 'Hồ sơ cá nhân' },
    ],
  };

  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  (navMap[user.role] || []).forEach(item => {
    if (item.type === 'section') {
      nav.innerHTML += `<div class="nav-section-label">${item.label}</div>`;
    } else {
      const div = document.createElement('div');
      div.className = 'nav-item';
      div.id = `nav-${item.id}`;
      div.innerHTML = `<span class="nav-icon">${item.icon}</span><span>${item.label}</span>`;
      div.onclick = () => navigate(item.id);
      nav.appendChild(div);
    }
  });
}

function navigateToDefault() {
  const defaults = { ADMIN: 'admin-accounts', MANAGER: 'manager-dashboard', CUSTOMER: 'customer-home' };
  navigate(defaults[state.user.role]);
}

function navigate(pageId) {
  state.currentPage = pageId;
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${pageId}`);
  if (activeNav) activeNav.classList.add('active');

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');

  // Route to page
  const routes = {
    'admin-accounts': renderAdminAccounts,
    'admin-products': renderAdminProducts,
    'admin-suppliers': renderAdminSuppliers,
    'admin-database': renderAdminDatabase,
    'manager-dashboard': renderManagerDashboard,
    'manager-customers': renderManagerCustomers,
    'manager-surveys': renderManagerSurveys,
    'manager-feedbacks': renderManagerFeedbacks,
    'customer-home': renderCustomerHome,
    'customer-surveys': renderCustomerSurveys,
    'customer-feedback': renderCustomerFeedback,
    'customer-profile': renderCustomerProfile,
  };
  if (routes[pageId]) routes[pageId]();
}

function setPageHeader(title, subtitle, actionsHtml = '') {
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;
  document.getElementById('header-actions').innerHTML = actionsHtml;
}

function setPageContent(html) {
  document.getElementById('page-content').innerHTML = html;
}

function showLoading() {
  setPageContent('<div class="loading-spinner"><div class="spinner"></div></div>');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    login(u, p);
  });

  // Register form
  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('reg-error');
    const sucEl = document.getElementById('reg-success');
    errEl.textContent = ''; sucEl.textContent = '';
    try {
      await api('POST', '/api/auth/register', {
        username: document.getElementById('reg-username').value.trim(),
        password: document.getElementById('reg-password').value,
        full_name: document.getElementById('reg-fullname').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        phone: document.getElementById('reg-phone').value.trim(),
        age: Number(document.getElementById('reg-age').value) || null,
        gender: document.getElementById('reg-gender').value || null,
        skin_type: document.getElementById('reg-skin').value || null,
      });
      sucEl.textContent = '🎉 Đăng ký thành công! Chuyển đến trang đăng nhập...';
      document.getElementById('register-form').reset();
      setTimeout(showLogin, 2000);
    } catch (e) {
      errEl.textContent = e.message;
    }
  });

  tryAutoLogin();
});
