/* ── WebGL 유닛 붓 시제(2026-09, #gl=1) ─────────────────────────────────────────────
   판 굽기(빌더 → 경로 문자열 → Path2D → 캔버스 판 → 블릿) 대신, 빌더가 낸 **3D 메시**(mesh9.collectMesh9 — 판 모형
   공간)를 종류·자세마다 한 번 GPU 에 올리고, 프레임마다 요잉·자리·크기·임자색을 유니폼으로 걸어 곧장 그린다.
   · 카메라는 평면(top) 시점 하나를 정점 셰이더가 그대로 흉내 낸다(project 와 같은 식: 요잉 → x 원근 f → y = ry·sinE − z·cosE).
     화면 자리는 판 블릿과 같은 자(앵커 = (sx, sy − px·0.24 − lift), 배수 = px/16·MODEL_NORM, 원점 (8, 12)).
   · 앞뒤는 깊이 버퍼가 가른다 — 개체 차례(화가 순서)로 깊이 칸을 나누고 칸 안에서 카메라 가까움(ry·cosE + z·sinE)으로 잰다.
   · 조명은 면 법선(뉴얼) 한 방향광 양면 — 2D 의 흑백 덧칠 면은 메시에서 뺐다(mesh9.isOverlay9).
   · 임자색 면(fill 없음)은 정점의 team 깃발로 표시하고 uTeam 으로 칠한다.
   한계(시제): 유닛만(건물·데칼·그림자·체력바는 캔버스가 그대로), 평면 시점만(pitch 면 캔버스로), 머리 요잉·불빛·회전 깃발은 0. */
import { SHAPE_BUILDERS, poseSet9, poseNow, headYawSet, headYawNow, headAimNow, bldLitSet, bldLitNow, bldSpinRawSet9, bldSpinNow, stageFaces, headTag, litTag, spinTag, tone9, autoTier } from "./bake9";
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
  /** 카메라 — 평면(CAM_TOP9) 또는 입체(camOf9). */
  cam: GlCam9;
  /** 실루엣 빛의 상자 — 반지름(px, 모델 16-상자 대각선의 반)과 상자 가운데의 앵커 기준 세로 몫(유닛 0 · 건물 −8·k). */
  gradR: number; gradCy: number;
  /** 몸 그림자 — `ground` 면 **빛 방향으로 바닥(z=0)에 눌러 붙인 진짜 그림자**(아래 uShadow), 아니면 몸을 검게
   *  dy 만큼 아래로 밀어 한 번 더 그린다(떠 있는 몸은 그 벌어짐이 곧 높이로 읽힌다). */
  shadow?: { ground?: boolean; dy?: number; alpha: number;
    /** **나는 높이**(모형 칸) — 바닥에 눕힐 때 꼭짓점 z 에 더한다. 그만큼 그림자가 빛 방향으로 멀리 눕는다(공중 유닛). */
    h?: number };
  /** 효과 — add: 더하기 합성(2D 의 lighter) · flat: 음영·실루엣 빛 없이 제 색 그대로(2D 효과판과 같다). 깊이도 안 쓴다. */
  add?: boolean; flat?: boolean;
}
/** 카메라 — squash(앞뒤 납작비)·zk(높이 배율)·lean(z→앞뒤, 입체 0.34)·shear(시각 밀림 tan(vq), 입체만). project() 의 식 그대로. */
export interface GlCam9 { squash: number; zk: number; lean: number; shear: number; key: string }
/** 요잉별 화면 상자 — 모델 16-상자 자(배수·px 전): x 폭·x 가운데·바닥(가장 아래 화면 y = ry·sinE − z·cosE 의 최댓값). */
export interface GlFoot9 { w: number; cx: number; bot: number; top: number }
/** nSolid: 앞쪽 정점 수(불투명 부품) · 그 뒤는 반투명(깊이를 안 쓰고 겹쳐 섞는다).
 *  데칼(한 장짜리 작은 부품 — 2D 가 벽 안쪽에 그려 두고 화가 차례로 위에 얹던 줄무늬·창·환풍구)의 깊이 편향은 정점(aOrd)에 든다. */
/** pts: footOf 용 **겹치지 않는 꼭짓점 xyz** 만의 사본(정점 사본을 통째로 들면 메시당 270KB — 폰 메모리) · bytes: VBO 크기 · cols: 색 가짓수(진단). */
export interface GlMesh9 { vbo: WebGLBuffer; n: number; nSolid: number; bias: number; pts: Float32Array; bytes: number; cols: number; foot: Map<string, GlFoot9> }

/* 정점 36바이트(예전 float 15개 60바이트): pos3·nrm3(빌보드면 원반 가운데) float · rgb3+team1 바이트(정규화) · alpha·덧칠 흰·검·빌보드 바이트(정규화) ·
   부품 차례 float. 0~1 값은 바이트 정규화로 충분하다(색 자체가 8비트, 알파·덧칠 1/255). 폰에서 메시 표(상한 240벌)가 메모리의 큰 몫이라 줄였다. */
const STRIDE_B = 36;
const MESH_MAX9 = 600;   // 메시 상한 기본(종류×자세×LOD + 건물 변종) — 넘으면 오래된 것부터. 기기 표(DEV9.glMeshMax)가 덮는다(폰 240).
const VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aRgb; attribute float aTeam; attribute float aAlpha; attribute vec2 aOv; attribute float aOrd; attribute float aBb;
uniform vec2 uAnchor; uniform vec3 uScale; uniform vec2 uYaw; uniform vec2 uCanvas; uniform vec2 uCam;
uniform vec3 uTeam; uniform vec3 uLight; uniform float uAlpha; uniform float uDepth0; uniform float uDepthK; uniform float uPersp;
uniform vec4 uShade; uniform float uDy; uniform vec2 uLean;
/* 바닥 그림자 — (빛의 화면 기울기 x, y, 켬). 켜면 꼭짓점을 **빛 방향으로 밀어 z 를 0 으로** 눌러, 몸의 실루엣이
   바닥에 눕는다(2D 의 흐린 판 그림자가 하던 몫을 기하로 낸다 — 높은 부품일수록 멀리 눕는다). */
uniform vec4 uShadow;   // (빛 기울기 x, y, 켬, 나는 높이)
/* 그림자 켜의 **못 박은 깊이** — 0 이면 안 쓴다. 한 켜의 모든 삼각형이 같은 깊이를 쓰면, 깊이 쓰기를 켠 채
   LESS 로 그릴 때 **한 화소에 한 번만** 칠해진다(겹친 부품·겹친 개체가 두 번 어두워지지 않는다). */
