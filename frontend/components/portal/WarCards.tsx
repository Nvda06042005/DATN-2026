/**
 * Bộ thẻ tướng lịch sử (HK.HS.068/069, 126–130): lưới thẻ (chân dung, khung màu theo độ hiếm, số sao, cấp), lọc và sắp xếp; chi tiết hai mặt (chỉ số, tiểu sử, câu nói,
 * trận đã tham gia, chiêu thức kèm giai thoại); nâng cấp bằng Binh thư và thăng sao bằng mảnh thẻ; đội hình ra trận (3 đội, tối đa 5 thẻ, hàng tiên phong / hậu quân,
 * kèm một thẻ chiến thuật); sổ tay chỉ huy đối phương (chỉ để tra cứu). Chân dung là biểu tượng binh chủng và chữ cái của tên (chưa có ảnh vẽ).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowUp, BookOpen, Footprints, Lock, PawPrint, RefreshCw, ScrollText, Ship, Star, Swords } from 'lucide-react-native';
import * as api from '@/api/warApi';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Bar, Btn, Card, Chip, EmptyState, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import { BRANCH_LABEL, CardDetail, RARITY_COLOR, RARITY_LABEL, SLOT_LABEL, WarCard, type Branch } from '@/types/war';

export const BRANCH_ICON: Record<Branch, IconType> = { bo: Footprints, thuy: Ship, ky: PawPrint };
const initials = (name: string | null): string => (name ?? '?').split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();

/** Chân dung vẽ bằng biểu tượng binh chủng và chữ cái tên; thẻ chiến thuật dùng biểu tượng cuộn */
export const CardPortrait: React.FC<{ card: Pick<WarCard, 'name' | 'rarity' | 'branch' | 'kind' | 'owned'>; size?: number }> = ({ card, size = 64 }) => {
  const { c } = useTheme();
  const tone = RARITY_COLOR[card.rarity];
  const Icon = card.kind === 'tactic' ? ScrollText : card.branch ? BRANCH_ICON[card.branch] : Swords;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: card.owned ? `${tone}22` : c.vien, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {card.owned ? <Txt f="displayHeavy" size={size * 0.42} color={tone}>{initials(card.name)}</Txt> : <Lock size={size * 0.4} color={c.muc3} />}
      <View style={{ position: 'absolute', right: 3, bottom: 3, opacity: 0.85 }}><Icon size={size * 0.24} color={card.owned ? tone : c.muc3} /></View>
    </View>
  );
};

const Stars: React.FC<{ n: number; max?: number; size?: number }> = ({ n, max = 5, size = 11 }) => {
  const { c } = useTheme();
  return <View accessibilityLabel={`${n} sao`} style={{ flexDirection: 'row' }}>{Array.from({ length: max }, (_, i) => <Star key={i} size={size} color={i < n ? '#f59e0b' : c.vien2} fill={i < n ? '#f59e0b' : 'transparent'} />)}</View>;
};

