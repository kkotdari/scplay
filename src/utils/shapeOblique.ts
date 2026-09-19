/* ── 사선 입체(오블리크) 공통 로직(요청: 표준화해서 매번 고치지 않게) ─────────────────
   지도 위 건물·유닛 벡터는 전부 같은 시점 하나로 그린다. 16×16 뷰박스 기준이다.

   시점 모델 — 3D 모형을 세워 놓고 요잉 −20°, 피칭 +를 준 시점이다(요청):
   · 요잉 − — 모형이 시계로 살짝 돌아, 정면-왼쪽 요소가 카메라 쪽(가깝고 크게), 오른쪽
     요소는 옆·뒤로 물러난다. 방사형 갈래라면: 앞-왼이 짧고 단면 최대, 왼쪽이 가장 긴
     옆모습, 오른쪽은 살짝 뒤라 단면이 없고, 정뒤는 어깨 너머로 빼꼼한다.
   · 피칭 + — 내려다보므로 바닥 원이 납작 타원(GROUND_SQUASH)이 되고, 뒤로 갈수록 화면
     위쪽으로 올라간다. 지면은 화면 아래쪽, 높이는 위쪽.
   · 빛 — 왼쪽 위에서 온다. 윗면이 가장 밝고, 오른쪽 옆면·아랫면이 어둡다.
     모든 3D 요소는 제 그림자를 갖는다(요청) — 뿔·다리·부속까지, 오른쪽 반이 어두워야
     겹친 요소끼리도 구분된다.
   · 깊이 — 바닥에 놓인 원은 세로로 눌린 타원으로 보인다(납작비 기본 0.45 = GROUND_SQUASH).
   · 지상 유닛은 채운 도형, 공중 유닛은 속을 뚫은 도형 — 하늘·땅이 한눈에 갈린다.

   원통 단면(동굴 입구) 규칙 — 해처리 다리에서 다듬어진 결론:
   · 앞(시청자 쪽)으로 뻗은 원통 — 단면 구멍이 크고 또렷하게 정면으로 보인다.
   · 옆으로 뻗은 원통 — 단면이 작게, 뻗는 방향과 직각으로 기울어 보인다.
   · 뒤로 뻗은 원통 — 단면이 반대편을 보므로 아예 안 그린다(둥근 등만 보인다).
   · 무언가(가시 등)가 단면에서 솟으면 입구가 가려지므로 그 다리의 캡은 그리지 않는다.

   감김(winding) 주의 — 해처리 본 기둥과 다리 사이가 자꾸 비던 원인:
   한 path 문자열 안의 부속 도형(M…Z 조각)들이 서로 겹칠 때, 감김 방향이 반대면
   nonzero 채움 규칙이 그 겹침을 구멍으로 뚫는다. 구멍을 내려는 것(공중 유닛의 속)이
   아니면 모든 조각을 같은 방향(시계)으로 감아야 한다. */

/** 겹쳐 그리는 면 하나 — [패스, 불투명도, 색?]. 색을 안 주면 currentColor. */
/** [패스, 불투명도, 색?, 깊이?, 등급?] — 넷째 값은 부품 중심의 화면 깊이(요잉 반영,
 *  +가 시청자 쪽)로, zsorted가 painter 순서를 다시 세우는 열쇠다. 없으면 '직전 부품에
 *  붙은 장식'으로 본다.
 *
 *  다섯째는 부품 등급(LOD, 요청: "형체를 결정하는것(개인색 포함)이 1티어 장식이 2티어
 *  세부포인트 3티어") — 없으면 1이다. **숫자가 작을수록 끝까지 남는다**:
 *    1 형체   작아져도 끝까지 그린다. 없으면 무엇인지 못 알아본다 —
 *             몸통·머리·다리·포신·날개, 그리고 **개인색**(누구 것인지).
 *    2 장식   형체 위에 얹히는 것. 명암(윗면 밝기·옆면 그늘), 덧댄 판, 큰 무늬.
 *    3 세부   가장 작은 것. 원통 단면, 광택 점, 리벳, 데칼, 잔가시. 가장 먼저 빠진다.
 *  걸러 내는 일은 스프라이트를 굽는 순간 딱 한 번 일어난다(unitSprite/buildingSprite) —
 *  프레임마다 재는 것이 아니라, 등급이 캐시 열쇠에 들어가 판이 등급별로 따로 구워진다. */
/** 면 하나 — [경로, 농도, 색?, 깊이 열쇠?, 등급?, 부품 번호?].
 *  ★ 여섯째가 부품 번호다(수리: 각도에 따라 팔·다리가 저·중에서 사라진다) — 넷째(깊이
 *    열쇠)는 **각도마다 값이 달라지는 깊이**라 부품 신원으로 쓸 수 없었다. 등급 매기기
 *    (autoTier)가 그 값의 '같은 값이 이어지는 구간'으로 부품을 묶고 있었는데, 각도가
 *    바뀌면 깊이가 재편돼 묶음이 통째로 달라졌다(실측: 99종 중 74종에서 부품 수가
 *    각도마다 바뀌었고, 러커는 면 45개 고정인데 부품이 13~21개로 흔들렸다). 그래서
 *    같은 팔이 각도마다 다른 등급을 받아 나타났다 사라졌다. 부품 번호는 굽는 각도와
 *    무관하게 '빌더가 몇 번째로 선언한 부품인가'만 말한다. */
export type ShapeFace = [string, number, string?, number?, number?, number?];
/* ⚠ 면을 **고쳐 쓰는** 헬퍼는 여섯째(부품 번호)를 반드시 그대로 넘겨라 — 색을 입히거나
   (paintBase·ivory·raceBase) 등급을 다시 매기는(shape·trim·fine) 함수들이 다섯 칸만
   풀어 새 배열을 만들면서 부품 번호를 통째로 떨어뜨리고 있었다. 그 한 칸이 없으면
   autoTier가 '부품'을 못 보므로(pid undefined면 그냥 통과) 부품 등급표가 아예 안 걸리고,
   면들은 제 명시 등급 그대로 남는다.
   그리면 어떻게 되는가: 몸을 그리는 명암(topFace·sideFace의 기본 등급은 장식 2)이 저(1)
   에서 통째로 빠져 건물이 단색 실루엣으로 뭉개진다(지적: "팩토리가 lod 저와 중에서 면이
   다 뭉개져서 알아볼 수가 없어"). 팩토리 실측: 면 194개 중 184개가 번호를 잃어 저에서
   106개만 남았고, 남은 것은 전부 밑칠이라 지붕·벽·창의 구분이 사라졌다.
   raceBase는 사실상 모든 모델이 지나는 길이라, 이 한 칸 때문에 부품 등급 체계가 여태
   거의 아무 데도 안 걸리고 있었다. */

/** 부품 등급 — 1(형체)은 기본값이라 아무 데도 안 적는다.
 *  0은 '형체 **확정**'이다(지적: 넥서스 네 기둥처럼 작아도 형태를 만드는 부품이 크기
 *  자동 판정에 밀려 내려갔다) — 자동 판정이 손대지 않고 어느 등급에서도 안 빠진다. */
export const LOD_CORE = 0;
export const LOD_TRIM = 2;
export const LOD_FINE = 3;
/** 이 면들을 '형체 확정(0티어)'으로 못 박는다 — 크기 자동 강등에서 빠진다. */
export function shape(faces: ShapeFace[]): ShapeFace[] {
  return faces.map(([p, o, f, k, , n]) => [p, o, f, k, LOD_CORE, n] as ShapeFace);
}
/** 이 면들을 '장식(2티어)'으로 매긴다 — 중간 크기부터 빠진다. */
export function trim(faces: ShapeFace[]): ShapeFace[] {
  return faces.map(([p, o, f, k, , n]) => [p, o, f, k, LOD_TRIM, n] as ShapeFace);
}
/** 이 면들을 '세부(3티어)'로 매긴다 — 가장 먼저 빠진다. */
export function fine(faces: ShapeFace[]): ShapeFace[] {
  return faces.map(([p, o, f, k, , n]) => [p, o, f, k, LOD_FINE, n] as ShapeFace);
}
/** 등급 q까지만 남긴다(q=3이면 전부). 등급이 없는 면은 형체(1)로 본다.
 *
 *  단 하나 예외 — **개인색 면은 절대 전멸하지 않는다**(지적: "LOD는 낮은 티어에 필수로
 *  개인색 포인트를 넣어야겠네"). 작게 그려질수록 '이게 무엇인가'보다 '누구 것인가'가
 *  더 급한데, 개인색을 포인트(2)로 매겨 두면 하필 그때 사라진다. 그래서 색을 안 준 면
 *  (fill이 없는 = 임자 색이 칠해질 면)들에 한해, 그중 가장 낮은 등급까지는 q를 무시하고
 *  통과시킨다. 모델러가 개인색 띠를 3등급 장식으로 매겨 두어도 형체만 그리는 판에서
 *  그 띠 하나는 살아남는다. */
export function lodFilter(faces: ShapeFace[], q: number): ShapeFace[] {
  if (q >= LOD_FINE) return faces;
  let pcMin = Number.POSITIVE_INFINITY;
  for (const f of faces) if (f[2] === undefined) pcMin = Math.min(pcMin, f[4] ?? 1);
  const pcQ = Number.isFinite(pcMin) ? Math.max(q, pcMin) : q;
  return faces.filter((f) => (f[4] ?? 1) <= (f[2] === undefined ? pcQ : q));
}

/** 표준 농도 눈금 — 면 헬퍼의 기본값. 은은하게/깊게도 이 눈금 안에서 고른다. */
export const OP = {
  top: 0.3, topSoft: 0.22,
  side: 0.3, sideSoft: 0.22, sideDeep: 0.35,
  /** 원통 단면(동굴 입구) — 옆면보다 한 단 어둡다. */
  cap: 0.4,
} as const;

/** 바닥 원의 납작비 — 사선 시점에서 눌려 보이는 정도(ry = rx × 0.45). */
export const GROUND_SQUASH = 0.45;
/** 평면(2D)에서 모델 높이를 한 번 더 누르는 몫(요청) — 1이면 카메라 각 그대로다. */
/** 입체(3D) 보기의 높이 배수 — **누름 없음**(2026-09, 요청: "3D 높이 눌림 제거").
 *  0.8 → 0.9 로 두 번 되물렸던 값이다. 평면이 TOP_Z_PRESS9 를 1.0 으로 돌리며 모델 z 좌표
 *  자체로 눌림을 옮겨 굳혔으므로(model-z-scale), 입체만 카메라에서 한 번 더 누르면 두 보기의
 *  키가 갈린다 — 같은 모델이 2D 와 3D 에서 다른 높이로 보이는 것이 그 몫이었다.
 *  ⚠ gl9 의 입체 카메라(zk)도 이 값을 쓴다 — 두 붓이 갈리면 GL 과 폴백의 키가 어긋난다. */
export const PITCH_ZK9 = 1.0;
export const TOP_Z_PRESS9 = 1.0;    // 0.82 → 0.75 → 0.8 → 0.9 → 0.85 → 0.8(요청) → 1.0: 그 0.8은 **모델 z 좌표 자체**로 옮겨 굳혔다(scripts/model-z-scale.mjs) — 카메라는 이제 정직하다
/** 평면(2D)의 **수직 카메라 각**(도) — 바닥 눌림은 sin, 높이 배율은 cos다(한 쌍이라야
 *  한 각의 그림이 된다). 여기만 고치면 둘이 함께 움직인다.
 *  ★ 이 각과 TOP_Z_PRESS9는 **딴 손잡이**다: 각은 바닥이 얼마나 눌리는가(지도 격자와의
 *    정합)를, 누름은 키만 얼마나 낮추는가(원작 실루엣)를 쥔다. 그래서 "지도에 맞는 각"과
 *    "원작에 맞는 키"는 서로 양보할 일이 아니다 — 각을 지도에 맞추고 누름으로 키를 맞춘다. */
export const TOP_ELEV9 = 40;   // 45 → 40 → 35 → 30 → 40 → 45 → 40(요청: 비교샷 뒤 40/0.80)
const TOP_SIN9 = Math.sin((TOP_ELEV9 * Math.PI) / 180);
const TOP_COS9 = Math.cos((TOP_ELEV9 * Math.PI) / 180);
/* ── 굽는 요잉 칸 ────────────────────────────────────────────────────────────────
   유닛은 22.5도 열여섯 칸으로 죈다 — 죄지 않으면 종류마다 방향 수만큼 판을 굽는다.
   그런데 **건물은 종류를 통틀어 각이 하나뿐**이라(BLD_YAW9) 죌 까닭이 없고, 죄면
   도리어 45의 배수 밖으로는 한 발도 못 나간다(지적: "수평 시점은 정확히 45도는 아니야
   그 이상으로 보여" — 56을 넣어도 반올림이 45나 67.5로 되돌렸다). 그래서 이 한 값만
   그대로 지난다. 판 수는 안 는다 — 건물이 쓰는 각이 하나인 것은 그대로다. */
/** 건물의 기본 요잉(도). engine9의 BUILDING_BASE_YAW가 이 값이다. */
export const BLD_YAW9 = 40;   // 45 → 55 → 60 → 30 → 40(요청: 수직·수평 모두 40도)
/** 건물 각이 그대로 지나는 눈금 — 지도의 BLD_YAW9와 **그 45도 배수 형제들**이다.
 *  도록이 건물을 네·여덟 방위로 보여 줄 때 그 방위가 곧 이 눈금이라(45 눈금을 −5도
 *  옮긴 것), 130·220·310도 죄이지 않고 지나야 도록의 컷이 지도의 자세를 90도씩 돌린
 *  그림이 된다. 45의 배수인 유닛 눈금(0·45·90…)은 BLD_YAW9가 45의 배수가 아닌 한
 *  여기에 안 걸리므로 유닛 쪽은 여태대로 22.5칸에 죄인다. */
const BLD_YAW_STEP9 = 45;
/** 굽는 요잉 칸 — 굽기·앵커가 **같은 식**을 써야 앵커가 제 부품을 안 벗어난다. */
export function yawBucket9(rotDeg: number): number {
  const off9 = (((rotDeg - BLD_YAW9) % BLD_YAW_STEP9) + BLD_YAW_STEP9) % BLD_YAW_STEP9;
  if (off9 < 1e-6 || BLD_YAW_STEP9 - off9 < 1e-6) return ((rotDeg % 360) + 360) % 360;
  return (((Math.round(rotDeg / 22.5) * 22.5) % 360) + 360) % 360;
}

/* 위에서 본 모드(요청: 입체 아닌 모드에서 에셋을 좀 더 부감으로) — 이 블록 안에서 구우면
   바닥 원은 더 동그랗고(0.66) 높이는 더 낮게(0.6) 투영된다. withYaw와 같은 수법. */
let topView = false;
/* 입체 보기 판(지적: 모델이 맵하고 안 맞음) — 지형이 45도로 기울어 보이므로 모델도
   같은 각으로 굽는다: 바닥 원 납작비·높이 배율 둘 다 cos45(0.71). 표준(0.45/0.89)은
   더 낮은 시점이라 45도 지형 위에서 어긋나 보였다. */
let pitchView = false;
export function withPitchView<T>(fn: () => T): T {
  pitchView = true;
  try {
    return fn();
  } finally {
    pitchView = false;
  }
}
export function withTopView<T>(fn: () => T): T {
  topView = true;
  try {
    return fn();
  } finally {
    topView = false;
  }
}
/* 시점 각 바(요청: PC 세로 바로 각도 5단계) — 입체 판의 바닥 눌림이 이제 고정값이
   아니다. 그리는 쪽(재생기)이 고른 각의 눌림을 여기 내려 주고, 이 판에서 굽는 모델이
   그 값을 쓴다. 기본값 0.52는 여태 붙박이로 있던 수 그대로다(=48도). */
