#!/usr/bin/env node
/* **3D 를 안 적은 면**이 어느 빌더 줄에서 났는지 짚는다(model-mesh --check 가 덮임 < 100% 로 잡는 그것).
   shapeOblique 의 화면 자 헬퍼(groundEllipse·screenCircle·annulusPath)가 SITE9 에 제 호출 줄을 적게 켠 뒤
   collectMesh9 이 낸 missPaths 를 그 표에 물어, 줄마다 몇 면인지 센다.
   ★ 화면 자 헬퍼를 안 쓴 손 경로는 `??` 로 나온다 — 그때는 경로 숫자로 bake9 를 뒤진다.
   쓰기: node scripts/miss-sites.mjs [--kinds a,b] [--top 60] */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const ONLY = arg("--kinds") ? arg("--kinds").split(",") : null;
const TOP = Number(arg("--top", "80"));
const ENTRY = `
import { SHAPE_BUILDERS, poseSet9, headYawSet } from ${JSON.stringify(join(ROOT, "src/components/replay/bake9"))};
import { collectMesh9 } from ${JSON.stringify(join(ROOT, "src/utils/mesh9"))};
import { SITE9 } from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
export function run(only) {
  SITE9.on = true;
  const out = [];
  for (const kind of only ?? Object.keys(SHAPE_BUILDERS)) {
    const b = SHAPE_BUILDERS[kind]; if (!b) continue;
    poseSet9(0); headYawSet(0);
    let m; try { m = collectMesh9(b); } catch { continue; }
    for (const d of m.missPaths ?? []) out.push([kind, SITE9.byD.get(d) ?? "?? " + d.slice(0, 60)]);
  }
  poseSet9(0);
  return out;
}`;
const dir = mkdtempSync(join(tmpdir(), "recov-")); const src = join(dir, "entry.ts"); const outJs = join(dir, "entry.mjs");
writeFileSync(src, ENTRY);
esbuild9([src, "--bundle", "--platform=node", "--format=esm",
  "--log-level=error", "--sourcemap=inline", "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${outJs}`],
  { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
const mod = await import(pathToFileURL(outJs).href);
const rows = mod.run(ONLY);
rmSync(dir, { recursive: true, force: true });
const byLine = new Map();
for (const [kind, site] of rows) {
  const key = (site.match(/\(?([^()\s]+\.ts:\d+:\d+)\)?$/)?.[1] ?? site).replace(ROOT + "/", "");
  const e = byLine.get(key) ?? { n: 0, kinds: new Set() };
  e.n += 1; e.kinds.add(kind); byLine.set(key, e);
}
const list = [...byLine.entries()].sort((a, b) => b[1].n - a[1].n);
for (const [line, e] of list.slice(0, TOP)) {
  console.log(`${String(e.n).padStart(4)}면  ${line}   ${[...e.kinds].slice(0, 6).join(",")}${e.kinds.size > 6 ? ` +${e.kinds.size - 6}` : ""}`);
}
console.log(`— 빠진 면 ${rows.length} · 줄 ${byLine.size}곳${list.length > TOP ? ` (앞 ${TOP}줄만)` : ""}`);
