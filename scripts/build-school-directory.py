#!/usr/bin/env python3
"""Dựng backend/src/admin/school-directory.json (danh mục trường THCS để quản trị tổng chọn khi thêm trường).

Nguồn (tải về một thư mục, rồi chạy: python scripts/build-school-directory.py <thư mục nguồn> [tệp xuất]):
  thcs.json      Danh sách trường THCS cả nước kèm mã Bộ GD&ĐT, 06/10/2020
                 https://gist.github.com/ngoan98tv/b9111580b75562b45185f90d00e5b1ff
  dantri.html    Danh sách trường TP.HCM sáp nhập, đổi tên (Dân trí, cập nhật 02/09/2026)
                 https://dantri.com.vn/giao-duc/danh-sach-chi-tiet-cac-truong-hoc-sap-nhap-doi-ten-o-tphcm-20260824111612695.htm
  vnexpress.html Danh sách trường sau sắp xếp ở 14 xã, phường TP.HCM (VnExpress)
                 https://vnexpress.net/tra-cuu-danh-sach-truong-cong-sau-sap-xep-sap-nhap-o-14-xa-phuong-cua-tp-hcm-chi-tiet-nhat-5112115-p2.html

Quy tắc:
  * Giữ nguyên mã Bộ GD&ĐT (chỉ mã toàn chữ số dài tối đa 8 ký tự; mã có chữ như 02000E04 của trường tư/quốc tế hoặc mã dài bất thường bị bỏ qua và đếm trong báo cáo).
  * Tỉnh/thành đổi sang đơn vị cấp tỉnh có hiệu lực từ 01/07/2025 (63 → 34). Khu vực giữ quận/huyện của dữ liệu gốc vì mã trường vẫn gắn với đơn vị đó.
  * Sáp nhập 2026 chỉ áp khi nhận ra chắc chắn trường nào gộp vào trường nào (cùng quận cũ, tên khớp); phần còn lại giữ nguyên và ghi vào báo cáo.
"""
import html, json, re, sys, unicodedata
from collections import defaultdict
from pathlib import Path