let pitchSquash = 0.52;
export function setPitchSquash(v: number): void {
  /* 죄는 폭 0.2~0.95 → **0.06~1**(지적: "각도가 제한돼 있는 듯") ────────────────────
     이 값은 바닥 원의 납작비다: 1이면 완전한 원(곧장 내려다봄), 0에 가까울수록 눌려
     선에 가까워진다(옆에서 봄). 그러니 뜻이 있는 끝은 1과 0이지 0.95와 0.2가 아니다.
     옛 폭은 재생기가 쓰는 다섯 칸(각도 바)만 담으면 됐던 시절의 값이라, 도록에서 손으로
     끌어 보면 금세 벽에 닿았다. 1을 넘기지는 않는다 — 넘기면 세로가 가로보다 긴 원이
     되어 '내려다봄'을 지나 뒤집힌 그림이 된다. */
  pitchSquash = Math.min(1, Math.max(0.06, v));
}
/** 지금 유효한 바닥 납작비. */
export function groundSquashNow(): number {
  /* 0.66 → 0.55(수리: 넥서스 앞 바닥·기둥이 뷰박스 밖으로 잘렸다) — 앞쪽 깊이가
     원점(아래 originYNow)과 함께 16칸 안에 들어오는 선까지만 부감을 준다.
     ★ 0.55 → 0.50(요청: "2D 시점을 원작에 맞추기") — 평면 보기만 **지면과 높이가 서로
       다른 각**을 말하고 있었다: 납작비 0.55는 sin⁻¹로 33.4도, z 배율 0.66은 cos⁻¹로
       48.7도라 15도가 어긋났고(제곱합 0.738 — 한 카메라라면 1이어야 한다), 그래서 모델이
       제 지면보다 21% 납작하게 섰다. 도록(27/27)·입체(31/26)는 이미 맞물려 있었다.
       고칠 값은 **한 쌍**이어야 한다(sin θ, cos θ). 눈으로 30도·45도를 오간 끝에, 사용자가
       준 원작 렌더 그림을 **재서** 값을 뽑았다(요청: "이거 샘플링해서 2d 정확한 시점 추출").
         · 착륙 발판 셋은 땅에 놓인 **원**이다 — 그 타원의 세로/가로가 곧 sin θ다.
           앞왼 0.51 · 오른 0.48 · 앞오른 0.50 → **θ ≈ 30도**.
         · 지붕 벤트 상자의 네모(수평면 위 직사각형)에서 두 변의 방향을 풀면 요잉은 44~50도.
       재서 나온 값은 30도 한 쌍(0.5 / 0.866)이었다. 다만 **눈이 그보다 위를 원한다**
       (지적: "모든 모델이 높이가 높게 보여 전체적으로 눌러야 할 듯 / 수직도 더 높은 곳인
       거 같고") — 원작 그림은 원근 렌더라 발치의 원이 실제 카메라보다 납작하게 찍히고,
       무엇보다 우리 모델은 원작보다 키가 크다(아래 ★). 그래서 실측을 바닥으로 삼되
       한 단 위로 올려 둔다 — 지금은 **40도** 한 쌍이다: 0.643 / 0.766(45 → 40 → 35 → 30 → 40 → 45 → 40,
       비교샷을 놓고 고른 값이다 — 45도는 바닥이 지도 격자에 더 맞고 40도는 원작 실루엣에 더 가까웠다).
       각은 TOP_ELEV9 한 줄에서 sin·cos를 함께 뽑고, 높이는 TOP_Z_PRESS9로 따로 눌러, '원작과 같은
       각 + 낮춘 키'가 된다. 수평 요잉 40은 그대로다. 높이 대 깊이의 비가
       1.73 → 1.19(누름 몫까지 치면 0.98)로 떨어져 같은 모델이 확연히 눌려 앉는다.
       ★ 먼저 이 값으로 뒀을 때 "건물이 너무 솟는다"는 지적이 있었는데, 재 보니 까닭은
         카메라가 아니라 **모델 쪽**이었다: 같은 30도 카메라에서 실루엣의 세로/가로가
         원작 0.87 대 이 판의 배럭 1.05 — 우리 배럭이 제 footprint 대비 22% 더 높다.
         카메라는 실측대로 두고, 높이는 모델에서 손본다. */
  /* 입체 판 피칭(지적: 납작비가 아니라 피치가 안 맞음) — 지형의 화면 기하에 수치로
     맞춘다: 깊이 = 컨테이너 눌림 0.74 × cos45 ≈ 0.52, 높이 = cos45 ≈ 0.71. 여태
     높이를 0.84~0.94로 거의 안 줄여 모델만 껑충했던 게 피치 불일치의 정체다. */
  return pitchView ? pitchSquash : topView ? TOP_SIN9 : GROUND_SQUASH;
}
function zScaleNow(): number {
  // 0.71 → … → 0.94 → 1(지적: 1까지 늘려봐) — 높이 원본 그대로.
  /* 입체(pitch)의 z: 1 → 0.8(지적: "3D에서 높이가 높아 보여 — z가 좀 더 눌려야") — 45도 언저리로 내려다보는
     보기에서 세로가 1:1이면 건물이 실제보다 껑충하다. 평면(0.66)과 도록(0.89) 사이 값. */
  /* 평면은 cos45(0.707)에 **누름 몫**을 한 번 더 곱한다(요청: "2d에서 모델 공통 높이
     누르기") — 카메라 각과는 딴 손잡이다. 각을 더 올려 누르면 바닥 원까지 둥글어져
     지도 격자와 어긋나는데, 이 몫은 **높이만** 줄여 실루엣을 낮춘다. */
  return pitchView ? PITCH_ZK9 : topView ? TOP_COS9 * TOP_Z_PRESS9 : 0.89;
}
function originYNow(): number {
  return pitchView ? 12.6 : topView ? 12 : 12.6;
}

/* 등급은 면 헬퍼가 스스로 단다(요청: LOD 적용) — 모델 106개를 손으로 매기지 않아도
   프리미티브를 지나는 모든 면이 제 등급을 갖는다. 갈래가 곧 등급이기 때문이다:
     · 몸통(bodyFace) = 형체 1 — 개인색이 칠해지는 면이라 어느 등급에서도 안 빠진다.
     · 명암(topFace·sideFace) = 장식 2 — 형체 위에 얹는 흑백 반투명이다.
     · 단면·광택(capFace) = 세부 3 — 가장 작고 가장 먼저 빠진다.
   모델이 '이 흰 면은 형체다'라고 우기고 싶으면 lod 인자로 1을 준다(예: 빛나는 창처럼
   그 면이 없으면 실루엣이 안 읽히는 자리). */
/** 몸통 — 본색 그대로(형체 1티어). */
export const bodyFace = (d: string): ShapeFace => [d, 1];
/** 밝은 윗면 — 흰 반투명(기본 OP.top). 기본 등급은 장식 2. */
export const topFace = (d: string, opacity: number = OP.top, lod: number = LOD_TRIM): ShapeFace =>
  [d, opacity, "#fff", undefined, lod];
/** 어두운 옆·밑면 — 검 반투명(기본 OP.side). 기본 등급은 장식 2. */
export const sideFace = (d: string, opacity: number = OP.side, lod: number = LOD_TRIM): ShapeFace =>
  [d, opacity, "#000", undefined, lod];
/** 원통·구멍의 단면 — 동굴 입구처럼 깊은 어둠(기본 OP.cap). 기본 등급은 세부 3. */
export const capFace = (d: string, opacity: number = OP.cap, lod: number = LOD_FINE): ShapeFace =>
  [d, opacity, "#000", undefined, lod];

/** 바닥에 놓인 원(납작 타원) 패스 — 밝은 윗면·발판·고리에 두루 쓴다.
 *  시각 밀림 중이면 타원도 같이 기울인다(지적: 파일런·포토·소환구 원반만 안 기울어
 *  첨탑과 어긋난 롤로 보임) — 밀림 행렬 [[1,sh],[0,1]]을 입힌 타원도 타원이라,
 *  주축·각을 풀어 회전 타원 호로 그린다. */
/** ★ **우회로 진단** — 화면 자로 낸 경로가 어느 빌더 줄에서 났는지 적어 둔다
 *  (`scripts/recov-sites.mjs` 가 켠다. 평소엔 off 라 값이 0 이다). 되찾기로 살아난 면의
 *  경로를 이 표에 물으면 **고칠 줄이 그대로 나온다** — 경로 숫자를 눈으로 뒤질 일이 없다. */
export const SITE9 = { on: false, byD: new Map<string, string>() };
export function siteMark9(d: string): string {
  if (!SITE9.on) return d;
  const ls = (new Error().stack ?? "").split("\n").slice(2);
  SITE9.byD.set(d, (ls.find((l) => !l.includes("shapeOblique")) ?? ls[0] ?? "").trim());
  return d;
}
export const groundEllipse = (
  cx: number, cy: number, rx: number, ry: number = rx * groundSquashNow(),
): string => {
  if (!viewShear) {
    return siteMark9(`M${r2(cx - rx)} ${r2(cy)}a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx * 2)} 0`
      + `a${r2(rx)} ${r2(ry)} 0 1 0-${r2(rx * 2)} 0Z`);
  }
  const b = viewShear * ry;
  const t = rx * rx + b * b;
  const e = ry * ry;
  const ang = 0.5 * Math.atan2(2 * b * ry, t - e);
  const disc = Math.sqrt((t - e) * (t - e) + 4 * b * b * e);
  const R1 = Math.sqrt((t + e + disc) / 2);
  const R2 = Math.sqrt(Math.max(0.0001, (t + e - disc) / 2));
  const ux = R1 * Math.cos(ang);
  const uy = R1 * Math.sin(ang);
  const angDeg = r2((ang * 180) / Math.PI);
  return siteMark9(`M${r2(cx - ux)} ${r2(cy - uy)}a${r2(R1)} ${r2(R2)} ${angDeg} 1 0 ${r2(2 * ux)} ${r2(2 * uy)}`
    + `a${r2(R1)} ${r2(R2)} ${angDeg} 1 0 ${r2(-2 * ux)} ${r2(-2 * uy)}Z`);
};

/** 지면과 평행한 **고리**(도넛) 패스 — 바깥 타원 안에 안 타원을 반대로 감아 뚫는다
 *  (감김 주의: 같은 방향으로 감으면 구멍이 안 뚫린다 — 맨 위 주석 참고).
 *  손으로 A 호를 두 줄 적던 자리를 대신한다 — 시각 밀림도 groundEllipse가 알아서 탄다. */
export function annulusPath(
  cx: number, cy: number, ro: number, ri: number, squash: number = groundSquashNow(),
): string {
  return siteMark9(`${groundEllipse(cx, cy, ro, ro * squash)}${ringHole(cx, cy, ri, ri * squash)}`);
}
/** 3D 자리에 놓는 고리 — `annulusPath(...project(x, y, z), …)` 를 대신한다.
 *  경로는 글자까지 같고(같은 자·같은 납작비) 3D 로는 **땅에 누운 띠**(바깥 고리 ↔ 안 고리)를 적는다.
 *  ⚠ `ringFaces3` 와 다르다 — 그쪽은 몸 + 윗면 두 낯짜리 '테두리'이고, 이것은 경로 하나다. */
export function annulusPath3(
  cx: number, cy: number, z: number, ro: number, ri: number, squash: number = groundSquashNow(),
): string {
  const [sx, sy] = project(cx, cy, z);
  const d = annulusPath(sx, sy, ro, ri, squash);
  const ky = squash / (groundSquashNow() || 1);
  if (MESH9.on) {
    meshPut9(d, meshLoft9([meshRing9(cx, cy, z, 1, 0, 0, 0, ky, 0, ro, RSEG9),
      meshRing9(cx, cy, z, 1, 0, 0, 0, ky, 0, ri, RSEG9)], false, false));
  }
  return d;
}
/** 고리의 구멍 — groundEllipse와 반대로 감은 타원. */
function ringHole(cx: number, cy: number, rx: number, ry: number): string {
  return `M${r2(cx - rx)} ${r2(cy)}a${r2(rx)} ${r2(ry)} 0 1 1 ${r2(rx * 2)} 0`
    + `a${r2(rx)} ${r2(ry)} 0 1 1-${r2(rx * 2)} 0Z`;
}
/** 높이 z에 뜬 고리(3D 자리) — 몸통 + 윗면 밝기. 대야 테두리·부양 링에 쓴다. */
export function ringFaces3(
  cx: number, cy: number, z: number, ro: number, ri: number,
): ShapeFace[] {
  const [sx, sy] = project(cx, cy, z);
  const d = annulusPath(sx, sy, ro, ri);
  if (MESH9.on) meshPut9(d, meshLoft9([meshRing9(cx, cy, z, 1, 0, 0, 0, 1, 0, ro, 16), meshRing9(cx, cy, z, 1, 0, 0, 0, 1, 0, ri, 16)], false, false));
  return tagKey([bodyFace(d), topFace(d, OP.topSoft)], depthNow(cx, cy) + ro);
}

/** 모형 공간 점 — project에 그대로 넘긴다. */
export type Pt3 = readonly [number, number, number];
/** 곡면 판의 한 변 — [끝점]이면 직선, [제어점, 끝점]이면 2차 곡선. */
export type Seg3 = readonly [Pt3] | readonly [Pt3, Pt3];

/** 곡면 판 패스(요청: 곡면 판 전용 프리미티브) — 모형 공간 점들로 닫힌 조각을 그린다.
 *
 *  손으로 `M${pt(..)} Q${pt(..)} ${pt(..)} L${pt(..)}`를 이어 붙이던 자리를 그대로
 *  대신한다. 제어점을 그 자리 그대로 받으므로 **그림이 안 바뀌고**(요청: 기존 모양
 *  최대한 유지), 대신 손 문자열이 못 받던 것들을 받는다:
 *    · project를 지나므로 요잉·시각 밀림·앞숙임·판(평면/부감/입체)이 저절로 실린다.
 *    · 부품 깊이(tagKey)가 붙어 화가 순서에 제대로 낀다 — 손 면은 무깊이라 직전
 *      부품의 깊이를 물려받아 앞뒤가 뒤집히곤 했다.
 *    · 등급(LOD)이 붙어 사양에 따라 빠진다.
 *  상자·원통으로는 못 만드는 굽은 등판·꽃잎·집게·아가리가 이 프리미티브의 몫이다. */
export function curvePath3(start: Pt3, segs: readonly Seg3[], close = true): string {
  const d = curvePath3Str(start, segs, close);
  if (MESH9.on) {
    const poly: number[] = [...mp3(start[0], start[1], start[2])];
    let prev: Pt3 = start;
    for (const sg of segs) {
      if (sg.length === 1) { poly.push(...mp3(sg[0][0], sg[0][1], sg[0][2])); prev = sg[0]; }
      else {
        const [c, e] = sg;
        for (const t of [0.33, 0.66, 1]) { const u = 1 - t; const x = u * u * prev[0] + 2 * u * t * c[0] + t * t * e[0]; const y = u * u * prev[1] + 2 * u * t * c[1] + t * t * e[1]; const z = u * u * prev[2] + 2 * u * t * c[2] + t * t * e[2]; poly.push(...mp3(x, y, z)); }
        prev = e;
      }
    }
    meshPut9(d, [poly]);
  }
  return d;
}
function curvePath3Str(start: Pt3, segs: readonly Seg3[], close = true): string {
  const p = (q: Pt3): string => {
    const [x, y] = project(q[0], q[1], q[2]);
    return `${x} ${y}`;
  };
  let d = `M${p(start)}`;
  for (const sg of segs) d += sg.length === 1 ? ` L${p(sg[0])}` : ` Q${p(sg[0])} ${p(sg[1])}`;
  return close ? `${d} Z` : d;
}

/** 곡면 판 — curvePath3에 몸통·명암·부품 깊이를 한 번에 얹는다.
 *  fill을 주면 그 색(안 주면 개인색), lit/shade는 얹을 명암의 농도다.
 *  깊이는 판의 **가장 앞점**으로 잡는다(tagKey 주석의 규칙 — 중앙값은 길쭉한 판에서
 *  틀린다). */
export function plateFaces3(
  start: Pt3, segs: readonly Seg3[],
  opts: { fill?: string; lit?: number; shade?: number } = {},
): ShapeFace[] {
  const d = curvePath3(start, segs);
  const out: ShapeFace[] = [opts.fill ? [d, 1, opts.fill] : bodyFace(d)];
  if (opts.lit) out.push(topFace(d, opts.lit));
  if (opts.shade) out.push(sideFace(d, opts.shade));
  let key = depthNow(start[0], start[1]);
  for (const sg of segs) {
    for (const q of sg) {
      const k = depthNow(q[0], q[1]);
      if (k > key) key = k;
    }
  }
  return tagKey(out, key);
}

/** 두 화면 점을 잇는 **띠**(폭 있는 사각 판) — 양 끝 반폭을 따로 줄 수 있어 끝이
 *  가늘어지는 칼날·팔·힘줄에도 쓴다. 손으로 네 꼭짓점을 적던 자리를 대신한다. */
export function bandPath(
  ax: number, ay: number, bx: number, by: number, hwA: number, hwB: number = hwA,
): string {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return `M${r2(ax + nx * hwA)} ${r2(ay + ny * hwA)} L${r2(bx + nx * hwB)} ${r2(by + ny * hwB)}`
    + ` L${r2(bx - nx * hwB)} ${r2(by - ny * hwB)} L${r2(ax - nx * hwA)} ${r2(ay - ny * hwA)} Z`;
}

/** 세운 각기둥(상자) 3면 — 앞면(본색) + 윗면(밝게) + 오른 옆면(어둡게).
 *  (x, yBottom)이 앞면 왼쪽 아래, w×h가 앞면, depth가 뒤로 물러나는 길이다. */
export function boxFaces(
  x: number, yBottom: number, w: number, h: number, depth = 2,
): ShapeFace[] {
  const dx = r2(depth * 0.7);
  const dy = r2(-depth * 0.5);
  const yTop = yBottom - h;
  const front = `M${r2(x)} ${r2(yTop)} L${r2(x + w)} ${r2(yTop)} L${r2(x + w)} ${r2(yBottom)} L${r2(x)} ${r2(yBottom)} Z`;
  const top = `M${r2(x)} ${r2(yTop)} L${r2(x + dx)} ${r2(yTop + dy)} L${r2(x + w + dx)} ${r2(yTop + dy)} L${r2(x + w)} ${r2(yTop)} Z`;
  const side = `M${r2(x + w)} ${r2(yTop)} L${r2(x + w + dx)} ${r2(yTop + dy)} L${r2(x + w + dx)} ${r2(yBottom + dy)} L${r2(x + w)} ${r2(yBottom)} Z`;
  return [bodyFace(`${front} ${top} ${side}`), topFace(top), sideFace(side)];
}

