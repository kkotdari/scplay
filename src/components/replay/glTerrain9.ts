/* ══ GL 벡터 지형층(2026-10-23, 요청: "지형도 타일단위 그린걸 반복사용가능한 방법을 연구해보자" → "1·2·3 중 근본적이고 완벽한 해결책은?" →
   "1 → 3으로 가자, 3 시작해") ═══════════════════════════════════════════════════════════════════════════════════════════════
   지형을 **캔버스에 굽지 않는다**. 지도별 기하(utils/terrainGeom — 갈래마다 깎은 고리 · 색 · 램프 파내기 고리 · 타일 실색)를 한 번 GPU 에
   올리고(정적 VBO), 장마다 카메라(타일 → 화면 px 의 사영 행렬)만 걸어 몸(gl9)과 **같은 판**에 먼저 그린다. 그래서
     · 끌기·줌·입체 어디서도 다시 굽는 일이 없다(옛 ReplayMapVector 는 창을 벗어나거나 배율 칸이 갈릴 때마다 4096² 판을 다시 구웠다).
     · 어느 배율에서도 선이 또렷하다(판을 늘려 깔다 다시 굽는 순간의 흐림이 없다). 테두리 굵기는 타일 자로 장마다 정한다(최소 1 기기 px).
     · 지형과 몸이 한 GL 장이라 손짓 중 두 층이 어긋나는 일이 없다(둘 다 같은 zx·zy 를 지난다).
   ── 그리는 법: **스텐실 홀짝 채우기**(삼각화 없음). 캔버스 fill(path, "evenodd") 와 같은 뜻이다 —
     · 채우기: 고리마다 첫 점에서 부채꼴 삼각형을 스텐실에 INVERT 로 찍고(색 끔), 그 갈래의 상자 사각을 '스텐실 ≠ 0' 으로 덮는다(덮으며 0 으로 되돌린다).
       구멍(고리 안의 고리)도 홀짝이 저절로 판다 — 갈래를 다각형+구멍으로 삼각화해 구멍을 어느 바깥 고리에 붙일지 푸는 일이 없다.
     · 선(물가 그늘 · 마루 테 · 램프 둘레): 고리를 따라 **띠**(점마다 ±법선 · 깎은 곡선이라 마이터로 족하다)를 REPLACE 로 찍고 덮는다.
       띠 굵기는 유니폼(타일 자)이라 장마다 바꿔도 VBO 는 그대로다.
     · 램프 파내기(캔버스의 destination-out): 램프 고리를 둘째 비트에 홀짝으로 찍고(+둘레 띠), 덮을 때 '첫 비트 1 · 둘째 비트 0' 만 지난다.
     · 타일결: w×h 텍셀 RGBA 한 장(NEAREST)을 땅 스텐실 안에 0.62 로 얹는다 — 칸마다 사각형을 칠하던 것과 같은 그림.
   벽띠는 '그 단을 아래로 민 그림'(유니폼 uOff · 타일 자) 두 겹 — 캔버스의 translate 와 같은 식이다.
   ── 카메라: 타일 (x, y) → 화면 CSS px 는 평면이면 아핀, 입체면 **호모그래피**(원근 사영은 평면을 평면으로 보내므로 3×3 하나로 정확하다).
     붓이 지도 네 귀의 화면 자리(posFrac → zx·zy — 유닛과 같은 자)를 주면 여기서 행렬을 푼다(단위 사각 → 사변형 · Heckbert).
     gl_Position 의 w 에 분모를 그대로 실어 텍셀 좌표가 원근 보정으로 보간되게 한다.
   ── 층: **제 GL 캔버스**(.scr-motion-terr9 · z 5400)다 — 몸의 GL 캔버스(6000) 안에 같이 그리면 그 아래에 있던 안개(5500)와 2D 유닛 캔버스의 크립
     (6000 · DOM 앞)을 지형이 덮는다(실측: 크립이 사라지고 안개가 땅을 못 덮었다). 옛 벡터층(캔버스 두 장)이 서 있던 바로 그 자리에 서므로 안개·크립·몸의
     차례가 종전 그대로다. 캔버스 하나에 문맥 하나(브라우저 상한 16 안).
   미니맵·내려받는 PNG·썸네일은 종전대로 캔버스(mapTiles.drawMapGrid)다 — **같은 기하**를 쓰므로 선이 같다. `#glterr=0` 으로 끈다(옛 벡터층). */
import type { TerrainGeom9, TerrLayer9 } from "../../utils/terrainGeom";
import type { Loop } from "../../utils/contour";

