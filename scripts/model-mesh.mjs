#!/usr/bin/env node
/* 모델 메시 검사·미리보기 — 빌더를 요잉 0 으로 굽고 3D 메시(판 모형 공간)를 모아
   종류별 덮임(메시 있는 면/전체 면)을 표로 찍고, --svg 로 메시만 회전·조명해 그린 미리보기를 낸다.
   node scripts/model-mesh.mjs [--kinds a,b] [--pose 0] [--svg out.svg --rots 0,45,90,180 --cell 160]
   덮임이 낮은 종류는 곡선 도형이 아직 메시를 안 적는 자리다 — shapeOblique 의 헬퍼에 meshPut9 를 더한다. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const has = (n) => argv.includes(n);
const ONLY = flag("--kinds", null) ? String(flag("--kinds")).split(",") : null;
const POSE = Number(flag("--pose", 0));
const SVG = flag("--svg", null);
const ROTS = String(flag("--rots", "0,45,90,180")).split(",").map(Number);
const CELL = Number(flag("--cell", 160));
/* --dump — 그 종류의 **부품 하나하나**를 찍는다(채움색·알파·폴리 수·z 범위·빌보드). 2D 에는 있는데 GL 에서 빠진 면을
   찾는 자다: 덧칠로 접힌 면(skipped)과 몸으로 남은 부품을 한 줄씩 본다. */
