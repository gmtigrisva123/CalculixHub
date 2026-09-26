# Google / Facebook sign-in — tiến độ triển khai

Cập nhật: 26/09/2026. Công việc chỉ thay đổi file trong CalculixHub; chưa triển khai production.

## Đã thực hiện

- Thêm nút Google và Facebook vào đăng nhập/đăng ký, dùng Supabase OAuth và PKCE hiện có.
- Kiểm tra trạng thái provider trước khi chuyển hướng; khi chưa được bật, hiển thị thông báo rõ ràng và cho phép dùng email.
- Kiểm tra URL xác thực thuộc đúng dự án Supabase; callback quay lại cùng origin của ứng dụng.
- Xử lý callback lỗi bằng thông báo an toàn; xóa mã callback khỏi URL sau xử lý.
- Chờ khôi phục phiên đăng nhập; đưa người dùng mới đến onboarding.
- Không đưa service-role key hoặc client secret vào frontend.
- Bỏ dòng đếm domains và câu giới thiệu mang tính kỹ thuật khỏi form đăng nhập.
- Dùng Chrome Computer Use kiểm tra Supabase: Google và Facebook đều chưa bật tại thời điểm kiểm tra ban đầu.
- Tạo Google Cloud project `calculixhub`, tên CalculixHub; tạo cấu hình Google Auth Platform sau xác nhận điều khoản của chủ tài khoản.
- Chuẩn bị OAuth web client `CalculixHub Web`, origins `https://calculixhub.com`, `http://localhost:8000`; redirect URI là callback Supabase của dự án.
- Chuẩn bị ứng dụng Meta CalculixHub với Facebook Login. Chủ tài khoản đã đồng ý tạo ứng dụng; bước xác thực Meta trả về “Not logged in”, cần hoàn tất đăng nhập lại. Chưa xác nhận ứng dụng đã được tạo.

## Kiểm tra

- TypeScript: đạt.
- Vitest: 127/127 kiểm thử đạt, gồm 4 kiểm thử mới cho URL/callback OAuth.
- Production build: thành công trước thay đổi câu chữ cuối cùng. Có cảnh báo kích thước bundle và import tĩnh/động trùng nhau; chưa tối ưu bundle trong lượt này.
- Chrome localhost: form hiển thị nút Google/Facebook; Google chưa bật trả về thông báo thân thiện, không đẩy người dùng sang trang lỗi.

## Còn phải hoàn thành trước khi phát hành

- Xác nhận tạo OAuth client Google; lưu client secret tại Supabase provider, không trong mã nguồn.
- Hoàn tất xác thực Meta, tạo ứng dụng, thiết lập callback và quyền email/public profile, lưu app secret tại Supabase.
- Kiểm tra URL allowlist Supabase cho callback localhost và domain triển khai thực tế.
- Meta đang hiển thị yêu cầu xác minh doanh nghiệp và xét duyệt ứng dụng để phát hành; không thể xem đăng nhập Facebook công khai là hoàn tất trước khi các yêu cầu đó được giải quyết.
- Kiểm thử đăng nhập thực tế hai provider: tài khoản mới, tài khoản cũ, refresh, sign out, từ chối consent và lỗi mạng.
- Kiểm tra privacy policy, cơ chế xóa dữ liệu và trạng thái phát hành trên các provider.
- Triển khai bản mới rồi kiểm thử lại domain thật. Bản local/build thành công không chứng minh production đã hoạt động.

Báo cáo không chứa mật khẩu, client secret hoặc API key. Chưa tuyên bố website sẵn sàng ra mắt hoặc OAuth hoạt động đầu-cuối.