/** 진단 `#glterrdbg=N` — N 번째 덮기까지만 그린다(층을 하나씩 켜 보며 어디서 깨지나 본다). */
const TERR_DBG9 = ((): number => { const m = typeof location !== "undefined" ? /glterrdbg=(\d+)/.exec(location.hash) : null; return m ? Number(m[1]) : -1; })();
export const GL_TERR9 = !(typeof location !== "undefined" && /glterr=0/.test(location.hash));
/** ★ **대비 견줌 손잡이**(2026-10-29, 요청: "지형과 모델이 많이 선명해져서 좋은데 대비가 좀 약한 거 같아 원작에 비해" → "대비 적용 전에 강한 대비 테스트해 볼 수 있는
 *  파라미터 추가") — `#con=k`(배수 · 1 그대로 · 예 1.15 · 1.3) · `#conm=m`(축 · 기본 0.5). 미리곱하기 전 색 c 를 (c − m)·k + m 으로 편다.
 *  지형(TERR_FS)·몸(gl9 의 SPR_FS9 · 메시 FS 글자 주입)이 **켜마다** 같은 식을 얹는다 — 아핀이라 알파 합성을 지나도 '다 그린 화면에 한 번 얹은 것'과 같다
 *  (맨 밑 켜가 불투명이므로 · 0·1 자르기만 다르다). CSS filter 는 안 쓴다(GL 캔버스에 걸면 맥 크롬이 그 층을 다시 떠 흐려진다 — player-ui.md '#glfilter').
 *  굽는 판(아틀라스)은 안 탄다(sprBake9 가 굽는 동안 끈다) — 붙일 때 얹으므로 판을 다시 굽지 않고 견준다. 값은 [k − 1, m] — 0 이면 셰이더가 건너뛴다. */
