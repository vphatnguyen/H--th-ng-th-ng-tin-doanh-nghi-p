/* ============================================================
   manager.js – Manager Module: CRM Dashboard, Customers, Surveys, Feedbacks
   ============================================================ */

let chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

// ========== MANAGER: DASHBOARD ==========
async function renderManagerDashboard() {
  setPageHeader('📊 Dashboard CRM', 'Tổng quan & phân tích thị hiếu khách hàng làm đẹp');
  showLoading();
  try {
    const data = await api('GET', '/api/manager/analytics');
    const { ageGroups, skinTypes, beautyPrefs, stats } = data;

    const html = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">👩</div>
          <div class="stat-value">${stats.totalCustomers}</div>
          <div class="stat-label">Tổng khách hàng</div>
        </div>
        <div class="stat-card emerald">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${stats.activeCustomers}</div>
          <div class="stat-label">Đang hoạt động</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">🔒</div>
          <div class="stat-value">${stats.lockedCustomers}</div>
          <div class="stat-label">Tài khoản bị khóa</div>
        </div>
        <div class="stat-card gold">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">${stats.avgRating || '—'}</div>
          <div class="stat-label">Điểm hài lòng TB</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💬</div>
          <div class="stat-value">${stats.totalFeedbacks}</div>
          <div class="stat-label">Tổng phản hồi</div>
        </div>
        <div class="stat-card emerald">
          <div class="stat-icon">📋</div>
          <div class="stat-value">${stats.activeSurveys}</div>
          <div class="stat-label">Khảo sát đang mở</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">📝</div>
          <div class="stat-value">${stats.totalSurveyResponses}</div>
          <div class="stat-label">Lượt tham gia KS</div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-title">🎂 Phân bổ Độ tuổi Khách hàng</div>
          <div class="chart-container"><canvas id="chart-age"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">🧴 Phân loại Da (Loại da phổ biến)</div>
          <div class="chart-container"><canvas id="chart-skin"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">💅 Sở thích Làm đẹp</div>
          <div class="chart-container"><canvas id="chart-prefs"></canvas></div>
        </div>
      </div>
    `;
    setPageContent(html);

    // Render charts
    setTimeout(() => {
      const roseGrad = ['#f43f5e','#e11d48','#fb7185','#fda4af','#fecdd3'];
      const purpleGrad = ['#a855f7','#7c3aed','#c084fc','#d8b4fe','#ede9fe'];
      const gemPalette = ['#f43f5e','#a855f7','#10b981','#fbbf24','#60a5fa','#fb923c','#34d399','#e879f9'];

      destroyChart('age'); destroyChart('skin'); destroyChart('prefs');

      chartInstances['age'] = new Chart(document.getElementById('chart-age'), {
        type: 'doughnut',
        data: {
          labels: ageGroups.map(g => g.age_group),
          datasets: [{ data: ageGroups.map(g => g.count), backgroundColor: gemPalette, borderColor: 'transparent', borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 14 } } } }
      });

      chartInstances['skin'] = new Chart(document.getElementById('chart-skin'), {
        type: 'bar',
        data: {
          labels: skinTypes.map(s => s.skin_type),
          datasets: [{ data: skinTypes.map(s => s.count), backgroundColor: roseGrad, borderRadius: 8, borderSkipped: false }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(203,213,225,0.05)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } }
          }
        }
      });

      chartInstances['prefs'] = new Chart(document.getElementById('chart-prefs'), {
        type: 'polarArea',
        data: {
          labels: beautyPrefs.map(p => p.pref),
          datasets: [{ data: beautyPrefs.map(p => p.count), backgroundColor: gemPalette.map(c => c + 'cc'), borderColor: 'transparent' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 } } }, scales: { r: { grid: { color: 'rgba(203,213,225,0.08)' }, ticks: { display: false } } } }
      });
    }, 50);
  } catch (e) { toast(e.message, 'error'); }
}

// ========== MANAGER: CUSTOMERS ==========
async function renderManagerCustomers() {
  setPageHeader('👩 Quản lý Khách hàng', 'Thêm, xóa, khóa và theo dõi hồ sơ khách hàng',
    `<button class="btn btn-primary" onclick="openCreateCustomerModal()">➕ Thêm khách hàng</button>`);
  showLoading();
  await fetchAndRenderCustomers({});
}

async function fetchAndRenderCustomers(filters) {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    const customers = await api('GET', `/api/manager/customers?${params}`);

    const skinOptions = ['Da dầu','Da khô','Da hỗn hợp','Da nhạy cảm','Da thường']
      .map(s => `<option value="${s}" ${filters.skin_type === s ? 'selected' : ''}>${s}</option>`).join('');

    const html = `
      <div class="filter-bar">
        <input type="text" id="cust-search" placeholder="🔍 Tên, username, số điện thoại..." value="${filters.search || ''}">
        <select id="cust-skin"><option value="">Tất cả loại da</option>${skinOptions}</select>
        <select id="cust-status">
          <option value="">Tất cả</option>
          <option value="ACTIVE" ${filters.status === 'ACTIVE' ? 'selected' : ''}>✓ Hoạt động</option>
          <option value="LOCKED" ${filters.status === 'LOCKED' ? 'selected' : ''}>🔒 Bị khóa</option>
        </select>
        <button class="btn btn-primary" onclick="filterCustomers()">🔍 Lọc</button>
        <button class="btn btn-secondary" onclick="renderManagerCustomers()">↺ Reset</button>
      </div>

      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Khách hàng</th><th>Liên hệ</th><th>Độ tuổi</th><th>Loại da</th>
            <th>Sở thích</th><th>Hạng</th><th>Trạng thái</th><th>Ngày ĐK</th><th>Hành động</th>
          </tr></thead>
          <tbody>
            ${customers.length === 0 ? `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">Không tìm thấy khách hàng</td></tr>` : customers.map(c => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="user-avatar" style="width:34px;height:34px;font-size:13px">${c.full_name.charAt(0)}</div>
                    <div>
                      <div style="font-weight:600">${c.full_name}</div>
                      <div style="font-size:11px;color:var(--text-muted)">@${c.username}</div>
                    </div>
                  </div>
                </td>
                <td style="font-size:12px;color:var(--text-secondary)">${c.email || c.phone || '—'}</td>
                <td style="text-align:center">${c.age ? `<strong>${c.age}</strong> tuổi` : '—'}</td>
                <td>${c.skin_type ? `<span class="tag" style="font-size:11px">${c.skin_type}</span>` : '—'}</td>
                <td style="max-width:160px">
                  <div class="tag-list">
                    ${c.beauty_preferences ? c.beauty_preferences.split(',').slice(0,2).map(p => `<span class="tag" style="font-size:10px">${p.trim()}</span>`).join('') : '—'}
                  </div>
                </td>
                <td>${membershipBadge(c.membership_tier)}</td>
                <td>${statusBadge(c.status)}</td>
                <td style="font-size:11px;color:var(--text-muted)">${formatDate(c.created_at)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    ${c.status === 'ACTIVE'
                      ? `<button class="btn btn-warning btn-sm" onclick="toggleCustomerStatus(${c.id},'LOCKED','${c.full_name.replace(/'/g,"\\'")}')">🔒</button>`
                      : `<button class="btn btn-success btn-sm" onclick="toggleCustomerStatus(${c.id},'ACTIVE','${c.full_name.replace(/'/g,"\\'")}')">🔓</button>`
                    }
                    <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id},'${c.full_name.replace(/'/g,"\\'")}')">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-top:10px">Tổng: ${customers.length} khách hàng</p>
    `;
    setPageContent(html);
  } catch (e) { toast(e.message, 'error'); }
}

function filterCustomers() {
  fetchAndRenderCustomers({
    search: document.getElementById('cust-search').value.trim(),
    skin_type: document.getElementById('cust-skin').value,
    status: document.getElementById('cust-status').value,
  });
}

function openCreateCustomerModal() {
  showModal('➕ Thêm khách hàng mới', `
    <div class="form-row">
      <div class="form-group"><label>Tên đăng nhập *</label><input id="mc-username" placeholder="username"></div>
      <div class="form-group"><label>Mật khẩu *</label><input id="mc-password" type="password" placeholder="Mật khẩu"></div>
    </div>
    <div class="form-group"><label>Họ và tên *</label><input id="mc-fullname" placeholder="Họ và tên đầy đủ"></div>
    <div class="form-row">
      <div class="form-group"><label>Email</label><input id="mc-email" type="email"></div>
      <div class="form-group"><label>Số điện thoại</label><input id="mc-phone"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Độ tuổi</label><input id="mc-age" type="number" min="13" max="100"></div>
      <div class="form-group"><label>Giới tính</label>
        <select id="mc-gender"><option value="">--</option><option value="Nu">Nữ</option><option value="Nam">Nam</option><option value="Khac">Khác</option></select>
      </div>
    </div>
    <div class="form-group"><label>Loại da</label>
      <select id="mc-skin">
        <option value="">-- Chọn loại da --</option>
        ${['Da dầu','Da khô','Da hỗn hợp','Da nhạy cảm','Da thường'].map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="createCustomer()">✅ Thêm khách hàng</button>
    </div>
  `);
}

async function createCustomer() {
  try {
    await api('POST', '/api/manager/customers', {
      username: document.getElementById('mc-username').value.trim(),
      password: document.getElementById('mc-password').value,
      full_name: document.getElementById('mc-fullname').value.trim(),
      email: document.getElementById('mc-email').value.trim(),
      phone: document.getElementById('mc-phone').value.trim(),
      age: Number(document.getElementById('mc-age').value) || null,
      gender: document.getElementById('mc-gender').value || null,
      skin_type: document.getElementById('mc-skin').value || null,
    });
    toast('Thêm khách hàng thành công!', 'success');
    closeModal();
    renderManagerCustomers();
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleCustomerStatus(accountId, newStatus, name) {
  const action = newStatus === 'LOCKED' ? 'khóa' : 'mở khóa';
  if (!confirm(`Xác nhận ${action} tài khoản của "${name}"?`)) return;
  try {
    await api('PUT', `/api/manager/customers/${accountId}/status`, { status: newStatus });
    toast(newStatus === 'LOCKED' ? `Đã khóa tài khoản ${name}` : `Đã mở khóa tài khoản ${name}`, 'success');
    renderManagerCustomers();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteCustomer(accountId, name) {
  if (!confirm(`Xác nhận xóa tài khoản khách hàng "${name}"?`)) return;
  try {
    await api('DELETE', `/api/manager/customers/${accountId}`);
    toast('Đã xóa khách hàng', 'success');
    renderManagerCustomers();
  } catch (e) { toast(e.message, 'error'); }
}

// ========== MANAGER: SURVEYS ==========
async function renderManagerSurveys() {
  setPageHeader('📋 Chiến dịch Khảo sát', 'Tạo và quản lý khảo sát thị hiếu sản phẩm mới',
    `<button class="btn btn-primary" onclick="openCreateSurveyModal()">➕ Tạo khảo sát mới</button>`);
  showLoading();
  try {
    const surveys = await api('GET', '/api/manager/surveys');
    const html = `
      <div class="survey-list">
        ${surveys.length === 0 ? `<div class="page-empty"><div class="empty-icon">📋</div><p>Chưa có chiến dịch khảo sát nào</p></div>` : surveys.map(s => `
          <div class="survey-card">
            <div class="survey-icon">📋</div>
            <div class="survey-info">
              <div class="survey-title">${s.title}</div>
              <div class="survey-meta">
                ${surveyStatusBadge(s.status)}
                ${s.product_name ? `&nbsp;📦 ${s.product_name}` : ''}
                &nbsp;· 📝 ${s.question_count} câu hỏi
                &nbsp;· 👥 ${s.response_count} phản hồi
                ${s.start_date ? `&nbsp;· 📅 ${formatDate(s.start_date)} → ${formatDate(s.end_date)}` : ''}
              </div>
            </div>
            <div class="survey-actions">
              <button class="btn btn-secondary btn-sm" onclick="viewSurveyResults(${s.id},'${s.title.replace(/'/g,"\\'")}')">📊 Kết quả</button>
              ${s.status === 'DRAFT' ? `<button class="btn btn-success btn-sm" onclick="updateSurveyStatus(${s.id},'ACTIVE')">▶️ Kích hoạt</button>` : ''}
              ${s.status === 'ACTIVE' ? `<button class="btn btn-warning btn-sm" onclick="updateSurveyStatus(${s.id},'CLOSED')">⏹️ Đóng</button>` : ''}
              ${s.status === 'CLOSED' ? `<span class="badge badge-closed">Đã đóng</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    setPageContent(html);
  } catch (e) { toast(e.message, 'error'); }
}

async function openCreateSurveyModal() {
  const products = await api('GET', '/api/products?launch_status=UPCOMING').catch(() => []);
  const prodOptions = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  showModal('➕ Tạo chiến dịch khảo sát mới', `
    <div class="form-group"><label>Tiêu đề khảo sát *</label><input id="sv-title" placeholder="VD: Khảo sát thị hiếu Son môi Hè 2026"></div>
    <div class="form-group"><label>Sản phẩm sắp ra mắt (tùy chọn)</label>
      <select id="sv-product"><option value="">-- Chọn sản phẩm --</option>${prodOptions}</select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Ngày bắt đầu</label><input id="sv-start" type="date"></div>
      <div class="form-group"><label>Ngày kết thúc</label><input id="sv-end" type="date"></div>
    </div>
    <div class="form-group"><label>Mô tả</label><textarea id="sv-desc" placeholder="Mô tả mục tiêu chiến dịch khảo sát..."></textarea></div>

    <div style="border-top:1px solid var(--border);margin:8px 0;padding-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <strong style="font-size:14px">📝 Danh sách câu hỏi</strong>
        <button class="btn btn-secondary btn-sm" onclick="addSurveyQuestion()">➕ Thêm câu hỏi</button>
      </div>
      <div id="questions-container" style="display:flex;flex-direction:column;gap:12px"></div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-purple" onclick="createSurvey('DRAFT')">💾 Lưu nháp</button>
      <button class="btn btn-primary" onclick="createSurvey('ACTIVE')">▶️ Tạo & Kích hoạt</button>
    </div>
  `, true);

  addSurveyQuestion();
}

let questionCount = 0;
function addSurveyQuestion() {
  questionCount++;
  const container = document.getElementById('questions-container');
  if (!container) return;
  const div = document.createElement('div');
  div.id = `q-block-${questionCount}`;
  div.style.cssText = 'background:rgba(15,23,42,0.5);border:1px solid var(--border);border-radius:10px;padding:14px';
  div.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:10px">
      <input placeholder="Nội dung câu hỏi ${questionCount}..." id="q-text-${questionCount}" style="flex:1">
      <select id="q-type-${questionCount}" onchange="toggleOptionsField(${questionCount})" style="width:160px">
        <option value="SINGLE_CHOICE">Một lựa chọn</option>
        <option value="MULTI_CHOICE">Nhiều lựa chọn</option>
        <option value="RATING">Đánh giá sao</option>
        <option value="TEXT">Nhập văn bản</option>
      </select>
      <button class="btn btn-danger btn-sm btn-icon" onclick="removeQuestion(${questionCount})">✕</button>
    </div>
    <div id="q-options-wrap-${questionCount}">
      <input placeholder="Các lựa chọn, phân tách bằng dấu phẩy. VD: Lựa chọn A, Lựa chọn B, Lựa chọn C" id="q-options-${questionCount}">
    </div>
  `;
  container.appendChild(div);
}

function removeQuestion(n) {
  const el = document.getElementById(`q-block-${n}`);
  if (el) el.remove();
}

function toggleOptionsField(n) {
  const type = document.getElementById(`q-type-${n}`).value;
  const wrap = document.getElementById(`q-options-wrap-${n}`);
  if (wrap) wrap.style.display = (type === 'RATING' || type === 'TEXT') ? 'none' : 'block';
}

async function createSurvey(status) {
  const questions = [];
  document.querySelectorAll('[id^="q-block-"]').forEach((block) => {
    const n = block.id.replace('q-block-', '');
    const text = document.getElementById(`q-text-${n}`)?.value.trim();
    const type = document.getElementById(`q-type-${n}`)?.value;
    const optionsRaw = document.getElementById(`q-options-${n}`)?.value || '';
    if (!text) return;
    const options = (type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE')
      ? optionsRaw.split(',').map(o => o.trim()).filter(Boolean) : null;
    questions.push({ question_text: text, question_type: type, options });
  });

  try {
    const result = await api('POST', '/api/manager/surveys', {
      title: document.getElementById('sv-title').value.trim(),
      description: document.getElementById('sv-desc').value.trim(),
      target_product_id: document.getElementById('sv-product').value || null,
      start_date: document.getElementById('sv-start').value || null,
      end_date: document.getElementById('sv-end').value || null,
      questions,
    });

    if (status === 'ACTIVE') {
      await api('PUT', `/api/manager/surveys/${result.id}/status`, { status: 'ACTIVE' });
    }
    toast('Tạo chiến dịch khảo sát thành công!', 'success');
    questionCount = 0;
    closeModal();
    renderManagerSurveys();
  } catch (e) { toast(e.message, 'error'); }
}

async function updateSurveyStatus(id, status) {
  try {
    await api('PUT', `/api/manager/surveys/${id}/status`, { status });
    toast(`Đã cập nhật trạng thái khảo sát`, 'success');
    renderManagerSurveys();
  } catch (e) { toast(e.message, 'error'); }
}

async function viewSurveyResults(id, title) {
  showModal(`📊 Kết quả: ${title}`, `<div class="loading-spinner"><div class="spinner"></div></div>`, true);
  try {
    const data = await api('GET', `/api/manager/surveys/${id}/results`);
    const { results, total_respondents } = data;

    let body = `<div style="margin-bottom:16px"><strong>👥 Tổng số người tham gia: <span style="color:var(--rose-300)">${total_respondents}</span></strong></div>`;

    results.forEach((r, i) => {
      body += `<div style="background:rgba(15,23,42,0.5);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-primary)">
          ${i + 1}. ${r.question_text}
          <span style="color:var(--text-muted);font-weight:400;font-size:11px">&nbsp;(${r.total_responses} phản hồi)</span>
        </div>`;

      if (r.question_type === 'RATING') {
        body += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="font-size:28px;font-weight:800;background:var(--grad-gold);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${r.average || '—'}</div>
          <div style="font-size:18px;color:#fbbf24">${r.average ? '★'.repeat(Math.round(r.average)) + '☆'.repeat(5 - Math.round(r.average)) : ''}</div>
          <div style="font-size:12px;color:var(--text-muted)">Điểm trung bình</div>
        </div>`;
        if (r.distribution) {
          r.distribution.forEach(d => {
            const pct = r.total_responses ? ((d.count / r.total_responses) * 100).toFixed(0) : 0;
            body += `<div class="result-bar-wrap">
              <div class="result-bar-label"><span>⭐ ${d.value} sao (${d.count})</span><span>${pct}%</span></div>
              <div class="result-bar"><div class="result-bar-fill" style="width:${pct}%;background:var(--grad-gold)"></div></div>
            </div>`;
          });
        }
      } else if (r.distribution) {
        r.distribution.forEach(d => {
          body += `<div class="result-bar-wrap">
            <div class="result-bar-label"><span>${d.label} (${d.count})</span><span>${d.percent}%</span></div>
            <div class="result-bar"><div class="result-bar-fill" style="width:${d.percent}%"></div></div>
          </div>`;
        });
      } else if (r.text_answers && r.text_answers.length > 0) {
        body += `<div style="display:flex;flex-direction:column;gap:6px">`;
        r.text_answers.forEach(ans => {
          body += `<div style="background:rgba(244,63,94,0.06);border-left:3px solid var(--rose-500);padding:8px 12px;border-radius:0 8px 8px 0;font-size:13px;color:var(--text-secondary)">"${ans}"</div>`;
        });
        body += `</div>`;
      }
      body += `</div>`;
    });

    if (results.length === 0) body += `<div class="page-empty"><div class="empty-icon">📊</div><p>Chưa có dữ liệu kết quả</p></div>`;

    document.getElementById('modal-body').innerHTML = body;
  } catch (e) {
    document.getElementById('modal-body').innerHTML = `<p class="error-msg">${e.message}</p>`;
  }
}

