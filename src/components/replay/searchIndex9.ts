/* ★★ **검색 색인**(2026-10-12 재생기 검색 → 2026-10-20 재생기 밖으로, 요청: "모든 색인은 주인, 타겟(-에게 · 있으면), 대상(전술/유닛/스킬/건물 등), 행위, 추가속성(활약 등) ·
   그럼 모든 색인은 유저별로 사용 가능 · 전술과 유저 색인으로 나눈 게 이상해" → "전부 재생기 함수(api 제공)" · "같은 사람의 같은 사건도 합치지 말고 시간별로 저장 · 시간 색인 나중에 제공 예정")
   ─ 재생기 안 검색(ReplayMotionPlayer searchIndex9)이 쓰던 빌더를 **그대로** 이리 옮겼다. 재생기는 list·terms·facets·people 을 쓰고(이동·자동 완성),
   앱(사이트 게임 검색)은 같은 빌더가 함께 내는 **rows**(사건 한 건 = 한 줄 · 시각 · 주인 · 타겟 · 대상 종류 · 대상 · 행위 · 속성)를 운영자 재분석 때 서버에 담는다(gameIndexOf9).
   그래서 재생기에서 찾히는 것과 게임 목록에서 찾히는 것이 한 함수에서 나온다.

   찾는 거리 — 참값 한 벌에서 사람마다: 첫 생산("첫 마린 생산" · 애벌레·알·딸림 빼고) · 첫 건설 · N번째 본진 · 연구 완료("스톰 개발 완료") · 마법 사용 · 나이더스 사용 · 핵 장전/투하 ·
   시즈 모드/해제 · 클로킹 · 건물 띄움 · 유닛 활약(몰아 잡기) · **편성표 자막 전부**(장면 1등 자막 · 사람마다 빌드·전술 이정표 · 토막 자막 — 전술 낱말 · 공격/견제의 주인·타겟 · 활약). */
import { castCapFacets9, castCapRoles9, NUKE_SHOW_PRE9, type CapPart9, type CastFocus9, type CastSeg9, type CastPlan9 } from "./cast9";
import { tacticWordsOfText9 } from "./tactics9";
import { BUILDING_KO, TECH_KO, UNIT_KO } from "../../utils/replayNames";
import { researchKo } from "../../utils/replayTechNames";
import { koEul9, koGa9, koWa9 } from "../../utils/koJosa";
import type { TruthLife, TruthWorld } from "../../utils/truthLives";

/** 검색 비교용 — 소문자 · 빈칸 걷음. */
export const searchNorm9 = (s9: string): string => s9.toLowerCase().replace(/\s+/g, "");
/** 검색에서 뺄 몸 — 애벌레·알·고치·딸림(스캐럽·요격기·마인)은 '생산'이 아니다. */
const SEARCH_SKIP9 = new Set(["Larva", "Egg", "Lurker Egg", "Cocoon", "Scarab", "Interceptor", "Vulture Spider Mine", "Spider Mine", "Nuclear Missile"]);
/** 몸 죽음(사망·처치·파괴) 줄을 색인에 싣나 — 걷었다(2026-10-13 · 아래 ★ 첫 생산만). */
const SEARCH_DEATHS9 = false;
/** 진행 중 글귀(장면 자막의 "○○ 연구 중" 따위)는 결과가 아니다 — 업그레이드·연구는 완료만(2026-10-13, 요청: "업그레이드도 완료만 나오게 · 연구 같은 거"). */
const SEARCH_ONGOING9 = /연구 중|진행 중|올리는 중/;
/* ★ 찾는 거리를 넓힌다(2026-10-12, 요청: "자막에 나온 내용이 아니더라도 검색되면 좋겠는데" · 지적: "분명 핵을 쓴 판인데 핵 쳐도 안 나와") —
   ① 편성표 밖의 글귀(plan.search — 잔 장면·밀린 장면까지 모든 장면의 자막 · 사람마다 빌드 이정표 · cast9 CastSearch9)
   ② 시즈 모드/해제 · 클로킹(레이스·고스트) · 건물 띄움
   ③ **핵** — 덤퍼의 시전 기록에는 핵이 한 번도 안 실린다(재생기 핵 연출 ★ — 시전 훅이 핵 길을 안 지난다). 그래서 핵탄두 개체("Nuclear Missile")의 자취로 짓는다:
      태어남 = "핵 장전" · 움직여 죽음 = "핵 투하"(사일로째 부서진 탄두는 제자리라 거른다). 옛 색인은 탄두를 딸림으로 빼(SEARCH_SKIP9) 핵이 통째로 없었다.
   자동 완성(재생기 searchSug9)이 쓰는 낱말 표(terms)도 여기서 같이 모은다 — **그 경기에 나온 것만**(사람 · 유닛 · 건물 · 기술 · 마법 · 전술 낱말). */
