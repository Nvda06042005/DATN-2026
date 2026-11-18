/**
 * Họ tên viết hoa chữ cái đầu mỗi từ, các chữ sau viết thường (yêu cầu 18/11/2026): "Nguyễn Vũ Đức Anh" được; "Nguyễn vũ Đức Anh", "NGUYỄN VŨ" thì không.
 * Từ toàn chữ số ("Quản Trị 2") được nhận. Dùng chung cho tạo / sửa tài khoản và người liên hệ của trường (frontend/lib/person-name.ts cùng quy tắc).
 */
export const properName = (name: string): string => name.normalize('NFC').trim().split(/\s+/).filter(Boolean)
  .map((w) => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1).toLocaleLowerCase('vi')).join(' ');

/** Câu báo lỗi kèm cách viết đúng, hoặc null khi hợp lệ */
export function nameCaseError(name: string | null | undefined): string | null {
  const text = String(name ?? '').normalize('NFC').trim();
  if (!text) return null;
  const ok = text.split(/\s+/).every((w) => /^\p{Lu}[\p{Ll}\p{M}]*$/u.test(w) || /^\d+$/.test(w));
  return ok ? null : `Họ và tên phải viết hoa chữ cái đầu mỗi từ, ví dụ “${properName(text)}”`;
}
