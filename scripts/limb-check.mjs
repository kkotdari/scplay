/* 인간형 팔·다리 마디 길이 좌우 비교(요청: "모든 인간형은 양팔 양다리 길이 같아야") ──
 *   node scripts/limb-check.mjs [--kinds gunner,ghost,...] [--poses 0,1,2]
 * suitLimb이 부를 때마다 두 끝과 길이를 적어(LIMB_LOG) 자세마다 마디를 x 부호로
 * 좌(+x)·우(−x)로 가르고, 같은 차례의 마디끼리 길이를 견준다. */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const KINDS = String(flag("--kinds", "gunner,ghost,fbat,medic,inf,zealot,htemp,dtemp")).split(",").filter(Boolean);
const POSES = String(flag("--poses", "0,1,2")).split(",").map(Number);

const ENTRY = `
import { SHAPE_BUILDERS, poseSet, LIMB_LOG } from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
import { withYaw, bake } from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
window.__limbs = (kind, pose) => {
  const builder = SHAPE_BUILDERS[kind];
  if (!builder) return null;
  poseSet(pose || 0);
  LIMB_LOG.rows = []; LIMB_LOG.on = true;
  try { bake(() => withYaw(0, builder)); } finally { LIMB_LOG.on = false; }
  return LIMB_LOG.rows;
};
`;
const dir = mkdtempSync(join(tmpdir(), "limbcheck-"));
const src = join(dir, "entry.ts"); const out = join(dir, "entry.mjs");
writeFileSync(src, ENTRY);
const ebin = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
const head = readFileSync(ebin).subarray(0, 4);
const magic = (head[0] << 24 | head[1] << 16 | head[2] << 8 | head[3]) >>> 0;
const native = magic === 0x7f454c46 || (head[0] === 0x4d && head[1] === 0x5a) || magic === 0xcffaedfe || magic === 0xcafebabe;
const args = [src, "--bundle", "--format=esm", "--log-level=error", "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`];
const r = native ? spawnSync(ebin, args, { stdio: "inherit" }) : spawnSync(process.execPath, [ebin, ...args], { stdio: "inherit" });
if (r.status !== 0) process.exit(1);
const js = readFileSync(out, "utf8");

const { chromium } = await import("playwright-core");
const CANDIDATES = ["/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
const exe = CANDIDATES.find((p) => existsSync(p));
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--no-proxy-server", "--headless=new", "--no-sandbox"] });
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");
await page.addScriptTag({ content: js, type: "module" });
await page.waitForFunction("!!window.__limbs");
let bad = 0;
for (const k of KINDS) {
  for (const pose of POSES) {
    const rows = await page.evaluate(([k9, p9]) => window.__limbs(k9, p9), [k, pose]);
    if (!rows) { console.log(`${k}: 빌더 없음`); break; }
    const side = (r) => ((r.a[0] + r.b[0]) / 2 < -0.05 ? "R" : (r.a[0] + r.b[0]) / 2 > 0.05 ? "L" : "C");
    const tags = [...new Set(rows.map((r) => r.tag || "?"))];
    const parts = [];
    for (const tg of tags) {
      const L = rows.filter((r) => r.tag === tg && side(r) === "L");
      const R = rows.filter((r) => r.tag === tg && side(r) === "R");
      const n = Math.min(L.length, R.length);
      for (let i = 0; i < n; i += 1) {
        const d = Math.abs(L[i].len - R[i].len);
        const mark = d > 0.06 ? " ✗" : "";
        if (mark) bad += 1;
        parts.push(`${tg}${n > 1 ? "#" + i : ""} L${L[i].len.toFixed(2)}/R${R[i].len.toFixed(2)}${mark}`);
      }
      if (L.length !== R.length) parts.push(`${tg} 개수 L${L.length}≠R${R.length}`);
    }
    console.log(`${k.padEnd(7)} pose${pose}  ${parts.join("  ")}`);
  }
}
await browser.close();
console.log(bad ? `✗ 좌우 어긋난 마디 ${bad}` : "✔ 좌우 같음");
