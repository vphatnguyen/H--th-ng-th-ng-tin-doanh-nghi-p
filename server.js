require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cosmetics_crm_secret_2026';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Đảm bảo CSDL được kết nối trước khi xử lý request
let dbInitPromise = null;
function ensureDb() {
  if (!dbInitPromise) {
    dbInitPromise = db.init();
  }
  return dbInitPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error('Lỗi khởi tạo CSDL:', err);
    res.status(500).json({ error: 'Khởi tạo CSDL thất bại: ' + err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== MIDDLEWARE: Xác thực JWT ==========
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Không có quyền truy cập' });
    next();
  };
}

// Hàm kiểm tra mật khẩu dạng văn bản thuần (plain text)
function verifyPassword(inputPassword, account) {
  if (!inputPassword || !account) return false;
  const storedPassword = account.password;
  if (!storedPassword) return false;
  return String(inputPassword) === String(storedPassword);
}

async function insertAccount(username, passwordVal, full_name, email, phone, role) {
  return await db.prepare('INSERT INTO Accounts (username, password, full_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)').run(username, passwordVal, full_name, email || null, phone || null, role);
}

// ========== AUTH ==========
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const account = await db.prepare('SELECT * FROM Accounts WHERE username = ?').get(username);
    if (!account || !verifyPassword(password, account))
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    if (account.status === 'LOCKED')
      return res.status(403).json({ error: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' });

    const token = jwt.sign({ id: account.id, username: account.username, role: account.role, full_name: account.full_name }, JWT_SECRET, { expiresIn: '24h' });
    const customer = account.role === 'CUSTOMER' ? await db.prepare('SELECT * FROM Customers WHERE account_id = ?').get(account.id) : null;
    res.json({ token, user: { id: account.id, username: account.username, full_name: account.full_name, email: account.email, phone: account.phone, role: account.role, status: account.status }, customer });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi đăng nhập: ' + err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, full_name, email, phone, age, gender, skin_type, beauty_preferences } = req.body;
    if (!username || !password || !full_name) return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    const existing = await db.prepare('SELECT id FROM Accounts WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    const accountResult = await insertAccount(username, password, full_name, email, phone, 'CUSTOMER');
    await db.prepare('INSERT INTO Customers (account_id, age, gender, skin_type, beauty_preferences) VALUES (?, ?, ?, ?, ?)').run(accountResult.lastInsertRowid, age || null, gender || null, skin_type || null, beauty_preferences || null);
    res.status(201).json({ message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Lỗi đăng ký: ' + err.message });
  }
});

// ========== ADMIN: Accounts ==========
app.get('/api/admin/accounts', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search, role, status } = req.query;
    let sql = 'SELECT id, username, full_name, email, phone, role, status, created_at FROM Accounts WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (full_name LIKE ? OR username LIKE ? OR email LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
    if (role) { sql += ' AND role = ?'; params.push(role); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/accounts', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { username, password, full_name, email, phone, role } = req.body;
    if (!username || !password || !full_name) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    const existing = await db.prepare('SELECT id FROM Accounts WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    const result = await insertAccount(username, password, full_name, email, phone, role || 'CUSTOMER');
    if ((role || 'CUSTOMER') === 'CUSTOMER') {
      await db.prepare('INSERT INTO Customers (account_id) VALUES (?)').run(result.lastInsertRowid);
    }
    res.status(201).json({ message: 'Tạo tài khoản thành công', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/accounts/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { role, status } = req.body;
    await db.prepare('UPDATE Accounts SET role = ?, status = ? WHERE id = ?').run(role, status, req.params.id);
    res.json({ message: 'Cập nhật tài khoản thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/accounts/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    if (req.params.id == req.user.id) return res.status(400).json({ error: 'Không thể xóa tài khoản của chính bạn' });
    await db.prepare('DELETE FROM Accounts WHERE id = ?').run(req.params.id);
    res.json({ message: 'Đã xóa tài khoản' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ADMIN: Products ==========
app.get('/api/admin/products', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search, category, supplier_id, launch_status, min_price, max_price, sort_by, sort_dir } = req.query;
    let sql = `SELECT p.*, s.name as supplier_name FROM Products p LEFT JOIN Suppliers s ON p.supplier_id = s.id WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; const v = `%${search}%`; params.push(v, v); }
    if (category) { sql += ' AND p.category = ?'; params.push(category); }
    if (supplier_id) { sql += ' AND p.supplier_id = ?'; params.push(supplier_id); }
    if (launch_status) { sql += ' AND p.launch_status = ?'; params.push(launch_status); }
    if (min_price) { sql += ' AND p.price >= ?'; params.push(Number(min_price)); }
    if (max_price) { sql += ' AND p.price <= ?'; params.push(Number(max_price)); }
    const allowedSort = { name: 'p.name', price: 'p.price', created_at: 'p.created_at', stock_quantity: 'p.stock_quantity' };
    const sortCol = allowedSort[sort_by] || 'p.created_at';
    const sortDir = sort_dir === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortCol} ${sortDir}`;
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/products', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, category, supplier_id, price, stock_quantity, description, launch_status } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    const result = await db.prepare('INSERT INTO Products (name, category, supplier_id, price, stock_quantity, description, launch_status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(name, category, supplier_id || null, price || 0, stock_quantity || 0, description || null, launch_status || 'OFFICIAL');
    res.status(201).json({ message: 'Thêm sản phẩm thành công', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/products/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, category, supplier_id, price, stock_quantity, description, launch_status } = req.body;
    await db.prepare('UPDATE Products SET name=?, category=?, supplier_id=?, price=?, stock_quantity=?, description=?, launch_status=? WHERE id=?').run(name, category, supplier_id || null, price, stock_quantity, description, launch_status, req.params.id);
    res.json({ message: 'Cập nhật sản phẩm thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/products/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    await db.prepare('DELETE FROM Products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Đã xóa sản phẩm' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ADMIN: Suppliers ==========
app.get('/api/admin/suppliers', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search, status } = req.query;
    let sql = 'SELECT * FROM Suppliers WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (name LIKE ? OR contact_name LIKE ? OR email LIKE ?)'; const v = `%${search}%`; params.push(v, v, v); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/suppliers', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, contact_name, email, phone, address, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên nhà cung cấp là bắt buộc' });
    const result = await db.prepare('INSERT INTO Suppliers (name, contact_name, email, phone, address, status) VALUES (?, ?, ?, ?, ?, ?)').run(name, contact_name || null, email || null, phone || null, address || null, status || 'ACTIVE');
    res.status(201).json({ message: 'Thêm nhà cung cấp thành công', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/suppliers/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, contact_name, email, phone, address, status } = req.body;
    await db.prepare('UPDATE Suppliers SET name=?, contact_name=?, email=?, phone=?, address=?, status=? WHERE id=?').run(name, contact_name, email, phone, address, status, req.params.id);
    res.json({ message: 'Cập nhật nhà cung cấp thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/suppliers/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    await db.prepare('DELETE FROM Suppliers WHERE id = ?').run(req.params.id);
    res.json({ message: 'Đã xóa nhà cung cấp' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== MANAGER: Dashboard Analytics ==========
app.get('/api/manager/analytics', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const ageGroups = await db.prepare(`
      SELECT
        CASE
          WHEN age < 18 THEN N'Dưới 18'
          WHEN age BETWEEN 18 AND 24 THEN N'18-24'
          WHEN age BETWEEN 25 AND 34 THEN N'25-34'
          WHEN age BETWEEN 35 AND 44 THEN N'35-44'
          ELSE N'45+'
        END AS age_group,
        COUNT(*) as count
      FROM Customers
      WHERE age IS NOT NULL
      GROUP BY
        CASE
          WHEN age < 18 THEN N'Dưới 18'
          WHEN age BETWEEN 18 AND 24 THEN N'18-24'
          WHEN age BETWEEN 25 AND 34 THEN N'25-34'
          WHEN age BETWEEN 35 AND 44 THEN N'35-44'
          ELSE N'45+'
        END
    `).all();

    const skinTypes = await db.prepare(`SELECT skin_type, COUNT(*) as count FROM Customers WHERE skin_type IS NOT NULL GROUP BY skin_type ORDER BY count DESC`).all();

    // Process beauty preferences
    const allPrefs = await db.prepare('SELECT beauty_preferences FROM Customers WHERE beauty_preferences IS NOT NULL').all();
    const prefCount = {};
    allPrefs.forEach(row => {
      if (row.beauty_preferences) {
        row.beauty_preferences.split(',').forEach(p => {
          const key = p.trim();
          if (key) prefCount[key] = (prefCount[key] || 0) + 1;
        });
      }
    });
    const beautyPrefs = Object.entries(prefCount).map(([pref, count]) => ({ pref, count })).sort((a, b) => b.count - a.count);

    const totalCustRow = await db.prepare('SELECT COUNT(*) as cnt FROM Customers').get();
    const activeCustRow = await db.prepare("SELECT COUNT(*) as cnt FROM Accounts WHERE role='CUSTOMER' AND status='ACTIVE'").get();
    const lockedCustRow = await db.prepare("SELECT COUNT(*) as cnt FROM Accounts WHERE role='CUSTOMER' AND status='LOCKED'").get();
    const avgRatingRow = await db.prepare('SELECT ROUND(AVG(CAST(rating AS FLOAT)), 1) as avg FROM Feedbacks').get();
    const totalFeedbacksRow = await db.prepare('SELECT COUNT(*) as cnt FROM Feedbacks').get();
    const activeSurveysRow = await db.prepare("SELECT COUNT(*) as cnt FROM Surveys WHERE status='ACTIVE'").get();
    const totalSurveyRespRow = await db.prepare('SELECT COUNT(*) as cnt FROM SurveyResults').get();

    const totalCustomers = totalCustRow?.cnt || 0;
    const activeCustomers = activeCustRow?.cnt || 0;
    const lockedCustomers = lockedCustRow?.cnt || 0;
    const avgRating = avgRatingRow?.avg || 0;
    const totalFeedbacks = totalFeedbacksRow?.cnt || 0;
    const activeSurveys = activeSurveysRow?.cnt || 0;
    const totalSurveyResponses = totalSurveyRespRow?.cnt || 0;

    res.json({ ageGroups, skinTypes, beautyPrefs, stats: { totalCustomers, activeCustomers, lockedCustomers, avgRating, totalFeedbacks, activeSurveys, totalSurveyResponses } });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== MANAGER: Customers ==========
app.get('/api/manager/customers', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const { search, skin_type, status } = req.query;
    let sql = `SELECT a.id, a.username, a.full_name, a.email, a.phone, a.status, a.created_at,
      c.id as customer_id, c.age, c.gender, c.skin_type, c.beauty_preferences, c.membership_tier
      FROM Accounts a LEFT JOIN Customers c ON a.id = c.account_id
      WHERE a.role = 'CUSTOMER'`;
    const params = [];
    if (search) { sql += ' AND (a.full_name LIKE ? OR a.username LIKE ? OR a.phone LIKE ?)'; const v = `%${search}%`; params.push(v, v, v); }
    if (skin_type) { sql += ' AND c.skin_type = ?'; params.push(skin_type); }
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    sql += ' ORDER BY a.created_at DESC';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/manager/customers', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const { username, password, full_name, email, phone, age, gender, skin_type, beauty_preferences } = req.body;
    if (!username || !password || !full_name) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    const existing = await db.prepare('SELECT id FROM Accounts WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    const accResult = await insertAccount(username, password, full_name, email, phone, 'CUSTOMER');
    await db.prepare('INSERT INTO Customers (account_id, age, gender, skin_type, beauty_preferences) VALUES (?, ?, ?, ?, ?)').run(accResult.lastInsertRowid, age || null, gender || null, skin_type || null, beauty_preferences || null);
    res.status(201).json({ message: 'Thêm khách hàng thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/manager/customers/:accountId/status', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const { status } = req.body;
    await db.prepare('UPDATE Accounts SET status = ? WHERE id = ? AND role = ?').run(status, req.params.accountId, 'CUSTOMER');
    res.json({ message: status === 'LOCKED' ? 'Đã khóa tài khoản khách hàng' : 'Đã mở khóa tài khoản khách hàng' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/manager/customers/:accountId', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    await db.prepare('DELETE FROM Accounts WHERE id = ? AND role = ?').run(req.params.accountId, 'CUSTOMER');
    res.json({ message: 'Đã xóa khách hàng' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== MANAGER: Surveys ==========
app.get('/api/manager/surveys', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const surveys = await db.prepare(`
      SELECT s.*, p.name as product_name, a.full_name as creator_name,
      (SELECT COUNT(*) FROM SurveyResults sr WHERE sr.survey_id = s.id) as response_count,
      (SELECT COUNT(*) FROM Questions q WHERE q.survey_id = s.id) as question_count
      FROM Surveys s
      LEFT JOIN Products p ON s.target_product_id = p.id
      LEFT JOIN Accounts a ON s.created_by = a.id
      ORDER BY s.created_at DESC
    `).all();
    res.json(surveys);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/manager/surveys', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const { title, description, target_product_id, start_date, end_date, questions } = req.body;
    if (!title) return res.status(400).json({ error: 'Tiêu đề khảo sát là bắt buộc' });
    const surveyResult = await db.prepare('INSERT INTO Surveys (title, description, target_product_id, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, description || null, target_product_id || null, start_date || null, end_date || null, 'DRAFT', req.user.id);
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.prepare('INSERT INTO Questions (survey_id, question_text, question_type, options, order_index) VALUES (?, ?, ?, ?, ?)').run(surveyResult.lastInsertRowid, q.question_text, q.question_type, q.options ? JSON.stringify(q.options) : null, i + 1);
      }
    }
    res.status(201).json({ message: 'Tạo khảo sát thành công', id: surveyResult.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/manager/surveys/:id/status', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const { status } = req.body;
    await db.prepare('UPDATE Surveys SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: `Đã cập nhật trạng thái khảo sát thành ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/manager/surveys/:id/results', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const survey = await db.prepare('SELECT * FROM Surveys WHERE id = ?').get(req.params.id);
    if (!survey) return res.status(404).json({ error: 'Không tìm thấy khảo sát' });
    const questions = await db.prepare('SELECT * FROM Questions WHERE survey_id = ? ORDER BY order_index').all(req.params.id);
    const results = [];
    for (const q of questions) {
      const answers = await db.prepare(`SELECT sa.answer_value FROM SurveyAnswers sa JOIN SurveyResults sr ON sa.survey_result_id = sr.id WHERE sr.survey_id = ? AND sa.question_id = ?`).all(req.params.id, q.id);
      const analysis = { question_id: q.id, question_text: q.question_text, question_type: q.question_type, total_responses: answers.length };
      if (q.question_type === 'RATING') {
        const vals = answers.map(a => Number(a.answer_value)).filter(v => !isNaN(v));
        analysis.average = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
        analysis.distribution = [1, 2, 3, 4, 5].map(n => ({ value: n, count: vals.filter(v => v === n).length }));
      } else if (q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTI_CHOICE') {
        const counts = {};
        answers.forEach(a => {
          try {
            const vals = JSON.parse(a.answer_value);
            (Array.isArray(vals) ? vals : [vals]).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
          } catch {
            counts[a.answer_value] = (counts[a.answer_value] || 0) + 1;
          }
        });
        analysis.distribution = Object.entries(counts).map(([label, count]) => ({ label, count, percent: answers.length ? ((count / answers.length) * 100).toFixed(1) : '0' }));
      } else {
        analysis.text_answers = answers.map(a => a.answer_value).filter(Boolean);
      }
      results.push(analysis);
    }
    const respCountRow = await db.prepare('SELECT COUNT(*) as cnt FROM SurveyResults WHERE survey_id = ?').get(req.params.id);
    res.json({ survey, results, total_respondents: respCountRow?.cnt || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== MANAGER: Feedbacks ==========
app.get('/api/manager/feedbacks', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const { rating, status } = req.query;
    let sql = `SELECT f.*, a.full_name as customer_name, p.name as product_name
      FROM Feedbacks f JOIN Customers c ON f.customer_id = c.id JOIN Accounts a ON c.account_id = a.id JOIN Products p ON f.product_id = p.id WHERE 1=1`;
    const params = [];
    if (rating) { sql += ' AND f.rating = ?'; params.push(Number(rating)); }
    if (status) { sql += ' AND f.status = ?'; params.push(status); }
    sql += ' ORDER BY f.created_at DESC';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/manager/feedbacks/:id/reply', authMiddleware, requireRole('MANAGER'), async (req, res) => {
  try {
    const { reply_content } = req.body;
    await db.prepare("UPDATE Feedbacks SET reply_content = ?, status = 'REPLIED' WHERE id = ?").run(reply_content, req.params.id);
    res.json({ message: 'Đã phản hồi thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CUSTOMER: Profile ==========
app.get('/api/customer/profile', authMiddleware, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const account = await db.prepare('SELECT id, username, full_name, email, phone, status, created_at FROM Accounts WHERE id = ?').get(req.user.id);
    const customer = await db.prepare('SELECT * FROM Customers WHERE account_id = ?').get(req.user.id);
    res.json({ account, customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customer/profile', authMiddleware, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { full_name, email, phone, age, gender, skin_type, beauty_preferences } = req.body;
    await db.prepare('UPDATE Accounts SET full_name = ?, email = ?, phone = ? WHERE id = ?').run(full_name, email, phone, req.user.id);
    await db.prepare('UPDATE Customers SET age = ?, gender = ?, skin_type = ?, beauty_preferences = ? WHERE account_id = ?').run(age || null, gender || null, skin_type || null, beauty_preferences || null, req.user.id);
    res.json({ message: 'Cập nhật thông tin thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CUSTOMER: Products ==========
app.get('/api/customer/products', authMiddleware, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const products = await db.prepare("SELECT p.*, s.name as supplier_name FROM Products p LEFT JOIN Suppliers s ON p.supplier_id = s.id ORDER BY p.launch_status DESC, p.created_at DESC").all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CUSTOMER: Surveys ==========
app.get('/api/customer/surveys', authMiddleware, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const customer = await db.prepare('SELECT id FROM Customers WHERE account_id = ?').get(req.user.id);
    if (!customer) return res.json([]);
    const surveys = await db.prepare(`
      SELECT s.*, p.name as product_name,
      (SELECT COUNT(*) FROM Questions q WHERE q.survey_id = s.id) as question_count,
      (SELECT COUNT(*) FROM SurveyResults sr WHERE sr.survey_id = s.id AND sr.customer_id = ?) as already_submitted
      FROM Surveys s LEFT JOIN Products p ON s.target_product_id = p.id
      WHERE s.status = 'ACTIVE'
      ORDER BY s.created_at DESC
    `).all(customer.id);
    res.json(surveys);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer/surveys/:id', authMiddleware, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const survey = await db.prepare('SELECT s.*, p.name as product_name FROM Surveys s LEFT JOIN Products p ON s.target_product_id = p.id WHERE s.id = ?').get(req.params.id);
    if (!survey) return res.status(404).json({ error: 'Không tìm thấy khảo sát' });
    const questions = await db.prepare('SELECT * FROM Questions WHERE survey_id = ? ORDER BY order_index').all(req.params.id);
    questions.forEach(q => { if (q.options) try { q.options = JSON.parse(q.options); } catch { } });
    res.json({ survey, questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customer/surveys/:id/submit', authMiddleware, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const customer = await db.prepare('SELECT id FROM Customers WHERE account_id = ?').get(req.user.id);
    if (!customer) return res.status(400).json({ error: 'Không tìm thấy hồ sơ khách hàng' });
    const alreadyDone = await db.prepare('SELECT id FROM SurveyResults WHERE survey_id = ? AND customer_id = ?').get(req.params.id, customer.id);
    if (alreadyDone) return res.status(409).json({ error: 'Bạn đã thực hiện khảo sát này rồi' });
    const resultRow = await db.prepare('INSERT INTO SurveyResults (survey_id, customer_id) VALUES (?, ?)').run(req.params.id, customer.id);
    const { answers } = req.body;
    if (answers && answers.length > 0) {
      for (const a of answers) {
        await db.prepare('INSERT INTO SurveyAnswers (survey_result_id, question_id, answer_value) VALUES (?, ?, ?)').run(resultRow.lastInsertRowid, a.question_id, Array.isArray(a.answer_value) ? JSON.stringify(a.answer_value) : a.answer_value);
      }
    }
    res.status(201).json({ message: 'Nộp khảo sát thành công! Cảm ơn bạn đã tham gia.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CUSTOMER: Feedbacks ==========
app.get('/api/customer/feedbacks', authMiddleware, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const customer = await db.prepare('SELECT id FROM Customers WHERE account_id = ?').get(req.user.id);
    if (!customer) return res.json([]);
    const feedbacks = await db.prepare('SELECT f.*, p.name as product_name FROM Feedbacks f JOIN Products p ON f.product_id = p.id WHERE f.customer_id = ? ORDER BY f.created_at DESC').all(customer.id);
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customer/feedbacks', authMiddleware, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const customer = await db.prepare('SELECT id FROM Customers WHERE account_id = ?').get(req.user.id);
    if (!customer) return res.status(400).json({ error: 'Không tìm thấy hồ sơ khách hàng' });
    const { product_id, rating, content } = req.body;
    if (!product_id || !rating) return res.status(400).json({ error: 'Thiếu thông tin sản phẩm hoặc đánh giá' });
    await db.prepare('INSERT INTO Feedbacks (customer_id, product_id, rating, content) VALUES (?, ?, ?, ?)').run(customer.id, product_id, rating, content || null);
    res.status(201).json({ message: 'Gửi phản hồi thành công! Cảm ơn bạn.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== SHARED: Products list for dropdowns ==========
app.get('/api/products', authMiddleware, async (req, res) => {
  try {
    const { launch_status } = req.query;
    let sql = 'SELECT id, name, category, price, launch_status FROM Products WHERE 1=1';
    const params = [];
    if (launch_status) { sql += ' AND launch_status = ?'; params.push(launch_status); }
    sql += ' ORDER BY name';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== SERVER START ==========
if (!process.env.VERCEL) {
  ensureDb().then(() => {
    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║   🌸  HỆ THỐNG CRM - QUẢN LÝ CỬA HÀNG MỸ PHẨM  🌸    ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║   🚀  Server đang chạy: http://localhost:${PORT}          ║`);
      console.log(`║   🗄️   Database: ${db.engine === 'mssql' ? 'Microsoft SQL Server (PHAZT\\SQLEXPRESS)' : 'SQLite'} ║`);
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║   TÀI KHOẢN DEMO:                                       ║');
      console.log('║   👑  Admin:    admin / admin123                         ║');
      console.log('║   📊  Manager:  manager1 / manager123                   ║');
      console.log('║   🛍️  Customer:  khach001 / customer123                 ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
    });
  }).catch(err => {
    console.error('Khởi động server thất bại:', err);
    process.exit(1);
  });
}

module.exports = app;
