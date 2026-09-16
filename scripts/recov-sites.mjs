#!/usr/bin/env node
/* 우회로(되찾기로 살린 면)가 **어느 빌더 줄**에서 났는지 짚는다.
   shapeOblique 의 화면 자 헬퍼(groundEllipse·screenCircle)가 SITE9 에 제 호출 줄을 적게 켠 뒤
   collectMesh9 이 낸 recovPaths 를 그 표에 물어, 줄마다 몇 면인지 센다.
   쓰기: node scripts/recov-sites.mjs [--kinds a,b] [--top 60] */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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
    for (const d of m.recovPaths ?? []) out.push([kind, SITE9.byD.get(d) ?? "?? " + d.slice(0, 60)]);
  }
  poseSet9(0);
  return out;
}`;
const dir = mkdtempSync(join(tmpdir(), "recov-")); const src = join(dir, "entry.ts"); const outJs = join(dir, "entry.mjs");
writeFileSync(src, ENTRY);
execFileSync(process.execPath, [join(ROOT, "node_modules/esbuild/bin/esbuild"), src, "--bundle", "--platform=node", "--format=esm",
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
console.log(`— 우회로 ${rows.length}면 · 줄 ${byLine.size}곳${list.length > TOP ? ` (앞 ${TOP}줄만)` : ""}`);
