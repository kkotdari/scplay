/* 총구 앵커표 굽기 — 빌더가 markMuzzle9로 적은 점을 모아 muzzleTable.gen.ts를 쓴다.
   node scripts/muzzle-table.mjs           표를 다시 뽑는다
   node scripts/muzzle-table.mjs --check   어긋남 검사(등급표 tier-table.mjs와 같은 규약)
   엔진(engine9 MUZZLE_ANCHOR)은 이 표를 손 표 위에 덮어쓴다 — 표에 없는 종류만 손 값이 남는다.
   ★ 모델을 고치면 등급표처럼 이 표도 다시 뽑는다. */
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/components/replay/muzzleTable.gen.ts");
const CHECK = process.argv.includes("--check");
/** 빌더 → 앵커 열쇠. 탱크는 포탑 판(tankgun)이 총구를 들고, 앵커 열쇠는 마커 이름(tank)이다. 합본 판은 건너뛴다. */
const KEY_OF = { tankgun: "tank", tanksiegegun: "tanksiege" };
const SKIP = new Set(["tank", "tanksiege", "tankturretxf", "tankbody", "tanksiegebody", "tanksiegelegs", "tanksiegelegsF"]);
const ENTRY = `
import { SHAPE_BUILDERS, poseSet } from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
import { MUZZLE_PROBE9, MUZZLE_PROBE_AIR9 } from ${JSON.stringify(join(ROOT, "src/components/replay/bake9"))};
import { bake, withYaw } from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
window.__probeAll = () => {
  const out = {}; const air = {};
  for (const kind of Object.keys(SHAPE_BUILDERS)) {
    MUZZLE_PROBE9.p = null; MUZZLE_PROBE9.hard = false; MUZZLE_PROBE_AIR9.p = null;
    poseSet(0);
    try { bake(() => withYaw(0, SHAPE_BUILDERS[kind])); } catch (e) { continue; }
    const r2 = (p) => p.map((v) => Math.round(v * 100) / 100);
    if (MUZZLE_PROBE9.p) out[kind] = r2(MUZZLE_PROBE9.p);
    /* 대공 채널(markMuzzleAir9) — 적은 종류만 표에 든다(지대공·지대지가 아예 다른 셋). */
    if (MUZZLE_PROBE_AIR9.p) air[kind] = r2(MUZZLE_PROBE_AIR9.p);
  }
  return { out, air };
};
`;
function bundle() {
  const dir = mkdtempSync(join(tmpdir(), "muzzle-"));
  const src = join(dir, "entry.ts"); const out = join(dir, "entry.mjs");
  writeFileSync(src, ENTRY);
  execFileSync(process.execPath, [join(ROOT, "node_modules/esbuild/bin/esbuild"), src, "--bundle", "--format=esm",
    "--log-level=error", "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`]);
  return readFileSync(out, "utf8");
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
await page.waitForFunction(() => !!window.__probeAll);
const raw = await page.evaluate(() => window.__probeAll());
await browser.close();
const table = {}; const airTable = {};
for (const [b, p] of Object.entries(raw.out)) {
  if (SKIP.has(b)) continue;
  table[KEY_OF[b] ?? b] = p;
}
for (const [b, p] of Object.entries(raw.air || {})) {
  if (SKIP.has(b)) continue;
  airTable[KEY_OF[b] ?? b] = p;
}
const keys = Object.keys(table).sort();
const rowOf = (t) => (k) => `  ${/^[a-z0-9_]+$/i.test(k) ? k : JSON.stringify(k)}: [${t[k].join(", ")}],`;
const body = keys.map(rowOf(table)).join("\n");
const airKeys = Object.keys(airTable).sort();
const airBody = airKeys.map(rowOf(airTable)).join("\n");
const text = `/* 총구 앵커표 — **미리 구운 것**(자동 생성) ──────────────────────────────────────────
 *  만드는 법: \`node scripts/muzzle-table.mjs\` · 검사: \`node scripts/muzzle-table.mjs --check\`
 *  손으로 고치지 않는다 — 값은 빌더의 markMuzzle9(bake9)가 적은 점이다(모형 좌표 [x(우), y(앞), z(위)],
 *  빌더를 감싼 배율·옮김·회전을 거친 판의 자). 엔진(engine9 MUZZLE_ANCHOR)이 손 표 위에 덮어쓴다.
 *  ★ 모델을 고치면 이 표도 다시 뽑는다. 검사 모드가 어긋남을 잡는다. */
export const MUZZLE_GEN9: Record<string, [number, number, number]> = {
${body}
};
/** **대공 채널**(markMuzzleAir9 를 적은 종류만) — 지대공 무기가 아예 딴 자리에서 나가는 셋이다
 *  (레이스 날개 끝 포드 · 골리앗 어깨 갑옷 · 스카우트 양쪽 엔진). 없는 종류는 위 표를 쓴다. */
export const MUZZLE_AIR_GEN9: Record<string, [number, number, number]> = {
${airBody}
};
`;
if (CHECK) {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (cur === text) { console.log(`✔ 총구표 최신 — 종류 ${keys.length}개`); process.exit(0); }
  console.error(`✘ 총구표가 낡았다 — node scripts/muzzle-table.mjs 로 다시 뽑아라`);
  process.exit(1);
}
writeFileSync(OUT, text);
console.log(`총구표 ${keys.length}종 → ${OUT}`);
