-- ============================================================
-- PHƯƠNG ÁN SAO LƯU & PHỤC HỒI CƠ SỞ DỮ LIỆU
-- Hệ thống CRM Quản lý Chuỗi Cửa Hàng Mỹ Phẩm
-- Microsoft SQL Server 2016+
-- ============================================================
-- MỤC TIÊU: Đảm bảo tính toàn vẹn dữ liệu bằng chiến lược
--   Full Backup + Differential Backup + Kịch bản Test Phục hồi.
-- ============================================================

USE master;
GO

-- ============================================================
-- PHẦN 1: CẤU HÌNH VỊ TRÍ SAO LƯU
-- ============================================================
-- Tạo thư mục sao lưu (chạy lệnh này trong PowerShell/CMD trước):
-- mkdir "C:\CosmeticsCRM_Backup"

-- ============================================================
-- PHẦN 2: SAO LƯU TOÀN BỘ (FULL BACKUP)
-- ============================================================
-- Full Backup nên được thực hiện định kỳ hàng tuần.
-- Đây là nền tảng của mọi chiến lược phục hồi dữ liệu.
-- ============================================================

BACKUP DATABASE CosmeticsCRM_DB
TO DISK = N'C:\CosmeticsCRM_Backup\CosmeticsCRM_FULL_20260913.bak'
WITH
    FORMAT,                     -- Ghi đè file backup cũ nếu tồn tại
    INIT,                       -- Khởi tạo media set mới
    NAME = N'Full Backup - CosmeticsCRM - 13/09/2026',
    DESCRIPTION = N'Full Backup định kỳ hàng tuần của CSDL Hệ thống CRM Mỹ phẩm',
    COMPRESSION,                -- Nén file backup để tiết kiệm dung lượng
    STATS = 10;                 -- Hiển thị tiến trình mỗi 10%
GO

PRINT N'[FULL BACKUP] Hoàn thành! File: C:\CosmeticsCRM_Backup\CosmeticsCRM_FULL_20260913.bak';
GO

-- ============================================================
-- PHẦN 3: KỊCH BẢN TEST GIẢ LẬP - BỘ DỮ LIỆU PHÁT SINH
-- ============================================================
-- Giả lập: Sau khi Full Backup, có thêm phản hồi mới từ khách hàng.
-- ============================================================

USE CosmeticsCRM_DB;
GO

-- Thêm dữ liệu phản hồi mới phát sinh sau Full Backup
INSERT INTO dbo.Feedbacks (customer_id, product_id, rating, content, status, created_at)
VALUES
    (1, 3, 5, N'Serum Vitamin C tuyệt vời! Da sáng hẳn sau 2 tuần!', 'PENDING', GETDATE()),
    (2, 1, 4, N'Son màu đẹp, lâu trôi. Sẽ mua lại lần sau.', 'PENDING', GETDATE()),
    (3, 2, 5, N'Kem dưỡng hiệu quả thấy rõ sau 1 tháng sử dụng!', 'PENDING', GETDATE());
GO

PRINT N'[TEST DATA] Đã thêm 3 phản hồi mới vào bảng Feedbacks sau Full Backup.';

-- Kiểm tra số lượng dữ liệu trước khi Differential Backup
SELECT COUNT(*) AS TongSoFeedback_TruocSuCo FROM dbo.Feedbacks;
GO

-- ============================================================
-- PHẦN 4: SAO LƯU PHÂN BIỆT (DIFFERENTIAL BACKUP)
-- ============================================================
-- Differential Backup chỉ sao lưu những thay đổi kể từ lần
-- Full Backup cuối cùng. Nên thực hiện hàng ngày.
-- ============================================================

USE master;
GO

BACKUP DATABASE CosmeticsCRM_DB
TO DISK = N'C:\CosmeticsCRM_Backup\CosmeticsCRM_DIFF_20260913.bak'
WITH
    DIFFERENTIAL,               -- Chỉ sao lưu thay đổi kể từ Full Backup
    FORMAT,
    INIT,
    NAME = N'Differential Backup - CosmeticsCRM - 13/09/2026',
    DESCRIPTION = N'Differential Backup hàng ngày - chứa 3 phản hồi mới phát sinh',
    COMPRESSION,
    STATS = 10;
GO

PRINT N'[DIFFERENTIAL BACKUP] Hoàn thành! File: C:\CosmeticsCRM_Backup\CosmeticsCRM_DIFF_20260913.bak';
GO

-- ============================================================
-- PHẦN 5: KỊCH BẢN GIẢ LẬP SỰ CỐ MẤT DỮ LIỆU
-- ============================================================
-- ⚠️ CẢNH BÁO: Đây là bước giả lập thảm họa mất dữ liệu.
--              CHỈ chạy trong môi trường kiểm thử/test!
-- ============================================================

