/**
 * Chấm điểm và kiểm tra cấu trúc câu hỏi (HK.GV.032, HK.HS.044–045): thuần hàm, không cần cơ sở dữ liệu.
 */
import { bonusPoints, distanceKm, grade, normalizeAnswer, normalizeData, publicView, seededShuffle, starsFor } from '../src/content/questions';
import { estimateMinutes, normalizeBlocks } from '../src/content/lesson.service';

const opts = (...texts: string[]) => texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));

describe('kiểm tra cấu trúc câu hỏi', () => {
  test('một đáp án: cần 2–6 lựa chọn, đáp án đúng nằm trong lựa chọn, không trùng nội dung', () => {
    expect(normalizeData('single', { options: opts('A', 'B', 'C'), correct: 'b' }, 'Đề')).toEqual({ options: opts('A', 'B', 'C'), correct: 'b' });
    expect(() => normalizeData('single', { options: opts('A'), correct: 'a' }, 'Đề')).toThrow(/2 đến 6/);
    expect(() => normalizeData('single', { options: opts('A', 'B'), correct: 'z' }, 'Đề')).toThrow(/đáp án đúng/);
    expect(() => normalizeData('single', { options: opts('A', 'a'), correct: 'a' }, 'Đề')).toThrow(/trùng nội dung/);
    expect(normalizeData('single', { options: ['Một', 'Hai'], correct: 'a' }, 'Đề')).toEqual({ options: opts('Một', 'Hai'), correct: 'a' });
  });

  test('nhiều đáp án: ít nhất 2 đúng và không phải tất cả', () => {
    expect(() => normalizeData('multiple', { options: opts('A', 'B', 'C'), correct: ['a'] }, 'Đề')).toThrow(/ít nhất 2/);
    expect(() => normalizeData('multiple', { options: opts('A', 'B', 'C'), correct: ['a', 'b', 'c'] }, 'Đề')).toThrow(/tất cả/);
    expect(normalizeData('multiple', { options: opts('A', 'B', 'C'), correct: ['a', 'c', 'a'] }, 'Đề')).toEqual({ options: opts('A', 'B', 'C'), correct: ['a', 'c'] });
  });

  test('điền khuyết: số chỗ trống ____ trong đề phải bằng số đáp án', () => {
    expect(normalizeData('fill', { blanks: [{ accept: ['1288'] }, ['Bạch Đằng', 'Bạch Đằng Giang']] }, 'Năm ____ trên sông ____')).toEqual({
      blanks: [{ accept: ['1288'] }, { accept: ['Bạch Đằng', 'Bạch Đằng Giang'] }],
    });
    expect(() => normalizeData('fill', { blanks: [{ accept: ['1288'] }] }, 'Năm ____ trên sông ____')).toThrow(/2 chỗ trống/);
    expect(() => normalizeData('fill', { blanks: [{ accept: [] }] }, 'Năm ____')).toThrow();
  });

  test('sắp xếp cần 3–8 mục; bản đồ cần tọa độ trong khung Việt Nam và bán kính hợp lệ', () => {
    expect(() => normalizeData('order', { items: opts('A', 'B') }, 'Đề')).toThrow(/3 đến 8/);
    expect(normalizeData('map', { targets: [{ label: 'Bạch Đằng', lat: 20.9, lng: 106.8 }] }, 'Đề')).toEqual({
      targets: [{ id: 'a', label: 'Bạch Đằng', lat: 20.9, lng: 106.8, radius_km: 40 }],
    });
    expect(() => normalizeData('map', { targets: [{ label: 'Paris', lat: 48.8, lng: 2.3 }] }, 'Đề')).toThrow(/khung bản đồ/);
    expect(() => normalizeData('map', { targets: [{ label: 'X', lat: 20, lng: 106, radius_km: 1 }] }, 'Đề')).toThrow(/Bán kính/);
    expect(() => normalizeData('truefalse', { correct: 'yes' }, 'Đề')).toThrow();
  });
});

