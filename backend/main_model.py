"""
FILE 4: ĐIỂM CHẠY CHÍNH & SUY LUẬN MODEL NGÔN NGỮ TỰ NHIÊN (MAIN NLP ENGINE)
================================================================================
Chức năng độc lập (1 File Main riêng biệt theo đúng kiến trúc chuẩn):
1. Quản lý vòng đời nạp Model đã huấn luyện (`backend/models/dong_a_nlp_model.joblib`).
2. Nếu chưa có dữ liệu chia 8-2 hoặc chưa có file model `.joblib`, tự động kích hoạt
   `data_splitter.py` và `create_model.py` theo đúng luồng chuẩn.
3. Cung cấp hàm giao diện chuẩn `ask_dong_a_ai()` cho cả FastAPI Server lẫn giao diện
   dòng lệnh (CLI Interactive Mode).
"""

import sys
from pathlib import Path
from typing import Dict, Any, Optional
import joblib

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from data_splitter import TRAIN_FILE, TEST_FILE, generate_and_split_dataset
import create_model
from create_model import MODEL_PATH, DongANLPModel, train_and_save_model


class MainNLPEngine:
    """
    Singleton quản lý Model Ngôn ngữ Tự nhiên tại thời điểm chạy (Runtime Inference).
    """
    _instance: Optional[DongANLPModel] = None

    @classmethod
    def get_model(cls) -> DongANLPModel:
        if cls._instance is None:
            # 1. Đảm bảo dữ liệu đã được chia chuẩn 8-2 (Train 80% / Test 20%)
            if not TRAIN_FILE.exists() or not TEST_FILE.exists():
                generate_and_split_dataset(test_size=0.2, random_state=42)

            # 2. Nạp model đã train hoặc huấn luyện mới nếu chưa tồn tại
            if MODEL_PATH.exists():
                try:
                    cls._instance = joblib.load(MODEL_PATH)
                except Exception:
                    cls._instance = train_and_save_model()
            else:
                cls._instance = train_and_save_model()
        return cls._instance

    @classmethod
    def ask(
        cls,
        query: str,
        character_id: Optional[str] = None,
        session_id: str = "default"
    ) -> Dict[str, Any]:
        model = cls.get_model()
        return model.generate_natural_response(
            query=query,
            character_id=character_id,
            session_id=session_id
        )


def ask_dong_a_ai(
    query: str,
    character_id: Optional[str] = None,
    session_id: str = "default"
) -> Dict[str, Any]:
    """Hàm tiện ích gọi trực tiếp từ API hoặc từ chương trình chính."""
    return MainNLPEngine.ask(query=query, character_id=character_id, session_id=session_id)


if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    print("=" * 70)
    print("[MAIN NLP ENGINE] KHỞI ĐỘNG HỆ THỐNG AI SỬ HỌC ĐÔNG A (CHUẨN MODULAR)")
    print("=" * 70)
    model_instance = MainNLPEngine.get_model()
    print(f"• Trạng thái Model : Sẵn sàng ({len(model_instance.unit_lookup)} chủ điểm chuyên sâu)")
    print(f"• Tập Train (80%)  : {len(model_instance.train_records)} mẫu đã huấn luyện")
    print("=" * 70)

    # Chạy kiểm tra nhanh 3 câu hỏi mẫu
    sample_queries = [
        "vì sao trần quốc toản lại bóp nát quả cam",
        "tại sao thoát hoan phải chui vào ống đồng",
        "576"
    ]
    for sq in sample_queries:
        out = ask_dong_a_ai(sq, session_id="main_check")
        print(f"\n[Hỏi]: {sq}")
        print(f"[Đáp - {out['unit_id']}]:\n{out['answer']}")
        print("-" * 70)