uniform float uShZ;
uniform float uFlat;  // 효과(발광): 1 이면 음영·실루엣 빛·방향광 없이 제 색
uniform float uDbg;   // 진단 #glshade=0..2(0 덧칠 없음 · 1 덧칠 · 2 +실루엣 빛)
uniform vec4 uGrad;   // 실루엣 빛(silhouetteLight): 화면 빛 방향 (x,y) · 모델 상자 반지름 R · 상자 가운데의 앵커 기준 세로 몫
varying vec4 vCol;
void main() {
  /* aBb 한 칸에 표식 둘이 들었다: **128 닫힌 입체**(등진 낯을 걷는다) · **255 빌보드 원반**(카메라를 본다). */
  float bill = aBb > 0.9 ? 1.0 : 0.0;
  float solid = (aBb > 0.4 && aBb < 0.9) ? 1.0 : 0.0;
  /* 빌보드 원반: 카메라를 보게 기록한 판이라 요잉을 안 돌린다 — 원반 가운데(aNrm 에 실림)만 돌리고 둘레는 그 자리에서 편다. */
  vec3 pc = bill > 0.5 ? aNrm : aPos;
  vec3 pd = bill > 0.5 ? aPos - aNrm : vec3(0.0);
  float rx = pc.x * uYaw.x + pc.y * uYaw.y + pd.x;
  float ry = -pc.x * uYaw.y + pc.y * uYaw.x + pd.y;
  /* 그림자: 요잉을 돈 뒤(세계 자)에서 빛 방향으로 밀고 높이를 0 으로 — 몸과 같은 카메라를 타므로 바닥에 딱 눕는다. */
  /* 나는 높이(uShadow.w)를 z 에 더해 눕힌다 — 공중 유닛의 그림자는 몸 바로 밑이 아니라 그 높이만큼 빛 방향으로 멀다. */
  rx += (aPos.z + uShadow.w) * uShadow.x * uShadow.z;
  ry += (aPos.z + uShadow.w) * uShadow.y * uShadow.z;
  float pz = aPos.z * (1.0 - uShadow.z);
  float f = uPersp / (uPersp - clamp(ry, -10.0, 10.0));
  // project() 와 같은 식 — 평면: 납작비 sinE·높이 cosE · 입체: 납작비 pitchSquash·높이 0.9, 앞숙임 z·0.34, 시각 밀림 ry·납작비·tan(vq)
  float ry2 = ry + pz * uLean.x;
  float X = uAnchor.x + uScale.x * (rx + ry * uCam.x * uLean.y) * f;
  float Y = uAnchor.y + uScale.y * (ry2 * uCam.x - pz * uCam.y) + uScale.z + uDy;
  float near = ry * uCam.y + pz * uCam.x;
  /* 깊이 = 개체 칸(uDepth0) − 카메라 가까움 − **부품 차례**(aOrd: 빌더가 칠하는 차례, 0→1). 지붕 위 환풍구·장식처럼 같은
     평면에 얹힌 부품은 가까움이 같아 깊이 싸움이 나는데, 2D 는 나중에 칠한 것이 이긴다 — 그 규칙을 작은 편향(aOrd, 모델 칸)으로 준다. */
  gl_Position = vec4(X / uCanvas.x * 2.0 - 1.0, 1.0 - Y / uCanvas.y * 2.0,
    uShZ > 0.0 ? uShZ : uDepth0 - (near + aOrd) * uDepthK, 1.0);
  vec3 n = normalize(vec3(aNrm.x * uYaw.x + aNrm.y * uYaw.y, -aNrm.x * uYaw.y + aNrm.y * uYaw.x, aNrm.z));
  /* ★ **닫힌 입체의 등진 낯은 걷는다**(aBb 128) — 그 덩이의 뒷면은 어차피 앞면이 깊이로 덮으므로 그림은 안 바뀌고,
     버는 것은 화소 채우기(덩이 넓이의 절반)다. 법선은 mesh9 가 감기를 맞춰 **바깥**을 보게 실어 둔 것이다. */
  if (solid > 0.5 && dot(n, vec3(0.0, uCam.y, uCam.x)) < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec4(0.0); return;
  }
  // 법선의 앞뒤는 감기 차례에 달렸다 — 카메라(0, cosE, sinE) 쪽을 보게 뒤집는다(보이는 면은 늘 카메라를 본다).
  if (dot(n, vec3(0.0, uCam.y, uCam.x)) < 0.0) n = -n;
  vec3 base = mix(aRgb, uTeam, aTeam);
  /* 2D 와 같은 두 겹: ① 면마다 얹혀 있던 흰·검 덧칠(aOv — 메시에 접어 둔 값, 요잉 0 에서 굽은 것이라 모델과 함께 돈다)
     ② 실루엣 빛(silhouetteLight) — 모델 상자 안에서 왼위(흰 0.18) → 오른아래(검 0.42) 기울기.
     여기에 법선 방향광을 아주 옅게(±6%) 얹어 요잉해도 입체가 읽히게 한다. */
  float t = ((X - uAnchor.x) * uGrad.x + (Y - uAnchor.y - uGrad.w) * uGrad.y) / max(uGrad.z, 1.0);
  float gw = t < -0.08 ? 0.18 * min(1.0, (-t - 0.08) / 0.92) : 0.0;
  float gb = t > 0.08 ? 0.42 * min(1.0, (t - 0.08) / 0.92) : 0.0;
  if (uDbg < 2.0 || uFlat > 0.5) { gw = 0.0; gb = 0.0; }
  vec2 ov = (uDbg < 1.0 || uFlat > 0.5) ? vec2(0.0) : aOv;   // 2D 와 **같은 세기**로(0.7 배로 눌렀던 것을 걷었다 — 그만큼 납작했다)
  vec3 col = mix(base, vec3(1.0), clamp(ov.x + gw, 0.0, 1.0));
  col = mix(col, vec3(0.0), clamp(ov.y + gb, 0.0, 1.0));
  /* ★ 방향광(2026-09) — 2D 판에는 없던 몫이다. 법선은 카메라 쪽으로 뒤집혀 있으므로(위) 빛과의 각은 '얼마나 기울었나'를 뜻한다.
     · **반쪽 램버트**(0.5+0.5·n·L): 램버트를 그대로 쓰면 빛에 등진 낯이 통째로 검어져 실루엣만 남는다. 반으로 접으면
       밝은 낯 → 어두운 낯이 부드럽게 이어지고, 돔·관의 결이 살아난다.
     · **테두리 빛**(rim): 카메라를 스치는 낯(법선이 시선과 수직)에 옅은 빛을 얹는다 — 어두운 바탕에서 실루엣이 끊기지 않게
       하는 몫이고, 원작 스프라이트의 밝은 외곽선을 대신한다.
     세기는 눈으로 고른 값이다(확산 0.78~1.10 · 테두리 +0.10). uFlat(효과)은 둘 다 안 탄다. */
  float nd = 0.5 + 0.5 * dot(n, uLight);
  vec3 camDir = vec3(0.0, uCam.y, uCam.x);
  float rim = pow(1.0 - abs(dot(n, camDir)), 4.0);
  col *= mix(0.78 + 0.32 * nd, 1.0, uFlat);
  col += mix(vec3(0.10 * rim), vec3(0.0), uFlat);
  vCol = uShade.a > 0.0 ? vec4(uShade.rgb, uShade.a * aAlpha) : vec4(col, aAlpha * uAlpha);
}`;
const FS = `
precision mediump float; varying vec4 vCol;
void main() { gl_FragColor = vec4(vCol.rgb * vCol.a, vCol.a); }   // 미리곱한 알파 — WebGL 캔버스(premultipliedAlpha)와 합성이 맞아야 반투명(빛무리)이 안 어두워진다`;

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
/** 캔버스(판)에 남기는 종류 — 화면 전용 효과(빛무리·번개·폭발 고리)와 반투명 구 겹으로 그린 아콘: 3D 로 옮기면 뜻이 달라진다. */
export const GL_CANVAS_KINDS9 = new Set<string>([]);
/** 발광 효과 종류 — 반투명 면이 곧 몸(mesh9 glow)이고 음영 없이 제 색으로 그린다(flat). 폭풍·핵은 더하기 합성(add)까지. */
export const GL_GLOW_KINDS9 = new Set(["warpin", "storm", "nukeblast", "nukecloud", "archon", "darchon"]);
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
/** 바닥 그림자의 기울기 — 높이 z 의 꼭짓점이 바닥에서 얼마나 밀리나(= −평면빛/높이빛, shapeOblique 의 LIGHT_PLAN·LIGHT_ELEV 와 같은 자). */
const SHADOW_K9: [number, number] = [0.5, -0.25];   // 빛을 더 높이(0.9/−0.45 는 그림자가 몸의 갑절로 길었다)
/** 그림자의 **번짐** — 같은 실루엣을 조금 크게 한 번 더 깔아 가장자리를 무르게 한다(2D 의 흐린 판 그림자 몫).
 *  [배수, 알파 몫] — 큰 것을 먼저, 그다음 제 크기를 얹는다. 삯은 그리기 한 번이다. */
