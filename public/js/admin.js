/* ============================================================
   admin.js – Admin Module: Accounts, Products, Suppliers, DB Console
   ============================================================ */

// ========== ADMIN: ACCOUNTS ==========
async function renderAdminAccounts() {
  setPageHeader('👥 Quản lý Tài khoản', 'Phân quyền và quản lý toàn bộ người dùng hệ thống',
    `<button class="btn btn-primary" onclick="openCreateAccountModal()">➕ Thêm tài khoản</button>`);
  showLoading();
  try {
    const accounts = await api('GET', '/api/admin/accounts');
    renderAccountsTable(accounts);
  } catch (e) { toast(e.message, 'error'); }
}

let currentAccountsList = [];
function openEditAccountModalById(id) {
  const a = currentAccountsList.find(x => Number(x.id) === Number(id));
  if (a) openEditAccountModal(a);
}

function renderAccountsTable(accounts, searchParams = {}) {
  currentAccountsList = accounts;
  const html = `
    <div class="filter-bar">
      <input type="text" id="acc-search" placeholder="🔍 Tìm tên, username, email..." value="${searchParams.search || ''}">
      <select id="acc-role">
        <option value="">Tất cả vai trò</option>
        <option value="ADMIN" ${searchParams.role === 'ADMIN' ? 'selected' : ''}>👑 Admin</option>
        <option value="MANAGER" ${searchParams.role === 'MANAGER' ? 'selected' : ''}>📊 Manager</option>
        <option value="CUSTOMER" ${searchParams.role === 'CUSTOMER' ? 'selected' : ''}>🛍️ Khách hàng</option>
      </select>
      <select id="acc-status">
        <option value="">Tất cả trạng thái</option>
        <option value="ACTIVE" ${searchParams.status === 'ACTIVE' ? 'selected' : ''}>Hoạt động</option>
        <option value="LOCKED" ${searchParams.status === 'LOCKED' ? 'selected' : ''}>Bị khóa</option>
      </select>
      <button class="btn btn-primary" onclick="filterAccounts()">🔍 Lọc</button>
      <button class="btn btn-secondary" onclick="renderAdminAccounts()">↺ Reset</button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>ID</th><th>Họ và tên</th><th>Tên đăng nhập</th><th>Email</th><th>Số ĐT</th>
          <th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th>Hành động</th>
        </tr></thead>
        <tbody>
          ${accounts.length === 0 ? `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px">Không tìm thấy tài khoản nào</td></tr>` : accounts.map(a => `
            <tr>
              <td><span style="color:var(--text-muted)">#${a.id}</span></td>
              <td><strong>${a.full_name}</strong></td>
              <td><code style="color:var(--rose-300)">@${a.username}</code></td>
              <td style="color:var(--text-secondary)">${a.email || '—'}</td>
              <td style="color:var(--text-secondary)">${a.phone || '—'}</td>
              <td>${roleBadge(a.role)}</td>
              <td>${statusBadge(a.status)}</td>
              <td style="color:var(--text-muted);font-size:12px">${formatDate(a.created_at)}</td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-secondary btn-sm" onclick="openEditAccountModalById(${a.id})">✏️</button>
                  <button class="btn btn-trash btn-sm" onclick="deleteAccount(${a.id},'${a.full_name.replace(/'/g, "\\'")}')"><svg class="trash-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2v2H2v2h1v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6h1V4h-4V2h-2v2H9V2H6zm7 5v9h-2V7h2zM9 2V4h6V2H9z"/></svg></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p style="color:var(--text-muted);font-size:12px;margin-top:10px">Tổng: ${accounts.length} tài khoản</p>
  `;
  setPageContent(html);
}

async function filterAccounts() {
  const search = document.getElementById('acc-search').value.trim();
  const role = document.getElementById('acc-role').value;
  const status = document.getElementById('acc-status').value;
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (role) params.append('role', role);
  if (status) params.append('status', status);
  try {
    const accounts = await api('GET', `/api/admin/accounts?${params}`);
    renderAccountsTable(accounts, { search, role, status });
  } catch (e) { toast(e.message, 'error'); }
}

function openCreateAccountModal() {
  showModal('➕ Tạo tài khoản mới', `
    <div class="form-row">
      <div class="form-group"><label>Tên đăng nhập *</label><input id="m-username" placeholder="username"></div>
      <div class="form-group"><label>Mật khẩu *</label><input id="m-password" type="password" placeholder="Mật khẩu"></div>
    </div>
    <div class="form-group"><label>Họ và tên *</label><input id="m-fullname" placeholder="Họ và tên đầy đủ"></div>
    <div class="form-row">
      <div class="form-group"><label>Email</label><input id="m-email" type="email" placeholder="email@example.com"></div>
      <div class="form-group"><label>Số điện thoại</label><input id="m-phone" placeholder="0901234567"></div>
    </div>
    <div class="form-group"><label>Vai trò</label>
      <select id="m-role">
        <option value="CUSTOMER">🛍️ Khách hàng</option>
        <option value="MANAGER">📊 Manager</option>
        <option value="ADMIN">👑 Admin</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="createAccount()">✅ Tạo tài khoản</button>
    </div>
  `);
}

async function createAccount() {
  try {
    await api('POST', '/api/admin/accounts', {
      username: document.getElementById('m-username').value.trim(),
      password: document.getElementById('m-password').value,
      full_name: document.getElementById('m-fullname').value.trim(),
      email: document.getElementById('m-email').value.trim(),
      phone: document.getElementById('m-phone').value.trim(),
      role: document.getElementById('m-role').value,
    });
    toast('Tạo tài khoản thành công!', 'success');
    closeModal();
    renderAdminAccounts();
  } catch (e) { toast(e.message, 'error'); }
}

function openEditAccountModal(a) {
  if (typeof a === 'string') a = JSON.parse(a.replace(/&quot;/g, '"'));
  showModal(`✏️ Phân quyền: ${a.full_name}`, `
    <div class="form-group">
      <label>Vai trò</label>
      <select id="e-role">
        <option value="CUSTOMER" ${a.role === 'CUSTOMER' ? 'selected' : ''}>🛍️ Khách hàng</option>
        <option value="MANAGER" ${a.role === 'MANAGER' ? 'selected' : ''}>📊 Manager</option>
        <option value="ADMIN" ${a.role === 'ADMIN' ? 'selected' : ''}>👑 Admin</option>
      </select>
    </div>
    <div class="form-group">
      <label>Trạng thái</label>
      <select id="e-status">
        <option value="ACTIVE" ${a.status === 'ACTIVE' ? 'selected' : ''}>✓ Hoạt động</option>
        <option value="LOCKED" ${a.status === 'LOCKED' ? 'selected' : ''}>🔒 Khóa tài khoản</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="updateAccount(${a.id})">💾 Lưu thay đổi</button>
    </div>
  `);
}

async function updateAccount(id) {
  try {
    await api('PUT', `/api/admin/accounts/${id}`, {
      role: document.getElementById('e-role').value,
      status: document.getElementById('e-status').value,
    });
    toast('Cập nhật tài khoản thành công!', 'success');
    closeModal();
    renderAdminAccounts();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteAccount(id, name) {
  if (!confirm(`Xác nhận xóa tài khoản "${name}"? Hành động này không thể hoàn tác.`)) return;
  try {
    await api('DELETE', `/api/admin/accounts/${id}`);
    toast('Đã xóa tài khoản', 'success');
    renderAdminAccounts();
  } catch (e) { toast(e.message, 'error'); }
}

// ========== ADMIN: PRODUCTS ==========
let productFilters = {};

async function renderAdminProducts() {
  setPageHeader('💄 Quản lý Sản phẩm', 'Tìm kiếm nâng cao, sắp xếp và quản lý danh mục mỹ phẩm',
    `<button class="btn btn-primary" onclick="openCreateProductModal()">➕ Thêm sản phẩm</button>`);
  showLoading();
  await fetchAndRenderProducts({});
}

let currentProductsList = [];
function openEditProductModalById(id) {
  const p = currentProductsList.find(x => Number(x.id) === Number(id));
  if (p) openEditProductModal(p);
}

async function fetchAndRenderProducts(filters) {
  productFilters = filters;
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    const products = await api('GET', `/api/admin/products?${params}`);
    const suppliers = await api('GET', '/api/admin/suppliers');
    currentProductsList = products;

    const supplierOptions = suppliers.map(s => `<option value="${s.id}" ${filters.supplier_id == s.id ? 'selected' : ''}>${s.name}</option>`).join('');

    const html = `
      <div class="filter-bar">
        <input type="text" id="prod-search" placeholder="🔍 Tên sản phẩm..." value="${filters.search || ''}">
        <select id="prod-cat">
          <option value="">Tất cả danh mục</option>
          ${['Son môi','Kem dưỡng da','Serum','Kem chống nắng','Phấn phủ','Sữa rửa mặt','Toner','Mặt nạ']
            .map(c => `<option value="${c}" ${filters.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <select id="prod-supplier">
          <option value="">Tất cả NCC</option>${supplierOptions}
        </select>
        <select id="prod-launch">
          <option value="">Tất cả</option>
          <option value="OFFICIAL" ${filters.launch_status === 'OFFICIAL' ? 'selected' : ''}>✓ Chính thức</option>
          <option value="UPCOMING" ${filters.launch_status === 'UPCOMING' ? 'selected' : ''}>⏳ Sắp ra mắt</option>
        </select>
        <input type="number" id="prod-minprice" placeholder="Giá từ (₫)" value="${filters.min_price || ''}" style="max-width:120px">
        <input type="number" id="prod-maxprice" placeholder="Đến (₫)" value="${filters.max_price || ''}" style="max-width:120px">
        <select id="prod-sort">
          <option value="created_at" ${filters.sort_by === 'created_at' ? 'selected' : ''}>Mới nhất</option>
          <option value="price" ${filters.sort_by === 'price' ? 'selected' : ''}>Theo giá</option>
          <option value="name" ${filters.sort_by === 'name' ? 'selected' : ''}>Theo tên A-Z</option>
          <option value="stock_quantity" ${filters.sort_by === 'stock_quantity' ? 'selected' : ''}>Theo tồn kho</option>
        </select>
        <select id="prod-sortdir">
          <option value="desc" ${filters.sort_dir === 'desc' ? 'selected' : ''}>▼ Giảm dần</option>
          <option value="asc" ${filters.sort_dir === 'asc' ? 'selected' : ''}>▲ Tăng dần</option>
        </select>
        <button class="btn btn-primary" onclick="applyProductFilters()">🔍 Tìm & Lọc</button>
        <button class="btn btn-secondary" onclick="fetchAndRenderProducts({})">↺ Reset</button>
      </div>

      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>ID</th><th>Sản phẩm</th><th>Danh mục</th><th>Nhà cung cấp</th>
            <th>Giá</th><th>Tồn kho</th><th>Trạng thái</th><th>Ngày tạo</th><th>Hành động</th>
          </tr></thead>
          <tbody>
            ${products.length === 0 ? `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px">Không tìm thấy sản phẩm nào</td></tr>` : products.map(p => `
              <tr>
                <td><span style="color:var(--text-muted)">#${p.id}</span></td>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:22px">${getCategoryIcon(p.category)}</span>
                    <div>
                      <div style="font-weight:600;max-width:200px">${p.name}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${p.description ? p.description.substring(0,50)+'...' : ''}</div>
                    </div>
                  </div>
                </td>
                <td><span class="tag">${p.category}</span></td>
                <td style="color:var(--text-secondary);font-size:12px">${p.supplier_name || '—'}</td>
                <td><strong style="color:var(--rose-300)">${formatCurrency(p.price)}</strong></td>
                <td>
                  <span style="color:${p.stock_quantity === 0 ? '#f87171' : p.stock_quantity < 50 ? '#fbbf24' : '#34d399'};font-weight:600">
                    ${p.stock_quantity === 0 ? '⚠️ Hết' : p.stock_quantity}
                  </span>
                </td>
                <td>${launchBadge(p.launch_status)}</td>
                <td style="color:var(--text-muted);font-size:12px">${formatDate(p.created_at)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-secondary btn-sm" onclick="openEditProductModalById(${p.id})">✏️</button>
                    <button class="btn btn-trash btn-sm" onclick="deleteProduct(${p.id},'${p.name.replace(/'/g,"\\'")}')"><svg class="trash-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2v2H2v2h1v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6h1V4h-4V2h-2v2H9V2H6zm7 5v9h-2V7h2zM9 2V4h6V2H9z"/></svg></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-top:10px">Hiển thị ${products.length} sản phẩm</p>
    `;
    setPageContent(html);
  } catch (e) { toast(e.message, 'error'); }
}

function applyProductFilters() {
  fetchAndRenderProducts({
    search: document.getElementById('prod-search').value.trim(),
    category: document.getElementById('prod-cat').value,
    supplier_id: document.getElementById('prod-supplier').value,
    launch_status: document.getElementById('prod-launch').value,
    min_price: document.getElementById('prod-minprice').value,
    max_price: document.getElementById('prod-maxprice').value,
    sort_by: document.getElementById('prod-sort').value,
    sort_dir: document.getElementById('prod-sortdir').value,
  });
}

async function openCreateProductModal() {
  const suppliers = await api('GET', '/api/admin/suppliers').catch(() => []);
  const catOptions = ['Son môi','Kem dưỡng da','Serum','Kem chống nắng','Phấn phủ','Sữa rửa mặt','Toner','Mặt nạ','Mascara','Phấn má hồng']
    .map(c => `<option value="${c}">${c}</option>`).join('');
  const supOptions = suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  showModal('➕ Thêm sản phẩm mới', `
    <div class="form-group"><label>Tên sản phẩm *</label><input id="mp-name" placeholder="Tên sản phẩm đầy đủ"></div>
    <div class="form-row">
      <div class="form-group"><label>Danh mục *</label><select id="mp-cat"><option value="">-- Chọn --</option>${catOptions}</select></div>
      <div class="form-group"><label>Nhà cung cấp</label><select id="mp-supplier"><option value="">-- Chọn NCC --</option>${supOptions}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Giá bán (₫)</label><input id="mp-price" type="number" placeholder="0" min="0"></div>
      <div class="form-group"><label>Tồn kho</label><input id="mp-stock" type="number" placeholder="0" min="0"></div>
    </div>
    <div class="form-group"><label>Trạng thái ra mắt</label>
      <select id="mp-launch">
        <option value="OFFICIAL">✓ Sản phẩm chính thức</option>
        <option value="UPCOMING">⏳ Sắp ra mắt (đang khảo sát)</option>
      </select>
    </div>
    <div class="form-group"><label>Mô tả sản phẩm</label><textarea id="mp-desc" placeholder="Mô tả chi tiết sản phẩm..."></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="createProduct()">✅ Thêm sản phẩm</button>
    </div>
  `);
}

async function createProduct() {
  try {
    await api('POST', '/api/admin/products', {
      name: document.getElementById('mp-name').value.trim(),
      category: document.getElementById('mp-cat').value,
      supplier_id: document.getElementById('mp-supplier').value || null,
      price: Number(document.getElementById('mp-price').value) || 0,
      stock_quantity: Number(document.getElementById('mp-stock').value) || 0,
      launch_status: document.getElementById('mp-launch').value,
      description: document.getElementById('mp-desc').value.trim(),
    });
    toast('Thêm sản phẩm thành công!', 'success');
    closeModal();
    fetchAndRenderProducts(productFilters);
  } catch (e) { toast(e.message, 'error'); }
}

async function openEditProductModal(p) {
  const suppliers = await api('GET', '/api/admin/suppliers').catch(() => []);
  const catOptions = ['Son môi','Kem dưỡng da','Serum','Kem chống nắng','Phấn phủ','Sữa rửa mặt','Toner','Mặt nạ']
    .map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${c}</option>`).join('');
  const supOptions = suppliers.map(s => `<option value="${s.id}" ${p.supplier_id == s.id ? 'selected' : ''}>${s.name}</option>`).join('');

  showModal(`✏️ Chỉnh sửa: ${p.name}`, `
    <div class="form-group"><label>Tên sản phẩm *</label><input id="ep-name" value="${p.name}"></div>
    <div class="form-row">
      <div class="form-group"><label>Danh mục</label><select id="ep-cat">${catOptions}</select></div>
      <div class="form-group"><label>Nhà cung cấp</label><select id="ep-supplier"><option value="">-- Chọn --</option>${supOptions}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Giá bán (₫)</label><input id="ep-price" type="number" value="${p.price}"></div>
      <div class="form-group"><label>Tồn kho</label><input id="ep-stock" type="number" value="${p.stock_quantity}"></div>
    </div>
    <div class="form-group"><label>Trạng thái ra mắt</label>
      <select id="ep-launch">
        <option value="OFFICIAL" ${p.launch_status === 'OFFICIAL' ? 'selected' : ''}>✓ Chính thức</option>
        <option value="UPCOMING" ${p.launch_status === 'UPCOMING' ? 'selected' : ''}>⏳ Sắp ra mắt</option>
      </select>
    </div>
    <div class="form-group"><label>Mô tả</label><textarea id="ep-desc">${p.description || ''}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="updateProduct(${p.id})">💾 Lưu thay đổi</button>
    </div>
  `);
}

