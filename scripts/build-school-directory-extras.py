#!/usr/bin/env python3
"""Giữ cả mã tham chiếu có chữ/dài hơn 8 số của danh mục nguồn; mã Đông A sinh riêng."""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://gist.github.com/ngoan98tv/b9111580b75562b45185f90d00e5b1ff'
spec = importlib.util.spec_from_file_location('directory_builder', ROOT / 'scripts/build-school-directory.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

def build(source):
    base = json.loads((ROOT / 'backend/src/admin/school-directory.json').read_text(encoding='utf-8'))
    known = {row[0] for row in base['schools']} | {row[0] for row in base['merged']} | set(builder.confirmed_retirements())
    provinces = base['provinces']
    rows, excluded, count = [], [], 0
    for old_city, districts in source.items():
        city = builder.PROVINCE_2026[old_city]
        for region, schools in districts.items():
            for value in schools:
                count += 1
                split = value.rfind('(')
                if split < 0 or not value.endswith(')'):
                    raise ValueError(f'Nguồn có dòng chưa nhận dạng: {value}')
                code, name = value[split + 1:-1].strip(), builder.clean_name(value[:split].strip())
                if code in known:
                    continue
                if code.upper().startswith('TEST'):
                    excluded.append({'code': code, 'name': name, 'reason': 'Bản ghi thử nghiệm trong nguồn, không phải trường đã xác minh'})
                    continue
                known.add(code)
                rows.append([code, name, provinces.index(city), region, None])
    return {'source': SOURCE, 'source_date': '2020-10-06', 'source_rows': count, 'schools': sorted(rows), 'excluded': excluded}

if __name__ == '__main__':
    source = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    data = build(source)
    output = ROOT / 'backend/src/admin/school-directory-extra.json'
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps({'additional': len(data['schools']), 'excluded': data['excluded'], 'source_rows': data['source_rows']}, ensure_ascii=False))
