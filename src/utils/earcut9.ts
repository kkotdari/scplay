/* earcut — 다각형(구멍 포함) 삼각분할. mapbox/earcut v2.2 를 TypeScript 로 옮겼다(2026-11-02 · 지형 겹칠하기 줄이기 2단계 — glTerrain9 ★ 지형 삼각).
 *
 * ISC License
 * Copyright (c) 2016, Mapbox
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND ISC DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL ISC BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 * OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE. */

class N9 {
  prev: N9 = this; next: N9 = this;
  z = 0; prevZ: N9 | null = null; nextZ: N9 | null = null; steiner = false;
  constructor(public i: number, public x: number, public y: number) {}
}

/** data = [x0, y0, x1, y1, …] · holeIndices = 구멍이 시작하는 **점** 번호들 → 삼각형 점 번호(셋씩). */
export function earcut9(data: ArrayLike<number>, holeIndices: number[] | null, dim = 2): number[] {
  const hasHoles = !!holeIndices && holeIndices.length > 0;
  const outerLen = hasHoles ? holeIndices![0] * dim : data.length;
  let outerNode = linkedList(data, 0, outerLen, dim, true);
  const triangles: number[] = [];
  if (!outerNode || outerNode.next === outerNode.prev) return triangles;
  let minX = 0; let minY = 0; let invSize = 0;
  if (hasHoles) outerNode = eliminateHoles(data, holeIndices!, outerNode, dim);
  if (data.length > 80 * dim) {
    minX = data[0]; minY = data[1]; let maxX = minX; let maxY = minY;
    for (let i = dim; i < outerLen; i += dim) {
      const x = data[i]; const y = data[i + 1];
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    invSize = Math.max(maxX - minX, maxY - minY);
    invSize = invSize !== 0 ? 32767 / invSize : 0;
  }
  earcutLinked(outerNode, triangles, dim, minX, minY, invSize, 0);
  return triangles;
}

function linkedList(data: ArrayLike<number>, start: number, end: number, dim: number, clockwise: boolean): N9 | null {
  let last: N9 | null = null;
  if (clockwise === (signedArea(data, start, end, dim) > 0)) {
    for (let i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
  } else {
    for (let i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
  }
  if (last && equals(last, last.next)) { removeNode(last); last = last.next; }
  return last;
}

function filterPoints(start: N9 | null, end?: N9 | null): N9 | null {
  if (!start) return start;
  if (!end) end = start;
  let p = start; let again: boolean;
  do {
    again = false;
    if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
      removeNode(p);
      p = end = p.prev;
      if (p === p.next) break;
      again = true;
    } else {
      p = p.next;
    }
  } while (again || p !== end);
  return end;
}

function earcutLinked(ear: N9 | null, triangles: number[], dim: number, minX: number, minY: number, invSize: number, pass: number): void {
  if (!ear) return;
  if (!pass && invSize) indexCurve(ear, minX, minY, invSize);
  let stop = ear;
  while (ear.prev !== ear.next) {
    const prev: N9 = ear.prev; const next: N9 = ear.next;
    if (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear)) {
      triangles.push((prev.i / dim) | 0, (ear.i / dim) | 0, (next.i / dim) | 0);
      removeNode(ear);
      ear = next.next;
      stop = next.next;
      continue;
    }
    ear = next;
    if (ear === stop) {
      if (!pass) {
        earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);
      } else if (pass === 1) {
        const e2 = cureLocalIntersections(filterPoints(ear)!, triangles, dim);
        earcutLinked(e2, triangles, dim, minX, minY, invSize, 2);
      } else if (pass === 2) {
        splitEarcut(ear, triangles, dim, minX, minY, invSize);
      }
      break;
    }
  }
}

function isEar(ear: N9): boolean {
  const a = ear.prev; const b = ear; const c = ear.next;
  if (area(a, b, c) >= 0) return false;
  const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;
  const x0 = Math.min(ax, bx, cx), y0 = Math.min(ay, by, cy), x1 = Math.max(ax, bx, cx), y1 = Math.max(ay, by, cy);
  let p = c.next;
  while (p !== a) {
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
    p = p.next;
  }
  return true;
}

