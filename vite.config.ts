import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

// 라이브러리 빌드 — ESM 하나 + 타입 + styles.css. react 계열은 쓰는 앱의 것을 쓴다(external).
export default defineConfig({
  plugins: [react(), dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: "src/components/replay/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "lucide-react"],
      output: { assetFileNames: "styles[extname]" },
    },
    sourcemap: true,
  },
});
