# Tự đồng bộ code local lên GitHub, Render, Supabase và Vercel

Người dùng cho phép ngày 01/11/2026: theo dõi file local và tự gộp nhánh đang làm vào `main` sau khi toàn bộ kiểm tra đạt. Bộ theo dõi chạy trên Windows bằng Node.js; không phụ thuộc vào việc cuộc chat còn mở.

## Bật và xem trạng thái

Chạy tại thư mục chứa `render.yaml`:

```powershell
# Tự chạy ẩn khi đăng nhập Windows, theo cả các nhánh làm việc tiếp theo.
.\scripts\auto-sync.ps1 -Action Install -SourceBranch feat/hao-khi-v02-sprint-6 -AllowMergeToMain -FollowCurrentBranch

.\scripts\auto-sync.ps1 -Action Status
.\scripts\auto-sync.ps1 -Action Stop
.\scripts\auto-sync.ps1 -Action Start
.\scripts\auto-sync.ps1 -Action Uninstall
```

`Install` chỉ tạo `DongA-AutoSync.vbs` trong Startup của người dùng hiện tại, rồi chạy Node ẩn. Không tạo tác vụ quản trị hay lưu thêm mật khẩu. `Stop` chờ bước kiểm tra hiện tại kết thúc và không bắt đầu push mới; `Uninstall` còn gỡ mục Startup. `Start` dùng lại cấu hình đã lưu. Muốn khóa vào một nhánh, gọi `Start -SourceBranch <tên> -AllowMergeToMain` khi worker đã dừng, bỏ `-FollowCurrentBranch`.

Máy phải đang bật, người dùng đã đăng nhập Windows, có mạng, GitHub đã đăng nhập trong Git Credential Manager, Node.js và PostgreSQL (`initdb`, `pg_ctl`) đã cài. Máy ngủ/tắt thì việc đồng bộ tạm dừng, tiếp tục khi worker hoạt động lại. Nếu đổi vị trí thư mục dự án, cần `Uninstall` rồi `Install` tại vị trí mới.

## Một lượt đồng bộ

1. Mỗi 15 giây đọc trạng thái Git; đợi 120 giây không thay đổi. Theo dõi backend, API, frontend, migration, script, tài liệu và cấu hình triển khai. Tôn trọng `.gitignore`, bỏ qua `.env`, dữ liệu local, khóa riêng, bản dump và file build; chặn một số dạng bí mật rõ ràng. Đây không phải công cụ bảo đảm phát hiện mọi bí mật.
2. Chụp chính xác nội dung Git vào index riêng, gộp với `origin/main` trong worktree `.auto-sync/release`. Không chuyển nhánh hay ghi đè file đang mở của người dùng. Nếu người dùng đã staging file hoặc có xung đột thì chờ.
3. Chạy kiểm thử bộ theo dõi; cài sạch bằng npm 10.9.4; backend build, kiểm tra file SQL và toàn bộ kiểm thử trên PostgreSQL tạm; frontend typecheck, kiểm thử, build. Thiếu PostgreSQL thì dừng, không coi các bài bị bỏ qua là đạt. Không đọc `.env` của máy vào bản sao thử nghiệm.
4. So lại code local và `origin/main`. Có thay đổi trong lúc kiểm tra thì thử lại phiên bản mới. Nếu đạt, tạo commit trên nhánh nguồn và push nhánh nguồn cùng `main` bằng `git push --atomic`, không force-push. Các chỉnh sửa tiếp sau bản chụp vẫn ở trạng thái chưa commit để kiểm tra vào lượt kế tiếp. Khi dùng `FollowCurrentBranch`, việc chuyển sang nhánh khác cũng được theo dõi tự động.
5. Render tự deploy từ `main`, backend chạy migration mới qua `DATABASE_URL` đã có trên Render. Vercel tự deploy cùng nhánh. Đây là áp dụng migration khi backend khởi động, không phải replication dữ liệu local thời gian thực.
6. Chỉ ghi `synced` sau khi `/api/health` trả đúng commit Render, `/api/database/health` đạt schema cần thiết và `/build-info.json` trên Vercel trả cùng commit. Không coi HTTP 200 của bản cũ là đã triển khai. Sau 20 phút chưa xác minh được thì ghi lỗi để kiểm tra Logs; không đẩy lặp lại commit cũ. Code sửa lỗi mới vẫn được kiểm tra và phát hành tiếp.

## Nhật ký và lỗi

- `.auto-sync/status.json`: pha hiện tại, nhánh, heartbeat, lý do chờ/lỗi và commit phát hành.
- `.auto-sync/worker.log`: nhật ký điều phối; `.auto-sync/checks.log`: đầu ra kiểm tra.
- `.auto-sync/last-release.json`: commit/schema đang chờ hoặc đã xác minh.
- Toàn bộ `.auto-sync/` bị loại khỏi Git. Không đặt credential vào các file cấu hình này.

Lỗi build/test không được push; có thay đổi mới sẽ chạy lại sau 2 phút. Cùng một lỗi chưa sửa được thử lại tối đa một lần mỗi 10 phút. Git từ chối push, đăng nhập hết hạn, xung đột hoặc code đang staging đều được ghi là `blocked`; cần xử lý nguyên nhân. Nếu có công cụ/agent khác chuẩn bị commit hoặc gộp nhánh, nên `Stop`, chờ `stopped`, thực hiện công việc rồi `Start` để tránh hai lượt phát hành cạnh tranh.

Migration đã commit không được sửa/xóa. Migration mới có `DROP TABLE/SCHEMA/DATABASE/TYPE`, `DROP COLUMN`, `TRUNCATE` hoặc `DELETE FROM` bị chặn để kiểm tra và phát hành thủ công theo quy tắc giữ dữ liệu. Các kiểm tra chuỗi SQL chỉ là lớp chặn bổ sung; vẫn phải xem lại mọi thay đổi có nguy cơ mất dữ liệu.

## Thông tin phiên bản công khai

- Render tự cung cấp [`RENDER_GIT_COMMIT`](https://render.com/docs/environment-variables); `/api/health` chỉ công khai SHA hợp lệ, không trả biến môi trường khác.
- Vercel cung cấp [`VERCEL_GIT_COMMIT_SHA`](https://vercel.com/docs/environment-variables/system-environment-variables); script build ghi SHA và thời gian vào `dist/build-info.json`.
- Không cần thêm token Render/Vercel/Supabase cho worker. GitHub kết nối bằng tài khoản Git đã có trên máy; biến kết nối database vẫn chỉ nằm trên Render.

Kiểm tra cơ chế gộp/push trên Git local tạm: `node --test scripts/auto-sync.test.mjs`. Các bài thử cố ý làm lỗi kiểm tra, sửa file giữa chừng và đổi migration để xác minh không phát hành nhầm.
