/**
 * Ba mục trò chơi hóa của học sinh (Sprint 5): Nhân vật (ngoại hình, mục tiêu ngày, chuỗi ngày, quà hằng ngày, cửa hàng – HK.HS.011–014, 065, 070, 073),
 * Bộ sưu tập (huy hiệu và thẻ nhân vật – HK.HS.066–069) và Xếp hạng (lớp, trường, hệ thống, giải đấu tuần, sự kiện trường – HK.HS.074–077).
 * Mọi điểm, vàng, thưởng do máy chủ tính; giao diện chỉ hiển thị và gửi lựa chọn.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowDown, ArrowUp, Check, Coins, Flame, Gift, Share2, ShoppingBag, Snowflake, Trophy } from 'lucide-react-native';
import * as api from '@/api/gameApi';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { CardDetailView, ClassSheet, FlipSheet } from '@/components/portal/Celebrations';
import { TeamRanking } from '@/components/portal/ClassTab';
import { AvatarFigure, CardFace, iconOf, RARITY_COLOR, ruleText } from '@/components/portal/GameKit';
import { Bar, Btn, Card, Chip, EmptyState, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { BadgeItem, CardAlbumItem, Hud, ShopItem } from '@/types/gamification';
import { LEAGUE_TIERS, RARITY_TEXT } from '@/types/gamification';

interface TabProps { session: Session; hud: Hud | null; refreshKey: number; onChanged: () => void }
const KIND_TEXT: Record<ShopItem['kind'], string> = { outfit: 'Trang phục', weapon: 'Vũ khí', banner: 'Cờ hiệu', streak_freeze: 'Đóng băng chuỗi ngày', heart: 'Tim', hint: 'Gợi ý 50/50' };
const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// ---------------------------------------------------------------------- Nhân vật
const StreakCalendarView: React.FC<{ session: Session; hud: Hud; refreshKey: number }> = ({ session, hud, refreshKey }) => {
  const { c } = useTheme();
  const cal = useLoad(() => api.streakCalendar(session.token), [session.token, refreshKey], session.expired);
  const days = cal.data?.days ?? [];
  // Lịch bắt đầu từ thứ Hai: đệm các ô trống cho tuần đầu
  const first = days[0] ? (new Date(`${days[0].day}T12:00:00Z`).getUTCDay() + 6) % 7 : 0;
  const cells: Array<(typeof days)[number] | null> = [...Array.from({ length: first }, () => null), ...days];
  return (
    <Card flat pad={14} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Flame size={22} color={hud.streak.at_risk ? c.dich : c.hoa} />
        <Txt f="displayHeavy" size={20}>Chuỗi {hud.streak.current} ngày</Txt>
        <Txt size={13} color={c.muc2}>Dài nhất: {hud.streak.longest} ngày</Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Snowflake size={16} color={c.thuyChu} />
        <Txt size={13} color={c.muc2}>Đóng băng: {hud.streak.freezes}/{hud.streak.freeze_max}. Một ngày bỏ lỡ sẽ dùng một lượt đóng băng thay vì mất chuỗi.</Txt>
      </View>
      <Txt size={13} color={c.muc2}>{hud.daily.reached ? 'Hôm nay em đã đạt mục tiêu, chuỗi được giữ.' : `Còn ${Math.max(0, hud.daily.goal - hud.daily.xp)} điểm nữa để giữ chuỗi hôm nay.`}</Txt>
      {cal.loading && !cal.data ? <Spinner /> : null}
      <ErrorNote message={cal.error} />
      {days.length ? (
        <View accessibilityLabel={`Lịch ${days.length} ngày gần nhất, ${days.filter((d) => d.reached).length} ngày đạt mục tiêu`} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>{DAY_NAMES.map((d) => <View key={d} style={{ flex: 1, alignItems: 'center' }}><Txt size={11} color={c.muc3}>{d}</Txt></View>)}</View>
          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row', gap: 4 }}>
              {Array.from({ length: 7 }, (_, col) => {
                const d = cells[row * 7 + col];
                if (!d) return <View key={col} style={{ flex: 1, height: 34 }} />;
                return (
                  <View key={col} accessible accessibilityLabel={`${d.day}: ${d.reached ? 'đạt mục tiêu' : `${d.xp} điểm`}`}
                    style={{ flex: 1, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: d.today ? 2 : 1, borderColor: d.today ? c.dong : c.vien, backgroundColor: d.reached ? c.ngocNhat : c.the }}>
                    {d.reached ? <Check size={16} color={c.ngocChu} /> : <Txt size={11} color={c.muc3}>{d.day.slice(8)}</Txt>}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
};

const GiftCard: React.FC<{ session: Session; refreshKey: number; onChanged: () => void }> = ({ session, refreshKey, onChanged }) => {
  const { c } = useTheme();
  const gift = useLoad(() => api.giftState(session.token), [session.token, refreshKey], session.expired);
  const { run, busy } = useAction(session.expired);
  const g = gift.data;
  const claim = async () => {
    const res = await run(() => api.claimGift(session.token), 'Đã nhận quà hôm nay');
    if (res) { gift.setData(res.state); onChanged(); }
  };
  return (
    <Card flat pad={14} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Gift size={22} color={c.dongChu} />
        <Txt f="displayHeavy" size={20} style={{ flex: 1 }}>Quà hằng ngày</Txt>
        <Btn title={g?.claimed_today ? 'Đã nhận hôm nay' : 'Nhận quà'} tone="dong" size="sm" disabled={!g || g.claimed_today} loading={busy} onPress={claim} testID="gift-claim" />
      </View>
      {gift.loading && !g ? <Spinner /> : null}
      <ErrorNote message={gift.error} />
      {g ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {g.days.map((d) => {
            const got = d.day < g.today_day || (d.day === g.today_day && g.claimed_today), now = d.day === g.today_day && !g.claimed_today;
            return (
              <View key={d.day} accessible accessibilityLabel={`Ngày ${d.day}: ${d.gold} vàng${d.freeze ? ' và một đóng băng chuỗi ngày' : ''}${got ? ', đã nhận' : ''}`}
                style={{ flex: 1, minHeight: 64, borderRadius: 10, borderWidth: now ? 3 : 2, borderColor: now ? c.dong : c.vien, backgroundColor: got ? c.ngocNhat : c.the, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 }}>
                <Txt size={11} color={c.muc3}>Ngày {d.day}</Txt>
                {got ? <Check size={16} color={c.ngocChu} /> : d.freeze ? <Snowflake size={16} color={c.thuyChu} /> : <Coins size={16} color={c.vangDam} />}
                <Txt f="bold" size={12}>{d.gold}</Txt>
              </View>
            );
          })}
        </View>
      ) : null}
      {g ? <Txt size={13} color={c.muc2}>Nhận đủ 7 ngày liên tiếp để được thêm đóng băng chuỗi ngày. Bỏ một ngày thì quà quay về ngày 1.</Txt> : null}
    </Card>
  );
};

const ShopCard: React.FC<{ session: Session; hud: Hud; refreshKey: number; onChanged: () => void }> = ({ session, hud, refreshKey, onChanged }) => {
  const { c } = useTheme();
  const shop = useLoad(() => api.gameShop(session.token), [session.token, refreshKey], session.expired);
  const { run, busy } = useAction(session.expired);
  const [kind, setKind] = useState<ShopItem['kind'] | 'all'>('outfit');
  const items = (shop.data?.items ?? []).filter((i) => kind === 'all' || i.kind === kind);
  const gold = shop.data?.gold ?? hud.gold;
  const equip = async (item: ShopItem) => {
    const field = item.kind === 'outfit' ? 'outfit_id' : item.kind === 'weapon' ? 'weapon_id' : 'banner_id';
    if (await run(() => api.setAppearance(session.token, { [field]: item.equipped ? null : item.id }), item.equipped ? 'Đã cất' : `Đã trang bị ${item.name}`)) { shop.reload(); onChanged(); }
  };
  const buy = async (item: ShopItem) => {
    if (await run(() => api.buyItem(session.token, item.id), `Đã mua ${item.name}`)) { shop.reload(); onChanged(); }
  };
  return (
    <Card flat pad={14} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ShoppingBag size={22} color={c.dongChu} />
        <Txt f="displayHeavy" size={20} style={{ flex: 1 }}>Cửa hàng</Txt>
        <Chip text={`${gold} vàng`} bg={c.vangNhat} fg={c.vangChu} icon={Coins} />
      </View>
      <Segmented<ShopItem['kind']> label="Loại vật phẩm" value={kind as ShopItem['kind']} onChange={setKind}
        options={(['outfit', 'weapon', 'banner', 'streak_freeze', 'heart', 'hint'] as const).map((k) => ({ value: k, label: KIND_TEXT[k] }))} />
      {shop.loading && !shop.data ? <Spinner /> : null}
      <ErrorNote message={shop.error} />
      {shop.data && items.length === 0 ? <EmptyState mood="thinking" title="Chưa có vật phẩm" /> : null}
      {items.map((item) => {
        const Icon = iconOf(item.icon);
        const wearable = item.kind === 'outfit' || item.kind === 'weapon' || item.kind === 'banner';
        return (
          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 2, borderColor: item.equipped ? c.ngoc : c.vien, backgroundColor: c.the, opacity: item.locked ? 0.75 : 1 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${item.color}22`, alignItems: 'center', justifyContent: 'center' }}><Icon size={24} color={item.color} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt f="bold" size={15}>{item.name}{item.equipped ? ' · đang dùng' : ''}</Txt>
              {item.description ? <Txt size={13} color={c.muc2}>{item.description}</Txt> : null}
              <Txt size={12} color={c.muc3}>
                {item.locked ? `Mở ở cấp ${item.min_level}` : item.free_unlock ? 'Tặng khi đạt cấp' : item.owned && wearable ? 'Đã sở hữu' : `${item.price} vàng`}
                {!wearable && item.qty ? ` · đang có ${item.qty}` : ''}
              </Txt>
            </View>
            {wearable && item.owned ? <Btn title={item.equipped ? 'Cất' : 'Mặc'} tone={item.equipped ? 'giay' : 'ngoc'} size="sm" loading={busy} onPress={() => equip(item)} />
              : <Btn title={item.locked ? 'Chưa mở' : item.price ? 'Mua' : 'Nhận'} tone="dong" size="sm" disabled={item.locked || item.price > gold} loading={busy} onPress={() => buy(item)} label={`Mua ${item.name}, ${item.price} vàng`} />}
          </View>
        );
      })}
    </Card>
  );
};

/** Mục "Cửa hàng" riêng của thanh menu chính (HK.HS.125): cùng cửa hàng vật phẩm trong tab Nhân vật */
export const ShopTab: React.FC<TabProps> = ({ session, hud, refreshKey, onChanged }) => (
  hud ? (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Cửa hàng</Txt>
      <ShopCard session={session} hud={hud} refreshKey={refreshKey} onChanged={onChanged} />
    </View>
  ) : <Spinner />
);

