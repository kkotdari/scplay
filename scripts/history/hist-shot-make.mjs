/* 옛 시대의 model-shot 사본 짓기 — 변천사의 7월·8/29 열을 굽는 도구를 그 시대 작업 트리 안에 낸다.
 *
 *   node scripts/history/hist-shot-make.mjs <작업트리> [--from <템플릿트리>]
 *     → <작업트리>/scripts/hist-shot.mjs
 *
 * 왜 사본인가: 그 시대의 model-shot 에는 변천사가 쓰는 세 손잡이가 없다 — `--fit`(칸마다 잉크 상자를
 * 칸의 그 몫에 맞추기) · `--shadow`(그 시대 재생기의 접지 타원) · 새 헤드리스 되물림. 옛 커밋을 고칠
 * 수는 없으니 그 트리 안에 사본을 둔다(작업 트리는 스크래치의 것이라 저장소에 안 남는다).
 *
 * ⚠ 7월 트리(stargayte 8ddd494)에는 `lodFilter`·`bake` 가 아직 없다 — 그 둘을 쓰는 줄은 빼고 굽는다
 *   (이 자가 알아서 가른다: 그 트리의 shapeOblique 가 lodFilter 를 안 내면 옛 진입점으로 짓는다). */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const WT = process.argv[2];
if (!WT) { console.error("usage: hist-shot-make.mjs <작업트리> [--from <템플릿트리>]"); process.exit(1); }
/* ⚠ 7월 트리(8/14)에는 model-shot.mjs 가 아직 없다(8/20 에 들어왔다) — 그때는 **같은 저장소의 나중
   판**을 본으로 준다(`--from`). 본 안의 ROOT 는 제가 놓이는 자리에서 나므로 트리를 안 탄다. */
const fi = process.argv.indexOf("--from");
const FROM = fi > 0 ? process.argv[fi + 1] : WT;
const src = join(FROM, "scripts/model-shot.mjs");
if (!existsSync(src)) { console.error("model-shot.mjs 가 없다:", src); process.exit(1); }
let s = readFileSync(src, "utf8");

/* ① 새 손잡이 둘 */
const i = s.indexOf('const OUT = String(flag("--out"');
const j = s.indexOf("\n", i) + 1;
s = `${s.slice(0, j)}const FIT = Number(flag("--fit", 0));        // >0 이면 칸마다 잉크 상자를 칸의 이 몫에 맞춘다
const SHADOW = argv.includes("--shadow");     // 그 시대 재생기의 접지 타원
${s.slice(j)}`;

