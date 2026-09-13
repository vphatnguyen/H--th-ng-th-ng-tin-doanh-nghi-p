const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_PATH = isServerless
  ? path.join(os.tmpdir(), 'cosmetics_crm.db')
  : path.join(__dirname, 'cosmetics_crm.db');

let sqlDb = null;
let isSeeding = false;

function saveDb() {
  if (isSeeding || !sqlDb) return;
  try {
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.warn('Cảnh báo khi lưu CSDL vào file (môi trường serverless):', err.message);
  }
}

function initializeDatabase() {
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS Accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK(role IN ('ADMIN','MANAGER','CUSTOMER')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','LOCKED')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS Customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL UNIQUE,
      age INTEGER,
      gender TEXT CHECK(gender IN ('Nu','Nam','Khac')),
      skin_type TEXT,
      beauty_preferences TEXT,
      membership_tier TEXT DEFAULT 'BRONZE' CHECK(membership_tier IN ('BRONZE','SILVER','GOLD','PLATINUM')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (account_id) REFERENCES Accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS Products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      supplier_id INTEGER,
      price REAL NOT NULL DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      description TEXT,
      image_url TEXT,
      launch_status TEXT DEFAULT 'OFFICIAL' CHECK(launch_status IN ('OFFICIAL','UPCOMING')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (supplier_id) REFERENCES Suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS Surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      target_product_id INTEGER,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','CLOSED')),
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (target_product_id) REFERENCES Products(id),
      FOREIGN KEY (created_by) REFERENCES Accounts(id)
    );

    CREATE TABLE IF NOT EXISTS Questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('SINGLE_CHOICE','MULTI_CHOICE','RATING','TEXT')),
      options TEXT,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (survey_id) REFERENCES Surveys(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS SurveyResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      submitted_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (survey_id) REFERENCES Surveys(id),
      FOREIGN KEY (customer_id) REFERENCES Customers(id),
      UNIQUE(survey_id, customer_id)
    );

    CREATE TABLE IF NOT EXISTS SurveyAnswers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_result_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      answer_value TEXT,
      FOREIGN KEY (survey_result_id) REFERENCES SurveyResults(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES Questions(id)
    );

    CREATE TABLE IF NOT EXISTS Feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      content TEXT,
      status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING','REPLIED')),
      reply_content TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (customer_id) REFERENCES Customers(id),
      FOREIGN KEY (product_id) REFERENCES Products(id)
    );
  `);
}

function normalizeParams(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

const db = {
  init,
  save: saveDb,
  pragma(sql) {
    return [];
  },
  exec(sql) {
    if (!sqlDb) throw new Error('CSDL chưa được khởi tạo. Hãy gọi await db.init() trước.');
    sqlDb.run(sql);
    saveDb();
  },
  prepare(sql) {
    return {
      run(...args) {
        if (!sqlDb) throw new Error('CSDL chưa được khởi tạo. Hãy gọi await db.init() trước.');
        const params = normalizeParams(args);
        const stmt = sqlDb.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params);
          }
          stmt.step();
        } finally {
          stmt.free();
        }
        const info = sqlDb.exec("SELECT last_insert_rowid() AS id, changes() AS chg");
        let lastInsertRowid = 0;
        let changes = 0;
        if (info.length > 0 && info[0].values.length > 0) {
          lastInsertRowid = info[0].values[0][0];
          changes = info[0].values[0][1];
        }
        saveDb();
        return { lastInsertRowid, changes };
      },
      get(...args) {
        if (!sqlDb) throw new Error('CSDL chưa được khởi tạo. Hãy gọi await db.init() trước.');
        const params = normalizeParams(args);
        const stmt = sqlDb.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params);
          }
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...args) {
        if (!sqlDb) throw new Error('CSDL chưa được khởi tạo. Hãy gọi await db.init() trước.');
        const params = normalizeParams(args);
        const stmt = sqlDb.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params);
          }
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      }
    };
  }
};

function seedDatabase() {
  const accountCount = db.prepare('SELECT COUNT(*) as cnt FROM Accounts').get();
  if (accountCount && accountCount.cnt > 0) return;

  console.log('Đang khởi tạo dữ liệu mẫu (Seeding database)...');

  // Hash passwords
  const adminHash = bcrypt.hashSync('admin123', 10);
  const managerHash = bcrypt.hashSync('manager123', 10);
  const customerHash = bcrypt.hashSync('customer123', 10);

  // Seed Accounts
  const insertAccount = db.prepare(`
    INSERT INTO Accounts (username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAccount.run('admin', adminHash, 'Nguyễn Văn Admin', 'admin@beautycrm.vn', '0901000001', 'ADMIN', 'ACTIVE');
  insertAccount.run('manager1', managerHash, 'Trần Thị Lan', 'lan.tran@beautycrm.vn', '0902000001', 'MANAGER', 'ACTIVE');
  insertAccount.run('manager2', managerHash, 'Lê Minh Hương', 'huong.le@beautycrm.vn', '0902000002', 'MANAGER', 'ACTIVE');

  const customerData = [
    ['khach001', customerHash, 'Nguyễn Thị Mai', 'mai.nguyen@gmail.com', '0903000001', 'CUSTOMER', 'ACTIVE'],
    ['khach002', customerHash, 'Phạm Thu Hà', 'ha.pham@gmail.com', '0903000002', 'CUSTOMER', 'ACTIVE'],
    ['khach003', customerHash, 'Hoàng Thị Linh', 'linh.hoang@gmail.com', '0903000003', 'CUSTOMER', 'ACTIVE'],
    ['khach004', customerHash, 'Đặng Thị Phương', 'phuong.dang@gmail.com', '0903000004', 'CUSTOMER', 'ACTIVE'],
    ['khach005', customerHash, 'Vũ Thị Nga', 'nga.vu@gmail.com', '0903000005', 'CUSTOMER', 'ACTIVE'],
    ['khach006', customerHash, 'Bùi Thị Thảo', 'thao.bui@gmail.com', '0903000006', 'CUSTOMER', 'LOCKED'],
    ['khach007', customerHash, 'Lý Thị Kim', 'kim.ly@gmail.com', '0903000007', 'CUSTOMER', 'ACTIVE'],
    ['khach008', customerHash, 'Trịnh Thị Loan', 'loan.trinh@gmail.com', '0903000008', 'CUSTOMER', 'ACTIVE'],
    ['khach009', customerHash, 'Đinh Văn Nam', 'nam.dinh@gmail.com', '0903000009', 'CUSTOMER', 'ACTIVE'],
    ['khach010', customerHash, 'Cao Thị Yến', 'yen.cao@gmail.com', '0903000010', 'CUSTOMER', 'ACTIVE'],
  ];

  customerData.forEach(c => insertAccount.run(...c));

  // Seed Customers profiles
  const insertCustomer = db.prepare(`
    INSERT INTO Customers (account_id, age, gender, skin_type, beauty_preferences, membership_tier) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const customerProfiles = [
    [4, 24, 'Nu', 'Da dầu', 'Trang điểm,Chống lão hóa', 'SILVER'],
    [5, 19, 'Nu', 'Da khô', 'Chăm sóc da,Dưỡng ẩm', 'BRONZE'],
    [6, 31, 'Nu', 'Da hỗn hợp', 'Chống lão hóa,Trị mụn', 'GOLD'],
    [7, 28, 'Nu', 'Da nhạy cảm', 'Chăm sóc da,Organic', 'SILVER'],
    [8, 22, 'Nu', 'Da thường', 'Trang điểm,Chăm sóc da', 'BRONZE'],
    [9, 35, 'Nu', 'Da dầu', 'Trị mụn,Chăm sóc da', 'GOLD'],
    [10, 42, 'Nu', 'Da khô', 'Chống lão hóa,Dưỡng da', 'PLATINUM'],
    [11, 17, 'Nu', 'Da thường', 'Trang điểm,Skincare cơ bản', 'BRONZE'],
    [12, 38, 'Nam', 'Da dầu', 'Chăm sóc da,Dưỡng ẩm', 'SILVER'],
    [13, 26, 'Nu', 'Da hỗn hợp', 'Trang điểm,Chống lão hóa,Trị mụn', 'GOLD'],
  ];

  customerProfiles.forEach(p => insertCustomer.run(...p));

  // Seed Suppliers
  const insertSupplier = db.prepare(`
    INSERT INTO Suppliers (name, contact_name, email, phone, address, status) VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertSupplier.run('L\'Oréal Paris Vietnam', 'Nguyễn Minh Tuấn', 'contact@loreal.vn', '0281000001', '12 Nguyễn Thị Minh Khai, Q.1, TP.HCM', 'ACTIVE');
  insertSupplier.run('Innisfree Korea Distribution', 'Kim Ji Young', 'vn@innisfree.com', '0281000002', '45 Lê Lợi, Q.1, TP.HCM', 'ACTIVE');
  insertSupplier.run('The Face Shop Vietnam', 'Lê Thị Hoa', 'contact@thefaceshop.vn', '0281000003', '78 Đồng Khởi, Q.1, TP.HCM', 'ACTIVE');
  insertSupplier.run('Kiehl\'s Vietnam', 'Phạm Văn Đức', 'vietnam@kiehls.com', '0281000004', '23 Trần Hưng Đạo, Q.5, TP.HCM', 'ACTIVE');
  insertSupplier.run('Organic Beauty Co.', 'Trần Thu Hương', 'organic@beauty.vn', '0281000005', '56 Cách Mạng Tháng Tám, Q.3, TP.HCM', 'ACTIVE');
  insertSupplier.run('Maybelline Vietnam', 'Hoàng Bảo Long', 'vn@maybelline.com', '0281000006', '90 Nguyễn Huệ, Q.1, TP.HCM', 'INACTIVE');

  // Seed Products
  const insertProduct = db.prepare(`
    INSERT INTO Products (name, category, supplier_id, price, stock_quantity, description, image_url, launch_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProduct.run('Son môi nhung mịn Velvet Matte #01 Đỏ Ruby', 'Son môi', 1, 350000, 150, 'Son môi lâu trôi với công thức nhung mịn, màu đỏ ruby quyến rũ. Phù hợp mọi tông da.', '', 'OFFICIAL');
  insertProduct.run('Kem dưỡng da ban đêm Retinol Pro', 'Kem dưỡng da', 4, 680000, 80, 'Kem dưỡng chứa Retinol 0.3% và Peptide giúp tái tạo da, chống nhăn và làm đều màu da.', '', 'OFFICIAL');
  insertProduct.run('Serum Vitamin C Brightening 30ml', 'Serum', 2, 520000, 120, 'Serum Vitamin C 15% giúp làm sáng da, mờ thâm nám và tăng cường đề kháng cho da.', '', 'OFFICIAL');
  insertProduct.run('Kem chống nắng SPF50+ PA++++', 'Kem chống nắng', 3, 280000, 200, 'Kem chống nắng phổ rộng, không nhờn rít, phù hợp da nhạy cảm. Chống UVA+UVB.', '', 'OFFICIAL');
  insertProduct.run('Phấn phủ kiềm dầu HD Powder', 'Phấn phủ', 6, 195000, 90, 'Phấn phủ dạng nén kiềm dầu 8 tiếng, cho lớp nền mịn màng tự nhiên, che phủ lỗ chân lông.', '', 'OFFICIAL');
  insertProduct.run('Sữa rửa mặt Green Tea Foam', 'Sữa rửa mặt', 2, 165000, 300, 'Sữa rửa mặt chiết xuất trà xanh Jeju, làm sạch dịu nhẹ và thu nhỏ lỗ chân lông.', '', 'OFFICIAL');
  insertProduct.run('Toner cân bằng Centella Asiatica', 'Toner', 3, 245000, 175, 'Toner rau má phục hồi và làm dịu da, giảm đỏ và kiểm soát dầu hiệu quả.', '', 'OFFICIAL');
  insertProduct.run('Mặt nạ ngủ Collagen Gold 50ml', 'Mặt nạ', 5, 390000, 60, 'Mặt nạ ngủ hữu cơ chứa collagen vàng và chiết xuất hoa hồng, cấp ẩm và đàn hồi da.', '', 'OFFICIAL');
  insertProduct.run('Son môi Glossy Shine mới - Bộ sưu tập Hè 2026', 'Son môi', 1, 420000, 0, 'Dòng son bóng lì cao cấp với hiệu ứng môi căng bóng 3D. Ra mắt mùa hè 2026.', '', 'UPCOMING');
  insertProduct.run('Serum chống lão hóa Peptide Complex', 'Serum', 4, 950000, 0, 'Serum công nghệ Peptide thế hệ mới giúp xóa nếp nhăn, tăng độ đàn hồi da hiệu quả.', '', 'UPCOMING');

  // Seed Surveys
  const insertSurvey = db.prepare(`
    INSERT INTO Surveys (title, description, target_product_id, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const s1 = insertSurvey.run(
    'Khảo sát thị hiếu son môi hè 2026',
    'Chúng tôi chuẩn bị ra mắt dòng son Glossy Shine mới. Khảo sát này giúp chúng tôi hiểu rõ hơn về sở thích màu sắc và chất son của khách hàng.',
    9, '2026-09-01', '2026-09-30', 'ACTIVE', 2
  );

  const s2 = insertSurvey.run(
    'Đánh giá nhu cầu Serum chống lão hóa',
    'Khảo sát nhu cầu thực tế của khách hàng về sản phẩm serum chống lão hóa cao cấp sắp ra mắt.',
    10, '2026-09-10', '2026-10-10', 'ACTIVE', 3
  );

  const s3 = insertSurvey.run(
    'Khảo sát độ hài lòng sản phẩm Skincare Q3/2026',
    'Đánh giá tổng thể mức độ hài lòng với các sản phẩm chăm sóc da trong quý 3 năm 2026.',
    null, '2026-07-01', '2026-09-30', 'CLOSED', 2
  );

  // Seed Questions for Survey 1
  const insertQuestion = db.prepare(`
    INSERT INTO Questions (survey_id, question_text, question_type, options, order_index) VALUES (?, ?, ?, ?, ?)
  `);

  insertQuestion.run(s1.lastInsertRowid, 'Bạn thường sử dụng loại son nào?', 'SINGLE_CHOICE', JSON.stringify(['Son lì (Matte)','Son bóng (Glossy)','Son kem','Son dưỡng','Không dùng son']), 1);
  insertQuestion.run(s1.lastInsertRowid, 'Tông màu son bạn yêu thích?', 'MULTI_CHOICE', JSON.stringify(['Đỏ','Hồng','Cam','Nude/Be','Tím','Nâu']), 2);
  insertQuestion.run(s1.lastInsertRowid, 'Mức giá bạn sẵn sàng chi cho một cây son chất lượng?', 'SINGLE_CHOICE', JSON.stringify(['Dưới 200.000đ','200.000 - 400.000đ','400.000 - 600.000đ','Trên 600.000đ']), 3);
  insertQuestion.run(s1.lastInsertRowid, 'Bạn đánh giá bao nhiêu điểm cho dòng son hiện tại của chúng tôi?', 'RATING', null, 4);
  insertQuestion.run(s1.lastInsertRowid, 'Bạn mong muốn điều gì ở dòng son mới sắp ra mắt?', 'TEXT', null, 5);

  // Seed Questions for Survey 2
  insertQuestion.run(s2.lastInsertRowid, 'Độ tuổi của bạn thuộc nhóm nào?', 'SINGLE_CHOICE', JSON.stringify(['Dưới 25 tuổi','25-34 tuổi','35-44 tuổi','45-54 tuổi','Trên 55 tuổi']), 1);
  insertQuestion.run(s2.lastInsertRowid, 'Bạn có đang sử dụng serum chống lão hóa không?', 'SINGLE_CHOICE', JSON.stringify(['Có, dùng hàng ngày','Đôi khi','Chưa từng dùng','Đang tìm kiếm sản phẩm phù hợp']), 2);
  insertQuestion.run(s2.lastInsertRowid, 'Thành phần bạn quan tâm nhất trong serum chống lão hóa?', 'MULTI_CHOICE', JSON.stringify(['Retinol','Peptide','Vitamin C','Collagen','Hyaluronic Acid','Niacinamide']), 3);
  insertQuestion.run(s2.lastInsertRowid, 'Bạn sẵn sàng chi bao nhiêu cho serum chống lão hóa chất lượng cao?', 'SINGLE_CHOICE', JSON.stringify(['Dưới 500.000đ','500.000 - 1.000.000đ','1.000.000 - 2.000.000đ','Trên 2.000.000đ']), 4);
  insertQuestion.run(s2.lastInsertRowid, 'Chia sẻ thêm mong muốn của bạn về sản phẩm serum chống lão hóa lý tưởng:', 'TEXT', null, 5);

  // Seed Survey Results (some customers already answered)
  const insertResult = db.prepare(`INSERT INTO SurveyResults (survey_id, customer_id, submitted_at) VALUES (?, ?, ?)`);
  const insertAnswer = db.prepare(`INSERT INTO SurveyAnswers (survey_result_id, question_id, answer_value) VALUES (?, ?, ?)`);

  // Customer 1 (id=1) answers Survey 1
  const r1 = insertResult.run(s1.lastInsertRowid, 1, '2026-09-05 10:30:00');
  insertAnswer.run(r1.lastInsertRowid, 1, 'Son bóng (Glossy)');
  insertAnswer.run(r1.lastInsertRowid, 2, JSON.stringify(['Hồng', 'Nude/Be']));
  insertAnswer.run(r1.lastInsertRowid, 3, '200.000 - 400.000đ');
  insertAnswer.run(r1.lastInsertRowid, 4, '4');
  insertAnswer.run(r1.lastInsertRowid, 5, 'Mong son giữ màu lâu hơn và không gây khô môi');

  // Customer 2 answers Survey 1
  const r2 = insertResult.run(s1.lastInsertRowid, 2, '2026-09-06 14:20:00');
  insertAnswer.run(r2.lastInsertRowid, 1, 'Son lì (Matte)');
  insertAnswer.run(r2.lastInsertRowid, 2, JSON.stringify(['Đỏ', 'Cam']));
  insertAnswer.run(r2.lastInsertRowid, 3, '400.000 - 600.000đ');
  insertAnswer.run(r2.lastInsertRowid, 4, '5');
  insertAnswer.run(r2.lastInsertRowid, 5, 'Cần thêm nhiều màu sắc đa dạng hơn');

  // Customer 3 answers Survey 1
  const r3 = insertResult.run(s1.lastInsertRowid, 3, '2026-09-07 09:15:00');
  insertAnswer.run(r3.lastInsertRowid, 1, 'Son kem');
  insertAnswer.run(r3.lastInsertRowid, 2, JSON.stringify(['Đỏ', 'Hồng', 'Cam']));
  insertAnswer.run(r3.lastInsertRowid, 3, 'Dưới 200.000đ');
  insertAnswer.run(r3.lastInsertRowid, 4, '3');
  insertAnswer.run(r3.lastInsertRowid, 5, 'Bao bì cần đẹp hơn và sang trọng hơn');

  // Customer 4 answers Survey 2
  const r4 = insertResult.run(s2.lastInsertRowid, 4, '2026-09-12 16:45:00');
  insertAnswer.run(r4.lastInsertRowid, 6, '25-34 tuổi');
  insertAnswer.run(r4.lastInsertRowid, 7, 'Đôi khi');
  insertAnswer.run(r4.lastInsertRowid, 8, JSON.stringify(['Retinol', 'Peptide', 'Vitamin C']));
  insertAnswer.run(r4.lastInsertRowid, 9, '500.000 - 1.000.000đ');
  insertAnswer.run(r4.lastInsertRowid, 10, 'Muốn serum thấm nhanh và không để lại cảm giác bết dính');

  // Customer 5 answers Survey 2
  const r5 = insertResult.run(s2.lastInsertRowid, 5, '2026-09-13 11:00:00');
  insertAnswer.run(r5.lastInsertRowid, 6, '35-44 tuổi');
  insertAnswer.run(r5.lastInsertRowid, 7, 'Có, dùng hàng ngày');
  insertAnswer.run(r5.lastInsertRowid, 8, JSON.stringify(['Collagen', 'Hyaluronic Acid', 'Niacinamide']));
  insertAnswer.run(r5.lastInsertRowid, 9, '1.000.000 - 2.000.000đ');
  insertAnswer.run(r5.lastInsertRowid, 10, 'Cần hiệu quả rõ ràng sau 4 tuần sử dụng');

  // Seed Feedbacks
  const insertFeedback = db.prepare(`
    INSERT INTO Feedbacks (customer_id, product_id, rating, content, status, reply_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertFeedback.run(1, 1, 5, 'Son giữ màu cực kỳ lâu, đi ăn uống vẫn không trôi. Màu đỏ rất đẹp, rất ưng!', 'REPLIED', 'Cảm ơn bạn đã tin tưởng sử dụng sản phẩm! Chúng tôi sẽ tiếp tục cải thiện chất lượng.', '2026-09-02 10:00:00');
  insertFeedback.run(2, 2, 4, 'Kem dưỡng tốt, da mình mịn hơn thấy rõ sau 2 tuần. Tuy nhiên mùi hơi nồng một chút.', 'REPLIED', 'Cảm ơn phản hồi của bạn! Chúng tôi sẽ ghi nhận ý kiến về mùi hương để cải tiến sản phẩm.', '2026-09-03 14:30:00');
  insertFeedback.run(3, 3, 5, 'Serum Vitamin C này thực sự tuyệt vời! Da sáng hẳn, thâm mụn mờ dần sau 3 tuần.', 'PENDING', null, '2026-09-05 09:20:00');
  insertFeedback.run(4, 4, 3, 'Kem chống nắng ổn nhưng hơi trắng da một chút khi mới thoa, phải đợi ngấm.', 'PENDING', null, '2026-09-06 16:00:00');
  insertFeedback.run(5, 6, 4, 'Sữa rửa mặt sạch và dịu nhẹ, không gây khô căng. Mùi trà xanh rất thơm dễ chịu.', 'REPLIED', 'Cảm ơn bạn rất nhiều! Chúc bạn luôn đẹp và rạng rỡ mỗi ngày!', '2026-09-08 11:45:00');
  insertFeedback.run(6, 7, 4, 'Toner rau má làm dịu da rất nhanh, da mình hết đỏ rõ rệt. Sẽ tiếp tục mua lại!', 'PENDING', null, '2026-09-09 13:30:00');
  insertFeedback.run(7, 8, 5, 'Mặt nạ ngủ siêu cấp ẩm! Sáng dậy da mịn như nhung. Đáng tiền lắm!', 'PENDING', null, '2026-09-10 20:00:00');
  insertFeedback.run(9, 5, 2, 'Phấn phủ không kiềm dầu được lâu như quảng cáo, sau 3 giờ đã bóng dầu.', 'PENDING', null, '2026-09-11 15:00:00');
  insertFeedback.run(10, 1, 5, 'Mua lần thứ 3 rồi! Son đẹp, lâu trôi, giá cả hợp lý. Recommend cho tất cả mọi người!', 'PENDING', null, '2026-09-12 19:30:00');
  insertFeedback.run(1, 6, 4, 'Da mình đang bị mụn nên thử sữa rửa mặt này, thấy mụn giảm bớt. Khá ưng!', 'PENDING', null, '2026-09-13 08:00:00');

  console.log('CSDL đã được khởi tạo và nạp dữ liệu mẫu thành công!');
}

async function init() {
  if (sqlDb) return db;

  let wasmBinary = null;
  const localWasm = path.join(__dirname, 'sql-wasm.wasm');
  const nodeModulesWasm = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

  if (fs.existsSync(localWasm)) {
    wasmBinary = fs.readFileSync(localWasm);
  } else if (fs.existsSync(nodeModulesWasm)) {
    wasmBinary = fs.readFileSync(nodeModulesWasm);
  }

  const SQL = await initSqlJs(wasmBinary ? { wasmBinary } : {});

  if (isServerless && !fs.existsSync(DB_PATH)) {
    const seedDbPath = path.join(__dirname, 'cosmetics_crm.db');
    if (fs.existsSync(seedDbPath)) {
      try {
        fs.copyFileSync(seedDbPath, DB_PATH);
      } catch (e) {
        console.warn('Không thể sao chép DB gốc sang /tmp:', e.message);
      }
    }
  }

  if (fs.existsSync(DB_PATH)) {
    try {
      const buffer = fs.readFileSync(DB_PATH);
      sqlDb = new SQL.Database(buffer);
    } catch (e) {
      console.warn('Không thể đọc file db hiện tại, tạo mới...', e);
      sqlDb = new SQL.Database();
    }
  } else {
    sqlDb = new SQL.Database();
  }

  isSeeding = true;
  try {
    initializeDatabase();
    seedDatabase();
  } finally {
    isSeeding = false;
  }
  saveDb();
  return db;
}

module.exports = db;
