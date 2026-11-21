/* ★ 쇼츠 참값 꾸러미(2026-11-21, 요청: "쇼츠 로딩 더 아주 빠르게" → "진행해") ─────────────────────────────────────────────
   쇼츠는 경기의 20~60초만 쓰는데 재생기는 경기 **전체** 참값(OBWT — 수 MB)을 받아 풀고(decodeTruthTracks) 개체 표(truthWorld) · 워커 세계(deriveWorld9)를
   통째로 지었다. 여기서는 풀어 둔 참값(TruthTracks)을 그 구간으로 **잘라**(trimTruth) 꼴과 무관한 이진(packTruth)으로 싼다 — 서버(분석기 analyzer.mjs ·
   cli shortpack)가 쇼츠마다 한 번 굽고, 쇼츠 보기는 그 꾸러미를 풀어(decodeShortPack) 곧장 쓴다. OBWT 인코더를 따로 짓지 않는다(판이 바뀌어도 이 꼴은 그대로).
   자르기 규칙: 구간 [t0 − PAD, t1 + PAD] · 그 앞의 **마지막 상태 한 칸**은 남긴다(구간 첫 장이 이어지게) · 안개 타일(판 17)은 구간 시작의 상태를 한 묶음으로 찍고
   구간 안 변화만(밝힌 곳 · 크립이 그대로) · 연구 · 상태(판 16)는 구간 끝까지 모두(작다). 시각은 경기 절대 초 그대로라 재생기는 따로 고칠 것이 없다. */
import { TileTL17, type Bullet17, type Ticks, type TruthTrack, type TruthTracks } from "./openbwTracks";

/** 구간 앞뒤 여유(초) — 쇼츠 재생기의 종류 창(win9 ±2)과 같다. */
export const SHORT_PACK_PAD = 2;
/** 꾸러미 머리 · 판(바뀌면 서버가 다시 굽는다 — sg-api 가 시그니처에 섞는다). */
const MAGIC = 0x53504b31;   // "SPK1"
export const SHORT_PACK_VER = 1;

/* ── 자르기 ───────────────────────────────────────────────────────────────────────────────────── */

/** 짝 배열([t, v, t, v …] · Ticks) — 구간 앞 마지막 한 짝 + 구간 안. */
function pairsCarry<T extends Ticks>(a: T | undefined, A: number, B: number): T | undefined {
  if (!a || a.length === 0) return a;
  const n = a.length >> 1;
  let i0 = 0;
  for (let i = 0; i < n; i += 1) { if (a[i * 2] <= A) i0 = i; else break; }
  let i1 = i0;
  while (i1 < n && a[i1 * 2] <= B) i1 += 1;
  return a.slice(i0 * 2, Math.max(i0 + 1, i1) * 2) as T;
}
/** 평평한 k칸 줄([t, …k−1] 되풀이) — 구간 끝까지(앞쪽은 다 둔다 · 상태 계단). */
function flatUntil(a: Float64Array, k: number, B: number): Float64Array {
  let n = 0;
  while (n * k < a.length && a[n * k] <= B) n += 1;
  return a.slice(0, n * k);
}
/** 평평한 k칸 줄 — 구간 안만. */
function flatWin(a: Float64Array, k: number, A: number, B: number): Float64Array {
  const out: number[] = [];
  for (let i = 0; i + k <= a.length; i += k) if (a[i] >= A && a[i] <= B) for (let j = 0; j < k; j += 1) out.push(a[i + j]);
  return new Float64Array(out);
}
const win = <R extends [number, ...unknown[]]>(rows: R[], A: number, B: number): R[] => rows.filter((r) => r[0] >= A && r[0] <= B);
const until = <R extends [number, ...unknown[]]>(rows: R[], B: number): R[] => rows.filter((r) => r[0] <= B);
/** 열쇠마다 구간 앞 마지막 한 줄 + 구간 안(줄은 시각 차례라 본다). */
function carryBy<R extends [number, ...unknown[]]>(rows: R[], A: number, B: number, key: (r: R) => string | number): R[] {
  const last = new Map<string | number, R>();
  const out: R[] = [];
  for (const r of rows) {
    if (r[0] < A) last.set(key(r), r);
    else if (r[0] <= B) out.push(r);
  }
  return [...last.values(), ...out].sort((x, y) => x[0] - y[0]);
}
function mapPick<V>(m: Map<number, V>, keep: Set<number> | null, f: (v: V) => V): Map<number, V> {
  const out = new Map<number, V>();
  for (const [k, v] of m) if (!keep || keep.has(k)) out.set(k, f(v));
  return out;
}

