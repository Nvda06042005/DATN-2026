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
    }
}

class GeminiClient:
    def __init__(self):
        # 1. Cấu hình Google Gemini
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

        # 2. Cấu hình Hugging Face (Qwen2.5-7B-Instruct / BGE-M3)
        self.hf_token = settings.HF_TOKEN
        self.hf_model = settings.HF_MODEL
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
        persona = HISTORICAL_PERSONAS.get(character_id) if character_id else None
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
    # 2. GENERATE QUIZ FOR TEACHER STUDIO
    # ==========================================================================
    async def generate_quiz(
        self, topic: str, num_questions: int, cognitive_level: str, grounding_records: List[Dict[str, Any]]
    ) -> List[GeneratedQuestion]:
        context_facts = "\n".join([
            f"- {r.get('grounding_source', {}).get('fact_chunk', '')}"
            for r in grounding_records if r.get('grounding_source')
        ])

        system_instruction = (
            "Bạn là chuyên gia khảo thí Lịch sử 7. Hãy tạo các câu hỏi trắc nghiệm khách quan chuẩn GDPT 2018. "
            "Mỗi câu có đúng 4 phương án A, B, C, D, chỉ 1 đáp án đúng và có giải thích chi tiết."
        )

        prompt = (
            f"Dựa vào các tư liệu lịch sử sau đây:\n{context_facts}\n\n"
            f"Hãy tạo đúng {num_questions} câu hỏi trắc nghiệm về chủ đề: '{topic}', mức độ '{cognitive_level}'.\n"
            "Đầu ra BẮT BUỘC là định dạng JSON mảng các object với cấu trúc:\n"
            "[\n"
            "  {\n"
            "    \"question\": \"Nội dung câu hỏi?\",\n"
            "    \"options\": [\"Đáp án A\", \"Đáp án B\", \"Đáp án C\", \"Đáp án D\"],\n"
            "    \"correct_index\": 0,\n"
            "    \"cognitive_level\": \"Nhận biết\",\n"
            "    \"explanation\": \"Giải thích vì sao đúng dựa trên sử liệu...\",\n"
            "    \"curriculum_reference\": \"SGK Lịch sử 7 Bài 13\"\n"
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
                            id=f"gen-q-{i+1}",
                            question=q["question"],
                            options=q["options"],
                            correct_index=q["correct_index"],
                            cognitive_level=q.get("cognitive_level", cognitive_level),
                            explanation=q.get("explanation", ""),
                            curriculum_reference=q.get("curriculum_reference", "SGK Lịch sử 7")
                        )
                    )
                return questions
            except Exception as e:
                print(f"[WARN] Error parsing Quiz JSON from LLM: {e}")

        # 3. Local Grounded Fallback (Dữ liệu vàng chuẩn quốc gia)
        sample_questions = [
            GeneratedQuestion(
                id="q-fallback-1",
                question="Tại Hội nghị Diên Hồng năm 1285, trước câu hỏi 'Nên hòa hay nên đánh?' của Thượng hoàng, các bô lão đã đồng thanh đáp lời thế nào?",
                options=["ĐÁNH!", "HÒA!", "Tùy ý bệ hạ định đoạt", "Bảo toàn lực lượng"],
                correct_index=0,
                cognitive_level="Nhận biết",
                explanation="Đầu năm 1285, Thượng hoàng Trần Thánh Tông mở tiệc Diên Hồng đón các bô lão. Muôn miệng một lời, các bô lão cùng thét lớn 'ĐÁNH!', biểu thị ý chí quật cường của toàn dân tộc.",
                curriculum_reference="SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2b"
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
                curriculum_reference="SGK Lịch sử 7 - Bài 13, Mục 2a"
            ),
            GeneratedQuestion(
                id="q-fallback-3",
                question="Trong cuộc kháng chiến lần thứ ba (1288), tướng lĩnh nào đã mưu trí chỉ huy trận phục kích tiêu diệt đoàn thuyền lương 17 vạn thạch của Trương Văn Hổ tại Vân Đồn?",
                options=["Trần Hưng Đạo", "Trần Khánh Dư", "Trần Quang Khải", "Trần Nhật Duật"],
                correct_index=1,
                cognitive_level="Nhận biết",
                explanation="Nhân Huệ Vương Trần Khánh Dư phán đoán thuyền lương giặc đi sau sẽ mất cảnh giác, liền phục kích tại Vân Đồn đánh chìm toàn bộ thuyền lương, cắt đứt hoàn toàn hậu cần quân Nguyên.",
                curriculum_reference="SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2c"
            ),
            GeneratedQuestion(
                id="q-fallback-4",
                question="Trận quyết chiến chiến lược trên sông Bạch Đằng (4/1288) đã lợi dụng triệt để yếu tố tự nhiên nào để tiêu diệt hơn 400 chiến thuyền giặc?",
                options=[
                    "Mưa bão lớn làm đắm thuyền địch",
                    "Địa hình đồi núi dốc đứng hai bên bờ",
                    "Quy luật thủy triều lên xuống kết hợp bãi cọc gỗ lim ngầm",
                    "Lửa cháy thuận chiều gió thổi"
                ],
                correct_index=2,
                cognitive_level="Vận dụng",
                explanation="Hưng Đạo Vương cho đẵn gỗ lim vót nhọn cắm ngầm lòng sông Bạch Đằng, nhử giặc vào lúc triều dâng rồi chặn đánh quyết liệt khi triều rút mạnh, khiến thuyền giặc vướng cọc nhọn vỡ nát.",
                curriculum_reference="Đại Việt Sử Ký Toàn Thư & SGK Lịch sử 7"
            )
        ]
        return sample_questions[:num_questions]

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