export const CharacterTab: React.FC<TabProps & { onShare: () => void }> = ({ session, hud, refreshKey, onChanged, onShare }) => {
  const { c } = useTheme();
  const { run } = useAction(session.expired);
  const [classOpen, setClassOpen] = useState(false);
  if (!hud) return <Spinner />;
  const setGoal = async (goal: number) => { if (await run(() => api.setDailyGoal(session.token, goal), `Mục tiêu mỗi ngày: ${goal} điểm`)) onChanged(); };
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Nhân vật của em</Txt>
      <Card flat pad={16} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <AvatarFigure hud={hud} size={104} />
          <View style={{ flex: 1, minWidth: 180, gap: 4 }}>
            <Txt f="displayHeavy" size={22}>{hud.user.name}</Txt>
            <Txt f="semibold" size={15} color={c.dongChu}>{hud.class?.name ?? 'Chưa chọn lớp'} · Cấp {hud.level.level} {hud.level.title}</Txt>
            <Txt size={13} color={c.muc2}>{hud.xp} điểm · {hud.gold} vàng · giải đấu {LEAGUE_TIERS[hud.league.tier] ?? hud.league.name}</Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <Btn title="Chỉ số và kỹ năng" tone="giay" size="sm" onPress={() => setClassOpen(true)} />
              <Btn icon={Share2} title="Chia sẻ thành tích" tone="thuy" size="sm" onPress={onShare} testID="share-open" />
            </View>
          </View>
        </View>
        <Bar value={hud.level.progress} max={100} height={10} fill={c.dong} label={`Tiến tới cấp ${hud.level.level + 1}: ${hud.level.progress}%`} />
      </Card>

      <Card flat pad={14} style={{ gap: 8 }}>
        <Txt f="displayHeavy" size={20}>Mục tiêu mỗi ngày</Txt>
        <Txt size={13} color={c.muc2}>Hôm nay em có {hud.daily.xp}/{hud.daily.goal} điểm. Đạt mục tiêu mỗi ngày để giữ chuỗi và nhận vàng thưởng.</Txt>
        <Segmented<number> label="Mục tiêu điểm mỗi ngày" value={hud.daily.selected} onChange={setGoal} options={hud.daily.options.map((o) => ({ value: o, label: `${o} điểm` }))} />
      </Card>

      <StreakCalendarView session={session} hud={hud} refreshKey={refreshKey} />
      <GiftCard session={session} refreshKey={refreshKey} onChanged={onChanged} />
      <ShopCard session={session} hud={hud} refreshKey={refreshKey} onChanged={onChanged} />

      {classOpen && hud.class ? <Sheet open onClose={() => setClassOpen(false)} title="Lớp nhân vật"><ClassSheet cls={hud.class} /></Sheet> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- Bộ sưu tập
const BadgeTile: React.FC<{ badge: BadgeItem; onPress: () => void }> = ({ badge, onPress }) => {
  const { c } = useTheme();
  const Icon = iconOf(badge.icon);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${badge.name}, ${badge.earned ? 'đã đạt' : 'chưa đạt'}`} onPress={onPress}
      style={{ width: 104, minHeight: 112, padding: 8, borderRadius: 14, borderWidth: 2, borderColor: badge.earned ? badge.color : c.vien, backgroundColor: badge.earned ? c.the : c.giay2, alignItems: 'center', gap: 6 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: badge.earned ? badge.color : c.vien, alignItems: 'center', justifyContent: 'center' }}><Icon size={26} color={badge.earned ? '#ffffff' : c.muc3} /></View>
      <Txt f="semibold" size={12} center numberOfLines={2} color={badge.earned ? c.muc : c.muc3}>{badge.name}</Txt>
      <Txt size={11} color={badge.earned ? c.ngocChu : c.muc3}>{badge.earned ? 'Đã đạt' : 'Chưa đạt'}</Txt>
    </Pressable>
  );
};

export const CollectionTab: React.FC<TabProps> = ({ session, refreshKey, onChanged }) => {
  const { c } = useTheme();
  const [view, setView] = useState<'badges' | 'cards'>('cards');
  const [badge, setBadge] = useState<BadgeItem | null>(null);
  const [cardId, setCardId] = useState<number | null>(null);
  const [flip, setFlip] = useState<number | null>(null);
  const badges = useLoad(() => api.gameBadges(session.token), [session.token, refreshKey], session.expired);
  const cards = useLoad(() => api.gameCards(session.token), [session.token, refreshKey], session.expired);
  const drops = useLoad(() => api.pendingDrops(session.token), [session.token, refreshKey], session.expired);
  const detail = useLoad(() => (cardId ? api.cardDetail(session.token, cardId) : Promise.resolve(null)), [session.token, cardId], session.expired);
  const earned = (badges.data ?? []).filter((b) => b.earned).length;
  const groups = (['legendary', 'rare', 'common'] as const).map((r) => ({ rarity: r, list: (cards.data?.cards ?? []).filter((x) => x.rarity === r) })).filter((g) => g.list.length);
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Bộ sưu tập</Txt>
      <Segmented<'badges' | 'cards'> label="Loại bộ sưu tập" value={view} onChange={setView}
        options={[{ value: 'cards', label: `Thẻ nhân vật${cards.data ? ` (${cards.data.owned}/${cards.data.total})` : ''}` }, { value: 'badges', label: `Huy hiệu${badges.data ? ` (${earned}/${badges.data.length})` : ''}` }]} />

      {view === 'cards' ? (
        <View style={{ gap: 12 }}>
          {drops.data && drops.data.length ? (
            <Card flat pad={14} style={{ gap: 8, borderColor: c.dong }}>
              <Txt f="bold" size={16}>Em có {drops.data.length} thẻ chưa lật</Txt>
              <Btn title="Lật thẻ ngay" tone="dong" onPress={() => setFlip(drops.data![0].id)} testID="drops-flip" />
            </Card>
          ) : null}
          <Txt size={13} color={c.muc2}>Thẻ rơi khi em lần đầu hoàn thành nút trận đánh hoặc nút cuối của hành trình. Thẻ trùng được đổi thành vàng.</Txt>
          {cards.loading && !cards.data ? <Spinner /> : null}
          <ErrorNote message={cards.error} />
          {groups.map((g) => (
            <View key={g.rarity} style={{ gap: 8 }}>
              <Txt f="bold" size={15} color={RARITY_COLOR(c, g.rarity).fg}>{RARITY_TEXT[g.rarity]} ({g.list.filter((x) => x.owned).length}/{g.list.length})</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {g.list.map((card: CardAlbumItem) => (
                  <Pressable key={card.id} accessibilityRole="button" accessibilityLabel={card.owned ? `Thẻ ${card.name}, ${RARITY_TEXT[card.rarity]}` : `Thẻ chưa sưu tầm, ${RARITY_TEXT[card.rarity]}, mở ở cấp ${card.min_level}`} disabled={!card.owned} onPress={() => setCardId(card.id)}>
                    <CardFace rarity={card.rarity} name={card.name} owned={card.owned} copies={card.copies} size={132} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          {cards.data && cards.data.cards.length === 0 ? <EmptyState mood="thinking" title="Chưa có thẻ nhân vật nào được công bố" /> : null}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Txt size={13} color={c.muc2}>Bấm vào một huy hiệu để xem điều kiện đạt được. Huy hiệu của trường do giáo viên hoặc nhà trường trao.</Txt>
          {badges.loading && !badges.data ? <Spinner /> : null}
          <ErrorNote message={badges.error} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{(badges.data ?? []).map((b) => <BadgeTile key={b.id} badge={b} onPress={() => setBadge(b)} />)}</View>
        </View>
      )}

      {badge ? (
        <Sheet open onClose={() => setBadge(null)} title={badge.name} subtitle={badge.scope === 'school' ? 'Huy hiệu của trường' : 'Huy hiệu hệ thống'}>
          <View style={{ gap: 10, alignItems: 'center' }}>
            {(() => { const Icon = iconOf(badge.icon); return <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: badge.earned ? badge.color : c.vien, alignItems: 'center', justifyContent: 'center' }}><Icon size={40} color={badge.earned ? '#ffffff' : c.muc3} /></View>; })()}
            {badge.description ? <Txt size={15} center>{badge.description}</Txt> : null}
            <Txt f="semibold" size={14} center color={c.muc2}>Điều kiện: {ruleText(badge.rule)}</Txt>
            <Chip text={badge.earned ? `Đã đạt${badge.awarded_at ? ` ngày ${new Date(badge.awarded_at).toLocaleDateString('vi-VN')}` : ''}` : 'Chưa đạt'} bg={badge.earned ? c.ngocNhat : c.dichNhat} fg={badge.earned ? c.ngocChu : c.dich} />
          </View>
        </Sheet>
      ) : null}
      {cardId ? <Sheet open onClose={() => setCardId(null)} title="Thẻ nhân vật">{detail.data ? <CardDetailView card={detail.data} /> : <Spinner />}</Sheet> : null}
      {flip !== null ? <FlipSheet session={session} dropId={flip} onClose={() => { setFlip(null); cards.reload(); drops.reload(); onChanged(); }} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- Xếp hạng
const rankText = (rank: number) => (rank === 1 ? '1' : String(rank));

const BoardRows: React.FC<{ entries: Array<{ rank: number; name: string; xp: number; me: boolean; zone?: 'promote' | 'demote' | 'stay' }> }> = ({ entries }) => {
  const { c } = useTheme();
  if (!entries.length) return <EmptyState mood="thinking" title="Chưa có ai trên bảng" text="Học và làm bài để ghi điểm nhé." />;
  return (
    <View style={{ gap: 6 }}>
      {entries.map((e) => (
        <View key={`${e.rank}${e.name}`} accessible accessibilityLabel={`Hạng ${e.rank}, ${e.me ? 'em' : e.name}, ${e.xp} điểm${e.zone === 'promote' ? ', vùng thăng hạng' : e.zone === 'demote' ? ', vùng xuống hạng' : ''}`}
          style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: e.me ? c.dong : c.vien, backgroundColor: e.me ? c.dongNhat : c.the }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: e.rank <= 3 ? c.vangNhat : c.giay2, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={14} color={e.rank <= 3 ? c.vangChu : c.muc2}>{rankText(e.rank)}</Txt></View>
          <Txt f={e.me ? 'bold' : 'medium'} size={15} style={{ flex: 1 }} numberOfLines={1}>{e.name}{e.me ? ' (em)' : ''}</Txt>
          {e.zone === 'promote' ? <ArrowUp size={16} color={c.ngocChu} /> : e.zone === 'demote' ? <ArrowDown size={16} color={c.sonChu} /> : null}
          <Txt f="bold" size={15}>{e.xp} điểm</Txt>
        </View>
      ))}
    </View>
  );
};

type Scope = 'class' | 'team' | 'school' | 'system' | 'league' | 'contest';
export const RankingTab: React.FC<TabProps> = ({ session, refreshKey }) => {
  const { c } = useTheme();
  const [scope, setScope] = useState<Scope>('class');
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [contestId, setContestId] = useState<number | null>(null);
  const board = useLoad(() => (scope === 'class' || scope === 'school' || scope === 'system' ? api.leaderboard(session.token, { scope, period }) : Promise.resolve(null)), [session.token, scope, period, refreshKey], session.expired);
  const league = useLoad(() => (scope === 'league' ? api.leagueView(session.token) : Promise.resolve(null)), [session.token, scope, refreshKey], session.expired);
  const contests = useLoad(() => (scope === 'contest' ? api.studentContests(session.token) : Promise.resolve(null)), [session.token, scope, refreshKey], session.expired);
  const cboard = useLoad(() => (contestId ? api.contestBoard(session.token, contestId) : Promise.resolve(null)), [session.token, contestId], session.expired);
  const lg = league.data;
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Xếp hạng</Txt>
      <Segmented<Scope> label="Loại bảng xếp hạng" value={scope} onChange={setScope}
        options={[{ value: 'class', label: 'Lớp' }, { value: 'team', label: 'Đội' }, { value: 'school', label: 'Trường' }, { value: 'system', label: 'Hệ thống' }, { value: 'league', label: 'Giải đấu tuần' }, { value: 'contest', label: 'Sự kiện' }]} />

      {scope === 'class' || scope === 'school' || scope === 'system' ? (
        <View style={{ gap: 10 }}>
          <Segmented<'week' | 'month' | 'all'> label="Khoảng thời gian" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Tuần này' }, { value: 'month', label: 'Tháng này' }, { value: 'all', label: 'Từ trước đến nay' }]} />
          <Txt size={13} color={c.muc2}>{scope === 'class' ? 'Bảng lớp hiện tên thật của các bạn trong lớp.' : 'Bảng trường và hệ thống chỉ hiện tên ẩn danh, trừ em.'}</Txt>
          {board.loading && !board.data ? <Spinner /> : null}
          <ErrorNote message={board.error} />
          {board.data?.disabled ? <InfoNote>{board.data.message ?? 'Giáo viên đã tắt bảng xếp hạng của lớp.'}</InfoNote> : null}
          {board.data && !board.data.disabled ? (
            <View style={{ gap: 10 }}>
              <Txt f="bold" size={15}>{board.data.label} · {board.data.size} học sinh</Txt>
              {board.data.me && !board.data.entries.some((e) => e.me) ? <Txt size={14} color={c.muc2}>Em đang xếp hạng {board.data.me.rank} với {board.data.me.xp} điểm.</Txt> : null}
              <BoardRows entries={board.data.entries} />
            </View>
          ) : null}
        </View>
      ) : null}

      {scope === 'team' ? <TeamRanking session={session} refreshKey={refreshKey} /> : null}

      {scope === 'league' ? (
        <View style={{ gap: 10 }}>
          {league.loading && !lg ? <Spinner /> : null}
          <ErrorNote message={league.error} />
          {lg ? (
            <View style={{ gap: 10 }}>
              <Card flat pad={14} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Trophy size={22} color={c.vangDam} /><Txt f="displayHeavy" size={20}>Hạng {lg.tier_name}</Txt></View>
                <Txt size={13} color={c.muc2}>Tuần này kết thúc lúc {new Date(lg.ends_at).toLocaleString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. {lg.promote} bạn đứng đầu nhóm được lên hạng{lg.size > lg.promote + lg.demote ? `, ${lg.demote} bạn cuối nhóm xuống hạng` : ''}.</Txt>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{lg.tiers.map((t, i) => <Chip key={t} text={t} bg={i === lg.tier ? c.vangNhat : c.giay2} fg={i === lg.tier ? c.vangChu : c.muc3} />)}</View>
              </Card>
              <BoardRows entries={lg.entries} />
            </View>
          ) : null}
        </View>
      ) : null}

      {scope === 'contest' ? (
        <View style={{ gap: 10 }}>
          {contests.loading && !contests.data ? <Spinner /> : null}
          <ErrorNote message={contests.error} />
          {contests.data && contests.data.length === 0 ? <EmptyState mood="thinking" title="Chưa có sự kiện của trường" text="Khi nhà trường tổ chức giải đấu hay sự kiện, chúng sẽ hiện ở đây." /> : null}
          {(contests.data ?? []).map((ct) => (
            <Card key={ct.id} flat pad={14} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip text={ct.status === 'active' ? 'Đang diễn ra' : ct.status === 'upcoming' ? 'Sắp diễn ra' : 'Đã kết thúc'} bg={ct.status === 'active' ? c.ngocNhat : c.giay2} fg={ct.status === 'active' ? c.ngocChu : c.muc2} />
                <Txt size={12} color={c.muc3}>{new Date(ct.starts_at).toLocaleDateString('vi-VN')} – {new Date(ct.ends_at).toLocaleDateString('vi-VN')}</Txt>
              </View>
              <Txt f="displayHeavy" size={18}>{ct.title}</Txt>
              {ct.description ? <Txt size={14} color={c.muc2}>{ct.description}</Txt> : null}
              <Txt size={13} color={c.muc2}>Điểm của em trong sự kiện: {ct.my_xp}{ct.my_rank ? ` · hạng ${ct.my_rank}/${ct.participants}` : ''}</Txt>
              <Btn title={contestId === ct.id ? 'Ẩn bảng' : 'Xem bảng điểm'} tone="giay" size="sm" onPress={() => setContestId(contestId === ct.id ? null : ct.id)} />
              {contestId === ct.id ? (cboard.data ? <BoardRows entries={cboard.data.entries} /> : <Spinner />) : null}
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
};
