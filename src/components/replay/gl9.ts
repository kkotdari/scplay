/* ── WebGL 유닛 붓 시제(2026-09, #gl=1) ─────────────────────────────────────────────
   판 굽기(빌더 → 경로 문자열 → Path2D → 캔버스 판 → 블릿) 대신, 빌더가 낸 **3D 메시**(mesh9.collectMesh9 — 판 모형
   공간)를 종류·자세마다 한 번 GPU 에 올리고, 프레임마다 요잉·자리·크기·임자색을 유니폼으로 걸어 곧장 그린다.
   · 카메라는 평면(top) 시점 하나를 정점 셰이더가 그대로 흉내 낸다(project 와 같은 식: 요잉 → x 원근 f → y = ry·sinE − z·cosE).
     화면 자리는 판 블릿과 같은 자(앵커 = (sx, sy − px·0.24 − lift), 배수 = px/16·MODEL_NORM, 원점 (8, 12)).
   · 앞뒤는 깊이 버퍼가 가른다 — 개체 차례(화가 순서)로 깊이 칸을 나누고 칸 안에서 카메라 가까움(ry·cosE + z·sinE)으로 잰다.
   · 조명은 면 법선(뉴얼) 한 방향광 양면 — 2D 의 흑백 덧칠 면은 메시에서 뺐다(mesh9.isOverlay9).
   · 임자색 면(fill 없음)은 정점의 team 깃발로 표시하고 uTeam 으로 칠한다.
   한계(시제): 유닛만(건물·데칼·그림자·체력바는 캔버스가 그대로), 평면 시점만(pitch 면 캔버스로), 머리 요잉·불빛·회전 깃발은 0. */
import { SHAPE_BUILDERS, SHAPE_GALLERY, poseSet9, poseNow, headYawSet, headYawNow, headAimNow, bldLitSet, bldLitNow, bldSpinRawSet9, bldSpinNow, stageFaces, headTag, litTag, spinTag, tone9, autoTier } from "./bake9";
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
export interface GlMesh9 { vbo: WebGLBuffer; n: number; nSolid: number; bias: number; pts: Float32Array; bytes: number; cols: number; foot: Map<string, GlFoot9>; gloss: Gloss9;
  /** **빛나는 낯이 있나** — 있으면 붓이 번짐 켜에서 이 메시를 한 번 더 그린다(없으면 건너뛴다 — 대부분의 유닛이 그렇다). */
  emit: boolean }

/* 정점 36바이트(예전 float 15개 60바이트): pos3·nrm3(빌보드면 원반 가운데) float · rgb3+team1 바이트(정규화) · alpha·덧칠 흰·검·빌보드 바이트(정규화) ·
   부품 차례 float. 0~1 값은 바이트 정규화로 충분하다(색 자체가 8비트, 알파·덧칠 1/255). 폰에서 메시 표(상한 240벌)가 메모리의 큰 몫이라 줄였다. */
const STRIDE_B = 36;
const MESH_MAX9 = 600;   // 메시 상한 기본(종류×자세×LOD + 건물 변종) — 넘으면 오래된 것부터. 기기 표(DEV9.glMeshMax)가 덮는다(폰 240).
const VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aRgb; attribute float aTeam; attribute float aAlpha; attribute vec2 aOv; attribute float aOrd; attribute float aBb;
uniform vec2 uAnchor; uniform vec3 uScale; uniform vec2 uYaw; uniform vec2 uCanvas; uniform vec2 uCam;
uniform vec3 uTeam; uniform vec3 uLight; uniform float uAlpha; uniform float uDepth0; uniform float uDepthK; uniform float uPersp;
/** 광택 — x 날카로움 · y 봉우리 세기 · z 제 색에 물드는 몫(금속 1 · 살점 0) · w 넓은 윤기. 종류마다 다르다(glossOf9).
 *  세기 둘(y·w)에는 손잡이(#glspec)와 진단 문(#glshade)이 **CPU 에서 이미 접혀** 있다 — 정점마다 물을 일이 아니다. */
uniform vec4 uGloss;
/** 빛과 시선의 **반각**(H) — 둘 다 유니폼이라 프레임에 한 번 내면 된다(정점마다 normalize 하던 것을 걷었다). */
uniform vec3 uHalf;
/** 결(긁힌 광택) 세기 — 종류(종족)·화면 배율·손잡이를 **CPU 에서 다 접어** 보낸다. 0 이면 화소가 그 식을 아예 안 돈다. */
uniform float uGrain;
uniform vec4 uShade; uniform float uDy; uniform vec2 uLean;
/* 바닥 그림자 — (빛의 화면 기울기 x, y, 켬). 켜면 꼭짓점을 **빛 방향으로 밀어 z 를 0 으로** 눌러, 몸의 실루엣이
   바닥에 눕는다(2D 의 흐린 판 그림자가 하던 몫을 기하로 낸다 — 높은 부품일수록 멀리 눕는다). */
uniform vec4 uShadow;   // (빛 기울기 x, y, 켬, 나는 높이)
/* 그림자 켜의 **못 박은 깊이** — 0 이면 안 쓴다. 한 켜의 모든 삼각형이 같은 깊이를 쓰면, 깊이 쓰기를 켠 채
   LESS 로 그릴 때 **한 화소에 한 번만** 칠해진다(겹친 부품·겹친 개체가 두 번 어두워지지 않는다). */
