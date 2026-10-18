import sys
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import joblib
from create_model import MODEL_PATH, DongANLPModel

model: DongANLPModel = joblib.load(MODEL_PATH)

print("=" * 80)
print("VERIFICATION OF THE 4 REPORTED CRITICAL FAILURES")
print("=" * 80)

# 1. Failure 1
q1 = "Tại sao quân Nguyên đông và mạnh mà vẫn thua Đại Việt?"
r1 = model.generate_natural_response(q1, session_id="v_1")
print(f"\n[1] '{q1}'")
print(f"  • Predicted Unit: {r1['unit_id']} (Expected: CAUSES_OF_VICTORY)")
print(f"  • Confidence    : {r1['confidence']}")
print(f"  • Excerpt       :\n{r1['answer'][:250]}...\n")

# 2. Failure 2
q2 = "Vì sao quân Trần chủ động rút khỏi Thăng Long?"
r2 = model.generate_natural_response(q2, session_id="v_2")
print(f"\n[2] '{q2}'")
print(f"  • Predicted Unit: {r2['unit_id']} (Expected: KC1_VUON_KHONG_NHA_TRONG)")
print(f"  • Confidence    : {r2['confidence']}")
print(f"  • Excerpt       :\n{r2['answer'][:250]}...\n")

# 3. Failure 3
q3 = "Vì sao chiến thuật rút lui không đồng nghĩa với thất bại?"
r3 = model.generate_natural_response(q3, session_id="v_3")
print(f"\n[3] '{q3}'")
print(f"  • Predicted Unit: {r3['unit_id']} (Expected: NOT OOD, KC1_VUON_KHONG_NHA_TRONG)")
print(f"  • Confidence    : {r3['confidence']}")
print(f"  • Excerpt       :\n{r3['answer'][:250]}...\n")

# 4. Failure 4
sess_4 = "v_4"
_ = model.generate_natural_response("Kế sách Vườn không nhà trống là gì?", session_id=sess_4)
q4 = "Vậy sau khi rút khỏi Thăng Long thì quân ta làm gì?"
r4 = model.generate_natural_response(q4, session_id=sess_4)
print(f"\n[4] Follow-up after VKNT: '{q4}'")
print(f"  • Predicted Unit: {r4['unit_id']} (Expected: KC1_VUON_KHONG_NHA_TRONG / KC1_DONG_BO_DAU)")
print(f"  • Confidence    : {r4['confidence']}")
print(f"  • Excerpt       :\n{r4['answer'][:250]}...\n")

# 5. Issue 5 - Source Faithfulness check
q5 = "Trận Bạch Đằng năm 1288 đã diễn ra như thế nào?"
r5 = model.generate_natural_response(q5, session_id="v_5")
print(f"\n[5] Grounding Check: '{q5}'")
print(f"  • Contains 'lim': {'lim' in r5['answer'].lower()}")
print(f"  • Contains 'cọc gỗ': {'cọc gỗ' in r5['answer'].lower()}")
print(f"  • Excerpt       :\n{r5['answer'][:250]}...\n")

print("=" * 80)
