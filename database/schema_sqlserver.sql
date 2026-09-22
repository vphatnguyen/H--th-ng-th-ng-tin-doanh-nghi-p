-- ============================================================
-- HỆ THỐNG CRM QUẢN LÝ CHUỖI CỬA HÀNG MỸ PHẨM
-- Script DDL & DML cho Microsoft SQL Server 2016+
-- ============================================================

USE master;
GO

-- Tạo database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CosmeticsCRM_DB')
BEGIN
    CREATE DATABASE CosmeticsCRM_DB
    COLLATE Vietnamese_CI_AS;
END
GO

USE CosmeticsCRM_DB;
GO

-- ============================================================
-- XÓA CÁC BẢNG CŨ NẾU TỒN TẠI (theo thứ tự ràng buộc khóa ngoại)
-- ============================================================
IF OBJECT_ID('dbo.SurveyAnswers', 'U') IS NOT NULL DROP TABLE dbo.SurveyAnswers;
IF OBJECT_ID('dbo.SurveyResults', 'U') IS NOT NULL DROP TABLE dbo.SurveyResults;
IF OBJECT_ID('dbo.Questions', 'U') IS NOT NULL DROP TABLE dbo.Questions;
IF OBJECT_ID('dbo.Feedbacks', 'U') IS NOT NULL DROP TABLE dbo.Feedbacks;
IF OBJECT_ID('dbo.Surveys', 'U') IS NOT NULL DROP TABLE dbo.Surveys;
IF OBJECT_ID('dbo.Products', 'U') IS NOT NULL DROP TABLE dbo.Products;
IF OBJECT_ID('dbo.Suppliers', 'U') IS NOT NULL DROP TABLE dbo.Suppliers;
IF OBJECT_ID('dbo.Customers', 'U') IS NOT NULL DROP TABLE dbo.Customers;
IF OBJECT_ID('dbo.Accounts', 'U') IS NOT NULL DROP TABLE dbo.Accounts;
GO

-- ============================================================
-- TẠO CÁC BẢNG (DDL)
-- ============================================================

-- Bảng 1: Accounts - Quản lý tài khoản và phân quyền
CREATE TABLE dbo.Accounts (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    username    NVARCHAR(50) NOT NULL UNIQUE,
    password    NVARCHAR(255) NOT NULL,
    full_name   NVARCHAR(100) NOT NULL,
    email       NVARCHAR(100) UNIQUE,
    phone       NVARCHAR(20),
    role        NVARCHAR(10) NOT NULL DEFAULT 'CUSTOMER'
                    CONSTRAINT CK_Accounts_role CHECK (role IN ('ADMIN','MANAGER','CUSTOMER')),
    status      NVARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
                    CONSTRAINT CK_Accounts_status CHECK (status IN ('ACTIVE','LOCKED')),
    created_at  DATETIME2 DEFAULT GETDATE()
);
GO

-- Bảng 2: Customers - Thông tin chi tiết khách hàng
CREATE TABLE dbo.Customers (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    account_id      INT NOT NULL UNIQUE,
    age             INT,
    gender          NVARCHAR(10) CONSTRAINT CK_Customers_gender CHECK (gender IN (N'Nu',N'Nam',N'Khac')),
    skin_type       NVARCHAR(50),
    beauty_preferences NVARCHAR(255),
    membership_tier NVARCHAR(10) DEFAULT 'BRONZE'
                    CONSTRAINT CK_Customers_tier CHECK (membership_tier IN ('BRONZE','SILVER','GOLD','PLATINUM')),
    created_at      DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Customers_Accounts FOREIGN KEY (account_id) REFERENCES dbo.Accounts(id) ON DELETE CASCADE
);
GO

-- Bảng 3: Suppliers - Nhà cung cấp mỹ phẩm
CREATE TABLE dbo.Suppliers (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    name            NVARCHAR(150) NOT NULL,
    contact_name    NVARCHAR(100),
    email           NVARCHAR(100),
    phone           NVARCHAR(20),
    address         NVARCHAR(255),
    status          NVARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
                    CONSTRAINT CK_Suppliers_status CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at      DATETIME2 DEFAULT GETDATE()
);
GO