function isEarHashed(ear: N9, minX: number, minY: number, invSize: number): boolean {
  const a = ear.prev; const b = ear; const c = ear.next;
  if (area(a, b, c) >= 0) return false;
  const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;
  const x0 = Math.min(ax, bx, cx), y0 = Math.min(ay, by, cy), x1 = Math.max(ax, bx, cx), y1 = Math.max(ay, by, cy);
  const minZ = zOrder(x0, y0, minX, minY, invSize); const maxZ = zOrder(x1, y1, minX, minY, invSize);
  let p = ear.prevZ; let n = ear.nextZ;
  const hit = (q: N9): boolean => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1 && q !== a && q !== c
    && pointInTriangle(ax, ay, bx, by, cx, cy, q.x, q.y) && area(q.prev, q, q.next) >= 0;
  while (p && p.z >= minZ && n && n.z <= maxZ) {
    if (hit(p)) return false;
    p = p.prevZ;
    if (hit(n)) return false;
    n = n.nextZ;
  }
  while (p && p.z >= minZ) { if (hit(p)) return false; p = p.prevZ; }
  while (n && n.z <= maxZ) { if (hit(n)) return false; n = n.nextZ; }
  return true;
}

function cureLocalIntersections(start: N9, triangles: number[], dim: number): N9 | null {
  let p = start;
  do {
    const a = p.prev; const b = p.next.next;
    if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
      triangles.push((a.i / dim) | 0, (p.i / dim) | 0, (b.i / dim) | 0);
      removeNode(p); removeNode(p.next);
      p = start = b;
    }
    p = p.next;
  } while (p !== start);
  return filterPoints(p);
}

function splitEarcut(start: N9, triangles: number[], dim: number, minX: number, minY: number, invSize: number): void {
  let a = start;
  do {
    let b = a.next.next;
    while (b !== a.prev) {
      if (a.i !== b.i && isValidDiagonal(a, b)) {
        let c: N9 | null = splitPolygon(a, b);
        const a2 = filterPoints(a, a.next);
        c = filterPoints(c, c.next);
        earcutLinked(a2, triangles, dim, minX, minY, invSize, 0);
        earcutLinked(c, triangles, dim, minX, minY, invSize, 0);
        return;
      }
      b = b.next;
    }
    a = a.next;
  } while (a !== start);
}

function eliminateHoles(data: ArrayLike<number>, holeIndices: number[], outerNode: N9, dim: number): N9 {
  const queue: N9[] = [];
  for (let i = 0, len = holeIndices.length; i < len; i += 1) {
    const start = holeIndices[i] * dim;
    const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
    const list = linkedList(data, start, end, dim, false);
    if (!list) continue;
    if (list === list.next) list.steiner = true;
    queue.push(getLeftmost(list));
  }
  queue.sort((a, b) => a.x - b.x);
  for (let i = 0; i < queue.length; i += 1) outerNode = eliminateHole(queue[i], outerNode);
  return outerNode;
}

function eliminateHole(hole: N9, outerNode: N9): N9 {
  const bridge = findHoleBridge(hole, outerNode);
  if (!bridge) return outerNode;
  const bridgeReverse = splitPolygon(bridge, hole);
  filterPoints(bridgeReverse, bridgeReverse.next);
  return filterPoints(bridge, bridge.next) ?? outerNode;
}

function findHoleBridge(hole: N9, outerNode: N9): N9 | null {
  let p = outerNode; const hx = hole.x; const hy = hole.y; let qx = -Infinity; let m: N9 | null = null;
  do {
    if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
      const x = p.x + ((hy - p.y) * (p.next.x - p.x)) / (p.next.y - p.y);
      if (x <= hx && x > qx) {
        qx = x;
        m = p.x < p.next.x ? p : p.next;
        if (x === hx) return m;
      }
    }
    p = p.next;
  } while (p !== outerNode);
  if (!m) return null;
  const stop = m; const mx = m.x; const my = m.y; let tanMin = Infinity;
  p = m;
  do {
    if (hx >= p.x && p.x >= mx && hx !== p.x && pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
      const tan = Math.abs(hy - p.y) / (hx - p.x);
      if (locallyInside(p, hole) && (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
        m = p; tanMin = tan;
      }
    }
    p = p.next;
  } while (p !== stop);
  return m;
}

function sectorContainsSector(m: N9, p: N9): boolean {
  return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
}

function indexCurve(start: N9, minX: number, minY: number, invSize: number): void {
  let p = start;
  do {
    if (p.z === 0) p.z = zOrder(p.x, p.y, minX, minY, invSize);
    p.prevZ = p.prev; p.nextZ = p.next; p = p.next;
  } while (p !== start);
  p.prevZ!.nextZ = null; p.prevZ = null;
  sortLinked(p);
}

function sortLinked(list0: N9): N9 | null {
  let list: N9 | null = list0; let inSize = 1; let numMerges: number;
  do {
    let p: N9 | null = list; list = null; let tail: N9 | null = null; numMerges = 0;
    while (p) {
      numMerges += 1;
      let q: N9 | null = p; let pSize = 0;
      for (let i = 0; i < inSize; i += 1) { pSize += 1; q = q.nextZ; if (!q) break; }
      let qSize = inSize;
      while (pSize > 0 || (qSize > 0 && q)) {
        let e: N9;
        if (pSize !== 0 && (qSize === 0 || !q || p!.z <= q.z)) { e = p!; p = p!.nextZ; pSize -= 1; } else { e = q!; q = q!.nextZ; qSize -= 1; }
        if (tail) tail.nextZ = e; else list = e;
        e.prevZ = tail; tail = e;
      }
      p = q;
    }
    tail!.nextZ = null;
    inSize *= 2;
  } while (numMerges > 1);
  return list;
}

