"""
MODULE: CONVERSATIONAL CONTEXT MANAGER & DISCOURSE RESOLUTION
================================================================================
Khắc phục triệt để Khó khăn 1 & Khó khăn 2 theo đúng yêu cầu:
1. Quản lý trạng thái đa lượt theo session_id (Session Memory):
   - turn_count, last_unit_id, last_topic, last_event, last_entity
   - last_individual_entity, last_time_period ("1258", "1285", "1288")
   - last_tran_king ("Vua Trần Thái Tông" vs "Vua Trần Nhân Tông & Thượng hoàng Trần Thánh Tông")
   - last_battle ("Đông Bộ Đầu", "Bình Lệ Nguyên", "Bạch Đằng", "Vân Đồn"...)
2. Giải quyết 6 dạng câu hỏi nối tiếp (Follow-up Patterns):
   - "Vua Trần đã xử lý thế nào?" / "Nhà vua xử lý ra sao?"
   - "Nhà vua làm gì tiếp theo?" / "Sau đó làm gì?"
   - "Vậy quân ta chống trả ra sao?"
   - "Tại sao lại làm như vậy?"
   - "Kết quả của trận đó là gì?"
   - "Còn năm 1285 thì sao?" (Timeline Shift)
3. Ngăn ngừa ô nhiễm ngữ cảnh cũ (Stale Context Prevention):
   - Khi câu hỏi mới chứa thực thể/sự kiện độc lập mới (VD: chuyển sang "Bạch Đằng"),
     không chèn thực thể cũ (như "Trần Quốc Toản").
4. Xử lý câu hỏi chứa tiền đề sai (False Premise Handling):
   - "Trần Hưng Đạo bóp cam" -> Đính chính là Trần Quốc Toản tại bến Bình Than.
   - "Trần Quốc Toản chỉ huy Bạch Đằng 1288" -> Đính chính là Trần Quốc Tuấn.
5. Phân biệt rõ các vị vua Trần (King Disambiguation & Clarification):
   - Nếu hỏi "Vua Trần đã xử lý thế nào?" mà CHƯA có ngữ cảnh -> Yêu cầu làm rõ (Clarification)
     giữa 1258 (Trần Thái Tông) và 1285/1288 (Trần Nhân Tông & Trần Thánh Tông).
6. Nhận diện câu hỏi ngoài phạm vi ghi chép SGK 7 (Absent Historical Facts):
   - Thông tin đời tư/hậu cần không có trong chính sử SGK 7 -> Giải thích chuẩn mực.
"""

import re
import unicodedata
from typing import Dict, Any, Optional, Tuple, List


def remove_accents(text: str) -> str:
    if not text:
        return ""
    nfd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfd if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D")