-- Bảng 4: Products - Danh mục mỹ phẩm
CREATE TABLE dbo.Products (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    name            NVARCHAR(200) NOT NULL,
    category        NVARCHAR(50) NOT NULL,
    supplier_id     INT,
    price           DECIMAL(18,2) NOT NULL DEFAULT 0,
    stock_quantity  INT DEFAULT 0,
    description     NVARCHAR(MAX),
    image_url       NVARCHAR(500),
    launch_status   NVARCHAR(10) DEFAULT 'OFFICIAL'
                    CONSTRAINT CK_Products_launch CHECK (launch_status IN ('OFFICIAL','UPCOMING')),
    created_at      DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Products_Suppliers FOREIGN KEY (supplier_id) REFERENCES dbo.Suppliers(id)
);
GO

-- Bảng 5: Surveys - Chiến dịch khảo sát sản phẩm mới
CREATE TABLE dbo.Surveys (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    title               NVARCHAR(200) NOT NULL,
    description         NVARCHAR(MAX),
    target_product_id   INT,
    start_date          DATE,
    end_date            DATE,
    status              NVARCHAR(10) DEFAULT 'DRAFT'
                        CONSTRAINT CK_Surveys_status CHECK (status IN ('DRAFT','ACTIVE','CLOSED')),
    created_by          INT,
    created_at          DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Surveys_Products FOREIGN KEY (target_product_id) REFERENCES dbo.Products(id),
    CONSTRAINT FK_Surveys_Accounts FOREIGN KEY (created_by) REFERENCES dbo.Accounts(id)
);
GO

-- Bảng 6: Questions - Câu hỏi của bảng khảo sát
CREATE TABLE dbo.Questions (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    survey_id       INT NOT NULL,
    question_text   NVARCHAR(500) NOT NULL,
    question_type   NVARCHAR(20) NOT NULL
                    CONSTRAINT CK_Questions_type CHECK (question_type IN ('SINGLE_CHOICE','MULTI_CHOICE','RATING','TEXT')),
    options         NVARCHAR(MAX), -- JSON array
    order_index     INT DEFAULT 0,
    CONSTRAINT FK_Questions_Surveys FOREIGN KEY (survey_id) REFERENCES dbo.Surveys(id) ON DELETE CASCADE
);
GO

-- Bảng 7: SurveyResults - Lượt nộp bài khảo sát
CREATE TABLE dbo.SurveyResults (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    survey_id       INT NOT NULL,
    customer_id     INT NOT NULL,
    submitted_at    DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_SurveyResults_Surveys FOREIGN KEY (survey_id) REFERENCES dbo.Surveys(id),
    CONSTRAINT FK_SurveyResults_Customers FOREIGN KEY (customer_id) REFERENCES dbo.Customers(id),
    CONSTRAINT UQ_SurveyResults UNIQUE (survey_id, customer_id)
);
GO

-- Bảng 8: SurveyAnswers - Câu trả lời chi tiết của khảo sát
CREATE TABLE dbo.SurveyAnswers (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    survey_result_id    INT NOT NULL,
    question_id         INT NOT NULL,
    answer_value        NVARCHAR(MAX),
    CONSTRAINT FK_SurveyAnswers_Results FOREIGN KEY (survey_result_id) REFERENCES dbo.SurveyResults(id) ON DELETE CASCADE,
    CONSTRAINT FK_SurveyAnswers_Questions FOREIGN KEY (question_id) REFERENCES dbo.Questions(id)
);
GO

-- Bảng 9: Feedbacks - Phản hồi & đánh giá sản phẩm từ khách hàng
CREATE TABLE dbo.Feedbacks (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    customer_id     INT NOT NULL,
    product_id      INT NOT NULL,
    rating          TINYINT NOT NULL CONSTRAINT CK_Feedbacks_rating CHECK (rating BETWEEN 1 AND 5),
    content         NVARCHAR(MAX),
    status          NVARCHAR(10) DEFAULT 'PENDING'
                    CONSTRAINT CK_Feedbacks_status CHECK (status IN ('PENDING','REPLIED')),
    reply_content   NVARCHAR(MAX),
    created_at      DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Feedbacks_Customers FOREIGN KEY (customer_id) REFERENCES dbo.Customers(id),
    CONSTRAINT FK_Feedbacks_Products FOREIGN KEY (product_id) REFERENCES dbo.Products(id)
);
GO

-- ============================================================
-- TẠO INDEX để tối ưu hóa tìm kiếm
-- ============================================================
CREATE INDEX IX_Products_Category ON dbo.Products(category);
CREATE INDEX IX_Products_LaunchStatus ON dbo.Products(launch_status);
CREATE INDEX IX_Products_Price ON dbo.Products(price);
CREATE INDEX IX_Feedbacks_Status ON dbo.Feedbacks(status);
CREATE INDEX IX_Feedbacks_Rating ON dbo.Feedbacks(rating);
CREATE INDEX IX_Customers_Age ON dbo.Customers(age);
CREATE INDEX IX_Accounts_Role ON dbo.Accounts(role);
CREATE INDEX IX_Surveys_Status ON dbo.Surveys(status);
GO