export const CON9: [number, number] = ((): [number, number] => {
  if (typeof location === "undefined") return [0, 0.5];
  const k = /(?:^|[#&,])con=([0-9.]+)/.exec(location.hash); const m = /(?:^|[#&,])conm=([0-9.]+)/.exec(location.hash);
  return [k ? Number(k[1]) - 1 : 0, m ? Number(m[1]) : 0.5];
})();

const TERR_VS = `
attribute vec2 aP; attribute vec2 aN;
uniform mat3 uH; uniform vec2 uCanvas; uniform vec2 uOff; uniform float uHalfW; uniform vec2 uWH;
varying vec2 vUv;
void main() {
  vec2 t = aP + aN * uHalfW + uOff;
  vUv = aP / uWH;
  vec3 p = uH * vec3(t, 1.0);
  // 분모(p.z)를 w 에 싣는다 — 원근 보정 보간(타일결 텍셀이 입체에서 휘지 않게).
  gl_Position = vec4((p.x / uCanvas.x * 2.0 - p.z), (p.z - p.y / uCanvas.y * 2.0), 0.0, p.z);
}`;
const TERR_FS = `
precision mediump float;
uniform vec4 uCol; uniform sampler2D uTex; uniform float uMode; uniform vec2 uCon;
varying vec2 vUv;
void main() {
  vec4 o;
  if (uMode > 0.5) { vec4 t = texture2D(uTex, vUv); o = vec4(t.rgb * t.a, t.a) * uCol.a; }
  else o = uCol;
  // 대비(CON9) — 미리곱하기 전 색에.
  if (uCon.x != 0.0 && o.a > 0.0) o.rgb = clamp((o.rgb / o.a - uCon.y) * (1.0 + uCon.x) + uCon.y, 0.0, 1.0) * o.a;
  gl_FragColor = o;
  //__EMIT0__
}`;

/** GL 안개 한 벌(2026-10-24 · ReplayFogLayer.FogGeom9 가 짓는다) — 밝힘 고리(타일 자 · key 가 바뀌면 다시 올린다) · 눈 목록(x,y,r,id 넷씩 · 타일 자 · 같은 배열이면 안 다시 짓는다) · 색·어둑함. */
export interface GlFog9 { loops: Loop[]; key: number; eyes: Float32Array | null; rgb: [number, number, number]; dim: number }

/** 한 갈래의 GPU 몫 — 채우기 부채꼴(정점 수) · 띠(정점 수) · 타일 자 상자. */
interface Bufs9 { fill: WebGLBuffer | null; nFill: number; strip: WebGLBuffer | null; nStrip: number; box: [number, number, number, number] }

/** 고리들 → 부채꼴 삼각형 정점(x,y). 고리마다 첫 점을 꼭짓점으로 (p0, pi, pi+1). 홀짝 스텐실에 찍으므로 방향·오목은 상관없다. */
function fanOf(loops: Loop[]): Float32Array {
  let n = 0;
  for (const lp of loops) { const m = lp.length >> 1; if (m >= 3) n += (m - 2) * 3; }
  const a = new Float32Array(n * 2);
  let o = 0;
  for (const lp of loops) {
    const m = lp.length >> 1;
    if (m < 3) continue;
    const x0 = lp[0]; const y0 = lp[1];
    for (let i = 1; i < m - 1; i += 1) {
      a[o] = x0; a[o + 1] = y0;
      a[o + 2] = lp[i * 2]; a[o + 3] = lp[i * 2 + 1];
      a[o + 4] = lp[i * 2 + 2]; a[o + 5] = lp[i * 2 + 3];
      o += 6;
    }
  }
  return a;
}
/** 고리들 → 띠 정점(x, y, nx, ny) 삼각형. 점마다 이웃 두 변의 법선을 평균한 마이터(2.5 로 자른다 — 지도 귀의 직각도 선이 안 터진다). */
function stripOf(loops: Loop[]): Float32Array {
  let n = 0;
  for (const lp of loops) { const m = lp.length >> 1; if (m >= 2) n += m * 6; }
  const a = new Float32Array(n * 4);
  let o = 0;
  for (const lp of loops) {
    const m = lp.length >> 1;
    if (m < 2) continue;
    const nx = new Float64Array(m); const ny = new Float64Array(m);
    for (let i = 0; i < m; i += 1) {
      const ip = (i + m - 1) % m; const inx = (i + 1) % m;
      let ax = lp[i * 2] - lp[ip * 2]; let ay = lp[i * 2 + 1] - lp[ip * 2 + 1];
      let bx = lp[inx * 2] - lp[i * 2]; let by = lp[inx * 2 + 1] - lp[i * 2 + 1];
      const la = Math.hypot(ax, ay) || 1; const lb = Math.hypot(bx, by) || 1;
      ax /= la; ay /= la; bx /= lb; by /= lb;
      // 변의 법선(왼쪽) 둘의 평균 → 마이터.
      const n1x = -ay; const n1y = ax; const n2x = -by; const n2y = bx;
      let mx = n1x + n2x; let my = n1y + n2y;
      const lm = Math.hypot(mx, my);
      if (lm < 1e-6) { mx = n1x; my = n1y; } else {
        mx /= lm; my /= lm;
        const d = mx * n1x + my * n1y;
        const s = Math.min(2.5, 1 / Math.max(0.4, d));
        mx *= s; my *= s;
      }
      nx[i] = mx; ny[i] = my;
    }
    for (let i = 0; i < m; i += 1) {
      const j = (i + 1) % m;
      const xi = lp[i * 2]; const yi = lp[i * 2 + 1]; const xj = lp[j * 2]; const yj = lp[j * 2 + 1];
      // (i+, i-, j+) (i-, j-, j+)
      a[o] = xi; a[o + 1] = yi; a[o + 2] = nx[i]; a[o + 3] = ny[i];
      a[o + 4] = xi; a[o + 5] = yi; a[o + 6] = -nx[i]; a[o + 7] = -ny[i];
      a[o + 8] = xj; a[o + 9] = yj; a[o + 10] = nx[j]; a[o + 11] = ny[j];
      a[o + 12] = xi; a[o + 13] = yi; a[o + 14] = -nx[i]; a[o + 15] = -ny[i];
      a[o + 16] = xj; a[o + 17] = yj; a[o + 18] = -nx[j]; a[o + 19] = -ny[j];
      a[o + 20] = xj; a[o + 21] = yj; a[o + 22] = nx[j]; a[o + 23] = ny[j];
      o += 24;
    }
  }
  return a;
}
function boxOf(loops: Loop[], pad: number): [number, number, number, number] {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const lp of loops) for (let i = 0; i < lp.length; i += 2) { const x = lp[i]; const y = lp[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (!Number.isFinite(x0)) return [0, 0, 0, 0];
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

/** 단위 사각(0,0)(1,0)(1,1)(0,1) → 사변형 호모그래피(Heckbert). 열 우선 mat3 로 돌려준다(타일 자는 1/W·1/H 를 접어 넣는다). */
function homography9(q: number[], W: number, H: number): Float32Array {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const sx = x0 - x1 + x2 - x3; const sy = y0 - y1 + y2 - y3;
  let a: number; let b: number; let c: number; let d: number; let e: number; let f: number; let g: number; let h: number;
  if (Math.abs(sx) < 1e-6 && Math.abs(sy) < 1e-6) {
    a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; g = 0; h = 0;
  } else {
    const dx1 = x1 - x2; const dx2 = x3 - x2; const dy1 = y1 - y2; const dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
    g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  // 열 우선: 1열 (a d g)/W · 2열 (b e h)/H · 3열 (c f 1)
  return new Float32Array([a / W, d / W, g / W, b / H, e / H, h / H, c, f, 1]);
}

export class GlTerrain9 {
  private prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private aP: number; private aN: number;
  private geom: TerrainGeom9 | null = null;
  private land: Bufs9 | null = null;
  private levels: (Bufs9 | null)[] = [];
  private cliffs: (Bufs9 | null)[] = [];
  private ramps: (Bufs9 | null)[] = [];
  private ramp: Bufs9 | null = null;
  private tex: WebGLTexture | null = null;
  private quad: WebGLBuffer;
  private nAttr = 8;
  private bufs: WebGLBuffer[] = [];
  /** 진단 — 올린 정점 수 · 올리는 데 든 ms · 지난 장의 드로 콜. */
  stat = { verts: 0, buildMs: 0, draws: 0, bytes: 0, err: 0, stencil: -1, fb: 0, fogEyes: 0, fogVerts: 0 };
  /* 안개 — 밝힘 고리 부채꼴(key 마다) · 눈 원 부채꼴(눈 배열·배율 칸마다). 둘 다 동적 VBO. */
  private fogFan: WebGLBuffer | null = null; private nFogFan = 0; private fogKey = -1;
  private eyeFan: WebGLBuffer | null = null; private nEyeFan = 0; private eyeSrc: Float32Array | null = null; private eyePpt = 0;
  constructor(private readonly gl: WebGLRenderingContext | WebGL2RenderingContext, mkProg: (vs: string, fs: string) => WebGLProgram,
    private readonly divisor: (loc: number, d: number) => void = () => {}) {
    this.prog = mkProg(TERR_VS, TERR_FS);
    for (const u of ["uH", "uCanvas", "uOff", "uHalfW", "uWH", "uCol", "uTex", "uMode", "uCon"]) this.loc[u] = gl.getUniformLocation(this.prog, u);
    this.aP = gl.getAttribLocation(this.prog, "aP"); this.aN = gl.getAttribLocation(this.prog, "aN");
    this.quad = gl.createBuffer()!;
    this.nAttr = Math.max(2, Number(gl.getParameter(gl.MAX_VERTEX_ATTRIBS)) || 8);
  }
  /** 지도가 갈리면 GPU 몫을 다시 짓는다(기하는 지도마다 한 번 · 여기도 한 번). */
  private ensure(G: TerrainGeom9): void {
    if (this.geom === G) return;
    const gl = this.gl; const t0 = performance.now();
    for (const b of this.bufs) gl.deleteBuffer(b);
    this.bufs = []; this.stat.verts = 0; this.stat.bytes = 0;
    const up = (arr: Float32Array): WebGLBuffer | null => {
      if (arr.length === 0) return null;
      const b = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      this.bufs.push(b); this.stat.bytes += arr.byteLength; return b;
    };
    const mk = (loops: Loop[], strip: boolean): Bufs9 | null => {
      if (loops.length === 0) return null;
      const f = fanOf(loops); const s = strip ? stripOf(loops) : new Float32Array(0);
      this.stat.verts += f.length / 2 + s.length / 4;
      return { fill: up(f), nFill: f.length / 2, strip: up(s), nStrip: s.length / 4, box: boxOf(loops, 1.5) };
    };
    const ly = (l: TerrLayer9, strip: boolean): Bufs9 | null => mk(l.loops, strip);
    this.land = ly(G.land, true);
    this.levels = G.levels.map((l) => ly(l, true));
    this.cliffs = G.cliffs.map((l) => ly(l, false));
    this.ramps = G.ramps.map((l) => ly(l, false));
    this.ramp = G.rampLoops ? mk(G.rampLoops, true) : null;
    if (this.tex) { gl.deleteTexture(this.tex); this.tex = null; }
    if (G.tileRGBA) {
      this.tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, G.w, G.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, G.tileRGBA);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    this.geom = G;
    this.stat.buildMs = performance.now() - t0;
  }
  /** 지형 한 장 — 몸보다 먼저, 깊이 없이. `quad` 는 지도 네 귀 (0,0)(W,0)(W,H)(0,H) 의 화면 CSS px(x,y 여덟 수) · `wallScale` 벽띠 배수(평면 2 · 입체 4) ·
   *  `dprK` 기기 px/CSS px(최소 선 굵기 1 기기 px 의 자). 호출자가 판·가위·뷰포트를 걸어 둔 채 부른다. 끝나면 블렌드(ONE, 1−a)·깊이 켬 상태로 돌려 둔다. */
  draw(G: TerrainGeom9, quad: number[], cw: number, ch: number, wallScale: number, dprK: number, fog: GlFog9 | null = null): void {
    const gl = this.gl;
    this.ensure(G);
    this.stat.draws = 0;
    const W = G.w; const H = G.h;
    const Hm = homography9(quad, W, H);
    // 한 타일의 화면 CSS px(위변 기준) — 선 굵기의 최소(1 기기 px)를 타일 자로.
    const cssPerTile = Math.hypot(quad[2] - quad[0], quad[3] - quad[1]) / Math.max(1, W);
    const minW = 1 / Math.max(1e-3, cssPerTile * dprK);
    gl.useProgram(this.prog);
    gl.uniformMatrix3fv(this.loc.uH, false, Hm);
    gl.uniform2f(this.loc.uCanvas, cw, ch);
    gl.uniform2f(this.loc.uWH, W, H);
    gl.uniform2f(this.loc.uOff, 0, 0);
    gl.uniform1f(this.loc.uHalfW, 0);
    gl.uniform1f(this.loc.uMode, 0);
    gl.uniform1i(this.loc.uTex, 0);
    gl.uniform2f(this.loc.uCon, CON9[0], CON9[1]);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    /* ★ 딴 패스가 켜 둔 정점 배열을 **다 끈다** — 몸 패스(bindMesh9)는 메시 속성 여덟을 켠 채 두고, 그 버퍼는 메시 하나 크기다. 그대로 두고 6만 정점을
       그리면 WebGL 이 '배열 범위 밖'(INVALID_OPERATION)으로 드로 콜을 통째로 버린다(실측: 앱에서 땅 채우기만 온 지도를 덮고 등고선이 하나도 안 섰다 —
       독립 하네스에서는 멀쩡했다). 뒤 패스들은 제 속성을 장마다 다시 켠다. */
    for (let i = 0; i < this.nAttr; i += 1) { gl.disableVertexAttribArray(i); this.divisor(i, 0); }
    gl.enableVertexAttribArray(this.aP);
    gl.vertexAttrib2f(this.aN, 0, 0);
    const col = (c: [number, number, number], a: number): void => gl.uniform4f(this.loc.uCol, (c[0] / 255) * a, (c[1] / 255) * a, (c[2] / 255) * a, a);
    const rect = (x0: number, y0: number, x1: number, y1: number): void => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1]), gl.DYNAMIC_DRAW);
      gl.disableVertexAttribArray(this.aN); gl.vertexAttrib2f(this.aN, 0, 0);
      gl.vertexAttribPointer(this.aP, 2, gl.FLOAT, false, 8, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6); this.stat.draws += 1;
    };
    const box = (b: Bufs9): void => rect(Math.max(0, b.box[0]), Math.max(0, b.box[1]), Math.min(W, b.box[2]), Math.min(H, b.box[3] + 0.55 * wallScale * 1.01));
    /** 스텐실에 채우기 홀짝(INVERT · 비트 mask). */
    const fanStencil = (b: Bufs9, mask: number, ox: number, oy: number): void => {
      if (!b.fill) return;
      gl.stencilMask(mask); gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
      gl.uniform2f(this.loc.uOff, ox, oy);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.fill);
      gl.disableVertexAttribArray(this.aN); gl.vertexAttrib2f(this.aN, 0, 0);
      gl.vertexAttribPointer(this.aP, 2, gl.FLOAT, false, 8, 0);
      gl.drawArrays(gl.TRIANGLES, 0, b.nFill); this.stat.draws += 1;
      gl.uniform2f(this.loc.uOff, 0, 0);
    };
    /** 스텐실에 띠(REPLACE ref · 비트 mask). */
    const stripStencil = (b: Bufs9, mask: number, ref: number, halfW: number): void => {
      if (!b.strip) return;
      gl.stencilMask(mask); gl.stencilFunc(gl.ALWAYS, ref, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
      gl.uniform1f(this.loc.uHalfW, halfW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.strip);
      gl.enableVertexAttribArray(this.aN);
      gl.vertexAttribPointer(this.aP, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(this.aN, 2, gl.FLOAT, false, 16, 8);
      gl.drawArrays(gl.TRIANGLES, 0, b.nStrip); this.stat.draws += 1;
      gl.uniform1f(this.loc.uHalfW, 0);
    };
    /** 램프 파내기 — 둘째 비트에 램프 홀짝 + 둘레 띠(캔버스 0.7 굵기 = 반 0.35). */
    const rampCut = (): void => {
      if (!this.ramp) return;
      fanStencil(this.ramp, 0x02, 0, 0);
      stripStencil(this.ramp, 0x02, 0x02, 0.35);
    };
    /** 덮기 — 첫 비트 1(·둘째 0)인 자리에 색. 지난 자리는 0 으로 되돌리고, 그 뒤 상자 전체의 스텐실을 비운다. */
    let nCover9 = 0;
    const cover = (b: Bufs9, cut: boolean, paint: () => void): void => {
      nCover9 += 1;
      const skip9 = TERR_DBG9 >= 0 && nCover9 > TERR_DBG9;
      gl.colorMask(!skip9, !skip9, !skip9, !skip9);
      gl.stencilMask(0xff);
      if (cut) gl.stencilFunc(gl.EQUAL, 0x01, 0x03); else gl.stencilFunc(gl.NOTEQUAL, 0, 0x01);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
      paint();
      box(b);
      if (cut) {   // 램프 비트가 남은 자리까지 비운다.
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
        box(b);
        gl.colorMask(true, true, true, true);
      }
    };
    const begin = (): void => { gl.colorMask(false, false, false, false); };

    gl.enable(gl.STENCIL_TEST);
    gl.stencilMask(0xff);
    gl.clearStencil(0);
    gl.clear(gl.STENCIL_BUFFER_BIT);

    // ① 바탕 — 물·우주. 지도 사각 전체.
    gl.disable(gl.STENCIL_TEST);
    col(G.water.rgb, 1);
    rect(0, 0, W, H);
    gl.enable(gl.STENCIL_TEST);

    // ② 땅: 물가 그늘(땅 윤곽 굵게 · 바깥 반만 남는다) → 땅 채우기.
    const lip = Math.max(minW, 0.22);
    if (this.land) {
      begin(); stripStencil(this.land, 0x01, 0x01, lip);
      cover(this.land, false, () => col([0, 0, 0], 0.30));
      begin(); fanStencil(this.land, 0x01, 0, 0);
      cover(this.land, false, () => col(G.land.rgb, 1));
    }

    // ③ 고도 단 — 벽띠 두 겹(램프 둘레 파냄) → 제 단 색 → 마루 테(램프 둘레 파냄).
    const wallUnit = 0.55 * wallScale;
    const rim = Math.max(minW, 0.09) * 0.5;
    for (let L = 1; L <= 3; L += 1) {
      const b = this.levels[L - 1]; const lay = G.levels[L - 1];
      if (!b || !lay || lay.loops.length === 0) continue;
      begin(); fanStencil(b, 0x01, 0, wallUnit * 0.45); rampCut();
      cover(b, !!this.ramp, () => col([6, 10, 20], 0.30));
      begin(); fanStencil(b, 0x01, 0, wallUnit); rampCut();
      cover(b, !!this.ramp, () => col([6, 10, 20], 0.14));
      begin(); fanStencil(b, 0x01, 0, 0);
      cover(b, false, () => col(lay.rgb, 1));
      begin(); stripStencil(b, 0x01, 0x01, rim); rampCut();
      cover(b, !!this.ramp, () => col([255, 255, 255], 0.34));
    }
    // ④ 절벽면 · ⑤ 램프.
    for (let L = 1; L <= 3; L += 1) {
      const b = this.cliffs[L - 1]; const lay = G.cliffs[L - 1];
      if (!b || !lay || lay.loops.length === 0) continue;
      begin(); fanStencil(b, 0x01, 0, 0); cover(b, false, () => col(lay.rgb, 1));
    }
    for (let L = 0; L <= 3; L += 1) {
      const b = this.ramps[L]; const lay = G.ramps[L];
      if (!b || !lay || lay.loops.length === 0) continue;
      begin(); fanStencil(b, 0x01, 0, 0); cover(b, false, () => col(lay.rgb, 1));
    }
    // ⑥ 타일결 — 땅 안에만 0.62.
    if (this.tex && this.land) {
      begin(); fanStencil(this.land, 0x01, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      cover(this.land, false, () => { gl.uniform1f(this.loc.uMode, 1); gl.uniform4f(this.loc.uCol, 0, 0, 0, 0.62); });
      gl.uniform1f(this.loc.uMode, 0);
    }
    /* ══ 안개(2026-10-24, 요청: "안개도 지형처럼") — 지형 위 · 같은 장 · 같은 카메라. 캔버스 안개와 같은 뜻: 지도 전체 = 안개 1 → 밝힌 고리 안 = DIM →
       시야 원 안 = 0. 스텐실 두 비트로 가른다 — bit0 = 밝힘 홀짝(부채꼴 INVERT) · bit1 = 시야 원(REPLACE). 덮기 둘: (0,0) 짙게 · (1,0) 옅게. 시야 원은
       타일 자의 진짜 원이라 입체(호모그래피)에서도 바닥에 눕는다. 밝힘 고리는 FogGeom9 가 뜸하게 다시 뽑고(key), 눈 원은 눈 배열이 갈릴 때 다시 짓는다. */
    if (fog) {
      if (fog.key !== this.fogKey) {
        const f = fanOf(fog.loops);
        if (!this.fogFan) this.fogFan = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fogFan!); gl.bufferData(gl.ARRAY_BUFFER, f, gl.DYNAMIC_DRAW);
        this.nFogFan = f.length / 2; this.fogKey = fog.key;
      }
      const pptQ = Math.max(1, Math.round(cssPerTile * dprK / 16) * 16);   // 배율 칸(16 기기 px · 옛 8 — 2026-10-24 줌 손짓마다 눈 원 88k 정점을 다시 짓는 횟수 반) — 그 안에서는 눈 원의 조각 수가 같다
      if (fog.eyes !== this.eyeSrc || pptQ !== this.eyePpt) {
        const e = fog.eyes; let nv = 0; const segOf = (r: number): number => Math.max(8, Math.min(40, Math.round((2 * Math.PI * r * pptQ) / 6)));
        if (e) for (let i = 0; i + 2 < e.length; i += 4) if (e[i + 2] > 0) nv += segOf(e[i + 2]) * 3;
        const a = new Float32Array(nv * 2); let o = 0;
        if (e) for (let i = 0; i + 2 < e.length; i += 4) {
          const cx = e[i]; const cy = e[i + 1]; const r = e[i + 2]; if (!(r > 0)) continue;
          const n = segOf(r);
          for (let k = 0; k < n; k += 1) {
            const a0 = (k / n) * Math.PI * 2; const a1 = ((k + 1) / n) * Math.PI * 2;
            a[o] = cx; a[o + 1] = cy; a[o + 2] = cx + r * Math.cos(a0); a[o + 3] = cy + r * Math.sin(a0); a[o + 4] = cx + r * Math.cos(a1); a[o + 5] = cy + r * Math.sin(a1); o += 6;
          }
        }
        if (!this.eyeFan) this.eyeFan = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.eyeFan!); gl.bufferData(gl.ARRAY_BUFFER, a, gl.DYNAMIC_DRAW);
        this.nEyeFan = nv; this.eyeSrc = fog.eyes; this.eyePpt = pptQ;
        this.stat.fogEyes = e ? e.length >> 2 : 0; this.stat.fogVerts = nv;
      }
      const fanRaw = (buf: WebGLBuffer | null, n: number, mask: number, invert: boolean): void => {
        if (!buf || n <= 0) return;
        gl.stencilMask(mask);
        if (invert) { gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT); }
        else { gl.stencilFunc(gl.ALWAYS, mask, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); }
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.disableVertexAttribArray(this.aN); gl.vertexAttrib2f(this.aN, 0, 0);
        gl.vertexAttribPointer(this.aP, 2, gl.FLOAT, false, 8, 0);
        gl.drawArrays(gl.TRIANGLES, 0, n); this.stat.draws += 1;
      };
      gl.uniform1f(this.loc.uMode, 0); gl.uniform2f(this.loc.uOff, 0, 0); gl.uniform1f(this.loc.uHalfW, 0);
      gl.colorMask(false, false, false, false);
      fanRaw(this.fogFan, this.nFogFan, 0x01, true);
      fanRaw(this.eyeFan, this.nEyeFan, 0x02, false);
      gl.colorMask(true, true, true, true);
      gl.stencilMask(0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      gl.stencilFunc(gl.EQUAL, 0, 0x03); col(fog.rgb, 1); rect(0, 0, W, H);
      gl.stencilFunc(gl.EQUAL, 1, 0x03); col(fog.rgb, fog.dim); rect(0, 0, W, H);
      gl.colorMask(false, false, false, false);
      gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO); rect(0, 0, W, H);
      gl.colorMask(true, true, true, true);
    }
    gl.disable(gl.STENCIL_TEST);
    gl.stencilMask(0xff);
    gl.colorMask(true, true, true, true);
    gl.disableVertexAttribArray(this.aP); gl.disableVertexAttribArray(this.aN);
    gl.depthMask(true);
    if (TERR_DBG9 >= 0) { this.stat.err = gl.getError(); this.stat.stencil = Number(gl.getParameter(gl.STENCIL_BITS)); this.stat.fb = gl.getParameter(gl.FRAMEBUFFER_BINDING) ? 1 : 0; }
  }
}