/** 세운 원통 3면 — 몸통(본색, 바닥은 배부른 타원 호) + 윗면 타원(밝게) + 오른쪽 세로
 *  음영(어둡게). (cx, yBottom)이 바닥 타원의 중심이다. */
export function cylinderFaces(
  cx: number, yBottom: number, r: number, h: number, squash: number = GROUND_SQUASH,
): ShapeFace[] {
  const ry = r * squash;
  const yTop = yBottom - h;
  const body = `M${r2(cx - r)} ${r2(yTop)} L${r2(cx + r)} ${r2(yTop)} L${r2(cx + r)} ${r2(yBottom)}`
    + `a${r2(r)} ${r2(ry)} 0 1 1-${r2(r * 2)} 0Z`;
  const shade = `M${r2(cx + r * 0.35)} ${r2(yTop)} L${r2(cx + r)} ${r2(yTop)} L${r2(cx + r)} ${r2(yBottom)}`
    + `a${r2(r)} ${r2(ry)} 0 0 1-${r2(r * 0.65)} ${r2(ry * 0.92)}Z`;
  return [bodyFace(body), sideFace(shade, OP.sideSoft), topFace(groundEllipse(cx, yTop, r, ry))];
}

/** 방향 있는 원통(다리 등)의 단면을 어떻게 보일지 — 위 '원통 단면 규칙'의 코드판.
 *  앞이면 1(또렷), 옆이면 0.6(작고 기울여), 뒤면 0(그리지 않는다). 도형을 만드는 쪽이
 *  이 배율로 캡 크기를 정하고, 0이면 아예 빼면 된다. */
export type RadialDir = "front" | "side" | "back";
export const capScaleOf = (dir: RadialDir): number =>
  dir === "front" ? 1 : dir === "side" ? 0.6 : 0;

/** 소수 둘째 자리 반올림 — 패스 문자열이 지저분해지지 않게. */
function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ── 3D 투영 엔진(요청: 고도화 — 모든 유닛·건물에 적용할 준비) ────────────────────
   손으로 좌표를 깎는 대신, 모형을 3D로 기술하면 표준 시점으로 투영해 면 목록을 만들어
   준다. 모형 공간: x 오른쪽 · y 앞(시청자 쪽) · z 위, 단위는 뷰박스 칸(16×16), 지면
   원점은 도형 발밑 가운데다.

   투영 = 요잉(모형을 z축으로 YAW_DEG만큼) → 피칭(내려다보기: 앞뒤가 GROUND_SQUASH로
   눌리고 높이는 Z_SCALE로 선다) → 화면 (ORIGIN_X, ORIGIN_Y) 평행이동.

   쓰는 법 — 도형 하나는 대개 이렇게 조립한다:
     const faces: ShapeFace[] = [
       ...boxFaces3(0, 0, 6, 4, 3),            // 몸통 상자
       ...cylinderFaces3(0, 0, 2, 5),          // 가운데 원통
       ...limbFaces(-20, 5, 1.8),              // 방사 다리(단면 보임은 각도가 정한다)
     ];
   각 프리미티브가 몸통·윗면·옆면(·단면)을 표준 농도로 겹쳐 준다. 손 튜닝이 필요하면
   반환된 면의 패스를 그대로 다듬으면 된다. */

/** 표준 시점 상수 — 요잉 0°(정면, 지적: 기본값 자체를 정면으로), 피칭 +(내려다보기). */
export const VIEW = {
  yawDeg: 0,
  /** 앞뒤(깊이)의 화면 눌림 — 바닥 원의 납작비와 같다. */
  squash: GROUND_SQUASH,
  /** 높이(z)의 화면 배율 — cos(내려다보는 각) ≈ 0.89. */
  zScale: 0.89,
  /** 화면 원점 — 발밑 가운데가 앉는 자리. */
  originX: 8,
  originY: 12.6,
} as const;

/* 요잉 오버라이드(요청: 모델링 뷰어에서 시점 회전) — withYaw 블록 안에서만 값이 서고,
   블록을 나가면 표준 시점으로 돌아온다. 3D 프리미티브로 만든 도형은 이걸로 아무 각도에서나
   다시 투영할 수 있다(손으로 깎은 도형은 좌표에 시점이 구워져 불가). */
let yawOverride: number | null = null;
/** 모델 자체를 돌린다(요청: "앞으로 내가 요잉하라고 하는 건 그릴 때가 아니라 본 모델에서
 *  돌리라는 뜻") — 빌더 몸을 이 안에서 부르면, deg만큼 돌아간 것이 곧 그 모델이다.
 *  withYaw가 절대각을 못 박는 것과 달리 이것은 **지금 요잉에 얹는 상대 회전**이라,
 *  그리는 쪽이 주는 방향(유닛의 진행 방향·건물 기본 요잉) 위에 모델의 제 각이 더해진다.
 *  그래서 도록·지도·미니맵 어디서 굽든 같은 모델이 같은 자세로 선다 — 그리기 단계에
 *  건물마다 다른 각을 끼워 넣던 보정표(MODEL_YAW_TWEAK)가 없어진 자리다. */
/* 모델 회전(요청: "withSpin 걷어내고 좌표를 돌린 모델로") ─────────────────────────
   ★ 걷어낸 withSpin이 무엇을 잘못했나 — 그것은 `withYaw(currentYaw() − deg)`였다.
     곧 **모델이 아니라 카메라를 돌리는** 수법이다. 그림의 앞뒤는 맞게 나오지만
     `currentYaw()`를 읽는 것이 하나 더 있다: **세계 광원**(faceLight·facingRatio)이다.
     그래서 45도로 감싼 건물은 빛까지 45도 함께 돌아, 옆에 선 건물과 하이라이트 방향이
     어긋났다. "돌려도 광원은 고정"이라는 이 파일의 규약을 그 한 줄이 깨고 있었다.

   ★ 대신 하는 일 — **모형 좌표를 실제로 돌린다**. 이 블록 안에서는 모든 모형 점
     (project·depthNow의 입력)과 모든 모형 법선(faceLight·facingRatio의 입력)이
     deg만큼 돌아간 뒤 셈에 들어간다. 카메라와 광원은 한 톨도 안 움직인다.
     기하만 놓고 보면 옛 withSpin과 **정확히 같은 그림**이다(아래 회전식이 그 유도다):
       yaw Y에서 (x', y')를 그린 것이 yaw Y−d에서 (x, y)를 그린 것과 같으려면
         x' = x·cos d − y·sin d,  y' = x·sin d + y·cos d
       — 곧 표준 반시계 회전이다. 빌더의 숫자를 손으로 돌려 적는 것과 같은 일을,
       손이 아니라 이 한 자리에서 한다(수백 개 좌표를 옮겨 적다 틀릴 자리가 없다).

   겹쳐 쓰면 더해진다 — 안쪽 블록은 바깥 블록의 회전 위에 제 각을 얹는다. */
let modelSpinRad = 0;
export function withModelSpin<T>(deg: number, fn: () => T): T {
  const prev = modelSpinRad;
  modelSpinRad = prev + (deg * Math.PI) / 180;
  try {
    return fn();
  } finally {
    modelSpinRad = prev;
  }
}
/** 모형 평면 좌표(또는 평면 법선) 하나를 모델 회전만큼 돌린다 — 모형 공간이 셈에
 *  들어가는 **모든 입구**가 이것을 지난다: project · depthNow · faceLight · facingRatio.
 *  회전이 0이면 아무 일도 안 하므로, 안 감싼 모델은 값도 비용도 그대로다. */
function spun(x: number, y: number): [number, number] {
  if (!modelSpinRad) return [x, y];
  const c = Math.cos(modelSpinRad);
  const s = Math.sin(modelSpinRad);
  return [x * c - y * s, x * s + y * c];
}
/** 지금 유효한 모델 회전(도) — 다리 단면의 보임 판정처럼 각도로 셈하는 곳이 쓴다. */
export function modelSpinDeg(): number {
  return (modelSpinRad * 180) / Math.PI;
}
export function withYaw<T>(deg: number, fn: () => T): T {
  yawOverride = deg;
  try {
    return fn();
  } finally {
    yawOverride = null;
  }
}

/** 지금 유효한 요잉(도) — withYaw 안이면 그 값. */
function currentYaw(): number {
  return yawOverride ?? VIEW.yawDeg;
}

/** 화면 깊이(요잉 반영) — painter 정렬용. +가 시청자 쪽(앞). */
export function depthNow(x: number, y: number): number {
  // 깊이도 같은 자로 잰다 — 모델 축을 줄여 놓고 정렬만 옛 좌표로 하면 앞뒤가 뒤집힌다.
  const [mx, my] = spun(x * modelXK + modelXOff, y * modelYK + modelYOff);
  const th = (currentYaw() * Math.PI) / 180;
  return -mx * Math.sin(th) + my * Math.cos(th);
}
/* 부품 번호 매기개 — 굽기 한 판 안에서 tagKey·tagDepth가 불릴 때마다 하나씩 는다.
   빌더가 "여기까지가 한 부품이다"라고 선언하는 자리가 곧 그 둘이라, 호출 차례가 그대로
   부품 신원이 된다. 같은 빌더는 어느 각도에서도 같은 차례로 부르므로 각도와 무관하다. */
let partSeq = 0;
/** 굽기 한 판을 시작한다 — 부품 번호를 0부터 다시 센다. 모든 굽기가 이 문을 지나야
 *  같은 모델의 같은 부품이 각도가 달라도 같은 번호를 받는다. */
export function bake<T>(fn: () => T): T {
  partSeq = 0;
  return fn();
}
/** 부품 면들에 중심 깊이를 매긴다 — 손 면 묶음이 제 자리를 밝힐 때 쓴다. */
export function tagDepth(faces: ShapeFace[], x: number, y: number): ShapeFace[] {
  const d = depthNow(x, y);
  partSeq += 1;
  const pid = partSeq;
  return faces.map(([p, o, f, , l]) => [p, o, f, d, l, pid] as ShapeFace);
}
/** 깊이 키를 그대로 매긴다 — 프리미티브가 '부품 전체에서 가장 앞점'을 셈해 단다
 *  (지적: 중앙값 기준은 길쭉한 부품에서 틀린다 — 같은 부품도 깊이가 많이 다르다). */
export function tagKey(faces: ShapeFace[], key: number): ShapeFace[] {
  partSeq += 1;
  const pid = partSeq;
  return faces.map(([p, o, f, , l]) => [p, o, f, key, l, pid] as ShapeFace);
}
/** 이 면들을 **자 재기에서 뺀다**(요청: "그냥 유지하고 위치잡을 때 배제하랬지") ─────────
 *  정규화는 잉크 상자에 배수를 맞춘다. 그래서 몸에서 멀리 뻗은 가느다란 부품(스타포트
 *  안테나 같은) 하나가 상자를 제 길이만큼 늘리고, 그만큼 **건물 본체가 작게** 그려진다 —
 *  장대 하나가 건물의 크기를 깎는 셈이다. 모양은 그대로 두고 자에서만 빼는 표식이 이것이다.
 *  ⚠ 표식은 일곱째 칸이라 면을 고쳐 쓰는 헬퍼(paintBase·tagKey·trim…)가 떨어뜨린다 —
 *    **맨 마지막에** 씌워라. 그리는 쪽은 이 칸을 안 보므로 화면은 그대로다. */
export function boxSkip(faces: ShapeFace[]): ShapeFace[] {
  return faces.map((f) => [f[0], f[1], f[2], f[3], f[4], f[5], 1] as unknown as ShapeFace);
}
/** 그 표식이 붙었나 — 자를 재는 도구(bld-norm·model-norm)만 본다. */
export const isBoxSkip = (f: ShapeFace): boolean => (f as unknown as unknown[])[6] === 1;
/** 부품 깊이 정렬(지적: 요잉으로 뒤로 간 부품이 앞 부품 위에 그려져 '비쳐 보임') —
 *  깊이 있는 면은 뒤→앞으로, 깊이 없는 면은 직전 깊이를 물려받아(장식은 제 부품에
 *  붙어 다닌다) 안정 정렬한다. 맨 앞의 무깊이 면(바닥 그림자·스플랫)은 맨 뒤 층이다. */
export function zsorted(faces: ShapeFace[]): ShapeFace[] {
  let cur = -1e9;
  const keyed = faces.map((f, i) => {
    if (f[3] !== undefined) cur = f[3];
    return [f, cur, i] as const;
  });
  keyed.sort((a, b) => (a[1] - b[1]) || (a[2] - b[2]));
  return keyed.map(([f]) => f);
}

/* 세계 광원(요청: 모델을 돌려도 광원은 고정) — 왼쪽에서 약간 앞으로 비춘다. 세로 면의
   평면 법선(모형 기준)을 요잉만큼 돌려 광원과 내적: 왼쪽을 보는 면은 밝고 오른쪽을 보는
   면은 어둡다. 면이 시청자 쪽을 보는지도 여기서 판단한다. */
/** 광원의 **평면 방향**(시점 틀 기준) — 앞-왼쪽이다. faceLight가 면 법선과 재는 자다. */
export const LIGHT_PLAN: [number, number] = [-0.9, 0.45];
/** 광원의 **높이 몫** — 1이면 평면 크기만큼 위에 있다(대략 45도 위). */
export const LIGHT_ELEV = 1;
/** 광원의 **화면 방향**(단위 벡터, y는 아래가 +) — 앞-왼쪽-위를 화면으로 옮긴 값이다.
 *  평면 몫은 납작비로 눌리고(앞은 화면 아래), 높이 몫은 z 배율만큼 화면 위로 간다.
 *  지금 값(평면 0.643 · z 0.689)이면 대략 (−0.91, −0.41) — 왼쪽 위다.
 *  ★ 면 명암(faceLight) · 판 기울기(silhouetteLight) · 글로우가 **이 한 자**를 쓴다. */
export function lightScreenDir(): [number, number] {
  const x = LIGHT_PLAN[0];
  const y = LIGHT_PLAN[1] * groundSquashNow() - LIGHT_ELEV * zScaleNow();
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}
export function faceLight(
  nxModel: number, nyModel: number,
  /** 법선의 위 성분(경사면용, 지적: 벙커 하단·넥서스의 기운 옆면이 위 45도 시점에서
   *  안 보임) — 카메라가 내려다보므로 위로 기운 면은 수평 법선이 뒤를 향해도 보인다.
   *  수평 전용 판정은 그 면을 걷어내 구멍을 냈고, 그 틈으로 뒤 요소가 비쳐 보였다. */
  nzModel = 0,
): { visible: boolean; face: (d: string) => ShapeFace[] } {
  // 법선도 모델과 함께 돈다 — 광원은 세계에 고정이므로 돌아가는 것은 면 쪽이다.
  const [mnx, mny] = spun(nxModel, nyModel);
  const th = (currentYaw() * Math.PI) / 180;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const nx = mnx * c + mny * sn;
  const ny = -mnx * sn + mny * c;
  const dot = nx * LIGHT_PLAN[0] + ny * LIGHT_PLAN[1];
  /* ★★ **메시에는 이 명암을 굽지 않는다**(2026-09, 지적: "빛의 각도상 지금 포탑 옆면이 어두우면 안 되는
     각도인데 어둡단 말이지") — 이 자는 **세계 광원**과 낯의 각을 재는 자이고, 그 각은 `currentYaw()` 를
     지난 법선으로 잰다. 그런데 메시는 **요잉 0 에서 한 번만** 굽으므로(collectMesh9), 여기서 낸 몫이
     `aOv` 로 접혀 **몸과 함께 도는 명암**이 된다 — 요잉 0 에서 그늘이던 낯은 어느 각으로 돌려도 그늘이다.
     판을 요잉 칸마다 굽던 2D 시절에는 이 자가 칸마다 다시 돌아 옳았다(그래서 `#gl=0` 폴백·도록 SVG 는
     종전 그대로 둔다 — 아래 문은 `MESH9.on` 일 때만 닫힌다).
     GL 에서는 **같은 곡선을 셰이더가 돌아간 법선으로** 낸다(gl9 의 `면 빛`) — 빛이 세계에 못 박히고
     도는 것은 몸이 된다.
     ⚠ 실측(tanksiegegun 여덟 각 · 왼쪽−오른쪽 평균 휘도): +24.7 · +10.5 · −1.0 · −10.1 · +12.0 · +25.5 ·
       +23.0 · +28.7 — 빛이 고정이라면 죽 양수로 고르게 남아야 하는데 **부호가 뒤집혔다**. */
  const face = MESH9.on ? (): ShapeFace[] => [] : (d: string): ShapeFace[] => {
    if (dot > 0.3) return [topFace(d, Math.min(0.2, (dot - 0.3) * 0.3 + 0.08))];
    if (dot < -0.1) return [sideFace(d, Math.min(0.38, (-dot - 0.1) * 0.45 + 0.12))];
    return [];
  };
  /* 보임 판정도 시각 밀림만큼 돌린다(지적: 넥서스 옆면이 안 보임) — 소실점이 옮겨 간
     만큼 카메라가 비껴 보므로, 화면 가운데 쪽 옆면이 드러나야 한다. */
  const vphi = Math.atan(viewShear);
  // 내려다보는 몫 — 납작비가 곧 부감의 세기다(납작할수록 더 위에서 본다).
  const elev = groundSquashNow();
  return {
    // 메시 기록 중에는 뒷면도 낸다(MESH9.on) — GPU 가 모델을 아무 각으로나 돌리므로 3D 로는 모든 면이 있어야 한다.
    visible: MESH9.on || (ny * Math.cos(vphi) - nx * Math.sin(vphi)) + nzModel * elev > 0.02,
    face,
  };
}

