import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

// 라이브러리 빌드 — ESM 하나 + 타입 + styles.css. react 계열은 쓰는 앱의 것을 쓴다(external).
export default defineConfig({
  /* 빌드 표식 — #diag 첫 줄에 박힌다. "그 증상, 어느 판에서 봤나"를 화면이 스스로
     말하게 한다: 배포 직후의 재현 보고가 옛 판에서 온 것인지 새 판인지, 여태 가릴
     길이 없었다. 시각은 이 라이브러리를 실제로 굽는 순간(배포 파이프라인)의 것이다. */
  define: {
    __SCPLAY_BUILD__: JSON.stringify(new Date().toISOString().slice(5, 16).replace("T", " ")),
  },
  plugins: [react(), dts({ rollupTypes: true })],
  /* 프레임 워커(?worker&inline) — 라이브러리 소비자(scplayer)가 워커 파일을 따로 안 챙기게 번들에
     **인라인**한다. 워커 안에는 react가 external일 수 없으므로(빈 지정자를 풀 길이 없다) 워커 번들만은
     전부 묶는다. 모듈 형식이라 ReplayMotionPlayer를 그대로 import한다. */
  worker: {
    format: "es",
    plugins: () => [react()],
    rollupOptions: { external: [] },
  },
  build: {
    lib: {
      entry: "src/components/replay/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "lucide-react"],
      /* 워커 갈래(동적 import)까지 **한 파일**에 넣는다 — 소비자(scplayer)가 청크 하나만 챙기게. */
      output: { assetFileNames: "styles[extname]", inlineDynamicImports: true },
    },
    sourcemap: true,
  },
});