/* ② 그리개를 통째로 갈아 끼운다 */
const NEW = `function inBrowser({ KINDS, ROTS, MODE, CELL, LOD, BG, COLOR, FIT, SHADOW }) {
  const shadeBoost = (o, fill) => (fill ? Math.min(0.85, o * 1.45) : o);
  const cols = ROTS.length; const rows = KINDS.length; const PAD = 26;
  const cv = document.createElement("canvas");
  cv.width = cols * CELL; cv.height = rows * CELL + PAD;
  const c = cv.getContext("2d");
  c.fillStyle = BG; c.fillRect(0, 0, cv.width, cv.height);
  c.font = "13px ui-monospace, monospace"; c.textBaseline = "top";
  c.fillStyle = "#9aa4b0";
  ROTS.forEach((r, i) => c.fillText(\`\${r}\\u00b0\`, i * CELL + 8, 6));
  /* 잉크 상자는 딴 판에서 잰다 — 칸은 클립이 걸려 밖으로 나간 몸을 못 잰다. */
  const MK = 16; const MS = 512; const OX = MS / 2 - 8 * MK; const OY = MS / 2 - 12 * MK;
  const mz = document.createElement("canvas"); mz.width = MS; mz.height = MS;
  const mc = mz.getContext("2d", { willReadFrequently: true });
  const paint = (ctx, faces) => {
    for (const f of faces) {
      ctx.globalAlpha = shadeBoost(f[1], f[2]);
      ctx.fillStyle = f[2] ?? COLOR;
      try { ctx.fill(new Path2D(f[0])); } catch (e) { /* 못 읽는 패스는 건너뛴다 */ }
    }
    ctx.globalAlpha = 1;
  };
  KINDS.forEach((k, r) => {
    ROTS.forEach((rot, i) => {
      const faces = window.__bake(k, rot, MODE, LOD, 0, false, 0, 0);
      const x0 = i * CELL; const y0 = r * CELL + PAD;
      c.save();
      c.strokeStyle = "rgba(0,0,0,.10)";
      c.strokeRect(x0 + 0.5, y0 + 0.5, CELL - 1, CELL - 1);
      c.beginPath(); c.rect(x0, y0, CELL, CELL); c.clip();
      if (faces) {
        let bx = null;
        if (FIT > 0) {
          mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, MS, MS);
          mc.save(); mc.translate(OX, OY); mc.scale(MK, MK); paint(mc, faces); mc.restore();
          const d = mc.getImageData(0, 0, MS, MS).data;
          let a0 = 1e9; let a1 = -1; let b0 = 1e9; let b1 = -1;
          for (let y = 0; y < MS; y += 1) for (let x = 0; x < MS; x += 1) {
            if (d[(y * MS + x) * 4 + 3] < 12) continue;
            if (x < a0) a0 = x; if (x > a1) a1 = x; if (y < b0) b0 = y; if (y > b1) b1 = y;
          }
          if (a1 >= 0) bx = {
            cx: ((a0 + a1) / 2 - OX) / MK, cy: ((b0 + b1) / 2 - OY) / MK,
            w: (a1 - a0 + 1) / MK, h: (b1 - b0 + 1) / MK, bot: (b1 - OY) / MK,
          };
        }
        const s = bx ? Math.min((FIT * CELL) / bx.w, (FIT * CELL) / bx.h) : CELL / 16;
        if (SHADOW && bx) {
          /* 접지 타원 — 폭은 **잉크 폭에 가깝게**(0.46) 잡고 발밑에 **깔린다**: 타원 가운데를
             잉크 바닥보다 제 반높이만큼 위에 두어야 몸이 그 위에 앉은 것으로 읽힌다(가운데를
             바닥에 두면 아래 반이 몸 밖으로 나가 '떠 있는' 꼴이 된다 · 지적). */
          const rx = bx.w * s * 0.46; const ry = rx * 0.30;
          const sy = y0 + CELL / 2 + (bx.bot - bx.cy) * s - ry;
          c.save(); c.globalAlpha = 0.3; c.fillStyle = "#000";
          c.beginPath(); c.ellipse(x0 + CELL / 2, sy, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.restore();
        }
        c.save();
        if (bx) { c.translate(x0 + CELL / 2, y0 + CELL / 2); c.scale(s, s); c.translate(-bx.cx, -bx.cy); }
        else { c.translate(x0, y0); c.scale(s, s); }
        paint(c, faces);
        c.restore();
      }
      c.restore();
      c.globalAlpha = 1;
      c.fillStyle = "#9aa4b0";
      if (i === 0) c.fillText(k, x0 + 8, y0 + 6);
    });
  });
  return cv.toDataURL("image/png");
}
`;
const a = s.indexOf("function inBrowser(");
const b = s.indexOf("\nconst js = bundle();");
s = s.slice(0, a) + NEW + s.slice(b);

/* ③ evaluate 인자 */
s = s.replace(/page\.evaluate\(inBrowser, \{[^}]*\}\)/,
  "page.evaluate(inBrowser, { KINDS, ROTS, MODE, CELL, LOD, BG, COLOR, FIT, SHADOW })");

/* ④ 새 헤드리스 — 옛 도구는 그 되물림이 없어 그냥 안 뜬다 */
s = s.replace(`const browser = await chromium.launch(
  exe ? { executablePath: exe, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] },
);`, `const browser = await chromium.launch(exe
  ? { executablePath: exe, headless: false, args: ["--headless=new", "--no-sandbox", "--no-proxy-server"] }
  : { headless: false, args: ["--headless=new", "--no-sandbox", "--no-proxy-server"] });`);

/* ⑤ 7월 트리에는 lodFilter·bake 가 없다 — 진입점을 그 시대의 것으로 */
const so = readFileSync(join(WT, "src/utils/shapeOblique.ts"), "utf8");
if (!/export (function|const) lodFilter/.test(so)) {
  s = s.replace("import { lodFilter, withPitchView, withTopView, withViewShear, withYaw, bake, zsorted }",
    "import { withPitchView, withTopView, withViewShear, withYaw, zsorted }");
  s = s.replace("  const bake0 = () => bake(() => withViewShear(0, () => withYaw(-rot, builder)));",
    "  const bake0 = () => withViewShear(0, () => withYaw(-rot, builder));");
  s = s.replace("return all ? zsorted(lodFilter(all, lod)) : null;", "return all ? zsorted(all) : null;");
}

const out = join(WT, "scripts/hist-shot.mjs");
writeFileSync(out, s);
console.log("→", out, `${s.length}자`);
