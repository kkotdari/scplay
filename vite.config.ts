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
    /* ★ 워커 번들의 `process.env.NODE_ENV`(지적: 폰에서 "Can't find variable: process") — 워커에는 react가
       통째로 묶이고 그 안의 `process.env.NODE_ENV` 검사는 라이브러리 모드에서 그대로 남는다. 메인 번들에서는
       소비자(scplayer)의 번들러가 바꿔 주지만 워커는 **문자열(base64)로 인라인**돼 손이 안 닿는다 — 워커에는
       `process`가 없으니(브라우저) 첫 줄에서 던지고 프레임이 영영 안 온다. 여기서 박아 둔다. 메인 번들은 react가
       external이라 이 치환이 닿는 곳이 없다. (perf-check는 제 번들에 같은 define을 두어 이 구멍이 안 보였다.) */
    "process.env.NODE_ENV": JSON.stringify("production"),
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
