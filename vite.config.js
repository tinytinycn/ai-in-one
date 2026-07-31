import { defineConfig } from "vite";

// Tauri 期望固定端口 + 清屏关闭 (便于查看 Rust 日志)
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/target/**"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