const SHADOW_BLUR9: [number, number] = [1.1, 0.55];

export class GlUnits9 {
  readonly gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private att: Record<string, number> = {};
  readonly meshes = new Map<string, GlMesh9 | null>();
  private queue: GlInst9[] = [];
  /** 진단: 마지막 프레임의 개체 수·삼각형 수·메시 수·메시 굽기 ms. */
  /** 진단: 마지막 프레임의 개체·삼각형 수 · 메시 벌 수 · 메시 굽기 ms(누적)와 **이번 프레임 몫**(frameBakeMs — 시계가
   *  '굽는 프레임'을 아는 자) · 깊이 칸/비트 · 살아 있는 메시 VBO 합(바이트). */
  stat = { inst: 0, tris: 0, bakeMs: 0, frameBakeMs: 0, meshes: 0, slots: 0, depthBits: 0, bytes: 0 };
  /** meshMax: 메시 상한(기기 표 DEV9.glMeshMax — PC 600 · 폰 240; 메시 한 벌은 VBO + footOf 용 정점 사본이라 폰 메모리에 든다). */
  constructor(readonly canvas: HTMLCanvasElement, readonly meshMax = MESH_MAX9) {
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, depth: true });   // 미리곱한 알파 — 셰이더 출력·합성 함수(ONE, 1−a)와 한 벌
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
    this.stat.depthBits = Number(gl.getParameter(gl.DEPTH_BITS)) || 0;
    for (const u of ["uAnchor", "uScale", "uYaw", "uCanvas", "uCam", "uTeam", "uLight", "uAlpha", "uDepth0", "uDepthK", "uPersp", "uShade", "uDy", "uLean", "uGrad", "uDbg", "uFlat", "uShadow", "uShZ"]) this.loc[u] = gl.getUniformLocation(p, u);
    for (const a of ["aPos", "aNrm", "aRgb", "aTeam", "aAlpha", "aOv", "aOrd", "aBb"]) this.att[a] = gl.getAttribLocation(p, a);
  }
  /** 열쇠별 메시 — 처음 볼 때 run()(빌더를 요잉 0 으로 한 번 돌리는 일, 1~7ms)으로 짓는다. 못 지으면 null 로 굳는다. */
  private meshFor(key: string, run: () => { parts: { polys: number[][]; fill: string; alpha: number; team: boolean; ow: number; ob: number; bb?: boolean; solid?: boolean; flip?: boolean; flips?: boolean[] }[] }, bias0 = 0.8, glow = false): GlMesh9 | null {
    const got = this.meshes.get(key);
    if (got !== undefined) return got;
    const t0 = performance.now();
    let mesh: GlMesh9 | null = null;
    try {
      const m = run();
      // 불투명 부품 먼저(깊이 쓰기), 반투명은 뒤에 — 한 버퍼에 차례로 담는다.
      /* 부품 차례 편향(모델 칸): 화가 차례 0→1 에 0.3 + 차례 번호마다 0.004(상한 0.4) — 같은 평면에 겹쳐 놓은 동심 원반·줄무늬가
         뒤 것부터 차례로 이기게 하는 몫이다. 뒤 항은 큰 모델에서 포화하므로 앞 항이 전체 차례를 잡는다. */
      const bias = GL_BIAS9 >= 0 ? GL_BIAS9 : bias0;
      const ordOf = new Map(m.parts.map((p, i) => [p, (i / Math.max(1, m.parts.length - 1)) * 0.3 + Math.min(0.4, i * 0.004)] as const));
      /* 데칼 판정 — 한 장짜리 폴리곤이면서 작거나(대각 < 2.8) 반투명한 부품. 2D 모델은 줄무늬·창·환풍구를 벽 살짝 안쪽에 그려 두고
         화가 차례로 위에 얹었다 — 진짜 깊이로는 벽에 묻힌다. 데칼은 뒤 구간에 모아 깊이 편향으로 그린다. */
      const isDecal = (p: { polys: number[][]; alpha: number }): boolean => {
        if (p.polys.length !== 1) return false;
        if (p.alpha < 0.98) return true;
        const poly = p.polys[0]; let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
        for (let i = 0; i < poly.length; i += 3) { const x = poly[i], y = poly[i + 1], z = poly[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
        return Math.hypot(x1 - x0, y1 - y0, z1 - z0) < 2.8;
      };
      /* 두 구간: 불투명 | 반투명(깊이를 안 쓰고 겹쳐 섞는다). **데칼 편향은 정점(aOrd)에 넣는다** — 그리기 단위로 주면
         반투명 데칼 아닌 면까지 통째로 앞으로 끌려 나온다(실측: 보급고의 반투명 초록 패널이 앞으로 튀어나온 임자색 상자를 덮었다). */
      /* 발광(glow) 종류는 깊이 없이 화가 차례로 그리므로 불투명·반투명을 안 가른다 — 2D 의 겹침(껍질 위에 몸, 몸 위에 고리) 그대로. */
      const clear = glow ? [] : m.parts.filter((p) => p.alpha < 0.98);
      const solids = glow ? m.parts : m.parts.filter((p) => p.alpha >= 0.98);
      const parts = [...solids, ...clear];
      let total = 0;
      for (const part of parts) for (const poly of part.polys) { const n = poly.length / 3; if (n >= 3) total += 3 * (n - 2); }
      const buf = new ArrayBuffer(total * STRIDE_B);
      const f32 = new Float32Array(buf); const u8 = new Uint8Array(buf);
      const b255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));
      const ptKeys = new Set<string>(); const pts: number[] = [];
      const cols = new Set<string>();
      let vi = 0;
      let nSolid = 0;
      for (let pi = 0; pi < parts.length; pi += 1) {
        const part = parts[pi];
        if (pi === solids.length) nSolid = vi;
        const ord = (ordOf.get(part) ?? 0) + (isDecal(part) ? bias : 0);
        const [r, g, bl] = part.team ? [0, 0, 0] : hexRgb(tone9(part.fill));   // 고정색은 2D 와 같은 색감 손잡이(tone9)를 지난다
        const team = part.team ? 1 : 0;
        cols.add(part.team ? "team" : part.fill);
        const cr = b255(r), cg = b255(g), cb = b255(bl), ct = team ? 255 : 0, ca = b255(part.alpha), cw = b255(part.ow), ck = b255(part.ob);
        for (let qi = 0; qi < part.polys.length; qi += 1) {
          const poly = part.polys[qi];
          const n = poly.length / 3; if (n < 3) continue;
          let nx = 0, ny = 0, nz = 0;
          for (let i = 0; i < n; i += 1) {
            const j = (i + 1) % n;
            const px = poly[i * 3], py = poly[i * 3 + 1], pz = poly[i * 3 + 2];
            const qx = poly[j * 3], qy = poly[j * 3 + 1], qz = poly[j * 3 + 2];
            nx += (py - qy) * (pz + qz); ny += (pz - qz) * (px + qx); nz += (px - qx) * (py + qy);
          }
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          const bb = part.bb ? 1 : 0;
          // 닫힌 입체는 법선이 **바깥**을 봐야 한다 — mesh9 가 감기를 맞춰 준 부호(flip)를 여기서 먹인다.
          if (part.flips ? part.flips[qi] : part.flip) { nx = -nx; ny = -ny; nz = -nz; }
          if (bb) { nx = 0; ny = 0; nz = 0; for (let i = 0; i < n; i += 1) { nx += poly[i * 3]; ny += poly[i * 3 + 1]; nz += poly[i * 3 + 2]; } nx /= n; ny /= n; nz /= n; }   // 빌보드: 법선 자리에 원반 가운데
          const cbb = bb ? 255 : (part.solid ? 128 : 0);
          for (let i = 0; i < n; i += 1) {
            const x = poly[i * 3], y = poly[i * 3 + 1], z = poly[i * 3 + 2];
            const k = `${x},${y},${z}`; if (!ptKeys.has(k)) { ptKeys.add(k); pts.push(x, y, z); }
          }
          const put = (i: number): void => {
            const o = vi * 9; const ob = vi * STRIDE_B;
            f32[o] = poly[i * 3]; f32[o + 1] = poly[i * 3 + 1]; f32[o + 2] = poly[i * 3 + 2];
            f32[o + 3] = nx; f32[o + 4] = ny; f32[o + 5] = nz;
            u8[ob + 24] = cr; u8[ob + 25] = cg; u8[ob + 26] = cb; u8[ob + 27] = ct;
            u8[ob + 28] = ca; u8[ob + 29] = cw; u8[ob + 30] = ck; u8[ob + 31] = cbb;
            f32[o + 8] = ord;
            vi += 1;
          };
          for (let i = 1; i + 1 < n; i += 1) { put(0); put(i); put(i + 1); }
        }
      }
      if (vi) {
        const gl = this.gl;
        const vbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
        const n = vi;
        mesh = { vbo, n, nSolid: clear.length ? nSolid : n, bias, pts: new Float32Array(pts), bytes: buf.byteLength, cols: cols.size, foot: new Map() };
        this.stat.bytes += buf.byteLength;
      }
    } catch (e) { console.warn("[gl9] 메시", key, e); }
    const ms0 = performance.now() - t0;
    this.stat.bakeMs += ms0; this.stat.frameBakeMs += ms0;
    if (this.meshes.size >= this.meshMax) {
      // 가장 오래된 것부터 버린다(Map 삽입 차례) — 포탑 각·건설 단계처럼 열쇠가 잘게 갈리는 건물이 쌓이지 않게.
      const first = this.meshes.keys().next();
      if (!first.done) { const m = this.meshes.get(first.value); if (m) { this.gl.deleteBuffer(m.vbo); this.stat.bytes -= m.bytes; } this.meshes.delete(first.value); }
    }
    this.meshes.set(key, mesh);
    return mesh;
  }
  /** 유닛 메시 — 종류·자세(머리 요잉 0). */
  unitMesh(kind: string, pose: number, lod = 3): GlMesh9 | null {
    const b = SHAPE_BUILDERS[kind]; if (!b || GL_CANVAS_KINDS9.has(kind)) return null;
    if (GL_LOD9 >= 0) lod = GL_LOD9;
    return this.meshFor(`u:${kind}:${pose}:${lod}`, () => {
      const prevPose = poseNow;
      poseSet9(pose); headYawSet(0);
      // 판(rasterUnit9)과 같은 등급 걸러내기: 자동 등급표(autoTier — 부품 크기로 등급을 다시 매긴다) 뒤에 lodFilter.
      try { return collectMesh9(b, lod >= 3 ? undefined : (f: ShapeFace[]) => lodFilter(autoTier(kind, `gl|u|${kind}|${pose}`, f), lod), GL_GLOW_KINDS9.has(kind)); } finally { poseSet9(prevPose); }
    }, GL_GLOW_KINDS9.has(kind) ? 0 : undefined, GL_GLOW_KINDS9.has(kind));
  }
  /** 건물 메시 — 종류 · 건설 단계 · 불빛 · 회전 칸 · 포탑 각(rasterBld9 와 같은 깃발·같은 열쇠 조각). */
  bldMesh(op: UnitDrawOp, lod = 3): GlMesh9 | null {
    const b = SHAPE_BUILDERS[op.kind]; if (!b || GL_CANVAS_KINDS9.has(op.kind)) return null;
    if (GL_LOD9 >= 0) lod = GL_LOD9;
    const stg = op.buildStage ?? 0;
    const head = op.headDeg === undefined ? 0 : (((op.headDeg - (op.rotDeg ?? 0)) % 360) + 540) % 360 - 180;
    const aim = op.headDeg !== undefined;
    const set = (): void => { headYawSet(head, aim); bldLitSet(!!op.lit); bldSpinRawSet9(op.spin ?? 0); poseSet9(0); };
    const pH = headYawNow; const pA = headAimNow; const pL = bldLitNow; const pS = bldSpinNow; const pP = poseNow;
    set();
    try {
      const key = `b:${op.kind}:${stg}:${headTag(op.kind)}:${litTag(op.kind)}:${spinTag(op.kind)}:${lod}`;
      /* 건물 데칼 편향 1.3(유닛 0.8) — 빌더가 줄무늬·창을 벽 **안쪽 0.5칸쯤**에 그려 두고 화가 차례로 얹기 때문에 그만큼은 꺼내야
         보이고, 더 밀면 벽 앞으로 튀어나온 부품(보급고 임자색 상자, 0.5칸)을 거꾸로 덮는다. 좁은 창의 가운데 값이다. */
      return this.meshFor(key, () => { set(); return collectMesh9(b, (f: ShapeFace[]) => stageFaces(lod >= 3 ? f : lodFilter(autoTier(op.kind, `gl|${key}`, f), lod), stg), GL_GLOW_KINDS9.has(op.kind)); }, GL_GLOW_KINDS9.has(op.kind) ? 0 : 1.3, GL_GLOW_KINDS9.has(op.kind));
    } finally { headYawSet(pH, pA); bldLitSet(pL); bldSpinRawSet9(pS); poseSet9(pP); }
  }
  /** 효과 메시 — 폭풍·핵 폭발·핵 구름(fxModelCv9 의 판 대신): 종류 · 회전 칸(spin = 무늬 씨앗). 발광 규약(glow)으로 모은다. */
  fxMesh(kind: string, spin: number): GlMesh9 | null {
    const b = SHAPE_BUILDERS[kind]; if (!b) return null;
    const pS = bldSpinNow;
    return this.meshFor(`f:${kind}:${spin}`, () => {
      bldSpinRawSet9(spin);
      try { return collectMesh9(b, undefined, true); } finally { bldSpinRawSet9(pS); }
    }, 0, true);
  }
  /** 요잉의 화면 상자 — 모델 16-상자 자. 정점 셰이더와 같은 식으로 모든 꼭짓점을 돌려 재고(메시·각도당 한 번) 기억한다. */
  footOf(mesh: GlMesh9, yawDeg: number, cam: GlCam9 = CAM_TOP9): GlFoot9 {
    const yk = Math.round(yawDeg);
    const key = cam === CAM_TOP9 ? `${yk}` : `${yk}|${cam.key}`;
    const got = mesh.foot.get(key);
    if (got) return got;
    const th = (yk * Math.PI) / 180; const c = Math.cos(th); const sn = Math.sin(th);
    let minX = Infinity; let maxX = -Infinity; let bot = -Infinity; let top = Infinity;
    const v = mesh.pts;
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i]; const y = v[i + 1]; const z = v[i + 2];
      const rx = x * c + y * sn; const ry = -x * sn + y * c;
      const f = 48 / (48 - Math.max(-10, Math.min(10, ry)));
      const X = (rx + ry * cam.squash * cam.shear) * f; const Y = (ry + z * cam.lean) * cam.squash - z * cam.zk;
      if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y > bot) bot = Y; if (Y < top) top = Y;
    }
    const ft = { w: maxX - minX, cx: (minX + maxX) / 2, bot, top };
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
    this.stat.inst = q.length; this.stat.tris = 0; this.stat.meshes = this.meshes.size;
    (globalThis as unknown as { __glInst9?: number }).__glInst9 = q.length;   // 계측(perf-check)이 '그려졌다'를 아는 창
    if (!q.length) return;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // 미리곱한 알파
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.prog);
    gl.uniform2f(this.loc.uCanvas, cw, ch);
    gl.uniform3f(this.loc.uLight, LIGHT[0], LIGHT[1], LIGHT[2]);
    gl.uniform1f(this.loc.uPersp, 48);
    gl.uniform1f(this.loc.uDbg, GL_SHADE9);
    /* ★ 깊이 칸은 개체 수가 아니라 **겹침**으로 나눈다 — 개체마다 칸을 주면 400기 화면에서 칸이 0.005 라 16비트 깊이 버퍼에서는
       한 개체 안의 부품 앞뒤(지붕 위 원통·벽의 환풍구)가 양자화에 묻혔다(실측: 판에는 있는 부품이 GL 에서 사라짐).
       화면에서 겹치는(원 반지름 = 실루엣 상자) 앞선 개체보다 한 칸 앞에만 서면 되므로 칸 수는 겹침 깊이(보통 10 안팎)다. */
    const order = q.map((_, i) => i).sort((a, b) => q[a].ax - q[b].ax);
    const slotOf = new Int32Array(q.length);
    let rmax = 0; for (const it of q) if (it.gradR > rmax) rmax = it.gradR;
    let M = 1;
    for (let oi = 0; oi < order.length; oi += 1) {
      const i = order[oi]; const a = q[i]; const acy = a.ay + a.gradCy;
      let s9 = 0;
      for (let oj = oi - 1; oj >= 0; oj -= 1) {
        const j = order[oj]; const b = q[j];
        if (a.ax - b.ax > a.gradR + rmax) break;
        const rr = a.gradR + b.gradR; const dy = acy - (b.ay + b.gradCy); const dx = a.ax - b.ax;
        if (dx * dx + dy * dy > rr * rr) continue;
        // 화가 차례가 늦은 쪽이 앞 칸
        const lateI = i > j; const other = slotOf[j];
        if (lateI) { if (other + 1 > s9) s9 = other + 1; }
      }
      // 앞선 개체(차례가 빠른) 중 나보다 늦게 정렬된 것도 있다 — 두 번째 훑기에서 맞춘다
      slotOf[i] = s9; if (s9 + 1 > M) M = s9 + 1;
    }
    // 둘째 훑기: x 정렬 때문에 화가 차례가 빠른 개체가 뒤에 올 수 있다 — 겹치면 그 개체 칸 + 1 을 보장한다(한 번 더면 충분히 수렴한다).
    for (let pass = 0; pass < 2; pass += 1) {
      for (let oi = 0; oi < order.length; oi += 1) {
        const i = order[oi]; const a = q[i]; const acy = a.ay + a.gradCy;
        for (let oj = oi + 1; oj < order.length; oj += 1) {
          const j = order[oj]; const b = q[j];
          if (b.ax - a.ax > a.gradR + rmax) break;
          const rr = a.gradR + b.gradR; const dy = acy - (b.ay + b.gradCy); const dx = a.ax - b.ax;
          if (dx * dx + dy * dy > rr * rr) continue;
          if (i > j && slotOf[i] <= slotOf[j]) { slotOf[i] = slotOf[j] + 1; if (slotOf[i] + 1 > M) M = slotOf[i] + 1; }
          else if (j > i && slotOf[j] <= slotOf[i]) { slotOf[j] = slotOf[i] + 1; if (slotOf[j] + 1 > M) M = slotOf[j] + 1; }
        }
      }
    }
    const slot = 2 / (M + 1);
    this.stat.slots = M;
    gl.uniform1f(this.loc.uDepthK, slot / 80);
    const bind = (mesh: GlMesh9): void => {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      const U = gl.UNSIGNED_BYTE;
      gl.enableVertexAttribArray(this.att.aPos); gl.vertexAttribPointer(this.att.aPos, 3, gl.FLOAT, false, STRIDE_B, 0);
      gl.enableVertexAttribArray(this.att.aNrm); gl.vertexAttribPointer(this.att.aNrm, 3, gl.FLOAT, false, STRIDE_B, 12);
      gl.enableVertexAttribArray(this.att.aRgb); gl.vertexAttribPointer(this.att.aRgb, 3, U, true, STRIDE_B, 24);
      gl.enableVertexAttribArray(this.att.aTeam); gl.vertexAttribPointer(this.att.aTeam, 1, U, true, STRIDE_B, 27);
      gl.enableVertexAttribArray(this.att.aAlpha); gl.vertexAttribPointer(this.att.aAlpha, 1, U, true, STRIDE_B, 28);
      gl.enableVertexAttribArray(this.att.aOv); gl.vertexAttribPointer(this.att.aOv, 2, U, true, STRIDE_B, 29);
      gl.enableVertexAttribArray(this.att.aBb); gl.vertexAttribPointer(this.att.aBb, 1, U, true, STRIDE_B, 31);
      gl.enableVertexAttribArray(this.att.aOrd); gl.vertexAttribPointer(this.att.aOrd, 1, gl.FLOAT, false, STRIDE_B, 32);
    };
    let camNow: GlCam9 | null = null;
    const place = (it: GlInst9): void => {
      const th = (it.yawDeg * Math.PI) / 180;
      gl.uniform2f(this.loc.uAnchor, it.ax, it.ay);
      gl.uniform3f(this.loc.uScale, it.k, it.k, it.yoff);
      gl.uniform2f(this.loc.uYaw, Math.cos(th), Math.sin(th));
      if (it.cam !== camNow) { camNow = it.cam; gl.uniform2f(this.loc.uCam, it.cam.squash, it.cam.zk); gl.uniform2f(this.loc.uLean, it.cam.lean, it.cam.shear); }
      // 실루엣 빛의 화면 방향(lightScreenDir 과 같은 식: 평면 빛에 높이 몫을 얹어 화면 벡터로)
      const lx = -0.9; const ly = 0.45 * it.cam.squash - 1 * it.cam.zk; const ll = Math.hypot(lx, ly) || 1;
      gl.uniform4f(this.loc.uGrad, lx / ll, ly / ll, it.gradR, it.gradCy);
    };
    /* 1) 몸 그림자 — 깊이 없이 몸보다 먼저(뒤 몸 위에는 안 얹힌다). 바닥에 붙은 몸은 **빛 방향으로 눌러 눕히고**(uShadow),
       떠 있는 몸은 검게 아래로 밀어 그린다(그 벌어짐이 높이다). */
    /* ★ **한 화소에 한 겹만**(2026-09) — 그림자는 몸의 삼각형을 그대로 검게 깔므로, 겹친 부품(날개 위 포탑·
       겹친 개체)마다 알파가 쌓여 실루엣 안에 얼룩이 났다. 켜마다 깊이를 못 박고(uShZ) 깊이 쓰기를 켠 채
       LESS 로 그리면 같은 깊이의 두 번째 화소가 걸러져 실루엣이 **고르게** 깔린다. 무른 고리(1.1배)는 한 칸
       더 뒤에 두어 그 위에 본 실루엣이 얹힌다. 몸(≤0.99)보다 뒤라 몸을 안 가린다. */
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
    let shOn9 = false;
    for (const it of q) {
      if (!it.shadow) continue;
      const mesh = it.mesh;
      bind(mesh); place(it);
      const gr9 = !!it.shadow.ground;
      gl.uniform4f(this.loc.uShadow, SHADOW_K9[0], SHADOW_K9[1], gr9 ? 1 : 0, it.shadow.h ?? 0);
      shOn9 = shOn9 || gr9;
      gl.uniform1f(this.loc.uDy, it.shadow.dy ?? 0);
      if (gr9) {
        // 번짐 고리 — 같은 실루엣을 조금 크게(원점은 그대로: uScale 만 키운다) 옅게 먼저 깔아 가장자리를 무르게 한다.
        gl.uniform1f(this.loc.uShZ, 0.997);
        gl.uniform4f(this.loc.uShade, 0, 0, 0, it.shadow.alpha * SHADOW_BLUR9[1]);
        gl.uniform3f(this.loc.uScale, it.k * SHADOW_BLUR9[0], it.k * SHADOW_BLUR9[0], it.yoff);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
        gl.uniform3f(this.loc.uScale, it.k, it.k, it.yoff);
      }
      gl.uniform1f(this.loc.uShZ, 0.996);
      gl.uniform4f(this.loc.uShade, 0, 0, 0, it.shadow.alpha);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
    }
    gl.uniform1f(this.loc.uShZ, 0);
    if (shOn9) gl.uniform4f(this.loc.uShadow, SHADOW_K9[0], SHADOW_K9[1], 0, 0);
    /* 2) 몸 — 개체 차례로 깊이 칸을 나눠 그린다. */
    gl.depthMask(true); if (GL_DEPTH9) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
    gl.uniform4f(this.loc.uShade, 0, 0, 0, 0);
    gl.uniform1f(this.loc.uDy, 0);
    gl.uniform1f(this.loc.uFlat, 0);
    let flatNow = false; let addNow = false;
    for (let i = 0; i < q.length; i += 1) {
      const it = q[i];
      const mesh = it.mesh;
      const [tr, tg, tb] = hexRgb(tone9(it.color));
      bind(mesh); place(it);
      gl.uniform3f(this.loc.uTeam, tr, tg, tb);
      gl.uniform1f(this.loc.uAlpha, it.alpha);
      gl.uniform1f(this.loc.uDepth0, 1 - slot * (slotOf[i] + 1));
      const flat = !!it.flat; const add = !!it.add;
      if (flat !== flatNow) { flatNow = flat; gl.uniform1f(this.loc.uFlat, flat ? 1 : 0); }
      /* 더하기 효과(폭풍·핵)는 2D 의 lighter 처럼 깊이 없이 겹쳐 더한다 — 큐의 맨 뒤(몸 다음)에 서므로 몸 위에 얹힌다. */
      if (add !== addNow) { addNow = add; gl.blendFunc(gl.ONE, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); }
      /* 발광(flat)·더하기(add) 개체는 깊이 없이 **화가 차례**(메시의 부품 차례 = zsorted)로 겹친다 — 2D 의 동심원·빛무리 그대로. */
      if (flat || add) { gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, mesh.n); gl.depthMask(true); if (GL_DEPTH9) gl.enable(gl.DEPTH_TEST); }
      else {
        gl.drawArrays(gl.TRIANGLES, 0, mesh.nSolid);
        if (mesh.nSolid < mesh.n) { gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, mesh.nSolid, mesh.n - mesh.nSolid); gl.depthMask(true); }
      }
      this.stat.tris += mesh.n / 3;
    }
    if (addNow) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}
