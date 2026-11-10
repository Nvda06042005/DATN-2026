/**
 * Số điện thoại của quản trị tổng, quản trị viên trường, giáo viên và học sinh: đúng 10 chữ số, không dấu cách hay ký hiệu.
 * (Điện thoại liên hệ của trường không thuộc quy tắc này.) Khớp với ràng buộc của máy chủ.
 */
export const PHONE_LENGTH = 10;

/** Chỉ giữ chữ số và cắt còn tối đa 10: dán "0901 234 567" hay "+84 901…" vẫn ra dãy số, gõ thừa thì bỏ phần thừa. */
export const cleanPhone = (text: string | null | undefined): string => String(text ?? '').replace(/\D/g, '').slice(0, PHONE_LENGTH);

/** Giá trị cũ có dấu cách hoặc dấu gạch mà đúng 10 chữ số thì làm sạch; không thì giữ nguyên để người dùng thấy cảnh báo và tự sửa (không tự cắt cụt dữ liệu). */
export const normalizePhone = (text: string | null | undefined): string => {
  const raw = String(text ?? '');
  const digits = raw.replace(/\D/g, '');
  return digits.length === PHONE_LENGTH ? digits : raw;
};

/** Cảnh báo dưới ô số điện thoại; `overflow`: người dùng vừa gõ hoặc dán thừa chữ số. */
export const phoneWarning = (value: string, overflow = false): string | null => {
  if (overflow) return `Số điện thoại chỉ gồm ${PHONE_LENGTH} chữ số; phần thừa đã bị bỏ.`;
  if (!value) return null;
  if (/\D/.test(value)) return 'Số điện thoại chỉ gồm chữ số, không dấu cách hay ký hiệu.';
  if (value.length < PHONE_LENGTH) return `Số điện thoại gồm đúng ${PHONE_LENGTH} chữ số (đang có ${value.length}).`;
  return null;
};

/** Lỗi khi lưu: có nhập thì phải đúng 10 chữ số; để trống là hợp lệ (ô bắt buộc do biểu mẫu kiểm tra riêng). */
export const phoneError = (value: string | null | undefined): string | null =>
  value && !/^\d{10}$/.test(value) ? `Số điện thoại gồm đúng ${PHONE_LENGTH} chữ số.` : null;