describe('chấm điểm từng dạng', () => {
  test('một đáp án, nhiều đáp án, đúng/sai', () => {
    const single = { qtype: 'single' as const, data: { options: opts('A', 'B'), correct: 'b' } };
    expect(grade(single, { choice: 'b' }).correct).toBe(true);
    expect(grade(single, { choice: 'a' }).correct).toBe(false);
    expect(grade(single, 'rác').correct).toBe(false);
    expect(grade(single, null).correct).toBe(false);
    const multi = { qtype: 'multiple' as const, data: { options: opts('A', 'B', 'C'), correct: ['a', 'c'] } };
    expect(grade(multi, { choices: ['c', 'a'] }).correct).toBe(true);
    expect(grade(multi, { choices: ['a'] }).correct).toBe(false);
    expect(grade(multi, { choices: ['a', 'b', 'c'] }).correct).toBe(false);
    const tf = { qtype: 'truefalse' as const, data: { correct: false } };
    expect(grade(tf, { value: false }).correct).toBe(true);
    expect(grade(tf, { value: 'false' }).correct).toBe(false);
  });

  test('điền khuyết: không phân biệt hoa thường, khoảng trắng và dấu câu cuối; vẫn phân biệt dấu tiếng Việt', () => {
    const fill = { qtype: 'fill' as const, data: { blanks: [{ accept: ['1288'] }, { accept: ['Bạch Đằng', 'Bạch Đằng Giang'] }] } };
    expect(grade(fill, { blanks: ['1288', '  bạch   đằng. '] }).correct).toBe(true);
    expect(grade(fill, { blanks: ['1288', 'Bạch Đằng Giang'] }).correct).toBe(true);
    expect(grade(fill, { blanks: ['1288', 'Bach Dang'] }).correct).toBe(false);
    expect(grade(fill, { blanks: ['1288'] }).correct).toBe(false);
    expect(normalizeAnswer('  “Bạch  Đằng!” ')).toBe('bạch đằng');
  });

  test('sắp xếp đúng thứ tự mới đúng', () => {
    const order = { qtype: 'order' as const, data: { items: opts('Diên Hồng', 'Hàm Tử', 'Bạch Đằng') } };
    expect(grade(order, { order: ['a', 'b', 'c'] }).correct).toBe(true);
    expect(grade(order, { order: ['a', 'c', 'b'] }).correct).toBe(false);
    expect(grade(order, { order: ['a', 'b'] }).correct).toBe(false);
  });

  test('bản đồ: đúng khi mọi địa danh nằm trong bán kính cho phép', () => {
    const map = { qtype: 'map' as const, data: { targets: [{ id: 'a', label: 'Bạch Đằng', lat: 20.9, lng: 106.8, radius_km: 30 }, { id: 'b', label: 'Thăng Long', lat: 21.03, lng: 105.85, radius_km: 20 }] } };
    const near = grade(map, { placements: { a: { lat: 20.95, lng: 106.75 }, b: { lat: 21.0, lng: 105.8 } } });
    expect(near.correct).toBe(true);
    const far = grade(map, { placements: { a: { lat: 20.95, lng: 106.75 }, b: { lat: 10.8, lng: 106.7 } } });
    expect(far.correct).toBe(false);
    expect((far.detail as Array<{ id: string; ok: boolean }>).map((d) => d.ok)).toEqual([true, false]);
    expect(grade(map, { placements: { a: { lat: 20.9, lng: 106.8 } } }).correct).toBe(false);
    expect(Math.round(distanceKm({ lat: 21.03, lng: 105.85 }, { lat: 10.78, lng: 106.7 }))).toBeGreaterThan(1100);
  });
});

