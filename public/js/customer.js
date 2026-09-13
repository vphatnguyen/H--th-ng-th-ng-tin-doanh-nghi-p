/* ============================================================
   customer.js – Customer Module: Home, Surveys, Feedback, Profile
   ============================================================ */

// ========== CUSTOMER: HOME ==========
async function renderCustomerHome() {
  setPageHeader('🏠 Trang chủ', `Chào mừng trở lại, ${state.user.full_name}! 🌸`);
  showLoading();
  try {
    const [profile, products, surveys] = await Promise.all([
      api('GET', '/api/customer/profile'),
      api('GET', '/api/customer/products'),
      api('GET', '/api/customer/surveys'),
    ]);
    const { customer } = profile;
    const upcomingProducts = products.filter(p => p.launch_status === 'UPCOMING');
    const pendingSurveys = surveys.filter(s => s.already_submitted === 0);

    const html = `
      <!-- Welcome Banner -->
      <div style="background:linear-gradient(135deg,rgba(244,63,94,0.15),rgba(168,85,247,0.1));border:1px solid rgba(244,63,94,0.2);border-radius:var(--radius-xl);padding:28px;margin-bottom:24px;position:relative;overflow:hidden">
        <div style="position:absolute;right:20px;top:50%;transform:translateY(-50%);font-size:80px;opacity:0.15">🌸</div>
        <div style="position:relative">
          <h2 style="font-size:22px;font-weight:800;margin-bottom:6px">Chào mừng, ${state.user.full_name}! 👋</h2>
          <p style="color:var(--text-secondary);font-size:14px">
            ${customer ? `Hạng thành viên: ${membershipBadge(customer.membership_tier)}` : 'Hãy cập nhật hồ sơ làm đẹp của bạn!'}
            ${pendingSurveys.length > 0 ? `&nbsp;· <span style="color:var(--rose-300);font-weight:600">📋 ${pendingSurveys.length} khảo sát đang chờ bạn!</span>` : ''}
          </p>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-value">${pendingSurveys.length}</div>
          <div class="stat-label">Khảo sát chờ làm</div>
        </div>
        <div class="stat-card emerald">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${upcomingProducts.length}</div>
          <div class="stat-label">Sản phẩm sắp ra mắt</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">🧴</div>
          <div class="stat-value">${products.filter(p => p.launch_status === 'OFFICIAL').length}</div>
          <div class="stat-label">Sản phẩm hiện có</div>
        </div>
      </div>

      <!-- Upcoming Products to Survey -->
      ${upcomingProducts.length > 0 ? `
        <div style="margin-bottom:28px">
          <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px">
            ⏳ Sản phẩm sắp ra mắt <span style="font-size:12px;color:var(--text-muted);font-weight:400">– Tham gia khảo sát để định hình sản phẩm!</span>
          </h3>
          <div class="products-grid">
            ${upcomingProducts.map(p => `
              <div class="product-card">
                <div class="product-card-img">${getCategoryIcon(p.category)}</div>
                <div class="product-card-body">
                  <div class="product-card-cat">${p.category}</div>
                  <div class="product-card-name">${p.name}</div>
                  <div style="margin:8px 0">${launchBadge(p.launch_status)}</div>
                  <div class="product-card-price">${p.price ? formatCurrency(p.price) : 'Chưa định giá'}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Active Surveys Quick Access -->
      ${pendingSurveys.length > 0 ? `
        <div style="margin-bottom:28px">
          <h3 style="font-size:15px;font-weight:700;margin-bottom:16px">📋 Khảo sát đang chờ bạn</h3>
          <div class="survey-list">
            ${pendingSurveys.slice(0, 3).map(s => `
              <div class="survey-card">
                <div class="survey-icon">📋</div>
                <div class="survey-info">
                  <div class="survey-title">${s.title}</div>
                  <div class="survey-meta">${s.product_name ? `📦 ${s.product_name} · ` : ''}📝 ${s.question_count} câu hỏi · ${surveyStatusBadge(s.status)}</div>
                </div>
                <div class="survey-actions">
                  <button class="btn btn-primary btn-sm" onclick="startSurvey(${s.id},'${s.title.replace(/'/g,"\\'")}')">Làm ngay ▶️</button>
                </div>
              </div>
            `).join('')}
          </div>
          ${pendingSurveys.length > 3 ? `<p style="text-align:center;margin-top:10px"><a href="#" onclick="navigate('customer-surveys')">Xem tất cả ${pendingSurveys.length} khảo sát →</a></p>` : ''}
        </div>
      ` : ''}

      <!-- All Products Browse -->
      <div>
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px">💄 Khám phá sản phẩm</h3>
        <div class="products-grid">
          ${products.filter(p => p.launch_status === 'OFFICIAL').slice(0, 8).map(p => `
            <div class="product-card" onclick="openFeedbackModal(${p.id},'${p.name.replace(/'/g,"\\'")}')">
              <div class="product-card-img">${getCategoryIcon(p.category)}</div>
              <div class="product-card-body">
                <div class="product-card-cat">${p.category}</div>
                <div class="product-card-name">${p.name}</div>
                <div class="product-card-price">${formatCurrency(p.price)}</div>
                <div style="margin-top:8px">
                  <button class="btn btn-secondary btn-sm" style="width:100%;font-size:11px" onclick="openFeedbackModal(${p.id},'${p.name.replace(/'/g,"\\'")}');event.stopPropagation()">💬 Gửi đánh giá</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    setPageContent(html);
  } catch (e) { toast(e.message, 'error'); }
}

