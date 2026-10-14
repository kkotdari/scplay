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
writeFileSync(src, `export { castPlan9, castAt9, castValue9, castMoves9, castFocus9 } from "${join(ROOT, "src/components/replay/cast9")}";\n`);
execFileSync(EBIN, [src, "--bundle", "--platform=node", "--format=esm", "--log-level=error", `--outfile=${join(tmp, "b.mjs")}`],
  { cwd: ROOT, stdio: "inherit" });
const { castPlan9, castAt9, castValue9, castMoves9, castFocus9 } = await import(join(tmp, "b.mjs"));

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
// 200초: A(0)가 B(1)의 저글링 여덟을 잡는다 → A 화면(2026-10-10: 넷은 MIN_SCENE9 450 아래 — 중요도 낮음)
const zl = [];
for (let i = 0; i < 8; i += 1) zl.push(mk(1, "Zergling", 100, 200 + i * 0.4, "atk"));
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
  ["파일런 하나는 장면이 아니다(중요도 낮음 · 2026-10-10)", raze1 === "(장면 없음)"],
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
  // ② 가운데 호각 교전 — (55,78) · 어느 본진 건물에서도 BASE_R9(18) 밖(2026-10-10: 옛 (55,55)는 P 앞마당(60,50) 7타일 안이라 이제 P 기지 싸움으로 읽힌다)
  const zl = [500, 500.5, 501, 501.5].map((t) => dmk(2, "Zergling", false, 100, 100, 400, t, "atk", [[495, 55, 78, false]]));
  for (const z of zl) dmk(0, "Zealot", false, 10, 10, 400, null, "", [], [499, z.tag, 501.5, z.tag, 502, 0]);
  const qd = dmk(1, "Dragoon", false, 10, 100, 400, 501, "atk", [[495, 56, 77, false]]);
  dmk(3, "Hydralisk", false, 100, 10, 400, null, "", [], [499, qd.tag, 501.5, qd.tag, 502, 0]);
  // ③ 리버 일꾼 견제 — 처치 절(kills)에 킬러 태그가 리버
  const rv = dmk(2, "Reaver", false, 100, 100, 600, null, "");
  for (const t of [700, 704, 708]) { const p = dmk(0, "Probe", false, 12, 12, 0, t, "atk", [[t - 2, 12, 12, false]]); kills.push([t, 2, rv.tag, p.tag]); }
  // ④ 폭탄드랍 — F 의 셔틀이 P 본진으로(845초 명령) · F 의 질럿 둘이 P 의 프로브 둘·드라군 하나를 잡는다
  const sh1 = dmk(2, "Shuttle", false, 100, 100, 700, null, "", [[845, 12, 12, false]]);
  const sh2 = dmk(2, "Shuttle", false, 100, 100, 700, null, "", [[846, 13, 12, false]]);   // 폭탄드랍은 수송선 둘 이상(2026-10-10)
  const vict = [dmk(0, "Probe", false, 12, 12, 0, 850, "atk", [[848, 12, 12, false]]), dmk(0, "Probe", false, 12, 12, 0, 851, "atk", [[848, 12, 12, false]]),
    dmk(0, "Dragoon", false, 10, 10, 800, 852, "atk", [[848, 12, 12, false]])];
  const zs = vict.map((v) => dmk(2, "Zealot", false, 100, 100, 700, null, "", [], [849, v.tag, 852.5, v.tag, 853, 0]));
  /* 탑승 절(2026-10-13 · cast9 dropFollow9) — 질럿 셋이 760초에 두 셔틀에 타고 846~847초에 내린다 → 장면은 내리기 5초 앞(841초)부터 · 수송선 → 질럿을 따라간다. */
  const loads = [[760, zs[0].tag, sh1.tag], [760, zs[1].tag, sh1.tag], [760.5, zs[2].tag, sh2.tag], [846, zs[0].tag, 0], [846.4, zs[1].tag, 0], [847, zs[2].tag, 0]];
  /* 폭탄드랍은 실은 병력도 어느 정도(수송 칸 12 · 2026-10-13) — 질럿 셋(6칸)만이면 견제다(아래 ⑨b) · 질럿 셋을 더 실어 12칸. */
  const few = [...loads];
  const zx = [0, 1, 2].map(() => dmk(2, "Zealot", false, 100, 100, 700, null, ""));
  zx.forEach((z, i) => loads.push([761, z.tag, i < 1 ? sh1.tag : sh2.tag], [846.2 + i * 0.2, z.tag, 0]));
  return { players: [["P", 1], ["Q", 1], ["F", 2], ["G", 2]].map(([name, team], o) => ({ owner: o, name, race: "프로토스", color: "#fff", team })),
    lives: dl, ups: [], casts: [], pings: [], resFields: [], kills, loads, few, dropTags: { ships: [sh1.tag, sh2.tag], riders: [...zs, ...zx].map((z) => z.tag) } };
})();
const dplan9 = castPlan9(dw9, { total: 1000, order: ["P", "Q", "F", "G"], teamOf: { P: 1, Q: 1, F: 2, G: 2 } }).filter((s) => !s.cyc);
const dAt9 = (t) => dplan9.find((s) => Math.abs(s.at - t) < 6);
const d1 = dAt9(298.5); const d2 = dAt9(498.5); const d3 = dAt9(698.5); const d4 = dplan9.find((s) => s.at > 830 && s.at < 860);
const dshow = (s) => (s ? `${s.at.toFixed(0)}s ${s.raw} ${s.role ?? "-"} ${capTxt(s)}` : "(장면 없음)");
console.log(`\n기지 싸움·vs·견제·드랍: ${[d1, d2, d3, d4].map(dshow).join(" · ")}`);
for (const [name, pass] of [
  ["앞마당의 싸움은 기지 싸움 — F 의 공격(교전이 아니다)", !!d1 && d1.role === (d1.raw === "F" ? "atk" : "def") && /공격/.test(capTxt(d1)) && !/교전/.test(capTxt(d1))],
  ["가운데 호각 교전은 vs 로 팀을 가른다(팀 전원이면 'N팀 전원' · 2026-10-10)", !!d2 && d2.role === "war" && /^(1팀 전원 vs 2팀 전원|2팀 전원 vs 1팀 전원) 교전$/.test(capTxt(d2))],
  ["리버가 잡은 일꾼은 '리버로 … 일꾼 견제'(서술 · 2026-10-10)", !!d3 && /\[F\]ga 리버로 \[P\] 일꾼 견제/.test(capTxt(d3))],
  ["공격·방어 자막은 'A가 B를 공격' 서술 — '의' 꼴이 없다(2026-10-10)", [d1, d3, d4].every((d) => !d || !/\]ui/.test(capTxt(d)))],
  ["셔틀이 본진으로 간 뒤의 싸움은 '폭탄드랍'", !!d4 && /폭탄드랍/.test(capTxt(d4))],
  ["폭탄드랍 장면은 내리기 5초 앞(841초)에 드랍한 F 화면으로 선다(2026-10-13)", !!d4 && Math.abs(d4.at - 841) < 0.01 && d4.raw === "F"],
  ["카메라는 수송선(841~847) → 내린 질럿(847~장면 끝)을 따라간다", !!d4?.follow && d4.follow.length === 2
    && d4.follow[0].t0 === 841 && d4.follow[0].t1 === 847 && [...d4.follow[0].tags].sort().join() === [...dw9.dropTags.ships].sort().join()
    && d4.follow[1].t0 === 847 && d4.follow[1].t1 > 852 && [...d4.follow[1].tags].sort().join() === [...dw9.dropTags.riders].sort().join()],
]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
/* ⑨d 사건 중계(2026-10-14, 요청: "자동 중계 중계 방식 사건 중계로 변경(개인 화면 x)") — opts.event 면 모든 토막이 자리 길(spot)을 갖는다:
   ① 장면(① 앞마당 300초 · ② 가운데 500초 · ③ 리버 견제 700초)은 그 사건 자리 · ④ 폭탄드랍은 몸 따라가기(follow)가 spot 토막에도 실린다 · 순환도 한 점 자리. */
{
  const ep9 = castPlan9(dw9, { total: 1000, order: ["P", "Q", "F", "G"], teamOf: { P: 1, Q: 1, F: 2, G: 2 }, event: true });
  const at9 = (t) => ep9.filter((s) => s.at <= t).pop();
  const near9 = (seg, t, x, y, r) => { if (!seg?.spot) return false; const p = seg.spot.filter((q) => q[0] <= t).pop() ?? seg.spot[0]; return Math.hypot(p[1] - x, p[2] - y) <= r; };
  const d4e = ep9.find((s) => s.at > 830 && s.at < 860);
  console.log(`사건 중계: 토막 ${ep9.length} · spot 없는 토막 ${ep9.filter((s) => !s.spot || s.spot.length === 0).length} · 순환 ${ep9.filter((s) => s.cyc).length}`);
  for (const [name, pass] of [
    ["모든 토막이 자리 길을 갖는다(개인 화면 없음)", ep9.length > 0 && ep9.every((s) => s.spot && s.spot.length > 0)],
    ["앞마당 싸움(300초)은 그 싸움 자리(62,52) 곁", near9(at9(301), 301, 62, 52, 6)],
    ["가운데 교전(500초)은 (55,78) 곁", near9(at9(500.5), 500.5, 55, 78, 6)],
    ["리버 견제(704초)는 P 일꾼 자리(12,12) 곁", near9(at9(704), 704, 12, 12, 6)],
    ["폭탄드랍 토막에 몸 따라가기(수송선 → 질럿)가 실린다", !!d4e?.follow && d4e.follow.length === 2],
    ["순환 토막도 자리가 있다", ep9.filter((s) => s.cyc).every((s) => s.spot && s.spot.length > 0)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}
/* ⑨e 사건 중계의 자리·중요도(2026-10-14, 지적: "포토러시 사건인데 본진을 보여주네 — 어디를 보여줄지 잘 정해야 함 · 생산 건물 늘림보다 입구 막기가 더 중요해") —
   R(10,10 프로토스) · Z(100,100 저그). 130초 R 이 Z 본진(96,97)에 캐논 · 135초 제 본진(12,14)에 파일런 → 그 순환 토막 자막은 포토러시, 카메라는 캐논 자리.
   300초 R 이 둘째 게이트(본진)와 지도 가운데(55,55) 캐논을 같이 → 자막은 '센터 포토'(전술 > 생산 건물 수) · 카메라는 그 캐논. */
{
  let et = 21000;
  const el = [];
  const emk = (o, kind, x, y, born) => { el.push({ tag: (et += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld: true,
    sites: [[born, x - 1, y - 1]], doneAt: born + 30, lifts: [], cloaks: [], sieges: [], orders: [] }); };
  emk(0, "Nexus", 10, 10, 0); emk(1, "Hatchery", 100, 100, 0);
  emk(0, "Pylon", 95, 95, 120); emk(0, "Photon Cannon", 96, 97, 130); emk(0, "Pylon", 12, 14, 135);
  emk(0, "Gateway", 14, 10, 200); emk(0, "Gateway", 16, 12, 300); emk(0, "Pylon", 50, 52, 290); emk(0, "Photon Cannon", 55, 55, 300);
  const ew = { players: [{ owner: 0, name: "R", race: "프로토스", color: "#ff0", team: 1 }, { owner: 1, name: "Z", race: "저그", color: "#0f0", team: 2 }],
    lives: el, ups: [], casts: [], pings: [], resFields: [], kills: [] };
  const ep = castPlan9(ew, { total: 400, order: ["R", "Z"], mapW: 110, mapH: 110, event: true });
  const rush = ep.find((s) => /포토러시/.test(capTxt(s)));
  const ctr = ep.find((s) => /센터 포토/.test(capTxt(s)));
  const gate2 = ep.find((s) => /2게이트/.test(capTxt(s)) && s.at > 280 && s.at < 320);
  const sp = (s) => (s?.spot?.[0] ? `(${s.spot[0][1]},${s.spot[0][2]})` : "-");
  console.log(`\n사건 중계 자리·중요도: 포토러시 ${rush ? `${rush.at.toFixed(0)}s ${sp(rush)}` : "없음"} · 센터 포토 ${ctr ? `${ctr.at.toFixed(0)}s ${sp(ctr)}` : "없음"} · 2게이트 ${gate2 ? gate2.at.toFixed(0) : "없음"}`);
  for (const [name, pass] of [
    ["포토러시 토막의 카메라는 러시 캐논(96,97) — 뒤에 지은 제 본진 파일런(12,14)이 아니다", !!rush?.spot && Math.hypot(rush.spot[0][1] - 96, rush.spot[0][2] - 97) < 1],
    ["같은 창의 '센터 포토'(전술)가 '2게이트'(생산 건물 수)를 이긴다", !!ctr && !gate2],
    ["센터 포토 토막의 카메라는 그 캐논(55,55)", !!ctr?.spot && Math.hypot(ctr.spot[0][1] - 55, ctr.spot[0][2] - 55) < 1],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}
/* ⑨c 일꾼 견제는 자원 곁에서 잡힌 일꾼만(2026-10-13, 요청: "일꾼 견제를 자원 주변의 일꾼 죽인 거만 해당되게") — ③ 리버가 (12,12)에서 프로브 셋을 잡는다.
   자원이 바로 곁(미네랄 줄 y 10)이면 견제 · 같은 기지 안이어도 자원이 멀면(미네랄 줄 y 24 · 12타일) 견제가 아니다. */
{
  const capAt = (res) => {
    const pl = castPlan9(dw9, { total: 1000, order: ["P", "Q", "F", "G"], teamOf: { P: 1, Q: 1, F: 2, G: 2 }, resources: res }).filter((s) => !s.cyc);
    const s = pl.find((x) => Math.abs(x.at - 698.5) < 6);
    return s ? capTxt(s) : "(장면 없음)";
  };
  const line = (x, y) => [...[-4, -2, 0, 2, 4].map((dx) => [x + dx, y - 6, 0]), [x + 6, y - 3, 1]];   // ⑩ baseRes9 꼴(아래에서 선다)
  const near = capAt(line(10, 16)); const far = capAt(line(10, 30));
  console.log(`자원 곁 견제: 곁 ${near} · 멂 ${far}`);
  for (const [name, pass] of [
    ["자원 곁에서 잡힌 프로브는 '일꾼 견제'", /일꾼 견제/.test(near)],
    ["기지 안이어도 자원에서 먼 프로브는 '일꾼 견제'가 아니다", !/일꾼 견제/.test(far)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}
/* ⑨b 적은 수 드랍은 견제(2026-10-13, 요청: "폭탄드랍은 어느 정도 기수가 있는 거만 · 적은 수는 주로 견제임") — 셔틀 둘에 질럿 셋(6칸)이면 폭탄드랍이 아니다. */
{
  const fw9 = { ...dw9, loads: dw9.few };
  const fplan9 = castPlan9(fw9, { total: 1000, order: ["P", "Q", "F", "G"], teamOf: { P: 1, Q: 1, F: 2, G: 2 } }).filter((s) => !s.cyc);
  const f4 = fplan9.find((s) => s.at > 830 && s.at < 860);
  console.log(`적은 수 드랍: ${dshow(f4)}`);
  for (const [name, pass] of [
    ["셔틀 둘·질럿 셋(6칸)은 폭탄드랍이 아니다", !fplan9.some((s) => /폭탄드랍/.test(capTxt(s)))],
    ["그 싸움 장면은 그대로 선다(공격 글귀)", !!f4 && /공격|견제/.test(capTxt(f4))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

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
  // Z1 선스포닝풀 → 앞마당 해처리 → 레어   |  Z2 선해처리(옛 노스포닝풀 앞마당 해처리) → 스포닝풀 → 셋째 기지 해처리
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
  ["Z1", 64, "[Z1] 선스포닝풀"], ["Z1", 155, "[Z1] 앞마당 해처리"], ["Z1", 505, "[Z1] 레어 변태"],
  ["Z2", 95, "[Z2] 선해처리"], ["Z2", 155, "[Z2] 해처리 후 스포닝풀"], ["Z2", 405, "[Z2] 2번째 멀티"], ["Z2", 800, "[Z2] 3기지 운영 중"],
  ["P1", 155, "[P1] 빠른 앞마당 넥서스"], ["P1", 205, "[P1] 코어 건설"], ["P1", 405, "[P1] 로보틱스 건설"], ["P1", 730, "[P1] 병력 모으는 중"],
  ["T1", 125, "[T1] 2배럭"], ["T1", 205, "[T1] 팩토리 건설"], ["T1", 305, "[T1] 앞마당 커맨드"], ["T1", 800, "[T1] 순조롭게 발전 중"],
  ["Z3", 75, "[Z3] 8드론 스포닝풀 건설"], ["P2", 245, "[P2] 3게이트"],
];
console.log(`\n빌드 읽기: ${bcases9.slice(0, 4).map(([r, t]) => `${r}@${t}s ${capAt9(r, t)}`).join(" · ")} …`);
for (const [raw, t, want] of bcases9) { const got = capAt9(raw, t); console.log(`  ${got === want ? "✔" : "✘"} ${raw} ${t}s → ${want}${got === want ? "" : ` (실제 ${got})`}`); }
/* 자원 자료가 없으면 본진 건물은 수로만(2026-10-10 — "확실하게 알아낸 것만"). */
for (const [raw, t, want] of [["Z1", 155, "[Z1] 2해처리"], ["Z2", 95, "[Z2] 선2해처리"], ["Z2", 405, "[Z2] 3해처리"], ["P1", 155, "[P1] 2넥서스"], ["T1", 305, "[T1] 2커맨드"]]) {
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
for (const [raw, t, want] of [["F1", 205, "[F1] 2넥서스"], ["F1", 305, "[F1] 3넥서스"], ["F1", 405, "[F1] 4넥서스"], ["F1", 800, "[F1] 순조롭게 발전 중"],
  ["F2", 85, "[F2] 선2해처리"], ["F2", 305, "[F2] 3해처리"]]) {
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
  ["팀전은 첫 바퀴 팀째로(PQRS) · 그 뒤 로스터 차례로 팀을 번갈아(PRQS…) — 2026-10-11", ("PQRS" + "PRQS".repeat(8)).startsWith(seq4) && seq4.length >= 8],
  ["밀리는 로스터 차례 그대로(PQRS…)", "PQRS".repeat(8).startsWith(seqM) && seqM.length >= 4],
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
  console.log(`\n기지 밖 일꾼·전진/몰래: ${allCaps.filter((c) => !/발전 중$/.test(c)).join(" · ")}`);
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
    ramp: (x, y) => (x === 84 && y === 100) || (x === 54 && y === 2),   // (54,2) — 맵 끝 램프 칸(2026-10-13 · 아래 맵 끝 포토)
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
  tmk(1, "Photon Cannon", true, 52, 2, 700);   // 맵 끝(y 2) — Y 본진에서 18타일 · 램프 칸 곁이어도 입구가 아니다(2026-10-13, 지적: "맵 끝부분인데 입구 막기라고")
  tmk(3, "Lurker", false, 100, 100, 280, { orders: [[300, 88, 100, false]] });
  for (let i = 0; i < 10; i += 1) tmk(1, "Zealot", false, 20, 100, 380, { orders: [[380, 62 + (i % 3), 64, false]] });
  const cs = tmk(1, "Corsair", false, 20, 100, 550);
  for (const t of [600, 601, 602, 603]) { const v = tmk(3, "Overlord", false, 100, 100, 0, { died: t, end: "atk", orders: [[t - 2, 90, 90, false]] }); kills.push([t, 1, cs.tag, v.tag]); }
  const tworld = { players: [["T", "테란", 1], ["P", "프로토스", 1], ["Y", "저그", 2], ["Z", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: tl, ups: [], casts: [], pings: [], resFields: [], kills };
  const tplan = castPlan9(tworld, { total: 900, order: ["T", "P", "Y", "Z"], teamOf: { T: 1, P: 1, Y: 2, Z: 2 }, mapW: W, mapH: W, terrain: tw });
  const caps = tplan.map((s) => capTxt(s));
  console.log(`\n전술: ${[...new Set(caps)].filter((c) => !/발전 중$/.test(c)).join(" · ")}`);
  const has = (re) => caps.some((c) => re.test(c));
  for (const [name, pass] of [
    ["벽 너머 시즈 + 건물 이륙 → 옆탱 · 시야 확보", has(/\[T\]ga \[Y\] 기지에 옆탱 · 건물 띄워 시야 확보/)],
    ["언덕 위 시즈 → 언덕탱", has(/\[T\]ga 언덕탱으로 \[Y\]eul 공격/)],
    ["가운데 포토 → 센터 포토", has(/\[P\] 센터 포토/)],
    ["적 램프 곁 포토 → 입구 막기", has(/\[P\]ga \[Z\] 입구를 포토로 막음/)],
    ["맵 끝 포토는 입구 막기가 아니다(2026-10-13)", !has(/\[Y\] 입구를 포토로 막음/)],
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
  console.log(`\n드랍 한 대: ${[...new Set(caps)].filter((c) => !/발전 중$/.test(c)).join(" · ")}`);
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
  console.log(`\n늦게 잡힌 정찰 일꾼: ${[...new Set(caps)].filter((c) => !/발전 중$/.test(c)).join(" · ")}`);
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
  console.log(`\n띄운 배럭·본 배럭: ${[...new Set(plan.map((s) => capTxt(s)))].filter((c) => !/발전 중$/.test(c)).join(" · ")}`);
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
  console.log(`\n멀티·가운데 배럭: ${[...new Set(caps)].filter((c) => !/발전 중$/.test(c)).join(" · ")}`);
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
  res.push(["스톰에 히드라 넷 → 스톰으로 4킬(2026-10-12 · 옛 '활약함')", run(mkw([["P", "프로토스", 1], ["B", "저그", 2]], ({ mk, casts }) => {
    mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    for (let i = 0; i < 4; i += 1) mk(1, "Hydralisk", false, 100, 100, 500, { died: 601 + i * 0.3, end: "atk", orders: [[598, 60, 60, false]] });
    casts.push([600, 60, 60, "Psionic Storm", 0]);
  })), (c) => c.some((x) => /\[P\]ga 스톰으로 4킬/.test(x))]);
  // ④'' 제 기지 스톰(2026-10-12, 요청: "스톰으로 방어해냄 등으로 표현") — B 히드라 넷이 P 본진(20,20)에 들어와 P 스톰(22,22)에 죽는다 → "스톰으로 방어해냄"
  res.push(["제 기지에 들어온 히드라 넷을 스톰 → 스톰으로 방어해냄", run(mkw([["P", "프로토스", 1], ["B", "저그", 2]], ({ mk, casts }) => {
    mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    for (let i = 0; i < 4; i += 1) mk(1, "Hydralisk", false, 100, 100, 500, { died: 601 + i * 0.3, end: "atk", bornX: 22, bornY: 22, orders: [[598, 22, 22, true]] });
    casts.push([600, 22, 22, "Psionic Storm", 0]);
  })), (c) => c.some((x) => /스톰으로 방어해냄/.test(x))]);
  // ④' 헛스톰(2026-10-11, 요청: "스톰 같은 게 무조건 들어가는 게 아니라 활약했을 때만") — 스톰에 히드라 하나만 죽는다 → 스톰을 말하지 않는다
  res.push(["스톰에 하나만 → 스톰을 말하지 않는다", run(mkw([["P", "프로토스", 1], ["B", "저그", 2]], ({ mk, casts }) => {
    mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    mk(1, "Hydralisk", false, 100, 100, 500, { died: 601, end: "atk", orders: [[598, 60, 60, false]] });
    casts.push([600, 60, 60, "Psionic Storm", 0]);
  })), (c) => !c.some((x) => /스톰/.test(x))]);
  // ⑤ 마인드컨트롤 — P 가 700초에 B 의 울트라를 빼앗는다(손바뀜 생애)
  res.push(["마인드컨트롤 → 울트라 빼앗음", run(mkw([["P", "프로토스", 1], ["B", "저그", 2]], ({ mk, casts }) => {
    mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
    mk(1, "Ultralisk", false, 100, 100, 500, { died: 700, end: "own" });
    mk(0, "Ultralisk", false, 60, 60, 700, { handoff: true });
    casts.push([700, 60, 60, "Mind Control", 0]);
  })), (c) => c.some((x) => /\[P\]ga 마인드컨트롤로 울트라 빼앗음/.test(x))]);
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
  for (const [name, caps, ok] of res) console.log(`  ${ok(caps) ? "✔" : "✘"} ${name}${ok(caps) ? "" : ` (실제 ${[...new Set(caps)].filter((c) => !/발전 중$/.test(c)).join(" · ")})`}`);
}

/* ── ⑲ 사건 단위 자막(2026-10-10, 요청: "자막이 사건단위로 분리 — 일꾼 견제를 한 명이 했는데 여러 명이 누구에게 폭탄드랍 · 다른 싸움이 섞여서 하나로 · 타이밍에 맞게 나눠서 ·
   스톰 옆탱 이런 거 붙이지 말고 문장 안에 누가 썼는지 · 누구 기지에서 싸우냐가 중요 — 그 사람이 공격당한 사람") — 2v2 A·B(1팀) 대 C·D(2팀).
   본진 A(10,10) · B(10,100) · C(100,100) · D(100,10).
   ① 400초: A 벌처가 C 본진에서 SCV 셋을 잡는 동안(400·403·406) B 마린이 가운데(55,55)에서 D 저글링 넷을 잡는다(401~402.5) → 두 장면 · A 와 B 가 한 자막에 안 선다.
   ② 600초: A 가 C 본진(98,98)에서 C 마린 셋을 잡고 D 히드라가 그곳에서 A 마린 둘을 잡는다 → "[A]ga [C] 기지 공격 · [D]ga 헬프"(주인공이 누구든).
   ③ 800초: C 가 A 본진(12,12)에서 A 마린 다섯을 잡고 → 804초: A 가 가운데(60,80)에서 C 히드라 넷을 잡는다 → 자막이 두 때로 갈린다(앞 글귀를 뒤 글귀가 덮지 않는다). */
{
  let ht = 40000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (ht += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  const die = (o, kind, x, y, t, killer) => { const v = mk(o, kind, false, x, y, Math.max(0, t - 60), { died: t, end: "atk", orders: [[t - 2, x, y, false]] }); kills.push([t, killer.owner, killer.tag, v.tag]); return v; };
  mk(0, "Command Center", true, 10, 10, 0); mk(1, "Command Center", true, 10, 100, 0); mk(2, "Command Center", true, 100, 100, 0); mk(3, "Hatchery", true, 100, 10, 0);
  // ①
  const vu = mk(0, "Vulture", false, 10, 10, 300); [400, 403, 406].forEach((t) => die(2, "SCV", 101, 101, t, vu));
  const bm = mk(1, "Marine", false, 10, 100, 300); [401, 401.5, 402, 402.5].forEach((t) => die(3, "Zergling", 55, 55, t, bm));
  // ②
  const am = mk(0, "Siege Tank (Tank Mode)", false, 10, 10, 500); [600, 600.5, 601, 601.2, 601.4, 601.6].forEach((t) => die(2, "Marine", 98, 98, t, am));
  const dh = mk(3, "Hydralisk", false, 100, 10, 500); [601.5, 602, 602.3, 602.6].forEach((t) => die(0, "Marine", 99, 99, t, dh));
  // ③
  const ch = mk(2, "Hydralisk", false, 100, 100, 700); [800, 800.5, 801, 801.5, 802, 802.3, 802.6, 802.9].forEach((t) => die(0, "Marine", 12, 12, t, ch));
  const at = mk(0, "Siege Tank (Tank Mode)", false, 10, 10, 700); [804, 804.5, 805, 805.5].forEach((t) => die(2, "Hydralisk", 60, 80, t, at));
  const w = { players: [["A", 1], ["B", 1], ["C", 2], ["D", 2]].map(([name, team], o) => ({ owner: o, name, race: "테란", color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills };
  const plan = castPlan9(w, { total: 1000, order: ["A", "B", "C", "D"], teamOf: { A: 1, B: 1, C: 2, D: 2 } }).filter((s) => !s.cyc);
  const show = plan.filter((s) => s.at > 390 && s.at < 820).map((s) => `${s.at.toFixed(1)}s ${s.raw} ${capTxt(s)}`);
  console.log(`\n사건 단위 자막: ${show.join(" · ")}`);
  const in9 = (t0, t1) => plan.filter((s) => s.at >= t0 && s.at < t1);
  const s600 = in9(595, 605);
  const s800 = in9(795, 810);
  for (const [name, pass] of [
    ["딴 자리의 동시 사건은 한 자막에 안 섞인다(A 견제 · B 가운데)", in9(390, 410).every((s) => !(/\[A\]/.test(capTxt(s)) && /\[B\]/.test(capTxt(s))))],
    ["견제 자막의 주어는 견제한 한 사람", in9(390, 410).some((s) => /^\[A\]ga .*\[C\] 일꾼 견제$/.test(capTxt(s)))],
    ["기지 싸움은 그 기지 임자가 공격당한 사람 · 팀원은 헬프", s600.length > 0 && s600.every((s) => /^\[A\]ga \[C\] 기지 공격 · \[D\]ga 헬프$/.test(capTxt(s)))],
    /* 2026-10-11 장면 최소 시간(MIN_SHOW9 10초)부터 — 804초의 딴 자리 싸움(가벼움)은 C 로 갈아탄 지 10초 안이라 안 끼어든다. 앞 글귀를 뒤 글귀가 덮지 않는 것만 본다. */
    ["이어진 두 사건(딴 자리)은 앞 자막을 덮지 않고 · 장면 최소 시간 안에 안 갈아탄다", s800.length >= 1 && /\[C\]ga \[A\] 기지 공격/.test(capTxt(s800[0]))
      && s800.slice(1).every((s) => s.raw === s800[0].raw || s.at - s800[0].at >= 10)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ⑳ 화면 글귀(2026-10-10, 지적: "화면에서 보여주는 내용이 자막으로 나와야 함 · 업그레이드 보이지 않는데 업그레이드 내용이 나온다거나") — 1v1 A(테란 20,20) · B(저그 100,100).
   순환 자막은 그 창에서 A 가 가장 오래 고른 무리를 말한다: ① 190~230초 아카데미 골라 둠(250초에 U-238 완료 — 63초짜리라 187초부터 돈다 · 2026-10-11) → "… 연구 중" ·
   ② 400~440초 배럭 골라 둠 · 곁에서 마린이 난다 → "배럭에서 마린 생산" ③ 500~540초 마린 여섯 B 본진으로 공격 이동 → "[A] 마린 6기 [B] 기지로 공격 이동" ·
   ④ 연구 완료(300초)는 순환 자막에 "개발"로 안 선다. */
{
  let st = 50000;
  const L = []; const sels = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (st += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
  const ac = mk(0, "Academy", true, 26, 20, 100); const rx = mk(0, "Barracks", true, 20, 28, 100);
  for (const t of [190, 200, 210, 220]) sels.push([t, 0, [ac.tag], 0]);
  for (const t of [400, 410, 420, 430]) sels.push([t, 0, [rx.tag], 0]);
  for (let t = 401; t < 440; t += 3) mk(0, "Marine", false, 21, 30, t);
  const ms = Array.from({ length: 12 }, () => mk(0, "Marine", false, 20, 30, 300, { orders: [500, 510, 520, 530].map((t) => [t, 98, 98, true]) }));
  sels.push([440, 0, [ms[0].tag], 0]);
  const w = { players: [["A", "테란", 1], ["B", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [[250, "U-238 Shells", 0, ac.tag]], casts: [], pings: [], resFields: [], kills: [], sels, builds: [] };
  const plan = castPlan9(w, { total: 700, order: ["A", "B"], teamOf: { A: 1, B: 2 } });
  /* 연구 시작 전(2026-10-11, 지적: "오버로드 이속 업그레이드가 아직 레어도 없는데 자막에서 나옴") — 완료 300초(63초짜리 → 237초 시작)면 190~230초는 '연구 중'이 아니다. */
  const early = castPlan9({ ...w, ups: [[300, "U-238 Shells", 0, ac.tag]] }, { total: 700, order: ["A", "B"], teamOf: { A: 1, B: 2 } });
  const capsIn = (t0, t1) => plan.filter((s) => s.raw === "A" && s.at >= t0 && s.at < t1).map((s) => capTxt(s));
  console.log(`\n화면 글귀: ${[...new Set(plan.filter((s) => s.raw === "A").map((s) => capTxt(s)))].join(" · ")}`);
  for (const [name, pass] of [
    ["골라 둔 건물의 연구 → '… 연구 중'(건물 이름은 군말 · 2026-10-11)", capsIn(188, 230).some((c) => /^\[A\] [^에]+ 연구 중$/.test(c) && !/에서/.test(c))],
    ["골라 둔 배럭 곁에서 난 마린 → '마린 생산'('배럭에서'는 군말 · 2026-10-10)", capsIn(398, 440).some((c) => c === "[A] 마린 생산")],
    ["대규모 병력이 적 본진으로 → '[A] 마린 [B] 기지로 공격 이동'(수 없음 · 2026-10-10)", capsIn(498, 540).some((c) => c === "[A] 마린 [B] 기지로 공격 이동")],
    ["몇 기 안 되는 무리의 이동·대기는 안 말한다", !plan.some((s) => /대기|\d+기 /.test(capTxt(s)))],
    ["연구 완료는 순환 자막에 '개발'로 안 선다", !plan.some((s) => /개발/.test(capTxt(s)))],
    ["연구 시작 전에는 '연구 중'·'업그레이드 진행 중'이 아니다(2026-10-11)", !early.some((s) => s.raw === "A" && s.at >= 188 && s.at < 230 && /연구 중|업그레이드 진행 중/.test(capTxt(s)))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉑ 하템 드랍 · 이어진 기지 피해(2026-10-10, 요청: "스톰으로 몇 기 잡음 → A가 B 기지에 하템 드랍. 스톰으로 일꾼 몇 기 잡음 · 이미 반파된 기지에 뒤늦게 가서 대파시킨
   경우 마무리지음 · A가 이어서 B 기지를 대파시킴 궤멸시킴 이렇게 정당하게") — 2v2 A·B(1팀 · 프로토스) 대 C·D(2팀).
   ① 300초: A 셔틀 한 대가 C 본진(100,100)으로 · A 하템이 스톰(101,101) · C 프로브 넷이 죽는다 → "[A]ga [C] 기지에 하이템플러 드랍. 스톰으로 일꾼 4기 잡음".
   ② D 기지(100,10 · 넥서스 + 게이트 넷 + 파일런 둘 = 1200): 500초 A 가 게이트 둘·파일런 하나(400 · 반파 0.33) → 520초 A 가 게이트 하나(대파 0.46) "이어서" →
      600초 B 가 남은 게이트·파일런·넥서스(궤멸) → "마무리지음". */
{
  let qt = 60000;
  const L = []; const kills = []; const casts = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (qt += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Nexus", true, 10, 10, 0); mk(1, "Nexus", true, 10, 100, 0); mk(2, "Nexus", true, 100, 100, 0);
  // ①
  mk(0, "Shuttle", false, 10, 10, 200, { orders: [[290, 99, 99, false]] });
  mk(0, "High Templar", false, 10, 10, 200, { orders: [[295, 99, 99, false]] });
  casts.push([300, 101, 101, "Psionic Storm", 0]);
  for (let i = 0; i < 4; i += 1) mk(2, "Probe", false, 100, 100, 100, { died: 301 + i * 0.5, end: "atk", orders: [[299, 101, 101, false]] });
  // ②
  const dn = mk(3, "Nexus", true, 100, 10, 0);
  mk(3, "Pylon", true, 60, 60, 0);   // D 의 딴 자리 건물 — 본진이 다 깨져도 엘리가 아니다(㉓ 의 엘리와 가른다)
  const gw = [0, 1, 2, 3, 4, 5].map((i) => mk(3, "Gateway", true, 104 + i * 3, 14, 50));
  const py = [mk(3, "Pylon", true, 96, 6, 30), mk(3, "Pylon", true, 106, 6, 30)];
  const az = mk(0, "Zealot", false, 10, 10, 400); const bz = mk(1, "Zealot", false, 10, 100, 400);
  const kill = (e, t, k) => { e.died = t; e.end = "atk"; kills.push([t, k.owner, k.tag, e.tag]); };
  kill(gw[0], 500, az); kill(gw[1], 501, az); kill(py[0], 502, az);
  kill(gw[2], 520, az); kill(gw[3], 521, az);
  kill(gw[4], 600, bz); kill(gw[5], 600.5, bz); kill(py[1], 601, bz); kill(dn, 603, bz);
  const w = { players: [["A", 1], ["B", 1], ["C", 2], ["D", 2]].map(([name, team], o) => ({ owner: o, name, race: "프로토스", color: "#fff", team })),
    lives: L, ups: [], casts, pings: [], resFields: [], kills };
  const plan = castPlan9(w, { total: 900, order: ["A", "B", "C", "D"], teamOf: { A: 1, B: 1, C: 2, D: 2 } }).filter((s) => !s.cyc);
  const caps = plan.map((s) => `${s.at.toFixed(0)}s ${capTxt(s)}`);
  console.log(`\n하템 드랍·이어진 기지 피해: ${caps.join(" · ")}`);
  const at = (t0, t1) => plan.filter((s) => s.at >= t0 && s.at < t1).map((s) => capTxt(s));
  for (const [name, pass] of [
    ["하템 한 대 드랍 + 스톰 일꾼 → '기지에 하이템플러 드랍. 스톰으로 일꾼 4기 잡음'", at(290, 310).some((c) => c === "[A]ga [C] 기지에 하이템플러 드랍. 스톰으로 일꾼 4기 잡음")],
    ["처음 피해 → '[A]ga [D] 기지 반파시킴'", at(490, 510).some((c) => c === "[A]ga [D] 기지 반파시킴")],
    ["같은 사람이 더 부숨 → '[A]ga 이어서 [D] 기지 대파시킴'", at(510, 530).some((c) => c === "[A]ga 이어서 [D] 기지 대파시킴")],
    ["뒤늦게 온 사람이 끝냄 → '[B]ga [D] 기지 마무리지음'(넥서스가 깨져도 기지 자막이 이긴다 · 2026-10-11)", at(590, 610).some((c) => c === "[B]ga [D] 기지 마무리지음")],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉒ 소강의 말(2026-10-10, 요청: "프로브로 파일런 건설 — 프로브로는 빼 · 파일런 건설은 굳이 안 나와도 되는 자막 · 순조롭게 발전 중 · 생산건물 늘리는 중 ·
   업그레이드 진행 중 등등") — 1v1 A(프로토스 20,20) · B(저그 100,100). ① 100~140초 A 프로브가 파일런 건설 명령(builds) → "파일런 건설"이 없다 ·
   ② 300·320초 게이트웨이 둘 → "생산 건물 늘리는 중" ③ 600초에 끝나는 연구(아무것도 안 고름) → 520초 무렵 "업그레이드 진행 중". */
{
  let ut = 70000;
  const L = []; const sels = []; const builds = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (ut += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  const nx = mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
  const pr = mk(0, "Probe", false, 20, 20, 0);
  for (const t of [100, 110, 120, 130]) { builds.push([t, 0, pr.tag, 24, 24, "Pylon"]); sels.push([t, 0, [pr.tag], 0]); }
  for (let t = 5; t < 800; t += 20) sels.push([t, 0, [nx.tag], 0]);   // 손을 안 놓은 사람(2026-10-12 · 멈춘 때부터 거꾸로 빼는 자 — 활동이 띄엄띄엄이면 빠진다)
  sels.sort((a, b) => a[0] - b[0]);
  mk(0, "Pylon", true, 24, 24, 102);
  mk(0, "Gateway", true, 26, 20, 300); mk(0, "Gateway", true, 26, 24, 320);
  const w = { players: [["A", "프로토스", 1], ["B", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [[600, "Leg Enhancements", 0, 0]], casts: [], pings: [], resFields: [], kills: [], sels, builds };
  const plan = castPlan9(w, { total: 800, order: ["A", "B"], teamOf: { A: 1, B: 2 } });
  const capsA = plan.filter((s) => s.raw === "A").map((s) => `${s.at.toFixed(0)}s ${capTxt(s)}`);
  console.log(`\n소강의 말: ${capsA.join(" · ")}`);
  const inA = (t0, t1) => plan.filter((s) => s.raw === "A" && s.at >= t0 && s.at < t1).map((s) => capTxt(s));
  for (const [name, pass] of [
    ["파일런 건설은 자막에 안 선다", !plan.some((s) => /파일런/.test(capTxt(s)))],
    ["게이트 둘 → '생산 건물 늘리는 중'(또는 빌드 읽기 '2게이트')", inA(300, 400).some((c) => c === "[A] 생산 건물 늘리는 중" || c === "[A] 2게이트")],
    ["오래 골라 둔 일꾼은 '일꾼 이동' 자막이 아니다", !plan.some((s) => /일꾼 \d+기 이동/.test(capTxt(s)))],
    ["돌고 있는 연구 → 이름으로 '질럿 속업 연구 중'(2026-10-11 · 옛 '업그레이드 진행 중')", inA(490, 600).some((c) => c === "[A] 질럿 속업 연구 중")],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉒' 남의 몸을 골라 봄(2026-10-13, 지적: "테란인데 포토 건설이 뜨거나") — 1v1 T(테란 20,20) · P(프로토스 100,100). 100~400초 T 는 제 커맨드를 고르다
   200~240초 P 의 프로브를 눌러 본다 · 그 프로브는 그때 포토 건설 명령 → T 의 자막에 '포토'가 안 선다(화면 글귀는 제 몸만). */
{
  let ot = 71000;
  const L = []; const sels = []; const builds = [];
  const mk = (o, kind, bld, x, y, born) => { const e = { tag: (ot += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [] }; L.push(e); return e; };
  const cc = mk(0, "Command Center", true, 20, 20, 0); mk(1, "Nexus", true, 100, 100, 0);
  const pr = mk(1, "Probe", false, 100, 100, 0);
  for (let t = 5; t < 400; t += 20) sels.push([t, 0, [cc.tag], 0]);
  for (const t of [200, 210, 220, 230, 240]) { builds.push([t, 1, pr.tag, 96, 96, "Photon Cannon"]); sels.push([t + 0.5, 0, [pr.tag], 0]); }
  sels.sort((a, b) => a[0] - b[0]);
  const w = { players: [["T", "테란", 1], ["P", "프로토스", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels, builds };
  const plan = castPlan9(w, { total: 400, order: ["T", "P"], teamOf: { T: 1, P: 2 } });
  console.log(`\n남의 몸: ${plan.filter((s) => s.raw === "T").map((s) => `${s.at.toFixed(0)}s ${capTxt(s)}`).join(" · ")}`);
  for (const [name, pass] of [
    ["남의 프로브를 골라 봐도 그 포토 건설은 테란의 자막이 아니다", !plan.some((s) => s.raw === "T" && /포토/.test(capTxt(s)))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉓ 인구 막힘 · 엘리(2026-10-10, 요청: "인구 막힘도 중요 포인트라 자막 나오면 좋음 · 엘리") — 1v1 A(테란 20,20) · B(저그 100,100).
   ① A 는 시작 몫 10 인구에 SCV 넷 + 마린 여섯(10)으로 215~260초 동안 꽉 찬다(서플 없음) → 순환 자막 "[A] 인구 막힘"(숫자는 2026-10-11 뺐다) ·
   ② 600초 A 마린 셋이 B 의 해처리(B 의 유일한 건물)를 부순다 → "[A]ga [B] 엘리시킴". */
{
  let vt = 80000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (vt += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 20, 20, 0);
  for (let i = 0; i < 4; i += 1) mk(0, "SCV", false, 20, 20, 0);
  /* 시작 상한(10)의 꽉 참은 막힘이 아니므로(2026-10-12 · 9드론 유지) 서플 하나(100초 → 18)를 먼저 두고 마린 열넷으로 215초에 18/18 → 260초 둘째 서플까지 막힘. */
  mk(0, "Supply Depot", true, 26, 20, 100);
  const ms = [176, 179, 182, 185, 188, 191, 194, 197, 200, 203, 206, 209, 212, 215].map((t) => mk(0, "Marine", false, 22, 22, t));
  mk(0, "Supply Depot", true, 24, 24, 260);
  const hc = mk(1, "Hatchery", true, 100, 100, 0, { died: 600, end: "atk" });
  kills.push([600, 0, ms[0].tag, hc.tag]);
  const w = { players: [["A", "테란", 1], ["B", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 700, order: ["A", "B"], teamOf: { A: 1, B: 2 } });
  /* 돈(2026-10-11, 요청: "돈이 최소 유닛 뽑을 돈이 있는 경우만 막힘") — 막힌 동안 미네랄 40(일꾼 값 50 아래)이면 막힘이 아니고 · 120 이면 막힘이다. */
  const poor = castPlan9(w, { total: 700, order: ["A", "B"], teamOf: { A: 1, B: 2 }, bank: new Map([[0, [[0, 50, 0], [200, 40, 0]]]]) });
  const rich = castPlan9(w, { total: 700, order: ["A", "B"], teamOf: { A: 1, B: 2 }, bank: new Map([[0, [[0, 50, 0], [200, 120, 0]]]]) });
  const blk = (pl) => pl.some((s) => s.raw === "A" && s.at >= 205 && s.at < 262 && capTxt(s) === "[A] 인구 막힘");
  /* 9드론 유지(2026-10-12, 요청: "저그는 일부러 9드론 유지하는 경우도 있어") — B 저그가 드론 여덟을 더해 30~90초 9/9(시작 상한 18) · 돈 넉넉 → 막힘 아님. */
  const L2 = L.slice(); const z9 = [];
  for (let i = 0; i < 9; i += 1) { const e = { tag: (vt += 1), owner: 1, kind: "Drone", born: i < 4 ? 0 : 20 + i * 2, bornX: 100, bornY: 100, died: null, end: "", bld: false,
    sites: [], doneAt: 0, lifts: [], cloaks: [], sieges: [], orders: [] }; L2.push(e); z9.push(e); }
  L2.push({ tag: (vt += 1), owner: 1, kind: "Overlord", born: 95, bornX: 100, bornY: 100, died: null, end: "", bld: false, sites: [], doneAt: 0, lifts: [], cloaks: [], sieges: [], orders: [] });
  const hold9 = castPlan9({ ...w, lives: L2 }, { total: 700, order: ["A", "B"], teamOf: { A: 1, B: 2 }, bank: new Map([[1, [[0, 50, 0], [30, 180, 0]]]]) });
  console.log(`\n인구 막힘·엘리: ${[...new Set(plan.map((s) => `${s.raw} ${capTxt(s)}`))].filter((c) => !/발전 중$/.test(c)).join(" · ")}`);
  for (const [name, pass] of [
    ["꽉 찬 인구 → '[A] 인구 막힘'(숫자 없음 · 2026-10-11)", blk(plan)],
    ["막힌 동안 미네랄 40(일꾼 값 아래) → 막힘 아님", !poor.some((s) => /인구 막힘/.test(capTxt(s)))],
    ["막힌 동안 미네랄 120 → 막힘", blk(rich)],
    ["저그 9드론 유지(시작 상한 9/9 · 돈 있음) → 막힘 아님(2026-10-12)", !hold9.some((s) => s.raw === "B" && /인구 막힘/.test(capTxt(s)))],
    ["유일한 건물이 깨짐 → '[A]ga [B] 엘리시킴'", plan.some((s) => capTxt(s) === "[A]ga [B] 엘리시킴")],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉔ gg 선언 · 노엘 외침(2026-10-10, 요청: "엘리 gg(ㅈㅈ) 선언 ㄴㅇ 노엘 외침도") — 1v1 A·B 채팅: 300초 B "ㄴㅇ" · 500초 A "gg" · 501초 A "gg"(되풀이 — 한 번만). */
{
  const L = [];
  const mk = (o, kind, x, y) => L.push({ tag: 90000 + L.length, owner: o, kind, born: 0, bornX: x, bornY: y, died: null, end: "", bld: true,
    sites: [[0, x - 1, y - 1]], doneAt: 0, lifts: [], cloaks: [], sieges: [], orders: [] });
  mk(0, "Nexus", 20, 20); mk(1, "Hatchery", 100, 100);
  const w = { players: [["A", "프로토스", 1], ["B", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels: [], builds: [] };
  const plan = castPlan9(w, { total: 600, order: ["A", "B"], teamOf: { A: 1, B: 2 },
    chats: [{ sec: 300, name: "B", text: "ㄴㅇ" }, { sec: 500, name: "A", text: "gg" }, { sec: 501, name: "A", text: "gg" }, { sec: 200, name: "관전자", text: "gg" }] });
  const caps = plan.map((s) => `${s.at.toFixed(1)}s ${capTxt(s)}`).filter((c) => /선언|외침/.test(c));
  console.log(`\ngg·노엘: ${caps.join(" · ")}`);
  for (const [name, pass] of [
    ["'ㄴㅇ' → '[B] 노엘 외침'(그때 B 화면)", plan.some((s) => s.raw === "B" && Math.abs(s.at - 299.5) < 0.01 && capTxt(s) === "[B] 노엘 외침")],
    ["'gg' → '[A] gg 선언' 한 번", caps.filter((c) => /\[A\] gg 선언/.test(c)).length === 1],
    ["경기 사람이 아닌 말은 안 쓴다", !caps.some((c) => /관전자/.test(c))],
    ["끼운 뒤에도 토막 시각은 늘 오름차순", plan.every((s, i) => i === 0 || s.at > plan[i - 1].at)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉕ 팀 전원(2026-10-10, 요청: "팀 전원이 등장할 때는 나열하지 말고 1팀 전원 A를 공격 이런 식으로") — 2v2 A·B(1팀) 대 C·D(2팀) · 500초 A·B 가 함께 C 본진(100,100)에서
   C 마린 여덟을 잡는다 → "1팀 전원이 [C] 기지 공격". */
{
  let wt = 95000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (wt += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Nexus", true, 10, 10, 0); mk(1, "Nexus", true, 10, 100, 0); mk(2, "Nexus", true, 100, 100, 0); mk(3, "Nexus", true, 100, 10, 0);
  const a = mk(0, "Dragoon", false, 10, 10, 400); const b = mk(1, "Dragoon", false, 10, 100, 400);
  for (let i = 0; i < 8; i += 1) { const v = mk(2, "Marine", false, 100, 100, 300, { died: 500 + i * 0.4, end: "atk", orders: [[498, 99, 99, false]] }); kills.push([v.died, i % 2, (i % 2 ? b : a).tag, v.tag]); }
  const w = { players: [["A", 1], ["B", 1], ["C", 2], ["D", 2]].map(([name, team], o) => ({ owner: o, name, race: "프로토스", color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills };
  const plan = castPlan9(w, { total: 700, order: ["A", "B", "C", "D"], teamOf: { A: 1, B: 1, C: 2, D: 2 } }).filter((s) => !s.cyc);
  console.log(`\n팀 전원: ${plan.map((s) => `${s.at.toFixed(0)}s ${capTxt(s)}`).join(" · ")}`);
  const pass = plan.some((s) => capTxt(s) === "1팀 전원이 [C] 기지 공격");
  console.log(`  ${pass ? "✔" : "✘"} 한 팀 전부가 친 기지 싸움 → '1팀 전원이 [C] 기지 공격'`);
}

/* ── ㉓ 제 입구 막기 · 일꾼 생산 · 엔베 건설 · 끝말(2026-10-11, 요청: "엔지니어링 베이 건설하는데 엔지니어링 베이 업그레이드라고 자막이 나와 · 자신의 입구를 건물로
   막아서 적들이 못 들어오게 하는 게 중요한 포인트인데 그건 안 나오네 · 일꾼 생산 이런 건 굳이 · 그냥 순조롭게 진행 중 · 평화롭게 발전 중 · 히드라 덴에서는 군말").
   지도 64. 지형: x 30·31 절벽(y 30~35 만 틈 · 여섯 칸). A(테란 · 커맨드 10,32) · B(저그 · 해처리 55,32).
   ① 100초 서플라이(31,31) — 틈 넷이 남아 아직 열림 ② 150초 배럭(32,34.5) — 한 칸만 남아 막힘 → "[A] 서플라이·배럭으로 입구 막음"
   ③ 60초 엔지니어링 베이(20,40) → "엔지니어링 베이 건설"(옛 "… 업그레이드") ④ 커맨드를 골라 둔 동안 SCV 가 나도 "SCV 생산"은 안 선다 ⑤ 잃은 것 없는 소강은 "순조롭게 발전 중"(옛 "평화롭게" · 2026-10-11 되요청). */
{
  const W = 64;
  const tw = { level: () => 0, walk: (x, y) => x >= 0 && y >= 0 && x < W && y < W && !((x === 30 || x === 31) && !(y >= 30 && y <= 35)) };
  let st = 61000;
  const L = []; const sels = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (st += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  const cc = mk(0, "Command Center", true, 10, 32, 0); mk(1, "Hatchery", true, 55, 32, 0);
  mk(0, "Engineering Bay", true, 20, 40, 60);
  mk(0, "Supply Depot", true, 31, 31, 100); mk(0, "Barracks", true, 32, 34.5, 150);
  for (const t of [300, 310, 320, 330]) sels.push([t, 0, [cc.tag], 0]);
  for (let t = 5; t < 600; t += 20) sels.push([t, 0, [cc.tag], 0]);   // 손을 안 놓은 사람(2026-10-12 · 위와 같은 까닭)
  sels.sort((a, b) => a[0] - b[0]);
  for (let t = 301; t < 340; t += 6) mk(0, "SCV", false, 12, 34, t);
  const w = { players: [["A", "테란", 1], ["B", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels, builds: [] };
  const plan = castPlan9(w, { total: 600, order: ["A", "B"], teamOf: { A: 1, B: 2 }, mapW: W, mapH: W, terrain: tw });
  const caps = plan.filter((s) => s.raw === "A").map((s) => capTxt(s));
  console.log(`\n입구 막기·일꾼: ${[...new Set(caps)].join(" · ")}`);
  const has = (re) => caps.some((c) => re.test(c));
  for (const [name, pass] of [
    ["틈을 한 칸만 남긴 서플라이·배럭 → '[A] 서플라이·배럭으로 입구 막음'", has(/^\[A\] 서플라이·배럭으로 입구 막음$/)],
    ["서플라이 하나(틈 넷)로는 안 막혔다 — 막음은 배럭(150초) 뒤에만", !plan.some((s) => s.raw === "A" && s.at < 140 && /입구 막음/.test(capTxt(s)))],
    ["엔지니어링 베이는 '건설'(업그레이드 아님)", has(/엔지니어링 베이 건설/) && !has(/업그레이드$/)],
    ["일꾼 생산은 안 말한다", !has(/SCV 생산|일꾼 생산/)],
    ["잃은 것 없는 소강 → '순조롭게 발전 중'(2026-10-11 되요청)", has(/^\[A\] 순조롭게 발전 중$/)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉕ 전투 단위(2026-10-11, 요청: "장면을 좀 길게 — 전투 전체를 처음부터 끝까지 · 더 중요한 게 있으면 바꾸는 건 맞는데 그 순간의 중요도가 아닌 전체 전투의 중요도") —
   2v2 A·B(1팀 테란) 대 C·D(2팀 저그). ① 100~205초 (30,30)에서 A 마린 36기가 3초마다 C 저글링에 죽는다(긴 전투 · 토막마다 가볍고 합은 무겁다)
   ② 150~164초 (100,100)에서 D 히드라 8기가 B 마린에 죽는다(순간은 무겁지만 합은 ① 보다 가볍다) → ① 을 안 끊는다 · ③ 같은 자리에 히드라 40기면(합 6975 · ① 2790 의 2 배 넘음) 끊는다. */
{
  const mkWorld = (nHyd) => {
    let t9 = 95000;
    const L = []; const kills = [];
    const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
      sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
    mk(0, "Command Center", true, 10, 10, 0); mk(1, "Command Center", true, 10, 118, 0); mk(2, "Hatchery", true, 118, 10, 0); mk(3, "Hatchery", true, 118, 118, 0);
    const lings = Array.from({ length: 6 }, () => mk(2, "Zergling", false, 118, 10, 50, { orders: [[95, 31, 31, false]] }));
    for (let i = 0; i < 36; i += 1) {
      const t = 100 + i * 3;
      const m = mk(0, "Marine", false, 10, 10, 50, { died: t, end: "atk", orders: [[t - 3, 30, 30, false]] });   // 죽기 직전 명령 — 죽은 자리(deadAt9 · LOC_W9 25초)
      kills.push([t, 2, lings[i % 6].tag, m.tag]);
    }
    const ms = Array.from({ length: 6 }, () => mk(1, "Marine", false, 10, 118, 50, { orders: [[145, 99, 99, false]] }));
    for (let i = 0; i < nHyd; i += 1) {
      const t = 150 + i * (14 / nHyd);
      const h = mk(3, "Hydralisk", false, 118, 118, 50, { died: t, end: "atk", orders: [[145, 100, 100, false]] });
      kills.push([t, 1, ms[i % 6].tag, h.tag]);
    }
    return { players: [["A", "테란", 1], ["B", "테란", 1], ["C", "저그", 2], ["D", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
      lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  };
  const opt = { total: 400, order: ["A", "C", "B", "D"], teamOf: { A: 1, B: 1, C: 2, D: 2 } };
  const small = castPlan9(mkWorld(8), opt);
  const big = castPlan9(mkWorld(40), opt);
  const onBD = (pl) => pl.some((s) => (s.raw === "B" || s.raw === "D") && s.at >= 140 && s.at < 200 && !s.cyc);
  const tl = (pl) => pl.filter((s) => s.at >= 90 && s.at < 220).map((s) => `${s.at.toFixed(0)}${s.cyc ? "~" : ""}${s.raw}`).join(" ");
  console.log(`\n전투 단위: 짧은 곳 ${tl(small)} | 큰 곳 ${tl(big)}`);
  if (process.env.CP_DEBUG) for (const pl of [small, big]) console.log(pl.filter((s) => s.at >= 90 && s.at < 220).map((s) => `${s.at.toFixed(1)} ${s.raw} ${s.cyc ? "cyc" : s.why} ${Math.round(s.score)} ${capTxt(s)}`).join("\n"), "\n--");
  for (const [name, pass] of [
    ["긴 전투(합이 무거움) 중 딴 곳의 짧은 전투(순간만 무거움)는 끼어들지 않는다", !onBD(small)],
    ["긴 전투는 처음부터 끝까지 한 주인공(A 또는 C)으로 이어진다", small.filter((s) => s.at >= 98 && s.at < 204).every((s) => s.raw === small.find((x) => x.at >= 98)?.raw)],
    ["합이 2 배 넘게 무거운 딴 전투는 끼어든다(BATTLE_JUMP9 1.2 → 2 · 2026-10-11)", onBD(big)],
    ["끼어든 전투가 끝나면 아직 이어지는 앞 전투로 돌아간다", big.some((s) => (s.raw === "A" || s.raw === "C") && s.at > 160 && s.at < 200 && !s.cyc)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉖ 뚝배기 파괴(2026-10-11, 요청: "메인홀(뚝배기) 깨는 건 진짜 중요해서 꼭 보여줘야 함" → "뚝배기 파괴") — 2v2 A·B(1팀) 대 C·D(2팀).
   ① 100~205초 (30,30) 긴 전투(A 마린이 C 저글링에 죽는다 · 합이 무겁다) ② 150초 B 마린 셋이 (100,100)의 D 해처리 하나를 깬다(D 의 다른 건물은 남는다 · 엘리 아님)
   → 긴 전투 중이어도 그리로 가고 "[B]ga [D] 뚝배기 파괴". */
{
  let t9 = 99000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 10, 10, 0); mk(1, "Command Center", true, 10, 118, 0); mk(2, "Hatchery", true, 118, 10, 0);
  mk(3, "Hatchery", true, 118, 118, 60); mk(3, "Spawning Pool", true, 114, 118, 0);   // 118,118 은 멀티 — 시작 본진은 임자마다 하나(아래 hat · 2026-10-13)
  const lings = Array.from({ length: 6 }, () => mk(2, "Zergling", false, 118, 10, 50, { orders: [[95, 31, 31, false]] }));
  for (let i = 0; i < 36; i += 1) { const t = 100 + i * 3; const m = mk(0, "Marine", false, 10, 10, 50, { died: t, end: "atk", orders: [[t - 3, 30, 30, false]] }); kills.push([t, 2, lings[i % 6].tag, m.tag]); }
  const ms = Array.from({ length: 3 }, () => mk(1, "Marine", false, 10, 118, 50, { orders: [[140, 100, 100, false]] }));
  const hat = mk(3, "Hatchery", true, 100, 100, 0, { died: 150, end: "atk" });   // 시작 본진(첫 순간) — 뚝배기(2026-10-11: 시작 본진만)
  kills.push([150, 1, ms[0].tag, hat.tag]);
  const w = { players: [["A", "테란", 1], ["B", "테란", 1], ["C", "저그", 2], ["D", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 400, order: ["A", "C", "B", "D"], teamOf: { A: 1, B: 1, C: 2, D: 2 } });
  /* 멀티(60초에 지은) 해처리면 뚝배기가 아니라 "해처리 파괴" — 긴 전투가 없는 판으로 본다(멀티는 한창인 전투를 안 끊는다). */
  const L2 = L.filter((e) => e.kind !== "Marine" || e.owner !== 0).map((e) => (e.tag === hat.tag ? { ...e, born: 60 } : e.kind === "Hatchery" && e.owner === 3 ? { ...e, born: 0 } : e));
  const plan2 = castPlan9({ ...w, lives: L2, kills: kills.filter((k) => k[3] === hat.tag) }, { total: 400, order: ["A", "C", "B", "D"], teamOf: { A: 1, B: 1, C: 2, D: 2 } });
  console.log(`\n뚝배기: ${plan.filter((s) => s.at >= 90 && s.at < 220).map((s) => `${s.at.toFixed(0)} ${capTxt(s)}`).join(" · ")}`);
  for (const [name, pass] of [
    ["긴 전투 중에도 시작 본진을 깨면 그리로 간다 · '[B]ga [D] 뚝배기 파괴'", plan.some((s) => s.at >= 140 && s.at <= 152 && capTxt(s) === "[B]ga [D] 뚝배기 파괴")],
    ["멀티 해처리는 뚝배기가 아니라 '[B]ga [D] 해처리 파괴'", plan2.some((s) => capTxt(s) === "[B]ga [D] 해처리 파괴") && !plan2.some((s) => /뚝배기/.test(capTxt(s)))],
    /* 덤퍼의 첫 키가 늦게 와도(시작 본진 born 4초) 임자의 첫 본진이면 뚝배기(2026-10-13, 지적: "뚝배기 파괴가 이상해 · 뚝배기는 처음 스타팅 건물") */
    ["시작 본진의 첫 키가 4초여도 뚝배기", castPlan9({ ...w, lives: L.map((e) => (e.tag === hat.tag ? { ...e, born: 4 } : e)) }, { total: 400, order: ["A", "C", "B", "D"], teamOf: { A: 1, B: 1, C: 2, D: 2 } })
      .some((s) => capTxt(s) === "[B]ga [D] 뚝배기 파괴")],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉗ 옆탱이 먼저(2026-10-11, 지적: "옆탱을 언덕탱으로 나오네 — 옆탱은 벽 너머로 때리는 거") — 지도 128. x 36·37(y 0~40) 벽 · 벽 서쪽(x < 36)은 고도 2(높은 땅).
   T(테란 20,20) 탱크가 160초 (34,22) 높은 땅에서 시즈 — 벽 너머 Y(저그 52,20)의 스포닝풀(44,20) → "옆탱"(언덕탱 아님). */
{
  const W = 128;
  const wall = (x, y) => (x === 36 || x === 37) && y >= 0 && y <= 40;
  const tw = { level: (x) => (x < 36 ? 2 : 0), walk: (x, y) => x >= 0 && y >= 0 && x < W && y < W && !wall(x, y), ramp: () => false };
  let tt = 120000;
  const L = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (tt += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 20, 20, 0); mk(1, "Hatchery", true, 52, 20, 0); mk(1, "Spawning Pool", true, 44, 20, 0);
  mk(0, "Siege Tank (Tank Mode)", false, 20, 20, 100, { orders: [[150, 34, 22, false]], sieges: [[160, true]] });
  const w = { players: [["T", "테란", 1], ["Y", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels: [], builds: [] };
  const caps = castPlan9(w, { total: 400, order: ["T", "Y"], teamOf: { T: 1, Y: 2 }, mapW: W, mapH: W, terrain: tw }).map((s) => capTxt(s));
  console.log(`\n옆탱 먼저: ${[...new Set(caps)].filter((c) => /탱/.test(c)).join(" · ")}`);
  for (const [name, pass] of [
    ["높은 땅에서 벽 너머 적 기지 → '옆탱'(언덕탱 아님)", caps.some((c) => /\[T\]ga \[Y\] 기지에 옆탱/.test(c)) && !caps.some((c) => /언덕탱/.test(c))],
    /* 같은 높이 · 탱크 자리 한 칸만 고도 2(절벽 가장자리 따위) · 표적은 적 기지 밖(해처리에서 먼 크립) — 옛 한 칸 고도 판정은 "언덕탱"이었다(지적: "높이는 같고 사이에 벽이 있는데
       언덕탱으로 나왔어"). 이제 둘레 5×5 의 가장 흔한 고도라 같은 높이다. */
    ["같은 높이 · 탱크 칸만 높게 표시 → '언덕탱' 아님", (() => {
      const tw2 = { ...tw, level: (x, y) => (x === 34 && y === 22 ? 2 : 0) };
      const L2 = L.filter((e) => e.kind !== "Spawning Pool" && e.kind !== "Hatchery").concat([
        { ...L.find((e) => e.kind === "Hatchery"), tag: 120998, bornX: 100, bornY: 100 },
        { ...L.find((e) => e.kind === "Spawning Pool"), tag: 120999, kind: "Creep Colony", bornX: 42, bornY: 26 }]);   // 표적은 탱크 9타일 · 적 기지(100,100) 밖
      const c2 = castPlan9({ ...w, lives: L2 }, { total: 400, order: ["T", "Y"], teamOf: { T: 1, Y: 2 }, mapW: W, mapH: W, terrain: tw2 }).map((x) => capTxt(x));
      return !c2.some((c) => /언덕탱/.test(c));
    })()],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉘ 팀 헬프 · 한 사람의 기지(2026-10-11, 요청: "한 명이 공격당하고 나머지 팀원이 도와준 경우 일일이 열거하지 말고 1팀 전체가 헬프 · 누군가의 기지에 여러 사람의
   유닛이 있어도 그건 한 명의 기지를 공격한 것으로") — 3v3 A·B·X(1팀) 대 C·D·E(2팀). 300~320초 A 마린 열둘이 C 본진(100,100)에서 C·D·E 의 히드라에 죽고(D·E 가 헬프),
   C 히드라 넷이 A 에게 죽는다 · A 마린 넷은 기지 밖 (70,70)에서 죽는다(가는 길) → "[A]ga [C] 기지 공격 · 2팀 전체가 헬프". */
{
  let t9 = 130000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 10, 10, 0); mk(1, "Command Center", true, 10, 60, 0); mk(2, "Command Center", true, 10, 118, 0);
  mk(3, "Hatchery", true, 100, 100, 0); mk(4, "Hatchery", true, 118, 60, 0); mk(5, "Hatchery", true, 60, 118, 0);
  const am = Array.from({ length: 4 }, () => mk(0, "Marine", false, 10, 10, 50, { orders: [[290, 99, 99, false]] }));
  const hy = [3, 4, 5].map((o) => mk(o, "Hydralisk", false, 100, 100, 50, { orders: [[290, 100, 100, false]] }));
  for (let i = 0; i < 12; i += 1) { const t = 300 + i * 1.5; const m = mk(0, "Marine", false, 10, 10, 50, { died: t, end: "atk", orders: [[t - 2, 99, 99, false]] }); kills.push([t, [3, 4, 5][i % 3], hy[i % 3].tag, m.tag]); }
  for (let i = 0; i < 4; i += 1) { const t = 301 + i * 3; const h = mk(3, "Hydralisk", false, 100, 100, 50, { died: t, end: "atk", orders: [[t - 2, 101, 101, false]] }); kills.push([t, 0, am[i].tag, h.tag]); }
  for (let i = 0; i < 4; i += 1) { const t = 299 + i; const m = mk(0, "Marine", false, 10, 10, 50, { died: t, end: "atk", orders: [[t - 2, 70, 70, false]] }); kills.push([t, 4, hy[1].tag, m.tag]); }
  const w = { players: [["A", "테란", 1], ["B", "테란", 1], ["X", "테란", 1], ["C", "저그", 2], ["D", "저그", 2], ["E", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 500, order: ["A", "C", "B", "D", "X", "E"], teamOf: { A: 1, B: 1, X: 1, C: 2, D: 2, E: 2 } });
  const caps = plan.filter((s) => s.at >= 290 && s.at < 330 && !s.cyc).map((s) => capTxt(s));
  console.log(`\n팀 헬프·한 사람의 기지: ${[...new Set(caps)].join(" · ")}`);
  for (const [name, pass] of [
    ["C 기지 싸움에 C 팀원 둘이 도움 → '[A]ga [C] 기지 공격 · 2팀 전체가 헬프'", caps.some((c) => c === "[A]ga [C] 기지 공격 · 2팀 전체가 헬프")],
    ["맞은 사람을 나열하지 않는다(' [C] [D] [E]' 꼴 없음)", !caps.some((c) => /\[C\] \[D\]|\[D\] \[E\]/.test(c))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉙ 첫 순환은 자리와 종족(2026-10-11, 요청: "첫 장면들 순환할 때 순조롭게 발전 중보다는 몇 시와 종족 — 기수 7시 테란") — 지도 128 · A 테란 (16,112) 7시 · B 저그 (112,16) 1시 ·
   C 프로토스 (112,64) 3시. 사람마다 첫 순환 토막이 "[A] 7시 테란"이고 둘째부터는 옛 글귀. */
{
  let t9 = 140000;
  const L = [];
  const mk = (o, kind, x, y) => L.push({ tag: (t9 += 1), owner: o, kind, born: 0, bornX: x, bornY: y, died: null, end: "", bld: true, sites: [[0, x - 1, y - 1]], doneAt: 0, lifts: [], cloaks: [], sieges: [], orders: [] });
  mk(0, "Command Center", 16, 112); mk(1, "Hatchery", 112, 16); mk(2, "Nexus", 112, 64);
  const w = { players: [["A", "테란", 1], ["B", "저그", 2], ["C", "프로토스", 3]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels: [], builds: [] };
  const plan = castPlan9(w, { total: 200, order: ["A", "B", "C"], mapW: 128, mapH: 128 });
  const first = (r) => plan.find((s) => s.raw === r);
  console.log(`\n첫 순환: ${["A", "B", "C"].map((r) => capTxt(first(r))).join(" · ")} | 둘째 A: ${capTxt(plan.filter((s) => s.raw === "A")[1] ?? {})}`);
  for (const [name, pass] of [
    ["첫 순환 '[A] 7시 테란' · '[B] 1시 저그' · '[C] 3시 프로토스'", capTxt(first("A")) === "[A] 7시 테란" && capTxt(first("B")) === "[B] 1시 저그" && capTxt(first("C")) === "[C] 3시 프로토스"],
    ["둘째 순환부터는 자리·종족이 아니다", !/시 (테란|저그|프로토스)$/.test(capTxt(plan.filter((s) => s.raw === "A")[1] ?? { caps: [] }))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉚ 첫 바퀴는 팀째로(2026-10-11, 요청: "첫 순환은 1팀 쭉 하고 2팀 쭉 하고 · 그다음부턴 교대로") — 2v2 A·B(1팀) 대 C·D(2팀) · 사건 없음 · 로스터 A C B D.
   첫 넷 순환 = A B C D(팀째로) · 다섯째부터는 팀 번갈아(고리 A C B D). */
{
  let t9 = 150000;
  const L = [];
  const mk = (o, kind, x, y) => L.push({ tag: (t9 += 1), owner: o, kind, born: 0, bornX: x, bornY: y, died: null, end: "", bld: true, sites: [[0, x - 1, y - 1]], doneAt: 0, lifts: [], cloaks: [], sieges: [], orders: [] });
  mk(0, "Command Center", 16, 112); mk(1, "Command Center", 16, 16); mk(2, "Hatchery", 112, 16); mk(3, "Hatchery", 112, 112);
  const w = { players: [["A", "테란", 1], ["B", "테란", 1], ["C", "저그", 2], ["D", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels: [], builds: [] };
  const plan = castPlan9(w, { total: 200, order: ["A", "C", "B", "D"], teamOf: { A: 1, B: 1, C: 2, D: 2 }, mapW: 128, mapH: 128 });
  const seq = plan.filter((s) => s.cyc).map((s) => s.raw).join("");
  console.log(`\n첫 바퀴 팀째로: ${seq}`);
  for (const [name, pass] of [
    ["첫 바퀴 A B C D(1팀 쭉 · 2팀 쭉)", seq.startsWith("ABCD")],
    ["그다음부터 팀 번갈아(D 다음 A · C 차례가 섞임)", /^ABCD(AC|CB|BD|DA)/.test(seq) && !/^ABCDAB/.test(seq)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉛ 궤멸한 사람은 순환에서 빠진다(2026-10-11, 지적: "궤멸된 수달이가 있는데 자꾸 수달이 화면이 나오고 실제로는 타센 화면이 그냥 멈춘 채 나와") — 1v1v1 A·B·C(밀리).
   C 의 해처리가 150초에 깨지고 오버로드 하나는 끝까지 산다 → 160초 뒤 순환에 C 가 없다(옛 판은 몸 하나라도 살면 끝까지 돌았다). */
{
  let t9 = 160000;
  const L = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 16, 112, 0); mk(1, "Nexus", true, 112, 16, 0);
  mk(2, "Hatchery", true, 112, 112, 0, { died: 150, end: "atk" }); mk(2, "Overlord", false, 112, 112, 0);
  const w = { players: [["A", "테란", 1], ["B", "프로토스", 2], ["C", "저그", 3]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels: [], builds: [] };
  const plan = castPlan9(w, { total: 400, order: ["A", "B", "C"], mapW: 128, mapH: 128 });
  const after = plan.filter((s) => s.at >= 160).map((s) => s.raw);
  console.log(`\n궤멸 뒤 순환: ${after.join("")}`);
  for (const [name, pass] of [
    ["건물을 다 잃은 사람은 그 뒤 순환에 안 나온다(오버로드가 살아 있어도)", after.length > 0 && !after.includes("C")],
    ["그 전에는 나온다", plan.some((s) => s.raw === "C" && s.at < 150)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉜ 손 놓은 사람은 순환에서 빠진다(2026-10-11, 되지적: "건물이 남아도 생산을 안 할 수도") — 1v1v1 A·B·C(밀리) · 선택 기록이 있는 판.
   A·B 는 20초마다 고른다 · C 는 100초까지만 고르고 그 뒤 손을 놓는다(건물은 끝까지 남는다) → 170초 뒤 순환에 C 가 없다. */
{
  let t9 = 170000;
  const L = []; const sels = [];
  const mk = (o, kind, bld, x, y, born) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [] }; L.push(e); return e; };
  const hs = [mk(0, "Command Center", true, 16, 112, 0), mk(1, "Nexus", true, 112, 16, 0), mk(2, "Hatchery", true, 112, 112, 0)];
  for (let t = 5; t < 400; t += 20) { sels.push([t, 0, [hs[0].tag], 0]); sels.push([t + 1, 1, [hs[1].tag], 0]); if (t < 100) sels.push([t + 2, 2, [hs[2].tag], 0]); }
  sels.sort((a, b) => a[0] - b[0]);
  const w = { players: [["A", "테란", 1], ["B", "프로토스", 2], ["C", "저그", 3]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels, builds: [] };
  const plan = castPlan9(w, { total: 400, order: ["A", "B", "C"], mapW: 128, mapH: 128 });
  const after = plan.filter((s) => s.at >= 170).map((s) => s.raw);
  console.log(`\n손 놓은 뒤 순환: ${after.join("")}`);
  for (const [name, pass] of [
    ["건물이 남아도 60초 넘게 활동이 없으면 순환에 안 나온다", after.length > 0 && !after.includes("C")],
    ["멈춘 때(마지막 고름 97초)부터 거꾸로 빠진다(2026-10-12)", !plan.some((s) => s.raw === "C" && s.at >= 100)],
    ["손 놓기 전에는 나온다", plan.some((s) => s.raw === "C" && s.at < 100)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉝ 자막은 사건 때에(2026-10-11, 지적: "전투가 길게 잡히면서 화면과 안 맞는 자막 — 타이밍을 정확히") — 1v1 A(테란) 대 C(저그 · 본진 100,100).
   한 토막 안: 100~112초 C 저글링이 3초마다 A 에게 죽고(교전) · 115~127초 C 건물(스포닝풀·에볼 둘·크립 넷)이 3초마다 부서진다(기지 대파). 옛 판은 토막 머리(98.5초)에
   "기지 대파"가 떴다 → 이제 100초 무렵은 공격 글귀 · 115초 뒤에 기지 피해 글귀. */
{
  let t9 = 180000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 16, 16, 0); mk(1, "Hatchery", true, 100, 100, 0);
  const ms = Array.from({ length: 6 }, () => mk(0, "Marine", false, 16, 16, 50, { orders: [[95, 100, 98, false]] }));
  for (let i = 0; i < 5; i += 1) { const t = 100 + i * 3; const z = mk(1, "Zergling", false, 100, 100, 50, { died: t, end: "atk", orders: [[t - 2, 101, 99, false]] }); kills.push([t, 0, ms[i % 6].tag, z.tag]); }
  const blds = [["Spawning Pool", 104, 100], ["Evolution Chamber", 96, 100], ["Evolution Chamber", 100, 104], ["Creep Colony", 104, 104], ["Creep Colony", 96, 96], ["Creep Colony", 104, 96]];
  blds.forEach(([k, x, y], i) => { const t = 115 + i * 2.5; const b = mk(1, k, true, x, y, 10, { died: t, end: "atk" }); kills.push([t, 0, ms[i % 6].tag, b.tag]); });
  const w = { players: [["A", "테란", 1], ["C", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 300, order: ["A", "C"], teamOf: { A: 1, C: 2 } });
  const seg = plan.filter((s) => s.at >= 95 && s.at < 135 && !s.cyc).map((s) => `${s.at.toFixed(1)} ${capTxt(s)}`);
  console.log(`\n사건 때 자막: ${seg.join(" · ")}`);
  const early = plan.filter((s) => s.at >= 95 && s.at < 110 && !s.cyc).map((s) => capTxt(s));   // 첫 창(100~110) — 살짝 미리 뜨는 건 괜찮다(같은 날: "살짝 미리 뜨는 건 괜찮지")
  const late = plan.filter((s) => s.at >= 112 && s.at < 135 && !s.cyc).map((s) => capTxt(s));
  for (const [name, pass] of [
    ["앞(유닛 싸움) 자막에 기지 피해가 미리 안 뜬다", early.length > 0 && !early.some((c) => /기지 (반파|대파|궤멸)|파괴/.test(c))],
    ["건물이 부서지는 때에 기지 피해 자막이 선다", late.some((c) => /기지 (반파|대파|궤멸)|건물 파괴/.test(c))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉞ 막아 낸 쪽은 방어로(2026-10-11, 지적: "처들어온 걸 방어한 건데 자막은 공격한 걸로 반대로 나오는 케이스") — 1v1 A(테란 · 본진 16,16) 대 C(저그 · 본진 100,100).
   100~118초 C 저글링이 A 본진에 쳐들어와 3초마다 죽고(SCV 둘도 잃는다) · 121~133초 물러나는 저글링을 A 마린이 C 쪽 길(74~80)까지 쫓아 잡는다.
   물러나는 몸은 마지막 명령이 '본진으로 이동'(100,100)이라 옛 어림은 C 본진에서 죽은 것으로 읽어 "A가 C 기지 공격"으로 뒤집었다 → 이제 죽은 자리는 생애의 마지막
   키(endX/Y · 가운데 길). 쫓는 창은 같은 전투라 싸움터 임자(A)를 그대로 잇는다(battleOwner9 · 같은 날 "어느 기지를 공격하는지는 안 변하거든"). */
{
  let t9 = 190000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 16, 16, 0); mk(1, "Hatchery", true, 100, 100, 0);
  const ms = Array.from({ length: 8 }, () => mk(0, "Marine", false, 16, 16, 50));
  const zs = [];
  for (let i = 0; i < 7; i += 1) { const t = 100 + i * 3; const z = mk(1, "Zergling", false, 100, 100, 50, { died: t, end: "atk", orders: [[t - 2, 18, 18, false]] }); kills.push([t, 0, ms[i % 8].tag, z.tag]); zs.push(z); }
  for (let i = 0; i < 1; i += 1) { const t = 102 + i * 4; const s = mk(0, "SCV", false, 18, 18, 30, { died: t, end: "atk" }); kills.push([t, 1, zs[6].tag, s.tag]); }
  for (let i = 0; i < 7; i += 1) { const t = 121 + i * 2.5; const p = 30 + i * 8; const z = mk(1, "Zergling", false, 100, 100, 50, { died: t, end: "atk", orders: [[90, 18, 18, true], [119, 100, 100, false]], endX: p, endY: p });
    kills.push([t, 0, ms[i % 8].tag, z.tag]); }
  const w = { players: [["A", "테란", 1], ["C", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 300, order: ["A", "C"], teamOf: { A: 1, C: 2 } });
  const seg = plan.filter((s) => s.at >= 95 && s.at < 160).map((s) => `${s.at.toFixed(1)} ${s.raw} ${s.cyc ? "순환 " : ""}${capTxt(s)} (${s.role ?? "-"})`);
  console.log(`\n막아 낸 전투: ${seg.join(" · ")}`);
  const caps = plan.filter((s) => s.at >= 95 && s.at < 140 && !s.cyc);
  for (const [name, pass] of [
    ["막아 낸 A 가 공격한 사람으로 안 나온다", caps.length > 0 && !caps.some((s) => /^\[A\]ga \[C\]eul 공격|^\[A\]ga \[C\] 기지 공격/.test(capTxt(s)))],
    ["쳐들어온 C 가 A 기지 공격으로 나온다", caps.some((s) => /^\[C\]ga \[A\] 기지 공격/.test(capTxt(s)))],
    ["한 전투의 싸움터(A 기지)는 쫓는 때도 안 바뀐다 — 교전으로 안 끊긴다(2026-10-11 \"어느 기지를 공격하는지는 안 변하거든\")", !caps.some((s) => /교전$/.test(capTxt(s)))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㉟ 기지 영역은 벽·언덕으로(2026-10-11, 지적: "기지 영역 판단이 잘 안 돼서 — 벽이나 언덕으로 구분해야") — A 본진(8,8)은 언덕(고도 2 · x 0~40 · y 0~20) ·
   그 아래 절벽(y 21~22 · x 41~42 못 걸음) · 램프는 x 36~39. ① 200초 언덕 구석(38,14 — 본진에서 30타일 · 옛 18타일 원 밖)에서 C 저글링이 죽는다 → A 기지 공격.
   ② 400초 절벽 아래(12,25 — 17.5타일 · 옛 원 안)에서 죽는다 → 기지가 아니다(교전). */
{
  let t9 = 200000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 8, 8, 0); mk(1, "Hatchery", true, 100, 100, 0);
  const ms = Array.from({ length: 6 }, () => mk(0, "Marine", false, 8, 8, 50));
  const fight = (t0, x, y) => { for (let i = 0; i < 6; i += 1) { const t = t0 + i * 2; const z = mk(1, "Zergling", false, 100, 100, t0 - 60, { died: t, end: "atk", orders: [[t0 - 20, x, y, true]], endX: x + (i % 2), endY: y });
    kills.push([t, 0, ms[i].tag, z.tag]); } };
  fight(200, 38, 14); fight(400, 12, 25);
  const plat = (x, y) => x <= 40 && y <= 20;
  const ramp = (x, y) => x >= 36 && x <= 39 && (y === 21 || y === 22);
  const cliff = (x, y) => !ramp(x, y) && ((y >= 21 && y <= 22 && x <= 42) || (x >= 41 && x <= 42 && y <= 22));
  const terrain = { level: (x, y) => (plat(x, y) ? 2 : ramp(x, y) ? 1 : 0), walk: (x, y) => x >= 0 && y >= 0 && x < 128 && y < 128 && !cliff(x, y), ramp };
  const w = { players: [["A", "테란", 1], ["C", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 600, order: ["A", "C"], teamOf: { A: 1, C: 2 }, mapW: 128, mapH: 128, terrain });
  const c1 = plan.filter((s) => s.at >= 195 && s.at < 215 && !s.cyc).map((s) => capTxt(s));
  const c2 = plan.filter((s) => s.at >= 395 && s.at < 415 && !s.cyc).map((s) => capTxt(s));
  console.log(`\n기지 영역: 언덕 구석 ${c1.join(" · ")} | 절벽 아래 ${c2.join(" · ")}`);
  for (const [name, pass] of [
    ["언덕 구석(옛 원 밖)도 A 기지 — C가 A 기지 공격", c1.some((c) => /\[C\]ga \[A\] 기지 공격/.test(c))],
    ["절벽 아래(옛 원 안)는 A 기지가 아니다", c2.length > 0 && !c2.some((c) => /기지 공격/.test(c))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㊲ 입구 띠(2026-10-14, 지적: "입구 판단이 아직 잘 안 되는 듯 · 로직 점검해봐") ─────────────────────────────────────────────────────────
   ⓐ 닫힌 언덕 본진: Z 해처리 (100,100) · 언덕 x 84~127 · y 84~127(고도 2) · 둘레 벽(x 82·83 / y 82·83) · 램프 x 92~95 · y 82·83(고도 1).
      200초 P 포토 (93,87) — 램프 4 타일 **안쪽**(본진 안 · 해처리 14.8) → 옛 셈(14~30 원 + 램프 6)은 "입구 막기" · 이제 아님. 300초 P 포토 (94,79) 램프 밑 → "입구를 포토로 막음".
   ⓑ 앞마당 입구 막기: A(10,32) · 본진 미네랄 (4,30~34) · 앞마당 미네랄 (44,24~28) · 절벽 x 50·51(y 30~35 만 틈). 100초 서플라이(51,31) · 150초 배럭(52,34.5) — 출발 자리에서 41 타일
      (옛 거리 BASE_R9 + 10 = 28 밖)이지만 앞마당(44,26)에서 10 → "[A] 서플라이·배럭으로 입구 막음". */
{
  let t9 = 370000;
  const L = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Nexus", true, 20, 20, 0); mk(1, "Hatchery", true, 100, 100, 0);
  mk(0, "Photon Cannon", true, 93, 87, 200); mk(0, "Photon Cannon", true, 94, 79, 300);
  const ramp = (x, y) => x >= 92 && x <= 95 && (y === 82 || y === 83);
  const wall = (x, y) => !ramp(x, y) && ((x >= 82 && x <= 83 && y >= 82) || (y >= 82 && y <= 83 && x >= 82));
  const terrain = { level: (x, y) => (ramp(x, y) ? 1 : x >= 84 && y >= 84 ? 2 : 0), walk: (x, y) => x >= 0 && y >= 0 && x < 128 && y < 128 && !wall(x, y), ramp };
  const w = { players: [["P", "프로토스", 1], ["Z", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels: [], builds: [] };
  const plan = castPlan9(w, { total: 600, order: ["P", "Z"], teamOf: { P: 1, Z: 2 }, mapW: 128, mapH: 128, terrain, event: true });
  const capsP = (lo, hi) => (plan.search ?? []).filter((s) => s.raw === "P" && s.at >= lo && s.at < hi).map((s) => capTxt(s));
  console.log(`\n입구 띠 ⓐ: 200초 ${capsP(195, 210).join(" · ") || "-"} | 300초 ${capsP(295, 310).join(" · ") || "-"}`);
  for (const [name, pass] of [
    ["램프 안쪽(본진 안) 포토는 입구 막기가 아니다", !capsP(195, 210).some((c) => /입구를 포토로 막음/.test(c))],
    ["램프 밑 포토 → 입구 막기", capsP(295, 310).some((c) => /\[P\]ga \[Z\] 입구를 포토로 막음/.test(c))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}
{
  const W = 64;
  const tw = { level: () => 0, walk: (x, y) => x >= 0 && y >= 0 && x < W && y < W && !((x === 50 || x === 51) && !(y >= 30 && y <= 35)) };
  let st = 371000;
  const L = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (st += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 10, 32, 0); mk(1, "Hatchery", true, 58, 32, 0);
  mk(0, "Supply Depot", true, 51, 31, 100); mk(0, "Barracks", true, 52, 34.5, 150);
  const resources = [...[30, 32, 34].map((y) => [4, y]), ...[24, 26, 28].map((y) => [44, y]), ...[30, 32, 34].map((y) => [62, y])];
  const w = { players: [["A", "테란", 1], ["B", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels: [], builds: [] };
  const plan = castPlan9(w, { total: 400, order: ["A", "B"], teamOf: { A: 1, B: 2 }, mapW: W, mapH: W, terrain: tw, resources });
  const caps = (plan.search ?? []).filter((s) => s.raw === "A").map((s) => capTxt(s));
  console.log(`입구 띠 ⓑ: ${[...new Set(caps)].join(" · ") || "-"}`);
  for (const [name, pass] of [
    ["앞마당 입구(출발 자리 41 타일)를 막은 서플라이·배럭 → 입구 막음", caps.some((c) => /^\[A\] 서플라이·배럭으로 입구 막음$/.test(c))],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}
/* ── ㊱ 입구는 뚫려 있고 둘 이상(2026-10-11, 지적: "입구는 뚫려 있지 · 입구(램프)가 두 개 이상이기도 하고") — 온 땅이 같은 고도(2)인데 A 본진 언덕(x 0~40 · y 0~20)을
   벽(y 21~22 · x 41~42)이 둘렀고 **같은 고도로 뚫린 길목**(x 20~23)과 **램프**(x 36~39 · 고도 1) 두 입구가 있다. 벽·고도만 보면 길목으로 새어 열린 땅(18 원)이 됐다.
   ① 언덕 구석(38,14 · 30타일) → A 기지 · ② 벽 바깥(12,25) → 아님 · ③ 길목 앞(21,25) → A 기지(입구) · ④ 램프 아래(37,25) → A 기지(입구) · ⑤ 벌판 멀리(60,40) → 아님. */
{
  let t9 = 210000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 8, 8, 0); mk(1, "Hatchery", true, 110, 110, 0);
  const ms = Array.from({ length: 6 }, () => mk(0, "Marine", false, 8, 8, 50));
  const fight = (t0, x, y) => { for (let i = 0; i < 6; i += 1) { const t = t0 + i * 2; const z = mk(1, "Zergling", false, 110, 110, t0 - 60, { died: t, end: "atk", orders: [[t0 - 20, x, y, true]], endX: x + (i % 2) * 0.5, endY: y });
    kills.push([t, 0, ms[i].tag, z.tag]); } };
  const spots = [[200, 38, 14], [400, 12, 25], [600, 21, 25], [800, 37, 25], [1000, 60, 40]];
  for (const [t0, x, y] of spots) fight(t0, x, y);
  const ramp = (x, y) => x >= 36 && x <= 39 && (y === 21 || y === 22);
  const gap = (x, y) => x >= 20 && x <= 23 && (y === 21 || y === 22);
  const wall = (x, y) => !ramp(x, y) && !gap(x, y) && ((y >= 21 && y <= 22 && x <= 42) || (x >= 41 && x <= 42 && y <= 22));
  const terrain = { level: (x, y) => (ramp(x, y) ? 1 : 2), walk: (x, y) => x >= 0 && y >= 0 && x < 128 && y < 128 && !wall(x, y), ramp };
  const w = { players: [["A", "테란", 1], ["C", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 1200, order: ["A", "C"], teamOf: { A: 1, C: 2 }, mapW: 128, mapH: 128, terrain });
  const capsAt = (t0) => plan.filter((s) => s.at >= t0 - 5 && s.at < t0 + 15 && !s.cyc).map((s) => capTxt(s));
  const base = (t0) => capsAt(t0).some((c) => /\[C\]ga \[A\] 기지 공격/.test(c));
  console.log(`\n입구 둘: ${spots.map(([t0, x, y]) => `(${x},${y}) ${capsAt(t0).join(" · ") || "-"}`).join(" | ")}`);
  for (const [name, pass] of [
    ["언덕 구석은 기지(길목으로 안 샌다)", base(200)],
    ["벽 바깥은 기지가 아니다", capsAt(400).length > 0 && !base(400)],
    ["뚫린 길목 앞은 기지 입구", base(600)],
    ["램프 아래도 기지 입구(입구 둘)", base(800)],
    ["벌판 멀리는 기지가 아니다", capsAt(1000).length > 0 && !base(1000)],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㊲ 자막은 싸움이 붙을 때 서고 끝나면 걷힌다(2026-10-11, 지적: "아직도 장면과 자막 타이밍이 안 맞아 — 자막이 장면보다 너무 늦게 나오고 늦게 끝나는 듯") —
   1v1 A 마린 여섯이 300초부터 C 히드라 여섯을 겨누고(겨눔 자국) 304~314초에 2초마다 하나씩 잡는다. 옛 판은 첫 **죽음**(304) 앞 1.5초(302.5)에 카메라·자막이 섰고
   자막은 다음 순환까지 남았다 → 이제 겨눔이 붙은 300초 앞(≤ 299)에 서고 마지막 킬(314) + 3초 = 317 에 걷힌다(capTo). */
{
  let t9 = 220000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 16, 16, 0); mk(1, "Hatchery", true, 100, 100, 0);
  const hs = Array.from({ length: 6 }, (_, i) => mk(1, "Hydralisk", false, 100, 100, 200, { died: 304 + i * 2, end: "atk", orders: [[296, 60, 60, true]], endX: 60, endY: 60 }));
  hs.forEach((h, i) => { mk(0, "Marine", false, 16, 16, 200, { orders: [[296, 58, 58, true]], tgt: Float64Array.from([300, h.tag, h.died + 0.2, 0]) }); });
  hs.forEach((h, i) => kills.push([h.died, 0, L[L.length - 6 + i].tag, h.tag]));
  const w = { players: [["A", "테란", 1], ["C", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 500, order: ["A", "C"], teamOf: { A: 1, C: 2 } });
  const fight = plan.filter((s) => !s.cyc && s.at > 280 && s.at < 330);
  console.log(`\n싸움 자막 때: ${fight.map((s) => `${s.at.toFixed(1)}~${s.capTo?.toFixed(1) ?? "∞"} ${capTxt(s)}`).join(" · ")}`);
  for (const [name, pass] of [
    ["겨눔이 붙은 때(300) 앞에 선다", fight.length > 0 && fight[0].at <= 299],
    ["마지막 킬(314) 뒤 3초 언저리에 걷힌다", fight.length > 0 && Math.abs((fight[fight.length - 1].capTo ?? 999) - 317) <= 1],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㊳ 주인공이 애매하면 교전 자리(2026-10-11, 요청: "주인공을 딱 한 명 정하기 애매한 경우 개인 화면이 아닌 교전 위치를 추적해서 보여 주고 누구 화면 표시 없애기") —
   ① 300초 가운데(60,60)에서 A 마린 여섯 · C 마린 여섯이 서로 하나씩 번갈아 잡는다(엇비슷) → 토막에 spot 길이 실리고 그 자리가 (60,60) 언저리.
   ② 600초 A 가 (40,40)에서 C 저글링 여덟을 일방으로 잡는다 → spot 없음(A 화면). */
{
  let t9 = 230000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 16, 16, 0); mk(1, "Hatchery", true, 110, 110, 0);
  const am = mk(0, "Marine", false, 16, 16, 200); const ch = mk(1, "Marine", false, 110, 110, 200);
  for (let i = 0; i < 6; i += 1) {
    const tA = 300 + i * 2; const tC = 301 + i * 2;
    const m = mk(0, "Marine", false, 16, 16, 200, { died: tC, end: "atk", endX: 59 + (i % 2), endY: 60 }); kills.push([tC, 1, ch.tag, m.tag]);
    const h = mk(1, "Marine", false, 110, 110, 200, { died: tA, end: "atk", endX: 61, endY: 60 + (i % 2) }); kills.push([tA, 0, am.tag, h.tag]);
  }
  for (let i = 0; i < 8; i += 1) { const t = 600 + i * 1.5; const z = mk(1, "Zergling", false, 110, 110, 500, { died: t, end: "atk", endX: 40, endY: 40 }); kills.push([t, 0, am.tag, z.tag]); }
  const w = { players: [["A", "테란", 1], ["C", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 900, order: ["A", "C"], teamOf: { A: 1, C: 2 } });
  const even = plan.filter((s) => !s.cyc && s.at > 290 && s.at < 320);
  const one = plan.filter((s) => !s.cyc && s.at > 590 && s.at < 620);
  const sp = even.find((s) => s.spot)?.spot;
  const mid = sp ? sp[Math.floor(sp.length / 2)] : null;
  console.log(`\n교전 자리: 엇비슷 ${even.map((s) => `${s.at.toFixed(1)} ${s.raw}${s.spot ? ` spot ${s.spot.length}점` : ""} ${capTxt(s)}`).join(" · ")} | 일방 ${one.map((s) => `${s.at.toFixed(1)} ${s.raw}${s.spot ? " spot" : ""}`).join(" · ")}`);
  for (const [name, pass] of [
    ["엇비슷한 맞대결은 교전 자리를 따라간다(spot)", !!sp && !!mid && Math.hypot(mid[1] - 60, mid[2] - 60) < 3],
    ["일방적인 싸움은 그 사람 화면(spot 없음)", one.length > 0 && one.every((s) => !s.spot) && one[0].raw === "A"],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㊴ 셋 이상 싸우면 교전 자리 · 자리 길은 가까우면 끌고 멀면 건너뛴다 · 끼어든 장면은 시작이 안 잘린다(2026-10-12, 요청: "3인 이상 교전 시 정말 활약도 차이가 나지
   않는 이상 장소 중계로 · 장소는 부드럽게 중요 장소를 드래그하듯 이동 — 가까운 경우만!" · 지적: "아직도 이벤트 시작 부분이 잘린 채 나오는 게 있어") —
   ① 2:2(A·B vs C·D) 300초~ (60,60)→(66,60)→(79,68): A 가 1.5배 더 잡아도 spot · 가까운 옮김(6타일)은 초당 4타일 안 · 먼 옮김(14타일 넘게 — 장면은 20타일 안이라 그 사이)은 한 번에.
   ② 700초~ A 가 (30,30)에서 C 마린을 잡고 710초부터 건물을 깨는 동안 712초에 B 가 (100,30)에서 D 울트라 여섯을 잡는다(무게 두 배 넘음) → B 토막이 겨눔 − 3초(≤ 709.5)에 선다. */
{
  let t9 = 240000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 10, 10, 0); mk(1, "Command Center", true, 10, 118, 0); mk(2, "Hatchery", true, 118, 10, 0); mk(3, "Hatchery", true, 118, 118, 0);
  const kil = [0, 1, 2, 3].map((o) => mk(o, "Marine", false, 10, 10, 200));
  const at = (t) => (t < 306 ? [60, 60] : t < 312 ? [66, 60] : [79, 68]);
  /* A 셋에 B·C·D 둘씩 — 넷이 다 몫이 있다(A 가 둘째의 1.5배). */
  const who = [0, 0, 0, 1, 1, 2, 2, 3, 3];
  for (let i = 0; i < 18; i += 1) {
    const t = 300 + i; const k = who[i % who.length]; const v = (k + 2) % 4;
    const [x, y] = at(t);
    const m = mk(v, "Marine", false, 10, 10, 200, { died: t, end: "atk", endX: x, endY: y }); kills.push([t, k, kil[k].tag, m.tag]);
  }
  for (let i = 0; i < 4; i += 1) { const t = 700 + i * 2; const m = mk(2, "Marine", false, 118, 10, 600, { died: t, end: "atk", endX: 30, endY: 30 }); kills.push([t, 0, kil[0].tag, m.tag]); }
  /* 둘째 창(710~)은 글귀가 다르다(건물 파괴) — 앞 장면이 뒤 창 토막을 미리 세워 둔다(옛 길은 이 토막 때문에 B 의 첫 창이 버려졌다). */
  for (let i = 0; i < 4; i += 1) { const t = 710 + i * 3; const b = mk(2, i % 2 ? "Spawning Pool" : "Evolution Chamber", true, 30 + i, 30, 600, { died: t, end: "atk", endX: 30 + i, endY: 30 }); kills.push([t, 0, kil[0].tag, b.tag]); }
  for (let i = 0; i < 6; i += 1) { const t = 712 + i; const u = mk(3, "Ultralisk", false, 118, 118, 600, { died: t, end: "atk", endX: 100, endY: 30 }); kills.push([t, 1, kil[1].tag, u.tag]); }
  const w = { players: [["A", "테란", 1], ["B", "테란", 1], ["C", "저그", 2], ["D", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 900, order: ["A", "C", "B", "D"], teamOf: { A: 1, B: 1, C: 2, D: 2 } });
  const four = plan.filter((s) => !s.cyc && s.at > 290 && s.at < 330);
  const sp = four.find((s) => s.spot)?.spot ?? [];
  const steps = sp.slice(1).map((p, i) => Math.hypot(p[1] - sp[i][1], p[2] - sp[i][2]));
  const glide = steps.filter((d) => d > 0.01 && d <= 14);
  const jump = steps.some((d) => d > 14);
  const cut = plan.find((s) => s.raw === "B" && s.at > 690 && s.at < 730);
  console.log(`\n셋 이상·자리 길·끼어들기: ${four.map((s) => `${s.at.toFixed(1)} ${s.raw}${s.spot ? ` spot ${s.spot.length}점` : ""}`).join(" · ")} | 걸음 ${steps.map((d) => d.toFixed(1)).join(",")} | B ${cut ? cut.at.toFixed(1) : "-"}`);
  for (const [name, pass] of [
    ["넷이 싸우면 1.5배 앞서도 교전 자리(spot)", sp.length > 0],
    ["가까운 옮김은 초당 4타일 안으로 끈다", glide.length > 0 && glide.every((d) => d <= 4.01)],
    ["먼 옮김은 한 번에 건너뛴다", jump],
    ["끼어든 장면은 겨눔 3초 앞에 선다(시작이 안 잘림)", !!cut && cut.at <= 709.5],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㊵ 교전 자리 길은 스캔·리콜·나이더스 도착에 들른다(2026-10-12, 요청: "위치 중계 시 리콜이나 커널 사용 시 이동한 곳으로 살짝 미리 가서 이동하는 모습 · 스캔 사용 시에도
   스캔한 곳 보여 주기") — ① ㊴ 의 넷 싸움(300~317 · (60,60)→(79,68))에 A 의 스캔(304 · (100,100))과 C 의 리콜 도착(311 · (40,90) · opts.moves)을 얹는다:
   길은 303.7~307 스캔 자리 · 309.78~310.58 리콜 시전 자리(70,30) · 310.58~314 도착 자리 · 그 사이·뒤는 교전 자리. 싸움에 안 든 사람(E)의 스캔(315)은 안 들른다.
   ② castMoves9 — 합성 자취: 나이더스 둘((20,20)·(90,90)) 사이를 뛴 저글링 셋(400~401.5) → 한 번의 이동(at 400 · to 401.5 · 출구 자리) · 리콜(500 · 표적 (50,50) → (70,20)). */
{
  let t9 = 250000;
  const L = []; const kills = [];
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 10, 10, 0); mk(1, "Command Center", true, 10, 118, 0); mk(2, "Hatchery", true, 118, 10, 0); mk(3, "Hatchery", true, 118, 118, 0); mk(4, "Command Center", true, 64, 120, 0);
  const kil = [0, 1, 2, 3].map((o) => mk(o, "Marine", false, 10, 10, 200));
  const at = (t) => (t < 306 ? [60, 60] : t < 312 ? [66, 60] : [79, 68]);
  const who = [0, 0, 0, 1, 1, 2, 2, 3, 3];
  for (let i = 0; i < 18; i += 1) {
    const t = 300 + i; const k = who[i % who.length]; const v = (k + 2) % 4;
    const [x, y] = at(t);
    const m = mk(v, "Marine", false, 10, 10, 200, { died: t, end: "atk", endX: x, endY: y }); kills.push([t, k, kil[k].tag, m.tag]);
  }
  const w = { players: [["A", "테란", 1], ["B", "테란", 1], ["C", "프로토스", 2], ["D", "저그", 2], ["E", "테란", 1]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [[304, 100, 100, "Scanner Sweep", 0], [315, 20, 110, "Scanner Sweep", 4]], pings: [], resFields: [], kills, sels: [], builds: [] };
  const plan = castPlan9(w, { total: 900, order: ["A", "C", "B", "D", "E"], teamOf: { A: 1, B: 1, C: 2, D: 2, E: 1 }, moves: [{ at: 311, raw: "C", x: 40, y: 90, kind: "recall", cast: 310.08, fx: 70, fy: 30, ax: 45, ay: 88 }] });
  const sp = plan.find((s) => !s.cyc && s.spot && s.at > 290 && s.at < 330)?.spot ?? [];
  const pos = (t) => {
    if (sp.length === 0) return [NaN, NaN];
    if (t <= sp[0][0]) return [sp[0][1], sp[0][2]];
    for (let i = 1; i < sp.length; i += 1) if (t <= sp[i][0]) { const [a0, ax, ay] = sp[i - 1]; const [a1, bx, by] = sp[i]; const u = a1 > a0 ? (t - a0) / (a1 - a0) : 1; return [ax + (bx - ax) * u, ay + (by - ay) * u]; }
    return [sp[sp.length - 1][1], sp[sp.length - 1][2]];
  };
  const near = (t, x, y) => { const [px, py] = pos(t); return Math.hypot(px - x, py - y) < 0.5; };
  const far = (t, x, y) => { const [px, py] = pos(t); return Math.hypot(px - x, py - y) > 10; };
  /* ② 합성 자취 — kt/kxy(픽셀)/kst/types 만 채운다. */
  const trk = (tag, owner, kind, keys, type = 37) => ({ tag, owner, kind, born: keys[0][0], died: null, own: [],
    kt: Float32Array.from(keys.map((k) => k[0])), kxy: Int16Array.from(keys.flatMap((k) => [k[1] * 32, k[2] * 32])), kh: new Uint8Array(keys.length),
    kst: Uint8Array.from(keys.map((k) => k[3] ?? 1)), done: new Uint8Array(keys.length).fill(1), types: new Uint16Array(keys.length).fill(type) });
  const tracks = [
    trk(1, 3, "Nydus Canal", [[100, 20, 20, 0]], 134), trk(2, 3, "Nydus Canal", [[100, 90, 90, 0]], 134),
    ...[0, 1, 2].map((i) => trk(10 + i, 3, "Zergling", [[300, 30, 30], [399 + i * 0.5, 21, 21], [400 + i * 0.75, 91, 91, 0]])),
    trk(20, 3, "Zergling", [[300, 60, 60], [450, 62, 62]]),   // 그냥 걷는 몸 — 이동이 아니다
    ...[0, 1].map((i) => trk(30 + i, 2, "Zealot", [[300, 50 + i, 50, 0], [500.9, 70 + i, 20, 0]], 65)),
    trk(40, 2, "Arbiter", [[300, 68, 22, 0]], 71), trk(41, 2, "Arbiter", [[300, 10, 120, 0]], 71),   // 가까운 아비터가 시전자
  ];
  const mv = castMoves9(tracks, { players: w.players, casts: [[500, 50, 50, "Recall", 2]] });
  const ny = mv.find((m) => m.kind === "nydus");
  const rc = mv.find((m) => m.kind === "recall");
  console.log(`\n들를 자리: 길 ${sp.length}점 · 304.5 ${pos(304.5).map((v) => v.toFixed(1))} · 308.5 ${pos(308.5).map((v) => v.toFixed(1))} · 310.5 ${pos(310.5).map((v) => v.toFixed(1))} · 316 ${pos(316).map((v) => v.toFixed(1))} | 이동 ${mv.map((m) => `${m.kind} ${m.at.toFixed(2)}~${(m.to ?? m.at).toFixed(2)} (${m.x.toFixed(1)},${m.y.toFixed(1)}) ${m.raw}`).join(" · ")}`);
  for (const [name, pass] of [
    ["스캔(304) — 304.5 에 스캔 자리(100,100)", near(304.5, 100, 100)],
    ["스캔 3초 뒤(308.5)엔 교전 자리로 돌아온다", far(308.5, 100, 100) && far(308.5, 40, 90)],
    ["리콜 ① 아비터(45,88) — 309", near(309, 45, 88)],
    ["리콜 ② 시전 자리(70,30) — 310.2", near(310.2, 70, 30)],
    ["리콜 ③ 도착 자리(40,90) — 311 · 그 사이 교전 자리에 안 들름", near(311, 40, 90) && sp.every((p) => !(p[0] > 308.6 && p[0] < 314) || [[45, 88], [70, 30], [40, 90]].some(([x, y]) => Math.hypot(p[1] - x, p[2] - y) < 0.5))],
    ["싸움에 안 든 사람의 스캔(315)은 안 들른다", far(316, 20, 110)],
    ["나이더스 — 셋이 한 번의 이동 · 출구 자리 · 첫·끝 도착", !!ny && mv.filter((m) => m.kind === "nydus").length === 1 && Math.abs(ny.at - 400) < 0.01 && Math.abs((ny.to ?? 0) - 401.5) < 0.01 && Math.hypot(ny.x - 90, ny.y - 90) < 0.5 && ny.raw === "D"],
    ["리콜 — 시전 + 0.92초 · 도착 자리 (70.5,20)", !!rc && Math.abs(rc.at - 500.92) < 0.01 && Math.hypot(rc.x - 70.5, rc.y - 20) < 0.5 && rc.raw === "C"],
    ["리콜 — 아비터는 도착 자리에 가까운 것(68,22)", !!rc && rc.ax === 68 && rc.ay === 22],
    ["나이더스 — 입구 자리(20,20)", !!ny && ny.fx === 20 && ny.fy === 20],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}

/* ── ㊶ 핵은 탄두로 센다 · 조준 끝 3초부터 투하·폭발까지(2026-10-12, 요청: "핵 — 조준 뒷부분 좀 보이고 이어서 투하부터 쭉") — 1v1 · A 의 탄두가 280초에 나 500초에 (90,40)에서 죽는다
   (보이는 착탄 498.9 · 낙하 494.9 · 장면은 그 3초 앞 491.9) · 볼 자리 구간 [491.9, 502.9] (90,40) hold. 리콜 차례(아비터 → 시전 자리 → 도착)·나이더스(입구 → 출구)도 구간으로 본다. */
{
  const L = [];
  let t9 = 260000;
  const mk = (o, kind, bld, x, y, born, ex = {}) => { const e = { tag: (t9 += 1), owner: o, kind, born, bornX: x, bornY: y, died: null, end: "", bld,
    sites: bld ? [[born, x - 1, y - 1]] : [], doneAt: born, lifts: [], cloaks: [], sieges: [], orders: [], ...ex }; L.push(e); return e; };
  mk(0, "Command Center", true, 10, 10, 0); mk(1, "Hatchery", true, 118, 118, 0);
  mk(0, "Nuclear Missile", false, 12, 12, 280, { died: 500, end: "self", endX: 90, endY: 40 });
  const w = { players: [["A", "테란", 1], ["B", "저그", 2]].map(([name, race, team], o) => ({ owner: o, name, race, color: "#fff", team })),
    lives: L, ups: [], casts: [], pings: [], resFields: [], kills: [], sels: [], builds: [] };
  const plan = castPlan9(w, { total: 900, order: ["A", "B"], teamOf: { A: 1, B: 2 } });
  const nk = plan.find((s) => !s.cyc && s.raw === "A" && s.at > 480 && s.at < 510);
  const fo = castFocus9(w, [{ at: 311, to: 312, raw: "B", x: 40, y: 90, kind: "nydus", fx: 20, fy: 20 },
    { at: 311, raw: "A", x: 40, y: 90, kind: "recall", cast: 310.08, fx: 70, fy: 30, ax: 45, ay: 88 }]);
  const nf = fo.find((f) => f.kind === "nuke");
  const rf = fo.find((f) => f.kind === "recall");
  const yf = fo.find((f) => f.kind === "nydus");
  const legs = (f) => (f ? f.legs.map((l) => `[${l.t0.toFixed(2)},${l.t1.toFixed(2)}](${l.x},${l.y})${l.hold ? "" : "~"}`).join("→") : "-");
  console.log(`\n핵·볼 자리 차례: 핵 토막 ${nk ? `${nk.at.toFixed(1)} "${capTxt(nk)}"` : "-"} | 핵 ${legs(nf)} | 리콜 ${legs(rf)} | 나이더스 ${legs(yf)}`);
  for (const [name, pass] of [
    ["핵 장면은 낙하 5초 앞(489.9 — 조준 끝)에 선다", !!nk && Math.abs(nk.at - 489.9) < 0.3],
    ["핵 자막은 '핵 투하'", !!nk && capTxt(nk).includes("핵 투하")],
    ["핵 볼 자리 [489.9, 502.9] (90,40) hold", !!nf && nf.legs.length === 1 && Math.abs(nf.legs[0].t0 - 489.9) < 0.01 && Math.abs(nf.legs[0].t1 - 502.9) < 0.01 && nf.legs[0].x === 90 && nf.legs[0].hold],
    ["리콜 차례 아비터 → 시전 자리 → 도착(이어짐)", !!rf && rf.legs.length === 3 && rf.legs[0].x === 45 && rf.legs[1].x === 70 && rf.legs[2].x === 40 && rf.legs[0].t1 === rf.legs[1].t0 && rf.legs[1].t1 === rf.legs[2].t0],
    ["나이더스 차례 입구 → 출구(끝 + 2초까지)", !!yf && yf.legs.length === 2 && yf.legs[0].x === 20 && yf.legs[1].x === 40 && Math.abs(yf.legs[1].t1 - 314) < 0.01],
  ]) console.log(`  ${pass ? "✔" : "✘"} ${name}`);
}
