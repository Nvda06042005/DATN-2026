/** Quy tắc mật khẩu mới; giữ đồng bộ với backend/src/auth/password-policy.ts. */
export const PASSWORD_POLICY = /^(?=.*\p{Lu})(?=.*\p{Ll})(?=.*\p{N})(?=.*[\p{P}\p{S}])[^\p{C}]{12,72}$/u;
export const PASSWORD_MESSAGE = 'Mật khẩu cần ít nhất 12 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.';
export const PASSWORD_HINT = 'Ít nhất 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt (ví dụ @, #, !).';
export const PASSWORD_MAX_BYTES_MESSAGE = 'Mật khẩu tối đa 72 byte UTF-8 (ký tự có dấu có thể chiếm nhiều byte).';

/** Đếm UTF-8 trên cả web/native, không cắt hoặc chuẩn hóa mật khẩu người dùng. */
export function newPasswordError(password: string): string | null {
  if (!PASSWORD_POLICY.test(password)) return PASSWORD_MESSAGE;
  let bytes = 0;
  for (const character of password) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes > 72 ? PASSWORD_MAX_BYTES_MESSAGE : null;
}
