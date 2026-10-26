/* ★ 분당 곡선 — 참값 트랙(OBWT)에서 사람마다 1분 간격으로 일꾼 수 · 인구 · 자원 · 데미지, 그리고 건물 생애 · 테크 첫 완성을 뽑는다
   (2026-10-26, sg-api domain/game_results/series.py 에서 옮김 · 요청: "그래프 계산 분석기 안으로" — 서버의 분석기(analyzer.mjs curves)가 부른다).
   꼴과 셈은 옮기기 전과 **한 값도 다르지 않게** 적었다(파이썬 round 의 짝수 반올림까지 · 옛 판과 견준 실측은 docs/notes/engine.md '분석기').
   읽는 절은 머리 · 로스터 · 트랙표 · 키 흐름 · 자원 · (판 13+) 데미지 · (판 14+) 채집뿐이다 — 체력·표적·업그레이드… 뒤 절은 건너뛴다.
   꼴이 낯설면 null(던지지 않는다 — 굽기를 막지 않게). 재생기 해독기(utils/openbwTracks.ts)와 같은 꼴을 읽는다. */

const TRUTH_VER_MIN = 11;
const TRUTH_VER_MAX = 14;
const ST_GONE = 3;
const NEUTRAL = 11;
/** 분당 곡선 끝(옛 40 — 데이터창은 게임 끝까지 본다). */
const MAX_MINUTES = 120;

/** SCV · 드론 · 프로브. */
const WORKERS = new Set([7, 41, 64]);
/** 테크 건물 — 종류별 첫 한 채의 짓기 시작 · 다 지은 때. 보급·가스·본진·방어 건물은 뺀다. 애드온은 센다. */
const TECH = new Set([
  111, 112, 113, 114, 116, 122, 123, 107, 108, 115, 117, 118, 120,
  142, 132, 133, 135, 139, 141, 137, 138, 136, 140, 134,
  160, 166, 164, 163, 165, 155, 171, 159, 167, 169, 170,
]);
/** 건물 — 테크 + 본진 · 보급 · 가스 · 방어. */
const BUILDINGS = new Set([...TECH,
  106, 109, 110, 124, 125,
  130, 131, 143, 144, 146, 149,
  154, 156, 157, 162, 172,
]);
/** 인구 = 원작 내부 단위(화면 값 × 2). 짓는 중인 몸도 센다. */
const SUPPLY: Record<number, number> = {
  0: 2, 1: 2, 2: 4, 3: 4, 5: 4, 7: 2, 8: 4, 9: 4, 11: 4, 12: 12, 30: 4, 32: 2, 34: 2, 58: 6,
  37: 1, 38: 2, 39: 8, 41: 2, 43: 4, 44: 4, 45: 4, 46: 4, 47: 1, 50: 2, 62: 4, 103: 4,
  60: 4, 61: 4, 63: 8, 64: 2, 65: 4, 66: 4, 67: 4, 68: 8, 69: 4, 70: 6, 71: 8, 72: 12, 83: 8, 84: 2,
};
const sup = (t: number): number => SUPPLY[t] ?? 0;

/** 파이썬 round — 반은 짝수로(옮기기 전 값과 같게). */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

class Short extends Error {}

