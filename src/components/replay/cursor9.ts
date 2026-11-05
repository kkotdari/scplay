/* ★ 선수 마우스 커서 시뮬레이션(2026-11-04) — 붓(ReplayMotionPlayer · DOM 커서 · 칸 판)과 엔진(engine9 · 커서에 붙어 가는 건설 고스트)이 **한 경로**를 본다.
 *  리플레이엔 마우스 자리가 없고 누른 자리만 남는다 — 사람마다 들르는 점 [초, x, y(타일), 꼴, 반지름(타일)] 다섯씩(평평한 배열 · 오름차순).
 *  재료: 명령 클릭(lives.orders) · 건설 자리(builds) · 마법 표적(casts) · 마우스 선택(sels 의 click · add — 하나면 그 몸 위 · 여럿이면 끌어 고르기).
 *  **키보드는 안 움직인다** — sels 의 recall · assign · groupAdd 와 자리 없는 단축키 명령(정지 · 홀드 · 생산)은 들르는 점이 아니다.
 *  기록은 docs/notes/player-ui.md '선수 마우스 커서 시뮬레이션'. */
import { posAtTruth, SEL_KIND9, type TruthTrack } from "../../utils/openbwTracks";
import { BUILDING_FOOT } from "../../utils/bwUnits";

/** 들르는 점의 꼴 — 땅(화살표) · 제 편 · 적 · 자원 몸 위(고리) · 끌기 시작 · 끌기 끝(상자). */
export const CUR_GROUND9 = 0;
export const CUR_OWN9 = 1;
export const CUR_FOE9 = 2;
export const CUR_RES9 = 3;
export const CUR_DRAG09 = 4;
export const CUR_DRAG19 = 5;
/** 건설 고스트가 커서에 붙어 가는 시간(초) — 건설 자리에 닿기 이만큼 전부터 커서를 따라간다(engine9 ghosts 그리기 · 붓 칸 판). */
export const CUR_CARRY_SEC9 = 0.45;
/** 화살촉(시안 승인) — 끝(0,0)이 왼위 · 왼 아래 · 안쪽 파임 · 오른 아래(viewBox −2~30). */
export const CUR_ARROW_D9 = "M1 1 L0.4 26 L7 17.4 L27.2 27 Z";

export type CursorSrc9 = {
  players: readonly { owner: number; name: string }[];
  lives: readonly { tag: number; owner: number; orders: readonly (readonly [number, number, number, ...unknown[]])[] }[];
  builds?: readonly (readonly [number, number, number, number, number, string])[];
  casts?: readonly (readonly [number, number, number, string, number])[];
  sels?: readonly (readonly [number, number, readonly number[], number])[];
};
/** ★ 마우스 고르기(click · add)만 — **더함(add)은 새로 든 몸만**(2026-11-05, 지적: "A 무리를 집은 상태에서 쉬프트 누르고 다른 쪽에서 B 무리를 선택하는 경우
 *  A~B 전체를 상자 선택하고 있는 거 같아 · 너무 넓은 말도 안 되는 상자") — 판 10 선택 절은 그 명령 **뒤의 선택 전체**를 싣는다(덤퍼가 ShiftSelect 를 풀어 준다).
 *  그래서 더함을 그대로 감싸면 A+B 를 다 덮었다. 사람마다 앞 선택(모든 갈래 — 키보드 불러오기 · 지정도 선택을 바꾼다)을 기억해 그 밖의 몸만 남긴다.
 *  새로 든 몸이 없으면(시프트로 빼기 등) 들르는 점이 아니다. */
