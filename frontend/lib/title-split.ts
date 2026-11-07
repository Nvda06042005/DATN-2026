/**
 * Tiêu đề trang quản trị viết theo kiểu trang chủ: nửa đầu chữ đậm màu mực, nửa sau chữ nghiêng màu đỏ ("Trường | học", "Thống kê | hệ thống").
 * Chia đều hai nửa theo số chữ (tiếng Việt viết rời từng âm tiết) và không cắt giữa cụm từ:
 * - có dấu phẩy hoặc hai chấm ("Xin chào, | Nguyễn Văn A") thì chia ngay sau dấu đó;
 * - có từ nối (và, của, trong, theo, cho, với, toàn) thì chia ngay trước từ nối ("Trò chơi hóa | của trường", "Người dùng | toàn hệ thống");
 * - từ đầu là từ mượn (game, quiz, AI…) còn từ sau là tiếng Việt thì chia sau từ đầu ("Game | thẻ tướng");
 * - còn lại chia đôi, nửa đầu lấy phần lớn hơn khi số chữ lẻ vì danh từ chính đứng đầu ("Khảo sát | trải nghiệm", "Kho dữ liệu | lịch sử").
 * Tiêu đề chỉ một chữ thì không có nửa sau.
 */
const LINK_WORDS = new Set(['và', 'của', 'trong', 'theo', 'cho', 'với', 'toàn']);
/** Từ mượn đứng một mình như một từ trọn vẹn. Không dùng "viết không dấu" để nhận ra vì "Thi", "Kho" cũng viết không dấu. */
const LOAN_WORDS = new Set(['game', 'quiz', 'kahoot', 'mini-game', 'minigame', 'ai', 'tutor', 'online', 'app']);

export function splitTitle(title: string): [string, string] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const count = words.length;
  if (count < 2) return [words.join(' '), ''];
  let cut = Math.ceil(count / 2);
  const punctuated = words.findIndex((word, i) => i < count - 1 && /[,:]$/.test(word));
  const link = words.findIndex((word, i) => i > 0 && LINK_WORDS.has(word.toLowerCase()));
  if (punctuated >= 0) cut = punctuated + 1;
  else if (link > 0) cut = link;
  else if (LOAN_WORDS.has(words[0].toLowerCase()) && !LOAN_WORDS.has(words[1].toLowerCase())) cut = 1;
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}
