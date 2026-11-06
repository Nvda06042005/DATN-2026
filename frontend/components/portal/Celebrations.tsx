/**
 * Chúc mừng và tạo nhân vật (Sprint 5): hàng đợi chúc mừng trong ứng dụng (lên cấp, huy hiệu, thẻ rơi chờ lật, đạt mục tiêu ngày, xong nhiệm vụ, quà, tổng kết giải đấu),
 * màn chọn lớp nhân vật lần đầu (HK.HS.011), chi tiết thẻ nhân vật (HK.HS.069) và ảnh thành tích để chia sẻ (HK.HS.078).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Award, Download, Share2, Sparkles, Trophy } from 'lucide-react-native';
import * as api from '@/api/gameApi';
import { errorMessage } from '@/api/client';
import { saveBlob } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { CardFace, iconOf, RARITY_COLOR } from '@/components/portal/GameKit';
import { Bar, Btn, Card, Chip, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { CardDetail, Celebration, CharacterClass, FlipResult, Hud } from '@/types/gamification';
import { RARITY_TEXT } from '@/types/gamification';

const STAT_TEXT: Array<[keyof NonNullable<CharacterClass['stats']>, string]> = [['hp', 'Sinh lực'], ['attack', 'Sức mạnh'], ['wisdom', 'Trí tuệ'], ['support', 'Hỗ trợ']];

/** Chỉ số và kỹ năng của một lớp nhân vật */
export const ClassSheet: React.FC<{ cls: CharacterClass }> = ({ cls }) => {
  const { c } = useTheme();
  const Icon = iconOf(cls.icon);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cls.color, alignItems: 'center', justifyContent: 'center' }}><Icon size={24} color="#ffffff" /></View>
        <Txt f="displayHeavy" size={20} style={{ flex: 1 }}>{cls.name}</Txt>
      </View>
      {cls.description ? <Txt size={14} color={c.muc2}>{cls.description}</Txt> : null}
      {STAT_TEXT.map(([key, label]) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt size={13} color={c.muc2} style={{ width: 80 }}>{label}</Txt>
          <View style={{ flex: 1 }}><Bar value={cls.stats[key] ?? 0} max={150} height={8} fill={cls.color} label={`${label}: ${cls.stats[key] ?? 0}`} /></View>
          <Txt f="bold" size={13} style={{ width: 34, textAlign: 'right' }}>{cls.stats[key] ?? 0}</Txt>
        </View>
      ))}
      {cls.skills.length ? (
        <View style={{ gap: 4 }}>
          <Txt f="bold" size={13} color={c.muc2}>Kỹ năng (dùng được khi vào hoạt động lớp học)</Txt>
          {cls.skills.map((s) => <Txt key={s.code} size={13}>• <Txt f="bold" size={13}>{s.name}</Txt>: {s.description} (tốn {s.cost} điểm hành động)</Txt>)}
        </View>
      ) : null}
    </View>
  );
};

/** Lần đầu vào học: chọn một trong ba lớp nhân vật */
export const CharacterSetup: React.FC<{ session: Session; onDone: (hud: Hud) => void }> = ({ session, onDone }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [classes, setClasses] = useState<CharacterClass[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.gameClasses(session.token).then((list) => { setClasses(list); setPicked(list[0]?.id ?? null); }).catch((e) => toast(errorMessage(e))); }, [session.token, toast]);
  const confirm = async () => {
    if (picked === null) return;
    setBusy(true);
    try { onDone(await api.chooseCharacter(session.token, picked)); } catch (e) { toast(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.giay }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 56, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <Txt f="displayHeavy" size={28} accessibilityRole="header">Chọn lớp nhân vật</Txt>
        <Txt size={15} color={c.muc2}>Mỗi lớp nhân vật có chỉ số và kỹ năng riêng. Em có thể đổi ngoại hình, trang phục và vũ khí sau khi học và kiếm vàng.</Txt>
        {!classes ? <Spinner /> : classes.map((cls) => {
          const on = cls.id === picked;
          return (
            <Card key={cls.id} flat pad={14} style={{ gap: 8, borderColor: on ? cls.color : c.vien, borderWidth: 3 }}>
              <ClassSheet cls={cls} />
              <Btn title={on ? 'Đã chọn' : 'Chọn lớp này'} tone={on ? 'ngoc' : 'giay'} size="sm" onPress={() => setPicked(cls.id)} testID={`class-${cls.code}`} />
            </Card>
          );
        })}
        <Btn title="Bắt đầu hành trình" tone="ngoc" size="lg" full loading={busy} disabled={picked === null} onPress={confirm} testID="character-confirm" />
      </ScrollView>
    </View>
  );
};

