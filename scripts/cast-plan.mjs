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
 *   ⑤ 띄엄띄엄 잡는 일꾼 견제(드랍)가 한 장면으로 서나(2026-09)
 *   ⑥ 순환이 로스터 차례로 팀을 번갈아 도나(2026-09 · 2v2 소강 판)
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
/** 토막의 자막 글귀 — 사람은 [이름]조사 꼴(ga·ui …는 재생기가 받침 보고 붙일 조사). */
const capTxt = (s) => (s.caps ?? []).map((c) => (c.raw !== undefined ? `[${c.raw}]${c.p ?? ""}` : c.text)).join("");
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
// 800초: A 의 드랍 견제 — 마린 넷이 B 의 드론 다섯을 **6초 간격**으로 잡는다(2026-09, 지적: "드랍견제 같은 중요한
// 장면을 중계안하는 경우가 있네" — 몸값 자로는 한 킬 77.5 · GAP9 4초 밖이라 장면 0개였다) → A 화면 · 장면 하나
const dr = [];
for (let i = 0; i < 5; i += 1) dr.push(mk(1, "Drone", 200, 800 + i * 6, "atk"));
for (const d of dr) mk(0, "Marine", 700, null, "", [d.died - 1, d.tag, d.died, d.tag, d.died + 0.5, 0]);
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
  console.log(`  ${s.at.toFixed(1).padStart(7)}s  ${s.raw}  ${s.cyc ? "순환" : "장면"} ${s.why} ${s.score.toFixed(0)}${s.foe ? ` ⚔ ${s.foe} ${s.role} ~${s.foeTo.toFixed(1)}s` : ""}`, "자막:", (s.caps ?? []).map((c) => (c.raw !== undefined ? "[" + c.raw + "]" + (c.p ?? "") : c.text)).join(""));
}
const at = (t) => plan[castAt9(plan, t)]?.raw ?? "-";
console.log(`짚기: 0s ${at(0)} · 199s ${at(199)} · 262s ${at(262)} · 605s ${at(605)} · 815s ${at(815)}`);
const drop9 = scenes.filter((s) => s.at > 790 && s.at < 830);
const ok = [
  ["첫 장면은 죽인 쪽(A)", scenes[0]?.raw === "A"],
  ["둘째 장면은 죽인 쪽(B)", scenes[1]?.raw === "B"],
  ["나간 몸은 장면이 아니다", !scenes.some((s) => s.at > 590 && s.at < 610)],
  ["초반은 순환", plan[0]?.cyc === true],
  ["띄엄띄엄 잡는 일꾼 견제는 한 장면(A)", drop9.length === 1 && drop9[0].raw === "A" && drop9[0].why === "견제"],
  ["견제 사이·직후에 순환이 안 끼어든다", !plan.some((s) => s.cyc && s.at > 798.5 && s.at < 831)],
  ["견제는 맞대결 — 상대역 B · 견제한 A 는 공격", drop9[0]?.foe === "B" && drop9[0]?.role === "atk"],
  ["군대끼리의 교전은 맞대결 교전(war)", scenes[1]?.foe === "A" && scenes[1]?.role === "war"],
  ["맞대결이 끝난 뒤의 순환은 상대역이 없다", plan.every((s) => !s.cyc || !s.foe)],
];
for (const [name, pass] of ok) console.log(`  ${pass ? "✔" : "✘"} ${name}`);

/* ── ⑦ 포토러시 — 러시한 쪽이 공격이다(2026-10, 지적: "포토러시 간 사람이 공격인데 방어로 나오는 현상") ──
   R(0)의 파일런·캐논 둘이 **Z 본진**(100,100)에서 부서지고(건물 = 살림), Z(1)는 캐논에 드론 하나를 잃고 R 의 프로브도 잡는다. 잃은 살림만 보면
   R 이 더 잃어 방어로 뒤집혔다 — 싸움터가 Z 진영이므로 R 공격 · Z 방어라야 한다. */
let ptag = 5000;
const pl = [];
const pmk = (o, kind, bld, x, y, born, died, end, orders = []) => {
  const e = { tag: (ptag += 1), owner: o, kind, born, bornX: x, bornY: y, died, end, bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders };
  pl.push(e);
  return e;
};
pmk(0, "Nexus", true, 10, 10, 0, null, "");
pmk(1, "Hatchery", true, 100, 100, 0, null, "");
const pr = [pmk(0, "Pylon", true, 95, 95, 100, 200, "atk"), pmk(0, "Photon Cannon", true, 96, 97, 130, 202, "atk"),
  pmk(0, "Photon Cannon", true, 97, 95, 132, 204, "atk")];
