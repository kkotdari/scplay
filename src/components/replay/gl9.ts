/* ── WebGL 유닛 붓 시제(2026-09, #gl=1) ─────────────────────────────────────────────
   판 굽기(빌더 → 경로 문자열 → Path2D → 캔버스 판 → 블릿) 대신, 빌더가 낸 **3D 메시**(mesh9.collectMesh9 — 판 모형
   공간)를 종류·자세마다 한 번 GPU 에 올리고, 프레임마다 요잉·자리·크기·임자색을 유니폼으로 걸어 곧장 그린다.
   · 카메라는 평면(top) 시점 하나를 정점 셰이더가 그대로 흉내 낸다(project 와 같은 식: 요잉 → x 원근 f → y = ry·sinE − z·cosE).
     화면 자리는 판 블릿과 같은 자(앵커 = (sx, sy − px·0.24 − lift), 배수 = px/16·MODEL_NORM, 원점 (8, 12)).
   · 앞뒤는 깊이 버퍼가 가른다 — 개체 차례(화가 순서)로 깊이 칸을 나누고 칸 안에서 카메라 가까움(ry·cosE + z·sinE)으로 잰다.
   · 조명은 면 법선(뉴얼) 한 방향광 양면 — 2D 의 흑백 덧칠 면은 메시에서 뺐다(mesh9.isOverlay9).
   · 임자색 면(fill 없음)은 정점의 team 깃발로 표시하고 uTeam 으로 칠한다.
   한계(시제): 유닛만(건물·데칼·그림자·체력바는 캔버스가 그대로), 평면 시점만(pitch 면 캔버스로), 머리 요잉·불빛·회전 깃발은 0. */
import { SHAPE_BUILDERS, poseSet9, poseNow, headYawSet } from "./bake9";
import { collectMesh9 } from "../../utils/mesh9";

export interface GlInst9 {
  kind: string; pose: number;
  /** 앵커(CSS px): 판 블릿의 setTransform 자리 — (sx, sy − px·0.24 − lift). */
  ax: number; ay: number;
  /** 모델 16-상자 한 변의 화면 px(op.sizePx·zoom) 과 종류 배수(MODEL_NORM). */
  px: number; nrm: number;
  yawDeg: number; color: string; alpha: number;
}
interface GlMesh9 { vbo: WebGLBuffer; n: number }

