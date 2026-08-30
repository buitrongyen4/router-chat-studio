# Router Chat Studio — Hướng dẫn chạy và test ở phiên khác

## 1. Nội dung gói mã nguồn

File ZIP đi kèm chứa source code, cấu hình TypeScript/Vite/Express, schema Drizzle, test Vitest, script kiểm tra browser và tài liệu accessibility. Gói **không chứa** `node_modules`, `dist`, thư mục `.git`, log runtime hoặc API key. Vì vậy cần cài dependencies lại sau khi giải nén.

## 2. Mở project ở một phiên Manus khác

Trong phiên Manus mới, tải file ZIP này lên workspace, giải nén và mở thư mục gốc có `package.json`. Nếu phiên mới hỗ trợ tiếp nhận source bundle, chọn thao tác import/open project từ thư mục đã giải nén. Không tạo file `.env` chứa API key trong source bundle.

Sau khi project đã được mở, kiểm tra rằng các file quan trọng vẫn tồn tại: `client/src/pages/Home.tsx`, `server/chatApi.ts`, `client/src/lib/streamSession.ts`, `shared/chatUtils.ts`, `package.json` và `pnpm-lock.yaml`.

## 3. Cài đặt và khởi động

Chạy các lệnh sau từ thư mục gốc project:

```bash
pnpm install
pnpm dev
```

Sau khi server khởi động, mở preview URL do phiên Manus cung cấp. Ứng dụng mặc định hiển thị trạng thái chưa kết nối; đây là trạng thái bình thường cho tới khi nhập endpoint và API key.

Nếu môi trường không dùng được `pnpm`, có thể dùng Node.js tương thích với `package.json`, nhưng nên ưu tiên `pnpm` để giữ đúng lockfile.

## 4. Kết nối 9Router hoặc API tương thích

Mở **Settings** ở thanh trên cùng. Chọn provider, nhập base URL, API key cho phiên hiện tại và model mặc định, sau đó chọn **Check connection** hoặc **Save & connect**.

| Provider | Protocol mặc định | Route chat |
| --- | --- | --- |
| 9Router / OpenAI Compatible | OpenAI-compatible | `/v1/chat/completions` |
| OpenAI Compatible | OpenAI-compatible | `/v1/chat/completions` |
| Anthropic Compatible | Anthropic-compatible | `/v1/messages` |
| Custom | Chọn OpenAI-compatible hoặc Anthropic-compatible | Theo protocol đã chọn |

Có thể nhập base URL đã có `/v1`; server sẽ chuẩn hóa để không lặp `/v1`. Nếu endpoint không cung cấp danh sách model, phần model picker vẫn cho phép nhập **model ID thủ công**.

API key chỉ được giữ trong bộ nhớ của server cho session đang chạy. Công tắc **Remember connection preferences** chỉ lưu tên kết nối, provider, URL và model mặc định; key không được lưu trong `localStorage`.

## 5. Test các chức năng chính

Tạo cuộc hội thoại bằng **New chat**, nhập một prompt và nhấn **Send**. Khi provider trả về stream, nội dung assistant sẽ được render theo Markdown. Nút **Stop** hủy stream hiện tại và không để lại assistant placeholder rỗng. Model picker ở composer hỗ trợ tìm kiếm, cuộn danh sách và model ID thủ công.

Nút **Export .md** tải hội thoại hiện tại xuống thành file Markdown. Sidebar lưu nhiều cuộc hội thoại và giữ lại dữ liệu sau khi refresh trình duyệt. Các thao tác Copy, Regenerate và Clear nằm ở khu vực message/action tương ứng.

## 6. Kiểm tra tự động

Chạy toàn bộ test và kiểm tra TypeScript/build:

```bash
pnpm test
pnpm check
pnpm build
```

Nếu phiên mới có Chromium hệ thống và đã cài `@playwright/test`, có thể chạy thêm browser cancellation test và accessibility audit:

```bash
node scripts/browser-cancel.e2e.mjs
node scripts/chat-scroll.e2e.mjs
node scripts/chat-touch-scroll.e2e.mjs
node scripts/stream-scroll.e2e.mjs
node scripts/accessibility-check.mjs
```

Các script trên mặc định kết nối tới `http://127.0.0.1:3000`; nếu dev server dùng port khác, sửa URL trong script trước khi chạy. Browser cancellation test mô phỏng stream chậm, nhấn Stop và xác nhận placeholder assistant rỗng không còn. Hai script scroll kiểm tra overflow bằng wheel và touch drag ở mobile. Streaming scroll regression xác nhận auto-scroll vẫn bám đáy khi đang stream, nhưng tôn trọng vị trí khi người dùng đã kéo lên. Accessibility audit kiểm tra tab navigation, focus ring, dialog semantics, label association, Escape dismissal và các cặp màu đại diện.

## 7. Các file tài liệu trong project

`README.md` mô tả kiến trúc và provider adapter. `accessibility-verification.md` lưu kết quả audit accessibility đã chạy. `todo.md` lưu lịch sử checklist triển khai.

## 8. Lưu ý khi deploy/publish

Khi test trong Manus, hãy dùng preview trước để xác nhận endpoint thật, model ID, streaming và export. Khi publish, cần tạo checkpoint sau khi source đã được kiểm tra, rồi dùng nút **Publish** trong Management UI. Nếu deployment báo lỗi billing hoặc site unavailable, cần xử lý trạng thái billing/hosting của Manus trước khi publish lại.

Không đưa API key thật vào ZIP, commit, README, screenshot hoặc log. Nếu muốn chuyển project sang môi trường ngoài Manus, cần tự cấu hình các biến môi trường hệ thống mà template yêu cầu và kiểm tra lại OAuth/database theo môi trường đó.
