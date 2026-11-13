-- Bỏ hẳn "Email phụ huynh" (yêu cầu 13/11/2026: "xóa trường email phụ huynh này vĩnh viễn"). Người dùng cho phép rõ ràng việc xóa
-- vĩnh viễn trường này, nên cột app_users.parent_email (thêm ở 013) bị xóa cùng dữ liệu. Không còn view, hàm hay quyền theo cột nào dùng cột này.
ALTER TABLE public.app_users DROP COLUMN IF EXISTS parent_email;