/** 한 몸의 열쇠 칸을 구간으로(앞 마지막 한 칸 · 뒤 첫 한 칸 포함). */
function trimTrack(tr: TruthTrack, A: number, B: number): TruthTrack {
  const n = tr.kt.length;
  let i0 = 0;
  for (let i = 0; i < n; i += 1) { if (tr.kt[i] <= A) i0 = i; else break; }
  let i1 = n - 1;
  for (let i = i0; i < n; i += 1) { if (tr.kt[i] >= B) { i1 = i; break; } }
  const s = <T extends { slice(a: number, b: number): T }>(a: T | undefined, k = 1): T | undefined => (a ? a.slice(i0 * k, (i1 + 1) * k) : a);
  return {
    ...tr,
    kt: s(tr.kt)!, kxy: s(tr.kxy, 2)!, kh: s(tr.kh)!, kst: s(tr.kst)!, types: s(tr.types)!, done: s(tr.done)!,
    air: s(tr.air), cloak: s(tr.cloak), stim: s(tr.stim),
    hp: pairsCarry(tr.hp, A, B), ic: pairsCarry(tr.ic, A, B), tgt: pairsCarry(tr.tgt, A, B),
  };
}

/** 안개 타일(판 17) — 구간 시작의 상태(처음 값과 다른 칸만)를 A − 0.001 초 한 묶음으로 찍고 구간 안 변화를 잇는다. 밝힌 곳(exploredAtFor)은 그 묶음이 들고 간다. */
function trimTiles(tl: TileTL17, A: number, B: number): TileTL17 {
  const st = tl.stateAt(A);
  const ts: number[] = []; const ix: number[] = []; const vs: number[] = [];
  for (let k = 0; k < st.length; k += 1) if (st[k] !== 0x0000ffff) { ts.push(A - 0.001); ix.push(k); vs.push(st[k]); }
  for (let i = 0; i < tl.ts.length; i += 1) {
    const t = tl.ts[i];
    if (t <= A) continue;
    if (t > B) break;
    ts.push(t); ix.push(tl.ix[i]); vs.push(tl.vs[i]);
  }
  return new TileTL17(tl.w, tl.h, new Float64Array(ts), new Uint32Array(ix), new Uint32Array(vs));
}

/** 참값을 쇼츠 구간 [t0, t1](± PAD)으로 자른다. 시각은 그대로(경기 절대 초). */
export function trimTruth(tr: TruthTracks, t0: number, t1: number, pad = SHORT_PACK_PAD): TruthTracks {
  const A = Math.max(0, t0 - pad);
  const B = t1 + pad;
  const tracks = tr.tracks.filter((k) => k.born <= B && (k.died === null || k.died >= A)).map((k) => trimTrack(k, A, B));
  const keep = new Set(tracks.map((k) => k.tag));
  const bullets: Bullet17[] = (tr.bullets ?? []).filter((b) => b.t1 >= A - 1 && b.t0 <= B);
  return {
    ...tr,
    tracks,
    ups: until(tr.ups, B),
    casts: win(tr.casts, A - 10, B),
    pings: win(tr.pings, A, B),
    res: mapPick(tr.res, null, (rows) => carryBy(rows, A, B, () => 0)),
    apm: mapPick(tr.apm, null, (rows) => win(rows, A, B)),
    orders: mapPick(tr.orders, keep, (rows) => carryBy(rows, A, B, () => 0)),
    resFields: carryBy(tr.resFields, A, B, (r) => r[1] * 4096 + r[2]),
    builds: win(tr.builds, A - 30, B),
    sels: carryBy(tr.sels, A, B, (r) => r[1]),
    energy: mapPick(tr.energy, keep, (a) => pairsCarry(a, A, B) ?? a),
    loads: carryBy(tr.loads, A, B, (r) => r[1]),
    amounts: carryBy(tr.amounts, A, B, (r) => r[1] * 4096 + r[2]),
    kills: win(tr.kills, A, B),
    dmg: win(tr.dmg, A, B),
    gath: win(tr.gath, A, B),
    stat: mapPick(tr.stat, keep, (a) => flatUntil(a, 3, B)),
    fires: mapPick(tr.fires, keep, (a) => flatWin(a, 3, A - 2, B)),
    bullets,
    bltCols: undefined,
    tiles: tr.tiles ? trimTiles(tr.tiles, A, B) : null,
  };
}