/** Thẻ nhân vật đã sưu tầm: mặt thẻ kèm tiểu sử và câu nói nổi tiếng lấy từ kho lịch sử đã công bố */
export const CardDetailView: React.FC<{ card: CardDetail }> = ({ card }) => {
  const { c } = useTheme();
  const f = card.figure;
  return (
    <View style={{ gap: 12, alignItems: 'center' }}>
      <CardFace rarity={card.rarity} name={card.name} owned copies={card.copies} size={170} />
      <View style={{ gap: 6, alignSelf: 'stretch' }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip text={RARITY_TEXT[card.rarity]} bg={RARITY_COLOR(c, card.rarity).bg} fg={RARITY_COLOR(c, card.rarity).fg} />
          {f && (f.birth_year || f.death_year) ? <Chip text={`${f.birth_year ?? '?'} – ${f.death_year ?? '?'}`} bg={c.dichNhat} fg={c.dich} /> : null}
        </View>
        {f?.honorific ? <Txt f="semibold" size={15}>{f.honorific}</Txt> : null}
        {f?.role_text ? <Txt size={14} color={c.muc2}>{f.role_text}</Txt> : null}
        {f?.biography ? <Txt size={15} style={{ lineHeight: 24 }}>{f.biography}</Txt> : <Txt size={14} color={c.muc3}>Tiểu sử sẽ hiện khi hồ sơ nhân vật được công bố.</Txt>}
        {f?.famous_quote ? <Txt f="display" size={18} style={{ fontStyle: 'italic' }}>“{f.famous_quote}”</Txt> : card.flavor_quote ? <Txt f="display" size={18} style={{ fontStyle: 'italic' }}>“{card.flavor_quote}”</Txt> : null}
      </View>
    </View>
  );
};

/** Hộp lật thẻ rơi: máy chủ đã chọn thẻ, học sinh chỉ lật để xem */
export const FlipSheet: React.FC<{ session: Session; dropId: number; onClose: (flipped: boolean) => void }> = ({ session, dropId, onClose }) => {
  const toast = useToast();
  const [result, setResult] = useState<FlipResult | null>(null);
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    setBusy(true);
    try { setResult(await api.flipDrop(session.token, dropId)); } catch (e) { toast(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={() => onClose(Boolean(result))} title={result ? 'Thẻ nhân vật mới!' : 'Em nhận được một thẻ nhân vật'}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>{result ? <Btn title="Cất vào bộ sưu tập" tone="ngoc" onPress={() => onClose(true)} /> : <Btn icon={Sparkles} title="Lật thẻ" tone="dong" loading={busy} onPress={flip} testID="card-flip" />}</View>}>
      {result ? (
        <View style={{ gap: 10 }}>
          {result.duplicate ? <Chip text={`Thẻ trùng: nhận ${result.gold} vàng`} bg="#fff0d4" fg="#8f4a00" /> : <Chip text="Thẻ mới trong bộ sưu tập" bg="#e7f8d6" fg="#2b6b00" />}
          <CardDetailView card={result.card} />
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}><CardFace rarity="common" name={null} owned={false} size={170} /><Txt size={14} style={{ marginTop: 10 }} center>Bấm “Lật thẻ” để biết em nhận được nhân vật nào.</Txt></View>
      )}
    </Sheet>
  );
};

