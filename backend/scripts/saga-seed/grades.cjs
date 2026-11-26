/**
 * Nội dung của bốn chiến dịch theo khối 6–9 (25/11/2026, bản vẽ "Binh thư Sát Thát"), sinh thành migration 083 bằng build-grades.cjs.
 *   Khối 6 · Tân binh   – Bạch Đằng 938 (chặng mở đầu, mới) + kháng chiến lần thứ nhất 1258 (3 chặng có sẵn) · nhận biết
 *   Khối 7 · Đội trưởng – kháng chiến lần thứ hai 1285 (6 chặng có sẵn) · thông hiểu
 *   Khối 8 · Tướng quân – kháng chiến lần thứ ba 1287–1288 (4 chặng có sẵn) · vận dụng
 *   Khối 9 · Nguyên soái – tổng kết ba lần kháng chiến (4 chặng mới, không thêm sự kiện mới) · vận dụng cao
 * Mỗi khối 24 câu Hội đồng (luyện tập), mỗi câu thuộc đúng một chặng nên không trùng giữa các khối.
 * Dữ kiện: bài "Trận Bạch Đằng (938)", "Ngô Quyền" (Wikipedia tiếng Việt, tải 25/11/2026) và các thẻ, tư liệu đã kiểm chứng của migration 066
 * (ba bài "Chiến tranh Nguyên Mông – Đại Việt lần 1/2/3", "Trận Bạch Đằng (1288)", "Trần Hưng Đạo", Bảo tàng Lịch sử quốc gia).
 * Lời thoại trong các trận hội đồng, tên các bô lão và mọi chỉ số là phần sáng tạo của trò chơi; dòng "Lịch sử" của mỗi lượt lấy từ nguồn.
 */
const { SRC, quiz, tactic, sequence, pairs } = require('./lib.cjs');

const W938 = { key: 'w938', title: 'Trận Bạch Đằng (938)', publisher: 'Wikipedia tiếng Việt (dẫn Đại Việt sử ký toàn thư)', url: 'https://vi.wikipedia.org/wiki/Tr%E1%BA%ADn_B%E1%BA%A1ch_%C4%90%E1%BA%B1ng_(938)', note: 'Các nguồn chép khác nhau về quân số của quân ta; nội dung chỉ dùng phần các nguồn thống nhất.' };
const WTHD = { key: 'wthd', title: 'Trần Hưng Đạo', publisher: 'Wikipedia tiếng Việt (dẫn Đại Việt sử ký toàn thư)', url: 'https://vi.wikipedia.org/wiki/Tr%E1%BA%A7n_H%C6%B0ng_%C4%90%E1%BA%A1o', note: null };
const COUNCIL_FICTION = 'Lời thoại trong hội đồng, các nhân vật không có tên trong sử (bô lão, tướng tá phụ) và mọi thanh chỉ số là phần sáng tạo của trò chơi. Dòng “Lịch sử” của mỗi lượt lấy từ nguồn ghi bên dưới; thắng hay thua trong trò chơi không làm thay đổi kết quả lịch sử.';

/** Một phương án của trận hội đồng: [loại thẻ, nội dung, điểm 0|1|2, lời đáp, tác động lên thanh chỉ số, lời em nói (không bắt buộc)] */
const opt = (id, tag, text, score, reply, effect, say = null) => ({ id, tag, text, score, reply, effect, ...(say ? { say } : {}) });

/** Bốn khối (bảng hk_saga_grades) */
const grades = [
  { grade: 6, tag: 'KHỐI 6 · TÂN BINH', role: 'Tân binh', level: 'Nhận biết', title: 'Bạch Đằng 938 và kháng chiến lần thứ nhất (1258)', forms: 'Ghép thẻ, nhận diện',
    note: 'Nối bài học Ngô Quyền (Lịch sử 6) với kháng chiến lần thứ nhất.', reward: 'Lên bậc Thái học sinh · thẻ Ngô Quyền, Trần Thái Tông, Trần Thủ Độ' },
  { grade: 7, tag: 'KHỐI 7 · ĐỘI TRƯỞNG', role: 'Đội trưởng', level: 'Thông hiểu', title: 'Kháng chiến lần thứ hai chống quân Nguyên (1285)', forms: 'Sắp xếp sự kiện, chỉ trên bản đồ',
    note: 'Nội dung chính của Lịch sử 7 (chương trình 2018).', reward: 'Lên bậc Thám hoa · thẻ Trần Quốc Toản, Trần Quang Khải, Trần Nhật Duật' },
  { grade: 8, tag: 'KHỐI 8 · TƯỚNG QUÂN', role: 'Tướng quân', level: 'Vận dụng', title: 'Kháng chiến lần thứ ba chống quân Nguyên (1287–1288)', forms: 'Đọc tư liệu, xử lý tình huống',
    note: 'Phần mở rộng, ngoại khóa: vận dụng kiến thức Lịch sử 7.', reward: 'Lên bậc Bảng nhãn · thẻ huyền thoại Trần Hưng Đạo · khung “Sóng Bạch Đằng”' },
  { grade: 9, tag: 'KHỐI 9 · NGUYÊN SOÁI', role: 'Nguyên soái', level: 'Vận dụng cao', title: 'Tổng kết: Hào khí Đông A qua ba lần kháng chiến', forms: 'Lập bảng so sánh, tranh biện',
    note: 'Phần mở rộng, ngoại khóa: tổng hợp, so sánh, không thêm sự kiện mới.', reward: 'Đủ sao cả bốn khối → đỗ Trạng nguyên · khung “Hoa sen vàng” · giao diện Hoàng thành' },
];

/** Thẻ nhân vật mới */
const cards = [
  { code: 'ngo-quyen', name: 'Ngô Quyền', title: 'Tiền Ngô Vương', rarity: 'epic', years: '898 – 944',
    intro: 'Người Đường Lâm, con rể và là tướng của Dương Đình Nghệ. Năm 939 ông xưng vương, đóng đô ở Cổ Loa, mở đầu nhà Ngô.',
    role_text: 'Năm 938 đánh tan thủy quân Nam Hán trên sông Bạch Đằng bằng bãi cọc nhọn và con nước thủy triều, chấm dứt hơn một nghìn năm Bắc thuộc.',
    quote: null, quote_source: null, source: 'Wikipedia tiếng Việt, bài “Ngô Quyền” và “Trận Bạch Đằng (938)”', source_url: 'https://vi.wikipedia.org/wiki/Ng%C3%B4_Quy%E1%BB%81n', portrait: 'ngo-quyen' },
];