async function updateProduct(id) {
  try {
    await api('PUT', `/api/admin/products/${id}`, {
      name: document.getElementById('ep-name').value.trim(),
      category: document.getElementById('ep-cat').value,
      supplier_id: document.getElementById('ep-supplier').value || null,
      price: Number(document.getElementById('ep-price').value),
      stock_quantity: Number(document.getElementById('ep-stock').value),
      launch_status: document.getElementById('ep-launch').value,
      description: document.getElementById('ep-desc').value.trim(),
    });
    toast('Cập nhật sản phẩm thành công!', 'success');
    closeModal();
    fetchAndRenderProducts(productFilters);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteProduct(id, name) {
  if (!confirm(`Xác nhận xóa sản phẩm "${name}"?`)) return;
  try {
    await api('DELETE', `/api/admin/products/${id}`);
    toast('Đã xóa sản phẩm', 'success');
    fetchAndRenderProducts(productFilters);
  } catch (e) { toast(e.message, 'error'); }
}

// ========== ADMIN: SUPPLIERS ==========
async function renderAdminSuppliers() {
  setPageHeader('🏪 Quản lý Nhà cung cấp', 'Quản lý danh sách nhà cung cấp mỹ phẩm',
    `<button class="btn btn-primary" onclick="openCreateSupplierModal()">➕ Thêm nhà cung cấp</button>`);
  showLoading();
  try {
    const suppliers = await api('GET', '/api/admin/suppliers');
    renderSuppliersTable(suppliers);
  } catch (e) { toast(e.message, 'error'); }
}

let currentSuppliersList = [];
function openEditSupplierModalById(id) {
  const s = currentSuppliersList.find(x => Number(x.id) === Number(id));
  if (s) openEditSupplierModal(s);
}

function renderSuppliersTable(suppliers) {
  currentSuppliersList = suppliers;
  const html = `
    <div class="filter-bar">
      <input type="text" id="sup-search" placeholder="🔍 Tên, người liên hệ, email...">
      <select id="sup-status">
        <option value="">Tất cả</option>
        <option value="ACTIVE">✓ Đang hợp tác</option>
        <option value="INACTIVE">✕ Ngừng hợp tác</option>
      </select>
      <button class="btn btn-primary" onclick="filterSuppliers()">🔍 Lọc</button>
      <button class="btn btn-secondary" onclick="renderAdminSuppliers()">↺ Reset</button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>ID</th><th>Tên nhà cung cấp</th><th>Người liên hệ</th><th>Email</th><th>Điện thoại</th><th>Địa chỉ</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
        <tbody>
          ${suppliers.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">Chưa có nhà cung cấp</td></tr>` : suppliers.map(s => `
            <tr>
              <td><span style="color:var(--text-muted)">#${s.id}</span></td>
              <td><strong>${s.name}</strong></td>
              <td>${s.contact_name || '—'}</td>
              <td style="color:var(--text-secondary)">${s.email || '—'}</td>
              <td>${s.phone || '—'}</td>
              <td style="color:var(--text-muted);font-size:12px;max-width:180px">${s.address || '—'}</td>
              <td>${statusBadge(s.status)}</td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-secondary btn-sm" onclick="openEditSupplierModalById(${s.id})">✏️</button>
                  <button class="btn btn-trash btn-sm" onclick="deleteSupplier(${s.id},'${s.name.replace(/'/g,"\\'")}')"><svg class="trash-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2v2H2v2h1v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6h1V4h-4V2h-2v2H9V2H6zm7 5v9h-2V7h2zM9 2V4h6V2H9z"/></svg></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  setPageContent(html);
}

async function filterSuppliers() {
  const search = document.getElementById('sup-search').value.trim();
  const status = document.getElementById('sup-status').value;
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  try {
    const suppliers = await api('GET', `/api/admin/suppliers?${params}`);
    renderSuppliersTable(suppliers);
  } catch (e) { toast(e.message, 'error'); }
}

function openCreateSupplierModal() {
  showModal('➕ Thêm nhà cung cấp mới', `
    <div class="form-group"><label>Tên nhà cung cấp *</label><input id="ms-name" placeholder="Tên công ty / thương hiệu"></div>
    <div class="form-row">
      <div class="form-group"><label>Người liên hệ</label><input id="ms-contact" placeholder="Họ và tên"></div>
      <div class="form-group"><label>Điện thoại</label><input id="ms-phone" placeholder="028xxxxxxx"></div>
    </div>
    <div class="form-group"><label>Email</label><input id="ms-email" type="email" placeholder="contact@supplier.com"></div>
    <div class="form-group"><label>Địa chỉ</label><input id="ms-addr" placeholder="Địa chỉ công ty"></div>
    <div class="form-group"><label>Trạng thái</label>
      <select id="ms-status"><option value="ACTIVE">✓ Đang hợp tác</option><option value="INACTIVE">✕ Ngừng hợp tác</option></select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="createSupplier()">✅ Thêm</button>
    </div>
  `);
}

async function createSupplier() {
  try {
    await api('POST', '/api/admin/suppliers', {
      name: document.getElementById('ms-name').value.trim(),
      contact_name: document.getElementById('ms-contact').value.trim(),
      phone: document.getElementById('ms-phone').value.trim(),
      email: document.getElementById('ms-email').value.trim(),
      address: document.getElementById('ms-addr').value.trim(),
      status: document.getElementById('ms-status').value,
    });
    toast('Thêm nhà cung cấp thành công!', 'success');
    closeModal();
    renderAdminSuppliers();
  } catch (e) { toast(e.message, 'error'); }
}

function openEditSupplierModal(s) {
  showModal(`✏️ Chỉnh sửa: ${s.name}`, `
    <div class="form-group"><label>Tên nhà cung cấp</label><input id="es-name" value="${s.name}"></div>
    <div class="form-row">
      <div class="form-group"><label>Người liên hệ</label><input id="es-contact" value="${s.contact_name || ''}"></div>
      <div class="form-group"><label>Điện thoại</label><input id="es-phone" value="${s.phone || ''}"></div>
    </div>
    <div class="form-group"><label>Email</label><input id="es-email" value="${s.email || ''}"></div>
    <div class="form-group"><label>Địa chỉ</label><input id="es-addr" value="${s.address || ''}"></div>
    <div class="form-group"><label>Trạng thái</label>
      <select id="es-status">
        <option value="ACTIVE" ${s.status === 'ACTIVE' ? 'selected' : ''}>✓ Đang hợp tác</option>
        <option value="INACTIVE" ${s.status === 'INACTIVE' ? 'selected' : ''}>✕ Ngừng hợp tác</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="updateSupplier(${s.id})">💾 Lưu</button>
    </div>
  `);
}

async function updateSupplier(id) {
  try {
    await api('PUT', `/api/admin/suppliers/${id}`, {
      name: document.getElementById('es-name').value.trim(),
      contact_name: document.getElementById('es-contact').value.trim(),
      phone: document.getElementById('es-phone').value.trim(),
      email: document.getElementById('es-email').value.trim(),
      address: document.getElementById('es-addr').value.trim(),
      status: document.getElementById('es-status').value,
    });
    toast('Cập nhật thành công!', 'success');
    closeModal();
    renderAdminSuppliers();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteSupplier(id, name) {
  if (!confirm(`Xác nhận xóa nhà cung cấp "${name}"?`)) return;
  try {
    await api('DELETE', `/api/admin/suppliers/${id}`);
    toast('Đã xóa nhà cung cấp', 'success');
    renderAdminSuppliers();
  } catch (e) { toast(e.message, 'error'); }
}

// ========== ADMIN: DATABASE BACKUP/RESTORE CONSOLE ==========
function renderAdminDatabase() {
  setPageHeader('🗄️ Quản lý Cơ sở dữ liệu', 'Phương án sao lưu & phục hồi CSDL hệ thống CRM');

  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      <div class="stat-card purple">
        <div class="stat-icon">🛡️</div>
        <div class="stat-value">ONLINE</div>
        <div class="stat-label">Trạng thái CSDL</div>
      </div>
      <div class="stat-card gold">
        <div class="stat-icon">📦</div>
        <div class="stat-value">SQL Server</div>
        <div class="stat-label">Engine đang sử dụng</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      <!-- Full Backup Panel -->
      <div class="card">
        <div class="card-title">🗃️ Full Backup</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Tạo bản sao lưu toàn bộ cơ sở dữ liệu. Nên thực hiện định kỳ hàng tuần.</p>
        <div class="form-group" style="margin-bottom:14px">
          <label>Tên file backup</label>
          <input id="backup-filename" value="CosmeticsCRM_FULL_${new Date().toISOString().slice(0,10).replace(/-/g,'')}" placeholder="Tên file">
        </div>
        <button class="btn btn-primary btn-full" onclick="runFullBackup()">🔒 Thực hiện Full Backup</button>
      </div>

      <!-- Differential Backup Panel -->
      <div class="card">
        <div class="card-title">📝 Differential Backup</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Sao lưu các thay đổi phát sinh từ lần Full Backup gần nhất. Thực hiện hàng ngày.</p>
        <div class="form-group" style="margin-bottom:14px">
          <label>Tên file differential</label>
          <input id="diff-filename" value="CosmeticsCRM_DIFF_${new Date().toISOString().slice(0,10).replace(/-/g,'')}" placeholder="Tên file">
        </div>
        <button class="btn btn-purple btn-full" onclick="runDiffBackup()">📊 Thực hiện Differential Backup</button>
      </div>
    </div>

    <!-- Restore Panel -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-title">♻️ Phục hồi CSDL (Restore)</div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        Sinh script phục hồi SQL Server: Full Backup (NORECOVERY) → Differential Backup (RECOVERY).
      </p>
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:14px;margin-bottom:16px">
        <p style="font-size:13px;color:#f87171;font-weight:600">⚠️ Kịch bản Test Giả lập Sự cố</p>
        <ol style="font-size:12px;color:var(--text-secondary);padding-left:20px;margin-top:8px;line-height:2">
          <li>Chạy Full Backup trước khi có sự cố</li>
          <li>Chạy Differential Backup sau khi có dữ liệu phát sinh</li>
          <li>Khi cần phục hồi, dùng script restore trong SSMS với quyền quản trị</li>
          <li>Restore Full Backup bằng NORECOVERY</li>
          <li>Restore Differential Backup bằng RECOVERY và kiểm tra dữ liệu</li>
        </ol>
      </div>
      <div class="form-row">
        <div class="form-group"><label>File Full Backup</label><input id="restore-full-file" value="CosmeticsCRM_FULL_${new Date().toISOString().slice(0,10).replace(/-/g,'')}"></div>
        <div class="form-group"><label>File Differential Backup</label><input id="restore-diff-file" value="CosmeticsCRM_DIFF_${new Date().toISOString().slice(0,10).replace(/-/g,'')}"></div>
      </div>
      <button class="btn btn-warning btn-full" onclick="generateRestoreScript()">🚨 Tạo Script Restore</button>
    </div>

    <!-- Existing Backups List -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>📁 File Sao lưu hiện có</span>
        <button class="btn btn-secondary btn-sm" onclick="loadBackupFiles()" style="font-size:11px">🔄 Làm mới</button>
      </div>
      <div id="backup-files-list">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Console Output -->
    <div class="card">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>💻 Console Output</span>
        <button class="btn btn-trash btn-sm" onclick="clearConsole()"><svg class="trash-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="margin-right:4px"><path d="M6 2v2H2v2h1v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6h1V4h-4V2h-2v2H9V2H6zm7 5v9h-2V7h2zM9 2V4h6V2H9z"/></svg> Xóa console</button>
      </div>
      <div class="db-console">
        <div class="db-console-output" id="db-console-output">
          <div class="db-console-line-info">-- BeautyCRM Database Management Console</div>
          <div class="db-console-line-info">-- Database: CosmeticsCRM_DB | Engine: Microsoft SQL Server Local</div>
          <div class="db-console-line-info">-- Sẵn sàng nhận lệnh...</div>
          <div>&nbsp;</div>
        </div>
      </div>
    </div>

    <!-- SQL Server Script Info -->
    <div class="card" style="margin-top:20px">
      <div class="card-title">📄 Script SQL Server cho Báo cáo</div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        Các file SQL chuẩn Microsoft SQL Server đã được tạo sẵn để sử dụng trong báo cáo:
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:14px">
          <p style="font-size:13px;font-weight:700;color:#60a5fa;margin-bottom:6px">📋 schema_sqlserver.sql</p>
          <p style="font-size:12px;color:var(--text-muted)">Tạo CSDL, các bảng CRM, ràng buộc, index và dữ liệu mẫu hoàn chỉnh</p>
        </div>
        <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:14px">
          <p style="font-size:13px;font-weight:700;color:#34d399;margin-bottom:6px">🔒 backup_restore.sql</p>
          <p style="font-size:12px;color:var(--text-muted)">Full Backup, Differential Backup & kịch bản test phục hồi bảng Feedbacks</p>
        </div>
      </div>
    </div>
  `;
  setPageContent(html);
  loadBackupFiles();
}

// ========== ADMIN: BACKUP FILES LIST ==========
async function loadBackupFiles() {
  const el = document.getElementById('backup-files-list');
  if (!el) return;
  el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/api/admin/database/backups');
    if (!data.backups || data.backups.length === 0) {
      el.innerHTML = `<p style="font-size:12px;color:var(--text-muted)">Chưa có file backup nào trong thư mục <code style="color:var(--rose-300)">${data.backup_dir}</code>. Hãy thực hiện Full Backup trước.</p>`;
      return;
    }
    el.innerHTML = `
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Thư mục: <code>${data.backup_dir}</code></p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left">
          <th style="font-size:11px;color:var(--text-muted);padding:4px 0">Tên file</th>
          <th style="font-size:11px;color:var(--text-muted);padding:4px 0">Dung lượng</th>
          <th style="font-size:11px;color:var(--text-muted);padding:4px 0">Ngày tạo</th>
        </tr></thead>
        <tbody>
          ${data.backups.map(b => `
            <tr>
              <td style="font-size:12px;padding:4px 0"><code style="color:var(--rose-300)">${b.name}</code></td>
              <td style="font-size:12px;color:var(--text-secondary)">${(b.size / 1024).toFixed(1)} KB</td>
              <td style="font-size:12px;color:var(--text-muted)">${formatDateTime(b.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    el.innerHTML = `<p class="error-msg" style="margin:0">${e.message}</p>`;
  }
}

// ========== ADMIN: DATABASE BACKUP/RESTORE CONSOLE ==========
function dbLog(msg, type = 'success') {
  const out = document.getElementById('db-console-output');
  if (!out) return;
  const div = document.createElement('div');
  div.className = `db-console-line-${type}`;
  div.textContent = `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

function clearConsole() {
  const out = document.getElementById('db-console-output');
  if (out) out.innerHTML = '<div class="db-console-line-info">-- Console đã được xóa.</div>';
}

async function runFullBackup() {
  const filename = document.getElementById('backup-filename').value || 'CosmeticsCRM_FULL';
  dbLog('=== BẮT ĐẦU FULL BACKUP ===', 'info');
  try {
    const result = await api('POST', '/api/admin/database/backup', { type: 'FULL', filename });
    dbLog(result.script, 'info');
    dbLog(`FULL BACKUP THÀNH CÔNG: ${result.path}`, 'success');
    toast('Full Backup hoàn thành!', 'success');
  } catch (e) {
    dbLog(`LỖI FULL BACKUP: ${e.message}`, 'error');
    toast(e.message, 'error');
  }
}

async function runDiffBackup() {
  const filename = document.getElementById('diff-filename').value || 'CosmeticsCRM_DIFF';
  dbLog('=== BẮT ĐẦU DIFFERENTIAL BACKUP ===', 'info');
  try {
    const result = await api('POST', '/api/admin/database/backup', { type: 'DIFFERENTIAL', filename });
    dbLog(result.script, 'info');
    dbLog(`DIFFERENTIAL BACKUP THÀNH CÔNG: ${result.path}`, 'success');
    toast('Differential Backup hoàn thành!', 'success');
  } catch (e) {
    dbLog(`LỖI DIFFERENTIAL BACKUP: ${e.message}`, 'error');
    toast(e.message, 'error');
  }
}

async function generateRestoreScript() {
  try {
    const result = await api('POST', '/api/admin/database/restore-script', {
      full_file: document.getElementById('restore-full-file').value,
      diff_file: document.getElementById('restore-diff-file').value,
    });
    dbLog('=== SCRIPT RESTORE SQL SERVER ===', 'info');
    result.script.split('\n').forEach(line => dbLog(line, 'warning'));
    toast('Đã tạo script Restore trong console', 'success');
  } catch (e) {
    dbLog(`LỖI TẠO SCRIPT RESTORE: ${e.message}`, 'error');
    toast(e.message, 'error');
  }
}
