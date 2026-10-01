# Đảo Bé Học (dự án 1/3: Three.js diorama)

Game web cho bé 5 tuổi: chạm con vật để nghe tên + đánh vần theo mẫu lớp 1, và đếm táo 1–10.
Style: đảo isometric low-poly pastel, camera cố định, chỉ tap, không chữ hướng dẫn, không màn thua.

## Chạy

```bash
pnpm install
pnpm dev        # http://localhost:5173 (thêm --host để mở trên iPad cùng Wi-Fi)
pnpm build      # ra dist/, host tĩnh ở đâu cũng được
pnpm audio      # sinh lại audio từ scripts/audio-manifest.txt (macOS, giọng Linh)
```

Trên iPad: mở Safari → Share → "Add to Home Screen" để chạy full màn hình.

## Cách chơi

| Nút | Làm gì |
|---|---|
| 🐄 | Chế độ đánh vần. Chạm con vật: nó nhảy, thẻ chữ hiện, đọc "con bò" rồi "bờ – o – bo – huyền – bò", chữ tô cam theo từng token, xong tô xanh. |
| ❓ | Đố 4 câu "Con nào là con bò?". Đúng: nhảy + đánh vần. Sai: lắc nhẹ + "thử lại nhé", hỏi lại. Xong 4 câu: pháo giấy. |
| 🍎 | Chế độ đếm. Táo hiện trên cỏ, chạm từng quả nghe "một, hai, ba…", bộ đếm cam nhảy số. Đủ rồi thì hiện 3 số to, chạm số đúng: pháo giấy, táo bay đi, vòng mới. 3 vòng đầu 1–5, sau đó 3–10. |
| 🔊 | Nghe lại câu hỏi hiện tại. |

## Cấu trúc

```
index.html          UI DOM đè lên canvas (nút to kiểu sticker, thẻ chữ, bộ đếm, pháo giấy)
src/main.ts         boot: load model, mở khoá audio ở lần chạm đầu, điều phối 2 chế độ
src/scene.ts        Three.js: camera orthographic, đèn + bóng (PCFShadowMap, r186), đảo, props, loader GLB, raycast, tween nhảy/lắc/nảy
src/spell.ts        chế độ đánh vần (khám phá + đố)
src/count.ts        chế độ đếm
src/audio.ts        WebAudio: unlock iPad, preload, play, speakSequence
src/ui.ts           helper DOM
src/data.ts         palette, con vật + token đánh vần, vị trí táo
src/tween.ts        tween tối giản
scripts/            gen-audio.sh + audio-manifest.txt (key|text)
public/models/      GLB: Kenney Nature Kit + Food Kit (CC0), 4 con vật Quaternius qua poly.pizza (CC0)
public/audio/       m4a giọng Linh + 4 sfx Kenney (CC0)
```

## Thêm con vật / từ mới

1. Thả GLB vào `public/models/`.
2. Thêm 1 entry vào `ANIMALS` trong `src/data.ts` (id, model, word, height, tokens, pos, rotY).
3. Thêm vào `scripts/audio-manifest.txt`: `name_<id>|con …`, `ask_<id>|Con nào là con …?`, `t_<id>_1..n|…` rồi `pnpm audio`.

Token đánh vần theo GDPT 2018: âm đầu – vần – ghép – thanh – từ. Dùng tên âm (bờ, cờ), không dùng tên chữ (bê, xê).

## Giấy phép assets

- Kenney (kenney.nl): CC0.
- Quaternius (qua poly.pizza): CC0.
- Font Baloo 2: OFL (Google Fonts).
- Giọng Linh: giọng hệ thống macOS, dùng cá nhân.

## Đã biết / chưa làm

- Chưa test trên iPad thật (audio unlock, kích thước nút). Xem `../research/report.md` mục 9.
- Giọng máy đọc token lẻ ("bờ", "huyền") cần bố mẹ nghe duyệt; thay file cùng tên trong `public/audio/` nếu muốn dùng giọng thật.
- Chưa có màn hình dọc tối ưu (đã co frustum nhưng chưa chỉnh UI).
- Chưa lưu tiến độ, chưa có chế độ so sánh nhiều/ít, tách gộp (mục 4b report).
