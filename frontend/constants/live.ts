/** Phạm vi câu hỏi khi mở phòng (khớp SCOPE_CATEGORIES ở backend/app/api/live.py) */
export const LIVE_SCOPES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Cả bài' },
  { id: '1258', label: 'Lần 1 (1258)' },
  { id: '1285', label: 'Lần 2 (1285)' },
  { id: '1288', label: 'Lần 3 (1287–1288)' },
];

export const LIVE_COUNTS = [5, 10, 15] as const;
