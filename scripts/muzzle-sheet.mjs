/* 총구 앵커 확인판 — MUZZLE_ANCHOR·BLD_MUZZLE의 점을 모델 위에 십자로 찍어 본다.
   node scripts/muzzle-sheet.mjs [--kinds a,b] [--rots 0,45,…] [--mode top|pitch] [--cell 220] [--out x.png]
   앱과 같은 자(anchorPoint: 요잉 칸·시점 밀림·부감)로 투영하므로, 십자가 그 부위(총구·포구·입)
   위에 앉지 않으면 표의 좌표가 틀린 것이다. 이 도구는 정규화 배수를 안 탄다(면도 앵커도 16-상자
   그대로) — 배수는 둘 다 같은 축으로 같이 커지므로 어긋남을 재는 데는 필요 없다. */
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/* ★ esbuild 는 기계마다 **JS 껍데기**이거나 **네이티브 바이너리**다(설치가 고른다) — 네이티브를
   node 로 부르면 ELF 를 자바스크립트로 읽어 SyntaxError 로 죽는다. 앞 네 바이트로 가른다(tier-table 의 그 자). */
const EBIN9 = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
const EHEAD9 = readFileSync(EBIN9).subarray(0, 4);
const EMAGIC9 = ((EHEAD9[0] << 24) | (EHEAD9[1] << 16) | (EHEAD9[2] << 8) | EHEAD9[3]) >>> 0;
const ENATIVE9 = EMAGIC9 === 0x7f454c46 || (EHEAD9[0] === 0x4d && EHEAD9[1] === 0x5a)
  || EMAGIC9 === 0xcffaedfe || EMAGIC9 === 0xcefaedfe || EMAGIC9 === 0xcafebabe;
/** esbuild 를 어느 길로든 돌린다 — 인자는 껍데기·네이티브가 같다. */
const esbuild9 = (args, opt = { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] }) =>
  execFileSync(ENATIVE9 ? EBIN9 : process.execPath, ENATIVE9 ? args : [EBIN9, ...args], opt);
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const KINDS = flag("--kinds", "") ? String(flag("--kinds", "")).split(",") : null;
const ROTS = String(flag("--rots", "0,45,90,135,180,225,270,315")).split(",").map(Number);
const MODE = String(flag("--mode", "top"));
const CELL = Number(flag("--cell", 200));
const OUT = String(flag("--out", join(tmpdir(), "muzzle-sheet.png")));
/* --air — **대공 채널**의 총구를 찍는다(2026-09, 요청: 지대공·지대지 시작점 분리).
   좌우 한 쌍인 발사관(MUZZLE_PAIR9)은 십자가 **둘** 선다 — 지도·도록이 그 두 자리에서 쏜다. */