def normalize_vi(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(text.split())


# Danh mục các phản hồi đặc biệt (Làm rõ, Đính chính tiền đề sai, Thông tin ngoài phạm vi)
SPECIAL_GROUNDED_RESPONSES: Dict[str, Dict[str, Any]] = {
    "CLARIFY_AMBIGUOUS_TRAN_KING": {
        "unit_id": "CLARIFY_AMBIGUOUS_TRAN_KING",
        "category": "CLARIFICATION",
        "topic": "Làm rõ vị vua Trần trong ba lần kháng chiến",
        "entity": "Các vua Trần (Trần Thái Tông, Trần Thánh Tông, Trần Nhân Tông)",
        "event": "Ba lần kháng chiến chống Mông - Nguyên (1258 - 1288)",
        "fact_chunk": "Trong 3 lần kháng chiến chống Mông - Nguyên, Đại Việt có các vị vua lãnh đạo khác nhau: Lần 1 (1258) là Vua Trần Thái Tông; Lần 2 (1285) và Lần 3 (1287-1288) do Vua Trần Nhân Tông cùng Thượng hoàng Trần Thánh Tông lãnh đạo.",
        "answer": (
            "Trong ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288), triều Trần có các vị vua lãnh đạo qua từng giai đoạn lịch sử rất cụ thể:\n\n"
            "• **Kháng chiến lần 1 (1258)**: **Vua Trần Thái Tông** (cùng Thái sư Trần Thủ Độ) kiên quyết cự tuyệt sứ giả Mông Cổ, trực tiếp chỉ huy trận Bình Lệ Nguyên và lãnh đạo đại thắng Đông Bộ Đầu.\n"
            "• **Kháng chiến lần 2 (1285)**: **Vua Trần Nhân Tông** cùng **Thượng hoàng Trần Thánh Tông** lãnh đạo, triệu tập Hội nghị Bình Than, Hội nghị Diên Hồng và cử Trần Hưng Đạo làm Tiết chế thống lĩnh quân đội.\n"
            "• **Kháng chiến lần 3 (1287 – 1288)**: Vẫn là **Vua Trần Nhân Tông** và **Thượng hoàng Trần Thánh Tông** tiếp tục cùng quân dân làm nên chiến thắng lịch sử trên sông Bạch Đằng.\n\n"
            "Em đang muốn tìm hiểu về cách xử lý hay quyết sách của vị vua Trần nào trong cuộc kháng chiến năm nào?"
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 68,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Ba lần kháng chiến chống quân Mông - Nguyên",
            "fact_chunk": "Trong 3 lần kháng chiến chống Mông - Nguyên, nhà Trần có các vị vua lãnh đạo: Lần 1 (1258) là Vua Trần Thái Tông; Lần 2 (1285) và Lần 3 (1288) là Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông."
        }
    },
    "CORRECTION_FALSE_PREMISE_ORANGE": {
        "unit_id": "CORRECTION_FALSE_PREMISE_ORANGE",
        "category": "CORRECTION",
        "topic": "Đính chính sự kiện bóp nát quả cam tại bến Bình Than",
        "entity": "Trần Quốc Toản (không phải Trần Hưng Đạo)",
        "event": "Hội nghị Bình Than (Tháng 10/1282)",
        "fact_chunk": "Tháng 10/1282, tại hội nghị Bình Than, Hoài Văn hầu Trần Quốc Toản vì tuổi còn nhỏ (15-16 tuổi) không được vào dự bàn việc quân, căm tức giặc và hổ thẹn đã vô tình bóp nát quả cam vua ban lúc nào không biết.",
        "answer": (
            "Thầy đính chính giúp em một chi tiết lịch sử quan trọng nhé: Người bóp nát quả cam vì lòng yêu nước và căm thù giặc tại bến Bình Than là **Hoài Văn hầu Trần Quốc Toản**, chứ **không phải** Hưng Đạo Đại vương Trần Quốc Tuấn!\n\n"
            "• **Bối cảnh (1282)**: Khi vua Trần mở hội nghị Bình Than bàn kế đánh giặc, Trần Quốc Toản vì còn quá trẻ (mới khoảng 15 – 16 tuổi) nên không được vào khoang thuyền dự họp việc quân cùng các vương hầu lớn tuổi.\n"
            "• **Chi tiết quả cam**: Vua Trần ban cho chàng quả cam quý để an ủi. Vì vừa căm thù quân Nguyên nghênh ngang, vừa uất ức hổ thẹn vì không được góp sức cứu nước, trong lúc ấm ức chàng đã vô tình bóp nát vụn quả cam trong tay lúc nào không biết.\n"
            "• **Hành động sau đó**: Trần Quốc Toản trở về chiêu mộ hơn 1.000 gia nô, thân quyến, sắm sửa vũ khí và may lá cờ thêu 6 chữ vàng *'Phá cường địch, báo hoàng ân'* xông pha trận mạc!"
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13 & Đại Việt Sử Ký Toàn Thư",
            "page_number": 71,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ hai chống quân Nguyên (1285)",
            "fact_chunk": "Tháng 10/1282, tại hội nghị Bình Than, Hoài Văn hầu Trần Quốc Toản vì tuổi nhỏ không được dự bàn việc quân, uất ức bóp nát quả cam vua ban."
        }
    },
    "CORRECTION_FALSE_PREMISE_BACH_DANG": {
        "unit_id": "CORRECTION_FALSE_PREMISE_BACH_DANG",
        "category": "CORRECTION",
        "topic": "Đính chính tổng chỉ huy trận Bạch Đằng năm 1288",
        "entity": "Trần Hưng Đạo (không phải Trần Quốc Toản)",
        "event": "Đại thắng Bạch Đằng (Tháng 4/1288)",
        "fact_chunk": "Tháng 4/1288, Quốc công Tiết chế Hưng Đạo Đại vương Trần Quốc Tuấn trực tiếp chỉ huy trận địa cọc ngầm Bạch Đằng tiêu diệt toàn bộ thủy quân xâm lược do Ô Mã Nhi và Phàn Tiếp chỉ huy. Trần Quốc Toản đã anh dũng chiến đấu và hy sinh trong kháng chiến lần 2 năm 1285.",
        "answer": (
            "Thầy đính chính giúp em một chi tiết lịch sử nhé: Người trực tiếp bố trí trận địa cọc ngầm và chỉ huy đại thắng vang dội trên sông Bạch Đằng năm 1288 là **Quốc công Tiết chế Hưng Đạo Đại vương Trần Quốc Tuấn**, chứ **không phải** Trần Quốc Toản!\n\n"
            "• **Trần Quốc Toản**: Tham gia anh dũng trong cuộc kháng chiến lần thứ hai (1285) với lá cờ *'Phá cường địch, báo hoàng ân'*, lập nhiều chiến công lớn ở vùng sông Thương, Tây Kết.\n"
            "• **Trần Hưng Đạo**: Là vị tổng chỉ huy tối cao của quân đội Đại Việt, người kế thừa truyền thống Ngô Quyền năm 938, cắm cọc gỗ bịt sắt xuống lòng sông Bạch Đằng năm 1288, bắt sống các tướng giặc Ô Mã Nhi, Phàn Tiếp và chôn vùi toàn bộ thủy quân xâm lược Nguyên Mông!"
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 75,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ ba chống quân Nguyên (1287 - 1288)",
            "fact_chunk": "Tháng 4/1288, Hưng Đạo Đại vương Trần Quốc Tuấn chỉ huy đại thắng cọc ngầm trên sông Bạch Đằng, bắt sống Ô Mã Nhi và Phàn Tiếp."
        }
    },
    "ABSENT_HISTORICAL_FACT": {
        "unit_id": "ABSENT_HISTORICAL_FACT",
        "category": "ABSENT_FACT",
        "topic": "Thông tin chi tiết đời tư/hậu cần ngoài phạm vi SGK 7",
        "entity": "Lịch sử thời Trần",
        "event": "Kháng chiến chống Mông - Nguyên (1258 - 1288)",
        "fact_chunk": "Trong chương trình Lịch sử 7 cũng như chính sử Đại Việt Sử Ký Toàn Thư, các chi tiết đời tư hoặc hậu cần cụ thể không được ghi chép hoặc không thuộc trọng tâm bài học.",
        "answer": (
            "Trong chương trình Lịch sử 7 cũng như các bộ chính sử (như *Đại Việt Sử Ký Toàn Thư*), những thông tin chi tiết riêng biệt này không được ghi chép lại hoặc nằm ngoài phạm vi bài học.\n\n"
            "Trọng tâm của chuyên đề là tinh thần yêu nước, nghệ thuật quân sự tài tình và các chiến công oanh liệt của ông cha ta như:\n"
            "• Kế sách *'Vườn không nhà trống'* làm suy kiệt quân Mông Cổ năm 1258.\n"
            "• Hào khí Hội nghị Bình Than và Hội nghị Diên Hồng năm 1285.\n"
            "• Trận đánh cướp thuyền lương Vân Đồn và trận địa cọc ngầm Bạch Đằng năm 1288.\n\n"
            "Em có muốn cùng thầy tìm hiểu về những chiến công hào hùng này không?"
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13 & Đại Việt Sử Ký Toàn Thư",
            "page_number": 70,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13",
            "fact_chunk": "Trọng tâm bài học lớp 7 tập trung vào các sự kiện lịch sử chính yếu, đường lối kháng chiến và nhân vật anh hùng tiêu biểu."
        }
    },
    "VERIFY_CANNON_BACH_DANG": {
        "unit_id": "VERIFY_CANNON_BACH_DANG",
        "category": "VERIFICATION",
        "topic": "Xác minh việc sử dụng đại bác trong trận Bạch Đằng 1288",
        "entity": "Quân đội nhà Trần & Vũ khí thời Trần",
        "event": "Trận Bạch Đằng (Tháng 4/1288)",
        "fact_chunk": "Trong 3 lần kháng chiến chống Mông - Nguyên (thế kỷ XIII), quân đội nhà Trần chưa sử dụng súng đại bác. Vũ khí chủ yếu là vũ khí lạnh (gươm, giáo, dao găm, cung nỏ) và bãi cọc gỗ bịt sắt ngầm. Súng đại bác (súng thần cơ) chỉ xuất hiện ở Việt Nam vào đầu thế kỷ XV do Hồ Nguyên Trừng sáng chế thời nhà Hồ.",
        "answer": (
            "Khẳng định này là **hoàn toàn không đúng (sai)**.\n\n"
            "• **Sử liệu xác nhận**: Trong trận Bạch Đằng năm 1288 cũng như toàn bộ ba lần kháng chiến chống Mông – Nguyên ở thế kỷ XIII, **quân đội nhà Trần chưa từng sử dụng súng đại bác hay hỏa pháo lớn** (theo các tài liệu SGK Lịch sử 7 và Đại Việt Sử Ký Toàn Thư).\n"
            "• **Vũ khí thực tế được ghi nhận**: Quân dân Đại Việt chủ yếu sử dụng vũ khí lạnh (gươm, giáo, mác, khiên, dao găm), cung nỏ, thuyền chiến cơ động kết hợp trận địa bãi cọc gỗ vót nhọn bịt sắt cắm ngầm dưới lòng sông.\n"
            "• **Nguồn gốc đại bác ở Việt Nam**: Súng đại bác (súng thần công, súng thần cơ) chỉ xuất hiện ở nước ta vào giai đoạn đầu thế kỷ XV (thời nhà Hồ, do Tả tướng quốc Hồ Nguyên Trừng sáng chế)."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13 & Đại Việt Sử Ký Toàn Thư",
            "page_number": 75,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ ba chống quân Nguyên (1287 - 1288)",
            "fact_chunk": "Trong các cuộc kháng chiến chống Mông - Nguyên thế kỷ XIII, nhà Trần chưa sử dụng súng đại bác. Vũ khí chủ yếu là vũ khí lạnh và cọc ngầm."
        }
    },
    "EVIDENCE_BINH_LE_NGUYEN_TROOP_COUNT": {
        "unit_id": "EVIDENCE_BINH_LE_NGUYEN_TROOP_COUNT",
        "category": "EVIDENCE",
        "topic": "Số lượng quân đội tại trận Bình Lệ Nguyên (1258)",
        "entity": "Trần Thái Tông & Ngột Lương Hợp Thai",
        "event": "Trận Bình Lệ Nguyên (Tháng 1/1258)",
        "fact_chunk": "Sử sách và SGK Lịch sử 7 chỉ ghi rõ quân số phía Mông Cổ là 3 vạn kỵ binh do Ngột Lương Hợp Thai chỉ huy. Các tài liệu lịch sử chính thống không ghi chép con số chính xác số lượng binh sĩ của quân Trần tham gia trận Bình Lệ Nguyên.",
        "answer": (
            "Trong các tài liệu lịch sử chính thống hiện có (bao gồm SGK Lịch sử 7 và Đại Việt Sử Ký Toàn Thư), **hoàn toàn không có số liệu ghi chép chính xác con số bao nhiêu binh sĩ nhà Trần tham gia trận Bình Lệ Nguyên**.\n\n"
            "• **Số liệu được sử liệu ghi nhận**: Tài liệu chỉ ghi nhận rõ lực lượng của quân xâm lược Mông Cổ là khoảng **3 vạn kỵ binh** do chủ tướng Ngột Lương Hợp Thai chỉ huy tiến vào Đại Việt.\n"
            "• **Phía nhà Trần**: Sử liệu chỉ ghi nhận Vua Trần Thái Tông trực tiếp đốc chiến chỉ huy đại quân chủ lực chặn giặc tại phòng tuyến Bình Lệ Nguyên (Vĩnh Phúc), sau đó nghe lời khuyên của danh tướng Lê Tần (Lê Phụ Trần) chủ động rút quân về xuôi để bảo toàn lực lượng chuẩn bị phản công."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13 & Đại Việt Sử Ký Toàn Thư",
            "page_number": 68,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ nhất chống quân Mông Cổ (1258)",
            "fact_chunk": "Tài liệu ghi rõ quân Mông Cổ có 3 vạn quân; không có số liệu chính xác về số lượng quân lính nhà Trần."
        }
    },
    "EVIDENCE_TRAN_HUNG_DAO_QUOTE_BACH_DANG": {
        "unit_id": "EVIDENCE_TRAN_HUNG_DAO_QUOTE_BACH_DANG",
        "category": "EVIDENCE",
        "topic": "Câu nói nguyên văn của Trần Hưng Đạo tại trận Bạch Đằng (1288)",
        "entity": "Trần Quốc Tuấn (Trần Hưng Đạo)",
        "event": "Đại thắng Bạch Đằng (1288)",
        "fact_chunk": "Trong trận Bạch Đằng (1288), các bộ chính sử (Đại Việt Sử Ký Toàn Thư) và SGK Lịch sử 7 không ghi chép câu nói nguyên văn nào của Trần Hưng Đạo. Những câu nói nổi tiếng của ông gắn với các thời điểm khác như năm 1285.",
        "answer": (
            "Trong các bộ chính sử (Đại Việt Sử Ký Toàn Thư) cũng như SGK Lịch sử 7, **không có ghi chép về câu nói nguyên văn nào của Hưng Đạo Đại vương Trần Quốc Tuấn diễn ra ngay trong trận quyết chiến Bạch Đằng năm 1288**.\n\n"
            "Tuy nhiên, lịch sử ghi lại những câu nói và áng văn bất hủ của Trần Hưng Đạo trong các giai đoạn khác của cuộc kháng chiến:\n"
            "• **'Bệ hạ chém đầu tôi trước rồi hãy hàng!'**: Lời khẳng định đanh thép trấn an vua Trần Nhân Tông vào đầu năm **1285** khi thế giặc Thoát Hoan đang tràn vào hung hãn.\n"
            "• **'Ta thường tới bữa quên ăn, nửa đêm vỗ gối, ruột đau như cắt, nước mắt đầm đìa...'**: Trích từ áng thiên cổ hùng văn *'Hịch tướng sĩ'* (soạn trước cuộc kháng chiến lần hai năm **1285** nhằm khích lệ tinh thần tướng sĩ quyết chiến quyết thắng).\n"
            "*(Lưu ý: Câu nói 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo' là của Thái sư Trần Thủ Độ nói với vua Trần Thái Tông vào năm 1258)*."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13 & Đại Việt Sử Ký Toàn Thư",
            "page_number": 75,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13",
            "fact_chunk": "Sử liệu không có câu nói nguyên văn của Trần Hưng Đạo ghi lại ngay trong trận Bạch Đằng 1288."
        }
    },
    "EVIDENCE_GUNPOWDER_1285": {
        "unit_id": "EVIDENCE_GUNPOWDER_1285",
        "category": "EVIDENCE",
        "topic": "Xác minh việc sử dụng thuốc nổ trong kháng chiến năm 1285",
        "entity": "Vũ khí thời Trần",
        "event": "Kháng chiến lần 2 (1285)",
        "fact_chunk": "Trong các tài liệu lịch sử chính thống về cuộc kháng chiến lần thứ hai năm 1285 (SGK Lịch sử 7 và Đại Việt Sử Ký Toàn Thư), không có ghi chép về việc quân đội nhà Trần sử dụng thuốc nổ. Vũ khí chính thời kỳ này là vũ khí lạnh (giáo, mác, kiếm, cung nỏ).",
        "answer": (
            "Trong các tài liệu lịch sử chính thống (SGK Lịch sử 7 và Đại Việt Sử Ký Toàn Thư), **hoàn toàn không có ghi chép nào về việc quân đội nhà Trần sử dụng thuốc nổ trong cuộc kháng chiến năm 1285**.\n\n"
            "• **Vũ khí chủ đạo**: Quân dân thời Trần lúc bấy giờ chủ yếu sử dụng vũ khí lạnh (giáo, mác, kiếm, dao găm, cung nỏ) kết hợp địa hình hiểm trở và các trận đánh phục kích sấm sét trên sông nước lẫn bộ binh.\n"
            "• **Căn cứ lịch sử**: Kỹ thuật thuốc nổ quân sự và hỏa khí lớn chỉ bắt đầu được ghi chép và chế tạo quy mô ở nước ta vào giai đoạn đầu thế kỷ XV (thời Hồ Nguyên Trừng sáng chế súng thần cơ)."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13 & Đại Việt Sử Ký Toàn Thư",
            "page_number": 72,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13",
            "fact_chunk": "Tài liệu lịch sử không ghi nhận việc sử dụng thuốc nổ trong kháng chiến chống Nguyên năm 1285."
        }
    },
    "COUNTERFACTUAL_HOLD_THANG_LONG": {
        "unit_id": "COUNTERFACTUAL_HOLD_THANG_LONG",
        "category": "COUNTERFACTUAL",
        "topic": "Giả định: Nếu quân Trần cố giữ Thăng Long bằng mọi giá thì gặp bất lợi gì?",
        "entity": "Quân dân nhà Trần",
        "event": "Kế sách Vườn không nhà trống & Rút lui chiến lược (1258, 1285)",
        "fact_chunk": "Kỵ binh Mông Cổ có sở trường đánh nhanh thắng nhanh, sức tấn công ban đầu vô cùng hung hãn. Địa hình kinh thành Thăng Long bằng phẳng. Nếu cố thủ thành, quân Trần sẽ rơi vào thế đối đầu trực diện, bị bao vây tiêu hao chủ lực và giúp giặc cướp được lương thực nuôi quân.",
        "answer": (
            "Nếu quân Trần cố thủ giữ kinh thành Thăng Long bằng mọi giá thay vì chủ động rút lui, theo **suy luận lịch sử và quy luật nghệ thuật quân sự** (phân biệt với diễn biến thực tế được ghi nhận trong SGK), quân ta sẽ phải đối mặt với **3 bất lợi chí mạng**:\n\n"
            "1. **Đối đầu trực diện với mũi nhọn hung hãn nhất của giặc**: Kỵ binh Mông Cổ lúc mới sang có sức càn quét và tính cơ động cực kỳ khủng khiếp. Lấy quân số ít hơn để tử thủ giáp lá cà sẽ khiến quân ta chịu thương vong vô cùng nặng nề.\n"
            "2. **Nguy cơ bị bao vây và tiêu diệt toàn bộ quân chủ lực**: Địa hình Thăng Long bằng phẳng, nếu giặc khép vòng vây chia cắt triều đình với hậu phương sông nước, quân ta sẽ mất đường cơ động và rơi vào thế bị cô lập hoàn toàn.\n"
            "3. **Đánh mất ưu thế tuyệt đối của kế sách 'Vườn không nhà trống'**: Nếu cố thủ trong thành, nhân dân và kho lương không kịp sơ tán. Quân Mông Cổ sẽ cướp bóc được lương thực tại chỗ để nuôi quân, hiện thực hóa được chiến thuật 'lấy chiến tranh nuôi chiến tranh' và đánh nhanh thắng nhanh của chúng.\n\n"
            "*Chính vì vậy, quyết định chủ động bỏ thành Thăng Long là một đỉnh cao thao lược: nhường một tòa thành rỗng để bảo toàn nguyên vẹn quân đội và đẩy kẻ thù vào cảnh khốn quẫn!*"
        ),
        "grounding_source": None
    },
    "VERIFY_ONLY_FOOD_SHORTAGE": {
        "unit_id": "VERIFY_ONLY_FOOD_SHORTAGE",
        "category": "VERIFICATION",
        "topic": "Phản biện: Có thể kết luận nhà Trần thắng chỉ vì địch thiếu lương thực không?",
        "entity": "Vua tôi nhà Trần & Quân dân Đại Việt",
        "event": "Thắng lợi ba lần kháng chiến chống Mông - Nguyên",
        "fact_chunk": "Thắng lợi ba lần kháng chiến là kết tinh của 3 nguyên nhân căn bản: đại đoàn kết toàn dân, bộ chỉ huy tài ba của các vua Trần và Trần Quốc Tuấn, cùng nghệ thuật quân sự độc đáo (vườn không nhà trống, lấy yếu thắng mạnh, chớp thời cơ phản công). Thiếu lương thực là đòn bẻ gãy hậu cần rất quan trọng nhưng không phải nguyên nhân duy nhất.",
        "answer": (
            "**Không thể kết luận nhà Trần chiến thắng chỉ đơn thuần vì quân địch thiếu lương thực.**\n\n"
            "Việc quân Mông – Nguyên thiếu lương thực (do kế sách *'Vườn không nhà trống'* và trận hải chiến Vân Đồn bẻ gãy) là một **đòn đánh hậu cần mang tính bước ngoặt**, nhưng thắng lợi vĩ đại của Đại Việt là **kết tinh tổng hòa của ba nguyên nhân căn bản** theo SGK Lịch sử 7:\n\n"
            "1. **Khối đại đoàn kết toàn dân tộc (Nguyên nhân cốt lõi nhất)**: 'Vua tôi đồng lòng, anh em hòa mục, cả nước góp sức'. Tinh thần yêu nước triệu người như một ở Hội nghị Diên Hồng và Bình Than đã biến mỗi người dân thành một chiến sĩ.\n"
            "2. **Tài năng thao lược của bộ chỉ huy**: Sự lãnh đạo sáng suốt của các vị vua Trần cùng thiên tài quân sự của Quốc công Tiết chế Trần Hưng Đạo, biết chọn đúng thời điểm, đúng địa hình để đánh đòn quyết định.\n"
            "3. **Nghệ thuật quân sự sáng tạo toàn diện**: Thiếu lương thực chỉ khiến giặc suy yếu thể lực, nhưng nếu không có nghệ thuật phục kích cọc ngầm Bạch Đằng, các cuộc phản công thần tốc ở Đông Bộ Đầu, Hàm Tử, Chương Dương và tài bơi lặn đục thuyền của Yết Kiêu... thì ta không thể tiêu diệt và quét sạch được đạo quân xâm lược khổng lồ."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 76,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Nguyên nhân thắng lợi và ý nghĩa lịch sử",
            "fact_chunk": "Nguyên nhân thắng lợi là sự kết hợp của tinh thần đoàn kết toàn dân, tài chỉ huy của các vua Trần và Trần Hưng Đạo, cùng nghệ thuật quân sự độc đáo."
        }
    },
    "FACT_BACH_DANG_WHICH_WAR": {
        "unit_id": "FACT_BACH_DANG_WHICH_WAR",
        "category": "FACT",
        "topic": "Trận Bạch Đằng năm 1288 kết thúc cuộc kháng chiến lần thứ mấy?",
        "entity": "Trần Quốc Tuấn & Quân đội nhà Trần",
        "event": "Đại thắng Bạch Đằng (Tháng 4/1288)",
        "fact_chunk": "Đại thắng Bạch Đằng tháng 4 năm 1288 đã kết thúc thắng lợi cuộc kháng chiến lần thứ ba chống quân xâm lược Nguyên (1287 - 1288), đập tan hoàn toàn tham vọng xâm lược Đại Việt của nhà Nguyên.",
        "answer": (
            "**Chiến thắng trên sông Bạch Đằng năm 1288 đã kết thúc thắng lợi cuộc kháng chiến chống quân Nguyên lần thứ ba (1287 – 1288).**\n\n"
            "Đây là trận quyết chiến chiến lược lớn nhất trong cuộc kháng chiến lần thứ ba, do Quốc công Tiết chế Trần Hưng Đạo trực tiếp chỉ huy vào **tháng 4 năm 1288** (theo SGK Lịch sử 7; Đại Việt Sử Ký Toàn Thư ghi chép là ngày 8 tháng 3 năm Mậu Tý theo âm lịch). Trận đánh đã tiêu diệt và bắt sống toàn bộ thủy quân xâm lược của Ô Mã Nhi và Phàn Tiếp, chôn vùi vĩnh viễn mộng xâm lăng của đế chế Nguyên Mông đối với Đại Việt."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 75,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ ba chống quân Nguyên (1287 - 1288)",
            "fact_chunk": "Trận Bạch Đằng (tháng 4/1288) kết thúc thắng lợi cuộc kháng chiến lần thứ ba chống quân Nguyên."
        }
    },
    "FACT_BACH_DANG_COMMANDER_YEAR": {
        "unit_id": "FACT_BACH_DANG_COMMANDER_YEAR",
        "category": "FACT",
        "topic": "Người chỉ huy và thời gian diễn ra trận Bạch Đằng 1288",
        "entity": "Trần Quốc Tuấn (Trần Hưng Đạo)",
        "event": "Đại thắng Bạch Đằng (Tháng 4/1288)",
        "fact_chunk": "Người chỉ huy đại thắng Bạch Đằng là Quốc công Tiết chế Hưng Đạo Đại vương Trần Quốc Tuấn, diễn ra vào tháng 4 năm 1288 theo SGK Lịch sử 7.",
        "answer": (
            "**Người chỉ huy đại thắng Bạch Đằng năm 1288 là Quốc công Tiết chế Hưng Đạo Đại vương Trần Quốc Tuấn (Trần Hưng Đạo), diễn ra vào năm 1288 (tháng 4 năm 1288 theo SGK Lịch sử 7).**\n\n"
            "Trận đánh đã vận dụng tài tình quy luật thủy triều kết hợp bãi cọc gỗ bịt sắt ngầm, tiêu diệt toàn bộ đạo thủy quân giặc và bắt sống các tướng chỉ huy Ô Mã Nhi, Phàn Tiếp (theo Đại Việt Sử Ký Toàn Thư ghi nhận quân ta bắt hơn 400 chiến thuyền)."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 75,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13",
            "fact_chunk": "Trần Hưng Đạo chỉ huy trận Bạch Đằng tháng 4 năm 1288."
        }
    },
    "SIGNIFICANCE_DONG_BO_DAU": {
        "unit_id": "KC1_DONG_BO_DAU",
        "category": "SIGNIFICANCE",
        "topic": "Ý nghĩa lịch sử của trận phản công Đông Bộ Đầu (1258)",
        "entity": "Trần Thái Tông & Quân dân nhà Trần",
        "event": "Trận Đông Bộ Đầu (29/1/1258)",
        "fact_chunk": "Đại thắng Đông Bộ Đầu (29/1/1258) trực tiếp quét sạch giặc khỏi kinh thành Thăng Long, kết thúc thắng lợi cuộc kháng chiến lần 1 và đập tan huyền thoại bách chiến bách thắng của kỵ binh Mông Cổ.",
        "answer": (
            "Đại thắng Đông Bộ Đầu (ngày 29/1/1258) mang **ba ý nghĩa lịch sử to lớn**:\n\n"
            "1. **Trực tiếp giải phóng kinh thành Thăng Long**: Quét sạch hoàn toàn 3 vạn kỵ binh Mông Cổ khỏi bờ cõi, kết thúc thắng lợi cuộc kháng chiến lần thứ nhất chỉ sau chưa đầy một tháng.\n"
            "2. **Đập tan huyền thoại 'bách chiến bách thắng' của kỵ binh Mông Cổ**: Giáng đòn thất bại nặng nề đầu tiên vào đế chế xâm lược hung bạo bậc nhất thế giới thời bấy giờ, củng cố niềm tự hào và ý chí tự cường dân tộc.\n"
            "3. **Khẳng định tính sáng suốt của nghệ thuật quân sự Đại Việt**: Chứng minh tính hiệu quả của kế sách chủ động rút lui bảo toàn lực lượng, 'Vườn không nhà trống' và chớp đúng thời cơ giặc suy kiệt để tổng phản công quyết định."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 69,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13",
            "fact_chunk": "Chiến thắng Đông Bộ Đầu kết thúc thắng lợi kháng chiến lần 1 năm 1258."
        }
    },
    "SIGNIFICANCE_DIEN_HONG": {
        "unit_id": "SIGNIFICANCE_DIEN_HONG",
        "category": "SIGNIFICANCE",
        "topic": "Vai trò và ý nghĩa của Hội nghị Diên Hồng (1285)",
        "entity": "Thượng hoàng Trần Thánh Tông & Các bô lão",
        "event": "Hội nghị Diên Hồng (Đầu năm 1285)",
        "fact_chunk": "Hội nghị Diên Hồng là biểu tượng đỉnh cao của khối đại đoàn kết toàn dân tộc, thể hiện tinh thần dân chủ và ý chí quyết chiến muôn người như một chống lại 50 vạn quân Nguyên.",
        "answer": (
            "Hội nghị Diên Hồng (đầu năm 1285) giữ **vai trò lịch sử tối quan trọng**:\n\n"
            "1. **Biểu tượng đỉnh cao của khối đại đoàn kết toàn dân**: Là lần đầu tiên trong lịch sử, triều đình mở hội nghị trưng cầu dân ý các bậc bô lão đại diện cho muôn dân trăm họ để cùng quyết định việc lớn giữ nước.\n"
            "2. **Củng cố ý chí quyết chiến sắt đá**: Tiếng hô **'ĐÁNH!'** đồng thanh vang dội của các bô lão đã xóa tan tư tưởng hòa hoãn dao động, biến ý chí của hoàng tộc thành sức mạnh sục sôi của toàn thể dân tộc.\n"
            "3. **Tạo nền tảng cho thế trận chiến tranh nhân dân**: Đặt nền móng vững chắc để 'vua tôi đồng lòng, anh em hòa mục, cả nước góp sức' đánh bại 50 vạn quân xâm lược Nguyên Mông."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 71,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13",
            "fact_chunk": "Hội nghị Diên Hồng thể hiện sự đồng lòng của vua tôi và nhân dân cả nước quyết tâm đánh giặc."
        }
    },
    "TACTICAL_IMPACT_VUON_KHONG_NHA_TRONG": {
        "unit_id": "TACTICAL_IMPACT_VUON_KHONG_NHA_TRONG",
        "category": "CAUSE",
        "topic": "Những bất lợi chí mạng mà kế sách Vườn không nhà trống gây ra cho quân xâm lược",
        "entity": "Quân xâm lược Mông - Nguyên",
        "event": "Kế sách Vườn không nhà trống (1258, 1285)",
        "fact_chunk": "Kế sách Vườn không nhà trống triệt phá hoàn toàn nguồn lương thực tại chỗ, bẻ gãy chiến thuật lấy chiến tranh nuôi chiến tranh, đẩy quân giặc vào cảnh thiếu đói, dịch bệnh và suy sụp hoàn toàn sĩ khí.",
        "answer": (
            "Kế sách **'Vườn không nhà trống'** của nhà Trần đã trực tiếp đẩy quân xâm lược Mông – Nguyên vào **3 bất lợi chí mạng**:\n\n"
            "1. **Triệt phá hoàn toàn nguồn hậu cần tại chỗ**: Quân Mông – Nguyên viễn chinh với phương châm cốt lõi là *'lấy chiến tranh nuôi chiến tranh'* (cướp bóc lương thực của dân bản địa để nuôi quân). Khi tiến vào kinh thành Thăng Long chỉ gặp cảnh *'thành rỗng không bóng người'*, không cướp được một hạt thóc hay gia súc nào, khiến đoàn quân đông nghẹt lập tức rơi vào khủng hoảng thiếu đói nghiêm trọng.\n"
            "2. **Làm suy kiệt thể lực và phát sinh dịch bệnh lan tràn**: Việc thiếu đói kéo dài cộng với khí hậu nhiệt đới nóng ẩm của Đại Việt đã khiến thể lực binh lính giặc giảm sút nghiêm trọng, dịch bệnh bùng phát làm hao tổn sinh lực địch từng ngày mà không cần giao tranh lớn.\n"
            "3. **Bẻ gãy chiến lược 'đánh nhanh thắng nhanh' và làm suy sụp sĩ khí**: Không tìm thấy quân chủ lực nhà Trần để giao chiến trực diện, lại bị giam chân trong các tòa thành trống rỗng thiếu ăn, quân xâm lược từ thế hăng hái ban đầu nhanh chóng rơi vào hoang mang, sa sút tinh thần chiến đấu và lâm vào thế hoàn toàn bị động."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 69,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ nhất chống quân Mông Cổ (1258)",
            "fact_chunk": "Quân Mông Cổ vào thành Thăng Long trống rỗng, không tìm được lương thực, rơi vào tình thế vô cùng khó khăn, thiếu lương thực và dịch bệnh."
        }
    },
    "COMPARE_1258_AND_1285": {
        "unit_id": "COMPARE_1258_AND_1285",
        "category": "COMPARISON",
        "topic": "So sánh cách nhà Trần đối phó quân Mông Cổ năm 1258 và quân Nguyên năm 1285",
        "entity": "Quân dân nhà Trần",
        "event": "Kháng chiến lần 1 (1258) & Kháng chiến lần 2 (1285)",
        "fact_chunk": "So sánh cách đối phó năm 1258 và 1285: Giống nhau ở chủ động rút lui chiến lược, triệt để thực hiện Vườn không nhà trống và chớp thời cơ phản công; Khác nhau ở quy mô kháng chiến (3 vạn vs 50 vạn), chuẩn bị toàn dân (Bình Than, Diên Hồng) và phạm vi chiến trường liên hoàn.",
        "answer": (
            "So sánh cách đối phó của nhà Trần trong hai cuộc kháng chiến năm 1258 và năm 1285:\n\n"
            "**1. Điểm giống nhau**:\n"
            "• **Chủ động rút lui chiến lược để bảo toàn lực lượng**: Cả hai lần quân ta đều không cố thủ Thăng Long khi giặc đang hung hãn ban đầu, mà chủ động rút quân về xuôi để bảo toàn nguyên vẹn quân chủ lực.\n"
            "• **Triệt để thực hiện kế sách 'Vườn không nhà trống'**: Cả hai lần nhân dân đều sơ tán, để lại kinh thành trống rỗng không một hạt thóc, triệt tiêu hoàn toàn nguồn lương ăn tại chỗ của giặc.\n"
            "• **Kiên nhẫn chớp thời cơ tổng phản công**: Đều chờ giặc đói khát, dịch bệnh và suy kiệt sĩ khí rồi mới dồn lực lượng mở đòn phản công quyết định quét sạch quân thù.\n\n"
            "**2. Điểm khác biệt**:\n"
            "• **Về quy mô và hướng tiến công của giặc**: Năm 1258 Đại Việt chỉ đối đầu với 3 vạn kỵ binh Mông Cổ từ một hướng phía Bắc; năm 1285 giặc huy động tới 50 vạn quân tạo thế gọng kìm hai mặt nguy hiểm (Thoát Hoan từ phía Bắc xuống, Toa Đô từ Chăm-pa đánh lên phía Nam).\n"
            "• **Về quy mô chuẩn bị và hiệu triệu toàn dân**: Năm 1285 nhà Trần tổ chức kháng chiến toàn diện hơn với các hội nghị lớn chưa từng có (Hội nghị Bình Than năm 1282, Hội nghị Diên Hồng năm 1285), có áng văn *'Hịch tướng sĩ'* hiệu triệu quân đội và phong trào tự vũ trang của các tướng trẻ (như đội quân sáu chữ vàng của Trần Quốc Toản).\n"
            "• **Về thế trận phản công**: Năm 1258 phản công tập trung trong một trận quyết định ở Đông Bộ Đầu; năm 1285 phản công trên diện rộng với chuỗi chiến thắng liên hoàn (Tây Kết, Hàm Tử, Chương Dương, Thăng Long, Vạn Kiếp)."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 73,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần 1 (1258) và lần 2 (1285)",
            "fact_chunk": "Nhà Trần đều thực hiện rút lui chiến lược và Vườn không nhà trống; nhưng năm 1285 quy mô 50 vạn quân với thế gọng kìm Thoát Hoan - Toa Đô đòi hỏi chuẩn bị Hội nghị Diên Hồng, Bình Than và phản công liên hoàn."
        }
    },
    "SUMMARY_BACH_DANG_1288_SHORT": {
        "unit_id": "SUMMARY_BACH_DANG_1288_SHORT",
        "category": "FACT",
        "topic": "Tóm tắt ngắn gọn trận Bạch Đằng năm 1288",
        "entity": "Trần Quốc Tuấn (Trần Hưng Đạo)",
        "event": "Đại thắng Bạch Đằng (Tháng 4/1288)",
        "fact_chunk": "Đại thắng Bạch Đằng diễn ra vào tháng 4 năm 1288 do Hưng Đạo Đại vương Trần Quốc Tuấn chỉ huy, cắm cọc ngầm tiêu diệt toàn bộ thủy quân Nguyên, kết thúc thắng lợi cuộc kháng chiến lần thứ ba.",
        "answer": (
            "**Trận Bạch Đằng (tháng 4 năm 1288)** là trận quyết chiến chiến lược vĩ đại do Quốc công Tiết chế Trần Hưng Đạo chỉ huy, vận dụng tài tình quy luật thủy triều và trận địa bãi cọc ngầm để tiêu diệt và bắt sống toàn bộ đạo thủy quân xâm lược Nguyên (bắt sống các tướng Ô Mã Nhi, Phàn Tiếp), kết thúc thắng lợi cuộc kháng chiến lần thứ ba bảo vệ trọn vẹn nền độc lập dân tộc."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 75,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ ba chống quân Nguyên (1287 - 1288)",
            "fact_chunk": "Tháng 4 năm 1288, trận Bạch Đằng do Trần Quốc Tuấn chỉ huy đập tan toàn bộ thủy quân Nguyên, kết thúc cuộc kháng chiến lần 3."
        }
    },
    "MULTI_PART_BACH_DANG_1288": {
        "unit_id": "MULTI_PART_BACH_DANG_1288",
        "category": "FACT",
        "topic": "Ba thông tin cốt lõi về trận Bạch Đằng 1288 (Chỉ huy, Năm, Lần kháng chiến)",
        "entity": "Trần Quốc Tuấn (Trần Hưng Đạo)",
        "event": "Đại thắng Bạch Đằng (1288)",
        "fact_chunk": "Trận Bạch Đằng do Trần Quốc Tuấn chỉ huy, diễn ra vào năm 1288 (tháng 4/1288 theo SGK Lịch sử 7), kết thúc thắng lợi cuộc kháng chiến lần thứ ba chống quân Nguyên (1287 - 1288).",
        "answer": (
            "Ba thông tin theo yêu cầu của câu hỏi:\n\n"
            "1. **Người chỉ huy**: Quốc công Tiết chế Hưng Đạo Đại vương **Trần Quốc Tuấn (Trần Hưng Đạo)**.\n"
            "2. **Năm diễn ra**: Năm **1288** (theo SGK Lịch sử 7, trận đánh diễn ra vào **tháng 4 năm 1288**; Đại Việt Sử Ký Toàn Thư ghi chép là ngày 8 tháng 3 năm Mậu Tý theo âm lịch).\n"
            "3. **Kết thúc cuộc kháng chiến lần thứ mấy**: Kết thúc thắng lợi cuộc **kháng chiến chống quân Nguyên lần thứ ba (1287 – 1288)**."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 75,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ ba chống quân Nguyên (1287 - 1288)",
            "fact_chunk": "Trần Quốc Tuấn chỉ huy trận Bạch Đằng tháng 4 năm 1288, kết thúc thắng lợi cuộc kháng chiến lần thứ ba chống quân Nguyên."
        }
    },
    "COMPARISON_ALL_3_WARS_COMMON": {
        "unit_id": "COMPARISON_ALL_3_WARS_COMMON",
        "category": "COMPARISON",
        "topic": "Điểm chung qua ba lần kháng chiến chống Mông - Nguyên",
        "entity": "Quân dân Đại Việt thời Trần",
        "event": "Ba lần kháng chiến chống Mông - Nguyên (1258 - 1288)",
        "fact_chunk": "Điểm chung qua 3 lần kháng chiến: Đều đối đầu kẻ thù đông mạnh; phát huy đại đoàn kết toàn dân; thực hiện kế sách rút lui chiến lược và Vườn không nhà trống; chọn đúng thời cơ phản công; đều kết thúc bằng thắng lợi oanh liệt bảo vệ độc lập.",
        "answer": (
            "Qua ba lần kháng chiến chống quân Mông – Nguyên (1258, 1285, 1287 – 1288), quân dân thời Trần đã thể hiện **5 điểm chung cốt lõi**:\n\n"
            "1. **Tính chất tự vệ chính nghĩa và đại đoàn kết toàn dân**: Đều là các cuộc chiến đấu bảo vệ độc lập dân tộc; triều đình luôn dựa vào sức mạnh 'cả nước góp sức', 'vua tôi đồng lòng' (Hội nghị Bình Than, Hội nghị Diên Hồng).\n"
            "2. **Chủ động rút lui chiến lược để bảo toàn lực lượng**: Không cố thủ mù quáng khi giặc đang hung hãn, biết lùi bước để giữ gìn nguyên vẹn quân chủ lực.\n"
            "3. **Thực hiện triệt để kế sách 'Vườn không nhà trống'**: Triệt hạ nguồn lương thực tại chỗ của giặc, đẩy địch vào cảnh đói kiệt và dịch bệnh.\n"
            "4. **Nghệ thuật chớp thời cơ phản công quyết định**: Kiên nhẫn chờ khi địch suy kiệt để dồn lực lượng phản công sấm sét (Đông Bộ Đầu 1258, Chương Dương - Hàm Tử 1285, Bạch Đằng 1288).\n"
            "5. **Kết quả trọn vẹn**: Cả ba lần đều toàn thắng vẻ vang, đập tan hoàn toàn tham vọng bành trướng của đế chế Mông - Nguyên, bảo vệ vững chắc non sông."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 76,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Tổng kết ba lần kháng chiến",
            "fact_chunk": "Ba lần kháng chiến đều chung tinh thần đoàn kết, kế sách Vườn không nhà trống, rút lui chiến lược và phản công thắng lợi."
        }
    },
    "EVENT_AFTER_WITHDRAWAL_SITUATION": {
        "unit_id": "EVENT_AFTER_WITHDRAWAL_SITUATION",
        "category": "EVENT",
        "topic": "Cục diện thay đổi thế nào sau khi quân Trần rút khỏi Thăng Long?",
        "entity": "Quân Trần & Quân Mông Cổ",
        "event": "Kháng chiến lần 1 (1258)",
        "fact_chunk": "Sau khi quân Trần rút khỏi Thăng Long thực hiện Vườn không nhà trống, cục diện chiến tranh thay đổi nhanh chóng: Quân Mông Cổ chiếm được thành trống không có lương ăn, nhanh chóng đói khát và suy sụp tinh thần; quân Trần xuôi về Thiên Mạc bảo toàn lực lượng, giữ thế chủ động và chuẩn bị phản công.",
        "answer": (
            "Sau khi quân Trần chủ động rút lui và thực hiện kế sách 'Vườn không nhà trống' tại Thăng Long, **cục diện chiến trường đã thay đổi hoàn toàn theo hướng có lợi cho quân ta**:\n\n"
            "• **Về phía quân Mông Cổ (Từ chủ động sang bị động sa lầy)**: Tưởng chiếm được kinh thành là thắng lợi, nhưng giặc chỉ thấy một tòa thành trống rỗng không một bóng người, không một hạt thóc. Chiếm đóng hơn 9 ngày mà không cướp được lương ăn, quân giặc rơi vào cảnh đói khát cùng quẫn, khí hậu lạ làm phát sinh dịch bệnh, sĩ khí hoang mang sa sút nghiêm trọng.\n"
            "• **Về phía quân đội nhà Trần (Từ phòng ngự chuyển sang chuẩn bị phản công)**: Đại quân rút an toàn về vùng Thiên Mạc được bảo toàn nguyên vẹn binh lực, thiết lập phòng tuyến hiểm trở ven sông, tinh thần tướng sĩ ngày càng vững vàng.\n"
            "• **Hệ quả cục diện**: Sự suy kiệt nhanh chóng của giặc trong thành trống đã tạo ra thời cơ chiến lược chín muồi để vua Trần Thái Tông hạ lệnh mở cuộc đại phản công tại Đông Bộ Đầu (29/1/1258) quét sạch kẻ thù khỏi bờ cõi."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 69,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13",
            "fact_chunk": "Quân Mông Cổ vào thành trống lâm vào cảnh thiếu lương, suy yếu; quân Trần bảo toàn lực lượng ở Thiên Mạc chuẩn bị phản công."
        }
    },
    "FOLLOWUP_OVERCOME_DISADVANTAGE": {
        "unit_id": "FOLLOWUP_OVERCOME_DISADVANTAGE",
        "category": "FOLLOW_UP",
        "topic": "Nhà Trần làm gì để khắc phục bất lợi chênh lệch lực lượng trước quân Nguyên?",
        "entity": "Vua tôi nhà Trần",
        "event": "Ba lần kháng chiến chống Mông - Nguyên",
        "fact_chunk": "Trước kẻ thù đông và kỵ binh mạnh, nhà Trần khắc phục bất lợi bằng cách: tránh thế mạnh ban đầu qua rút lui chiến lược, dùng Vườn không nhà trống triệt hạ lương thực, tận dụng thế mạnh sông nước và chiến tranh nhân dân toàn dân đánh giặc.",
        "answer": (
            "Để khắc phục bất lợi lớn về quân số và sức mạnh kỵ binh hung hãn của đế chế Nguyên Mông, nhà Trần đã triển khai các đối sách quân sự vô cùng thông minh:\n\n"
            "1. **Tránh mũi nhọn ban đầu bằng chủ động rút lui chiến lược**: Không đem quân ít chọi quân nhiều trong thế đối đầu trực diện khi giặc đang hăng máu; rút lui để bảo toàn nguyên vẹn quân chủ lực.\n"
            "2. **Triệt tiêu hậu cần bằng kế 'Vườn không nhà trống'**: Làm kẻ thù tự suy yếu từ bên trong vì đói khát và dịch bệnh, biến sở trường đánh nhanh của giặc thành thế sa lầy kéo dài.\n"
            "3. **Tận dụng tối đa ưu thế sông nước**: Lấy sở trường thủy chiến của Đại Việt để khắc chế sở đoản kỵ binh giặc (như chặn đường tiếp tế ở Vân Đồn, giăng bãi cọc ngầm Bạch Đằng).\n"
            "4. **Phát động chiến tranh nhân dân toàn diện**: Dựa vào sức mạnh đoàn kết toàn dân ('cả nước góp sức'), kết hợp quân triều đình với dân binh các làng bản đánh tỉa, phục kích tiêu hao sinh lực địch khắp nơi."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 76,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13",
            "fact_chunk": "Nhà Trần khắc phục bất lợi bằng rút lui chiến lược, Vườn không nhà trống và chiến tranh nhân dân."
        }
    },
    "FOLLOWUP_RETREAT_TACTIC": {
        "unit_id": "FOLLOWUP_RETREAT_TACTIC",
        "category": "FOLLOW_UP",
        "topic": "Vai trò của chiến thuật chủ động rút lui trong kháng chiến",
        "entity": "Quân đội nhà Trần",
        "event": "Ba lần kháng chiến chống Mông - Nguyên",
        "fact_chunk": "Chiến thuật rút lui là bước lùi chiến lược sắc bén: không đồng nghĩa thất bại mà để bảo toàn lực lượng, làm giặc suy kiệt và chuẩn bị thế trận phản công quyết định.",
        "answer": (
            "Chiến thuật chủ động rút lui của nhà Trần chính là **chìa khóa cốt lõi** để hiện thực hóa việc khắc phục bất lợi trước thế giặc đông mạnh:\n\n"
            "• **Không phải là thất bại**: Rút lui không phải là đầu hàng hay thua trận, mà là 'bước lùi chiến lược' lấy thoái làm tiến.\n"
            "• **Bảo toàn thực lực tối đa**: Giữ gìn nguyên vẹn sinh lực chủ lực để kẻ thù không thể đánh đòn quyết định tiêu diệt quân ta.\n"
            "• **Biến thế mạnh của địch thành thế yếu**: Kéo dài thời gian, nhử địch vào sâu trong lãnh thổ không có lương ăn để chúng tự kiệt quệ, tạo thế và thời cơ vàng để ta mở cuộc phản công sấm sét (như Đông Bộ Đầu, Chương Dương, Bạch Đằng)."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 69,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13",
            "fact_chunk": "Rút lui chiến lược là để bảo toàn lực lượng và chuẩn bị phản công."
        }
    },
    "FOLLOWUP_COMPARE_CAMPAIGN_2_TO_1": {
        "unit_id": "FOLLOWUP_COMPARE_CAMPAIGN_2_TO_1",
        "category": "COMPARISON",
        "topic": "So sánh cuộc kháng chiến lần 2 (1285) với lần 1 (1258)",
        "entity": "Vua Trần Nhân Tông & Quân dân Đại Việt",
        "event": "Kháng chiến lần 2 (1285) & Lần 1 (1258)",
        "fact_chunk": "Kháng chiến lần 2 tương tự lần 1 ở kế sách rút lui bảo toàn lực lượng, Vườn không nhà trống và phản công; nhưng quy mô lớn hơn gấp bội (50 vạn quân, 2 gọng kìm, Hội nghị Diên Hồng, Bình Than).",
        "answer": (
            "Cuộc kháng chiến lần thứ hai (1285) có **những nét tương đồng về mặt tư tưởng chiến thuật** nhưng diễn ra ở **quy mô khốc liệt và hiểm nghèo hơn rất nhiều** so với lần thứ nhất (1258):\n\n"
            "• **Những điểm tương đồng cốt lõi**:\n"
            "  - Cả hai lần quân Trần đều chủ động rút lui chiến lược khỏi kinh thành Thăng Long để bảo toàn quân chủ lực.\n"
            "  - Cả hai lần đều triệt để thực hiện kế sách 'Vườn không nhà trống' làm giặc đói kiệt.\n"
            "  - Cả hai lần đều kiên nhẫn chờ giặc suy kiệt rồi mới mở đợt tổng phản công quyết định.\n"
            "• **Những điểm khác biệt và quy mô khốc liệt hơn ở lần hai (1285)**:\n"
            "  - **Quy mô quân giặc lớn gấp bội**: Giặc huy động tới 50 vạn quân (thay vì 3 vạn như lần 1), tạo thế gọng kìm hai mặt: Thoát Hoan đánh từ Bắc xuống, Toa Đô từ Chăm-pa đánh lên.\n"
            "  - **Huy động toàn dân sâu rộng hơn**: Tổ chức Hội nghị Bình Than (1282), Hội nghị Diên Hồng (1285), thêu cờ sáu chữ vàng (Trần Quốc Toản), soạn 'Hịch tướng sĩ' và khắc chữ 'Sát Thát'.\n"
            "  - **Phản công trên diện rộng**: Đại thắng liên tiếp tại Tây Kết, Hàm Tử, Chương Dương, chém đầu Toa Đô và buộc chủ tướng Thoát Hoan phải chui vào ống đồng tháo chạy."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 73,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ hai chống quân Nguyên (1285)",
            "fact_chunk": "Kháng chiến lần 2 có quy mô 50 vạn quân, đánh bại gọng kìm Thoát Hoan và Toa Đô."
        }
    },
    "FOLLOWUP_DECISIVE_BATTLE_CAMPAIGN_3": {
        "unit_id": "FOLLOWUP_DECISIVE_BATTLE_CAMPAIGN_3",
        "category": "FACT",
        "topic": "Trận đánh quyết định kết thúc cuộc kháng chiến lần thứ ba",
        "entity": "Trần Quốc Tuấn (Trần Hưng Đạo)",
        "event": "Đại thắng Bạch Đằng (Tháng 4/1288)",
        "fact_chunk": "Trận đánh quyết định kết thúc cuộc kháng chiến lần thứ ba (1287 - 1288) là đại thắng Bạch Đằng tháng 4 năm 1288 do Trần Hưng Đạo chỉ huy, tiêu diệt toàn bộ thủy quân giặc, bắt sống Ô Mã Nhi.",
        "answer": (
            "**Trận đánh quyết định kết thúc thắng lợi cuộc kháng chiến lần thứ ba (1287 – 1288) là đại thắng trên sông Bạch Đằng diễn ra vào tháng 4 năm 1288 do Hưng Đạo Đại vương Trần Quốc Tuấn trực tiếp chỉ huy.**\n\n"
            "Trong trận quyết chiến chiến lược này, quân ta đã nhử hạm đội thủy quân giặc vào trận địa bãi cọc ngầm bịt sắt khi thủy triều rút, tiêu diệt và bắt sống toàn bộ đạo thủy quân của Ô Mã Nhi và Phàn Tiếp, đập tan hoàn toàn ý chí xâm lược Đại Việt của nhà Nguyên."
        ),
        "grounding_source": {
            "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
            "page_number": 75,
            "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ ba chống quân Nguyên (1287 - 1288)",
            "fact_chunk": "Đại thắng Bạch Đằng (tháng 4/1288) là trận quyết định kết thúc cuộc kháng chiến lần 3."
        }
    },
    "INTENT_ASSISTANT_IDENTITY": {
        "unit_id": "INTENT_ASSISTANT_IDENTITY",
        "category": "CONVERSATIONAL_INTENT",
        "q_type": "INTENT",
        "topic": "Giới thiệu Trợ lý AI Lịch sử Đông A & hướng dẫn sử dụng",
        "entity": "Trợ lý AI Đông A",
        "event": "Giao tiếp sư phạm",
        "fact_chunk": "Trợ lý AI Lịch sử Đông A là hệ thống gia sư thông minh chuyên trách Bài 13 SGK Lịch sử 7 (Ba lần kháng chiến chống quân Mông - Nguyên 1258 - 1288), tích hợp mô hình BKT cá nhân hóa.",
        "answer": (
            "Xin chào em! Thầy là **Trợ Lý AI Lịch Sử Đông A** — gia sư lịch sử thông minh đồng hành cùng em trong chuyên đề **Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)** (Lịch sử lớp 7).\n\n"
            "🌟 **Thầy có thể giúp em những việc sau**:\n"
            "1. **Giải đáp & Đối chiếu lịch sử chuyên sâu**: Hỏi đáp mọi sự kiện, nhân vật, chiến thuật hoặc so sánh 2 sự kiện bất kỳ trong thời Trần.\n"
            "2. **Hiểu cả mô tả gián tiếp**: Dù em quên tên nhân vật hay kế sách (ví dụ: *\"Ông vua nào đi tu trên núi Yên Tử?\"*), thầy vẫn nhận diện và giải thích chính xác.\n"
            "3. **Đố vui & Chấm tự luận trực tiếp trên khung Chat**: Em chỉ cần gõ **\"Thầy đố em một câu đi\"**, thầy sẽ chọn ngay chủ đề em đang yếu trong Hồ sơ năng lực để thử thách và chấm điểm thang 10!\n"
            "4. **Tư vấn lộ trình & Tài liệu SGK cá nhân hóa**: Gõ **\"Em không biết nên hỏi gì\"** để xem gợi ý bài học sát với mức độ nắm vững BKT của riêng em."
        ),
        "grounding_source": {}
    }
}


class ConversationalContextManager:
    """
    Quản lý phiên hội thoại đa lượt và giải quyết ngữ cảnh câu hỏi tiếp nối.
    """
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def get_or_create_session(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "turn_count": 0,
                "last_unit_id": None,
                "last_topic": None,
                "last_event": None,
                "last_entity": None,
                "last_individual_entity": None,
                "last_time_period": None,  # "1258", "1285", "1288"
                "last_tran_king": None,   # Vua Trần tương ứng giai đoạn
                "last_battle": None,      # Trận đánh gần nhất
                "history": []
            }
        return self.sessions[session_id]

    def reset_session(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]

    @classmethod
    def detect_knowledge_graph_contradiction(cls, unacc_q: str) -> Optional[Dict[str, Any]]:
        """
        Kiểm chứng Đồ thị Tri thức Lịch sử Thời Trần (Knowledge Graph Fact-Checker):
        Tự động phát hiện các câu hỏi ghép lệch giữa (Nhân vật, Sự kiện/Trận đánh, Năm, Lần kháng chiến)
        và trả về phản hồi đính chính chuẩn xác ngay ở câu mở đầu.
        """
        padded = f" {unacc_q} "
        if any(c in padded for c in [" so sanh ", " khac nhau ", " phan biet ", " va ", " voi ", " cung nhu "]):
            return None

        # 1. Trận Bạch Đằng (1288 - Lần 3) bị nhầm sang năm 1258 / 1285 / Lần 1 / Lần 2
        if "bach dang" in unacc_q and any(w in unacc_q for w in ["1258", "1285", "lan 1", "lan thu nhat", "lan 2", "lan thu hai"]):
            return {
                "unit_id": "CORRECTION_KG_CONTRADICTION",
                "category": "CORRECTION",
                "topic": "Đính chính thời gian đại thắng Bạch Đằng (Tháng 4/1288 - Kháng chiến lần 3)",
                "entity": "Trần Hưng Đạo",
                "event": "Đại thắng Bạch Đằng (Tháng 4/1288)",
                "fact_chunk": "Đại thắng trên sông Bạch Đằng thời Trần diễn ra vào tháng 4 năm 1288 (thuộc cuộc kháng chiến lần thứ ba 1287 - 1288) do Trần Hưng Đạo chỉ huy, không phải năm 1258 hay 1285.",
                "answer": (
                    "⚠️ **Đính chính mốc thời gian lịch sử**: Đại thắng trên sông Bạch Đằng thời Trần diễn ra vào **tháng 4 năm 1288 (thuộc cuộc kháng chiến lần thứ ba 1287 – 1288)**, chứ **không phải** vào năm 1258 hay 1285!\n\n"
                    "• **Kháng chiến lần 1 (1258)**: Trận quyết định là **Đông Bộ Đầu** (29/1/1258).\n"
                    "• **Kháng chiến lần 2 (1285)**: Các trận đại thắng tiêu biểu là **Tây Kết, Hàm Tử, Chương Dương**.\n"
                    "• **Kháng chiến lần 3 (1287 – 1288)**: Kết thúc bằng đại thắng trận địa cọc ngầm trên **sông Bạch Đằng (tháng 4/1288)** do Quốc công Tiết chế Trần Hưng Đạo chỉ huy, bắt sống Ô Mã Nhi và tiêu diệt toàn bộ thủy quân giặc."
                ),
                "grounding_source": {
                    "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
                    "page_number": 75,
                    "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ ba chống quân Nguyên (1287 - 1288)",
                    "fact_chunk": "Đại thắng Bạch Đằng diễn ra vào tháng 4/1288, kết thúc cuộc kháng chiến lần thứ ba."
                }
            }

        # 2. Hội nghị Diên Hồng (Đầu năm 1285 - Lần 2) bị nhầm sang 1258 / 1288 / Lần 1 / Lần 3
        if "dien hong" in unacc_q and any(w in unacc_q for w in ["1258", "1288", "lan 1", "lan thu nhat", "lan 3", "lan thu ba"]):
            return {
                "unit_id": "CORRECTION_KG_CONTRADICTION",
                "category": "CORRECTION",
                "topic": "Đính chính thời gian Hội nghị Diên Hồng (Đầu năm 1285 - Kháng chiến lần 2)",
                "entity": "Thượng hoàng Trần Thánh Tông & Các bô lão",
                "event": "Hội nghị Diên Hồng (1285)",
                "fact_chunk": "Hội nghị Diên Hồng được tổ chức vào đầu năm 1285 tại kinh thành Thăng Long trong cuộc kháng chiến lần thứ hai chống quân Nguyên, không phải năm 1258 hay 1288.",
                "answer": (
                    "⚠️ **Đính chính mốc thời gian lịch sử**: **Hội nghị Diên Hồng** được Thượng hoàng Trần Thánh Tông triệu tập vào **đầu năm 1285 (thuộc cuộc kháng chiến lần thứ hai)** tại kinh thành Thăng Long, chứ **không phải** năm 1258 hay 1288!\n\n"
                    "• Tại hội nghị lịch sử này, khi vua hỏi nên *'Hòa hay Đánh'* trước thế giặc Nguyên 50 vạn quân hung hãn, các vị bô lão đại diện nhân dân cả nước đã đồng thanh hô vang **'Đánh!'** ('muôn người cùng một lời'), thể hiện ý chí đoàn kết toàn dân tộc."
                ),
                "grounding_source": {
                    "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
                    "page_number": 71,
                    "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ hai chống quân Nguyên (1285)",
                    "fact_chunk": "Đầu năm 1285, Thượng hoàng Trần Thánh Tông triệu tập Hội nghị Diên Hồng."
                }
            }

        # 3. Trận Đông Bộ Đầu / Bình Lệ Nguyên (1258 - Lần 1) bị nhầm sang 1285 / 1288 / Lần 2 / Lần 3
        if any(b in unacc_q for b in ["dong bo dau", "binh le nguyen"]) and any(w in unacc_q for w in ["1285", "1288", "lan 2", "lan thu hai", "lan 3", "lan thu ba"]):
            return {
                "unit_id": "CORRECTION_KG_CONTRADICTION",
                "category": "CORRECTION",
                "topic": "Đính chính thời gian trận Bình Lệ Nguyên & Đông Bộ Đầu (Năm 1258 - Kháng chiến lần 1)",
                "entity": "Vua Trần Thái Tông & Trần Thủ Độ",
                "event": "Kháng chiến chống Mông Cổ lần thứ nhất (1258)",
                "fact_chunk": "Trận Bình Lệ Nguyên (17/1/1258) và trận phản công Đông Bộ Đầu (29/1/1258) diễn ra trong cuộc kháng chiến lần thứ nhất năm 1258 chống quân Mông Cổ.",
                "answer": (
                    "⚠️ **Đính chính mốc thời gian lịch sử**: Trận **Bình Lệ Nguyên** và trận phản công **Đông Bộ Đầu** diễn ra vào **tháng 1 năm 1258 (thuộc cuộc kháng chiến lần thứ nhất chống quân Mông Cổ)**, chứ **không phải** năm 1285 hay 1288!\n\n"
                    "• **Ngày 17/1/1258**: Vua Trần Thái Tông trực tiếp chỉ huy chặn giặc tại Bình Lệ Nguyên rồi rút lui chiến lược, thực hiện 'Vườn không nhà trống' tại Thăng Long.\n"
                    "• **Ngày 29/1/1258**: Quân Trần mở cuộc đại phản công tại bến **Đông Bộ Đầu**, quét sạch quân Mông Cổ của Ngột Lương Hợp Thai khỏi kinh thành Thăng Long."
                ),
                "grounding_source": {
                    "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
                    "page_number": 69,
                    "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ nhất chống quân Mông Cổ (1258)",
                    "fact_chunk": "Tháng 1/1258 diễn ra trận Bình Lệ Nguyên và chiến thắng Đông Bộ Đầu."
                }
            }

        # 4. Hịch tướng sĩ (Trần Quốc Tuấn) bị gán nhầm cho nhân vật khác
        if "hich tuong si" in unacc_q and any(p in unacc_q for p in ["tran thu do", "tran quoc toan", "tran binh trong", "tran quang khai", "pham ngu lao"]):
            return {
                "unit_id": "CORRECTION_KG_CONTRADICTION",
                "category": "CORRECTION",
                "topic": "Đính chính tác giả bài Hịch tướng sĩ (Trần Quốc Tuấn)",
                "entity": "Hưng Đạo Đại vương Trần Quốc Tuấn",
                "event": "Soạn Hịch tướng sĩ (Trước cuộc kháng chiến lần 2 - 1285)",
                "fact_chunk": "Bài 'Hịch tướng sĩ' (Dụ chư tỳ tướng hịch văn) do Quốc công Tiết chế Hưng Đạo Đại vương Trần Quốc Tuấn biên soạn để khích lệ tướng sĩ trước cuộc kháng chiến lần thứ hai (1285).",
                "answer": (
                    "⚠️ **Đính chính tác giả lịch sử**: Kiệt tác thiên cổ hùng văn **'Hịch tướng sĩ'** là do **Quốc công Tiết chế Hưng Đạo Đại vương Trần Quốc Tuấn (Trần Hưng Đạo)** soạn thảo trước cuộc kháng chiến lần thứ hai (1285), chứ **không phải** của nhân vật khác!\n\n"
                    "• Với lời văn thống thiết *'Ta thường tới bữa quên ăn, nửa đêm vỗ gối...'*, bài hịch đã khơi dậy lòng căm thù giặc sâu sắc, thúc đẩy tướng sĩ nhà Trần thích hai chữ **'Sát Thát'** (Giết giặc Mông – Nguyên) lên cánh tay quyết tử giữ nước."
                ),
                "grounding_source": {
                    "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
                    "page_number": 71,
                    "curriculum_match": "SGK Lịch sử 7 - Bài 13: Cuộc kháng chiến lần thứ hai chống quân Nguyên (1285)",
                    "fact_chunk": "Trần Quốc Tuấn soạn Hịch tướng sĩ để khích lệ tinh thần chiến đấu của quân đội."
                }
            }

        # 5. Nhầm chủ tướng giặc giữa lần 1 (Ngột Lương Hợp Thai - 1258) và lần 2, 3 (Thoát Hoan - 1285, 1288)
        if ("thoat hoan" in unacc_q and any(w in unacc_q for w in ["1258", "lan 1", "lan thu nhat"])) or (
            "ngot luong hop thai" in unacc_q and any(w in unacc_q for w in ["1285", "1288", "lan 2", "lan thu hai", "lan 3", "lan thu ba"])
        ):
            return {
                "unit_id": "CORRECTION_KG_CONTRADICTION",
                "category": "CORRECTION",
                "topic": "Đính chính tướng chỉ huy quân xâm lược qua 3 lần kháng chiến",
                "entity": "Ngột Lương Hợp Thai (1258) & Thoát Hoan (1285, 1288)",
                "event": "Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)",
                "fact_chunk": "Năm 1258 (Lần 1), quân Mông Cổ do Ngột Lương Hợp Thai chỉ huy. Năm 1285 (Lần 2) và 1287-1288 (Lần 3), quân Nguyên do Trấn Nam vương Thoát Hoan chỉ huy.",
                "answer": (
                    "⚠️ **Đính chính nhân vật lịch sử**: Em đang có chút nhầm lẫn về tướng chỉ huy quân xâm lược giữa các lần kháng chiến nhé! Chính sử ghi rõ:\n\n"
                    "• **Kháng chiến lần 1 (1258)**: Đạo quân Mông Cổ (3 vạn quân) do tướng **Ngột Lương Hợp Thai** chỉ huy.\n"
                    "• **Kháng chiến lần 2 (1285) và lần 3 (1287 – 1288)**: Đại quân Nguyên (50 vạn quân năm 1285; 30 vạn quân năm 1287) do Trấn Nam vương **Thoát Hoan** (con trai Hốt Tất Liệt) làm chủ tướng chỉ huy."
                ),
                "grounding_source": {
                    "doc_name": "SGK Lịch sử 7 (KNTT) - Bài 13",
                    "page_number": 68,
                    "curriculum_match": "SGK Lịch sử 7 - Bài 13: Ba lần kháng chiến chống quân Mông - Nguyên",
                    "fact_chunk": "Lần 1 (1258) do Ngột Lương Hợp Thai chỉ huy; Lần 2 (1285) và Lần 3 (1288) do Thoát Hoan chỉ huy."
                }
            }

        return None

    def resolve_query(
        self,
        query: str,
        session_id: str = "default"
    ) -> Tuple[str, bool, Optional[Dict[str, Any]]]:
        """
        Phân tích và viết lại câu hỏi dựa trên lịch sử hội thoại.
        Trả về:
        - rewritten_query: Câu hỏi đã được làm rõ hoặc điền đủ ngữ cảnh.
        - is_rewritten: Cờ đánh dấu có thay đổi câu hỏi hay không.
        - override_result: Kết quả phản hồi trực tiếp nếu rơi vào trường hợp đặc biệt
          (làm rõ đại từ vua khi chưa có ngữ cảnh, đính chính tiền đề sai, thông tin ngoài SGK).
        """
        clean_q = query.strip()
        unacc_q = normalize_vi(remove_accents(clean_q))
        for wrong_tp, right_tp in [
            ("bat dang", "bach dang"), ("bach dan", "bach dang"), ("bach dangg", "bach dang"),
            ("rien hong", "dien hong"), ("gien hong", "dien hong"), ("dien hom", "dien hong"),
            ("binh thang", "binh than"), ("thoat hoang", "thoat hoan"), ("nha chong", "nha trong"),
            ("tran khanh giu", "tran khanh du"), ("tran binh chong", "tran binh trong")
        ]:
            if wrong_tp in unacc_q:
                unacc_q = unacc_q.replace(wrong_tp, right_tp)
        session = self.get_or_create_session(session_id)

        # ----------------------------------------------------------------------
        # 1. KIỂM TRA CÂU HỎI CHỨA TIỀN ĐỀ SAI (FALSE PREMISE CORRECTION)
        # ----------------------------------------------------------------------
        # Sai 1: Trần Hưng Đạo bóp cam
        has_thd = any(k in unacc_q for k in ["tran hung dao", "tran quoc tuan", "hung dao"])
        has_orange = any(k in unacc_q for k in ["qua cam", "bop cam", "bop nat qua cam", "sau chu vang", "6 chu vang"])
        if has_thd and has_orange:
            return query, False, SPECIAL_GROUNDED_RESPONSES["CORRECTION_FALSE_PREMISE_ORANGE"]

        # Sai 2: Trần Quốc Toản chỉ huy Bạch Đằng 1288
        has_tqt = any(k in unacc_q for k in ["tran quoc toan", "hoai van hau", "tqt"])
        has_bach_dang = any(k in unacc_q for k in ["bach dang", "song bach dang", "tran bach dang", "coc go", "o ma nhi"])
        if has_tqt and has_bach_dang:
            return query, False, SPECIAL_GROUNDED_RESPONSES["CORRECTION_FALSE_PREMISE_BACH_DANG"]

        # Sai 3+: Bộ kiểm chứng Đồ thị Tri thức tự động (Nhầm chéo Năm - Sự kiện - Tướng chỉ huy - Tác phẩm)
        kg_contradiction = self.detect_knowledge_graph_contradiction(unacc_q)
        if kg_contradiction:
            return query, False, kg_contradiction

        # ----------------------------------------------------------------------
        # 2. KIỂM TRA THÔNG TIN CHI TIẾT ĐỜI TƯ NGOÀI SGK (ABSENT FACT)
        # ----------------------------------------------------------------------
        absent_keywords = [
            "vo cua thoat hoan", "vo thoat hoan", "con gai thoat hoan", "vo o ma nhi",
            "sinh ngay may thang may", "sinh ngay nao", "ngay sinh cua thoat hoan",
            "quan mong co an gi khi hanh quan", "thuc don cua quan mong co", "thoi tiet ngay danh tran"
        ]
        if any(ak in unacc_q for ak in absent_keywords):
            return query, False, SPECIAL_GROUNDED_RESPONSES["ABSENT_HISTORICAL_FACT"]

        # ----------------------------------------------------------------------
        # 2B. KIỂM TRA CÁC CÂU HỎI XÁC MINH, BẰNG CHỨNG, GIẢ ĐỊNH & THỰC TẾ LỊCH SỬ
        # ----------------------------------------------------------------------
        # 1. Xác minh đại bác trong trận Bạch Đằng 1288
        has_cannon = any(k in unacc_q for k in ["dai bac", "sung than cong", "sung than co", "hoa phao"])
        if has_cannon and any(k in unacc_q for k in ["bach dang", "1288", "nha tran", "the ky 13", "the ky xiii"]):
            return query, False, SPECIAL_GROUNDED_RESPONSES["VERIFY_CANNON_BACH_DANG"]

        # 2. Bằng chứng số lượng binh sĩ nhà Trần ở Bình Lệ Nguyên
        has_troop_count = any(k in unacc_q for k in [
            "chinh xac bao nhieu", "bao nhieu binh si", "bao nhieu quan", "so luong quan", "bao nhieu linh", "quan so"
        ])
        if has_troop_count and "binh le nguyen" in unacc_q:
            return query, False, SPECIAL_GROUNDED_RESPONSES["EVIDENCE_BINH_LE_NGUYEN_TROOP_COUNT"]

        # 3. Câu nói nguyên văn của Trần Hưng Đạo tại Bạch Đằng 1288
        has_quote_term = any(k in unacc_q for k in ["cau noi nguyen van", "nguyen van", "trich dan"]) or ("cau noi" in unacc_q and "bach dang" in unacc_q)
        has_thd_term = any(k in unacc_q for k in ["tran hung dao", "tran quoc tuan", "hung dao"])
        if has_quote_term and has_thd_term and ("bach dang" in unacc_q or "1288" in unacc_q):
            return query, False, SPECIAL_GROUNDED_RESPONSES["EVIDENCE_TRAN_HUNG_DAO_QUOTE_BACH_DANG"]

        # 4. Xác minh thuốc nổ năm 1285
        has_gunpowder = any(k in unacc_q for k in ["thuoc no", "hoa duoc", "bom min", "thuoc sung"])
        if has_gunpowder and any(k in unacc_q for k in ["1285", "lan thu hai", "lan 2", "nha tran"]):
            return query, False, SPECIAL_GROUNDED_RESPONSES["EVIDENCE_GUNPOWDER_1285"]

        # 5. Phản biện giả định: Nếu cố giữ Thăng Long bằng mọi giá
        has_hold_tl = any(k in unacc_q for k in ["co giu thang long", "co thu thang long", "giu thang long bang moi gia", "khong rut khoi thang long", "tu thu thang long"]) or ("neu" in unacc_q and "giu thang long" in unacc_q)
        if has_hold_tl and any(k in unacc_q for k in ["bat loi", "nguy co", "hau qua", "thi sao", "the nao", "ra sao"]):
            return query, False, SPECIAL_GROUNDED_RESPONSES["COUNTERFACTUAL_HOLD_THANG_LONG"]

        # 6. Xác minh: Thắng chỉ vì địch thiếu lương thực?
        has_only_food = ("thang chi vi" in unacc_q or "thang chi do" in unacc_q or "thang nho" in unacc_q or ("chi vi" in unacc_q or "chi do" in unacc_q)) and ("thieu luong" in unacc_q or "luong thuc" in unacc_q or "het luong" in unacc_q)
        if has_only_food:
            return query, False, SPECIAL_GROUNDED_RESPONSES["VERIFY_ONLY_FOOD_SHORTAGE"]

        # 6B. Câu hỏi nhiều ý (3 ý): Ai chỉ huy Bạch Đằng 1288, trận đánh diễn ra năm nào, và chiến thắng kết thúc cuộc kháng chiến lần thứ mấy?
        is_multi_bd = ("bach dang" in unacc_q and 
                       any(k in unacc_q for k in ["ai chi huy", "ai la nguoi chi huy"]) and 
                       any(k in unacc_q for k in ["nam nao", "dien ra nam nao"]) and 
                       any(k in unacc_q for k in ["lan thu may", "lan may", "ket thuc", "thu may"]))
        if is_multi_bd:
            session["last_battle"] = "Trận Bạch Đằng năm 1288"
            session["last_time_period"] = "1288"
            session["last_entity"] = "Trần Hưng Đạo"
            return query, False, SPECIAL_GROUNDED_RESPONSES["MULTI_PART_BACH_DANG_1288"]

        # 6C. Câu hỏi ngắn gọn: "Bạch Đằng 1288?" / "bạch đằng 1288"
        cleaned_no_punct = "".join(c for c in unacc_q if c.isalnum() or c.isspace()).strip()
        is_short_bach_dang = cleaned_no_punct in [
            "bach dang 1288", "bach dang nam 1288", "bach dang", "tran bach dang 1288", "tran bach dang"
        ]
        if is_short_bach_dang:
            session["last_battle"] = "Trận Bạch Đằng năm 1288"
            session["last_time_period"] = "1288"
            session["last_entity"] = "Trần Hưng Đạo"
            return query, False, SPECIAL_GROUNDED_RESPONSES["SUMMARY_BACH_DANG_1288_SHORT"]

        # 6D. So sánh cách đối phó năm 1258 và năm 1285 (Giống & Khác)
        is_compare_1258_1285 = (
            any(k in unacc_q for k in ["so sanh", "doi pho", "giong va khac", "diem giong", "diem khac"]) and
            ("1258" in unacc_q or "lan 1" in unacc_q or "lan thu nhat" in unacc_q) and
            ("1285" in unacc_q or "lan 2" in unacc_q or "lan thu hai" in unacc_q)
        )
        if is_compare_1258_1285:
            return query, False, SPECIAL_GROUNDED_RESPONSES["COMPARE_1258_AND_1285"]

        # 6E. Bất lợi của kế sách Vườn không nhà trống gây ra cho quân xâm lược
        is_vknt_impact = ("vuon khong" in unacc_q and any(k in unacc_q for k in [
            "bat loi", "gay bat loi", "kho khan gi cho quan", "kho khan gi", "tac dong", "he qua", "anh huong", "tac dung the nao", "tac dong the nao"
        ]))
        if is_vknt_impact:
            session["last_topic"] = "Kế sách Vườn không nhà trống"
            return query, False, SPECIAL_GROUNDED_RESPONSES["TACTICAL_IMPACT_VUON_KHONG_NHA_TRONG"]

        # 7. Bạch Đằng 1288 kết thúc cuộc kháng chiến lần thứ mấy?
        is_bach_dang_war = ("bach dang" in unacc_q and any(k in unacc_q for k in ["lan thu may", "lan may", "ket thuc", "khang chien lan thu may", "lan thu bao nhieu"]))
        if is_bach_dang_war:
            session["last_battle"] = "Trận Bạch Đằng năm 1288"
            session["last_time_period"] = "1288"
            session["last_entity"] = "Trần Hưng Đạo"
            session["last_event"] = "Kháng chiến chống quân Nguyên lần 3 (1287 - 1288)"
            return query, False, SPECIAL_GROUNDED_RESPONSES["FACT_BACH_DANG_WHICH_WAR"]

        # 8. Ai chỉ huy Bạch Đằng 1288, năm nào?
        is_bd_cmd_yr = ("bach dang" in unacc_q and any(k in unacc_q for k in ["ai chi huy", "ai la nguoi chi huy"]) and any(k in unacc_q for k in ["nam nao", "1288"]) and "lan thu may" not in unacc_q and "thu may" not in unacc_q and "dien bien" not in unacc_q)
        if is_bd_cmd_yr and "nam nao" in unacc_q:
            session["last_battle"] = "Trận Bạch Đằng năm 1288"
            session["last_time_period"] = "1288"
            session["last_entity"] = "Trần Hưng Đạo"
            return query, False, SPECIAL_GROUNDED_RESPONSES["FACT_BACH_DANG_COMMANDER_YEAR"]

        # 9. Ý nghĩa trận Đông Bộ Đầu
        is_dbd_meaning = ("dong bo dau" in unacc_q and any(k in unacc_q for k in ["y nghia", "vai tro", "tam quan trong"]))
        if is_dbd_meaning:
            session["last_battle"] = "Trận Đông Bộ Đầu năm 1258"
            session["last_time_period"] = "1258"
            return query, False, SPECIAL_GROUNDED_RESPONSES["SIGNIFICANCE_DONG_BO_DAU"]

        # 10. Vai trò / Ý nghĩa Hội nghị Diên Hồng
        is_dh_role = ("dien hong" in unacc_q and any(k in unacc_q for k in ["vai tro", "y nghia", "tac dung", "tam quan trong"]))
        if is_dh_role and "nam nao" not in unacc_q:
            session["last_event"] = "Hội nghị Diên Hồng (1285)"
            session["last_time_period"] = "1285"
            return query, False, SPECIAL_GROUNDED_RESPONSES["SIGNIFICANCE_DIEN_HONG"]

        # 11. Điểm chung qua ba lần kháng chiến
        is_common_3_wars = (any(k in unacc_q for k in ["diem chung", "giong nhau", "tuong dong", "diem giong"]) and any(k in unacc_q for k in ["ba lan", "3 lan", "ca ba lan"]))
        if is_common_3_wars:
            return query, False, SPECIAL_GROUNDED_RESPONSES["COMPARISON_ALL_3_WARS_COMMON"]

        # 13. Cục diện thay đổi thế nào sau khi rút khỏi Thăng Long
        is_after_withdraw_situation = ("rut khoi thang long" in unacc_q and any(k in unacc_q for k in ["cuc dien", "thay doi the nao", "tinh the", "tinh hinh thay doi"]))
        if is_after_withdraw_situation:
            return query, False, SPECIAL_GROUNDED_RESPONSES["EVENT_AFTER_WITHDRAWAL_SITUATION"]

        # 14. Tiếp nối hội thoại: Khắc phục bất lợi chênh lệch sức mạnh (Turn 2)
        if any(k in unacc_q for k in ["khac phuc bat loi do", "khac phuc bat loi", "khac phuc kho khan do", "lam gi de khac phuc"]):
            return query, False, SPECIAL_GROUNDED_RESPONSES["FOLLOWUP_OVERCOME_DISADVANTAGE"]

        # 15. Tiếp nối hội thoại: Còn chiến thuật rút lui thì sao? (Turn 3)
        if any(k in unacc_q for k in ["con chien thuat rut lui thi sao", "the con chien thuat rut lui", "con chien thuat rut lui"]):
            return query, False, SPECIAL_GROUNDED_RESPONSES["FOLLOWUP_RETREAT_TACTIC"]

        # 16. Tiếp nối hội thoại: Lần thứ hai có diễn biến tương tự không? (Turn 4)
        if any(k in unacc_q for k in ["lan thu hai", "lan 2"]) and any(k in unacc_q for k in ["tuong tu khong", "giong khong", "dien bien tuong tu", "tuong tu nhu vay khong"]):
            session["last_time_period"] = "1285"
            session["last_tran_king"] = "Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông"
            return query, False, SPECIAL_GROUNDED_RESPONSES["FOLLOWUP_COMPARE_CAMPAIGN_2_TO_1"]

        # 17. Tiếp nối hội thoại: Trận đánh quyết định ở lần thứ ba là trận nào? (Turn 5)
        if any(k in unacc_q for k in ["tran quyet dinh", "tran danh quyet dinh", "tran quyet chien"]) and any(k in unacc_q for k in ["lan thu ba", "lan 3", "lan thu 3"]):
            session["last_time_period"] = "1288"
            session["last_battle"] = "Trận Bạch Đằng năm 1288"
            return query, False, SPECIAL_GROUNDED_RESPONSES["FOLLOWUP_DECISIVE_BATTLE_CAMPAIGN_3"]

        # ----------------------------------------------------------------------
        # 3. KIỂM TRA CHUYỂN DÒNG THỜI GIAN (TIMELINE SHIFT: "Còn năm 1285 thì sao?")
        # ----------------------------------------------------------------------
        if any(ts in unacc_q for ts in ["con nam 1285", "the con nam 1285", "nam 1285 thi sao", "nam 1285 the nao", "o nam 1285 thi sao"]):
            session["last_time_period"] = "1285"
            session["last_tran_king"] = "Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông"
            session["last_entity"] = "Vua Trần Nhân Tông & Trần Hưng Đạo"
            session["last_event"] = "Kháng chiến chống quân Nguyên lần 2 (1285)"
            session["last_battle"] = None
            rewritten = "Cuộc kháng chiến chống quân Nguyên lần thứ hai năm 1285 diễn ra như thế nào?"
            return rewritten, True, None

        if any(ts in unacc_q for ts in ["con nam 1288", "the con nam 1288", "nam 1288 thi sao", "nam 1288 the nao", "o nam 1288 thi sao"]):
            session["last_time_period"] = "1288"
            session["last_tran_king"] = "Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông"
            session["last_entity"] = "Trần Hưng Đạo"
            session["last_event"] = "Kháng chiến chống quân Nguyên lần 3 (1287 - 1288)"
            session["last_battle"] = "Bạch Đằng"
            rewritten = "Cuộc kháng chiến chống quân Nguyên lần thứ ba năm 1288 diễn ra như thế nào?"
            return rewritten, True, None

        if any(ts in unacc_q for ts in ["con nam 1258", "the con nam 1258", "nam 1258 thi sao", "nam 1258 the nao"]):
            session["last_time_period"] = "1258"
            session["last_tran_king"] = "Vua Trần Thái Tông"
            session["last_entity"] = "Vua Trần Thái Tông & Trần Thủ Độ"
            session["last_event"] = "Kháng chiến chống Mông Cổ lần 1 (1258)"
            session["last_battle"] = "Đông Bộ Đầu"
            rewritten = "Cuộc kháng chiến chống quân Mông Cổ lần thứ nhất năm 1258 diễn ra như thế nào?"
            return rewritten, True, None

        # ----------------------------------------------------------------------
        # 4. KIỂM TRA CÂU HỎI MƠ HỒ VỀ VUA TRẦN KHI CHƯA CÓ NGỮ CẢNH (TURN 1)
        # ----------------------------------------------------------------------
        has_king_kw = any(k in unacc_q for k in ["vua tran", "nha vua", "vi vua", "vua"])
        has_action_kw = any(a in unacc_q for a in [
            "xu ly", "lam gi", "phan ung", "hanh dong", "ra sao", "the nao", "la ai", "co nhung ai", "gom nhung ai"
        ])
        has_specific_king_clue = any(k in unacc_q for k in [
            "thai tong", "thanh tong", "nhan tong", "tran kham", "tran canh", "phat hoang",
            "truc lam", "di tu", "xuat gia", "yen tu", "nhuong ngoi", "vua nao",
            "ong vua nao", "vi vua nao", "thach ma", "ham nghi", "quang trung", "le loi", "ngo quyen"
        ])
        is_king_action_query = has_king_kw and has_action_kw and not has_specific_king_clue
        has_active_context = bool(session.get("last_unit_id"))

        if is_king_action_query and not has_active_context:
            return query, False, SPECIAL_GROUNDED_RESPONSES["CLARIFY_AMBIGUOUS_TRAN_KING"]

        # ----------------------------------------------------------------------
        # 5. GIẢI QUYẾT CÁC MẪU CÂU HỎI NỐI TIẾP KHI ĐÃ CÓ NGỮ CẢNH (FOLLOW-UPS)
        # ----------------------------------------------------------------------
        # Nhận diện nếu câu hỏi có thực thể riêng biệt mới -> NGĂN CHẶN Ô NHIỄM NGỮ CẢNH
        explicit_standalones = [
            "bach dang", "van don", "ham tu", "chuong duong", "tay ket", "dien hong",
            "binh than", "dong bo dau", "binh le nguyen", "thoat hoan", "toa do",
            "o ma nhi", "tran quoc toan", "tran binh trong", "tran hung dao", "tran thu do",
            "pham ngu lao", "dan sot", "tran quang khai", "tran nhan tong", "yen tu", "di tu",
            "vuon khong", "bo thanh trong", "tran khanh du", "binh thu yeu luoc", "ngu binh"
        ]
        has_explicit_standalone = any(es in unacc_q for es in explicit_standalones)

        # Mẫu 1: "Vua Trần đã xử lý thế nào?" / "Nhà vua xử lý ra sao?" / "Vua đã làm gì?"
        if is_king_action_query and has_active_context:
            time_p = session.get("last_time_period", "1258")
            king = session.get("last_tran_king")
            if not king:
                king = "Vua Trần Thái Tông" if time_p == "1258" else "Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông"
            event = session.get("last_event") or f"kháng chiến chống quân Mông Cổ năm {time_p}"
            rewritten = f"{king} đã xử lý thế nào khi {event}?"
            return rewritten, True, None

        # Mẫu 2B: Phản hồi câu hỏi gợi mở (follow_up) của AI ("Có ạ", "Kể tiếp đi", "Em không nhớ", "Là chữ gì vậy thầy?")
        FOLLOWUP_CONTINUATION_MAP = {
            "TQT_WHY_ORANGE": "Trần Quốc Toản đã thêu sáu chữ vàng gì lên lá cờ của mình và lập chiến công ra sao?",
            "TQT_SIX_GOLDEN_WORDS": "Tổng quan về tấm gương yêu nước của thiếu niên anh hùng Trần Quốc Toản?",
            "BINH_THAN_CONFERENCE": "Vì sao Trần Quốc Toản lại bóp nát quả cam tại bến Bình Than năm 1282?",
            "DIEN_HONG_CONFERENCE": "Hoàn cảnh ra đời và ý nghĩa của Hịch tướng sĩ và tinh thần Sát Thát năm 1285?",
            "HICH_TUONG_SI": "Các trận tổng phản công Tây Kết, Hàm Tử, Chương Dương năm 1285 diễn ra như thế nào?",
            "KC1_WHY_INVADE": "Diễn biến trận mở màn Bình Lệ Nguyên năm 1258 diễn ra như thế nào?",
            "KC1_BINH_LE_NGUYEN": "Sau trận Bình Lệ Nguyên nhà Trần thực hiện kế sách vườn không nhà trống như thế nào năm 1258?",
            "KC1_VUON_KHONG_NHA_TRONG": "Sau khi rút khỏi Thăng Long thực hiện vườn không nhà trống quân Trần làm gì tiếp theo để phản công tại Đông Bộ Đầu năm 1258?",
            "KC1_DONG_BO_DAU": "Câu nói Đầu thần chưa rơi xuống đất xin bệ hạ đừng lo của Trần Thủ Độ có ý nghĩa gì?",
            "KC2_OVERVIEW": "Các trận phản công Tây Kết, Hàm Tử, Chương Dương năm 1285 diễn ra như thế nào?",
            "KC2_HAM_TU_CHUONG_DUONG": "Vì sao Thoát Hoan phải chui vào ống đồng tháo chạy năm 1285?",
            "KC3_OVERVIEW": "Chiến thắng Vân Đồn tiêu diệt đoàn thuyền lương của Trần Khánh Dư năm 1288 diễn ra thế nào?",
            "KC3_VAN_DON": "Trận quyết chiến trên sông Bạch Đằng tháng 4 năm 1288 diễn ra như thế nào?",
            "KC3_BACH_DANG_HOW": "Nguyên nhân thắng lợi và ý nghĩa lịch sử của ba lần kháng chiến chống quân Mông Nguyên là gì?",
            "GAME_NGU_BINH_U_NONG": "Tại sao nhà Trần dùng kế sách vườn không nhà trống khiến quân giặc đói lương?",
            "GAME_TRAN_KHANH_DU": "Chiến thắng Vân Đồn tiêu diệt đoàn thuyền lương Trương Văn Hổ năm 1288 diễn ra như thế nào?",
            "GAME_BINH_THU_YEU_LUOC": "Hoàn cảnh ra đời và ý nghĩa của bài Hịch tướng sĩ của Trần Quốc Tuấn?",
            "GAME_TRAN_NHAN_TONG": "Hội nghị Bình Than năm 1282 do vua Trần Nhân Tông triệu tập đã quyết định những gì?"
        }
        is_followup_reply = (
            any(k in unacc_q for k in [
                "ke tiep", "noi tiep", "tiep tuc di", "giai thich luon", "noi ro hon",
                "em khong nho", "khong nho a", "chua nho", "quen roi thay",
                "la chu gi", "la cau gi", "la tran nao vay", "co a thay ke", "vang thay ke"
            ])
            or cleaned_no_punct in ["co", "co a", "da co", "vang", "vang a", "ke di", "ke tiep di", "tiep di thay"]
        )
        if is_followup_reply and has_active_context and not has_explicit_standalone:
            last_uid = session.get("last_unit_id", "")
            if last_uid in FOLLOWUP_CONTINUATION_MAP:
                return FOLLOWUP_CONTINUATION_MAP[last_uid], True, None
            time_p = session.get("last_time_period", "1285")
            return f"Diễn biến và ý nghĩa tiếp theo của cuộc kháng chiến chống quân Mông Nguyên năm {time_p} là gì?", True, None

        # Mẫu 2: "Nhà vua làm gì tiếp theo?" / "Sau đó vua làm gì?" / "Vậy sau khi rút khỏi Thăng Long thì quân ta làm gì?"
        is_next_action_query = any(k in unacc_q for k in [
            "lam gi tiep theo", "tiep theo lam gi", "sau do lam gi", "tiep theo thi sao",
            "sau do thi sao", "the roi sao nua", "dien bien tiep theo", "nha vua lam gi tiep theo",
            "ong ay lam gi tiep theo", "quan ta lam gi", "quan ta lam gi tiep theo",
            "quan ta lam gi sau do", "sau khi rut khoi thang long thi quan ta lam gi",
            "sau khi rut khoi thang long", "sau do quan ta lam gi", "quan ta lam gi tiep"
        ])
        if is_next_action_query and has_active_context and not has_explicit_standalone:
            last_uid = session.get("last_unit_id", "")
            time_p = session.get("last_time_period", "1258")
            king = session.get("last_tran_king", "Vua Trần Thái Tông")
            if last_uid == "KC1_WHY_INVADE":
                rewritten = f"{king} làm gì tiếp theo trong cuộc kháng chiến chống quân Mông Cổ năm 1258?"
            elif last_uid == "KC1_BINH_LE_NGUYEN":
                rewritten = "Sau trận Bình Lệ Nguyên nhà Trần thực hiện kế sách vườn không nhà trống như thế nào năm 1258?"
            elif last_uid == "KC1_VUON_KHONG_NHA_TRONG" or "thang long" in unacc_q or "vuon khong" in str(session.get("last_topic", "")).lower():
                rewritten = "Sau khi rút khỏi Thăng Long thực hiện vườn không nhà trống quân Trần làm gì tiếp theo để phản công tại Đông Bộ Đầu năm 1258?"
            elif "TQT_" in last_uid:
                rewritten = "Trần Quốc Toản làm gì tiếp theo sau khi bóp nát quả cam ở bến Bình Than?"
            else:
                rewritten = f"Diễn biến tiếp theo của {session.get('last_event', 'cuộc kháng chiến')} năm {time_p} là gì?"
            return rewritten, True, None

        # Mẫu 3: "Vậy quân ta chống trả ra sao?" / "Quân ta chống trả như thế nào?"
        is_counterattack_query = any(k in unacc_q for k in [
            "quan ta chong tra ra sao", "chong tra ra sao", "chong tra the nao",
            "quan ta danh tra the nao", "quan ta chong cu ra sao", "danh tra ra sao",
            "chong cự ra sao", "quan ta da lam gi de chong tra"
        ])
        if is_counterattack_query and has_active_context and not has_explicit_standalone:
            time_p = session.get("last_time_period", "1258")
            rewritten = f"Quân dân nhà Trần chống trả quân Mông Cổ năm {time_p} như thế nào?"
            return rewritten, True, None

        # Mẫu 4: "Tại sao lại làm như vậy?" / "Vì sao làm thế?"
        is_why_action_query = any(k in unacc_q for k in [
            "tai sao lai lam nhu vay", "vi sao lai lam nhu vay", "tai sao lam the",
            "vi sao lam the", "sao lai lam the", "sao lai lam vay", "vi sao lai lam vay",
            "tai sao lai lam the", "muc dich lam vay la gi"
        ])
        if is_why_action_query and has_active_context and not has_explicit_standalone:
            last_uid = session.get("last_unit_id", "")
            if last_uid == "KC1_VUON_KHONG_NHA_TRONG" or "vuon khong" in (session.get("last_topic", "").lower()):
                rewritten = "Tại sao nhà Trần lại dùng kế sách vườn không nhà trống năm 1258?"
            elif last_uid == "KC1_BINH_LE_NGUYEN":
                rewritten = "Tại sao quân Trần lại rút lui ở trận Bình Lệ Nguyên năm 1258?"
            elif "TQT_" in last_uid or session.get("last_entity") == "Trần Quốc Toản":
                rewritten = "Vì sao Trần Quốc Toản lại bóp nát quả cam?"
            elif last_uid == "KC2_THOAT_HOAN_COPPER_PIPE":
                rewritten = "Tại sao Thoát Hoan phải chui vào ống đồng năm 1285?"
            elif last_uid == "KC1_WHY_INVADE":
                rewritten = "Vì sao quân Mông Cổ lại xâm lược Đại Việt năm 1258?"
            else:
                rewritten = f"Tại sao nhà Trần lại thực hiện {session.get('last_topic', 'kế sách đó')}?"
            return rewritten, True, None

        # Mẫu 5: "Kết quả của trận đó là gì?" / "Trận đó kết quả thế nào?"
        is_battle_result_query = any(k in unacc_q for k in [
            "ket qua cua tran do", "ket qua tran do", "tran do ket qua the nao",
            "ket cuc tran do", "tran danh do ket qua ra sao", "thang hay bai trong tran do",
            "ket qua cua tran ay", "tran do thang hay bai"
        ])
        if is_battle_result_query and has_active_context and not has_explicit_standalone:
            battle = session.get("last_battle") or session.get("last_event") or "trận đánh"
            b_lower = battle.lower()
            if "đông bộ đầu" in b_lower or "dong bo dau" in b_lower:
                rewritten = "Kết quả và ý nghĩa của trận phản công Đông Bộ Đầu năm 1258 là gì?"
            elif "bạch đằng" in b_lower or "bach dang" in b_lower:
                rewritten = "Kết quả của trận Bạch Đằng năm 1288 là gì?"
            elif "vân đồn" in b_lower or "van don" in b_lower:
                rewritten = "Kết quả của trận Vân Đồn tiêu diệt đoàn thuyền lương năm 1288 là gì?"
            elif "bình lệ nguyên" in b_lower or "binh le nguyen" in b_lower:
                rewritten = "Kết quả của trận Bình Lệ Nguyên năm 1258 là gì?"
            else:
                rewritten = f"Kết quả của {battle} là gì?"
            return rewritten, True, None

        # ----------------------------------------------------------------------
        # 6. ĐỒNG THAM CHIẾU ĐẠI TỪ CƠ BẢN (CHÀNG, ÔNG ẤY, VỊ TƯỚNG ĐÓ, TRẬN ĐÓ)
        # ----------------------------------------------------------------------
        rewritten = clean_q
        is_rewritten = False

        # Nếu câu hỏi đã có đối tượng độc lập cụ thể mới, KHÔNG chèn đại từ cũ
        if not has_explicit_standalone:
            # Thay đại từ nhân vật
            effective_entity = session.get("last_entity")
            person_pronouns = ["chàng", "ông ấy", "ông ta", "ông", "vị tướng đó", "vị vua đó", "người đó", "họ"]
            if effective_entity:
                for p in person_pronouns:
                    pattern = re.compile(rf"\b{re.escape(p)}\b", re.IGNORECASE)
                    if pattern.search(rewritten):
                        target_ent = effective_entity
                        if p == "chàng" and ("&" in target_ent or "và" in target_ent or "vua" in target_ent.lower()):
                            target_ent = session.get("last_individual_entity", "Trần Quốc Toản")
                        rewritten = pattern.sub(target_ent, rewritten, count=1)
                        is_rewritten = True
                        break

            # Thay đại từ sự kiện
            last_event = session.get("last_event")
            event_pronouns = ["trận đó", "cuộc chiến đó", "hội nghị đó", "sự kiện đó", "chiến dịch đó"]
            if last_event:
                for ep in event_pronouns:
                    pattern = re.compile(rf"\b{re.escape(ep)}\b", re.IGNORECASE)
                    if pattern.search(rewritten):
                        rewritten = pattern.sub(last_event, rewritten, count=1)
                        is_rewritten = True
                        break

        return rewritten, is_rewritten, None

    def update_session(
        self,
        session_id: str,
        query: str,
        unit_record: Dict[str, Any],
        answer: str,
        meta: Optional[Dict[str, Any]] = None
    ):
        """
        Cập nhật toàn diện trạng thái hội thoại sau mỗi lượt trả lời.
        """
        session = self.get_or_create_session(session_id)
        session["turn_count"] += 1

        uid = unit_record.get("unit_id", "")
        topic = unit_record.get("topic", "")
        event = unit_record.get("event", "")
        entity = unit_record.get("entity", "")

        # Không ghi nhớ ngữ cảnh các câu OOD hay chào hỏi / hỏi thông tin trợ lý / câu đố nhanh
        if uid in [
            "OOD_RANDOM_AND_OFFTOPIC", "INTENT_GREETING", "INTENT_THANKS",
            "INTENT_ASSISTANT_IDENTITY", "INTERACTIVE_CHAT_QUIZ"
        ]:
            session["history"].append({"user": query, "assistant": answer, "unit_id": uid})
            return

        session["last_unit_id"] = uid
        if topic:
            session["last_topic"] = topic
        if event and event not in ["Ngoài phạm vi", "Chào hỏi"]:
            session["last_event"] = event
        if entity and entity not in ["Không xác định", "Trợ lý AI Đông A"]:
            session["last_entity"] = entity
            if "&" not in entity and "và" not in entity:
                session["last_individual_entity"] = entity

        # Xác định mốc thời gian và vị vua tương ứng
        if uid.startswith("KC1_") or "1258" in event or "1258" in topic:
            session["last_time_period"] = "1258"
            session["last_tran_king"] = "Vua Trần Thái Tông"
        elif (
            uid.startswith("KC2_")
            or uid in [
                "TQT_WHY_ORANGE", "TQT_SIX_GOLDEN_WORDS", "TQT_OVERVIEW",
                "BINH_THAN_CONFERENCE", "DIEN_HONG_CONFERENCE", "HICH_TUONG_SI",
                "TRAN_HUNG_DAO_PORTRAIT", "KC2_TRAN_BINH_TRONG", "KC2_HAM_TU_CHUONG_DUONG",
                "KC2_THOAT_HOAN_COPPER_PIPE"
            ]
            or "1285" in event or "1285" in topic
        ):
            session["last_time_period"] = "1285"
            session["last_tran_king"] = "Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông"
        elif uid.startswith("KC3_") or "1288" in event or "1288" in topic or "1287" in event:
            session["last_time_period"] = "1288"
            session["last_tran_king"] = "Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông"

        # Xác định trận đánh tiêu biểu gần nhất
        combined_text = f"{topic} {event}".lower()
        if "dong bo dau" in combined_text or "đông bộ đầu" in combined_text:
            session["last_battle"] = "Trận Đông Bộ Đầu năm 1258"
        elif "binh le nguyen" in combined_text or "bình lệ nguyên" in combined_text:
            session["last_battle"] = "Trận Bình Lệ Nguyên năm 1258"
        elif "bach dang" in combined_text or "bạch đằng" in combined_text:
            session["last_battle"] = "Trận Bạch Đằng năm 1288"
        elif "van don" in combined_text or "vân đồn" in combined_text:
            session["last_battle"] = "Trận Vân Đồn năm 1288"
        elif "ham tu" in combined_text or "chuong duong" in combined_text or "tay ket" in combined_text:
            session["last_battle"] = "Các trận phản công Hàm Tử - Chương Dương năm 1285"

        session["history"].append({
            "user": query,
            "assistant": answer,
            "unit_id": uid,
            "time_period": session.get("last_time_period"),
            "king": session.get("last_tran_king")
        })


# Instance dùng chung mặc định
context_manager = ConversationalContextManager()
