/* 모델 미리보기 CLI(요청 작업 도구) — 유닛·건물 모델을 실제로 구워 PNG 대조표로 낸다.
 *
 *   node scripts/model-shot.mjs --kinds tank,tanksiege
 *   node scripts/model-shot.mjs --kinds scv --rots 0,45,90,135,180,225,270,315
 *   node scripts/model-shot.mjs --kinds ovie --mode base --out /tmp/ovie.png
 *
 * 왜 필요한가: 모델을 고칠 때마다 "화면에서 어떻게 보이나"를 눈으로 봐야 판정이 된다.
 * model-norm.mjs는 잉크 상자를 **재기만** 하고 그림을 안 남긴다. 같은 굽기 사슬
 * (resolveShapeFaces와 같은 withYaw/withTopView/withPitchView/withViewShear)을 그대로
 * 타되, 잰 값 대신 캔버스를 PNG로 뽑는 것이 이 도구의 몫이다.
 *
 * src/를 그때그때 esbuild로 번들해 헤드리스 크로뮴에서 굽는다 — 개발 서버가 필요 없다. */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(n);
  return i < 0 ? d : (argv[i + 1] ?? true);
};
const KINDS = String(flag("--kinds", "tank")).split(",").filter(Boolean);
const ROTS = String(flag("--rots", "0,45,90,180,270")).split(",").map(Number);
const MODE = String(flag("--mode", "base"));          // base(도록) · top(지도 기본) · pitch
const CELL = Number(flag("--cell", 220));
const LOD = Number(flag("--lod", 3));
const POSE = Number(flag("--pose", 0));          // 0 기본 · 1 이동 컷 · 2 공격 컷
const LIT = argv.includes("--lit");               // 건물 창문에 불 켜기(활성 상태)
const HEAD = Number(flag("--head", 0));           // 포탑부 상대 각(도) — 터렛·포톤·성큰
const SPIN = Number(flag("--spin", 0));           // 도는 부품의 칸(0~7) — 서플라이 팬·코어 디스크
const BG = String(flag("--bg", "#20242b"));
const ZOOM = Number(flag("--zoom", 1));            // 칸 가운데 기준 확대·축소(키 큰 건물은 0.5쯤)
const PAN = String(flag("--pan", "0,0")).split(",").map(Number);   // 확대 뒤 칸 안에서 옮기기(px): 다리를 보려면 0,-120
const COLOR = String(flag("--color", "#4aa3ff"));      // 임자 색(칠 안 한 면에 든다)
const OUT = String(flag("--out", join(tmpdir(), "model-shot.png")));

/* ── 브라우저에 넣을 번들 — model-norm.mjs와 같은 진입점을 쓴다 ─────────────── */
const ENTRY = `
import { SHAPE_BUILDERS, poseSet, bldLitSet, headYawSet, bldSpinSet } from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
import { lodFilter, withPitchView, withTopView, withViewShear, withYaw, bake, zsorted }
  from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
window.__bake = (kind, rot, mode, lod, pose, lit, head, spin) => {
  const builder = SHAPE_BUILDERS[kind];
  if (!builder) return null;
  /* 애니 컷을 눈으로 보려면 자세 깃발이 서 있어야 한다(--pose 0 기본 · 1 이동 · 2 공격)
     — 앱에서는 unitSprite가 op.pose로 세우는 그 값이다. */
  poseSet(pose || 0);
  bldLitSet(!!lit);
  headYawSet(head || 0);
  bldSpinSet(spin || 0);
  const bake0 = () => bake(() => withViewShear(0, () => withYaw(-rot, builder)));
  const bake1 = mode === "pitch" ? () => withPitchView(bake0) : bake0;
  const all = mode === "top" ? withTopView(bake1) : bake1();
  return all ? zsorted(lodFilter(all, lod)) : null;
};
`;

