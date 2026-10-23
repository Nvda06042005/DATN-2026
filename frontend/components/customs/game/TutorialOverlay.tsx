import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Mascot } from '@/components/customs/Mascot';
import { GBtn } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import type { MascotAccessory, MascotMood } from '@/types/mascotType';

const TUTORIAL = [
  { title: 'Chào mừng đến Điền Trang Đông A!', text: 'Ta là Rồng Con. Thời bình, quân dân làm ruộng tích lương thảo; có giặc thì ra trận – đó là chính sách “ngụ binh ư nông”.', mood: 'excited' as MascotMood, acc: 'conical' as MascotAccessory },
  { title: 'Kiến thức là vũ khí', text: 'Muốn nâng cấp công trình, chiêu mộ hay tung kế sách, em phải trả lời đúng câu hỏi lịch sử. Ấn Tín chỉ có khi em trả lời đúng.', mood: 'thinking' as MascotMood, acc: 'scholar' as MascotAccessory },
  { title: 'Chiêu mộ tướng ở Doanh Trại', text: 'Ghép một thẻ Nhân lực với một thẻ Sự kiện ở Hội Quán Vạn Kiếp để mời danh tướng nhà Trần gia nhập.', mood: 'happy' as MascotMood, acc: 'helmet' as MascotAccessory },
  { title: 'Ra trận theo đúng kế sách', text: 'Ba màn chiến dịch: 1258, 1285, 1287 – 1288. Rút lui đúng lúc, bỏ trống làng mạc, cắt nguồn lương, chờ thủy triều rút… như ông cha ta!', mood: 'love' as MascotMood, acc: 'crown' as MascotAccessory },
];

export const TutorialOverlay: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const s = TUTORIAL[step];
  return (
    <Sheet open onClose={onDone} title={s.title} subtitle={`Hướng dẫn ${step + 1}/${TUTORIAL.length}`}>
      <div className="flex flex-col items-center text-center gap-4">
        <Mascot size={130} mood={s.mood} accessory={s.acc} bob />
        <p className="leading-relaxed text-lg">{s.text}</p>
        <div className="flex gap-1.5" aria-hidden="true">
          {TUTORIAL.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-son' : 'w-2 bg-vien-2'}`} />
          ))}
        </div>
        <div className="w-full flex gap-2">
          <GBtn variant="ghost" onClick={onDone}>
            Bỏ qua
          </GBtn>
          <GBtn variant="giay" className="ml-auto" disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Quay lại">
            <ChevronLeft className="w-5 h-5" aria-hidden={true} />
          </GBtn>
          <GBtn variant="son" onClick={() => (step + 1 < TUTORIAL.length ? setStep(step + 1) : onDone())}>
            {step + 1 < TUTORIAL.length ? 'Tiếp theo' : 'Bắt đầu chơi'} <ChevronRight className="w-5 h-5" aria-hidden={true} />
          </GBtn>
        </div>
      </div>
    </Sheet>
  );
};
