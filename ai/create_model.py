"""
FILE 2: XÂY DỰNG & HUẤN LUYỆN MODEL NGÔN NGỮ TỰ NHIÊN (CREATE & TRAIN NLP MODEL)
================================================================================
Chức năng độc lập (1 File riêng biệt theo đúng kiến trúc chuẩn):
1. Đọc dữ liệu huấn luyện từ tập Train 80% (`backend/data/train_data.jsonl`).
2. Xây dựng kiến trúc Hybrid NLP gồm 3 tầng:
   - Tầng 1 (NLU - Natural Language Understanding): Phân tích hình thái câu hỏi tiếng Việt
     (Tại sao, Như thế nào, Ai, Khi nào, Ở đâu, Ý nghĩa, Câu nói), nhận diện cảm xúc
     học sinh và Giải quyết đồng tham chiếu đa lượt (Multi-turn Coreference Resolution).
   - Tầng 2 (ML Classifier & Semantic Retriever): Kết hợp Word N-gram + Char N-gram TF-IDF
     với bộ phân loại học máy có giám sát (Calibrated LinearSVC) được train trên 80% dữ liệu.
   - Tầng 3 (NLG - Natural Language Generation): Bộ sinh ngôn ngữ tự nhiên linh hoạt,
     tự động điều chỉnh lời dẫn nhập, mạch văn và câu hỏi gợi mở theo đúng ngữ cảnh,
     loại bỏ hoàn toàn cảm giác trả lời máy móc, rập khuôn.
3. Lưu model đã huấn luyện ra file `backend/models/dong_a_nlp_model.joblib`.
"""

import json
import re
import unicodedata
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline, FeatureUnion

from context_manager import ConversationalContextManager, SPECIAL_GROUNDED_RESPONSES, context_manager

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"

TRAIN_FILE = DATA_DIR / "train_data.jsonl"
CUSTOM_KNOWLEDGE_FILE = DATA_DIR / "custom_knowledge.json"
MODEL_PATH = MODEL_DIR / "dong_a_nlp_model.joblib"


# ==============================================================================
# 1. TIỆN ÍCH XỬ LÝ NGÔN NGỮ TIẾNG VIỆT (VIETNAMESE TEXT PROCESSING)
# ==============================================================================
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


# Từ điển chuẩn hóa viết tắt chuyên biệt Lịch sử 7 (Khắc phục Khó khăn 2)
HISTORICAL_ABBREVIATIONS: Dict[str, str] = {
    "kccm": "kháng chiến chống mông nguyên",
    "kccn": "kháng chiến chống nguyên mông",
    "tqt": "trần quốc toản",
    "thđ": "trần hưng đạo",
    "thd": "trần hưng đạo",
    "tqk": "trần quang khải",
    "tnd": "trần nhật duật",
    "ttd": "trần thủ độ",
    "ttđ": "trần thủ độ",
    "tbt": "trần bình trọng",
    "tkd": "trần khánh dư",
    "pnl": "phạm ngũ lão",
    "bd": "bạch đằng",
    "bđ": "bạch đằng",
    "dh": "diên hồng",
    "bt": "bình than",
    "vknt": "vườn không nhà trống",
    "bln": "bình lệ nguyên",
    "dbd": "đông bộ đầu",
    "wả": "quả",
    "wa": "quả",
    "ko": "không",
    "k": "không",
    "nhìu": "nhiều",
    "zậy": "vậy",
    "z": "vậy",
    "đc": "được",
    "dc": "được",
    "wá": "quá"
}


# Bảng ánh xạ mô tả gián tiếp (Zero-Keyword Paraphrase) -> (Từ khóa chuẩn SGK, Unit ID đích)
INDIRECT_CONCEPT_MAPPINGS: List[Tuple[List[str], str, str]] = [
    (
        ["di tu", "xuat gia", "cao dau", "nhuong ngoi di tu", "len nui tu", "lap phai thien", "ong vua di tu"],
        "trần nhân tông phật hoàng trúc lâm yên tử",
        "GAME_TRAN_NHAN_TONG"
    ),
    (
        ["bo thanh trong", "thanh rong", "giau het luong thuc", "khong cho dich cuop", "khong con gi de cuop", "so tan dan khoi kinh thanh"],
        "kế sách vườn không nhà trống tại thăng long",
        "KC1_VUON_KHONG_NHA_TRONG"
    ),
    (
        ["manh go che", "van go che", "che mua ten", "do ten cuu vua", "lay van che ten", "cam van go"],
        "lê phụ trần lấy ván thuyền che tên bình lệ nguyên",
        "KC1_BINH_LE_NGUYEN"
    ),
    (
        ["dan sot", "dan ro tre", "giao dam vao dui", "dam chay mau dui", "ngoi giua duong dan"],
        "phạm ngũ lão đan sọt thuật hoài",
        "PHAM_NGU_LAO"
    ),
    (
        ["chui vao ong kim loai", "tron trong ong kim loai", "tron ve nuoc trong ong"],
        "thoát hoan chui vào ống đồng tháo chạy",
        "KC2_THOAT_HOAN_COPPER_PIPE"
    ),
    (
        ["bop vo trai cay", "bop nat trai cay", "tuoi nho tuc gian bop"],
        "trần quốc toản bóp nát quả cam bình than",
        "TQT_WHY_ORANGE"
    ),
    (
        ["tha lam ma nuoc nam", "khong them lam vuong dat bac"],
        "trần bình trọng thà làm quỷ nước nam",
        "KC2_TRAN_BINH_TRONG"
    ),
    (
        ["dong coc duoi song", "coc go bit sat", "cho nuoc trieu rut danh chim"],
        "trần hưng đạo đóng cọc ngầm sông bạch đằng 1288",
        "KC3_BACH_DANG_HOW"
    ),
    (
        ["dot thuyen luong", "pha doan tau luong", "dot sach luong thuc cua giac"],
        "trần khánh dư đánh đoàn thuyền lương vân đồn",
        "KC3_VAN_DON"
    ),
    (
        ["thich chu vao tay", "khac chu len canh tay", "bai van khich le tuong si"],
        "hịch tướng sĩ khắc chữ sát thát trần quốc tuấn",
        "HICH_TUONG_SI"
    )
]


import difflib

# Từ điển sửa lỗi chính tả âm vị vùng miền & trượt phím phổ biến
PHONETIC_TYPO_MAP: List[Tuple[List[str], str]] = [
    (["bat dang", "bach dan", "bach dangg", "bạt đằng", "bạch đàng"], "bạch đằng"),
    (["rien hong", "gien hong", "dien hom", "dien hon", "dien hongg"], "diên hồng"),
    (["binh thang", "binh tham", "binh thann"], "bình than"),
    (["thoat hoang", "thoat hoann"], "thoát hoan"),
    (["nha chong", "vuon khong nha chong", "vuon ko nha chong"], "vườn không nhà trống"),
    (["tran khanh giu", "tran khanh ru"], "trần khánh dư"),
    (["ngot luong hop thay", "ngot luong hop tai"], "ngột lương hợp thai"),
    (["tran quoc toang", "tran quoc toann"], "trần quốc toản"),
    (["tran binh chong"], "trần bình trọng")
]

CANONICAL_ENTITY_PHRASES: List[str] = [
    "bach dang", "dien hong", "binh than", "van don", "dong bo dau",
    "binh le nguyen", "thoat hoan", "vuon khong nha trong", "hich tuong si",
    "tran quoc toan", "tran hung dao", "tran quoc tuan", "tran binh trong",
    "tran thu do", "tran khanh du", "pham ngu lao", "tran quang khai",
    "tran nhan tong", "tran thai tong", "tran thanh tong"
]


def expand_abbreviations(text: str) -> str:
    """Ánh xạ từ viết tắt, tự động sửa lỗi chính tả (Fuzzy Typo Repair) và giải mã mô tả gián tiếp."""
    if not text:
        return ""
    words = text.split()
    expanded = []
    for w in words:
        clean_w = re.sub(r"[^\w]", "", w.lower())
        if clean_w in HISTORICAL_ABBREVIATIONS:
            expanded.append(HISTORICAL_ABBREVIATIONS[clean_w])
        else:
            expanded.append(w)
    base_str = " ".join(expanded)
    unacc = normalize_vi(remove_accents(base_str))
    extra_concepts = []

    # 1. Sửa lỗi chính tả âm vị vùng miền phổ biến
    for typo_list, canonical_fix in PHONETIC_TYPO_MAP:
        if any(tp in unacc for tp in typo_list):
            extra_concepts.append(canonical_fix)

    # 2. So khớp xấp xỉ khoảng cách ký tự (Fuzzy Sliding N-gram Matching >= 0.85 & từng từ >= 0.75)
    if not re.search(r"\btran nha\b", unacc):
        tokens = unacc.split()
        for canonical in CANONICAL_ENTITY_PHRASES:
            if canonical in unacc:
                continue
            c_tokens = canonical.split()
            c_len = len(c_tokens)
            if len(tokens) >= c_len:
                for i in range(len(tokens) - c_len + 1):
                    win_tokens = tokens[i:i + c_len]
                    win = " ".join(win_tokens)
                    if win in CANONICAL_ENTITY_PHRASES or win == "tran phan cong":
                        continue
                    if (
                        win[0] == canonical[0]
                        and difflib.SequenceMatcher(None, win, canonical).ratio() >= 0.85
                        and all(difflib.SequenceMatcher(None, wt, ct).ratio() >= 0.75 for wt, ct in zip(win_tokens, c_tokens))
                    ):
                        extra_concepts.append(canonical)
                        break

    # 3. Ánh xạ mô tả gián tiếp không từ khóa (Zero-Keyword Paraphrase)
    for triggers, canonical_phrase, _ in INDIRECT_CONCEPT_MAPPINGS:
        if any(t in unacc for t in triggers):
            extra_concepts.append(canonical_phrase)
    if extra_concepts:
        return f"{base_str} {' '.join(extra_concepts)}"
    return base_str


