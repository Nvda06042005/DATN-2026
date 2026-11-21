/** Authored, sourced narration. Intro choices never award XP or unlock the server's stages. */
import type { StageBrief } from '@/types/saga';
export interface IntroChapter {
  id: string; year: number; time: string; title: string; body: string; question: string; source: string; sources: readonly string[];
  mood: 'village' | 'empire' | 'border' | 'campaign' | 'river' | 'mission';
  places: readonly string[]; route: string | null; duration: number;
}
export const canExploreStage = (stage: StageBrief): boolean => stage.state !== 'locked' && (stage.steps.explore === 'ready' || stage.steps.explore === 'done');
export const canReplayBattle = (stage: StageBrief): boolean => stage.state !== 'locked' && stage.has_battle && stage.steps.battle === 'done';
export const HISTORY_SOURCES = {
  armouries: { title:'Royal Armouries · Sự trỗi dậy của người Mông Cổ', url:'https://royalarmouries.org/objects-and-stories/stories/the-mongols/rise-of-the-mongols' },
  kalka: { title:'Canadian Institute of Ukrainian Studies · Kalka River', url:'https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CK%5CA%5CKalkaRiver.htm' },
  chronology: { title:'University of Washington · Niên biểu lịch sử Moscow', url:'https://faculty.washington.edu/dwaugh/hstam443/m-chron.html' },
  textbook: { title:'SGK Lịch sử và Địa lí 7 · Kết nối tri thức · Bài 14, tr. 68–73', url:null },
  docx: { title:'Tổng hợp lịch sử.docx · phần 1 và mục 2.1–2.3', url:null },
} as const;
export const ROLEPLAY_CHAPTERS: readonly IntroChapter[] = [
  { id:'foundation', year:1206, time:'1206', title:'Đế quốc xuất hiện trên thảo nguyên', mood:'empire', places:['mongolia'], route:null, duration:18,
    body:'Năm 1206, trên cao nguyên Mông Cổ, Thiết Mộc Chân được tôn làm Thành Cát Tư Hãn sau khi thống nhất các bộ lạc. Từ vùng thảo nguyên này, một đế quốc bắt đầu hình thành và mở rộng bằng những cuộc chinh phục.',
    question:'Hãy chạm vào cao nguyên Mông Cổ để xác định nơi câu chuyện bắt đầu.', source:'Royal Armouries: mốc 1206 và quá trình thống nhất. Màu đỏ minh họa vùng khởi đầu, không phải đường biên đo đạc.', sources:['armouries'] },
  { id:'west', year:1219, time:'1219–1221', title:'Vó ngựa hướng sang phía tây', mood:'empire', places:['mongolia','samarkand'], route:'west', duration:19,
    body:'Dưới sự lãnh đạo của Thành Cát Tư Hãn, quân Mông Cổ mở nhiều cuộc chinh phục. Chiến dịch đánh Khwarezm đưa kỵ binh tiến sâu vào Trung Á. Nhiều thành thị bị chiếm và tàn phá; Samarkand thất thủ năm 1220.',
    question:'Theo dõi đoàn kỵ binh và tìm Samarkand trên bản đồ.', source:'Royal Armouries: chiến dịch Khwarezm và các thành thị bị chinh phục trong giai đoạn 1219–1220. Hướng tiến quân được khái quát để dẫn chuyện.', sources:['armouries'] },
  { id:'kalka', year:1223, time:'1223', title:'Liên quân thất bại bên sông Kalka', mood:'campaign', places:['kalka','samarkand'], route:'kalka', duration:19,
    body:'Năm 1223, một đạo quân Mông Cổ tiến tới vùng phía bắc Biển Đen. Liên quân các công quốc Rus’ và người Cuman chống lại nhưng bị đánh bại ở sông Kalka. Đây là một cuộc viễn chinh; không có nghĩa toàn bộ vùng Rus’ đã bị chiếm vào năm ấy.',
    question:'Chạm vòng tròn Kalka: vì sao bản đồ chỉ đánh dấu một khu vực?', source:'Canadian Institute of Ukrainian Studies: trận Kalka năm 1223, liên quân Rus’–Cuman. Vị trí chiến trường chỉ thể hiện ước lệ vì còn tranh luận.', sources:['kalka'] },
  { id:'moscow', year:1238, time:'1238', title:'Mạc Tư Khoa bị đánh chiếm', mood:'campaign', places:['moscow','kalka'], route:'moscow', duration:18,
    body:'Thành Cát Tư Hãn mất năm 1227, nhưng những cuộc chinh phục vẫn tiếp tục dưới các thế hệ sau. Trong chiến dịch do Batu chỉ huy, quân Mông Cổ đánh chiếm Mạc Tư Khoa năm 1238. Nhiều trung tâm của các công quốc Rus’ chịu sự tàn phá.',
    question:'Mốc 1238 diễn ra trước hay sau khi Thành Cát Tư Hãn qua đời?', source:'University of Washington: Moscow bị đánh chiếm năm 1238. Royal Armouries: Thành Cát Tư Hãn mất năm 1227; chiến dịch của Batu.', sources:['chronology','armouries'] },
  { id:'kyiv', year:1240, time:'1240', title:'Kyiv thất thủ', mood:'campaign', places:['kyiv','moscow','kalka'], route:'kyiv', duration:18,
    body:'Năm 1240, Kyiv, còn được viết là Kiev, thất thủ và bị tàn phá. Những thất bại ở châu Âu cho thấy sức mạnh quân sự đáng gờm của đế quốc Mông Cổ. Các công quốc Rus’ thời trung đại không đồng nhất với riêng nước Nga hiện nay.',
    question:'Nhìn lại ba mốc 1223, 1238 và 1240: cuộc bành trướng diễn ra trong bao lâu?', source:'Royal Armouries: Kyiv thất thủ năm 1240. Tên địa danh hiện nay chỉ giúp định vị, không thể hiện biên giới hiện đại.', sources:['armouries'] },
  { id:'warning', year:1257, time:'CUỐI NĂM 1257', title:'Sức ép tiến tới Đại Việt', mood:'border', places:['dai-ly','dai-viet'], route:'daiViet', duration:19,
    body:'Ở phía đông nam lục địa Á–Âu, Đại Việt cũng đứng trước nguy cơ xâm lược. Cuối năm 1257, nhà Trần chủ động chuẩn bị lực lượng, vũ khí và phòng thủ. Bản đồ đưa em từ câu chuyện của một đế quốc rộng lớn tới miền đất quân dân Đại Việt sẽ bảo vệ.',
    question:'Đại Việt cần chuẩn bị thế nào trước một đối thủ đã chinh phục nhiều vùng đất?', source:'Bài 14, tr. 68: bối cảnh Á–Âu và chuẩn bị cuối năm 1257. Mũi tên thể hiện hướng khái quát, không thay bản đồ lịch sử của chặng.', sources:['textbook'] },
  { id:'first', year:1258, time:'1258', title:'Đại Việt bước vào cuộc kháng chiến', mood:'border', places:['dai-viet'], route:'daiViet', duration:18,
    body:'Năm 1258, vua Trần Thái Tông cùng quân dân Đại Việt chống quân Mông Cổ. Trước thế mạnh của giặc, quân Trần chủ động rút lui để bảo toàn lực lượng, thực hiện “vườn không nhà trống”, rồi phản công ở Đông Bộ Đầu.',
    question:'Vì sao chủ động rút lui có thể là một bước chuẩn bị cho thắng lợi?', source:'SGK Bài 14, tr. 68–69; Tổng hợp lịch sử, phần 1 và mục 2.1.', sources:['textbook','docx'] },
  { id:'later', year:1288, time:'1285 · 1287–1288', title:'Ba lần giữ vững non sông', mood:'river', places:['dai-viet'], route:null, duration:18,
    body:'Đại Việt tiếp tục chống quân Nguyên năm 1285 và 1287–1288. Vua đương triều là Trần Nhân Tông; Thượng hoàng Trần Thánh Tông cùng tham gia lãnh đạo. Em sẽ tìm hiểu sự chuẩn bị, đoàn kết, hậu cần và cách đánh sáng tạo qua từng chặng.',
    question:'Vì sao Đại Việt ba lần giành thắng lợi trước một đế quốc hùng mạnh?', source:'SGK Bài 14, tr. 69–73; Tổng hợp lịch sử, phần 1 và mục 2.2–2.3. Phân biệt đoàn thuyền lương ở Vân Đồn với thủy quân ở Bạch Đằng.', sources:['textbook','docx'] },
  { id:'mission', year:1288, time:'BƯỚC VÀO HÀNH TRÌNH', title:'Đến lượt em tìm lời giải', mood:'mission', places:['dai-viet'], route:null, duration:0,
    body:'Từ cao nguyên Mông Cổ tới cửa ngõ Đại Việt, em đã thấy bối cảnh của cuộc đối đầu. Bây giờ hãy vào vai người liên lạc, đọc sử liệu, luyện tập và nhận nhiệm vụ tại những chặng đã mở. Mỗi lựa chọn trong hành trình sẽ giúp em hiểu cách quân dân nhà Trần bảo vệ đất nước.',
    question:'Quân dân Đại Việt đã chuẩn bị và tổ chức đánh giặc ra sao?', source:'Câu hỏi mở đầu và nguyên nhân thắng lợi trong Bài 14, tr. 68, 72–73. Vai liên lạc và nhiệm vụ trò chơi là hư cấu.', sources:['textbook','docx'] },
];
