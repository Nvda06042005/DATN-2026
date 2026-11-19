/**
 * Thang danh hiệu của sảnh học sinh (20/11/2026): năm bậc lấy cảm hứng từ khoa cử thời Trần. Đây chỉ là cách hiển thị tiến độ mà máy chủ
 * đã trả về ở /api/saga/home (phần đã xong, số sao) – không trao thưởng, không lưu gì ở giao diện.
 *   Học trò (bắt đầu) → Thái học sinh (xong Phần 1 · 1258) → Thám hoa (xong Phần 2 · 1285) → Bảng nhãn (xong Phần 3 · 1287–1288)
 *   → Trạng nguyên (đủ sao tối đa của cả ba phần).
 * Dữ kiện (Wikipedia tiếng Việt, đối chiếu 20/11/2026): học vị Thái học sinh có từ khoa thi Nhâm Thìn (1232) đời Trần Thái Tông; Tam khôi đặt lần đầu
 * năm 1247 – Trạng nguyên Nguyễn Hiền (các nguồn chép 12 hoặc 13 tuổi), Bảng nhãn Lê Văn Hưu (soạn Đại Việt sử ký, xong năm 1272), Thám hoa Đặng Ma La.
 */
export interface RankDef { key: string; name: string; need: string; note: string }
export interface RankState { level: number; next: { done: number; total: number; unit: 'chặng' | 'sao' } | null }
interface CampaignProgress { campaign_no: number; stages: number; done: number; stars: number; max_stars: number; completed: boolean }

export const RANKS: ReadonlyArray<RankDef> = [
  { key: 'hoc-tro', name: 'Học trò', need: 'Bắt đầu hành trình', note: 'Người theo đèn sách, chuẩn bị lều chõng đi thi. Mọi bạn bắt đầu hành trình từ đây.' },
  { key: 'thai-hoc-sinh', name: 'Thái học sinh', need: 'Hoàn thành Phần 1 · 1258', note: 'Học vị thời Trần cấp cho người đỗ kỳ thi Hội, có từ khoa thi Nhâm Thìn (1232) đời Trần Thái Tông.' },
  { key: 'tham-hoa', name: 'Thám hoa', need: 'Hoàn thành Phần 2 · 1285', note: 'Người đỗ thứ ba trong Tam khôi. Tam khôi được đặt lần đầu năm 1247 thời Trần; Thám hoa khoa thi ấy là Đặng Ma La.' },
  { key: 'bang-nhan', name: 'Bảng nhãn', need: 'Hoàn thành Phần 3 · 1287–1288', note: 'Người đỗ thứ hai trong Tam khôi. Bảng nhãn khoa 1247 là Lê Văn Hưu – người về sau soạn bộ Đại Việt sử ký, hoàn thành năm 1272.' },
  { key: 'trang-nguyen', name: 'Trạng nguyên', need: 'Đạt đủ sao ở cả ba phần', note: 'Người đỗ đầu trong Tam khôi. Trạng nguyên khoa 1247 là Nguyễn Hiền, được coi là trạng nguyên trẻ nhất lịch sử khoa cử Việt Nam (các nguồn chép 12 hoặc 13 tuổi).' },
];

/** Bậc danh hiệu: số phần đã xong liên tiếp từ Phần 1 (tối đa 3), thêm một bậc khi đủ sao tối đa của cả ba phần; kèm tiến độ tới bậc kế tiếp */
export function scholarRank(campaigns: ReadonlyArray<CampaignProgress> | null | undefined): RankState {
  const camps = [...(campaigns ?? [])].sort((a, b) => a.campaign_no - b.campaign_no);
  let level = 0;
  for (const c of camps.slice(0, 3)) { if (c.stages > 0 && c.completed) level += 1; else break; }
  const stars = camps.reduce((n, c) => n + c.stars, 0), max = camps.reduce((n, c) => n + c.max_stars, 0);
  if (level === 3 && max > 0 && stars >= max) level = 4;
  if (level >= 4) return { level, next: null };
  if (level === 3) return { level, next: { done: Math.min(stars, max), total: max, unit: 'sao' } };
  const c = camps[level];
  return { level, next: c ? { done: Math.max(0, Math.min(c.done, c.stages)), total: c.stages, unit: 'chặng' } : null };
}
