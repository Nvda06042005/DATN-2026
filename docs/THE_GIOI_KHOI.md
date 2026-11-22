# Thế giới khối vuông của bước Nhập vai – 21/11/2026

Người dùng gửi cấu trúc trò chơi: thế giới khối vuông, người chơi khám phá, thu thập tài nguyên, chế tạo, xây dựng, làm nhiệm vụ để học về ba lần kháng chiến chống Nguyên – Mông. Vòng chơi đề xuất: nhận nhiệm vụ → khám phá và tìm thông tin → thu thập, chế tạo, xây dựng → phối hợp thực hiện → mở trang sử.

Người dùng đã chọn qua câu hỏi:
- **Góc nhìn:** 3D nhìn chéo từ trên (three.js).
- **Vị trí:** chỉ thay bước Nhập vai của mỗi chặng. Học, luyện tập, trận đánh và tổng kết giữ nguyên.
- **Đợt 1:** làm trọn bản đồ phần 3 (1287–1288) trước. **Đợt 2** (cùng ngày, migration 081): bản đồ phần 1 và phần 2, cả 13 chặng dùng thế giới khối, bỏ cảnh nhập vai 2D; danh hiệu, tuyến vận chuyển, Sổ sử Đông A, dấu ấn trên bản đồ, dân binh giúp khi chơi một mình (xem mục **Đợt 2** cuối tài liệu).
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
  - Bước đặt vật yêu cầu "em ít nhất N, cả lớp ít nhất M". Em đặt đủ N mà cả lớp chưa đủ M thì **dân binh** (nhân vật của trò chơi) đặt nốt phần còn lại: ngay lập tức khi phòng không còn bạn nào, hoặc sau 60 giây khi có bạn đang chơi mà chưa góp (đợt 2).
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
- `SagaPlay.tsx` (`ExploreScreen`): mở `WorldScreen` với phiên thế giới khối; gửi `class_id` của lớp em đang học. Từ đợt 2 không còn cảnh nhập vai 2D (chặng chưa có bản đồ khối thì báo chưa có nội dung).

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

## Đợt 2 – cả 13 chặng (21/11/2026, migration 081)

Người dùng yêu cầu làm tiếp mọi phần còn lại của đợt 1 và **bỏ cảnh nhập vai 2D ở 9 chặng còn lại**.

### Bản đồ và nhiệm vụ mới

Hai bản đồ khối 48 × 36 ô (sa bàn thu gọn, không phải bản đồ địa lý):
- **Phần 1 – Vùng Thăng Long – Thiên Mạc năm 1258:** trại Bình Lệ Nguyên, làng ven kinh thành có ruộng lúa, kinh thành, bến Chợ / bến Nam, Thiên Mạc có kho kín và nơi trú tạm, bến Đông Bộ Đầu.
- **Phần 2 – Vùng sông Hồng 1282–1285:** bến Bình Than, điện Diên Hồng và quân doanh, Thiên Trường, Hàm Tử, Chương Dương, Tây Kết.

| Chặng | Nhiệm vụ | Thao tác chính |
|---|---|---|
| Bình Lệ Nguyên | Giữ biên giới phía bắc | Lấy gỗ, làm ván che tên, trận đánh sẵn có, trao ván cho Lê Tần, tới Phù Lỗ, trả lời |
| Vườn không nhà trống | Sơ tán | Gặp trưởng làng, bà cụ; gặt lúa, đóng bao; **chọn đúng bến** có thuyền về Thiên Mạc (mở tuyến); cất lương vào kho kín (em 2, cả lớp 4); lấy tre, làm lều, dựng nơi trú tạm; gặp Thái sư Trần Thủ Độ |
| Đông Bộ Đầu | Phản công | Lấy gỗ, tre; đóng thuyền, đưa ra bến (em 2, cả lớp 4); trận đánh sẵn có |
| Bình Than | Hội nghị Bình Than | Gặp vua Trần Nhân Tông, Trần Khánh Dư, Trần Quốc Toản; lấy tre làm cờ hiệu và trao cho Quốc Toản; trả lời vua |
| Diên Hồng | Dựng quân doanh, luyện đội hình | Gặp Thượng hoàng Trần Thánh Tông, vào điện Diên Hồng, nghe Trần Quốc Tuấn; dựng lều quân doanh (em 2, cả lớp 4); **luyện đội hình** theo 5 hiệu lệnh (đi đúng ô theo thứ tự) |
| Rút lui chiến lược | Rút lui 1285 | Nghe Trần Quốc Tuấn; đóng bao lương, đưa xuống thuyền rút quân (em 2, cả lớp 4); gặp Trần Bình Trọng, trận Đà Mạc sẵn có; về Thiên Trường |
| Hàm Tử | Tiếp tế | Đóng bao lương, **chọn đúng đường sông** (mở tuyến), trao lương cho hỏa đầu quân; trận đánh sẵn có |
| Chương Dương | Đánh vào bến thuyền | Đóng thuyền, đưa ra bến; trận đánh sẵn có |
| Tây Kết | Trận Tây Kết | Lấy gỗ, tre, làm rào chặn đường (em 2, cả lớp 4); gặp Trương Hiển; trận đánh sẵn có |

