/* ★★ **캔버스 2D 의 부분집합을 GL 삼각형으로 바꿔 주는 심(shim)**(2026-09, 다음 손 2 "링·체력바·효과 GL로") ──────────────
   효과 붓(paintFxList9 — 트레이서·피격·캐스트, 1500줄)은 캔버스 2D API 로 적혀 있다. 그 코드를 한 줄도 안 고치고 출력만 GL 로
   보내려고, 붓이 부르는 API 만큼(경로·채움·획·그러데이션·변환·알파·합성·drawImage)을 흉내 내어 **색 있는 삼각형**과 **텍스처
   사각**으로 풀어 `VecSink9` 에 민다. gl9 가 그 삼각형을 프레임 끝에 한 번(합성·텍스처가 갈릴 때만 나눠) 그린다.
   · 경로는 캔버스와 같이 **명령 시각의 변환(CTM)** 을 먹인 점으로 쌓는다(호·타원·2차 곡선은 마디로 편다).
   · 채움: 볼록·오목 다각형은 귀 잘라내기(삼각화) · 방사 그러데이션은 **색 멈춤마다 고리**를 넣어 정확히 낸다(빛무리의 그 자리) ·
     선형 그러데이션은 꼭짓점마다 그 자리의 색(획은 멈춤 자리에서 마디를 쪼갠다 — 안 쪼개면 가운데가 밝은 3단 줄기가 사라진다).
   · 획: 마디마다 네모 + 이음마다 원판(round 이음·끝) · 점선(setLineDash)은 마디를 토막 낸다 · 굵기는 CTM 의 배수를 탄다.
   · 합성: source-over / lighter(더하기) — 붓이 쓰는 둘뿐이다.
   · drawImage: 원본(캔버스)을 텍스처로 올려 사각을 민다(원본 갱신은 `__ver9` 표식으로 안다 — 없으면 프레임마다 올린다).
   · clip·filter·그림자는 안 받는다 — 붓은 그것을 오프스크린 스프라이트 캔버스(진짜 캔버스)에만 쓴다.
   AA 는 MSAA 판(gl9 MRT)이 낸다 — 이 삼각형들은 몸과 같은 판에, 연기(스텐실) 다음에 그려진다. */

/** 삼각형을 받는 쪽 — 꼭짓점 하나(장치 px · 미리곱한 색 · 텍스처 자리). mode 0 보통 · 1 더하기. tex 는 null 이면 색만. */
export interface VecSink9 {
  vert(mode: number, tex: TexImageSource | null, x: number, y: number, u: number, v: number, r: number, g: number, b: number, a: number): void;
}

type Stop9 = [number, number, number, number, number];   // t, r, g, b, a
/** 그러데이션 — 자리는 **사용자 좌표**로 든다(캔버스 규약: 그러데이션은 만든 순간이 아니라 **칠하는 순간의 변환**을 탄다.
 *  붓이 `createRadialGradient(0, 0, …)` 를 먼저 짓고 `translate` 한 뒤 칠하는 자리가 있어, 만든 순간의 장치 좌표로 굳히면
 *  그 원이 화면 (0, 0) 으로 간다 — 실측: 스플래시 타원이 왼쪽 위 모서리의 쐐기로 떴다). 칠할 때 `dev()` 로 장치 자리를 낸다. */
class Grad9 {
  stops: Stop9[] = [];
  constructor(readonly kind: 0 | 1, readonly x0: number, readonly y0: number, readonly r0: number, readonly x1: number, readonly y1: number, readonly r1: number) {}
  /** 칠하는 순간의 변환(CTM)과 그 역 — 색은 장치 점을 **사용자 자리로 되돌려** 잰다(비균일 배수도 타원 그러데이션 그대로). */
  m: [number, number, number, number, number, number] | null = null;
  inv: [number, number, number, number, number, number] | null = null;
  dev(m: [number, number, number, number, number, number]): Grad9 {
    const g = new Grad9(this.kind, this.x0, this.y0, this.r0, this.x1, this.y1, this.r1);
    g.stops = this.stops; g.m = m;
    const det = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(det) > 1e-12) {
      const id = 1 / det;
      g.inv = [m[3] * id, -m[1] * id, -m[2] * id, m[0] * id, (m[2] * m[5] - m[3] * m[4]) * id, (m[1] * m[4] - m[0] * m[5]) * id];
    }
    return g;
  }
  /** 장치 점 → 사용자 점. */
  ux(x: number, y: number): number { const i = this.inv; return i ? i[0] * x + i[2] * y + i[4] : x; }
  uy(x: number, y: number): number { const i = this.inv; return i ? i[1] * x + i[3] * y + i[5] : y; }
  /** 사용자 점 → 장치 점. */
  dx(x: number, y: number): number { const m = this.m; return m ? m[0] * x + m[2] * y + m[4] : x; }
  dy(x: number, y: number): number { const m = this.m; return m ? m[1] * x + m[3] * y + m[5] : y; }
  addColorStop(t: number, col: string): void {
    const c = parseCol9(col);
    this.stops.push([Math.max(0, Math.min(1, t)), c[0], c[1], c[2], c[3]]);
    this.stops.sort((a, b) => a[0] - b[0]);
  }
  /** t(0~1)의 색 — 멈춤 사이는 선형, 밖은 끝 색(캔버스와 같다). */
  at(t: number, out: number[]): void {
    const s = this.stops;
    if (s.length === 0) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0; return; }
    if (t <= s[0][0] || s.length === 1) { out[0] = s[0][1]; out[1] = s[0][2]; out[2] = s[0][3]; out[3] = s[0][4]; return; }
    const l = s[s.length - 1];
    if (t >= l[0]) { out[0] = l[1]; out[1] = l[2]; out[2] = l[3]; out[3] = l[4]; return; }
    for (let i = 1; i < s.length; i += 1) {
      if (t <= s[i][0]) {
        const a = s[i - 1]; const b = s[i];
        const k = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
        out[0] = a[1] + (b[1] - a[1]) * k; out[1] = a[2] + (b[2] - a[2]) * k; out[2] = a[3] + (b[3] - a[3]) * k; out[3] = a[4] + (b[4] - a[4]) * k;
        return;
      }
    }
  }
}