class Cur {
  p = 0;
  private dv: DataView;
  constructor(public b: Uint8Array) { this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength); }
  at(i: number): number { if (i >= this.b.length) throw new Short(); return this.b[i]; }
  u8(): number { const v = this.at(this.p); this.p += 1; return v; }
  u16(): number { if (this.p + 2 > this.b.length) throw new Short(); const v = this.dv.getUint16(this.p, true); this.p += 2; return v; }
  u32(): number { if (this.p + 4 > this.b.length) throw new Short(); const v = this.dv.getUint32(this.p, true); this.p += 4; return v; }
  i32(): number { if (this.p + 4 > this.b.length) throw new Short(); const v = this.dv.getInt32(this.p, true); this.p += 4; return v; }
  f32(): number { if (this.p + 4 > this.b.length) throw new Short(); const v = this.dv.getFloat32(this.p, true); this.p += 4; return v; }
  /** zigzag varint. */
  varint(): number {
    let z = 0;
    let mul = 1;
    for (;;) {
      const ch = this.u8();
      z += (ch & 0x7f) * mul;
      if (!(ch & 0x80)) break;
      mul *= 128;
    }
    return z % 2 === 1 ? -(z + 1) / 2 : z / 2;
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 저장된 꼴(base64 글자) · 압축 이진 · 푼 이진 셋을 다 받는다. */
async function rawOf(data: string | Uint8Array): Promise<Uint8Array | null> {
  let b: Uint8Array = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const isObwt = (x: Uint8Array): boolean => x[0] === 0x4f && x[1] === 0x42 && x[2] === 0x57 && x[3] === 0x54;
  if (isObwt(b)) return b;
  if (b[0] !== 0x78) {
    try {
      const s = typeof data === "string" ? data : new TextDecoder("latin1").decode(b);
      const bin = atob(s.replace(/[^A-Za-z0-9+/=]/g, ""));
      b = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) b[i] = bin.charCodeAt(i);
    } catch {
      return null;
    }
  }
  try {
    return await inflate(b);
  } catch {
    return null;
  }
}

type Key = [number, number, boolean];   // (프레임, 종류, 다 지어졌나)
type Own = [number, number];   // (프레임, 새 임자)
type Life = { owner: number; keys: Key[]; died: number | null; own: Own[] };
type Pos = [number, number, number];

interface Parsed {
  fps: number;
  names: Map<number, string>;
  colors: Map<number, string | null>;
  lives: Life[];
  endFrame: number;
  bank: Map<number, [number, number, number][]>;
  poses: Pos[][];
  dmg: [number, number, number, number][] | null;
  gath: Map<number, [number, number, number][]> | null;
}