/** 면이 카메라를 얼마나 마주보는가(−1~1) — faceLight의 보임 판정을 눈금으로 돌려준다.
 *  둥근 몸에 붙은 장식(어시밀레이터 알 등)을 모서리에서 뚝 끊지 않고, 돌아 나가며
 *  서서히 줄이는 데 쓴다. */
export function facingRatio(nxModel: number, nyModel: number): number {
  // 메시 기록 중에는 '마주 본다'로 답한다 — 마주 볼 때만 그리는 장식(벽 환풍구 등)이 3D 메시에 다 들어가게.
  if (MESH9.on) return 1;
  const [mnx, mny] = spun(nxModel, nyModel);
  const th = (currentYaw() * Math.PI) / 180;
  const nx = mnx * Math.cos(th) + mny * Math.sin(th);
  const ny = -mnx * Math.sin(th) + mny * Math.cos(th);
  const vphi = Math.atan(viewShear);
  return ny * Math.cos(vphi) - nx * Math.sin(vphi);
}

/** 면이 세계 광원을 얼마나 마주보는가(−1~1) — faceLight가 안에서 재는 그 값을 눈금으로
 *  돌려준다. faceLight는 이 값을 세 칸(밝음·없음·어둠)으로 **끊어서** 면을 내는데, 좁은
 *  각을 훑는 매끈한 곡면에서는 그 문턱이 판 한가운데를 가르는 **접힌 자국**으로 보인다
 *  (캐리어 덮개: 27도짜리 원통 조각이라 계단 하나가 통째로 등을 눌러 놓았다).
 *  그런 자리는 이 눈금을 받아 제 손으로 매끄러운 그러데이션을 깔면 된다. */
export function lightRatio(nxModel: number, nyModel: number): number {
  const [mnx, mny] = spun(nxModel, nyModel);
  const th = (currentYaw() * Math.PI) / 180;
  const nx = mnx * Math.cos(th) + mny * Math.sin(th);
  const ny = -mnx * Math.sin(th) + mny * Math.cos(th);
  return nx * LIGHT_PLAN[0] + ny * LIGHT_PLAN[1];
}

/* 모형 내부 원근(요청: 모델 안에서도 원근법 — 건물은 특히) — 앞(시청자 쪽)으로 나온
   점은 크게, 뒤로 물러난 점은 작게. 발밑 원점을 눈 축으로 삼아 깊이 나눗셈을 한다.
   project를 지나는 모든 프리미티브(상자·절두·기둥·다리·관·뿔)가 저절로 받는다. */
// 30 → 48(지적: 모델 원근이 과함) — 수렴을 눅인다.
const MODEL_PERSP = 48;
/* 시각 밀림(지적: 소실점이 정면이 아니라 시각을 반영해야) — 화면 가운데에서 벗어난
   마커는 깊이에 비례해 가로로 민다(앞은 바깥, 뒤는 안). 모델을 돌리는 요잉과 달리
   폭·세로선이 안 바뀌어 찌그러지지 않고, 내부 소실점만 시각 방향으로 옮겨 간다. */
let viewShear = 0;
/** 입체에서 높이(z)에 실리는 시각 밀림의 배수 — DOM 효과의 기울임(RMP lean9)도 이 값을 읽어야 모델과 같이 기운다. */
export const VIEW_LEAN_K = 0;   // 0.5 → 0.25 → 0(요청: "시각 밀림 0으로") — 높이는 화면에 곧게 선다. 바닥 소실 기울기는 그대로.
export function withViewShear<T>(sh: number, fn: () => T): T {
  viewShear = sh;
  try {
    return fn();
  } finally {
    viewShear = 0;
  }
}
/** 모델 자체 높이 배수 — withModelZ 안에서만 1이 아니다.
 *  화면 배율(zScale)이 아니라 **모형 좌표의 z**에 곱하므로, 지붕 위에 앉은 것도
 *  사면을 재는 값도 전부 같은 몫으로 따라 올라간다. 모델 파일의 z를 한 줄씩
 *  고치는 것과 결과가 같고, 되돌리기도 배수 하나다. */
let modelZK = 1;
/** 모델 자체 가로·세로 배수 — withModelScale 안에서만 1이 아니다. 모델 회전(spun)
 *  **앞에** 곱하므로 모형 제 축(x·y)을 늘이고 줄인다. 그래서 −90도로 돌려 세운
 *  모델에서는 x가 화면의 앞뒤가 된다 — 축을 고를 때 그 모델의 spin을 함께 봐야 한다. */
let modelXK = 1;
let modelYK = 1;
/** 이 안에서 만든 면들의 모형 치수를 축마다 다른 배수로 — 모델 파일의 좌표를 한 줄씩
 *  고치는 것과 결과가 같고, 되돌리기도 배수 셋이다. */
export function withModelScale<T>(kx: number, ky: number, kz: number, fn: () => T): T {
  const px = modelXK;
  const py = modelYK;
  const pz = modelZK;
  modelXK = kx;
  modelYK = ky;
  modelZK = kz;
  try {
    return fn();
  } finally {
    modelXK = px;
    modelYK = py;
    modelZK = pz;
  }
}
/** 높이만 k배 — withModelScale(1, 1, k)의 이름 있는 자리다. */
export function withModelZ<T>(k: number, fn: () => T): T {
  return withModelScale(1, 1, k, fn);
}
/** 모델 전체를 z로 평행이동(모델 단위) — 떠 있는 몸을 땅 쪽으로 내리는 데 쓴다(프로브). 배율 뒤에 더한다. */
let modelZOff = 0;
export function withModelZOff<T>(dz: number, fn: () => T): T {
  const p = modelZOff;
  // 모델 z 배수(withModelScale·withModelZ) 안에서는 이 이동도 모델 z라 같은 배수를 탄다.
  modelZOff = dz * modelZK;
  try {
    return fn();
  } finally {
    modelZOff = p;
  }
}
/** 모델 전체를 제 축 x·y로 평행이동(모델 단위, **회전 전**) — 발자국 가운데에서 벗어나 앉은 모델(디파일러
 *  마운드: 덩이가 뒤로 쏠려 화면에서 위로 떠 보임)을 옮기는 데 쓴다. 배율 뒤·회전 앞에 더한다. */
let modelXOff = 0;
let modelYOff = 0;
export function withModelShift<T>(dx: number, dy: number, fn: () => T): T {
  const px = modelXOff; const py = modelYOff;
  modelXOff = dx; modelYOff = dy;
  try {
    return fn();
  } finally {
    modelXOff = px; modelYOff = py;
  }
}
/** 모형 좌표를 **빌더 자에서** 비트는 손(높이에 따라 앞뒤로 물리는 전단 따위) — 배율·평행이동·회전보다
 *  앞이다. project·modelPoint9 가 태우므로 2D 경로·3D 메시·총구 표식이 한 자로 비틀린다.
 *  ⚠ depthNow 는 z 를 모르므로 **안 태운다** — 키는 비틀기 전 자리로 매긴다(부품끼리의 앞뒤 차례는 그대로다). */
let modelWarp: ((x: number, y: number, z: number) => [number, number, number]) | null = null;
export function withModelWarp<T>(
  warp: (x: number, y: number, z: number) => [number, number, number], fn: () => T,
): T {
  const p = modelWarp;
  modelWarp = warp;
  try {
    return fn();
  } finally {
    modelWarp = p;
  }
}
/** 모형 좌표 하나를 **모델 변환만** 태운다(배율·평행이동·회전) — 요잉·시점·사영은 안 탄다.
 *  빌더가 제 부품 좌표로 적은 점(총구 등)을 그 빌더를 감싼 withModelScale·Shift·Spin을
 *  거친 '판의 모형 좌표'로 옮기는 데 쓴다. project의 앞 두 줄과 같은 셈이다. */
export function modelPoint9(x0: number, y0: number, z0: number): [number, number, number] {
  if (modelWarp) [x0, y0, z0] = modelWarp(x0, y0, z0);
  const z = z0 * modelZK + modelZOff;
  const [mx, my] = spun(x0 * modelXK + modelXOff, y0 * modelYK + modelYOff);
  return [mx, my, z];
}
/** 모형 좌표 (x,y,z) → 화면 [sx, sy]. y(앞)는 아래로, z(위)는 위로 간다. */
export function project(x0: number, y0: number, z0: number): [number, number] {
  if (modelWarp) [x0, y0, z0] = modelWarp(x0, y0, z0);
  const z = z0 * modelZK + modelZOff;
  // 모델 회전이 먼저다 — 돌아간 좌표를 카메라가 본다(카메라는 안 움직인다).
  const [mx, my] = spun(x0 * modelXK + modelXOff, y0 * modelYK + modelYOff);
  const th = ((yawOverride ?? VIEW.yawDeg) * Math.PI) / 180;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const rx = mx * c + my * sn;
  const ry = -mx * sn + my * c;
  /* 앞으로 숙임(지적: 시청자 쪽으로 숙여야 한다) — 입체 판에서 꼭대기일수록 시청자
     쪽으로 기운다(z가 깊이에 태워짐). 지붕 윗면이 드러나 45도 내려다보는 지형과 자세가
     맞는다. sin20° ≈ 0.34. */
  const ry2 = pitchView ? ry + z * 0.34 : ry;
  /* 원근 배율은 원래 깊이만(지적: 원근이 과함) — 앞숙임 몫(z×0.34)까지 넣으면 키 큰
     꼭대기가 덩달아 확대돼 과한 원근으로 보였다. */
  const f = MODEL_PERSP / (MODEL_PERSP - Math.max(-10, Math.min(10, ry)));
  /* 원근은 가로 수렴만(지적 둘: 높이까지 태우면 반대쪽이 들리는 가짜 롤, 깊이까지
     태우면 요잉한 옆구리가 앞으로 쏟아짐) — 세로선은 곧게, 앞뒤는 납작비 그대로.
     시각 밀림(viewShear)은 화면 깊이(ry×납작비)에 태워, 바닥의 남북 선 기울기가
     지도의 소실 기울기(u/P)와 정확히 같아진다(지적: 노란선-빨간선 어긋남). */
  /* 가로 밀림은 앞숙임 제외한 원래 깊이(ry)에만(지적: 가장자리에서 안쪽으로 롤 된
     느낌) — 숙임 몫(z×0.34)까지 태우면 바닥 앞변만 바깥으로 밀려 세로선이 기운다.
     세로 기울임은 + 방향(초록 기대선)이 맞고, 0.8은 과했다(지적 왕복: -0.8은 이상,
     +0.8은 수정탑이 통째 이동해 떨어져 보임 — 그건 파일런 보석의 화면 좌표 문제로
     따로 수리) — 절반쯤인 +0.5로. */
  /* 세로 기울임 0.5 → 0.25(요청: "시각 밀림 줄여봐" — 가장자리 모델의 윗부분이 바깥으로 기우는 몫). 바닥 남북선의
     소실 기울기(ry 항)는 지도와 맞물린 값이라 그대로 두고, 높이에 실리는 밀림만 반으로. */
  const rx2 = rx + ry * groundSquashNow() * viewShear
    + (pitchView ? z * VIEW_LEAN_K * viewShear : 0);
  return [r2(VIEW.originX + rx2 * f), r2(originYNow() + ry2 * groundSquashNow() - z * zScaleNow())];
}

/* ── 메시 층(2026-09) ─────────────────────────────────────────────────────────────
   면(ShapeFace)의 경로 문자열은 화면(2D)용이다. GPU 그리기·자료 도구는 **3D 폴리곤**이 필요하므로, 도형 헬퍼가
   면을 낼 때 그 면의 3D 폴리곤(들)을 경로 문자열을 열쇠로 곁표(MESH9.byD)에 함께 적어 둔다. 점은 **판 모형 공간**
   (모델 배율·이동·회전(withModelScale·Shift·Spin·ZOff)은 먹고, 요잉·시점·사영은 안 먹은 좌표)이다 — 요잉·카메라는
   GPU 가 건다. 켜져 있을 때만 적으므로(meshOn9) 평소 굽기 비용은 그대로다.
   곡선 도형(관·뿔·돔·구·원통·원반·고리·곡면판)은 화면 곡선 그대로 두고 3D 근사 메시를 따로 적는다 — 2D 그림은 한
   톨도 안 바뀐다(스냅샷 대조로 지킨다). 화면 전용 도형(groundEllipse·screenCircle·bandPath)은 메시가 없다. */
/** 3D 폴리곤 — x,y,z 삼중 나열(판 모형 공간). */
export type Poly3 = number[];
/** ★ **빛을 내는 색**(2026-09) — GL 의 번짐(블룸)이 이 색으로 칠한 면만 문다. 색만 보고는 '빛'과 '진한 물감'을
 *  못 가른다(프로토스 금 #e6d063 은 휘도 0.85·채도 0.51 로 켠 창 #ffe790 과 거의 같다). 그래서 **켜지는 자리**가
 *  스스로 적는다: bake9 의 `winLit`·`glowLit` 이 불이 켜질 때 제 색을 여기 넣는다(늘 빛인 플라즈마는 미리 적어 둔다). */
/* 미리 적힌 빛: 플라즈마 #e4f6ff · 캐리어 창 #5fe6ff · 관문 보석 결정면 #c4f4ff·#7fd6ff(2026-09 — 손으로 그린
   번짐 겹을 걷으며 그 빛들을 블룸이 물게 했다. 늘 켜진 빛은 winLit 을 안 지나므로 여기 적는다). */
export const EMIT_FILL9 = new Set<string>(["#e4f6ff", "#5fe6ff", "#c4f4ff", "#7fd6ff"]);
export const MESH9 = { on: false, byD: new Map<string, Poly3[]>() };
/* (걷어냄) 화면점 → 모형점 표(`PROJ9`)와 그 되짚기(`unproject9`) — '화면 자로 그린 경로를
   3D 로 승격시키는' 길의 재료였다. 면을 내는 자가 제 3D 를 함께 적게 되어(mesh9 머리의 ★★)
   쓸 자리가 없어졌다. project() 가 점마다 표에 적던 몫도 함께 사라진다. */
export function meshOn9(on: boolean): void { MESH9.on = on; if (!on) MESH9.byD.clear(); }
/** 면의 3D 폴리곤을 곁표에 적는다(열쇠 = 경로 문자열).
 *  ⚠ **빈 표는 이미 있는 기하를 못 지운다** — 빈 표는 '이 낯의 기하는 딴 낯이 낸다'는 표식이지 '없다'가 아니다.
 *  관·막대가 제 둘째 낯에 빈 표를 적을 때 그 경로가 딴 부품(구 껍질 따위)과 글자까지 같으면, 없앤 것이
 *  아니라 **그 부품을 지우는** 꼴이 된다(실측: 핵 사일로에서 지름 0.6 짜리 구 하나가 그렇게 사라졌다.
 *  덮임 표에도 안 걸린다 — 빈 표는 분모에서 빠지므로 '일부러 비운 낯'으로 세어졌다). */
export function meshPut9(d: string, polys: Poly3[]): void {
  if (!MESH9.on) return;
  if (polys.length === 0 && (MESH9.byD.get(d)?.length ?? 0) > 0) return;
  MESH9.byD.set(d, polys);
}
/** 판 모형 공간 점(모델 변환만) — 메시에 적는 점은 전부 이것을 지난다. */
export const mp3 = (x: number, y: number, z: number): number[] => modelPoint9(x, y, z) as unknown as number[];
/** 링(둘레 점들) 둘을 잇는 옆면 사각들 + (원하면) 양 끝 뚜껑 — 관·원통·뿔·돔 메시의 공통 재료. */
export function meshLoft9(rings: number[][][], capA = true, capB = true): Poly3[] {
  const out: Poly3[] = [];
  for (let k = 0; k + 1 < rings.length; k += 1) {
    const a = rings[k]; const b = rings[k + 1]; const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i += 1) { const j = (i + 1) % n; out.push([...a[i], ...a[j], ...b[j], ...b[i]]); }
  }
  if (capA && rings[0].length > 2) out.push(rings[0].flat());
  if (capB && rings[rings.length - 1].length > 2) out.push(rings[rings.length - 1].flat());
  return out;
}
/** 축 (ax,ay,az)→(bx,by,bz) 둘레의 원 링 — 반지름 r, sides 등분. 축과 직각인 두 축(u·v)을 세운다. */
export function meshRing9(cx: number, cy: number, cz: number, ux: number, uy: number, uz: number, vx: number, vy: number, vz: number, r: number, sides: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < sides; i += 1) {
    const t = (i / sides) * Math.PI * 2; const c = Math.cos(t) * r; const s9 = Math.sin(t) * r;
    out.push(mp3(cx + ux * c + vx * s9, cy + uy * c + vy * s9, cz + uz * c + vz * s9));
  }
  return out;
}
/** 화면 좌표 2D 폴리곤 곁표 — 경로 문자열을 다시 파싱하지 않고 Path2D 를 숫자로 짓는 지름길(bake9 pathOf). */
export const POLY2 = new Map<string, Float64Array>();
const POLY2_MAX = 120000;
/** 3D 꼭짓점 목록 → 닫힌 직선 패스. (곡선이 필요하면 결과 좌표를 Q로 이어 다듬는다.) */
export function polyPath3(pts: [number, number, number][]): string {
  const n = pts.length;
  const xy = new Float64Array(n * 2);
  let s = "";
  for (let i = 0; i < n; i += 1) {
    const [sx, sy] = project(pts[i][0], pts[i][1], pts[i][2]);
    xy[i * 2] = sx; xy[i * 2 + 1] = sy;
    s += `${i === 0 ? "M" : " L"}${sx} ${sy}`;
  }
  s += " Z";
  if (POLY2.size >= POLY2_MAX) POLY2.clear();
  POLY2.set(s, xy);
  if (MESH9.on) { const poly: number[] = []; for (const q of pts) poly.push(...mp3(q[0], q[1], q[2])); MESH9.byD.set(s, [poly]); }
  return s;
}

