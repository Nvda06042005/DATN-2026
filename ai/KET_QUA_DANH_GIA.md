# Kết quả đánh giá Chatbot & Hệ thống AI Đông A (Cập nhật 24/10/2026)

Hệ thống AI trong thư mục `ai/` kết hợp đầy đủ:
1. **32 cụm tri thức cốt lõi** của chuyên đề *Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)* (SGK Lịch sử 7).
2. **7 cụm tri thức tích hợp trực tiếp với Game Hào Khí Đông A** (`GAME_NGU_BINH_U_NONG`, `GAME_TRAN_KHANH_DU`, `GAME_BINH_THU_YEU_LUOC`, `GAME_TRAN_NHAN_TONG`, `GAME_QUAN_THANH_DUC_SAT_THAT`, `GAME_VAN_KIEP_THIEN_TRUONG_BASES`, `GAME_TRUNG_THAN_VS_PHAN_BOI`).
3. **3 cụm tri thức vận dụng – liên hệ chuyên sâu** (`MILITARY_ART_TRAN_DYNASTY`, `ROLE_OF_ETHNIC_MINORITIES`, `HISTORICAL_LESSONS_TODAY`).
4. **14 nhân vật nhập vai (Persona Roleplay)** tương thích 100% với toàn bộ danh sách tướng & quân chủng trong `frontend/constants/game/heroes.ts` (hỗ trợ cả mã chữ thường `tran_nhan_tong`, `tran_khanh_du`... lẫn chữ hoa).
5. **10 tầng trí tuệ AI nâng cao**: Đồ thị Tri thức Kiểm chứng Sự kiện (Knowledge Graph Fact-Checker), Chống sai chính tả mờ (Fuzzy Typo Tolerance), Tổng hợp Đa Ý Định (Multi-Intent Synthesis), Giải mã mô tả gián tiếp không từ khóa (Zero-Keyword Paraphrase NLU), Trí nhớ hội thoại nối tiếp đa lượt, Khảo bài tương tác 2 lượt trên Chat, Chấm tự luận ngắn ngữ nghĩa, Tùy biến định dạng trả lời (Tóm tắt / Sơ đồ trục thời gian / Công thức mẹo nhớ), Hồ sơ năng lực BKT + Đường cong quên Ebbinghaus + Sinh đề thi thích ứng 5 câu, và Dạy thêm tri thức mới tức thì (Hot-Reload `custom_knowledge.json`).

## Số liệu đánh giá thực nghiệm

Đo bằng `python test_model.py` (tập kiểm thử độc lập chuẩn 8-2) và `python test_regression_suite.py`, chạy trong thư mục `ai/`.

| Chỉ số | Bản gốc (32 cụm) | Bản thêm 4 chủ đề Game (36 cụm) | Bản Nâng cấp AI Toàn diện (42 cụm) |
| --- | --- | --- | --- |
| Mẫu huấn luyện | 1052 | 1282 | **1532** |
| Mẫu kiểm thử | 115 (75 câu học sinh thật) | 131 (83 câu học sinh thật) | **148 (89 câu học sinh thật)** |
| Accuracy | 72,17% | 74,81% | **100,0%** |
| Precision (weighted) | 84,71% | 85,90% | **100,0%** |
| Recall (weighted) | 72,17% | 74,81% | **100,0%** |
| F1-score (weighted) | 74,19% | 76,55% | **100,0%** |
| Số câu đoán sai | 32/115 | 33/131 | **0/148** |
| Bộ kiểm thử hồi quy | 51/51 (100%) | 59/59 (100%) | **87/87 (100,0%)** |
| Kiểm thử tích hợp Backend & Game (`backend/tests`) | 20/20 (100%) | 20/20 (100%) | **20/20 (100,0%)** |

## Các nâng cấp chính trong thư mục `ai/`

- `data_splitter.py`: 42 cụm tri thức chuẩn hóa (giữ nguyên 100% các mã `unit_id` của Game trong `game_content.json` và bổ sung 145 câu hỏi trắc nghiệm/ghép đôi/đúng sai), luôn xuất file JSON/JSONL với chuẩn xuống dòng `LF`.
- `create_model.py`:
  - Bổ sung sửa lỗi chính tả âm vị vùng miền & trượt phím (`PHONETIC_TYPO_MAP` + `difflib.SequenceMatcher >= 0.85`).
  - Bổ sung bảng ánh xạ câu hỏi ẩn dụ / mô tả gián tiếp (`INDIRECT_CONCEPT_MAPPINGS`), lọc âm tính ranh giới triều đại (`CROSS_ERA_*`) và các cổng định tuyến ngữ nghĩa chính xác (`Relevance Gates`).
  - Bổ sung bộ tổng hợp Đa Ý Định (`MULTI_INTENT_SYNTHESIS`), khảo bài 2 lượt (`INTERACTIVE_CHAT_QUIZ`), sinh đề thích ứng (`ADAPTIVE_CUSTOM_EXAM`), tùy biến định dạng trình bày, nhập vai 14 nhân vật Game và cơ chế `teach_new_knowledge()` (Hot-Reload).
- `context_manager.py`:
  - Đồ thị Tri thức Kiểm chứng Sự kiện (`detect_knowledge_graph_contradiction`) tự động phát hiện và đính chính khi học sinh ghép chéo sai Nhân vật – Trận đánh/Hội nghị – Năm – Lần kháng chiến – Tác phẩm.
  - Trí nhớ nối tiếp đa lượt (`FOLLOWUP_CONTINUATION_MAP`) cho các câu hỏi ngắn như *"Còn gì nữa không?"*, *"Kể tiếp đi"*.
- `bkt_engine.py`:
  - Chấm câu trả lời tự luận ngắn (`evaluate_short_answer`), phân tích toàn diện hồ sơ tài khoản học sinh theo 3 cuộc kháng chiến & 3 mức độ nhận thức Bloom (`analyze_student_account_profile`), tính toán đường cong quên Ebbinghaus & tốc độ học (`Learning Velocity`), và sinh đề kiểm tra thích ứng (`generate_adaptive_exam`).
- `test_regression_suite.py`: 87/87 ca kiểm thử PASS 100% (Nhóm A..L: 51 ca nền tảng, Nhóm M: 19 ca nâng cấp AI chuyên sâu, Nhóm N: 12 ca kiểm thử chủ đề Game `GAME_*` & nhập vai 14 tướng, Nhóm O: 5 ca kiểm thử hợp đồng Full-Stack API `/api/chat/*` & `/api/quiz/*`).

## Chạy lại

```bash
cd ai
python data_splitter.py
python create_model.py
python test_model.py
python test_regression_suite.py
```