Lời thoại về sự kiện chỉ lấy từ thẻ kiến thức và tổng kết đã có nguồn của từng chặng (migration 066). Nhân vật phụ (trưởng làng, bà cụ, người chèo thuyền, hỏa đầu quân…), dân binh, công thức (ván che tên, lều, cờ hiệu) và số lượng là phần sáng tạo, được đánh dấu trong trò chơi.

### Bước mới

- `give`: mang vật tới tận tay một người (Lê Tần, Trần Quốc Toản, hỏa đầu quân).
- `pick`: đọc bản đồ, đi tới đúng nơi trong các ô sáng; đi nhầm chỗ thì nghe gợi ý và tính một lỗi.
- `drill`: đi lần lượt đúng các ô theo hiệu lệnh; lệch hàng tính một lỗi.
- Mỗi bước có thể có `award`: `title:<mã>` (danh hiệu) hoặc `route:<mã>` (tuyến vận chuyển). Bước luyện đội hình chỉ trao danh hiệu khi không lệch lần nào.

### Phần thưởng và thế giới thay đổi

- **Danh hiệu** (bảng `hk_world_awards`, nằm chung tủ danh hiệu của nhân vật):
  - "Người giữ làng" (hiếm): đưa dân và lương thực tới nơi an toàn. Từ đó em gặt / lấy tài nguyên được thêm 1 và dân làng đến giúp khi em chơi một mình.
  - "Đồng lòng giữ nước" (sử thi): luyện đội hình Diên Hồng không lệch hàng lần nào.
- **Mở tuyến vận chuyển:** chọn đúng bến / đường sông thì mở tuyến thuyền ("Thuyền sông Hồng: Bến Nam ⇄ Thiên Mạc", "Thuyền tiếp tế: Bến sông phía nam ⇄ Hàm Tử"). Ở hai đầu có cột đèn và thuyền chờ; đứng cạnh bến thì nút Tương tác thành "Đi thuyền", sang ngay bến bên kia. Chỉ đổi chỗ đứng, không ảnh hưởng điểm.
- **Dấu ấn trên bản đồ:** mỗi chặng em đã xong để lại người, kho lương, thuyền, cờ, lều, lửa trại trên bản đồ của em (chỉ trang trí, không chặn đường), kể cả ở phần 3.
- **Sổ sử Đông A:** mở được khi em xong mọi chặng của một cuộc kháng chiến. Em sắp lại 5–6 sự kiện theo đúng thứ tự (sự kiện lấy từ thẻ đã có nguồn; thứ tự ban đầu xáo khác nhau cho từng em). Xếp đúng lần đầu được 30 XP và trang sổ được đánh dấu hoàn thành. API `GET /api/saga/world/book`, `POST /api/saga/world/book/:no`.

### Chơi khi mất kết nối chung

- Máy chủ Render gói miễn phí có thể làm rớt kênh chơi chung. Lệnh của em vẫn đi qua API thường nên vẫn chơi tiếp được.
- Dân binh (khối có `user_id` rỗng) đặt nốt phần "cả lớp" khi em đã đặt đủ phần của em (xem mục Phối hợp). Khi có bạn trong phòng, giao diện nhắc lại vùng đang chờ mỗi 20 giây để máy chủ kiểm tra lại.
- Vùng đầy vẫn dời khối cũ nhất sang ô mới bằng UPDATE (giữ luật đợt 1).

