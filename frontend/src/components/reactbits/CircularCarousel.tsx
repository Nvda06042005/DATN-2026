import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  Play,
  Pause,
  Compass,
  Flame,
} from 'lucide-react';

export interface CircularCarouselItem {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  badge: string;
  description: string;
  quote?: string;
  citation: string;
  image: string;
  accentColor?: 'amber' | 'emerald' | 'purple' | 'rose' | 'sky';
  stats?: Array<{ label: string; value: string }>;
  promptSuggestion?: string;
}

interface CircularCarouselProps {
  items: CircularCarouselItem[];
  onPrimaryAction?: (item: CircularCarouselItem) => void;
  onSecondaryAction?: (item: CircularCarouselItem) => void;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  variant?: 'student' | 'teacher';
}

const ACCENT_STYLES = {
  amber: {
    border: 'border-amber-400/60',
    glow: 'shadow-[0_0_45px_-10px_rgba(245,158,11,0.55)]',
    badge: 'bg-amber-400 text-slate-950',
    pill: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
    btn: 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:from-amber-300 hover:to-orange-400',
  },
  emerald: {
    border: 'border-emerald-400/60',
    glow: 'shadow-[0_0_45px_-10px_rgba(16,185,129,0.55)]',
    badge: 'bg-emerald-400 text-slate-950',
    pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    btn: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 hover:from-emerald-300 hover:to-teal-400',
  },
  purple: {
    border: 'border-purple-400/60',
    glow: 'shadow-[0_0_45px_-10px_rgba(168,85,247,0.55)]',
    badge: 'bg-purple-400 text-slate-950',
    pill: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
    btn: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-400 hover:to-indigo-500',
  },
  rose: {
    border: 'border-rose-400/60',
    glow: 'shadow-[0_0_45px_-10px_rgba(244,63,94,0.55)]',
    badge: 'bg-rose-400 text-slate-950',
    pill: 'bg-rose-500/20 text-rose-200 border-rose-400/40',
    btn: 'bg-gradient-to-r from-rose-500 to-amber-500 text-white hover:from-rose-400 hover:to-amber-400',
  },
  sky: {
    border: 'border-sky-400/60',
    glow: 'shadow-[0_0_45px_-10px_rgba(56,189,248,0.55)]',
    badge: 'bg-sky-400 text-slate-950',
    pill: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
    btn: 'bg-gradient-to-r from-sky-400 to-blue-600 text-white hover:from-sky-300 hover:to-blue-500',
  },
};

