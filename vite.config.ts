import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Ảnh gia đình: quét public/family/<id>.(jpg|jpeg|png|webp) → module ảo 'virtual:family-photos' = { id: tên file }.
 * Game chỉ tải ảnh có thật (không gọi thử file thiếu → không lỗi 404 trong console).
 * Dev: thêm / xoá ảnh là trang tự tải lại.
 */
function familyPhotos(): Plugin {
  const VID = 'virtual:family-photos';
  const RID = '\0' + VID;
  const dir = fileURLToPath(new URL('./public/family', import.meta.url));
  const scan = (): Record<string, string> => {
    const map: Record<string, string> = {};
    if (!fs.existsSync(dir)) return map;
    for (const f of fs.readdirSync(dir).sort()) {
      const m = /^([a-z-]+)\.(jpe?g|png|webp)$/i.exec(f);
      if (m && !map[m[1].toLowerCase()]) map[m[1].toLowerCase()] = f;
    }
    return map;
  };
  return {
    name: 'family-photos',
    resolveId(id) { return id === VID ? RID : undefined; },
    load(id) { return id === RID ? `export default ${JSON.stringify(scan())};` : undefined; },
    configureServer(server) {
      server.watcher.add(dir);
      const onChange = (file: string) => {
        if (!file.startsWith(dir)) return;
        const mod = server.moduleGraph.getModuleById(RID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

// three.js ~600 kB là bình thường cho game 3D chơi offline trong nhà.
export default defineConfig({
  plugins: [familyPhotos()],
  server: { port: 5173, host: true },
  build: { chunkSizeWarningLimit: 1200 },
});
