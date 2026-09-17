#!/usr/bin/env node
/* **GL 붓 전수조사** — 156종을 GL(gl9 메시)로 한 장에 굽고 눈으로 본다.
   node scripts/model-gl.mjs [--kinds a,b] [--rots 45,225] [--cell 160] [--rows 40] [--out <scratch>/gl.png] [--json out.json] [--vs2d]

   ★★ **자가 바뀌었다**(2026-09, 물음: "이제 gl-check 필요없지 않아? 이전의 2D 캔버스 붓은 더 이상
   기준이 아니고 새로운 세계가 시작됐어") — 옛 자는 2D 캔버스 그림과 GL 그림의 **어긋남**(1−IoU + 색차)
   이었다. 그 자는 이제 틀린 쪽을 가리킨다:
     · 사이언스 베슬의 몸통이 GL 에서 **땅에 누운 판때기**였던 진짜 버그를 고치자 점수가 **나빠졌다**
       (0.14 → 0.21) — 2D 가 그리는 것이 납작한 타원이기 때문이다.
     · 방향광·테두리 빛·광택·결·푸른빛·번짐은 **2D 에 없는 몫**이라, GL 이 좋아질수록 평균이 오른다
       (0.174 → 0.190). 그 0.5 선 때문에 광택 세기를 여러 번 되물렸다 — 없어진 붓에 맞춰 새 붓을 깎은 셈이다.
     · '빠진 부품이 없나'는 이제 `model-mesh --check`(덮임 100%)가 **정확히·1초에** 본다.
   그래서 기본은 **GL 만 그리는 시트**이고, 재는 것은 하나다: **칸마다 실루엣이 있나**
   (빈 칸 = 빌더가 터졌거나 통째로 안 그려졌다 — 그것은 여전히 자동으로 잡을 값어치가 있다).
   2D 폴백(`#gl=0`·도록 SVG)을 감사할 때만 `--vs2d` 로 옛 견줌을 켠다 — 그때도 그 수는
   '**2D 폴백과의 차이**'이지 '나쁨'이 아니다.
   유닛은 자세 0, 건물은 불빛·회전 0·기본 단계다. */
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
/** 건설 단계를 칸으로 늘어놓는다(`--stages 1,2,3,4,0` · 0 = 완성) — 요잉은 `--rots` 의 첫 값 하나로 못 박는다.
 *  stageFaces 의 몫을 눈으로 고를 때 쓴다(단계끼리, 그리고 완성과 얼마나 다른가). */
/** 자세 칸 — 자세로 움직이는 판(시즈 전환 포탑 tankturretxf · 전환 다리)을 한가운데 컷으로 보려면 준다. */
const POSE = Number(flag("--pose", 0));
const STAGES = flag("--stages", null) ? String(flag("--stages")).split(",").map(Number) : null;
/* ★ `--lit` — 건물의 **활성 불빛**을 켠 채 굽는다(2026-09, 요청: 격납구 속 노란 불빛 확인).
   여태 이 자는 늘 꺼진 판만 냈다 — 켜진 자리는 도록 판(doc-sheet --anim)으로만 볼 수 있었고
   그것은 브라우저 한 판에 수십 초가 든다. 불빛도 메시 열쇠(litTag)라 GL 이 그대로 굽는다. */
const LIT = argv.includes("--lit");
/** 칸의 머리글 — 단계 보기에서는 "N단", 아니면 "N°". */
const COLS = STAGES ? STAGES.map((v) => (v ? v + "단" : "완성")) : ROTS.map((v) => v + "°");
const RS = STAGES ? STAGES.map(() => ROTS[0]) : ROTS;
const CELL = Number(flag("--cell", 160));
const ROWS = Number(flag("--rows", flag("--worst", 40)));
/** 옛 2D 견줌을 켠다 — 2D 폴백(#gl=0·도록 SVG)을 감사할 때만. */
const VS2D = argv.includes("--vs2d");
const OUT = String(flag("--out", join(tmpdir(), "model-gl.png")));
const JSON_OUT = flag("--json", null);
/* 진단 스위치를 GL 붓에 넘긴다(모듈이 import 때 location.hash 를 읽으므로 goto 에 실어야 한다).
   기본은 `glbloom=0` — 이 자는 "빠진 부품이 없나"를 보는 자라 **번짐은 끄고** 잰다(번짐은 2D 에 없는
   몫이라 켜면 발광 종류의 색차·밝기비가 통째로 뛴다). 번짐까지 보려면 `--hash ""` 나 `--hash 다른것`. */
