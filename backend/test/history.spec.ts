/**
 * Sprint 2, phần kho dữ liệu lịch sử của quản trị tổng (HK.AD.028–042): cuộc kháng chiến, nhân vật, sự kiện, địa điểm, trận đánh,
 * dòng thời gian, tư liệu, thuật ngữ; vòng đời Nháp → Đã kiểm chứng → Công bố; lịch sử chỉnh sửa; nhập/xuất.
 */
import { activate, adminLogin, call, download, hasPostgres, Started, startApp, upload } from './harness';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, db: DatabaseService, root: string;
const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
const h = (path: string) => `/api/admin/history/${path}`;
const bySlug = async (entity: string, slug: string) => (await api('GET', h(entity))).body.items.find((x: any) => x.slug === slug);

(hasPostgres() ? describe : describe.skip)('Sprint 2 – kho dữ liệu lịch sử', () => {
  beforeAll(async () => {
    s = await startApp('history_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    root = await adminLogin(s.base);
  });
  afterAll(async () => { await s?.close(); });

  test('dữ liệu khởi tạo: ba cuộc kháng chiến cùng nhân vật, sự kiện, trận đánh, tư liệu, thuật ngữ đều ở trạng thái Nháp', async () => {
    const overview = (await api('GET', h('overview'))).body;
    for (const e of ['campaign', 'place', 'figure', 'event', 'battle', 'source', 'term']) expect(overview[e]).toMatchObject({ draft: overview[e].total, verified: 0, published: 0 });
    expect(overview.campaign.total).toBe(3);
    expect(overview.battle.total).toBe(6);
    const campaigns = (await api('GET', h('campaigns'))).body;
    expect(campaigns.items.map((c: any) => [c.slug, c.year_label])).toEqual([['khang-chien-lan-1-1258', '1258'], ['khang-chien-lan-2-1285', '1285'], ['khang-chien-lan-3-1287-1288', '1287 – 1288']]);
    expect(campaigns.status_counts).toEqual({ draft: 3, verified: 0, published: 0 });
    const specs = (await api('GET', h('specs'))).body;
    expect(specs.map((x: any) => x.entity)).toEqual(['campaign', 'place', 'figure', 'source', 'term', 'event', 'battle']);
    expect(specs.find((x: any) => x.entity === 'figure').fields.map((f: any) => f.name)).toContain('famous_quote');
  });

  // ------------------------------------------------------------------ AD.028
  test('HK.AD.028 quản lý cuộc kháng chiến: thêm, sửa, kiểm tra dữ liệu, không xóa khi còn sự kiện/trận đánh', async () => {
    const created = await api('POST', h('campaigns'), { title: 'Kháng chiến thử nghiệm', year_label: '1300', start_year: 1300, end_year: 1301, summary: 'Chỉ để kiểm thử.', image_url: 'https://example.edu.vn/a.jpg', sort_order: 9 });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ slug: 'khang-chien-thu-nghiem', status: 'draft', status_label: 'Nháp', version_no: 1, title: 'Kháng chiến thử nghiệm' });
    const twin = await api('POST', h('campaigns'), { title: 'Kháng chiến thử nghiệm', year_label: '1300' });
    expect(twin.body.slug).toBe('khang-chien-thu-nghiem-2');
    for (const bad of [{ year_label: '1300' }, { title: 'Thiếu năm' }, { title: 'X', year_label: '1300' }, { title: 'Năm sai', year_label: '1', start_year: 1301, end_year: 1300 }, { title: 'Năm ngoài', year_label: '1', start_year: 900 }, { title: 'Ảnh http', year_label: '1', image_url: 'http://x.example/a.jpg' }]) {
      expect([JSON.stringify(bad), (await api('POST', h('campaigns'), bad)).status]).toEqual([JSON.stringify(bad), 422]);
    }
    expect((await api('POST', h('campaigns'), { title: 'Trùng slug', year_label: '1', slug: 'khang-chien-thu-nghiem' })).status).toBe(409);
    const edited = await api('PATCH', h(`campaigns/${created.body.id}`), { title: 'Kháng chiến thử nghiệm (sửa)', summary: '' });
    expect(edited.body).toMatchObject({ title: 'Kháng chiến thử nghiệm (sửa)', summary: null, version_no: 2, slug: 'khang-chien-thu-nghiem', unchanged: false });
    expect((await api('PATCH', h(`campaigns/${created.body.id}`), { title: 'Kháng chiến thử nghiệm (sửa)' })).body).toMatchObject({ unchanged: true, version_no: 2 }); // không đổi gì thì không sinh phiên bản
    // Có sự kiện thuộc cuộc kháng chiến thì không xóa
    const c1 = await bySlug('campaigns', 'khang-chien-lan-1-1258');
    const blocked = await api('DELETE', h(`campaigns/${c1.id}`));
    expect(blocked.status).toBe(409);
    expect(blocked.body.detail).toMatch(/sự kiện thuộc về nó/);
    expect((await api('DELETE', h(`campaigns/${twin.body.id}`))).status).toBe(204);
    expect((await api('DELETE', h(`campaigns/${created.body.id}`))).status).toBe(204);
    expect((await api('GET', h(`campaigns/${created.body.id}`))).status).toBe(404);
    expect((await api('GET', h('khong-co'))).status).toBe(404);
  });

  // ------------------------------------------------------------------ AD.029/030/031/032/033
  test('HK.AD.029/030 xem và lọc nhân vật theo nhóm, cuộc kháng chiến, trạng thái, từ khóa không dấu', async () => {
    const kings = (await api('GET', h('figures?figure_group=king'))).body;
    expect(kings.items.map((f: any) => f.name)).toEqual(['Trần Thái Tông', 'Trần Thánh Tông', 'Trần Nhân Tông']);
    expect(kings.items[0]).toMatchObject({ figure_group: 'king', birth_year: 1218, death_year: 1277, status: 'draft' });
    const c3 = await bySlug('campaigns', 'khang-chien-lan-3-1287-1288');
    const third = (await api('GET', h(`figures?campaign_id=${c3.id}`))).body.items.map((f: any) => f.slug).sort();
    expect(third).toEqual(['o-ma-nhi', 'pham-ngu-lao', 'thoat-hoan', 'tran-hung-dao', 'tran-khanh-du', 'tran-nhan-tong', 'tran-nhat-duat', 'yet-kieu']);
    const hungDao = (await api('GET', h('figures?q=hung%20dao'))).body.items.map((f: any) => f.slug);
    expect(hungDao).toContain('tran-hung-dao');
    expect(hungDao).toContain('yet-kieu'); // tìm cả trong vai trò: "gia tướng ... của Trần Hưng Đạo"
    expect((await api('GET', h('figures?q=tran%20quoc%20toan'))).body.items.map((f: any) => f.slug)).toEqual(['tran-quoc-toan']);
    expect((await api('GET', h('figures?q=NGOT%20LUONG'))).body.items).toHaveLength(1);
    expect((await api('GET', h('figures?status=published'))).body.total).toBe(0);
    expect((await api('GET', h('figures?figure_group=lạ'))).status).toBe(422);
  });

  let figureId: number, eventId: number;
  test('HK.AD.031/032 thêm nhân vật kèm liên kết sự kiện, tư liệu, cuộc kháng chiến; sửa lưu lịch sử chỉnh sửa', async () => {
    const c2 = await bySlug('campaigns', 'khang-chien-lan-2-1285');
    const event = await bySlug('events', 'hoi-nghi-dien-hong-1285');
    const source = await bySlug('sources', 'tung-gia-hoan-kinh-su');
    const created = await api('POST', h('figures'), {
      name: 'Trần Văn Thử', honorific: 'Thử hầu', figure_group: 'general', birth_year: 1250, death_year: 1300, role_text: 'Tướng thử nghiệm', biography: 'Tiểu sử thử nghiệm.', famous_quote: 'Quyết chiến!', source_note: 'Sách thử',
      links: { campaign: [c2.id], event: [event.id], source: [source.id] },
    });
    expect(created.status).toBe(201);
    figureId = created.body.id;
    expect(created.body.links).toEqual({ campaign: [c2.id], event: [event.id], source: [source.id] });
    expect(created.body.link_items.event[0]).toMatchObject({ slug: 'hoi-nghi-dien-hong-1285', label: 'Hội nghị Diên Hồng' });
    // Liên kết hai chiều: từ sự kiện nhìn lại thấy nhân vật mới
    expect((await api('GET', h(`events/${event.id}`))).body.links.figure).toContain(figureId);
    expect((await api('GET', h(`sources/${source.id}`))).body.links.figure).toContain(figureId);
    for (const bad of [{ name: 'Nhóm sai', figure_group: 'alien' }, { name: 'Sinh sau mất', figure_group: 'other', birth_year: 1300, death_year: 1200 }, { name: 'Liên kết sai loại', figure_group: 'other', links: { place: [1] } }, { name: 'Liên kết không có', figure_group: 'other', links: { event: [999999] } }]) {
      expect([JSON.stringify(bad), (await api('POST', h('figures'), bad)).status]).toEqual([JSON.stringify(bad), 422]);
    }
    const edited = await api('PATCH', h(`figures/${figureId}`), { biography: 'Tiểu sử đã sửa.', links: { event: [] } });
    expect(edited.body).toMatchObject({ version_no: 2, biography: 'Tiểu sử đã sửa.', status_reset: false });
    expect(edited.body.links).toEqual({ campaign: [c2.id], source: [source.id] });
    const versions = (await api('GET', h(`figures/${figureId}/versions`))).body;
    expect(versions.map((v: any) => [v.version_no, v.action])).toEqual([[2, 'update'], [1, 'create']]);
    expect(versions[0]).toMatchObject({ changed_by: 'Quản trị tổng Đông A', status: 'draft' });
    // Chỉ đổi liên kết cũng tính là chỉnh sửa
    expect((await api('PATCH', h(`figures/${figureId}`), { links: { event: [event.id] } })).body.version_no).toBe(3);
  });

  test('HK.AD.033 không xóa nhân vật khi còn liên kết với sự kiện/trận đánh/tư liệu; gỡ hết liên kết thì xóa được', async () => {
    const blocked = await api('DELETE', h(`figures/${figureId}`));
    expect(blocked.status).toBe(409);
    expect(blocked.body.detail).toMatch(/liên kết/);
    const th = await bySlug('figures', 'tran-hung-dao');
    expect((await api('DELETE', h(`figures/${th.id}`))).status).toBe(409);
    await api('PATCH', h(`figures/${figureId}`), { links: { campaign: [], event: [], source: [] } });
    expect((await api('DELETE', h(`figures/${figureId}`))).status).toBe(204);
    // Lịch sử phiên bản vẫn còn sau khi xóa
    expect((await api('GET', h(`figures/${figureId}/versions`))).body.length).toBeGreaterThanOrEqual(4);
  });

  // ------------------------------------------------------------------ AD.034/035/036
  test('HK.AD.035 địa điểm: tên gọi xưa – nay, tọa độ chọn trên bản đồ (cả vĩ độ và kinh độ), không xóa khi còn sự kiện/trận đánh', async () => {
    const created = await api('POST', h('places'), { name: 'Bến Thử', old_name: 'Bến Cũ', province: 'Hà Nội', lat: 21.0285, lng: 105.8542, description: 'Địa điểm thử.' });
    expect(created.body).toMatchObject({ slug: 'ben-thu', old_name: 'Bến Cũ' });
    expect(Number(created.body.lat)).toBeCloseTo(21.0285, 4);
    expect((await api('POST', h('places'), { name: 'Chỉ vĩ độ', lat: 21 })).status).toBe(422);
    expect((await api('POST', h('places'), { name: 'Vĩ độ lạ', lat: 95, lng: 105 })).status).toBe(422);
    expect((await api('PATCH', h(`places/${created.body.id}`), { lat: null })).status).toBe(422);
    expect((await api('PATCH', h(`places/${created.body.id}`), { lat: null, lng: null })).body.lat).toBeNull();
    expect((await api('PATCH', h(`places/${created.body.id}`), { lat: '21.5', lng: '105.5' })).body.version_no).toBe(3);
    const bachDang = await bySlug('places', 'bach-dang');
    expect(bachDang.lat).toBeNull(); // địa điểm chưa chắc chắn để trống cho quản trị viên chọn trên bản đồ
    const van = await bySlug('places', 'van-don');
    expect(Number(van.lat)).toBeCloseTo(21.0545, 3);
    expect((await api('DELETE', h(`places/${van.id}`))).status).toBe(409);
    expect((await api('DELETE', h(`places/${created.body.id}`))).status).toBe(204);
  });

  test('HK.AD.034/036 sự kiện và trận đánh: liên kết cuộc kháng chiến, địa điểm, sự kiện, nhân vật; mã mini-game; kiểm tra tham chiếu', async () => {
    const c1 = await bySlug('campaigns', 'khang-chien-lan-1-1258');
    const place = await bySlug('places', 'dong-bo-dau');
    const figure = await bySlug('figures', 'tran-thai-tong');
    const event = await api('POST', h('events'), { name: 'Sự kiện thử nghiệm', year_from: 1258, year_to: 1259, date_text: 'Mùa xuân 1258', description: 'Mô tả thử.', significance: 'Ý nghĩa thử.', campaign_id: c1.id, place_id: place.id, sort_order: 10, links: { figure: [figure.id] } });
    expect(event.status).toBe(201);
    eventId = event.body.id;
    expect(event.body.ref_labels).toEqual({ campaign_id: 'Kháng chiến chống Mông Cổ lần thứ nhất', place_id: 'Đông Bộ Đầu' });
    for (const bad of [{ name: 'Thiếu năm' }, { name: 'Năm sai', year_from: 1259, year_to: 1258 }, { name: 'Cha không có', year_from: 1258, campaign_id: 999999 }, { name: 'Địa điểm không có', year_from: 1258, place_id: 999999 }]) {
      expect([JSON.stringify(bad), (await api('POST', h('events'), bad)).status]).toEqual([JSON.stringify(bad), 422]);
    }
    const battle = await api('POST', h('battles'), { name: 'Trận thử nghiệm', year: 1258, context: 'Bối cảnh.', forces: 'Lực lượng.', course: 'Diễn biến.', result: 'Kết quả.', campaign_id: c1.id, place_id: place.id, event_id: eventId, minigame_key: 'tran_thu', sort_order: 50, links: { figure: [figure.id] } });
    expect(battle.status).toBe(201);
    expect(battle.body.links.figure).toEqual([figure.id]);
    expect((await api('POST', h('battles'), { name: 'Khóa mini-game sai', year: 1258, minigame_key: 'Tran-Thu!' })).status).toBe(422);
    expect((await api('GET', h(`battles?campaign_id=${c1.id}`))).body.items.map((b: any) => b.slug)).toEqual(['dong-bo-dau', 'tran-thu-nghiem']);
    expect((await api('GET', h(`events?place_id=${place.id}`))).body.items.map((e: any) => e.slug)).toEqual(['dai-thang-dong-bo-dau-1258', 'su-kien-thu-nghiem']);
    // Sự kiện đang có trận đánh thuộc về thì không xóa được; xóa trận đánh trước (trận đánh còn liên kết nhân vật nên phải gỡ liên kết)
    expect((await api('DELETE', h(`events/${eventId}`))).status).toBe(409);
    expect((await api('DELETE', h(`battles/${battle.body.id}`))).status).toBe(409);
    await api('PATCH', h(`battles/${battle.body.id}`), { links: { figure: [] } });
    expect((await api('DELETE', h(`battles/${battle.body.id}`))).status).toBe(204);
  });

  // ------------------------------------------------------------------ AD.037
  test('HK.AD.037 dòng thời gian: xem theo cuộc kháng chiến và kéo thả đổi thứ tự (mỗi lần đổi lưu phiên bản)', async () => {
    const c1 = await bySlug('campaigns', 'khang-chien-lan-1-1258');
    const view = (await api('GET', h(`timeline?campaign_id=${c1.id}`))).body;
    expect(view.campaigns).toHaveLength(1);
    const names = view.campaigns[0].events.map((e: any) => e.slug);
    expect(names).toEqual(['su-gia-mong-co-bi-bat-giam', 'tran-binh-le-nguyen-1258', 'vuon-khong-nha-trong-1258', 'dai-thang-dong-bo-dau-1258', 'su-kien-thu-nghiem']);
    expect(view.campaigns[0].events[3]).toMatchObject({ battles: 1, place_name: 'Đông Bộ Đầu', year_from: 1258 });
    const ids = view.campaigns[0].events.map((e: any) => e.id) as number[];
    const reordered = [ids[4], ids[0], ids[1], ids[3], ids[2]];
    const done = await api('PUT', h(`timeline/${c1.id}/order`), { event_ids: reordered });
    expect(done.status).toBe(200);
    expect(done.body.campaigns[0].events.map((e: any) => e.id)).toEqual(reordered);
    expect((await api('GET', h(`events/${ids[4]}/versions`))).body[0]).toMatchObject({ action: 'reorder', note: 'Thứ tự trên dòng thời gian: 1' });
    for (const bad of [reordered.slice(1), [...reordered, 99999], [reordered[0], reordered[0], ...reordered.slice(2)]]) expect((await api('PUT', h(`timeline/${c1.id}/order`), { event_ids: bad })).status).toBe(422);
    expect((await api('PUT', h('timeline/999999/order'), { event_ids: [] })).status).toBe(404);
    const all = (await api('GET', h('timeline'))).body;
    expect(all.campaigns).toHaveLength(3);
    expect(all.unassigned).toEqual([]);
    await api('PUT', h(`timeline/${c1.id}/order`), { event_ids: ids });
  });

  // ------------------------------------------------------------------ AD.038/039
  test('HK.AD.038/039 tư liệu gốc (nguyên văn, phiên âm, dịch nghĩa, chú giải, nguồn, tệp) và từ điển thuật ngữ', async () => {
    const poem = await bySlug('sources', 'tung-gia-hoan-kinh-su');
    expect(poem).toMatchObject({ kind: 'tho_van', original_text: '奪槊章陽渡\n擒胡鹹子關\n太平須努力\n萬古此江山' });
    expect(poem.transliteration).toContain('Thái bình tu nỗ lực');
    const created = await api('POST', h('sources'), { title: 'Tư liệu thử', kind: 'hich', original_text: '原文', transliteration: 'Nguyên văn', translation: 'Dịch nghĩa', annotation: 'Chú giải', citation: 'Sách thử, tr.1', attachment_url: 'https://example.edu.vn/tu-lieu.pdf', links: { campaign: [(await bySlug('campaigns', 'khang-chien-lan-2-1285')).id] } });
    expect(created.status).toBe(201);
    expect((await api('POST', h('sources'), { title: 'Loại sai', kind: 'video' })).status).toBe(422);
    expect((await api('POST', h('sources'), { title: 'Tệp http', attachment_url: 'ftp://x/y.pdf' })).status).toBe(422);
    expect((await api('GET', h('sources?kind=hich'))).body.items.map((x: any) => x.slug).sort()).toEqual(['hich-tuong-si-trich-doan', 'tu-lieu-thu']);
    expect((await api('GET', h('sources?q=tung%20gia'))).body.items).toHaveLength(1);
    const term = await api('POST', h('terms'), { term: 'Thuật ngữ thử', definition: 'Giải nghĩa thử nghiệm.' });
    expect(term.body.slug).toBe('thuat-ngu-thu');
    expect((await api('POST', h('terms'), { term: 'Thiếu giải nghĩa' })).status).toBe(422);
    expect((await api('POST', h('terms'), { term: 'Liên kết', definition: 'Không có liên kết.', links: { figure: [1] } })).status).toBe(422);
    expect((await api('GET', h('terms?q=thai%20thuong'))).body.items.map((t: any) => t.term)).toEqual(['Thái thượng hoàng']);
    expect((await api('DELETE', h(`terms/${term.body.id}`))).status).toBe(204);
    expect((await api('DELETE', h(`sources/${created.body.id}`))).status).toBe(409); // còn liên kết cuộc kháng chiến
    await api('PATCH', h(`sources/${created.body.id}`), { links: { campaign: [] } });
    expect((await api('DELETE', h(`sources/${created.body.id}`))).status).toBe(204);
  });

  // ------------------------------------------------------------------ AD.040
  test('HK.AD.040 vòng đời Nháp → Đã kiểm chứng → Công bố: không nhảy cấp, công bố phải sau cha, sửa nội dung thì về Nháp, ghi người kiểm chứng/công bố', async () => {
    const campaign = await bySlug('campaigns', 'khang-chien-lan-1-1258');
    const place = await bySlug('places', 'dong-bo-dau');
    const ev = await bySlug('events', 'dai-thang-dong-bo-dau-1258');
    expect((await api('POST', h(`events/${ev.id}/status`), { status: 'published' })).body.detail).toBe('Phải kiểm chứng nội dung trước khi công bố');
    expect((await api('POST', h(`events/${ev.id}/status`), { status: 'khác' })).status).toBe(422);
    const verified = await api('POST', h(`events/${ev.id}/status`), { status: 'verified', note: 'Đối chiếu SGK Lịch sử 7' });
    expect(verified.body).toMatchObject({ status: 'verified', status_label: 'Đã kiểm chứng', verified_by: 1 });
    expect(verified.body.verified_at).toBeTruthy();
    // Sự kiện cần cuộc kháng chiến và địa điểm đã công bố
    const early = await api('POST', h(`events/${ev.id}/status`), { status: 'published' });
    expect(early.status).toBe(409);
    expect(early.body.detail).toContain('cuộc kháng chiến "Kháng chiến chống Mông Cổ lần thứ nhất"');
    expect(early.body.detail).toContain('địa điểm "Đông Bộ Đầu"');
    for (const [entity, id] of [['campaigns', campaign.id], ['places', place.id]]) {
      await api('POST', h(`${entity}/${id}/status`), { status: 'verified' });
      expect((await api('POST', h(`${entity}/${id}/status`), { status: 'published' })).body).toMatchObject({ status: 'published', published_by: 1 });
    }
    const published = await api('POST', h(`events/${ev.id}/status`), { status: 'published' });
    expect(published.body).toMatchObject({ status: 'published', verified_by: 1, published_by: 1 });
    expect((await api('GET', h('events?status=published'))).body.items.map((e: any) => e.slug)).toEqual(['dai-thang-dong-bo-dau-1258']);
    // Không hạ cuộc kháng chiến về Nháp, không xóa khi còn sự kiện công bố thuộc về nó
    const down = await api('POST', h(`campaigns/${campaign.id}/status`), { status: 'draft' });
    expect(down.status).toBe(409);
    expect(down.body.detail).toContain('1 sự kiện');
    expect((await api('PATCH', h(`campaigns/${campaign.id}`), { title: 'Tên mới của cuộc kháng chiến' })).status).toBe(409);
    // Sửa nội dung bản ghi đã công bố → quay về Nháp, ẩn khỏi danh sách công bố
    const edited = await api('PATCH', h(`events/${ev.id}`), { description: 'Mô tả đã chỉnh để kiểm chứng lại.' });
    expect(edited.body).toMatchObject({ status: 'draft', status_reset: true, verified_by: null, published_by: null });
    expect((await api('GET', h('events?status=published'))).body.items).toHaveLength(0);
    // Hạ cấp: công bố → đã kiểm chứng giữ người kiểm chứng; về Nháp xóa cả hai
    await api('POST', h(`events/${ev.id}/status`), { status: 'verified' });
    await api('POST', h(`events/${ev.id}/status`), { status: 'published' });
    expect((await api('POST', h(`events/${ev.id}/status`), { status: 'verified' })).body).toMatchObject({ status: 'verified', verified_by: 1, published_by: null });
    expect((await api('POST', h(`events/${ev.id}/status`), { status: 'draft' })).body).toMatchObject({ status: 'draft', verified_by: null });
    // Bản ghi đang công bố không xóa được; không sửa được mà không về Nháp
    expect((await api('POST', h(`campaigns/${campaign.id}/status`), { status: 'draft' })).body.status).toBe('draft');
    expect((await api('POST', h(`places/${place.id}/status`), { status: 'draft' })).body.status).toBe('draft');
    expect((await api('GET', h(`events/${ev.id}/versions`))).body.map((v: any) => v.action).slice(0, 3)).toEqual(['status', 'status', 'status']);
  });

  // ------------------------------------------------------------------ AD.042
  test('HK.AD.042 xem phiên bản, so sánh hai phiên bản và khôi phục (khôi phục đưa về Nháp, liên kết trở lại như cũ)', async () => {
    const c2 = await bySlug('campaigns', 'khang-chien-lan-2-1285');
    const figure = await api('POST', h('figures'), { name: 'Nhân Vật Phiên Bản', figure_group: 'official', biography: 'Bản đầu tiên.', links: { campaign: [c2.id] } });
    const id = figure.body.id;
    await api('PATCH', h(`figures/${id}`), { biography: 'Bản thứ hai.', famous_quote: 'Câu nói mới', links: { campaign: [] } });
    await api('PATCH', h(`figures/${id}`), { name: 'Nhân Vật Phiên Bản (đổi tên)', birth_year: 1260 });
    const versions = (await api('GET', h(`figures/${id}/versions`))).body;
    expect(versions.map((v: any) => v.version_no)).toEqual([3, 2, 1]);
    const one = (await api('GET', h(`figures/${id}/versions/1`))).body;
    expect(one.snapshot).toMatchObject({ name: 'Nhân Vật Phiên Bản', biography: 'Bản đầu tiên.', status: 'draft' });
    expect(one.snapshot.search_text).toBeUndefined();
    expect(one.links).toEqual({ campaign: [c2.id] });
    const diff = (await api('GET', h(`figures/${id}/diff?from=1&to=3`))).body;
    expect(diff.changes.map((c: any) => [c.field, c.from, c.to])).toEqual(expect.arrayContaining([
      ['name', 'Nhân Vật Phiên Bản', 'Nhân Vật Phiên Bản (đổi tên)'], ['biography', 'Bản đầu tiên.', 'Bản thứ hai.'], ['famous_quote', null, 'Câu nói mới'], ['birth_year', null, 1260], ['links.campaign', [c2.id], []],
    ]));
    expect((await api('GET', h(`figures/${id}/diff?from=1&to=1`))).body.changes).toEqual([]);
    expect((await api('GET', h(`figures/${id}/versions/99`))).status).toBe(404);
    await api('POST', h(`figures/${id}/status`), { status: 'verified' });
    const restored = await api('POST', h(`figures/${id}/restore`), { version: 1 });
    expect(restored.body).toMatchObject({ name: 'Nhân Vật Phiên Bản', biography: 'Bản đầu tiên.', famous_quote: null, birth_year: null, status: 'draft', version_no: 5 });
    expect(restored.body.links).toEqual({ campaign: [c2.id] });
    expect((await api('GET', h(`figures/${id}/versions`))).body[0]).toMatchObject({ version_no: 5, action: 'restore', note: 'Khôi phục phiên bản 1' });
    expect((await api('POST', h(`figures/${id}/restore`), { version: 42 })).status).toBe(404);
  });

  // ------------------------------------------------------------------ AD.041
  test('HK.AD.041 xuất JSON/Excel rồi nhập lại: xem trước báo lỗi, lưu cập nhật và tạo mới ở trạng thái Nháp', async () => {
    const json = await download(s.base, h('export?format=json'), root);
    expect(json.status).toBe(200);
    expect(json.type).toContain('application/json');
    const doc = JSON.parse(json.buffer.toString('utf8'));
    expect(doc).toMatchObject({ format: 'hao-khi-dong-a-history', version: 1 });
    expect(doc.data.campaign).toHaveLength(3);
    const th = doc.data.figure.find((f: any) => f.slug === 'tran-hung-dao');
    expect(th).toMatchObject({ name: 'Trần Hưng Đạo', links_campaign: ['khang-chien-lan-2-1285', 'khang-chien-lan-3-1287-1288'] });
    const bd = doc.data.battle.find((b: any) => b.slug === 'bach-dang');
    expect(bd).toMatchObject({ campaign: 'khang-chien-lan-3-1287-1288', place: 'bach-dang', event: 'dai-thang-bach-dang-1288' });

    // Sửa file: đổi tên một nhân vật, thêm một thuật ngữ mới, một sự kiện trỏ tới địa điểm không có, một nhân vật thiếu tên
    doc.data.figure.find((f: any) => f.slug === 'yet-kieu').name = 'Yết Kiêu (đã chỉnh)';
    doc.data.term.push({ slug: 'thuat-ngu-nhap', term: 'Thuật ngữ nhập', definition: 'Nhập từ file JSON.', status: 'published' });
    doc.data.event.push({ slug: 'su-kien-loi', name: 'Sự kiện lỗi', year_from: 1258, place: 'khong-co-dia-diem' });
    doc.data.figure.push({ slug: 'nhan-vat-loi', name: '', figure_group: 'other' });
    const file = Buffer.from(JSON.stringify(doc), 'utf8');
    const preview = await upload(s.base, h('import'), 'kho.json', file, root);
    expect(preview.body).toMatchObject({ committed: false, updated: expect.any(Number), created: 1, errors: 2 });
    expect(preview.body.report.filter((r: any) => r.action === 'error').map((r: any) => [r.entity, r.slug])).toEqual(expect.arrayContaining([['figure', 'nhan-vat-loi'], ['event', 'su-kien-loi']]));
    expect((await api('GET', h('terms?q=nhap'))).body.items).toHaveLength(0); // xem trước không lưu
    const commit = await upload(s.base, h('import?commit=true'), 'kho.json', file, root);
    expect(commit.body).toMatchObject({ committed: true, created: 1, errors: 2 });
    const yet = await bySlug('figures', 'yet-kieu');
    expect(yet).toMatchObject({ name: 'Yết Kiêu (đã chỉnh)', status: 'draft' });
    expect((await bySlug('terms', 'thuat-ngu-nhap'))).toMatchObject({ status: 'draft' }); // nhập vào luôn là Nháp dù file ghi "published"
    expect((await api('GET', h(`figures/${yet.id}/versions`))).body[0]).toMatchObject({ action: 'import', note: 'Nhập từ file' });
    // Liên kết còn nguyên sau khi nhập lại
    expect((await api('GET', h(`figures/${(await bySlug('figures', 'tran-hung-dao')).id}`))).body.links.campaign).toHaveLength(2);

    // Excel: xuất rồi nhập lại; file mẫu rỗng có đủ sheet
    const xlsx = await download(s.base, h('export?format=xlsx'), root);
    expect(xlsx.status).toBe(200);
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.worksheets.map((w) => w.name)).toEqual(['Cuộc kháng chiến', 'Địa điểm', 'Nhân vật', 'Tư liệu gốc', 'Thuật ngữ', 'Sự kiện', 'Trận đánh', 'Hướng dẫn']);
    const figureSheet = workbook.getWorksheet('Nhân vật')!;
    const nameCol = (figureSheet.getRow(1).values as string[]).indexOf('name');
    figureSheet.eachRow((row, n) => { if (n > 1 && row.getCell(1).value === 'pham-ngu-lao') row.getCell(nameCol).value = 'Phạm Ngũ Lão (Excel)'; });
    const edited = Buffer.from(await workbook.xlsx.writeBuffer());
    const excelCommit = await upload(s.base, h('import?commit=true'), 'kho.xlsx', edited, root);
    expect(excelCommit.status).toBe(200);
    expect(excelCommit.body.errors).toBe(0);
    expect((await bySlug('figures', 'pham-ngu-lao')).name).toBe('Phạm Ngũ Lão (Excel)');
    expect((await bySlug('battles', 'bach-dang')).campaign_id).toBeTruthy();
    const template = await download(s.base, h('template'), root);
    const blank = new ExcelJS.Workbook();
    await blank.xlsx.load(template.buffer as unknown as Parameters<typeof blank.xlsx.load>[0]);
    expect(blank.worksheets).toHaveLength(7);
    expect((await upload(s.base, h('import'), 'x.json', Buffer.from('{"khong":"dung mau"}'), root)).status).toBe(400);
    expect((await upload(s.base, h('import'), 'x.txt', Buffer.from('hello'), root)).status).toBe(400);
  });

  test('chỉ quản trị tổng được vào kho lịch sử; quản trị trường, giáo viên, học sinh bị từ chối', async () => {
    const school = await api('POST', '/api/admin/schools', { school_code: '8500', name: 'Trường quyền kho', admin: { full_name: 'Quản Trị Kho', email: 'kho@example.edu.vn' } });
    const admin = await activate(s.base, school.body.admin.username, school.body.temporary_password, 'Matkhau-12345', 'school_admin');
    expect((await call(s.base, 'GET', h('campaigns'), undefined, admin.token)).status).toBe(403);
    expect((await call(s.base, 'POST', h('figures'), { name: 'Không được', figure_group: 'other' }, admin.token)).status).toBe(403);
    expect((await call(s.base, 'GET', h('export'), undefined, admin.token)).status).toBe(403);
    expect((await call(s.base, 'GET', h('campaigns'), undefined, '')).status).toBe(401);
    // Nhật ký thao tác ghi lại thao tác với kho
    const audit = await api('GET', '/api/admin/audit-history?limit=100');
    expect(audit.body.items.some((e: any) => e.target_type === 'history' && e.action.includes('/admin/history/'))).toBe(true);
    expect(await db.query("SELECT 1 FROM hist_versions WHERE changed_by IS NOT NULL")).not.toHaveLength(0);
  });
});