const pd = [pmk(1, "Drone", false, 100, 100, 50, 193, "atk", [[185, 98, 99, false]])];
// 러시한 프로브도 Z 본진에서 잡힌다(명령 자리 96,96) — 옛 살림 자로는 R 600 : Z 200 이라 R 이 '방어'로 뒤집혔다
pr.push(pmk(0, "Probe", false, 10, 10, 20, 196, "atk", [[180, 96, 96, false]]));
const pkills = [...pr.map((e) => [e.died, 1, 0, e.tag]), ...pd.map((e) => [e.died, 0, 0, e.tag])];
const pw = { players: [{ owner: 0, name: "R", race: "프로토스", color: "#ff0", team: 1 }, { owner: 1, name: "Z", race: "저그", color: "#0f0", team: 2 }],
  lives: pl, ups: [], casts: [], pings: [], resFields: [], kills: pkills };
const pplan = castPlan9(pw, { total: 400 }).filter((s) => !s.cyc && s.foe);
console.log(`\n포토러시: ${pplan.map((s) => `${s.at.toFixed(0)}s ${s.raw} ${s.role} ⚔ ${s.foe} 자막: ${capTxt(s)}`).join(" · ")}`);
const rOf = (s) => (s.raw === "R" ? s.role : s.role === "atk" ? "def" : s.role === "def" ? "atk" : "war");
for (const [name, pass] of [
  ["포토러시는 러시한 R 이 공격", pplan.length > 0 && pplan.every((s) => rOf(s) === "atk")],
  ["자막은 '포토러시'(상대 기지의 캐논 — 2026-10-09)", pplan.length > 0 && pplan.every((s) => /포토러시/.test(capTxt(s)))],
]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);

/* ── ⑦ 기지 피해 자막(2026-10-09, 되요청: "공격 와서 뭘 부쉈는지까지보다 기지를 반파시킴 대파시킴 궤멸시킴 등으로") — Y 가 X 의 게이트웨이 셋·파일런을 300초에
   부순다(기지 = 넥서스 + 게이트 셋 + 파일런 둘) → 잃은 몫으로 단이 선다 · 파일런 하나만 부수면 "건물 파괴". */
const razeWorld = (nKill) => {
  let rt = 7000;
  const rl = [];
  const rmk = (o, kind, bld, x, y, born, died, end) => { const e = { tag: (rt += 1), owner: o, kind, born, bornX: x, bornY: y, died, end, bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [] }; rl.push(e); return e; };
  rmk(0, "Nexus", true, 10, 10, 0, null, "");
  rmk(1, "Hatchery", true, 100, 100, 0, null, "");
  const vict = [rmk(0, "Gateway", true, 12, 14, 60, null, ""), rmk(0, "Gateway", true, 15, 14, 70, null, ""), rmk(0, "Gateway", true, 18, 14, 80, null, ""),
    rmk(0, "Pylon", true, 8, 8, 20, null, ""), rmk(0, "Pylon", true, 20, 8, 30, null, "")];
  const dead = vict.slice(0, nKill);
  dead.forEach((e, i) => { e.died = 300 + i * 1.5; e.end = "atk"; });
  for (let i = 0; i < 6; i += 1) rmk(1, "Zergling", 200, null, "");
  return { world: { players: [{ owner: 0, name: "X", race: "프로토스", color: "#ff0", team: 1 }, { owner: 1, name: "Y", race: "저그", color: "#0f0", team: 2 }],
    lives: rl, ups: [], casts: [], pings: [], resFields: [], kills: dead.map((e) => [e.died, 1, 0, e.tag]) } };
};
const razeCap = (nKill) => { const pl9 = castPlan9(razeWorld(nKill).world, { total: 600 }).filter((s) => !s.cyc); return pl9.length > 0 ? capTxt(pl9[0]) : "(장면 없음)"; };
const raze4 = razeCap(4); const raze1 = razeCap(1);
console.log(`\n기지 피해: 넷 부숨 → ${raze4} · 하나 부숨 → ${raze1}`);
for (const [name, pass] of [
  ["건물 넷을 잃으면 기지 피해 단(반파·대파·궤멸)", /\[Y\]ga \[X\] 기지 (반파|대파|궤멸)시킴/.test(raze4)],   // ga = 재생기가 받침 보고 붙일 '가/이'
  ["파일런 하나면 건물 파괴", /\[Y\]ga \[X\] 건물 파괴/.test(raze1)],
]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);