function bundle() {
  const dir = mkdtempSync(join(tmpdir(), "modelshot-"));
  const src = join(dir, "entry.ts");
  const out = join(dir, "entry.mjs");
  writeFileSync(src, ENTRY);
  const ebin = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
  const head = readFileSync(ebin).subarray(0, 4);
  /* 실행 파일 판별 — ELF(리눅스) · MZ(윈도) · Mach-O(맥, cf fa ed fe / 팻 ca fe ba be).
     맥의 매직이 빠져 있어 네이티브 esbuild를 노드로 돌리다 SyntaxError가 났다. */
  const magic = (head[0] << 24 | head[1] << 16 | head[2] << 8 | head[3]) >>> 0;
  const native = magic === 0x7f454c46 || (head[0] === 0x4d && head[1] === 0x5a)
    || magic === 0xcffaedfe || magic === 0xcefaedfe || magic === 0xcafebabe;
  const args = [src, "--bundle", "--format=esm", "--log-level=error",
    "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`];
  execFileSync(native ? ebin : process.execPath, native ? args : [ebin, ...args],
    { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  const js = readFileSync(out, "utf8");
  rmSync(dir, { recursive: true, force: true });
  return js;
}

/** 페이지 안에서 도는 그리개 — 바깥 스코프를 못 보므로 필요한 값은 전부 인자로. */
function inBrowser({ KINDS, ROTS, MODE, CELL, LOD, BG, COLOR, POSE, LIT, HEAD, SPIN, ZOOM, PAN }) {
  /* 앱의 그 함수와 **똑같아야 한다**(ReplayMotionPlayer의 shadeBoost) — `o < 1` 조건이
     여기만 빠져 있어서, 불투명도 1인 몸판까지 0.85로 깔렸다. 그 탓에 이 도구로 뽑은
     모든 그림이 실제보다 비쳐 보였고(부품이 겹친 모델일수록 심하다), 그 그림을 보고
     모델을 고치면 없는 병을 고치게 된다. */
  const shadeBoost = (o, fill) => (fill && o < 1 ? Math.min(0.85, o * 1.45) : o);
  const cols = ROTS.length;
  const rows = KINDS.length;
  const PAD = 26;
  const cv = document.createElement("canvas");
  cv.width = cols * CELL;
  cv.height = rows * CELL + PAD;
  const c = cv.getContext("2d");
  c.fillStyle = BG;
  c.fillRect(0, 0, cv.width, cv.height);
  c.font = "13px ui-monospace, monospace";
  c.textBaseline = "top";
  c.fillStyle = "#dfe3e6";
  ROTS.forEach((r, i) => c.fillText(`${r}°`, i * CELL + 8, 6));
  KINDS.forEach((k, r) => {
    ROTS.forEach((rot, i) => {
      const faces = window.__bake(k, rot, MODE, LOD, POSE, LIT, HEAD, SPIN);
      c.save();
      c.translate(i * CELL, r * CELL + PAD);
      c.strokeStyle = "rgba(255,255,255,.12)";
      c.strokeRect(0.5, 0.5, CELL - 1, CELL - 1);
      c.beginPath();
      c.rect(0, 0, CELL, CELL);
      c.clip();
      c.translate(CELL / 2 + PAN[0], CELL / 2 + PAN[1]); c.scale(ZOOM, ZOOM); c.translate(-CELL / 2, -CELL / 2);
      c.scale(CELL / 16, CELL / 16);
      if (faces) {
        for (const f of faces) {
          c.globalAlpha = shadeBoost(f[1], f[2]);
          c.fillStyle = f[2] ?? COLOR;
          try { c.fill(new Path2D(f[0])); } catch (e) { /* 못 읽는 패스는 건너뛴다 */ }
        }
      }
      c.restore();
      c.globalAlpha = 1;
      c.fillStyle = "#9aa4b0";
      if (i === 0) c.fillText(k, i * CELL + 8, r * CELL + PAD + 6);
    });
  });
  return cv.toDataURL("image/png");
}

const js = bundle();
const { chromium } = await import("playwright-core");
const CANDIDATES = [
  process.env.PW_CHROMIUM,
  "/opt/pw-browsers/chromium",
  join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64",
    "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
const launchOpt = exe
  ? { executablePath: exe, args: ["--no-proxy-server"] }
  : { args: ["--no-proxy-server"] };
/* 새 크로미엄은 옛 헤드리스(--headless=old)를 아예 걷어냈다 — 플레이라이트가 그 깃발을
   붙이는 판이면 창이 열리자마자 죽는다. 그때는 헤드리스를 끄고(headless:false) 새
   헤드리스 깃발을 손으로 붙여 같은 자리에 선다. */
const browser = await chromium.launch(launchOpt).catch(async (e) => {
  if (!/headless/i.test(String(e))) throw e;
  return chromium.launch({
    ...launchOpt, headless: false,
    args: [...launchOpt.args, "--headless=new", "--no-sandbox"],
  });
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("페이지 오류:", String(e).slice(0, 300)));
/* 진짜 오리진이 있어야 한다 — about:blank(불투명 오리진)에서는 번들 안의 localStorage
   접근이 SecurityError로 죽는다. 네트워크는 안 타고 가로채서 빈 문서만 돌려준다
   (model-norm.mjs와 같은 수법). */
await page.route("http://model-shot.local/*", (r) => r.fulfill({
  contentType: "text/html", body: "<!doctype html><meta charset=utf-8><body>",
}));
await page.goto("http://model-shot.local/");
await page.addScriptTag({ content: js, type: "module" });
await page.waitForFunction("!!window.__bake");
const dataUrl = await page.evaluate(inBrowser, { KINDS, ROTS, MODE, CELL, LOD, BG, COLOR, POSE, LIT, HEAD, SPIN, ZOOM, PAN });
await browser.close();
writeFileSync(OUT, Buffer.from(dataUrl.split(",")[1], "base64"));
console.log(OUT);