// ========== CUSTOMER: SURVEYS ==========
async function renderCustomerSurveys() {
  setPageHeader('📋 Bài khảo sát của tôi', 'Tham gia khảo sát để giúp chúng tôi cải thiện sản phẩm');
  showLoading();
  try {
    const surveys = await api('GET', '/api/customer/surveys');
    const html = `
      <div class="survey-list">
        ${surveys.length === 0 ? `
          <div class="page-empty">
            <div class="empty-icon">📋</div>
            <p>Hiện không có khảo sát nào đang mở</p>
          </div>
        ` : surveys.map(s => `
          <div class="survey-card">
            <div class="survey-icon">${s.already_submitted > 0 ? '✅' : '📋'}</div>
            <div class="survey-info">
              <div class="survey-title">${s.title}</div>
              <div class="survey-meta">
                ${surveyStatusBadge(s.status)}
                ${s.product_name ? `&nbsp;· 📦 ${s.product_name}` : ''}
                &nbsp;· 📝 ${s.question_count} câu hỏi
                ${s.end_date ? `&nbsp;· 🕐 Hạn: ${formatDate(s.end_date)}` : ''}
              </div>
              ${s.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${s.description}</div>` : ''}
            </div>
            <div class="survey-actions">
              ${s.already_submitted > 0
                ? `<span class="badge badge-active">✅ Đã hoàn thành</span>`
                : `<button class="btn btn-primary btn-sm" onclick="startSurvey(${s.id},'${s.title.replace(/'/g,"\\'")}')">▶️ Làm khảo sát</button>`
              }
            </div>
          </div>
        `).join('')}
      </div>
    `;
    setPageContent(html);
  } catch (e) { toast(e.message, 'error'); }
}

async function startSurvey(id, title) {
  showModal(`📋 ${title}`, `<div class="loading-spinner"><div class="spinner"></div></div>`, true);
  try {
    const data = await api('GET', `/api/customer/surveys/${id}`);
    const { survey, questions } = data;

    let body = `
      <div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.15);border-radius:10px;padding:14px;margin-bottom:16px">
        <p style="font-size:13px;color:var(--text-secondary)">${survey.description || 'Cảm ơn bạn đã tham gia khảo sát!'}</p>
        ${survey.product_name ? `<p style="font-size:12px;color:var(--text-muted);margin-top:4px">📦 Sản phẩm: <strong>${survey.product_name}</strong></p>` : ''}
      </div>
      <form id="survey-form">
    `;

    questions.forEach((q, i) => {
      body += `<div style="background:rgba(15,23,42,0.5);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;line-height:1.5">${i + 1}. ${q.question_text}</div>`;

      if (q.question_type === 'SINGLE_CHOICE' && Array.isArray(q.options)) {
        body += `<div style="display:flex;flex-direction:column;gap:8px">`;
        q.options.forEach((opt, oi) => {
          body += `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border-radius:8px;border:1px solid var(--border);transition:all 0.15s;font-size:13px" onclick="this.style.borderColor='var(--rose-400)';this.style.background='rgba(244,63,94,0.08)';document.querySelectorAll('[name=q${q.id}]').forEach(r=>r.checked=false)">
            <input type="radio" name="q${q.id}" value="${opt}" style="accent-color:var(--rose-500)"> ${opt}
          </label>`;
        });
        body += `</div>`;
      } else if (q.question_type === 'MULTI_CHOICE' && Array.isArray(q.options)) {
        body += `<div style="display:flex;flex-direction:column;gap:8px">`;
        q.options.forEach(opt => {
          body += `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border-radius:8px;border:1px solid var(--border);font-size:13px">
            <input type="checkbox" name="q${q.id}" value="${opt}" style="accent-color:var(--rose-500)"> ${opt}
          </label>`;
        });
        body += `</div>`;
      } else if (q.question_type === 'RATING') {
        body += `<div style="display:flex;gap:6px">`;
        for (let s = 1; s <= 5; s++) {
          body += `<label style="cursor:pointer;font-size:28px;color:var(--slate-600);transition:color 0.15s" title="${s} sao" onclick="selectStar(this,${q.id},${s})">
            <input type="radio" name="q${q.id}" value="${s}" style="display:none"> ⭐
          </label>`;
        }
        body += `</div>`;
      } else if (q.question_type === 'TEXT') {
        body += `<textarea name="q${q.id}" placeholder="Chia sẻ ý kiến của bạn..." style="width:100%;min-height:80px"></textarea>`;
      }
      body += `</div>`;
    });

    body += `
      </form>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="submitSurvey(${id})">📤 Nộp khảo sát</button>
      </div>
    `;

    document.getElementById('modal-body').innerHTML = body;
  } catch (e) {
    document.getElementById('modal-body').innerHTML = `<p class="error-msg">${e.message}</p>`;
  }
}