// ---------------------------------------------------------------------- Khối 6 · chặng mở đầu: Bạch Đằng 938
const bachDang938 = {
  code: 'bach-dang-938', campaign_no: null, grade: 6, title: 'Bạch Đằng 938', place: 'Sông Bạch Đằng (Quảng Ninh – Hải Phòng)', date_label: 'Cuối năm 938', kind: 'battle', icon: 'waves',
  summary: 'Ngô Quyền cắm cọc nhọn dưới lòng sông Bạch Đằng, nhử thuyền Nam Hán vào lúc nước triều còn cao rồi đánh khi triều rút. Nhà Trần dùng lại bài học này năm 1288.',
  map_x: 0.5, map_y: 0.5, unlock_after: null, pass_percent: 70, reward_xp: 100, reward_gold: 30, card_code: 'ngo-quyen', badge_code: null,
  content: {
    order: { by: 'Lời dẫn', text: 'Năm 938, thủy quân Nam Hán sắp vượt biển vào cửa sông Bạch Đằng. Em theo Ngô Quyền dò xét dòng sông, nhặt đủ thẻ Binh thư rồi cùng hội đồng bàn kế đánh giặc.' },
    objectives: [
      { id: 'o1', text: 'Trình bày được cách Ngô Quyền dùng bãi cọc và thủy triều để đánh thắng quân Nam Hán năm 938.' },
      { id: 'o2', text: 'Nêu được ý nghĩa của chiến thắng Bạch Đằng năm 938 và mối liên hệ với trận Bạch Đằng năm 1288.' },
    ],
    sources: [W938],
    cards: [
      { id: 'c1', kind: 'why', title: 'Giặc lấy cớ cứu Kiều Công Tiễn', objective: 'o1', source: 'w938', art: 'envoy',
        body: 'Cuối năm 937, Kiều Công Tiễn giết Dương Đình Nghệ để cướp quyền rồi sai người mang vàng bạc sang cầu cứu nhà Nam Hán. Vua Nam Hán Lưu Cung nhân cơ hội sai con là Lưu Hoằng Tháo đem quân thủy sang đánh Tĩnh Hải quân.',
        facts: [{ label: 'Chỉ huy giặc', value: 'Lưu Hoằng Tháo' }, { label: 'Quân Nam Hán', value: 'Khoảng 2 vạn' }] },
      { id: 'c2', kind: 'how', title: 'Diệt kẻ phản trước', objective: 'o1', source: 'w938', art: 'swords',
        body: 'Ngô Quyền đem quân từ Ái Châu ra Bắc, tiến tới thành Đại La. Kiều Công Tiễn bị cô lập, không chống nổi và bị giết khi quân Nam Hán còn chưa tới biên giới.',
        facts: [{ label: 'Nơi diệt Kiều Công Tiễn', value: 'Thành Đại La' }] },
      { id: 'c3', kind: 'where', title: 'Lòng sông Bạch Đằng', objective: 'o1', source: 'w938', art: 'river',
        body: 'Sông Bạch Đằng (nay thuộc Quảng Yên, Quảng Ninh và Thủy Nguyên, Hải Phòng) là cửa ngõ đường thủy từ biển vào. Nước triều ở đây lên xuống mạnh. Ngô Quyền cho cắm cọc nhọn dưới lòng sông; khi triều lên, bãi cọc chìm khuất dưới nước.',
        facts: [{ label: 'Điều then chốt', value: 'Thủy triều lên – xuống' }] },
      { id: 'c4', kind: 'when', title: 'Nhử lúc triều cao, đánh lúc triều rút', objective: 'o1', source: 'w938', art: 'boat',
        body: 'Thấy thuyền ta nhẹ, quân ít, thuyền Nam Hán hùng hổ tiến vào cửa sông. Ngô Quyền cho quân bỏ chạy lên thượng lưu. Đợi nước triều rút, quân ta mới đổ ra đánh: thuyền lớn của giặc mắc cạn, bị cọc đâm thủng gần hết.',
        facts: [{ label: 'Nhử giặc', value: 'Khi nước triều còn cao' }, { label: 'Phản công', value: 'Khi nước triều rút' }] },
      { id: 'c5', kind: 'why', title: 'Chấm dứt Bắc thuộc', objective: 'o2', source: 'w938', art: 'star',
        body: 'Lưu Hoằng Tháo tử trận cùng hơn một nửa quân sĩ; vua Nam Hán phải rút quân. Năm 939 Ngô Quyền xưng vương, đóng đô ở Cổ Loa, chấm dứt hơn một nghìn năm Bắc thuộc. Năm 1288, nhà Trần lại dùng bãi cọc và con nước trên chính dòng sông này.',
        facts: [{ label: 'Năm 939', value: 'Ngô Quyền xưng vương' }, { label: 'Kinh đô', value: 'Cổ Loa' }] },
    ],
    battle: {
      mode: 'council', style: 'command', title: 'Hội đồng của Ngô Quyền',
      intro: 'Quân Nam Hán sắp tới. Em cùng các tướng bàn từng việc: đánh ai trước, đánh ở đâu, nhử giặc lúc nào và phản công lúc nào.',
      cast: [{ id: 'ngoquyen', name: 'Ngô Quyền', role: 'Người cầm quân', fictional: false }, { id: 'tuong', name: 'Viên tướng tham mưu', role: 'Nhân vật hư cấu', fictional: true }],
      meters: [{ id: 'the', label: 'Thế trận của ta', start: 25, win: 70 }],
      rounds: [
        { id: 'r1', who: 'Viên tướng tham mưu', label: 'Đánh ai trước', ask: 'Kiều Công Tiễn giết Dương Đình Nghệ rồi cầu cứu Nam Hán. Giặc ngoài sắp tới, kẻ phản ở trong. Ta nên làm gì trước?',
          history: 'Ngô Quyền tiến ra thành Đại La, giết Kiều Công Tiễn khi quân Nam Hán còn chưa tới biên giới.',
          options: [
            opt('a', 'Thế trận', 'Diệt Kiều Công Tiễn trước, để giặc mất người dẫn đường', 2, 'Phải! Trong yên thì ngoài mới đánh được.', { the: 15 }),
            opt('b', 'Thế trận', 'Đợi đánh xong giặc ngoài rồi mới tính', 0, 'Để kẻ phản ở sau lưng, giặc tới thì ta bị đánh cả hai mặt.', { the: -5 }),
            opt('c', 'Ngoại giao', 'Sai sứ sang Nam Hán xin hòa', 0, 'Giặc đã có cớ sang đánh, xin hòa lúc này chỉ làm lòng quân rối.', { the: -10 }),
          ] },
        { id: 'r2', who: 'Ngô Quyền', label: 'Nơi đánh giặc', ask: 'Thuyền Nam Hán to và đông, thuyền ta nhẹ và ít. Theo em, ta nên đánh giặc ở đâu?',
          history: 'Ngô Quyền cho cắm cọc nhọn dưới lòng sông Bạch Đằng, nơi nước triều lên xuống mạnh.',
          options: [
            opt('a', 'Địa thế', 'Bày bãi cọc nhọn ở cửa sông Bạch Đằng', 2, 'Thuyền to vào đây mà vướng cọc thì không còn mạnh nữa.', { the: 20 }),
            opt('b', 'Địa thế', 'Ra biển chặn đánh thuyền lớn', 0, 'Ngoài biển thuyền giặc to, ta yếu thế hơn hẳn.', { the: -10 }),
            opt('c', 'Địa thế', 'Rút về giữ thành Đại La', 1, 'Giữ thành thì an toàn nhưng để giặc vào sâu trong đất ta.', { the: 5 }),
          ] },
        { id: 'r3', who: 'Viên tướng tham mưu', label: 'Lúc nhử giặc', ask: 'Bãi cọc đã đóng xong. Khi nào cho thuyền nhẹ ra nhử giặc vào cửa sông?',
          history: 'Thấy thuyền ta nhẹ, quân ít, thuyền Nam Hán đuổi vào cửa sông; quân ta bỏ chạy lên thượng lưu (giặc phải vào bãi cọc khi nước triều còn cao, cọc chưa lộ).',
          options: [
            opt('a', 'Thời cơ', 'Lúc nước triều còn cao, bãi cọc chìm khuất', 2, 'Giặc không thấy cọc nên cứ đuổi theo.', { the: 15 }),
            opt('b', 'Thời cơ', 'Lúc nước triều đã rút, cọc nhô lên', 0, 'Cọc lộ ra rồi, giặc thấy thì tránh xa ngay.', { the: -10 }),
            opt('c', 'Thời cơ', 'Đánh luôn khi giặc vừa tới cửa biển', 1, 'Đánh sớm quá thì giặc chưa vào tới bãi cọc.', { the: 0 }),
          ] },
        { id: 'r4', who: 'Ngô Quyền', label: 'Lúc phản công', ask: 'Thuyền giặc đã đuổi vào khúc sông có cọc. Ta đổ quân ra đánh lúc nào?',
          history: 'Đợi nước triều rút, quân ta đổ ra đánh; thuyền lớn của giặc mắc cạn, bị cọc đâm thủng gần hết, Lưu Hoằng Tháo tử trận.',
          options: [
            opt('a', 'Thời cơ', 'Khi nước triều rút, thuyền giặc mắc cọc', 2, 'Đúng lúc rồi! Thuyền giặc vỡ, quân giặc rối loạn.', { the: 15 }),
            opt('b', 'Thời cơ', 'Ngay lúc triều đang lên cao', 0, 'Nước còn cao, thuyền giặc vẫn đi lại được.', { the: -10 }),
            opt('c', 'Thời cơ', 'Đợi tới hôm sau cho chắc', 0, 'Để lỡ con nước thì giặc thoát khỏi bãi cọc.', { the: -10 }),
          ] },
      ],
      tips: ['Đọc lại thẻ “Lòng sông Bạch Đằng” và “Nhử lúc triều cao, đánh lúc triều rút” trước khi chọn.'],
      win_text: 'Thủy quân Nam Hán tan vỡ trên sông Bạch Đằng. Năm sau Ngô Quyền xưng vương, đất nước mở ra thời kỳ độc lập.',
      lose_text: 'Kế đánh chưa thành. Hãy xem lại thứ tự: diệt kẻ phản, chọn nơi có bãi cọc, nhử giặc lúc triều cao, đánh khi triều rút.',
    },
    debrief: {
      title: 'Bạch Đằng 938: mưu giỏi mà đánh cũng giỏi',
      paragraphs: [
        'Cuối năm 937, Kiều Công Tiễn giết Dương Đình Nghệ rồi cầu cứu nhà Nam Hán. Ngô Quyền đem quân ra Bắc, giết Kiều Công Tiễn ở thành Đại La trước khi quân Nam Hán do Lưu Hoằng Tháo chỉ huy kéo tới.',
        'Cuối năm 938, Ngô Quyền cho cắm cọc nhọn dưới lòng sông Bạch Đằng. Thuyền Nam Hán đuổi theo thuyền nhẹ của ta vào cửa sông; đợi nước triều rút, quân ta đổ ra đánh, thuyền lớn của giặc mắc cạn và bị cọc đâm thủng gần hết. Lưu Hoằng Tháo tử trận.',
        'Đại Việt sử ký toàn thư chép lời bàn khen Ngô Quyền “mưu giỏi mà đánh cũng giỏi”. Năm 939 ông xưng vương, đóng đô ở Cổ Loa, chấm dứt hơn một nghìn năm Bắc thuộc. Năm 1288, Trần Hưng Đạo lại dùng bãi cọc và con nước trên chính dòng sông này để đánh tan thủy quân Nguyên.',
      ],
      sources: ['w938'], fiction: COUNCIL_FICTION,
    },
  },
  items: [
    quiz('g6-938-q1', 'o1', 'w938', 'Ai chỉ huy quân ta đánh thắng quân Nam Hán trên sông Bạch Đằng năm 938?', ['Ngô Quyền', 'Trần Hưng Đạo', 'Dương Đình Nghệ', 'Kiều Công Tiễn'], 0,
      'Ngô Quyền chỉ huy trận Bạch Đằng năm 938. Trần Hưng Đạo chỉ huy trận Bạch Đằng năm 1288; Dương Đình Nghệ bị Kiều Công Tiễn giết năm 937.'),
    pairs('g6-938-p1', 'o1', 'w938', 'Lật thẻ và ghép mỗi nhân vật với việc làm của người đó.', 'Nhân vật', 'Việc làm', [
      ['Ngô Quyền', 'Cắm cọc nhọn trên sông Bạch Đằng'], ['Kiều Công Tiễn', 'Giết Dương Đình Nghệ, cầu cứu Nam Hán'], ['Lưu Hoằng Tháo', 'Chỉ huy thủy quân Nam Hán, tử trận'], ['Lưu Cung', 'Vua Nam Hán, sai con đem quân sang'],
    ], 'Kiều Công Tiễn phản chủ và cầu cứu Nam Hán; vua Nam Hán Lưu Cung sai con là Lưu Hoằng Tháo đem quân sang; Ngô Quyền đánh tan quân giặc trên sông Bạch Đằng.'),
    quiz('g6-938-q2', 'o1', 'w938', 'Ngô Quyền cho quân đổ ra đánh thuyền giặc vào lúc nào?', ['Khi nước triều rút', 'Khi nước triều vừa lên', 'Ngay khi giặc tới cửa biển', 'Lúc giặc đã lên bộ'], 0,
      'Đợi nước triều rút, quân ta mới đổ ra đánh; thuyền lớn của giặc mắc cạn và bị cọc đâm thủng.'),
    sequence('g6-938-s1', 'o2', 'w938', 'Xếp các sự việc theo đúng thứ tự thời gian.', [
      ['Kiều Công Tiễn giết Dương Đình Nghệ', 'Cuối 937'], ['Ngô Quyền giết Kiều Công Tiễn ở thành Đại La', 'Năm 938'], ['Thuyền Nam Hán vào cửa sông Bạch Đằng, vướng bãi cọc', 'Cuối 938'], ['Ngô Quyền xưng vương, đóng đô ở Cổ Loa', 'Năm 939'],
    ], 'Diệt kẻ phản trước, rồi mới đánh tan quân Nam Hán; năm sau Ngô Quyền xưng vương ở Cổ Loa.'),
    tactic('g6-938-t1', 'o1', 'w938', 'Em là người cầm quân, em chọn cách nào?', 'Thuyền Nam Hán to và đông, thuyền của ta nhẹ và ít. Giặc sắp vượt biển vào cửa sông Bạch Đằng.', [
      ['Bày bãi cọc ở cửa sông nơi nước triều lên xuống mạnh', 2, 'Đúng với kế của Ngô Quyền: biến dòng sông thành cái bẫy cho thuyền lớn.'],
      ['Ra biển chặn đánh ngay', 0, 'Ngoài biển thuyền to của giặc mạnh hơn thuyền nhẹ của ta.'],
      ['Rút về giữ thành, chờ giặc lên bộ', 1, 'An toàn hơn nhưng để giặc vào sâu, không tận dụng được địa thế sông nước.'],
    ], 'Ngô Quyền chọn đánh ở cửa sông Bạch Đằng, nơi ông có thể dùng bãi cọc và thủy triều.'),
    quiz('g6-938-q3', 'o2', 'w938', 'Chiến thắng Bạch Đằng năm 938 có ý nghĩa gì?', ['Chấm dứt hơn một nghìn năm Bắc thuộc', 'Đánh thắng quân Mông Cổ lần thứ nhất', 'Mở đầu nhà Trần', 'Dời đô ra Thăng Long'], 0,
      'Sau chiến thắng, năm 939 Ngô Quyền xưng vương, đóng đô ở Cổ Loa, chấm dứt hơn một nghìn năm Bắc thuộc.'),
  ],
};

