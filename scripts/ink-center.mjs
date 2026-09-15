/* 잉크 질량 중심표 — engine9 의 UNIT_INK_CY9(유닛: 16-상자 y 중심 [top, pitch]) · BLD_INK_MID9(건물: 잉크 바닥→중심 [top, pitch])를
 * 다시 잰다. model-norm 과 같은 굽기·래스터(캔버스 알파)로 방위 여덟을 평균한다.
 *
 *   node scripts/ink-center.mjs [--kinds a,b] [--modes top,pitch] [--json out.json] [--emit]
 *
 * --emit 이면 두 표를 TS 조각으로 찍는다(engine9 에 붙여 넣는다). 총구표처럼 자동 생성으로 안 옮긴 까닭: 값이 판(래스터)에서
 * 나므로 브라우저가 필요하다. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const has = (n) => argv.includes(n);
const MODES = String(flag("--modes", "top,pitch")).split(",");
const ONLY = flag("--kinds") ? String(flag("--kinds")).split(",") : null;
const ENTRY = `
import { SHAPE_BUILDERS, SHAPE_GALLERY, poseSet9, headYawSet } from ${JSON.stringify(join(ROOT, "src/components/replay/bake9"))};
import { UNIT_3D, SHAPE_KIND } from ${JSON.stringify(join(ROOT, "src/components/replay/engine9"))};
import { lodFilter, withPitchView, withTopView, withYaw, bake } from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
window.__kinds = () => {
  const units = new Set(SHAPE_GALLERY.filter((x) => x.group === "유닛").map((x) => x.kind));
  for (const k of ["tankbody", "tankgun", "tanksiegebody", "tanksiegegun", "burrowhole"]) units.add(k);
  const blds = new Set(SHAPE_GALLERY.filter((x) => x.group !== "유닛").map((x) => x.kind));
  return { units: [...units].filter((k) => SHAPE_BUILDERS[k]), blds: [...blds].filter((k) => SHAPE_BUILDERS[k]) };
};
window.__bake = (kind, rot, mode) => {
  const b = SHAPE_BUILDERS[kind]; if (!b) return null;
  poseSet9(0); headYawSet(0);
  const run0 = () => bake(() => withYaw(-rot, b));
  const run1 = mode === "pitch" ? () => withPitchView(run0) : run0;
  const f = mode === "top" ? withTopView(run1) : run1();
  return f ? lodFilter(f, 3) : null;
};
`;
function bundle() {
  const dir = mkdtempSync(join(tmpdir(), "inkcy-")); const src = join(dir, "e.ts"); const out = join(dir, "e.mjs");
  writeFileSync(src, ENTRY);
  execFileSync(process.execPath, [join(ROOT, "node_modules/esbuild/bin/esbuild"), src, "--bundle", "--format=esm", "--log-level=error", "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  const js = readFileSync(out, "utf8"); rmSync(dir, { recursive: true, force: true }); return js;
}
const js = bundle();
const { chromium } = await import("playwright-core");
const exe = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium", join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")].filter(Boolean).find((p) => existsSync(p));
const launchOpt = exe ? { executablePath: exe, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] };
const browser = await chromium.launch(launchOpt).catch(async (e) => { if (!/headless/i.test(String(e))) throw e; return chromium.launch({ ...launchOpt, headless: false, args: [...launchOpt.args, "--headless=new", "--no-sandbox"] }); });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("페이지 오류:", String(e).slice(0, 200)));
await page.setContent("<!doctype html><body>");
await page.addScriptTag({ content: js, type: "module" });
await page.waitForFunction("!!window.__bake");
const res = await page.evaluate(([MODES, ONLY]) => {
  const N = 320; const MARGIN = 2; const W = N * MARGIN; const k = N / 16; const off = (N * (MARGIN - 1)) / 2;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = W;
  const c = cv.getContext("2d", { willReadFrequently: true });
  const shadeBoost = (o, fill) => (fill && o < 1 ? Math.min(0.85, o * 1.45) : o);
  const measure = (kind, rot, mode) => {
    const faces = window.__bake(kind, rot, mode); if (!faces || !faces.length) return null;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, W); c.setTransform(k, 0, 0, k, off, off);
    for (const f of faces) { if (f[6] === 1) continue; c.globalAlpha = shadeBoost(f[1], f[2]); c.fillStyle = f[2] ?? "#fff"; try { c.fill(new Path2D(f[0])); } catch (e) { /* skip */ } }
    const buf = new Uint32Array(c.getImageData(0, 0, W, W).data.buffer);
    let sy = 0, sx = 0, n = 0, y1 = -1;
    for (let y = 0; y < W; y += 1) for (let x = 0; x < W; x += 1) { if ((buf[y * W + x] >>> 24) > 8) { n += 1; sy += y; sx += x; if (y > y1) y1 = y; } }
    if (!n) return null;
    const u = (v) => (v - off) / k;
    return { cy: u(sy / n), cx: u(sx / n), bot: u(y1) };
  };
  const { units, blds } = window.__kinds();
  const out = { units: {}, blds: {} };
  const rots = [0, 45, 90, 135, 180, 225, 270, 315];
  for (const [grp, list] of [["units", units], ["blds", blds]]) for (const kind of list) {
    if (ONLY && !ONLY.includes(kind)) continue;
    out[grp][kind] = {};
    for (const mode of MODES) {
      let cy = 0, mid = 0, n = 0;
      for (const rot of rots) { const m = measure(kind, rot, mode); if (!m) continue; cy += m.cy; mid += m.bot - m.cy; n += 1; }
      if (n) out[grp][kind][mode] = { cy: cy / n, mid: mid / n };
    }
  }
  return out;
}, [MODES, ONLY]);
await browser.close();
if (flag("--json")) writeFileSync(String(flag("--json")), JSON.stringify(res));
const f2 = (v) => v.toFixed(2);
if (has("--emit")) {
  const u = Object.entries(res.units).filter(([, v]) => v.top && v.pitch).map(([k, v]) => `${k}: [${f2(v.top.cy)}, ${f2(v.pitch.cy)}]`).join(", ");
  const b = Object.entries(res.blds).filter(([, v]) => v.top && v.pitch).map(([k, v]) => `${k}: [${f2(v.top.mid)}, ${f2(v.pitch.mid)}]`).join(", ");
  console.log(`export const UNIT_INK_CY9: Record<string, [number, number]> = { ${u} };`);
  console.log(`export const BLD_INK_MID9: Record<string, [number, number]> = { ${b} };`);
} else {
  for (const [k, v] of Object.entries(res.units)) console.log(`유닛 ${k.padEnd(14)} ${MODES.map((m) => `${m} cy ${v[m] ? f2(v[m].cy) : "-"}`).join("  ")}`);
  for (const [k, v] of Object.entries(res.blds)) console.log(`건물 ${k.padEnd(14)} ${MODES.map((m) => `${m} mid ${v[m] ? f2(v[m].mid) : "-"}`).join("  ")}`);
}