function zOrder(x0: number, y0: number, minX: number, minY: number, invSize: number): number {
  let x = ((x0 - minX) * invSize) | 0; let y = ((y0 - minY) * invSize) | 0;
  x = (x | (x << 8)) & 0x00ff00ff; x = (x | (x << 4)) & 0x0f0f0f0f; x = (x | (x << 2)) & 0x33333333; x = (x | (x << 1)) & 0x55555555;
  y = (y | (y << 8)) & 0x00ff00ff; y = (y | (y << 4)) & 0x0f0f0f0f; y = (y | (y << 2)) & 0x33333333; y = (y | (y << 1)) & 0x55555555;
  return x | (y << 1);
}

function getLeftmost(start: N9): N9 {
  let p = start; let leftmost = start;
  do { if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p; p = p.next; } while (p !== start);
  return leftmost;
}

function pointInTriangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, px: number, py: number): boolean {
  return (cx - px) * (ay - py) >= (ax - px) * (cy - py) && (ax - px) * (by - py) >= (bx - px) * (ay - py) && (bx - px) * (cy - py) >= (cx - px) * (by - py);
}

function isValidDiagonal(a: N9, b: N9): boolean {
  return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b)
    && ((locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && (area(a.prev, a, b.prev) !== 0 || area(a, b.prev, b) !== 0))
      || (equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0));
}

function area(p: N9, q: N9, r: N9): number { return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y); }
function equals(p1: N9, p2: N9): boolean { return p1.x === p2.x && p1.y === p2.y; }

function intersects(p1: N9, q1: N9, p2: N9, q2: N9): boolean {
  const o1 = sign(area(p1, q1, p2)); const o2 = sign(area(p1, q1, q2)); const o3 = sign(area(p2, q2, p1)); const o4 = sign(area(p2, q2, q1));
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}
function onSegment(p: N9, q: N9, r: N9): boolean {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}
function sign(n: number): number { return n > 0 ? 1 : n < 0 ? -1 : 0; }

function intersectsPolygon(a: N9, b: N9): boolean {
  let p = a;
  do {
    if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && intersects(p, p.next, a, b)) return true;
    p = p.next;
  } while (p !== a);
  return false;
}

function locallyInside(a: N9, b: N9): boolean {
  return area(a.prev, a, a.next) < 0 ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}

function middleInside(a: N9, b: N9): boolean {
  let p = a; let inside = false; const px = (a.x + b.x) / 2; const py = (a.y + b.y) / 2;
  do {
    if ((p.y > py) !== (p.next.y > py) && p.next.y !== p.y && px < ((p.next.x - p.x) * (py - p.y)) / (p.next.y - p.y) + p.x) inside = !inside;
    p = p.next;
  } while (p !== a);
  return inside;
}

function splitPolygon(a: N9, b: N9): N9 {
  const a2 = new N9(a.i, a.x, a.y); const b2 = new N9(b.i, b.x, b.y); const an = a.next; const bp = b.prev;
  a.next = b; b.prev = a;
  a2.next = an; an.prev = a2;
  b2.next = a2; a2.prev = b2;
  bp.next = b2; b2.prev = bp;
  return b2;
}

function insertNode(i: number, x: number, y: number, last: N9 | null): N9 {
  const p = new N9(i, x, y);
  if (last) { p.next = last.next; p.prev = last; last.next.prev = p; last.next = p; }
  return p;
}

function removeNode(p: N9): void {
  p.next.prev = p.prev; p.prev.next = p.next;
  if (p.prevZ) p.prevZ.nextZ = p.nextZ;
  if (p.nextZ) p.nextZ.prevZ = p.prevZ;
}

function signedArea(data: ArrayLike<number>, start: number, end: number, dim: number): number {
  let sum = 0;
  for (let i = start, j = end - dim; i < end; i += dim) {
    sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
    j = i;
  }
  return sum;
}

/* ── 고리 묶음(홀짝) → 삼각형 ── 지형 고리(utils/contour Loop · [x0,y0,x1,y1,…])는 홀짝으로 채운다(바깥 · 구멍 · 그 안의 섬 …). 고리마다 '몇 겹 안에
   들었나'(깊이)를 재서 짝수 = 바깥, 홀수 = 구멍(바로 바깥 고리 = 깊이가 하나 작은 감싼 고리)으로 묶어 earcut 한다. 고리끼리는 안 엇갈린다(등고선). */
