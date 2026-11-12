/**
 * Cỡ chữ của mã giáo viên / mã học sinh trong bảng: mã giáo viên và mã học sinh dùng **cùng một cỡ** (12) để hai bảng đồng nhất; cột mã rộng đủ cho mã 18 ký tự
 * (HSGOT2612122008001) ở cỡ này. Chỉ khi mã dài hơn (tên trường viết tắt dài) chữ mới co dần, thấp nhất 10, để vẫn nằm trên một dòng.
 * Hệ số 0,64 em cho mỗi ký tự là mức lớn nhất đo được trên mã thật (cỡ 13: 16 ký tự 130px, 18 ký tự 140px, 20 ký tự 166px).
 */
export const CODE_FONT_MAX = 12;
export const CODE_FONT_MIN = 10;
export const CODE_CHAR_EM = 0.64;

export const codeFontSize = (width: number, chars: number): number =>
  width > 0 && chars > 0 ? Math.max(CODE_FONT_MIN, Math.min(CODE_FONT_MAX, Math.floor(width / (chars * CODE_CHAR_EM)))) : CODE_FONT_MAX;