// ---------------------------------------------------------------------- Khối 9 · tổng kết ba lần kháng chiến
const soSanh = {
  code: 'so-sanh-ba-lan', campaign_no: null, grade: 9, title: 'So sánh ba lần kháng chiến', place: 'Đại Việt', date_label: '1258 – 1288', kind: 'strategy', icon: 'scroll',
  summary: 'Lập bảng so sánh đối phương, người lãnh đạo, kế sách và trận quyết định của ba lần kháng chiến; tìm điều làm nên chiến thắng cả ba lần.',
  map_x: 0.5, map_y: 0.5, unlock_after: null, pass_percent: 70, reward_xp: 150, reward_gold: 50, card_code: null, badge_code: null,
  content: {
    order: { by: 'Lời dẫn', text: 'Em đã đi qua ba cuộc kháng chiến. Nay hội đồng giao em lập bảng so sánh: giặc là ai, ai cầm quân, ta dùng kế gì, trận nào quyết định.' },
    objectives: [
      { id: 'o1', text: 'So sánh được đối phương, người lãnh đạo, kế sách và trận quyết định của ba lần kháng chiến.' },
      { id: 'o2', text: 'Rút ra được những điểm chung làm nên chiến thắng cả ba lần.' },
    ],
    sources: [SRC.w1, SRC.w2, SRC.w3, WTHD],
    cards: [
      { id: 'c1', kind: 'when', title: 'Ba lần giặc tới', objective: 'o1', source: 'w3', art: 'map',
        body: 'Lần thứ nhất (1258): quân Mông Cổ từ Vân Nam tràn xuống. Lần thứ hai (1285) và lần thứ ba (cuối 1287 – 1288): quân Nguyên do Thoát Hoan chỉ huy; lần thứ ba có thêm thủy quân của Ô Mã Nhi và đoàn thuyền lương đi đường biển.',
        facts: [{ label: 'Năm 1258', value: 'Quân Mông Cổ' }, { label: '1285 và 1287–1288', value: 'Quân Nguyên' }] },
      { id: 'c2', kind: 'who', title: 'Những người cầm đầu', objective: 'o1', source: 'w2', art: 'general',
        body: 'Năm 1258, vua Trần Thái Tông đích thân cầm quân, Thái sư Trần Thủ Độ giữ vững ý chí kháng chiến. Năm 1285 và 1288, Thượng hoàng Trần Thánh Tông và vua Trần Nhân Tông lãnh đạo; Quốc công Tiết chế Trần Quốc Tuấn thống lĩnh toàn quân.',
        facts: [{ label: 'Tổng chỉ huy 1285, 1288', value: 'Trần Quốc Tuấn' }] },
      { id: 'c3', kind: 'how', title: 'Kế sách lặp lại', objective: 'o2', source: 'w2', art: 'granary',
        body: 'Cả ba lần, quân Trần đều tránh đối đầu khi giặc còn mạnh: rời kinh thành, làm “vườn không nhà trống”, không để lương thực cho giặc; đợi giặc mỏi mệt, thiếu lương mới phản công.',
        facts: [{ label: 'Kế chung', value: 'Vườn không nhà trống' }] },
      { id: 'c4', kind: 'where', title: 'Những trận quyết định', objective: 'o1', source: 'w3', art: 'swords',
        body: 'Năm 1258: Đông Bộ Đầu (đêm 28/1/1258). Năm 1285: Hàm Tử, Chương Dương, Tây Kết (24/6/1285). Lần thứ ba: Vân Đồn (cuối 12/1287 – đầu 1/1288) và Bạch Đằng (9/4/1288).',
        facts: [{ label: 'Trận cuối cùng', value: 'Bạch Đằng, 9/4/1288' }] },
      { id: 'c5', kind: 'why', title: 'Vì sao ba lần đều thắng', objective: 'o2', source: 'wthd', art: 'crowd',
        body: 'Cả nước đồng lòng (Bình Than, Diên Hồng), kế sách đúng (lui để giữ sức, đánh vào lương giặc, lợi dụng thủy triều) và những người cầm quân tài giỏi. Trần Hưng Đạo dặn vua: “Khoan thư sức dân để làm kế sâu rễ bền gốc, đó là thượng sách giữ nước vậy.”',
        facts: [{ label: 'Bài học', value: 'Khoan thư sức dân' }] },
    ],
    debrief: {
      title: 'Ba lần kháng chiến, một hào khí',
      paragraphs: [
        'Đối phương mỗi lần một mạnh hơn: quân Mông Cổ năm 1258, quân Nguyên năm 1285 và năm 1287–1288 với cả thủy quân và đoàn thuyền lương. Người lãnh đạo là các vua Trần, Thái sư Trần Thủ Độ (1258) và Quốc công Tiết chế Trần Quốc Tuấn (1285, 1288).',
        'Kế sách lặp lại cả ba lần: tránh đối đầu khi giặc mạnh, rời kinh thành, không để lương cho giặc, rồi phản công khi giặc suy yếu. Trận quyết định là Đông Bộ Đầu (1258), Tây Kết, Chương Dương (1285), Vân Đồn và Bạch Đằng (1288).',
        'Điểm chung làm nên chiến thắng là sự đồng lòng từ triều đình tới nhân dân, kế sách đúng và tài cầm quân; Trần Hưng Đạo tổng kết bằng lời dặn “khoan thư sức dân”.',
      ],
      sources: ['w1', 'w2', 'w3', 'wthd'], fiction: 'Chặng tổng kết này không thêm sự kiện mới; mọi dữ kiện lấy từ các chặng trước và nguồn ghi bên dưới.',
    },
  },
  items: [
    pairs('g9-ss-p1', 'o1', 'w3', 'Lật thẻ và ghép mỗi mốc thời gian với sự kiện của nó.', 'Thời gian', 'Sự kiện', [
      ['Đêm 28/1/1258', 'Đánh úp quân Mông Cổ ở Đông Bộ Đầu'], ['Cuối năm 1282', 'Hội nghị Bình Than'], ['Đầu năm 1285', 'Hội nghị Diên Hồng'], ['24/6/1285', 'Trận Tây Kết'], ['9/4/1288', 'Trận Bạch Đằng'],
    ], 'Năm mốc này nối ba cuộc kháng chiến: thắng Đông Bộ Đầu, hai hội nghị trước lần thứ hai, Tây Kết và Bạch Đằng.'),
    pairs('g9-ss-p2', 'o1', 'w2', 'Lật thẻ và ghép mỗi nhân vật với vai trò của người đó.', 'Nhân vật', 'Vai trò', [
      ['Trần Thủ Độ', 'Thái sư, giữ ý chí kháng chiến năm 1258'], ['Trần Quốc Tuấn', 'Quốc công Tiết chế năm 1285 và 1288'], ['Thoát Hoan', 'Chỉ huy quân Nguyên lần hai và lần ba'], ['Ô Mã Nhi', 'Chỉ huy thủy quân Nguyên, bị bắt ở Bạch Đằng'],
    ], 'Trần Thủ Độ (1258), Trần Quốc Tuấn (1285, 1288) bên ta; Thoát Hoan và Ô Mã Nhi bên quân Nguyên.'),
    sequence('g9-ss-s1', 'o1', 'w3', 'Xếp các sự kiện của ba lần kháng chiến theo đúng thứ tự.', [
      ['Đánh úp quân Mông Cổ ở Đông Bộ Đầu', '1258'], ['Hội nghị Bình Than', 'Cuối 1282'], ['Hội nghị Diên Hồng', 'Đầu 1285'], ['Trận Tây Kết', '24/6/1285'], ['Trận Vân Đồn', 'Cuối 1287 – đầu 1288'], ['Trận Bạch Đằng', '9/4/1288'],
    ], 'Thứ tự đúng đi từ lần thứ nhất (1258), qua hai hội nghị và lần thứ hai (1285), tới lần thứ ba (Vân Đồn, Bạch Đằng 1288).'),
    quiz('g9-ss-q1', 'o2', 'w2', 'Kế sách nào quân Trần dùng trong cả ba lần kháng chiến?', ['Rời kinh thành, làm “vườn không nhà trống” để giặc thiếu lương', 'Đánh chặn giặc ở biên giới đến cùng', 'Xây thành đá thật cao để cố thủ', 'Nhờ nước khác đem quân sang giúp'], 0,
      'Cả ba lần quân Trần đều tránh đối đầu khi giặc mạnh, rời kinh thành và không để lương thực cho giặc.'),
    tactic('g9-ss-t1', 'o2', 'wthd', 'Em tranh biện thế nào?', 'Một bạn nói: “Năm 1288 quân Trần thắng chỉ nhờ may mắn có thủy triều.”', [
      ['Thủy triều chỉ là điều kiện; quân Trần thắng vì hiểu con nước, đóng cọc, nhử giặc đúng lúc và chặn cả đường bộ', 2, 'Đúng: con nước có sẵn, nhưng biết dùng nó mới là tài cầm quân.'],
      ['Thủy triều quan trọng nhất, còn bãi cọc chỉ là phụ', 1, 'Chưa đủ: không có bãi cọc và kế nhử giặc thì thủy triều không làm thuyền giặc vỡ được.'],
      ['Đúng vậy, đó chỉ là may mắn', 0, 'Chưa đúng: trận đánh được chuẩn bị rất kỹ, từ đóng cọc tới chặn đường rút của giặc.'],
    ], 'Trần Hưng Đạo nghiên cứu kỹ con nước để bày trận cọc, cho quân khiêu chiến lúc triều lên và đánh khi triều rút.'),
    quiz('g9-ss-q2', 'o1', 'w3', 'Điểm mới của quân Nguyên trong lần thứ ba so với lần thứ hai là gì?', ['Có thêm thủy quân và đoàn thuyền lương đi đường biển', 'Không vào được Thăng Long', 'Đi từ Vân Nam tràn xuống', 'Không có người chỉ huy'], 0,
      'Lần thứ ba, quân Nguyên mang theo thủy quân của Ô Mã Nhi và đoàn thuyền lương đi đường biển; vì vậy trận Vân Đồn trở thành bước ngoặt.'),
  ],
};