function selectStar(label, qid, value) {
  const labels = document.querySelectorAll(`[name=q${qid}]`);
  labels.forEach((input, i) => {
    const parentLabel = input.closest('label') || input.parentElement;
    parentLabel.style.color = i < value ? '#fbbf24' : 'var(--slate-600)';
  });
}

async function submitSurvey(surveyId) {
  const form = document.getElementById('survey-form');
  if (!form) return;

  const answers = [];
  const allNames = new Set([...form.querySelectorAll('[name]')].map(el => el.getAttribute('name')));

  allNames.forEach(name => {
    const qid = parseInt(name.replace('q', ''));
    const inputs = form.querySelectorAll(`[name="${name}"]`);

    if (inputs.length === 0) return;
    const type = inputs[0].type;

    if (type === 'radio') {
      const checked = form.querySelector(`[name="${name}"]:checked`);
      if (checked) answers.push({ question_id: qid, answer_value: checked.value });
    } else if (type === 'checkbox') {
      const vals = [...form.querySelectorAll(`[name="${name}"]:checked`)].map(el => el.value);
      if (vals.length > 0) answers.push({ question_id: qid, answer_value: vals });
    } else if (type === 'textarea' || inputs[0].tagName === 'TEXTAREA') {
      const val = inputs[0].value.trim();
      if (val) answers.push({ question_id: qid, answer_value: val });
    }
  });

  // Also handle textarea elements with name attribute
  form.querySelectorAll('textarea[name]').forEach(ta => {
    if (ta.value.trim()) {
      const qid = parseInt(ta.name.replace('q', ''));
      if (!answers.find(a => a.question_id === qid)) {
        answers.push({ question_id: qid, answer_value: ta.value.trim() });
      }
    }
  });

  try {
    const result = await api('POST', `/api/customer/surveys/${surveyId}/submit`, { answers });
    closeModal();
    toast(result.message, 'success');
    navigate('customer-surveys');
  } catch (e) { toast(e.message, 'error'); }
}

