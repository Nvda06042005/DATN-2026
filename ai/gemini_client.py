import json
import httpx
from typing import List, Dict, Any, Optional
from huggingface_hub import InferenceClient
from app.config import settings
from app.models.schemas import GeneratedQuestion

HISTORICAL_PERSONAS: Dict[str, Dict[str, Any]] = {
    "TRAN_HUNG_DAO": {
        "name": "Quốc Công Tiết Chế Hưng Đạo Đại Vương Trần Quốc Tuấn",
        "voice_prefix": "Tiểu hữu hãy nghe cho rõ lời ta:\n\n",
        "system_instruction": (
            "Ngươi là Quốc công Tiết chế Hưng Đạo Đại vương Trần Quốc Tuấn, tổng chỉ huy quân đội Đại Việt trong hai cuộc kháng chiến chống Nguyên Mông (1285, 1288). "
            "Giọng văn hùng tráng, uy nghiêm, giàu nghĩa khí non sông, xưng 'Ta', gọi 'Tiểu hữu' hoặc 'Hậu thế'. "
            "Nhắc đến Hịch Tướng Sĩ, tinh thần Sát Thát, câu nói 'Nếu bệ hạ muốn hàng xin chém đầu tôi trước', và trận địa cọc ngầm Bạch Đằng. "
            "Chỉ trả lời chuẩn xác dựa trên sử liệu thời Trần."
        )
    },
    "TRAN_QUOC_TOAN": {
        "name": "Hoài Văn Hầu Trần Quốc Toản",
        "voice_prefix": "Ta chia sẻ cùng bạn đồng môn điều này:\n\n",
        "system_instruction": (
            "Ngươi là Hoài Văn hầu Trần Quốc Toản tuổi thiếu niên anh dũng (1282 - 1285). "
            "Giọng văn nhiệt huyết sôi sục, xưng 'Ta', gọi 'Bạn đồng môn' hoặc 'Tiểu hữu'. "
            "Kể về sự kiện bóp nát quả cam tại bến Bình Than vì tuổi nhỏ không được dự họp, sau đó về lập đội quân 1.000 gia nô thêu cờ 'Phá cường địch, báo hoàng ân' xông pha trận mạc. "
            "Chỉ nói các sự kiện thời Trần chuẩn xác."
        )
    },
    "TRAN_THU_DO": {
        "name": "Thái Sư Trần Thủ Độ",
        "voice_prefix": "Lão phu bảo cho tiểu hữu biết:\n\n",
        "system_instruction": (
            "Ngươi là Thái sư Trần Thủ Độ (1258). "
            "Giọng văn quyết đoán, đanh thép, bản lĩnh ngút trời, xưng 'Lão phu' hoặc 'Ta', gọi 'Tiểu hữu'. "
            "Khẳng định dũng khí giữ nước: 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!', kế sách Vườn không nhà trống và chiến thắng Đông Bộ Đầu. "
            "Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "TRAN_BINH_TRONG": {
        "name": "Bảo Nghĩa Vương Trần Bình Trọng",
        "voice_prefix": "Ta nói cho hậu thế hay:\n\n",
        "system_instruction": (
            "Ngươi là Bảo Nghĩa vương Trần Bình Trọng hiên ngang trước quân thù tại bãi Tự Nhiên năm 1285. "
            "Khí phách kiên trung bất khuất, xưng 'Ta', gọi 'Tiểu hữu' hoặc 'Hậu thế'. "
            "Khắc sâu lời tuyên thệ bất tử: 'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!'. "
            "Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "TRAN_THANH_TONG": {
        "name": "Thượng Hoàng Trần Thánh Tông",
        "voice_prefix": "Trẫm giải thích cho tiểu hữu thấu hiểu:\n\n",
        "system_instruction": (
            "Ngươi là Thượng hoàng Trần Thánh Tông tại điện Diên Hồng năm 1285. "
            "Khí độ đế vương nhân từ, lấy dân làm gốc, xưng 'Trẫm', gọi 'Tiểu hữu' hoặc 'Thần dân'. "
            "Kể về câu hỏi 'Nên đánh hay nên hòa?' và tiếng hô vang rung chuyển trời đất 'ĐÁNH!' của các bô lão, biểu tượng đại đoàn kết toàn dân. "
            "Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "TRAN_THAI_TONG": {
        "name": "Vua Trần Thái Tông",
        "voice_prefix": "Trẫm kể cho tiểu hữu tường tận:\n\n",
        "system_instruction": (
            "Ngươi là Vua Trần Thái Tông, vị hoàng đế mở đầu triều Trần trực tiếp chỉ huy cuộc kháng chiến chống Mông Cổ lần thứ nhất năm 1258. "
            "Giọng văn điềm tĩnh, quyết đoán, xưng 'Trẫm', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "TRAN_NHAN_TONG": {
        "name": "Phật Hoàng Trần Nhân Tông",
        "voice_prefix": "Trẫm chia sẻ cùng hậu thế:\n\n",
        "system_instruction": (
            "Ngươi là Vua Trần Nhân Tông (Phật hoàng Trúc Lâm), vị vua lãnh đạo hai cuộc kháng chiến chống Nguyên năm 1285 và 1287-1288. "
            "Giọng văn minh triết, nhân từ, hào sảng, xưng 'Trẫm', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "TRAN_QUANG_KHAI": {
        "name": "Thượng Tướng Thái Sư Trần Quang Khải",
        "voice_prefix": "Ta kể cho tiểu hữu nghe:\n\n",
        "system_instruction": (
            "Ngươi là Thượng tướng Thái sư Trần Quang Khải, danh tướng chỉ huy trận Chương Dương Độ năm 1285 và tác giả bài thơ Tụng giá hoàn kinh. "
            "Giọng văn hào sảng, văn võ song toàn, xưng 'Ta', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "TRAN_NHAT_DUAT": {
        "name": "Chiêu Văn Vương Trần Nhật Duật",
        "voice_prefix": "Ta giải thích cùng tiểu hữu:\n\n",
        "system_instruction": (
            "Ngươi là Chiêu Văn vương Trần Nhật Duật, danh tướng thông hiểu nhiều ngôn ngữ, chỉ huy đại thắng Hàm Tử Quan năm 1285. "
            "Giọng văn uyên bác, khoan hòa, xưng 'Ta', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "TRAN_KHANH_DU": {
        "name": "Nhân Huệ Vương Trần Khánh Dư",
        "voice_prefix": "Ta nói cho tiểu hữu hay:\n\n",
        "system_instruction": (
            "Ngươi là Nhân Huệ vương Trần Khánh Dư, người lập chiến công đánh đắm đoàn thuyền lương của Trương Văn Hổ tại Vân Đồn năm 1288. "
            "Giọng văn từng trải, mưu lược, xưng 'Ta', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "LE_PHU_TRAN": {
        "name": "Chiêu Minh Vương Lê Phụ Trần",
        "voice_prefix": "Ta kể lại cho hậu thế:\n\n",
        "system_instruction": (
            "Ngươi là danh tướng Lê Phụ Trần (Lê Tần), người lấy ván thuyền che tên cho vua Trần Thái Tông tại Bình Lệ Nguyên năm 1258. "
            "Giọng văn quả cảm, mưu trí, xưng 'Ta', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "PHAM_NGU_LAO": {
        "name": "Điện Súy Phạm Ngũ Lão",
        "voice_prefix": "Ta chia sẻ cùng tiểu hữu:\n\n",
        "system_instruction": (
            "Ngươi là danh tướng Phạm Ngũ Lão, học trò xuất sắc của Trần Hưng Đạo, tác giả bài thơ Thuật hoài (Tỏ lòng). "
            "Giọng văn khẳng khái, hào khí ngút trời, xưng 'Ta', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "YET_KIEU": {
        "name": "Danh Tướng Thủy Chiến Yết Kiêu",
        "voice_prefix": "Ta kể cho tiểu hữu nghe:\n\n",
        "system_instruction": (
            "Ngươi là Yết Kiêu, gia tướng trung thành của Trần Hưng Đạo, bậc thầy bơi lặn đục thuyền giặc. "
            "Giọng văn mộc mạc, trung nghĩa, xưng 'Ta', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "THANH_DUC": {
        "name": "Cấm Quân Thánh Dực",
        "voice_prefix": "Cấm quân chúng ta xin kể lại cho hậu thế:\n\n",
        "system_instruction": (
            "Ngươi là chiến sĩ Cấm quân Thánh Dực thời Trần, hộ giá nhà vua và bảo vệ kinh thành Thăng Long. "
            "Giọng văn trung dũng, nghiêm cẩn, xưng 'Ta', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    },
    "QUAN_SAT_THAT": {
        "name": "Dũng Sĩ Sát Thát",
        "voice_prefix": "Hai chữ Sát Thát khắc sâu trên cánh tay, ta kể cho tiểu hữu nghe:\n\n",
        "system_instruction": (
            "Ngươi là người lính nhà Trần khắc hai chữ Sát Thát lên cánh tay. "
            "Giọng văn nhiệt huyết, bất khuất, xưng 'Ta', gọi 'Tiểu hữu'. Chỉ nói chuẩn sử liệu thời Trần."
        )
    }
}

class GeminiClient:
    def __init__(self):
        # 1. Cấu hình Google Gemini
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

        # 2. Cấu hình Hugging Face (Qwen2.5-7B-Instruct / BGE-M3)
        self.hf_token = getattr(settings, "HF_TOKEN", "")
        self.hf_model = getattr(settings, "HF_MODEL", "Qwen/Qwen2.5-7B-Instruct")
        self.hf_client = None
        if self.hf_token:
            try:
                self.hf_client = InferenceClient(model=self.hf_model, token=self.hf_token)
                print(f"[OK] Hugging Face InferenceClient initialized with model: {self.hf_model}")
            except Exception as e:
                print(f"[WARN] Error initializing Hugging Face client: {e}")

    async def _call_hf_api(self, prompt: str, system_instruction: Optional[str] = None) -> Optional[str]:
        """
        Gọi Serverless Inference API của Hugging Face cho Qwen2.5-7B-Instruct
        """
        if not self.hf_client:
            return None
        try:
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": prompt})

            res = self.hf_client.chat_completion(
                messages=messages,
                max_tokens=1024,
                temperature=0.3
            )
            if res and res.choices and len(res.choices) > 0:
                content = res.choices[0].message.content
                if content:
                    return content.strip()
        except Exception as e:
            print(f"[WARN] Hugging Face Inference API error: {e}")
        return None

    async def _call_gemini_api(self, prompt: str, system_instruction: Optional[str] = None) -> Optional[str]:
        """
        Gọi trực tiếp Gemini REST API qua httpx không cần cài đặt thêm thư viện nặng
        """
        if not self.api_key:
            return None

        url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"
        contents = [{"parts": [{"text": prompt}]}]
        body: Dict[str, Any] = {"contents": contents}

        if system_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=body)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
                else:
                    print(f"[WARN] Gemini API returned status {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[ERROR] Error calling Gemini API: {e}")

        return None

    # ==========================================================================
    # 1. GENERATE CHAT FOR STUDENT (STUDENT AI TUTOR)
    # ==========================================================================
    async def generate_chat(
        self, query: str, grounding_records: List[Dict[str, Any]], character_id: Optional[str] = None
    ) -> Dict[str, Any]:
        norm_cid = character_id.strip().upper() if character_id else None
        persona = HISTORICAL_PERSONAS.get(norm_cid) if norm_cid else None
        char_name = persona["name"] if persona else "Trợ Lý AI Lịch Sử Đông A"

        # Trường hợp không tìm thấy dữ liệu liên quan trong kho sử liệu (VD: người dùng gõ số 576 hoặc từ khoá ngoài phạm vi)
        if not grounding_records:
            clean_q = query.strip()
            not_found_speaker = "ta" if persona else "thầy"
            return {
                "answer": (
                    f"⚠️ Rất tiếc, {not_found_speaker} không tìm thấy dữ liệu lịch sử phù hợp với câu hỏi \"{clean_q}\" "
                    "trong kho tư liệu bài học **'Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)'** (Lịch sử 7).\n\n"
                    "👉 Em hãy thử đặt câu hỏi cụ thể hơn về các nhân vật hoặc sự kiện, ví dụ:\n"
                    "- 🍊 *'Bạn biết Trần Quốc Toản không?'*\n"
                    "- ✊ *'Hội nghị Diên Hồng năm 1285 có ý nghĩa gì?'*\n"
                    "- 🌾 *'Kế sách Vườn không nhà trống trong kháng chiến năm 1258?'*\n"
                    "- 🌊 *'Trận Bạch Đằng năm 1288 đã diễn ra như thế nào?'*"
                ),
                "character_name": char_name,
                "is_not_found": True
            }

        best_record = grounding_records[0]

        # 1. Ưu tiên câu trả lời sư phạm chuẩn hóa (Ý định học sinh, Phân biệt triều đại, Chủ đề trực tiếp chuẩn SGK)
        if best_record.get("tutor_answer"):
            ans = best_record["tutor_answer"]
            if persona and best_record.get("type") not in ["INTENT_RESPONSE", "CROSS_ERA_RESPONSE"]:
                ans = f"{persona['voice_prefix']}{ans}"
            return {
                "answer": ans,
                "character_name": char_name
            }

        system_prompt = persona["system_instruction"] if persona else (
            "Bạn là Trợ lý AI Sử học Đông A, một gia sư lịch sử thông thái, ân cần dành cho học sinh lớp 7. "
            "Bạn giải thích bài học Ba lần kháng chiến chống Mông - Nguyên (1258 - 1288) chuẩn xác theo SGK Lịch sử 7 và Đại Việt Sử Ký Toàn Thư. "
            "Quy tắc tuyệt đối:\n"
            "1. Chỉ trả lời dựa trên các tư liệu lịch sử được cung cấp dưới đây.\n"
            "2. Trả lời trực diện, đúng trọng tâm câu hỏi của học sinh, giọng điệu sư phạm, dễ hiểu, giàu cảm hứng yêu nước.\n"
            "3. Không bịa đặt sự kiện, nhân vật, năm tháng."
        )

        context_text = "\n\n".join([
            f"- Căn cứ sử liệu: {r.get('grounding_source', {}).get('fact_chunk', '')}"
            for r in grounding_records if r.get('grounding_source')
        ])

        user_prompt = f"Tư liệu lịch sử tham khảo:\n{context_text}\n\nCâu hỏi của học sinh: {query}\n\nHãy trả lời học sinh một cách rõ ràng, trực diện và đầy đủ dẫn chứng:"

        # 2. Thử gọi Hugging Face Qwen/Qwen2.5-7B-Instruct nếu có token
        if self.hf_client:
            hf_res = await self._call_hf_api(user_prompt, system_instruction=system_prompt)
            if hf_res:
                return {
                    "answer": hf_res,
                    "character_name": f"{char_name} (Qwen2.5-7B)"
                }

        # 3. Thử gọi Gemini Flash API nếu có key
        if self.api_key:
            api_response = await self._call_gemini_api(user_prompt, system_instruction=system_prompt)
            if api_response:
                return {
                    "answer": api_response,
                    "character_name": f"{char_name} (Gemini Flash)"
                }

        # 4. Local Grounded Engine Fallback

        # Nếu bản ghi là cặp Hỏi-Đáp chuẩn trong bộ Deduplicated QA
        if best_record.get("type") == "QA_PAIR" and best_record.get("answer"):
            return {
                "answer": f"Căn cứ theo tư liệu SGK Lịch sử 7 chuẩn GDPT 2018:\n\n{best_record['answer']}",
                "character_name": char_name
            }

        # Nếu bản ghi có fact_chunk sử liệu
        fact = best_record.get("grounding_source", {}).get("fact_chunk", "")
        if fact:
            return {
                "answer": (
                    f"Chào em! Dựa trên tư liệu Lịch sử 7 chuẩn GDPT 2018 và Đại Việt Sử Ký Toàn Thư:\n\n"
                    f"{fact}\n\n"
                    f"Đây là một trong những sự kiện lịch sử tiêu biểu thể hiện tinh thần quật cường và mưu trí của quân dân nhà Trần!"
                ),
                "character_name": "Trợ Lý AI Lịch Sử Đông A"
            }

        return {
            "answer": "Chào em! Thầy đã ghi nhận câu hỏi. Em hãy đặt câu hỏi cụ thể hơn về nhân vật hoặc sự kiện thời Trần để thầy giải đáp chi tiết nhé!",
            "character_name": "Trợ Lý AI Lịch Sử Đông A"
        }

    # ==========================================================================
    # 2. GENERATE QUIZ FOR TEACHER STUDIO (THEO NHÓM CHỦ ĐỀ & MA TRẬN BLOOM)
    # ==========================================================================
    async def generate_quiz(
        self,
        topic: Optional[str] = None,
        num_questions: int = 4,
        cognitive_level: str = "Phân bổ ma trận",
        grounding_records: Optional[List[Dict[str, Any]]] = None,
        topic_group_id: Optional[str] = None,
        unit_ids: Optional[List[str]] = None
    ) -> List[GeneratedQuestion]:
        from rag_engine import CURRICULUM_TOPIC_GROUPS

        # 1. Xác định nhóm chủ đề khảo thí
        effective_gid = (topic_group_id or "").strip().upper()
        if not effective_gid or effective_gid not in CURRICULUM_TOPIC_GROUPS:
            lower_t = (topic or "").lower()
            if "1258" in lower_t or "bình lệ nguyên" in lower_t or "đông bộ đầu" in lower_t:
                effective_gid = "KHANG_CHIEN_1"
            elif "1285" in lower_t or "bình than" in lower_t or "diên hồng" in lower_t or "thoát hoan" in lower_t:
                effective_gid = "KHANG_CHIEN_2"
            elif "1287" in lower_t or "1288" in lower_t or "bạch đằng" in lower_t or "vân đồn" in lower_t:
                effective_gid = "KHANG_CHIEN_3"
            elif "nhân vật" in lower_t or "quân sự" in lower_t or "ngụ binh" in lower_t or "bài học" in lower_t:
                effective_gid = "NHAN_VAT_QUAN_SU"
            else:
                effective_gid = "KHANG_CHIEN_2"

        grp_info = CURRICULUM_TOPIC_GROUPS.get(effective_gid, CURRICULUM_TOPIC_GROUPS["KHANG_CHIEN_2"])
        group_name = grp_info["title"]
        display_topic = topic or group_name

        # 2. Phân bổ ma trận mức độ nhận thức (Bloom GDPT 2018)
        is_matrix = cognitive_level in ["Phân bổ ma trận", "Tất cả mức độ", "Tự động", "Ma trận Bloom"]
        levels_cycle = ["Nhận biết", "Thông hiểu", "Vận dụng", "Thông hiểu", "Nhận biết"]
        target_levels: List[str] = []
        for i in range(num_questions):
            if is_matrix:
                target_levels.append(levels_cycle[i % len(levels_cycle)])
            else:
                target_levels.append(cognitive_level)

        context_facts = "\n".join([
            f"- {r.get('grounding_source', {}).get('fact_chunk', '')}"
            for r in (grounding_records or []) if r.get('grounding_source') and r.get('grounding_source', {}).get('fact_chunk')
        ])

        system_instruction = (
            "Bạn là chuyên gia khảo thí Lịch sử 7. Hãy tạo các câu hỏi trắc nghiệm khách quan chuẩn GDPT 2018. "
            "Mỗi câu có đúng 4 phương án A, B, C, D, chỉ 1 đáp án đúng và có giải thích chi tiết."
        )

        prompt = (
            f"Nhóm chủ đề khảo thí: '{group_name}' ({grp_info['sgk_reference']})\n"
            f"Chủ đề chi tiết / từ khóa: '{display_topic}'\n"
            f"Căn cứ tư liệu lịch sử trích xuất:\n{context_facts if context_facts else grp_info['description']}\n\n"
            f"Hãy tạo đúng {num_questions} câu hỏi trắc nghiệm bám sát nhóm chủ đề này với các mức độ nhận thức tương ứng:\n"
            f"{target_levels}\n\n"
            "Đầu ra BẮT BUỘC là định dạng JSON mảng các object với cấu trúc:\n"
            "[\n"
            "  {\n"
            "    \"question\": \"Nội dung câu hỏi?\",\n"
            "    \"options\": [\"Đáp án A\", \"Đáp án B\", \"Đáp án C\", \"Đáp án D\"],\n"
            "    \"correct_index\": 0,\n"
            "    \"cognitive_level\": \"Nhận biết\",\n"
            "    \"explanation\": \"Giải thích vì sao đúng dựa trên sử liệu...\",\n"
            "    \"curriculum_reference\": \"SGK Lịch sử 7 Bài 15\"\n"
            "  }\n"
            "]\n"
            "Chỉ trả về JSON thuần túy, không thêm markdown ```json."
        )

        # 1. Ưu tiên gọi Hugging Face Qwen2.5
        api_response = None
        if self.hf_client:
            api_response = await self._call_hf_api(prompt, system_instruction=system_instruction)

        # 2. Nếu không có hoặc lỗi, thử gọi Gemini
        if not api_response and self.api_key:
            api_response = await self._call_gemini_api(prompt, system_instruction=system_instruction)

        if api_response:
            try:
                clean_text = api_response.strip()
                if clean_text.startswith("```json"):
                    clean_text = clean_text[7:]
                if clean_text.startswith("```"):
                    clean_text = clean_text[3:]
                if clean_text.endswith("```"):
                    clean_text = clean_text[:-3]

                raw_list = json.loads(clean_text.strip())
                questions = []
                for i, q in enumerate(raw_list):
                    questions.append(
                        GeneratedQuestion(
                            id=f"gen-llm-{i+1}",
                            question=q["question"],
                            options=q["options"],
                            correct_index=int(q["correct_index"]),
                            cognitive_level=q.get("cognitive_level", target_levels[i % len(target_levels)]),
                            explanation=q.get("explanation", f"Căn cứ theo tư liệu {group_name}."),
                            curriculum_reference=q.get("curriculum_reference", grp_info["sgk_reference"]),
                            topic_group_id=effective_gid,
                            topic_group_name=group_name,
                            unit_id=q.get("unit_id"),
                            topic=display_topic
                        )
                    )
                if len(questions) >= num_questions:
                    return questions[:num_questions]
            except Exception as e:
                print(f"[WARN] Error parsing Quiz JSON from LLM: {e}")

        # 3. Local Grounded Topic-Group Fallback (Trích xuất từ 92 MCQ vàng trong game_content.json đúng nhóm chủ đề)
        matched_local: List[GeneratedQuestion] = []
        try:
            from pathlib import Path
            gc_path = Path(__file__).resolve().parent / "data" / "game_content.json"
            if gc_path.exists():
                gc_data = json.loads(gc_path.read_text(encoding="utf-8"))
                lvl_map = {
                    "NHAN_BIET": "Nhận biết",
                    "THONG_HIEU": "Thông hiểu",
                    "VAN_DUNG": "Vận dụng",
                }

                # Tập hợp các unit_id thuộc nhóm chủ đề mục tiêu
                target_uids: set = set()
                if unit_ids and len(unit_ids) > 0:
                    target_uids = set(unit_ids)
                elif effective_gid == "TONG_HOP_TOAN_KHOA":
                    for g in CURRICULUM_TOPIC_GROUPS.values():
                        target_uids.update(g["unit_ids"])
                else:
                    target_uids = set(grp_info["unit_ids"])

                # Lọc ra các câu hỏi trắc nghiệm 4 đáp án khớp với nhóm chủ đề
                candidates_by_level: Dict[str, List[Any]] = {
                    "Nhận biết": [],
                    "Thông hiểu": [],
                    "Vận dụng": []
                }
                other_candidates: List[Any] = []

                for q in gc_data.get("questions", []):
                    if q.get("type") == "mcq" and isinstance(q.get("options"), list) and len(q.get("options")) == 4:
                        q_uid = q.get("unit_id")
                        if q_uid in target_uids:
                            c_lvl = lvl_map.get(q.get("level", "THONG_HIEU"), "Thông hiểu")
                            if c_lvl in candidates_by_level:
                                candidates_by_level[c_lvl].append(q)
                            else:
                                other_candidates.append(q)
                        else:
                            other_candidates.append(q)

                used_ids = set()
                for req_lvl in target_levels:
                    # Ưu tiên lấy đúng mức độ
                    pool = candidates_by_level.get(req_lvl, [])
                    avail = [q for q in pool if q.get("id") not in used_ids]
                    if not avail:
                        # Thử lấy từ các mức độ khác trong cùng nhóm chủ đề
                        for other_lvl in ["Thông hiểu", "Nhận biết", "Vận dụng"]:
                            if other_lvl != req_lvl:
                                avail = [q for q in candidates_by_level.get(other_lvl, []) if q.get("id") not in used_ids]
                                if avail:
                                    break
                    if not avail:
                        # Lấy từ kho dự phòng
                        avail = [q for q in other_candidates if q.get("id") not in used_ids]

                    if avail:
                        chosen = avail[0]
                        used_ids.add(chosen.get("id"))
                        chosen_lvl = lvl_map.get(chosen.get("level", "THONG_HIEU"), req_lvl)
                        matched_local.append(
                            GeneratedQuestion(
                                id=f"gen-topic-{chosen.get('id', len(matched_local)+1)}",
                                question=chosen["prompt"],
                                options=list(chosen["options"]),
                                correct_index=int(chosen["answer"]),
                                cognitive_level=chosen_lvl,
                                explanation=chosen.get("explanation", f"Căn cứ theo tư liệu {group_name}."),
                                curriculum_reference=chosen.get("source", grp_info["sgk_reference"]),
                                topic_group_id=effective_gid,
                                topic_group_name=group_name,
                                unit_id=chosen.get("unit_id"),
                                topic=display_topic
                            )
                        )
                if len(matched_local) >= num_questions:
                    return matched_local[:num_questions]
        except Exception as e:
            print(f"[WARN] Local Topic Fallback error: {e}")

        # 4. Emergency Backup nếu kho câu hỏi không đủ
        sample_pool = [
            GeneratedQuestion(
                id="q-fallback-1",
                question="Tại Hội nghị Diên Hồng năm 1285, trước câu hỏi 'Nên hòa hay nên đánh?' của Thượng hoàng, các bô lão đã đồng thanh đáp lời thế nào?",
                options=["ĐÁNH!", "HÒA!", "Tùy ý bệ hạ định đoạt", "Bảo toàn lực lượng"],
                correct_index=0,
                cognitive_level="Nhận biết",
                explanation="Đầu năm 1285, Thượng hoàng Trần Thánh Tông mở tiệc Diên Hồng đón các bô lão. Muôn miệng một lời, các bô lão cùng thét lớn 'ĐÁNH!', biểu thị ý chí quật cường của toàn dân tộc.",
                curriculum_reference="SGK Lịch sử 7 (KNTT) - Bài 15, Mục 2b",
                topic_group_id="KHANG_CHIEN_2",
                topic_group_name="Kháng chiến chống quân Nguyên lần 2 (1285)",
                unit_id="DIEN_HONG_CONFERENCE",
                topic="Hội nghị Diên Hồng"
            ),
            GeneratedQuestion(
                id="q-fallback-2",
                question="Kế sách quân sự độc đáo nào được quân dân Thăng Long thi hành triệt để khi quân Mông Cổ tiến công kinh thành năm 1258?",
                options=[
                    "Xây dựng thành quách cố thủ kiên cố",
                    "'Vườn không nhà trống' - triệt thoái người và lương thảo",
                    "Cầu viện các nước lân bang",
                    "Dốc toàn lực nghênh chiến trực diện tại cửa sông"
                ],
                correct_index=1,
                cognitive_level="Thông hiểu",
                explanation="Kế sách 'Vườn không nhà trống' khiến quân Mông Cổ chiếm được Thăng Long nhưng không tìm ra lương thảo, nhanh chóng rơi vào cảnh đói khát và suy sụp sĩ khí.",
                curriculum_reference="SGK Lịch sử 7 (KNTT) - Bài 15, Mục 1",
                topic_group_id="KHANG_CHIEN_1",
                topic_group_name="Kháng chiến chống Mông Cổ lần 1 (1258)",
                unit_id="KC1_VUON_KHONG_NHA_TRONG",
                topic="Kế sách Vườn không nhà trống"
            ),
            GeneratedQuestion(
                id="q-fallback-3",
                question="Trong cuộc kháng chiến lần thứ ba (1288), tướng lĩnh nào đã mưu trí chỉ huy trận phục kích tiêu diệt đoàn thuyền lương 17 vạn thạch của Trương Văn Hổ tại Vân Đồn?",
                options=["Trần Hưng Đạo", "Trần Khánh Dư", "Trần Quang Khải", "Trần Nhật Duật"],
                correct_index=1,
                cognitive_level="Nhận biết",
                explanation="Nhân Huệ Vương Trần Khánh Dư phán đoán thuyền lương giặc đi sau sẽ mất cảnh giác, liền phục kích tại Vân Đồn đánh chìm toàn bộ thuyền lương, cắt đứt hoàn toàn hậu cần quân Nguyên.",
                curriculum_reference="SGK Lịch sử 7 (KNTT) - Bài 15, Mục 3a",
                topic_group_id="KHANG_CHIEN_3",
                topic_group_name="Kháng chiến chống quân Nguyên lần 3 (1287 – 1288)",
                unit_id="KC3_VAN_DON",
                topic="Hải chiến Vân Đồn"
            ),
            GeneratedQuestion(
                id="q-fallback-4",
                question="Chiến thắng Bạch Đằng năm 1288 thể hiện đỉnh cao nghệ thuật quân sự nào của quân dân nhà Trần?",
                options=[
                    "Lợi dụng địa hình hiểm trở và quy luật lên xuống của thủy triều",
                    "Đánh du kích trường kỳ trong rừng rậm",
                    "Dùng kỵ binh nặng đối đầu trực diện kỵ binh Mông Cổ",
                    "Bao vây thành trì tiêu hao sinh lực địch"
                ],
                correct_index=0,
                cognitive_level="Vận dụng",
                explanation="Quốc công Tiết chế Trần Hưng Đạo đã khéo léo kết hợp bãi cọc ngầm lim đón thời khắc thủy triều rút để tổng phản công, tiêu diệt hoàn toàn thủy quân Nguyên.",
                curriculum_reference="SGK Lịch sử 7 (KNTT) - Bài 15, Mục 3b",
                topic_group_id="KHANG_CHIEN_3",
                topic_group_name="Kháng chiến chống quân Nguyên lần 3 (1287 – 1288)",
                unit_id="KC3_BACH_DANG_HOW",
                topic="Đại thắng Bạch Đằng"
            )
        ]
        combined = (matched_local + sample_pool)[:num_questions]
        return combined

    # ==========================================================================
    # 3. GENERATE QUEST STORY NARRATIVE
    # ==========================================================================
    async def generate_story(
        self, campaign_name: str, stage_title: str, key_event: str, grounding_records: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        fact = grounding_records[0].get("grounding_source", {}).get("fact_chunk", "") if grounding_records else ""

        prompt = (
            f"Hãy viết một đoạn văn dẫn truyện nhập vai lịch sử cho ải '{stage_title}' thuộc chiến dịch '{campaign_name}'.\n"
            f"Dựa trên sự kiện có thật: {key_event}.\n"
            f"Tư liệu lịch sử tham khảo: {fact}.\n"
            "Yêu cầu:\n"
            "- Giọng điệu hào hùng, lôi cuốn, tạo cảm giác phiêu lưu cho học sinh lớp 7.\n"
            "- Độ dài khoảng 3 - 5 câu văn giàu hình ảnh."
        )

        api_response = None
        if self.hf_client:
            api_response = await self._call_hf_api(prompt)
        if not api_response and self.api_key:
            api_response = await self._call_gemini_api(prompt)

        if api_response:
            return {
                "story_narrative": api_response,
                "historical_fact": fact,
                "challenge_question": f"Hãy vận dụng hiểu biết lịch sử để hoàn thành thử thách tại ải {stage_title}!"
            }

        # Fallback
        return {
            "story_narrative": (
                f"Đoàn quân Đại Việt tiến đến khu vực {stage_title}. Tiếng trống đồng âm vang trong sương sớm, "
                f"ngọn cờ thêu sáu chữ vàng phất phới bay theo chiều gió. Trước mặt các em là những thử thách lịch sử "
                f"hào hùng đòi hỏi lòng quả cảm và tinh thần mưu trí kế thừa từ các bậc tiền nhân!"
            ),
            "historical_fact": fact or "Ba lần kháng chiến chống Mông - Nguyên (1258 - 1288)",
            "challenge_question": f"Vận dụng kiến thức để giải mã bí mật chiến thuật tại ải {stage_title}!"
        }

gemini_client = GeminiClient()
