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
  dmk(2, "Shuttle", false, 100, 100, 700, null, "", [[846, 13, 12, false]]);   // 폭탄드랍은 수송선 둘 이상(2026-10-10)
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
  ["리버가 잡은 일꾼은 '리버로 … 일꾼 견제'(서술 · 2026-10-10)", !!d3 && /\[F\]ga 리버로 \[P\] 일꾼 견제/.test(capTxt(d3))],
  ["공격·방어 자막은 'A가 B를 공격' 서술 — '의' 꼴이 없다(2026-10-10)", [d1, d3, d4].every((d) => !d || !/\]ui/.test(capTxt(d)))],
  ["셔틀이 본진으로 간 뒤의 싸움은 '폭탄드랍'", !!d4 && /폭탄드랍/.test(capTxt(d4))],
]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);

/* ── ⑧ 빌드 읽기(2026-10-09, 요청: "소강 상태에서 '누구 운영'이라는 자막보다는 … 초반/중반 빌드에 대한 분석") — 사건 없는 FFA 여섯 · 착공 차례만 다르다 ──
   2026-10-10: 본진 건물은 **자리**로 가른다(cast9 ★★ 자원 무더기) — 지도 192 · 사람마다 본진 무더기(미네랄 다섯 + 가스) · 앞마당(가운데 쪽 22타일) · 셋째(44타일). */
