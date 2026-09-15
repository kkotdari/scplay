#!/usr/bin/env node
/* GL 붓 전수조사 — 종류마다 같은 칸에 2D(캔버스 면 그리기, model-shot 과 같은 식)와 GL(gl9 메시)을 그려 견주고 어긋남을 잰다.
   node scripts/gl-check.mjs [--kinds a,b] [--rots 45,225] [--cell 160] [--worst 40] [--out <scratch>/glcheck.png] [--json out.json]
   자: 실루엣 IoU(배경 아닌 화소의 교집합/합집합) · 겹친 자리의 평균 색차(0~1) · 나쁨 = (1−IoU) + 색차. 나쁜 순으로 표를 찍고,
   위 N 종류를 [2D, GL] 짝으로 시트에 담는다. 유닛은 자세 0, 건물은 불빛·회전 0·기본 단계다(둘 다 같은 깃발). */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const KINDS = flag("--kinds", null) ? String(flag("--kinds")).split(",") : null;
const ROTS = String(flag("--rots", "45,225")).split(",").map(Number);
const CELL = Number(flag("--cell", 160));
const WORST = Number(flag("--worst", 40));
const OUT = String(flag("--out", join(tmpdir(), "glcheck.png")));
const JSON_OUT = flag("--json", null);
const BG = "#20242b";
const COLOR = "#4aa3ff";