### Ứng dụng điện thoại gốc

- Đợt 2: ứng dụng gốc chỉ có nút **"Mở trên trình duyệt"** (em phải đăng nhập lại trên website).
- 22/11/2026, người dùng chọn **nhúng WebView trong ứng dụng** (thư viện `react-native-webview` 14.0.1 – bản Expo SDK 58 yêu cầu, Expo Go có sẵn):
  - Màn Nhập vai trên ứng dụng (`WorldEmbed` trong `components/portal/WorldViewport.tsx`, `SagaPlay.tsx` chọn khi không phải web) mở đúng thế giới khối của trang trường (đường dẫn chuẩn lấy từ `/api/auth/school-link`) với `embed=1`.
  - Trước khi trang tải, WebView ghi sẵn phiên đăng nhập và lớp đang học vào kho của WebView (`embedBootScript` trong `lib/world-map.ts`, cùng khóa với `lib/storage.ts` và `StudentApp`) – em không phải đăng nhập lại.
  - Website ở chế độ `embed=1` chỉ hiện nội dung, không thanh đầu / nút mục (`StudentApp`), chuyển màn (vào trận, trang sử) vẫn giữ `embed`.
  - WebView chỉ cho điều hướng trong website của dự án; liên kết ngoài (nguồn tham khảo…) mở bằng trình duyệt của máy. Không nạp được thì có Thử lại và nút "Mở trên trình duyệt" dự phòng. Cần Internet.
  - Bản web không nạp `react-native-webview` (chỉ tệp gốc `WorldViewport.tsx` nhập thư viện).
  - Kèm theo: trang trường khi chuyển về đường dẫn chuẩn và bước đưa học sinh về trang trường nay giữ cả `c`, `s`, `v`, `embed` (trước chỉ giữ `tab`, `pin` nên đường dẫn mở thẳng một chặng bị về trang đầu).

### Bỏ cảnh nhập vai 2D

- `SagaPlay.tsx` chỉ còn mở thế giới khối; đã xóa `frontend/game/explore-scene.ts`, `game/index.ts` chỉ còn trận đánh Phaser (chiến thuật, Bạch Đằng).
- Dữ liệu `content.explore` cũ trong cơ sở dữ liệu được **giữ nguyên** (không xóa dữ liệu); máy chủ vẫn hiểu phiên 2D cũ nhưng chặng nào có `content.world` cũng mở phiên khối.

### Giao diện

- Ba lỗi phát hiện khi tự chơi trên trình duyệt, đã sửa trong `world3d.ts`:
  - Nút "Tương tác" / phím E ưu tiên đúng thứ bước đang cần: người cần gặp, bàn chế tạo khi đang chế tạo. Trước đây đứng giữa bà cụ và bàn chế tạo thì bấm mãi chỉ nghe bà cụ nói lại.
  - Bến của tuyến thuyền đã mở đứng trước người đứng cạnh: người chèo thuyền đứng ngay ở Bến Nam nên nút từng luôn là "Nói chuyện", không bao giờ thành "Đi thuyền".
  - Đang cầm vật thì chạm xuyên qua núi / nhà / khối đã đặt để tới ô sáng còn trống phía sau. Nhìn chéo nên hàng ô sau của kho dưới chân núi bị núi che, chạm vào chỉ trúng núi.
- Nút "Sổ sử", "Nhân vật"; hộp "Dấu ấn của em" (danh hiệu, tuyến đã mở); thông báo dân binh / dân làng giúp, nhận danh hiệu, đi thuyền.

### Kiểm tra đợt 2

