# Thế giới khối vuông của bước Nhập vai – 21/11/2026

Người dùng gửi cấu trúc trò chơi: thế giới khối vuông, người chơi khám phá, thu thập tài nguyên, chế tạo, xây dựng, làm nhiệm vụ để học về ba lần kháng chiến chống Nguyên – Mông. Vòng chơi đề xuất: nhận nhiệm vụ → khám phá và tìm thông tin → thu thập, chế tạo, xây dựng → phối hợp thực hiện → mở trang sử.

Người dùng đã chọn qua câu hỏi:
- **Góc nhìn:** 3D nhìn chéo từ trên (three.js).
- **Vị trí:** chỉ thay bước Nhập vai của mỗi chặng. Học, luyện tập, trận đánh và tổng kết giữ nguyên.
- **Đợt này:** làm trọn bản đồ phần 3 (1287–1288) trước.
- **Phối hợp:** bạn cùng lớp chơi chung trực tuyến.

Chỉ lấy thể loại trò chơi khối vuông. Không dùng tên, hình, kết cấu, nhân vật hay âm thanh của trò chơi khác; khối, màu, nhân vật đều do nhóm tự thiết kế bằng mã.

## Người chơi làm gì

- **Tự tạo nhân vật:** chọn nam / nữ, màu áo, đội đầu (không đội, nón lá, khăn, mũ trụ), màu da. Lựa chọn lưu ở `hk_players.appearance.saga_world_look`, qua `GET/POST /api/saga/world/look`.
- **Khám phá:** một bản đồ khối 48 × 36 ô của vùng đông bắc 1287–1288. Bản đồ là sa bàn thu gọn, không phải bản đồ địa lý. Trên đó có:
  - Thăng Long, cửa ải, trại tiền quân, kho trong núi;
  - làng ven sông với ruộng lúa, rừng gỗ, bụi tre;
  - sông Bạch Đằng có bãi bồi, đài chỉ huy, cầu tàu;
  - đảo Vân Đồn có chòi canh, và biển.
- **Đi lại:** W A S D / mũi tên, hoặc chạm vào nơi muốn tới (cảnh tự tìm đường). Điện thoại có nút đi lại. Kéo / vuốt để xoay góc nhìn, Q / R xoay 90°, cuộn chuột để phóng to.
- **Thu thập:** chạm vào cây (gỗ), bụi tre (tre), ruộng lúa (lúa) khi đứng gần. Ô vừa thu hoạch mọc lại sau 45 giây, dùng chung cả phòng.
- **Chế tạo:** tại bàn chế tạo, làm cọc nhọn, bè chở cọc, bao lương, rào chắn, thuyền nhẹ. Công thức là quy ước của trò chơi.
- **Xây dựng:** cầm vật từ túi đồ rồi chạm ô sáng trong vùng xây dựng: cọc trên bãi bồi (chỉ khi nước rút), rào ở cửa ải, bao lương trong kho núi, thuyền ở cầu tàu.
- **Thủy triều:** chu kỳ 80 giây theo đồng hồ máy chủ, 40 giây rút rồi 40 giây lên. Cả lớp thấy cùng một con nước. Nước lên thì mặt sông phủ kín bãi cọc. Có bước chỉ làm được khi nước lên (nhử giặc) hoặc nước rút (đóng cọc).
- **Phối hợp:** bạn cùng lớp vào cùng một phòng (mỗi lớp một phòng cho mỗi cuộc kháng chiến), thấy nhau đi lại theo thời gian thực.
  - Khối đã đặt là của cả lớp và được giữ lại.
  - Bước đặt vật yêu cầu "em ít nhất N, cả lớp ít nhất M". Chơi một mình thì em tự đặt đủ M.
  - Có 8 tín hiệu nhanh có sẵn ("Cần thêm gỗ!", "Chờ con nước!"…), không có ô chat tự do.
- **Trang sử:** xong nhiệm vụ thì mở màn tổng kết đã có nguồn của chặng.

## Nhiệm vụ phần 3

