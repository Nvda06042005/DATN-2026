export type AnswerShape = 'triangle' | 'diamond' | 'circle' | 'square';

/** Bảng màu + hình đáp án chuẩn Kahoot (Đỏ ▲, Lam ◆, Vàng ●, Lục ■); fg là màu chữ đạt tương phản trên nền ô */
export const ANSWER_STYLES: Array<{
  shape: AnswerShape;
  bg: string;
  shadow: string;
  fg: string;
  label: string;
}> = [
  { shape: 'triangle', bg: '#e21b3c', shadow: '#b0142f', fg: '#ffffff', label: 'Đỏ' },
  { shape: 'diamond', bg: '#1368ce', shadow: '#0e4fa0', fg: '#ffffff', label: 'Lam' },
  { shape: 'circle', bg: '#d89e00', shadow: '#a87b00', fg: '#1f1600', label: 'Vàng' },
  { shape: 'square', bg: '#26890c', shadow: '#1c6609', fg: '#ffffff', label: 'Lục' },
];