const DUMP = argv.includes("--dump");
const ENTRY = `
import { SHAPE_BUILDERS, poseSet9, headYawSet } from ${JSON.stringify(join(ROOT, "src/components/replay/bake9"))};
import { collectMesh9 } from ${JSON.stringify(join(ROOT, "src/utils/mesh9"))};
export function run(only, pose) {
  const out = {};
  for (const kind of only ?? Object.keys(SHAPE_BUILDERS)) {
    const b = SHAPE_BUILDERS[kind]; if (!b) continue;
    poseSet9(pose); headYawSet(0);
    try { out[kind] = collectMesh9(b); } catch (e) { out[kind] = { err: String(e).slice(0, 80), parts: [], faces: 0, covered: 0, skipped: 0, blank: 0 }; }
  }
  poseSet9(0);
  return out;
}`;
const dir = mkdtempSync(join(tmpdir(), "mesh9-"));
const src = join(dir, "entry.ts"); const outJs = join(dir, "entry.mjs");
writeFileSync(src, ENTRY);
execFileSync(process.execPath, [join(ROOT, "node_modules/esbuild/bin/esbuild"), src, "--bundle", "--platform=node", "--format=esm", "--log-level=error",
  "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${outJs}`], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
const mod = await import(pathToFileURL(outJs).href);
const t0 = Date.now();
const res = mod.run(ONLY, POSE);
rmSync(dir, { recursive: true, force: true });
const rows = [];
let totF = 0, totC = 0;
for (const [kind, m] of Object.entries(res)) {
  // 분모는 **되찾아야 하는 낯**만 — 접힌 덧칠(skipped)과 헬퍼가 일부러 비워 둔 낯(blank)은 뺀다.
  const body = m.faces - m.skipped - (m.blank ?? 0); totF += body; totC += m.covered;
  const np = m.parts.reduce((a, p) => a + p.polys.length, 0);
  rows.push([body ? m.covered / body : 1, `${kind.padEnd(16)} 면 ${String(body).padStart(5)}  메시 ${String(m.covered).padStart(5)}  (${Math.round(100 * (body ? m.covered / body : 1))}%)  폴리 ${String(np).padStart(6)}${m.err ? "  ⚠ " + m.err : ""}`]);
}
rows.sort((a, b) => a[0] - b[0]);
console.log(rows.map((r) => r[1]).join("\n"));
console.log(`— ${rows.length}종 · 덮임 ${totC}/${totF} (${Math.round(100 * totC / Math.max(1, totF))}%) · ${Date.now() - t0}ms`);

/* ★ **덮임 100% 가 관문이다**(2026-09, 요청: "우회로 없애고 … 승격하는 과정 없앨 수 있어?") ──
   면을 내는 자가 제 3D 폴리곤을 함께 적는다(`meshPut9`). 안 적으면 그 면은 **그냥 빠진다** —
   경로를 글자로 도로 읽어 3D 를 지어 내던 길(mesh9 meshFromPath9)은 걷었기 때문이다.
   그러니 덮임이 100% 아래로 내려가면 곧 '3D 를 안 적은 줄'이 새로 들어왔다는 말이다.
   어느 줄인지는 `node scripts/miss-sites.mjs` 가 짚어 준다(`--dump` 의 ⚠ 빠진 면도 같은 것).
   ⚠ **기준선 파일은 없다** — 빠진 면은 늘 0 이어야 하는 값이라 눌러 둘 자리가 아니다. */
if (has("--check")) {
  if (totC < totF) {
    console.error(`✗ 덮임 ${totC}/${totF} — 3D 를 안 적은 낯이 ${totF - totC} 개 있다.`);
    console.error("  어느 줄인지: node scripts/miss-sites.mjs");
    process.exit(1);
  }
  console.log("✔ 덮임 100% — 3D 를 안 적은 낯 없음");
}
if (DUMP) {
  for (const [kind, m] of Object.entries(res)) {
    console.log(`\n== ${kind} 면 ${m.faces} · 몸 부품 ${m.parts.length} · 덧칠로 접힘 ${m.skipped} · 딴 낯이 냄 ${m.blank ?? 0} · 빠짐 ${m.faces - m.skipped - (m.blank ?? 0) - m.covered}`);
    for (const d of m.missed ?? []) console.log(`  ⚠ 빠진 면 ${d}`);
    m.parts.forEach((p, i) => {
      let z0 = Infinity, z1 = -Infinity, n = 0;
      for (const poly of p.polys) for (let k = 2; k < poly.length; k += 3) { z0 = Math.min(z0, poly[k]); z1 = Math.max(z1, poly[k]); n += 1; }
      console.log(`  #${String(i).padStart(3)} ${(p.team ? "(임자)" : p.fill).padEnd(9)} a=${p.alpha.toFixed(2)} 폴리${String(p.polys.length).padStart(3)} 점${String(n).padStart(4)} z ${z0.toFixed(2)}~${z1.toFixed(2)}`
        + `${p.solid ? (p.flip ? " 입체↺" : " 입체") : ""}${p.bb ? " 빌보드" : ""}${p.ow > 0.001 ? ` 흰${p.ow.toFixed(2)}` : ""}${p.ob > 0.001 ? ` 검${p.ob.toFixed(2)}` : ""}`);
    });
  }
}

/** #rgb/#rrggbb 를 밝기 배수로 곱한 hex — 필터 없이 색에 굽는다(필터는 수천 면에서 매우 느리다). */
const shadeHex = (fill, k) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fill); if (!m) return fill;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const c = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};
if (SVG) {
  // 미리보기 — 판 모형 공간 메시를 요잉·평면 카메라(고각 40°)로 사영해 화가 정렬 + 평면 조명으로 그린다.
  const ELEV = 40 * Math.PI / 180; const cosE = Math.cos(ELEV), sinE = Math.sin(ELEV);
  const L = [-0.4, -0.5, 0.77]; const ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln;
  const kinds = Object.keys(res);
  const W = ROTS.length * CELL, H = kinds.length * CELL;
  const asHtml = !/\.svg$/i.test(String(SVG));
  const cells = [];   // HTML(캔버스)용: [x, y, fill, alpha, pts[]]
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/>`;
  kinds.forEach((kind, ki) => {
    const m = res[kind];
    ROTS.forEach((rot, ri) => {
      const a = -rot * Math.PI / 180; const ca = Math.cos(a), sa = Math.sin(a);
      const tris = [];
      let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      for (const part of m.parts) for (const poly of part.polys) {
        const pts = []; let cx = 0, cy = 0, cz = 0; const n = poly.length / 3;
        for (let i = 0; i < poly.length; i += 3) {
          const x = poly[i] - 8, y = poly[i + 1] - 8, z = poly[i + 2];
          const rx = x * ca - y * sa, ry = x * sa + y * ca;
          pts.push([rx, ry, z]); cx += rx; cy += ry; cz += z;
        }
        cx /= n; cy /= n; cz /= n;
        // 법선(뉴얼)
        let nx = 0, ny = 0, nz = 0;
        for (let i = 0; i < n; i += 1) { const p = pts[i], q = pts[(i + 1) % n]; nx += (p[1] - q[1]) * (p[2] + q[2]); ny += (p[2] - q[2]) * (p[0] + q[0]); nz += (p[0] - q[0]) * (p[1] + q[1]); }
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        // 카메라(위 뒤에서 내려다봄): 화면 x = rx, 화면 y = ry*sinE - z*cosE, 깊이 = ry*cosE + z*sinE
        const scr = pts.map(([x, y, z]) => [x, y * sinE - z * cosE]);
        const depth = cy * cosE + cz * sinE;
        const lit = Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
        const shade = 0.55 + 0.45 * lit;
        const fill = part.team ? "#2b62e8" : (part.fill || "#888");
        tris.push({ scr, depth, shade, fill, alpha: part.alpha });
        for (const [x, y] of scr) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
      }
      tris.sort((p, q) => p.depth - q.depth);
      const span = Math.max(maxx - minx, maxy - miny, 1e-3); const k = (CELL * 0.8) / span;
      const ox = ri * CELL + CELL / 2 - ((minx + maxx) / 2) * k, oy = ki * CELL + CELL / 2 - ((miny + maxy) / 2) * k;
      svg += `<g>`;
      for (const t of tris) {
        const pts = t.scr.map(([x, y]) => [Math.round((ox + x * k) * 10) / 10, Math.round((oy + y * k) * 10) / 10]);
        if (asHtml) { cells.push([shadeHex(t.fill, t.shade), Math.round((t.alpha * 0.35 + 0.65) * 100) / 100, pts.flat()]); continue; }
        const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("") + "Z";
        svg += `<path d="${d}" fill="${shadeHex(t.fill, t.shade)}" fill-opacity="${(t.alpha * 0.35 + 0.65).toFixed(2)}" stroke="#0002" stroke-width="0.3"/>`;
      }
      cells.push(["label", ri * CELL + 4, ki * CELL + 12, `${kind} ${rot}° (${m.parts.length}부품)`]);
      svg += `</g><text x="${ri * CELL + 4}" y="${ki * CELL + 12}" font-size="10" fill="#555">${kind} ${rot}°</text>`;
    });
  });
  svg += "</svg>";
  if (asHtml) {
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><canvas id="c" width="${W}" height="${H}"></canvas><script>
const C=${JSON.stringify(cells)};const g=document.getElementById("c").getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,${W},${H});g.strokeStyle="rgba(0,0,0,.13)";g.lineWidth=.3;
for(const c of C){if(c[0]==="label"){g.globalAlpha=1;g.fillStyle="#555";g.font="10px sans-serif";g.fillText(c[3],c[1],c[2]);continue}
const p=c[2];g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)g.lineTo(p[i],p[i+1]);g.closePath();g.globalAlpha=c[1];g.fillStyle=c[0];g.fill();g.stroke()}
</script>`;
    writeFileSync(String(SVG), html);
  } else writeFileSync(String(SVG), svg);
  console.log(`→ ${SVG}`);
}
