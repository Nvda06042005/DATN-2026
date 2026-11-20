/** Authored narration based on the two supplied documents; never used to award XP or unlock stages. */
export interface IntroChapter { id: string; time: string; title: string; body: string; question: string; source: string; mood: 'village' | 'empire' | 'border' | 'campaign' | 'river' | 'mission' }
import type { StageBrief } from '@/types/saga';
export const canExploreStage = (stage: StageBrief): boolean => stage.state !== 'locked' && (stage.steps.explore === 'ready' || stage.steps.explore === 'done');
export const canReplayBattle = (stage: StageBrief): boolean => stage.state !== 'locked' && stage.has_battle && stage.steps.battle === 'done';
export const ROLEPLAY_CHAPTERS: readonly IntroChapter[] = [
  { id: 'homeland', time: 'ĐẠI VIỆT · THẾ KỈ XIII', title: 'Trước tiếng trống lên đường', mood: 'village',
    body: 'Trên đất Đại Việt thời Trần, làng xóm, ruộng đồng, bến sông và kinh thành gắn bó với cuộc sống của người dân. Câu chuyện của em bắt đầu từ miền đất mà quân dân nhà Trần sẽ cùng nhau bảo vệ.',
    question: 'Điều gì khiến một cộng đồng sẵn sàng cùng nhau bảo vệ quê hương?', source: 'Bối cảnh minh họa; đối chiếu Bài 14, tr. 68, 72–73. Làng và nhân vật trong cảnh là hư cấu.' },
  { id: 'empire', time: 'BỐI CẢNH · LỤC ĐỊA Á – ÂU', title: 'Một đế chế đang mở rộng', mood: 'empire',
    body: 'Trong thế kỉ XIII, đế chế Mông Cổ tiến hành nhiều cuộc chiến tranh chinh phục trên lục địa Á – Âu. Làn sóng xâm lược ấy cũng đe dọa nền độc lập của Đại Việt.',
    question: 'Trước một đối thủ hùng mạnh, Đại Việt phải chuẩn bị ra sao?', source: 'SGK Lịch sử và Địa lí 7 – Kết nối tri thức với cuộc sống, Bài 14, tr. 68.' },
  { id: 'warning', time: 'CUỐI NĂM 1257', title: 'Tin từ miền biên giới', mood: 'border',
    body: 'Quân Mông Cổ chuẩn bị xâm lược Đại Việt. Nhà Trần chủ động lập kế hoạch đối phó: tăng cường phòng thủ biên giới, chuẩn bị lực lượng và vũ khí. Trong thế giới nhập vai, em là một tân binh liên lạc đang chờ nhận nhiệm vụ.',
    question: 'Một tin báo kịp thời có thể giúp việc chuẩn bị thay đổi như thế nào?', source: 'Bài 14, tr. 68. Vai tân binh liên lạc là sáng tạo phục vụ trò chơi.' },
  { id: 'first', time: 'CUỘC KHÁNG CHIẾN THỨ NHẤT · 1258', title: 'Giữ lực lượng, chờ thời cơ', mood: 'campaign',
    body: 'Năm 1258, vua Trần Thái Tông cùng quân dân chống quân Mông Cổ. Trước thế mạnh của giặc, quân Trần rút lui để bảo toàn lực lượng, thực hiện “vườn không nhà trống”, rồi phản công ở Đông Bộ Đầu.',
    question: 'Vì sao chủ động rút lui có thể là một cách chuẩn bị cho thắng lợi?', source: 'Bài 14, tr. 68–69; DOCX Tổng hợp lịch sử, phần 1 và mục 2.1.' },
  { id: 'later', time: 'HAI LẦN KHÁNG CHIẾN TIẾP THEO · 1285 / 1287–1288', title: 'Hào khí nối tiếp', mood: 'river',
    body: 'Đại Việt tiếp tục chống quân Nguyên năm 1285 và 1287–1288. Vua đương triều là Trần Nhân Tông; Thượng hoàng Trần Thánh Tông cùng tham gia lãnh đạo. Những chặng sau sẽ đưa em tìm hiểu hội nghị, hậu cần, các cuộc phản công và trận Bạch Đằng.',
    question: 'Đoàn kết, chuẩn bị và cách đánh sáng tạo đã giúp Đại Việt như thế nào?', source: 'Bài 14, tr. 69–73; DOCX Tổng hợp lịch sử, phần 1, mục 2.2–2.3.' },
  { id: 'mission', time: 'ĐẾN LƯỢT EM · NHẬN QUÂN LỆNH', title: 'Bước vào câu chuyện Đông A', mood: 'mission',
    body: 'Quân dân Đại Việt đã chuẩn bị và tổ chức đánh giặc ra sao? Vì sao Đại Việt ba lần giành thắng lợi trước đế chế hùng mạnh? Hãy mang hai câu hỏi ấy vào hành trình: học sử liệu, luyện tập, nhận quân lệnh và khám phá từng chặng.',
    question: 'Em đã sẵn sàng vào vai tân binh liên lạc?', source: 'Diễn đạt lại câu hỏi mở đầu Bài 14, tr. 68; mục nguyên nhân thắng lợi, tr. 72–73. Quân lệnh và nhân vật trò chơi là hư cấu.' },
];

export const INTRO_PLACES = [
  { id: 'village', name: 'Làng ven sông', x: 7, z: 7, text: 'Những người dân, ruộng đồng và bến nước trong cảnh gợi cuộc sống cần được bảo vệ. Đây là làng hư cấu để dẫn vào bài học, không phải một địa danh lịch sử cụ thể.' },
  { id: 'camp', name: 'Doanh trại', x: 3, z: 3, text: 'Cuối năm 1257, nhà Trần tăng cường phòng thủ biên giới và chuẩn bị lực lượng, vũ khí. Tìm hiểu việc chuẩn bị trước khi bước vào cuộc kháng chiến năm 1258. Nguồn: Bài 14, tr. 68.' },
  { id: 'pier', name: 'Bến sông', x: 8, z: 4, text: 'Sông ngòi, đường tiếp tế và thủy triều giữ vai trò quan trọng trong cuộc kháng chiến lần thứ ba. Khi tới chặng 1287–1288, hãy phân biệt đoàn thuyền lương với thủy quân tác chiến. Nguồn: Bài 14, tr. 71–72; DOCX mục 2.3.' },
] as const;