/** Hàng đợi chúc mừng: hiện lần lượt từng sự kiện rồi đánh dấu đã xem */
export const CelebrationHost: React.FC<{ session: Session; refreshKey: number; onChanged: () => void }> = ({ session, refreshKey, onChanged }) => {
  const { c } = useTheme();
  const [queue, setQueue] = useState<Celebration[]>([]);
  const known = useRef(new Set<number>());
  const { token } = session;
  useEffect(() => {
    let alive = true;
    api.celebrations(token).then((list) => {
      if (!alive) return;
      const fresh = list.filter((x) => !known.current.has(x.id));
      fresh.forEach((x) => known.current.add(x.id));
      // Quà hằng ngày do chính học sinh vừa bấm nhận nên đã có thông báo; chỉ đánh dấu đã xem
      const quiet = fresh.filter((x) => x.kind === 'gift');
      if (quiet.length) api.ackCelebrations(token, quiet.map((x) => x.id)).catch(() => undefined);
      const show = fresh.filter((x) => x.kind !== 'gift');
      if (show.length) setQueue((q) => [...q, ...show]);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [token, refreshKey]);
  const current = queue[0];
  if (!current) return null;
  const done = (ack = true) => {
    if (ack && current.kind !== 'card') api.ackCelebrations(token, [current.id]).catch(() => undefined);
    setQueue((q) => q.slice(1));
    if (queue.length <= 1) onChanged();
  };
  if (current.kind === 'card') return <FlipSheet session={session} dropId={Number(current.payload.drop_id)} onClose={(flipped) => { if (!flipped) api.ackCelebrations(token, [current.id]).catch(() => undefined); done(false); }} />;
  const p = current.payload;
  const Icon = current.kind === 'badge' ? iconOf(p.icon) : current.kind === 'level_up' ? Trophy : Award;
  const text: { title: string; lines: string[] } = {
    level_up: { title: 'LÊN CẤP!', lines: [`Em đã đạt cấp ${p.level}: ${p.title}`, p.reward_gold ? `Thưởng ${p.reward_gold} vàng` : ''] },
    badge: { title: 'Huy hiệu mới!', lines: [String(p.name)] },
    goal: { title: 'Đạt mục tiêu hôm nay!', lines: [`Em đã đủ ${p.goal} điểm hôm nay`, `Chuỗi ${p.streak} ngày học liên tiếp`, p.gold ? `Thưởng ${p.gold} vàng` : ''] },
    quest: { title: 'Hoàn thành nhiệm vụ!', lines: [String(p.title), [p.reward_xp ? `+${p.reward_xp} điểm` : '', p.reward_gold ? `+${p.reward_gold} vàng` : ''].filter(Boolean).join(' · ')] },
    gift: { title: 'Quà hằng ngày', lines: [`Ngày ${p.day}: +${p.gold} vàng${p.freeze ? ' và 1 đóng băng chuỗi ngày' : ''}`] },
    league: { title: 'Kết thúc tuần giải đấu', lines: [`Em xếp hạng ${p.rank} trong nhóm`, p.result === 'promote' ? `Thăng hạng: ${p.from} → ${p.to}` : p.result === 'demote' ? `Xuống hạng: ${p.from} → ${p.to}` : `Giữ hạng ${p.to}`] },
    contest: { title: `Sự kiện “${p.title}” đã kết thúc`, lines: [`Em xếp hạng ${p.rank} với ${p.xp} điểm`, p.gold ? `Thưởng ${p.gold} vàng` : ''] },
  }[current.kind] ?? { title: 'Chúc mừng!', lines: [] };
  return (
    <Sheet open onClose={() => done()} title={text.title} footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title={queue.length > 1 ? `Tiếp theo (${queue.length - 1})` : 'Tuyệt vời!'} tone="ngoc" onPress={() => done()} testID="celebration-ok" /></View>}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }} accessibilityLiveRegion="polite">
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: current.kind === 'badge' ? p.color : c.dong, alignItems: 'center', justifyContent: 'center' }}><Icon size={42} color="#ffffff" /></View>
        {text.lines.filter(Boolean).map((line, i) => <Txt key={i} f={i === 0 ? 'displayHeavy' : 'medium'} size={i === 0 ? 20 : 15} center>{line}</Txt>)}
      </View>
    </Sheet>
  );
};

// ---------------------------------------------------------------------- chia sẻ thành tích (HK.HS.078)
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