const HASH = flag("--hash", "glbloom=0");
/** **자세 0 에서는 비는 것이 맞는** 종류 — 이 자는 유닛을 자세 0 으로 굽는다. 지금은 없다(시즈 전환의
 *  뒤 포신 홑판 siegebarrel 이 여기 있었는데, 포탑 한 판 tankturretxf 로 합치며 사라졌다). */
const EMPTY_OK9 = new Set([]);
const BG = "#20242b";
const COLOR = "#4aa3ff";

const ENTRY = `
import { SHAPE_BUILDERS, SHAPE_GALLERY, poseSet9, bldLitSet, headYawSet, bldSpinRawSet9, tone9, silhouetteLight, DECAL_KINDS } from ${JSON.stringify(join(ROOT, "src/components/replay/bake9"))};
import { withTopView, withViewShear, withYaw, bake, zsorted } from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
import { GlUnits9, CAM_TOP9, GL_CANVAS_KINDS9, GL_GLOW_KINDS9 } from ${JSON.stringify(join(ROOT, "src/components/replay/gl9"))};
const BLD = new Set(SHAPE_GALLERY.filter((g) => g.group === "건물").map((g) => g.kind));
window.__kinds = () => Object.keys(SHAPE_BUILDERS);
window.__run = (kinds, rots, cell, bg, color, vs2d, stages, lit) => {
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
        m = isB ? g.bldMesh({ kind, fx: 0, fy: 0, z: 0, sizePx: 16, color, alpha: 1, rotDeg: rot, lit, buildStage: stages ? stages[i] : 0 }, 3) : g.unitMesh(kind, ${POSE}, 3);
      } catch (e) { errs[kind] = String(e).slice(0, 80); }
      if (!m) return;
      g.push({ mesh: m, ax: i * cell + cell / 2, ay: cell / 2, k, yoff: k * 4, yawDeg: -rot, color, alpha: 1, cam: CAM_TOP9, gradR: cell * 0.707, gradCy: 0, flat: GL_GLOW_KINDS9.has(kind) });   // 발광 종류는 붓과 같이 음영·깊이 없이
    });
    g.flush(gcv.width, gcv.height, gcv.width, gcv.height);
    gx.drawImage(gcv, 0, r * cell);
  });
  const bgc = [parseInt(bg.slice(1, 3), 16), parseInt(bg.slice(3, 5), 16), parseInt(bg.slice(5, 7), 16)];
  const isBg = (d, o) => Math.abs(d[o] - bgc[0]) + Math.abs(d[o + 1] - bgc[1]) + Math.abs(d[o + 2] - bgc[2]) < 18;
  const B = gx.getImageData(0, 0, gl2.width, gl2.height).data;
  if (!vs2d) {
    /* 기본 — **GL 만**. 재는 것은 '칸마다 실루엣이 있나' 하나다. */
    const out0 = [];
    kinds.forEach((kind, r) => {
      let n = 0;
      rots.forEach((rot, i) => {
        for (let y = 0; y < cell; y += 1) for (let x = 0; x < cell; x += 1) {
          if (!isBg(B, ((r * cell + y) * gl2.width + (i * cell + x)) * 4)) n += 1;
        }
      });
      out0.push({ kind, nB: n, err: errs[kind] ?? null, canvas: GL_CANVAS_KINDS9.has(kind) });
    });
    return { rows: out0, b: gl2.toDataURL("image/png") };
  }
  // --vs2d: 2D 폴백(model-shot 과 같은 식 — 면 채우기 + tone9 + 실루엣 빛)과 견준다.
  const cv2 = document.createElement("canvas"); cv2.width = cols * cell; cv2.height = rows * cell;
  const c2 = cv2.getContext("2d"); c2.fillStyle = bg; c2.fillRect(0, 0, cv2.width, cv2.height);
  kinds.forEach((kind, r) => {
    const b = SHAPE_BUILDERS[kind]; if (!b) return;
    rots.forEach((rot, i) => {
      poseSet9(${POSE}); bldLitSet(false); headYawSet(0); bldSpinRawSet9(0);
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
window.__sheet = (pairs, cell, rots, bg, glOnly) => {
  // pairs: [{kind, a(2D dataURL), b(GL dataURL), row}] — glOnly 면 GL 칸만, 아니면 [2D, GL] 짝을 rot 마다 나란히
  return new Promise((res) => {
    const imgs = {};
    const load = (src) => new Promise((r) => { if (imgs[src]) return r(imgs[src]); const im = new Image(); im.onload = () => { imgs[src] = im; r(im); }; im.src = src; });
    Promise.all(pairs.map((p) => Promise.all([load(p.a ?? p.b), load(p.b)]))).then((ims) => {
      const PAD = 22; const cols = rots.length * (glOnly ? 1 : 2);
      const cv = document.createElement("canvas"); cv.width = cols * cell; cv.height = pairs.length * (cell + PAD);
      const c = cv.getContext("2d"); c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
      c.font = "12px ui-monospace, monospace"; c.textBaseline = "top";
      pairs.forEach((p, r) => {
        const [ia, ib] = ims[r]; const y = r * (cell + PAD);
        rots.forEach((rot, i) => {
          if (glOnly) {
            c.drawImage(ib, i * cell, p.row * cell, cell, cell, i * cell, y + PAD, cell, cell);
            c.strokeStyle = "rgba(255,255,255,.15)"; c.strokeRect(i * cell + 0.5, y + PAD + 0.5, cell - 1, cell - 1);
            c.fillStyle = "#9aa4b0"; c.fillText(String(rot), i * cell + 4, y + 6);
            return;
          }
          c.drawImage(ia, i * cell, p.row * cell, cell, cell, (i * 2) * cell, y + PAD, cell, cell);
          c.drawImage(ib, i * cell, p.row * cell, cell, cell, (i * 2 + 1) * cell, y + PAD, cell, cell);
          c.strokeStyle = "rgba(255,255,255,.15)"; c.strokeRect((i * 2) * cell + 0.5, y + PAD + 0.5, cell * 2 - 1, cell - 1);
          c.fillStyle = "#9aa4b0"; c.fillText(rot + " 2D", (i * 2) * cell + 4, y + 6); c.fillText("GL", (i * 2 + 1) * cell + 4, y + 6);
        });
        c.fillStyle = "#ffd070"; c.fillText(p.label, 4 + cell * 0.45, y + 6);
      });
      res(cv.toDataURL("image/png"));
    });
  });
};
`;
const dir = mkdtempSync(join(tmpdir(), "model-gl-"));
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
await page.route("http://model-gl.local/*", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><meta charset=utf-8><body>" }));
await page.goto("http://model-gl.local/" + (HASH ? "#" + HASH : ""));
await page.addScriptTag({ content: js, type: "module" });
await page.waitForFunction("!!window.__run");
const kinds = KINDS ?? await page.evaluate(() => window.__kinds());
const CHUNK = 20;
const rows = []; const sheets = [];
for (let i = 0; i < kinds.length; i += CHUNK) {
  const part = kinds.slice(i, i + CHUNK);
  const r = await page.evaluate(([ks, rots, cell, bg, color, v, st, li]) => window.__run(ks, rots, cell, bg, color, v, st, li), [part, RS, CELL, BG, COLOR, VS2D, STAGES, LIT]);
  r.rows.forEach((row, j) => { rows.push({ ...row, chunk: sheets.length, row: j }); });
  sheets.push({ a: r.a, b: r.b });
}
let bad9 = 0;
if (VS2D) {
  /* 2D 폴백 감사 — 이 수는 '**2D 폴백과의 차이**'다(나쁨이 아니다). 방향광·광택·결·푸른빛은
     2D 에 없는 몫이라 GL 이 좋아질수록 오른다 — 낮추려 들지 마라. */
  rows.sort((p, q) => q.bad - p.bad);
  console.log("종류            2D차이  IoU   색차  밝기비   2D화소  GL화소");
  for (const r of rows) console.log(`${r.kind.padEnd(16)} ${r.bad.toFixed(2)}  ${r.iou.toFixed(2)}  ${r.cd.toFixed(2)}  ${r.lumK.toFixed(2)}   ${String(r.nA).padStart(6)} ${String(r.nB).padStart(6)}${r.canvas ? "  (캔버스)" : ""}${r.err ? "  ⚠ " + r.err : ""}`);
  const live = rows.filter((r) => !r.canvas);
  const avg = live.reduce((a, r) => a + r.bad, 0) / Math.max(1, live.length);
  const lum = live.reduce((a, r) => a + r.lumK, 0) / Math.max(1, live.length);
  console.log(`— ${live.length}종 · 평균 2D차이 ${avg.toFixed(3)} · 평균 밝기비(GL/2D) ${lum.toFixed(3)}`);
} else {
  /* 기본 — 재는 것은 하나다: **칸마다 실루엣이 있나**. 빈 칸은 빌더가 터졌거나 통째로 안 그려진 것이다. */
  rows.sort((p, q) => p.nB - q.nB);
  const empty = rows.filter((r) => !r.canvas && !EMPTY_OK9.has(r.kind) && (r.nB === 0 || r.err));
  for (const r of rows.slice(0, 12)) console.log(`${r.kind.padEnd(16)} GL화소 ${String(r.nB).padStart(7)}${r.canvas ? "  (캔버스)" : ""}${r.err ? "  ⚠ " + r.err : ""}`);
  if (rows.length > 12) console.log(`  … (${rows.length - 12}종 더 · 화소 적은 순)`);
  if (empty.length) {
    console.error(`✗ 빈 그림 ${empty.length}종: ${empty.map((r) => r.kind + (r.err ? "(" + r.err + ")" : "")).join(" ")}`);
    bad9 = 1;
  } else {
    const lo9 = rows.find((r) => !EMPTY_OK9.has(r.kind)) ?? rows[0];
    console.log(`✔ ${rows.length}종 다 그려진다(빈 칸 0 · 가장 적은 것 ${lo9.kind} ${lo9.nB}화소)`);
  }
}
if (JSON_OUT) writeFileSync(String(JSON_OUT), JSON.stringify(rows, null, 1));
const pick9 = (VS2D ? rows.filter((r) => !r.canvas) : rows).slice(0, ROWS).map((r) => ({
  a: sheets[r.chunk].a, b: sheets[r.chunk].b, row: r.row,
  label: VS2D ? `${r.kind}  2D차이 ${r.bad.toFixed(2)} (IoU ${r.iou.toFixed(2)} 색차 ${r.cd.toFixed(2)})` : r.kind,
}));
const dataUrl = await page.evaluate(([pairs, cell, rots, bg, go]) => window.__sheet(pairs, cell, rots, bg, go), [pick9, CELL, COLS, BG, !VS2D]);
await browser.close();
writeFileSync(OUT, Buffer.from(dataUrl.split(",")[1], "base64"));
console.log(`→ ${OUT}`);
if (bad9) process.exit(1);
