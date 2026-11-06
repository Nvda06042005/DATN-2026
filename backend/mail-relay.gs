/**
 * Cầu gửi thư cho backend Đông A (Render Free chặn cổng SMTP, chỉ cho HTTPS).
 * Backend POST JSON tới Web App này, script gửi thư bằng Gmail của chủ script (MailApp). Đây là mã Google Apps Script,
 * không chạy trong dự án Node: sao chép vào script.google.com theo các bước dưới đây.
 *
 * Cài đặt (làm một lần, đăng nhập đúng tài khoản Gmail sẽ dùng để gửi thư):
 *  1. Mở https://script.google.com > Dự án mới > dán toàn bộ file này vào Code.gs.
 *  2. Cài đặt dự án (bánh răng) > Thuộc tính tập lệnh > Thêm thuộc tính: tên MAIL_RELAY_SECRET, giá trị là chuỗi bí mật dài
 *     (trùng với MAIL_RELAY_SECRET của backend).
 *  3. Chọn hàm authorize > Chạy > cấp quyền gửi email. Google có thể cảnh báo "ứng dụng chưa xác minh": chọn Nâng cao >
 *     Đi tới dự án (không an toàn); script này là của chính bạn.
 *  4. Triển khai > Tùy chọn triển khai mới > loại "Ứng dụng web": Thực thi bằng "Tôi", Người có quyền truy cập "Bất kỳ ai" >
 *     Triển khai. Sao chép URL kết thúc bằng /exec làm MAIL_RELAY_URL của backend.
 *  5. Sửa mã sau này: Triển khai > Quản lý bản triển khai > Chỉnh sửa > Phiên bản mới (URL giữ nguyên).
 *
 * Giới hạn của Google: Gmail cá nhân gửi tối đa khoảng 100 người nhận mỗi ngày qua MailApp (Google Workspace khoảng 1.500).
 * Quá hạn mức thì script trả lỗi và backend thử lại theo hàng đợi. Thư luôn đi từ Gmail của chủ script, "Tên" lấy từ MAIL_FROM.
 */

/** Chạy một lần trong trình soạn thảo để Google hỏi quyền gửi email */
function authorize() {
  return MailApp.getRemainingDailyQuota();
}

function doPost(e) {
  var secret = PropertiesService.getScriptProperties().getProperty('MAIL_RELAY_SECRET');
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'bad_request' });
  }
  if (!secret || data.secret !== secret) return reply({ ok: false, error: 'unauthorized' });
  // Kiểm tra địa chỉ và khóa khi backend khởi động: không gửi thư
  if (data.action === 'verify') return reply({ ok: true, quota: MailApp.getRemainingDailyQuota() });
  if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(String(data.to || ''))) return reply({ ok: false, error: 'bad_recipient' });
  try {
    MailApp.sendEmail({
      to: data.to,
      subject: String(data.subject || ''),
      body: String(data.text || ''),
      htmlBody: data.html ? String(data.html) : undefined,
      name: data.name ? String(data.name) : 'Đông A EDU',
    });
    return reply({ ok: true, quota: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
