/**
 * Cỡ chữ của mã giáo viên / mã học sinh trong cột chia đều: mã luôn nằm trên một dòng, nên chữ co lại theo độ rộng của ô (tối đa 13, tối thiểu 10).
 * Hệ số 0,65 em cho mỗi ký tự là mức dự phòng so với số đo mã thật (cỡ 13: 16 ký tự rộng 130px, 18 ký tự 140px, 20 ký tự 166px, tức khoảng 0,6 đến 0,64 em).
 */
export const CODE_FONT_MAX = 13;
export const CODE_FONT_MIN = 10;
export const CODE_CHAR_EM = 0.65;

export const codeFontSize = (width: number, chars: number): number =>
  width > 0 && chars > 0 ? Math.max(CODE_FONT_MIN, Math.min(CODE_FONT_MAX, Math.floor(width / (chars * CODE_CHAR_EM)))) : CODE_FONT_MAX;