/** 진단 `#glshade=N` — 음영 겹을 단계별로 끈다(0 덧칠 없음 · 1 면 덧칠 · 2 +실루엣 빛, 기본 2). */
export const GL_SHADE9 = ((): number => { const m = typeof location !== "undefined" ? /glshade=(\d)/.exec(location.hash) : null; return m ? Number(m[1]) : 2; })();
/** 진단 `#gllod=N` — GL 메시 등급을 못 박는다(-1 = 화면 크기가 정하는 자동). `#glwarm=0` — 로딩 데우기에서 GL 메시를 안 짓는다. */
export const GL_LOD9 = ((): number => { const m = typeof location !== "undefined" ? /gllod=(\d)/.exec(location.hash) : null; return m ? Number(m[1]) : -1; })();
export const GL_WARM9 = !(typeof location !== "undefined" && /glwarm=0/.test(location.hash));
/** 진단 `#gldepth=0` — 깊이 검사를 끄고 화가 차례로만 그린다. */
export const GL_DEPTH9 = !(typeof location !== "undefined" && /gldepth=0/.test(location.hash));
/** 데칼 깊이 편향(모델 칸, 유닛 0.8 · 건물 1.3) — 진단 `#glbias=N` 으로 못 박아 본다(-1 = 메시별 기본). */
export const GL_BIAS9 = ((): number => { const m = typeof location !== "undefined" ? /glbias=([\d.]+)/.exec(location.hash) : null; return m ? Number(m[1]) : -1; })();
/** 진단 `#glblit=0` — GL 그림을 유닛 캔버스에 **합성하지 않는다**(GL 은 다 돌고 그림만 안 붙는다). 헤드리스 크로뮴(SwiftShader 소프트웨어 GL)은
 *  WebGL 캔버스 → 2D drawImage 가 ReadPixels 로 서서 1454² 한 장에 1~2초가 든다(실측, 옵션과 무관) — 실기 GPU 에는 없는 값이라
 *  perf-check 가 기본으로 붙여 GL 의 CPU 몫(메시 굽기·큐·유니폼)만 잰다. */