export const achievementSvg = (hud: Hud, badges: number, cards: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16253f"/><stop offset="1" stop-color="#0b6cc0"/></linearGradient></defs>
<rect width="1080" height="1080" fill="url(#g)"/><rect x="40" y="40" width="1000" height="1000" rx="48" fill="none" stroke="#ffc800" stroke-width="6"/>
<text x="540" y="170" font-family="Georgia, serif" font-size="64" font-weight="700" fill="#ffc800" text-anchor="middle">HÀO KHÍ ĐÔNG A</text>
<text x="540" y="240" font-family="Arial, sans-serif" font-size="34" fill="#c8efff" text-anchor="middle">Học lịch sử qua trải nghiệm</text>
<circle cx="540" cy="450" r="150" fill="${hud.class?.color ?? '#b91c1c'}" stroke="#ffffff" stroke-width="8"/>
<text x="540" y="480" font-family="Georgia, serif" font-size="120" font-weight="700" fill="#ffffff" text-anchor="middle">${hud.level.level}</text>
<text x="540" y="545" font-family="Arial, sans-serif" font-size="30" fill="#ffffff" text-anchor="middle">CẤP ĐỘ</text>
<text x="540" y="680" font-family="Georgia, serif" font-size="58" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(hud.user.name)}</text>
<text x="540" y="740" font-family="Arial, sans-serif" font-size="38" fill="#ffc800" text-anchor="middle">${esc(hud.level.title)}${hud.class ? ` · ${esc(hud.class.name)}` : ''}</text>
<g font-family="Arial, sans-serif" fill="#ffffff" text-anchor="middle">
<text x="240" y="880" font-size="68" font-weight="700">${hud.xp}</text><text x="240" y="930" font-size="28" fill="#c8efff">điểm</text>
<text x="540" y="880" font-size="68" font-weight="700">${badges}</text><text x="540" y="930" font-size="28" fill="#c8efff">huy hiệu</text>
<text x="840" y="880" font-size="68" font-weight="700">${cards}</text><text x="840" y="930" font-size="28" fill="#c8efff">thẻ nhân vật</text></g>
<text x="540" y="1000" font-family="Arial, sans-serif" font-size="30" fill="#ffffff" text-anchor="middle">Chuỗi ${hud.streak.current} ngày học liên tiếp</text></svg>`;

/** Chuyển ảnh SVG thành PNG trên trình duyệt để lưu hoặc chia sẻ */
async function svgToPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new (globalThis as unknown as { Image: new () => HTMLImageElement }).Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Không tạo được ảnh')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1080;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const ShareSheet: React.FC<{ hud: Hud; badges: number; cards: number; onClose: () => void }> = ({ hud, badges, cards, onClose }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const svg = achievementSvg(hud, badges, cards);
  const make = async (share: boolean) => {
    if (Platform.OS !== 'web') return toast('Tạo ảnh thành tích hiện hỗ trợ trên trình duyệt web.');
    setBusy(true);
    try {
      const png = await svgToPng(svg);
      const file = new File([png], 'thanh-tich-hao-khi-dong-a.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (share && nav.canShare?.({ files: [file] })) await nav.share({ files: [file], title: 'Thành tích Hào Khí Đông A' });
      else if (!saveBlob(png, 'thanh-tich-hao-khi-dong-a.png')) toast('Không lưu được ảnh trên thiết bị này.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Chia sẻ thành tích" subtitle="Ảnh chỉ gồm tên hiển thị, cấp độ, điểm, huy hiệu và thẻ; em tự chọn nơi đăng"
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}><Btn icon={Download} title="Tải ảnh" tone="giay" loading={busy} onPress={() => make(false)} /><Btn icon={Share2} title="Chia sẻ" tone="ngoc" loading={busy} onPress={() => make(true)} testID="share-achievement" /></View>}>
      {Platform.OS === 'web'
        ? <View style={{ alignItems: 'center' }}><View accessibilityRole="image" accessibilityLabel={`Ảnh thành tích: cấp ${hud.level.level}, ${hud.xp} điểm, ${badges} huy hiệu, ${cards} thẻ`} style={{ width: 280, height: 280, borderRadius: 16, overflow: 'hidden' }}>
          {React.createElement('img', { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, alt: 'Ảnh thành tích', style: { width: 280, height: 280 } })}</View></View>
        : <Txt size={14}>Tạo ảnh thành tích hiện hỗ trợ trên trình duyệt web.</Txt>}
    </Sheet>
  );
};
