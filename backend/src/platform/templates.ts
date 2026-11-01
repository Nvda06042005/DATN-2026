/**
 * Mẫu thư và thông báo của hệ thống (Sprint 11, HK.AD.068): bản mặc định nằm ở đây; quản trị tổng chỉ lưu bản đã chỉnh vào `hk_message_templates`
 * (xóa bản chỉnh là quay về mặc định). Chỗ trống dạng {{ten_bien}} được thay bằng dữ liệu thật khi gửi; biến lạ bị từ chối khi lưu để không gửi ra thư thô.
 */
export type TemplateKey = 'otp' | 'temp_password' | 'reminder' | 'achievement';

export interface TemplateDef { key: TemplateKey; label: string; description: string; subject: string; body: string; vars: Array<{ name: string; hint: string }> }

export const TEMPLATE_KEYS: TemplateKey[] = ['otp', 'temp_password', 'reminder', 'achievement'];

export const DEFAULT_TEMPLATES: Record<TemplateKey, TemplateDef> = {
  otp: {
    key: 'otp', label: 'Mã OTP', description: 'Thư chứa mã xác thực khi quên mật khẩu, đăng ký tự học và đăng nhập hai lớp của quản trị.',
    subject: '[Đông A EDU] Mã xác thực {{muc_dich}}',
    body: 'Chào {{ten}},\n\nĐông A EDU nhận được yêu cầu {{yeu_cau}}.\nMã xác thực của bạn là: {{ma}}\nMã có hiệu lực {{phut}} phút và chỉ dùng được một lần. Đừng chia sẻ mã này với bất kỳ ai.\n\n{{luu_y}}',
    vars: [{ name: 'ten', hint: 'Họ tên người nhận' }, { name: 'ma', hint: 'Mã 6 chữ số (bắt buộc có trong nội dung)' }, { name: 'phut', hint: 'Số phút hiệu lực' }, { name: 'muc_dich', hint: 'đặt lại mật khẩu / đăng ký tài khoản tự học / đăng nhập quản trị' }, { name: 'yeu_cau', hint: 'Câu mô tả yêu cầu' }, { name: 'luu_y', hint: 'Câu nhắc bỏ qua nếu không phải bạn' }],
  },
  temp_password: {
    key: 'temp_password', label: 'Mật khẩu tạm', description: 'Thư cấp tài khoản mới hoặc đặt lại mật khẩu kèm mật khẩu tạm.',
    subject: '[Đông A EDU] Thông tin tài khoản', // chủ đề do chức năng tạo tài khoản / đặt lại mật khẩu đặt khi xếp thư vào hàng đợi nên chỉ chỉnh được nội dung
    body: 'Chào {{ten}},\n\n{{mo_dau}}\nTên đăng nhập: {{tai_khoan}}\nMật khẩu tạm: {{mat_khau}}\nĐăng nhập tại: {{duong_dan}}\n\nLần đăng nhập đầu tiên, hệ thống sẽ yêu cầu bạn đặt mật khẩu mới. Không chia sẻ mật khẩu cho người khác.',
    vars: [{ name: 'ten', hint: 'Họ tên người nhận' }, { name: 'mo_dau', hint: 'Câu mở đầu (cấp tài khoản hoặc đặt lại mật khẩu)' }, { name: 'tai_khoan', hint: 'Tên đăng nhập' }, { name: 'mat_khau', hint: 'Mật khẩu tạm (bắt buộc có trong nội dung)' }, { name: 'duong_dan', hint: 'Địa chỉ trang đăng nhập' }, { name: 'vai_tro', hint: 'Vai trò' }, { name: 'truong', hint: 'Tên trường' }],
  },
  reminder: {
    key: 'reminder', label: 'Nhắc học', description: 'Thông báo và thư nhắc học hằng ngày khi học sinh chưa học hôm nay.',
    subject: '[Đông A EDU] Nhắc học hôm nay',
    body: 'Chào {{ten}},\n\nHôm nay em chưa học bài nào trên Đông A EDU. {{chuoi}}\nChỉ cần vài phút là giữ được nhịp học!\n\nVào học tại: {{duong_dan}}',
    vars: [{ name: 'ten', hint: 'Họ tên học sinh' }, { name: 'chuoi', hint: 'Câu nói về chuỗi ngày học' }, { name: 'duong_dan', hint: 'Địa chỉ trang học sinh' }],
  },
  achievement: {
    key: 'achievement', label: 'Thông báo thành tích', description: 'Thông báo khi học sinh lên cấp, nhận huy hiệu hoặc được giáo viên thưởng điểm.',
    subject: '[Đông A EDU] Chúc mừng {{ten}}!',
    body: 'Chào {{ten}},\n\n{{thanh_tich}}\n\nTiếp tục phát huy nhé!',
    vars: [{ name: 'ten', hint: 'Họ tên học sinh' }, { name: 'thanh_tich', hint: 'Mô tả thành tích (bắt buộc có trong nội dung)' }],
  },
};

/** Biến bắt buộc phải còn trong nội dung (nếu không thư mất tác dụng) */
export const REQUIRED_VARS: Partial<Record<TemplateKey, string[]>> = { otp: ['ma'], temp_password: ['mat_khau'], achievement: ['thanh_tich'] };

export const fill = (text: string, vars: Record<string, string | number>): string => text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all));

/** Trả danh sách lỗi (rỗng nếu hợp lệ) khi lưu một mẫu đã chỉnh */
export function checkTemplate(key: TemplateKey, subject: string, body: string): string[] {
  const def = DEFAULT_TEMPLATES[key];
  const allowed = new Set(def.vars.map((v) => v.name));
  const errors: string[] = [];
  const used = new Set<string>();
  for (const m of `${subject}\n${body}`.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)) {
    if (!allowed.has(m[1])) errors.push(`Biến {{${m[1]}}} không có trong mẫu này`);
    used.add(m[1]);
  }
  for (const need of REQUIRED_VARS[key] ?? []) if (!body.includes(`{{${need}}}`)) errors.push(`Nội dung phải có {{${need}}}`);
  if (key !== 'temp_password' && subject.trim().length < 3) errors.push('Tiêu đề từ 3 ký tự');
  if (body.trim().length < 5) errors.push('Nội dung từ 5 ký tự');
  return [...new Set(errors)];
}