PROVINCE_2026 = {
    'Thành phố Hà Nội': 'Thành phố Hà Nội', 'Tỉnh Hà Giang': 'Tỉnh Tuyên Quang', 'Tỉnh Cao Bằng': 'Tỉnh Cao Bằng', 'Tỉnh Bắc Kạn': 'Tỉnh Thái Nguyên',
    'Tỉnh Tuyên Quang': 'Tỉnh Tuyên Quang', 'Tỉnh Lào Cai': 'Tỉnh Lào Cai', 'Tỉnh Điện Biên': 'Tỉnh Điện Biên', 'Tỉnh Lai Châu': 'Tỉnh Lai Châu',
    'Tỉnh Sơn La': 'Tỉnh Sơn La', 'Tỉnh Yên Bái': 'Tỉnh Lào Cai', 'Tỉnh Hòa Bình': 'Tỉnh Phú Thọ', 'Tỉnh Thái Nguyên': 'Tỉnh Thái Nguyên',
    'Tỉnh Lạng Sơn': 'Tỉnh Lạng Sơn', 'Tỉnh Quảng Ninh': 'Tỉnh Quảng Ninh', 'Tỉnh Bắc Giang': 'Tỉnh Bắc Ninh', 'Tỉnh Phú Thọ': 'Tỉnh Phú Thọ',
    'Tỉnh Vĩnh Phúc': 'Tỉnh Phú Thọ', 'Tỉnh Bắc Ninh': 'Tỉnh Bắc Ninh', 'Tỉnh Hải Dương': 'Thành phố Hải Phòng', 'Thành phố Hải Phòng': 'Thành phố Hải Phòng',
    'Tỉnh Hưng Yên': 'Tỉnh Hưng Yên', 'Tỉnh Thái Bình': 'Tỉnh Hưng Yên', 'Tỉnh Hà Nam': 'Tỉnh Ninh Bình', 'Tỉnh Nam Định': 'Tỉnh Ninh Bình',
    'Tỉnh Ninh Bình': 'Tỉnh Ninh Bình', 'Tỉnh Thanh Hóa': 'Tỉnh Thanh Hóa', 'Tỉnh Nghệ An': 'Tỉnh Nghệ An', 'Tỉnh Hà Tĩnh': 'Tỉnh Hà Tĩnh',
    'Tỉnh Quảng Bình': 'Tỉnh Quảng Trị', 'Tỉnh Quảng Trị': 'Tỉnh Quảng Trị', 'Tỉnh Thừa Thiên Huế': 'Thành phố Huế', 'Thành phố Đà Nẵng': 'Thành phố Đà Nẵng',
    'Tỉnh Quảng Nam': 'Thành phố Đà Nẵng', 'Tỉnh Quảng Ngãi': 'Tỉnh Quảng Ngãi', 'Tỉnh Bình Định': 'Tỉnh Gia Lai', 'Tỉnh Phú Yên': 'Tỉnh Đắk Lắk',
    'Tỉnh Khánh Hòa': 'Tỉnh Khánh Hòa', 'Tỉnh Ninh Thuận': 'Tỉnh Khánh Hòa', 'Tỉnh Bình Thuận': 'Tỉnh Lâm Đồng', 'Tỉnh Kon Tum': 'Tỉnh Quảng Ngãi',
    'Tỉnh Gia Lai': 'Tỉnh Gia Lai', 'Tỉnh Đắk Lắk': 'Tỉnh Đắk Lắk', 'Tỉnh Đắk Nông': 'Tỉnh Lâm Đồng', 'Tỉnh Lâm Đồng': 'Tỉnh Lâm Đồng',
    'Tỉnh Bình Phước': 'Tỉnh Đồng Nai', 'Tỉnh Tây Ninh': 'Tỉnh Tây Ninh', 'Tỉnh Bình Dương': 'Thành phố Hồ Chí Minh', 'Tỉnh Đồng Nai': 'Tỉnh Đồng Nai',
    'Tỉnh Bà Rịa - Vũng Tàu': 'Thành phố Hồ Chí Minh', 'Thành phố Hồ Chí Minh': 'Thành phố Hồ Chí Minh', 'Tỉnh Long An': 'Tỉnh Tây Ninh',
    'Tỉnh Tiền Giang': 'Tỉnh Đồng Tháp', 'Tỉnh Bến Tre': 'Tỉnh Vĩnh Long', 'Tỉnh Trà Vinh': 'Tỉnh Vĩnh Long', 'Tỉnh Vĩnh Long': 'Tỉnh Vĩnh Long',
    'Tỉnh Đồng Tháp': 'Tỉnh Đồng Tháp', 'Tỉnh An Giang': 'Tỉnh An Giang', 'Tỉnh Kiên Giang': 'Tỉnh An Giang', 'Thành phố Cần Thơ': 'Thành phố Cần Thơ',
    'Tỉnh Hậu Giang': 'Thành phố Cần Thơ', 'Tỉnh Sóc Trăng': 'Thành phố Cần Thơ', 'Tỉnh Bạc Liêu': 'Tỉnh Cà Mau', 'Tỉnh Cà Mau': 'Tỉnh Cà Mau',
}
HCM_2026 = 'Thành phố Hồ Chí Minh'
KEEP_UPPER = {'THCS', 'TH', 'THPT', 'PTDTBT', 'PTDTNT', 'PTDT', 'PTCS', 'THCSCL', 'TTNC', 'TDTT', 'PT', 'TP', 'II', 'III', 'IV', 'A', 'B', 'C'}
TYPE_WORDS = [(('trung',), ('học', 'hoc'), ('cơ', 'co'), ('sở', 'so')), (('trung',), ('học', 'hoc'), ('phổ', 'pho'), ('thông', 'thong')), (('tiểu', 'tieu'), ('học', 'hoc')), (('trường', 'truong'),),
              (('thcs',),), (('th',),), (('thpt',),), (('ptdtbt',),), (('ptdtnt',),), (('ptdt',),), (('ptcs',),), (('thcscl',),), (('và', 'va'),)]  # so khớp trên chữ thường còn dấu: bỏ dấu sẽ làm họ "Trương" trùng "Trường"