const SEARCH_TACTIC9 = ["교전", "공격", "방어", "헬프", "견제", "드랍", "폭탄드랍", "포토러시", "성큰러시", "캐논러시", "저글링러시", "러시", "반파", "대파", "궤멸", "파괴",
  "사망", "처치", "빠른", "늘리기", "선스포닝풀", "선해처리", "선포지", "더블넥서스", "선커맨드", "더블커맨드", "투게이트", "쓰리게이트", "투배럭", "쓰리배럭", "투팩", "테크",
  "입구 막음", "이사", "인구 막힘", "gg 선언", "노엘 외침", "핵 투하", "핵 장전", "시즈 모드", "클로킹", "띄움", "사냥", "전원"];
/* ★★ **추천어 세분**(2026-10-16, 요청: "키워드 추천 목록에 세분화로 — 리콜이면 리콜 개발/리콜 사용 · 질럿이면 질럿 생산/질럿 활약 · 공격함/공격당함 · 견제함/견제당함 ·
   스톰 개발/스톰 사용/스톰 활약 · 나이더스 건설/나이더스 사용") — 색인 줄마다 제가 무엇인지(세분 낱말 fx)를 단다: 첫 생산 "X 생산" · 첫 건설·N번째 본진 "X 건설" · 연구 "X 개발" ·
   마법·나이더스 "X 사용" · 마법 활약 자막("스톰으로 7킬 · 방어해냄 · 돌파함 …")과 유닛의 몰아 잡기(SEARCH_ACT_KILLS9 기 · 틈 SEARCH_ACT_GAP9 초) "X 활약" ·
   장면 자막의 주어/목적어로 "A 공격함 · B 공격당함 · A 견제함 · B 견제당함"(사람 없는 "공격함"도). */
export const SEARCH_ROLES9 = ["공격함", "공격당함", "견제함", "견제당함"];
export const SEARCH_ACTS9 = ["생산", "건설", "개발", "사용", "활약", ...SEARCH_ROLES9];
const SEARCH_ACT_KILLS9 = 5;
const SEARCH_ACT_GAP9 = 12;
/** 잡은 몸 → 활약으로 칠 몸(딸림은 제 어미). */
const SEARCH_KILLER_AS9: Record<string, string> = { Interceptor: "Carrier", Scarab: "Reaver" };
/** 본진(자원 건물) 종류 — 핵이 누구 기지에 떨어졌나(재생기 TAG_HALL9 와 같은 다섯). */
const HALL_KINDS9 = new Set(["Command Center", "Nexus", "Hatchery", "Lair", "Hive"]);
/** 자막 사건 줄(아래 rows)의 덮는 끝을 모를 때(장면 끝 · 토막 끝이 없을 때) 그 시각부터 이만큼(초). */
const CAP_SPAN9 = 8;

/** 색인 한 줄 — 글귀·비교 글 · 장면 잡기 거리(자리 · 사람 · 장면 길 · 끝 · 재생기 searchFocus9 ★). */
export type SearchHit9 = { sec: number; label: string; x?: number; y?: number; raw?: string; spot?: [number, number, number][]; to?: number;
  /** 결과 때보다 이만큼(초) 앞에서 연다 — 없으면 재생기 SEARCH_LEAD9. 핵 투하는 조준 끝부터(cast9 NUKE_SHOW_PRE9). */
  pre?: number;
  /** 세분 낱말(위 ★ 세분 추천) — 이 줄이 맞는 "리콜 사용" · "정구 공격당함" 따위의 비교 글(searchNorm9). */
  fx?: string[];
  /** 장면 자막 줄인가(편성표 search · 토막 자막) — 같은 장면 안의 딴 줄(마법 사용 · 몰아 잡기)을 한 결과로 접는 자(재생기 searchHits9 ★ 중복). */
  cap?: boolean };
export type SearchFacet9 = { disp: string; term: string; act: string };

/** ★ **게임 색인 한 줄**(사건 한 건 · 합치지 않는다) — 사이트 게임 검색이 담는 꼴. 사람은 참값 이름(raw — 앱의 슬롯 rawName).
 *  kind: unit 유닛 · building 건물 · upgrade 연구·업그레이드 · skill 마법·핵 · tactic 전술(공격 · 견제 · 포토러시 · 몰래 배럭 …).
 *  term = 대상의 한글 이름(전술은 낱말 그대로) · key = 영문 원 이름(BW 종류·기술 이름 · 전술은 "") · act = 행위(생산 · 건설 · 개발 · 사용 · 활약 · 장전 · 투하 · 시즈 모드 ·
 *  시즈 해제 · 클로킹 · 띄움 · 전술은 "") · attr = 덧붙임(본진 몇 번째 · 업그레이드 단계 · 활약 킬 수 · 없으면 "").
 *  공격·견제는 term "공격"/"견제"에 주인(owner)·타겟(target)을 단다 — "A 공격함" = owner A · "B 공격당함" = target B. */
