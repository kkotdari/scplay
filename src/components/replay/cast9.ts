/* 중계(중요도 기반 추적) — '지금 볼 만한 사람'을 미리 정해 두는 편성표 ─────────────────
 *
 * 요청: "중계(중요도기반추적)모드 — 현재 경기 장면 중 가장 중요하거나 가치있는 사람의
 *        추적 화면을 보여줌 · 실제 보여주려는 장면이 나오기 1-2초전에 미리 그 사람으로
 *        전환 · 특별하게 중요도 차이가 없는경우 순환 중계 원칙(초반이나 소강상태)"
 *
 * ★★ **미리 정해 둔다 — 실시간으로 고르지 않는다.** 요청의 "1-2초 전에 미리 전환"이
 *    그것을 못 박는다: 지금 무엇이 중요한지는 **그 일이 벌어진 뒤에야** 알 수 있으므로,
 *    실시간으로 고르면 늘 한 발 늦는다. 참값(TruthWorld)은 경기 전체를 이미 알고 있으니
 *    한 번 훑어 **편성표**를 굽고, 재생은 시각으로 그 표를 짚기만 한다. 중계 카메라가
 *    사건보다 먼저 가 있는 것은 이 앞셈 덕이다.
 *
 * ■ 무엇이 '중요'인가 — 자료가 실제로 아는 것으로만 센다.
 *   ① 죽음(end "atk") — 잃은 몸값이 곧 그 순간의 무게다. **죽인 쪽**은 참값의 겨눔
 *      자국(tgt)으로 되짚는다: 그 태그를 겨누고 있던 적의 임자가 killer다.
 *      ★ **일꾼만은 몸값이 아니라 경제의 값**(HARASS9 — 드랍·런바이 견제가 곧 그 꼴이다).
 *   ② 자폭(end "self") · ③ 마법(casts) — 스톰·핵·스테이시스처럼 값이 큰 기술은
 *      죽음이 안 따라도 그 자체가 장면이다.
 *   건설·업그레이드는 **안 센다** — 요청이 초반·소강을 순환 중계로 돌리라고 했으므로,
 *   그 자리를 건설로 메우면 그 뜻이 지워진다.
 *
 * ■ 누구를 보여주나 — 한 장면의 무게를 임자마다 더해 가장 무거운 사람이다. 죽인 쪽이
 *   잃은 쪽보다 무겁게(1 : 0.55) 쳐진다: 중계는 '당한 사람'보다 '하는 사람'을 본다.
 *   무게가 엇비슷하면(TIE9 안) **가장 오래 안 보여 준 사람**을 고른다 — 그것이 곧
 *   요청의 순환 원칙이고, 그래서 한 사람만 계속 잡히는 일이 없다.
 *
 * ■ 소강·초반 — 장면 사이가 IDLE9보다 벌면 CYCLE9마다 **살아 있는 사람을 돌아가며**
 *   보여준다(요청의 순환 중계). 경기 시작도 그 자리에서 시작한다.
 *   ★ 돌아가는 차례는 **로스터 차례로 팀을 번갈아**(2026-09, 요청: "자동 중계시 중요장면 없어서 순환할때
 *   순서를 로스터 순으로 팀 번갈아가며 보여주기") — 옛 '가장 오래 안 본 사람'은 장면이 끼어들 때마다 차례가
 *   뒤섞여 누가 다음인지 읽히지 않았다. 이제 고리(ring9 — 1팀 첫째 · 2팀 첫째 · 1팀 둘째 · …)를 두고
 *   마지막으로 보여 준 사람 **다음**부터 산 사람을 고른다(장면으로 보여 준 사람도 그 자리에서 잇는다).
 *   밀리(팀 없음)는 로스터 차례 그대로. 동점 가름(TIE9)은 종전대로 '가장 오래 안 본 사람'이다.
 */
import { BUILDING_KO, TECH_KO, UNIT_KO } from "../../utils/replayNames";
import { researchKo } from "../../utils/replayTechNames";
import { costOf, unitOf } from "../../utils/bwUnits";
import { tkN, tkT, tkV } from "../../utils/openbwTracks";
import type { TruthWorld } from "../../utils/truthLives";

/** 한 토막 — 이 시각부터 다음 토막까지 이 사람을 보여준다. */
export type CastSeg9 = {
  /** 갈아타는 시각(초) — 장면보다 LEAD9 앞이다. */
  at: number;
  /** 그 사람(참값 이름 = 로스터 key). */
  raw: string;
  /** 왜 골랐나 — 자막 꼬리표·진단. */
  why: string;
  /** 순환(소강·초반)인가 — 장면이면 거짓. */
  cyc: boolean;
  /** 그 장면의 무게(진단·토스트 차례 정하기). */
  score: number;
  /** ★ 그 장면의 **상대역**(2026-10 · 아래 머리말의 맞대결) — 재생기가 자막("A의 공격 · B를 공격 · B와 교전")을 짓는 자다
   *  (2026-10-09: 옛 자동 분할은 되물렸다 — 화면은 늘 한 사람). */
  foe?: string;
  /** 주인공(raw)의 몫 — atk 공격 · def 방어 · war 교전(둘 다 친다). 상대역은 그 거울(atk ↔ def · war 그대로). */
  role?: CastRole9;
  /** 맞대결이 끝나는 시각(초) — 그 뒤로는 같은 토막이어도 자막이 내린다. */
  foeTo?: number;
  /** 그 장면의 **적 전부**(주인공과 주고받은 몸값 큰 차례 · 첫째가 foe) · **같은 편**(함께 싸운 팀원) — 자막의 "A·B의 공격 · C와 함께"(2026-10-09). */
  foes?: string[];
  allies?: string[];
  /** ★ 자막 조각(2026-10-09, 요청: "모든 장면에 자막 — 전투·견제·공격·방어·기술 개발·건설 등을 담백한 개조식으로") — 글귀와 사람(재생기가 이름표 칩으로 그린다 ·
   *  조사 p 는 그 사람의 표시 이름 받침으로 재생기가 붙인다). 아래 castCaps9. */
  caps?: CapPart9[];
};
/** 자막 한 조각 — 글귀(text) 또는 사람(raw · 뒤에 붙일 조사 p: ga 가/이 · eul 를/을 · wa 와/과 · ui 의). */
export type CapPart9 = { text: string; raw?: undefined; p?: undefined } | { raw: string; p?: "ga" | "eul" | "wa" | "ui"; text?: undefined };
export type CastRole9 = "atk" | "def" | "war";
/** 상대역의 몫 — 주인공의 거울. */
export const castFoeRole9 = (r9: CastRole9): CastRole9 => (r9 === "atk" ? "def" : r9 === "def" ? "atk" : "war");

export type CastPlanOpts9 = {
  /** 경기 길이(초). */
  total: number;
  /** 중계에 안 세울 이름(관전자 등). */
  skip?: ReadonlySet<string>;
  /** 이 이름들만 세운다(로스터) — 안 주면 참값의 사람 전부. */
  only?: ReadonlySet<string>;
  /** 로스터 차례(이름) — 순환 고리의 자다. 안 주면 참값의 사람 차례. */
  order?: readonly string[];
  /** 이름 → 팀 — 고리를 팀 번갈아 짠다. 안 주면(밀리) 로스터 차례 그대로. */
  teamOf?: Readonly<Record<string, number | undefined>>;
  /** 지도 자원 점(ReplayMapGrid.resources — 미네랄 밭(겹친 것은 하나)·가스 [타일 x, 타일 y, 가스]) — 앞마당·멀티를 가르는 자(2026-10-10). 없으면 본진 건물은 수로만 센다. */
  resources?: readonly (readonly [number, number, number])[];
};

/** 장면보다 몇 초 먼저 갈아타나(요청: "1-2초전에 미리") — 그 사이에 카메라가 자리를 잡는다. */
export const CAST_LEAD9 = 1.5;
/** 한 장면으로 묶는 사건 사이의 최대 틈(초). */
const GAP9 = 4;
/** 한 장면의 최대 길이(초) — 긴 교전은 토막을 내어 POV를 다시 고른다. */
const MAX_SCENE9 = 22;
/** 갈아탄 뒤 최소한 머무는 시간(초) — 이보다 잦으면 화면이 정신없다. */
const MIN_HOLD9 = 5;
/** 머무는 중에도 갈아탈 만한 무게 배수 — 이만큼 크면 바로 넘긴다(요청: 바로 다른 사람으로 전환). */
const JUMP9 = 1.7;
/** '무게 차이가 없다'의 자 — 1등이 2등의 이 배수 안이면 순환 원칙으로 고른다.
 *  ⚠ 넓게 잡지 마라 — 이 문이 열리면 **이긴 쪽 대신 진 쪽**이 잡힐 수 있다(잃은 몫도
 *  무게이므로 호각인 교전에서는 둘이 엇비슷하다). 그 자리에서 순환을 부르는 것이 뜻이지만,
 *  1.25에서는 한쪽이 20% 더 이긴 교전까지 '차이 없음'으로 읽혔다(실측 합성 판). */
const TIE9 = 1.12;
/** 장면으로 세울 최소 무게 — 저글링 셋(또는 드라군 하나) 어치. */
const MIN_SCENE9 = 240;
/** 순환 한 토막의 길이(초) — 소강에서 한 사람을 보여주는 시간(요청: "순환중계시 한 사람
 *  유지시간 줄이기" — 14 → 9 → 재요청 "9초 -> 8초"). 자막이 상시 표시가 된 뒤로는 갈아타는 박자가
 *  곧 자막 박자라는 옛 ⚠(토스트가 그만큼 잦다)가 걷혀, 값을 정하는 것은 **한 사람을 읽을 만한
 *  시간**뿐이다 — MIN_HOLD9(5)보다는 넉넉하고, 소강 한 토막이 지루하지 않을 만큼. */
const CYCLE9 = 8;
/** 장면이 끝나고 이만큼 비면 순환으로 돌아간다(초). */
const IDLE9 = 8;
/** 죽인 쪽을 되짚는 창(초) — 이 안에 그 태그를 겨누고 있었으면 그 임자의 킬로 센다. */
const KILL_W9 = 2.5;
/** 잃은 쪽의 몫 — 죽인 쪽 1에 대해. */
const LOSS_K9 = 0.55;
/** 건물은 한 단 무겁다 — razing 은 유닛 교전보다 큰 사건이다. */
const BLD_K9 = 1.2;
/** 한꺼번에 이만큼 사라지면서 겨눈 자가 하나도 없으면 **나간 것**이다(교전이 아니다). */
const LEAVE_N9 = 8;
/** ★★ **일꾼의 죽음은 견제다 — 몸값이 아니라 경제의 값으로 센다**(2026-09, 지적: "자동 중계에서
 *  드랍견제 같은 중요한 장면을 중계안하는 경우가 있네") ─────────────────────────────────
 *  드랍·런바이·벌처 견제의 꼴은 **일꾼 몇을 띄엄띄엄 잡는 것**이다. 몸값(50)으로 세면 한 킬이
 *  77.5(죽인 쪽 50 + 잃은 쪽 27.5)라 셋을 한 장면에 몰아도 232 < MIN_SCENE9 고, 일꾼은 도망치며
 *  잡히므로 킬 사이가 GAP9(4초)보다 벌어 **한 장면으로 묶이지도 않는다**(실측 합성 판: 드론 다섯을
 *  5~8초 간격으로 잡으면 장면 0개). 곧 견제는 통째로 순환 뒤에 묻혔다.
 *  `k` — 일꾼 하나의 무게 배수(50 → 200 · 한 킬이 310 으로 홀로 장면이 선다 — 캐스터가 일꾼 킬마다
 *  화면을 돌리는 그 자다) · `tail` — 그 사건 뒤 장면을 열어 두는 초(GAP9 대신 · 도망치는 일꾼을 쫓아
 *  잡는 사이를 한 장면으로 잇고, 그 사이에 순환이 끼어들지 않게 한다). */