function mouseSels9(sels: readonly (readonly [number, number, readonly number[], number])[]): [number, number, readonly number[]][] {
  const prev9 = new Map<number, ReadonlySet<number>>();
  const out9: [number, number, readonly number[]][] = [];
  for (const [ss9, so9, stg9, sk9] of sels) {
    const k9 = sk9 < 0 ? -1 : sk9 & 15;
    const was9 = prev9.get(so9);
    prev9.set(so9, new Set(stg9));
    if (k9 === SEL_KIND9.click) out9.push([ss9, so9, stg9]);
    else if (k9 === SEL_KIND9.add) {
      const nw9 = was9 ? stg9.filter((tg9) => !was9.has(tg9)) : stg9;
      if (nw9.length > 0) out9.push([ss9, so9, nw9]);
    }
  }
  return out9;
}
/** ★ 선택 자리(워커가 짓는다 · 메인은 트랙이 없다) — sels 마다 [초, 임자, 잡힌 수, 왼위 x·y, 오른아래 x·y, 무게 중심 x·y, 첫 태그] 열 칸. 마우스 고르기(click · add)만. */
export function selPtsOf9(sels: readonly (readonly [number, number, readonly number[], number])[], tracks: ReadonlyMap<number, TruthTrack>): Float64Array {
  const out9: number[] = [];
  for (const [ss9, so9, stg9] of mouseSels9(sels)) {
    let n9 = 0; let sx9 = 0; let sy9 = 0; let x09 = Infinity; let y09 = Infinity; let x19 = -Infinity; let y19 = -Infinity; let first9 = 0;
    for (const tg9 of stg9) {
      const tr9 = tracks.get(tg9); const q9 = tr9 ? posAtTruth(tr9, ss9) : null;
      if (!q9) continue;
      if (n9 === 0) first9 = tg9;
      n9 += 1; sx9 += q9.x; sy9 += q9.y;
      x09 = Math.min(x09, q9.x); y09 = Math.min(y09, q9.y); x19 = Math.max(x19, q9.x); y19 = Math.max(y19, q9.y);
    }
    if (n9 > 0) out9.push(ss9, so9, n9, x09, y09, x19, y19, sx9 / n9, sy9 / n9, first9);
  }
  return Float64Array.from(out9);
}
export type CursorOpts9 = {
  /** 안 그릴 사람(관전자). */
  skip?: (raw: string) => boolean;
  /** 명령 클릭의 꼴 · 반지름(표적 몸 · 자원) — 없으면 땅. */
  clickKind?: (raw: string, t: number, x: number, y: number) => readonly [number, number] | null;
  /** 하나 고른 몸의 꼴 · 반지름 — 없으면 제 편 · 0.75. */
  selKind?: (raw: string, tag: number) => readonly [number, number];
  /** 선택 자리(selPtsOf9 · 워커가 지은 것) — 있으면 트랙 대신 이것을 쓴다. */
  selPts?: Float64Array | null;
};