const STRIDE = 11;   // pos3 · nrm3 · rgb3 · team1 · alpha1
const VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aRgb; attribute float aTeam; attribute float aAlpha;
uniform vec2 uAnchor; uniform vec3 uScale; uniform vec2 uYaw; uniform vec2 uCanvas; uniform vec2 uCam;
uniform vec3 uTeam; uniform vec3 uLight; uniform float uAlpha; uniform float uDepth0; uniform float uDepthK; uniform float uPersp;
varying vec4 vCol;
void main() {
  float rx = aPos.x * uYaw.x + aPos.y * uYaw.y;
  float ry = -aPos.x * uYaw.y + aPos.y * uYaw.x;
  float f = uPersp / (uPersp - clamp(ry, -10.0, 10.0));
  float X = uAnchor.x + uScale.x * rx * f;
  float Y = uAnchor.y + uScale.y * (ry * uCam.x - aPos.z * uCam.y) + uScale.z;
  float near = ry * uCam.y + aPos.z * uCam.x;
  gl_Position = vec4(X / uCanvas.x * 2.0 - 1.0, 1.0 - Y / uCanvas.y * 2.0, uDepth0 - near * uDepthK, 1.0);
  vec3 n = vec3(aNrm.x * uYaw.x + aNrm.y * uYaw.y, -aNrm.x * uYaw.y + aNrm.y * uYaw.x, aNrm.z);
  float lit = abs(dot(normalize(n), uLight));
  vec3 base = mix(aRgb, uTeam, aTeam);
  vCol = vec4(base * (0.6 + 0.45 * lit), aAlpha * uAlpha);
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
const LIGHT = ((): [number, number, number] => { const v = [-0.9, 0.45, 1.0]; const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();

export class GlUnits9 {
  readonly gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private att: Record<string, number> = {};
  private meshes = new Map<string, GlMesh9 | null>();
  private queue: GlInst9[] = [];
  /** 진단: 마지막 프레임의 개체 수·삼각형 수·메시 굽기 ms. */
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
    for (const u of ["uAnchor", "uScale", "uYaw", "uCanvas", "uCam", "uTeam", "uLight", "uAlpha", "uDepth0", "uDepthK", "uPersp"]) this.loc[u] = gl.getUniformLocation(p, u);
    for (const a of ["aPos", "aNrm", "aRgb", "aTeam", "aAlpha"]) this.att[a] = gl.getAttribLocation(p, a);
  }
  /** 종류·자세의 메시 — 처음 볼 때 빌더를 요잉 0 으로 한 번 돌려 올린다(1~7ms). 메시가 없으면 null(캔버스가 그린다). */
  meshOf(kind: string, pose: number): GlMesh9 | null {
    const key = `${kind}:${pose}`;
    const got = this.meshes.get(key);
    if (got !== undefined) return got;
    const b = SHAPE_BUILDERS[kind];
    if (!b) { this.meshes.set(key, null); return null; }
    const t0 = performance.now();
    const prevPose = poseNow;
    poseSet9(pose); headYawSet(0);
    let mesh: GlMesh9 | null = null;
    try {
      const m = collectMesh9(b);
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
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.STATIC_DRAW);
        mesh = { vbo, n: out.length / STRIDE };
      }
    } finally { poseSet9(prevPose); }
    this.stat.bakeMs += performance.now() - t0;
    this.stat.meshes += 1;
    this.meshes.set(key, mesh);
    return mesh;
  }
  has(kind: string, pose: number): boolean { return this.meshOf(kind, pose) !== null; }
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
    gl.uniform2f(this.loc.uCam, CAM[0], CAM[1]);
    gl.uniform3f(this.loc.uLight, LIGHT[0], LIGHT[1], LIGHT[2]);
    gl.uniform1f(this.loc.uPersp, 48);
    const slot = 2 / (q.length + 1);
    gl.uniform1f(this.loc.uDepthK, slot / 80);
    for (let i = 0; i < q.length; i += 1) {
      const it = q[i];
      const mesh = this.meshOf(it.kind, it.pose);
      if (!mesh) continue;
      const th = (it.yawDeg * Math.PI) / 180;
      const [tr, tg, tb] = hexRgb(it.color);
      const k = (it.px / 16) * it.nrm;
      gl.uniform2f(this.loc.uAnchor, it.ax, it.ay);
      gl.uniform3f(this.loc.uScale, k, k, (it.px / 16) * 4);
      gl.uniform2f(this.loc.uYaw, Math.cos(th), Math.sin(th));
      gl.uniform3f(this.loc.uTeam, tr, tg, tb);
      gl.uniform1f(this.loc.uAlpha, it.alpha);
      gl.uniform1f(this.loc.uDepth0, 1 - slot * (i + 1));
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      const F = 4;
      gl.enableVertexAttribArray(this.att.aPos); gl.vertexAttribPointer(this.att.aPos, 3, gl.FLOAT, false, STRIDE * F, 0);
      gl.enableVertexAttribArray(this.att.aNrm); gl.vertexAttribPointer(this.att.aNrm, 3, gl.FLOAT, false, STRIDE * F, 3 * F);
      gl.enableVertexAttribArray(this.att.aRgb); gl.vertexAttribPointer(this.att.aRgb, 3, gl.FLOAT, false, STRIDE * F, 6 * F);
      gl.enableVertexAttribArray(this.att.aTeam); gl.vertexAttribPointer(this.att.aTeam, 1, gl.FLOAT, false, STRIDE * F, 9 * F);
      gl.enableVertexAttribArray(this.att.aAlpha); gl.vertexAttribPointer(this.att.aAlpha, 1, gl.FLOAT, false, STRIDE * F, 10 * F);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
      this.stat.tris += mesh.n / 3;
    }
  }
}
/** #gl=1 — 시제 스위치(메인 스레드에서만 뜻이 있다). */
export const GL_ON9 = typeof location !== "undefined" && /(^|[#&])gl=1/.test(location.hash);
let glInst9: GlUnits9 | null | undefined;
/** 유닛 층의 GL 붓 — 캔버스가 있을 때 한 번 만든다. 못 만들면(WebGL 없음) null 로 굳어 캔버스 길로 돈다. */
export function glUnits9(cv: HTMLCanvasElement | null): GlUnits9 | null {
  if (!GL_ON9 || !cv) return null;
  if (glInst9 !== undefined && (glInst9 === null || glInst9.canvas === cv)) return glInst9;
  try { glInst9 = new GlUnits9(cv); } catch (e) { console.warn("[gl9]", e); glInst9 = null; }
  return glInst9;
}