/** 지면과 평행한 원(높이 z) — 화면에선 납작 타원. */
export function discPath3(cx: number, cy: number, z: number, r: number, ryS?: number, seg = 12): string {
  const sq = groundSquashNow();
  const ry = ryS ?? r * sq;
  const [sx, sy] = project(cx, cy, z);
  const d = groundEllipse(sx, sy, r, ry);
  /* ★ `ryS` 는 **화면 자** 세로 반지름이다(빌더가 눈으로 고른 납작한 타원 — 그림자·얼룩).
     경로는 종전 groundEllipse 그대로 내고, 3D 로는 그 타원을 **땅에 누운 고리**로 적는다:
     화면 세로가 ryS 가 되려면 모형 y 반지름이 ryS/납작비 라야 한다. */
  /* ⚠ 조각 수 기본값 **12 는 원통 몸통과 맞춘 값**이다(cylinderFaces3 의 링도 12) — 뚜껑만 잘게 쪼개면
     모서리를 두 낯이 나눠 쓰지 못해 '닫힌 입체' 판정(mesh9 solidSigns9)이 깨진다. 큰 땅 원반처럼
     짝이 없는 자리에서만 `seg` 를 올린다(핵 충격파·구름은 32 — 16 이면 둘레가 다각형으로 읽혔다). */
  if (MESH9.on) meshPut9(d, [meshRing9(cx, cy, z, 1, 0, 0, 0, r > 0 ? ry / (sq * r) : 1, 0, r, seg).flat()]);
  return d;
}

/* 켤레 지름 타원 — 평면 위 원을 투영하면 화면에선 두 켤레 반지름 벡터 u·v로 표현되는
   타원이 된다(P(t) = C + u·cos t + v·sin t). 주축 반지름·기움각을 풀어 호 둘로 그린다.
   groundEllipse의 밀림 처리와 같은 수법을 일반화한 것. */
function conjugateEllipsePath(
  cx: number, cy: number, ax: number, ay: number, bx: number, by: number,
): string {
  const dot = ax * bx + ay * by;
  const t0 = 0.5 * Math.atan2(2 * dot, ax * ax + ay * ay - (bx * bx + by * by));
  const ux = ax * Math.cos(t0) + bx * Math.sin(t0);
  const uy = ay * Math.cos(t0) + by * Math.sin(t0);
  const R1 = Math.max(Math.hypot(ux, uy), 0.01);
  const R2 = Math.max(Math.abs(ax * by - ay * bx) / R1, 0.01);
  const angDeg = r2((Math.atan2(uy, ux) * 180) / Math.PI);
  return `M${r2(cx - ux)} ${r2(cy - uy)}a${r2(R1)} ${r2(R2)} ${angDeg} 1 0 ${r2(2 * ux)} ${r2(2 * uy)}`
    + `a${r2(R1)} ${r2(R2)} ${angDeg} 1 0 ${r2(-2 * ux)} ${r2(-2 * uy)}Z`;
}

/** 세로 벽에 붙은 원 무늬(지적: 서플라이 앞 팬·어시밀레이터 앞 알이 각도 따라 본체와
 *  따로 놈) — 화면 좌표에 동그라미를 그리면 요잉해도 시청자만 바라봐 벽에서 떨어져
 *  보인다. 벽 평면(x축과 나란, 깊이 y) 위 중심 (cx, cz)·반지름 rx(가로)·rz(세로)를
 *  제 투영으로 구워, 벽과 함께 돌고 눌리게 한다. */
export function wallDiscPath(
  cx: number, y: number, cz: number, rx: number, rz: number = rx,
): string {
  const [sx, sy] = project(cx, y, cz);
  const [axx, axy] = project(cx + rx, y, cz);
  const [bxx, bxy] = project(cx, y, cz + rz);
  const d = conjugateEllipsePath(sx, sy, axx - sx, axy - sy, bxx - sx, bxy - sy);
  if (MESH9.on) { const ring: number[] = []; for (let i = 0; i < 12; i += 1) { const t = (i / 12) * Math.PI * 2; ring.push(...mp3(cx + rx * Math.cos(t), y, cz + rz * Math.sin(t))); } meshPut9(d, [ring]); }
  return d;
}

/** 벽 무늬의 평면 좌표계 — 중심과 켤레 축을 돌려주어, 부속 장식(팬 날개 등)을 같은
 *  평면 안에서 그릴 수 있게 한다. pt(각, 가로배율, 세로배율)가 화면 점을 준다. */
export function wallFrame(
  cx: number, y: number, cz: number, rx: number, rz: number = rx,
): { c: [number, number]; pt: (t: number, kx?: number, kz?: number) => [number, number] } {
  const [sx, sy] = project(cx, y, cz);
  const [axx, axy] = project(cx + rx, y, cz);
  const [bxx, bxy] = project(cx, y, cz + rz);
  const ux = axx - sx;
  const uy = axy - sy;
  const vx = bxx - sx;
  const vy = bxy - sy;
  return {
    c: [sx, sy],
    pt: (t, kx = 1, kz = kx) => [
      r2(sx + ux * kx * Math.cos(t) + vx * kz * Math.sin(t)),
      r2(sy + uy * kx * Math.cos(t) + vy * kz * Math.sin(t)),
    ],
  };
}

/** 세운 다각기둥 — 평면 다각형(plan)을 z0에서 h만큼 밀어 올린다. 규칙 다각형이 아니어도
 *  되므로 사다리꼴·모서리 깎은 육각형처럼 손으로 잡은 단면을 그대로 세울 수 있다.
 *  옆면은 보이는 것만, 세계 광원 밝기로(faceLight) — 돌려도 명암이 안 뒤집힌다. */
export function prismZFaces(
  plan: readonly (readonly [number, number])[], z0: number, h: number,
  /** 윗면을 덮을지 — 남의 몸에 두르는 띠는 뚜껑이 몸속에 묻혀 있어 그리면 안 된다
   *  (그리면 그 원판이 몸을 덮는다). 그런 토막은 false로 벽만 남긴다. */
  capTop = true,
  /** ★ **이 벽은 안 그린다**(2026-09, 요청: "배틀크루저 포구는 튀어나오는 게 아니라 오히려 함몰") —
   *  벽 한가운데(모형 좌표)를 받아 참이면 건너뛴다. spirePillar 의 `skipFace` 와 같은 규약이고
   *  쓰임도 같다: 벽에 **진짜 구멍**을 뚫고 그 둘레를 부르는 쪽이 제 손으로 메운다.
   *  ⚠ 뚜껑(capTop·밑면)은 이 문을 안 지난다 — 필요하면 따로 막아라. */
  skipFace?: (mx: number, my: number, mz: number) => boolean,
): ShapeFace[] {
  const n = plan.length;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of plan) { cx += x; cy += y; }
  cx /= n;
  cy /= n;
  let rad = 0;
  for (const [x, y] of plan) rad = Math.max(rad, Math.hypot(x - cx, y - cy));
  const faces: ShapeFace[] = [];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    // 벽의 바깥 법선 — 변의 가운데가 단면 중심에서 어느 쪽인가로 잡는다.
    const mx = (plan[i][0] + plan[j][0]) / 2 - cx;
    const my = (plan[i][1] + plan[j][1]) / 2 - cy;
    const len = Math.hypot(mx, my) || 1;
    const { visible, face } = faceLight(mx / len, my / len);
    if (!visible) continue;
    if (skipFace && skipFace((plan[i][0] + plan[j][0]) / 2, (plan[i][1] + plan[j][1]) / 2, z0 + h / 2)) continue;
    const d = polyPath3([
      [plan[i][0], plan[i][1], z0], [plan[j][0], plan[j][1], z0],
      [plan[j][0], plan[j][1], z0 + h], [plan[i][0], plan[i][1], z0 + h],
    ]);
    faces.push(bodyFace(d), ...face(d));
  }
  if (capTop) {
    const top = polyPath3(plan.map(([x, y]) => [x, y, z0 + h] as [number, number, number]));
    faces.push(bodyFace(top), topFace(top, OP.topSoft));
  }
  // 깊이 키는 원기둥과 같은 규칙 — 가장 앞점이되 제 높이만큼만.
  return tagKey(faces, depthNow(cx, cy) + Math.min(h, rad));
}

/** 두 단면을 잇는 **다각 뿔대** — prismZFaces(같은 단면을 위로 민 기둥)의 일반형이다.
 *  아래 단면(planA, zA)과 위 단면(planB, zB)은 꼭짓점 수가 같아야 하고, i번 꼭짓점끼리
 *  이어진다. 옆면이 기울면 그만큼 법선이 하늘을 향하므로(frustumFaces3의 nzOf와 같은 셈)
 *  내려다보는 카메라에 그 벽이 밝게 잡힌다.
 *  왜 필요한가: spirePillar는 단면이 늘 정다각형(또는 눌린 타원)이라 '뒤만 한 면인'
 *  단면을 못 그리고, prismZFaces는 임의 단면을 그리지만 위아래가 같아 좁아지지 않는다. */
export function loftZFaces(
  planA: readonly (readonly [number, number])[], zA: number,
  planB: readonly (readonly [number, number])[], zB: number,
  capTop = true,
): ShapeFace[] {
  const n = Math.min(planA.length, planB.length);
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i += 1) { cx += planA[i][0] + planB[i][0]; cy += planA[i][1] + planB[i][1]; }
  cx /= n * 2;
  cy /= n * 2;
  const h = zB - zA;
  let rad = 0;
  for (let i = 0; i < n; i += 1) {
    rad = Math.max(rad, Math.hypot(planA[i][0] - cx, planA[i][1] - cy),
      Math.hypot(planB[i][0] - cx, planB[i][1] - cy));
  }
  type Wall = { d: string; n: [number, number]; nz: number; k: number };
  const walls: Wall[] = [];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const ax = (planA[i][0] + planA[j][0]) / 2 - cx;
    const ay = (planA[i][1] + planA[j][1]) / 2 - cy;
    const bx = (planB[i][0] + planB[j][0]) / 2 - cx;
    const by = (planB[i][1] + planB[j][1]) / 2 - cy;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const len = Math.hypot(mx, my) || 1;
    const eA = Math.hypot(ax, ay);
    const eB = Math.hypot(bx, by);
    walls.push({
      d: polyPath3([
        [planA[i][0], planA[i][1], zA], [planA[j][0], planA[j][1], zA],
        [planB[j][0], planB[j][1], zB], [planB[i][0], planB[i][1], zB],
      ]),
      n: [mx / len, my / len],
      nz: (eA - eB) / (Math.hypot(h, eA - eB) || 1),
      k: facingRatio(mx / len, my / len),
    });
  }
  /* 벽은 **등진 것부터** 그린다(frustumFaces3의 ★와 같은 까닭) — 위가 좁으면 등진 벽도
     법선의 위 성분으로 '보이는 벽'에 들어, 고정 차례면 그 덮개가 가까운 벽 위에 찍힌다. */
  walls.sort((a, b) => a.k - b.k);
  const faces: ShapeFace[] = [];
  for (const w of walls) {
    const { visible, face } = faceLight(w.n[0], w.n[1], w.nz);
    if (!visible) continue;
    faces.push(bodyFace(w.d), ...face(w.d));
  }
  if (capTop) {
    const top = polyPath3(planB.map(([x, y]) => [x, y, zB] as [number, number, number]));
    faces.push(bodyFace(top), topFace(top, OP.topSoft));
  }
  return tagKey(faces, depthNow(cx, cy) + Math.min(Math.abs(h), rad));
}

/** 눕힌 다각기둥 — **앞뒤가 밑면**이다(지적: "앞뒤가 밑면인 기둥이야"). 단면(plan)은
 *  (x, z) 평면의 다각형이고, 그것을 y0에서 앞으로 len만큼 민다. prismZFaces가 다각형을
 *  위로 미는 것과 짝이고, prismXFaces(옆으로 미는 것)와는 미는 축이 다르다.
 *
 *  옆면의 법선은 (x, 0, z)라 수평 성분이 0인 면(위·아래 뚜껑)이 생긴다 — faceLight에
 *  z 성분을 그대로 넘겨 '내려다보는 카메라'가 위를 보는 면만 살리게 하고, 하늘을 보는
 *  면에는 윗면 밝기를 얹는다(수평 광원 셈만으로는 밋밋하다).
 *  앞뒤 밑면은 그쪽을 마주볼 때만 그린다 — 남의 몸에 두르는 띠는 둘 다 꺼서 벽만 남긴다. */
export function prismYFaces(
  plan: readonly (readonly [number, number])[], y0: number, len: number,
  capFront = true, capBack = false,
): ShapeFace[] {
  const n = plan.length;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of plan) { cx += x; cz += z; }
  cx /= n;
  cz /= n;
  let rad = 0;
  for (const [x, z] of plan) rad = Math.max(rad, Math.hypot(x - cx, z - cz));
  const faces: ShapeFace[] = [];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const mx = (plan[i][0] + plan[j][0]) / 2 - cx;
    const mz = (plan[i][1] + plan[j][1]) / 2 - cz;
    const l = Math.hypot(mx, mz) || 1;
    const nx = mx / l;
    const nz = mz / l;
    const { visible, face } = faceLight(nx, 0, nz);
    if (!visible) continue;
    const d = polyPath3([
      [plan[i][0], y0, plan[i][1]], [plan[j][0], y0, plan[j][1]],
      [plan[j][0], y0 + len, plan[j][1]], [plan[i][0], y0 + len, plan[i][1]],
    ]);
    faces.push(bodyFace(d), ...face(d));
    if (nz > 0.35) faces.push(topFace(d, OP.topSoft * nz));
  }
  const capAt = (y: number, sgn: 1 | -1): void => {
    if (facingRatio(0, sgn) <= 0.02) return;
    const pts = plan.map(([x, z]) => [x, y, z] as [number, number, number]);
    const d = polyPath3(sgn > 0 ? pts : [...pts].reverse());
    faces.push(bodyFace(d), ...faceLight(0, sgn).face(d));
  };
  if (capFront) capAt(y0 + len, 1);
  if (capBack) capAt(y0, -1);
  // 깊이 키는 다른 기둥과 같은 규칙 — 제 가운데이되, 이길 수 있는 폭은 제 굵기까지.
  return tagKey(faces, depthNow(cx, y0 + len / 2) + Math.min(rad, len));
}

/** 세운 상자 — frustum의 특수형. 보이는 면·세계 광원은 frustumFaces3가 맡는다. */
/** 뺄 낯 목록에 이 법선이 들었나 — omit 은 낯 하나([1,0])나 여러 낯([[1,0],[0,1]])을 받는다. */
const omitHas9 = (
  omit: readonly [number, number] | readonly (readonly [number, number])[] | undefined,
  nx: number, ny: number,
): boolean => {
  if (!omit) return false;
  if (typeof omit[0] === "number") {
    const o = omit as readonly [number, number];
    return Math.abs(o[0] - nx) < 0.01 && Math.abs(o[1] - ny) < 0.01;
  }
  for (const o of omit as readonly (readonly [number, number])[]) {
    if (Math.abs(o[0] - nx) < 0.01 && Math.abs(o[1] - ny) < 0.01) return true;
  }
  return false;
};
export function boxFaces3(
  cx: number, cy: number, w: number, d: number, h: number, z0 = 0,
  /** 벽 하나 빼기 — frustumFaces3 의 그 자다(구멍 뚫린 벽을 손으로 짤 때). */
  /** ★ 여러 낯도 준다(2026-09) — 가운데를 파낸 벽이 셋이면(팩토리 앞·뒤·왼쪽) 한 번에 빼야 한다. */
  omit?: readonly [number, number] | readonly (readonly [number, number])[],
  /** 윗면 빼기 — frustumFaces3 의 그 자다(위에 같은 바닥의 덩이가 올라앉을 때). */
  noTop?: boolean,
): ShapeFace[] {
  return frustumFaces3(cx, cy, w, d, w, d, h, z0, omit, noTop);
}