const COL_CACHE9 = new Map<string, [number, number, number, number]>();
/** 색 문자열 → rgba(0~1) — #rgb · #rrggbb · #rrggbbaa · rgb()/rgba() · transparent. 모르는 것은 회색(한 번 경고). */
export function parseCol9(c: string): [number, number, number, number] {
  let v = COL_CACHE9.get(c);
  if (v) return v;
  const s = c.trim();
  let m: RegExpExecArray | null;
  if ((m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s))) {
    let h = m[1];
    if (h.length <= 4) h = h.split("").map((x) => x + x).join("");
    v = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  } else if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s))) {
    v = [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, m[4] === undefined ? 1 : Number(m[4])];
  } else if (s === "transparent") v = [0, 0, 0, 0];
  else if (s === "white" || s === "#fff") v = [1, 1, 1, 1];
  else if (s === "black") v = [0, 0, 0, 1];
  else { if (COL_CACHE9.size < 4096) console.warn("[glctx9] 모르는 색", c); v = [0.5, 0.5, 0.5, 1]; }
  if (COL_CACHE9.size < 4096) COL_CACHE9.set(c, v);
  return v;
}

/** 한 부분 경로 — 평평하게 편 점들(장치 px, CTM 을 먹인 값)과 닫힘. */
interface Sub9 { pts: number[]; closed: boolean }
type State9 = { m: [number, number, number, number, number, number]; alpha: number; fill: string | Grad9; stroke: string | Grad9; lw: number; cap: CanvasLineCap; join: CanvasLineJoin; miter: number; gco: string; dash: number[]; dashOff: number };

/** 귀 잘라내기 — 단순 다각형(오목 포함)을 삼각형 번호로. 자기 교차·퇴화는 부채꼴로 물러난다. */
function earClip9(p: number[], out: number[]): void {
  const n = p.length >> 1;
  if (n < 3) return;
  if (n === 3) { out.push(0, 1, 2); return; }
  // 방향 — 넓이 부호
  let area = 0;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) area += p[j * 2] * p[i * 2 + 1] - p[i * 2] * p[j * 2 + 1];
  const ccw = area > 0;
  const idx: number[] = []; for (let i = 0; i < n; i += 1) idx.push(i);
  const cross = (a: number, b: number, c: number): number => (p[b * 2] - p[a * 2]) * (p[c * 2 + 1] - p[a * 2 + 1]) - (p[b * 2 + 1] - p[a * 2 + 1]) * (p[c * 2] - p[a * 2]);
  const inside = (a: number, b: number, c: number, q: number): boolean => {
    const s1 = cross(a, b, q); const s2 = cross(b, c, q); const s3 = cross(c, a, q);
    return ccw ? (s1 >= 0 && s2 >= 0 && s3 >= 0) : (s1 <= 0 && s2 <= 0 && s3 <= 0);
  };
  let guard = 0;
  while (idx.length > 3 && guard < 4 * n) {
    guard += 1;
    let cut = false;
    for (let i = 0; i < idx.length; i += 1) {
      const a = idx[(i + idx.length - 1) % idx.length]; const b = idx[i]; const c = idx[(i + 1) % idx.length];
      const cr = cross(a, b, c);
      if (ccw ? cr <= 0 : cr >= 0) continue;   // 오목한 귀는 못 자른다
      let ok = true;
      for (const q of idx) { if (q === a || q === b || q === c) continue; if (inside(a, b, c, q)) { ok = false; break; } }
      if (!ok) continue;
      out.push(a, b, c); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
  else if (idx.length > 3) { for (let i = 1; i + 1 < idx.length; i += 1) out.push(idx[0], idx[i], idx[i + 1]); }   // 못 자른 나머지는 부채꼴
}

/** 붓이 미리 짜 두는 경로(캔버스의 Path2D 자리) — 브라우저 Path2D 는 속을 못 읽으므로 명령을 적어 두고, 진짜 캔버스에는
 *  Path2D 로(한 번 지어 두고), GL 심에는 되풀이로 넘긴다. `fillPath9` 가 그 둘을 가른다. */
export class PathRec9 {
  private cmds: (number | string)[][] = [];
  private p2d: Path2D | null = null;
  moveTo(x: number, y: number): void { this.cmds.push(["m", x, y]); this.p2d = null; }
  lineTo(x: number, y: number): void { this.cmds.push(["l", x, y]); this.p2d = null; }
  closePath(): void { this.cmds.push(["z"]); this.p2d = null; }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): void { this.cmds.push(["a", x, y, r, a0, a1, ccw ? 1 : 0]); this.p2d = null; }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false): void { this.cmds.push(["e", x, y, rx, ry, rot, a0, a1, ccw ? 1 : 0]); this.p2d = null; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void { this.cmds.push(["q", cx, cy, x, y]); this.p2d = null; }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void { this.cmds.push(["b", c1x, c1y, c2x, c2y, x, y]); this.p2d = null; }
  rect(x: number, y: number, w: number, h: number): void { this.cmds.push(["r", x, y, w, h]); this.p2d = null; }
  /** 어느 경로 받는 이(캔버스 2D · Path2D · GL 심)에나 명령을 되풀이한다. */
  replay(c: { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void; arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void; ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean): void; quadraticCurveTo(a: number, b: number, x: number, y: number): void; bezierCurveTo(a: number, b: number, d: number, e: number, x: number, y: number): void; rect(x: number, y: number, w: number, h: number): void }): void {
    for (const k of this.cmds) {
      const n = k as number[];
      switch (k[0]) {
        case "m": c.moveTo(n[1], n[2]); break;
        case "l": c.lineTo(n[1], n[2]); break;
        case "z": c.closePath(); break;
        case "a": c.arc(n[1], n[2], n[3], n[4], n[5], n[6] === 1); break;
        case "e": c.ellipse(n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8] === 1); break;
        case "q": c.quadraticCurveTo(n[1], n[2], n[3], n[4]); break;
        case "b": c.bezierCurveTo(n[1], n[2], n[3], n[4], n[5], n[6]); break;
        case "r": c.rect(n[1], n[2], n[3], n[4]); break;
        default: break;
      }
    }
  }
  toPath2D(): Path2D { if (!this.p2d) { this.p2d = new Path2D(); this.replay(this.p2d); } return this.p2d; }
}
/** 미리 짠 경로를 채운다 — GL 심이면 되풀이해 제 경로로 채우고, 캔버스면 Path2D 로. */
export function fillPath9(ctx: CanvasRenderingContext2D, p: PathRec9): void {
  const g = ctx as unknown as { gl9?: boolean; fillRec9?: (p: PathRec9) => void };
  if (g.gl9 && g.fillRec9) g.fillRec9(p); else ctx.fill(p.toPath2D());
}
export class GlCtx9 {
  /** 심임을 알리는 표식(fillPath9 가 본다). */
  readonly gl9 = true;
  fillRec9(p: PathRec9): void { this.beginPath(); p.replay(this); this.fill(); }
  private st: State9 = { m: [1, 0, 0, 1, 0, 0], alpha: 1, fill: "#000", stroke: "#000", lw: 1, cap: "butt", join: "miter", miter: 10, gco: "source-over", dash: [], dashOff: 0 };
  private stack: State9[] = [];
  private subs: Sub9[] = [];
  private cur: Sub9 | null = null;
  private cx = 0; private cy = 0;   // 마지막 점(장치 px) — arc 의 이음선용
  private tmp = [0, 0, 0, 0];
  readonly canvas = null as unknown as HTMLCanvasElement;
  constructor(private sink: VecSink9) {}
  /** 프레임 머리에서 상태를 캔버스 기본값으로(붓이 save/restore 를 어긋나게 남겼어도 다음 장이 깨끗하다). */
  reset(): void {
    this.st = { m: [1, 0, 0, 1, 0, 0], alpha: 1, fill: "#000", stroke: "#000", lw: 1, cap: "butt", join: "miter", miter: 10, gco: "source-over", dash: [], dashOff: 0 };
    this.stack = []; this.subs = []; this.cur = null;
  }

