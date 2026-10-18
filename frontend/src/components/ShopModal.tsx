import React, { useState } from 'react';
import { X, ShoppingBag, Sparkles, Check } from 'lucide-react';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPoints?: number;
}

export const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose, userPoints = 1450 }) => {
  const [points, setPoints] = useState(userPoints);
  const [boughtItems, setBoughtItems] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const shopItems = [
    {
      id: 1,
      name: 'Bút Chì Lưu Niệm Đông A',
      desc: 'Quà tặng hiện vật ghi nhận thành tích giải bài xuất sắc.',
      price: 200,
      icon: '✏️',
    },
    {
      id: 2,
      name: 'Thẻ Cứu Nguy (+15 Điểm)',
      desc: 'Hỗ trợ bạn học trong lớp khi bị trừ điểm tham gia.',
      price: 300,
      icon: '🛡️',
    },
    {
      id: 3,
      name: 'Gợi Ý Nhanh SGK Lịch Sử 7',
      desc: 'Mở trang sách giáo khoa chứa đáp án câu hỏi khó.',
      price: 150,
      icon: '📖',
    },
    {
      id: 4,
      name: 'Huy Hiệu Tướng Lĩnh Đông A',
      desc: 'Huy hiệu danh dự gắn vào hồ sơ cá nhân.',
      price: 500,
      icon: '🎖️',
    },
    {
      id: 5,
      name: 'Thẻ Nhân Đôi Điểm Bài Tới',
      desc: 'Nhân đôi số điểm nhận được ở bài tập tiếp theo.',
      price: 800,
      icon: '⭐',
    },
  ];

  const handleBuy = (item: typeof shopItems[0]) => {
    if (points >= item.price) {
      setPoints((prev) => prev - item.price);
      setBoughtItems((prev) => [...prev, item.id]);
      setToast(`🎉 Đã đổi thành công: ${item.name}!`);
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-wide uppercase">Cửa Hàng Đổi Thưởng</h3>
              <p className="text-[11px] text-sky-100 font-medium">Dùng điểm tích lũy học tập để đổi quà</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Points Bar */}
        <div className="bg-sky-50 border-b border-sky-100 px-4 py-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Điểm hiện có của bạn:</span>
          <span className="font-black text-sky-700 bg-white px-3 py-1 rounded-full border border-sky-200 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            {points.toLocaleString()} điểm
          </span>
        </div>

        {/* Toast */}
        {toast && (
          <div className="bg-emerald-500 text-white text-xs font-bold px-4 py-2 text-center animate-fade-in">
            {toast}
          </div>
        )}

        {/* Item List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {shopItems.map((item) => {
            const isBought = boughtItems.includes(item.id);
            const canAfford = points >= item.price;

            return (
              <div
                key={item.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 hover:bg-slate-100/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{item.name}</h4>
                    <p className="text-[11px] text-slate-500 leading-tight">{item.desc}</p>
                    <span className="text-[11px] font-black text-sky-700 mt-1 inline-block">
                      {item.price} điểm
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleBuy(item)}
                  disabled={isBought || !canAfford}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    isBought
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed flex items-center gap-1'
                      : canAfford
                      ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs active:scale-95'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isBought ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Đã đổi
                    </>
                  ) : (
                    'Đổi ngay'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
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