function parse(raw: Uint8Array | null): Parsed | null {
  if (raw === null || raw.length < 4 || raw[0] !== 0x4f || raw[1] !== 0x42 || raw[2] !== 0x57 || raw[3] !== 0x54) return null;
  const c = new Cur(raw);
  c.p = 4;
  const version = c.u8();
  if (version < TRUTH_VER_MIN || version > TRUTH_VER_MAX) return null;
  const fps = c.f32();
  c.i32();   // 믿을 프레임
  if (!(fps > 0)) return null;

  const names = new Map<number, string>();
  const colors = new Map<number, string | null>();
  const dec = new TextDecoder("utf-8");
  for (let i = 0, n = c.u8(); i < n; i += 1) {
    const owner = c.u8();
    c.p += 4;   // 리플레이id · 종족 · 편 · controller
    const rgb = c.u32();   // 개인색 — 못 읽었으면 0xffffffff
    colors.set(owner, rgb === 0xffffffff ? null : `#${(rgb & 0xffffff).toString(16).padStart(6, "0")}`);
    const len = c.u8();
    if (c.p + len > raw.length) throw new Short();
    names.set(owner, dec.decode(raw.subarray(c.p, c.p + len)));
    c.p += len;
  }

  const nTracks = c.u32();
  if (nTracks > 100000) return null;
  const heads: [number, number, Own[]][] = [];
  const ticks: [number, number, number][] = [];
  for (let i = 0; i < nTracks; i += 1) {
    c.u32();   // 태그
    const owner = c.u8();
    c.u16();   // 처음 종류
    const count = c.u32();
    ticks.push([c.u32(), c.u32(), c.u32()]);
    const own: Own[] = [];
    for (let k = 0, n = c.u8(); k < n; k += 1) own.push([c.u32(), c.u8()]);
    heads.push([owner, count, own]);
  }

  // 키 흐름 — 키마다 varint(프레임차) · varint(x차) · varint(y차) · u8 방향 · u8 상태 · varint(종류차).
  let endFrame = 0;
  const lives: Life[] = [];
  const poses: Pos[][] = [];
  for (const [owner, count, own] of heads) {
    let pf = 0; let pt = 0; let px = 0; let py = 0;
    const pos: Pos[] = [];
    const keys: Key[] = [];
    let died: number | null = null;
    for (let i = 0; i < count; i += 1) {
      pf += c.varint();
      px += c.varint();
      py += c.varint();
      const st = c.at(c.p + 1);
      c.p += 2;
      pt += c.varint();
      if ((st & 0x0f) === ST_GONE) died = pf;
      keys.push([pf, pt, !(st & 0x80)]);
      pos.push([pf, px, py]);
    }
    if (keys.length) {
      endFrame = Math.max(endFrame, keys[keys.length - 1][0]);
      lives.push({ owner, keys, died, own });
      poses.push(pos);
    }
  }

  // 자원 절까지 건너뛴다 — 체력 · 인터셉터(트랙마다 varint 둘씩) · 표적(varint + u32) · 업그레이드 · 마법 · 핑.
  for (const [hp, ic] of ticks) for (let i = 0; i < 2 * (hp + ic); i += 1) c.varint();
  for (const [, , tgt] of ticks) for (let i = 0; i < tgt; i += 1) { c.varint(); c.u32(); }
  for (let i = 0, n = c.u32(); i < n; i += 1) { c.varint(); c.p += 8; }   // 업그레이드
  for (let i = 0, n = c.u32(); i < n; i += 1) { c.varint(); c.p += 6; }   // 마법
  for (let i = 0, n = c.u32(); i < n; i += 1) { c.varint(); c.p += 5; }   // 핑
  // 자원 — 사람마다 앞 값과의 차(프레임 · 미네랄 · 가스). 바뀔 때만 한 줄(계단).
  const bank = new Map<number, [number, number, number][]>();
  for (let i = 0, n = c.u32(); i < n; i += 1) {
    const who = c.u8();
    let rows = bank.get(who);
    if (!rows) { rows = []; bank.set(who, rows); }
    const [pf0, pm0, pg0] = rows.length ? rows[rows.length - 1] : [0, 0, 0];
    const df = c.varint(); const dm = c.varint(); const dg = c.varint();
    rows.push([pf0 + df, pm0 + dm, pg0 + dg]);
  }
  const [dmg, gath] = tail(c, version, fps);
  return { fps, names, colors, lives, endFrame, bank, poses, dmg, gath };
}

/** (데미지, 채집) — 자원 절 뒤의 절들을 건너뛰고 데미지(판 13) · 채집(판 14 · 맨 뒤). 그 판 아래거나 꼴이 어긋나면 null. */
function tail(c: Cur, version: number, fps: number): [Parsed["dmg"], Parsed["gath"]] {
  if (version < 13) return [null, null];
  try {
    for (let i = 0, n = c.u32(); i < n; i += 1) { c.varint(); c.p += 9; }   // 명령
    const nApm = c.u32();   // APM — 통크기 · 통차 · 사람 · 명령수
    c.u16();
    for (let i = 0; i < nApm; i += 1) { c.varint(); c.p += 1; c.varint(); }
    for (let i = 0, n = c.u32(); i < n; i += 1) { c.varint(); c.p += 5; }   // 자원밭단
    for (let i = 0, n = c.u32(); i < n; i += 1) { c.varint(); c.p += 11; }   // 건설명령
    for (let i = 0, n = c.u32(); i < n; i += 1) {   // 선택 — 프레임차 · 임자 · 갈래 · 태그수 · 태그들
      c.varint();
      c.p += 2;
      const tags = c.u8();
      c.p += 4 * tags;
    }
    for (const step of [6, 8, 6, 9]) {   // 에너지 · 탑승 · 자원량 · 처치
      for (let i = 0, n = c.u32(); i < n; i += 1) { c.varint(); c.p += step; }
    }
    const n = c.u32();
    const bf = c.u16();
    const out: [number, number, number, number][] = [];
    let pb = 0;
    for (let i = 0; i < n; i += 1) {
      pb += c.varint();
      const who = c.u8();
      const du = c.varint(); const db = c.varint(); const tu = c.varint(); const tb = c.varint();
      out.push([pb * bf / fps, who, du + db, tu + tb]);
    }
    if (version < 14) return [out, null];
    const gath = new Map<number, [number, number, number][]>();
    for (let i = 0, m = c.u32(); i < m; i += 1) {
      const who = c.u8();
      let rows = gath.get(who);
      if (!rows) { rows = []; gath.set(who, rows); }
      const [pf0, pm0, pg0] = rows.length ? rows[rows.length - 1] : [0, 0, 0];
      const df = c.varint(); const dm = c.varint(); const dg = c.varint();
      rows.push([pf0 + df, pm0 + dm, pg0 + dg]);
    }
    return [out, gath];
  } catch (e) {
    if (e instanceof Short) return [null, null];
    throw e;
  }
}

