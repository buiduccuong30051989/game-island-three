# Đảo Bé Học (dự án 1/3: Three.js diorama)

Game web cho Nhím (Hà An, 5 tuổi): chạm con vật để nghe tên + đánh vần theo mẫu lớp 1, và đếm táo 1–10.
Style: đảo isometric low-poly pastel, camera cố định, chỉ tap, không chữ hướng dẫn, không màn thua.

Đảo là nhà của Nhím: màn chào "Chào Nhím!", cả nhà (Ba Cường, Mẹ Yến, Bà Tuyết, Ông Cương, Bác Hanh) sống trong
ngôi nhà có ống khói và bảng ảnh "Nhà của Nhím", hai bé mèo Mun (đen) và Rơm (vàng cam) chạy chơi cùng bò, heo, gà, chó.

## Chạy

```bash
pnpm install
pnpm dev        # http://localhost:5173 (thêm --host để mở trên iPad cùng Wi-Fi)
pnpm build      # ra dist/, host tĩnh ở đâu cũng được
pnpm audio      # sinh clip còn thiếu từ scripts/audio-manifest.txt (macOS, giọng Linh); FORCE=1 pnpm audio = sinh lại hết
```

Trên iPad: mở Safari → Share → "Add to Home Screen" để chạy full màn hình.

## Cách chơi

| Nút | Làm gì |
|---|---|
| 🦔 | Màn chào "Chào Nhím!" – chạm để vào đảo (mở tiếng trên iPad). |
| 🐄 | Chế độ đánh vần. Chạm con vật: nó dừng lại, quay mặt ra bé, nhảy, thẻ chữ hiện, đọc "con bò" rồi "bờ – o – bo – huyền – bò", chữ tô cam theo từng token, xong tô xanh. Mèo: "Mèo Mun đây!" / "Mèo Rơm đây!" rồi "e – o – eo – mờ – eo – meo – huyền – mèo". Cứ 4 lần nghe đánh vần thì 1 người nhà khen. |
| ❓ | Đố 4 câu "Con nào là con bò?" / "Con nào là mèo Mun?". Đúng: lấp lánh + nhảy + khen ("Đúng rồi, Nhím ơi!") + đánh vần; câu 1 và 3 có người nhà khen. Sai: lắc nhẹ + "thử lại nhé", hỏi lại. Xong 4 câu: pháo giấy + cả nhà lần lượt cổ vũ. |
| 🍎 | Chế độ đếm. Cây táo rung, táo rơi xuống cỏ nảy nảy; chạm từng quả nghe "một, hai, ba…", bộ đếm cam nhảy số. Đủ rồi thì hiện 3 số to, chạm số đúng: pháo giấy, táo bay đi, 1 người nhà khen, vòng mới. 3 vòng đầu 1–5, sau đó 3–10. |
| 🔊 | Nghe lại câu hỏi hiện tại. |
| Bảng ảnh | Chạm bảng "Nhà của Nhím" cạnh nhà: "Đây là nhà của Nhím!…" rồi 1 người nhà khen. |

Đảo sống động (nhẹ nhàng, không rối):
- Con vật tự đi dạo (clip Walk khi đi, Idle khi đứng; heo không có clip đi nên lạch bạch bằng code), quay đầu mượt, né nhà / cây / hàng rào / mép đảo / nhau, thỉnh thoảng ăn cỏ, nhảy, múa (`src/life.ts`).
- Mây trôi, chim bay ngang theo đàn, 3 con bướm, sóng lăn tăn quanh bờ + nước lấp lánh, cây và bụi đung đưa, khói ống khói, tim bay trước cửa nhà khi người nhà khen (`src/ambient.ts`).
- Bé ngồi im 10 s: "Nhím chạm vào con vật nào đó đi!" + bàn tay 👇 nhún trên 1 con vật (đếm: trên 1 quả táo chưa đếm; đang đố: đọc lại câu hỏi). Lần sau giãn ra 20 s, 35 s; chạm bất kỳ là reset.

## Gia đình

