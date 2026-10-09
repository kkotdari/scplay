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
};
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
  const aim9 = new Map<number, number[]>();
  if (vics9.size > 0) {
    for (const e9 of world.lives) {
      const tg9 = e9.tgt;
      if (!tg9) continue;
      const n9 = tkN(tg9);
      for (let i9 = 0; i9 < n9; i9 += 1) {
        const tag9 = tkV(tg9, i9);
        if (!tag9 || !vics9.has(tag9)) continue;
        const a9 = aim9.get(tag9);
        if (a9) a9.push(tkT(tg9, i9), e9.owner);
        else aim9.set(tag9, [tkT(tg9, i9), e9.owner]);
      }
    }
  }
  /** ★ 처치 절(판 11 · [초, 킬러 임자, 킬러 태그, 죽은 태그])이 있으면 그것이 먼저다 — 겨눔 자국은 어림이고 이것은
   *  시뮬이 적은 참값이다(맞대결의 상대역도 이것으로 선다). 같은 태그가 변태로 여러 생애를 가지므로 초로 짝짓는다. */
  const killBy9 = new Map<number, number[]>();
  for (const [ks9, ko9, , kd9] of world.kills ?? []) {
    const a9 = killBy9.get(kd9);
    if (a9) a9.push(ks9, ko9); else killBy9.set(kd9, [ks9, ko9]);
  }
  /** 그 태그를 그 순간 죽인 임자 — 처치 절, 없으면 창 안에서 가장 많이 겨눈 적. 없으면 -1. */
  const killerOf9 = (tag9: number, sec9: number, mine9: number): number => {
    const k9 = killBy9.get(tag9);
    if (k9) for (let i9 = 0; i9 < k9.length; i9 += 2) {
      if (Math.abs(k9[i9] - sec9) <= 1 && k9[i9 + 1] !== mine9) return k9[i9 + 1];
    }
    const a9 = aim9.get(tag9);
    if (!a9) return -1;
    let best9 = -1;
    let bn9 = 0;
    for (let i9 = 0; i9 < a9.length; i9 += 2) {
      const s9 = a9[i9];
      const o9 = a9[i9 + 1];
      if (s9 < sec9 - KILL_W9 || s9 > sec9 + 0.5 || o9 === mine9) continue;
      let n9 = 0;
      for (let j9 = 1; j9 < a9.length; j9 += 2) {
        if (a9[j9] !== o9) continue;
        const sj9 = a9[j9 - 1];
        if (sj9 >= sec9 - KILL_W9 && sj9 <= sec9 + 0.5) n9 += 1;
      }
      if (n9 > bn9) { best9 = o9; bn9 = n9; }
    }
    return best9;
  };

  /** 죽음 한 벌 — 한꺼번에 사라지는 '나감'을 걸러 내려고 먼저 모은다. */
  type D9 = { sec: number; owner: number; v: number; bld: boolean; killer: number; wk: boolean; x?: number; y?: number };
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
    const wk9 = !e9.bld && unitOf(e9.kind).worker;
    const at9 = deadAt9(e9, e9.died);
    ds9.push({ sec: e9.died, owner: e9.owner, v: wk9 ? v9 * HARASS9.k : v9, bld: e9.bld, wk: wk9,
      killer: killerOf9(e9.tag, e9.died, e9.owner), ...(at9 ?? {}) });
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
    const why9 = d9.bld ? "건물 파괴" : d9.wk ? "견제" : "교전";
    const tail9 = d9.wk ? HARASS9.tail : undefined;
    if (kill9) evs9.push({ sec: d9.sec, raw: kill9, w: d9.v * (d9.bld ? BLD_K9 : 1), why: why9, tail: tail9,
      vs: mine9, dealt: d9.v });
    if (mine9) evs9.push({ sec: d9.sec, raw: mine9, w: d9.v * LOSS_K9, why: d9.bld ? "건물 잃음" : d9.wk ? "견제 당함" : "교전", tail: tail9,
      vs: kill9, econ: d9.bld || d9.wk ? d9.v : 0, x: d9.x, y: d9.y });
  }
  for (const [sec9, , , tech9, own9] of world.casts) {
    const w9 = CAST_W9[tech9];
    if (!w9) continue;
    const r9 = rawOf9.get(own9);
    if (!r9 || sec9 > total - 3) continue;
    evs9.push({ sec: sec9, raw: r9, w: w9, why: tech9 === "Nuclear Strike" ? "핵" : "마법" });
  }
  evs9.sort((a9, b9) => a9.sec - b9.sec);

  /* ── 장면으로 묶기 ────────────────────────────────────────────────────────── */
  type Sc9 = { t0: number; t1: number; by: Map<string, number>; why: string; tail: number;
    /** "a>b" → a 가 b 에게 준 몸값 · 사람 → 잃은 살림 값(맞대결의 자 — 아래 duel9). */
    pair: Map<string, number>; econ: Map<string, number>;
    /** 잃은 자리들 [사람, x, y, 몸값] — 싸움터가 누구 진영인가(duel9). */
    locs: [string, number, number, number][] };
  const scs9: Sc9[] = [];
  for (let i9 = 0; i9 < evs9.length;) {
    const sc9: Sc9 = { t0: evs9[i9].sec, t1: evs9[i9].sec, by: new Map(), why: evs9[i9].why, tail: GAP9,
      pair: new Map(), econ: new Map(), locs: [] };
    let top9 = 0;
    let j9 = i9;
    /* 다음 사건이 **앞 사건의 꼬리**(견제면 HARASS9.tail · 그 밖은 GAP9) 안이면 같은 장면이다. */
    while (j9 < evs9.length && evs9[j9].sec - sc9.t1 <= sc9.tail && evs9[j9].sec - sc9.t0 <= MAX_SCENE9) {
      const e9 = evs9[j9];
      sc9.t1 = e9.sec;
      sc9.tail = e9.tail ?? GAP9;
      sc9.by.set(e9.raw, (sc9.by.get(e9.raw) ?? 0) + e9.w);
      if (e9.vs && e9.dealt) sc9.pair.set(`${e9.raw}>${e9.vs}`, (sc9.pair.get(`${e9.raw}>${e9.vs}`) ?? 0) + e9.dealt);
      if (e9.econ) sc9.econ.set(e9.raw, (sc9.econ.get(e9.raw) ?? 0) + e9.econ);
      if (e9.x !== undefined && e9.y !== undefined && e9.vs) sc9.locs.push([e9.raw, e9.x, e9.y, e9.dealt ?? e9.w / LOSS_K9]);
      /* 꼬리표는 그 장면에서 **가장 무거운 사건**의 것이다 — 핵 한 발이 든 교전은 '핵'이다. */
      if (e9.w > top9) { top9 = e9.w; sc9.why = e9.why; }
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
  const push9 = (at9: number, raw9: string, why9: string, cyc9: boolean, score9: number, duel9?: Duel9): void => {
    const a9 = Math.max(0, Math.min(total, at9));
    ringPos9 = ring9.indexOf(raw9);
    const last9 = out9[out9.length - 1];
    /* 이어지는 같은 사람 — 꼬리표만 갱신한다(장면이 순환을 이겼으면 장면 쪽으로). 맞대결은 **상대역까지 같아야** 잇는다
       — 상대가 바뀌거나 맞대결이 끝난 뒤의 순환이면 새 토막이다(안 그러면 맞대결이 순환 내내 남는다). */
    if (last9 && last9.raw === raw9 && (!last9.foe || a9 >= (last9.foeTo ?? 0)) && !duel9) {
      if (!cyc9 && last9.cyc) { last9.cyc = false; last9.why = why9; last9.score = score9; }
      shown9.set(raw9, a9);
      return;
    }
    if (last9 && last9.raw === raw9 && duel9 && last9.foe === duel9.foe) {
      last9.foeTo = Math.max(last9.foeTo ?? 0, duel9.foeTo);
      if (!cyc9) { last9.cyc = false; last9.why = why9; last9.score = Math.max(last9.score, score9); last9.role = duel9.role; }
      shown9.set(raw9, a9);
      return;
    }
    if (last9 && a9 <= last9.at) return;   // 시각이 뒤로 가는 토막은 안 싣는다
    out9.push({ at: a9, raw: raw9, why: why9, cyc: cyc9, score: score9, ...(duel9 ?? {}) });   // duel9 의 foes·allies 도 함께 실린다
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
    const turf9 = turf9Of(sc9, pick9, foe9);
    if (turf9 !== null) role9 = turf9 >= TURF9.home ? "def" : turf9 <= 1 - TURF9.home ? "atk" : "war";
    if (turf9 === null || role9 === "war") {
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
    if (!held9 || tot9 >= lastScore9() * JUMP9) push9(at9, pick9, sc9.why, false, tot9, duel9(sc9, pick9));
    /* 장면의 끝은 마지막 사건 + **꼬리의 남는 몫**이다 — 견제는 마지막 킬 뒤에도 쫓는 몸이 그 자리에
       있으니 그만큼 머물고, 그 사이에 순환이 끼어들지 않는다(교전은 tail = GAP9 라 종전 그대로). */
    cur9 = Math.max(cur9, sc9.t1 + (sc9.tail - GAP9));
  }
  fill9(cur9, total);
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
