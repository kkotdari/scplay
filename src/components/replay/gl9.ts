/* ── WebGL 유닛 붓 시제(2026-09, #gl=1) ─────────────────────────────────────────────
   판 굽기(빌더 → 경로 문자열 → Path2D → 캔버스 판 → 블릿) 대신, 빌더가 낸 **3D 메시**(mesh9.collectMesh9 — 판 모형
   공간)를 종류·자세마다 한 번 GPU 에 올리고, 프레임마다 요잉·자리·크기·임자색을 유니폼으로 걸어 곧장 그린다.
   · 카메라는 평면(top) 시점 하나를 정점 셰이더가 그대로 흉내 낸다(project 와 같은 식: 요잉 → x 원근 f → y = ry·sinE − z·cosE).
     화면 자리는 판 블릿과 같은 자(앵커 = (sx, sy − px·0.24 − lift), 배수 = px/16·MODEL_NORM, 원점 (8, 12)).
   · 앞뒤는 깊이 버퍼가 가른다 — 개체 차례(화가 순서)로 깊이 칸을 나누고 칸 안에서 카메라 가까움(ry·cosE + z·sinE)으로 잰다.
   · 조명은 면 법선(뉴얼) 한 방향광 양면 — 2D 의 흑백 덧칠 면은 메시에서 뺐다(mesh9.isOverlay9).
   · 임자색 면(fill 없음)은 정점의 team 깃발로 표시하고 uTeam 으로 칠한다.
   한계(시제): 유닛만(건물·데칼·그림자·체력바는 캔버스가 그대로), 평면 시점만(pitch 면 캔버스로), 머리 요잉·불빛·회전 깃발은 0. */
import { SHAPE_BUILDERS, poseSet9, poseNow, headYawSet, headYawNow, headAimNow, bldLitSet, bldLitNow, bldSpinRawSet9, bldSpinNow, stageFaces, headTag, litTag, spinTag } from "./bake9";
import { lodFilter, type ShapeFace } from "../../utils/shapeOblique";
import { collectMesh9 } from "../../utils/mesh9";
import type { UnitDrawOp } from "./engine9";

export interface GlInst9 {
  mesh: GlMesh9;
  /** 앵커(CSS px) — 유닛: 판 블릿의 setTransform 자리 (sx, sy − px·0.24 − lift) · 건물: (sx, 바닥선 − 띄움). */
  ax: number; ay: number;
  /** 화면 배수 = (상자 px/16)·종류 배수(MODEL_NORM/BLD_NORM). */
  k: number;
  /** 세로 원점 몫(CSS px) — 유닛 (px/16)·4(원점 (8,12) → 상자 가운데) · 건물 −k·bot(잉크 바닥을 바닥선에). */
  yoff: number;
  yawDeg: number; color: string; alpha: number;
  /** 카메라 — 평면(CAM_TOP9) 또는 입체(camPitch9(눌림, vq)). */
  cam: GlCam9;
  /** 몸 그림자(2D 의 shadowPlate 몫) — 몸을 검게 dy 만큼 아래에 한 번 더 그린다. */
  shadow?: { dy: number; alpha: number };
}
/** 카메라 — squash(앞뒤 납작비)·zk(높이 배율)·lean(z→앞뒤, 입체 0.34)·shear(시각 밀림 tan(vq), 입체만). project() 의 식 그대로. */
export interface GlCam9 { squash: number; zk: number; lean: number; shear: number; key: string }
/** 요잉별 화면 상자 — 모델 16-상자 자(배수·px 전): x 폭·x 가운데·바닥(가장 아래 화면 y = ry·sinE − z·cosE 의 최댓값). */
export interface GlFoot9 { w: number; cx: number; bot: number }
export interface GlMesh9 { vbo: WebGLBuffer; n: number; verts: Float32Array; foot: Map<string, GlFoot9> }

