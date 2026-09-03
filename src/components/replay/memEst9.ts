/* 메모리 어림(요청: "메모리 모자라나 봐" → 숫자로) ───────────────────────────────────────────
 *  사파리는 힙 수치를 안 준다. 그래서 우리가 든 큰 덩어리(참값·개체·파생 자료·걷기)를 값 나무를 걸어 어림한다.
 *  자는 대략이다: 숫자 8 · 문자열 16+2/글자 · 배열 32+8/칸 · 객체 32+16/필드 · Map 48+24/항목 · 형식 배열은 바이트 그대로.
 *  같은 객체를 두 번 세지 않는다(seen) — 파생 자료가 참값 트랙을 가리키는 식의 겹침이 많다. */
export function estBytes9(v: unknown, seen: Set<object> = new Set()): number {
  if (v === null || v === undefined) return 0;
  const t = typeof v;
  if (t === "number") return 8;
  if (t === "boolean") return 4;
  if (t === "string") return 16 + (v as string).length * 2;
  if (t !== "object") return 0;
  const o = v as object;
  if (seen.has(o)) return 0;
  seen.add(o);
  if (ArrayBuffer.isView(o)) return (o as ArrayBufferView).byteLength + 40;
  if (o instanceof ArrayBuffer) return o.byteLength;
  if (o instanceof Map) {
    let n = 48;
    for (const [k, x] of o) n += 24 + estBytes9(k, seen) + estBytes9(x, seen);
    return n;
  }
  if (o instanceof Set) {
    let n = 48;
    for (const x of o) n += 16 + estBytes9(x, seen);
    return n;
  }
  if (Array.isArray(o)) {
    let n = 32 + o.length * 8;
    for (const x of o) if (typeof x === "object" && x !== null) n += estBytes9(x, seen); else if (typeof x === "string") n += estBytes9(x, seen);
    return n;
  }
  let n = 32;
  const r = o as Record<string, unknown>;
  for (const k in r) {
    if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
    n += 16 + estBytes9(r[k], seen);
  }
  return n;
}

export const mb9 = (b: number): string => `${(b / 1048576).toFixed(1)}MB`;
