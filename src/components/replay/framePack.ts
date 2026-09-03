/* 프레임 싸기(요청: "숫자 배열로 바꿔") ─────────────────────────────────────────────────────
 *  워커→메인의 프레임은 postMessage의 구조화 복제로 건너간다 — 유닛 op 수백 개(객체·문자열·중첩 배열)를
 *  워커가 직렬화하고 메인이 그만큼의 객체를 다시 만들며, 양쪽이 GC로 치운다(계측: 장당 300KB, 초당 14MB).
 *  여기서는 값 나무를 **Float32Array 하나 + 문자열 표**로 싼다. 배열은 transfer(소유권 이전)로 복사 없이
 *  건너가고, 메인은 **그릴 장만** 푼다(안 그린 장은 풀지도 않는다).
 *
 *  형식(float32 하나가 한 칸). 값 = [태그, 몸]:
 *    숫자 [0, v] · 참 [1] · 거짓 [2] · 문자열 [3, 표 번호] · 배열 [4, 길이, 값…] · 객체 [5, 필드 수, 필드…]
 *    undefined [6] · null [7]
 *  객체의 필드는 열쇠와 태그를 한 칸에 겹친다: [열쇠 표 번호 × 8 + 태그, 몸]. 숫자 필드 하나가 두 칸(8바이트)이다.
 *  undefined 필드는 아예 안 싣는다(있음/없음이 같으므로).
 *
 *  float32로 충분한 까닭: 자리 분수(0~1)는 1e-7 정밀도면 화소의 1/1000 아래고, z(≤ Z_AIR+수천 ≈ 1천만)·태그·
 *  표 번호 같은 정수는 2^24(1,677만)까지 정확하다. 초 단위 시각(≤ 수천)은 1e-4초 안이다. 형식 배열·Map은
 *  여기 안 온다 — 안개 판은 따로(형식 배열 그대로 transfer) 실린다. */

const T_NUM = 0;
const T_TRUE = 1;
const T_FALSE = 2;
const T_STR = 3;
const T_ARR = 4;
const T_OBJ = 5;
const T_UNDEF = 6;
const T_NULL = 7;

export type Packed9 = { buf: Float32Array; strs: string[] };

/** 쓰기 판 — 프레임마다 다시 안 만든다(모자라면 두 배로). 보낼 때는 쓴 만큼만 잘라 낸다(그 복사가 transfer 대상). */
let scratch9 = new Float32Array(1 << 16);
let n9 = 0;
const put9 = (v: number): void => {
  if (n9 >= scratch9.length) {
    const s2 = new Float32Array(scratch9.length * 2);
    s2.set(scratch9);
    scratch9 = s2;
  }
  scratch9[n9] = v;
  n9 += 1;
};

export function pack9(v: unknown): Packed9 {
  n9 = 0;
  const strs: string[] = [];
  const idx = new Map<string, number>();
  const sid = (s: string): number => {
    let i = idx.get(s);
    if (i === undefined) { i = strs.length; strs.push(s); idx.set(s, i); }
    return i;
  };
  /** 태그를 적고 몸을 잇는다. 객체 필드에서는 태그 자리에 열쇠를 겹쳐 적는다(keyBase = 열쇠 번호 × 8). */
  const enc = (x: unknown, keyBase: number): void => {
    if (typeof x === "number") { put9(keyBase + T_NUM); put9(x); }
    else if (typeof x === "boolean") put9(keyBase + (x ? T_TRUE : T_FALSE));
    else if (typeof x === "string") { put9(keyBase + T_STR); put9(sid(x)); }
    else if (x === undefined) put9(keyBase + T_UNDEF);
    else if (x === null) put9(keyBase + T_NULL);
    else if (Array.isArray(x)) { put9(keyBase + T_ARR); put9(x.length); for (const e of x) enc(e, 0); }
    else if (typeof x === "object") {
      const o = x as Record<string, unknown>;
      put9(keyBase + T_OBJ);
      const at = n9;
      put9(0);
      let cnt = 0;
      for (const k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k) || o[k] === undefined) continue;
        enc(o[k], sid(k) * 8);
        cnt += 1;
      }
      scratch9[at] = cnt;
    } else put9(keyBase + T_UNDEF);
  };
  enc(v, 0);
  return { buf: scratch9.slice(0, n9), strs };
}

export function unpack9(p: Packed9): unknown {
  const b = p.buf;
  const strs = p.strs;
  let i = 0;
  /** 태그 하나를 읽어 값을 만든다. 객체 필드는 tagCell에서 열쇠를 떼고 온다. */
  const dec = (tag: number): unknown => {
    switch (tag) {
      case T_NUM: { const v = b[i]; i += 1; return v; }
      case T_TRUE: return true;
      case T_FALSE: return false;
      case T_UNDEF: return undefined;
      case T_NULL: return null;
      case T_STR: { const s = strs[b[i]]; i += 1; return s; }
      case T_ARR: {
        const len = b[i]; i += 1;
        const a = new Array<unknown>(len);
        for (let k = 0; k < len; k += 1) { const tg = b[i]; i += 1; a[k] = dec(tg); }
        return a;
      }
      case T_OBJ: {
        const cnt = b[i]; i += 1;
        const o: Record<string, unknown> = {};
        for (let k = 0; k < cnt; k += 1) {
          const cell = b[i]; i += 1;
          const tg = cell % 8;
          o[strs[(cell - tg) / 8]] = dec(tg);
        }
        return o;
      }
      default:
        throw new Error(`unpack9: 모르는 태그 ${tag} @${i - 1}`);
    }
  };
  const tg0 = b[i]; i += 1;
  return dec(tg0);
}
