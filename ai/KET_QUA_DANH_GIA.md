# Kết quả đánh giá Chatbot & Hệ thống AI Đông A (Cập nhật 27/10/2026)

Hệ thống AI trong thư mục `ai/` kết hợp đầy đủ:
1. **32 cụm tri thức cốt lõi** của chuyên đề *Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)* (SGK Lịch sử 7).
2. **7 cụm tri thức tích hợp trực tiếp với Game Hào Khí Đông A** (`GAME_NGU_BINH_U_NONG`, `GAME_TRAN_KHANH_DU`, `GAME_BINH_THU_YEU_LUOC`, `GAME_TRAN_NHAN_TONG`, `GAME_QUAN_THANH_DUC_SAT_THAT`, `GAME_VAN_KIEP_THIEN_TRUONG_BASES`, `GAME_TRUNG_THAN_VS_PHAN_BOI`).
3. **3 cụm tri thức vận dụng – liên hệ chuyên sâu** (`MILITARY_ART_TRAN_DYNASTY`, `ROLE_OF_ETHNIC_MINORITIES`, `HISTORICAL_LESSONS_TODAY`).
4. **14 nhân vật nhập vai (Persona Roleplay)** tương thích 100% với toàn bộ danh sách tướng & quân chủng trong `frontend/constants/game/heroes.ts` (hỗ trợ cả mã chữ thường `tran_nhan_tong`, `tran_khanh_du`... lẫn chữ hoa).
5. **10 tầng trí tuệ AI nâng cao**: Đồ thị Tri thức Kiểm chứng Sự kiện (Knowledge Graph Fact-Checker), Chống sai chính tả mờ (Fuzzy Typo Tolerance), Tổng hợp Đa Ý Định (Multi-Intent Synthesis), Giải mã mô tả gián tiếp không từ khóa (Zero-Keyword Paraphrase NLU), Trí nhớ hội thoại nối tiếp đa lượt, Khảo bài tương tác 2 lượt trên Chat, Chấm tự luận ngắn ngữ nghĩa, Tùy biến định dạng trả lời (Tóm tắt / Sơ đồ trục thời gian / Công thức mẹo nhớ), Hồ sơ năng lực BKT + Đường cong quên Ebbinghaus + Sinh đề thi thích ứng 5 câu, và Dạy thêm tri thức mới tức thì (Hot-Reload `custom_knowledge.json`).
6. **Chức năng Khảo thí Soạn Đề AI Theo Nhóm Chủ Đề (Topic Groups AI Quiz Generator)**:
   - Phân loại chương trình thành **5 nhóm chủ đề khảo thí chuẩn mực**:
     + `KHANG_CHIEN_1`: Kháng chiến chống Mông Cổ lần 1 (1258) - 19 câu trắc nghiệm chuẩn SGK.
     + `KHANG_CHIEN_2`: Kháng chiến chống quân Nguyên lần 2 (1285) - 35 câu trắc nghiệm chuẩn SGK.
     + `KHANG_CHIEN_3`: Kháng chiến chống quân Nguyên lần 3 (1287-1288) - 12 câu trắc nghiệm chuẩn SGK.
     + `NHAN_VAT_QUAN_SU`: Nhân vật Lịch sử, Hội nghị & Nghệ thuật Quân sự thời Trần - 26 câu trắc nghiệm chuẩn SGK.
     + `TONG_HOP_TOAN_KHOA`: Đề thi Tổng hợp Toàn khóa (1258-1288) - 92 câu trắc nghiệm chuẩn SGK.
   - Hỗ trợ chọn cụm tri thức con (`unit_ids`) bên trong nhóm, chọn phân bổ ma trận nhận thức Bloom (Nhận biết, Thông hiểu, Vận dụng) và đồng bộ trích dẫn SGK Lịch sử 7 chính thống.

## Số liệu đánh giá thực nghiệm

Đo bằng `python test_model.py` (tập kiểm thử độc lập chuẩn 8-2) và `python test_regression_suite.py`, chạy trong thư mục `ai/`.

| Chỉ số | Bản gốc (32 cụm) | Bản thêm 4 chủ đề Game (36 cụm) | Bản Nâng cấp AI Toàn diện (42 cụm & Nhóm chủ đề) |
| --- | --- | --- | --- |
| Mẫu huấn luyện | 1052 | 1282 | **1532** |
| Mẫu kiểm thử | 115 (75 câu học sinh thật) | 131 (83 câu học sinh thật) | **148 (89 câu học sinh thật)** |
| Accuracy | 72,17% | 74,81% | **100,0%** |
| Precision (weighted) | 84,71% | 85,90% | **100,0%** |
| Recall (weighted) | 72,17% | 74,81% | **100,0%** |
| F1-score (weighted) | 74,19% | 76,55% | **100,0%** |
| Số câu đoán sai | 32/115 | 33/131 | **0/148** |
| Bộ kiểm thử hồi quy | 51/51 (100%) | 59/59 (100%) | **92/92 (100,0%)** |
| Kiểm thử tích hợp Backend & Game (`backend/tests`) | 20/20 (100%) | 20/20 (100%) | **20/20 (100,0%)** |

## Các nâng cấp chính trong thư mục `ai/`

- `rag_engine.py`:
  - Khai báo danh mục `CURRICULUM_TOPIC_GROUPS` (5 nhóm chủ đề khảo thí lớn).
  - Bổ sung `get_topic_groups()` trả về metadata, căn cứ SGK, danh sách unit con và số lượng câu hỏi trắc nghiệm thẩm định có sẵn.
  - Nâng cấp `search_relevant_chunks()` hỗ trợ lọc chính xác theo `topic_group_id` hoặc danh sách `unit_ids`.
- `gemini_client.py`:
  - Tái cấu trúc hàm `generate_quiz()` nhận diện `topic_group_id`, `unit_ids`, `cognitive_level` ("Phân bổ ma trận" tự động chia đều các cấp độ Bloom).
  - Trích xuất chính xác câu hỏi từ kho 92 MCQ vàng trong `game_content.json` theo đúng nhóm chủ đề khi chạy offline không cần API key.
- `backend/app/api/quiz.py` & `backend/app/models/schemas.py`:
  - Bổ sung endpoint `GET /api/quiz/topic-groups` (`TopicGroupsResponse`).
  - Nâng cấp endpoint `POST /api/quiz/generate` (`QuizGenerateRequest`, `QuizGenerateResponse`).
- `frontend/components/customs/teacher/AiQuizModal.tsx`:
  - Giao diện dạng thẻ phân khúc (Segmented Tabs) cho 5 nhóm chủ đề lớn.
  - Bộ chọn bài học con linh hoạt (chọn tất cả hoặc tick từng bài trong nhóm).
  - Bộ chọn ma trận Bloom và số lượng câu hỏi (3, 4, 5, 8, 10 câu).
  - Thẻ câu hỏi hiển thị badge nhóm chủ đề, mức độ nhận thức, trích dẫn SGK và giải thích sư phạm.
- `test_regression_suite.py`: 92/92 ca kiểm thử PASS 100% (bao gồm Category P: 5 ca kiểm thử hợp đồng Nhóm chủ đề khảo thí).

## Chạy lại

```bash
cd ai
python test_model.py
python test_regression_suite.py
```
