#!/usr/bin/env python3
"""Đối chiếu trường với danh bạ Sở và trang chính thức; lưu ảnh logo, địa chỉ, nguồn và các trường chưa xác minh.

Không lấy ảnh từ kết quả tìm kiếm ảnh; không tạo logo. Tên trùng phải có mã/địa bàn phân biệt.
HTML được lưu đệm ngoài Git. Chạy lại tái sử dụng trang đã tải; --all-provinces kiểm tra cổng của 63 tỉnh cũ/34 tỉnh hiện tại.
"""
import argparse
import concurrent.futures
import hashlib
import html
import importlib.util
import io
import json
import re
import time
import threading
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('school_builder', ROOT / 'scripts/build-school-directory.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
UA = 'DongA-school-directory/2.0 (public school directory and logo verification)'
DAY = datetime.now(timezone(timedelta(hours=7))).date().isoformat()
HOST_LIMITS = defaultdict(lambda: threading.BoundedSemaphore(2))
KNOWN = [('https://hcm.edu.vn/', 'Thành phố Hồ Chí Minh'), ('https://haiphong.edu.vn/', 'Thành phố Hải Phòng'), ('https://hanoi.edu.vn/DsDonViGiaoDuc?caphoc=THCS', 'Thành phố Hà Nội')]

def safe_url(url):
    parsed = urllib.parse.urlsplit(html.unescape(url).strip())
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        return None
    if parsed.port not in (None, 80, 443) or parsed.hostname.lower() in ('localhost',) or re.match(r'^[0-9.:]+$', parsed.hostname):
        return None
    if any(re.search(r'^(token|secret|password|access_token|api_key)$', key, re.I) for key, _ in urllib.parse.parse_qsl(parsed.query)):
        return None
    return urllib.parse.urlunsplit(parsed._replace(fragment=''))

def fetch(url, cache, binary=False):
    url = safe_url(url)
    if not url:
        return None
    key = hashlib.sha256(url.encode()).hexdigest()
    target = cache / (key + ('.bin' if binary else '.html'))
    if target.exists():
        return target.read_bytes() if binary else target.read_text(encoding='utf-8', errors='replace')
    try:
        time.sleep(.12)
        quoted = urllib.parse.quote(url, safe=":/?&=%#~@!$'()*+,;-")
        with HOST_LIMITS[urllib.parse.urlsplit(url).hostname]:
            with urllib.request.urlopen(urllib.request.Request(quoted, headers={'User-Agent': UA}), timeout=12) as response:
                final = safe_url(response.geturl())
                if not final:
                    return None
                content = response.read(4_000_001)
                if len(content) > 4_000_000:
                    return None
        if binary:
            target.write_bytes(content)
            return content
        text = content.decode('utf-8-sig', errors='replace')
        target.write_text(text, encoding='utf-8')
        return text
    except Exception:
        return None

def school_name(text):
    return bool(re.search(r'\bTHCS\b|trung học cơ sở', text, re.I))

def links_from_portal(url, city, text):
    soup = BeautifulSoup(text, 'html.parser')
    records, pages = [], []
    root_host = urllib.parse.urlsplit(url).hostname
    for anchor in soup.find_all('a', href=True):
        href = safe_url(urllib.parse.urljoin(url, anchor['href']))
        if not href:
            continue
        host = urllib.parse.urlsplit(href).hostname or ''
        label = anchor.get_text(' ', strip=True)
        if host.endswith(('.edu.vn', '.gov.vn')) and host != root_host and (school_name(label) or re.search(r'thcs|c2', host)):
            if not school_name(label):
                continue
            records.append({'site': f'{urllib.parse.urlsplit(href).scheme}://{host}/', 'name': label, 'city': city, 'source': url})
        elif host == root_host and re.search(r'danh bạ|danh sách.*trường|đơn vị.*giáo dục|khối thcs|cơ sở giáo dục', label, re.I):
            pages.append(href)
        elif root_host == 'hcm.edu.vn' and re.match(r'^(phuong|xa|dackhu)[a-z0-9-]*\.hcm\.edu\.vn$', host):
            pages.append(href)
        if root_host == 'hanoi.edu.vn' and 'DsDonViGiaoDuc' in href and 'trang=' in href:
            parts = urllib.parse.urlsplit(href)
            query = dict(urllib.parse.parse_qsl(parts.query)); query['caphoc'] = 'THCS'
            pages.append(urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query))))
    # Danh bạ Hà Nội có địa chỉ website ở ô văn bản, không phải href.
    for row in soup.find_all('tr'):
        cells = [cell.get_text(' ', strip=True) for cell in row.find_all('td')]
        names = [cell for cell in cells if school_name(cell) and not re.search(r'https?://', cell)]
        if not names:
            continue
        urls = re.findall(r'https?://[^\s<>"\']+', ' '.join(cells))
        for raw in urls:
            parsed = urllib.parse.urlsplit(html.unescape(raw))
            if parsed.hostname and parsed.hostname.endswith('.edu.vn'):
                records.append({'site': f'{parsed.scheme}://{parsed.hostname}/', 'name': names[0], 'city': city, 'source': url})
    return records, list(dict.fromkeys(pages))