/** ★ **모서리를 깎은 네모 기둥**(위에서 보면 팔각) — boxFaces3 와 같은 자리·같은 규약이고, 세로 모서리
 *  넷만 `cut` 만큼 사선으로 잘라 벽이 여덟이 된다(2026-09, 요청: "배럭 … 세로 모서리 네 개를 사선으로
 *  깎아서 위에서 보면 8각형이 되게 · 사선 길이는 길지 않게 살짝만").
 *  ⚠ `cut` 은 **모서리에서 각 변을 따라 물러나는 길이**다 — 사선 자체의 길이는 그 √2 배다.
 *  ⚠ w/2·d/2 의 절반을 넘기지 마라(넘으면 변이 뒤집힌다) — 여기서 잘라 둔다. */
export function boxOctFaces3(
  cx: number, cy: number, w: number, d: number, h: number, z0 = 0,
  cut: number | readonly [number, number, number, number] = 0.6,
  /** ★ 여러 낯도 준다(2026-09) — 위 omit 과 같은 규약이다. */
  omit?: readonly [number, number] | readonly (readonly [number, number])[], noTop?: boolean,
): ShapeFace[] {
  const a = w / 2; const b = d / 2;
  /* 깎임은 **모퉁이마다** 줄 수 있다(2026-09, 요청: "앞쪽 건물 뒤쪽 두 모서리 사선 깎은 거
     없애고") — 네 값의 차례는 (+x,+y) · (+x,−y) · (−x,−y) · (−x,+y) 다. 0 이면 그 모퉁이는
     직각으로 남고 벽이 그만큼 준다(넷 다 0 이면 그냥 네모다). */
  const cs = (typeof cut === "number" ? [cut, cut, cut, cut] : cut)
    .map((v) => Math.max(0, Math.min(v, a * 0.5, b * 0.5)));
  if (!cs.some((v) => v > 0)) return boxFaces3(cx, cy, w, d, h, z0, omit, noTop);
  const zt = z0 + h;
  /** 모퉁이마다 [들어오는 변에서 물러난 점, 나가는 변에서 물러난 점] — 도는 방향은 boxFaces3 와 같다. */
  const nook = (i: number, c: number): [number, number][] => (
    i === 0 ? [[a - c, b], [a, b - c]]
      : i === 1 ? [[a, -b + c], [a - c, -b]]
        : i === 2 ? [[-a + c, -b], [-a, -b + c]]
          : [[-a, b - c], [-a + c, b]]);
  const plan: [number, number][] = [];
  for (let i = 0; i < 4; i += 1) {
    const [p0, p1] = nook(i, cs[i]);
    if (cs[i] > 0) plan.push(p0, p1); else plan.push(p0);   // 안 깎으면 두 점이 한 점이다
  }
  plan.unshift(plan.pop() as [number, number]);   // 앞(+y) 왼쪽에서 시작하도록 한 칸 돌린다
  const n9 = plan.length;
  const at = (z: number): [number, number, number][] =>
    plan.map(([px, py]) => [cx + px, cy + py, z] as [number, number, number]);
  const t = at(zt); const bo = at(z0);
  const top = polyPath3(t);
  /** 벽의 평면 법선은 **제 변에서 뽑는다**(변이 몇이든 맞다) — 도는 방향에서 바깥쪽은 (−dy, dx). */
  const sides = plan.map((p, i) => {
    const q = plan[(i + 1) % n9];
    const dx = q[0] - p[0]; const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    return {
      d: polyPath3([t[i], t[(i + 1) % n9], bo[(i + 1) % n9], bo[i]]),
      n: [-dy / len, dx / len] as [number, number],
    };
  });
  const out: ShapeFace[] = [];
  const bodyParts: string[] = noTop ? [] : [top];
  // 등진 벽부터 앞으로 — frustumFaces3 의 그 차례다(가까운 벽의 덮개가 마지막에 와야 한다).
  const ordered = sides
    .map((f) => ({ f, k: facingRatio(f.n[0], f.n[1]) }))
    .sort((p, q) => p.k - q.k)
    .map(({ f }) => f);
  for (const f of ordered) {
    if (omitHas9(omit, f.n[0], f.n[1])) continue;
    const { visible, face } = faceLight(f.n[0], f.n[1], 0);
    if (!visible) continue;
    bodyParts.push(f.d);
    out.push(...face(f.d));
  }
  return tagKey(
    [...(bodyParts.length ? [bodyFace(bodyParts.join(" "))] : []), ...out,
      ...(noTop ? [] : [topFace(top)])],
    depthNow(cx, cy) + Math.min(h, a * Math.abs(depthNow(1, 0)) + b * Math.abs(depthNow(0, 1))),
  );
}

/** 세운 원통 — 바닥 중심 (cx,cy), 반지름 r, 높이 h. 몸통 + 밝은 윗면 + 오른쪽 세로 음영. */
export function cylinderFaces3(
  cx: number, cy: number, r: number, h: number, z0 = 0,
): ShapeFace[] {
  const [bx, by] = project(cx, cy, z0);
  /* 꼭대기 x도 제 투영으로(지적: 파일런·포토가 안쪽 기움) — 바닥 x를 재사용하면
     몸통이 바깥 롤·앞숙임을 안 타고 수직으로만 서서, 기운 바닥 타원과 어긋난다. */
  const [tx, ty] = project(cx, cy, z0 + h);
  const ry = r * groundSquashNow();
  /* 실루엣의 윗변은 직선 현이 아니라 윗타원의 '뒤 반호'(수리·지적: 동그란 판 뒤 반쪽이
     검게 뚫림) — 직선으로 자르면 납작하고 넓은 드럼일수록 윗면 뒤 반쪽이 몸에 안 담겨
     배경이 비쳤다. 뒤 반호(위로 볼록) + 오른 벽 + 앞 반호(아래로 볼록) + 왼 벽. */
  const body = `M${r2(tx - r)} ${r2(ty)} A${r2(r)} ${r2(ry)} 0 0 1 ${r2(tx + r)} ${r2(ty)}`
    + ` L${r2(bx + r)} ${r2(by)}`
    + `a${r2(r)} ${r2(ry)} 0 1 1-${r2(r * 2)} 0Z`;
  const shade = `M${r2(tx + r * 0.35)} ${r2(ty)} L${r2(tx + r)} ${r2(ty)} L${r2(bx + r)} ${r2(by)}`
    + `a${r2(r)} ${r2(ry)} 0 0 1-${r2(r * 0.65)} ${r2(ry * 0.92)}Z`;
  /* 깊이 키 = 가장 앞점, 단 제 높이만큼만(재지적: 넓고 낮은 받침이 몸통을 덮음) —
     부품이 이웃을 가릴 수 있는 건 제 키 높이까지라, 앞으로 뻗은 만큼을 높이로 자른다. */
  if (MESH9.on) meshPut9(body, meshLoft9([meshRing9(cx, cy, z0, 1, 0, 0, 0, 1, 0, r, 12), meshRing9(cx, cy, z0 + h, 1, 0, 0, 0, 1, 0, r, 12)]));
  /* ⚠ 뚜껑은 `discPath3` 로 낸다 — `groundEllipse(tx, ty, r, ry)` 와 **글자까지 같은 경로**를 내면서
     3D 로 제 자리 고리를 적는다. 화면 자로 두면 뚜껑만 기록이 없어 되찾기로 살아났다(원통을 쓰는
     빌더가 수십이라, 이 한 줄이 우회로의 가장 큰 덩이였다). */
  return tagKey(
    [bodyFace(body), sideFace(shade, OP.sideSoft), topFace(discPath3(cx, cy, z0 + h, r))],
    depthNow(cx, cy) + Math.min(h, r),
  );
}

/** 방사형 다리(수평 반원통) — 평면각 angleDeg(0=시청자 쪽, +는 오른쪽), 뿌리 거리 r0,
 *  길이 len, 폭 w. 단면(동굴 입구)의 보임은 각도가 정한다(요잉이 이미 계산에 들어간다):
 *  실효각 |β| < 55°면 앞(단면 크게), < 100°면 옆(작게), 그 너머는 뒤(없음). 뒤로 뻗는
 *  다리는 몸통에 가려질 수 있으니 부르는 쪽이 그릴지 말지를 정한다. */
/** X축으로 눕힌 각기둥 — profile은 단면 (y,z)들(위→앞→아래). 앞띠·뒷띠·양 끝 단면을
 *  보이는 것만, 세계 광원 밝기로 그린다(요청: 돌려도 광원 고정). */
export function prismXFaces(profile: [number, number][], hw: number): ShapeFace[] {
  const out: ShapeFace[] = [];
  const bodyParts: string[] = [];
  const strip = (sign: 1 | -1): void => {
    const { visible, face } = faceLight(0, sign);
    if (!visible) return;
    for (let i = 0; i < profile.length - 1; i += 1) {
      const [y1, z1] = profile[i];
      const [y2, z2] = profile[i + 1];
      const d = polyPath3([[-hw, sign * y1, z1], [hw, sign * y1, z1], [hw, sign * y2, z2], [-hw, sign * y2, z2]]);
      bodyParts.push(d);
      if (i === 0) out.push(topFace(d));
      else out.push(...face(d));
    }
  };
  strip(1);
  strip(-1);
  for (const sign of [1, -1] as const) {
    const { visible, face } = faceLight(sign, 0);
    if (!visible) continue;
    const cap = polyPath3(profile.map(([y, z]) => [sign * hw, y, z] as [number, number, number]));
    bodyParts.push(cap);
    out.push(...face(cap));
  }
  return tagKey(
    [bodyFace(bodyParts.join(" ")), ...out],
    Math.min(
      Math.max(...profile.map(([y]) => y * depthNow(0, 1))) + hw * Math.abs(depthNow(1, 0)),
      Math.max(...profile.map(([, z]) => z)) - Math.min(...profile.map(([, z]) => z)),
    ),
  );
}

/** 넙적 피라미드 — 네 삼각 면을 보이는 것만, 세계 광원 밝기로. */
export function pyramidFaces3(
  cx: number, cy: number, w: number, d: number, h: number, z0 = 0,
): ShapeFace[] {
  const apex: [number, number, number] = [cx, cy, z0 + h];
  const b: [number, number, number][] = [
    [cx - w / 2, cy + d / 2, z0], [cx + w / 2, cy + d / 2, z0],
    [cx + w / 2, cy - d / 2, z0], [cx - w / 2, cy - d / 2, z0],
  ];
  // 피라미드 옆면의 위 성분 — 절두체와 같은 규칙(꼭짓점이 곧 위 극단).
  const nzW = (w / 2) / (Math.hypot(h, w / 2) || 1);
  const nzD = (d / 2) / (Math.hypot(h, d / 2) || 1);
  const sides: { d: string; n: [number, number]; nz: number }[] = [
    { d: polyPath3([apex, b[0], b[1]]), n: [0, 1], nz: nzD },
    { d: polyPath3([apex, b[1], b[2]]), n: [1, 0], nz: nzW },
    { d: polyPath3([apex, b[2], b[3]]), n: [0, -1], nz: nzD },
    { d: polyPath3([apex, b[3], b[0]]), n: [-1, 0], nz: nzW },
  ];
  const out: ShapeFace[] = [];
  const bodyParts: string[] = [];
  for (const f of sides) {
    const { visible, face } = faceLight(f.n[0], f.n[1], f.nz);
    if (!visible) continue;
    bodyParts.push(f.d);
    out.push(...face(f.d));
  }
  return tagKey(
    [bodyFace(bodyParts.join(" ")), ...out],
    depthNow(cx, cy)
      + Math.min(h, (w / 2) * Math.abs(depthNow(1, 0)) + (d / 2) * Math.abs(depthNow(0, 1))),
  );
}

export function limbFaces(
  angleDeg: number, len: number, w: number, r0 = 1.6, capOpen = true,
): ShapeFace[] {
  // 모형 공간 각도 그대로 — 요잉은 project가 입힌다(예전엔 여기서 한 번 더 더해 이중
  // 회전이었고, 뷰어에서 다리가 고정 오프셋으로 어긋났다).
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = Math.cos(a); // +면 시청자 쪽
  const rootX = dx * r0;
  const rootY = dy * r0;
  const tipX = dx * (r0 + len);
  const tipY = dy * (r0 + len);
  // 다리 진행과 직각인 반폭 벡터(지면 위).
  const nx = Math.cos(a) * (w / 2);
  const ny = -Math.sin(a) * (w / 2);
  const hRoot = w * 0.62; // 뿌리 쪽 등 높이
  const hTip = w * 0.5;
  const body = polyPath3([
    [rootX - nx, rootY - ny, hRoot],
    [tipX - nx, tipY - ny, hTip],
    [tipX + nx, tipY + ny, hTip],
    [rootX + nx, rootY + ny, hRoot],
    [rootX + nx, rootY + ny, 0],
    [tipX + nx, tipY + ny, 0],
    [tipX - nx, tipY - ny, 0],
    [rootX - nx, rootY - ny, 0],
  ]);
  const faces: ShapeFace[] = [bodyFace(body)];
  // 단면 보임도 지금 유효한 요잉으로(수리: 기본 시점 고정이라 좌우로 굽힐 때 비대칭).
  const beta = Math.abs(angleDeg + modelSpinDeg() + currentYaw());
  if (capOpen && beta < 100) {
    // 단면 반원 — 앞이면 꽉 차게, 옆이면 작게(capScaleOf와 같은 눈금).
    const scale = beta < 55 ? 1 : 0.6;
    const [c1x, c1y] = project(tipX - nx * scale, tipY - ny * scale, 0);
    const [c2x, c2y] = project(tipX + nx * scale, tipY + ny * scale, 0);
    const rr = (Math.hypot(c2x - c1x, c2y - c1y) / 2) * 1.05;
    faces.push(capFace(`M${c1x} ${c1y} A${r2(rr)} ${r2(rr * 0.95)} 0 0 1 ${c2x} ${c2y} Z`));
  }
  const dR = depthNow(rootX, rootY);
  const dT = depthNow(tipX, tipY);
  return tagKey(faces, (dR + dT) / 2 + Math.min(w, Math.abs(dR - dT) / 2));
}

/* ── 전면 3D화 프리미티브(요청: 모든 건물·수송선을 3D 도형으로) ──────────────────── */

/** 절두 각뿔(상자 포함) — 바닥 (wB×dB) → 윗면 (wT×dT). 네 세로 면을 보이는 것만,
 *  세계 광원 밝기로 그린다(요청: 돌려도 광원 고정). 윗면은 항상 밝다. */
export function frustumFaces3(
  cx: number, cy: number, wB: number, dB: number, wT: number, dT: number, h: number, z0 = 0,
  /** ★ 이 벽 하나는 **안 그린다**(2026-09) — 그 자리에 부르는 쪽이 **구멍 뚫린 벽**을 손으로 짜 넣을 때 쓴다.
   *  평면 법선으로 고른다: [1,0] 오른쪽 · [-1,0] 왼쪽 · [0,1] 앞 · [0,-1] 뒤.
   *  (여태 개구부는 벽을 통째로 두고 속을 그 위에 얹은 뒤 새는 몫을 덧댐판으로 덮었다 — 2D 화가 차례로만
   *   서는 손이라 GL 의 진짜 깊이에서는 속이 벽에 먹혔다. 구멍이 진짜면 두 붓이 같은 그림을 낸다.) */
  /** ★ 여러 낯도 준다(2026-09) — 가운데를 파낸 벽이 셋이면(팩토리 앞·뒤·왼쪽) 한 번에 빼야 한다. */
  omit?: readonly [number, number] | readonly (readonly [number, number])[],
  /** ★ **윗면을 안 그린다**(2026-09) — 바로 위에 같은 바닥의 덩이가 올라앉는 3단 몸통에서 그 낯은 **속살**이다.
   *  2D 는 위 덩이가 뒤에 칠해져 덮었지만, GL 은 옆벽에 뚫은 개구부로 그 속살이 들여다보였다(팩토리 격납구에서
   *  아래 절두체의 윗면이 속벽보다 카메라에 가까워 격납구를 통째로 메웠다). 덮이는 낯은 애초에 내지 않는다. */
  noTop?: boolean,
): ShapeFace[] {
  const zt = z0 + h;
  const corners = (w: number, d: number, z: number): [number, number, number][] => [
    [cx - w / 2, cy + d / 2, z], [cx + w / 2, cy + d / 2, z],
    [cx + w / 2, cy - d / 2, z], [cx - w / 2, cy - d / 2, z],
  ];
  const b = corners(wB, dB, z0);
  const t = corners(wT, dT, zt);
  const top = polyPath3(t);
  /* 기운 옆면의 위 성분(지적: 벙커·넥서스처럼 위가 좁은 절두체) — 밑이 넓을수록
     벽이 위로 눕고, 법선이 하늘을 향한 만큼 내려다보는 카메라에 잡힌다. */
  const nzOf = (eB: number, eT: number): number =>
    (eB - eT) / (Math.hypot(h, eB - eT) || 1);
  const sides: { d: string; n: [number, number]; nz: number }[] = [
    { d: polyPath3([t[0], t[1], b[1], b[0]]), n: [0, 1], nz: nzOf(dB / 2, dT / 2) },
    { d: polyPath3([t[1], t[2], b[2], b[1]]), n: [1, 0], nz: nzOf(wB / 2, wT / 2) },
    { d: polyPath3([t[2], t[3], b[3], b[2]]), n: [0, -1], nz: nzOf(dB / 2, dT / 2) },
    { d: polyPath3([t[3], t[0], b[0], b[3]]), n: [-1, 0], nz: nzOf(wB / 2, wT / 2) },
  ];
  const out: ShapeFace[] = [];
  const bodyParts: string[] = noTop ? [] : [top];
  /* ★ 벽은 **등진 것부터 앞으로** 정렬해 덮개를 얹는다(지적: 골리앗 어깨 너머 비침) —
     위가 좁은 절두체는 등진 벽도 법선의 위 성분으로 '보이는 벽'에 들어, 고정 차례면
     그 벽의 밝은 덮개가 가까운 벽 위에 찍혀 뒤가 비치는 듯 보였다. 가까운 벽의 덮개가
     마지막에 오면 그 자리는 가까운 벽의 명암만 남는다. */
  const ordered = sides
    .map((f) => ({ f, k: facingRatio(f.n[0], f.n[1]) }))
    .sort((a, b) => a.k - b.k)
    .map(({ f }) => f);
  for (const f of ordered) {
    if (omitHas9(omit, f.n[0], f.n[1])) continue;
    const { visible, face } = faceLight(f.n[0], f.n[1], f.nz);
    if (!visible) continue;
    bodyParts.push(f.d);
    out.push(...face(f.d));
  }
  return tagKey(
    [...(bodyParts.length ? [bodyFace(bodyParts.join(" "))] : []), ...out,
      ...(noTop ? [] : [topFace(top)])],
    depthNow(cx, cy) + Math.min(
      h,
      (Math.max(wB, wT) / 2) * Math.abs(depthNow(1, 0))
        + (Math.max(dB, dT) / 2) * Math.abs(depthNow(0, 1)),
    ),
  );
}

