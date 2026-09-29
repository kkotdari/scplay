/* 중계 편성표(cast9) 자 — 합성 참값으로 castPlan9 을 돌려 토막과 굽는 값을 찍는다 ─────
 *
 *   node scripts/cast-plan.mjs              토막 목록 + 굽는 시간
 *   node scripts/cast-plan.mjs --plan       토막을 전부 찍는다(기본은 장면만)
 *
 * 왜 합성인가 — 참값 자취(OBWT)는 서버가 굽는 것이라 저장소에 없다. 편성표가 재는 것은
 * '죽음·마법이 언제 누구에게 몰렸나' 하나뿐이므로, 그 사건만 손으로 심으면 규칙(장면 묶기 ·
 * 죽인 쪽 되짚기 · 나간 사람 거르기 · 순환)이 그대로 검사된다.
 *
 * 무엇을 보나
 *   ① 장면의 임자 — 죽인 쪽이 잡히나(잃은 쪽이 아니라)
 *   ② 한꺼번에 사라지는 몸(나감)이 가짜 장면을 안 만드나
 *   ③ 소강·초반이 순환으로 채워지나
 *   ④ 굽는 값 — 8인 20분 판에서 몇 ms 인가(메인 스레드에서 한 번 도는 값이다) */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const ALL = argv.includes("--plan");
const EBIN = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
const tmp = mkdtempSync(join(tmpdir(), "cast-"));
const src = join(tmp, "entry.ts");
writeFileSync(src, `export { castPlan9, castAt9, castValue9 } from "${join(ROOT, "src/components/replay/cast9")}";\n`);
execFileSync(EBIN, [src, "--bundle", "--platform=node", "--format=esm", "--log-level=error", `--outfile=${join(tmp, "b.mjs")}`],
  { cwd: ROOT, stdio: "inherit" });
const { castPlan9, castAt9, castValue9 } = await import(join(tmp, "b.mjs"));

console.log("몸값:", ["Zergling", "Marine", "Dragoon", "Siege Tank", "Archon", "Battlecruiser", "Lurker", "Guardian", "Command Center"]
  .map((k) => `${k} ${castValue9(k)}`).join(" · "));

/* ── ① 규칙 판 — 1v1 20분 ──────────────────────────────────────────────────── */
let tag = 1;
const lives = [];
const mk = (o, kind, born, died, end, tgt) => {
  const e = { tag: (tag += 1), owner: o, kind, born, bornX: 10, bornY: 10, died, end, bld: false,
    sites: [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [] };
  if (tgt) e.tgt = Float64Array.from(tgt);
  lives.push(e);
  return e;
};
// 200초: A(0)가 B(1)의 저글링 넷을 잡는다 → A 화면
const zl = [];
for (let i = 0; i < 4; i += 1) zl.push(mk(1, "Zergling", 100, 200 + i * 0.4, "atk"));
for (const z of zl) mk(0, "Marine", 100, null, "", [199.5, z.tag, 201, z.tag, 202, 0]);
// 260초: B가 A의 드라군 셋·탱크를 잡는다(+ A의 스톰) → 무게가 큰 쪽이 잡혀야 한다
/* ⚠ 드라군 **셋**이다(2026-09) — 둘이면 B 700 : A 385(잃은 몫) + 260(스톰) = 645 로 8.5% 차라 TIE9(1.12) 안의
   **호각**이고, 그때는 규칙대로 순환 원칙(가장 오래 안 본 사람)이 가르므로 답이 순환 토막의 위상(CYCLE9)에 따라
   A·B 를 오갔다(실측: 9초·14초는 B · 8초는 A). '죽인 쪽이 잡히나'를 보려면 장면이 호각이 아니어야 한다 —
   셋이면 900 : 755(1.19)로 문 밖이다. */
const dg = [mk(0, "Dragoon", 200, 260, "atk"), mk(0, "Dragoon", 200, 261, "atk"), mk(0, "Dragoon", 200, 261.5, "atk"),
  mk(0, "Siege Tank", 200, 262.5, "atk")];
for (const d of dg) mk(1, "Hydralisk", 200, null, "", [259.5, d.tag, 261.5, d.tag, 263, 0]);
// 600초: B가 나간다 — 몸 열둘이 한꺼번에 사라지고 겨눈 자가 없다(가짜 장면이면 안 된다)
for (let i = 0; i < 12; i += 1) mk(1, "Drone", 200, 600, "atk");
mk(0, "Command Center", 0, null, "");
mk(1, "Hatchery", 0, null, "");
const world = {
  players: [{ owner: 0, name: "A", race: "테란", color: "#f00", team: 1 },
    { owner: 1, name: "B", race: "저그", color: "#00f", team: 2 }],
  lives, ups: [], casts: [[264, 30, 30, "Psionic Storm", 0]], pings: [], resFields: [],
};
const plan = castPlan9(world, { total: 1200 });
const scenes = plan.filter((s) => !s.cyc);
console.log(`\n토막 ${plan.length}개(장면 ${scenes.length} · 순환 ${plan.length - scenes.length})`);
for (const s of (ALL ? plan : scenes)) {
  console.log(`  ${s.at.toFixed(1).padStart(7)}s  ${s.raw}  ${s.cyc ? "순환" : "장면"} ${s.why} ${s.score.toFixed(0)}`);
}
const at = (t) => plan[castAt9(plan, t)]?.raw ?? "-";
console.log(`짚기: 0s ${at(0)} · 199s ${at(199)} · 262s ${at(262)} · 605s ${at(605)}`);
const ok = [
  ["첫 장면은 죽인 쪽(A)", scenes[0]?.raw === "A"],
  ["둘째 장면은 죽인 쪽(B)", scenes[1]?.raw === "B"],
  ["나간 몸은 장면이 아니다", !scenes.some((s) => s.at > 590 && s.at < 610)],
  ["초반은 순환", plan[0]?.cyc === true],
];
for (const [name, pass] of ok) console.log(`  ${pass ? "✔" : "✘"} ${name}`);

/* ── ② 값 — 8인 20분(생애 8천 · 겨눔 자국 넉넉히) ─────────────────────────── */
const big = { players: [], lives: [], ups: [], casts: [], pings: [], resFields: [] };
for (let o = 0; o < 8; o += 1) big.players.push({ owner: o, name: `P${o}`, race: "테란", color: "#fff", team: (o % 2) + 1 });
let btag = 1;
for (let i = 0; i < 8000; i += 1) {
  const o = i % 8;
  const born = (i % 1100) + 1;
  const died = born + 30 + (i % 90);
  const t9 = [];
  for (let k = 0; k < 4; k += 1) t9.push(died - 3 + k, (i % 8000) + 2);
  big.lives.push({ tag: (btag += 1), owner: o, kind: i % 3 === 0 ? "Marine" : i % 3 === 1 ? "Zergling" : "Dragoon",
    born, bornX: 10, bornY: 10, died: died < 1200 ? died : null, end: died < 1200 ? "atk" : "",
    bld: false, sites: [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], tgt: Float64Array.from(t9) });
}
const t0 = performance.now();
const big9 = castPlan9(big, { total: 1200 });
const ms = performance.now() - t0;
console.log(`\n값: 8인 · 생애 ${big.lives.length} · 겨눔 자국 ${big.lives.length * 4} → 토막 ${big9.length}개 · ${ms.toFixed(1)}ms`);
rmSync(tmp, { recursive: true, force: true });