const daiCuc = {
  code: 'hoi-dong-dai-cuc', campaign_no: null, grade: 9, title: 'Hội đồng Đại cục', place: 'Đại Việt', date_label: '1258 – 1288', kind: 'council', icon: 'crown',
  summary: 'Chế độ mới: em chỉ huy cả cuộc chiến qua năm quyết định lớn, từ năm 1258 tới trận Bạch Đằng 1288; giữ được lòng dân và lực lượng thì thắng.',
  map_x: 0.5, map_y: 0.5, unlock_after: 'so-sanh-ba-lan', pass_percent: 70, reward_xp: 150, reward_gold: 50, card_code: null, badge_code: null,
  content: {
    order: { by: 'Lời dẫn', text: 'Hội đồng giao em quyền chỉ huy đại cục. Mỗi quyết định ảnh hưởng tới lòng dân và lực lượng của cả cuộc chiến.' },
    objectives: [
      { id: 'o1', text: 'Vận dụng được hiểu biết về ba lần kháng chiến để đưa ra quyết định ở những thời điểm then chốt.' },
      { id: 'o2', text: 'Giải thích được vì sao mỗi quyết định đúng của nhà Trần dẫn tới thắng lợi.' },
    ],
    sources: [SRC.w1, SRC.w2, SRC.w3],
    cards: [
      { id: 'c1', kind: 'how', title: 'Lui để giữ sức', objective: 'o2', source: 'w1', art: 'shield',
        body: 'Sau trận Bình Lệ Nguyên (17/1/1258), vua Trần Thái Tông lui quân, giữ được thuyền và lực lượng chủ lực. Năm 1285, quân Trần lại rời Thăng Long; quân Nguyên vào thành chỉ thấy cung thất trống không.',
        facts: [{ label: 'Giữ được', value: 'Thuyền và chủ lực' }] },
      { id: 'c2', kind: 'who', title: 'Hỏi ý cả nước', objective: 'o2', source: 'w2', art: 'crowd',
        body: 'Cuối năm 1282, hội nghị Bình Than bàn kế đánh giặc. Đầu năm 1285, ở điện Diên Hồng, các bô lão “vạn người cùng nói như từ một miệng”: “Đánh!”.',
        facts: [{ label: 'Hai hội nghị', value: 'Bình Than, Diên Hồng' }] },
      { id: 'c3', kind: 'why', title: 'Đánh vào lương giặc', objective: 'o2', source: 'w3', art: 'granary',
        body: 'Cuối 1287 – đầu 1288, Trần Khánh Dư đánh tan đoàn thuyền lương của Trương Văn Hổ ở Vân Đồn. Mất lương, quân Nguyên rơi vào thế bị động.',
        facts: [{ label: 'Người chỉ huy', value: 'Trần Khánh Dư' }] },
      { id: 'c4', kind: 'where', title: 'Chặn đường rút', objective: 'o1', source: 'w3', art: 'stakes',
        body: 'Năm 1288, Thoát Hoan rút quân theo hai đường. Thủy quân Ô Mã Nhi bị tiêu diệt trên sông Bạch Đằng ngày 9/4/1288; cánh quân bộ bị chặn đánh trên đường về nước.',
        facts: [{ label: 'Trận quyết chiến', value: 'Bạch Đằng, 9/4/1288' }] },
    ],
    battle: {
      mode: 'council', style: 'command', title: 'Hội đồng Đại cục',
      intro: 'Năm quyết định lớn của ba cuộc kháng chiến. Mỗi lựa chọn làm thay đổi lòng dân và lực lượng của ta; cuối cùng cả hai phải đủ mạnh để thắng.',
      cast: [{ id: 'hoidong', name: 'Hội đồng các tướng', role: 'Nhân vật hư cấu', fictional: true }],
      meters: [{ id: 'dan', label: 'Lòng dân', start: 40, win: 70 }, { id: 'luc', label: 'Lực lượng', start: 40, win: 70 }],
      rounds: [
        { id: 'r1', who: 'Hội đồng các tướng', label: '1258: khi giặc mạnh', ask: 'Năm 1258, thua trận Bình Lệ Nguyên, kỵ binh Mông Cổ đang tiến về kinh thành. Ta làm gì?',
          history: 'Vua Trần Thái Tông lui quân, giữ được thuyền và lực lượng chủ lực; mười ngày sau phản công ở Đông Bộ Đầu.',
          options: [
            opt('a', 'Kế sách', 'Rời kinh thành, giữ thuyền và lực lượng', 2, 'Còn quân, còn thuyền thì còn ngày đánh lại.', { luc: 15 }),
            opt('b', 'Kế sách', 'Giữ Thăng Long đến người cuối cùng', 0, 'Dốc hết quân giữ thành lúc giặc mạnh là mất cả chủ lực.', { dan: -5, luc: -25 }),
            opt('c', 'Kế sách', 'Sang đất Tống lánh nạn', 0, 'Vua bỏ nước thì lòng dân tan rã.', { dan: -25, luc: -10 }),
          ] },
        { id: 'r2', who: 'Hội đồng các tướng', label: '1282–1285: trước khi giặc sang', ask: 'Biết quân Nguyên chuẩn bị đánh lần thứ hai, triều đình nên làm gì?',
          history: 'Cuối 1282 họp hội nghị Bình Than; đầu 1285 các bô lão ở Diên Hồng đồng thanh hô “Đánh!”.',
          options: [
            opt('a', 'Đồng lòng', 'Họp vương hầu ở Bình Than và hỏi ý bô lão ở Diên Hồng', 2, 'Từ triều đình tới làng xã đều một lòng.', { dan: 25, luc: 5 }),
            opt('b', 'Đồng lòng', 'Chỉ bàn trong triều, giữ kín với dân', 1, 'Kế hay nhưng dân chưa được cùng bàn.', { dan: 5 }),
            opt('c', 'Ngoại giao', 'Nộp cống thật nhiều để giặc thôi đánh', 0, 'Giặc đã quyết đánh, nộp cống chỉ làm ta yếu đi.', { dan: -20 }),
          ] },
        { id: 'r3', who: 'Hội đồng các tướng', label: '1285: giặc tràn xuống', ask: 'Đầu năm 1285, quân Nguyên rất đông tràn xuống Thăng Long. Ta làm gì?',
          history: 'Quân Trần cản giặc rồi rời kinh thành; quân Nguyên vào thành chỉ thấy cung thất trống không, càng ngày càng thiếu lương.',
          options: [
            opt('a', 'Kế sách', 'Lui quân, cất giấu lương, chờ thời cơ phản công', 2, 'Giặc vào thành trống, ta giữ được sức.', { dan: 5, luc: 15 }),
            opt('b', 'Kế sách', 'Dồn hết quân giữ kinh thành', 0, 'Đối đầu khi giặc đang mạnh nhất thì thiệt hại lớn.', { luc: -20 }),
            opt('c', 'Ngoại giao', 'Xin hàng để cứu dân', 0, 'Đầu hàng thì mất nước, dân càng khổ.', { dan: -30 }),
          ] },
        { id: 'r4', who: 'Hội đồng các tướng', label: '1287–1288: đường lương giặc', ask: 'Cuối 1287, quân Nguyên chở lương bằng một đoàn thuyền lớn trên biển. Ta làm gì?',
          history: 'Trần Khánh Dư đánh tan đoàn thuyền lương ở Vân Đồn; quân Nguyên từ đó thiếu lương.',
          options: [
            opt('a', 'Thế giặc', 'Đánh tan đoàn thuyền lương ở Vân Đồn', 2, 'Giặc đông mà không có lương thì không đánh lâu được.', { dan: 5, luc: 10 }),
            opt('b', 'Thế giặc', 'Chỉ đánh thuyền chiến, bỏ qua thuyền lương', 1, 'Đánh được giặc nhưng chúng vẫn còn lương.', { luc: 3 }),
            opt('c', 'Kế sách', 'Bỏ qua, chỉ lo giữ kinh thành', 0, 'Giặc đủ lương thì sẽ đánh lâu dài.', { luc: -10 }),
          ] },
        { id: 'r5', who: 'Hội đồng các tướng', label: '1288: giặc rút về', ask: 'Đói và mệt, Thoát Hoan quyết định rút quân theo hai đường thủy và bộ. Ta làm gì?',
          history: 'Ngày 9/4/1288 thủy quân Nguyên bị tiêu diệt trên sông Bạch Đằng; cánh quân bộ bị chặn đánh trên đường rút.',
          options: [
            opt('a', 'Địa thế', 'Bày trận cọc ở Bạch Đằng và chặn cả đường bộ', 2, 'Không để giặc lành lặn trở về rồi lại sang lần nữa.', { dan: 10, luc: 10 }),
            opt('b', 'Địa thế', 'Chỉ chặn đánh đường bộ', 1, 'Thủy quân giặc sẽ thoát ra biển.', { luc: 3 }),
            opt('c', 'Kế sách', 'Để giặc rút êm cho chóng hết chiến tranh', 0, 'Giặc còn lực lượng thì còn quay lại.', { dan: -10 }),
          ] },
      ],
      tips: ['Lòng dân và lực lượng đều phải đạt 70 trở lên ở lượt cuối.', 'Nhớ lại kế chung của cả ba lần: tránh giặc khi giặc mạnh, đánh khi giặc yếu.'],
      win_text: 'Đại cục đã định: ba lần đánh thắng quân Mông – Nguyên. Lòng dân và lực lượng là gốc của chiến thắng.',
      lose_text: 'Đại cục chưa vững. Hãy xem lại những lượt làm lòng dân hoặc lực lượng giảm mạnh.',
    },
    debrief: {
      title: 'Năm quyết định làm nên chiến thắng',
      paragraphs: [
        'Năm 1258, vua Trần Thái Tông lui quân sau trận Bình Lệ Nguyên để giữ thuyền và chủ lực, rồi phản công ở Đông Bộ Đầu. Trước lần thứ hai, hội nghị Bình Than (cuối 1282) và Diên Hồng (đầu 1285) tập hợp sức mạnh cả nước.',
        'Năm 1285, quân Trần lại rời kinh thành, để giặc vào thành trống và thiếu lương. Lần thứ ba, trận Vân Đồn đánh tan đoàn thuyền lương, rồi trận Bạch Đằng (9/4/1288) tiêu diệt thủy quân Nguyên khi giặc rút.',
      ],
      sources: ['w1', 'w2', 'w3'], fiction: COUNCIL_FICTION,
    },
  },
  items: [
    quiz('g9-dc-q1', 'o2', 'w1', 'Sau trận Bình Lệ Nguyên (1258), vì sao vua Trần Thái Tông lui quân?', ['Để giữ thuyền và lực lượng chủ lực, chờ thời cơ phản công', 'Vì quân Trần đã hết lương', 'Vì muốn sang đất Tống', 'Vì quân Mông Cổ đã rút'], 0,
      'Lui quân có trật tự giúp giữ được thuyền và chủ lực; mười ngày sau quân Trần phản công ở Đông Bộ Đầu.'),
    quiz('g9-dc-q2', 'o2', 'w2', 'Hội nghị Diên Hồng có ý nghĩa gì đối với cuộc kháng chiến?', ['Tập hợp sự đồng lòng của nhân dân cả nước', 'Chọn người kế vị ngai vàng', 'Ký hòa ước với quân Nguyên', 'Chia ruộng đất cho quân sĩ'], 0,
      'Khi được hỏi nên hòa hay đánh, các bô lão đồng thanh “Đánh!”: cả nước một lòng kháng chiến.'),
    tactic('g9-dc-t1', 'o1', 'w3', 'Em là tướng giữ vùng biển, em chọn cách nào?', 'Cuối năm 1287, quân Nguyên chở lương bằng một đoàn thuyền lớn đi đường biển để nuôi đạo quân đông đảo.', [
      ['Đánh tan đoàn thuyền lương', 2, 'Đúng với trận Vân Đồn: mất lương, giặc rơi vào thế bị động.'],
      ['Chỉ đánh thuyền chiến của giặc', 1, 'Có lợi nhưng giặc vẫn còn lương để đánh lâu.'],
      ['Rút hết về giữ kinh thành', 0, 'Để giặc đủ lương là để chúng đánh lâu dài.'],
    ], 'Trần Khánh Dư đánh tan đoàn thuyền lương của Trương Văn Hổ ở Vân Đồn; từ đó quân Nguyên thiếu lương.'),
    sequence('g9-dc-s1', 'o1', 'w3', 'Xếp các quyết định lớn theo đúng thứ tự.', [
      ['Lui quân sau trận Bình Lệ Nguyên', '1258'], ['Họp hội nghị Bình Than', 'Cuối 1282'], ['Hỏi ý bô lão ở Diên Hồng', 'Đầu 1285'], ['Đánh đoàn thuyền lương ở Vân Đồn', 'Cuối 1287 – đầu 1288'], ['Bày trận cọc ở Bạch Đằng', 'Tháng 4/1288'],
    ], 'Năm quyết định nối nhau từ năm 1258 tới trận Bạch Đằng năm 1288.'),
    quiz('g9-dc-q3', 'o2', 'w2', 'Khi thế giặc mạnh, vì sao quân Trần thường chủ động lui quân?', ['Để bảo toàn lực lượng, kéo giặc vào thế thiếu lương rồi phản công', 'Vì quân Trần không có vũ khí', 'Vì vua Trần muốn giảng hòa', 'Vì kinh thành Thăng Long quá nhỏ'], 0,
      'Lui để giữ sức là kế lặp lại cả ba lần; giặc vào thành trống, thiếu lương, quân Trần phản công khi giặc suy yếu.'),
    tactic('g9-dc-t2', 'o1', 'w3', 'Em là người chỉ huy, em chọn cách nào?', 'Năm 1288 giặc cạn lương, quyết định rút về nước theo hai đường: thủy quân theo đường sông ra biển, quân bộ theo đường bộ.', [
      ['Đón đánh cả hai đường, bày trận cọc ở sông Bạch Đằng', 2, 'Đúng với kế của Trần Hưng Đạo: không để giặc lành lặn trở về.'],
      ['Chỉ chặn đường bộ', 1, 'Thủy quân giặc sẽ theo đường sông ra biển mà thoát.'],
      ['Để giặc rút êm', 0, 'Giặc còn lực lượng thì còn quay lại xâm lược.'],
    ], 'Trần Hưng Đạo cho đón đánh cả hai đường; thủy quân Nguyên bị tiêu diệt ở Bạch Đằng ngày 9/4/1288.'),
  ],
};