def address_from(soup):
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            value = json.loads(script.string or '')
            values = value if isinstance(value, list) else [value]
            for item in values:
                address = item.get('address') if isinstance(item, dict) and (school_name(str(item.get('name', ''))) or item.get('@type') in ('School', 'EducationalOrganization')) else None
                if isinstance(address, dict):
                    text = ', '.join(str(address.get(key, '')).strip() for key in ('streetAddress', 'addressLocality', 'addressRegion') if address.get(key))
                    if 8 <= len(text) <= 255:
                        return text
        except (ValueError, TypeError):
            pass
    for node in soup(['script', 'style', 'noscript']):
        node.decompose()
    lines = soup.get_text('\n', strip=True).splitlines()
    for index, line in enumerate(lines):
        found = re.search(r'^(?:Địa chỉ|ĐỊA CHỈ)\s*[:：-]?\s*(.*)$', line)
        if found:
            value = found.group(1).strip() or (lines[index + 1] if index + 1 < len(lines) else '')
            value = re.split(r'(?i)\b(?:Điện thoại|Email|Hotline|Tel|Fax)\b', value)[0].strip(' -|,')
            if 8 <= len(value) <= 255 and not re.search(r'https?://|@|www\.|\.edu\.vn|\.gov\.vn|\.com\b|\.vn\b', value, re.I):
                return value
    return None

def logo_from(soup, site, cache):
    candidates = []
    for image in soup.find_all('img', src=True):
        source = urllib.parse.urljoin(site, image.get('data-src') or image['src'])
        attrs = ' '.join([str(image.get('id', '')), ' '.join(image.get('class', [])), str(image.get('alt', '')), source])
        if re.search(r'logo|school[-_]?icon', attrs, re.I) and not re.search(r'logo[-_ ]?(?:bo|so)[-_ ]?giao|bgddt|quoc[-_ ]?huy', attrs, re.I):
            candidates.append((source, 'logo-named' if re.search(r'logo', source, re.I) else 'img-logo'))
    for link in soup.find_all('link', href=True):
        if any('icon' in part for part in link.get('rel', [])):
            candidates.append((urllib.parse.urljoin(site, link['href']), 'icon'))
    for source, confidence in dict(candidates).items():
        if not safe_url(source):
            continue
        content = fetch(source, cache, binary=True)
        if not content:
            continue
        try:
            im = Image.open(io.BytesIO(content))
            w, h = im.size
            if min(w, h) < 70 or w * h > 16_000_000 or not .55 <= w / h <= 1.8:
                continue
            im = im.convert('RGBA'); im.thumbnail((160, 160))
            buffer = io.BytesIO(); im.save(buffer, 'WEBP', quality=87)
            # Ảnh ngành dùng chung được nhận diện theo fingerprint, không gán cho nhiều trường.
            signature = hashlib.sha256(im.resize((32, 32)).tobytes()).hexdigest()
            return {'bytes': buffer.getvalue(), 'logo_source': source, 'confidence': confidence, 'source_px': [w, h], 'fingerprint': signature}
        except Exception:
            pass
    return None