def build_bilingual_features(text: str) -> str:
    """Kết hợp chuỗi có dấu, không dấu và đặc trưng ngữ nghĩa (Semantic Lexicon Features)."""
    expanded_text = expand_abbreviations(text)
    norm = normalize_vi(expanded_text)
    unacc = normalize_vi(remove_accents(expanded_text))
    words = unacc.split()
    tags = []
    if any(k in unacc for k in ["lan 1", "lan thu 1", "lan thu nhat", "lan mot", "lan dau", "1258"]):
        tags.append("__kc_lan_1__ __kc_lan_1__")
    if any(k in unacc for k in ["lan 2", "lan thu 2", "lan thu hai", "lan hai", "1285"]):
        tags.append("__kc_lan_2__ __kc_lan_2__")
    if any(k in unacc for k in ["lan 3", "lan thu 3", "lan thu ba", "lan ba", "1287", "1288"]):
        tags.append("__kc_lan_3__ __kc_lan_3__")

    # Điểm neo ngữ nghĩa chuyên sâu cho các trận đánh & hội nghị
    if "dien hong" in unacc:
        tags.append("__dien_hong__ __dien_hong__ __dien_hong__")
    if "binh than" in unacc:
        tags.append("__binh_than__ __binh_than__ __binh_than__")
    if "dong bo dau" in unacc:
        tags.append("__dong_bo_dau__ __dong_bo_dau__ __dong_bo_dau__ __dong_bo_dau__")
    if any(k in unacc for k in ["binh le nguyen", "le phu tran", "le tan", "van thuyen", "che ten"]):
        tags.append("__binh_le_nguyen__ __binh_le_nguyen__ __binh_le_nguyen__")
    if any(k in unacc for k in ["bach dang", "coc ngam", "coc go", "trieu rut"]):
        tags.append("__bach_dang__ __bach_dang__ __bach_dang__")
    if any(k in unacc for k in ["van don", "thuyen luong", "thach luong", "17 van", "truong van ho"]):
        tags.append("__van_don__ __van_don__ __van_don__")
    if any(k in unacc for k in ["thoat hoan", "chui ong", "chui vao ong dong", "tron trong ong dong"]) or ("ong dong" in unacc and "phan cong dong" not in unacc):
        tags.append("__thoat_hoan_ong_dong__ __thoat_hoan_ong_dong__")
    if any(k in unacc for k in ["qua cam", "bop nat", "bop cam"]):
        tags.append("__tqt_why_orange__ __tqt_why_orange__ __tqt_why_orange__")
    if any(k in unacc for k in ["sau chu vang", "6 chu vang", "pha cuong dich", "bao hoang an", "chieu mo bao nhieu gia no", "1000 gia no", "hon 1000 gia no"]):
        tags.append("__tqt_six_golden_words__ __tqt_six_golden_words__ __tqt_six_golden_words__")
    if any(k in unacc for k in ["tran binh trong", "quy nuoc nam"]):
        tags.append("__tran_binh_trong__ __tran_binh_trong__")
    if any(k in unacc for k in ["hich tuong si", "sat that", "nua dem vo goi", "ruot dau nhu cat"]) and not any(d in unacc for d in ["di su", "trai giac", "do khac chung", "khac chung"]):
        tags.append("__hich_tuong_si__ __hich_tuong_si__ __hich_tuong_si__")
    if any(k in unacc for k in ["dau than chua roi", "dau toi chua roi", "xin be ha dung lo"]) or ("tran thu do" in unacc and not any(d in unacc for d in ["1225", "1226", "thanh lap", "chieu hoang", "tran canh"])):
        tags.append("__tran_thu_do__ __tran_thu_do__ __tran_thu_do__ __tran_thu_do__")
    if any(k in unacc for k in ["chem dau than", "chem dau toi", "muon hang", "tran hung dao la ai", "tran quoc tuan la ai", "cong lao cua hung dao"]):
        tags.append("__tran_hung_dao_portrait__ __tran_hung_dao_portrait__ __tran_hung_dao_portrait__")
    if any(k in unacc for k in ["muc dich cua mong co", "am muu mong co", "muon duong", "nam tong", "su gia mong co", "ngot luong hop thai"]):
        tags.append("__kc1_why_invade__ __kc1_why_invade__ __kc1_why_invade__")
    if any(k in unacc for k in ["tung gia hoan kinh", "chuong duong do", "ham tu quan"]):
        tags.append("__ham_tu_chuong_duong__ __ham_tu_chuong_duong__ __ham_tu_chuong_duong__")
    if any(k in unacc for k in ["boi lan", "duc thung thuyen", "yet kieu", "da tuong", "voi chien"]):
        tags.append("__yet_kieu_da_tuong__ __yet_kieu_da_tuong__ __yet_kieu_da_tuong__")
    if any(k in unacc for k in ["to long", "thuat hoai", "dan sot", "pham ngu lao"]):
        tags.append("__pham_ngu_lao__ __pham_ngu_lao__ __pham_ngu_lao__")
    if any(k in unacc for k in ["doan binh", "truong tran", "lay yeu thang manh", "nghe thuat quan su"]):
        tags.append("__military_art__ __military_art__ __military_art__")
    if any(k in unacc for k in ["ha dac", "ha chuong", "nguyen the loc", "dan toc thieu so", "dong bao mien nui", "tu truong"]):
        tags.append("__ethnic_minorities__ __ethnic_minorities__ __ethnic_minorities__")
    if any(k in unacc for k in ["bai hoc kinh nghiem", "khoan thu suc dan", "sau re ben goc", "bao ve to quoc hien nay", "hien nay", "ngay nay"]):
        tags.append("__historical_lessons__ __historical_lessons__ __historical_lessons__")
    if any(k in unacc for k in ["thanh duc", "cam quan", "non ma loi", "lo quan", "huong binh"]):
        tags.append("__quan_thanh_duc_sat_that__ __quan_thanh_duc_sat_that__ __quan_thanh_duc_sat_that__")
    if any(k in unacc for k in ["can cu van kiep", "noi bang", "thien truong", "truong yen", "hau phuong", "20 van quan"]):
        tags.append("__van_kiep_thien_truong__ __van_kiep_thien_truong__ __van_kiep_thien_truong__")
    if any(k in unacc for k in ["tran ich tac", "tran kien", "nguyen dia lo", "phan boi", "dau hang giac", "ma luc"]):
        tags.append("__trung_than_vs_phan_boi__ __trung_than_vs_phan_boi__ __trung_than_vs_phan_boi__")
    if any(k in unacc for k in ["nhung nam nao", "may lan", "bao nhieu lan", "tong ket ca 3", "tong ket ba lan", "tom tat ba lan", "tom tat 3 lan", "cac tran danh tieu bieu trong 3 lan"]):
        tags.append("__all_3_wars_summary__ __all_3_wars_summary__ __all_3_wars_summary__")
    if any(k in unacc for k in ["tam voc the gioi", "tam voc quoc te", "y nghia doi voi the gioi", "y nghia gi doi voi the gioi", "y nghia lich su cua ba lan", "y nghia 3 lan", "de lai bai hoc gi"]) and not any(d in unacc for d in ["hien nay", "ngay nay", "hom nay"]):
        tags.append("__historical_significance__ __historical_significance__ __historical_significance__")
    # Chủ đề bổ sung cùng game Hào Khí Đông A
    if any(k in unacc for k in ["ngu binh", "gui binh", "ve que lam ruong", "luan phien ve que", "lam ruong", "quan dong vua du luong", "to chuc quan doi"]):
        tags.append("__ngu_binh_u_nong__ __ngu_binh_u_nong__ __ngu_binh_u_nong__")
    if any(k in unacc for k in ["binh thu", "sach binh phap", "cuon binh phap"]):
        tags.append("__binh_thu_yeu_luoc__ __binh_thu_yeu_luoc__ __binh_thu_yeu_luoc__")
    if any(k in unacc for k in ["nhan tong", "tran kham", "truc lam", "yen tu", "phat hoang", "lao thach ma", "dien kim au", "chon ngua da", "vung au vang"]) and not any(d in unacc for d in ["tran thai tong", "phu van", "trang 492", "1237"]):
        tags.append("__tran_nhan_tong__ __tran_nhan_tong__")
    if any(k in unacc for k in ["buon than", "ban than", "chi linh", "tuoc quan", "tha toi"]):
        tags.append("__khanh_du_cuoc_doi__ __khanh_du_cuoc_doi__")
    if any(k in unacc for k in [
        "rut khoi thang long", "rut lui khoi thang long", "roi thang long", "chu dong rut",
        "vuon khong nha trong", "vknt", "thanh trong rong", "so tan khoi thang long",
        "chien thuat rut lui", "rut lui khong dong nghia", "rut lui khong phai that bai"
    ]):
        tags.append("__vuon_khong_nha_trong__ __vuon_khong_nha_trong__ __vuon_khong_nha_trong__")
    if any(k in unacc for k in [
        "dong va manh", "van thua", "that bai truoc", "nguyen nhan thang loi",
        "vi sao thang", "tai sao thang", "vi sao thua", "tai sao thua",
        "nuoc nho thang", "danh thang quan mong", "danh thang de che",
        "danh thang duoc de che", "nguyen nhan nha tran thang", "yeu to quan trong nhat giup",
        "vua toi dong long anh em hoa muc"
    ]):
        tags.append("__causes_of_victory__ __causes_of_victory__ __causes_of_victory__")

    # Điểm neo ngữ nghĩa cho 14 cụm tri thức chính sử Đại Việt Sử Ký Toàn Thư
    if any(k in unacc for k in ["nhat hieu", "nhap tong", "cu da", "hoang cu da", "an xoai"]):
        tags.append("__dvsktt_nhat_hieu_cu_da__ __dvsktt_nhat_hieu_cu_da__ __dvsktt_nhat_hieu_cu_da__")
    if any(k in unacc for k in ["do khac chung", "khac chung", "ngua keo xe muoi", "ngua ky", "cho nha can nguoi", "di su sang trai giac", "giai thich hai chu sat that"]):
        tags.append("__dvsktt_do_khac_chung__ __dvsktt_do_khac_chung__ __dvsktt_do_khac_chung__")
    if any(k in unacc for k in ["gay bit sat", "dau sat nhon", "rut dau sat", "yen sinh vuong", "tran lieu", "quach tu nghi", "quoc tang", "danh tuong nao cua nha duong", "so sanh tran quoc tuan voi"]):
        tags.append("__dvsktt_gay_bit_sat__ __dvsktt_gay_bit_sat__ __dvsktt_gay_bit_sat__")
    if any(k in unacc for k in ["do hanh", "nguyen khoai", "tich le co ngoc", "ao lo xich", "400 chiec thuyen", "400 chien thuyen", "chieu lang", "thu duoc bao nhieu chien thuyen", "bat nhung tuong giac nao"]):
        tags.append("__dvsktt_do_hanh_nguyen_khoai__ __dvsktt_do_hanh_nguyen_khoai__ __dvsktt_do_hanh_nguyen_khoai__")
    if any(k in unacc for k in ["hoang ta thon", "dui thuyen", "dui dam thuyen", "o ma nhi chet", "so phan cua tuong giac o ma nhi"]):
        tags.append("__dvsktt_hoang_ta_thon__ __dvsktt_hoang_ta_thon__ __dvsktt_hoang_ta_thon__")
    if any(k in unacc for k in ["tran thi kien", "thi kien", "kiem phap quan", "moc hong", "mua ra", "cam danh bac", "phan phu tien", "chim ung"]):
        tags.append("__dvsktt_tran_thi_kien__ __dvsktt_tran_thi_kien__ __dvsktt_tran_thi_kien__")
    if any(k in unacc for k in ["thanh lap nha tran", "ly chieu hoang", "chieu hoang", "tran canh", "1225", "1226", "quoc thuong phu", "dien thien an", "kien trung"]):
        tags.append("__dvsktt_thanh_lap_nha_tran__ __dvsktt_thanh_lap_nha_tran__ __dvsktt_thanh_lap_nha_tran__")
    if any(k in unacc for k in ["thai thuong hoang", "quoc trieu hinh thu", "quoc trieu thong che", "tham hinh vien", "12 lo", "so ho tich", "vac dau", "chuong ho", "bo may nha nuoc", "bo luat thanh van"]):
        tags.append("__dvsktt_bo_may_phap_luat__ __dvsktt_bo_may_phap_luat__ __dvsktt_bo_may_phap_luat__")
    if any(k in unacc for k in ["dinh nhi", "quai vac", "ha de su", "khuyen nong su", "dien trang", "thai ap", "1248", "1266", "kinh te nong nghiep"]):
        tags.append("__dvsktt_kinh_te_nha_tran__ __dvsktt_kinh_te_nha_tran__ __dvsktt_kinh_te_nha_tran__")
    if any(k in unacc for k in ["tam khoi", "nguyen hien", "le van huu", "mac dinh chi", "luong quoc trang nguyen", "thai hoc sinh", "1247", "1304", "khoa cu"]):
        tags.append("__dvsktt_khoa_cu_nha_tran__ __dvsktt_khoa_cu_nha_tran__ __dvsktt_khoa_cu_nha_tran__")
    if any(k in unacc for k in ["chu van an", "that tram so", "7 ninh than", "7 ten ninh than", "phuong hoang", "tu nghiep", "van mieu"]):
        tags.append("__dvsktt_chu_van_an__ __dvsktt_chu_van_an__ __dvsktt_chu_van_an__")
    if any(k in unacc for k in ["truong han sieu", "bach dang giang phu", "phu song bach dang", "han thuyen", "nguyen thuyen", "chu nom", "van te ca sau", "cot minh duc cao"]):
        tags.append("__dvsktt_truong_han_sieu__ __dvsktt_truong_han_sieu__ __dvsktt_truong_han_sieu__")
    if any(k in unacc for k in ["doan nhu hai", "nhu hai", "thao bieu ta toi", "ngu su trung tan", "di su chiem thanh", "1299", "1303"]):
        tags.append("__dvsktt_doan_nhu_hai__ __dvsktt_doan_nhu_hai__ __dvsktt_doan_nhu_hai__")
    if any(k in unacc for k in ["phu van", "quoc su phu van", "khong co phat", "phat o ngay trong long", "phat o trong long", "thap pho minh", "thap binh son", "vac pho minh", "tran thai tong len nui yen tu", "trang 492"]):
        tags.append("__dvsktt_van_hoa_phu_van__ __dvsktt_van_hoa_phu_van__ __dvsktt_van_hoa_phu_van__")

    if any(w in words for w in ["hello", "hi", "alo"]) or any(k in unacc for k in ["xin chao", "chao thay", "chao ban", "chao tro ly"]):
        tags.append("__intent_greeting__ __intent_greeting__ __intent_greeting__")
    if any(w in words for w in ["thanks"]) or any(k in unacc for k in ["cam on", "thank you", "thank u", "tuyet voi de hieu"]):
        tags.append("__intent_thanks__ __intent_thanks__ __intent_thanks__")
    if any(k in unacc for k in ["khong biet dap an", "chua hieu bai", "kho qua", "khong biet lam", "giup minh voi", "khong biet cau tra loi", "quen mat roi", "chi em cach", "kho nho qua", "bi cau hoi", "trac nghiem nay roi"]):
        tags.append("__intent_struggle__ __intent_struggle__ __intent_struggle__")
    tag_str = " ".join(tags)
    return f"{norm} {unacc} {tag_str}".strip()