describe('hiển thị cho học sinh không lộ đáp án', () => {
  const base = { id: 1, prompt: 'Đề', image_url: null, explanation: 'Giải thích bí mật', difficulty: 2 };

  test('dạng lựa chọn không có trường correct; xáo trộn theo hạt giống ổn định', () => {
    const q = { ...base, qtype: 'single' as const, data: { options: opts('A', 'B', 'C', 'D', 'E'), correct: 'c' } };
    const view = publicView(q, 7, true) as { options: Array<{ id: string }> };
    expect(JSON.stringify(view)).not.toMatch(/correct|bí mật/);
    expect(view.options.map((o) => o.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(publicView(q, 7, true)).toEqual(view);
    expect((publicView(q, 7, false) as { options: Array<{ id: string }> }).options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('sắp xếp luôn bị xáo khác thứ tự đúng; bản đồ chỉ lộ tên địa danh', () => {
    const order = { ...base, qtype: 'order' as const, data: { items: opts('A', 'B', 'C') } };
    for (let seed = 0; seed < 40; seed++) {
      const ids = (publicView(order, seed, false) as { items: Array<{ id: string }> }).items.map((i) => i.id);
      expect(ids).not.toEqual(['a', 'b', 'c']);
    }
    const map = { ...base, qtype: 'map' as const, data: { targets: [{ id: 'a', label: 'Bạch Đằng', lat: 20.9, lng: 106.8, radius_km: 30 }] } };
    const view = JSON.stringify(publicView(map, 1, false));
    expect(view).toContain('Bạch Đằng');
    expect(view).not.toMatch(/20\.9|106\.8|radius/);
    expect(seededShuffle([1, 2, 3, 4, 5, 6], 3)).toEqual(seededShuffle([1, 2, 3, 4, 5, 6], 3));
  });
});

describe('thưởng tốc độ và sao', () => {
  test('thưởng tối đa nửa điểm gốc, giảm dần theo thời gian, không âm', () => {
    expect(bonusPoints(100, 20, 0)).toBe(50);
    expect(bonusPoints(100, 20, 10_000)).toBe(25);
    expect(bonusPoints(100, 20, 20_000)).toBe(0);
    expect(bonusPoints(100, 20, 90_000)).toBe(0);
    expect(bonusPoints(100, 20, -500)).toBe(50);
  });

  test('sao: chưa đạt 0; đạt 1; từ 80% là 2; 3 sao khi đúng tuyệt đối hoặc ≥90% và nhanh', () => {
    expect(starsFor(50, 60, 0.2)).toBe(0);
    expect(starsFor(60, 60, 0.9)).toBe(1);
    expect(starsFor(79, 60, 0.1)).toBe(1);
    expect(starsFor(80, 60, 0.9)).toBe(2);
    expect(starsFor(95, 60, 0.9)).toBe(2);
    expect(starsFor(95, 60, 0.6)).toBe(3);
    expect(starsFor(100, 60, 1)).toBe(3);
    expect(starsFor(70, 70, 1)).toBe(1);
  });
});

describe('khối nội dung bài học', () => {
  test('chuẩn hóa văn bản, hình, video, bản đồ; từ chối liên kết không https và tọa độ ngoài Việt Nam', () => {
    const blocks = normalizeBlocks([
      { type: 'text', heading: ' Bối cảnh ', text: 'Năm 1258 quân Mông Cổ tiến vào Đại Việt.' },
      { type: 'image', url: 'https://example.org/a.jpg', caption: 'Bản đồ' },
      { type: 'map', lat: 21.03, lng: 105.85, label: 'Thăng Long' },
    ]);
    expect(blocks[0]).toEqual({ type: 'text', heading: 'Bối cảnh', text: 'Năm 1258 quân Mông Cổ tiến vào Đại Việt.' });
    expect(blocks[2]).toMatchObject({ type: 'map', zoom: 7 });
    expect(() => normalizeBlocks([{ type: 'image', url: 'http://example.org/a.jpg' }])).toThrow(/https/);
    expect(() => normalizeBlocks([{ type: 'map', lat: 48, lng: 2, label: 'Paris' }])).toThrow(/Việt Nam/);
    expect(() => normalizeBlocks([{ type: 'script', text: 'x' }])).toThrow();
    expect(estimateMinutes(blocks)).toBeGreaterThanOrEqual(1);
  });
});
