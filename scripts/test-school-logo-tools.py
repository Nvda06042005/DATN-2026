"""Kiểm tra bộ đọc nguồn công khai, không gọi mạng hoặc dịch vụ production."""
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch
from PIL import Image
from bs4 import BeautifulSoup

spec = importlib.util.spec_from_file_location('school_crawler', Path(__file__).with_name('refresh-school-metadata.py'))
crawler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(crawler)

class SchoolLogoTools(unittest.TestCase):
    def test_provincial_host_prevents_matching_a_namesake_in_another_province(self):
        self.assertEqual(crawler.website_city('https://thcslythuongkiettanbinh.hcm.edu.vn/'), 'Thành phố Hồ Chí Minh')
        self.assertEqual(crawler.website_city('https://thcsx.hanoi.edu.vn/'), 'Thành phố Hà Nội')
        self.assertEqual(crawler.website_city('https://thcsx.binhduong.edu.vn/'), 'Thành phố Hồ Chí Minh')
        self.assertIsNone(crawler.website_city('https://hcm.edu.vn.attacker.invalid/'))
    def test_malformed_and_private_urls_are_not_followed(self):
        for url in ['http://#', 'javascript:alert(1)', 'https://localhost/logo', 'http://127.0.0.1/', 'https://school.edu.vn:note/aaa', 'https://school.edu.vn/?token=private', 'https://user:pass@school.edu.vn/']:
            self.assertIsNone(crawler.safe_url(url))
        self.assertEqual(crawler.safe_url('https://school.edu.vn/logo.webp#top'), 'https://school.edu.vn/logo.webp')

    def test_public_detail_page_is_only_followed_when_declared_by_site(self):
        row = "<table><tr><td>THCS Thử Nghiệm</td><td><button onclick=\"openModal('123')\">Xem</button></td></tr></table>"
        script = '<script>modalImg.src = "/DsDonViGiaoDucChitiet.aspx?id=" + id;</script>'
        self.assertEqual(crawler.links_from_portal('https://danang.edu.vn/DsDonViGiaoDucmb', 'Đà Nẵng', row)[1], [])
        pages = crawler.links_from_portal('https://danang.edu.vn/DsDonViGiaoDucmb', 'Đà Nẵng', row + script)[1]
        self.assertEqual(pages, ['https://danang.edu.vn/DsDonViGiaoDucChitiet.aspx?id=123'])

    def test_known_rejected_image_does_not_hide_later_logo(self):
        image = Image.new('RGBA', (300, 300), '#801010')
        output = io.BytesIO(); image.save(output, 'PNG')
        soup = BeautifulSoup('<img id="logo" src="/bad.png"><img class="logo" src="/good.png">', 'html.parser')
        with patch.object(crawler, 'fetch', return_value=output.getvalue()) as fetch:
            logo = crawler.logo_from(soup, 'https://school.edu.vn/', Path('.'), {'https://school.edu.vn/bad.png'})
        self.assertEqual(logo['logo_source'], 'https://school.edu.vn/good.png')
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual(Image.open(io.BytesIO(logo['bytes'])).size, (160, 160))

    def test_catalogue_text_website_and_options_are_discovered(self):
        soup = '<table><tr><td>THCS A</td><td>https://thcsa.hanoi.edu.vn</td></tr></table><select><option value="https://thcsb.hanoi.edu.vn/">THCS B</option></select>'
        rows, _ = crawler.links_from_portal('https://hanoi.edu.vn/', 'Hà Nội', soup)
        self.assertEqual({row['site'] for row in rows}, {'https://thcsa.hanoi.edu.vn/', 'https://thcsb.hanoi.edu.vn/'})

if __name__ == '__main__':
    unittest.main()