- Câu khen ở `FAMILY` (`src/family.ts`, chữ trên bong bóng) + dòng `fam_*` trong `scripts/audio-manifest.txt` (câu đọc). Túi xáo trộn: đủ 5 người mới lặp.
- **Ảnh thật thay emoji**: thả ảnh vuông (~400×400) vào `public/family/` đúng tên `ba-cuong.jpg`, `me-yen.jpg`, `ba-tuyet.jpg`, `ong-cuong.jpg`, `bac-hanh.jpg` (nhận cả .jpeg/.png/.webp). Ảnh hiện trên bong bóng khen và trên bảng ảnh cạnh nhà; thiếu ảnh nào thì người đó dùng emoji. Danh sách ảnh do `vite.config.ts` quét (module ảo `virtual:family-photos`) nên không có lỗi 404; đang `pnpm dev` thì thêm/xoá ảnh trang tự tải lại.
- Đổi câu: sửa cả 2 chỗ trên, xoá m4a cũ cùng tên, chạy `pnpm audio`.

## Cấu trúc

```
index.html          UI DOM đè lên canvas (nút to kiểu sticker, thẻ chữ, bộ đếm, pháo giấy)
src/main.ts         boot: load model, mở khoá audio ở lần chạm đầu, điều phối 2 chế độ, gợi ý khi ngồi im, chạm bảng ảnh
src/scene.ts        Three.js: camera orthographic, đèn + bóng (PCFShadowMap, r186), đảo, nhà + ống khói, bảng ảnh, cây táo, props, loader GLB, raycast, tween nhảy/lắc/nảy/táo rơi, cây đung đưa
src/life.ts         con vật đi dạo, né vật cản, làm trò, quay ra bé khi được chạm
src/ambient.ts      mây, chim, bướm, sóng, lấp lánh nước, khói, tim, hạt lấp lánh
src/family.ts       gia đình Nhím: bong bóng khen + giọng, bảng ảnh "Nhà của Nhím"
src/spell.ts        chế độ đánh vần (khám phá + đố)
src/count.ts        chế độ đếm
src/audio.ts        WebAudio: unlock iPad, preload, play, speakSequence
src/ui.ts           helper DOM
src/data.ts         palette, con vật + token đánh vần, vị trí táo
src/tween.ts        tween tối giản
scripts/            gen-audio.sh + audio-manifest.txt (key|text)
public/models/      GLB: Kenney Nature Kit + Food Kit (CC0), 5 con vật Quaternius qua poly.pizza (CC0; cat.glb = "Cat" poly.pizza/m/2f54vbV0In, đổi màu Mun/Rơm bằng tint trong data.ts)
public/family/      ảnh gia đình (tuỳ chọn, xem mục Gia đình)
public/audio/       m4a giọng Linh + 4 sfx Kenney (CC0)
```

## Thêm con vật / từ mới

1. Thả GLB vào `public/models/`.
2. Thêm 1 entry vào `ANIMALS` trong `src/data.ts` (id, model, word, height, tokens, pos, rotY, walk/speed/acts cho đi dạo, tint nếu muốn đổi màu).
3. Thêm vào `scripts/audio-manifest.txt`: `name_<id>|con …`, `ask_<id>|Con nào là con …?`, `t_<id>_1..n|…` rồi `pnpm audio`.

Token đánh vần theo GDPT 2018: âm đầu – vần – ghép – thanh – từ. Dùng tên âm (bờ, cờ), không dùng tên chữ (bê, xê).

## Giấy phép assets

- Kenney (kenney.nl): CC0.
- Quaternius (qua poly.pizza): CC0 (bò, heo, gà, chó, mèo).
- Font Baloo 2: OFL (Google Fonts).
- Giọng Linh: giọng hệ thống macOS, dùng cá nhân.

## Đã biết / chưa làm

- Chưa test trên iPad thật (audio unlock, kích thước nút). Xem `../research/report.md` mục 9.
- Giọng máy đọc token lẻ ("bờ", "huyền") cần bố mẹ nghe duyệt; thay file cùng tên trong `public/audio/` nếu muốn dùng giọng thật.
- Chưa có màn hình dọc tối ưu (đã co frustum nhưng chưa chỉnh UI).
- Chưa lưu tiến độ, chưa có chế độ so sánh nhiều/ít, tách gộp (mục 4b report).
