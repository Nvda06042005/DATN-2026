# Kết quả đánh giá chatbot sau khi bổ sung 4 chủ đề (23/10/2026)

Bốn chủ đề mới của game được đưa vào kho tri thức của chatbot: chính sách ngụ binh ư nông, Trần Khánh Dư (từ người buôn than ở Chí Linh đến trận Vân Đồn), Binh thư yếu lược, vua Trần Nhân Tông. Mã cụm tri thức giữ nguyên như trong game (`GAME_NGU_BINH_U_NONG`, `GAME_TRAN_KHANH_DU`, `GAME_BINH_THU_YEU_LUOC`, `GAME_TRAN_NHAN_TONG`), nên BKT của học sinh không bị đổi.

## Số liệu

Đo bằng `python test_model.py` (tập kiểm thử độc lập) và `python test_regression_suite.py`, chạy trong thư mục `ai/`.

| Chỉ số | Trước (32 cụm) | Sau (36 cụm) |
| --- | --- | --- |
| Mẫu huấn luyện | 1052 | 1282 |
| Mẫu kiểm thử | 115 (75 câu kiểu học sinh thật) | 131 (83 câu kiểu học sinh thật) |
| Accuracy | 72,17% | 74,81% |
| Precision (weighted) | 84,71% | 85,90% |
| Recall (weighted) | 72,17% | 74,81% |
| F1-score (weighted) | 74,19% | 76,55% |
| Số câu đoán sai | 32/115 | 33/131 |
| Bộ kiểm thử hồi quy | 51/51 | 59/59 (thêm nhóm M cho 4 chủ đề mới) |

## Cách đọc

- Trên đúng 115 câu kiểm thử cũ, mô hình mới cho kết quả **giống hệt** mô hình cũ (72,17% / 84,71% / 72,17% / 74,19%): bổ sung chủ đề không làm giảm chất lượng ở các chủ đề cũ.
- Phần tăng của số liệu chung đến từ 16 câu kiểm thử mới: đúng 15/16 (93,75%). Câu sai duy nhất: “vì sao nhà trần vừa có quân đông vừa đủ lương thực” bị xếp vào “Vườn không nhà trống”.
- Huấn luyện lại dữ liệu cũ bằng scikit-learn 1.7.2 cho ra đúng các số liệu cũ. Vì vậy chênh lệch trong bảng chỉ do dữ liệu mới, không do đổi phiên bản thư viện.
- Dữ liệu cũ trong `train_data.jsonl`, `test_data.jsonl`, `knowledge_base.json` được giữ nguyên từng mẫu; chỉ thêm 230 mẫu huấn luyện và 16 mẫu kiểm thử mới.
- Khi viết khóa luận, cần nêu rõ con số thuộc phiên bản nào (32 cụm hay 36 cụm).

## Thay đổi mã đi kèm

- `data_splitter.py`: 4 cụm tri thức mới (câu hỏi gốc, câu trả lời, `fact_chunk` khớp `game_content.json`) và 8 câu kiểm thử kiểu học sinh thật (viết tắt, không dấu). File sinh ra luôn xuống dòng LF.
- `create_model.py`: thêm từ vựng chuyên đề và đặc trưng neo cho 4 chủ đề, để câu hỏi như “binh thư yếu lược của ai” không bị coi là ngoài phạm vi.
- `context_manager.py`: câu hỏi đã nêu đích danh vị vua (“Vua Trần Nhân Tông là ai?”) không còn bị hỏi lại là “vua nào”.
- `test_regression_suite.py`: nhóm M kiểm tra 4 chủ đề mới, câu hỏi nối tiếp bằng đại từ, và ranh giới với các chủ đề gần nghĩa (Vân Đồn, Hịch tướng sĩ, Hội nghị Bình Than).

## Chạy lại

```bash
cd ai
python data_splitter.py
python create_model.py
python test_model.py
python test_regression_suite.py
```