const sec = (frame: number | null, fps: number): number | null => (frame === null ? null : pyRound(frame / fps));

/** 애드온 종류 → 붙는 본 건물 종류. 붙음 = 본 건물이 애드온 바로 왼쪽(가로 0~6타일 · 세로 ±2타일)에 HOST_STAY 초 넘게. */
const ADDON_HOSTS: Record<number, Set<number>> = { 107: new Set([106]), 108: new Set([106]), 115: new Set([114]), 117: new Set([116]), 118: new Set([116]), 120: new Set([113]) };
const HOST_DX = 6 * 32;
const HOST_DY = 2 * 32;
const HOST_STAY = 3;

/** 건물 생애 줄 — [종류, 착공, 다 지음, 사라짐, 변태들[[새 종류, 시작, 다 됨]], 취소한 변태들[[시작, 취소]], 생애 차례] (프레임). */
type Bld = [number, number, number | null, number | null, [number, number, number | null][], [number, number][], number];

function posAt(pos: Pos[], f: number): [number, number] {
  let x = pos[0][1]; let y = pos[0][2];
  for (const [pf, px, py] of pos) {
    if (pf > f) break;
    x = px; y = py;
  }
  return [x, y];
}

function addonHosts(rows: Bld[], order: Bld[], poses: Pos[][], fps: number, endFrame: number): Map<number, [number, number][]> {
  const at = new Map(order.map((r, i) => [r, i]));
  const stay = HOST_STAY * fps;
  const out = new Map<number, [number, number][]>();
  for (const r of rows) {
    const hosts = ADDON_HOSTS[r[0]];
    if (!hosts) continue;
    const [ax, ay] = posAt(poses[r[6]], r[1]);
    const a0 = r[1]; const a1 = r[3] !== null ? r[3] : endFrame;
    const spans: [number, number][] = [];   // (붙은 프레임, 본 건물 차례)
    for (const q of rows) {
      if (!hosts.has(q[0])) continue;
      const q0 = q[1]; const q1 = q[3] !== null ? q[3] : endFrame;
      const lo = Math.max(a0, q0); const hi = Math.min(a1, q1);
      if (lo >= hi) continue;
      const cuts = [lo, ...poses[q[6]].filter(([pf]) => lo < pf && pf < hi).map(([pf]) => pf), hi];
      let run: number | null = null;
      for (let k = 0; k < cuts.length - 1; k += 1) {
        const [x, y] = posAt(poses[q[6]], cuts[k]);
        const adj = ax - x > 0 && ax - x <= HOST_DX && Math.abs(ay - y) <= HOST_DY;
        if (adj && run === null) run = cuts[k];
        if ((!adj || k === cuts.length - 2) && run !== null) {
          const end = adj ? cuts[k + 1] : cuts[k];
          if (end - run >= stay || end >= hi) spans.push([run, at.get(q) as number]);
          run = null;
        }
      }
    }
    spans.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const got: [number, number][] = [];
    for (const [f, hi9] of spans) {
      if (!got.length || got[got.length - 1][0] !== hi9) got.push([hi9, f]);
    }
    if (got.length) out.set(at.get(r) as number, got);
  }
  return out;
}