const ENTRY = `
import { SHAPE_BUILDERS, SHAPE_GALLERY, poseSet9, bldLitSet, headYawSet, bldSpinRawSet9, tone9, silhouetteLight, DECAL_KINDS } from ${JSON.stringify(join(ROOT, "src/components/replay/bake9"))};
import { withTopView, withViewShear, withYaw, bake, zsorted } from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
import { GlUnits9, CAM_TOP9, GL_CANVAS_KINDS9 } from ${JSON.stringify(join(ROOT, "src/components/replay/gl9"))};
const BLD = new Set(SHAPE_GALLERY.filter((g) => g.group === "건물").map((g) => g.kind));
window.__kinds = () => Object.keys(SHAPE_BUILDERS);
window.__run = (kinds, rots, cell, bg, color) => {
  const shadeBoost = (o, fill) => (fill && o < 1 ? Math.min(0.85, o * 1.45) : o);
  const cols = rots.length; const rows = kinds.length;
  // GL: 한 캔버스에 칸마다 개체 하나
  // GL: 종류(줄)마다 따로 그려 제 칸만 옮겨 담는다 — 한 캔버스에 다 그리면 큰 모델(그레이터 스파이어)이 이웃 칸으로 넘친다.
  const gcv = document.createElement("canvas"); gcv.width = cols * cell; gcv.height = cell;
  const g = new GlUnits9(gcv);
  const k = cell / 16;
  const errs = {};
  const gl2 = document.createElement("canvas"); gl2.width = cols * cell; gl2.height = rows * cell;
  const gx = gl2.getContext("2d"); gx.fillStyle = bg; gx.fillRect(0, 0, gl2.width, gl2.height);
  kinds.forEach((kind, r) => {
    const isB = BLD.has(kind) || DECAL_KINDS.has(kind);
    rots.forEach((rot, i) => {
      let m = null;
      try {
        m = isB ? g.bldMesh({ kind, fx: 0, fy: 0, z: 0, sizePx: 16, color, alpha: 1, rotDeg: rot }, 3) : g.unitMesh(kind, 0, 3);
      } catch (e) { errs[kind] = String(e).slice(0, 80); }
      if (!m) return;
      g.push({ mesh: m, ax: i * cell + cell / 2, ay: cell / 2, k, yoff: k * 4, yawDeg: -rot, color, alpha: 1, cam: CAM_TOP9, gradR: cell * 0.707, gradCy: 0 });
    });
    g.flush(gcv.width, gcv.height, gcv.width, gcv.height);
    gx.drawImage(gcv, 0, r * cell);
  });
  // 2D: model-shot 과 같은 식(면 채우기 + tone9 + 실루엣 빛; 글로우는 뺀다)
  const cv2 = document.createElement("canvas"); cv2.width = cols * cell; cv2.height = rows * cell;
  const c2 = cv2.getContext("2d"); c2.fillStyle = bg; c2.fillRect(0, 0, cv2.width, cv2.height);
  kinds.forEach((kind, r) => {
    const b = SHAPE_BUILDERS[kind]; if (!b) return;
    rots.forEach((rot, i) => {
      poseSet9(0); bldLitSet(false); headYawSet(0); bldSpinRawSet9(0);
      let faces = null;
      try { faces = zsorted(withTopView(() => bake(() => withViewShear(0, () => withYaw(-rot, b))))); } catch (e) { errs[kind] = String(e).slice(0, 80); }
      if (!faces) return;
      const pc = document.createElement("canvas"); pc.width = cell; pc.height = cell;
      const p2 = pc.getContext("2d"); p2.save(); p2.scale(k, k);
      for (const f of faces) { p2.globalAlpha = shadeBoost(f[1], f[2]); p2.fillStyle = tone9(f[2] ?? color); try { p2.fill(new Path2D(f[0])); } catch (e) { /* */ } }
      p2.globalAlpha = 1; silhouetteLight(p2, pc, { x: 0, y: 0, w: cell, h: cell }); p2.restore();
      c2.drawImage(pc, i * cell, r * cell);
    });
  });
  // 재기
  const A = c2.getImageData(0, 0, cv2.width, cv2.height).data;
  const B = gx.getImageData(0, 0, gl2.width, gl2.height).data;
  const bgc = [parseInt(bg.slice(1, 3), 16), parseInt(bg.slice(3, 5), 16), parseInt(bg.slice(5, 7), 16)];
  const isBg = (d, o) => Math.abs(d[o] - bgc[0]) + Math.abs(d[o + 1] - bgc[1]) + Math.abs(d[o + 2] - bgc[2]) < 18;
  const out = [];
  kinds.forEach((kind, r) => {
    let inter = 0, uni = 0, cdiff = 0, nA = 0, nB = 0, lumA = 0, lumB = 0;
    rots.forEach((rot, i) => {
      for (let y = 0; y < cell; y += 1) for (let x = 0; x < cell; x += 1) {
        const o = ((r * cell + y) * cv2.width + (i * cell + x)) * 4;
        const a = !isBg(A, o), bb = !isBg(B, o);
        if (a) nA += 1; if (bb) nB += 1;
        if (a || bb) uni += 1;
        if (a && bb) {
          inter += 1; cdiff += (Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2])) / 765;
          lumA += 0.2126 * A[o] + 0.7152 * A[o + 1] + 0.0722 * A[o + 2]; lumB += 0.2126 * B[o] + 0.7152 * B[o + 1] + 0.0722 * B[o + 2];
        }
      }
    });
    const iou = uni ? inter / uni : 1; const cd = inter ? cdiff / inter : 0;
    const canvas = GL_CANVAS_KINDS9.has(kind);
    out.push({ kind, iou, cd, bad: canvas ? 0 : (1 - iou) + cd, lumK: lumA > 0 ? lumB / lumA : 1, nA, nB, canvas, err: errs[kind] ?? null });
  });
  return { rows: out, a: cv2.toDataURL("image/png"), b: gl2.toDataURL("image/png") };
};
window.__sheet = (pairs, cell, rots, bg) => {
  // pairs: [{kind, aImg(dataURL), bImg, row}] — [2D, GL] 짝을 rot 마다 나란히
  return new Promise((res) => {
    const imgs = {}; let left = 0;
    const load = (src) => new Promise((r) => { if (imgs[src]) return r(imgs[src]); const im = new Image(); im.onload = () => { imgs[src] = im; r(im); }; im.src = src; });
    Promise.all(pairs.map((p) => Promise.all([load(p.a), load(p.b)]))).then((ims) => {
      const PAD = 22; const cols = rots.length * 2;
      const cv = document.createElement("canvas"); cv.width = cols * cell; cv.height = pairs.length * (cell + PAD);
      const c = cv.getContext("2d"); c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
      c.font = "12px ui-monospace, monospace"; c.textBaseline = "top";
      pairs.forEach((p, r) => {
        const [ia, ib] = ims[r]; const y = r * (cell + PAD);
        rots.forEach((rot, i) => {
          c.drawImage(ia, i * cell, p.row * cell, cell, cell, (i * 2) * cell, y + PAD, cell, cell);
          c.drawImage(ib, i * cell, p.row * cell, cell, cell, (i * 2 + 1) * cell, y + PAD, cell, cell);
          c.strokeStyle = "rgba(255,255,255,.15)"; c.strokeRect((i * 2) * cell + 0.5, y + PAD + 0.5, cell * 2 - 1, cell - 1);
          c.fillStyle = "#9aa4b0"; c.fillText(rot + "° 2D", (i * 2) * cell + 4, y + 6); c.fillText("GL", (i * 2 + 1) * cell + 4, y + 6);
        });
        c.fillStyle = "#ffd070"; c.fillText(p.label, 4 + cell * 0.45, y + 6);
      });
      res(cv.toDataURL("image/png"));
    });
  });
};
`;
const dir = mkdtempSync(join(tmpdir(), "glcheck-"));
const src = join(dir, "entry.ts"); const outJs = join(dir, "entry.mjs");
writeFileSync(src, ENTRY);
execFileSync(process.execPath, [join(ROOT, "node_modules/esbuild/bin/esbuild"), src, "--bundle", "--format=esm", "--log-level=error",
  "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${outJs}`], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
const js = readFileSync(outJs, "utf8"); rmSync(dir, { recursive: true, force: true });
const { chromium } = await import("playwright-core");
const exe = ["/opt/pw-browsers/chromium", join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")].find((p) => existsSync(p));
const launchOpt = exe ? { executablePath: exe, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] };
const browser = await chromium.launch(launchOpt).catch(async (e) => {
  if (!/headless|closed/i.test(String(e))) throw e;
  return chromium.launch({ ...launchOpt, headless: false, args: [...launchOpt.args, "--headless=new", "--no-sandbox"] });
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("페이지 오류:", String(e).slice(0, 300)));
await page.route("http://gl-check.local/*", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><meta charset=utf-8><body>" }));
await page.goto("http://gl-check.local/");
await page.addScriptTag({ content: js, type: "module" });
await page.waitForFunction("!!window.__run");
const kinds = KINDS ?? await page.evaluate(() => window.__kinds());
const CHUNK = 20;
const rows = []; const sheets = [];
for (let i = 0; i < kinds.length; i += CHUNK) {
  const part = kinds.slice(i, i + CHUNK);
  const r = await page.evaluate(([ks, rots, cell, bg, color]) => window.__run(ks, rots, cell, bg, color), [part, ROTS, CELL, BG, COLOR]);
  r.rows.forEach((row, j) => { rows.push({ ...row, chunk: sheets.length, row: j }); });
  sheets.push({ a: r.a, b: r.b });
}
rows.sort((p, q) => q.bad - p.bad);
console.log("종류            나쁨   IoU   색차  밝기비   2D화소  GL화소");
for (const r of rows) console.log(`${r.kind.padEnd(16)} ${r.bad.toFixed(2)}  ${r.iou.toFixed(2)}  ${r.cd.toFixed(2)}  ${r.lumK.toFixed(2)}   ${String(r.nA).padStart(6)} ${String(r.nB).padStart(6)}${r.canvas ? "  (캔버스)" : ""}${r.err ? "  ⚠ " + r.err : ""}`);
const live = rows.filter((r) => !r.canvas);
const avg = live.reduce((a, r) => a + r.bad, 0) / Math.max(1, live.length);
const lum = live.reduce((a, r) => a + r.lumK, 0) / Math.max(1, live.length);
console.log(`— ${live.length}종(캔버스 ${rows.length - live.length} 제외) · 평균 나쁨 ${avg.toFixed(3)} · 평균 밝기비(GL/2D) ${lum.toFixed(3)} · 나쁨 0.5 넘는 종류 ${live.filter((r) => r.bad > 0.5).length}`);
if (JSON_OUT) writeFileSync(String(JSON_OUT), JSON.stringify(rows, null, 1));
const worst = rows.filter((r) => !r.canvas).slice(0, WORST).map((r) => ({ a: sheets[r.chunk].a, b: sheets[r.chunk].b, row: r.row, label: `${r.kind}  나쁨 ${r.bad.toFixed(2)} (IoU ${r.iou.toFixed(2)} 색차 ${r.cd.toFixed(2)})` }));
const dataUrl = await page.evaluate(([pairs, cell, rots, bg]) => window.__sheet(pairs, cell, rots, bg), [worst, CELL, ROTS, BG]);
await browser.close();
writeFileSync(OUT, Buffer.from(dataUrl.split(",")[1], "base64"));
console.log(`→ ${OUT}`);
