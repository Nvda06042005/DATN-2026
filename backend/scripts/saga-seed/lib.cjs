/**
 * Phần dùng chung khi soạn nội dung khởi tạo của Hành trình Đông A (migration 066): nguồn tham khảo, cảnh khám phá dựng sẵn và hàm rút gọn để viết câu luyện tập, đơn vị trận đánh.
 * Dữ kiện lịch sử trong các tệp chặng được đối chiếu với các bài "Chiến tranh Nguyên Mông – Đại Việt lần 1 / 2 / 3", "Trận Bạch Đằng (1288)" của Wikipedia tiếng Việt
 * (tải ngày 15/11/2026) và hai bài của Bảo tàng Lịch sử quốc gia về cọc và trận Bạch Đằng. Lời thoại, nhân vật phụ và chỉ số trận đánh là phần sáng tạo của trò chơi.
 */
const W1 = 'https://vi.wikipedia.org/wiki/Chi%E1%BA%BFn_tranh_Nguy%C3%AAn_M%C3%B4ng_%E2%80%93_%C4%90%E1%BA%A1i_Vi%E1%BB%87t_l%E1%BA%A7n_1';
const W2 = 'https://vi.wikipedia.org/wiki/Chi%E1%BA%BFn_tranh_Nguy%C3%AAn_M%C3%B4ng_%E2%80%93_%C4%90%E1%BA%A1i_Vi%E1%BB%87t_l%E1%BA%A7n_2';
const W3 = 'https://vi.wikipedia.org/wiki/Chi%E1%BA%BFn_tranh_Nguy%C3%AAn_M%C3%B4ng_%E2%80%93_%C4%90%E1%BA%A1i_Vi%E1%BB%87t_l%E1%BA%A7n_3';
const WBD = 'https://vi.wikipedia.org/wiki/Tr%E1%BA%ADn_B%E1%BA%A1ch_%C4%90%E1%BA%B1ng_(1288)';

const SRC = {
  w1: { key: 'w1', title: 'Chiến tranh Nguyên Mông – Đại Việt lần 1', publisher: 'Wikipedia tiếng Việt (dẫn Đại Việt sử ký toàn thư, Nguyên sử)', url: W1, note: 'Bản đồ gốc của bài: Chongquannguyenlan1.svg, tác giả Lưu Ly, phạm vi công cộng.' },
  w2: { key: 'w2', title: 'Chiến tranh Nguyên Mông – Đại Việt lần 2', publisher: 'Wikipedia tiếng Việt (dẫn Đại Việt sử ký toàn thư, Nguyên sử; Hà Văn Tấn – Phạm Thị Tâm)', url: W2, note: 'Một số chi tiết các nguồn chép khác nhau; nội dung chỉ dùng phần các nguồn thống nhất.' },
  w3: { key: 'w3', title: 'Chiến tranh Nguyên Mông – Đại Việt lần 3', publisher: 'Wikipedia tiếng Việt (dẫn Đại Việt sử ký toàn thư, Nguyên sử, Khâm định Việt sử thông giám cương mục)', url: W3, note: null },
  wbd: { key: 'wbd', title: 'Trận Bạch Đằng (1288)', publisher: 'Wikipedia tiếng Việt (dẫn Đại Việt sử ký toàn thư, Nguyên sử)', url: WBD, note: null },
  coc: { key: 'coc', title: 'Cọc Bạch Đằng', publisher: 'Bảo tàng Lịch sử quốc gia', url: 'https://baotanglichsu.vn/vi/Articles/1002/28186/coc-bach-djang.html', note: 'Hiện vật cọc gỗ lim phát hiện tại sông Chanh (Quảng Ninh) năm 1976.' },
  manhghep: { key: 'manhghep', title: 'Trận thủy chiến Bạch Đằng: Những mảnh ghép', publisher: 'Bảo tàng Lịch sử quốc gia (đăng lại từ Tia Sáng)', url: 'https://baotanglichsu.vn/VI/Articles/3096/71341/tran-thuy-chien-bach-djang-nhung-manh-ghep.html', note: 'Tổng hợp kết quả khảo cổ các bãi cọc Yên Giang, Đồng Vạn Muối, Đồng Má Ngựa.' },
};

/** Ghi chú chung về phần sáng tạo, hiện ở màn tổng kết của mọi chặng */
const FICTION = 'Nhân vật “tiểu tướng” do em điều khiển, những người lính, dân làng không có tên trong sử và mọi lời thoại là phần sáng tạo của trò chơi. Các chỉ số máu, sát thương, số lượt là quy ước để chơi, không phải số liệu lịch sử; thắng hay thua trong trò chơi không làm thay đổi kết quả lịch sử.';