/* ── 이진 싸기 / 풀기 — 꼴과 무관한 값 꾸러미(null · 수 · 글 · 배열 · 객체 · Map · 형식 배열 · 타일 시간축) ── */

const T_NULL = 0, T_UNDEF = 1, T_FALSE = 2, T_TRUE = 3, T_F64 = 4, T_INT = 5, T_STR = 6, T_ARR = 7, T_OBJ = 8, T_MAP = 9, T_TYPED = 10, T_TILES = 11;
const TYPED: [number, new (b: ArrayBuffer) => ArrayBufferView][] = [
  [1, Float32Array], [2, Float64Array], [3, Int16Array], [4, Uint8Array], [5, Uint16Array], [6, Int32Array], [7, Uint32Array], [8, Int8Array],
];
const typedCode = (v: ArrayBufferView): number => {
  for (const [c, C] of TYPED) if (v instanceof (C as unknown as { new(): ArrayBufferView })) return c;
  return 0;
};

class Writer {
  private b = new Uint8Array(1 << 16);
  private p = 0;
  private ensure(n: number): void {
    if (this.p + n <= this.b.length) return;
    let cap = this.b.length * 2;
    while (cap < this.p + n) cap *= 2;
    const nb = new Uint8Array(cap); nb.set(this.b.subarray(0, this.p)); this.b = nb;
  }
  u8(v: number): void { this.ensure(1); this.b[this.p++] = v; }
  uv(v: number): void { this.ensure(10); while (v >= 0x80) { this.b[this.p++] = (v & 0x7f) | 0x80; v = Math.floor(v / 128); } this.b[this.p++] = v; }
  f64(v: number): void { this.ensure(8); new DataView(this.b.buffer).setFloat64(this.p, v, true); this.p += 8; }
  bytes(u: Uint8Array): void { this.ensure(u.length); this.b.set(u, this.p); this.p += u.length; }
  out(): Uint8Array { return this.b.slice(0, this.p); }
}
const enc = new TextEncoder();

function put(w: Writer, v: unknown): void {
  if (v === null) { w.u8(T_NULL); return; }
  if (v === undefined) { w.u8(T_UNDEF); return; }
  if (v === false) { w.u8(T_FALSE); return; }
  if (v === true) { w.u8(T_TRUE); return; }
  if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) < 2 ** 31) { w.u8(T_INT); w.uv(v < 0 ? -2 * v - 1 : 2 * v); return; }
    w.u8(T_F64); w.f64(v); return;
  }
  if (typeof v === "string") { const u = enc.encode(v); w.u8(T_STR); w.uv(u.length); w.bytes(u); return; }
  if (v instanceof TileTL17) { w.u8(T_TILES); put(w, { w: v.w, h: v.h, ts: v.ts, ix: v.ix, vs: v.vs }); return; }
  if (ArrayBuffer.isView(v)) {
    const c = typedCode(v);
    if (!c) throw new Error("모르는 형식 배열");
    w.u8(T_TYPED); w.u8(c); w.uv(v.byteLength); w.bytes(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    return;
  }
  if (Array.isArray(v)) { w.u8(T_ARR); w.uv(v.length); for (const x of v) put(w, x); return; }
  if (v instanceof Map) { w.u8(T_MAP); w.uv(v.size); for (const [k, x] of v) { put(w, k); put(w, x); } return; }
  if (typeof v === "object") {
    const ks = Object.keys(v as Record<string, unknown>).filter((k) => (v as Record<string, unknown>)[k] !== undefined);
    w.u8(T_OBJ); w.uv(ks.length);
    for (const k of ks) { put(w, k); put(w, (v as Record<string, unknown>)[k]); }
    return;
  }
  throw new Error(`쌀 수 없는 값: ${typeof v}`);
}