const tuLieu = {
  code: 'tu-lieu-tranh-bien', campaign_no: null, grade: 9, title: 'Tư liệu gốc và tranh biện', place: 'Đại Việt sử ký toàn thư', date_label: '1258 – 1288', kind: 'prepare', icon: 'scroll',
  summary: 'Đọc những câu nói, câu thơ, đoạn sử được chép lại; phân biệt sử liệu với chuyện tương truyền và dùng nguồn khi tranh biện.',
  map_x: 0.5, map_y: 0.5, unlock_after: 'hoi-dong-dai-cuc', pass_percent: 70, reward_xp: 150, reward_gold: 50, card_code: null, badge_code: null,
  content: {
    order: { by: 'Lời dẫn', text: 'Kho sử của hội đồng còn giữ những lời nói, câu thơ của người xưa. Em đọc kỹ từng tư liệu rồi dùng chúng để tranh biện.' },
    objectives: [
      { id: 'o1', text: 'Đọc và giải thích được ý nghĩa của một số tư liệu gốc về ba lần kháng chiến.' },
      { id: 'o2', text: 'Phân biệt được sử liệu với chuyện tương truyền và biết dùng nguồn khi tranh biện.' },
    ],
    sources: [SRC.w1, SRC.w2, SRC.manhghep, WTHD],
    cards: [
      { id: 'c1', kind: 'who', title: 'Lời Thái sư Trần Thủ Độ', objective: 'o1', source: 'w1', art: 'scroll',
        body: 'Trên sông Thiên Mạc năm 1258, khi có người khuyên vua sang lánh đất Tống, Thái sư Trần Thủ Độ tâu: “Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác.”',
        facts: [{ label: 'Nguồn', value: 'Đại Việt sử ký toàn thư' }] },
      { id: 'c2', kind: 'when', title: 'Tiếng hô ở Diên Hồng', objective: 'o1', source: 'w2', art: 'crowd',
        body: 'Đầu năm 1285, khi Thượng hoàng hỏi có nên đánh lại quân Nguyên hay không, các bô lão “vạn người cùng nói như từ một miệng”: “Đánh!”.',
        facts: [{ label: 'Nguồn', value: 'Đại Việt sử ký toàn thư' }] },
      { id: 'c3', kind: 'how', title: 'Toàn thư chép trận Bạch Đằng', objective: 'o1', source: 'manhghep', art: 'boat',
        body: '“Nhân lúc nước triều lên, Vương cho quân khiêu chiến rồi giả thua chạy, giặc đuổi theo, quân ta cố sức đánh lại. Nước triều xuống, thuyền giặc vướng cọc hết.” (“Vương” là Hưng Đạo vương Trần Quốc Tuấn.)',
        facts: [{ label: 'Nguồn', value: 'Đại Việt sử ký toàn thư, quyển 5' }] },
      { id: 'c4', kind: 'why', title: 'Tương truyền hay sử liệu?', objective: 'o2', source: 'w2', art: 'star',
        body: 'Năm 1285, Thoát Hoan bị chặn đánh khi rút chạy. Chuyện ông phải chui vào ống đồng để trốn về nước chỉ là “tương truyền”: khi kể lại phải nói rõ như vậy, không viết như một sự thật chắc chắn.',
        facts: [{ label: 'Cách dùng', value: 'Ghi rõ “tương truyền”' }] },
    ],
    debrief: {
      title: 'Đọc sử như một sử quan',
      paragraphs: [
        'Những câu nói như lời Trần Thủ Độ (1258), tiếng hô “Đánh!” ở Diên Hồng (1285) hay đoạn Toàn thư chép trận Bạch Đằng (1288) cho thấy ý chí và cách đánh của quân dân Đại Việt.',
        'Có những chuyện chỉ là tương truyền (như chuyện Thoát Hoan chui ống đồng) hoặc các nguồn chép khác nhau. Khi tranh biện, em nên nói rõ nguồn và không khẳng định điều các nguồn chưa thống nhất.',
      ],
      sources: ['w1', 'w2', 'manhghep', 'wthd'], fiction: 'Chặng này chỉ dùng tư liệu đã có nguồn trong các chặng trước; các tình huống tranh biện là phần sáng tạo của trò chơi.',
    },
  },
  items: [
    quiz('g9-tl-q1', 'o1', 'w1', 'Câu “Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác” cho thấy điều gì?', ['Quyết tâm kháng chiến đến cùng', 'Thái sư muốn xin hàng', 'Triều đình đã hết quân', 'Vua sắp sang đất Tống'], 0,
      'Trần Thủ Độ tâu như vậy khi có người khuyên vua lánh sang đất Tống, giữ vững quyết tâm đánh giặc của triều đình năm 1258.'),
    quiz('g9-tl-q2', 'o1', 'manhghep', 'Đoạn “Nhân lúc nước triều lên… Nước triều xuống, thuyền giặc vướng cọc hết” chép về trận nào?', ['Trận Bạch Đằng năm 1288', 'Trận Đông Bộ Đầu năm 1258', 'Trận Hàm Tử năm 1285', 'Trận Vân Đồn năm 1288'], 0,
      'Đại Việt sử ký toàn thư chép như vậy về trận Bạch Đằng năm 1288 do Hưng Đạo vương chỉ huy.'),
    pairs('g9-tl-p1', 'o1', 'w2', 'Lật thẻ và ghép mỗi câu với người đã nói hoặc viết.', 'Câu', 'Người', [
      ['“Đầu thần chưa rơi xuống đất…”', 'Trần Thủ Độ'], ['“Ta thà làm ma nước Nam…”', 'Trần Bình Trọng'], ['“Đoạt sáo Chương Dương độ…”', 'Trần Quang Khải'], ['“Xã tắc hai phen bon ngựa đá…”', 'Trần Nhân Tông'],
    ], 'Bốn câu của bốn nhân vật: Thái sư Trần Thủ Độ (1258), Trần Bình Trọng (1285), Trần Quang Khải (bài thơ năm 1285) và vua Trần Nhân Tông.'),
    quiz('g9-tl-q3', 'o1', 'wthd', 'Lời dặn “Khoan thư sức dân để làm kế sâu rễ bền gốc” của Trần Hưng Đạo khuyên điều gì?', ['Nới sức dân, chăm lo cho dân thì đất nước mới bền', 'Tăng thuế để có nhiều lương thực', 'Bắt dân đi lính thật nhiều', 'Xây thật nhiều thành lũy'], 0,
      '“Khoan thư sức dân” là nới sức dân; dân yên thì gốc nước mới vững, đó là “thượng sách giữ nước”.'),
    tactic('g9-tl-t1', 'o2', 'w2', 'Em trả lời bạn thế nào?', 'Một bạn nói: “Chuyện Thoát Hoan chui vào ống đồng để trốn về nước chắc chắn là thật.”', [
      ['Đó là chuyện tương truyền, khi kể phải nói rõ là “tương truyền”', 2, 'Đúng: nguồn chép đây là chuyện tương truyền, không phải sự thật chắc chắn.'],
      ['Bỏ chuyện đó đi vì không quan trọng', 1, 'Không cần bỏ, chỉ cần nói rõ đó là chuyện tương truyền.'],
      ['Đúng vậy, sách nào cũng chép như thế', 0, 'Chưa đúng: đây chỉ là chuyện tương truyền.'],
    ], 'Khi dùng sử liệu cần phân biệt điều chắc chắn với chuyện tương truyền.'),
    tactic('g9-tl-t2', 'o2', 'w2', 'Em làm gì khi viết bài?', 'Em thấy hai nguồn ghi số quân Nguyên năm 1285 khác nhau.', [
      ['Ghi cả hai con số và nói rõ nguồn nào chép, không khẳng định một số', 2, 'Đúng cách làm của người viết sử: nêu nguồn, không tự khẳng định.'],
      ['Chọn số lớn nhất cho bài thêm hấp dẫn', 0, 'Chọn số theo ý thích là làm sai lệch lịch sử.'],
      ['Lấy trung bình hai con số', 0, 'Con số tự tính ra không có nguồn nào chép.'],
    ], 'Khi các nguồn chép khác nhau, hãy ghi rõ từng nguồn và không khẳng định điều chưa thống nhất.'),
  ],
};