def run(args):
    cache = Path(args.cache).resolve(); cache.mkdir(parents=True, exist_ok=True)
    base = json.loads((ROOT / 'backend/src/admin/school-directory.json').read_text(encoding='utf-8'))
    extra = json.loads((ROOT / 'backend/src/admin/school-directory-extra.json').read_text(encoding='utf-8'))
    entries = [{'code': row[0], 'name': row[1], 'city': base['provinces'][row[2]], 'region': row[3]} for row in base['schools'] + extra['schools']]
    confirmed = json.loads((ROOT / 'backend/src/admin/school-confirmed-2026.json').read_text(encoding='utf-8'))['schools']
    removed = {code for row in confirmed for code in row.get('previous_codes', [])}
    confirmed_codes = {entry['code'] for entry in confirmed}
    entries = [entry for entry in entries if entry['code'] not in removed | confirmed_codes] + confirmed
    by_name = defaultdict(list)
    by_code = {entry['code']: entry for entry in entries}
    for entry in entries:
        by_name[(entry['city'], builder.core(entry['name']))].append(entry)
        for alias in entry.get('aliases', []):
            by_name[(entry['city'], builder.core(alias))].append(entry)
    for old_code, old_name, new_code, _ in base['merged']:
        if new_code in by_code:
            by_name[(by_code[new_code]['city'], builder.core(old_name))].append(by_code[new_code])
    manifest_path = ROOT / 'scripts/school-logos.json'
    reviewed = json.loads((ROOT / 'scripts/school-logo-review.json').read_text(encoding='utf-8'))
    rejected_sources = {row['logo_source'] for row in reviewed['rejected']}
    old_manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    records = [{'site': row['site'], 'name': row['name'], 'city': row.get('city') or by_code.get(row['code'], {}).get('city', 'Thành phố Hồ Chí Minh'), 'source': row.get('source') or old_manifest['portal']} for row in old_manifest['schools']]
    records.extend({'site': row['website'], 'name': row['name'], 'city': row['city'], 'source': row['source']} for row in confirmed)
    seeds = list(KNOWN)
    if args.all_provinces:
        for old, city in builder.PROVINCE_2026.items():
            slug = builder.fold(re.sub(r'^(Tỉnh|Thành phố)\s+', '', old)).replace(' ', '')
            for host in (f'{slug}.edu.vn', f'sgddt.{slug}.gov.vn', f'sogddt.{slug}.gov.vn'):
                seeds.append((f'https://{host}/', city))
    seeds = list(dict.fromkeys(seeds))
    source_report = []
    secondary = []
    def portal(seed):
        url, city = seed
        if args.cached_portals and not (cache / (hashlib.sha256(url.encode()).hexdigest() + '.html')).exists():
            return [], [], {'url': url, 'status': 'unavailable_in_initial_scan'}
        text = fetch(url, cache)
        if not text:
            return [], [], {'url': url, 'status': 'unavailable'}
        soup = BeautifulSoup(text, 'html.parser')
        title = soup.title.get_text(' ', strip=True) if soup.title else ''
        known = any(url.startswith(item[0].split('?')[0]) for item in KNOWN)
        if not known and not re.search(r'sở.*giáo dục|s[oở].*gd.?[&và]*.?[đd]t', title, re.I):
            return [], [], {'url': url, 'status': 'not_confirmed_education_department', 'title': title[:120]}
        schools, pages = links_from_portal(url, city, text)
        return schools, [(page, city) for page in pages], {'url': url, 'status': 'checked', 'schools': len(schools), 'title': title[:120]}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for schools, pages, result in pool.map(portal, seeds):
            records.extend(schools); secondary.extend(pages); source_report.append(result)
            if len(source_report) % 10 == 0:
                print(json.dumps({'phase': 'portals', 'checked': len(source_report), 'total': len(seeds), 'discovered': len(records)}), flush=True)
    # Chỉ đi các đường dẫn danh bạ công khai đã thấy trên chính cổng Sở; không đoán endpoint riêng tư.
    secondary = list(dict.fromkeys(secondary))
    def directory_page(seed):
        url, city = seed; text = fetch(url, cache)
        return links_from_portal(url, city, text)[0] if text else []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for rows in pool.map(directory_page, secondary):
            records.extend(rows)
    sites = {row['site']: row for row in records}
    (cache.parent / 'portals-report.json').write_text(json.dumps(source_report, ensure_ascii=False, indent=2), encoding='utf-8')
    (cache.parent / 'websites.json').write_text(json.dumps(list(sites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'phase': 'schools', 'websites': len(sites), 'directory_pages': len(secondary)}), flush=True)
    def inspect(row):
        text = fetch(row['site'], cache)
        if not text:
            return {'site': row['site'], 'status': 'unavailable'}
        soup = BeautifulSoup(text, 'html.parser')
        candidates = list({entry['code']: entry for entry in by_name[(row['city'], builder.core(row['name']))]}.values())
        address = address_from(BeautifulSoup(text, 'html.parser'))
        direct = [entry for entry in candidates if len(entry['code']) >= 7 and entry['code'] in text]
        exact_site = [entry for entry in candidates if entry.get('website') == row['site']]
        if len(exact_site) == 1:
            candidates = exact_site
        elif len(direct) == 1:
            candidates = direct
        elif len(candidates) > 1 and address:
            area = builder.fold(address)
            local = [entry for entry in candidates if builder.core(entry['region']) and builder.core(entry['region']) in area]
            if len(local) == 1:
                candidates = local
        if len(candidates) != 1:
            return {'site': row['site'], 'status': 'ambiguous' if candidates else 'unmatched', 'name': row['name'], 'city': row['city'], 'address': address, 'source': row['source']}
        entry = candidates[0]
        if entry.get('website') and entry['website'] != row['site']:
            return {'site': row['site'], 'status': 'historical_site', 'name': row['name'], 'current_website': entry['website']}
        logo = logo_from(soup, row['site'], cache)
        return {'code': entry['code'], 'name': entry['name'], 'city': entry['city'], 'region': entry['region'], 'address': address, 'website': row['site'], 'source': row['source'], 'verified': True, 'checked_at': DAY, 'status': 'matched', '_logo': logo}
    inspected = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for result in pool.map(inspect, sites.values()):
            inspected.append(result)
            if len(inspected) % 25 == 0:
                print(json.dumps({'phase': 'schools', 'checked': len(inspected), 'total': len(sites), 'matched': sum(row['status'] == 'matched' for row in inspected)}), flush=True)
    duplicates = Counter(row['_logo']['fingerprint'] for row in inspected if row.get('_logo'))
    output_dir = ROOT / 'frontend/public/school-logos'
    current_metadata = {row['code']: row for row in json.loads((ROOT / 'backend/src/admin/school-metadata.json').read_text(encoding='utf-8'))['schools']}
    logos = {row['code']: row for row in old_manifest['schools']}
    for code, logo in logos.items():
        if code in by_code and code not in current_metadata:
            entry = by_code[code]
            current_metadata[code] = {**entry, 'address': None, 'website': logo['site'], 'logo_url': f'/school-logos/{code}.webp', 'source': logo.get('source') or old_manifest['portal'], 'verified': True, 'checked_at': old_manifest['fetched']}
    for row in inspected:
        if row['status'] != 'matched':
            continue
        logo = row.pop('_logo', None)
        row.pop('status', None)
        old = current_metadata.get(row['code'], {})
        if not row['address']:
            row['address'] = old.get('address')
        if logo and logo['logo_source'] not in rejected_sources and duplicates[logo['fingerprint']] < 3:
            code = row['code']
            if re.fullmatch(r'[A-Za-z0-9_-]{1,80}', code):
                target = (output_dir / f'{code}.webp').resolve()
                if target.parent != output_dir.resolve():
                    raise ValueError('Đường dẫn ảnh nằm ngoài thư mục logo')
                target.write_bytes(logo.pop('bytes'))
                row['logo_url'] = f'/school-logos/{code}.webp'
                logos[code] = {'code': code, 'name': row['name'], 'city': row['city'], 'district': row['region'], 'site': row['website'], 'source': row['source'], 'logo_source': logo['logo_source'], 'confidence': logo['confidence'], 'source_px': logo['source_px'], 'webp_bytes': target.stat().st_size}
        elif old.get('logo_url'):
            row['logo_url'] = old['logo_url']
        current_metadata[row['code']] = row
    metadata = {'version': DAY, 'schools': sorted(current_metadata.values(), key=lambda row: row['code'])}
    (ROOT / 'backend/src/admin/school-metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    old_manifest['fetched'] = DAY; old_manifest['schools'] = sorted(logos.values(), key=lambda row: row['code'])
    manifest_path.write_text(json.dumps(old_manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    codes = '\n'.join(f'  {json.dumps(code)},' for code in sorted(logos))
    registry = f'/** Logo lấy từ website trường được dẫn bởi cổng Sở GD&ĐT; nguồn từng ảnh: scripts/school-logos.json. */\nexport const SCHOOL_LOGO_CODES = new Set<string>([\n{codes}\n]);\nexport const schoolLogoUrl = (code: string): string | null => SCHOOL_LOGO_CODES.has(code) ? `/school-logos/${{code}}.webp` : null;\n'
    (ROOT / 'frontend/lib/school-logos.ts').write_text(registry, encoding='utf-8')
    report = {'checked_at': DAY, 'catalogue_entries': len(entries), 'portals': source_report, 'websites': len(sites), 'statuses': dict(Counter(row.get('status', 'matched') for row in inspected)), 'metadata': len(current_metadata), 'logos': len(logos), 'unresolved': [row for row in inspected if row.get('status') and row['status'] != 'matched']}
    (cache.parent / 'coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: report[key] for key in ('catalogue_entries', 'websites', 'statuses', 'metadata', 'logos')}, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', required=True)
    parser.add_argument('--all-provinces', action='store_true')
    parser.add_argument('--cached-portals', action='store_true')
    parser.add_argument('--workers', type=int, choices=range(1, 13), default=4)
    run(parser.parse_args())
