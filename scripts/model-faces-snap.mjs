/* 모델 면 스냅샷·대조기 — 모델 좌표 손질(scripts/model-z-scale.mjs)의 검산 자다.
 *
 *   node scripts/model-faces-snap.mjs --out ref.json --zk 0.8   # 원본 소스 + withModelZ(0.8) = 꼭짓점 단계의 정답
 *   node scripts/model-faces-snap.mjs --out new.json            # 고친 소스 그대로
 *   node scripts/model-faces-snap.mjs --diff ref.json new.json  # 종류마다 안 맞는 면 수를 센다
 *
 * 브라우저 없이 Node에서 빌더를 돌린다(bake9는 DOM이 없다). 전 종류 × 자세(0·1·4) × 모드(top·pitch) × 방위 다섯.
 * 대조는 채움색·명령 골격이 같은 면끼리 수치 벡터로 짝지어(허용 오차 --tol, 기본 0.03 모델 단위) 센다 —
 * 깊이 키(f[3])는 z를 타므로 안 본다(고친 소스는 partKey의 z까지 줄어 차례가 달라질 수 있다). */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const has = (n) => argv.includes(n);
const TOL = Number(flag("--tol", 0.03));

if (has("--diff")) {
  const i = argv.indexOf("--diff");
  const A = JSON.parse(readFileSync(argv[i + 1], "utf8"));
  const B = JSON.parse(readFileSync(argv[i + 2], "utf8"));
  const BIG = Number(flag("--big", 0.5));   // 이 이상 어긋나면 '버그급'(도형 단면 차이가 아니라 자리가 틀린 것)
  const nums = (d) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const skel = (d) => d.replace(/-?\d+(?:\.\d+)?/g, "#");
  const rows = [];
  let badKinds = 0;
  for (const kind of Object.keys(A)) {
    let total = 0; let miss = 0; let big = 0; let worst = 0; let where = ""; let sum = 0;
    for (const key of Object.keys(A[kind])) {
      const fa = A[kind][key]; const fb = (B[kind] ?? {})[key] ?? [];
      /* 통: 채움색|골격 — 같은 통 안에서 **가장 가까운 짝**(최대 절대차)을 탐욕으로 잇는다(정렬 짝짓기는 값이
         조금만 움직여도 차례가 뒤집혀 멀쩡한 면까지 어긋난 것으로 셌다). */
      const bucket = (fs) => { const m = new Map(); for (const f of fs) { const k = `${f[2] ?? ""}|${skel(f[0])}`; (m.get(k) ?? m.set(k, []).get(k)).push(nums(f[0])); } return m; };
      const ma = bucket(fa); const mb = bucket(fb);
      for (const [k, va] of ma) {
        const vb = (mb.get(k) ?? []).slice();
        const used = new Array(vb.length).fill(false);
        total += va.length;
        for (const p of va) {
          let best = -1; let bd = Infinity;
          for (let j = 0; j < vb.length; j += 1) {
            if (used[j]) continue;
            const q = vb[j]; let d = 0;
            for (let t = 0; t < p.length; t += 1) { const e = Math.abs(p[t] - q[t]); if (e > d) { d = e; if (d >= bd) break; } }
            if (d < bd) { bd = d; best = j; }
          }
          if (best < 0) { miss += 1; big += 1; continue; }
          used[best] = true;
          sum += bd;
          if (bd > TOL) miss += 1;
          if (bd > BIG) big += 1;
          if (bd > worst) { worst = bd; where = `${key} ${k.slice(0, 30)}`; }
        }
      }
    }
    if (miss > 0) { badKinds += 1; rows.push([big, `${kind.padEnd(16)} 어긋남 ${String(miss).padStart(6)}/${String(total).padStart(6)}  버그급(>${BIG}) ${String(big).padStart(6)}  평균 ${(sum / Math.max(1, total)).toFixed(3)}  최대 ${worst.toFixed(2)}  @${where}`]); }
  }
  rows.sort((a, b) => b[0] - a[0]);
  console.log(rows.map((r) => r[1]).join("\n"));
  console.log(`— 어긋난 종류 ${badKinds}/${Object.keys(A).length} (허용 ${TOL}) · 버그급 종류 ${rows.filter((r) => r[0] > 0).length}`);
  process.exit(badKinds ? 1 : 0);
}

const ZK = Number(flag("--zk", 1));
const ONLY = flag("--kinds", null) ? String(flag("--kinds")).split(",") : null;
const ROTS = String(flag("--rots", "0,45,90,180,270")).split(",").map(Number);
const POSES = String(flag("--poses", "0,1,4")).split(",").map(Number);
const MODES = String(flag("--modes", "top,pitch")).split(",");
const ENTRY = `
import { SHAPE_BUILDERS, poseSet9, headYawSet } from ${JSON.stringify(join(ROOT, "src/components/replay/bake9"))};
import { withYaw, withTopView, withPitchView, withModelZ, bake } from ${JSON.stringify(join(ROOT, "src/utils/shapeOblique"))};
export function snap(zk, only, rots, poses, modes) {
  const out = {};
  const kinds = only ?? Object.keys(SHAPE_BUILDERS);
  for (const kind of kinds) {
    const b = SHAPE_BUILDERS[kind]; if (!b) continue;
    out[kind] = {};
    for (const pose of poses) for (const mode of modes) for (const rot of rots) {
      poseSet9(pose); headYawSet(0);
      const run0 = () => bake(() => withYaw(-rot, b));
      const run1 = zk !== 1 ? () => withModelZ(zk, run0) : run0;
      const run2 = mode === "pitch" ? () => withPitchView(run1) : run1;
      let faces;
      try { faces = mode === "top" ? withTopView(run2) : run2(); } catch (e) { faces = [["ERR " + String(e).slice(0, 60), 1, ""]]; }
      out[kind][pose + ":" + mode + ":" + rot] = faces.map((f) => [f[0], f[1], f[2] ?? null]);
    }
  }
  poseSet9(0);
  return out;
}
`;
const dir = mkdtempSync(join(tmpdir(), "facesnap-"));
const src = join(dir, "entry.ts"); const outJs = join(dir, "entry.mjs");
writeFileSync(src, ENTRY);
execFileSync(process.execPath, [join(ROOT, "node_modules/esbuild/bin/esbuild"), src, "--bundle", "--platform=node", "--format=esm", "--log-level=error",
  "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${outJs}`], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
const mod = await import(pathToFileURL(outJs).href);
const t0 = Date.now();
const res = mod.snap(ZK, ONLY, ROTS, POSES, MODES);
rmSync(dir, { recursive: true, force: true });
const OUT = String(flag("--out", join(tmpdir(), "faces.json")));
writeFileSync(OUT, JSON.stringify(res));
let nf = 0; for (const k of Object.values(res)) for (const v of Object.values(k)) nf += v.length;
console.log(`${Object.keys(res).length}종 · 면 ${nf} · ${Date.now() - t0}ms → ${OUT}`);