def fold(text):
    text = unicodedata.normalize('NFD', text.replace('đ', 'd').replace('Đ', 'D'))
    return re.sub(r'[^a-z0-9 ]+', ' ', ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn').lower()).strip()


def core(name):
    """Tên riêng của trường: bỏ các từ chỉ cấp học ở đầu tên (Trường, THCS, Tiểu học và THCS, …) để so khớp giữa các nguồn."""
    toks = [t for t in re.split(r'[^\w]+', unicodedata.normalize('NFC', name).lower()) if t]
    i, moved = 0, True
    while moved and i < len(toks) - 1:
        moved = False
        for words in TYPE_WORDS:
            if i + len(words) < len(toks) and all(toks[i + k] in alts for k, alts in enumerate(words)): i += len(words); moved = True; break
    return fold(' '.join(toks[i:]))


def clean_name(raw):
    name = unicodedata.normalize('NFC', html.unescape(html.unescape(raw))).replace(' ', ' ')
    name = re.sub(r'\s+', ' ', name).strip(' ,;')
    if name.isupper():
        name = ' '.join(w if w in KEEP_UPPER or not w.isalpha() else w[:1] + w[1:].lower() for w in name.split(' '))
        name = re.sub(r'^Trường\b', 'Trường', name)
    return re.sub(r'\bTH&THCS\b', 'TH&THCS', name)


def load_gist(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    rows, skipped = [], []
    for province, districts in data.items():
        for district, items in districts.items():
            for item in items:
                m = re.match(r'^(.*)\(([^()]*)\)\s*$', item)
                if not m: skipped.append(item); continue
                code = m.group(2).strip()
                if not code.isdigit() or len(code) > 8: skipped.append(item); continue
                rows.append({'code': code, 'name': clean_name(m.group(1)), 'province': PROVINCE_2026[province], 'old_province': province, 'district': district.strip(), 'note': None})
    return rows, skipped


# ---------------------------------------------------------------------- sáp nhập 2026
def text_of(path):
    raw = Path(path).read_text(encoding='utf-8', errors='replace')
    raw = re.sub(r'<script.*?</script>|<style.*?</style>', '', raw, flags=re.S)
    return raw


def dantri_events(path):
    t = text_of(path)
    t = re.sub(r'<tr[^>]*>', '\n@@ROW@@', t)
    t = re.sub(r'</t[dh]>', ' || ', t)
    t = re.sub(r'</(p|div|li|h\d|table)>', '\n', t)
    t = html.unescape(re.sub(r'<[^>]+>', '', t))
    events, ward = [], None
    for line in (l.strip() for l in t.split('\n')):
        m = re.match(r'^(?:@@ROW@@)?\s*(\d+)\.\s*((?:Phường|Xã|Đặc khu)[^|]*?)\s*(\|\||$)', line)
        if m: ward = m.group(2).strip(); continue
        if not line.startswith('@@ROW@@') or not ward: continue
        cells = [c.strip() for c in line[7:].split('||')]
        # cột "trước sáp nhập" để trống = trường giữ nguyên hoặc chỉ đổi hiệu trưởng, không phải một sự kiện sáp nhập
        if len(cells) >= 2 and cells[0] and cells[1] and not re.match(r'^(Ông|Bà|Đ/c)', cells[1]): events.append({'ward': ward, 'old': cells[0], 'new': cells[1].rstrip('.'), 'source': 'Dân trí'})
    return events


def vnexpress_events(path):
    t = text_of(path)
    t = re.sub(r'</(p|div|li|tr|h\d|table)>', '\n', t)
    t = html.unescape(re.sub(r'<[^>]+>', '', re.sub(r'</t[dh]>', ' | ', t)))
    toks = [l.strip(' |') for l in t.split('\n')]
    toks = [x for x in toks if x]
    events, ward, i = [], None, 0
    while i < len(toks):
        x = toks[i]
        if re.match(r'^(Phường|Xã|Đặc khu) \S', x) and len(x) < 40: ward = x; i += 1; continue
        if ward and i + 1 < len(toks) and not x.isdigit() and x != '-' and re.match(r'^(Mầm non|Tiểu học|THCS|Trường|TH|Mẫu giáo)', x):
            old = toks[i + 1]
            if old != '-' and old != x: events.append({'ward': ward, 'old': old, 'new': x, 'source': 'VnExpress'})
            i += 2; continue
        i += 1
    return events


def split_olds(old):
    """'THCS A, B và Tiểu học C' → các tên đầy đủ kèm cấp học"""
    out = []
    for part in re.split(r'\s+(?:và|\+)\s+(?=(?:Trường )?(?:Mầm non|Tiểu học|THCS|TH))', old):
        prefix = None
        for piece in part.split(','):
            piece = piece.strip()
            if not piece: continue
            m = re.match(r'^((?:Trường )?(?:Mầm non|Mẫu giáo|Tiểu học|THCS|TH))\b\s*(.*)$', piece)
            if m: prefix = m.group(1); out.append(piece)
            elif prefix: out.append(f'{prefix} {piece}')
            else: out.append(piece)
    return out


def apply_merges(rows, events, report):
    group = [r for r in rows if r['province'] == HCM_2026]
    by_core = defaultdict(list)
    for r in group: by_core[core(r['name'])].append(r)
    merged = []
    seen = set()
    for ev in events:
        olds = [o for o in split_olds(ev['old']) if re.match(r'^(Trường )?THCS\b', o) or re.search(r'\bTHCS\b', o)]
        olds = [o for o in olds if not re.match(r'^(Trường )?(Mầm non|Tiểu học)\b', o)]
        if not olds: continue
        key = (tuple(sorted(core(o) for o in olds)), core(ev['new']))
        if key in seen: continue
        seen.add(key)
        cands = [[r for r in by_core.get(core(o), [])] for o in olds]
        found = [c for c in cands if c]
        label = f"{ev['ward']}: {ev['old']} → {ev['new']} ({ev['source']})"
        if not found: report['unmatched'].append(label + ' – không thấy tên trong danh sách 2020'); continue
        districts = None
        for c in found:
            ds = {(r['province'], r['district']) for r in c}
            districts = ds if districts is None else districts & ds
        if len(found) == 1 and len({(r['old_province'], r['district']) for r in found[0]}) > 1: districts = set()
        if len(found) == 1 and len(found[0]) == 1: districts = {(found[0][0]['province'], found[0][0]['district'])}
        if not districts or len(districts) != 1: report['ambiguous'].append(label + ' – tên trùng ở nhiều quận cũ'); continue
        province, district = next(iter(districts))
        members = []
        for c in found:
            hit = [r for r in c if r['province'] == province and r['district'] == district]
            if len(hit) == 1: members.append(hit[0])
        if len(members) != len(found): report['ambiguous'].append(label + ' – có hai trường cùng tên trong một quận cũ'); continue
        target = core(ev['new'])
        survivor = next((m for m in members if core(m['name']) == target), None)
        if survivor and len(members) > 1:
            for m in members:
                if m is survivor: continue
                merged.append({'code': m['code'], 'name': m['name'], 'into': survivor['code'], 'into_name': ev['new'], 'ward': ev['ward']})
            if not re.match(r'^(Trường )?THCS\b', ev['new']): survivor['name'] = ev['new']
            survivor['note'] = f"Sáp nhập 2026: gồm cả {', '.join(m['name'] for m in members if m is not survivor)} ({ev['ward']})"
            report['merged'].append(label)
        elif survivor and len(members) == 1:
            if survivor['name'] != ev['new'] and re.match(r'^(Trường )?(Tiểu học|TH)\b', ev['new']): survivor['name'] = ev['new']
            report['combined'].append(label)
        elif len(members) == 1 and len(olds) == 1:
            members[0]['note'] = f"Đổi tên 2026: {members[0]['name']} → {ev['new']}"
            members[0]['name'] = ev['new']
            report['renamed'].append(label)
        else:
            for m in members: m['note'] = f"Từ 2026 sáp nhập thành {ev['new']} ({ev['ward']}); chọn trường rồi sửa tên theo trường mới"
            report['flagged'].append(label)
    gone = {m['code'] for m in merged}
    return [r for r in rows if r['code'] not in gone], merged


def confirmed_retirements():
    """Chỉ mã cũ đã có nguồn sáp nhập xác nhận; không suy đoán theo tên trùng."""
    path = Path(__file__).resolve().parents[1] / 'backend/src/admin/school-confirmed-2026.json'
    confirmed = json.loads(path.read_text(encoding='utf-8'))
    return {code: row['code'] for row in confirmed['schools'] if row.get('verified') for code in row.get('previous_codes', []) if code != row['code']}


def main():
    src = Path(sys.argv[1]); out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[1] / 'backend/src/admin/school-directory.json'
    rows, skipped = load_gist(src / 'thcs.json')
    report = {k: [] for k in ('merged', 'renamed', 'combined', 'flagged', 'ambiguous', 'unmatched')}
    events = dantri_events(src / 'dantri.html') + vnexpress_events(src / 'vnexpress.html')
    rows, merged = apply_merges(rows, events, report)
    retired = confirmed_retirements()
    rows = [row for row in rows if row['code'] not in retired]
    provinces = sorted({r['province'] for r in rows})
    pidx = {p: i for i, p in enumerate(provinces)}
    rows.sort(key=lambda r: (r['province'], r['district'], r['name'], r['code']))
    data = {
        'version': '2026-11-06',
        'sources': ['Danh sách trường THCS tại Việt Nam, 06/10/2020 (gist ngoan98tv)', 'Dân trí và VnExpress: trường TP.HCM sáp nhập, đổi tên từ 08/2026'],
        'provinces': provinces,
        'schools': [[r['code'], r['name'], pidx[r['province']], r['district'], r['note']] for r in rows],
        'merged': [[m['code'], m['name'], m['into'], m['into_name']] for m in merged],
    }
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(rows)} trường, {len(provinces)} tỉnh/thành, bỏ {len(skipped)} mã có chữ, {len(merged)} trường đã gộp, {len(events)} dòng sáp nhập đọc được')
    for k, v in report.items():
        print(f'\n== {k}: {len(v)}')
        for line in v: print('  ', line)


if __name__ == '__main__':
    main()
