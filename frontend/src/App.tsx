/* =============================================================================
   ĐÔNG A – Học Sử vui như chơi (Lịch sử 7 • KNTT)
   Toàn bộ giao diện frontend gộp trong một file.
   Cổng học sinh là web-game "Hào Khí Đông A" (giấy dó, men ngọc, son đỏ; linh vật Rồng Con).
   ========================================================================== */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Anchor, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpCircle, Award, BarChart2, Bell, BicepsFlexed, BookOpen, Brain, Building2, Check, CheckCircle, CheckCircle2, ChessKnight, ChevronDown, ChevronLeft, ChevronRight, Citrus, ClipboardCopy, Clock, Code2, Coins, Compass, Copy, Crosshair, Crown, Download, Droplets, Edit3, Eye, EyeOff, Feather, FileQuestion, FileSpreadsheet, Filter, Flag, Flame, Flower2, Folder, FolderOpen, FolderPlus, Footprints, Gift, GraduationCap, Hammer, Heart, HelpCircle, Home, Hourglass, Image as ImageIcon, Info, KeyRound, Landmark, Layers, LayoutDashboard, LayoutGrid, Leaf, Lightbulb, Link2, List, ListFilter, ListOrdered, Loader2, Lock, LogOut, MapPin, Maximize2, Medal, Megaphone, MessageSquare, Minimize2, Minus, Monitor, Moon, MoreVertical, Mountain, Music, Package, Palette, Pause, Play, Plus, Presentation, Printer, Radio, RefreshCw, RotateCcw, Sailboat, School, Scroll, ScrollText, Search, Send, Settings, Shield, ShieldCheck, Ship, ShoppingBasket, Siren, Sliders, Snowflake, Sparkles, Sprout, Stamp, Star, Sun, Sword, Swords, Tag, Target, Tent, Timer, Trash2, Trophy, Type, Unlock, User, UserPlus, Users, UsersRound, Utensils, Video, Volume2, VolumeX, Warehouse, Waves, Wheat, Wifi, WifiOff, X, Zap } from 'lucide-react';
import bachDangImg1 from './assets/bach_dang_battle_1.png';
import bachDangImg2 from './assets/bach_dang_battle_2.jpg';
import daiVietMapImg from './assets/dai_viet_campaign_map.jpg';

// ============================================================================
// components/mascot/Mascot – linh vật Rồng Con Đông A
// ============================================================================

type MascotMood = 'happy' | 'excited' | 'sad' | 'sleepy' | 'thinking' | 'love';
type MascotAccessory = 'none' | 'helmet' | 'conical' | 'crown' | 'scholar';

interface MascotProps {
  size?: number;
  mood?: MascotMood;
  accessory?: MascotAccessory;
  className?: string;
  /** Nhún nhảy nhẹ liên tục */
  bob?: boolean;
  title?: string;
}

const M_INK = '#134e48';
const M_BODY = '#2bb3a0';
const M_HEAD = '#34c4b0';
const M_SNOUT = '#9be7d9';
const M_GOLD = '#d97706';
const M_RED = '#dc2626';

/**
 * Rồng Con — linh vật của Đông A, lấy cảm hứng từ hình rồng thời Trần.
 * Vẽ thuần SVG để sắc nét ở mọi kích thước; không mô phỏng nhân vật lịch sử có thật.
 */
const Mascot: React.FC<MascotProps> = ({ size = 120, mood = 'happy', accessory = 'none', className = '', bob = false, title = 'Rồng Con' }) => {
  const eyes = () => {
    switch (mood) {
      case 'excited':
        return (
          <g stroke={M_INK} strokeWidth="6" strokeLinecap="round" fill="none">
            <path d="M66 82 q12 -15 24 0" />
            <path d="M110 82 q12 -15 24 0" />
          </g>
        );
      case 'sleepy':
        return (
          <g stroke={M_INK} strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M66 82 q12 8 24 0" />
            <path d="M110 82 q12 8 24 0" />
          </g>
        );
      case 'love':
        return (
          <g fill={M_RED}>
            <path d="M78 92 l-12 -12 a7 7 0 0 1 12 -8 a7 7 0 0 1 12 8 z" />
            <path d="M122 92 l-12 -12 a7 7 0 0 1 12 -8 a7 7 0 0 1 12 8 z" />
          </g>
        );
      default: {
        const dx = mood === 'thinking' ? 4 : 0;
        const dy = mood === 'thinking' ? -4 : mood === 'sad' ? 3 : 0;
        return (
          <g>
            <ellipse cx="78" cy="80" rx="14" ry="16" fill="#fff" stroke={M_INK} strokeWidth="3" />
            <ellipse cx="122" cy="80" rx="14" ry="16" fill="#fff" stroke={M_INK} strokeWidth="3" />
            <circle cx={78 + dx} cy={82 + dy} r="8" fill="#1c1917" />
            <circle cx={122 + dx} cy={82 + dy} r="8" fill="#1c1917" />
            <circle cx={81 + dx} cy={78 + dy} r="3" fill="#fff" />
            <circle cx={125 + dx} cy={78 + dy} r="3" fill="#fff" />
            {mood === 'sad' && (
              <g stroke={M_INK} strokeWidth="4" strokeLinecap="round">
                <path d="M64 62 l18 6" />
                <path d="M136 62 l-18 6" />
              </g>
            )}
            {mood === 'thinking' && <path d="M110 60 q12 -6 24 2" stroke={M_INK} strokeWidth="4" strokeLinecap="round" fill="none" />}
          </g>
        );
      }
    }
  };

  const mouth = () => {
    if (mood === 'excited' || mood === 'love')
      return (
        <g>
          <path d="M86 116 q14 18 28 0 z" fill="#7f1d1d" stroke={M_INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M93 121 q7 6 14 0" fill="#fb7185" />
        </g>
      );
    if (mood === 'sad') return <path d="M88 124 q12 -10 24 0" stroke={M_INK} strokeWidth="4" strokeLinecap="round" fill="none" />;
    if (mood === 'sleepy') return <ellipse cx="100" cy="120" rx="5" ry="4" fill={M_INK} />;
    if (mood === 'thinking') return <path d="M90 120 h18" stroke={M_INK} strokeWidth="4" strokeLinecap="round" />;
    return <path d="M86 116 q14 12 28 0" stroke={M_INK} strokeWidth="4" strokeLinecap="round" fill="none" />;
  };

  const showCrest = accessory !== 'helmet' && accessory !== 'conical';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`${bob ? 'animate-pig-bob' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <ellipse cx="100" cy="188" rx="54" ry="8" fill="rgba(0,0,0,0.12)" />
      {/* Đuôi cuộn với ngọn lửa */}
      <path d="M138 160 C176 160 186 128 168 112" fill="none" stroke={M_INK} strokeWidth="16" strokeLinecap="round" />
      <path d="M138 160 C176 160 186 128 168 112" fill="none" stroke={M_BODY} strokeWidth="10" strokeLinecap="round" />
      <path d="M168 112 c-10 -6 -6 -20 4 -24 c-2 8 6 10 8 4 c6 10 0 22 -12 20 z" fill={M_RED} stroke={M_INK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Thân */}
      <ellipse cx="100" cy="150" rx="46" ry="36" fill={M_BODY} stroke={M_INK} strokeWidth="4" />
      <ellipse cx="100" cy="157" rx="27" ry="24" fill="#fce7b8" />
      <g stroke="#e3c27f" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M82 146 q18 8 36 0" />
        <path d="M80 158 q20 8 40 0" />
        <path d="M84 170 q16 6 32 0" />
      </g>
      <ellipse cx="74" cy="182" rx="14" ry="8" fill="#23998a" stroke={M_INK} strokeWidth="3" />
      <ellipse cx="126" cy="182" rx="14" ry="8" fill="#23998a" stroke={M_INK} strokeWidth="3" />
      <path d="M58 138 q-10 10 -4 20" stroke={M_INK} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M58 138 q-10 10 -4 20" stroke={M_BODY} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M142 138 q10 10 4 20" stroke={M_INK} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M142 138 q10 10 4 20" stroke={M_BODY} strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Sừng */}
      {accessory !== 'conical' && (
        <g stroke="#92400e" strokeWidth="3" strokeLinejoin="round" fill={M_GOLD}>
          <path d="M70 46 l-10 -24 l8 2 l2 -10 l8 16 z" />
          <path d="M130 46 l10 -24 l-8 2 l-2 -10 l-8 16 z" />
        </g>
      )}
      {/* Bờm lửa */}
      {showCrest && (
        <g stroke={M_INK} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M84 40 c-4 -14 6 -24 14 -28 c-2 10 8 12 6 2 c10 8 10 22 2 28 z" fill={M_RED} />
          <path d="M92 38 c0 -8 4 -12 8 -14 c0 6 4 6 4 0 c4 6 2 12 -2 16 z" fill="#f59e0b" stroke="none" />
        </g>
      )}
      {/* Đầu */}
      <ellipse cx="100" cy="84" rx="58" ry="50" fill={M_HEAD} stroke={M_INK} strokeWidth="4" />
      <ellipse cx="100" cy="66" rx="34" ry="14" fill="rgba(255,255,255,0.18)" />
      {/* Mõm & râu */}
      <ellipse cx="100" cy="106" rx="30" ry="18" fill={M_SNOUT} stroke={M_INK} strokeWidth="3" />
      <ellipse cx="91" cy="102" rx="3.5" ry="2.5" fill={M_INK} />
      <ellipse cx="109" cy="102" rx="3.5" ry="2.5" fill={M_INK} />
      <g stroke={M_GOLD} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M72 106 c-14 -2 -22 -10 -30 -4" />
        <path d="M128 106 c14 -2 22 -10 30 -4" />
      </g>
      <ellipse cx="58" cy="100" rx="9" ry="5" fill="#fb7185" opacity="0.45" />
      <ellipse cx="142" cy="100" rx="9" ry="5" fill="#fb7185" opacity="0.45" />
      {eyes()}
      {mouth()}
      {mood === 'sad' && <path d="M66 98 q-3 8 0 12 q3 -4 0 -12" fill="#7dd3fc" />}
      {mood === 'sleepy' && (
        <text x="150" y="44" fontSize="22" fontWeight="800" fill={M_INK}>
          z
        </text>
      )}
      {/* Phụ kiện */}
      {accessory === 'helmet' && (
        <g stroke="#78350f" strokeWidth="3" strokeLinejoin="round">
          <path d="M48 62 C52 22 148 22 152 62 Z" fill="#b45309" />
          <path d="M44 62 h112 a6 6 0 0 1 0 10 h-112 a6 6 0 0 1 0 -10 z" fill="#d97706" />
          <path d="M100 26 v-10" stroke="#78350f" strokeWidth="4" />
          <path d="M92 10 c4 -8 12 -8 16 0 c-4 6 -12 6 -16 0 z" fill={M_RED} />
          <path d="M70 52 q30 -22 60 0" fill="none" stroke="#fde68a" strokeWidth="3" opacity="0.7" />
        </g>
      )}
      {accessory === 'conical' && (
        <g strokeLinejoin="round">
          <path d="M34 60 L100 4 L166 60 Q100 74 34 60 Z" fill="#ead39a" stroke="#a07b3a" strokeWidth="3" />
          <g stroke="#c9a85f" strokeWidth="2" fill="none">
            <path d="M58 54 L100 16" />
            <path d="M80 58 L100 12" />
            <path d="M120 58 L100 12" />
            <path d="M142 54 L100 16" />
          </g>
        </g>
      )}
      {accessory === 'crown' && (
        <g stroke="#92400e" strokeWidth="3" strokeLinejoin="round">
          <path d="M66 46 L72 18 L88 34 L100 10 L112 34 L128 18 L134 46 Z" fill="#fbbf24" />
          <circle cx="100" cy="36" r="5" fill={M_RED} />
        </g>
      )}
      {accessory === 'scholar' && (
        <g stroke="#0f172a" strokeWidth="2.5" strokeLinejoin="round">
          <path d="M66 50 C70 24 130 24 134 50 Z" fill="#1f2937" />
          <ellipse cx="54" cy="44" rx="16" ry="6" fill="#1f2937" />
          <ellipse cx="146" cy="44" rx="16" ry="6" fill="#1f2937" />
          <path d="M70 46 h60" stroke="#d97706" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
};

// ============================================================================
// components/brand/BrandLogo
// ============================================================================

interface BrandLogoProps {
  compact?: boolean;
  subtitle?: string;
  className?: string;
  tone?: 'green' | 'white';
}

/** Logo "Đông A": ấn triện son đỏ có Rồng Con, chữ Baloo 2 */
const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, subtitle, className = '', tone = 'green' }) => {
  const light = tone === 'white';
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <span className="brand-seal w-11 h-11 shrink-0" aria-hidden="true">
        <Mascot size={38} mood="happy" accessory="helmet" title="Đông A" />
      </span>
      {!compact && (
        <div className="leading-none">
          <span className={`block font-display text-[24px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-son-chu'}`}>Đông A</span>
          {subtitle && (
            <span className={`block text-[10px] font-bold uppercase tracking-[0.16em] mt-1 ${light ? 'text-white/80' : 'text-muc-2'}`}>{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// components/reactbits/CircularCarousel
// ============================================================================

interface CircularCarouselItem {
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

const CircularCarousel: React.FC<CircularCarouselProps> = ({
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
      className="relative w-full rounded-3xl overflow-hidden kahoot-bg text-white shadow-[0_6px_0_#0b3d3a] select-none"
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
          <div className="w-10 h-10 rounded-xl bg-duo-gold text-[#6b4400] flex items-center justify-center shadow-[0_3px_0_#92400e] font-black">
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
      <div className="relative z-20 px-6 py-4 bg-black/25 border-t-2 border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
              className="btn-3d btn-sm btn-normal-case"
              style={{ ['--btn-bg' as string]: 'rgba(255,255,255,0.14)', ['--btn-shadow' as string]: 'rgba(0,0,0,0.3)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{primaryActionLabel}</span>
            </button>
          )}

          {onSecondaryAction && (
            <button
              type="button"
              onClick={() => onSecondaryAction(activeItem)}
              className="btn-3d btn-gold btn-sm"
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

// ============================================================================
// components/reactbits/dongAHistoryData
// ============================================================================

const DONG_A_CAROUSEL_ITEMS: CircularCarouselItem[] = [
  {
    id: 'tran-hung-dao',
    title: 'Hưng Đạo Đại Vương Trần Quốc Tuấn',
    subtitle: 'Quốc Công Tiết Chế • Linh Hồn Kháng Chiến',
    period: '1285 – 1288',
    badge: 'Danh Tướng Kiệt Xuất',
    description:
      'Tổng chỉ huy quân đội Đại Việt trong kháng chiến lần thứ hai và thứ ba. Tác giả Hịch Tướng Sĩ khích lệ lòng yêu nước và nghệ thuật quân sự lấy đoản binh thắng trường trận.',
    quote: 'Nếu bệ hạ muốn hàng, xin hãy chém đầu thần trước đã!',
    citation: 'SGK Lịch sử 7 (KNTT) - Bài 13, Tr. 68–73',
    image:
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
    accentColor: 'amber',
    promptSuggestion:
      'Vai trò của Trần Quốc Tuấn và ý nghĩa bài Hịch tướng sĩ trong kháng chiến chống quân Mông - Nguyên là gì?',
  },
  {
    id: 'dong-bo-dau-1258',
    title: 'Chiến Thắng Đông Bộ Đầu & Vườn Không Nhà Trống',
    subtitle: 'Kháng Chiến Lần Thứ Nhất',
    period: 'Tháng 1/1258',
    badge: 'Chiến Dịch 1258',
    description:
      'Quân dân nhà Trần chủ động rút khỏi Thăng Long thực hiện kế sách "Vườn không nhà trống", làm quân Mông Cổ thiếu lương thực trầm trọng rồi phản công thắng lợi tại Đông Bộ Đầu.',
    quote: 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo! — Thái sư Trần Thủ Độ',
    citation: 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2a, Tr. 65–66',
    image:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    accentColor: 'emerald',
    promptSuggestion:
      'Vì sao quân Trần chủ động rút khỏi Thăng Long và thực hiện kế sách Vườn không nhà trống năm 1258?',
  },
  {
    id: 'binh-than-quoc-toan-1282',
    title: 'Hội Nghị Bình Than & Lá Cờ Sáu Chữ Vàng',
    subtitle: 'Hoài Văn Hầu Trần Quốc Toản',
    period: 'Năm 1282',
    badge: 'Tuổi Trẻ Đông A',
    description:
      'Vua Trần triệu tập vương hầu, tướng lĩnh tại bến Bình Than bàn kế đánh giặc. Trần Quốc Toản vì tuổi nhỏ không được dự đã bóp nát quả cam, về lập đội quân thêu cờ "Phá cường địch, báo hoàng ân".',
    quote: 'Phá cường địch, báo hoàng ân (Phá giặc mạnh, báo ơn vua)',
    citation: 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2b, Tr. 68',
    image:
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    accentColor: 'rose',
    promptSuggestion:
      'So sánh Hội nghị Bình Than (1282) và Hội nghị Diên Hồng (1285), đồng thời kể về tấm gương Trần Quốc Toản.',
  },
  {
    id: 'dien-hong-1285',
    title: 'Hội Nghị Diên Hồng — Muôn Người Một Lời Hô ĐÁNH',
    subtitle: 'Biểu Tượng Đại Đoàn Kết Dân Tộc',
    period: 'Đầu năm 1285',
    badge: 'Ý Chí Toàn Dân',
    description:
      'Thượng hoàng Trần Thánh Tông triệu tập các bô lão đại diện nhân dân cả nước về kinh thành Thăng Long hỏi kế sách. Muôn người đồng thanh hô vang "ĐÁNH!", củng cố quyết tâm toàn dân tộc.',
    quote: 'Muôn người cùng hô một tiếng ĐÁNH như bật ra từ một cửa miệng!',
    citation: 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2b, Tr. 69',
    image:
      'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80',
    accentColor: 'purple',
    promptSuggestion:
      'Hội nghị Diên Hồng năm 1285 có vai trò và ý nghĩa như thế nào đối với khối đại đoàn kết dân tộc?',
  },
  {
    id: 'chuong-duong-ham-tu-1285',
    title: 'Phản Công Chương Dương Độ – Hàm Tử – Tây Kết',
    subtitle: 'Kháng Chiến Lần Thứ Hai',
    period: 'Tháng 5–6/1285',
    badge: 'Chiến Dịch 1285',
    description:
      'Sau khi rút lui chiến lược bảo toàn lực lượng, quân Trần chớp thời cơ phản công dồn dập tại Tây Kết, Hàm Tử, Chương Dương Độ, giải phóng Thăng Long khiến Thoát Hoan phải chui ống đồng chạy trốn.',
    quote: 'Chương Dương cướp giáo giặc, Hàm Tử bắt quân thù — Trần Quang Khải',
    citation: 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2b, Tr. 69–70',
    image:
      'https://images.unsplash.com/photo-1519074069444-1ba4ea16e66c?auto=format&fit=crop&w=600&q=80',
    accentColor: 'amber',
    promptSuggestion:
      'Sau khi rút khỏi Thăng Long năm 1285, cục diện thay đổi thế nào qua các trận Tây Kết, Hàm Tử, Chương Dương?',
  },
  {
    id: 'van-andon-1287',
    title: 'Chiến Thắng Vân Đồn — Triệt Phá Đoàn Thuyền Lương',
    subtitle: 'Nhân Huệ Vương Trần Khánh Dư',
    period: 'Cuối năm 1287',
    badge: 'Chiến Thuật Hậu Cần',
    description:
      'Phó tướng Trần Khánh Dư chỉ huy quân Trần phục kích tại Vân Đồn, đánh tan đoàn thuyền lương của Trương Văn Hổ, bẻ gãy âm mưu tự túc lương thảo của quân Nguyên trong lần xâm lược thứ ba.',
    quote: 'Đập tan tuyến tiếp tế đường biển, đẩy đại quân Thoát Hoan vào thế cô lập.',
    citation: 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2c, Tr. 71–72',
    image:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    accentColor: 'sky',
    promptSuggestion:
      'Chiến thắng Vân Đồn của Trần Khánh Dư có ý nghĩa chiến lược như thế nào trong cuộc kháng chiến lần thứ ba?',
  },
  {
    id: 'bach-dang-1288',
    title: 'Đại Thắng Bạch Đằng — Bãi Cọc Ngầm Lịch Sử',
    subtitle: 'Đỉnh Cao Nghệ Thuật Thủy Chiến',
    period: 'Tháng 4/1288',
    badge: 'Đại Thắng 1288',
    description:
      'Trần Quốc Tuấn bố trí trận địa cọc gỗ lim bịt sắt trên sông Bạch Đằng, lợi dụng thủy triều lên xuống nhử thủy quân Ô Mã Nhi vào ổ phục kích, bắt sống tướng giặc và kết thúc thắng lợi 3 lần kháng chiến.',
    quote: 'Sông Đằng một dải dài ghê, Sóng hồng cuồn cuộn tuôn về bể Đông.',
    citation: 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2c, Tr. 72–73',
    image:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
    accentColor: 'emerald',
    promptSuggestion:
      'Phân tích diễn biến và nghệ thuật quân sự của trận Bạch Đằng năm 1288.',
  },
];

// ============================================================================
// components/game/KahootShape
// ============================================================================

type AnswerShape = 'triangle' | 'diamond' | 'circle' | 'square';

/** Bảng màu + hình đáp án chuẩn Kahoot (Đỏ ▲, Lam ◆, Vàng ●, Lục ■); fg là màu chữ đạt tương phản trên nền ô */
const ANSWER_STYLES: Array<{
  shape: AnswerShape;
  bg: string;
  shadow: string;
  fg: string;
  label: string;
}> = [
  { shape: 'triangle', bg: '#e21b3c', shadow: '#b0142f', fg: '#ffffff', label: 'Đỏ' },
  { shape: 'diamond', bg: '#1368ce', shadow: '#0e4fa0', fg: '#ffffff', label: 'Lam' },
  { shape: 'circle', bg: '#d89e00', shadow: '#a87b00', fg: '#1f1600', label: 'Vàng' },
  { shape: 'square', bg: '#26890c', shadow: '#1c6609', fg: '#ffffff', label: 'Lục' },
];

const KahootShape: React.FC<{ shape: AnswerShape; size?: number; color?: string; className?: string }> = ({
  shape,
  size = 28,
  color = '#fff',
  className = '',
}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
    {shape === 'triangle' && <path d="M16 4 L29 27 H3 Z" fill={color} />}
    {shape === 'diamond' && <path d="M16 2 L30 16 L16 30 L2 16 Z" fill={color} />}
    {shape === 'circle' && <circle cx="16" cy="16" r="13" fill={color} />}
    {shape === 'square' && <rect x="4" y="4" width="24" height="24" rx="2" fill={color} />}
  </svg>
);

/** Bốn ô màu thu nhỏ – dùng làm biểu tượng Quiz */
const KahootMiniGrid: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <div className={`grid grid-cols-2 gap-[2px] shrink-0 ${className}`} style={{ width: size, height: size }}>
    {ANSWER_STYLES.map((s) => (
      <div key={s.shape} className="rounded-[3px]" style={{ background: s.bg }} />
    ))}
  </div>
);

/** Hiệu ứng pháo giấy khi chiến thắng */
const CONFETTI_COLORS = ['#0f766e', '#0369a1', '#d97706', '#b91c1c', '#7e22ce', '#c2410c', '#ffb6cf'];

/** Giả ngẫu nhiên tất định (0..1) theo hạt giống */
const seeded = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const Confetti: React.FC<{ count?: number }> = ({ count = 70 }) => {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: seeded(i + 1) * 100,
        delay: seeded(i + 101) * 1.6,
        duration: 2.4 + seeded(i + 201) * 2.2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + seeded(i + 301) * 8,
        round: seeded(i + 401) > 0.6,
      })),
    [count]
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.round ? '999px' : '2px',
            animation: `confettiFall ${p.duration}s linear ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  );
};

// ============================================================================
// config/api
// ============================================================================

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/+$/, '');

// ============================================================================
// auth/api – gọi API đăng nhập & quản trị
// ============================================================================

type AuthRole = 'admin' | 'teacher' | 'student';

interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: AuthRole;
  class_name: string | null;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

/** Tài khoản kèm tiến độ học tập (trang quản trị) */
interface AdminUser extends AuthUser {
  xp?: number | null;
  streak?: number | null;
  lessons_completed?: number | null;
  accuracy?: number | null;
}

interface AccountCredential {
  user: AuthUser;
  password: string;
}

interface AdminStats {
  teachers: number;
  students: number;
  admins: number;
  active: number;
  pending_first_login: number;
  classes: string[];
  storage: 'postgres' | 'sqlite';
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const readToken = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const saveToken = (key: string, token: string | null) => {
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch {
    // Trình duyệt chặn lưu trữ: phiên chỉ tồn tại tới khi tải lại trang
  }
};

async function apiRequest<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? 'Dữ liệu chưa hợp lệ: ' + detail.map((d: { msg?: string }) => d.msg).join('; ')
        : `Lỗi máy chủ (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

// ============================================================================
// live/socket – phòng thi đấu cả lớp thời gian thực (WebSocket /api/live/ws)
// ============================================================================

const LIVE_WS_URL = `${API_BASE_URL.replace(/^http/i, 'ws')}/api/live/ws`;

type LivePhase = 'lobby' | 'question' | 'reveal' | 'scoreboard' | 'podium';
type LiveKey = number | boolean | string;
/** replaced: phòng đang mở ở tab/thiết bị khác; expired: phiên đăng nhập hết hạn */
type LiveStatus = 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'expired';

interface LiveOption {
  key: LiveKey;
  text: string;
}

interface LiveQuestion {
  id: string;
  type: 'mcq' | 'tf';
  prompt: string;
  topic: string;
  options: LiveOption[];
}

interface LiveBase {
  pin: string;
  title: string;
  phase: LivePhase;
  index: number;
  total: number;
  duration_ms: number;
  remaining_ms: number;
  question: LiveQuestion | null;
}

interface LiveHostPlayer {
  id: number;
  name: string;
  score: number;
  streak: number;
  correct: number;
  connected: boolean;
  answered: boolean;
  last_gain: number;
  last_correct: boolean | null;
}

interface LiveHostRoom extends LiveBase {
  scope: string;
  class_name: string;
  locked: boolean;
  answered: number;
  players: LiveHostPlayer[];
  reveal: { key: LiveKey; counts: number[]; explanation: string; source?: string | null } | null;
  saved: boolean;
  session_id: number | null;
}

interface LivePlayerState extends LiveBase {
  players: number;
  host_online: boolean;
  me: {
    name: string;
    score: number;
    rank: number;
    streak: number;
    correct: number;
    answered_total: number;
    answered: boolean;
    choice: LiveKey | null;
    last_gain: number;
    last_correct: boolean | null;
  };
  reveal: { key: LiveKey; explanation: string } | null;
  top: Array<{ name: string; score: number }>;
}

type LiveServerMsg =
  | { type: 'room'; room: LiveHostRoom | null; closed?: string }
  | { type: 'state'; state: LivePlayerState | null }
  | { type: 'error'; code: string; message: string }
  | { type: 'kicked' }
  | { type: 'replaced' }
  | { type: 'closed'; reason: string }
  | { type: 'saved'; session_id: number | null }
  | { type: 'pong' };

/** Phạm vi câu hỏi khi mở phòng (khớp SCOPE_CATEGORIES ở backend/app/api/live.py) */
const LIVE_SCOPES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Cả bài' },
  { id: '1258', label: 'Lần 1 (1258)' },
  { id: '1285', label: 'Lần 2 (1285)' },
  { id: '1288', label: 'Lần 3 (1287–1288)' },
];

/** So khớp khóa đáp án kể cả kiểu (true khác 1) – giống cách server chấm */
const sameLiveKey = (a: LiveKey | null | undefined, b: LiveKey | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined && typeof a === typeof b && a === b;

const formatPin = (pin: string) => (pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin);

/**
 * Kết nối WebSocket phòng thi đấu. Token gửi trong tin nhắn đầu tiên (không đặt trên URL để không lộ trong log);
 * mất mạng thì tự nối lại – server gắn lại đúng phòng đang chơi; ping 25 giây/lần để giữ kết nối.
 */
const useLiveSocket = (token: string, onMessage: (msg: LiveServerMsg, send: (msg: Record<string, unknown>) => boolean) => void) => {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [generation, setGeneration] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  });

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let retry = 0;
    let ping = 0;
    const schedule = () => {
      attempt += 1;
      setStatus('reconnecting');
      retry = window.setTimeout(connect, Math.min(10_000, 700 * 2 ** Math.min(attempt, 4)));
    };
    const connect = () => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(LIVE_WS_URL);
      } catch {
        schedule();
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
      ws.onmessage = (ev) => {
        let msg: LiveServerMsg;
        try {
          msg = JSON.parse(String(ev.data)) as LiveServerMsg;
        } catch {
          return;
        }
        if (msg.type === 'pong') return;
        if (msg.type === 'room' || msg.type === 'state') {
          attempt = 0;
          setStatus('open');
        }
        handler.current(msg, send);
      };
      ws.onclose = (ev) => {
        window.clearInterval(ping);
        if (wsRef.current === ws) wsRef.current = null;
        if (stopped) return;
        if (ev.code === 4000) setStatus('replaced');
        else if (ev.code === 4401 || ev.code === 4403) setStatus('expired');
        else schedule();
      };
      ping = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}');
      }, 25_000);
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      window.clearInterval(ping);
      wsRef.current?.close(1000);
      wsRef.current = null;
    };
  }, [token, generation, send]);

  const reconnect = useCallback(() => {
    setStatus('connecting');
    setGeneration((g) => g + 1);
  }, []);
  return { status, send, reconnect };
};

/**
 * Đếm ngược theo số mili giây còn lại server báo. `start(ms)` gọi ngay khi nhận tin nhắn,
 * nên mốc "bây giờ" luôn là lúc nhận (không lệch theo lúc mở màn hình); `start(null)` dừng đếm.
 */
const useCountdown = () => {
  const [clock, setClock] = useState<{ end: number; now: number } | null>(null);
  const end = clock?.end ?? null;
  useEffect(() => {
    if (end === null) return;
    const t = window.setInterval(() => setClock((c) => (c ? { ...c, now: Date.now() } : c)), 250);
    return () => window.clearInterval(t);
  }, [end]);
  const start = useCallback((remainingMs: number | null) => {
    const now = Date.now();
    setClock(remainingMs === null ? null : { end: now + remainingMs, now });
  }, []);
  const seconds = clock ? Math.max(0, Math.ceil((clock.end - clock.now) / 1000)) : 0;
  return [seconds, start] as const;
};

/** Đồng hồ câu hỏi: hiện số giây; trình đọc màn hình chỉ được báo ở mốc 10 giây, 5 giây và khi hết giờ */
const LiveTimer: React.FC<{ seconds: number; total: number; size?: number; className?: string; light?: boolean }> = ({
  seconds,
  total,
  size = 96,
  className = '',
  light = false,
}) => {
  const ratio = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const urgent = seconds <= 5;
  const announce = seconds === 0 ? 'Hết giờ' : seconds === 5 || seconds === 10 ? `Còn ${seconds} giây` : '';
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={light ? 'rgba(255,255,255,0.22)' : 'var(--color-vien)'} strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={urgent ? '#e21b3c' : light ? '#ffffff' : 'var(--color-ngoc)'}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 250ms linear' }}
        />
      </svg>
      <span
        role="timer"
        aria-label={`Còn ${seconds} giây`}
        className={`absolute inset-0 flex items-center justify-center font-black tabular ${urgent ? 'text-[#e21b3c]' : ''}`}
        style={{ fontSize: size * 0.36 }}
      >
        {seconds}
      </span>
      <span className="sr-only" role="status" aria-atomic="true">
        {announce}
      </span>
    </div>
  );
};

const ROLE_LABEL: Record<AuthRole, string> = { admin: 'Quản trị viên', teacher: 'Giáo viên', student: 'Học sinh' };
const ROLE_CHIP: Record<AuthRole, string> = {
  admin: 'bg-duo-gold-light text-duo-gold-dark',
  teacher: 'bg-duo-purple-light text-kh-purple',
  student: 'bg-duo-green-light text-duo-green-dark',
};

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[parts.length - 1]?.[0] ?? '') + (parts.length > 1 ? parts[0][0] : '')).toUpperCase();
};

const avatarColor = (seed: string) => {
  const colors = ['#b91c1c', '#0369a1', '#d97706', '#0f766e', '#7e22ce', '#c2410c', '#b91c1c', '#2b70c9'];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
};

const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// ============================================================================
// data/learning – dữ liệu học tập thật lấy từ backend
// ============================================================================

interface LearnerProgress {
  xp: number;
  week_xp: number;
  gems: number;
  streak: number;
  freeze_available: boolean;
  lessons_completed: number;
  perfect_runs: number;
  questions_answered: number;
  questions_correct: number;
  accuracy: number | null;
  ai_questions: number;
  day_xp: number;
  day_lessons: number;
  day_correct: number;
  day_ai_questions: number;
  day_gems: number;
  daily_gem_cap: number;
  class_name: string | null;
  class_rank: number;
  class_size: number;
}

interface LeaderboardEntry {
  id: number;
  full_name: string;
  xp: number;
  week_xp: number;
  streak: number;
  is_me: boolean;
}

interface RosterStudent {
  id: number;
  full_name: string;
  username: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  xp: number;
  week_xp: number;
  streak: number;
  lessons_completed: number;
  perfect_runs: number;
  questions_answered: number;
  accuracy: number | null;
  avg_mastery: number | null;
  ai_questions: number;
  /** Số sao của 3 màn chiến dịch (mỗi màn tối đa 9 sao) */
  campaign_stars: number[];
  stars: number;
  heroes: number;
}

interface ClassSummary {
  total: number;
  active_7d: number;
  practiced: number;
  avg_accuracy: number | null;
  best_streak: number;
  total_stars: number;
  avg_mastery: number | null;
}

interface WrongQuestion {
  question_id: string;
  prompt: string;
  unit_id: string;
  topic: string;
  attempts: number;
  wrong: number;
  students: number;
}

interface UnitMastery {
  unit_id: string;
  topic: string;
  avg_p_l: number;
  students: number;
}

interface SupportNeed {
  id: number;
  full_name: string;
  reasons: string[];
}

interface TeacherClass {
  class_name: string | null;
  students: RosterStudent[];
  summary: ClassSummary;
  top_wrong: WrongQuestion[];
  unit_mastery: UnitMastery[];
  needs_support: SupportNeed[];
}

/** Tỷ lệ 0..1 -> "85%" (chưa có dữ liệu -> "—") */
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);

/** "Nguyễn Văn Long" -> "Văn Long" */
const shortName = (n: string) => n.trim().split(/\s+/).slice(-2).join(' ');

// ============================================================================
// data/quizGameData
// ============================================================================

/** Bỏ tiền tố "A. ", "B. "... khỏi đáp án để hiển thị trên ô màu Kahoot */
const stripOptionPrefix = (text: string) => text.replace(/^[A-D][.)]\s*/, '');


// ============================================================================
// types/quest
// ============================================================================

type SubmissionStatus = 'early' | 'on_time' | 'late' | 'not_submitted';
type OutcomeStatus = 'passed' | 'failed' | 'pending';
type ObjectiveType = 'start' | 'checkpoint' | 'quiz' | 'story' | 'boss';

interface StudentProgress {
  studentId: string;
  studentName: string;
  avatar?: string;
  status: SubmissionStatus;
  feedback?: string;
  outcome: OutcomeStatus;
  submittedAt?: string;
}

interface QuestObjective {
  id: string;
  title: string;
  shortDescription?: string;
  type: ObjectiveType;
  coords: { x: number; y: number }; // Percentage 0 - 100
  connections: string[]; // IDs of next connected objectives
  rewards: { xp: number; gp: number };
  earlyRewards?: { xp: number; gp: number };
  nextObjectiveId?: string;
  failObjectiveId?: string;
  dueDate: string;
  earlyDueDate?: string;
  storyContent: string;
  taskContent: string;
  enableAssignments: boolean;
  enableEarlyReward: boolean;
  allowDiscussion: boolean;
  selfPaced: boolean;
  studentsProgress: StudentProgress[];
}

interface Quest {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coords: { x: number; y: number }; // Coords on world map (0 - 100%)
  status: 'active' | 'completed' | 'locked';
  totalStudents: number;
  objectives: QuestObjective[];
}

// ============================================================================
// data/questMockData
// ============================================================================

const initialStudentsProgress: StudentProgress[] = [
  {
    studentId: 'st-1',
    studentName: 'Nguyễn Văn Long',
    status: 'on_time',
    outcome: 'passed',
    feedback: 'Đã giải thích xuất sắc kế sách cọc ngầm sông Bạch Đằng kết hợp quy luật thủy triều.',
    submittedAt: '2026-10-08 14:20',
  },
  {
    studentId: 'st-2',
    studentName: 'Lê Hoàng Nam',
    status: 'late',
    outcome: 'failed',
    feedback: 'Cần bổ sung phần phân tích sơ đồ chiến thuật trận Tây Kết - Hàm Tử trước ngày 12/10.',
    submittedAt: '2026-10-09 09:15',
  },
  {
    studentId: 'st-3',
    studentName: 'Trần Thị Mai',
    status: 'early',
    outcome: 'passed',
    feedback: 'Bài làm xuất sắc! Lập luận sâu sắc về tinh thần đoàn kết toàn dân tại Hội nghị Diên Hồng.',
    submittedAt: '2026-10-07 16:45',
  },
  {
    studentId: 'st-4',
    studentName: 'Đặng Thảo Vy',
    status: 'early',
    outcome: 'passed',
    feedback: 'Nộp bài rất sớm, trình bày lưu loát ý nghĩa lời hịch của Trần Hưng Đạo.',
    submittedAt: '2026-10-07 18:10',
  },
  {
    studentId: 'st-5',
    studentName: 'Phạm Minh Quân',
    status: 'on_time',
    outcome: 'passed',
    feedback: 'Đạt yêu cầu, đã chỉ rõ vai trò của trận phục kích tiêu diệt đoàn thuyền lương Trương Văn Hổ.',
    submittedAt: '2026-10-08 15:30',
  },
  {
    studentId: 'st-6',
    studentName: 'Vũ Đức Trí',
    status: 'early',
    outcome: 'passed',
    submittedAt: '2026-10-07 20:00',
  },
  {
    studentId: 'st-7',
    studentName: 'Hoàng Thu Hà',
    status: 'on_time',
    outcome: 'pending',
    submittedAt: '2026-10-08 21:00',
  },
  {
    studentId: 'st-8',
    studentName: 'Đỗ Gia Huy',
    status: 'late',
    outcome: 'pending',
    feedback: 'Nộp bài muộn do cần rà soát lại mốc thời gian năm 1285 và 1288.',
    submittedAt: '2026-10-09 11:30',
  },
  {
    studentId: 'st-9',
    studentName: 'Bùi Phương Linh',
    status: 'early',
    outcome: 'passed',
    submittedAt: '2026-10-07 15:20',
  },
  {
    studentId: 'st-10',
    studentName: 'Nguyễn Quốc Bảo',
    status: 'on_time',
    outcome: 'passed',
    submittedAt: '2026-10-08 11:15',
  },
];

const questObjectivesData: QuestObjective[] = [
  {
    id: 'obj-1',
    title: '1. Lời thề Sát Thát & Bối cảnh năm 1258',
    shortDescription: 'Khởi đầu cuộc kháng chiến chống vó ngựa Mông Cổ',
    type: 'start',
    coords: { x: 16, y: 72 },
    connections: ['obj-2'],
    rewards: { xp: 100, gp: 20 },
    earlyRewards: { xp: 150, gp: 40 },
    nextObjectiveId: 'obj-2',
    dueDate: '2026-10-15 16:00',
    earlyDueDate: '2026-10-12 16:00',
    storyContent:
      'Vào giữa thế kỷ XIII, đế quốc Mông Cổ bành trướng hung hãn khắp lục địa Á - Âu. Đạo quân thiết kỵ khét tiếng của Ngột Lương Hợp Thai tiến sát biên cương Đại Việt. Vua tôi nhà Trần cùng muôn dân chung một ý chí quật cường, binh sĩ khắc hai chữ "Sát Thát" lên cánh tay, quyết tử bảo vệ từng tấc đất thiêng liêng của Tổ quốc!',
    taskContent:
      'Nêu bối cảnh thế giới và Đại Việt trước cuộc kháng chiến chống quân Mông Cổ lần thứ nhất (1258). Ý nghĩa tinh thần của hai chữ "Sát Thát"?',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-2',
    title: '2. Trận Bình Lệ Nguyên & Kế sách lui binh',
    shortDescription: 'Tạm lui quân chiến thuật để bảo toàn lực lượng',
    type: 'checkpoint',
    coords: { x: 23, y: 67 },
    connections: ['obj-3'],
    rewards: { xp: 40, gp: 15 },
    earlyRewards: { xp: 80, gp: 30 },
    nextObjectiveId: 'obj-3',
    dueDate: '2026-10-16 16:00',
    earlyDueDate: '2026-10-13 16:00',
    storyContent:
      'Tháng 1/1258, quân Mông Cổ tràn vào phòng tuyến Bình Lệ Nguyên (Vĩnh Phúc). Vua Trần Thái Tông trực tiếp ngự giá đốc chiến. Nhận thấy thế giặc hung hãn ban đầu, Thái sư Trần Thủ Độ khuyên vua lui quân chiến thuật xuôi dòng sông Đáy về Thiên Mạc nhằm bảo toàn tuyệt đối lực lượng chủ lực.',
    taskContent:
      'Phân tích vì sao vua Trần Thái Tông quyết định chủ động rút lui khỏi phòng tuyến Bình Lệ Nguyên thay vì cố thủ ăn thua với giặc?',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-3',
    title: '3. "Vườn không nhà trống" tại Thăng Long',
    shortDescription: 'Kinh thành không bóng người, giặc lâm cảnh kiệt quệ',
    type: 'story',
    coords: { x: 38, y: 56 },
    connections: ['obj-4'],
    rewards: { xp: 50, gp: 20 },
    earlyRewards: { xp: 90, gp: 35 },
    nextObjectiveId: 'obj-4',
    dueDate: '2026-10-18 16:00',
    earlyDueDate: '2026-10-15 16:00',
    storyContent:
      'Quân dân Thăng Long thi hành triệt để kế sách "Vườn không nhà trống". Toàn bộ người và lương thảo được sơ tán an toàn. Quân Mông Cổ chiếm được một kinh đô hoang tàn, không kiếm đâu ra một hạt thóc hay ngọn cỏ cho ngựa. Dưới cái lạnh giá và thiếu thốn cùng cực, sĩ khí giặc suy sụp từng ngày.',
    taskContent:
      'Nêu tác dụng chiến lược then chốt của kế sách "Vườn không nhà trống" đối với một đội quân viễn chinh xa hậu phương như Mông Cổ.',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-4',
    title: '4. Đại thắng Đông Bộ Đầu (1/1258)',
    shortDescription: 'Cuộc phản công chớp nhoáng đuổi giặc khỏi kinh đô',
    type: 'quiz',
    coords: { x: 44, y: 48 },
    connections: ['obj-5'],
    rewards: { xp: 60, gp: 30 },
    earlyRewards: { xp: 100, gp: 50 },
    nextObjectiveId: 'obj-5',
    dueDate: '2026-10-20 16:00',
    storyContent:
      'Nắm bắt thời cơ giặc đói khát và kiệt sức, đêm 28 rạng sáng 29/1/1258, vua tôi nhà Trần ngược dòng sông Hồng mở cuộc tập kích thần tốc vào căn cứ Đông Bộ Đầu (bến sông gần cầu Long Biên ngày nay). Quân Mông Cổ tan rã kinh hoàng, tháo chạy tán loạn qua ngả Quy Hóa về nước!',
    taskContent:
      'Vượt qua bài trắc nghiệm nhanh 5 câu hỏi về diễn biến và nguyên nhân thắng lợi của cuộc kháng chiến lần thứ nhất (1258).',
    enableAssignments: true,
    enableEarlyReward: false,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-5',
    title: '5. Hội nghị Bình Than & Trần Quốc Toản (1282)',
    shortDescription: 'Khí phách tuổi trẻ - Cờ thêu 6 chữ vàng oanh liệt',
    type: 'checkpoint',
    coords: { x: 50, y: 44 },
    connections: ['obj-6'],
    rewards: { xp: 55, gp: 25 },
    earlyRewards: { xp: 95, gp: 40 },
    nextObjectiveId: 'obj-6',
    dueDate: '2026-10-22 16:00',
    earlyDueDate: '2026-10-18 16:00',
    storyContent:
      'Năm 1282, trước nguy cơ giặc Nguyên xâm lược lần hai, vua Trần Nhân Tông triệu tập hội nghị Bình Than bàn kế sách đánh giặc. Người thiếu niên Trần Quốc Toản vì chưa đủ tuổi dự họp, căm uất giặc bạo tàn đã vô tình bóp nát quả cam vua ban. Chàng về chiêu mộ hơn một nghìn gia nô thêu lá cờ "Phá cường địch, báo hoàng ân" lẫm liệt xông pha.',
    taskContent:
      'Giải câu đố lịch sử: Phân tích biểu tượng quả cam vua ban và tấm lòng yêu nước bất khuất của người anh hùng trẻ tuổi Trần Quốc Toản.',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-6',
    title: '6. Hịch tướng sĩ của Tiết chế Hưng Đạo Vương (1284)',
    shortDescription: 'Áng thiên cổ hùng văn thức tỉnh lòng yêu nước ba quân',
    type: 'story',
    coords: { x: 58, y: 42 },
    connections: ['obj-7'],
    rewards: { xp: 50, gp: 20 },
    nextObjectiveId: 'obj-7',
    dueDate: '2026-10-24 16:00',
    storyContent:
      'Tiết chế Quốc công Trần Quốc Tuấn soạn Hịch tướng sĩ: "Ta thường tới bữa quên ăn, nửa đêm vỗ gối, ruột đau như cắt, nước mắt đầm đìa... dẫu cho trăm thân này phơi ngoài nội cỏ, nghìn xác này gói trong da ngựa, ta cũng vui lòng!". Lời văn rực lửa lay động hàng vạn con tim, thề quyết tử chống giặc Nguyên.',
    taskContent:
      'Đọc đoạn trích Hịch tướng sĩ và nêu cảm nhận về trách nhiệm của vị chủ soái đối với vận mệnh non sông.',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-7',
    title: '7. Hội nghị Diên Hồng - Tiếng hô "ĐÁNH!" (1285)',
    shortDescription: 'Ý chí toàn dân - Muôn người đồng lòng một tiếng hô',
    type: 'quiz',
    coords: { x: 62, y: 49 },
    connections: ['obj-8'],
    rewards: { xp: 70, gp: 35 },
    earlyRewards: { xp: 110, gp: 55 },
    nextObjectiveId: 'obj-8',
    dueDate: '2026-10-26 16:00',
    storyContent:
      'Đầu năm 1285, Thượng hoàng Trần Thánh Tông triệu tập các bậc phụ lão cả nước về điện Diên Hồng hỏi kế: "Nên hòa hay nên đánh?". Muôn người như một, các bô lão vung tay đồng thanh thét vang: "ĐÁNH!". Tiếng hô Diên Hồng làm rung chuyển trời đất, biểu thị sức mạnh đại đoàn kết toàn dân tộc.',
    taskContent:
      'Vì sao triều đình nhà Trần lại hỏi ý kiến các bô lão thay vì chỉ hội đàm nội bộ triều đình? Rút ra bài học về lòng dân.',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-8',
    title: '8. Phòng tuyến Vạn Kiếp & Giặc vượt biên',
    shortDescription: 'Thoát Hoan dẫn 50 vạn quân tràn qua biên ải',
    type: 'checkpoint',
    coords: { x: 55, y: 32 },
    connections: ['obj-9'],
    rewards: { xp: 45, gp: 20 },
    nextObjectiveId: 'obj-9',
    dueDate: '2026-10-28 16:00',
    storyContent:
      'Tháng 1/1285, Thoát Hoan dẫn 50 vạn quân tràn qua biên ải Lạng Sơn, Toa Đô từ Chiêm Thành đánh bọc lên phía Nam mưu toan tạo thế gọng kìm. Hưng Đạo Vương điềm tĩnh chỉ huy lui quân từng bước, cầm cự bảo toàn triều đình và lực lượng phản công chiến lược.',
    taskContent:
      'Vẽ lại lược đồ mũi tiến công của hai đạo quân Thoát Hoan và Toa Đô mưu toan kẹp Đại Việt vào mùa xuân 1285.',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-9',
    title: '9. Trận Tây Kết - Hàm Tử (Hè 1285)',
    shortDescription: 'Chém tướng Toa Đô, đập tan gọng kìm phía Nam',
    type: 'quiz',
    coords: { x: 68, y: 55 },
    connections: ['obj-10'],
    rewards: { xp: 75, gp: 40 },
    earlyRewards: { xp: 120, gp: 60 },
    nextObjectiveId: 'obj-10',
    dueDate: '2026-10-30 16:00',
    storyContent:
      'Tháng 5/1285, quân Trần phản công rực lửa. Chiêu Văn Vương Trần Nhật Duật đánh tan giặc tại cửa Hàm Tử. Tiếp đó ở Tây Kết, tướng giặc khét tiếng Toa Đô bị chém đầu tại trận, bẻ gãy hoàn toàn gọng kìm phía Nam của đạo quân Nguyên Mông!',
    taskContent:
      'Làm bài kiểm tra 8 câu trắc nghiệm về ý nghĩa bước ngoặt của chiến thắng Hàm Tử - Tây Kết trong chiến dịch hè 1285.',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-10',
    title: '10. Bến Chương Dương cướp giáo giặc (Hè 1285)',
    shortDescription: 'Thái sư Trần Quang Khải giải phóng kinh đô Thăng Long',
    type: 'checkpoint',
    coords: { x: 42, y: 62 },
    connections: ['obj-11'],
    rewards: { xp: 60, gp: 30 },
    nextObjectiveId: 'obj-11',
    dueDate: '2026-11-02 16:00',
    storyContent:
      'Thượng tướng Thái sư Trần Quang Khải cùng các tướng lĩnh chỉ huy thủy binh tập kích dữ dội bến Chương Dương (Hà Nội), mở đường giải phóng Thăng Long. Thoát Hoan kinh hãi phải chui vào ống đồng để quân lính khiêng chạy trốn về phương Bắc. Khúc khải hoàn ca vang vọng non sông!',
    taskContent:
      'Dịch nghĩa và bình giảng 2 câu thơ bất hủ của Trần Quang Khải: "Đoạt sáo Chương Dương độ / Cầm hồ Hàm Tử quan".',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-11',
    title: '11. Phục kích Vân Đồn - Trần Khánh Dư (1287)',
    shortDescription: 'Tiêu diệt đoàn thuyền lương Trương Văn Hổ',
    type: 'story',
    coords: { x: 74, y: 38 },
    connections: ['obj-12'],
    rewards: { xp: 70, gp: 35 },
    nextObjectiveId: 'obj-12',
    dueDate: '2026-11-05 16:00',
    storyContent:
      'Lần thứ ba (1287), giặc chia 2 đạo thủy bộ. Nhân Huệ Vương Trần Khánh Dư phán đoán thuyền lương đi sau sẽ chậm chạp và mất cảnh giác, liền mai phục tại vịnh biển Vân Đồn, đánh đắm và tịch thu toàn bộ 17 vạn thạch lương của Trương Văn Hổ. Mất lương thực, quân giặc cầm chắc thất bại thảm hại!',
    taskContent:
      'Phân tích tầm nhìn chiến thuật của Trần Khánh Dư khi ví đoàn thuyền lương địch như "thịt trên thớt" mất đi chỗ dựa.',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-12',
    title: '12. Bố trí bãi cọc ngầm Sông Bạch Đằng (1288)',
    shortDescription: 'Trận địa cọc gỗ lim vót nhọn đón thủy triều rút',
    type: 'quiz',
    coords: { x: 78, y: 28 },
    connections: ['obj-13'],
    rewards: { xp: 85, gp: 45 },
    earlyRewards: { xp: 130, gp: 70 },
    nextObjectiveId: 'obj-13',
    dueDate: '2026-11-08 16:00',
    storyContent:
      'Biết Thoát Hoan buộc phải rút thủy quân qua ngả sông Bạch Đằng, Hưng Đạo Vương cho đẵn gỗ lim vót nhọn cắm ngầm dưới lòng sông, tính toán chuẩn xác con nước thủy triều. Nhử đoàn thuyền chiến của Ô Mã Nhi và Phàn Tiếp vượt qua bãi cọc lúc triều dâng rồi chặn đường rút!',
    taskContent:
      'Giải thích nguyên lý hoạt động của bãi cọc ngầm Bạch Đằng kết hợp quy luật thủy triều lên xuống tự nhiên.',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
  {
    id: 'obj-13',
    title: '13. ĐẠI THẮNG BẠCH ĐẰNG GIANG (4/1288)',
    shortDescription: 'Bắt sống Ô Mã Nhi, vĩnh viễn quét sạch bóng giặc Nguyên',
    type: 'boss',
    coords: { x: 86, y: 18 },
    connections: [],
    rewards: { xp: 250, gp: 100 },
    earlyRewards: { xp: 350, gp: 150 },
    dueDate: '2026-11-10 16:00',
    earlyDueDate: '2026-11-08 16:00',
    storyContent:
      'Sáng ngày 9/4/1288, khi triều rút mạnh, thuyền giặc xô vào cọc nhọn vỡ nát, bốc cháy ngùn ngụt giữa sông. Quân Đại Việt từ khắp các ngả rạch đồng loạt lao ra xung phong vang trời lở đất. Hơn 400 chiến thuyền giặc bị tiêu diệt, bắt sống Ô Mã Nhi và Phàn Tiếp! Ba lần đại thắng giặc Nguyên Mông, non sông nghìn thu vững bền!',
    taskContent:
      'Nhận Huy hiệu Vinh quang "Đại tướng Sử học Đông A", tải Giấy chứng nhận và hoàn thành bài kiểm tra tổng hợp 15 câu đạt điểm tuyệt đối!',
    enableAssignments: true,
    enableEarlyReward: true,
    allowDiscussion: true,
    selfPaced: true,
    studentsProgress: initialStudentsProgress,
  },
];

const mockQuests: Quest[] = [
  {
    id: 'quest-bach-dang',
    title: 'Ba Lần Kháng Chiến Chống Quân Mông - Nguyên (1258 - 1288)',
    subtitle: 'Đại thắng Đông Bộ Đầu, Hàm Tử, Chương Dương & Bạch Đằng Giang',
    description:
      'Hành trình 13 ải lịch sử hào hùng tái hiện khí phách quật cường của quân dân nhà Trần với tinh thần Sát Thát và mưu trí cọc ngầm Bạch Đằng.',
    coords: { x: 42, y: 55 },
    status: 'active',
    totalStudents: 35,
    objectives: questObjectivesData,
  },
  {
    id: 'quest-dien-hong',
    title: 'Chiến dịch Mùa Hè 1285: Tiếng Hô Diên Hồng & Bến Chương Dương',
    subtitle: 'Đập tan 50 vạn quân Thoát Hoan',
    description:
      'Khám phá hội nghị Diên Hồng lịch sử, lá cờ 6 chữ vàng của Trần Quốc Toản và trận phản công rực lửa bến Chương Dương.',
    coords: { x: 65, y: 45 },
    status: 'active',
    totalStudents: 35,
    objectives: questObjectivesData.slice(4, 10),
  },
];

// ============================================================================
// components/QuestObjectiveModal
// ============================================================================

interface QuestObjectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  questTitle: string;
  objectives: QuestObjective[];
  currentObjectiveId: string;
  onSelectObjective: (id: string) => void;
  onUpdateObjective: (updated: QuestObjective) => void;
  onShowToast: (msg: string) => void;
}

const QuestObjectiveModal: React.FC<QuestObjectiveModalProps> = ({
  isOpen,
  onClose,
  questTitle,
  objectives,
  currentObjectiveId,
  onSelectObjective,
  onUpdateObjective,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'story' | 'task' | 'settings'>('overview');
  const [editingFeedbackStudentId, setEditingFeedbackStudentId] = useState<string | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');

  if (!isOpen) return null;

  const currentObj = objectives.find((o) => o.id === currentObjectiveId) || objectives[0];
  if (!currentObj) return null;

  const nextObj = objectives.find((o) => o.id === currentObj.nextObjectiveId);

  // Toggle outcome status for a student
  const handleToggleStudentOutcome = (studentId: string, newOutcome: OutcomeStatus) => {
    const updatedStudents = currentObj.studentsProgress.map((st) => {
      if (st.studentId === studentId) {
        return {
          ...st,
          outcome: st.outcome === newOutcome ? ('pending' as OutcomeStatus) : newOutcome,
        };
      }
      return st;
    });

    onUpdateObjective({
      ...currentObj,
      studentsProgress: updatedStudents,
    });

    const targetStudent = currentObj.studentsProgress.find((s) => s.studentId === studentId);
    if (newOutcome === 'passed') {
      onShowToast(`✅ Đã duyệt hoàn thành ải cho học sinh "${targetStudent?.studentName}" (+${currentObj.rewards.xp} XP)!`);
    } else {
      onShowToast(`⚠️ Đã đánh dấu cần làm lại cho học sinh "${targetStudent?.studentName}".`);
    }
  };

  // Apply outcome to all students
  const handleApplyToAllStudents = (outcome: OutcomeStatus) => {
    const updatedStudents = currentObj.studentsProgress.map((st) => ({
      ...st,
      outcome,
    }));
    onUpdateObjective({
      ...currentObj,
      studentsProgress: updatedStudents,
    });
    onShowToast(`🎯 Đã áp dụng trạng thái "${outcome === 'passed' ? 'Hoàn thành' : 'Chưa đạt'}" cho toàn bộ ${currentObj.studentsProgress.length} học sinh.`);
  };

  // Save student feedback
  const handleSaveFeedback = (studentId: string) => {
    const updatedStudents = currentObj.studentsProgress.map((st) => {
      if (st.studentId === studentId) {
        return {
          ...st,
          feedback: feedbackInput.trim() || undefined,
        };
      }
      return st;
    });
    onUpdateObjective({
      ...currentObj,
      studentsProgress: updatedStudents,
    });
    setEditingFeedbackStudentId(null);
    setFeedbackInput('');
    onShowToast('💬 Đã lưu lời nhận xét cho học sinh.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-7xl h-[92vh] shadow-2xl overflow-hidden flex flex-col zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* Top Header Bar (Khớp ảnh 3, 4, 5) */}
        {/* ======================================================== */}
        <div className="bg-white border-b-2 border-duo-swan px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="chip bg-duo-green-light text-duo-green-dark uppercase">
              Lớp 7A1
            </span>
            <div className="flex items-center gap-1.5 text-xs text-duo-wolf font-medium truncate">
              <span className="font-bold text-[#4b4b4b]">Nhiệm vụ</span>
              <span>/</span>
              <span className="font-semibold text-duo-wolf truncate">{questTitle}</span>
              <span>/</span>
              <span className="font-black text-duo-blue truncate">{currentObj.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-duo-hare hover:text-duo-ink hover:bg-duo-polar transition"
              title="Đóng"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Main Body: 2 Columns (Cột trái Mini-map & Danh sách ải, Cột phải Nội dung) */}
        {/* ======================================================== */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Cột trái (Left Sidebar) */}
          <div className="w-72 sm:w-80 border-r-2 border-duo-swan bg-white flex flex-col shrink-0">
            {/* Mini-map Thumbnail */}
            <div className="p-3 border-b-2 border-duo-swan">
              <div className="relative rounded-xl overflow-hidden border-2 border-duo-swan h-32 bg-slate-900 group">
                <img
                  src={daiVietMapImg}
                  alt="Mini Map Đại Việt"
                  className="w-full h-full object-cover object-center opacity-90 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                {/* Current node pin highlight on mini-map */}
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300"
                  style={{ left: `${currentObj.coords.x}%`, top: `${currentObj.coords.y}%` }}
                >
                  <span className="absolute w-6 h-6 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  <span className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                </div>
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-black text-white/90 drop-shadow-md">
                  <span>Hành trình: 13 ải</span>
                  <span className="bg-emerald-500/80 px-1.5 py-0.5 rounded text-[9px]">
                    Đang ở ải #{objectives.findIndex((o) => o.id === currentObj.id) + 1}
                  </span>
                </div>
              </div>
            </div>

            {/* Danh sách các ải (Objectives List) */}
            <div className="flex-1 overflow-y-auto divide-y divide-duo-swan p-2">
              <div className="px-2 py-1 text-[11px] font-black uppercase tracking-wider text-duo-hare">
                Các chặng thử thách
              </div>
              {objectives.map((obj, index) => {
                const isActive = obj.id === currentObj.id;
                return (
                  <button
                    key={obj.id}
                    onClick={() => {
                      onSelectObjective(obj.id);
                      setEditingFeedbackStudentId(null);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-center gap-3 my-0.5 ${
                      isActive
                        ? 'bg-white text-emerald-800  font-black border-l-4 border-emerald-500'
                        : 'text-duo-wolf hover:bg-duo-polar hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                        isActive
                          ? 'bg-emerald-500 text-white '
                          : 'bg-slate-200 text-duo-wolf'
                      }`}
                    >
                      {obj.type === 'start' ? (
                        <Home className="w-3.5 h-3.5" />
                      ) : obj.type === 'boss' ? (
                        <Flag className="w-3.5 h-3.5" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate leading-snug">
                        {index + 1}. {obj.title}
                      </div>
                      <div className="text-[10px] text-duo-hare font-normal truncate">
                        +{obj.rewards.xp} XP • +{obj.rewards.gp} GP
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cột phải (Right Main Content) */}
          <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
            {/* Title & Tabs Navigation */}
            <div className="border-b-2 border-duo-swan px-8 pt-6 pb-0 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black text-duo-ink tracking-tight">
                    {currentObj.title}
                  </h2>
                  <p className="text-xs text-duo-wolf mt-0.5">
                    {currentObj.shortDescription || 'Mục tiêu thử thách trong cuộc thám hiểm Tháp Pha Lê'}
                  </p>
                </div>
              </div>

              {/* 4 Tabs (OVERVIEW | STORY | TASK | SETTINGS) */}
              <div className="flex items-center gap-8 text-xs font-black select-none">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'overview'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-duo-wolf hover:text-duo-ink'
                  }`}
                >
                  <ListFilter className="w-4 h-4" />
                  <span>TỔNG QUAN (OVERVIEW)</span>
                </button>

                <button
                  onClick={() => setActiveTab('story')}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'story'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-duo-wolf hover:text-duo-ink'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>CÂU CHUYỆN (STORY)</span>
                </button>

                <button
                  onClick={() => setActiveTab('task')}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'task'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-duo-wolf hover:text-duo-ink'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>NHIỆM VỤ (TASK)</span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'settings'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-duo-wolf hover:text-duo-ink'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>CÀI ĐẶT (SETTINGS)</span>
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-8 bg-duo-polar">
              {/* ==================================================== */}
              {/* TAB 1: OVERVIEW (Khớp chuẩn Ảnh 3 & Ảnh 4) */}
              {/* ==================================================== */}
              {activeTab === 'overview' && (
                <div className="space-y-6 max-w-5xl mx-auto">
                  {/* Top Cards: Proceed to Success, Proceed to Failure, Assignments */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Thẻ 1: Proceed to khi thành công */}
                    <div className="bg-white p-4 rounded-2xl border-2 border-duo-swan flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-xs font-black text-duo-ink">
                          Mở ải tiếp theo (Proceed to):
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#4b4b4b] truncate">
                          📍 {nextObj ? nextObj.title : 'Về đích vinh quang'}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border-2 border-amber-200/60 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />+{currentObj.rewards.xp} XP
                          </span>
                          <span className="text-[11px] font-black text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-md border-2 border-yellow-200/60 flex items-center gap-1">
                            <Coins className="w-3 h-3" />+{currentObj.rewards.gp} GP
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Thẻ 2: Proceed to khi chưa đạt */}
                    <div className="bg-white p-4 rounded-2xl border-2 border-duo-swan flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                          <X className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-xs font-black text-duo-ink">
                          Khi chưa đạt (Proceed to):
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-duo-wolf font-medium">
                          Chưa mở khoá ải mới cho đến khi học sinh hoàn thành.
                        </div>
                        <span className="inline-block mt-2 text-[10px] font-bold text-duo-hare bg-slate-100 px-2 py-0.5 rounded">
                          Giữ nguyên vị trí hiện tại
                        </span>
                      </div>
                    </div>

                    {/* Thẻ 3: Assignments Reward */}
                    <div className="bg-white p-4 rounded-2xl border-2 border-duo-swan flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-duo-ink">
                          Thưởng nộp bài (Assignments):
                        </span>
                      </div>
                      <div className="text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-duo-wolf font-medium">Đúng hạn (On Time):</span>
                          <span className="font-black text-[#4b4b4b]">
                            +{currentObj.rewards.xp} XP • +{currentObj.rewards.gp} GP
                          </span>
                        </div>
                        {currentObj.enableEarlyReward && (
                          <div className="flex items-center justify-between text-emerald-700 font-bold">
                            <span>Nộp sớm (Early):</span>
                            <span>
                              +{currentObj.earlyRewards?.xp || 100} XP • +{currentObj.earlyRewards?.gp || 50} GP
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bảng Tiến độ tự học (Self-Paced Progress Table - Khớp ảnh 3 & 4) */}
                  <div className="rounded-2xl border-2 border-blue-500 bg-white overflow-hidden shadow-sm">
                    {/* Blue Ribbon Header */}
                    <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between text-xs font-black">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span>⚡ Tiến độ tự học (Self-Paced Progress)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApplyToAllStudents('passed')}
                          className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-[11px] font-bold transition flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Duyệt đạt cả lớp
                        </button>
                      </div>
                    </div>

                    {/* Action Bar inside table container */}
                    <div className="px-6 py-3 border-b-2 border-duo-swan bg-duo-polar flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-duo-wolf font-medium">
                        <span>Đang theo dõi {currentObj.studentsProgress.length} học sinh</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-bold">
                          {currentObj.studentsProgress.filter((s) => s.outcome === 'passed').length} em đã hoàn thành
                        </span>
                      </div>
                      <button
                        onClick={() => handleApplyToAllStudents('pending')}
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        Đặt lại trạng thái
                      </button>
                    </div>

                    {/* Table Data (Khớp chuẩn cột ảnh 4) */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white border-b-2 border-duo-swan text-duo-hare font-black uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-6 py-3">Họ và tên (NAME)</th>
                            <th className="px-3 py-3 text-center">Nộp sớm (EARLY)</th>
                            <th className="px-3 py-3 text-center">Đúng hạn (ON TIME)</th>
                            <th className="px-3 py-3 text-center">Trễ hạn (LATE)</th>
                            <th className="px-4 py-3 text-center">Nhận xét (FEEDBACK)</th>
                            <th className="px-6 py-3 text-right">Kết quả (OUTCOME)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-duo-swan">
                          {currentObj.studentsProgress.map((student) => {
                            const isPassed = student.outcome === 'passed';
                            const isFailed = student.outcome === 'failed';

                            return (
                              <tr key={student.studentId} className="hover:bg-duo-polar transition">
                                <td className="px-6 py-3.5 font-bold text-duo-ink">
                                  {student.studentName}
                                </td>

                                {/* Early indicator */}
                                <td className="px-3 py-3.5 text-center">
                                  {student.status === 'early' && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                                      ✓
                                    </span>
                                  )}
                                </td>

                                {/* On Time indicator */}
                                <td className="px-3 py-3.5 text-center">
                                  {student.status === 'on_time' && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black">
                                      ✓
                                    </span>
                                  )}
                                </td>

                                {/* Late indicator (Red cross like Toby in screenshot) */}
                                <td className="px-3 py-3.5 text-center">
                                  {student.status === 'late' && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-black">
                                      ✕
                                    </span>
                                  )}
                                </td>

                                {/* Feedback Chat Icon */}
                                <td className="px-4 py-3.5 text-center">
                                  <button
                                    onClick={() => {
                                      setEditingFeedbackStudentId(student.studentId);
                                      setFeedbackInput(student.feedback || '');
                                    }}
                                    className={`p-1.5 rounded-lg transition inline-flex items-center gap-1 ${
                                      student.feedback
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'text-duo-hare hover:text-slate-700 hover:bg-duo-polar'
                                    }`}
                                    title={student.feedback || 'Thêm nhận xét'}
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                    {student.feedback && (
                                      <span className="text-[10px] font-bold max-w-[100px] truncate hidden sm:inline">
                                        {student.feedback}
                                      </span>
                                    )}
                                  </button>
                                </td>

                                {/* Outcome Action Buttons (✓ and ✕) */}
                                <td className="px-6 py-3.5 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    {/* Nút Hoàn thành ✓ */}
                                    <button
                                      onClick={() => handleToggleStudentOutcome(student.studentId, 'passed')}
                                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition ${
                                        isPassed
                                          ? 'bg-emerald-500 border-emerald-500 text-white '
                                          : 'border-duo-swan bg-white text-duo-hare hover:border-emerald-500 hover:text-emerald-500'
                                      }`}
                                      title="Duyệt hoàn thành ải"
                                    >
                                      <Check className="w-4 h-4 stroke-[3]" />
                                    </button>

                                    {/* Nút Chưa đạt ✕ */}
                                    <button
                                      onClick={() => handleToggleStudentOutcome(student.studentId, 'failed')}
                                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition ${
                                        isFailed
                                          ? 'bg-rose-500 border-rose-500 text-white '
                                          : 'border-duo-swan bg-white text-duo-hare hover:border-rose-500 hover:text-rose-500'
                                      }`}
                                      title="Đánh dấu chưa đạt"
                                    >
                                      <X className="w-4 h-4 stroke-[3]" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Modal / Popup nhập nhận xét nhanh cho học sinh */}
                  {editingFeedbackStudentId && (
                    <div className="p-4 bg-white border-2 border-blue-200 rounded-2xl shadow-md animate-in fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-duo-ink">
                          Nhận xét cho học sinh:{' '}
                          <span className="text-blue-600">
                            {currentObj.studentsProgress.find((s) => s.studentId === editingFeedbackStudentId)?.studentName}
                          </span>
                        </span>
                        <button
                          onClick={() => setEditingFeedbackStudentId(null)}
                          className="text-duo-hare hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder="Nhập lời góp ý, động viên học sinh..."
                          className="input-duo flex-1"
                        />
                        <button
                          onClick={() => handleSaveFeedback(editingFeedbackStudentId)}
                          className="px-4 py-2 btn-3d btn-blue btn-normal-case text-xs font-bold rounded-xl transition"
                        >
                          Lưu
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* TAB 2: STORY (Dẫn truyện nhập vai) */}
              {/* ==================================================== */}
              {activeTab === 'story' && (
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl border-2 border-duo-swan space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b-2 border-duo-swan">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-duo-ink">
                        Lời dẫn truyện chặng: {currentObj.title}
                      </h3>
                      <p className="text-xs text-duo-wolf">
                        Học sinh sẽ được đọc nội dung này khi bước chân vào ải thử thách
                      </p>
                    </div>
                  </div>

                  {/* Tranh sơn dầu tư liệu lịch sử Đại chiến Bạch Đằng (Người dùng cung cấp) */}
                  <div className="rounded-2xl overflow-hidden border-2 border-duo-swan shadow-sm">
                    <img
                      src={currentObj.id.includes('12') || currentObj.id.includes('13') ? bachDangImg1 : bachDangImg2}
                      alt="Trận Đại Chiến Bạch Đằng Giang"
                      className="w-full h-56 sm:h-72 object-cover object-center hover:scale-102 transition duration-500"
                    />
                    <div className="bg-slate-900 text-white px-4 py-2.5 text-xs flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <span>⚔️</span>
                        <span>Tư liệu lịch sử: Đại thắng quân Nguyên Mông trên sông Bạch Đằng (1288)</span>
                      </span>
                      <span className="text-amber-400 font-extrabold text-[10px] bg-white/10 px-2 py-0.5 rounded-full">
                        Tranh sơn dầu lịch sử
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50/60 border-2 border-amber-200/80 rounded-2xl p-6 text-sm text-amber-950 leading-relaxed font-serif italic">
                    "{currentObj.storyContent}"
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-[#4b4b4b]">
                      Chỉnh sửa cốt truyện nhập vai:
                    </label>
                    <textarea
                      rows={5}
                      value={currentObj.storyContent}
                      onChange={(e) =>
                        onUpdateObjective({ ...currentObj, storyContent: e.target.value })
                      }
                      className="input-duo w-full"
                      placeholder="Viết lời dẫn nhập vai cho học sinh..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => onShowToast('📖 Đã lưu nội dung dẫn truyện!')}
                      className="px-5 py-2.5 btn-3d btn-green btn-normal-case text-xs font-bold rounded-xl transition"
                    >
                      Lưu cốt truyện
                    </button>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* TAB 3: TASK (Nhiệm vụ & Bài tập) */}
              {/* ==================================================== */}
              {activeTab === 'task' && (
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl border-2 border-duo-swan space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b-2 border-duo-swan">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-duo-ink">
                        Nhiệm vụ học tập cần nộp
                      </h3>
                      <p className="text-xs text-duo-wolf">
                        Yêu cầu bài tập học sinh cần hoàn thành để được duyệt qua ải
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-duo-polar border-2 border-duo-swan rounded-2xl space-y-2">
                    <div className="text-xs font-extrabold text-duo-ink">Yêu cầu hiện tại:</div>
                    <div className="text-xs text-duo-wolf leading-relaxed font-medium">
                      {currentObj.taskContent}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-[#4b4b4b]">
                      Cập nhật nội dung nhiệm vụ:
                    </label>
                    <textarea
                      rows={4}
                      value={currentObj.taskContent}
                      onChange={(e) =>
                        onUpdateObjective({ ...currentObj, taskContent: e.target.value })
                      }
                      className="input-duo w-full"
                      placeholder="Nhập yêu cầu nhiệm vụ hoặc câu hỏi..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => onShowToast('🎯 Đã lưu yêu cầu nhiệm vụ!')}
                      className="px-5 py-2.5 btn-3d btn-blue btn-normal-case text-xs font-bold rounded-xl transition"
                    >
                      Lưu nhiệm vụ
                    </button>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* TAB 4: SETTINGS (Cài đặt chi tiết - Khớp chuẩn Ảnh 5) */}
              {/* ==================================================== */}
              {activeTab === 'settings' && (
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl border-2 border-duo-swan space-y-8">
                  {/* Mục 1: Self-Paced Progress */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentObj.selfPaced}
                        onChange={(e) =>
                          onUpdateObjective({ ...currentObj, selfPaced: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-duo-swan"
                      />
                      <span className="text-sm font-black text-duo-ink flex items-center gap-1.5">
                        ⚡ Tiến độ tự học (Self-Paced Progress)
                      </span>
                    </label>
                    <p className="text-xs text-duo-wolf pl-7">
                      Cho phép học sinh tự động tiến tới ải tiếp theo ngay sau khi hoàn thành bài tập hoặc nhiệm vụ.
                    </p>
                  </div>

                  <hr className="border-duo-swan" />

                  {/* Mục 2: Assignment */}
                  <div className="space-y-5">
                    <div className="text-xs font-black uppercase text-duo-hare tracking-wider">
                      A+ Bài tập (Assignment)
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentObj.enableAssignments}
                          onChange={(e) =>
                            onUpdateObjective({ ...currentObj, enableAssignments: e.target.checked })
                          }
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-duo-swan"
                        />
                        <span className="text-sm font-extrabold text-duo-ink">
                          Bật nộp bài tập (Enable Assignments)
                        </span>
                      </label>
                      <p className="text-xs text-duo-wolf pl-7">
                        Cho phép học sinh nộp sản phẩm bài làm và nhận điểm kinh nghiệm cùng phần thưởng.
                      </p>
                    </div>

                    {/* Due Date & Rewards */}
                    {currentObj.enableAssignments && (
                      <div className="pl-7 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-[#4b4b4b] mb-1">
                              Hạn chót nộp bài (Due Date):
                            </label>
                            <input
                              type="text"
                              value={currentObj.dueDate}
                              onChange={(e) =>
                                onUpdateObjective({ ...currentObj, dueDate: e.target.value })
                              }
                              className="input-duo w-full"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-[#4b4b4b] mb-1">
                              Phần thưởng đúng hạn (Student Reward):
                            </label>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl border-2 border-amber-200">
                                <span className="text-[11px] font-black text-amber-700">XP</span>
                                <input
                                  type="number"
                                  value={currentObj.rewards.xp}
                                  onChange={(e) =>
                                    onUpdateObjective({
                                      ...currentObj,
                                      rewards: { ...currentObj.rewards, xp: Number(e.target.value) },
                                    })
                                  }
                                  className="w-14 text-xs font-bold bg-transparent text-amber-900 outline-none"
                                />
                              </div>

                              <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-xl border-2 border-yellow-200">
                                <span className="text-[11px] font-black text-yellow-700">GP</span>
                                <input
                                  type="number"
                                  value={currentObj.rewards.gp}
                                  onChange={(e) =>
                                    onUpdateObjective({
                                      ...currentObj,
                                      rewards: { ...currentObj.rewards, gp: Number(e.target.value) },
                                    })
                                  }
                                  className="w-14 text-xs font-bold bg-transparent text-yellow-900 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Early Submission Reward */}
                        <div className="pt-2 space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentObj.enableEarlyReward}
                              onChange={(e) =>
                                onUpdateObjective({ ...currentObj, enableEarlyReward: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-duo-swan"
                            />
                            <span className="text-xs font-extrabold text-duo-ink">
                              Bật thưởng nộp sớm (Enable Early Submission Reward)
                            </span>
                          </label>
                          <p className="text-xs text-duo-wolf pl-7">
                            Tặng thêm điểm thưởng đặc biệt cho những học sinh hoàn thành trước hạn quy định.
                          </p>

                          {currentObj.enableEarlyReward && (
                            <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-[#4b4b4b] mb-1">
                                  Hạn chót nộp sớm (Early Due Date):
                                </label>
                                <input
                                  type="text"
                                  value={currentObj.earlyDueDate || '2026-10-12 16:00'}
                                  onChange={(e) =>
                                    onUpdateObjective({ ...currentObj, earlyDueDate: e.target.value })
                                  }
                                  className="input-duo w-full"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-[#4b4b4b] mb-1">
                                  Thưởng nộp sớm (Early Reward):
                                </label>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border-2 border-emerald-200">
                                    <span className="text-[11px] font-black text-emerald-700">XP</span>
                                    <input
                                      type="number"
                                      value={currentObj.earlyRewards?.xp || 100}
                                      onChange={(e) =>
                                        onUpdateObjective({
                                          ...currentObj,
                                          earlyRewards: {
                                            xp: Number(e.target.value),
                                            gp: currentObj.earlyRewards?.gp || 50,
                                          },
                                        })
                                      }
                                      className="w-14 text-xs font-bold bg-transparent text-emerald-900 outline-none"
                                    />
                                  </div>

                                  <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-xl border-2 border-yellow-200">
                                    <span className="text-[11px] font-black text-yellow-700">GP</span>
                                    <input
                                      type="number"
                                      value={currentObj.earlyRewards?.gp || 50}
                                      onChange={(e) =>
                                        onUpdateObjective({
                                          ...currentObj,
                                          earlyRewards: {
                                            xp: currentObj.earlyRewards?.xp || 100,
                                            gp: Number(e.target.value),
                                          },
                                        })
                                      }
                                      className="w-14 text-xs font-bold bg-transparent text-yellow-900 outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <hr className="border-duo-swan" />

                  {/* Mục 3: Discussion */}
                  <div className="space-y-2">
                    <div className="text-xs font-black uppercase text-duo-hare tracking-wider">
                      💬 Thảo luận (Discussion)
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentObj.allowDiscussion}
                        onChange={(e) =>
                          onUpdateObjective({ ...currentObj, allowDiscussion: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-duo-swan"
                      />
                      <span className="text-sm font-extrabold text-duo-ink">
                        Thảo luận lớp học (Class Discussion)
                      </span>
                    </label>
                    <p className="text-xs text-duo-wolf pl-7">
                      Cho phép học sinh trong lớp trao đổi, đặt câu hỏi và bình luận về ải thử thách này.
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => onShowToast('⚙️ Đã cập nhật cài đặt ải thành công!')}
                      className="px-6 py-2.5 btn-3d btn-dark btn-normal-case text-xs font-bold rounded-xl transition"
                    >
                      Lưu tất cả thay đổi
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// views/QuestDetailMapView
// ============================================================================

interface QuestDetailMapViewProps {
  quest: Quest;
  onBackToWorldMap: () => void;
  onShowToast: (msg: string) => void;
}

const QuestDetailMapView: React.FC<QuestDetailMapViewProps> = ({
  quest,
  onBackToWorldMap,
  onShowToast,
}) => {
  const [objectives, setObjectives] = useState<QuestObjective[]>(quest.objectives);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const handleUpdateObjective = (updated: QuestObjective) => {
    setObjectives((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleAddNewObjective = () => {
    const newId = `obj-${objectives.length + 1}`;
    const lastObj = objectives[objectives.length - 1];
    const newObj: QuestObjective = {
      id: newId,
      title: `Chặng thử thách số ${objectives.length + 1}`,
      shortDescription: 'Ải bí mật mới được giáo viên khởi tạo',
      type: 'checkpoint',
      coords: {
        x: Math.min(85, Math.max(20, lastObj ? lastObj.coords.x + 4 : 50)),
        y: Math.min(85, Math.max(15, lastObj ? lastObj.coords.y - 4 : 50)),
      },
      connections: [],
      rewards: { xp: 50, gp: 20 },
      dueDate: '2026-11-15 16:00',
      storyContent: 'Một thử thách mới bất ngờ xuất hiện giữa hành trình...',
      taskContent: 'Hoàn thành bài tập mở rộng để nhận điểm thưởng.',
      enableAssignments: true,
      enableEarlyReward: false,
      allowDiscussion: true,
      selfPaced: true,
      studentsProgress: lastObj ? lastObj.studentsProgress : [],
    };

    setObjectives((prev) => [...prev, newObj]);
    setSelectedObjectiveId(newId);
    onShowToast(`✨ Đã thêm ải mới: "${newObj.title}"!`);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* ======================================================== */}
      {/* 1. Header Bar trên cùng (Khớp chuẩn Ảnh 2) */}
      {/* ======================================================== */}
      <header className="bg-white border-b-2 border-duo-swan px-4 sm:px-6 py-3 flex items-center justify-between z-30 shrink-0">
        {/* Left: Nút quay lại + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToWorldMap}
            className="btn-3d btn-outline btn-sm btn-normal-case !text-duo-wolf"
            title="Quay lại Bản đồ thế giới"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bản đồ thế giới</span>
          </button>

          <span className="text-duo-hare">|</span>

          <span className="chip bg-duo-purple-light text-kh-purple">
            Lớp 7A1
          </span>

          <div className="flex items-center gap-1.5 text-xs text-duo-wolf font-medium truncate">
            <span className="font-semibold text-duo-wolf">Nhiệm vụ (Quêtes)</span>
            <span>/</span>
            <span className="font-black text-duo-ink truncate">{quest.title}</span>
          </div>
        </div>

        {/* Right Action Tools: Add node, Edit, Preview, Students count (Khớp ảnh 2) */}
        <div className="flex items-center gap-2">
          {/* Nút thêm ải mới (+) */}
          <button
            onClick={handleAddNewObjective}
            className="btn-3d btn-green btn-sm btn-icon"
            title="Thêm ải thử thách mới"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Nút Chỉnh sửa (Bút chì) */}
          <button
            onClick={() => onShowToast('✏️ Chế độ chỉnh sửa hành trình đang hoạt động.')}
            className="btn-3d btn-outline btn-sm btn-icon !text-duo-wolf"
            title="Chỉnh sửa lộ trình"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* Nút Xem trước (Con mắt) */}
          <button
            onClick={() => {
              setIsPreviewMode(!isPreviewMode);
              onShowToast(
                !isPreviewMode
                  ? '👁️ Đang xem trước theo góc nhìn của Học sinh.'
                  : '👨‍🏫 Đã trở về góc nhìn Giảng viên điều phối.'
              );
            }}
            className={`btn-3d btn-sm btn-normal-case ${
              isPreviewMode
                ? 'btn-purple'
                : 'btn-outline !text-duo-wolf'
            }`}
            title="Xem trước như học sinh"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isPreviewMode ? 'Góc nhìn Học sinh' : 'Xem trước'}
            </span>
          </button>

          {/* Dropdown Học sinh: (2) hoặc 35 học sinh */}
          <button
            onClick={() => onShowToast(`👥 ${objectives[0]?.studentsProgress.length ?? 0} học sinh đang tham gia cuộc thám hiểm.`)}
            className="btn-3d btn-outline btn-sm btn-normal-case !text-duo-wolf"
          >
            <Users className="w-3.5 h-3.5 text-duo-wolf" />
            <span>({objectives[0]?.studentsProgress.length ?? 0})</span>
            <ChevronDown className="w-3 h-3 text-duo-hare" />
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. Main Canvas: Bản đồ cận cảnh + Đường nối các Ải (Khớp Ảnh 2) */}
      {/* ======================================================== */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-950">
        {/* Background Artwork Đại Việt Campaign Map */}
        <img
          src={daiVietMapImg}
          alt="Sa bàn Chiến dịch Đại Việt"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-95"
        />

        {/* Subtle Map Atmosphere Overlay */}
        <div className="absolute inset-0 bg-radial from-transparent via-transparent to-slate-950/40 pointer-events-none" />

        {/* SVG Path Layer (Vẽ các đường đứt nét nối các ải như ảnh 2) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.95" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Vẽ từng đường nối giữa 2 ải liên tiếp */}
          {objectives.map((obj, i) => {
            const next = objectives[i + 1];
            if (!next) return null;

            return (
              <g key={`path-${obj.id}-${next.id}`}>
                {/* Đường bóng mờ phát sáng */}
                <line
                  x1={`${obj.coords.x}%`}
                  y1={`${obj.coords.y}%`}
                  x2={`${next.coords.x}%`}
                  y2={`${next.coords.y}%`}
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeOpacity="0.3"
                  strokeLinecap="round"
                />
                {/* Đường nối chính màu trắng sáng */}
                <line
                  x1={`${obj.coords.x}%`}
                  y1={`${obj.coords.y}%`}
                  x2={`${next.coords.x}%`}
                  y2={`${next.coords.y}%`}
                  stroke="url(#pathGradient)"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
                {/* Dấu tick nhỏ ở giữa đoạn nối (giống ảnh 2) */}
                <circle
                  cx={`${(obj.coords.x + next.coords.x) / 2}%`}
                  cy={`${(obj.coords.y + next.coords.y) / 2}%`}
                  r="5"
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>

        {/* Các nút ải thử thách (Nodes) trên bản đồ (Khớp chuẩn ảnh 2) */}
        <div className="absolute inset-0 z-20 pointer-events-auto">
          {objectives.map((obj, index) => {
            const isCompleted = index < 4; // Mẫu 4 ải đầu đã hoàn thành
            const isCurrent = index === 4; // Ải đang làm dở
            const isHovered = hoveredNodeId === obj.id;

            return (
              <div
                key={obj.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-all duration-300"
                style={{ left: `${obj.coords.x}%`, top: `${obj.coords.y}%` }}
                onMouseEnter={() => setHoveredNodeId(obj.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => setSelectedObjectiveId(obj.id)}
              >
                {/* Hiệu ứng xung nhịp (Pulse) nếu là ải hiện tại */}
                {isCurrent && (
                  <span className="absolute -inset-3 rounded-full bg-emerald-400 animate-ping opacity-60 pointer-events-none" />
                )}

                {/* Vòng tròn Icon Ải (Khớp chuẩn viền xanh lá & icon trắng như ảnh 2) */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-[2.5px] border-white flex items-center justify-center shadow-xl transition-transform duration-200 group-hover:scale-125 ${
                    obj.type === 'start'
                      ? 'bg-emerald-600 text-white'
                      : obj.type === 'boss'
                      ? 'bg-amber-500 text-white'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#10b981] text-white'
                  }`}
                >
                  {obj.type === 'start' ? (
                    <Home className="w-4 h-4 stroke-[2.5]" />
                  ) : obj.type === 'boss' ? (
                    <Flag className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <MapPin className="w-4 h-4 stroke-[2.5]" />
                  )}
                </div>

                {/* Dấu Checkmark xanh nhỏ gắn góc phải nếu ải đã xong */}
                {isCompleted && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-emerald-600 border-2 border-emerald-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}

                {/* Nhãn tên ải phía dưới nút (Badge hiển thị như ảnh 2) */}
                <div
                  className={`absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black whitespace-nowrap shadow-md transition-all duration-150 pointer-events-none ${
                    isHovered
                      ? 'bg-slate-900 text-white scale-110 z-30'
                      : 'bg-white/95 text-duo-ink border-2 border-duo-swan'
                  }`}
                >
                  <span>{obj.title}</span>
                  {isHovered && (
                    <div className="text-[9px] text-emerald-400 font-bold block">
                      +{obj.rewards.xp} XP • Bấm để quản lý
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Quick Legend ở góc dưới bên trái */}
        <div className="absolute bottom-4 left-4 z-20 bg-slate-950/85 border-2 border-amber-500/40 text-white rounded-2xl p-3.5 shadow-xl text-xs space-y-1.5 max-w-sm hidden sm:block">
          <div className="font-black text-[11px] text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Sa bàn: 3 Lần Kháng Chiến Chống Mông - Nguyên (1258 - 1288)</span>
          </div>
          <div className="text-[11px] text-duo-hare leading-relaxed">
            • 13 ải lịch sử liên hoàn: Lời thề Sát Thát, Vườn không nhà trống, Tiếng hô Diên Hồng, Hàm Tử, Chương Dương & Đại thắng Bạch Đằng.
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold">
            • Bấm trực tiếp vào từng ải để duyệt điểm và quản lý tiến độ học sinh của lớp.
          </div>
        </div>

        {/* Nút toàn màn hình ở góc dưới bên phải */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={() => onShowToast('🔍 Đang bật chế độ toàn màn hình bản đồ.')}
            className="w-9 h-9 rounded-xl bg-white/90 hover:bg-white text-[#4b4b4b] flex items-center justify-center shadow-lg transition"
            title="Toàn màn hình"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Modal Quản lý Chi tiết Ải (Level 3 - Khớp Ảnh 3, 4, 5) */}
      {/* ======================================================== */}
      {selectedObjectiveId && (
        <QuestObjectiveModal
          isOpen={true}
          onClose={() => setSelectedObjectiveId(null)}
          questTitle={quest.title}
          objectives={objectives}
          currentObjectiveId={selectedObjectiveId}
          onSelectObjective={(id) => setSelectedObjectiveId(id)}
          onUpdateObjective={handleUpdateObjective}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};

// ============================================================================
// views/QuestWorldMapView
// ============================================================================

interface QuestWorldMapViewProps {
  onShowToast: (msg: string) => void;
  /** Học sinh thật của lớp – thay cho danh sách mẫu trong bảng duyệt ải */
  roster?: Array<{ id: string; name: string }>;
}

const withRoster = (quest: Quest, roster?: Array<{ id: string; name: string }>): Quest =>
  roster
    ? {
        ...quest,
        totalStudents: roster.length,
        objectives: quest.objectives.map((o) => ({
          ...o,
          studentsProgress: roster.map((r) => ({ studentId: r.id, studentName: r.name, status: 'not_submitted' as const, outcome: 'pending' as const })),
        })),
      }
    : quest;

const QuestWorldMapView: React.FC<QuestWorldMapViewProps> = ({ onShowToast, roster }) => {
  const [quests, setQuests] = useState<Quest[]>(mockQuests);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'active' | 'completed'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // If a quest is clicked, drill down to Level 2: QuestDetailMapView (Ảnh 2)
  if (selectedQuest) {
    return (
      <QuestDetailMapView
        quest={withRoster(selectedQuest, roster)}
        onBackToWorldMap={() => setSelectedQuest(null)}
        onShowToast={onShowToast}
      />
    );
  }

  const filteredQuests = quests.filter((q) => {
    if (filterType === 'all') return true;
    return q.status === filterType;
  });

  const handleCreateNewQuest = () => {
    const newQuest: Quest = {
      id: `quest-${Date.now()}`,
      title: 'Chiến dịch Hàm Tử - Tây Kết (Năm 1285)',
      subtitle: 'Nhiệm vụ Lịch sử 7',
      description: 'Hành trình 8 ải phản công mùa hè năm 1285 đập tan đạo quân Thoát Hoan.',
      coords: { x: 62, y: 52 },
      status: 'active',
      totalStudents: 35,
      objectives: mockQuests[0].objectives.slice(0, 8),
    };

    setQuests((prev) => [...prev, newQuest]);
    onShowToast(`🎉 Đã tạo nhiệm vụ mới: "${newQuest.title}" cắm trên Bản đồ thế giới!`);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* ======================================================== */}
      {/* 1. Header Bar trên cùng (Khớp chuẩn Ảnh 1) */}
      {/* ======================================================== */}
      <header className="bg-white border-b-2 border-duo-swan px-4 sm:px-6 py-3 flex items-center justify-between z-30 shrink-0">
        {/* Left: Logo/Class selector & Breadcrumbs */}
        <div className="flex items-center gap-3">
          {/* Class Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-duo-purple-light cursor-pointer transition text-xs font-black text-kh-purple">
            <span>Lớp 7A1</span>
            <ChevronDown className="w-3 h-3 text-duo-wolf" />
          </div>

          <span className="text-duo-hare">|</span>

          {/* Breadcrumb: Quêtes / Nhiệm vụ */}
          <h1 className="text-lg font-black text-duo-ink tracking-tight">
            Nhiệm vụ (Quêtes)
          </h1>
        </div>

        {/* Right Action Tools: + (Tạo nhiệm vụ), Lọc nhiệm vụ (Khớp ảnh 1) */}
        <div className="flex items-center gap-3">
          {/* Nút Tạo nhiệm vụ mới (+) màu xanh lá */}
          <button
            onClick={handleCreateNewQuest}
            className="btn-3d btn-green btn-sm btn-icon"
            title="Tạo nhiệm vụ mới trên bản đồ"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Dropdown Lọc nhiệm vụ (Filtrer les quêtes) */}
          <div className="relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="btn-3d btn-outline btn-sm btn-normal-case !text-duo-wolf"
            >
              <Filter className="w-3.5 h-3.5 text-duo-wolf" />
              <span>
                {filterType === 'all'
                  ? 'Tất cả nhiệm vụ'
                  : filterType === 'active'
                  ? 'Đang diễn ra'
                  : 'Đã hoàn thành'}
              </span>
              <ChevronDown className="w-3 h-3 text-duo-hare" />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-[0_4px_0_#e7d9bc] border-2 border-duo-swan p-1.5 z-40 text-sm font-bold animate-pop-in">
                <button
                  onClick={() => {
                    setFilterType('all');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl hover:bg-duo-polar ${
                    filterType === 'all' ? 'text-duo-green font-black' : 'text-[#4b4b4b]'
                  }`}
                >
                  Tất cả nhiệm vụ ({quests.length})
                </button>
                <button
                  onClick={() => {
                    setFilterType('active');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl hover:bg-duo-polar ${
                    filterType === 'active' ? 'text-duo-green font-black' : 'text-[#4b4b4b]'
                  }`}
                >
                  Đang diễn ra ({quests.filter((q) => q.status === 'active').length})
                </button>
                <button
                  onClick={() => {
                    setFilterType('completed');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl hover:bg-duo-polar ${
                    filterType === 'completed' ? 'text-duo-green font-black' : 'text-[#4b4b4b]'
                  }`}
                >
                  Đã hoàn thành (0)
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. Main Canvas: Bản đồ thế giới (World Map - Khớp Ảnh 1) */}
      {/* ======================================================== */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center">
        {/* Bản đồ nền nghệ thuật kỳ vĩ (World Map Artwork) */}
        <img
          src={daiVietMapImg}
          alt="Sa bàn Chiến dịch Đại Việt"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-100 transition duration-700"
        />

        {/* Hiệu ứng mây khói / Khí quyển bao quanh */}
        <div className="absolute inset-0 bg-radial from-transparent via-transparent to-slate-950/30 pointer-events-none" />

        {/* Các điểm ghim Nhiệm vụ lớn trên Bản đồ thế giới (Khớp Ảnh 1) */}
        <div className="absolute inset-0 z-20 pointer-events-auto">
          {filteredQuests.map((q) => {
            return (
              <div
                key={q.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-all duration-300"
                style={{ left: `${q.coords.x}%`, top: `${q.coords.y}%` }}
                onClick={() => setSelectedQuest(q)}
              >
                {/* Vòng tròn gợn sóng phát sáng (Glowing Ping Pulse) */}
                <span className="absolute -inset-4 rounded-full bg-duo-green/60 animate-ping opacity-60 pointer-events-none" />


                {/* Biểu tượng Ghim nhiệm vụ màu xanh lá (Khớp chuẩn Ảnh 1) */}
                <div className="relative w-14 h-14 rounded-full bg-duo-green border-4 border-white flex items-center justify-center text-white shadow-[0_6px_0_#134e4a] transition-transform duration-200 group-hover:scale-110 group-active:translate-y-1">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 fill-white text-white drop-shadow-md" />
                  </div>
                </div>

                {/* Nhãn tên nhiệm vụ hình hộp trắng phía dưới (Khớp chuẩn Ảnh 1) */}
                <div className="absolute top-full mt-2.5 left-1/2 -translate-x-1/2 bg-white/95 px-4 py-2 rounded-2xl shadow-xl border-2 border-duo-swan whitespace-nowrap text-center transition-all duration-200 group-hover:scale-110 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-800">
                  <div className="text-xs font-black text-duo-ink group-hover:text-white flex items-center gap-1.5">
                    <span>{q.title}</span>
                  </div>
                  <div className="text-[10px] text-duo-wolf group-hover:text-emerald-300 font-semibold mt-0.5">
                    {q.objectives.length} ải thử thách • Bấm để mở bản đồ
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hướng dẫn thao tác góc dưới bên trái */}
        <div className="absolute bottom-5 left-5 z-20 bg-white text-duo-ink rounded-2xl p-4 shadow-[0_5px_0_rgba(0,0,0,0.25)] text-xs space-y-1 max-w-sm hidden sm:block">
          <div className="font-black text-xs text-duo-green uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            <span>Hệ thống Bản đồ Nhiệm vụ (Quests)</span>
          </div>
          <div className="text-duo-wolf font-bold text-xs leading-relaxed">
            Bấm vào điểm ghim xanh lá <span className="text-duo-green font-black">"{quests[0].title}"</span> để mở Bản đồ hành trình chi tiết 13 ải thử thách của lớp 7A1.
          </div>
        </div>

        {/* Nút Phóng to toàn màn hình góc dưới bên phải */}
        <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2">
          <button
            onClick={() => onShowToast('🔍 Đang bật chế độ toàn cảnh bản đồ.')}
            className="btn-3d btn-white btn-icon !text-duo-wolf"
            title="Toàn màn hình"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// GAME – Hào Khí Đông A (cổng học sinh)
// ============================================================================
// @@GAME-BEGIN@@
// ---------------------------------------------------------------------------
// game/types – kiểu dữ liệu chung của game
// ---------------------------------------------------------------------------

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number; size?: number; 'aria-hidden'?: boolean }>;
type ElementId = 'thuy' | 'moc' | 'tho' | 'hoa' | 'thong';
type Tier = 'hiem' | 'su_thi' | 'huyen_thoai' | 'tiet_che';
type Lore = 'chinh_su' | 'giai_thoai' | 'sang_tao' | 'dan_gian';
type EnemyType = 'ky' | 'bo' | 'thuyen' | 'luong';
type SkillKind =
  | 'strike'
  | 'multi'
  | 'aoe'
  | 'buff_atk'
  | 'self_atk'
  | 'buff_def'
  | 'heal'
  | 'taunt'
  | 'shield'
  | 'fear_immune'
  | 'evade'
  | 'ambush'
  | 'cut_supply'
  | 'stakes'
  | 'debuff'
  | 'ship_hunter';

interface SkillDef {
  name: string;
  desc: string;
  kind: SkillKind;
  power: number;
}

interface StageDef {
  name: string;
  years: string;
  desc: string;
  unit: string;
}

interface HeroDef {
  id: string;
  name: string;
  title: string;
  element: ElementId;
  tier: Tier;
  role: string;
  lore: Lore;
  story: string;
  symbol: IconType;
  join: 'start' | 'story' | 'recipe';
  base: { hp: number; atk: number; def: number; spd: number };
  basic: SkillDef;
  strat: SkillDef;
  ult: SkillDef;
  stages: [StageDef, StageDef, StageDef];
}

type IntentId = 'strike' | 'charge' | 'volley' | 'forage' | 'roar' | 'supply' | 'brace';

interface EnemyDef {
  id: string;
  name: string;
  type: EnemyType;
  boss?: boolean;
  base: { hp: number; atk: number; def: number; spd: number };
  intents: IntentId[];
  note: string;
  defeatText: string;
  fleeAt?: number;
  capture?: boolean;
}

// ---------------------------------------------------------------------------
// game/data – năm hệ quân, nhãn tư liệu, bậc tướng
// ---------------------------------------------------------------------------

const ELEMENTS: Record<ElementId, { name: string; place: string; desc: string; Icon: IconType; fill: string; soft: string; text: string }> = {
  thuy: { name: 'Thủy', place: 'Thủy trại Vạn Kiếp – Bạch Đằng', desc: 'Đánh thuyền, phục kích đường sông', Icon: Droplets, fill: 'bg-thuy', soft: 'bg-thuy-nhat', text: 'text-thuy-chu' },
  moc: { name: 'Mộc', place: 'Mật khu Thiên Trường – Trường Yên', desc: 'Đánh kỵ binh nơi rừng rậm, đầm lầy', Icon: Leaf, fill: 'bg-moc', soft: 'bg-moc-nhat', text: 'text-moc-chu' },
  tho: { name: 'Thổ', place: 'Biên ải Nội Bàng – Chí Linh', desc: 'Thủ chỗ hiểm, chặn đường tiến', Icon: Mountain, fill: 'bg-tho', soft: 'bg-tho-nhat', text: 'text-tho-chu' },
  hoa: { name: 'Hỏa', place: 'Hội thề Bình Than – Diên Hồng', desc: 'Hào khí, tăng sĩ khí cả đội', Icon: Flame, fill: 'bg-hoa', soft: 'bg-hoa-nhat', text: 'text-hoa-chu' },
  thong: { name: 'Thống soái', place: 'Phủ đệ Hưng Đạo Vương', desc: 'Kế sách chiến lược, đổi thế trận', Icon: Crown, fill: 'bg-thong', soft: 'bg-thong-nhat', text: 'text-thong-chu' },
};

const LORE_LABEL: Record<Lore, string> = {
  chinh_su: 'Chính sử',
  giai_thoai: 'Giai thoại – truyền thuyết',
  sang_tao: 'Sáng tạo của game',
  dan_gian: 'Dân gian – cần đối chiếu',
};

const TIER_INFO: Record<Tier, { name: string; stars: number }> = {
  hiem: { name: 'Hiếm', stars: 1 },
  su_thi: { name: 'Sử thi', stars: 2 },
  huyen_thoai: { name: 'Huyền thoại', stars: 3 },
  tiet_che: { name: 'Tiết Chế', stars: 4 },
};

/** Loại quân địch – điểm mạnh, hệ khắc chế và bài học lịch sử */
const ENEMY_TYPES: Record<EnemyType, { name: string; strong: string; weak: ElementId[]; lesson: string; Icon: IconType }> = {
  ky: { name: 'Thiết kỵ', strong: 'Tốc độ, càn quét đồng bằng', weak: ['moc', 'tho'], lesson: 'Kỵ binh khó xoay trở nơi rừng núi, sông nước; thiếu lương thì kiệt sức.', Icon: ChessKnight },
  bo: { name: 'Bộ binh', strong: 'Quân đông, đánh thành', weak: ['tho', 'hoa'], lesson: 'Giữ chỗ hiểm và giữ vững sĩ khí thì quân đông cũng khó tiến.', Icon: Swords },
  thuyen: { name: 'Chiến thuyền', strong: 'Thuyền lớn, quân đông', weak: ['thuy'], lesson: 'Bạch Đằng 1288: thuyền giặc mắc cọc khi thủy triều rút.', Icon: Ship },
  luong: { name: 'Đoàn lương', strong: 'Nuôi cả đạo quân (hồi phục mỗi lượt)', weak: ['thuy'], lesson: 'Vân Đồn: mất thuyền lương, quân Nguyên lâm vào cảnh thiếu đói.', Icon: Package },
};

// ---------------------------------------------------------------------------
// game/data – tướng (dữ liệu khớp ai/data/knowledge_base.json)
// ---------------------------------------------------------------------------

const HEROES: HeroDef[] = [
  {
    id: 'tran_thai_tong',
    name: 'Trần Thái Tông',
    title: 'Vua Trần Thái Tông',
    element: 'thong',
    tier: 'huyen_thoai',
    role: 'Chỉ huy',
    lore: 'chinh_su',
    story: 'Vị vua đầu tiên của nhà Trần. Năm 1258, vua trực tiếp chỉ huy kháng chiến: chặn giặc ở Bình Lệ Nguyên, rút lui bảo toàn lực lượng rồi phản công thắng lợi ở Đông Bộ Đầu.',
    symbol: Crown,
    join: 'start',
    base: { hp: 140, atk: 24, def: 10, spd: 11 },
    basic: { name: 'Đốc chiến', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Thân chinh', desc: 'Vua đích thân ra trận: cả đội tăng 25% tấn công trong 2 lượt.', kind: 'buff_atk', power: 0.25 },
    ult: { name: 'Phản công Đông Bộ Đầu', desc: 'Đánh vào toàn bộ quân địch, mạnh gấp đôi khi địch đã kiệt sức.', kind: 'aoe', power: 1.5 },
    stages: [
      { name: 'Vua nhà Trần', years: 'Thế kỉ XIII', desc: 'Vị vua đầu tiên của vương triều Trần.', unit: 'KC1_OVERVIEW' },
      { name: 'Cự tuyệt sứ giả Mông Cổ', years: 'Trước năm 1258', desc: 'Kiên quyết bắt giam sứ giả đòi mượn đường, lệnh cả nước sẵn sàng kháng chiến.', unit: 'KC1_WHY_INVADE' },
      { name: 'Phản công Đông Bộ Đầu', years: '29/1/1258', desc: 'Chỉ huy trận phản công quét sạch quân Mông Cổ khỏi Thăng Long.', unit: 'KC1_DONG_BO_DAU' },
    ],
  },
  {
    id: 'tran_thu_do',
    name: 'Trần Thủ Độ',
    title: 'Thái sư',
    element: 'thong',
    tier: 'su_thi',
    role: 'Mưu sĩ',
    lore: 'chinh_su',
    story: 'Thái sư nhà Trần. Năm 1258, khi vua Trần Thái Tông lo lắng hỏi kế, ông khẳng khái: “Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!”.',
    symbol: Scroll,
    join: 'start',
    base: { hp: 120, atk: 18, def: 9, spd: 12 },
    basic: { name: 'Mưu kế', desc: 'Tấn công một quân địch.', kind: 'strike', power: 0.9 },
    strat: { name: 'Đầu thần chưa rơi xuống đất', desc: 'Cả đội không bị hoảng sợ trong 3 lượt và hồi 15% khí lực.', kind: 'fear_immune', power: 0.15 },
    ult: { name: 'Định kế giữ nước', desc: 'Cả đội nhận khiên bằng 25% khí lực tối đa.', kind: 'shield', power: 0.25 },
    stages: [
      { name: 'Thái sư nhà Trần', years: 'Thế kỉ XIII', desc: 'Người giữ trọng trách trong triều đình nhà Trần.', unit: 'KC1_TRAN_THU_DO_QUOTE' },
      { name: 'Kháng chiến năm 1258', years: '1258', desc: 'Cùng vua Trần Thái Tông lãnh đạo cuộc kháng chiến lần thứ nhất.', unit: 'KC1_OVERVIEW' },
      { name: '“Đầu thần chưa rơi xuống đất”', years: '1258', desc: 'Câu nói giúp nhà vua vững lòng trước thế giặc mạnh.', unit: 'KC1_TRAN_THU_DO_QUOTE' },
    ],
  },
  {
    id: 'le_phu_tran',
    name: 'Lê Phụ Trần',
    title: 'Tướng Lê Tần',
    element: 'tho',
    tier: 'hiem',
    role: 'Hộ vệ',
    lore: 'chinh_su',
    story: 'Tại trận Bình Lệ Nguyên (1/1258), ông lấy ván thuyền che tên cho vua Trần Thái Tông và khuyên vua rút lui để bảo toàn lực lượng.',
    symbol: Shield,
    join: 'start',
    base: { hp: 165, atk: 16, def: 14, spd: 10 },
    basic: { name: 'Đâm giáo', desc: 'Tấn công một quân địch.', kind: 'strike', power: 0.9 },
    strat: { name: 'Hộ giá', desc: 'Thu hút đòn đánh của địch trong 2 lượt, giảm 40% sát thương phải nhận.', kind: 'taunt', power: 0.4 },
    ult: { name: 'Mở đường rút', desc: 'Cả đội né đòn trong lượt tới.', kind: 'evade', power: 1 },
    stages: [
      { name: 'Tướng nhà Trần', years: '1258', desc: 'Tướng hộ vệ bên cạnh vua Trần Thái Tông.', unit: 'KC1_BINH_LE_NGUYEN' },
      { name: 'Che tên cho vua', years: '1/1258', desc: 'Lấy ván thuyền che tên cho vua ở Bình Lệ Nguyên.', unit: 'KC1_BINH_LE_NGUYEN' },
      { name: 'Phò vua rút lui', years: '1/1258', desc: 'Khuyên vua rút lui, giữ lực lượng chờ thời cơ phản công.', unit: 'KC1_BINH_LE_NGUYEN' },
    ],
  },
  {
    id: 'thanh_duc',
    name: 'Quân Thánh Dực',
    title: 'Cấm quân nhà Trần',
    element: 'hoa',
    tier: 'hiem',
    role: 'Bộ binh',
    lore: 'chinh_su',
    story: 'Một đơn vị cấm quân bảo vệ kinh thành Thăng Long thời Trần – lực lượng nòng cốt trong các cuộc kháng chiến.',
    symbol: Flag,
    join: 'start',
    base: { hp: 150, atk: 20, def: 12, spd: 9 },
    basic: { name: 'Giáo dài', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Giữ vững đội hình', desc: 'Cả đội tăng 30% phòng thủ trong 2 lượt.', kind: 'buff_def', power: 0.3 },
    ult: { name: 'Xung trận', desc: 'Đánh vào toàn bộ quân địch.', kind: 'aoe', power: 1.2 },
    stages: [
      { name: 'Cấm quân Thăng Long', years: 'Thời Trần', desc: 'Bảo vệ kinh thành và nhà vua.', unit: 'ALL_3_WARS_SUMMARY' },
      { name: 'Nòng cốt kháng chiến', years: '1258 – 1288', desc: 'Có mặt trong cả ba lần kháng chiến.', unit: 'ALL_3_WARS_SUMMARY' },
      { name: 'Vua tôi đồng lòng', years: '1258 – 1288', desc: 'Khối đoàn kết làm nên chiến thắng.', unit: 'CAUSES_OF_VICTORY' },
    ],
  },
  {
    id: 'tran_nhan_tong',
    name: 'Trần Nhân Tông',
    title: 'Vua Trần Nhân Tông',
    element: 'thong',
    tier: 'huyen_thoai',
    role: 'Chỉ huy',
    lore: 'chinh_su',
    story: 'Sinh cuối năm 1258, sau kháng chiến lần thứ nhất. Lên ngôi năm 1278, triệu tập Hội nghị Bình Than (1282), cùng Thượng hoàng Trần Thánh Tông lãnh đạo hai cuộc kháng chiến chống quân Nguyên. Năm 1299 xuất gia ở Yên Tử, sáng lập Thiền phái Trúc Lâm.',
    symbol: Flower2,
    join: 'story',
    base: { hp: 135, atk: 20, def: 11, spd: 12 },
    basic: { name: 'Chỉ huy', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Hội nghị Bình Than', desc: 'Bàn kế giữ nước: cả đội tăng 30% phòng thủ trong 2 lượt.', kind: 'buff_def', power: 0.3 },
    ult: { name: 'Vua tôi đồng lòng', desc: 'Hồi 30% khí lực cho cả đội.', kind: 'heal', power: 0.3 },
    stages: [
      { name: 'Hoàng thái tử Trần Khâm', years: '1274', desc: 'Được lập làm Hoàng thái tử.', unit: 'GAME_TRAN_NHAN_TONG' },
      { name: 'Vua kháng chiến', years: '1278 – 1293', desc: 'Triệu tập Hội nghị Bình Than; lãnh đạo kháng chiến 1285 và 1287 – 1288.', unit: 'BINH_THAN_CONFERENCE' },
      { name: 'Phật hoàng Trúc Lâm', years: '1299', desc: 'Xuất gia ở núi Yên Tử, sáng lập Thiền phái Trúc Lâm.', unit: 'GAME_TRAN_NHAN_TONG' },
    ],
  },
  {
    id: 'tran_hung_dao',
    name: 'Trần Hưng Đạo',
    title: 'Hưng Đạo Đại vương Trần Quốc Tuấn',
    element: 'thong',
    tier: 'tiet_che',
    role: 'Tổng chỉ huy',
    lore: 'chinh_su',
    story: 'Quốc công Tiết chế – tổng chỉ huy quân đội trong hai lần kháng chiến 1285 và 1287 – 1288; tác giả Hịch tướng sĩ và Binh thư yếu lược; chỉ huy đại thắng Bạch Đằng năm 1288.',
    symbol: Sword,
    join: 'recipe',
    base: { hp: 160, atk: 28, def: 13, spd: 13 },
    basic: { name: 'Kiếm pháp', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1.1 },
    strat: { name: 'Hịch tướng sĩ', desc: 'Khích lệ tướng sĩ: cả đội tăng 30% tấn công trong 2 lượt.', kind: 'buff_atk', power: 0.3 },
    ult: { name: 'Đại trận Bạch Đằng', desc: 'Cọc ngầm và thủy triều: sát thương lớn lên toàn bộ địch, thuyền giặc mắc cọc khi triều rút.', kind: 'stakes', power: 1.8 },
    stages: [
      { name: 'Quốc công Tiết chế', years: '1282', desc: 'Hội nghị Bình Than cử ông làm tổng chỉ huy quân đội.', unit: 'BINH_THAN_CONFERENCE' },
      { name: 'Tác giả Hịch tướng sĩ', years: '1284', desc: 'Soạn Hịch tướng sĩ, biên soạn Binh thư yếu lược.', unit: 'HICH_TUONG_SI' },
      { name: 'Đại thắng Bạch Đằng', years: '4/1288', desc: 'Bố trí bãi cọc ngầm, chỉ huy trận thủy chiến lịch sử.', unit: 'KC3_BACH_DANG_HOW' },
    ],
  },
  {
    id: 'tran_quang_khai',
    name: 'Trần Quang Khải',
    title: 'Thượng tướng Thái sư',
    element: 'thong',
    tier: 'huyen_thoai',
    role: 'Xung phong',
    lore: 'chinh_su',
    story: 'Thượng tướng Thái sư nhà Trần, chỉ huy trận Chương Dương (1285) mở đường giải phóng Thăng Long; tác giả bài thơ “Tụng giá hoàn kinh sư”.',
    symbol: Feather,
    join: 'story',
    base: { hp: 140, atk: 27, def: 10, spd: 12 },
    basic: { name: 'Thương pháp', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1.05 },
    strat: { name: 'Tiến quân Chương Dương', desc: 'Đòn mạnh vào một quân địch.', kind: 'strike', power: 1.6 },
    ult: { name: 'Đoạt sáo Chương Dương độ', desc: 'Đánh toàn bộ quân địch và làm giảm 25% tấn công của chúng trong 2 lượt.', kind: 'debuff', power: 1.4 },
    stages: [
      { name: 'Thượng tướng Thái sư', years: '1285', desc: 'Một trong những tướng chỉ huy chủ chốt của kháng chiến lần thứ hai.', unit: 'KC2_OVERVIEW' },
      { name: 'Chiến thắng Chương Dương', years: '5 – 6/1285', desc: 'Đại phá giặc ở bến Chương Dương, tiến về giải phóng Thăng Long.', unit: 'KC2_HAM_TU_CHUONG_DUONG' },
      { name: 'Thơ “Tụng giá hoàn kinh sư”', years: '1285', desc: '“Đoạt sáo Chương Dương độ, Cầm Hồ Hàm Tử quan.”', unit: 'KC2_HAM_TU_CHUONG_DUONG' },
    ],
  },
  {
    id: 'tran_binh_trong',
    name: 'Trần Bình Trọng',
    title: 'Bảo Nghĩa vương',
    element: 'hoa',
    tier: 'su_thi',
    role: 'Hộ vệ',
    lore: 'chinh_su',
    story: 'Năm 1285, ông chặn đánh quân Nguyên để hai vua Trần rút lui an toàn. Bị bắt và dụ hàng, ông khẳng khái: “Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!” rồi anh dũng hy sinh.',
    symbol: Heart,
    join: 'story',
    base: { hp: 165, atk: 22, def: 13, spd: 10 },
    basic: { name: 'Chặn giặc', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Thà làm quỷ nước Nam', desc: 'Thu hút đòn đánh 2 lượt, tăng 50% phòng thủ; khi khí lực dưới 30% thì đánh mạnh gấp đôi.', kind: 'taunt', power: 0.5 },
    ult: { name: 'Khí phách nước Nam', desc: 'Đòn rất mạnh vào một quân địch.', kind: 'strike', power: 2.2 },
    stages: [
      { name: 'Tướng nhà Trần', years: '1285', desc: 'Tướng trong kháng chiến chống quân Nguyên lần thứ hai.', unit: 'KC2_TRAN_BINH_TRONG' },
      { name: 'Giữ đường rút cho hai vua', years: '2/1285', desc: 'Chặn đánh quân Nguyên để triều đình rút lui an toàn.', unit: 'KC2_TRAN_BINH_TRONG' },
      { name: 'Khí phách nước Nam', years: '1285', desc: '“Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!”', unit: 'KC2_TRAN_BINH_TRONG' },
    ],
  },
  {
    id: 'tran_nhat_duat',
    name: 'Trần Nhật Duật',
    title: 'Chiêu Văn vương',
    element: 'tho',
    tier: 'su_thi',
    role: 'Chiến lược',
    lore: 'chinh_su',
    story: 'Chiêu Văn vương Trần Nhật Duật chỉ huy trận thắng lớn ở Hàm Tử trong cuộc tổng phản công năm 1285.',
    symbol: Compass,
    join: 'story',
    base: { hp: 135, atk: 23, def: 11, spd: 13 },
    basic: { name: 'Đánh chặn', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Giữ hiểm', desc: 'Cả đội tăng 30% phòng thủ trong 2 lượt.', kind: 'buff_def', power: 0.3 },
    ult: { name: 'Đại phá Hàm Tử', desc: 'Đánh vào toàn bộ quân địch.', kind: 'aoe', power: 1.5 },
    stages: [
      { name: 'Chiêu Văn vương', years: '1285', desc: 'Tướng nhà Trần trong kháng chiến lần thứ hai.', unit: 'KC2_OVERVIEW' },
      { name: 'Chiến thắng Hàm Tử', years: '1285', desc: 'Chỉ huy trận thắng lớn ở Hàm Tử.', unit: 'KC2_HAM_TU_CHUONG_DUONG' },
      { name: 'Tổng phản công', years: '5 – 6/1285', desc: 'Cùng các tướng đánh đuổi quân Nguyên khỏi bờ cõi.', unit: 'KC2_OVERVIEW' },
    ],
  },
  {
    id: 'tran_quoc_toan',
    name: 'Trần Quốc Toản',
    title: 'Hoài Văn hầu',
    element: 'hoa',
    tier: 'su_thi',
    role: 'Xung phong',
    lore: 'chinh_su',
    story: 'Thiếu niên anh hùng của hoàng tộc nhà Trần. Không được dự Hội nghị Bình Than vì còn nhỏ tuổi, ông bóp nát quả cam vua ban, rồi về chiêu mộ hơn 1.000 gia nô, thân tộc dưới lá cờ “Phá cường địch, báo hoàng ân”.',
    symbol: Citrus,
    join: 'recipe',
    base: { hp: 125, atk: 27, def: 8, spd: 15 },
    basic: { name: 'Xông trận', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Bóp nát quả cam', desc: 'Căm giặc, tăng 40% tấn công của bản thân trong 3 lượt.', kind: 'self_atk', power: 0.4 },
    ult: { name: 'Phá cường địch', desc: 'Liên tiếp ba đòn vào quân địch.', kind: 'multi', power: 0.75 },
    stages: [
      { name: 'Thiếu niên ở Bình Than', years: '10/1282', desc: 'Bóp nát quả cam vì không được dự bàn việc nước.', unit: 'TQT_WHY_ORANGE' },
      { name: 'Cờ thêu sáu chữ vàng', years: '1282 – 1285', desc: 'Lập đội quân dưới lá cờ “Phá cường địch, báo hoàng ân”.', unit: 'TQT_SIX_GOLDEN_WORDS' },
      { name: 'Xông pha tuyến đầu', years: '1285', desc: 'Lập công trong cuộc phản công năm 1285.', unit: 'TQT_OVERVIEW' },
    ],
  },
  {
    id: 'tran_khanh_du',
    name: 'Trần Khánh Dư',
    title: 'Nhân Huệ vương',
    element: 'thuy',
    tier: 'huyen_thoai',
    role: 'Phục kích',
    lore: 'chinh_su',
    story: 'Từng bị tước quan tước, về Chí Linh sống bằng nghề buôn than. Năm 1282 được tha tội để lập công. Trong kháng chiến lần thứ ba, ông phục kích ở Vân Đồn, đánh đắm và thu giữ đoàn thuyền lương của Trương Văn Hổ.',
    symbol: Anchor,
    join: 'recipe',
    base: { hp: 140, atk: 25, def: 10, spd: 13 },
    basic: { name: 'Thủy chiến', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Phục kích', desc: 'Đánh úp một quân địch; gấp đôi sát thương lên đoàn lương.', kind: 'ambush', power: 1.4 },
    ult: { name: 'Phục kích Vân Đồn', desc: 'Đánh toàn bộ địch và cắt nguồn lương: địch không còn hồi phục, mất sức bền mỗi lượt.', kind: 'cut_supply', power: 1.2 },
    stages: [
      { name: 'Người buôn than Chí Linh', years: 'Trước 1282', desc: 'Bị tước quan tước, về Chí Linh buôn than kiếm sống.', unit: 'GAME_TRAN_KHANH_DU' },
      { name: 'Lập công chuộc tội', years: '1282', desc: 'Được tha tội để cùng chuẩn bị kháng chiến.', unit: 'GAME_TRAN_KHANH_DU' },
      { name: 'Phục kích Vân Đồn', years: 'Cuối 1287 – đầu 1288', desc: 'Đánh đắm, thu giữ đoàn thuyền lương của Trương Văn Hổ.', unit: 'KC3_VAN_DON' },
    ],
  },
  {
    id: 'yet_kieu',
    name: 'Yết Kiêu',
    title: 'Gia tướng của Trần Hưng Đạo',
    element: 'thuy',
    tier: 'hiem',
    role: 'Đặc nhiệm',
    lore: 'giai_thoai',
    story: 'Gia tướng trung thành của Trần Hưng Đạo, giỏi bơi lặn. Theo truyền thuyết, ông lặn xuống đục thủng thuyền giặc và trung kiên giữ thuyền chờ chủ tướng ở bãi Tân Hưng.',
    symbol: Waves,
    join: 'recipe',
    base: { hp: 120, atk: 22, def: 9, spd: 16 },
    basic: { name: 'Đánh dưới nước', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Lặn đục thuyền', desc: 'Đánh mạnh vào thuyền giặc (gấp đôi) và làm giảm phòng thủ của nó.', kind: 'ship_hunter', power: 1.3 },
    ult: { name: 'Giữ thuyền chờ chủ tướng', desc: 'Cả đội nhận khiên bằng 30% khí lực tối đa.', kind: 'shield', power: 0.3 },
    stages: [
      { name: 'Gia tướng trung thành', years: 'Thế kỉ XIII', desc: 'Người giỏi bơi lặn dưới trướng Trần Hưng Đạo.', unit: 'YET_KIEU_DA_TUONG' },
      { name: 'Lặn đục thuyền giặc', years: 'Truyền thuyết', desc: 'Lặn xuống đục thủng thuyền giặc.', unit: 'YET_KIEU_DA_TUONG' },
      { name: 'Giữ thuyền ở bãi Tân Hưng', years: 'Truyền thuyết', desc: 'Trung kiên giữ thuyền chờ chủ tướng.', unit: 'YET_KIEU_DA_TUONG' },
    ],
  },
  {
    id: 'pham_ngu_lao',
    name: 'Phạm Ngũ Lão',
    title: 'Danh tướng nhà Trần',
    element: 'moc',
    tier: 'su_thi',
    role: 'Xung phong',
    lore: 'giai_thoai',
    story: 'Ngồi đan sọt bên đường, mải nghĩ việc nước đến mức bị giáo đâm vào đùi cũng không hay. Được Trần Hưng Đạo trọng dụng, ông lập công lớn ở Vạn Kiếp, Bạch Đằng.',
    symbol: ShoppingBasket,
    join: 'recipe',
    base: { hp: 140, atk: 26, def: 10, spd: 13 },
    basic: { name: 'Giáo pháp', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Mải việc nước', desc: 'Né đòn trong lượt tới và đánh một quân địch.', kind: 'evade', power: 1.1 },
    ult: { name: 'Hoành sóc giang sơn', desc: '“Múa giáo non sông”: đánh vào toàn bộ quân địch.', kind: 'aoe', power: 1.4 },
    stages: [
      { name: 'Chàng trai làng Phù Ủng', years: 'Thế kỉ XIII', desc: 'Ngồi đan sọt mải nghĩ việc nước, bị giáo đâm vào đùi vẫn không hay.', unit: 'PHAM_NGU_LAO' },
      { name: 'Được Trần Hưng Đạo trọng dụng', years: '1285', desc: 'Trở thành danh tướng, lập công ở Vạn Kiếp.', unit: 'PHAM_NGU_LAO' },
      { name: 'Thơ “Thuật hoài”', years: 'Thời Trần', desc: '“Hoành sóc giang sơn kháp kỉ thu” – Múa giáo non sông trải mấy thu.', unit: 'PHAM_NGU_LAO' },
    ],
  },
  {
    id: 'quan_sat_that',
    name: 'Quân Sát Thát',
    title: 'Dân binh thích chữ Sát Thát',
    element: 'moc',
    tier: 'hiem',
    role: 'Bộ binh',
    lore: 'chinh_su',
    story: 'Hưởng ứng Hịch tướng sĩ, quân sĩ nhà Trần tự nguyện thích hai chữ “Sát Thát” (giết giặc Mông Cổ) lên cánh tay, thề sống chết với non sông.',
    symbol: BicepsFlexed,
    join: 'recipe',
    base: { hp: 130, atk: 22, def: 10, spd: 11 },
    basic: { name: 'Xung phong', desc: 'Tấn công một quân địch.', kind: 'strike', power: 1 },
    strat: { name: 'Thề Sát Thát', desc: 'Cả đội tăng 20% tấn công trong 2 lượt.', kind: 'buff_atk', power: 0.2 },
    ult: { name: 'Đồng lòng xung trận', desc: 'Đánh vào toàn bộ quân địch.', kind: 'aoe', power: 1.3 },
    stages: [
      { name: 'Dân binh nhập ngũ', years: '1284', desc: 'Hưởng ứng lời kêu gọi đánh giặc.', unit: 'HICH_TUONG_SI' },
      { name: 'Thích chữ “Sát Thát”', years: '1285', desc: 'Thề sống chết với giặc.', unit: 'HICH_TUONG_SI' },
      { name: 'Quân tinh nhuệ', years: '1285 – 1288', desc: 'Xông pha trong các trận phản công.', unit: 'KC2_OVERVIEW' },
    ],
  },
];

const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));

// ---------------------------------------------------------------------------
// game/data – quân Mông – Nguyên
// ---------------------------------------------------------------------------

const ENEMIES: Record<string, EnemyDef> = {
  ngot_luong_hop_thai: {
    id: 'ngot_luong_hop_thai',
    name: 'Ngột Lương Hợp Thai',
    type: 'ky',
    boss: true,
    base: { hp: 420, atk: 30, def: 10, spd: 13 },
    intents: ['charge', 'roar', 'forage', 'strike'],
    note: 'Tướng Mông Cổ chỉ huy cuộc xâm lược Đại Việt năm 1258.',
    defeatText: 'Ngột Lương Hợp Thai rút chạy khỏi Thăng Long',
  },
  thiet_ky: { id: 'thiet_ky', name: 'Thiết kỵ Mông Cổ', type: 'ky', base: { hp: 150, atk: 22, def: 7, spd: 14 }, intents: ['charge', 'strike', 'forage'], note: 'Kỵ binh tinh nhuệ của Mông Cổ.', defeatText: 'Thiết kỵ tan vỡ' },
  cung_thu: { id: 'cung_thu', name: 'Cung thủ Mông Cổ', type: 'bo', base: { hp: 115, atk: 18, def: 5, spd: 12 }, intents: ['volley', 'strike'], note: 'Bắn tên từ xa.', defeatText: 'Cung thủ bỏ chạy' },
  bo_binh: { id: 'bo_binh', name: 'Bộ binh Nguyên', type: 'bo', base: { hp: 160, atk: 20, def: 9, spd: 10 }, intents: ['strike', 'brace', 'forage'], note: 'Bộ binh đông đảo của quân Nguyên.', defeatText: 'Bộ binh tan vỡ' },
  giu_ben: { id: 'giu_ben', name: 'Quân Nguyên giữ bến', type: 'bo', boss: true, base: { hp: 320, atk: 25, def: 11, spd: 10 }, intents: ['strike', 'volley', 'brace'], note: 'Quân Nguyên đóng giữ các bến sông năm 1285.', defeatText: 'Quân Nguyên bỏ bến tháo chạy' },
  chien_thuyen: { id: 'chien_thuyen', name: 'Chiến thuyền Nguyên', type: 'thuyen', base: { hp: 190, atk: 21, def: 11, spd: 8 }, intents: ['strike', 'volley', 'brace'], note: 'Thuyền chiến lớn của thủy quân Nguyên.', defeatText: 'Chiến thuyền vỡ đắm' },
  thuyen_lon: { id: 'thuyen_lon', name: 'Đội thuyền lớn', type: 'thuyen', boss: true, base: { hp: 330, atk: 26, def: 12, spd: 8 }, intents: ['volley', 'strike', 'brace'], note: 'Đội thuyền chiến chủ lực của quân Nguyên.', defeatText: 'Đội thuyền lớn mắc cọc, vỡ tan' },
  thuyen_luong: { id: 'thuyen_luong', name: 'Thuyền lương', type: 'luong', base: { hp: 170, atk: 6, def: 7, spd: 6 }, intents: ['supply', 'brace'], note: 'Thuyền chở lương nuôi quân Nguyên.', defeatText: 'Thuyền lương bị đánh đắm' },
  truong_van_ho: {
    id: 'truong_van_ho',
    name: 'Trương Văn Hổ',
    type: 'luong',
    boss: true,
    base: { hp: 320, atk: 14, def: 9, spd: 8 },
    intents: ['supply', 'brace', 'strike'],
    note: 'Tướng Nguyên chỉ huy đoàn thuyền lương năm 1287 – 1288.',
    defeatText: 'Trương Văn Hổ bỏ chạy, đoàn thuyền lương bị đánh đắm',
    fleeAt: 0.35,
  },
  thoat_hoan: {
    id: 'thoat_hoan',
    name: 'Thoát Hoan',
    type: 'bo',
    boss: true,
    base: { hp: 460, atk: 30, def: 11, spd: 11 },
    intents: ['strike', 'roar', 'volley', 'charge'],
    note: 'Con trai Hốt Tất Liệt, chỉ huy quân Nguyên năm 1285 và 1287 – 1288.',
    defeatText: 'Thoát Hoan tháo chạy',
    fleeAt: 0.3,
  },
  toa_do: { id: 'toa_do', name: 'Toa Đô', type: 'bo', boss: true, base: { hp: 380, atk: 31, def: 10, spd: 12 }, intents: ['charge', 'strike', 'roar'], note: 'Tướng Nguyên đánh từ Chăm-pa lên phía Nam năm 1285.', defeatText: 'Toa Đô tử trận ở Tây Kết' },
  o_ma_nhi: { id: 'o_ma_nhi', name: 'Ô Mã Nhi', type: 'thuyen', boss: true, base: { hp: 440, atk: 28, def: 12, spd: 10 }, intents: ['volley', 'strike', 'brace'], note: 'Tướng chỉ huy thủy quân Nguyên.', defeatText: 'Ô Mã Nhi bị bắt sống', capture: true },
};

// ---------------------------------------------------------------------------
// game/data – lược đồ (minh họa, không theo tỉ lệ)
// ---------------------------------------------------------------------------

type PlaceId =
  | 'lang_son'
  | 'noi_bang'
  | 'binh_le_nguyen'
  | 'thang_long'
  | 'dong_bo_dau'
  | 'binh_than'
  | 'van_kiep'
  | 'yen_tu'
  | 'bach_dang'
  | 'van_don'
  | 'chuong_duong'
  | 'ham_tu'
  | 'tay_ket'
  | 'thien_truong'
  | 'truong_yen'
  | 'thanh_hoa'
  | 'champa';

const MAP_PLACES: Record<PlaceId, { name: string; x: number; y: number; anchor?: 'start' | 'end' | 'middle'; dy?: number }> = {
  lang_son: { name: 'Lạng Sơn', x: 296, y: 58 },
  noi_bang: { name: 'Nội Bàng', x: 282, y: 128 },
  binh_le_nguyen: { name: 'Bình Lệ Nguyên', x: 132, y: 150, anchor: 'end' },
  thang_long: { name: 'Thăng Long', x: 178, y: 206, anchor: 'end' },
  dong_bo_dau: { name: 'Đông Bộ Đầu', x: 196, y: 186, anchor: 'end', dy: -10 },
  binh_than: { name: 'Bình Than', x: 246, y: 172, dy: -14 },
  van_kiep: { name: 'Vạn Kiếp', x: 278, y: 196 },
  yen_tu: { name: 'Yên Tử', x: 326, y: 168 },
  bach_dang: { name: 'Bạch Đằng', x: 334, y: 236 },
  van_don: { name: 'Vân Đồn', x: 392, y: 200, anchor: 'end', dy: -16 },
  chuong_duong: { name: 'Chương Dương', x: 190, y: 240, anchor: 'end' },
  ham_tu: { name: 'Hàm Tử', x: 222, y: 260 },
  tay_ket: { name: 'Tây Kết', x: 238, y: 282 },
  thien_truong: { name: 'Thiên Trường', x: 246, y: 322 },
  truong_yen: { name: 'Trường Yên', x: 192, y: 342, anchor: 'end' },
  thanh_hoa: { name: 'Thanh Hóa', x: 176, y: 404, anchor: 'end' },
  champa: { name: 'Chăm-pa', x: 246, y: 492 },
};

// ---------------------------------------------------------------------------
// game/data – chiến dịch 3 màn
// ---------------------------------------------------------------------------

type PhaseEffect = 'retreat' | 'vuon_khong' | 'counter' | 'rear_guard' | 'chuong_duong' | 'van_kiep' | 'van_don' | 'bach_dang' | 'capture';
type BattleBg = 'plain' | 'river' | 'sea';

interface PhaseDef {
  id: string;
  campaign: 1 | 2 | 3;
  name: string;
  date: string;
  place: PlaceId;
  story: string;
  objective: string;
  enemies: Array<{ id: string; hp?: number; defeatText?: string; fleeAt?: number }>;
  units: string[];
  recommended: string[];
  rules: { retreatAfter?: number; tide?: boolean; startStamina?: number; winWhenExhausted?: boolean };
  strat: { name: string; desc: string; unit: string; hero?: string; effect: PhaseEffect; starHint: string };
  bg: BattleBg;
  reward: { luong: number; quan: number };
  history: string;
}

const PHASES: PhaseDef[] = [
  {
    id: 'm1p1',
    campaign: 1,
    name: 'Bình Lệ Nguyên',
    date: 'Tháng 1/1258',
    place: 'binh_le_nguyen',
    story: 'Ba vạn quân Mông Cổ do Ngột Lương Hợp Thai chỉ huy tràn xuống. Vua Trần Thái Tông dàn quân chặn giặc ở Bình Lệ Nguyên.',
    objective: 'Giặc đang rất mạnh. Cầm cự 2 lượt rồi rút lui bảo toàn lực lượng.',
    enemies: [{ id: 'ngot_luong_hop_thai', hp: 1.5 }, { id: 'thiet_ky' }, { id: 'thiet_ky' }],
    units: ['KC1_BINH_LE_NGUYEN', 'KC1_OVERVIEW', 'KC1_WHY_INVADE'],
    recommended: ['tran_thai_tong', 'tran_thu_do', 'le_phu_tran'],
    rules: { retreatAfter: 2 },
    strat: { name: 'Rút lui bảo toàn lực lượng', desc: 'Không đánh liều với giặc mạnh: rút quân để giữ lực lượng.', unit: 'KC1_BINH_LE_NGUYEN', hero: 'le_phu_tran', effect: 'retreat', starHint: 'Rút lui khi chưa tướng nào phải lui về hậu tuyến' },
    bg: 'plain',
    reward: { luong: 120, quan: 6 },
    history: 'Tại Bình Lệ Nguyên, tướng Lê Phụ Trần lấy ván thuyền che tên cho vua và khuyên vua rút lui để bảo toàn lực lượng.',
  },
  {
    id: 'm1p2',
    campaign: 1,
    name: 'Thăng Long bỏ trống',
    date: 'Tháng 1/1258',
    place: 'thang_long',
    story: 'Quân dân Thăng Long sơ tán người và lương thực. Giặc vào kinh thành trống không, không có gì để ăn.',
    objective: 'Thực hiện “vườn không nhà trống”, cầm cự đến khi giặc kiệt sức.',
    enemies: [{ id: 'ngot_luong_hop_thai' }, { id: 'thiet_ky' }, { id: 'cung_thu' }],
    units: ['KC1_VUON_KHONG_NHA_TRONG', 'KC1_TRAN_THU_DO_QUOTE', 'KC1_OVERVIEW'],
    recommended: ['tran_thai_tong', 'tran_thu_do', 'le_phu_tran'],
    rules: { winWhenExhausted: true },
    strat: { name: 'Vườn không nhà trống', desc: 'Sơ tán người và lương thực: giặc không cướp được lương, mất sức bền mỗi lượt.', unit: 'KC1_VUON_KHONG_NHA_TRONG', hero: 'tran_thu_do', effect: 'vuon_khong', starHint: 'Thực hiện vườn không nhà trống trong 2 lượt đầu' },
    bg: 'plain',
    reward: { luong: 140, quan: 6 },
    history: 'Kế sách “vườn không nhà trống” làm giặc không cướp được lương ăn, rơi vào cảnh đói kiệt và hoang mang.',
  },
  {
    id: 'm1p3',
    campaign: 1,
    name: 'Đông Bộ Đầu',
    date: '29/1/1258',
    place: 'dong_bo_dau',
    story: 'Giặc đói kiệt, mệt mỏi. Thời cơ phản công đã đến!',
    objective: 'Phản công khi giặc đã kiệt sức, quét sạch giặc khỏi kinh thành.',
    enemies: [{ id: 'ngot_luong_hop_thai', hp: 0.7 }, { id: 'thiet_ky', hp: 0.8 }, { id: 'thiet_ky', hp: 0.8 }],
    units: ['KC1_DONG_BO_DAU', 'KC1_OVERVIEW'],
    recommended: ['tran_thai_tong', 'tran_thu_do', 'le_phu_tran'],
    rules: { startStamina: 10 },
    strat: { name: 'Phản công Đông Bộ Đầu', desc: 'Tổng phản công: cả đội tăng mạnh tấn công trong 3 lượt.', unit: 'KC1_DONG_BO_DAU', hero: 'tran_thai_tong', effect: 'counter', starHint: 'Phản công khi có quân địch đã kiệt sức' },
    bg: 'river',
    reward: { luong: 180, quan: 8 },
    history: 'Ngày 29/1/1258, quân Trần phản công đánh tan giặc ở Đông Bộ Đầu. Tàn quân chạy qua Quy Hóa bị Hà Khuất chặn đánh.',
  },
  {
    id: 'm2p1',
    campaign: 2,
    name: 'Chặn giặc, giữ đường rút',
    date: 'Tháng 2/1285',
    place: 'thang_long',
    story: 'Thoát Hoan đem đại quân từ phía Bắc, Toa Đô đánh lên từ phía Nam. Triều đình phải rút lui để bảo toàn lực lượng.',
    objective: 'Chặn giặc để hai vua và triều đình rút lui an toàn.',
    enemies: [{ id: 'thoat_hoan', hp: 1.6, fleeAt: 0 }, { id: 'bo_binh' }, { id: 'thiet_ky' }],
    units: ['KC2_TRAN_BINH_TRONG', 'KC2_OVERVIEW', 'DIEN_HONG_CONFERENCE'],
    recommended: ['tran_hung_dao', 'tran_quang_khai', 'tran_binh_trong'],
    rules: { retreatAfter: 2 },
    strat: { name: 'Chặn giặc giữ đường rút', desc: 'Một cánh quân ở lại chặn giặc để triều đình rút lui an toàn.', unit: 'KC2_TRAN_BINH_TRONG', hero: 'tran_binh_trong', effect: 'rear_guard', starHint: 'Rút lui an toàn khi chưa tướng nào phải lui về hậu tuyến' },
    bg: 'plain',
    reward: { luong: 200, quan: 8 },
    history: 'Trần Bình Trọng chặn đánh quân Nguyên để hai vua rút lui. Bị bắt và dụ hàng, ông khẳng khái: “Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!”.',
  },
  {
    id: 'm2p2',
    campaign: 2,
    name: 'Hàm Tử – Chương Dương',
    date: 'Tháng 5 – 6/1285',
    place: 'chuong_duong',
    story: 'Thời cơ đã đến. Quân Trần mở cuộc tổng phản công: Trần Nhật Duật đánh Hàm Tử, Trần Quang Khải đánh Chương Dương.',
    objective: 'Đánh tan quân Nguyên giữ các bến sông, mở đường về Thăng Long.',
    enemies: [{ id: 'giu_ben' }, { id: 'chien_thuyen' }, { id: 'bo_binh' }],
    units: ['KC2_HAM_TU_CHUONG_DUONG', 'KC2_OVERVIEW', 'HICH_TUONG_SI'],
    recommended: ['tran_quang_khai', 'tran_nhat_duat', 'tran_quoc_toan'],
    rules: {},
    strat: { name: 'Đoạt sáo Chương Dương độ', desc: 'Tổng phản công ở bến Chương Dương: đòn lớn vào toàn bộ quân giặc.', unit: 'KC2_HAM_TU_CHUONG_DUONG', hero: 'tran_quang_khai', effect: 'chuong_duong', starHint: 'Dùng kế sách Đoạt sáo Chương Dương độ' },
    bg: 'river',
    reward: { luong: 220, quan: 9 },
    history: 'Tháng 5 – 6/1285, Trần Nhật Duật thắng lớn ở Hàm Tử, Trần Quang Khải đại phá giặc ở Chương Dương, giải phóng Thăng Long.',
  },
  {
    id: 'm2p3',
    campaign: 2,
    name: 'Tây Kết – Vạn Kiếp',
    date: 'Tháng 6/1285',
    place: 'van_kiep',
    story: 'Quân Nguyên tan vỡ. Toa Đô bị chặn đánh ở Tây Kết; Thoát Hoan tháo chạy về phía Vạn Kiếp.',
    objective: 'Đánh bại Toa Đô và truy kích Thoát Hoan.',
    enemies: [{ id: 'toa_do' }, { id: 'thoat_hoan', defeatText: 'Thoát Hoan chui vào ống đồng, cho quân kéo chạy về nước' }, { id: 'thiet_ky' }],
    units: ['KC2_THOAT_HOAN_COPPER_PIPE', 'KC2_OVERVIEW', 'KC2_HAM_TU_CHUONG_DUONG'],
    recommended: ['tran_hung_dao', 'pham_ngu_lao', 'tran_quang_khai'],
    rules: {},
    strat: { name: 'Chặn đánh Vạn Kiếp', desc: 'Chặn đường tháo chạy của giặc ở Vạn Kiếp: đòn lớn vào chủ tướng giặc.', unit: 'KC2_THOAT_HOAN_COPPER_PIPE', hero: 'tran_hung_dao', effect: 'van_kiep', starHint: 'Dùng kế sách Chặn đánh Vạn Kiếp' },
    bg: 'plain',
    reward: { luong: 260, quan: 10 },
    history: 'Toa Đô bị giết ở Tây Kết. Tháo chạy qua Vạn Kiếp, Thoát Hoan phải chui vào ống đồng cho quân lính kéo về nước.',
  },
  {
    id: 'm3p1',
    campaign: 3,
    name: 'Phục kích Vân Đồn',
    date: 'Cuối 1287 – đầu 1288',
    place: 'van_don',
    story: 'Rút kinh nghiệm thiếu lương, quân Nguyên cho đoàn thuyền lương của Trương Văn Hổ theo sau. Trần Khánh Dư mai phục ở Vân Đồn.',
    objective: 'Đánh tan đoàn thuyền lương của Trương Văn Hổ.',
    enemies: [{ id: 'truong_van_ho' }, { id: 'thuyen_luong' }, { id: 'thuyen_luong' }],
    units: ['KC3_VAN_DON', 'GAME_TRAN_KHANH_DU', 'KC3_OVERVIEW'],
    recommended: ['tran_khanh_du', 'yet_kieu', 'tran_hung_dao'],
    rules: {},
    strat: { name: 'Phục kích Vân Đồn', desc: 'Phục kích đoàn thuyền lương: đánh đắm thuyền lương, địch mất nguồn hồi phục.', unit: 'KC3_VAN_DON', hero: 'tran_khanh_du', effect: 'van_don', starHint: 'Phục kích ngay trong lượt đầu tiên' },
    bg: 'sea',
    reward: { luong: 280, quan: 10 },
    history: 'Trần Khánh Dư phục kích ở Vân Đồn, đánh đắm và thu giữ đoàn thuyền lương của Trương Văn Hổ. Quân Nguyên ở Thăng Long lâm vào cảnh thiếu đói.',
  },
  {
    id: 'm3p2',
    campaign: 3,
    name: 'Trận địa cọc Bạch Đằng',
    date: 'Tháng 4/1288',
    place: 'bach_dang',
    story: 'Thiếu lương, quân Nguyên phải rút theo đường sông Bạch Đằng. Trần Hưng Đạo đã cho cắm bãi cọc gỗ đầu bịt sắt dưới lòng sông.',
    objective: 'Theo dõi thủy triều: nhử thuyền giặc lúc triều lên, tổng công kích khi triều rút.',
    enemies: [{ id: 'thuyen_lon' }, { id: 'chien_thuyen' }, { id: 'chien_thuyen' }],
    units: ['KC3_BACH_DANG_HOW', 'TRAN_HUNG_DAO_PORTRAIT', 'KC3_OVERVIEW'],
    recommended: ['tran_hung_dao', 'yet_kieu', 'tran_khanh_du'],
    rules: { tide: true },
    strat: { name: 'Đại trận Bạch Đằng', desc: 'Tổng công kích: cọc ngầm chỉ phát huy khi thủy triều rút.', unit: 'KC3_BACH_DANG_HOW', hero: 'tran_hung_dao', effect: 'bach_dang', starHint: 'Tung Đại trận Bạch Đằng đúng lúc triều rút' },
    bg: 'sea',
    reward: { luong: 320, quan: 12 },
    history: 'Tháng 4/1288, quân Trần nhử thuyền giặc vào bãi cọc lúc triều lên rồi tổng công kích khi triều rút. Thuyền giặc va cọc, vỡ đắm.',
  },
  {
    id: 'm3p3',
    campaign: 3,
    name: 'Bắt sống Ô Mã Nhi',
    date: 'Tháng 4/1288',
    place: 'bach_dang',
    story: 'Thủy quân giặc tan vỡ. Đã đến lúc bắt sống tướng giặc Ô Mã Nhi; Thoát Hoan tìm đường bộ chạy về nước.',
    objective: 'Bắt sống Ô Mã Nhi và đánh đuổi Thoát Hoan.',
    enemies: [{ id: 'o_ma_nhi' }, { id: 'thoat_hoan', hp: 0.85, defeatText: 'Thoát Hoan rút chạy về nước' }, { id: 'chien_thuyen' }],
    units: ['KC3_BACH_DANG_HOW', 'KC3_OVERVIEW', 'ALL_3_WARS_SUMMARY'],
    recommended: ['tran_hung_dao', 'pham_ngu_lao', 'yet_kieu'],
    rules: {},
    strat: { name: 'Bắt sống tướng giặc', desc: 'Vây chặt thuyền chỉ huy, bắt sống Ô Mã Nhi.', unit: 'KC3_BACH_DANG_HOW', hero: 'tran_hung_dao', effect: 'capture', starHint: 'Dùng kế sách bắt sống tướng giặc' },
    bg: 'sea',
    reward: { luong: 380, quan: 14 },
    history: 'Toàn bộ thủy quân giặc bị tiêu diệt, Ô Mã Nhi và Phàn Tiếp bị bắt sống. Cuộc kháng chiến lần thứ ba thắng lợi hoàn toàn.',
  },
];

const PHASE_BY_ID: Record<string, PhaseDef> = Object.fromEntries(PHASES.map((p) => [p.id, p]));

const CAMPAIGNS: Array<{ id: 1 | 2 | 3; name: string; years: string; desc: string; place: PlaceId; joinHeroes?: string[] }> = [
  { id: 1, name: 'Kháng chiến lần thứ nhất', years: '1258', desc: 'Từ Bình Lệ Nguyên đến Đông Bộ Đầu', place: 'dong_bo_dau' },
  { id: 2, name: 'Kháng chiến lần thứ hai', years: '1285', desc: 'Phá gọng kìm 50 vạn quân', place: 'chuong_duong', joinHeroes: ['tran_nhan_tong', 'tran_quang_khai', 'tran_binh_trong', 'tran_nhat_duat'] },
  { id: 3, name: 'Kháng chiến lần thứ ba', years: '1287 – 1288', desc: 'Vân Đồn và Bạch Đằng', place: 'bach_dang' },
];

// ---------------------------------------------------------------------------
// game/data – thẻ, công thức chiêu mộ, cổ vật, công trình, nhiệm vụ ngày
// ---------------------------------------------------------------------------

interface CardDef {
  id: string;
  name: string;
  kind: 'nhan_luc' | 'su_kien';
  desc: string;
  lore: Lore;
  unit?: string;
  how: string;
  Icon: IconType;
}

const CARDS: Record<string, CardDef> = {
  dan_binh: { id: 'dan_binh', name: 'Dân binh Ngụ Binh', kind: 'nhan_luc', desc: 'Thời bình làm ruộng, có giặc thì ra trận.', lore: 'chinh_su', how: 'Gọi ở Trại Ngụ Binh', Icon: Users },
  thuy_binh: { id: 'thuy_binh', name: 'Thủy binh', kind: 'nhan_luc', desc: 'Quân giỏi đánh trên sông nước.', lore: 'chinh_su', how: 'Gọi ở Bến Vân Đồn', Icon: Sailboat },
  quan_sat_that: { id: 'quan_sat_that', name: 'Quân Sát Thát', kind: 'nhan_luc', desc: 'Quân sĩ thích chữ “Sát Thát” lên cánh tay.', lore: 'chinh_su', how: 'Huấn luyện ở Trại Ngụ Binh (sau khi chiêu mộ Quân Sát Thát)', Icon: BicepsFlexed },
  tuong_hoang_toc: { id: 'tuong_hoang_toc', name: 'Tướng hoàng tộc', kind: 'nhan_luc', desc: 'Vương hầu nhà Trần cùng nhau gánh vác việc nước.', lore: 'chinh_su', how: 'Phần thưởng khi hoàn thành Màn 1', Icon: Crown },
  hich_tuong_si: { id: 'hich_tuong_si', name: 'Hịch tướng sĩ', kind: 'su_kien', desc: 'Lời kêu gọi tướng sĩ của Trần Quốc Tuấn (1284).', lore: 'chinh_su', unit: 'HICH_TUONG_SI', how: 'Trả lời đúng câu hỏi về Hịch tướng sĩ', Icon: ScrollText },
  binh_than: { id: 'binh_than', name: 'Hội nghị Bình Than', kind: 'su_kien', desc: 'Vương hầu, trăm quan bàn kế đánh giặc (10/1282).', lore: 'chinh_su', unit: 'BINH_THAN_CONFERENCE', how: 'Trả lời đúng câu hỏi về Hội nghị Bình Than', Icon: Users },
  nguoi_buon_than: { id: 'nguoi_buon_than', name: 'Người buôn than Chí Linh', kind: 'su_kien', desc: 'Trần Khánh Dư từng sống bằng nghề buôn than.', lore: 'chinh_su', unit: 'GAME_TRAN_KHANH_DU', how: 'Trả lời đúng câu hỏi về Trần Khánh Dư', Icon: Flame },
  binh_thu: { id: 'binh_thu', name: 'Binh thư yếu lược', kind: 'su_kien', desc: 'Sách binh pháp của Trần Quốc Tuấn.', lore: 'chinh_su', unit: 'GAME_BINH_THU_YEU_LUOC', how: 'Trả lời đúng câu hỏi về Binh thư yếu lược', Icon: BookOpen },
  sot_tre: { id: 'sot_tre', name: 'Sọt tre bên đường', kind: 'su_kien', desc: 'Phạm Ngũ Lão ngồi đan sọt mải nghĩ việc nước.', lore: 'giai_thoai', unit: 'PHAM_NGU_LAO', how: 'Trả lời đúng câu hỏi về Phạm Ngũ Lão', Icon: ShoppingBasket },
  song_sau: { id: 'song_sau', name: 'Sông sâu', kind: 'su_kien', desc: 'Người giỏi bơi lặn có thể lặn sâu dưới sông.', lore: 'giai_thoai', unit: 'YET_KIEU_DA_TUONG', how: 'Trả lời đúng câu hỏi về Yết Kiêu', Icon: Waves },
};

interface RecipeDef {
  id: string;
  hero: string;
  inputs: [string, string];
  gems: number;
  luong: number;
  waitSec: number;
  questions: number;
  units: string[];
  lesson: string;
}

const RECIPES: RecipeDef[] = [
  { id: 'r_sat_that', hero: 'quan_sat_that', inputs: ['dan_binh', 'hich_tuong_si'], gems: 20, luong: 80, waitSec: 45, questions: 1, units: ['HICH_TUONG_SI'], lesson: 'Hịch tướng sĩ khích lệ quân sĩ thích chữ “Sát Thát” trước kháng chiến lần thứ hai.' },
  { id: 'r_yet_kieu', hero: 'yet_kieu', inputs: ['thuy_binh', 'song_sau'], gems: 20, luong: 100, waitSec: 45, questions: 1, units: ['YET_KIEU_DA_TUONG'], lesson: 'Yết Kiêu giỏi bơi lặn, theo truyền thuyết lặn đục thuyền giặc.' },
  { id: 'r_quoc_toan', hero: 'tran_quoc_toan', inputs: ['quan_sat_that', 'binh_than'], gems: 40, luong: 160, waitSec: 90, questions: 2, units: ['TQT_WHY_ORANGE', 'TQT_SIX_GOLDEN_WORDS'], lesson: 'Không được dự Hội nghị Bình Than, Trần Quốc Toản bóp nát quả cam rồi lập đội quân riêng.' },
  { id: 'r_ngu_lao', hero: 'pham_ngu_lao', inputs: ['dan_binh', 'sot_tre'], gems: 40, luong: 160, waitSec: 90, questions: 2, units: ['PHAM_NGU_LAO'], lesson: 'Phạm Ngũ Lão đan sọt mải nghĩ việc nước nên được Trần Hưng Đạo trọng dụng.' },
  { id: 'r_khanh_du', hero: 'tran_khanh_du', inputs: ['thuy_binh', 'nguoi_buon_than'], gems: 60, luong: 220, waitSec: 150, questions: 2, units: ['GAME_TRAN_KHANH_DU', 'KC3_VAN_DON'], lesson: 'Từ người buôn than ở Chí Linh, Trần Khánh Dư lập công lớn ở Vân Đồn.' },
  { id: 'r_hung_dao', hero: 'tran_hung_dao', inputs: ['tuong_hoang_toc', 'binh_thu'], gems: 80, luong: 280, waitSec: 240, questions: 3, units: ['TRAN_HUNG_DAO_PORTRAIT', 'HICH_TUONG_SI', 'GAME_BINH_THU_YEU_LUOC'], lesson: 'Quốc công Tiết chế Trần Quốc Tuấn, tác giả Hịch tướng sĩ và Binh thư yếu lược.' },
];

interface RelicDef {
  id: string;
  name: string;
  effect: string;
  lore: Lore;
  story: string;
  how: string;
  Icon: IconType;
}

const RELICS: Record<string, RelicDef> = {
  hich: { id: 'hich', name: 'Hịch tướng sĩ', effect: 'Hồi đầy khí lực cho cả đội, 1 lần mỗi trận.', lore: 'chinh_su', story: 'Trần Quốc Tuấn viết Hịch tướng sĩ năm 1284, khích lệ tướng sĩ trước kháng chiến lần thứ hai.', how: 'Vượt tầng 5 Tháp Khảo Thí', Icon: ScrollText },
  co_sau_chu: { id: 'co_sau_chu', name: 'Cờ thêu sáu chữ vàng', effect: 'Hồi sinh 1 tướng với 50% khí lực, 1 lần mỗi trận.', lore: 'chinh_su', story: '“Phá cường địch, báo hoàng ân” – lá cờ của đội quân Trần Quốc Toản.', how: 'Hoàn thành Màn 1', Icon: Flag },
  tung_gia: { id: 'tung_gia', name: 'Thơ “Tụng giá hoàn kinh sư”', effect: 'Hành quân thần tốc: cả đội được hành động thêm một lượt, 1 lần mỗi trận.', lore: 'chinh_su', story: 'Trần Quang Khải làm bài thơ khi phò giá về kinh sau chiến thắng 1285: “Đoạt sáo Chương Dương độ, Cầm Hồ Hàm Tử quan”.', how: 'Hoàn thành Màn 2', Icon: Feather },
  binh_thu_relic: { id: 'binh_thu_relic', name: 'Binh thư yếu lược', effect: 'Thấy trước ý đồ của địch thêm một lượt.', lore: 'chinh_su', story: 'Sách binh pháp do Trần Quốc Tuấn biên soạn để dạy các tướng.', how: 'Vượt tầng 10 Tháp Khảo Thí', Icon: BookOpen },
  non_ma_loi: { id: 'non_ma_loi', name: 'Nón Ma Lôi', effect: 'Tướng hệ Thủy có 25% cơ hội né đòn.', lore: 'dan_gian', story: 'Nguồn phổ thông kể nón làng Ma Lôi được dùng trong thủy quân của Trần Khánh Dư. Chưa có tư liệu học thuật xác nhận – cần đối chiếu.', how: 'Nâng Bến Vân Đồn lên cấp 3', Icon: Sparkles },
};

type BuildingId = 'ruong' | 'trai' | 'kho' | 'xuong' | 'ben' | 'doanh' | 'hoiquan' | 'qtg';

interface BuildingDef {
  id: BuildingId;
  name: string;
  desc: string;
  unit: string;
  maxLevel: number;
  start: number;
  buildCost: number;
  pos: { x: number; y: number; w: number; h: number };
  levelText: (level: number) => string;
}

const BUILDINGS: BuildingDef[] = [
  { id: 'qtg', name: 'Quốc Tử Giám', desc: 'Nơi khảo thí: trả lời đúng để nhận Ấn Tín và Lương Thảo.', unit: 'ALL_3_WARS_SUMMARY', maxLevel: 3, start: 1, buildCost: 0, pos: { x: 3, y: 2, w: 31, h: 29 }, levelText: (l) => `Mỗi câu đúng +${qtgFood(l)} Lương Thảo` },
  { id: 'hoiquan', name: 'Hội Quán Vạn Kiếp', desc: 'Chiêu mộ, kết nghĩa và tiến hóa tướng.', unit: 'BINH_THAN_CONFERENCE', maxLevel: 3, start: 1, buildCost: 0, pos: { x: 66, y: 2, w: 31, h: 29 }, levelText: (l) => `Thời gian triệu tập giảm ${(l - 1) * 25}%` },
  { id: 'doanh', name: 'Doanh Trại', desc: 'Nơi ở của tướng và quân năm hệ.', unit: 'ALL_3_WARS_SUMMARY', maxLevel: 3, start: 1, buildCost: 0, pos: { x: 36, y: 20, w: 28, h: 25 }, levelText: (l) => `Khí lực của tướng +${(l - 1) * 6}%` },
  { id: 'ruong', name: 'Ruộng Ngụ Binh', desc: 'Sinh Lương Thảo theo thời gian. Thời bình binh lính về đây làm ruộng.', unit: 'GAME_NGU_BINH_U_NONG', maxLevel: 5, start: 1, buildCost: 0, pos: { x: 3, y: 36, w: 33, h: 27 }, levelText: (l) => `${farmRate(l)} Lương Thảo mỗi giờ` },
  { id: 'trai', name: 'Trại Ngụ Binh', desc: 'Đổi Lương Thảo thành Quân Lực, gọi dân binh.', unit: 'GAME_NGU_BINH_U_NONG', maxLevel: 5, start: 1, buildCost: 0, pos: { x: 66, y: 36, w: 31, h: 26 }, levelText: (l) => `Quân Lực tối đa ${troopCap(l)}` },
  { id: 'kho', name: 'Kho Bí Mật', desc: 'Cất giữ Lương Thảo; khi giặc đến cướp lương có thể giấu hết vào kho.', unit: 'KC1_VUON_KHONG_NHA_TRONG', maxLevel: 5, start: 1, buildCost: 0, pos: { x: 38, y: 49, w: 24, h: 22 }, levelText: (l) => `Chứa tối đa ${storeCap(l)} Lương Thảo` },
  { id: 'xuong', name: 'Xưởng Cọc Bạch Đằng', desc: 'Đẽo cọc cho trận địa Bạch Đằng: cấp càng cao, Đại trận Bạch Đằng càng mạnh.', unit: 'KC3_BACH_DANG_HOW', maxLevel: 3, start: 0, buildCost: 150, pos: { x: 4, y: 68, w: 28, h: 26 }, levelText: (l) => ['Chưa xây', 'Cọc gỗ đẽo nhọn', 'Cọc gỗ đầu bịt sắt', 'Trận địa cọc kết hợp mai phục'][l] },
  { id: 'ben', name: 'Bến Vân Đồn', desc: 'Đóng thuyền, gọi thủy binh phục kích đoàn lương địch.', unit: 'KC3_VAN_DON', maxLevel: 3, start: 0, buildCost: 120, pos: { x: 63, y: 70, w: 34, h: 26 }, levelText: (l) => (l === 0 ? 'Chưa xây' : `Phục kích mạnh thêm ${(l - 1) * 20}%`) },
];

const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingId, BuildingDef>;

/** Lương Thảo mỗi giờ của Ruộng Ngụ Binh */
const farmRate = (level: number) => Math.round(60 * Math.pow(1.5, Math.max(0, level - 1)));
/** Trần Lương Thảo chưa thu trên ruộng: 8 giờ sản lượng */
const farmCap = (level: number) => farmRate(level) * 8;
const storeCap = (level: number) => Math.round(600 * Math.pow(1.5, Math.max(0, level - 1)));
const troopCap = (level: number) => 30 + (level - 1) * 20;
const qtgFood = (level: number) => [0, 5, 8, 12][Math.min(3, level)];
const UPGRADE_SECONDS = [0, 0, 30, 120, 300, 600];
const upgradeCost = (b: BuildingDef, toLevel: number) => ({
  luong: Math.round((b.buildCost || 80) * Math.pow(1.6, Math.max(0, toLevel - 1))),
  gems: toLevel >= 3 ? 20 * (toLevel - 2) : 0,
});

interface DailyTaskDef {
  id: string;
  text: string;
  target: number;
  metric: 'harvest' | 'correct' | 'session' | 'battle' | 'codex' | 'ask';
  reward: { luong: number; quan: number };
  Icon: IconType;
}

const DAILY_TASKS: DailyTaskDef[] = [
  { id: 'harvest', text: 'Thu hoạch Ruộng Ngụ Binh', target: 1, metric: 'harvest', reward: { luong: 40, quan: 3 }, Icon: Wheat },
  { id: 'correct5', text: 'Trả lời đúng 5 câu', target: 5, metric: 'correct', reward: { luong: 60, quan: 4 }, Icon: Stamp },
  { id: 'session', text: 'Hoàn thành 1 lượt khảo thí', target: 1, metric: 'session', reward: { luong: 50, quan: 3 }, Icon: Landmark },
  { id: 'battle', text: 'Đánh 1 trận chiến dịch', target: 1, metric: 'battle', reward: { luong: 60, quan: 5 }, Icon: Swords },
  { id: 'codex', text: 'Đọc 1 thẻ Sử Ký', target: 1, metric: 'codex', reward: { luong: 30, quan: 2 }, Icon: ScrollText },
  { id: 'ask', text: 'Hỏi Quân Sư 1 câu', target: 1, metric: 'ask', reward: { luong: 30, quan: 2 }, Icon: MessageSquare },
];

// ---------------------------------------------------------------------------
// game/state – trạng thái game lưu trên server (cột game_state, ≤ 16 KB)
// ---------------------------------------------------------------------------

interface HeroState {
  stage: 1 | 2 | 3;
  battles: number;
}

interface GameSettings {
  theme: 'system' | 'light' | 'dark';
  timer: boolean;
  sound: boolean;
  reduceMotion: boolean;
}

interface GameState {
  v: 1;
  createdAt: number;
  buildings: Record<BuildingId, { level: number; lastCollect: number; upgradeEnds: number | null }>;
  luong: number;
  quan: number;
  heroes: Record<string, HeroState>;
  cards: Record<string, number>;
  relics: string[];
  relic: string | null;
  recruit: { recipe: string; endsAt: number } | null;
  campaign: Record<string, number>;
  tower: number;
  codex: string[];
  daily: { day: string; progress: Record<string, number>; claimed: string[] };
  raid: { sessions: number; lastDay: string };
  stats: { sessions: number; battles: number; wins: number; harvests: number };
  seen: string[];
  tutorial: boolean;
  settings: GameSettings;
}

const todayKey = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const newGameState = (now = Date.now()): GameState => ({
  v: 1,
  createdAt: now,
  buildings: Object.fromEntries(BUILDINGS.map((b) => [b.id, { level: b.start, lastCollect: now, upgradeEnds: null }])) as GameState['buildings'],
  luong: 200,
  quan: 15,
  heroes: Object.fromEntries(HEROES.filter((h) => h.join === 'start').map((h) => [h.id, { stage: 1, battles: 0 }])),
  cards: { dan_binh: 1 },
  relics: [],
  relic: null,
  recruit: null,
  campaign: {},
  tower: 0,
  codex: [],
  daily: { day: todayKey(), progress: {}, claimed: [] },
  raid: { sessions: 0, lastDay: '' },
  stats: { sessions: 0, battles: 0, wins: 0, harvests: 0 },
  seen: [],
  tutorial: false,
  settings: { theme: 'system', timer: true, sound: false, reduceMotion: false },
});

/** Đọc trạng thái đã lưu, bổ sung trường mới và loại bỏ dữ liệu hỏng */
const restoreGameState = (raw: unknown): GameState => {
  const base = newGameState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<GameState>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const buildings = { ...base.buildings };
  for (const b of BUILDINGS) {
    const saved = s.buildings?.[b.id];
    if (saved) {
      buildings[b.id] = {
        level: Math.max(0, Math.min(b.maxLevel, Math.round(num(saved.level, b.start)))),
        lastCollect: num(saved.lastCollect, base.createdAt),
        upgradeEnds: typeof saved.upgradeEnds === 'number' ? saved.upgradeEnds : null,
      };
    }
  }
  const heroes: Record<string, HeroState> = { ...base.heroes };
  for (const [id, h] of Object.entries(s.heroes ?? {})) {
    if (HERO_BY_ID[id] && h) heroes[id] = { stage: (Math.max(1, Math.min(3, Math.round(num(h.stage, 1)))) as 1 | 2 | 3), battles: Math.max(0, Math.round(num(h.battles, 0))) };
  }
  const cards: Record<string, number> = {};
  for (const [id, n] of Object.entries(s.cards ?? {})) if (CARDS[id]) cards[id] = Math.max(0, Math.round(num(n, 0)));
  const campaign: Record<string, number> = {};
  for (const [id, n] of Object.entries(s.campaign ?? {})) if (PHASE_BY_ID[id]) campaign[id] = Math.max(0, Math.min(3, Math.round(num(n, 0))));
  return {
    ...base,
    createdAt: num(s.createdAt, base.createdAt),
    buildings,
    luong: Math.max(0, Math.round(num(s.luong, base.luong))),
    quan: Math.max(0, Math.round(num(s.quan, base.quan))),
    heroes,
    cards,
    relics: (s.relics ?? []).filter((r) => RELICS[r]),
    relic: s.relic && RELICS[s.relic] ? s.relic : null,
    recruit: s.recruit && RECIPES.some((r) => r.id === s.recruit?.recipe) ? { recipe: s.recruit.recipe, endsAt: num(s.recruit.endsAt, Date.now()) } : null,
    campaign,
    tower: Math.max(0, Math.min(10, Math.round(num(s.tower, 0)))),
    codex: (s.codex ?? []).filter((c) => typeof c === 'string').slice(0, 80),
    daily: s.daily && typeof s.daily.day === 'string' ? { day: s.daily.day, progress: { ...(s.daily.progress ?? {}) }, claimed: [...(s.daily.claimed ?? [])] } : base.daily,
    raid: { sessions: Math.max(0, Math.round(num(s.raid?.sessions, 0))), lastDay: typeof s.raid?.lastDay === 'string' ? s.raid.lastDay : '' },
    stats: { ...base.stats, ...(s.stats ?? {}) },
    seen: (s.seen ?? []).filter((q) => typeof q === 'string').slice(-60),
    tutorial: Boolean(s.tutorial),
    settings: { ...base.settings, ...(s.settings ?? {}) },
  };
};

/** 3 nhiệm vụ của ngày (đổi theo ngày, giống nhau với mọi học sinh) */
const dailyTasksFor = (day: string) => {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...DAILY_TASKS];
  const picked: DailyTaskDef[] = [];
  while (picked.length < 3 && pool.length) {
    picked.push(pool.splice(h % pool.length, 1)[0]);
    h = (h * 1103515245 + 12345) >>> 0;
  }
  return picked;
};

/** Sao của một màn (tối đa 9) và việc đã hoàn thành màn hay chưa */
const campaignStars = (state: GameState, c: 1 | 2 | 3) => PHASES.filter((p) => p.campaign === c).reduce((sum, p) => sum + (state.campaign[p.id] ?? 0), 0);
const campaignDone = (state: GameState, c: 1 | 2 | 3) => PHASES.filter((p) => p.campaign === c).every((p) => (state.campaign[p.id] ?? 0) > 0);
const phaseUnlocked = (state: GameState, p: PhaseDef) => {
  if (p.campaign > 1 && !campaignDone(state, (p.campaign - 1) as 1 | 2)) return false;
  const list = PHASES.filter((x) => x.campaign === p.campaign);
  const idx = list.findIndex((x) => x.id === p.id);
  return idx === 0 || (state.campaign[list[idx - 1].id] ?? 0) > 0;
};

/** Cấp độ người chơi theo XP (server) */
const levelOf = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
const levelXp = (level: number) => (level - 1) * (level - 1) * 40;

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// game/art – đồ họa SVG (vẽ tay, không dùng ảnh nặng)
// ---------------------------------------------------------------------------

const ART = {
  ink: '#3b2a1a',
  roof: '#a33b1f',
  roofShade: '#7c2d12',
  gold: '#d97706',
  goldLight: '#fbbf24',
  thatch: '#d9a54c',
  thatchShade: '#b7832f',
  wall: '#f6e7c8',
  wallShade: '#e6cfa0',
  pillar: '#b91c1c',
  wood: '#8b5a2b',
  woodDark: '#6b4220',
  water: '#7cc7dc',
  waterDeep: '#3e9cc4',
  stone: '#cfc2a8',
  rice: '#4caf50',
  riceGold: '#e0b03a',
};

/** Mái cong đầu đao: đáy từ (l,b) tới (r,b), nóc từ (l+d,t) tới (r-d,t) */
const curvedRoof = (l: number, r: number, b: number, t: number, d: number) =>
  `M${l - 6} ${b - 7} Q${l} ${b + 1} ${l + 10} ${b} L${r - 10} ${b} Q${r} ${b + 1} ${r + 6} ${b - 7} L${r - d} ${t} L${l + d} ${t} Z`;

const Shadow: React.FC<{ rx?: number }> = ({ rx = 50 }) => <ellipse cx="60" cy="92" rx={rx} ry="6.5" fill="rgba(40,25,10,0.22)" />;

const Scaffold: React.FC = () => (
  <g>
    <Shadow rx={40} />
    <path d="M22 86 L60 70 L98 86 L60 98 Z" fill="none" stroke={ART.wood} strokeWidth="2.5" strokeDasharray="5 4" />
    <g stroke={ART.woodDark} strokeWidth="4" strokeLinecap="round">
      <path d="M36 84 V44" />
      <path d="M84 84 V44" />
      <path d="M32 50 H88" />
      <path d="M36 80 L84 50" />
    </g>
    <rect x="46" y="22" width="28" height="18" rx="4" fill={ART.wall} stroke={ART.ink} strokeWidth="2.5" />
    <path d="M60 40 V52" stroke={ART.woodDark} strokeWidth="3" />
    <path d="M53 28 l14 6 M53 34 l14 -6" stroke={ART.pillar} strokeWidth="2.5" strokeLinecap="round" />
  </g>
);

const RiceTufts: React.FC<{ gold: boolean }> = ({ gold }) => {
  const color = gold ? ART.riceGold : ART.rice;
  const dark = gold ? '#a77b14' : '#2e7d32';
  const tufts: Array<[number, number]> = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) tufts.push([24 + c * 12 + r * 5, 58 + r * 6 - c * 2.2]);
  return (
    <g strokeLinecap="round">
      {tufts.map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x} ${y} l-3 -7 M${x} ${y} l0 -8 M${x} ${y} l3 -7`} stroke={dark} strokeWidth="2.6" />
          <path d={`M${x} ${y} l-3 -7 M${x} ${y} l0 -8 M${x} ${y} l3 -7`} stroke={color} strokeWidth="1.6" />
        </g>
      ))}
    </g>
  );
};

const SpriteRuong: React.FC<{ level: number; full: boolean }> = ({ level, full }) => (
  <g>
    <Shadow rx={54} />
    <path d="M6 66 L58 46 L114 62 L62 86 Z" fill="#a8763e" stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M13 66 L58 49 L107 62 L62 81 Z" fill={ART.water} />
    <path d="M18 66 L58 51 L100 62" fill="none" stroke="#bfe8f3" strokeWidth="1.6" opacity="0.8" />
    <path d="M36 58 L84 73" stroke="#a8763e" strokeWidth="3" />
    <RiceTufts gold={full} />
    <g transform="translate(80 18)">
      <rect x="2" y="16" width="26" height="16" fill={ART.wall} stroke={ART.ink} strokeWidth="2.2" />
      <path d="M-4 18 L15 2 L34 18 Z" fill={ART.thatch} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M4 15 L15 6 L26 15" fill="none" stroke={ART.thatchShade} strokeWidth="1.8" />
      <rect x="11" y="22" width="8" height="10" fill={ART.woodDark} />
    </g>
    {level >= 3 && <path d="M8 40 q6 -10 12 0" fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" />}
  </g>
);

const SpriteTrai: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <Shadow />
    <rect x="22" y="50" width="76" height="32" rx="2" fill={ART.wall} stroke={ART.ink} strokeWidth="2.5" />
    <rect x="22" y="72" width="76" height="10" fill={ART.wallShade} />
    <path d="M12 54 L34 28 L86 28 L108 54 Z" fill={ART.thatch} stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
    <g stroke={ART.thatchShade} strokeWidth="2" fill="none">
      <path d="M24 46 L40 33" />
      <path d="M44 46 L52 33" />
      <path d="M66 46 L68 33" />
      <path d="M86 46 L82 33" />
    </g>
    <rect x="52" y="62" width="16" height="20" rx="2" fill={ART.woodDark} />
    <g stroke={ART.woodDark} strokeWidth="2.6" strokeLinecap="round">
      <path d="M10 84 V40" />
      <path d="M16 84 V38" />
    </g>
    <path d="M7 40 l3 -8 l3 8 Z M13 38 l3 -8 l3 8 Z" fill="#94a3b8" stroke={ART.ink} strokeWidth="1.4" />
    <path d="M104 86 V18" stroke={ART.woodDark} strokeWidth="3" strokeLinecap="round" />
    <path d="M105 19 q10 4 18 0 q-4 7 0 13 q-9 4 -18 0 Z" fill={ART.pillar} stroke={ART.ink} strokeWidth="1.8" strokeLinejoin="round" />
    {level >= 3 && <circle cx="114" cy="26" r="2.5" fill={ART.goldLight} />}
  </g>
);

const SpriteKho: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <Shadow rx={42} />
    <g stroke={ART.woodDark} strokeWidth="4" strokeLinecap="round">
      <path d="M36 88 V64" />
      <path d="M84 88 V64" />
      <path d="M50 90 V64" />
      <path d="M70 90 V64" />
    </g>
    <rect x="28" y="60" width="64" height="6" rx="2" fill={ART.wood} stroke={ART.ink} strokeWidth="2" />
    <rect x="34" y="38" width="52" height="24" fill={ART.wall} stroke={ART.ink} strokeWidth="2.5" />
    <path d="M24 42 L60 10 L96 42 Z" fill={ART.thatch} stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M36 36 L60 16 L84 36" fill="none" stroke={ART.thatchShade} strokeWidth="2" />
    <circle cx="60" cy="50" r="7.5" fill={ART.goldLight} stroke={ART.ink} strokeWidth="2" />
    <path d="M60 47 v5" stroke={ART.ink} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="60" cy="46.5" r="1.8" fill={ART.ink} />
    {level >= 3 && <path d="M30 70 h60" stroke={ART.gold} strokeWidth="2" />}
  </g>
);

const SpriteXuong: React.FC<{ level: number }> = ({ level }) => {
  const tip = level >= 2 ? '#94a3b8' : '#e6cfa0';
  return (
    <g>
      <Shadow />
      {level >= 3 && (
        <g>
          <path d="M4 82 Q60 70 116 82 L116 94 Q60 86 4 94 Z" fill={ART.water} />
          {[16, 34, 52, 70, 88, 104].map((x) => (
            <path key={x} d={`M${x} 90 l3 -14 l3 14`} fill={ART.wood} stroke={ART.ink} strokeWidth="1.4" />
          ))}
        </g>
      )}
      <g stroke={ART.woodDark} strokeWidth="4" strokeLinecap="round">
        <path d="M18 80 V36" />
        <path d="M102 80 V36" />
      </g>
      <path d={curvedRoof(14, 106, 38, 18, 18)} fill={ART.thatch} stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${34 + i * 11} ${44 + (i % 2) * 3}) rotate(${-14 + i * 6})`}>
          <rect x="-3" y="0" width="6" height="34" rx="1.5" fill={ART.wood} stroke={ART.ink} strokeWidth="1.6" />
          <path d="M-3 0 L0 -9 L3 0 Z" fill={tip} stroke={ART.ink} strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      ))}
      <path d="M22 80 h76" stroke={ART.woodDark} strokeWidth="5" strokeLinecap="round" />
    </g>
  );
};

const SpriteBen: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <path d="M0 62 Q60 50 120 62 L120 100 L0 100 Z" fill={ART.water} />
    <path d="M10 70 q8 -4 16 0 t16 0 M64 76 q8 -4 16 0 t16 0" fill="none" stroke="#d4f0f8" strokeWidth="2" strokeLinecap="round" />
    <g stroke={ART.woodDark} strokeWidth="3.5" strokeLinecap="round">
      <path d="M14 92 V58" />
      <path d="M34 92 V58" />
    </g>
    <path d="M6 58 H44 V64 H6 Z" fill={ART.wood} stroke={ART.ink} strokeWidth="2" />
    <g transform="translate(52 34)">
      <path d="M0 40 Q30 52 62 40 L56 50 Q30 58 6 50 Z" fill={ART.wood} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M30 40 V2" stroke={ART.woodDark} strokeWidth="3" />
      <path d="M31 4 Q50 18 31 36 Z" fill={ART.wall} stroke={ART.ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M31 16 Q42 20 31 26" fill="none" stroke={ART.pillar} strokeWidth="3" />
      {level >= 2 && <path d="M29 6 Q14 18 29 32 Z" fill={ART.wallShade} stroke={ART.ink} strokeWidth="2" />}
      <path d="M8 44 l-8 8 M54 44 l8 8" stroke={ART.woodDark} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  </g>
);

const SpriteDoanh: React.FC<{ level: number }> = ({ level }) => {
  const flags = ['#0369a1', '#15803d', '#a16207', '#c2410c', '#7e22ce'];
  return (
    <g>
      <Shadow rx={54} />
      {[
        [8, 58, 1],
        [40, 46, 1.2],
        [78, 58, 1],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M0 28 L17 0 L34 28 Z" fill={i === 1 ? ART.wall : ART.wallShade} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M17 0 L17 28" stroke={ART.ink} strokeWidth="1.6" />
          <path d="M12 28 L17 16 L22 28 Z" fill={ART.woodDark} />
        </g>
      ))}
      {flags.slice(0, 3 + Math.min(2, level - 1)).map((c, i) => (
        <g key={c} transform={`translate(${18 + i * 21} 14)`}>
          <path d="M0 36 V0" stroke={ART.woodDark} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M1 1 q8 3 14 0 q-3 5 0 10 q-7 3 -14 0 Z" fill={c} stroke={ART.ink} strokeWidth="1.4" strokeLinejoin="round" />
        </g>
      ))}
    </g>
  );
};

const SpriteHoiQuan: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <Shadow rx={52} />
    <path d="M14 86 H106 L100 78 H20 Z" fill={ART.stone} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
    <rect x="24" y="52" width="72" height="26" fill={ART.wall} stroke={ART.ink} strokeWidth="2.4" />
    {[30, 50, 70, 88].map((x) => (
      <rect key={x} x={x - 3} y="52" width="6" height="26" fill={ART.pillar} stroke={ART.ink} strokeWidth="1.4" />
    ))}
    <rect x="52" y="60" width="16" height="18" fill={ART.woodDark} />
    <path d={curvedRoof(16, 104, 54, 38, 14)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M24 50 H96" stroke={ART.roofShade} strokeWidth="2" />
    <rect x="34" y="30" width="52" height="10" fill={ART.wall} stroke={ART.ink} strokeWidth="2" />
    <path d={curvedRoof(28, 92, 32, 14, 12)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M40 14 H80" stroke={ART.gold} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M40 14 q-6 -6 -2 -10 M80 14 q6 -6 2 -10" fill="none" stroke={ART.gold} strokeWidth="3" strokeLinecap="round" />
    {level >= 2 && <circle cx="60" cy="10" r="4" fill={ART.goldLight} stroke={ART.ink} strokeWidth="1.5" />}
  </g>
);

const SpriteQTG: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <Shadow rx={52} />
    <path d="M10 88 H110 L104 80 H16 Z" fill={ART.stone} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
    {[
      [14, 54, 32],
      [74, 54, 32],
    ].map(([x, y, w]) => (
      <g key={x}>
        <rect x={x} y={y} width={w} height={26} fill={ART.wall} stroke={ART.ink} strokeWidth="2.2" />
        <path d={curvedRoof(x - 2, x + w + 2, y + 2, y - 12, 8)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
      </g>
    ))}
    <rect x="42" y="40" width="36" height="40" fill={ART.wall} stroke={ART.ink} strokeWidth="2.4" />
    <path d="M50 80 V58 a10 10 0 0 1 20 0 V80 Z" fill={ART.woodDark} />
    <path d={curvedRoof(36, 84, 42, 22, 10)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
    <rect x="50" y="10" width="20" height="13" rx="2" fill={ART.pillar} stroke={ART.ink} strokeWidth="2" />
    <path d="M54 16.5 h12" stroke={ART.goldLight} strokeWidth="2.5" strokeLinecap="round" />
    {level >= 2 && <path d="M38 22 h44" stroke={ART.gold} strokeWidth="3" strokeLinecap="round" />}
  </g>
);

/** Hình công trình trên Điền Trang */
const BuildingSprite: React.FC<{ id: BuildingId; level: number; full?: boolean; className?: string }> = ({ id, level, full = false, className = '' }) => (
  <svg viewBox="0 0 120 100" className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
    {level <= 0 ? (
      <Scaffold />
    ) : id === 'ruong' ? (
      <SpriteRuong level={level} full={full} />
    ) : id === 'trai' ? (
      <SpriteTrai level={level} />
    ) : id === 'kho' ? (
      <SpriteKho level={level} />
    ) : id === 'xuong' ? (
      <SpriteXuong level={level} />
    ) : id === 'ben' ? (
      <SpriteBen level={level} />
    ) : id === 'doanh' ? (
      <SpriteDoanh level={level} />
    ) : id === 'hoiquan' ? (
      <SpriteHoiQuan level={level} />
    ) : (
      <SpriteQTG level={level} />
    )}
  </svg>
);

/** Nền bàn Điền Trang: đồng cỏ, đường đất, sông, lũy tre */
const FarmBoardArt: React.FC<{ dark: boolean }> = ({ dark }) => {
  const gid = React.useId().replace(/:/g, '');
  const grassA = dark ? '#2c4a37' : '#a6cf86';
  const grassB = dark ? '#21382a' : '#88bb66';
  const path = dark ? '#5b4a32' : '#e3c690';
  const water = dark ? '#1d4e6b' : '#7cc7dc';
  const waterB = dark ? '#173e56' : '#5fb2d0';
  const tree = dark ? '#1f3b2a' : '#4f8f3a';
  const treeLight = dark ? '#2f5a3f' : '#6aac4c';
  const trees: Array<[number, number, number]> = [
    [30, 300, 22],
    [56, 286, 16],
    [570, 300, 20],
    [548, 288, 15],
    [300, 26, 18],
    [328, 20, 14],
    [270, 24, 13],
    [580, 210, 16],
    [20, 200, 15],
    [210, 400, 14],
    [392, 402, 16],
  ];
  return (
    <svg viewBox="0 0 600 600" className="absolute inset-0 w-full h-full" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <radialGradient id={`g-${gid}`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={grassA} />
          <stop offset="100%" stopColor={grassB} />
        </radialGradient>
        <linearGradient id={`w-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={water} />
          <stop offset="100%" stopColor={waterB} />
        </linearGradient>
        <pattern id={`t-${gid}`} width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M8 30 l3 -7 l3 7 M28 14 l3 -7 l3 7" fill="none" stroke={dark ? '#3c6149' : '#7cae5b'} strokeWidth="2" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="600" height="600" rx="40" fill={`url(#g-${gid})`} />
      <rect x="0" y="0" width="600" height="600" rx="40" fill={`url(#t-${gid})`} />
      <path d="M0 470 C120 430 220 470 320 452 C420 434 500 400 600 420 L600 560 Q600 600 560 600 L40 600 Q0 600 0 560 Z" fill={`url(#w-${gid})`} />
      <path d="M0 470 C120 430 220 470 320 452 C420 434 500 400 600 420" fill="none" stroke={dark ? '#4d6f5a' : '#d9c48e'} strokeWidth="10" opacity="0.8" />
      <g stroke={dark ? '#3a7194' : '#d8f1f8'} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M60 520 q14 -8 28 0 t28 0" />
        <path d="M260 540 q14 -8 28 0 t28 0" />
        <path d="M430 500 q14 -8 28 0 t28 0" />
      </g>
      <g stroke={path} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95">
        <path d="M110 190 C170 240 220 250 300 245 C380 240 430 230 490 190" />
        <path d="M300 245 L300 390" />
        <path d="M120 300 C180 330 240 340 300 330 C360 320 420 330 480 300" />
        <path d="M110 480 C130 420 180 400 240 392" />
        <path d="M480 480 C470 430 420 400 360 392" />
      </g>
      {trees.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y + r * 0.35} r={r} fill={tree} />
          <circle cx={x - r * 0.25} cy={y} r={r * 0.75} fill={treeLight} />
        </g>
      ))}
    </svg>
  );
};

/** Huy hiệu tướng: vòng màu theo hệ + vật biểu trưng; không vẽ chân dung người thật */
const HeroMedallion: React.FC<{ hero: HeroDef; stage?: number; size?: number; dim?: boolean; className?: string }> = ({
  hero,
  stage = 1,
  size = 64,
  dim = false,
  className = '',
}) => {
  const el = ELEMENTS[hero.element];
  const Icon = hero.symbol;
  const golden = hero.tier === 'huyen_thoai' || hero.tier === 'tiet_che';
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${el.fill} ${dim ? 'grayscale opacity-60' : ''} ${className}`}
      style={{ width: size, height: size, boxShadow: golden ? '0 0 0 3px #fbbf24, 0 3px 0 3px #92400e' : '0 3px 0 rgba(0,0,0,0.25)' }}
      aria-hidden="true"
    >
      <span className="absolute rounded-full bg-the" style={{ inset: Math.max(4, size * 0.09) }} />
      <span className="absolute rounded-full" style={{ inset: Math.max(4, size * 0.09), boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.06)' }} />
      <Icon className={`relative ${el.text}`} size={Math.round(size * 0.46)} strokeWidth={2.2} aria-hidden={true} />
      {stage > 1 && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {Array.from({ length: stage - 1 }, (_, i) => (
            <span key={i} className="w-2.5 h-2.5 rotate-45 bg-dong border border-dong-dam" />
          ))}
        </span>
      )}
    </span>
  );
};

/** Huy hiệu quân địch */
const EnemyBadge: React.FC<{ enemy: EnemyDef; size?: number; className?: string }> = ({ enemy, size = 64, className = '' }) => {
  const Icon = ENEMY_TYPES[enemy.type].Icon;
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-2xl shrink-0 bg-dich text-white ${className}`}
      style={{ width: size, height: size, boxShadow: enemy.boss ? '0 0 0 3px #b91c1c, 0 3px 0 3px #7f1d1d' : '0 3px 0 rgba(0,0,0,0.3)' }}
      aria-hidden="true"
    >
      <Icon className="w-1/2 h-1/2" strokeWidth={2} aria-hidden={true} />
      {enemy.boss && <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 text-dong fill-dong" aria-hidden={true} />}
    </span>
  );
};

/** Lược đồ Đại Việt thời Trần (minh họa, không theo tỉ lệ) */
const SchematicMap: React.FC<{
  pins?: PlaceId[];
  labels?: PlaceId[];
  selectable?: PlaceId[];
  selected?: PlaceId | null;
  correct?: PlaceId | null;
  wrong?: PlaceId | null;
  highlight?: PlaceId | null;
  routes?: Array<{ path: string; enemy?: boolean }>;
  onSelect?: (id: PlaceId) => void;
  dark?: boolean;
  className?: string;
  title?: string;
}> = ({ pins = [], labels, selectable = [], selected = null, correct = null, wrong = null, highlight = null, routes = [], onSelect, dark = false, className = '', title = 'Lược đồ Đại Việt thời Trần' }) => {
  const gid = React.useId().replace(/:/g, '');
  const land = dark ? '#1e2a3d' : '#f1e5c7';
  const land2 = dark ? '#243349' : '#e9d9b2';
  const sea = dark ? '#0e2238' : '#cfe8f1';
  const river = dark ? '#3b82a6' : '#6cb9d8';
  const ink = dark ? '#e7dcc4' : '#3b2a1a';
  const shown = new Set<PlaceId>([...pins, ...selectable]);
  const labelSet = new Set<PlaceId>(labels ?? [...shown]);
  const coast =
    'M0 0 H440 V150 C428 160 412 176 400 186 C386 196 372 204 360 214 C350 226 342 240 330 252 C318 264 304 274 296 284 C286 298 280 312 274 322 C264 338 254 352 246 366 C236 384 228 400 222 418 C216 438 216 458 224 474 C232 490 240 506 248 520 H0 Z';
  return (
    <svg viewBox="0 0 440 520" className={className} role="img" aria-label={title}>
      <defs>
        <marker id={`a-${gid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#b91c1c" />
        </marker>
        <marker id={`b-${gid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#0f766e" />
        </marker>
        <pattern id={`s-${gid}`} width="40" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 14 q10 -8 20 0 t20 0" fill="none" stroke={dark ? '#1c3a57' : '#b5dbe8'} strokeWidth="1.6" />
        </pattern>
      </defs>
      <rect width="440" height="520" fill={sea} />
      <rect width="440" height="520" fill={`url(#s-${gid})`} />
      <path d={coast} fill={land} stroke={dark ? '#4b5d78' : '#c9b588'} strokeWidth="2" />
      <path d="M0 0 H200 C170 60 120 110 60 140 C40 150 20 156 0 160 Z" fill={land2} opacity="0.8" />
      {[
        [404, 206, 9, 4],
        [418, 220, 7, 3.5],
        [396, 224, 6, 3],
      ].map(([x, y, rx, ry]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={rx} ry={ry} fill={land} stroke={dark ? '#4b5d78' : '#c9b588'} strokeWidth="1.5" />
      ))}
      <g fill="none" stroke={river} strokeLinecap="round">
        <path d="M18 40 C70 90 120 140 160 180 C176 196 186 212 192 228 C206 262 228 292 266 330" strokeWidth="5" />
        <path d="M190 200 C210 190 228 180 246 176" strokeWidth="3.5" />
        <path d="M246 176 C262 184 274 192 286 200 C304 214 320 228 340 246" strokeWidth="4" />
        <path d="M282 128 C270 145 258 160 248 174" strokeWidth="3" />
        <path d="M112 384 C150 394 182 408 216 422" strokeWidth="3.5" />
      </g>
      <g fill={dark ? '#3a4a68' : '#c8b07c'} stroke={dark ? '#56698a' : '#a68d55'} strokeWidth="1.5" strokeLinejoin="round">
        {[
          [96, 92],
          [126, 70],
          [58, 128],
          [318, 150],
          [300, 88],
          [80, 300],
          [110, 250],
        ].map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x - 12} ${y + 8} L${x} ${y - 10} L${x + 12} ${y + 8} Z`} />
        ))}
      </g>
      {routes.map((r, i) => (
        <path
          key={i}
          d={r.path}
          fill="none"
          stroke={r.enemy ? '#b91c1c' : '#0f766e'}
          strokeWidth="3"
          strokeDasharray="8 6"
          strokeLinecap="round"
          markerEnd={`url(#${r.enemy ? 'a' : 'b'}-${gid})`}
          opacity="0.9"
        />
      ))}
      {[...shown].map((id) => {
        const p = MAP_PLACES[id];
        const isSel = selected === id;
        const isOk = correct === id;
        const isBad = wrong === id;
        const isHi = highlight === id;
        const pickable = selectable.includes(id) && !!onSelect;
        const fill = isOk ? '#0f766e' : isBad ? '#b91c1c' : isSel ? '#d97706' : isHi ? '#b91c1c' : dark ? '#e7dcc4' : '#3b2a1a';
        const anchor = p.anchor ?? 'start';
        const tx = anchor === 'end' ? p.x - 11 : anchor === 'middle' ? p.x : p.x + 11;
        return (
          <g
            key={id}
            role={pickable ? 'button' : undefined}
            tabIndex={pickable ? 0 : undefined}
            aria-label={pickable ? `Chọn ${p.name}` : undefined}
            aria-pressed={pickable ? isSel : undefined}
            onClick={pickable ? () => onSelect?.(id) : undefined}
            onKeyDown={
              pickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(id);
                    }
                  }
                : undefined
            }
            style={pickable ? { cursor: 'pointer' } : undefined}
          >
            {pickable && <circle cx={p.x} cy={p.y} r="22" fill="transparent" />}
            {(isSel || isHi || isOk || isBad) && <circle cx={p.x} cy={p.y} r="13" fill={fill} opacity="0.22" />}
            <circle cx={p.x} cy={p.y} r={pickable ? 8 : 6} fill={fill} stroke={dark ? '#0b1220' : '#fffdf7'} strokeWidth="2.5" />
            {labelSet.has(id) && (
              <text
                x={tx}
                y={p.y + 4 + (p.dy ?? 0)}
                textAnchor={anchor}
                fontSize="13"
                fontWeight="700"
                fill={ink}
                stroke={dark ? '#0b1220' : '#fffdf7'}
                strokeWidth="3.5"
                paintOrder="stroke"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {p.name}
              </text>
            )}
          </g>
        );
      })}
      <text x="12" y="508" fontSize="11" fill={ink} opacity="0.75" style={{ fontFamily: 'var(--font-sans)' }}>
        Lược đồ minh họa – không theo tỉ lệ
      </text>
      <g transform="translate(410 470)" fill={ink} opacity="0.8">
        <path d="M0 -18 L5 0 L0 -4 L-5 0 Z" />
        <text y="14" textAnchor="middle" fontSize="11" fontWeight="700" style={{ fontFamily: 'var(--font-sans)' }}>
          B
        </text>
      </g>
    </svg>
  );
};

/** Nền chiến trận: đồng bằng, sông, biển (có thủy triều và cọc ngầm) */
const BattleBackdrop: React.FC<{ bg: BattleBg; tide?: 'len' | 'dung' | 'rut' | null; dark: boolean; stakes?: boolean }> = ({ bg, tide = null, dark, stakes = false }) => {
  const gid = React.useId().replace(/:/g, '');
  const skyTop = bg === 'sea' ? '#cfe9f2' : '#fde7c8';
  const skyBot = bg === 'sea' ? '#eef7f2' : '#f8e9cf';
  const waterY = tide === 'len' ? 128 : tide === 'dung' ? 138 : tide === 'rut' ? 152 : 136;
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyTop} />
          <stop offset="100%" stopColor={skyBot} />
        </linearGradient>
        <linearGradient id={`sea-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6cb9d8" />
          <stop offset="100%" stopColor="#2f86b0" />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#sky-${gid})`} />
      <circle cx="330" cy="46" r="18" fill="#fbbf24" opacity="0.55" />
      <path d="M0 120 C60 92 110 104 160 96 C220 86 270 100 320 90 C360 84 380 92 400 96 V220 H0 Z" fill="#c9b285" opacity="0.6" />
      <path d="M0 130 C80 112 140 124 200 116 C260 108 330 120 400 112 V220 H0 Z" fill="#b89a66" opacity="0.55" />
      {bg === 'plain' && (
        <g>
          <path d="M0 150 C100 138 200 150 300 142 C350 138 380 142 400 144 V220 H0 Z" fill="#c8ad73" />
          <path d="M0 176 C120 166 240 178 400 168 V220 H0 Z" fill="#b39358" />
          {[30, 90, 160, 250, 330, 370].map((x) => (
            <path key={x} d={`M${x} 196 l4 -8 l4 8`} fill="none" stroke="#8a7140" strokeWidth="2" strokeLinecap="round" />
          ))}
        </g>
      )}
      {bg !== 'plain' && (
        <g>
          <path d={`M0 ${waterY} C80 ${waterY - 6} 160 ${waterY + 4} 240 ${waterY - 2} C300 ${waterY - 6} 360 ${waterY + 2} 400 ${waterY} V220 H0 Z`} fill={`url(#sea-${gid})`} style={{ transition: 'all 0.8s ease' }} />
          <g stroke="#d4f0f8" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.8">
            <path d={`M30 ${waterY + 26} q12 -6 24 0 t24 0`} />
            <path d={`M190 ${waterY + 40} q12 -6 24 0 t24 0`} />
            <path d={`M300 ${waterY + 22} q12 -6 24 0 t24 0`} />
          </g>
          {bg === 'river' && <path d="M0 214 C120 200 260 212 400 200 V220 H0 Z" fill="#9f8452" />}
          {stakes && (
            <g>
              {[40, 78, 116, 154, 192, 230, 268, 306, 344].map((x, i) => (
                <g key={x} transform={`translate(${x} ${168 + (i % 2) * 8})`}>
                  <rect x="-3" y="0" width="6" height="40" fill="#8b5a2b" stroke="#3b2a1a" strokeWidth="1.2" />
                  <path d="M-3 0 L0 -9 L3 0 Z" fill="#94a3b8" stroke="#3b2a1a" strokeWidth="1.2" />
                </g>
              ))}
              {tide !== 'rut' && <path d={`M0 ${Math.min(waterY + 30, 200)} H400 V220 H0 Z`} fill={`url(#sea-${gid})`} opacity="0.92" />}
            </g>
          )}
        </g>
      )}
      {dark && <rect width="400" height="220" fill="#0b1220" opacity="0.5" />}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// game/api – kiểu dữ liệu API học sinh (server chọn câu hỏi và chấm)
// ---------------------------------------------------------------------------

type GQType = 'mcq' | 'tf' | 'order' | 'match' | 'map';

interface ServedOption {
  key: number | string;
  text: string;
}

interface ServedQuestion {
  id: string;
  unit_id: string;
  type: GQType;
  prompt: string;
  level: string;
  topic: string;
  source?: string | null;
  hint?: string | null;
  options?: ServedOption[] | null;
  items?: ServedOption[] | null;
  left?: ServedOption[] | null;
  right?: ServedOption[] | null;
}

interface QuestionsResponse {
  questions: ServedQuestion[];
  mode: string;
  units: string[];
  note?: string | null;
}

interface AnswerPayload {
  choice?: number | string | boolean | null;
  order?: number[];
  pairs?: Record<string, number>;
}

interface AnswerResult {
  question_id: string;
  unit_id: string;
  topic: string;
  correct: boolean;
  reveal: { choice?: number | string | boolean; order?: number[]; pairs?: Record<string, number> };
  explanation: string;
  source: string | null;
  old_p_l: number;
  new_p_l: number;
  p_l_delta: number;
  mastery_status: string;
  attempts: number;
  xp_gained: number;
  gems_gained: number;
  progress: LearnerProgress;
}

interface CodexEntry {
  unit_id: string;
  category: string;
  topic: string;
  entity: string;
  event: string;
  badge: string | null;
  label: string;
  fact_chunk: string;
  answer: string;
  source: string | null;
}

interface QuestionRequest {
  units?: string[];
  count: number;
  mode?: 'mixed' | 'weak';
  types?: GQType[];
  levels?: string[];
  ai?: boolean;
}

// ---------------------------------------------------------------------------
// game/context – trạng thái dùng chung giữa các tab
// ---------------------------------------------------------------------------

interface GameCtx {
  user: AuthUser;
  progress: LearnerProgress;
  state: GameState;
  codex: CodexEntry[];
  dark: boolean;
  update: (fn: (s: GameState) => GameState) => void;
  request: <T>(path: string, opts?: { method?: string; body?: unknown }) => Promise<T>;
  toast: (msg: string) => void;
  fetchQuestions: (req: QuestionRequest) => Promise<QuestionsResponse>;
  submitAnswer: (q: ServedQuestion, payload: AnswerPayload) => Promise<AnswerResult | null>;
  finishSession: (kind: 'practice' | 'battle' | 'recruit' | 'tower' | 'raid', correct: number, total: number) => void;
  spendGems: (amount: number, reason: string) => Promise<boolean>;
  reward: (luong: number, quan: number) => void;
  bumpDaily: (metric: DailyTaskDef['metric'], n?: number) => void;
  askAdvisor: (question: string) => void;
  /** Mở màn thi đấu cả lớp (nhập mã PIN thầy cô đưa) */
  openLive: (pin?: string) => void;
  sound: (kind: 'ok' | 'bad' | 'win') => void;
}

const GameContext = React.createContext<GameCtx | null>(null);

const useGame = (): GameCtx => {
  const ctx = React.useContext(GameContext);
  if (!ctx) throw new Error('useGame phải dùng bên trong GameContext');
  return ctx;
};

/** Đồng hồ cập nhật theo chu kỳ (dùng cho đếm ngược nâng cấp, triệu tập) */
const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
};

/** Âm báo ngắn bằng WebAudio (mặc định tắt) */
const playTone = (kind: 'ok' | 'bad' | 'win') => {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notes = kind === 'ok' ? [660, 880] : kind === 'win' ? [523, 659, 784, 1046] : [220, 170];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === 'bad' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.2);
    });
    window.setTimeout(() => ctx.close(), 1200);
  } catch {
    // Trình duyệt chặn âm thanh: bỏ qua
  }
};

// ---------------------------------------------------------------------------
// game/ui – thành phần giao diện dùng chung
// ---------------------------------------------------------------------------

type GBtnVariant = 'son' | 'ngoc' | 'dong' | 'giay' | 'ghost';

const GBtn = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: GBtnVariant; size?: 'sm' | 'md' | 'lg'; iconOnly?: boolean }
>(({ variant = 'son', size = 'md', iconOnly = false, className = '', type = 'button', ...rest }, ref) => (
  <button
    ref={ref}
    type={type}
    className={`g-btn ${variant === 'son' ? '' : `g-btn-${variant}`} ${size === 'lg' ? 'g-btn-lg' : size === 'sm' ? 'g-btn-sm' : ''} ${iconOnly ? 'g-btn-icon' : ''} ${className}`}
    {...rest}
  />
));
GBtn.displayName = 'GBtn';

const LoreChip: React.FC<{ lore: Lore | string; className?: string }> = ({ lore, className = '' }) => {
  const key = (lore in LORE_LABEL ? lore : 'chinh_su') as Lore;
  return <span className={`g-chip lore-${key} ${className}`}>{LORE_LABEL[key]}</span>;
};

const ElementChip: React.FC<{ element: ElementId; className?: string }> = ({ element, className = '' }) => {
  const el = ELEMENTS[element];
  const Icon = el.Icon;
  return (
    <span className={`g-chip ${el.soft} ${el.text} ${className}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden={true} />
      {el.name}
    </span>
  );
};

const TierChip: React.FC<{ tier: Tier }> = ({ tier }) => (
  <span className="g-chip bg-dong-nhat text-dong-chu">
    {Array.from({ length: TIER_INFO[tier].stars }, (_, i) => (
      <Star key={i} className="w-3 h-3 fill-current" aria-hidden={true} />
    ))}
    {TIER_INFO[tier].name}
  </span>
);

const Stars: React.FC<{ n: number; max?: number; size?: number; label?: string }> = ({ n, max = 3, size = 18, label }) => (
  <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${n}/${max} sao`}>
    {Array.from({ length: max }, (_, i) => (
      <Star key={i} style={{ width: size, height: size }} className={i < n ? 'text-dong fill-dong' : 'text-vien-2'} strokeWidth={2.2} aria-hidden={true} />
    ))}
  </span>
);

const Bar: React.FC<{ value: number; max: number; className?: string; fill?: string; label?: string; height?: number }> = ({
  value,
  max,
  className = '',
  fill = 'bg-ngoc',
  label,
  height,
}) => {
  const pctValue = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`g-bar ${className}`} style={height ? { height } : undefined} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <span className={fill} style={{ width: `${pctValue}%` }} />
    </div>
  );
};

const Spinner: React.FC<{ label?: string; className?: string }> = ({ label = 'Đang tải…', className = '' }) => (
  <span className={`inline-flex items-center gap-2 font-semibold text-muc-2 ${className}`} role="status">
    <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> {label}
  </span>
);

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => <span className={`block rounded-xl bg-giay-2 animate-pulse ${className}`} aria-hidden="true" />;

const InfoNote: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`flex items-start gap-2 text-sm text-muc-2 ${className}`}>
    <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden={true} />
    <span>{children}</span>
  </p>
);

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Bảng trượt (di động) / hộp thoại (máy tính) – có bẫy focus, Esc để đóng */
const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  persistent?: boolean;
  icon?: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children, footer, wide = false, persistent = false, icon }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const a = items[0];
        const b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open, persistent]);

  if (!open) return null;
  return (
    <div className="g-backdrop animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && !persistent && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`g-sheet animate-sheet-up sm:animate-pop-in ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} outline-none`}
      >
        <div className="sticky top-0 z-10 bg-giay/95 backdrop-blur px-4 sm:px-6 pt-3 pb-3 border-b-2 border-vien">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-vien-2 sm:hidden" aria-hidden="true" />
          <div className="flex items-start gap-3">
            {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
            <div className="flex-1 min-w-0">
              <h2 id={titleId} className="font-display font-extrabold text-xl leading-tight text-muc">
                {title}
              </h2>
              {subtitle && <div className="text-sm text-muc-2 mt-0.5">{subtitle}</div>}
            </div>
            {!persistent && (
              <GBtn variant="ghost" iconOnly onClick={onClose} aria-label="Đóng">
                <X className="w-5 h-5" aria-hidden={true} />
              </GBtn>
            )}
          </div>
        </div>
        <div className="px-4 sm:px-6 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 bg-giay/95 backdrop-blur px-4 sm:px-6 py-3 border-t-2 border-vien">{footer}</div>}
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ title, subtitle, action, className = '' }) => (
  <div className={`flex items-end justify-between gap-3 ${className}`}>
    <div className="min-w-0">
      <h2 className="font-display font-extrabold text-2xl leading-tight text-muc">{title}</h2>
      {subtitle && <p className="text-sm text-muc-2 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const EmptyState: React.FC<{ mood?: MascotMood; title: string; text?: string; action?: React.ReactNode }> = ({ mood = 'thinking', title, text, action }) => (
  <div className="g-card-flat p-6 flex flex-col items-center text-center gap-2">
    <Mascot size={96} mood={mood} />
    <p className="font-display font-bold text-lg text-muc">{title}</p>
    {text && <p className="text-sm text-muc-2 max-w-sm">{text}</p>}
    {action}
  </div>
);

/** Hiển thị markdown đơn giản của kho tri thức (**đậm**, gạch đầu dòng •) */
const RichText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <div className={`space-y-2 leading-relaxed ${className}`}>
    {text
      .split(/\n+/)
      .filter((l) => l.trim())
      .map((line, i) => {
        const bullet = /^\s*[•\-*]\s+/.test(line);
        const body = line.replace(/^\s*[•\-*]\s+/, '');
        const parts = body.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j} className="font-bold text-muc">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <React.Fragment key={j}>{part}</React.Fragment>
          )
        );
        return bullet ? (
          <p key={i} className="flex gap-2">
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-dong shrink-0" aria-hidden="true" />
            <span>{parts}</span>
          </p>
        ) : (
          <p key={i}>{parts}</p>
        );
      })}
  </div>
);

// ---------------------------------------------------------------------------
// game/question – hiển thị và trả lời câu hỏi (server chấm)
// ---------------------------------------------------------------------------

const ANSWER_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const TYPE_LABEL: Record<GQType, { text: string; Icon: IconType }> = {
  mcq: { text: 'Trắc nghiệm', Icon: Sparkles },
  tf: { text: 'Đúng hay sai', Icon: Check },
  order: { text: 'Sắp xếp thứ tự', Icon: ListOrdered },
  match: { text: 'Nối cặp', Icon: Link2 },
  map: { text: 'Chọn trên lược đồ', Icon: MapPin },
};
const PAIR_COLORS = ['bg-thuy', 'bg-hoa', 'bg-moc', 'bg-thong', 'bg-tho'];

const QuestionCard: React.FC<{
  q: ServedQuestion;
  index: number;
  total: number;
  timerSec: number | null;
  onAnswered?: (r: AnswerResult) => void;
  onNext: () => void;
  nextLabel?: string;
}> = ({ q, index, total, timerSec, onAnswered, onNext, nextLabel = 'Câu tiếp theo' }) => {
  const { submitAnswer, askAdvisor, dark, sound } = useGame();
  const [phase, setPhase] = useState<'answer' | 'sending' | 'done'>('answer');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [choice, setChoice] = useState<number | string | boolean | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [pairs, setPairs] = useState<Record<string, number>>({});
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(timerSec ?? 0);
  const [extended, setExtended] = useState(false);
  const [hint, setHint] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const submit = useCallback(
    async (payload: AnswerPayload) => {
      setPhase('sending');
      setFailed(false);
      const r = await submitAnswer(q, payload);
      if (!r) {
        setFailed(true);
        setPhase('answer');
        return;
      }
      setResult(r);
      setPhase('done');
      sound(r.correct ? 'ok' : 'bad');
      onAnswered?.(r);
    },
    [q, submitAnswer, sound, onAnswered]
  );

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    if (timerSec === null || phase !== 'answer' || failed) return;
    if (timeLeft <= 0) {
      submitRef.current({ choice: null, order: [], pairs: {} });
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [timeLeft, phase, timerSec, failed]);

  useEffect(() => {
    if (phase === 'done') nextRef.current?.focus();
  }, [phase]);

  const pick = (key: number | string | boolean) => {
    if (phase !== 'answer') return;
    setChoice(key);
    submit({ choice: key });
  };

  const items = q.items ?? [];
  const left = q.left ?? [];
  const right = q.right ?? [];
  const options = q.options ?? [];
  const reveal = result?.reveal ?? {};
  const done = phase === 'done';
  const TypeIcon = TYPE_LABEL[q.type].Icon;

  const optionState = (key: number | string) => {
    if (!done) return choice === key ? 'is-picked' : '';
    if (reveal.choice === key) return 'is-correct';
    if (choice === key) return 'is-wrong';
    return '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="g-chip bg-giay-2 text-muc-2">
          Câu {index + 1}/{total}
        </span>
        <span className="g-chip bg-dong-nhat text-dong-chu">
          <TypeIcon className="w-3.5 h-3.5" aria-hidden={true} /> {TYPE_LABEL[q.type].text}
        </span>
        {q.topic && <span className="g-chip bg-ngoc-nhat text-ngoc-chu max-w-full truncate">{q.topic}</span>}
        {timerSec !== null && phase === 'answer' && (
          <span className={`g-chip ml-auto tabular ${timeLeft <= 5 ? 'bg-son-nhat text-son-chu' : 'bg-giay-2 text-muc-2'}`} aria-live="polite">
            <Timer className="w-3.5 h-3.5" aria-hidden={true} /> {timeLeft} giây
          </span>
        )}
      </div>
      {timerSec !== null && phase === 'answer' && (
        <div className="flex items-center gap-2">
          <Bar value={timeLeft} max={timerSec + (extended ? 15 : 0)} fill={timeLeft <= 5 ? 'bg-son' : 'bg-dong'} label="Thời gian còn lại" className="flex-1" />
          {!extended && (
            <GBtn
              variant="giay"
              size="sm"
              onClick={() => {
                setExtended(true);
                setTimeLeft((v) => v + 15);
              }}
            >
              <Plus className="w-4 h-4" aria-hidden={true} /> Thêm thời gian
            </GBtn>
          )}
        </div>
      )}

      <p className="font-display font-bold text-xl leading-snug text-muc">{q.prompt}</p>
      {q.hint && !done && (
        <div>
          {hint ? (
            <InfoNote>{q.hint}</InfoNote>
          ) : (
            <GBtn variant="ghost" size="sm" onClick={() => setHint(true)}>
              <Lightbulb className="w-4 h-4" aria-hidden={true} /> Gợi ý
            </GBtn>
          )}
        </div>
      )}

      {/* --- Trắc nghiệm --- */}
      {q.type === 'mcq' && (
        <div className="grid gap-2.5">
          {options.map((o, i) => {
            const st = optionState(o.key);
            return (
              <button
                key={String(o.key)}
                type="button"
                disabled={phase !== 'answer'}
                onClick={() => pick(o.key)}
                aria-pressed={choice === o.key}
                className={`ans-btn ${st === 'is-correct' ? 'is-correct' : st === 'is-wrong' ? 'is-wrong' : ''}`}
              >
                <span className="ans-key">{ANSWER_LETTERS[i]}</span>
                <span className="flex-1">{o.text}</span>
                {st === 'is-correct' && <Check className="w-5 h-5 text-ngoc-chu shrink-0" aria-label="Đáp án đúng" />}
                {st === 'is-wrong' && <X className="w-5 h-5 text-son-chu shrink-0" aria-label="Em đã chọn" />}
              </button>
            );
          })}
        </div>
      )}

      {/* --- Đúng / Sai --- */}
      {q.type === 'tf' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: true, text: 'Đúng' },
            { key: false, text: 'Sai' },
          ].map((o) => {
            const st = !done ? '' : reveal.choice === o.key ? 'is-correct' : choice === o.key ? 'is-wrong' : '';
            return (
              <button
                key={o.text}
                type="button"
                disabled={phase !== 'answer'}
                onClick={() => pick(o.key)}
                aria-pressed={choice === o.key}
                className={`ans-btn justify-center !min-h-[64px] font-display !text-lg !font-bold ${st}`}
              >
                {o.key ? <Check className="w-5 h-5" aria-hidden={true} /> : <X className="w-5 h-5" aria-hidden={true} />} {o.text}
              </button>
            );
          })}
        </div>
      )}

      {/* --- Lược đồ --- */}
      {q.type === 'map' && (
        <div className="grid sm:grid-cols-[1fr_200px] gap-3 items-start">
          <div className="g-card-flat overflow-hidden">
            <SchematicMap
              dark={dark}
              className="w-full h-auto max-h-[340px]"
              selectable={done ? [] : (options.map((o) => o.key) as PlaceId[])}
              pins={options.map((o) => o.key) as PlaceId[]}
              labels={[]}
              selected={(choice as PlaceId) ?? null}
              correct={done ? ((reveal.choice as PlaceId) ?? null) : null}
              wrong={done && choice !== reveal.choice ? ((choice as PlaceId) ?? null) : null}
              onSelect={(id) => pick(id)}
              title="Lược đồ: chọn địa danh đúng"
            />
          </div>
          <div className="grid gap-2" aria-label="Hoặc chọn trong danh sách">
            {options.map((o) => {
              const st = optionState(o.key);
              return (
                <button
                  key={String(o.key)}
                  type="button"
                  disabled={phase !== 'answer'}
                  onClick={() => pick(o.key)}
                  aria-pressed={choice === o.key}
                  className={`ans-btn !min-h-[48px] ${st === 'is-correct' ? 'is-correct' : st === 'is-wrong' ? 'is-wrong' : ''}`}
                >
                  <MapPin className="w-4 h-4 shrink-0 text-son-chu" aria-hidden={true} />
                  <span className="flex-1">{o.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Sắp xếp --- */}
      {q.type === 'order' && (
        <div className="space-y-3">
          <ol className="grid gap-2" aria-label="Thứ tự em đã chọn">
            {(done ? reveal.order ?? [] : order).map((key, i) => {
              const it = items.find((x) => x.key === key);
              const mine = order[i];
              const ok = done ? mine === key : null;
              return (
                <li key={`${key}-${i}`}>
                  <button
                    type="button"
                    disabled={done || phase === 'sending'}
                    onClick={() => setOrder((o) => o.filter((k) => k !== key))}
                    className={`ans-btn !min-h-[50px] ${ok === true ? 'is-correct' : ok === false ? 'is-wrong' : ''}`}
                    aria-label={done ? `${i + 1}. ${it?.text}` : `Bỏ "${it?.text}" khỏi thứ tự`}
                  >
                    <span className="ans-key !bg-dong !text-[#1c1917]">{i + 1}</span>
                    <span className="flex-1">{it?.text}</span>
                    {!done && <X className="w-4 h-4 text-muc-3" aria-hidden={true} />}
                  </button>
                </li>
              );
            })}
            {!done &&
              Array.from({ length: items.length - order.length }, (_, i) => (
                <li key={`empty-${i}`} className="rounded-2xl border-2 border-dashed border-vien-2 min-h-[50px] flex items-center px-4 text-sm text-muc-3">
                  Vị trí {order.length + i + 1}
                </li>
              ))}
          </ol>
          {!done && items.length > order.length && (
            <div>
              <p className="text-sm font-semibold text-muc-2 mb-2">Chạm lần lượt theo thứ tự từ sớm đến muộn:</p>
              <div className="flex flex-wrap gap-2">
                {items
                  .filter((it) => !order.includes(it.key as number))
                  .map((it) => (
                    <button key={String(it.key)} type="button" className="ans-btn !w-auto !min-h-[48px]" onClick={() => setOrder((o) => [...o, it.key as number])}>
                      <Plus className="w-4 h-4 text-dong-chu shrink-0" aria-hidden={true} />
                      {it.text}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {!done && (
            <div className="flex gap-2">
              <GBtn variant="giay" onClick={() => setOrder([])} disabled={!order.length || phase === 'sending'}>
                <RotateCcw className="w-4 h-4" aria-hidden={true} /> Làm lại
              </GBtn>
              <GBtn variant="ngoc" className="flex-1" disabled={order.length !== items.length || phase === 'sending'} onClick={() => submit({ order })}>
                {phase === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> : <Check className="w-5 h-5" aria-hidden={true} />} Kiểm tra
              </GBtn>
            </div>
          )}
        </div>
      )}

      {/* --- Nối cặp --- */}
      {q.type === 'match' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muc-2">Chạm một ô bên trái, rồi chạm ô bên phải tương ứng.</p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="grid gap-2 content-start">
              {left.map((l, i) => {
                const paired = pairs[String(l.key)];
                const ok = done ? (reveal.pairs ?? {})[String(l.key)] === paired : null;
                return (
                  <button
                    key={String(l.key)}
                    type="button"
                    disabled={done || phase === 'sending'}
                    onClick={() => setActiveLeft(activeLeft === (l.key as number) ? null : (l.key as number))}
                    aria-pressed={activeLeft === l.key}
                    className={`ans-btn !min-h-[56px] !text-[0.95rem] ${activeLeft === l.key ? '!border-dong !bg-dong-nhat' : ''} ${ok === true ? 'is-correct' : ok === false ? 'is-wrong' : ''}`}
                  >
                    <span className={`w-6 h-6 rounded-full shrink-0 ${paired !== undefined ? PAIR_COLORS[i % PAIR_COLORS.length] : 'bg-giay-2'} text-white text-xs font-bold flex items-center justify-center`}>
                      {i + 1}
                    </span>
                    <span className="flex-1">{l.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 content-start">
              {right.map((r) => {
                const owner = Object.entries(pairs).find(([, v]) => v === r.key)?.[0];
                const ownerIdx = owner === undefined ? -1 : left.findIndex((l) => String(l.key) === owner);
                const correctOwner = done ? Object.entries(reveal.pairs ?? {}).find(([, v]) => v === r.key)?.[0] : undefined;
                return (
                  <button
                    key={String(r.key)}
                    type="button"
                    disabled={done || phase === 'sending' || activeLeft === null}
                    onClick={() => {
                      if (activeLeft === null) return;
                      setPairs((p) => {
                        const next: Record<string, number> = {};
                        for (const [k, v] of Object.entries(p)) if (v !== r.key && k !== String(activeLeft)) next[k] = v;
                        next[String(activeLeft)] = r.key as number;
                        return next;
                      });
                      setActiveLeft(null);
                    }}
                    className="ans-btn !min-h-[56px] !text-[0.95rem]"
                  >
                    {ownerIdx >= 0 && (
                      <span className={`w-6 h-6 rounded-full shrink-0 ${PAIR_COLORS[ownerIdx % PAIR_COLORS.length]} text-white text-xs font-bold flex items-center justify-center`}>
                        {ownerIdx + 1}
                      </span>
                    )}
                    <span className="flex-1">{r.text}</span>
                    {done && correctOwner !== undefined && (
                      <span className="g-chip bg-ngoc-nhat text-ngoc-chu shrink-0">đúng: {left.findIndex((l) => String(l.key) === correctOwner) + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {!done && (
            <div className="flex gap-2">
              <GBtn variant="giay" onClick={() => setPairs({})} disabled={!Object.keys(pairs).length || phase === 'sending'}>
                <RotateCcw className="w-4 h-4" aria-hidden={true} /> Làm lại
              </GBtn>
              <GBtn variant="ngoc" className="flex-1" disabled={Object.keys(pairs).length !== left.length || phase === 'sending'} onClick={() => submit({ pairs })}>
                {phase === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> : <Check className="w-5 h-5" aria-hidden={true} />} Kiểm tra
              </GBtn>
            </div>
          )}
        </div>
      )}

      {phase === 'sending' && (q.type === 'mcq' || q.type === 'tf' || q.type === 'map') && <Spinner label="Đang chấm…" />}
      {failed && (
        <div role="alert" className="rounded-2xl bg-son-nhat text-son-chu p-3 flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden={true} /> Chưa gửi được câu trả lời. Kiểm tra kết nối rồi chọn lại nhé.
        </div>
      )}

      {/* --- Phản hồi --- */}
      {done && result && (
        <div className={`rounded-3xl p-4 border-2 animate-pop-in ${result.correct ? 'bg-ngoc-nhat border-ngoc' : 'bg-son-nhat border-son'}`} role="status" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${result.correct ? 'bg-ngoc' : 'bg-son'}`}>
              {result.correct ? <Check className="w-5 h-5" aria-hidden={true} /> : <X className="w-5 h-5" aria-hidden={true} />}
            </span>
            <p className={`font-display font-extrabold text-xl ${result.correct ? 'text-ngoc-chu' : 'text-son-chu'}`}>{result.correct ? 'Chính xác!' : 'Chưa đúng rồi'}</p>
            <span className="ml-auto flex flex-wrap gap-1.5">
              {result.gems_gained > 0 && (
                <span className="g-chip bg-the text-dong-chu">
                  <Stamp className="w-3.5 h-3.5" aria-hidden={true} /> +{result.gems_gained} Ấn Tín
                </span>
              )}
              <span className="g-chip bg-the text-muc-2">+{result.xp_gained} XP</span>
            </span>
          </div>
          <p className="mt-2 text-muc leading-relaxed">{result.explanation}</p>
          {result.correct && result.gems_gained === 0 && result.progress.day_gems >= result.progress.daily_gem_cap && (
            <p className="mt-1 text-sm text-muc-2">Hôm nay em đã nhận đủ {result.progress.daily_gem_cap} Ấn Tín – vẫn được cộng XP.</p>
          )}
          {result.source && <p className="mt-2 text-xs font-semibold text-muc-2">Nguồn: {result.source}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <GBtn ref={nextRef} variant={result.correct ? 'ngoc' : 'son'} className="flex-1 min-w-[160px]" onClick={onNext}>
              {nextLabel} <ArrowRight className="w-5 h-5" aria-hidden={true} />
            </GBtn>
            {!result.correct && (
              <GBtn variant="giay" onClick={() => askAdvisor(`Giải thích giúp em: ${q.prompt}`)}>
                <MessageSquare className="w-4 h-4" aria-hidden={true} /> Hỏi Quân Sư
              </GBtn>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface QuizSummary {
  correct: number;
  total: number;
  passed: boolean;
  results: AnswerResult[];
  gems: number;
  xp: number;
}

/** Một lượt hỏi đáp gồm nhiều câu (khảo thí, mở khóa, nâng cấp, chiêu mộ…) */
const QuizSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  request: QuestionRequest;
  passMark?: number;
  timer?: boolean;
  intro?: React.ReactNode;
  finishLabel?: string;
  sessionKind?: 'practice' | 'tower' | 'recruit' | 'raid' | null;
  onFinish?: (summary: QuizSummary) => void;
}> = ({ open, onClose, title, subtitle, request, passMark, timer = false, intro, finishLabel = 'Hoàn thành', sessionKind = 'practice', onFinish }) => {
  const { fetchQuestions, state, finishSession, sound } = useGame();
  const [questions, setQuestions] = useState<ServedQuestion[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [finished, setFinished] = useState(false);
  const loadId = useRef(0);
  const reqKey = JSON.stringify(request);

  const load = useCallback(() => {
    const id = ++loadId.current;
    setQuestions(null);
    setError(null);
    setIndex(0);
    setResults([]);
    setFinished(false);
    fetchQuestions(JSON.parse(reqKey) as QuestionRequest)
      .then((res) => {
        if (id !== loadId.current) return;
        if (!res.questions.length) setError('Chưa có câu hỏi phù hợp. Em thử chủ đề khác nhé.');
        setQuestions(res.questions);
        setNote(res.note ?? null);
      })
      .catch((err) => id === loadId.current && setError(err instanceof Error ? err.message : 'Không tải được câu hỏi'));
  }, [fetchQuestions, reqKey]);

  useEffect(() => {
    if (open) load();
    else loadId.current++;
  }, [open, load]);

  const total = questions?.length ?? request.count;
  const correct = results.filter((r) => r.correct).length;
  const need = passMark ?? Math.ceil(total * 0.6);
  const passed = correct >= need;
  const timerSec = timer && state.settings.timer ? 20 : null;

  const next = () => {
    if (!questions) return;
    if (index + 1 < questions.length) setIndex(index + 1);
    else {
      setFinished(true);
      if (sessionKind) finishSession(sessionKind, correct, questions.length);
      if (passed) sound('win');
    }
  };

  const summary: QuizSummary = {
    correct,
    total,
    passed,
    results,
    gems: results.reduce((s, r) => s + r.gems_gained, 0),
    xp: results.reduce((s, r) => s + r.xp_gained, 0),
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} wide>
      {intro && !finished && index === 0 && results.length === 0 && <div className="mb-4">{intro}</div>}
      {note && !finished && <InfoNote className="mb-3">{note}</InfoNote>}
      {error ? (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <Mascot size={90} mood="sad" />
          <p className="font-semibold text-muc">{error}</p>
          <GBtn variant="ngoc" onClick={load}>
            <RefreshCw className="w-4 h-4" aria-hidden={true} /> Thử lại
          </GBtn>
        </div>
      ) : !questions ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Spinner label="Quân Sư đang chọn câu hỏi…" />
        </div>
      ) : finished ? (
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <Mascot size={110} mood={passed ? 'excited' : 'thinking'} accessory={passed ? 'crown' : 'scholar'} bob />
          <p className="font-display font-extrabold text-2xl text-muc">{passed ? 'Xuất sắc!' : 'Cố lên chút nữa!'}</p>
          <p className="text-muc-2">
            Em trả lời đúng <strong className="text-muc">{correct}/{total}</strong> câu{passMark !== undefined ? ` (cần ${need})` : ''}.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="g-chip bg-dong-nhat text-dong-chu !text-sm">
              <Stamp className="w-4 h-4" aria-hidden={true} /> +{summary.gems} Ấn Tín
            </span>
            <span className="g-chip bg-ngoc-nhat text-ngoc-chu !text-sm">+{summary.xp} XP</span>
          </div>
          {!passed && <InfoNote>Câu sai đã có giải thích. Em có thể làm lại – mỗi lần câu hỏi sẽ khác.</InfoNote>}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {!passed && (
              <GBtn variant="giay" onClick={load}>
                <RotateCcw className="w-4 h-4" aria-hidden={true} /> Làm lại
              </GBtn>
            )}
            <GBtn
              variant={passed ? 'ngoc' : 'son'}
              size="lg"
              onClick={() => {
                onFinish?.(summary);
                onClose();
              }}
            >
              <Trophy className="w-5 h-5" aria-hidden={true} /> {finishLabel}
            </GBtn>
          </div>
        </div>
      ) : (
        <QuestionCard
          key={questions[index].id + index}
          q={questions[index]}
          index={index}
          total={questions.length}
          timerSec={timerSec}
          onAnswered={(r) => setResults((rs) => [...rs, r])}
          onNext={next}
          nextLabel={index + 1 < questions.length ? 'Câu tiếp theo' : 'Xem kết quả'}
        />
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------------
// game/farm – Điền Trang Đông A (căn cứ và tài nguyên nhàn rỗi)
// ---------------------------------------------------------------------------

/** Lương Thảo đang chờ thu trên ruộng (tính theo mốc thời gian, có trần) */
const farmReady = (state: GameState, now: number) => {
  const b = state.buildings.ruong;
  if (b.level <= 0) return 0;
  const produced = ((now - b.lastCollect) / 3_600_000) * farmRate(b.level);
  return Math.max(0, Math.min(farmCap(b.level), Math.floor(produced)));
};

const raidDue = (state: GameState) => state.raid.sessions >= 3 && state.raid.lastDay !== todayKey() && state.luong >= 60;

/** Hoàn tất các công trình đã nâng cấp xong */
const finalizeUpgrades = (s: GameState, now: number): GameState => {
  let changed = false;
  const buildings = { ...s.buildings };
  for (const b of BUILDINGS) {
    const cur = buildings[b.id];
    if (cur.upgradeEnds && cur.upgradeEnds <= now) {
      changed = true;
      buildings[b.id] = { ...cur, level: Math.min(b.maxLevel, cur.level + 1), upgradeEnds: null, lastCollect: b.id === 'ruong' && cur.level === 0 ? now : cur.lastCollect };
    }
  }
  if (!changed) return s;
  const relics = [...s.relics];
  if (buildings.ben.level >= 3 && !relics.includes('non_ma_loi')) relics.push('non_ma_loi');
  return { ...s, buildings, relics };
};

const BuildingButton: React.FC<{ def: BuildingDef; now: number; onOpen: () => void }> = ({ def, now, onOpen }) => {
  const { state } = useGame();
  const b = state.buildings[def.id];
  const upgrading = b.upgradeEnds !== null && b.upgradeEnds > now;
  const ready = def.id === 'ruong' ? farmReady(state, now) : 0;
  const full = def.id === 'ruong' && ready >= farmCap(b.level) * 0.5;
  let badge: React.ReactNode = null;
  if (upgrading)
    badge = (
      <span className="bld-badge bg-the text-muc border-2 border-vien">
        <Clock className="w-3.5 h-3.5" aria-hidden={true} /> {fmtClock(((b.upgradeEnds ?? now) - now) / 1000)}
      </span>
    );
  else if (b.level === 0)
    badge = (
      <span className="bld-badge bg-dong text-[#1c1917]">
        <Hammer className="w-3.5 h-3.5" aria-hidden={true} /> Xây
      </span>
    );
  else if (def.id === 'ruong' && ready >= 5)
    badge = (
      <span className={`bld-badge bg-ngoc text-white ${ready >= 20 ? 'animate-badge-bob' : ''}`}>
        <Wheat className="w-3.5 h-3.5" aria-hidden={true} /> +{fmt(ready)}
      </span>
    );
  const label = `${def.name}, ${b.level === 0 ? 'chưa xây' : `cấp ${b.level}`}${upgrading ? ', đang nâng cấp' : ''}${def.id === 'ruong' && ready ? `, có ${ready} Lương Thảo chờ thu` : ''}`;
  return (
    <button
      type="button"
      className="bld"
      style={{ left: `${def.pos.x}%`, top: `${def.pos.y}%`, width: `${def.pos.w}%`, height: `${def.pos.h}%` }}
      onClick={onOpen}
      aria-label={label}
    >
      {badge}
      <BuildingSprite id={def.id} level={b.level} full={full} className={`w-full flex-1 min-h-0 drop-shadow-sm ${upgrading ? 'opacity-80' : ''}`} />
      <span className="bld-name">
        {def.name}
        {b.level > 0 && <span className="ml-1 text-dong-chu">· {b.level}</span>}
      </span>
    </button>
  );
};

const BuildingSheet: React.FC<{ id: BuildingId | null; now: number; onClose: () => void; onGoto: (tab: GameTab, sub?: string) => void }> = ({ id, now, onClose, onGoto }) => {
  const { state, update, progress, spendGems, toast, bumpDaily } = useGame();
  const [quiz, setQuiz] = useState(false);
  const def = id ? BUILDING_BY_ID[id] : null;
  if (!def) return null;
  const b = state.buildings[def.id];
  const upgrading = b.upgradeEnds !== null && b.upgradeEnds > now;
  const toLevel = b.level + 1;
  const maxed = b.level >= def.maxLevel;
  const cost = b.level === 0 ? { luong: def.buildCost, gems: 0 } : upgradeCost(def, toLevel);
  const canPay = state.luong >= cost.luong && progress.gems >= cost.gems;
  const ready = def.id === 'ruong' ? farmReady(state, now) : 0;
  const storeLeft = storeCap(state.buildings.kho.level) - state.luong;

  const startUpgrade = async () => {
    if (cost.gems > 0 && !(await spendGems(cost.gems, `nang_cap:${def.id}:${toLevel}`))) return;
    const seconds = b.level === 0 ? 20 : UPGRADE_SECONDS[Math.min(5, toLevel)];
    update((s) => ({
      ...s,
      luong: Math.max(0, s.luong - cost.luong),
      buildings: { ...s.buildings, [def.id]: { ...s.buildings[def.id], upgradeEnds: Date.now() + seconds * 1000 } },
    }));
    toast(b.level === 0 ? `Bắt đầu xây ${def.name}` : `Bắt đầu nâng ${def.name} lên cấp ${toLevel}`);
  };

  const harvest = () => {
    const take = Math.min(ready, Math.max(0, storeLeft));
    if (take <= 0) {
      toast(storeLeft <= 0 ? 'Kho Bí Mật đã đầy – hãy nâng cấp kho' : 'Ruộng chưa có lúa chín');
      return;
    }
    const rate = farmRate(b.level);
    update((s) => ({
      ...s,
      luong: s.luong + take,
      buildings: {
        ...s.buildings,
        ruong: { ...s.buildings.ruong, lastCollect: take >= ready ? Date.now() : s.buildings.ruong.lastCollect + (take / rate) * 3_600_000 },
      },
      stats: { ...s.stats, harvests: s.stats.harvests + 1 },
    }));
    bumpDaily('harvest');
    toast(`Thu hoạch +${fmt(take)} Lương Thảo`);
  };

  const trade = (luong: number, effect: (s: GameState) => GameState, msg: string) => {
    if (state.luong < luong) {
      toast('Chưa đủ Lương Thảo');
      return;
    }
    update((s) => effect({ ...s, luong: s.luong - luong }));
    toast(msg);
  };
  const quanCap = troopCap(state.buildings.trai.level);
  const batch = 5 * state.buildings.trai.level;

  return (
    <>
      <Sheet
        open={!!id && !quiz}
        onClose={onClose}
        title={def.name}
        subtitle={b.level === 0 ? 'Chưa xây' : `Cấp ${b.level}/${def.maxLevel} · ${def.levelText(b.level)}`}
        icon={<BuildingSprite id={def.id} level={Math.max(1, b.level)} className="w-16 h-14" />}
      >
        <div className="space-y-4">
          <p className="text-muc leading-relaxed">{def.desc}</p>

          {def.id === 'ruong' && b.level > 0 && (
            <div className="g-card-flat p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muc-2">Lúa chín chờ thu</span>
                <span className="font-display font-extrabold text-xl text-ngoc-chu tabular">
                  {fmt(ready)} / {fmt(farmCap(b.level))}
                </span>
              </div>
              <Bar value={ready} max={farmCap(b.level)} fill="bg-ngoc" label="Lúa chín trên ruộng" />
              <GBtn variant="ngoc" size="lg" className="w-full" onClick={harvest} disabled={ready < 1}>
                <Wheat className="w-5 h-5" aria-hidden={true} /> Thu hoạch
              </GBtn>
              <InfoNote>Ruộng vẫn sinh lúa khi em tắt máy, tối đa 8 giờ sản lượng. Thời bình binh lính về làm ruộng – đó là “ngụ binh ư nông”.</InfoNote>
            </div>
          )}

          {def.id === 'trai' && b.level > 0 && (
            <div className="g-card-flat p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muc-2">Quân Lực</span>
                <span className="font-display font-extrabold text-xl tabular">
                  {fmt(state.quan)} / {fmt(quanCap)}
                </span>
              </div>
              <GBtn
                variant="son"
                className="w-full"
                disabled={state.quan >= quanCap}
                onClick={() =>
                  trade(batch * 10, (s) => ({ ...s, quan: Math.min(quanCap, s.quan + batch) }), `Đã gọi ${batch} Quân Lực ra trận`)
                }
              >
                <Shield className="w-5 h-5" aria-hidden={true} /> Gọi {batch} Quân Lực ({batch * 10} Lương Thảo)
              </GBtn>
              <GBtn variant="giay" className="w-full" onClick={() => trade(60, (s) => ({ ...s, cards: { ...s.cards, dan_binh: (s.cards.dan_binh ?? 0) + 1 } }), 'Nhận thẻ Dân binh Ngụ Binh')}>
                <Users className="w-5 h-5" aria-hidden={true} /> Gọi Dân binh Ngụ Binh (60 Lương Thảo)
              </GBtn>
              {state.heroes.quan_sat_that && (
                <GBtn variant="giay" className="w-full" onClick={() => trade(120, (s) => ({ ...s, cards: { ...s.cards, quan_sat_that: (s.cards.quan_sat_that ?? 0) + 1 } }), 'Nhận thẻ Quân Sát Thát')}>
                  <BicepsFlexed className="w-5 h-5" aria-hidden={true} /> Huấn luyện Quân Sát Thát (120 Lương Thảo)
                </GBtn>
              )}
              <p className="text-sm text-muc-2">Thẻ đang có: Dân binh ×{state.cards.dan_binh ?? 0}{state.heroes.quan_sat_that ? ` · Quân Sát Thát ×${state.cards.quan_sat_that ?? 0}` : ''}</p>
            </div>
          )}

          {def.id === 'kho' && (
            <div className="g-card-flat p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muc-2">Lương Thảo trong kho</span>
                <span className="font-display font-extrabold text-xl tabular">
                  {fmt(state.luong)} / {fmt(storeCap(b.level))}
                </span>
              </div>
              <Bar value={state.luong} max={storeCap(b.level)} fill="bg-dong" label="Lương Thảo trong kho" />
              <InfoNote>Khi giặc kéo đến cướp lương, chọn “Vườn không nhà trống” để giấu hết lương vào kho – giặc vào điền trang trống sẽ kiệt sức mà rút.</InfoNote>
            </div>
          )}

          {def.id === 'xuong' && (
            <ol className="grid gap-2">
              {['Cọc gỗ đẽo nhọn', 'Cọc gỗ đầu bịt sắt', 'Trận địa cọc kết hợp mai phục (4/1288)'].map((t, i) => (
                <li key={t} className={`g-card-flat p-3 flex items-center gap-3 ${b.level >= i + 1 ? '' : 'opacity-60'}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${b.level >= i + 1 ? 'bg-dong text-[#1c1917]' : 'bg-giay-2 text-muc-3'}`}>{i + 1}</span>
                  <span className="font-semibold">{t}</span>
                  {b.level >= i + 1 && <Check className="w-5 h-5 text-ngoc-chu ml-auto" aria-label="Đã có" />}
                </li>
              ))}
              <InfoNote>Cấp xưởng càng cao, tuyệt chiêu “Đại trận Bạch Đằng” càng mạnh (Màn 3).</InfoNote>
            </ol>
          )}

          {def.id === 'ben' && b.level > 0 && (
            <div className="g-card-flat p-4 space-y-2">
              <GBtn variant="giay" className="w-full" onClick={() => trade(80, (s) => ({ ...s, cards: { ...s.cards, thuy_binh: (s.cards.thuy_binh ?? 0) + 1 } }), 'Nhận thẻ Thủy binh')}>
                <Sailboat className="w-5 h-5" aria-hidden={true} /> Gọi Thủy binh (80 Lương Thảo)
              </GBtn>
              <p className="text-sm text-muc-2">Thẻ Thủy binh: ×{state.cards.thuy_binh ?? 0}. Nâng bến lên cấp 3 để nhận cổ vật Nón Ma Lôi.</p>
            </div>
          )}

          {(def.id === 'doanh' || def.id === 'hoiquan' || def.id === 'qtg') && b.level > 0 && (
            <GBtn
              variant="ngoc"
              size="lg"
              className="w-full"
              onClick={() => {
                onClose();
                onGoto(def.id === 'qtg' ? 'exam' : 'barracks', def.id === 'hoiquan' ? 'recruit' : 'heroes');
              }}
            >
              {def.id === 'qtg' ? 'Vào Quốc Tử Giám' : def.id === 'hoiquan' ? 'Vào Hội Quán Vạn Kiếp' : 'Vào Doanh Trại'} <ChevronRight className="w-5 h-5" aria-hidden={true} />
            </GBtn>
          )}

          <div className="g-inset p-4 space-y-3">
            <div className="flex items-center gap-2 font-display font-bold text-lg">
              <ArrowUpCircle className="w-5 h-5 text-dong-chu" aria-hidden={true} />
              {maxed ? 'Đã đạt cấp tối đa' : b.level === 0 ? 'Xây công trình' : `Nâng lên cấp ${toLevel}`}
            </div>
            {upgrading ? (
              <div className="space-y-2">
                <p className="font-semibold">
                  Đang thi công · còn <span className="tabular">{fmtClock(((b.upgradeEnds ?? now) - now) / 1000)}</span>
                </p>
                <Bar value={1 - ((b.upgradeEnds ?? now) - now) / ((b.level === 0 ? 20 : UPGRADE_SECONDS[Math.min(5, toLevel)]) * 1000)} max={1} fill="bg-dong" label="Tiến độ thi công" />
              </div>
            ) : (
              !maxed && (
                <>
                  <p className="text-sm text-muc-2">{def.levelText(toLevel)}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`g-chip !text-sm ${state.luong >= cost.luong ? 'bg-the text-muc' : 'bg-son-nhat text-son-chu'}`}>
                      <Wheat className="w-4 h-4" aria-hidden={true} /> {fmt(cost.luong)} Lương Thảo
                    </span>
                    {cost.gems > 0 && (
                      <span className={`g-chip !text-sm ${progress.gems >= cost.gems ? 'bg-the text-muc' : 'bg-son-nhat text-son-chu'}`}>
                        <Stamp className="w-4 h-4" aria-hidden={true} /> {cost.gems} Ấn Tín
                      </span>
                    )}
                    <span className="g-chip !text-sm bg-the text-muc-2">
                      <Clock className="w-4 h-4" aria-hidden={true} /> {fmtClock(b.level === 0 ? 20 : UPGRADE_SECONDS[Math.min(5, toLevel)])}
                    </span>
                  </div>
                  <GBtn variant="dong" size="lg" className="w-full" disabled={!canPay} onClick={() => setQuiz(true)}>
                    <Hammer className="w-5 h-5" aria-hidden={true} /> Trả lời 1 câu để {b.level === 0 ? 'xây' : 'nâng cấp'}
                  </GBtn>
                  {!canPay && <p className="text-sm text-son-chu font-semibold">Chưa đủ tài nguyên. Thu hoạch ruộng hoặc trả lời đúng ở Quốc Tử Giám để có thêm.</p>}
                </>
              )
            )}
          </div>
        </div>
      </Sheet>
      <QuizSheet
        open={quiz}
        onClose={() => setQuiz(false)}
        title={`${b.level === 0 ? 'Xây' : 'Nâng cấp'} ${def.name}`}
        subtitle="Trả lời đúng để bắt đầu thi công"
        request={{ units: [def.unit], count: 1 }}
        passMark={1}
        sessionKind={null}
        finishLabel="Tiếp tục"
        onFinish={(sum) => {
          if (sum.passed) startUpgrade();
          else toast('Chưa trả lời đúng – công trình chưa được thi công. Thử lại nhé!');
        }}
      />
    </>
  );
};

/** Sự kiện “Giặc Mông – Nguyên cướp lương” */
const RaidEvent: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { state, update, toast, fetchQuestions, sound, finishSession } = useGame();
  const [stage, setStage] = useState<'alarm' | 'choose' | 'question' | 'result'>('alarm');
  const [mode, setMode] = useState<'vuon_khong' | 'chan' | null>(null);
  const [q, setQ] = useState<ServedQuestion | null>(null);
  const [outcome, setOutcome] = useState<{ title: string; text: string; delta: number; good: boolean } | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [stamina, setStamina] = useState(100);
  const lastCorrect = useRef(false);
  const timed = state.settings.timer;

  const resolve = useCallback(
    (m: 'vuon_khong' | 'chan' | null, correct: boolean) => {
      const luong = state.luong;
      let delta = 0;
      let title = '';
      let text = '';
      let good = false;
      if (m === 'vuon_khong' && correct) {
        delta = Math.max(20, Math.round(luong * 0.1));
        title = 'Giặc đói kiệt, phải rút lui!';
        text = 'Toàn bộ lương đã vào Kho Bí Mật. Giặc vào điền trang trống, không cướp được gì nên kiệt sức mà rút. Em nhận thêm phần thưởng.';
        good = true;
      } else if (m === 'vuon_khong') {
        delta = -Math.round(luong * 0.05);
        title = 'Giấu được một nửa số lương';
        text = 'Chưa trả lời đúng nên chỉ kịp giấu 50% lương vào kho. Giặc cướp được một ít rồi rút đi.';
      } else if (m === 'chan' && correct) {
        delta = Math.round(luong * 0.05);
        title = 'Đánh chặn thành công!';
        text = 'Quân ta chặn đánh, giặc không cướp được lương.';
        good = true;
      } else {
        delta = -Math.round(luong * 0.1);
        title = 'Giặc cướp được một ít lương';
        text = m ? 'Đánh chặn chưa thành công.' : 'Không kịp ứng phó.';
      }
      update((s) => ({ ...s, luong: Math.max(0, s.luong + delta), raid: { sessions: 0, lastDay: todayKey() } }));
      setOutcome({ title, text, delta, good });
      setStage('result');
      sound(good ? 'win' : 'bad');
    },
    [state.luong, update, sound]
  );

  useEffect(() => {
    if (!timed || stage === 'result' || stage === 'question') return;
    if (seconds <= 0) {
      resolve(null, false);
      return;
    }
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds, stage, timed, resolve]);

  useEffect(() => {
    if (stage !== 'result' || !outcome?.good || mode !== 'vuon_khong') return;
    const t = window.setInterval(() => setStamina((s) => Math.max(0, s - 10)), 140);
    return () => window.clearInterval(t);
  }, [stage, outcome, mode]);

  const choose = (m: 'vuon_khong' | 'chan') => {
    setMode(m);
    setStage('question');
    fetchQuestions({ units: m === 'vuon_khong' ? ['KC1_VUON_KHONG_NHA_TRONG'] : ['KC1_OVERVIEW', 'KC1_DONG_BO_DAU', 'CAUSES_OF_VICTORY'], count: 1 })
      .then((res) => setQ(res.questions[0] ?? null))
      .catch(() => {
        toast('Không tải được câu hỏi');
        setStage('choose');
      });
  };

  return (
    <Sheet
      open
      persistent={stage !== 'result'}
      onClose={onDone}
      title="Báo động! Giặc kéo đến cướp lương"
      subtitle={stage === 'result' ? 'Kết quả ứng phó' : 'Quân xâm lược đi xa, phải dựa vào lương cướp tại chỗ.'}
      icon={<span className="w-11 h-11 rounded-2xl bg-son text-white flex items-center justify-center animate-alarm"><Siren className="w-6 h-6" aria-hidden={true} /></span>}
      wide
    >
      {(stage === 'alarm' || stage === 'choose') && (
        <div className="space-y-4">
          <div className="relative h-24 rounded-2xl overflow-hidden bg-giay-2" aria-hidden="true">
            <BattleBackdrop bg="plain" dark={false} />
            <div className="absolute inset-y-0 right-0 flex items-center gap-3 pr-4 animate-march">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-12 h-12 rounded-xl bg-dich text-white flex items-center justify-center shadow">
                  <ChessKnight className="w-7 h-7" aria-hidden={true} />
                </span>
              ))}
            </div>
          </div>
          {timed && (
            <div className="flex items-center gap-3" aria-live="polite">
              <Bar value={seconds} max={30} fill={seconds <= 10 ? 'bg-son' : 'bg-dong'} className="flex-1" label="Thời gian ứng phó" />
              <span className="font-display font-extrabold text-xl tabular w-14 text-right">{seconds}s</span>
            </div>
          )}
          <p className="font-semibold">
            Giặc sắp đến Điền Trang. Trong kho có <strong>{fmt(state.luong)}</strong> Lương Thảo. Em chọn cách ứng phó:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button type="button" className="g-card p-4 text-left hover:-translate-y-0.5 transition" onClick={() => choose('vuon_khong')}>
              <span className="w-11 h-11 rounded-2xl bg-ngoc text-white flex items-center justify-center mb-2">
                <Warehouse className="w-6 h-6" aria-hidden={true} />
              </span>
              <p className="font-display font-extrabold text-lg">Vườn không nhà trống</p>
              <p className="text-sm text-muc-2 mt-1">Giấu hết lương vào Kho Bí Mật. Trả lời 1 câu “Vì sao…?”.</p>
            </button>
            <button type="button" className="g-card p-4 text-left hover:-translate-y-0.5 transition" onClick={() => choose('chan')}>
              <span className="w-11 h-11 rounded-2xl bg-son text-white flex items-center justify-center mb-2">
                <Swords className="w-6 h-6" aria-hidden={true} />
              </span>
              <p className="font-display font-extrabold text-lg">Đánh chặn</p>
              <p className="text-sm text-muc-2 mt-1">Ra quân chặn giặc. Trả lời 1 câu để thắng trận phòng thủ ngắn.</p>
            </button>
          </div>
          <InfoNote>Tệ nhất em chỉ mất 10% Lương Thảo. Không mất tướng, không mất công trình.</InfoNote>
        </div>
      )}
      {stage === 'question' &&
        (q ? (
          <QuestionCard
            q={q}
            index={0}
            total={1}
            timerSec={null}
            nextLabel="Xem kết quả"
            onAnswered={(r) => {
              lastCorrect.current = r.correct;
              finishSession('raid', r.correct ? 1 : 0, 1);
            }}
            onNext={() => resolve(mode, lastCorrect.current)}
          />
        ) : (
          <Spinner label="Đang chuẩn bị câu hỏi…" />
        ))}
      {stage === 'result' && outcome && (
        <div className="space-y-4 text-center">
          {mode === 'vuon_khong' && outcome.good && (
            <div className="g-card-flat p-4 text-left space-y-2">
              <p className="font-semibold text-muc-2">Sức bền của giặc</p>
              <Bar value={stamina} max={100} fill="bg-son" label="Sức bền của giặc" height={16} />
              <p className="text-sm text-muc-2">Không cướp được lương, giặc tụt sức bền rồi phải rút.</p>
            </div>
          )}
          <Mascot size={100} mood={outcome.good ? 'excited' : 'sad'} accessory={outcome.good ? 'helmet' : 'none'} className="mx-auto" />
          <p className="font-display font-extrabold text-2xl">{outcome.title}</p>
          <p className="text-muc-2">{outcome.text}</p>
          <p className={`font-display font-extrabold text-xl ${outcome.delta >= 0 ? 'text-ngoc-chu' : 'text-son-chu'}`}>
            {outcome.delta >= 0 ? '+' : ''}
            {fmt(outcome.delta)} Lương Thảo
          </p>
          <div className="g-inset p-4 text-left">
            <p className="font-display font-bold mb-1">Bài học lịch sử</p>
            <p className="text-muc leading-relaxed">
              Quân xâm lược đi xa, phải dựa vào lương cướp tại chỗ và đoàn vận lương. Khi nhân dân thực hiện “vườn không nhà trống”, giặc không cướp được lương nên kiệt sức và buộc
              phải rút – như ở Thăng Long năm 1258.
            </p>
          </div>
          <GBtn variant="ngoc" size="lg" className="w-full" onClick={onDone}>
            <Check className="w-5 h-5" aria-hidden={true} /> Về Điền Trang
          </GBtn>
        </div>
      )}
    </Sheet>
  );
};

const DailyPanel: React.FC = () => {
  const { state, update, toast } = useGame();
  const tasks = dailyTasksFor(state.daily.day);
  const claim = (t: DailyTaskDef) => {
    update((s) => ({ ...s, luong: Math.min(storeCap(s.buildings.kho.level), s.luong + t.reward.luong), quan: Math.min(troopCap(s.buildings.trai.level), s.quan + t.reward.quan), daily: { ...s.daily, claimed: [...s.daily.claimed, t.id] } }));
    toast(`Nhận thưởng: +${t.reward.luong} Lương Thảo, +${t.reward.quan} Quân Lực`);
  };
  return (
    <section className="g-card p-4" aria-labelledby="daily-title">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 id="daily-title" className="font-display font-extrabold text-lg">
          Nhiệm vụ hôm nay
        </h3>
        <span className="g-chip bg-giay-2 text-muc-2">
          {state.daily.claimed.length}/{tasks.length} đã nhận
        </span>
      </div>
      <ul className="grid gap-2">
        {tasks.map((t) => {
          const value = Math.min(t.target, state.daily.progress[t.metric] ?? 0);
          const done = value >= t.target;
          const claimed = state.daily.claimed.includes(t.id);
          const Icon = t.Icon;
          return (
            <li key={t.id} className="flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-ngoc text-white' : 'bg-giay-2 text-muc-2'}`}>
                <Icon className="w-5 h-5" aria-hidden={true} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-tight">{t.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Bar value={value} max={t.target} fill="bg-ngoc" className="flex-1 !h-2" label={t.text} />
                  <span className="text-xs font-bold text-muc-2 tabular">
                    {value}/{t.target}
                  </span>
                </div>
              </div>
              {claimed ? (
                <span className="g-chip bg-ngoc-nhat text-ngoc-chu">
                  <Check className="w-3.5 h-3.5" aria-hidden={true} /> Đã nhận
                </span>
              ) : (
                <GBtn variant="dong" size="sm" disabled={!done} onClick={() => claim(t)} aria-label={`Nhận thưởng: ${t.text}`}>
                  <Gift className="w-4 h-4" aria-hidden={true} /> Nhận
                </GBtn>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const FarmTab: React.FC<{ onGoto: (tab: GameTab, sub?: string) => void }> = ({ onGoto }) => {
  const { state, dark, progress } = useGame();
  const now = useNow(1000);
  const [open, setOpen] = useState<BuildingId | null>(null);
  const [raid, setRaid] = useState(false);
  const due = raidDue(state);
  const lvl = levelOf(progress.xp);
  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
      <div className="space-y-4 min-w-0">
        <SectionTitle title="Điền Trang Đông A" subtitle="Ngụ binh ư nông: thời bình làm ruộng, có giặc thì ra trận." action={<span className="g-chip bg-son text-white !text-sm">Cấp {lvl}</span>} />
        {due && (
          <div className="rounded-3xl border-2 border-son bg-son-nhat p-4 flex flex-wrap items-center gap-3 animate-pop-in" role="alert">
            <span className="w-12 h-12 rounded-2xl bg-son text-white flex items-center justify-center animate-alarm">
              <Siren className="w-7 h-7" aria-hidden={true} />
            </span>
            <div className="flex-1 min-w-[180px]">
              <p className="font-display font-extrabold text-lg text-son-chu">Giặc Mông – Nguyên kéo đến cướp lương!</p>
              <p className="text-sm text-muc">Ứng phó ngay để bảo vệ {fmt(state.luong)} Lương Thảo.</p>
            </div>
            <GBtn onClick={() => setRaid(true)}>
              <AlertTriangle className="w-5 h-5" aria-hidden={true} /> Ứng phó
            </GBtn>
          </div>
        )}
        <div className="relative w-full max-w-[640px] mx-auto aspect-square rounded-[36px] overflow-visible">
          <div className="absolute inset-0 rounded-[36px] overflow-hidden border-4 border-vien" style={{ boxShadow: '0 8px 0 var(--color-vien-2)' }}>
            <FarmBoardArt dark={dark} />
          </div>
          {BUILDINGS.map((def) => (
            <BuildingButton key={def.id} def={def} now={now} onOpen={() => setOpen(def.id)} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="g-card-flat p-3">
            <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
              <Wheat className="w-4 h-4 text-dong-chu" aria-hidden={true} /> Lương Thảo
            </p>
            <p className="font-display font-extrabold text-xl tabular">
              {fmt(state.luong)} <span className="text-sm text-muc-2">/ {fmt(storeCap(state.buildings.kho.level))}</span>
            </p>
          </div>
          <div className="g-card-flat p-3">
            <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-son-chu" aria-hidden={true} /> Quân Lực
            </p>
            <p className="font-display font-extrabold text-xl tabular">
              {fmt(state.quan)} <span className="text-sm text-muc-2">/ {fmt(troopCap(state.buildings.trai.level))}</span>
            </p>
          </div>
        </div>
      </div>
      <aside className="space-y-4">
        <DailyPanel />
        <section className="g-card p-4 space-y-2">
          <h3 className="font-display font-extrabold text-lg">Mẹo của Rồng Con</h3>
          <div className="flex items-start gap-3">
            <Mascot size={64} mood="happy" accessory="conical" className="shrink-0" />
            <p className="text-sm text-muc leading-relaxed">
              Chạm vào công trình để thu hoạch hoặc nâng cấp. Mỗi lần nâng cấp phải trả lời đúng một câu – <strong>kiến thức là vũ khí</strong>! Ấn Tín chỉ có khi em trả lời đúng ở
              server.
            </p>
          </div>
        </section>
      </aside>
      <BuildingSheet id={open} now={now} onClose={() => setOpen(null)} onGoto={onGoto} />
      {raid && <RaidEvent onDone={() => setRaid(false)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// game/barracks – Doanh Trại, Hội Quán Vạn Kiếp, cổ vật
// ---------------------------------------------------------------------------

/** Chỉ số tướng theo giai đoạn tiến hóa và cấp Doanh Trại */
const heroStats = (hero: HeroDef, stage: number, doanhLevel: number) => {
  const m = 1 + (stage - 1) * 0.2;
  const hpBonus = 1 + (Math.max(1, doanhLevel) - 1) * 0.06;
  return {
    hp: Math.round(hero.base.hp * m * hpBonus),
    atk: Math.round(hero.base.atk * m),
    def: Math.round(hero.base.def * m),
    spd: hero.base.spd + (stage - 1),
  };
};

const EVOLVE_BATTLES = [0, 2, 4];
const evolveCost = (stage: number) => ({ luong: 150 * stage, gems: 30 * stage });

const heroJoinHint = (hero: HeroDef) => {
  if (hero.join === 'story') return 'Gia nhập khi hoàn thành Màn 1 (Hội nghị Bình Than)';
  const r = RECIPES.find((x) => x.hero === hero.id);
  return r ? `Chiêu mộ ở Hội Quán: ${CARDS[r.inputs[0]].name} + ${CARDS[r.inputs[1]].name}` : 'Có sẵn từ đầu';
};

const StatRow: React.FC<{ Icon: IconType; label: string; value: number; max: number; fill: string }> = ({ Icon, label, value, max, fill }) => (
  <div className="flex items-center gap-2">
    <Icon className="w-4 h-4 text-muc-2 shrink-0" aria-hidden={true} />
    <span className="w-20 text-sm font-semibold text-muc-2">{label}</span>
    <Bar value={value} max={max} fill={fill} className="flex-1 !h-2.5" label={label} />
    <span className="w-10 text-right font-bold tabular">{value}</span>
  </div>
);

const SkillLine: React.FC<{ tag: string; skill: SkillDef; tone: string }> = ({ tag, skill, tone }) => (
  <li className="g-card-flat p-3">
    <div className="flex items-center gap-2">
      <span className={`g-chip ${tone}`}>{tag}</span>
      <p className="font-display font-bold">{skill.name}</p>
    </div>
    <p className="text-sm text-muc-2 mt-1">{skill.desc}</p>
  </li>
);

const HeroSheet: React.FC<{ heroId: string | null; onClose: () => void }> = ({ heroId, onClose }) => {
  const { state, update, progress, spendGems, toast } = useGame();
  const [quiz, setQuiz] = useState(false);
  const hero = heroId ? HERO_BY_ID[heroId] : null;
  if (!hero) return null;
  const owned = state.heroes[hero.id];
  const stage = owned?.stage ?? 1;
  const stats = heroStats(hero, stage, state.buildings.doanh.level);
  const next = stage === 1 ? hero.stages[1] : stage === 2 ? hero.stages[2] : null;
  const cost = evolveCost(stage);
  const needBattles = EVOLVE_BATTLES[stage] ?? 99;
  const canEvolve = !!owned && !!next && owned.battles >= needBattles && state.luong >= cost.luong && progress.gems >= cost.gems;
  const counters = (Object.keys(ENEMY_TYPES) as EnemyType[]).filter((t) => ENEMY_TYPES[t].weak.includes(hero.element));

  const evolve = async () => {
    if (!next) return;
    if (!(await spendGems(cost.gems, `tien_hoa:${hero.id}:${stage + 1}`))) return;
    update((s) => ({
      ...s,
      luong: Math.max(0, s.luong - cost.luong),
      heroes: { ...s.heroes, [hero.id]: { ...s.heroes[hero.id], stage: (stage + 1) as 1 | 2 | 3 } },
    }));
    toast(`${hero.name} tiến hóa: ${next.name}`);
  };

  return (
    <>
      <Sheet open={!quiz} onClose={onClose} title={hero.name} subtitle={hero.title} wide icon={<HeroMedallion hero={hero} stage={stage} size={56} dim={!owned} />}>
        <div className="grid md:grid-cols-[1fr_1fr] gap-5">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <ElementChip element={hero.element} />
              <TierChip tier={hero.tier} />
              <LoreChip lore={hero.lore} />
              <span className="g-chip bg-giay-2 text-muc-2">{hero.role}</span>
            </div>
            <p className="leading-relaxed">{hero.story}</p>
            <div className="g-card-flat p-4 space-y-2.5">
              <StatRow Icon={Heart} label="Khí lực" value={stats.hp} max={260} fill="bg-ngoc" />
              <StatRow Icon={Swords} label="Tấn công" value={stats.atk} max={45} fill="bg-son" />
              <StatRow Icon={Shield} label="Phòng thủ" value={stats.def} max={22} fill="bg-thuy" />
              <StatRow Icon={Zap} label="Tốc độ" value={stats.spd} max={20} fill="bg-dong" />
            </div>
            {counters.length > 0 && (
              <InfoNote>
                Khắc chế {counters.map((t) => ENEMY_TYPES[t].name.toLowerCase()).join(', ')} (sát thương ×1,5). {ENEMY_TYPES[counters[0]].lesson}
              </InfoNote>
            )}
            <ul className="grid gap-2">
              <SkillLine tag="Đánh thường" skill={hero.basic} tone="bg-giay-2 text-muc-2" />
              <SkillLine tag="Kế sách · 1 câu hỏi" skill={hero.strat} tone="bg-dong-nhat text-dong-chu" />
              <SkillLine tag="Tuyệt chiêu · đầy Hào Khí" skill={hero.ult} tone="bg-son-nhat text-son-chu" />
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="font-display font-extrabold text-lg">Các giai đoạn cuộc đời</h3>
            <ol className="relative border-l-4 border-vien ml-3 space-y-4">
              {hero.stages.map((st, i) => {
                const reached = !!owned && stage >= i + 1;
                return (
                  <li key={st.name} className="pl-5 relative">
                    <span
                      className={`absolute -left-[14px] top-0.5 w-6 h-6 rounded-full border-4 border-giay flex items-center justify-center ${reached ? 'bg-dong' : 'bg-vien-2'}`}
                      aria-hidden="true"
                    >
                      {reached && <Check className="w-3 h-3 text-[#1c1917]" aria-hidden={true} />}
                    </span>
                    <p className="text-xs font-bold text-dong-chu">{st.years}</p>
                    <p className={`font-display font-bold ${reached ? 'text-muc' : 'text-muc-2'}`}>
                      Giai đoạn {i + 1}: {st.name}
                    </p>
                    <p className="text-sm text-muc-2">{st.desc}</p>
                  </li>
                );
              })}
            </ol>
            {!owned ? (
              <div className="g-inset p-4 flex items-start gap-3">
                <Lock className="w-5 h-5 text-muc-2 shrink-0 mt-0.5" aria-hidden={true} />
                <p className="text-sm font-semibold">{heroJoinHint(hero)}</p>
              </div>
            ) : next ? (
              <div className="g-inset p-4 space-y-3">
                <p className="font-display font-bold text-lg flex items-center gap-2">
                  <ArrowUpCircle className="w-5 h-5 text-dong-chu" aria-hidden={true} /> Tiến hóa: {next.name}
                </p>
                <ul className="text-sm space-y-1">
                  <li className={owned.battles >= needBattles ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}>
                    • Đã ra trận {owned.battles}/{needBattles} lần
                  </li>
                  <li className={state.luong >= cost.luong ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}>• {fmt(cost.luong)} Lương Thảo</li>
                  <li className={progress.gems >= cost.gems ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}>• {cost.gems} Ấn Tín</li>
                  <li className="text-muc-2">• Trả lời đúng 2 câu về giai đoạn “{next.name}”</li>
                </ul>
                <GBtn variant="dong" size="lg" className="w-full" disabled={!canEvolve} onClick={() => setQuiz(true)}>
                  <Sparkles className="w-5 h-5" aria-hidden={true} /> Trả lời để tiến hóa
                </GBtn>
              </div>
            ) : (
              <div className="g-inset p-4 flex items-center gap-3">
                <Crown className="w-6 h-6 text-dong-chu" aria-hidden={true} />
                <p className="font-semibold">Đã đạt giai đoạn cao nhất.</p>
              </div>
            )}
          </div>
        </div>
      </Sheet>
      {next && (
        <QuizSheet
          open={quiz}
          onClose={() => setQuiz(false)}
          title={`Tiến hóa ${hero.name}`}
          subtitle={`Giai đoạn mới: ${next.name} (${next.years})`}
          request={{ units: [next.unit], count: 2 }}
          passMark={2}
          sessionKind="practice"
          finishLabel="Tiếp tục"
          onFinish={(sum) => {
            if (sum.passed) evolve();
            else toast('Cần trả lời đúng cả 2 câu để tiến hóa. Thử lại nhé!');
          }}
        />
      )}
    </>
  );
};

const HeroesPanel: React.FC = () => {
  const { state } = useGame();
  const [filter, setFilter] = useState<ElementId | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const list = HEROES.filter((h) => filter === 'all' || h.element === filter);
  const ownedCount = HEROES.filter((h) => state.heroes[h.id]).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo hệ quân">
        {(['all', 'thuy', 'moc', 'tho', 'hoa', 'thong'] as const).map((f) => {
          const active = filter === f;
          const el = f === 'all' ? null : ELEMENTS[f];
          const Icon = el?.Icon;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={`g-chip !min-h-[40px] !px-3 !text-sm border-2 ${active ? 'bg-son text-white border-son' : 'bg-the text-muc-2 border-vien'}`}
            >
              {Icon && <Icon className="w-4 h-4" aria-hidden={true} />}
              {el ? el.name : `Tất cả (${ownedCount}/${HEROES.length})`}
            </button>
          );
        })}
      </div>
      {filter !== 'all' && (
        <div className={`rounded-2xl p-3 ${ELEMENTS[filter].soft}`}>
          <p className={`font-display font-bold ${ELEMENTS[filter].text}`}>{ELEMENTS[filter].place}</p>
          <p className="text-sm text-muc">{ELEMENTS[filter].desc}</p>
        </div>
      )}
      <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {list.map((h) => {
          const owned = state.heroes[h.id];
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => setOpen(h.id)}
                className={`g-card w-full h-full p-3 flex flex-col items-center text-center gap-1.5 hover:-translate-y-0.5 transition ${owned ? '' : 'opacity-80'}`}
                aria-label={`${h.name}${owned ? `, giai đoạn ${owned.stage}` : ', chưa có'}`}
              >
                <HeroMedallion hero={h} stage={owned?.stage ?? 1} size={68} dim={!owned} />
                <p className="font-display font-extrabold leading-tight mt-1">{h.name}</p>
                <p className="text-xs text-muc-2 leading-tight">{h.title}</p>
                <div className="flex flex-wrap justify-center gap-1 mt-auto pt-1">
                  <ElementChip element={h.element} />
                  {!owned && (
                    <span className="g-chip bg-giay-2 text-muc-2">
                      <Lock className="w-3 h-3" aria-hidden={true} /> Chưa có
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <HeroSheet heroId={open} onClose={() => setOpen(null)} />
    </div>
  );
};

const CardTile: React.FC<{ card: CardDef; count: number; onLearn?: () => void }> = ({ card, count, onLearn }) => {
  const Icon = card.Icon;
  return (
    <div className="g-card-flat p-3 flex items-center gap-3">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.kind === 'su_kien' ? 'bg-dong-nhat text-dong-chu' : 'bg-ngoc-nhat text-ngoc-chu'}`}>
        <Icon className="w-6 h-6" aria-hidden={true} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold leading-tight">{card.name}</p>
        <p className="text-xs text-muc-2 leading-snug">{card.how}</p>
      </div>
      <span className="font-display font-extrabold text-lg tabular" aria-label={`Đang có ${count} thẻ`}>
        ×{count}
      </span>
      {onLearn && (
        <GBtn variant="giay" size="sm" onClick={onLearn} aria-label={`Học để nhận thẻ ${card.name}`}>
          <BookOpen className="w-4 h-4" aria-hidden={true} /> Học
        </GBtn>
      )}
    </div>
  );
};

const RecruitPanel: React.FC = () => {
  const { state, update, progress, spendGems, toast, sound } = useGame();
  const now = useNow(1000);
  const [learn, setLearn] = useState<CardDef | null>(null);
  const [opening, setOpening] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);
  const hq = state.buildings.hoiquan.level;
  const waitFactor = 1 - (Math.max(1, hq) - 1) * 0.25;
  const active = state.recruit ? RECIPES.find((r) => r.id === state.recruit?.recipe) ?? null : null;
  const left = state.recruit ? Math.max(0, (state.recruit.endsAt - now) / 1000) : 0;

  const start = async (r: RecipeDef) => {
    if (state.recruit) return toast('Đang có một lệnh bài triệu tập. Hãy mở lệnh bài đó trước.');
    if (state.luong < r.luong) return toast('Chưa đủ Lương Thảo');
    if (!(await spendGems(r.gems, `chieu_mo:${r.hero}`))) return;
    update((s) => ({
      ...s,
      luong: s.luong - r.luong,
      cards: { ...s.cards, [r.inputs[0]]: (s.cards[r.inputs[0]] ?? 0) - 1, [r.inputs[1]]: (s.cards[r.inputs[1]] ?? 0) - 1 },
      recruit: { recipe: r.id, endsAt: Date.now() + Math.round(r.waitSec * waitFactor) * 1000 },
    }));
    toast(`Đã gửi lệnh bài triệu tập ${HERO_BY_ID[r.hero].name}`);
  };

  const join = (r: RecipeDef) => {
    update((s) => ({ ...s, recruit: null, heroes: { ...s.heroes, [r.hero]: { stage: 1, battles: 0 } } }));
    setWelcome(r.hero);
    sound('win');
  };

  const nhanLuc = Object.values(CARDS).filter((c) => c.kind === 'nhan_luc');
  const suKien = Object.values(CARDS).filter((c) => c.kind === 'su_kien');

  return (
    <div className="space-y-5">
      <div className="g-card p-4 flex items-start gap-3">
        <BuildingSprite id="hoiquan" level={Math.max(1, hq)} className="w-20 h-16 shrink-0" />
        <div>
          <p className="font-display font-extrabold text-lg">Hội Quán Vạn Kiếp</p>
          <p className="text-sm text-muc leading-relaxed">
            Đặt <strong>một thẻ Nhân lực</strong> với <strong>một thẻ Sự kiện</strong> để nhận lệnh bài triệu tập. Chờ lệnh bài rồi trả lời câu hỏi về sự kiện đó – tướng sẽ gia nhập.
            Mỗi công thức là một quan hệ nhân – quả trong lịch sử.
          </p>
        </div>
      </div>

      {active && (
        <div className="rounded-3xl border-2 border-dong bg-dong-nhat p-4 flex flex-wrap items-center gap-4" aria-live="polite">
          <span className="w-14 h-16 rounded-xl bg-son text-white flex items-center justify-center shadow-[0_4px_0_#7f1d1d]" aria-hidden="true">
            <ScrollText className="w-8 h-8" aria-hidden={true} />
          </span>
          <div className="flex-1 min-w-[180px]">
            <p className="font-display font-extrabold text-lg">Lệnh bài triệu tập: {HERO_BY_ID[active.hero].name}</p>
            {left > 0 ? (
              <p className="text-sm text-muc flex items-center gap-1.5">
                <Hourglass className="w-4 h-4" aria-hidden={true} /> Còn <span className="tabular font-bold">{fmtClock(left)}</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-ngoc-chu">Lệnh bài đã đến! Trả lời {active.questions} câu để tướng gia nhập.</p>
            )}
          </div>
          <GBtn variant="ngoc" disabled={left > 0} onClick={() => setOpening(true)}>
            <Gift className="w-5 h-5" aria-hidden={true} /> Mở lệnh bài
          </GBtn>
        </div>
      )}

      <section>
        <h3 className="font-display font-extrabold text-lg mb-2">Công thức chiêu mộ</h3>
        <ul className="grid md:grid-cols-2 gap-3">
          {RECIPES.map((r) => {
            const hero = HERO_BY_ID[r.hero];
            const owned = !!state.heroes[r.hero];
            const haveA = (state.cards[r.inputs[0]] ?? 0) > 0;
            const haveB = (state.cards[r.inputs[1]] ?? 0) > 0;
            const ok = !owned && haveA && haveB && state.luong >= r.luong && progress.gems >= r.gems && !state.recruit;
            return (
              <li key={r.id} className="g-card p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {[r.inputs[0], r.inputs[1]].map((cid, i) => {
                    const c = CARDS[cid];
                    const have = i === 0 ? haveA : haveB;
                    const Icon = c.Icon;
                    return (
                      <React.Fragment key={cid}>
                        {i === 1 && (
                          <Plus className="w-4 h-4 text-muc-3" aria-label="cộng" />
                        )}
                        <span className={`g-chip !text-sm !py-1.5 border-2 ${have ? 'bg-the border-ngoc text-muc' : 'bg-giay-2 border-dashed border-vien-2 text-muc-2'}`}>
                          <Icon className="w-4 h-4" aria-hidden={true} /> {c.name}
                          {have ? <Check className="w-3.5 h-3.5 text-ngoc-chu" aria-label="đã có" /> : null}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <HeroMedallion hero={hero} size={54} dim={!owned} />
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-extrabold leading-tight">{hero.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <TierChip tier={hero.tier} />
                      <LoreChip lore={hero.lore} />
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muc-2">{r.lesson}</p>
                {owned ? (
                  <span className="g-chip bg-ngoc-nhat text-ngoc-chu !text-sm">
                    <Check className="w-4 h-4" aria-hidden={true} /> Đã gia nhập
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`g-chip !text-sm ${state.luong >= r.luong ? 'bg-giay-2 text-muc' : 'bg-son-nhat text-son-chu'}`}>
                      <Wheat className="w-4 h-4" aria-hidden={true} /> {r.luong}
                    </span>
                    <span className={`g-chip !text-sm ${progress.gems >= r.gems ? 'bg-giay-2 text-muc' : 'bg-son-nhat text-son-chu'}`}>
                      <Stamp className="w-4 h-4" aria-hidden={true} /> {r.gems}
                    </span>
                    <span className="g-chip !text-sm bg-giay-2 text-muc-2">
                      <Clock className="w-4 h-4" aria-hidden={true} /> {fmtClock(Math.round(r.waitSec * waitFactor))}
                    </span>
                    <GBtn variant="son" size="sm" className="ml-auto" disabled={!ok} onClick={() => start(r)}>
                      Triệu tập <ChevronRight className="w-4 h-4" aria-hidden={true} />
                    </GBtn>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="font-display font-extrabold text-lg mb-2">Thẻ Nhân lực</h3>
          <div className="grid gap-2">
            {nhanLuc.map((c) => (
              <CardTile key={c.id} card={c} count={state.cards[c.id] ?? 0} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-display font-extrabold text-lg mb-2">Thẻ Sự kiện – Văn kiện</h3>
          <div className="grid gap-2">
            {suKien.map((c) => (
              <CardTile key={c.id} card={c} count={state.cards[c.id] ?? 0} onLearn={() => setLearn(c)} />
            ))}
          </div>
          <InfoNote className="mt-2">Thẻ Sự kiện có được khi em trả lời đúng ít nhất 2/3 câu về chủ đề đó.</InfoNote>
        </div>
      </section>

      {learn && (
        <QuizSheet
          open
          onClose={() => setLearn(null)}
          title={`Thẻ: ${learn.name}`}
          subtitle={learn.desc}
          request={{ units: [learn.unit ?? 'ALL_3_WARS_SUMMARY'], count: 3 }}
          passMark={2}
          sessionKind="practice"
          finishLabel="Nhận thẻ"
          onFinish={(sum) => {
            if (!sum.passed) return toast('Cần đúng ít nhất 2/3 câu để nhận thẻ. Thử lại nhé!');
            update((s) => ({ ...s, cards: { ...s.cards, [learn.id]: (s.cards[learn.id] ?? 0) + 1 } }));
            toast(`Nhận thẻ ${learn.name}`);
          }}
        />
      )}
      {active && (
        <QuizSheet
          open={opening}
          onClose={() => setOpening(false)}
          title={`Mở lệnh bài: ${HERO_BY_ID[active.hero].name}`}
          subtitle={active.lesson}
          request={{ units: active.units, count: active.questions }}
          passMark={active.questions}
          sessionKind="recruit"
          finishLabel="Mời tướng gia nhập"
          onFinish={(sum) => {
            if (sum.passed) join(active);
            else toast('Chưa đúng hết các câu. Lệnh bài vẫn còn – em mở lại để thử tiếp nhé!');
          }}
        />
      )}
      {welcome && (
        <Sheet open onClose={() => setWelcome(null)} title="Tướng mới gia nhập!" subtitle={HERO_BY_ID[welcome].title}>
          <div className="flex flex-col items-center text-center gap-3">
            <HeroMedallion hero={HERO_BY_ID[welcome]} size={112} />
            <p className="font-display font-extrabold text-2xl">{HERO_BY_ID[welcome].name}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <ElementChip element={HERO_BY_ID[welcome].element} />
              <TierChip tier={HERO_BY_ID[welcome].tier} />
              <LoreChip lore={HERO_BY_ID[welcome].lore} />
            </div>
            <p className="leading-relaxed">{HERO_BY_ID[welcome].story}</p>
            <GBtn variant="ngoc" size="lg" className="w-full" onClick={() => setWelcome(null)}>
              <Check className="w-5 h-5" aria-hidden={true} /> Vào Doanh Trại
            </GBtn>
          </div>
        </Sheet>
      )}
    </div>
  );
};

const RelicsPanel: React.FC = () => {
  const { state, update, toast } = useGame();
  return (
    <div className="space-y-4">
      <InfoNote>Mỗi trận được mang theo 1 cổ vật. Hiệu ứng là sáng tạo của game; câu chuyện đi kèm có nhãn nguồn tư liệu.</InfoNote>
      <ul className="grid sm:grid-cols-2 gap-3">
        {Object.values(RELICS).map((r) => {
          const owned = state.relics.includes(r.id);
          const equipped = state.relic === r.id;
          const Icon = r.Icon;
          return (
            <li key={r.id} className={`g-card p-4 space-y-2 ${owned ? '' : 'opacity-80'}`}>
              <div className="flex items-center gap-3">
                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${owned ? 'bg-dong text-[#1c1917]' : 'bg-giay-2 text-muc-3'}`}>
                  {owned ? <Icon className="w-6 h-6" aria-hidden={true} /> : <Lock className="w-5 h-5" aria-hidden={true} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-extrabold leading-tight">{r.name}</p>
                  <LoreChip lore={r.lore} className="mt-1" />
                </div>
              </div>
              <p className="text-sm font-semibold text-muc">{r.effect}</p>
              <p className="text-sm text-muc-2">{r.story}</p>
              {owned ? (
                <GBtn
                  variant={equipped ? 'ngoc' : 'giay'}
                  size="sm"
                  className="w-full"
                  aria-pressed={equipped}
                  onClick={() => {
                    update((s) => ({ ...s, relic: equipped ? null : r.id }));
                    toast(equipped ? `Đã cất ${r.name}` : `Mang theo ${r.name} khi ra trận`);
                  }}
                >
                  {equipped ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden={true} /> Đang mang theo
                    </>
                  ) : (
                    'Mang theo khi ra trận'
                  )}
                </GBtn>
              ) : (
                <p className="text-xs font-bold text-dong-chu">Cách nhận: {r.how}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const BarracksTab: React.FC<{ sub: string; onSub: (s: string) => void }> = ({ sub, onSub }) => {
  const tabs: Array<{ id: string; label: string }> = [
    { id: 'heroes', label: 'Tướng' },
    { id: 'recruit', label: 'Hội Quán Vạn Kiếp' },
    { id: 'relics', label: 'Cổ vật' },
  ];
  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 space-y-4">
      <SectionTitle title="Doanh Trại" subtitle="Năm hệ quân theo địa danh, chiêu mộ tướng và cổ vật" />
      <div className="flex gap-1 p-1 rounded-2xl bg-giay-2 w-full sm:w-fit overflow-x-auto" role="tablist" aria-label="Doanh Trại">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={sub === t.id}
            onClick={() => onSub(t.id)}
            className={`min-h-[44px] px-4 rounded-xl font-display font-bold whitespace-nowrap ${sub === t.id ? 'bg-the text-son-chu shadow-[0_2px_0_var(--color-vien-2)]' : 'text-muc-2'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{sub === 'recruit' ? <RecruitPanel /> : sub === 'relics' ? <RelicsPanel /> : <HeroesPanel />}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// game/battle – trận đánh theo lượt 3v3
// ---------------------------------------------------------------------------

type TideState = 'len' | 'dung' | 'rut';

interface FighterStatus {
  atkUp: number;
  atkUpTurns: number;
  defUp: number;
  defUpTurns: number;
  taunt: number;
  tauntDr: number;
  shield: number;
  evade: number;
  fear: boolean;
  stun: number;
  weaken: number;
  weakenTurns: number;
  defDown: number;
  ko: boolean;
  fled: boolean;
  captured: boolean;
  acted: boolean;
  exhausted: boolean;
}

interface Fighter {
  uid: string;
  side: 'ally' | 'enemy';
  ref: string;
  name: string;
  element?: ElementId;
  etype?: EnemyType;
  boss: boolean;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  stamina: number;
  st: FighterStatus;
  intents: IntentId[];
  fleeAt?: number;
  capture?: boolean;
  defeatText: string;
}

interface BattleFx {
  uid: string;
  kind: 'hit' | 'heal' | 'act' | 'miss' | 'buff';
  amount?: number;
  seq: number;
}

interface BattleState {
  phase: PhaseDef;
  round: number;
  allies: Fighter[];
  enemies: Fighter[];
  turn: 'ally' | 'enemy' | 'over';
  active: number;
  haoKhi: number;
  fearImmune: number;
  drain: number;
  supplyDestroyed: boolean;
  stratUsed: boolean;
  stratGood: boolean;
  tide: TideState | null;
  relic: string | null;
  relicUsed: boolean;
  answered: number;
  correct: number;
  log: Array<{ id: number; text: string; tone: 'ally' | 'enemy' | 'info' | 'good' | 'bad' }>;
  fx: BattleFx[];
  result: null | 'win' | 'lose';
  endText: string;
  xuong: number;
  ben: number;
}

const INTENT_INFO: Record<IntentId, { name: string; desc: string; Icon: IconType; danger: boolean }> = {
  strike: { name: 'Đánh thường', desc: 'Tấn công một tướng', Icon: Swords, danger: false },
  charge: { name: 'Càn quét', desc: 'Đòn rất mạnh vào tướng yếu nhất', Icon: Footprints, danger: true },
  volley: { name: 'Mưa tên', desc: 'Bắn vào cả đội ta', Icon: Crosshair, danger: true },
  forage: { name: 'Cướp lương', desc: 'Hồi khí lực và sức bền – bị chặn khi ta bỏ trống làng mạc', Icon: Utensils, danger: false },
  roar: { name: 'Hò hét', desc: 'Làm một tướng hoảng sợ, mất lượt', Icon: Megaphone, danger: false },
  supply: { name: 'Tiếp lương', desc: 'Hồi phục cho cả quân địch', Icon: Package, danger: false },
  brace: { name: 'Thủ thế', desc: 'Tăng phòng thủ trong lượt tới', Icon: ShieldCheck, danger: false },
};

const TIDE_CYCLE: TideState[] = ['len', 'len', 'dung', 'rut'];
const TIDE_LABEL: Record<TideState, string> = { len: 'Triều lên', dung: 'Triều đứng', rut: 'Triều rút' };
const tideFor = (round: number): TideState => TIDE_CYCLE[(round - 1) % TIDE_CYCLE.length];

const blankStatus = (): FighterStatus => ({
  atkUp: 0,
  atkUpTurns: 0,
  defUp: 0,
  defUpTurns: 0,
  taunt: 0,
  tauntDr: 0,
  shield: 0,
  evade: 0,
  fear: false,
  stun: 0,
  weaken: 0,
  weakenTurns: 0,
  defDown: 0,
  ko: false,
  fled: false,
  captured: false,
  acted: false,
  exhausted: false,
});

let fxSeq = 1;
let logSeq = 1;

const pickIntent = (def: EnemyDef, drain: number): IntentId => {
  const pool = def.intents.flatMap((i) => (i === 'forage' && drain > 0 ? [] : i === 'strike' ? [i, i] : [i]));
  return pool[Math.floor(Math.random() * pool.length)] ?? 'strike';
};

const createBattle = (phase: PhaseDef, team: string[], state: GameState): BattleState => {
  const allies: Fighter[] = team.map((id, i) => {
    const h = HERO_BY_ID[id];
    const s = heroStats(h, state.heroes[id]?.stage ?? 1, state.buildings.doanh.level);
    return { uid: `a${i}`, side: 'ally', ref: id, name: h.name, element: h.element, boss: false, maxHp: s.hp, hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, stamina: 100, st: blankStatus(), intents: [], defeatText: '' };
  });
  const enemies: Fighter[] = phase.enemies.map((e, i) => {
    const d = ENEMIES[e.id];
    const hp = Math.round(d.base.hp * (e.hp ?? 1));
    const f: Fighter = {
      uid: `e${i}`,
      side: 'enemy',
      ref: d.id,
      name: d.name,
      etype: d.type,
      boss: !!d.boss,
      maxHp: hp,
      hp,
      atk: d.base.atk,
      def: d.base.def,
      spd: d.base.spd,
      stamina: phase.rules.startStamina ?? 100,
      st: blankStatus(),
      intents: [],
      fleeAt: e.fleeAt ?? d.fleeAt,
      capture: d.capture,
      defeatText: e.defeatText ?? d.defeatText,
    };
    f.intents = [pickIntent(d, 0), pickIntent(d, 0)];
    return f;
  });
  return {
    phase,
    round: 1,
    allies,
    enemies,
    turn: 'ally',
    active: 0,
    haoKhi: 0,
    fearImmune: 0,
    drain: 0,
    supplyDestroyed: false,
    stratUsed: false,
    stratGood: false,
    tide: phase.rules.tide ? tideFor(1) : null,
    relic: state.relic,
    relicUsed: false,
    answered: 0,
    correct: 0,
    log: [{ id: logSeq++, text: phase.objective, tone: 'info' }],
    fx: [],
    result: null,
    endText: '',
    xuong: state.buildings.xuong.level,
    ben: state.buildings.ben.level,
  };
};

const aliveEnemies = (b: BattleState) => b.enemies.filter((e) => !e.st.ko && !e.st.fled && !e.st.captured);
const aliveAllies = (b: BattleState) => b.allies.filter((a) => !a.st.ko);
const cloneB = (b: BattleState): BattleState => ({
  ...b,
  allies: b.allies.map((f) => ({ ...f, st: { ...f.st }, intents: [...f.intents] })),
  enemies: b.enemies.map((f) => ({ ...f, st: { ...f.st }, intents: [...f.intents] })),
  log: [...b.log],
  fx: [],
});
const say = (b: BattleState, text: string, tone: BattleState['log'][number]['tone']) => {
  b.log.push({ id: logSeq++, text, tone });
  if (b.log.length > 40) b.log.splice(0, b.log.length - 40);
};

/** Sát thương: hệ khắc chế ×1,5; địch kiệt sức nhận thêm 25% và đánh yếu đi một nửa */
const calcDamage = (from: Fighter, to: Fighter, power: number) => {
  let atk = from.atk * (1 + from.st.atkUp);
  if (from.side === 'enemy') {
    atk *= 1 - from.st.weaken;
    if (from.st.exhausted) atk *= 0.5;
  }
  // Cân bằng: một trận khoảng 5 – 7 lượt
  let mult = power * (from.side === 'ally' ? 1.6 : 0.85);
  if (from.side === 'ally' && to.etype) {
    if (from.element && ENEMY_TYPES[to.etype].weak.includes(from.element)) mult *= 1.5;
    if (from.element === 'hoa') mult *= 1.1;
    if (to.st.exhausted) mult *= 1.25;
  }
  const def = Math.max(0, to.def * (1 + to.st.defUp) - to.st.defDown);
  const raw = atk * mult - def * 0.6;
  const variance = 0.92 + Math.random() * 0.16;
  return Math.max(1, Math.round(raw * variance));
};

const hurtEnemy = (b: BattleState, target: Fighter, amount: number) => {
  target.hp = Math.max(0, target.hp - amount);
  b.fx.push({ uid: target.uid, kind: 'hit', amount, seq: fxSeq++ });
  if (target.fleeAt && target.hp > 0 && target.hp / target.maxHp <= target.fleeAt) {
    target.st.fled = true;
    say(b, `${target.defeatText}!`, 'good');
  } else if (target.hp <= 0) {
    if (target.capture) target.st.captured = true;
    else target.st.ko = true;
    say(b, `${target.defeatText}!`, 'good');
  }
};

const hurtAlly = (b: BattleState, target: Fighter, amount: number) => {
  if (target.st.evade > 0 || (b.relic === 'non_ma_loi' && target.element === 'thuy' && Math.random() < 0.25)) {
    if (target.st.evade > 0) target.st.evade -= 1;
    b.fx.push({ uid: target.uid, kind: 'miss', seq: fxSeq++ });
    say(b, `${target.name} né được đòn đánh.`, 'ally');
    return;
  }
  let dmg = amount;
  if (target.st.taunt > 0) dmg = Math.round(dmg * (1 - target.st.tauntDr));
  if (target.st.shield > 0) {
    const absorb = Math.min(target.st.shield, dmg);
    target.st.shield -= absorb;
    dmg -= absorb;
  }
  target.hp = Math.max(0, target.hp - dmg);
  b.fx.push({ uid: target.uid, kind: 'hit', amount: dmg, seq: fxSeq++ });
  if (target.hp <= 0) {
    target.st.ko = true;
    say(b, `${target.name} kiệt sức, lui về hậu tuyến.`, 'bad');
  }
};

const healAlly = (b: BattleState, target: Fighter, amount: number) => {
  if (target.st.ko) return;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + Math.round(amount));
  b.fx.push({ uid: target.uid, kind: 'heal', amount: target.hp - before, seq: fxSeq++ });
};

const checkEnd = (b: BattleState) => {
  if (b.result) return b;
  const foes = aliveEnemies(b);
  if (!foes.length) {
    b.result = 'win';
    b.turn = 'over';
    b.endText = 'Quân ta toàn thắng!';
  } else if (b.phase.rules.winWhenExhausted && foes.every((e) => e.st.exhausted)) {
    b.result = 'win';
    b.turn = 'over';
    b.endText = 'Giặc đói kiệt, mất hết sức bền và phải rút lui!';
    say(b, b.endText, 'good');
  } else if (!aliveAllies(b).length) {
    b.result = 'lose';
    b.turn = 'over';
    b.endText = 'Đội ta đã lui về hậu tuyến.';
  }
  return b;
};

const nextActive = (b: BattleState) => {
  const idx = b.allies.findIndex((a) => !a.st.ko && !a.st.acted);
  if (idx === -1) b.turn = 'enemy';
  else b.active = idx;
  return b;
};

const pickTarget = (b: BattleState, targetUid: string | null) => {
  const foes = aliveEnemies(b);
  return foes.find((e) => e.uid === targetUid) ?? foes.find((e) => e.boss) ?? foes[0];
};

/** Một tướng hành động: đánh thường, kế sách (sau câu hỏi) hoặc tuyệt chiêu */
const allyAct = (prev: BattleState, kind: 'basic' | 'strat' | 'ult', targetUid: string | null, correct = true): BattleState => {
  const b = cloneB(prev);
  const me = b.allies[b.active];
  if (!me || me.st.ko || b.turn !== 'ally') return prev;
  const hero = HERO_BY_ID[me.ref];
  const skill = kind === 'basic' ? hero.basic : kind === 'strat' ? hero.strat : hero.ult;
  const factor = kind === 'strat' ? (correct ? 1.5 : 0.5) : 1;
  const target = pickTarget(b, targetUid);
  b.fx.push({ uid: me.uid, kind: 'act', seq: fxSeq++ });
  if (kind === 'ult') b.haoKhi = Math.max(0, b.haoKhi - 3);
  if (kind === 'strat') {
    b.answered += 1;
    if (correct) {
      b.correct += 1;
      b.haoKhi = Math.min(3, b.haoKhi + 1);
    }
  }
  const allies = aliveAllies(b);
  const foes = aliveEnemies(b);
  const tag = kind === 'strat' ? (correct ? ' (trả lời đúng: mạnh gấp rưỡi)' : ' (trả lời chưa đúng: còn nửa sức)') : '';
  switch (skill.kind) {
    case 'strike':
    case 'ambush':
    case 'ship_hunter': {
      if (!target) break;
      let power = skill.power * factor;
      if (skill.kind === 'ambush' && target.etype === 'luong') power *= 2 * (1 + (b.ben - 1) * 0.2);
      if (skill.kind === 'ship_hunter' && target.etype === 'thuyen') {
        power *= 2;
        target.st.defDown += 4;
      }
      if (me.ref === 'tran_binh_trong' && me.hp / me.maxHp < 0.3) power *= 2;
      const dmg = calcDamage(me, target, power);
      say(b, `${me.name} dùng ${skill.name}${tag}: ${target.name} mất ${dmg} binh lực.`, 'ally');
      hurtEnemy(b, target, dmg);
      break;
    }
    case 'multi': {
      for (let i = 0; i < 3; i++) {
        const t = pickTarget(b, i === 0 ? targetUid : null);
        if (!t) break;
        const dmg = calcDamage(me, t, skill.power * factor);
        hurtEnemy(b, t, dmg);
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: liên tiếp ba đòn!`, 'ally');
      break;
    }
    case 'aoe':
    case 'debuff':
    case 'cut_supply':
    case 'stakes': {
      let power = skill.power * factor;
      let note = '';
      if (skill.kind === 'stakes' && b.tide) {
        if (b.tide === 'rut') {
          power *= 2.2 * (1 + Math.max(0, b.xuong - 1) * 0.25);
          note = ' Triều rút, thuyền giặc mắc cọc!';
        } else {
          power *= 0.6;
          note = ' Cọc ngầm chỉ phát huy khi thủy triều rút.';
        }
      }
      for (const t of foes) {
        let p = power;
        if (me.ref === 'tran_thai_tong' && t.st.exhausted) p *= 2;
        const dmg = calcDamage(me, t, p);
        hurtEnemy(b, t, dmg);
        if (skill.kind === 'debuff') {
          t.st.weaken = 0.25;
          t.st.weakenTurns = 2;
        }
        if (skill.kind === 'stakes' && b.tide === 'rut' && t.etype === 'thuyen') t.st.stun = Math.max(t.st.stun, 1);
      }
      if (skill.kind === 'cut_supply') {
        b.supplyDestroyed = true;
        b.drain = Math.max(b.drain, 12);
        note = ' Nguồn lương của giặc bị cắt đứt!';
      }
      say(b, `${me.name} dùng ${skill.name}${tag}.${note}`, 'ally');
      break;
    }
    case 'buff_atk': {
      for (const a of allies) {
        a.st.atkUp = Math.max(a.st.atkUp, skill.power * factor);
        a.st.atkUpTurns = 2;
        b.fx.push({ uid: a.uid, kind: 'buff', seq: fxSeq++ });
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: cả đội tăng tấn công.`, 'ally');
      break;
    }
    case 'self_atk': {
      me.st.atkUp = Math.max(me.st.atkUp, skill.power * factor);
      me.st.atkUpTurns = 3;
      if (target) {
        const dmg = calcDamage(me, target, 1);
        hurtEnemy(b, target, dmg);
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: khí thế bừng bừng!`, 'ally');
      break;
    }
    case 'buff_def': {
      for (const a of allies) {
        a.st.defUp = Math.max(a.st.defUp, skill.power * factor);
        a.st.defUpTurns = 2;
        b.fx.push({ uid: a.uid, kind: 'buff', seq: fxSeq++ });
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: cả đội vững phòng thủ.`, 'ally');
      break;
    }
    case 'heal': {
      for (const a of allies) healAlly(b, a, a.maxHp * skill.power * factor);
      say(b, `${me.name} dùng ${skill.name}${tag}: cả đội hồi khí lực.`, 'ally');
      break;
    }
    case 'taunt': {
      me.st.taunt = 2;
      me.st.tauntDr = Math.min(0.7, skill.power * factor);
      if (me.ref === 'tran_binh_trong') {
        me.st.defUp = Math.max(me.st.defUp, 0.5);
        me.st.defUpTurns = 2;
      }
      b.fx.push({ uid: me.uid, kind: 'buff', seq: fxSeq++ });
      say(b, `${me.name} dùng ${skill.name}${tag}: thu hút đòn đánh của giặc.`, 'ally');
      break;
    }
    case 'shield': {
      for (const a of allies) {
        a.st.shield += Math.round(a.maxHp * skill.power * factor);
        b.fx.push({ uid: a.uid, kind: 'buff', seq: fxSeq++ });
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: cả đội được che chắn.`, 'ally');
      break;
    }
    case 'fear_immune': {
      b.fearImmune = 3;
      for (const a of allies) healAlly(b, a, a.maxHp * skill.power * factor);
      say(b, `${me.name}: “Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!”${tag} Cả đội vững lòng.`, 'ally');
      break;
    }
    case 'evade': {
      if (kind === 'ult' || me.ref === 'le_phu_tran') {
        for (const a of allies) a.st.evade = Math.max(a.st.evade, 1);
        say(b, `${me.name} dùng ${skill.name}: cả đội né đòn ở lượt tới.`, 'ally');
      } else {
        me.st.evade = Math.max(me.st.evade, 1);
        if (target) {
          const dmg = calcDamage(me, target, skill.power * factor);
          hurtEnemy(b, target, dmg);
        }
        say(b, `${me.name} dùng ${skill.name}${tag}.`, 'ally');
      }
      break;
    }
  }
  if (me.ref === 'tran_hung_dao' && kind === 'strat' && correct) b.haoKhi = Math.min(3, b.haoKhi + 1);
  me.st.acted = true;
  checkEnd(b);
  if (!b.result) nextActive(b);
  return b;
};

/** Kế sách của màn (dùng một lần, sau câu hỏi) */
const applyPhaseStrat = (prev: BattleState, correct: boolean): BattleState => {
  const b = cloneB(prev);
  if (b.stratUsed || b.result) return prev;
  b.stratUsed = true;
  b.answered += 1;
  if (correct) {
    b.correct += 1;
    b.haoKhi = Math.min(3, b.haoKhi + 1);
  }
  const p = b.phase;
  const heroIn = !!p.strat.hero && b.allies.some((a) => a.ref === p.strat.hero && !a.st.ko);
  const bonus = heroIn ? 1.25 : 1;
  const foes = aliveEnemies(b);
  const noKo = b.allies.every((a) => !a.st.ko);
  const lead = b.allies.find((a) => !a.st.ko) ?? b.allies[0];
  const hit = (t: Fighter, power: number) => hurtEnemy(b, t, calcDamage(lead, t, power));
  switch (p.strat.effect) {
    case 'retreat':
    case 'rear_guard': {
      b.stratGood = correct && noKo;
      b.result = 'win';
      b.turn = 'over';
      b.endText =
        p.strat.effect === 'retreat'
          ? 'Quân ta rút lui an toàn, bảo toàn lực lượng chờ thời cơ phản công.'
          : 'Cánh quân chặn hậu giữ chân giặc, hai vua và triều đình rút lui an toàn.';
      say(b, b.endText, 'good');
      return b;
    }
    case 'vuon_khong': {
      b.drain = correct ? 18 : 9;
      for (const e of foes) e.stamina = Math.max(0, e.stamina - (correct ? 20 : 10));
      b.stratGood = correct && b.round <= 2;
      say(b, `Vườn không nhà trống!${correct ? '' : ' (chưa trả lời đúng nên sơ tán chậm hơn)'} Giặc không cướp được lương, sức bền tụt dần mỗi lượt.`, 'good');
      break;
    }
    case 'counter': {
      const anyTired = foes.some((e) => e.st.exhausted || e.stamina <= 30);
      for (const a of aliveAllies(b)) {
        a.st.atkUp = Math.max(a.st.atkUp, (correct ? 0.5 : 0.2) * bonus);
        a.st.atkUpTurns = 3;
        b.fx.push({ uid: a.uid, kind: 'buff', seq: fxSeq++ });
      }
      b.stratGood = correct && anyTired;
      say(b, `Phản công Đông Bộ Đầu! Cả đội tăng mạnh tấn công.${anyTired ? '' : ' (Nên đợi giặc kiệt sức rồi mới phản công.)'}`, 'good');
      break;
    }
    case 'chuong_duong': {
      for (const t of foes) {
        hit(t, (correct ? 1.6 : 0.8) * bonus);
        t.st.weaken = 0.25;
        t.st.weakenTurns = 2;
      }
      b.stratGood = correct;
      say(b, `Đoạt sáo Chương Dương độ!${heroIn ? ' Trần Quang Khải dẫn đầu.' : ''} Quân giặc giữ bến tan vỡ.`, 'good');
      break;
    }
    case 'van_kiep': {
      const boss = foes.find((e) => e.ref === 'thoat_hoan') ?? foes[0];
      if (boss) {
        hit(boss, (correct ? 2.6 : 1.2) * bonus);
        boss.st.stun = Math.max(boss.st.stun, 1);
      }
      b.stratGood = correct;
      say(b, 'Chặn đánh ở Vạn Kiếp! Đường tháo chạy của giặc bị chặn.', 'good');
      break;
    }
    case 'van_don': {
      for (const t of foes) hit(t, (t.etype === 'luong' ? 3 : 0.8) * (correct ? 1 : 0.5) * bonus * (1 + Math.max(0, b.ben - 1) * 0.2));
      b.supplyDestroyed = true;
      b.drain = Math.max(b.drain, 12);
      b.stratGood = correct && b.round === 1;
      say(b, 'Phục kích Vân Đồn! Thuyền lương bị đánh đắm, giặc mất nguồn hồi phục.', 'good');
      break;
    }
    case 'bach_dang': {
      const good = b.tide === 'rut';
      for (const t of foes) {
        hit(t, (good ? 2.5 : 0.7) * (correct ? 1 : 0.5) * bonus * (1 + Math.max(0, b.xuong - 1) * 0.25));
        if (good) t.st.stun = Math.max(t.st.stun, 1);
      }
      b.stratGood = correct && good;
      say(b, good ? 'Đại trận Bạch Đằng! Triều rút, thuyền giặc va cọc, vỡ đắm.' : 'Tung trận khi triều chưa rút: cọc còn chìm sâu nên chưa phát huy. Hãy chờ “Triều rút”.', good ? 'good' : 'bad');
      break;
    }
    case 'capture': {
      const target = foes.find((e) => e.ref === 'o_ma_nhi') ?? foes[0];
      if (target) {
        hit(target, (correct ? 2.6 : 1.2) * bonus);
        target.st.stun = Math.max(target.st.stun, 2);
      }
      b.stratGood = correct;
      say(b, 'Vây chặt thuyền chỉ huy của giặc!', 'good');
      break;
    }
  }
  checkEnd(b);
  return b;
};

const applyRelic = (prev: BattleState): BattleState => {
  if (!prev.relic || prev.relicUsed || prev.result) return prev;
  const b = cloneB(prev);
  if (b.relic === 'hich') {
    for (const a of aliveAllies(b)) healAlly(b, a, a.maxHp);
    say(b, 'Hịch tướng sĩ vang lên: cả đội hồi đầy khí lực!', 'good');
  } else if (b.relic === 'co_sau_chu') {
    const down = b.allies.find((a) => a.st.ko);
    if (!down) return prev;
    down.st.ko = false;
    down.hp = Math.round(down.maxHp * 0.5);
    say(b, `Cờ “Phá cường địch, báo hoàng ân” tung bay: ${down.name} trở lại trận!`, 'good');
  } else if (b.relic === 'tung_gia') {
    for (const a of b.allies) a.st.acted = false;
    nextActive(b);
    b.turn = 'ally';
    say(b, 'Hành quân thần tốc: cả đội được hành động thêm một lượt!', 'good');
  } else return prev;
  b.relicUsed = true;
  return b;
};

/** Một lượt của quân địch, trả về từng bước để hiển thị lần lượt */
const enemyTurnSteps = (prev: BattleState): BattleState[] => {
  const steps: BattleState[] = [];
  let b = cloneB(prev);
  const order = aliveEnemies(b).sort((x, y) => y.spd - x.spd).map((e) => e.uid);
  for (const uid of order) {
    if (b.result) break;
    b = cloneB(b);
    const e = b.enemies.find((x) => x.uid === uid);
    if (!e || e.st.ko || e.st.fled || e.st.captured) continue;
    const def = ENEMIES[e.ref];
    const convoy = !b.supplyDestroyed && b.enemies.some((x) => x.etype === 'luong' && !x.st.ko && !x.st.fled);
    e.stamina = Math.max(0, Math.min(100, e.stamina - 5 - b.drain + (convoy ? 6 : 0)));
    if (e.stamina <= 0 && !e.st.exhausted) {
      e.st.exhausted = true;
      say(b, `${e.name} kiệt sức vì thiếu lương!`, 'good');
    }
    const intent = e.intents.shift() ?? 'strike';
    e.intents.push(pickIntent(def, b.drain));
    if (e.st.stun > 0) {
      e.st.stun -= 1;
      say(b, `${e.name} bị chặn đứng, không ra đòn được.`, 'good');
      steps.push(checkEnd(b));
      continue;
    }
    const allies = aliveAllies(b);
    if (!allies.length) break;
    const taunter = allies.find((a) => a.st.taunt > 0);
    const randomAlly = () => taunter ?? allies[Math.floor(Math.random() * allies.length)];
    b.fx.push({ uid: e.uid, kind: 'act', seq: fxSeq++ });
    switch (intent) {
      case 'strike': {
        const t = randomAlly();
        const dmg = calcDamage(e, t, 1);
        say(b, `${e.name} tấn công ${t.name}.`, 'enemy');
        hurtAlly(b, t, dmg);
        break;
      }
      case 'charge': {
        const t = taunter ?? [...allies].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
        const dmg = calcDamage(e, t, 1.6);
        say(b, `${e.name} càn quét vào ${t.name}!`, 'enemy');
        hurtAlly(b, t, dmg);
        break;
      }
      case 'volley': {
        say(b, `${e.name} bắn mưa tên vào đội ta!`, 'enemy');
        for (const t of allies) hurtAlly(b, t, calcDamage(e, t, 0.55));
        break;
      }
      case 'forage': {
        if (b.drain > 0) {
          e.stamina = Math.max(0, e.stamina - 10);
          say(b, `${e.name} đi cướp lương nhưng làng mạc trống không!`, 'good');
        } else {
          e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.12));
          e.stamina = Math.min(100, e.stamina + 20);
          b.fx.push({ uid: e.uid, kind: 'heal', seq: fxSeq++ });
          say(b, `${e.name} cướp lương, hồi sức.`, 'enemy');
        }
        break;
      }
      case 'roar': {
        if (b.fearImmune > 0) say(b, `${e.name} hò hét nhưng đội ta vẫn vững lòng.`, 'good');
        else {
          const t = randomAlly();
          t.st.fear = true;
          say(b, `${e.name} hò hét: ${t.name} hoảng sợ, mất lượt tới.`, 'enemy');
        }
        break;
      }
      case 'supply': {
        if (b.supplyDestroyed) say(b, 'Thuyền lương đã bị đánh đắm – giặc không còn tiếp lương.', 'good');
        else {
          for (const x of aliveEnemies(b)) {
            x.hp = Math.min(x.maxHp, x.hp + Math.round(x.maxHp * 0.08));
            x.stamina = Math.min(100, x.stamina + 10);
          }
          say(b, `${e.name} tiếp lương cho cả đạo quân.`, 'enemy');
        }
        break;
      }
      case 'brace': {
        e.st.defUp = 0.5;
        e.st.defUpTurns = 1;
        say(b, `${e.name} thủ thế.`, 'enemy');
        break;
      }
    }
    steps.push(checkEnd(b));
  }
  // Sang lượt mới
  b = cloneB(b);
  if (!b.result) {
    b.round += 1;
    if (b.phase.rules.tide) {
      b.tide = tideFor(b.round);
      say(b, `${TIDE_LABEL[b.tide]}${b.tide === 'rut' ? ' – thời cơ tung Đại trận Bạch Đằng!' : ''}`, b.tide === 'rut' ? 'good' : 'info');
    }
    if (b.fearImmune > 0) b.fearImmune -= 1;
    for (const f of [...b.allies, ...b.enemies]) {
      if (f.st.atkUpTurns > 0 && --f.st.atkUpTurns === 0) f.st.atkUp = 0;
      if (f.st.defUpTurns > 0 && --f.st.defUpTurns === 0) f.st.defUp = 0;
      if (f.st.weakenTurns > 0 && --f.st.weakenTurns === 0) f.st.weaken = 0;
      if (f.st.taunt > 0) f.st.taunt -= 1;
      f.st.acted = false;
    }
    for (const a of b.allies) {
      if (a.st.fear && !a.st.ko) {
        a.st.acted = true;
        a.st.fear = false;
      }
    }
    if (b.phase.rules.retreatAfter && b.round === b.phase.rules.retreatAfter + 1) say(b, `Đã cầm cự đủ ${b.phase.rules.retreatAfter} lượt – có thể dùng kế sách “${b.phase.strat.name}”.`, 'info');
    b.turn = 'ally';
    nextActive(b);
    checkEnd(b);
  }
  steps.push(b);
  return steps;
};

const starsOf = (b: BattleState) => (b.result !== 'win' ? 0 : 1 + (b.stratGood ? 1 : 0) + (b.answered > 0 && b.correct / b.answered >= 0.8 ? 1 : 0));

// ---------------------------------------------------------------------------
// game/battle – giao diện trận đánh
// ---------------------------------------------------------------------------

const FighterCard: React.FC<{ f: Fighter; active?: boolean; targeted?: boolean; onTarget?: () => void; showIntents: number; fx: BattleFx[] }> = ({ f, active = false, targeted = false, onTarget, showIntents, fx }) => {
  const out = f.st.ko || f.st.fled || f.st.captured;
  const myFx = fx.filter((x) => x.uid === f.uid);
  const hit = myFx.find((x) => x.kind === 'hit');
  const heal = myFx.find((x) => x.kind === 'heal' || x.kind === 'buff');
  const actFx = myFx.find((x) => x.kind === 'act');
  const miss = myFx.find((x) => x.kind === 'miss');
  const def = f.side === 'enemy' ? ENEMIES[f.ref] : null;
  const hero = f.side === 'ally' ? HERO_BY_ID[f.ref] : null;
  const status: Array<{ key: string; text: string; tone: string }> = [];
  if (f.st.atkUp > 0) status.push({ key: 'atk', text: `Tấn công +${Math.round(f.st.atkUp * 100)}%`, tone: 'bg-son-nhat text-son-chu' });
  if (f.st.defUp > 0) status.push({ key: 'def', text: 'Phòng thủ tăng', tone: 'bg-thuy-nhat text-thuy-chu' });
  if (f.st.taunt > 0) status.push({ key: 'taunt', text: 'Khiêu khích', tone: 'bg-hoa-nhat text-hoa-chu' });
  if (f.st.shield > 0) status.push({ key: 'shield', text: `Khiên ${f.st.shield}`, tone: 'bg-ngoc-nhat text-ngoc-chu' });
  if (f.st.evade > 0) status.push({ key: 'evade', text: 'Né đòn', tone: 'bg-ngoc-nhat text-ngoc-chu' });
  if (f.st.fear) status.push({ key: 'fear', text: 'Hoảng sợ', tone: 'bg-thong-nhat text-thong-chu' });
  if (f.st.stun > 0) status.push({ key: 'stun', text: 'Bị chặn', tone: 'bg-dong-nhat text-dong-chu' });
  if (f.st.weaken > 0) status.push({ key: 'weak', text: 'Yếu thế', tone: 'bg-dong-nhat text-dong-chu' });
  if (f.st.exhausted) status.push({ key: 'tired', text: 'Kiệt sức', tone: 'bg-dong-nhat text-dong-chu' });
  const Wrapper: React.ElementType = onTarget && !out ? 'button' : 'div';
  return (
    <Wrapper
      {...(onTarget && !out ? { type: 'button', onClick: onTarget, 'aria-pressed': targeted, 'aria-label': `Chọn mục tiêu ${f.name}, binh lực ${f.hp}/${f.maxHp}` } : {})}
      className={`relative w-full rounded-2xl p-2 sm:p-2.5 text-left bg-the/95 border-2 transition ${
        out ? 'opacity-45 grayscale border-vien' : active ? 'border-dong shadow-[0_0_0_3px_var(--color-dong)]' : targeted ? 'border-son shadow-[0_0_0_3px_var(--color-son)]' : 'border-vien'
      } ${hit ? 'animate-hit' : ''} ${heal ? 'animate-heal' : ''} ${actFx ? (f.side === 'ally' ? 'animate-lunge-right' : 'animate-lunge-left') : ''}`}
      key={`${f.uid}-${hit?.seq ?? 0}-${actFx?.seq ?? 0}`}
    >
      {hit?.amount !== undefined && (
        <span className="absolute -top-3 right-2 font-display font-extrabold text-lg text-son-chu animate-float-up" aria-hidden="true">
          −{hit.amount}
        </span>
      )}
      {heal?.amount !== undefined && heal.amount > 0 && (
        <span className="absolute -top-3 left-2 font-display font-extrabold text-lg text-ngoc-chu animate-float-up" aria-hidden="true">
          +{heal.amount}
        </span>
      )}
      {miss && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-display font-extrabold text-sm text-thuy-chu animate-float-up" aria-hidden="true">
          Né!
        </span>
      )}
      {f.side === 'enemy' && !out && f.intents.length > 0 && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {f.intents.slice(0, showIntents).map((intent, i) => {
            const info = INTENT_INFO[intent];
            const Icon = info.Icon;
            return (
              <span
                key={i}
                title={`${i === 0 ? 'Lượt tới' : 'Lượt sau nữa'}: ${info.name} – ${info.desc}`}
                className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold border-2 ${i > 0 ? 'opacity-70' : ''} ${info.danger ? 'bg-son text-white border-son-dam' : 'bg-the text-muc border-vien'}`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden={true} />
                <span className="hidden min-[400px]:inline">{info.name}</span>
                <span className="sr-only">
                  {i === 0 ? 'Ý đồ lượt tới' : 'Ý đồ lượt sau'}: {info.name}
                </span>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex flex-col items-center text-center gap-1">
        {hero ? <HeroMedallion hero={hero} size={44} /> : def ? <EnemyBadge enemy={def} size={44} /> : null}
        <p className="font-display font-bold text-[13px] sm:text-sm leading-tight line-clamp-2 min-h-[2.2em]">{f.name}</p>
      </div>
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-1">
          <Heart className={`w-3 h-3 shrink-0 ${f.side === 'ally' ? 'text-ngoc-chu' : 'text-son-chu'}`} aria-hidden={true} />
          <Bar value={f.hp} max={f.maxHp} fill={f.side === 'ally' ? 'bg-ngoc' : 'bg-son'} className="flex-1 !h-2" label={f.side === 'ally' ? `Khí lực ${f.name}` : `Binh lực ${f.name}`} />
        </div>
        <p className="text-[11px] font-bold text-muc-2 tabular text-center">
          {f.hp}/{f.maxHp}
        </p>
        {f.side === 'enemy' && (
          <div className="flex items-center gap-1" title="Sức bền (lương thực)">
            <Utensils className="w-3 h-3 text-dong-chu shrink-0" aria-hidden={true} />
            <Bar value={f.stamina} max={100} fill="bg-dong" className="flex-1 !h-1.5" label={`Sức bền ${f.name}`} />
          </div>
        )}
      </div>
      {out && (
        <span className="absolute inset-x-1 bottom-1 g-chip justify-center bg-giay-2 text-muc-2 !text-[11px]">
          {f.st.captured ? 'Bị bắt sống' : f.st.fled ? 'Tháo chạy' : f.side === 'ally' ? 'Lui về hậu tuyến' : 'Bị đánh tan'}
        </span>
      )}
      {!out && status.length > 0 && (
        <div className="flex flex-wrap justify-center gap-0.5 mt-1">
          {status.slice(0, 2).map((s) => (
            <span key={s.key} className={`g-chip !text-[10px] !px-1.5 !py-0 ${s.tone}`}>
              {s.text}
            </span>
          ))}
        </div>
      )}
    </Wrapper>
  );
};

const TideMeter: React.FC<{ tide: TideState; round: number }> = ({ tide, round }) => (
  <div className="flex items-center gap-2" aria-label={`Thủy triều: ${TIDE_LABEL[tide]}`}>
    <Waves className="w-5 h-5 text-thuy-chu" aria-hidden={true} />
    <div className="flex gap-1">
      {TIDE_CYCLE.map((t, i) => {
        const cur = (round - 1) % TIDE_CYCLE.length === i;
        return (
          <span key={i} className={`g-chip !text-[11px] ${cur ? (t === 'rut' ? 'bg-ngoc text-white' : 'bg-thuy text-white') : 'bg-giay-2 text-muc-3'}`}>
            {t === 'len' ? <ArrowUp className="w-3 h-3" aria-hidden={true} /> : t === 'rut' ? <ArrowDown className="w-3 h-3" aria-hidden={true} /> : <Minus className="w-3 h-3" aria-hidden={true} />}
            <span className={cur ? '' : 'sr-only'}>{TIDE_LABEL[t]}</span>
          </span>
        );
      })}
    </div>
  </div>
);

const BattleScreen: React.FC<{ phase: PhaseDef; team: string[]; onExit: (b: BattleState | null) => void }> = ({ phase, team, onExit }) => {
  const { state, dark, fetchQuestions, toast } = useGame();
  const [b, setB] = useState<BattleState>(() => createBattle(phase, team, state));
  const [target, setTarget] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | { kind: 'strat' | 'phase'; q: ServedQuestion }>(null);
  const [busy, setBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const pool = useRef<ServedQuestion[]>([]);
  const used = useRef<string[]>([]);
  const lastAnswer = useRef<boolean | null>(null);
  const bRef = useRef(b);
  useEffect(() => {
    bRef.current = b;
  });
  const reduce = state.settings.reduceMotion || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    let cancelled = false;
    fetchQuestions({ units: phase.units, count: 12 })
      .then((res) => {
        if (!cancelled) pool.current = res.questions;
      })
      .catch(() => toast('Không tải được câu hỏi cho trận đánh – kiểm tra kết nối'));
    return () => {
      cancelled = true;
    };
  }, [phase.units, fetchQuestions, toast]);

  // Lượt của quân địch: phát lần lượt từng bước
  useEffect(() => {
    const cur = bRef.current;
    if (cur.turn !== 'enemy' || cur.result) return;
    const steps = enemyTurnSteps(cur);
    let i = 0;
    let timer = 0;
    const delay = reduce ? 160 : 650;
    const play = () => {
      setB(steps[i]);
      i += 1;
      if (i < steps.length) timer = window.setTimeout(play, delay);
    };
    timer = window.setTimeout(play, reduce ? 120 : 450);
    return () => window.clearTimeout(timer);
  }, [b.turn, b.round, b.result, reduce]);

  const takeQuestion = async (): Promise<ServedQuestion | null> => {
    let q = pool.current.find((x) => !used.current.includes(x.id));
    if (!q) {
      try {
        const res = await fetchQuestions({ units: phase.units, count: 8 });
        pool.current = [...pool.current, ...res.questions];
        q = res.questions.find((x) => !used.current.includes(x.id)) ?? res.questions[0];
      } catch {
        toast('Không tải được câu hỏi');
        return null;
      }
    }
    if (q) used.current.push(q.id);
    return q ?? null;
  };

  const startAsk = async (kind: 'strat' | 'phase') => {
    setBusy(true);
    const q = await takeQuestion();
    setBusy(false);
    if (q) {
      lastAnswer.current = null;
      setAsk({ kind, q });
    }
  };

  const finishAsk = () => {
    if (!ask) return;
    const correct = lastAnswer.current === true;
    setB((cur) => (ask.kind === 'phase' ? applyPhaseStrat(cur, correct) : allyAct(cur, 'strat', target, correct)));
    setAsk(null);
  };

  const me = b.turn === 'ally' ? b.allies[b.active] : null;
  const hero = me ? HERO_BY_ID[me.ref] : null;
  const retreatPhase = phase.strat.effect === 'retreat' || phase.strat.effect === 'rear_guard';
  const retreatLeft = retreatPhase ? Math.max(0, (phase.rules.retreatAfter ?? 0) + 1 - b.round) : 0;
  const stratDisabled = b.stratUsed || b.turn !== 'ally' || retreatLeft > 0 || busy;
  const relic = b.relic ? RELICS[b.relic] : null;
  const relicUsable = !!relic && !b.relicUsed && b.turn === 'ally' && (b.relic === 'hich' || b.relic === 'tung_gia' || (b.relic === 'co_sau_chu' && b.allies.some((a) => a.st.ko)));
  const showIntents = b.relic === 'binh_thu_relic' ? 2 : 1;
  const lastLogs = b.log.slice(-3);

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col bg-giay ${dark ? 'theme-dark' : ''}`} role="dialog" aria-modal="true" aria-label={`Trận ${phase.name}`}>
      <header className="flex items-center gap-2 px-3 py-2 border-b-2 border-vien bg-the">
        <GBtn variant="ghost" iconOnly onClick={() => (b.result ? onExit(b) : setConfirmExit(true))} aria-label="Rời trận">
          <LogOut className="w-5 h-5" aria-hidden={true} />
        </GBtn>
        <div className="min-w-0 flex-1">
          <p className="font-display font-extrabold leading-tight truncate">{phase.name}</p>
          <p className="text-xs text-muc-2">
            {phase.date} · Lượt {b.round}
          </p>
        </div>
        {b.tide && <TideMeter tide={b.tide} round={b.round} />}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          <div className="relative overflow-hidden" style={{ minHeight: 290 }}>
            <BattleBackdrop bg={phase.bg} tide={b.tide} dark={dark} stakes={!!phase.rules.tide} />
            <div className="relative mx-auto max-w-3xl px-2 sm:px-4 pt-5 pb-2 lg:pt-10 lg:pb-8 space-y-5 lg:space-y-8">
              <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2" aria-label="Quân địch">
                {b.enemies.map((e) => (
                  <FighterCard key={e.uid} f={e} fx={b.fx} targeted={target === e.uid} onTarget={b.turn === 'ally' ? () => setTarget(e.uid) : undefined} showIntents={showIntents} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Đội ta">
                {b.allies.map((a, i) => (
                  <FighterCard key={a.uid} f={a} fx={b.fx} active={b.turn === 'ally' && i === b.active} showIntents={0} />
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-3xl px-3 sm:px-4 py-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-bold text-sm text-muc-2">Hào Khí</span>
              <span className="flex gap-1" role="img" aria-label={`Hào Khí ${b.haoKhi}/3`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${i < b.haoKhi ? 'bg-son border-son-dam text-white' : 'bg-giay-2 border-vien-2 text-muc-3'}`}>
                    <Flame className="w-3.5 h-3.5" aria-hidden={true} />
                  </span>
                ))}
              </span>
              {relic && (
                <GBtn variant="giay" size="sm" className="ml-auto" disabled={!relicUsable} onClick={() => setB((cur) => applyRelic(cur))} aria-label={`Dùng cổ vật ${relic.name}: ${relic.effect}`}>
                  <relic.Icon className="w-4 h-4" aria-hidden={true} /> {b.relicUsed ? 'Đã dùng cổ vật' : relic.name}
                </GBtn>
              )}
            </div>

            {b.result ? null : me && hero ? (
              <div className="g-card p-3 space-y-2" aria-live="polite">
                <div className="flex items-center gap-2">
                  <HeroMedallion hero={hero} size={36} />
                  <p className="font-display font-extrabold">Lượt của {me.name}</p>
                  <span className="text-xs text-muc-2 ml-auto">Chạm quân địch để chọn mục tiêu</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <GBtn variant="giay" className="!justify-start text-left" onClick={() => setB((cur) => allyAct(cur, 'basic', target))}>
                    <Swords className="w-5 h-5 shrink-0" aria-hidden={true} />
                    <span>
                      <span className="block">{hero.basic.name}</span>
                      <span className="block text-xs font-sans font-semibold text-muc-2">Đánh thường</span>
                    </span>
                  </GBtn>
                  <GBtn variant="ngoc" className="!justify-start text-left" disabled={busy} onClick={() => startAsk('strat')}>
                    <Sparkles className="w-5 h-5 shrink-0" aria-hidden={true} />
                    <span>
                      <span className="block">{hero.strat.name}</span>
                      <span className="block text-xs font-sans font-semibold opacity-90">Kế sách · 1 câu hỏi</span>
                    </span>
                  </GBtn>
                  <GBtn variant="son" className="!justify-start text-left" disabled={b.haoKhi < 3} onClick={() => setB((cur) => allyAct(cur, 'ult', target))}>
                    <Flame className="w-5 h-5 shrink-0" aria-hidden={true} />
                    <span>
                      <span className="block">{hero.ult.name}</span>
                      <span className="block text-xs font-sans font-semibold opacity-90">{b.haoKhi < 3 ? `Cần ${3 - b.haoKhi} Hào Khí` : 'Tuyệt chiêu'}</span>
                    </span>
                  </GBtn>
                </div>
                <p className="text-xs text-muc-2">
                  {hero.strat.desc} Trả lời đúng: mạnh gấp rưỡi và +1 Hào Khí; chưa đúng: còn nửa sức, không mất lượt.
                </p>
              </div>
            ) : (
              <div className="g-card-flat p-3 text-center font-semibold text-muc-2" aria-live="polite">
                Quân giặc đang hành động…
              </div>
            )}

            <div className="rounded-2xl border-2 border-dong bg-dong-nhat p-3 flex flex-wrap items-center gap-3">
              <ScrollText className="w-6 h-6 text-dong-chu shrink-0" aria-hidden={true} />
              <div className="flex-1 min-w-[180px]">
                <p className="font-display font-extrabold leading-tight">Kế sách: {phase.strat.name}</p>
                <p className="text-sm text-muc">{phase.strat.desc}</p>
                {retreatLeft > 0 && <p className="text-sm font-semibold text-son-chu">Cầm cự thêm {retreatLeft} lượt nữa.</p>}
                {b.tide && phase.strat.effect === 'bach_dang' && !b.stratUsed && (
                  <p className={`text-sm font-semibold ${b.tide === 'rut' ? 'text-ngoc-chu' : 'text-muc-2'}`}>{b.tide === 'rut' ? 'Triều đang rút – thời cơ đã đến!' : 'Chờ thủy triều rút…'}</p>
                )}
              </div>
              <GBtn variant="dong" disabled={stratDisabled} onClick={() => startAsk('phase')}>
                {b.stratUsed ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden={true} /> Đã dùng
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" aria-hidden={true} /> Dùng (1 câu hỏi)
                  </>
                )}
              </GBtn>
            </div>

            <ul className="g-inset p-3 space-y-1 text-sm" aria-live="polite" aria-label="Diễn biến trận đánh">
              {lastLogs.map((l) => (
                <li key={l.id} className={l.tone === 'good' ? 'text-ngoc-chu font-semibold' : l.tone === 'bad' || l.tone === 'enemy' ? 'text-son-chu' : l.tone === 'info' ? 'text-muc-2' : 'text-muc'}>
                  {l.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {ask && (
        <Sheet open onClose={() => {}} persistent title={ask.kind === 'phase' ? `Kế sách: ${phase.strat.name}` : `${hero?.strat.name ?? 'Kế sách'}`} subtitle="Trả lời để tung kế sách" wide>
          <QuestionCard
            q={ask.q}
            index={0}
            total={1}
            timerSec={state.settings.timer ? 20 : null}
            onAnswered={(r) => {
              lastAnswer.current = r.correct;
            }}
            onNext={finishAsk}
            nextLabel="Tung kế sách"
          />
        </Sheet>
      )}
      {b.result && <BattleResult b={b} onDone={() => onExit(b)} />}
      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="Rời trận?" subtitle="Trận đánh sẽ không được tính, Quân Lực đã dùng không được hoàn lại.">
        <div className="flex gap-2">
          <GBtn variant="giay" className="flex-1" onClick={() => setConfirmExit(false)}>
            Ở lại
          </GBtn>
          <GBtn className="flex-1" onClick={() => onExit(null)}>
            Rời trận
          </GBtn>
        </div>
      </Sheet>
    </div>
  );
};

const BattleResult: React.FC<{ b: BattleState; onDone: () => void }> = ({ b, onDone }) => {
  const { state } = useGame();
  const stars = starsOf(b);
  const prevStars = state.campaign[b.phase.id] ?? 0;
  const win = b.result === 'win';
  return (
    <Sheet open persistent onClose={onDone} title={win ? 'Chiến thắng!' : 'Lui quân'} subtitle={b.endText} wide>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="flex flex-col items-center text-center gap-3">
          <Mascot size={110} mood={win ? 'excited' : 'sad'} accessory={win ? 'helmet' : 'none'} bob={win} />
          {win && <Stars n={stars} size={34} label={`Đạt ${stars}/3 sao`} />}
          <ul className="text-left w-full space-y-1.5 text-sm">
            <li className={`flex items-center gap-2 ${win ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}`}>
              {win ? <Check className="w-4 h-4 shrink-0" aria-hidden={true} /> : <X className="w-4 h-4 shrink-0" aria-hidden={true} />} Thắng trận
            </li>
            <li className={`flex items-center gap-2 ${b.stratGood ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}`}>
              {b.stratGood ? <Check className="w-4 h-4 shrink-0" aria-hidden={true} /> : <X className="w-4 h-4 shrink-0" aria-hidden={true} />} Kế sách “{b.phase.strat.name}”: {b.phase.strat.starHint.charAt(0).toLowerCase() + b.phase.strat.starHint.slice(1)} (trả lời đúng câu hỏi)
            </li>
            <li className={`flex items-center gap-2 ${b.answered > 0 && b.correct / b.answered >= 0.8 ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}`}>
              {b.answered > 0 && b.correct / b.answered >= 0.8 ? <Check className="w-4 h-4 shrink-0" aria-hidden={true} /> : <X className="w-4 h-4 shrink-0" aria-hidden={true} />} Trả lời đúng từ 80% (
              {b.correct}/{b.answered})
            </li>
          </ul>
          {win && stars > prevStars && <p className="g-chip bg-dong-nhat text-dong-chu !text-sm">Kỷ lục mới của màn này!</p>}
        </div>
        <div className="space-y-3">
          <div className="g-inset p-4">
            <p className="font-display font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-ngoc-chu" aria-hidden={true} /> Sử Ký: {b.phase.name} ({b.phase.date})
            </p>
            <p className="mt-1 leading-relaxed">{b.phase.history}</p>
            <LoreChip lore="chinh_su" className="mt-2" />
          </div>
          {b.phase.id === 'm2p1' && win && (
            <div className="rounded-2xl border-2 border-hoa bg-hoa-nhat p-4">
              <p className="font-display font-bold text-hoa-chu">Tưởng nhớ Trần Bình Trọng</p>
              <p className="text-sm leading-relaxed mt-1">Ông đã hy sinh để triều đình rút lui an toàn. Câu nói “Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!” còn vang mãi.</p>
            </div>
          )}
          {!win && <InfoNote>Mỗi câu sai trong trận đều có giải thích. Em ôn lại chủ đề của màn ở Quốc Tử Giám rồi đánh lại nhé – không mất gì ngoài lượt chơi.</InfoNote>}
          <GBtn variant={win ? 'ngoc' : 'son'} size="lg" className="w-full" onClick={onDone}>
            {win ? <Trophy className="w-5 h-5" aria-hidden={true} /> : <RotateCcw className="w-5 h-5" aria-hidden={true} />} {win ? 'Nhận thưởng' : 'Về bản đồ chiến dịch'}
          </GBtn>
        </div>
      </div>
    </Sheet>
  );
};

// ---------------------------------------------------------------------------
// game/campaign – bản đồ chiến dịch 3 màn
// ---------------------------------------------------------------------------

const CAMPAIGN_ROUTES: Record<1 | 2 | 3, Array<{ path: string; enemy?: boolean }>> = {
  1: [{ path: 'M40 60 C80 100 110 130 132 150 C150 168 165 190 176 204', enemy: true }],
  2: [
    { path: 'M296 58 C292 90 288 110 282 128 C280 150 279 170 278 192 C250 198 214 202 186 206', enemy: true },
    { path: 'M246 492 C230 460 200 430 178 404 C200 380 226 350 244 324', enemy: true },
  ],
  3: [
    { path: 'M296 58 C292 90 288 110 282 128 C280 150 279 170 278 192', enemy: true },
    { path: 'M436 170 C420 182 404 192 392 200 C370 214 352 226 336 236', enemy: true },
  ],
};

const TeamPicker: React.FC<{ phase: PhaseDef; onStart: (team: string[]) => void; onClose: () => void }> = ({ phase, onStart, onClose }) => {
  const { state, update } = useGame();
  const owned = HEROES.filter((h) => state.heroes[h.id]);
  const recommended = phase.recommended.filter((id) => state.heroes[id]);
  const [team, setTeam] = useState<string[]>(() => {
    const t = [...recommended];
    for (const h of owned) if (t.length < 3 && !t.includes(h.id)) t.push(h.id);
    return t.slice(0, 3);
  });
  const toggle = (id: string) => setTeam((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length >= 3 ? t : [...t, id]));
  const cost = 5;
  const canStart = team.length === 3 && state.quan >= cost;
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Xuất trận: ${phase.name}`}
      subtitle={`${phase.date} · ${MAP_PLACES[phase.place].name}`}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <span className={`g-chip !text-sm ${state.quan >= cost ? 'bg-giay-2 text-muc' : 'bg-son-nhat text-son-chu'}`}>
            <Shield className="w-4 h-4" aria-hidden={true} /> Cần {cost} Quân Lực (có {state.quan})
          </span>
          <GBtn
            variant="son"
            size="lg"
            className="ml-auto"
            disabled={!canStart}
            onClick={() => {
              update((s) => ({ ...s, quan: s.quan - cost }));
              onStart(team);
            }}
          >
            <Swords className="w-5 h-5" aria-hidden={true} /> Bắt đầu trận
          </GBtn>
        </div>
      }
    >
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="g-inset p-4">
            <p className="font-display font-bold text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-dong-chu" aria-hidden={true} /> Tình báo
            </p>
            <p className="mt-1 leading-relaxed">{phase.story}</p>
            <p className="mt-2 font-semibold">Mục tiêu: {phase.objective}</p>
          </div>
          <div>
            <p className="font-display font-bold mb-2">Quân địch</p>
            <ul className="grid gap-2">
              {phase.enemies.map((e, i) => {
                const d = ENEMIES[e.id];
                const t = ENEMY_TYPES[d.type];
                return (
                  <li key={i} className="g-card-flat p-2.5 flex items-center gap-3">
                    <EnemyBadge enemy={d} size={42} />
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold leading-tight">{d.name}</p>
                      <p className="text-xs text-muc-2">
                        {t.name} · bị khắc bởi {t.weak.map((w) => ELEMENTS[w].name).join(', ')}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <InfoNote className="mt-2">{ENEMY_TYPES[ENEMIES[phase.enemies[0].id].type].lesson}</InfoNote>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display font-bold">Chọn 3 tướng ({team.length}/3)</p>
            {recommended.length > 0 && (
              <GBtn
                variant="ghost"
                size="sm"
                onClick={() => {
                  const t = [...recommended];
                  for (const h of owned) if (t.length < 3 && !t.includes(h.id)) t.push(h.id);
                  setTeam(t.slice(0, 3));
                }}
              >
                Đội hình gợi ý
              </GBtn>
            )}
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {owned.map((h) => {
              const on = team.includes(h.id);
              const rec = phase.recommended.includes(h.id);
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => toggle(h.id)}
                    aria-pressed={on}
                    className={`w-full rounded-2xl p-2 border-2 flex flex-col items-center gap-1 text-center ${on ? 'border-son bg-son-nhat' : 'border-vien bg-the'}`}
                  >
                    <HeroMedallion hero={h} stage={state.heroes[h.id]?.stage} size={48} />
                    <span className="font-display font-bold text-sm leading-tight">{h.name}</span>
                    {rec && <span className="g-chip bg-dong-nhat text-dong-chu !text-[10px]">Gợi ý</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {phase.recommended.some((id) => !state.heroes[id]) && (
            <InfoNote>
              Đội hình gợi ý còn thiếu: {phase.recommended.filter((id) => !state.heroes[id]).map((id) => HERO_BY_ID[id].name).join(', ')}. Chiêu mộ ở Hội Quán Vạn Kiếp.
            </InfoNote>
          )}
          <div className="g-card-flat p-3 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-dong-chu" aria-hidden={true} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Cổ vật mang theo</p>
              <p className="text-sm text-muc-2">{state.relic ? RELICS[state.relic].name : 'Chưa chọn (chọn trong Doanh Trại → Cổ vật)'}</p>
            </div>
            {state.relics.length > 0 && (
              <select
                className="input-duo !w-auto !min-h-[44px] !py-1"
                value={state.relic ?? ''}
                onChange={(e) => update((s) => ({ ...s, relic: e.target.value || null }))}
                aria-label="Chọn cổ vật mang theo"
              >
                <option value="">Không mang</option>
                {state.relics.map((r) => (
                  <option key={r} value={r}>
                    {RELICS[r].name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
};

const CampaignTab: React.FC<{ onGoto: (tab: GameTab, sub?: string) => void }> = ({ onGoto }) => {
  const { state, update, dark, reward, bumpDaily, finishSession, toast, sound } = useGame();
  const firstOpen = ([1, 2, 3] as const).find((c) => !campaignDone(state, c)) ?? 3;
  const [sel, setSel] = useState<1 | 2 | 3>(firstOpen);
  const [prep, setPrep] = useState<PhaseDef | null>(null);
  const [fight, setFight] = useState<{ phase: PhaseDef; team: string[] } | null>(null);
  const [story, setStory] = useState<null | { title: string; text: string; heroes: string[] }>(null);
  const [finale, setFinale] = useState(false);
  const allDone = campaignDone(state, 3);

  const onExit = (b: BattleState | null, team: string[]) => {
    setFight(null);
    if (!b) return;
    const phase = b.phase;
    const stars = starsOf(b);
    const before = state.campaign[phase.id] ?? 0;
    finishSession('battle', b.correct, Math.max(1, b.answered));
    bumpDaily('battle');
    const bumpHeroes = (s: GameState) =>
      Object.fromEntries(Object.entries(s.heroes).map(([id, h]) => [id, team.includes(id) ? { ...h, battles: h.battles + 1 } : h])) as Record<string, HeroState>;
    if (b.result !== 'win') {
      update((s) => ({ ...s, stats: { ...s.stats, battles: s.stats.battles + 1 }, heroes: bumpHeroes(s) }));
      return;
    }
    const k = before === 0 ? 1 : 0.3;
    const gotLuong = Math.round(phase.reward.luong * k);
    const gotQuan = Math.round(phase.reward.quan * k);
    const campaignAfter = { ...state.campaign, [phase.id]: Math.max(before, stars) };
    const done = (c: 1 | 2) => PHASES.filter((p) => p.campaign === c).every((p) => (campaignAfter[p.id] ?? 0) > 0);
    const unlock1 = done(1) && !state.relics.includes('co_sau_chu');
    const unlock2 = done(2) && !state.relics.includes('tung_gia');
    const joined = unlock1 ? (CAMPAIGNS[1].joinHeroes ?? []).filter((id) => !state.heroes[id]) : [];
    update((s) => {
      let next: GameState = {
        ...s,
        campaign: { ...s.campaign, [phase.id]: Math.max(s.campaign[phase.id] ?? 0, stars) },
        codex: [...new Set([...s.codex, ...phase.units])],
        stats: { ...s.stats, battles: s.stats.battles + 1, wins: s.stats.wins + 1 },
        heroes: bumpHeroes(s),
      };
      if (unlock1 && !next.relics.includes('co_sau_chu')) {
        next = {
          ...next,
          heroes: { ...next.heroes, ...Object.fromEntries(joined.filter((id) => !next.heroes[id]).map((id) => [id, { stage: 1 as const, battles: 0 }])) },
          relics: [...next.relics, 'co_sau_chu'],
          cards: { ...next.cards, tuong_hoang_toc: (next.cards.tuong_hoang_toc ?? 0) + 1, binh_than: (next.cards.binh_than ?? 0) + 1 },
        };
      }
      if (unlock2 && !next.relics.includes('tung_gia')) next = { ...next, relics: [...next.relics, 'tung_gia'] };
      return next;
    });
    reward(gotLuong, gotQuan);
    if (stars > before) sound('win');
    if (unlock1)
      setStory({
        title: 'Hội nghị Bình Than (10/1282)',
        text: 'Vua Trần Nhân Tông họp vương hầu, trăm quan bàn kế đánh giặc và cử Trần Quốc Tuấn làm Quốc công Tiết chế. Các tướng mới gia nhập. Em nhận thẻ Tướng hoàng tộc, thẻ Hội nghị Bình Than và cổ vật Cờ thêu sáu chữ vàng.',
        heroes: joined,
      });
    else if (unlock2) setStory({ title: 'Kháng chiến lần thứ hai thắng lợi!', text: 'Em nhận cổ vật Thơ “Tụng giá hoàn kinh sư” của Trần Quang Khải.', heroes: [] });
    else toast(`Nhận ${fmt(gotLuong)} Lương Thảo, ${gotQuan} Quân Lực`);
  };

  const phases = PHASES.filter((p) => p.campaign === sel);
  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 space-y-4">
      <SectionTitle title="Chiến Dịch" subtitle="Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="g-card overflow-hidden">
          <SchematicMap
            dark={dark}
            className="w-full h-auto"
            pins={[...new Set(phases.map((p) => p.place))]}
            highlight={phases.find((p) => phaseUnlocked(state, p) && !(state.campaign[p.id] ?? 0))?.place ?? null}
            routes={CAMPAIGN_ROUTES[sel]}
            title={`Lược đồ ${CAMPAIGNS[sel - 1].name}`}
          />
          <p className="px-4 pb-3 text-xs text-muc-2">Mũi tên đỏ: hướng tiến quân của giặc (minh họa).</p>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Chọn màn">
            {CAMPAIGNS.map((c) => {
              const locked = c.id > 1 && !campaignDone(state, (c.id - 1) as 1 | 2);
              const on = sel === c.id;
              return (
                <button
                  key={c.id}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setSel(c.id)}
                  className={`rounded-2xl p-2.5 border-2 text-left min-h-[88px] ${on ? 'border-son bg-son-nhat' : 'border-vien bg-the'} ${locked ? 'opacity-70' : ''}`}
                >
                  <p className="text-xs font-bold text-dong-chu">Màn {c.id}</p>
                  <p className="font-display font-extrabold leading-tight">{c.years}</p>
                  <div className="mt-1 flex items-center gap-1">
                    {locked ? <Lock className="w-4 h-4 text-muc-3" aria-label="Chưa mở" /> : <Stars n={Math.round(campaignStars(state, c.id) / 3)} size={14} label={`${campaignStars(state, c.id)}/9 sao`} />}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="g-inset p-3">
            <p className="font-display font-extrabold text-lg">{CAMPAIGNS[sel - 1].name}</p>
            <p className="text-sm text-muc-2">{CAMPAIGNS[sel - 1].desc}</p>
          </div>
          <ol className="grid gap-2.5">
            {phases.map((p, i) => {
              const open = phaseUnlocked(state, p);
              const stars = state.campaign[p.id] ?? 0;
              return (
                <li key={p.id} className={`g-card p-3 flex items-center gap-3 ${open ? '' : 'opacity-70'}`}>
                  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center font-display font-extrabold text-lg shrink-0 ${stars ? 'bg-ngoc text-white' : open ? 'bg-son text-white' : 'bg-giay-2 text-muc-3'}`}>
                    {open ? i + 1 : <Lock className="w-5 h-5" aria-label="Chưa mở" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-extrabold leading-tight">{p.name}</p>
                    <p className="text-xs text-muc-2">
                      {p.date} · {MAP_PLACES[p.place].name}
                    </p>
                    <Stars n={stars} size={15} />
                  </div>
                  <GBtn variant={stars ? 'giay' : 'son'} size="sm" disabled={!open} onClick={() => setPrep(p)}>
                    {stars ? 'Đánh lại' : 'Xuất trận'} <ChevronRight className="w-4 h-4" aria-hidden={true} />
                  </GBtn>
                </li>
              );
            })}
          </ol>
          {sel > 1 && !campaignDone(state, (sel - 1) as 1 | 2) && <InfoNote>Hoàn thành Màn {sel - 1} để mở màn này.</InfoNote>}
          {allDone && (
            <div className="rounded-3xl border-2 border-dong bg-dong-nhat p-4 flex flex-wrap items-center gap-3">
              <Trophy className="w-8 h-8 text-dong-chu" aria-hidden={true} />
              <div className="flex-1 min-w-[180px]">
                <p className="font-display font-extrabold text-lg">Tổng kết: Hào Khí Đông A</p>
                <p className="text-sm text-muc">Trả lời 5 câu về nguyên nhân thắng lợi và ý nghĩa lịch sử của ba lần kháng chiến.</p>
              </div>
              <GBtn variant="dong" onClick={() => setFinale(true)}>
                Làm bài tổng kết
              </GBtn>
            </div>
          )}
        </div>
      </div>
      {prep && (
        <TeamPicker
          phase={prep}
          onClose={() => setPrep(null)}
          onStart={(team) => {
            setFight({ phase: prep, team });
            setPrep(null);
          }}
        />
      )}
      {fight && <BattleScreen phase={fight.phase} team={fight.team} onExit={(b) => onExit(b, fight.team)} />}
      {story && (
        <Sheet open onClose={() => setStory(null)} title={story.title} subtitle="Sự kiện lịch sử mở khóa">
          <div className="space-y-4">
            <p className="leading-relaxed">{story.text}</p>
            {story.heroes.length > 0 && (
              <ul className="grid grid-cols-2 gap-2">
                {story.heroes.map((id) => (
                  <li key={id} className="g-card-flat p-2 flex items-center gap-2">
                    <HeroMedallion hero={HERO_BY_ID[id]} size={42} />
                    <span className="font-display font-bold text-sm leading-tight">{HERO_BY_ID[id].name}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <GBtn variant="giay" className="flex-1" onClick={() => setStory(null)}>
                Đóng
              </GBtn>
              <GBtn
                variant="ngoc"
                className="flex-1"
                onClick={() => {
                  setStory(null);
                  onGoto('barracks', 'heroes');
                }}
              >
                <Users className="w-4 h-4" aria-hidden={true} /> Xem Doanh Trại
              </GBtn>
            </div>
          </div>
        </Sheet>
      )}
      <QuizSheet
        open={finale}
        onClose={() => setFinale(false)}
        title="Tổng kết: Hào Khí Đông A"
        subtitle="Nguyên nhân thắng lợi và ý nghĩa lịch sử"
        request={{ units: ['ALL_3_WARS_SUMMARY', 'CAUSES_OF_VICTORY', 'HISTORICAL_SIGNIFICANCE'], count: 5 }}
        passMark={4}
        timer
        sessionKind="practice"
        finishLabel="Hoàn thành"
        onFinish={(sum) => {
          if (sum.passed) {
            update((s) => ({ ...s, codex: [...new Set([...s.codex, 'ALL_3_WARS_SUMMARY', 'CAUSES_OF_VICTORY', 'HISTORICAL_SIGNIFICANCE'])] }));
            toast('Em đã hoàn thành chiến dịch Hào Khí Đông A!');
          }
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// game/exam – Quốc Tử Giám (khảo thí)
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<string, string> = {
  KHANG_CHIEN_LAN_1_1258: 'Kháng chiến lần thứ nhất (1258)',
  BINH_THAN_TRAN_QUOC_TOAN: 'Hội nghị Bình Than & Trần Quốc Toản',
  DIEN_HONG_HICH_TUONG_SI: 'Diên Hồng, Hịch tướng sĩ & Trần Hưng Đạo',
  KHANG_CHIEN_LAN_2_1285: 'Kháng chiến lần thứ hai (1285)',
  HAI_CHIEN_VAN_DON_1288: 'Trận Vân Đồn (1288)',
  DAI_THANG_BACH_DANG_1288: 'Đại thắng Bạch Đằng (1288)',
  NGUYEN_NHAN_Y_NGHIA: 'Nguyên nhân thắng lợi & ý nghĩa',
  DANH_TUONG_GIA_THAN: 'Danh tướng & gia tướng',
  NEN_TANG_QUAN_SU: 'Nền tảng quân sự Đại Việt',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL);

const TOWER_FLOORS = Array.from({ length: 10 }, (_, i) => {
  const floor = i + 1;
  const boss = floor % 5 === 0;
  return {
    floor,
    boss,
    count: boss ? 5 : 3,
    pass: boss ? 4 : 2,
    levels: floor <= 3 ? ['NHAN_BIET'] : floor <= 7 ? ['THONG_HIEU', 'NHAN_BIET'] : ['VAN_DUNG', 'THONG_HIEU'],
    levelText: floor <= 3 ? 'Nhận biết' : floor <= 7 ? 'Thông hiểu' : 'Vận dụng',
    relic: floor === 5 ? 'hich' : floor === 10 ? 'binh_thu_relic' : null,
    luong: 40 * floor,
  };
});

interface Recommendation {
  unit_id: string;
  topic: string;
  current_mastery: number;
  reason: string;
}

const ExamTab: React.FC = () => {
  const { state, update, progress, codex, request, reward, toast, openLive } = useGame();
  const [quiz, setQuiz] = useState<null | { title: string; subtitle?: string; req: QuestionRequest; pass?: number; kind: 'practice' | 'tower'; floor?: number; timer?: boolean }>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    request<{ recommendations: Recommendation[] }>('/api/student/recommendations?top_k=4')
      .then((r) => alive && setRecs(r.recommendations ?? []))
      .catch(() => alive && setRecs([]));
    return () => {
      alive = false;
    };
  }, [request, progress.questions_answered]);

  const byCategory = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const e of codex) (m[e.category] ??= []).push(e.unit_id);
    return m;
  }, [codex]);
  const nextFloor = TOWER_FLOORS[Math.min(9, state.tower)];

  const modes = [
    {
      id: 'quick',
      title: 'Luyện nhanh',
      desc: '5 câu ngẫu nhiên, khoảng 2 phút.',
      Icon: Zap,
      tone: 'bg-son',
      onClick: () => setQuiz({ title: 'Luyện nhanh', subtitle: '5 câu về ba lần kháng chiến', req: { count: 5 }, kind: 'practice', timer: true }),
    },
    { id: 'topic', title: 'Theo chủ đề', desc: 'Chọn một chủ đề trong bài học để luyện.', Icon: Layers, tone: 'bg-thuy', onClick: () => setTopicOpen(true) },
    {
      id: 'weak',
      title: 'Ôn điểm yếu',
      desc: 'Câu hỏi thuộc các chủ đề em cần củng cố (theo BKT). Ấn Tín thưởng cao hơn.',
      Icon: Target,
      tone: 'bg-ngoc',
      onClick: () => setQuiz({ title: 'Ôn điểm yếu', subtitle: 'Câu hỏi chọn theo mức nắm vững của em', req: { count: 5, mode: 'weak' }, kind: 'practice' }),
    },
    {
      id: 'ai',
      title: 'Đề của Quân Sư AI',
      desc: 'Quân Sư soạn 3 câu mới từ kho tri thức (RAG).',
      Icon: Sparkles,
      tone: 'bg-thong',
      onClick: () => setQuiz({ title: 'Đề của Quân Sư AI', subtitle: 'Câu hỏi do AI soạn, server chấm', req: { count: 3, ai: true }, kind: 'practice' }),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 space-y-5">
      <SectionTitle title="Quốc Tử Giám" subtitle="Khảo thí – trả lời đúng để nhận Ấn Tín, Lương Thảo và XP" />
      <section className="g-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4" aria-labelledby="live-entry-title">
        <span className="w-14 h-14 rounded-2xl bg-son text-white flex items-center justify-center shrink-0">
          <Radio className="w-7 h-7" aria-hidden={true} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 id="live-entry-title" className="font-display font-extrabold text-lg leading-tight">
            Thi đấu cả lớp
          </h3>
          <p className="text-sm text-muc-2">Thầy cô mở phòng và đọc mã PIN – em nhập mã để thi đấu trực tiếp cùng cả lớp. Trả lời đúng và nhanh để giành điểm cao.</p>
        </div>
        <GBtn size="lg" className="w-full sm:w-auto" onClick={() => openLive()}>
          <Radio className="w-5 h-5" aria-hidden={true} /> Vào phòng
        </GBtn>
      </section>
      <section>
        <h3 className="font-display font-extrabold text-lg mb-2">Chế độ khảo thí</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {modes.map((m) => (
            <button key={m.id} type="button" onClick={m.onClick} className="g-card p-4 text-left flex flex-col gap-2 hover:-translate-y-0.5 transition min-h-[150px]">
              <span className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center ${m.tone}`}>
                <m.Icon className="w-6 h-6" aria-hidden={true} />
              </span>
              <p className="font-display font-extrabold text-lg leading-tight">{m.title}</p>
              <p className="text-sm text-muc-2">{m.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-3">
        <div className="g-card p-4">
          <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
            <Stamp className="w-4 h-4 text-dong-chu" aria-hidden={true} /> Ấn Tín hôm nay
          </p>
          <p className="font-display font-extrabold text-2xl tabular">
            {progress.day_gems}/{progress.daily_gem_cap}
          </p>
          <Bar value={progress.day_gems} max={progress.daily_gem_cap} fill="bg-dong" label="Ấn Tín đã nhận hôm nay" className="mt-1" />
        </div>
        <div className="g-card p-4">
          <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
            <Check className="w-4 h-4 text-ngoc-chu" aria-hidden={true} /> Độ chính xác
          </p>
          <p className="font-display font-extrabold text-2xl tabular">{pct(progress.accuracy)}</p>
          <p className="text-sm text-muc-2">
            {progress.questions_correct}/{progress.questions_answered} câu · hôm nay {progress.day_correct} câu đúng
          </p>
        </div>
        <div className="g-card p-4">
          <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-hoa-chu" aria-hidden={true} /> Chuỗi ngày học
          </p>
          <p className="font-display font-extrabold text-2xl tabular">{progress.streak} ngày</p>
          <p className="text-sm text-muc-2 flex items-center gap-1">
            <Snowflake className="w-3.5 h-3.5" aria-hidden={true} />
            {progress.freeze_available ? 'Còn 1 ngày nghỉ phép tuần này' : 'Đã dùng ngày nghỉ phép tuần này'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="g-card p-4 space-y-3" aria-labelledby="tower-title">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-son text-white flex items-center justify-center">
              <Landmark className="w-6 h-6" aria-hidden={true} />
            </span>
            <div className="flex-1">
              <h3 id="tower-title" className="font-display font-extrabold text-lg leading-tight">
                Tháp Khảo Thí
              </h3>
              <p className="text-sm text-muc-2">10 tầng, khó dần từ Nhận biết đến Vận dụng. Tầng 5 và 10 là Đình thí.</p>
            </div>
          </div>
          <ol className="grid grid-cols-5 gap-2" aria-label="Các tầng tháp">
            {TOWER_FLOORS.map((f) => {
              const cleared = state.tower >= f.floor;
              const current = state.tower + 1 === f.floor;
              return (
                <li
                  key={f.floor}
                  className={`rounded-xl border-2 aspect-square flex flex-col items-center justify-center font-display font-extrabold ${
                    cleared ? 'bg-ngoc text-white border-ngoc-dam' : current ? 'bg-dong-nhat text-dong-chu border-dong' : 'bg-giay-2 text-muc-3 border-vien'
                  }`}
                  aria-label={`Tầng ${f.floor}${f.boss ? ' (Đình thí)' : ''}${cleared ? ', đã vượt' : current ? ', tầng hiện tại' : ''}`}
                >
                  {f.boss ? <Trophy className="w-4 h-4" aria-hidden={true} /> : null}
                  {f.floor}
                </li>
              );
            })}
          </ol>
          {state.tower >= 10 ? (
            <p className="font-semibold text-ngoc-chu">Em đã chinh phục cả 10 tầng! Có thể thử lại tầng 10 để luyện thêm.</p>
          ) : (
            <p className="text-sm text-muc-2">
              Tầng {nextFloor.floor}: {nextFloor.count} câu mức {nextFloor.levelText}, cần đúng {nextFloor.pass}. Thưởng {fmt(nextFloor.luong)} Lương Thảo
              {nextFloor.relic ? ` và cổ vật ${RELICS[nextFloor.relic].name}` : ''}.
            </p>
          )}
          <GBtn
            variant="son"
            size="lg"
            className="w-full"
            onClick={() =>
              setQuiz({
                title: `Tháp Khảo Thí – Tầng ${nextFloor.floor}${nextFloor.boss ? ' (Đình thí)' : ''}`,
                subtitle: `Mức ${nextFloor.levelText} · cần đúng ${nextFloor.pass}/${nextFloor.count}`,
                req: { count: nextFloor.count, levels: nextFloor.levels },
                pass: nextFloor.pass,
                kind: 'tower',
                floor: nextFloor.floor,
                timer: true,
              })
            }
          >
            <Building2 className="w-5 h-5" aria-hidden={true} /> {state.tower >= 10 ? 'Thử lại tầng 10' : `Leo tầng ${nextFloor.floor}`}
          </GBtn>
          <p className="text-xs text-muc-2">Trả lời sai không bị rớt tầng – chỉ dừng lượt, em thử lại khi sẵn sàng.</p>
        </section>

        <section className="g-card p-4 space-y-3" aria-labelledby="weak-title">
          <h3 id="weak-title" className="font-display font-extrabold text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-ngoc-chu" aria-hidden={true} /> Chủ đề cần củng cố
          </h3>
          {recs === null ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : recs.length === 0 ? (
            <p className="text-sm text-muc-2">Em đang nắm vững các chủ đề đã học. Tiếp tục khảo thí để mở rộng nhé!</p>
          ) : (
            <ul className="grid gap-2">
              {recs.map((r) => (
                <li key={r.unit_id} className="g-card-flat p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-tight">{r.topic}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Bar value={r.current_mastery} max={1} fill={r.current_mastery >= 0.6 ? 'bg-ngoc' : 'bg-dong'} className="flex-1 !h-2" label={`Mức nắm vững ${r.topic}`} />
                      <span className="text-xs font-bold text-muc-2 tabular">{Math.round(r.current_mastery * 100)}%</span>
                    </div>
                  </div>
                  <GBtn variant="giay" size="sm" onClick={() => setQuiz({ title: 'Ôn chủ đề', subtitle: r.topic, req: { units: [r.unit_id], count: 3 }, kind: 'practice' })}>
                    Ôn <ChevronRight className="w-4 h-4" aria-hidden={true} />
                  </GBtn>
                </li>
              ))}
            </ul>
          )}
          <InfoNote>Mức nắm vững tính bằng mô hình Bayesian Knowledge Tracing (BKT) từ các câu em đã trả lời.</InfoNote>
        </section>
      </div>

      <section className="g-card-flat p-4 flex items-start gap-3">
        <Radio className="w-6 h-6 text-muc-2 shrink-0" aria-hidden={true} />
        <div>
          <p className="font-display font-bold">Thi đấu lớp</p>
          <p className="text-sm text-muc-2">Thầy cô mở phòng thi đấu trực tiếp trên máy chiếu ở trang giáo viên; cả lớp trả lời cùng lúc.</p>
        </div>
      </section>
      <InfoNote>Quốc Tử Giám được dựng từ năm 1076 (thời Lý) và tiếp tục được coi trọng dưới thời Trần.</InfoNote>

      <Sheet open={topicOpen} onClose={() => setTopicOpen(false)} title="Luyện theo chủ đề" subtitle="Chọn một chủ đề trong bài học">
        <ul className="grid gap-2">
          {CATEGORY_ORDER.filter((c) => byCategory[c]?.length).map((c) => (
            <li key={c}>
              <button
                type="button"
                className="ans-btn"
                onClick={() => {
                  setTopicOpen(false);
                  setQuiz({ title: 'Luyện theo chủ đề', subtitle: CATEGORY_LABEL[c], req: { units: byCategory[c], count: 5 }, kind: 'practice', timer: true });
                }}
              >
                <BookOpen className="w-5 h-5 text-ngoc-chu shrink-0" aria-hidden={true} />
                <span className="flex-1">{CATEGORY_LABEL[c]}</span>
                <ChevronRight className="w-5 h-5 text-muc-3" aria-hidden={true} />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {quiz && (
        <QuizSheet
          open
          onClose={() => setQuiz(null)}
          title={quiz.title}
          subtitle={quiz.subtitle}
          request={quiz.req}
          passMark={quiz.pass}
          timer={quiz.timer}
          sessionKind={quiz.kind}
          onFinish={(sum) => {
            if (quiz.kind !== 'tower' || !quiz.floor) {
              if (sum.correct > 0) reward(sum.correct * 3, 0);
              return;
            }
            if (!sum.passed) return toast(`Chưa vượt tầng ${quiz.floor}. Thử lại nhé – câu hỏi sẽ khác!`);
            const f = TOWER_FLOORS[quiz.floor - 1];
            const firstTime = state.tower < f.floor;
            update((s) => ({ ...s, tower: Math.max(s.tower, f.floor), relics: f.relic && !s.relics.includes(f.relic) ? [...s.relics, f.relic] : s.relics }));
            if (firstTime) reward(f.luong, 2);
            toast(firstTime ? `Vượt tầng ${f.floor}! +${fmt(f.luong)} Lương Thảo${f.relic ? `, nhận cổ vật ${RELICS[f.relic].name}` : ''}` : `Đã vượt lại tầng ${f.floor}`);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// game/codex – Sử Ký (dòng thời gian, thẻ tri thức) và Quân Sư AI
// ---------------------------------------------------------------------------

const TIMELINE: Array<{ date: string; title: string; place?: PlaceId; units: string[] }> = [
  { date: 'Trước 1258', title: 'Mông Cổ âm mưu xâm lược, vua Trần bắt giam sứ giả', units: ['KC1_WHY_INVADE'] },
  { date: 'Tháng 1/1258', title: 'Trận Bình Lệ Nguyên – rút lui bảo toàn lực lượng', place: 'binh_le_nguyen', units: ['KC1_BINH_LE_NGUYEN', 'KC1_TRAN_THU_DO_QUOTE'] },
  { date: 'Tháng 1/1258', title: 'Vườn không nhà trống ở Thăng Long', place: 'thang_long', units: ['KC1_VUON_KHONG_NHA_TRONG'] },
  { date: '29/1/1258', title: 'Đại thắng Đông Bộ Đầu', place: 'dong_bo_dau', units: ['KC1_DONG_BO_DAU', 'KC1_OVERVIEW'] },
  { date: '10/1282', title: 'Hội nghị Bình Than – Trần Quốc Toản bóp nát quả cam', place: 'binh_than', units: ['BINH_THAN_CONFERENCE', 'TQT_WHY_ORANGE', 'TQT_SIX_GOLDEN_WORDS', 'TQT_OVERVIEW'] },
  { date: '1284', title: 'Hịch tướng sĩ – tinh thần Sát Thát', units: ['HICH_TUONG_SI', 'GAME_BINH_THU_YEU_LUOC', 'TRAN_HUNG_DAO_PORTRAIT'] },
  { date: 'Đầu năm 1285', title: 'Hội nghị Diên Hồng – “Đánh!”', place: 'thang_long', units: ['DIEN_HONG_CONFERENCE'] },
  { date: '1285', title: 'Thoát Hoan và Toa Đô đánh gọng kìm', units: ['KC2_OVERVIEW'] },
  { date: '2/1285', title: 'Trần Bình Trọng chặn giặc, giữ đường rút', units: ['KC2_TRAN_BINH_TRONG'] },
  { date: '5 – 6/1285', title: 'Tổng phản công: Hàm Tử, Chương Dương, Tây Kết', place: 'chuong_duong', units: ['KC2_HAM_TU_CHUONG_DUONG'] },
  { date: '6/1285', title: 'Thoát Hoan chui ống đồng tháo chạy', place: 'van_kiep', units: ['KC2_THOAT_HOAN_COPPER_PIPE'] },
  { date: 'Cuối 1287 – đầu 1288', title: 'Trần Khánh Dư phục kích ở Vân Đồn', place: 'van_don', units: ['KC3_VAN_DON', 'GAME_TRAN_KHANH_DU', 'KC3_OVERVIEW'] },
  { date: '4/1288', title: 'Đại thắng Bạch Đằng – bắt sống Ô Mã Nhi', place: 'bach_dang', units: ['KC3_BACH_DANG_HOW'] },
  { date: '1258 – 1288', title: 'Nguyên nhân thắng lợi và ý nghĩa lịch sử', units: ['ALL_3_WARS_SUMMARY', 'CAUSES_OF_VICTORY', 'HISTORICAL_SIGNIFICANCE'] },
];

const CodexCard: React.FC<{ entry: CodexEntry; unlocked: boolean; onOpen: () => void }> = ({ entry, unlocked, onOpen }) => (
  <button type="button" onClick={onOpen} className={`g-card w-full p-3 text-left flex items-start gap-3 hover:-translate-y-0.5 transition ${unlocked ? '' : 'opacity-75'}`}>
    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${unlocked ? 'bg-dong text-[#1c1917]' : 'bg-giay-2 text-muc-3'}`}>
      {unlocked ? <ScrollText className="w-6 h-6" aria-hidden={true} /> : <Lock className="w-5 h-5" aria-hidden={true} />}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-display font-bold leading-tight">{entry.topic}</span>
      <span className="block text-xs text-muc-2 mt-0.5">{unlocked ? entry.event : 'Trả lời 1 câu về chủ đề này để mở thẻ'}</span>
    </span>
  </button>
);

const CodexSheet: React.FC<{ entry: CodexEntry | null; unlocked: boolean; onClose: () => void; onUnlocked: (unit: string) => void }> = ({ entry, unlocked, onClose, onUnlocked }) => {
  const { askAdvisor } = useGame();
  const [quiz, setQuiz] = useState(false);
  if (!entry) return null;
  return (
    <>
      <Sheet open={!quiz} onClose={onClose} title={entry.topic} subtitle={entry.event} wide icon={<span className="w-11 h-11 rounded-2xl bg-dong text-[#1c1917] flex items-center justify-center"><ScrollText className="w-6 h-6" aria-hidden={true} /></span>}>
        {unlocked ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <LoreChip lore={entry.label} />
              {entry.badge && <span className="g-chip bg-dong-nhat text-dong-chu">{entry.badge}</span>}
              <span className="g-chip bg-giay-2 text-muc-2">{CATEGORY_LABEL[entry.category] ?? entry.category}</span>
            </div>
            <blockquote className="rounded-2xl border-l-4 border-dong bg-the p-4 font-serif text-[1.05rem] leading-relaxed">{entry.fact_chunk}</blockquote>
            {entry.answer && <RichText text={entry.answer} className="text-muc" />}
            {entry.entity && <p className="text-sm text-muc-2">Nhân vật: {entry.entity}</p>}
            {entry.source && <p className="text-xs font-semibold text-muc-2">Nguồn: {entry.source}</p>}
            <div className="flex flex-wrap gap-2">
              <GBtn variant="ngoc" onClick={() => askAdvisor(`Quân Sư kể thêm về ${entry.topic} cho em nhé`)}>
                <MessageSquare className="w-4 h-4" aria-hidden={true} /> Hỏi Quân Sư
              </GBtn>
              <GBtn variant="giay" onClick={() => setQuiz(true)}>
                <Target className="w-4 h-4" aria-hidden={true} /> Ôn 3 câu
              </GBtn>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <Mascot size={96} mood="thinking" accessory="scholar" />
            <p className="font-semibold">Thẻ Sử Ký này đang khóa.</p>
            <p className="text-sm text-muc-2">Trả lời đúng 1 câu về “{entry.topic}” để mở thẻ và đọc tư liệu.</p>
            <GBtn variant="son" onClick={() => setQuiz(true)}>
              <Lock className="w-4 h-4" aria-hidden={true} /> Mở thẻ
            </GBtn>
          </div>
        )}
      </Sheet>
      <QuizSheet
        open={quiz}
        onClose={() => setQuiz(false)}
        title={unlocked ? 'Ôn chủ đề' : 'Mở thẻ Sử Ký'}
        subtitle={entry.topic}
        request={{ units: [entry.unit_id], count: unlocked ? 3 : 1 }}
        passMark={1}
        sessionKind={unlocked ? 'practice' : null}
        finishLabel={unlocked ? 'Hoàn thành' : 'Đọc thẻ'}
        onFinish={(sum) => {
          if (!unlocked && sum.correct > 0) onUnlocked(entry.unit_id);
        }}
      />
    </>
  );
};

interface AdvisorMessage {
  id: number;
  from: 'me' | 'advisor';
  text: string;
  source?: string | null;
}

const ADVISOR_QUICK = ['Vì sao gọi là “vườn không nhà trống”?', 'Trận Bạch Đằng 1288 diễn ra thế nào?', 'Trần Khánh Dư đã làm gì ở Vân Đồn?', 'Nguyên nhân thắng lợi của ba lần kháng chiến?'];

const AdvisorChat: React.FC<{ pending: string | null; onConsumed: () => void }> = ({ pending, onConsumed }) => {
  const { user, request, bumpDaily } = useGame();
  const [messages, setMessages] = useState<AdvisorMessage[]>(() => [
    {
      id: 0,
      from: 'advisor',
      text: `Chào ${shortName(user.full_name)}! Ta là Quân Sư của Đông A. Em muốn hỏi gì về ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      setMessages((m) => [...m, { id: idRef.current++, from: 'me', text: q }]);
      setInput('');
      setLoading(true);
      bumpDaily('ask');
      request('/api/student/ai-question', { method: 'POST' }).catch(() => undefined);
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat/dong-a`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, character_id: `student_${user.id}`, session_id: `student_${user.id}` }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { answer: string; grounding_sources?: Array<{ curriculum_match?: string; doc_name?: string }> };
        const src = data.grounding_sources?.[0];
        setMessages((m) => [...m, { id: idRef.current++, from: 'advisor', text: data.answer, source: src?.curriculum_match ?? src?.doc_name ?? null }]);
      } catch {
        setMessages((m) => [
          ...m,
          { id: idRef.current++, from: 'advisor', text: 'Quân Sư đang bận một chút. Em đọc thẻ Sử Ký liên quan hoặc thử hỏi lại sau ít phút nhé.' },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [request, user.id, bumpDaily]
  );

  useEffect(() => {
    if (pending) {
      send(pending);
      onConsumed();
    }
  }, [pending, send, onConsumed]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="g-card flex flex-col h-[min(70dvh,640px)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-vien">
        <Mascot size={44} mood="happy" accessory="scholar" />
        <div>
          <p className="font-display font-extrabold leading-tight">Quân Sư Đông A</p>
          <p className="text-xs text-muc-2">Trả lời dựa trên kho tri thức Lịch sử 7 (RAG)</p>
        </div>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.from === 'me' ? 'bg-son text-white rounded-br-md' : 'bg-the border-2 border-vien rounded-bl-md'}`}>
              {m.from === 'me' ? <p>{m.text}</p> : <RichText text={m.text} />}
              {m.source && <p className="mt-1 text-xs font-semibold text-muc-2">Nguồn: {m.source}</p>}
            </div>
          </div>
        ))}
        {loading && <Spinner label="Quân Sư đang suy nghĩ…" />}
      </div>
      <div className="border-t-2 border-vien p-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ADVISOR_QUICK.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} className="g-chip !min-h-[36px] !px-3 bg-giay-2 text-muc whitespace-nowrap border-2 border-vien" disabled={loading}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label htmlFor="advisor-input" className="sr-only">
            Câu hỏi cho Quân Sư
          </label>
          <input id="advisor-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Hỏi Quân Sư về lịch sử…" className="input-duo flex-1" maxLength={300} />
          <GBtn type="submit" variant="ngoc" iconOnly disabled={loading || !input.trim()} aria-label="Gửi câu hỏi">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> : <Send className="w-5 h-5" aria-hidden={true} />}
          </GBtn>
        </form>
      </div>
    </div>
  );
};

const CodexTab: React.FC<{ sub: string; onSub: (s: string) => void; pendingQuestion: string | null; onConsumed: () => void }> = ({ sub, onSub, pendingQuestion, onConsumed }) => {
  const { codex, state, update, dark, bumpDaily } = useGame();
  const [open, setOpen] = useState<CodexEntry | null>(null);
  const [place, setPlace] = useState<PlaceId | null>(null);
  const byUnit = useMemo(() => Object.fromEntries(codex.map((e) => [e.unit_id, e])), [codex]);
  const unlockedSet = new Set(state.codex);
  const unlockedCount = codex.filter((e) => unlockedSet.has(e.unit_id)).length;

  const openEntry = (e: CodexEntry) => {
    setOpen(e);
    if (unlockedSet.has(e.unit_id)) bumpDaily('codex');
  };

  const tabs = [
    { id: 'timeline', label: 'Dòng thời gian' },
    { id: 'cards', label: `Thẻ Sử Ký (${unlockedCount}/${codex.length})` },
    { id: 'advisor', label: 'Quân Sư AI' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 space-y-4">
      <SectionTitle title="Sử Ký" subtitle="Bách khoa thu nhỏ về ba lần kháng chiến – nội dung khớp kho tri thức của Quân Sư" />
      <div className="flex gap-1 p-1 rounded-2xl bg-giay-2 w-full sm:w-fit overflow-x-auto" role="tablist" aria-label="Sử Ký">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={sub === t.id}
            onClick={() => onSub(t.id)}
            className={`min-h-[44px] px-4 rounded-xl font-display font-bold whitespace-nowrap ${sub === t.id ? 'bg-the text-son-chu shadow-[0_2px_0_var(--color-vien-2)]' : 'text-muc-2'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'advisor' ? (
        <AdvisorChat pending={pendingQuestion} onConsumed={onConsumed} />
      ) : sub === 'cards' ? (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((c) => {
            const list = codex.filter((e) => e.category === c);
            if (!list.length) return null;
            return (
              <section key={c}>
                <h3 className="font-display font-extrabold text-lg mb-2">{CATEGORY_LABEL[c]}</h3>
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {list.map((e) => (
                    <li key={e.unit_id}>
                      <CodexCard entry={e} unlocked={unlockedSet.has(e.unit_id)} onOpen={() => openEntry(e)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {!codex.length && <EmptyState mood="sad" title="Chưa tải được Sử Ký" text="Kiểm tra kết nối với máy chủ rồi mở lại trang nhé." />}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 items-start">
          <div className="g-card overflow-hidden lg:sticky lg:top-4">
            <SchematicMap dark={dark} className="w-full h-auto" pins={TIMELINE.flatMap((t) => (t.place ? [t.place] : []))} highlight={place} title="Lược đồ các địa danh trong dòng thời gian" />
          </div>
          <ol className="relative border-l-4 border-vien ml-3 space-y-3">
            {TIMELINE.map((t, i) => {
              const entries = t.units.map((u) => byUnit[u]).filter(Boolean) as CodexEntry[];
              return (
                <li key={i} className="pl-5 relative">
                  <span className="absolute -left-[12px] top-3 w-5 h-5 rounded-full bg-son border-4 border-giay" aria-hidden="true" />
                  <div className="g-card p-3 space-y-2" onMouseEnter={() => setPlace(t.place ?? null)} onFocus={() => setPlace(t.place ?? null)}>
                    <p className="text-xs font-bold text-dong-chu flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" aria-hidden={true} /> {t.date}
                      {t.place && (
                        <span className="text-muc-2 font-semibold flex items-center gap-1">
                          · <MapPin className="w-3.5 h-3.5" aria-hidden={true} /> {MAP_PLACES[t.place].name}
                        </span>
                      )}
                    </p>
                    <p className="font-display font-extrabold leading-tight">{t.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {entries.map((e) => (
                        <button
                          key={e.unit_id}
                          type="button"
                          onClick={() => openEntry(e)}
                          className={`g-chip !min-h-[36px] !px-3 !whitespace-normal text-left border-2 ${unlockedSet.has(e.unit_id) ? 'bg-dong-nhat text-dong-chu border-dong' : 'bg-giay-2 text-muc-2 border-vien'}`}
                        >
                          {unlockedSet.has(e.unit_id) ? <ScrollText className="w-3.5 h-3.5" aria-hidden={true} /> : <Lock className="w-3.5 h-3.5" aria-hidden={true} />}
                          {e.topic}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <CodexSheet
        entry={open}
        unlocked={!!open && unlockedSet.has(open.unit_id)}
        onClose={() => setOpen(null)}
        onUnlocked={(unit) => {
          update((s) => ({ ...s, codex: [...new Set([...s.codex, unit])] }));
          bumpDaily('codex');
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// game/shell – khung game của cổng học sinh
// ---------------------------------------------------------------------------

type GameTab = 'farm' | 'barracks' | 'campaign' | 'exam' | 'codex';

const GAME_TABS: Array<{ id: GameTab; label: string; Icon: IconType }> = [
  { id: 'farm', label: 'Điền Trang', Icon: Sprout },
  { id: 'barracks', label: 'Doanh Trại', Icon: Tent },
  { id: 'campaign', label: 'Chiến Dịch', Icon: Swords },
  { id: 'exam', label: 'Quốc Tử Giám', Icon: Landmark },
  { id: 'codex', label: 'Sử Ký', Icon: ScrollText },
];

const readGameTab = (): GameTab => {
  try {
    const saved = sessionStorage.getItem('donga_game_tab');
    return GAME_TABS.some((t) => t.id === saved) ? (saved as GameTab) : 'farm';
  } catch {
    return 'farm';
  }
};

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; Icon: IconType }> = ({ checked, onChange, label, desc, Icon }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="w-full flex items-center gap-3 min-h-[56px] text-left">
    <span className="w-10 h-10 rounded-xl bg-giay-2 text-muc-2 flex items-center justify-center shrink-0">
      <Icon className="w-5 h-5" aria-hidden={true} />
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-semibold">{label}</span>
      {desc && <span className="block text-sm text-muc-2">{desc}</span>}
    </span>
    <span className={`relative w-12 h-7 rounded-full transition shrink-0 ${checked ? 'bg-ngoc' : 'bg-vien-2'}`} aria-hidden="true">
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </span>
  </button>
);

const ProfileSheet: React.FC<{ open: boolean; onClose: () => void; onLogout: () => void; onChangePassword: () => void; onTutorial: () => void }> = ({ open, onClose, onLogout, onChangePassword, onTutorial }) => {
  const { user, progress, state, update, request } = useGame();
  const [tab, setTab] = useState<'rank' | 'settings'>('rank');
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const lvl = levelOf(progress.xp);
  const heroes = Object.keys(state.heroes).length;
  const stars = PHASES.reduce((s, p) => s + (state.campaign[p.id] ?? 0), 0);

  useEffect(() => {
    if (!open || tab !== 'rank') return;
    let alive = true;
    setBoard(null);
    request<LeaderboardEntry[]>('/api/student/leaderboard')
      .then((b) => alive && setBoard(b))
      .catch(() => alive && setBoard([]));
    return () => {
      alive = false;
    };
  }, [open, tab, request]);

  const setSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => update((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));

  return (
    <Sheet open={open} onClose={onClose} title={user.full_name} subtitle={`${user.username}${user.class_name ? ` · Lớp ${user.class_name}` : ''}`} wide icon={<span className="w-12 h-12 rounded-full text-white font-display font-extrabold text-lg flex items-center justify-center" style={{ background: avatarColor(user.username) }}>{initialsOf(user.full_name)}</span>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Cấp độ', value: `Cấp ${lvl}` },
            { label: 'XP tuần này', value: fmt(progress.week_xp) },
            { label: 'Sao chiến dịch', value: `${stars}/27` },
            { label: 'Tướng', value: `${heroes}/${HEROES.length}` },
          ].map((x) => (
            <div key={x.label} className="g-card-flat p-3">
              <p className="text-xs font-semibold text-muc-2">{x.label}</p>
              <p className="font-display font-extrabold text-lg tabular">{x.value}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-2xl bg-giay-2 w-fit" role="tablist" aria-label="Hồ sơ">
          {(
            [
              ['rank', 'Bảng xếp hạng tuần'],
              ['settings', 'Cài đặt'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-[44px] px-4 rounded-xl font-display font-bold ${tab === id ? 'bg-the text-son-chu shadow-[0_2px_0_var(--color-vien-2)]' : 'text-muc-2'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'rank' ? (
          board === null ? (
            <Spinner />
          ) : board.length === 0 ? (
            <p className="text-sm text-muc-2">Chưa có dữ liệu xếp hạng của lớp.</p>
          ) : (
            <ol className="grid gap-2">
              {board.map((e, i) => (
                <li key={e.id} className={`flex items-center gap-3 rounded-2xl p-2.5 border-2 ${e.is_me ? 'border-dong bg-dong-nhat' : 'border-vien bg-the'}`}>
                  <span className={`w-8 text-center font-display font-extrabold ${i < 3 ? 'text-dong-chu' : 'text-muc-2'}`}>{i < 3 ? <Medal className="w-5 h-5 mx-auto" aria-label={`Hạng ${i + 1}`} /> : i + 1}</span>
                  <span className="w-9 h-9 rounded-full text-white font-bold text-xs flex items-center justify-center" style={{ background: avatarColor(e.full_name) }} aria-hidden="true">
                    {initialsOf(e.full_name)}
                  </span>
                  <span className="flex-1 min-w-0 font-semibold truncate">
                    {e.full_name}
                    {e.is_me && <span className="ml-1 text-xs text-dong-chu">(em)</span>}
                  </span>
                  <span className="text-right">
                    <span className="block font-display font-extrabold tabular">{fmt(e.week_xp)} XP</span>
                    <span className="block text-xs text-muc-2 tabular">tổng {fmt(e.xp)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )
        ) : (
          <div className="g-card-flat px-4 py-2 divide-y-2 divide-vien">
            <div className="py-2">
              <p className="font-semibold mb-2">Giao diện</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Chế độ màu">
                {(
                  [
                    ['system', 'Theo máy', Monitor],
                    ['light', 'Giấy dó', Sun],
                    ['dark', 'Đêm Bạch Đằng', Moon],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={state.settings.theme === id}
                    onClick={() => setSetting('theme', id)}
                    className={`min-h-[64px] rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-sm font-semibold ${state.settings.theme === id ? 'border-son bg-son-nhat text-son-chu' : 'border-vien bg-the text-muc-2'}`}
                  >
                    <Icon className="w-5 h-5" aria-hidden={true} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Toggle Icon={Timer} label="Đồng hồ đếm giờ khi trả lời" desc="Tắt nếu em cần đọc chậm" checked={state.settings.timer} onChange={(v) => setSetting('timer', v)} />
            <Toggle Icon={state.settings.sound ? Volume2 : VolumeX} label="Âm thanh" desc="Mặc định tắt khi học trên lớp" checked={state.settings.sound} onChange={(v) => setSetting('sound', v)} />
            <Toggle Icon={Sparkles} label="Giảm chuyển động" desc="Tắt rung, hạt và hiệu ứng chuyển động" checked={state.settings.reduceMotion} onChange={(v) => setSetting('reduceMotion', v)} />
            <button type="button" onClick={onTutorial} className="w-full flex items-center gap-3 min-h-[56px] text-left">
              <span className="w-10 h-10 rounded-xl bg-giay-2 text-muc-2 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" aria-hidden={true} />
              </span>
              <span className="font-semibold flex-1">Xem lại hướng dẫn chơi</span>
              <ChevronRight className="w-5 h-5 text-muc-3" aria-hidden={true} />
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <GBtn variant="giay" onClick={onChangePassword}>
            <KeyRound className="w-4 h-4" aria-hidden={true} /> Đổi mật khẩu
          </GBtn>
          <GBtn variant="son" className="ml-auto" onClick={onLogout}>
            <LogOut className="w-4 h-4" aria-hidden={true} /> Đăng xuất
          </GBtn>
        </div>
      </div>
    </Sheet>
  );
};

const TUTORIAL = [
  { title: 'Chào mừng đến Điền Trang Đông A!', text: 'Ta là Rồng Con. Thời bình, quân dân làm ruộng tích lương thảo; có giặc thì ra trận – đó là chính sách “ngụ binh ư nông”.', mood: 'excited' as MascotMood, acc: 'conical' as MascotAccessory },
  { title: 'Kiến thức là vũ khí', text: 'Muốn nâng cấp công trình, chiêu mộ hay tung kế sách, em phải trả lời đúng câu hỏi lịch sử. Ấn Tín chỉ có khi em trả lời đúng.', mood: 'thinking' as MascotMood, acc: 'scholar' as MascotAccessory },
  { title: 'Chiêu mộ tướng ở Doanh Trại', text: 'Ghép một thẻ Nhân lực với một thẻ Sự kiện ở Hội Quán Vạn Kiếp để mời danh tướng nhà Trần gia nhập.', mood: 'happy' as MascotMood, acc: 'helmet' as MascotAccessory },
  { title: 'Ra trận theo đúng kế sách', text: 'Ba màn chiến dịch: 1258, 1285, 1287 – 1288. Rút lui đúng lúc, bỏ trống làng mạc, cắt nguồn lương, chờ thủy triều rút… như ông cha ta!', mood: 'love' as MascotMood, acc: 'crown' as MascotAccessory },
];

const TutorialOverlay: React.FC<{ onDone: () => void }> = ({ onDone }) => {
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

const HudPill: React.FC<{ Icon: IconType; value: string; label: string; tone: string; hint?: string }> = ({ Icon, value, label, tone, hint }) => (
  <span className="g-pill" title={hint ?? label}>
    <span className={`g-pill-ico ${tone}`}>
      <Icon className="w-4 h-4" aria-hidden={true} />
    </span>
    <span className="sr-only">{label}: </span>
    {value}
  </span>
);

// ---------------------------------------------------------------------------
// game/live – thi đấu cả lớp: học sinh vào phòng của thầy cô bằng mã PIN
// ---------------------------------------------------------------------------

const LIVE_ROOM_KEY = 'donga_live_room';

/** Nhớ phòng đang chơi trong phiên trình duyệt để tải lại trang vẫn vào lại được */
const rememberLiveRoom = (pin: string | null) => {
  try {
    if (pin) sessionStorage.setItem(LIVE_ROOM_KEY, pin);
    else sessionStorage.removeItem(LIVE_ROOM_KEY);
  } catch {
    // Trình duyệt chặn lưu trữ: chỉ mất khả năng tự vào lại sau khi tải lại trang
  }
};

const readLiveRoom = (): string | null => {
  try {
    return sessionStorage.getItem(LIVE_ROOM_KEY);
  } catch {
    return null;
  }
};

/** Mã PIN trong đường link thầy cô gửi (…/hoc-sinh?pin=123456) */
const readPinFromUrl = (): string | null => {
  try {
    const pin = (new URLSearchParams(window.location.search).get('pin') ?? '').replace(/\D/g, '');
    return pin.length === 6 ? pin : null;
  } catch {
    return null;
  }
};

const stripPinFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('pin')) return;
    params.delete('pin');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  } catch {
    // file:// có thể chặn replaceState: giữ nguyên địa chỉ
  }
};

const LiveArena: React.FC<{
  token: string;
  initialPin: string | null;
  /** Mở tự động sau khi tải lại trang: server báo không còn trong phòng thì đóng luôn */
  resume: boolean;
  onClose: () => void;
  onSessionExpired: () => void;
}> = ({ token, initialPin, resume, onClose, onSessionExpired }) => {
  const { sound } = useGame();
  const [state, setState] = useState<LivePlayerState | null>(null);
  const [ready, setReady] = useState(false);
  const [final, setFinal] = useState<LivePlayerState | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [pin, setPin] = useState(initialPin ?? '');
  const [joining, setJoining] = useState(false);
  const [seconds, startTimer] = useCountdown();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const autoPin = useRef(initialPin);
  const firstMessage = useRef(true);
  const cue = useRef('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  const { status, send, reconnect } = useLiveSocket(token, (msg, sendNow) => {
    if (msg.type === 'state') {
      const s = msg.state;
      const first = firstMessage.current;
      firstMessage.current = false;
      setReady(true);
      setJoining(false);
      setState(s);
      startTimer(s?.phase === 'question' ? s.remaining_ms : null);
      if (s) {
        setNotice(null);
        setFinal(null);
        rememberLiveRoom(s.pin);
        const key = s.phase === 'reveal' ? `${s.pin}-${s.index}` : s.phase === 'podium' ? `${s.pin}-podium` : '';
        if (key && cue.current !== key) {
          cue.current = key;
          sound(s.phase === 'podium' ? (s.me.rank <= 3 ? 'win' : 'ok') : s.me.last_correct ? 'ok' : 'bad');
        }
        return;
      }
      rememberLiveRoom(null);
      if (autoPin.current) {
        const p = autoPin.current;
        autoPin.current = null;
        setJoining(sendNow({ type: 'join', pin: p }));
      } else if (first && resume) {
        onClose();
      }
    } else if (msg.type === 'error') {
      setJoining(false);
      setNotice({ tone: 'error', text: msg.message });
    } else if (msg.type === 'kicked') {
      rememberLiveRoom(null);
      setState(null);
      startTimer(null);
      setNotice({ tone: 'error', text: 'Thầy cô đã mời em ra khỏi phòng thi đấu.' });
    } else if (msg.type === 'closed') {
      rememberLiveRoom(null);
      setFinal(state);
      setState(null);
      startTimer(null);
      setNotice({ tone: 'info', text: msg.reason === 'expired' ? 'Phòng thi đấu đã hết hạn.' : 'Thầy cô đã đóng phòng thi đấu.' });
    }
  });

  useEffect(() => {
    if (status === 'expired') onSessionExpired();
  }, [status, onSessionExpired]);

  const phaseKey = state ? `${state.phase}-${state.index}` : final ? 'final' : ready ? 'pin' : 'loading';
  useEffect(() => {
    if (phaseKey === 'pin') pinRef.current?.focus();
    else headingRef.current?.focus();
  }, [phaseKey]);

  const close = () => {
    if (state) send({ type: 'leave' });
    rememberLiveRoom(null);
    onClose();
  };
  const requestClose = () => {
    if (state && state.phase !== 'podium') setConfirmLeave(true);
    else close();
  };
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const p = pin.replace(/\D/g, '');
    if (p.length !== 6) {
      setNotice({ tone: 'error', text: 'Mã PIN gồm 6 chữ số trên màn hình của thầy cô.' });
      return;
    }
    setNotice(null);
    if (send({ type: 'join', pin: p })) setJoining(true);
    else setNotice({ tone: 'error', text: 'Chưa kết nối được máy chủ – em thử lại sau giây lát nhé.' });
  };
  const answer = (key: LiveKey) => {
    if (!state?.question || state.me.answered) return;
    if (!send({ type: 'answer', question_id: state.question.id, choice: key })) setNotice({ tone: 'error', text: 'Mất kết nối – đang nối lại, em bấm lại nhé.' });
  };

  const me = state?.me;
  const q = state?.question ?? null;
  const rightOption = q && state?.reveal ? q.options.find((o) => sameLiveKey(o.key, state.reveal?.key)) : undefined;
  const rightIndex = q && rightOption ? q.options.indexOf(rightOption) : -1;
  const announce =
    !state || !me
      ? ''
      : state.phase === 'lobby'
      ? `Đã vào phòng ${state.title}. Chờ thầy cô bắt đầu.`
      : state.phase === 'question'
      ? me.answered
        ? 'Đã chốt đáp án. Chờ cả lớp.'
        : `Câu ${state.index + 1} trên ${state.total}`
      : state.phase === 'reveal'
      ? `${me.last_correct ? `Chính xác, cộng ${me.last_gain} điểm` : me.last_correct === false ? 'Chưa đúng' : 'Hết giờ'}. Em đang xếp hạng ${me.rank}.`
      : state.phase === 'scoreboard'
      ? `Em đang xếp hạng ${me.rank} với ${me.score} điểm.`
      : `Kết thúc trận. Em xếp hạng ${me.rank} với ${me.score} điểm.`;

  const resultCard = (s: LivePlayerState, heading: string) => (
    <div className="g-card p-5 text-center space-y-3">
      <Mascot size={110} mood={s.me.rank <= 3 ? 'love' : 'happy'} accessory={s.me.rank === 1 ? 'crown' : 'helmet'} bob className="mx-auto" />
      <h2 ref={headingRef} tabIndex={-1} className="font-display font-extrabold text-2xl outline-none">
        {heading}
      </h2>
      <p className="font-display font-extrabold text-5xl tabular text-son-chu">Hạng {s.me.rank}</p>
      <p className="font-semibold text-muc-2">
        {s.me.score.toLocaleString('vi-VN')} điểm · đúng {s.me.correct}/{s.me.answered_total} câu đã trả lời
      </p>
      {s.top.length > 0 && (
        <ol className="text-left max-w-xs mx-auto space-y-1.5" aria-label="Ba bạn dẫn đầu">
          {s.top.map((t, i) => (
            <li key={`${t.name}-${i}`} className="flex items-center gap-2 font-semibold">
              <span className="w-7 h-7 rounded-full flex items-center justify-center font-display font-extrabold text-sm shrink-0" style={{ background: ['#d97706', '#c0c0c0', '#cd7f32'][i], color: '#1f1600' }}>
                {i + 1}
              </span>
              <span className="flex-1 truncate">{shortName(t.name)}</span>
              <span className="tabular text-muc-2">{t.score.toLocaleString('vi-VN')}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  let content: React.ReactNode;
  if (status === 'replaced') {
    content = (
      <div className="g-card p-5 text-center space-y-3">
        <h2 ref={headingRef} tabIndex={-1} className="font-display font-extrabold text-xl outline-none">
          Phòng thi đấu đang mở ở nơi khác
        </h2>
        <p className="text-muc-2">Em vừa mở phòng thi đấu ở một tab hoặc thiết bị khác.</p>
        <div className="flex flex-col min-[420px]:flex-row gap-2 justify-center">
          <GBtn onClick={reconnect}>Chơi ở đây</GBtn>
          <GBtn variant="giay" onClick={onClose}>
            Đóng
          </GBtn>
        </div>
      </div>
    );
  } else if (!ready) {
    content = (
      <div className="py-16 flex justify-center">
        <Spinner label={status === 'reconnecting' ? 'Chưa kết nối được máy chủ – đang thử lại…' : 'Đang kết nối phòng thi đấu…'} />
      </div>
    );
  } else if (!state) {
    content = (
      <div className="space-y-4">
        {notice && (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 font-semibold flex items-start gap-2 ${notice.tone === 'error' ? 'bg-son-nhat text-son-chu' : 'bg-ngoc-nhat text-ngoc-chu'}`}>
            {notice.tone === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden={true} /> : <Info className="w-5 h-5 shrink-0 mt-0.5" aria-hidden={true} />}
            {notice.text}
          </p>
        )}
        {final ? (
          <>
            {resultCard(final, 'Kết quả của em')}
            <div className="flex flex-col min-[420px]:flex-row gap-2">
              <GBtn variant="giay" className="flex-1" onClick={() => setFinal(null)}>
                Vào phòng khác
              </GBtn>
              <GBtn className="flex-1" onClick={close}>
                Về Quốc Tử Giám
              </GBtn>
            </div>
          </>
        ) : (
          <form className="g-card p-5 space-y-4" onSubmit={join} noValidate>
            <div className="flex items-center gap-3">
              <Mascot size={76} mood="excited" accessory="helmet" bob />
              <div>
                <h2 ref={headingRef} tabIndex={-1} className="font-display font-extrabold text-2xl leading-tight outline-none">
                  Vào phòng thi đấu
                </h2>
                <p className="text-sm text-muc-2">Nhập mã PIN 6 chữ số trên màn hình của thầy cô.</p>
              </div>
            </div>
            <div>
              <label htmlFor="live-pin" className="block font-display font-bold mb-1.5">
                Mã PIN
              </label>
              <input
                ref={pinRef}
                id="live-pin"
                inputMode="numeric"
                autoComplete="off"
                maxLength={7}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^\d ]/g, ''))}
                aria-describedby="live-pin-help"
                className="w-full min-h-[60px] rounded-2xl border-2 border-vien bg-the px-4 text-center font-display font-extrabold text-3xl tracking-[0.3em] tabular text-muc focus:outline-none focus:border-ngoc"
              />
              <p id="live-pin-help" className="text-xs text-muc-2 mt-1.5">
                Câu trả lời được máy chủ chấm và cộng XP, Ấn Tín như khi luyện tập.
              </p>
            </div>
            <GBtn type="submit" size="lg" className="w-full" disabled={joining || status !== 'open'}>
              {joining ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> : <Radio className="w-5 h-5" aria-hidden={true} />}
              Vào phòng
            </GBtn>
          </form>
        )}
      </div>
    );
  } else if (state.phase === 'lobby' && me) {
    content = (
      <div className="g-card p-6 text-center space-y-3">
        <Mascot size={120} mood="excited" accessory="helmet" bob className="mx-auto" />
        <h2 ref={headingRef} tabIndex={-1} className="font-display font-extrabold text-2xl outline-none">
          Em đã vào phòng!
        </h2>
        <p className="text-muc-2">
          <b className="text-muc">{me.name}</b> – chờ thầy cô bắt đầu trận nhé.
        </p>
        <p className="inline-flex items-center gap-2 g-chip bg-ngoc-nhat text-ngoc-chu">
          <Users className="w-4 h-4" aria-hidden={true} /> {state.players} bạn trong phòng
        </p>
        <p className="text-sm text-muc-2">
          Mỗi câu {Math.round(state.duration_ms / 1000)} giây · {state.total} câu · trả lời đúng và nhanh để được nhiều điểm
        </p>
      </div>
    );
  } else if ((state.phase === 'question' || state.phase === 'reveal') && q && me) {
    const revealed = state.phase === 'reveal';
    content = (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {!revealed && <LiveTimer seconds={seconds} total={state.duration_ms / 1000} size={64} />}
          <p className="text-sm font-semibold text-muc-2 min-w-0">
            Câu {state.index + 1}/{state.total}
            <span className="block truncate">{q.topic}</span>
          </p>
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="g-card p-4 font-display font-extrabold text-xl leading-snug outline-none">
          {q.prompt}
        </h2>
        {revealed ? (
          <div className="space-y-3">
            <div className={`rounded-2xl p-4 flex items-center gap-3 ${me.last_correct ? 'bg-ngoc text-white' : me.last_correct === false ? 'bg-son text-white' : 'bg-giay-2 text-muc'}`}>
              <span className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {me.last_correct ? <Check className="w-7 h-7 stroke-[3]" aria-hidden={true} /> : me.last_correct === false ? <X className="w-7 h-7 stroke-[3]" aria-hidden={true} /> : <Clock className="w-7 h-7" aria-hidden={true} />}
              </span>
              <div className="min-w-0">
                <p className="font-display font-extrabold text-2xl leading-tight">{me.last_correct ? 'Chính xác!' : me.last_correct === false ? 'Chưa đúng' : 'Hết giờ'}</p>
                <p className="font-semibold">
                  {me.last_correct ? `+${me.last_gain} điểm` : 'Không có điểm câu này'}
                  {me.streak >= 2 && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <Flame className="w-4 h-4" aria-hidden={true} /> {me.streak} câu đúng liên tiếp
                    </span>
                  )}
                </p>
              </div>
              <p className="ml-auto text-right font-display font-extrabold shrink-0">
                Hạng {me.rank}
                <span className="block text-sm font-semibold opacity-90 tabular">{me.score.toLocaleString('vi-VN')} điểm</span>
              </p>
            </div>
            {rightOption && (
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-3 font-display font-extrabold text-lg"
                style={{ background: ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].bg, color: ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].fg }}
              >
                <KahootShape shape={ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].shape} size={26} color={ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].fg} />
                <span className="flex-1">
                  <span className="block text-xs font-bold opacity-90">Đáp án đúng</span>
                  {rightOption.text}
                </span>
              </div>
            )}
            {state.reveal && (
              <p className="g-card p-4 text-sm leading-relaxed flex gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-ngoc-chu" aria-hidden={true} />
                <span>{state.reveal.explanation}</span>
              </p>
            )}
            <p className="text-center text-sm text-muc-2">Chờ thầy cô chuyển sang bảng điểm…</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-muc-2" aria-live="polite">
              {me.answered ? 'Đã chốt đáp án! Chờ cả lớp trả lời…' : 'Chọn một đáp án:'}
            </p>
            <div className={`grid gap-3 ${q.options.length > 2 ? 'grid-cols-1 min-[420px]:grid-cols-2' : 'grid-cols-2'}`}>
              {q.options.map((o, i) => {
                const s = ANSWER_STYLES[i % ANSWER_STYLES.length];
                const chosen = sameLiveKey(me.choice, o.key);
                return (
                  <button
                    key={String(o.key)}
                    type="button"
                    disabled={me.answered || seconds === 0}
                    aria-pressed={chosen}
                    onClick={() => answer(o.key)}
                    className={`min-h-[88px] rounded-2xl px-4 py-3 flex items-center gap-3 text-left font-display font-extrabold text-lg leading-snug transition active:translate-y-0.5 disabled:cursor-default ${
                      me.answered && !chosen ? 'opacity-35' : ''
                    } ${chosen ? 'outline outline-4 outline-offset-2 outline-muc' : ''}`}
                    style={{ background: s.bg, color: s.fg, boxShadow: `0 5px 0 ${s.shadow}` }}
                  >
                    <KahootShape shape={s.shape} size={30} color={s.fg} />
                    <span className="flex-1">{o.text}</span>
                    {chosen && <Check className="w-6 h-6 stroke-[3] shrink-0" aria-hidden={true} />}
                  </button>
                );
              })}
            </div>
            {notice?.tone === 'error' && (
              <p role="alert" className="rounded-2xl px-4 py-3 bg-son-nhat text-son-chu font-semibold text-sm">
                {notice.text}
              </p>
            )}
          </>
        )}
      </div>
    );
  } else if (state.phase === 'scoreboard' && me) {
    content = (
      <div className="space-y-3">
        {resultCard(state, 'Bảng điểm')}
        <p className="text-center text-sm text-muc-2">Chờ câu tiếp theo…</p>
      </div>
    );
  } else if (me) {
    content = (
      <div className="space-y-3">
        {resultCard(state, 'Kết thúc trận!')}
        <GBtn size="lg" className="w-full" onClick={close}>
          Về Quốc Tử Giám
        </GBtn>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] paper-bg text-muc flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-arena-title"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !confirmLeave) requestClose();
      }}
    >
      <header className="shrink-0 border-b-2 border-vien bg-the">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-2">
          <span className="w-10 h-10 rounded-2xl bg-son text-white flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" aria-hidden={true} />
          </span>
          <div className="min-w-0 flex-1">
            <p id="live-arena-title" className="font-display font-extrabold leading-tight truncate">
              {state?.title ?? final?.title ?? 'Thi đấu cả lớp'}
            </p>
            <p className="text-xs font-semibold text-muc-2 truncate">{state ? `Phòng ${formatPin(state.pin)} · ${state.players} bạn` : 'Cùng cả lớp trả lời câu hỏi của thầy cô'}</p>
          </div>
          {me && (
            <span className="g-pill tabular shrink-0" aria-label={`Điểm của em: ${me.score}`}>
              <Trophy className="w-4 h-4" aria-hidden={true} /> {me.score.toLocaleString('vi-VN')}
            </span>
          )}
          <GBtn variant="ghost" iconOnly onClick={requestClose} aria-label={state && state.phase !== 'podium' ? 'Rời phòng thi đấu' : 'Đóng thi đấu cả lớp'}>
            <X className="w-5 h-5" aria-hidden={true} />
          </GBtn>
        </div>
        {(status === 'reconnecting' || (state && !state.host_online)) && (
          <p role="status" className="bg-dong-nhat text-dong-chu text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" aria-hidden={true} />
            {status === 'reconnecting' ? 'Mất kết nối – đang nối lại…' : 'Thầy cô đang mất kết nối – chờ một chút…'}
          </p>
        )}
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5">{content}</div>
      </main>
      <p className="sr-only" role="status" aria-atomic="true">
        {announce}
      </p>

      {confirmLeave && (
        <div className="absolute inset-0 z-10 bg-black/45 flex items-end sm:items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="live-leave-title" className="g-card w-full max-w-sm p-5 space-y-3">
            <h3 id="live-leave-title" className="font-display font-extrabold text-xl">
              Rời phòng thi đấu?
            </h3>
            <p className="text-sm text-muc-2">Các câu em đã trả lời vẫn được tính. Muốn chơi tiếp thì nhập lại mã PIN.</p>
            <div className="flex gap-2">
              <GBtn variant="son" className="flex-1" onClick={close}>
                Rời phòng
              </GBtn>
              <GBtn variant="giay" className="flex-1" onClick={() => setConfirmLeave(false)} autoFocus>
                Ở lại
              </GBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StudentViewProps {
  token: string;
  user: AuthUser;
  onShowToast: (msg: string) => void;
  onSessionExpired: () => void;
  onLogout: () => void;
  onChangePassword: () => void;
}

const StudentView: React.FC<StudentViewProps> = (props) => {
  const { token, onSessionExpired } = props;
  const [data, setData] = useState<{ progress: LearnerProgress; state: GameState; codex: CodexEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      apiRequest<LearnerProgress>('/api/student/progress', { token }),
      apiRequest<{ state: unknown }>('/api/student/game', { token }),
      apiRequest<CodexEntry[]>('/api/student/codex', { token }).catch(() => [] as CodexEntry[]),
    ])
      .then(([progress, game, codex]) => setData({ progress, state: restoreGameState(game.state), codex }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        else setError(err instanceof Error ? err.message : 'Không tải được dữ liệu game');
      });
  }, [token, onSessionExpired]);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <div className="paper-bg min-h-[100dvh] flex flex-col items-center justify-center text-center p-6 gap-3">
        <Mascot size={120} mood="sad" />
        <p className="font-display font-bold text-xl">{error}</p>
        <GBtn variant="ngoc" onClick={load}>
          <RefreshCw className="w-4 h-4" aria-hidden={true} /> Thử lại
        </GBtn>
      </div>
    );
  if (!data)
    return (
      <div className="paper-bg min-h-[100dvh] flex flex-col items-center justify-center gap-3">
        <Mascot size={130} mood="happy" accessory="conical" bob />
        <Spinner label="Đang mở Điền Trang Đông A…" />
      </div>
    );
  return <GameApp {...props} initial={data} />;
};

const GameApp: React.FC<StudentViewProps & { initial: { progress: LearnerProgress; state: GameState; codex: CodexEntry[] } }> = ({ token, user, onShowToast, onSessionExpired, onLogout, onChangePassword, initial }) => {
  const [state, setState] = useState<GameState>(initial.state);
  const [progress, setProgress] = useState<LearnerProgress>(initial.progress);
  const [tab, setTabRaw] = useState<GameTab>(readGameTab);
  const [sub, setSub] = useState<Record<string, string>>({ barracks: 'heroes', codex: 'timeline' });
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [profile, setProfile] = useState(false);
  const [tutorial, setTutorial] = useState(!initial.state.tutorial);
  // Thi đấu cả lớp: mở từ đường link có ?pin=, hoặc vào lại phòng đang chơi sau khi tải lại trang
  const [live, setLive] = useState<{ pin: string | null; resume: boolean } | null>(() => {
    const pin = readPinFromUrl();
    if (pin) return { pin, resume: false };
    return readLiveRoom() ? { pin: null, resume: true } : null;
  });
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const mainRef = useRef<HTMLElement>(null);
  const firstSave = useRef(true);
  const saveTimer = useRef(0);
  const latest = useRef(state);
  const saveFailed = useRef(false);
  const dirty = useRef(false);

  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', dark ? '#0b1220' : '#fbf6ea');
    document.body.style.background = dark ? '#0b1220' : '';
    return () => {
      document.body.style.background = '';
      meta?.setAttribute('content', '#fbf6ea');
    };
  }, [dark]);

  const setTab = useCallback((t: GameTab, s?: string) => {
    setTabRaw(t);
    if (s) setSub((cur) => ({ ...cur, [t]: s }));
    try {
      sessionStorage.setItem('donga_game_tab', t);
    } catch {
      // bỏ qua
    }
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  const update = useCallback((fn: (s: GameState) => GameState) => setState((s) => fn(s)), []);

  // Sang ngày mới: làm mới nhiệm vụ ngày; hoàn tất công trình đã thi công xong
  useEffect(() => {
    const tick = () =>
      setState((s) => {
        let next = finalizeUpgrades(s, Date.now());
        if (next.daily.day !== todayKey()) next = { ...next, daily: { day: todayKey(), progress: {}, claimed: [] } };
        return next;
      });
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  const putState = useCallback(
    (s: GameState, keepalive = false) =>
      fetch(`${API_BASE_URL}/api/student/game`, {
        method: 'PUT',
        keepalive,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ state: s }),
      }),
    [token]
  );

  // Tự lưu trạng thái game lên server (gom thay đổi trong 1,2 giây)
  useEffect(() => {
    latest.current = state;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    dirty.current = true;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      putState(latest.current)
        .then((res) => {
          if (res.status === 401) onSessionExpired();
          else if (!res.ok) throw new Error(String(res.status));
          dirty.current = false;
          saveFailed.current = false;
        })
        .catch(() => {
          if (!saveFailed.current) onShowToast('Chưa lưu được tiến độ game – sẽ tự thử lại khi có thay đổi');
          saveFailed.current = true;
        });
    }, 1200);
  }, [state, putState, onSessionExpired, onShowToast]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') putState(latest.current, true).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      // Rời game (đăng xuất, đổi mật khẩu): lưu nốt thay đổi chưa kịp gửi
      if (dirty.current) {
        window.clearTimeout(saveTimer.current);
        putState(latest.current, true).catch(() => undefined);
      }
    };
  }, [putState]);

  const request = useCallback(
    async <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => {
      try {
        return await apiRequest<T>(path, { ...opts, token });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        throw err;
      }
    },
    [token, onSessionExpired]
  );

  const seenRef = useRef(state.seen);
  useEffect(() => {
    seenRef.current = state.seen;
  }, [state.seen]);

  const fetchQuestions = useCallback(
    async (req: QuestionRequest): Promise<QuestionsResponse> => {
      if (req.ai) return request<QuestionsResponse>('/api/student/questions/ai', { body: { unit_id: req.units?.[0] ?? null, count: req.count } });
      const params = new URLSearchParams({ count: String(req.count), mode: req.mode ?? 'mixed' });
      if (req.units?.length) params.set('units', req.units.join(','));
      if (req.types?.length) params.set('types', req.types.join(','));
      if (req.levels?.length) params.set('levels', req.levels.join(','));
      if (seenRef.current.length) params.set('exclude', seenRef.current.slice(-40).join(','));
      return request<QuestionsResponse>(`/api/student/questions?${params.toString()}`);
    },
    [request]
  );

  const submitAnswer = useCallback(
    async (q: ServedQuestion, payload: AnswerPayload) => {
      try {
        const r = await request<AnswerResult>('/api/student/answer', { body: { question_id: q.id, ...payload } });
        setProgress(r.progress);
        setState((s) => {
          const food = r.correct ? qtgFood(s.buildings.qtg.level) : 0;
          return {
            ...s,
            luong: Math.min(storeCap(s.buildings.kho.level), s.luong + food),
            seen: [...s.seen.filter((x) => x !== q.id), q.id].slice(-60),
            codex: r.correct && !s.codex.includes(q.unit_id) ? [...s.codex, q.unit_id] : s.codex,
            daily: r.correct ? { ...s.daily, progress: { ...s.daily.progress, correct: (s.daily.progress.correct ?? 0) + 1 } } : s.daily,
          };
        });
        return r;
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) onShowToast(err instanceof Error ? err.message : 'Không gửi được câu trả lời');
        return null;
      }
    },
    [request, onShowToast]
  );

  const finishSession = useCallback(
    (kind: 'practice' | 'battle' | 'recruit' | 'tower' | 'raid', correct: number, total: number) => {
      if (total > 0)
        request<{ progress: LearnerProgress }>('/api/student/quiz-complete', { body: { correct: Math.min(correct, total), total } })
          .then((r) => setProgress(r.progress))
          .catch(() => undefined);
      setState((s) => ({
        ...s,
        raid: kind === 'raid' ? s.raid : { ...s.raid, sessions: s.raid.sessions + 1 },
        stats: { ...s.stats, sessions: s.stats.sessions + 1 },
        daily: kind === 'practice' || kind === 'tower' ? { ...s.daily, progress: { ...s.daily.progress, session: (s.daily.progress.session ?? 0) + 1 } } : s.daily,
      }));
    },
    [request]
  );

  const spendGems = useCallback(
    async (amount: number, reason: string) => {
      if (amount <= 0) return true;
      if (progress.gems < amount) {
        onShowToast('Chưa đủ Ấn Tín – trả lời đúng ở Quốc Tử Giám để nhận thêm');
        return false;
      }
      try {
        const p = await request<LearnerProgress>('/api/student/gems', { body: { delta: -amount, reason: reason.slice(0, 80) } });
        setProgress(p);
        return true;
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) onShowToast(err instanceof Error ? err.message : 'Không tiêu được Ấn Tín');
        return false;
      }
    },
    [progress.gems, request, onShowToast]
  );

  const reward = useCallback(
    (luong: number, quan: number) =>
      setState((s) => ({
        ...s,
        luong: Math.min(storeCap(s.buildings.kho.level), s.luong + Math.max(0, luong)),
        quan: Math.min(troopCap(s.buildings.trai.level), s.quan + Math.max(0, quan)),
      })),
    []
  );

  const bumpDaily = useCallback(
    (metric: DailyTaskDef['metric'], n = 1) => setState((s) => ({ ...s, daily: { ...s.daily, progress: { ...s.daily.progress, [metric]: (s.daily.progress[metric] ?? 0) + n } } })),
    []
  );

  const askAdvisor = useCallback(
    (question: string) => {
      setPendingAsk(question);
      setTab('codex', 'advisor');
    },
    [setTab]
  );

  useEffect(() => {
    stripPinFromUrl();
  }, []);
  const openLive = useCallback((pin?: string) => setLive({ pin: pin ?? null, resume: false }), []);
  const closeLive = useCallback(() => {
    setLive(null);
    // Câu trả lời trong trận đã được server cộng XP, Ấn Tín: tải lại tiến độ
    request<LearnerProgress>('/api/student/progress')
      .then(setProgress)
      .catch(() => undefined);
  }, [request]);

  const soundOn = state.settings.sound;
  const sound = useCallback(
    (kind: 'ok' | 'bad' | 'win') => {
      if (soundOn) playTone(kind);
    },
    [soundOn]
  );

  const ctx: GameCtx = {
    user,
    progress,
    state,
    codex: initial.codex,
    dark,
    update,
    request,
    toast: onShowToast,
    fetchQuestions,
    submitAnswer,
    finishSession,
    spendGems,
    reward,
    bumpDaily,
    askAdvisor,
    openLive,
    sound,
  };

  const lvl = levelOf(progress.xp);
  const lvlFrom = levelXp(lvl);
  const lvlTo = levelXp(lvl + 1);

  return (
    <GameContext.Provider value={ctx}>
      <div className={`paper-bg h-[100dvh] flex flex-col text-muc ${dark ? 'theme-dark' : ''} ${state.settings.reduceMotion ? 'reduce-motion' : ''}`}>
        <header className="shrink-0 border-b-2 border-vien bg-the/95 backdrop-blur z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setProfile(true)} className="flex items-center gap-2 min-h-[44px] rounded-2xl pr-2 hover:bg-giay-2" aria-label={`Hồ sơ của ${user.full_name}, cấp ${lvl}`}>
              <span className="w-10 h-10 rounded-full text-white font-display font-extrabold flex items-center justify-center shrink-0" style={{ background: avatarColor(user.username) }}>
                {initialsOf(user.full_name)}
              </span>
              <span className="hidden sm:block text-left leading-tight">
                <span className="block font-display font-bold max-w-[160px] truncate">{shortName(user.full_name)}</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muc-2">
                  Cấp {lvl}
                  <span className="w-16">
                    <Bar value={progress.xp - lvlFrom} max={lvlTo - lvlFrom} fill="bg-dong" className="!h-1.5" label="XP tới cấp tiếp theo" />
                  </span>
                </span>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
              <HudPill Icon={Wheat} value={fmt(state.luong)} label="Lương Thảo" tone="bg-dong" />
              <HudPill Icon={Shield} value={fmt(state.quan)} label="Quân Lực" tone="bg-son" />
              <HudPill Icon={Stamp} value={fmt(progress.gems)} label="Ấn Tín" tone="bg-ngoc" hint="Ấn Tín – chỉ nhận khi trả lời đúng" />
              <span className="hidden min-[420px]:inline-flex">
                <HudPill Icon={Flame} value={`${progress.streak}`} label="Chuỗi ngày học" tone="bg-hoa" />
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex">
          <nav className="hidden lg:flex flex-col gap-1 w-56 shrink-0 border-r-2 border-vien bg-the/70 p-3" aria-label="Điều hướng game">
            <BrandLogo subtitle="Hào Khí Đông A" className="px-2 py-2 mb-2" />
            {GAME_TABS.map((t) => (
              <button key={t.id} type="button" className="g-rail-item" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                <t.Icon className="w-5 h-5" aria-hidden={true} /> {t.label}
              </button>
            ))}
            <div className="mt-auto g-inset p-3 text-xs text-muc-2 leading-relaxed">Lịch sử 7 · Ba lần kháng chiến chống quân xâm lược Mông – Nguyên</div>
          </nav>
          <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto pb-24 lg:pb-8" id="game-main">
            {tab === 'farm' && <FarmTab onGoto={setTab} />}
            {tab === 'barracks' && <BarracksTab sub={sub.barracks} onSub={(s) => setSub((c) => ({ ...c, barracks: s }))} />}
            {tab === 'campaign' && <CampaignTab onGoto={setTab} />}
            {tab === 'exam' && <ExamTab />}
            {tab === 'codex' && <CodexTab sub={sub.codex} onSub={(s) => setSub((c) => ({ ...c, codex: s }))} pendingQuestion={pendingAsk} onConsumed={() => setPendingAsk(null)} />}
          </main>
        </div>

        <nav className="g-nav lg:hidden fixed bottom-0 inset-x-0 z-40" aria-label="Điều hướng game">
          <div className="grid grid-cols-5 gap-1 px-1.5 pt-1.5 pb-1 max-w-xl mx-auto">
            {GAME_TABS.map((t) => (
              <button key={t.id} type="button" className="g-nav-item" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                <span className="g-nav-ico">
                  <t.Icon className="w-5 h-5" aria-hidden={true} />
                </span>
                <span className="text-center">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <ProfileSheet
          open={profile}
          onClose={() => setProfile(false)}
          onLogout={onLogout}
          onChangePassword={onChangePassword}
          onTutorial={() => {
            setProfile(false);
            setTutorial(true);
          }}
        />
        {tutorial && !live && (
          <TutorialOverlay
            onDone={() => {
              setTutorial(false);
              update((s) => ({ ...s, tutorial: true }));
            }}
          />
        )}
        {live && <LiveArena token={token} initialPin={live.pin} resume={live.resume} onClose={closeLive} onSessionExpired={onSessionExpired} />}
      </div>
    </GameContext.Provider>
  );
};
// @@GAME-END@@

// ============================================================================
// components/AiQuizModal
// ============================================================================

interface AiQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveQuestions: (count: number) => void;
}

interface QuestionItem {
  id: string | number;
  q: string;
  options: string[];
  correct: number;
  citation: string;
  cognitiveLevel?: string;
  explanation?: string;
}

const AiQuizModal = ({
  isOpen,
  onClose,
  onSaveQuestions,
}: AiQuizModalProps) => {
  const [topic, setTopic] = useState('Chương 2: 1285 - Hội nghị Bình Than vs Diên Hồng');
  const [count, setCount] = useState(3);
  const [cognitiveLevel, setCognitiveLevel] = useState('Thông hiểu');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionItem[]>([
    {
      id: 'init-1',
      q: 'Hội nghị Bình Than (1282) do ai chủ trì và đối tượng tham gia là ai?',
      options: [
        'A. Vua Trần Nhân Tông - Vương hầu, quý tộc, tướng lĩnh',
        'B. Thượng hoàng Trần Thánh Tông - Bô lão cả nước',
        'C. Trần Quốc Toản - Đội quân gia nô 1.000 người',
        'D. Trần Thủ Độ - Quan lại triều Lý cũ'
      ],
      correct: 0,
      cognitiveLevel: 'Nhận biết',
      citation: 'SGK Lịch sử 7 (KNTT), tr. 68',
      explanation: 'Tháng 10 năm 1282, vua Trần Nhân Tông mở hội nghị Bình Than (Hải Dương) triệu tập các vương hầu và quan lại cao cấp để bàn kế sách đánh giặc.'
    },
    {
      id: 'init-2',
      q: 'Tại Hội nghị Diên Hồng (đầu 1285), khi Thượng hoàng hỏi "Nên đánh hay nên hòa?", các bô lão đã đồng thanh hô vang điều gì?',
      options: [
        'A. Hòa!',
        'B. Đánh!',
        'C. Rút lui về Vạn Kiếp!',
        'D. Cầu viện phương Bắc!'
      ],
      correct: 1,
      cognitiveLevel: 'Thông hiểu',
      citation: 'SGK Lịch sử 7 (KNTT), tr. 69',
      explanation: 'Hội nghị Diên Hồng triệu tập các bô lão đại diện cho toàn dân. Tiếng hô ĐÁNH đồng thanh thể hiện khối đại đoàn kết dân tộc triều Trần.'
    },
    {
      id: 'init-3',
      q: 'Hành động bóp nát quả cam vua ban của Hoài Văn hầu Trần Quốc Toản thể hiện điều gì?',
      options: [
        'A. Nỗi giận dữ vì quả cam bị hỏng',
        'B. Uất ức vì chưa đủ tuổi dự bàn việc quân, nung nấu ý chí giết giặc',
        'C. Muốn thách đấu với các tướng già',
        'D. Không đồng ý với kế sách rút lui'
      ],
      correct: 1,
      cognitiveLevel: 'Vận dụng',
      citation: 'Đại Việt Sử Ký Toàn Thư (tr. 560)',
      explanation: 'Trần Quốc Toản vì chưa đủ tuổi dự hội nghị Bình Than nên vừa hờn vừa tủi, vô tình bóp nát quả cam, rồi về chiêu mộ gia nô thêu cờ 6 chữ vàng.'
    }
  ]);

  if (!isOpen) return null;

  const quickTopics = [
    'Hội nghị Diên Hồng & Tiếng hô ĐÁNH (1285)',
    'Kháng chiến lần 1 (1258): Vườn không nhà trống & Đông Bộ Đầu',
    'Trận phục kích thuyền lương Vân Đồn (1288)',
    'Đại thắng Bạch Đằng Giang & Bãi cọc lim (1288)'
  ];

  const handleGenerate = async (targetTopic = topic, targetCount = count, targetLevel = cognitiveLevel) => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: targetTopic,
          num_questions: targetCount,
          cognitive_level: targetLevel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Máy chủ AI phản hồi lỗi: ${response.status}`);
      }

      const data = await response.json();
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        const mapped: QuestionItem[] = data.questions.map((q: any, idx: number) => ({
          id: q.id || `gen-${idx + 1}`,
          q: q.question,
          options: q.options,
          correct: q.correct_index,
          cognitiveLevel: q.cognitive_level || targetLevel,
          citation: q.curriculum_reference || 'SGK Lịch sử 7 & Đại Việt Sử Ký Toàn Thư',
          explanation: q.explanation || 'Căn cứ theo tư liệu lịch sử chính thống triều Trần.'
        }));
        setGeneratedQuestions(mapped);
      } else {
        throw new Error('Dữ liệu câu hỏi trả về rỗng');
      }
    } catch (err) {
      console.warn('Lỗi gọi API AI Quiz, chuyển sang bộ câu hỏi dự phòng cục bộ:', err);
      // Fallback xáo trộn hoặc giữ danh sách chuẩn
      setErrorMessage('Không thể kết nối Backend AI, đang hiển thị câu hỏi mẫu từ Dữ liệu vàng.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 animate-in" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] zoom-in-95" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-duo-purple text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/25 flex items-center justify-center shrink-0">
              <Mascot size={52} accessory="scholar" mood="excited" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg">Trợ lý AI soạn câu hỏi</h3>
                <span className="chip bg-white text-duo-purple-dark">
                  RAG Grounded
                </span>
              </div>
              <p className="text-xs font-bold text-white/85">
                Đối chiếu 105 bản ghi Sử liệu vàng SGK Lịch sử 7 & Đại Việt Sử Ký Toàn Thư
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/15 text-white/80 hover:text-white transition"
          >
            <X className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="p-5 border-b-2 border-duo-swan space-y-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex-1 min-w-[260px]">
              <label className="text-xs font-black text-duo-wolf block mb-1.5">
                Chủ đề sự kiện lịch sử:
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Nhập sự kiện hoặc nhân vật lịch sử..."
                className="input-duo"
              />
            </div>

            <div className="flex items-center gap-2">
              <div>
                <label className="text-xs font-black text-duo-wolf block mb-1.5">Mức độ:</label>
                <select
                  value={cognitiveLevel}
                  onChange={(e) => setCognitiveLevel(e.target.value)}
                  className="input-duo !w-auto !py-2.5"
                >
                  <option value="Nhận biết">Nhận biết</option>
                  <option value="Thông hiểu">Thông hiểu</option>
                  <option value="Vận dụng">Vận dụng</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-duo-wolf block mb-1.5">Số câu:</label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="input-duo !w-auto !py-2.5"
                >
                  <option value={3}>3 câu</option>
                  <option value={4}>4 câu</option>
                  <option value={5}>5 câu</option>
                </select>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => handleGenerate()}
                  disabled={isGenerating}
                  className="btn-3d btn-purple"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Đang tạo...' : 'Tạo AI'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick topic pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pt-1">
            <span className="text-duo-hare font-semibold shrink-0 text-[10px]">Gợi ý:</span>
            {quickTopics.map((t, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTopic(t);
                  handleGenerate(t, count, cognitiveLevel);
                }}
                className="px-3 py-1.5 bg-white hover:bg-duo-purple-light hover:text-duo-purple-dark hover:border-duo-purple border-2 border-duo-swan rounded-xl whitespace-nowrap text-duo-wolf font-bold transition shrink-0"
              >
                {t}
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-duo-gold-dark bg-duo-gold-light px-3 py-2 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Questions Preview List */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-black text-duo-hare uppercase tracking-widest text-[11px]">
              Danh sách {generatedQuestions.length} câu hỏi AI tạo lập (Khảo thí Lịch sử 7):
            </p>
            {isGenerating && (
              <span className="text-duo-purple-dark font-black text-xs flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Đang đối chiếu sử liệu...
              </span>
            )}
          </div>

          {generatedQuestions.map((item, idx) => (
            <div key={item.id} className="card-duo p-4 space-y-3 transition hover:border-duo-purple">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-black text-sm text-duo-ink leading-snug">
                  Câu {idx + 1}: {item.q}
                </h4>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.cognitiveLevel && (
                    <span className="chip bg-duo-purple-light text-duo-purple-dark">
                      <Award className="w-3 h-3" />
                      {item.cognitiveLevel}
                    </span>
                  )}
                  <span className="chip bg-duo-green-light text-duo-green-dark">
                    <BookOpen className="w-3 h-3" />
                    {item.citation}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {item.options.map((opt, oIdx) => (
                  <div
                    key={oIdx}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 ${
                      oIdx === item.correct ? 'ring-4 ring-duo-green ring-offset-1' : 'opacity-70'
                    }`}
                    style={{ background: ANSWER_STYLES[oIdx % 4].bg, color: ANSWER_STYLES[oIdx % 4].fg }}
                  >
                    <KahootShape shape={ANSWER_STYLES[oIdx % 4].shape} size={14} color={ANSWER_STYLES[oIdx % 4].fg} />
                    <span className="flex-1">{stripOptionPrefix(opt)}</span>
                    {oIdx === item.correct && <Check className="w-4 h-4 stroke-[4]" />}
                  </div>
                ))}
              </div>

              {item.explanation && (
                <div className="text-xs font-semibold bg-duo-polar rounded-xl p-3 text-duo-wolf leading-relaxed">
                  <strong className="text-duo-ink">Căn cứ sử liệu:</strong> {item.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-white border-t-2 border-duo-swan flex items-center justify-between gap-2">
          <span className="text-xs text-duo-wolf font-bold hidden sm:inline">
            Tổng cộng: <strong>{generatedQuestions.length} câu hỏi</strong> chuẩn kiến thức kỹ năng
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn-3d btn-ghost"
            >
              Đóng
            </button>
            <button
              onClick={() => onSaveQuestions(generatedQuestions.length)}
              className="btn-3d btn-green"
            >
              <Check className="w-4 h-4" />
              <span>Thêm {generatedQuestions.length} câu vào bài</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// components/CreateDropdown
// ============================================================================

interface CreateDropdownProps {
  onCreateQuiz: () => void;
  onCreateStory: () => void;
  onCreateCourse: () => void;
  className?: string;
}

const CreateDropdown: React.FC<CreateDropdownProps> = ({
  onCreateQuiz,
  onCreateStory,
  onCreateCourse,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Nút Tạo (Phong cách chuẩn Kahoot ảnh 4) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-3d btn-green"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span className="hidden sm:inline">Tạo mới</span>
      </button>

      {/* Menu thả xuống (Khớp chuẩn chi tiết theo ảnh 4) */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-88 bg-white rounded-3xl shadow-[0_6px_0_#e7d9bc] border-2 border-duo-swan p-2 z-50 animate-pop-in">
          {/* Mục 1: Quiz (Trắc nghiệm tương tác) */}
          <button
            onClick={() => {
              setIsOpen(false);
              onCreateQuiz();
            }}
            className="w-full px-3 py-3 rounded-2xl flex items-start gap-3.5 hover:bg-duo-polar transition text-left group"
          >
            {/* Biểu tượng Kahoot / Quiz */}
            <div className="w-12 h-12 rounded-xl bg-duo-polar border-2 border-dashed border-duo-swan flex items-center justify-center shrink-0 group-hover:border-purple-300 group-hover:bg-purple-50/50 transition">
              <div className="w-6 h-6 rounded-md bg-[#115e59] flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-white transform rotate-45"></div>
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-extrabold text-sm text-duo-ink group-hover:text-[#115e59] transition">
                Quiz
              </h4>
              <p className="text-xs text-duo-wolf leading-snug mt-0.5">
                Bài học tương tác ngắn với các câu hỏi bình chọn và trắc nghiệm
              </p>
            </div>
          </button>

          {/* Mục 2: Câu chuyện (Story) */}
          <button
            onClick={() => {
              setIsOpen(false);
              onCreateStory();
            }}
            className="w-full px-3 py-3 rounded-2xl flex items-start gap-3.5 hover:bg-duo-polar transition text-left group"
          >
            {/* Biểu tượng Câu chuyện */}
            <div className="w-12 h-12 rounded-xl bg-duo-polar border-2 border-dashed border-duo-swan flex items-center justify-center shrink-0 group-hover:border-purple-300 group-hover:bg-purple-50/50 transition">
              <div className="w-6 h-7 rounded-sm bg-white border-2 border-duo-swan flex flex-col overflow-hidden">
                <div className="h-2.5 bg-[#115e59] w-full"></div>
                <div className="flex-1 p-1 flex flex-col justify-center gap-0.5">
                  <div className="h-0.5 bg-slate-300 rounded w-full"></div>
                  <div className="h-0.5 bg-slate-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-extrabold text-sm text-duo-ink group-hover:text-[#115e59] transition">
                Câu chuyện
              </h4>
              <p className="text-xs text-duo-wolf leading-snug mt-0.5">
                Kể một câu chuyện cho khán giả bằng cách sử dụng các khối nội dung khác nhau
              </p>
            </div>
          </button>

          {/* Mục 3: Khoá học */}
          <button
            onClick={() => {
              setIsOpen(false);
              onCreateCourse();
            }}
            className="w-full px-3 py-3 rounded-2xl flex items-start gap-3.5 hover:bg-duo-polar transition text-left group"
          >
            {/* Biểu tượng Khoá học */}
            <div className="w-12 h-12 rounded-xl bg-duo-polar border-2 border-dashed border-duo-swan flex items-center justify-center shrink-0 group-hover:border-blue-300 group-hover:bg-blue-50/50 transition">
              <div className="w-7 h-6 rounded-md bg-white border-2 border-duo-swan relative flex flex-col items-center justify-center">
                <div className="w-4 h-1 bg-[#1368ce] rounded-full mb-1"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-100 border-2 border-[#1368ce] flex items-center justify-center">
                  <div className="w-1 h-1 bg-[#1368ce] rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-extrabold text-sm text-duo-ink group-hover:text-[#1368ce] transition">
                Khoá học
              </h4>
              <p className="text-xs text-duo-wolf leading-snug mt-0.5">
                Phù hợp nhất cho các phiên dài, bao gồm video, tài liệu và đánh giá
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// components/LiveHostModal – phòng thi đấu cả lớp (giáo viên trình chiếu)
// ============================================================================

interface LiveHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  token: string;
  onShowToast: (msg: string) => void;
  onSessionExpired: () => void;
  /** Gọi khi một trận vừa được lưu vào lịch sử lớp */
  onSaved: () => void;
  /** Học sinh thật của lớp – để biết bao nhiêu bạn đã vào phòng */
  students: Array<{ id: string; name: string }>;
}

const LIVE_COUNTS = [5, 10, 15] as const;

/** Đường link mở trang học sinh kèm sẵn mã PIN (chỉ khi chạy trên web, không phải file://) */
const liveJoinHref = (pin: string) => {
  if (!/^https?:$/.test(window.location.protocol)) return null;
  return isHashRouting()
    ? `${window.location.origin}${window.location.pathname}?pin=${pin}#/hoc-sinh`
    : `${window.location.origin}${basePath()}hoc-sinh?pin=${pin}`;
};

/** Bốn ô đáp án trên màn hình trình chiếu (chỉ hiển thị – học sinh bấm trên máy của mình) */
const LiveOptionTiles: React.FC<{ q: LiveQuestion; correctKey?: LiveKey | null }> = ({ q, correctKey = null }) => (
  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Các đáp án">
    {q.options.map((o, i) => {
      const s = ANSWER_STYLES[i % ANSWER_STYLES.length];
      const isRight = correctKey !== null && sameLiveKey(o.key, correctKey);
      const dim = correctKey !== null && !isRight;
      return (
        <li
          key={String(o.key)}
          className={`rounded-xl px-5 py-4 flex items-center gap-4 font-black text-lg sm:text-xl transition-opacity ${dim ? 'opacity-40' : ''}`}
          style={{ background: s.bg, color: s.fg, boxShadow: `0 5px 0 ${s.shadow}` }}
        >
          <KahootShape shape={s.shape} size={32} color={s.fg} />
          <span className="flex-1 leading-snug">{o.text}</span>
          {isRight && (
            <>
              <Check className="w-8 h-8 stroke-[4]" aria-hidden="true" />
              <span className="sr-only">(đáp án đúng)</span>
            </>
          )}
        </li>
      );
    })}
  </ul>
);

const LiveHostModal: React.FC<LiveHostModalProps> = (props) => (props.isOpen ? <LiveHostConsole {...props} /> : null);

const LiveHostConsole: React.FC<LiveHostModalProps> = ({ onClose, title, token, onShowToast, onSessionExpired, onSaved, students }) => {
  const [room, setRoom] = useState<LiveHostRoom | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; count: number; scope: string }>({ title, count: 10, scope: 'all' });
  const [seconds, startTimer] = useCountdown();
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [kick, setKick] = useState<LiveHostPlayer | null>(null);
  const savedId = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const { status, send, reconnect } = useLiveSocket(token, (msg) => {
    if (msg.type === 'room') {
      setReady(true);
      setBusy(false);
      setError(null);
      setRoom(msg.room);
      startTimer(msg.room?.phase === 'question' ? msg.room.remaining_ms : null);
      if (msg.room?.session_id && savedId.current !== msg.room.session_id) {
        savedId.current = msg.room.session_id;
        onSaved();
      }
    } else if (msg.type === 'saved') {
      onSaved();
    } else if (msg.type === 'error') {
      setBusy(false);
      setError(msg.message);
    }
  });

  useEffect(() => {
    if (status === 'expired') onSessionExpired();
  }, [status, onSessionExpired]);

  const phaseKey = room ? `${room.phase}-${room.index}` : ready ? 'setup' : 'loading';
  useEffect(() => {
    headingRef.current?.focus();
  }, [phaseKey]);

  const act = (msg: Record<string, unknown>) => {
    const ok = send(msg);
    if (!ok) onShowToast('Đang nối lại máy chủ – thầy/cô thử lại sau giây lát');
    return ok;
  };
  const openRoom = () => {
    setBusy(true);
    if (!act({ type: 'create', title: form.title.trim(), count: form.count, scope: form.scope })) setBusy(false);
  };
  const endRoom = () => {
    act({ type: 'close' });
    onClose();
  };
  const requestClose = () => {
    if (!room) onClose();
    else if (room.phase === 'podium') endRoom();
    else setEnding(true);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else document.documentElement.requestFullscreen?.().catch(() => onShowToast('Trình duyệt chặn toàn màn hình – nhấn F11 để trình chiếu'));
  };
  const copyLink = (href: string) => {
    navigator.clipboard
      ?.writeText(href)
      .then(() => onShowToast('Đã sao chép đường link vào phòng'))
      .catch(() => onShowToast('Không sao chép được – hãy đọc mã PIN cho cả lớp'));
  };

  const joined = room?.players.length ?? 0;
  const q = room?.question ?? null;
  const reveal = room?.reveal ?? null;
  const counts = reveal?.counts ?? [];
  const maxCount = Math.max(1, ...counts);
  const rightIndex = q && reveal ? q.options.findIndex((o) => sameLiveKey(o.key, reveal.key)) : -1;
  const rightCount = rightIndex >= 0 ? counts[rightIndex] ?? 0 : 0;
  const joinHref = room ? liveJoinHref(room.pin) : null;
  const announce = !room
    ? ''
    : room.phase === 'lobby'
    ? `${joined} học sinh đã vào phòng`
    : room.phase === 'question'
    ? `Câu ${room.index + 1} trên ${room.total}`
    : room.phase === 'reveal'
    ? `Đã công bố đáp án. ${rightCount} trên ${room.answered} bạn trả lời đúng`
    : room.phase === 'scoreboard'
    ? 'Bảng điểm'
    : 'Kết thúc trận';

  return (
    <div
      className="fixed inset-0 z-[60] kahoot-bg text-white flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Thi đấu cả lớp: ${room?.title ?? form.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !ending && !kick) requestClose();
      }}
    >
      {room?.phase === 'podium' && <Confetti count={90} />}

      {/* Hình nền trôi (trang trí) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {ANSWER_STYLES.map((s, i) => (
          <div key={s.shape} className="absolute animate-spin-slow opacity-[0.12]" style={{ left: `${6 + i * 26}%`, top: `${i % 2 ? 70 : 10}%`, animationDuration: `${20 + i * 6}s` }}>
            <KahootShape shape={s.shape} size={140} color="#fff" />
          </div>
        ))}
      </div>

      {/* Thanh trên */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-black text-2xl tracking-tight shrink-0">đông a!</span>
          {room && <span className="chip bg-white/15 text-white hidden sm:inline-flex truncate">{room.title}</span>}
          {room?.class_name && <span className="chip bg-white/15 text-white hidden md:inline-flex">Lớp {room.class_name}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 rounded-xl bg-black/25 px-3 h-10 text-sm font-bold">
            {status === 'open' ? (
              <>
                <Wifi className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Đã kết nối</span>
                <span className="sr-only sm:hidden">Đã kết nối</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" aria-hidden="true" /> <span>{status === 'connecting' ? 'Đang kết nối…' : 'Đang nối lại…'}</span>
              </>
            )}
          </span>
          <button type="button" onClick={toggleFullscreen} className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 hidden sm:flex items-center justify-center" aria-label="Bật/tắt toàn màn hình">
            <Maximize2 className="w-5 h-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={requestClose} className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center" aria-label="Đóng phòng thi đấu">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="sr-only" role="status" aria-atomic="true">
        {announce}
      </p>

      {!ready ? (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-3 font-black text-xl" role="status">
          <Loader2 className="w-10 h-10 animate-spin" aria-hidden="true" />
          {status === 'reconnecting' ? 'Chưa kết nối được máy chủ – đang thử lại…' : 'Đang kết nối phòng thi đấu…'}
        </div>
      ) : !room ? (
        /* ===== MỞ PHÒNG ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 pb-8">
          <form
            className="max-w-xl mx-auto bg-white text-duo-ink rounded-3xl p-6 sm:p-8 shadow-[0_6px_0_rgba(0,0,0,0.25)] space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              openRoom();
            }}
          >
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="font-black text-2xl sm:text-3xl outline-none">
                Mở phòng thi đấu
              </h2>
              <p className="text-sm font-semibold text-duo-wolf mt-1">
                Câu hỏi lấy từ ngân hàng của game (trắc nghiệm, đúng/sai), mỗi câu 20 giây. Server chấm và cộng XP, Ấn Tín, mức nắm vững như khi học sinh tự luyện.
              </p>
            </div>
            <div>
              <label htmlFor="live-title" className="block font-black text-sm mb-1.5">
                Tên trận
              </label>
              <input
                id="live-title"
                value={form.title}
                maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full min-h-[48px] rounded-xl border-2 border-duo-swan bg-white px-4 py-2 font-bold text-duo-ink focus:outline-none focus:border-kh-purple"
              />
            </div>
            <fieldset>
              <legend className="font-black text-sm mb-1.5">Số câu</legend>
              <div className="grid grid-cols-3 gap-2">
                {LIVE_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={form.count === n}
                    onClick={() => setForm((f) => ({ ...f, count: n }))}
                    className={`min-h-[48px] rounded-xl border-2 font-black transition-colors ${form.count === n ? 'border-kh-purple bg-kh-purple text-white' : 'border-duo-swan bg-white text-duo-ink hover:border-kh-purple'}`}
                  >
                    {n} câu
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-black text-sm mb-1.5">Phạm vi câu hỏi</legend>
              <div className="grid grid-cols-2 gap-2">
                {LIVE_SCOPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={form.scope === s.id}
                    onClick={() => setForm((f) => ({ ...f, scope: s.id }))}
                    className={`min-h-[48px] rounded-xl border-2 px-3 font-black transition-colors ${form.scope === s.id ? 'border-kh-purple bg-kh-purple text-white' : 'border-duo-swan bg-white text-duo-ink hover:border-kh-purple'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-duo-red-light text-duo-red-dark px-4 py-3 text-sm font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" /> {error}
              </p>
            )}
            <button type="submit" disabled={busy || status !== 'open'} className="btn-3d btn-gold btn-lg w-full">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Radio className="w-5 h-5" aria-hidden="true" />} Mở phòng
            </button>
          </form>
        </div>
      ) : room.phase === 'lobby' ? (
        /* ===== PHÒNG CHỜ ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 pb-6">
          <h2 ref={headingRef} tabIndex={-1} className="sr-only">
            Phòng chờ – mã PIN {room.pin.split('').join(' ')}
          </h2>
          <div className="bg-white text-duo-ink rounded-2xl flex flex-col sm:flex-row items-stretch overflow-hidden shadow-[0_6px_0_rgba(0,0,0,0.25)] mt-2 w-full max-w-3xl">
            <div className="px-6 py-4 border-b-2 sm:border-b-0 sm:border-r-2 border-duo-swan flex-1 min-w-0">
              <p className="font-black text-sm text-duo-wolf">Học sinh vào phòng</p>
              <p className="font-bold leading-snug">
                Trang học sinh → <b>Quốc Tử Giám</b> → <b>Thi đấu cả lớp</b>, nhập mã PIN
              </p>
              {joinHref && (
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs font-semibold text-duo-wolf break-all flex-1">{joinHref}</p>
                  <button type="button" onClick={() => copyLink(joinHref)} className="btn-3d btn-white btn-sm shrink-0">
                    <Copy className="w-4 h-4" aria-hidden="true" /> Sao chép
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-3 text-center">
              <p className="font-black text-sm text-duo-wolf">Mã PIN</p>
              <p className="font-black text-5xl sm:text-6xl tracking-wider text-kh-purple tabular" aria-hidden="true">
                {formatPin(room.pin)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-5xl mt-6">
            <span className="flex items-center gap-2 bg-black/25 rounded-xl px-4 py-2 font-black text-lg">
              <Users className="w-5 h-5" aria-hidden="true" /> {joined}
              {students.length > 0 ? `/${students.length}` : ''} học sinh
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => act({ type: 'lock', locked: !room.locked })} className="btn-3d btn-white" aria-pressed={room.locked}>
                {room.locked ? <Lock className="w-5 h-5" aria-hidden="true" /> : <Unlock className="w-5 h-5" aria-hidden="true" />}
                {room.locked ? 'Đã khóa phòng' : 'Khóa phòng'}
              </button>
              <button type="button" onClick={() => act({ type: 'start' })} disabled={joined === 0} className="btn-3d btn-gold btn-lg">
                Bắt đầu <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-black/30 px-4 py-2 font-bold">
              {error}
            </p>
          )}

          {joined === 0 ? (
            <div className="mt-16 bg-black/25 rounded-2xl px-6 py-4 font-black text-xl text-center">
              {students.length === 0 ? 'Lớp chưa có học sinh – nhờ quản trị viên cấp tài khoản trước nhé' : 'Đang chờ học sinh nhập mã PIN…'}
            </div>
          ) : (
            <ul className="mt-8 flex flex-wrap justify-center gap-3 max-w-5xl" aria-label="Học sinh trong phòng">
              {room.players.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setKick(p)}
                    className={`animate-pop-in min-h-[44px] bg-black/30 hover:bg-black/45 rounded-xl px-4 py-2 font-black text-lg flex items-center gap-2 ${p.connected ? '' : 'opacity-60'}`}
                    aria-label={`${p.name}${p.connected ? '' : ' (mất kết nối)'} – bấm để mời ra khỏi phòng`}
                  >
                    {!p.connected && <WifiOff className="w-4 h-4" aria-hidden="true" />}
                    {shortName(p.name)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (room.phase === 'question' || room.phase === 'reveal') && q ? (
        /* ===== CÂU HỎI / CÔNG BỐ ĐÁP ÁN ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col px-4 sm:px-6 pb-6">
          <h2 ref={headingRef} tabIndex={-1} className="bg-white text-duo-ink rounded-2xl px-6 py-4 text-center font-black text-xl sm:text-3xl leading-snug shadow-[0_6px_0_rgba(0,0,0,0.25)] outline-none">
            {q.prompt}
          </h2>

          {room.phase === 'question' ? (
            <div className="flex items-center justify-between gap-4 py-4">
              <LiveTimer seconds={seconds} total={room.duration_ms / 1000} size={110} light />
              <div className="flex flex-col items-center text-center min-w-0">
                <Mascot size={120} mood="thinking" accessory="helmet" bob className="hidden sm:block" />
                <span className="font-black text-sm text-white/80">
                  Câu {room.index + 1} / {room.total}
                </span>
                <span className="chip bg-white/15 text-white mt-1 max-w-full truncate">{q.topic}</span>
              </div>
              <div className="text-center shrink-0">
                <div className="font-black text-5xl tabular">
                  {room.answered}
                  <span className="text-2xl text-white/70">/{joined}</span>
                </div>
                <div className="font-black text-sm text-white/80">đã trả lời</div>
                <button type="button" onClick={() => act({ type: 'reveal' })} className="btn-3d btn-white btn-sm mt-3">
                  Công bố đáp án
                </button>
              </div>
            </div>
          ) : (
            reveal && (
              <div className="flex flex-col lg:flex-row gap-4 py-4">
                <ul className="flex-1 flex items-end justify-center gap-4 sm:gap-8 h-56" aria-label="Số học sinh chọn mỗi đáp án">
                  {q.options.map((o, i) => {
                    const s = ANSWER_STYLES[i % ANSWER_STYLES.length];
                    const count = counts[i] ?? 0;
                    const isRight = i === rightIndex;
                    return (
                      <li key={String(o.key)} className={`flex flex-col items-center justify-end h-full w-16 sm:w-24 ${isRight ? '' : 'opacity-50'}`}>
                        <div className="w-full rounded-t-lg transition-all duration-700 ease-out" style={{ height: `${Math.max(6, (count / maxCount) * 100)}%`, background: s.bg }} aria-hidden="true" />
                        <div className="w-full flex items-center justify-center gap-1.5 py-2 rounded-b-lg font-black text-xl" style={{ background: s.bg, color: s.fg }} aria-hidden="true">
                          <KahootShape shape={s.shape} size={18} color={s.fg} />
                          {count}
                          {isRight && <Check className="w-5 h-5 stroke-[4]" />}
                        </div>
                        <span className="sr-only">
                          {o.text}: {count} bạn chọn{isRight ? ' (đáp án đúng)' : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="lg:w-[40%] bg-black/25 rounded-2xl p-4">
                  <p className="font-black text-lg">
                    {rightCount}/{room.answered} bạn trả lời đúng
                  </p>
                  <p className="font-semibold leading-relaxed mt-2">{reveal.explanation}</p>
                  {reveal.source && <p className="text-xs font-bold text-white/75 mt-2">Nguồn: {reveal.source}</p>}
                  <button type="button" onClick={() => act({ type: 'next' })} className="btn-3d btn-white mt-4">
                    Bảng điểm <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          )}

          <LiveOptionTiles q={q} correctKey={room.phase === 'reveal' && reveal ? reveal.key : null} />
        </div>
      ) : room.phase === 'scoreboard' ? (
        /* ===== BẢNG ĐIỂM ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 pb-6">
          <h2 ref={headingRef} tabIndex={-1} className="bg-white text-duo-ink rounded-2xl px-10 py-3 font-black text-3xl shadow-[0_6px_0_rgba(0,0,0,0.25)] outline-none">
            Bảng điểm
          </h2>
          <ol className="w-full max-w-2xl mt-8 space-y-3">
            {room.players.slice(0, 5).map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center justify-between gap-3 rounded-xl px-5 py-3 font-black text-xl animate-slide-up ${i === 0 ? 'bg-white text-duo-ink' : 'bg-black/25'}`}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-base shrink-0" style={{ background: avatarColor(p.name) }}>
                    {i + 1}
                  </span>
                  <span className="truncate">{shortName(p.name)}</span>
                  {p.streak >= 2 && (
                    <span className={`flex items-center gap-0.5 text-sm ${i === 0 ? 'text-duo-red-dark' : 'text-white/90'}`}>
                      <Flame className="w-4 h-4" aria-hidden="true" /> {p.streak}
                      <span className="sr-only">câu đúng liên tiếp</span>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 shrink-0 tabular">
                  {p.last_gain > 0 && <span className={`text-sm ${i === 0 ? 'text-duo-green-dark' : 'text-duo-green-light'}`}>+{p.last_gain}</span>}
                  {p.score.toLocaleString('vi-VN')}
                </span>
              </li>
            ))}
          </ol>
          {joined > 5 && <p className="mt-3 font-bold text-white/80">và {joined - 5} bạn khác</p>}
          <button type="button" onClick={() => act({ type: 'next' })} className="btn-3d btn-white mt-8">
            {room.index + 1 < room.total ? 'Câu tiếp theo' : 'Xem bục vinh quang'} <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        /* ===== BỤC VINH QUANG ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 pb-6">
          <h2 ref={headingRef} tabIndex={-1} className="flex items-center justify-center gap-2 font-black text-2xl sm:text-3xl text-center outline-none mt-1 mb-4 max-w-4xl">
            <Trophy className="w-8 h-8 text-duo-gold shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{room.title}</span>
          </h2>
          <div className="flex items-end justify-center gap-3 sm:gap-6 w-full max-w-3xl">
            {[room.players[1], room.players[0], room.players[2]].map((p, i) =>
              p ? (
                <div key={p.id} className="flex flex-col items-center w-1/3 max-w-[220px] animate-slide-up" style={{ animationDelay: `${[400, 900, 0][i]}ms` }}>
                  {i === 1 && <Mascot size={72} accessory="crown" mood="love" bob />}
                  <span className="font-black text-xl sm:text-2xl text-center mt-1">{shortName(p.name)}</span>
                  <span className="font-bold text-white/80">{p.score.toLocaleString('vi-VN')} điểm</span>
                  <div className={`w-full mt-2 rounded-t-2xl flex flex-col items-center justify-start pt-3 ${['h-28', 'h-40', 'h-20'][i]}`} style={{ background: ['#c0c0c0', '#d97706', '#cd7f32'][i] }}>
                    <span className="w-12 h-12 rounded-full bg-white/40 flex items-center justify-center font-black text-2xl text-black/60">{[2, 1, 3][i]}</span>
                  </div>
                </div>
              ) : null
            )}
          </div>
          <section className="w-full max-w-3xl bg-black/25 rounded-2xl p-4 mt-6" aria-labelledby="live-final-title">
            <h3 id="live-final-title" className="font-black text-lg mb-2">
              Kết quả cả lớp
            </h3>
            <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {room.players.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-1 border-b border-white/10 font-bold">
                  <span className="truncate">
                    {i + 1}. {p.name}
                  </span>
                  <span className="shrink-0 tabular text-white/85">
                    {p.score.toLocaleString('vi-VN')} · {p.correct}/{room.total} đúng
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <p className="mt-4 font-bold text-white/85 flex items-center gap-2" role="status">
            {room.session_id ? (
              <>
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> Đã lưu vào lịch sử thi đấu của lớp
              </>
            ) : room.saved ? (
              'Đang lưu kết quả…'
            ) : null}
          </p>
          <div className="w-full flex flex-wrap items-center justify-center gap-3 py-4">
            <button type="button" onClick={openRoom} disabled={busy} className="btn-3d btn-white">
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Trận mới
            </button>
            <button type="button" onClick={endRoom} className="btn-3d btn-gold">
              Kết thúc
            </button>
          </div>
        </div>
      )}

      {/* ===== HỘP THOẠI ===== */}
      {ending && room && (
        <div className="absolute inset-0 z-20 bg-black/55 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="live-end-title" className="w-full max-w-md bg-white text-duo-ink rounded-3xl p-6 space-y-4">
            <h3 id="live-end-title" className="font-black text-xl">
              Kết thúc phòng thi đấu?
            </h3>
            <p className="text-sm font-semibold text-duo-wolf">
              {room.phase === 'lobby'
                ? 'Học sinh trong phòng chờ sẽ được báo là phòng đã đóng.'
                : 'Kết quả tới câu hiện tại vẫn được lưu vào lịch sử lớp. Nếu chỉ tạm rời, phòng được giữ 15 phút để thầy/cô quay lại.'}
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={endRoom} className="btn-3d btn-red w-full">
                Kết thúc trận
              </button>
              <button type="button" onClick={onClose} className="btn-3d btn-white w-full">
                Tạm rời, giữ phòng mở
              </button>
              <button type="button" onClick={() => setEnding(false)} className="btn-3d btn-white w-full" autoFocus>
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
      {kick && (
        <div className="absolute inset-0 z-20 bg-black/55 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="live-kick-title" className="w-full max-w-md bg-white text-duo-ink rounded-3xl p-6 space-y-4">
            <h3 id="live-kick-title" className="font-black text-xl">
              Mời {kick.name} ra khỏi phòng?
            </h3>
            <p className="text-sm font-semibold text-duo-wolf">Bạn này sẽ không vào lại được phòng thi đấu này.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  act({ type: 'kick', player_id: kick.id });
                  setKick(null);
                }}
                className="btn-3d btn-red flex-1"
              >
                Mời ra
              </button>
              <button type="button" onClick={() => setKick(null)} className="btn-3d btn-white flex-1" autoFocus>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
      {status === 'replaced' && (
        <div className="absolute inset-0 z-30 bg-black/65 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="live-replaced-title" className="w-full max-w-md bg-white text-duo-ink rounded-3xl p-6 space-y-4">
            <h3 id="live-replaced-title" className="font-black text-xl">
              Phòng đang được điều khiển ở nơi khác
            </h3>
            <p className="text-sm font-semibold text-duo-wolf">Thầy/cô vừa mở phòng thi đấu ở một tab hoặc máy khác.</p>
            <div className="flex gap-2">
              <button type="button" onClick={reconnect} className="btn-3d btn-gold flex-1" autoFocus>
                Điều khiển ở đây
              </button>
              <button type="button" onClick={onClose} className="btn-3d btn-white flex-1">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// components/Sidebar
// ============================================================================

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenAiModal: () => void;
}

const NAV_ITEMS: Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
  isAi?: boolean;
}> = [
  { id: 'home', label: 'Trang chủ', icon: Home, color: '#0f766e' },
  { id: 'live', label: 'Thi đấu', icon: Radio, color: '#e21b3c', badge: 'LIVE' },
  { id: 'quests', label: 'Nhiệm vụ', icon: MapPin, color: '#c2410c', badge: 'Mới' },
  { id: 'discover', label: 'Khám phá', icon: Compass, color: '#0369a1' },
  { id: 'library', label: 'Thư viện', icon: FolderOpen, color: '#d97706' },
  { id: 'reports', label: 'Báo cáo', icon: BarChart2, color: '#b91c1c' },
  { id: 'groups', label: 'Nhóm lớp', icon: Users, color: '#2b70c9', badge: '7A1' },
  { id: 'ai_tools', label: 'Học liệu AI', icon: Sparkles, color: '#7e22ce', isAi: true, badge: 'AI' },
];

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, onOpenAiModal }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);

  return (
    <aside
      className={`bg-white border-r-2 border-duo-swan flex flex-col justify-between transition-all duration-300 z-40 shrink-0 h-full py-5 ${
        isCollapsed ? 'w-[88px] px-3' : 'w-64 px-4'
      }`}
    >
      <div className="min-h-0 flex flex-col">
        <div className={`flex items-center mb-6 px-1 ${isCollapsed ? 'flex-col gap-3' : 'justify-between'}`}>
          <BrandLogo compact={isCollapsed} subtitle="Giảng viên" />
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl text-duo-hare hover:text-duo-wolf hover:bg-duo-polar transition hidden md:block"
            title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => (item.isAi ? onOpenAiModal() : onSelectTab(item.id))}
                className={`nav-duo ${isCollapsed ? 'justify-center' : ''} ${isActive ? 'is-active' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color }}>
                  <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2.6} />
                </span>
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`chip ${
                          item.badge === 'LIVE' ? 'bg-kh-red text-white' : item.isAi ? 'bg-duo-purple text-white' : 'bg-duo-polar text-duo-wolf'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <button
        onClick={() => onSelectTab('help')}
        className={`nav-duo ${isCollapsed ? 'justify-center' : ''}`}
        title={isCollapsed ? 'Trợ giúp' : undefined}
      >
        <span className="w-8 h-8 rounded-xl bg-duo-polar flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-duo-hare" />
        </span>
        {!isCollapsed && <span>Trợ giúp & SGK 7</span>}
      </button>
    </aside>
  );
};

// ============================================================================
// components/TextbookModal
// ============================================================================

interface TextbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageNumber: number;
}

const TextbookModal: React.FC<TextbookModalProps> = ({
  isOpen,
  onClose,
  pageNumber,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] zoom-in-95">
        {/* Header */}
        <div className="bg-duo-blue text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Trích đoạn SGK Lịch sử 7</h3>
              <p className="text-xs font-bold text-white/85">Bộ sách Kết nối tri thức với cuộc sống • Trang {pageNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-duo-hare hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Excerpt */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-[#4b4b4b]">
          <div className="bg-amber-50/70 border-2 border-amber-200/80 rounded-xl p-4">
            <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block mb-1">
              Bài 13: Đại Việt thời Trần (1226 – 1400) • Mục 2b (Trang 68 – 69)
            </span>
            <h4 className="font-bold text-duo-ink text-sm mb-2">
              Chuẩn bị cho cuộc kháng chiến lần thứ hai chống quân Nguyên (1282 – 1285)
            </h4>

            <p className="mb-3 text-duo-ink">
              <strong>1. Hội nghị Bình Than (Tháng 10 năm 1282):</strong><br />
              Trước nguy cơ xâm lăng của 50 vạn giặc Nguyên, vua Trần Nhân Tông mở hội nghị tại bến Bình Than (Gia Bình, Bắc Ninh), triệu tập các <em>vương hầu, quý tộc và tướng lĩnh</em> trong hoàng tộc để bàn kế sách tác chiến và phân công phòng thủ đất nước.
            </p>

            <blockquote className="border-l-4 border-amber-500 pl-3 my-2 text-duo-ink italic bg-white/70 py-1.5 rounded-r">
              "Hoài Văn hầu Trần Quốc Toản vì còn nhỏ tuổi không được vào dự bàn việc quân, trong lòng hổ thẹn, phẫn uất, tay cầm quả cam vua ban bóp nát lúc nào không biết. Sau đó, Quốc Toản trở về chiêu mộ hơn 1.000 gia nô, thêu cờ sáu chữ vàng 'Phá cường địch, báo hoàng ân'..."
            </blockquote>

            <p className="mt-3 text-duo-ink">
              <strong>2. Hội nghị Diên Hồng (Đầu năm 1285):</strong><br />
              Thượng hoàng Trần Thánh Tông triệu tập <em>các bậc phụ lão (bô lão)</em> uy tín đại diện cho nhân dân khắp mọi miền đất nước về điện Diên Hồng (Thăng Long) để hỏi ý kiến: <em>"Nên đánh hay nên hòa?"</em>. Muôn người một lòng, đồng thanh hô vang một tiếng <strong>"ĐÁNH!"</strong> rung chuyển kinh thành.
            </p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900">
              <strong>Điểm mấu chốt để phân biệt cho học sinh:</strong><br />
              • <strong>Bình Than (1282):</strong> Họp Vương hầu quan lại triều đình (Quả cam của Trần Quốc Toản).<br />
              • <strong>Diên Hồng (1285):</strong> Họp Bô lão đại diện cho nhân dân (Tiếng hô ĐÁNH).
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-duo-polar border-t-2 border-duo-swan flex items-center justify-between">
          <span className="text-[11px] text-duo-hare">Nguồn: Viện KHGD & NXB Giáo dục Việt Nam</span>
          <button
            onClick={onClose}
            className="px-4 py-2 btn-3d btn-dark btn-normal-case rounded-xl text-xs font-bold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// components/TodoListModal
// ============================================================================

interface TodoTask {
  id: string;
  title: string;
  description: string;
  category: 'profile' | 'report' | 'ai' | 'lesson' | 'excel' | 'assignment';
  status: 'active' | 'completed' | 'skipped';
  actionLabel?: string;
  actionType?: 'profile' | 'report' | 'ai' | 'lesson' | 'excel' | 'library';
}

interface TodoListModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TodoTask[];
  onToggleComplete: (id: string) => void;
  onSkipTask: (id: string) => void;
  onRestoreTask: (id: string) => void;
  onExecuteAction: (actionType?: string) => void;
}

const TodoListModal: React.FC<TodoListModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onToggleComplete,
  onSkipTask,
  onRestoreTask,
  onExecuteAction,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'skipped'>('active');

  if (!isOpen) return null;

  const activeTasks = tasks.filter((t) => t.status === 'active');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const skippedTasks = tasks.filter((t) => t.status === 'skipped');

  const displayedTasks =
    activeTab === 'active'
      ? activeTasks
      : activeTab === 'completed'
      ? completedTasks
      : skippedTasks;

  const getTaskIcon = (task: TodoTask) => {
    switch (task.category) {
      case 'profile':
        return (
          <div className="w-8 h-8 rounded-full bg-[#b8bcc8] flex items-center justify-center text-white shrink-0">
            <User className="w-4 h-4 fill-white text-white" />
          </div>
        );
      case 'report':
        return (
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
            <BarChart2 className="w-4 h-4" />
          </div>
        );
      case 'ai':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
        );
      case 'lesson':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Compass className="w-4 h-4" />
          </div>
        );
      case 'excel':
        return (
          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
        );
      case 'assignment':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-duo-wolf shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col min-h-[520px] max-h-[85vh] zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* 1. Modal Header (Khớp chuẩn ảnh: Tiêu đề + Nút đóng ✕) */}
        {/* ======================================================== */}
        <div className="px-8 pt-7 pb-4 flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-black text-duo-ink tracking-tight">
            Danh sách việc cần làm
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-duo-hare hover:text-duo-ink hover:bg-duo-polar transition"
            title="Đóng"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* 2. Thanh Tabs dạng viên thuốc đen/tím (Khớp chuẩn ảnh) */}
        {/* ======================================================== */}
        <div className="px-8 pb-5 shrink-0">
          <div className="inline-flex items-center bg-duo-polar border-2 border-duo-swan p-1 rounded-2xl gap-1 select-none">
            {/* Tab 1: Đang hoạt động */}
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'active'
                  ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                  : 'text-duo-hare hover:text-duo-wolf'
              }`}
            >
              Đang hoạt động ({activeTasks.length})
            </button>

            {/* Tab 2: Đã hoàn thành */}
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'completed'
                  ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                  : 'text-duo-hare hover:text-duo-wolf'
              }`}
            >
              Đã hoàn thành ({completedTasks.length})
            </button>

            {/* Tab 3: Đã bỏ qua */}
            <button
              onClick={() => setActiveTab('skipped')}
              className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'skipped'
                  ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                  : 'text-duo-hare hover:text-duo-wolf'
              }`}
            >
              Đã bỏ qua ({skippedTasks.length})
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. Danh sách các đầu việc (Khớp chuẩn nền xám nhạt như ảnh) */}
        {/* ======================================================== */}
        <div className="px-8 pb-8 overflow-y-auto flex-1 space-y-3">
          {displayedTasks.length === 0 ? (
            <div className="py-20 text-center bg-duo-polar border-2 border-dashed border-duo-swan rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-duo-hare mx-auto mb-2" />
              <p className="text-sm font-bold text-duo-wolf">
                {activeTab === 'active'
                  ? 'Tuyệt vời! Bạn đã hoàn thành tất cả việc cần làm.'
                  : activeTab === 'completed'
                  ? 'Chưa có đầu việc nào được đánh dấu hoàn thành.'
                  : 'Không có đầu việc nào bị bỏ qua.'}
              </p>
              <p className="text-xs text-duo-hare mt-1">
                Các đầu việc mới sẽ xuất hiện tự động theo tiến độ giảng dạy.
              </p>
            </div>
          ) : (
            displayedTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-2xl border-2 border-duo-swan hover:bg-duo-polar transition flex items-center justify-between gap-4 group"
              >
                {/* Left: Icon tròn + Nội dung tiêu đề và mô tả */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Icon trong vòng tròn */}
                  {getTaskIcon(task)}

                  {/* Chi tiết đầu việc */}
                  <div className="min-w-0">
                    <h4
                      className={`text-xs md:text-sm font-extrabold text-duo-ink leading-snug truncate ${
                        task.status === 'completed' ? 'text-duo-ink' : ''
                      }`}
                    >
                      {task.title}
                    </h4>
                    <p className="text-xs text-duo-wolf mt-0.5 leading-relaxed line-clamp-1">
                      {task.description}
                    </p>
                  </div>
                </div>

                {/* Right: Các nút tương tác */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Nếu đang hoạt động: Nút Thực hiện + Nút Hoàn tất + Nút Bỏ qua */}
                  {task.status === 'active' && (
                    <>
                      {task.actionLabel && (
                        <button
                          onClick={() => onExecuteAction(task.actionType)}
                          className="hidden sm:inline-flex btn-3d btn-outline btn-sm btn-normal-case !text-duo-ink"
                        >
                          <span>{task.actionLabel}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-duo-hare" />
                        </button>
                      )}

                      {/* Nút Hoàn thành (Checkmark) */}
                      <button
                        onClick={() => onToggleComplete(task.id)}
                        className="btn-3d btn-green btn-sm"
                        title="Đánh dấu hoàn thành"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span className="hidden md:inline">Xong</span>
                      </button>

                      {/* Nút Bỏ qua */}
                      <button
                        onClick={() => onSkipTask(task.id)}
                        className="p-2 text-duo-hare hover:text-duo-wolf hover:bg-white rounded-xl transition"
                        title="Bỏ qua việc này"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {/* Nếu đã hoàn thành: Nút Làm lại */}
                  {task.status === 'completed' && (
                    <button
                      onClick={() => onToggleComplete(task.id)}
                      className="btn-3d btn-outline btn-sm btn-normal-case !text-duo-wolf"
                      title="Mở lại việc này"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-duo-wolf" />
                      <span>Mở lại</span>
                    </button>
                  )}

                  {/* Nếu đã bỏ qua: Nút Khôi phục */}
                  {task.status === 'skipped' && (
                    <button
                      onClick={() => onRestoreTask(task.id)}
                      className="btn-3d btn-outline btn-sm btn-normal-case"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Khôi phục</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// types/library
// ============================================================================

interface FolderItem {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  description?: string;
}

type QuestionType = 'quiz' | 'true_false';
type PointsType = 'standard' | 'double' | 'no_points';
type AnswerMode = 'single' | 'multiple';

interface QuizQuestionOption {
  text: string;
  isCorrect: boolean;
  imageUrl?: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  mediaUrl?: string;
  type: QuestionType;
  timeLimit: number; // in seconds: 5, 10, 20, 30, 60, etc.
  points: PointsType;
  answerMode: AnswerMode;
  options: QuizQuestionOption[];
}

interface QuizTheme {
  id: string;
  name: string;
  category: 'free' | 'pro';
  bgGradient: string;
  cardBg: string;
  previewUrl?: string;
}

interface QuizItem {
  id: string;
  title: string;
  questionCount: number;
  status: 'draft' | 'ready' | 'favorite';
  folderId?: string | null;
  thumbnail: string;
  author: string;
  updatedAt: string;
  plays?: number;
  description?: string;
  themeId?: string;
  questions?: QuizQuestion[];
}

type StoryBlockType = 'text' | 'image' | 'video' | 'audio' | 'embed';

interface StoryBlock {
  id: string;
  type: StoryBlockType;
  content?: string;
  mediaUrl?: string;
  caption?: string;
  embedUrl?: string;
  width?: 'normal' | 'wide' | 'full';
}

interface StoryItem {
  id: string;
  title: string;
  readingTime: string; // e.g. "1 phút đọc"
  status: 'draft' | 'published';
  folderId?: string | null;
  thumbnail: string;
  author: string;
  updatedAt: string;
  summary: string;
  content: string;
  blocks?: StoryBlock[];
  tags?: string[];
}

interface CourseItem {
  id: string;
  title: string;
  chapterCount: number;
  duration: string;
  status: 'draft' | 'published';
  folderId?: string | null;
  thumbnail: string;
  author: string;
  updatedAt: string;
  description?: string;
}

type LibraryCategory = 'quiz' | 'story' | 'course' | 'folders' | 'trash';

// ============================================================================
// data/libraryMockData
// ============================================================================

const initialFolders: FolderItem[] = [
  {
    id: 'folder-1',
    name: 'Lớp 7A1 - Kháng chiến Mông-Nguyên',
    color: '#115e59',
    createdAt: '01/10/2026',
    description: 'Tập hợp các bài trắc nghiệm và câu chuyện bài 13 GDPT 2018',
  },
  {
    id: 'folder-2',
    name: 'Chương Dương Độ & Thăng Long 1285',
    color: '#1368ce',
    createdAt: '03/10/2026',
    description: 'Chuyên đề phản công mùa hè năm 1285',
  },
  {
    id: 'folder-3',
    name: 'Tài liệu bồi dưỡng học sinh giỏi',
    color: '#059669',
    createdAt: '05/10/2026',
    description: 'Câu hỏi chuyên sâu và tư liệu lịch sử Đại Việt Sử Ký',
  },
];

const quizThemes: QuizTheme[] = [
  {
    id: 'standard',
    name: 'Standard',
    category: 'free',
    bgGradient: 'bg-gradient-to-br from-[#4c1d95] via-[#5b21b6] to-[#3b0764]',
    cardBg: 'bg-[#5b21b6]/40',
    previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'spring',
    name: 'Spring',
    category: 'free',
    bgGradient: 'bg-gradient-to-br from-[#065f46] via-[#047857] to-[#064e3b]',
    cardBg: 'bg-[#047857]/40',
    previewUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'summer',
    name: 'Summer',
    category: 'free',
    bgGradient: 'bg-gradient-to-br from-[#c2410c] via-[#ea580c] to-[#9a3412]',
    cardBg: 'bg-[#ea580c]/40',
    previewUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'autumn',
    name: 'Autumn',
    category: 'free',
    bgGradient: 'bg-gradient-to-br from-[#b45309] via-[#d97706] to-[#78350f]',
    cardBg: 'bg-[#d97706]/40',
    previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'winter',
    name: 'Winter',
    category: 'free',
    bgGradient: 'bg-gradient-to-br from-[#1e40af] via-[#2563eb] to-[#1e3a8a]',
    cardBg: 'bg-[#2563eb]/40',
    previewUrl: 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'skyscrapers',
    name: 'Skyscrapers',
    category: 'pro',
    bgGradient: 'bg-gradient-to-br from-[#334155] via-[#475569] to-[#1e293b]',
    cardBg: 'bg-[#334155]/50',
    previewUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'technology',
    name: 'Technology',
    category: 'pro',
    bgGradient: 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#090d16]',
    cardBg: 'bg-[#1e1b4b]/60',
    previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'dark',
    name: 'Dark',
    category: 'pro',
    bgGradient: 'bg-gradient-to-br from-[#18181b] via-[#27272a] to-[#09090b]',
    cardBg: 'bg-[#27272a]/70',
    previewUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'dong_a',
    name: 'Hào khí Đông A',
    category: 'pro',
    bgGradient: 'bg-gradient-to-br from-[#831843] via-[#9d174d] to-[#500724]',
    cardBg: 'bg-[#9d174d]/50',
    previewUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=200&q=80',
  },
];

const initialQuizzes: QuizItem[] = [
  {
    id: 'quiz-1',
    title: 'Bài 13: Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)',
    questionCount: 4,
    status: 'ready',
    folderId: 'folder-1',
    thumbnail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
    author: 'Thầy Nguyễn Văn Long',
    updatedAt: '2 giờ trước',
    plays: 35,
    themeId: 'standard',
    description: 'Bộ trắc nghiệm chuẩn kết nối tri thức cho học sinh lớp 7.',
    questions: [
      {
        id: 'q-1',
        question: 'Ai là người bóp nát quả cam tại Hội nghị Bình Than năm 1282?',
        type: 'quiz',
        timeLimit: 20,
        points: 'standard',
        answerMode: 'single',
        mediaUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=600&q=80',
        options: [
          { text: 'Trần Quốc Toản', isCorrect: true },
          { text: 'Trần Hưng Đạo', isCorrect: false },
          { text: 'Trần Quang Khải', isCorrect: false },
          { text: 'Trần Khánh Dư', isCorrect: false },
        ],
      },
      {
        id: 'q-2',
        question: 'Hội nghị Diên Hồng được tổ chức vào năm nào và lấy ý kiến của ai?',
        type: 'quiz',
        timeLimit: 30,
        points: 'standard',
        answerMode: 'single',
        mediaUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600&q=80',
        options: [
          { text: 'Năm 1285, lấy ý kiến các bô lão trong cả nước', isCorrect: true },
          { text: 'Năm 1282, lấy ý kiến vương hầu quý tộc', isCorrect: false },
          { text: 'Năm 1288, lấy ý kiến các tướng lĩnh hải quân', isCorrect: false },
          { text: 'Năm 1258, lấy ý kiến quân lính thành Thăng Long', isCorrect: false },
        ],
      },
      {
        id: 'q-3',
        question: 'Chiến thuật quân sự nổi tiếng nào giúp quân dân nhà Trần đánh bại quân Mông - Nguyên?',
        type: 'quiz',
        timeLimit: 20,
        points: 'double',
        answerMode: 'single',
        options: [
          { text: 'Vườn không nhà trống', isCorrect: true },
          { text: 'Cố thủ thành quách lâu dài', isCorrect: false },
          { text: 'Dàn trận địa đối đầu trực diện', isCorrect: false },
          { text: 'Hòa hoãn vô điều kiện', isCorrect: false },
        ],
      },
      {
        id: 'q-4',
        question: 'Tướng giặc Thoát Hoan phải chui vào ống đồng trốn chạy trong cuộc kháng chiến nào?',
        type: 'true_false',
        timeLimit: 20,
        points: 'standard',
        answerMode: 'single',
        options: [
          { text: 'Đúng (Kháng chiến lần 2 năm 1285)', isCorrect: true },
          { text: 'Sai', isCorrect: false },
        ],
      },
    ],
  },
  {
    id: 'quiz-2',
    title: 'Ải Chương Dương Độ 1285 - Chiến thuật phản công mùa hè',
    questionCount: 2,
    status: 'draft',
    folderId: 'folder-2',
    thumbnail: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80',
    author: 'Thầy Nguyễn Văn Long',
    updatedAt: 'Hôm qua',
    plays: 0,
    themeId: 'spring',
    description: 'Đề luyện tập chuyên sâu chiến thuật thuỷ bộ phối hợp.',
    questions: [
      {
        id: 'q-2-1',
        question: 'Ai là chỉ huy chính trận thuỷ chiến Chương Dương Độ giành thắng lợi giòn giã?',
        type: 'quiz',
        timeLimit: 20,
        points: 'standard',
        answerMode: 'single',
        options: [
          { text: 'Thượng tướng Thái sư Trần Quang Khải', isCorrect: true },
          { text: 'Trần Thủ Độ', isCorrect: false },
          { text: 'Trần Bình Trọng', isCorrect: false },
          { text: 'Yết Kiêu', isCorrect: false },
        ],
      },
    ],
  },
  {
    id: 'quiz-3',
    title: 'Hội nghị Bình Than & Lời thề Sát Thát',
    questionCount: 3,
    status: 'favorite',
    folderId: 'folder-1',
    thumbnail: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80',
    author: 'Thầy Nguyễn Văn Long',
    updatedAt: '3 ngày trước',
    plays: 68,
    themeId: 'autumn',
    description: 'Trắc nghiệm đánh giá tinh thần đoàn kết toàn dân thời Trần.',
  },
  {
    id: 'quiz-4',
    title: 'Chiến thắng Bạch Đằng Giang 1288 - Trận thuỷ chiến huyền thoại',
    questionCount: 5,
    status: 'ready',
    folderId: null,
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80',
    author: 'Thầy Nguyễn Văn Long',
    updatedAt: '1 tuần trước',
    plays: 92,
    themeId: 'winter',
    description: 'Câu hỏi về kế sách cọc gỗ bịt sắt và quy luật con nước thuỷ triều.',
  },
];

const initialStories: StoryItem[] = [
  {
    id: 'story-1',
    title: 'Quả cam vua ban và lá cờ thêu sáu chữ vàng',
    readingTime: '1 phút đọc',
    status: 'draft',
    folderId: 'folder-1',
    thumbnail: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=400&q=80',
    author: 'Thầy Nguyễn Văn Long',
    updatedAt: 'Hôm nay',
    summary: 'Trần Quốc Toản vì chưa đủ tuổi dự bàn việc quân đã bóp nát quả cam vua ban lúc nào không biết.',
    content: `Tháng 10 năm Nhâm Ngọ (1282), vua Trần Nhân Tông mở hội nghị Bình Than tại bến Bình Than để cùng các vương hầu bàn kế sách chống giặc. Hoài Văn hầu Trần Quốc Toản vì tuổi còn nhỏ nên không được vào dự bàn việc nước, uất ức nắm chặt quả cam vua ban rồi bóp nát tự bao giờ...`,
    blocks: [
      {
        id: 'b-1',
        type: 'text',
        content: `Tháng 10 năm Nhâm Ngọ (1282), vua Trần Nhân Tông mở hội nghị Bình Than tại bến Bình Than (Hải Dương ngày nay) để cùng các vương hầu, tướng lĩnh bàn kế sách chống lại nửa triệu quân Nguyên - Mông hung bạo.

Hoài Văn hầu Trần Quốc Toản khi ấy mới 16 tuổi, vì tuổi còn quá nhỏ nên không được vào dự bàn việc nước trong thuyền rồng. Quốc Toản uất ức, căm giận giặc ngoại xâm khôn cùng.`,
      },
      {
        id: 'b-2',
        type: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=600&q=80',
        caption: 'Trần Quốc Toản bóp nát quả cam vua ban tại bến Bình Than',
      },
      {
        id: 'b-3',
        type: 'text',
        content: `Vua thấy chàng thiếu niên có chí khí, bèn ban cho một quả cam quý và khuyên về nghỉ ngơi. Quốc Toản vừa hờn vừa giận, tay nắm chặt quả cam mà nghiến răng thề sẽ đánh giặc cứu nước. Khi xòe tay ra, quả cam quý đã bị bóp nát tự bao giờ!

Về nhà, chàng cho thêu lên lá cờ lớn sáu chữ vàng: "PHÁ CƯỜNG ĐỊCH, BÁO HOÀNG ÂN" rồi chiêu mộ hơn một nghìn gia nô, trai tráng cùng xuất trận.`,
      },
      {
        id: 'b-4',
        type: 'embed',
        embedUrl: 'https://dong-a-edu.vn/bai-13-binh-than',
      },
    ],
    tags: ['Trần Quốc Toản', 'Hội nghị Bình Than', 'Lịch sử 7'],
  },
  {
    id: 'story-2',
    title: 'Tiếng hô ĐÁNH rung chuyển điện Diên Hồng',
    readingTime: '2 phút đọc',
    status: 'published',
    folderId: 'folder-1',
    thumbnail: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=400&q=80',
    author: 'Thầy Nguyễn Văn Long',
    updatedAt: '3 ngày trước',
    summary: 'Các bô lão trên khắp cả nước tụ hội tại kinh thành Thăng Long, đồng thanh hô vang một chữ ĐÁNH quyết liệt.',
    content: `Đầu năm 1285, Thoát Hoan dẫn 50 vạn quân Nguyên ồ ạt tràn qua biên giới nước ta. Trước thế giặc ngút trời hung hãn, Thượng hoàng Trần Thánh Tông triệu tập Hội nghị Diên Hồng mời các bô lão cả nước hỏi nên ĐÁNH hay nên HOÀ...`,
    blocks: [
      {
        id: 'b-2-1',
        type: 'text',
        content: `Đầu năm 1285, Thoát Hoan dẫn 50 vạn quân Nguyên ồ ạt tràn qua biên giới nước ta. Trước thế giặc ngút trời hung hãn, Thượng hoàng Trần Thánh Tông quyết định triệu tập một hội nghị chưa từng có trong lịch sử: Hội nghị Diên Hồng.`,
      },
      {
        id: 'b-2-2',
        type: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600&q=80',
        caption: 'Hội nghị Diên Hồng năm 1285 tại kinh thành Thăng Long',
      },
      {
        id: 'b-2-3',
        type: 'audio',
        mediaUrl: 'https://assets.mixkit.co/music/preview/mixkit-epic-heroic-cinematic-trailer-988.mp3',
        caption: 'Hào khí Đông A - Tiếng hô Sát Thát (Thuyết minh)',
      },
    ],
    tags: ['Hội nghị Diên Hồng', 'Đại Việt', 'Hào khí Đông A'],
  },
  {
    id: 'story-3',
    title: 'Bạch Đằng giang - Cọc nhọn bẫy đoàn thuyền giặc Ô Mã Nhi',
    readingTime: '3 phút đọc',
    status: 'published',
    folderId: 'folder-2',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
    author: 'Thầy Nguyễn Văn Long',
    updatedAt: '5 ngày trước',
    summary: 'Chiến thuật lợi dụng quy luật thủy triều và bãi cọc ngầm của Hưng Đạo Đại Vương Trần Quốc Tuấn năm 1288.',
    content: `Tháng 4 năm 1288, sau khi cạn kiệt lương thảo ở kinh thành Thăng Long, Thoát Hoan buộc phải rút quân...`,
    tags: ['Bạch Đằng 1288', 'Trần Hưng Đạo', 'Chiến thuật quân sự'],
  },
];

const initialCourses: CourseItem[] = [
  {
    id: 'course-1',
    title: 'Chuyên đề: Ba lần kháng chiến chống Mông - Nguyên (Thế kỷ XIII)',
    chapterCount: 4,
    duration: '45 phút',
    status: 'published',
    folderId: 'folder-1',
    thumbnail: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=400&q=80',
    author: 'Thầy Nguyễn Văn Long',
    updatedAt: '2 tuần trước',
    description: 'Bao gồm video lược đồ chiến dịch, 4 chặng sa bàn và bài tập đánh giá tổng hợp.',
  },
];

// ============================================================================
// components/CreateFolderModal
// ============================================================================

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveFolder: (folder: FolderItem) => void;
}

const COLOR_OPTIONS = [
  { label: 'Tím Đông A', value: '#115e59' },
  { label: 'Xanh Lam', value: '#1368ce' },
  { label: 'Xanh Lá', value: '#059669' },
  { label: 'Cam Hổ Phách', value: '#d97706' },
  { label: 'Đỏ San Hô', value: '#e11d48' },
];

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onSaveFolder,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0].value);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newFolder: FolderItem = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      color: selectedColor,
      createdAt: 'Hôm nay',
    };

    onSaveFolder(newFolder);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-duo-swan flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: selectedColor }}
            >
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-duo-ink">Tạo thư mục mới</h3>
              <p className="text-[11px] text-duo-wolf">Lưu trữ các bài Quiz và Câu chuyện lịch sử</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-duo-hare hover:text-slate-700 hover:bg-duo-polar transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Tên thư mục <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Lịch sử lớp 7A1 - Kháng chiến 1285"
              className="input-duo w-full"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Mô tả (Tuỳ chọn)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú ngắn về mục đích hoặc chuyên đề của thư mục..."
              className="input-duo w-full resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-2">
              Màu biểu tượng
            </label>
            <div className="flex items-center gap-2.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setSelectedColor(c.value)}
                  className={`w-7 h-7 rounded-full transition transform ${
                    selectedColor === c.value
                      ? 'ring-2 ring-offset-2 ring-slate-800 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t-2 border-duo-swan flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-outline btn-normal-case !text-duo-wolf"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2 btn-3d btn-blue btn-normal-case disabled:opacity-50 rounded-xl text-xs font-bold transition"
            >
              Tạo thư mục
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// components/CreateQuizModal
// ============================================================================

interface CreateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderItem[];
  defaultFolderId?: string | null;
  onSaveQuiz: (quiz: QuizItem) => void;
  onOpenAiGenerator: () => void;
}

interface QuestionDraft {
  question: string;
  options: string[];
  correctIndex: number;
}

const CreateQuizModal: React.FC<CreateQuizModalProps> = ({
  isOpen,
  onClose,
  folders,
  defaultFolderId,
  onSaveQuiz,
  onOpenAiGenerator,
}) => {
  const [title, setTitle] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(defaultFolderId || '');
  const [status, setStatus] = useState<'draft' | 'ready'>('ready');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      question: 'Tại sao Trần Quốc Toản lại bóp nát quả cam tại Hội nghị Bình Than?',
      options: [
        'Vì uất ức do tuổi còn nhỏ không được vào dự bàn việc nước',
        'Vì quả cam bị hỏng',
        'Vì muốn chứng tỏ sức mạnh với các tướng',
        'Vì vua Trần giáng chức',
      ],
      correctIndex: 0,
    },
  ]);

  if (!isOpen) return null;

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: `Câu hỏi số ${questions.length + 1}...`,
        options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
        correctIndex: 0,
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleQuestionTextChange = (idx: number, text: string) => {
    const updated = [...questions];
    updated[idx].question = text;
    setQuestions(updated);
  };

  const handleOptionChange = (qIdx: number, optIdx: number, val: string) => {
    const updated = [...questions];
    updated[qIdx].options[optIdx] = val;
    setQuestions(updated);
  };

  const handleCorrectOptionChange = (qIdx: number, optIdx: number) => {
    const updated = [...questions];
    updated[qIdx].correctIndex = optIdx;
    setQuestions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newQuiz: QuizItem = {
      id: `quiz-${Date.now()}`,
      title: title.trim(),
      questionCount: questions.length,
      status,
      folderId: selectedFolderId || null,
      thumbnail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
      author: 'Thầy Nguyễn Văn Long',
      updatedAt: 'Vừa xong',
      questions: questions.map((q, idx) => ({
        id: `q-${idx}`,
        question: q.question,
        type: 'quiz',
        timeLimit: 20,
        points: 'standard',
        answerMode: 'single',
        options: q.options.map((opt, optIdx) => ({
          text: opt,
          isCorrect: optIdx === q.correctIndex,
        })),
      })),
    };

    onSaveQuiz(newQuiz);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden zoom-in-95 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-duo-swan flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-kh-purple">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-duo-ink">Tạo bộ câu hỏi Quiz mới</h3>
              <p className="text-[11px] text-duo-wolf">Bài học tương tác với câu hỏi trắc nghiệm</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-duo-hare hover:text-slate-700 hover:bg-duo-polar transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Quick AI Trigger Banner */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="text-xs text-purple-900">
              <span className="font-extrabold">Gợi ý:</span> Bạn có thể dùng Trình tạo AI để tự động tạo đề từ SGK Lịch sử 7 nhanh chóng!
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAiGenerator();
              }}
              className="px-3 py-1.5 btn-3d btn-purple btn-normal-case rounded-lg text-xs font-bold shrink-0 transition"
            >
              Dùng AI tạo đề
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Tiêu đề bài Quiz <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Bài 13: Ba lần kháng chiến chống Mông - Nguyên..."
              className="input-duo w-full"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-duo-hare" />
                Lưu vào thư mục
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="input-duo w-full"
              >
                <option value="">-- Chưa phân loại --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
                Trạng thái lưu
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'ready')}
                className="input-duo w-full"
              >
                <option value="ready">Sẵn sàng giảng dạy</option>
                <option value="draft">Bản nháp</option>
              </select>
            </div>
          </div>

          {/* Question List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-extrabold text-duo-ink">
                Danh sách câu hỏi ({questions.length})
              </h4>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex items-center gap-1 text-xs font-bold text-duo-blue hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm câu hỏi
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((q, qIdx) => (
                <div key={qIdx} className="bg-duo-polar border-2 border-duo-swan rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs text-purple-700">Câu {qIdx + 1}</span>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="p-1 text-duo-hare hover:text-red-600 transition"
                        title="Xoá câu hỏi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                    placeholder="Nhập nội dung câu hỏi..."
                    className="input-duo w-full"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border-2 text-xs transition ${
                          q.correctIndex === optIdx
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                            : 'bg-white border-duo-swan text-[#4b4b4b]'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`correct-${qIdx}`}
                          checked={q.correctIndex === optIdx}
                          onChange={() => handleCorrectOptionChange(qIdx, optIdx)}
                          className="accent-emerald-600 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                          className="flex-1 bg-transparent border-none outline-none text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t-2 border-duo-swan flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-outline btn-normal-case !text-duo-wolf"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2 btn-3d btn-blue btn-normal-case disabled:opacity-50 rounded-xl text-xs font-bold transition"
            >
              Lưu bài Quiz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// components/CreateStoryModal
// ============================================================================

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderItem[];
  defaultFolderId?: string | null;
  onSaveStory: (story: StoryItem) => void;
}

const SAMPLE_THUMBNAILS = [
  { label: 'Trần Quốc Toản', url: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=400&q=80' },
  { label: 'Điện Diên Hồng', url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=400&q=80' },
  { label: 'Bạch Đằng giang', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80' },
  { label: 'Thành Thăng Long', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80' },
];

const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  folders,
  defaultFolderId,
  onSaveStory,
}) => {
  const [title, setTitle] = useState('');
  const [readingTime, setReadingTime] = useState('1 phút đọc');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(defaultFolderId || '');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [thumbnail, setThumbnail] = useState(SAMPLE_THUMBNAILS[0].url);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newStory: StoryItem = {
      id: `story-${Date.now()}`,
      title: title.trim(),
      readingTime,
      status,
      folderId: selectedFolderId || null,
      thumbnail,
      author: 'Thầy Nguyễn Văn Long',
      updatedAt: 'Vừa xong',
      summary: summary.trim() || 'Tóm tắt câu chuyện lịch sử...',
      content: content.trim() || summary.trim() || 'Nội dung câu chuyện đang được cập nhật.',
      tags: ['Lịch sử 7', 'GDPT 2018'],
    };

    onSaveStory(newStory);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-duo-swan flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-kh-purple">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-duo-ink">Tạo câu chuyện mới</h3>
              <p className="text-[11px] text-duo-wolf">Kể lại câu chuyện lịch sử sinh động cho học sinh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-duo-hare hover:text-slate-700 hover:bg-duo-polar transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Tiêu đề câu chuyện <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Quả cam vua ban và lá cờ thêu sáu chữ vàng"
              className="input-duo w-full"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-duo-hare" />
                Thời gian đọc
              </label>
              <select
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                className="input-duo w-full"
              >
                <option value="1 phút đọc">1 phút đọc</option>
                <option value="2 phút đọc">2 phút đọc</option>
                <option value="3 phút đọc">3 phút đọc</option>
                <option value="5 phút đọc">5 phút đọc</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-duo-hare" />
                Lưu vào thư mục
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="input-duo w-full"
              >
                <option value="">-- Chưa phân loại --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Ảnh minh họa
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SAMPLE_THUMBNAILS.map((img) => (
                <div
                  key={img.url}
                  onClick={() => setThumbnail(img.url)}
                  className={`relative rounded-xl overflow-hidden cursor-pointer border-2 aspect-video transition ${
                    thumbnail === img.url
                      ? 'border-[#115e59] ring-2 ring-purple-300'
                      : 'border-duo-swan opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5 truncate">
                    {img.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Tóm tắt ngắn (1-2 câu)
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="VD: Hoài Văn Hầu vì tuổi nhỏ không được vào dự bàn việc quân, uất ức bóp nát quả cam..."
              className="input-duo w-full resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Nội dung chi tiết câu chuyện
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung câu chuyện lịch sử tại đây..."
              className="input-duo w-full"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t-2 border-duo-swan flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-duo-wolf font-medium">Trạng thái:</span>
              <button
                type="button"
                onClick={() => setStatus(status === 'draft' ? 'published' : 'draft')}
                className={`text-xs px-2.5 py-1 rounded-full font-bold transition ${
                  status === 'published'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="btn-3d btn-outline btn-normal-case !text-duo-wolf"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-5 py-2 btn-3d btn-blue btn-normal-case disabled:opacity-50 rounded-xl text-xs font-bold transition"
              >
                Lưu câu chuyện
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// components/MoveToFolderModal
// ============================================================================

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTitle: string;
  itemType: 'quiz' | 'story';
  folders: FolderItem[];
  currentFolderId?: string | null;
  onMoveToFolder: (folderId: string | null) => void;
}

const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  isOpen,
  onClose,
  itemTitle,
  itemType,
  folders,
  currentFolderId,
  onMoveToFolder,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId || null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-duo-swan flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-duo-blue">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-duo-ink">Chuyển vào thư mục</h3>
              <p className="text-[11px] text-duo-wolf truncate max-w-[240px]">
                {itemType === 'quiz' ? 'Quiz: ' : 'Câu chuyện: '} {itemTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-duo-hare hover:text-slate-700 hover:bg-duo-polar transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Folder List */}
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {/* Option: Không thuộc thư mục nào */}
          <div
            onClick={() => setSelectedFolderId(null)}
            className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition ${
              selectedFolderId === null
                ? 'border-blue-500 bg-blue-50/60'
                : 'border-duo-swan hover:bg-duo-polar'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-duo-wolf">
                <Folder className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-duo-ink">Không đưa vào thư mục (Chung)</span>
            </div>
            {selectedFolderId === null && <Check className="w-4 h-4 text-duo-blue" />}
          </div>

          {/* List of folders */}
          {folders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            return (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/60'
                    : 'border-duo-swan hover:bg-duo-polar'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: folder.color }}
                  >
                    <Folder className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-duo-ink">{folder.name}</h4>
                    {folder.description && (
                      <p className="text-[10px] text-duo-hare truncate max-w-[200px]">
                        {folder.description}
                      </p>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-duo-blue" />}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-duo-polar border-t-2 border-duo-swan flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-outline btn-normal-case !text-duo-wolf"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              onMoveToFolder(selectedFolderId);
              onClose();
            }}
            className="px-5 py-2 btn-3d btn-blue btn-normal-case rounded-xl text-xs font-bold transition"
          >
            Xác nhận chuyển
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// components/StoryReaderModal
// ============================================================================

interface StoryReaderModalProps {
  story: StoryItem | null;
  onClose: () => void;
}

const StoryReaderModal: React.FC<StoryReaderModalProps> = ({ story, onClose }) => {
  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden zoom-in-95 max-h-[88vh] flex flex-col">
        {/* Header Cover Banner */}
        <div className="relative h-48 sm:h-56 w-full bg-slate-900 shrink-0">
          <img
            src={story.thumbnail}
            alt={story.title}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badges on cover */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="bg-purple-900/80 text-purple-200 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 border-2 border-purple-500/30">
              <BookOpen className="w-3.5 h-3.5 text-purple-300" />
              Câu chuyện lịch sử
            </span>
            <span className="bg-black/70 text-white text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              {story.readingTime}
            </span>
          </div>

          {/* Title on cover */}
          <div className="absolute bottom-4 inset-x-6 text-white">
            <h2 className="text-xl font-extrabold tracking-tight leading-snug drop-shadow-md">
              {story.title}
            </h2>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-duo-hare">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-duo-hare" />
                {story.author}
              </span>
              <span>•</span>
              <span>{story.updatedAt}</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-5">
          {/* Summary Box */}
          {story.summary && (
            <div className="p-4 bg-purple-50/70 border-2 border-purple-200/60 rounded-xl text-xs text-purple-950 font-medium leading-relaxed italic">
              "{story.summary}"
            </div>
          )}

          {/* Full Content */}
          <div className="text-[#4b4b4b] text-sm leading-relaxed space-y-4 whitespace-pre-line font-serif">
            {story.content}
          </div>

          {/* Tags */}
          {story.tags && story.tags.length > 0 && (
            <div className="pt-4 border-t-2 border-duo-swan flex flex-wrap items-center gap-2">
              <span className="text-xs text-duo-hare font-bold flex items-center gap-1">
                <Tag className="w-3 h-3" /> Chủ đề:
              </span>
              {story.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-slate-100 text-[#4b4b4b] text-xs px-2.5 py-0.5 rounded-full font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-duo-polar border-t-2 border-duo-swan flex items-center justify-between shrink-0">
          <span className="text-xs text-duo-wolf font-medium">Học liệu GDPT 2018 • Đông A EDU</span>
          <button
            onClick={onClose}
            className="px-5 py-2 btn-3d btn-purple btn-normal-case rounded-xl text-xs font-bold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// views/QuizCreatorView
// ============================================================================

interface QuizCreatorViewProps {
  initialQuiz?: QuizItem | null;
  folders: FolderItem[];
  defaultFolderId?: string | null;
  onSaveQuiz: (quiz: QuizItem) => void;
  onExit: () => void;
  onOpenAiGenerator?: () => void;
  onShowToast: (msg: string) => void;
}

const DEFAULT_OPTIONS = [
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

const SAMPLE_HISTORICAL_IMAGES = [
  { label: 'Bình Than 1282', url: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=600&q=80' },
  { label: 'Diên Hồng 1285', url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600&q=80' },
  { label: 'Bạch Đằng 1288', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80' },
  { label: 'Chương Dương 1285', url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80' },
];

const QuizCreatorView: React.FC<QuizCreatorViewProps> = ({
  initialQuiz,
  folders,
  defaultFolderId,
  onSaveQuiz,
  onExit,
  onOpenAiGenerator,
  onShowToast,
}) => {
  // Quiz Info
  const [title, setTitle] = useState(initialQuiz?.title || 'Bài trắc nghiệm mới');
  const [folderId, setFolderId] = useState<string | null>(initialQuiz?.folderId || defaultFolderId || null);
  const [themeId, setThemeId] = useState<string>(initialQuiz?.themeId || 'standard');

  // Questions List
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initialQuiz?.questions && initialQuiz.questions.length > 0
      ? initialQuiz.questions
      : [
          {
            id: 'q-1',
            question: '',
            type: 'quiz',
            timeLimit: 20,
            points: 'standard',
            answerMode: 'single',
            options: [
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
            ],
          },
        ]
  );

  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'theme' | null>('properties');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const currentQ = questions[activeQuestionIndex] || questions[0];
  const currentTheme = quizThemes.find((t) => t.id === themeId) || quizThemes[0];

  // Handlers for Question Updates
  const updateCurrentQuestion = (partial: Partial<QuizQuestion>) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[activeQuestionIndex] = { ...updated[activeQuestionIndex], ...partial };
      return updated;
    });
  };

  const updateOptionText = (optionIndex: number, text: string) => {
    const newOptions = [...currentQ.options];
    newOptions[optionIndex] = { ...newOptions[optionIndex], text };
    updateCurrentQuestion({ options: newOptions });
  };

  const toggleOptionCorrect = (optionIndex: number) => {
    const newOptions = [...currentQ.options];
    if (currentQ.answerMode === 'single') {
      newOptions.forEach((opt, idx) => {
        opt.isCorrect = idx === optionIndex;
      });
    } else {
      newOptions[optionIndex].isCorrect = !newOptions[optionIndex].isCorrect;
    }
    updateCurrentQuestion({ options: newOptions });
  };

  const handleAddQuestion = (type: QuestionType = 'quiz') => {
    const newQ: QuizQuestion = {
      id: `q-${Date.now()}`,
      question: '',
      type,
      timeLimit: 20,
      points: 'standard',
      answerMode: 'single',
      options:
        type === 'true_false'
          ? [
              { text: 'Đúng', isCorrect: true },
              { text: 'Sai', isCorrect: false },
            ]
          : [
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
            ],
    };
    setQuestions((prev) => [...prev, newQ]);
    setActiveQuestionIndex(questions.length);
    onShowToast(`➕ Đã thêm câu hỏi ${questions.length + 1}`);
  };

  const handleDuplicateQuestion = () => {
    const cloned: QuizQuestion = {
      ...currentQ,
      id: `q-${Date.now()}`,
      question: `${currentQ.question} (Bản sao)`,
      options: currentQ.options.map((o) => ({ ...o })),
    };
    setQuestions((prev) => [...prev.slice(0, activeQuestionIndex + 1), cloned, ...prev.slice(activeQuestionIndex + 1)]);
    setActiveQuestionIndex(activeQuestionIndex + 1);
    onShowToast('📋 Đã nhân bản câu hỏi');
  };

  const handleDeleteQuestion = () => {
    if (questions.length <= 1) {
      onShowToast('⚠️ Bộ đề cần có ít nhất 1 câu hỏi.');
      return;
    }
    setQuestions((prev) => prev.filter((_, idx) => idx !== activeQuestionIndex));
    setActiveQuestionIndex(Math.max(0, activeQuestionIndex - 1));
    onShowToast('🗑️ Đã xoá câu hỏi');
  };

  const handleSave = () => {
    const readyQuiz: QuizItem = {
      id: initialQuiz?.id || `quiz-${Date.now()}`,
      title: title.trim() || 'Bài trắc nghiệm Lịch sử 7',
      questionCount: questions.length,
      status: 'ready',
      folderId,
      thumbnail: currentQ.mediaUrl || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
      author: 'Thầy Nguyễn Văn Long',
      updatedAt: 'Vừa xong',
      plays: initialQuiz?.plays || 0,
      themeId,
      questions,
    };
    onSaveQuiz(readyQuiz);
    onShowToast(`💾 Đã lưu thành công bài Quiz: "${readyQuiz.title}"`);
    onExit();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white text-duo-ink select-none overflow-hidden animate-in">
      {/* ======================================================== */}
      {/* 1. Header trên cùng (Khớp chuẩn Ảnh 1 & 2) */}
      {/* ======================================================== */}
      <header className="h-16 bg-white border-b-2 border-duo-swan px-4 sm:px-5 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Brand + Title input + Settings + Save status */}
        <div className="flex items-center gap-3.5">
          {/* Logo Đông A EDU */}
          <BrandLogo compact />
          <span className="chip bg-kh-purple text-white hidden md:inline-flex">TRÌNH SOẠN QUIZ</span>

          {/* Title Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề quiz..."
              className="px-3 py-1 bg-duo-polar hover:bg-duo-polar focus:bg-white border-2 border-duo-swan rounded-lg text-xs font-bold text-duo-ink focus:outline-none focus:ring-2 focus:ring-[#115e59]/20 w-64 md:w-80 transition"
            />
            <button
              onClick={() => {
                const nextFolder = folders[(folders.findIndex((f) => f.id === folderId) + 1) % folders.length];
                setFolderId(nextFolder ? nextFolder.id : null);
                onShowToast(nextFolder ? `📁 Đã chọn thư mục: ${nextFolder.name}` : '📁 Lưu vào Thư viện chung');
              }}
              className="btn-3d btn-outline btn-sm btn-normal-case !text-duo-wolf"
            >
              <span>Cài đặt</span>
            </button>
          </div>

          {/* Save Status / Folder indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-duo-wolf font-medium pl-2 border-l-2 border-duo-swan">
            <Check className="w-4 h-4 text-duo-green stroke-[3]" />
            <span>Lưu vào:</span>
            <span className="font-bold text-duo-ink">
              {folders.find((f) => f.id === folderId)?.name || 'Bản nháp của bạn'}
            </span>
          </div>
        </div>

        {/* Right: Upgrade + Preview + Exit + Save */}
        <div className="flex items-center gap-2.5">
          {/* Nâng cấp badge */}
          <div className="hidden sm:inline-flex chip bg-duo-gold-light text-duo-gold-dark !py-1 select-none">
            <span className="text-[10px]">★</span>
            <span>Nâng cấp</span>
          </div>

          {/* Xem trước */}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="btn-3d btn-outline btn-sm btn-icon !text-duo-wolf"
            title="Xem trước câu hỏi"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Thoát */}
          <button
            onClick={onExit}
            className="btn-3d btn-outline btn-sm !text-duo-wolf"
          >
            Thoát
          </button>

          {/* Lưu Quiz (Xanh dương như ảnh 1) */}
          <button
            onClick={handleSave}
            className="btn-3d btn-green btn-sm"
          >
            Lưu
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. Main Workspace (3 Cột: Cột Slide trái, Canvas giữa, Panel phải) */}
      {/* ======================================================== */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* ======================================================== */}
        {/* CỘT TRÁI: Danh sách câu hỏi (Slide Panel - Khớp Ảnh 1) */}
        {/* ======================================================== */}
        <div className="w-52 bg-duo-polar border-r-2 border-duo-swan flex flex-col justify-between shrink-0 select-none z-10">
          {/* Danh sách các câu hỏi dạng Thumbnail */}
          <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
            {questions.map((q, idx) => {
              const isActive = idx === activeQuestionIndex;
              return (
                <div
                  key={q.id}
                  onClick={() => setActiveQuestionIndex(idx)}
                  className={`p-2 rounded-xl cursor-pointer transition border-2 flex flex-col gap-1 relative group ${
                    isActive
                      ? 'border-duo-blue bg-duo-blue-light'
                      : 'border-duo-swan bg-white hover:border-duo-hare'
                  }`}
                >
                  {/* Tiêu đề nhỏ: 1 Trắc nghiệm */}
                  <div className="flex items-center justify-between text-[10px] font-bold text-duo-wolf">
                    <span>
                      {idx + 1} {q.type === 'quiz' ? 'Trắc nghiệm' : 'Đúng/Sai'}
                    </span>
                    {questions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (idx === activeQuestionIndex) handleDeleteQuestion();
                          else {
                            setQuestions((prev) => prev.filter((_, i) => i !== idx));
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-duo-hare hover:text-duo-red transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Thumbnail mô phỏng slide */}
                  <div className="aspect-video w-full rounded-md border-2 border-duo-swan bg-duo-polar flex flex-col justify-between p-1 overflow-hidden relative">
                    <span className="text-[8px] text-duo-hare font-medium truncate text-center block">
                      {q.question || 'Câu hỏi'}
                    </span>

                    <div className="flex items-center justify-between px-1">
                      <span className="text-[8px] bg-slate-200 text-[#4b4b4b] px-1 rounded font-bold">
                        {q.timeLimit}s
                      </span>
                      <ImageIcon className="w-2.5 h-2.5 text-duo-hare" />
                    </div>

                    {/* Vạch 4 đáp án thu nhỏ */}
                    <div className="grid grid-cols-2 gap-0.5">
                      <div className="h-1.5 bg-kh-red rounded-sm" />
                      <div className="h-1.5 bg-kh-blue rounded-sm" />
                      <div className="h-1.5 bg-kh-yellow rounded-sm" />
                      <div className="h-1.5 bg-kh-green rounded-sm" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nút Thêm câu hỏi & Nút Tạo AI (Khớp ảnh 1) */}
          <div className="p-2.5 border-t-2 border-duo-swan space-y-2">
            <button
              onClick={() => handleAddQuestion('quiz')}
              className="w-full btn-3d btn-blue btn-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Thêm</span>
            </button>

            <button
              onClick={() => {
                if (onOpenAiGenerator) {
                  onOpenAiGenerator();
                } else {
                  onShowToast('✨ Đang sinh câu hỏi tự động từ SGK Lịch sử 7...');
                  handleAddQuestion('quiz');
                }
              }}
              className="w-full btn-3d btn-outline btn-sm !text-duo-purple-dark"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tạo</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* KHU VỰC TRUNG TÂM: Canvas Soạn Thảo (Khớp Ảnh 1 & 2) */}
        {/* ======================================================== */}
        <div
          className={`flex-1 flex flex-col justify-between p-6 overflow-y-auto transition-all duration-300 ${currentTheme.bgGradient}`}
        >
          {/* Ô nhập câu hỏi chính trên cùng (Khớp ảnh 1) */}
          <div className="max-w-4xl w-full mx-auto">
            <div className="bg-white rounded-2xl p-3 shadow-[0_5px_0_rgba(0,0,0,0.18)]">
              <input
                type="text"
                value={currentQ.question}
                onChange={(e) => updateCurrentQuestion({ question: e.target.value })}
                placeholder="Bắt đầu nhập câu hỏi"
                className="w-full text-center text-lg md:text-xl font-extrabold text-duo-ink placeholder:text-duo-hare focus:outline-none py-2 px-4"
                autoFocus
              />
            </div>
          </div>

          {/* Ô trung tâm: Tìm và chèn phương tiện truyền thông (Khớp ảnh 1) */}
          <div className="max-w-lg w-full mx-auto my-auto py-4">
            {currentQ.mediaUrl ? (
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/60 aspect-video group">
                <img
                  src={currentQ.mediaUrl}
                  alt="Ảnh minh hoạ"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => updateCurrentQuestion({ mediaUrl: undefined })}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-lg transition"
                  title="Gỡ ảnh"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setShowMediaPicker(!showMediaPicker)}
                className="bg-white/85 hover:bg-white border-4 border-dashed border-white/60 hover:border-duo-purple rounded-3xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
              >
                {/* Icon phương tiện */}
                <div className="w-14 h-14 rounded-2xl bg-duo-purple text-white flex items-center justify-center transition shadow-[0_4px_0_#6b21a8] group-hover:scale-105">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h4 className="font-extrabold text-xs text-duo-ink mt-1">
                  Tìm và chèn phương tiện truyền thông
                </h4>
                <p className="text-[11px] text-duo-wolf">
                  <span className="text-duo-blue font-bold underline">Tải tệp tin lên</span> hoặc bấm để chọn ảnh sử liệu mẫu
                </p>
              </div>
            )}

            {/* Selector ảnh sử liệu mẫu khi mở */}
            {showMediaPicker && (
              <div className="bg-white rounded-2xl shadow-2xl border-2 border-duo-swan p-3 mt-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-duo-swan">
                  <span className="text-xs font-bold text-duo-ink">Kho ảnh Lịch sử 7</span>
                  <button
                    onClick={() => setShowMediaPicker(false)}
                    className="text-duo-hare hover:text-duo-wolf"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {SAMPLE_HISTORICAL_IMAGES.map((img) => (
                    <div
                      key={img.label}
                      onClick={() => {
                        updateCurrentQuestion({ mediaUrl: img.url });
                        setShowMediaPicker(false);
                      }}
                      className="cursor-pointer rounded-lg overflow-hidden border-2 border-duo-swan hover:border-purple-500 transition group"
                    >
                      <img src={img.url} alt={img.label} className="w-full h-12 object-cover group-hover:scale-105 transition" />
                      <span className="text-[9px] block text-center truncate py-0.5 bg-duo-polar text-duo-wolf font-bold">
                        {img.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ô đáp án kiểu Kahoot: tự tô màu khi đã nhập nội dung */}
          <div className="max-w-4xl w-full mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentQ.options.slice(0, currentQ.type === 'quiz' ? 4 : 2).map((opt, i) => {
                const style = ANSWER_STYLES[i % ANSWER_STYLES.length];
                const filled = (opt.text || '').trim().length > 0;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition ${opt.isCorrect ? 'ring-4 ring-duo-green ring-offset-2' : ''}`}
                    style={{ background: filled ? style.bg : '#fff', boxShadow: `0 5px 0 ${filled ? style.shadow : 'rgba(0,0,0,0.18)'}` }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: filled ? 'rgba(0,0,0,0.15)' : style.bg }}
                    >
                      <KahootShape shape={style.shape} size={22} />
                    </div>
                    <input
                      type="text"
                      value={opt.text || ''}
                      onChange={(e) => updateOptionText(i, e.target.value)}
                      placeholder={`Thêm đáp án ${i + 1}${i >= 2 ? ' (không bắt buộc)' : ''}`}
                      className={`flex-1 min-w-0 bg-transparent border-none text-sm md:text-base font-extrabold focus:outline-none ${
                        filled ? 'text-white placeholder:text-white/70' : 'text-duo-ink placeholder:text-duo-hare'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleOptionCorrect(i)}
                      className={`w-9 h-9 rounded-full border-4 flex items-center justify-center transition shrink-0 ${
                        opt.isCorrect
                          ? 'bg-duo-green border-white text-white'
                          : filled
                          ? 'border-white/70 hover:border-white'
                          : 'border-duo-swan hover:border-duo-hare'
                      }`}
                      title="Đánh dấu đáp án đúng"
                    >
                      {opt.isCorrect && <Check className="w-5 h-5 stroke-[4]" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CỘT PHẢI: Panel Thuộc tính & Giao diện (Khớp Ảnh 1 & 2) */}
        {/* ======================================================== */}
        {rightPanelTab !== null && (
          <div className="w-72 bg-white border-l-2 border-duo-swan flex flex-col justify-between shrink-0 select-none z-10">
            {/* Panel Thuộc tính câu hỏi (Khớp Ảnh 1) */}
            {rightPanelTab === 'properties' && (
              <div className="p-4 space-y-5 overflow-y-auto flex-1">
                <div className="flex items-center justify-between pb-2 border-b-2 border-duo-swan">
                  <h3 className="font-black text-base text-duo-ink">Thuộc tính câu hỏi</h3>
                  <button
                    onClick={() => setRightPanelTab(null)}
                    className="p-1 rounded text-duo-hare hover:text-duo-wolf"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 1. Loại câu hỏi */}
                <div>
                  <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-duo-hare" />
                    Loại câu hỏi
                  </label>
                  <select
                    value={currentQ.type}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      updateCurrentQuestion({
                        type: newType,
                        options:
                          newType === 'true_false'
                            ? [
                                { text: 'Đúng', isCorrect: true },
                                { text: 'Sai', isCorrect: false },
                              ]
                            : DEFAULT_OPTIONS.map((o) => ({ ...o })),
                      });
                    }}
                    className="input-duo w-full"
                  >
                    <option value="quiz">Trắc nghiệm (4 lựa chọn)</option>
                    <option value="true_false">Đúng / Sai (2 lựa chọn)</option>
                  </select>
                </div>

                {/* 2. Giới hạn thời gian */}
                <div>
                  <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-duo-hare" />
                    Giới hạn thời gian
                  </label>
                  <select
                    value={currentQ.timeLimit}
                    onChange={(e) => updateCurrentQuestion({ timeLimit: Number(e.target.value) })}
                    className="input-duo w-full"
                  >
                    <option value={5}>5 giây</option>
                    <option value={10}>10 giây</option>
                    <option value={20}>20 giây</option>
                    <option value={30}>30 giây</option>
                    <option value={60}>60 giây</option>
                    <option value={90}>90 giây</option>
                    <option value={120}>120 giây</option>
                  </select>
                  <button
                    onClick={() => {
                      setQuestions((prev) => prev.map((q) => ({ ...q, timeLimit: currentQ.timeLimit })));
                      onShowToast(`⏱️ Đã áp dụng ${currentQ.timeLimit}s cho tất cả câu hỏi!`);
                    }}
                    className="text-[11px] text-duo-blue hover:underline font-bold mt-1 inline-block"
                  >
                    Áp dụng cho tất cả câu hỏi
                  </button>
                </div>

                {/* 3. Điểm */}
                <div>
                  <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-duo-hare" />
                    Điểm
                  </label>
                  <select
                    value={currentQ.points}
                    onChange={(e) => updateCurrentQuestion({ points: e.target.value as PointsType })}
                    className="input-duo w-full"
                  >
                    <option value="standard">Tiêu chuẩn (1000 điểm)</option>
                    <option value="double">Gấp đôi điểm (2000 điểm)</option>
                    <option value="no_points">Không tính điểm</option>
                  </select>
                </div>

                {/* 4. Phương án trả lời */}
                <div>
                  <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5 text-duo-hare" />
                    Phương án trả lời
                  </label>
                  <select
                    value={currentQ.answerMode}
                    onChange={(e) => updateCurrentQuestion({ answerMode: e.target.value as AnswerMode })}
                    className="input-duo w-full"
                  >
                    <option value="single">Chọn một đáp án</option>
                    <option value="multiple">Chọn nhiều đáp án</option>
                  </select>
                </div>

                {/* Nút Xoá & Sao chép dưới cùng panel (Khớp ảnh 1) */}
                <div className="pt-4 border-t-2 border-duo-swan flex items-center gap-2">
                  <button
                    onClick={handleDeleteQuestion}
                    className="flex-1 btn-3d btn-outline btn-sm !text-duo-red"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xoá</span>
                  </button>
                  <button
                    onClick={handleDuplicateQuestion}
                    className="flex-1 btn-3d btn-outline btn-sm !text-duo-wolf"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </button>
                </div>
              </div>
            )}

            {/* Panel Giao diện / Chủ đề (Khớp Ảnh 2) */}
            {rightPanelTab === 'theme' && (
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="flex items-center justify-between pb-2 border-b-2 border-duo-swan">
                  <h3 className="font-black text-base text-duo-ink">Giao diện</h3>
                  <button
                    onClick={() => setRightPanelTab(null)}
                    className="p-1 rounded text-duo-hare hover:text-duo-wolf"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Nhóm Miễn phí */}
                <div>
                  <h4 className="text-[11px] font-extrabold text-duo-wolf uppercase tracking-wider mb-2">
                    Miễn phí
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {quizThemes
                      .filter((t) => t.category === 'free')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setThemeId(t.id)}
                          className={`rounded-xl overflow-hidden cursor-pointer border-2 transition relative ${
                            themeId === t.id ? 'border-duo-blue ring-2 ring-duo-blue-light' : 'border-duo-swan hover:border-duo-hare'
                          }`}
                        >
                          <div className={`h-12 w-full ${t.bgGradient}`} />
                          <span className="block text-center text-[10px] font-bold py-1 bg-white text-duo-ink">
                            {t.name}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Nhóm Chuyên nghiệp */}
                <div>
                  <h4 className="text-[11px] font-extrabold text-duo-wolf uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span>Chuyên nghiệp</span>
                    <span className="text-teal-600 font-bold">★</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {quizThemes
                      .filter((t) => t.category === 'pro')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setThemeId(t.id)}
                          className={`rounded-xl overflow-hidden cursor-pointer border-2 transition relative ${
                            themeId === t.id ? 'border-duo-blue ring-2 ring-duo-blue-light' : 'border-duo-swan hover:border-duo-hare'
                          }`}
                        >
                          <div className={`h-12 w-full ${t.bgGradient}`} />
                          <span className="block text-center text-[10px] font-bold py-1 bg-white text-duo-ink">
                            {t.name}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Thanh công cụ biểu tượng góc cực phải (Giao diện / Thuộc tính - Khớp Ảnh 1 & 2) */}
        <div className="w-12 bg-white border-l-2 border-duo-swan flex flex-col items-center py-3 gap-3 shrink-0 z-10">
          <button
            onClick={() => setRightPanelTab(rightPanelTab === 'theme' ? null : 'theme')}
            className={`p-2 rounded-xl transition flex flex-col items-center gap-1 ${
              rightPanelTab === 'theme' ? 'bg-duo-blue-light text-duo-blue' : 'text-duo-wolf hover:bg-duo-polar'
            }`}
            title="Giao diện"
          >
            <Palette className="w-4 h-4" />
            <span className="text-[9px] font-black">Giao diện</span>
          </button>

          <button
            onClick={() => setRightPanelTab(rightPanelTab === 'properties' ? null : 'properties')}
            className={`p-2 rounded-xl transition flex flex-col items-center gap-1 ${
              rightPanelTab === 'properties' ? 'bg-duo-blue-light text-duo-blue' : 'text-duo-wolf hover:bg-duo-polar'
            }`}
            title="Thuộc tính"
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[9px] font-black">Thuộc tính</span>
          </button>
        </div>
      </div>

      {/* Modal Xem trước (Preview) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/55">
          <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] zoom-in-95">
            <div className="px-5 py-3 bg-white border-b-2 border-duo-swan flex items-center justify-between">
              <span className="font-black text-sm text-duo-ink">Xem trước chế độ học sinh</span>
              <button onClick={() => setIsPreviewOpen(false)} className="text-duo-wolf hover:text-duo-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className={`p-8 flex-1 flex flex-col justify-between ${currentTheme.bgGradient}`}>
              <h3 className="text-xl font-black text-white text-center bg-black/30 p-4 rounded-2xl">
                {currentQ.question || 'Câu hỏi mẫu...'}
              </h3>
              <div className="grid grid-cols-2 gap-3 mt-6">
                {currentQ.options.map((opt, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl text-white font-extrabold text-sm flex items-center gap-3"
                    style={{ background: ANSWER_STYLES[i % 4].bg, color: ANSWER_STYLES[i % 4].fg, boxShadow: `0 5px 0 ${ANSWER_STYLES[i % 4].shadow}` }}
                  >
                    <KahootShape shape={ANSWER_STYLES[i % 4].shape} size={22} color={ANSWER_STYLES[i % 4].fg} />
                    {opt.text || `Đáp án ${i + 1}`}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// views/StoryCreatorView
// ============================================================================

interface StoryCreatorViewProps {
  initialStory?: StoryItem | null;
  folders: FolderItem[];
  defaultFolderId?: string | null;
  onSaveStory: (story: StoryItem) => void;
  onExit: () => void;
  onShowToast: (msg: string) => void;
}

const HISTORICAL_SAMPLE_IMAGES = [
  { label: 'Trần Quốc Toản', url: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=800&q=80' },
  { label: 'Điện Diên Hồng', url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=800&q=80' },
  { label: 'Bạch Đằng giang', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80' },
  { label: 'Kinh thành Thăng Long', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80' },
];

const StoryCreatorView: React.FC<StoryCreatorViewProps> = ({
  initialStory,
  folders,
  defaultFolderId,
  onSaveStory,
  onExit,
  onShowToast,
}) => {
  // Title & Basic Info
  const [title, setTitle] = useState(initialStory?.title || '');
  const [readingTime, setReadingTime] = useState(initialStory?.readingTime || '1 phút đọc');
  const [folderId, setFolderId] = useState<string | null>(initialStory?.folderId || defaultFolderId || null);

  // Blocks
  const [blocks, setBlocks] = useState<StoryBlock[]>(
    initialStory?.blocks && initialStory.blocks.length > 0
      ? initialStory.blocks
      : []
  );

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeBlockMenuPopup, setActiveBlockMenuPopup] = useState<string | null>(null);

  // AI Story Generator States
  const [isAiStoryModalOpen, setIsAiStoryModalOpen] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [aiCampaignName, setAiCampaignName] = useState('Kháng chiến chống Mông - Nguyên');
  const [aiStageTitle, setAiStageTitle] = useState('Hội nghị Diên Hồng');
  const [aiKeyEvent, setAiKeyEvent] = useState('Thượng hoàng hỏi kế sách, các bô lão đồng thanh hô vang ĐÁNH');

  const handleGenerateAiStory = async (stage = aiStageTitle, event = aiKeyEvent, campaign = aiCampaignName) => {
    setIsGeneratingStory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/story/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: campaign,
          stage_title: stage,
          key_event: event,
        }),
      });

      if (!response.ok) throw new Error(`Lỗi phản hồi máy chủ: ${response.status}`);
      const data = await response.json();

      if (!title.trim()) {
        setTitle(`Hào Khí Đông A: ${stage}`);
      }

      const narrativeBlock: StoryBlock = {
        id: `block-${Date.now()}-narrative`,
        type: 'text',
        width: 'normal',
        content: data.story_narrative || '',
      };

      const sampleImg = HISTORICAL_SAMPLE_IMAGES.find((img) =>
        stage.toLowerCase().includes(img.label.toLowerCase()) ||
        img.label.toLowerCase().includes(stage.toLowerCase())
      ) || HISTORICAL_SAMPLE_IMAGES[0];

      const imgBlock: StoryBlock = {
        id: `block-${Date.now() + 1}-img`,
        type: 'image',
        width: 'normal',
        mediaUrl: sampleImg.url,
        caption: `Tư liệu sử sách: ${data.historical_fact || stage}`,
      };

      const challengeBlock: StoryBlock = {
        id: `block-${Date.now() + 2}-challenge`,
        type: 'text',
        width: 'normal',
        content: `⚔️ THỬ THÁCH SỬ HỌC:\n${data.challenge_question || 'Hãy giải mã chiến lược của tiền nhân tại ải này!'}`,
      };

      setBlocks((prev) => [...prev, narrativeBlock, imgBlock, challengeBlock]);
      setIsAiStoryModalOpen(false);
      onShowToast(`✨ Đã kiến tạo thành công cốt truyện AI cho "${stage}"!`);
    } catch (err) {
      console.warn('Lỗi gọi API AI Story:', err);
      if (!title.trim()) {
        setTitle(`Hào Khí Đông A: ${stage}`);
      }
      const fallbackBlock: StoryBlock = {
        id: `block-${Date.now()}-fallback`,
        type: 'text',
        width: 'normal',
        content: `Đoàn quân Đại Việt tiến đến khu vực ${stage}. Tiếng trống đồng âm vang trong sương sớm, ngọn cờ thêu sáu chữ vàng phất phới bay theo chiều gió. Các bô lão và tướng sĩ một lòng sát cánh, quyết bảo vệ từng tấc đất thiêng liêng của Tổ quốc!`,
      };
      setBlocks((prev) => [...prev, fallbackBlock]);
      setIsAiStoryModalOpen(false);
      onShowToast(`✨ Đã nạp cốt truyện sử liệu cho "${stage}"!`);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Add Block Handler
  const handleAddBlock = (type: StoryBlockType, insertAfterIndex?: number) => {
    const newBlock: StoryBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      width: 'normal',
      content: type === 'text' ? '' : undefined,
      mediaUrl: undefined,
      caption: '',
      embedUrl: type === 'embed' ? '' : undefined,
    };

    if (insertAfterIndex !== undefined && insertAfterIndex >= 0) {
      setBlocks((prev) => [
        ...prev.slice(0, insertAfterIndex + 1),
        newBlock,
        ...prev.slice(insertAfterIndex + 1),
      ]);
    } else {
      setBlocks((prev) => [...prev, newBlock]);
    }

    setActiveBlockId(newBlock.id);
    setIsBlockMenuOpen(false);
    onShowToast(`➕ Đã thêm khối: ${getBlockTypeName(type)}`);
  };

  const updateBlock = (id: string, partial: Partial<StoryBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...partial } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setActiveBlockMenuPopup(null);
    onShowToast('🗑️ Đã xoá khối');
  };

  const duplicateBlock = (id: string) => {
    const target = blocks.find((b) => b.id === id);
    if (!target) return;
    const cloned: StoryBlock = {
      ...target,
      id: `block-${Date.now()}`,
    };
    const idx = blocks.findIndex((b) => b.id === id);
    setBlocks((prev) => [...prev.slice(0, idx + 1), cloned, ...prev.slice(idx + 1)]);
    setActiveBlockMenuPopup(null);
    onShowToast('📋 Đã nhân bản khối');
  };

  const getBlockTypeName = (type: StoryBlockType) => {
    switch (type) {
      case 'text':
        return 'Văn bản';
      case 'image':
        return 'Hình ảnh';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Âm thanh';
      case 'embed':
        return 'Nhúng';
    }
  };

  const handleSave = () => {
    // Generate text summary & content from blocks
    const textBlocks = blocks.filter((b) => b.type === 'text' && b.content);
    const fullText = textBlocks.map((b) => b.content).join('\n\n');
    const firstImg = blocks.find((b) => b.type === 'image' && b.mediaUrl)?.mediaUrl;

    const readyStory: StoryItem = {
      id: initialStory?.id || `story-${Date.now()}`,
      title: title.trim() || 'Câu chuyện lịch sử không tên',
      readingTime,
      status: 'published',
      folderId,
      thumbnail:
        firstImg ||
        initialStory?.thumbnail ||
        'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=400&q=80',
      author: 'Thầy Nguyễn Văn Long',
      updatedAt: 'Vừa xong',
      summary: fullText.slice(0, 150) || 'Câu chuyện kể về bài học lịch sử Hào khí Đông A.',
      content: fullText || 'Nội dung câu chuyện...',
      blocks,
      tags: ['Lịch sử 7', 'Hào khí Đông A'],
    };

    onSaveStory(readyStory);
    onShowToast(`💾 Đã lưu câu chuyện: "${readyStory.title}"`);
    onExit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col kahoot-bg text-white select-none overflow-hidden animate-in"
      onClick={() => {
        setActiveBlockMenuPopup(null);
      }}
    >
      {/* ======================================================== */}
      {/* 1. Header trên cùng (Khớp chuẩn Ảnh 3 & 5) */}
      {/* ======================================================== */}
      <header className="h-16 bg-white border-b-2 border-duo-swan px-4 sm:px-5 flex items-center justify-between gap-3 shrink-0 z-20 text-duo-ink">
        {/* Left: Brand + Back button */}
        <div className="flex items-center gap-3">
          <BrandLogo compact />

          <button
            onClick={onExit}
            className="btn-3d btn-outline btn-sm !text-duo-wolf"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
        </div>

        {/* Center: Title Input + Character count + Auto-saved status (Khớp ảnh 3, 5) */}
        <div className="flex items-center gap-3 flex-1 max-w-xl mx-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thêm tên câu chuyện"
              maxLength={100}
              className="input-duo w-full"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-duo-hare font-medium">
              {100 - title.length}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 text-[11px] text-duo-wolf font-medium">
            <Check className="w-4 h-4 text-duo-green stroke-[3]" />
            <span>Đã tự động lưu</span>
          </div>
        </div>

        {/* Right: Settings + Preview + Save button (Khớp ảnh 3, 5) */}
        <div className="flex items-center gap-2">
          {/* Settings button */}
          <button
            onClick={() => {
              if (folders.length > 0) {
                const nextIdx = (folders.findIndex((f) => f.id === folderId) + 1) % (folders.length + 1);
                const nextFolder = nextIdx < folders.length ? folders[nextIdx] : null;
                setFolderId(nextFolder ? nextFolder.id : null);
                onShowToast(nextFolder ? `📁 Đã lưu vào thư mục: ${nextFolder.name}` : '📁 Lưu vào Thư viện chung');
              } else {
                const times = ['1 phút đọc', '2 phút đọc', '3 phút đọc', '5 phút đọc'];
                const nextTime = times[(times.indexOf(readingTime) + 1) % times.length];
                setReadingTime(nextTime);
                onShowToast(`⏱️ Đã đặt thời gian đọc: ${nextTime}`);
              }
            }}
            className="btn-3d btn-outline btn-sm btn-icon !text-duo-wolf"
            title={`Cài đặt thư mục & thời gian đọc`}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Nút Tạo cốt truyện bằng AI Đông A */}
          <button
            onClick={() => setIsAiStoryModalOpen(true)}
            className="btn-3d btn-purple btn-sm"
            title="Sinh cốt truyện lịch sử tương tác bằng AI Đông A"
          >
            <Sparkles className="w-4 h-4 text-duo-gold" />
            <span className="hidden sm:inline">AI cốt truyện</span>
          </button>

          {/* Preview button */}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="btn-3d btn-outline btn-sm btn-icon !text-duo-wolf"
            title="Xem trước câu chuyện"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Save button (Xanh dương như ảnh 3, 5) */}
          <button
            onClick={handleSave}
            className="btn-3d btn-green btn-sm"
          >
            Lưu
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. Main Content Canvas (Nền tối #2e2e2e chuẩn Ảnh 3, 4, 5) */}
      {/* ======================================================== */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Nút vuông màu xanh dương [+] cố định bên trái (Khớp chuẩn Ảnh 3, 5) */}
        <div className="absolute left-4 top-8 z-30 flex items-start gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsBlockMenuOpen(!isBlockMenuOpen);
            }}
            className="btn-3d btn-white btn-icon"
            title="Thêm khối câu chuyện"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Menu trôi nổi "Thêm khối câu chuyện" (Khớp chuẩn Ảnh 3, 5) */}
          {isBlockMenuOpen && (
            <div
              className="w-52 bg-white rounded-2xl shadow-[0_5px_0_rgba(0,0,0,0.2)] p-2 text-duo-ink space-y-1 animate-pop-in"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-[11px] font-extrabold text-duo-wolf uppercase tracking-wider px-2 py-1">
                Thêm khối câu chuyện
              </h4>

              {/* 1. Văn bản */}
              <button
                onClick={() => handleAddBlock('text')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-extrabold text-duo-ink hover:bg-duo-polar transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-slate-200 text-[#4b4b4b] flex items-center justify-center">
                  <Type className="w-3.5 h-3.5" />
                </div>
                <span>Văn bản</span>
              </button>

              {/* 2. Hình ảnh */}
              <button
                onClick={() => handleAddBlock('image')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-extrabold text-duo-ink hover:bg-duo-polar transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-[#1368ce] text-white flex items-center justify-center">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <span>Hình ảnh</span>
              </button>

              {/* 3. Video */}
              <button
                onClick={() => handleAddBlock('video')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-extrabold text-duo-ink hover:bg-duo-polar transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-[#e21b3c] text-white flex items-center justify-center">
                  <Video className="w-3.5 h-3.5" />
                </div>
                <span>Video</span>
              </button>

              {/* 4. Âm thanh */}
              <button
                onClick={() => handleAddBlock('audio')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-extrabold text-duo-ink hover:bg-duo-polar transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-[#26890c] text-white flex items-center justify-center">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
                <span>Âm thanh</span>
              </button>

              {/* 5. Nhúng */}
              <button
                onClick={() => handleAddBlock('embed')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-extrabold text-duo-ink hover:bg-duo-polar transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-[#f77f00] text-white flex items-center justify-center">
                  <Code2 className="w-3.5 h-3.5" />
                </div>
                <span>Nhúng</span>
              </button>
            </div>
          )}
        </div>

        {/* Khung cuộn nội dung câu chuyện chính (Canvas) */}
        <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center">
          {/* ======================================================== */}
          {/* TRƯỜNG HỢP A: Khi chưa có khối nào (Khớp chuẩn Ảnh 3) */}
          {/* ======================================================== */}
          {blocks.length === 0 ? (
            <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-[0_6px_0_rgba(0,0,0,0.25)] text-duo-ink text-center my-auto animate-pop-in">
              <Mascot size={110} accessory="scholar" mood="excited" className="mx-auto mb-2" bob />
              <h3 className="text-2xl font-black text-duo-ink">Kể một câu chuyện lịch sử</h3>
              <p className="text-sm text-duo-wolf font-bold max-w-md mx-auto mt-1 mb-8 leading-relaxed">
                Bắt đầu thêm các khối nội dung như văn bản, hình ảnh hoặc video để kể một câu chuyện cho khán giả.
              </p>

              {/* Lưới 5 thẻ chọn khối lớn (Khớp chuẩn Ảnh 3) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                {/* 1. Văn bản */}
                <button
                  onClick={() => handleAddBlock('text')}
                  className="card-pressable p-5 flex flex-col items-center justify-center gap-2.5 group"
                >
                  <div className="w-12 h-10 rounded-xl bg-slate-200 text-[#4b4b4b] flex items-center justify-center group-hover:scale-105 transition">
                    <Type className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-duo-ink">Văn bản</span>
                </button>

                {/* 2. Hình ảnh */}
                <button
                  onClick={() => handleAddBlock('image')}
                  className="card-pressable p-5 flex flex-col items-center justify-center gap-2.5 group"
                >
                  <div className="w-12 h-10 rounded-xl bg-[#1368ce] text-white flex items-center justify-center group-hover:scale-105 transition">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-duo-ink">Hình ảnh</span>
                </button>

                {/* 3. Video */}
                <button
                  onClick={() => handleAddBlock('video')}
                  className="card-pressable p-5 flex flex-col items-center justify-center gap-2.5 group"
                >
                  <div className="w-12 h-10 rounded-xl bg-[#e21b3c] text-white flex items-center justify-center group-hover:scale-105 transition">
                    <Video className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-duo-ink">Video</span>
                </button>

                {/* 4. Âm thanh */}
                <button
                  onClick={() => handleAddBlock('audio')}
                  className="card-pressable p-5 flex flex-col items-center justify-center gap-2.5 group"
                >
                  <div className="w-12 h-10 rounded-xl bg-[#26890c] text-white flex items-center justify-center group-hover:scale-105 transition">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-duo-ink">Âm thanh</span>
                </button>

                {/* 5. Nhúng */}
                <button
                  onClick={() => handleAddBlock('embed')}
                  className="card-pressable p-5 flex flex-col items-center justify-center gap-2.5 group"
                >
                  <div className="w-12 h-10 rounded-xl bg-[#f77f00] text-white flex items-center justify-center group-hover:scale-105 transition">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-duo-ink">Nhúng</span>
                </button>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* TRƯỜNG HỢP B: Danh sách các khối đã chèn (Khớp Ảnh 4 & 5) */
            /* ======================================================== */
            <div className="w-full max-w-3xl space-y-6">
              {blocks.map((block, idx) => {
                const isActive = block.id === activeBlockId;

                return (
                  <div
                    key={block.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBlockId(block.id);
                    }}
                    className={`relative rounded-2xl transition group flex items-start gap-3 ${
                      isActive ? 'ring-2 ring-[#1368ce]' : ''
                    }`}
                  >
                    {/* Thân Khối (Block Body) */}
                    <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden text-duo-ink border-2 border-duo-swan">
                      {/* Drag Handle trên đầu khối (Khớp ảnh 4) */}
                      <div className="h-5 flex items-center justify-center bg-duo-polar cursor-grab text-duo-hare hover:text-slate-500">
                        <span className="text-xs tracking-widest font-black leading-none">=</span>
                      </div>

                      {/* ======================================================== */}
                      {/* KHỐI 1: VĂN BẢN (Text - Khớp Ảnh 4 & 5) */}
                      {/* ======================================================== */}
                      {block.type === 'text' && (
                        <div className="p-5">
                          <textarea
                            value={block.content || ''}
                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                            placeholder="Nhập câu chuyện"
                            rows={3}
                            className="w-full bg-transparent border-none resize-none text-sm md:text-base font-medium text-duo-ink placeholder:text-duo-hare focus:outline-none"
                            autoFocus={isActive}
                          />
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* KHỐI 2: HÌNH ẢNH (Image - Khớp Ảnh 5) */}
                      {/* ======================================================== */}
                      {block.type === 'image' && (
                        <div className="p-6 flex flex-col items-center justify-center">
                          {block.mediaUrl ? (
                            <div className="relative w-full rounded-xl overflow-hidden group/img">
                              <img
                                src={block.mediaUrl}
                                alt="Ảnh câu chuyện"
                                className="w-full max-h-80 object-cover rounded-xl"
                              />
                              <button
                                onClick={() => updateBlock(block.id, { mediaUrl: undefined })}
                                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-3 py-4 w-full">
                              <ImageIcon className="w-12 h-12 text-duo-hare stroke-[1.5]" />
                              <button
                                onClick={() => {
                                  const sample =
                                    HISTORICAL_SAMPLE_IMAGES[
                                      Math.floor(Math.random() * HISTORICAL_SAMPLE_IMAGES.length)
                                    ];
                                  updateBlock(block.id, { mediaUrl: sample.url, caption: sample.label });
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 btn-3d btn-blue btn-normal-case rounded-lg text-xs font-bold transition"
                              >
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                                <span>Thêm ảnh</span>
                              </button>
                            </div>
                          )}

                          <input
                            type="text"
                            value={block.caption || ''}
                            onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                            placeholder="Chú thích ảnh (tuỳ chọn)..."
                            className="w-full mt-2 text-center text-xs text-duo-wolf italic bg-transparent border-none focus:outline-none"
                          />
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* KHỐI 3: ÂM THANH (Audio - Khớp Ảnh 5) */}
                      {/* ======================================================== */}
                      {block.type === 'audio' && (
                        <div className="p-6 flex flex-col items-center justify-center gap-3">
                          <Volume2 className="w-10 h-10 text-duo-hare stroke-[1.5]" />
                          {block.mediaUrl ? (
                            <div className="w-full max-w-md bg-duo-polar border-2 border-duo-swan rounded-xl p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Music className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-bold text-duo-ink">
                                  {block.caption || 'Thuyết minh Hào khí Đông A.mp3'}
                                </span>
                              </div>
                              <button
                                onClick={() => updateBlock(block.id, { mediaUrl: undefined })}
                                className="text-duo-hare hover:text-red-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                updateBlock(block.id, {
                                  mediaUrl:
                                    'https://assets.mixkit.co/music/preview/mixkit-epic-heroic-cinematic-trailer-988.mp3',
                                  caption: 'Hào khí Đông A - Tiếng trống trận Diên Hồng',
                                });
                                onShowToast('🎵 Đã thêm đoạn âm thanh sử liệu mẫu!');
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 btn-3d btn-blue btn-normal-case rounded-lg text-xs font-bold transition"
                            >
                              <Plus className="w-4 h-4 stroke-[2.5]" />
                              <span>Thêm</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* KHỐI 4: VIDEO (Video) */}
                      {/* ======================================================== */}
                      {block.type === 'video' && (
                        <div className="p-6 flex flex-col items-center justify-center gap-3">
                          <Video className="w-10 h-10 text-duo-hare stroke-[1.5]" />
                          <button
                            onClick={() => {
                              updateBlock(block.id, {
                                mediaUrl: 'https://www.youtube.com/embed/sample',
                                caption: 'Phim tư liệu: 3 lần kháng chiến chống Nguyên Mông',
                              });
                              onShowToast('🎬 Đã liên kết video tư liệu lịch sử!');
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 btn-3d btn-blue btn-normal-case rounded-lg text-xs font-bold transition"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>Thêm video</span>
                          </button>
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* KHỐI 5: NỘI DUNG NHÚNG (Embed - Khớp Ảnh 5) */}
                      {/* ======================================================== */}
                      {block.type === 'embed' && (
                        <div className="p-6 text-center space-y-3">
                          <span className="text-xs font-extrabold text-[#4b4b4b] block">
                            Nội dung nhúng
                          </span>

                          {/* Logo K! / Đông A EDU (Khớp ảnh 5) */}
                          <div className="text-2xl font-black text-kh-purple">K!</div>

                          <div className="flex items-center gap-2 max-w-md mx-auto">
                            <input
                              type="text"
                              value={block.embedUrl || ''}
                              onChange={(e) => updateBlock(block.id, { embedUrl: e.target.value })}
                              placeholder="Dán link dẫn đến nội dung"
                              className="input-duo flex-1"
                            />
                            <button
                              onClick={() => onShowToast('🔗 Đã xác nhận liên kết nhúng!')}
                              className="w-8 h-8 rounded-lg bg-[#1368ce] text-white flex items-center justify-center shrink-0 hover:bg-[#0f52a5] transition"
                            >
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            </button>
                            <span className="text-xs text-duo-hare font-medium">hoặc</span>
                            <button
                              onClick={() => onShowToast('🌐 Mở danh mục học liệu số liên kết.')}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-[#4b4b4b] rounded-lg text-xs font-bold transition whitespace-nowrap"
                            >
                              Khám phá nội dung
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Thanh công cụ dọc nổi bên phải của khối (Khớp chuẩn Ảnh 4) */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {/* Nút 1: 3 Chấm (Menu: Xoá, Nhân bản) */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveBlockMenuPopup(activeBlockMenuPopup === block.id ? null : block.id);
                          }}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-duo-polar text-duo-wolf border-2 border-duo-swan flex items-center justify-center transition"
                          title="Tuỳ chọn"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Popup dropdown */}
                        {activeBlockMenuPopup === block.id && (
                          <div
                            className="absolute left-8 top-0 w-36 bg-white border-2 border-duo-swan rounded-xl shadow-xl py-1 z-30 text-xs text-[#4b4b4b] animate-in fade-in zoom-in-95"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => duplicateBlock(block.id)}
                              className="w-full px-3 py-1.5 text-left hover:bg-duo-polar flex items-center gap-2 font-bold"
                            >
                              <Copy className="w-3.5 h-3.5 text-duo-wolf" />
                              <span>Nhân bản</span>
                            </button>
                            <button
                              onClick={() => removeBlock(block.id)}
                              className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xoá khối</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Nút 2: Độ rộng (Mở rộng / Thu nhỏ) */}
                      <button
                        onClick={() =>
                          updateBlock(block.id, {
                            width: block.width === 'wide' ? 'normal' : 'wide',
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-white hover:bg-duo-polar text-duo-wolf border-2 border-duo-swan flex items-center justify-center transition"
                        title="Độ rộng khối"
                      >
                        {block.width === 'wide' ? (
                          <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                          <Maximize2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Nút 3: Thêm khối bên dưới [+] */}
                      <button
                        onClick={() => handleAddBlock('text', idx)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-duo-polar text-duo-wolf border-2 border-duo-swan flex items-center justify-center transition"
                        title="Thêm khối bên dưới"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal AI Soạn Cốt Truyện Đông A */}
      {isAiStoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border-2 border-duo-swan flex flex-col text-duo-ink">
            {/* Header */}
            <div className="bg-duo-purple text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border-2 border-amber-400/40 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Trợ lý AI Soạn Cốt Truyện Đông A</h3>
                  <p className="text-[11px] text-indigo-200">
                    Tự động tạo mạch truyện, hình ảnh & câu hỏi thử thách từ dữ liệu vàng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiStoryModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#4b4b4b] block mb-1">Tên Chiến dịch:</label>
                <input
                  type="text"
                  value={aiCampaignName}
                  onChange={(e) => setAiCampaignName(e.target.value)}
                  className="input-duo w-full"
                />
              </div>

              <div>
                <label className="font-bold text-[#4b4b4b] block mb-1">Tên Ải / Địa danh lịch sử:</label>
                <input
                  type="text"
                  value={aiStageTitle}
                  onChange={(e) => setAiStageTitle(e.target.value)}
                  className="input-duo w-full"
                />
              </div>

              <div>
                <label className="font-bold text-[#4b4b4b] block mb-1">Sự kiện lịch sử then chốt:</label>
                <textarea
                  value={aiKeyEvent}
                  onChange={(e) => setAiKeyEvent(e.target.value)}
                  rows={2}
                  className="input-duo w-full resize-none"
                />
              </div>

              {/* Gợi ý chặng nhanh */}
              <div>
                <span className="font-bold text-duo-wolf text-[10px] uppercase block mb-1.5">
                  Chọn nhanh sự kiện tiêu biểu:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    { stage: 'Hội nghị Diên Hồng (1285)', event: 'Thượng hoàng hỏi đánh hay hòa, các bô lão đồng thanh hô vang ĐÁNH!' },
                    { stage: 'Trận cọc Bạch Đằng (1288)', event: 'Bố trí cọc ngầm lim nhử thủy quân Ô Mã Nhi khi triều rút' },
                    { stage: 'Phục kích Vân Đồn (1288)', event: 'Trần Khánh Dư đánh chìm đoàn 17 vạn thạch thuyền lương Trương Văn Hổ' },
                    { stage: 'Vườn không nhà trống (1258)', event: 'Triệt thoái kinh thành Thăng Long khiến giặc rơi vào cảnh đói kiệt' },
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => {
                        setAiStageTitle(preset.stage);
                        setAiKeyEvent(preset.event);
                      }}
                      className="text-left p-2 rounded-xl bg-duo-polar hover:bg-purple-50 hover:border-purple-200 border-2 border-duo-swan text-[#4b4b4b] transition"
                    >
                      <strong className="block text-duo-ink font-bold truncate">{preset.stage}</strong>
                      <span className="text-[10px] text-duo-wolf line-clamp-1">{preset.event}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-duo-polar border-t-2 border-duo-swan flex items-center justify-end gap-2">
              <button
                onClick={() => setIsAiStoryModalOpen(false)}
                className="px-4 py-2 text-duo-wolf hover:bg-slate-200 rounded-xl text-xs font-bold transition"
              >
                Hủy
              </button>
              <button
                onClick={() => handleGenerateAiStory()}
                disabled={isGeneratingStory}
                className="flex items-center gap-2 px-5 py-2 btn-3d btn-purple btn-normal-case disabled:opacity-60 rounded-xl text-xs font-bold transition"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingStory ? 'animate-spin' : ''}`} />
                <span>{isGeneratingStory ? 'Đang tạo cốt truyện...' : 'Tạo cốt truyện'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem trước (Preview câu chuyện) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/55">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border-2 border-duo-swan flex flex-col max-h-[85vh] text-duo-ink">
            <div className="px-5 py-3 bg-white border-b-2 border-duo-swan flex items-center justify-between">
              <span className="font-extrabold text-xs text-[#4b4b4b]">Xem trước câu chuyện</span>
              <button onClick={() => setIsPreviewOpen(false)} className="text-duo-wolf hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto space-y-5">
              <h2 className="text-xl font-extrabold text-duo-ink leading-snug">
                {title || 'Tiêu đề câu chuyện'}
              </h2>
              {blocks.map((b) => (
                <div key={b.id}>
                  {b.type === 'text' && (
                    <p className="text-sm text-[#4b4b4b] leading-relaxed whitespace-pre-line font-serif">
                      {b.content}
                    </p>
                  )}
                  {b.type === 'image' && b.mediaUrl && (
                    <div className="my-2">
                      <img src={b.mediaUrl} alt="" className="rounded-xl w-full max-h-72 object-cover" />
                      {b.caption && (
                        <p className="text-xs text-center text-duo-wolf mt-1">{b.caption}</p>
                      )}
                    </div>
                  )}
                  {b.type === 'audio' && b.mediaUrl && (
                    <div className="p-3 bg-slate-100 rounded-xl flex items-center gap-2">
                      <Music className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold">{b.caption}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// views/LibraryView
// ============================================================================

interface LibraryViewProps {
  onShowToast: (msg: string) => void;
  onOpenAiQuizModal: () => void;
  onLaunchLesson: (title: string) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({
  onShowToast,
  onOpenAiQuizModal,
  onLaunchLesson,
}) => {
  // Main Data States
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders);
  const [quizzes, setQuizzes] = useState<QuizItem[]>(initialQuizzes);
  const [stories, setStories] = useState<StoryItem[]>(initialStories);
  const [courses] = useState<CourseItem[]>(initialCourses);
  const [trashedItems, setTrashedItems] = useState<{ id: string; title: string; type: 'quiz' | 'story' }[]>([]);

  // Navigation & Sub-Sidebar States
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('quiz');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isFoldersExpanded, setIsFoldersExpanded] = useState(true);

  // Filter & View States
  const [quizTab, setQuizTab] = useState<'recent' | 'draft' | 'favorite'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [folderTypeFilter, setFolderTypeFilter] = useState<'all' | 'quiz' | 'story'>('all');

  // Modal & Creator States
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [isQuizCreatorOpen, setIsQuizCreatorOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizItem | null>(null);
  const [isStoryCreatorOpen, setIsStoryCreatorOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<StoryItem | null>(null);
  const [readingStory, setReadingStory] = useState<StoryItem | null>(null);
  const [movingItem, setMovingItem] = useState<{
    id: string;
    title: string;
    type: 'quiz' | 'story';
    folderId?: string | null;
  } | null>(null);

  // Active 3-dots Menu ID
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Handler: Add Folder
  const handleSaveFolder = (newFolder: FolderItem) => {
    setFolders((prev) => [newFolder, ...prev]);
    onShowToast(`📁 Đã tạo thư mục mới: "${newFolder.name}"`);
    setActiveCategory('folders');
    setSelectedFolderId(newFolder.id);
  };

  // Handler: Add or Update Story
  const handleSaveStory = (newStory: StoryItem) => {
    setStories((prev) => {
      const exists = prev.some((s) => s.id === newStory.id);
      if (exists) {
        return prev.map((s) => (s.id === newStory.id ? newStory : s));
      }
      return [newStory, ...prev];
    });
    onShowToast(`📖 Đã lưu câu chuyện: "${newStory.title}"`);
    setActiveCategory('story');
    setIsStoryCreatorOpen(false);
    setEditingStory(null);
  };

  // Handler: Add or Update Quiz
  const handleSaveQuiz = (newQuiz: QuizItem) => {
    setQuizzes((prev) => {
      const exists = prev.some((q) => q.id === newQuiz.id);
      if (exists) {
        return prev.map((q) => (q.id === newQuiz.id ? newQuiz : q));
      }
      return [newQuiz, ...prev];
    });
    onShowToast(`🎯 Đã lưu bộ quiz: "${newQuiz.title}"`);
    setActiveCategory('quiz');
    setIsQuizCreatorOpen(false);
    setEditingQuiz(null);
  };

  // Handler: Move item to folder
  const handleMoveItem = (targetFolderId: string | null) => {
    if (!movingItem) return;

    if (movingItem.type === 'quiz') {
      setQuizzes((prev) =>
        prev.map((q) => (q.id === movingItem.id ? { ...q, folderId: targetFolderId } : q))
      );
    } else {
      setStories((prev) =>
        prev.map((s) => (s.id === movingItem.id ? { ...s, folderId: targetFolderId } : s))
      );
    }

    const folderName = folders.find((f) => f.id === targetFolderId)?.name || 'Thư viện chung';
    onShowToast(`📦 Đã chuyển "${movingItem.title}" vào: ${folderName}`);
    setMovingItem(null);
  };

  // Handler: Trash item
  const handleTrashItem = (id: string, title: string, type: 'quiz' | 'story') => {
    if (type === 'quiz') {
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
    } else {
      setStories((prev) => prev.filter((s) => s.id !== id));
    }
    setTrashedItems((prev) => [{ id, title, type }, ...prev]);
    onShowToast(`🗑️ Đã chuyển "${title}" vào Thùng rác`);
    setActiveMenuId(null);
  };

  // Handler: Restore item
  const handleRestoreItem = (item: { id: string; title: string; type: 'quiz' | 'story' }) => {
    setTrashedItems((prev) => prev.filter((i) => i.id !== item.id));
    if (item.type === 'quiz') {
      setQuizzes((prev) => [
        {
          id: item.id,
          title: item.title,
          questionCount: 5,
          status: 'ready',
          thumbnail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
          author: 'Thầy Nguyễn Văn Long',
          updatedAt: 'Vừa khôi phục',
        },
        ...prev,
      ]);
    } else {
      setStories((prev) => [
        {
          id: item.id,
          title: item.title,
          readingTime: '1 phút đọc',
          status: 'published',
          thumbnail: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=400&q=80',
          author: 'Thầy Nguyễn Văn Long',
          updatedAt: 'Vừa khôi phục',
          summary: 'Câu chuyện đã được khôi phục từ thùng rác.',
          content: 'Nội dung câu chuyện lịch sử...',
        },
        ...prev,
      ]);
    }
    onShowToast(`♻️ Đã khôi phục "${item.title}"`);
  };

  // Filtered Quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes
      .filter((q) => {
        if (quizTab === 'draft') return q.status === 'draft';
        if (quizTab === 'favorite') return q.status === 'favorite';
        return true;
      })
      .filter((q) => {
        if (!searchQuery) return true;
        return q.title.toLowerCase().includes(searchQuery.toLowerCase());
      });
  }, [quizzes, quizTab, searchQuery]);

  // Filtered Stories
  const filteredStories = useMemo(() => {
    let list = stories.filter((s) => {
      if (!searchQuery) return true;
      return (
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.summary.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    if (sortOrder === 'oldest') {
      list = [...list].reverse();
    }
    return list;
  }, [stories, searchQuery, sortOrder]);

  // Current Selected Folder
  const currentFolder = useMemo(() => {
    return folders.find((f) => f.id === selectedFolderId) || null;
  }, [folders, selectedFolderId]);

  // Items in Selected Folder
  const folderQuizzes = useMemo(() => {
    if (!selectedFolderId) return [];
    return quizzes.filter((q) => q.folderId === selectedFolderId);
  }, [quizzes, selectedFolderId]);

  const folderStories = useMemo(() => {
    if (!selectedFolderId) return [];
    return stories.filter((s) => s.folderId === selectedFolderId);
  }, [stories, selectedFolderId]);

  const folderTotalItems = folderQuizzes.length + folderStories.length;

  if (isQuizCreatorOpen) {
    return (
      <QuizCreatorView
        initialQuiz={editingQuiz}
        folders={folders}
        defaultFolderId={selectedFolderId}
        onSaveQuiz={handleSaveQuiz}
        onExit={() => {
          setIsQuizCreatorOpen(false);
          setEditingQuiz(null);
        }}
        onOpenAiGenerator={onOpenAiQuizModal}
        onShowToast={onShowToast}
      />
    );
  }

  if (isStoryCreatorOpen) {
    return (
      <StoryCreatorView
        initialStory={editingStory}
        folders={folders}
        defaultFolderId={selectedFolderId}
        onSaveStory={handleSaveStory}
        onExit={() => {
          setIsStoryCreatorOpen(false);
          setEditingStory(null);
        }}
        onShowToast={onShowToast}
      />
    );
  }

  return (
    <div className="flex-1 flex min-h-0 bg-white overflow-hidden" onClick={() => setActiveMenuId(null)}>
      {/* ======================================================== */}
      {/* 1. Sub-Sidebar bên trái Thư viện (Khớp chuẩn Ảnh 1, 2, 3) */}
      {/* ======================================================== */}
      <div className="w-60 bg-white border-r-2 border-duo-swan flex flex-col justify-between shrink-0 select-none">
        <div className="p-3 space-y-1">
          {/* Mục 1: Quiz (Kahoot style) */}
          <button
            onClick={() => {
              setActiveCategory('quiz');
              setSelectedFolderId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 text-sm font-extrabold transition ${
              activeCategory === 'quiz' && selectedFolderId === null
                ? 'bg-duo-blue-light text-duo-blue border-[#7dd3fc]'
                : 'text-duo-wolf border-transparent hover:bg-duo-polar'
            }`}
          >
            {/* Icon 4 ô vuông Kahoot style */}
            <div className="w-5 h-5 grid grid-cols-2 gap-0.5 shrink-0">
              <div className="bg-[#e21b3c] rounded-[2px]" />
              <div className="bg-[#1368ce] rounded-[2px]" />
              <div className="bg-[#d89e00] rounded-[2px]" />
              <div className="bg-[#26890c] rounded-[2px]" />
            </div>
            <span>Quiz</span>
            <span className="ml-auto text-[11px] font-semibold text-duo-hare">
              {quizzes.length}
            </span>
          </button>

          {/* Mục 2: Câu chuyện (Story) */}
          <button
            onClick={() => {
              setActiveCategory('story');
              setSelectedFolderId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 text-sm font-extrabold transition ${
              activeCategory === 'story' && selectedFolderId === null
                ? 'bg-duo-blue-light text-duo-blue border-[#7dd3fc]'
                : 'text-duo-wolf border-transparent hover:bg-duo-polar'
            }`}
          >
            <BookOpen className="w-4 h-4 text-duo-wolf shrink-0" />
            <span>Câu chuyện</span>
            <span className="ml-auto text-[11px] font-semibold text-duo-hare">
              {stories.length}
            </span>
          </button>

          {/* Mục 3: Khoá học */}
          <button
            onClick={() => {
              setActiveCategory('course');
              setSelectedFolderId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 text-sm font-extrabold transition ${
              activeCategory === 'course' && selectedFolderId === null
                ? 'bg-duo-blue-light text-duo-blue border-[#7dd3fc]'
                : 'text-duo-wolf border-transparent hover:bg-duo-polar'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-duo-wolf shrink-0" />
            <span>Khoá học</span>
            <span className="ml-auto text-[11px] font-semibold text-duo-hare">
              {courses.length}
            </span>
          </button>

          {/* Đường kẻ phân cách (Divider) */}
          <div className="pt-2 pb-1">
            <hr className="border-duo-swan" />
          </div>

          {/* Mục: Thư mục của bạn (Có nút + tạo folder theo yêu cầu) */}
          <div>
            <div className="flex items-center justify-between px-3 py-2 rounded-2xl text-sm font-extrabold text-duo-wolf hover:bg-duo-polar transition group">
              <div
                onClick={() => {
                  setActiveCategory('folders');
                  setSelectedFolderId(null);
                }}
                className="flex items-center gap-2.5 flex-1 cursor-pointer"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFoldersExpanded(!isFoldersExpanded);
                  }}
                  className="text-duo-hare hover:text-duo-wolf"
                >
                  {isFoldersExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                <Folder className="w-4 h-4 text-duo-wolf" />
                <span className="truncate">Thư mục của bạn</span>
              </div>

              {/* Nút + tạo thư mục ngay trên dòng menu */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreateFolderOpen(true);
                }}
                className="w-5 h-5 rounded hover:bg-duo-swan text-duo-wolf hover:text-duo-ink flex items-center justify-center transition"
                title="Tạo thư mục mới"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            {/* Danh sách các thư mục con đã tạo */}
            {isFoldersExpanded && (
              <div className="pl-6 pr-1 space-y-0.5 mt-1">
                {folders.map((folder) => {
                  const isSelected = activeCategory === 'folders' && selectedFolderId === folder.id;
                  const count =
                    quizzes.filter((q) => q.folderId === folder.id).length +
                    stories.filter((s) => s.folderId === folder.id).length;

                  return (
                    <button
                      key={folder.id}
                      onClick={() => {
                        setActiveCategory('folders');
                        setSelectedFolderId(folder.id);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition text-left group ${
                        isSelected
                          ? 'bg-duo-blue-light text-duo-blue font-bold'
                          : 'text-duo-wolf hover:bg-duo-polar'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: folder.color }}
                        />
                        <span className="truncate text-[11px]">{folder.name}</span>
                      </div>
                      <span className="text-[10px] text-duo-hare font-semibold">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Đường kẻ phân cách */}
          <div className="pt-2 pb-1">
            <hr className="border-duo-swan" />
          </div>

          {/* Mục: Thùng rác */}
          <button
            onClick={() => {
              setActiveCategory('trash');
              setSelectedFolderId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 text-sm font-extrabold transition ${
              activeCategory === 'trash'
                ? 'bg-duo-red-light text-duo-red-dark border-duo-red/40'
                : 'text-duo-wolf border-transparent hover:bg-duo-polar'
            }`}
          >
            <Trash2 className="w-4 h-4 text-duo-wolf shrink-0" />
            <span>Thùng rác</span>
            {trashedItems.length > 0 && (
              <span className="ml-auto chip bg-duo-red text-white">
                {trashedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Nút hỗ trợ nhanh bên dưới sub-sidebar */}
        <div className="p-3 border-t-2 border-duo-swan">
          <div className="bg-duo-purple-light rounded-2xl p-3 text-center">
            <span className="text-xs font-black text-duo-purple-dark block mb-2">
              Soạn đề tự động?
            </span>
            <button
              onClick={onOpenAiQuizModal}
              className="w-full btn-3d btn-purple btn-sm"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Dùng AI tạo đề</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. Vùng hiển thị nội dung chính bên phải */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-white">
        {/* ======================================================== */}
        {/* VIEW A: Quiz (Khớp chuẩn Ảnh 1) */}
        {/* ======================================================== */}
        {activeCategory === 'quiz' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
            {/* Thanh Tab: Gần đây, Bản nháp, Yêu thích + Công tắc Grid/List */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-duo-swan pb-3">
              <div className="flex items-center gap-1 bg-duo-polar border-2 border-duo-swan p-1 rounded-2xl">
                <button
                  onClick={() => setQuizTab('recent')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    quizTab === 'recent'
                      ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                      : 'text-duo-hare hover:text-duo-wolf'
                  }`}
                >
                  Gần đây
                </button>
                <button
                  onClick={() => setQuizTab('draft')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    quizTab === 'draft'
                      ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                      : 'text-duo-hare hover:text-duo-wolf'
                  }`}
                >
                  Bản nháp
                </button>
                <button
                  onClick={() => setQuizTab('favorite')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    quizTab === 'favorite'
                      ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                      : 'text-duo-hare hover:text-duo-wolf'
                  }`}
                >
                  Yêu thích
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-duo-hare" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm bài quiz..."
                    className="input-duo w-full pl-9 pr-3"
                  />
                </div>

                {/* View toggle Grid / List */}
                <div className="flex items-center border-2 border-duo-swan rounded-xl p-0.5 bg-duo-polar">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'grid' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare hover:text-duo-wolf'
                    }`}
                    title="Chế độ lưới"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'list' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare hover:text-duo-wolf'
                    }`}
                    title="Chế độ danh sách"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Danh sách Quiz Cards (Khớp ảnh 1) */}
            {filteredQuizzes.length === 0 ? (
              <div className="text-center py-16 bg-duo-polar border-2 border-dashed border-duo-swan rounded-2xl">
                <FileQuestion className="w-12 h-12 text-duo-hare mx-auto mb-3" />
                <h4 className="font-bold text-sm text-[#4b4b4b]">Chưa tìm thấy bài quiz nào</h4>
                <p className="text-xs text-duo-hare mt-1 mb-4">
                  Bấm nút "Tạo" hoặc "Tạo câu hỏi AI" để bắt đầu soạn đề.
                </p>
                <button
                  onClick={() => {
                    setEditingQuiz(null);
                    setIsQuizCreatorOpen(true);
                  }}
                  className="btn-3d btn-blue"
                >
                  Tạo bài Quiz mới
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="card-pressable !cursor-default overflow-visible flex flex-col group relative"
                  >
                    {/* Thumbnail Image Container */}
                    <div className="relative aspect-video w-full bg-duo-polar overflow-hidden rounded-t-[18px]">
                      <img
                        src={quiz.thumbnail}
                        alt={quiz.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />

                      {/* Header badge inside image */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        {quiz.status === 'draft' ? (
                          <span className="chip bg-duo-red text-white uppercase">
                            Bản nháp
                          </span>
                        ) : (
                          <span className="chip bg-duo-green text-white uppercase">
                            Sẵn sàng
                          </span>
                        )}
                      </div>

                      {/* Question count pill on bottom-right of image */}
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        {quiz.questionCount} câu hỏi
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Folder tag if assigned */}
                        {quiz.folderId && (
                          <span className="chip bg-duo-purple-light text-duo-purple-dark mb-1.5 max-w-full">
                            <Folder className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{folders.find((f) => f.id === quiz.folderId)?.name}</span>
                          </span>
                        )}

                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-black text-sm text-duo-ink line-clamp-2 leading-snug group-hover:text-duo-blue transition">
                            {quiz.title}
                          </h4>

                          {/* 3 dots menu button */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === quiz.id ? null : quiz.id);
                              }}
                              className="p-1 rounded-md text-duo-hare hover:text-duo-ink hover:bg-duo-polar transition"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {activeMenuId === quiz.id && (
                              <div className="absolute right-0 mt-1 w-52 bg-white border-2 border-duo-swan rounded-2xl shadow-[0_4px_0_#e7d9bc] p-1.5 z-30 text-sm animate-pop-in">
                                <button
                                  onClick={() => {
                                    onLaunchLesson(quiz.title);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Bắt đầu bài giảng</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingQuiz(quiz);
                                    setIsQuizCreatorOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-duo-blue" />
                                  <span>Chỉnh sửa câu hỏi</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setMovingItem({
                                      id: quiz.id,
                                      title: quiz.title,
                                      type: 'quiz',
                                      folderId: quiz.folderId,
                                    });
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Folder className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Chuyển vào thư mục</span>
                                </button>
                                <button
                                  onClick={() => handleTrashItem(quiz.id, quiz.title, 'quiz')}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-red-dark hover:bg-duo-red-light flex items-center gap-2 font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Chuyển vào thùng rác</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Author & Launch Button */}
                      <div className="pt-3 border-t-2 border-duo-swan mt-2 flex items-center justify-between text-[11px] text-duo-wolf">
                        <span className="truncate max-w-[120px]">{quiz.author}</span>
                        <button
                          onClick={() => onLaunchLesson(quiz.title)}
                          className="btn-3d btn-green btn-sm"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Bắt đầu</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List View */
              <div className="divide-y divide-duo-swan border-2 border-duo-swan rounded-2xl overflow-hidden bg-white">
                {filteredQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="p-3.5 flex items-center justify-between gap-4 hover:bg-duo-polar transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={quiz.thumbnail}
                        alt={quiz.title}
                        className="w-16 h-11 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {quiz.status === 'draft' && (
                            <span className="bg-[#e21b3c] text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                              Bản nháp
                            </span>
                          )}
                          <h4 className="font-extrabold text-xs text-duo-ink truncate">
                            {quiz.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-duo-hare">
                          <span>{quiz.questionCount} câu hỏi</span>
                          <span>•</span>
                          <span>{quiz.author}</span>
                          <span>•</span>
                          <span>{quiz.updatedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onLaunchLesson(quiz.title)}
                        className="btn-3d btn-green btn-sm"
                      >
                        <Play className="w-3 h-3 fill-white" /> Bắt đầu
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW B: Câu chuyện (Story - Khớp chuẩn Ảnh 2) */}
        {/* ======================================================== */}
        {activeCategory === 'story' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
            {/* Header row: Tìm kiếm (trái) và Sắp xếp theo [ Cũ nhất / Mới nhất ] + Grid/List (phải) */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Search bar matching Image 2 */}
              <div className="relative w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-duo-hare" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm"
                  className="input-duo w-full pl-9 pr-3"
                />
              </div>

              {/* Right side controls matching Image 2 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-duo-wolf font-medium">
                  <span>Sắp xếp theo:</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                    className="input-duo !w-auto !py-2"
                  >
                    <option value="oldest">Cũ nhất</option>
                    <option value="newest">Mới nhất</option>
                  </select>
                </div>

                {/* View toggle */}
                <div className="flex items-center border-2 border-duo-swan rounded-xl p-0.5 bg-duo-polar">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'grid' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'list' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Grid of Story Cards (Khớp ảnh 2) */}
            {filteredStories.length === 0 ? (
              <div className="text-center py-16 bg-duo-polar border-2 border-dashed border-duo-swan rounded-2xl">
                <BookOpen className="w-12 h-12 text-duo-hare mx-auto mb-3" />
                <h4 className="font-bold text-sm text-[#4b4b4b]">Chưa có câu chuyện nào</h4>
                <p className="text-xs text-duo-hare mt-1 mb-4">
                  Bấm nút "Tạo câu chuyện" để thêm tích truyện lịch sử hào hùng.
                </p>
                <button
                  onClick={() => {
                    setEditingStory(null);
                    setIsStoryCreatorOpen(true);
                  }}
                  className="btn-3d btn-blue"
                >
                  Tạo câu chuyện mới
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredStories.map((story) => (
                  <div
                    key={story.id}
                    onClick={() => setReadingStory(story)}
                    className="card-pressable overflow-visible flex flex-col group relative"
                  >
                    {/* Header nhỏ trên đầu card (Khớp ảnh 2: icon + "Câu chuyện") */}
                    <div className="px-3 py-1.5 bg-duo-purple-light rounded-t-[18px] flex items-center gap-1.5 text-[11px] text-duo-purple-dark font-black uppercase tracking-wider">
                      <BookOpen className="w-3.5 h-3.5 text-kh-purple" />
                      <span>Câu chuyện</span>
                    </div>

                    {/* Thumbnail Image */}
                    <div className="relative aspect-video w-full bg-duo-polar overflow-hidden">
                      <img
                        src={story.thumbnail}
                        alt={story.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />

                      {/* Badge: Bản nháp (Đỏ như ảnh 2) */}
                      {story.status === 'draft' && (
                        <span className="absolute top-2 left-2 chip bg-duo-red text-white uppercase">
                          Bản nháp
                        </span>
                      )}

                      {/* Badge: 1 phút đọc (Viên thuốc đen góc dưới phải như ảnh 2) */}
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        {story.readingTime}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Folder tag if assigned */}
                        {story.folderId && (
                          <span className="chip bg-duo-purple-light text-duo-purple-dark mb-1.5 max-w-full">
                            <Folder className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{folders.find((f) => f.id === story.folderId)?.name}</span>
                          </span>
                        )}

                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-black text-sm text-duo-ink line-clamp-2 leading-snug group-hover:text-kh-purple transition">
                            {story.title}
                          </h4>

                          {/* 3 dots menu button */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === story.id ? null : story.id);
                              }}
                              className="p-1 rounded-md text-duo-hare hover:text-duo-ink hover:bg-duo-polar transition"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {activeMenuId === story.id && (
                              <div className="absolute right-0 mt-1 w-52 bg-white border-2 border-duo-swan rounded-2xl shadow-[0_4px_0_#e7d9bc] p-1.5 z-30 text-sm animate-pop-in">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReadingStory(story);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Đọc câu chuyện</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingStory(story);
                                    setIsStoryCreatorOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Chỉnh sửa nội dung</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovingItem({
                                      id: story.id,
                                      title: story.title,
                                      type: 'story',
                                      folderId: story.folderId,
                                    });
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Folder className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Chuyển vào thư mục</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTrashItem(story.id, story.title, 'story');
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-red-dark hover:bg-duo-red-light flex items-center gap-2 font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Chuyển vào thùng rác</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Author */}
                      <div className="pt-2.5 border-t-2 border-duo-swan mt-2 text-[11px] text-duo-hare flex items-center justify-between">
                        <span className="truncate">{story.author}</span>
                        <span className="text-purple-600 font-bold group-hover:underline">
                          Đọc ngay →
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW C: Khoá học (Course) */}
        {/* ======================================================== */}
        {activeCategory === 'course' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
            <div className="flex items-center justify-between border-b-2 border-duo-swan pb-4">
              <div>
                <h2 className="text-2xl font-black text-duo-ink">Khoá học Lịch sử</h2>
                <p className="text-xs text-duo-wolf">
                  Chuỗi bài học dài kết hợp video, tài liệu và sa bàn chiến dịch
                </p>
              </div>
              <button
                onClick={() => onShowToast('🎓 Tính năng tạo khoá học chuyên sâu đã sẵn sàng.')}
                className="btn-3d btn-blue"
              >
                + Tạo khoá học mới
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="card-pressable !cursor-default p-5 flex gap-4"
                >
                  <img
                    src={c.thumbnail}
                    alt={c.title}
                    className="w-28 h-28 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <span className="chip bg-duo-blue-light text-duo-blue-dark mb-1">
                        Chuyên đề lớp 7
                      </span>
                      <h4 className="font-extrabold text-sm text-duo-ink leading-snug">
                        {c.title}
                      </h4>
                      <p className="text-xs text-duo-wolf mt-1 line-clamp-2">
                        {c.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-duo-hare pt-2 border-t-2 border-duo-swan">
                      <span>{c.chapterCount} chương • {c.duration}</span>
                      <button
                        onClick={() => onLaunchLesson(c.title)}
                        className="text-duo-blue font-bold hover:underline"
                      >
                        Vào học →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW D: Thư mục của bạn / Chi tiết Thư mục (Khớp Ảnh 3) */}
        {/* ======================================================== */}
        {activeCategory === 'folders' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
            {/* Header: Tiêu đề Thư mục + Nút "+ Mới" (Xanh dương như ảnh 3) */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-duo-ink tracking-tight">
                  {currentFolder ? currentFolder.name : 'Thư mục của tôi'}
                </h2>
                {currentFolder && currentFolder.description && (
                  <p className="text-xs text-duo-wolf mt-0.5">{currentFolder.description}</p>
                )}
              </div>

              {/* Nút + Mới (Màu xanh dương chuẩn ảnh 3) */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (selectedFolderId) {
                      // Nếu đang ở trong một thư mục, cho phép chọn tạo Quiz hoặc Story
                      setIsCreateQuizOpen(true);
                    } else {
                      setIsCreateFolderOpen(true);
                    }
                  }}
                  className="btn-3d btn-green"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Mới</span>
                </button>
              </div>
            </div>

            {/* Hàng bộ lọc: [ Tất cả các loại ▾ ] [ Gần đây nhất ▾ ] và Grid/List (Chuẩn ảnh 3) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <select
                  value={folderTypeFilter}
                  onChange={(e) => setFolderTypeFilter(e.target.value as any)}
                  className="input-duo !w-auto !py-2"
                >
                  <option value="all">Tất cả các loại</option>
                  <option value="quiz">Chỉ Quiz</option>
                  <option value="story">Chỉ Câu chuyện</option>
                </select>

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="input-duo !w-auto !py-2"
                >
                  <option value="newest">Gần đây nhất</option>
                  <option value="oldest">Cũ nhất</option>
                </select>
              </div>

              {/* View toggle */}
              <div className="flex items-center border-2 border-duo-swan rounded-xl p-0.5 bg-duo-polar">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'grid' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'list' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Trường hợp: Đang ở thư mục gốc (Root folders overview) */}
            {selectedFolderId === null ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {folders.map((folder) => {
                    const qCount = quizzes.filter((q) => q.folderId === folder.id).length;
                    const sCount = stories.filter((s) => s.folderId === folder.id).length;

                    return (
                      <div
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="card-pressable p-5 flex flex-col justify-between h-40 group"
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                            style={{ backgroundColor: folder.color }}
                          >
                            <Folder className="w-5 h-5" />
                          </div>
                          <span className="text-[11px] font-bold text-duo-hare">
                            {qCount + sCount} bài
                          </span>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-sm text-duo-ink group-hover:text-[#115e59] transition line-clamp-1">
                            {folder.name}
                          </h4>
                          <p className="text-xs text-duo-hare mt-0.5 line-clamp-1">
                            {folder.description || 'Không có mô tả'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-duo-wolf pt-2 border-t-2 border-duo-swan">
                          <span>{qCount} Quiz • {sCount} Câu chuyện</span>
                          <span className="text-duo-blue font-bold group-hover:translate-x-0.5 transition flex items-center">
                            Mở <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Trường hợp: Đang mở một Thư mục cụ thể */
              <div>
                {/* Thanh điều hướng quay lại danh sách thư mục */}
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className="text-xs font-bold text-duo-blue hover:underline flex items-center gap-1 mb-4"
                >
                  ← Quay lại tất cả thư mục
                </button>

                {folderTotalItems === 0 ? (
                  /* ======================================================== */
                  /* Empty state minh hoạ chuẩn theo Ảnh 3 */
                  /* ======================================================== */
                  <div className="border-2 border-dashed border-duo-swan rounded-2xl p-16 flex flex-col items-center justify-center text-center bg-duo-polar min-h-[360px]">
                    {/* SVG Minh hoạ các thẻ xếp lớp có dấu hỏi chấm (?, ?, ?) như ảnh 3 */}
                    <div className="relative w-48 h-28 mb-6 flex items-center justify-center">
                      {/* Thẻ nền 1 */}
                      <div className="absolute top-2 -left-2 w-28 h-16 bg-white border-2 border-duo-swan rounded-xl rotate-[-6deg]" />
                      {/* Thẻ nền 2 */}
                      <div className="absolute top-4 right-0 w-32 h-18 bg-white border-2 border-duo-swan rounded-xl rotate-[4deg]" />
                      {/* Thẻ trung tâm */}
                      <div className="relative w-36 h-20 bg-white border-2 border-duo-swan rounded-xl flex flex-col justify-center p-3 gap-1.5 z-10">
                        <div className="w-12 h-2 bg-slate-200 rounded" />
                        <div className="w-20 h-2 bg-slate-100 rounded" />
                      </div>

                      {/* Các bong bóng dấu hỏi chấm tròn (?, ?, ?) */}
                      <div className="absolute -top-1 left-6 w-6 h-6 rounded-full bg-[#e21b3c] text-white text-[11px] font-black flex items-center justify-center z-20">
                        ?
                      </div>
                      <div className="absolute -top-3 right-16 w-5 h-5 rounded-full bg-[#1368ce] text-white text-[10px] font-black flex items-center justify-center z-20">
                        ?
                      </div>
                      <div className="absolute -bottom-2 right-8 w-6 h-6 rounded-full bg-[#26890c] text-white text-[11px] font-black flex items-center justify-center z-20">
                        ?
                      </div>
                      <div className="absolute bottom-2 left-10 w-5 h-5 rounded-full bg-[#d89e00] text-white text-[10px] font-black flex items-center justify-center z-20">
                        ?
                      </div>
                    </div>

                    {/* Dòng text thông báo chuẩn ảnh 3 */}
                    <p className="text-xs text-duo-wolf max-w-sm leading-relaxed mb-4">
                      Có vẻ như chưa có nội dung nào tại đây.
                      <br />
                      Hãy tạo bài quiz hoặc câu chuyện đầu tiên để bắt đầu nhé.
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingQuiz(null);
                          setIsQuizCreatorOpen(true);
                        }}
                        className="btn-3d btn-blue"
                      >
                        + Tạo Quiz vào thư mục
                      </button>
                      <button
                        onClick={() => {
                          setEditingStory(null);
                          setIsStoryCreatorOpen(true);
                        }}
                        className="btn-3d btn-purple"
                      >
                        + Tạo Câu chuyện
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Hiển thị các bài Quiz và Câu chuyện trong thư mục */
                  <div className="space-y-6">
                    {/* Danh sách Quiz trong thư mục */}
                    {(folderTypeFilter === 'all' || folderTypeFilter === 'quiz') &&
                      folderQuizzes.length > 0 && (
                        <div>
                          <h4 className="font-extrabold text-xs text-duo-ink mb-3 flex items-center gap-1.5">
                            <span>Quiz trắc nghiệm ({folderQuizzes.length})</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {folderQuizzes.map((quiz) => (
                              <div
                                key={quiz.id}
                                className="bg-white border-2 border-duo-swan rounded-xl overflow-hidden hover:shadow-md transition"
                              >
                                <img
                                  src={quiz.thumbnail}
                                  alt={quiz.title}
                                  className="w-full aspect-video object-cover"
                                />
                                <div className="p-3">
                                  <h5 className="font-extrabold text-xs text-duo-ink line-clamp-1">
                                    {quiz.title}
                                  </h5>
                                  <div className="flex items-center justify-between text-[11px] text-duo-wolf mt-2 pt-2 border-t-2 border-duo-swan">
                                    <span>{quiz.questionCount} câu hỏi</span>
                                    <button
                                      onClick={() => onLaunchLesson(quiz.title)}
                                      className="text-duo-blue font-bold hover:underline"
                                    >
                                      Bắt đầu →
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Danh sách Câu chuyện trong thư mục */}
                    {(folderTypeFilter === 'all' || folderTypeFilter === 'story') &&
                      folderStories.length > 0 && (
                        <div>
                          <h4 className="font-extrabold text-xs text-duo-ink mb-3 flex items-center gap-1.5">
                            <span>Câu chuyện lịch sử ({folderStories.length})</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {folderStories.map((story) => (
                              <div
                                key={story.id}
                                onClick={() => setReadingStory(story)}
                                className="bg-white border-2 border-duo-swan rounded-xl overflow-hidden hover:shadow-md transition cursor-pointer"
                              >
                                <div className="relative aspect-video">
                                  <img
                                    src={story.thumbnail}
                                    alt={story.title}
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                    {story.readingTime}
                                  </span>
                                </div>
                                <div className="p-3">
                                  <h5 className="font-extrabold text-xs text-duo-ink line-clamp-1">
                                    {story.title}
                                  </h5>
                                  <div className="flex items-center justify-between text-[11px] text-duo-wolf mt-2 pt-2 border-t-2 border-duo-swan">
                                    <span>{story.author}</span>
                                    <span className="text-kh-purple font-bold">Đọc ngay →</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW E: Thùng rác (Trash) */}
        {/* ======================================================== */}
        {activeCategory === 'trash' && (
          <div className="p-8 max-w-4xl w-full mx-auto space-y-6">
            <div className="flex items-center justify-between border-b-2 border-duo-swan pb-3">
              <div>
                <h2 className="text-base font-extrabold text-duo-ink">Thùng rác</h2>
                <p className="text-xs text-duo-wolf">
                  Các mục đã xoá có thể được khôi phục lại bất kỳ lúc nào
                </p>
              </div>
              {trashedItems.length > 0 && (
                <button
                  onClick={() => {
                    setTrashedItems([]);
                    onShowToast('🧹 Đã dọn sạch thùng rác vĩnh viễn.');
                  }}
                  className="btn-3d btn-red btn-sm"
                >
                  Dọn sạch thùng rác
                </button>
              )}
            </div>

            {trashedItems.length === 0 ? (
              <div className="text-center py-16 bg-duo-polar border-2 border-dashed border-duo-swan rounded-2xl">
                <Trash2 className="w-12 h-12 text-duo-hare mx-auto mb-2" />
                <p className="text-xs text-duo-wolf">Thùng rác đang trống.</p>
              </div>
            ) : (
              <div className="divide-y divide-duo-swan border-2 border-duo-swan rounded-2xl overflow-hidden bg-white">
                {trashedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex items-center justify-between gap-4 hover:bg-duo-polar transition"
                  >
                    <div>
                      <span className="text-[10px] uppercase font-bold text-duo-hare block mb-0.5">
                        {item.type === 'quiz' ? 'Quiz trắc nghiệm' : 'Câu chuyện'}
                      </span>
                      <h4 className="font-bold text-xs text-duo-ink">{item.title}</h4>
                    </div>
                    <button
                      onClick={() => handleRestoreItem(item)}
                      className="btn-3d btn-outline btn-sm"
                    >
                      Khôi phục
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. Các Dialog / Modal Tương Tác */}
      {/* ======================================================== */}
      {/* Modal Tạo thư mục */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onSaveFolder={handleSaveFolder}
      />

      {/* Modal Tạo câu chuyện */}
      <CreateStoryModal
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        folders={folders}
        defaultFolderId={selectedFolderId}
        onSaveStory={handleSaveStory}
      />

      {/* Modal Tạo bài Quiz */}
      <CreateQuizModal
        isOpen={isCreateQuizOpen}
        onClose={() => setIsCreateQuizOpen(false)}
        folders={folders}
        defaultFolderId={selectedFolderId}
        onSaveQuiz={handleSaveQuiz}
        onOpenAiGenerator={onOpenAiQuizModal}
      />

      {/* Modal Đọc câu chuyện lịch sử */}
      <StoryReaderModal story={readingStory} onClose={() => setReadingStory(null)} />

      {/* Modal Chuyển bài vào thư mục */}
      <MoveToFolderModal
        isOpen={movingItem !== null}
        onClose={() => setMovingItem(null)}
        itemTitle={movingItem?.title || ''}
        itemType={movingItem?.type || 'quiz'}
        folders={folders}
        currentFolderId={movingItem?.folderId}
        onMoveToFolder={handleMoveItem}
      />
    </div>
  );
};

// ============================================================================
// views/TeacherRosterPage – danh sách học sinh thật của lớp
// ============================================================================

/** Tiến độ game & học tập của lớp: câu sai nhiều nhất, mức nắm vững theo chủ đề, học sinh cần hỗ trợ */
/** Một trận thi đấu cả lớp đã lưu (GET /api/teacher/live-sessions) */
interface LiveSessionSummary {
  id: number;
  title: string;
  scope: string;
  class_name: string | null;
  question_count: number;
  player_count: number;
  started_at: string;
  finished_at: string;
  accuracy: number | null;
  results: Array<{ user_id: number; full_name: string; rank: number; score: number; correct: number; answered: number }>;
  questions: Array<{ question_id: string; prompt: string; topic: string; answered: number; correct: number }>;
}

const LiveHistoryCard: React.FC<{ sessions: LiveSessionSummary[] | null; onLaunch: () => void }> = ({ sessions, onLaunch }) => (
  <section className="card-duo p-5" aria-labelledby="live-history-title">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
      <div>
        <h3 id="live-history-title" className="font-black text-lg text-duo-ink">
          Thi đấu gần đây
        </h3>
        <p className="text-xs font-bold text-duo-wolf">Kết quả các trận thi đấu trực tiếp của lớp – server chấm từng câu</p>
      </div>
      <button type="button" onClick={onLaunch} className="btn-3d btn-gold btn-sm">
        <Radio className="w-4 h-4" aria-hidden="true" /> Mở phòng
      </button>
    </div>
    {sessions === null ? (
      <p className="text-sm font-bold text-duo-wolf">Đang tải lịch sử thi đấu…</p>
    ) : sessions.length === 0 ? (
      <p className="text-sm font-semibold text-duo-wolf">Lớp chưa có trận thi đấu nào. Bấm “Mở phòng”, đọc mã PIN cho cả lớp và bắt đầu.</p>
    ) : (
      <ul className="divide-y-2 divide-duo-swan">
        {sessions.map((s) => {
          const hardest = s.questions
            .filter((q) => q.answered > 0)
            .sort((a, b) => a.correct / a.answered - b.correct / b.answered)[0];
          return (
            <li key={s.id} className="py-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-black text-duo-ink truncate">{s.title}</p>
                <p className="text-xs font-bold text-duo-wolf">
                  {formatDateTime(s.finished_at)} · {s.player_count} học sinh · {s.question_count} câu · đúng {pct(s.accuracy)}
                </p>
                {hardest && (
                  <p className="text-xs font-semibold text-duo-wolf mt-1">
                    Câu khó nhất: “{hardest.prompt}” – {hardest.correct}/{hardest.answered} bạn đúng
                  </p>
                )}
              </div>
              <ol className="flex flex-wrap gap-2 shrink-0" aria-label={`Ba bạn dẫn đầu trận ${s.title}`}>
                {s.results.slice(0, 3).map((r) => (
                  <li key={r.user_id} className="chip bg-duo-gold-light text-duo-gold-dark">
                    <Trophy className="w-3.5 h-3.5" aria-hidden="true" /> {r.rank}. {shortName(r.full_name)} · {r.score.toLocaleString('vi-VN')}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

const ClassInsights: React.FC<{ cls: TeacherClass | null; loading: boolean }> = ({ cls, loading }) => {
  if (!cls) return loading ? <div className="card-duo p-5 text-sm font-bold text-duo-wolf">Đang tải tiến độ của lớp…</div> : null;
  const weakest = cls.unit_mastery.slice(0, 6);
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4" aria-label="Tiến độ học tập của lớp">
      <div className="card-duo p-5">
        <h3 className="font-black text-lg text-duo-ink mb-1">Câu cả lớp sai nhiều nhất</h3>
        <p className="text-xs font-bold text-duo-wolf mb-3">Do server ghi lại khi chấm từng câu trả lời</p>
        {cls.top_wrong.length === 0 ? (
          <p className="text-sm font-semibold text-duo-wolf">Chưa có câu trả lời sai nào.</p>
        ) : (
          <ol className="space-y-3">
            {cls.top_wrong.map((w, i) => (
              <li key={w.question_id} className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-duo-red-light text-duo-red-dark font-black text-sm flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-duo-ink leading-snug">{w.prompt}</p>
                  <p className="text-xs font-semibold text-duo-wolf mt-0.5">
                    Sai {w.wrong}/{w.attempts} lượt · {w.students} học sinh · {w.topic}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="card-duo p-5">
        <h3 className="font-black text-lg text-duo-ink mb-1">Mức nắm vững theo chủ đề</h3>
        <p className="text-xs font-bold text-duo-wolf mb-3">Trung bình P(L) của mô hình BKT – yếu nhất ở trên</p>
        {weakest.length === 0 ? (
          <p className="text-sm font-semibold text-duo-wolf">Học sinh chưa làm câu hỏi nào.</p>
        ) : (
          <ul className="space-y-3">
            {weakest.map((m) => (
              <li key={m.unit_id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-duo-ink leading-snug">{m.topic}</span>
                  <span className="font-black text-duo-wolf shrink-0">{pct(m.avg_p_l)}</span>
                </div>
                <div className="progress-duo progress-sm mt-1">
                  <div className="progress-fill" style={{ width: `${m.avg_p_l * 100}%`, background: m.avg_p_l >= 0.8 ? '#0f766e' : m.avg_p_l >= 0.6 ? '#0369a1' : '#d97706' }} />
                </div>
                <p className="text-[11px] font-semibold text-duo-hare mt-0.5">{m.students} học sinh đã làm</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card-duo p-5">
        <h3 className="font-black text-lg text-duo-ink mb-1">Học sinh cần hỗ trợ</h3>
        <p className="text-xs font-bold text-duo-wolf mb-3">Vắng học, tỉ lệ đúng hoặc mức nắm vững thấp</p>
        {cls.needs_support.length === 0 ? (
          <p className="text-sm font-semibold text-duo-wolf">Chưa có học sinh nào cần lưu ý.</p>
        ) : (
          <ul className="space-y-2.5">
            {cls.needs_support.slice(0, 8).map((n) => (
              <li key={n.id} className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0" style={{ background: avatarColor(n.full_name) }}>
                  {initialsOf(n.full_name)}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-duo-ink">{n.full_name}</p>
                  <p className="text-xs font-semibold text-duo-wolf">{n.reasons.join(' · ')}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

const TeacherRosterPage: React.FC<{
  className: string | null;
  roster: RosterStudent[];
  summary: ClassSummary | undefined;
  cls: TeacherClass | null;
  loading: boolean;
  onRefresh: () => void;
  onExport: () => void;
}> = ({ className, roster, summary, cls, loading, onRefresh, onExport }) => {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const rows = roster.filter((s) => !q || s.full_name.toLowerCase().includes(q) || s.username.includes(q));

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-duo-ink">{className ? `Học sinh lớp ${className}` : 'Học sinh của lớp'}</h2>
            <p className="text-sm font-bold text-duo-wolf">
              {summary ? `${summary.total} học sinh • ${summary.practiced} em đã làm bài • ${summary.active_7d} em hoạt động trong 7 ngày` : 'Đang tải…'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onRefresh} className="btn-3d btn-outline !text-duo-wolf" title="Tải lại">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
            </button>
            <button onClick={onExport} className="btn-3d btn-green">
              <FileSpreadsheet className="w-4 h-4" /> Xuất CSV
            </button>
          </div>
        </div>

        {!className ? (
          <div className="card-duo p-8 flex flex-col items-center text-center">
            <Mascot size={100} mood="thinking" />
            <p className="font-black text-duo-ink mt-2">Tài khoản của bạn chưa được gán lớp</p>
            <p className="text-sm font-bold text-duo-wolf">Nhờ quản trị viên cập nhật lớp phụ trách tại trang quản trị.</p>
          </div>
        ) : (
          <>
            <ClassInsights cls={cls} loading={loading} />
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm học sinh…" className="input-duo !pl-10" />
            </div>
            <div className="card-duo overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead className="bg-duo-polar text-duo-wolf text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3 font-black">#</th>
                      <th className="text-left px-4 py-3 font-black">Học sinh</th>
                      <th className="text-right px-4 py-3 font-black">KN</th>
                      <th className="text-right px-4 py-3 font-black">Sao chiến dịch</th>
                      <th className="text-right px-4 py-3 font-black">Chính xác</th>
                      <th className="text-left px-4 py-3 font-black w-40">Nắm vững (BKT)</th>
                      <th className="text-right px-4 py-3 font-black">Chuỗi</th>
                      <th className="text-left px-4 py-3 font-black">Đăng nhập gần nhất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-duo-swan">
                    {rows.map((s, i) => (
                      <tr key={s.id} className={s.is_active ? 'hover:bg-duo-polar/60' : 'opacity-50'}>
                        <td className="px-4 py-3 font-black text-duo-wolf">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0" style={{ background: avatarColor(s.full_name) }}>
                              {initialsOf(s.full_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-black text-duo-ink truncate">{s.full_name}</p>
                              <p className="text-xs font-bold text-duo-hare font-mono">
                                {s.username}
                                {s.must_change_password && <span className="ml-1.5 chip bg-duo-gold-light text-duo-gold-dark !text-[10px] !py-0 font-sans">Chưa đăng nhập</span>}
                                {!s.is_active && <span className="ml-1.5 chip bg-duo-red-light text-duo-red-dark !text-[10px] !py-0 font-sans">Đã khoá</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-duo-gold-dark">{s.xp.toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 text-right font-black text-duo-ink whitespace-nowrap" title={`Màn 1: ${s.campaign_stars?.[0] ?? 0}/9 · Màn 2: ${s.campaign_stars?.[1] ?? 0}/9 · Màn 3: ${s.campaign_stars?.[2] ?? 0}/9`}>
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-4 h-4 text-duo-gold fill-duo-gold" aria-hidden="true" /> {s.stars}/27
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-duo-ink">{pct(s.accuracy)}</td>
                        <td className="px-4 py-3">
                          {s.avg_mastery === null ? (
                            <span className="text-xs font-bold text-duo-hare">Chưa có dữ liệu</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="progress-duo progress-sm flex-1">
                                <div
                                  className="progress-fill"
                                  style={{ width: `${s.avg_mastery * 100}%`, background: s.avg_mastery >= 0.8 ? '#0f766e' : s.avg_mastery >= 0.6 ? '#0369a1' : '#c2410c' }}
                                />
                              </div>
                              <span className="text-xs font-black text-duo-wolf w-9 text-right">{pct(s.avg_mastery)}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-duo-orange">{s.streak > 0 ? `${s.streak} ngày` : '—'}</td>
                        <td className="px-4 py-3 font-bold text-duo-wolf whitespace-nowrap">{formatDateTime(s.last_login_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && (
                <div className="py-12 flex flex-col items-center text-center px-4">
                  <Mascot size={90} mood="thinking" />
                  <p className="font-black text-duo-ink mt-2">{roster.length === 0 ? 'Lớp chưa có học sinh nào' : 'Không tìm thấy học sinh phù hợp'}</p>
                  <p className="text-sm font-bold text-duo-wolf">
                    {roster.length === 0 ? 'Quản trị viên cấp tài khoản học sinh cho lớp tại trang quản trị (/admin).' : 'Thử từ khoá khác.'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
};

// ============================================================================
// views/TeacherView
// ============================================================================

const initialTodoTasks: TodoTask[] = [
  {
    id: '1',
    title: 'Xem báo cáo cho Bài 13: Ba lần kháng chiến chống quân Mông - Nguyên',
    description: 'Kiểm tra kết quả làm bài của lớp 7A1 để đánh giá mức độ hiểu bài của học sinh.',
    category: 'report',
    status: 'active',
    actionLabel: 'Xem báo cáo',
    actionType: 'report',
  },
  {
    id: '2',
    title: 'Khám phá 3 câu hỏi trắc nghiệm AI đề xuất cho lớp 7A1',
    description: 'Phân biệt Hội nghị Bình Than (1282 - Quả cam vua ban) và Hội nghị Diên Hồng (1285 - Tiếng hô Đánh).',
    category: 'ai',
    status: 'active',
    actionLabel: 'Tạo trắc nghiệm AI',
    actionType: 'ai',
  },
  {
    id: '3',
    title: 'Chuẩn bị bài giảng Chặng Chương Dương Độ (Năm 1285)',
    description: 'Xem trước 10 câu hỏi trắc nghiệm và tư liệu chiến thuật phản công mùa hè năm 1285.',
    category: 'lesson',
    status: 'active',
    actionLabel: 'Bắt đầu bài giảng',
    actionType: 'lesson',
  },
  {
    id: '4',
    title: 'Xuất bảng điểm lớp 7A1 định dạng Excel (.xlsx)',
    description: 'Tải file tổng kết tiến độ học tập của cả lớp (mở được bằng Excel).',
    category: 'excel',
    status: 'active',
    actionLabel: 'Xuất Excel',
    actionType: 'excel',
  },
  {
    id: '5',
    title: 'Tạo câu chuyện học liệu tương tác về Hưng Đạo Đại Vương',
    description: 'Xây dựng câu chuyện đa phương tiện với hình ảnh và tư liệu lịch sử Đông A.',
    category: 'assignment',
    status: 'active',
    actionLabel: 'Tạo câu chuyện',
    actionType: 'library',
  },
  {
    id: '6',
    title: 'Gửi thông báo ôn tập tuần tới cả lớp',
    description: 'Gửi đường link ôn tập và lịch kiểm tra 15 phút tuần này đến phụ huynh và học sinh.',
    category: 'assignment',
    status: 'active',
    actionLabel: 'Gửi thông báo',
    actionType: 'profile',
  },
  {
    id: '7',
    title: 'Cập nhật hồ sơ',
    description: 'Hoàn thiện thông tin còn thiếu trên hồ sơ của bạn.',
    category: 'profile',
    status: 'completed',
    actionLabel: 'Cập nhật',
    actionType: 'profile',
  },
];

const DEFAULT_LESSON = 'Bài 14 (KNTT): Ba lần kháng chiến chống quân xâm lược Mông - Nguyên';

const COURSE_STAGE_NAMES = ['Màn 1 – Kháng chiến lần thứ nhất (1258)', 'Màn 2 – Kháng chiến lần thứ hai (1285)', 'Màn 3 – Kháng chiến lần thứ ba (1287 – 1288)'];

interface TeacherViewProps {
  token: string;
  user: AuthUser;
  onShowToast: (msg: string) => void;
  onSessionExpired: () => void;
}

const TeacherView: React.FC<TeacherViewProps> = ({ token, user, onShowToast, onSessionExpired }) => {
  const displayName = user.full_name;
  const className = user.class_name;
  const [cls, setCls] = useState<TeacherClass | null>(null);
  const [clsLoading, setClsLoading] = useState(true);

  const loadClass = useCallback(() => {
    setClsLoading(true);
    apiRequest<TeacherClass>('/api/teacher/class', { token })
      .then(setCls)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        else onShowToast(`⚠️ ${err instanceof Error ? err.message : 'Không tải được danh sách lớp'}`);
      })
      .finally(() => setClsLoading(false));
  }, [token, onSessionExpired, onShowToast]);

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  const [liveHistory, setLiveHistory] = useState<LiveSessionSummary[] | null>(null);
  const loadLiveHistory = useCallback(() => {
    apiRequest<LiveSessionSummary[]>('/api/teacher/live-sessions?limit=5', { token })
      .then(setLiveHistory)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        else setLiveHistory([]);
      });
  }, [token, onSessionExpired]);

  useEffect(() => {
    loadLiveHistory();
  }, [loadLiveHistory]);

  /** Trận vừa lưu: cập nhật lịch sử và tiến độ lớp (câu trả lời trong trận đã cộng vào tiến độ học sinh) */
  const handleLiveSaved = useCallback(() => {
    loadLiveHistory();
    loadClass();
  }, [loadLiveHistory, loadClass]);

  const roster = useMemo(() => cls?.students ?? [], [cls]);
  const summary = cls?.summary;
  const total = summary?.total ?? 0;
  const practiced = summary?.practiced ?? 0;
  const rosterNames = useMemo(() => roster.map((st) => ({ id: String(st.id), name: st.full_name })), [roster]);
  const courseStages = COURSE_STAGE_NAMES.map((name, i) => {
    const done = roster.filter((st) => (st.campaign_stars?.[i] ?? 0) >= 3).length;
    return { name, done, status: done === 0 ? 'locked' : total > 0 && done >= total ? 'done' : 'current' };
  });
  const teacherInitials = (() => {
    const parts = displayName.trim().split(/\s+/);
    return ((parts[parts.length - 1]?.[0] ?? '') + (parts.length > 1 ? parts[0][0] : '')).toUpperCase();
  })();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [activeCourseTab, setActiveCourseTab] = useState<'session' | 'course'>('session');
  const [show3DCarousel, setShow3DCarousel] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isTextbookModalOpen, setIsTextbookModalOpen] = useState(false);
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isTodoListModalOpen, setIsTodoListModalOpen] = useState(false);
  const [tasks, setTasks] = useState<TodoTask[]>(initialTodoTasks);
  const [liveTitle, setLiveTitle] = useState<string | null>(null);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'completed' ? 'active' : 'completed';
          onShowToast(nextStatus === 'completed' ? `✅ Đã hoàn thành: "${t.title}"` : `🔄 Đã đưa lại vào danh sách cần làm: "${t.title}"`);
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const handleSkipTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          onShowToast(`⏩ Đã bỏ qua đầu việc: "${t.title}"`);
          return { ...t, status: 'skipped' };
        }
        return t;
      })
    );
  };

  const handleRestoreTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          onShowToast(`↩️ Đã khôi phục đầu việc: "${t.title}"`);
          return { ...t, status: 'active' };
        }
        return t;
      })
    );
  };

  /** Xuất báo cáo tiến độ thật của lớp ra CSV (mở bằng Excel) */
  const handleExportExcel = () => {
    if (roster.length === 0) {
      onShowToast('📭 Lớp chưa có học sinh để xuất báo cáo.');
      return;
    }
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows: Array<Array<string | number>> = [
      ['STT', 'Họ tên', 'Tên đăng nhập', 'XP', 'XP tuần', 'Lượt học/trận', 'Lượt đạt 100%', 'Số câu đã làm', 'Độ chính xác', 'Nắm vững (BKT)', 'Sao Màn 1', 'Sao Màn 2', 'Sao Màn 3', 'Số tướng', 'Chuỗi ngày', 'Câu hỏi Quân Sư', 'Đăng nhập gần nhất'],
      ...roster.map((st, i) => [
        i + 1,
        st.full_name,
        st.username,
        st.xp,
        st.week_xp,
        st.lessons_completed,
        st.perfect_runs,
        st.questions_answered,
        pct(st.accuracy),
        pct(st.avg_mastery),
        st.campaign_stars?.[0] ?? 0,
        st.campaign_stars?.[1] ?? 0,
        st.campaign_stars?.[2] ?? 0,
        st.heroes,
        st.streak,
        st.ai_questions,
        formatDateTime(st.last_login_at),
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-lop-${className ?? 'chua-gan-lop'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`📥 Đã xuất báo cáo ${roster.length} học sinh (mở được bằng Excel)`);
  };

  /** Mở phòng thi đấu trực tiếp kiểu Kahoot */
  const handleLaunchLesson = (title = DEFAULT_LESSON) => {
    setIsTodoListModalOpen(false);
    setLiveTitle(title);
  };

  const handleExecuteAction = (actionType?: string) => {
    switch (actionType) {
      case 'profile':
        onShowToast(`👤 Hồ sơ giảng viên: ${displayName}${className ? ` – phụ trách lớp ${className}` : ''}`);
        break;
      case 'report':
      case 'excel':
        handleExportExcel();
        break;
      case 'ai':
        setIsTodoListModalOpen(false);
        setIsAiModalOpen(true);
        break;
      case 'lesson':
        handleLaunchLesson();
        break;
      case 'library':
        setIsTodoListModalOpen(false);
        setIsCreateStoryOpen(true);
        break;
      default:
        onShowToast('👍 Thao tác đã được thực hiện thành công.');
    }
  };

  const handleSaveQuizFromHeader = (newQuiz: QuizItem) => {
    onShowToast(`🎯 Đã tạo bộ Quiz: "${newQuiz.title}"`);
    setActiveTab('library');
  };

  const handleSaveStoryFromHeader = (newStory: StoryItem) => {
    onShowToast(`📖 Đã tạo câu chuyện: "${newStory.title}"`);
    setActiveTab('library');
  };

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const visibleCount = tasks.filter((t) => t.status !== 'skipped').length;

  const kpis = [
    { label: 'Hoạt động 7 ngày qua', value: summary ? `${summary.active_7d}/${summary.total}` : '—', icon: <Users className="w-6 h-6" />, color: '#0f766e' },
    { label: 'Tỷ lệ đúng trung bình', value: pct(summary?.avg_accuracy), icon: <Target className="w-6 h-6" />, color: '#0369a1' },
    { label: 'Chuỗi học dài nhất', value: summary ? `${summary.best_streak} ngày` : '—', icon: <Flame className="w-6 h-6" />, color: '#c2410c' },
    { label: 'Sao chiến dịch cả lớp', value: summary ? `${summary.total_stars.toLocaleString('vi-VN')} sao` : '—', icon: <Star className="w-6 h-6" />, color: '#d97706' },
  ];

  const tools = [
    { title: 'Trình tạo AI', desc: 'Soạn đề trắc nghiệm chuẩn SGK 7 bằng AI trong vài giây.', icon: Sparkles, color: '#7e22ce', shadow: '#6b21a8', onClick: () => setIsAiModalOpen(true), cta: 'Bắt đầu ngay' },
    { title: 'Bản đồ nhiệm vụ', desc: 'Hành trình 13 ải lịch sử và tiến độ của cả lớp.', icon: Compass, color: '#c2410c', shadow: '#9a3412', onClick: () => setActiveTab('quests'), cta: 'Mở bản đồ' },
    { title: 'Thư viện sử liệu', desc: 'Quiz, câu chuyện và thư mục tài liệu của thầy.', icon: BookOpen, color: '#0369a1', shadow: '#075985', onClick: () => setActiveTab('library'), cta: 'Mở thư viện' },
    { title: 'Báo cáo lớp học', desc: 'Xuất tiến độ, độ chính xác và mức nắm vững của cả lớp ra Excel.', icon: BarChart2, color: '#b91c1c', shadow: '#7f1d1d', onClick: handleExportExcel, cta: 'Xem báo cáo' },
  ];

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-white text-duo-ink">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tabId) => {
          if (tabId === 'live') {
            handleLaunchLesson();
            return;
          }
          setActiveTab(tabId);
          if (tabId === 'quests') {
            onShowToast('🗺️ Đã mở Bản đồ Nhiệm vụ (Hành trình 13 ải lịch sử).');
          } else if (tabId === 'library') {
            onShowToast('📚 Đã mở Thư viện học liệu (Quiz, Câu chuyện & Thư mục)');
          } else if (tabId === 'reports') {
            handleExportExcel();
          } else if (tabId === 'groups') {
            loadClass();
          } else if (tabId === 'help') {
            setIsTextbookModalOpen(true);
          } else if (tabId === 'discover') {
            setActiveTab('home');
            setShow3DCarousel(true);
            onShowToast('🧭 Đã bật Sa bàn 3D: Bài 13 - Ba lần kháng chiến chống quân Mông - Nguyên.');
          }
        }}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* ===== Header ===== */}
        <header className="bg-white border-b-2 border-duo-swan px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-black text-duo-ink truncate">
              {activeTab === 'library' ? 'Thư viện học liệu số' : activeTab === 'quests' ? 'Bản đồ nhiệm vụ' : activeTab === 'groups' ? 'Học sinh của lớp' : 'Bảng điều khiển'}
            </h1>
            {className && <span className="chip bg-duo-purple-light text-kh-purple hidden sm:inline-flex">Lớp {className}</span>}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative w-64 hidden lg:block">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
              <input type="text" placeholder="Tìm bài giảng, câu hỏi, tài liệu..." className="input-duo !py-2 !pl-10 !text-sm" />
            </div>

            {activeTab === 'home' && (
              <button
                type="button"
                onClick={() => setShow3DCarousel((v) => !v)}
                className={`hidden sm:inline-flex btn-3d btn-sm ${show3DCarousel ? 'btn-gold' : 'btn-outline !text-duo-wolf'}`}
              >
                <Compass className="w-4 h-4" /> {show3DCarousel ? 'Ẩn sa bàn' : 'Sa bàn 3D'}
              </button>
            )}

            <button
              onClick={() => onShowToast('⭐ Bạn đang dùng phiên bản Đông A EDU Studio cao cấp.')}
              className="hidden md:inline-flex chip bg-duo-gold-light text-duo-gold-dark !py-1.5 !px-3 !text-xs"
            >
              ★ PRO
            </button>

            <CreateDropdown
              onCreateQuiz={() => setIsCreateQuizOpen(true)}
              onCreateStory={() => setIsCreateStoryOpen(true)}
              onCreateCourse={() => {
                setActiveTab('library');
                onShowToast('🎓 Đã chuyển đến mục Khoá học trong Thư viện.');
              }}
            />

            <button
              onClick={() => onShowToast('🔔 Bạn không có thông báo mới.')}
              className="relative w-10 h-10 rounded-xl text-duo-hare hover:text-duo-wolf hover:bg-duo-polar flex items-center justify-center"
              title="Thông báo"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-duo-red rounded-full ring-2 ring-white" />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l-2 border-duo-swan">
              <span className="w-10 h-10 rounded-full bg-kh-purple text-white font-black flex items-center justify-center" title="Tài khoản giáo viên">
                {teacherInitials}
              </span>
              <div className="hidden xl:block leading-tight">
                <span className="block text-sm font-black">{displayName}</span>
                <span className="block text-xs font-bold text-duo-hare">Giáo viên phụ trách</span>
              </div>
            </div>
          </div>
        </header>

        {activeTab === 'quests' ? (
          <QuestWorldMapView onShowToast={onShowToast} roster={rosterNames} />
        ) : activeTab === 'library' ? (
          <LibraryView onShowToast={onShowToast} onOpenAiQuizModal={() => setIsAiModalOpen(true)} onLaunchLesson={handleLaunchLesson} />
        ) : activeTab === 'groups' ? (
          <TeacherRosterPage className={className} roster={roster} summary={summary} cls={cls} loading={clsLoading} onRefresh={loadClass} onExport={handleExportExcel} />
        ) : (
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
              {/* ===== Hero kiểu Kahoot ===== */}
              <section className="relative kahoot-bg rounded-3xl p-6 sm:p-8 text-white overflow-hidden" style={{ boxShadow: '0 6px 0 #0b3d3a' }}>
                <div className="absolute inset-0 pointer-events-none">
                  {ANSWER_STYLES.map((s, i) => (
                    <div
                      key={s.shape}
                      className="absolute animate-float-slow"
                      style={{ right: `${8 + i * 9}%`, top: `${i % 2 ? 62 : 14}%`, animationDelay: `${i * 0.6}s`, opacity: 0.9 }}
                    >
                      <KahootShape shape={s.shape} size={26 + i * 4} color={s.bg} />
                    </div>
                  ))}
                </div>
                <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                    <span className="chip bg-white/15 text-white">{className ? `LỚP ${className}` : 'CHƯA GÁN LỚP'} • LỊCH SỬ 7 • GDPT 2018</span>
                    <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">Xin chào, {displayName}! 👋</h2>
                    <p className="text-white/85 font-bold mt-2 max-w-xl">
                      {!className
                        ? 'Tài khoản chưa được gán lớp phụ trách. Nhờ quản trị viên cập nhật để theo dõi học sinh.'
                        : total === 0
                        ? `Lớp ${className} chưa có học sinh nào trên hệ thống. Quản trị viên cấp tài khoản tại trang quản trị.`
                        : `${practiced}/${total} học sinh lớp ${className} đã làm bài. Hôm nay tổ chức một trận thi đấu Sử cho cả lớp nhé?`}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-5">
                      <button onClick={() => handleLaunchLesson()} className="btn-3d btn-gold btn-lg">
                        <Radio className="w-5 h-5" /> Thi đấu trực tiếp
                      </button>
                      <button onClick={() => setIsAiModalOpen(true)} className="btn-3d btn-white btn-lg">
                        <Sparkles className="w-5 h-5" /> Tạo đề bằng AI
                      </button>
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-center shrink-0 mr-6">
                    <div className="speech-bubble tail-bottom text-sm !text-kh-purple">
                      {total > 0 ? `Lớp mình có ${total} tráng sĩ nhỏ!` : 'Chờ các bạn học sinh nhé!'}
                    </div>
                    <Mascot size={150} accessory="helmet" mood="excited" bob className="mt-2" />
                  </div>
                </div>
              </section>

              {/* ===== KPI ===== */}
              <section className="grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {kpis.map((k) => (
                  <div key={k.label} className="card-duo p-4 flex items-center gap-3">
                    <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: k.color }}>
                      {k.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-black text-xl text-duo-ink leading-tight">{k.value}</div>
                      <div className="text-xs font-bold text-duo-hare truncate">{k.label}</div>
                    </div>
                  </div>
                ))}
              </section>

              {className && total > 0 && <ClassInsights cls={cls} loading={clsLoading} />}
              {className && <LiveHistoryCard sessions={liveHistory} onLaunch={() => handleLaunchLesson()} />}

              {show3DCarousel && (
                <CircularCarousel
                  items={DONG_A_CAROUSEL_ITEMS}
                  variant="teacher"
                  primaryActionLabel="Soạn câu hỏi AI"
                  secondaryActionLabel="Thi đấu chuyên đề này"
                  onPrimaryAction={(item) => {
                    setIsAiModalOpen(true);
                    onShowToast(`✨ Đang mở Trình tạo câu hỏi AI cho chuyên đề: "${item.title}"`);
                  }}
                  onSecondaryAction={(item) => handleLaunchLesson(`${item.title} (${item.period})`)}
                />
              )}

              {/* ===== Công cụ ===== */}
              <section>
                <h3 className="text-xl font-black text-duo-ink mb-3">Công cụ cho nhà giáo dục</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tools.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button key={t.title} onClick={t.onClick} className="card-pressable p-5 text-left flex flex-col gap-3 group">
                        <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: t.color, boxShadow: `0 4px 0 ${t.shadow}` }}>
                          <Icon className="w-7 h-7 text-white" />
                        </span>
                        <div>
                          <h4 className="font-black text-lg text-duo-ink">{t.title}</h4>
                          <p className="text-sm font-semibold text-duo-wolf leading-snug mt-0.5">{t.desc}</p>
                        </div>
                        <span className="mt-auto text-xs font-black uppercase tracking-wider flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: t.shadow }}>
                          {t.cta} <ChevronRight className="w-4 h-4" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ===== Bài giảng ===== */}
                <section className="lg:col-span-8 card-duo p-5">
                  <div className="flex items-center gap-1 bg-duo-polar p-1 rounded-2xl border-2 border-duo-swan w-fit mb-4">
                    {(['session', 'course'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveCourseTab(tab)}
                        className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition ${
                          activeCourseTab === tab ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare hover:text-duo-wolf'
                        }`}
                      >
                        {tab === 'session' ? 'Bài giảng của bạn' : 'Chiến dịch 3 màn'}
                      </button>
                    ))}
                  </div>

                  {activeCourseTab === 'session' ? (
                    <div className="rounded-2xl border-2 border-duo-swan overflow-hidden">
                      <div className="kahoot-bg p-5 text-white flex items-center gap-4">
                        <KahootMiniGrid size={44} />
                        <div className="min-w-0">
                          <span className="chip bg-white/15 text-white">LỊCH SỬ 7 • KẾT NỐI TRI THỨC</span>
                          <h4 className="text-lg font-black leading-snug mt-1">Bài 14: Ba lần kháng chiến chống quân xâm lược Mông - Nguyên (1258 - 1288)</h4>
                        </div>
                        <span className="chip bg-duo-green text-white ml-auto shrink-0 hidden sm:inline-flex">Sẵn sàng</span>
                      </div>
                      <div className="p-5">
                        <p className="text-sm font-semibold text-duo-wolf leading-relaxed">
                          Bộ câu hỏi trắc nghiệm tương tác về Hội nghị Bình Than, Vạn Kiếp, chiến thắng Chương Dương Độ và giải phóng Thăng Long.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="chip bg-duo-blue-light text-duo-blue-dark">
                            <Users className="w-3 h-3" /> {total} học sinh
                          </span>
                          <span className="chip bg-duo-gold-light text-duo-gold-dark">10 câu trắc nghiệm</span>
                          <span className="chip bg-duo-green-light text-duo-green-dark">12 phút</span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-5">
                          <button onClick={() => handleLaunchLesson()} className="btn-3d btn-green">
                            <Play className="w-4 h-4 fill-white" /> Bắt đầu
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab('library');
                              onShowToast('📚 Đã chuyển đến Thư viện để xem danh sách câu hỏi.');
                            }}
                            className="btn-3d btn-outline"
                          >
                            <Eye className="w-4 h-4" /> Xem thư viện
                          </button>
                          <button onClick={() => setIsAiModalOpen(true)} className="btn-3d btn-outline !text-duo-purple-dark">
                            <Sparkles className="w-4 h-4" /> Tạo đề AI
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {courseStages.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-4 p-3 rounded-2xl border-2 border-duo-swan">
                          <span
                            className="w-12 h-11 rounded-[50%] flex items-center justify-center shrink-0"
                            style={{
                              background: s.status === 'locked' ? '#e7d9bc' : '#0f766e',
                              boxShadow: `0 4px 0 ${s.status === 'locked' ? '#b7b7b7' : '#134e4a'}`,
                            }}
                          >
                            {s.status === 'locked' ? (
                              <Lock className="w-5 h-5 text-duo-hare" />
                            ) : s.status === 'done' ? (
                              <Check className="w-6 h-6 text-white stroke-[3]" />
                            ) : (
                              <span className="font-black text-white">{i + 1}</span>
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-duo-ink">{s.name}</p>
                            <div className="progress-duo progress-sm mt-1.5">
                              <div className="progress-fill" style={{ width: `${total ? (s.done / total) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <span className="text-sm font-black text-duo-wolf shrink-0">
                            {s.done}/{total}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ===== Cột phải ===== */}
                <div className="lg:col-span-4 space-y-4">
                  <section className="card-duo p-5 text-center">
                    <Mascot size={84} mood="happy" accessory="scholar" className="mx-auto" />
                    <h4 className="font-black text-lg text-duo-ink mt-1">Tạo bài giảng mới</h4>
                    <p className="text-sm font-semibold text-duo-wolf mb-4">Dùng mẫu có sẵn hoặc để AI soạn đề chuẩn SGK.</p>
                    <button onClick={() => setIsCreateQuizOpen(true)} className="btn-3d btn-blue w-full">
                      Tạo bài giảng mới
                    </button>
                  </section>

                  <section className="card-duo p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-black text-lg text-duo-ink">Báo cáo mới nhất</h4>
                      <button onClick={handleExportExcel} className="text-xs font-black text-duo-blue uppercase tracking-wider">
                        Tất cả
                      </button>
                    </div>
                    <div className="rounded-2xl bg-duo-polar p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-duo-ink">{className ? `Lớp ${className} – Bài 14` : 'Lớp của bạn'}</span>
                        <span className="chip bg-duo-green-light text-duo-green-dark">Đúng {pct(summary?.avg_accuracy)}</span>
                      </div>
                      <div className="progress-duo progress-sm my-2">
                        <div className="progress-fill" style={{ width: `${total ? (practiced / total) * 100 : 0}%` }} />
                      </div>
                      <p className="text-xs font-bold text-duo-wolf mb-3">
                        {practiced} / {total} học sinh đã làm bài
                      </p>
                      <button onClick={handleExportExcel} className="btn-3d btn-outline btn-sm w-full !text-duo-green-dark">
                        <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
                      </button>
                    </div>
                  </section>

                  <section className="card-duo p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-black text-lg text-duo-ink">Top học sinh</h4>
                      <button onClick={() => setActiveTab('groups')} className="text-xs font-black text-duo-blue uppercase tracking-wider">
                        Cả lớp
                      </button>
                    </div>
                    {roster.length === 0 ? (
                      <p className="text-sm font-bold text-duo-wolf">{clsLoading ? 'Đang tải…' : 'Lớp chưa có học sinh nào.'}</p>
                    ) : (
                      <div className="space-y-2.5">
                        {roster.slice(0, 3).map((st, i) => (
                          <div key={st.id} className="flex items-center gap-3">
                            <span className="w-6 text-center font-black" style={{ color: ['#92400e', '#9a9a9a', '#cd7f32'][i] }}>
                              {i + 1}
                            </span>
                            <span className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-xs" style={{ background: avatarColor(st.full_name) }}>
                              {initialsOf(st.full_name)}
                            </span>
                            <span className="flex-1 font-extrabold text-sm truncate">{st.full_name}</span>
                            <span className="font-black text-sm text-duo-wolf">{st.xp.toLocaleString('vi-VN')} KN</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>

              {/* ===== Việc cần làm ===== */}
              <section className="card-duo p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-black text-lg text-duo-ink">Việc cần làm</h3>
                    <span className="chip bg-duo-green-light text-duo-green-dark">
                      {completedCount}/{visibleCount} đã xong
                    </span>
                  </div>
                  <button onClick={() => setIsTodoListModalOpen(true)} className="text-xs font-black text-duo-blue uppercase tracking-wider">
                    Xem tất cả
                  </button>
                </div>
                <div className="progress-duo progress-sm mb-3">
                  <div className="progress-fill" style={{ width: `${visibleCount ? (completedCount / visibleCount) * 100 : 0}%` }} />
                </div>
                <div className="divide-y-2 divide-duo-swan">
                  {tasks
                    .filter((t) => t.status !== 'skipped')
                    .slice(0, 4)
                    .map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div key={task.id} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleTask(task.id)}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                                isDone ? 'bg-duo-green border-duo-green-dark text-white' : 'border-duo-swan hover:border-duo-green bg-white'
                              }`}
                              title={isDone ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                            >
                              {isDone && <Check className="w-5 h-5 stroke-[3.5]" />}
                            </button>
                            <div className="min-w-0">
                              <h4 className={`font-black text-sm truncate ${isDone ? 'line-through text-duo-hare' : 'text-duo-ink'}`}>{task.title}</h4>
                              <p className="text-xs font-semibold text-duo-wolf truncate">{task.description}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleExecuteAction(task.actionType)}
                            className="btn-3d btn-outline btn-icon btn-sm shrink-0"
                            title={task.actionLabel || 'Chi tiết'}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </section>
            </div>
          </main>
        )}
      </div>

      {/* ===== Modals ===== */}
      <AiQuizModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSaveQuestions={(count) => {
          setIsAiModalOpen(false);
          onShowToast(`✅ Đã thêm ${count} câu hỏi trắc nghiệm mới vào Bài 13!`);
        }}
      />

      {isCreateQuizOpen && (
        <QuizCreatorView
          folders={initialFolders}
          onSaveQuiz={handleSaveQuizFromHeader}
          onExit={() => setIsCreateQuizOpen(false)}
          onOpenAiGenerator={() => {
            setIsCreateQuizOpen(false);
            setIsAiModalOpen(true);
          }}
          onShowToast={onShowToast}
        />
      )}

      {isCreateStoryOpen && (
        <StoryCreatorView folders={initialFolders} onSaveStory={handleSaveStoryFromHeader} onExit={() => setIsCreateStoryOpen(false)} onShowToast={onShowToast} />
      )}

      <TextbookModal isOpen={isTextbookModalOpen} onClose={() => setIsTextbookModalOpen(false)} pageNumber={68} />

      <TodoListModal
        isOpen={isTodoListModalOpen}
        onClose={() => setIsTodoListModalOpen(false)}
        tasks={tasks}
        onToggleComplete={toggleTask}
        onSkipTask={handleSkipTask}
        onRestoreTask={handleRestoreTask}
        onExecuteAction={handleExecuteAction}
      />

      <LiveHostModal
        isOpen={liveTitle !== null}
        onClose={() => setLiveTitle(null)}
        title={liveTitle ?? DEFAULT_LESSON}
        token={token}
        onShowToast={onShowToast}
        onSessionExpired={onSessionExpired}
        onSaved={handleLiveSaved}
        students={rosterNames}
      />
    </div>
  );
};

// ============================================================================
// auth/TopBar – thanh trên cùng sau khi đăng nhập
// ============================================================================

interface TopBarProps {
  user: AuthUser;
  onChangePassword: () => void;
  onLogout: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ user, onChangePassword, onLogout }) => {
  const isAdmin = user.role === 'admin';
  return (
    <div className="bg-white border-b-2 border-duo-swan px-3 sm:px-5 py-2 flex items-center justify-between gap-3 z-50 relative shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {isAdmin ? (
          <span className="chip bg-duo-gold text-[#6b4400] shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" /> TRANG QUẢN TRỊ
          </span>
        ) : (
          <span className="chip bg-duo-green-light text-duo-green-dark shrink-0">ĐÔNG A STUDIO</span>
        )}
        <span className="hidden md:inline text-xs font-bold text-duo-hare truncate">
          {isAdmin
            ? 'Cấp tài khoản và theo dõi toàn bộ giáo viên, học sinh của trường'
            : user.role === 'teacher'
            ? `Không gian Giảng viên${user.class_name ? ` • Lớp ${user.class_name}` : ''}: theo dõi học sinh, tổ chức thi đấu & soạn học liệu AI`
            : `Không gian Học sinh${user.class_name ? ` • Lớp ${user.class_name}` : ''}: game Hào Khí Đông A`}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center" style={{ background: avatarColor(user.username) }}>
          {initialsOf(user.full_name)}
        </span>
        <div className="hidden lg:block leading-tight">
          <span className="block text-sm font-black text-duo-ink max-w-[180px] truncate">{user.full_name}</span>
          <span className={`chip !py-0 !text-[10px] ${ROLE_CHIP[user.role]}`}>{ROLE_LABEL[user.role]}</span>
        </div>
        <button onClick={onChangePassword} className="btn-3d btn-outline btn-sm btn-icon !text-duo-wolf" title="Đổi mật khẩu">
          <KeyRound className="w-4 h-4" />
        </button>
        <button onClick={onLogout} className="btn-3d btn-outline btn-sm !text-duo-red" title="Đăng xuất" aria-label="Đăng xuất">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// auth/routes – đường dẫn riêng cho từng trang
// ============================================================================

type Portal = 'admin' | 'teacher' | 'student';
type Route = Portal | 'home';

/** Đường dẫn riêng của từng trang */
const PORTAL_PATH: Record<Portal, string> = { student: 'hoc-sinh', teacher: 'giao-vien', admin: 'admin' };
const PORTAL_TITLE: Record<Portal, string> = { student: 'Trang học sinh', teacher: 'Trang giáo viên', admin: 'Trang quản trị' };

/** Mở file HTML trực tiếp (file://) thì dùng #/hoc-sinh, #/giao-vien, #/admin */
const isHashRouting = () => window.location.protocol === 'file:' || window.location.hash.startsWith('#/');

const basePath = () => {
  const p = window.location.pathname.replace(/\/(hoc-sinh|giao-vien|admin)\/?$/, '/');
  return p.endsWith('/') ? p : `${p}/`;
};

const currentRoute = (): Route => {
  const key = isHashRouting()
    ? window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '')
    : window.location.pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  return (Object.keys(PORTAL_PATH) as Portal[]).find((p) => PORTAL_PATH[p] === key) ?? 'home';
};

/** Địa chỉ đầy đủ của một trang (dùng để in phiếu tài khoản) */
const routeHref = (route: Route) =>
  isHashRouting()
    ? `${window.location.origin}${window.location.pathname}${route === 'home' ? '' : `#/${PORTAL_PATH[route]}`}`
    : `${window.location.origin}${basePath()}${route === 'home' ? '' : PORTAL_PATH[route]}`;

const goTo = (route: Route) => {
  if (isHashRouting()) {
    window.location.hash = route === 'home' ? '' : `#/${PORTAL_PATH[route]}`;
    return;
  }
  window.history.pushState(null, '', `${basePath()}${route === 'home' ? '' : PORTAL_PATH[route]}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

// ============================================================================
// auth/HomeChooser – trang chủ chọn vai trò
// ============================================================================

const HomeChooser: React.FC = () => (
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

// ============================================================================
// auth/LoginScreen – màn đăng nhập riêng cho từng trang
// ============================================================================

const PORTAL_THEME: Record<
  Portal,
  { heading: string; sub: string; btn: string; chip: string; placeholder: string; panel: string; panelTitle: string; panelText: string }
> = {
  student: {
    heading: 'Học sinh đăng nhập',
    sub: 'Dùng tài khoản thầy cô / nhà trường cấp cho em',
    btn: 'btn-red',
    chip: 'bg-son-nhat text-son-chu',
    placeholder: 'vd: long.nv',
    panel: 'bg-gradient-to-br from-[#b91c1c] via-[#991b1b] to-[#7f1d1d]',
    panelTitle: 'Vào Điền Trang Đông A!',
    panelText: 'Xây căn cứ, chiêu mộ danh tướng nhà Trần và ra trận theo kế sách lịch sử – kiến thức là vũ khí.',
  },
  teacher: {
    heading: 'Giáo viên đăng nhập',
    sub: 'Dùng tài khoản quản trị viên nhà trường cấp',
    btn: 'btn-purple',
    chip: 'bg-duo-purple-light text-kh-purple',
    placeholder: 'vd: gv.hoa.tt',
    panel: 'kahoot-bg',
    panelTitle: 'Không gian giáo viên',
    panelText: 'Theo dõi tiến độ thật của học sinh, câu sai nhiều nhất và mức nắm vững theo chủ đề; tổ chức thi đấu trực tiếp và soạn đề bằng AI.',
  },
  admin: {
    heading: 'Quản trị viên',
    sub: 'Đăng nhập để cấp và quản lý tài khoản',
    btn: 'btn-gold',
    chip: 'bg-duo-gold-light text-duo-gold-dark',
    placeholder: 'admin',
    panel: 'bg-gradient-to-br from-[#1f2937] via-[#111827] to-[#0b1020]',
    panelTitle: 'Trang quản trị Đông A',
    panelText: 'Cấp tài khoản cho giáo viên và học sinh, theo dõi tiến độ học tập thật của toàn trường.',
  },
};

const LoginScreen: React.FC<{ portal: Portal; onLogin: (token: string, user: AuthUser) => void; notice?: string | null }> = ({ portal, onLogin, notice }) => {
  const theme = PORTAL_THEME[portal];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Hãy nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
        body: { username: username.trim(), password, portal },
      });
      onLogin(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const panelIcon =
    portal === 'student' ? (
      <Mascot size={210} accessory="conical" mood="excited" bob />
    ) : portal === 'teacher' ? (
      <div className="flex flex-col items-center">
        <div className="w-28 h-28 rounded-3xl bg-white/15 flex items-center justify-center">
          <Presentation className="w-16 h-16 text-white" />
        </div>
        <Mascot size={110} accessory="scholar" mood="happy" className="-mt-6" />
      </div>
    ) : (
      <div className="w-28 h-28 rounded-3xl bg-duo-gold flex items-center justify-center shadow-[0_6px_0_#92400e]">
        <ShieldCheck className="w-16 h-16 text-[#6b4400]" />
      </div>
    );

  const others = (['student', 'teacher'] as Portal[]).filter((p) => p !== portal);

  return (
    <div className="min-h-screen w-full flex paper-bg">
      {/* Minh họa bên trái */}
      <div className={`hidden lg:flex flex-1 ${theme.panel} text-white relative overflow-hidden flex-col justify-between p-10`}>
        {portal === 'teacher' && (
          <div className="absolute inset-0 pointer-events-none">
            {ANSWER_STYLES.map((s, i) => (
              <div key={s.shape} className="absolute animate-float-slow" style={{ left: `${12 + i * 22}%`, top: `${i % 2 ? 72 : 16}%`, animationDelay: `${i * 0.5}s` }}>
                <KahootShape shape={s.shape} size={44 + i * 6} color={s.bg} />
              </div>
            ))}
          </div>
        )}
        {portal === 'student' && (
          <>
            <div className="absolute top-44 left-[10%] w-28 h-9 bg-white/25 rounded-full animate-float-slow" />
            <div className="absolute top-32 right-[14%] w-36 h-11 bg-white/20 rounded-full animate-float-slow" style={{ animationDelay: '1s' }} />
          </>
        )}
        {portal === 'admin' && (
          <>
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-duo-gold/10" />
            <div className="absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-duo-green/10" />
          </>
        )}
        <button onClick={() => goTo('home')} className="relative w-fit" title="Về trang chủ">
          <BrandLogo tone="white" subtitle={PORTAL_TITLE[portal]} />
        </button>
        <div className="relative flex flex-col items-center text-center">
          {panelIcon}
          <h2 className="text-3xl font-black mt-6 leading-tight">{theme.panelTitle}</h2>
          <p className="text-white/80 font-bold mt-2 max-w-md">{theme.panelText}</p>
        </div>
        <p className="relative text-xs font-bold text-white/75">© Đông A EDU · Lịch sử và Địa lí 7</p>
      </div>

      {/* Biểu mẫu */}
      <div className="flex-1 lg:max-w-xl flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <button type="button" onClick={() => goTo('home')} className="text-sm font-black text-duo-hare hover:text-duo-wolf mb-6 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Trang chủ
          </button>
          <div className="lg:hidden flex flex-col items-center mb-5">{panelIcon}</div>
          <span className={`chip ${theme.chip} mx-auto flex w-fit mb-2 uppercase`}>{PORTAL_TITLE[portal]}</span>
          <h1 className="text-3xl font-black text-duo-ink text-center">{theme.heading}</h1>
          <p className="text-sm font-bold text-duo-wolf text-center mt-1 mb-6">{theme.sub}</p>

          {notice && <div className="mb-4 rounded-2xl bg-duo-blue-light text-duo-blue-dark font-bold text-sm px-4 py-3">{notice}</div>}

          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5" htmlFor="login-username">
            Tên đăng nhập
          </label>
          <div className="relative mb-4">
            <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
            <input
              id="login-username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={theme.placeholder}
              className="input-duo !pl-11 !py-3"
            />
          </div>

          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5" htmlFor="login-password">
            Mật khẩu
          </label>
          <div className="relative mb-4">
            <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              className="input-duo !pl-11 !pr-11 !py-3"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-duo-hare hover:text-duo-wolf"
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3 flex items-start gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} className={`btn-3d btn-lg w-full ${theme.btn}`}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>

          <div className="mt-6 rounded-2xl bg-duo-polar p-4 text-sm font-semibold text-duo-wolf leading-relaxed">
            {portal === 'admin' ? (
              <p>Trang này chỉ dành cho quản trị viên nhà trường.</p>
            ) : (
              <>
                <p>
                  <strong className="text-duo-ink">Chưa có tài khoản?</strong> Tài khoản do quản trị viên nhà trường cấp.
                </p>
                <p className="mt-1">
                  <strong className="text-duo-ink">Quên mật khẩu?</strong> Nhờ quản trị viên đặt lại mật khẩu tạm.
                </p>
              </>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {others.map((p) => (
                <button key={p} type="button" onClick={() => goTo(p)} className="font-black text-duo-blue hover:underline">
                  {p === 'student' ? 'Em là học sinh? →' : 'Bạn là giáo viên? →'}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// auth/ChangePasswordScreen
// ============================================================================

const ChangePasswordScreen: React.FC<{
  user: AuthUser;
  token: string;
  forced: boolean;
  onDone: (token: string, user: AuthUser) => void;
  onCancel: () => void;
}> = ({ user, token, forced, onDone, onCancel }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return setError('Mật khẩu mới cần ít nhất 6 ký tự.');
    if (next !== confirm) return setError('Mật khẩu nhập lại chưa khớp.');
    if (next === current) return setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/change-password', {
        token,
        body: { current_password: current, new_password: next },
      });
      onDone(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đổi được mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="mb-4">
      <label htmlFor={id} className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input id={id} type={show ? 'text' : 'password'} autoComplete={auto} value={value} onChange={(e) => set(e.target.value)} className="input-duo !py-3" />
    </div>
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-duo-polar px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl border-2 border-duo-swan shadow-[0_6px_0_#e7d9bc] p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <Mascot size={100} mood="thinking" accessory="scholar" />
          <h1 className="text-2xl font-black text-duo-ink mt-2">{forced ? 'Đặt mật khẩu mới' : 'Đổi mật khẩu'}</h1>
          <p className="text-sm font-bold text-duo-wolf mt-1">
            {forced
              ? `Chào ${user.full_name}! Đây là lần đăng nhập đầu tiên với mật khẩu tạm – hãy đặt mật khẩu của riêng mình.`
              : `Tài khoản: ${user.username}`}
          </p>
        </div>
        {field('cp-current', forced ? 'Mật khẩu tạm được cấp' : 'Mật khẩu hiện tại', current, setCurrent, 'current-password')}
        {field('cp-new', 'Mật khẩu mới (tối thiểu 6 ký tự)', next, setNext, 'new-password')}
        {field('cp-confirm', 'Nhập lại mật khẩu mới', confirm, setConfirm, 'new-password')}
        <label className="flex items-center gap-2 text-sm font-bold text-duo-wolf mb-4 cursor-pointer select-none">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="w-4 h-4 accent-duo-green" />
          Hiện mật khẩu
        </label>
        {error && (
          <div role="alert" className="mb-4 rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="btn-3d btn-outline !text-duo-wolf">
            {forced ? 'Đăng xuất' : 'Huỷ'}
          </button>
          <button type="submit" disabled={loading} className="btn-3d btn-green flex-1">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Lưu mật khẩu
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// admin/Modals – cấp tài khoản, danh sách mật khẩu, xác nhận
// ============================================================================

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4 animate-in" onClick={onClose}>
    <div
      className={`bg-white rounded-3xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-hidden flex flex-col shadow-2xl zoom-in-95`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b-2 border-duo-swan">
        <h3 className="text-xl font-black text-duo-ink">{title}</h3>
        <button onClick={onClose} className="text-duo-hare hover:text-duo-wolf" title="Đóng">
          <X className="w-6 h-6 stroke-[3]" />
        </button>
      </div>
      <div className="overflow-y-auto">{children}</div>
    </div>
  </div>
);

const RolePicker: React.FC<{ value: 'teacher' | 'student'; onChange: (r: 'teacher' | 'student') => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-2">
    {(['teacher', 'student'] as const).map((r) => (
      <button
        key={r}
        type="button"
        onClick={() => onChange(r)}
        className={`rounded-2xl border-2 px-4 py-3 flex items-center gap-2 font-black text-sm transition ${
          value === r ? (r === 'teacher' ? 'border-kh-purple bg-duo-purple-light text-kh-purple' : 'border-duo-green bg-duo-green-light text-duo-green-dark') : 'border-duo-swan text-duo-wolf hover:bg-duo-polar'
        }`}
      >
        {r === 'teacher' ? <Presentation className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
        {ROLE_LABEL[r]}
      </button>
    ))}
  </div>
);

const CreateAccountModal: React.FC<{
  token: string;
  defaultRole: 'teacher' | 'student';
  classes: string[];
  onClose: () => void;
  onCreated: (creds: AccountCredential[]) => void;
}> = ({ token, defaultRole, classes, onClose, onCreated }) => {
  const [role, setRole] = useState<'teacher' | 'student'>(defaultRole);
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState(classes[0] ?? '7A1');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) return setError('Họ tên cần ít nhất 2 ký tự.');
    if (username && !/^[a-z0-9._-]{3,32}$/.test(username.trim().toLowerCase()))
      return setError('Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm, gạch (3–32 ký tự).');
    if (password && password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    setLoading(true);
    setError(null);
    try {
      const cred = await apiRequest<AccountCredential>('/api/admin/users', {
        token,
        body: {
          full_name: fullName.trim(),
          role,
          class_name: className.trim() || null,
          username: username.trim() || null,
          password: password || null,
        },
      });
      onCreated([cred]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Cấp tài khoản mới" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <RolePicker value={role} onChange={setRole} />
        <div>
          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">Họ và tên *</label>
          <input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="vd: Nguyễn Văn Long" className="input-duo" />
        </div>
        <div>
          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">{role === 'teacher' ? 'Lớp phụ trách' : 'Lớp'}</label>
          <input list="class-options" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="vd: 7A1" className="input-duo" />
          <datalist id="class-options">
            {classes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">Tên đăng nhập</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Để trống: tự sinh" className="input-duo" />
          </div>
          <div>
            <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">Mật khẩu tạm</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Để trống: tự sinh" className="input-duo" />
          </div>
        </div>
        <p className="text-xs font-bold text-duo-hare">Người dùng sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
        {error && <div className="rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3">{error}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-3d btn-ghost">
            Huỷ
          </button>
          <button type="submit" disabled={loading} className="btn-3d btn-green">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Cấp tài khoản
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const BulkCreateModal: React.FC<{
  token: string;
  defaultRole: 'teacher' | 'student';
  classes: string[];
  onClose: () => void;
  onCreated: (creds: AccountCredential[]) => void;
}> = ({ token, defaultRole, classes, onClose, onCreated }) => {
  const [role, setRole] = useState<'teacher' | 'student'>(defaultRole);
  const [className, setClassName] = useState(classes[0] ?? '7A1');
  const [names, setNames] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = names
    .split(/\r?\n/)
    .map((n) => n.replace(/^\s*\d+[.)\-\s]+/, '').trim())
    .filter(Boolean);

  const submit = async () => {
    if (list.length === 0) return setError('Hãy dán danh sách họ tên, mỗi dòng một người.');
    if (list.length > 200) return setError('Mỗi lần tối đa 200 người.');
    if (list.some((n) => n.length < 2)) return setError('Có dòng chưa đủ họ tên (ít nhất 2 ký tự).');
    setLoading(true);
    setError(null);
    try {
      const creds = await apiRequest<AccountCredential[]>('/api/admin/users/bulk', {
        token,
        body: { role, class_name: className.trim() || null, full_names: list },
      });
      onCreated(creds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Cấp tài khoản hàng loạt" onClose={onClose}>
      <div className="p-6 space-y-4">
        <RolePicker value={role} onChange={setRole} />
        <div>
          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">Lớp</label>
          <input list="bulk-class-options" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="vd: 7A1" className="input-duo" />
          <datalist id="bulk-class-options">
            {classes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-black text-duo-wolf uppercase tracking-wider">Danh sách họ tên (mỗi dòng một người)</label>
            <span className="chip bg-duo-blue-light text-duo-blue-dark">{list.length} người</span>
          </div>
          <textarea
            autoFocus
            rows={9}
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder={'Nguyễn Văn Long\nTrần Quốc Anh\nLê Minh Thư\n...'}
            className="input-duo resize-y font-semibold"
          />
          <p className="text-xs font-bold text-duo-hare mt-1">Có thể dán thẳng cột họ tên từ Excel. Số thứ tự đầu dòng sẽ tự bỏ.</p>
        </div>
        {error && <div className="rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3">{error}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-3d btn-ghost">
            Huỷ
          </button>
          <button onClick={submit} disabled={loading || list.length === 0} className="btn-3d btn-green">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UsersRound className="w-4 h-4" />} Cấp {list.length || ''} tài khoản
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const CredentialsModal: React.FC<{ creds: AccountCredential[]; title: string; onClose: () => void; onToast: (m: string) => void }> = ({
  creds,
  title,
  onClose,
  onToast,
}) => {
  const loginUrlOf = (c: AccountCredential) => routeHref(c.user.role as Portal);

  const copyAll = async () => {
    const text = creds
      .map((c) => `${c.user.full_name} (${c.user.class_name ?? ROLE_LABEL[c.user.role]}) – Trang: ${loginUrlOf(c)} – Tên đăng nhập: ${c.user.username} – Mật khẩu: ${c.password}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      onToast('📋 Đã sao chép danh sách tài khoản');
    } catch {
      onToast('⚠️ Trình duyệt không cho sao chép – hãy dùng Tải CSV');
    }
  };

  const downloadCsv = () => {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ['Họ tên', 'Vai trò', 'Lớp', 'Trang đăng nhập', 'Tên đăng nhập', 'Mật khẩu tạm'],
      ...creds.map((c) => [c.user.full_name, ROLE_LABEL[c.user.role], c.user.class_name ?? '', loginUrlOf(c), c.user.username, c.password]),
    ];
    const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tai-khoan-dong-a-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printCards = () => {
    const w = window.open('', '_blank');
    if (!w) return onToast('⚠️ Trình duyệt chặn cửa sổ in – hãy cho phép pop-up');
    const cards = creds
      .map(
        (c) => `<div class="card"><div class="brand">đông a</div><div class="name">${escapeHtml(c.user.full_name)}</div>
        <div class="meta">${escapeHtml(ROLE_LABEL[c.user.role])}${c.user.class_name ? ' • Lớp ' + escapeHtml(c.user.class_name) : ''}</div>
        <div class="row"><span>Tên đăng nhập</span><b>${escapeHtml(c.user.username)}</b></div>
        <div class="row"><span>Mật khẩu tạm</span><b>${escapeHtml(c.password)}</b></div>
        <div class="foot">Đăng nhập tại ${escapeHtml(loginUrlOf(c))} và đổi mật khẩu ở lần đầu.</div></div>`
      )
      .join('');
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu tài khoản Đông A</title><style>
      body{font-family:Nunito,Segoe UI,sans-serif;margin:16px;color:#1c1917}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .card{border:2px dashed #6b6560;border-radius:14px;padding:14px;break-inside:avoid}
      .brand{color:#0f766e;font-weight:900;font-size:18px}.name{font-weight:900;font-size:17px;margin-top:4px}
      .meta{color:#777;font-size:13px;margin-bottom:8px}.row{display:flex;justify-content:space-between;font-size:14px;padding:3px 0}
      .row b{font-family:Consolas,monospace;font-size:15px}.foot{color:#777;font-size:11px;margin-top:8px}
    </style></head><body><div class="grid">${cards}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <ModalShell title={title} onClose={onClose} wide>
      <div className="p-6">
        <div className="rounded-2xl bg-duo-gold-light text-duo-gold-dark font-bold text-sm px-4 py-3 flex items-start gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          Mật khẩu tạm chỉ hiển thị MỘT lần. Hãy tải CSV hoặc in phiếu để phát cho {creds.length > 1 ? `${creds.length} người dùng` : 'người dùng'} trước khi đóng.
        </div>
        <div className="rounded-2xl bg-duo-blue-light text-duo-blue-dark font-bold text-sm px-4 py-3 mb-4 space-y-0.5">
          {creds.some((c) => c.user.role === 'student') && (
            <p>
              Học sinh đăng nhập tại: <span className="font-mono font-black">{routeHref('student')}</span>
            </p>
          )}
          {creds.some((c) => c.user.role === 'teacher') && (
            <p>
              Giáo viên đăng nhập tại: <span className="font-mono font-black">{routeHref('teacher')}</span>
            </p>
          )}
        </div>
        <div className="overflow-x-auto rounded-2xl border-2 border-duo-swan">
          <table className="w-full text-sm">
            <thead className="bg-duo-polar text-duo-wolf text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-black">Họ tên</th>
                <th className="text-left px-4 py-2.5 font-black">Lớp</th>
                <th className="text-left px-4 py-2.5 font-black">Tên đăng nhập</th>
                <th className="text-left px-4 py-2.5 font-black">Mật khẩu tạm</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-duo-swan">
              {creds.map((c) => (
                <tr key={c.user.id}>
                  <td className="px-4 py-2.5 font-black text-duo-ink">{c.user.full_name}</td>
                  <td className="px-4 py-2.5 font-bold text-duo-wolf">{c.user.class_name ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-duo-blue-dark">{c.user.username}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-duo-ink">{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-end gap-3 mt-5">
          <button onClick={copyAll} className="btn-3d btn-outline">
            <ClipboardCopy className="w-4 h-4" /> Sao chép
          </button>
          <button onClick={downloadCsv} className="btn-3d btn-outline !text-duo-green-dark">
            <Download className="w-4 h-4" /> Tải CSV
          </button>
          <button onClick={printCards} className="btn-3d btn-outline !text-kh-purple">
            <Printer className="w-4 h-4" /> In phiếu
          </button>
          <button onClick={onClose} className="btn-3d btn-green">
            Xong
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const ConfirmModal: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ title, message, confirmLabel, danger, busy, onConfirm, onClose }) => (
  <ModalShell title={title} onClose={onClose}>
    <div className="p-6">
      <div className="flex items-start gap-4">
        <Mascot size={72} mood={danger ? 'sad' : 'thinking'} />
        <div className="text-sm font-bold text-duo-wolf leading-relaxed">{message}</div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="btn-3d btn-ghost">
          Huỷ
        </button>
        <button onClick={onConfirm} disabled={busy} className={`btn-3d ${danger ? 'btn-red' : 'btn-blue'}`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {confirmLabel}
        </button>
      </div>
    </div>
  </ModalShell>
);

// ============================================================================
// admin/AdminView – quản lý toàn bộ giáo viên & học sinh
// ============================================================================

type AdminTab = 'overview' | 'teacher' | 'student';

const AdminView: React.FC<{ token: string; me: AuthUser; onShowToast: (m: string) => void; onSessionExpired: () => void }> = ({
  token,
  me,
  onShowToast,
  onSessionExpired,
}) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [modal, setModal] = useState<null | 'create' | 'bulk'>(null);
  const [creds, setCreds] = useState<{ title: string; items: AccountCredential[] } | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'reset' | 'delete'; user: AuthUser }>(null);
  const [busy, setBusy] = useState(false);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      onShowToast(`⚠️ ${err instanceof Error ? err.message : 'Có lỗi xảy ra'}`);
    },
    [onSessionExpired, onShowToast]
  );

  const reload = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        apiRequest<AdminUser[]>('/api/admin/users', { token }),
        apiRequest<AdminStats>('/api/admin/stats', { token }),
      ]);
      setUsers(list);
      setStats(s);
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired();
      else setLoadError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => {
    reload();
  }, [reload]);

  const classes = stats?.classes ?? [];
  const managed = users.filter((u) => u.role !== 'admin');

  const visible = managed.filter((u) => {
    if (tab !== 'overview' && u.role !== tab) return false;
    if (classFilter !== 'all' && (u.class_name ?? '') !== classFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || u.full_name.toLowerCase().includes(q) || u.username.includes(q);
  });

  const onCreated = (items: AccountCredential[]) => {
    setModal(null);
    setCreds({ title: items.length > 1 ? `Đã cấp ${items.length} tài khoản` : 'Đã cấp tài khoản', items });
    onShowToast(`✅ Đã cấp ${items.length} tài khoản mới`);
    reload();
  };

  const toggleActive = async (u: AuthUser) => {
    try {
      await apiRequest<AuthUser>(`/api/admin/users/${u.id}`, { method: 'PATCH', token, body: { is_active: !u.is_active } });
      onShowToast(u.is_active ? `🔒 Đã khoá tài khoản ${u.username}` : `🔓 Đã mở khoá tài khoản ${u.username}`);
      reload();
    } catch (err) {
      handleError(err);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'reset') {
        const cred = await apiRequest<AccountCredential>(`/api/admin/users/${confirm.user.id}/reset-password`, { method: 'POST', token });
        setCreds({ title: 'Mật khẩu tạm mới', items: [cred] });
      } else {
        await apiRequest<void>(`/api/admin/users/${confirm.user.id}`, { method: 'DELETE', token });
        onShowToast(`🗑️ Đã xoá tài khoản ${confirm.user.username}`);
      }
      setConfirm(null);
      reload();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ElementType; color: string; count?: number }> = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, color: '#d97706' },
    { id: 'teacher', label: 'Giáo viên', icon: Presentation, color: '#115e59', count: stats?.teachers },
    { id: 'student', label: 'Học sinh', icon: GraduationCap, color: '#0f766e', count: stats?.students },
  ];

  const statTiles = [
    { label: 'Giáo viên', value: stats?.teachers ?? 0, icon: <Presentation className="w-6 h-6" />, color: '#115e59' },
    { label: 'Học sinh', value: stats?.students ?? 0, icon: <GraduationCap className="w-6 h-6" />, color: '#0f766e' },
    { label: 'Đang hoạt động', value: stats?.active ?? 0, icon: <ShieldCheck className="w-6 h-6" />, color: '#0369a1' },
    { label: 'Chưa đăng nhập lần đầu', value: stats?.pending_first_login ?? 0, icon: <KeyRound className="w-6 h-6" />, color: '#c2410c' },
    { label: 'Số lớp', value: classes.length, icon: <School className="w-6 h-6" />, color: '#b91c1c' },
  ];

  const renderTable = (rows: AdminUser[]) => (
    <div className="card-duo overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-duo-polar text-duo-wolf text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-black">Họ tên</th>
              <th className="text-left px-4 py-3 font-black">Tên đăng nhập</th>
              <th className="text-left px-4 py-3 font-black">Vai trò • Lớp</th>
              <th className="text-left px-4 py-3 font-black">Trạng thái</th>
              <th className="text-left px-4 py-3 font-black">Tiến độ học tập</th>
              <th className="text-left px-4 py-3 font-black">Đăng nhập gần nhất</th>
              <th className="text-right px-4 py-3 font-black">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-duo-swan">
            {rows.map((u) => (
              <tr key={u.id} className={u.is_active ? 'hover:bg-duo-polar/60' : 'bg-duo-polar/70 text-duo-hare'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0" style={{ background: avatarColor(u.username) }}>
                      {initialsOf(u.full_name)}
                    </span>
                    <span className="font-black text-duo-ink">{u.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-duo-blue-dark">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`chip ${ROLE_CHIP[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                  {u.class_name && <span className="ml-1.5 font-bold text-duo-wolf">{u.class_name}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.is_active ? <span className="chip bg-duo-green-light text-duo-green-dark">Hoạt động</span> : <span className="chip bg-duo-red-light text-duo-red-dark">Đã khoá</span>}
                    {u.must_change_password && <span className="chip bg-duo-gold-light text-duo-gold-dark">Chưa đổi MK</span>}
                  </div>
                </td>
                <td className="px-4 py-3 font-bold text-duo-wolf whitespace-nowrap">
                  {u.role === 'student' ? (
                    <span>
                      <b className="text-duo-gold-dark">{(u.xp ?? 0).toLocaleString('vi-VN')} KN</b> • {u.lessons_completed ?? 0} chặng • {pct(u.accuracy)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 font-bold text-duo-wolf whitespace-nowrap">{formatDateTime(u.last_login_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setConfirm({ kind: 'reset', user: u })} className="btn-3d btn-outline btn-sm btn-icon !text-duo-blue" title="Đặt lại mật khẩu">
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      className={`btn-3d btn-outline btn-sm btn-icon ${u.is_active ? '!text-duo-orange' : '!text-duo-green'}`}
                      title={u.is_active ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}
                    >
                      {u.is_active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setConfirm({ kind: 'delete', user: u })} className="btn-3d btn-outline btn-sm btn-icon !text-duo-red" title="Xoá tài khoản">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="py-12 flex flex-col items-center text-center px-4">
          <Mascot size={90} mood="thinking" />
          <p className="font-black text-duo-ink mt-2">{managed.length === 0 ? 'Chưa có tài khoản nào' : 'Không tìm thấy kết quả phù hợp'}</p>
          <p className="text-sm font-bold text-duo-wolf">{managed.length === 0 ? 'Bấm "Cấp hàng loạt" để tạo tài khoản cho cả lớp.' : 'Thử đổi từ khoá hoặc bộ lọc lớp.'}</p>
        </div>
      )}
    </div>
  );

  const defaultRole: 'teacher' | 'student' = tab === 'teacher' ? 'teacher' : 'student';

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-white text-duo-ink">
      {/* Thanh bên */}
      <aside className="w-[88px] lg:w-64 border-r-2 border-duo-swan flex flex-col shrink-0 h-full py-5 px-3 lg:px-4">
        <div className="px-1 mb-6">
          <BrandLogo subtitle="Quản trị" className="hidden lg:flex" />
          <BrandLogo compact className="lg:hidden justify-center" />
        </div>
        <nav className="space-y-1.5 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  if (item.id === 'overview') {
                    setClassFilter('all');
                    setSearch('');
                  }
                }}
                className={`nav-duo justify-center lg:justify-start ${tab === item.id ? 'is-active' : ''}`}
                title={item.label}
              >
                <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color }}>
                  <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2.6} />
                </span>
                <span className="hidden lg:inline flex-1">{item.label}</span>
                {item.count !== undefined && <span className="hidden lg:inline-flex chip bg-duo-polar text-duo-wolf">{item.count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="hidden lg:block rounded-2xl bg-duo-gold-light p-3 text-xs font-bold text-duo-gold-dark">
          Đăng nhập với <span className="font-mono">{me.username}</span>
        </div>
      </aside>

      {/* Nội dung */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-duo-ink">
                {tab === 'overview' ? 'Quản trị tài khoản' : tab === 'teacher' ? 'Giáo viên' : 'Học sinh'}
              </h1>
              <p className="text-sm font-bold text-duo-wolf">
                {tab === 'overview' ? 'Cấp và quản lý tài khoản cho toàn bộ giáo viên, học sinh' : `${visible.length} tài khoản`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setModal('create')} className="btn-3d btn-outline">
                <UserPlus className="w-4 h-4" /> Cấp tài khoản
              </button>
              <button onClick={() => setModal('bulk')} className="btn-3d btn-green">
                <UsersRound className="w-4 h-4" /> Cấp hàng loạt
              </button>
            </div>
          </div>

          {loadError && (
            <div className="rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {loadError}
              </span>
              <button onClick={reload} className="btn-3d btn-red btn-sm">
                Thử lại
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-duo-green animate-spin" />
              <p className="font-bold text-duo-wolf mt-2">Đang tải danh sách tài khoản…</p>
            </div>
          ) : tab === 'overview' ? (
            <>
              <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {statTiles.map((s) => (
                  <div key={s.label} className="card-duo p-4">
                    <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white" style={{ background: s.color }}>
                      {s.icon}
                    </span>
                    <div className="font-black text-2xl text-duo-ink mt-2">{s.value}</div>
                    <div className="text-xs font-bold text-duo-hare">{s.label}</div>
                  </div>
                ))}
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(['student', 'teacher'] as Portal[]).map((p) => (
                  <div key={p} className="card-duo p-4 flex items-center gap-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${p === 'student' ? 'bg-duo-green' : 'bg-kh-purple'}`}>
                      {p === 'student' ? <GraduationCap className="w-6 h-6 text-white" /> : <Presentation className="w-6 h-6 text-white" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-duo-hare uppercase tracking-wider">{PORTAL_TITLE[p]}</p>
                      <p className="font-mono font-black text-duo-blue-dark truncate">{routeHref(p)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {stats?.storage === 'sqlite' && (
                <div className="rounded-2xl bg-duo-blue-light text-duo-blue-dark text-sm font-bold px-4 py-3 flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  Tài khoản đang lưu ở cơ sở dữ liệu cục bộ (SQLite) của backend. Khai báo DATABASE_URL (Supabase) để lưu lâu dài khi triển khai lên Render.
                </div>
              )}

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card-duo p-5">
                  <h3 className="font-black text-lg text-duo-ink mb-3">Theo lớp</h3>
                  {classes.length === 0 ? (
                    <p className="text-sm font-bold text-duo-wolf">Chưa có lớp nào. Khi cấp tài khoản, nhập tên lớp để nhóm học sinh.</p>
                  ) : (
                    <div className="space-y-3">
                      {classes.map((c) => {
                        const st = managed.filter((u) => u.role === 'student' && u.class_name === c).length;
                        const tc = managed.filter((u) => u.role === 'teacher' && u.class_name === c);
                        return (
                          <button
                            key={c}
                            onClick={() => {
                              setTab('student');
                              setClassFilter(c);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-duo-swan hover:bg-duo-polar text-left"
                          >
                            <span className="w-11 h-11 rounded-xl bg-duo-green text-white font-black flex items-center justify-center text-sm shrink-0">{c}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-duo-ink">Lớp {c}</p>
                              <p className="text-xs font-bold text-duo-wolf truncate">
                                {tc.length ? `GV: ${tc.map((t) => t.full_name).join(', ')}` : 'Chưa có giáo viên phụ trách'}
                              </p>
                            </div>
                            <span className="chip bg-duo-green-light text-duo-green-dark">{st} HS</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="card-duo p-5">
                  <h3 className="font-black text-lg text-duo-ink mb-3">Tài khoản mới cấp</h3>
                  {managed.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-4">
                      <Mascot size={90} mood="excited" accessory="crown" />
                      <p className="font-black text-duo-ink mt-2">Bắt đầu cấp tài khoản</p>
                      <p className="text-sm font-bold text-duo-wolf mb-4">Dán danh sách họ tên cả lớp để tạo tài khoản trong một lần.</p>
                      <button onClick={() => setModal('bulk')} className="btn-3d btn-green">
                        <UsersRound className="w-4 h-4" /> Cấp hàng loạt
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {[...managed]
                        .sort((a, b) => b.created_at.localeCompare(a.created_at))
                        .slice(0, 6)
                        .map((u) => (
                          <div key={u.id} className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0" style={{ background: avatarColor(u.username) }}>
                              {initialsOf(u.full_name)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-sm text-duo-ink truncate">{u.full_name}</p>
                              <p className="text-xs font-bold text-duo-hare font-mono">{u.username}</p>
                            </div>
                            <span className={`chip ${ROLE_CHIP[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="font-black text-lg text-duo-ink mb-3">Tất cả giáo viên & học sinh</h3>
                {renderTable(visible)}
              </section>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo họ tên hoặc tên đăng nhập…" className="input-duo !pl-10" />
                </div>
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="input-duo !w-auto">
                  <option value="all">Tất cả lớp</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      Lớp {c}
                    </option>
                  ))}
                </select>
              </div>
              {renderTable(visible)}
            </>
          )}
        </div>
      </main>

      {modal === 'create' && <CreateAccountModal token={token} defaultRole={defaultRole} classes={classes} onClose={() => setModal(null)} onCreated={onCreated} />}
      {modal === 'bulk' && <BulkCreateModal token={token} defaultRole={defaultRole} classes={classes} onClose={() => setModal(null)} onCreated={onCreated} />}
      {creds && <CredentialsModal title={creds.title} creds={creds.items} onClose={() => setCreds(null)} onToast={onShowToast} />}
      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'reset' ? 'Đặt lại mật khẩu?' : 'Xoá tài khoản?'}
          danger={confirm.kind === 'delete'}
          busy={busy}
          confirmLabel={confirm.kind === 'reset' ? 'Đặt lại' : 'Xoá vĩnh viễn'}
          message={
            confirm.kind === 'reset' ? (
              <>
                Mật khẩu hiện tại của <b className="text-duo-ink">{confirm.user.full_name}</b> ({confirm.user.username}) sẽ ngừng hoạt động và hệ thống cấp một mật khẩu tạm mới.
              </>
            ) : (
              <>
                Tài khoản <b className="text-duo-ink">{confirm.user.full_name}</b> ({confirm.user.username}) sẽ bị xoá và không đăng nhập được nữa. Nếu chỉ muốn tạm ngừng, hãy dùng nút Khoá.
              </>
            )
          }
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// App
// ============================================================================

/** Một phiên đăng nhập cho từng cổng: trang học tập (giáo viên, học sinh) hoặc trang quản trị */
const SessionApp: React.FC<{ portal: Portal }> = ({ portal }) => {
  const tokenKey = `donga_token_${portal}`;
  const [token, setToken] = useState<string | null>(() => readToken(tokenKey));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(() => readToken(tokenKey) !== null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastKey((k) => k + 1);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const startSession = useCallback(
    (newToken: string, newUser: AuthUser) => {
      saveToken(tokenKey, newToken);
      setToken(newToken);
      setUser(newUser);
      setLoginNotice(null);
    },
    [tokenKey]
  );

  const endSession = useCallback(
    (notice: string | null = null) => {
      saveToken(tokenKey, null);
      setToken(null);
      setUser(null);
      setChangingPassword(false);
      setLoginNotice(notice);
    },
    [tokenKey]
  );

  const onSessionExpired = useCallback(() => endSession('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.'), [endSession]);

  // Khôi phục phiên đã lưu
  useEffect(() => {
    const saved = readToken(tokenKey);
    if (!saved) return;
    apiRequest<AuthUser>('/api/auth/me', { token: saved })
      .then((u) => {
        if (u.role === portal) setUser(u);
        else {
          saveToken(tokenKey, null);
          setToken(null);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 0) {
          setLoginNotice(err.message);
        } else {
          saveToken(tokenKey, null);
          setToken(null);
        }
      })
      .finally(() => setChecking(false));
  }, [tokenKey, portal]);

  const toast = toastMessage && (
    <div
      key={toastKey}
      role="status"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] bg-white border-2 border-duo-swan text-duo-ink pl-2 pr-4 py-2 rounded-2xl shadow-[0_4px_0_#e7d9bc] flex items-center gap-2.5 text-sm font-extrabold max-w-[92vw] sm:max-w-md animate-pop-in"
    >
      <Mascot size={38} mood="excited" />
      <span>{toastMessage}</span>
    </div>
  );

  if (checking) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
        <Mascot size={120} mood="happy" bob />
        <p className="font-black text-duo-wolf mt-3 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang kiểm tra phiên đăng nhập…
        </p>
      </div>
    );
  }

  if (!user || !token) {
    return <LoginScreen portal={portal} onLogin={startSession} notice={loginNotice} />;
  }

  if (user.must_change_password || changingPassword) {
    return (
      <>
        <ChangePasswordScreen
          user={user}
          token={token}
          forced={user.must_change_password}
          onDone={(t, u) => {
            startSession(t, u);
            setChangingPassword(false);
            showToast('🔐 Đã lưu mật khẩu mới');
          }}
          onCancel={() => (user.must_change_password ? endSession() : setChangingPassword(false))}
        />
        {toast}
      </>
    );
  }

  if (user.role === 'student') {
    // Cổng học sinh là game "Hào Khí Đông A" với thanh HUD riêng (hồ sơ, đổi mật khẩu, đăng xuất)
    return (
      <>
        <StudentView
          token={token}
          user={user}
          onShowToast={showToast}
          onSessionExpired={onSessionExpired}
          onLogout={() => endSession('Đã đăng xuất. Hẹn gặp lại!')}
          onChangePassword={() => setChangingPassword(true)}
        />
        {toast}
      </>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden font-sans bg-giay">
      <TopBar user={user} onChangePassword={() => setChangingPassword(true)} onLogout={() => endSession('Đã đăng xuất. Hẹn gặp lại!')} />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {user.role === 'admin' ? (
          <AdminView token={token} me={user} onShowToast={showToast} onSessionExpired={onSessionExpired} />
        ) : (
          <TeacherView token={token} user={user} onShowToast={showToast} onSessionExpired={onSessionExpired} />
        )}
      </div>
      {toast}
    </div>
  );
};

export function App() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const sync = () => setRoute(currentRoute());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    document.title = route === 'home' ? 'Đông A – Học Sử vui như chơi' : `${PORTAL_TITLE[route]} – Đông A`;
  }, [route]);

  if (route === 'home') return <HomeChooser />;
  return <SessionApp key={route} portal={route} />;
}

export default App;
