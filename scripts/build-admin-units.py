"""
Dựng backend/src/admin/admin-units.json: 34 tỉnh / thành phố và 3.321 phường / xã / đặc khu của mô hình chính quyền địa phương hai cấp
(từ 01/07/2025 không còn cấp quận / huyện / thị xã; Nghị quyết 202/2025/QH15, 203/2025/QH15 và các nghị quyết sắp xếp đơn vị cấp xã của
Ủy ban Thường vụ Quốc hội). Nguồn: bộ dữ liệu mở "vietnamese-provinces-database" (ThangLeQuoc, giấy phép MIT), tệp
json/full_json_generated_data_vn_units.json – dựng theo Quyết định 19/2025/QĐ-TTg và các nghị quyết cập nhật sau đó (xem `decree` trong tệp kết quả).

Cách chạy (tải tệp nguồn vào một thư mục riêng, không chạy mã trong thư mục tải về):
  curl -L -o <thư mục tải>/full_units.json https://raw.githubusercontent.com/ThangLeQuoc/vietnamese-provinces-database/master/json/full_json_generated_data_vn_units.json
  curl -L -o <thư mục tải>/metadata.json https://raw.githubusercontent.com/ThangLeQuoc/vietnamese-provinces-database/master/json/vn_provinces_metadata.json
  python -I scripts/build-admin-units.py <thư mục tải>/full_units.json <thư mục tải>/metadata.json backend/src/admin/admin-units.json
"""
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

src, meta_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
units = json.load(open(src, encoding='utf-8'))
meta = json.load(open(meta_path, encoding='utf-8'))
provinces = []
for p in sorted(units, key=lambda x: x['Code']):
    wards = sorted(p['Wards'], key=lambda w: w['Code'])
    provinces.append([p['Code'], p['FullName'], [[w['Code'], w['FullName']] for w in wards]])
total = sum(len(p[2]) for p in provinces)
assert len(provinces) == 34, len(provinces)
assert total >= 3300, total
doc = {
    'version': meta.get('DatasetVersion'),
    'decree': meta.get('LatestDecree'),
    'generated_at': meta.get('GeneratedAt'),
    'source': 'https://github.com/ThangLeQuoc/vietnamese-provinces-database (MIT License, Copyright (c) 2021 Thang Le Quoc)',
    'note': 'Đơn vị hành chính hai cấp từ 01/07/2025: tỉnh / thành phố trực thuộc trung ương và phường / xã / đặc khu; không còn quận / huyện / thị xã.',
    'provinces': provinces,
}
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    f.write('\n')
print(f'{len(provinces)} tỉnh / thành, {total} phường / xã / đặc khu → {out}')