const STRIDE = 11;   // pos3 · nrm3 · rgb3 · team1 · alpha1
const MESH_MAX9 = 600;   // 메시 상한(종류×자세×LOD + 건물 변종) — 넘으면 오래된 것부터
const VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aRgb; attribute float aTeam; attribute float aAlpha;
uniform vec2 uAnchor; uniform vec3 uScale; uniform vec2 uYaw; uniform vec2 uCanvas; uniform vec2 uCam;
uniform vec3 uTeam; uniform vec3 uLight; uniform float uAlpha; uniform float uDepth0; uniform float uDepthK; uniform float uPersp;
uniform vec4 uShade; uniform float uDy; uniform vec2 uLean;
varying vec4 vCol;
void main() {
  float rx = aPos.x * uYaw.x + aPos.y * uYaw.y;
  float ry = -aPos.x * uYaw.y + aPos.y * uYaw.x;
  float f = uPersp / (uPersp - clamp(ry, -10.0, 10.0));
  // project() 와 같은 식 — 평면: 납작비 sinE·높이 cosE · 입체: 납작비 pitchSquash·높이 0.9, 앞숙임 z·0.34, 시각 밀림 ry·납작비·tan(vq)
  float ry2 = ry + aPos.z * uLean.x;
  float X = uAnchor.x + uScale.x * (rx + ry * uCam.x * uLean.y) * f;
  float Y = uAnchor.y + uScale.y * (ry2 * uCam.x - aPos.z * uCam.y) + uScale.z + uDy;
  float near = ry * uCam.y + aPos.z * uCam.x;
  gl_Position = vec4(X / uCanvas.x * 2.0 - 1.0, 1.0 - Y / uCanvas.y * 2.0, uDepth0 - near * uDepthK, 1.0);
  vec3 n = vec3(aNrm.x * uYaw.x + aNrm.y * uYaw.y, -aNrm.x * uYaw.y + aNrm.y * uYaw.x, aNrm.z);
  float lit = abs(dot(normalize(n), uLight));
  vec3 base = mix(aRgb, uTeam, aTeam);
  vCol = uShade.a > 0.0 ? vec4(uShade.rgb, uShade.a * aAlpha) : vec4(base * (0.6 + 0.45 * lit), aAlpha * uAlpha);
}`;
const FS = `
precision mediump float; varying vec4 vCol;
void main() { gl_FragColor = vCol; }`;

const hexRgb = (s: string): [number, number, number] => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return [0.5, 0.5, 0.5];
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
};
const TOP_ELEV = (40 * Math.PI) / 180;   // shapeOblique.TOP_ELEV9 와 같은 값
const CAM: [number, number] = [Math.sin(TOP_ELEV), Math.cos(TOP_ELEV)];
export const CAM_TOP9: GlCam9 = { squash: CAM[0], zk: CAM[1], lean: 0, shear: 0, key: "t" };
/** 입체 카메라 — pitchSquash(= pitchFlatNow·0.7)·높이 0.9·앞숙임 0.34·시각 밀림 tan(vq). vq 는 6° 눈금이라 열쇠가 적다. */
const CAMS9 = new Map<string, GlCam9>();
/** 카메라 — 평면(vq 0 이면 CAM_TOP9 그대로) 또는 입체(pitchSquash = pitchFlatNow·0.7 · 높이 0.9 · 앞숙임 0.34) + 시각 밀림 tan(vq).
 *  같은 열쇠면 같은 객체라 그리기에서 유니폼을 한 번만 건다. */
export function camOf9(pitch: boolean, pitchSquash: number, vq: number): GlCam9 {
  if (!pitch && !vq) return CAM_TOP9;
  const key = pitch ? `p${pitchSquash.toFixed(3)}:${vq}` : `t:${vq}`;
  let c = CAMS9.get(key);
  if (!c) {
    const shear = vq ? Math.tan((vq * Math.PI) / 180) : 0;
    c = pitch ? { squash: pitchSquash, zk: 0.9, lean: 0.34, shear, key } : { squash: CAM[0], zk: CAM[1], lean: 0, shear, key };
    CAMS9.set(key, c);
  }
  return c;
}
const LIGHT = ((): [number, number, number] => { const v = [-0.9, 0.45, 1.0]; const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();

export class GlUnits9 {
  readonly gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private att: Record<string, number> = {};
  private meshes = new Map<string, GlMesh9 | null>();
  private queue: GlInst9[] = [];
  /** 진단: 마지막 프레임의 개체 수·삼각형 수·메시 수·메시 굽기 ms. */
  stat = { inst: 0, tris: 0, bakeMs: 0, meshes: 0 };
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true, depth: true });
    if (!gl) throw new Error("webgl 없음");
    this.gl = gl;
    const sh = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("셰이더: " + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("링크: " + gl.getProgramInfoLog(p));
    this.prog = p;
    for (const u of ["uAnchor", "uScale", "uYaw", "uCanvas", "uCam", "uTeam", "uLight", "uAlpha", "uDepth0", "uDepthK", "uPersp", "uShade", "uDy", "uLean"]) this.loc[u] = gl.getUniformLocation(p, u);
    for (const a of ["aPos", "aNrm", "aRgb", "aTeam", "aAlpha"]) this.att[a] = gl.getAttribLocation(p, a);
  }
  /** 열쇠별 메시 — 처음 볼 때 run()(빌더를 요잉 0 으로 한 번 돌리는 일, 1~7ms)으로 짓는다. 못 지으면 null 로 굳는다. */
  private meshFor(key: string, run: () => { parts: { polys: number[][]; fill: string; alpha: number; team: boolean }[] }): GlMesh9 | null {
    const got = this.meshes.get(key);
    if (got !== undefined) return got;
    const t0 = performance.now();
    let mesh: GlMesh9 | null = null;
    try {
      const m = run();
      // 불투명 부품 먼저(깊이 쓰기), 반투명은 뒤에 — 한 버퍼에 차례로 담는다.
      const parts = [...m.parts].sort((p, q) => (q.alpha >= 0.98 ? 1 : 0) - (p.alpha >= 0.98 ? 1 : 0));
      const out: number[] = [];
      for (const part of parts) {
        const [r, g, bl] = part.team ? [0, 0, 0] : hexRgb(part.fill);
        const team = part.team ? 1 : 0;
        for (const poly of part.polys) {
          const n = poly.length / 3; if (n < 3) continue;
          let nx = 0, ny = 0, nz = 0;
          for (let i = 0; i < n; i += 1) {
            const j = (i + 1) % n;
            const px = poly[i * 3], py = poly[i * 3 + 1], pz = poly[i * 3 + 2];
            const qx = poly[j * 3], qy = poly[j * 3 + 1], qz = poly[j * 3 + 2];
            nx += (py - qy) * (pz + qz); ny += (pz - qz) * (px + qx); nz += (px - qx) * (py + qy);
          }
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          const put = (i: number): void => { out.push(poly[i * 3], poly[i * 3 + 1], poly[i * 3 + 2], nx, ny, nz, r, g, bl, team, part.alpha); };
          for (let i = 1; i + 1 < n; i += 1) { put(0); put(i); put(i + 1); }
        }
      }
      if (out.length) {
        const gl = this.gl;
        const vbo = gl.createBuffer()!;
        const verts = new Float32Array(out);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        mesh = { vbo, n: out.length / STRIDE, verts, foot: new Map() };
      }
    } catch (e) { console.warn("[gl9] 메시", key, e); }
    this.stat.bakeMs += performance.now() - t0;
    this.stat.meshes += 1;
    if (this.meshes.size >= MESH_MAX9) {
      // 가장 오래된 것부터 버린다(Map 삽입 차례) — 포탑 각·건설 단계처럼 열쇠가 잘게 갈리는 건물이 쌓이지 않게.
      const first = this.meshes.keys().next();
      if (!first.done) { const m = this.meshes.get(first.value); if (m) this.gl.deleteBuffer(m.vbo); this.meshes.delete(first.value); }
    }
    this.meshes.set(key, mesh);
    return mesh;
  }
  /** 유닛 메시 — 종류·자세(머리 요잉 0). */
  unitMesh(kind: string, pose: number, lod = 3): GlMesh9 | null {
    const b = SHAPE_BUILDERS[kind]; if (!b) return null;
    return this.meshFor(`u:${kind}:${pose}:${lod}`, () => {
      const prevPose = poseNow;
      poseSet9(pose); headYawSet(0);
      try { return collectMesh9(b, lod >= 3 ? undefined : (f: ShapeFace[]) => lodFilter(f, lod)); } finally { poseSet9(prevPose); }
    });
  }
  /** 건물 메시 — 종류 · 건설 단계 · 불빛 · 회전 칸 · 포탑 각(rasterBld9 와 같은 깃발·같은 열쇠 조각). */
  bldMesh(op: UnitDrawOp, lod = 3): GlMesh9 | null {
    const b = SHAPE_BUILDERS[op.kind]; if (!b) return null;
    const stg = op.buildStage ?? 0;
    const head = op.headDeg === undefined ? 0 : (((op.headDeg - (op.rotDeg ?? 0)) % 360) + 540) % 360 - 180;
    const aim = op.headDeg !== undefined;
    const set = (): void => { headYawSet(head, aim); bldLitSet(!!op.lit); bldSpinRawSet9(op.spin ?? 0); poseSet9(0); };
    const pH = headYawNow; const pA = headAimNow; const pL = bldLitNow; const pS = bldSpinNow; const pP = poseNow;
    set();
    try {
      const key = `b:${op.kind}:${stg}:${headTag(op.kind)}:${litTag(op.kind)}:${spinTag(op.kind)}:${lod}`;
      return this.meshFor(key, () => { set(); return collectMesh9(b, (f: ShapeFace[]) => stageFaces(lod >= 3 ? f : lodFilter(f, lod), stg)); });
    } finally { headYawSet(pH, pA); bldLitSet(pL); bldSpinRawSet9(pS); poseSet9(pP); }
  }
  /** 요잉의 화면 상자 — 모델 16-상자 자. 정점 셰이더와 같은 식으로 모든 꼭짓점을 돌려 재고(메시·각도당 한 번) 기억한다. */
  footOf(mesh: GlMesh9, yawDeg: number, cam: GlCam9 = CAM_TOP9): GlFoot9 {
    const yk = Math.round(yawDeg);
    const key = cam === CAM_TOP9 ? `${yk}` : `${yk}|${cam.key}`;
    const got = mesh.foot.get(key);
    if (got) return got;
    const th = (yk * Math.PI) / 180; const c = Math.cos(th); const sn = Math.sin(th);
    let minX = Infinity; let maxX = -Infinity; let bot = -Infinity;
    const v = mesh.verts;
    for (let i = 0; i < v.length; i += STRIDE) {
      const x = v[i]; const y = v[i + 1]; const z = v[i + 2];
      const rx = x * c + y * sn; const ry = -x * sn + y * c;
      const f = 48 / (48 - Math.max(-10, Math.min(10, ry)));
      const X = (rx + ry * cam.squash * cam.shear) * f; const Y = (ry + z * cam.lean) * cam.squash - z * cam.zk;
      if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y > bot) bot = Y;
    }
    const ft = { w: maxX - minX, cx: (minX + maxX) / 2, bot };
    mesh.foot.set(key, ft);
    return ft;
  }
  push(inst: GlInst9): void { this.queue.push(inst); }
  /** 프레임 하나 — 캔버스 크기(기기 px)·CSS 크기를 맞추고 큐를 차례로 그린다. */
  flush(bw: number, bh: number, cw: number, ch: number): void {
    const gl = this.gl; const cv = this.canvas;
    if (cv.width !== bw) cv.width = bw;
    if (cv.height !== bh) cv.height = bh;
    gl.viewport(0, 0, bw, bh);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const q = this.queue; this.queue = [];
    this.stat.inst = q.length; this.stat.tris = 0;
    if (!q.length) return;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.prog);
    gl.uniform2f(this.loc.uCanvas, cw, ch);
    gl.uniform3f(this.loc.uLight, LIGHT[0], LIGHT[1], LIGHT[2]);
    gl.uniform1f(this.loc.uPersp, 48);
    const slot = 2 / (q.length + 1);
    gl.uniform1f(this.loc.uDepthK, slot / 80);
    const F = 4;
    const bind = (mesh: GlMesh9): void => {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      gl.enableVertexAttribArray(this.att.aPos); gl.vertexAttribPointer(this.att.aPos, 3, gl.FLOAT, false, STRIDE * F, 0);
      gl.enableVertexAttribArray(this.att.aNrm); gl.vertexAttribPointer(this.att.aNrm, 3, gl.FLOAT, false, STRIDE * F, 3 * F);
      gl.enableVertexAttribArray(this.att.aRgb); gl.vertexAttribPointer(this.att.aRgb, 3, gl.FLOAT, false, STRIDE * F, 6 * F);
      gl.enableVertexAttribArray(this.att.aTeam); gl.vertexAttribPointer(this.att.aTeam, 1, gl.FLOAT, false, STRIDE * F, 9 * F);
      gl.enableVertexAttribArray(this.att.aAlpha); gl.vertexAttribPointer(this.att.aAlpha, 1, gl.FLOAT, false, STRIDE * F, 10 * F);
    };
    let camNow: GlCam9 | null = null;
    const place = (it: GlInst9): void => {
      const th = (it.yawDeg * Math.PI) / 180;
      gl.uniform2f(this.loc.uAnchor, it.ax, it.ay);
      gl.uniform3f(this.loc.uScale, it.k, it.k, it.yoff);
      gl.uniform2f(this.loc.uYaw, Math.cos(th), Math.sin(th));
      if (it.cam !== camNow) { camNow = it.cam; gl.uniform2f(this.loc.uCam, it.cam.squash, it.cam.zk); gl.uniform2f(this.loc.uLean, it.cam.lean, it.cam.shear); }
    };
    /* 1) 몸 그림자 — 깊이 없이 검게 아래로 밀어 한 번(2D shadowPlate 의 흐림은 없다). 몸보다 먼저라 뒤 몸 위에는 안 얹힌다. */
    gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
    for (const it of q) {
      if (!it.shadow) continue;
      const mesh = it.mesh;
      bind(mesh); place(it);
      gl.uniform4f(this.loc.uShade, 0, 0, 0, it.shadow.alpha);
      gl.uniform1f(this.loc.uDy, it.shadow.dy);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
    }
    /* 2) 몸 — 개체 차례로 깊이 칸을 나눠 그린다. */
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
    gl.uniform4f(this.loc.uShade, 0, 0, 0, 0);
    gl.uniform1f(this.loc.uDy, 0);
    for (let i = 0; i < q.length; i += 1) {
      const it = q[i];
      const mesh = it.mesh;
      const [tr, tg, tb] = hexRgb(it.color);
      bind(mesh); place(it);
      gl.uniform3f(this.loc.uTeam, tr, tg, tb);
      gl.uniform1f(this.loc.uAlpha, it.alpha);
      gl.uniform1f(this.loc.uDepth0, 1 - slot * (i + 1));
      gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
      this.stat.tris += mesh.n / 3;
    }
  }
}
/** #gl=1 — 시제 스위치(메인 스레드에서만 뜻이 있다). */
export const GL_ON9 = typeof location !== "undefined" && /(^|[#&])gl=1/.test(location.hash);
let glInst9: GlUnits9 | null | undefined;
/** 지금 선 GL 붓(없으면 null) — 붓 밖(데우기 등)에서 메시를 미리 지을 때. */
export const glNow9 = (): GlUnits9 | null => glInst9 ?? null;
/** 유닛 층의 GL 붓 — 캔버스가 있을 때 한 번 만든다. 못 만들면(WebGL 없음) null 로 굳어 캔버스 길로 돈다. */
export function glUnits9(cv: HTMLCanvasElement | null): GlUnits9 | null {
  if (!GL_ON9 || !cv) return null;
  if (glInst9 !== undefined && (glInst9 === null || glInst9.canvas === cv)) return glInst9;
  try { glInst9 = new GlUnits9(cv); } catch (e) { console.warn("[gl9]", e); glInst9 = null; }
  return glInst9;
}