-- ============================================================
-- CHÈN DỮ LIỆU MẪU (DML)
-- ============================================================

-- Dữ liệu tài khoản (Mật khẩu lưu dạng văn bản thuần - plain text)
INSERT INTO dbo.Accounts (username, password, full_name, email, phone, role, status) VALUES
(N'admin',    N'admin123',    N'Nguyễn Văn Admin',   N'admin@beautycrm.vn',      N'0901000001', 'ADMIN',    'ACTIVE'),
(N'manager1', N'manager123',  N'Trần Thị Lan',       N'lan.tran@beautycrm.vn',   N'0902000001', 'MANAGER',  'ACTIVE'),
(N'manager2', N'manager123',  N'Lê Minh Hương',      N'huong.le@beautycrm.vn',   N'0902000002', 'MANAGER',  'ACTIVE'),
(N'khach001', N'customer123', N'Nguyễn Thị Mai',    N'mai.nguyen@gmail.com',    N'0903000001', 'CUSTOMER', 'ACTIVE'),
(N'khach002', N'customer123', N'Phạm Thu Hà',       N'ha.pham@gmail.com',       N'0903000002', 'CUSTOMER', 'ACTIVE'),
(N'khach003', N'customer123', N'Hoàng Thị Linh',    N'linh.hoang@gmail.com',    N'0903000003', 'CUSTOMER', 'ACTIVE'),
(N'khach004', N'customer123', N'Đặng Thị Phương',   N'phuong.dang@gmail.com',   N'0903000004', 'CUSTOMER', 'ACTIVE'),
(N'khach005', N'customer123', N'Vũ Thị Nga',        N'nga.vu@gmail.com',        N'0903000005', 'CUSTOMER', 'ACTIVE'),
(N'khach006', N'customer123', N'Bùi Thị Thảo',      N'thao.bui@gmail.com',      N'0903000006', 'CUSTOMER', 'LOCKED'),
(N'khach007', N'customer123', N'Lý Thị Kim',        N'kim.ly@gmail.com',        N'0903000007', 'CUSTOMER', 'ACTIVE'),
(N'khach008', N'customer123', N'Trịnh Thị Loan',    N'loan.trinh@gmail.com',    N'0903000008', 'CUSTOMER', 'ACTIVE'),
(N'khach009', N'customer123', N'Đinh Văn Nam',      N'nam.dinh@gmail.com',      N'0903000009', 'CUSTOMER', 'ACTIVE'),
(N'khach010', N'customer123', N'Cao Thị Yến',       N'yen.cao@gmail.com',       N'0903000010', 'CUSTOMER', 'ACTIVE');
GO

-- Dữ liệu khách hàng (hồ sơ làm đẹp)
INSERT INTO dbo.Customers (account_id, age, gender, skin_type, beauty_preferences, membership_tier) VALUES
(4,  24, N'Nu', N'Da dầu',       N'Trang điểm,Chống lão hóa',       'SILVER'),
(5,  19, N'Nu', N'Da khô',       N'Chăm sóc da,Dưỡng ẩm',           'BRONZE'),
(6,  31, N'Nu', N'Da hỗn hợp',   N'Chống lão hóa,Trị mụn',          'GOLD'),
(7,  28, N'Nu', N'Da nhạy cảm',  N'Chăm sóc da,Organic',            'SILVER'),
(8,  22, N'Nu', N'Da thường',    N'Trang điểm,Chăm sóc da',         'BRONZE'),
(9,  35, N'Nu', N'Da dầu',       N'Trị mụn,Chăm sóc da',            'GOLD'),
(10, 42, N'Nu', N'Da khô',       N'Chống lão hóa,Dưỡng da',         'PLATINUM'),
(11, 17, N'Nu', N'Da thường',    N'Trang điểm,Skincare cơ bản',     'BRONZE'),
(12, 38, N'Nam', N'Da dầu',      N'Chăm sóc da,Dưỡng ẩm',          'SILVER'),
(13, 26, N'Nu', N'Da hỗn hợp',   N'Trang điểm,Chống lão hóa,Trị mụn', 'GOLD');
GO