function pip9(lp: ArrayLike<number>, x: number, y: number): boolean {
  let inside = false; const n = lp.length >> 1;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const xi = lp[i * 2]; const yi = lp[i * 2 + 1]; const xj = lp[j * 2]; const yj = lp[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** 고리들 → 삼각형(정점 x,y · 번호). 못 나눈 고리는 건너뛴다(그 몫은 그리는 쪽이 옛 부채꼴로 물러날 수 있게 ok 를 돌려준다). */
export function trianglesOfLoops9(loops: ArrayLike<number>[], tol = 0): { pos: Float32Array; idx: Uint32Array; ok: boolean } {
  const L = loops.filter((lp) => lp.length >= 6).map((lp) => (tol > 0 ? simplifyLoop9(lp, tol) : lp));
  const n = L.length;
  const bb = L.map((lp) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < lp.length; i += 2) { const x = lp[i], y = lp[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return [x0, y0, x1, y1];
  });
  const depth = new Int32Array(n); const parent = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i += 1) {
    // 고리 위의 한 점(첫 변의 가운데 — 꼭짓점이 딴 고리 위에 올라앉는 일을 피한다).
    const px = (L[i][0] + L[i][2]) / 2; const py = (L[i][1] + L[i][3]) / 2;
    let d = 0; let best = -1; let bestArea = Infinity;
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      const b = bb[j];
      if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) continue;
      if (!pip9(L[j], px, py)) continue;
      d += 1;
      const ar = (b[2] - b[0]) * (b[3] - b[1]);
      if (ar < bestArea) { bestArea = ar; best = j; }   // 감싼 고리 중 가장 작은 것 = 바로 바깥
    }
    depth[i] = d; parent[i] = best;
  }
  const holesOf = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) if (depth[i] % 2 === 1 && parent[i] >= 0) { const a = holesOf.get(parent[i]); if (a) a.push(i); else holesOf.set(parent[i], [i]); }
  const pos: number[] = []; const idx: number[] = []; let ok = true;
  for (let i = 0; i < n; i += 1) {
    if (depth[i] % 2 === 1) continue;
    const data: number[] = []; const holes: number[] = [];
    for (let k = 0; k < L[i].length; k += 1) data.push(L[i][k]);
    for (const h of holesOf.get(i) ?? []) { holes.push(data.length >> 1); for (let k = 0; k < L[h].length; k += 1) data.push(L[h][k]); }
    let tri: number[];
    try { tri = earcut9(data, holes.length ? holes : null, 2); } catch { ok = false; continue; }
    if (tri.length === 0) { ok = false; continue; }
    const base = pos.length >> 1;
    for (let k = 0; k < data.length; k += 1) pos.push(data[k]);
    for (let k = 0; k < tri.length; k += 1) idx.push(base + tri[k]);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), ok };
}

/** 닫힌 고리 솎기(Douglas–Peucker · 허용 tol 타일) — 매끈한 등고선(Chaikin ×3)은 거의 곧은 점이 많아 earcut 이 느리다(10만 점 2.8초). 0.003칸이면 배율 8 에서도 1화소 아래다. */
export function simplifyLoop9(lp: ArrayLike<number>, tol: number): number[] {
  const n = lp.length >> 1;
  if (n <= 8) return Array.from(lp);
  const keep = new Uint8Array(n);
  // 닫힌 고리: 첫 점과 가장 먼 점을 기둥으로 둘로 나눠 각각 DP.
  let far = 0; let fd = -1;
  for (let i = 1; i < n; i += 1) { const dx = lp[i * 2] - lp[0]; const dy = lp[i * 2 + 1] - lp[1]; const d = dx * dx + dy * dy; if (d > fd) { fd = d; far = i; } }
  keep[0] = 1; keep[far] = 1;
  const t2 = tol * tol;
  const stack: number[] = [0, far, far, n];
  while (stack.length) {
    const b = stack.pop()!; const a = stack.pop()!;
    const ax = lp[a * 2], ay = lp[a * 2 + 1]; const bi = b % n; const bx = lp[bi * 2], by = lp[bi * 2 + 1];
    const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
    let best = -1; let bd = t2;
    for (let i = a + 1; i < b; i += 1) {
      const px = lp[i * 2] - ax, py = lp[i * 2 + 1] - ay;
      let d: number;
      if (L2 < 1e-12) d = px * px + py * py;
      else { const c = px * dy - py * dx; d = (c * c) / L2; }
      if (d > bd) { bd = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push(a, best, best, b); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) if (keep[i]) out.push(lp[i * 2], lp[i * 2 + 1]);
  return out.length >= 6 ? out : Array.from(lp);
}