uniform float uShZ;
/** 번짐(블룸) 켜 — 1 이면 빛나는 낯만 그린다(그 그림을 흐려 더한다). */
uniform float uEmit;
uniform float uFlat;  // 효과(발광): 1 이면 음영·실루엣 빛·방향광 없이 제 색
uniform float uDbg;   // 진단 #glshade=0..2(0 덧칠 없음 · 1 덧칠 · 2 +실루엣 빛)
uniform vec4 uGrad;   // 실루엣 빛(silhouetteLight): 화면 빛 방향 (x,y) · 모델 상자 반지름 R · 상자 가운데의 앵커 기준 세로 몫
varying vec4 vCol;
/** 광택 몫(윤기 + 봉우리, 제 색 물듦까지 먹인 값)을 **따로** 넘긴다 — 결이 곱해질 자리가 여기다. */
varying vec3 vSpec;
/** 결의 **줄 눈금** — 낯의 수평 접선에 내린 모형 좌표. 자리의 **1차 함수**라 삼각형 안에서 보간이 정확하다. */
varying float vGs;
void main() {
  /* aBb 한 칸에 표식 셋이 비트로 들었다: **1 빛**(번짐이 문다) · **2 닫힌 입체**(등진 낯을 걷는다) · **4 빌보드 원반**(카메라를 본다). */
  float bits = floor(aBb * 255.0 + 0.5);
  float emit = mod(bits, 2.0);
  float solid = mod(floor(bits / 2.0), 2.0);
  float bill = mod(floor(bits / 4.0), 2.0);
  // 번짐 켜(uEmit)는 **빛나는 낯만** 그린다 — 나머지는 클립 밖으로.
  if (uEmit > 0.5 && emit < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec4(0.0); return; }
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
  /* ★ **광택(스페큘러)**(2026-09, 요청: "셰이더에 스페큘러 항 넣어서 광택 되살려줘 … 금속뿐 아니라
     저그 살점 윤택도 있고") — 2D 가 판마다 굽던 광택 겹(glowBake9)은 판 길을 걷으며 **부르는 자리가
     사라졌다**(유일한 호출자 rasterBld9 가 크립만 굽고, 그 크립은 DECAL_KINDS 로 걸러진다). 그 몫을
     캔버스 그라디언트가 아니라 여기서 낸다.
     블린-퐁이다: 빛과 시선의 **반각**(H)에 법선이 얼마나 가까운가. 값은 **정점에서 재도 정확하다** —
     이 메시의 법선은 낯마다 하나(평면 음영)라 한 삼각형 안에서 안 변하고, 그래서 화소마다 다시 재는
     몫이 한 톨도 없다(그 삯이 이 자를 정점 셰이더에 두는 까닭이다).
     ⚠ 지수를 크게 주면(64↑) 여덟 조각 관에서 **한 낯만** 하얗게 튄다 — 면이 곡면이 아니라 다면체라
       그렇다. 그래서 가장 날카로운 프로토스 금도 26 에 그친다.
     금속은 제 색으로 물든 광택을(금은 금빛으로) · 살점 같은 유전체는 흰 광택을 낸다(uGloss.z). */
  /* 옛 겹은 **둘**이었다 — ⓐ 빛을 마주 본 낯에 고르게 깔리는 몫(GLOW9.flat · 최대 0.6×0.4×0.4 ≒ 0.10)과
     ⓑ 그 위 한 자리에서 타는 **반사광 봉우리**(GLOW9.hot · 최대 ≒ 0.20). 하나만 두면 어느 쪽도 안 산다:
     봉우리만 두면 다면체라 몇 낯만 번쩍이고(실측: 밝기비 +4% — "티가 안 난다"), 고른 몫만 두면
     물체가 그냥 밝아진다. 그래서 여기서도 둘로 낸다.
     ⓐ 윤기(sheen): 낯이 빛을 마주 본 만큼(ndl)을 옛 문턱 자리(0.30~0.95)에서 편다 — 저그의 젖은 살에서 가장 세다.
     ⓑ 봉우리(spec): 블린-퐁. 프로토스 금에서 가장 날카롭고 세다. */
  /* 끌 때는 **정말로 안 돈다** — uGloss 는 유니폼이라 이 가지는 한 그리기 안에서 한쪽으로만 간다
     (셰이더가 갈라지지 않는다). 그래야 기기 표(DEV9.glSpec)·#glspec=0 이 삯을 진짜로 던다. */
  vSpec = vec3(0.0);
  /* ★ **결의 줄 눈금**(2026-09, 요청: 셰이더 절차적 결) ──────────────────────────────────────────
     결은 **낯의 성질**이다: 빛이 바뀌어도 요잉이 돌아도 자국은 그 자리에 있어야 한다. 그래서 눈금은
     요잉을 먹인 n·자리가 아니라 **모형 좌표**(aNrm·aPos)로 잰다.
     줄이 서는 쪽은 **세계의 수직**이다(옛 규약 그대로 — 이 사영에서 세계의 z 는 화면 x 에 한 톨도 안
     실리므로 화면 세로가 곧 세계 수직이다). 그러려면 줄을 **가로지르는** 자는 낯의 수평 접선
     h = (−ny, nx, 0) 이고 눈금은 s = P·h 다. 지붕처럼 낯이 누우면 h 가 사라지므로 모형 x 로 물러난다.
     s 는 자리의 1차 함수라 정점에 실어 보간해도 **정확하다**(화소마다 다시 잴 몫이 없다). */
  float hl = length(aNrm.xy);
  vec2 gh = hl > 0.08 ? vec2(-aNrm.y, aNrm.x) / hl : vec2(1.0, 0.0);
  vGs = aPos.x * gh.x + aPos.y * gh.y;
  if (uGloss.y > 0.0 || uGloss.w > 0.0) {
  float ndl = max(dot(n, uLight), 0.0);
  /* ⚠ 넓은 윤기는 **어두운 바탕에서 가장 크게 튄다** — 더하는 값이라 검은 낯에서는 그 몫이 곧 배수다
     (실측: 저그 굴 burrowhole 밝기비 1.48 → 1.79 · 러커 굴·알도 같이 떴다. 다들 하늘을 보는
     납작한 어두운 낯이다). 그래서 윤기는 바탕 밝기를 탄다 — 밝은 껍질은 번들거리고 검은 구멍은
     검은 채로 있다. 봉우리(ⓑ)는 안 탄다: 젖은 검은 키틴에도 반사광 한 점은 맺힌다. */
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  float sheen = smoothstep(0.30, 0.95, ndl) * uGloss.w * (0.30 + 0.70 * lum);
  /* ⓑ 봉우리는 **로렌츠 봉우리**로 낸다 — pow(c, e) 는 SwiftShader 에서 exp2·log2 둘이라 정점마다 지면
     비싸다(실측: 헤드리스 폰 프로필 4배 조임 p50 267 → 375ms). t = (1−c)·날카로움 으로 잰 1/(1+t²) 은
     곱셈 셋이고 꼴도 거의 같다(반값 자리를 맞추면 날카로움 ≒ 1.44 × 옛 지수). */
  float t2 = (1.0 - max(dot(n, uHalf), 0.0)) * uGloss.x;
  float sp = uGloss.y / (1.0 + t2 * t2);
  vec3 tintS = mix(vec3(1.0), base, uGloss.z);
  vSpec = mix((sp + sheen) * tintS, vec3(0.0), uFlat);
  }
  if (uShade.a > 0.0) { vSpec = vec3(0.0); vCol = vec4(uShade.rgb, uShade.a * aAlpha); }
  else vCol = vec4(col, aAlpha * uAlpha);
}`;
const FS = `
precision mediump float;
varying vec4 vCol; varying vec3 vSpec; varying float vGs;
uniform float uGrain;
void main() {
  vec3 c = vCol.rgb + vSpec;
  /* ★ **결(긁힌 광택)** — 낯을 가로지르는 눈금(vGs)에 굵기가 다른 사인 셋을 겹쳐 '가늘게 많이, 몇 줄만
     굵게'를 낸다(옛 BRUSH9 이 줄을 수십 개 긋던 그 결이다. 규칙 없는 해시는 낮은 배율에서 지글거린다).
     주파수는 **모형 칸당**이다. 배율 z 8 언저리에서 모형 한 칸이 10~20화소이므로(k = 상자px/16 × 정규화)
     27 ≒ 3화소 간격 · 63 ≒ 1.4화소다 — 처음에 9·21·47 로 뒀더니 8화소 띠가 되어 **골판지**로 읽혔다(실측).
     거기에 아주 느린 사인(3.7)으로 **세기를 묶어** 굵은 무리와 가는 무리를 낸다 — 굵기가 고르면 줄무늬 천이다.
     결은 **광택을 깎고 돋운다**(×1.2) — 긁힌 자국은 빛이 튀는 자리가 갈리는 것이지 물감이 바뀌는 게
     아니다. 몸에는 아주 옅게만(×0.06) 얹어 빛을 등진 낯에도 자국이 남게 한다(옛 규약: 결은 낯 전체에
     있고 광택 띠는 그중 어디가 환한가만 정한다).
     ⚠ 값은 **화소마다**다 — 그래서 CPU 가 uGrain 에 화면 배율 페이드를 접어 보내고(작으면 0),
       0 이면 이 가지를 통째로 건너뛴다. 유니폼 가지라 한 그리기 안에서 갈라지지 않는다. */
  if (uGrain > 0.0) {
    float a = 0.55 + 0.45 * sin(vGs * 3.7 + 0.6);
    float g = (sin(vGs * 27.0) * 0.55 + sin(vGs * 63.0 + 1.9) * 0.45) * a;
    c = vCol.rgb * (1.0 + uGrain * 0.035 * g) + vSpec * (1.0 + uGrain * g);
  }
  gl_FragColor = vec4(c * vCol.a, vCol.a);   // 미리곱한 알파 — WebGL 캔버스(premultipliedAlpha)와 합성이 맞아야 반투명(빛무리)이 안 어두워진다
}`;

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
/* ★ **광택 자(gloss)는 종족이 든다**(2026-09) — 낯마다 재질을 적으면 빌더 154종을 다 만져야 하고,
   색으로 짐작하면 틀린다(이 파일이 이미 겪은 자리다 — "색만 보고는 빛과 진한 물감을 못 가른다").
   그래서 **종류 → 종족** 한 자를 쓴다: 도록 표(SHAPE_GALLERY)가 154종을 이미 종족으로 갈라 놓았다.
     · 테란  — 칠한 강철. 조금 넓고 조금 약하게, 제 색에 반쯤 물든다.
     · 프로토스 — 닦은 금·수정. 가장 날카롭고 세며 제 색에 많이 물든다(금빛 광택).
     · 저그  — 젖은 살점·키틴. **넓고 무른 윤기**다(지수 7) — 날카롭게 주면 벌레가 금속이 된다.
     · 그 밖(자원·지형·중립) — 아주 옅게.
   값은 눈으로 고른다. 효과(uFlat)·번짐 판(uEmit 은 uFlat 을 함께 세운다)에는 안 탄다. */
/** [날카로움 · 봉우리 · 제 색에 물드는 몫 · 윤기 · **결(긁힌 광택)**] */
type Gloss9 = readonly [number, number, number, number, number];
/* 결은 **테란이 제일 세다**(옛 규약: 긁힌 강철은 테란의 결이다). 프로토스 금은 닦은 면이라 옅게,
   저그 살점·그 밖은 안 긁는다. */
/* ★ 봉우리를 한 번 **1.45배 올렸다**(2026-09, 지적: "봉우리가 좀 강해야 할 거 같은데") — 허옇게 뜨는 것은
   **윤기**(넓은 쪽)지 봉우리가 아니다. 봉우리는 좁아 닿는 낯이 적으므로 세게 줘도 반사광 한 점으로 남는다. */
/* ⚠ 테란은 **바탕이 이미 회색**이라 봉우리를 제 색에 물들이면(물듦 0.5) 회색 위에 회색을 얹는 꼴이라
   대비가 안 산다(지적: "테란 광택 봉우리 너무 약한 듯"). 프로토스 금이 세 보이는 까닭은 세기가 아니라
   **금빛이 제 바탕과 다른 밝기**여서다. 그래서 테란은 세기를 올리고(0.46 → 0.70) 물듦을 **내려**(0.50 → 0.30)
   흰빛에 가깝게, 날카로움도 한 칸 좁힌다(23 → 28) — 넓게 퍼지면 그만큼 옅어진다. */
const GLOSS_TERRAN9: Gloss9 = [28, 0.70, 0.30, 0.04, 0.85];
const GLOSS_TOSS9: Gloss9 = [32, 0.58, 0.70, 0.05, 0.35];
/* ⚠ 저그를 처음에 [7.2, 0.28] 로 뒀더니 **알·고치가 허옇게 떴다**(눈으로 확인 · 밝기비 lurkeregg 1.17 → 1.40).
   날카로움 7 은 봉우리가 아니라 **또 하나의 환경광**이다 — 젖은 살은 '넓게 밝은' 것이 아니라 '한 자리가 번들거리는' 것이다.
   그래서 봉우리를 좁히고(14) 세기를 내렸다. 그래도 테란·토스보다는 두 배 넓다. */
const GLOSS_ZERG9: Gloss9 = [14, 0.26, 0.15, 0.05, 0];
const GLOSS_NONE9: Gloss9 = [17, 0.14, 0.30, 0.02, 0.15];
const GLOSS_BY_KIND9 = new Map<string, Gloss9>();
const glossOf9 = (kind: string): Gloss9 => {
  if (GLOSS_BY_KIND9.size === 0) {
    for (const g of SHAPE_GALLERY) {
      GLOSS_BY_KIND9.set(g.kind, g.race === "저그" ? GLOSS_ZERG9
        : g.race === "프로토스" ? GLOSS_TOSS9
          : g.race === "테란" ? GLOSS_TERRAN9 : GLOSS_NONE9);
    }
  }
  return GLOSS_BY_KIND9.get(kind) ?? GLOSS_NONE9;
};
/** 메시 열쇠(`u:종류:…` · `b:종류:…` · `f:종류:…`)에서 종류를 떼어 광택 자를 고른다. */
const glossOfKey9 = (key: string): Gloss9 => glossOf9(key.slice(key.indexOf(":") + 1).split(":")[0]);
const CAMS9 = new Map<string, GlCam9>();
/** 카메라 — 평면(vq 0 이면 CAM_TOP9 그대로) 또는 입체(pitchSquash = pitchFlatNow·0.7 · 높이 0.9 · 앞숙임 0.34) + 시각 밀림 tan(vq).
 *  같은 열쇠면 같은 객체라 그리기에서 유니폼을 한 번만 건다. */
/** ★ **오목 다각형도 제대로 삼각화한다**(2026-09, 지적: "넥서스 … 피라미드에서 나오는 삼각발판") ─────────────
 *  여태 폴리곤은 **0번 꼭짓점 부채꼴**로 갈랐다(put(0)·put(i)·put(i+1)). 그것은 **볼록**하거나 0번에서 별꼴인
 *  다각형에서만 옳다. 넥서스의 표창 발판 윗면은 **네 날 별**(날 끝 ↔ 오목점이 번갈아 여덟 꼭짓점)이고 0번이
 *  날 끝이라, 부채질이 **날 사이 오목한 자리까지 메워** 날이 넓은 판때기로 퍼졌다(2D 는 Path2D 가 제 꼴로
 *  채우므로 안 났다 — 붓이 다르면 드러나는 자리다).
 *  그래서 귀 잘라내기(ear clipping)로 가른다: 낯의 법선에서 **지배 축을 빼** 2D 로 눕히고, 볼록하면 종전
 *  부채꼴(빠른 길), 오목하면 귀를 하나씩 자른다. 꼭짓점이 서른 남짓이라 O(n²)도 값이 없다(메시는 한 번 짓는다).
 *  낸 삼각형 수는 늘 n−2 라 미리 잡아 둔 버퍼 크기가 그대로 맞는다. */
function triIdx9(poly: number[], n: number, nx: number, ny: number, nz: number): number[] {
  const out: number[] = [];
  if (n === 3) return [0, 1, 2];
  // 지배 축을 빼고 2D 로 — |nz| 가 가장 크면 xy, |ny| 면 xz, 아니면 yz.
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  const iu = az >= ax && az >= ay ? 0 : ay >= ax ? 0 : 1;
  const iv = az >= ax && az >= ay ? 1 : ay >= ax ? 2 : 2;
  const U = (i: number): number => poly[i * 3 + iu];
  const V = (i: number): number => poly[i * 3 + iv];
  const cross9 = (a: number, b: number, c: number): number =>
    (U(b) - U(a)) * (V(c) - V(a)) - (V(b) - V(a)) * (U(c) - U(a));
  let area2 = 0;
  for (let i = 0; i < n; i += 1) { const j = (i + 1) % n; area2 += U(i) * V(j) - U(j) * V(i); }
  const sgn = area2 >= 0 ? 1 : -1;
  let convex = true;
  for (let i = 0; i < n && convex; i += 1) {
    if (sgn * cross9(i, (i + 1) % n, (i + 2) % n) < -1e-9) convex = false;
  }
  if (convex) { for (let i = 1; i + 1 < n; i += 1) out.push(0, i, i + 1); return out; }
  const idx: number[] = []; for (let i = 0; i < n; i += 1) idx.push(i);
  const inTri9 = (a: number, b: number, c: number, p: number): boolean => {
    const d1 = sgn * cross9(a, b, p); const d2 = sgn * cross9(b, c, p); const d3 = sgn * cross9(c, a, p);
    return d1 >= 0 && d2 >= 0 && d3 >= 0;
  };
  let guard = n * n + 8;
  while (idx.length > 3 && guard > 0) {
    guard -= 1;
    let cut = -1;
    for (let k = 0; k < idx.length; k += 1) {
      const a = idx[(k + idx.length - 1) % idx.length]; const b = idx[k]; const c = idx[(k + 1) % idx.length];
      if (sgn * cross9(a, b, c) <= 1e-12) continue;            // 오목한 귀(또는 일직선)는 못 자른다
      let ok = true;
      for (let m = 0; m < idx.length && ok; m += 1) {
        const p = idx[m];
        if (p === a || p === b || p === c) continue;
        if (inTri9(a, b, c, p)) ok = false;                     // 다른 꼭짓점을 품은 귀도 못 자른다
      }
      if (ok) { cut = k; break; }
    }
    if (cut < 0) break;                                         // 자를 귀가 없다(자기교차 등) — 남은 것은 부채꼴로
    const a = idx[(cut + idx.length - 1) % idx.length]; const b = idx[cut]; const c = idx[(cut + 1) % idx.length];
    out.push(a, b, c);
    idx.splice(cut, 1);
  }
  for (let i = 1; i + 1 < idx.length; i += 1) out.push(idx[0], idx[i], idx[i + 1]);
  return out;
}
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
/** ★ 그림자의 **번짐 고리는 걷었다**(2026-09, 지적: "연한 거 진한 거 한 장씩 두 장이 겹친다") ─────────────
 *  같은 실루엣을 1.1 배로 한 번 더 옅게 깔아 가장자리를 무르게 하려던 손이다. 그런데 배수는 **앵커를 축으로**
 *  걸리므로 고리가 실루엣을 감싸는 것이 아니라 **비스듬히 밀린 복사판**이 된다 — 부품마다 진한 타원 옆에
 *  옅은 타원이 하나씩 붙어 그림자가 둘로 읽혔다(실측: 사이언스 베슬의 포드 넷이 각각 두 겹). 무르게 하려면
 *  배수가 아니라 화면 자로 사방 조금씩 밀어 여러 번 깔아야 하는데(진짜 팽창), 그리기가 개체마다 네 번 더 든다.
 *  바닥에 눕힌 실루엣은 원래 해가 만드는 **단단한 그림자**이므로 한 겹으로 둔다 — 대신 알파를 조금 올린다
 *  (고리와 겹쳐 0.31 쯤으로 보이던 속을 한 겹 0.26 으로 맞춘다). */
export const SHADOW_ALPHA9 = 0.26;

/* ★ **번짐(블룸)** — 빛나는 낯만 1/4 크기 판에 한 번 더 그리고, 가로·세로로 흐린 뒤 화면에 **더한다**.
   2D 판에는 없던 몫이다(판은 색을 굽는 자라 빛이 새어 나올 수가 없었다). 밝기 문턱으로 고르지 않는 까닭:
   색만 보고는 '빛'과 '진한 물감'을 못 가른다(프로토스 금 #e6d063 과 켠 창 #ffe790 은 휘도·채도가 거의 같다).
   그래서 빛나는 자리를 **표식으로** 고른다(정점 aBb 비트 1 · shapeOblique.EMIT_FILL9). */
const FX_VS = `
attribute vec2 aXY; varying vec2 vUv;
void main() { vUv = aXY * 0.5 + 0.5; gl_Position = vec4(aXY, 0.0, 1.0); }`;
const FX_FS = `
precision mediump float;
uniform sampler2D uTex; uniform vec2 uStep; uniform float uStr;
varying vec2 vUv;
void main() {
  // 걸음이 0 이면 **한 번만** 읽는다(화면에 더하는 마지막 켜) — 전체 화면 켜에서 다섯 번 읽을 까닭이 없다.
  if (uStep.x == 0.0 && uStep.y == 0.0) { gl_FragColor = texture2D(uTex, vUv) * uStr; return; }
  /* 다섯 번 읽어 아홉 칸 가우시안을 흉내 낸다(선형 보간이 두 칸을 한 번에 읽는다 — 흔한 수법). */
  vec4 c = texture2D(uTex, vUv) * 0.2270270;
  c += (texture2D(uTex, vUv + uStep * 1.3846154) + texture2D(uTex, vUv - uStep * 1.3846154)) * 0.3162162;
  c += (texture2D(uTex, vUv + uStep * 3.2307692) + texture2D(uTex, vUv - uStep * 3.2307692)) * 0.0702703;
  gl_FragColor = c * uStr;
}`;
/** 번짐 세기·크기 — [더할 세기, 흐리기 걸음(1/4 판의 텍셀 배수)]. 눈으로 고른 값이다. */
const BLOOM9: [number, number] = [0.75, 1.6];

export class GlUnits9 {
  readonly gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private att: Record<string, number> = {};
  readonly meshes = new Map<string, GlMesh9 | null>();
  private queue: GlInst9[] = [];
  /** 번짐 — 전체 화면 사각 프로그램·사각 VBO·1/4 크기 판 둘(핑퐁). 처음 쓸 때 짓고, 크기가 바뀌면 다시 짓는다. */
  private fx: { prog: WebGLProgram; loc: Record<string, WebGLUniformLocation | null>; aXY: number; vbo: WebGLBuffer } | null = null;
  private bl: { fb: WebGLFramebuffer; tex: WebGLTexture }[] = [];
  private blW = 0; private blH = 0; private blFail = false;
  /** 진단: 마지막 프레임의 개체 수·삼각형 수·메시 수·메시 굽기 ms. */
  /** 진단: 마지막 프레임의 개체·삼각형 수 · 메시 벌 수 · 메시 굽기 ms(누적)와 **이번 프레임 몫**(frameBakeMs — 시계가
   *  '굽는 프레임'을 아는 자) · 깊이 칸/비트 · 살아 있는 메시 VBO 합(바이트). */
  /** evict: 상한에 걸려 버린 메시 수(누적) — **0 이 아니면 보관함이 좁다**. 늘 굽고 있다는 뜻이라 진단에 낸다. */
  stat = { inst: 0, tris: 0, bakeMs: 0, frameBakeMs: 0, meshes: 0, slots: 0, depthBits: 0, bytes: 0, bloom: 0, evict: 0 };
  /** meshMax: 메시 상한(기기 표 DEV9.glMeshMax — PC 600 · 폰 240; 메시 한 벌은 VBO + footOf 용 정점 사본이라 폰 메모리에 든다). */
  /* ⚠ meshMax·bloomOn 은 **읽기 전용이 아니다**(2026-09, 폰 세 단) — 벤치 단이 유휴 재기로 오르면 기기 표(DEV9)의
     값이 바뀌므로, glUnits9 가 다음 칠하기에서 그 벌에 새 값을 일러 준다. */
  constructor(readonly canvas: HTMLCanvasElement, public meshMax = MESH_MAX9, public bloomOn = true, public specOn = true) {
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
    for (const u of ["uAnchor", "uScale", "uYaw", "uCanvas", "uCam", "uTeam", "uLight", "uAlpha", "uDepth0", "uDepthK", "uPersp", "uShade", "uDy", "uLean", "uGrad", "uDbg", "uFlat", "uShadow", "uShZ", "uEmit", "uGloss", "uHalf", "uGrain"]) this.loc[u] = gl.getUniformLocation(p, u);
    for (const a of ["aPos", "aNrm", "aRgb", "aTeam", "aAlpha", "aOv", "aOrd", "aBb"]) this.att[a] = gl.getAttribLocation(p, a);
    /* 번짐 프로그램·사각 — 한 번만 짓는다(실패하면 번짐만 끈다). */
    try {
      const q = gl.createProgram()!;
      gl.attachShader(q, sh(gl.VERTEX_SHADER, FX_VS)); gl.attachShader(q, sh(gl.FRAGMENT_SHADER, FX_FS)); gl.linkProgram(q);
      if (!gl.getProgramParameter(q, gl.LINK_STATUS)) throw new Error("링크: " + gl.getProgramInfoLog(q));
      const vbo = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.fx = {
        prog: q, aXY: gl.getAttribLocation(q, "aXY"), vbo,
        loc: { uTex: gl.getUniformLocation(q, "uTex"), uStep: gl.getUniformLocation(q, "uStep"), uStr: gl.getUniformLocation(q, "uStr") },
      };
    } catch { this.fx = null; this.blFail = true; }
  }
  /** 1/4 크기 판 둘을 갖춘다(크기가 바뀌면 다시 짓는다) — 못 갖추면 번짐을 끈다. */
  private blooms(w: number, h: number): boolean {
    if (this.blFail || !this.fx) return false;
    if (w === this.blW && h === this.blH && this.bl.length === 2) return true;
    const gl = this.gl;
    for (const b of this.bl) { gl.deleteFramebuffer(b.fb); gl.deleteTexture(b.tex); }
    this.bl = [];
    for (let i = 0; i < 2; i += 1) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
        for (const b of this.bl) { gl.deleteFramebuffer(b.fb); gl.deleteTexture(b.tex); }
        this.bl = []; this.blFail = true; return false;
      }
      this.bl.push({ fb, tex });
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.blW = w; this.blH = h;
    return true;
  }
  /** 전체 화면 사각 한 장 — 판(tex)을 읽어 지금 걸린 곳에 그린다(uStep 0 이면 그냥 베끼기). */
  private fxQuad(tex: WebGLTexture, sx: number, sy: number, str: number): void {
    const gl = this.gl; const fx = this.fx!;
    gl.useProgram(fx.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, fx.vbo);
    gl.enableVertexAttribArray(fx.aXY);
    gl.vertexAttribPointer(fx.aXY, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(fx.loc.uTex, 0);
    gl.uniform2f(fx.loc.uStep, sx, sy);
    gl.uniform1f(fx.loc.uStr, str);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(fx.aXY);
  }
  /** 열쇠별 메시 — 처음 볼 때 run()(빌더를 요잉 0 으로 한 번 돌리는 일, 1~7ms)으로 짓는다. 못 지으면 null 로 굳는다. */
  private meshFor(key: string, run: () => { parts: { polys: number[][]; fill: string; alpha: number; team: boolean; ow: number; ob: number; bb?: boolean; solid?: boolean; flip?: boolean; flips?: boolean[]; emit?: boolean }[] }, bias0 = 0.8, glow = false): GlMesh9 | null {
    const got = this.meshes.get(key);
    /* ★ 찾았으면 **맨 뒤로 옮긴다**(2026-09, 지적: "모바일에서 화면 이동도 안 하고 유닛 변화도 거의 없는데
       모델 굽는 중이 계속 나오는 현상") ───────────────────────────────────────────────────────────
       이 줄이 없어서 보관함이 **LRU 가 아니라 FIFO** 였다. 버리는 자는 Map 의 삽입 차례를 보는데, 찾았을 때
       다시 안 넣으면 **매 프레임 쓰는 메시일수록 먼저 늙는다** — 상한에 닿는 순간 가장 많이 쓰는 것부터 버려지고,
       그것이 곧바로 다시 지어져 맨 뒤에 들어가며 다음 것을 밀어낸다. 화면이 한 톨도 안 움직여도 굽기가 영영
       이어진다(그래서 '굽는 중' 띠가 안 꺼지고, 시계가 굽는 프레임마다 시간을 안 보내 유닛도 거의 안 움직였다).
       삽입 차례는 '얼마나 오래되었나'이지 '얼마나 안 쓰나'가 아니다 — 지우고 다시 넣어 **쓴 차례**로 만든다. */
    if (got !== undefined) { this.meshes.delete(key); this.meshes.set(key, got); return got; }
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
          const cbb = (part.emit ? 1 : 0) + (part.solid ? 2 : 0) + (bb ? 4 : 0);
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
          const tri9 = triIdx9(poly, n, nx, ny, nz);
          for (let i = 0; i + 2 < tri9.length; i += 3) { put(tri9[i]); put(tri9[i + 1]); put(tri9[i + 2]); }
        }
      }
      if (vi) {
        const gl = this.gl;
        const vbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
        const n = vi;
        mesh = { vbo, n, nSolid: clear.length ? nSolid : n, bias, pts: new Float32Array(pts), bytes: buf.byteLength, cols: cols.size, foot: new Map(), gloss: glossOfKey9(key), emit: m.parts.some((p2) => p2.emit) };
        this.stat.bytes += buf.byteLength;
      }
    } catch (e) { console.warn("[gl9] 메시", key, e); }
    const ms0 = performance.now() - t0;
    this.stat.bakeMs += ms0; this.stat.frameBakeMs += ms0;
    /* 가장 **안 쓴** 것부터 버린다(위 ★ 로 Map 차례가 곧 쓴 차례다) — 포탑 각·건설 단계처럼 열쇠가 잘게
       갈리는 건물이 쌓이지 않게. while 인 까닭은 단이 상한을 **내릴** 수도 있기 때문이다(그때 한 번에 줄인다). */
    while (this.meshes.size >= this.meshMax) {
      const first = this.meshes.keys().next();
      if (first.done) break;
      const m = this.meshes.get(first.value);
      if (m) { this.gl.deleteBuffer(m.vbo); this.stat.bytes -= m.bytes; }
      this.meshes.delete(first.value);
      this.stat.evict += 1;
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
    /* ★ **칸은 화가 차례로 한 번에 정한다**(2026-09, 지적: "모델끼리 겹쳐질 때 각 부품이 별개로 앞뒤가
       판단되어서 정신없이 바뀐다. 모델 안에서는 각 부품의 값을 비교하지만 모델 간에는 하나로 정해서 비교해야") —
       그 지적이 곧 이 자의 규약이다. 개체 **사이**를 가르는 것은 오직 칸(uDepth0)이고, 개체 **안**의 부품
       앞뒤는 그 칸 안에서만(near + aOrd, 폭은 칸의 1/4) 겨룬다. 그러니 **화면에서 겹치는 두 개체가 같은 칸에
       들면** 두 모델의 부품이 서로 끼어들어 흔들린다 — near 는 모델 제 좌표라 어느 개체가 앞인지를 모른다.
       예전 셈은 x 로 정렬해 한 번 훑고 **두 번 더 완화**하는 꼴이었다. 이것은 겹침 그래프의 가장 긴 사슬을
       푸는 일인데, 완화 두 번으로는 사슬이 길면(난전의 유닛 무리) 수렴하지 않는다 — 그래서 겹친 채 같은 칸에
       남는 짝이 생기고, 그 짝이 프레임마다 바뀌니 '정신없이' 보였다.
       이제 **화가 차례(i 오름차순)** 로 돌면서 나보다 **먼저 칠하는**(j < i) 겹친 개체의 칸 + 1 을 고른다.
       j < i 는 이미 확정이므로 한 번에 정확하다(DAG 의 가장 긴 경로). 훑기도 셋에서 하나로 준다.
       ⚠ 칸이 늘면 칸 폭(2/(M+1))이 좁아진다 — 16비트 깊이 기기를 지키려 상한을 둔다(SLOT_MAX9).
          상한에 걸린 자리는 예전처럼 겹칠 뿐, 상한이 없을 때처럼 온 화면이 흔들리지는 않는다. */
    const order = q.map((_, i) => i).sort((a, b) => q[a].ax - q[b].ax);
    const posOf = new Int32Array(q.length);
    for (let k = 0; k < order.length; k += 1) posOf[order[k]] = k;
    const slotOf = new Int32Array(q.length);
    let rmax = 0; for (const it of q) if (it.gradR > rmax) rmax = it.gradR;
    const SLOT_MAX9 = this.stat.depthBits >= 24 ? 4096 : 512;
    let M = 1;
    for (let i = 0; i < q.length; i += 1) {
      const a = q[i]; const acy = a.ay + a.gradCy; const p = posOf[i];
      let s9 = 0;
      for (let dir = -1; dir <= 1; dir += 2) {
        for (let k = p + dir; k >= 0 && k < order.length; k += dir) {
          const j = order[k]; const b = q[j];
          const dx = a.ax - b.ax;
          if (Math.abs(dx) > a.gradR + rmax) break;
          if (j >= i) continue;   // 나보다 늦게 칠하는 것은 내 앞이지 뒤가 아니다
          const rr = a.gradR + b.gradR; const dy = acy - (b.ay + b.gradCy);
          if (dx * dx + dy * dy > rr * rr) continue;
          if (slotOf[j] + 1 > s9) s9 = slotOf[j] + 1;
        }
      }
      if (s9 > SLOT_MAX9) s9 = SLOT_MAX9;
      slotOf[i] = s9; if (s9 + 1 > M) M = s9 + 1;
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
      const gk = GL_SHADE9 < 1 || !this.specOn ? 0 : GL_SPEC9;
      gl.uniform4f(this.loc.uGloss, mesh.gloss[0], mesh.gloss[1] * gk, mesh.gloss[2], mesh.gloss[3] * gk);
    };
    let camNow: GlCam9 | null = null;
    const place = (it: GlInst9): void => {
      const th = (it.yawDeg * Math.PI) / 180;
      /* ★ 결은 **가까이서만** 켠다 — 줄 간격이 화소보다 촘촘해지면 결이 아니라 지글거림이다(WebGL1 은
         화소 미분(dFdx)이 없어 셰이더가 스스로 못 줄인다). 개체의 화면 배율(it.k = 모형 한 칸의 화소)로
         6 아래는 끄고 14 위는 다 켠다 — 낮은 배율에서는 유니폼이 0 이라 그 식이 **돌지도 않는다**.
         (가장 가는 결이 63 주파수라 k 14 에서 1.4화소다 — 그 아래로 내리면 물결무늬가 진다.) */
      const gk = Math.max(0, Math.min(1, (it.k - 6) / 8));
      gl.uniform1f(this.loc.uGrain, gk > 0 && GL_SHADE9 >= 1 ? it.mesh.gloss[4] * gk * GL_GRAIN9 : 0);
      gl.uniform2f(this.loc.uAnchor, it.ax, it.ay);
      gl.uniform3f(this.loc.uScale, it.k, it.k, it.yoff);
      gl.uniform2f(this.loc.uYaw, Math.cos(th), Math.sin(th));
      if (it.cam !== camNow) {
        camNow = it.cam; gl.uniform2f(this.loc.uCam, it.cam.squash, it.cam.zk); gl.uniform2f(this.loc.uLean, it.cam.lean, it.cam.shear);
        /* 반각 H = 정규화(빛 + 시선) — 시선은 카메라가 정하므로 카메라가 바뀔 때만 다시 낸다. */
        const hx = LIGHT[0]; const hy = LIGHT[1] + it.cam.zk; const hz = LIGHT[2] + it.cam.squash;
        const hl = Math.hypot(hx, hy, hz) || 1;
        gl.uniform3f(this.loc.uHalf, hx / hl, hy / hl, hz / hl);
      }
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
    /* 3) **번짐(블룸)** — 빛나는 낯만 1/4 판에 한 번 더 그리고, 가로·세로로 흐린 뒤 화면에 더한다.
       빛나는 메시가 없는 프레임은 건너뛴다(대부분의 유닛은 빛이 없다). 흐리기 판에는 깊이가 없으니
       깊이 없이 화가 차례로 겹친다 — 번짐은 어차피 뭉개지는 그림이라 앞뒤가 안 중요하다. */
    this.stat.bloom = 0;
    if ((GL_BLOOM9 === 1 || (GL_BLOOM9 < 0 && this.bloomOn)) && !this.blFail) {
      /* 번짐을 받을 개체 — 빛나는 메시이고 **화면에서 너무 작지 않은** 것만(작은 창 하나가 번져도 안 보인다).
         낮은 배율에서는 이 자로 거의 다 걸러져 번짐이 저절로 꺼진다. */
      let nEm = 0;
      for (const it of q) {
        if (!it.mesh.emit) continue;
        if (it.k * this.footOf(it.mesh, it.yawDeg, it.cam).w < 14) continue;
        nEm += 1;
      }
      const w4 = Math.max(4, bw >> 2); const h4 = Math.max(4, bh >> 2);
      if (nEm > 0 && this.blooms(w4, h4)) {
        this.stat.bloom = nEm;
        /* ★ **빛이 있는 자리만** 판을 비우고·흐리고·더한다(가위) — 번짐의 값은 거의 다 '전체 화면 한 겹 더하기'다.
           빛나는 개체가 셋뿐인 화면에서 지도 전체를 훑을 까닭이 없다(실측: 헤드리스 소프트웨어 GL 에서 전체
           화면으로 하면 프레임이 8배 늘었다). 개체마다 화면 상자(footOf — 이미 캐시된 값)를 모아 합치고
           번짐이 번지는 몫(1/4 판 여섯 텍셀 ≈ 화면 24px)만 넉넉히 넓힌다. */
        let sx0 = Infinity; let sy0 = Infinity; let sx1 = -Infinity; let sy1 = -Infinity;
        for (const it of q) {
          if (!it.mesh.emit) continue;
          const ft = this.footOf(it.mesh, it.yawDeg, it.cam);
          if (it.k * ft.w < 14) continue;
          const cx0 = it.ax + it.k * (ft.cx - ft.w / 2); const cx1 = it.ax + it.k * (ft.cx + ft.w / 2);
          const cy0 = it.ay + it.yoff + it.k * ft.top; const cy1 = it.ay + it.yoff + it.k * ft.bot;
          if (cx0 < sx0) sx0 = cx0; if (cx1 > sx1) sx1 = cx1;
          if (cy0 < sy0) sy0 = cy0; if (cy1 > sy1) sy1 = cy1;
        }
        const PAD9 = 28;
        const rx0 = Math.max(0, Math.floor((sx0 - PAD9) / 4)); const ry1 = Math.min(h4, Math.ceil((bh - (sy0 - PAD9)) / 4));
        const rx1 = Math.min(w4, Math.ceil((sx1 + PAD9) / 4)); const ry0 = Math.max(0, Math.floor((bh - (sy1 + PAD9)) / 4));
        const rw = Math.max(0, rx1 - rx0); const rh = Math.max(0, ry1 - ry0);
        if (rw < 1 || rh < 1) { this.stat.bloom = 0; return; }
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(rx0, ry0, rw, rh);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bl[0].fb);
        gl.viewport(0, 0, w4, h4);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.prog);
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
        gl.uniform1f(this.loc.uEmit, 1);
        gl.uniform1f(this.loc.uFlat, 1);
        gl.uniform4f(this.loc.uShade, 0, 0, 0, 0);
        for (let i = 0; i < q.length; i += 1) {
          const it = q[i];
          if (!it.mesh.emit) continue;
          if (it.k * this.footOf(it.mesh, it.yawDeg, it.cam).w < 14) continue;
          const [tr, tg, tb] = hexRgb(tone9(it.color));
          bind(it.mesh); place(it);
          gl.uniform3f(this.loc.uTeam, tr, tg, tb);
          gl.uniform1f(this.loc.uAlpha, it.alpha);
          gl.uniform1f(this.loc.uDepth0, 0.5);
          gl.drawArrays(gl.TRIANGLES, 0, it.mesh.n);
        }
        gl.uniform1f(this.loc.uEmit, 0);
        gl.uniform1f(this.loc.uFlat, 0);
        // 가로 → 세로로 흐린다(핑퐁). 걸음은 1/4 판의 텍셀 배수다.
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bl[1].fb);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendFunc(gl.ONE, gl.ZERO);
        this.fxQuad(this.bl[0].tex, BLOOM9[1] / w4, 0, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bl[0].fb);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.fxQuad(this.bl[1].tex, 0, BLOOM9[1] / h4, 1);
        // 화면에 더한다 — 빛은 쌓이는 것이라 더하기가 맞다(2D 의 lighter 와 같은 자).
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, bw, bh);
        gl.scissor(rx0 * 4, ry0 * 4, rw * 4, rh * 4);
        gl.blendFunc(gl.ONE, gl.ONE);
        this.fxQuad(this.bl[0].tex, 0, 0, BLOOM9[0]);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.SCISSOR_TEST);
        gl.useProgram(this.prog);
        gl.depthMask(true); if (GL_DEPTH9) gl.enable(gl.DEPTH_TEST);
      }
    }
  }
}
/** 진단 `#glshade=N` — 음영 겹을 단계별로 끈다(0 덧칠 없음 · 1 면 덧칠 · 2 +실루엣 빛, 기본 2). */
export const GL_SHADE9 = ((): number => { const m = typeof location !== "undefined" ? /glshade=(\d)/.exec(location.hash) : null; return m ? Number(m[1]) : 2; })();
/** 진단 `#gllod=N` — GL 메시 등급을 못 박는다(-1 = 화면 크기가 정하는 자동). `#glwarm=0` — 로딩 데우기에서 GL 메시를 안 짓는다. */
export const GL_LOD9 = ((): number => { const m = typeof location !== "undefined" ? /gllod=(\d)/.exec(location.hash) : null; return m ? Number(m[1]) : -1; })();
export const GL_WARM9 = !(typeof location !== "undefined" && /glwarm=0/.test(location.hash));
/** 진단 `#glbloom=0|1` — 번짐(블룸)을 끄거나(0) 못 박아 켠다(1). 안 주면 **기기 표**가 정한다(DEV9.glBloom: PC 켬 · 폰 끔 —
 *  번짐은 화면 한 겹을 더 칠하는 일이라 폰 GPU 에서 값을 실기로 재기 전까지는 안 켠다). */