/** 반구 돔 — 회전 대칭이라 요잉 불변. 바닥 중심 (cx,cy,z0), 반지름 r, 높이 h. */
export function domeFaces3(
  cx: number, cy: number, r: number, hh: number, z0 = 0,
  /** 옆선을 **타원**으로 굽힌다(요청: "좀더 타원반구에 가깝게 지금 너무 네모남").
   *
   *  기본 옆선은 2차 베지에다: 조종점이 꼭대기 모서리(tx±r, ty)라, 곡선의 한가운데가
   *  (0.75r, 0.75h)를 지난다 — 0.75² + 0.75² = 1.125 > 1이니 타원 **밖으로** 부푼
   *  꼴이고, 그래서 옆이 곧게 서다 꼭대기에서 꺾이는 모난 실루엣이 나온다.
   *  round면 3차 베지에로 바꾼다: 조종점을 밑동 접선(세로)·꼭대기 접선(가로) 방향으로
   *  0.5523배씩 두면 한가운데가 (0.707r, 0.707h) — 타원 위의 그 점이다. */
  round = false,
): ShapeFace[] {
  const [bx, by] = project(cx, cy, z0);
  // 꼭대기 x도 제 투영으로(지적) — 원통과 같은 이유. 정수리만 기울고 발은 붙는다.
  const [tx, ty] = project(cx, cy, z0 + hh);
  const ry = r * groundSquashNow();
  /** 원을 베지에로 흉내 낼 때의 손잡이 길이 — 4분원에서 오차가 가장 작은 값이다. */
  const K = 0.5523;
  const dy = ty - by;   // 화면 세로 몫(위로 솟으면 음수, 아래로 부풀면 양수)
  const body = round
    ? `M${r2(bx - r)} ${r2(by)}`
      + `C${r2(bx - r)} ${r2(by + dy * K)} ${r2(tx - r * K)} ${r2(ty)} ${r2(tx)} ${r2(ty)}`
      + `C${r2(tx + r * K)} ${r2(ty)} ${r2(bx + r)} ${r2(by + dy * K)} ${r2(bx + r)} ${r2(by)}`
      + `a${r2(r)} ${r2(ry)} 0 1 1-${r2(r * 2)} 0Z`
    : `M${r2(bx - r)} ${r2(by)} Q${r2(tx - r)} ${r2(ty)} ${r2(tx)} ${r2(ty)}`
    + ` Q${r2(tx + r)} ${r2(ty)} ${r2(bx + r)} ${r2(by)}`
    + `a${r2(r)} ${r2(ry)} 0 1 1-${r2(r * 2)} 0Z`;
  const shine = groundEllipse((bx + tx) / 2 - r * 0.25, (by + ty) / 2 - (by - ty) * 0.22, r * 0.4, r * 0.18);
  const shade = `M${r2(tx + r * 0.35)} ${r2(ty + (by - ty) * 0.08)} Q${r2(tx + r)} ${r2(ty + (by - ty) * 0.25)} ${r2(bx + r)} ${r2(by)}`
    + ` Q${r2(bx + r * 0.55)} ${r2(by + ry * 0.6)} ${r2(bx + r * 0.35)} ${r2(by)}Z`;
  if (MESH9.on) {
    meshPut9(body, meshDome9(cx, cy, z0, r, hh));
    /* 광(shine)은 빌더가 **화면 자로** 얹은 타원이라, 그 중심이 PROJ9 에 없어 되찾기가 **높이를 빌린다** —
       가까운 기록점이 딴 부품이면 광이 그 위로 떠오른다(실측: −45도로 돌려 세운 트리뷰널의 광이 돔이 아니라
       기둥 꼭대기에 붙어 회색 타원으로 떴다). 그러니 여기서 3D 를 적는다: 돔 **표면에 붙는 작은 타원 조각**
       (빛이 드는 왼·뒤쪽 위). 2D 는 한 톨도 안 바뀐다(경로 문자열은 그대로다). */
    const shx9 = cx - r * 0.25; const shy9 = cy - r * 0.18;
    const shp9: number[] = []; const SHN9 = 12;
    for (let i9 = 0; i9 < SHN9; i9 += 1) {
      const a9 = (i9 / SHN9) * Math.PI * 2;
      const x9 = shx9 + Math.cos(a9) * r * 0.4; const y9 = shy9 + Math.sin(a9) * r * 0.3;
      const t9 = Math.min(1, Math.hypot((x9 - cx) / r, (y9 - cy) / r));
      shp9.push(...mp3(x9, y9, z0 + hh * Math.sqrt(Math.max(0, 1 - t9 * t9))));
    }
    meshPut9(shine, [shp9]);
    /* 아랫배 그늘도 **돔 겉면 위의 조각**으로 적는다(광과 같은 손) — 화면 자로만 두면
       되찾기가 경로를 거꾸로 읽어야 한다. 빛 반대쪽인 오른·앞 사분면의 띠다. */
    const shd9: number[] = []; const SN9 = 8;
    const on9 = (a9: number, k9: number): void => {
      const x9 = cx + Math.cos(a9) * r * k9; const y9 = cy + Math.sin(a9) * r * k9;
      shd9.push(...mp3(x9, y9, z0 + hh * Math.sqrt(Math.max(0, 1 - k9 * k9))));
    };
    for (let i9 = 0; i9 <= SN9; i9 += 1) on9((i9 / SN9) * (Math.PI / 2), 0.98);
    for (let i9 = SN9; i9 >= 0; i9 -= 1) on9((i9 / SN9) * (Math.PI / 2), 0.5);
    meshPut9(shade, [shd9]);
  }
  return tagKey(
    [bodyFace(body), sideFace(shade, OP.sideSoft), topFace(shine)],
    depthNow(cx, cy) + Math.min(hh, r),
  );
}
/** 돔 메시 — 바닥 원(r) 에서 꼭대기(z0+hh)까지 타원 옆선, 위도 6단·경도 12. hh 가 음수면 아래로 부푼다. */
export function meshDome9(cx: number, cy: number, z0: number, r: number, hh: number, lat = 6, lon = 12): Poly3[] {
  const rings: number[][][] = [];
  for (let k = 0; k <= lat; k += 1) {
    const ph = (k / lat) * (Math.PI / 2);
    const rr = k === lat ? r * 0.02 : r * Math.cos(ph);
    rings.push(meshRing9(cx, cy, z0 + hh * Math.sin(ph), 1, 0, 0, 0, 1, 0, rr, lon));
  }
  return meshLoft9(rings, true, true);
}
/** 구 메시 — 중심 (cx,cy,cz)·반지름 r. zk 로 세로만 눌러 타원구도 낸다. */
export function meshSphere9(cx: number, cy: number, cz: number, r: number, zk = 1, lat = 12, lon = 20): Poly3[] {   // 조각 8×12 → 12×20(둘레의 각이 보였다 — 구는 몇 장뿐이라 삯이 없다)
  const rings: number[][][] = [];
  for (let k = 0; k <= lat; k += 1) {
    const ph = -Math.PI / 2 + (k / lat) * Math.PI;
    const rr = (k === 0 || k === lat) ? r * 0.02 : r * Math.cos(ph);
    rings.push(meshRing9(cx, cy, cz + r * zk * Math.sin(ph), 1, 0, 0, 0, 1, 0, rr, lon));
  }
  return meshLoft9(rings, true, true);
}

/** 화면 원 — 납작비도, 시각 밀림도 먹이지 않는 진짜 동그라미.
 *  바닥 원(groundEllipse)과 다른 점이 요점이다: 땅에 누운 원반은 시점을 따라 눌리고
 *  기울어야 맞지만, **떠 있는 공은 그러면 안 된다**(지적: "구 형태가 찌그러져 보인다").
 *  구는 회전 대칭이라 어느 방향에서 봐도 투영이 원이다. */
/** 되찾은 원의 조각 수 — 16 이면 핵 충격파·워프인의 둘레가 다각형으로 읽혔다. */
export const RSEG9 = 32;
/** 카메라를 보는 원반의 기울기(부감 40도) — 화면에서 원으로 보이려면 y·z 를 이 비로 나눠 선다. */
const BILL9: [number, number] = [Math.sin((40 * Math.PI) / 180), Math.cos((40 * Math.PI) / 180)];
/** **빌보드 원반**으로 표시된 폴리 — 붓이 이것만 요잉을 안 돌리고 가운데만 돌린다(gl9 aBb 4비트). */
export const BILLBOARD9 = new WeakSet<Poly3>();
/** 3D 자리에 뜬 **공** — `screenCircle(project(…), r)` 과 **글자까지 같은 경로**를 내면서
 *  3D 로는 구 껍질을 적는다. 화면 자로만 찍으면 되찾기가 경로를 거꾸로 읽어야 한다. */
export function orbPath3(cx: number, cy: number, cz: number, r: number, ryS?: number): string {
  const [sx, sy] = project(cx, cy, cz);
  /* ⚠ `ryS` 는 빌더가 눈으로 살짝 눌러 둔 **화면 세로 반지름**이다 — 그래도 몸은 공이다.
     되찾기는 경로만 보므로 rx 와 ry 가 2% 넘게 다르면 공이 아니라 **납작한 원반**으로 읽었다
     (실측: 사이언스 베슬의 몸통 1.73×1.65 가 GL 에서 땅에 누운 판때기였다). */
  const d = ryS === undefined ? screenCircle(sx, sy, r) : groundEllipse(sx, sy, r, ryS);
  if (MESH9.on) meshPut9(d, meshSphere9(cx, cy, cz, r));
  return d;
}
/** 3D 자리에 선 **빌보드 원반**(늘 카메라를 본다) — 꼴이 없는 빛에 쓴다(빛무리·소환문·연기 테).
 *  공과 다르다: 공은 돌려 보면 둥근 덩이고, 이것은 어느 각에서도 **같은 원**이다. */
export function billPath3(cx: number, cy: number, cz: number, r: number): string {
  const [sx, sy] = project(cx, cy, cz);
  const d = screenCircle(sx, sy, r);
  if (MESH9.on) {
    const disc: number[] = [];
    for (let k = 0; k < RSEG9; k += 1) {
      const t = (k / RSEG9) * Math.PI * 2;
      disc.push(...mp3(cx + Math.cos(t) * r, cy - Math.sin(t) * r * BILL9[0], cz + Math.sin(t) * r * BILL9[1]));
    }
    BILLBOARD9.add(disc);
    meshPut9(d, [disc]);
  }
  return d;
}
export const screenCircle = (cx: number, cy: number, r: number): string =>
  siteMark9(`M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(r * 2)} 0`
    + `a${r2(r)} ${r2(r)} 0 1 0-${r2(r * 2)} 0Z`);

/** 화면 반구 — 구의 **위 절반**. 구(sphereFaces3)와 같은 자를 쓴다: 중심만 투영하고
 *  반지름은 화면 원이라 어느 요잉에서도 안 찌그러진다. 잘린 밑면은 카메라가 내려다보는
 *  만큼(납작비) 아래로 부푼 타원 호로 닫아, 판판한 뚜껑이 아니라 둥근 밑으로 읽힌다. */
/** 구 껍질 위의 점 — **화면 자로 그린 무늬**(초승달 명암·눈·아가리)를 그 공 위에 얹는다.
 *  (dx, dy) 는 구 중심의 사영점에서 잰 **화면 옮김**(dy 는 아래가 +)이고, 낸 점은
 *  **카메라 쪽 껍질** 위다. 화면 축을 모형 축으로 되돌리는 자는 카메라 한 쌍뿐이다:
 *  화면 위 = (0, −납작비, 높이배수) · 카메라 쪽 = (0, 높이배수, 납작비)(둘은 직교한다).
 *  ⚠ 원근 배수(f)는 안 태운다 — 무늬는 중심 둘레 한 뼘이라 그 안에서 f 는 상수다. */
export function sphereSurf9(
  cx: number, cy: number, cz: number, r: number, dx: number, dy: number,
): [number, number, number] {
  const sq = groundSquashNow(); const zk = zScaleNow();
  const n = Math.hypot(sq, zk) || 1;
  const uy = -sq / n; const uz = zk / n;      // 화면 위
  const ny = zk / n; const nz = sq / n;       // 카메라 쪽
  const u = r > 0 ? dx / r : 0; const v = r > 0 ? -dy / r : 0;
  const w = Math.sqrt(Math.max(0, 1 - Math.min(1, u * u + v * v)));
  return [cx + u * r, cy + (v * uy + w * ny) * r, cz + (v * uz + w * nz) * r];
}
/** 그 점들로 만든 껍질 조각 — `meshPut9` 에 그대로 넣는다. */
export function shellMesh9(
  cx: number, cy: number, cz: number, r: number, off: readonly (readonly [number, number])[],
): Poly3[] {
  const poly: number[] = [];
  for (const [dx, dy] of off) poly.push(...mp3(...sphereSurf9(cx, cy, cz, r, dx, dy)));
  return [poly];
}
/** 두 호 사이의 초승달(화면 자) → 껍질 조각. ryA·ryB 는 화면 세로 부푼 몫(부호가 방향이다). */
function crescentShell9(
  cx: number, cy: number, cz: number, r: number, ryA: number, ryB: number, n = 12,
): Poly3[] {
  const off: [number, number][] = [];
  for (let i = 0; i <= n; i += 1) { const t = (i / n) * Math.PI; off.push([-r * Math.cos(t), ryA * Math.sin(t)]); }
  for (let i = n; i >= 0; i -= 1) { const t = (i / n) * Math.PI; off.push([-r * Math.cos(t), ryB * Math.sin(t)]); }
  return shellMesh9(cx, cy, cz, r, off);
}
export function halfSphereFaces3(
  cx: number, cy: number, cz: number, r: number, fill?: string,
): ShapeFace[] {
  const [sx, sy] = project(cx, cy, cz);
  const ry = r * groundSquashNow();
  // 위 반원 → 아래로 부푼 타원 호로 닫는다.
  const d = `M${r2(sx - r)} ${r2(sy)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(sx + r)} ${r2(sy)}`
    + `A${r2(r)} ${r2(ry)} 0 0 1 ${r2(sx - r)} ${r2(sy)}Z`;
  const body: ShapeFace = fill ? [d, 1, fill] : bodyFace(d);
  /* 명암은 **호를 따라 도는 초승달**이다(지적: 동그란 점 둘이 눈처럼 보인다) — 원반
     두 장을 얹던 것을 걷는다. 밑동 호와 그보다 납작한 호 사이가 아랫배 그늘, 꼭대기
     호와 조금 낮은 호 사이가 정수리 빛이다. 둘 다 실루엣 안에 딱 맞아 어느 크기에서도
     밖으로 삐치지 않는다(원반은 작게 그릴수록 눈처럼 도드라졌다). */
  const shade = `M${r2(sx + r)} ${r2(sy)}A${r2(r)} ${r2(ry)} 0 0 1 ${r2(sx - r)} ${r2(sy)}`
    + `A${r2(r)} ${r2(ry * 0.42)} 0 0 0 ${r2(sx + r)} ${r2(sy)}Z`;
  const gloss = `M${r2(sx - r)} ${r2(sy)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(sx + r)} ${r2(sy)}`
    + `A${r2(r)} ${r2(r * 0.78)} 0 0 0 ${r2(sx - r)} ${r2(sy)}Z`;
  if (MESH9.on) {
    meshPut9(d, meshDome9(cx, cy, cz, r, r));
    /* 초승달 둘도 **껍질 위에** 적는다 — 화면 자로만 두면 되찾기가 경로를 거꾸로 읽어야 하고,
       그러면 rx ≠ ry 인 이 꼴은 공이 아니라 땅에 누운 조각으로 읽힌다. */
    meshPut9(shade, crescentShell9(cx, cy, cz, r, ry, ry * 0.42));
    meshPut9(gloss, crescentShell9(cx, cy, cz, r, -r, -r * 0.78));
  }
  return tagKey([body, sideFace(shade, OP.sideSoft), topFace(gloss, OP.topSoft)],
    depthNow(cx, cy) + r);
}