/** 본진 건물이 (x, y) 에 설 기지의 자원 점 — 미네랄 다섯(위 6타일 줄) + 가스(오른 위). */
const baseRes9 = (x, y) => [...[-4, -2, 0, 2, 4].map((dx) => [x + dx, y - 6, 0]), [x + 6, y - 3, 1]];
const toward9 = ([x, y], d) => { const l = Math.hypot(96 - x, 96 - y) || 1; return [Math.round(x + ((96 - x) / l) * d), Math.round(y + ((96 - y) / l) * d)]; };
const bstarts9 = [[20, 20], [172, 20], [20, 172], [172, 172], [96, 20], [96, 172]];
const bres9 = bstarts9.flatMap((st) => [...baseRes9(...st), ...baseRes9(...toward9(st, 22)), ...baseRes9(...toward9(st, 44))]);
const bw9 = (() => {
  let bt = 9000;
  const bl = [];
  const bmk = (o, kind, born, bld = true, at = bstarts9[o]) => { const e = { tag: (bt += 1), owner: o, kind, born, bornX: at[0], bornY: at[1], died: null, end: "", bld,
    sites: bld ? [[born, at[0] - 1, at[1] - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [] }; bl.push(e); return e; };
  const nat = (o) => toward9(bstarts9[o], 22);
  const third = (o) => toward9(bstarts9[o], 44);
  bmk(0, "Hatchery", 0); bmk(1, "Hatchery", 0); bmk(2, "Nexus", 0); bmk(3, "Command Center", 0);
  // Z1 선스포닝풀 → 앞마당 해처리 → 레어   |  Z2 노스포닝풀 앞마당 해처리 → 스포닝풀 → 셋째 기지 해처리
  bmk(0, "Spawning Pool", 60); bmk(0, "Hatchery", 150, true, nat(0)); bmk(0, "Lair", 500);
  bmk(1, "Hatchery", 90, true, nat(1)); bmk(1, "Spawning Pool", 150); bmk(1, "Hatchery", 400, true, third(1));
  // P1 게이트 → 앞마당 넥서스(코어 앞 = 빠른) → 코어 → 로보틱스   |  T1 배럭 둘(팩토리 앞 = 2배럭) → 팩토리 → 앞마당 커맨드(팩토리 뒤)
  bmk(2, "Gateway", 60); bmk(2, "Nexus", 150, true, nat(2)); bmk(2, "Cybernetics Core", 200); bmk(2, "Robotics Facility", 400);
  bmk(3, "Barracks", 60); bmk(3, "Barracks", 120); bmk(3, "Factory", 200); bmk(3, "Command Center", 300, true, nat(3));
  for (let i = 0; i < 6; i += 1) bmk(2, "Zealot", 700 + i * 5, false);   // P1 은 700초대에 병력이 한창
  // Z3 — 드론 넷으로 시작해 넷을 더 뽑고(8드론) 70초에 스포닝풀 → "8드론 스포닝풀 건설"  |  P2 — 게이트 → 코어 → 게이트 둘(240초에 셋째) → "3게이트"
  bmk(4, "Hatchery", 0); for (let i = 0; i < 8; i += 1) bmk(4, "Drone", i < 4 ? 0 : 20 + i * 6, false); bmk(4, "Spawning Pool", 70);   // 70초엔 드론 여덟
  bmk(5, "Nexus", 0); bmk(5, "Gateway", 60); bmk(5, "Cybernetics Core", 120); bmk(5, "Gateway", 200); bmk(5, "Gateway", 240);
  return { players: [["Z1", "저그"], ["Z2", "저그"], ["P1", "프로토스"], ["T1", "테란"], ["Z3", "저그"], ["P2", "프로토스"]].map(([name, race], o) => ({ owner: o, name, race, color: "#fff", team: 0 })),
    lives: bl, ups: [], casts: [], pings: [], resFields: [] };
})();
const bord9 = ["Z1", "Z2", "P1", "T1", "Z3", "P2"];
const bplan9 = castPlan9(bw9, { total: 900, order: bord9, resources: bres9 });
const bplanNo9 = castPlan9(bw9, { total: 900, order: bord9 });   // 자원 자료 없음(옛 판) — 앞마당·멀티라 단정하지 않는다
/** plan 에서 raw 의 토막 중 at ∈ [t, t + 60) 첫 것의 자막(여섯이 돌아가니 48초마다 제 차례). */
const capIn9 = (plan, raw, t) => { const sg = plan.find((s) => s.raw === raw && s.at >= t && s.at < t + 60); return sg ? capTxt(sg) : "(토막 없음)"; };
const capAt9 = (raw, t) => capIn9(bplan9, raw, t);
const bcases9 = [
  ["Z1", 64, "[Z1] 선스포닝풀"], ["Z1", 155, "[Z1] 앞마당 해처리"], ["Z1", 505, "[Z1] 레어 테크"],
  ["Z2", 95, "[Z2] 노스포닝풀 앞마당 해처리"], ["Z2", 155, "[Z2] 해처리 후 스포닝풀"], ["Z2", 405, "[Z2] 2번째 멀티"], ["Z2", 800, "[Z2] 3기지 운영 중"],
  ["P1", 155, "[P1] 빠른 앞마당 넥서스"], ["P1", 205, "[P1] 코어 테크"], ["P1", 405, "[P1] 로보틱스 테크"], ["P1", 735, "[P1] 병력 모으는 중"],
  ["T1", 125, "[T1] 2배럭"], ["T1", 205, "[T1] 팩토리 테크"], ["T1", 305, "[T1] 앞마당 커맨드"], ["T1", 800, "[T1] 순조로운 발전 중"],
  ["Z3", 75, "[Z3] 8드론 스포닝풀 건설"], ["P2", 245, "[P2] 3게이트"],
];
console.log(`\n빌드 읽기: ${bcases9.slice(0, 4).map(([r, t]) => `${r}@${t}s ${capAt9(r, t)}`).join(" · ")} …`);
for (const [raw, t, want] of bcases9) { const got = capAt9(raw, t); console.log(`  ${got === want ? "✔" : "✘"} ${raw} ${t}s → ${want}${got === want ? "" : ` (실제 ${got})`}`); }
/* 자원 자료가 없으면 본진 건물은 수로만(2026-10-10 — "확실하게 알아낸 것만"). */
for (const [raw, t, want] of [["Z1", 155, "[Z1] 2해처리"], ["Z2", 95, "[Z2] 노스포닝풀 2해처리"], ["Z2", 405, "[Z2] 3해처리"], ["P1", 155, "[P1] 2넥서스"], ["T1", 305, "[T1] 2커맨드"]]) {
  const got = capIn9(bplanNo9, raw, t); console.log(`  ${got === want ? "✔" : "✘"} 자원 자료 없음 ${raw} ${t}s → ${want}${got === want ? "" : ` (실제 ${got})`}`);
}

/* ── ⑩ 빨무(본진 무더기뿐인 맵 · 2026-10-10, 지적: "빨무같이 앞마당 없는 맵인데 앞마당 넥서스 건설이라고 나오네 — 3넥서스") — 본진 안의 넥서스·해처리는 수로 센다 ──
   F1(프로토스) 본진 (30,30): 200초 가스 곁(38,33) · 300초 미네랄 곁(22,33) · 400초 무더기 없는 곳(30,46) · F2(저그) 본진 (150,30): 스포닝풀 앞 해처리(158,33) · 뒤 해처리(142,33). */
const fw9 = (() => {
  let ft = 13000;
  const fl = [];
  const fmk = (o, kind, born, bld, x, y) => { const e = { tag: (ft += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [] }; fl.push(e); return e; };
  fmk(0, "Nexus", 0, true, 30, 30); fmk(0, "Nexus", 200, true, 38, 33); fmk(0, "Nexus", 300, true, 22, 33); fmk(0, "Nexus", 400, true, 30, 46);
  fmk(1, "Hatchery", 0, true, 150, 30); fmk(1, "Hatchery", 80, true, 158, 33); fmk(1, "Spawning Pool", 120, true, 150, 36); fmk(1, "Hatchery", 300, true, 142, 33);
  return { players: [["F1", "프로토스"], ["F2", "저그"]].map(([name, race], o) => ({ owner: o, name, race, color: "#fff", team: 0 })), lives: fl, ups: [], casts: [], pings: [], resFields: [] };
})();
const fplan9 = castPlan9(fw9, { total: 900, order: ["F1", "F2"], resources: [...baseRes9(30, 30), ...baseRes9(150, 30)] });
console.log(`\n빨무: ${[["F1", 205], ["F1", 305], ["F1", 405], ["F2", 85], ["F2", 305]].map(([r, t]) => `${r}@${t}s ${capIn9(fplan9, r, t)}`).join(" · ")}`);
for (const [raw, t, want] of [["F1", 205, "[F1] 2넥서스"], ["F1", 305, "[F1] 3넥서스"], ["F1", 405, "[F1] 4넥서스"], ["F1", 800, "[F1] 순조로운 발전 중"],
  ["F2", 85, "[F2] 노스포닝풀 2해처리"], ["F2", 305, "[F2] 3해처리"]]) {
  const got = capIn9(fplan9, raw, t); console.log(`  ${got === want ? "✔" : "✘"} ${raw} ${t}s → ${want}${got === want ? "" : ` (실제 ${got})`}`);
}

/* ── ⑪ 이사(2026-10-10, 지적: "기지가 대파돼서 아군 기지로 이사 가서 새로 해처리를 짓는데 7해처리라고 나와 — 누구 기지로 이사") ──
   1팀 Z·A·W · 2팀 E. Z 는 500초에 본진 해처리를 잃고 520초에 A 기지 곁에 해처리 → "Z A 기지로 이사" · W 는 제 본진이 멀쩡한 채 300초에 A 기지에 해처리 → "W A 기지에 해처리 건설" ·
   E 는 400초에 커맨드를 잃고 450초에 제 자리에 다시 → "본진 재건". */
const mw9 = (() => {
  let mt = 15000;
  const ml = [];
  const mmk = (o, kind, born, bld, x, y, died = null, end = "") => { const e = { tag: (mt += 1), owner: o, kind, born, bornX: x, bornY: y, died, end, bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [] }; ml.push(e); return e; };
  mmk(0, "Hatchery", 0, true, 20, 20, 500, "atk"); mmk(0, "Drone", 0, false, 20, 20); mmk(0, "Hatchery", 520, true, 28, 174);
  mmk(1, "Hatchery", 0, true, 20, 170); mmk(1, "Drone", 0, false, 20, 170);
  mmk(2, "Hatchery", 0, true, 170, 170); mmk(2, "Drone", 0, false, 170, 170); mmk(2, "Hatchery", 300, true, 12, 174);
  mmk(3, "Command Center", 0, true, 170, 20, 400, "atk"); mmk(3, "SCV", 0, false, 170, 20); mmk(3, "Command Center", 450, true, 170, 20);
  return { players: [["Z", "저그", 1], ["A", "저그", 1], ["W", "저그", 1], ["E", "테란", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: ml, ups: [], casts: [], pings: [], resFields: [] };
})();
const mplan9 = castPlan9(mw9, { total: 900, order: ["Z", "A", "W", "E"], teamOf: { Z: 1, A: 1, W: 1, E: 2 },
  resources: [...baseRes9(20, 20), ...baseRes9(20, 170), ...baseRes9(170, 170), ...baseRes9(170, 20)] });
console.log(`\n이사: ${[["Z", 521], ["W", 301], ["E", 451]].map(([r, t]) => `${r}@${t}s ${capIn9(mplan9, r, t)}`).join(" · ")}`);
for (const [raw, t, want] of [["Z", 521, "[Z] [A] 기지로 이사"], ["W", 301, "[W] [A] 기지에 해처리 건설"], ["E", 451, "[E] 본진 재건"]]) {
  const got = capIn9(mplan9, raw, t); console.log(`  ${got === want ? "✔" : "✘"} ${raw} ${t}s → ${want}${got === want ? "" : ` (실제 ${got})`}`);
}

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

/* ── ⑫ 기지 밖 일꾼 · 전진/몰래 생산 건물(2026-10-10, 요청: "일꾼 견제는 적 본진의 일꾼을 잡는 경우 · 다른 곳에서 잡는 건 정찰병·도망가는 일꾼 · 전진 건설하는 일꾼" ·
   "몰래배럭, 전진 건설(게이트/팩토리/배럭 등) 전략 판단") — T(0) 본진 (20,20) · Z(1) 본진 (170,170).
   ① 60초 T 배럭 (150,150)(Z 기지 바로 앞 · Z 기지 밖) → "전진 배럭" · 짓는 동안(60~120) 그 곁에서 SCV 여섯이 Z 의 저글링에 잡힘 → "[Z] [T] 전진 건설 일꾼 잡음"
   (되요청 "전진은 거의 적 기지 앞이나 안 · 멀티에 짓는 건 전진 아님" — 가운데(120,120)는 이제 전진이 아니다 · ⑰)
   ② 400초 T 배럭 (165,160)(Z 기지 안 · "몰래는 적기지에 짓는거") → "몰래 배럭" ③ 300초 T 본진(22,22)에서 Z 의 드론 여섯이 T 의 마린에 잡힘 → "[T] [Z] 정찰 일꾼 잡음". */
{
  const pw = (() => {
    let pt = 17000;
    const pl = [];
    const kills = [];
    const pmk = (o, kind, bld, x, y, born, died = null, end = "", orders = [], doneAt = born) => { const e = { tag: (pt += 1), owner: o, kind, born, bornX: x, bornY: y, died, end, bld,
      sites: bld ? [[born, x - 1, y - 1]] : [], doneAt, lifts: [], cloaks: [], sieges: [], orders }; pl.push(e); return e; };
    pmk(0, "Command Center", true, 20, 20, 0); pmk(1, "Hatchery", true, 170, 170, 0);
    pmk(0, "Barracks", true, 150, 150, 60, null, "", [], 120);
    const zl = pmk(1, "Zergling", false, 170, 170, 50);
    for (const t of [90, 91, 92, 93, 94, 95]) { const v = pmk(0, "SCV", false, 20, 20, 0, t, "atk", [[t - 2, 151, 151, false]]); kills.push([t, 1, zl.tag, v.tag]); }
    const mr = pmk(0, "Marine", false, 20, 20, 200);
    for (const t of [300, 301, 302, 303, 304, 305]) { const v = pmk(1, "Drone", false, 170, 170, 0, t, "atk", [[t - 2, 23, 23, false]]); kills.push([t, 0, mr.tag, v.tag]); }
    pmk(0, "Barracks", true, 165, 160, 400, null, "", [], 460);
    return { players: [["T", "테란"], ["Z", "저그"]].map(([name, race], o) => ({ owner: o, name, race, color: "#fff", team: o + 1 })),
      lives: pl, ups: [], casts: [], pings: [], resFields: [], kills };
  })();
  const pplan = castPlan9(pw, { total: 900, order: ["T", "Z"], teamOf: { T: 1, Z: 2 } });
  const allCaps = pplan.map((s) => `${s.at.toFixed(0)}s ${s.raw} ${capTxt(s)}`);
  console.log(`\n기지 밖 일꾼·전진/몰래: ${allCaps.filter((c) => !/순조로운/.test(c)).join(" · ")}`);
  const has = (re) => pplan.some((s) => re.test(capTxt(s)));
  for (const [name, pass] of [
    ["Z 쪽 배럭은 '전진 배럭'", has(/\[T\] 전진 배럭/)],
    ["적 기지 안의 배럭은 '몰래 배럭'", has(/\[T\] 몰래 배럭/)],
    ["짓는 중인 전진 건물 곁의 일꾼은 '전진 건설 일꾼 잡음'", has(/\[Z\]ga \[T\] 전진 건설 일꾼 잡음/)],
    ["제 기지에 들어온 일꾼은 '정찰 일꾼 잡음'", has(/\[T\]ga \[Z\] 정찰 일꾼 잡음/)],
    ["기지 밖 일꾼은 '견제'가 아니다", !has(/일꾼 견제/)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ⑬ 전술 읽기(2026-10-10, 요청: "센터 포토/벙커/터렛 · 센터 장악 · 상대 입구 막기 · 옆탱(건물 띄워 시야) · 언덕탱 · 오버로드 사냥 · 입구럴커") ──
   지도 128. 지형: x 36·37 (y 0~40) 벽 · (60,60) 반지름 3 언덕(고도 2) · (84,100) 램프(Z 입구). 1팀 T(테란 20,20)·P(프로토스 20,100) · 2팀 Y(저그 52,20)·Z(저그 100,100).
   ① 160초 T 탱크 (34,22) 시즈 — 벽 너머 Y 의 스포닝풀(44,20) · 140초 T 배럭 이륙 → "옆탱 · 건물 띄워 시야 확보" ② 310초 T 탱크 언덕(60,60) 시즈 — Y 크립(68,60) → "언덕탱"
   ③ 100초 P 포토 (64,64) → "센터 포토" ④ 200초 P 포토 (82,100) 램프 곁 → "입구를 포토로 막음" ⑤ 300초 Z 럴커 (88,100) 머묾 → "입구 럴커로 방어"
   ⑥ 380초 P 질럿 열 (62,64) → 500초 무렵 "센터 장악" ⑦ 600초 P 커세어가 Z 오버로드 넷 → "오버로드 사냥". */
{
  const W = 128;
  const wall = (x, y) => (x === 36 || x === 37) && y >= 0 && y <= 40;
  const tw = {
    level: (x, y) => (Math.hypot(x - 60, y - 60) <= 3 ? 2 : 0),
    walk: (x, y) => x >= 0 && y >= 0 && x < W && y < W && !wall(x, y),
    ramp: (x, y) => x === 84 && y === 100,
  };
  let tt = 19000;
  const tl = [];
  const kills = [];
  const tmk = (o, kind, bld, x, y, born, extra = {}) => { const e = { tag: (tt += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...extra }; tl.push(e); return e; };
  tmk(0, "Command Center", true, 20, 20, 0); tmk(1, "Nexus", true, 20, 100, 0); tmk(2, "Hatchery", true, 52, 20, 0); tmk(3, "Hatchery", true, 100, 100, 0);
  tmk(2, "Spawning Pool", true, 44, 20, 0); tmk(2, "Creep Colony", true, 68, 60, 0);
  tmk(0, "Barracks", true, 24, 24, 50, { lifts: [140] });
  tmk(0, "Siege Tank (Tank Mode)", false, 20, 20, 100, { orders: [[150, 34, 22, false]], sieges: [[160, true]] });
  tmk(0, "Siege Tank (Tank Mode)", false, 20, 20, 100, { orders: [[300, 60, 60, false]], sieges: [[310, true]] });
  tmk(1, "Photon Cannon", true, 64, 64, 100); tmk(1, "Photon Cannon", true, 82, 100, 200);
  tmk(3, "Lurker", false, 100, 100, 280, { orders: [[300, 88, 100, false]] });
  for (let i = 0; i < 10; i += 1) tmk(1, "Zealot", false, 20, 100, 380, { orders: [[380, 62 + (i % 3), 64, false]] });
  const cs = tmk(1, "Corsair", false, 20, 100, 550);
  for (const t of [600, 601, 602, 603]) { const v = tmk(3, "Overlord", false, 100, 100, 0, { died: t, end: "atk", orders: [[t - 2, 90, 90, false]] }); kills.push([t, 1, cs.tag, v.tag]); }
  const tworld = { players: [["T", "테란", 1], ["P", "프로토스", 1], ["Y", "저그", 2], ["Z", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: tl, ups: [], casts: [], pings: [], resFields: [], kills };
  const tplan = castPlan9(tworld, { total: 900, order: ["T", "P", "Y", "Z"], teamOf: { T: 1, P: 1, Y: 2, Z: 2 }, mapW: W, mapH: W, terrain: tw });
  const caps = tplan.map((s) => capTxt(s));
  console.log(`\n전술: ${[...new Set(caps)].filter((c) => !/순조로운/.test(c)).join(" · ")}`);
  const has = (re) => caps.some((c) => re.test(c));
  for (const [name, pass] of [
    ["벽 너머 시즈 + 건물 이륙 → 옆탱 · 시야 확보", has(/\[T\]ga \[Y\] 기지에 옆탱 · 건물 띄워 시야 확보/)],
    ["언덕 위 시즈 → 언덕탱", has(/\[T\]ga 언덕탱으로 \[Y\]eul 공격/)],
    ["가운데 포토 → 센터 포토", has(/\[P\] 센터 포토/)],
    ["적 램프 곁 포토 → 입구 막기", has(/\[P\]ga \[Z\] 입구를 포토로 막음/)],
    ["제 입구 안쪽 럴커 → 입구 럴커", has(/\[Z\] 입구 럴커로 방어/)],
    ["센터에 모인 병력 → 센터 장악", has(/\[P\] 센터 장악/)],
    ["커세어가 오버로드 넷 → 오버로드 사냥", has(/\[P\]ga \[Z\] 오버로드 사냥/)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ⑭ 드랍십 한 대는 폭탄드랍이 아니다(2026-10-10, 요청: "폭탄드랍은 수가 많아야 함 · 그 외에는 주로 일꾼 견제") —
   T(0) 드랍십 하나가 400초에 Z 본진(100,100)으로 · T 마린이 Z 드론 셋을 잡는다 → "마린으로 … 일꾼 견제". */
{
  let st = 21000;
  const sl = [];
  const kills = [];
  const smk = (o, kind, bld, x, y, born, extra = {}) => { const e = { tag: (st += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...extra }; sl.push(e); return e; };
  smk(0, "Command Center", true, 20, 20, 0); smk(1, "Hatchery", true, 100, 100, 0);
  smk(0, "Dropship", false, 20, 20, 300, { orders: [[398, 100, 100, false]] });
  const mr = smk(0, "Marine", false, 20, 20, 300);
  for (const t of [402, 404, 406]) { const v = smk(1, "Drone", false, 100, 100, 0, { died: t, end: "atk", orders: [[t - 2, 101, 101, false]] }); kills.push([t, 0, mr.tag, v.tag]); }
  const sw = { players: [["T", "테란", 1], ["Z", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })), lives: sl, ups: [], casts: [], pings: [], resFields: [], kills };
  const splan = castPlan9(sw, { total: 900, order: ["T", "Z"], teamOf: { T: 1, Z: 2 } });
  const caps = splan.map((s) => capTxt(s));
  console.log(`\n드랍 한 대: ${[...new Set(caps)].filter((c) => !/순조로운/.test(c)).join(" · ")}`);
  for (const [name, pass] of [
    ["수송선 하나는 폭탄드랍이 아니다", !caps.some((c) => /폭탄드랍/.test(c))],
    ["그 드랍의 일꾼 킬은 '일꾼 견제'", caps.some((c) => /\[T\]ga 마린으로 \[Z\] 일꾼 견제/.test(c))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ⑮ 죽기 직전 명령이 없는 정찰 일꾼(2026-10-10, 재지적: "아직도 정찰 온 일꾼 잡은 게 일꾼 견제로 나와") — Z 드론 셋이 120초에 T 본진으로 정찰 명령을 받고
   180~184초(명령 뒤 60초 · LOC_W9 25 밖)에 T 마린에 잡힌다 → "정찰 일꾼 잡음"이지 견제가 아니다. 명령 없는 Z 드론(랠리로 캔다)이 제 본진에서 잡히면 견제다. */
{
  let ut = 23000;
  const ul = [];
  const kills = [];
  const umk = (o, kind, bld, x, y, born, extra = {}) => { const e = { tag: (ut += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...extra }; ul.push(e); return e; };
  umk(0, "Command Center", true, 20, 20, 0); umk(1, "Hatchery", true, 100, 100, 0);
  const mr = umk(0, "Marine", false, 20, 20, 100);
  for (const t of [180, 182, 184, 186, 188, 190]) { const v = umk(1, "Drone", false, 100, 100, 0, { died: t, end: "atk", orders: [[120, 22, 22, false]] }); kills.push([t, 0, mr.tag, v.tag]); }
  const vu = umk(0, "Vulture", false, 20, 20, 400);
  for (const t of [500, 502, 504]) { const v = umk(1, "Drone", false, 100, 100, 0, { died: t, end: "atk" }); kills.push([t, 0, vu.tag, v.tag]); }
  const uw = { players: [["T", "테란", 1], ["Z", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })), lives: ul, ups: [], casts: [], pings: [], resFields: [], kills };
  const caps = castPlan9(uw, { total: 900, order: ["T", "Z"], teamOf: { T: 1, Z: 2 } }).map((s) => capTxt(s));
  console.log(`\n늦게 잡힌 정찰 일꾼: ${[...new Set(caps)].filter((c) => !/순조로운/.test(c)).join(" · ")}`);
  for (const [name, pass] of [
    ["정찰 명령 60초 뒤 제 기지에서 잡힌 드론은 '정찰 일꾼 잡음'", caps.some((c) => /\[T\]ga \[Z\] 정찰 일꾼 잡음/.test(c))],
    ["…그리고 견제가 아니다(벌처 견제 장면만 견제)", caps.filter((c) => /일꾼 견제/.test(c)).every((c) => /벌처/.test(c))],
    ["명령 없이 본진에서 캐던 드론을 벌처가 잡으면 '벌처로 … 일꾼 견제'", caps.some((c) => /\[T\]ga 벌처로 \[Z\] 일꾼 견제/.test(c))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ⑯ 띄워 옮긴 배럭 · 적이 본 배럭(2026-10-10, 요청: "테란은 건물을 지어서 적 기지로 옮길 수 있어 그런 경우도 몰래/전진" · "몰래의 특징은 적 시야에 안 보여야")
   T(20,20) · Z(100,100). ① 100초 T 배럭을 제 본진(26,26)에 짓고 200초에 Z 기지 구석(112,112)에 내린다(Z 해처리 시야 밖) → "몰래 배럭"
   ② 300초 T 배럭을 Z 기지 안(90,96)에 짓는데 Z 드론이 310초에 그 곁(91,97)으로 명령받는다(봤다) → "전진 배럭". */
{
  let vt = 25000;
  const vl = [];
  const vmk = (o, kind, bld, x, y, born, extra = {}) => { const e = { tag: (vt += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...extra }; vl.push(e); return e; };
  vmk(0, "Command Center", true, 20, 20, 0); vmk(1, "Hatchery", true, 100, 100, 0);
  vmk(0, "Barracks", true, 26, 26, 100, { doneAt: 150, lifts: [180], sites: [[100, 25, 25], [200, 111, 111]] });
  vmk(0, "Barracks", true, 90, 96, 300, { doneAt: 360 });
  vmk(1, "Drone", false, 100, 100, 0, { orders: [[310, 91, 97, false]] });
  const vw = { players: [["T", "테란", 1], ["Z", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })), lives: vl, ups: [], casts: [], pings: [], resFields: [] };
  const plan = castPlan9(vw, { total: 900, order: ["T", "Z"], teamOf: { T: 1, Z: 2 } });
  const caps = plan.map((s) => `${Math.round(s.at)}s ${capTxt(s)}`);
  console.log(`\n띄운 배럭·본 배럭: ${[...new Set(plan.map((s) => capTxt(s)))].filter((c) => !/순조로운/.test(c)).join(" · ")}`);
  const capAt = (t) => plan.filter((s) => s.raw === "T" && s.at >= t && s.at < t + 30).map((s) => capTxt(s));
  for (const [name, pass] of [
    ["지어서 적 기지 구석에 내린 배럭은 '몰래 배럭'(그때)", capAt(200).some((c) => /\[T\] 몰래 배럭/.test(c))],
    ["적 일꾼이 곁으로 온 배럭은 '전진 배럭'", capAt(300).some((c) => /\[T\] 전진 배럭/.test(c))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
  void caps;
}

/* ── ⑰ 멀티·가운데의 생산 건물은 전진이 아니다(2026-10-10, 되요청: "멀티에 짓는 생산건물은 전진이 아님 · 전진은 내 기지보다(멀티 포함) 적 기지에 훨씬 가깝게 · 거의 적 기지 앞이나 안")
   T(20,20) · Z(170,170). 200초 T 커맨드 멀티 (70,70) · 260초 그 곁 배럭 (74,72) → 전진 아님 · 300초 가운데 배럭 (95,95) → 전진 아님(적 기지에서 멀다). */
{
  let mt2 = 27000;
  const ml2 = [];
  const mk2 = (o, kind, x, y, born) => { ml2.push({ tag: (mt2 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld: true,
    sites: [[born, x - 1, y - 1]], doneAt: born + 60, lifts: [], cloaks: [], sieges: [], orders: [] }); };
  mk2(0, "Command Center", 20, 20, 0); mk2(1, "Hatchery", 170, 170, 0);
  mk2(0, "Command Center", 70, 70, 200); mk2(0, "Barracks", 74, 72, 260); mk2(0, "Barracks", 95, 95, 300);
  const w2 = { players: [["T", "테란", 1], ["Z", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })), lives: ml2, ups: [], casts: [], pings: [], resFields: [] };
  const caps = castPlan9(w2, { total: 900, order: ["T", "Z"], teamOf: { T: 1, Z: 2 } }).map((s) => capTxt(s));
  console.log(`\n멀티·가운데 배럭: ${[...new Set(caps)].filter((c) => !/순조로운/.test(c)).join(" · ")}`);
  console.log(`  ${caps.some((c) => /전진|몰래/.test(c)) ? "✘" : "✔"} 멀티 곁·가운데 배럭은 전진/몰래가 아니다`);
}

/* ── ⑱ 병력 구성·조이기·마법 활약·캐리어·지형(2026-10-10, 요청: "목동저그 · 다크스웜+저글링+럴커 방어/돌파 · 탱크/메카닉 조이기 · 바이오닉/메카닉 운영 ·
   스톰·마엘스트롬·마인드컨트롤·스테이시스·EMP·이레디에이트 활약 · 파워 드라군 · 캐리어 기동성 공격 · 지형 활용 유리한 전투") — 판마다 작은 합성 세계. */
{
  let gt = 30000;
  const mkw = (players, build, extra = {}) => {
    const L = []; const kills = []; const casts = []; const ups = [];
    const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (gt += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
      sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
    build({ mk, kills, casts, ups });
    return { players: players.map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })), lives: L, ups, casts, pings: [], resFields: [], kills, ...extra };
  };
  const run = (w, o = {}) => castPlan9(w, { total: 900, order: w.players.map((p) => p.name), teamOf: Object.fromEntries(w.players.map((p) => [p.name, p.team])), ...o }).map((s) => capTxt(s));
  const PL = [["A", "테란", 1], ["B", "저그", 2]];
  const res = [];
  // ① 구성 — A 마린 열둘(바이오닉) · B 아드레날린 + 울트라 둘 + 저글링 여덟(목동)
  res.push(["마린 열둘 → 바이오닉 운영", run(mkw(PL, ({ mk, ups }) => {
    mk(0, "Command Center", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    for (let i = 0; i < 12; i += 1) mk(0, "Marine", false, 20, 20, 300);
    for (let i = 0; i < 2; i += 1) mk(1, "Ultralisk", false, 100, 100, 300);
    for (let i = 0; i < 8; i += 1) mk(1, "Zergling", false, 100, 100, 300);
    ups.push([290, "Adrenal Glands", 1, 0]);
  })), (c) => c.some((x) => /\[A\] 바이오닉 운영/.test(x)) && c.some((x) => /\[B\] 목동저그/.test(x))]);
  // ② 파워 드라군
  res.push(["드라군 열둘 → 파워 드라군", run(mkw([["P", "프로토스", 1], ["B", "저그", 2]], ({ mk }) => {
    mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    for (let i = 0; i < 12; i += 1) mk(0, "Dragoon", false, 20, 20, 300);
  })), (c) => c.some((x) => /\[P\] 파워 드라군/.test(x))]);
  // ③ 탱크 조이기 — A 탱크 셋이 400~430초에 B 쪽(70,70 언저리)에 박는다
  res.push(["앞으로 박은 탱크 셋 → 탱크 조이기", run(mkw(PL, ({ mk }) => {
    mk(0, "Command Center", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    [400, 415, 430].forEach((t, i) => mk(0, "Siege Tank (Tank Mode)", false, 20, 20, 300, { orders: [[t - 10, 70 + i, 70, false]], sieges: [[t, true]] }));
  })), (c) => c.some((x) => /\[A\] 탱크 조이기/.test(x))]);
  // ④ 스톰 — P 가 600초에 (60,60)에 스톰 · B 히드라 넷이 601~602초에 그 자리에서 죽는다
  res.push(["스톰에 넷 → 스톰으로 4기 잡음", run(mkw([["P", "프로토스", 1], ["B", "저그", 2]], ({ mk, casts }) => {
    mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    for (let i = 0; i < 4; i += 1) mk(1, "Hydralisk", false, 100, 100, 500, { died: 601 + i * 0.3, end: "atk", orders: [[598, 60, 60, false]] });
    casts.push([600, 60, 60, "Psionic Storm", 0]);
  })), (c) => c.some((x) => /스톰으로 4기 잡음/.test(x))]);
  // ⑤ 마인드컨트롤 — P 가 700초에 B 의 울트라를 빼앗는다(손바뀜 생애)
  res.push(["마인드컨트롤 → 울트라 빼앗음", run(mkw([["P", "프로토스", 1], ["B", "저그", 2]], ({ mk, casts }) => {
    mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    mk(1, "Ultralisk", false, 100, 100, 500, { died: 700, end: "own" });
    mk(0, "Ultralisk", false, 60, 60, 700, { handoff: true });
    casts.push([700, 60, 60, "Mind Control", 0]);
  })), (c) => c.some((x) => /\[P\] 마인드컨트롤로 울트라 빼앗음/.test(x))]);
  // ⑥ 다크스웜 + 럴커 돌파 — B 가 A 본진(20,20)에 스웜 · B 럴커가 A 마린 넷을 잡는다
  res.push(["스웜 아래 럴커가 본진 마린 → 다크스웜+럴커 돌파", run(mkw(PL, ({ mk, kills, casts }) => {
    mk(0, "Command Center", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    const lk = mk(1, "Lurker", false, 100, 100, 500, { orders: [[590, 22, 22, false]] });
    for (let i = 0; i < 4; i += 1) { const m = mk(0, "Marine", false, 20, 20, 400, { died: 602 + i, end: "atk", orders: [[598, 21, 21, false]] }); kills.push([602 + i, 1, lk.tag, m.tag]); }
    casts.push([600, 22, 22, "Dark Swarm", 1]);
  })), (c) => c.some((x) => /다크스웜\+럴커 돌파/.test(x))]);
  // ⑦ 캐리어 — P 인터셉터가 B 본진에서 히드라 넷을 잡는다
  res.push(["인터셉터가 적 본진에서 → 캐리어 기동 공격", run(mkw([["P", "프로토스", 1], ["B", "저그", 2]], ({ mk, kills }) => {
    mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    const ic = mk(0, "Interceptor", false, 100, 100, 600);
    for (let i = 0; i < 4; i += 1) { const h = mk(1, "Hydralisk", false, 100, 100, 500, { died: 650 + i, end: "atk", orders: [[648, 101, 101, false]] }); kills.push([650 + i, 0, ic.tag, h.tag]); }
  })), (c) => c.some((x) => /캐리어 기동 공격/.test(x))]);
  // ⑧ 지형 — A 마린 넷이 언덕(고도 2 · 50,50 둘레 6)에서 아래(58,58)의 B 히드라 다섯을 잡는다
  const hillT = { level: (x, y) => (Math.hypot(x - 50, y - 50) <= 6 ? 2 : 0), walk: () => true };
  res.push(["언덕 위에서 아래를 잡은 싸움 → 언덕 지형 활용", run(mkw(PL, ({ mk, kills }) => {
    mk(0, "Command Center", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    const ms = [0, 1, 2, 3].map(() => mk(0, "Marine", false, 20, 20, 400, { orders: [[740, 50, 50, false]] }));
    for (let i = 0; i < 5; i += 1) { const h = mk(1, "Hydralisk", false, 100, 100, 500, { died: 750 + i, end: "atk", orders: [[745, 58, 58, false]] }); kills.push([750 + i, 0, ms[i % 4].tag, h.tag]); }
  }), { mapW: 128, mapH: 128, terrain: hillT }), (c) => c.some((x) => /언덕 지형 활용/.test(x))]);
  console.log("\n구성·조이기·마법·캐리어·지형:");
  for (const [name, caps, ok] of res) console.log(`  ${ok(caps) ? "✔" : "✘"} ${name}${ok(caps) ? "" : ` (실제 ${[...new Set(caps)].filter((c) => !/순조로운/.test(c)).join(" · ")})`}`);
}