/** 광택 세기 손잡이 — `#glspec=0` 끔 · `#glspec=1` 기본 · 사이 값으로 눌러 본다(표 값에 곱한다). */
export const GL_SPEC9 = ((): number => {
  const m = typeof location !== "undefined" ? /glspec=([\d.]+)/.exec(location.hash) : null;
  const v = m ? Number(m[1]) : 1;
  return Number.isFinite(v) ? Math.max(0, Math.min(4, v)) : 1;
})();
/** 메시 보관함 상한 손잡이 — `#glmesh=N`(기기 표를 덮는다). 보관함이 좁을 때의 굽기 되풀이를 재현할 때 쓴다. */
export const GL_MESH_MAX9 = ((): number => {
  const m = typeof location !== "undefined" ? /glmesh=(\d+)/.exec(location.hash) : null;
  const v = m ? Number(m[1]) : -1;
  return Number.isFinite(v) && v > 0 ? v : -1;
})();
/** 결 세기 손잡이 — `#glgrain=0` 끔 · `#glgrain=1` 기본 · 사이/위 값으로 눌러 본다(표 값에 곱한다). */
export const GL_GRAIN9 = ((): number => {
  const m = typeof location !== "undefined" ? /glgrain=([\d.]+)/.exec(location.hash) : null;
  const v = m ? Number(m[1]) : 1;
  return Number.isFinite(v) ? Math.max(0, Math.min(4, v)) : 1;
})();
export const GL_BLOOM9 = ((): number => {
  const m = typeof location !== "undefined" ? /glbloom=(\d)/.exec(location.hash) : null;
  return m ? Number(m[1]) : -1;
})();
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
export function glUnits9(cv: HTMLCanvasElement | null, meshMax = MESH_MAX9, bloom = true, spec = true): GlUnits9 | null {
  if (!GL_ON9 || !cv) return null;
  if (glInst9 !== undefined && (glInst9 === null || glInst9.canvas === cv)) {
    // 단이 올랐으면 새 상한·번짐을 그 벌에 옮긴다(벌은 한 번만 짓는다).
    if (glInst9) { glInst9.meshMax = GL_MESH_MAX9 > 0 ? GL_MESH_MAX9 : meshMax; glInst9.bloomOn = bloom; glInst9.specOn = spec; }
    return glInst9;
  }
  try { glInst9 = new GlUnits9(cv, GL_MESH_MAX9 > 0 ? GL_MESH_MAX9 : meshMax, bloom, spec); } catch (e) { console.warn("[gl9]", e); glInst9 = null; }
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
