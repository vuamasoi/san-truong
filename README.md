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
