#!/usr/bin/env python3
"""Thu logo chính thức của các trường THCS TP.HCM từ website do Sở GD&ĐT TP.HCM quản lý (hcm.edu.vn) và ghép với danh mục trường.

Cách chạy (cần Pillow): python scripts/fetch-school-logos.py [thư mục lưu đệm] [--offline]
  1. Cổng https://hcm.edu.vn liệt kê các website phường/xã (phuong*, xa*, dackhu*).
  2. Trang mỗi phường/xã liệt kê các trường thuộc phường/xã đó kèm địa chỉ website (thcs<tên>.hcm.edu.vn…).
  3. Trang chủ mỗi trường khai báo logo chính thức (thẻ og:image, hoặc ảnh logo ở đầu trang). Ảnh được tải về,
     kiểm tra (là ảnh, đủ lớn, tỉ lệ gần vuông), thu nhỏ và lưu WebP.
  4. Ghép với backend/src/admin/school-directory.json theo tên riêng của trường (chỉ khi tên khớp đúng một trường trong TP.HCM).
Đầu ra: frontend/public/school-logos/<mã trường>.webp, frontend/lib/school-logos.ts (danh sách mã có logo),
        scripts/school-logos.json (nguồn của từng logo: địa chỉ website, ảnh gốc, độ tin cậy) và báo cáo các trường chưa ghép được.
Lịch sự với máy chủ: 4 luồng, nghỉ giữa các yêu cầu, lưu đệm mọi trang để chạy lại không tải lại. Không gửi thông tin cá nhân; chỉ đọc trang công khai.
"""
import concurrent.futures, hashlib, html, importlib.util, io, json, re, sys, time, unicodedata, urllib.parse, urllib.request
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError:
    sys.exit('Cần cài Pillow: pip install pillow')

REPO = Path(__file__).resolve().parents[1]
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
OFFLINE = '--offline' in sys.argv
CACHE = Path(ARGS[0]) if ARGS else REPO.parent / 'wt9_tmp' / 'logos' / 'cache'
CACHE.mkdir(parents=True, exist_ok=True)
UA = 'DongA-school-logo-fetch/1.0 (do an tot nghiep; doc trang cong khai cua So GD&DT TP.HCM)'
PORTAL = 'https://hcm.edu.vn/'
# Ảnh đã xem bằng mắt và loại vì không phải logo của trường (mã trường → lý do); ghi rõ để người sau biết vì sao thiếu
EXCLUDED = {
    '77754509': 'ảnh biểu tượng thời khóa biểu, không phải logo trường',
    '79773502': 'ảnh chụp tập thể, không phải logo',
    '79787503': 'ảnh chụp tập thể, không phải logo',
    '79774503': 'đồ họa kỷ niệm 90 năm, không phải logo trường',
    '79765503': 'ảnh "THÔNG BÁO", không phải logo',
    '79786502': 'huy hiệu chung của ngành giáo dục (biến thể của logo mặc định), không phải logo riêng',
}
OUT_DIR = REPO / 'frontend' / 'public' / 'school-logos'
MAX_SIDE = 160
HOST = re.compile(r'^https?://([a-z0-9\-]+)\.hcm\.edu\.vn/?$', re.I)


def fetch(url, binary=False, retries=2):
    key = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ('.bin' if binary else '.html'))
    if key.exists():
        return key.read_bytes() if binary else key.read_text(encoding='utf-8', errors='replace')
    if OFFLINE:
        return None
    for attempt in range(retries + 1):
        try:
            time.sleep(0.25)
            safe = urllib.parse.quote(url, safe=":/?&=%#~@!$'()*+,;")  # tên tệp có dấu cách như "LOGO CL.png"
            with urllib.request.urlopen(urllib.request.Request(safe, headers={'User-Agent': UA}), timeout=30) as r:
                data = r.read()
            if binary:
                key.write_bytes(data)
                return data
            text = data.decode('utf-8', errors='replace')
            key.write_text(text, encoding='utf-8')
            return text
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return None


