/* 2D 판 단 올림표 뽑기(2026-10-27, 지적: "같은 배율에서 큰유닛이 다른 유닛보다 흐린 현상" → "중간으로") ─────────────────────
 *
 *   node scripts/spr-lift.mjs            장면 시트(세 종족 · 배율 3 · 올림 끔)에서 몸마다 늘림을 재서 src/components/replay/sprLift.gen.ts 를 쓴다
 *   node scripts/spr-lift.mjs --check    다시 재서 표와 같은가(다르면 1)
 *   (--probe <json> 이미 잰 실측으로 표만 · --keep <dir> 장면 시트 그림을 남길 자리)
 *
 * 늘림 = 화면 배율(kd) ÷ 찍은 단의 배율 — 클수록 같은 배율에서 흐리다. 기준은 **유닛 늘림의 중간값**이고, 그 TARGET 배를 넘는 종류(유닛·건물)마다
 * ¼ 옥타브 칸을 올려 TARGET 아래로 맞춘다(gl9 sprLv9 · 올린 칸은 SPR_CAP 을 넘는다 — 유닛 MAX_U 칸 · 건물 MAX_B 칸까지).
 * ★ 표를 바꿨으면 아틀라스를 다시 굽는다(`node scripts/spr-atlas.mjs --bake --prune --basisu <path>` — 칸 열쇠의 단이 바뀐다 · --check 가 판 해시로 잡는다).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const flag = (f, d) => { const i = argv.indexOf(f); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const GEN = join(ROOT, "src/components/replay/sprLift.gen.ts");
/** 맞출 늘림 — 유닛 중간값의 몇 배까지 두나(요청 "중간으로" = 1.3 · 옛 최악 3.5). */
const TARGET = 1.3;
/** 올림 상한(¼ 옥타브 칸) — 유닛 6(2.83배 · 160 → 452px) · 건물 4(2배 · 512 → 1024px = 재생기 굽는 판 SPR_SCR9). */
const MAX_U = 6; const MAX_B = 4;

let probe;
if (flag("--probe", "")) probe = JSON.parse(readFileSync(flag("--probe", ""), "utf8"));
else {
  const dir = flag("--keep", "") || mkdtempSync(join(tmpdir(), "spr-lift-"));
  const out = join(dir, "probe.json");
  execFileSync("node", [join(ROOT, "scripts/scene-sheet.mjs"), "--out", dir, "--zoom", "3", "--dpr", "2", "--noshadow", "--hash", "sprlift=0", "--sprprobe", out],
    { stdio: ["ignore", "inherit", "inherit"], timeout: 1800_000 });
  probe = JSON.parse(readFileSync(out, "utf8"));
}
const units = Object.entries(probe).filter(([k]) => k.startsWith("u:")).map(([, v]) => v).sort((a, b) => a - b);
if (units.length < 20) { console.error(`[올림] 유닛 실측이 ${units.length} 종류뿐이다 — 장면 시트가 덜 그렸다`); process.exit(2); }
const med = units[Math.floor(units.length / 2)];
const lift = {};
for (const [k, v] of Object.entries(probe).sort()) {
  const [t, kind] = k.split(":");
  const r = v / med;
  if (r <= TARGET) continue;
  const n = Math.min(t === "u" ? MAX_U : MAX_B, Math.ceil(Math.log2(r / TARGET) * 4 - 1e-6));
  if (n > 0) lift[kind] = Math.max(lift[kind] ?? 0, n);
}
const rows = Object.entries(lift).sort(([a], [b]) => a.localeCompare(b));
const body = rows.map(([k, n]) => {
  const r = (probe[`u:${k}`] ?? probe[`b:${k}`]) / med;
  return `  ${JSON.stringify(k)}: ${n},   // 늘림 ${r.toFixed(2)} → ${(r / 2 ** (n / 4)).toFixed(2)}`;
}).join("\n");
const src = `/* 2D 판 단 올림표 — **미리 구운 것**(자동 생성) ──────────────────────────────────────────
 *  만드는 법: \`node scripts/spr-lift.mjs\` · 검사: \`node scripts/spr-lift.mjs --check\`
 *  손으로 고치지 않는다. 종류 → 찍는 단(gl9 sprLv9)에 더할 ¼ 옥타브 칸 수. 늘림은 유닛 중간값(${med.toFixed(3)})에 견준 배(올림 전 → 뒤 · 목표 ${TARGET} 이하).
 *  ★ 모델·크기표(MODEL_NORM·BLD_NORM·UNIT_SIZE_TUNE·BLD_DRAW_TUNE)를 고치면 다시 뽑고 아틀라스도 다시 굽는다. */
export const SPR_LIFT9: Record<string, number> = {
${body}
};
`;
const cur = existsSync(GEN) ? readFileSync(GEN, "utf8") : "";
const pick = (s) => JSON.stringify([...s.matchAll(/^\s+"([^"]+)": (\d+),/gm)].map((m) => [m[1], m[2]]));
if (has("--check")) {
  if (pick(cur) !== pick(src)) { console.log("[올림] 표가 실측과 다르다 — node scripts/spr-lift.mjs 로 다시 뽑고 아틀라스를 다시 굽는다"); console.log(body); process.exit(1); }
  console.log(`[올림] 표 그대로(${rows.length} 종류)`);
} else {
  writeFileSync(GEN, src);
  console.log(`[올림] ${rows.length} 종류 → ${GEN}\n${body}`);
}