const thuThach = {
  code: 'thu-thach-lich-su', campaign_no: null, grade: 9, title: 'Thử thách lịch sử', place: 'Đại Việt', date_label: 'Nếu… thì…', kind: 'council', icon: 'target',
  summary: 'Chế độ “Nếu… thì…”: suy luận chuyện gì có thể xảy ra nếu người xưa chọn khác, rồi so với điều đã thật sự xảy ra; rút ra bài học giữ nước hôm nay.',
  map_x: 0.5, map_y: 0.5, unlock_after: 'tu-lieu-tranh-bien', pass_percent: 70, reward_xp: 200, reward_gold: 80, card_code: null, badge_code: null,
  content: {
    order: { by: 'Lời dẫn', text: 'Thử thách cuối cùng của Nguyên soái: suy luận “nếu… thì…” từ những gì em đã học, rồi đối chiếu với lịch sử thật.' },
    objectives: [
      { id: 'o1', text: 'Suy luận được hệ quả của những lựa chọn khác trong lịch sử dựa trên hiểu biết về nguyên nhân – kết quả.' },
      { id: 'o2', text: 'Rút ra được bài học giữ nước từ ba lần kháng chiến cho hôm nay.' },
    ],
    sources: [W938, SRC.w1, SRC.w3, WTHD],
    cards: [
      { id: 'c1', kind: 'why', title: 'Con nước phải đúng giờ', objective: 'o1', source: 'w938', art: 'river',
        body: 'Kế bãi cọc chỉ thành khi dụ được thuyền giặc tới đúng bãi cọc lúc nước triều còn cao, rồi triều mới rút. Nếu triều rút quá sớm, cọc lộ ra và thuyền giặc tránh được; nếu quá muộn, thuyền giặc vượt qua bãi cọc.',
        facts: [{ label: 'Điều kiện', value: 'Nhử đúng chỗ, đúng giờ' }] },
      { id: 'c2', kind: 'how', title: 'Lương quyết định sức giặc', objective: 'o1', source: 'w3', art: 'granary',
        body: 'Đạo quân Nguyên rất đông, trông cả vào lương chở bằng thuyền. Khi đoàn thuyền lương bị đánh tan ở Vân Đồn, giặc phải bỏ Thăng Long về Vạn Kiếp rồi tính đường rút.',
        facts: [{ label: 'Bước ngoặt', value: 'Trận Vân Đồn' }] },
      { id: 'c3', kind: 'who', title: 'Một lời giữ cả triều đình', objective: 'o1', source: 'w1', art: 'scroll',
        body: 'Năm 1258, Thái úy Trần Nhật Hiệu viết hai chữ “nhập Tống” (sang lánh đất Tống), còn Thái sư Trần Thủ Độ tâu: “Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác.” Triều đình ở lại kháng chiến.',
        facts: [{ label: 'Lựa chọn', value: 'Ở lại đánh giặc' }] },
      { id: 'c4', kind: 'why', title: 'Gốc của giữ nước', objective: 'o2', source: 'wthd', art: 'crowd',
        body: 'Trần Hưng Đạo dặn vua: “Khoan thư sức dân để làm kế sâu rễ bền gốc, đó là thượng sách giữ nước vậy.” Sức mạnh giữ nước bắt đầu từ lòng dân.',
        facts: [{ label: 'Thượng sách', value: 'Khoan thư sức dân' }] },
    ],
    battle: {
      mode: 'council', style: 'whatif', title: 'Thử thách “Nếu… thì…”',
      intro: 'Bốn thử thách suy luận. Chọn hệ quả hợp lý nhất, rồi xem điều đã thật sự xảy ra. Lập luận chắc chắn thì thanh “Lập luận” tăng.',
      cast: [{ id: 'suquan', name: 'Sử quan', role: 'Nhân vật hư cấu', fictional: true }],
      meters: [{ id: 'lap_luan', label: 'Lập luận', start: 30, win: 70 }],
      rounds: [
        { id: 'r1', who: 'Sử quan', label: 'Nếu “nhập Tống” (1258)', ask: 'Nếu năm 1258 triều Trần nghe theo hai chữ “nhập Tống”, bỏ nước sang đất Tống, điều gì dễ xảy ra?',
          history: 'Thực tế: Trần Thủ Độ tâu “Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác”; triều đình ở lại kháng chiến và thắng ở Đông Bộ Đầu.',
          options: [
            opt('a', 'Suy luận', 'Kháng chiến mất người lãnh đạo, giặc dễ chiếm cả nước', 2, 'Lập luận chặt: không có triều đình đứng đầu thì khó tập hợp quân dân.', { lap_luan: 15 }),
            opt('b', 'Suy luận', 'Không sao, quân dân vẫn tự đánh thắng như thường', 0, 'Chưa chặt: thiếu người lãnh đạo thì các nơi khó phối hợp.', { lap_luan: -5 }),
            opt('c', 'Suy luận', 'Nhà Tống sẽ đem quân sang đánh đuổi quân Mông Cổ giúp', 0, 'Không có căn cứ nào cho thấy điều đó.', { lap_luan: -5 }),
          ] },
        { id: 'r2', who: 'Sử quan', label: 'Nếu không có Vân Đồn (1288)', ask: 'Nếu đoàn thuyền lương của Trương Văn Hổ tới nơi an toàn, quân Nguyên sẽ ra sao?',
          history: 'Thực tế: đoàn thuyền lương bị đánh tan ở Vân Đồn; Thoát Hoan thiếu lương, phải bỏ Thăng Long về Vạn Kiếp rồi rút quân.',
          options: [
            opt('a', 'Suy luận', 'Giặc đủ lương, giữ Thăng Long lâu hơn, ta khó đánh hơn', 2, 'Đúng hướng: lương là chỗ dựa để giặc đánh lâu dài.', { lap_luan: 15 }),
            opt('b', 'Suy luận', 'Giặc vẫn phải rút ngay như cũ', 0, 'Chưa hợp lý: giặc rút chính vì thiếu lương.', { lap_luan: -5 }),
            opt('c', 'Suy luận', 'Chẳng có gì khác', 0, 'Mất lương là bước ngoặt, nên đổi một điều thì đổi nhiều điều.', { lap_luan: -5 }),
          ] },
        { id: 'r3', who: 'Sử quan', label: 'Nếu triều rút sớm', ask: 'Ở trận Bạch Đằng, nếu nước triều rút trước khi thuyền giặc vào tới bãi cọc thì sao?',
          history: 'Thực tế (938 và 1288): quân ta nhử giặc vào bãi cọc lúc nước triều còn cao; khi thuyền giặc đã ở trên bãi cọc, triều mới rút.',
          options: [
            opt('a', 'Suy luận', 'Bãi cọc lộ ra sớm, thuyền giặc thấy và tránh được', 2, 'Đúng: vì vậy phải tính con nước theo từng giờ.', { lap_luan: 15 }),
            opt('b', 'Suy luận', 'Thuyền giặc vẫn mắc cọc như thường', 0, 'Chưa đúng: cọc lộ ra thì giặc đã biết mà tránh.', { lap_luan: -5 }),
            opt('c', 'Suy luận', 'Quân ta không cần nhử giặc nữa', 0, 'Không nhử thì giặc không vào bãi cọc.', { lap_luan: -5 }),
          ] },
        { id: 'r4', who: 'Sử quan', label: 'Bài học hôm nay', ask: 'Theo em, bài học nào của ba lần kháng chiến còn đúng với hôm nay?',
          history: 'Trần Hưng Đạo dặn: “Khoan thư sức dân để làm kế sâu rễ bền gốc, đó là thượng sách giữ nước vậy.”',
          options: [
            opt('a', 'Bài học', 'Đoàn kết, chăm lo sức dân và hiểu rõ đất nước mình', 2, 'Đó là điều làm nên chiến thắng cả ba lần.', { lap_luan: 15 }),
            opt('b', 'Bài học', 'Chỉ cần vũ khí thật mạnh là đủ', 0, 'Ba lần kháng chiến cho thấy lòng dân và kế sách mới là gốc.', { lap_luan: -5 }),
            opt('c', 'Bài học', 'Mỗi người tự lo cho mình', 0, 'Ngược với tinh thần Diên Hồng.', { lap_luan: -5 }),
          ] },
      ],
      tips: ['Không có đáp án “đúng như lịch sử” cho câu hỏi “nếu… thì…”: hãy chọn suy luận có căn cứ nhất từ các thẻ Binh thư.'],
      win_text: 'Lập luận vững vàng! Em đã hiểu vì sao mỗi lựa chọn của người xưa dẫn tới kết quả như lịch sử đã chép.',
      lose_text: 'Lập luận chưa vững. Hãy đọc lại các thẻ Binh thư: nguyên nhân nào dẫn tới kết quả nào.',
    },
    debrief: {
      title: 'Nếu… thì… và bài học giữ nước',
      paragraphs: [
        'Ba lần kháng chiến cho thấy nhiều kết quả phụ thuộc vào những lựa chọn đúng lúc: triều đình ở lại kháng chiến năm 1258, đánh vào lương giặc ở Vân Đồn, tính đúng con nước ở Bạch Đằng.',
        'Câu hỏi “nếu… thì…” không làm thay đổi lịch sử, nhưng giúp em hiểu nguyên nhân – kết quả. Bài học còn nguyên giá trị là lời dặn của Trần Hưng Đạo: “khoan thư sức dân” là thượng sách giữ nước.',
      ],
      sources: ['w938', 'w1', 'w3', 'wthd'], fiction: 'Các câu hỏi “nếu… thì…” là suy luận giả định của trò chơi, không phải sự kiện lịch sử; dòng “Thực tế” của mỗi lượt lấy từ nguồn ghi bên dưới.',
    },
  },
  items: [
    quiz('g9-tt-q1', 'o1', 'w938', 'Vì sao kế bãi cọc chỉ thành công khi tính đúng con nước?', ['Phải dụ thuyền giặc vào bãi cọc lúc triều cao rồi triều mới rút', 'Vì cọc chỉ cắm được vào ban đêm', 'Vì thuyền giặc chỉ đi khi trời mưa', 'Vì quân ta chỉ đánh được khi triều lên'], 0,
      'Triều rút sớm thì cọc lộ và giặc tránh được; rút muộn thì thuyền giặc vượt qua bãi cọc.'),
    tactic('g9-tt-t1', 'o1', 'w3', 'Em suy luận thế nào?', 'Nếu năm 1288 quân Trần không đánh đoàn thuyền lương ở Vân Đồn thì quân Nguyên ở Thăng Long sẽ thế nào?', [
      ['Đủ lương nên giữ thành lâu hơn, quân ta khó đánh hơn', 2, 'Hợp lý: chính việc mất lương buộc giặc phải rút.'],
      ['Vẫn rút sớm như cũ', 0, 'Chưa hợp lý: giặc rút vì thiếu lương.'],
      ['Sẽ đầu hàng ngay', 0, 'Không có căn cứ.'],
    ], 'Trận Vân Đồn là bước ngoặt: mất lương, quân Nguyên rơi vào thế bị động rồi phải rút.'),
    quiz('g9-tt-q2', 'o1', 'w1', 'Vì sao lời tâu của Trần Thủ Độ năm 1258 rất quan trọng?', ['Giữ triều đình ở lại kháng chiến khi có người khuyên sang đất Tống', 'Vì ông chỉ huy trận Bạch Đằng', 'Vì ông ký hòa ước với giặc', 'Vì ông viết Hịch tướng sĩ'], 0,
      'Khi Trần Nhật Hiệu viết hai chữ “nhập Tống”, lời của Trần Thủ Độ giữ vững quyết tâm đánh giặc của triều đình.'),
    sequence('g9-tt-s1', 'o1', 'w3', 'Xếp chuỗi nguyên nhân – kết quả của lần thứ ba cho đúng.', [
      ['Đoàn thuyền lương bị đánh tan ở Vân Đồn', 'Cuối 1287 – đầu 1288'], ['Quân Nguyên thiếu lương ở Thăng Long', 'Tháng 2/1288'], ['Thoát Hoan rút về Vạn Kiếp, quyết định rút quân', 'Tháng 3/1288'], ['Thủy quân Nguyên bị tiêu diệt ở Bạch Đằng', '9/4/1288'],
    ], 'Mất lương → thiếu ăn → phải rút → bị đón đánh ở Bạch Đằng.'),
    quiz('g9-tt-q3', 'o2', 'wthd', '“Thượng sách giữ nước” theo lời dặn của Trần Hưng Đạo là gì?', ['Khoan thư sức dân', 'Xây thành thật cao', 'Tăng quân thật đông', 'Nộp cống cho nước lớn'], 0,
      'Trần Hưng Đạo dặn: “Khoan thư sức dân để làm kế sâu rễ bền gốc, đó là thượng sách giữ nước vậy.”'),
    tactic('g9-tt-t2', 'o2', 'w1', 'Em chọn bài học nào?', 'Lớp em bàn: bài học nào từ ba lần kháng chiến giúp học sinh hôm nay sống tốt hơn với quê hương?', [
      ['Biết đoàn kết, cùng nhau góp sức cho việc chung', 2, 'Đúng tinh thần Diên Hồng: cả nước một lòng.'],
      ['Chỉ người lớn mới cần quan tâm việc nước', 0, 'Trần Quốc Toản còn trẻ đã muốn góp sức đánh giặc.'],
      ['Ai giỏi thì tự làm, không cần ai', 1, 'Tài giỏi là tốt, nhưng ba lần thắng đều nhờ đồng lòng.'],
    ], 'Sự đồng lòng từ triều đình tới nhân dân là điểm chung của cả ba lần chiến thắng.'),
  ],
};

