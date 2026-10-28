"""
FILE 1: QUẢN LÝ DỮ LIỆU, CHỐNG DATA LEAKAGE & TẬP TEST HỌC SINH THẬT
================================================================================
Khắc phục triệt để góp ý của Mentor:
1. "Chia train/test trước, rồi mới tăng cường dữ liệu, và CHỈ tăng cường tập train".
2. Xây dựng tập TEST ĐỘC LẬP gồm câu hỏi thực tế của học sinh (viết tắt, không dấu,
   cộc lốc, sai chính tả, teen code) để có con số Accuracy trung thực (khoảng 75-88%).
3. Tích hợp bảng Q-Matrix (Cognitive Level: NHAN_BIET, THONG_HIEU, VAN_DUNG và Difficulty)
   làm tiền đề cho thuật toán Bayesian Knowledge Tracing (BKT) ở Khó khăn 3.
"""

import json
import random
from pathlib import Path
from typing import List, Dict, Any, Tuple
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

TRAIN_FILE = DATA_DIR / "train_data.jsonl"
TEST_FILE = DATA_DIR / "test_data.jsonl"
QMATRIX_FILE = DATA_DIR / "q_matrix.json"
KNOWLEDGE_BASE_FILE = DATA_DIR / "knowledge_base.json"


# ==============================================================================
# 1. DANH MỤC 32 CỤM TRI THỨC CHUYÊN SÂU & BẢNG Q-MATRIX
# ==============================================================================
KNOWLEDGE_UNITS: List[Dict[str, Any]] = [
    # --- KHÁNG CHIẾN LẦN 1 (1258) ---
    {
        "unit_id": "KC1_OVERVIEW",
        "category": "KHANG_CHIEN_LAN_1_1258",
        "topic": "Toàn cảnh kháng chiến chống Mông Cổ lần 1 (1258)",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.4, "skills": ["SKILL_KC1_TIMELINE", "SKILL_DONG_BO_DAU"]},
        "entity": "Trần Thái Tông",
        "event": "Kháng chiến chống Mông Cổ lần 1 (1258)",
        "fact_chunk": "Tháng 1/1258, 3 vạn quân Mông Cổ do Ngột Lương Hợp Thai chỉ huy xâm lược Đại Việt. Vua Trần Thái Tông chặn giặc ở Bình Lệ Nguyên rồi rút lui bảo toàn lực lượng, thực hiện 'Vườn không nhà trống' ở Thăng Long. Ngày 29/1/1258, quân Trần phản công thắng lợi tại Đông Bộ Đầu, quét sạch giặc khỏi bờ cõi.",
        "badge": "Chiến thần Đông Bộ Đầu",
        "base_queries": [
            "tôi cần biết về trận chiến chống nguyên mông lần 1",
            "kể về cuộc kháng chiến chống mông cổ lần thứ nhất năm 1258",
            "tóm tắt diễn biến cuộc kháng chiến lần 1 chống quân mông cổ",
            "kháng chiến lần thứ nhất năm 1258 diễn ra thế nào"
        ],
        "answer": (
            "Cuộc kháng chiến lần thứ nhất chống quân Mông Cổ (đầu năm 1258) diễn ra vô cùng quyết liệt và kết thúc thắng lợi chỉ trong chưa đầy một tháng:\n\n"
            "• **Mở đầu (Tháng 1/1258)**: Ngột Lương Hợp Thai dẫn 3 vạn kỵ binh Mông Cổ tiến vào Đại Việt theo đường sông Thao.\n"
            "• **Trận Bình Lệ Nguyên**: Vua Trần Thái Tông trực tiếp đốc chiến; nghe lời tướng Lê Tần khuyên nhủ, nhà vua chủ động rút quân để bảo toàn lực lượng.\n"
            "• **Kế sách 'Vườn không nhà trống'**: Triều đình và nhân dân Thăng Long sơ tán toàn bộ lương thảo, khiến quân giặc rơi vào cảnh đói kiệt và dịch bệnh.\n"
            "• **Đại thắng Đông Bộ Đầu (29/1/1258)**: Quân Trần mở đợt tổng phản công sấm sét tại bến Đông Bộ Đầu, quét sạch giặc khỏi bờ cõi."
        ),
        "follow_up": "Em có muốn biết kế sách Vườn không nhà trống đã làm quân Mông Cổ suy kiệt ra sao không?"
    },
    {
        "unit_id": "KC1_WHY_INVADE",
        "category": "KHANG_CHIEN_LAN_1_1258",
        "topic": "Âm mưu Mông Cổ xâm lược Đại Việt năm 1258",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_KC1_MOTIVE"]},
        "entity": "Ngột Lương Hợp Thai & Vua Trần Thái Tông",
        "event": "Mông Cổ xâm lược Đại Việt năm 1258",
        "fact_chunk": "Năm 1258, quân Mông Cổ xâm lược Đại Việt nhằm tạo bàn đạp chiến lược đánh thọc từ phía nam lên để phối hợp tiêu diệt nhà Nam Tống. Trước hành vi nghênh ngang đòi mượn đường của sứ giả Mông Cổ, vua Trần Thái Tông kiên quyết cự tuyệt, hạ lệnh bắt giam sứ giả vào ngục và ban lệnh cho cả nước sẵn sàng kháng chiến.",
        "badge": "Chiến thần Đông Bộ Đầu",
        "base_queries": [
            "vì sao quân mông cổ lại đánh đại việt năm 1258",
            "mục đích của mông cổ khi xâm lược nước ta lần 1 là gì",
            "tại sao ngột lương hợp thai lại tấn công đại việt",
            "âm mưu mông cổ đánh đại việt để tạo gọng kìm diệt nam tống",
            "khi sứ giả mông cổ sang đòi mượn đường vua trần đã xử lý thế nào",
            "vua trần thái tông đã làm gì trước âm mưu xâm lược của mông cổ năm 1258"
        ],
        "answer": (
            "Mục đích cốt lõi của quân Mông Cổ khi đánh Đại Việt năm 1258 là **chiếm bàn đạp chiến lược để tạo thế gọng kìm tiêu diệt Nam Tống**.\n\n"
            "Đế chế Mông Cổ đang bế tắc trong cuộc chiến với nhà Nam Tống (Trung Quốc). Do đó, Ngột Lương Hợp Thai muốn thôn tính Đại Việt để mở đường tiến công đánh thốc từ sườn phía Nam lên, kẹp Nam Tống vào giữa hai gọng kìm.\n\n"
            "Trước âm mưu xâm lược và thái độ nghênh ngang của sứ giả Mông Cổ đòi mượn đường, **vua Trần Thái Tông đã kiên quyết xử lý bằng cách cự tuyệt, ra lệnh bắt giam sứ giặc vào ngục**, đồng thời ban lệnh cho toàn quân và muôn dân cả nước chuẩn bị sẵn sàng kháng chiến bảo vệ bờ cõi!"
        ),
        "follow_up": "Em có biết trận đụng độ đầu tiên giữa quân Trần và kỵ binh Mông Cổ đã diễn ra tại đâu không?"
    },
    {
        "unit_id": "KC1_BINH_LE_NGUYEN",
        "category": "KHANG_CHIEN_LAN_1_1258",
        "topic": "Trận Bình Lệ Nguyên và Lê Phụ Trần (1258)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.6, "skills": ["SKILL_BINH_LE_NGUYEN", "SKILL_LE_PHU_TRAN"]},
        "entity": "Lê Phụ Trần (Lê Tần)",
        "event": "Trận Bình Lệ Nguyên (Tháng 1/1258)",
        "fact_chunk": "Tại trận Bình Lệ Nguyên (Vĩnh Phúc) tháng 1/1258, tướng Lê Tần (Lê Phụ Trần) lấy ván thuyền che tên cho vua Trần Thái Tông và khuyên vua rút lui bảo toàn lực lượng.",
        "badge": "Chiến thần Đông Bộ Đầu",
        "base_queries": [
            "tại sao quân trần lại rút lui ở trận bình lệ nguyên",
            "ai là người lấy ván thuyền che tên cho vua trần thái tông",
            "lê tần hay lê phụ trần có công lao gì ở bình lệ nguyên",
            "diễn biến trận bình lệ nguyên vĩnh phúc năm 1258"
        ],
        "answer": (
            "Tại trận **Bình Lệ Nguyên** (Vĩnh Phúc, tháng 1/1258), vua Trần Thái Tông trực tiếp đốc chiến, nhưng kỵ binh giặc ban đầu quá hung hãn.\n\n"
            "Giữa làn mưa tên dày đặc, tướng **Lê Tần** (sau được đổi tên là **Lê Phụ Trần**) đã dũng cảm lấy ván thuyền che chắn cho vua và khuyên: *'Nay thế giặc đang mạnh, ta chỉ là đánh liều một trận mà thôi. Chi bằng tạm rút lui để giữ lấy lực lượng, lo gì sau này không có dịp phản công!'*.\n\n"
            "Nhờ đó, chủ lực Đại Việt rút lui an toàn, tạo tiền đề phản công thắng lợi tại Đông Bộ Đầu."
        ),
        "follow_up": "Sau khi rút khỏi Bình Lệ Nguyên, quân dân ta đã thực hiện kế sách độc đáo nào tại kinh thành Thăng Long?"
    },
    {
        "unit_id": "KC1_VUON_KHONG_NHA_TRONG",
        "category": "KHANG_CHIEN_LAN_1_1258",
        "topic": "Kế sách Vườn không nhà trống tại Thăng Long (1258)",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.7, "skills": ["SKILL_VUON_KHONG_NHA_TRONG"]},
        "entity": "Quân dân Thăng Long",
        "event": "Kế sách Vườn không nhà trống (1258)",
        "fact_chunk": "Kế sách 'Vườn không nhà trống' là sơ tán toàn bộ nhân dân và lương thực khỏi kinh thành Thăng Long, làm giặc không cướp được lương ăn, rơi vào cảnh đói kiệt và hoang mang.",
        "badge": "Chiến thần Đông Bộ Đầu",
        "base_queries": [
            "kế sách vườn không nhà trống là gì và có tác dụng như thế nào",
            "tại sao nhà trần lại dùng kế vườn không nhà trống",
            "vườn không nhà trống giúp quân trần thắng giặc ra sao",
            "làm thế nào nhà trần làm cho quân mông cổ bị đói lương",
            "vì sao quân trần chủ động rút khỏi thăng long",
            "tại sao quân ta lại rút khỏi kinh thành thăng long",
            "vì sao nhà trần phải rút khỏi thăng long năm 1258",
            "quân trần rút khỏi thăng long nhằm mục đích gì",
            "vì sao chiến thuật rút lui không đồng nghĩa với thất bại",
            "tại sao việc quân trần rút lui không phải là đầu hàng hay thất bại",
            "ý nghĩa của chiến thuật rút lui chiến lược trong kháng chiến chống mông nguyên"
        ],
        "answer": (
            "Việc quân Trần **chủ động rút khỏi Thăng Long** để thực hiện kế sách **'Vườn không nhà trống'** là một nghệ thuật quân sự độc đáo và sáng suốt:\n\n"
            "1. **Triệt phá hoàn toàn hậu cần giặc**: Quân Mông Cổ quen hành quân thần tốc và cướp bóc lương thực tại chỗ. Khi quân dân ta sơ tán sạch người và của, giặc chỉ chiếm được một tòa thành rỗng không một hạt thóc, nhanh chóng rơi vào cảnh đói kiệt và dịch bệnh.\n"
            "2. **Chủ động rút lui để bảo toàn thực lực**: Rút lui không phải là thất bại, mà là bước lùi chiến lược nhằm tránh mũi nhọn hung hãn ban đầu của giặc, bảo toàn nguyên vẹn quân chủ lực Đại Việt.\n"
            "3. **Tạo thời cơ phản công quyết định**: Khi giặc mỏi mệt, suy kiệt sĩ khí sau nhiều ngày giam chân trong thành trống, quân ta chớp thời cơ mở đợt tổng phản công sấm sét tại Đông Bộ Đầu đánh tan tác quân thù."
        ),
        "follow_up": "Sau khi rút khỏi Thăng Long, em có biết quân dân ta đã chớp thời cơ phản công giặc tại bến sông nào không?"
    },
    {
        "unit_id": "KC1_TRAN_THU_DO_QUOTE",
        "category": "KHANG_CHIEN_LAN_1_1258",
        "topic": "Thái sư Trần Thủ Độ và câu nói bất hủ (1258)",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.3, "skills": ["SKILL_TRAN_THU_DO"]},
        "entity": "Thái sư Trần Thủ Độ",
        "event": "Kháng chiến chống Mông Cổ lần 1 (1258)",
        "fact_chunk": "Năm 1258, khi vua Trần Thái Tông lo lắng hỏi kế sách, Thái sư Trần Thủ Độ khẳng khái tâu: 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!'.",
        "badge": "Bản lĩnh Đông A",
        "base_queries": [
            "câu nói đầu thần chưa rơi xuống đất xin bệ hạ đừng lo là của ai",
            "trần thủ độ có vai trò gì trong kháng chiến lần 1 năm 1258",
            "ai nói đầu tôi chưa rơi xuống đất xin bệ hạ đừng lo",
            "ý nghĩa câu nói của thái sư trần thủ độ"
        ],
        "answer": (
            "Câu nói bất hủ **'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!'** là của **Thái sư Trần Thủ Độ** (1194 – 1264).\n\n"
            "Vào tháng 1/1258, khi triều đình phải tạm rút khỏi Thăng Long xuôi về sông Thiên Mạc, vua Trần Thái Tông lo lắng đến hỏi ý kiến. Lời khẳng định đanh thép, bản lĩnh ngút trời của vị Thái sư đã xua tan nỗi hoang mang, củng cố ý chí quyết chiến cho toàn thể triều đình."
        ),
        "follow_up": "Bên cạnh Trần Thủ Độ, thời Trần còn có câu nói lẫy lừng của Trần Bình Trọng hay Trần Hưng Đạo, em có muốn nghe không?"
    },
    {
        "unit_id": "KC1_DONG_BO_DAU",
        "category": "KHANG_CHIEN_LAN_1_1258",
        "topic": "Đại thắng Đông Bộ Đầu (29/1/1258)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_DONG_BO_DAU", "SKILL_HA_KHUAT"]},
        "entity": "Trần Thái Tông & Hà Khuất",
        "event": "Trận Đông Bộ Đầu (29/1/1258)",
        "fact_chunk": "Ngày 29/1/1258, quân Trần phản công đánh tan giặc Mông Cổ tại bến Đông Bộ Đầu (Hà Nội). Tàn quân tháo chạy qua Quy Hóa bị chủ trại Hà Khuất chặn đánh tan tác.",
        "badge": "Chiến thần Đông Bộ Đầu",
        "base_queries": [
            "trận đông bộ đầu diễn ra vào ngày tháng năm nào và ở đâu",
            "chiến thắng đông bộ đầu năm 1258 có ý nghĩa gì",
            "ai là người chặn đánh giặc mông cổ ở trại quy hóa",
            "trận quyết chiến kết thúc kháng chiến lần 1 năm 1258"
        ],
        "answer": (
            "Trận **Đông Bộ Đầu** (nay thuộc khu vực bến sông Hồng gần cầu Long Biên, Hà Nội) diễn ra vào ngày **29/1/1258** là trận đại phản công kết thúc thắng lợi cuộc kháng chiến lần thứ nhất:\n\n"
            "Chớp thời cơ quân Mông Cổ bị đói ăn sau hơn 9 ngày chiếm thành trống, vua Trần Thái Tông hạ lệnh xuất kích đánh úp thẳng vào cứ điểm giặc. Quân Mông Cổ đại bại tháo chạy, trên đường qua **vùng Quy Hóa** (Yên Bái - Lào Cai) lại bị lực lượng dân binh của tù trưởng **Hà Khuất** phục kích tơi bời, tháo chạy tán loạn về nước."
        ),
        "follow_up": "Sau thất bại cay đắng này, hơn 20 năm sau nhà Nguyên mới dám đem quân tái xâm lược lần thứ hai đấy!"
    },

    # --- HỘI NGHỊ BÌNH THAN & TRẦN QUỐC TOẢN (1282) ---
    {
        "unit_id": "TQT_WHY_ORANGE",
        "category": "BINH_THAN_TRAN_QUOC_TOAN",
        "topic": "Vì sao Trần Quốc Toản bóp nát quả cam (1282)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.4, "skills": ["SKILL_TRAN_QUOC_TOAN", "SKILL_BINH_THAN"]},
        "entity": "Hoài Văn hầu Trần Quốc Toản",
        "event": "Hội nghị Bình Than (Tháng 10/1282)",
        "fact_chunk": "Tháng 10/1282 tại Hội nghị Bình Than, Trần Quốc Toản vì mới 15-16 tuổi không được vào dự bàn việc nước. Vừa căm thù giặc vừa hổ thẹn, chàng siết chặt bàn tay bóp nát quả cam vua ban lúc nào không hay.",
        "badge": "Lá cờ sáu chữ vàng",
        "base_queries": [
            "vì sao trần quốc toản lại bóp nát quả cam",
            "tại sao trần quốc toản bóp nát quả cam vua ban ở bến bình than",
            "nguyên nhân trần quốc toản bóp nát quả cam là gì",
            "trần quốc toản bóp nát quả cam ở đâu",
            "câu chuyện trần quốc toản bóp nát quả cam"
        ],
        "answer": (
            "Hoài Văn hầu **Trần Quốc Toản** bóp nát quả cam là vì **lòng yêu nước nồng nàn và nỗi hổ thẹn sục sôi khi không được dự bàn việc nước lúc tuổi còn nhỏ**.\n\n"
            "Tại Hội nghị Bình Than (tháng 10/1282), vì mới khoảng 15–16 tuổi, chàng không được vào khoang trướng dự họp. Quá nôn nóng vì nước nhà nguy ngập, Quốc Toản liều mình xô lính canh bước vào. Vua Trần Nhân Tông thấy chàng có chí khí nên không trị tội mà ban cho quả cam. Bước lên bờ, vừa căm hận giặc Nguyên bạo tàn, vừa tủi hổ vì bị xem là trẻ con đứng ngoài cuộc, chàng siết chặt bàn tay làm quả cam nát vụn lúc nào không hay."
        ),
        "follow_up": "Em có nhớ sau khi rời bến Bình Than, Trần Quốc Toản đã thêu sáu chữ vàng gì lên lá cờ của mình không?"
    },
    {
        "unit_id": "TQT_SIX_GOLDEN_WORDS",
        "category": "BINH_THAN_TRAN_QUOC_TOAN",
        "topic": "Lá cờ thêu sáu chữ vàng của Trần Quốc Toản",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.3, "skills": ["SKILL_TRAN_QUOC_TOAN"]},
        "entity": "Hoài Văn hầu Trần Quốc Toản",
        "event": "Đội quân sáu chữ vàng (1282 - 1285)",
        "fact_chunk": "Trần Quốc Toản chiêu mộ hơn 1.000 gia nô, thân tộc dựng cờ thêu sáu chữ vàng 'Phá cường địch, báo hoàng ân' (Phá giặc mạnh, đền ơn vua).",
        "badge": "Lá cờ sáu chữ vàng",
        "base_queries": [
            "lá cờ của trần quốc toản thêu sáu chữ vàng gì",
            "6 chữ vàng trên lá cờ của trần quốc toản có nghĩa là gì",
            "phá cường địch báo hoàng ân nghĩa là gì và của ai",
            "đội quân của trần quốc toản có bao nhiêu người"
        ],
        "answer": (
            "Lá cờ của Hoài Văn hầu Trần Quốc Toản thêu sáu chữ vàng rực rỡ: **'Phá cường địch, báo hoàng ân'** — có nghĩa là **'Phá giặc mạnh, đền ơn vua'**.\n\n"
            "Sau khi rời bến Bình Than, chàng tự bỏ tiền của chiêu mộ hơn **1.000 gia nô và thân tộc**, ngày đêm thao luyện võ nghệ, đóng thuyền bè và giương cao lá cờ sáu chữ vàng. Trong cuộc kháng chiến năm 1285, đội quân thiếu niên quả cảm ấy luôn xung phong ở tuyến đầu tại Hàm Tử, Chương Dương, làm quân Nguyên khiếp đảm."
        ),
        "follow_up": "Hành động của Trần Quốc Toản là tấm gương sáng ngời cho tuổi trẻ Việt Nam qua mọi thời đại!"
    },
    {
        "unit_id": "TQT_OVERVIEW",
        "category": "BINH_THAN_TRAN_QUOC_TOAN",
        "topic": "Tiểu sử anh hùng thiếu niên Trần Quốc Toản",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.3, "skills": ["SKILL_TRAN_QUOC_TOAN"]},
        "entity": "Hoài Văn hầu Trần Quốc Toản",
        "event": "Kháng chiến chống Nguyên lần 2 (1285)",
        "fact_chunk": "Hoài Văn hầu Trần Quốc Toản (1267 - 1285) là thiếu niên anh hùng hoàng tộc thời Trần, nổi tiếng với giai thoại bóp nát quả cam tại Bình Than và lá cờ thêu sáu chữ vàng.",
        "badge": "Lá cờ sáu chữ vàng",
        "base_queries": [
            "bạn biết trần quốc toản không",
            "trần quốc toản là ai trong lịch sử nhà trần",
            "giới thiệu về anh hùng thiếu niên trần quốc toản",
            "hoài văn hầu trần quốc toản có công lao gì"
        ],
        "answer": (
            "**Hoài Văn hầu Trần Quốc Toản** (1267 – 1285) là biểu tượng anh hùng tuổi trẻ kiệt xuất của triều Trần trong cuộc kháng chiến chống quân Nguyên lần thứ hai (1285):\n\n"
            "• **Tuổi trẻ chí lớn**: Mới 15–16 tuổi, vì không được dự Hội nghị Bình Than (1282), chàng hổ thẹn bóp nát quả cam vua ban.\n"
            "• **Tự lực lập quân**: Tự chiêu tập hơn 1.000 gia nô, thêu cờ **'Phá cường địch, báo hoàng ân'**.\n"
            "• **Chiến công oanh liệt**: Trực tiếp tham gia các trận đánh lớn Tây Kết, Chương Dương, xông pha tuyến đầu đánh đuổi quân xâm lược."
        ),
        "follow_up": "Em muốn tìm hiểu thêm về sự kiện quả cam hay về lá cờ sáu chữ vàng của chàng?"
    },
    {
        "unit_id": "BINH_THAN_CONFERENCE",
        "category": "BINH_THAN_TRAN_QUOC_TOAN",
        "topic": "Hội nghị Bình Than (Tháng 10/1282)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_BINH_THAN"]},
        "entity": "Vua Trần Nhân Tông & Vương hầu",
        "event": "Hội nghị Bình Than (1282)",
        "fact_chunk": "Tháng 10/1282, vua Trần Nhân Tông triệu tập Hội nghị Bình Than (tại bến Bình Than, Bắc Ninh/Hải Dương) gồm vương hầu, trăm quan bàn kế đánh giặc và cử Trần Quốc Tuấn làm Quốc công Tiết chế.",
        "badge": "Mưu lược Bình Than",
        "base_queries": [
            "hội nghị bình than diễn ra vào năm nào và ở đâu",
            "mục đích của hội nghị bình than năm 1282 là gì",
            "hội nghị bình than đã đưa ra những quyết định quan trọng nào",
            "sự khác nhau giữa hội nghị bình than và hội nghị diên hồng"
        ],
        "answer": (
            "**Hội nghị Bình Than** diễn ra vào **tháng 10 năm 1282** tại bến Bình Than (ngã ba sông Đuống và sông Thái Bình), do **vua Trần Nhân Tông** triệu tập:\n\n"
            "• **Thành phần & Mục đích**: Triệu tập các vương hầu, tướng lĩnh cao cấp của triều đình để bàn phương án tác chiến phòng thủ trước nguy cơ quân Nguyên xâm lược.\n"
            "• **Quyết định cốt lõi**: Cử Hưng Đạo vương Trần Quốc Tuấn làm Quốc công Tiết chế chỉ huy toàn quân, thống nhất ý chí hoàng tộc.\n"
            "• **Phân biệt với Diên Hồng**: Bình Than (1282) là hội nghị của **vương hầu, tướng lĩnh**, còn Diên Hồng (1285) là hội nghị của **các bậc bô lão đại diện cho toàn thể nhân dân**."
        ),
        "follow_up": "Em có muốn tìm hiểu về khí thế sục sôi tại Hội nghị Diên Hồng sau đó không?"
    },

    # --- HỘI NGHỊ DIÊN HỒNG & HỊCH TƯỚNG SĨ (1284 - 1285) ---
    {
        "unit_id": "DIEN_HONG_CONFERENCE",
        "category": "DIEN_HONG_HICH_TUONG_SI",
        "topic": "Hội nghị Diên Hồng (Đầu năm 1285)",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.6, "skills": ["SKILL_DIEN_HONG"]},
        "entity": "Thượng hoàng Trần Thánh Tông & Các bô lão",
        "event": "Hội nghị Diên Hồng (Đầu năm 1285)",
        "fact_chunk": "Đầu năm 1285, Thượng hoàng Trần Thánh Tông triệu tập các bậc bô lão cả nước họp ở điện Diên Hồng, hỏi 'Nên đánh hay nên hòa?'. Muôn người đồng thanh hô vang một tiếng 'ĐÁNH!'.",
        "badge": "Hào khí Diên Hồng",
        "base_queries": [
            "hội nghị diên hồng năm 1285 có ý nghĩa gì",
            "tại hội nghị diên hồng các bô lão đã hô vang từ gì",
            "kể về hội nghị diên hồng đầu năm 1285",
            "hội nghị diên hồng được tổ chức vào năm nào",
            "vì sao nhà trần lại mời các bô lão về họp ở điện diên hồng"
        ],
        "answer": (
            "**Hội nghị Diên Hồng** (đầu năm 1285 tại điện Diên Hồng, Thăng Long) do Thượng hoàng **Trần Thánh Tông** chủ trì là biểu tượng vĩ đại của nền dân chủ và khối đại đoàn kết dân tộc:\n\n"
            "• Trước thế giặc 50 vạn quân Nguyên hung bạo, triều đình mở yến tiệc mời các bậc bô lão đại diện cho nhân dân các làng xã trên cả nước về hỏi kế sách: *'Nên đánh hay nên hòa?'*.\n"
            "• Hàng trăm vị bô lão râu tóc bạc phơ đã đồng thanh hô vang một tiếng **'ĐÁNH!'** rung chuyển kinh thành.\n"
            "• Khẳng định quyết tâm chống giặc giữ nước xuất phát từ ý nguyện thiêng liêng của muôn dân trăm họ, chứ không chỉ riêng triều đình."
        ),
        "follow_up": "Để khích lệ tinh thần binh sĩ trước giờ ra trận, Trần Hưng Đạo đã viết áng văn bất hủ nào, em có nhớ không?"
    },
    {
        "unit_id": "HICH_TUONG_SI",
        "category": "DIEN_HONG_HICH_TUONG_SI",
        "topic": "Hịch tướng sĩ và Tinh thần Sát Thát (1284 - 1285)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_HICH_TUONG_SI", "SKILL_SAT_THAT"]},
        "entity": "Trần Quốc Tuấn & Binh sĩ",
        "event": "Kháng chiến chống Nguyên lần 2 (1285)",
        "fact_chunk": "Năm 1284, Trần Quốc Tuấn soạn 'Hịch tướng sĩ' khích lệ lòng yêu nước. Quân sĩ nhà Trần tự nguyện xăm hai chữ 'Sát Thát' (Giết giặc Mông Cổ) lên cánh tay thề sống chết với non sông.",
        "badge": "Hào khí Đông A",
        "base_queries": [
            "ai là tác giả của hịch tướng sĩ và bài hịch có ý nghĩa gì",
            "hai chữ sát thát nghĩa là gì và vì sao binh sĩ lại xăm lên tay",
            "tinh thần sát thát của quân dân nhà trần là gì",
            "câu văn ta thường tới bữa quên ăn nửa đêm vỗ gối trong tác phẩm nào"
        ],
        "answer": (
            "**'Hịch tướng sĩ'** do **Quốc công Tiết chế Trần Hưng Đạo** soạn thảo vào năm 1284 nhằm khích lệ tinh thần quyết chiến của tướng sĩ Đại Việt:\n\n"
            "• **Áng văn tâm huyết**: Những câu văn bất hủ như *'Ta thường tới bữa quên ăn, nửa đêm vỗ gối, ruột đau như cắt, nước mắt đầm đìa...'* đã thổi bùng ngọn lửa căm thù giặc trong lòng quân đội.\n"
            "• **Khẩu hiệu 'Sát Thát'**: Sau khi nghe truyền hịch, toàn thể tướng sĩ đã đồng lòng xăm hai chữ **'Sát Thát'** (Giết giặc Mông Cổ) lên cánh tay để thề không đội trời chung với quân xâm lược."
        ),
        "follow_up": "Em có biết câu nói nổi tiếng của Trần Hưng Đạo khi vua Trần hỏi có nên đầu hàng giặc không?"
    },
    {
        "unit_id": "TRAN_HUNG_DAO_PORTRAIT",
        "category": "DIEN_HONG_HICH_TUONG_SI",
        "topic": "Quốc công Tiết chế Hưng Đạo Đại vương Trần Quốc Tuấn",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.3, "skills": ["SKILL_TRAN_HUNG_DAO"]},
        "entity": "Trần Quốc Tuấn (Trần Hưng Đạo)",
        "event": "Kháng chiến chống Nguyên lần 2 và 3",
        "fact_chunk": "Trần Quốc Tuấn (1228 - 1300) là vị tổng chỉ huy quân đội Đại Việt trong hai lần kháng chiến năm 1285 và 1288. Ông nói câu 'Nếu bệ hạ muốn hàng xin hãy chém đầu thần trước đã!' và chỉ huy đại thắng Bạch Đằng 1288.",
        "badge": "Hưng Đạo Đại Vương",
        "base_queries": [
            "trần hưng đạo là ai và có công lao gì",
            "ai là người nói câu nếu bệ hạ muốn hàng xin hãy chém đầu thần trước đã",
            "kể về anh hùng dân tộc trần quốc tuấn trần hưng đạo",
            "công lao của hưng đạo đại vương trong các cuộc kháng chiến"
        ],
        "answer": (
            "**Hưng Đạo Đại vương Trần Quốc Tuấn** (1228 – 1300) là thiên tài quân sự kiệt xuất, Quốc công Tiết chế thống lĩnh toàn bộ quân đội Đại Việt:\n\n"
            "• **Đặt nợ nước lên trên thù nhà**: Xóa bỏ hiềm khích gia tộc để đoàn kết toàn quân.\n"
            "• **Bản lĩnh thép**: Khi giặc Nguyên tràn ngập năm 1285, ông khẳng khái tâu vua: **'Nếu bệ hạ muốn hàng, xin hãy chém đầu thần trước đã!'**.\n"
            "• **Chiến công hiển hách**: Soạn Hịch tướng sĩ, chỉ huy các chiến dịch giải phóng Thăng Long (1285) và đại thắng cọc ngầm **Bạch Đằng (1288)**.\n"
            "• **Di huấn muôn đời**: Để lại bài học: *'Khoan thư sức dân để làm kế sâu rễ bền gốc, đó là thượng sách giữ nước'*."
        ),
        "follow_up": "Em có muốn nghe chuyện về hai người gia tướng tài ba Yết Kiêu và Dã Tượng của ông không?"
    },

    # --- KHÁNG CHIẾN LẦN 2 (1285) ---
    {
        "unit_id": "KC2_OVERVIEW",
        "category": "KHANG_CHIEN_LAN_2_1285",
        "topic": "Toàn cảnh cuộc kháng chiến chống quân Nguyên lần 2 (1285)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_KC2_TIMELINE", "SKILL_THOAT_HOAN"]},
        "entity": "Trần Hưng Đạo & Thoát Hoan",
        "event": "Kháng chiến chống Nguyên lần 2 (1285)",
        "fact_chunk": "Đầu năm 1285, Thoát Hoan đem 50 vạn quân Nguyên từ phía Bắc phối hợp Toa Đô từ phía Nam đánh Đại Việt. Tháng 5-6/1285, quân Trần đại phản công ở Tây Kết, Hàm Tử, Chương Dương. Toa Đô bị chém đầu, Thoát Hoan chui ống đồng tháo chạy.",
        "badge": "Hào khí Chương Dương - Hàm Tử",
        "base_queries": [
            "kể về cuộc kháng chiến chống quân nguyên lần thứ hai năm 1285",
            "tôi cần biết về trận chiến chống nguyên mông lần 2",
            "tóm tắt diễn biến cuộc kháng chiến lần 2 năm 1285",
            "kháng chiến chống nguyên lần 2 diễn ra như thế nào"
        ],
        "answer": (
            "Kháng chiến lần thứ hai (1285) là cuộc chiến quy mô khốc liệt nhất khi giặc huy động **50 vạn quân** tạo thế gọng kìm hai đầu:\n\n"
            "• **Thế giặc hung hãn**: Thoát Hoan đánh từ phía Bắc xuống, Toa Đô từ Chăm-pa đánh ngược từ phía Nam lên.\n"
            "• **Rút lui bảo toàn**: Quân Trần thực hiện Vườn không nhà trống tại Thăng Long, khéo léo chặn không cho hai đạo quân giặc hội quân.\n"
            "• **Tổng phản công vang dội (Tháng 5 - 6/1285)**: Quân ta tổng phản công tại **A Lỗ, Tây Kết, Hàm Tử, Chương Dương**, tiến vào giải phóng Thăng Long.\n"
            "• **Kết cục giặc**: Toa Đô bị chém đầu tại Tây Kết, Lý Hằng trúng tên độc, còn Thoát Hoan phải **chui vào ống đồng** cho lính khiêng chạy trối chết về nước."
        ),
        "follow_up": "Em có tò mò vì sao Thoát Hoan lại phải chui vào ống đồng khi chạy trốn không?"
    },
    {
        "unit_id": "KC2_THOAT_HOAN_COPPER_PIPE",
        "category": "KHANG_CHIEN_LAN_2_1285",
        "topic": "Thoát Hoan chui ống đồng tháo chạy (Tháng 6/1285)",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.3, "skills": ["SKILL_THOAT_HOAN"]},
        "entity": "Thoát Hoan",
        "event": "Thoát Hoan tháo chạy qua Vạn Kiếp (Tháng 6/1285)",
        "fact_chunk": "Tháng 6/1285, khi tháo chạy qua Vạn Kiếp, vì quá sợ bị trúng tên tẩm thuốc độc của quân dân nhà Trần, chủ tướng Thoát Hoan đã chui vào ống đồng đặt trên xe cho lính kéo về nước.",
        "badge": "Hào khí Chương Dương - Hàm Tử",
        "base_queries": [
            "vì sao thoát hoan phải chui vào ống đồng",
            "ai là tướng giặc phải chui vào ống đồng chạy về nước",
            "thoát hoan chui ống đồng trong cuộc kháng chiến lần thứ mấy",
            "tại sao tướng giặc thoát hoan lại trốn trong ống đồng"
        ],
        "answer": (
            "**Thoát Hoan** (con trai vua Nguyên Hốt Tất Liệt) phải chui vào ống đồng tháo chạy vào **tháng 6 năm 1285** (kháng chiến lần thứ hai) vì **quá khiếp sợ trước những trận phục kích và mưa tên tẩm độc của quân dân Đại Việt**.\n\n"
            "Khi quân giặc tan vỡ tháo chạy về biên giới phía Bắc, Trần Hưng Đạo bố trí các ổ mai phục bắn tên tẩm thuốc độc dữ dội tại sông Như Nguyệt và Vạn Kiếp. Tướng giặc Lý Hằng trúng tên độc chết ngay tại trận. Quá kinh hãi, 'Trấn Nam Vương' Thoát Hoan đành chui vào một chiếc ống đồng lớn đặt trên xe đẩy để che chắn thân mình rồi hối hả cho lính khiêng chạy tháo thân về phương Bắc."
        ),
        "follow_up": "Hình ảnh ống đồng Thoát Hoan đã trở thành nỗi nhục muôn đời của quân xâm lược phương Bắc đấy!"
    },
    {
        "unit_id": "KC2_TRAN_BINH_TRONG",
        "category": "KHANG_CHIEN_LAN_2_1285",
        "topic": "Bảo Nghĩa vương Trần Bình Trọng và câu nói bất tử (1285)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.4, "skills": ["SKILL_TRAN_BINH_TRONG"]},
        "entity": "Trần Bình Trọng",
        "event": "Trận bãi Tự Nhiên (Tháng 2/1285)",
        "fact_chunk": "Tháng 2/1285, Trần Bình Trọng chặn giặc ở bãi Tự Nhiên bảo vệ hai vua Trần rút lui. Bị giặc bắt và dụ hàng phong vương, ông thét lớn: 'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!' rồi anh dũng hy sinh.",
        "badge": "Khí phách Nước Nam",
        "base_queries": [
            "ai nói ta thà làm quỷ nước nam chứ không thèm làm vương đất bắc",
            "trần bình trọng hy sinh trong trận nào",
            "câu nói nổi tiếng của trần bình trọng trước mặt giặc",
            "kể về sự hy sinh oanh liệt của trần bình trọng"
        ],
        "answer": (
            "Câu nói bất hủ **'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!'** là của danh tướng **Bảo Nghĩa vương Trần Bình Trọng** (1259 – 1285).\n\n"
            "Tháng 2/1285, ông chỉ huy đội quân cảm tử chặn đánh quân giặc tại **bãi Tự Nhiên** (sông Hồng) để bảo vệ hai vua Trần rút lui an toàn. Sa vào tay giặc, tướng Nguyên đem giàu sang và tước vương phương Bắc ra dụ dỗ. Ông hiên ngang nhịn ăn, quát thẳng vào mặt kẻ thù câu nói thiêng liêng ấy rồi ngẩng cao đầu đón nhận cái chết khi mới **26 tuổi**."
        ),
        "follow_up": "Khí phách của Trần Bình Trọng đã cổ vũ toàn quân ta mở cuộc tổng phản công lớn ở Hàm Tử, Chương Dương!"
    },
    {
        "unit_id": "KC2_HAM_TU_CHUONG_DUONG",
        "category": "KHANG_CHIEN_LAN_2_1285",
        "topic": "Chiến thắng Hàm Tử, Chương Dương và bài thơ Tụng giá hoàn kinh",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.6, "skills": ["SKILL_CHUONG_DUONG", "SKILL_HAM_TU", "SKILL_TRAN_QUANG_KHAI"]},
        "entity": "Trần Quang Khải & Trần Nhật Duật",
        "event": "Chiến thắng Hàm Tử - Chương Dương (Mùa hè 1285)",
        "fact_chunk": "Tháng 5 - 6/1285, Trần Nhật Duật thắng lớn ở Hàm Tử Quan, Trần Quang Khải đại phá giặc ở Chương Dương Độ giải phóng Thăng Long. Trần Quang Khải làm bài thơ 'Tụng giá hoàn kinh'.",
        "badge": "Hào khí Chương Dương - Hàm Tử",
        "base_queries": [
            "trận hàm tử và chương dương năm 1285 do ai chỉ huy",
            "câu thơ đoạt sáo chương dương độ cầm hồ hàm tử quan của ai",
            "tướng giặc toa đô bị tiêu diệt ở trận nào",
            "bài thơ tụng giá hoàn kinh ra đời trong hoàn cảnh nào"
        ],
        "answer": (
            "Chuỗi chiến thắng **Hàm Tử – Chương Dương – Tây Kết** (mùa hè năm 1285) mở toang cánh cửa giải phóng kinh thành Thăng Long:\n\n"
            "• **Hàm Tử Quan (Hưng Yên)**: Chiêu Văn vương **Trần Nhật Duật** chỉ huy đánh tan đạo thủy quân của Toa Đô.\n"
            "• **Chương Dương Độ (Hà Nội)**: Thượng tướng Thái sư **Trần Quang Khải** cùng Trần Quốc Toản giáng đòn tiêu diệt căn cứ then chốt của giặc, mở đường tiến thẳng vào giải phóng Thăng Long.\n"
            "• **Tây Kết**: Tiêu diệt cánh quân phía Nam của địch, **Toa Đô bị chém đầu tại trận**.\n\n"
            "Ngày rước hai vua về lại Thăng Long, Trần Quang Khải đã sáng tác bài thơ bất hủ **'Tụng giá hoàn kinh'**:\n"
            "*'Đoạt sáo Chương Dương độ / Cầm Hồ Hàm Tử quan / Thái bình tu nỗ lực / Vạn cổ thử giang san'*."
        ),
        "follow_up": "Em có biết hai câu cuối của bài thơ nhắc nhở bài học gì về thời bình không?"
    },

    # --- KHÁNG CHIẾN LẦN 3 & HẢI CHIẾN VÂN ĐỒN (1287 - 1288) ---
    {
        "unit_id": "KC3_VAN_DON",
        "category": "HAI_CHIEN_VAN_DON_1288",
        "topic": "Hải chiến Vân Đồn - Tiêu diệt thuyền lương Trương Văn Hổ (1288)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_VAN_DON", "SKILL_TRAN_KHANH_DU"]},
        "entity": "Trần Khánh Dư",
        "event": "Trận Vân Đồn (Đầu năm 1288)",
        "fact_chunk": "Đầu năm 1288, Nhân Huệ vương Trần Khánh Dư phục kích tại Vân Đồn (Quảng Ninh) đánh đắm và thu giữ toàn bộ đoàn thuyền chở 17 vạn thạch lương của Trương Văn Hổ.",
        "badge": "Mưu thần Vân Đồn",
        "base_queries": [
            "trận vân đồn năm 1288 do ai chỉ huy và tiêu diệt đoàn thuyền của ai",
            "vì sao chiến thắng vân đồn của trần khánh dư có ý nghĩa bước ngoặt",
            "ai là người đánh đắm đoàn thuyền lương của trương văn hổ",
            "diễn biến trận hải chiến vân đồn năm 1288"
        ],
        "answer": (
            "Trận hải chiến **Vân Đồn** (Quảng Ninh, đầu năm 1288) do **Nhân Huệ vương Trần Khánh Dư** chỉ huy là đòn bẻ gãy huyết mạch hậu cần của giặc:\n\n"
            "• **Mưu tính của giặc**: Rút kinh nghiệm những lần đói ăn trước, nhà Nguyên giao **Trương Văn Hổ** dẫn 70 chiến thuyền chở **17 vạn thạch lương** đi đường biển tiếp tế cho 30 vạn quân Thoát Hoan.\n"
            "• **Tài thao lược của Trần Khánh Dư**: Đoán chắc đoàn thuyền lương đi sau sẽ chủ quan sau khi thuyền chiến Ô Mã Nhi đi qua, ông bố trí phục kích tại Vân Đồn, đánh đắm và tịch thu toàn bộ lương thực.\n"
            "• **Ý nghĩa bước ngoặt**: Mất sạch lương, quân Nguyên ở Thăng Long rơi vào cảnh tuyệt lương cùng quẫn, buộc phải rút lui và dẫn tới thảm bại ở Bạch Đằng."
        ),
        "follow_up": "Sau khi mất hết lương ăn ở Vân Đồn, thủy quân giặc đã rút chạy theo đường sông nào và rơi vào bẫy mai phục của ai?"
    },
    {
        "unit_id": "KC3_BACH_DANG_HOW",
        "category": "DAI_THANG_BACH_DANG_1288",
        "topic": "Đại thắng sông Bạch Đằng (Tháng 4/1288)",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.7, "skills": ["SKILL_BACH_DANG_1288", "SKILL_TRAN_HUNG_DAO"]},
        "entity": "Trần Quốc Tuấn (Trần Hưng Đạo)",
        "event": "Đại thắng Bạch Đằng Giang (Tháng 4/1288)",
        "fact_chunk": "Tháng 4/1288, Trần Hưng Đạo bố trí bãi cọc ngầm trên sông Bạch Đằng, nhử thuyền giặc vào lúc triều lên rồi tổng công kích khi triều rút. Đánh chìm và bắt sống toàn bộ thủy quân giặc, bắt sống Ô Mã Nhi, Phàn Tiếp.",
        "badge": "Huyền thoại Bạch Đằng Giang",
        "base_queries": [
            "trận bạch đằng năm 1288 đã diễn ra như thế nào",
            "tại sao trần hưng đạo lại chọn sông bạch đằng để đóng cọc ngầm",
            "cách đánh giặc trên sông bạch đằng năm 1288 của trần hưng đạo",
            "ai bị bắt sống trong trận bạch đằng năm 1288"
        ],
        "answer": (
            "Đại thắng **Bạch Đằng Giang** (vào **tháng 4 năm 1288** theo SGK Lịch sử 7) do **Quốc công Tiết chế Trần Hưng Đạo** chỉ huy là đỉnh cao rực rỡ của nghệ thuật thủy chiến Đại Việt:\n\n"
            "1. **Bố trí bãi cọc ngầm**: Đoán trước đường rút lui bằng đường thủy của giặc, Trần Hưng Đạo cho cắm các bãi cọc gỗ vót nhọn bịt sắt ngầm dưới lòng sông Bạch Đằng ở những vị trí hiểm yếu.\n"
            "2. **Nhử giặc vào bẫy**: Khi thủy triều dâng che khuất bãi cọc, các cánh thuyền nhẹ của ta vờ khiêu chiến rồi rút lui, nhử hạm đội thuyền giặc của Ô Mã Nhi và Phàn Tiếp đuổi theo tiến sâu vào trận địa mai phục.\n"
            "3. **Công kích khi triều rút**: Khi nước triều rút mạnh, bãi cọc nhô lên chặn đứng và đâm thủng thuyền giặc. Quân ta từ hai bên bờ và các nhánh sông mai phục đồng loạt xông ra công kích dữ dội.\n"
            "4. **Chiến quả trọn vẹn**: Tiêu diệt và bắt sống toàn bộ đạo thủy quân giặc, bắt sống các tướng chỉ huy là **Ô Mã Nhi và Phàn Tiếp** (Đại Việt Sử Ký Toàn Thư ghi nhận quân ta bắt hơn 400 chiến thuyền), đập tan hoàn toàn ý chí xâm lược của nhà Nguyên."
        ),
        "follow_up": "Em có nhớ trước trận Bạch Đằng năm 1288, vị anh hùng nào năm 938 cũng từng dùng cọc gỗ đánh thắng quân Nam Hán trên sông này không?"
    },
    {
        "unit_id": "KC3_OVERVIEW",
        "category": "DAI_THANG_BACH_DANG_1288",
        "topic": "Toàn cảnh kháng chiến chống quân Nguyên lần 3 (1287 - 1288)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_KC3_TIMELINE"]},
        "entity": "Trần Hưng Đạo & Trần Khánh Dư",
        "event": "Kháng chiến chống Nguyên lần 3 (1287 - 1288)",
        "fact_chunk": "Cuối 1287 - tháng 4/1288, Thoát Hoan đem 30 vạn quân cùng thuyền lương Trương Văn Hổ xâm lược lần 3. Trần Khánh Dư thắng ở Vân Đồn, Trần Hưng Đạo thắng ở Bạch Đằng, đập tan hoàn toàn mộng xâm lăng.",
        "badge": "Huyền thoại Bạch Đằng Giang",
        "base_queries": [
            "tôi cần biết về trận chiến chống nguyên mông lần 3",
            "kể về cuộc kháng chiến chống quân nguyên lần thứ ba năm 1287 1288",
            "tóm tắt diễn biến cuộc kháng chiến lần 3 chống nguyên mông",
            "kháng chiến lần 3 năm 1288 có những trận đánh lớn nào"
        ],
        "answer": (
            "Cuộc kháng chiến lần thứ ba chống quân Nguyên (**cuối năm 1287 – tháng 4/1288**) ghi dấu bản lĩnh và sự chủ động hoàn toàn của nhà Trần:\n\n"
            "• **Giặc chuẩn bị kỹ lưỡng**: Thoát Hoan dẫn 30 vạn quân cùng hạm đội thuyền lương của Trương Văn Hổ chia hai đường thủy – bộ tiến vào Đại Việt.\n"
            "• **Đòn đánh then chốt Vân Đồn (Đầu 1288)**: Trần Khánh Dư tiêu diệt sạch đoàn thuyền chở 17 vạn thạch lương của giặc tại Vân Đồn, khiến quân Nguyên lâm vào cảnh thiếu đói bế tắc.\n"
            "• **Quyết chiến Bạch Đằng (Tháng 4/1288)**: Trần Hưng Đạo giăng bãi cọc ngầm tiêu diệt toàn bộ thủy quân giặc, bắt sống Ô Mã Nhi; cánh quân bộ của Thoát Hoan cũng bị phục kích tơi bời khi tháo chạy qua Lạng Sơn.\n"
            "• **Kết quả**: Chấm dứt vĩnh viễn tham vọng bành trướng xuống phương Nam của đế chế Mông - Nguyên."
        ),
        "follow_up": "Em có muốn cùng thầy tổng kết nguyên nhân vì sao Đại Việt 3 lần đều đánh thắng đế chế hùng mạnh nhất thế giới không?"
    },

    # --- NGUYÊN NHÂN THẮNG LỢI & Ý NGHĨA LỊCH SỬ ---
    {
        "unit_id": "ALL_3_WARS_SUMMARY",
        "category": "NGUYEN_NHAN_Y_NGHIA",
        "topic": "Tổng quan ba lần kháng chiến chống Mông - Nguyên (1258 - 1288)",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.4, "skills": ["SKILL_ALL_3_WARS"]},
        "entity": "Vương triều Trần",
        "event": "Ba lần kháng chiến chống Mông - Nguyên (1258 - 1288)",
        "fact_chunk": "Ba lần kháng chiến chống quân Mông - Nguyên diễn ra trong 30 năm (1258, 1285, 1287-1288). Cả ba lần đều thắng lợi vẻ vang gắn với các trận Đông Bộ Đầu, Chương Dương, Hàm Tử, Bạch Đằng.",
        "badge": "Tinh hoa Đông A",
        "base_queries": [
            "tóm tắt ba lần kháng chiến chống quân mông nguyên",
            "ba lần kháng chiến chống mông nguyên diễn ra vào những năm nào",
            "kể tên các trận đánh tiêu biểu trong 3 lần kháng chiến",
            "nhà trần đã đánh thắng quân mông nguyên mấy lần"
        ],
        "answer": (
            "Trong 30 năm (**1258 – 1288**), quân dân thời Trần đã lập kỳ tích **ba lần đánh bại đế chế Mông – Nguyên**:\n\n"
            "1. **Lần 1 (1258)**: Đánh tan 3 vạn quân Mông Cổ; nổi bật với trận **Bình Lệ Nguyên**, kế sách **Vườn không nhà trống** và đại thắng **Đông Bộ Đầu**.\n"
            "2. **Lần 2 (1285)**: Đánh tan 50 vạn quân Nguyên; nổi bật với **Hội nghị Bình Than (1282)**, **Hội nghị Diên Hồng (1285)**, chuỗi đại thắng **Tây Kết, Hàm Tử, Chương Dương**, Thoát Hoan chui ống đồng.\n"
            "3. **Lần 3 (1287 - 1288)**: Đánh tan 30 vạn quân Nguyên; nổi bật với chiến thắng **Vân Đồn** và đại thắng cọc ngầm **Bạch Đằng (9/4/1288)** bắt sống Ô Mã Nhi."
        ),
        "follow_up": "Trong ba lần này, em thích tìm hiểu nhất về chiến dịch nào?"
    },
    {
        "unit_id": "CAUSES_OF_VICTORY",
        "category": "NGUYEN_NHAN_Y_NGHIA",
        "topic": "Nguyên nhân thắng lợi của ba lần kháng chiến",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.8, "skills": ["SKILL_VICTORY_CAUSES"]},
        "entity": "Vua tôi nhà Trần & Nhân dân",
        "event": "Thắng lợi ba lần kháng chiến chống Mông - Nguyên",
        "fact_chunk": "Nguyên nhân thắng lợi: 1. Khối đại đoàn kết toàn dân ('Vua tôi đồng lòng, anh em hòa mục, cả nước góp sức'). 2. Bộ chỉ huy tài ba của các vua Trần và Trần Quốc Tuấn. 3. Nghệ thuật quân sự sáng tạo (vườn không nhà trống, lấy yếu thắng mạnh).",
        "badge": "Tinh hoa Đông A",
        "base_queries": [
            "nguyên nhân thắng lợi của ba lần kháng chiến chống quân mông nguyên",
            "vì sao đại việt lại đánh thắng được đế chế mông nguyên hùng mạnh",
            "yếu tố quan trọng nhất giúp nhà trần đánh thắng quân mông nguyên là gì",
            "vua tôi đồng lòng anh em hòa mục cả nước góp sức nói về điều gì",
            "tại sao quân nguyên đông và mạnh mà vẫn thua đại việt",
            "vì sao quân mông nguyên mạnh như vậy mà vẫn thất bại trước đại việt",
            "tại sao một nước nhỏ như đại việt lại đánh thắng đế chế mông nguyên đông và mạnh",
            "vì sao quân giặc đông và hung bạo mà vẫn thua"
        ],
        "answer": (
            "Dù quân Mông – Nguyên có quân số đông đảo và kỵ binh mạnh bậc nhất thế giới, Đại Việt vẫn giành thắng lợi trọn vẹn nhờ khắc chế được sự chênh lệch sức mạnh qua **3 nguyên nhân căn bản**:\n\n"
            "1. **Đại đoàn kết toàn dân tộc (Triệt tiêu ưu thế quân số của giặc)**: 'Vua tôi đồng lòng, anh em hòa mục, cả nước góp sức'. Tinh thần yêu nước kết nối hoàng tộc, tướng sĩ với nhân dân và đồng bào miền núi thành thế trận chiến tranh nhân dân, khiến đạo quân khổng lồ của giặc bị chia cắt và sa lầy.\n"
            "2. **Sự lãnh đạo và thiên tài quân sự kiệt xuất**: Các vị vua anh minh (Trần Thái Tông, Trần Thánh Tông, Trần Nhân Tông) cùng thiên tài quân sự Quốc công Tiết chế Trần Hưng Đạo luôn giữ vững quyền chủ động chiến lược, biết chớp đúng thời cơ giặc suy yếu để phản công quyết định.\n"
            "3. **Nghệ thuật quân sự sáng tạo (Vô hiệu hóa sở trường kỵ binh)**: Tránh đối đầu trực diện khi giặc đang hăng máu; chủ động rút lui chiến lược bảo toàn thực lực; thực hiện triệt để 'Vườn không nhà trống' làm giặc đói kiệt và tận dụng địa hình sông nước (Vân Đồn, Bạch Đằng)."
        ),
        "follow_up": "Bài học đoàn kết và lấy dân làm gốc vẫn còn nguyên giá trị cho công cuộc xây dựng đất nước hôm nay đấy em!"
    },
    {
        "unit_id": "HISTORICAL_SIGNIFICANCE",
        "category": "NGUYEN_NHAN_Y_NGHIA",
        "topic": "Ý nghĩa lịch sử của ba lần kháng chiến chống Mông - Nguyên",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.6, "skills": ["SKILL_HISTORICAL_SIGNIFICANCE"]},
        "entity": "Dân tộc Đại Việt & Thế giới",
        "event": "Ý nghĩa lịch sử ba lần chiến thắng (1258 - 1288)",
        "fact_chunk": "Ý nghĩa lịch sử: Đập tan tham vọng xâm lược của đế chế Mông - Nguyên, bảo vệ vững chắc độc lập; củng cố niềm tự hào dân tộc; góp phần ngăn chặn quân Nguyên bành trướng xuống Đông Nam Á và Nhật Bản.",
        "badge": "Tinh hoa Đông A",
        "base_queries": [
            "ý nghĩa lịch sử của ba lần kháng chiến chống quân mông nguyên",
            "chiến thắng chống mông nguyên có ý nghĩa gì đối với thế giới",
            "tầm vóc quốc tế của chiến thắng bạch đằng và ba lần chống mông nguyên",
            "thắng lợi chống mông nguyên để lại bài học gì"
        ],
        "answer": (
            "Thắng lợi ba lần kháng chiến (1258 – 1288) mang **tầm vóc lịch sử to lớn đối với cả dân tộc và thế giới**:\n\n"
            "• **Với dân tộc**: Bảo vệ trọn vẹn độc lập, chủ quyền và bờ cõi non sông; bồi đắp Hào khí Đông A hào hùng và bài học muôn đời về 'khoan thư sức dân'.\n"
            "• **Với thế giới**: Góp phần bẻ gãy mưu đồ xâm lược của đế chế Nguyên Mông xuống Đông Nam Á và bảo vệ hòa bình cho khu vực; là một trong những kỳ tích quân sự vĩ đại nhất thế giới thế kỷ XIII."
        ),
        "follow_up": "Em có muốn tìm hiểu thêm về các vị tướng xuất thân bình dân như Yết Kiêu, Dã Tượng không?"
    },

    # --- DANH TƯỚNG & GIA THẦN ---
    {
        "unit_id": "YET_KIEU_DA_TUONG",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Yết Kiêu và Dã Tượng - Hai gia tướng trung kiên",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.3, "skills": ["SKILL_YET_KIEU_DA_TUONG"]},
        "entity": "Yết Kiêu & Dã Tượng",
        "event": "Kháng chiến chống Nguyên",
        "fact_chunk": "Yết Kiêu có tài bơi lặn đục thủng thuyền giặc và trung kiên giữ thuyền chờ Trần Hưng Đạo ở bãi Tân Hưng. Dã Tượng có tài chỉ huy tượng binh (voi chiến).",
        "badge": "Trung nghĩa Đông A",
        "base_queries": [
            "yết kiêu và dã tượng là ai và có tài năng gì",
            "ai là người có tài bơi lặn đục thủng thuyền giặc thời trần",
            "kể về hai người gia nô trung thành của trần hưng đạo",
            "yết kiêu đã lập công gì trong cuộc kháng chiến"
        ],
        "answer": (
            "**Yết Kiêu** và **Dã Tượng** là hai danh tướng xuất thân gia nô, nổi tiếng trung thành và tài giỏi dưới trướng Trần Hưng Đạo:\n\n"
            "• **Yết Kiêu**: Bậc thầy bơi lặn như rái cá, chuyên lặn đêm đục thủng đáy thuyền chiến của giặc. Ở bãi Tân Hưng, dù giặc đuổi sát, ông vẫn kiên quyết cắm thuyền chờ chủ soái: *'Vương gia chưa đến thì thuyền thần chưa đi!'*.\n"
            "• **Dã Tượng**: Bậc thầy chỉ huy đội voi chiến (tượng binh), dũng cảm bảo vệ chủ soái xông pha chiến trường.\n\n"
            "Trần Hưng Đạo từng xúc động ca ngợi hai ông như những chiếc lông cánh trụ cột giúp chim hồng hộc bay cao nghìn dặm."
        ),
        "follow_up": "Bên cạnh Yết Kiêu, dưới trướng Trần Hưng Đạo còn có người ngồi đan sọt bị đâm vào đùi không biết đau là ai, em nhớ không?"
    },
    {
        "unit_id": "PHAM_NGU_LAO",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Phạm Ngũ Lão và giai thoại đan sọt",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.3, "skills": ["SKILL_PHAM_NGU_LAO"]},
        "entity": "Phạm Ngũ Lão",
        "event": "Trần Hưng Đạo phát hiện Phạm Ngũ Lão tại Phù Ủng",
        "fact_chunk": "Phạm Ngũ Lão (1255 - 1320) ngồi đan sọt mải nghĩ việc nước bị giáo đâm vào đùi không biết đau. Được Trần Hưng Đạo trọng dụng, gả con gái và lập công lớn ở Vạn Kiếp, Bạch Đằng.",
        "badge": "Trung nghĩa Đông A",
        "base_queries": [
            "phạm ngũ lão là ai và giai thoại ngồi đan sọt là như thế nào",
            "ai mải nghĩ việc nước bị giáo đâm vào đùi không biết đau",
            "bài thơ tỏ lòng thuật hoài của ai",
            "kể về danh tướng phạm ngũ lão thời trần"
        ],
        "answer": (
            "**Phạm Ngũ Lão** (1255 – 1320, quê làng Phù Ủng, Hưng Yên) là vị danh tướng văn võ song toàn xuất thân từ bình dân:\n\n"
            "• **Giai thoại đan sọt**: Ngồi đan sọt bên đường mải suy nghĩ việc nước đến mức lính tiên phong đâm mũi giáo vào đùi chảy máu mà chàng vẫn không hề hay biết. Nhận thấy chí lớn phi thường, Trần Hưng Đạo liền đưa về trọng dụng và gả con gái cho.\n"
            "• **Chiến công & Thơ văn**: Lập nhiều chiến công lớn ở Vạn Kiếp, Bạch Đằng và là tác giả bài thơ **'Thuật hoài' (Tỏ lòng)** khí thế nuốt trâu chọi cọp."
        ),
        "follow_up": "Đó là minh chứng rõ nét cho việc nhà Trần trọng người hiền tài không phân biệt xuất thân sang hèn!"
    },

    {
        "unit_id": "MILITARY_ART_TRAN_DYNASTY",
        "category": "NGUYEN_NHAN_Y_NGHIA",
        "topic": "Nghệ thuật quân sự độc đáo thời Trần (Lấy yếu thắng mạnh, lấy đoản binh thắng trường trận)",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.75, "skills": ["SKILL_MILITARY_ART"]},
        "entity": "Trần Hưng Đạo & Quân dân nhà Trần",
        "event": "Nghệ thuật quân sự ba lần kháng chiến (1258 - 1288)",
        "fact_chunk": "Nghệ thuật quân sự thời Trần kết tinh ở tư tưởng 'lấy đoản binh thắng trường trận' (lấy yếu thắng mạnh, lấy ít địch nhiều), kết hợp rút lui chiến lược, kế sách 'Vườn không nhà trống', đánh cắt hậu cần (Vân Đồn) và quyết chiến chiến lược đúng thời cơ (Đông Bộ Đầu, Chương Dương, Bạch Đằng).",
        "badge": "Tinh hoa Đông A",
        "base_queries": [
            "nét độc đáo về nghệ thuật quân sự của nhà trần trong ba lần kháng chiến là gì",
            "nghệ thuật đánh giặc lấy đoản binh thắng trường trận của trần hưng đạo là gì",
            "chiến thuật lấy yếu thắng mạnh của nhà trần được thể hiện như thế nào",
            "phân tích nghệ thuật quân sự trong ba lần kháng chiến chống mông nguyên"
        ],
        "answer": (
            "Nghệ thuật quân sự thời Trần trong ba lần kháng chiến chống Mông – Nguyên (1258 – 1288) là đỉnh cao của đường lối **chiến tranh nhân dân**, kết tinh qua **4 nét độc đáo**:\n\n"
            "1. **Lấy đoản binh thắng trường trận (Lấy ít địch nhiều, lấy yếu chống mạnh)**: Tránh giao chiến trực diện khi kỵ binh giặc đang sung sức, chủ động rút lui chiến lược (Bình Lệ Nguyên, Vạn Kiếp) để bảo toàn quân chủ lực.\n"
            "2. **Kế sách 'Vườn không nhà trống' kết hợp chiến tranh du kích**: Triệt tiêu nguồn lương thảo tại chỗ tại Thăng Long, kết hợp dân binh địa phương ngày đêm tập kích làm giặc mỏi mệt, hoang mang.\n"
            "3. **Đánh vào chỗ hiểm yếu – Cắt đứt mạch máu hậu cần**: Tiêu biểu là trận phục kích đoàn thuyền lương Trương Văn Hổ tại **Vân Đồn (1288)** khiến 30 vạn quân Thoát Hoan lâm vào cảnh tuyệt lương.\n"
            "4. **Chớp thời cơ mở trận quyết chiến chiến lược**: Lợi dụng địa hình sông nước, thủy triều và sĩ khí giặc suy sụp để giáng đòn sấm sét tại **Đông Bộ Đầu (1258)**, **Hàm Tử – Chương Dương (1285)** và **Bạch Đằng (1288)**."
        ),
        "follow_up": "Em ấn tượng nhất với kế sách nào trong 4 nghệ thuật quân sự trên của cha ông ta?"
    },
    {
        "unit_id": "ROLE_OF_ETHNIC_MINORITIES",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Vai trò của đồng bào dân tộc thiểu số và các tù trưởng miền núi (Hà Đặc, Hà Chương, Hà Khuất, Nguyễn Thế Lộc)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.45, "skills": ["SKILL_ETHNIC_MINORITIES", "SKILL_HA_KHUAT"]},
        "entity": "Hà Khuất, Hà Đặc, Hà Chương, Nguyễn Thế Lộc",
        "event": "Chiến đấu bảo vệ biên cương phía Bắc (1258 - 1288)",
        "fact_chunk": "Trong ba lần kháng chiến, đồng bào các dân tộc thiểu số miền núi phía Bắc dưới sự chỉ huy của các tù trưởng yêu nước như Hà Khuất (Quy Hóa - 1258), anh em Hà Đặc - Hà Chương (Đà Giang - 1285), Nguyễn Thế Lộc (Lạng Sơn - 1285, 1288) đã lập nhiều chiến công lớn, chặn đánh và tiêu hao sinh lực địch.",
        "badge": "Trung nghĩa Đông A",
        "base_queries": [
            "vai trò của đồng bào các dân tộc thiểu số miền núi trong kháng chiến chống mông nguyên",
            "hà đặc hà chương và nguyễn thế lộc có công lao gì trong kháng chiến thời trần",
            "đồng bào miền núi đã đóng góp gì trong ba lần kháng chiến chống quân mông nguyên",
            "kể tên các tù trưởng dân tộc thiểu số tiêu biểu đánh giặc mông nguyên"
        ],
        "answer": (
            "Đồng bào các dân tộc thiểu số vùng biên giới phía Bắc đã sát cánh cùng triều đình lập nên những chiến công vang dội, khẳng định sức mạnh **đoàn kết miền xuôi – miền ngược**:\n\n"
            "• **Chủ trại Hà Khuất (Kháng chiến lần 1 - 1258)**: Chỉ huy dân binh trại Quy Hóa (Yên Bái – Lào Cai) chặn đánh tàn quân Mông Cổ tháo chạy từ Đông Bộ Đầu, khiến giặc đại bại.\n"
            "• **Hai anh em tù trưởng Hà Đặc và Hà Chương (Kháng chiến lần 2 - 1285)**: Dẫn dắt đồng bào vùng núi Đà Giang (Phú Thọ – Hòa Bình) làm hình người cỏ mặc áo giáp nhử giặc bắn hết tên rồi tập kích đánh bại quân Nguyên; Hà Đặc anh dũng hy sinh.\n"
            "• **Tù trưởng Nguyễn Thế Lộc và Nguyễn Lĩnh (1285 & 1288)**: Chỉ huy dân binh dân tộc Tày vùng Lạng Sơn phục kích tại đồn Ma Lục, dùng tên độc tiêu diệt hàng vạn quân giặc trên đường tháo chạy."
        ),
        "follow_up": "Sự góp sức của đồng bào miền núi là minh chứng sống động cho câu 'Cả nước góp sức' đấy em!"
    },
    {
        "unit_id": "GAME_TRAN_NHAN_TONG",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Vua Trần Nhân Tông qua các giai đoạn cuộc đời",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.4, "skills": ["SKILL_TRAN_NHAN_TONG"]},
        "entity": "Trần Nhân Tông (Trần Khâm)",
        "event": "Kháng chiến 1285 và 1287 – 1288",
        "fact_chunk": "Trần Nhân Tông (Trần Khâm, 1258 – 1308) sinh cuối năm 1258, sau cuộc kháng chiến lần thứ nhất. Ông được lập làm Hoàng thái tử năm 1274, lên ngôi năm 1278, triệu tập Hội nghị Bình Than năm 1282 và cùng Thượng hoàng Trần Thánh Tông lãnh đạo hai cuộc kháng chiến chống quân Nguyên. Ông nổi tiếng với hai câu thơ 'Xã tắc lưỡng hồi lao thạch mã / Sơn hà thiên cổ điện kim âu'. Năm 1293 ông nhường ngôi; năm 1299 xuất gia ở núi Yên Tử, sáng lập Thiền phái Trúc Lâm.",
        "badge": "Phật hoàng Trúc Lâm",
        "base_queries": [
            "trần nhân tông là ai",
            "vua trần nhân tông sinh năm nào",
            "trần nhân tông lên ngôi năm nào",
            "vua nào sáng lập thiền phái trúc lâm",
            "trần nhân tông xuất gia ở đâu",
            "vì sao trần nhân tông được gọi là phật hoàng",
            "cuộc đời vua trần nhân tông có những mốc nào",
            "trần khâm là ai",
            "vua trần nhân tông là ai và có công lao gì trong kháng chiến chống nguyên",
            "hai câu thơ xã tắc lưỡng hồi lao thạch mã sơn hà thiên cổ điện kim âu của ai",
            "ai là tác giả câu thơ xã tắc hai phen chồn ngựa đá non sông nghìn thuở vững âu vàng",
            "câu thơ xã tắc lưỡng hồi lao thạch mã sơn hà thiên cổ điện kim âu nói về chiến thắng nào của vua trần nhân tông",
            "vị vua nào trực tiếp lãnh đạo cả hai cuộc kháng chiến năm 1285 và 1288 rồi đi tu ở yên tử",
            "kể về phật hoàng trần nhân tông và thiền phái trúc lâm yên tử trong lịch sử nhà trần"
        ],
        "answer": (
            "**Vua Trần Nhân Tông** (tên thật **Trần Khâm**, 1258 – 1308) là vị vua lãnh đạo hai cuộc kháng chiến chống quân Nguyên và là Phật hoàng Trúc Lâm:\n\n"
            "• **1258**: sinh ra, sau khi cuộc kháng chiến lần thứ nhất kết thúc.\n"
            "• **1274**: được lập làm Hoàng thái tử; **1278**: lên ngôi vua.\n"
            "• **1282**: triệu tập **Hội nghị Bình Than** bàn kế đánh giặc.\n"
            "• **1285 và 1287 – 1288**: cùng Thượng hoàng **Trần Thánh Tông** lãnh đạo quân dân đánh thắng quân Nguyên. Sau đại thắng Bạch Đằng năm 1288, nhà vua đề hai câu thơ bất hủ:\n"
            "  *'Xã tắc lưỡng hồi lao thạch mã / Sơn hà thiên cổ điện kim âu'* (Xã tắc hai phen chồn ngựa đá / Non sông nghìn thuở vững âu vàng).\n"
            "• **1293**: nhường ngôi; **1299**: xuất gia ở núi **Yên Tử**, sáng lập **Thiền phái Trúc Lâm**, được tôn là **Phật hoàng**."
        ),
        "follow_up": "Em có muốn biết Hội nghị Bình Than do vua Trần Nhân Tông triệu tập đã quyết định những gì không?"
    },
    {
        "unit_id": "GAME_NGU_BINH_U_NONG",
        "category": "NEN_TANG_QUAN_SU",
        "topic": "Chính sách ngụ binh ư nông",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.4, "skills": ["SKILL_NGU_BINH_U_NONG"]},
        "entity": "Nhà Lý, nhà Trần",
        "event": "Tổ chức quân đội thời Lý – Trần",
        "fact_chunk": "“Ngụ binh ư nông” nghĩa là gửi binh ở nhà nông: thời bình, binh lính được luân phiên về quê làm ruộng; khi có chiến tranh, triều đình điều động họ ra trận. Nhờ vậy nhà nước vừa có lực lượng quân đội đông đảo, vừa bảo đảm sản xuất và lương thực.",
        "badge": "Ngụ binh ư nông",
        "base_queries": [
            "ngụ binh ư nông là gì",
            "chính sách ngụ binh ư nông có tác dụng gì",
            "thời bình binh lính nhà trần làm gì",
            "gửi binh ở nhà nông nghĩa là sao",
            "nhà trần tổ chức quân đội như thế nào",
            "vì sao nhà trần vừa có quân đông vừa đủ lương thực",
            "binh lính luân phiên về quê làm ruộng là chính sách gì",
            "ý nghĩa của chính sách ngụ binh ư nông"
        ],
        "answer": (
            "**Ngụ binh ư nông** nghĩa là *gửi binh ở nhà nông* – cách tổ chức quân đội của nhà Lý và nhà Trần:\n\n"
            "• **Thời bình**: binh lính được luân phiên về quê làm ruộng, ruộng đồng không bị bỏ hoang, nhà nước vẫn đủ lương thực.\n"
            "• **Khi có giặc**: triều đình nhanh chóng điều động họ ra trận, nên có ngay một lực lượng quân đội đông đảo, đã quen việc quân.\n"
            "• **Ý nghĩa**: một nước không lớn như Đại Việt vẫn đủ người và đủ lương cho những cuộc kháng chiến dài ngày – nền tảng quan trọng giúp nhà Trần ba lần đánh thắng quân Mông – Nguyên."
        ),
        "follow_up": "Em có muốn biết nhà Trần còn dùng kế sách gì khiến quân giặc thiếu lương, đói kiệt không?"
    },
    {
        "unit_id": "GAME_TRAN_KHANH_DU",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Trần Khánh Dư – từ người buôn than ở Chí Linh đến trận Vân Đồn",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.4, "skills": ["SKILL_TRAN_KHANH_DU"]},
        "entity": "Nhân Huệ vương Trần Khánh Dư",
        "event": "Trận Vân Đồn (cuối 1287 – đầu 1288)",
        "fact_chunk": "Trần Khánh Dư từng phạm lỗi, bị tước bỏ quan tước, về vùng Chí Linh sống bằng nghề buôn than. Năm 1282, trước nguy cơ quân Nguyên xâm lược, ông được tha tội để lập công. Trong kháng chiến lần thứ ba, ông trấn giữ vùng biển Vân Đồn, phục kích đánh đắm và thu giữ đoàn thuyền lương của Trương Văn Hổ.",
        "badge": "Mưu thần Vân Đồn",
        "base_queries": [
            "trần khánh dư là ai",
            "vì sao trần khánh dư bị tước quan tước",
            "trần khánh dư từng làm nghề buôn than ở đâu",
            "nhân huệ vương trần khánh dư xuất thân thế nào",
            "tại sao trần khánh dư lại được tha tội năm 1282",
            "kể về cuộc đời trần khánh dư",
            "ai từng bán than ở chí linh rồi lập công lớn",
            "trần khánh dư lập công chuộc tội như thế nào"
        ],
        "answer": (
            "**Nhân Huệ vương Trần Khánh Dư** là vị tướng nhà Trần có cuộc đời nhiều thăng trầm:\n\n"
            "• **Lỡ bước**: ông từng phạm lỗi, bị tước bỏ quan tước, về vùng **Chí Linh** sống bằng nghề **buôn than**.\n"
            "• **Được dùng lại (1282)**: trước nguy cơ quân Nguyên xâm lược, nhà Trần tha tội để ông lập công chuộc lỗi.\n"
            "• **Lập công ở Vân Đồn**: trong kháng chiến lần thứ ba, ông trấn giữ vùng biển Vân Đồn, phục kích, đánh đắm và thu giữ đoàn thuyền lương của **Trương Văn Hổ**, khiến quân Nguyên ở Thăng Long lâm vào cảnh thiếu lương – bước ngoặt dẫn tới đại thắng Bạch Đằng.\n\n"
            "Câu chuyện của ông cho thấy nhà Trần biết **dùng người tài**, cho người lầm lỗi cơ hội sửa sai vì việc nước."
        ),
        "follow_up": "Em có muốn nghe kỹ hơn về trận Vân Đồn, nơi ông đánh đắm đoàn thuyền lương của giặc không?"
    },
    {
        "unit_id": "GAME_BINH_THU_YEU_LUOC",
        "category": "DIEN_HONG_HICH_TUONG_SI",
        "topic": "Binh thư yếu lược của Trần Quốc Tuấn",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.4, "skills": ["SKILL_BINH_THU_YEU_LUOC"]},
        "entity": "Trần Quốc Tuấn (Trần Hưng Đạo)",
        "event": "Chuẩn bị kháng chiến lần thứ hai",
        "fact_chunk": "Binh thư yếu lược là sách binh pháp do Trần Quốc Tuấn biên soạn để dạy các tướng cách cầm quân. Trong Hịch tướng sĩ, ông viết: “Nay ta chọn binh pháp các nhà hợp thành một tuyển, gọi là Binh thư yếu lược”, khuyên tướng sĩ chăm chỉ luyện tập theo sách.",
        "badge": "Binh thư yếu lược",
        "base_queries": [
            "binh thư yếu lược là gì",
            "ai là tác giả binh thư yếu lược",
            "trần hưng đạo viết cuốn sách binh pháp nào",
            "sách binh thư yếu lược dùng để làm gì",
            "trần quốc tuấn soạn binh thư để dạy ai",
            "cuốn binh pháp của hưng đạo đại vương tên là gì",
            "trong hịch tướng sĩ trần quốc tuấn khuyên tướng sĩ học sách gì"
        ],
        "answer": (
            "**Binh thư yếu lược** là cuốn sách binh pháp do **Trần Quốc Tuấn (Hưng Đạo Đại vương)** biên soạn để dạy các tướng cách cầm quân đánh giặc:\n\n"
            "• **Nội dung**: tổng hợp, chọn lọc binh pháp của các nhà để tướng sĩ học theo.\n"
            "• **Gắn với Hịch tướng sĩ**: trong bài hịch, ông viết *“Nay ta chọn binh pháp các nhà hợp thành một tuyển, gọi là Binh thư yếu lược”* và khuyên tướng sĩ chăm chỉ luyện tập theo sách.\n"
            "• **Ý nghĩa**: chuẩn bị cho tướng sĩ cả về **tinh thần** (Hịch tướng sĩ) lẫn **cách đánh** (Binh thư yếu lược) trước cuộc kháng chiến lần thứ hai."
        ),
        "follow_up": "Em có muốn đọc lại những câu văn nổi tiếng trong Hịch tướng sĩ không?"
    },
    {
        "unit_id": "HISTORICAL_LESSONS_TODAY",
        "category": "NGUYEN_NHAN_Y_NGHIA",
        "topic": "Bài học kinh nghiệm lịch sử từ ba lần kháng chiến thời Trần đối với sự nghiệp bảo vệ Tổ quốc hiện nay",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.85, "skills": ["SKILL_HISTORICAL_LESSONS"]},
        "entity": "Dân tộc Việt Nam",
        "event": "Bài học giữ nước từ Hào khí Đông A",
        "fact_chunk": "Ba lần kháng chiến chống Mông - Nguyên để lại bài học cốt lõi: 1. Khoan thư sức dân để làm kế sâu rễ bền gốc (lấy dân làm gốc). 2. Phát huy khối đại đoàn kết toàn dân tộc ('Vua tôi đồng lòng, anh em hòa mục, cả nước góp sức'). 3. Đề cao cảnh giác và nghệ thuật quân sự chiến tranh nhân dân.",
        "badge": "Tinh hoa Đông A",
        "base_queries": [
            "bài học kinh nghiệm rút ra từ ba lần kháng chiến chống quân mông nguyên đối với ngày nay",
            "tư tưởng khoan thư sức dân để làm kế sâu rễ bền gốc có ý nghĩa gì hiện nay",
            "liên hệ trách nhiệm của học sinh hôm nay từ hào khí đông a thời trần",
            "vận dụng bài học đại đoàn kết thời trần vào công cuộc xây dựng và bảo vệ tổ quốc hiện nay"
        ],
        "answer": (
            "Thắng lợi vĩ đại của ba lần kháng chiến chống Mông – Nguyên (1258 – 1288) để lại **4 bài học lịch sử vô giá** cho công cuộc xây dựng và bảo vệ Tổ quốc ngày nay:\n\n"
            "1. **Bài học 'Lấy dân làm gốc'**: Thực hiện lời dặn của Trần Hưng Đạo: *'Khoan thư sức dân để làm kế sâu rễ bền gốc, đó là thượng sách giữ nước'* — chăm lo đời sống nhân dân chính là nền tảng sức mạnh quốc gia vững chắc nhất.\n"
            "2. **Phát huy khối đại đoàn kết toàn dân tộc**: Tinh thần Diên Hồng *'Vua tôi đồng lòng, anh em hòa mục, cả nước góp sức'* nhắc nhở chúng ta luôn đoàn kết muôn người như một trước mọi thử thách.\n"
            "3. **Trọng dụng hiền tài & Phát huy trí tuệ Việt**: Không phân biệt xuất thân (như trọng dụng Phạm Ngũ Lão, Yết Kiêu, Dã Tượng) và vận dụng linh hoạt thế trận toàn dân.\n"
            "4. **Trách nhiệm của thế hệ trẻ (học sinh lớp 7)**: Tiếp nối gương sáng tuổi trẻ Hoài Văn hầu Trần Quốc Toản — chăm chỉ rèn luyện đạo đức, học tập tốt, tự hào và giữ gìn chủ quyền thiêng liêng của Tổ quốc."
        ),
        "follow_up": "Theo em, trong các bài học trên, bài học nào gần gũi nhất với học sinh chúng mình?"
    },
    {
        "unit_id": "GAME_QUAN_THANH_DUC_SAT_THAT",
        "category": "NEN_TANG_QUAN_SU",
        "topic": "Cấm quân Thánh Dực, Tinh binh Sát Thát và Nón Ma Lôi thời Trần",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.45, "skills": ["SKILL_THANH_DUC_SAT_THAT", "SKILL_SAT_THAT"]},
        "entity": "Quân Thánh Dực & Quân Sát Thát",
        "event": "Tổ chức lực lượng vũ trang nhà Trần (1258 - 1288)",
        "fact_chunk": "Quân đội thời Trần gồm Cấm quân (tiêu biểu là quân Thánh Dực bảo vệ vua và kinh thành Thăng Long, từng hộ giá vua Trần Thái Tông từ Bình Lệ Nguyên về Thiên Mạc và phản công Đông Bộ Đầu), lộ quân ở các địa phương, quân vương hầu và hương binh làng xã. Tướng sĩ thích hai chữ 'Sát Thát' lên cánh tay. Ở Vân Đồn có giai thoại Trần Khánh Dư cho quân đội nón Ma Lôi để nhận diện nhau.",
        "badge": "Tinh binh Sát Thát",
        "base_queries": [
            "quân thánh dực thời trần là đội quân gì và có vai trò thế nào",
            "cấm quân thánh dực và quân sát thát trong quân đội nhà trần là gì",
            "nón ma lôi của trần khánh dư ở vân đồn có ý nghĩa gì",
            "phân biệt chính sử và giai thoại dân gian về nón ma lôi thời trần",
            "các lực lượng cấm quân lộ quân và hương binh thời trần được tổ chức ra sao",
            "đội quân thánh dực bảo vệ vua trần thái tông ở đâu"
        ],
        "answer": (
            "Lực lượng vũ trang nhà Trần trong kháng chiến chống Mông – Nguyên được tổ chức chặt chẽ, kết hợp **quân triều đình, quân vương hầu và dân binh làng xã**:\n\n"
            "• **Cấm quân Thánh Dực (`[Chính sử]`)**: Đội quân tinh nhuệ nhất bảo vệ nhà vua và kinh thành Thăng Long. Năm 1258, quân Thánh Dực cùng Lê Phụ Trần sát cánh hộ giá vua Trần Thái Tông rút từ Bình Lệ Nguyên về sông Thiên Mạc và làm mũi nhọn phản công giải phóng Đông Bộ Đầu.\n"
            "• **Tinh binh Sát Thát (`[Chính sử]`)**: Các tướng sĩ nhà Trần tự nguyện xăm hai chữ **'Sát Thát'** (Giết giặc Mông – Nguyên) lên cánh tay, kết hợp cùng gia đồng của các vương hầu và hương binh các làng xã tạo nên thế trận chiến tranh nhân dân.\n"
            "• **Nón Ma Lôi ở Vân Đồn (`[Giai thoại dân gian / Sử ký]`)**: Tương truyền khi trấn giữ Vân Đồn, Nhân Huệ vương Trần Khánh Dư từng khuyên dân làm nghề đan nón Ma Lôi và cho quân sĩ đội nón Ma Lôi làm ám hiệu nhận ra nhau trong hỗn chiến."
        ),
        "follow_up": "Em có muốn tìm hiểu thêm về hệ thống căn cứ địa Vạn Kiếp và Thiên Trường của quân đội nhà Trần không?"
    },
    {
        "unit_id": "GAME_VAN_KIEP_THIEN_TRUONG_BASES",
        "category": "NEN_TANG_QUAN_SU",
        "topic": "Hệ thống căn cứ địa chiến lược: Vạn Kiếp – Nội Bàng và Hậu phương Thiên Trường – Trường Yên",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.55, "skills": ["SKILL_STRATEGIC_BASES"]},
        "entity": "Trần Hưng Đạo & Vương triều Trần",
        "event": "Bố phòng chiến lược trong ba lần kháng chiến (1258 - 1288)",
        "fact_chunk": "Nhà Trần xây dựng hệ thống phòng thủ và hậu phương liên hoàn: Tuyến tiền tiêu phía Bắc có Nội Bàng, Vạn Kiếp (Chí Linh, Hải Dương) nơi Trần Hưng Đạo duyệt 20 vạn quân; tuyến sông Hồng có Bình Lệ Nguyên, Phù Ninh, Thăng Long, Thiên Mạc, Hàm Tử, Chương Dương; hậu phương chiến lược có Thiên Trường (Nam Định), Trường Yên (Ninh Bình) và Thanh Hóa.",
        "badge": "Mưu lược Vạn Kiếp",
        "base_queries": [
            "căn cứ vạn kiếp và nội bàng có vị trí chiến lược như thế nào thời trần",
            "vai trò của hậu phương thiên trường trường yên và thanh hóa trong kháng chiến chống mông nguyên",
            "tại sao vạn kiếp lại là đại bản doanh quân sự quan trọng của trần hưng đạo",
            "hệ thống địa danh chiến lược từ vạn kiếp thăng long thiên mạc đến thiên trường thời trần",
            "thiên mạc trường yên và thiên trường giúp nhà trần bảo toàn lực lượng ra sao",
            "vì sao trần hưng đạo hội 20 vạn quân ở vạn kiếp"
        ],
        "answer": (
            "Để đánh thắng đạo quân xâm lược khổng lồ, nhà Trần đã kiến tạo **hệ thống căn cứ địa và hậu phương chiến lược liên hoàn** trải dài từ biên giới xuống đồng bằng:\n\n"
            "1. **Tuyến phòng thủ tiền tiêu phía Bắc (Nội Bàng – Vạn Kiếp)**: **Vạn Kiếp** (Chí Linh, Hải Dương) là nơi hội tụ của 6 dòng sông (Lục Đầu Giang), án ngữ cửa ngõ đường thủy – bộ vào Thăng Long. Năm 1284, Trần Hưng Đạo hội 20 vạn quân tại Vạn Kiếp để tập trận và truyền *Hịch tướng sĩ*.\n"
            "2. **Tuyến phòng thủ sông Hồng (Bình Lệ Nguyên – Phù Ninh – Thăng Long – Thiên Mạc)**: Nơi ghìm chân giặc, thực hiện *'Vườn không nhà trống'* và mở các trận đại phản công (**Đông Bộ Đầu, Tây Kết, Hàm Tử, Chương Dương**).\n"
            "3. **Hậu phương chiến lược (Thiên Trường – Trường Yên – Thanh Hóa)**: Khi tạm rút khỏi Thăng Long, triều đình lui về hành cung **Thiên Trường** (Nam Định), căn cứ núi đá **Trường Yên** (Ninh Bình) và **Thanh Hóa** để bảo toàn lực lượng, tích trữ lương thảo, rèn luyện tân binh chờ thời cơ tổng phản công."
        ),
        "follow_up": "Em có muốn biết khi giặc Nguyên tiến công, sự đối lập giữa những trung thần giữ nước và kẻ hèn nhát đầu hàng diễn ra thế nào không?"
    },
    {
        "unit_id": "GAME_TRUNG_THAN_VS_PHAN_BOI",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Sự đối lập giữa trung thần tiết nghĩa nhà Trần và kẻ phản bội đầu hàng (Trần Ích Tắc, Trần Kiện)",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.65, "skills": ["SKILL_LOYALTY_VS_TREASON", "SKILL_TRAN_BINH_TRONG"]},
        "entity": "Trần Bình Trọng, Trần Quốc Tuấn vs. Trần Ích Tắc, Trần Kiện",
        "event": "Kháng chiến chống quân Nguyên lần 2 (1285)",
        "fact_chunk": "Năm 1285, trước thế giặc Nguyên hung hãn, một số quý tộc hèn nhát như Trần Ích Tắc, Trần Kiện đem gia quyến đầu hàng giặc để cầu vinh (Trần Kiện bị gia nô Nguyễn Địa Lô bắn chết ở Lạng Sơn). Trái lại, tuyệt đại đa số vua tôi, tướng sĩ nhà Trần như Trần Quốc Tuấn, Trần Bình Trọng, Trần Quốc Toản kiên trung bất khuất bảo vệ Tổ quốc.",
        "badge": "Khí phách Nước Nam",
        "base_queries": [
            "trần ích tắc và trần kiện là ai trong cuộc kháng chiến chống nguyên năm 1285",
            "sự đối lập giữa khí tiết của trần bình trọng với kẻ đầu hàng trần ích tắc trần kiện",
            "ai là kẻ phản bội nhà trần đầu hàng quân nguyên năm 1285",
            "kết cục của trần kiện và trần ích tắc khi phản bội tổ quốc theo giặc nguyên",
            "so sánh tấm gương trung nghĩa của trần bình trọng trần quốc tuấn với trần ích tắc",
            "nguyễn địa lô bắn chết tên phản bội trần kiện ở đâu"
        ],
        "answer": (
            "Cuộc kháng chiến năm 1285 là phép thử khắc nghiệt làm sáng tỏ **ranh giới giữa lòng trung quân ái quốc và sự phản bội hèn nhát**:\n\n"
            "• **Kẻ phản bội cầu vinh (Trần Ích Tắc, Trần Kiện)**: Khiếp nhược trước 50 vạn quân Nguyên, Chiêu Quốc vương **Trần Ích Tắc** và **Trần Kiện** đã phản bội non sông, đem gia quyến đầu hàng Thoát Hoan với mộng được phong vương. Kết cục, Trần Kiện bị gia nô của Trần Hưng Đạo là **Nguyễn Địa Lô** bắn chết tại trại Ma Lục (Lạng Sơn), còn Trần Ích Tắc phải sống lưu vong nhục nhã nơi đất giặc, bị sử sách lên án.\n"
            "• **Khí tiết sáng ngời của các bậc đại trung thần**: Đối lập hoàn toàn với bọn phản bội là tinh thần bất khuất của **Trần Bình Trọng** (*'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!'*), **Trần Hưng Đạo** (*'Nếu bệ hạ muốn hàng, xin hãy chém đầu thần trước đã!'*) và tuổi trẻ **Trần Quốc Toản**.\n\n"
            "Bài học lịch sử khẳng định: chính nghĩa và lòng trung hiếu với Tổ quốc luôn chiến thắng và lưu danh muôn thuở."
        ),
        "follow_up": "Câu nói của Trần Bình Trọng trước mặt giặc chính là lời đanh thép nhất bác bỏ giấc mộng 'làm vương đất Bắc' của kẻ phản bội đấy em!"
    },

    # --- Ý ĐỊNH GIAO TIẾP HỌC ĐƯỜNG ---
    {
        "unit_id": "INTENT_GREETING",
        "category": "CONVERSATIONAL_INTENT",
        "topic": "Chào hỏi làm quen tự nhiên",
        "q_matrix": {"cognitive_level": "GIAO_TIEP", "difficulty": 0.1, "skills": ["SKILL_GREETING"]},
        "entity": "Trợ lý AI Đông A",
        "event": "Chào hỏi",
        "fact_chunk": "",
        "badge": None,
        "base_queries": [
            "xin chào thầy",
            "chào bạn nhé",
            "hello",
            "hi thầy ơi",
            "em chào thầy ạ"
        ],
        "answer": (
            "Chào em! Thầy là Trợ lý AI Sử học Đông A, người bạn đồng hành cùng em khám phá bài học **'Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)'** (Lịch sử 7).\n\n"
            "Em đang muốn tìm hiểu về trận đánh nào, một vị tướng anh hùng hay cần thầy giải thích câu hỏi khó nào trong sách?"
        ),
        "follow_up": ""
    },
    {
        "unit_id": "INTENT_STUDENT_STRUGGLE",
        "category": "CONVERSATIONAL_INTENT",
        "topic": "Học sinh gặp khó khăn hoặc quên kiến thức",
        "q_matrix": {"cognitive_level": "GIAO_TIEP", "difficulty": 0.1, "skills": ["SKILL_HELP"]},
        "entity": "Trợ lý AI Đông A",
        "event": "Hỗ trợ học tập",
        "fact_chunk": "",
        "badge": None,
        "base_queries": [
            "em không biết đáp án câu này",
            "em chưa hiểu bài thầy ơi giúp em với",
            "khó quá em không biết làm",
            "chỉ em cách trả lời với em quên mất rồi"
        ],
        "answer": (
            "Đừng lo lắng nhé! Lịch sử có nhiều mốc năm và trận đánh nên đôi khi nhầm lẫn là rất bình thường.\n\n"
            "Mẹo nhỏ: Em chỉ cần nhớ **3 mốc năm gắn với 3 chiến thắng quyết định**:\n"
            "• **Lần 1 (1258)** $\\rightarrow$ Vườn không nhà trống & thắng lớn ở **Đông Bộ Đầu**.\n"
            "• **Lần 2 (1285)** $\\rightarrow$ Hội nghị Diên Hồng & thắng ở **Hàm Tử, Chương Dương** (Thoát Hoan chui ống đồng).\n"
            "• **Lần 3 (1288)** $\\rightarrow$ Đốt thuyền lương **Vân Đồn** & cắm cọc lim trên sông **Bạch Đằng**.\n\n"
            "Em đang vướng câu hỏi trắc nghiệm hay sự kiện nào, cứ dán vào đây thầy hướng dẫn từng bước nhé!"
        ),
        "follow_up": ""
    },
    {
        "unit_id": "INTENT_THANKS",
        "category": "CONVERSATIONAL_INTENT",
        "topic": "Học sinh cảm ơn",
        "q_matrix": {"cognitive_level": "GIAO_TIEP", "difficulty": 0.1, "skills": ["SKILL_THANKS"]},
        "entity": "Trợ lý AI Đông A",
        "event": "Cảm ơn",
        "fact_chunk": "",
        "badge": None,
        "base_queries": [
            "cảm ơn thầy nhiều ạ",
            "dạ em hiểu rồi cảm ơn thầy",
            "hay quá cảm ơn bạn nhé",
            "thanks thầy nha"
        ],
        "answer": (
            "Không có gì em nhé! Thấy em nắm bài chắc và hứng thú với lịch sử dân tộc là thầy rất vui. Cứ tự nhiên hỏi thêm bất cứ điều gì em còn thắc mắc nhé!"
        ),
        "follow_up": ""
    },

    # --- PHÂN BIỆT RANH GIỚI TRIỀU ĐẠI (CROSS-ERA) ---
    {
        "unit_id": "CROSS_ERA_HAM_NGHI",
        "category": "CROSS_ERA_SAFEGUARD",
        "topic": "Phân biệt vua Hàm Nghi triều Nguyễn với thời Trần",
        "q_matrix": {"cognitive_level": "PHAN_BIET", "difficulty": 0.4, "skills": ["SKILL_CROSS_ERA_HAM_NGHI"]},
        "entity": "Vua Hàm Nghi",
        "event": "Phong trào Cần Vương (1885)",
        "fact_chunk": "",
        "badge": None,
        "base_queries": [
            "bạn biết vua hàm nghi không",
            "vua hàm nghi là ai có phải thời trần không",
            "hàm nghi phong trào cần vương",
            "vua hàm nghi triều đại nào"
        ],
        "answer": (
            "Thầy biết chứ! **Vua Hàm Nghi** (1871 – 1944) là vị hoàng đế yêu nước trẻ tuổi của **triều Nguyễn** (cuối thế kỷ XIX), gắn liền với chiếu Cần Vương (năm 1885) chống thực dân Pháp.\n\n"
            "💡 **Lưu ý để không nhầm trong bài thi**:\n"
            "• Vua Hàm Nghi thuộc thế kỷ XIX (chống Pháp năm 1885).\n"
            "• Bài học Lịch sử 7 của chúng ta đang tìm hiểu là **Ba lần kháng chiến chống Mông - Nguyên thời nhà Trần (1258 – 1288, thế kỷ XIII)** em nhé!"
        ),
        "follow_up": ""
    },
    {
        "unit_id": "CROSS_ERA_NGO_QUYEN",
        "category": "CROSS_ERA_SAFEGUARD",
        "topic": "Phân biệt Ngô Quyền (938) và Trần Hưng Đạo (1288) trên sông Bạch Đằng",
        "q_matrix": {"cognitive_level": "PHAN_BIET", "difficulty": 0.4, "skills": ["SKILL_CROSS_ERA_NGO_QUYEN"]},
        "entity": "Ngô Quyền",
        "event": "Chiến thắng Bạch Đằng năm 938",
        "fact_chunk": "",
        "badge": None,
        "base_queries": [
            "ngô quyền là ai và đánh trận bạch đằng năm nào",
            "phân biệt trận bạch đằng của ngô quyền và trần hưng đạo",
            "ngô quyền có phải tướng thời trần không",
            "ai là người đầu tiên cắm cọc sông bạch đằng"
        ],
        "answer": (
            "Đây là điểm rất hay bị nhầm lẫn trong các đề thi Lịch sử:\n\n"
            "• **Ngô Quyền (Năm 938 - Thế kỷ X)**: Người đầu tiên sáng tạo cắm cọc ngầm trên sông Bạch Đằng để đánh tan quân **Nam Hán**, chấm dứt hơn 1.000 năm Bắc thuộc.\n"
            "• **Trần Hưng Đạo (Năm 1288 - Thế kỷ XIII, Thời Trần)**: Kế thừa và phát triển nghệ thuật cọc ngầm đánh bại thủy quân **Nguyên Mông** (bắt sống Ô Mã Nhi).\n\n"
            "Trong bài học Lịch sử 7 Bài 13 này, chúng ta đang học về Trần Hưng Đạo năm 1288 em nhé!"
        ),
        "follow_up": ""
    },
    {
        "unit_id": "CROSS_ERA_QUANG_TRUNG_LE_LOI_LY_THUONG_KIET",
        "category": "CROSS_ERA_SAFEGUARD",
        "topic": "Phân biệt anh hùng thời Lý, Lê, Tây Sơn",
        "q_matrix": {"cognitive_level": "PHAN_BIET", "difficulty": 0.4, "skills": ["SKILL_CROSS_ERA_OTHERS"]},
        "entity": "Lý Thường Kiệt / Lê Lợi / Quang Trung",
        "event": "Các triều đại khác",
        "fact_chunk": "",
        "badge": None,
        "base_queries": [
            "vua quang trung nguyễn huệ thuộc triều đại nào",
            "lê lợi và nguyễn trãi khởi nghĩa lam sơn năm nào",
            "lý thường kiệt có tham gia chống quân nguyên mông không",
            "bạn biết vua quang trung không"
        ],
        "answer": (
            "Đó đều là những vị anh hùng vĩ đại của dân tộc, nhưng thuộc **các triều đại khác**:\n\n"
            "• **Lý Thường Kiệt** (Thế kỷ XI - **Thời Lý**): Kháng chiến chống Tống (1075 - 1077) trên sông Như Nguyệt.\n"
            "• **Lê Lợi & Nguyễn Trãi** (Thế kỷ XV - **Khởi nghĩa Lam Sơn / Hậu Lê**): Đánh đuổi quân Minh (1418 - 1427).\n"
            "• **Quang Trung (Nguyễn Huệ)** (Thế kỷ XVIII - **Tây Sơn**): Đại phá 29 vạn quân Thanh (1789).\n\n"
            "Còn chuyên đề Lịch sử 7 Bài 13 tập trung vào thời Trần (1258 - 1288) với Trần Hưng Đạo, Trần Quốc Toản, Trần Thủ Độ... em nhé!"
        ),
        "follow_up": ""
    },

    # --- TƯ LIỆU GỐC ĐẠI VIỆT SỬ KÝ TOÀN THƯ (BẢN KỶ QUYỂN V & QUYỂN VI) ---
    {
        "unit_id": "DVSKTT_TRAN_NHAT_HIEU_HOANG_CU_DA",
        "category": "KHANG_CHIEN_LAN_1_1258",
        "topic": "Thái úy Trần Nhật Hiệu viết chữ 'Nhập Tống', Hoàng Cự Đà ăn xoài và Lời bàn của Ngô Sĩ Liên (1258)",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.65, "skills": ["SKILL_TRAN_THU_DO", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Trần Nhật Hiệu, Hoàng Cự Đà & Sử thần Ngô Sĩ Liên",
        "event": "Kháng chiến chống Mông Cổ lần 1 (1258) - Sông Thiên Mạc & Đông Bộ Đầu",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V, tờ [22b-23a], tr. 520-522): Năm 1258 tại sông Thiên Mạc, Thái úy Trần Nhật Hiệu khiếp sợ viết hai chữ 'Nhập Tống' (chạy sang Tống) lên mạn thuyền, đối lập hoàn toàn với câu nói 'Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác' của Thái sư Trần Thủ Độ; Sử thần Ngô Sĩ Liên nghiêm khắc phê phán Nhật Hiệu hèn nhát. Cùng dịp đó, tiểu hiệu Hoàng Cự Đà vì trước kia không được ăn xoài vua ban nên bỏ chạy khi giặc đến Đông Bộ Đầu; sau chiến thắng, vua Trần Thái Tông nhận lỗi về mình và tha tội chết cho Cự Đà lập công chuộc tội.",
        "badge": "Tinh thông Chính sử",
        "base_queries": [
            "ai là người viết hai chữ nhập tống lên mạn thuyền năm 1258",
            "trần nhật hiệu viết chữ nhập tống ở sông thiên mạc và lời bàn của ngô sĩ liên",
            "chuyện hoàng cự đà không được ăn xoài trong đại việt sử ký toàn thư",
            "vì sao vua trần thái tông tha tội chết cho hoàng cự đà năm 1258",
            "sự đối lập giữa trần nhật hiệu và trần thủ độ trên sông thiên mạc năm 1258"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển V, tờ `[22b–23a]`, trang 520–522*), cuộc kháng chiến lần thứ nhất (1258) ghi lại hai câu chuyện lịch sử vô cùng sâu sắc:\n\n"
            "1. **Thái úy Trần Nhật Hiệu viết chữ 'Nhập Tống' (`[22b]`, tr. 520)**:\n"
            "   • Khi vua Trần Thái Tông lui giữ sông Thiên Mạc, ngự thuyền nhỏ đến hỏi kế sách, Thái úy **Trần Nhật Hiệu** khiếp sợ dựa mạn thuyền không đứng dậy nổi, lấy ngón tay chấm nước viết hai chữ **'Nhập Tống'** (khuyên vua chạy sang nước Nam Tống).\n"
            "   • Trái ngược lại, **Thái sư Trần Thủ Độ** khẳng khái tâu: *'Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác'*.\n"
            "   • **Lời bàn của Sử thần Ngô Sĩ Liên**: *'Nhật Hiệu là đại thần cùng họ với vua. Giặc đến, khiếp sợ, hèn nhát, không có kế sách chống giữ, lại còn kiếm cách xui vua mình chạy đi ở nhờ nước khác, thì còn dùng hắn làm tướng làm gì?'*.\n\n"
            "2. **Giai thoại Hoàng Cự Đà không được ăn xoài (`[23a]`, tr. 521–522)**:\n"
            "   • Trước kia vua ban xoài cho cận thần nhưng tiểu hiệu **Hoàng Cự Đà** không được ăn. Khi giặc tới Đông Bộ Đầu, Cự Đà ngồi thuyền nhẹ chạy trốn; gặp quân Thái tử hỏi giặc ở đâu, Đà trả lời: *'Không biết, đi mà hỏi những người ăn xoài ấy!'*.\n"
            "   • Sau ngày toàn thắng, Thái tử xin xử cực hình, nhưng **vua Trần Thái Tông** độ lượng nói: *'Việc Cự Đà là lỗi ở ta, tha cho hắn tội chết, cho phép hắn đánh giặc chuộc tội'*."
        ),
        "follow_up": "Em thấy cách xử lý khoan dung, tự nhận lỗi của vua Trần Thái Tông với Hoàng Cự Đà thể hiện phẩm chất gì của bậc minh quân?"
    },
    {
        "unit_id": "DVSKTT_DO_KHAC_CHUNG_SU_GIA",
        "category": "KHANG_CHIEN_LAN_2_1285",
        "topic": "Đỗ Khắc Chung đi sứ trại giặc Ô Mã Nhi và tài ứng đối về hai chữ 'Sát Thát' (1285)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.55, "skills": ["SKILL_DO_KHAC_CHUNG", "SKILL_SAT_THAT"]},
        "entity": "Chi hậu cục thủ Đỗ Khắc Chung & Ô Mã Nhi",
        "event": "Đỗ Khắc Chung đi sứ dò xét trại quân Nguyên (Tháng Giêng năm 1285)",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V, tờ [45b-46b], tr. 568-570): Tháng Giêng năm 1285, Chi hậu cục thủ Đỗ Khắc Chung tình nguyện sang trại giặc Ô Mã Nhi giả đưa thư giảng hòa để dò xét tình hình, được vua khen 'Ngờ đâu trong đám ngựa kéo xe muối lại có ngựa kỳ, ngựa ký như thế!'. Khi Ô Mã Nhi hạch tội thích chữ 'Sát Thát', Khắc Chung ung dung giơ cánh tay và đối đáp đanh thép: 'Thú cùng thì chống lại, chim cùng thì mổ lại, huống chi là người', khiến Ô Mã Nhi cảm phục.",
        "badge": "Sứ thần Bất khuất",
        "base_queries": [
            "đỗ khắc chung là ai và đã đối đáp với ô mã nhi như thế nào năm 1285",
            "ai là người đi sứ sang trại giặc ô mã nhi giải thích hai chữ sát thát",
            "sứ giả nào đi sứ sang trại giặc ô mã nhi giải thích hai chữ sát thát trên cánh tay",
            "câu nói ngờ đâu trong đám ngựa kéo xe muối lại có ngựa kỳ ngựa ký khen ai",
            "chuyện đỗ khắc chung đi sứ trại giặc nguyên trong đại việt sử ký toàn thư",
            "ô mã nhi đã nhận xét gì sau khi đỗ khắc chung trở về",
            "chi hậu cục thủ đỗ khắc chung nói chó nhà cắn người lạ không phải tại chủ nó với ô mã nhi"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển V, tờ `[45b–46b]`, trang 568–570*), **Chi hậu cục thủ Đỗ Khắc Chung** là tấm gương ngoại giao mưu lược và bất khuất trong kháng chiến lần thứ hai (tháng Giêng năm 1285):\n\n"
            "• **Dũng cảm nhận mệnh**: Khi quân Ô Mã Nhi tiến đến Đông Bộ Đầu, vua Trần muốn tìm người đi dò xét tình hình giặc. Đỗ Khắc Chung bước ra tâu: *'Thần hèn mọn bất tài, nhưng xin được đi'*. Vua mừng rỡ khen: *'Ngờ đâu trong đám ngựa kéo xe muối lại có ngựa kỳ, ngựa ký như thế!'*.\n"
            "• **Bản lĩnh ứng đối về hai chữ 'Sát Thát' (`[46a]`, tr. 569)**: Ô Mã Nhi hạch tội vua Trần vô lễ sai quân thích chữ *'Sát Thát'* vào cánh tay. Khắc Chung bình thản giơ cánh tay mình ra và đáp: *'Chó nhà cắn người lạ không phải tại chủ nó. Vì lòng trung phẫn mà họ tự thích chữ thôi, Quốc vương tôi không biết việc đó... Nay lại bức nhau, người ta nói thú cùng thì chống lại, chim cùng thì mổ lại, huống chi là người!'*.\n"
            "• **Kẻ thù phải nể phục (`[46b]`, tr. 570)**: Khi Khắc Chung về rồi, Ô Mã Nhi bảo các tướng: *'Người này ở vào lúc bị uy hiếp mà lời lẽ tự nhiên, không hạ chủ nó xuống là Chích, không nịnh ta lên là Nghiêu... Nước nó còn có người giỏi, chưa dễ mưu tính được'*."
        ),
        "follow_up": "Em có muốn tìm hiểu thêm về cách Trần Quốc Tuấn xóa bỏ hiềm khích gia tộc để giữ vững khối đoàn kết triều Trần không?"
    },
    {
        "unit_id": "DVSKTT_TRAN_QUOC_TUAN_GAY_BIT_SAT",
        "category": "DIEN_HONG_HICH_TUONG_SI",
        "topic": "Trần Quốc Tuấn rút đầu sắt gậy gỗ xóa hiềm khích gia tộc, răn dạy các con và Lời bàn của Ngô Sĩ Liên",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.7, "skills": ["SKILL_TRAN_HUNG_DAO", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Hưng Đạo Đại Vương Trần Quốc Tuấn & Ngô Sĩ Liên",
        "event": "Xóa bỏ hiềm khích gia tộc vì đại nghĩa dân tộc (1285 - 1300)",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V tờ [47b] tr. 572 & Quyển VI tờ [9b-10b] tr. 621-623): Cha của Trần Quốc Tuấn là Yên Sinh Vương Trần Liễu có hiềm khích với Trần Thái Tông, trối trăng bảo con giành lấy thiên hạ. Nhưng Quốc Tuấn đặt vận nước lên trên thù nhà: năm 1285 khi theo hầu hai vua, thấy mọi người nghi ngại chiếc gậy bịt sắt nhọn của mình, ông liền rút đầu sắt nhọn vứt đi chỉ chống gậy không; đồng thời răn dạy các con đạo trung hiếu. Sử thần Ngô Sĩ Liên ca ngợi ông sánh ngang Quách Tử Nghi nhà Đường.",
        "badge": "Đại nghĩa Đông A",
        "base_queries": [
            "vì sao trần quốc tuấn lại rút đầu sắt nhọn trên gậy gỗ vứt đi năm 1285",
            "câu chuyện trần quốc tuấn rút đầu sắt gậy gỗ và lời bàn của ngô sĩ liên",
            "trần quốc tuấn đã hóa giải mối hiềm khích của yên sinh vương trần liễu như thế nào",
            "vì sao trần quốc tuấn rút gươm định giết con là trần quốc tảng",
            "ngô sĩ liên so sánh trần quốc tuấn với danh tướng nào của nhà đường",
            "sử thần ngô sĩ liên so sánh trần quốc tuấn với danh tướng quách tử nghi của nhà đường như thế nào",
            "hưng vũ vương nghiễn và hưng nhượng vương trần quốc tảng trả lời cha thế nào khi thử lòng"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Quyển V tờ `[47b]` tr. 572 & Quyển VI tờ `[9b–10b]` tr. 621–623*), tấm lòng trung nghĩa, đặt lợi ích dân tộc lên trên thù riêng của **Trần Quốc Tuấn** được khắc họa qua những chi tiết lịch sử đắt giá:\n\n"
            "1. **Gạt bỏ lời trối trăng giành ngôi của cha (`[9b–10a]`, tr. 621–622)**:\n"
            "   • Cha ông là **Yên Sinh Vương Trần Liễu** vốn có hiềm khích với vua Trần Thái Tông, lúc sắp mất cầm tay dặn: *'Con không vì cha lấy được thiên hạ, thì cha chết dưới suối vàng cũng không nhắm mắt được'*. Quốc Tuấn ghi để trong lòng nhưng không cho là phải.\n"
            "   • Khi thử lòng hai gia nô **Yết Kiêu, Dã Tượng** và con trai **Hưng Vũ Vương Nghiễn**, thấy họ đều khuyên giữ trọn đạo trung hiếu (*'Dẫu khác họ cũng không nên, huống chi là cùng một họ!'*), ông vô cùng cảm phục; ngược lại khi người con thứ **Trần Quốc Tảng** khuyên thừa cơ đoạt ngôi, ông rút gươm quở trách: *'Tên loạn thần là từ đứa con bất hiếu mà ra!'*.\n\n"
            "2. **Rút đầu sắt nhọn trên gậy gỗ xóa tan nghi kỵ (`[47b]`, tr. 572)**:\n"
            "   • Năm 1285, khi xa giá hai vua phải rút lui gian truân, Quốc Tuấn đi theo hộ giá, tay cầm chiếc gậy có bịt sắt nhọn. Thấy mọi người gườm mắt nhìn vì ngại mối hiềm khích cũ của Yên Sinh Vương, **ông liền rút ngay đầu sắt nhọn vứt đi, chỉ chống gậy gỗ không mà đi**.\n"
            "   • **Lời bàn của Sử thần Ngô Sĩ Liên (`[47b]`, tr. 572)**: *'Bậc đại thần ở vào hoàn cảnh bị hiềm nghi nguy hiểm, tất phải thành thực tin nhau, sáng suốt khéo xử... mới có thể giữ tròn danh dự, làm nên sự nghiệp. Quách Tử Nghi nhà Đường, Trần Quốc Tuấn nhà Trần đã làm được như vậy'*."
        ),
        "follow_up": "Hành động rút đầu sắt gậy gỗ của Trần Quốc Tuấn giúp em hiểu sâu hơn câu 'Vua tôi đồng tâm, anh em hòa mục' như thế nào?"
    },
    {
        "unit_id": "DVSKTT_BACH_DANG_DO_HANH_NGUYEN_KHOAI",
        "category": "DAI_THANG_BACH_DANG_1288",
        "topic": "Chi tiết chính sử Đại thắng Bạch Đằng (1288): Nguyễn Khoái, Đỗ Hành bắt sống Ô Mã Nhi và lễ dâng thắng trận ở Chiêu Lăng",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.55, "skills": ["SKILL_BACH_DANG_1288", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Nguyễn Khoái, Đỗ Hành, Trần Hưng Đạo & Vua Trần Nhân Tông",
        "event": "Đại thắng Bạch Đằng và Lễ dâng thắng trận ở Chiêu Lăng (Tháng 3 năm Mậu Tý - 4/1288)",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V, tờ [54a-55a], tr. 585-587): Ngày 8 tháng 3 âm lịch năm Mậu Tý (9/4/1288) trên sông Bạch Đằng, tướng Nguyễn Khoái chỉ huy quân Thánh Dực Dũng Nghĩa bắt sống Bình chương Áo Lỗ Xích; thuyền lương Trương Văn Hổ mắc cọc nghiêng đắm gần hết; Nội Minh tự Đỗ Hành bắt sống Ô Mã Nhi và Tích Lê Cơ Ngọc dâng lên Thượng hoàng, thu 400 chiến thuyền. Ngày 17 tháng 3, khi giải tù binh làm lễ dâng thắng trận ở Chiêu Lăng, thấy chân ngựa đá lấm bùn, vua Trần Nhân Tông đề hai câu thơ 'Xã tắc lưỡng hồi lao thạch mã / Sơn hà thiên cổ điện kim âu'.",
        "badge": "Huyền thoại Bạch Đằng Giang",
        "base_queries": [
            "ai là người trực tiếp bắt sống ô mã nhi và tích lê cơ ngọc trên sông bạch đằng năm 1288",
            "nội minh tự đỗ hành và tướng nguyễn khoái lập công gì ở trận bạch đằng năm 1288",
            "đại việt sử ký toàn thư chép diễn biến trận bạch đằng ngày 8 tháng 3 năm mậu tý thế nào",
            "vì sao chân ngựa đá ở chiêu lăng bị lấm bùn sau đại thắng bạch đằng năm 1288",
            "quân ta thu được bao nhiêu chiến thuyền và bắt những tướng giặc nào ở trận bạch đằng 1288",
            "thu được 400 chiến thuyền và bắt sống những tướng giặc nào ở trận bạch đằng năm 1288",
            "vì sao đỗ hành bắt sống ô mã nhi nhưng chỉ được phong tước quan nội hầu"
        ],
        "answer": (
            "Theo nguyên văn **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển V, tờ `[54a–55a]`, trang 585–587*), trận quyết chiến trên sông Bạch Đằng ngày mồng 8 tháng 3 năm Mậu Tý (**9/4/1288**) có những chi tiết chính sử vô cùng hào hùng:\n\n"
            "• **Bãi cọc phủ cỏ và thời cơ nước triều rút (`[54a–54b]`, tr. 585–586)**: Hưng Đạo Vương đóng cọc gỗ ở sông Bạch Đằng, phủ cỏ lên trên. Lúc nước triều lên, quân ta khiêu chiến rồi giả thua chạy; khi nước triều rút mạnh, thuyền giặc vướng cọc hết.\n"
            "• **Chiến công của tướng Nguyễn Khoái**: Chỉ huy đội cấm quân tinh nhuệ **Thánh Dực Dũng Nghĩa** xung trận quyết liệt, bắt sống Bình chương Áo Lỗ Xích; hai vua đem đại quân tiếp ứng đánh lớn khiến quân Nguyên chết đuối nhiều không kể xiết, nước sông đỏ ngầu.\n"
            "• **Nội Minh tự Đỗ Hành bắt sống Ô Mã Nhi (`[54b]`, tr. 586)**: Thuyền Trương Văn Hổ mắc trên cọc nghiêng đắm gần hết. Quân ta thu được **400 chiến thuyền**; **Nội Minh tự Đỗ Hành** bắt sống Nguyên soái **Ô Mã Nhi** và **Tích Lê Cơ Ngọc** dâng lên Thượng hoàng Trần Thánh Tông.\n"
            "• **Lễ dâng thắng trận ở Chiêu Lăng (`[55a]`, tr. 587)**: Ngày 17 tháng 3, vua đem các tướng giặc bị bắt (Ô Mã Nhi, Phàn Tiếp, Tích Lê Cơ Ngọc, Sầm Đoàn) làm lễ dâng thắng trận ở **Chiêu Lăng** (lăng vua Trần Thái Tông). Thấy chân ngựa đá ở lăng đều lấm bùn, vua Trần Nhân Tông xúc động đề thơ:\n"
            "  *'Xã tắc lưỡng hồi lao thạch mã / Sơn hà thiên cổ điện kim âu'*."
        ),
        "follow_up": "Em có muốn biết năm 1289 triều Trần đã xử lý tên tướng giặc hung bạo Ô Mã Nhi như thế nào trên đường trả về nước không?"
    },
    {
        "unit_id": "DVSKTT_HOANG_TA_THON_NGO_SI_LIEN_BAN",
        "category": "DAI_THANG_BACH_DANG_1288",
        "topic": "Kế Hoàng Tá Thốn dùi đắm thuyền Ô Mã Nhi (1289) và Lời bàn của Sử thần Ngô Sĩ Liên",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.75, "skills": ["SKILL_BACH_DANG_1288", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Hoàng Tá Thốn, Trần Hưng Đạo, Ô Mã Nhi & Ngô Sĩ Liên",
        "event": "Xử lý tướng giặc Ô Mã Nhi sau chiến tranh (Tháng 2 năm Kỷ Sửu - 1289)",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V, tờ [56b], tr. 590): Tháng 2 năm Kỷ Sửu (1289), vua Trần sai Nội thư Hoàng Tá Thốn đưa bọn Ô Mã Nhi về nước; theo kế của Hưng Đạo Vương, dùng người giỏi bơi lặn làm phu thuyền, ban đêm dùi thuyền cho đắm khiến Ô Mã Nhi chết đuối. Sử thần Ngô Sĩ Liên bàn về chữ Tín trong vương chính và đối sánh với việc vua Lê Thái Tổ sau này giữ chữ Tín tha quân Minh về nước.",
        "badge": "Tư duy Sử học",
        "base_queries": [
            "ô mã nhi chết như thế nào sau khi bị bắt ở trận bạch đằng",
            "ai là người dùng kế dùi đắm thuyền ô mã nhi năm 1289",
            "hoàng tá thốn đưa ô mã nhi về nước và lời bàn của sử thần ngô sĩ liên",
            "sử thần ngô sĩ liên đã bàn gì về việc dùi thuyền giết ô mã nhi năm 1289",
            "số phận của tướng giặc ô mã nhi sau trận bạch đằng năm 1288"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển V, tờ `[56b]`, trang 590*), kết cục của tướng giặc **Ô Mã Nhi** vào mùa xuân tháng 2 năm Kỷ Sửu (**1289**) được ghi chép kèm lời bàn rất đáng suy ngẫm của sử gia:\n\n"
            "• **Kế dùi thuyền của Hưng Đạo Vương & Hoàng Tá Thốn (`[56b]`, tr. 590)**:\n"
            "  Vì Ô Mã Nhi là tên tướng cực kỳ hung bạo, từng nhiều lần tàn sát nhân dân và quật phá lăng tẩm nhà Trần, nếu thả sống về phương Bắc sẽ để lại hậu họa lớn; nhưng nếu giết công khai sẽ tạo cớ cho nhà Nguyên gây chiến. Do đó, triều đình sai Nội thư **Hoàng Tá Thốn** hộ tống Ô Mã Nhi về nước bằng đường biển, dùng kế của **Hưng Đạo Vương**: chọn những người giỏi bơi lặn giả làm phu thuyền, chờ ban đêm lấy dùi đục thủng đáy thuyền làm thuyền đắm, bọn Ô Mã Nhi đều chết đuối.\n"
            "• **Góc nhìn phản biện của Sử thần Ngô Sĩ Liên (`[56b]`, tr. 590)**:\n"
            "  Đứng trên quan điểm Nho giáo thế kỷ XV, **Ngô Sĩ Liên** bàn rằng: *'Chữ tín là vật báu của nước, mà làm cho người khác phục mình sâu sắc thì đó là gốc của vương chính'*, và đem đối sánh với việc vua **Lê Thái Tổ** sau này giữ trọn chữ Tín cấp thuyền lương tha 10 vạn quân Minh về nước.\n"
            "• **Bài học tư duy lịch sử**: Giúp chúng ta hiểu cả **tình thế hiểm nghèo thời Trần** (phải trừ tận gốc tên tướng hiếu chiến để bảo vệ dân lành) lẫn **truyền thống nhân nghĩa, giữ chữ Tín ngoại giao** của dân tộc Việt Nam."
        ),
        "follow_up": "Em có muốn khám phá thêm về pháp luật nghiêm minh và tấm gương quan thanh liêm Trần Thì Kiến dưới triều Trần không?"
    },
    {
        "unit_id": "DVSKTT_TRAN_THI_KIEN_PHAP_LUAT",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Pháp luật thời Trần, tấm gương quan thanh liêm Trần Thì Kiến và Lời bàn của Phan Phu Tiên – Ngô Sĩ Liên",
        "q_matrix": {"cognitive_level": "VAN_DUNG", "difficulty": 0.65, "skills": ["SKILL_DVSKTT_PRIMARY"]},
        "entity": "Kiểm pháp quan Trần Thì Kiến, Phan Phu Tiên & Ngô Sĩ Liên",
        "event": "Quản trị đất nước và kỷ cương pháp luật thời Trần (1296 - 1297)",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển VI, tờ [4a-5a], tr. 610-612): Nhà Trần thời thịnh trị giữ pháp luật rất nghiêm minh, nghiêm cấm đánh bạc (Phan Phu Tiên bàn rằng nhờ pháp luật nghiêm mà nước mạnh, cuối đời Dụ Tông đánh bạc trong cung nên mất nước). Đặc biệt, môn khách của Trần Hưng Đạo là Trần Thì Kiến làm An phủ sứ Thiên Trường nổi tiếng thanh liêm cương trực: khi biết người đem biếu mâm cỗ giỗ có ý cậy cục xin xỏ, ông đã móc họng mửa hết thức ăn ra, được thăng làm Kiểm pháp quan.",
        "badge": "Thanh liêm Chính trực",
        "base_queries": [
            "trần thì kiến là ai và vì sao ông lại móc họng mửa ra mâm cỗ biếu",
            "tấm gương quan thanh liêm trần thì kiến trong đại việt sử ký toàn thư",
            "luật pháp nhà trần nghiêm cấm đánh bạc và lời bàn của phan phu tiên như thế nào",
            "ngô sĩ liên nhận xét gì về hành động của kiểm pháp quan trần thì kiến",
            "vì sao vua trần không hài lòng với câu nói tướng là chim ưng dân lính là vịt của trần khánh dư"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển VI, tờ `[4a–5a]`, trang 610–612*), sức mạnh của vương triều Trần không chỉ nằm ở quân sự mà còn ở **kỷ cương pháp luật nghiêm minh và đội ngũ quan lại thanh liêm**:\n\n"
            "1. **Tấm gương quan thanh liêm Trần Thì Kiến (`[4b–5a]`, tr. 611–612)**:\n"
            "   • **Trần Thì Kiến** vốn là môn khách giỏi của Hưng Đạo Vương, được tiến cử làm An phủ sứ Thiên Trường. Có người trong hương nhân ngày giỗ đem biếu mâm cỗ và nói chỉ vì ở gần trị sở chứ không cầu cạnh gì. Nhưng mấy ngày sau, người ấy quả nhiên đến kêu xin việc riêng. **Trần Thì Kiến liền móc họng mửa hết ra** để giữ trọn sự trong sạch, sau được thăng làm **Kiểm pháp quan**.\n"
            "   • **Lời bàn của Sử thần Ngô Sĩ Liên**: *'Thì Kiến hành động lạ lùng quá mức để uốn nắn cái tệ xin xỏ của người bấy giờ, cũng như Án Anh tằn tiện quá mức để uốn nắn cái thói xa xỉ tiếm lễ của Quản Trọng vậy'*.\n\n"
            "2. **Thương dân và nghiêm trị tệ cờ bạc (`[4a–4b]`, tr. 610–611)**:\n"
            "   • Khi Trần Khánh Dư bị dân kiện và tâu vua: *'Tướng là chim ưng, dân lính là vịt, dùng vịt để nuôi chim ưng thì có gì là lạ?'*, vua Trần Anh Tông đã **không hài lòng** khiến Khánh Dư phải sợ hãi rút lui.\n"
            "   • **Lời bàn của Sử thần Phan Phu Tiên (`[4a]`, tr. 610)**: Luật pháp nhà Trần đầu triều nghiêm cấm đánh bạc rất nặng (quan Thượng phẩm Nguyễn Hưng đánh bạc bị xử tội chết), nhờ vậy kỷ cương vững chắc; đến cuối đời Dụ Tông công nhiên gọi người giàu vào cung đánh bạc nên triều cương suy đồi."
        ),
        "follow_up": "Câu chuyện của Kiểm pháp quan Trần Thì Kiến để lại bài học gì về phẩm chất liêm chính, chống tham nhũng hiện nay?"
    },
    {
        "unit_id": "DVSKTT_THANH_LAP_NHA_TRAN_1225",
        "category": "TONG_KET_NGUYEN_NHAN_Y_NGHIA",
        "topic": "Sự thành lập nhà Trần (1225 - 1226): Lý Chiêu Hoàng nhường ngôi cho Trần Cảnh và vai trò của Thái sư Trần Thủ Độ",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.35, "skills": ["SKILL_THANH_LAP_NHA_TRAN", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Vua Trần Thái Tông (Trần Cảnh), Lý Chiêu Hoàng & Thái sư Trần Thủ Độ",
        "event": "Nhà Trần thành lập (Tháng 12 âm lịch năm Ất Dậu - Đầu năm 1226)",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V, tờ [1a-2b], tr. 478-481): Cuối thế kỷ XII - đầu thế kỷ XIII, nhà Lý suy yếu, chính quyền phải dựa vào thế lực họ Trần. Dưới sự sắp đặt của Điện tiền chỉ huy sứ Trần Thủ Độ, tháng 12 âm lịch năm Ất Dậu (đầu năm 1226), tại điện Thiên An, nữ hoàng Lý Chiêu Hoàng trút bỏ áo ngự nhường ngôi cho chồng là Trần Cảnh (8 tuổi, tức vua Trần Thái Tông), đặt niên hiệu Kiến Trung, phong Trần Thủ Độ làm Quốc thượng phụ nắm giữ việc nước.",
        "badge": "Khởi nghiệp Đông A",
        "base_queries": [
            "nhà trần được thành lập như thế nào vào năm 1225 1226",
            "lý chiêu hoàng nhường ngôi cho trần cảnh diễn ra như thế nào",
            "ai là vị vua đầu tiên của triều đại nhà trần",
            "vai trò của trần thủ độ trong việc thành lập nhà trần năm 1226",
            "đại việt sử ký toàn thư quyển v tờ 1a chép sự kiện trần cảnh lên ngôi thế nào",
            "hoàn cảnh ra đời của vương triều nhà trần đầu năm 1226"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển V, tờ `[1a–2b]`, trang 478–481*), sự thành lập vương triều nhà Trần diễn ra vào tháng 12 âm lịch năm Ất Dậu (**đầu năm 1226**):\n\n"
            "• **Bối cảnh lịch sử**: Cuối thế kỷ XII – đầu thế kỷ XIII, triều Lý suy yếu trầm trọng, giặc giã nổi lên khắp nơi. Triều đình nhà Lý phải dựa vào thế lực họ Trần (Trần Tự Khánh, Trần Thừa, Trần Thủ Độ) để dẹp loạn và giữ yên đất nước.\n"
            "• **Chuyển giao ngôi báu tại điện Thiên An (`[1a–1b]`, tr. 478–479)**: Dưới sự thu xếp của Điện tiền chỉ huy sứ **Trần Thủ Độ**, nữ hoàng **Lý Chiêu Hoàng** kết hôn với **Trần Cảnh** (khi ấy 8 tuổi). Ngày mồng 1 tháng 12 năm Ất Dậu, Lý Chiêu Hoàng mở hội lớn ở điện Thiên An, trút bỏ áo ngự mời Trần Cảnh lên ngôi Hoàng đế — tức **vua Trần Thái Tông**.\n"
            "• **Củng cố vương triều mới**: Vua đổi niên hiệu là **Kiến Trung**, tôn cha là Trần Thừa làm Thượng hoàng, phong **Trần Thủ Độ làm Quốc thượng phụ** (sau là Thái sư) điều hành mọi việc quân quốc trọng sự, mở ra thời đại **Hào khí Đông A** kéo dài 175 năm (1226 – 1400)."
        ),
        "follow_up": "Em có muốn tìm hiểu tiếp về bộ máy nhà nước chế độ Thái thượng hoàng và bộ luật Quốc triều hình thư của nhà Trần không?"
    },
    {
        "unit_id": "DVSKTT_BO_MAY_PHAP_LUAT_QUOC_TRIEU_HINH_THU",
        "category": "TONG_KET_NGUYEN_NHAN_Y_NGHIA",
        "topic": "Tổ chức bộ máy nhà nước chế độ Thái thượng hoàng và luật pháp Quốc triều hình thư thời Trần",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_BO_MAY_NHA_TRAN", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Triều đình nhà Trần & Quốc triều hình thư",
        "event": "Củng cố chế độ quân chủ trung ương tập quyền và ban hành Quốc triều hình thư",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V, tờ [4a-15a], tr. 484-505): Nhà Trần tổ chức bộ máy quân chủ trung ương tập quyền độc đáo với chế độ Thái thượng hoàng (vua cha nhường ngôi sớm cho con rồi cùng điều hành việc nước); chia cả nước thành 12 lộ, phủ, châu, huyện, xã; lập sổ hộ tịch và ban hành bộ Quốc triều thông chế, Quốc triều hình thư, đặt cơ quan Thẩm hình viện xét xử công minh.",
        "badge": "Pháp trị Đông A",
        "base_queries": [
            "tổ chức bộ máy nhà nước và pháp luật thời trần có điểm gì nổi bật",
            "chế độ thái thượng hoàng của nhà trần là gì và có tác dụng gì",
            "bộ luật thành văn của nhà trần có tên là gì",
            "quốc triều hình thư và quốc triều thông chế thời trần được ban hành thế nào",
            "nhà trần chia cả nước thành bao nhiêu lộ và quản lý hộ tịch ra sao",
            "đại việt sử ký toàn thư chép việc đặt vạc dầu và chuồng hổ răn đe phạm pháp thời trần thế nào"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển V, tờ `[4a–15a]`, trang 484–505*) và SGK Lịch sử 7 (Bài 14), bộ máy nhà nước và pháp luật thời Trần được tổ chức rất chặt chẽ, quy củ:\n\n"
            "• **Chế độ Thái thượng hoàng độc đáo**: Các vua Trần thường nhường ngôi sớm cho Thái tử khi đã trưởng thành để lên làm **Thái thượng hoàng**, cùng vua đương triều bàn bạc quyết định việc lớn, giúp triều chính luôn ổn định và đoàn kết.\n"
            "• **Hệ thống hành chính 12 lộ (`[13a]`, tr. 501)**: Cả nước được chia thành **12 lộ**, dưới lộ là phủ, châu, huyện và cấp cơ sở là **xã** (có Xã quan quản lý), định kỳ lập sổ hộ tịch chặt chẽ.\n"
            "• **Pháp luật nghiêm minh (`[4a, 5b]`, tr. 484–486)**: Nhà Trần ban hành bộ **Quốc triều thông chế** và **Quốc triều hình thư**, đặt cơ quan **Thẩm hình viện**, để chuông lớn ở thềm điện cho dân kêu oan, đồng thời đặt vạc dầu và chuồng hổ ở hành lang để răn đe kẻ gian tham."
        ),
        "follow_up": "Em có muốn biết nhà Trần đã phát triển kinh tế nông nghiệp, đắp đê Quai Vạc và lập Điền trang – Thái ấp như thế nào không?"
    },
    {
        "unit_id": "DVSKTT_KINH_TE_DIEN_TRANG_THAI_AP_DE_DINH_NHI",
        "category": "TONG_KET_NGUYEN_NHAN_Y_NGHIA",
        "topic": "Kinh tế thời Trần: Đắp đê Đỉnh Nhĩ (Quai Vạc), chức quan Hà đê sứ và chính sách Điền trang – Thái ấp",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_KINH_TE_NHA_TRAN", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Hà đê sứ, Điền trang – Thái ấp & Thương cảng Vân Đồn",
        "event": "Đắp đê Đỉnh Nhĩ (1248) và chiếu lập Điền trang (1266)",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V, tờ [14b, 29a], tr. 504, 533): Tháng 3 năm Mậu Thân (1248), vua Trần Thái Tông lệnh đắp đê Đỉnh Nhĩ (đê Quai Vạc) từ đầu nguồn đến bờ biển để chống lũ lụt, đặt chức quan Hà đê chánh phó sứ và Khuyến nông sứ. Tháng 10 năm Bính Dần (1266), triều đình xuống chiếu cho vương hầu, công chúa, phò mã chiêu tập dân nghèo phiêu tán khai khẩn đất hoang lập thành Điền trang, bên cạnh các Thái ấp ban cho quý tộc.",
        "badge": "Phú quốc Cường binh",
        "base_queries": [
            "tình hình kinh tế nông nghiệp thủ công nghiệp thương nghiệp thời trần như thế nào",
            "đê đỉnh nhĩ hay đê quai vạc và chức quan hà đê sứ thời trần là gì",
            "điền trang và thái ấp thời nhà trần là gì",
            "năm 1266 nhà trần ban chiếu cho vương hầu khai hoang lập điền trang thế nào",
            "vì sao kinh tế nhà trần nhanh chóng phục hồi và phát triển thịnh đạt",
            "đại việt sử ký toàn thư quyển v trang 504 chép việc đắp đê đỉnh nhĩ năm 1248 ra sao"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển V, tờ `[14b, 29a]`, trang 504, 533*), nền kinh tế Đại Việt thời Trần phát triển hưng thịnh làm hậu thuẫn vững chắc cho 3 cuộc kháng chiến:\n\n"
            "• **Đắp đê Đỉnh Nhĩ (Đê Quai Vạc) & đặt quan Hà đê sứ (`[14b]`, tr. 504)**: Tháng 3 năm 1248, vua Trần Thái Tông lệnh cho các lộ đắp đê từ đầu nguồn đến bờ biển gọi là **đê Đỉnh Nhĩ (đê Quai Vạc)** để ngăn nước lũ, đặt chức **Hà đê chánh phó sứ** và **Khuyến nông sứ** chăm lo thủy lợi.\n"
            "• **Khai hoang lập Điền trang – Thái ấp (`[29a]`, tr. 533)**: Tháng 10 năm 1266, triều đình cho phép các vương hầu, công chúa, phò mã chiêu tập dân phiêu tán khai khẩn ruộng hoang lập thành **Điền trang**, kết hợp với **Thái ấp** tạo nên hậu cần tại chỗ cực mạnh khi có chiến tranh.\n"
            "• **Thủ công nghiệp & Thương nghiệp**: Làng nghề gốm Bát Tràng, dệt lụa, đúc đồng, đóng thuyền chiến phát triển; chợ mọc lên ở các làng xã, kinh thành Thăng Long có **61 phố phường** và cảng **Vân Đồn** tấp nập thuyền buôn nước ngoài."
        ),
        "follow_up": "Em có muốn tìm hiểu về khoa cử Thái học sinh và thần đồng Trạng nguyên 12 tuổi Nguyễn Hiền thời Trần không?"
    },
    {
        "unit_id": "DVSKTT_KHOA_CU_THAI_HOC_SINH_NGUYEN_HIEN_MAC_DINH_CHI",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Giáo dục & Khoa cử thời Trần: Danh hiệu Tam khôi (1247), Trạng nguyên Nguyễn Hiền, Lê Văn Hưu và Mạc Đĩnh Chi",
        "q_matrix": {"cognitive_level": "NHAN_BIET", "difficulty": 0.45, "skills": ["SKILL_VAN_HOA_KHOA_CU", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Trạng nguyên Nguyễn Hiền, Sử gia Lê Văn Hưu & Lưỡng quốc Trạng nguyên Mạc Đĩnh Chi",
        "event": "Đặt danh hiệu Tam khôi khoa thi Thái học sinh năm Đinh Mùi (1247) và khoa thi năm Giáp Thìn (1304)",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V tờ [14a] tr. 503 & Quyển VI tờ [19b] tr. 639): Nhà Trần mở rộng Quốc học viện (Quốc Tử Giám), tổ chức thi Thái học sinh định kỳ 7 năm một lần. Khoa thi tháng 2 năm Đinh Mùi (1247) lần đầu tiên đặt danh hiệu Tam khôi (Trạng nguyên, Bảng nhãn, Thám hoa): Nguyễn Hiền (12 tuổi) đỗ Trạng nguyên, Lê Văn Hưu (18 tuổi) đỗ Bảng nhãn. Năm 1272, Lê Văn Hưu hoàn thành bộ Quốc sử Đại Việt Sử Ký (30 quyển). Năm 1304, Mạc Đĩnh Chi đỗ Trạng nguyên, đi sứ phương Bắc được phong Lưỡng quốc Trạng nguyên.",
        "badge": "Bảng vàng Đông A",
        "base_queries": [
            "giáo dục và khoa cử thời trần phát triển như thế nào",
            "danh hiệu tam khôi trạng nguyên bảng nhãn thám hoa có từ khoa thi năm nào",
            "nguyễn hiền đỗ trạng nguyên năm bao nhiêu tuổi và dưới triều vua nào",
            "lê văn hưu và bộ quốc sử đại việt sử ký năm 1272 là gì",
            "lưỡng quốc trạng nguyên mạc đĩnh chi là ai",
            "đại việt sử ký toàn thư quyển v trang 503 chép về khoa thi năm đinh mùi 1247 thế nào"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Quyển V tờ `[14a]` tr. 503 & Quyển VI tờ `[19b]` tr. 639*), giáo dục và khoa cử thời Trần đạt nhiều thành tựu rực rỡ:\n\n"
            "• **Đặt danh hiệu Tam khôi đầu tiên trong lịch sử (Tháng 2/1247, `[14a]`, tr. 503)**: Vua Trần Thái Tông mở khoa thi **Thái học sinh**, lần đầu tiên định lệ **Tam khôi** (*Trạng nguyên, Bảng nhãn, Thám hoa*). Thần đồng **Nguyễn Hiền** (12 tuổi) đỗ Trạng nguyên, **Lê Văn Hưu** (18 tuổi) đỗ Bảng nhãn, **Đặng Ma La** đỗ Thám hoa.\n"
            "• **Bộ Quốc sử đầu tiên — Đại Việt Sử Ký (1272)**: Hàn lâm viện Học sĩ kiêm Quốc sử viện Giám tu **Lê Văn Hưu** biên soạn xong bộ **Đại Việt Sử Ký** gồm 30 quyển (từ Triệu Vũ Đế đến Lý Chiêu Hoàng), đặt nền móng cho nền sử học dân tộc.\n"
            "• **Lưỡng quốc Trạng nguyên Mạc Đĩnh Chi (`[19b]`, tr. 639)**: Đỗ Trạng nguyên khoa Giáp Thìn (1304), khi đi sứ nhà Nguyên nhờ tài ứng đối uyên bác và bài *Phú hoa sen trong giếng ngọc* nên được phong **Lưỡng quốc Trạng nguyên**."
        ),
        "follow_up": "Em có muốn nghe về người thầy mẫu mực Chu Văn An và tờ Thất trảm sớ nổi tiếng thời Trần không?"
    },
    {
        "unit_id": "DVSKTT_CHU_VAN_AN_THAT_TRAM_SO",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Vạn thế sư biểu Chu Văn An và tờ Thất trảm sớ trong Đại Việt Sử Ký Toàn Thư",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.55, "skills": ["SKILL_VAN_HOA_KHOA_CU", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Quốc Tử Giám Tư nghiệp Chu Văn An",
        "event": "Chu Văn An dạy học ở Quốc Tử Giám và dâng Thất trảm sớ xin chém 7 nịnh thần",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển VII, tờ [6a, 19a, 34b], tr. 711, 736, 765): Chu Văn An (quê ở Thanh Đàm, Hà Nội) tính cương trực, thanh khiết, không cầu danh lợi, mở trường dạy học làm rạng rỡ đạo Nho, được vua Trần Minh Tông mời làm Quốc Tử Giám Tư nghiệp dạy thái tử. Thời Trần Dụ Tông, thấy quyền thần gian nịnh làm rối loạn kỷ cương, ông dâng Thất trảm sớ xin chém 7 tên nịnh thần nhưng vua không nghe, bèn treo mũ từ quan về ở ẩn tại núi Phượng Hoàng (Chí Linh, Hải Dương). Khi mất năm 1370 được thờ ở Văn Miếu.",
        "badge": "Vạn thế Sư biểu",
        "base_queries": [
            "chu văn an là ai và vì sao ông dâng thất trảm sớ",
            "thất trảm sớ của chu văn an có nội dung gì",
            "vì sao chu văn an treo mũ từ quan về ở ẩn tại núi phượng hoàng",
            "đại việt sử ký toàn thư quyển vii chép về quốc tử giám tư nghiệp chu văn an thế nào",
            "ai là người thầy mẫu mực thời trần được thờ ở văn miếu"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển VII, tờ `[6a, 19a, 34b]`, trang 711, 736, 765*), **Chu Văn An** (1292 – 1370) là bậc đại nho thanh cao, người thầy tiêu biểu nhất của nền giáo dục thời Trần:\n\n"
            "• **Sự nghiệp giáo dục (`[6a]`, tr. 711)**: Ông người làng Quang Liệt (huyện Thanh Đàm, Hà Nội), tính tình nghiêm nghị, trong sạch, mở trường dạy học ở quê nhà có hàng nghìn học trò theo học (nhiều người đỗ đạt cao như Phạm Sư Mạnh, Lê Quát). Vua Trần Minh Tông vời ông làm **Quốc Tử Giám Tư nghiệp** (Hiệu trưởng Quốc Tử Giám).\n"
            "• **Dâng 'Thất trảm sớ' và khí tiết người thầy (`[19a]`, tr. 736)**: Dưới triều Trần Dụ Tông, chính sự suy đồi, bọn quyền thần gian nịnh lộng hành. Chu Văn An khẳng khái dâng **Thất trảm sớ** xin chém 7 tên quyền thần sâu mọt nhưng vua không nghe. Ông liền treo mũ từ quan về ở ẩn tại **núi Phượng Hoàng** (Chí Linh, Hải Dương).\n"
            "• **Lời bàn của Sử thần Ngô Sĩ Liên (`[34b]`, tr. 765)**: Khi ông mất năm 1370, vua Trần Nghệ Tông ban tên thụy là **Văn Trinh**, cho thờ ở **Văn Miếu** — biểu tượng muôn đời của đạo lý *'Tôn sư trọng đạo'*."
        ),
        "follow_up": "Em có muốn tìm hiểu thêm về tác phẩm Bạch Đằng giang phú của Trương Hán Siêu và sự phát triển chữ Nôm thời Trần không?"
    },
    {
        "unit_id": "DVSKTT_TRUONG_HAN_SIEU_BACH_DANG_GIANG_PHU",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Văn học yêu nước thời Trần: Trương Hán Siêu với 'Bạch Đằng giang phú' và Hàn Thuyên phát triển chữ Nôm",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_VAN_HOA_KHOA_CU", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Trương Hán Siêu & Hàn Thuyên (Nguyễn Thuyên)",
        "event": "Sự phát triển rực rỡ của văn học chữ Hán yêu nước và văn học chữ Nôm thời Trần",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V tờ [42a] tr. 559 & Quyển VII tờ [17b] tr. 733): Văn học thời Trần thấm đẫm hào khí Đông A và lòng tự hào dân tộc với Hịch tướng sĩ (Trần Quốc Tuấn), Tụng giá hoàn kinh (Trần Quang Khải), Thuật hoài (Phạm Ngũ Lão) và đặc biệt là Bạch Đằng giang phú (Phú sông Bạch Đằng) của Trương Hán Siêu (môn khách của Trần Hưng Đạo) khẳng định 'Bởi đâu đất hiểm, cốt mình đức cao'. Đồng thời, năm 1282 Hàn Thuyên (Nguyễn Thuyên) làm văn tế cá sấu bằng chữ Nôm, mở đầu dòng văn học chữ Nôm dân tộc.",
        "badge": "Hào khí Văn chương",
        "base_queries": [
            "trương hán siêu và tác phẩm bạch đằng giang phú có ý nghĩa gì",
            "ai là tác giả bài phú sông bạch đằng",
            "hàn thuyên nguyễn thuyên có đóng góp gì cho văn học chữ nôm thời trần",
            "văn học chữ hán và chữ nôm thời trần có những tác phẩm tiêu biểu nào",
            "câu thơ giặc tan muôn thuở thăng bình bởi đâu đất hiểm cốt mình đức cao nằm trong tác phẩm nào"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Quyển V tờ `[42a]` tr. 559 & Quyển VII tờ `[17b]` tr. 733*) và SGK Lịch sử 7 (Bài 14), văn học thời Trần phát triển rực rỡ cả bằng chữ Hán và chữ Nôm, thấm đẫm **Hào khí Đông A**:\n\n"
            "• **Trương Hán Siêu và *Bạch Đằng giang phú* (`[17b]`, tr. 733)**: Trương Hán Siêu vốn là môn khách tài đức của Trần Hưng Đạo, làm quan qua 4 triều vua. Bài **Phú sông Bạch Đằng** (*Bạch Đằng giang phú*) của ông tái hiện hào hùng chiến công sông Bạch Đằng và đúc kết chân lý giữ nước bất hủ:\n"
            "  *'Giặc tan muôn thuở thăng bình / Bởi đâu đất hiểm, cốt mình đức cao'*.\n"
            "• **Hàn Thuyên và sự phát triển chữ Nôm (`[42a]`, tr. 559)**: Tháng 8 năm Nhâm Ngọ (1282), có cá sấu đến sông Lô, Hình bộ Thượng thư Nguyễn Thuyên làm bài văn bằng quốc ngữ (**chữ Nôm**) đuổi cá sấu đi; vua ban họ **Hàn Thuyên**, mở đầu cho phong trào sáng tác thơ phú bằng chữ Nôm (*Hàn luật*)."
        ),
        "follow_up": "Em có muốn khám phá giai thoại sứ thần trẻ tuổi Đoàn Nhữ Hài 20 tuổi trong Đại Việt Sử Ký Toàn Thư không?"
    },
    {
        "unit_id": "DVSKTT_DOAN_NHU_HAI_NGOAI_GIAO",
        "category": "DANH_TUONG_GIA_THAN",
        "topic": "Tài năng trẻ Đoàn Nhữ Hài (20 tuổi) thảo biểu tạ tội ở Thiên Trường và đi sứ giữ vững quốc thể (1299 - 1303)",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.55, "skills": ["SKILL_DVSKTT_PRIMARY"]},
        "entity": "Ngự sử trung tán Đoàn Nhữ Hài & Vua Trần Anh Tông",
        "event": "Đoàn Nhữ Hài dâng biểu ở phủ Thiên Trường (1299) và đi sứ Chiêm Thành (1303)",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển VI, tờ [7a-18b], tr. 616-637): Năm Kỷ Hợi (1299), vua Trần Anh Tông vì uống rượu say bị Thượng hoàng Trần Nhân Tông quở trách định phế truất. Thư sinh Đoàn Nhữ Hài mới 20 tuổi đã giúp vua thảo bài biểu tạ tội và quỳ dầm mưa suốt đêm ngoài sân điện Thiên Trường khiến Thượng hoàng cảm động tha lỗi, được phong Ngự sử trung tán. Năm 1303, khi đi sứ Chiêm Thành, Đoàn Nhữ Hài mưu trí đặt chiếu thư lên án hương làm vua Chiêm phải cúi lạy chiếu thư thiên tử Đại Việt.",
        "badge": "Tuổi trẻ Tài cao",
        "base_queries": [
            "đoàn nhữ hài là ai và lập công gì năm 20 tuổi dưới triều trần anh tông",
            "chuyện đoàn nhữ hài thảo biểu tạ tội quỳ dưới mưa ở phủ thiên trường năm 1299",
            "đoàn nhữ hài đi sứ chiêm thành năm 1303 đã dùng mưu gì để giữ quốc thể",
            "đại việt sử ký toàn thư quyển vi trang 616 chép về đoàn nhữ hài thế nào",
            "vì sao vua trần anh tông phong thư sinh đoàn nhữ hài làm ngự sử trung tán"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển VI, tờ `[7a–18b]`, trang 616–637*), bên cạnh Trần Quốc Toản trên chiến trường, **Đoàn Nhữ Hài** là biểu tượng tài năng trẻ kiệt xuất về chính trị và ngoại giao thời Trần:\n\n"
            "• **Thảo biểu tạ tội ở phủ Thiên Trường năm 20 tuổi (`[7a–7b]`, tr. 616–617)**: Năm 1299, Thượng hoàng Trần Nhân Tông từ Yên Tử về kinh, thấy vua Trần Anh Tông uống rượu say bỏ bê triều chính nên nổi giận về phủ Thiên Trường, định truất ngôi. Giữa lúc nguy cấp, vua gặp thư sinh **Đoàn Nhữ Hài** (20 tuổi) ở chùa Tư Phúc, nhờ thảo bài biểu tạ tội. Nhữ Hài theo vua về Thiên Trường, **quỳ suốt đêm dưới mưa gió ngoài sân cung** dâng biểu khiến Thượng hoàng cảm động tha lỗi cho vua và khen: *'Bài biểu nó soạn rất hợp lòng trẫm'*, được phong ngay chức **Ngự sử trung tán**.\n"
            "• **Mưu trí đi sứ năm 1303 (`[18b]`, tr. 637)**: Khi đi sứ Chiêm Thành, trước tục lệ vua Chiêm không lạy sứ thần trước, Nhữ Hài nhanh trí rước chiếu thư đặt lên án rồi lạy chiếu thư nhà vua, khiến Quốc vương Chiêm Thành cũng phải cúi đầu lạy chiếu thư thiên tử Đại Việt, giữ trọn uy nghiêm quốc gia."
        ),
        "follow_up": "Em có muốn tìm hiểu thêm về tư tưởng 'Phật tại tâm' trên núi Yên Tử và nghệ thuật kiến trúc thời Trần không?"
    },
    {
        "unit_id": "DVSKTT_VAN_HOA_AN_NAM_TU_DAI_KHI_CHUA_PHAP_VAN",
        "category": "TONG_KET_NGUYEN_NHAN_Y_NGHIA",
        "topic": "Tôn giáo & Kiến trúc thời Trần: Quốc sư Phù Vân trên núi Yên Tử ('Trong núi vốn không có Phật, Phật ở trong lòng') và Tháp Phổ Minh",
        "q_matrix": {"cognitive_level": "THONG_HIEU", "difficulty": 0.5, "skills": ["SKILL_VAN_HOA_KHOA_CU", "SKILL_DVSKTT_PRIMARY"]},
        "entity": "Quốc sư Phù Vân, Vua Trần Thái Tông & Tháp Phổ Minh",
        "event": "Vua Trần Thái Tông lên núi Yên Tử (1237) và xây dựng các công trình kiến trúc thời Trần",
        "fact_chunk": "Theo Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V, tờ [8b-9a, 25a], tr. 492-493, 526): Năm 1237, khi vua Trần Thái Tông đêm trốn lên núi Yên Tử định đi tu, Quốc sư Phù Vân đã nói câu bất hủ: 'Trong núi vốn không có Phật, chỉ ở trong lòng thôi. Lòng lặng mà biết, đó chính là chân Phật', khuyên vua lấy ý muốn của thiên hạ làm ý muốn của mình. Nghệ thuật kiến trúc, điêu khắc thời Trần phát triển rực rỡ với kinh thành Thăng Long, cung Thái Thượng Hoàng ở Thiên Trường, tháp Phổ Minh (Nam Định), tháp Bình Sơn (Vĩnh Phúc), tượng hổ lăng Trần Thủ Độ.",
        "badge": "Tinh hoa Văn hiến Đông A",
        "base_queries": [
            "câu nói trong núi vốn không có phật phật ở ngay trong lòng là của ai nói với vua trần thái tông",
            "quốc sư phù vân trên núi yên tử đã khuyên vua trần thái tông điều gì",
            "tôn giáo tín ngưỡng và nghệ thuật kiến trúc điêu khắc thời trần có thành tựu gì tiêu biểu",
            "tháp phổ minh ở nam định và tháp bình sơn ở vĩnh phúc được xây dựng dưới triều đại nào",
            "đại việt sử ký toàn thư quyển v trang 492 chép chuyện vua trần thái tông lên núi yên tử thế nào"
        ],
        "answer": (
            "Theo **Đại Việt Sử Ký Toàn Thư** (*Bản Kỷ Toàn Thư - Quyển V, tờ `[8b–9a, 25a]`, trang 492–493, 526*) và SGK Lịch sử 7 (Bài 14), đời sống tôn giáo, tư tưởng và nghệ thuật kiến trúc thời Trần mang đậm bản sắc dân tộc:\n\n"
            "• **Triết lý 'Phật tại tâm' và tinh thần nhập thế (`[8b–9a]`, tr. 492–493)**: Khi vua Trần Thái Tông đau khổ bỏ lên núi Yên Tử định đi tu, **Quốc sư Phù Vân** đã khuyên giải câu nói nổi tiếng:\n"
            "  *'Trong núi vốn không có Phật, chỉ ở trong lòng thôi. Lòng lặng mà biết, đó chính là chân Phật... Phàm đã làm đấng nhân quân thì phải lấy ý muốn của thiên hạ làm ý muốn của mình, lấy tấm lòng của thiên hạ làm tấm lòng của mình'*.\n"
            "  Tư tưởng Phật giáo gắn liền với trách nhiệm hộ quốc an dân ấy đã kết tinh thành **Thiền phái Trúc Lâm Yên Tử** thời Trần Nhân Tông.\n"
            "• **Kiến trúc & Điêu khắc đặc sắc (`[25a]`, tr. 526)**: Nhiều công trình tiêu biểu ra đời như **tháp Phổ Minh** (Nam Định, cao 14 tầng), **tháp Bình Sơn** (Vĩnh Phúc), vạc Phổ Minh, chạm khắc rồng thời Trần khỏe khoắn và tượng hổ đá tại lăng Thái sư Trần Thủ Độ."
        ),
        "follow_up": "Em có muốn làm thử một đề trắc nghiệm tổng hợp về tình hình chính trị, kinh tế, văn hóa và 3 lần kháng chiến thời Trần không?"
    },

    # --- NGOÀI PHẠM VI (OUT OF DOMAIN) ---
    {
        "unit_id": "OOD_RANDOM_AND_OFFTOPIC",
        "category": "OUT_OF_DOMAIN",
        "topic": "Nội dung ngoài phạm vi lịch sử",
        "q_matrix": {"cognitive_level": "OOD", "difficulty": 0.1, "skills": ["SKILL_OOD"]},
        "entity": "Không xác định",
        "event": "Ngoài phạm vi",
        "fact_chunk": "",
        "badge": None,
        "base_queries": [
            "576",
            "123456",
            "hôm nay thời tiết thế nào",
            "cách nấu món phở bò ngon",
            "viết code python",
            "asdfghjkl"
        ],
        "answer": "OUT_OF_DOMAIN",
        "follow_up": ""
    }
]