class Reader {
  private p = 0;
  private readonly b: Uint8Array;
  private readonly dv: DataView;
  constructor(b: Uint8Array) { this.b = b; this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength); }
  u8(): number { return this.b[this.p++]; }
  uv(): number { let v = 0; let m = 1; for (;;) { const c = this.b[this.p++]; v += (c & 0x7f) * m; if (!(c & 0x80)) break; m *= 128; } return v; }
  f64(): number { const v = this.dv.getFloat64(this.p, true); this.p += 8; return v; }
  take(n: number): Uint8Array { const u = this.b.slice(this.p, this.p + n); this.p += n; return u; }
}
const dec = new TextDecoder();

function get(r: Reader): unknown {
  const t = r.u8();
  switch (t) {
    case T_NULL: return null;
    case T_UNDEF: return undefined;
    case T_FALSE: return false;
    case T_TRUE: return true;
    case T_INT: { const z = r.uv(); return z % 2 ? -(z + 1) / 2 : z / 2; }
    case T_F64: return r.f64();
    case T_STR: return dec.decode(r.take(r.uv()));
    case T_ARR: { const n = r.uv(); const a = new Array(n); for (let i = 0; i < n; i += 1) a[i] = get(r); return a; }
    case T_MAP: { const n = r.uv(); const m = new Map(); for (let i = 0; i < n; i += 1) { const k = get(r); m.set(k, get(r)); } return m; }
    case T_OBJ: { const n = r.uv(); const o: Record<string, unknown> = {}; for (let i = 0; i < n; i += 1) { const k = get(r) as string; o[k] = get(r); } return o; }
    case T_TYPED: {
      const c = r.u8(); const n = r.uv(); const u = r.take(n);
      const C = TYPED.find((x) => x[0] === c)?.[1];
      if (!C) throw new Error("모르는 형식 배열");
      return new C(u.buffer);
    }
    case T_TILES: return TileTL17.revive(get(r) as { w: number; h: number; ts: Float64Array; ix: Uint32Array; vs: Uint32Array });
    default: throw new Error(`꾸러미가 깨졌다(${t})`);
  }
}

/** 참값 → 이진(머리 SPK1 · 판 · 값). 압축은 부르는 쪽이(서버 zlib · 아래 decodeShortPack 은 deflate 를 푼다). */
export function packTruth(tr: TruthTracks): Uint8Array {
  const w = new Writer();
  w.f64(MAGIC); w.u8(SHORT_PACK_VER);
  put(w, tr);
  return w.out();
}
/** 이진 → 참값(머리가 다르면 null). */
export function unpackTruth(bytes: Uint8Array): TruthTracks | null {
  const r = new Reader(bytes);
  if (r.f64() !== MAGIC || r.u8() !== SHORT_PACK_VER) return null;
  const tr = get(r) as TruthTracks;
  return tr && Array.isArray(tr.tracks) ? tr : null;
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
/** 쇼츠 꾸러미(base64 · zlib) → 참값. 브라우저(DecompressionStream)에서 푼다. 못 풀면 null(부르는 쪽이 경기 전체 참값으로 물러난다). */
export async function decodeShortPack(b64: string): Promise<TruthTracks | null> {
  try {
    const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
    if (!DS) return null;
    const stream = new Blob([fromB64(b64) as BlobPart]).stream().pipeThrough(new DS("deflate"));
    return unpackTruth(new Uint8Array(await new Response(stream).arrayBuffer()));
  } catch {
    return null;
  }
}
