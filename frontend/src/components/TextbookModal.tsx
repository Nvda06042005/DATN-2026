import { X, BookOpen, CheckCircle } from 'lucide-react';

interface TextbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageNumber: number;
}

export const TextbookModal: React.FC<TextbookModalProps> = ({
  isOpen,
  onClose,
  pageNumber,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Trích đoạn SGK Lịch sử 7</h3>
              <p className="text-[11px] text-slate-400">Bộ sách Kết nối tri thức với cuộc sống • Trang {pageNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Excerpt */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block mb-1">
              Bài 13: Đại Việt thời Trần (1226 – 1400) • Mục 2b (Trang 68 – 69)
            </span>
            <h4 className="font-bold text-slate-900 text-sm mb-2">
              Chuẩn bị cho cuộc kháng chiến lần thứ hai chống quân Nguyên (1282 – 1285)
            </h4>
            
            <p className="mb-3 text-slate-800">
              <strong>1. Hội nghị Bình Than (Tháng 10 năm 1282):</strong><br />
              Trước nguy cơ xâm lăng của 50 vạn giặc Nguyên, vua Trần Nhân Tông mở hội nghị tại bến Bình Than (Gia Bình, Bắc Ninh), triệu tập các <em>vương hầu, quý tộc và tướng lĩnh</em> trong hoàng tộc để bàn kế sách tác chiến và phân công phòng thủ đất nước.
            </p>

            <blockquote className="border-l-4 border-amber-500 pl-3 my-2 text-slate-800 italic bg-white/70 py-1.5 rounded-r">
              "Hoài Văn hầu Trần Quốc Toản vì còn nhỏ tuổi không được vào dự bàn việc quân, trong lòng hổ thẹn, phẫn uất, tay cầm quả cam vua ban bóp nát lúc nào không biết. Sau đó, Quốc Toản trở về chiêu mộ hơn 1.000 gia nô, thêu cờ sáu chữ vàng 'Phá cường địch, báo hoàng ân'..."
            </blockquote>

            <p className="mt-3 text-slate-800">
              <strong>2. Hội nghị Diên Hồng (Đầu năm 1285):</strong><br />
              Thượng hoàng Trần Thánh Tông triệu tập <em>các bậc phụ lão (bô lão)</em> uy tín đại diện cho nhân dân khắp mọi miền đất nước về điện Diên Hồng (Thăng Long) để hỏi ý kiến: <em>"Nên đánh hay nên hòa?"</em>. Muôn người một lòng, đồng thanh hô vang một tiếng <strong>"ĐÁNH!"</strong> rung chuyển kinh thành.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900">
              <strong>Điểm mấu chốt để phân biệt cho học sinh:</strong><br />
              • <strong>Bình Than (1282):</strong> Họp Vương hầu quan lại triều đình (Quả cam của Trần Quốc Toản).<br />
              • <strong>Diên Hồng (1285):</strong> Họp Bô lão đại diện cho nhân dân (Tiếng hô ĐÁNH).
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Nguồn: Viện KHGD & NXB Giáo dục Việt Nam</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
