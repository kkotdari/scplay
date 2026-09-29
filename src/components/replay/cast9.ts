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
 */
import { costOf } from "../../utils/bwUnits";
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
};

export type CastPlanOpts9 = {
  /** 경기 길이(초). */
  total: number;
  /** 중계에 안 세울 이름(관전자 등). */
  skip?: ReadonlySet<string>;
  /** 이 이름들만 세운다(로스터) — 안 주면 참값의 사람 전부. */
  only?: ReadonlySet<string>;
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
/** 순환 한 토막의 길이(초) — 소강에서 한 사람을 보여주는 시간.
 *  ⚠ 짧게 잡으면 **자막이 쉬지 않는다**: 이 값마다 토스트가 한 번 뜨므로 9초는 20분
 *  경기에 130번이다. 소강에 사람을 갈아타는 실제 중계 박자(10~20초)에 맞춘 값이다. */
const CYCLE9 = 14;
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

/** 한 사건 — 시각·사람·무게. */
type Ev9 = { sec: number; raw: string; w: number; why: string };

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
  /** 그 태그를 그 순간 죽인 임자 — 창 안에서 가장 많이 겨눈 적. 없으면 -1. */
  const killerOf9 = (tag9: number, sec9: number, mine9: number): number => {
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
  type D9 = { sec: number; owner: number; v: number; bld: boolean; killer: number };
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
    ds9.push({ sec: e9.died, owner: e9.owner, v: v9, bld: e9.bld, killer: killerOf9(e9.tag, e9.died, e9.owner) });
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
    const why9 = d9.bld ? "건물 파괴" : "교전";
    if (kill9) evs9.push({ sec: d9.sec, raw: kill9, w: d9.v * (d9.bld ? BLD_K9 : 1), why: why9 });
    if (mine9) evs9.push({ sec: d9.sec, raw: mine9, w: d9.v * LOSS_K9, why: d9.bld ? "건물 잃음" : "교전" });
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
  type Sc9 = { t0: number; t1: number; by: Map<string, number>; why: string };
  const scs9: Sc9[] = [];
  for (let i9 = 0; i9 < evs9.length;) {
    const sc9: Sc9 = { t0: evs9[i9].sec, t1: evs9[i9].sec, by: new Map(), why: evs9[i9].why };
    let top9 = 0;
    let j9 = i9;
    while (j9 < evs9.length && evs9[j9].sec - sc9.t1 <= GAP9 && evs9[j9].sec - sc9.t0 <= MAX_SCENE9) {
      const e9 = evs9[j9];
      sc9.t1 = e9.sec;
      sc9.by.set(e9.raw, (sc9.by.get(e9.raw) ?? 0) + e9.w);
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
  /** 가장 오래 안 보여 준 사람 — 같으면 이름 차례(같은 경기에서 늘 같은 편성이 나오게). */
  const lonely9 = (cands9: string[]): string => cands9.reduce((b9, r9) => {
    const sb9 = shown9.get(b9) ?? -1000;
    const sr9 = shown9.get(r9) ?? -1000;
    if (sr9 < sb9) return r9;
    if (sr9 > sb9) return b9;
    return r9 < b9 ? r9 : b9;
  }, cands9[0]);
  /** 한 토막을 싣는다 — 같은 사람이 이어지면 토막을 안 늘린다(갈아타는 자리가 아니다). */
  const push9 = (at9: number, raw9: string, why9: string, cyc9: boolean, score9: number): void => {
    const a9 = Math.max(0, Math.min(total, at9));
    const last9 = out9[out9.length - 1];
    if (last9 && last9.raw === raw9) {
      /* 이어지는 같은 사람 — 꼬리표만 갱신한다(장면이 순환을 이겼으면 장면 쪽으로). */
      if (!cyc9 && last9.cyc) { last9.cyc = false; last9.why = why9; last9.score = score9; }
      shown9.set(raw9, a9);
      return;
    }
    if (last9 && a9 <= last9.at) return;   // 시각이 뒤로 가는 토막은 안 싣는다
    out9.push({ at: a9, raw: raw9, why: why9, cyc: cyc9, score: score9 });
    shown9.set(raw9, a9);
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
    for (let s9 = s09; s9 < to9 - MIN_HOLD9; s9 += CYCLE9) push9(s9, lonely9(aliveAt9(s9)), "순환 중계", true, 0);
  };

  let cur9 = 0;
  for (const sc9 of scs9) {
    const at9 = Math.max(0, sc9.t0 - CAST_LEAD9);
    let tot9 = 0;
    for (const w9 of sc9.by.values()) tot9 += w9;
    if (tot9 < MIN_SCENE9) continue;      // 잔 사건은 장면이 아니다 — 순환이 그 자리를 메운다
    /* 소강이 길면 그 사이를 순환으로 채운다(요청) — 장면 바로 앞까지만. */
    if (at9 - cur9 >= IDLE9 || out9.length === 0) fill9(cur9, at9);
    /* 누구를 보여주나 — 1·2등이 엇비슷하면 순환 원칙(가장 오래 안 본 사람)이 가른다. */
    const rank9 = [...sc9.by.entries()].sort((a9, b9) => b9[1] - a9[1]);
    let pick9 = rank9[0][0];
    if (rank9.length > 1 && rank9[0][1] <= rank9[1][1] * TIE9) {
      pick9 = lonely9(rank9.slice(0, 2).map(([r9]) => r9));
    }
    /* 머무는 중이면 **훨씬 무거운 장면**만 끼어든다 — 그래야 화면이 안 튄다. */
    const held9 = at9 - lastAt9() < MIN_HOLD9;
    if (!held9 || tot9 >= lastScore9() * JUMP9) push9(at9, pick9, sc9.why, false, tot9);
    cur9 = Math.max(cur9, sc9.t1);
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