const HARASS9 = { k: 4, tail: 12 };
/** 맞대결(자동 분할)을 장면의 마지막 사건 뒤 이만큼 더 둔다(초) — 끝나자마자 한 화면으로 접히면 결말이 안 읽힌다. */
const DUEL_TAIL9 = 2;
/** 기지 피해 단(자막 · 2026-10-09) — 그 장면에서 잃은 건물 몸값 / 장면 머리의 기지 몸값: 반파 ≥ 0.2 · 대파 ≥ 0.45 · 궤멸 ≥ 0.75. */
const RAZE9 = { half: 0.2, heavy: 0.45, wipe: 0.75 };
/** 싸움터 가름(duel9 의 turf9Of) — home: 한 진영 몫이 이 위면 그 사람이 방어 · min: 자리를 아는 몸값이 맞대결 몸값의 이
 *  몫 아래면 안 쓴다 · near: 두 출발 자리가 이 타일 안이면 안 쓴다(가를 선이 없다). */
const TURF9 = { home: 0.65, min: 0.4, near: 12 };
/** 유닛의 죽은 자리를 명령으로 어림하는 창(초) — 그보다 오래된 명령은 그 몸이 어디 있었는지 못 말한다. */
const LOC_W9 = 25;

/** 변태로 난 몸의 **누적** 몸값 — 표의 값은 변태 비용뿐이라 밑몸 값을 더해 준다. */
const MORPH_BASE9: Record<string, string> = {
  Lurker: "Hydralisk", Guardian: "Mutalisk", Devourer: "Mutalisk",
};
/** 공짜로 나는 몸의 값 — 표가 [0,0]인 것들. */
const FREE_VAL9: Record<string, number> = {
  Archon: 550, "Dark Archon": 550, Broodling: 0, Larva: 0, Egg: 0,
  "Lurker Egg": 0, Cocoon: 0, "Infested Command Center": 0,
};

/** 그 정체의 몸값(가스는 1.5배) — 중계가 재는 '가치'의 자다. */
export function castValue9(kind: string): number {
  const f9 = FREE_VAL9[kind];
  if (f9 !== undefined) return f9;
  const [m9, g9] = costOf(kind);
  let v9 = m9 + g9 * 1.5;
  const b9 = MORPH_BASE9[kind];
  if (b9) { const [bm9, bg9] = costOf(b9); v9 += bm9 + bg9 * 1.5; }
  return v9;
}

/** 마법의 무게 — 좌표가 남는 기술만 참값에 실린다. 표에 없으면 안 센다. */
const CAST_W9: Record<string, number> = {
  "Nuclear Strike": 1400, "Nuclear Missile": 1400,
  "Psionic Storm": 260, "Stasis Field": 260, Maelstrom: 260,
  "Mind Control": 420, Recall: 380, Plague: 240, "EMP Shockwave": 240,
  "Dark Swarm": 200, Irradiate: 170, Lockdown: 170, "Disruption Web": 140,
  "Spawn Broodlings": 130, Ensnare: 110, Feedback: 100, Hallucination: 80,
  Consume: 60, "Optical Flare": 60, Restoration: 50, "Defensive Matrix": 50,
  "Scanner Sweep": 24,
};

/** 한 사건 — 시각·사람·무게 · `tail` 은 이 사건 뒤 장면을 열어 두는 초(없으면 GAP9). */
type Ev9 = { sec: number; raw: string; w: number; why: string; tail?: number;
  /** 맞상대(죽인 쪽이면 잃은 사람 · 잃은 쪽이면 죽인 사람) · 준 몸값(죽인 쪽) · 잃은 살림 값(일꾼·건물 · 잃은 쪽). */
  vs?: string; dealt?: number; econ?: number;
  /** 자막 재료(2026-10-09) — 죽은 몸의 종류(건물 파괴 자막의 건물 이름) · 마법 이름 · **죽인 유닛의 종류**(by · 리버/하이템플러 일꾼 견제 · 저글링러시의 자). */
  kind?: string; tech?: string; by?: string;
  /** 잃은 자리(타일 · 잃은 쪽 사건만) — 싸움이 **누구 진영에서** 났나를 재는 자다(duel9). 모르면 없다. */
  x?: number; y?: number };

