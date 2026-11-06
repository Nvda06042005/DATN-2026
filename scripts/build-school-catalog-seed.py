"""Tạo một migration MỚI từ danh mục đã biên dịch và logo đã duyệt.

Chạy npm run build trong backend trước; không ghi đè migration đã tồn tại.
Ảnh WebP được lưu bytea, khử trùng theo SHA-256; không chứa dữ liệu tài khoản.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def quoted(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"

def build(target):
    if target.exists():
        raise SystemExit('Không ghi đè migration: chọn số migration mới.')
    entries = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./backend/dist/admin/school-directory').searchDirectory('',20000)))"], cwd=ROOT))
    manifest = json.loads((ROOT / 'scripts/school-logos.json').read_text(encoding='utf-8'))
    metadata = {r['code']: r for r in json.loads((ROOT / 'backend/src/admin/school-metadata.json').read_text(encoding='utf-8'))['schools']}
    logos = {row['code']: row for row in manifest['schools']}
    assets = {}
    hashes = {}
    for code in logos:
        path = (ROOT / 'frontend/public/school-logos' / (code + '.webp')).resolve()
        if path.parent != (ROOT / 'frontend/public/school-logos').resolve():
            raise ValueError('Đường dẫn logo không hợp lệ')
        data = path.read_bytes()
        image = Image.open(io.BytesIO(data))
        if image.format != 'WEBP' or max(image.size) > 160 or len(data) > 81920:
            raise ValueError('Logo chưa nén đúng: ' + code)
        digest = hashlib.sha256(data).hexdigest()
        hashes[code] = digest
        assets[digest] = (data, *image.size)
    sql = ['-- Danh mục gốc 06/10/2020 + nguồn chính thức đã đối chiếu 07/11/2026.',
           '-- Chỉ dữ liệu tham chiếu; không tạo app_schools hay app_users.',
           '-- Sinh bằng scripts/build-school-catalog-seed.py; không sửa sau khi áp dụng.']
    for digest, (data, width, height) in sorted(assets.items()):
        sql.append(f"INSERT INTO public.app_school_logo_assets(sha256,image_data,width,height) VALUES('{digest}',decode('{data.hex()}','hex'),{width},{height}) ON CONFLICT(sha256) DO NOTHING;")
    values = []
    for row in entries:
        logo = logos.get(row['code'])
        checked = metadata.get(row['code'], {}).get('checked_at')
        values.append('(' + ','.join(quoted(v) for v in [row['code'], row['name'], row['city'], row['region'], row.get('address'), row.get('website'), row.get('source') or 'https://gist.github.com/ngoan98tv/b9111580b75562b45185f90d00e5b1ff', ('2026-11-07' if row['code'].startswith('hp-') else '2020-10-06'), row.get('note'), json.dumps(row.get('previous_codes', []), ensure_ascii=False), hashes.get(row['code']), logo['logo_source'] if logo else None, checked]) + ')')
    columns = 'code,name,city,region,address,website,source_url,source_date,note,previous_codes,logo_sha256,logo_source_url,checked_at'
    for i in range(0, len(values), 250):
        updates = ','.join(f'{column}=EXCLUDED.{column}' for column in columns.split(',') if column != 'code')
        sql.append(f'INSERT INTO public.app_school_directory({columns}) VALUES\n' + ',\n'.join(values[i:i + 250]) + f'\nON CONFLICT(code) DO UPDATE SET {updates};')
    target.write_text('\n'.join(sql) + '\n', encoding='utf-8')
    print(json.dumps({'entries': len(entries), 'logo_schools': len(hashes), 'unique_images': len(assets), 'image_bytes': sum(len(a[0]) for a in assets.values()), 'migration_bytes': target.stat().st_size}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('migration', help='Tên file SQL mới trong database/migrations')
    args = parser.parse_args()
    target = (ROOT / 'database/migrations' / args.migration).resolve()
    if target.parent != (ROOT / 'database/migrations').resolve() or not target.name.endswith('.sql'):
        raise SystemExit('Chỉ tạo migration SQL mới trong database/migrations')
    build(target)