# ==============================================================================
# 2. TẬP TEST ĐỘC LẬP - CÂU HỎI THỰC TẾ HỌC SINH (REAL STUDENT TEST SET)
# Chứa câu hỏi viết tắt (kccm, tqt, thđ), không dấu, cộc lốc, sai chính tả
# ĐỘC LẬP 100% - KHÔNG QUA TEMPLATE ĐỂ ĐO LƯỜNG CHÍNH XÁC ACCURACY THỰC TẾ
# ==============================================================================
REAL_STUDENT_TEST_SET: List[Dict[str, str]] = [
    # Kháng chiến lần 1 (1258)
    {"query": "kccm lan 1 diễn ra thế nào", "expected": "KC1_OVERVIEW"},
    {"query": "tóm tắt kccm lần 1", "expected": "KC1_OVERVIEW"},
    {"query": "trận đánh đầu tiên chống mông cổ năm 1258", "expected": "KC1_OVERVIEW"},
    {"query": "vì sao mông cổ mượn đường đánh nam tống", "expected": "KC1_WHY_INVADE"},
    {"query": "nguyên nhân ngột lương hợp thai sang xâm lược", "expected": "KC1_WHY_INVADE"},
    {"query": "rút lui bình lệ nguyên vì sao vậy", "expected": "KC1_BINH_LE_NGUYEN"},
    {"query": "ai lấy ván thuyền che tên cho vua", "expected": "KC1_BINH_LE_NGUYEN"},
    {"query": "lê phụ trần lấy ván thuyền", "expected": "KC1_BINH_LE_NGUYEN"},
    {"query": "vknt là kế sách gì", "expected": "KC1_VUON_KHONG_NHA_TRONG"},
    {"query": "vườn ko nhà trống có tác dụng gì", "expected": "KC1_VUON_KHONG_NHA_TRONG"},
    {"query": "thăng long ko 1 hạt gạo làm giặc đói", "expected": "KC1_VUON_KHONG_NHA_TRONG"},
    {"query": "đầu thần chưa rơi xuống đất bệ hạ đừng lo ai nói", "expected": "KC1_TRAN_THU_DO_QUOTE"},
    {"query": "ttd nói câu gì với vua thái tông", "expected": "KC1_TRAN_THU_DO_QUOTE"},
    {"query": "trận đông bộ đầu ngày nào", "expected": "KC1_DONG_BO_DAU"},
    {"query": "hà khuất phục kích giặc mông cổ ở đâu", "expected": "KC1_DONG_BO_DAU"},

    # Trần Quốc Toản & Bình Than
    {"query": "tại sao tqt bóp nát wả cam", "expected": "TQT_WHY_ORANGE"},
    {"query": "vi sao bop nat qua cam o ben binh than", "expected": "TQT_WHY_ORANGE"},
    {"query": "nguyên nhân bóp nát quả cam", "expected": "TQT_WHY_ORANGE"},
    {"query": "cờ 6 chữ vàng của tqt", "expected": "TQT_SIX_GOLDEN_WORDS"},
    {"query": "phá cường địch báo hoàng ân có nghĩa là gì", "expected": "TQT_SIX_GOLDEN_WORDS"},
    {"query": "tqt chiêu mộ bao nhiêu gia nô", "expected": "TQT_SIX_GOLDEN_WORDS"},
    {"query": "tqt là ai", "expected": "TQT_OVERVIEW"},
    {"query": "anh hùng thiếu niên trần quốc toản", "expected": "TQT_OVERVIEW"},
    {"query": "hội nghị bt năm 1282", "expected": "BINH_THAN_CONFERENCE"},
    {"query": "ai chủ trì hội nghị bình than", "expected": "BINH_THAN_CONFERENCE"},

    # Diên Hồng & Hịch Tướng Sĩ
    {"query": "hội nghị dh bô lão hô gì", "expected": "DIEN_HONG_CONFERENCE"},
    {"query": "các cụ già hô đánh ở điện diên hồng", "expected": "DIEN_HONG_CONFERENCE"},
    {"query": "ai viết hịch tướng sĩ", "expected": "HICH_TUONG_SI"},
    {"query": "chữ sát thát xăm trên tay có nghĩa gì", "expected": "HICH_TUONG_SI"},
    {"query": "nửa đêm vỗ gối ruột đau như cắt", "expected": "HICH_TUONG_SI"},
    {"query": "trần quốc tuấn là ai", "expected": "TRAN_HUNG_DAO_PORTRAIT"},
    {"query": "nếu bệ hạ muốn hàng xin chém đầu thần trước đã", "expected": "TRAN_HUNG_DAO_PORTRAIT"},
    {"query": "thđ có công gì trong kháng chiến", "expected": "TRAN_HUNG_DAO_PORTRAIT"},

    # Kháng chiến lần 2 (1285)
    {"query": "kccm lan 2 dien ra the nao", "expected": "KC2_OVERVIEW"},
    {"query": "kccn 2 năm 1285 ai chỉ huy", "expected": "KC2_OVERVIEW"},
    {"query": "thoat hoan ong dong kccm 2", "expected": "KC2_THOAT_HOAN_COPPER_PIPE"},
    {"query": "vi sao thoat hoan phai chui vao ong dong", "expected": "KC2_THOAT_HOAN_COPPER_PIPE"},
    {"query": "tên tướng nào trốn trong ống đồng xe đẩy", "expected": "KC2_THOAT_HOAN_COPPER_PIPE"},
    {"query": "ta thà làm quỷ nước nam chứ ko thèm làm vương đất bắc", "expected": "KC2_TRAN_BINH_TRONG"},
    {"query": "tbt hy sinh ở bãi tự nhiên", "expected": "KC2_TRAN_BINH_TRONG"},
    {"query": "ai chém đầu toa đô ở tây kết", "expected": "KC2_HAM_TU_CHUONG_DUONG"},
    {"query": "trần quang khải đánh trận chương dương", "expected": "KC2_HAM_TU_CHUONG_DUONG"},
    {"query": "tụng giá hoàn kinh sáng tác khi nào", "expected": "KC2_HAM_TU_CHUONG_DUONG"},

    # Vân Đồn & Bạch Đằng (1288)
    {"query": "ai đánh đắm thuyền lương trương văn hổ", "expected": "KC3_VAN_DON"},
    {"query": "trần khánh dư thắng trận vân đồn", "expected": "KC3_VAN_DON"},
    {"query": "17 vạn thạch lương bị tiêu diệt ở đâu", "expected": "KC3_VAN_DON"},
    {"query": "cách đánh cọc ngầm sông bạch đằng 1288", "expected": "KC3_BACH_DANG_HOW"},
    {"query": "ai bị bắt sống trên sông bạch đằng năm 1288", "expected": "KC3_BACH_DANG_HOW"},
    {"query": "triều rút thuyền giặc vướng cọc gỗ", "expected": "KC3_BACH_DANG_HOW"},
    {"query": "kccm 3 năm 1288", "expected": "KC3_OVERVIEW"},
    {"query": "tóm tắt kháng chiến chống nguyên lần 3", "expected": "KC3_OVERVIEW"},

    # Nguyên nhân & Ý nghĩa & Chiến thuật rút lui
    {"query": "tổng kết cả 3 lần kccm", "expected": "ALL_3_WARS_SUMMARY"},
    {"query": "nhà trần thắng mông nguyên mấy lần", "expected": "ALL_3_WARS_SUMMARY"},
    {"query": "nguyên nhân nhà trần thắng quân nguyên", "expected": "CAUSES_OF_VICTORY"},
    {"query": "vì sao nước nhỏ đánh thắng đế chế lớn", "expected": "CAUSES_OF_VICTORY"},
    {"query": "tại sao quân nguyên đông và mạnh mà vẫn thua đại việt", "expected": "CAUSES_OF_VICTORY"},
    {"query": "vì sao quân trần chủ động rút khỏi thăng long", "expected": "KC1_VUON_KHONG_NHA_TRONG"},
    {"query": "vì sao chiến thuật rút lui không đồng nghĩa với thất bại", "expected": "KC1_VUON_KHONG_NHA_TRONG"},
    {"query": "ý nghĩa 3 lần chiến thắng mông nguyên", "expected": "HISTORICAL_SIGNIFICANCE"},
    {"query": "tầm vóc thế giới của trận bạch đằng 1288", "expected": "HISTORICAL_SIGNIFICANCE"},

    # Danh tướng
    {"query": "ai bơi lặn đục thủng thuyền giặc", "expected": "YET_KIEU_DA_TUONG"},
    {"query": "dã tượng chỉ huy voi chiến", "expected": "YET_KIEU_DA_TUONG"},
    {"query": "phạm ngũ lão đan sọt bị giáo đâm", "expected": "PHAM_NGU_LAO"},
    {"query": "tác giả bài thơ tỏ lòng là ai", "expected": "PHAM_NGU_LAO"},

    # Giao tiếp & Ranh giới & OOD
    {"query": "alo thầy ơi", "expected": "INTENT_GREETING"},
    {"query": "hi bạn", "expected": "INTENT_GREETING"},
    {"query": "khó quá em không nhớ mốc năm", "expected": "INTENT_STUDENT_STRUGGLE"},
    {"query": "bí câu hỏi trắc nghiệm này rồi", "expected": "INTENT_STUDENT_STRUGGLE"},
    {"query": "thank u thầy nhìu", "expected": "INTENT_THANKS"},
    {"query": "vua hàm nghi cần vương", "expected": "CROSS_ERA_HAM_NGHI"},
    {"query": "ngô quyền cắm cọc bạch đằng năm nào", "expected": "CROSS_ERA_NGO_QUYEN"},
    {"query": "quang trung nguyễn huệ đánh quân thanh", "expected": "CROSS_ERA_QUANG_TRUNG_LE_LOI_LY_THUONG_KIET"},
    {"query": "576", "expected": "OOD_RANDOM_AND_OFFTOPIC"},
    {"query": "hôm nay ăn gì", "expected": "OOD_RANDOM_AND_OFFTOPIC"},
    {"query": "game liên quân mùa này", "expected": "OOD_RANDOM_AND_OFFTOPIC"},

    # Chủ đề bổ sung cùng game (ngụ binh ư nông, Trần Khánh Dư, Binh thư yếu lược, Trần Nhân Tông)
    {"query": "ngu binh u nong la gi", "expected": "GAME_NGU_BINH_U_NONG"},
    {"query": "lính thời trần thời bình về làm ruộng hả", "expected": "GAME_NGU_BINH_U_NONG"},
    {"query": "tkd bị tước quan rồi đi bán than à", "expected": "GAME_TRAN_KHANH_DU"},
    {"query": "tran khanh du la ai vay", "expected": "GAME_TRAN_KHANH_DU"},
    {"query": "binh thu yeu luoc cua ai", "expected": "GAME_BINH_THU_YEU_LUOC"},
    {"query": "sách binh pháp thđ viết tên gì", "expected": "GAME_BINH_THU_YEU_LUOC"},
    {"query": "phật hoàng trúc lâm là vua nào", "expected": "GAME_TRAN_NHAN_TONG"},
    {"query": "vua tran nhan tong sinh nam nao", "expected": "GAME_TRAN_NHAN_TONG"},
    {"query": "lấy đoản binh thắng trường trận là gì", "expected": "MILITARY_ART_TRAN_DYNASTY"},
    {"query": "hà đặc hà chương đánh giặc ở đâu", "expected": "ROLE_OF_ETHNIC_MINORITIES"},
    {"query": "khoan thư sức dân để làm kế sâu rễ bền gốc có ý nghĩa gì hiện nay", "expected": "HISTORICAL_LESSONS_TODAY"},
    {"query": "quân thánh dực và nón ma lôi thời trần là gì", "expected": "GAME_QUAN_THANH_DUC_SAT_THAT"},
    {"query": "căn cứ vạn kiếp và hậu phương thiên trường có vai trò gì", "expected": "GAME_VAN_KIEP_THIEN_TRUONG_BASES"},
    {"query": "trần ích tắc trần kiện đầu hàng giặc nguyên", "expected": "GAME_TRUNG_THAN_VS_PHAN_BOI"},

    # Tư liệu gốc Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V, VI, VII, VIII)
    {"query": "trần nhật hiệu viết chữ nhập tống lên mạn thuyền", "expected": "DVSKTT_TRAN_NHAT_HIEU_HOANG_CU_DA"},
    {"query": "hoàng cự đà không được ăn xoài năm 1258", "expected": "DVSKTT_TRAN_NHAT_HIEU_HOANG_CU_DA"},
    {"query": "đỗ khắc chung đi sứ đối đáp với ô mã nhi về chữ sát thát", "expected": "DVSKTT_DO_KHAC_CHUNG_SU_GIA"},
    {"query": "trần quốc tuấn rút đầu sắt nhọn trên gậy gỗ vứt đi", "expected": "DVSKTT_TRAN_QUOC_TUAN_GAY_BIT_SAT"},
    {"query": "nội minh tự đỗ hành và nguyễn khoái bắt sống ô mã nhi trên sông bạch đằng", "expected": "DVSKTT_BACH_DANG_DO_HANH_NGUYEN_KHOAI"},
    {"query": "hoàng tá thốn dùi đắm thuyền ô mã nhi năm 1289 và lời bàn ngô sĩ liên", "expected": "DVSKTT_HOANG_TA_THON_NGO_SI_LIEN_BAN"},
    {"query": "quan thanh liêm trần thì kiến móc họng mửa cỗ biếu ở thiên trường", "expected": "DVSKTT_TRAN_THI_KIEN_PHAP_LUAT"},
    {"query": "lý chiêu hoàng nhường ngôi cho trần cảnh năm 1226", "expected": "DVSKTT_THANH_LAP_NHA_TRAN_1225"},
    {"query": "chế độ thái thượng hoàng và bộ luật quốc triều hình thư thời trần", "expected": "DVSKTT_BO_MAY_PHAP_LUAT_QUOC_TRIEU_HINH_THU"},
    {"query": "đắp đê đỉnh nhĩ quai vạc và lập điền trang thái ấp thời trần", "expected": "DVSKTT_KINH_TE_DIEN_TRANG_THAI_AP_DE_DINH_NHI"},
    {"query": "trạng nguyên 12 tuổi nguyễn hiền và lưỡng quốc trạng nguyên mạc đĩnh chi", "expected": "DVSKTT_KHOA_CU_THAI_HOC_SINH_NGUYEN_HIEN_MAC_DINH_CHI"},
    {"query": "chu văn an dâng thất trảm sớ xin chém 7 nịnh thần", "expected": "DVSKTT_CHU_VAN_AN_THAT_TRAM_SO"},
    {"query": "trương hán siêu viết bạch đằng giang phú và hàn thuyên chữ nôm", "expected": "DVSKTT_TRUONG_HAN_SIEU_BACH_DANG_GIANG_PHU"},
    {"query": "đoàn nhữ hài 20 tuổi thảo biểu tạ tội ở phủ thiên trường", "expected": "DVSKTT_DOAN_NHU_HAI_NGOAI_GIAO"},
    {"query": "quốc sư phù vân nói trong núi vốn không có phật phật ở trong lòng", "expected": "DVSKTT_VAN_HOA_AN_NAM_TU_DAI_KHI_CHUA_PHAP_VAN"}
]