// ========== MANAGER: FEEDBACKS ==========
async function renderManagerFeedbacks() {
  setPageHeader('💬 Phản hồi & Đánh giá', 'Tiếp nhận và phản hồi đánh giá từ khách hàng');
  showLoading();
  await fetchAndRenderFeedbacks({});
}

async function fetchAndRenderFeedbacks(filters) {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    const feedbacks = await api('GET', `/api/manager/feedbacks?${params}`);

    const html = `
      <div class="filter-bar">
        <select id="fb-rating">
          <option value="">Tất cả số sao</option>
          ${[5,4,3,2,1].map(n => `<option value="${n}" ${filters.rating == n ? 'selected' : ''}>⭐ ${n} sao</option>`).join('')}
        </select>
        <select id="fb-status">
          <option value="">Tất cả</option>
          <option value="PENDING" ${filters.status === 'PENDING' ? 'selected' : ''}>🕐 Chờ phản hồi</option>
          <option value="REPLIED" ${filters.status === 'REPLIED' ? 'selected' : ''}>✅ Đã phản hồi</option>
        </select>
        <button class="btn btn-primary" onclick="filterFeedbacks()">🔍 Lọc</button>
        <button class="btn btn-secondary" onclick="renderManagerFeedbacks()">↺ Reset</button>
      </div>

      <div class="feedback-list">
        ${feedbacks.length === 0 ? `<div class="page-empty"><div class="empty-icon">💬</div><p>Không có phản hồi nào</p></div>` : feedbacks.map(f => `
          <div class="feedback-card">
            <div class="feedback-header">
              <div class="feedback-meta">
                <div class="feedback-customer">👩 ${f.customer_name}</div>
                <div class="feedback-product">💄 ${f.product_name}</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <div class="stars">${renderStars(f.rating)}</div>
                ${f.status === 'PENDING'
                  ? `<span class="badge badge-pending">🕐 Chờ phản hồi</span>`
                  : `<span class="badge badge-replied">✅ Đã phản hồi</span>`}
                <span style="font-size:11px;color:var(--text-muted)">${formatDateTime(f.created_at)}</span>
              </div>
            </div>
            <p class="feedback-content">${f.content || '(Không có nội dung)'}</p>
            ${f.reply_content ? `
              <div class="feedback-reply">
                <div class="feedback-reply-label">💬 Phản hồi của bộ phận CSKH:</div>
                <div class="feedback-reply-text">${f.reply_content}</div>
              </div>
            ` : `
              <div style="display:flex;gap:8px;margin-top:8px">
                <textarea id="reply-${f.id}" placeholder="Nhập nội dung phản hồi cho khách hàng..." style="flex:1;min-height:60px"></textarea>
                <button class="btn btn-success btn-sm" onclick="replyFeedback(${f.id})">📤 Gửi</button>
              </div>
            `}
          </div>
        `).join('')}
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-top:12px">Hiển thị ${feedbacks.length} phản hồi</p>
    `;
    setPageContent(html);
  } catch (e) { toast(e.message, 'error'); }
}

function filterFeedbacks() {
  fetchAndRenderFeedbacks({
    rating: document.getElementById('fb-rating').value,
    status: document.getElementById('fb-status').value,
  });
}

async function replyFeedback(id) {
  const content = document.getElementById(`reply-${id}`)?.value.trim();
  if (!content) { toast('Vui lòng nhập nội dung phản hồi', 'error'); return; }
  try {
    await api('PUT', `/api/manager/feedbacks/${id}/reply`, { reply_content: content });
    toast('Đã gửi phản hồi thành công!', 'success');
    renderManagerFeedbacks();
  } catch (e) { toast(e.message, 'error'); }
}