/** 화면 1/4구 — 반구를 다시 앞뒤로 갈라 **뒤 절반**만 남긴 껍데기. 위 반원과, 세로로
 *  자른 단면(위로 부푼 타원 호) 사이의 초승달이다. 얼굴가리개 뒤에 한 겹 세우면 그것이
 *  곧 뒤통수를 감싸는 껍데기다. */
export function quarterSphereFaces3(
  cx: number, cy: number, cz: number, r: number, fill?: string,
): ShapeFace[] {
  const [sx, sy] = project(cx, cy, cz);
  const ry = r * groundSquashNow();
  const d = `M${r2(sx - r)} ${r2(sy)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(sx + r)} ${r2(sy)}`
    + `A${r2(r)} ${r2(ry)} 0 0 0 ${r2(sx - r)} ${r2(sy)}Z`;
  const body: ShapeFace = fill ? [d, 1, fill] : bodyFace(d);
  if (MESH9.on) meshPut9(d, meshDome9(cx, cy, cz, r, r));
  return tagKey([body, topFace(d, OP.topSoft)], depthNow(cx, cy) + r);
}

/** 공(구) 한 덩이 — 중심만 투영하고 반지름은 화면 원이다. 몸 + 좌상 광택 + 우하 그늘.
 *  광택·그늘은 몸 안쪽에 물려 두어(중심 오프셋 + 반지름 < 1) 어떤 크기에서도 실루엣
 *  밖으로 삐치지 않는다. 세계 광원과 같은 방향(좌상)이라 다른 부품과 결이 맞는다. */
/** 구 표면에 얹힌 **작은 갓** — 화면 자로 그린 광점에 제 3D 를 적어 준다.
 *  ★ 안 적으면 되찾기가 **가장 가까운 기록점에서 높이를 빌린다**(2026-09, 요청: "우회로 없애고
 *  … 승격하는 과정 없앨 수 있어?") — 그 이웃이 딴 부품이면 광점이 엉뚱한 자리에 뜬다(돔의 광이
 *  기둥 꼭대기에 붙었던 그 자리). 갓은 방향 u 쪽 표면에 앉고 고리는 그 자리의 접평면 위에 눕는다. */
function shineRing9(
  d: string, cx: number, cy: number, cz: number, r: number,
  ux: number, uy: number, uz: number, rr: number,
): void {
  const l0 = Math.hypot(ux, uy, uz);
  // 민 몫이 0 이면(가운데에 그대로 얹는 광점) 위쪽 표면에 앉힌다.
  const l = l0 || 1;
  const nx = l0 ? ux / l : 0; const ny = l0 ? uy / l : 0; const nz = l0 ? uz / l : 1;
  // 접평면의 두 축 — n 과 안 나란한 아무 벡터에서 뽑는다.
  const t0: [number, number, number] = Math.abs(nz) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e1x = ny * t0[2] - nz * t0[1]; const e1y = nz * t0[0] - nx * t0[2]; const e1z = nx * t0[1] - ny * t0[0];
  const e1l = Math.hypot(e1x, e1y, e1z) || 1;
  const ax = e1x / e1l; const ay = e1y / e1l; const az = e1z / e1l;
  const bx = ny * az - nz * ay; const by = nz * ax - nx * az; const bz = nx * ay - ny * ax;
  meshPut9(d, [meshRing9(cx + nx * r * 0.92, cy + ny * r * 0.92, cz + nz * r * 0.92,
    ax, ay, az, bx, by, bz, rr, 12).flat()]);
}
export function sphereFaces3(
  cx: number, cy: number, cz: number, r: number, fill?: string,
  /** 광점·옆 그늘 두 장을 얹을지 — 발광 구(플릿비컨)는 끈다(2026-09 · 광택은 셰이더의 몫). */
  shine = true,
): ShapeFace[] {
  const [sx, sy] = project(cx, cy, cz);
  const body: ShapeFace = fill
    ? [screenCircle(sx, sy, r), 1, fill]
    : bodyFace(screenCircle(sx, sy, r));
  if (MESH9.on) meshPut9(body[0], meshSphere9(cx, cy, cz, r));
  if (!shine) return tagKey([body], depthNow(cx, cy) + r);
  /* 광점 둘도 **제 3D 를 적는다** — 화면에서 오른아래(그늘)·왼위(빛)로 밀린 자리가 곧 표면의
     그 방향이다(화면 위 = 모형에서 뒤·높은 쪽). 대개는 덧칠로 몸에 접히지만, 발광 종류에서는
     접지 않고 제 부품으로 남으므로 그때 이 기하가 쓰인다. */
  return tagKey([
    body,
    sideFace(shinePath3(cx, cy, cz, r, r * 0.28, r * 0.24, r * 0.68), OP.sideSoft),
    topFace(shinePath3(cx, cy, cz, r, -r * 0.34, -r * 0.34, r * 0.3)),
  ], depthNow(cx, cy) + r);
}
/** ★ **몸 위의 광점 한 장** — 투영된 가운데에서 화면으로 (ox, oy) 만큼 민 자리에 원(또는 눌린
 *  타원)을 그리고, **3D 는 그 몸 표면의 갓으로 적는다**(2026-09, 요청: "우회로 없애고 … 승격하는
 *  과정 없앨 수 있어?").
 *  ⚠ 화면 자로만 찍으면 3D 기록이 없어 되찾기가 **이웃에서 높이를 빌린다** — 그 이웃이 딴 부품이면
 *  광점이 허공에 뜬다(돔의 광이 기둥 꼭대기에 붙었던 그 자리). 빌더가 손으로 `screenCircle(sx + dx,
 *  sy + dy, …)` 를 쓰던 자리를 이 헬퍼 하나로 닫는다.
 *  방향 셈: 화면 오른쪽 = 모형 +x · 화면 아래 = 모형 앞(+y)이자 낮은 쪽(−z). 광점은 음영이라
 *  방향이 조금 어긋나도 눈에 안 띈다 — 중요한 것은 **이웃에서 안 빌리는 것**이다. */
export function shinePath3(
  cx: number, cy: number, cz: number, r: number,
  ox: number, oy: number, rr: number, ry?: number,
): string {
  const [sx, sy] = project(cx, cy, cz);
  const d = ry === undefined
    ? screenCircle(sx + ox, sy + oy, rr)
    : groundEllipse(sx + ox, sy + oy, rr, ry);
  if (MESH9.on) shineRing9(d, cx, cy, cz, r, ox, oy, -oy, rr);
  return d;
}

/** 눕힌 원통(관) — 평면 두 점 사이를 반지름 r로 잇는다. 몸통 + (보이는 쪽) 끝 단면.
 *  단면 보임은 진행 방향이 시청자 쪽(+y)일 때 크고, 뒤로 가면 없다(캡 규칙). */
/** ★ tubeFaces가 관을 화면에서 **위로 미는 몫**을 모델 z로 환산한 값 ────────────────
 *  관은 축 좌표를 그대로 안 쓴다 — 아래 dzc가 '투영선이 관의 배'가 되도록 화면 y를
 *  `r*0.45`만큼 올려 그린다(옛 배치와 눈높이를 맞추는 오프셋이다). 관끼리만 짜면 다 같이
 *  올라가니 아무 일도 안 나지만, **관과 뿔·상자를 한 축에 세우면** 관만 떠 보인다
 *  (지적: "미사일 실린더의 몸통과 앞코/꼬리가 위치가 안 맞음. 몸통만 더 높은 듯" — 뿔로
 *  지은 코·꼬리에는 이 몫이 없다).
 *  부르는 쪽이 관의 z에서 이만큼 빼면 관의 축이 제 값에 앉는다. 화면 몫을 z로 되돌리는
 *  것이라 지금 시점의 높이 배율(zScaleNow)을 탄다 — 평면·사선·입체 어디서나 맞는다. */
export const tubeAxisLift = (r: number): number => ((r * 0.9) / 2) / zScaleNow();
export function tubeFaces(
  x1: number, y1: number, x2: number, y2: number, r: number, z = 0, capOpen = false,
): ShapeFace[] {
  /* 원기둥 투영 그대로(재재수리·지적: 원통 끝면 처리) — 스타디움·벽 짜깁기를 걷고,
     원기둥의 실제 투영으로 그린다: 축 양끝의 단면 타원 두 장 + 그 사이 접선 사각.
     단면 타원은 축과 수직 지름이 2r, 축 방향 두께는 축이 화면을 마주보는 만큼
     (facing) 도톰해진다. 어느 요잉에서도 끝이 물리거나 뚫리지 않는다. */
  const zr = r * 0.9;
  const dzc = -zr / 2; // 예전 배치(투영선이 관의 배)와 눈높이를 맞추는 오프셋.
  const [ax0, ay0] = project(x1, y1, z);
  const [bx0, by0] = project(x2, y2, z);
  const ax = ax0;
  const ay = ay0 + dzc;
  const bx = bx0;
  const by = by0 + dzc;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const ml = Math.hypot(x2 - x1, y2 - y1) || 1;
  const fB = facingRatio((x2 - x1) / ml, (y2 - y1) / ml);
  const f = Math.abs(fB);
  // 축 방향 반두께 — 옆을 볼 땐 납작(내려다봄 몫만), 마주볼수록 원에 가깝다.
  const re = r * Math.max(0.22, f);
  const ang = r2((Math.atan2(dy, dx) * 180) / Math.PI);
  const endDisc = (ex: number, ey: number, k = 1): string => {
    const nx2 = len < 0.05 ? 0 : (-dy / len) * r * k;
    const ny2 = len < 0.05 ? r * k : (dx / len) * r * k;
    return `M${r2(ex + nx2)} ${r2(ey + ny2)} A${r2(re * k)} ${r2(r * k)} ${ang} 1 1 ${r2(ex - nx2)} ${r2(ey - ny2)}`
      + ` A${r2(re * k)} ${r2(r * k)} ${ang} 1 1 ${r2(ex + nx2)} ${r2(ey + ny2)} Z`;
  };
  const faces: ShapeFace[] = [bodyFace(endDisc(ax, ay)), bodyFace(endDisc(bx, by))];
  if (MESH9.on) {
    const ml9 = Math.hypot(x2 - x1, y2 - y1) || 1; const ux = -(y2 - y1) / ml9; const uy = (x2 - x1) / ml9;
    meshPut9(faces[0][0], meshLoft9([meshRing9(x1, y1, z, ux, uy, 0, 0, 0, 1, r, 8), meshRing9(x2, y2, z, ux, uy, 0, 0, 0, 1, r, 8)]));
  }
  if (len >= 0.05) {
    const nx = (-dy / len) * r;
    const ny = (dx / len) * r;
    faces.push(bodyFace(`M${r2(ax + nx)} ${r2(ay + ny)} L${r2(bx + nx)} ${r2(by + ny)}`
      + ` L${r2(bx - nx)} ${r2(by - ny)} L${r2(ax - nx)} ${r2(ay - ny)} Z`));
    // 배 쪽 음영 띠 — 화면 아래쪽 긴 변.
    const ws: 1 | -1 = ny >= 0 ? 1 : -1;
    faces.push(sideFace(
      `M${r2(ax + nx * ws * 0.55)} ${r2(ay + ny * ws * 0.55)} L${r2(bx + nx * ws * 0.55)} ${r2(by + ny * ws * 0.55)}`
      + ` L${r2(bx + nx * ws)} ${r2(by + ny * ws)} L${r2(ax + nx * ws)} ${r2(ay + ny * ws)} Z`,
      OP.sideSoft,
    ));
  }
  /* 시청자를 향한 끝의 단면 — capOpen이면 어두운 포구, 아니면 옅은 끝판 씸(막힌
     원기둥의 끝면이 읽히게). 마주볼수록 또렷해진다. */
  if (f > 0.08) {
    const k = Math.min(1, (f - 0.08) / 0.4);
    const [ex, ey] = fB > 0 ? [bx, by] : [ax, ay];
    faces.push(capFace(endDisc(ex, ey, capOpen ? 0.78 : 0.92), (capOpen ? 0.42 : 0.14) * k));
  }
  // 메시는 첫 면(끝 원반)에 실었다 — 나머지 면(다른 끝·옆 사각·단면)은 같은 관이라 빈 메시로 표시해 둔다.
  if (MESH9.on) for (let i = 1; i < faces.length; i += 1) meshPut9(faces[i][0], []);
  const dA = depthNow(x1, y1);
  const dB2 = depthNow(x2, y2);
  return tagKey(faces, (dA + dB2) / 2 + Math.min(r * 2, Math.abs(dA - dB2) / 2));
}

/** 뿔·가시 — 평면 밑점(bx,by,z0)에서 평면 끝점(tx,ty,zt)으로 솟는 가는 원뿔. */
export function hornFaces(
  bx: number, by: number, z0: number, tx: number, ty: number, zt: number, w: number,
): ShapeFace[] {
  const [ax, ay] = project(bx, by, z0);
  const [cx2, cy2] = project(tx, ty, zt);
  const dx = cx2 - ax;
  const dy = cy2 - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  const body = `M${r2(ax + nx)} ${r2(ay + ny)} Q${r2((ax + cx2) / 2 + nx)} ${r2((ay + cy2) / 2 + ny)} ${r2(cx2)} ${r2(cy2)}`
    + ` Q${r2((ax + cx2) / 2 - nx)} ${r2((ay + cy2) / 2 - ny)} ${r2(ax - nx)} ${r2(ay - ny)} Z`;
  const shade = `M${r2(cx2)} ${r2(cy2)} Q${r2((ax + cx2) / 2 - nx)} ${r2((ay + cy2) / 2 - ny)} ${r2(ax - nx)} ${r2(ay - ny)}`
    + ` L${r2(ax - nx * 0.2)} ${r2(ay - ny * 0.2)} Z`;
  const dRt = depthNow(bx, by);
  const dTp = depthNow(tx, ty);
  if (MESH9.on) {
    // 축과 직각인 두 축 — 축이 세로면 x·y, 아니면 (축×z)·(축×그것)
    const dx3 = tx - bx; const dy3 = ty - by; const dz3 = zt - z0; const L = Math.hypot(dx3, dy3, dz3) || 1;
    const ax9 = dx3 / L; const ay9 = dy3 / L; const az9 = dz3 / L;
    let ux9 = -ay9; let uy9 = ax9; let uz9 = 0; const ul = Math.hypot(ux9, uy9);
    if (ul < 1e-3) { ux9 = 1; uy9 = 0; uz9 = 0; } else { ux9 /= ul; uy9 /= ul; }
    const vx9 = ay9 * uz9 - az9 * uy9; const vy9 = az9 * ux9 - ax9 * uz9; const vz9 = ax9 * uy9 - ay9 * ux9;
    meshPut9(body, meshLoft9([meshRing9(bx, by, z0, ux9, uy9, uz9, vx9, vy9, vz9, w / 2, 6), meshRing9(tx, ty, zt, ux9, uy9, uz9, vx9, vy9, vz9, w * 0.02, 6)], true, false));
    /* 옆 그늘도 **뿔 겉면 위의 가는 조각**으로 적는다 — 화면 자로만 두면 되찾기가 경로를
       거꾸로 읽어야 하고, 꼭짓점이 셋뿐이라 엉뚱한 판으로 살아난다. 2D 가 화면 법선
       (nx, ny)으로 잰 폭은 3D 에서 축에 직각인 u 축의 w/2 다. */
    const hw9 = w / 2;
    const sd9: number[] = [
      ...mp3(tx, ty, zt),
      ...mp3((bx + tx) / 2 - ux9 * hw9 * 0.5, (by + ty) / 2 - uy9 * hw9 * 0.5, (z0 + zt) / 2 - uz9 * hw9 * 0.5),
      ...mp3(bx - ux9 * hw9, by - uy9 * hw9, z0 - uz9 * hw9),
      ...mp3(bx - ux9 * hw9 * 0.2, by - uy9 * hw9 * 0.2, z0 - uz9 * hw9 * 0.2),
    ];
    meshPut9(shade, [sd9]);
  }
  return tagKey(
    [bodyFace(body), sideFace(shade, OP.sideSoft)],
    (dRt + dTp) / 2 + Math.min(Math.abs(zt - z0) + w, Math.abs(dRt - dTp) / 2),
  );
}
