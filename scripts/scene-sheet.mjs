/* 종족별 **크기 비교 장면**(요청: "모든 종족의 모든 유닛과 건물을 모아서 실제 재생기의 장면처럼 보여주는 스크린샷 —
 * 크기 비교를 위해서, 종족별로") ────────────────────────────────────────────────
 *
 *   node scripts/scene-sheet.mjs --out <dir>            → scene_terran.png · scene_protoss.png · scene_zerg.png
 *   node scripts/scene-sheet.mjs --race 테란 --zoom 2
 *
 * 도록(doc-sheet)은 모델을 칸마다 정규화해 담으므로 크기 비교가 안 된다. 이 도구는 perf-check와 같은 길로 **진짜
 * 재생기**를 띄우고(합성 참값: 종족의 모든 건물·유닛을 한 사람 것으로 격자에 세운다) 지도 상자를 찍는다 — 그래서
 * 건물 발자국·유닛 자(MODEL_NORM·BLD_NORM·타일 px)가 화면 그대로다. 이름표는 엔진의 표(SHAPE_KIND·UNIT_3D·
 * raceOfName9)에서 읽고 번호는 bwUnitNames에서 잇는다. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const OUT = String(flag("--out", join(tmpdir(), "scene-sheet")));
const RACES = flag("--race", null) ? [String(flag("--race"))] : ["테란", "프로토스", "저그"];
const ZOOM = Number(flag("--zoom", 2.6));
const DPR = Number(flag("--dpr", 2));
const VIEW = Number(flag("--view", 1400));
const FPS = 23.81;
const F = (sec) => Math.round(sec * FPS);
const GAME_SEC = 120;
/** 유닛 방향 바이트(0 북 · 64 동 · 128 남 · 192 서) — 기본 128(정면). `--hb N`으로 바꾼다. */
const HB = Number(flag("--hb", 160));   // 기본 160 = 요잉 45(건물의 45와 같은 칸)

const RACE_EN = { 테란: "terran", 프로토스: "protoss", 저그: "zerg" };

/* ── esbuild ── */
const ebin = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
const head = readFileSync(ebin).subarray(0, 4);
const magic = (head[0] << 24 | head[1] << 16 | head[2] << 8 | head[3]) >>> 0;
const native = magic === 0x7f454c46 || (head[0] === 0x4d && head[1] === 0x5a)
  || magic === 0xcffaedfe || magic === 0xcefaedfe || magic === 0xcafebabe;