/* ── ⑨ 기지 싸움 · vs · 일꾼 견제 유닛 · 폭탄드랍(2026-10-09, 요청: "교전 시 vs 로 팀 갈라서 · 특정 기지에서 교전 시 공격·방어·헬프로 기술 · 리버 일꾼 견제 · 폭탄드랍") ──
   P(0)·Q(1) 대 F(2)·G(3) 2v2. ① 300초: P 의 앞마당(60,50)에서 F 의 히드라가 P 의 드라군 셋을 잡는다 — 출발 자리 선으로는 가운데(교전)지만 P 의 기지라 F 의 공격이다.
   ② 500초: 지도 가운데(55,55 · 아무 기지도 아님)에서 P 의 질럿이 F 의 저글링 넷을, G 의 히드라가 Q 의 드라군 하나를 잡는다 → 호각 교전 "P·Q vs F·G".
   ③ 700초: F 의 리버(처치 절의 킬러 태그)가 P 의 프로브 셋을 잡는다 → "F의 P 리버 일꾼 견제". ④ 850초: F 의 셔틀이 P 본진(10,10)으로 명령받고 F 의 질럿이 P 의 프로브·드라군을 잡는다 → "폭탄드랍". */
const dw9 = (() => {
  let dt = 11000;
  const dl = [];
  const dmk = (o, kind, bld, x, y, born, died, end, orders = [], tgt) => { const e = { tag: (dt += 1), owner: o, kind, born, bornX: x, bornY: y, died, end, bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders }; if (tgt) e.tgt = Float64Array.from(tgt); dl.push(e); return e; };
  dmk(0, "Nexus", true, 10, 10, 0, null, ""); dmk(0, "Nexus", true, 60, 50, 100, null, "");
  dmk(1, "Nexus", true, 10, 100, 0, null, ""); dmk(2, "Hatchery", true, 100, 100, 0, null, ""); dmk(3, "Hatchery", true, 100, 10, 0, null, "");
  const kills = [];
  // ① P 앞마당의 싸움 — F 의 히드라 넷이 P 의 드라군 셋을 겨눈다(죽은 자리 = 마지막 명령 62,52)
  const dg = [300, 301, 302].map((t) => dmk(0, "Dragoon", false, 10, 10, 150, t, "atk", [[290, 62, 52, false]]));
  for (const d of dg) dmk(2, "Hydralisk", false, 100, 100, 150, null, "", [], [299, d.tag, 302.5, d.tag, 303, 0]);
  // ② 가운데 호각 교전
  const zl = [500, 500.5, 501, 501.5].map((t) => dmk(2, "Zergling", false, 100, 100, 400, t, "atk", [[495, 55, 55, false]]));
  for (const z of zl) dmk(0, "Zealot", false, 10, 10, 400, null, "", [], [499, z.tag, 501.5, z.tag, 502, 0]);
  const qd = dmk(1, "Dragoon", false, 10, 100, 400, 501, "atk", [[495, 56, 54, false]]);
  dmk(3, "Hydralisk", false, 100, 10, 400, null, "", [], [499, qd.tag, 501.5, qd.tag, 502, 0]);
  // ③ 리버 일꾼 견제 — 처치 절(kills)에 킬러 태그가 리버
  const rv = dmk(2, "Reaver", false, 100, 100, 600, null, "");
  for (const t of [700, 704, 708]) { const p = dmk(0, "Probe", false, 12, 12, 0, t, "atk", [[t - 2, 12, 12, false]]); kills.push([t, 2, rv.tag, p.tag]); }
  // ④ 폭탄드랍 — F 의 셔틀이 P 본진으로(845초 명령) · F 의 질럿 둘이 P 의 프로브 둘·드라군 하나를 잡는다
  dmk(2, "Shuttle", false, 100, 100, 700, null, "", [[845, 12, 12, false]]);
  const vict = [dmk(0, "Probe", false, 12, 12, 0, 850, "atk", [[848, 12, 12, false]]), dmk(0, "Probe", false, 12, 12, 0, 851, "atk", [[848, 12, 12, false]]),
    dmk(0, "Dragoon", false, 10, 10, 800, 852, "atk", [[848, 12, 12, false]])];
  for (const v of vict) dmk(2, "Zealot", false, 100, 100, 700, null, "", [], [849, v.tag, 852.5, v.tag, 853, 0]);
  return { players: [["P", 1], ["Q", 1], ["F", 2], ["G", 2]].map(([name, team], o) => ({ owner: o, name, race: "프로토스", color: "#fff", team })),
    lives: dl, ups: [], casts: [], pings: [], resFields: [], kills };
})();
const dplan9 = castPlan9(dw9, { total: 1000, order: ["P", "Q", "F", "G"], teamOf: { P: 1, Q: 1, F: 2, G: 2 } }).filter((s) => !s.cyc);
const dAt9 = (t) => dplan9.find((s) => Math.abs(s.at - t) < 6);
const d1 = dAt9(298.5); const d2 = dAt9(498.5); const d3 = dAt9(698.5); const d4 = dAt9(848.5);
const dshow = (s) => (s ? `${s.at.toFixed(0)}s ${s.raw} ${s.role ?? "-"} ${capTxt(s)}` : "(장면 없음)");
console.log(`\n기지 싸움·vs·견제·드랍: ${[d1, d2, d3, d4].map(dshow).join(" · ")}`);
for (const [name, pass] of [
  ["앞마당의 싸움은 기지 싸움 — F 의 공격(교전이 아니다)", !!d1 && d1.role === (d1.raw === "F" ? "atk" : "def") && /공격/.test(capTxt(d1)) && !/교전/.test(capTxt(d1))],
  ["가운데 호각 교전은 vs 로 팀을 가른다", !!d2 && d2.role === "war" && /\[P\]\[Q\] vs \[F\]\[G\] 교전|\[F\]\[G\] vs \[P\]\[Q\] 교전|\[Q\]\[P\] vs|\[G\]\[F\] vs/.test(capTxt(d2))],
  ["리버가 잡은 일꾼은 '리버 일꾼 견제'", !!d3 && /\[F\]ui \[P\] 리버 일꾼 견제/.test(capTxt(d3))],
  ["셔틀이 본진으로 간 뒤의 싸움은 '폭탄드랍'", !!d4 && /폭탄드랍/.test(capTxt(d4))],
]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);

