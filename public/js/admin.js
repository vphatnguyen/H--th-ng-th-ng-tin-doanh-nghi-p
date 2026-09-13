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

function renderAccountsTable(accounts, searchParams = {}) {
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
                  <button class="btn btn-secondary btn-sm" onclick="openEditAccountModal(${JSON.stringify(a).split('"').join('&quot;')})">✏️</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteAccount(${a.id},'${a.full_name}')">🗑️</button>
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

async function fetchAndRenderProducts(filters) {
  productFilters = filters;
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    const products = await api('GET', `/api/admin/products?${params}`);
    const suppliers = await api('GET', '/api/admin/suppliers');

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
                    <button class="btn btn-secondary btn-sm" onclick='openEditProductModal(${JSON.stringify(p)})'>✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id},'${p.name.replace(/'/g,"\\'")}')">🗑️</button>
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

function renderSuppliersTable(suppliers) {
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
                  <button class="btn btn-secondary btn-sm" onclick='openEditSupplierModal(${JSON.stringify(s)})'>✏️</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteSupplier(${s.id},'${s.name.replace(/'/g,"\\'")}')">🗑️</button>
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
        <div class="stat-value">SQLite</div>
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
        <button class="btn btn-primary btn-full" onclick="simulateFullBackup()">🔒 Thực hiện Full Backup</button>
      </div>

      <!-- Differential Backup Panel -->
      <div class="card">
        <div class="card-title">📝 Differential Backup</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Sao lưu các thay đổi phát sinh từ lần Full Backup gần nhất. Thực hiện hàng ngày.</p>
        <div class="form-group" style="margin-bottom:14px">
          <label>Tên file differential</label>
          <input id="diff-filename" value="CosmeticsCRM_DIFF_${new Date().toISOString().slice(0,10).replace(/-/g,'')}" placeholder="Tên file">
        </div>
        <button class="btn btn-purple btn-full" onclick="simulateDiffBackup()">📊 Thực hiện Differential Backup</button>
      </div>
    </div>

    <!-- Restore Panel -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-title">♻️ Phục hồi CSDL (Restore)</div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        Mô phỏng kịch bản test giả lập sự cố: Mất dữ liệu bảng <code style="color:var(--rose-300)">Feedbacks</code> → Phục hồi từ bản backup.
      </p>
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:14px;margin-bottom:16px">
        <p style="font-size:13px;color:#f87171;font-weight:600">⚠️ Kịch bản Test Giả lập Sự cố</p>
        <ol style="font-size:12px;color:var(--text-secondary);padding-left:20px;margin-top:8px;line-height:2">
          <li>Ghi nhận số lượng Feedbacks hiện tại</li>
          <li>Giả lập sự cố: Xóa toàn bộ bảng Feedbacks</li>
          <li>Xác nhận sự cố (Feedbacks = 0)</li>
          <li>Thực thi Restore từ bản Full + Differential Backup</li>
          <li>Xác minh dữ liệu phục hồi thành công 100%</li>
        </ol>
      </div>
      <button class="btn btn-warning btn-full" onclick="simulateRestoreScenario()">🚨 Chạy Kịch bản Test Sự cố & Phục hồi</button>
    </div>

    <!-- Console Output -->
    <div class="card">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>💻 Console Output</span>
        <button class="btn btn-secondary btn-sm" onclick="clearConsole()">🗑️ Xóa console</button>
      </div>
      <div class="db-console">
        <div class="db-console-output" id="db-console-output">
          <div class="db-console-line-info">-- BeautyCRM Database Management Console</div>
          <div class="db-console-line-info">-- Database: CosmeticsCRM_DB | Engine: SQLite (WAL Mode)</div>
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
          <p style="font-size:12px;color:var(--text-muted)">Tạo CSDL, 9 bảng, ràng buộc, index và dữ liệu mẫu hoàn chỉnh</p>
        </div>
        <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:14px">
          <p style="font-size:13px;font-weight:700;color:#34d399;margin-bottom:6px">🔒 backup_restore.sql</p>
          <p style="font-size:12px;color:var(--text-muted)">Full Backup, Differential Backup & kịch bản test phục hồi bảng Feedbacks</p>
        </div>
      </div>
    </div>
  `;
  setPageContent(html);
}

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

function simulateFullBackup() {
  const filename = document.getElementById('backup-filename').value || 'CosmeticsCRM_FULL';
  dbLog('=== BẮT ĐẦU FULL BACKUP ===', 'info');
  dbLog(`BACKUP DATABASE CosmeticsCRM_DB TO DISK = 'C:\\CosmeticsCRM_Backup\\${filename}.bak'`, 'info');
  let pct = 0;
  const interval = setInterval(() => {
    pct += Math.floor(Math.random() * 15) + 10;
    if (pct >= 100) {
      pct = 100;
      clearInterval(interval);
      dbLog(`${pct}% tiến trình backup hoàn thành.`, 'success');
      dbLog(`✅ FULL BACKUP THÀNH CÔNG!`, 'success');
      dbLog(`   File: C:\\CosmeticsCRM_Backup\\${filename}.bak`, 'success');
      toast('Full Backup hoàn thành!', 'success');
    } else {
      dbLog(`${pct}% backup đã hoàn thành...`, 'warning');
    }
  }, 400);
}

function simulateDiffBackup() {
  const filename = document.getElementById('diff-filename').value || 'CosmeticsCRM_DIFF';
  dbLog('=== BẮT ĐẦU DIFFERENTIAL BACKUP ===', 'info');
  dbLog(`BACKUP DATABASE CosmeticsCRM_DB TO DISK = 'C:\\CosmeticsCRM_Backup\\${filename}.bak' WITH DIFFERENTIAL`, 'info');
  let pct = 0;
  const interval = setInterval(() => {
    pct += Math.floor(Math.random() * 20) + 15;
    if (pct >= 100) {
      pct = 100;
      clearInterval(interval);
      dbLog(`${pct}% tiến trình backup hoàn thành.`, 'success');
      dbLog(`✅ DIFFERENTIAL BACKUP THÀNH CÔNG!`, 'success');
      dbLog(`   Chỉ sao lưu các thay đổi phát sinh từ Full Backup gần nhất.`, 'success');
      toast('Differential Backup hoàn thành!', 'success');
    } else {
      dbLog(`${pct}% backup đã hoàn thành...`, 'warning');
    }
  }, 350);
}

async function simulateRestoreScenario() {
  if (!confirm('⚠️ Xác nhận chạy kịch bản test giả lập sự cố?\n\nĐây là mô phỏng quá trình: Mất dữ liệu → Phục hồi. Dữ liệu thực trong hệ thống web sẽ KHÔNG bị ảnh hưởng.')) return;

  const steps = [
    { msg: '=== BƯỚC 1: FULL BACKUP TRƯỚC SỰ CỐ ===', type: 'info', delay: 0 },
    { msg: 'BACKUP DATABASE CosmeticsCRM_DB TO DISK = \'C:\\CosmeticsCRM_Backup\\FULL_test.bak\'', type: 'info', delay: 500 },
    { msg: '✅ Full Backup hoàn thành thành công!', type: 'success', delay: 1200 },
    { msg: '', type: 'info', delay: 1400 },
    { msg: '=== BƯỚC 2: GIẢ LẬP DỮ LIỆU MỚI PHÁT SINH ===', type: 'info', delay: 1600 },
    { msg: 'INSERT INTO Feedbacks VALUES (khach010, product_1, 5, \'Son đẹp lắm!\', PENDING)', type: 'warning', delay: 2000 },
    { msg: '1 bản ghi mới được thêm vào bảng Feedbacks.', type: 'warning', delay: 2400 },
    { msg: '', type: 'info', delay: 2600 },
    { msg: '=== BƯỚC 3: DIFFERENTIAL BACKUP SAU KHI CÓ DỮ LIỆU MỚI ===', type: 'info', delay: 2800 },
    { msg: 'BACKUP DATABASE CosmeticsCRM_DB TO DISK = \'C:\\CosmeticsCRM_Backup\\DIFF_test.bak\' WITH DIFFERENTIAL', type: 'info', delay: 3200 },
    { msg: '✅ Differential Backup hoàn thành!', type: 'success', delay: 3800 },
    { msg: '', type: 'info', delay: 4000 },
    { msg: '=== BƯỚC 4: ⚠️ GIẢ LẬP SỰ CỐ THẢM HỌA ===', type: 'error', delay: 4200 },
    { msg: 'DELETE FROM Feedbacks; -- Xóa toàn bộ dữ liệu phản hồi!', type: 'error', delay: 4600 },
    { msg: '❌ SỰ CỐ: Bảng Feedbacks đã bị mất toàn bộ dữ liệu!', type: 'error', delay: 5000 },
    { msg: 'SELECT COUNT(*) FROM Feedbacks; => 0 bản ghi', type: 'error', delay: 5400 },
    { msg: '', type: 'info', delay: 5600 },
    { msg: '=== BƯỚC 5: THỰC THI PHỤC HỒI (RESTORE) ===', type: 'info', delay: 5800 },
    { msg: 'ALTER DATABASE CosmeticsCRM_DB SET SINGLE_USER WITH ROLLBACK IMMEDIATE', type: 'info', delay: 6200 },
    { msg: 'RESTORE DATABASE FROM FULL BACKUP (NORECOVERY)...', type: 'warning', delay: 6600 },
    { msg: '50% khôi phục từ Full Backup...', type: 'warning', delay: 7200 },
    { msg: '100% khôi phục từ Full Backup hoàn thành.', type: 'warning', delay: 7800 },
    { msg: 'RESTORE DATABASE FROM DIFFERENTIAL BACKUP (RECOVERY)...', type: 'warning', delay: 8200 },
    { msg: '100% khôi phục từ Differential Backup hoàn thành.', type: 'warning', delay: 8800 },
    { msg: 'ALTER DATABASE CosmeticsCRM_DB SET MULTI_USER', type: 'info', delay: 9200 },
    { msg: '', type: 'info', delay: 9400 },
    { msg: '=== BƯỚC 6: XÁC MINH KẾT QUẢ PHỤC HỒI ===', type: 'info', delay: 9600 },
    { msg: 'SELECT COUNT(*) FROM Feedbacks; => 11 bản ghi (Đã phục hồi 100%)', type: 'success', delay: 10000 },
    { msg: '', type: 'success', delay: 10200 },
    { msg: '✅✅✅ PHỤC HỒI DỮ LIỆU THÀNH CÔNG 100% ✅✅✅', type: 'success', delay: 10400 },
    { msg: '   Toàn bộ dữ liệu bảng Feedbacks đã được phục hồi nguyên vẹn.', type: 'success', delay: 10600 },
    { msg: '   Hệ thống hoạt động bình thường sau kịch bản sự cố.', type: 'success', delay: 10800 },
  ];

  steps.forEach(s => {
    setTimeout(() => {
      if (s.msg) dbLog(s.msg, s.type);
      else {
        const out = document.getElementById('db-console-output');
        if (out) { const div = document.createElement('div'); div.innerHTML = '&nbsp;'; out.appendChild(div); out.scrollTop = out.scrollHeight; }
      }
    }, s.delay);
  });

  setTimeout(() => toast('Kịch bản test phục hồi hoàn thành thành công!', 'success'), 11000);
}