def load_builder():
    spec = importlib.util.spec_from_file_location('builder', REPO / 'scripts' / 'build-school-directory.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def strip_tags(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def units(portal_html):
    hosts = {m.lower() for m in re.findall(r'https://((?:phuong|xa|dackhu)[a-z0-9\-]*)\.hcm\.edu\.vn', portal_html, re.I)}
    return sorted(hosts)


def schools_of_unit(host, text):
    """Các trường THCS (và trường liên cấp có THCS) được liệt kê trên trang của một phường/xã"""
    out = {}
    for href, inner in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', text, flags=re.S | re.I):
        m = HOST.match(href.strip())
        if not m:
            continue
        sub, label = m.group(1).lower(), strip_tags(inner)
        if sub == host or re.match(r'^(phuong|xa|dackhu)', sub):
            continue
        if re.search(r'THCS|trung học cơ sở', label, re.I) or sub.startswith('thcs') or re.match(r'^(th|tieuhoc)\w*thcs', sub):
            out.setdefault(sub, label)
    return out


def meta(text, prop):
    m = re.search(r'<meta[^>]+(?:property|name)="%s"[^>]+content="([^"]*)"' % re.escape(prop), text, re.I) or re.search(r'<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="%s"' % re.escape(prop), text, re.I)
    return html.unescape(m.group(1)).strip() if m else None


LOGO_WORDS = re.compile(r'logo|huy-?hieu|bieu-?trung|biểu trưng|biểu tượng', re.I)
BAD_WORDS = re.compile(r'banner|baner|panner|slide|background|cover|bia\b|^z\d{8,}|^img|^dsc|anh-?bia|header', re.I)


def pick_logos(base, text):
    """Danh sách (địa chỉ ảnh, độ tin cậy) theo thứ tự ưu tiên.
    'logo-named': ảnh đại diện (og:image) có chữ logo trong tên tệp; 'img-logo': ảnh ở trang có chữ logo/biểu trưng;
    'og-only'/'icon': chỉ là ảnh đại diện hoặc biểu tượng trang (kém chắc hơn, bỏ nếu tên tệp giống biểu ngữ)"""
    absu = lambda u: urllib.parse.urljoin(base, html.unescape(u.strip()))
    out, seen = [], set()

    def add(url, conf):
        if url and url not in seen:
            seen.add(url)
            out.append((url, conf))

    og = meta(text, 'og:image')
    name_of = lambda u: u.rsplit('/', 1)[-1]
    if og and LOGO_WORDS.search(name_of(og)):
        add(absu(og), 'logo-named')
    for tag in re.findall(r'<img[^>]+>', text, re.I)[:80]:
        src = re.search(r'src="([^"]+)"', tag, re.I)
        if src and LOGO_WORDS.search(tag) and not re.search(r'tensohcmedu|/Images/co/|\.svg|/news/|haydung', src.group(1), re.I):
            add(absu(src.group(1)), 'img-logo')
    if og and not BAD_WORDS.search(name_of(og)):
        add(absu(og), 'og-only')
    for icon in re.findall(r'<link[^>]+rel="(?:shortcut icon|icon|apple-touch-icon)"[^>]+href="([^"]+)"', text, re.I):
        if not icon.lower().endswith('.ico') and not BAD_WORDS.search(name_of(icon)):
            add(absu(icon), 'icon')
    return out


def own_name(s):
    s = re.sub(r'\b(phường|xã|quận|huyện|đặc khu|thành phố)\b.*$', '', s, flags=re.I).strip(' -–,')
    first = re.split(r'\s+[-–]\s+|_|\(', s, maxsplit=1)[0].strip(' -–,')
    # "THCS Khai Nguyên - Phường Chánh Hưng", "Trường THCS An Nhơn - Trụ sở chính": giữ phần tên; không cắt "TH - THCS Bùi Văn Thủ"
    return first if re.search(r'THCS|trung học cơ sở', first, re.I) and len(first.split()) >= 3 else s


def fingerprint(img):
    """Dấu vân tay hình ảnh 8x8 (average hash) để nhận ra cùng một logo được nhiều trường dùng chung"""
    flat = Image.new('RGBA', img.size, (255, 255, 255, 255))
    flat.alpha_composite(img.convert('RGBA'))
    small = flat.convert('L').resize((8, 8), Image.LANCZOS)
    px = list(small.getdata())
    mean = sum(px) / len(px)
    return ''.join('1' if v > mean else '0' for v in px)


def crawl_school(args):
    sub, label, ward = args
    base = f'https://{sub}.hcm.edu.vn/'
    text = fetch(base)
    if not text:
        return {'domain': sub, 'ward': ward, 'label': label, 'error': 'không tải được trang', 'options': []}
    title = meta(text, 'og:site_name') or meta(text, 'og:title') or (re.search(r'<title>(.*?)</title>', text, re.S | re.I) or [None, label])[1]
    rec = {'domain': sub, 'ward': ward, 'label': label, 'name': strip_tags(title or label), 'options': []}
    cands = pick_logos(base, text)
    if not cands:
        rec['error'] = 'trang không khai báo logo'
        return rec
    reasons = []
    for url, conf in cands:
        data = fetch(url, binary=True)
        if not data:
            reasons.append('không tải được ảnh')
            continue
        try:
            img = Image.open(io.BytesIO(data))
            img.load()
        except Exception:
            reasons.append('không phải ảnh')
            continue
        ratio = img.width / img.height
        low, high = (0.55, 1.8) if conf in ('logo-named', 'img-logo') else (0.8, 1.25)
        if min(img.size) < 48:
            reasons.append('ảnh quá nhỏ')
        elif not low <= ratio <= high:
            reasons.append(f'tỉ lệ {ratio:.2f} (biểu ngữ?)')
        else:
            rec['options'].append({'logo_source': url, 'confidence': conf, 'width': img.width, 'height': img.height, 'bytes': len(data), 'print': fingerprint(img)})
    if not rec['options']:
        rec['error'] = '; '.join(dict.fromkeys(reasons)) or 'không có ảnh phù hợp'
    return rec


def choose_options(records, min_shared=3):
    """Loại các logo mặc định của nền tảng: một hình xuất hiện ở từ 3 trường trở lên không phải logo riêng của trường nào.
    Mỗi trường lấy ứng viên hợp lệ đầu tiên còn lại; trả về tập dấu vân tay bị loại"""
    count = {}
    for rec in records:
        for fp in {o['print'] for o in rec.get('options', [])}:
            count[fp] = count.get(fp, 0) + 1
    shared = {fp for fp, n in count.items() if n >= min_shared}
    for rec in records:
        opts = [o for o in rec.get('options', []) if o['print'] not in shared]
        if opts:
            rec.update(opts[0])
            rec.pop('error', None)
        elif rec.get('options'):
            rec['error'] = 'chỉ có logo mặc định của nền tảng (dùng chung nhiều trường)'
    return shared


def trim_margins(img):
    """Cắt lề trong suốt hoặc lề trắng quanh logo (nhiều trường để logo nhỏ giữa một khung trắng lớn), chừa viền 4%"""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    alpha_box = rgba.getchannel('A').point(lambda a: 255 if a > 10 else 0).getbbox()
    if alpha_box and alpha_box != (0, 0, w, h):
        box = alpha_box
    else:
        flat = Image.new('RGBA', rgba.size, (255, 255, 255, 255))
        flat.alpha_composite(rgba)
        diff = ImageChops.difference(flat.convert('RGB'), Image.new('RGB', rgba.size, (255, 255, 255))).convert('L').point(lambda v: 255 if v > 24 else 0)
        box = diff.getbbox()
    if not box or (box[2] - box[0]) * (box[3] - box[1]) < 0.08 * w * h:
        return rgba
    pad = max(2, int(0.04 * max(box[2] - box[0], box[3] - box[1])))
    return rgba.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad)))