/** 지형층의 **제 캔버스**(.scr-motion-terr9) — 문맥 하나·프로그램 하나·장마다 지우고 그린다. 분할 칸은 가위(clip · 기기 px)로 칸만. */
export class GlTerrCanvas9 {
  readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
  readonly terr: GlTerrain9;
  dead = false;
  constructor(readonly canvas: HTMLCanvasElement) {
    const opts = { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: true };
    let gl0: WebGLRenderingContext | WebGL2RenderingContext | null = canvas.getContext("webgl2", opts) as WebGL2RenderingContext | null;
    const gl2 = !!gl0;
    if (!gl0) gl0 = canvas.getContext("webgl", opts) as WebGLRenderingContext | null;
    if (!gl0) throw new Error("webgl 없음");
    const gl = gl0; this.gl = gl;
    if (!gl.getParameter(gl.STENCIL_BITS)) throw new Error("스텐실 없음");
    const es3 = (src: string, frag: boolean): string => {
      if (!gl2) return src;
      let t = src.replace(/^\s*\n/, "");
      if (frag) {
        t = t.replace(/\bvarying\b/g, "in").replace(/\btexture2D\s*\(/g, "texture(").replace(/\bgl_FragColor\b/g, "fragColor");
        t = t.replace("precision mediump float;", "precision mediump float;\nlayout(location = 0) out vec4 fragColor;");
      } else t = t.replace(/\battribute\b/g, "in").replace(/\bvarying\b/g, "out");
      return "#version 300 es\n" + t;
    };
    const mk = (vs: string, fs: string): WebGLProgram => {
      const p = gl.createProgram()!;
      for (const [ty, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as [number, string][]) {
        const sh = gl.createShader(ty)!; gl.shaderSource(sh, es3(src, ty === gl.FRAGMENT_SHADER)); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("지형 셰이더: " + gl.getShaderInfoLog(sh));
        gl.attachShader(p, sh);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("지형 링크: " + gl.getProgramInfoLog(p));
      return p;
    };
    this.terr = new GlTerrain9(gl, mk);
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.dead = true; });
  }
  /** 한 장 — bw·bh 배킹(기기 px · 몸 캔버스와 같게) · cw·ch CSS px · quad 지도 네 귀(CSS px) · clip 가위(CSS px 왼위·오른아래 · 분할 칸) */
  draw(G: TerrainGeom9, quad: number[], bw: number, bh: number, cw: number, ch: number, wallScale: number, clip: [number, number, number, number] | null, fog: GlFog9 | null = null): boolean {
    if (this.dead) return false;
    const gl = this.gl; const cv = this.canvas;
    if (cv.width !== bw) cv.width = bw;
    if (cv.height !== bh) cv.height = bh;
    gl.viewport(0, 0, bw, bh);
    if (clip) {
      const k = bw / Math.max(1, cw);
      const x0 = Math.max(0, Math.floor(clip[0] * k)); const x1 = Math.min(bw, Math.ceil(clip[2] * k));
      const y0 = Math.max(0, Math.floor(bh - clip[3] * k)); const y1 = Math.min(bh, Math.ceil(bh - clip[1] * k));
      if (x1 <= x0 || y1 <= y0) return true;
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
    } else gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.stencilMask(0xff);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    this.terr.draw(G, quad, cw, ch, wallScale, bw / Math.max(1, cw), fog);
    gl.disable(gl.SCISSOR_TEST);
    return true;
  }
}
const TERR_CV9 = new WeakMap<HTMLCanvasElement, GlTerrCanvas9 | null>();
/** 진단·perf-check 가 읽는 마지막 지형층. */
export let glTerrLast9: GlTerrCanvas9 | null = null;
/** 캔버스마다 하나 — 못 열면(GL 없음·스텐실 없음) null 로 굳는다(부르는 쪽이 옛 벡터층으로 물러난다). */
export function glTerrCanvas9(cv: HTMLCanvasElement): GlTerrCanvas9 | null {
  let t = TERR_CV9.get(cv);
  if (t !== undefined) return t;
  try { t = new GlTerrCanvas9(cv); } catch (e) { console.warn("[glTerrain9]", e); t = null; }
  TERR_CV9.set(cv, t);
  glTerrLast9 = t;
  (globalThis as unknown as { __terr9?: GlTerrCanvas9 | null }).__terr9 = t;
  return t;
}
