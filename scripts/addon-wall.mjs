#!/usr/bin/env node
/* 애드온 통로의 벽 표 굽기(2026-09, 요청: "애드온연결부의 길이를 본건물과 애드온 양옆벽을 잇는 좌표로
   설정해주는 로직 개발(수동으로 길이조절 안하게)") ─────────────────────────────────────────────
   본건물(커맨드·팩토리·스타포트·사이언스퍼실리티)의 **+x 벽**과 부속 여섯의 **−x 벽**의 옆선을 메시에서 재어
   addonWall.gen.ts 에 쓴다. 엔진(addonLinkGeom9)이 이 표로 통로의 자리·길이를 셈한다 — 엔진(일꾼)은 bake9 를
   못 들므로 값만 받는다(총구표·등급표와 같은 규약).
     node scripts/addon-wall.mjs           표를 다시 뽑는다
     node scripts/addon-wall.mjs --check   어긋남 검사
   표 한 줄: { y0, dy, xs[], zs[], yv: [ya, yb], ry0, bot }
     · xs[i] = 모델 y ∈ [y0 + i·dy, +dy) 칸에서 벽 띠(z 구간) 안 꼭짓점의 x 최대(본체) / 최소(부속). 빈 칸은 이웃 값.
     · yv = 벽이 실제로 서 있는 y 범위(빈 칸 아닌 첫·끝 칸) — 두 벽이 마주 보는 구간을 잡는 자.
     · ry0 = 바닥(z ≈ 0) 꼭짓점을 건물 요잉(−BUILDING_BASE_YAW)으로 돌린 ry 의 최대 — **땅 자**의 원점 몫이다(도록).
     · bot = **화면 잉크 바닥**(ry·sin40 − z·cos40 의 최대 = gl9 footOf.bot) — 붓이 이 줄을 지면선에 앉히므로
       지도에서 모델 원점의 타일 y 는 '지면선 − u·bot' 다(엔진 주석).
   벽 띠(z): 본체 [0.15, 1.3] — 통로는 본체 자에서 낮다(높이 1 남짓) · 부속 [0.9, 2.4] — 받침 슬래브(0.44~0.8) 위의
   몸통 벽이라야 통로가 슬래브 가장자리가 아니라 벽에 닿는다.
   ★ 모델(본체·부속)의 벽을 옮겼으면 이 표도 다시 뽑는다(--check 가 잡는다). */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
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
const OUT = join(ROOT, "src/components/replay/addonWall.gen.ts");
const CHECK = process.argv.includes("--check");
/** 본체는 +x 벽(부속을 향한 쪽) · 부속은 −x 벽. z 띠는 위 머리 주석. */
const ROLE = {
  tomb: ["max", 0.15, 1.3], factory: ["max", 0.15, 1.3], plane: ["max", 0.15, 1.3], scifac: ["max", 0.15, 1.3],
  comsat: ["min", 0.9, 2.4], nsilo: ["min", 0.9, 2.4], mshop: ["min", 0.9, 2.4],
  ctower: ["min", 0.9, 2.4], covert: ["min", 0.9, 2.4], physlab: ["min", 0.9, 2.4],
};
const DY = 0.5;
const ENTRY = `
import { SHAPE_BUILDERS, poseSet9, headYawSet, bldSpinRawSet9, bldLitSet } from ${JSON.stringify(join(ROOT, "src/components/replay/bake9"))};
import { collectMesh9 } from ${JSON.stringify(join(ROOT, "src/utils/mesh9"))};
import { BUILDING_BASE_YAW } from ${JSON.stringify(join(ROOT, "src/components/replay/engine9"))};\nimport { TOP_ELEV9, TOP_Z_PRESS9 } from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
export function run(kinds) {
  const out = {};
  for (const kind of kinds) {
    const b = SHAPE_BUILDERS[kind]; if (!b) continue;
    poseSet9(0); headYawSet(0); bldSpinRawSet9(0); bldLitSet(false);
    const m = collectMesh9(b);
    out[kind] = m.parts.map((p) => ({ polys: p.polys, solid: p.alpha >= 0.5 && !p.bb }));
  }
  return { out, yaw: BUILDING_BASE_YAW, elev: TOP_ELEV9, zpress: TOP_Z_PRESS9 };
}`;
const dir = mkdtempSync(join(tmpdir(), "addonwall-"));
const src = join(dir, "entry.ts"); const outJs = join(dir, "entry.mjs");
writeFileSync(src, ENTRY);
esbuild9([src, "--bundle", "--platform=node", "--format=esm", "--log-level=error",
  "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${outJs}`], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
const mod = await import(pathToFileURL(outJs).href);
const { out, yaw, elev, zpress } = mod.run(Object.keys(ROLE));
rmSync(dir, { recursive: true, force: true });
const r2 = (v) => Math.round(v * 100) / 100;
const th = (-yaw * Math.PI) / 180; const c = Math.cos(th); const sn = Math.sin(th);
/* ★ 붓의 자(2026-09) — 붓은 메시의 **화면 잉크 바닥**을 지면선에 앉히고(gl9 footOf.bot) 모형의 땅을
   sin(부감)만큼 누르며 높이를 cos(부감)만큼 끌어올린다. 엔진(addonLinkGeom9)이 통로를 **그려지는 자**로
   풀려면 그 둘이 있어야 한다 — 엔진은 bake9 를 못 드므로 값으로 받는다(총구표와 같은 규약). */
const KK = Math.sin((elev * Math.PI) / 180); const ZK = Math.cos((elev * Math.PI) / 180) * zpress;
const table = {};
for (const [kind, parts] of Object.entries(out)) {
  const [mode, zlo, zhi] = ROLE[kind];
  const pts = []; const all = [];
  for (const part of parts) for (const p of part.polys) for (let i = 0; i + 2 < p.length; i += 3) {
    all.push([p[i], p[i + 1], p[i + 2]]);
    if (part.solid) pts.push([p[i], p[i + 1], p[i + 2]]);
  }
  if (!pts.length) throw new Error(`${kind}: 꼭짓점 없음`);
  // 화면 잉크 바닥 — footOf.bot 과 **같은 식**이다(요잉을 먹인 ry·sin − z·cos 의 최대).
  let bot = -Infinity;
  for (const [x, y, z] of all) { const Y = (-x * sn + y * c) * KK - z * ZK; if (Y > bot) bot = Y; }
  const wall = pts.filter(([, , z]) => z >= zlo && z <= zhi);
  if (!wall.length) throw new Error(`${kind}: 벽 띠 안 꼭짓점 없음`);
  let ymin = Infinity, ymax = -Infinity;
  for (const [, y] of wall) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
  const y0 = Math.floor(ymin / DY) * DY;
  const n = Math.max(1, Math.ceil((ymax - y0) / DY + 1e-9));
  const xs = new Array(n).fill(NaN);
  for (const [x, y] of wall) {
    const i = Math.min(n - 1, Math.max(0, Math.floor((y - y0) / DY)));
    if (Number.isNaN(xs[i])) xs[i] = x;
    else xs[i] = mode === "max" ? Math.max(xs[i], x) : Math.min(xs[i], x);
  }
  let ia = xs.findIndex((v) => !Number.isNaN(v));
  let ib = xs.length - 1; while (ib > 0 && Number.isNaN(xs[ib])) ib -= 1;
  // 빈 칸은 가까운 이웃으로 메운다(벽이 없는 y 에서는 가장 가까운 벽의 x).
  for (let i = 0; i < n; i += 1) {
    if (!Number.isNaN(xs[i])) continue;
    let j = 1; while (Number.isNaN(xs[i - j] ?? NaN) && Number.isNaN(xs[i + j] ?? NaN) && j < n) j += 1;
    xs[i] = !Number.isNaN(xs[i - j] ?? NaN) ? xs[i - j] : xs[i + j];
  }
  // 바닥 앞끝의 돌린 y(ry0) — z 가 바닥(최저 + 0.05)인 꼭짓점의 ry 최대.
  let zmin = Infinity; for (const [, , z] of pts) if (z < zmin) zmin = z;
  let ry0 = -Infinity;
  for (const [x, y, z] of pts) if (z <= zmin + 0.05) { const ry = -x * sn + y * c; if (ry > ry0) ry0 = ry; }
  table[kind] = { y0: r2(y0), dy: DY, xs: xs.map(r2), yv: [r2(y0 + ia * DY), r2(y0 + (ib + 1) * DY)], ry0: r2(ry0), bot: r2(bot) };
}
const body = `/* 자동 생성 — 손대지 마라. \`node scripts/addon-wall.mjs\` 가 다시 뽑는다(모델의 벽을 옮겼으면 --check 가 잡는다).
   본체(+x 벽)·부속(−x 벽)의 옆선 x 를 모델 y 칸마다 적은 표 — 엔진(addonLinkGeom9)이 통로의 자리·길이를 셈한다. */
export const ADDON_WALL_GEN9: Record<string, { y0: number; dy: number; xs: number[]; yv: [number, number]; ry0: number; bot: number }> = ${JSON.stringify(table)};
`;
if (CHECK) {
  const old = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (old !== body) { console.error("✘ addonWall.gen.ts 가 낡았다 — node scripts/addon-wall.mjs 로 다시 뽑아라"); process.exit(1); }
  console.log(`✔ addonWall.gen.ts 최신(${Object.keys(table).length}종)`);
} else {
  writeFileSync(OUT, body);
  for (const [k, v] of Object.entries(table)) console.log(`${k.padEnd(8)} y ${v.yv[0]}~${v.yv[1]}  x ${Math.min(...v.xs)}~${Math.max(...v.xs)}  ry0 ${v.ry0}  칸 ${v.xs.length}`);
  console.log(`→ ${OUT}`);
}