export type GameIndexKind9 = "unit" | "building" | "upgrade" | "skill" | "tactic";
export type GameIndexRow9 = { sec: number; owner: string | null; target: string | null; kind: GameIndexKind9; term: string; key: string; act: string; attr: string };
type RowPart9 = Omit<GameIndexRow9, "sec" | "owner" | "target"> & { owner?: string | null; target?: string | null };

export type SearchIndex9 = { list: (SearchHit9 & { hay: string })[]; terms: Map<string, string>; facets: Map<string, SearchFacet9>; people: Set<string>; rows: GameIndexRow9[] };
export type SearchIndexIn9 = {
  world: TruthWorld;
  /** 편성표 — 재생기의 planAll9(사건 중계 · plan.search 포함). */
  plan: CastPlan9 | readonly CastSeg9[];
  /** 볼 자리의 차례(cast9 castFocus9 — 리콜 · 나이더스). */
  focus: readonly CastFocus9[];
  /** 로스터 — 참값 이름(key) → 표시 이름(name). 여기 없는 사람(관전자 등)은 색인에서 빠진다. */
  bases: readonly { key: string; name: string }[];
};

const capText9 = (caps: readonly CapPart9[]): string => caps.map((c9) => (c9.raw !== undefined ? " " : c9.text)).join("");