# ==============================================================================
# 2. TẦNG HIỂU NGÔN NGỮ TỰ NHIÊN (NLU - QUESTION TYPE & COREFERENCE ANALYZER)
# ==============================================================================
class VietnameseNLU:
    """
    Phân tích ý định ngữ pháp của câu hỏi để giúp AI trả lời đúng trọng tâm
    thay vì trả lời máy móc một đoạn văn cố định.
    """
    QUESTION_PATTERNS = {
        "VERIFICATION": [
            "dung khong", "co dung khong", "co dung la", "phai khong", "co phai la",
            "co phai", "co the ket luan", "chi vi", "chi do", "co that su", "co that khong"
        ],
        "COUNTERFACTUAL": [
            "neu ", "neu nhu", "gia su", "gia dinh", "bat loi gi", "thi sao neu", "neu quan", "neu co"
        ],
        "COMPARISON": [
            "so sanh", "tuong tu khong", "diem chung", "giong nhau", "khac nhau",
            "co gi giong", "co gi khac", "diem giong", "diem tuong dong"
        ],
        "EVIDENCE": [
            "chinh xac bao nhieu", "bao nhieu binh si", "bao nhieu quan", "so lieu",
            "cau noi nguyen van", "nguyen van", "nguon trich dan", "trich dan",
            "loai thuoc no", "su lieu nao", "tai lieu nao ghi"
        ],
        "FACT": [
            "lan thu may", "lan may", "ai chi huy", "ai la", "la ai", "nam nao",
            "thoi gian nao", "khi nao", "bao gio", "o dau", "tai dau", "dia diem nao",
            "la tran nao", "tran nao", "bao nhieu lan", "ai da", "cua ai", "ben nao", "khuc song nao"
        ],
        "CAUSE": [
            "vi sao", "tai sao", "nguyen nhan", "ly do", "do dau", "muc dich", "am muu", "de lam gi"
        ],
        "EVENT": [
            "dien bien", "cuc dien thay doi", "cuc dien", "nhu the nao", "ra sao",
            "quan ta lam gi", "ket qua", "ke sach", "lam the nao", "bang cach nao", "chien thuat"
        ],
        "SIGNIFICANCE": [
            "y nghia", "vai tro", "bai hoc", "gia tri", "tam voc", "tac dong", "he qua", "anh huong", "the hien dieu gi"
        ],
        "FOLLOW_UP": [
            "khac phuc bat loi", "chien thuat rut lui", "sau do thi sao", "tiep theo",
            "the con", "con... thi sao", "sao nua", "lam gi tiep theo"
        ]
    }

    ANAPHORA_PRONOUNS = [
        "ong ay", "ong ta", "vi tuong do", "vi vua do", "nguoi do", "chang",
        "tran do", "cuoc chien do", "hoi nghi do", "luc do", "sau do", "the con"
    ]

    CROSS_ERA_RULES = [
        {
            "keywords": ["ham nghi", "vua ham nghi", "can vuong"],
            "unit_id": "CROSS_ERA_HAM_NGHI"
        },
        {
            "keywords": ["ngo quyen", "tien ngo vuong", "nam 938", "nam han"],
            "unit_id": "CROSS_ERA_NGO_QUYEN"
        },
        {
            "keywords": [
                "quang trung", "nguyen hue", "tay son", "dong da",
                "le loi", "nguyen trai", "lam son", "binh ngo dai cao",
                "ly thuong kiet", "nhu nguyet", "nam quoc son ha",
                "ly cong uan", "ly thai to", "chieu doi do", "nha ly doi do",
                "hai ba trung", "ba trieu", "mai thuc loan", "khuc thua du",
                "dinh bo linh", "nha dinh", "le hoan", "tien le", "ho quy ly", "nha ho",
                "ho chi minh", "bac ho", "vo nguyen giap", "dien bien phu"
            ],
            "unit_id": "CROSS_ERA_QUANG_TRUNG_LE_LOI_LY_THUONG_KIET"
        }
    ]

    DOMAIN_VOCAB = [
        "tran", "mong", "nguyen", "dai viet", "dong a", "thang long", "bach dang",
        "van don", "ham tu", "chuong duong", "tay ket", "binh than", "dien hong",
        "dong bo dau", "binh le nguyen", "van kiep", "quoc toan", "hung dao", "quoc tuan",
        "tran thu do", "binh trong", "khanh du", "quang khai", "nhat duat", "yet kieu",
        "da tuong", "pham ngu lao", "le tan", "le phu tran", "ha khuat", "thoat hoan",
        "toa do", "o ma nhi", "phan tiep", "truong van ho", "ngot luong hop thai",
        "hot tat liet", "qua cam", "ong dong", "coc go", "coc ngam", "vuon khong nha trong",
        "sat that", "hich tuong si", "bo lao", "thuyen luong", "khang chien", "lan 1",
        "lan 2", "lan 3", "lan thu nhat", "lan thu hai", "lan thu ba", "1258", "1282",
        "1284", "1285", "1287", "1288", "bai 13", "lich su",
        # Từ vựng quân sự, chiến thuật & tư duy lịch sử (Chống OOD giả đối với câu hỏi suy luận)
        "chien thuat", "rut lui", "chien luoc", "ke sach", "dau hang", "phan cong",
        "thao chay", "that bai", "dong va manh", "van thua", "thua", "danh thang",
        "thang loi", "boi vi sao", "bao toan luc luong", "nghe thuat quan su", "the giac", "doan ket",
        "doan binh", "truong tran", "ha dac", "ha chuong", "nguyen the loc", "nhan tong",
        "phat hoang", "truc lam", "yen tu", "thach ma", "kim au", "khoan thu suc dan",
        "sau re ben goc", "dan toc thieu so", "mien nui", "bai hoc kinh nghiem",
        "ngu binh", "ngu binh u nong", "gui binh", "binh thu", "binh thu yeu luoc",
        "tran kham", "chi linh", "nhan hue vuong", "van thuyen", "che ten",
        "dau than", "chem dau", "pha cuong dich", "bao hoang an", "vo goi",
        "ruot dau", "tung gia", "hoan kinh", "thach luong", "trieu rut",
        "duc thung", "boi lan", "to long", "thuat hoai", "dan sot",
        "thanh duc", "cam quan", "ma loi", "noi bang", "thien truong",
        "truong yen", "ich tac", "tran kien", "dia lo", "ma luc",
        "phu ninh", "da giang", "thien mac", "quy hoa", "huong binh",
        "nhat hieu", "nhap tong", "cu da", "an xoai", "khac chung",
        "do hanh", "nguyen khoai", "tich le co ngoc", "ao lo xich",
        "hoang ta thon", "dui thuyen", "thi kien", "kiem phap quan",
        "ngo si lien", "phan phu tien", "yen sinh vuong", "tran lieu",
        "chieu lang", "dai viet su ky", "quach tu nghi", "quoc tang",
        "chieu hoang", "tran canh", "kien trung", "thai thuong hoang",
        "quoc trieu hinh thu", "quoc trieu thong che", "tham hinh vien",
        "dinh nhi", "quai vac", "ha de su", "dien trang", "thai ap",
        "tam khoi", "nguyen hien", "le van huu", "mac dinh chi",
        "thai hoc sinh", "chu van an", "that tram so", "phuong hoang",
        "truong han sieu", "bach dang giang phu", "han thuyen", "chu nom",
        "doan nhu hai", "phu van", "pho minh", "binh son",
        "cot minh duc cao", "dat hiem", "thang binh", "muon thuo"
    ]

    @classmethod
    def detect_question_type(cls, query: str) -> str:
        unacc = normalize_vi(remove_accents(query))
        for q_type, patterns in cls.QUESTION_PATTERNS.items():
            for pat in patterns:
                if pat in unacc:
                    return q_type
        return "EVENT"

    @classmethod
    def detect_cross_era(cls, query: str) -> Optional[str]:
        unacc = normalize_vi(remove_accents(query))
        for rule in cls.CROSS_ERA_RULES:
            for kw in rule["keywords"]:
                if kw in unacc:
                    return rule["unit_id"]
        return None

    @classmethod
    def has_historical_signal(cls, query: str) -> bool:
        unacc = normalize_vi(remove_accents(query))
        words = set(unacc.split())

        # 0. Chặn ngay các chủ đề đời sống / môn học khác (tránh trùng từ đồng âm như "nguyên nhân", "trần nhà", "chiến thuật game")
        off_topic_markers = [
            "thoi tiet", "nau an", "pho bo", "pizza", "mi tom", "lien quan", "bong da",
            "world cup", "viet code", "python", "javascript", "dien tich", "hinh tron",
            "phuong trinh", "hoa hoc", "nguyen tu", "vat ly", "cam cum", "dau bung",
            "o nhiem", "moi truong", "gia vang", "chung khoan", "xo so", "coi tran"
        ]
        if any(ot in unacc for ot in off_topic_markers) or re.search(r"\btran nha\b", unacc):
            return False

        # 1. Từ khóa giao tiếp / câu hỏi tâm lý, danh tính trợ lý, đố vui & định hướng học tập của học sinh
        conv_phrases = [
            "xin chao", "chao thay", "chao co", "chao ban", "cam on", "thank you", "thank u",
            "khong biet", "chua hieu", "kho qua", "giup em", "giup minh", "dap an",
            "quen mat", "chi em", "nen hoi gi", "hoi gi bay gio", "goi y", "bat dau tu dau",
            "nen hoc gi", "on tap", "lo trinh", "danh gia nang luc", "ho so hoc tap",
            "ban la ai", "thay la ai", "thay ten gi", "ban ten gi", "ai tao ra",
            "thay lam duoc gi", "tro ly dong a", "cach dung", "do em", "kiem tra bai",
            "cho em 1 cau hoi", "cho em mot cau hoi", "thu thach em", "hoi em mot cau",
            "bi cau hoi", "trac nghiem nay"
        ]
        if any(cp in unacc for cp in conv_phrases) or (words & {"hello", "hi", "thanks", "alo"}):
            return True

        # Loại bỏ các cụm từ đồng âm tiếng Việt thông thường trước khi kiểm tra từ đơn "nguyen" / "tran"
        cleaned_for_domain = unacc
        for homonym in ["nguyen nhan", "nguyen tac", "nguyen lieu", "tai nguyen", "nguyen ven", "giu nguyen"]:
            cleaned_for_domain = cleaned_for_domain.replace(homonym, " ")

        # 2. Từ vựng chuyên đề Lịch sử thời Trần (khớp từ trọn vẹn theo ranh giới từ)
        for kw in cls.DOMAIN_VOCAB:
            if re.search(rf"\b{re.escape(kw)}\b", cleaned_for_domain):
                return True
        return False

    @classmethod
    def rewrite_query_with_session(cls, query: str, session_data: Optional[Dict[str, Any]]) -> Tuple[str, bool]:
        """
        Khắc phục Khó khăn 1: Đại từ trong hội thoại.
        Lưu trạng thái server theo session_id (last_entity, last_individual_entity, last_event).
        Khi phát hiện đại từ 'chàng', 'ông', 'ông ấy', 'trận đó', viết lại câu hỏi trước khi đưa vào pipeline:
        'Vì sao chàng lại bóp nát quả cam?' -> 'Vì sao Trần Quốc Toản lại bóp nát quả cam?'.
        'Sau trận đó thì sao?' -> 'Sau [last_event] thì sao?'.
        """
        if not session_data:
            return query, False
        last_entity = session_data.get("last_entity")
        last_event = session_data.get("last_event")

        rewritten = query
        is_rewritten = False

        # Nhận diện các motif lịch sử đặc trưng gắn liền với nhân vật cụ thể
        unacc_q = remove_accents(query).lower()
        if any(k in unacc_q for k in ["qua cam", "bop nat", "sau chu vang", "6 chu vang"]) and "tran quoc toan" not in unacc_q:
            effective_entity = "Trần Quốc Toản"
        elif any(k in unacc_q for k in ["chui ong", "ong dong"]) and "thoat hoan" not in unacc_q:
            effective_entity = "Thoát Hoan"
        elif any(k in unacc_q for k in ["dau chua roi xuong dat", "chem dau toi"]) and "tran hung dao" not in unacc_q:
            effective_entity = "Trần Hưng Đạo"
        elif any(k in unacc_q for k in ["cuop thuyen luong", "van don"]) and "tran khanh du" not in unacc_q:
            effective_entity = "Trần Khánh Dư"
        else:
            effective_entity = last_entity

        # Thay thế đại từ nhân vật bằng thực thể gần nhất
        person_pronouns = ["chàng", "ông ấy", "ông ta", "ông", "vị tướng đó", "vị vua đó", "người đó", "họ"]
        if effective_entity:
            for p in person_pronouns:
                pattern = re.compile(rf"\b{re.escape(p)}\b", re.IGNORECASE)
                if pattern.search(rewritten):
                    target_ent = effective_entity
                    # Nếu đại từ là "chàng" (nam anh hùng trẻ tuổi), không dùng thực thể tập thể như "Vua & Vương hầu"
                    if p == "chàng" and ("&" in target_ent or "và" in target_ent or "vua" in target_ent.lower()):
                        target_ent = session_data.get("last_individual_entity", "Trần Quốc Toản")
                    rewritten = pattern.sub(target_ent, rewritten, count=1)
                    is_rewritten = True
                    break

        # Thay thế đại từ sự kiện bằng sự kiện gần nhất
        event_pronouns = ["trận đó", "cuộc chiến đó", "hội nghị đó", "sự kiện đó", "chiến dịch đó"]
        if last_event:
            for ep in event_pronouns:
                pattern = re.compile(rf"\b{re.escape(ep)}\b", re.IGNORECASE)
                if pattern.search(rewritten):
                    rewritten = pattern.sub(last_event, rewritten, count=1)
                    is_rewritten = True
                    break

        return rewritten, is_rewritten