export const GL_BLIT9 = !(typeof location !== "undefined" && /glblit=0/.test(location.hash));
/** GL 붓 켬 — **어느 기기에서나 기본 켬**이다(2026-09: 유닛·건물의 판 굽기 길을 걷으며 폰도 함께 열었다).
 *  `#gl=0` 이면 붓이 면을 곧장 그린다(판이 없는 느린 폴백 — 비교·수리용). WebGL 이 안 서면(문맥 실패) glUnits9 가
 *  null 을 굳혀 같은 폴백으로 돈다. */
export const GL_ON9 = typeof location === "undefined" || !/(^|[#&,])gl=0/.test(location.hash);
let glInst9: GlUnits9 | null | undefined;
/** 지금 선 GL 붓(없으면 null) — 붓 밖(데우기 등)에서 메시를 미리 지을 때. */
export const glNow9 = (): GlUnits9 | null => glInst9 ?? null;
/** 이번 프레임에 메시를 짓는 데 쓴 ms — 읽고 0으로 돌린다(시계의 '굽는 프레임' 문지기). */
export const glBakeMsTake9 = (): number => {
  const g = glInst9; if (!g) return 0;
  const v = g.stat.frameBakeMs; g.stat.frameBakeMs = 0; return v;
};
/** 유닛 층의 GL 붓 — 캔버스가 있을 때 한 번 만든다. 못 만들면(WebGL 없음) null 로 굳어 캔버스 길로 돈다. */
export function glUnits9(cv: HTMLCanvasElement | null, meshMax = MESH_MAX9): GlUnits9 | null {
  if (!GL_ON9 || !cv) return null;
  if (glInst9 !== undefined && (glInst9 === null || glInst9.canvas === cv)) return glInst9;
  try { glInst9 = new GlUnits9(cv, meshMax); } catch (e) { console.warn("[gl9]", e); glInst9 = null; }
  (globalThis as unknown as { __gl9?: GlUnits9 | null }).__gl9 = glInst9;   // 진단(perf-check --probe-gl)
  return glInst9;
}

/* ── 도록 아이콘 배치 그리개(DocIcon9 의 손) ──────────────────────────────────────────────────────────────
   아이콘마다 GL 문맥을 열 수는 없고(브라우저 상한 16), 헤드리스에서는 GL → 2D 읽기 한 번이 1~2초라, 한 프레임에 모인 청을 **한 GL
   캔버스(격자, 한 변 4096 상한)에 그리고 한 번 읽어** 칸마다 PNG(dataURL)로 나눠 준다. 아이콘은 <img> 라 캔버스 424장의 메모리가 없다.
   카메라는 평면(CAM_TOP9)뿐이고 자·원점은 gl-check 와 같다(16-상자: x = 8 + rx · y = 12 + Y). 창(box)은 ShapeIcon 의 viewBox 와 같은
   16-상자 자 — 없으면 footOf(메시 상자)에 맞춘다(fit, pad 는 짧은 변 비율). */
export interface GlIconReq9 {
  kind: string; bld: boolean; rotDeg: number; pose: number; spin: number;
  /** 칸(기기 px) */ w: number; h: number;
  /** 임자색(#hex) */ color: string;
  /** 창 [x, y, w, h](16-상자 자) — 없으면 잉크 맞춤(pad). */ box?: [number, number, number, number]; pad: number;
  done: (url: string | null) => void;
}
const ICON_Q9: GlIconReq9[] = [];
let iconGl9: GlUnits9 | null | undefined;
let iconRaf9 = 0;
const ICON_SIDE9 = 4096;
/** 아이콘 GL 이 서는가 — 처음 부를 때 숨은 캔버스에 문맥을 연다(못 열면 null 로 굳어 DocIcon9 가 SVG 로 돈다). */
export function glIconOk9(): boolean {
  if (iconGl9 === undefined) {
    if (typeof document === "undefined") { iconGl9 = null; return false; }
    try { iconGl9 = new GlUnits9(document.createElement("canvas"), 400); } catch (e) { console.warn("[gl9] 아이콘", e); iconGl9 = null; }
  }
  return !!iconGl9;
}
export function glIconRequest9(req: GlIconReq9): void {
  if (!glIconOk9()) { req.done(null); return; }
  ICON_Q9.push(req);
  if (!iconRaf9) iconRaf9 = requestAnimationFrame(() => { iconRaf9 = 0; glIconFlush9(); });
}
type IconCell9 = { req: GlIconReq9; x: number; y: number; w: number; h: number; mesh: GlMesh9 | null };
function glIconFlush9(): void {
  const g = iconGl9; if (!g) return;
  const q = ICON_Q9.splice(0);
  /* 격자 — 줄 단위로 왼쪽부터 채우고, 한 판(4096²)이 차면 다음 판(판마다 읽기 한 번). */
  const passes: { items: IconCell9[]; w: number; h: number }[] = [];
  let items: IconCell9[] = []; let px = 0; let py = 0; let rowH = 0; let W = 0;
  const close = (): void => { if (items.length) passes.push({ items, w: W, h: py + rowH }); items = []; px = 0; py = 0; rowH = 0; W = 0; };
  for (const r of q) {
    const w = Math.min(ICON_SIDE9, Math.max(1, Math.round(r.w))); const h = Math.min(ICON_SIDE9, Math.max(1, Math.round(r.h)));
    if (px + w > ICON_SIDE9) { px = 0; py += rowH; rowH = 0; }
    if (py + h > ICON_SIDE9) close();
    items.push({ req: r, x: px, y: py, w, h, mesh: null }); px += w; rowH = Math.max(rowH, h); W = Math.max(W, px);
  }
  close();
  const cell = document.createElement("canvas"); const cc = cell.getContext("2d");
  const sheet = document.createElement("canvas"); const sc = sheet.getContext("2d");
  if (!cc || !sc) { for (const r of q) r.done(null); return; }
  for (const p of passes) {
    for (const it of p.items) {
      const r = it.req;
      try {
        it.mesh = r.bld
          ? g.bldMesh({ kind: r.kind, fx: 0, fy: 0, z: 0, sizePx: 16, color: r.color, alpha: 1, rotDeg: r.rotDeg, spin: r.spin } as UnitDrawOp, 3)
          : g.unitMesh(r.kind, r.pose, 3);
      } catch (e) { console.warn("[gl9] 아이콘 메시", r.kind, e); it.mesh = null; }
      const mesh = it.mesh; if (!mesh) continue;
      let box = r.box;
      if (!box) {
        const f = g.footOf(mesh, -r.rotDeg, CAM_TOP9);
        const pd = Math.min(f.w, f.bot - f.top) * r.pad;
        box = [8 + f.cx - f.w / 2 - pd, 12 + f.top - pd, f.w + 2 * pd, f.bot - f.top + 2 * pd];
      }
      const k = Math.min(it.w / Math.max(1e-6, box[2]), it.h / Math.max(1e-6, box[3]));
      const ax = it.x + it.w / 2 - k * (box[0] + box[2] / 2 - 8);
      const ay = it.y + it.h / 2 - k * (box[1] + box[3] / 2 - 12);
      g.push({ mesh, ax, ay, k, yoff: 0, yawDeg: -r.rotDeg, color: r.color, alpha: 1, cam: CAM_TOP9, gradR: k * 11.31, gradCy: 0, flat: GL_GLOW_KINDS9.has(r.kind) });
    }
    g.flush(p.w, p.h, p.w, p.h);
    sheet.width = p.w; sheet.height = p.h;
    sc.drawImage(g.canvas, 0, 0);   // 판마다 읽기 한 번
    for (const it of p.items) {
      if (!it.mesh) { it.req.done(null); continue; }
      cell.width = it.w; cell.height = it.h;
      cc.drawImage(sheet, it.x, it.y, it.w, it.h, 0, 0, it.w, it.h);
      it.req.done(cell.toDataURL("image/png"));
    }
  }
}
