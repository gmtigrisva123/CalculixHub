# Meta publication — bản nháp cần duyệt và deploy

Trạng thái 27/09/2026: chưa xuất bản. Không dùng URL nháp làm bằng chứng đã hoàn tất Meta.

## Những trang cần có trên bản deploy mới

- `/privacy`: chính sách quyền riêng tư của CalculixHub.
- `/data-deletion`: hướng dẫn yêu cầu xóa tài khoản/dữ liệu.
- `/terms`: điều khoản sử dụng do chủ dự án duyệt.

Domain phải là domain triển khai thực tế, truy cập công khai qua HTTPS. Chỉ điền các URL vào Meta sau khi đã mở và kiểm tra nội dung thật.

## Nội dung privacy cần xác nhận

CalculixHub dùng Supabase cho đăng nhập và dữ liệu người dùng. Facebook Login yêu cầu email và public_profile; không yêu cầu bạn bè, ngày sinh, vị trí hay nội dung Facebook. Dữ liệu website có thể gồm hồ sơ, bài làm, tiến độ học tập, đăng ký Arena, bài đăng, bình luận, tin nhắn và thông báo. Nội dung cộng đồng công khai phải được phân biệt với dữ liệu riêng tư.

Phiên đăng nhập được lưu trong trình duyệt để duy trì đăng nhập. Website có tích hợp Vercel Analytics/Speed Insights; phần AI tùy chọn có thể gửi câu hỏi/nội dung trò chuyện tới nhà cung cấp AI đang dùng. Chính sách cần mô tả đúng cấu hình production sau deploy.

Chủ dự án cần xác nhận tên đơn vị vận hành, địa chỉ liên hệ hỗ trợ/quyền riêng tư, nhóm tuổi được sử dụng, thời gian giữ dữ liệu và quy trình giải quyết yêu cầu. Không tự đặt thời hạn hoặc cam kết chưa được triển khai.

## Nội dung hướng dẫn xóa dữ liệu cần xác nhận

Chưa có chức năng tự xóa toàn bộ tài khoản trong giao diện hiện tại. Cần chọn và vận hành một quy trình thực tế: yêu cầu qua email hỗ trợ đã xác nhận hoặc chức năng tự phục vụ được triển khai. Quy trình phải xác minh quyền sở hữu tài khoản trước khi xóa và mô tả cách xử lý dữ liệu cộng đồng/tin nhắn/bản sao lưu theo thực tế.

Gỡ quyền CalculixHub khỏi Facebook chỉ ngăn truy cập Facebook trong tương lai; không được mô tả việc này như đã xóa dữ liệu CalculixHub. URL hướng dẫn không được trỏ về trang chủ Facebook.

## Trình tự hoàn tất

1. Hoàn tất PR/review của bản website mới.
2. Duyệt và triển khai nội dung chính sách cùng cơ chế yêu cầu xóa dữ liệu.
3. Merge/deploy theo quy trình của dự án, kiểm tra các URL HTTPS trên production.
4. Điền URL thật, tải biểu tượng 1024px, kiểm tra Facebook Login bằng tài khoản có vai trò trong app.
5. Hoàn tất yêu cầu xác minh/xét duyệt mà Meta hiển thị, rồi mới phát hành công khai.

Tham chiếu cấu hình kỹ thuật: https://supabase.com/docs/guides/auth/social-login/auth-facebook