/** 사람마다 들르는 점(위 ★). */
export function cursorPathsOf9(src: CursorSrc9, tracks: ReadonlyMap<number, TruthTrack> | null, o: CursorOpts9 = {}): Map<string, Float64Array> {
  const nameOfId9 = new Map(src.players.map((pl) => [pl.owner, pl.name]));
  const acc9 = new Map<string, number[][]>();
  const put9 = (raw9: string, s9: number, x9: number, y9: number, k9: number, r9: number): void => {
    if (!raw9 || (o.skip && o.skip(raw9)) || !Number.isFinite(x9) || !Number.isFinite(y9)) return;
    const a9 = acc9.get(raw9); if (a9) a9.push([s9, x9, y9, k9, r9]); else acc9.set(raw9, [[s9, x9, y9, k9, r9]]);
  };
  const seen9 = new Set<string>();
  for (const e9 of src.lives) {
    if (e9.tag < 0) continue;
    const raw9 = nameOfId9.get(e9.owner) ?? "";
    if (!raw9) continue;
    for (const od9 of e9.orders) {
      const key9 = `${e9.owner}:${od9[0]}:${od9[1]}:${od9[2]}`;
      if (seen9.has(key9)) continue;
      seen9.add(key9);
      const kr9 = o.clickKind ? o.clickKind(raw9, od9[0], od9[1], od9[2]) : null;
      put9(raw9, od9[0], od9[1], od9[2], kr9 ? kr9[0] : CUR_GROUND9, kr9 ? kr9[1] : 0);
    }
  }
  for (const [bs9, bo9, , btx9, bty9, bk9] of src.builds ?? []) {
    const ft9 = BUILDING_FOOT[bk9] ?? [2, 2];
    put9(nameOfId9.get(bo9) ?? "", bs9, btx9 + ft9[0] / 2, bty9 + ft9[1] / 2, CUR_GROUND9, 0);
  }
  for (const [cs9, cx9, cy9, , co9] of src.casts ?? []) put9(nameOfId9.get(co9) ?? "", cs9, cx9, cy9, CUR_GROUND9, 0);
  /** 고른 몸들 → 들르는 점(하나면 그 몸 위 · 여럿이면 끌어 고르기). */
  const putSel9 = (raw9: string, ss9: number, n9: number, x09: number, y09: number, x19: number, y19: number, cx9: number, cy9: number, tg9: number): void => {
    if (n9 === 1) {
      const kr9 = o.selKind ? o.selKind(raw9, tg9) : [CUR_OWN9, 0.75] as const;
      put9(raw9, ss9, cx9, cy9, kr9[0], kr9[1]);
      return;
    }
    const ax9 = x09 - 0.7; const ay9 = y09 - 0.7; const bx9 = x19 + 0.7; const by9 = y19 + 0.7;
    const dd9 = Math.min(0.45, Math.max(0.2, 0.18 + Math.hypot(bx9 - ax9, by9 - ay9) * 0.02));
    put9(raw9, ss9 - dd9, ax9, ay9, CUR_DRAG09, 0);
    put9(raw9, ss9, bx9, by9, CUR_DRAG19, 0);
  };
  if (o.selPts) {
    const sp9 = o.selPts;
    for (let i9 = 0; i9 + 9 < sp9.length; i9 += 10) {
      putSel9(nameOfId9.get(sp9[i9 + 1]) ?? "", sp9[i9], sp9[i9 + 2], sp9[i9 + 3], sp9[i9 + 4], sp9[i9 + 5], sp9[i9 + 6], sp9[i9 + 7], sp9[i9 + 8], sp9[i9 + 9]);
    }
  } else if (tracks) {
    for (const [ss9, so9, stg9] of mouseSels9(src.sels ?? [])) {   // 키보드(불러오기 · 지정 · 추가)는 안 움직인다 · 더함은 새로 든 몸만(위 mouseSels9)
      const raw9 = nameOfId9.get(so9) ?? "";
      const pts9: [number, number, number][] = [];
      for (const tg9 of stg9) {
        const tr9 = tracks.get(tg9); const q9 = tr9 ? posAtTruth(tr9, ss9) : null;
        if (q9) pts9.push([q9.x, q9.y, tg9]);
      }
      if (pts9.length === 0) continue;
      if (pts9.length === 1) {
        const kr9 = o.selKind ? o.selKind(raw9, pts9[0][2]) : [CUR_OWN9, 0.75] as const;
        put9(raw9, ss9, pts9[0][0], pts9[0][1], kr9[0], kr9[1]);
        continue;
      }
      /* 여럿 — 끌어 고르기(리플레이엔 클릭 · 끌기 구분이 없다 · 한 번에 여럿이 잡혔으면 끈 것으로 본다). 감싼 네모(+0.7타일)의 왼위 → 오른아래로. */
      let x09 = Infinity; let y09 = Infinity; let x19 = -Infinity; let y19 = -Infinity;
      for (const [px9, py9] of pts9) { x09 = Math.min(x09, px9); y09 = Math.min(y09, py9); x19 = Math.max(x19, px9); y19 = Math.max(y19, py9); }
      x09 -= 0.7; y09 -= 0.7; x19 += 0.7; y19 += 0.7;
      const dd9 = Math.min(0.45, Math.max(0.2, 0.18 + Math.hypot(x19 - x09, y19 - y09) * 0.02));
      put9(raw9, ss9 - dd9, x09, y09, CUR_DRAG09, 0);
      put9(raw9, ss9, x19, y19, CUR_DRAG19, 0);
    }
  }
  const out9 = new Map<string, Float64Array>();
  for (const [raw9, a9] of acc9) {
    a9.sort((p, q) => p[0] - q[0]);
    const f9: number[] = [];
    for (const [s9, x9, y9, k9, r9] of a9) {
      const n9 = f9.length;
      if (n9 >= 5 && s9 - f9[n9 - 5] < 0.02 && Math.hypot(x9 - f9[n9 - 4], y9 - f9[n9 - 3]) < 0.5 && k9 !== CUR_DRAG19) continue;   // 같은 누름이 두 갈래로 적힌 것
      f9.push(s9, x9, y9, k9, r9);
    }
    out9.set(raw9, Float64Array.from(f9));
  }
  return out9;
}