export function buildSearchIndex9({ world: entData, plan: planAll9, focus: castFocusV9, bases }: SearchIndexIn9): SearchIndex9 {
  const terms9 = new Map<string, string>();
  const facets9 = new Map<string, SearchFacet9>();
  const people9 = new Set<string>();
  const nameOf9 = new Map(bases.map((b9) => [b9.key, b9.name] as const));
  const rawOf9 = new Map(entData.players.map((pl9) => [pl9.owner, pl9.name] as const));
  const out9: (SearchHit9 & { hay: string })[] = [];
  const rows9: GameIndexRow9[] = [];
  const term9 = (t9: string, tag9: string): void => { if (t9 && !terms9.has(t9)) terms9.set(t9, tag9); };
  for (const b9 of bases) term9(b9.name, "사람");   // 사람은 몸 기록이 없어도(자막에만 나와도) 든다
  /** 세분 낱말 하나를 올리고 비교 글을 돌려준다 — term 이 "" 이면 사람 없는 꼴("공격함"). */
  const fx9 = (term9: string, act9: string): string => {
    const disp9 = term9 ? `${term9} ${act9}` : act9;
    const k9 = searchNorm9(disp9);
    if (!facets9.has(k9)) facets9.set(k9, { disp: disp9, term: term9, act: act9 });
    return k9;
  };
  const row9 = (sec9: number, owner9: string | null, p9: RowPart9): void => {
    const o9 = p9.owner !== undefined ? p9.owner : owner9;
    if (o9 !== null && !nameOf9.has(o9)) return;
    rows9.push({ sec: Math.round(sec9 * 10) / 10, owner: o9, target: p9.target ?? null, kind: p9.kind, term: p9.term, key: p9.key, act: p9.act, attr: p9.attr });
  };
  const add9 = (sec9: number, owner9: number | null, label9: string, extra9: string,
    at9: Partial<SearchHit9> & { lead?: string; facet?: [string, string][]; row?: RowPart9 } = {}): void => {
    let who9 = "";
    let raw9: string | undefined;
    if (owner9 !== null) {
      raw9 = rawOf9.get(owner9);
      if (!raw9 || !nameOf9.has(raw9)) return;   // 관전자·임자 모름은 뺀다
      who9 = nameOf9.get(raw9)!;
      term9(who9, "사람");
    }
    /* lead — 목적어 사람(핵이 떨어진 기지의 임자): "A가 B 기지에 핵 투하". */
    const lead9 = at9.lead;
    const lab9 = who9 ? (lead9 ? `${who9}${koGa9(who9)} ${lead9} ${label9}` : `${who9} ${label9}`) : label9;
    const { lead: _lead9, facet: fc9, row: rw9, ...rest9 } = at9;
    const fx0_9 = fc9 && fc9.length > 0 ? [...new Set(fc9.map(([t9, a9]) => fx9(t9, a9)))] : undefined;
    out9.push({ raw: raw9, ...rest9, ...(fx0_9 ? { fx: fx0_9 } : {}), sec: sec9, label: lab9, hay: searchNorm9(`${lab9} ${extra9}`) });
    if (rw9) row9(sec9, raw9 ?? rest9.raw ?? null, rw9);
  };
  const tagLife9 = new Map(entData.lives.map((e9) => [e9.tag, e9] as const));
  /* ★ 글귀는 **묘사**다(2026-10-12, 요청: "자막도 넣어 주면 좋을 듯 — 자막이라기보다 묘사 · A가 B 기지에 핵 투하 · A 3해처리 건설") — 결과로 가면 이 글귀가 화면 자막이 된다
     (재생기 searchSeg9). 처치는 누가 잡았나(kills · 판 11부터) · 본진은 그 사람의 몇 번째인가 · 핵은 누구 기지에 떨어졌나를 붙인다. */
  const whoOf9 = (o9: number): string | null => { const r9 = rawOf9.get(o9); return r9 && nameOf9.has(r9) ? nameOf9.get(r9)! : null; };
  const ga9 = (nm9: string): string => `${nm9}${koGa9(nm9)}`;
  const killerOf9 = new Map<number, number>();
  for (const [, ko9, , vt9] of entData.kills ?? []) killerOf9.set(vt9, ko9);
  const HALL_SHORT9: Record<string, string> = { Hatchery: "해처리", Nexus: "넥서스", "Command Center": "커맨드" };
  const hallN9 = new Map<number, number>();   // 태그 → 그 사람의 몇 번째 본진인가(시작 본진 = 1)
  {
    const seen9 = new Map<number, number>();
    for (const e9 of [...entData.lives].filter((l9) => l9.bld && HALL_SHORT9[l9.kind]).sort((a9, b9) => a9.born - b9.born)) {
      const n9 = (seen9.get(e9.owner) ?? 0) + 1;
      seen9.set(e9.owner, n9);
      hallN9.set(e9.tag, n9);
    }
  }
  /** 그 때 그 자리에서 가장 가까운 남의 본진의 임자(16타일 안) — 핵이 누구 기지에 떨어졌나. 표시 이름과 참값 이름을 함께. */
  const baseOwnerAt9 = (x9: number, y9: number, t9: number, not9: number): { name: string; raw: string } | null => {
    let best9: { d: number; o: number } | null = null;
    for (const e9 of entData.lives) {
      if (!e9.bld || !HALL_KINDS9.has(e9.kind) || e9.owner === not9 || e9.born > t9 || (e9.died !== null && e9.died <= t9)) continue;
      const d9 = Math.hypot(e9.bornX - x9, e9.bornY - y9);
      if (d9 <= 16 && (!best9 || d9 < best9.d)) best9 = { d: d9, o: e9.owner };
    }
    if (!best9) return null;
    const nm9 = whoOf9(best9.o);
    return nm9 ? { name: nm9, raw: rawOf9.get(best9.o)! } : null;
  };
  /** 그 사람의 그 종류를 이미 실었나(첫 생산·첫 건설만 · 아래 ★). 몸은 태어난 차례로 돈다. */
  const firstMade9 = new Set<string>();
  for (const e9 of [...entData.lives].sort((a9, b9) => a9.born - b9.born)) {
    if (e9.kind === "Nuclear Missile") {
      if (e9.born > 1) {
        add9(e9.born, e9.owner, "핵 장전", "nuke 핵미사일", { x: e9.bornX, y: e9.bornY, row: { kind: "skill", term: "핵", key: "Nuclear Strike", act: "장전", attr: "" } });
        term9("핵", "전술");
      }
      if (e9.died !== null && e9.endX !== undefined && e9.endY !== undefined && Math.hypot(e9.endX - e9.bornX, e9.endY - e9.bornY) > 1) {
        const foe9 = baseOwnerAt9(e9.endX, e9.endY, e9.died, e9.owner);
        /* 조준 끝부터(2026-10-12, 지적: "핵이 아직도 조준 시간을 거의 안 보여 줌" — 옛 결과는 죽은 때 − 2초에 열려 조준은 물론 낙하도 대부분 지나 있었다). */
        add9(e9.died, e9.owner, foe9 ? `기지에 핵 투하` : "핵 투하", `nuke 핵미사일 착탄 ${foe9?.name ?? ""}`, { x: e9.endX, y: e9.endY, to: e9.died + 4, pre: NUKE_SHOW_PRE9, ...(foe9 ? { lead: foe9.name } : {}),
          row: { kind: "skill", term: "핵", key: "Nuclear Strike", act: "투하", attr: "", target: foe9?.raw ?? null } });
      }
      continue;
    }
    if (SEARCH_SKIP9.has(e9.kind)) continue;
    const ko9 = (e9.bld ? BUILDING_KO[e9.kind] : UNIT_KO[e9.kind]) ?? e9.kind;
    const kind9: GameIndexKind9 = e9.bld ? "building" : "unit";
    if (whoOf9(e9.owner)) term9(ko9, e9.bld ? "건물" : "유닛");   // 시작부터 있던 몸(본진·일꾼)도 낱말 표에
    /* ★ **첫 생산·첫 건설만**(2026-10-13, 지적: "키워드 검색에 유닛이나 건물 생산이랑 죽는 게 나오니까 너무 결과가 많은 것 같은데") — 몸 하나하나의 생산·건설 줄을
       걷고 그 사람의 그 종류 **첫** 것만 싣는다(본진 2·3번째 건설은 이정표라 그대로). 죽음(사망·처치·파괴) 줄은 통째로 걷었다 — 기지 피해(반파·대파·파괴)는
       장면 자막 결과(아래 plan)로 그대로 나온다. 낱말 표(자동 완성)는 종전대로 다 든다. */
    if (e9.born > 1) {
      const hn9 = hallN9.get(e9.tag);
      const fk9 = `${e9.owner}|${e9.kind}`;
      if (hn9 && hn9 > 1) {
        add9(e9.born, e9.owner, `${hn9}${HALL_SHORT9[e9.kind]} 건설`, e9.kind, { x: e9.bornX, y: e9.bornY, facet: [[ko9, "건설"]],
          row: { kind: kind9, term: ko9, key: e9.kind, act: "건설", attr: String(hn9) } });
      } else if (!firstMade9.has(fk9)) {
        firstMade9.add(fk9);
        const act9 = e9.bld ? "건설" : "생산";
        add9(e9.born, e9.owner, `첫 ${ko9} ${act9}`, `${e9.kind} ${act9}`, { x: e9.bornX, y: e9.bornY, facet: [[ko9, act9]],
          row: { kind: kind9, term: ko9, key: e9.kind, act: act9, attr: "" } });
      }
      term9(ko9, e9.bld ? "건물" : "유닛");
    }
    if (SEARCH_DEATHS9 && e9.died !== null && e9.end !== "morph") {
      const kw9 = killerOf9.has(e9.tag) ? whoOf9(killerOf9.get(e9.tag)!) : null;
      const vw9 = whoOf9(e9.owner);
      if (kw9 && vw9 && kw9 !== vw9) add9(e9.died, null, `${ga9(kw9)} ${vw9} ${ko9} ${e9.bld ? "파괴" : "처치"}`, `${e9.kind} 잃음 죽음 사망 ${e9.bld ? "" : "처치"}`, { x: e9.endX ?? e9.bornX, y: e9.endY ?? e9.bornY, raw: rawOf9.get(e9.owner) });
      else add9(e9.died, e9.owner, `${ko9} ${e9.bld ? "파괴됨" : "사망"}`, `${e9.kind} 잃음 죽음 파괴`, { x: e9.endX ?? e9.bornX, y: e9.endY ?? e9.bornY });
    }
    for (const [ss9, on9] of e9.sieges) {   // 그때 자리는 몰라 그 사람 화면
      add9(ss9, e9.owner, `${ko9} 시즈 ${on9 ? "모드" : "해제"}`, "siege", { row: { kind: kind9, term: ko9, key: e9.kind, act: on9 ? "시즈 모드" : "시즈 해제", attr: "" } });
    }
    if (e9.kind === "Wraith" || e9.kind === "Ghost") for (const [cs9] of e9.cloaks) add9(cs9, e9.owner, `${ko9} 클로킹`, "cloak 은신", { row: { kind: kind9, term: ko9, key: e9.kind, act: "클로킹", attr: "" } });
    for (const ls9 of e9.lifts) add9(ls9, e9.owner, `${ko9} 띄움`, "lift", { x: e9.bornX, y: e9.bornY, row: { kind: kind9, term: ko9, key: e9.kind, act: "띄움", attr: "" } });
  }
  for (const [us9, un9, uo9, ut9] of entData.ups) {
    const lv9 = / (\d)$/.exec(un9)?.[1];
    const base9 = un9.replace(/ \d$/, "");
    const rko9 = researchKo(base9);
    const b9 = ut9 ? tagLife9.get(ut9) : undefined;   // 연구한 건물(판 7부터 · 0 이면 모름 → 그 사람 화면)
    add9(us9, uo9, `${rko9}${lv9 ? ` ${lv9}` : ""} 개발 완료`, `${un9} 연구 업그레이드`, { ...(b9 ? { x: b9.bornX, y: b9.bornY } : {}), facet: [[rko9, "개발"]],   // "스톰 완료" → "스톰 개발 완료"(2026-10-12 요청)
      row: { kind: "upgrade", term: rko9, key: base9, act: "개발", attr: lv9 ?? "" } });
    term9(rko9, "기술");
  }
  for (const [cs9, cx9, cy9, ct9, co9] of entData.casts) {
    const k9 = TECH_KO[ct9] ?? ct9;
    const w9 = whoOf9(co9);
    /* ★ 리콜은 **볼 자리의 차례**(cast9 castFocus9 — 아비터 → 시전 자리 → 도착)를 장면 길로 싣는다(2026-10-12, 지적: "리콜 사용이 아까 말한 거랑 다르게 나와 — 그냥 출발 지점만
       나오고 끝") — 옛 결과는 시전 자리 한 점이라 검색 장면이 거기 머물다 끝났다. 구간마다 [시작, 자리]·[끝, 자리] 키(사이는 곧장 건너뛴다) · 첫 구간 시작부터 연다. */
    const fo9 = ct9 === "Recall" ? castFocusV9.find((f9) => f9.kind === "recall" && f9.raw === rawOf9.get(co9) && Math.abs(f9.legs[0].t0 - (cs9 - 1.5)) < 0.6) : undefined;
    const sp9 = fo9 ? fo9.legs.flatMap((l9): [number, number, number][] => [[l9.t0, l9.x, l9.y], [l9.t1 - 0.01, l9.x, l9.y]]) : undefined;
    const rw9: RowPart9 = { kind: "skill", term: k9, key: ct9, act: "사용", attr: "" };
    if (w9) add9(cs9, null, `${ga9(w9)} ${k9} 사용`, `${ct9} ${w9}`, fo9 && sp9
      ? { raw: rawOf9.get(co9), spot: sp9, to: fo9.legs[fo9.legs.length - 1].t1, pre: cs9 - fo9.legs[0].t0, facet: [[k9, "사용"]], row: rw9 }
      : { x: cx9, y: cy9, raw: rawOf9.get(co9), facet: [[k9, "사용"]], row: rw9 });
    term9(k9, "마법");
  }
  /* 나이더스 사용(★ 세분 추천) — 볼 자리의 차례(castFocus9 nydus: 입구 → 출구)를 장면 길로. 결과 때는 출구 구간의 머리(첫 몸이 나온 때). */
  for (const f9 of castFocusV9) {
    if (f9.kind !== "nydus" || f9.legs.length === 0) continue;
    const w9 = nameOf9.get(f9.raw);
    if (!w9) continue;
    const lg9 = f9.legs[f9.legs.length - 1];
    const at9 = lg9.t0 + 0.1;
    add9(at9, null, `${ga9(w9)} 나이더스 사용`, `Nydus Canal ${w9}`, { raw: f9.raw, spot: f9.legs.flatMap((l9): [number, number, number][] => [[l9.t0, l9.x, l9.y], [l9.t1 - 0.01, l9.x, l9.y]]),
      to: lg9.t1, pre: at9 - f9.legs[0].t0, facet: [["나이더스", "사용"]], row: { kind: "building", term: "나이더스", key: "Nydus Canal", act: "사용", attr: "" } });
    term9("나이더스", "건물");
  }
  /* 유닛 활약(★ 세분 추천) — 한 사람의 한 종류가 몰아 잡은 것(처치 절 · 판 11부터): 앞 처치에서 SEARCH_ACT_GAP9 초 안이면 한 무더기 · SEARCH_ACT_KILLS9 기 넘으면 "A 질럿 6킬".
     자리는 잡힌 몸들이 죽은 자리의 가운데. 건물(캐논·성큰)은 안 친다 · 딸림은 제 어미(인터셉터 → 캐리어 · 스캐럽 → 리버). */
  {
    const byTag9 = new Map<number, TruthLife[]>();
    for (const e9 of entData.lives) { const a9 = byTag9.get(e9.tag); if (a9) a9.push(e9); else byTag9.set(e9.tag, [e9]); }
    const lifeAt9 = (tg9: number, t9: number): TruthLife | undefined => byTag9.get(tg9)?.find((l9) => l9.born <= t9 + 0.5 && (l9.died === null || l9.died >= t9 - 0.5));
    type Burst9 = { o: number; kind: string; t0: number; t1: number; n: number; sx: number; sy: number; m: number };
    const open9 = new Map<string, Burst9>();
    const flush9 = (b9: Burst9): void => {
      if (b9.n < SEARCH_ACT_KILLS9) return;
      const ko9 = UNIT_KO[b9.kind] ?? b9.kind;
      add9(b9.t0, b9.o, `${ko9} ${b9.n}킬`, `${b9.kind} 활약 킬`, { ...(b9.m > 0 ? { x: b9.sx / b9.m, y: b9.sy / b9.m } : {}), to: b9.t1 + 2, facet: [[ko9, "활약"]],
        row: { kind: "unit", term: ko9, key: b9.kind, act: "활약", attr: String(b9.n) } });
    };
    for (const [ks9, ko9, kt9, vt9] of [...(entData.kills ?? [])].sort((a9, b9) => a9[0] - b9[0])) {
      if (!kt9) continue;
      const kl9 = lifeAt9(kt9, ks9);
      if (!kl9 || kl9.bld) continue;
      const kind9 = SEARCH_KILLER_AS9[kl9.kind] ?? kl9.kind;
      if (SEARCH_SKIP9.has(kind9)) continue;
      const vl9 = lifeAt9(vt9, ks9);
      const vx9 = vl9 ? vl9.endX ?? vl9.bornX : undefined;
      const vy9 = vl9 ? vl9.endY ?? vl9.bornY : undefined;
      const key9 = `${ko9}|${kind9}`;
      const cur9 = open9.get(key9);
      if (cur9 && ks9 - cur9.t1 <= SEARCH_ACT_GAP9) {
        cur9.t1 = ks9; cur9.n += 1;
        if (vx9 !== undefined && vy9 !== undefined) { cur9.sx += vx9; cur9.sy += vy9; cur9.m += 1; }
        continue;
      }
      if (cur9) flush9(cur9);
      open9.set(key9, { o: ko9, kind: kind9, t0: ks9, t1: ks9, n: 1, sx: vx9 ?? 0, sy: vy9 ?? 0, m: vx9 !== undefined && vy9 !== undefined ? 1 : 0 });
    }
    for (const b9 of open9.values()) flush9(b9);
  }
  const capName9 = (r9: string): string => nameOf9.get(r9) ?? r9;
  const capParticle9 = (nm9: string, p9: CapPart9["p"]): string =>
    (p9 === "ga" ? koGa9(nm9) : p9 === "eul" ? koEul9(nm9) : p9 === "wa" ? koWa9(nm9) : p9 === "ui" ? "의" : "");
  const capTxt9 = (caps9: CapPart9[]): string => caps9.map((c9) => (c9.raw !== undefined ? capName9(c9.raw) + capParticle9(capName9(c9.raw), c9.p) : c9.text)).join("").trim();
  /* 장면 글귀 — 편성표 밖 거리(search)를 먼저 싣는다: 장면 길(spot)과 끝(to)을 들고 있어 같은 글귀가 겹치면(재생기 8초 합침) 그쪽이 남는다. */
  /* ★ 핵은 탄두 색인(위 ③)이 한 발에 한 줄을 이미 낸다 — 장면 글귀("A가 핵 투하" · cast9 castNukes9 장면)까지 실으면 한 발이 결과 둘이 되어, 다음 결과로 넘어가며 시계가
     되감겨 같은 핵이 두 번 재생됐다(2026-10-12, 지적: "핵 투하가 두 번씩 재생됨"). 장면 쪽 핵 글귀는 뺀다. */
  const nukeDup9 = (txt9: string): boolean => txt9.includes("핵 투하");
  /** 장면 자막의 세분 낱말(★ 세분 추천 · cast9 castCapFacets9) — 활약 낱말은 그 경기 낱말 표의 기술·마법·유닛만. */
  const actTerm9 = (w9: string): boolean => ["기술", "마법", "유닛"].includes(terms9.get(w9) ?? "");
  const capFacets9 = (caps9: CapPart9[], txt9: string): [string, string][] => castCapFacets9(caps9, txt9, (r9) => nameOf9.get(r9), actTerm9);
  /* ★ 자막의 **사건 줄**(rows · 2026-10-20) — 주인·타겟은 자막의 주어/목적어(cast9 castCapRoles9 · 세분 낱말과 같은 가름) · 대상은 ① 전술 낱말(tactics9 TACTIC_RULES9 —
     "몰래 배럭" · "입구 막기" · "포토러시" …) ② 공격/견제(세분의 공격함/공격당함 · 견제함/견제당함) ③ 활약 낱말(그 경기의 유닛·마법·기술). 주인·타겟이 여럿이면 짝마다 한 줄.
     한 사건은 한 줄이다 — 같은 장면이 편성표 search(장면 끝 to)와 토막 자막(긴 장면은 잇단 토막마다 같은 자막)에 거듭 실리고, **순환 토막**(cyc)은 그 사람의 이정표를
     다시 읽어 주는 자막이라(2026-10-20 실측: 포토러시 이정표 하나가 순환마다 되풀이되어 6줄) 순환은 줄을 안 낸다(이정표는 search 가 이미 싣는다).
     남은 것은 시각 차례로 훑어, 같은 꼴의 줄이 앞 줄이 덮는 끝(장면·토막 끝 — 잇달면 늘어난다) 안이면 싣지 않는다. 그 끝 뒤에 다시 나오면 다른 사건이다. */
  const capLast9 = new Map<string, number>();
  const ACT_KIND9: Record<string, GameIndexKind9> = { 기술: "upgrade", 마법: "skill", 유닛: "unit" };
  const keyOfKo9 = (ko9: string, kind9: GameIndexKind9): string => {
    const tb9: Record<string, string> = kind9 === "skill" ? TECH_KO : kind9 === "unit" ? UNIT_KO : {};
    for (const [en9, k9] of Object.entries(tb9)) if (k9 === ko9) return en9;
    return "";
  };
  const capOcc9: { sec: number; until: number; caps: CapPart9[]; txt: string }[] = [];
  const capRows9 = (sec9: number, until9: number, caps9: CapPart9[], txt9: string): void => {
    const rl9 = castCapRoles9(caps9);
    const owners9 = rl9.owners.length > 0 ? rl9.owners : [null];
    const targets9 = rl9.targets.length > 0 ? rl9.targets : [null];
    const put9 = (p9: RowPart9, pairs9: boolean): void => {
      for (const o9 of owners9) for (const t9 of pairs9 ? targets9 : [null]) {
        const k9 = `${o9}|${t9}|${p9.kind}|${p9.term}|${p9.act}`;
        const l9 = capLast9.get(k9);
        capLast9.set(k9, Math.max(l9 ?? -Infinity, until9));
        if (l9 !== undefined && sec9 <= l9) continue;
        row9(sec9, null, { ...p9, owner: o9, target: t9 });
      }
    };
    for (const w9 of tacticWordsOfText9([capText9(caps9)])) put9({ kind: "tactic", term: w9, key: "", act: "", attr: "" }, true);
    if (rl9.verb) put9({ kind: "tactic", term: rl9.verb, key: "", act: "", attr: "" }, true);
    for (const [w9, a9] of castCapFacets9(caps9, txt9, () => undefined, actTerm9)) {
      if (a9 !== "활약") continue;
      const kind9 = ACT_KIND9[terms9.get(w9) ?? ""] ?? "unit";
      put9({ kind: kind9, term: w9, key: keyOfKo9(w9, kind9), act: "활약", attr: "" }, false);
    }
  };
  for (const x9 of (planAll9 as CastPlan9).search ?? []) {
    const txt9 = capTxt9(x9.caps);
    if (txt9 && !nukeDup9(txt9) && !SEARCH_ONGOING9.test(txt9)) {
      add9(x9.at, null, txt9, "", { x: x9.x, y: x9.y, raw: x9.raw, spot: x9.spot, to: x9.to, facet: capFacets9(x9.caps, txt9), cap: true });
      capOcc9.push({ sec: x9.at, until: x9.to ?? x9.at + CAP_SPAN9, caps: x9.caps, txt: txt9 });
    }
  }
  for (let i9 = 0; i9 < planAll9.length; i9 += 1) {
    const g9 = planAll9[i9];
    if (!g9.caps || g9.caps.length === 0) continue;
    const txt9 = capTxt9(g9.caps);
    if (txt9 && !nukeDup9(txt9) && !SEARCH_ONGOING9.test(txt9)) {
      add9(g9.at, null, txt9, g9.why ?? "", { raw: g9.spot ? undefined : g9.raw, spot: g9.spot, to: g9.capTo, facet: capFacets9(g9.caps, txt9), cap: true });
      if (!g9.cyc) capOcc9.push({ sec: g9.at, until: Math.max(g9.capTo ?? 0, i9 + 1 < planAll9.length ? planAll9[i9 + 1].at : g9.at + CAP_SPAN9), caps: g9.caps, txt: txt9 });
    }
  }
  for (const c9 of capOcc9.sort((a9, b9) => a9.sec - b9.sec)) capRows9(c9.sec, c9.until, c9.caps, c9.txt);
  out9.sort((a9, b9) => a9.sec - b9.sec);
  rows9.sort((a9, b9) => a9.sec - b9.sec);
  for (const w9 of SEARCH_TACTIC9) { const n9 = searchNorm9(w9); if (out9.some((h9) => h9.hay.includes(n9))) term9(w9, "전술"); }
  for (const [t9, tag9] of terms9) if (tag9 === "사람") people9.add(searchNorm9(t9));
  return { list: out9, terms: terms9, facets: facets9, people: people9, rows: rows9 };
}
