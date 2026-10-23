"""
FILE 3: KIỂM THỬ & ĐÁNH GIÁ MODEL TRÊN TẬP TEST 20% (EVALUATE & TEST NLP MODEL)
================================================================================
Chức năng độc lập (1 File riêng biệt theo đúng kiến trúc chuẩn):
1. Nạp model đã huấn luyện từ `ai/models/dong_a_nlp_model.joblib`.
2. Đọc dữ liệu kiểm thử độc lập từ tập Test 20% (`ai/data/test_data.jsonl`).
3. Tính toán các chỉ số đánh giá chuẩn Machine Learning:
   - Accuracy (Độ chính xác trên tập Test 20%)
   - Macro & Weighted Precision, Recall, F1-Score
4. Kiểm thử thực tế khả năng phản hồi Ngôn ngữ Tự nhiên (không máy móc) và
   trí nhớ hội thoại đa lượt (Multi-turn Coreference Resolution).
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Any
import joblib
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"

TRAIN_FILE = DATA_DIR / "train_data.jsonl"
TEST_FILE = DATA_DIR / "test_data.jsonl"
MODEL_PATH = MODEL_DIR / "dong_a_nlp_model.joblib"

# Đảm bảo import được class DongANLPModel từ create_model.py khi load joblib
import create_model
from create_model import DongANLPModel, train_and_save_model


def evaluate_on_test_split() -> Dict[str, Any]:
    """
    Đánh giá định lượng model trên 20% tập Test (`test_data.jsonl`).
    """
    if not MODEL_PATH.exists():
        model = train_and_save_model()
    else:
        model: DongANLPModel = joblib.load(MODEL_PATH)

    with open(TRAIN_FILE, "r", encoding="utf-8") as f:
        train_data = [json.loads(line) for line in f if line.strip()]

    with open(TEST_FILE, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f if line.strip()]

    y_true = []
    y_pred = []
    confidences = []
    errors = []

    for idx, item in enumerate(test_data):
        query = item["user_query"]
        true_uid = item["unit_id"]
        pred_uid, conf, _ = model.predict_unit(query, session_id=f"eval_{idx}")

        y_true.append(true_uid)
        y_pred.append(pred_uid)
        confidences.append(conf)

        if pred_uid != true_uid:
            errors.append({
                "query": query,
                "expected": true_uid,
                "predicted": pred_uid,
                "confidence": round(conf, 4)
            })

    acc = accuracy_score(y_true, y_pred)
    prec, rec, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted", zero_division=0)

    total = len(train_data) + len(test_data)
    return {
        "total_samples": total,
        "train_samples": len(train_data),
        "test_samples": len(test_data),
        "train_pct": round(len(train_data) / total * 100, 1),
        "test_pct": round(len(test_data) / total * 100, 1),
        "accuracy": round(acc * 100, 2),
        "precision": round(prec * 100, 2),
        "recall": round(rec * 100, 2),
        "f1_score": round(f1 * 100, 2),
        "avg_confidence": round(sum(confidences) / len(confidences), 4) if confidences else 0.0,
        "errors": errors,
        "model": model
    }


def run_natural_conversation_demo(model: DongANLPModel):
    """
    Kiểm thử các tình huống hội thoại tự nhiên (Hỏi Tại sao, Hỏi nối tiếp dùng đại từ,
    Hỏi nhân vật ngoài triều đại, Nhập số vô nghĩa) để chứng minh AI trả lời tự nhiên.
    """
    scenarios = [
        ("Lượt 1 - Mở đầu tìm hiểu nhân vật", "bạn biết trần quốc toản không", "demo_session_1"),
        ("Lượt 2 - Hỏi lý do cụ thể (Tại sao)", "vì sao trần quốc toản lại bóp nát quả cam", "demo_session_1"),
        ("Lượt 3 - Hỏi chi tiết lá cờ", "lá cờ của trần quốc toản thêu sáu chữ vàng gì", "demo_session_1"),
        ("Câu hỏi tự nhiên không dấu (Tại sao)", "vi sao thoat hoan phai chui vao ong dong", "demo_session_2"),
        ("Câu hỏi chiến dịch tự nhiên", "tôi cần biết về trận chiến chống nguyên mông lần 1", "demo_session_3"),
        ("Phân biệt nhân vật triều đại khác", "bạn biết vua hàm nghi không", "demo_session_4"),
        ("Input ngoài phạm vi / số vô nghĩa", "576", "demo_session_5"),
    ]

    print("\n" + "=" * 75)
    print("[DEMO HỘI THOẠI TỰ NHIÊN] KIỂM TRA ĐỘ MƯỢT MÀ & BÁM SÁT NGỮ CẢNH")
    print("=" * 75)

    for title, q, sess_id in scenarios:
        res = model.generate_natural_response(query=q, session_id=sess_id)
        print(f"\n▶ [{title}]")
        print(f"  👤 Học sinh : \"{q}\"")
        print(f"  🎯 Unit khớp: {res['unit_id']} (Confidence: {res['confidence']})")
        print(f"  🤖 AI Đông A:\n{res['answer']}")
        print("-" * 75)


if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    report = evaluate_on_test_split()
    print("=" * 75)
    print("[TEST MODEL] KẾT QUẢ ĐÁNH GIÁ MODEL TRÊN TẬP TEST 20% (CHUẨN 8-2)")
    print("=" * 75)
    print(f"• Tỷ lệ chia dữ liệu (8-2) : Train = {report['train_samples']} mẫu ({report['train_pct']}%) | Test = {report['test_samples']} mẫu ({report['test_pct']}%)")
    print(f"• Accuracy  (Độ chính xác) : {report['accuracy']}%")
    print(f"• Precision (Độ chuẩn xác) : {report['precision']}%")
    print(f"• Recall    (Độ bao phủ)   : {report['recall']}%")
    print(f"• F1-Score  (Điểm cân bằng): {report['f1_score']}%")
    print(f"• Số lỗi trên tập Test 20% : {len(report['errors'])} / {report['test_samples']} mẫu")
    print("=" * 75)

    run_natural_conversation_demo(report["model"])