// ---------------------------------------------------------------------- trận hội đồng cho ba chặng có sẵn (trước đây không có trận)
const councils = {
  'dien-hong': {
    mode: 'council', style: 'persuade', title: 'Thuyết phục các bô lão',
    intro: 'Thượng hoàng hỏi các bô lão: nên hòa hay nên đánh? Vài bô lão còn lo vì giặc quá đông. Em đưa ra thẻ Binh thư để thuyết phục, làm cho cả điện một lòng.',
    cast: [
      { id: 'thuong_hoang', name: 'Thượng hoàng Trần Thánh Tông', role: 'Người triệu tập hội nghị', fictional: false },
      { id: 'bl_dongtrieu', name: 'Bô lão Đông Triều', role: 'Nhân vật hư cấu', fictional: true },
      { id: 'bl_thientruong', name: 'Bô lão Thiên Trường', role: 'Nhân vật hư cấu', fictional: true },
      { id: 'bl_hongchau', name: 'Bô lão Hồng Châu', role: 'Nhân vật hư cấu', fictional: true },
    ],
    meters: [{ id: 'dong_long', label: 'Đồng lòng kháng chiến', start: 40, win: 80 }],
    rounds: [
      { id: 'r1', who: 'Bô lão Đông Triều', label: 'Giặc mạnh thì sao', ask: 'Giặc Nguyên kéo sang rất đông. E rằng ta nên tính đường hòa?',
        history: 'Năm 1258 quân Trần đã tập kích, đánh tan quân Mông Cổ ở Đông Bộ Đầu.',
        options: [
          opt('a', 'Chiến công', 'Năm 1258 ta đã phá quân Mông Cổ ở Đông Bộ Đầu', 2, 'Phải! Giặc mạnh mà ta vẫn từng thắng. Lòng người vững hơn rồi.', { dong_long: 25 }, 'Năm 1258 giặc Mông Cổ cũng mạnh, vậy mà ta đã đánh úp chúng ở Đông Bộ Đầu.'),
          opt('b', 'Thế giặc', 'Quân Nguyên đông gấp bội quân ta', 0, 'Nghe vậy lão càng lo hơn…', { dong_long: -10 }, 'Giặc đông gấp bội quân ta…'),
          opt('c', 'Ngoại giao', 'Nộp cống thật nhiều để giặc thôi đánh', 0, 'Giặc đã quyết đánh thì nộp cống bao nhiêu cũng không đủ.', { dong_long: -15 }, 'Hay ta nộp cống cho yên?'),
        ] },
      { id: 'r2', who: 'Bô lão Thiên Trường', label: 'Ai cầm quân', ask: 'Đánh thì ai đủ tài cầm quân cho cả nước?',
        history: 'Trần Quốc Tuấn được phong Quốc công Tiết chế, thống lĩnh mọi lực lượng của Đại Việt.',
        options: [
          opt('a', 'Người cầm quân', 'Quốc công Tiết chế Trần Quốc Tuấn thống lĩnh toàn quân', 2, 'Có Hưng Đạo vương cầm quân thì lão yên lòng.', { dong_long: 20 }, 'Triều đình đã phong Trần Quốc Tuấn làm Quốc công Tiết chế, thống lĩnh toàn quân.'),
          opt('b', 'Thế trận', 'Mỗi làng tự đánh lấy, không cần ai chỉ huy', 0, 'Mỗi nơi một kiểu thì sao chống nổi giặc lớn?', { dong_long: -10 }, 'Làng nào tự lo làng nấy.'),
          opt('c', 'Ngoại giao', 'Chờ nước khác đem quân sang giúp', 0, 'Trông vào người ngoài thì lỡ hết thời cơ.', { dong_long: -15 }, 'Hay ta chờ nước khác sang giúp?'),
        ] },
      { id: 'r3', who: 'Bô lão Hồng Châu', label: 'Tinh thần quân sĩ', ask: 'Quân sĩ có đủ quyết tâm đánh giặc không?',
        history: 'Trần Quốc Tuấn viết Hịch tướng sĩ; nhiều chiến sĩ thích hai chữ “Sát Thát” lên cánh tay để tỏ quyết tâm.',
        options: [
          opt('a', 'Ý chí', 'Hịch tướng sĩ – quân sĩ thích hai chữ “Sát Thát” lên cánh tay', 2, 'Tướng sĩ một lòng, dân ta cũng một lòng. Xin cho đánh!', { dong_long: 25 }, 'Hưng Đạo vương đã ra Hịch tướng sĩ, quân sĩ thích lên tay hai chữ “Sát Thát”.'),
          opt('b', 'Thế trận', 'Quân ta ít, nên giữ sức chờ thời', 1, 'Giữ sức là phải, nhưng lòng quân thế nào?', { dong_long: 5 }, 'Quân ta còn ít, ta nên giữ sức.'),
          opt('c', 'Ý chí', 'Ai muốn về quê thì cứ về', 0, 'Vậy thì ai đánh giặc?', { dong_long: -20 }, 'Ai sợ thì cứ về quê.'),
        ] },
    ],
    tips: ['Đọc lại thẻ “Hịch tướng sĩ và Sát Thát”, “Người cầm quân” trước khi đưa thẻ.', 'Thanh “Đồng lòng” phải đạt 80 sau lượt cuối.'],
    win_text: 'Muôn người như một: “Đánh!”. Đại Việt sử ký toàn thư chép các bô lão “vạn người cùng nói như từ một miệng”.',
    lose_text: 'Điện Diên Hồng còn chưa một lòng. Hãy đưa ra những thẻ cho thấy ta có chiến công, có người cầm quân và quân sĩ quyết tâm.',
  },
  'vuon-khong-nha-trong': {
    mode: 'council', style: 'command', title: 'Sơ tán dân, giấu lương kịp giờ',
    intro: 'Kỵ binh Mông Cổ sắp tới Thăng Long. Em giúp triều đình quyết định ba việc gấp: lương thực, kinh thành và đường đi của triều đình.',
    cast: [{ id: 'thu_do', name: 'Thái sư Trần Thủ Độ', role: 'Thái sư nhà Trần', fictional: false }, { id: 'xa_truong', name: 'Ông xã trưởng', role: 'Nhân vật hư cấu', fictional: true }],
    meters: [{ id: 'luong', label: 'Lương không về tay giặc', start: 30, win: 70 }, { id: 'luc', label: 'Lực lượng được giữ', start: 40, win: 70 }],
    rounds: [
      { id: 'r1', who: 'Ông xã trưởng', label: 'Lương thực trong làng', ask: 'Lệnh triều đình đã về. Kho thóc của làng nên làm thế nào?',
        history: 'Triều Trần sớm ra lệnh cho nhân dân cất giấu lương thực; quân Mông Cổ cướp lương quanh vùng không được bao nhiêu.',
        options: [
          opt('a', 'Kế sách', 'Cất giấu hết lương thực, không để lại cho giặc', 2, 'Giặc đến mà không có gì để ăn!', { luong: 45 }),
          opt('b', 'Kế sách', 'Để nguyên kho mà đi cho nhanh', 0, 'Giặc sẽ có lương mà đánh lâu.', { luong: -10 }),
          opt('c', 'Kế sách', 'Gánh theo hết dù phải đi chậm', 1, 'Giữ được lương nhưng dân đi chậm, dễ gặp giặc.', { luong: 20, luc: -5 }),
        ] },
      { id: 'r2', who: 'Thái sư Trần Thủ Độ', label: 'Kinh thành Thăng Long', ask: 'Thua trận Phù Lỗ, giặc đang tiến về kinh thành. Ta giữ thành hay rời đi?',
        history: 'Sau trận Phù Lỗ (18/1/1258), quân Trần chủ động rời Thăng Long; quân Mông Cổ vào kinh thành nhưng kho tàng trống rỗng.',
        options: [
          opt('a', 'Kế sách', 'Rời kinh thành, giữ thuyền và lực lượng', 2, 'Giặc vào thành trống, còn ta vẫn còn quân.', { luc: 35 }),
          opt('b', 'Kế sách', 'Giữ thành đến người cuối cùng', 0, 'Kỵ binh giặc đang mạnh, giữ thành là mất quân.', { luc: -25 }),
          opt('c', 'Ngoại giao', 'Mở cửa thành mời giặc vào để xin hòa', 0, 'Giặc vào thành sẽ cướp sạch, dân càng khổ.', { luong: -20, luc: -10 }),
        ] },
      { id: 'r3', who: 'Thái sư Trần Thủ Độ', label: 'Lời bàn trên sông Thiên Mạc', ask: 'Trên thuyền ở sông Thiên Mạc, có người viết hai chữ “nhập Tống”, khuyên vua sang lánh đất Tống. Em theo ý nào?',
        history: 'Thái sư Trần Thủ Độ tâu: “Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác.” Triều đình ở lại kháng chiến.',
        options: [
          opt('a', 'Ý chí', 'Ở lại đánh giặc như lời Thái sư Trần Thủ Độ', 2, '“Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác!”', { luc: 20, luong: 5 }),
          opt('b', 'Kế sách', 'Sang đất Tống lánh nạn', 0, 'Vua bỏ nước thì ai giữ nước?', { luc: -20 }),
          opt('c', 'Kế sách', 'Chia nhau về quê, ai lo phần nấy', 0, 'Quân tan thì không còn ngày phản công.', { luc: -25 }),
        ] },
    ],
    tips: ['Cả hai thanh “Lương không về tay giặc” và “Lực lượng được giữ” phải đạt 70.'],
    win_text: 'Quân Mông Cổ vào một kinh thành trống, không cướp được lương. Quân Trần còn nguyên lực lượng, chờ thời cơ phản công.',
    lose_text: 'Giặc còn lương hoặc ta mất quá nhiều quân. Nhớ lại: cất giấu lương, rời kinh thành, giữ vững ý chí.',
  },
  'van-kiep-1288': {
    mode: 'council', style: 'command', title: 'Cắt lương, dồn giặc vào thế phải rút',
    intro: 'Quân Nguyên lại vào Thăng Long nhưng thiếu lương rồi co cụm ở Vạn Kiếp. Em giúp Hưng Đạo vương quyết định từng bước để giặc kiệt sức.',
    cast: [{ id: 'hung_dao', name: 'Hưng Đạo vương Trần Quốc Tuấn', role: 'Quốc công Tiết chế', fictional: false }, { id: 'tham_tu', name: 'Người do thám', role: 'Nhân vật hư cấu', fictional: true }],
    meters: [{ id: 'the', label: 'Thế của ta', start: 30, win: 80 }],
    rounds: [
      { id: 'r1', who: 'Người do thám', label: 'Giặc vào Thăng Long', ask: 'Đầu tháng 2/1288, quân Nguyên đánh tới Thăng Long. Ta làm gì?',
        history: 'Quân Nguyên vào được kinh thành nhưng thiếu lương, không bắt được hai vua Trần và không phá được chủ lực quân Đại Việt.',
        options: [
          opt('a', 'Kế sách', 'Để giặc vào kinh thành trống, giữ chủ lực ở ngoài', 2, 'Giặc chiếm thành mà không thắng được ta.', { the: 15 }),
          opt('b', 'Kế sách', 'Dồn hết chủ lực ra giữ kinh thành', 0, 'Đối đầu lúc giặc còn đông là thiệt quân.', { the: -15 }),
          opt('c', 'Ngoại giao', 'Xin hòa để giặc rút', 0, 'Giặc chưa kiệt sức thì chưa chịu rút.', { the: -10 }),
        ] },
      { id: 'r2', who: 'Người do thám', label: 'Giặc ở Vạn Kiếp', ask: 'Thoát Hoan bỏ Thăng Long về Vạn Kiếp, co cụm trong các thành gỗ. Ta làm gì?',
        history: 'Ở Vạn Kiếp, quân Nguyên lương ít, đêm đêm bị tập kích, bệnh tật lan rộng.',
        options: [
          opt('a', 'Thế giặc', 'Tập kích ban đêm liên tục, không cho giặc yên', 2, 'Giặc ngày đói, đêm không ngủ được.', { the: 20 }),
          opt('b', 'Thế trận', 'Đánh thẳng vào thành gỗ giữa ban ngày', 0, 'Đánh vào chỗ giặc phòng bị chắc là thiệt cho ta.', { the: -10 }),
          opt('c', 'Thế trận', 'Để yên cho giặc nghỉ', 0, 'Giặc nghỉ thì lại hồi sức.', { the: -10 }),
        ] },
      { id: 'r3', who: 'Hưng Đạo vương Trần Quốc Tuấn', label: 'Làm giặc lơi lỏng', ask: 'Giặc đang nghi ngờ, canh phòng ngày đêm. Làm sao cho chúng mất cảnh giác?',
        history: 'Vua Trần dùng kế trá hàng: Hưng Ninh vương Trần Tung sang trại giặc hẹn ngày “xin hàng”, rồi quân Đại Việt bất ngờ tập kích.',
        options: [
          opt('a', 'Kế sách', 'Sai người sang hẹn ngày “xin hàng” rồi bất ngờ tập kích', 2, 'Giặc tưởng thật, án binh chờ đợi.', { the: 15 }),
          opt('b', 'Ngoại giao', 'Xin hòa thật', 0, 'Bỏ dở lúc giặc sắp kiệt sức thì uổng công.', { the: -15 }),
          opt('c', 'Kế sách', 'Gửi thư thách giặc ra đánh', 1, 'Giặc chưa chắc đã ra, lại càng cảnh giác.', { the: 5 }),
        ] },
      { id: 'r4', who: 'Hưng Đạo vương Trần Quốc Tuấn', label: 'Giặc quyết rút', ask: 'Cuối tháng 3/1288, tướng Nguyên bàn: “Quân có thể về, không thể giữ.” Giặc sẽ rút theo hai đường thủy, bộ. Ta làm gì?',
        history: 'Trần Hưng Đạo đoán được và tổ chức đón đánh trên cả hai đường; trận quyết định diễn ra trên sông Bạch Đằng.',
        options: [
          opt('a', 'Địa thế', 'Đón đánh cả hai đường, chuẩn bị trận địa ở Bạch Đằng', 2, 'Lần này giặc không về lành lặn được nữa.', { the: 20 }),
          opt('b', 'Địa thế', 'Chỉ chặn đường bộ', 1, 'Thủy quân giặc sẽ theo sông ra biển.', { the: 5 }),
          opt('c', 'Thế trận', 'Để giặc rút êm', 0, 'Giặc còn sức thì còn quay lại.', { the: -15 }),
        ] },
    ],
    tips: ['Thanh “Thế của ta” phải đạt 80 sau lượt cuối.'],
    win_text: 'Giặc đói, mệt và mất cảnh giác. Thoát Hoan quyết định rút quân, còn quân Trần đã sẵn sàng đón đánh trên sông Bạch Đằng.',
    lose_text: 'Giặc còn sức hoặc rút êm được. Hãy làm giặc kiệt sức từng bước rồi chặn cả hai đường rút.',
  },
};

/** Câu luyện tập của Khối 7 – 8 chuyển sang chỉ dùng cho ôn tập để mỗi khối đúng 24 câu Hội đồng (dạng ghép thẻ là dạng của Khối 6) */
const reviewOnly = ['s04-p1', 's04-q3', 's05-p1', 's05-q3', 's06-p1', 's06-q2', 's07-p1', 's07-q3', 's08-p1', 's08-q2', 's09-p1', 's09-q2', 's13-p1'];

module.exports = { grades, cards, stages: [bachDang938, soSanh, daiCuc, tuLieu, thuThach], councils, reviewOnly, COUNCIL_FICTION };