- Backend `world.spec.ts` (8 bài): nội dung 13 chặng hợp lệ và đi được hết, luật `give` / `pick` / `drill` / phần thưởng, dân binh ở Bạch Đằng, dấu ấn của bạn cùng lớp, chặng "Vườn không nhà trống" qua API (danh hiệu, tuyến, thêm tài nguyên, tủ danh hiệu, Sổ sử sai / đúng / 400 / 409). `saga.spec.ts` 15 bài.
- Frontend 214 bài (22/11: thêm kiểm thử WebView nhúng – mã khởi động chạy trong hộp cát, không chèn được mã lạ) (`tests/world.test.cjs` kiểm tra đã bỏ cảnh 2D, three.js chỉ nạp động).
- **Tự chơi trọn nhiệm vụ bằng chuột trên trình duyệt thật** (kịch bản `s41_play_quest.cjs` / `s42_book.cjs` của bộ kiểm thử trình duyệt, PostgreSQL tạm, không gọi API thay thao tác):
  - "Sơ tán – vườn không nhà trống" 11 bước: nói chuyện, gặt lúa, đóng bao ở bàn chế tạo, đi nhầm bến rồi đúng bến (mở tuyến), cất lương (dân binh vào giúp sau 59 giây vì có một bạn ở trong phòng mà không góp), nhận "Người giữ làng", lấy tre, làm và dựng lều, gặp Thái sư, trả lời → hoàn thành → mở trang sử. Không có lỗi trên trang.
  - Chơi lại khi đã có danh hiệu: mỗi lần gặt được 3 lúa thay vì 2; đặt bao vào hàng ô sau núi (chạm xuyên vật che).
  - Đứng ở Bến Nam, nút thành "Đi thuyền: Thuyền sông Hồng: Bến Nam ⇄ Thiên Mạc", bấm là sang bến bên kia.
  - Bản đồ phần 2, hộp "Dấu ấn và phần thưởng của em", Sổ sử: ghi thứ tự sai được nhắc "Đúng 0/6 vị trí", xếp lại bằng nút lên / xuống rồi ghi → "Đã hoàn thiện".
