# Sân trường online

Game sân trường chơi mạng, không cần đăng nhập Claude. Mọi người mở cùng một địa chỉ web, vào Chơi mạng là được xếp tự động vào phòng còn chỗ (Phòng 1, 2, 3…).

Tính năng: đi lại tự do, 15 nhân vật/skin, tên và màu tên, chat (có lọc từ cấm), thả emoji, minimap và bản đồ (phím M) cho mọi người.

## Chạy thử trên máy bạn
1. Cài Node.js (bản 18 trở lên).
2. Mở terminal trong thư mục này, chạy `npm install` rồi `npm start`.
3. Mở http://localhost:3000, vào Chơi mạng, bấm Vào phòng. Trên máy bạn (localhost) được mở nhiều tab để thử.

## Đưa lên mạng (ví dụ Render.com)
1. Đưa thư mục này lên một kho GitHub (phải giữ thư mục `public` chứa `index.html`).
2. Trên Render.com tạo "Web Service" từ kho đó. Build command: `npm install`. Start command: `npm start`. Gói Free.
3. Trong mục **Environment** của dịch vụ, thêm biến `ADMIN_KEY` với một chuỗi bí mật dài do bạn tự đặt (ví dụ `m4t-khau-rat-dai-123`).
4. Gửi mọi người địa chỉ dạng https://ten-cua-ban.onrender.com.
5. Riêng bạn (chủ), mở https://ten-cua-ban.onrender.com/?key=CHUỖI_BÍ_MẬT để được miễn giới hạn "1 người mỗi địa chỉ mạng" (mở nhiều tab/thiết bị để thử). Đừng gửi link có `?key=` cho người khác.

## Kiểm tra giới hạn địa chỉ sau khi đưa lên Render
Mở https://ten-cua-ban.onrender.com/whoami?key=CHUỖI_BÍ_MẬT trên máy tính, rồi mở lại trên điện thoại bằng 4G (tắt wifi). Hai địa chỉ ở dòng `dang_dung` phải KHÁC nhau. Nếu giống nhau, máy chủ đang nhận nhầm địa chỉ của Render: đặt biến `IP_LIMIT=0` để tắt giới hạn và báo lại để chỉnh.

## Giới hạn và bảo vệ
- Mỗi địa chỉ mạng (IP) chỉ được 1 người chơi cùng lúc, trừ chủ có `ADMIN_KEY`. Lưu ý: những người dùng chung một mạng (cùng wifi nhà, trường, quán) có thể bị tính là cùng một địa chỉ. Đặt `IP_LIMIT=2` (hoặc số khác) trong Environment nếu muốn nới, `IP_LIMIT=0` để tắt.
- Mỗi phòng tối đa 50 người (`MAX_ROOM`), tối đa 500 kết nối (`MAX_CONN`), 100 phòng (`MAX_ROOMS`).
- Chat: tối đa 80 ký tự, 1 tin mỗi 1,2 giây, tin có từ cấm bị chặn; vi phạm 3 lần bị cấm chat 60 giây. Danh sách từ cấm nằm trong `filter.js`, bạn có thể thêm từ (viết không dấu, liền nhau, chữ thường). Bộ lọc chỉ ở mức cơ bản, không bắt được mọi cách lách.
- Chỉ nhận kết nối từ chính trang của game (kiểm tra Origin), gói tin tối đa 1 KB, tự ngắt kết nối gửi quá nhanh.
- Dữ liệu từ người chơi khác chỉ được vẽ lên canvas, không chèn vào trang.

## Chưa chống được
- Người chơi sửa trạng thái trên máy họ (cheat) như đổi vị trí, đi xuyên tường: máy chủ chưa kiểm tra tốc độ di chuyển.
- Tấn công mạng quy mô lớn (DDoS): cần dịch vụ như Cloudflare.

## Nén trang và chống cheat tốc độ
- Máy chủ tự nén trang (brotli/gzip) và dùng ETag: lần vào đầu tải khoảng 3,2 MB thay vì 4,8 MB, các lần sau gần như không tải lại.
- Máy chủ giới hạn tốc độ di chuyển (MOVE_RATE, mặc định 10,5 ô/giây, bộ đệm MOVE_CAP 24 ô). Ai "bay" nhanh hơn sẽ bị kéo lại vị trí; vi phạm kéo dài sẽ bị ngắt kết nối.

## Chơi thử riêng tư (link khóa 1 thiết bị)
- Trang chơi thử (bắt đầu 23:45, không skip, chỉ có nút chọn cốt truyện) nằm trong `data/pt.bin`, đã nén và mã hóa AES-256-GCM vì kho này công khai. Cần đặt biến môi trường **`PT_SECRET`** trên Render (cùng giá trị đã dùng để đóng gói) thì server mới giải mã và phục vụ ở `/p/<token>`.
- Link dạng `https://ten-cua-ban.onrender.com/p/<token>`. Lần đầu mở: gắn với thiết bị (cookie) + IP của người mở. Sau đó chỉ thiết bị đó vào lại được (đổi wifi/4G vẫn vào nhờ cookie); người khác mở link nhận trang từ chối.
- Tạo link: `PT_SECRET=... node tools/pt-token.js 7 3` (hạn 7 ngày, 3 link). Hoặc `curl -X POST -H "x-admin-key: $ADMIN_KEY" "https://.../pt-admin/new?days=7"` (key đặt trong header, không đặt trong URL).
- Thu hồi: thêm id (10 ký tự đầu của token) vào `data/pt-revoked.json` rồi đẩy lên kho (bền vững), hoặc `POST /pt-admin/revoke?id=...` với header `x-admin-key` (có hiệu lực ngay nhưng mất khi server khởi động lại). `GET /pt-admin/list` xem ai đã dùng; `POST /pt-admin/reset?id=...` gỡ gắn thiết bị.
- Đóng gói lại trang: `PT_SECRET=... node tools/pt-pack.js duong-dan/play.html`.
- Giới hạn: trạng thái "đã gắn thiết bị" nằm trong bộ nhớ server, Render gói Free ngủ sau 15 phút không có truy cập và mất trạng thái khi triển khai lại; khi đó người đầu tiên mở link sẽ được gắn (chủ thật vẫn vào lại được nhờ cookie). Server tự gọi `/health` mỗi 10 phút khi chạy trên Render để giảm ngủ.
