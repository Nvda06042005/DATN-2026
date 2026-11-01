/**
 * Kho lịch sử cho học sinh (HK.HS.025–027, 031–036, 038–042): hồ sơ nhân vật, sự kiện, trận đánh, địa điểm, thuật ngữ, tìm kiếm, dòng thời gian có lọc,
 * bản đồ tương tác, tư liệu gốc (khóa/mở khóa, lọc, yêu thích, ghi chú). Chỉ nội dung đã Công bố. `DetailSheet` mở được từ mọi nơi (kết quả làm bài, bài học, nút).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Heart, Lock, MapPin, Save, Trash2, Unlock } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { ErrorNote, useAction, useDebounced, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { LeafletMap } from '@/components/portal/LeafletMap';
import { Btn, Card, Chip, EmptyState, Field, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Detail, FigureItem, SearchHit, SourceItem } from '@/types/learning';

const GROUP_TEXT: Record<string, string> = { king: 'Vua', general: 'Tướng lĩnh', official: 'Quan lại', other: 'Nhân vật khác' };
const KIND_TEXT: Record<string, string> = { su_lieu: 'Sử liệu', tho_van: 'Thơ văn', hich: 'Hịch', hinh_anh: 'Hình ảnh', ban_do_co: 'Bản đồ cổ' };
const TYPE_TEXT: Record<string, string> = { figure: 'Nhân vật', event: 'Sự kiện', battle: 'Trận đánh', place: 'Địa điểm', source: 'Tư liệu', term: 'Thuật ngữ' };
const KIND_PATH = { figure: 'figures', event: 'events', battle: 'battles', place: 'places', source: 'sources' } as const;

export type OpenDetail = (type: string, id: number) => void;

// ---------------------------------------------------------------------- chi tiết
const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const { c } = useTheme();
  return <View style={{ gap: 4 }}><Txt f="bold" size={13} color={c.muc3} upper>{title}</Txt>{children}</View>;
};
const Para: React.FC<{ title: string; text?: string | null }> = ({ title, text }) => (text ? <Block title={title}><Txt size={16} style={{ lineHeight: 26 }}>{text}</Txt></Block> : null);

const Related: React.FC<{ title: string; items?: Array<{ id: number; label: string; locked?: boolean }>; type: string; onOpen: OpenDetail }> = ({ title, items, type, onOpen }) => (
  items && items.length ? (
    <Block title={title}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((i) => <Btn key={`${type}${i.id}`} title={i.label} icon={i.locked ? Lock : undefined} tone={i.locked ? 'giay' : 'thuy'} size="sm" onPress={() => onOpen(type, i.id)} />)}
      </View>
    </Block>
  ) : null
);

export const DetailSheet: React.FC<{ session: Session; type: string; id: number; onClose: () => void; onOpen: OpenDetail; onChanged?: () => void }> = ({ session, type, id, onClose, onOpen, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const isTerm = type === 'term';
  const detail = useLoad<Detail>(async () => {
    if (isTerm) { const t = (await api.learnTerms(token)).find((x) => x.id === id); if (!t) throw new Error('Không tìm thấy thuật ngữ'); return { name: t.term, definition: t.definition }; }
    return api.learnDetail(token, KIND_PATH[type as keyof typeof KIND_PATH] ?? 'figures', id);
  }, [token, type, id], session.expired);
  const d = detail.data;
  const { busy, run } = useAction(session.expired);
  const [fav, setFav] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (d && type === 'source') { setFav(Boolean(d.favorite)); setNote(d.note ?? ''); } }, [d, type]);
  const title = d ? String(d.name ?? d.title ?? '') : 'Đang tải…';
  const years = d && type === 'figure' && (d.birth_year || d.death_year) ? `${d.birth_year ?? '?'} – ${d.death_year ?? '?'}` : null;
  const toggleFavorite = async () => {
    const res = await run(() => api.setFavorite(token, id, !fav));
    if (res) { setFav(res.favorite); onChanged?.(); }
  };
  return (
    <Sheet open onClose={onClose} title={title} subtitle={d ? TYPE_TEXT[type] : undefined} wide>
      <ErrorNote message={detail.error} />
      {detail.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 14 }}>
          {type === 'figure' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip text={GROUP_TEXT[d.figure_group] ?? 'Nhân vật'} bg={c.dongNhat} fg={c.dongChu} />
                {years ? <Chip text={years} bg={c.dichNhat} fg={c.dich} /> : null}
              </View>
              {d.honorific ? <Txt f="semibold" size={16}>{d.honorific}</Txt> : null}
              <Para title="Vai trò" text={d.role_text} />
              <Para title="Tiểu sử" text={d.biography} />
              {d.famous_quote ? <Block title="Câu nói nổi tiếng"><Txt f="display" size={19} style={{ fontStyle: 'italic' }}>“{d.famous_quote}”</Txt></Block> : null}
              <Related title="Cuộc kháng chiến" type="campaign" onOpen={() => undefined} items={(d.campaigns ?? []).map((x: Detail) => ({ id: x.id, label: `${x.title} (${x.year_label})` }))} />
              <Related title="Sự kiện liên quan" type="event" onOpen={onOpen} items={(d.events ?? []).map((x: Detail) => ({ id: x.id, label: `${x.name}` }))} />
              <Related title="Trận đánh" type="battle" onOpen={onOpen} items={(d.battles ?? []).map((x: Detail) => ({ id: x.id, label: `${x.name} (${x.year})` }))} />
              <Related title="Tư liệu" type="source" onOpen={onOpen} items={(d.sources ?? []).map((x: Detail) => ({ id: x.id, label: x.title, locked: x.locked }))} />
            </>
          ) : null}
          {type === 'event' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip text={d.date_text || String(d.year_from)} bg={c.dongNhat} fg={c.dongChu} />
                {d.campaign ? <Chip text={d.campaign.title} bg={c.thuyNhat} fg={c.thuyChu} /> : null}
              </View>
              <Para title="Diễn biến" text={d.description} />
              <Para title="Ý nghĩa" text={d.significance} />
              <Related title="Địa điểm" type="place" onOpen={onOpen} items={d.place ? [{ id: d.place.id, label: d.place.name }] : []} />
              <Related title="Nhân vật tham gia" type="figure" onOpen={onOpen} items={(d.figures ?? []).map((x: Detail) => ({ id: x.id, label: x.name }))} />
              <Related title="Trận đánh" type="battle" onOpen={onOpen} items={(d.battles ?? []).map((x: Detail) => ({ id: x.id, label: x.name }))} />
              <Related title="Tư liệu liên quan" type="source" onOpen={onOpen} items={(d.sources ?? []).map((x: Detail) => ({ id: x.id, label: x.title, locked: x.locked }))} />
            </>
          ) : null}
          {type === 'battle' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip text={d.date_text || String(d.year)} bg={c.dongNhat} fg={c.dongChu} />
                {d.campaign ? <Chip text={d.campaign.title} bg={c.thuyNhat} fg={c.thuyChu} /> : null}
              </View>
              <Para title="Bối cảnh" text={d.context} />
              <Para title="Lực lượng hai bên" text={d.forces} />
              <Para title="Diễn biến và chiến thuật" text={d.course} />
              <Para title="Kết quả" text={d.result} />
              {d.place && d.place.lat != null ? <LeafletMap label={`Vị trí: ${d.place.name}`} markers={[{ id: 'p', lat: d.place.lat, lng: d.place.lng, label: d.place.name, tone: 'son' }]} height={240} zoom={8} /> : null}
              <Related title="Địa điểm" type="place" onOpen={onOpen} items={d.place ? [{ id: d.place.id, label: d.place.name }] : []} />
              <Related title="Sự kiện" type="event" onOpen={onOpen} items={d.event ? [{ id: d.event.id, label: d.event.name }] : []} />
              <Related title="Chỉ huy và nhân vật" type="figure" onOpen={onOpen} items={(d.figures ?? []).map((x: Detail) => ({ id: x.id, label: x.name }))} />
              <Related title="Tư liệu liên quan" type="source" onOpen={onOpen} items={(d.sources ?? []).map((x: Detail) => ({ id: x.id, label: x.title, locked: x.locked }))} />
            </>
          ) : null}
          {type === 'place' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {d.province ? <Chip text={d.province} bg={c.dichNhat} fg={c.dich} icon={MapPin} /> : null}
                {d.old_name ? <Chip text={`Tên xưa: ${d.old_name}`} bg={c.dongNhat} fg={c.dongChu} /> : null}
              </View>
              <Para title="Mô tả" text={d.description} />
              {d.lat != null ? <LeafletMap label={`Bản đồ: ${d.name}`} markers={[{ id: 'p', lat: d.lat, lng: d.lng, label: d.name, tone: 'son' }]} height={260} zoom={9} /> : null}
              <Related title="Sự kiện xảy ra tại đây" type="event" onOpen={onOpen} items={(d.events ?? []).map((x: Detail) => ({ id: x.id, label: `${x.name} (${x.year_from})` }))} />
              <Related title="Trận đánh tại đây" type="battle" onOpen={onOpen} items={(d.battles ?? []).map((x: Detail) => ({ id: x.id, label: `${x.name} (${x.year})` }))} />
              <Related title="Tư liệu" type="source" onOpen={onOpen} items={(d.sources ?? []).map((x: Detail) => ({ id: x.id, label: x.title, locked: x.locked }))} />
            </>
          ) : null}
          {type === 'term' ? <Txt size={17} style={{ lineHeight: 28 }}>{d.definition}</Txt> : null}
          {type === 'source' ? (
            d.locked ? (
              <Card flat pad={16} style={{ gap: 8, alignItems: 'center' }}>
                <Lock size={30} color={c.muc3} />
                <Txt f="bold" size={16} center>Tư liệu chưa mở khóa</Txt>
                <Txt size={14} color={c.muc2} center>{d.hint}</Txt>
              </Card>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Chip text={KIND_TEXT[d.kind] ?? 'Tư liệu'} bg={c.dongNhat} fg={c.dongChu} />
                  <Chip text="Đã mở khóa" bg={c.ngocNhat} fg={c.ngocChu} icon={Unlock} />
                  <Btn icon={Heart} title={fav ? 'Bỏ yêu thích' : 'Yêu thích'} tone={fav ? 'dong' : 'giay'} size="sm" loading={busy} onPress={toggleFavorite} />
                </View>
                <Para title="Nguyên văn" text={d.original_text} />
                <Para title="Phiên âm" text={d.transliteration} />
                <Para title="Dịch nghĩa" text={d.translation} />
                <Para title="Chú giải" text={d.annotation} />
                <Para title="Nguồn trích dẫn" text={d.citation} />
                <Related title="Cuộc kháng chiến" type="campaign" onOpen={() => undefined} items={(d.campaigns ?? []).map((x: Detail) => ({ id: x.id, label: x.title }))} />
                <Related title="Nhân vật" type="figure" onOpen={onOpen} items={(d.figures ?? []).map((x: Detail) => ({ id: x.id, label: x.name }))} />
                <Related title="Sự kiện" type="event" onOpen={onOpen} items={(d.events ?? []).map((x: Detail) => ({ id: x.id, label: x.name }))} />
                <Related title="Trận đánh" type="battle" onOpen={onOpen} items={(d.battles ?? []).map((x: Detail) => ({ id: x.id, label: x.name }))} />
                <Related title="Địa điểm" type="place" onOpen={onOpen} items={(d.places ?? []).map((x: Detail) => ({ id: x.id, label: x.name }))} />
                {session.user.role === 'student' ? (
                  <Card flat pad={14} style={{ gap: 8 }}>
                    <Txt f="bold" size={15}>Ghi chú của em</Txt>
                    <TextInput value={note} onChangeText={setNote} multiline maxLength={2000} accessibilityLabel="Ghi chú riêng cho tư liệu" placeholder="Viết điều em muốn nhớ…" placeholderTextColor={c.muc3}
                      style={{ minHeight: 80, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: c.vien, color: c.muc, fontSize: 16, textAlignVertical: 'top', backgroundColor: c.the }} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Btn icon={Save} title="Lưu ghi chú" tone="giay" size="sm" disabled={!note.trim() || busy} onPress={() => run(() => api.saveNote(token, 'source', id, note), 'Đã lưu ghi chú')} />
                      {d.note ? <Btn icon={Trash2} label="Xóa ghi chú" tone="giay" size="sm" onPress={async () => { await run(() => api.removeNote(token, 'source', id), 'Đã xóa ghi chú'); setNote(''); }} /> : null}
                    </View>
                  </Card>
                ) : null}
              </>
            )
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- thư viện: nhân vật, địa danh, thuật ngữ, tìm kiếm
type LibTab = 'figures' | 'places' | 'terms';

export const LibraryTab: React.FC<{ session: Session; onOpen: OpenDetail }> = ({ session, onOpen }) => {
  const { c } = useTheme();
  const { token } = session;
  const [tab, setTab] = useState<LibTab>('figures');
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q.trim(), 350);
  const search = useLoad<SearchHit[]>(async () => (debounced.length >= 2 ? api.learnSearch(token, debounced) : []), [token, debounced], session.expired);
  const figures = useLoad<FigureItem[]>(() => api.learnFigures(token, { group }), [token, group], session.expired);
  const places = useLoad(() => api.learnPlaces(token), [token], session.expired);
  const terms = useLoad(() => api.learnTerms(token), [token], session.expired);
  const searching = debounced.length >= 2;
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Thư viện lịch sử</Txt>
      <Field label="Tìm kiếm trong kho lịch sử" value={q} onChangeText={setQ} placeholder="Nhân vật, sự kiện, địa điểm, trận đánh, tư liệu…" returnKeyType="search" nativeID="library-search" />
      {searching ? (
        <View style={{ gap: 8 }}>
          <ErrorNote message={search.error} />
          {search.loading ? <Spinner label="Đang tìm…" /> : null}
          {!search.loading && (search.data ?? []).length === 0 ? <EmptyState mood="thinking" title="Không tìm thấy kết quả" text="Thử từ khóa ngắn hơn hoặc gõ không dấu." /> : null}
          {(search.data ?? []).map((h) => (
            <Pressable key={`${h.type}${h.id}`} accessibilityRole="button" onPress={() => onOpen(h.type, h.id)} style={({ pressed }) => ({ minHeight: 56, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, gap: 2 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Chip text={TYPE_TEXT[h.type]} bg={c.thuyNhat} fg={c.thuyChu} />
                {h.locked ? <Lock size={14} color={c.muc3} /> : null}
                <Txt f="bold" size={16} style={{ flex: 1 }} numberOfLines={1}>{h.title}</Txt>
              </View>
              {h.snippet ? <Txt size={13} color={c.muc2} numberOfLines={2}>{h.snippet}</Txt> : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Segmented<LibTab> label="Mục thư viện" value={tab} onChange={setTab} options={[{ value: 'figures', label: 'Nhân vật' }, { value: 'places', label: 'Địa danh' }, { value: 'terms', label: 'Thuật ngữ' }]} />
          {tab === 'figures' ? (
            <View style={{ gap: 10 }}>
              <Segmented<string> label="Nhóm nhân vật" value={group} onChange={setGroup} options={[{ value: '', label: 'Tất cả' }, ...Object.entries(GROUP_TEXT).map(([value, label]) => ({ value, label }))]} />
              <ErrorNote message={figures.error} />
              {figures.loading && !figures.data ? <Spinner /> : null}
              {figures.data && figures.data.length === 0 ? <EmptyState mood="thinking" title="Chưa có hồ sơ nhân vật" text="Hồ sơ sẽ hiện khi được công bố." /> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {(figures.data ?? []).map((f) => (
                  <Pressable key={f.id} accessibilityRole="button" accessibilityLabel={`${f.name}, ${GROUP_TEXT[f.figure_group]}`} onPress={() => onOpen('figure', f.id)}
                    style={({ pressed }) => ({ flexGrow: 1, flexBasis: 260, minHeight: 88, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, gap: 4 })}>
                    <Txt f="displayHeavy" size={19}>{f.name}</Txt>
                    <Txt size={13} color={c.dongChu} f="semibold">{GROUP_TEXT[f.figure_group]}{f.birth_year || f.death_year ? ` · ${f.birth_year ?? '?'} – ${f.death_year ?? '?'}` : ''}</Txt>
                    {f.role_text ? <Txt size={13} color={c.muc2} numberOfLines={2}>{f.role_text}</Txt> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {tab === 'places' ? (
            <View style={{ gap: 8 }}>
              <ErrorNote message={places.error} />
              {places.loading && !places.data ? <Spinner /> : null}
              {(places.data ?? []).map((p) => (
                <Pressable key={p.id} accessibilityRole="button" onPress={() => onOpen('place', p.id)} style={({ pressed }) => ({ minHeight: 56, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, gap: 2 })}>
                  <Txt f="bold" size={16}>{p.name}</Txt>
                  <Txt size={13} color={c.muc2}>{[p.old_name && `Tên xưa: ${p.old_name}`, p.province].filter(Boolean).join(' · ')}</Txt>
                </Pressable>
              ))}
            </View>
          ) : null}
          {tab === 'terms' ? (
            <View style={{ gap: 8 }}>
              <ErrorNote message={terms.error} />
              {terms.loading && !terms.data ? <Spinner /> : null}
              {(terms.data ?? []).map((t) => (
                <Card key={t.id} flat pad={14} style={{ gap: 4 }}>
                  <Txt f="displayHeavy" size={19}>{t.term}</Txt>
                  <Txt size={15} color={c.muc2}>{t.definition}</Txt>
                </Card>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------- dòng thời gian (HK.HS.025–026)
export const TimelineTab: React.FC<{ session: Session; onOpen: OpenDetail }> = ({ session, onOpen }) => {
  const { c } = useTheme();
  const { token } = session;
  const [campaign, setCampaign] = useState('');
  const [figure, setFigure] = useState('');
  const [place, setPlace] = useState('');
  const campaigns = useLoad(() => api.learnCampaigns(token), [token], session.expired);
  const figures = useLoad(() => api.learnFigures(token), [token], session.expired);
  const places = useLoad(() => api.learnPlaces(token), [token], session.expired);
  const timeline = useLoad(() => api.learnTimeline(token, { campaign_id: campaign, figure_id: figure, place_id: place }), [token, campaign, figure, place], session.expired);
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Dòng thời gian 1258 – 1288</Txt>
      <Segmented<string> label="Lọc theo cuộc kháng chiến" value={campaign} onChange={setCampaign} options={[{ value: '', label: 'Tất cả' }, ...(campaigns.data ?? []).map((x) => ({ value: String(x.id), label: String(x.year_label) }))]} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ flexGrow: 1, flexBasis: 220 }}><AdminSelect label="Nhân vật" value={figure} options={[{ value: '', label: 'Tất cả nhân vật' }, ...(figures.data ?? []).map((x) => ({ value: String(x.id), label: x.name }))]} onChange={setFigure} /></View>
        <View style={{ flexGrow: 1, flexBasis: 220 }}><AdminSelect label="Địa điểm" value={place} options={[{ value: '', label: 'Tất cả địa điểm' }, ...(places.data ?? []).map((x) => ({ value: String(x.id), label: x.name }))]} onChange={setPlace} /></View>
      </View>
      <ErrorNote message={timeline.error} />
      {timeline.loading && !timeline.data ? <Spinner /> : null}
      {timeline.data && timeline.data.length === 0 ? <EmptyState mood="thinking" title="Chưa có mốc nào" text="Thử bỏ bớt bộ lọc, hoặc nội dung chưa được công bố." /> : null}
      <View style={{ paddingLeft: 6 }}>
        {(timeline.data ?? []).map((e, i, all) => (
          <View key={`${e.type}${e.id}`} style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ width: 70, alignItems: 'center' }}>
              <View style={{ minWidth: 62, paddingHorizontal: 6, height: 34, borderRadius: 17, backgroundColor: e.type === 'battle' ? c.son : c.dong, alignItems: 'center', justifyContent: 'center' }}><Txt f="displayHeavy" size={16} color="#ffffff">{e.year}</Txt></View>
              {i < all.length - 1 ? <View style={{ flex: 1, width: 0, minHeight: 20, borderLeftWidth: 3, borderColor: c.vien2 }} /> : null}
            </View>
            <Pressable accessibilityRole="button" onPress={() => onOpen(e.type, e.id)} style={({ pressed }) => ({ flex: 1, marginBottom: 14, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, gap: 2 })}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip text={e.type === 'battle' ? 'Trận đánh' : 'Sự kiện'} bg={e.type === 'battle' ? c.sonNhat : c.dongNhat} fg={e.type === 'battle' ? c.sonChu : c.dongChu} />
                {e.date_text ? <Txt size={12} color={c.muc3}>{e.date_text}</Txt> : null}
              </View>
              <Txt f="bold" size={16}>{e.name}</Txt>
              {e.place_name ? <Txt size={13} color={c.muc2}>{e.place_name}</Txt> : null}
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- bản đồ tương tác (HK.HS.027)
export const MapTab: React.FC<{ session: Session; onOpen: OpenDetail }> = ({ session, onOpen }) => {
  const { c } = useTheme();
  const { token } = session;
  const [campaign, setCampaign] = useState('');
  const campaigns = useLoad(() => api.learnCampaigns(token), [token], session.expired);
  const map = useLoad(() => api.learnMap(token, { campaign_id: campaign }), [token, campaign], session.expired);
  const places = map.data ?? [];
  const markers = useMemo(() => places.map((p) => ({ id: String(p.id), lat: p.lat, lng: p.lng, label: p.name, tone: 'son' as const })), [places]);
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Bản đồ các địa danh</Txt>
      <Segmented<string> label="Lọc theo cuộc kháng chiến" value={campaign} onChange={setCampaign} options={[{ value: '', label: 'Tất cả' }, ...(campaigns.data ?? []).map((x) => ({ value: String(x.id), label: String(x.year_label) }))]} />
      <ErrorNote message={map.error} />
      {map.loading && !map.data ? <Spinner label="Đang tải bản đồ…" /> : null}
      <LeafletMap label="Bản đồ địa danh kháng chiến. Bấm vào điểm để xem chi tiết" markers={markers} onMarkerPress={(id) => onOpen('place', Number(id))} height={420} />
      {map.data && places.length === 0 ? <EmptyState mood="thinking" title="Chưa có địa danh nào có tọa độ" text="Địa danh sẽ hiện khi được công bố kèm tọa độ." /> : null}
      <View style={{ gap: 8 }}>
        {places.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => onOpen('place', p.id)} style={({ pressed }) => ({ minHeight: 56, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, gap: 2 })}>
            <Txt f="bold" size={16}>{p.name}</Txt>
            <Txt size={13} color={c.muc2}>{p.items.map((i) => `${i.name} (${i.year})`).join(' · ') || 'Chưa có sự kiện gắn với địa điểm này'}</Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- tư liệu gốc (HK.HS.038–042)
export const SourcesTab: React.FC<{ session: Session; refreshKey: number; onOpen: OpenDetail }> = ({ session, refreshKey, onOpen }) => {
  const { c } = useTheme();
  const { token } = session;
  const [lock, setLock] = useState('');
  const [kind, setKind] = useState('');
  const [campaign, setCampaign] = useState('');
  const [fav, setFav] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q.trim(), 350);
  const campaigns = useLoad(() => api.learnCampaigns(token), [token], session.expired);
  const sources = useLoad<SourceItem[]>(
    () => api.learnSources(token, { q: debounced, kind, campaign_id: campaign, unlocked: lock, favorites: fav ? 'true' : '' }),
    [token, debounced, kind, campaign, lock, fav, refreshKey], session.expired);
  const { run } = useAction(session.expired);
  const toggle = async (s: SourceItem) => { if (await run(() => api.setFavorite(token, s.id, !s.favorite))) sources.reload(); };
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Kho tư liệu gốc</Txt>
      <Field label="Tìm tư liệu" value={q} onChangeText={setQ} placeholder="Tên tư liệu, nguồn trích dẫn…" nativeID="source-search" />
      <Segmented<string> label="Trạng thái mở khóa" value={lock} onChange={setLock} options={[{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đã mở khóa' }, { value: 'false', label: 'Chưa mở khóa' }]} />
      <Segmented<string> label="Loại tư liệu" value={kind} onChange={setKind} options={[{ value: '', label: 'Mọi loại' }, ...Object.entries(KIND_TEXT).map(([value, label]) => ({ value, label }))]} />
      <Segmented<string> label="Cuộc kháng chiến" value={campaign} onChange={setCampaign} options={[{ value: '', label: 'Tất cả' }, ...(campaigns.data ?? []).map((x) => ({ value: String(x.id), label: String(x.year_label) }))]} />
      <Btn icon={Heart} title={fav ? 'Đang xem tư liệu yêu thích' : 'Chỉ xem tư liệu yêu thích'} tone={fav ? 'dong' : 'giay'} size="sm" onPress={() => setFav(!fav)} />
      <ErrorNote message={sources.error} />
      {sources.loading && !sources.data ? <Spinner /> : null}
      {sources.data && sources.data.length === 0 ? <EmptyState mood="thinking" title="Không có tư liệu phù hợp" text="Thử bỏ bớt bộ lọc." /> : null}
      <View style={{ gap: 10 }}>
        {(sources.data ?? []).map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${s.title}, ${s.locked ? 'chưa mở khóa' : 'đã mở khóa'}`} onPress={() => onOpen('source', s.id)}
              style={({ pressed }) => ({ flex: 1, minHeight: 64, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: s.locked ? c.vien : c.ngoc, backgroundColor: pressed ? c.the2 : c.the, gap: 4 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip text={KIND_TEXT[s.kind] ?? 'Tư liệu'} bg={c.dongNhat} fg={c.dongChu} />
                {s.locked ? <Chip text="Chưa mở khóa" bg={c.dichNhat} fg={c.dich} icon={Lock} /> : <Chip text="Đã mở khóa" bg={c.ngocNhat} fg={c.ngocChu} icon={Unlock} />}
              </View>
              <Txt f="bold" size={16}>{s.title}</Txt>
              {s.locked && s.unlock_node ? <Txt size={13} color={c.muc2}>Hoàn thành nút “{s.unlock_node}” để mở khóa</Txt> : s.citation ? <Txt size={13} color={c.muc2} numberOfLines={2}>{s.citation}</Txt> : null}
            </Pressable>
            {!s.locked ? <Btn icon={Heart} label={s.favorite ? `Bỏ yêu thích ${s.title}` : `Yêu thích ${s.title}`} tone={s.favorite ? 'dong' : 'giay'} size="sm" onPress={() => toggle(s)} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
};
