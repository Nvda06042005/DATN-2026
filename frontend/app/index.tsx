import React from 'react';
import { GraduationCap, Presentation, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/customs/BrandLogo';
import { Mascot } from '@/components/customs/Mascot';
import { goTo, routeHref } from '@/lib/router';

export const HomeChooser: React.FC = () => (
  <div className="min-h-screen w-full paper-bg flex flex-col text-muc">
    <header className="px-5 sm:px-8 py-4 flex items-center justify-between">
      <BrandLogo subtitle="Học Sử qua game" />
      <button onClick={() => goTo('admin')} className="btn-3d btn-outline btn-sm !text-duo-wolf" aria-label="Trang quản trị">
        <ShieldCheck className="w-4 h-4" /> <span className="hidden sm:inline">Quản trị</span>
      </button>
    </header>

    <main className="flex-1 flex flex-col items-center px-5 pb-10">
      <section className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4 md:gap-8 pt-2 md:pt-8">
        <div className="text-center md:text-left">
          <span className="seal-title text-sm">Lịch sử 7 · 1258 – 1288</span>
          <h1 className="font-display text-[2.6rem] sm:text-6xl font-extrabold text-muc mt-3 leading-[1.05]">Hào Khí Đông A</h1>
          <p className="text-lg text-muc-2 mt-3 max-w-xl mx-auto md:mx-0">
            Xây Điền Trang, chiêu mộ danh tướng nhà Trần và ra trận theo đúng kế sách của ông cha – mỗi sức mạnh đều đến từ một câu trả lời đúng.
          </p>
        </div>
        <Mascot size={180} accessory="helmet" mood="excited" bob className="mx-auto order-first md:order-none" />
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-4xl mt-8">
        <button onClick={() => goTo('student')} className="g-card p-6 text-left flex flex-col gap-4 hover:-translate-y-0.5 transition">
          <span className="w-16 h-16 rounded-2xl bg-son flex items-center justify-center shadow-[0_4px_0_#7f1d1d]">
            <GraduationCap className="w-9 h-9 text-white" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-extrabold">Học sinh</h2>
            <p className="text-muc-2 mt-1">Vào Điền Trang: thu lương thảo, chiêu mộ tướng, đánh 3 màn chiến dịch và hỏi Quân Sư AI.</p>
          </div>
          <span className="btn-3d btn-red w-full mt-auto">Vào trang học sinh</span>
          <span className="text-xs font-semibold text-muc-2 text-center -mt-2">{routeHref('student').replace(/^https?:\/\//, '')}</span>
        </button>

        <button onClick={() => goTo('teacher')} className="g-card p-6 text-left flex flex-col gap-4 hover:-translate-y-0.5 transition">
          <span className="w-16 h-16 rounded-2xl bg-ngoc flex items-center justify-center shadow-[0_4px_0_#134e4a]">
            <Presentation className="w-9 h-9 text-white" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-extrabold">Giáo viên</h2>
            <p className="text-muc-2 mt-1">Theo dõi tiến độ, câu sai nhiều nhất và mức nắm vững của cả lớp; tổ chức thi đấu và soạn đề bằng AI.</p>
          </div>
          <span className="btn-3d btn-green w-full mt-auto">Vào trang giáo viên</span>
          <span className="text-xs font-semibold text-muc-2 text-center -mt-2">{routeHref('teacher').replace(/^https?:\/\//, '')}</span>
        </button>
      </div>

      <button onClick={() => goTo('admin')} className="mt-8 min-h-[44px] text-sm font-bold text-muc-2 hover:text-muc flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4" /> Quản trị viên nhà trường? Vào trang quản trị
      </button>
    </main>

    <footer className="py-4 text-center text-xs font-semibold text-muc-2 border-t-2 border-vien">© Đông A EDU · Lịch sử và Địa lí 7 – Ba lần kháng chiến chống quân xâm lược Mông – Nguyên</footer>
  </div>
);