def save_webp(data, dest):
    img = trim_margins(Image.open(io.BytesIO(data)))
    img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, 'WEBP', quality=90, method=6)
    return dest.stat().st_size


def main():
    builder = load_builder()
    portal = fetch(PORTAL)
    if not portal:
        sys.exit('Không mở được ' + PORTAL)
    unit_hosts = units(portal)
    print(len(unit_hosts), 'website phường/xã/đặc khu')

    def unit_job(host):
        text = fetch(f'https://{host}.hcm.edu.vn/')
        if not text:
            return host, None, {}
        ward = strip_tags((re.search(r'<title>(.*?)</title>', text, re.S | re.I) or [None, host])[1])
        return host, ward, schools_of_unit(host, text)

    found = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for host, ward, schools in pool.map(unit_job, unit_hosts):
            if ward is None:
                print('  không tải được', host)
                continue
            for sub, label in schools.items():
                found.setdefault(sub, (label, ward))
    print(len(found), 'website trường THCS tìm thấy trên trang phường/xã')

    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for i, rec in enumerate(pool.map(crawl_school, [(s, l, w) for s, (l, w) in sorted(found.items())])):
            records.append(rec)
            if (i + 1) % 50 == 0:
                print('  đã xử lý', i + 1)

    shared = choose_options(records)
    print(f'{len(shared)} hình logo mặc định dùng chung giữa nhiều trường đã bị loại')
    directory = json.loads((REPO / 'backend' / 'src' / 'admin' / 'school-directory.json').read_text(encoding='utf-8'))
    hcm = directory['provinces'].index('Thành phố Hồ Chí Minh')
    by_core = {}
    for code, name, p, district, _note in directory['schools']:
        if p == hcm:
            by_core.setdefault(builder.core(name), []).append((code, name, district))

    def district_tokens(district):
        """'Quận 12' → {'q12'}, 'Quận Gò Vấp' → {'govap'}, 'Huyện Củ Chi' → {'cuchi'}: cách tên miền của trường ghi quận"""
        words = [w for w in builder.fold(district).split() if w not in ('quan', 'huyen', 'thi', 'xa', 'thanh', 'pho', 'tp', 'tran')]
        joined = ''.join(words)
        return {'q' + joined} if joined.isdigit() else {joined}

    ward_key = lambda ward: builder.fold(re.sub(r'^(ngành giáo dục và đào tạo|ngàng giáo dục và đào tạo)\s+', '', ward, flags=re.I))
    good = records
    votes = {}
    # lượt 1: tên chỉ có một trường trong TP.HCM → chắc chắn; các phường biết được quận cũ qua đó
    for rec in good:
        cands = by_core.get(builder.core(own_name(rec['name'])), [])
        if len(cands) == 1:
            votes.setdefault(ward_key(rec['ward']), {}).setdefault(cands[0][2], 0)
            votes[ward_key(rec['ward'])][cands[0][2]] += 1

    all_tokens = {t for cands_ in by_core.values() for c in cands_ for t in district_tokens(c[2]) if t}

    def district_in_domain(rec):
        """Quận mà tên miền ghi rõ sau tên trường (thcsnguyenhueq12 → 'q12', thcslamsonbinhthanh → 'binhthanh'); chỉ xét phần sau tên riêng để không nhầm tên trường 'Tân Bình' với quận Tân Bình"""
        slug = builder.core(own_name(rec['name'])).replace(' ', '')
        at = rec['domain'].find(slug) if slug else -1
        rest = rec['domain'][at + len(slug):] if at >= 0 else rec['domain']
        rest = rest.strip('-')
        for t in sorted(all_tokens, key=len, reverse=True):
            if rest == t or rest.endswith(t) or rest.startswith(t):
                return t
        return None

    def resolve(rec):
        cands = by_core.get(builder.core(own_name(rec['name'])), [])
        if not cands:
            return None, 'khong_khop'
        marked = district_in_domain(rec)
        if marked:
            # tên miền ghi rõ quận: chỉ nhận trường ở đúng quận đó (kể cả khi chỉ còn một trường cùng tên sau sáp nhập)
            same = [c for c in cands if marked in district_tokens(c[2])]
            return (same[0], 'hau-to-ten-mien') if len(same) == 1 else (None, 'khac_quan' if not same else 'trung_ten')
        if len(cands) == 1:
            return cands[0], None
        # không ghi quận trong tên miền: dựa vào quận cũ của các trường khác cùng phường, chỉ khi tất cả cùng một quận
        v = votes.get(ward_key(rec['ward']), {})
        if len(v) == 1:
            in_ward = [c for c in cands if c[2] == next(iter(v))]
            if len(in_ward) == 1:
                return in_ward[0], 'cung-phuong'
        return None, 'trung_ten'

    if OUT_DIR.exists():  # chỉ giữ các logo của lần chạy này
        for old_file in OUT_DIR.glob('*.webp'):
            old_file.unlink()
    manifest, report = [], {'khong_khop': [], 'trung_ten': [], 'khac_quan': [], 'loi_anh': [], 'trung_ma': [], 'ghep_nho_phan_biet': []}
    used = {}
    def preference(rec):
        slug = builder.core(own_name(rec['name'])).replace(' ', '')
        mixed = rec['domain'].startswith(('th-', 'tieuhoc', 'ptdt')) or 'tiểu học' in rec['name'].lower()
        return (rec.get('confidence') not in ('logo-named', 'img-logo'), mixed, slug not in rec['domain'], rec['domain'])

    for rec in sorted(records, key=preference):
        match, how = resolve(rec)
        if match is None:
            if how == 'khong_khop':
                report['khong_khop'].append(f"{rec['domain']} · {rec['name']} · {rec['ward']}" + (f" (ảnh: {rec['error']})" if rec.get('error') else ''))
            elif how == 'khac_quan':
                report['khac_quan'].append(f"{rec['domain']} · {rec['name']} · {rec['ward']}: tên miền ghi quận khác với mọi trường cùng tên trong danh mục")
            else:
                report['trung_ten'].append(f"{rec['domain']} · {rec['name']} · {rec['ward']} → " + '; '.join(f'{c[0]} {c[2]}' for c in by_core.get(builder.core(own_name(rec['name'])), [])))
            continue
        if rec.get('error'):
            report['loi_anh'].append(f"{rec['domain']} ({rec['name']} → {match[0]}): {rec['error']}")
            continue
        code = match[0]
        if code in EXCLUDED:
            report['loi_anh'].append(f"{rec['domain']} → {code}: loại thủ công ({EXCLUDED[code]})")
            continue
        if code in used:
            report['trung_ma'].append(f"{rec['domain']} bị bỏ vì {used[code]} đã khớp {code}")
            continue
        if how in ('hau-to-ten-mien', 'cung-phuong'):
            report['ghep_nho_phan_biet'].append(f"{rec['domain']} → {code} {match[2]} ({how})")
        used[code] = rec['domain']
        data = fetch(rec['logo_source'], binary=True)
        size = save_webp(data, OUT_DIR / f'{code}.webp')
        manifest.append({'code': code, 'name': match[1], 'district': match[2], 'site': f"https://{rec['domain']}.hcm.edu.vn/", 'ward': rec['ward'], 'logo_source': rec['logo_source'],
                         'confidence': rec['confidence'], 'source_px': [rec['width'], rec['height']], 'webp_bytes': size})

    manifest.sort(key=lambda m: m['code'])
    (REPO / 'scripts' / 'school-logos.json').write_text(json.dumps({'fetched': time.strftime('%Y-%m-%d'), 'portal': PORTAL, 'schools': manifest}, ensure_ascii=False, indent=1), encoding='utf-8')
    codes = [m['code'] for m in manifest]
    (REPO / 'frontend' / 'lib' / 'school-logos.ts').write_text(
        '/** Danh sách mã trường có logo chính thức trong public/school-logos (do scripts/fetch-school-logos.py tạo, không sửa tay). */\n'
        'export const SCHOOL_LOGO_CODES: ReadonlySet<string> = new Set([\n' + ''.join(f"  '{c}',\n" for c in codes) + ']);\n\n'
        '/** Địa chỉ logo chính thức của trường (nếu có); các trường chưa có thì để giao diện vẽ khung trống trung tính */\n'
        "export const schoolLogoUrl = (code: string): string | null => (SCHOOL_LOGO_CODES.has(code) ? `/school-logos/${code}.webp` : null);\n", encoding='utf-8')
    conf = {}
    for m in manifest:
        conf[m['confidence']] = conf.get(m['confidence'], 0) + 1
    print(f'\nĐã ghép {len(manifest)} trường, độ tin cậy: {conf}; tổng {sum(m["webp_bytes"] for m in manifest) // 1024} KB')
    for k, v in report.items():
        print(f'\n== {k}: {len(v)}')
        for line in v[:80]:
            print('  ', line)


if __name__ == '__main__':
    main()
