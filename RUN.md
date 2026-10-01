# Cách chạy: Đảo Bé Học

Game web 3D (Vite + TypeScript + Three.js) cho Nhím học đánh vần và toán. Chạy trên Mac, mở được trên iPad cùng Wi-Fi.

## Cần có

- Node.js 20 trở lên (`node -v`)
- pnpm 9 trở lên: `corepack enable` hoặc `npm i -g pnpm`
- (Chỉ khi muốn sinh lại giọng đọc) macOS có giọng tiếng Việt **Linh**: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → Vietnamese → Linh

## Chạy lần đầu

```bash
git clone https://github.com/buiduccuong30051989/game-island-three.git
cd game-island-three
pnpm install
pnpm dev
```

Mở **http://localhost:5173**, chạm nút to giữa màn hình để bắt đầu (lần chạm đầu cũng mở khoá âm thanh).

## Chơi trên iPad

1. Mac và iPad cùng Wi-Fi.
2. `pnpm dev` sẽ in dòng `Network: http://192.168.x.x:5173`. Mở địa chỉ đó bằng Safari trên iPad.
3. Safari → Chia sẻ → **Thêm vào MH chính** để chạy toàn màn hình như app.
4. Nếu không có tiếng: tắt chế độ im lặng, tăng âm lượng, chạm nút bắt đầu lại.

## Cách chơi

- 🐄 chạm con vật: nghe tiếng kêu, tên và đánh vần. Giữ rồi kéo để nhấc con vật đi chỗ khác.
- ❓ đố 4 câu "Con nào là con …?".
- 🍎 đếm táo rồi chọn số đúng.
- 🔊 nghe lại câu hỏi. Chạm bảng ảnh "Nhà của Nhím" để nghe cả nhà khen.

## Lệnh khác

| Lệnh | Làm gì |
|---|---|
| `pnpm dev` | chạy bản dev, tự tải lại khi sửa code |
| `pnpm build` | build bản chạy thật ra thư mục `dist/` |
| `pnpm preview` | chạy thử bản `dist/` (http://localhost:4173) |
| `pnpm audio` | sinh giọng đọc còn thiếu từ `scripts/audio-manifest.txt` (chỉ macOS). Đổi câu thì xoá file `public/audio/<key>.m4a` cũ rồi chạy lại |

Bản `dist/` là web tĩnh: chép lên bất kỳ host tĩnh nào (Netlify, Vercel, GitHub Pages…) là chạy.

## Ảnh và giọng gia đình

- Ảnh thật: thả ảnh vuông vào `public/family/` tên `ba-cuong.jpg`, `me-yen.jpg`, `ba-tuyet.jpg`, `ong-cuong.jpg`, `bac-hanh.jpg`. Thiếu ảnh nào thì người đó hiện emoji.
- Giọng thật: ghi âm rồi lưu đè file `.m4a` cùng tên trong `public/audio/`.

## Link nhảy nhanh (dành cho ba mẹ / soát lỗi)

Game này không có link nhảy riêng; xem `README.md` để biết cách thêm con vật / từ mới.

Chi tiết cấu trúc code xem `README.md`.

## Lưu ý

Nhân vật Disney / My Little Pony trong game là model 3D do fan làm (xem `CREDITS.md`), chỉ để chơi trong nhà, không dùng thương mại.