function bldsOut(rows: Bld[], poses: Pos[][], fps: number, endFrame: number): unknown[][] {
  const order = [...rows].sort((p, q) => p[1] - q[1]);
  const hosts = addonHosts(rows, order, poses, fps, endFrame);
  return order.map(([t, a, d, e, m, x], i) => {
    const row: unknown[] = [t, sec(a, fps), sec(d, fps), sec(e, fps),
      m.map(([mt, ms, md]) => [mt, sec(ms, fps), sec(md, fps)]),
      x.map(([xs, xc]) => [sec(xs, fps), sec(xc, fps)])];
    const h = hosts.get(i);
    if (h) row.push(h.map(([hh, f]) => [hh, sec(f, fps)]));
    return row;
  });
}

export interface PlayerCurves {
  wk: number[];
  sp: number[];
  sx: number[];
  rs: { m: number[]; g: number[]; st: [number, number][]; cm?: number[]; cg?: number[] };
  blds: unknown[][];
  color: string | null;
  techs: { t: number; s: number; e: number }[];
  dm: { d: number[]; t: number[] } | null;
}

const zeros = (n: number): number[] => new Array<number>(n).fill(0);

function series(parsed: Parsed): Record<string, PlayerCurves> {
  const { fps, names, colors, lives, endFrame, bank, poses, dmg, gath } = parsed;
  const minutes = Math.min(MAX_MINUTES, Math.floor(endFrame / fps / 60));
  const fpm = fps * 60;
  const per = (): Map<number, number[]> => new Map([...names.keys()].map((o) => [o, zeros(minutes + 1)]));
  const wk = per(); const sp = per(); const sx = per(); const aliveAny = per();
  for (const { owner: owner0, keys, died, own } of lives) {
    const born = keys[0][0];
    const last = died !== null ? died : endFrame + 1;
    let k = 0;
    for (let m = 0; m <= minutes; m += 1) {
      const f = m * fpm;
      if (f < born) continue;
      if (f >= last) break;
      while (k + 1 < keys.length && keys[k + 1][0] <= f) k += 1;
      let owner = owner0;
      for (const [of, oo] of own) if (of <= f) owner = oo;
      if (!names.has(owner)) continue;
      (aliveAny.get(owner) as number[])[m] += 1;
      const [, typ, done] = keys[k];
      (sp.get(owner) as number[])[m] += sup(typ);
      if (!WORKERS.has(typ)) (sx.get(owner) as number[])[m] += sup(typ);
      if (done && WORKERS.has(typ)) (wk.get(owner) as number[])[m] += 1;
    }
  }

  // 건물 생애 — 같은 몸이 다른 건물 종류로 바뀌면(해처리 → 레어 · 크립 → 성큰) 변태를 잇는다 · 변태 취소는 따로.
  const builds = new Map<number, Bld[]>([...names.keys()].map((o) => [o, []]));
  lives.forEach(({ owner: owner0, keys, died }, li) => {
    const got = builds.get(owner0);
    if (!got) return;
    let cur: Bld | null = null;
    let wasDone = false;
    let morphFrom: number | null = null;
    for (const [f, typ, done] of keys) {
      if (died !== null && f >= died) break;
      if (cur !== null) {
        const now: number = cur[4].length ? cur[4][cur[4].length - 1][0] : cur[0];
        if (typ === now) {
          if (wasDone && !done) {
            morphFrom = f;
          } else if (done) {
            if (morphFrom !== null) cur[5].push([morphFrom, f]);
            morphFrom = null;
            if (cur[4].length && cur[4][cur[4].length - 1][2] === null) cur[4][cur[4].length - 1][2] = f;
            else if (cur[2] === null) cur[2] = f;
          }
        } else if (BUILDINGS.has(typ)) {
          cur[4].push([typ, morphFrom !== null ? morphFrom : f, done ? f : null]);
          morphFrom = null;
        } else {
          cur[3] = f;
          got.push(cur);
          cur = null;
        }
      }
      if (cur === null && BUILDINGS.has(typ)) cur = [typ, f, done ? f : null, null, [], [], li];
      wasDone = done;
    }
    if (cur !== null) {
      cur[3] = died;
      got.push(cur);
    }
  });

  // 자원 — 분마다 그때 쥔 미네랄 · 가스.
  const rm = per(); const rg = per();
  for (const [o, rows] of bank) {
    if (!names.has(o)) continue;
    let k = -1;
    for (let mi = 0; mi <= minutes; mi += 1) {
      while (k + 1 < rows.length && rows[k + 1][0] <= mi * fpm) k += 1;
      if (k >= 0) { (rm.get(o) as number[])[mi] = rows[k][1]; (rg.get(o) as number[])[mi] = rows[k][2]; }
    }
  }

  // 캔 자원 — 분마다 그 앞 1분 동안 캔 몫(원작 누적의 차) · 마지막 분 뒤 꼬리는 마지막 분에.
  let cm: Map<number, number[]> | null = null;
  let cg: Map<number, number[]> | null = null;
  if (gath !== null) {
    cm = per(); cg = per();
    for (const [o, rows] of gath) {
      if (!names.has(o)) continue;
      let k = -1;
      let prev: [number, number] = [0, 0];
      for (let mi = 1; mi <= minutes; mi += 1) {
        const lim = mi < minutes ? mi * fpm : Infinity;
        while (k + 1 < rows.length && rows[k + 1][0] <= lim) k += 1;
        const now: [number, number] = k >= 0 ? [rows[k][1], rows[k][2]] : [0, 0];
        (cm.get(o) as number[])[mi] = now[0] - prev[0];
        (cg.get(o) as number[])[mi] = now[1] - prev[1];
        prev = now;
      }
    }
  }

  // 인구 계단 — 바뀔 때마다 [초, 인구] · 같은 초는 마지막 값.
  const supEv = new Map<number, [number, number][]>([...names.keys()].map((o) => [o, []]));
  for (const { owner: owner0, keys, died, own } of lives) {
    const marks = [...new Set([...keys.map(([f]) => f), ...own.map(([f]) => f)])].sort((a, b) => a - b);
    let ki = 0; let oi = 0;
    let owner = owner0;
    let prev: [number, number] | null = null;
    for (const f of marks) {
      if (died !== null && f >= died) break;
      while (ki + 1 < keys.length && keys[ki + 1][0] <= f) ki += 1;
      while (oi < own.length && own[oi][0] <= f) { owner = own[oi][1]; oi += 1; }
      const now: [number, number] = [owner, sup(keys[ki][1])];
      if (prev === null || now[0] !== prev[0] || now[1] !== prev[1]) {
        if (prev !== null && prev[1] && supEv.has(prev[0])) (supEv.get(prev[0]) as [number, number][]).push([f, -prev[1]]);
        if (now[1] && supEv.has(now[0])) (supEv.get(now[0]) as [number, number][]).push([f, now[1]]);
        prev = now;
      }
    }
    if (died !== null && prev !== null && prev[1] && supEv.has(prev[0])) (supEv.get(prev[0]) as [number, number][]).push([died, -prev[1]]);
  }
  const supSteps = new Map<number, [number, number][]>();
  for (const [o, evs] of supEv) {
    evs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const steps: [number, number][] = [];
    let tot = 0;
    for (const [f, d9] of evs) {
      tot += d9;
      const s = pyRound(f / fps);
      if (steps.length && steps[steps.length - 1][0] === s) steps[steps.length - 1][1] = tot / 2;
      else steps.push([s, tot / 2]);
    }
    supSteps.set(o, steps.filter((st, i) => i === 0 || st[1] !== steps[i - 1][1]));
  }

  // 데미지 — 분마다 그 앞 1분 동안 준 · 입은 몫(0분 = 0) · 꼬리는 마지막 분에.
  let dd: Map<number, number[]> | null = null;
  let dt: Map<number, number[]> | null = null;
  if (dmg !== null) {
    dd = per(); dt = per();
    for (const [s, who, d9, t9] of dmg) {
      if (!dd.has(who)) continue;
      const mi = Math.min(minutes, Math.floor(s / 60) + 1);
      (dd.get(who) as number[])[mi] += d9;
      (dt.get(who) as number[])[mi] += t9;
    }
  }

  // 테크 — 종류별 첫 완성. {임자: {종류: [시작, 완성]}}
  const techs = new Map<number, Map<number, [number, number]>>([...names.keys()].map((o) => [o, new Map()]));
  for (const { owner: owner0, keys, own } of lives) {
    const start = new Map<number, number>();
    let prev: [number, boolean] | null = null;
    let morphFrom: number | null = null;
    for (const [f, typ, done] of keys) {
      if (prev !== null && prev[0] === typ && prev[1] && !done) morphFrom = f;
      const changed = prev !== null && prev[0] !== typ;
      prev = [typ, done];
      if (!TECH.has(typ)) continue;
      if (!start.has(typ)) start.set(typ, changed && morphFrom !== null ? morphFrom : f);
      if (!done) continue;
      let owner = owner0;
      for (const [of, oo] of own) if (of <= f) owner = oo;
      const got = techs.get(owner);
      if (got && (!got.has(typ) || f < (got.get(typ) as [number, number])[1])) got.set(typ, [start.get(typ) as number, f]);
    }
  }

  const out: Record<string, PlayerCurves> = {};
  for (const [o, name] of names) {
    if (o === NEUTRAL || !name) continue;
    // 다 잃었거나 나가 몸이 중립으로 넘어간 뒤는 자른다.
    let cut = minutes + 1;
    const al = aliveAny.get(o) as number[];
    for (let m = 1; m <= minutes; m += 1) {
      if (al[m] === 0) { cut = m; break; }
    }
    const tech = [...(techs.get(o) as Map<number, [number, number]>)]
      .map(([t, [s, e]]) => ({ t, s: pyRound(s / fps), e: pyRound(e / fps) }))
      .sort((p, q) => p.e - q.e);
    const rs: PlayerCurves["rs"] = {
      m: (rm.get(o) as number[]).slice(0, cut), g: (rg.get(o) as number[]).slice(0, cut), st: supSteps.get(o) ?? [],
    };
    if (cm !== null && cg !== null) { rs.cm = (cm.get(o) as number[]).slice(0, cut); rs.cg = (cg.get(o) as number[]).slice(0, cut); }
    out[name] = {
      wk: (wk.get(o) as number[]).slice(0, cut),
      sp: (sp.get(o) as number[]).slice(0, cut).map((v) => v / 2),
      sx: (sx.get(o) as number[]).slice(0, cut).map((v) => v / 2),
      rs,
      blds: bldsOut(builds.get(o) as Bld[], poses, fps, endFrame),
      color: colors.get(o) ?? null,
      techs: tech,
      dm: dd === null || dt === null ? null : { d: (dd.get(o) as number[]).slice(0, cut), t: (dt.get(o) as number[]).slice(0, cut) },
    };
  }
  return out;
}

/** 사람 이름 → 분당 곡선 · 건물 생애 · 테크 · 개인색. 꼴이 낯설면 null. */
export async function curvesFromTracks(data: string | Uint8Array): Promise<Record<string, PlayerCurves> | null> {
  try {
    const parsed = parse(await rawOf(data));
    return parsed === null ? null : series(parsed);
  } catch (e) {
    if (e instanceof Short || e instanceof RangeError || e instanceof TypeError) return null;
    throw e;
  }
}
