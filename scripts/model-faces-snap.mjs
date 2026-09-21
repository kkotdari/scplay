/* 모델 면 스냅샷·대조기 — 모델 좌표 손질(scripts/model-z-scale.mjs)의 검산 자다.
 *
 * ★ 정답을 만들 때 주의: withModelScale 은 바깥 배수를 **덮어쓴다**(곱하지 않는다). 그래서 빌더 안에서 제 배수를 거는
 *   종류(refinery·academy·plane·tank·turret·trapezoid·tombFlat·dship)는 `--zk 0.8` 정답이 틀린다 — 원본 트리에서
 *   withModelScale 을 곱셈으로 잠시 고치거나(입체 정답), 원본 트리를 카메라 누름(TOP_Z_PRESS9 0.8) 그대로 `--modes top`
 *   으로 떠서(평면 진실) 대조한다. `--min 0.2` 로 잔 조각을 걸러야 종류별 순위가 뜻을 가진다.
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
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const has = (n) => argv.includes(n);
const TOL = Number(flag("--tol", 0.03));

if (has("--diff")) {
  const i = argv.indexOf("--diff");
  const A = JSON.parse(readFileSync(argv[i + 1], "utf8"));
  const B = JSON.parse(readFileSync(argv[i + 2], "utf8"));
  const BIG = Number(flag("--big", 0.5));   // 이 이상 어긋나면 '버그급'(도형 단면 차이가 아니라 자리가 틀린 것)
  const MIN = Number(flag("--min", 0));     // 이보다 작은 면(화면 상자 한 변)은 안 센다 — 구·관의 잔 조각은 뒷면 판정만 바뀌어도 어긋난다
  const nums = (d) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const skel = (d) => d.replace(/-?\d+(?:\.\d+)?/g, "#");
  const size = (n) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let t = 0; t + 1 < n.length; t += 2) { x0 = Math.min(x0, n[t]); x1 = Math.max(x1, n[t + 1 - 1]); y0 = Math.min(y0, n[t + 1]); y1 = Math.max(y1, n[t + 1]); } return Math.max(x1 - x0, y1 - y0); };
  const rows = [];
  let badKinds = 0;
  for (const kind of Object.keys(A)) {
    let total = 0; let miss = 0; let big = 0; let worst = 0; let where = ""; let sum = 0;
    for (const key of Object.keys(A[kind])) {
      const fa = A[kind][key]; const fb = (B[kind] ?? {})[key] ?? [];
      /* 통: 채움색|골격 — 같은 통 안에서 **가장 가까운 면**(최대 절대차)을 찾는다. 짝을 독점시키지 않는다 —
         독점(탐욕) 짝짓기는 비슷한 면이 많은 부품(궤도 패드·구 껍질)에서 이웃을 가로채 멀쩡한 면까지 어긋난 것으로 셌다. */
      const bucket = (fs) => { const m = new Map(); for (const f of fs) { const k = `${f[2] ?? ""}|${skel(f[0])}`; (m.get(k) ?? m.set(k, []).get(k)).push(nums(f[0])); } return m; };
      const ma = bucket(fa); const mb = bucket(fb);
      for (const [k, va] of ma) {
        const vb = mb.get(k) ?? [];
        for (const p of va) {
          if (MIN > 0 && size(p) < MIN) continue;
          total += 1;
          let bd = Infinity;
          for (const q of vb) {
            let d = 0;
            for (let t = 0; t < p.length; t += 1) { const e = Math.abs(p[t] - q[t]); if (e > d) { d = e; if (d >= bd) break; } }
            if (d < bd) bd = d;
          }
          if (bd === Infinity) { miss += 1; big += 1; continue; }
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
  console.log(`— 어긋난 종류 ${badKinds}/${Object.keys(A).length} (허용 ${TOL}${MIN > 0 ? ` · 최소 면 ${MIN}` : ""}) · 버그급 종류 ${rows.filter((r) => r[0] > 0).length}`);
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
esbuild9([src, "--bundle", "--platform=node", "--format=esm", "--log-level=error",
  "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${outJs}`], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
const mod = await import(pathToFileURL(outJs).href);
const t0 = Date.now();
const res = mod.snap(ZK, ONLY, ROTS, POSES, MODES);
rmSync(dir, { recursive: true, force: true });
const OUT = String(flag("--out", join(tmpdir(), "faces.json")));
writeFileSync(OUT, JSON.stringify(res));
let nf = 0; for (const k of Object.values(res)) for (const v of Object.values(k)) nf += v.length;
console.log(`${Object.keys(res).length}종 · 면 ${nf} · ${Date.now() - t0}ms → ${OUT}`);