| Chặng | Nhiệm vụ | Thao tác chính | Học được |
|---|---|---|---|
| Thế giặc năm nay dễ phá | Chuẩn bị đón giặc | Gặp vua Trần Nhân Tông và người vừa được tha xin tòng quân; lấy gỗ, tre; làm rào; dựng chiến lũy ở cửa ải (em 3, cả lớp 6); nghe Hưng Đạo vương | Ba đường tiến quân; vua đại xá; Trần Khánh Dư giữ Vân Đồn |
| Vân Đồn | Trinh sát đoàn thuyền lương | Gặp Trần Khánh Dư; lên chòi canh quan sát; đóng thuyền nhẹ, đưa ra cầu tàu (em 2, cả lớp 4); trận đánh sẵn có | Vì sao mất lương là bước ngoặt |
| Giặc cạn lương ở Vạn Kiếp | Giữ lương, theo dõi giặc | Gặt lúa, đóng bao, cất vào kho trong núi (em 3, cả lớp 6); nghe trinh sát | Vì sao giặc không giữ được Thăng Long; hai đường rút |
| Bạch Đằng | Bí mật lòng sông | Hỏi lão chài về con nước; xem dấu mực nước; lấy gỗ, tre; đẽo cọc, làm bè; đóng cọc khi nước rút (em 4, cả lớp 10); nhận tín hiệu của Nguyễn Khoái; nhử giặc khi nước lên; trận Bạch Đằng sẵn có; trả lời 3 câu giải thích | Vì sao giấu cọc dưới nước, vì sao chờ đúng con nước, vì sao cần nhiều lực lượng phối hợp |

Ba câu giải thích cuối "Bí mật lòng sông" đúng như người dùng đề xuất.

Lời thoại về sự kiện lấy từ thẻ kiến thức và tổng kết đã có nguồn của từng chặng (migration 066), ví dụ:
- cọc gỗ lim đầu nhọn, đóng khi nước rút, cách nhau khoảng một mét;
- cọc không chặn ngang lạch sâu;
- câu Toàn thư chép về con nước.

Nhân vật phụ (lão chài, người tòng quân, lính canh…), lời thoại, công thức và số lượng là phần sáng tạo, được ghi rõ trong trò chơi.

## Máy chủ

- `backend/src/saga/world.ts`: hàm thuần.
  - Kiểm tra bản đồ khối (`normalizeWorldMap`) và nhiệm vụ (`normalizeWorldQuest`).
  - Luật của từng lệnh (`applyWorld`): `interact`, `answer`, `hint`, `zone`, `gather`, `craft`, `place`.
  - Thu thập / đặt vật phải đứng cách tối đa 2 ô. Đặt vật đúng vùng, đúng loại ô, đúng con nước, ô còn trống. Chế tạo cần đủ nguyên liệu.
  - Sau mọi lệnh, bước thu thập / chế tạo / đặt vật đã đủ điều kiện thì tự qua.
  - Thủy triều: `tideAt`.
- `saga.service.ts`:
  - Chặng có `content.world` thì phiên nhập vai là thế giới khối (`state.v = 2`). Vẫn dùng `hk_saga_sessions` / `hk_saga_actions`: mã lệnh, số thứ tự, gửi lặp nhận kết quả cũ.
  - Xong thì ghi `explore_done_at` và thưởng điểm một lần như cảnh 2D.
  - Phiên 2D cũ đang mở của chặng đã chuyển sang khối thì mở phiên mới.
  - Bước ra trận mở trận đánh sẵn có của chặng (`atBattleStep` hiểu cả hai loại phiên).
  - Đặt vật khóa phòng (`pg_advisory_xact_lock`). Vùng đầy thì dời khối cũ nhất sang ô mới bằng UPDATE, không xóa nên không sinh bản ghi ở kho dữ liệu đã xóa.
  - Sức chứa vùng luôn nhỏ hơn số ô, nên bạn đến sau vẫn đặt được phần của mình.
- `world.hub.ts`: trong bộ nhớ, gồm ai đang ở phòng, vị trí, ô đang chờ mọc lại. Khởi động lại máy chủ thì các ô mọc lại ngay; không mất tiến độ.
- `world.gateway.ts`: Socket.IO, cùng đường dẫn `/api/live/ws` với phòng thi đấu, namespace `/world`.
  - Chỉ học sinh. Máy chủ kiểm tra em thuộc lớp và lớp còn hoạt động.
  - Sự kiện vào / ra, `world:moved` (giới hạn ~14 lần / giây), `world:said` (mã có sẵn), `world:block`, `world:node`.
  - Thay đổi chỉ được phát sau khi giao dịch đã ghi xong.