/** Một thẻ trong lưới: thẻ chưa có hiện bóng mờ kèm tiến độ mảnh */
export const CardTile: React.FC<{ card: WarCard; onPress: () => void; selected?: boolean; compact?: boolean }> = ({ card, onPress, selected, compact }) => {
  const { c } = useTheme();
  const tone = RARITY_COLOR[card.rarity];
  const label = card.owned ? `${card.name}, ${card.rarity_label}, cấp ${card.level}, ${card.stars} sao` : `Thẻ ${card.rarity_label} chưa có${card.fragments ? `, ${card.fragments} trên ${card.fragments_needed} mảnh` : ''}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} testID={`war-card-${card.id}`}
      style={({ pressed }) => ({ width: compact ? 104 : '31.5%', minWidth: 100, flexGrow: compact ? 0 : 1, padding: 8, gap: 6, borderRadius: 16, borderWidth: 3, borderColor: selected ? c.ngoc : card.owned ? tone : c.vien, backgroundColor: pressed ? c.the2 : c.the, opacity: card.owned || card.fragments ? 1 : 0.8, alignItems: 'center' })}>
      <CardPortrait card={card} size={compact ? 56 : 72} />
      <Txt f="bold" size={13} center numberOfLines={2} color={card.owned ? c.muc : c.muc3}>{card.name ?? 'Chưa có thẻ'}</Txt>
      {card.owned && card.kind === 'general' ? <><Stars n={card.stars ?? 1} /><Txt size={11} color={c.muc2}>Cấp {card.level} · Lực chiến {card.power}</Txt></>
        : card.owned ? <Chip text="Chiến thuật" bg={c.thuyNhat} fg={c.thuyChu} />
          : <View style={{ width: '100%', gap: 2 }}><Bar value={card.fragments} max={card.fragments_needed} height={6} fill={tone} label={`${card.fragments}/${card.fragments_needed} mảnh`} /><Txt size={10} color={c.muc3} center>{card.fragments}/{card.fragments_needed} mảnh</Txt></View>}
      <Chip text={card.rarity_label} bg={`${tone}22`} fg={tone} />
    </Pressable>
  );
};

// ---------------------------------------------------------------------- chi tiết thẻ (HK.HS.126–127)
const STAT_LABEL: Array<[keyof NonNullable<WarCard['stats']>, string]> = [['atk', 'Công'], ['def', 'Thủ'], ['hp', 'Máu'], ['spd', 'Tốc']];

export const CardSheet: React.FC<{ session: Session; id: number; onClose: () => void; onChanged: () => void }> = ({ session, id, onClose, onChanged }) => {
  const { c } = useTheme();
  const detail = useLoad(() => api.warCard(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const d: CardDetail | null = detail.data;
  const upgrade = async (kind: 'level' | 'star') => {
    const next = await run(() => api.upgradeCard(session.token, id, kind), kind === 'level' ? 'Đã nâng cấp thẻ' : 'Đã thăng sao');
    if (next) { detail.setData(next); onChanged(); }
  };
  return (
    <Sheet open onClose={onClose} title={d?.name ?? 'Thẻ tướng'} subtitle={d ? `${d.rarity_label}${d.branch_label ? ` · ${d.branch_label}` : ''}${d.kind === 'general' ? ` · cấp ${d.level} · ${d.stars} sao` : ' · thẻ chiến thuật'}` : undefined} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="ngoc" onPress={onClose} testID="card-close" /></View>}>
      <ErrorNote message={detail.error} />
      {detail.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 14 }}>
          <Segmented<'front' | 'back'> label="Mặt thẻ" value={side} onChange={setSide} options={[{ value: 'front', label: 'Mặt trước' }, { value: 'back', label: 'Mặt sau' }]} />
          {side === 'front' ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <CardPortrait card={d} size={96} />
                <View style={{ flex: 1, gap: 6 }}>
                  {d.kind === 'general' ? <Stars n={d.stars ?? 1} size={18} /> : null}
                  {d.kind === 'general' ? <Txt size={14} color={c.muc2}>Lực chiến {d.power}</Txt> : null}
                  {d.flavor_quote ? <Txt size={13} color={c.muc2}>“{d.flavor_quote}”</Txt> : null}
                </View>
              </View>
              {d.stats ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {STAT_LABEL.map(([k, label]) => (
                    <View key={k} style={{ flex: 1, padding: 8, borderRadius: 12, backgroundColor: c.the2, alignItems: 'center' }}>
                      <Txt size={11} color={c.muc3}>{label}</Txt>
                      <Txt f="displayHeavy" size={18}>{d.stats![k]}</Txt>
                      {d.next_level_stats && d.next_level_stats[k] > d.stats![k] ? <Txt size={10} color={c.ngocChu}>+{d.next_level_stats[k] - d.stats![k]}</Txt> : null}
                    </View>
                  ))}
                </View>
              ) : null}
              {d.tactic ? <InfoNote>Thẻ chiến thuật: {d.tactic.text ?? 'dùng một lần mỗi trận, không mất lượt.'} Mang một thẻ vào đội hình rồi dùng trong trận.</InfoNote> : null}
              {d.kind === 'general' ? (
                <View style={{ gap: 8 }}>
                  <Btn icon={ArrowUp} title={`Nâng cấp (${d.level_cost} Binh thư)`} tone="dong" size="lg" full disabled={!d.can_level} loading={busy} onPress={() => upgrade('level')} testID="card-level-up" />
                  <Btn icon={Star} title={d.stars && d.stars >= 5 ? 'Đã đạt 5 sao' : `Thăng sao (${d.star_cost} mảnh, đang có ${d.fragments})`} tone="son" size="lg" full disabled={!d.can_star} loading={busy} onPress={() => upgrade('star')} testID="card-star-up" />
                  {d.hint ? <Txt size={12} color={c.muc3}>{d.hint}</Txt> : null}
                  <Txt size={12} color={c.muc3}>Binh thư nhận khi học bài, mở rương và thắng trận. Thẻ trùng thành mảnh để thăng sao.</Txt>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {d.figure ? (
                <View style={{ gap: 4 }}>
                  <Txt f="bold" size={16}>{d.figure.name}{d.figure.honorific ? ` (${d.figure.honorific})` : ''}</Txt>
                  {d.figure.birth_year || d.figure.death_year ? <Txt size={13} color={c.muc3}>{d.figure.birth_year ?? '?'} – {d.figure.death_year ?? '?'}</Txt> : null}
                  {d.figure.role_text ? <Txt size={14} color={c.muc2}>{d.figure.role_text}</Txt> : null}
                  {d.figure.biography ? <Txt size={14}>{d.figure.biography.length > 420 ? `${d.figure.biography.slice(0, 420)}…` : d.figure.biography}</Txt> : null}
                  {d.figure.famous_quote ? <InfoNote>“{d.figure.famous_quote}”</InfoNote> : null}
                </View>
              ) : <Txt size={14} color={c.muc2}>Tiểu sử sẽ hiện khi nhân vật được công bố trong kho lịch sử.</Txt>}
              {d.battles.length ? (
                <View style={{ gap: 4 }}><Txt f="bold" size={15}>Trận đã tham gia</Txt>{d.battles.map((b) => <Txt key={b.id} size={14}>• {b.name} ({b.year}){b.stage_id ? ' – có màn chơi' : ''}</Txt>)}</View>
              ) : null}
              <Txt f="bold" size={15}>Chiêu thức</Txt>
              {d.moves.length ? d.moves.map((m) => (
                <View key={m.slot} style={{ padding: 10, borderRadius: 12, backgroundColor: c.the2, gap: 2 }}>
                  <Txt f="bold" size={14}>{SLOT_LABEL[m.slot]}: {m.name}</Txt>
                  {m.description ? <Txt size={13}>{m.description}</Txt> : null}
                  {m.anecdote ? <Txt size={12} color={c.muc2}>Giai thoại: {m.anecdote}</Txt> : null}
                </View>
              )) : <Txt size={13} color={c.muc3}>Thẻ dùng các chiêu cơ bản.</Txt>}
            </View>
          )}
        </View>
      ) : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- đội hình (HK.HS.128)
const FormationPanel: React.FC<{ session: Session; cards: WarCard[]; onChanged: () => void }> = ({ session, cards, onChanged }) => {
  const { c } = useTheme();
  const form = useLoad(() => api.formations(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [slot, setSlot] = useState(1);
  const [draft, setDraft] = useState<{ name: string; front: number[]; back: number[]; tactic: number | null } | null>(null);
  const [row, setRow] = useState<'front' | 'back'>('front');
  const slots = form.data?.slots ?? [];
  const current = slots.find((s) => s.slot === slot);
  const view = draft ?? (current ? { name: current.name, front: current.front, back: current.back, tactic: current.tactic_card_id } : { name: `Đội hình ${slot}`, front: [], back: [], tactic: null });
  const generals = cards.filter((x) => x.owned && x.kind === 'general');
  const tactics = cards.filter((x) => x.owned && x.kind === 'tactic');
  const total = view.front.length + view.back.length;
  const toggle = (id: number) => {
    const inFront = view.front.includes(id), inBack = view.back.includes(id);
    if (inFront || inBack) setDraft({ ...view, front: view.front.filter((x) => x !== id), back: view.back.filter((x) => x !== id) });
    else if (total < 5) setDraft(row === 'front' ? { ...view, front: [...view.front, id] } : { ...view, back: [...view.back, id] });
  };
  const power = [...view.front, ...view.back].reduce((n, id) => n + (generals.find((g) => g.id === id)?.power ?? 0), 0);
  const save = async () => {
    const res = await run(() => api.saveFormation(session.token, slot, { name: view.name, front: view.front, back: view.back, tactic_card_id: view.tactic }), 'Đã lưu đội hình');
    if (res) { form.setData(res); setDraft(null); onChanged(); }
  };
  return (
    <View style={{ gap: 12 }}>
      <Segmented<number> label="Chọn đội hình" value={slot} onChange={(v) => { setSlot(v); setDraft(null); }} options={[1, 2, 3].map((n) => ({ value: n, label: `Đội ${n}${slots.find((s) => s.slot === n)?.size ? ` (${slots.find((s) => s.slot === n)!.size})` : ''}` }))} />
      <ErrorNote message={form.error} />
      <Card flat pad={12} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt f="bold" size={16}>{view.name}</Txt>
          <Chip text={`Lực chiến ${power}`} bg={c.dongNhat} fg={c.dongChu} />
        </View>
        {(['front', 'back'] as const).map((r) => (
          <View key={r} style={{ gap: 4 }}>
            <Txt size={12} color={c.muc3}>{r === 'front' ? 'Hàng tiên phong' : 'Hậu quân'}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 40 }}>
              {view[r].map((id) => { const g = generals.find((x) => x.id === id); return g ? <Btn key={id} title={g.name ?? ''} tone="ngoc" size="sm" onPress={() => toggle(id)} label={`Bỏ ${g.name} khỏi đội hình`} /> : null; })}
              {!view[r].length ? <Txt size={13} color={c.muc3}>Chưa có thẻ nào</Txt> : null}
            </View>
          </View>
        ))}
        <Txt size={12} color={c.muc3}>Tối đa 5 thẻ. Tướng từng tham gia trận đó trong lịch sử được “Hào khí” (+10% chỉ số) nên hãy chọn đúng sử.</Txt>
      </Card>
      <Segmented<'front' | 'back'> label="Thêm thẻ vào hàng" value={row} onChange={setRow} options={[{ value: 'front', label: 'Tiên phong' }, { value: 'back', label: 'Hậu quân' }]} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {generals.map((g) => <CardTile key={g.id} card={g} compact selected={view.front.includes(g.id) || view.back.includes(g.id)} onPress={() => toggle(g.id)} />)}
      </View>
      {!generals.length ? <EmptyState mood="thinking" title="Em chưa có thẻ tướng nào" text="Hoàn thành bài học và trận đánh, mở rương hoặc đi trên bản đồ hành quân để nhận thẻ." /> : null}
      <Txt f="bold" size={14}>Thẻ chiến thuật (dùng một lần mỗi trận)</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn title="Không mang" tone={view.tactic === null ? 'ngoc' : 'giay'} size="sm" onPress={() => setDraft({ ...view, tactic: null })} />
        {tactics.map((t) => <Btn key={t.id} title={t.name ?? ''} tone={view.tactic === t.id ? 'ngoc' : 'giay'} size="sm" onPress={() => setDraft({ ...view, tactic: t.id })} />)}
      </View>
      <Btn title="Lưu đội hình" tone="ngoc" size="lg" full loading={busy} disabled={!draft || !total} onPress={save} testID="formation-save" />
    </View>
  );
};

// ---------------------------------------------------------------------- sổ tay chỉ huy đối phương (HK.HS.130)
const CommanderBook: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.commanders(session.token), [session.token], session.expired);
  return (
    <View style={{ gap: 10 }}>
      <ErrorNote message={list.error} />
      <InfoNote>Hồ sơ chỉ huy đối phương mở sau khi em chạm trán trong trận đánh. Đây chỉ là tư liệu để tra cứu, không dùng làm thẻ ra trận.</InfoNote>
      {list.loading && !list.data ? <Spinner /> : null}
      {(list.data ?? []).map((k) => (
        <Card key={k.id} flat pad={12} style={{ gap: 4, opacity: k.seen ? 1 : 0.7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{k.seen ? <BookOpen size={18} color={c.thuyChu} /> : <Lock size={18} color={c.muc3} />}<Txt f="bold" size={16}>{k.name ?? 'Chỉ huy chưa chạm trán'}</Txt></View>
          {k.seen ? (
            <>
              {k.role_text ? <Txt size={14}>{k.role_text}</Txt> : null}
              {k.forces ? <Txt size={13} color={c.muc2}>Lực lượng: {k.forces}</Txt> : null}
              {k.tactics ? <Txt size={13} color={c.muc2}>Chiến thuật: {k.tactics}</Txt> : null}
              {k.outcome ? <Txt size={13} color={c.muc2}>Kết cục trong lịch sử: {k.outcome}</Txt> : null}
            </>
          ) : <Txt size={13} color={c.muc3}>Hãy vào trận có chỉ huy này để mở hồ sơ.</Txt>}
        </Card>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- tab Bộ thẻ tướng
type Sort = 'rarity' | 'level' | 'stars' | 'power';

export const WarCardsTab: React.FC<{ session: Session; refreshKey: number; onChanged: () => void }> = ({ session, refreshKey, onChanged }) => {
  const { c } = useTheme();
  const col = useLoad(() => api.warCards(session.token), [session.token, refreshKey], session.expired);
  const [part, setPart] = useState<'cards' | 'formation' | 'book'>('cards');
  const [kind, setKind] = useState<'all' | 'general' | 'tactic'>('all');
  const [branch, setBranch] = useState<'all' | Branch>('all');
  const [rarity, setRarity] = useState<'all' | WarCard['rarity']>('all');
  const [campaign, setCampaign] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<Sort>('rarity');
  const [open, setOpen] = useState<number | null>(null);
  const data = col.data;
  const shown = useMemo(() => {
    const order = { legendary: 0, epic: 1, rare: 2, common: 3 } as const;
    const list = (data?.cards ?? []).filter((x) => (kind === 'all' || x.kind === kind) && (branch === 'all' || x.branch === branch) && (rarity === 'all' || x.rarity === rarity) && (campaign === 'all' || (x.campaign_ids ?? []).includes(campaign)));
    const key = (x: WarCard): number => (sort === 'level' ? -(x.level ?? 0) : sort === 'stars' ? -(x.stars ?? 0) : sort === 'power' ? -(x.power ?? 0) : order[x.rarity]);
    return [...list].sort((a, b) => Number(b.owned) - Number(a.owned) || key(a) - key(b) || a.id - b.id);
  }, [data, kind, branch, rarity, campaign, sort]);
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Bộ thẻ tướng</Txt>
      <Segmented<'cards' | 'formation' | 'book'> label="Mục của bộ thẻ" value={part} onChange={setPart} options={[{ value: 'cards', label: 'Thẻ' }, { value: 'formation', label: 'Đội hình' }, { value: 'book', label: 'Sổ tay chỉ huy' }]} />
      <ErrorNote message={col.error} />
      {col.loading && !data ? <Spinner /> : null}
      {data && part === 'cards' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip text={`Đã có ${data.summary.owned}/${data.summary.total} thẻ`} bg={c.ngocNhat} fg={c.ngocChu} />
            <Chip text={`Binh thư ${data.player.binh_thu}`} bg={c.thuyNhat} fg={c.thuyChu} icon={RefreshCw} />
            <Chip text={`Cấp học tập ${data.player.level} (giới hạn cấp thẻ)`} bg={c.dongNhat} fg={c.dongChu} />
          </View>
          <Segmented<'all' | 'general' | 'tactic'> label="Loại thẻ" value={kind} onChange={setKind} options={[{ value: 'all', label: 'Tất cả' }, { value: 'general', label: 'Tướng' }, { value: 'tactic', label: 'Chiến thuật' }]} />
          <Segmented<'all' | Branch> label="Binh chủng" value={branch} onChange={setBranch} options={[{ value: 'all', label: 'Mọi binh chủng' }, ...(Object.keys(BRANCH_LABEL) as Branch[]).map((b) => ({ value: b, label: BRANCH_LABEL[b] }))]} />
          <Segmented<'all' | WarCard['rarity']> label="Độ hiếm" value={rarity} onChange={setRarity} options={[{ value: 'all', label: 'Mọi độ hiếm' }, ...(Object.keys(RARITY_LABEL) as WarCard['rarity'][]).map((r) => ({ value: r, label: RARITY_LABEL[r] }))]} />
          {data.campaigns?.length ? <Segmented<number | 'all'> label="Cuộc kháng chiến" value={campaign} onChange={setCampaign} options={[{ value: 'all', label: 'Mọi cuộc kháng chiến' }, ...data.campaigns.map((x) => ({ value: x.id, label: x.title }))]} /> : null}
          <Segmented<Sort> label="Sắp xếp" value={sort} onChange={setSort} options={[{ value: 'rarity', label: 'Độ hiếm' }, { value: 'level', label: 'Cấp' }, { value: 'stars', label: 'Sao' }, { value: 'power', label: 'Lực chiến' }]} />
          {shown.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{shown.map((x) => <CardTile key={x.id} card={x} onPress={() => (x.owned ? setOpen(x.id) : undefined)} />)}</View>
            : <EmptyState mood="thinking" title="Không có thẻ nào phù hợp bộ lọc" />}
          <Txt size={12} color={c.muc3}>Thẻ chưa có hiện bóng mờ; gom đủ mảnh thì tự ghép thành thẻ. Chạm vào thẻ đã có để xem chi tiết và nâng cấp.</Txt>
        </>
      ) : null}
      {data && part === 'formation' ? <FormationPanel session={session} cards={data.cards} onChanged={onChanged} /> : null}
      {part === 'book' ? <CommanderBook session={session} /> : null}
      {open !== null ? <CardSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={() => { col.reload(); onChanged(); }} /> : null}
    </View>
  );
};