/** 편성표를 굽는다 — 참값 한 벌에 한 번이다(재생 중에는 짚기만 한다). */
export function castPlan9(world: TruthWorld, opts: CastPlanOpts9): CastSeg9[] {
  const total = Math.max(1, opts.total);
  /** 임자 번호 → 이름. 관전자·로스터 밖은 아예 안 담는다(그 사람은 중계에 안 선다). */
  const rawOf9 = new Map<number, string>();
  const fill_9 = (only9?: ReadonlySet<string>): void => {
    rawOf9.clear();
    for (const p9 of world.players) {
      if (opts.skip?.has(p9.name)) continue;
      if (only9 && !only9.has(p9.name)) continue;
      rawOf9.set(p9.owner, p9.name);
    }
  };
  fill_9(opts.only);
  /* 로스터와 참값의 이름이 한 톨도 안 맞으면 **거르지 않는다** — 앱이 이름을 다르게 적는
     판에서 중계가 통째로 죽는 것보다, 로스터에 없는 사람이 한 번 잡히는 편이 낫다. */
  if (rawOf9.size === 0 && opts.only) fill_9(undefined);
  if (rawOf9.size === 0) return [];
  /** 그 사람의 몸이 마지막으로 살아 있던 초 — 순환에서 '이미 진 사람'을 뺀다. */
  const liveTo9 = new Map<string, number>();
  for (const e9 of world.lives) {
    const r9 = rawOf9.get(e9.owner);
    if (!r9) continue;
    const to9 = e9.died === null ? total : e9.died;
    if (to9 > (liveTo9.get(r9) ?? -1)) liveTo9.set(r9, to9);
  }

  /* ── 사건 모으기 ──────────────────────────────────────────────────────────── */
  const evs9: Ev9[] = [];
  /** 죽는 태그 — 겨눔 자국을 이 셋으로 좁힌다(전체를 담으면 표가 몇 배로 커진다). */
  const vics9 = new Set<number>();
  for (const e9 of world.lives) if (e9.died !== null && e9.end === "atk") vics9.add(e9.tag);
  /** 태그 → 그 태그를 겨눈 자국 [초, 임자, 초, 임자, …] — 죽인 쪽을 되짚는 자다.
   *  ★ **안 정렬한다**(한 태그의 목록은 대개 스물 안쪽이라 통째로 훑는 편이 싸다) ·
   *    **평평한 수 배열**이다(자국이 수만 개라 {s, o} 객체를 그만큼 짓지 않는다).
   *    실측(8인 20분 · 생애 8천 · 자국 3만2천): 43.6ms → 26.5ms(scripts/cast-plan.mjs). */
  /* ★ 자국마다 **겨눈 유닛의 종류**(kindId · 걸음 3 · 2026-10-09)도 싣는다 — 죽인 유닛이 리버인지 하이템플러인지 저글링인지가 자막의 재료다(아래 by). */
  const kindIds9 = new Map<string, number>();
  const kindNames9: string[] = [];
  const kindId9 = (k9: string): number => {
    let id9 = kindIds9.get(k9);
    if (id9 === undefined) { id9 = kindNames9.length; kindNames9.push(k9); kindIds9.set(k9, id9); }
    return id9;
  };
  const aim9 = new Map<number, number[]>();
  if (vics9.size > 0) {
    for (const e9 of world.lives) {
      const tg9 = e9.tgt;
      if (!tg9) continue;
      const n9 = tkN(tg9);
      const kid9 = kindId9(e9.kind);
      for (let i9 = 0; i9 < n9; i9 += 1) {
        const tag9 = tkV(tg9, i9);
        if (!tag9 || !vics9.has(tag9)) continue;
        const a9 = aim9.get(tag9);
        if (a9) a9.push(tkT(tg9, i9), e9.owner, kid9);
        else aim9.set(tag9, [tkT(tg9, i9), e9.owner, kid9]);
      }
    }
  }
  /** 태그 → 그 태그의 생애들(변태로 여럿) — 처치 절의 킬러 태그를 종류로 푼다. */
  const byTag9 = new Map<number, (typeof world.lives)[number][]>();
  for (const e9 of world.lives) { const a9 = byTag9.get(e9.tag); if (a9) a9.push(e9); else byTag9.set(e9.tag, [e9]); }
  const kindAt9 = (tag9: number, sec9: number): string => {
    const a9 = byTag9.get(tag9);
    if (!a9) return "";
    for (const e9 of a9) if (e9.born <= sec9 + 0.5 && (e9.died === null || e9.died >= sec9 - 0.5)) return e9.kind;
    return a9[a9.length - 1].kind;
  };
  /** ★ 처치 절(판 11 · [초, 킬러 임자, 킬러 태그, 죽은 태그])이 있으면 그것이 먼저다 — 겨눔 자국은 어림이고 이것은
   *  시뮬이 적은 참값이다(맞대결의 상대역도 이것으로 선다). 같은 태그가 변태로 여러 생애를 가지므로 초로 짝짓는다. */
  const killBy9 = new Map<number, number[]>();
  for (const [ks9, ko9, kt9, kd9] of world.kills ?? []) {
    const a9 = killBy9.get(kd9);
    if (a9) a9.push(ks9, ko9, kt9); else killBy9.set(kd9, [ks9, ko9, kt9]);
  }
  /** 그 태그를 그 순간 죽인 [임자, 유닛 종류] — 처치 절, 없으면 창 안에서 가장 많이 겨눈 적(그 임자가 가장 많이 겨눈 유닛 종류). 없으면 [-1, ""]. */
  const killerOf9 = (tag9: number, sec9: number, mine9: number): [number, string] => {
    const k9 = killBy9.get(tag9);
    if (k9) for (let i9 = 0; i9 < k9.length; i9 += 3) {
      if (Math.abs(k9[i9] - sec9) <= 1 && k9[i9 + 1] !== mine9) return [k9[i9 + 1], k9[i9 + 2] ? kindAt9(k9[i9 + 2], k9[i9]) : ""];
    }
    const a9 = aim9.get(tag9);
    if (!a9) return [-1, ""];
    let best9 = -1;
    let bn9 = 0;
    let bk9 = "";
    for (let i9 = 0; i9 < a9.length; i9 += 3) {
      const s9 = a9[i9];
      const o9 = a9[i9 + 1];
      if (s9 < sec9 - KILL_W9 || s9 > sec9 + 0.5 || o9 === mine9) continue;
      let n9 = 0;
      const kn9 = new Map<number, number>();
      for (let j9 = 1; j9 < a9.length; j9 += 3) {
        if (a9[j9] !== o9) continue;
        const sj9 = a9[j9 - 1];
        if (sj9 >= sec9 - KILL_W9 && sj9 <= sec9 + 0.5) { n9 += 1; kn9.set(a9[j9 + 1], (kn9.get(a9[j9 + 1]) ?? 0) + 1); }
      }
      if (n9 > bn9) {
        best9 = o9; bn9 = n9;
        let bc9 = 0;
        for (const [id9, c9] of kn9) if (c9 > bc9) { bc9 = c9; bk9 = kindNames9[id9]; }
      }
    }
    return [best9, bk9];
  };
  /** ★ 사이오닉 스톰에 죽은 몸 — 겨눈 자가 없으니 killerOf9 는 모른다. 죽은 자리 6타일 · 3초 안에 적이 내린 스톰이 있으면 그 임자의 **하이템플러** 킬(2026-10-09). */
  const stormBy9 = (sec9: number, x9: number | undefined, y9: number | undefined, mine9: number): number => {
    if (x9 === undefined || y9 === undefined) return -1;
    for (const [cs9, cx9, cy9, tech9, co9] of world.casts) {
      if (tech9 !== "Psionic Storm" || co9 === mine9 || Math.abs(cs9 - sec9) > 3) continue;
      if (Math.hypot(cx9 - x9, cy9 - y9) <= 6) return co9;
    }
    return -1;
  };

  /** 죽음 한 벌 — 한꺼번에 사라지는 '나감'을 걸러 내려고 먼저 모은다. */
  type D9 = { sec: number; owner: number; v: number; bld: boolean; killer: number; wk: boolean; x?: number; y?: number; kind: string; by: string };
  /** 죽은 자리(타일) — 건물은 제 자리(bornX/Y · 앉은 자리가 여럿이면 마지막) · 유닛은 죽기 전 `LOC_W9` 초 안의 마지막 명령
   *  자리(참값 생애는 죽은 자리를 안 든다 — 명령이 '어디에 가 있었나'의 가장 가까운 어림이다) · 그도 없으면 막 태어난 몸의
   *  태어난 자리 · 모르면 null. */
  const deadAt9 = (e9: (typeof world.lives)[number], sec9: number): { x: number; y: number } | null => {
    if (e9.bld) {
      const s9 = e9.sites.length > 1 ? e9.sites[e9.sites.length - 1] : null;
      return s9 ? { x: s9[1] + 1, y: s9[2] + 1 } : { x: e9.bornX, y: e9.bornY };
    }
    for (let i9 = e9.orders.length - 1; i9 >= 0; i9 -= 1) {
      const o9 = e9.orders[i9];
      if (o9[0] > sec9) continue;
      if (o9[0] >= sec9 - LOC_W9) return { x: o9[1], y: o9[2] };
      break;
    }
    return sec9 - e9.born <= LOC_W9 ? { x: e9.bornX, y: e9.bornY } : null;
  };
  /** 사람 → 출발 자리(그 사람의 가장 먼저 난 건물 · 분할 칸 배치의 splitStart9 와 같은 자). */
  const start9 = new Map<string, { x: number; y: number; t: number }>();
  for (const e9 of world.lives) {
    if (!e9.bld) continue;
    const r9 = rawOf9.get(e9.owner);
    if (!r9) continue;
    const s9 = start9.get(r9);
    if (!s9 || e9.born < s9.t) start9.set(r9, { x: e9.bornX, y: e9.bornY, t: e9.born });
  }
  /** 그 임자의 **살아 있는 본진 건물** 자리(확장 포함) — 기지 싸움(baseRole9)·프록시 건물 가름·드랍의 자. */
  const HALL_ANY9 = new Set(["Command Center", "Nexus", "Hatchery", "Lair", "Hive"]);
  const BASE_R9 = 18;
  const hallsOfOwner9 = (owners9: ReadonlySet<number>, sec9: number): [number, number][] => {
    const out9: [number, number][] = [];
    for (const e9 of world.lives) {
      if (e9.bld && owners9.has(e9.owner) && HALL_ANY9.has(e9.kind) && e9.born <= sec9 && (e9.died === null || e9.died > sec9)) out9.push([e9.bornX, e9.bornY]);
    }
    return out9;
  };
  /** 그 건물이 제 임자의 기지(본진 건물 BASE_R9 안)에 있었나 — 자리를 모르거나 본진이 하나도 없으면 참(프록시로 안 본다). */
  const atOwnBase9 = (owner9: number, x9: number | undefined, y9: number | undefined, sec9: number): boolean => {
    if (x9 === undefined || y9 === undefined) return true;
    const halls9 = hallsOfOwner9(new Set([owner9]), sec9);
    return halls9.length === 0 || halls9.some(([hx9, hy9]) => Math.hypot(hx9 - x9, hy9 - y9) <= BASE_R9);
  };
  /* ★★ 자원 무더기(2026-10-10, 요청: "빨무같이 앞마당 없는 맵인데 앞마당 넥서스 건설이라고 나오네 — 3넥서스 이렇게 나와야지. 자원 무더기가 따로 있는 맵만 앞마당·멀티 용어") ──────
     지도 자원 점(opts.resources — 미네랄 밭·가스)을 RES_LINK9 타일 단일 연결로 묶은 것이 **자원 무더기**다(한 기지의 미네랄 줄 + 가스 · 기지끼리는 10타일 넘게 떨어진다).
     본진 건물이 무더기에서 SERVE_R9 안이면 그 무더기를 **먹는다**. 새 본진 건물이 제 것 아무도 안 먹는 무더기 곁이면 **새 기지**(앞마당·멀티 — buildMiles9), 이미 먹는
     무더기 곁이거나 곁에 무더기가 없으면 같은 기지에 하나 더("3넥서스"). 빨무처럼 본진 무더기뿐인 맵은 늘 수로 센다. 자원 자료가 없으면(옛 판) 앞마당·멀티라 단정하지 않는다. */
  const RES_LINK9 = 6;
  const SERVE_R9 = 10;
  /** 자원 무더기가 없는 본진 건물끼리 한 기지로 묶는 거리(타일) — 자원 자료가 없을 때의 기지 수 셈. */
  const BASE_JOIN9 = 12;
  const resGroups9: [number, number][][] = (() => {
    const pts9 = (opts.resources ?? []).map(([x9, y9]): [number, number] => [x9, y9]);
    const par9 = pts9.map((_, i9) => i9);
    const find9 = (i9: number): number => { while (par9[i9] !== i9) { par9[i9] = par9[par9[i9]]; i9 = par9[i9]; } return i9; };
    for (let i9 = 0; i9 < pts9.length; i9 += 1) {
      for (let j9 = i9 + 1; j9 < pts9.length; j9 += 1) {
        if (Math.hypot(pts9[i9][0] - pts9[j9][0], pts9[i9][1] - pts9[j9][1]) <= RES_LINK9) par9[find9(i9)] = find9(j9);
      }
    }
    const by9 = new Map<number, [number, number][]>();
    for (let i9 = 0; i9 < pts9.length; i9 += 1) {
      const r9 = find9(i9);
      const g9 = by9.get(r9);
      if (g9) g9.push(pts9[i9]); else by9.set(r9, [pts9[i9]]);
    }
    return [...by9.values()];
  })();
  const groupDist9 = (g9: readonly [number, number][], x9: number, y9: number): number => {
    let d9 = Infinity;
    for (const [px9, py9] of g9) d9 = Math.min(d9, Math.hypot(px9 - x9, py9 - y9));
    return d9;
  };
  /** 그 자리에서 SERVE_R9 안의 무더기 번호들. */
  const groupsNear9 = (x9: number, y9: number): number[] => {
    const out9: number[] = [];
    for (let i9 = 0; i9 < resGroups9.length; i9 += 1) if (groupDist9(resGroups9[i9], x9, y9) <= SERVE_R9) out9.push(i9);
    return out9;
  };
  type Hall9 = { x: number; y: number };
  /** 본진 건물들의 기지 수 — 무더기를 함께 먹거나 BASE_JOIN9 안이면 한 기지. 자원 자료가 있으면 무더기를 먹는 기지만 센다(곁에 무더기 없는 해처리 홀로는 기지가 아니다). */
  const basesOf9 = (halls9: readonly Hall9[]): number => {
    if (halls9.length === 0) return 0;
    const near9 = halls9.map((h9) => groupsNear9(h9.x, h9.y));
    const par9 = halls9.map((_, i9) => i9);
    const find9 = (i9: number): number => { while (par9[i9] !== i9) { par9[i9] = par9[par9[i9]]; i9 = par9[i9]; } return i9; };
    for (let i9 = 0; i9 < halls9.length; i9 += 1) {
      for (let j9 = i9 + 1; j9 < halls9.length; j9 += 1) {
        const share9 = near9[i9].some((g9) => near9[j9].includes(g9));
        if (share9 || Math.hypot(halls9[i9].x - halls9[j9].x, halls9[i9].y - halls9[j9].y) <= BASE_JOIN9) par9[find9(i9)] = find9(j9);
      }
    }
    const roots9 = new Set<number>();
    const fed9 = new Set<number>();
    for (let i9 = 0; i9 < halls9.length; i9 += 1) { const r9 = find9(i9); roots9.add(r9); if (near9[i9].length > 0) fed9.add(r9); }
    return resGroups9.length > 0 && fed9.size > 0 ? fed9.size : roots9.size;
  };
  const ds9: D9[] = [];
  for (const e9 of world.lives) {
    if (e9.died === null) continue;
    const r9 = rawOf9.get(e9.owner);
    if (!r9) continue;
    /* 끝머리는 **안 센다** — 경기가 끝나면 모두의 몸이 한꺼번에 사라져, 그것을 교전으로
       읽으면 마지막 몇 초가 늘 가짜 장면이 된다. */
    if (e9.died > total - 3) continue;
    const v9 = castValue9(e9.kind);
    if (v9 <= 0) continue;
    if (e9.end === "self") {
      evs9.push({ sec: e9.died, raw: r9, w: v9, why: "자폭" });
      continue;
    }
    if (e9.end !== "atk") continue;   // morph·own·끝까지 삶은 죽음이 아니다
    const at9 = deadAt9(e9, e9.died);
    /* ★ 일꾼의 죽음이 견제인 것은 **제 기지에서** 죽을 때다(2026-10-10) — 상대 본진에서 캐논을 짓다 죽은 프로브·정찰 일꾼은 견제가 아니라 그 싸움의 몫(몸값 그대로 · 꼬리 없음).
       포토러시의 프로브가 "Z의 R 일꾼 견제"로 읽혔다. */
    const wk9 = !e9.bld && unitOf(e9.kind).worker && atOwnBase9(e9.owner, at9?.x, at9?.y, e9.died);
    let [killer9, by9] = killerOf9(e9.tag, e9.died, e9.owner);
    if (killer9 < 0) { const st9 = stormBy9(e9.died, at9?.x, at9?.y, e9.owner); if (st9 >= 0) { killer9 = st9; by9 = "High Templar"; } }
    ds9.push({ sec: e9.died, owner: e9.owner, v: wk9 ? v9 * HARASS9.k : v9, bld: e9.bld, wk: wk9, kind: e9.kind,
      killer: killer9, by: by9, ...(at9 ?? {}) });
  }
  ds9.sort((a9, b9) => a9.sec - b9.sec);
  /* ★ **나간 사람의 몸은 교전이 아니다** — 팀전에서 한 사람이 나가면 그 몸이 한 프레임에
     다 사라진다. 그 무게를 그대로 세면 경기 중간에 거대한 가짜 장면이 선다. 가름의 자는
     '겨눈 자가 하나도 없다'다: 실제 교전이라면 적이 그 몸들을 겨누고 있었다. */
  const drop9 = new Set<number>();
  for (let i9 = 0; i9 < ds9.length;) {
    let j9 = i9;
    while (j9 < ds9.length && ds9[j9].sec - ds9[i9].sec <= 0.5) j9 += 1;
    const grp9 = new Map<number, number[]>();
    for (let k9 = i9; k9 < j9; k9 += 1) {
      const g9 = grp9.get(ds9[k9].owner);
      if (g9) g9.push(k9); else grp9.set(ds9[k9].owner, [k9]);
    }
    for (const idx9 of grp9.values()) {
      if (idx9.length < LEAVE_N9) continue;
      if (idx9.some((k9) => ds9[k9].killer >= 0)) continue;
      for (const k9 of idx9) drop9.add(k9);
    }
    i9 = j9;
  }
  for (let i9 = 0; i9 < ds9.length; i9 += 1) {
    if (drop9.has(i9)) continue;
    const d9 = ds9[i9];
    const mine9 = rawOf9.get(d9.owner);
    const kill9 = d9.killer >= 0 ? rawOf9.get(d9.killer) : undefined;
    /* ★ 제 기지 밖의 건물(프록시 파일런·러시 캐논·성큰)이 부서진 것은 **기지 피해가 아니라 교전**이다(2026-10-10) — 포토러시의 캐논이 상대 본진에서 깨진 것을 "기지 대파"로
       읽었다. 몸값·살림(econ)은 그대로 센다. */
    const base9 = d9.bld && atOwnBase9(d9.owner, d9.x, d9.y, d9.sec);
    const why9 = base9 ? "건물 파괴" : d9.wk ? "견제" : "교전";
    const tail9 = d9.wk ? HARASS9.tail : undefined;
    if (kill9) evs9.push({ sec: d9.sec, raw: kill9, w: d9.v * (d9.bld ? BLD_K9 : 1), why: why9, tail: tail9,
      vs: mine9, dealt: d9.v, kind: d9.kind, ...(d9.by ? { by: d9.by } : {}) });
    if (mine9) evs9.push({ sec: d9.sec, raw: mine9, w: d9.v * LOSS_K9, why: base9 ? "건물 잃음" : d9.wk ? "견제 당함" : "교전", tail: tail9,
      vs: kill9, econ: d9.bld || d9.wk ? d9.v : 0, x: d9.x, y: d9.y, kind: d9.kind });
  }
  for (const [sec9, , , tech9, own9] of world.casts) {
    const w9 = CAST_W9[tech9];
    if (!w9) continue;
    const r9 = rawOf9.get(own9);
    if (!r9 || sec9 > total - 3) continue;
    evs9.push({ sec: sec9, raw: r9, w: w9, why: tech9 === "Nuclear Strike" ? "핵" : "마법", tech: tech9 });
  }
  evs9.sort((a9, b9) => a9.sec - b9.sec);

  /* ── 장면으로 묶기 ────────────────────────────────────────────────────────── */
  type Sc9 = { t0: number; t1: number; by: Map<string, number>; why: string; tail: number;
    /** 가장 무거운 사건(자막 재료 · 2026-10-09). */
    top?: Ev9;
    /** "k>v" → k 가 v 의 **건물**을 부순 몸값 · v → 잃은 건물 몸값(자막의 기지 피해 단 — 반파·대파·궤멸 · 2026-10-09). */
    bldPair: Map<string, number>; bldLost: Map<string, number>;
    /** "a>b" → a 가 b 에게 준 몸값 · 사람 → 잃은 살림 값(맞대결의 자 — 아래 duel9). */
    pair: Map<string, number>; econ: Map<string, number>;
    /** 잃은 자리들 [사람, x, y, 몸값] — 싸움터가 누구 진영인가(duel9). */
    locs: [string, number, number, number][];
    /** 일꾼을 죽인 유닛 종류 → 무게(견제 자막의 "리버 일꾼 견제") · 사람 → (죽인 유닛 종류 → 무게)(저글링러시 · 2026-10-09). */
    byKind: Map<string, number>; killKind: Map<string, Map<string, number>> };
  const scs9: Sc9[] = [];
  for (let i9 = 0; i9 < evs9.length;) {
    const sc9: Sc9 = { t0: evs9[i9].sec, t1: evs9[i9].sec, by: new Map(), why: evs9[i9].why, tail: GAP9,
      pair: new Map(), econ: new Map(), locs: [], bldPair: new Map(), bldLost: new Map(), byKind: new Map(), killKind: new Map() };
    let top9 = 0;
    let j9 = i9;
    /* 다음 사건이 **앞 사건의 꼬리**(견제면 HARASS9.tail · 그 밖은 GAP9) 안이면 같은 장면이다. */
    while (j9 < evs9.length && evs9[j9].sec - sc9.t1 <= sc9.tail && evs9[j9].sec - sc9.t0 <= MAX_SCENE9) {
      const e9 = evs9[j9];
      sc9.t1 = e9.sec;
      sc9.tail = e9.tail ?? GAP9;
      sc9.by.set(e9.raw, (sc9.by.get(e9.raw) ?? 0) + e9.w);
      if (e9.vs && e9.dealt) sc9.pair.set(`${e9.raw}>${e9.vs}`, (sc9.pair.get(`${e9.raw}>${e9.vs}`) ?? 0) + e9.dealt);
      if (e9.why === "건물 파괴" && e9.vs && e9.dealt) {
        sc9.bldPair.set(`${e9.raw}>${e9.vs}`, (sc9.bldPair.get(`${e9.raw}>${e9.vs}`) ?? 0) + e9.dealt);
        sc9.bldLost.set(e9.vs, (sc9.bldLost.get(e9.vs) ?? 0) + e9.dealt);
      }
      if (e9.econ) sc9.econ.set(e9.raw, (sc9.econ.get(e9.raw) ?? 0) + e9.econ);
      if (e9.by && e9.vs) {
        if (e9.why === "견제") sc9.byKind.set(e9.by, (sc9.byKind.get(e9.by) ?? 0) + e9.w);
        let kk9 = sc9.killKind.get(e9.raw);
        if (!kk9) { kk9 = new Map(); sc9.killKind.set(e9.raw, kk9); }
        kk9.set(e9.by, (kk9.get(e9.by) ?? 0) + e9.w);
      }
      if (e9.x !== undefined && e9.y !== undefined && e9.vs) sc9.locs.push([e9.raw, e9.x, e9.y, e9.dealt ?? e9.w / LOSS_K9]);
      /* 꼬리표는 그 장면에서 **가장 무거운 사건**의 것이다 — 핵 한 발이 든 교전은 '핵'이다. */
      if (e9.w > top9) { top9 = e9.w; sc9.why = e9.why; sc9.top = e9; }
      j9 += 1;
    }
    scs9.push(sc9);
    i9 = j9;
  }

  /* ── 편성표 짜기 ──────────────────────────────────────────────────────────── */
  const out9: CastSeg9[] = [];
  /** 그 사람을 마지막으로 보여준 시각 — 순환·동점 가름의 자다(아직이면 -1000). */
  const shown9 = new Map<string, number>();
  for (const r9 of rawOf9.values()) shown9.set(r9, -1000);
  /** 그때 살아 있는 사람들 — 순환 후보. */
  const aliveAt9 = (sec9: number): string[] => {
    const a9 = [...rawOf9.values()].filter((r9) => (liveTo9.get(r9) ?? 0) > sec9);
    return a9.length > 0 ? a9 : [...rawOf9.values()];
  };
  /** ★ 순환 고리 — 로스터 차례로 팀을 번갈아 짠다(위 머리말의 ★). 로스터 밖(참값에만 있는 사람)은 뒤에 잇는다. */
  const ring9: string[] = (() => {
    const names9 = [...rawOf9.values()];
    const has9 = new Set(names9);
    const ord9 = (opts.order ?? names9).filter((n9) => has9.has(n9));
    for (const n9 of names9) if (!ord9.includes(n9)) ord9.push(n9);
    const groups9: string[][] = [];
    const gi9 = new Map<number, number>();
    for (const n9 of ord9) {
      const tm9 = opts.teamOf?.[n9] ?? 0;
      let g9 = gi9.get(tm9);
      if (g9 === undefined) { g9 = groups9.length; gi9.set(tm9, g9); groups9.push([]); }
      groups9[g9].push(n9);
    }
    const out9: string[] = [];
    const len9 = Math.max(0, ...groups9.map((g9) => g9.length));
    for (let i9 = 0; i9 < len9; i9 += 1) for (const g9 of groups9) if (i9 < g9.length) out9.push(g9[i9]);
    return out9;
  })();
  /** 고리에서 마지막으로 보여 준 사람의 자리 — 순환은 그 다음부터 돈다. */
  let ringPos9 = -1;
  /** 고리의 다음 사람 — 마지막으로 보여 준 자리 다음부터 돌며 후보(산 사람)에 든 첫 사람. */
  const nextRing9 = (cands9: string[]): string => {
    const ok9 = new Set(cands9);
    for (let k9 = 1; k9 <= ring9.length; k9 += 1) {
      const n9 = ring9[(ringPos9 + k9) % ring9.length];
      if (ok9.has(n9)) return n9;
    }
    return cands9[0];
  };
  /** 가장 오래 안 보여 준 사람 — 같으면 이름 차례(같은 경기에서 늘 같은 편성이 나오게). 동점 가름의 자다. */
  const lonely9 = (cands9: string[]): string => cands9.reduce((b9, r9) => {
    const sb9 = shown9.get(b9) ?? -1000;
    const sr9 = shown9.get(r9) ?? -1000;
    if (sr9 < sb9) return r9;
    if (sr9 > sb9) return b9;
    return r9 < b9 ? r9 : b9;
  }, cands9[0]);
  /** 한 토막을 싣는다 — 같은 사람이 이어지면 토막을 안 늘린다(갈아타는 자리가 아니다). */
  type Duel9 = { foe: string; role: CastRole9; foeTo: number; foes: string[]; allies: string[] };
  const push9 = (at9: number, raw9: string, why9: string, cyc9: boolean, score9: number, duel9?: Duel9, caps9?: CapPart9[]): void => {
    const a9 = Math.max(0, Math.min(total, at9));
    ringPos9 = ring9.indexOf(raw9);
    const last9 = out9[out9.length - 1];
    /* 이어지는 같은 사람 — 꼬리표만 갱신한다(장면이 순환을 이겼으면 장면 쪽으로). 맞대결은 **상대역까지 같아야** 잇는다
       — 상대가 바뀌거나 맞대결이 끝난 뒤의 순환이면 새 토막이다(안 그러면 맞대결이 순환 내내 남는다). */
    if (last9 && last9.raw === raw9 && (!last9.foe || a9 >= (last9.foeTo ?? 0)) && !duel9) {
      if (!cyc9 && last9.cyc) { last9.cyc = false; last9.why = why9; last9.score = score9; if (caps9) last9.caps = caps9; }
      shown9.set(raw9, a9);
      return;
    }
    if (last9 && last9.raw === raw9 && duel9 && last9.foe === duel9.foe) {
      last9.foeTo = Math.max(last9.foeTo ?? 0, duel9.foeTo);
      if (!cyc9) { last9.cyc = false; last9.why = why9; last9.score = Math.max(last9.score, score9); last9.role = duel9.role; if (caps9) last9.caps = caps9; }
      shown9.set(raw9, a9);
      return;
    }
    if (last9 && a9 <= last9.at) return;   // 시각이 뒤로 가는 토막은 안 싣는다
    out9.push({ at: a9, raw: raw9, why: why9, cyc: cyc9, score: score9, ...(duel9 ?? {}), ...(caps9 ? { caps: caps9 } : {}) });   // duel9 의 foes·allies 도 함께 실린다
    shown9.set(raw9, a9);
  };
  /** ★★ **맞대결** — 그 장면에서 주인공과 가장 많이 주고받은 적이 상대역이다(2026-10, 요청: "교전 발생시 공격자만 보여줄게
   *  아니라 화면 두개로 나눠서 대응하는쪽도 보여주기 · 침공이나 전투 드랍 견제 등에서 주인공의 상대역도 보여주는것 · 공격쪽
   *  닉네임에 공격배지 방어는 방어배지 둘다 공격이면 교전배지").
   *  · 상대역 — `pair` 의 주고받은 몸값(주인공 → 그 · 그 → 주인공)의 합이 가장 큰 사람. 겨눔 자국이 없는 옛 덤프는 죽인 쪽을
   *    모르니 맞대결이 안 선다(한 화면 그대로).
   *  · 몫 — **잃은 살림**(일꾼·건물)으로 가른다: 침공·드랍·견제는 지키는 쪽의 일꾼·건물이 죽는 일이고, 군대끼리의 싸움은
   *    살림이 안 죽는다. 둘의 살림 손실이 맞대결 몸값의 25% 아래면 교전 · 둘이 엇비슷하게(0.6배 안) 잃었으면 교전 ·
   *    아니면 더 잃은 쪽이 방어, 다른 쪽이 공격이다. ⚠ '누가 더 죽였나'로 가르지 마라 — 막아 낸 방어가 더 많이 죽인다. */
  /** ★ **싸움터가 누구 진영인가**(2026-10, 지적: "포토러시 간 사람이 공격인데 방어로 나오는 현상") — 잃은 살림만 보면
   *  프록시 러시가 뒤집힌다: 러시한 쪽의 파일런·캐논(건물 = 살림)이 **상대 본진에서** 부서지므로 그쪽이 더 잃은 쪽이 되어
   *  방어로 섰다. 이제 그 장면의 죽음 자리를 두 사람의 출발 자리를 잇는 선에 사영해(0 = 주인공 본진 · 1 = 상대 본진) 몸값으로
   *  무게를 둔 '주인공 진영 몫'을 낸다 — 1 에 가까우면 주인공의 땅이 싸움터이니 방어다. 자리를 아는 몸값이 맞대결의
   *  `TURF9.min` 에 못 미치거나 출발 자리가 `TURF9.near` 타일 안에서 겹치면 null(옛 살림 자로 물러난다). */
  const turf9Of = (sc9: Sc9, pick9: string, foe9: string): number | null => {
    const a9 = start9.get(pick9);
    const b9 = start9.get(foe9);
    if (!a9 || !b9) return null;
    const dx9 = b9.x - a9.x;
    const dy9 = b9.y - a9.y;
    const L9 = dx9 * dx9 + dy9 * dy9;
    if (L9 < TURF9.near * TURF9.near) return null;
    let home9 = 0;
    let all9 = 0;
    for (const [r9, x9, y9, v9] of sc9.locs) {
      if (r9 !== pick9 && r9 !== foe9) continue;
      const u9 = ((x9 - a9.x) * dx9 + (y9 - a9.y) * dy9) / L9;
      /* 가운데 띠(0.35~0.65)는 어느 진영도 아니다 — 무게만 센다(곧 '가운데 싸움'이면 몫이 0.5 로 모인다). */
      home9 += v9 * (u9 <= 0.35 ? 1 : u9 >= 0.65 ? 0 : 0.5);
      all9 += v9;
    }
    let pair9 = 0;
    for (const [k9, v9] of sc9.pair) if (k9 === `${pick9}>${foe9}` || k9 === `${foe9}>${pick9}`) pair9 += v9;
    if (all9 <= 0 || all9 < pair9 * TURF9.min) return null;
    return home9 / all9;
  };
  /** ★ 그 장면이 **누구 기지에서** 났나(2026-10-09, 요청: "특정 기지에서 교전 시 교전보다는 공격·방어·헬프로 기술") — 죽은 자리들이 한쪽의 **살아 있는 본진 건물**
   *  (확장 포함 · HALL_ANY9)에서 BASE_R9 타일 안이면 그 사람의 기지다(몸값 무게 · 한쪽 몫이 TURF9.home 이상 → 주인공 기지면 방어 · 상대 기지면 공격). 출발 자리 선
   *  (turf9Of)은 가운데 확장에서의 싸움을 '가운데'(교전)로 읽었다 — 이 자가 먼저고, 못 가르면 그 선으로. */
  const hallsAt9 = (raw9: string, sec9: number): [number, number][] => hallsOfOwner9(ownersOf9(raw9), sec9);
  const baseRole9 = (sc9: Sc9, pick9: string, foe9: string): CastRole9 | null => {
    const hp9 = hallsAt9(pick9, sc9.t0);
    const hf9 = hallsAt9(foe9, sc9.t0);
    if (hp9.length === 0 && hf9.length === 0) return null;
    const near9 = (halls9: [number, number][], x9: number, y9: number): number => {
      let d9 = Infinity;
      for (const [hx9, hy9] of halls9) d9 = Math.min(d9, Math.hypot(hx9 - x9, hy9 - y9));
      return d9;
    };
    let atP9 = 0; let atF9 = 0; let all9 = 0;
    for (const [r9, x9, y9, v9] of sc9.locs) {
      if (r9 !== pick9 && r9 !== foe9) continue;
      const dp9 = near9(hp9, x9, y9);
      const df9 = near9(hf9, x9, y9);
      all9 += v9;
      if (dp9 <= BASE_R9 && dp9 <= df9) atP9 += v9;
      else if (df9 <= BASE_R9 && df9 < dp9) atF9 += v9;
    }
    if (all9 <= 0) return null;
    if (atP9 / all9 >= TURF9.home) return "def";
    if (atF9 / all9 >= TURF9.home) return "atk";
    return null;
  };
  const duel9 = (sc9: Sc9, pick9: string): Duel9 | undefined => {
    let foe9 = "";
    let fw9 = 0;
    for (const o9 of sc9.by.keys()) {
      if (o9 === pick9) continue;
      const w9 = (sc9.pair.get(`${pick9}>${o9}`) ?? 0) + (sc9.pair.get(`${o9}>${pick9}`) ?? 0);
      if (w9 > fw9) { fw9 = w9; foe9 = o9; }
    }
    if (!foe9) return undefined;
    let role9: CastRole9 = "war";
    const base9 = baseRole9(sc9, pick9, foe9);
    const turf9 = base9 !== null ? null : turf9Of(sc9, pick9, foe9);
    if (base9 !== null) role9 = base9;
    else if (turf9 !== null) role9 = turf9 >= TURF9.home ? "def" : turf9 <= 1 - TURF9.home ? "atk" : "war";
    if (base9 === null && (turf9 === null || role9 === "war")) {
      /* 싸움터를 못 가르면(가운데 · 자리를 모름 · 출발 자리가 겹침) 옛 자 — 잃은 살림 — 로 간다. */
      const eP9 = sc9.econ.get(pick9) ?? 0;
      const eF9 = sc9.econ.get(foe9) ?? 0;
      if (eP9 + eF9 >= fw9 * 0.25 && !(eP9 >= eF9 * 0.6 && eF9 >= eP9 * 0.6)) role9 = eP9 > eF9 ? "def" : "atk";
      else role9 = "war";
    }
    /* ★ 자막의 이름들(2026-10-09) — 적은 주인공과 주고받은 몸값이 큰 차례(첫째가 상대역 · 팀전이면 다른 팀 참가자 전부 · 팀이 없으면 주고받은 사람만) ·
       같은 편은 그 장면에 든 팀원이다. */
    const tmP9 = opts.teamOf?.[pick9];
    const xch9 = (o9: string): number => (sc9.pair.get(`${pick9}>${o9}`) ?? 0) + (sc9.pair.get(`${o9}>${pick9}`) ?? 0);
    const foes9: string[] = [];
    const allies9: string[] = [];
    for (const o9 of sc9.by.keys()) {
      if (o9 === pick9) continue;
      const tmO9 = opts.teamOf?.[o9];
      if (tmP9 !== undefined && tmO9 === tmP9) allies9.push(o9);
      else if (o9 === foe9 || xch9(o9) > 0 || (tmP9 !== undefined && tmO9 !== undefined)) foes9.push(o9);
    }
    foes9.sort((a9, b9) => (a9 === foe9 ? -1 : b9 === foe9 ? 1 : xch9(b9) - xch9(a9)));
    return { foe: foe9, role: role9, foeTo: sc9.t1 + (sc9.tail - GAP9) + DUEL_TAIL9, foes: foes9, allies: allies9 };
  };
  /** 마지막 토막이 선 시각(없으면 -1000) · 그 무게. */
  const lastAt9 = (): number => (out9.length > 0 ? out9[out9.length - 1].at : -1000);
  const lastScore9 = (): number => (out9.length > 0 ? out9[out9.length - 1].score : 0);
  /** 소강 구간을 순환으로 메운다 — from 부터 to 까지 CYCLE9 마다 한 사람. */
  const fill9 = (from9: number, to9: number): void => {
    /* 앞 토막이 최소한 머문 뒤에 시작한다 — 장면을 보여 주다 3초 만에 순환으로 끊으면
       그 장면이 무슨 장면인지 읽히지 않는다. */
    const s09 = out9.length > 0 ? Math.max(from9, lastAt9() + MIN_HOLD9) : from9;
    /* 끝은 **MIN_HOLD9 앞**에서 멎는다 — 장면 바로 앞에 순환 한 토막을 끼우면 자막이
       두 번 잇달아 뜨고(그 둘은 다른 사람이다) 앞 토막은 몇 초 만에 끊긴다. */
    for (let s9 = s09; s9 < to9 - MIN_HOLD9; s9 += CYCLE9) push9(s9, nextRing9(aliveAt9(s9)), "순환 중계", true, 0);
  };

  /* ── 자막(2026-10-09, 요청: "앞으로 자동중계에서는 모든 장면에 자막 삽입 — 전투·견제·공격·방어·기술 개발·건설 등을 자연스러운 말투로(개조식) · 화려한 표현 X
     담백하고 단순하게") ───────────────────────────────────────────────────────────
     장면 토막은 그 장면의 **가장 무거운 사건**(sc.top)과 맞대결 몫으로, 순환 토막은 그 사람이 그 창에서 한 일(연구 · 확장 · 건설)로 짓는다. 사람은 조각(raw)으로 두고
     재생기가 이름표 칩으로 그린다 — 조사는 표시 이름의 받침을 재생기가 안다(p). 글귀 보기:
       교전 — 공격 "A의 B 공격" · 방어 "B가 공격함 · C가 헬프옴" · 호각 "A B vs C D 교전"(vs · 2026-10-09 · 칩은 점 없이 잇닿는다) · 견제 "A의 B 리버 일꾼 견제" · 기지 피해 "A가 B 기지 반파/대파/궤멸시킴"(잃은 건물 몸값이 그때
       기지 몸값의 20/45/75% — 되요청: "공격 와서 뭘 부쉈는지까지보다 기지를 반파시킴 대파시킴 궤멸시킴 등으로") · 그 아래면 "A가 B 건물 파괴" · 핵 "A 핵 투하" · 마법 "A 스톰"
       순환 — "A 메타볼릭 부스트 개발" · 빌드 읽기 "A 선스포닝풀 후 해처리" · "A 빠른 넥서스 늘리기" · "A 로보틱스 테크" · "A 포토 건설" · 국면 "A 3기지 운영 중"(아래 ★★). */
  /** 일꾼을 잡은 유닛의 자막 이름 — 스캐럽은 리버 · 탱크는 모드 없이 · 그 밖은 UNIT_KO(없으면 영문 그대로). */
  const harassName9 = (kind9: string): string =>
    (kind9 === "Scarab" || kind9 === "Reaver" ? "리버" : kind9.startsWith("Siege Tank") ? "탱크" : UNIT_KO[kind9] ?? BUILDING_KO[kind9] ?? kind9);   // 캐논·성큰·벙커도 든다
  /** 그 사람의 러시 건물(상대 기지 안의 캐논·성큰) — buildMiles9 가 채운다 [착공 초, 상대, 글귀]. */
  const rushes9 = new Map<string, [number, string, string][]>();
  /** att 가 def 기지에 RUSH_W9 초 안에 세운 캐논/성큰 → "포토러시"/"성큰러시". */
  const RUSH_W9 = 240;
  const rushKind9 = (att9: string, def9: string, sec9: number): string | null => {
    buildMiles9(att9);
    for (const [at9, foe9, text9] of rushes9.get(att9) ?? []) if (foe9 === def9 && at9 >= sec9 - RUSH_W9 && at9 <= sec9 + 10) return text9;
    return null;
  };
  /** ★ 폭탄드랍 — att 의 수송선(드랍십·셔틀·복부 주머니 뒤의 오버로드)이 장면 앞 DROP_W9 초 안에 def 기지(본진 건물 BASE_R9 안)로 명령받았으면 그 싸움은 드랍이다. */
  const DROP_W9 = 30;
  const TRANSPORT9 = new Set(["Dropship", "Shuttle", "Overlord"]);
  const dropKind9 = (att9: string, def9: string, sec9: number): string | null => {
    const own9 = ownersOf9(att9);
    const halls9 = hallsAt9(def9, sec9);
    if (halls9.length === 0) return null;
    const sacs9 = world.ups.some(([us9, name9, uo9]) => name9 === "Ventral Sacs" && own9.has(uo9) && us9 <= sec9);
    for (const e9 of world.lives) {
      if (e9.bld || !own9.has(e9.owner) || !TRANSPORT9.has(e9.kind) || e9.born > sec9 || (e9.died !== null && e9.died < sec9 - DROP_W9)) continue;
      if (e9.kind === "Overlord" && !sacs9) continue;
      for (const o9 of e9.orders) {
        if (o9[0] < sec9 - DROP_W9 || o9[0] > sec9 + 5) continue;
        if (halls9.some(([hx9, hy9]) => Math.hypot(hx9 - o9[1], hy9 - o9[2]) <= BASE_R9)) return "폭탄드랍";
      }
    }
    return null;
  };
  /** 저글링러시 — ZL_RUSH_T9 초 전의 장면에서 att 의 킬이 대개 저글링이면. */
  const ZL_RUSH_T9 = 420;
  const zlRush9 = (sc9: Sc9, att9: string): string | null => {
    if (sc9.t0 >= ZL_RUSH_T9) return null;
    const kk9 = sc9.killKind.get(att9);
    if (!kk9) return null;
    let all9 = 0; let zl9 = 0;
    for (const [kind9, w9] of kk9) { all9 += w9; if (kind9 === "Zergling") zl9 += w9; }
    return all9 > 0 && zl9 / all9 >= 0.6 ? "저글링러시" : null;
  };
  const chips9 = (raws9: string[], last9?: CapPart9["p"]): CapPart9[] =>
    raws9.map((r9, i9): CapPart9 => (i9 < raws9.length - 1 ? { raw: r9 } : { raw: r9, p: last9 }));   // 칩 사이 점은 없다(2026-10-10, 요청: "사이에 점 굳이 없어도 될듯") — 칩 여백이 가른다
  const sceneCaps9 = (sc9: Sc9, pick9: string, d9: Duel9 | undefined): CapPart9[] => {
    /* ★ 자막은 **주인공(pick9)의 일만** 말한다(2026-10-09, 요청: "자막엔 주인공 관련 사건 위주로 그 외엔 굳이 넣지 않기") — 장면의 가장 무거운 사건(top)이나 건물을
       가장 많이 부순 짝이 주인공과 무관하면(팀전에서 같은 장면의 딴 짝) 그것을 안 쓰고 주인공의 맞대결 글귀로 간다. 건물 짝은 주인공이 든 것 중 가장 무거운 것. */
    const top9 = sc9.top && (sc9.top.raw === pick9 || sc9.top.vs === pick9) ? sc9.top : undefined;
    const why9 = top9 ? sc9.why : "";
    if (top9 && why9 === "핵") return [{ raw: top9.raw }, { text: " 핵 투하" }];
    if (top9 && why9 === "마법") return [{ raw: top9.raw }, { text: ` ${TECH_KO[top9.tech ?? ""] ?? top9.tech ?? "마법"}` }];
    if (top9 && why9 === "자폭") return [{ raw: top9.raw }, { text: " 자폭" }];
    if (top9 && (why9 === "견제" || why9 === "견제 당함")) {
      const k9 = why9 === "견제" ? top9.raw : top9.vs;
      const v9 = why9 === "견제" ? top9.vs : top9.raw;
      /* ★ 일꾼을 가장 많이 잡은 유닛의 이름을 붙인다(2026-10-09, 요청: "자주 나오는 전략 — 하이템플러 일꾼 견제 · 리버 일꾼 견제") — "A의 B 리버 일꾼 견제". 스캐럽은 리버 ·
         스톰 킬은 stormBy9 가 하이템플러로 적는다 · 다른 유닛도 제 이름(벌처·뮤탈·질럿·다크템플러 …). 모르면 "일꾼 견제". */
      let best9 = ""; let bw9 = 0;
      for (const [kind9, w9] of sc9.byKind) if (w9 > bw9) { bw9 = w9; best9 = kind9; }
      const nm9 = best9 ? harassName9(best9) : "";
      /* 상대 기지의 캐논·성큰이 잡은 일꾼은 **포토러시/성큰러시**, 수송선이 그 기지로 간 뒤의 일꾼 킬은 **폭탄드랍**(요청) — 리버·하이템플러는 제 이름(리버 드랍 = "리버 일꾼 견제")이
         더 말한다. */
      const named9 = k9 && v9 ? rushKind9(k9, v9, sc9.t0) ?? (nm9 !== "리버" && nm9 !== "하이템플러" ? dropKind9(k9, v9, sc9.t0) : null) : null;
      if (k9 && v9) return [{ raw: k9, p: "ui" }, { text: " " }, { raw: v9 }, { text: named9 ? ` ${named9}` : nm9 ? ` ${nm9} 일꾼 견제` : " 일꾼 견제" }];
      return [{ raw: v9 ?? pick9 }, { text: nm9 ? ` ${nm9} 일꾼 견제 당함` : " 일꾼 견제 당함" }];
    }
    /* 기지 피해 — 그 장면에서 **주인공이 든 짝** 가운데 건물을 가장 많이 부순 짝(k>v)의, v 가 장면 머리에 갖고 있던 건물 몸값 대비 잃은 몫으로 단을 가른다(RAZE9).
       20% 아래는 "건물 파괴". */
    let bk9 = ""; let bv9 = ""; let bw9 = 0;
    for (const [key9, w9] of sc9.bldPair) {
      const [k9, v9] = key9.split(">");
      if ((k9 === pick9 || v9 === pick9) && w9 > bw9) { bw9 = w9; bk9 = k9; bv9 = v9; }
    }
    if (bk9 && bv9) {
      const lost9 = sc9.bldLost.get(bv9) ?? 0;
      const base9 = baseValue9(bv9, sc9.t0);
      const f9 = base9 > 0 ? lost9 / base9 : 0;
      const deg9 = f9 >= RAZE9.wipe ? "궤멸시킴" : f9 >= RAZE9.heavy ? "대파시킴" : f9 >= RAZE9.half ? "반파시킴" : "";
      if (deg9) return [{ raw: bk9, p: "ga" }, { text: " " }, { raw: bv9 }, { text: ` 기지 ${deg9}` }];
      if (why9 === "건물 파괴" || why9 === "건물 잃음") return [{ raw: bk9, p: "ga" }, { text: " " }, { raw: bv9 }, { text: " 건물 파괴" }];
    } else if (top9 && (why9 === "건물 파괴" || why9 === "건물 잃음")) {
      return [{ raw: why9 === "건물 파괴" ? (top9.vs ?? pick9) : top9.raw }, { text: " 건물 파괴됨" }];
    }
    if (d9) {
      const foes9 = d9.foes.length > 0 ? d9.foes : [d9.foe];
      /* ★ 공격의 **이름**(2026-10-09, 요청: "자주 나오는 전략 — 포토러시 · 성큰러시 · 9드론 저글링러시 · 폭탄드랍") — 상대 기지의 캐논/성큰(rushKind9) > 수송선이 그 기지로
         간 뒤의 싸움(dropKind9) > 초반 저글링 킬(zlRush9) > 그냥 "공격". 방어 쪽은 "…함"(공격함과 같은 꼴). */
      const attack9 = (att9: string, def9: string): string => rushKind9(att9, def9, sc9.t0) ?? dropKind9(att9, def9, sc9.t0) ?? zlRush9(sc9, att9) ?? "공격";
      if (d9.role === "atk") return [...chips9([pick9, ...d9.allies], "ui"), { text: " " }, ...chips9(foes9), { text: ` ${attack9(pick9, d9.foe)}` }];
      if (d9.role === "def") {
        return [...chips9(foes9, "ga"), { text: ` ${attack9(d9.foe, pick9)}함` }, ...(d9.allies.length > 0 ? [{ text: " · " } as CapPart9, ...chips9(d9.allies, "ga"), { text: " 헬프옴" } as CapPart9] : [])];
      }
      // 교전은 **vs 로 팀을 가른다**(2026-10-09, 요청: "교전 시 vs 로 팀 갈라서 보여주고") — "A·B vs C·D 교전".
      return [...chips9([pick9, ...d9.allies]), { text: " vs " }, ...chips9(foes9), { text: " 교전" }];
    }
    return [{ raw: pick9 }, { text: ` ${sc9.why}` }];
  };
  /** 그 사람이 sec 에 갖고 있던 건물 몸값의 합(기지 피해 단의 분모 · 짓는 중인 것도 든다). */
  const baseValue9 = (raw9: string, sec9: number): number => {
    const own9 = ownersOf9(raw9);
    let v9 = 0;
    for (const e9 of world.lives) {
      if (!e9.bld || !own9.has(e9.owner) || e9.born > sec9 || (e9.died !== null && e9.died <= sec9)) continue;
      v9 += castValue9(e9.kind);
    }
    return v9;
  };
  /** 순환 토막 — 그 사람의 창 [t0, t1) 에서 연구 완료 > 빌드 이정표(창 안 > 최근) > 그 밖의 건설 > 국면 요약 차례로 찾는다. */
  const HALL9 = new Set(["Command Center", "Nexus", "Hatchery"]);
  const PLAIN_BLD9 = new Set(["Supply Depot", "Pylon", "Extractor", "Refinery", "Assimilator", "Creep Colony"]);
  const ownersOf9 = (raw9: string): Set<number> => new Set([...rawOf9.entries()].filter(([, n9]) => n9 === raw9).map(([o9]) => o9));
  /* ★★ **빌드 읽기**(2026-10-09, 요청: "소강 상태에서 '누구 운영'이라는 자막보다는 순조로운 테크/발전 중 · 빠른 넥서스/커맨드 늘리기 · 선스포닝풀/노스포닝풀 해처리 등
     초반/중반 빌드에 대한 분석이 들어가면 좋을듯") ─────────────────────────────────────────────────────────────
     그 사람의 건물 **착공 차례**(world.lives · born — 레어로 변태한 해처리의 앞 생애도 착공이다)에서 이정표를 뽑는다(buildMiles9):
       · 둘째 본진이 핵심 테크(스포닝풀 · 코어 · 팩토리)보다 먼저 → "빠른 넥서스/커맨드 늘리기" · 저그는 "노스포닝풀 해처리"(셋째까지 먼저면 "노스포닝풀 3해처리") ·
         스포닝풀이 먼저면 "선스포닝풀" → 그 뒤 해처리는 "선스포닝풀 후 해처리" · 테크 뒤의 둘째는 "앞마당 … 늘리기" · 셋째부터 "N번째 … 늘리기"/"N해처리 늘리기"
       · 포지가 게이트보다 먼저 → "선포지"(그 뒤 넥서스가 게이트보다 먼저면 "선포지 더블넥서스") · 익스트랙터가 스포닝풀보다 먼저 → "선가스"
       · 둘째·셋째 생산 건물 → "2게이트/3게이트" · "2배럭/3배럭" · "2팩/3팩" · 테크 건물은 TECH_MILE9 의 이름("로보틱스 테크" …) · 아홉 드론 아래 스포닝풀 "N드론 스포닝풀 건설"(러시라
         단정하지 않는다 · 2026-10-10) ·
         상대 기지 안의 캐논·성큰 "A의 B 포토러시/성큰러시"(rushes9 — 장면 자막의 공격 이름도 이것)
     자막은 창 안의 이정표 > 창 앞 MILE_RECENT9 초 안의 마지막 이정표 > 그 밖의 건물 건설(옛 "X 건설") > 국면 요약(phaseCap9: 최근 테크 → "순조로운 테크/발전 중" ·
     본진 셋 이상 → "N기지 운영 중" · 병력이 한창 나오면 "병력 모으는 중" · 그 밖 "순조로운 발전 중"). 옛 "확장"·"운영" 글귀는 걷었다.
     🔎 cast-plan.mjs ⑧ 빌드 읽기. */
  const TECH_MILE9: Record<string, string> = {
    "Cybernetics Core": "코어 테크", "Robotics Facility": "로보틱스 테크", Stargate: "스타게이트 테크", "Citadel of Adun": "시타델 테크", "Templar Archives": "템플러 테크",
    "Robotics Support Bay": "리버 테크", Observatory: "옵저버 테크", "Fleet Beacon": "캐리어 테크", "Arbiter Tribunal": "아비터 테크",
    Factory: "팩토리 테크", Starport: "스타포트 테크", Armory: "아머리 테크", Academy: "아카데미 테크", "Science Facility": "사이언스 테크",
    "Engineering Bay": "엔지니어링 베이 업그레이드", "Machine Shop": "머신샵 테크", "Control Tower": "컨트롤 타워 테크", "Covert Ops": "고스트 테크", "Physics Lab": "배틀크루저 테크",
    Lair: "레어 테크", Spire: "뮤탈리스크 테크", "Hydralisk Den": "히드라 테크", "Evolution Chamber": "챔버 업그레이드", "Queen's Nest": "하이브 테크 준비",
    Hive: "하이브 테크", "Ultralisk Cavern": "울트라리스크 테크", "Defiler Mound": "디파일러 테크", "Greater Spire": "가디언·디바우러 테크",
  };
  /** 종족의 핵심 테크 — 둘째 본진·둘째 생산 건물이 이보다 먼저면 '빠른'·'투…'다. */
  const CORE_TECH9: Record<string, string> = { Nexus: "Cybernetics Core", "Command Center": "Factory", Hatchery: "Spawning Pool" };
  /* 둘째·셋째 생산 건물(2026-10-09, 요청: "자주 나오는 전략 — 3게이트") — 숫자 이름. 둘째는 핵심 테크(코어·팩토리) 앞일 때, 셋째는 윗 테크(ADV9) 앞이면 늘(코어 뒤 3게이트도
     3게이트다) · 팩토리는 늘. */
  const PROD9: Record<string, [string, string]> = { Gateway: ["2게이트", "3게이트"], Barracks: ["2배럭", "3배럭"], Factory: ["2팩", "3팩"] };
  const ADV9 = new Set(["Robotics Facility", "Stargate", "Citadel of Adun", "Templar Archives", "Starport", "Armory", "Science Facility"]);
  /** 러시 건물 — 상대 기지(본진 건물 BASE_R9 안)에 세운 것의 글귀(요청: "포토러시 · 성큰러시"). */
  const RUSH_BLD9: Record<string, string> = { "Photon Cannon": "포토러시", "Sunken Colony": "성큰러시", "Creep Colony": "성큰러시" };
  const HALL_KO9: Record<string, string> = { Nexus: "넥서스", "Command Center": "커맨드", Hatchery: "해처리" };
  /** 이정표를 창 앞 이만큼(초)까지 되짚는다 — 그보다 오래면 국면 요약으로. */
  const MILE_RECENT9 = 120;
  /** 국면 요약의 '최근 테크'(초) · '병력이 한창'의 창(초)과 수. */
  const PHASE9 = { tech: 240, armyWin: 60, armyN: 4 };
  const WORKER9 = new Set(["SCV", "Probe", "Drone"]);
  const NON_ARMY9 = new Set(["Larva", "Egg", "Overlord", "Cocoon", "Lurker Egg", "Scarab", "Interceptor", "Broodling"]);
  /** 그 자리가 **같은 편의 기지**인가 — 같은 편(teamOf 같음)의 살아 있는 본진 건물 또는 출발 자리가 BASE_R9 안이면 그 사람. 밀리·팀 모름이면 없다. */
  const allyBaseAt9 = (raw9: string, x9: number, y9: number, sec9: number): string | null => {
    const tm9 = opts.teamOf?.[raw9];
    if (tm9 === undefined) return null;
    for (const r9 of new Set(rawOf9.values())) {
      if (r9 === raw9 || opts.teamOf?.[r9] !== tm9) continue;
      if (hallsAt9(r9, sec9).some(([hx9, hy9]) => Math.hypot(hx9 - x9, hy9 - y9) <= BASE_R9)) return r9;
      const st9 = start9.get(r9);
      if (st9 && Math.hypot(st9.x - x9, st9.y - y9) <= BASE_R9) return r9;
    }
    return null;
  };
  /** 그 사람이 sec 앞 LOST_W9 초 동안 잃은 건물 몸값 / 그때 기지 몸값 — "이사"의 자(대파 RAZE9.heavy 이상). */
  const LOST_W9 = 300;
  const lostFrac9 = (raw9: string, sec9: number): number => {
    const own9 = ownersOf9(raw9);
    let lost9 = 0;
    for (const e9 of world.lives) {
      if (e9.bld && own9.has(e9.owner) && e9.end === "atk" && e9.died !== null && e9.died > sec9 - LOST_W9 && e9.died <= sec9) lost9 += castValue9(e9.kind);
    }
    const base9 = baseValue9(raw9, sec9 - LOST_W9);
    return base9 > 0 ? lost9 / base9 : 0;
  };
  /** 그 사람의 **앞마당** 무더기 — 출발 자리가 먹는 무더기를 뺀, 출발 자리에서 가장 가까운 무더기(NATURAL_R9 타일 안). 자원 자료가 없거나 없으면 -1. */
  const NATURAL_R9 = 40;
  const natOf9 = new Map<string, number>();
  const naturalOf9 = (raw9: string): number => {
    const got9 = natOf9.get(raw9);
    if (got9 !== undefined) return got9;
    const st9 = start9.get(raw9);
    let best9 = -1;
    if (st9) {
      const main9 = new Set(groupsNear9(st9.x, st9.y));
      let bd9 = NATURAL_R9;
      for (let i9 = 0; i9 < resGroups9.length; i9 += 1) {
        if (main9.has(i9)) continue;
        const d9 = groupDist9(resGroups9[i9], st9.x, st9.y);
        if (d9 <= bd9) { bd9 = d9; best9 = i9; }
      }
    }
    natOf9.set(raw9, best9);
    return best9;
  };
  type Mile9 = { at: number; caps: CapPart9[] };
  /** 그 사람의 빌드 이정표(착공 시각 차례) — 한 번 세어 두고 자막마다 짚는다. */
  const milesOf9 = new Map<string, Mile9[]>();
  const buildMiles9 = (raw9: string): Mile9[] => {
    const got9 = milesOf9.get(raw9);
    if (got9) return got9;
    const own9 = ownersOf9(raw9);
    const blds9 = world.lives
      .filter((e9) => e9.bld && own9.has(e9.owner) && !e9.handoff && (!PLAIN_BLD9.has(e9.kind) || e9.kind === "Extractor" || e9.kind === "Creep Colony"))
      .sort((a9, b9) => a9.born - b9.born);
    const miles9: Mile9[] = [];
    const mile9 = (at9: number, text9: string): void => { miles9.push({ at: at9, caps: [{ raw: raw9 }, { text: ` ${text9}` }] }); };
    const mileVs9 = (at9: number, foe9: string, text9: string): void => { miles9.push({ at: at9, caps: [{ raw: raw9, p: "ui" }, { text: " " }, { raw: foe9 }, { text: ` ${text9}` }] }); };
    /** 그때 살아 있던 드론 수(9드론 저글링러시의 자). */
    const dronesAt9 = (sec9: number): number => {
      let n9 = 0;
      for (const e9 of world.lives) if (!e9.bld && e9.kind === "Drone" && own9.has(e9.owner) && e9.born <= sec9 && (e9.died === null || e9.died > sec9)) n9 += 1;
      return n9;
    };
    const rushList9: [number, string, string][] = [];
    rushes9.set(raw9, rushList9);
    const rushed9 = new Map<string, number>();   // "상대|글귀" → 마지막 착공(같은 러시의 캐논 여럿은 한 이정표)
    const halls9: string[] = [];        // 착공한 본진 종류(처음 것은 born 0 이라 안 든다 — 둘째부터)
    let hallKind9 = "";
    for (const p9 of world.players) if (own9.has(p9.owner)) hallKind9 = p9.race === "저그" ? "Hatchery" : p9.race === "프로토스" ? "Nexus" : p9.race === "테란" ? "Command Center" : "";
    if (!hallKind9) { const h9 = blds9.find((e9) => HALL9.has(e9.kind)); hallKind9 = h9?.kind ?? (blds9.some((e9) => e9.kind === "Gateway" || e9.kind === "Forge") ? "Nexus" : blds9.some((e9) => e9.kind === "Barracks") ? "Command Center" : "Hatchery"); }
    const coreTech9 = CORE_TECH9[hallKind9] ?? "";
    let coreAt9 = Infinity;            // 핵심 테크 착공 시각
    let advAt9 = Infinity;             // 윗 테크(ADV9) 착공 시각
    let firstProdAt9 = Infinity;       // 첫 생산 건물(게이트·배럭) 착공
    let forgeFirst9 = false;
    const prodN9 = new Map<string, number>();
    const seen9 = new Set<string>();
    let hallN9 = 0;
    for (const e9 of blds9) {
      const k9 = e9.kind;
      const n9 = (prodN9.get(k9) ?? 0) + 1;
      prodN9.set(k9, n9);
      const rushText9 = RUSH_BLD9[k9];
      if (rushText9) {
        /* 상대 기지 안의 캐논·성큰(크립 콜로니 포함) → "A의 B 포토러시"(요청: 포토러시 · 성큰러시). 같은 러시의 건물 여럿은 RUSH_W9 안이면 한 이정표. */
        for (const [o9, foeRaw9] of rawOf9) {
          if (own9.has(o9) || (opts.teamOf?.[foeRaw9] !== undefined && opts.teamOf?.[foeRaw9] === opts.teamOf?.[raw9])) continue;
          if (!hallsAt9(foeRaw9, e9.born).some(([hx9, hy9]) => Math.hypot(hx9 - e9.bornX, hy9 - e9.bornY) <= BASE_R9)) continue;
          const key9 = `${foeRaw9}|${rushText9}`;
          const last9 = rushed9.get(key9);
          rushed9.set(key9, e9.born);
          rushList9.push([e9.born, foeRaw9, rushText9]);
          if (last9 === undefined || e9.born - last9 > RUSH_W9) mileVs9(e9.born, foeRaw9, rushText9);
          break;
        }
        if (k9 === "Creep Colony") continue;
      }
      if (k9 === coreTech9 && coreAt9 === Infinity) {
        coreAt9 = e9.born;
        seen9.add(k9);
        if (k9 === "Spawning Pool") {
          const dn9 = dronesAt9(e9.born);
          /* 아홉 드론 아래의 스포닝풀은 드론 수를 그대로 적는다 — "N드론 스포닝풀 건설"(2026-10-10, 되지적: "9드론에 스포닝풀 지었는데 바로 저글링러시라고 나오면 안 될 듯 —
             아직 모르는 건 넣지 말고 확실하게 알아낸 것만"). 러시인지는 저글링이 실제로 치는 장면(zlRush9)이 말한다. 드론을 안 세는 판(0)은 그냥 스포닝풀. */
          mile9(e9.born, dn9 >= 4 && dn9 <= 9 ? `${dn9}드론 스포닝풀 건설` : halls9.length === 0 ? "선스포닝풀" : "해처리 후 스포닝풀");
        } else mile9(e9.born, TECH_MILE9[k9] ?? `${BUILDING_KO[k9] ?? k9} 건설`);
        continue;
      }
      if (ADV9.has(k9) && advAt9 === Infinity) advAt9 = e9.born;
      if (k9 === "Extractor") { if (coreAt9 === Infinity && hallKind9 === "Hatchery" && n9 === 1) mile9(e9.born, "선가스"); continue; }
      if (k9 === "Forge" && n9 === 1 && firstProdAt9 === Infinity && hallKind9 === "Nexus") { forgeFirst9 = true; mile9(e9.born, "선포지"); continue; }
      if (PROD9[k9]) {
        if (firstProdAt9 === Infinity) firstProdAt9 = e9.born;
        if (k9 === "Factory" ? (n9 === 2 || n9 === 3) : (n9 === 2 && coreAt9 === Infinity) || (n9 === 3 && advAt9 === Infinity)) mile9(e9.born, PROD9[k9][n9 - 2]);
        continue;
      }
      if (HALL9.has(k9)) {
        /* 처음 본진(born 0 · 덤프가 늦게 시작해도 첫 몇 초)은 이정표가 아니다. 변태로 끝난 해처리(레어가 된 것)도 착공은 착공 — 같은 태그의 레어 생애는 TECH_MILE9 로 따로 선다. */
        hallN9 += 1;
        if (hallN9 === 1 && e9.born < 5) continue;
        halls9.push(k9);
        /* ★ 본진 건물의 이름은 **그 순간의 사실**로 가른다(2026-10-10, 지적: "기지가 대파돼서 아군 기지로 이사 가서 새로 해처리를 짓는데 7해처리라고 나와 — 누구 기지로 이사 ·
           빨무같이 앞마당 없는 맵인데 앞마당 넥서스 — 3넥서스. 자원 무더기가 따로 있는 맵만 앞마당·멀티") — 옛 '지은 차례(누적)'는 잃은 본진까지 세어 7해처리가 됐다.
           ① 같은 편 기지(그 편의 살아 있는 본진 건물 또는 출발 자리 BASE_R9 안) → 제 기지를 잃었거나 대파됐으면 "[P] [A] 기지로 이사" · 아니면 "[P] [A] 기지에 해처리 건설"
           ② 제 본진 건물이 하나도 없으면 → 출발 자리 곁 "본진 재건" · 딴 곳 "새 기지로 이사"
           ③ 아무도(제 것) 안 먹는 자원 무더기 곁 → 새 기지: 출발 자리에서 가장 가까운 딴 무더기면 "앞마당 …"(둘째 기지일 때 빌드 이름 — 노스포닝풀·선포지 더블넥서스·노배럭
              더블커맨드·빠른) · 그 밖은 "첫 멀티 / N번째 멀티"
           ④ 그 밖(같은 무더기 · 무더기 없음 · 자원 자료 없음) → 살아 있는 본진 건물 수 "3넥서스 · 3해처리 · 2커맨드"(스포닝풀 전이면 "노스포닝풀 2해처리"). */
        const t9 = e9.born;
        const hallsNow9 = world.lives.filter((h9) => h9 !== e9 && h9.bld && own9.has(h9.owner) && HALL_ANY9.has(h9.kind) && h9.born <= t9 && (h9.died === null || h9.died > t9))
          .map((h9): Hall9 => ({ x: h9.bornX, y: h9.bornY }));
        const ko9 = HALL_KO9[hallKind9] ?? "본진";
        const ally9 = allyBaseAt9(raw9, e9.bornX, e9.bornY, t9);
        if (ally9) {
          const home9 = hallsNow9.filter((h9) => !allyBaseAt9(raw9, h9.x, h9.y, t9));
          const moved9 = home9.length === 0 || lostFrac9(raw9, t9) >= RAZE9.heavy;
          miles9.push({ at: t9, caps: [{ raw: raw9 }, { text: " " }, { raw: ally9 }, { text: moved9 ? " 기지로 이사" : ` 기지에 ${ko9} 건설` }] });
          continue;
        }
        if (hallsNow9.length === 0) {
          const st9 = start9.get(raw9);
          mile9(t9, st9 && Math.hypot(st9.x - e9.bornX, st9.y - e9.bornY) <= BASE_R9 ? "본진 재건" : "새 기지로 이사");
          continue;
        }
        const mine9 = groupsNear9(e9.bornX, e9.bornY);
        const fed9 = new Set(hallsNow9.flatMap((h9) => groupsNear9(h9.x, h9.y)));
        if (mine9.length > 0 && mine9.every((g9) => !fed9.has(g9))) {
          const nat9 = naturalOf9(raw9);
          const before9 = basesOf9(hallsNow9);
          let text9: string;
          if (nat9 >= 0 && mine9.includes(nat9)) {
            if (before9 > 1) text9 = `앞마당 ${ko9}`;
            else if (hallKind9 === "Hatchery") text9 = coreAt9 === Infinity ? "노스포닝풀 앞마당 해처리" : "앞마당 해처리";
            else if (hallKind9 === "Nexus") text9 = forgeFirst9 && firstProdAt9 === Infinity ? "선포지 더블넥서스" : coreAt9 === Infinity ? "빠른 앞마당 넥서스" : "앞마당 넥서스";
            else text9 = firstProdAt9 === Infinity ? "노배럭 더블커맨드" : coreAt9 === Infinity ? `빠른 앞마당 ${ko9}` : `앞마당 ${ko9}`;
          } else text9 = before9 <= 1 ? "첫 멀티" : `${before9}번째 멀티`;
          mile9(t9, text9);
          continue;
        }
        const n9 = hallsNow9.length + 1;
        mile9(t9, hallKind9 === "Hatchery" ? (coreAt9 === Infinity ? `노스포닝풀 ${n9}해처리` : `${n9}해처리`) : `${n9}${ko9}`);
        continue;
      }
      const t9 = TECH_MILE9[k9];
      if (t9 && !seen9.has(k9)) { seen9.add(k9); mile9(e9.born, t9); }
    }
    milesOf9.set(raw9, miles9);
    return miles9;
  };
  /** 국면 요약 — 창 끝 시각의 그 사람. */
  const phaseCap9 = (raw9: string, sec9: number): string => {
    const own9 = ownersOf9(raw9);
    const halls9: Hall9[] = []; let lastTech9 = -Infinity; let army9 = 0;
    for (const e9 of world.lives) {
      if (!own9.has(e9.owner) || e9.handoff || e9.born > sec9) continue;
      if (e9.bld) {
        if (HALL_ANY9.has(e9.kind) && (e9.died === null || e9.died > sec9)) halls9.push({ x: e9.bornX, y: e9.bornY });
        if (TECH_MILE9[e9.kind] && e9.born > lastTech9) lastTech9 = e9.born;
      } else if (e9.born >= sec9 - PHASE9.armyWin && !WORKER9.has(e9.kind) && !NON_ARMY9.has(e9.kind) && castValue9(e9.kind) > 0) army9 += 1;
    }
    /* 기지 수는 본진 건물 수가 아니라 **기지**(basesOf9 — 2026-10-10: 빨무 본진의 넥서스 셋은 1기지다). */
    const bases9 = basesOf9(halls9);
    if (sec9 - lastTech9 <= PHASE9.tech) return "순조로운 테크/발전 중";
    if (bases9 >= 3) return `${bases9}기지 운영 중`;
    if (army9 >= PHASE9.armyN) return "병력 모으는 중";
    return "순조로운 발전 중";
  };
  const cycleCaps9 = (raw9: string, t0: number, t1: number): CapPart9[] => {
    const own9 = ownersOf9(raw9);
    const lo9 = t0 - 2;
    const hi9 = Math.max(t0 + 1, t1);
    for (const [sec9, name9, o9] of world.ups) {
      if (!own9.has(o9) || sec9 < lo9 || sec9 >= hi9) continue;
      const m9 = /^(.*?)(?: (\d+))?$/.exec(name9);
      const base9 = m9?.[1] ?? name9;
      const lv9 = m9?.[2];
      return [{ raw: raw9 }, { text: ` ${researchKo(base9)}${lv9 ? ` ${lv9}단계` : ""} 개발` }];
    }
    const miles9 = buildMiles9(raw9);
    const inWin9 = miles9.find((m9) => m9.at >= lo9 && m9.at < hi9);
    if (inWin9) return inWin9.caps;
    let recent9: Mile9 | undefined;
    for (const m9 of miles9) if (m9.at < lo9 && m9.at >= lo9 - MILE_RECENT9) recent9 = m9;
    if (recent9) return recent9.caps;
    let bld9: string | null = null;
    for (const e9 of world.lives) {
      if (!e9.bld || !own9.has(e9.owner) || e9.born < lo9 || e9.born >= hi9 || e9.end === "morph") continue;
      if (!bld9 && !PLAIN_BLD9.has(e9.kind) && !HALL9.has(e9.kind) && !TECH_MILE9[e9.kind]) bld9 = e9.kind;
    }
    if (bld9) return [{ raw: raw9 }, { text: ` ${BUILDING_KO[bld9] ?? bld9} 건설` }];
    return [{ raw: raw9 }, { text: ` ${phaseCap9(raw9, hi9)}` }];
  };

  let cur9 = 0;
  for (const sc9 of scs9) {
    const at9 = Math.max(0, sc9.t0 - CAST_LEAD9);
    let tot9 = 0;
    for (const w9 of sc9.by.values()) tot9 += w9;
    if (tot9 < MIN_SCENE9) continue;      // 잔 사건은 장면이 아니다 — 순환이 그 자리를 메운다
    /* 소강이 길면 그 사이를 순환으로 채운다(요청) — 장면 바로 앞까지만. */
    if (at9 - cur9 >= IDLE9 || out9.length === 0) fill9(cur9, at9);
    /* 누구를 보여주나 — 1·2등이 엇비슷하면 ★ **서로 맞붙은 둘이면 더 많이 준 쪽**(2026-10-09, 요청: "공격이나 교전 발생시 더 잘한 사람 보여주고" — 무게
       by 는 준 것 + 잃은 것×LOSS_K9 라 엇비슷할 수 있다), 그도 같거나 맞붙은 사이가 아니면 순환 원칙(가장 오래 안 본 사람)이 가른다. */
    const rank9 = [...sc9.by.entries()].sort((a9, b9) => b9[1] - a9[1]);
    let pick9 = rank9[0][0];
    if (rank9.length > 1 && rank9[0][1] <= rank9[1][1] * TIE9) {
      const [p09, p19] = [rank9[0][0], rank9[1][0]];
      const d019 = sc9.pair.get(`${p09}>${p19}`) ?? 0;
      const d109 = sc9.pair.get(`${p19}>${p09}`) ?? 0;
      pick9 = d019 !== d109 ? (d019 > d109 ? p09 : p19) : lonely9([p09, p19]);
    }
    /* 머무는 중이면 **훨씬 무거운 장면**만 끼어든다 — 그래야 화면이 안 튄다. */
    const held9 = at9 - lastAt9() < MIN_HOLD9;
    if (!held9 || tot9 >= lastScore9() * JUMP9) { const d9 = duel9(sc9, pick9); push9(at9, pick9, sc9.why, false, tot9, d9, sceneCaps9(sc9, pick9, d9)); }
    /* 장면의 끝은 마지막 사건 + **꼬리의 남는 몫**이다 — 견제는 마지막 킬 뒤에도 쫓는 몸이 그 자리에
       있으니 그만큼 머물고, 그 사이에 순환이 끼어들지 않는다(교전은 tail = GAP9 라 종전 그대로). */
    cur9 = Math.max(cur9, sc9.t1 + (sc9.tail - GAP9));
  }
  fill9(cur9, total);
  /* ★ 순환 토막의 자막(2026-10-09) — 그 사람이 그 창(다음 토막까지)에서 한 일: 연구 완료 > 빌드 이정표(창 안 > 최근) > 그 밖의 건설 > 국면 요약(위 ★★ 빌드 읽기). */
  for (let i9 = 0; i9 < out9.length; i9 += 1) {
    const sg9 = out9[i9];
    if (sg9.caps && sg9.caps.length > 0) continue;
    sg9.caps = cycleCaps9(sg9.raw, sg9.at, i9 + 1 < out9.length ? out9[i9 + 1].at : total);
  }
  return out9;
}

/** t 에 보여줄 토막 번호 — 없으면 -1(이분 탐색). */
export function castAt9(plan: readonly CastSeg9[], t: number): number {
  let lo9 = 0;
  let hi9 = plan.length - 1;
  let at9 = -1;
  while (lo9 <= hi9) {
    const mid9 = (lo9 + hi9) >> 1;
    if (plan[mid9].at <= t) { at9 = mid9; lo9 = mid9 + 1; } else hi9 = mid9 - 1;
  }
  return at9;
}