// ========== CUSTOMER: FEEDBACK ==========
async function renderCustomerFeedback() {
  setPageHeader('💬 Phản hồi của tôi', 'Quản lý đánh giá sản phẩm bạn đã gửi',
    `<button class="btn btn-primary" onclick="openNewFeedbackModal()">➕ Gửi đánh giá mới</button>`);
  showLoading();
  try {
    const feedbacks = await api('GET', '/api/customer/feedbacks');
    const html = `
      <div class="feedback-list">
        ${feedbacks.length === 0 ? `
          <div class="page-empty">
            <div class="empty-icon">💬</div>
            <p>Bạn chưa gửi đánh giá nào.<br><a href="#" onclick="openNewFeedbackModal()">Gửi đánh giá ngay!</a></p>
          </div>
        ` : feedbacks.map(f => `
          <div class="feedback-card">
            <div class="feedback-header">
              <div class="feedback-meta">
                <div class="feedback-customer">💄 ${f.product_name}</div>
                <div class="feedback-product" style="font-size:11px;color:var(--text-muted)">${formatDateTime(f.created_at)}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="stars" style="color:#fbbf24">${renderStars(f.rating)}</div>
                ${f.status === 'REPLIED'
                  ? `<span class="badge badge-replied">✅ Đã được phản hồi</span>`
                  : `<span class="badge badge-pending">🕐 Chờ phản hồi</span>`}
              </div>
            </div>
            <p class="feedback-content">${f.content || '(Không có nội dung)'}</p>
            ${f.reply_content ? `
              <div class="feedback-reply">
                <div class="feedback-reply-label">💌 Phản hồi từ BeautyCRM:</div>
                <div class="feedback-reply-text">${f.reply_content}</div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
    setPageContent(html);
  } catch (e) { toast(e.message, 'error'); }
}

async function openNewFeedbackModal() {
  const products = await api('GET', '/api/customer/products').catch(() => []);
  const official = products.filter(p => p.launch_status === 'OFFICIAL');
  const options = official.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  showModal('💬 Gửi đánh giá sản phẩm', `
    <div class="form-group">
      <label>Chọn sản phẩm *</label>
      <select id="fb-product"><option value="">-- Chọn sản phẩm --</option>${options}</select>
    </div>
    <div class="form-group">
      <label>Đánh giá của bạn *</label>
      <div style="display:flex;gap:10px">
        ${[1,2,3,4,5].map(n => `
          <label style="font-size:32px;cursor:pointer;transition:transform 0.15s" id="star-lbl-${n}" onclick="setFeedbackStar(${n})" title="${n} sao">⭐</label>
        `).join('')}
        <input type="hidden" id="fb-rating" value="">
      </div>
    </div>
    <div class="form-group">
      <label>Nội dung đánh giá</label>
      <textarea id="fb-content" placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="submitFeedback()">📤 Gửi đánh giá</button>
    </div>
  `);
}

function openFeedbackModal(productId, productName) {
  openNewFeedbackModal().then(() => {
    const sel = document.getElementById('fb-product');
    if (sel) sel.value = productId;
  });
}

function setFeedbackStar(rating) {
  document.getElementById('fb-rating').value = rating;
  for (let i = 1; i <= 5; i++) {
    const lbl = document.getElementById(`star-lbl-${i}`);
    if (lbl) lbl.style.transform = i <= rating ? 'scale(1.2)' : 'scale(1)';
  }
}

async function submitFeedback() {
  const product_id = document.getElementById('fb-product').value;
  const rating = document.getElementById('fb-rating').value;
  const content = document.getElementById('fb-content').value.trim();
  if (!product_id || !rating) { toast('Vui lòng chọn sản phẩm và đánh giá số sao', 'error'); return; }
  try {
    await api('POST', '/api/customer/feedbacks', { product_id: Number(product_id), rating: Number(rating), content });
    toast('Cảm ơn bạn đã gửi đánh giá! 🌸', 'success');
    closeModal();
    renderCustomerFeedback();
  } catch (e) { toast(e.message, 'error'); }
}

// ========== CUSTOMER: PROFILE ==========
async function renderCustomerProfile() {
  setPageHeader('👤 Hồ sơ cá nhân', 'Quản lý thông tin và sở thích làm đẹp của bạn');
  showLoading();
  try {
    const { account, customer } = await api('GET', '/api/customer/profile');
    const skinOptions = ['Da dầu','Da khô','Da hỗn hợp','Da nhạy cảm','Da thường'];
    const beautyPrefsOptions = ['Trang điểm','Chăm sóc da','Chống lão hóa','Trị mụn','Dưỡng ẩm','Organic','Skincare cơ bản'];

    const currentPrefs = (customer?.beauty_preferences || '').split(',').map(p => p.trim()).filter(Boolean);

    const html = `
      <div style="max-width:640px;margin:0 auto">
        <!-- Profile Header -->
        <div style="background:linear-gradient(135deg,rgba(244,63,94,0.1),rgba(168,85,247,0.1));border:1px solid var(--border);border-radius:var(--radius-xl);padding:28px;margin-bottom:24px;text-align:center">
          <div style="width:80px;height:80px;background:var(--grad-rose);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:white;margin:0 auto 14px;box-shadow:var(--glow-rose)">
            ${account.full_name.charAt(0).toUpperCase()}
          </div>
          <h2 style="font-size:20px;font-weight:800">${account.full_name}</h2>
          <p style="color:var(--text-muted);font-size:13px">@${account.username}</p>
          <div style="margin-top:10px;display:flex;justify-content:center;gap:8px">
            ${roleBadge(state.user.role)}
            ${statusBadge(account.status)}
            ${customer ? membershipBadge(customer.membership_tier) : ''}
          </div>
        </div>

        <!-- Edit Form -->
        <div class="card">
          <div class="card-title">✏️ Chỉnh sửa thông tin</div>
          <form id="profile-form" style="display:flex;flex-direction:column;gap:14px">
            <div class="form-group"><label>Họ và tên</label><input id="p-fullname" value="${account.full_name}"></div>
            <div class="form-row">
              <div class="form-group"><label>Email</label><input id="p-email" type="email" value="${account.email || ''}"></div>
              <div class="form-group"><label>Số điện thoại</label><input id="p-phone" value="${account.phone || ''}"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Độ tuổi</label><input id="p-age" type="number" min="13" max="100" value="${customer?.age || ''}"></div>
              <div class="form-group"><label>Giới tính</label>
                <select id="p-gender">
                  <option value="">-- Chọn --</option>
                  <option value="Nu" ${customer?.gender === 'Nu' ? 'selected' : ''}>Nữ</option>
                  <option value="Nam" ${customer?.gender === 'Nam' ? 'selected' : ''}>Nam</option>
                  <option value="Khac" ${customer?.gender === 'Khac' ? 'selected' : ''}>Khác</option>
                </select>
              </div>
            </div>
            <div class="form-group"><label>Loại da</label>
              <select id="p-skin">
                <option value="">-- Chọn loại da --</option>
                ${skinOptions.map(s => `<option value="${s}" ${customer?.skin_type === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Sở thích làm đẹp</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">
                ${beautyPrefsOptions.map(pref => `
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 12px;border-radius:20px;border:1px solid ${currentPrefs.includes(pref) ? 'var(--rose-400)' : 'var(--border)'};background:${currentPrefs.includes(pref) ? 'rgba(244,63,94,0.12)' : 'transparent'};font-size:12px;transition:all 0.2s" id="pref-label-${pref.replace(/\s/g,'_')}" onclick="togglePref(this,'${pref}')">
                    <input type="checkbox" name="prefs" value="${pref}" ${currentPrefs.includes(pref) ? 'checked' : ''} style="display:none">
                    ${pref}
                  </label>
                `).join('')}
              </div>
            </div>
            <button type="button" class="btn btn-primary" onclick="saveProfile()">💾 Lưu thay đổi</button>
          </form>
        </div>

        <!-- Account Info -->
        <div class="card" style="margin-top:20px">
          <div class="card-title">🔒 Thông tin tài khoản</div>
          <table style="width:100%">
            <tr><td style="padding:8px 0;color:var(--text-muted);font-size:13px;width:40%">Tên đăng nhập</td><td style="font-weight:600">@${account.username}</td></tr>
            <tr><td style="padding:8px 0;color:var(--text-muted);font-size:13px">Hạng thành viên</td><td>${customer ? membershipBadge(customer.membership_tier) : '—'}</td></tr>
            <tr><td style="padding:8px 0;color:var(--text-muted);font-size:13px">Ngày đăng ký</td><td>${formatDate(account.created_at)}</td></tr>
          </table>
        </div>
      </div>
    `;
    setPageContent(html);
  } catch (e) { toast(e.message, 'error'); }
}

function togglePref(label, pref) {
  const checkbox = label.querySelector('input[type="checkbox"]');
  const isChecked = checkbox.checked;
  if (isChecked) {
    label.style.borderColor = 'var(--border)';
    label.style.background = 'transparent';
  } else {
    label.style.borderColor = 'var(--rose-400)';
    label.style.background = 'rgba(244,63,94,0.12)';
  }
  checkbox.checked = !isChecked;
}

async function saveProfile() {
  const prefs = [...document.querySelectorAll('input[name="prefs"]:checked')].map(el => el.value).join(',');
  try {
    await api('PUT', '/api/customer/profile', {
      full_name: document.getElementById('p-fullname').value.trim(),
      email: document.getElementById('p-email').value.trim(),
      phone: document.getElementById('p-phone').value.trim(),
      age: Number(document.getElementById('p-age').value) || null,
      gender: document.getElementById('p-gender').value || null,
      skin_type: document.getElementById('p-skin').value || null,
      beauty_preferences: prefs || null,
    });
    // Update display name in sidebar
    state.user.full_name = document.getElementById('p-fullname').value.trim();
    localStorage.setItem('crm_user', JSON.stringify(state.user));
    document.getElementById('sidebar-user-name').textContent = state.user.full_name;
    toast('Cập nhật hồ sơ thành công! 🌸', 'success');
  } catch (e) { toast(e.message, 'error'); }
}