export const CircularCarousel: React.FC<CircularCarouselProps> = ({
  items,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel = 'Hỏi Thầy Đông A',
  secondaryActionLabel = 'Vào Thi Đấu',
  autoPlay = true,
  autoPlayInterval = 5200,
  variant = 'student',
}) => {
  const count = items.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [rotation, setRotation] = useState(0); // continuous float index
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const targetRotationRef = useRef(0);
  const currentRotationRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartRotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Smooth spring physics loop (60fps ReactBits style)
  useEffect(() => {
    let active = true;
    const animate = () => {
      if (!active) return;
      const diff = targetRotationRef.current - currentRotationRef.current;
      if (Math.abs(diff) > 0.0005) {
        currentRotationRef.current += diff * 0.11;
        setRotation(currentRotationRef.current);
      } else if (diff !== 0) {
        currentRotationRef.current = targetRotationRef.current;
        setRotation(currentRotationRef.current);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const rotateToIndex = useCallback(
    (nextIdx: number) => {
      if (count === 0) return;
      // Find shortest angular path around the circle
      const currentTarget = targetRotationRef.current;
      const currentMod = ((currentTarget % count) + count) % count;
      let delta = nextIdx - currentMod;
      if (delta > count / 2) delta -= count;
      if (delta < -count / 2) delta += count;
      targetRotationRef.current = currentTarget + delta;
      const normalized = ((Math.round(targetRotationRef.current) % count) + count) % count;
      setActiveIndex(normalized);
    },
    [count]
  );

  const handleNext = useCallback(() => {
    targetRotationRef.current = Math.round(targetRotationRef.current) + 1;
    const normalized = ((Math.round(targetRotationRef.current) % count) + count) % count;
    setActiveIndex(normalized);
  }, [count]);

  const handlePrev = useCallback(() => {
    targetRotationRef.current = Math.round(targetRotationRef.current) - 1;
    const normalized = ((Math.round(targetRotationRef.current) % count) + count) % count;
    setActiveIndex(normalized);
  }, [count]);

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying || isHovered || isDragging || count <= 1) return;
    const timer = setInterval(() => {
      handleNext();
    }, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isPlaying, isHovered, isDragging, count, autoPlayInterval, handleNext]);

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    // Ignore clicks on buttons inside cards
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartRotationRef.current = targetRotationRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartXRef.current;
    // 220px drag = 1 card step
    const stepDelta = -deltaX / 220;
    targetRotationRef.current = dragStartRotationRef.current + stepDelta;
    const normalized = ((Math.round(targetRotationRef.current) % count) + count) % count;
    setActiveIndex(normalized);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // Snap to nearest card
    targetRotationRef.current = Math.round(targetRotationRef.current);
    const normalized = ((Math.round(targetRotationRef.current) % count) + count) % count;
    setActiveIndex(normalized);
  };

  if (count === 0) return null;

  const activeItem = items[activeIndex] || items[0];
  const activeStyle = ACCENT_STYLES[activeItem.accentColor || 'amber'];

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-br from-[#090d16] via-[#131129] to-[#1e1035] text-white border border-white/10 shadow-2xl select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ambient Awwwards Aurora Glows */}
      <div className="pointer-events-none absolute -top-28 -left-24 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 w-96 h-96 rounded-full bg-purple-600/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Bar: Header & Controls */}
      <div className="relative z-20 px-6 pt-5 pb-2 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 font-black">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                {variant === 'student'
                  ? 'SA BÀN TƯƠNG TÁC 3D • HÀO KHÍ ĐÔNG A'
                  : 'SA BÀN TRỰC QUAN HÓA CHIẾN DỊCH 3D'}
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 border border-emerald-400/30">
                360° Circular Gallery
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
              {variant === 'student'
                ? 'Khám phá Nhân vật & Chiến dịch Lịch sử (Kéo xoay 3D)'
                : 'Điều phối Chuyên đề & Học liệu Lịch sử 7 theo Chuẩn GDPT 2018'}
            </h3>
          </div>
        </div>

        {/* Navigation & AutoPlay Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 hidden md:inline mr-1">
            Kéo ngang hoặc nhấn mũi tên để xoay
          </span>
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-slate-200 transition active:scale-95"
            title={isPlaying ? 'Tạm dừng tự động xoay' : 'Bật tự động xoay'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handlePrev}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition active:scale-95"
            title="Chặng trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono font-bold text-amber-300">
            {activeIndex + 1} / {count}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition active:scale-95"
            title="Chặng tiếp theo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D Circular Stage */}
      <div
        className={`relative h-[320px] sm:h-[340px] w-full flex items-center justify-center overflow-hidden ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ perspective: '1200px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Decorative 3D Orbital Ring Floor */}
        <div
          className="pointer-events-none absolute w-[560px] h-[560px] rounded-full border border-amber-400/15"
          style={{
            transform: 'rotateX(76deg) translateZ(-110px)',
            boxShadow: 'inset 0 0 60px rgba(245, 158, 11, 0.08)',
          }}
        />

        {items.map((item, idx) => {
          // Compute shortest angular distance from current continuous rotation
          let offset = (idx - rotation) % count;
          if (offset > count / 2) offset -= count;
          if (offset < -count / 2) offset += count;

          // Circular arc math
          const theta = (offset / count) * Math.PI * 2;
          const radiusX = 275; // Horizontal spread radius
          const radiusZ = 155; // Depth radius
          const translateX = Math.sin(theta) * radiusX;
          const translateZ = (Math.cos(theta) - 1) * radiusZ;
          const rotateY = -Math.sin(theta) * 34; // Tilt inward/outward along circle
          const scale = 0.68 + 0.32 * ((Math.cos(theta) + 1) / 2);
          const opacity = Math.max(0.18, 0.25 + 0.75 * ((Math.cos(theta) + 1) / 2));
          const zIndex = Math.round(((Math.cos(theta) + 1) / 2) * 100);
          const isCenter = idx === activeIndex;
          const itemAccent = ACCENT_STYLES[item.accentColor || 'amber'];

          return (
            <div
              key={item.id}
              onClick={() => {
                if (!isDragging && idx !== activeIndex) {
                  rotateToIndex(idx);
                }
              }}
              style={{
                transform: `translate3d(${translateX.toFixed(1)}px, 0px, ${translateZ.toFixed(
                  1
                )}px) rotateY(${rotateY.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
                opacity,
                zIndex,
                transformStyle: 'preserve-3d',
              }}
              className={`absolute w-[250px] sm:w-[275px] h-[270px] rounded-2xl overflow-hidden border transition-shadow duration-300 ${
                isCenter
                  ? `${itemAccent.border} ${itemAccent.glow} ring-1 ring-white/30`
                  : 'border-white/15 hover:border-white/35'
              } bg-slate-900/90 backdrop-blur-xl flex flex-col justify-between`}
            >
              {/* Card Image Header */}
              <div className="relative h-32 w-full overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  draggable={false}
                  className="w-full h-full object-cover object-center transform transition-transform duration-700 hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                {/* Top Badges on Card */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm ${itemAccent.badge}`}
                  >
                    {item.badge}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950/80 text-white border border-white/15 backdrop-blur-md">
                    {item.period}
                  </span>
                </div>

                {/* Subtitle overlay */}
                <div className="absolute bottom-2 left-3 right-3">
                  <span className="text-[10px] font-bold text-amber-300/90 uppercase tracking-wider block truncate">
                    {item.subtitle}
                  </span>
                  <h4 className="text-sm font-black text-white leading-tight truncate">
                    {item.title}
                  </h4>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3.5 flex-1 flex flex-col justify-between bg-gradient-to-b from-slate-950/90 to-slate-900/95">
                <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                  {item.description}
                </p>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-semibold text-slate-400 truncate flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
                    {item.citation}
                  </span>
                  {isCenter && (
                    <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-400 shrink-0">
                      <Flame className="w-3 h-3 fill-emerald-400" />
                      ĐANG CHỌN
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Active Inspector & Quick Actions Bar */}
      <div className="relative z-20 px-6 py-4 bg-slate-950/80 backdrop-blur-xl border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${activeStyle.pill}`}
            >
              {activeItem.period} • {activeItem.subtitle}
            </span>
            <span className="text-xs font-extrabold text-white">{activeItem.title}</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              — {activeItem.citation}
            </span>
          </div>

          {activeItem.quote ? (
            <p className="text-xs text-amber-200/90 italic font-medium">
              “{activeItem.quote}”
            </p>
          ) : (
            <p className="text-xs text-slate-300">{activeItem.description}</p>
          )}
        </div>

        {/* Action Buttons + Dot Indicators */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Carousel Dots */}
          <div className="flex items-center gap-1.5 mr-2">
            {items.map((it, idx) => (
              <button
                key={it.id}
                type="button"
                onClick={() => rotateToIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === activeIndex
                    ? 'w-6 bg-amber-400 shadow-sm shadow-amber-400/50'
                    : 'w-2 bg-white/25 hover:bg-white/50'
                }`}
                title={it.title}
              />
            ))}
          </div>

          {onPrimaryAction && (
            <button
              type="button"
              onClick={() => onPrimaryAction(activeItem)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{primaryActionLabel}</span>
            </button>
          )}

          {onSecondaryAction && (
            <button
              type="button"
              onClick={() => onSecondaryAction(activeItem)}
              className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-lg transition active:scale-95 ${activeStyle.btn}`}
            >
              <span>{secondaryActionLabel}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