- 22/11/2026 tự chơi thêm bằng chuột (sau khi 081 đã lên Supabase):
  - "Hội nghị Bình Than" 7 bước, có bước trao cờ hiệu tận tay Trần Quốc Toản → hoàn thành, mở tổng kết chặng.
  - "Diên Hồng" 8 bước: dựng lều quân doanh, luyện đội hình 5 hiệu lệnh không lệch lần nào → nhận "Đồng lòng giữ nước".
  - Sổ sử: hoàn thiện đủ 3 trang bằng nút lên / xuống → hiện khung "Em đã hoàn thiện Sổ sử Đông A" (mới, `testID="book-complete"`).
  - Sửa: đường tự tìm (chạm để đi) ở bước chọn nơi / luyện đội hình tránh các vùng khác của bước (`stepAvoid` trong `lib/world-map.ts`), trừ vùng em chạm tới. Trước đó đường đi có thể cắt ngang vị trí 4 khi đi từ vị trí 2 sang 3 và bị tính lệch hàng oan, mất danh hiệu. Đi bằng phím vẫn tự do.
  - "Bình Lệ Nguyên" 8 bước có trận đánh ở giữa: từ thế giới khối bấm "Vào trận", đánh trọn trận theo lượt bằng nút lệnh (27 lệnh), xem kết quả, quay lại thế giới khối, gặp Lê Tần, trao ván che tên, lui về cầu Phù Lỗ, trả lời → hoàn thành.
  - Sửa: đánh xong quay lại, em đứng đúng chỗ đã bấm "Vào trận" như lời mời hứa (lưu chỗ đứng theo phiên trong `sessionStorage` của tab, cảnh mới dựng đặt em ở đó nếu ô còn đi được). Trước đó em về chỗ xuất phát ở Thăng Long và phải đi bộ lại tận trại Bình Lệ.
  - "Bí mật lòng sông" (Bạch Đằng, 14 bước) chơi bằng chuột lộ ra ba lỗi, đã sửa:
    - Hai ô "Đá ghi dấu mực nước" nằm giữa hai tảng đá cao; ở góc nhìn mặc định tảng đá phía trước che kín ô, chạm vào chỉ trúng đá và nhân vật không đi. Nay chạm trúng núi / đá / tường che khuất thì đi tới ô đi được đầu tiên phía sau dọc theo tia chạm.
    - Bước "khi nước lên, ra cầu tàu nhử giặc": em vào vùng lúc nước còn rút thì máy báo chờ, nhưng khi nước lên không chấm lại (máy khách chỉ gửi khi bước VÀO vùng) – em đứng chờ mãi. Nay cảnh báo cả lúc rời vùng, và khi con nước đổi đúng lúc em còn đứng trong vùng thì tự gửi lại.
    - Sau bước đóng cọc em vẫn cầm cọc dư; mỗi lần chạm cầu tàu bị hiểu thành "đóng cọc vào bãi bồi phía sau" (nước lên nên chỉ báo chờ) và em không tới được cầu tàu. Nay sang bước khác thì tự cất vật đang cầm, và khi cầm vật chỉ chạm xuyên qua vật che (núi, khối đã đặt) – chạm người, bàn, cây, đất trống làm việc bình thường.
    - Sau khi sửa, chơi trọn 14 bước bằng chuột: hỏi lão chài, xem dấu mực nước, lấy gỗ / tre, đẽo cọc, làm bè, đóng cọc khi nước rút (chờ con nước), gặp Nguyễn Khoái, đứng ở cầu tàu chờ nước lên (tự qua bước sau 16 giây), trận Bạch Đằng (đóng cọc, khiêu chiến, lui thuyền, phản công) → quay lại đúng chỗ vào trận → 3 câu giải thích → hoàn thành.
  - Chơi bằng chuột nốt 8 nhiệm vụ còn lại (Đông Bộ Đầu, Rút lui chiến lược, Hàm Tử, Chương Dương, Tây Kết, Chuẩn bị đón giặc, Vân Đồn, Vạn Kiếp) – **cả 13 nhiệm vụ đều đã chơi trọn trên trình duyệt**. Vạn Kiếp lộ ra hai lỗi, đã sửa:
    - Em đặt bao lương lên **chính ô mình đang đứng** (máy khách coi ô dưới chân là ô trống, máy chủ không chặn) rồi kẹt trong khối vừa đặt. Nay máy khách không chọn ô dưới chân, máy chủ từ chối đặt lên chỗ mình hay chỗ bạn cùng lớp đang đứng.
    - Dân binh đặt bao vào ô ngay sát em đang đứng trong góc kho dưới chân núi → em bị **vây kín** (núi, tường, bao lương), không đi gặp lính trinh sát được. Nay dân binh không đặt vào 8 ô quanh người nào đang đứng (theo kênh chung và vị trí trong lệnh), máy chủ không cho em đặt vật làm chỗ mình hết lối ra (`hasExit`), và nếu vẫn bị khối đè / vây kín thì máy khách tự đưa em ra ô trống gần nhất còn lối đi.
  - Chơi bằng chuột ở **cỡ điện thoại** (390 px, chế độ nhúng như trong ứng dụng): lộ ra lỗi cuộn – màn hẹp đặt lời thoại dưới cảnh 3D và mã cũ cuộn tới **cuối trang** để "cho thấy lời thoại", trượt quá xuống tận phần dấu ấn / giới thiệu nên cả lời thoại lẫn cảnh 3D đều khuất (khung cảnh còn −839 px), đóng lời thoại cũng không cuộn về. Nay chỉ cuộn vừa đủ thấy hết hộp lời thoại, đóng lời thoại thì cuộn về khung mục tiêu + cảnh 3D.
  - Migration **082**: viết lại 5 hiệu lệnh luyện đội hình không dựa vào "bên phải / bên trái" (em xoay được góc nhìn) và bỏ "dưới cờ đỏ" (trên sân không có cờ); tên vùng "Vị trí 1 (cờ đỏ)" thành "Vị trí 1". Chỉ cập nhật khi nội dung còn đúng bản 081.
- Sửa nội dung sau khi chơi: hai nhãn đè nhau ("Thăng Long" / "Điện Diên Hồng" ở phần 2, "Bến Nam" / người chèo thuyền ở phần 1) được dời chỗ; câu dấu ấn của Bình Than sửa thành "Lá cờ sáu chữ … đã được Trần Quốc Toản dựng lên khi về quê tập hợp nghĩa quân" (Toàn thư chép ông về quê mới dựng cờ, không phải tại hội nghị Bình Than).