- Migration **080** (`database/migrations/080_block_world.sql`):
  - cột `hk_saga_maps.world`;
  - bảng `hk_world_rooms` (lớp × cuộc kháng chiến) và `hk_world_blocks` (khối của phòng), bật RLS theo trường, không cấp quyền công khai;
  - `app_install_delete_archives()` cho bảng mới;
  - bản đồ khối phần 3 và khóa `world` cho 4 chặng (giữ nguyên `content.explore` cũ).

## Giao diện

- `frontend/game/world3d.ts`: three.js, chỉ nạp động từ `WorldViewport.web.tsx`, không nằm trong `game/index`.
  - Khối địa hình là InstancedMesh, mặt trên có hạt điểm ảnh tự sinh.
  - Có cây, tre, lúa (thu hoạch còn gốc), nhà, lều, tường, điện, cầu tàu, mặt nước dâng / rút, nhân vật khối, mũi tên chỉ mục tiêu, ô sáng của vùng xây dựng.
  - Tên người / địa danh / bóng thoại là phần tử DOM.
  - Bật giảm chuyển động thì bỏ nhún, máy quay không lướt.
  - Rời màn thì hủy renderer, hình khối, vật liệu, bộ nghe.
- `WorldScreen.tsx`: khung nhiệm vụ (mục tiêu, tiến độ "em / cả lớp", đồng hồ con nước, số bạn đang chơi), cảnh 3D, lời thoại / câu hỏi / ra trận, túi đồ, bàn chế tạo, tín hiệu nhanh, tự tạo nhân vật, hoàn thành → "Mở trang sử".
- `lib/world-map.ts` gồm tìm đường, ô chặn, đứng cạnh mục tiêu, thủy triều, mục tiêu của bước. `lib/world-socket.ts` là kết nối phòng của lớp.
- `SagaPlay.tsx` (`ExploreScreen`): máy chủ trả phiên thế giới khối thì mở `WorldScreen`, không thì cảnh 2D như cũ. Gửi `class_id` của lớp em đang học.

## Kiểm tra

- Backend `test/world.spec.ts`:
  - nội dung khởi tạo hợp lệ;
  - luật thuần;
  - chơi trọn "Bí mật lòng sông" qua API gồm trận Bạch Đằng;
  - hai bạn cùng lớp dùng chung bãi cọc;
  - vùng đầy dời khối, không có bản ghi xóa;
  - học sinh không có lớp / chọn lớp khác bị chặn;
  - tự tạo nhân vật;
  - kênh Socket.IO.
- `saga.spec.ts` giữ phép thử cảnh 2D + trận Bạch Đằng bằng cách bỏ nhiệm vụ khối của chặng trong cơ sở dữ liệu thử.
- Frontend `tests/world.test.cjs`: tìm đường, thủy triều khớp máy chủ, vùng / tổng cả lớp, three.js chỉ nạp động, tín hiệu nhanh và lựa chọn nhân vật khớp máy chủ, không có ô chat tự do.
- Chụp trên trình duyệt thật với PostgreSQL tạm:
  - cảnh 3D, tạo nhân vật;
  - bạn cùng lớp vào phòng qua Socket.IO, có bóng thoại;
  - chạm nhân vật để nói chuyện, chạm tre để thu thập, chạm bàn chế tạo để làm bè;
  - bản điện thoại có nút đi lại.

## Chưa làm (đợt sau)

- Bản đồ khối của phần 1 (1258) và phần 2 (1285) theo bảng của người dùng: sơ tán, dựng nơi trú, chuẩn bị thuyền Đông Bộ Đầu; quân doanh, Diên Hồng, Hịch tướng sĩ, Hàm Tử – Chương Dương.
- Danh hiệu "Người giữ làng", "Đồng lòng giữ nước", mở tuyến vận chuyển mới, "Sổ sử Đông A" (sắp xếp sự kiện sau mỗi chiến dịch).
- Thế giới thay đổi theo việc em làm qua nhiều nhiệm vụ: làng có người ở, kho lương, thuyền đưa đồng đội về.
- Ứng dụng điện thoại gốc (React Native) chưa chạy cảnh 3D; dùng trình duyệt.