/* ── ⑧ 빌드 읽기(2026-10-09, 요청: "소강 상태에서 '누구 운영'이라는 자막보다는 … 초반/중반 빌드에 대한 분석") — 사건 없는 FFA 넷 · 착공 차례만 다르다 ── */
const bw9 = (() => {
  let bt = 9000;
  const bl = [];
  const bmk = (o, kind, born, bld = true, died = null, end = "") => { const e = { tag: (bt += 1), owner: o, kind, born, bornX: 10, bornY: 10, died, end, bld,
    sites: bld ? [[born, 9, 9]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [] }; bl.push(e); return e; };
  bmk(0, "Hatchery", 0); bmk(1, "Hatchery", 0); bmk(2, "Nexus", 0); bmk(3, "Command Center", 0);
  // Z1 선스포닝풀 → 해처리 → 레어   |  Z2 노스포닝풀 해처리 → 스포닝풀 → 셋째 해처리
  bmk(0, "Spawning Pool", 60); bmk(0, "Hatchery", 150); bmk(0, "Lair", 500);
  bmk(1, "Hatchery", 90); bmk(1, "Spawning Pool", 150); bmk(1, "Hatchery", 400);
  // P1 게이트 → 넥서스(코어 앞 = 빠른) → 코어 → 로보틱스   |  T1 배럭 둘(팩토리 앞 = 투배럭) → 팩토리 → 커맨드(팩토리 뒤 = 앞마당)
  bmk(2, "Gateway", 60); bmk(2, "Nexus", 150); bmk(2, "Cybernetics Core", 200); bmk(2, "Robotics Facility", 400);
  bmk(3, "Barracks", 60); bmk(3, "Barracks", 120); bmk(3, "Factory", 200); bmk(3, "Command Center", 300);
  for (let i = 0; i < 6; i += 1) bmk(2, "Zealot", 700 + i * 5, false);   // P1 은 700초대에 병력이 한창
  // Z3 — 드론 넷으로 시작해 넷을 더 뽑고(8드론) 70초에 스포닝풀 → "8드론 저글링러시"  |  P2 — 게이트 → 코어 → 게이트 둘(240초에 셋째) → "3게이트"
  bmk(4, "Hatchery", 0); for (let i = 0; i < 8; i += 1) bmk(4, "Drone", i < 4 ? 0 : 20 + i * 6, false); bmk(4, "Spawning Pool", 70);   // 70초엔 드론 여덟
  bmk(5, "Nexus", 0); bmk(5, "Gateway", 60); bmk(5, "Cybernetics Core", 120); bmk(5, "Gateway", 200); bmk(5, "Gateway", 240);
  return { players: [["Z1", "저그"], ["Z2", "저그"], ["P1", "프로토스"], ["T1", "테란"], ["Z3", "저그"], ["P2", "프로토스"]].map(([name, race], o) => ({ owner: o, name, race, color: "#fff", team: 0 })),
    lives: bl, ups: [], casts: [], pings: [], resFields: [] };
})();
const bplan9 = castPlan9(bw9, { total: 900, order: ["Z1", "Z2", "P1", "T1", "Z3", "P2"] });
/** raw 의 토막 중 at ∈ [t, t + 60) 첫 것의 자막(여섯이 돌아가니 48초마다 제 차례). */
const capAt9 = (raw, t) => { const sg = bplan9.find((s) => s.raw === raw && s.at >= t && s.at < t + 60); return sg ? capTxt(sg) : "(토막 없음)"; };
const bcases9 = [
  ["Z1", 64, "[Z1] 선스포닝풀"], ["Z1", 155, "[Z1] 선스포닝풀 후 해처리"], ["Z1", 505, "[Z1] 레어 테크"],
  ["Z2", 95, "[Z2] 노스포닝풀 해처리"], ["Z2", 155, "[Z2] 해처리 후 스포닝풀"], ["Z2", 405, "[Z2] 3해처리 늘리기"], ["Z2", 800, "[Z2] 3기지 운영 중"],
  ["P1", 155, "[P1] 빠른 넥서스 늘리기"], ["P1", 205, "[P1] 코어 테크"], ["P1", 405, "[P1] 로보틱스 테크"], ["P1", 735, "[P1] 병력 모으는 중"],
  ["T1", 125, "[T1] 2배럭"], ["T1", 205, "[T1] 팩토리 테크"], ["T1", 305, "[T1] 앞마당 커맨드 늘리기"], ["T1", 800, "[T1] 순조로운 발전 중"],
  ["Z3", 75, "[Z3] 8드론 저글링러시"], ["P2", 245, "[P2] 3게이트"],
];
console.log(`\n빌드 읽기: ${bcases9.slice(0, 4).map(([r, t]) => `${r}@${t}s ${capAt9(r, t)}`).join(" · ")} …`);
for (const [raw, t, want] of bcases9) { const got = capAt9(raw, t); console.log(`  ${got === want ? "✔" : "✘"} ${raw} ${t}s → ${want}${got === want ? "" : ` (실제 ${got})`}`); }

/* ── ⑥ 순환 차례 — 2v2 · 사건 없는 60초(2026-09, 요청: "순환할때 순서를 로스터 순으로 팀 번갈아가며") ── */
const q4 = { players: [0, 1, 2, 3].map((o) => ({ owner: o, name: "PQRS"[o], race: "테란", color: "#fff", team: o < 2 ? 1 : 2 })),
  lives: [0, 1, 2, 3].map((o) => ({ tag: 900 + o, owner: o, kind: "Command Center", born: 0, bornX: 10, bornY: 10, died: null, end: "",
    bld: true, sites: [], doneAt: 0, lifts: [], cloaks: [], sieges: [], orders: [] })),
  ups: [], casts: [], pings: [], resFields: [] };
// 로스터 차례 P·Q(1팀) · R·S(2팀) → 고리 P R Q S
const seq4 = castPlan9(q4, { total: 60, order: ["P", "Q", "R", "S"], teamOf: { P: 1, Q: 1, R: 2, S: 2 } }).map((s) => s.raw).join("");
const seqM = castPlan9(q4, { total: 60, order: ["P", "Q", "R", "S"] }).map((s) => s.raw).join("");
console.log(`
순환 차례: 팀전 ${seq4} · 밀리 ${seqM}`);
for (const [name, pass] of [
  ["팀전은 로스터 차례로 팀을 번갈아(PRQS…)", "PRQSPRQS".startsWith(seq4) && seq4.length >= 4],
  ["밀리는 로스터 차례 그대로(PQRS…)", "PQRSPQRS".startsWith(seqM) && seqM.length >= 4],
]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);

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