  /* ── 상태(캔버스 API 의 그 이름들) ── */
  get globalAlpha(): number { return this.st.alpha; } set globalAlpha(v: number) { this.st.alpha = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; }
  get fillStyle(): string | Grad9 { return this.st.fill; } set fillStyle(v: string | Grad9 | CanvasGradient | CanvasPattern) { this.st.fill = v as string | Grad9; }
  get strokeStyle(): string | Grad9 { return this.st.stroke; } set strokeStyle(v: string | Grad9 | CanvasGradient | CanvasPattern) { this.st.stroke = v as string | Grad9; }
  get lineWidth(): number { return this.st.lw; } set lineWidth(v: number) { if (v > 0 && Number.isFinite(v)) this.st.lw = v; }
  get lineCap(): CanvasLineCap { return this.st.cap; } set lineCap(v: CanvasLineCap) { this.st.cap = v; }
  get lineJoin(): CanvasLineJoin { return this.st.join; } set lineJoin(v: CanvasLineJoin) { this.st.join = v; }
  get miterLimit(): number { return this.st.miter; } set miterLimit(v: number) { this.st.miter = v; }
  get globalCompositeOperation(): string { return this.st.gco; } set globalCompositeOperation(v: string) { this.st.gco = v; }
  get lineDashOffset(): number { return this.st.dashOff; } set lineDashOffset(v: number) { this.st.dashOff = v; }
  shadowColor = "transparent"; shadowBlur = 0; shadowOffsetX = 0; shadowOffsetY = 0;
  imageSmoothingEnabled = true;
  setLineDash(d: number[]): void { this.st.dash = d.filter((x) => Number.isFinite(x) && x >= 0); if (this.st.dash.length % 2 === 1) this.st.dash = this.st.dash.concat(this.st.dash); }
  getLineDash(): number[] { return this.st.dash.slice(); }
  save(): void { this.stack.push({ ...this.st, m: [...this.st.m] as State9["m"], dash: this.st.dash.slice() }); }
  restore(): void { const s = this.stack.pop(); if (s) this.st = s; }