-- Dữ liệu nhà cung cấp
INSERT INTO dbo.Suppliers (name, contact_name, email, phone, address, status) VALUES
(N'L''Oréal Paris Vietnam',      N'Nguyễn Minh Tuấn', N'contact@loreal.vn',       N'0281000001', N'12 Nguyễn Thị Minh Khai, Q.1, TP.HCM', 'ACTIVE'),
(N'Innisfree Korea Distribution',N'Kim Ji Young',       N'vn@innisfree.com',        N'0281000002', N'45 Lê Lợi, Q.1, TP.HCM',              'ACTIVE'),
(N'The Face Shop Vietnam',       N'Lê Thị Hoa',         N'contact@thefaceshop.vn',  N'0281000003', N'78 Đồng Khởi, Q.1, TP.HCM',           'ACTIVE'),
(N'Kiehl''s Vietnam',            N'Phạm Văn Đức',       N'vietnam@kiehls.com',      N'0281000004', N'23 Trần Hưng Đạo, Q.5, TP.HCM',       'ACTIVE'),
(N'Organic Beauty Co.',          N'Trần Thu Hương',     N'organic@beauty.vn',       N'0281000005', N'56 Cách Mạng Tháng Tám, Q.3, TP.HCM', 'ACTIVE'),
(N'Maybelline Vietnam',          N'Hoàng Bảo Long',     N'vn@maybelline.com',       N'0281000006', N'90 Nguyễn Huệ, Q.1, TP.HCM',          'INACTIVE');
GO

-- Dữ liệu sản phẩm mỹ phẩm
INSERT INTO dbo.Products (name, category, supplier_id, price, stock_quantity, description, launch_status) VALUES
(N'Son môi nhung mịn Velvet Matte #01 Đỏ Ruby',        N'Son môi',         1, 350000, 150, N'Son môi lâu trôi với công thức nhung mịn, màu đỏ ruby quyến rũ.',       'OFFICIAL'),
(N'Kem dưỡng da ban đêm Retinol Pro',                    N'Kem dưỡng da',    4, 680000,  80, N'Kem dưỡng chứa Retinol 0.3% và Peptide giúp tái tạo da chống nhăn.',   'OFFICIAL'),
(N'Serum Vitamin C Brightening 30ml',                    N'Serum',           2, 520000, 120, N'Serum Vitamin C 15% làm sáng da, mờ thâm nám và tăng đề kháng.',       'OFFICIAL'),
(N'Kem chống nắng SPF50+ PA++++',                        N'Kem chống nắng',  3, 280000, 200, N'Kem chống nắng phổ rộng, không nhờn rít, phù hợp da nhạy cảm.',        'OFFICIAL'),
(N'Phấn phủ kiềm dầu HD Powder',                        N'Phấn phủ',        6, 195000,  90, N'Phấn phủ kiềm dầu 8 tiếng, cho lớp nền mịn tự nhiên.',                 'OFFICIAL'),
(N'Sữa rửa mặt Green Tea Foam',                         N'Sữa rửa mặt',    2, 165000, 300, N'Sữa rửa mặt trà xanh Jeju, làm sạch dịu nhẹ và thu nhỏ lỗ chân lông.', 'OFFICIAL'),
(N'Toner cân bằng Centella Asiatica',                   N'Toner',           3, 245000, 175, N'Toner rau má phục hồi và làm dịu da, giảm đỏ và kiểm soát dầu.',       'OFFICIAL'),
(N'Mặt nạ ngủ Collagen Gold 50ml',                      N'Mặt nạ',          5, 390000,  60, N'Mặt nạ ngủ hữu cơ chứa collagen vàng và chiết xuất hoa hồng.',          'OFFICIAL'),
(N'Son môi Glossy Shine - Bộ sưu tập Hè 2026',         N'Son môi',         1, 420000,   0, N'Dòng son bóng lì cao cấp hiệu ứng môi căng bóng 3D. Ra mắt hè 2026.',  'UPCOMING'),
(N'Serum chống lão hóa Peptide Complex',                N'Serum',           4, 950000,   0, N'Serum Peptide thế hệ mới xóa nếp nhăn, tăng độ đàn hồi da.',           'UPCOMING');
GO

-- Dữ liệu chiến dịch khảo sát (Surveys)
INSERT INTO dbo.Surveys (title, description, target_product_id, start_date, end_date, status, created_by) VALUES
(N'Khảo sát thị hiếu Son môi Hè 2026', N'Thu thập ý kiến khách hàng về màu sắc, chất son và mức giá mong muốn cho dòng son Glossy Shine.', 9, '2026-06-01', '2026-08-31', 'ACTIVE', 2),
(N'Khảo sát nhu cầu Serum chống lão hóa Peptide', N'Khảo sát trải nghiệm dưỡng da chống nhăn dành cho độ tuổi 25+ trước ngày mở bán chính thức.', 10, '2026-06-15', '2026-09-30', 'ACTIVE', 3),
(N'Khảo sát mức độ hài lòng dịch vụ Quý 2/2026', N'Đánh giá chất lượng phục vụ, đóng gói và tư vấn làm đẹp của BeautyCRM.', NULL, '2026-04-01', '2026-06-30', 'ACTIVE', 2);
GO

