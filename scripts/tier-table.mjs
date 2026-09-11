/* 부품 등급표 미리 굽기 — src/components/replay/tierTable.gen.ts를 짓는다.
 *
 * 왜: tierTableOf는 종류마다 **여덟 방위를 다 구워** 부품 크기·색을 재서 등급을 매긴다.
 * 값이 종류당 20~30ms고, 경기에 나오는 종류가 백 남짓이면 로딩에서 2~3초다(실측:
 * 로딩[… 예열 2763ms/319개]). 그런데 이 표는 **모델 기하만의 함수**다 — 리플레이도 기기도
 * 배율도 안 탄다. 지을 자리는 사용자의 폰이 아니라 여기다(MODEL_NORM·BLD_NORM과 같은 규약).
 *
 * 쓰기: node scripts/tier-table.mjs          (다시 뽑아 파일에 쓴다)
 *       node scripts/tier-table.mjs --check  (어긋나면 1로 죽는다 — 모델을 고치고 안 뽑았을 때)
 *
 * ★ 모델(SHAPE_BUILDERS)을 고치면 반드시 다시 뽑는다. 안 뽑아도 그림은 안 틀린다(표에 없는
 *   종류는 그 자리에서 짓는 옛길로 떨어진다) — 다만 표가 **낡으면** 틀린 등급이 실린다.
 *   그래서 검사 모드가 있다.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/components/replay/tierTable.gen.ts");
const CHECK = process.argv.includes("--check");

const ENTRY = `
import { SHAPE_BUILDERS, tierTableOf, poseSet, bldLitSet, headYawSet, bldSpinSet }
  from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
window.__tiers = () => {
  /* 예열이 부르는 그 자리와 **같은 깃발**로 잰다 — 표는 부를 때의 자세·불빛·포탑각·회전 칸으로
     구운 면을 재므로, 여기서 기본값을 못 박아야 늘 같은 표가 나온다. */
  poseSet(0); bldLitSet(false); headYawSet(0); bldSpinSet(0);
  const out = {};
  for (const kind of Object.keys(SHAPE_BUILDERS).sort()) {
    const t = tierTableOf(kind);
    const pairs = [...t.entries()].sort((a, b) => a[0] - b[0]);
    out[kind] = pairs.map(([p, v]) => p + " " + v).join(" ");
  }
  return out;
};
`;

const dir = mkdtempSync(join(tmpdir(), "tiertable-"));
const src = join(dir, "entry.ts");
const out = join(dir, "entry.mjs");
writeFileSync(src, ENTRY);
const ebin = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
const head = readFileSync(ebin).subarray(0, 4);
const magic = ((head[0] << 24) | (head[1] << 16) | (head[2] << 8) | head[3]) >>> 0;
const native = magic === 0x7f454c46 || (head[0] === 0x4d && head[1] === 0x5a)
  || magic === 0xcffaedfe || magic === 0xcefaedfe || magic === 0xcafebabe;
const args = [src, "--bundle", "--format=esm", "--log-level=error",
  "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`];
execFileSync(native ? ebin : process.execPath, native ? args : [ebin, ...args],
  { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
const js = readFileSync(out, "utf8");
rmSync(dir, { recursive: true, force: true });

const { chromium } = await import("playwright-core");
const CANDIDATES = [
  process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium",
  join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64",
    "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
const opt = exe ? { executablePath: exe, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] };
/* 새 크로미엄은 옛 헤드리스를 걷었다 — 플레이라이트가 그 깃발을 붙이면 창이 열리자마자 죽는다. */
const browser = await chromium.launch(opt).catch(async (e) => {
  if (!/headless/i.test(String(e))) throw e;
  return chromium.launch({ ...opt, headless: false, args: [...opt.args, "--headless=new", "--no-sandbox"] });
});
const page = await browser.newPage();
page.on("pageerror", (e) => { console.error("페이지 오류:", String(e).slice(0, 300)); });
/* 진짜 오리진이 있어야 한다 — about:blank에서는 번들 안의 localStorage가 SecurityError로 죽는다. */
await page.route("http://tier-table.local/*", (r) => r.fulfill({
  contentType: "text/html", body: "<!doctype html><meta charset=utf-8><body>",
}));
await page.goto("http://tier-table.local/");
await page.addScriptTag({ content: js, type: "module" });
await page.waitForFunction(() => !!window.__tiers);
const tiers = await page.evaluate(() => window.__tiers());
await browser.close();

const kinds = Object.keys(tiers);
const body = kinds.map((k) => `  ${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(tiers[k])},`).join("\n");
const HEAD = readFileSync(OUT, "utf8").split("export const TIER_GEN9")[0];
const text = `${HEAD}export const TIER_GEN9: Record<string, string> = {\n${body}\n};\n`;

if (CHECK) {
  const now = readFileSync(OUT, "utf8");
  if (now === text) { console.log(`✔ 등급표 최신 — 종류 ${kinds.length}개`); process.exit(0); }
  console.error("✘ 등급표가 낡았다 — 모델을 고치고 안 뽑았다. `node scripts/tier-table.mjs`로 다시 뽑아라.");
  process.exit(1);
}
writeFileSync(OUT, text);
const pairs = kinds.reduce((n, k) => n + (tiers[k] ? tiers[k].split(" ").length / 2 : 0), 0);
console.log(`등급표 ${kinds.length}종 · 부품 ${pairs}개 → ${OUT}`);