  /* ── 변환 ── */
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void { this.st.m = [a, b, c, d, e, f]; }
  resetTransform(): void { this.st.m = [1, 0, 0, 1, 0, 0]; }
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    const m = this.st.m;
    this.st.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
  }
  translate(x: number, y: number): void { this.transform(1, 0, 0, 1, x, y); }
  scale(x: number, y: number): void { this.transform(x, 0, 0, y, 0, 0); }
  rotate(r: number): void { const c = Math.cos(r); const s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }
  private tx(x: number, y: number): number { const m = this.st.m; return m[0] * x + m[2] * y + m[4]; }
  private ty(x: number, y: number): number { const m = this.st.m; return m[1] * x + m[3] * y + m[5]; }
  /** CTM 의 길이 배수 — 획 굵기·호의 마디 수가 이것을 탄다. */
  private mk(): number { const m = this.st.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }

  /* ── 경로 ── */
  beginPath(): void { this.subs = []; this.cur = null; }
  closePath(): void { if (this.cur && this.cur.pts.length >= 2) { this.cur.closed = true; this.cx = this.cur.pts[0]; this.cy = this.cur.pts[1]; this.cur = null; } }
  moveTo(x: number, y: number): void { const X = this.tx(x, y); const Y = this.ty(x, y); this.cur = { pts: [X, Y], closed: false }; this.subs.push(this.cur); this.cx = X; this.cy = Y; }
  private ensure(): Sub9 { if (!this.cur) { this.cur = { pts: [this.cx, this.cy], closed: false }; this.subs.push(this.cur); } return this.cur; }
  lineTo(x: number, y: number): void { const s = this.ensure(); const X = this.tx(x, y); const Y = this.ty(x, y); s.pts.push(X, Y); this.cx = X; this.cy = Y; }
  rect(x: number, y: number, w: number, h: number): void { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    const s = this.ensure();
    const x0 = this.cx; const y0 = this.cy; const X1 = this.tx(cpx, cpy); const Y1 = this.ty(cpx, cpy); const X2 = this.tx(x, y); const Y2 = this.ty(x, y);
    const n = Math.max(4, Math.min(24, Math.ceil(Math.hypot(X2 - x0, Y2 - y0) / 6)));
    for (let i = 1; i <= n; i += 1) { const t = i / n; const u = 1 - t; s.pts.push(u * u * x0 + 2 * u * t * X1 + t * t * X2, u * u * y0 + 2 * u * t * Y1 + t * t * Y2); }
    this.cx = X2; this.cy = Y2;
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    const s = this.ensure();
    const x0 = this.cx; const y0 = this.cy; const X1 = this.tx(c1x, c1y); const Y1 = this.ty(c1x, c1y); const X2 = this.tx(c2x, c2y); const Y2 = this.ty(c2x, c2y); const X3 = this.tx(x, y); const Y3 = this.ty(x, y);
    const n = Math.max(4, Math.min(32, Math.ceil(Math.hypot(X3 - x0, Y3 - y0) / 6)));
    for (let i = 1; i <= n; i += 1) { const t = i / n; const u = 1 - t; s.pts.push(u * u * u * x0 + 3 * u * u * t * X1 + 3 * u * t * t * X2 + t * t * t * X3, u * u * u * y0 + 3 * u * u * t * Y1 + 3 * u * t * t * Y2 + t * t * t * Y3); }
    this.cx = X3; this.cy = Y3;
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): void { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false): void {
    if (!(rx >= 0) || !(ry >= 0)) return;
    let d = a1 - a0;
    if (ccw) { if (d > 0) d -= Math.PI * 2 * Math.ceil(d / (Math.PI * 2)); if (d <= -Math.PI * 2) d = -Math.PI * 2; }
    else { if (d < 0) d += Math.PI * 2 * Math.ceil(-d / (Math.PI * 2)); if (d >= Math.PI * 2) d = Math.PI * 2; }
    const rp = Math.max(rx, ry) * this.mk();
    const full = Math.max(8, Math.min(64, Math.ceil(rp * 1.1)));
    const n = Math.max(1, Math.ceil((full * Math.abs(d)) / (Math.PI * 2)));
    const cr = Math.cos(rot); const sr = Math.sin(rot);
    // 캔버스 규약: 경로가 열려 있으면 현재 점에서 호의 시작으로 선을 잇는다.
    const first = !this.cur;
    for (let i = 0; i <= n; i += 1) {
      const a = a0 + (d * i) / n;
      const px = Math.cos(a) * rx; const py = Math.sin(a) * ry;
      const lx = x + px * cr - py * sr; const ly = y + px * sr + py * cr;
      if (i === 0 && first) this.moveTo(lx, ly); else this.lineTo(lx, ly);
    }
  }

  /* ── 색 ── */
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Grad9 { return new Grad9(0, x0, y0, 0, x1, y1, 0); }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Grad9 { return new Grad9(1, x0, y0, r0, x1, y1, r1); }
  /** 칠할 순간의 변환으로 장치 자리를 낸 그러데이션(단색은 그대로). */
  private styleDev(st: string | Grad9): string | Grad9 {
    if (typeof st === "string") return st;
    return st.dev([...this.st.m] as [number, number, number, number, number, number]);
  }
  createPattern(): null { return null; }
  private mode(): number { return this.st.gco === "lighter" ? 1 : 0; }
  /** 자리 (x, y)의 색(미리곱 전) — 단색이면 그대로, 그러데이션이면 그 자리의 값. */
  private colAt(style: string | Grad9, x: number, y: number, out: number[]): void {
    if (typeof style === "string") { const c = parseCol9(style); out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = c[3]; return; }
    const g = style;
    const ux = g.ux(x, y); const uy = g.uy(x, y);   // 사용자 자리에서 잰다(비균일 배수·회전을 그대로 탄다)
    let t: number;
    if (g.kind === 0) {
      const dx = g.x1 - g.x0; const dy = g.y1 - g.y0; const l2 = dx * dx + dy * dy;
      t = l2 > 0 ? ((ux - g.x0) * dx + (uy - g.y0) * dy) / l2 : 0;
    } else {
      const d = Math.hypot(ux - g.x1, uy - g.y1);
      t = g.r1 > g.r0 ? (d - g.r0) / (g.r1 - g.r0) : (d <= g.r1 ? 0 : 1);
    }
    g.at(Math.max(0, Math.min(1, t)), out);
  }
  private put(mode: number, x: number, y: number, c: number[], ak: number): void {
    const a = c[3] * ak;
    this.sink.vert(mode, null, x, y, 0, 0, c[0] * a, c[1] * a, c[2] * a, a);
  }

  /* ── 채움 ── */
  fill(): void {
    const style = this.styleDev(this.st.fill); const ak = this.st.alpha; const mode = this.mode();
    if (ak <= 0) return;
    const c = this.tmp;
    for (const s of this.subs) {
      const p = s.pts; const n = p.length >> 1;
      if (n < 3) continue;
      // 방사 그러데이션 — 색 멈춤마다 고리를 넣는다(중심 부채꼴만으로는 안쪽 멈춤이 다 사라진다).
      if (typeof style !== "string" && style.kind === 1 && style.stops.length >= 2) { this.fillRadial(s, style, ak, mode); continue; }
      // 선형 그러데이션이 3단 이상이면 멈춤선으로 다각형을 띠로 자른다 — 꼭짓점 사이를 곧게 보간하므로 한 띠 안은 정확하다.
      const pieces = (typeof style !== "string" && style.kind === 0 && style.stops.length > 2) ? this.splitPolyAtStops(p, style) : [p];
      for (const q of pieces) {
        const tri: number[] = [];
        earClip9(q, tri);
        for (let i = 0; i < tri.length; i += 3) {
          for (let k = 0; k < 3; k += 1) { const j = tri[i + k]; this.colAt(style, q[j * 2], q[j * 2 + 1], c); this.put(mode, q[j * 2], q[j * 2 + 1], c, ak); }
        }
      }
    }
  }
  private fillRadial(s: Sub9, g: Grad9, ak: number, mode: number): void {
    const p = s.pts; const n = p.length >> 1;
    const cx = g.dx(g.x1, g.y1); const cy = g.dy(g.x1, g.y1);   // 중심(장치)
    // 고리 반지름 — 멈춤 t 마다 r0 + t·(r1−r0). 바깥 고리는 다각형 자체(그 너머는 끝 색).
    const radii: number[] = []; const cols: number[][] = [];
    const c = [0, 0, 0, 0];
    for (const st of g.stops) { const r = g.r0 + st[0] * (g.r1 - g.r0); if (radii.length && Math.abs(r - radii[radii.length - 1]) < 1e-3) continue; radii.push(r); cols.push([st[1], st[2], st[3], st[4]]); }
    // 다각형 꼭짓점의 중심 거리 — 고리가 다각형 밖으로 나가면 그 꼭짓점에서 잘라 둔다(별꼴 가정).
    // 고리는 **사용자 자리**에서 재고 장치로 옮긴다 — 비균일 배수면 고리가 타원이 된다(캔버스와 같다).
    const ringPt = (i: number, r: number, out: number[]): void => {
      const px = p[i * 2]; const py = p[i * 2 + 1];
      const ux = g.ux(px, py) - g.x1; const uy = g.uy(px, py) - g.y1; const d = Math.hypot(ux, uy);
      if (d <= r || d < 1e-6) { out[0] = px; out[1] = py; }
      else { const kx = g.x1 + (ux * r) / d; const ky = g.y1 + (uy * r) / d; out[0] = g.dx(kx, ky); out[1] = g.dy(kx, ky); }
    };
    const a = [0, 0]; const b = [0, 0]; const c2 = [0, 0]; const d2 = [0, 0];
    // 중심 부채꼴(가장 안쪽 고리까지)
    const c0 = cols[0];
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      ringPt(i, radii[0], a); ringPt(j, radii[0], b);
      this.put(mode, cx, cy, c0, ak); this.put(mode, a[0], a[1], c0, ak); this.put(mode, b[0], b[1], c0, ak);
    }
    // 고리 사이 띠
    for (let k = 0; k + 1 < radii.length; k += 1) {
      const ci = cols[k]; const co = cols[k + 1];
      for (let i = 0; i < n; i += 1) {
        const j = (i + 1) % n;
        ringPt(i, radii[k], a); ringPt(j, radii[k], b); ringPt(i, radii[k + 1], c2); ringPt(j, radii[k + 1], d2);
        this.put(mode, a[0], a[1], ci, ak); this.put(mode, b[0], b[1], ci, ak); this.put(mode, d2[0], d2[1], co, ak);
        this.put(mode, a[0], a[1], ci, ak); this.put(mode, d2[0], d2[1], co, ak); this.put(mode, c2[0], c2[1], co, ak);
      }
    }
    // 바깥 고리 → 다각형 가장자리(끝 색)
    const cl = cols[cols.length - 1]; const rl = radii[radii.length - 1];
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      ringPt(i, rl, a); ringPt(j, rl, b);
      const ex = p[i * 2]; const ey = p[i * 2 + 1]; const fx = p[j * 2]; const fy = p[j * 2 + 1];
      if (Math.abs(ex - a[0]) + Math.abs(ey - a[1]) + Math.abs(fx - b[0]) + Math.abs(fy - b[1]) < 1e-6) continue;
      this.put(mode, a[0], a[1], cl, ak); this.put(mode, b[0], b[1], cl, ak); this.put(mode, fx, fy, cl, ak);
      this.put(mode, a[0], a[1], cl, ak); this.put(mode, fx, fy, cl, ak); this.put(mode, ex, ey, cl, ak);
    }
    void c;
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const keep = this.subs; const cur = this.cur;
    this.subs = []; this.cur = null;
    this.rect(x, y, w, h); this.fill();
    this.subs = keep; this.cur = cur;
  }
  clearRect(): void { /* GL 판은 프레임마다 통째로 비운다 */ }

  /* ── 획 ── */
  stroke(): void {
    const style = this.styleDev(this.st.stroke); const ak = this.st.alpha; const mode = this.mode();
    if (ak <= 0) return;
    const w = this.st.lw * this.mk(); const hw = Math.max(0.35, w / 2);
    const round = this.st.cap === "round"; const sq = this.st.cap === "square";
    for (const s of this.subs) {
      let pts = s.pts;
      if (pts.length < 4) { if (pts.length === 2 && round) this.disc(pts[0], pts[1], hw, style, ak, mode); continue; }
      if (s.closed) pts = pts.concat([pts[0], pts[1]]);
      const runs = this.st.dash.length ? this.dashed(pts) : [pts];
      for (const r of runs) this.strokeLine(r, hw, style, ak, mode, round, sq, s.closed && runs.length === 1);
    }
  }
  /** 꺾은선 한 줄의 획 — **겹치지 않는** 기하로 짠다(캔버스 획은 합집합이라 두 번 덮이는 자리가 없다. 마디마다 네모 +
   *  이음마다 원판을 얹으면 겹친 자리가 더하기 합성(lighter)에서 두 배로 밝고 반투명에서 짙어진다 — 실측: 파편 획의 양 끝에
   *  붉은 점). 안쪽 모서리는 두 마디가 **한 점(안 이음점)** 을 나눠 쓰고, 바깥쪽은 이음 조각(둥근 부채꼴 · 빗면 · 뾰족)만 채운다.
   *  끝은 반원(round) · 늘임(square) · 그대로(butt). */
  private strokeLine(pts: number[], hw: number, style: string | Grad9, ak: number, mode: number, round: boolean, sq: boolean, closed: boolean): void {
    if (typeof style !== "string" && style.kind === 0 && style.stops.length > 2) pts = this.splitAtStops(pts, style);
    let n = pts.length >> 1;
    if (closed && n >= 2 && Math.abs(pts[0] - pts[n * 2 - 2]) + Math.abs(pts[1] - pts[n * 2 - 1]) < 1e-9) n -= 1;   // 닫은 줄의 되풀이 점
    // 길이 0 마디는 걷는다.
    const P: number[] = [pts[0], pts[1]];
    for (let i = 1; i < n; i += 1) { const x = pts[i * 2]; const y = pts[i * 2 + 1]; if (Math.hypot(x - P[P.length - 2], y - P[P.length - 1]) > 1e-6) P.push(x, y); }
    n = P.length >> 1;
    if (closed && n >= 2 && Math.hypot(P[0] - P[n * 2 - 2], P[1] - P[n * 2 - 1]) < 1e-6) { P.length -= 2; n -= 1; }
    if (n < 2) { if (round) this.disc(P[0], P[1], hw, style, ak, mode); return; }
    if (sq && !closed) {
      const l0 = Math.hypot(P[2] - P[0], P[3] - P[1]); P[0] -= ((P[2] - P[0]) / l0) * hw; P[1] -= ((P[3] - P[1]) / l0) * hw;
      const e = n * 2 - 2; const l1 = Math.hypot(P[e] - P[e - 2], P[e + 1] - P[e - 1]); P[e] += ((P[e] - P[e - 2]) / l1) * hw; P[e + 1] += ((P[e + 1] - P[e - 1]) / l1) * hw;
    }
    const segs = closed ? n : n - 1;
    // 마디의 방향·왼 법선
    const dx: number[] = []; const dy: number[] = []; const ln: number[] = [];
    for (let i = 0; i < segs; i += 1) {
      const j = (i + 1) % n; const ex = P[j * 2] - P[i * 2]; const ey = P[j * 2 + 1] - P[i * 2 + 1]; const l = Math.hypot(ex, ey) || 1;
      dx.push(ex / l); dy.push(ey / l); ln.push(l);
    }
    // 꼭짓점마다 네 모서리: [왼 앞(이 점에서 나가는 마디의 시작 왼), 오른 앞, 왼 뒤(들어오는 마디의 끝 왼), 오른 뒤]
    const cL: number[] = new Array(n * 4).fill(0); const cR: number[] = new Array(n * 4).fill(0);   // x,y 앞 · x,y 뒤
    const join: { i: number; side: number; ox0: number; oy0: number; ox1: number; oy1: number; mx: number; my: number; miter: boolean }[] = [];
    for (let v = 0; v < n; v += 1) {
      const x = P[v * 2]; const y = P[v * 2 + 1];
      const hasIn = closed || v > 0; const hasOut = closed || v < n - 1;
      const si = (v - 1 + segs) % segs; const so = v % segs;
      const nix = hasIn ? -dy[si] * hw : 0; const niy = hasIn ? dx[si] * hw : 0;   // 들어오는 마디의 왼 법선
      const nox = hasOut ? -dy[so] * hw : 0; const noy = hasOut ? dx[so] * hw : 0;   // 나가는 마디의 왼 법선
      if (!hasIn) { cL[v * 4] = x + nox; cL[v * 4 + 1] = y + noy; cR[v * 4] = x - nox; cR[v * 4 + 1] = y - noy; continue; }
      if (!hasOut) { cL[v * 4 + 2] = x + nix; cL[v * 4 + 3] = y + niy; cR[v * 4 + 2] = x - nix; cR[v * 4 + 3] = y - niy; continue; }
      const cross = dx[si] * dy[so] - dy[si] * dx[so]; const dot = dx[si] * dx[so] + dy[si] * dy[so];
      if (Math.abs(cross) < 1e-4 && dot > 0) {   // 곧게 이어진다 — 모서리를 나눠 쓴다
        cL[v * 4] = cL[v * 4 + 2] = x + nix; cL[v * 4 + 1] = cL[v * 4 + 3] = y + niy; cR[v * 4] = cR[v * 4 + 2] = x - nix; cR[v * 4 + 1] = cR[v * 4 + 3] = y - niy; continue;
      }
      // 안쪽은 왼 회전(cross > 0)이면 왼쪽. 안 이음점 = 두 법선의 이등분 방향으로 hw / cos(반각).
      const inner = cross > 0 ? 1 : -1;
      let mx = nix + nox; let my = niy + noy; const ml = Math.hypot(mx, my);
      const cosHalf = ml > 1e-9 ? (mx * nix + my * niy) / (ml * hw) : 0;
      const mlen = cosHalf > 1e-3 ? hw / cosHalf : Infinity;
      const fits = mlen < Math.min(ln[si], ln[so]) * 0.999;
      if (fits) { mx = (mx / ml) * mlen * inner; my = (my / ml) * mlen * inner; }
      // 안쪽 모서리(들어오는 끝·나가는 시작이 같은 점) — 안 맞으면 제 수직 모서리(작은 겹침을 받아들인다)
      const setL = (fx: number, fy: number, bx: number, by: number): void => { cL[v * 4] = fx; cL[v * 4 + 1] = fy; cL[v * 4 + 2] = bx; cL[v * 4 + 3] = by; };
      const setR = (fx: number, fy: number, bx: number, by: number): void => { cR[v * 4] = fx; cR[v * 4 + 1] = fy; cR[v * 4 + 2] = bx; cR[v * 4 + 3] = by; };
      if (inner > 0) {   // 안쪽 = 왼
        if (fits) setL(x + mx, y + my, x + mx, y + my); else setL(x + nox, y + noy, x + nix, y + niy);
        setR(x - nox, y - noy, x - nix, y - niy);
        join.push({ i: v, side: -1, ox0: x - nix, oy0: y - niy, ox1: x - nox, oy1: y - noy, mx: -mx, my: -my, miter: fits });
      } else {
        if (fits) setR(x + mx, y + my, x + mx, y + my); else setR(x - nox, y - noy, x - nix, y - niy);
        setL(x + nox, y + noy, x + nix, y + niy);
        join.push({ i: v, side: 1, ox0: x + nix, oy0: y + niy, ox1: x + nox, oy1: y + noy, mx: -mx, my: -my, miter: fits });
      }
    }
    const c0 = [0, 0, 0, 0]; const c1 = [0, 0, 0, 0]; const cm = this.tmp;
    // 마디 네모
    for (let i = 0; i < segs; i += 1) {
      const j = (i + 1) % n;
      const ax = cL[i * 4]; const ay = cL[i * 4 + 1]; const bx = cR[i * 4]; const by = cR[i * 4 + 1];
      const ex = cL[j * 4 + 2]; const ey = cL[j * 4 + 3]; const fx = cR[j * 4 + 2]; const fy = cR[j * 4 + 3];
      this.colAt(style, P[i * 2], P[i * 2 + 1], c0); this.colAt(style, P[j * 2], P[j * 2 + 1], c1);
      this.put(mode, ax, ay, c0, ak); this.put(mode, bx, by, c0, ak); this.put(mode, ex, ey, c1, ak);
      this.put(mode, bx, by, c0, ak); this.put(mode, fx, fy, c1, ak); this.put(mode, ex, ey, c1, ak);
    }
    // 바깥 이음
    const jn = this.st.join;
    for (const q of join) {
      const x = P[q.i * 2]; const y = P[q.i * 2 + 1]; this.colAt(style, x, y, cm);
      if (jn === "round" || round) {
        const a0 = Math.atan2(q.oy0 - y, q.ox0 - x); let a1 = Math.atan2(q.oy1 - y, q.ox1 - x);
        let d = a1 - a0; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; a1 = a0 + d;
        const k = Math.max(1, Math.ceil((Math.abs(d) * hw) / 3));
        for (let t = 0; t < k; t += 1) {
          const b0 = a0 + (d * t) / k; const b1 = a0 + (d * (t + 1)) / k;
          this.put(mode, x, y, cm, ak); this.put(mode, x + Math.cos(b0) * hw, y + Math.sin(b0) * hw, cm, ak); this.put(mode, x + Math.cos(b1) * hw, y + Math.sin(b1) * hw, cm, ak);
        }
      } else if (jn === "miter" && q.miter && Math.hypot(q.mx, q.my) <= this.st.miter * hw) {
        this.put(mode, x, y, cm, ak); this.put(mode, q.ox0, q.oy0, cm, ak); this.put(mode, x + q.mx, y + q.my, cm, ak);
        this.put(mode, x, y, cm, ak); this.put(mode, x + q.mx, y + q.my, cm, ak); this.put(mode, q.ox1, q.oy1, cm, ak);
      } else {
        this.put(mode, x, y, cm, ak); this.put(mode, q.ox0, q.oy0, cm, ak); this.put(mode, q.ox1, q.oy1, cm, ak);
      }
    }
    // 둥근 끝 — 반원(밖으로만)
    if (round && !closed) {
      this.halfDisc(P[0], P[1], -dx[0], -dy[0], hw, style, ak, mode);
      const e = n - 1; this.halfDisc(P[e * 2], P[e * 2 + 1], dx[segs - 1], dy[segs - 1], hw, style, ak, mode);
    }
  }
  /** (ux, uy) 쪽을 보는 반원 부채꼴. */
  private halfDisc(x: number, y: number, ux: number, uy: number, r: number, style: string | Grad9, ak: number, mode: number): void {
    const c = this.tmp; this.colAt(style, x, y, c);
    const a0 = Math.atan2(uy, ux) - Math.PI / 2;
    const n = Math.max(3, Math.min(12, Math.ceil(r * 0.75)));
    for (let i = 0; i < n; i += 1) {
      const b0 = a0 + (Math.PI * i) / n; const b1 = a0 + (Math.PI * (i + 1)) / n;
      this.put(mode, x, y, c, ak); this.put(mode, x + Math.cos(b0) * r, y + Math.sin(b0) * r, c, ak); this.put(mode, x + Math.cos(b1) * r, y + Math.sin(b1) * r, c, ak);
    }
  }
  private disc(x: number, y: number, r: number, style: string | Grad9, ak: number, mode: number): void {
    const c = this.tmp; this.colAt(style, x, y, c);
    const n = Math.max(6, Math.min(24, Math.ceil(r * 1.5)));
    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * Math.PI * 2; const a1 = ((i + 1) / n) * Math.PI * 2;
      this.put(mode, x, y, c, ak); this.put(mode, x + Math.cos(a0) * r, y + Math.sin(a0) * r, c, ak); this.put(mode, x + Math.cos(a1) * r, y + Math.sin(a1) * r, c, ak);
    }
  }
  /** 다각형을 선형 그러데이션의 안쪽 멈춤선마다 반평면으로 잘라 조각을 낸다(서덜랜드-호지먼). */
  private splitPolyAtStops(p: number[], g: Grad9): number[][] {
    const dx = g.x1 - g.x0; const dy = g.y1 - g.y0; const l2 = dx * dx + dy * dy;
    if (l2 <= 0) return [p];
    const tOf = (x: number, y: number): number => ((g.ux(x, y) - g.x0) * dx + (g.uy(x, y) - g.y0) * dy) / l2;
    const clip = (poly: number[], s: number, keepBelow: boolean): number[] => {
      const out: number[] = []; const n = poly.length >> 1;
      for (let i = 0; i < n; i += 1) {
        const j = (i + 1) % n;
        const ax = poly[i * 2]; const ay = poly[i * 2 + 1]; const bx = poly[j * 2]; const by = poly[j * 2 + 1];
        const ta = tOf(ax, ay) - s; const tb = tOf(bx, by) - s;
        const ina = keepBelow ? ta <= 0 : ta >= 0; const inb = keepBelow ? tb <= 0 : tb >= 0;
        if (ina) out.push(ax, ay);
        if (ina !== inb) { const k = ta / (ta - tb); out.push(ax + (bx - ax) * k, ay + (by - ay) * k); }
      }
      return out;
    };
    let pieces = [p];
    for (const st of g.stops) {
      const s = st[0]; if (s <= 0 || s >= 1) continue;
      const next: number[][] = [];
      for (const q of pieces) { const lo = clip(q, s, true); const hi = clip(q, s, false); if (lo.length >= 6) next.push(lo); if (hi.length >= 6) next.push(hi); }
      pieces = next;
    }
    return pieces;
  }
  private splitAtStops(pts: number[], g: Grad9): number[] {
    const dx = g.x1 - g.x0; const dy = g.y1 - g.y0; const l2 = dx * dx + dy * dy;
    if (l2 <= 0) return pts;
    const tOf = (x: number, y: number): number => ((g.ux(x, y) - g.x0) * dx + (g.uy(x, y) - g.y0) * dy) / l2;   // 사용자 자리로 잰다
    const out: number[] = [pts[0], pts[1]];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i]; const y0 = pts[i + 1]; const x1 = pts[i + 2]; const y1 = pts[i + 3];
      const t0 = tOf(x0, y0); const t1 = tOf(x1, y1);
      const cuts: number[] = [];
      for (const st of g.stops) { const t = st[0]; if ((t > Math.min(t0, t1)) && (t < Math.max(t0, t1))) cuts.push((t - t0) / (t1 - t0)); }
      cuts.sort((a, b) => a - b);
      for (const k of cuts) out.push(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
      out.push(x1, y1);
    }
    return out;
  }
  private dashed(pts: number[]): number[][] {
    const d = this.st.dash; const k = this.mk();
    const pat = d.map((v) => Math.max(0.01, v * k)); const per = pat.reduce((a, b) => a + b, 0);
    if (!(per > 0)) return [pts];
    const runs: number[][] = [];
    let pos = ((this.st.dashOff * k) % per + per) % per;
    let di = 0; let left = pat[0];
    while (pos > 0) { const take = Math.min(pos, left); pos -= take; left -= take; if (left <= 1e-9) { di = (di + 1) % pat.length; left = pat[di]; } }
    let on = di % 2 === 0; let cur: number[] | null = on ? [pts[0], pts[1]] : null;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      let x0 = pts[i]; let y0 = pts[i + 1]; const x1 = pts[i + 2]; const y1 = pts[i + 3];
      let seg = Math.hypot(x1 - x0, y1 - y0);
      while (seg > 0) {
        const take = Math.min(seg, left);
        const t = take / seg; const nx = x0 + (x1 - x0) * t; const ny = y0 + (y1 - y0) * t;
        if (on && cur) cur.push(nx, ny);
        seg -= take; left -= take; x0 = nx; y0 = ny;
        if (left <= 1e-9) {
          di = (di + 1) % pat.length; left = pat[di]; on = di % 2 === 0;
          if (on) cur = [x0, y0]; else { if (cur && cur.length >= 4) runs.push(cur); cur = null; }
        }
      }
    }
    if (cur && cur.length >= 4) runs.push(cur);
    return runs;
  }

  /* ── 그림 ── */
  drawImage(img: TexImageSource, a: number, b: number, c?: number, d?: number, e?: number, f?: number, g?: number, h?: number): void {
    const ak = this.st.alpha; if (ak <= 0) return;
    const iw = (img as HTMLCanvasElement).width || 1; const ih = (img as HTMLCanvasElement).height || 1;
    let sx = 0; let sy = 0; let sw = iw; let sh = ih; let dx: number; let dy: number; let dw: number; let dh: number;
    if (e !== undefined && f !== undefined && g !== undefined && h !== undefined) { sx = a; sy = b; sw = c ?? iw; sh = d ?? ih; dx = e; dy = f; dw = g; dh = h; }
    else { dx = a; dy = b; dw = c ?? iw; dh = d ?? ih; }
    const u0 = sx / iw; const v0 = sy / ih; const u1 = (sx + sw) / iw; const v1 = (sy + sh) / ih;
    const mode = this.mode();
    const X = (x: number, y: number): number => this.tx(x, y); const Y = (x: number, y: number): number => this.ty(x, y);
    const p = [X(dx, dy), Y(dx, dy), X(dx + dw, dy), Y(dx + dw, dy), X(dx + dw, dy + dh), Y(dx + dw, dy + dh), X(dx, dy + dh), Y(dx, dy + dh)];
    const s = this.sink;
    s.vert(mode, img, p[0], p[1], u0, v0, ak, ak, ak, ak); s.vert(mode, img, p[2], p[3], u1, v0, ak, ak, ak, ak); s.vert(mode, img, p[4], p[5], u1, v1, ak, ak, ak, ak);
    s.vert(mode, img, p[0], p[1], u0, v0, ak, ak, ak, ak); s.vert(mode, img, p[4], p[5], u1, v1, ak, ak, ak, ak); s.vert(mode, img, p[6], p[7], u0, v1, ak, ak, ak, ak);
  }
  /* 안 받는 것들 — 붓은 오프스크린 캔버스에서만 쓴다. 여기로 오면 조용히 넘긴다. */
  clip(): void {}
  get filter(): string { return "none"; } set filter(_v: string) {}
  fillText(): void {}
  measureText(): { width: number } { return { width: 0 }; }
}