-- Dữ liệu câu hỏi khảo sát (Questions)
INSERT INTO dbo.Questions (survey_id, question_text, question_type, options, order_index) VALUES
(1, N'Bạn thích hiệu ứng son nào nhất trong mùa hè?', 'SINGLE_CHOICE', N'["Bóng mọng nước (Glossy)","Nhung mịn lì (Velvet Matte)","Bán lì dưỡng ẩm (Satin)","Son dưỡng có màu nhẹ nhàng"]', 1),
(1, N'Tông màu son bạn thường xuyên sử dụng nhất?', 'MULTI_CHOICE', N'["Đỏ đất / Cam cháy","Hồng trà sữa / Nude","Đỏ Ruby quyến rũ","Cam san hô tươi tắn"]', 2),
(1, N'Mức giá bạn sẵn sàng chi trả cho một thỏi son cao cấp này?', 'SINGLE_CHOICE', N'["Dưới 300.000₫","Từ 300.000₫ - 450.000₫","Từ 450.000₫ - 600.000₫","Trên 600.000₫"]', 3),
(1, N'Đánh giá độ hào hứng của bạn với dòng son mới này?', 'RATING', NULL, 4),
(1, N'Bạn có góp ý gì thêm về thiết kế bao bì hay mùi hương của thỏi son không?', 'TEXT', NULL, 5),

(2, N'Vấn đề lớn nhất về da mà bạn đang muốn cải thiện?', 'SINGLE_CHOICE', N'["Nếp nhăn li ti và rãnh cười","Da chảy xệ, thiếu đàn hồi","Đốm nâu, sạm nám","Da khô sần, thiếu sức sống"]', 1),
(2, N'Đánh giá sự kỳ vọng của bạn đối với hiệu quả phục hồi da của Peptide?', 'RATING', NULL, 2),
(2, N'Bạn mong muốn sản phẩm có thêm thành phần dưỡng nào?', 'TEXT', NULL, 3),

(3, N'Đánh giá tổng quan chất lượng đóng gói và giao hàng?', 'RATING', NULL, 1),
(3, N'Bạn đánh giá thế nào về sự tận tình của đội ngũ tư vấn viên?', 'RATING', NULL, 2);
GO

-- Dữ liệu đánh giá & phản hồi của khách hàng (Feedbacks)
INSERT INTO dbo.Feedbacks (customer_id, product_id, rating, content, status, reply_content, created_at) VALUES
(1, 3, 5, N'Serum Vitamin C dùng rất êm, sau 2 tuần các vết thâm mụn mờ rõ rệt, da sáng và đều màu hơn hẳn!', 'REPLIED', N'BeautyCRM cảm ơn bạn Mai rất nhiều! Chúc bạn luôn có làn da rạng rỡ và tự tin nhé! 🌸', DATEADD(day, -5, GETDATE())),
(1, 1, 5, N'Son màu đỏ Ruby siêu tôn da, chất son mềm mướt không hề bị khô môi.', 'PENDING', NULL, DATEADD(day, -2, GETDATE())),
(2, 4, 4, N'Kem chống nắng nâng tone tự nhiên, kiềm dầu tốt tầm 5-6 tiếng, không gây bết dính.', 'REPLIED', N'Cảm ơn bạn Hà đã tin tưởng lựa chọn sản phẩm của BeautyCRM. Rất vui được tiếp tục phục vụ bạn!', DATEADD(day, -4, GETDATE())),
(3, 2, 5, N'Kem dưỡng Retinol đỉnh cao! Da căng bóng mịn màng sau 1 tháng sử dụng kiên trì.', 'PENDING', NULL, DATEADD(day, -1, GETDATE())),
(4, 6, 4, N'Sữa rửa mặt trà xanh bọt mịn, rửa xong da vẫn mềm ẩm không bị căng rát.', 'PENDING', NULL, GETDATE());
GO

PRINT N'Đã tạo CSDL và chèn dữ liệu mẫu thành công!';
PRINT N'Vui lòng chạy file backup_restore.sql để thiết lập Sao lưu & Phục hồi.';
GO