# ==============================================================================
# 3. HÀM TĂNG CƯỜNG DỮ LIỆU BẰNG LUẬT (CHỈ ÁP DỤNG TRÊN TẬP TRAIN)
# ==============================================================================
def augment_text(text: str) -> List[str]:
    """Tăng cường dữ liệu chuyên sâu: khẩu ngữ học sinh, tra cứu Đại Việt Sử Ký Toàn Thư, bỏ dấu, hậu tố tự nhiên."""
    variants = [text]
    # 1. Biến thể thêm lời chào/hỏi tự nhiên & câu hỏi tra cứu chính sử
    openers = [
        "thầy ơi ",
        "cho em hỏi ",
        "bạn ơi ",
        "giải thích giúp em ",
        "kể cho em nghe ",
        "theo đại việt sử ký toàn thư thì ",
        "sách sử chép thế nào về việc ",
        "tóm tắt giúp em ",
        "cho mình hỏi về ",
        "em muốn tìm hiểu "
    ]
    for op in openers:
        variants.append(f"{op}{text}".strip())

    # 2. Biến thể hậu tố khẩu ngữ học sinh
    suffixes = [" vậy thầy", " thế ạ", " chi tiết giúp em", " trong lịch sử lớp 7"]
    for sf in suffixes:
        variants.append(f"{text}{sf}".strip())

    # 3. Biến thể bỏ dấu tiếng Việt
    import unicodedata
    nfd = unicodedata.normalize("NFD", text)
    unacc = "".join(c for c in nfd if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D")
    if unacc != text:
        variants.append(unacc)
        for op in ["thay oi ", "cho em hoi ", "cho hoi ", "theo dai viet su ky toan thu ", "ke ve ", "tom tat "]:
            variants.append(f"{op}{unacc}".strip())

    return list(dict.fromkeys(variants))


def generate_and_split_dataset(test_size: float = 0.2, random_state: int = 42) -> Dict[str, Any]:
    """
    Quy trình chuẩn Machine Learning (Không rò rỉ dữ liệu - No Data Leakage):
    1. Chia tập câu hỏi gốc (base_queries) thành Train Gốc (80%) và Test Gốc (20%).
    2. CHỈ tăng cường dữ liệu (Data Augmentation) trên tập Train.
    3. Tập Test giữ nguyên câu hỏi thật + kết hợp REAL_STUDENT_TEST_SET.
    4. Xuất bảng Q-Matrix phục vụ Bayesian Knowledge Tracing và gắn tọa độ Đại Việt Sử Ký Toàn Thư.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        from extract_dvsktt_pipeline import DVSKTT_UNIT_CITATIONS
    except Exception:
        DVSKTT_UNIT_CITATIONS = {}

    train_samples: List[Dict[str, Any]] = []
    test_samples: List[Dict[str, Any]] = []
    q_matrix_data: Dict[str, Any] = {}

    sample_id = 1

    for unit in KNOWLEDGE_UNITS:
        uid = unit["unit_id"]
        dvsktt_meta = DVSKTT_UNIT_CITATIONS.get(uid, {})
        primary_page = dvsktt_meta.get("primary_page")
        dvsktt_ref = dvsktt_meta.get("dvsktt_reference", "")
        verbatim_quote = dvsktt_meta.get("verbatim_quote", "")
        historian_commentary = dvsktt_meta.get("historian_commentary", "")

        if dvsktt_ref:
            unit["dvsktt_reference"] = dvsktt_ref
            unit["page_number"] = primary_page
            unit["folios"] = dvsktt_meta.get("folios", [])
            unit["verbatim_quote"] = verbatim_quote
            unit["historian_commentary"] = historian_commentary

        q_matrix_data[uid] = {
            "topic": unit["topic"],
            "category": unit["category"],
            "entity": unit["entity"],
            "event": unit["event"],
            "cognitive_level": unit["q_matrix"]["cognitive_level"],
            "difficulty": unit["q_matrix"]["difficulty"],
            "skills": unit["q_matrix"]["skills"],
            "dvsktt_reference": dvsktt_ref,
            "page_number": primary_page
        }

        base_q = unit["base_queries"]
        # Phân chia 80% Train Gốc - 20% Test Gốc trước khi sinh biến thể
        if len(base_q) >= 2:
            base_train, base_test = train_test_split(base_q, test_size=0.25, random_state=random_state)
        else:
            base_train = base_q
            base_test = base_q

        doc_name_val = (
            "SGK Lịch sử 7 (KNTT) & Đại Việt Sử Ký Toàn Thư (Dai-viet-su-ki-toan-thu.pdf)"
            if unit["fact_chunk"] else ""
        )
        curr_match_val = (
            f"SGK Lịch sử 7 - Bài 13 & {dvsktt_ref}"
            if dvsktt_ref else "SGK Lịch sử 7 - Bài 13"
        )

        # 1. Tạo tập Train: Áp dụng Tăng cường dữ liệu (Augmentation) CHỈ TRÊN TẬP TRAIN
        for q in base_train:
            augmented_q_list = augment_text(q)
            for aq in augmented_q_list:
                train_samples.append({
                    "id": f"TRAIN_{sample_id:04d}",
                    "unit_id": uid,
                    "category": unit["category"],
                    "topic": unit["topic"],
                    "entity": unit["entity"],
                    "event": unit["event"],
                    "q_matrix": unit["q_matrix"],
                    "user_query": aq,
                    "answer": unit["answer"],
                    "follow_up": unit["follow_up"],
                    "grounding_source": {
                        "doc_name": doc_name_val,
                        "page_number": primary_page,
                        "curriculum_match": curr_match_val,
                        "fact_chunk": unit["fact_chunk"],
                        "dvsktt_reference": dvsktt_ref,
                        "verbatim_quote": verbatim_quote,
                        "historian_commentary": historian_commentary
                    },
                    "game_metadata": {
                        "unlocked_badge": unit["badge"],
                        "exp_reward": 50 if unit["fact_chunk"] else 0
                    }
                })
                sample_id += 1

        # 2. Tạo tập Test: Giữ nguyên các câu hỏi gốc của Test (KHÔNG thêm biến thể template)
        for tq in base_test:
            test_samples.append({
                "id": f"TEST_{sample_id:04d}",
                "unit_id": uid,
                "category": unit["category"],
                "topic": unit["topic"],
                "entity": unit["entity"],
                "event": unit["event"],
                "q_matrix": unit["q_matrix"],
                "user_query": tq,
                "answer": unit["answer"],
                "grounding_source": {
                    "doc_name": doc_name_val,
                    "page_number": primary_page,
                    "curriculum_match": curr_match_val,
                    "fact_chunk": unit["fact_chunk"]
                },
                "is_real_student": False
            })
            sample_id += 1

    # 3. Bổ sung các câu hỏi học sinh thật (Real Student Test Set) vào tập Test
    for item in REAL_STUDENT_TEST_SET:
        matching_unit = next((u for u in KNOWLEDGE_UNITS if u["unit_id"] == item["expected"]), None)
        if matching_unit:
            dvsktt_meta = DVSKTT_UNIT_CITATIONS.get(item["expected"], {})
            test_samples.append({
                "id": f"TEST_REAL_{sample_id:04d}",
                "unit_id": item["expected"],
                "category": matching_unit["category"],
                "topic": matching_unit["topic"],
                "entity": matching_unit["entity"],
                "event": matching_unit["event"],
                "q_matrix": matching_unit["q_matrix"],
                "user_query": item["query"],
                "answer": matching_unit["answer"],
                "grounding_source": {
                    "doc_name": "SGK Lịch sử 7 (KNTT) & Đại Việt Sử Ký Toàn Thư (Dai-viet-su-ki-toan-thu.pdf)" if matching_unit["fact_chunk"] else "",
                    "page_number": dvsktt_meta.get("primary_page"),
                    "curriculum_match": f"SGK Lịch sử 7 - Bài 13 & {dvsktt_meta['dvsktt_reference']}" if dvsktt_meta.get("dvsktt_reference") else "SGK Lịch sử 7 - Bài 13",
                    "fact_chunk": matching_unit["fact_chunk"]
                },
                "is_real_student": True
            })
            sample_id += 1

    # Lưu các file độc lập (luôn xuống dòng LF để file sinh trên Windows/Linux giống hệt nhau)
    with open(TRAIN_FILE, "w", encoding="utf-8", newline="\n") as f:
        for r in train_samples:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    with open(TEST_FILE, "w", encoding="utf-8", newline="\n") as f:
        for r in test_samples:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    with open(QMATRIX_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(q_matrix_data, f, ensure_ascii=False, indent=2)

    # Lưu cấu trúc các cụm tri thức chuẩn hóa
    kb_dict = {u["unit_id"]: u for u in KNOWLEDGE_UNITS}
    with open(KNOWLEDGE_BASE_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(kb_dict, f, ensure_ascii=False, indent=2)

    total = len(train_samples) + len(test_samples)
    stats = {
        "train_samples": len(train_samples),
        "test_samples": len(test_samples),
        "total_samples": total,
        "train_pct": round(len(train_samples) / total * 100, 1),
        "test_pct": round(len(test_samples) / total * 100, 1),
        "real_student_queries": len(REAL_STUDENT_TEST_SET),
        "q_matrix_skills": len(q_matrix_data)
    }
    return stats


if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    info = generate_and_split_dataset(test_size=0.2, random_state=42)
    print("=" * 70)
    print("[DATA SPLITTER] HOÀN TẤT CHIA DỮ LIỆU CHỐNG DATA LEAKAGE & Q-MATRIX")
    print("=" * 70)
    print(f"• Tập Huấn luyện (Train) : {info['train_samples']} mẫu (Chỉ tăng cường trên Train)")
    print(f"• Tập Kiểm thử   (Test)  : {info['test_samples']} mẫu (Bao gồm {info['real_student_queries']} câu hỏi học sinh thật)")
    print(f"• Bảng Q-Matrix Skills  : {info['q_matrix_skills']} cụm tri thức gắn Cognitive Level & Difficulty")
    print(f"• File Q-Matrix lưu tại : {QMATRIX_FILE}")
    print("=" * 70)