# ==============================================================================
# 3. TẦNG SINH NGÔN NGỮ TỰ NHIÊN (NLG - NATURAL CONVERSATIONAL COMPOSER)
# ==============================================================================
class ConversationalNLG:
    """
    Bộ khung diễn đạt tự nhiên (Natural Discourse Composer):
    - Thay đổi lời mở đầu linh hoạt tùy theo loại câu hỏi (WHY, HOW, WHO, QUOTE, OVERVIEW)
      và trạng thái hội thoại (câu hỏi đầu tiên vs. câu hỏi nối tiếp).
    - Hỗ trợ hóa thân nhân vật lịch sử (Persona Roleplay) mượt mà.
    """
    DIRECT_ANSWER_TYPES = {
        "FACT", "VERIFICATION", "EVIDENCE", "COUNTERFACTUAL", "COMPARISON",
        "WHO", "WHEN", "WHERE"
    }

    NATURAL_LEAD_INS = {
        "CAUSE": [
            "Về nguyên nhân của sự việc này:\n\n",
            "Lý giải cho điều này nằm ở các điểm cốt lõi sau:\n\n"
        ],
        "EVENT": [
            "Về diễn biến cụ thể của sự kiện này:\n\n",
            "Mạch diễn biến chính được ghi nhận như sau:\n\n"
        ],
        "SIGNIFICANCE": [
            "Về mặt ý nghĩa và tầm vóc lịch sử:\n\n",
            "Giá trị lịch sử to lớn của sự kiện này thể hiện qua các điểm sau:\n\n"
        ],
        "FOLLOW_UP": [
            "Tiếp nối diễn biến trước đó:\n\n",
            "Về chi tiết tiếp theo này:\n\n"
        ],
        "FOLLOW_UP_BRIDGE": [
            "Tiếp nối diễn biến trước đó:\n\n",
            "Về chi tiết tiếp theo này:\n\n"
        ],
        "OVERVIEW": [
            "Tổng quan sự kiện lịch sử này như sau:\n\n"
        ],
        "QUOTE": [
            "Lời khẳng định bất hủ này gắn liền với khí phách ngút trời thời nhà Trần:\n\n"
        ],
        "WHY": [
            "Về nguyên nhân của sự việc này:\n\n",
            "Lý giải cho điều này nằm ở các điểm cốt lõi sau:\n\n"
        ],
        "HOW": [
            "Về diễn biến cụ thể của sự kiện này:\n\n",
            "Mạch diễn biến chính được ghi nhận như sau:\n\n"
        ],
        "MEANING": [
            "Về mặt ý nghĩa và tầm vóc lịch sử:\n\n",
            "Giá trị lịch sử to lớn của sự kiện này thể hiện qua các điểm sau:\n\n"
        ]
    }

    PERSONAS = {
        "TRAN_HUNG_DAO": {
            "name": "Quốc Công Tiết Chế Hưng Đạo Đại Vương",
            "openers": [
                "Tiểu hữu hỏi đúng điều ta từng trăn trở nơi quân trướng! ",
                "Hậu thế muốn tường tận việc quân cơ thời Đông A ư? Hãy nghe ta kể: ",
                "Nhớ lại những ngày khói lửa chống giặc Thát, ta nói cho tiểu hữu hay: "
            ]
        },
        "TRAN_QUOC_TOAN": {
            "name": "Hoài Văn Hầu Trần Quốc Toản",
            "openers": [
                "Bạn đồng trang lứa hỏi làm lòng ta lại sôi sục nhiệt huyết! ",
                "Nghe bạn hỏi, ta nhớ như in ngày dựng cờ sáu chữ vàng năm ấy: ",
                "Tuy tuổi trẻ nhưng chí giữ nước không hề nhỏ! Ta kể bạn nghe nhé: "
            ]
        },
        "TRAN_THU_DO": {
            "name": "Thái Sư Trần Thủ Độ",
            "openers": [
                "Lão phu nói thẳng để tiểu hữu rõ bản lĩnh của triều Trần: ",
                "Việc lớn giữ giang sơn không thể nao núng! Tiểu hữu hãy nghe đây: "
            ]
        },
        "TRAN_BINH_TRONG": {
            "name": "Bảo Nghĩa Vương Trần Bình Trọng",
            "openers": [
                "Một tấc đất nước Nam cũng không thể nhường cho giặc! Ta kể cho hậu thế rõ: ",
                "Khí tiết người Đại Việt ngàn năm vẫn sáng! Tiểu hữu hãy nghe lời ta: "
            ]
        },
        "TRAN_THANH_TONG": {
            "name": "Thượng Hoàng Trần Thánh Tông",
            "openers": [
                "Trẫm cùng muôn dân trăm họ đồng lòng mới làm nên cơ nghiệp ấy. Tiểu hữu hãy nghe: ",
                "Lấy dân làm gốc là đạo trị quốc của nhà Trần. Trẫm giải thích cho tiểu hữu nhé: "
            ]
        },
        "TRAN_THAI_TONG": {
            "name": "Vua Trần Thái Tông",
            "openers": [
                "Nhớ lại buổi đầu chống kỵ binh Mông Cổ năm 1258, trẫm kể cho tiểu hữu tường tận: ",
                "Giữ vững giang sơn trước mũi nhọn quân thù đòi hỏi sự tỉnh táo. Hãy nghe trẫm nói: "
            ]
        },
        "TRAN_NHAN_TONG": {
            "name": "Phật Hoàng Trần Nhân Tông",
            "openers": [
                "Trẫm cùng muôn dân đã đi qua hai cuộc binh đao khói lửa để giữ vững âu vàng. Tiểu hữu hãy nghe: ",
                "Từ bến Bình Than đến đỉnh Yên Tử, trẫm đúc kết điều này cho hậu thế: "
            ]
        },
        "TRAN_QUANG_KHAI": {
            "name": "Thượng Tướng Thái Sư Trần Quang Khải",
            "openers": [
                "Nhớ ngày đoạt giáo ở bến Chương Dương, ta kể cho tiểu hữu nghe: ",
                "Thái bình rồi vẫn phải dốc sức giữ non sông! Tiểu hữu hãy nghe lời ta: "
            ]
        },
        "TRAN_NHAT_DUAT": {
            "name": "Chiêu Văn Vương Trần Nhật Duật",
            "openers": [
                "Am hiểu phong tục muôn phương giúp ta nhìn thấu thế trận. Tiểu hữu hãy nghe: ",
                "Từ trận Hàm Tử Quan vang dội, ta chia sẻ cùng tiểu hữu điều này: "
            ]
        },
        "TRAN_KHANH_DU": {
            "name": "Nhân Huệ Vương Trần Khánh Dư",
            "openers": [
                "Từ người bán than nơi Chí Linh đến ngày phục kích thuyền lương Vân Đồn, ta kể tiểu hữu nghe: ",
                "Đánh giặc phải biết chặt đứt dạ dày của chúng! Tiểu hữu hãy nghe đây: "
            ]
        },
        "LE_PHU_TRAN": {
            "name": "Chiêu Minh Vương Lê Phụ Trần",
            "openers": [
                "Giữa mưa tên ở Bình Lệ Nguyên, bình tĩnh bảo toàn lực lượng mới là thượng sách! Hãy nghe ta kể: ",
                "Ta từng cầm ván thuyền che tên cho vua và rút ra bài học lớn này cho hậu thế: "
            ]
        },
        "PHAM_NGU_LAO": {
            "name": "Điện Súy Phạm Ngũ Lão",
            "openers": [
                "Múa giáo non sông trải mấy thu, ta kể cho tiểu hữu rõ việc quân thời Trần: ",
                "Mang chí lớn trả nợ công danh cho đất nước, tiểu hữu hãy nghe lời ta: "
            ]
        },
        "YET_KIEU": {
            "name": "Danh Tướng Thủy Chiến Yết Kiêu",
            "openers": [
                "Dưới làn nước sâu sông Bạch Đằng, ta khắc ghi từng trận đánh! Tiểu hữu hãy nghe: ",
                "Một lòng trung thành với Hưng Đạo Vương và non sông, ta kể tiểu hữu nghe nhé: "
            ]
        },
        "THANH_DUC": {
            "name": "Cấm Quân Thánh Dực",
            "openers": [
                "Trên tay khắc chữ Sát Thát, cấm quân chúng ta xin kể lại cho hậu thế: "
            ]
        },
        "QUAN_SAT_THAT": {
            "name": "Dũng Sĩ Sát Thát",
            "openers": [
                "Hai chữ Sát Thát khắc sâu trên cánh tay, ta kể cho tiểu hữu nghe: "
            ]
        }
    }

    @classmethod
    def get_persona(cls, character_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not character_id:
            return None
        norm_id = character_id.strip().upper()
        return cls.PERSONAS.get(norm_id)

    @classmethod
    def compose(
        cls,
        query: str,
        unit_record: Dict[str, Any],
        detected_q_type: str,
        is_coref_followup: bool = False,
        character_id: Optional[str] = None,
        turn_seed: int = 0
    ) -> Dict[str, Any]:
        persona = cls.get_persona(character_id)
        char_name = persona["name"] if persona else "Trợ Lý AI Lịch Sử Đông A"

        unit_q_type = unit_record.get("q_type", "EVENT")
        base_answer = unit_record.get("answer", "")
        follow_up = unit_record.get("follow_up", "")

        # Đối với câu giao tiếp (Chào hỏi, Cảm ơn, Hỏi bài khó) hoặc Phân biệt triều đại
        if (unit_q_type in ["INTENT", "CROSS_ERA"] or 
            unit_record.get("category") in ["CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD"] or 
            "CROSS_ERA" in unit_record.get("unit_id", "")):
            return {
                "answer": base_answer,
                "character_name": char_name,
                "is_not_found": False
            }

        # Nếu là loại câu hỏi yêu cầu trả lời trực tiếp ngay ở câu 1-2 (FACT, VERIFICATION, EVIDENCE, COUNTERFACTUAL, COMPARISON)
        if (detected_q_type in cls.DIRECT_ANSWER_TYPES or 
            unit_q_type in cls.DIRECT_ANSWER_TYPES or 
            unit_record.get("category") in cls.DIRECT_ANSWER_TYPES):
            lead_in = ""
        else:
            # Chọn lời dẫn tự nhiên dựa trên ngữ cảnh câu hỏi của người dùng
            idx = abs(hash(query) + turn_seed)
            if persona:
                openers = persona["openers"]
                lead_in = openers[idx % len(openers)] + "\n\n"
            elif is_coref_followup:
                bridges = cls.NATURAL_LEAD_INS["FOLLOW_UP_BRIDGE"]
                lead_in = bridges[idx % len(bridges)]
            else:
                effective_type = detected_q_type if detected_q_type in cls.NATURAL_LEAD_INS else unit_q_type
                candidates = cls.NATURAL_LEAD_INS.get(effective_type, cls.NATURAL_LEAD_INS.get("OVERVIEW", [""]))
                lead_in = candidates[idx % len(candidates)]

        # Ghép mạch văn tự nhiên: Lời dẫn + Nội dung giải thích
        composed_text = f"{lead_in}{base_answer}"

        return {
            "answer": composed_text,
            "character_name": char_name,
            "is_not_found": False
        }


# ==============================================================================
# 4. KIẾN TRÚC MODEL NLP TỔNG THỂ (DONG A HYBRID NLP MODEL)
# ==============================================================================
class DongANLPModel:
    """
    Model Ngôn ngữ Tự nhiên hoàn chỉnh được huấn luyện từ tập Train (80%)
    và đóng gói độc lập để phục vụ Test (20%) cũng như Main API.
    """
    MULTI_INTENT_ANCHORS: List[Tuple[str, List[str]]] = [
        ("BINH_THAN_CONFERENCE", ["hoi nghi binh than", "ben binh than", "binh than"]),
        ("DIEN_HONG_CONFERENCE", ["hoi nghi dien hong", "dien hong"]),
        ("KC3_VAN_DON", ["van don", "tran khanh du", "thuyen luong"]),
        ("KC3_BACH_DANG_HOW", ["tran bach dang", "song bach dang", "bach dang"]),
        ("KC1_BINH_LE_NGUYEN", ["binh le nguyen", "le phu tran"]),
        ("KC1_DONG_BO_DAU", ["dong bo dau"]),
        ("KC1_VUON_KHONG_NHA_TRONG", ["vuon khong nha trong"]),
        ("TQT_OVERVIEW", ["tran quoc toan", "hoai van hau"]),
        ("KC2_TRAN_BINH_TRONG", ["tran binh trong", "bao nghia vuong"]),
        ("TRAN_QUANG_KHAI_POETRY", ["tran quang khai", "tung gia hoan kinh su"]),
        ("PHAM_NGU_LAO", ["pham ngu lao", "thuat hoai"]),
        ("GAME_TRAN_NHAN_TONG", ["tran nhan tong", "phat hoang", "truc lam yen tu", "truc lam"]),
        ("GAME_NGU_BINH_U_NONG", ["ngu binh u nong", "ngu binh"]),
        ("GAME_BINH_THU_YEU_LUOC", ["binh thu yeu luoc"]),
        ("KC1_TRAN_THU_DO_QUOTE", ["tran thu do"]),
        ("HICH_TUONG_SI", ["hich tuong si"]),
        ("KC2_HAM_TU_CHUONG_DUONG", ["ham tu", "chuong duong", "tay ket"]),
        ("KC2_THOAT_HOAN_COPPER_PIPE", ["thoat hoan", "chui ong dong"]),
        ("GAME_QUAN_THANH_DUC_SAT_THAT", ["quan thanh duc", "non ma loi"]),
        ("GAME_VAN_KIEP_THIEN_TRUONG_BASES", ["can cu van kiep", "thien truong", "truong yen"]),
        ("GAME_TRUNG_THAN_VS_PHAN_BOI", ["tran ich tac", "tran kien"])
    ]

    MICRO_QUIZ_BANK: Dict[str, str] = {
        "KC1_VUON_KHONG_NHA_TRONG": "Trong cuộc kháng chiến lần thứ nhất (1258), vì sao nhà Trần chủ động rút khỏi kinh thành Thăng Long để thực hiện kế sách 'Vườn không nhà trống'?",
        "KC1_DONG_BO_DAU": "Trận phản công quyết định nào vào tháng 1/1258 đã quét sạch quân Mông Cổ khỏi kinh thành Thăng Long, kết thúc thắng lợi kháng chiến lần 1?",
        "TQT_WHY_ORANGE": "Vì sao tại Hội nghị Bình Than (1282), thiếu niên Trần Quốc Toản lại vô tình bóp nát quả cam vua ban và sau đó chàng đã làm gì?",
        "DIEN_HONG_CONFERENCE": "Hội nghị Diên Hồng (1285) được tổ chức nhằm mục đích gì và tiếng hô đồng thanh của các bô lão thể hiện ý nghĩa gì?",
        "HICH_TUONG_SI": "Ai là tác giả bài 'Hịch tướng sĩ' và bài hịch này có vai trò như thế nào đối với tinh thần quân dân nhà Trần?",
        "KC3_VAN_DON": "Chiến thắng Vân Đồn (1288) do ai chỉ huy và việc tiêu diệt đoàn thuyền lương của Trương Văn Hổ có tác động gì đến đại quân Nguyên?",
        "KC3_BACH_DANG_HOW": "Hãy trình bày tóm tắt diễn biến và nghệ thuật quân sự của Trần Hưng Đạo trong đại thắng trên sông Bạch Đằng tháng 4 năm 1288?",
        "CAUSES_OF_VICTORY": "Nêu các nguyên nhân cốt lõi giúp nhà Trần ba lần đánh thắng đế chế Mông - Nguyên hùng mạnh?",
        "MILITARY_ART_TRAN_DYNASTY": "Nghệ thuật quân sự 'lấy đoản binh chế trường trận' và thế trận chiến tranh nhân dân thời Trần được thể hiện như thế nào?"
    }

    def __init__(self):
        self.classifier_pipeline: Optional[Pipeline] = None
        self.semantic_vectorizer: Optional[TfidfVectorizer] = None
        self.semantic_matrix = None
        self.train_records: List[Dict[str, Any]] = []
        self.unit_lookup: Dict[str, Dict[str, Any]] = {}
        self.custom_units: Dict[str, Dict[str, Any]] = {}
        # Bộ quản lý ngữ cảnh hội thoại đa lượt (Conversational Context Manager)
        self.context_manager = ConversationalContextManager()
        self.session_memory: Dict[str, Dict[str, Any]] = self.context_manager.sessions
        self._load_custom_knowledge()

    def _load_custom_knowledge(self):
        """Nạp các tri thức mở rộng do người dùng/giáo viên dạy thêm từ đĩa (Hot-Reload Knowledge Base)."""
        if not hasattr(self, "custom_units") or self.custom_units is None:
            self.custom_units = {}
        if CUSTOM_KNOWLEDGE_FILE.exists():
            try:
                raw_data = json.loads(CUSTOM_KNOWLEDGE_FILE.read_text(encoding="utf-8"))
                if isinstance(raw_data, dict):
                    for uid, rec in raw_data.items():
                        self.custom_units[uid] = rec
                        self.unit_lookup[uid] = rec
            except Exception:
                pass

    def teach_new_knowledge(
        self,
        unit_id: str = "",
        topic: str = "",
        question_examples: Optional[List[str]] = None,
        answer: str = "",
        fact_chunk: str = "",
        entity: str = "Nhà Trần",
        event: str = "Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)",
        base_queries: Optional[List[str]] = None,
        cognitive_level: str = "THONG_HIEU",
        difficulty: float = 0.5,
    ) -> Dict[str, Any]:
        """
        Dạy thêm tri thức mới cho AI ngay lúc chạy (Zero-Retrain Hot-Reload Learning):
        Lưu bền vững vào `custom_knowledge.json` và nạp thẳng vào bộ nhớ `unit_lookup` + `custom_units`.
        Hỗ trợ đồng thời cả lời gọi nội bộ (`question_examples`) lẫn API `/api/chat/teach` (`base_queries`).
        """
        self._load_custom_knowledge()
        raw_uid = (unit_id or "").strip().upper()
        if not raw_uid:
            slug = re.sub(r"[^A-Z0-9]+", "_", remove_accents(topic).upper()).strip("_")[:32]
            raw_uid = slug or f"UNIT_{len(self.custom_units) + 1}"
        clean_uid = raw_uid if raw_uid.startswith("CUSTOM_") else f"CUSTOM_{raw_uid}"

        raw_examples = question_examples if question_examples is not None else (base_queries or [])
        clean_examples = [q.strip() for q in raw_examples if q and q.strip()]

        record = {
            "status": "success",
            "unit_id": clean_uid,
            "category": "CUSTOM_KNOWLEDGE",
            "q_type": "EVENT",
            "topic": topic.strip(),
            "entity": (entity or "Nhà Trần").strip(),
            "event": (event or "Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)").strip(),
            "cognitive_level": cognitive_level or "THONG_HIEU",
            "difficulty": float(difficulty if difficulty is not None else 0.5),
            "question_examples": clean_examples,
            "answer": answer.strip(),
            "grounding_source": {
                "doc_name": "Tư liệu Bổ sung Chuyên đề Lịch sử 7 (Giáo viên / Hệ thống)",
                "curriculum_match": f"Chuyên đề mở rộng: {topic.strip()}",
                "fact_chunk": (fact_chunk or answer).strip()
            },
            "game_metadata": {
                "unlocked_badge": "Sử gia thông thái",
                "exp_reward": 35
            },
            "added_training_samples": len(clean_examples),
            "total_units": len(self.unit_lookup) + (0 if clean_uid in self.unit_lookup else 1),
        }
        self.custom_units[clean_uid] = record
        self.unit_lookup[clean_uid] = record
        record["total_units"] = len(self.unit_lookup)

        try:
            CUSTOM_KNOWLEDGE_FILE.parent.mkdir(parents=True, exist_ok=True)
            CUSTOM_KNOWLEDGE_FILE.write_text(
                json.dumps(self.custom_units, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
        except Exception:
            pass
        return record

    def match_custom_knowledge(self, query: str) -> Optional[Tuple[str, float]]:
        """Kiểm tra độ khớp ngữ nghĩa giữa câu hỏi và kho tri thức động `custom_units`."""
        self._load_custom_knowledge()
        if not self.custom_units:
            return None
        unacc_q = normalize_vi(remove_accents(query))
        q_tokens = set(unacc_q.split())
        if not q_tokens:
            return None

        best_uid = None
        best_sim = 0.0
        for uid, rec in self.custom_units.items():
            candidates = rec.get("question_examples", []) + [rec.get("topic", "")]
            for cand in candidates:
                unacc_c = normalize_vi(remove_accents(cand))
                c_tokens = set(unacc_c.split())
                if not c_tokens:
                    continue
                overlap = len(q_tokens & c_tokens) / max(1, min(len(q_tokens), len(c_tokens)))
                seq_ratio = difflib.SequenceMatcher(None, unacc_q, unacc_c).ratio()
                score = 0.55 * overlap + 0.45 * seq_ratio
                if score > best_sim:
                    best_sim = score
                    best_uid = uid

        if best_uid and best_sim >= 0.58:
            return best_uid, round(min(0.98, best_sim + 0.15), 4)
        return None

    def detect_multi_intent_units(self, query: str) -> List[str]:
        """
        Phát hiện câu hỏi gộp nhiều chủ điểm độc lập (Multi-Intent / Multi-Chunk Query),
        ví dụ: 'Hội nghị Bình Than và Hội nghị Diên Hồng khác nhau thế nào?'
        hoặc 'Kể về chiến công của Trần Khánh Dư ở Vân Đồn và Trần Hưng Đạo ở Bạch Đằng'.
        """
        unacc = normalize_vi(remove_accents(expand_abbreviations(query)))
        padded = f" {unacc} "
        has_connector = any(
            c in padded for c in [" va ", " voi ", " so sanh ", " khac nhau ", " phan biet ", " cung nhu "]
        )
        if not has_connector:
            return []

        matched: List[Tuple[int, str]] = []
        for uid, keywords in self.MULTI_INTENT_ANCHORS:
            if uid not in self.unit_lookup:
                continue
            positions = [unacc.find(kw) for kw in keywords if kw in unacc]
            if positions:
                matched.append((min(positions), uid))

        matched.sort(key=lambda x: x[0])
        uids = [uid for _, uid in matched]

        # Nếu nhắc Trần Quốc Toản bóp cam ở Bình Than trong cùng 1 sự kiện -> không tách làm 2 chủ điểm
        if "TQT_OVERVIEW" in uids and "BINH_THAN_CONFERENCE" in uids:
            if any(k in unacc for k in ["qua cam", "bop cam", "bop nat"]):
                uids.remove("BINH_THAN_CONFERENCE")

        return uids[:2] if len(uids) >= 2 else []

    def fit(self, train_records: List[Dict[str, Any]]):
        """
        Huấn luyện đồng thời:
        1. Supervised Topic & Intent Classifier (Word + Char N-gram TF-IDF + Calibrated LinearSVC)
        2. Fine-grained Semantic Vector Space trên tập Train (80%)
        """
        self.train_records = train_records
        for r in train_records:
            uid = r["unit_id"]
            if uid not in self.unit_lookup:
                self.unit_lookup[uid] = r

        # Nạp các đơn vị phản hồi đặc biệt (Làm rõ đại từ vua, Đính chính, Ngoài SGK)
        for spec_uid, spec_rec in SPECIAL_GROUNDED_RESPONSES.items():
            if spec_uid not in self.unit_lookup:
                self.unit_lookup[spec_uid] = spec_rec

        X_texts = [build_bilingual_features(r["user_query"]) for r in train_records]
        y_labels = [r["unit_id"] for r in train_records]

        # 1. Pipeline Phân loại Học máy (Word N-grams + Character N-grams + Calibrated SVM)
        feature_union = FeatureUnion([
            ("word_tfidf", TfidfVectorizer(ngram_range=(1, 3), token_pattern=r"(?u)\b\w+\b", sublinear_tf=True)),
            ("char_tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True))
        ])

        base_svc = LinearSVC(C=1.5, class_weight="balanced", random_state=42)
        calibrated_clf = CalibratedClassifierCV(estimator=base_svc, cv=3)

        self.classifier_pipeline = Pipeline([
            ("features", feature_union),
            ("clf", calibrated_clf)
        ])
        self.classifier_pipeline.fit(X_texts, y_labels)

        # 2. Không gian Vector Ngữ nghĩa (Semantic Retrieval Matrix) kết hợp câu hỏi + nội dung
        corpus_docs = []
        for r in train_records:
            q_part = r["user_query"]
            topic_part = r.get("topic", "")
            fact_part = r.get("grounding_source", {}).get("fact_chunk", "")
            # Nhân trọng số cho câu hỏi để ưu tiên khớp sát câu hỏi tự nhiên
            combined = f"{q_part} {q_part} {q_part} {topic_part} {fact_part}"
            corpus_docs.append(build_bilingual_features(combined))

        self.semantic_vectorizer = TfidfVectorizer(ngram_range=(1, 2), token_pattern=r"(?u)\b\w+\b", sublinear_tf=True)
        self.semantic_matrix = self.semantic_vectorizer.fit_transform(corpus_docs)

        return self

    def predict_unit(self, query: str, session_id: str = "default") -> Tuple[str, float, Dict[str, Any]]:
        """
        Dự đoán đơn vị tri thức (unit_id) tốt nhất cùng độ tự tin (confidence score).
        Tích hợp Context Manager để giải quyết câu hỏi nối tiếp, đại từ, tiền đề sai và làm rõ vua Trần.
        """
        if not hasattr(self, "context_manager") or self.context_manager is None:
            self.context_manager = ConversationalContextManager()
            if hasattr(self, "session_memory") and self.session_memory:
                self.context_manager.sessions = self.session_memory
            else:
                self.session_memory = self.context_manager.sessions

        if not query or not query.strip():
            return "OOD_RANDOM_AND_OFFTOPIC", 1.0, {"reason": "empty"}

        # 0A. Kiểm tra kho tri thức mở rộng do giáo viên/người dùng dạy thêm (Hot-Reload Knowledge Base)
        custom_hit = self.match_custom_knowledge(query)
        if custom_hit:
            c_uid, c_conf = custom_hit
            return c_uid, c_conf, {
                "is_coref": False,
                "q_type": "EVENT",
                "raw_cosine": c_conf,
                "rewritten": query,
                "selection_rationale": f"Hot-Reload Custom Knowledge Base Match ({c_uid})"
            }

        # 0. Giải quyết ngữ cảnh hội thoại, đại từ, tiền đề sai & làm rõ
        rewritten_query, is_rewritten, override_res = self.context_manager.resolve_query(query, session_id=session_id)
        if override_res:
            spec_uid = override_res["unit_id"]
            if spec_uid not in self.unit_lookup:
                self.unit_lookup[spec_uid] = override_res
            return spec_uid, 0.99, {
                "is_coref": False,
                "q_type": override_res.get("category", "CLARIFICATION"),
                "override_result": override_res,
                "raw_cosine": 1.0,
                "rewritten": rewritten_query
            }

        normalized_query = expand_abbreviations(rewritten_query)

        # 1. Kiểm tra ranh giới triều đại trước (Cross-Era Guardrail)
        cross_era_uid = VietnameseNLU.detect_cross_era(normalized_query)
        if cross_era_uid and cross_era_uid in self.unit_lookup:
            return cross_era_uid, 0.98, {"is_coref": is_rewritten, "q_type": "CROSS_ERA", "rewritten": rewritten_query}

        # 2. Kiểm tra tín hiệu miền kiến thức (tránh các số ngẫu nhiên hoặc câu vô nghĩa)
        has_signal = VietnameseNLU.has_historical_signal(normalized_query)
        detected_q_type = VietnameseNLU.detect_question_type(normalized_query)

        feat_text = build_bilingual_features(normalized_query)

        # 3. Tính xác suất từ Classifier học máy
        probs = self.classifier_pipeline.predict_proba([feat_text])[0]
        classes = self.classifier_pipeline.classes_
        clf_scores = {classes[i]: float(probs[i]) for i in range(len(classes))}

        # 4. Tính độ tương đồng Cosine từ Semantic Vectorizer + Re-ranking theo loại câu hỏi (q_type)
        q_vec = self.semantic_vectorizer.transform([feat_text])
        cos_sims = (self.semantic_matrix @ q_vec.T).toarray().flatten()

        unit_sem_scores: Dict[str, float] = {}
        for idx, sim in enumerate(cos_sims):
            rec = self.train_records[idx]
            uid = rec["unit_id"]
            bonus = 0.08 if rec.get("q_type") == detected_q_type else 0.0
            score = float(sim) + bonus
            if score > unit_sem_scores.get(uid, 0.0):
                unit_sem_scores[uid] = score

        # 5. Hợp nhất điểm Hybrid (60% ML Classifier + 40% Semantic Cosine)
        unacc_q = normalize_vi(remove_accents(normalized_query))
        combined_scores: Dict[str, float] = {}
        for uid in classes:
            c_score = clf_scores.get(uid, 0.0)
            s_score = unit_sem_scores.get(uid, 0.0)
            score_val = 0.60 * c_score + 0.40 * s_score
            # Nếu câu hỏi không chứa tín hiệu ngoại triều (cross_era_uid is None) và không hỏi "ai đầu tiên cắm cọc" -> chặn CROSS_ERA_* tranh chấp với Bạch Đằng 1288
            if uid.startswith("CROSS_ERA_") and not cross_era_uid and not ("dau tien" in unacc_q and "coc" in unacc_q):
                score_val *= 0.05
            combined_scores[uid] = score_val

        # Sắp xếp top 3 cụm tri thức có điểm kết hợp cao nhất
        sorted_candidates = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        top_3 = []
        for uid, score in sorted_candidates[:3]:
            top_3.append({
                "unit_id": uid,
                "combined_score": round(float(score), 4),
                "classifier_prob": round(clf_scores.get(uid, 0.0), 4),
                "semantic_score": round(unit_sem_scores.get(uid, 0.0), 4)
            })

        best_uid = sorted_candidates[0][0]
        best_score = sorted_candidates[0][1]
        max_raw_cos = float(np.max(cos_sims)) if len(cos_sims) > 0 else 0.0

        # ======================================================================
        # CỔNG PHÙ HỢP Ý ĐỊNH & KIỂM SOÁT CHẤT LƯỢNG (RELEVANCE GATE)
        # ======================================================================
        gate_rationale = "ML Classifier + Semantic Cosine Hybrid Ranking"

        # Gate 0A: Hỏi thông tin danh tính trợ lý / khả năng của AI
        is_identity_query = any(k in unacc_q for k in [
            "ban la ai", "thay la ai", "thay ten gi", "ban ten gi", "ai tao ra ban",
            "ai tao ra thay", "thay lam duoc nhung gi", "thay lam duoc gi",
            "ban lam duoc gi", "tro ly dong a la gi", "cach dung chatbot"
        ])
        if is_identity_query and "INTENT_ASSISTANT_IDENTITY" in self.unit_lookup:
            best_uid = "INTENT_ASSISTANT_IDENTITY"
            best_score = max(best_score, 0.95)
            detected_q_type = "INTENT"
            gate_rationale = "Relevance Gate: Assistant identity / capabilities query detected"

        # Gate 0: Học sinh chưa biết hỏi gì / xin gợi ý câu hỏi / tư vấn lộ trình học tập
        is_study_guidance = any(k in unacc_q for k in [
            "khong biet nen hoi gi", "khong biet hoi gi", "nen hoi gi", "hoi gi bay gio",
            "goi y cau hoi", "goi y cho em", "bat dau tu dau", "nen hoc gi",
            "lo trinh hoc", "danh gia nang luc", "ho so hoc tap", "khong biet dap an",
            "chua hieu bai", "kho qua em khong biet"
        ])
        if is_study_guidance and "INTENT_STUDENT_STRUGGLE" in self.unit_lookup:
            best_uid = "INTENT_STUDENT_STRUGGLE"
            best_score = max(best_score, 0.92)
            detected_q_type = "INTENT"
            gate_rationale = "Relevance Gate: Study guidance / student struggle intent detected"

        # Gate 0B: Nhận diện mô tả gián tiếp (Zero-Keyword Paraphrase) -> Ánh xạ thẳng tới Unit đích
        raw_unacc_q = normalize_vi(remove_accents(rewritten_query))
        for triggers, _, target_uid in INDIRECT_CONCEPT_MAPPINGS:
            if any(t in raw_unacc_q for t in triggers) and target_uid in self.unit_lookup:
                best_uid = target_uid
                best_score = max(best_score, 0.91)
                gate_rationale = f"Relevance Gate: Indirect concept description mapped to {target_uid}"
                break

        # Gate 1: Câu hỏi về nguyên nhân giặc thua dù đông và mạnh / nguyên nhân thắng lợi
        is_why_enemy_lost = any(k in unacc_q for k in [
            "dong va manh", "van thua", "vi sao thua", "tai sao thua",
            "nguyen nhan thang loi", "vi sao thang", "tai sao thang", "nuoc nho thang",
            "danh thang quan mong", "danh thang de che", "danh thang duoc de che",
            "nguyen nhan nha tran thang", "yeu to quan trong nhat giup", "vua toi dong long"
        ])
        if is_why_enemy_lost and best_uid != "CAUSES_OF_VICTORY":
            causes_score = combined_scores.get("CAUSES_OF_VICTORY", 0.0)
            best_uid = "CAUSES_OF_VICTORY"
            best_score = max(best_score, causes_score, 0.85)
            gate_rationale = "Relevance Gate: Re-routed query asking why enemy lost / causes of victory to CAUSES_OF_VICTORY"

        # Gate 1B: Câu hỏi về âm mưu / mục đích Mông Cổ xâm lược lần 1 năm 1258
        is_kc1_motive = (
            any(k in unacc_q for k in ["muc dich cua mong co", "am muu mong co", "muon duong", "nam tong", "su gia mong co", "ngot luong hop thai"])
            or (
                any(w in unacc_q for w in ["muc dich", "am muu", "vi sao", "tai sao", "nguyen nhan"])
                and any(w in unacc_q for w in ["mong co", "1258", "lan 1", "lan thu nhat"])
                and any(w in unacc_q for w in ["xam luoc", "danh dai viet", "tan cong"])
            )
        )
        if is_kc1_motive and "KC1_WHY_INVADE" in self.unit_lookup:
            best_uid = "KC1_WHY_INVADE"
            best_score = max(best_score, 0.88)
            gate_rationale = "Relevance Gate: Mongol invasion motive / 1258 purpose routed to KC1_WHY_INVADE"

        # Gate 1C: Phân biệt câu nói Trần Hưng Đạo ("Nếu bệ hạ muốn hàng xin hãy chém đầu thần trước đã") với Trần Thủ Độ
        if any(k in unacc_q for k in ["muon hang", "chem dau than", "chem dau toi"]) and "TRAN_HUNG_DAO_PORTRAIT" in self.unit_lookup:
            best_uid = "TRAN_HUNG_DAO_PORTRAIT"
            best_score = max(best_score, 0.92)
            gate_rationale = "Relevance Gate: Trần Hưng Đạo quote ('chém đầu thần trước đã') routed to TRAN_HUNG_DAO_PORTRAIT"

        # Gate 1D: Câu hỏi toàn cảnh kháng chiến lần 3 (1287 - 1288)
        is_kc3_overview = (
            any(k in unacc_q for k in ["lan thu ba", "lan 3", "lan thu 3", "1287"])
            and any(k in unacc_q for k in ["khang chien", "dien bien", "tom tat", "ke ve", "tran danh lon nao", "nam 1288"])
            and not any(b in unacc_q for b in ["bach dang", "van don", "thuyen luong", "coc", "truong van ho", "o ma nhi", "quyet dinh"])
        )
        if is_kc3_overview and "KC3_OVERVIEW" in self.unit_lookup:
            best_uid = "KC3_OVERVIEW"
            best_score = max(best_score, 0.88)
            gate_rationale = "Relevance Gate: 3rd campaign overview routed to KC3_OVERVIEW"

        # Gate 1E: Tổng quan 3 lần kháng chiến (diễn ra những năm nào, thắng mấy lần, tổng kết 3 lần)
        is_all_3_summary = any(k in unacc_q for k in [
            "dien ra vao nhung nam nao", "thang mong nguyen may lan", "danh thang quan mong nguyen may lan",
            "tong ket ca 3 lan", "tong ket ba lan", "tom tat ba lan", "tom tat 3 lan",
            "cac tran danh tieu bieu trong 3 lan", "cac tran danh tieu bieu trong ba lan"
        ])
        if is_all_3_summary and "ALL_3_WARS_SUMMARY" in self.unit_lookup:
            best_uid = "ALL_3_WARS_SUMMARY"
            best_score = max(best_score, 0.90)
            gate_rationale = "Relevance Gate: 3 wars summary / count / years routed to ALL_3_WARS_SUMMARY"

        # Gate 1F: Ý nghĩa lịch sử / tầm vóc quốc tế / thế giới của 3 lần kháng chiến và Bạch Đằng
        is_hist_sig = (
            any(k in unacc_q for k in [
                "tam voc the gioi", "tam voc quoc te", "y nghia gi doi voi the gioi",
                "y nghia doi voi the gioi", "y nghia lich su cua ba lan", "y nghia 3 lan",
                "y nghia ba lan", "thang loi chong mong nguyen de lai bai hoc gi"
            ])
            and not any(d in unacc_q for d in ["hien nay", "ngay nay", "hom nay"])
        )
        if is_hist_sig and "HISTORICAL_SIGNIFICANCE" in self.unit_lookup:
            best_uid = "HISTORICAL_SIGNIFICANCE"
            best_score = max(best_score, 0.90)
            gate_rationale = "Relevance Gate: Historical / international significance routed to HISTORICAL_SIGNIFICANCE"

        # Gate 1G: Trận địa cọc gỗ / cọc ngầm khi triều rút trên sông Bạch Đằng (1288)
        if (
            any(k in unacc_q for k in ["trieu rut", "vuong coc", "coc ngam", "bai coc"])
            and not cross_era_uid
            and not ("dau tien" in unacc_q and "coc" in unacc_q)
            and "KC3_BACH_DANG_HOW" in self.unit_lookup
        ):
            best_uid = "KC3_BACH_DANG_HOW"
            best_score = max(best_score, 0.88)
            gate_rationale = "Relevance Gate: Tidal stakes battle tactic routed to KC3_BACH_DANG_HOW"

        # Gate 2: Câu hỏi về rút khỏi Thăng Long / kế sách rút lui / chiến thuật rút lui
        is_withdraw_thang_long = any(k in unacc_q for k in [
            "rut khoi thang long", "rut lui khoi thang long", "roi thang long",
            "chu dong rut khoi thang long", "tam rut khoi thang long", "bo thang long",
            "chien thuat rut lui", "rut lui khong dong nghia", "rut lui khong phai that bai"
        ])
        if is_withdraw_thang_long and best_uid != "KC1_VUON_KHONG_NHA_TRONG":
            vknt_score = combined_scores.get("KC1_VUON_KHONG_NHA_TRONG", 0.0)
            if vknt_score > 0.03 or "KC1_VUON_KHONG_NHA_TRONG" in [c["unit_id"] for c in top_3]:
                best_uid = "KC1_VUON_KHONG_NHA_TRONG"
                best_score = max(best_score, vknt_score)
                gate_rationale = "Relevance Gate: Re-routed withdrawal/Thăng Long tactical query to KC1_VUON_KHONG_NHA_TRONG"

        # Gate 3: Câu hỏi hành động tiếp theo sau khi rút khỏi Thăng Long
        is_after_withdraw_next = any(k in unacc_q for k in [
            "sau khi rut khoi thang long thi quan ta lam gi",
            "sau khi rut khoi thang long quan ta lam gi",
            "quan tran lam gi tiep theo de phan cong"
        ])
        if is_after_withdraw_next and best_uid not in ["KC1_DONG_BO_DAU", "KC1_VUON_KHONG_NHA_TRONG"]:
            dbd_score = combined_scores.get("KC1_DONG_BO_DAU", 0.0)
            best_uid = "KC1_DONG_BO_DAU" if dbd_score > 0.05 else "KC1_VUON_KHONG_NHA_TRONG"
            gate_rationale = "Relevance Gate: Connected next military action after withdrawal to counter-attack at Đông Bộ Đầu"

        # Ghi log chuẩn đoán chi tiết
        import logging
        logging.info(
            f"[RETRIEVAL TOP-3] Query: '{query}' -> Rewritten: '{rewritten_query}'\n"
            f"  • Top 3: {top_3}\n"
            f"  • Selected: {best_uid} (Score: {best_score:.4f})\n"
            f"  • Rationale: {gate_rationale}"
        )

        # Ngưỡng an toàn chống trả lời bừa (Out-of-Domain Rejection)
        if best_uid == "OOD_RANDOM_AND_OFFTOPIC" or not has_signal or best_score < 0.14:
            return "OOD_RANDOM_AND_OFFTOPIC", best_score, {
                "is_coref": is_rewritten,
                "q_type": "OOD",
                "raw_cosine": max_raw_cos,
                "rewritten": rewritten_query,
                "top_3_retrieved": top_3,
                "selection_rationale": "Rejected as Out-of-Domain (low score or missing domain signal)"
            }

        return best_uid, best_score, {
            "is_coref": is_rewritten,
            "q_type": detected_q_type,
            "raw_cosine": max_raw_cos,
            "rewritten": rewritten_query,
            "top_3_retrieved": top_3,
            "selection_rationale": gate_rationale
        }

    def generate_natural_response(
        self,
        query: str,
        character_id: Optional[str] = None,
        session_id: str = "default",
        student_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Hàm suy luận chính trả về câu trả lời tự nhiên, nguồn trích dẫn và phần thưởng game.
        """
        if not hasattr(self, "context_manager") or self.context_manager is None:
            self.context_manager = ConversationalContextManager()
            if hasattr(self, "session_memory") and self.session_memory:
                self.context_manager.sessions = self.session_memory
            else:
                self.session_memory = self.context_manager.sessions

        effective_student_id = student_id or "student_nguyen_van_long"
        sess = self.context_manager.get_or_create_session(session_id)
        unacc_raw = normalize_vi(remove_accents(query))
        persona_obj = ConversationalNLG.get_persona(character_id)
        speaker_name = persona_obj["name"] if persona_obj else "Trợ Lý AI Lịch Sử Đông A"

        quiz_request_phrases = [
            "do em mot cau", "do em 1 cau", "do em cau", "kiem tra bai cu",
            "kiem tra bai em", "cho em 1 cau hoi", "cho em mot cau hoi",
            "thu thach em", "hoi em mot cau", "do em tiep"
        ]
        is_quiz_request = any(k in unacc_raw for k in quiz_request_phrases)

        # 0A. Nếu học sinh đang trả lời câu đố nhanh trong Chat (pending_quiz_unit)
        if sess.get("pending_quiz_unit") and not is_quiz_request:
            quiz_uid = sess["pending_quiz_unit"]
            is_skip = any(k in unacc_raw for k in ["bo qua", "thoi khong", "giai dap luon", "em khong biet"])
            is_new_question = ("?" in query or unacc_raw.startswith(("tai sao ", "vi sao ", "ai la ", "so sanh ", "ke ve ")))
            if is_skip:
                sess["pending_quiz_unit"] = None
                ref_rec = self.unit_lookup.get(quiz_uid, {})
                skip_ans = (
                    f"Không sao cả! Thầy giải đáp câu đố chủ đề **{ref_rec.get('topic', quiz_uid)}** để em nắm vững nhé:\n\n"
                    f"{ref_rec.get('answer', '')}"
                )
                return {
                    "unit_id": quiz_uid,
                    "topic": ref_rec.get("topic", quiz_uid),
                    "confidence": 0.99,
                    "answer": skip_ans,
                    "character_name": speaker_name,
                    "grounding_sources": [],
                    "badge_unlocked": None,
                    "exp_reward": 10,
                    "is_not_found": False
                }
            elif is_new_question:
                sess["pending_quiz_unit"] = None
            else:
                sess["pending_quiz_unit"] = None
                from bkt_engine import bkt_engine
                eval_res = bkt_engine.evaluate_short_answer(
                    student_id=effective_student_id,
                    unit_id=quiz_uid,
                    student_answer=query
                )
                bkt_upd = eval_res["bkt_update"]
                matched_str = ", ".join(eval_res["matched_concepts"]) if eval_res["matched_concepts"] else "Chưa khớp từ khóa trọng tâm"
                grade_label = "Xuất sắc" if eval_res["score_10"] >= 8.5 else ("Đạt yêu cầu" if eval_res.get("is_passed") else "Cần cố gắng thêm")
                grade_ans = (
                    f"📝 **KẾT QUẢ CHẤM CÂU ĐỐ TỰ LUẬN TRỰC TIẾP**\n\n"
                    f"• **Chủ đề**: {eval_res['topic']}\n"
                    f"• **Điểm số của em**: **{eval_res['score_10']}/10** (*{grade_label}*)\n"
                    f"• **Cập nhật Hồ sơ BKT $P(L)$**: `{int(bkt_upd['old_p_l'] * 100)}%` ➔ **`{int(bkt_upd['new_p_l'] * 100)}%`**\n"
                    f"• **Ý cốt lõi em đã nêu đúng**: {matched_str}\n"
                    f"• **Nhận xét của thầy**: {eval_res.get('ai_feedback', '')}\n\n"
                    f"---\n"
                    f"📚 **Đáp án chuẩn SGK để em đối chiếu**:\n{eval_res.get('standard_reference_answer', '')}"
                )
                self.context_manager.update_session(
                    session_id, query, self.unit_lookup.get(quiz_uid, {"unit_id": quiz_uid}), grade_ans, {}
                )
                return {
                    "unit_id": "INTERACTIVE_CHAT_QUIZ_GRADE",
                    "graded_unit_id": quiz_uid,
                    "topic": eval_res["topic"],
                    "confidence": 0.99,
                    "answer": grade_ans,
                    "character_name": speaker_name,
                    "grounding_sources": [],
                    "badge_unlocked": "Trạng nguyên Đông A" if eval_res["score_10"] >= 8.0 else "Sử gia thông thái",
                    "exp_reward": 50 if eval_res["is_passed"] else 20,
                    "is_not_found": False
                }

        # 0B. Nếu học sinh yêu cầu AI đố 1 câu / kiểm tra bài cũ ngay trên khung Chat
        if is_quiz_request:
            from bkt_engine import bkt_engine
            profile = bkt_engine.analyze_student_profile(effective_student_id, top_k=5)
            asked_units = sess.setdefault("asked_quiz_units", [])
            target_uid = "TQT_WHY_ORANGE"
            mastery_pct = 35
            for mat in profile.get("recommended_study_materials", []):
                cand_uid = mat.get("unit_id")
                if cand_uid in self.MICRO_QUIZ_BANK and cand_uid not in asked_units:
                    target_uid = cand_uid
                    mastery_pct = int((mat.get("current_mastery") or 0.35) * 100)
                    break
            else:
                for cand_uid in self.MICRO_QUIZ_BANK:
                    if cand_uid not in asked_units:
                        target_uid = cand_uid
                        break

            asked_units.append(target_uid)
            sess["pending_quiz_unit"] = target_uid
            quiz_q = self.MICRO_QUIZ_BANK[target_uid]
            topic_name = self.unit_lookup.get(target_uid, {}).get("topic", target_uid)
            quiz_prompt_ans = (
                f"🎯 **Thử thách Lịch sử nhanh dành cho em!** *(Chủ đề ưu tiên củng cố: **{topic_name}** — Mức nắm vững hiện tại: **{mastery_pct}%**)*\n\n"
                f"❓ **Câu hỏi**: **{quiz_q}**\n\n"
                f"✍️ *Em hãy gõ câu trả lời tự luận ngắn gọn ngay bên dưới để thầy chấm điểm (thang điểm 10) và nâng cấp mức độ thông thạo $P(L)$ trong Hồ sơ năng lực nhé! (Hoặc gõ \"Bỏ qua\" nếu muốn xem đáp án luôn).*"
            )
            self.context_manager.update_session(
                session_id, query, {"unit_id": "INTERACTIVE_CHAT_QUIZ"}, quiz_prompt_ans, {}
            )
            return {
                "unit_id": "INTERACTIVE_CHAT_QUIZ",
                "quiz_target_unit": target_uid,
                "topic": topic_name,
                "confidence": 0.99,
                "answer": quiz_prompt_ans,
                "character_name": speaker_name,
                "grounding_sources": [],
                "badge_unlocked": None,
                "exp_reward": 10,
                "is_not_found": False
            }

        # 0C. Nếu học sinh yêu cầu AI sinh Đề Ôn Tập Cá Nhân Hóa theo lỗ hổng BKT ("tạo đề ôn tập", "ra đề ôn thi")
        is_exam_request = any(k in unacc_raw for k in [
            "tao de on tap", "tao cho em mot de", "tao cho em 1 de",
            "de kiem tra thu", "ra de on thi", "de on tap rieng"
        ])
        if is_exam_request:
            from bkt_engine import bkt_engine
            exam_data = bkt_engine.generate_adaptive_exam(effective_student_id, num_questions=5)
            lines = [
                f"📋 **ĐỀ ÔN TẬP CÁ NHÂN HÓA (THIẾT KẾ RIÊNG THEO HỒ SƠ BKT CỦA EM)**",
                f"• **Mức độ nắm vững tổng thể**: `{int(exam_data['overall_mastery'] * 100)}%` (*{exam_data['momentum_label']}*)",
                f"• **Mục tiêu đề ôn**: Tập trung lấp lỗ hổng các kỹ năng em đang yếu nhất hoặc có nguy cơ quên theo đường cong Ebbinghaus.\n"
            ]
            for idx, item in enumerate(exam_data["questions"], 1):
                q_type_lbl = "Trắc nghiệm" if item["question_type"] == "MULTIPLE_CHOICE" else "Tự luận ngắn"
                lines.append(
                    f"**Câu {idx} [{q_type_lbl} — {item['cognitive_level']} — Mức nắm vững: {int(item['current_mastery']*100)}%]**:\n"
                    f"❓ *{item['question_text']}*"
                )
                if item.get("options"):
                    opts_str = " | ".join(f"**{chr(65+i)}**. {opt}" for i, opt in enumerate(item["options"]))
                    lines.append(f"   {opts_str}")
            lines.append("\n💡 *Em có thể gõ **\"Thầy đố em một câu đi\"** để làm từng câu tự luận và được chấm điểm trực tiếp ngay trên Chat!*")
            exam_ans = "\n\n".join(lines)
            return {
                "unit_id": "ADAPTIVE_CUSTOM_EXAM",
                "exam_metadata": exam_data,
                "confidence": 0.99,
                "answer": exam_ans,
                "character_name": speaker_name,
                "grounding_sources": [],
                "badge_unlocked": "Sử gia thông thái",
                "exp_reward": 30,
                "is_not_found": False
            }

        best_uid, confidence, meta = self.predict_unit(query, session_id=session_id)

        # 1. Trường hợp có override_result (Làm rõ đại từ vua, Đính chính tiền đề sai, Thông tin ngoài phạm vi)
        if "override_result" in meta:
            override = meta["override_result"]
            speaker = speaker_name
            src = override.get("grounding_source")
            sources = []
            if src and override.get("category") not in ["COUNTERFACTUAL", "ABSENT", "FALSE_PREMISE", "COMPARISON"] and src.get("fact_chunk"):
                sources.append({
                    "doc_name": src.get("doc_name", "SGK Lịch sử 7 (KNTT)"),
                    "page_number": src.get("page_number"),
                    "curriculum_match": src.get("curriculum_match", "SGK Lịch sử 7 - Bài 13"),
                    "fact_chunk": src.get("fact_chunk", "")
                })
            self.context_manager.update_session(session_id, query, override, override["answer"], meta)
            self.session_memory = self.context_manager.sessions

            import logging
            ans_excerpt = (override["answer"][:100] + "...") if len(override["answer"]) > 100 else override["answer"]
            logging.info(
                f"\n[RETRIEVAL & NLG TRACE (SPECIAL GROUNDED)]\n"
                f"  • Original Query    : '{query}'\n"
                f"  • Rewritten Query   : '{meta.get('rewritten', query)}'\n"
                f"  • Classified Intent : {meta.get('q_type', 'SPECIAL_GROUNDED')}\n"
                f"  • Selected Unit     : {override['unit_id']}\n"
                f"  • Final Answer Excerpt: {ans_excerpt}\n"
            )

            return {
                "unit_id": override["unit_id"],
                "confidence": round(confidence, 4),
                "answer": override["answer"],
                "character_name": speaker,
                "grounding_sources": sources,
                "badge_unlocked": "Sử gia thông thái",
                "exp_reward": 25,
                "is_not_found": False
            }

        # 1B. Tổng hợp đa chủ điểm (Multi-Intent / Multi-Chunk Synthesis) khi câu hỏi gộp 2 sự kiện/nhân vật
        multi_uids = self.detect_multi_intent_units(query)
        if len(multi_uids) == 2 and best_uid != "OOD_RANDOM_AND_OFFTOPIC":
            uid_1, uid_2 = multi_uids[0], multi_uids[1]
            rec_1 = self.unit_lookup[uid_1]
            rec_2 = self.unit_lookup[uid_2]
            is_comp = any(k in unacc_raw for k in ["so sanh", "khac nhau", "phan biet", "giong va khac", "doi chieu"])
            header = (
                f"Để giúp em đối chiếu rõ ràng giữa **{rec_1.get('topic', uid_1)}** và **{rec_2.get('topic', uid_2)}**, thầy phân tích chi tiết cả hai phần như sau:\n\n"
                if is_comp else
                f"Câu hỏi của em đề cập đến hai chủ điểm lịch sử quan trọng. Thầy tổng hợp chi tiết lần lượt từng nội dung nhé:\n\n"
            )
            part_1 = f"### 1. {rec_1.get('topic', uid_1)}\n{rec_1.get('answer', '')}"
            part_2 = f"### 2. {rec_2.get('topic', uid_2)}\n{rec_2.get('answer', '')}"
            contrast_block = ""
            fc1 = rec_1.get("grounding_source", {}).get("fact_chunk", "")
            fc2 = rec_2.get("grounding_source", {}).get("fact_chunk", "")
            if is_comp and fc1 and fc2:
                contrast_block = (
                    f"\n\n---\n💡 **Tóm lược điểm khác biệt cốt lõi cần nhớ**:\n"
                    f"• **{rec_1.get('entity', uid_1)} ({rec_1.get('event', '')})**: {fc1}\n"
                    f"• **{rec_2.get('entity', uid_2)} ({rec_2.get('event', '')})**: {fc2}"
                )
            synth_answer = f"{header}{part_1}\n\n{part_2}{contrast_block}"
            synth_sources = []
            for r_item in (rec_1, rec_2):
                s_data = r_item.get("grounding_source", {})
                if s_data and s_data.get("fact_chunk"):
                    synth_sources.append({
                        "doc_name": s_data.get("doc_name", "SGK Lịch sử 7 (KNTT) & Đại Việt Sử Ký Toàn Thư"),
                        "page_number": s_data.get("page_number"),
                        "curriculum_match": s_data.get("curriculum_match", "SGK Lịch sử 7 - Bài 13"),
                        "fact_chunk": s_data.get("fact_chunk", "")
                    })
            self.context_manager.update_session(session_id, query, rec_2, synth_answer, meta)
            self.session_memory = self.context_manager.sessions
            return {
                "unit_id": "MULTI_INTENT_SYNTHESIS",
                "synthesized_units": [uid_1, uid_2],
                "confidence": round(max(confidence, 0.94), 4),
                "answer": synth_answer,
                "character_name": speaker_name,
                "grounding_sources": synth_sources,
                "badge_unlocked": "Sử gia thông thái",
                "exp_reward": 40,
                "is_not_found": False
            }

        # 2. Nếu nằm ngoài phạm vi bài học (Out-of-Domain)
        if best_uid == "OOD_RANDOM_AND_OFFTOPIC" or best_uid not in self.unit_lookup:
            clean_q = query.strip()
            speaker = "ta" if persona_obj else "thầy"
            ood_ans = (
                f"⚠️ Rất tiếc, {speaker} chưa tìm thấy thông tin lịch sử phù hợp với nội dung **\"{clean_q}\"** "
                "trong chuyên đề **Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)** (Lịch sử 7).\n\n"
                "Em có thể thử hỏi những câu tự nhiên xoay quanh bài học như:\n"
                "• **Vì sao Trần Quốc Toản lại bóp nát quả cam?**\n"
                "• **Tại sao Thoát Hoan phải chui vào ống đồng năm 1285?**\n"
                "• **Trận Bạch Đằng năm 1288 của Trần Hưng Đạo diễn ra như thế nào?**\n"
                "• **Kế sách Vườn không nhà trống có tác dụng gì?**"
            )
            self.context_manager.update_session(
                session_id, query, {"unit_id": "OOD_RANDOM_AND_OFFTOPIC"}, ood_ans, meta
            )
            self.session_memory = self.context_manager.sessions

            import logging
            logging.info(
                f"\n[RETRIEVAL & NLG TRACE (OUT OF DOMAIN)]\n"
                f"  • Original Query    : '{query}'\n"
                f"  • Rewritten Query   : '{meta.get('rewritten', query)}'\n"
                f"  • Classified Intent : OOD\n"
                f"  • Top-3 Retrieved   : {meta.get('top_3_retrieved', [])}\n"
                f"  • Selected Unit     : OOD_RANDOM_AND_OFFTOPIC (Score: {confidence:.4f} < Threshold 0.14)\n"
            )

            return {
                "unit_id": "OOD_RANDOM_AND_OFFTOPIC",
                "confidence": round(confidence, 4),
                "answer": ood_ans,
                "character_name": speaker_name,
                "grounding_sources": [],
                "badge_unlocked": None,
                "exp_reward": 0,
                "is_not_found": True
            }

        unit_record = self.unit_lookup[best_uid]
        sess = self.context_manager.get_or_create_session(session_id)

        # Điều chỉnh câu trả lời sắc nét nếu là câu hỏi tiếp nối hoặc cần định hướng học tập cá nhân hóa
        effective_unit_record = dict(unit_record)
        rewritten_q = meta.get("rewritten", query)
        unacc_q = remove_accents(query).lower()
        if best_uid == "INTENT_STUDENT_STRUGGLE":
            try:
                from bkt_engine import bkt_engine
                profile = bkt_engine.analyze_student_profile(effective_student_id, top_k=2)
                weak_mats = profile.get("recommended_study_materials", [])
                weak_line = ""
                if weak_mats:
                    top_weak = weak_mats[0]
                    weak_line = (
                        f"\n\n📊 **Gợi ý riêng từ Hồ sơ năng lực của em**:\n"
                        f"• **Chủ đề cần ưu tiên củng cố**: {top_weak['topic']} (Mức nắm vững hiện tại: **{int((top_weak.get('current_mastery') or 0.35) * 100)}%**).\n"
                        f"• **Tài liệu SGK nên đọc**: {top_weak['sgk_reference']}.\n"
                        f"• **Phương pháp học hiệu quả**: {top_weak['study_method']}"
                    )
            except Exception:
                weak_line = ""

            effective_unit_record["answer"] = (
                "Chào em! Nếu em chưa biết nên hỏi gì hoặc bắt đầu ôn tập từ đâu, thầy gợi ý **khung 3 mốc vàng** cốt lõi của chuyên đề **Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)**:\n\n"
                "1. **Kháng chiến lần 1 (1258)**: Hỏi về kế sách **Vườn không nhà trống** tại Thăng Long hoặc trận phản công **Đông Bộ Đầu**.\n"
                "2. **Kháng chiến lần 2 (1285)**: Hỏi về **Hội nghị Diên Hồng**, chuyện **Trần Quốc Toản bóp nát quả cam**, **Hịch tướng sĩ** hoặc **Thoát Hoan chui ống đồng**.\n"
                "3. **Kháng chiến lần 3 (1287 – 1288)**: Hỏi về trận đốt thuyền lương **Vân Đồn** của Trần Khánh Dư hoặc đại thắng cọc ngầm **Bạch Đằng năm 1288**."
                f"{weak_line}\n\n"
                "Em thích thầy trò mình bắt đầu từ câu chuyện nào trước?"
            )
        elif meta.get("is_coref") and best_uid == "KC1_WHY_INVADE" and any(k in unacc_q for k in ["xu ly", "lam gi", "phan ung"]):
            effective_unit_record["answer"] = (
                "Trước âm mưu xâm lược và thái độ nghênh ngang của ba tên sứ giả Mông Cổ đòi mượn đường, "
                "**Vua Trần Thái Tông đã kiên quyết xử lý bằng cách cự tuyệt, hạ lệnh bắt trói giam ngay sứ giặc vào ngục** "
                "(theo Đại Việt Sử Ký Toàn Thư ghi chép là giam ở Thao Giang).\n\n"
                "Đồng thời, nhà vua lập tức ban lệnh cho các tướng lĩnh sắm sửa vũ khí, triệu tập quân đội "
                "và hiệu triệu muôn dân cả nước chuẩn bị bước vào cuộc kháng chiến trường kỳ giữ gìn non sông!"
            )
        elif any(k in unacc_q for k in ["chien thuat rut lui", "rut lui khong dong nghia", "rut lui khong phai that bai"]):
            effective_unit_record["answer"] = (
                "Trong nghệ thuật quân sự độc đáo thời Trần, việc chủ động rút lui hoàn toàn **không đồng nghĩa với thất bại hay đầu hàng**, "
                "mà là một **bước lùi chiến lược sắc bén** nhằm thực hiện kế sách *'lấy yếu thắng mạnh, lấy đoản binh chế trường trận'*:\n\n"
                "1. **Bảo toàn nguyên vẹn quân chủ lực**: Thế giặc lúc mới sang như thác lũ, kỵ binh hung hãn. Nếu đánh giáp lá cà sống mái sẽ tiêu hao lực lượng. Rút lui giúp ta giữ gìn nguyên vẹn binh lực quý giá.\n"
                "2. **Thực hiện triệt để 'Vườn không nhà trống'**: Chủ động rút lui sơ tán khỏi kinh thành Thăng Long khiến giặc rơi vào cảnh 'thành rỗng không bóng người', không cướp được một hạt thóc, nhanh chóng đói kiệt và phát sinh dịch bệnh.\n"
                "3. **Lấy thoái làm tiến, chuyển bại thành thắng**: Nhường bước khi giặc mạnh nhất, kiên nhẫn chờ thời cơ giặc sa lầy, sĩ khí suy sụp để mở đòn phản công quyết định (tiêu biểu như trận Đông Bộ Đầu năm 1258 hay Hàm Tử, Chương Dương 1285, Bạch Đằng 1288) quét sạch kẻ thù!"
            )
        elif any(k in unacc_q for k in ["sau khi rut khoi thang long", "rut khoi thang long thi quan ta lam gi", "rut khoi thang long quan ta lam gi"]):
            effective_unit_record["answer"] = (
                "Sau khi chủ động rút khỏi kinh thành Thăng Long, quân dân nhà Trần đã triển khai các bước đi chiến lược vô cùng bài bản:\n\n"
                "1. **Bảo toàn và củng cố lực lượng**: Triều đình và đại quân xuôi dòng sông Hồng về vùng hạ lưu (vùng Thiên Mạc) thiết lập phòng tuyến hiểm trở, giữ vững thế trận phòng thủ vững chắc.\n"
                "2. **Thực hiện triệt để 'Vườn không nhà trống'**: Để lại tòa thành rỗng không một bóng người, không lương thực, làm quân Mông Cổ sau hơn 9 ngày chiếm đóng lâm vào cảnh thiếu đói trầm trọng và suy kiệt sĩ khí.\n"
                "3. **Chớp thời cơ mở cuộc đại phản công Đông Bộ Đầu (29/1/1258)**: Khi thấy giặc đã cùng quẫn, vua Trần Thái Tông trực tiếp chỉ huy mở đợt tổng phản công sấm sét tại bến Đông Bộ Đầu, đánh tan nát quân giặc và thu phục lại kinh thành Thăng Long!"
            )

        composed = ConversationalNLG.compose(
            query=rewritten_q,
            unit_record=effective_unit_record,
            detected_q_type=meta.get("q_type", "EVENT"),
            is_coref_followup=meta.get("is_coref", False),
            character_id=character_id,
            turn_seed=sess["turn_count"] + 1
        )

        # Tầng 3B: Điều khiển Định dạng theo yêu cầu người dùng (Format Control) & Giàn giáo BKT (Adaptive Scaffolding)
        final_answer = composed["answer"]
        fc_text = unit_record.get("grounding_source", {}).get("fact_chunk", "")
        topic_str = unit_record.get("topic", best_uid)
        ent_str = unit_record.get("entity", "Nhà Trần")
        evt_str = unit_record.get("event", "Ba lần kháng chiến chống Mông - Nguyên")

        wants_summary = any(k in unacc_raw for k in ["tom tat", "ngan gon", "3 y chinh", "gach dau dong", "de thuoc", "chep bai"])
        wants_timeline = any(k in unacc_raw for k in ["dong thoi gian", "so do thoi gian", "timeline", "cac moc thoi gian"])
        wants_mnemonic = any(k in unacc_raw for k in ["meo nho", "meo ghi nho", "cach nho nhanh", "cong thuc nho"])

        if wants_summary and fc_text:
            final_answer += (
                f"\n\n---\n📌 **Tóm tắt 3 ý cốt lõi dễ thuộc (Dành cho ôn thi)**:\n"
                f"• **Sự kiện / Chủ đề**: {topic_str} ({evt_str})\n"
                f"• **Nhân vật trung tâm**: {ent_str}\n"
                f"• **Trọng tâm ghi nhớ**: {fc_text}"
            )
        if wants_timeline:
            final_answer += (
                f"\n\n---\n⏳ **Sơ đồ Dòng thời gian (Timeline Lịch sử)**:\n"
                f"`[1258: Bình Lệ Nguyên ➔ Vườn không nhà trống ➔ Đông Bộ Đầu]` ➔ "
                f"`[1282–1285: Bình Than ➔ Diên Hồng ➔ Hàm Tử, Chương Dương]` ➔ "
                f"`[1287–1288: Vân Đồn ➔ Đại thắng Bạch Đằng (4/1288)]`\n"
                f"• **Vị trí sự kiện đang xét**: **{evt_str}** — {fc_text}"
            )
        if wants_mnemonic and fc_text:
            final_answer += (
                f"\n\n---\n🔑 **Mẹo ghi nhớ nhanh (Công thức 3 Từ Khóa Ăn Điểm)**:\n"
                f"`[{ent_str}]` + `[{evt_str}]` ➔ **Từ khóa cốt lõi**: *{fc_text}*"
            )
        composed["answer"] = final_answer

        # Trích xuất nguồn sử liệu
        sources = []
        src_data = unit_record.get("grounding_source", {})
        if src_data and src_data.get("fact_chunk"):
            sources.append({
                "doc_name": src_data.get("doc_name", "SGK Lịch sử 7 (KNTT) & Đại Việt Sử Ký Toàn Thư"),
                "page_number": src_data.get("page_number"),
                "curriculum_match": src_data.get("curriculum_match", "SGK Lịch sử 7 - Bài 13"),
                "fact_chunk": src_data.get("fact_chunk", "")
            })

        game_meta = unit_record.get("game_metadata", {})
        self.context_manager.update_session(session_id, query, unit_record, composed["answer"], meta)
        self.session_memory = self.context_manager.sessions

        import logging
        ans_excerpt = (composed["answer"][:100] + "...") if len(composed["answer"]) > 100 else composed["answer"]
        logging.info(
            f"\n[RETRIEVAL & NLG TRACE]\n"
            f"  • Original Query    : '{query}'\n"
            f"  • Rewritten Query   : '{rewritten_q}'\n"
            f"  • Classified Intent : {meta.get('q_type', 'UNKNOWN')}\n"
            f"  • Top-3 Retrieved   : {meta.get('top_3_retrieved', [])}\n"
            f"  • Selected Unit     : {best_uid} (Confidence: {confidence:.4f})\n"
            f"  • Gate / Rationale  : {meta.get('selection_rationale', 'Default')}\n"
            f"  • Final Answer Excerpt: {ans_excerpt}\n"
        )

        return {
            "unit_id": best_uid,
            "topic": unit_record.get("topic", best_uid),
            "confidence": round(confidence, 4),
            "answer": composed["answer"],
            "character_name": composed["character_name"],
            "grounding_sources": sources,
            "badge_unlocked": game_meta.get("unlocked_badge"),
            "exp_reward": game_meta.get("exp_reward", 25 if sources else 0),
            "is_not_found": False
        }

    def search_dvsktt_passages(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Tìm kiếm toàn văn (Full-Text Passage Retrieval) trực tiếp trên 1.083 đoạn biên niên sử
        của toàn bộ 419 trang Kỷ Nhà Trần (trang 478 - 896) trong `dvsktt_tran_dynasty_corpus.json`.
        """
        corpus_file = DATA_DIR / "dvsktt_tran_dynasty_corpus.json"
        if not corpus_file.exists():
            return []
        try:
            if not hasattr(self, "_dvsktt_passages_cache") or not self._dvsktt_passages_cache:
                corpus_data = json.loads(corpus_file.read_text(encoding="utf-8"))
                self._dvsktt_passages_cache = corpus_data.get("tran_dynasty_passages", [])

            q_norm = normalize_vi(query)
            q_unacc = normalize_vi(remove_accents(query))
            q_tokens = [t for t in q_unacc.split() if len(t) >= 2]
            if not q_tokens:
                return []

            scored: List[Tuple[float, Dict[str, Any]]] = []
            for p in self._dvsktt_passages_cache:
                txt = p.get("text", "")
                txt_norm = normalize_vi(txt)
                txt_unacc = normalize_vi(remove_accents(txt))
                score = 0.0
                for tok in q_tokens:
                    if tok in txt_unacc:
                        score += 1.0
                # Thưởng điểm cụm 2-gram và khớp có dấu
                for i in range(len(q_tokens) - 1):
                    bg = f"{q_tokens[i]} {q_tokens[i + 1]}"
                    if bg in txt_unacc:
                        score += 2.5
                for w in q_norm.split():
                    if len(w) >= 3 and w in txt_norm:
                        score += 0.8
                if score > 0:
                    scored.append((score, p))

            scored.sort(key=lambda x: x[0], reverse=True)
            return [
                {
                    "passage_id": item["passage_id"],
                    "pdf_page": item["pdf_page"],
                    "quyen": item["quyen"],
                    "folios": item["folios"],
                    "score": round(sc, 2),
                    "text": item["text"]
                }
                for sc, item in scored[:top_k]
            ]
        except Exception:
            return []


def train_and_save_model() -> DongANLPModel:
    """
    Hàm khởi tạo, huấn luyện model trên tập Train (80%) và lưu ra đĩa.
    Nếu chưa có file Train 80%, tự động gọi data_splitter để tạo.
    """
    if not TRAIN_FILE.exists():
        from data_splitter import generate_and_split_dataset
        generate_and_split_dataset(test_size=0.2, random_state=42)

    train_records = []
    with open(TRAIN_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                train_records.append(json.loads(line))

    # Đảm bảo class luôn gắn với module 'create_model' (không bị dính '__main__' khi chạy trực tiếp)
    import create_model as cm_module
    model = cm_module.DongANLPModel()
    model.fit(train_records)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    return model


if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    trained_model = train_and_save_model()
    print("=" * 65)
    print("[CREATE MODEL] ĐÃ HUẤN LUYỆN & LƯU MODEL NGÔN NGỮ TỰ NHIÊN THÀNH CÔNG")
    print("=" * 65)
    print(f"• Số mẫu huấn luyện (80% Train) : {len(trained_model.train_records)} mẫu")
    print(f"• Số chủ điểm tri thức (Classes): {len(trained_model.unit_lookup)} nhãn chuyên sâu")
    print(f"• Kích thước Ma trận Ngữ nghĩa  : {trained_model.semantic_matrix.shape}")
    print(f"• Đường dẫn lưu Model Artifact  : {MODEL_PATH}")
    print("=" * 65)
