# Google / Facebook sign-in — tiến độ triển khai

Cập nhật: 27/09/2026. Công việc chỉ thay đổi file trong CalculixHub; chưa triển khai production.

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
- Đã tạo OAuth web client `CalculixHub Web`, origins `https://calculixhub.com`, `http://localhost:8000`; redirect URI là callback Supabase của dự án. Google provider đã lưu và hiển thị Enabled trên Supabase ngày 26/09.
- Xác nhận ứng dụng Meta CalculixHub đã tồn tại: App ID `963910706071222`, hiện ở chế độ phát triển.
- Đã lưu callback Facebook `https://wvldvqoajowenfguyvsw.supabase.co/auth/v1/callback`; Meta hiển thị “Changes saved”. HTTPS và strict redirect URI matching được bật.
- Đã thêm quyền email sau xác nhận của chủ tài khoản; email và public_profile đều hiển thị “Sẵn sàng thử nghiệm”.
- Đã lưu App ID/App Secret và bật provider Facebook trên Supabase sau xác nhận của chủ tài khoản. Đã tải lại trang và xác nhận Facebook hiển thị Enabled. Secret chỉ chuyển từ Meta sang Supabase, không ghi vào file.
- Đã lưu hạng mục Giáo dục, miền calculixhub.com và nền tảng Website với URL https://calculixhub.com/. Đã tải lại trang để xác nhận dữ liệu còn nguyên.
- Đã kiểm tra Supabase Redirect URLs: có http://localhost:8000/?auth=callback và https://calculixhub.com/?auth=callback. Site URL mặc định vẫn là domain Vercel hiện có.

## Kiểm tra

- TypeScript: đạt.
- Vitest: 127/127 kiểm thử đạt, gồm 4 kiểm thử mới cho URL/callback OAuth.
- Production build: thành công trước thay đổi câu chữ cuối cùng. Có cảnh báo kích thước bundle và import tĩnh/động trùng nhau; chưa tối ưu bundle trong lượt này.
- Chrome localhost: form hiển thị nút Google/Facebook; Google chưa bật trả về thông báo thân thiện, không đẩy người dùng sang trang lỗi.

## Còn phải hoàn thành trước khi phát hành

- Kiểm thử Facebook Login đầu-cuối bằng tài khoản có vai trò trong ứng dụng; provider Enabled chưa chứng minh mọi tài khoản Facebook đăng nhập được.
- Meta đang hiển thị yêu cầu xác minh doanh nghiệp và xét duyệt ứng dụng để phát hành; không thể xem đăng nhập Facebook công khai là hoàn tất trước khi các yêu cầu đó được giải quyết.
- Kiểm thử đăng nhập thực tế hai provider: tài khoản mới, tài khoản cũ, refresh, sign out, từ chối consent và lỗi mạng.
- Kiểm tra privacy policy, cơ chế xóa dữ liệu và trạng thái phát hành trên các provider.
- Sau lưu hạng mục, Meta hiện đánh dấu thiếu biểu tượng 1024px và URL chính sách quyền riêng tư. URL điều khoản/xóa dữ liệu hiện có trỏ facebook.com; dù giao diện không còn báo thiếu xóa dữ liệu, đây không phải hướng dẫn hợp lệ cho CalculixHub và cần thay bằng URL thật.
- Đã thử tải public/icons/icon-1024.png qua Chrome; extension từ chối tải file vì chưa bật “Allow access to file URLs”. Cần bật quyền này hoặc chủ tài khoản tự tải biểu tượng.
- Theo yêu cầu chủ dự án, hoàn tất PR/merge/deploy trước khi điền URL chính sách thật và phát hành Meta. Bản nháp yêu cầu nội dung nằm trong docs/meta-publication-draft.md, chưa xuất bản.
- Triển khai bản mới rồi kiểm thử lại domain thật. Bản local/build thành công không chứng minh production đã hoạt động.

Báo cáo không chứa mật khẩu, client secret hoặc API key. Chưa tuyên bố website sẵn sàng ra mắt hoặc OAuth hoạt động đầu-cuối.