// ---------------------------------------------------------------------- cảnh khám phá dựng sẵn (22 cột × 13 dòng)
// Ô đi được: . cỏ  , cỏ hoa  = đường đất  _ sân gạch  : cát  + cầu ván.  Vật cản: T cây  B tre  H nhà  h lều  # rào/tường  % ruộng  ~ nước  b thuyền  D trống  f cờ  c bao lương  W giếng  P cột  w mái điện  L gỗ  S cọc  F bếp lửa  R đá
const SCENES = {
  camp: [
    'TTTTTTTTTT==TTTTTTTTTT',
    'T########.==.########T',
    'T#h.h..f..==..f..h.h#T',
    'T#........==........#T',
    'T#..c.....==.....D..#T',
    'T#==================#T',
    'T#..F.....==........#T',
    'T#........==...c.c..#T',
    'T#.h...h..==........#T',
    'T#........==..f.....#T',
    'T########.==.########T',
    'TTTTTTTTT.==.TTTTTTTTT',
    '.........====.........',
  ],
  village: [
    'BBBBBBBBBB==BBBBBBBBBB',
    'B.H..H....==....H..H.B',
    'B.........==.........B',
    'B..,...W..==..,......B',
    'B====================B',
    'B.........==.........B',
    'B.H.......==....%%%%.B',
    'B.....T...==....%%%%.B',
    'B..c......==....%%%%.B',
    'B.........==.........B',
    'B.~~~.....==..H...H..B',
    'B.~~~.....==.........B',
    'BBBBBBBBBB==BBBBBBBBBB',
  ],
  riverside: [
    'TTTTTTTTTTTTTTTTTTTTTT',
    'T....h....==.....h...T',
    'T.........==.........T',
    'T..f......==......c..T',
    'T====================T',
    'T.........==.........T',
    'T...T.....==...D.....T',
    'T.........==.........T',
    '::::::::::++::::::::::',
    '~~~~b~~~~~++~~~~~b~~~~',
    '~~~~~~~~~~++~~~~~~~~~~',
    '~~~~~~~b~~~~~~b~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~',
  ],
  palace: [
    'wwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwww____wwwwwwwww',
    '#__P______________P__#',
    '#____________________#',
    '#__P______________P__#',
    '#____________________#',
    '#__f______________f__#',
    '#____________________#',
    '#__P______________P__#',
    '#____________________#',
    '#########____#########',
    '..T......====......T..',
    '.........====.........',
  ],
  shipyard: [
    'TTTTTTTTTTTTTT::::~~~~',
    'T....L.L.....:::::~~~~',
    'T............::::~~~~~',
    'T..h.........::S:~~~~~',
    'T===============:::~~~',
    'T............::::~~~~~',
    'T...L..S.....:::::~~~~',
    'T............::S::~~~~',
    'T..F.........:::::++~~',
    'T............::::~b~~~',
    'T..c.c.......:::~~~~~~',
    'T............::~~~~~~~',
    'TTTTTTTTTTTTT:~~~~~~~~',
  ],
};

// ---------------------------------------------------------------------- câu luyện tập
const LETTERS = 'abcd';
const opts = (texts) => texts.map((text, i) => ({ id: LETTERS[i], text }));
/** Trắc nghiệm: `correct` là thứ tự (0..3) của đáp án đúng trong `options` */
const quiz = (code, objective, source, prompt, options, correct, explanation, usage = 'both') => ({ code, kind: 'quiz', usage, objective, source, prompt, data: { options: opts(options), correct: LETTERS[correct] }, explanation });
/** Quyết định chiến thuật: mỗi phương án là [nội dung, điểm 0|1|2, phản hồi]; đúng một phương án 2 điểm */
const tactic = (code, objective, source, prompt, situation, options, explanation, usage = 'both') => ({ code, kind: 'tactic', usage, objective, source, prompt, data: { situation, options: options.map(([text, score, feedback], i) => ({ id: LETTERS[i], text, score, feedback })) }, explanation });
/** Xếp trình tự: các mốc viết theo đúng thứ tự, mỗi mốc là [nội dung, thời điểm] */
const sequence = (code, objective, source, prompt, items, explanation, usage = 'both') => ({ code, kind: 'sequence', usage, objective, source, prompt, data: { items: items.map(([text, when], i) => ({ id: `m${i + 1}`, text, ...(when ? { when } : {}) })) }, explanation });
/** Lật thẻ ghép cặp: mỗi cặp là [vế trái, vế phải] */
const pairs = (code, objective, source, prompt, leftLabel, rightLabel, list, explanation) => ({ code, kind: 'pairs', usage: 'practice', objective, source, prompt, data: { left_label: leftLabel, right_label: rightLabel, pairs: list.map(([left, right], i) => ({ id: `p${i + 1}`, left, right })) }, explanation });
/** Chọn địa điểm trên bản đồ: mỗi điểm là [tên, x, y] theo tỉ lệ ảnh; `correct` là thứ tự điểm đúng */
const locate = (code, objective, source, prompt, campaignNo, spots, correct, explanation, usage = 'both') => ({ code, kind: 'locate', usage, objective, source, prompt, data: { campaign_no: campaignNo, spots: spots.map(([label, x, y], i) => ({ id: `s${i + 1}`, label, x, y })), correct: `s${correct + 1}` }, explanation });

// ---------------------------------------------------------------------- đơn vị trận đánh
/** Đơn vị: unit(mã, tên, binh chủng, hàng, HP, công, thủ, tốc độ, hình, {skill, tags, ranged, note}) */
const unit = (id, name, cls, row, hp, atk, def, spd, sprite, extra = {}) => ({ id, name, cls, row, hp, atk, def, spd, sprite, ...extra });
const skill = (name, text, kind, cost, cooldown, extra = {}) => ({ id: 'skill', name, text, kind, cost, cooldown, ...extra });

module.exports = { SRC, FICTION, SCENES, quiz, tactic, sequence, pairs, locate, unit, skill };
