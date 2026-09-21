/* 칸(spin)마다 메시의 **화면 상자**를 요잉 여덟 각으로 잰다(칸 수는 engine9 의 SPIN_ANIM9).
   붓은 상자의 바닥을 바닥선에 맞춰 건물을 앉히므로, 그 바닥이 칸마다 움직이는 종류는
   **칸 0 으로 고정해 재야** 한다(ReplayMotionPlayer 의 glBbox9 · CLAUDE.md '도는 부품이
   건물의 자리를 흔들면 안 된다'). 여기 '바닥 흔들림'이 0 이 아닌 종류가 곧 그 종류다.
   쓰기: node scripts/spin-box.mjs forge cyber mshop trapezoid sunken */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path"; import { pathToFileURL } from "node:url";
import { dirname } from "node:path"; import { fileURLToPath } from "node:url";
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
const ENTRY = `
import { SHAPE_BUILDERS, bldSpinRawSet9 } from ${JSON.stringify(join(ROOT, "src/components/replay/bake9"))};
import { SPIN_ANIM9 } from ${JSON.stringify(join(ROOT, "src/components/replay/engine9"))};
import { collectMesh9 } from ${JSON.stringify(join(ROOT, "src/utils/mesh9"))};
export function run(kind, yaws) {
  const out = [];
  /* 칸 수는 표에서 읽는다 — 8 로 못 박아 두면 칸을 늘린 뒤 **절반만** 재고도 통과한다. */
  for (let s = 0; s < SPIN_ANIM9; s += 1) {
    bldSpinRawSet9(s);
    const m = collectMesh9(SHAPE_BUILDERS[kind]);
    const row = [];
    for (const yd of yaws) {
      const th = yd * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th);
      let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
      for (const p of m.parts) for (const q of p.polys) for (let i = 0; i + 2 < q.length; i += 3) {
        const rx = q[i] * c + q[i + 1] * sn, ry = -q[i] * sn + q[i + 1] * c;
        const sy = ry * 0.643 - q[i + 2] * 0.766;
        if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
        if (rx < x0) x0 = rx; if (rx > x1) x1 = rx;
      }
      row.push([x0, x1, y0, y1]);
    }
    out.push(row);
  }
  bldSpinRawSet9(0);
  return out;
}`;
const dir = mkdtempSync(join(tmpdir(), "sb-")); const src = join(dir, "e.ts"); const outJs = join(dir, "e.mjs");
writeFileSync(src, ENTRY);
esbuild9([src, "--bundle", "--platform=node", "--format=esm", "--log-level=error",
  "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${outJs}`], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
const m = await import(pathToFileURL(outJs).href);
const yaws = [0, 45, 90, 135, 180, 225, 270, 315];
for (const k of process.argv.slice(2)) {
  const r = m.run(k, yaws);
  console.log("== " + k);
  yaws.forEach((yd, j) => {
    const bot = r.map((row) => row[j][3]);
    const wid = r.map((row) => row[j][1] - row[j][0]);
    const sp = Math.max(...bot) - Math.min(...bot);
    const sw = Math.max(...wid) - Math.min(...wid);
    console.log(`  요잉 ${String(yd).padStart(3)}  바닥 흔들림 ${sp.toFixed(3)}  폭 흔들림 ${sw.toFixed(3)}  (바닥 ${bot.map((v) => v.toFixed(2)).join(" ")})`);
  });
}
rmSync(dir, { recursive: true, force: true });