export type CursorAt9 = { x: number; y: number; press: boolean; ring: { x: number; y: number; k: number; r: number } | null; box: [number, number] | null };
/** ★ t 의 커서 — 첫 점 전은 null. 다음 점 직전(거리에 따라 0.15~0.45초 · 두 점 사이의 80% 안)에 출발해 그 시각에 정확히 닿는다(천천히 출발 · 빨리 · 천천히 닿음).
 *  그 전에는 마지막 점에 머문다. 끌기(시작 → 끝)는 두 점 사이 전부를 고르게 끌고 상자(box · 시작 모서리)를 낸다. 몸 위 점(고리 꼴)은 닿기 직전 20% 부터
 *  떠나기 전(최대 0.6초)까지 고리(ring). press 는 누른 직후 0.12초. */
export function cursorAt9(p9: Float64Array, t9: number): CursorAt9 | null {
  const S9 = 5;
  const n9 = p9.length / S9;
  if (n9 === 0 || t9 < p9[0]) return null;
  let lo = 0; let hi = n9 - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (p9[m * S9] <= t9) lo = m; else hi = m - 1; }
  const o0 = lo * S9;
  const s0 = p9[o0]; const x0 = p9[o0 + 1]; const y0 = p9[o0 + 2]; const k0 = p9[o0 + 3]; const r0 = p9[o0 + 4];
  const press = t9 - s0 < 0.12 && k0 !== CUR_DRAG09;
  const ringK0 = k0 === CUR_OWN9 || k0 === CUR_FOE9 || k0 === CUR_RES9;
  const stay9: CursorAt9 = { x: x0, y: y0, press, ring: ringK0 && t9 - s0 < 0.6 ? { x: x0, y: y0, k: k0, r: r0 } : null, box: null };
  if (lo + 1 >= n9) return stay9;
  const o1 = o0 + S9;
  const s1 = p9[o1]; const x1 = p9[o1 + 1]; const y1 = p9[o1 + 2]; const k1 = p9[o1 + 3]; const r1 = p9[o1 + 4];
  if (k0 === CUR_DRAG09 && k1 === CUR_DRAG19) {
    const u9 = Math.min(1, Math.max(0, (t9 - s0) / Math.max(0.01, s1 - s0)));
    return { x: x0 + (x1 - x0) * u9, y: y0 + (y1 - y0) * u9, press: false, ring: null, box: [x0, y0] };
  }
  const d9 = Math.hypot(x1 - x0, y1 - y0);
  const tr9 = Math.min(Math.max(0.15, Math.min(0.45, 0.12 + d9 * 0.012)), (s1 - s0) * 0.8);
  if (tr9 <= 0 || t9 <= s1 - tr9) return stay9;
  const u9 = Math.min(1, (t9 - (s1 - tr9)) / tr9);
  const e9 = u9 < 0.5 ? 4 * u9 * u9 * u9 : 1 - Math.pow(-2 * u9 + 2, 3) / 2;
  const ringK1 = k1 === CUR_OWN9 || k1 === CUR_FOE9 || k1 === CUR_RES9;
  return { x: x0 + (x1 - x0) * e9, y: y0 + (y1 - y0) * e9, press, ring: ringK1 && u9 > 0.8 ? { x: x1, y: y1, k: k1, r: r1 } : null, box: null };
}