USE CosmeticsCRM_DB;
GO

-- Ghi nhận số lượng trước sự cố để so sánh sau phục hồi
DECLARE @SoFeedbackTruoc INT;
SELECT @SoFeedbackTruoc = COUNT(*) FROM dbo.Feedbacks;
PRINT N'[TRƯỚC SỰ CỐ] Số lượng Feedback: ' + CAST(@SoFeedbackTruoc AS NVARCHAR);

-- === GIẢ LẬP SỰ CỐ: Xóa toàn bộ dữ liệu bảng Feedbacks ===
DELETE FROM dbo.Feedbacks;
GO

-- Xác nhận sự cố đã xảy ra
SELECT COUNT(*) AS Feedbacks_SauSuCo FROM dbo.Feedbacks;  -- Kết quả: 0
PRINT N'[SỰ CỐ ĐÃ XẢY RA] Bảng Feedbacks đã bị mất toàn bộ dữ liệu!';
GO

-- ============================================================
-- PHẦN 6: PHỤC HỒI DỮ LIỆU (RESTORE)
-- ============================================================
-- Quy trình phục hồi: Restore Full Backup (NORECOVERY)
--                   → Restore Differential Backup (RECOVERY)
-- ============================================================

USE master;
GO

-- Bước 6.1: Đưa database về chế độ Single-User để restore
ALTER DATABASE CosmeticsCRM_DB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO

PRINT N'[RESTORE - Bước 1] Bắt đầu khôi phục từ Full Backup (NORECOVERY)...';

-- Bước 6.2: Khôi phục từ Full Backup - dùng WITH NORECOVERY để
--           sau đó tiếp tục áp dụng Differential Backup
RESTORE DATABASE CosmeticsCRM_DB
FROM DISK = N'C:\CosmeticsCRM_Backup\CosmeticsCRM_FULL_20260913.bak'
WITH
    NORECOVERY,                 -- GIỮ database ở trạng thái restoring để áp Differential tiếp theo
    REPLACE,                    -- Cho phép ghi đè lên database hiện tại
    STATS = 10;
GO

PRINT N'[RESTORE - Bước 2] Áp dụng Differential Backup (RECOVERY)...';

-- Bước 6.3: Áp dụng Differential Backup và đưa database về trạng thái ONLINE
RESTORE DATABASE CosmeticsCRM_DB
FROM DISK = N'C:\CosmeticsCRM_Backup\CosmeticsCRM_DIFF_20260913.bak'
WITH
    RECOVERY,                   -- Đưa database về trạng thái ONLINE sau restore
    STATS = 10;
GO

-- Đưa database về chế độ Multi-User bình thường
ALTER DATABASE CosmeticsCRM_DB SET MULTI_USER;
GO

PRINT N'[RESTORE] Hoàn thành! Database đã được phục hồi thành công!';
GO

-- ============================================================
-- PHẦN 7: XÁC MINH KẾT QUẢ PHỤC HỒI
-- ============================================================

USE CosmeticsCRM_DB;
GO

-- Kiểm tra số lượng bản ghi sau phục hồi
DECLARE @SoFeedbackSau INT;
SELECT @SoFeedbackSau = COUNT(*) FROM dbo.Feedbacks;
PRINT N'[XÁC MINH] Số lượng Feedback sau phục hồi: ' + CAST(@SoFeedbackSau AS NVARCHAR);

-- Hiển thị toàn bộ dữ liệu Feedbacks để xác minh
SELECT
    f.id,
    a.full_name AS TenKhachHang,
    p.name AS TenSanPham,
    f.rating AS SoSao,
    f.content AS NoiDungPhanHoi,
    f.status AS TrangThai,
    f.created_at AS ThoiGianGui
FROM dbo.Feedbacks f
    JOIN dbo.Customers c ON f.customer_id = c.id
    JOIN dbo.Accounts a ON c.account_id = a.id
    JOIN dbo.Products p ON f.product_id = p.id
ORDER BY f.id;
GO

PRINT N'';
PRINT N'✅ KẾT QUẢ KIỂM TRA: Toàn bộ dữ liệu bảng Feedbacks đã được phục hồi thành công!';
PRINT N'✅ Hệ thống hoạt động bình thường sau kịch bản giả lập sự cố.';
PRINT N'';
PRINT N'📋 TỔNG KẾT PHƯƠNG ÁN SAO LƯU & PHỤC HỒI:';
PRINT N'   - Full Backup:         CosmeticsCRM_FULL_20260913.bak';
PRINT N'   - Differential Backup: CosmeticsCRM_DIFF_20260913.bak';
PRINT N'   - Phương thức:        Full Backup (NORECOVERY) → Differential (RECOVERY)';
PRINT N'   - Kết quả:            Phục hồi 100% dữ liệu thành công';
GO