const esbuild = (src, out, extra) => {
  const args = [src, "--bundle", "--format=esm", "--log-level=error", ...extra,
    "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`];
  execFileSync(native ? ebin : process.execPath, native ? args : [ebin, ...args], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
};

/* ── 표 — 엔진의 이름표를 노드에서 읽는다 ── */
const tdir = mkdtempSync(join(tmpdir(), "scene-tables-"));
const tsrc = join(ROOT, "scripts", ".scene-tables.tmp.ts");
writeFileSync(tsrc, `
import { UNITS } from ${JSON.stringify(join(ROOT, "src/utils/bwUnits"))};
import { SHAPE_KIND, UNIT_3D, raceOfName9, FOOTPRINT, MODEL_NORM, BLD_NORM, BLD_NORM_PAIR, isAirUnit, UNIT_SIZE_TUNE, BLD_DRAW_TUNE, BLD_DRAW_K } from ${JSON.stringify(join(ROOT, "src/components/replay/engine9"))};
import { BW_UNIT_NAME } from ${JSON.stringify(join(ROOT, "src/utils/bwUnitNames"))};
(globalThis as any).window = globalThis;
export const TABLES = { SHAPE_KIND, UNIT_3D, FOOTPRINT, BW_UNIT_NAME, MODEL_NORM, BLD_NORM, BLD_NORM_PAIR, UNIT_SIZE_TUNE, BLD_DRAW_TUNE, BLD_DRAW_K,
  BOX: Object.fromEntries(Object.keys(UNIT_3D).map((n) => [n, UNITS[n]?.box ?? null])),
  AIR: Object.fromEntries(Object.keys(UNIT_3D).map((n) => [n, isAirUnit(n)])),
  RACE: Object.fromEntries([...Object.keys(SHAPE_KIND), ...Object.keys(UNIT_3D)].map((n) => [n, raceOfName9(n) ?? ""])) };
`);
esbuild(tsrc, join(tdir, "tables.mjs"), ["--platform=node"]);
rmSync(tsrc, { force: true });
const { TABLES } = await import(pathToFileURL(join(tdir, "tables.mjs")).href);
const nameToId = {};
for (const [id, nm] of Object.entries(TABLES.BW_UNIT_NAME)) if (nameToId[nm] === undefined) nameToId[nm] = Number(id);

/* ── OBWT 판 4 합성(perf-check와 같은 규약) ── */
class W {
  constructor() { this.b = Buffer.alloc(1 << 20); this.p = 0; }
  need(n) { if (this.p + n > this.b.length) { const nb = Buffer.alloc(this.b.length * 2 + n); this.b.copy(nb); this.b = nb; } }
  u8(v) { this.need(1); this.b[this.p++] = v & 0xff; }
  u16(v) { this.need(2); this.b.writeUInt16LE(v & 0xffff, this.p); this.p += 2; }
  u32(v) { this.need(4); this.b.writeUInt32LE(v >>> 0, this.p); this.p += 4; }
  i32(v) { this.need(4); this.b.writeInt32LE(v | 0, this.p); this.p += 4; }
  f32(v) { this.need(4); this.b.writeFloatLE(v, this.p); this.p += 4; }
  str(s) { const u = Buffer.from(s, "utf8"); this.u8(u.length); this.need(u.length); u.copy(this.b, this.p); this.p += u.length; }
  vz(v) { let z = ((v << 1) ^ (v >> 31)) >>> 0; this.need(5); for (;;) { const c = z & 0x7f; z >>>= 7; if (z) this.b[this.p++] = c | 0x80; else { this.b[this.p++] = c; break; } } }
  out() { return this.b.subarray(0, this.p); }
}
function makeWorld(race) {
  const raceNum = race === "테란" ? 1 : race === "저그" ? 0 : 2;
  const PLAYERS = [{ owner: 0, race: raceNum, force: 1, name: "비교", color: 0x2b62e8, home: [64, 64] }];
  const blds = Object.keys(TABLES.SHAPE_KIND).filter((n) => TABLES.RACE[n] === race && nameToId[n] !== undefined);
  const units = Object.keys(TABLES.UNIT_3D).filter((n) => TABLES.RACE[n] === race && nameToId[n] !== undefined);
  const skipped = Object.keys(TABLES.UNIT_3D).filter((n) => TABLES.RACE[n] === race && nameToId[n] === undefined);
  if (skipped.length) console.log(`  (번호 없어 뺀 유닛: ${skipped.join(", ")})`);
  console.log(`  건물: ${blds.join(", ")}`);
  console.log(`  유닛: ${units.join(", ")}`);
  const tracks = [];
  let tag = 100;
  const bldTrack = (type, x, y) => tracks.push({ tag: tag++, owner: 0, type, keys: [
    [F(0), x * 32, y * 32, 0, 0, type], [F(GAME_SEC), x * 32, y * 32, 0, 0, type]], hp: null });
  const unitTrack = (type, x, y) => {
    const keys = [];
    // 방향은 정면(남쪽, 화면 아래 = 방향 바이트 128)(요청: "유닛들도 방향은 정면을 향하게").
    for (let s = 0; s <= GAME_SEC; s += 0.75) keys.push([F(s), Math.round(x * 32), Math.round(y * 32), HB, 0, type]);
    tracks.push({ tag: tag++, owner: 0, type, keys, hp: null });
  };
  // 격자 — 건물은 8타일 간격 6열, 유닛은 4타일 간격 10열. 지도 가운데(64,64) 언저리.
  // 간격을 줄인다(요청: 비교가 쉽게) — 건물 6타일(발자국 최대 4 + 2)·유닛 3.6타일. 라벨은 발치 아래.
  const X0 = 64 - 22; const yb = 64 - 20;
  const labels = [];
  // 짧은 이름 — 괄호는 머리글자로(Siege Tank (Siege Mode) → Siege Tank(S)).
  const short = (n) => n.replace(/ \((\w)[^)]*\)/, "($1)");
  /* 라벨 둘째 줄 = **원작 설정의 바닥 공간**(재요청: "배율 말고 실제 게임 설정상 차지하는 바닥공간 가로*세로") —
     건물은 발자국 타일(units.dat tileSize, 예 4×3), 유닛은 치수 상자(units.dat dimensions: 좌+우+1 × 상+하+1 픽셀을
     32로 나눈 타일). 그리기 배율은 `--scale` 깃발로 다시 볼 수 있다. */
  const SHOW_SCALE = !!flag("--scale", false);
  const normOf = (n, isBld) => {
    const k = isBld ? TABLES.SHAPE_KIND[n] : TABLES.UNIT_3D[n];
    if (SHOW_SCALE) return `×${Number(isBld ? (TABLES.BLD_DRAW_TUNE[k] ?? 1) : (TABLES.UNIT_SIZE_TUNE[k] ?? 1)).toFixed(2)}`;
    if (isBld) { const fp = TABLES.FOOTPRINT[n]; return fp ? `${fp[0]}×${fp[1]}` : "?"; }
    // 타일로(재요청: "픽셀 말고 타일로, 32px이 1") — 소수 둘째 자리.
    const b = TABLES.BOX[n];
    const tl = (px) => (px / 32).toFixed(2).replace(/\.?0+$/, "");
    return b ? `${tl(b[0] + b[2] + 1)}×${tl(b[1] + b[3] + 1)}` : "?";
  };
  blds.forEach((n, i) => {
    const x = X0 + (i % 7) * 6 + 2; const y = yb + Math.floor(i / 7) * 6.5 + 2;
    const fp = TABLES.FOOTPRINT[n] ?? [3, 2];
    bldTrack(nameToId[n], x, y); labels.push([short(n), normOf(n, true), x, y + fp[1] / 2 + 0.6]);
  });
  /* 공사 중 모델도 한 칸씩(요청: "토스 소환구 저그 공사고치도 추가") — 판 8의 상태 바이트 0x80(아직 안 지어짐)을
     20초부터 끝까지 실어 born > 1인 공사 생애를 만든다(truthLives.raising). 완성 비트가 안 오니 46초엔 공사 중이다. */
  const wip = race === "프로토스" ? [["Gateway", "Warp-in", "warpin"]] : race === "저그" ? [["Hydralisk Den", "Cocoon", "cocoon"]] : [];
  wip.forEach(([n, lab, kind], j) => {
    const i = blds.length + j;
    const x = X0 + (i % 7) * 6 + 2; const y = yb + Math.floor(i / 7) * 6.5 + 2;
    const fp = TABLES.FOOTPRINT[n] ?? [3, 2];
    tracks.push({ tag: tag++, owner: 0, type: nameToId[n], keys: [
      [F(20), x * 32, y * 32, 0, 0x80, nameToId[n]], [F(GAME_SEC), x * 32, y * 32, 0, 0x80, nameToId[n]]], hp: null });
    labels.push([lab, SHOW_SCALE ? `×${Number(TABLES.BLD_DRAW_TUNE[kind] ?? 1).toFixed(2)}` : `${fp[0]}×${fp[1]}`, x, y + fp[1] / 2 + 0.6]);
  });
  const yu = yb + Math.ceil((blds.length + wip.length) / 7) * 6.5 + 2.5;
  // 지상 줄(들) 먼저, 비행 줄(들)은 그 아래 — 비행 유닛은 위로 떠서 그려지니 윗줄과 겹치지 않게 사이를 더 띄운다.
  const ground = units.filter((n) => !TABLES.AIR[n]); const air = units.filter((n) => TABLES.AIR[n]);
  const COLS = 10;
  let yRow = yu;
  const layRow = (list, gap) => {
    list.forEach((n, i) => {
      const x = X0 + (i % COLS) * 4.6 + 1; const y = yRow + Math.floor(i / COLS) * gap;
      unitTrack(nameToId[n], x, y); labels.push([short(n), normOf(n, false), x, y + 1.0]);
    });
    yRow += Math.ceil(list.length / COLS) * gap;
  };
  layRow(ground, 4.6);
  yRow += 2.5;          // 비행 줄 앞 여유(떠 있는 몸이 윗줄 라벨을 덮지 않게)
  layRow(air, 6.0);
  const yEnd = yRow;
  const w = new W();
  w.u8(0x4f); w.u8(0x42); w.u8(0x57); w.u8(0x54); w.u8(8); w.f32(FPS); w.i32(-1);   // 판 8(해독기가 판 8만 읽는다)
  w.u8(PLAYERS.length);
  for (const pl of PLAYERS) { w.u8(pl.owner); w.u8(pl.owner); w.u8(pl.race); w.u8(pl.force); w.u8(0); w.u32(pl.color); w.str(pl.name); }
  w.u32(tracks.length);
  // 판 8 트랙표 줄: tag·owner·type·키수·hp수·ic수·표적수 + 임자바뀜 목록(u8 개수, 여기서는 0).
  for (const tr of tracks) { w.u32(tr.tag); w.u8(tr.owner); w.u16(tr.type); w.u32(tr.keys.length); w.u32(0); w.u32(0); w.u32(0); w.u8(0); }
  for (const tr of tracks) {
    let pf = 0; let px = 0; let py = 0; let pt = 0;
    for (const [f, x, y, hb, st, ty] of tr.keys) { w.vz(f - pf); pf = f; w.vz(x - px); px = x; w.vz(y - py); py = y; w.u8(hb); w.u8(st & 0xff); /* 상태 바이트 통째(0x80 = 아직 안 지어짐) */ w.vz(ty - pt); pt = ty; }
  }
  w.u32(0); w.u32(0); w.u32(0); w.u32(0); w.u32(0); w.u32(0); w.u16(119); w.u32(0);
  const motion = deflateSync(w.out()).toString("base64");
  const cy = ((yb + yEnd) / 2) / 128;
  return { motion, players: PLAYERS, nB: blds.length, nU: units.length, cy, labels };
}

/* ── 참값 지형(평지·잿빛) ── */
const walkFixture = readFileSync(join(ROOT, "scripts/fixtures/walk-fastest.json"), "utf8");
const makeTerrain = () => {
  const f = JSON.parse(walkFixture); const Wd = f.w; const H = f.h;
  const tile = Buffer.alloc(Wd * H, 1);
  const mw = Wd * 4; const mh = H * 4; const wb = Buffer.alloc((mw * mh + 7) >> 3, 0xff);
  const hd = Buffer.alloc(11); hd.write("OBWM", 0, "ascii"); hd[4] = 1; hd.writeUInt16LE(Wd, 5); hd.writeUInt16LE(H, 7); hd[9] = 2;
  return deflateSync(Buffer.concat([hd, tile, wb])).toString("base64");
};

/* ── 브라우저 번들 ── */
const ENTRY = `
import React from "react";
import { createRoot } from "react-dom/client";
import ReplayMotionPlayer from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
window.__mount = (motion, players, walkJson, terrainB64, view) => {
  const el = document.getElementById("root");
  const tiles = btoa(String.fromCharCode(...new Uint8Array(128 * 128)));
  const grid = { hash: "scene", name: "scene", width: 128, height: 128, palette: [0], tiles,
    resources: [], image: null, walk: walkJson, terrain: terrainB64 ?? null, imageId: null, imageName: null };
  const bases = players.map((p) => ({ key: p.name, name: p.name, avatar: null, memberId: p.name,
    race: p.race === 1 ? "테란" : p.race === 0 ? "저그" : "프로토스", team: p.force, x: p.home[0], y: p.home[1], withName: true }));
  const teamOfRaw = (raw) => { const f = players.find((p) => p.name === raw); return f ? f.force : undefined; };
  createRoot(el).render(React.createElement(ReplayMotionPlayer, {
    grid, endSec: 120, bases, teamOfRaw, active: true, initialSec: 46,
    initialView: view, loadUnitTracks: async () => ({ motion }),
  }));
};
`;
/* vite로 굽는다(perf-check와 같은 까닭) — 프레임은 **워커**만 내므로 esbuild 번들에는 워커가 없어 유닛이 안 그려지고
   안개만 깔린다(첫 시도의 검은 화면). */
const bdir = mkdtempSync(join(tmpdir(), "scene-bundle-"));
const bsrc = join(ROOT, "scripts", ".scene-entry.tmp.ts");
writeFileSync(bsrc, ENTRY);
{
  const { build } = await import("vite");
  const reactPlugin = (await import("@vitejs/plugin-react")).default;
  await build({
    configFile: false, root: ROOT, logLevel: "error", plugins: [reactPlugin()],
    define: { "process.env.NODE_ENV": JSON.stringify("production"), __SCPLAY_BUILD__: JSON.stringify("scene") },
    worker: { format: "es", plugins: () => [reactPlugin()], rollupOptions: { external: [] } },
    build: { outDir: bdir, emptyOutDir: true, sourcemap: false, minify: false, cssCodeSplit: false,
      lib: { entry: bsrc, formats: ["es"], fileName: "entry" }, rollupOptions: { external: [], output: { inlineDynamicImports: true } } },
  });
}
rmSync(bsrc, { force: true });
const js = readFileSync(join(bdir, "entry.js"), "utf8");
const cssPath = join(ROOT, "dist", "styles.css");
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";
if (!css) console.warn("⚠ dist/styles.css 없음 — npx vite build 먼저.");

const { chromium } = await import("playwright-core");
const CANDIDATES = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium",
  join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
const launchOpt = exe ? { executablePath: exe, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] };
const browser = await chromium.launch(launchOpt).catch((e) => {
  if (!/headless/i.test(String(e))) throw e;
  return chromium.launch({ ...launchOpt, headless: false, args: [...launchOpt.args, "--headless=new", "--no-sandbox"] });
});
mkdirSync(OUT, { recursive: true });
for (const race of RACES) {
  const world = makeWorld(race);
  const page = await browser.newPage({ viewport: { width: VIEW, height: VIEW }, deviceScaleFactor: DPR });
  page.on("pageerror", (e) => console.error("페이지 오류:", e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("콘솔:", m.text().slice(0, 300)); });
  /* http 출처로 띄운다(perf-check와 같은 길) — about:blank(setContent)에서는 인라인 워커가 안 서서 프레임이 안 온다
     ("프레임 워커 오류(내용 없음)"). */
  await page.route("http://scene-sheet.local/*", (r) => r.fulfill({ contentType: "text/html",
    body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}
    html,body{margin:0;background:#1b1e24;} #root{width:${VIEW}px;}
    .scr-motion-fog{display:none!important}</style></head><body><div id="root"></div></body></html>` }));
  await page.goto(flag("--creep", false) ? "http://scene-sheet.local/#noscan" : "http://scene-sheet.local/#nocreep,noscan");   // 크립 끔(격자가 보여야 한다; --creep이면 켠다) · 두리번 끔
  await page.addScriptTag({ content: js, type: "module" });
  await page.waitForFunction("!!window.__mount");
  await page.evaluate(([m, pl, wj, tb, v]) => window.__mount(m, pl, wj, tb, v),
    [world.motion, world.players, walkFixture, makeTerrain(), { z: ZOOM, cx: 0.5, cy: world.cy, deg: 90 }]);
  await page.waitForFunction("window.__spritePerf && (window.__spritePerf.last.blit + window.__spritePerf.last.bldBlit) > 0", null, { timeout: 60000 })
    .catch(() => console.warn("⚠ 그리기 신호를 못 받았다 — 그래도 찍는다"));
  await page.waitForTimeout(4000);
  const why = await page.evaluate(() => { const d = window.__scrDiag || {}; return JSON.stringify({ truthWhy: d.truthWhy, truth: d.truth, worker: d.worker, crowd: d.crowd }); });
  console.log("진단:", why);
  /* 격자 타일(실제 게임 타일 크기)과 이름·배율 라벨을 지도 상자 위에 덧댄다 — 상자 좌표는 initialView와 같은 식
     (렌즈: ((x/128 − cx)·z + 0.5)·상자폭). 격자는 지도 위·유닛 아래(z 100), 라벨은 맨 위. */
  await page.evaluate(([labels, z, cx, cy]) => {
    const map = document.querySelector(".scr-motion-map"); if (!map) return;
    const r = map.getBoundingClientRect();
    const tile = (r.width * z) / 128;
    const ox = ((0 - cx) * z + 0.5) * r.width; const oy = ((0 - cy) * z + 0.5) * r.height;
    const grid = document.createElement("div");
    grid.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:100;` +
      `background-image:linear-gradient(rgba(255,255,255,0.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.16) 1px,transparent 1px);` +
      `background-size:${tile}px ${tile}px;background-position:${ox}px ${oy}px;`;
    map.appendChild(grid);
    const lab = document.createElement("div");
    lab.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:9000;font:9px/1.15 ui-sans-serif,system-ui,sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000;text-align:center;";
    for (const [t, nv, x, y] of labels) {
      const d = document.createElement("div");
      d.innerHTML = `${t}<br><b style="color:#ffd76a">${nv}</b>`;
      d.style.cssText = `position:absolute;left:${((x / 128 - cx) * z + 0.5) * 100}%;top:${((y / 128 - cy) * z + 0.5) * 100}%;transform:translate(-50%,0);white-space:nowrap;`;
      lab.appendChild(d);
    }
    map.appendChild(lab);
  }, [world.labels, ZOOM, 0.5, world.cy]);
  await page.waitForTimeout(300);
  const el = await page.$(".scr-motion-map");
  const file = join(OUT, `scene_${RACE_EN[race]}.png`);
  if (el) await el.screenshot({ path: file }); else await page.screenshot({ path: file });
  console.log(`${race}: 건물 ${world.nB} · 유닛 ${world.nU} → ${file}`);
  await page.close();
}
await browser.close();
rmSync(tdir, { recursive: true, force: true });
rmSync(bdir, { recursive: true, force: true });