const AIR = process.argv.includes("--air");
const ENTRY = `
import { SHAPE_BUILDERS, poseSet, tone9 } from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
import { MUZZLE_ANCHOR, MUZZLE_AIR9, MUZZLE_PAIR9, BLD_MUZZLE, MUZZLE_PLATE, anchorPoint } from ${JSON.stringify(join(ROOT, "src/components/replay/engine9"))};
import { lodFilter, withPitchView, withTopView, withViewShear, withYaw, bake, zsorted } from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
window.__tone = tone9;
/* ★ **앵커를 든 판 위에 찍는다**(2026-09, 지적: "시즈모드 트레이서가 포신 입에서 나오는지 다시 확인") —
   탱크 둘은 앵커를 **포탑 판**(tankgun·tanksiegegun)에서 뽑아 합본 이름(tank·tanksiege)으로 싣는다
   (muzzle-table 의 KEY_OF). 그래서 합본 모델 위에 찍으면 포탑이 **쉬는 각**으로 서 있는 만큼 어긋나
   보인다 — 표가 틀린 것이 아니라 판정표가 딴 판에 찍고 있던 것이다. 판 이름으로도 찾게 뒤집어 둔다. */
window.__tables = { unit: MUZZLE_ANCHOR, air: MUZZLE_AIR9, pair: MUZZLE_PAIR9, bld: BLD_MUZZLE,
  ofPlate: Object.fromEntries(Object.entries(MUZZLE_PLATE).map(([k, v]) => [v, k])) };
window.__bake = (kind, rot, mode) => {
  const builder = SHAPE_BUILDERS[kind];
  if (!builder) return null;
  poseSet(0);
  const bake0 = () => bake(() => withViewShear(0, () => withYaw(-rot, builder)));
  const bake1 = mode === "pitch" ? () => withPitchView(bake0) : bake0;
  const all = mode === "top" ? withTopView(bake1) : bake1();
  return all ? zsorted(lodFilter(all, 3)) : null;
};
window.__anchor = (a, rot, mode) => anchorPoint(a, rot, 0, mode === "pitch", mode === "top");
`;
function bundle() {
  const dir = mkdtempSync(join(tmpdir(), "muzzle-"));
  const src = join(dir, "entry.ts"); const out = join(dir, "entry.mjs");
  writeFileSync(src, ENTRY);
  esbuild9([src, "--bundle", "--format=esm",
    "--log-level=error", "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`]);
  return readFileSync(out, "utf8");
}
function pageMain({ KINDS, ROTS, MODE, CELL, AIR }) {
  const tb = window.__tables;
  const kinds = KINDS ?? [...Object.keys(tb.unit), ...Object.keys(tb.bld)];
  const PAD = 24; const cols = ROTS.length; const rows = kinds.length;
  const cv = document.createElement("canvas");
  cv.width = cols * CELL; cv.height = rows * CELL + PAD;
  const c = cv.getContext("2d");
  c.fillStyle = "#20242b"; c.fillRect(0, 0, cv.width, cv.height);
  c.font = "13px ui-monospace, monospace"; c.textBaseline = "top"; c.fillStyle = "#dfe3e6";
  ROTS.forEach((r, i) => c.fillText(`${r}°`, i * CELL + 8, 6));
  kinds.forEach((k, r) => {
    const kk = tb.ofPlate[k] ?? k;
    const a = (AIR && tb.air[kk]) || tb.unit[k] || tb.bld[k] || tb.unit[kk];
    /* 쌍이면 모형 x 를 뒤집은 점도 함께 찍는다(engine9 muzzleLanes9 과 같은 손). */
    const pr = tb.pair[kk]; const twin = a && (AIR ? pr && pr.a : pr && pr.g) && Math.abs(a[0]) > 0.01;
    const as = twin ? [a, [-a[0], a[1], a[2]]] : (a ? [a] : []);
    ROTS.forEach((rot, i) => {
      const faces = window.__bake(k, rot, MODE);
      const ox = i * CELL; const oy = r * CELL + PAD;
      c.strokeStyle = "rgba(255,255,255,.12)"; c.strokeRect(ox + 0.5, oy + 0.5, CELL - 1, CELL - 1);
      c.save(); c.translate(ox, oy); c.scale(CELL / 16, CELL / 16);
      if (faces) for (const f of faces) {
        c.globalAlpha = f[1]; c.fillStyle = window.__tone(f[2] ?? "#4aa3ff");
        try { c.fill(new Path2D(f[0])); } catch (e) { /* */ }
      }
      c.globalAlpha = 1;
      for (const aa of as) {
        const [px, py] = window.__anchor(aa, rot, MODE);
        c.lineWidth = 0.12; c.strokeStyle = AIR ? "#33ddff" : "#ff3355";
        c.beginPath(); c.moveTo(px - 0.7, py); c.lineTo(px + 0.7, py); c.moveTo(px, py - 0.7); c.lineTo(px, py + 0.7); c.stroke();
        c.beginPath(); c.arc(px, py, 0.28, 0, Math.PI * 2); c.stroke();
      }
      c.restore();
      c.fillStyle = "#9aa4b0";
      if (i === 0) c.fillText(k + (a ? (AIR && tb.air[kk] ? " 대공" : "") : " (앵커 없음)"), ox + 8, oy + 6);
    });
  });
  return cv.toDataURL("image/png");
}
const js = bundle();
const { chromium } = await import("playwright-core");
const exe = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium"].filter(Boolean).find((p) => existsSync(p));
const launchOpt = exe ? { executablePath: exe, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] };
const browser = await chromium.launch(launchOpt).catch(async (e) => {
  if (!/headless/i.test(String(e))) throw e;
  return chromium.launch({ ...launchOpt, headless: false, args: [...launchOpt.args, "--headless=new", "--no-sandbox"] });
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("페이지 오류:", String(e).slice(0, 300)));
await page.setContent("<body></body>");
await page.addScriptTag({ content: js, type: "module" });
await page.waitForFunction(() => !!window.__bake);
const url = await page.evaluate(pageMain, { KINDS, ROTS, MODE, CELL, AIR });
writeFileSync(OUT, Buffer.from(url.split(",")[1], "base64"));
console.log(OUT);
await browser.close();
