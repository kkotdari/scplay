import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  PERF9, NOSHADOW9, DPRCAP9, NODOM9, HIDECLS9, GAP9, perfHit, pNow, pAdd, pWrap,
  pFrame, perfState9, perfLine9,
} from "./perf9";
import { createPortal } from "react-dom";
import { useBgm } from "./useBgm";
import RosterTableIcon from "./RosterTableIcon";
import { BookOpen, Bookmark, Crosshair, Eye, EyeOff, Map as MapIcon, Maximize, Minimize, Music, Palette, Pause, Play, RotateCcw, Share2, Users } from "lucide-react";
import ReplayGuide from "./ReplayGuide";
/* 미니맵 — 이제 **제 오버레이 판**이고 제 아이콘으로 여닫는다(요청: "미니맵 오버레이
   및 아이콘 추가"). 도구 판 안에 세들어 살던 시절과 달리, 켜고 끄는 것이 이것 하나다. */
import ReplayFullscreenMinimap, { type MiniDot } from "./ReplayFullscreenMinimap";
import ReplayFogLayer, { fogPad9, type FogOverride } from "./ReplayFogLayer";
/* (걷어냄) PillTabs — 품질 알약이 있던 시절의 것(도구 판과 함께 미사용). */
import { cx } from "./cx";
/* 프사·종족 배지·알림은 **앱이 꽂는다**(chrome.ts 머리말) — 모듈은 그 구현을 안 갖는다. */
import { replayAvatarOn, replayChrome, replayToast } from "./chrome";
import { BUILDING_KO, TECH_KO, UNIT_KO } from "../../utils/replayNames";
import { TIER_GEN9 } from "./tierTable.gen";
import {
  ARMOR_WEAPON_PAIRS, UNIT_UPGRADE_TAG, UPGRADE_ONE_LETTER,
  UPGRADE_UNITS, researchKo,
} from "../../utils/replayTechNames";
import type { ReplayMapGrid } from "./mapGrid";
import { revalidateReplayMap } from "./useReplayMap";
import ReplayMapVector, { MAPVEC_LOST9, MAPVEC_M9 } from "./ReplayMapVector";
import { AIR_UNITS } from "../../utils/statsMix";
import { BLD_STATS, UNIT_BUILD_SEC, UNIT_STATS } from "./unitStats";
/* 사거리는 이 파일이 들고 있던 상수(ENGAGE_SIGHT_TILES 9, 방어 건물 7/7/7/8/6, 벙커 안
   화염 3.5)가 아니라 표에서 온다(과제 #48) — 마린도 시즈 탱크도 한 값 9로 쏘고 9에서
   멈추던 자리다. 표를 읽는 문은 **bwCombat 하나**로 정한다: bwUnits에도 같은 이름의
   reachTiles가 있지만 그쪽은 업그레이드·벙커 보너스를 못 받는 짧은 판이라, 두 문을 같이
   열면 같은 이름이 두 뜻을 갖는다.
   fireRangeTilesOf는 '몸 반지름을 뺀 순수 사거리'다. 이 파일의 거리 판정은 전부 중심-중심
   이라 실제보다 두 몸 반지름만큼 짧게 잡히는 어림인데, 그리기용 게이트라 그대로 둔다 —
   반지름까지 더하는 정확한 셈은 코어(bwCombat.reachTiles)의 몫이다. */
import {
  acquireTilesOf, bodyRadiusOf, fireRangeTilesOf, isKnownKind, profileOf, reachTiles,
  weaponVs,
} from "../../utils/bwCombat";
/* 러커 가시가 나아가는 거리·속도는 무기표가 아니라 iscript 행동(behaviour 9 "go to max
   range")에서 온 값이라 bwCombat이 안 물고 있다. 숫자를 여기 또 적는 대신 표에서 읽는다. */
import {
  BUILDING_FOOT, FRAME_SEC, GEYSER_FOOT, LURKER_SPINE_SPEED_PX,
  LURKER_SPINE_TRAVEL_PX, MEDIC_HEAL_RANGE_PX, MINERAL_FOOT, PLASMA_SHIELD_UPGRADE,
  buildingBox, SUPPLY_CAP, SUPPLY_COST, SUPPLY_GIVES, sightTiles,
} from "../../utils/bwUnits";
// (정리) DEFENSE_BUILDINGS — 건물 캔버스 전환으로 ▲ 글자 갈래가 없어져 더는 안 쓴다.
import { type TerrainGrid } from "./terrainGrid";
import { decodeMapTerrain, terrainGridOfMap } from "../../utils/mapTerrain";
/* 자취는 이제 서버가 굽는다 — 브라우저는 풀어서 읽기만 한다(tools/openbw/README.md).
   여태 이 자리에서 돌던 시뮬(legacy/simCore·simClient)은 명령에서 **유추**하던 것이라,
   참값이 생긴 뒤로는 견줄 것도 없어 통째로 걷었다. legacy는 유물로 남긴다. */
/* 잠깐 알리고 사라지는 자리(요청) — 갈라진 판 경고가 이 문을 쓴다. */
import { truthWorld, type TruthLife, type TruthWorld } from "../../utils/truthLives";
import { unpack9 } from "./framePack";
import { estBytes9, mb9 } from "./memEst9";
import {
  decodeTruthTracks, peekTruthHead, posAtTruth as posAtSim, type TruthTrack, type TruthTracks,
  TRUTH_ST_CARRY_GAS as ST_CARRY_GAS, TRUTH_ST_CARRY_MIN as ST_CARRY_MIN,
  TRUTH_ST_BURROW as ST_BURROW,
  TRUTH_ST_FIGHT as ST_FIGHT,
  TRUTH_ST_GATHER as ST_GATHER,
  TRUTH_ST_INSIDE as ST_INSIDE,
  TRUTH_ST_MOVE as ST_MOVE, kT, tkN, tkT, tkV, tkAt, tkLast, EMPTY_TICKS, type Ticks } from "../../utils/openbwTracks";
/* 자취 읽기는 유틸로 나갔다(과제 #61) — 코어가 걸음의 진실이 된 뒤로 이 파일의
   몫이 아니고, 밖에 있어야 자로 잴 수 있다(scripts/pos-check.mjs). */
import { posAt, posAtW, wT, wX, wY, EMPTY_WALK, type WalkView, type TrackPos, type TrackPt } from "../../utils/replayTrack";
/* 무대에서 지도가 안 덮는 자리(2D의 그림 여유 띠 · 3D의 빈 귀퉁이)를 채우는 밤하늘 —
   경기마다 다른 한 장을 SVG로 지어 data URI로 돌려준다(그 파일 머리말). */
import { spaceBackdropUrl } from "./spaceBackdrop";
/* (걷어냄) 승하차 딜레이 표(bwTransport의 PICKUP_POLL_SEC·UNLOAD_GAP_SEC) — 몸이
   작아지며 도는 연출의 길이를 원작 딜레이에 딱 맞추던 값이다. 그 연출을 걷고 승하차를
   점선 하나로만 말하게 되면서(요청: "점선으로만 표시") 쓸 자리가 없어졌다. 점선의 창은
   시뮬레이션이 아니라 **읽히는 데 걸리는 시간**이라 제 값을 따로 쓴다(RIDE_TETHER_SEC).
   표 자체는 utils에 그대로 둔다 — 원작 값의 기록이다. */
import {
  annulusPath, bandPath, bodyFace, capFace, curvePath3, depthNow, fine, groundEllipse,
  LOD_FINE, LOD_TRIM, lodFilter, shape, sideFace, tagKey, topFace, trim, bake, boxSkip,
  type ShapeFace,
  boxFaces3, cylinderFaces3, discPath3, halfSphereFaces3, plateFaces3, polyPath3, project,
  domeFaces3, faceLight, facingRatio, frustumFaces3, groundSquashNow, hornFaces, lightRatio,
  prismYFaces, prismZFaces, pyramidFaces3,
  screenCircle, setPitchSquash, sphereFaces3, tubeAxisLift, tubeFaces, VIEW_LEAN_K,
  wallDiscPath, withModelSpin, withModelShift, withModelZOff, withModelScale, withPitchView, withTopView, withViewShear, withYaw, zsorted,
} from "../../utils/shapeOblique";
import { TEAM_COLOR, type MinimapMarker } from "./markers";
import {
  AIR_LIFT_K, AIR_LIFT_REF, NORM_PAIR, BLD_NORM_PAIR, BLD_DRAW_K, BLD_DRAW_TUNE, BLD_INK_BOX, BUILDING_BASE_YAW, BUILD_STAGES, BW_ROWS, CAST_HOLD_SEC, CLASS_TILES, EMPTY_FRAME9, FOOTPRINT, FX_BEAM, FX_IMPACT, HIT_FX_K, NUKE_BOOM_SEC, NUKE_FALL_SEC, POSE_ATK_L, POSE_ATK_R, POSE_KINDS, PRODUCED_BY, PROD_FLASH_SEC, RESEARCH_BUILDING, RESEARCH_SEC, SCAN_DETECT_SEC, SCR_DIAG, SHAPE_KIND, SPIN_STEPS, STATUS_CASTS, STATUS_KO, UNIT_3D, UNIT_BODY_TILES, UNIT_BULK, bldAnchorKey, bldNormOf, bwBoxTiles, emptyWorldUi9, footDx, footDy, gmOf, isAirUnit, modelInkOf, modelNormOf, scrDiagOn, speedOf, unitTilesOf,
} from "./engine9";
import type { EngineView9, EngineWorld9, Frame9, FxOp, PitchGeom9, UnitDrawOp, WorldUi9 } from "./engine9";
import {
  pitchFlatSet9, BAKE_ENV9, BAKE_POOL, DECAL_KINDS, LOD_INK_DECO, LOD_INK_POINT, NO_CREEP9, OCT_XZ, PITCH_3D, PITCH_DEGS, SCAN_MS9, SHAPE_BUILDERS, SHAPE_ROT, SPRITE_SIDE_MAX, STORM_STAGES, bldLitNow, bldSpinNow, canvasBytes, flatOf, geyserDry, glossFaces, headAimNow, headTag, headYawNow, litTag, lodCap, lodOf, lodPenalty, lodZoom, mineralLv, mineralVar, paintBase, pathBox, pathOf, pitchFlatNow, pitchTag, poseNow, poseTag, quarterDome, rasterBld9, rasterUnit9, releaseCanvas, resolveShapeFaces, rodFaces, scvCarry, shadeBoost, spikeHorn, spinTag, spirePillar, sunkenFire, sunkenTongue, sunkenTongueFaces, tierTableOf, headYawSet, bldLitSet, bldSpinRawSet9, bldSpinSet, poseSet, poseSet9, lodSetCap, lodSetZoom, lodNoteFrame, SHAPE_GALLERY,
} from "./bake9";
export { LIMB_LOG, TURRET_BACK9, SHAPE_BUILDERS, ctx2d9, BAKE_ENV9, cropToInk, rasterUnit9, pathBox, tierTableOf, autoTier, stageFaces, rasterBld9, SHAPE_GALLERY, poseSet, poseSet9, bldLitSet, headYawSet, bldSpinSet, bldSpinRawSet9, lodSetCap, lodSetZoom, lodNoteFrame } from "./bake9";
export type { BakeCv9, BakeCtx9, RasterOut9, ShapeGalleryItem } from "./bake9";
export { isAirUnit, flapCutOf, atkCutOf, unitTilesOf, buildingYawOf, BLD_NORM, BUILD_STAGES, SCR_DIAG, scrDiagOn, deriveWorld9, createEngine9, pickWorldUi9, emptyWorldUi9 } from "./engine9";
export type { BuildRow, CastRow, FxOp, Frame9, EngineWorld9, EngineView9, WorldUi9 } from "./engine9";

/** 본진 로스터 한 사람 — 위치(x·y)는 이제 요약이 사라져 실려 오지 않을 수 있다.
 *  좌표가 없으면 지형 앵커·채굴 임자 어림 같은 위치 계산에서 조용히 빠진다. */
export type MotionBase = Omit<MinimapMarker, "x" | "y"> & { x?: number; y?: number };

/* ── 연속 재생 플레이어(요청: 장면 선정 없이 전부 연속으로, 이미지 대신 텍스트로) ──────
   스냅 미니맵(ReplayMinimap)이 '고른 장면'을 화살표·이모지로 그렸다면, 여기는 시간이 그냥
   흐른다: 시각 t가 배속으로 달리고, 매 순간
     · t까지 지어진 건물이 텍스트로 박히고(자리·시각은 건설 커맨드 그대로 — 정확하다)
     · 부대 자취(명령 좌표 다운샘플)를 따라 우세 유닛 이름표가 미끄러지고
     · t에 떨어진 마법이 텍스트로 잠깐 번쩍인다.
   beat(자막·장면)는 여기서 안 쓴다(요청: 남겨두되 사용은 안 하게) — 그건 칭호·BEST의
   원장으로만 남는다. 유닛 위치는 명령 기반 추정이다: 리플레이에는 위치·죽음이 안 남아서,
   이 자취는 "그 사람 부대가 어디서 무엇을 하고 있었나"의 어림이다. */

/** 배속 갈래(요청: 1·2·3·5·10·20) — 뜯어보는 ×1부터 훑어 넘기는 ×20까지. */
// ×3을 걷고 기본은 ×2(요청: 배속 정리 — x1 x2 x5 x10 x20, 기본 2).
const SPEEDS = [1, 2, 5, 10, 20] as const;
/** 탄두가 내려오는 창(초) — 착탄 시각은 위 값 그대로 두고 **시작만 당긴다**(요청: 2배
 *  느리게). 그래야 터지는 순간이 안 밀린다. */
const NUKE_DROP_SEC = 4;
/** 탄두가 내려오는 높이(렌즈 px) — 창이 두 배로 길어졌으니 같은 높이면 절반 속도다. */
const NUKE_FALL_PX = 140;
/** 탄두 스팬의 한 변(px) — 코를 조준점에 맞추는 셈이 이 값의 0.275배를 쓴다.
 *  ★ CSS(.scr-motion-nuke-fall)의 width·height와 **같은 값**이어야 한다.
 *  18 → **9**(요청: "탄두 크기 반으로 줄이기") — 폭발 상자가 6 → 10타일로 커지며
 *  탄두가 상대적으로 커 보였다. 폭발과 탄두는 별개 값이라 각각 정한다(그 사정은
 *  아래 폭발 width 주석에 있다). */
const NUKE_HEAD_PX = 22.5;
/** ★ 이 기기에 입체를 내주나 — **손가락 기기에는 안 준다**(지시: "모바일에서 3D 전환하려고
 *  하면 토스트 띄워서 3D보기는 PC에서만 가능해요 라고 띄우자 / 공유주소로 들어온 경우
 *  모바일에서는 3D를 무시하고") ────────────────────────────────────────────────────
 *  왜 막는가 — 입체는 원근이 낀 가지라 합성기가 축소를 못 접고 **레이아웃 크기로 서피스를
 *  다시 래스터한다**. 그 서피스는 캔버스 예산 밖의 몫이고, 끌 때마다 다시 잡힌다. 눕히는
 *  배수를 면적으로 죄어(ReplayMapVector의 surfCap9) 전환 순간은 넘겼지만 **끄는 동안**
 *  터지는 것이 남았다(지적). 폰의 한 탭이 쓸 수 있는 몫 안에서 이 그림을 안전하게 그릴
 *  길을 우리는 아직 모른다 — 모르는 것을 아는 척하고 내주느니 문을 닫는다.
 *  자는 **손가락**이다(pointer: coarse): 폰·태블릿이 걸리고, 터치 노트북은 주 포인터가
 *  마우스라 안 걸린다. 창이 없는 자리(노드·서버 렌더)는 참이다 — 막을 화면이 없다. */
/** 손가락 기기의 3D 문턱(요청: "모바일 3D 오픈, 대신 벤치마킹 빡세게") — 입체 벤치(benchDevice9 deep)를 세 번 재어
 *  **중앙값**으로(PC 판정은 두 번 중 최소) PC 기준(CROWD_BENCH3D_MS9 = 16)보다 좁은 12ms 안이어야 연다. 한 번 재면 굳는다. */
const MOBILE_3D_BENCH_MS9 = 12;
const mobile3d9 = { ok: null as boolean | null, ms: -1 };
const pitchAllowed = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  if (!window.matchMedia("(pointer: coarse)").matches) return true;
  if (mobile3d9.ok === null) {
    const a9 = [benchDevice9(true), benchDevice9(true), benchDevice9(true)].sort((x9, y9) => x9 - y9);
    mobile3d9.ms = a9[1];
    mobile3d9.ok = a9[1] > 0 && a9[1] <= MOBILE_3D_BENCH_MS9;
  }
  return mobile3d9.ok;
};
/** 입체를 못 내줄 때 한 번 알린다 — 화면에 아무 반응이 없으면 '버튼이 고장'으로 읽힌다. */
const pitchDenied = (): void => {
  replayToast(mobile3d9.ms >= 0
    ? `3D 보기가 이 기기엔 무거워요 (벤치 ${mobile3d9.ms.toFixed(0)}ms · 기준 ${MOBILE_3D_BENCH_MS9}ms)`
    : "3D 보기는 PC에서만 가능해요", { kind: "info" });
};
/** 원근 거리 = 상자 세로 × 이 값. 클수록 원근이 약하고 바닥이 상자를 더 채운다.
 *
 *  1.6 → 4(지적: "3D모드에서 좌우의 땅이 내려가게 기울어진 느낌의 착시") — 진단은
 *  기울기가 아니라 **수렴**이다. 이 사영에서 같은 y의 두 점은 화면에서도 정확히 같은
 *  높이에 놓이므로(posFrac의 fy가 x를 안 탄다) 땅이 실제로 기운 곳은 한 군데도 없다.
 *  다만 1.6에서는 가까운 변이 먼 변보다 **1.60배** 넓어서, 사다리꼴의 좌우 변이 가파르게
 *  안쪽으로 눕는다. 수평선도 하늘도 없는 화면에서 그 사다리꼴은 '가운데가 솟고 양옆이
 *  흘러내리는 언덕'으로 읽힌다 — 착시의 정체가 그 수렴이다.
 *  확대하면 더 심해지는 것도 같은 뿌리다(지적) — 렌즈는 이미 사영된 그림을 화면에서
 *  키우는 것이라(translate(pan) scale(zoom)) 사다리꼴의 기울기는 그대로인데, 확대해
 *  옆으로 밀면 그 **가파른 좌우 변 하나가 화면을 가득 채운다**. 전체를 볼 때는 사각형의
 *  네 변이 서로를 설명해 주지만, 변 하나만 남으면 설명이 사라져 '땅이 흘러내린다'로만
 *  읽힌다. 그래서 값을 조금 낮추는 것으로는 부족하고 수렴 자체를 없애야 한다.
 *
 *  그때 12로 잡았다 — 수렴 1.07배, 좌우 변의 기울기가 세로에서 17.4도 → 2.6도로
 *  내려간다(4에서는 7.0도라 확대하면 여전히 읽혔다).
 *  ★ 원작(스타크래프트)의 화면이 애초에 **평행 투영**이라 수렴이 1.00이다 — 값이
 *    클수록 원작에 가깝고, 깊이감은 눕힘·건물 높이·그림자·그리는 차례가 그대로 낸다. */
/* ★ 이제 이 값은 상수가 아니라 **각도의 함수**다(지적: "각도에 따른 원근감이 너무 적어").
   12로 못 박아 두었더니 어느 각에서도 수렴이 4~7%뿐이었고, 각을 내려도 그 수렴이 거의
   안 자랐다 — 카메라가 늘 같은 거리에 있었기 때문이다. 실제로는 시점각이 낮아질수록
   화면에 들어오는 깊이가 길어져 원근이 세진다.
   깊이 성분 s = cos(시점각)(= 90도에서 0, 30도에서 0.866)이 곧 그 세기이므로, 거리를
   s에 반비례하게 당긴다. 가까운 변 / 먼 변의 비 r = (D + s/2) / (D − s/2)로 잰다.
   ★ 한 번 더 세게(재요청: "각도 낮출때 원근감 더 강하게") — 6.3/3.6에서는 다 내려도
     1.32라, 각을 낮춘 값이 화면에서 잘 안 읽혔다. 4.8/2.8로 당긴다:
       각    6.3·3.6 → 4.8·2.8 → 3.41·1.77 → 지금(2.95·2.05)
       60도    1.118  →  1.159  →  1.220  →  1.299
       48도    1.188  →  1.258  →  1.354  →  1.538
       38도    1.257  →  1.358  →  1.486  →  1.837
       30도    1.315  →  1.446  →  1.600  →  2.221
     맨 오른쪽 칸이 재재재요청("3D 원근감 더더 강화")이다. 옛 상수 시절의 1.6이
     '가운데가 솟고 양옆이 흘러내리는 언덕' 착시를 낳았지만 사정이 다르다: 그때는
     **모든 각에서** 1.6이라 평면에 가까운 화면에서도 사다리꼴이 가팔랐다. 지금은 각의
     함수라 90도가 정확히 1.00이고(s가 0이면 D가 무엇이든 비가 1이다), 큰 값은 가장 많이
     눕힌 칸에만 걸린다 — 그 칸에서는 원근이 세야 눕힌 값을 한다.
     ★ 바닥값(1.8 → 1.15)도 함께 내렸다 — 안 내리면 가장 많이 눕힌 칸에서 바닥에 걸려
       거기서만 원근이 안 자란다(정작 가장 세야 할 칸이다). 바닥의 본뜻은 'D가 s/2에
       닿으면 먼 변이 0으로 무너진다'를 막는 것이고, s는 최대 0.866이라 s/2는 0.433다 —
       1.15면 그 곱절 넘게 남는다. */
const PITCH_DIST_FAR = 2.95;
const pitchDistOf = (s: number): number => Math.max(1.15, PITCH_DIST_FAR - 2.05 * s);


const pct = (v: number, span: number) => `${(v / span) * 100}%`;
/** 저그 둔덕 몸통 — 셋이 같은 몸을 쓰고 뿔만 자란다(아래 lair/hive). 옆구리는 종 모양
 *  으로 불룩하게(지적: "해처리의 곡선이 반대로 됨" — 나팔처럼 파인 곡선을 뒤집었다).
 *  꼭대기는 평평하고, 높이보다 옆으로 넓다(지적). */
/* 후지산 옆모습(지적: 뚱뚱하면 안 된다 — 위쪽은 거의 직선으로 가파르고 내려갈수록
   완만하게 벌어지는 오목 곡선), 바닥은 거미줄처럼 사방으로 퍼지는 가닥들(지적). */
// 머리(윗부분) 폭을 한 단 좁혔다(지적: 너무 두꺼움).
/* (전면 3D화·요청) 손으로 깎던 저그 본진 상수들은 3D 빌더(SHAPE_BUILDERS)로 대체됐다. */
/* 전부 입체(면 겹침)로 옮겼다(요청: "무조건 입체로") — 홑겹 도형은 이제 없다. */
const SHAPE_PATHS: Record<string, string> = {};
/* 스톰이 돌려 쓰는 벼락 씨앗의 수 — 칸은 `씨앗 × 단계 + 단계`다.
   ★ 넷 → **둘**, 대신 단계를 여덟 → 열여섯으로(요청: "스톰 한줄기의 생애를 2배로 늘린다") ────
     줄기의 생애는 '몇 칸 사는가 × 한 칸의 길이'다. 칸 박자(초당 14)는 그대로 두고 사는 칸 수를
     두 배로 하면 생애가 정확히 두 배가 된다 — 다만 그러면 태어나는 칸을 벌릴 자리가 모자라
     단계도 함께 두 배여야 한다. 그런데 굽는 판 수는 **씨앗 × 단계**라, 단계를 두 배로 하면서
     씨앗을 반으로 줄이면 판 수가 그대로다(둘 × 열여섯 = 서른둘). 되풀이가 도는 주기도
     그대로 2.3초다 — 서로 다른 벼락 넷이 짧게 살던 것이, 벼락 둘이 두 배로 사는 것으로
     바뀌었을 뿐이다. 굽기 삯 한 톨 안 늘리고 생애만 두 배다. */
const STORM_SEEDS = 2;
/** ★ 캔버스의 '변환 없음' 값 — 빈 문자열이 아니라 **항등 변환**이다(지적: "다 그려지면 툭 움직여") ─────────────────
 *  변환이 걸린 요소는 브라우저가 제 합성 레이어로 올려 두는데, 변환을 지우면(빈 문자열) 그 층에서 내려와 다시
 *  래스터한다. 그 오르내림이 프레임을 하나 먹으면, 내용은 새 자리로 갔는데 화면은 옛 픽셀을 변환 없이 한 프레임
 *  더 보여 준다 — 그것이 '다 그리고 나서 한 번 툭'이다(사파리에서 열에 두 번). 항등 변환을 두면 층이 유지돼
 *  내용 갱신과 변환 변경이 늘 같은 프레임에 실린다. 그림은 "없음"과 똑같다. */
const XF_ID9 = "translate(0px, 0px) scale(1)";
/** 공유 링크의 자리 앉히기 발자취(`#diag=view`의 '링크' 줄) — 실기기에서만 나는 어긋남을 눈으로 보려는 자다.
 *  앉히는 자리와 다시 앉히는 자리가 여기 한 줄씩 적는다(최근 12줄). */
const linkDiag9: string[] = [];
const linkLog9 = (s9: string): void => {
  linkDiag9.push(s9);
  if (linkDiag9.length > 12) linkDiag9.shift();
};
/** 손짓 중 한 장이 이 시간을 넘으면 **무거운 자리**로 본다(3D·난전) — 그때는 끄는 동안 다시 그리기를 미루고
 *  CSS 미끄러짐에 맡긴다(아래 xfPaintNow의 ★). 55ms면 60Hz 기준 세 프레임을 통째로 먹는다는 뜻이다. */
/** 그려진 보기(b)에서 지금 보기까지의 **임시 변환** — 캔버스 내용은 그대로 두고 합성기만
 *  민다. 두 캔버스(유닛·안개)가 각자 제 기준으로 이 자를 쓴다. */
function xfDelta9(b: { z: number; x: number; y: number }, z: number, px: number, py: number): string {
  if (!(b.z > 0)) return XF_ID9;
  const s = z / b.z;
  if (s === 1 && px === b.x && py === b.y) return XF_ID9;
  return `translate(${(px - s * b.x).toFixed(2)}px, ${(py - s * b.y).toFixed(2)}px) scale(${s.toFixed(4)})`;
}
/** ★ 안개 붓 계량기(신고: "팬·핀치 둘 다 안개 빈 공간, 핵 폭발 멈춤도 여전") ─────────────
 *  세 번을 짐작으로 고쳤고 세 번 다 빗나갔다(죔 → 죔 → 핀치 정지). 이제 눈이 아니라 수로
 *  가른다 — 손짓 중 어느 단계에서 끊기는지가 이 다섯으로 갈린다:
 *    붓 — paintFnRef9가 불린 횟수(이게 낮으면 붓 자체가 안 도는 것)
 *    칠 — 안개를 실제로 칠한 횟수(붓과 같아야 정상)
 *    같음 — 보기·자료가 그대로라 건너뜀(팬 중에는 0이어야 한다)
 *    없음 — 그 장에 안개 자료가 없어 건너뜀(워커가 못 서는 중)
 *    미룸 — applyGestureXf가 무거워서 되돌아간 횟수(붓을 아예 안 부른 프레임) */
/* ★ **손짓 창을 따로 센다**(1차 계측: 평소에는 붓56 칠36 미룸0 — 멀쩡했다) ────────────────
   신고는 '손짓 중'인데 계량기는 그 순간을 못 집었다: 1초 창이 손짓 앞뒤의 멀쩡한 프레임과
   섞이고, 손짓은 대개 1초를 못 채운다. 그래서 통을 둘로 나눈다 — 손짓 프레임은 손짓 통에만
   쌓고, 손짓이 든 창은 **그대로 붙들어 둔다**(다음 손짓까지 안 지운다). 손가락을 떼고 찍어도
   그 창의 수가 남아 있다. */
type FogCnt9 = { brush: number; paint: number; same: number; nosrc: number; defer: number; now: number; ms: number; pms: number };
const fogCnt9 = (): FogCnt9 => ({ brush: 0, paint: 0, same: 0, nosrc: 0, defer: 0, now: 0, ms: 0, pms: 0 });
/* ★ 손짓 통에는 **그 창에서 손짓이 실제로 돈 시간**도 쌓는다 — 안 그러면 수를 못 읽는다:
   1초 창에 손짓이 0.1초만 들었으면 '붓4'는 초당 40번이라는 뜻이고, 0.9초 들었으면 초당
   4번이라는 뜻이다(둘은 정반대 진단이다). 붓이 잇달아 불린 사이만 더한다. */
/** `gap`은 '칠해 둔 자리가 상자를 못 덮은 가장 큰 몫'(px) — 손짓 칸의 `즉시N`이 그걸 갚은 장수다. */
const FOGM9 = { at: 0, gest: false, was: false, last: 0, gap: 0, idle: fogCnt9(), g: fogCnt9(), gShow: "" };
/* ★ **안개가 뒤로 간 걸음을 센다**(지적: "과거의 자리로 당겨졌다 다시 돌아와 덜덜덜" ·
   세 번 짚어 세 번 다 빗나갔다) ────────────────────────────────────────────────────
   눈으로는 더 못 가른다. 재는 자는 하나면 된다 — **칠할 때마다, 지금 칠하는 눈 목록이
   어느 시각의 것인가**. 그 값이 전 장보다 작으면 그 한 장이 곧 '과거로 당겨짐'이다.
   목록의 시각은 WeakMap으로 따라다닌다: 워커가 보낸 안개 판은 그 장의 시각을, 이어서
   만든 목록은 두 판 시각을 u9로 섞은 값을 단다. 어느 길로 나온 목록인지(WHY9)도 함께
   적어, 뒤로 간 걸음이 어느 길에서 나오는지까지 한 줄에 나온다. */
const FOGT9 = new WeakMap<Float32Array, number>();
/** 뒤 판의 **신원 → 자리** 표 — 판마다 한 번만 짓고 되쓴다(아래 짝짓기의 ★). */
const VIS_ID9 = new WeakMap<Float32Array, Map<number, number>>();
/** 지금 낸 눈 목록이 어느 길로 나왔나 — 이음/듦/앞장/뒤장없음/제판. */
let fogWhy9 = "-";
const FOGBACK9 = {
  /** 직전에 칠한 목록의 시각(-1이면 아직 없음) */ was: -1,
  /** 뒤로 간 걸음 수 */ n: 0,
  /** 가장 크게 뒤로 간 폭(초) */ worst: 0,
  /** 그때의 길 */ why: "",
  /** 칠한 걸음 수 */ all: 0,
  /** 길별 걸음 수 */ ways: new Map<string, number>(),
};
/* ★ **자리로 잰다**(1차 계측 결과: 역행0/60 — 눈 목록의 시각은 한 번도 안 되돌아갔다) ──
   그러면 범인은 '어느 자료를 집었나'가 아니라 '그 자료가 어디에 있나'다. 그것을 재는 자는
   **눈이 실제로 움직인 거리**다: 창 하나 동안 눈 하나가 **걸은 총 거리**와 **처음에서 끝까지의
   곧은 거리**를 견준다. 곧게 가면 둘이 같고(비 1.0), 앞뒤로 떨면 총 거리만 몇 배로 는다
   (비 3~10). 어느 자료를 집었는지와 무관하게 **화면에서 떨었나**만 말하는 자다.
   길이 바뀐 장(출몰)은 짝을 못 맞추므로 그 창을 새로 연다.
   함께 세는 것 — 전환: 목록이 나온 길이 장마다 바뀐 횟수(이음↔앞장이 번갈면 톱니다). */
const FOGJIT9 = {
  prev: null as Float32Array | null, base: null as Float32Array | null,
  move: 0, n: 0, flips: 0, why: "", ratio: 0, net: 0,
  /** 신원 → 자리(되쓰는 표) — 아래 ★. */
  idx: new Map<number, number>(),
  /* ★ **되돌림의 주기로 가른다**(6차 계측: 이음59/60·역행0·전환1인데 비 36.6(곧259)) ────
     '걸은 거리 ÷ 곧은 거리'는 본진 장면에서 못 쓴다 — 밭을 오가는 일꾼이 6배속 1초 창 안에
     한두 번 왕복하니 걸은 거리는 크고 순이동은 0에 가깝다. 광부의 왕복과 떨림을 그 자는
     못 가른다. 가를 수 있는 것은 **방향을 바꾸는 주기**다: 광부는 몇 초(수백 틱)에 한 번,
     떨림은 한두 틱마다 뒤집는다. 눈마다 직전 걸음의 방향을 기억해 두고, 이번 걸음이 그와
     반대면 되돌림으로 세되 **직전 되돌림에서 세 틱 안**이면 '짧은 되돌림'(= 떨림)으로
     따로 센다. 긴 되돌림은 광부다. */
  st: new Map<number, { dx: number; dy: number; run: number }>(),
  revShort: 0, revLong: 0, steps: 0,
  revShortShow: 0, revLongShow: 0, stepsShow: 0,
  /** 창을 닫을 때 flips를 여기로 옮긴다 — 안 그러면 줄을 짓기 전에 0으로 지워진다(제 버그). */
  flipsShow: 0,
};
const fogJitTick9 = (vis9: Float32Array): void => {
  if (fogWhy9 !== FOGJIT9.why) { FOGJIT9.flips += 1; FOGJIT9.why = fogWhy9; }
  let pv9 = FOGJIT9.prev;
  if (!pv9) {
    FOGJIT9.prev = Float32Array.from(vis9);
    FOGJIT9.base = Float32Array.from(vis9);
    FOGJIT9.move = 0; FOGJIT9.n = 0;
    return;
  }
  if (pv9.length !== vis9.length) { FOGJIT9.prev = new Float32Array(vis9.length); FOGJIT9.prev.set(vis9); pv9 = FOGJIT9.prev; }
  /* ★ 계량기도 **신원으로** 짝지어야 한다(4차 뒤 재점검) — 목록의 차례는 눈이 나고 죽을
     때마다 밀리므로, 차례로 견주면 **다른 눈의 자리**와 재게 된다. 그러면 고쳐 놓고도 비가
     크게 나온다(잰 자가 틀린 것이다). 신원이 같은 눈끼리만 잰다. */
  let m9 = 0;
  const pid9 = FOGJIT9.idx;
  pid9.clear();
  for (let i9 = 0; i9 + 3 < pv9.length; i9 += 4) { const d9 = pv9[i9 + 3]; if (d9 !== 0) pid9.set(d9, i9); }
  const st9 = FOGJIT9.st;
  if (st9.size > 6000) st9.clear();
  for (let i9 = 0; i9 + 3 < vis9.length; i9 += 4) {
    const id9 = vis9[i9 + 3];
    const j9 = pid9.get(id9);
    if (j9 === undefined) continue;
    const dx9 = vis9[i9] - pv9[j9];
    const dy9 = vis9[i9 + 1] - pv9[j9 + 1];
    m9 += Math.abs(dx9) + Math.abs(dy9);
    if (Math.abs(dx9) + Math.abs(dy9) < 0.01) continue;   // 선 눈은 방향이 없다
    FOGJIT9.steps += 1;
    const e9 = st9.get(id9);
    if (!e9) { st9.set(id9, { dx: dx9, dy: dy9, run: 0 }); continue; }
    if (dx9 * e9.dx + dy9 * e9.dy < 0) {
      if (e9.run <= 3) FOGJIT9.revShort += 1; else FOGJIT9.revLong += 1;
      e9.run = 0;
    } else e9.run += 1;
    e9.dx = dx9; e9.dy = dy9;
  }
  FOGJIT9.move += m9;
  FOGJIT9.n += 1;
  pv9.set(vis9);
};
/** 창을 닫으며 '걸은 거리 / 곧은 거리'를 셈한다 — 1.0이면 곧게, 크면 떤 것이다. */
const fogJitClose9 = (): void => {
  const pv9 = FOGJIT9.prev; const bs9 = FOGJIT9.base;
  if (pv9 && bs9 && FOGJIT9.n > 0) {
    let net9 = 0;
    const bi9 = FOGJIT9.idx;
    bi9.clear();
    for (let i9 = 0; i9 + 3 < bs9.length; i9 += 4) { const d9 = bs9[i9 + 3]; if (d9 !== 0) bi9.set(d9, i9); }
    for (let i9 = 0; i9 + 3 < pv9.length; i9 += 4) {
      const j9 = bi9.get(pv9[i9 + 3]);
      if (j9 === undefined) continue;
      net9 += Math.abs(pv9[i9] - bs9[j9]) + Math.abs(pv9[i9 + 1] - bs9[j9 + 1]);
    }
    FOGJIT9.net = net9;
    FOGJIT9.ratio = net9 > 1e-6 ? FOGJIT9.move / net9 : 0;
    if (bs9.length !== pv9.length) FOGJIT9.base = new Float32Array(pv9.length);
    (FOGJIT9.base as Float32Array).set(pv9);
  }
  FOGJIT9.flipsShow = FOGJIT9.flips;
  FOGJIT9.revShortShow = FOGJIT9.revShort; FOGJIT9.revLongShow = FOGJIT9.revLong; FOGJIT9.stepsShow = FOGJIT9.steps;
  FOGJIT9.move = 0; FOGJIT9.n = 0; FOGJIT9.flips = 0;
  FOGJIT9.revShort = 0; FOGJIT9.revLong = 0; FOGJIT9.steps = 0;
};
/** 칠하기 직전에 부른다 — 목록의 시각을 견줘 뒤로 간 걸음을 센다. */
const fogBackTick9 = (vis9: Float32Array | null): void => {
  if (!vis9) return;
  const t9 = FOGT9.get(vis9);
  FOGBACK9.all += 1;
  FOGBACK9.ways.set(fogWhy9, (FOGBACK9.ways.get(fogWhy9) ?? 0) + 1);
  if (t9 === undefined) { FOGBACK9.ways.set("모름", (FOGBACK9.ways.get("모름") ?? 0) + 1); return; }
  if (FOGBACK9.was >= 0 && t9 < FOGBACK9.was - 1e-4) {
    FOGBACK9.n += 1;
    const d9 = FOGBACK9.was - t9;
    if (d9 > FOGBACK9.worst) { FOGBACK9.worst = d9; FOGBACK9.why = fogWhy9; }
  }
  FOGBACK9.was = t9;
};
/** 안개 자리 떨림 한 줄 — 걸은 거리·곧은 거리·그 비·길 바뀜. */
const fogJitStr9 = (): string => `떨림 비${FOGJIT9.ratio.toFixed(1)}`
  + `(곧${FOGJIT9.net.toFixed(0)})`
  + ` 되돌림 짧${FOGJIT9.revShortShow}/긴${FOGJIT9.revLongShow}(걸음${FOGJIT9.stepsShow})`
  + ` 전환${FOGJIT9.flipsShow}`;
const fogBackStr9 = (): string => {
  const w9 = [...FOGBACK9.ways.entries()].sort((a9, b9) => b9[1] - a9[1]).slice(0, 4)
    .map(([k9, v9]) => `${k9}${v9}`).join(" ");
  return `역행${FOGBACK9.n}/${FOGBACK9.all}${FOGBACK9.worst > 0 ? ` 최대${(FOGBACK9.worst * 1000).toFixed(0)}ms(${FOGBACK9.why})` : ""}`
    + (w9 ? ` [${w9}]` : "");
};
/** 지금 쌓을 통 — 손짓 프레임인가로 가른다. */
const fogBin9 = (): FogCnt9 => (FOGM9.gest ? FOGM9.g : FOGM9.idle);
const fogStr9 = (c9: FogCnt9, rate9 = false): string =>
  `붓${c9.brush}${rate9 && c9.ms > 60 ? `(${((c9.brush * 1000) / c9.ms).toFixed(0)}/s)` : ""}`
  + ` 칠${c9.paint} 같음${c9.same} 없음${c9.nosrc} 미룸${c9.defer} 즉시${c9.now}`
  + (c9.paint + c9.now > 0 ? ` 장${(c9.pms / (c9.paint + c9.now)).toFixed(1)}ms` : "")
  + (rate9 ? ` ${(c9.ms / 1000).toFixed(2)}초` : "");
function fogMeterTick9(): void {
  const now9 = pNow();
  if (FOGM9.at === 0) { FOGM9.at = now9; return; }
  if (now9 - FOGM9.at < 1000) return;
  if (FOGM9.g.brush > 0 || FOGM9.g.defer > 0 || FOGM9.g.now > 0) {
    FOGM9.gShow = `${fogStr9(FOGM9.g, true)} 틈${FOGM9.gap.toFixed(0)}px`;
    FOGM9.gap = 0;
  }
  /* 손짓 칸은 **늘 보인다**(빈 채로라도) — 안 보이면 사용자가 '새 판이 안 실렸나'와 '아직
     안 끌었나'를 못 가른다(실제로 한 번 헛걸음했다). 아직 없으면 '대기'라고 적는다. */
  fogJitClose9();
  SCR_DIAG.fog = `${fogStr9(FOGM9.idle)} · 손짓[${FOGM9.gShow || "대기"}] · ${fogBackStr9()} · ${fogJitStr9()}`;
  FOGBACK9.n = 0; FOGBACK9.all = 0; FOGBACK9.worst = 0; FOGBACK9.why = ""; FOGBACK9.ways.clear();
  FOGM9.at = now9;
  FOGM9.idle = fogCnt9();
  FOGM9.g = fogCnt9();
}
const XF_HEAVY_MS9 = 55;
/** 손끝이 이만큼 멈춰 있으면 '한 박자 쉰 것'으로 보고 무거운 자리에서도 한 장 그린다(마무리 한 장의 시계). */
const XF_STILL_MS9 = 140;
/** 무거운 자리라도 마지막으로 그린 뒤 상자의 이만큼을 넘게 밀었으면 그린다 — 빈 가장자리의 상한이다. */
const XF_FAR_FRAC9 = 0.25;
/** `#diag=brush`(지적: "아직도 떨린다" — 실기기에서 어느 붓이 어긋나는지 가리려고) — 유닛 붓이 칠할 때마다 한 줄 적는
 *  고리(최근 120). src는 부르는 쪽이 세운다: tick(재생 틱) · arrive(멈춘 채 장 도착) · xf(손짓 붓) · commit(손짓 끝) ·
 *  react(UnitLayer effect). aT는 그 붓이 든 앞 장의 시각(틱 계열만). */
const BRUSH_LOG9: { at: number; src: string; z: number; px: number; py: number; n: number; aT: number; xf: string; inst: number }[] = [];
let brushSrc9 = "react";
/** 손짓 중 **직전 한 장이 든 시간**(ms) — 붓(UnitLayer)이 배킹을 내릴지 가리는 자다. 부모(xfPaintNow)가 적는다.
 *  모듈 전역인 까닭: 붓은 React 밖에서 불리고 부모의 ref를 못 본다(같은 결의 brushSrc9 옆자리). */
const xfMsRef9 = { v: 8 };
/** 손짓 한 번 동안의 **배킹 몫**(1 · 0.7 · 0.5 · 0.4) — 한 손짓 안에서는 **내려가기만 한다**(아래 ★).
 *  손짓이 시작될 때 1로 되돌린다(beginGestureXf). */
const xfBackK9 = { k: 1 };
let brushAT9 = -1;
/** 재생기 인스턴스 번호(마운트 순) — 한 페이지에 재생기가 둘이면 진단 고리에 섞이므로 가른다. 렌더가 세운다. */
let INST_SEQ9 = 0;
let brushInst9 = 0;
/** 인스턴스별 재생(driven) 뒤집힘 횟수 — 렌더에서 playing9가 지난 값과 다르면 센다. */
const PLAY_FLIPS9: { at: number; inst: number; on: boolean }[] = [];
const brushLogPush9 = (z: number, px: number, py: number, n: number, xf: string): void => {
  BRUSH_LOG9.push({ at: performance.now(), src: brushSrc9, z, px, py, n, aT: brushAT9, xf, inst: brushInst9 });
  if (BRUSH_LOG9.length > 120) BRUSH_LOG9.splice(0, BRUSH_LOG9.length - 120);
  brushSrc9 = "react";
};
/** 최근 2초 요약 — 진단 줄이 부른다. */
const brushLogSummary9 = (): string => {
  const now9 = performance.now();
  const rs9 = BRUSH_LOG9.filter((r9) => now9 - r9.at < 2000);
  if (!rs9.length) return "-";
  const cnt9: Record<string, number> = {};
  for (const r9 of rs9) cnt9[`${r9.inst}:${r9.src}`] = (cnt9[`${r9.inst}:${r9.src}`] ?? 0) + 1;
  const flips9 = PLAY_FLIPS9.filter((f9) => now9 - f9.at < 2000);
  const views9 = new Set(rs9.map((r9) => `${r9.z.toFixed(3)}|${r9.px.toFixed(1)}|${r9.py.toFixed(1)}`));
  const pxs9 = rs9.map((r9) => r9.px); const pys9 = rs9.map((r9) => r9.py);
  let back9 = 0; let prevT9 = -1;
  for (const r9 of rs9) { if (r9.aT >= 0) { if (prevT9 >= 0 && r9.aT < prevT9 - 1e-6) back9 += 1; prevT9 = r9.aT; } }
  const xfs9 = rs9.filter((r9) => r9.xf).length;
  // src마다: 서로 다른 보기 수 · 마지막 보기(팬) · 마지막 op 수 · 마지막 앞 장 시각 — 두 붓이 다른 팬·다른 장으로 칠하는지 바로 읽힌다.
  const bySrc9: Record<string, { views: Set<string>; last: (typeof rs9)[number] }> = {};
  for (const r9 of rs9) {
    const k9 = `${r9.inst}:${r9.src}`;
    const e9 = bySrc9[k9] ?? (bySrc9[k9] = { views: new Set(), last: r9 });
    e9.views.add(`${r9.px.toFixed(1)}|${r9.py.toFixed(1)}`); e9.last = r9;
  }
  const detail9 = Object.entries(bySrc9).map(([k9, e9]) => `${k9} 보기${e9.views.size} 팬(${e9.last.px.toFixed(1)},${e9.last.py.toFixed(1)}) op${e9.last.n} 장${e9.last.aT >= 0 ? e9.last.aT.toFixed(2) : "-"}`).join(" / ");
  return `${detail9} ‖ ${Object.entries(cnt9).map(([k9, n9]) => `${k9}×${n9}`).join(" ")} · 보기 ${views9.size}종 팬x ${(Math.max(...pxs9) - Math.min(...pxs9)).toFixed(1)} 팬y ${(Math.max(...pys9) - Math.min(...pys9)).toFixed(1)} · 장 되돌림 ${back9} · 변환有 ${xfs9} · 재생뒤집힘 ${flips9.length}${flips9.length ? `(${flips9.slice(-4).map((f9) => `${f9.inst}:${f9.on ? "on" : "off"}`).join(" ")})` : ""} · 인스턴스 ${INST_SEQ9}`;
};
/** 도록이 컷을 **실제 박자**로 돌리는 데 쓰는 값(요청: "도록은 애니메이션으로 보여줘야지
 *  실제 공속 이속에 맞게") — 모델 kind로 그 유닛의 이속·공속을 되찾는다.
 *  walkHz는 재생기와 같은 식(이속 × 2.2, 2~9Hz)이고, atkCd는 그 무기의 쿨다운이다.
 *  컷이 없는 종류는 null이라 도록이 정지 그림 셋을 그대로 보여 준다. */
/** 이 모델이 **어떤 컷을 갖나**(요청: "이동/공격은 있는 거만 표시하는 걸로 변경") —
 *  도록이 칸을 몇 개 세울지 이 값으로 정한다. 없는 컷의 칸을 세우면 정지와 똑같은 그림이
 *  나란히 서서, '이 모델은 안 움직이나'가 아니라 '고장 났나'로 읽힌다. */
export function poseKindsOf(kind: string): { move?: boolean; atk?: boolean; flap?: number } | null {
  return POSE_KINDS[kind] ?? null;
}
/** ★ 이 종류가 **어떤 컷을 갖나**(요청: "이동, 액션 모션은 별도 모델링이 없으면 idle
 *  모션이 그 모션이 됨") — 도록이 칸을 세울지 idle로 갈음할지 이 값이 정한다.
 *
 *  poseTempoOf는 '컷이 있나'만 말하고 **어느 컷인지**는 안 말한다. 그런데 종류마다
 *  가진 컷이 다르다: 하이템·아콘은 공격만, 리버·디파일러는 걸음만, 뮤탈·디바우러는
 *  날갯짓까지다. 없는 컷을 달라고 하면 굽기 열쇠(poseTag)가 "0"으로 접어 idle을
 *  돌려주는데 — 그림은 옳지만 **빌더는 그 컷으로 한 번 불린다**. 열쇠와 그림이
 *  어긋날 자리를 만드느니, 부르는 쪽이 있는 컷만 묻는 편이 낫다. */
export function poseCutsOf(kind: string): { move?: boolean; atk?: boolean; flap?: number } | null {
  return POSE_KINDS[kind] ?? null;
}
export function poseTempoOf(kind: string): { walkHz: number; atkCd: number } | null {
  if (!POSE_KINDS[kind]) return null;
  const name = Object.keys(UNIT_3D).find((n) => UNIT_3D[n] === kind);
  if (!name) return null;
  const sp = speedOf(name, 0, undefined);
  const pf = isKnownKind(name) ? profileOf(name) : null;
  const w = pf ? weaponVs(pf, false) : null;
  return {
    walkHz: Math.min(9, Math.max(2, sp * 2.2)),
    atkCd: Math.max(0.2, w ? w.cd : 0.8),
  };
}
/** 보병 손(요청: "손도 너무 동그랗게 하지 말고 넙적한 벙어리장갑 형태로") — 공이던
 *  주먹을 걷는다. 공은 어느 요잉에서도 같은 원이라 손이 아니라 구슬로 읽혔다.
 *  팔뚝 방향을 그대로 이어받는 짧은 토막을 손목 조금 앞에서 손끝까지 세우고, 단면을
 *  **좌우로만 부풀린다**(oval > 1) — 세로는 얇고 가로는 넓은 그 단면이 곧 벙어리장갑
 *  이다. 기둥 단면의 u축은 축이 눕는 순간 위쪽이 되므로, sin쪽(v = 좌우)에 걸리는
 *  oval을 키우면 손등이 넓어진다. */
/** 쥔 주먹(요청: "쥔 손이 필요해") — 총·손잡이를 감아쥔 손이다. 펼친 손(suitHand)은
 *  총 몸통에 묻혀 사라지므로, 쥐는 자리에는 이 뭉툭한 덩이를 **총보다 위 키**로
 *  얹는다. 축은 쥔 것(총열)의 방향이다. */
function suitFist(
  cx: number, cy: number, cz: number, w: number,
  dx = 0, dy = 1, fill?: string,
): ShapeFace[] {
  const dl9 = Math.hypot(dx, dy) || 1;
  const f9 = spirePillar({
    x: 0, y: 0, h: 1, w, tipW: w * 0.9, segs: 2, sides: 6, hold: 0.5, oval: 1.25,
    path: (t9: number): [number, number, number] => [
      cx + (dx / dl9) * (t9 - 0.5) * w * 1.7,
      cy + (dy / dl9) * (t9 - 0.5) * w * 1.7,
      cz,
    ],
  });
  return fill ? paintBase(f9, fill) : f9;
}
/** ★ 진단 스위치 `#noblend` — 효과 층의 **섞임**(mix-blend-mode: screen)을 통째로 끈다 ───────────────────
 *  실측이 여기까지 왔다: 끊긴 프레임의 값이 4367ms인데 그중 붓 2 · 워커 12 · 리액트 2, **밖 4351**이다.
 *  곧 우리 JS는 놀고 있고 브라우저가 4초를 쓴다 — 합성·레이아웃·GC 셋 중 하나다. 그 가운데 이 판이 iOS에서
 *  가장 크게 무는 것이 섞임이다: 섞인 층은 제 뒤의 배경(여기서는 지도 1713² · 유닛 786² 캔버스)을 되읽어야
 *  해서, 웹킷이 그 순간 합성을 소프트웨어로 떨어뜨리는 일이 있다. 핵·스톰·시전 고리가 한꺼번에 뜰 때 끊김이
 *  나는 것과 앞뒤가 맞는다.
 *  짐작을 더 쌓지 않으려고 **끄고 켜서 가른다** — 주소에 #noblend를 붙이면 섞임만 빠지고 나머지는 그대로다. */
const NO_BLEND9 = typeof location !== "undefined" && /noblend/.test(location.hash);
/* (걷어냄) 진단 스위치 `#nodomfx` — 효과 스팬을 끄고 견주던 자다. 그 실험이 답을 냈고(값은 넓이가
   아니라 층 하나하나의 성질이었다), 이제 효과는 전부 캔버스라 끌 스팬이 없다. */
/** ★ 진단 스위치 `#noblur` — 효과의 **흐리기**(filter: blur)만 끈다 ──────────────────────────────
 *  덧칠 넓이가 화면의 0.9배뿐인데도 효과를 빼면 멈춤이 사라졌다. 그러면 값은 넓이가 아니라 **층 하나하나의
 *  성질**이다. blur는 그 층을 따로 그린 뒤 한 번 더 지나가게 만들고(별도 render surface), 섞임(screen)은
 *  그 밑의 **배경 전체**(우리의 거대한 유닛 캔버스)를 읽어 오게 한다. 둘 다 넓이와 무관하게 값이 붙는다. */
const NO_BLUR9 = typeof location !== "undefined" && /noblur/.test(location.hash);
/** 이 프레임의 효과 DOM 수와 이제까지의 최대 — 층 폭발이 값인지 수로 가른다. */
/** ★ **주 실마리가 막혔나, 화면만 굶었나**(조사: 10초 멎었다 풀림 · 메모리는 55MB로 멀쩡) ─────────────
 *  여태 잰 '최장 프레임'은 rAF 사이의 틈이다. 그 틈이 길다고 곧 주 실마리가 막힌 것은 아니다 — rAF는
 *  **그리기 파이프라인**에 매여 있어서, 합성기·GPU가 못 따라오면 JS가 멀쩡해도 안 불린다.
 *  둘을 가르는 자가 **타이머**다: setInterval은 그리기와 무관하게 주 실마리의 큐에서 돈다.
 *    · 타이머도 10초 멎었다 → 주 실마리가 통째로 막혔다(JS·GC·레이아웃).
 *    · 타이머는 100ms대로 멀쩡한데 rAF만 멎었다 → **그리기 쪽**이다(합성·GPU). 고칠 자리가 아주 다르다.
 *  탭이 뒤로 가면 사파리가 타이머를 1초로 죄므로, 1초 언저리 값은 그 몫으로 읽는다. */
const TICKM9 = { worst: 0, n: 0, at: 0 };
/** ★ **캔버스 배킹 손실**(실기 신고: "10초씩 끊겼다 재생됐다 반복 · 오버레이가 사라짐 · 지도는 계속 복구 안 됨") ──
 *  타이머가 답을 갈랐다: 타이머는 최악 402ms인데 rAF 틈이 15초였다 — 주 실마리는 멀쩡하고 **그리기만** 멎었다.
 *  그 꼴로 멎었다 풀리고, 풀린 뒤 지도가 빈 채로 남는 것은 웹킷의 알려진 손이다: 메모리를 거둘 때 캔버스의
 *  **배킹(그림)을 통째로 버린다**. 크기도 열쇠도 그대로라 우리 쪽 '이미 구웠다'는 기억(bakedRef·판 캐시)은
 *  멀쩡하고, 그래서 **다시 안 그린다** — 그것이 "복구 안 됨"의 정체다.
 *  그러니 잃었는지 알아채고 처음부터 다시 그리는 길을 둔다. 알아채는 자는 둘:
 *    ① `contextlost`/`contextrestored` — 사파리 16.4+가 2D 캔버스에도 준다.
 *    ② 긴 틈(0.7초) 뒤의 **한 점 검사** — 지도 밑판 한가운데 화소가 비었으면 잃은 것이다(1×1 읽기라 싸다).
 *  다시 그리는 몫: 지도 벡터의 기억(MAPVEC_LOST9) · 판 캐시(스프라이트·건물·효과) · 안개 틱 · 붓 한 장. */
const LOST9 = { n: 0, probe: 0, at: 0, born: typeof performance === "undefined" ? 0 : performance.now() };
/** 붓(모듈 함수)이 세우고 컴포넌트의 rAF가 받아 가는 표 — ref를 모듈에서 못 보므로 한 칸 둔다. */
const LOSTQ9 = { want: false };
/** ★ 메모리가 **시간과 함께 느는가**(물음: "며칠 전엔 안 그랬는데") ────────────────────────────────
 *  "한참 보다 보면 시작된다"는 꼴은 새는 자리의 전형이다. 10초마다 큰 덩어리(화면 캔버스 · 구운 판 ·
 *  설계도 · 안개 판)를 더해 두고 **처음·지금·최대**를 나란히 보인다. 셋이 나란하면 새는 데가 없고,
 *  지금이 처음보다 크게 자라 있으면 그 자리를 찾으면 된다. 값은 10초에 한 번 더하기 몇 번이라 없다. */
const MEMTR9 = { first: 0, now: 0, max: 0, n: 0, cv: 0, cvMB: 0, plMB: 0, exMB: 0 };
/** ★ **캔버스를 얼마나 만들고 버리나**(조사: 메모리는 34MB로 평평한데 배킹 손실은 계속 난다) ────────────
 *  크기가 아니라 **양**이 남았다. 웹킷에서 캔버스 하나는 제 배킹(iOS면 IOSurface)을 갖는데, 굽고 버리기를
 *  되풀이하면 그 자원이 빠르게 돌고 — 그 회전이 곧 압박이고, 압박의 끝이 '배킹을 거두고 그리기를 멈춤'이다.
 *  판 굽기·물들이기·효과 래스터가 저마다 캔버스를 새로 만든다. 몇 개를 만들고 있는지부터 수로 본다. */
const CVN9 = { n: 0, win: 0, at: 0, rate: 0, peak: 0, peakTop: "", by: new Map<string, number>(), top: "" };
function newCanvas9(tag9 = "?"): HTMLCanvasElement {
  CVN9.n += 1;
  CVN9.win += 1;
  CVN9.by.set(tag9, (CVN9.by.get(tag9) ?? 0) + 1);
  const now9 = pNow();
  if (CVN9.at === 0) CVN9.at = now9;
  else if (now9 - CVN9.at >= 1000) {
    CVN9.rate = (CVN9.win * 1000) / (now9 - CVN9.at);
    CVN9.win = 0;
    CVN9.at = now9;
    /* 어느 자리가 만드나 — 상위 셋만 남긴다(창마다 처음부터 센다). */
    CVN9.top = [...CVN9.by.entries()].sort((a9, b9) => b9[1] - a9[1]).slice(0, 3)
      .map(([k9, v9]) => `${k9}${v9}`).join(" ");
    /* ★ **순간 봉우리**를 붙든다 — 잔잔할 땐 초당 3장인데 큰 싸움에서 360장까지 튄다(실측).
       평소 값만 보면 그 폭발을 영영 못 본다: 이 판이 무서운 것은 평균이 아니라 그 봉우리다. */
    if (CVN9.rate > CVN9.peak) { CVN9.peak = CVN9.rate; CVN9.peakTop = CVN9.top; }
    CVN9.by.clear();
  }
  return document.createElement("canvas");
}
/** 짐을 진 일꾼의 판(요청: 일꾼별로 미네랄·가스 들고 있는 모델) — 코어가 말하는 상태가
 *  짐을 가른다. 짐이 없으면 맨몸 판 그대로다. 판 이름은 맨몸 + Min/Gas 규약이고,
 *  NORM_PAIR가 맨몸 배수를 물려주므로 몸 크기는 안 변한다. */
const workerLoadKind = (base: string, st: number | null): string =>
  (st === ST_CARRY_MIN ? `${base}Min` : st === ST_CARRY_GAS ? `${base}Gas` : base);
/** 일꾼 정체 — 살아 있는 일꾼을 셀 때 개체 트랙에서 고르는 이름들. */
const WORKER_KINDS = new Set(["SCV", "Probe", "Drone"]);
/** 커맨드 없이 시작하는 일꾼 수 — 세 종족 모두 4기다(개체 트랙에는 첫 클릭에야 나타난다). */
const WORKER_START = 4;
const AIR_ROWS = BW_ROWS.filter((r) => r[3] === 1);
/** 공중 상자 여유 — 공중 유닛은 충돌이 없어 dimensions가 표적 획득·클릭용으로 넉넉하다
 *  (원값 그대로면 스커지 0.75 > 저글링 0.50, 옵저버 1.00 = 탱크, 오버로드 1.56 > 울트라).
 *  얼마나 넉넉한지도 **자료가 말한다**: 공중 무리의 상자 기하평균(1.318)이 그들의 등급이
 *  말하는 크기(0.915)보다 1.441배 크다. 그 몫을 그대로 나눈다 — 지어낸 수가 없다.
 *  **다만 상수 하나로는 안 맞는 자리가 있다(정직하게 적는다)**: 종류별 잔차
 *  (상자 ÷ 등급 기대)가 레이스 1.044 · 스카웃 1.049 · 셔틀 1.106에서 뮤탈 2.161까지
 *  2.07배로 흩어진다. 잔차가 1에 가까운 셋은 상자에 여유가 애초에 없는데도 1.441로
 *  나뉘어 제 등급의 0.72배까지 내려앉고, 그 바람에 지상 중형(벌처·럴커) 아래로 떨어졌다.
 *  그 셋만 아래 UNIT_SIZE_TUNE에서 되올린다 — 상수를 종류별 표로 바꾸는 것은 자료
 *  한 층을 더 만드는 일이라, 손잡이 층에서 세 칸으로 끝낸다.
 *  (진짜 그림 크기는 GRP 헤더인데 MPQ 없이는 못 캔다. 캐게 되면 이 줄이 아니라
 *   SPRITE_OVERHANG 하나만 갈아 끼우면 된다.) */
/** (지금은 안 쓴다 — 요청: 원작 비율 그대로) 값 자체는 자료가 말하는 사실이라 남긴다:
 *  공중 무리의 상자 기하평균이 그들 등급이 말하는 크기보다 이만큼(1.441배) 크다.
 *  화면 크기를 다시 등급 쪽으로 당기고 싶으면 UNIT_BW_TILES에서 이 값을 나누면 된다. */
export const AIR_BOX_SLACK = gmOf(AIR_ROWS.map(bwBoxTiles))
  / gmOf(AIR_ROWS.map((r) => CLASS_TILES[r[2]]));

/** 도형 kind → 그 kind로 그려지는 건물의 원작 이름 — SHAPE_KIND를 뒤집은 것이다.
 *  이름이 여럿인 kind(ComSat·Comsat Station)는 먼저 걸린 하나로 족하다: 발자국이 같다. */
const BLD_NAME_OF_KIND: Record<string, string> = Object.fromEntries(
  Object.entries(SHAPE_KIND).map(([name, k]) => [k, name]).reverse(),
);
/** 도록 kind → 원작 치수를 가진 kind — 제 치수가 표에 없는 변형들만 적는다. */
const GALLERY_SIZE_KIND: Record<string, string> = {
  lurkeregg: "lurker",     // 알은 러커의 한 시절
  mutacocoon: "muta",      // 고치도 마찬가지
  // 짐을 진 일꾼 — 지도에서 차지하는 상자는 맨몸 그대로다(짐은 몸을 안 키운다).
  scvMin: "scv", scvGas: "scv",
  probeMin: "probe", probeGas: "probe",
  droneMin: "drone", droneGas: "drone",
};
/** 도록 kind → 지도에서 차지하는 상자의 **한 변**(타일) — 모델 갤러리의 '지도상 크기'가
 *  이 값으로 모델을 줄이고 늘인다(요청).
 *  ★ 한 변인 것이 핵심이다(수리: 켜면 건물이 납작해 보인다) — 처음에 건물을 발자국
 *    가로·세로(4×3)로 눌렀는데, **지도는 그렇게 그리지 않는다**: 건물 op은 fitWidth라
 *    상자의 한 변을 발자국 **폭**으로만 잡고(UnitLayer의 `sidePx = op.fitWidth ? wPx`),
 *    스프라이트는 정사각 판에 균일 배율로 굽는다(`c2.scale(sideQ/16, sideQ/16)`).
 *    세로로 따로 누르면 지도에 없는 눌림을 도록이 지어내는 셈이었다.
 *  자가 둘인데 눈금은 하나다: 유닛은 원작 치수표가 정한 상자(unitTilesOf — 지도의
 *  unitGlyphPx가 tilePx를 곱하기 **직전**의 바로 그 값), 건물은 발자국 폭이다. 둘 다
 *  단위가 타일이라 유닛과 건물을 한 자로 나란히 견줄 수 있다.
 *  ⚠ **크기만** 지도와 같다. 도록은 사선(base) 시점이고 지도 기본은 위에서 본(top)
 *    시점이라, 같은 모델도 −9.1%(스카웃)~+15.1%(변태고치)로 어긋난다(ShapeIcon 주석).
 *    또 지도에는 화면 크기에 따른 자동 등급 강등이 걸리는데 여기엔 없다 — 부품이 얼마나
 *    빠지는지는 사양 라디오가 따로 말한다. */
/* 지도가 이 모델의 16-상자를 **몇 타일에 펼쳐 놓나**(타일) — 도록의 "인게임" 크기가
 * 이 자 하나로 선다.
 *
 * ★ 돌려주는 것은 잉크가 아니라 **상자**다. 그 까닭이 이 함수의 전부다 ────────────
 *   지도가 그리는 차례는 유닛도 건물도 똑같다: 정사각 판 한 변을 타일로 정하고
 *   (유닛 unitGlyphPx = unitTilesOf×tilePx · 건물 sidePx = 발자국폭×BLD_DRAW_K×tilePx),
 *   그 판 안에 모델의 16-상자를 균일 배율로 굽는다. 곧
 *       화면에 칠해지는 폭 = 상자(타일) × 모델의 날잉크 / 16
 *   이다. 도록의 ShapeIcon은 **날잉크를 이미 그리고 있으므로**, 인게임 배수는 상자만
 *   곱하면 화면 폭이 저절로 위 식이 된다. 여기서 잉크를 한 번 더 곱하면 잉크가 두 번
 *   들어간다.
 *   실제로 그렇게 되어 있었다(지적: "건물은 너무 크고 유닛은 너무 작아") — 유닛만
 *   `unitTilesOf × 잉크/16`으로 잉크를 되먹였고 건물은 상자 그대로였다. 그래서 유닛의
 *   크기 차가 **제곱으로** 눌렸다: 실측으로 화면 폭 비가 커맨드/마린 16.8배였는데
 *   원작대로면 6.7배다. 잉크 되먹임을 걷으면 유닛만 3~6배 커지고 건물은 그대로여서,
 *   둘의 비가 원작 그대로가 된다.
 *   ("말도 안 되게 작게 나옴"을 고치던 앞선 판이 여기서 반대쪽으로 넘어갔다 — 그때
 *    유닛이 3배 크게 매겨지던 것을 고치면서 잉크를 곱해 3배 작은 쪽으로 지나쳤다.)
 *   자원 둘도 상자 그대로다(간헐천 3.84·미네랄 2.4 — 지도의 wTiles). */
export const shapeMapTiles = (kind: string): number => {
  const bld = BLD_NAME_OF_KIND[kind];
  if (bld) {
    return buildingBox(bld)[0] * BLD_DRAW_K * (BLD_DRAW_TUNE[kind] ?? 1);
  }
  // 자원 둘은 건물표에 없다 — 지도가 그리는 상자 그대로다(위 자원 층의 wTiles).
  if (kind.startsWith("mineral")) return 2.4;   // 꼴·고갈 별본 모두 같은 상자다.
  if (kind === "geyser") return 3.84;
  // 공사장·고치는 무엇이 될지에 따라 달라진다 — 흔한 3×2의 폭 3으로 둔다(건물 폴백).
  if (kind === "cocoon") return 3 * BLD_DRAW_K;
  const sk = GALLERY_SIZE_KIND[kind] ?? kind;
  return unitTilesOf(sk, sk, 1);
};
const UNIT_KIND_SET = new Set(SHAPE_GALLERY.filter((g) => g.group === "유닛").map((g) => g.kind));
/** 발밑만 떠 있는 지상 유닛 — 부양 그림자(넓고 옅은 타원)를 지는 무리다. 일꾼 셋은
 *  **짐을 진 별본까지** 든다: 짐 유무로 그림자가 바뀌면 밭을 오가는 동안 깜빡인다. */
/** 접지 그림자 중심을 위로 당기는 몫(세로 반지름의 배수) — 바닥까지 꽉 찬 상자꼴 몸만(그림자 그리기의 up9 주석). */
const HOVER_UNIT_SET = new Set([
  "scv", "scvMin", "scvGas", "probe", "probeMin", "probeGas", "drone", "droneMin", "droneGas",
  "vulture", "archon", "darchon", "htemp",
]);

/* 음영 증폭(지적: 모델들 그림자가 너무 없어 — 갤러리보다 더 진하게) — 흑·백 덮개 면의
   불투명도를 1.45배로 키운다. 몸판(덮개색 없는 면)은 그대로라 색은 안 변하고 그늘·광만
   뚜렷해진다. */
/** 덮개 면의 명암을 1.45배로 세게 — **덮개만**이다(지적: "불투명인 부품들 뒤가
 *  비쳐보이는게 너무 많어").
 *
 *  이 함수의 뜻은 "흰·검 반투명 덮개(topFace·sideFace·capFace)를 지도에서 더 또렷하게"
 *  였는데, 조건이 '색이 있으면'이라 **색을 지닌 몸판까지 걸렸다**. 몸판은 불투명도가
 *  1이므로 min(0.85, 1.45) = 0.85 — 즉 paintBase·raceBase로 칠한 모든 부품과 손으로
 *  색을 준 모든 면(마린 얼굴가리개·헬멧 껍데기·건메탈 총열…)이 화면 어디서나 15%
 *  비쳤다. 지도·건물·도록 네 자리가 전부 이 한 줄을 지난다.
 *
 *  덮개는 애초에 반투명(0.22·0.3·0.4)이라 1보다 작다. 그 조건 하나만 더 두면 뜻은
 *  그대로 지키면서 몸판은 불투명해진다. */
/* 증폭 1.45 → 1.25, 상한 0.85 → 0.7(지적: 음영이 너무 세 거의 검정) — 덮개가 종족 광택
   곡선으로 이미 한 번 짙어진 위에 또 곱해져 두 겹으로 쌓이던 것을 완화한다. */
/** 체력바 두께(CSS px) — 유닛·건물 가리지 않고 같다(지적: "길이만 길거나 짧고 두께는 동일하게"). 배율에만 살짝 따른다. */
const hpBarH9 = (zoom: number): number => Math.max(1.5, 1.2 + zoom * 0.25);

/* (삭제) 유닛 상자 채움 보정 — 옛 FILL_SKIP·FILL_PAIR·FILL_CACHE·UNIT_FILL_TARGET.
   구운 판의 잉크 폭을 재서 되키우던 자다. 모델 공간을 종류마다 같은 몫으로 맞추는
   MODEL_NORM이 그 일을 설계 단계에서 끝내므로 통째로 걷었다(상한 1.55에 걸려 저글링·
   프로브·스커지가 아무리 작아도 못 커지던 문제도 함께 사라진다). 뮤탈처럼 '날개는
   넓은데 몸은 작은' 모델을 위한 목표표도 필요 없다 — 잉크 폭이 아니라 잉크 **상자**
   (√(폭×높이))로 맞추므로 옆으로만 퍼진 모델이 '이미 큰 모델'로 재지지 않는다.
   **짝(포신·차체)을 묶던 몫만은 없애지 않고 옮겼다** — MODEL_NORM 옆의 NORM_PAIR가
   그 자리다. 축이 같은 상자 중심이라는 것만으로는 부족하고, 배율까지 같아야 포탑이
   차체 위에서 안 미끄러진다(이 주석의 옛 판이 적어 둔 실패 모드가 바로 그것이다).
   **건물 쪽(BLD_FILL_*)은 발자국이 크기를 정하는 다른 체계라 그대로 둔다.** */
/* 스프라이트 보관함의 잘라내기(수리: 장수로만 자르면 큰 판이 쌓일 때 메모리가 터진다)
   — 여태 기준이 '장수'뿐이라, 한 장이 얼마나 큰지는 보지 않고 700장까지 쌓았다. 판
   크기는 유닛의 그리는 상자에 비례하므로, 대비를 키우거나 깊게 확대하면 한 장이
   950×950(DPR 2) ≈ 3.6MB까지 간다 — 700장이면 이론상 2.5GB다. 그 구멍 때문에 크기
   대비 상수(SIZE_CONTRAST)에 상한을 걸어 두어야 했다.
   이제 **바이트로 재고 오래된 것부터 덜어낸다**(LRU). Map은 넣은 차례를 지키므로,
   찾을 때마다 지웠다 다시 넣어 맨 뒤로 보내면 맨 앞이 늘 '가장 오래 안 쓴 것'이다.
   통째로 비우던 옛 방식은 다음 프레임에 화면 전체를 다시 굽게 만들어 그 순간 끊겼다. */
/* 96 → 128MB — 판 한 변 상한을 2304로 올리면서(위) 큰 판 한 장이 21MB가 됐다. 예산이
   그대로면 큰 판 넉 장이 예산을 다 먹고 서로를 밀어내며 매 프레임 다시 굽는다. */
/** ★ 이 기기가 **작은 기기**인가 — 예산과 되돌려주기가 이 한 값을 본다(지적: "모바일에서
 *  자꾸 메모리 부족으로 페이지가 새로고침돼. 그냥 볼 땐 안 그러는데 갑자기 줌을 줄이거나
 *  3d로 전환할 때 그런 거 같아") ─────────────────────────────────────────────────────
 *  손가락 기기 + 작은 화면이면 작은 기기로 본다. 알려 주는 브라우저에서는 메모리(GB)도
 *  함께 본다(deviceMemory는 크로뮴 계열만 낸다 — 없으면 0이라 앞의 둘로 정한다).
 *  창이 없는 자리(노드에서 이 파일을 읽는 자·서버 렌더)는 거짓이다. */
/** 빌드 표식(vite define) — 개발 서버·도구 번들에는 없을 수 있어 선언만 느슨히 둔다. */
declare const __SCPLAY_BUILD__: string | undefined;
/** `?lite=1` — 붓 간이화를 모든 배율에 강제한다(요잉 8칸·자세 컷 없음·포탑 한 판). 폰에서 판 스래싱이 남는지
 *  배포 없이 시험하는 깃발. */
const liteFlag9 = typeof location !== "undefined" && /[?&]lite=1/.test(location.search);
const smallDevice9 = ((): boolean => {
  if (typeof window === "undefined") return false;
  const coarse9 = !!window.matchMedia?.("(pointer: coarse)").matches;
  const side9 = Math.max(window.screen?.width ?? 0, window.screen?.height ?? 0);
  const mem9 = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0;
  return (coarse9 && side9 > 0 && side9 <= 1180) || (mem9 > 0 && mem9 <= 4);
})();
/* ★ 예산은 **기기가 정한다**(같은 지적) ────────────────────────────────────────────
   여기 있던 128MB는 PC의 자다. 폰에서 그 값은 예산이 아니라 흉기다: 이 판들은 브라우저
   힙 밖의 캔버스 뒷그림이고, 폰의 한 탭이 통째로 쓸 수 있는 몫이 그 두어 배뿐이다.
   ── 왜 하필 '줌을 줄이거나 3d로 전환할 때'인가
   판의 열쇠에는 **크기(pxq)와 기울임(pitch)이 들어 있다**(unitSprite의 그 줄). 그래서 그
   둘 중 하나만 바뀌어도 화면의 판이 **한 장도 안 맞는다** — 한 프레임에 새 세대를 통째로
   굽는다. 그런데 옛 세대는 예산이 찰 때까지 그대로 남아 있으므로(LRU는 넘칠 때만 덜어낸다)
   그 순간 기기는 두 세대를 함께 이고 있어야 한다. 게다가 줌을 **줄이면** 새 판이 작아
   예산을 못 채우니, 크게 보던 시절의 큰 판이 경기가 끝날 때까지 안 빠진다.
   ── 그냥 볼 때는 왜 안 그런가
   한 배율·한 기울임에 머무는 동안은 열쇠가 안 바뀌어 새로 굽는 일이 거의 없다. 지적의
   "그냥 볼 땐 안 그런다"가 이 구조를 그대로 말해 준다.
   폰 몫은 32MB로 잡는다. 폰에서 판 한 장은 대개 몇 KB~100KB라(작게 보므로) 수백 장이
   그 안에 들어오고, 넘치면 LRU가 가장 오래된 것부터 덜어낸다 — 느려질 뿐 안 죽는다. */
/* ★ 예산을 **기기 메모리에 맞춰 넓힌다**(지적: "모바일 예산 상한을 너무 낮게 묶은 거
   아닌지") ────────────────────────────────────────────────────────────────────────
   32MB는 '가장 약한 폰에서도 안 죽는다'를 기준으로 잡은 값이다. 그 기준은 옳지만,
   그 값을 **모든 폰에 똑같이** 씌운 것이 지나쳤다: deviceMemory가 8을 부르는 요즘
   폰에서도 예산이 32MB라, 확대해서 볼 때 LRU가 계속 쫓아내고 다시 굽는다(끊김의 한
   갈래다). 메모리를 알려 주는 기기에서는 그 값에 비례해 넓힌다.
   ★ 안 알려 주는 기기(iOS 사파리는 deviceMemory를 아예 안 낸다)는 **종전 그대로**다 —
     예산을 늘려서 죽는 쪽이 끊기는 쪽보다 훨씬 나쁘고, 앞서 겪은 사고도 그쪽이었다.
     모르는 기기에 대고 낙관하지 않는다는 것이 이 표의 규약이다. */
const deviceMem9 = ((): number => {
  if (typeof navigator === "undefined") return 0;
  return (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0;
})();
/** 작은 기기의 예산 배수 — 메모리를 부르는 만큼만 넓힌다(모르면 1배 = 종전 32/16MB). */
const smallBudgetK9 = deviceMem9 >= 8 ? 3 : deviceMem9 >= 6 ? 2.5 : deviceMem9 >= 4 ? 1.75 : 1;
/* ★ 예산은 바이트가 아니라 **화소**로 잡아야 한다(실기 진단: 아이폰 dpr 3 · 배율 6에서
   `판 유닛 261장 32.0/32MB · 건물 38장 16.5/16MB` — 둘 다 예산에 못 박힌 채였고, 그
   상태에서 탭이 버려졌다) ────────────────────────────────────────────────────────────
   같은 그림이라도 dpr이 오르면 판이 **제곱으로** 무거워진다. 그런데 예산은 바이트로
   못 박혀 있어, dpr 3 화면은 dpr 2 화면과 같은 32MB를 쓰면서 실제로는 화면에 훨씬 적은
   수의 판밖에 못 담는다 — 그러고도 총량은 그대로 무겁다. 게다가 그 기기는 지도 캔버스
   한 장에만 이미 2626² × 4 = **27.6MB**를 쓰고 있다(진단의 그 줄). 판 예산 48MB가 거기
   얹히면 사파리가 버틸 자리가 없다.
   기준을 dpr 2(이 값들을 처음 잡은 화면)로 두고 그보다 촘촘한 화면에서는 같은 비로
   내린다. 제곱까지 내리면(화소를 완전히 고정) dpr 3에서 44%가 되어 되굽기가 너무
   잦아지므로, 절반 몫(선형)만 먹인다 — dpr 3에서 67%다.
   ※ 값을 죄는 만큼 되굽기는 는다. 그 값은 이제 대타 판(굽기 예산이 다한 프레임)과
     빌림터가 받아 낸다 — 예산을 죄는 일이 곧 덜컥임이던 시절과는 사정이 다르다. */
const dprBudgetK9 = ((): number => {
  if (typeof window === "undefined") return 1;
  return Math.min(1, 2 / Math.max(1, window.devicePixelRatio || 1));
})();
/* ★ 기기 프로필(5번) — 폰/PC로 갈리던 문턱을 한 표에 모았다. 새 문턱은 여기에 더하고 자리에서는 DEV9.x만 읽는다.
   (기기 판정은 smallDevice9 하나다: 손가락 기기 + 작은 화면, 또는 메모리 4GB 이하.) */
/** 벤치 단 한 줄 — 프로필(DEV9)마다 제 표를 든다(아래 applyBenchTier9). 0단이 그 프로필의 기본값이다. */
type BenchTier9 = { spriteMB: number; bldSpriteMB: number; unitBakePerFrame: number; bldBakePerFrame: number; bakeMsPerFrame: number; aheadSec: number; aheadMB: number };
/* PC의 세 단(아래 ★ 주석) — 폰 표(PHONE_TIERS9)는 지금 한 줄뿐이라 단이 안 오른다. 폰에도 단을 열려면 그 표에 줄을
   더하면 된다(문턱·오르기만 하는 규칙·#tier= 강제는 그대로 탄다) — 설계는 기기를 안 가린다(요청: "모바일에도 이식할 수
   있게 개방적으로 · 단수 적용도 마찬가지"). */
const PC_TIERS9: readonly BenchTier9[] = [
  { spriteMB: 128, bldSpriteMB: 64, unitBakePerFrame: 3, bldBakePerFrame: 3, bakeMsPerFrame: 12, aheadSec: 3, aheadMB: 24 },
  { spriteMB: 192, bldSpriteMB: 96, unitBakePerFrame: 6, bldBakePerFrame: 6, bakeMsPerFrame: 18, aheadSec: 5, aheadMB: 48 },
  { spriteMB: 256, bldSpriteMB: 128, unitBakePerFrame: 10, bldBakePerFrame: 8, bakeMsPerFrame: 24, aheadSec: 8, aheadMB: 80 },
];
const PHONE_TIERS9: readonly BenchTier9[] = [
  { spriteMB: 32 * smallBudgetK9 * dprBudgetK9, bldSpriteMB: 16 * smallBudgetK9 * dprBudgetK9, unitBakePerFrame: 1, bldBakePerFrame: 1, bakeMsPerFrame: 8, aheadSec: 1.5, aheadMB: 6 },
];
const DEV9 = smallDevice9 ? {
  name: "phone",
  /** 유닛/건물 판 예산(MB) — 메모리를 부르는 기기는 그 배수. */
  spriteMB: 32 * smallBudgetK9 * dprBudgetK9, bldSpriteMB: 16 * smallBudgetK9 * dprBudgetK9,
  /** 지도 벡터층이 비워 두는 몫(MB) · 데칼 굽기 한 변 상한 · 굽는 판 한 장/빌림터 상한(MB) */
  mapFreedMB: 14, decalBakeMax: 192, bakeOneMB: 3, bakePoolMB: 6,
  /** 프레임당 굽는 장수(유닛/건물) · 프레임당 굽기 **시간**(ms, 아래 ★) */
  unitBakePerFrame: 1, bldBakePerFrame: 1, bakeMsPerFrame: 8,
  /** 피격 불티 수 배수 · 죽음 파편 수 · 효과 래스터 예산(MB) · 접지 그림자 최소 배율 */
  hitShardK: 0.6, dieShards: 12, fxRasterMB: 6, shadowGroundMinZoom: 3,
  /** 워커 시야 여유(화면 배수) · 앞으로 지을 한도(벽시계 초·MB) · 요잉을 늘 여덟 칸으로 */
  // 앞 한도 4 → 6MB(진단: 3배 장당 163KB — 4MB면 0.8초, 6MB면 1.2초. 지난 장은 이제 한도에 안 든다(frameWorker)).
  cullMargin: 0.5, aheadSec: 1.5, aheadMB: 6, yaw8Always: true,
  /** 굽기 일꾼 수(아래 BAKEW9) — 폰은 0(지금 길 그대로). 여는 조건은 이 한 값이다. */
  bakeWorkers: 0,
  /** 벤치 단 표(위 PHONE_TIERS9 — 한 줄이라 단이 없다). */
  tiers: PHONE_TIERS9,
} : {
  name: "pc",
  spriteMB: 128, bldSpriteMB: 64,
  mapFreedMB: 0, decalBakeMax: 768, bakeOneMB: 8, bakePoolMB: 24,   // 크립 굽기 상한 384 → 768(지적: PC에서 화질 낮은 게 보임)
  unitBakePerFrame: 3, bldBakePerFrame: 3, bakeMsPerFrame: 12,
  hitShardK: 1, dieShards: 24, fxRasterMB: 24, shadowGroundMinZoom: 0,
  /* 앞 한도 10 → 24MB(진단: PC 3배에서 장당 220KB라 10MB가 0.7초 만에 차, 3초 예산이 있어도 앞이 0.7초뿐이었다 —
     굽기 한 번(최악 41ms)이나 GC에 뒤장이 비기 딱 좋은 여유다. 24MB면 220KB로 3.6초). */
  cullMargin: 1, aheadSec: 3, aheadMB: 24, yaw8Always: false,
  /* 굽기 일꾼(아래 BAKEW9) — 코어 8 이상이면 둘, 아니면 하나. `#bakeworker=N`(0이면 끔)으로 못 박는다. */
  bakeWorkers: typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 4) >= 8 ? 2 : 1,
  tiers: PC_TIERS9,
};
/* ★ **PC는 벤치 단으로 예산을 올린다**(요청: "윈도우 크롬에서 CPU·GPU를 최대한 쓸 수 없을까" → 계획 1번) ────
   위 PC 표는 한 값이라 벤치 7ms짜리 기기도 19ms짜리와 같은 예산(프레임당 굽기 3장·12ms, 앞 3초·24MB)으로
   놀고 있었다. 진입 벤치(CROWD9.bench — 판 200장 찍기 ms, 실측 PC 7 · 헤드리스 SW 19)로 세 단을 가른다:
     0 보통(≥16.8ms) — 지금 값 그대로.
     1 빠름(<16.8)  — 굽기 6장·18ms, 앞 5초·48MB, 판 192/96MB.
     2 매우 빠름(<8.4) — 굽기 10/8장·24ms, 앞 8초·80MB, 판 256/128MB.
   ★ 폰은 **안 탄다** — smallDevice9 갈래는 그대로이고, 데스크톱 UA의 아이패드(터치가 있는 PC)도 0단에
     둔다(터치 기기의 메모리 한도는 벤치로 못 잰다). 유휴 재벤치(crowdRecheck9)가 더 작은 값을 내면 단이
     오르기만 한다(내려가지 않는다 — 부풀린 첫 값이 내린 단은 짐이지 기기가 아니다). `#tier=N`으로 못 박는다.
   굽기 ms가 한 장(16.7ms)을 넘는 단은 전투 중 프레임을 먹을 수 있다 — 그 몫은 기존 문(bakeOk9의 프레임당
   시계·bakeSprint9의 대기표 길이)이 그대로 다스린다. 예산은 상한이지 강제가 아니다. */
/* 메인의 굽기 환경 — DOM 캔버스(계수기 newCanvas9·창고 takeStored9)와 기기 한도(DEV9). 위 BAKE_ENV9 참고. */
BAKE_ENV9.mk = newCanvas9;
BAKE_ENV9.out = (w9, h9, tag9) => {
  const got9 = takeStored9(w9, h9);
  if (got9) return got9;
  const c9 = newCanvas9(tag9); c9.width = w9; c9.height = h9; return c9;
};
BAKE_ENV9.oneMax = DEV9.bakeOneMB * 1024 * 1024;
BAKE_ENV9.poolBytes = DEV9.bakePoolMB * 1024 * 1024;
const PC_TIER9 = { v: 0, force: -1 };
/* ★ **재생 품질 알림**(요청: "처음 시작할 때나 벤치 변경 시 맵 오른쪽 위에 토스트로 재생품질: 높음/보통/낮음 3초간") ────
   눈금은 넷이다 — PC는 벤치 단(2단 높음 · 1단 보통 · 0단 낮음), 폰은 낮음이고 벤치 미달(효과를 덜어내는 기기)이면
   **매우 낮음**(요청: "모바일은 보통 낮음이겠지 · PC 낮음보다 더 낮으면 매우 낮음"). 벤치는 진입 때 한 번 재고 유휴에
   다시 재어 단이 오를 수 있으므로, 눈금이 **바뀔 때마다** 알린다(같은 값이면 조용하다). 컴포넌트는 fn을 꽂고 3초 뒤 걷는다;
   첫 벤치는 렌더 중에 돌아 fn이 아직 없으니 level만 적어 두고, 꽂히는 순간 그 값을 한 번 보인다. */
const QUALITY9 = { level: "", fn: null as ((lv: string) => void) | null };
const qualityLevel9 = (): string =>
  smallDevice9 ? (CROWD9.weak ? "매우 낮음" : "낮음") : PC_TIER9.v >= 2 ? "높음" : PC_TIER9.v === 1 ? "보통" : "낮음";
/** 벤치·단이 정해지거나 바뀐 자리에서 부른다 — 눈금이 달라졌을 때만 알린다. */
function qualityNote9(): void {
  const lv9 = qualityLevel9();
  if (lv9 === QUALITY9.level) return;
  QUALITY9.level = lv9;
  QUALITY9.fn?.(lv9);
}
/** 워커에 앞 한도를 다시 일러야 한다는 표 — 단이 바뀌면 다음 cmd에 새 aheadSec/MB를 싣는다. */
const DEV9_DIRTY9 = { v: false };
const touchPc9 = typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 1;
function applyBenchTier9(bench: number): void {
  const tiers9 = DEV9.tiers;
  // 프로필 표가 한 줄이면 단이 없다(폰) · 터치가 있는 PC(데스크톱 UA 아이패드)도 0단(메모리 한도를 벤치로 못 잰다).
  if (tiers9.length < 2 || touchPc9 || !(bench > 0)) return;
  const top9 = tiers9.length - 1;
  if (PC_TIER9.force < 0 && typeof window !== "undefined") {
    const m9 = /tier=(\d)/.exec(window.location.hash);
    PC_TIER9.force = m9 ? Math.min(top9, Number(m9[1])) : -2;   // -2: 살펴봤고 없음
  }
  const want9 = Math.min(top9, PC_TIER9.force >= 0 ? PC_TIER9.force
    : bench < CROWD_BENCH_MS9 * 0.35 ? 2 : bench < CROWD_BENCH_MS9 * 0.7 ? 1 : 0);
  if (want9 <= PC_TIER9.v) return;   // 오르기만 한다
  PC_TIER9.v = want9;
  const t9 = tiers9[want9];
  DEV9.spriteMB = t9.spriteMB; DEV9.bldSpriteMB = t9.bldSpriteMB;
  DEV9.unitBakePerFrame = t9.unitBakePerFrame; DEV9.bldBakePerFrame = t9.bldBakePerFrame; DEV9.bakeMsPerFrame = t9.bakeMsPerFrame;
  DEV9.aheadSec = t9.aheadSec; DEV9.aheadMB = t9.aheadMB;
  // 모듈 초기에 DEV9에서 베낀 값들도 갈아 끼운다(아래 let들).
  SPRITE_BYTES_MAX = DEV9.spriteMB * 1024 * 1024;
  BLD_SPRITE_BYTES_MAX = DEV9.bldSpriteMB * 1024 * 1024;
  BAKE_MS_PER_FRAME9 = DEV9.bakeMsPerFrame;
  BAKE_HARD_MS9 = DEV9.bakeMsPerFrame * 3;
  UNIT_BAKE_PER_FRAME = DEV9.unitBakePerFrame;
  BLD_BAKE_PER_FRAME = DEV9.bldBakePerFrame;
  DEV9_DIRTY9.v = true;
  qualityNote9();   // 단이 올랐다 — 재생 품질 알림(위 QUALITY9)
}
/* 덜어내기 단(요청: "모바일에서 그려야 할 대상이 많을 때 버벅임 방지 — 화면 내 유닛 수 문턱으로
   2·3·4번 적용") ─────────────────────────────────────────────────────────────
   ★ 재설계(지적: "이전 값으로 트리거 단을 높이다 보니 ① 이미 한참 버벅인 후 적용됨 ② 풀려도 되는
     지점에서 안 풀림 ③ 계산 비용도 드는 듯 → 플레이어 진입 시 성능 계산을 완료해 놓고, 기준 미달이면
     유닛 수에 따라 트리거 없이 적용") — 첫 판은 붓이 매 장 그리기 ms를 재고 다섯 장 평균·이력으로
     단을 올리내렸다. 느려진 **뒤에야** 올라가고, 덜어낸 덕에 빨라진 값으로 되내려 다시 느려지는
     되먹임이 있었으며, 장마다 시계를 두 번 읽고 평균을 냈다.
   이제 둘로 가른다:
   · **기기 판정은 진입 때 한 번**(benchDevice9): 작은 캔버스에 판 찍기 200장·알파 타원 100개·그림자
     블러 40장을 세 바퀴 돌리고 getImageData로 GPU 줄을 비워 잰다(캔버스 2D는 비동기라 비우지 않으면
     제출 시간만 잰다). 붓이 처음 칠하기 직전에 한 번 돌고(수십 ms), 그 뒤로는 값만 읽는다.
     기준(CROWD_BENCH_MS9)을 넘으면 미달 기기(weak), 그 두 배를 넘으면 문턱을 절반으로 낮춘 심한 미달.
   · **단은 유닛 수의 함수**다: 미달 기기에서만, 그 장의 유닛 op 수(워커가 시야 사각형 안으로 걸러
     보낸 수 — 폰은 대략 2×2 화면 몫)로 곧장 정한다. 올림 60·120기, 내림 50·100기 — 수가 문턱에서
     흔들릴 때 깜빡이지 않을 만큼만 띄를 둔다. 시계도 평균도 없다.
   단별로 덜어내는 것(누적):
     1단 — 땅 그림자·몸 그림자 끔(붓) · 죽음·피격 파편 반(붓) · 홀수 개체 트레이서 생략(엔진, view.crowd)
     2단 — 피격 불티 통째로 생략(붓) · 죽음 파편 3분의 1(붓)
   안 빼는 것: 유닛 본체 판·원거리 트레이서 자체(절반은 남는다)·죽음 여운·미니맵 점. */
const CROWD9 = { lv: 0, weak: false, k: 1, bench: -1, units: 0, force: -1, bench3: -1, weak3: false, k3: 1, re: 0 };
const CROWD_BENCH_MS9 = 24;          // 2D: 이 위면 미달 기기(실측 PC 7ms · 헤드리스 SW 래스터 19ms)
/* 3D는 따로 낮춘다(요청: "벤치 기준을 좀 낮추는 건?") — 3D 짐은 벤치가 재는 채우기 말고도 판 가짓수·큰 판
   굽기가 얹혀, 같은 자로는 '충분'이 후하다. PC 실측 8ms는 넉넉히 통과하고, 그 두 배 언저리부터 미달로 본다. */
const CROWD_BENCH3D_MS9 = 16;
/** ★ **낮은 배율에서 더 죈다**(요청: "모바일 벤치에 따라 1,2,3배줌에서 버겁지 않게 더 죄기
 *  — 효과나 요잉각도 최소화") ────────────────────────────────────────────────────────────
 *  1~3배는 지도가 통째로 한 화면에 들어오는 칸이라 **그려야 할 개체가 가장 많다**. 그런데 그
 *  배율에서 유닛 하나는 서너 화소다 — 요잉 여덟 칸도, 꾸밈 효과 한 겹도 화면에서 값을 못 하면서
 *  삯은 다 치른다. 판 가짓수(종류 × 요잉 × 시점 × 자세)가 특히 그렇다: 굽기가 못 따라가면
 *  '미룸'이 쌓이고 그것이 곧 버벅임이다.
 *  그래서 **벤치가 미달인 기기에서만**, 그 칸에서 둘을 더 줄인다(멀쩡한 기기는 그대로다):
 *    1단(미달)      — 요잉 **네 칸**(90도)·시점 0 · 꾸밈 효과 생략(용접·흙덩이·착지·스웜·상처)
 *    2단(심한 미달) — 거기에 지역 마법과 트레이서까지 생략. 사건은 죽음 폭발이 말한다.
 *  안 줄이는 것: 죽음·파괴 폭발 · 소환 섬광 · 우리 · 스톰 · 핵 · 건물 붕괴 — 무슨 일이
 *  일어났는지를 말하는 것들이다. 입체는 제 벤치(bench3)로 잰다. */
const NO_TRIM9 = typeof location !== "undefined" && /notrim/.test(location.hash);
/* ★ **겹침생략은 기본으로 끈다**(지적: "유닛 사라짐 — 그대로고 #nothin 붙이면 해결됨") ────────
   격자를 거리로 바꾸고 불감대를 둬도 사라짐이 남았다. 남을 수밖에 없다: 이 손질이 하는 일이
   **덮인 유닛을 안 그리는 것**이라, 판정이 아무리 좋아져도 '덮였다'가 틀리는 순간 유닛이 없다.
   그리고 이것으로 벌려던 것(1배 로딩)은 실측에서 안 벌렸다 — 찍기는 2235 → 918로 줄었는데
   로딩은 그대로였다("겹침생략은 많이 됐지만 로딩은 그대로야"). 값은 안 벌고 눈에 띄는 흠만
   남으니 꺼 둔다. 코드는 남긴다(`#thin`으로 켠다) — 찍기 수를 가를 때 쓸 자다. */
const THIN_ON9 = typeof location !== "undefined" && /(^|[#&])thin/.test(location.hash)
  && !/nothin/.test(location.hash);
function lowZoomTrim9(zoom9: number, pitched9: boolean): 0 | 1 | 2 {
  /* 진단 스위치 `#notrim` — 이 죄기를 통째로 끈다. 낮은 배율에서 무엇이 달라졌나를
     한 탭으로 가르는 자다(끄고 켜서 가른다 — 이 판의 규약). */
  if (NO_TRIM9) return 0;
  if (!smallDevice9 || zoom9 > 3) return 0;
  const c9 = CROWD9;
  if (c9.force >= 0) return c9.force >= 2 ? 2 : c9.force >= 1 ? 1 : 0;   // #crowd= 강제 단을 그대로 탄다
  if (!(pitched9 ? c9.weak3 : c9.weak)) return 0;
  return (pitched9 ? c9.k3 : c9.k) < 1 ? 2 : 1;
}
/** 1단에서 생략하는 꾸밈 효과(옛 DOM 갈래의 style) — 없어도 상황이 안 읽히지는 않는 것들. */
const TRIM1_SKIP9 = new Set(["weld", "dig", "land", "swarm"]);
/** 2단에서 더 생략하는 것 — 지역 마법의 얼룩·고리. */
const TRIM2_SKIP9 = new Set(["cast"]);
const CROWD_UP9 = [60, 120];         // lv → lv+1 올림 유닛 op 수
const CROWD_DOWN9 = [50, 100];       // lv → lv−1 내림 유닛 op 수
/** deep — 입체(3D) 몫(지적: "2D는 괜찮은 기기도 3D에선 힘들어함 — 3D 충분 여부도 따로 재라"). 입체의 판은
 *  시각 밀림·기울기를 먹어 더 크게 굽히고 알파 합성 면적도 그만큼 넓다 — 판을 1.7배로, 밀림 변환을 걸고,
 *  그림자 블러도 한 단 키워 같은 자(24ms)로 잰다. 화소가 2.9배라 그 배만큼 센 기기만 3D 충분이다. */
function benchDevice9(deep = false): number {
  if (typeof document === "undefined") return 0;
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 256;
  const ctx = cv.getContext("2d");
  const sp = document.createElement("canvas"); sp.width = 48; sp.height = 48;
  const sc = sp.getContext("2d");
  if (!ctx || !sc) return 0;
  sc.fillStyle = "#8ac"; sc.beginPath(); sc.arc(24, 24, 20, 0, Math.PI * 2); sc.fill();
  const sz = deep ? 61 : 36;
  const t0 = pNow();
  if (deep) ctx.setTransform(1, 0, -0.3, 0.78, 30, 0);
  for (let r = 0; r < 3; r += 1) {
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 200; i += 1) ctx.drawImage(sp, (i * 37) % 220, (i * 53) % 220, sz, sz);
    ctx.globalAlpha = 0.35; ctx.fillStyle = "#000";
    for (let i = 0; i < 100; i += 1) { ctx.beginPath(); ctx.ellipse((i * 41) % 240, (i * 29) % 240, deep ? 24 : 14, deep ? 10 : 6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = deep ? 10 : 6;
    for (let i = 0; i < 40; i += 1) ctx.drawImage(sp, (i * 61) % 220, (i * 23) % 220, sz, sz);
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.getImageData(0, 0, 1, 1);
  return pNow() - t0;
}
/** 진입 때 한 번 — 기기 판정. 이미 쟀으면 그냥 지난다. */
function crowdInit9(): void {
  const c = CROWD9;
  if (c.bench >= 0) return;
  /* 두 번 돌려 **작은 값**을 쓴다 — 한 번은 첫 판 굽기·GC와 겹쳐 곱절로 나올 수 있다(perf-check에서
     같은 조임인데 29ms와 62ms가 나왔다). 작은 쪽이 기기의 힘이고 큰 쪽은 그 순간의 짐이다. */
  c.bench = Math.min(benchDevice9(), benchDevice9());
  c.weak = c.bench > CROWD_BENCH_MS9;
  c.k = c.bench > CROWD_BENCH_MS9 * 2 ? 0.5 : 1;
  c.bench3 = Math.min(benchDevice9(true), benchDevice9(true));   // 입체 몫은 따로 — 같은 자, 무거운 짐
  c.weak3 = c.bench3 > CROWD_BENCH3D_MS9;
  c.k3 = c.bench3 > CROWD_BENCH3D_MS9 * 2 ? 0.5 : 1;
  /* 강제 단(#crowd=0·1·2) — 기기 판정과 무관하게 그 단으로 못 박는다. 효과를 눈으로 견주거나
     perf-check(--crowd)에서 덜어낸 값을 잴 때 쓴다. */
  const m9 = typeof window !== "undefined" ? /crowd=(\d)/.exec(window.location.hash) : null;
  if (m9) c.force = Math.min(2, Number(m9[1]));
  crowdRecheck9();  applyBenchTier9(c.bench);   // PC 벤치 단(위 PC_TIERS9의 ★)
  bakeWorkersStart9();   // 굽기 일꾼(위 BAKEW9) — 기기 표(DEV9.bakeWorkers)가 0이면 안 띄운다
  qualityNote9();        // 첫 눈금(위 QUALITY9) — 렌더 중이라 fn은 아직 없고 level만 적힌다
}
/** ★ **벤치를 유휴에 다시 잰다**(지적: 실측 PC 7ms인데 27ms로 찍혀 미달 판정 — 단 "너무 늦게는 의미없으니
 *  초반에") ────────────────────────────────────────────────────────────────────────────────────────
 *  첫 재기는 파싱·첫 판 굽기·GC와 겹친다. 두 번 돌려 작은 쪽을 쓰지만 그 둘이 나란히 붙어 있어 둘 다 같은
 *  짐을 진다 — 그래서 한 벌을 더, 이번엔 **떨어뜨려서** 잰다. 오염된 재기는 큰 값이 나올 뿐이라 '작은 쪽만
 *  갈아 끼운다'가 걸러 준다(값이 나빠지는 일은 없다).
 *  한 번의 유휴에 **한 판만** 잰다 — 한 판이 30ms 언저리라 몰아 재면 그것이 곧 끊김이다. 유휴가 안 오면
 *  0.7초 만에 끊고 잰다(늦게 재면 뜻이 없다 — 그 사이 단·문턱은 이미 부풀린 값으로 돌아간다). */
let crowdReQ9: boolean[] | null = null;
function crowdRecheck9(): void {
  if (typeof window === "undefined" || crowdReQ9) return;
  crowdReQ9 = [false, true, false, true];   // 2D·3D 두 벌
  const ric9 = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const plan9 = (): void => {
    if (!crowdReQ9 || crowdReQ9.length === 0) { crowdReQ9 = null; return; }
    if (ric9) ric9(() => step9(), { timeout: 700 });
    else window.setTimeout(step9, 400);
  };
  const step9 = (): void => {
    const q9 = crowdReQ9;
    if (!q9 || q9.length === 0) { crowdReQ9 = null; return; }
    const deep9 = q9.shift() as boolean;
    const ms9 = benchDevice9(deep9);
    const c9 = CROWD9;
    if (ms9 > 0) {
      if (deep9) {
        if (c9.bench3 < 0 || ms9 < c9.bench3) {
          c9.bench3 = ms9; c9.weak3 = ms9 > CROWD_BENCH3D_MS9; c9.k3 = ms9 > CROWD_BENCH3D_MS9 * 2 ? 0.5 : 1; c9.re += 1;
        }
      } else if (c9.bench < 0 || ms9 < c9.bench) {
        c9.bench = ms9; c9.weak = ms9 > CROWD_BENCH_MS9; c9.k = ms9 > CROWD_BENCH_MS9 * 2 ? 0.5 : 1; c9.re += 1;
        applyBenchTier9(ms9);   // 더 작은 값이면 단이 오를 수 있다(위 ★)
        qualityNote9();         // 폰의 미달이 풀렸을 수도 있다(위 QUALITY9)
      }
    }
    plan9();
  };
  plan9();
}
/** ★ React 한 장(렌더 + 커밋) 계량기(조사: "핵폭발 멈춤") ────────────────────────────────
 *  핵·스톰이 떠 있는 동안 React 박자를 25~60Hz로 올리는데(아래 nukeStep9), 그 한 장이 이 커다란
 *  컴포넌트의 **전체 렌더**다. 한 장이 박자보다 길면 주 실마리가 통째로 막혀 페이지가 선다 —
 *  그 둘(한 장 값 · 박자)을 나란히 봐야 '멈춤'이 짐작이 아니라 수가 된다. */
const REACTM9 = { at: 0, n: 0, sum: 0, max: 0, t0: 0, avg: -1 };
function noteReact9(ms9: number): void {
  /* 창을 넘겨도 남는 **미끄러지는 평균**(EMA) — 박자를 가르는 자가 이것이다(아래 nukeStep9).
     창 안의 합만 쓰면 창을 넘긴 직후 한 장도 안 잰 상태가 되어 판정이 한 번씩 옛 규칙으로 떨어진다. */
  REACTM9.avg = REACTM9.avg < 0 ? ms9 : REACTM9.avg * 0.85 + ms9 * 0.15;
  if (NUKEM9.on && ms9 > NUKEM9.react) NUKEM9.react = ms9;   // 핵 창 몫(아래 NUKEM9)
  WORK9.react += ms9;                                        // 이 틈에서 React가 쓴 몫(위 WORK9)
  REACTM9.n += 1;
  REACTM9.sum += ms9;
  if (ms9 > REACTM9.max) REACTM9.max = ms9;
  const now9 = pNow();
  if (REACTM9.at === 0) { REACTM9.at = now9; return; }
  if (now9 - REACTM9.at < 1000) return;
  const per9 = (REACTM9.n * 1000) / (now9 - REACTM9.at);
  SCR_DIAG.react = `${per9.toFixed(0)}장/s · 평균 ${(REACTM9.sum / Math.max(1, REACTM9.n)).toFixed(0)}ms`
    + ` · 최악 ${REACTM9.max.toFixed(0)}ms · 몫 ${Math.min(999, (REACTM9.sum * 100) / (now9 - REACTM9.at)).toFixed(0)}%`;
  REACTM9.at = now9; REACTM9.n = 0; REACTM9.sum = 0; REACTM9.max = 0;
}
/* (걷어냄) nukeStep9 — 핵·스톰이 떠 있는 동안 React 박자를 25~60Hz로 올리던 자다.
   그림이 DOM일 때는 React가 빨라야 연출이 매끄러웠지만, 캔버스로 옮긴 뒤로는 붓이
   매 프레임 나이로 그리므로 React는 제 박자(100ms)면 족하다. */
/** ★ 핵 창 계량기(조사: "핵폭발시 멈춤도 똑같아") ─────────────────────────────────────────
 *  멈추는 동안에는 스크린샷을 못 찍는다 — 그러니 핵이 떠 있는 **창 전체**를 재서, 창이 끝난 뒤에도
 *  화면에 남겨 둔다. 무엇이 멈춤의 값인지는 셋으로 갈린다: 프레임이 길었나(최악프레임) · 그게 굽기였나
 *  (굽기 창) · React였나(리액트 최악 · 박자). 짐작 대신 이 셋을 읽고 고친다. */
const NUKEM9 = { on: false, at: 0, n: 0, worst: 0, last: 0, react: 0, parts: "", rec: 0 };
/** ★ 한 프레임의 값을 **누구 몫인지로 가른다**(실측: 핵 창 최악 프레임 3891ms인데 굽기 0 · 리액트 7ms) ──
 *  그 둘이 아니면 남는 자리는 셋뿐이다: 붓(유닛·안개 칠하기) · 워커 장 받기(푸는 값이 메인 몫이다) ·
 *  그 밖(브라우저 — 합성·GC·레이아웃). 붓 사이의 틈에서 앞의 셋을 빼면 '그 밖'이 남는다.
 *  짐작을 더 쌓지 않기 위한 자다: 어느 칸이 크냐가 곧 다음에 고칠 자리다. */
const WORK9 = { brush: 0, wk: 0, react: 0 };
/** ★ **로딩의 초는 어디로 가나**(지적: "1배 로딩은 아직 그대로") ────────────────────────────
 *  로딩이 기어갈 때 화면이 말해 주는 것은 '밖(브라우저) 606ms'와 '타이머 2297ms 늦음'뿐이었다.
 *  그 둘은 **누가 잡고 있나**를 안 말한다 — 메인 실마리를 초 단위로 잡을 수 있는 자리는 넷이다:
 *    지도판  — 지형 전체를 큰 판 하나에 그리는 일(1배·큰 맵이 최악이다. 판마다·몇 번인지 잰다)
 *    참값    — 자취를 워커에 넘기려고 형식 배열로 싸는 일
 *    워커세움 — 인라인 워커 한 벌을 만드는 일(번들을 한 번 더 컴파일한다)
 *    예열    — 모델 면 데우기(rAF로 나눠 굽지만 합이 얼마인지는 따로 못 봤다)
 *  짐작을 더 쌓지 않으려고 넷을 다 잰다. 이 줄을 한 장 보면 다음 칼이 어디인지 정해진다. */
const LOAD9 = { mapN: 0, mapMs: 0, mapMax: 0, truthMs: 0, wkMs: 0, warmMs: 0, warmN: 0 };
/** 겹쳐서 덮일 유닛을 얼마나 뺐나(위 drawList9) — '몇 중 몇을 그렸나'. */
const THIN9 = { n: 0, drew: 0 };
/** 죄기 요잉 칸의 **직전 답**(개체별) — 칸 경계에서 방향이 파닥이지 않게 하는 불감대용. */
const YAWQ9 = new Map<string, number>();
/** 겹침생략의 **직전 답**(개체별, 1 = 숨김) — 칸 경계에서 깜빡이지 않게 하는 불감대용. */
const THIN_ST9 = new Map<string, number>();
/** 붓 사이 틈을 재는 자(위 WORSTF9) — 핵 창과 무관하게 늘 돈다. */
const FRAMEG9 = { last: 0 };
/** 이 판이 본 **가장 긴 프레임**과 그 몫 — 핵 창 밖에서도 잰다(실측: 핵과 무관한 1918ms 프레임이 있었다). */
const WORSTF9 = { ms: 0, parts: "", at: "" };
function nukeMeterTick9(on9: boolean, step9: number, playing9 = true): void {
  const now9 = pNow();
  /* 붓 사이의 틈을 늘 잰다 — 핵 창은 그중 한 도막일 뿐이다. 첫 장·오래 멈춘 뒤(2초 넘는 틈)는 안 센다:
     멈춤·탐색·백그라운드는 '느린 프레임'이 아니라 아예 안 도는 시간이라 섞으면 자가 거짓이 된다. */
  if (FRAMEG9.last > 0) {
    const dt9 = now9 - FRAMEG9.last;
    /* 재생 중일 때만 센다 — 멈춰 있으면 붓은 청할 때만 도니 그 틈은 '느린 프레임'이 아니다.
       상한은 8초: 그보다 긴 것은 탭이 뒤로 갔거나 잠긴 화면이라 이 자의 몫이 아니다. */
    /* 0.7초 넘게 그리기가 멎었으면 배킹을 의심한다(위 LOST9) — 검사는 다음 rAF에서 한다. */
    if (playing9 && dt9 > 700) LOSTQ9.want = true;
    if (playing9 && dt9 < 8000 && dt9 > WORSTF9.ms) {
      WORSTF9.ms = dt9;
      const out9 = Math.max(0, dt9 - WORK9.brush - WORK9.wk - WORK9.react);
      WORSTF9.parts = `붓${WORK9.brush.toFixed(0)} 워커${WORK9.wk.toFixed(0)}`
        + ` 리액트${WORK9.react.toFixed(0)} 밖${out9.toFixed(0)}`;
      WORSTF9.at = `${SPRITE_PERF.bldBake}건물/${SPRITE_PERF.bake}유닛`;
    }
  }
  FRAMEG9.last = now9;
  if (on9 && !NUKEM9.on) {
    NUKEM9.on = true; NUKEM9.at = now9; NUKEM9.n = 0; NUKEM9.worst = 0; NUKEM9.react = 0; NUKEM9.last = now9;
    BLD_MISS9.why.clear();   // 이 창에서 건물 판이 갈린 까닭만 센다(위 bldMissWhy9)
    return;
  }
  if (on9) {
    const dt9 = now9 - NUKEM9.last;
    NUKEM9.last = now9;
    NUKEM9.n += 1;
    if (dt9 > NUKEM9.worst) {
      NUKEM9.worst = dt9;
      const out9 = Math.max(0, dt9 - WORK9.brush - WORK9.wk - WORK9.react);
      NUKEM9.parts = `붓${WORK9.brush.toFixed(0)} 워커${WORK9.wk.toFixed(0)}`
        + ` 리액트${WORK9.react.toFixed(0)} 밖${out9.toFixed(0)}`;
    }
    WORK9.brush = 0; WORK9.wk = 0; WORK9.react = 0;
    return;
  }
  WORK9.brush = 0; WORK9.wk = 0; WORK9.react = 0;   // 창 밖에서도 틈마다 비운다(위 WORSTF9)
  if (!NUKEM9.on) return;
  NUKEM9.on = false;
  /* ★ 남기는 것은 **가장 나빴던 창**이다(지적: 멀쩡한 창이 하나 지나면 증거가 지워진다) —
     멈춤은 어쩌다 한 번이라, 마지막 창만 남기면 정작 그 창을 못 본다. 새 창이 더 나쁠 때만 갈아 끼운다. */
  if (NUKEM9.worst <= NUKEM9.rec) return;
  NUKEM9.rec = NUKEM9.worst;
  const secs9 = Math.max(0.001, (now9 - NUKEM9.at) / 1000);
  const w9 = SPRITE_PERF.wLast;
  SCR_DIAG.nukem = `최악창 ${secs9.toFixed(1)}초 붓${NUKEM9.n}장(${(NUKEM9.n / secs9).toFixed(0)}/s)`
    + ` · 최악프레임 ${NUKEM9.worst.toFixed(0)}ms[${NUKEM9.parts}] · 리액트 최악 ${NUKEM9.react.toFixed(0)}ms(박자 ${step9}ms)`
    + ` · 굽기창 유닛${w9.bake}장 ${w9.ms.toFixed(0)}ms 건물${w9.bldBake}장 ${w9.bldMs.toFixed(0)}ms`
    + ` 최악 ${w9.worstFrame.toFixed(0)}ms(굽기 ${w9.worstFrameBake.toFixed(0)})`
    + ` · 건물판 갈림[${bldMissTop9()}]`;
}
/** 큰 덩어리를 더해 MB로 — 화면 캔버스(폭×높이×4) · 구운 판 · 설계도·안개 판은 부르는 쪽이 더한다. */
function memTrendTick9(root: HTMLElement | null, extraMB9 = 0): void {
  /* ★ **어느 덩어리가 자라나**를 함께 남긴다(신고: 되살릴 때마다 40 → 46 → 56 → 60 → 67MB) ─────────
     합만 보면 '자란다'까지밖에 못 안다. 셋으로 갈라 두면 한 줄로 자리가 잡힌다:
       · 캔버스 **장수**가 는다 → DOM에 캔버스가 쌓인다(붙였다 떼는 자리가 안 떼고 있다).
       · 장수는 그대로인데 MB가 는다 → 판이 **커진다**(굽는 창·배킹 배수).
       · 판(스프라이트)·설계도·안개가 는다 → 그쪽 예산이 새는 것이다. */
  let by9 = 0;
  let n9 = 0;
  if (root) {
    const cvs9 = root.querySelectorAll<HTMLCanvasElement>("canvas");
    n9 = cvs9.length;
    for (let i9 = 0; i9 < n9; i9 += 1) by9 += cvs9[i9].width * cvs9[i9].height * 4;
  }
  const cvMB9 = by9 / 1048576;
  const plMB9 = (spriteBytes.n + bldSpriteBytes.n + FX_RASTER_BYTES.n) / 1048576;
  const mb9 = cvMB9 + plMB9 + extraMB9;
  MEMTR9.n += 1;
  MEMTR9.now = mb9; MEMTR9.cv = n9; MEMTR9.cvMB = cvMB9; MEMTR9.plMB = plMB9; MEMTR9.exMB = extraMB9;
  if (MEMTR9.first === 0) MEMTR9.first = mb9;
  if (mb9 > MEMTR9.max) MEMTR9.max = mb9;
}
/** 배킹을 잃었을 때 — 구워 둔 판을 통째로 버린다(그 판들도 캔버스라 같이 비었다). */
function dropPlates9(): void {
  /* ★ 버릴 때는 **놓아 줘야** 한다(오늘 넣은 이 함수의 흠) — Map만 비우면 캔버스 객체는 GC를 기다리는데,
     iOS의 캔버스 배킹(IOSurface)은 GC가 늦으면 그동안 그대로 잡혀 있다. 되살릴 때마다 메모리가 계단처럼
     오르던 몫에 이 자리가 있었다. 이 판의 규약대로 크기를 0으로 돌려 곧장 내준다(releaseCanvas). */
  for (const p9 of SPRITE_CACHE.values()) {
    RELEASE_Q9.push(p9.cv);
    const sh9 = (p9 as { sh?: { cv: HTMLCanvasElement } | null }).sh;
    if (sh9) RELEASE_Q9.push(sh9.cv);
    if (p9.tint) { RELEASE_Q9.push(p9.tint.cv); releaseTints9(p9.tint); }
  }
  SPRITE_CACHE.clear(); spriteBytes.n = 0;
  for (const b9 of BLD_SPRITE_CACHE.values()) {
    RELEASE_Q9.push(b9.cv);
    if (b9.tint) { RELEASE_Q9.push(b9.tint.cv); releaseTints9(b9.tint); }
  }
  BLD_SPRITE_CACHE.clear(); bldSpriteBytes.n = 0;
  BLD_SPRITE_SIZES.clear();
  for (const c9 of FX_RASTER_CACHE.values()) RELEASE_Q9.push(c9);
  FX_RASTER_CACHE.clear(); FX_RASTER_BYTES.n = 0;
  flushReleased9();
}
/** 지도 밑판 한가운데 화소가 비었나 — 배킹 손실의 증거다(1×1 읽기). 못 읽으면 '아니오'로 친다. */
function canvasLost9(root: HTMLElement): boolean {
  const cv9 = root.querySelector<HTMLCanvasElement>(".scr-mapvec-base, .scr-mapvec-sharp");
  if (!cv9 || cv9.width < 8 || cv9.height < 8) return false;
  /* 잃었다고 잘못 보면 판을 통째로 버리고 다시 굽는다 — 그 대가가 크므로 문을 좁힌다:
     ① 첫 몇 초(아직 안 구운 자리)는 안 본다 ② 방금 복구했으면 안 본다(되돌이 방지)
     ③ 한 점이 아니라 **두 점**이 다 비어야 한다. */
  const now9 = pNow();
  if (now9 - LOST9.born < 5000 || now9 - LOST9.at < 3000) return false;
  try {
    const c29 = cv9.getContext("2d", { willReadFrequently: true });
    if (!c29) return false;
    const blank9 = (x9: number, y9: number): boolean => {
      const d9 = c29.getImageData(x9, y9, 1, 1).data;
      return d9[3] === 0 && d9[0] === 0 && d9[1] === 0 && d9[2] === 0;
    };
    return blank9(cv9.width >> 1, cv9.height >> 1) && blank9(cv9.width >> 2, cv9.height >> 2);
  } catch { return false; }
}
/** 안개 판의 임시 변환을 걸고, **같은 자리에서** 막 띠까지 세운다 — 틈(px)을 낸다.
 *  ★ 둘을 한 함수로 묶는 까닭(지적: "검정 띠가 계속 보인다") — 앞판은 손끝 자리에서 띠를 세우고 안개는
 *    다른 자리에서 칠했다. 그래서 칠한 **뒤에도** 옛 띠가 남아, 판이 멀쩡히 덮은 자리(시야로 파 놓은
 *    구멍)를 검정으로 메웠다. 변환을 거는 자리가 곧 띠를 세우는 자리여야 둘이 어긋날 수 없다. */
function fogXfApply9(root: HTMLElement, b9: { z: number; x: number; y: number },
  z9: number, px9: number, py9: number, pitched9: boolean): number {
  const cv9 = root.querySelector<HTMLCanvasElement>(".scr-motion-fog");
  if (!cv9) return 0;
  const xf9 = xfDelta9(b9, z9, px9, py9);
  cv9.style.transformOrigin = "center";
  if (cv9.style.transform !== xf9) cv9.style.transform = xf9;
  const bw9 = root.clientWidth;
  const bh9 = root.clientHeight;
  if (!(b9.z > 0) || bw9 <= 0 || bh9 <= 0) { fogBandSet9(root, null); return 0; }
  const s9 = z9 / b9.z;
  const tx9 = px9 - s9 * b9.x;
  const ty9 = py9 - s9 * b9.y;
  const pdx9 = fogPad9(bw9);
  const pdy9 = fogPad9(bh9);
  const cx9 = bw9 / 2;
  const cy9 = bh9 / 2;
  const cov9 = {
    l: cx9 + s9 * (-pdx9 - cx9) + tx9,
    t: cy9 + s9 * (-pdy9 - cy9) + ty9,
    r: cx9 + s9 * (bw9 + pdx9 - cx9) + tx9,
    b: cy9 + s9 * (bh9 + pdy9 - cy9) + ty9,
  };
  fogBandSet9(root, pitched9 ? null : cov9);
  return Math.max(cov9.l, bw9 - cov9.r, cov9.t, bh9 - cov9.b);
}
/** 안 움직이는 막의 네 띠를 세운다(위 .scr-motion-fogbg의 ★) — `box`(안개 판이 덮는 네모, 상자 좌표)의
 *  **밖**을 채운다. null이면 넷 다 걷는다(틈 없음·눕힌 보기·손 뗌). 값이 그대로면 안 적는다. */
function fogBandSet9(root: HTMLElement, cov: { l: number; t: number; r: number; b: number } | null): void {
  const wrap9 = root.querySelector<HTMLElement>(".scr-motion-fogbg");
  if (!wrap9) return;
  const kid9 = wrap9.children;
  if (kid9.length < 4) return;
  const bw9 = root.clientWidth;
  const bh9 = root.clientHeight;
  const cl9 = (v9: number, hi9: number): number => Math.max(0, Math.min(hi9, v9));
  const L9 = cov ? cl9(cov.l, bw9) : 0;
  const T9 = cov ? cl9(cov.t, bh9) : 0;
  const R9 = cov ? cl9(cov.r, bw9) : bw9;
  const B9 = cov ? cl9(cov.b, bh9) : bh9;
  const put9 = (i9: number, x9: number, y9: number, w9: number, h9: number): void => {
    const el9 = kid9[i9];
    if (!(el9 instanceof HTMLElement)) return;
    const st9 = el9.style;
    // 넓이가 0이면 자리 값은 안 적는다 — 걷는 프레임마다 네 줄씩 적을 까닭이 없다.
    if (w9 <= 0.5 || h9 <= 0.5) { if (st9.width !== "0px") { st9.width = "0px"; st9.height = "0px"; } return; }
    const s9 = [`${x9.toFixed(1)}px`, `${y9.toFixed(1)}px`, `${w9.toFixed(1)}px`, `${h9.toFixed(1)}px`];
    if (st9.left !== s9[0]) st9.left = s9[0];
    if (st9.top !== s9[1]) st9.top = s9[1];
    if (st9.width !== s9[2]) st9.width = s9[2];
    if (st9.height !== s9[3]) st9.height = s9[3];
  };
  put9(0, 0, 0, bw9, T9);                 // 위
  put9(1, 0, B9, bw9, bh9 - B9);          // 아래
  put9(2, 0, T9, L9, B9 - T9);            // 왼
  put9(3, R9, T9, bw9 - R9, B9 - T9);     // 오른
}
/* (걷어냄) nukeClockTick9 — 핵 연출의 CSS 애니메이션에 붓 박자로 닻(animationDelay·재생멈춤)을
   내려 주던 자다. 그림이 캔버스로 오면서 연출이 **나이의 함수**가 되었으므로 맞춰 줄 시계가 없다:
   배속·일시정지·되감기가 그림 자체에 들어 있다. */

/** 매 장 — 유닛 op 수만 보고 단을 정한다(미달 기기에서만). deep이면 입체 판정(weak3·k3)을 쓴다. */
function crowdTick9(units: number, deep = false): void {
  const c = CROWD9;
  c.units = units;
  if (c.force >= 0) { c.lv = c.force; return; }
  const weak = deep ? c.weak3 : c.weak;
  const k = deep ? c.k3 : c.k;
  if (!weak) { c.lv = 0; return; }
  if (c.lv < 2 && units >= CROWD_UP9[c.lv] * k) c.lv += 1;
  else if (c.lv > 0 && units < CROWD_DOWN9[c.lv - 1] * k) c.lv -= 1;
}
/** 파편 수 배수 — 0단 1 · 1단 절반 · 2단 3분의 1. */
const crowdShardK9 = (): number => (CROWD9.lv >= 2 ? 0.34 : CROWD9.lv === 1 ? 0.5 : 1);
let SPRITE_BYTES_MAX = DEV9.spriteMB * 1024 * 1024;
/* ── 상한을 넘겨야 할 만큼 크게 그릴 때(지적: "확대시 건물들의 크기 비례가 깨지는
   현상. 크립 위치도 바뀜") ────────────────────────────────────────────────────────
   여태 그 경우 굽기가 null을 내고 호출부가 **직접 그리기**로 떨어졌다. 그 길은 같은
   그림이 아니다 — 굽는 쪽에만 있는 것이 셋이나 빠진다:
     ① 모델 공간 정규화(MODEL_NORM·BLD_NORM) — 종류마다 배수가 1.2~2.3으로 다르다.
        빠지면 건물끼리의 크기 비가 통째로 어긋난다. 이 지적의 '비례가 깨진다'가 이것이다.
     ② 그릴 때만 키우는 몫(drawK 1.2배).
     ③ 잉크 기준 자리 맞춤(발바닥 bot·가로중심 cx·데칼 가운데 inkCenter). 크립 얼룩은
        inkCenter로 앉으므로 이 길에서는 자리가 바뀐다 — '크립 위치도 바뀜'이 이것이다.
   그래서 **떨어뜨리지 않는다**: 상한에 맞는 가장 큰 크기로 굽고, 호출부가 이미 갖고 있는
   잔차 배율(k = 그릴 크기 ÷ 구운 크기)로 늘려 찍는다. 아주 깊은 확대에서 조금 무를 뿐
   비율과 자리는 어느 배율에서도 같다.
   상한 셈은 굽기의 판 크기 식을 그대로 뒤집은 것이다 —
     유닛  판 한 변 l = pxq + 2·pad(=2),        장치 픽셀 = ceil(l·B)
     건물  판 한 변 l = sideQ + 2·(ceil(0.78·sideQ) + 2) ≤ 2.56·sideQ + 6 */
const unitBakeCap = (B: number): number =>
  Math.max(4, Math.floor(((SPRITE_SIDE_MAX - 1) / B - 4) / 2) * 2);
const bldBakeCap = (B: number): number =>
  Math.max(4, Math.floor((((SPRITE_SIDE_MAX - 1) / B - 6) / 2.56) / 2) * 2);
let BLD_SPRITE_BYTES_MAX = DEV9.bldSpriteMB * 1024 * 1024;
/* ★ 두 예산을 **한 주머니로 나눠 쓴다**(실기 진단: 12배 저그 기지에서 `유닛 49장
   21.3/21MB · 건물 3장 8.3/11MB` — 유닛은 예산에 못 박혀 쫓아내고 다시 굽는데 건물은
   2.7MB를 남기고 있었다) ────────────────────────────────────────────────────────────
   둘로 갈라 둔 것은 '건물 판이 유닛 판을 다 밀어내지 않게' 하려던 칸막이인데, 화면에
   무엇이 많은지는 자리마다 다르다 — 저그 본진은 일꾼이 스물이고 건물은 셋이다.
   합은 그대로 두고 칸막이만 무른다: 한쪽의 상한을 `합 − 상대가 지금 쓰는 몫`으로 잡고,
   제 몫의 4분의 1을 바닥으로 깐다(그래야 한쪽이 다른 쪽을 굶기지 못한다).
   **최악의 총량은 한 톨도 안 는다** — 두 상한을 동시에 채워도 합은 여전히 같다. */
/* ★ **지도층에서 던 몫을 여기서 받는다**(요청: "지도 여유분을 줄여 판 예산으로 돌린다")
   ─────────────────────────────────────────────────────────────────────────────────
   ReplayMapVector의 캔버스 면적 예산을 8 → 4Mpx로 내렸다(그쪽 ★ 주석: 화질은 안 잃고
   '끌 때의 여유분'만 준다). 아이폰 dpr 3 기준 그 한 장이 27.6 → 11.8MB이므로 약 16MB가
   빈다. 그중 14MB를 판 예산으로 옮긴다 — 남은 2MB는 어림의 여유다.
   **총 메모리는 안 는다**(오히려 2MB 준다). 판 쪽은 저그 12배에서 작업 집합이 예산을
   넘어 다시 굽기를 되풀이하던 자리라, 같은 총량 안에서 이쪽에 주는 편이 남는 장사다.
   ※ 짝이 되는 값은 ReplayMapVector의 areaCapRef다 — 한쪽만 고치면 총량이 어긋난다. */
const MAP_FREED_MB = DEV9.mapFreedMB;
const SPRITE_TOTAL_MAX = SPRITE_BYTES_MAX + BLD_SPRITE_BYTES_MAX
  + MAP_FREED_MB * 1024 * 1024;
/* ★ 몫에는 **바닥이 있어야 한다**(실기 계측: "판 유닛 58장 9.2MB · 건물 37장 36.6MB") ──
   여기 있던 식은 `max(제 몫의 4분의 1, 총량 − 상대가 쓴 만큼)`이었다. 곧 **먼저 자란
   쪽이 임자**가 되는 식이다: 건물은 판이 화면에 들어오는 순간 한 번에 굽히고 그 뒤로는
   안 바뀌므로 늘 먼저 자라고, 그렇게 46MB 가운데 36.6MB를 쥔 채 경기 내내 안 놓았다.
   정작 계속 갈리는 것은 유닛인데 남은 9MB로 살았다 — 그래서 시간바를 옮기거나 끌면
   유닛 판이 통째로 갈렸다(실기: 2초에 굽기 301장·버림 299장, 최악 프레임 212ms 중
   굽기 201ms). 시간이 지나면 괜찮아지는 것은 화면이 멎어 작업 집합이 9MB 안으로
   들어오기 때문이다.
   그래서 **상대가 안 쓰더라도 상대 몫만큼은 남겨 둔다** — 상대가 쓴 양을 상대의 바닥
   아래로는 안 본다. 그러면 두 몫이 총량에서 정확히 균형을 이룬다:
     유닛  = max(21.3, 46 − max(건물쓴양, 10.7)) → 건물이 아무리 커도 21.3MB는 남는다
     건물  = max(10.7, 46 − max(유닛쓴양, 21.3)) → 유닛이 바닥에 있어도 24.7MB까지
   합이 46MB에서 만나고, 남는 몫(지도에서 돌린 14MB)은 여전히 덜 쓰는 쪽이 가져간다. */
const budgetNow9 = (own: number, otherUsed: number, otherOwn: number): number =>
  Math.max(own, SPRITE_TOTAL_MAX - Math.max(otherUsed, otherOwn));
/* ★ **데칼**은 또렷함이 필요 없다 — 굽기 상한을 따로 낮춘다(지적: "모바일에서 저그 본진을
   볼 때 너무 끊긴다") ────────────────────────────────────────────────────────────────
   재 보니 크립 얼룩이 이 화면에서 가장 큰 판이다. 해처리 크립은 15타일이라 해처리 본체
   (4타일)의 **열네 배 넓이**이고, 굽기 상한(bldBakeCap)까지 그대로 커진다. 폰(390px·
   DPR 2) 기준 저그 본진 한 채(해처리1·콜로니2·일반건물5)의 얼룩만으로
     줌×3 1.0MB · 줌×6 3.8MB · 줌×12 **13.8MB**
   인데 폰의 건물 판 예산은 16MB다 — 맨 위 배율에서 얼룩 하나가 예산의 86%를 먹는다.
   거기에 건물 본체와 상대 진영까지 얹히면 예산을 넘겨 LRU가 **매 프레임 쫓아내고 다시
   굽는다**. 다시 굽는 값도 크다: 얼룩의 굽는 판은 한 변이 2.56배(여백 0.78)라 크립
   하나가 2296² = 530만 화소이고, contentBox가 그걸 통째로 훑는다. 여덟이면 4천만 화소다.
   저그 본진에서만 나는 까닭이 이것이다 — 크립 얼룩은 저그 건물만 낸다.
   그런데 얼룩은 **단색 한 겹**이다(색 하나·알파 하나). 화소를 아무리 늘려도 더 나올
   것이 없고, 늘려 찍는 길(아래 k = sidePx / sideQ)이 이미 있다. 그래서 이 갈래만
   상한을 낮춰 굽고 늘려 찍는다 — 가장자리가 조금 부드러워질 뿐이고, 크립 경계는 원래
   물결져 있어 오히려 결에 맞는다. 폰이 더 낮은 것은 화면이 작아 그 부드러움이 안
   보이기 때문이다. */
const DECAL_BAKE_MAX = DEV9.decalBakeMax;
/** ★ **한 박자 늦춰** 돌려줄 판들 — 지금 프레임이 손에 쥐고 있을지 모르는 것을 그 자리에서
 *  0으로 만들면 그 몸만 한 프레임 사라진다. 덜어낼 때 여기 담아 두고 **다음 그리기 첫머리**
 *  에 비운다(그때는 어느 op도 옛 판을 안 들고 있다). 늦춰 봐야 16ms라, 수거를 기다리는
 *  것과는 자릿수가 다르다. */
/** 보관함에 든 판의 그림 — 메인이 구운 캔버스이거나, 굽기 일꾼이 돌려준 ImageBitmap(아래 BAKEW9). drawImage는 둘 다 받는다. */
type PlateImg9 = HTMLCanvasElement | ImageBitmap;
const RELEASE_Q9: PlateImg9[] = [];
/** ★ **놓는 판을 곧장 버리지 않고 되쓴다**(실측: 초당 360장을 새로 만들고 있었다) ─────────────────
 *  이 판의 판(스프라이트·마스크)은 `cropToInk`가 새 캔버스에 옮겨 담아 만든다 — 곧 굽는 횟수만큼
 *  캔버스가 나고, 쫓겨난 판의 캔버스는 크기 0으로 놓여 사라진다. 그런데 나는 크기와 죽는 크기는
 *  대개 **같은 몇 가지**다(같은 종류·같은 배율의 판이 방향만 달리 다시 구워지므로).
 *  그래서 놓을 때 버리지 말고 크기별로 몇 장 두었다가, 다음에 같은 크기를 찾으면 그것을 준다.
 *  배킹이 새로 나고 죽는 일이 없어지므로 회전이 곧 0에 가까워진다. 창고는 장수·바이트로 죈다. */
const CVSTORE9 = { list: [] as HTMLCanvasElement[], bytes: 0, hit: 0, miss: 0, put: 0 };
const CVSTORE_MAX9 = 24;
const CVSTORE_BYTES9 = 6 * 1024 * 1024;
/** 그 크기의 판을 창고에서 꺼낸다(없으면 null) — 꺼낸 판은 비워서 준다. */
function takeStored9(w9: number, h9: number): HTMLCanvasElement | null {
  const i9 = CVSTORE9.list.findIndex((c9) => c9.width === w9 && c9.height === h9);
  if (i9 < 0) { CVSTORE9.miss += 1; return null; }
  CVSTORE9.hit += 1;
  const [cv9] = CVSTORE9.list.splice(i9, 1);
  CVSTORE9.bytes -= w9 * h9 * 4;
  const c9 = cv9.getContext("2d");
  if (!c9) return null;
  c9.setTransform(1, 0, 0, 1, 0, 0);
  c9.clearRect(0, 0, w9, h9);
  return cv9;
}
/** 판을 창고에 둔다 — 자리가 없거나 너무 크면 그냥 놓는다. */
function storeCanvas9(cv9: PlateImg9): void {
  // ImageBitmap(일꾼 판)은 창고에 못 둔다 — 그 자리에서 놓는다(close가 GPU/공유 메모리를 곧장 돌려준다).
  if (!(cv9 instanceof HTMLCanvasElement)) { cv9.close(); return; }
  const by9 = cv9.width * cv9.height * 4;
  if (cv9.width < 2 || by9 > CVSTORE_BYTES9 / 2
    || CVSTORE9.list.length >= CVSTORE_MAX9 || CVSTORE9.bytes + by9 > CVSTORE_BYTES9) {
    releaseCanvas(cv9);
    return;
  }
  CVSTORE9.list.push(cv9);
  CVSTORE9.bytes += by9;
  CVSTORE9.put += 1;
}
/** 미뤄 둔 판들을 실제로 놓는다 — 그리기 한 판의 첫머리에서 부른다(되쓰기 창고로 간다). */
function flushReleased9(): void {
  for (let i = 0; i < RELEASE_Q9.length; i += 1) storeCanvas9(RELEASE_Q9[i]);
  RELEASE_Q9.length = 0;
}
/** 두 보관함을 **함께** 죈다 — 한쪽이 자라면 상대의 몫이 그만큼 줄어드는 식이므로
 *  (위 budgetNow9), 자란 쪽만 죄면 합이 총량을 넘긴 채로 한동안 남는다. */
function trimBoth9(): void {
  trimSpriteCache(SPRITE_CACHE, spriteBytes,
    budgetNow9(SPRITE_BYTES_MAX, bldSpriteBytes.n, BLD_SPRITE_BYTES_MAX));
  trimSpriteCache(BLD_SPRITE_CACHE, bldSpriteBytes,
    budgetNow9(BLD_SPRITE_BYTES_MAX, spriteBytes.n, SPRITE_BYTES_MAX), true);
}
/** 예산을 넘는 동안 가장 오래 안 쓴 것부터 덜어낸다. */
function trimSpriteCache<T extends { cv: PlateImg9; sh?: ShadowPlate | null; tint?: TintPlate9 | null }>(
  cache: Map<string, T>, bytes: { n: number }, budget: number, bld = false,
): void {
  while (bytes.n > budget && cache.size > 1) {
    // 쫓아낸 장수를 센다 — 다시 굽는 값의 **원인이 압박인지**를 가르는 수다.
    if (bld) SPRITE_PERF.bldEvict += 1; else SPRITE_PERF.evict += 1;
    const oldest = cache.keys().next();
    if (oldest.done) break;
    const got = cache.get(oldest.value);
    // 그림자 판은 몸 판에 매달려 같은 수명을 산다 — 걷을 때 함께 뺀다(아래 shadowPlate).
    if (got) {
      bytes.n -= canvasBytes(got.cv) + (got.sh ? canvasBytes(got.sh.cv) : 0) + (got.tint ? canvasBytes(got.tint.cv) : 0);
      RELEASE_Q9.push(got.cv);
      if (got.sh) RELEASE_Q9.push(got.sh.cv);
      if (got.tint) { RELEASE_Q9.push(got.tint.cv); bytes.n -= releaseTints9(got.tint); }
    }
    cache.delete(oldest.value);
    /* ★ 예산이 넘쳐 **덜어내고 있다는 것**이 곧 압박의 신호다 — 그럴 때는 굽는 판
       빌림터도 함께 놓는다(같은 지적: 사파리가 탭을 버린다). 빌림터는 '다시 굽기를
       싸게'가 목적이지 '메모리를 쥐고 있기'가 아니므로, 예산을 다투는 순간에는 내주는
       편이 옳다. 압박이 가시면 다음 굽기가 다시 채운다. */
    for (const c9 of BAKE_POOL) releaseCanvas(c9);
    BAKE_POOL.length = 0;
  }
}
/** 판에 **구워 두는** 겹침 그림자 — 그리기마다 돌리던 흐림을 굽기 한 번으로 옮긴다. */
type ShadowPlate = {
  cv: HTMLCanvasElement; pad: number;
  /** 찍을 때의 크기(CSS px) — 판을 낮은 해상도로 구우므로 캔버스 화소 수와 다르다. */
  w: number; h: number;
};
/** 그림자 판을 구울 목표 한 변(기기 px) — 이보다 커지면 그만큼 낮춰 굽는다(아래 ★). */
const SHADOW_BAKE_SIDE9 = 320;
/* ★ 흐림은 **판마다 한 번**이면 된다(지시: "1로 가야지 모바일에서도 적용할 수 있잖아")
   ────────────────────────────────────────────────────────────────────────────────
   여태는 그릴 때마다 캔버스 shadowBlur를 돌렸다 — 유닛 하나당 한 번, 프레임마다. 이
   화면에서 가장 비싼 자였다(실측 3배: 붓:유닛캔버스 0.31 → 5.24ms, 최악 프레임 50ms
   가운데 34.8ms가 이 붓 하나). 그래서 문턱을 깊은 칸에 두고 낮은 배율에서는 아예 껐다.
   그런데 몸 판은 종류·각도·크기·자세별로 이미 굽고 캐시한다. 그 판의 그림자도 같은
   수명으로 함께 구워 두면, 프레임에 남는 일은 **그림 하나를 더 찍는 것(blit)** 뿐이다 —
   흐림 삯이 프레임에서 통째로 사라지고, 그러면 1배에서도(곧 폰에서도) 켤 수 있다.
   ★ 몸 판은 **한 톨도 안 건드린다** — 잉크 상자(bot·cx·w)가 그림자를 세어 버리면
     발자리·체력바·링·트레이서 앵커가 통째로 어긋난다(이 파일이 여러 번 데인 자리다).
     그래서 그림자는 제 판을 따로 갖고, 몸 판의 자·자르기·앵커는 그대로다.
   ★ 몸은 캔버스 **밖으로 밀어 놓고 그림자만 받는다**(shadowOffsetX = 판 폭) — 안 그러면
     까만 몸이 함께 찍힌다. 캔버스의 고전 수법이다.
   ★ 흐림 반지름은 **구운 크기(판 좌표)로** 잡는다 — 판은 그릴 때 k배로 늘어나므로
     그 안의 흐림도 같이 늘어, 화면에서는 예전의 `화면크기 × 몫`과 같은 값이 된다. */
function shadowPlate(
  host: { cv: PlateImg9; sh?: ShadowPlate | null },
  blurQ: number, alpha: number, B: number, bytes: { n: number },
): ShadowPlate | null {
  if (host.sh !== undefined) return host.sh;   // null이면 '못 굽는 판'이라 다시 안 굽는다
  const bd = Math.max(1, Math.ceil(blurQ * B * 2));
  const w9 = host.cv.width + bd * 2;
  const h9 = host.cv.height + bd * 2;
  if (w9 > SPRITE_SIDE_MAX || h9 > SPRITE_SIDE_MAX) { host.sh = null; return null; }
  const pSh9 = PERF9 ? pNow() : 0;
  /* ★ 그림자는 **낮은 해상도로 굽는다**(실기 계측: 12배·dpr 3에서 유닛 판 한 장이
     3.05MB인데 몸은 0.4MB뿐이었다 — 나머지 2.6MB가 이 판이다) ────────────────────
     흐림 반지름이 그리는 크기에 비례하므로(공중 pxq×0.16), 12배에서 반지름이 110
     기기픽셀이 된다. 그러면 이 판은 몸 판 사방으로 220px씩 자라 **넓이가 몸의 여섯
     배**가 된다. 그 탓에 예산 24MB에 판이 여덟 장밖에 안 들어갔고, 뮤탈 여덟 마리가
     날갯짓으로 자세를 바꿀 때마다 여덟 장이 통째로 갈려 나갔다 — 실기에서 2초에
     463장을 굽고 483장을 버렸다(굽기 1371ms, 최악 프레임의 91%).
     그런데 이 판은 **흐린 얼룩**이다. 반지름 110px로 뭉갠 그림에는 화소 눈금이 남아
     있지 않으므로, 3분의 1로 굽고 세 배로 늘려 찍어도 눈에 드는 차이가 없다(늘리는
     쪽의 겹선형 보간이 흐림과 같은 일을 한다). 몸 판은 한 톨도 안 건드린다 — 거기는
     화소 눈금이 곧 그림이다.
     값: 그림자 판이 9분의 1로 줄어 판 한 장이 3.05MB → 0.7MB가 된다. 같은 예산에
     여덟 장이 아니라 서른 장 넘게 들어가므로 날갯짓 한 바퀴가 통째로 캐시에 남고,
     굽기가 멈춘다. 흐림 자체도 넓이·반지름이 함께 줄어 훨씬 싸진다.
     ★ 흐림이 캔버스 화소로 8보다 얇아지지는 않게 막는다 — 그 아래로 내려가면 늘려
       찍을 때 얼룩의 테가 계단으로 읽힌다. 작은 판(낮은 배율)은 ds가 1이라 예전 그대로다. */
  const ds = Math.max(1, Math.min(
    Math.ceil(Math.max(w9, h9) / SHADOW_BAKE_SIDE9),
    Math.max(1, Math.floor((blurQ * B) / 8)),
  ));
  const cw9 = Math.max(1, Math.ceil(w9 / ds));
  const ch9 = Math.max(1, Math.ceil(h9 / ds));
  const cv = newCanvas9("그림자");
  cv.width = cw9;
  cv.height = ch9;
  const c9 = cv.getContext("2d");
  if (!c9) { host.sh = null; return null; }
  c9.shadowColor = `rgba(0, 0, 0, ${alpha})`;
  c9.shadowBlur = (blurQ * B) / ds;
  c9.shadowOffsetX = cw9;
  c9.drawImage(host.cv, bd / ds - cw9, bd / ds, host.cv.width / ds, host.cv.height / ds);
  const out = { cv, pad: bd / B, w: (cw9 * ds) / B, h: (ch9 * ds) / B };
  host.sh = out;
  bytes.n += canvasBytes(cv);
  /* 그림자 굽기도 따로 센다 — 이 판이 굽기 봉우리를 얼마나 키웠는지가 곧 이 줄이다. */
  if (PERF9) pAdd("굽기:그림자", pNow() - pSh9);
  return out;
}
/* ── 굽기 계측(요청: "추측 금지, 계측부터. … 프레임당 굽는 횟수(캐시 적중률)와
   `drawImage` 수를 찍어 원인을 확정한 뒤 고친다") ─────────────────────────────────
   8인전 버벅임의 범인을 **재서** 잡기 위한 자다. 세 수가 답을 가른다:
     · bake  — 이 프레임에 **새로 구운** 판 수. 이것이 크면 캐시가 안 맞는 것이다.
     · hit   — 캐시에서 찾아 쓴 수. bake/(bake+hit)이 곧 빗나감 비율이다.
     · blit  — drawImage 호출 수. 이것이 크면 그리는 양 자체가 문제다.
   둘을 갈라 재는 까닭: 같은 40fps라도 'bake 200 · blit 400'과 'bake 0 · blit 4000'은
   고칠 자리가 전혀 다르다. 앞엣것은 캐시 열쇠, 뒤엣것은 그리는 수를 줄여야 한다.

   ★ 열쇠에 무엇이 들어 있나(이 계측이 겨눈 자리) — unitSprite의 캐시 열쇠는
     `kind|rot|flat|vq|pitch|color|pxq|B|lod`이고, 그중 **color가 임자 색**이다.
     색 없는 면(개인색 자리)이 구울 때 이미 칠해져 굽히므로 열쇠에 들어갈 수밖에
     없는데, 그 대가로 **임자가 늘면 같은 유닛의 판이 임자 수만큼 갈린다**. 8인전이면
     같은 마린이 최대 여덟 벌이다.
   ★ 계측이 낸 답과 고친 자리 — scripts/sprite-check.mjs로 재니 그 곱셈이 예산을
     정확히 어디서 넘기는지가 나왔다: 1인 37.7MB(예산 96MB의 39%) · 3인 118% ·
     8인 301.9MB(314%). 3인부터 넘고 8인이면 세 배라, LRU가 매 프레임 쫓아내고 다시
     굽는다 — 그것이 버벅임의 얼개였다.
     고친 것은 **열쇠가 아니라 판의 크기**다(cropToInk). 열쇠에서 색을 빼려면 굽는
     판을 색과 무관하게 만들어야 하는데, 개인색 면과 고정색 면이 화가 순서로 서로
     겹쳐 있어 층을 둘로 가르면 가림 순서가 깨진다. 대신 **판의 빈 자리를 없앴다**:
     굽는 판은 16 모델 단위 정사각인데 잉크는 5.2뿐이라 넓이의 8/9가 투명이었다.
     잘라 낸 뒤 같은 자로 다시 재니 8인 301.9MB → **42.3MB(44%)**, 7.1배다.
     예산 안으로 들어왔으니 쫓아내기가 멈춘다. 그림은 한 톨도 안 바뀐다.
   읽는 법 — 개발자 콘솔에서 `__spritePerf.last`를 보거나, 한 줄 요약은
     `__spritePerf.line()`. 값은 프레임마다 롤링되고 `last`는 직전 한 판의 합이다. */
/* ★ **굽는 값을 시간으로 잰다**(지적: "판 용량 문제가 아닌 거 같고" → "저그 건물 또는
   유닛 굽기에 시간이 오래 걸려서 버벅이는 건지") ───────────────────────────────────
   여태 이 계측판이 센 것은 **횟수**뿐이었다. 그런데 횟수는 값이 아니다 — 종류마다
   한 장의 값이 다르다. 계측(sprite-check --dpr 3, 다섯 크기 합)으로 저그 건물은
   하이브 4.6ms · 레어 4.1ms · 익스트랙터 4.0ms인데 견줘 테란·프로토스 건물은
   엔베 0.9ms · 포지 0.7ms · 팩토리 0.3ms다 — 대여섯 배에서 열몇 배다.
   ★ 다만 **절대값은 작다**(한 크기당 1~2ms). 그러니 이 값만으로는 12배 저그 기지의
     버벅임이 설명되지 않는다 — 굽기가 범인이라면 장수가 아주 많아야 한다. 그 '아주
     많은가'를 눈으로 확인할 수단이 여태 없었다. 그래서 세 가지를 더 센다:
     · 굽는 **시간**(ms)과 그중 **가장 비쌌던 한 장의 이름** — 범인을 이름으로 짚는다.
     · **버린 장수**(예산이 넘쳐 LRU가 쫓아낸 것) — 다시 굽기의 원인이 압박인지 아닌지.
     · **미룬 장수**(프레임 굽기 예산이 다해 대타로 때운 것) — 밀린 일이 얼마나 쌓였나.
   그리고 이 값들을 **2초 창**으로 모은다 — 프레임 값은 폰 화면에서 눈으로 못 읽는다.
   스크린샷 한 장에 '지난 2초 동안 무엇이 얼마나 구워졌나'가 남아야 판정이 된다. */
export const SPRITE_PERF = {
  /** 이번 프레임 누적 — 프레임 경계(perfFrame)에서 last로 넘기고 0으로 되돌린다. */
  bake: 0, hit: 0, blit: 0, direct: 0,
  bldBake: 0, bldHit: 0, bldBlit: 0,
  /** 이번 프레임에 실제로 **굽는 데 쓴 시간**(ms) — 유닛·건물 따로. */
  bakeMs: 0, bldBakeMs: 0,
  /** 예산이 넘쳐 쫓아낸 장수 · 프레임 굽기 예산이 다해 대타로 때운 장수. */
  evict: 0, bldEvict: 0, defer: 0, bldDefer: 0,
  /** 2초 창 — 폰에서 눈으로 읽을 수 있는 눈금(아래 winRoll). */
  /* ★ **버벅인 그 프레임이 굽기였나** — 이 한 쌍이 답을 가른다. 가장 오래 걸린 프레임의
     길이(worstFrame)와 **그 프레임 안에서 굽는 데 쓴 시간**(worstFrameBake)을 같이
     남긴다. 300ms 프레임의 굽기가 5ms였다면 범인은 굽기가 아니다 — 그 경우 더 이상
     판 쪽을 파지 않는다. 반대로 둘이 붙어 있으면 굽기가 맞다. */
  w: {
    t0: 0, frames: 0, bake: 0, bldBake: 0, ms: 0, bldMs: 0,
    evict: 0, bldEvict: 0, defer: 0, bldDefer: 0, worst: 0, worstKind: "",
    worstFrame: 0, worstFrameBake: 0, blit: 0,
  },
  /* ★ **화면이 지금 쥐고 있는 캔버스 전부**(지적: "스샷 찍다가 탭 터지기까지 함") ──────
     판 보관함은 이미 재고 있지만(41/46MB) 그것은 **한 층**일 뿐이다. 화면에는 지도
     배킹(1713² ≈ 11.7MB) · 유닛(1179² ≈ 5.6MB) · 안개 · 미니맵 · 굽는 빌림터가 더
     있고, 이들은 서로 다른 파일에 흩어져 있어 합계를 볼 길이 여태 없었다. 사파리가
     탭을 버리는 것은 **그 합**이 정하는데, 우리는 그 수를 한 번도 본 적이 없다.
     그래서 문서의 <canvas>를 통째로 훑어 폭×높이×4를 더한다 — 어느 파일이 만들었든,
     내가 모르는 층이 있어도 잡힌다. 2초에 한 번이라 삯이 없다.
     ★ 보관함의 판은 문서에 안 붙어 있다(오프스크린) — 그래서 이 값과 판 줄은 **서로
       다른 것을 세며, 더해야 전체가 된다.** DOM 마커 수도 같이 센다: 유닛 천 개가
       스팬으로 서 있으면 그 자체가 무시 못 할 몫이다. */
  dom: { canvases: 0, canvasMB: 0, markers: 0, list: "", view: "" },
  scanDom(): void {
    if (typeof document === "undefined") return;
    let n9 = 0;
    let b9 = 0;
    /* 큰 것부터 이름과 함께 적는다 — 합계만으로는 **어느 층을 줄여야 하는지**를 못
       가른다. 이름은 클래스의 마지막 마디를 쓴다(scr-motion-unitlayer → unitlayer). */
    const each9: { n: string; mb: number }[] = [];
    for (const c9 of Array.from(document.getElementsByTagName("canvas"))) {
      n9 += 1;
      const mb9 = (c9.width * c9.height * 4) / 1048576;
      b9 += mb9 * 1048576;
      const cls9 = (c9.className || "").split(/\s+/).filter(Boolean);
      const nm9 = (cls9[cls9.length - 1] || c9.parentElement?.className || "?")
        .split(/\s+/).pop()?.replace(/^scr-(motion-|map-)?/, "") || "?";
      each9.push({ n: `${nm9} ${c9.width}×${c9.height}`, mb: mb9 });
    }
    each9.sort((x9, y9) => y9.mb - x9.mb);
    SPRITE_PERF.dom = {
      canvases: n9,
      canvasMB: b9 / 1048576,
      list: each9.slice(0, 4).map((e9) => `${e9.n} ${e9.mb.toFixed(1)}MB`).join(" · "),
      /* ★ **캔버스가 실제로 보이는 만큼인가**(지적: 전체화면에서 상자가 406 → 695css) ──
         평소 배치에서는 지도 상자가 화면 폭과 같은데, 전체화면에서는 695가 된다. 화면이
         그보다 좁으면 그 차이만큼은 **영영 안 보이는 화소**다 — 캔버스는 그만큼 크게
         잡히고(넓이는 제곱으로) 그리는 삯도 거기 다 붙는다.
         그래서 셋을 나란히 적는다: 상자가 CSS로 몇인지 · 화면에 실제로 몇으로 놓였는지
         (getBoundingClientRect는 변환·잘림 뒤의 값이다) · 그리고 보는 창이 몇인지.
         셋이 같으면 낭비가 없고, 상자가 창보다 크면 그 몫이 곧 버리는 화소다. */
      view: ((): string => {
        const box9 = document.querySelector(".scr-motion-map") as HTMLElement | null;
        const r9 = box9?.getBoundingClientRect();
        const vv9 = (window as unknown as { visualViewport?: { width: number; height: number } })
          .visualViewport;
        return box9 && r9
          ? `상자 ${box9.clientWidth}×${box9.clientHeight}`
            + ` · 놓인자리 ${Math.round(r9.width)}×${Math.round(r9.height)}`
            + ` · 창 ${Math.round(vv9?.width ?? window.innerWidth)}`
            + `×${Math.round(vv9?.height ?? window.innerHeight)}`
          : "";
      })(),
      /* 마커는 **지도 칸 안의 모든 마디**로 센다 — 유닛은 이제 캔버스에 그리므로 종류별
         클래스를 짚으면 놓친다(실제로 scr-motion-army는 효과 스팬 둘뿐이다). 무엇이 몇
         개 서 있든 이 수가 곧 DOM 무게다. */
      markers: document.querySelectorAll(".scr-motion-frame *").length,
    };
  },
  wLast: {
    secs: 0, frames: 0, bake: 0, bldBake: 0, ms: 0, bldMs: 0,
    evict: 0, bldEvict: 0, defer: 0, bldDefer: 0, worst: 0, worstKind: "",
    worstFrame: 0, worstFrameBake: 0, blit: 0,
  },
  /** 한 장을 굽고 나서 부른다 — 창에 값과 '가장 비쌌던 한 장'을 남긴다. */
  noteBake(kind: string, ms: number, bld: boolean): void {
    const p = SPRITE_PERF;
    if (bld) { p.bldBakeMs += ms; p.w.bldMs += ms; } else { p.bakeMs += ms; p.w.ms += ms; }
    if (ms > p.w.worst) { p.w.worst = ms; p.w.worstKind = kind; }
  },
  /** 직전 프레임의 값. */
  last: {
    bake: 0, hit: 0, blit: 0, direct: 0, bldBake: 0, bldHit: 0, bldBlit: 0, ms: 0,
    keys: 0, bytes: 0, bldKeys: 0, bldBytes: 0, colors: 0,
    /** 직전 프레임이 **굽는 데** 쓴 시간 — 재생 틱이 이것으로 '굽는 중'을 안다. */
    bakeMs: 0,
  },
  /** 이번 판에서 본 임자 색의 가짓수 — 열쇠가 색으로 갈리는 몫을 직접 센다. */
  colorSet: new Set<string>(),
  /** 2초마다 창을 닫아 wLast로 넘긴다 — 프레임 경계(perfFrame)에서 부른다. */
  winRoll(now: number): void {
    const p = SPRITE_PERF;
    const w = p.w;
    if (w.t0 === 0) { w.t0 = now; return; }
    if (now - w.t0 < 2000) return;
    p.wLast = {
      secs: (now - w.t0) / 1000, frames: w.frames, bake: w.bake, bldBake: w.bldBake,
      ms: w.ms, bldMs: w.bldMs, evict: w.evict, bldEvict: w.bldEvict,
      defer: w.defer, bldDefer: w.bldDefer, worst: w.worst, worstKind: w.worstKind,
      worstFrame: w.worstFrame, worstFrameBake: w.worstFrameBake, blit: w.blit,
    };
    SPRITE_PERF.scanDom();
    /* 훑기 시간도 같은 창으로 돌린다 — 마지막 창 값을 남기고 다음 창을 0에서 다시 센다. */
    SCAN_MS9.last = SCAN_MS9.win;
    SCAN_MS9.win = 0;
    w.t0 = now; w.frames = 0; w.bake = 0; w.bldBake = 0; w.ms = 0; w.bldMs = 0;
    w.evict = 0; w.bldEvict = 0; w.defer = 0; w.bldDefer = 0; w.worst = 0; w.worstKind = "";
    w.worstFrame = 0; w.worstFrameBake = 0; w.blit = 0;
  },
  line(): string {
    const l = SPRITE_PERF.last;
    const tot = l.bake + l.hit;
    const miss = tot ? ((l.bake / tot) * 100).toFixed(1) : "0.0";
    return `[sprite] ${l.ms.toFixed(1)}ms · 유닛 굽기 ${l.bake}/${tot}(빗나감 ${miss}%)`
      + ` blit ${l.blit} 직접 ${l.direct} · 건물 굽기 ${l.bldBake}/${l.bldBake + l.bldHit}`
      + ` blit ${l.bldBlit} · 보관 유닛 ${l.keys}판 ${(l.bytes / 1048576).toFixed(1)}MB`
      + ` 건물 ${l.bldKeys}판 ${(l.bldBytes / 1048576).toFixed(1)}MB · 임자색 ${l.colors}가지`
      + `\n[굽기 ${SPRITE_PERF.wLast.secs.toFixed(1)}초 창] 유닛 ${SPRITE_PERF.wLast.bake}장`
      + ` ${SPRITE_PERF.wLast.ms.toFixed(0)}ms · 건물 ${SPRITE_PERF.wLast.bldBake}장`
      + ` ${SPRITE_PERF.wLast.bldMs.toFixed(0)}ms · 버림 U${SPRITE_PERF.wLast.evict}`
      + `/B${SPRITE_PERF.wLast.bldEvict} · 미룸 U${SPRITE_PERF.wLast.defer}`
      + ` · 찍기 ${SPRITE_PERF.wLast.frames
        ? Math.round(SPRITE_PERF.wLast.blit / SPRITE_PERF.wLast.frames) : 0}장/프레임`
      + `/B${SPRITE_PERF.wLast.bldDefer} · 최악판 ${SPRITE_PERF.wLast.worstKind}`
      + ` ${SPRITE_PERF.wLast.worst.toFixed(0)}ms · 최악프레임`
      + ` ${SPRITE_PERF.wLast.worstFrame.toFixed(0)}ms(굽기`
      + ` ${SPRITE_PERF.wLast.worstFrameBake.toFixed(0)}ms)`
      + `\n[메모리] 캔버스 ${SPRITE_PERF.dom.canvases}장`
      + ` ${SPRITE_PERF.dom.canvasMB.toFixed(1)}MB + 판`
      + ` ${((l.bytes + l.bldBytes) / 1048576).toFixed(1)}MB = `
      + `${(SPRITE_PERF.dom.canvasMB + (l.bytes + l.bldBytes) / 1048576).toFixed(1)}MB`
      + ` · 마커 ${SPRITE_PERF.dom.markers}개\n           ${SPRITE_PERF.dom.list}`
      + `\n           ${SPRITE_PERF.dom.view}`;
  },
};
/* 콘솔에서 바로 읽을 수 있게 창에 매단다 — 계측기는 켜고 끄는 것이 아니라 늘 도는
   수 세기(정수 증가 몇 번)라 비용이 없다. 읽는 쪽만 있으면 된다:
     __spritePerf.line()   한 줄 요약
     __spritePerf.last     직전 프레임의 원값
   8인전에서 이 줄을 두어 번 찍어 두면, 빗나감 비율과 임자색 가짓수가 함께 오르는지
   (= 열쇠가 색으로 갈리는 것이 범인인지)가 바로 보인다. */
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__spritePerf = SPRITE_PERF;
  /* ★ **무엇이 예산을 먹나** — 열쇠별 무게를 무거운 차례로 준다(지적: "유독 저그 쪽만
     더 심해"). 합계만으로는 '어느 종류가' 먹는지 못 가른다: 같은 16MB라도 종류 하나가
     각도 열여섯 벌로 갈려 먹는 것과 종류 마흔이 한 벌씩 먹는 것은 고칠 자리가 다르다.
     콘솔에서 `__spriteTop()` 한 줄이면 그 갈림이 나온다(기본은 건물, "u"를 주면 유닛). */
  (window as unknown as Record<string, unknown>).__spriteTop = (
    which = "b", n = 14,
  ): string => {
    const cache = which === "u" ? SPRITE_CACHE : BLD_SPRITE_CACHE;
    const byKind = new Map<string, { n: number; b: number }>();
    let tot = 0;
    for (const [k9, v9] of cache) {
      const kind9 = k9.slice(0, k9.indexOf("|"));
      const sh9 = (v9 as { sh?: { cv: HTMLCanvasElement } | null }).sh;
      const b9 = canvasBytes(v9.cv) + (sh9 ? canvasBytes(sh9.cv) : 0);
      tot += b9;
      const got9 = byKind.get(kind9);
      if (got9) { got9.n += 1; got9.b += b9; } else byKind.set(kind9, { n: 1, b: b9 });
    }
    return [`합 ${(tot / 1048576).toFixed(1)}MB · ${cache.size}장`,
      ...[...byKind.entries()].sort((x9, y9) => y9[1].b - x9[1].b).slice(0, n)
        .map(([k9, v9]) => `${k9} ${v9.n}장 ${(v9.b / 1048576).toFixed(2)}MB`)].join("\n");
  };
}
/** 프레임 하나가 끝났다 — 이번 프레임 값을 last로 넘기고 0으로 되돌린다. */
function perfFrame(ms: number): void {
  const p = SPRITE_PERF;
  p.last = {
    bake: p.bake, hit: p.hit, blit: p.blit, direct: p.direct,
    bldBake: p.bldBake, bldHit: p.bldHit, bldBlit: p.bldBlit, ms,
    bakeMs: p.bakeMs + p.bldBakeMs,
    keys: SPRITE_CACHE.size, bytes: spriteBytes.n,
    bldKeys: BLD_SPRITE_CACHE.size, bldBytes: bldSpriteBytes.n,
    colors: p.colorSet.size,
  };
  // 가장 긴 프레임과 **그 프레임의 굽기 몫**을 함께 남긴다(위 ★).
  if (ms > p.w.worstFrame) { p.w.worstFrame = ms; p.w.worstFrameBake = p.bakeMs + p.bldBakeMs; }
  p.w.frames += 1;
  /* ★ **그리는 장수**도 센다 — 낮은 배율(1·2배)에서는 굽기가 0인데도 프레임이 밀린다.
     거기서 값을 정하는 것은 굽기가 아니라 **프레임마다 찍는 drawImage 수**다(실측: 2배에서
     유닛 blit 661장). 프레임당 평균으로 보면 '유닛이 몇이라 몇 장을 찍고 있나'가 바로 읽힌다. */
  p.w.blit += p.blit + p.bldBlit;
  p.w.bake += p.bake; p.w.bldBake += p.bldBake;
  p.w.evict += p.evict; p.w.bldEvict += p.bldEvict;
  p.w.defer += p.defer; p.w.bldDefer += p.bldDefer;
  p.winRoll(typeof performance !== "undefined" ? performance.now() : Date.now());
  p.bake = 0; p.hit = 0; p.blit = 0; p.direct = 0;
  p.bldBake = 0; p.bldHit = 0; p.bldBlit = 0;
  p.bakeMs = 0; p.bldBakeMs = 0;
  SCAN_MS9.frame = 0;
  p.evict = 0; p.bldEvict = 0; p.defer = 0; p.bldDefer = 0;
  /* 굽기 예산도 프레임마다 되돌린다(위 UNIT_BAKE_PER_FRAME·BLD_BAKE_PER_FRAME).
     ★ **채우는 동안에는 예산을 늘린다**(지적: "재생되기까지 오래 걸려") ─────────────────
       평소 예산(폰: 프레임당 유닛 1장·건물 1장·8ms)은 **부드러운 재생을 지키려고** 잡은
       값이다. 그런데 처음 들어와 화면을 채우는 동안에는 지킬 부드러움이 아직 없다 —
       그 예산으로 천 장을 구우면 프레임당 한 장씩, 곧 분 단위다(실측: 미룸 U878/B226).
       미뤄 둔 것이 많으면 그만큼 예산을 키운다: 덜컥임을 **진행으로 바꾸는** 것이 그
       구간에서는 이득이다. 줄이 빠지면 저절로 평소 예산으로 돌아온다(sprint9가 0이 된다).
       손짓 중에는 안 키운다 — 그때는 손끝을 따라가는 것이 유일한 일이다(gestBake9). */
  const q9 = p.w.defer + p.w.bldDefer;
  bakeSprint9.v = gestBake9.v ? 1 : q9 > 400 ? 6 : q9 > 120 ? 3 : 1;
  unitBakeLeft9 = UNIT_BAKE_PER_FRAME * bakeSprint9.v;
  bldBakeLeft9 = BLD_BAKE_PER_FRAME * bakeSprint9.v;
  smallBakeLeft9 = SMALL_BAKE_PER_FRAME9 * bakeSprint9.v;   // 작게 굽기도 장수로 죈다(위 ★)
  smallBldLeft9 = SMALL_BAKE_PER_FRAME9 * bakeSprint9.v;
  /* 되돌린 예산을 **먼저 미룬 것들에 쓴다**(위 BAKE_WANT9의 ★) — 이 자리는 프레임이 열리는
     자리다(tick 맨 앞에서 부른다). 여기서 쓴 몫은 이 프레임의 굽기로 그대로 잡힌다. */
  drainBakeWant9();
}
const SPRITE_CACHE = new Map<string, UnitPlate9>();
const spriteBytes = { n: 0 };
/* ★ 한 프레임에 굽는 판의 **수를 죈다**(지적: "저그 본진은 6배까지 괜찮다가 12배 줌하면
   버벅임이 보여") ────────────────────────────────────────────────────────────────────
   계측(perf-check --zoom 6 / 12, 폰 390px): 배율 6에서는 판 하나가 102KB인데 12에서는
   **377KB**다(한 변 307기기픽셀 — 판의 무게는 배율의 제곱을 탄다). 보관 총량은 12.8MB로
   예산(32MB) 안이라 **쫓겨나서 나는 일이 아니고**, 빗나감도 12.5%에 지나지 않는다.
   문제는 낱개의 값이다: 그 크기 한 장을 굽는 데 10ms가 든다(헤드리스 기준). 중급 폰은
   그 네 배라 **한 장이 한 프레임을 통째로 먹는다** — 유닛이 돌아 새 방위 칸에 들어설
   때마다 한 번씩 덜컥인다. 6배에서 안 그러던 까닭도 같다(장당 값이 4분의 1이다).
   고치는 길은 셋인데 둘은 값을 치른다: 굽는 크기를 죄면 흐려지고(앞서 지적받은 그
   블러다), 그냥 안 그리면 한 프레임 깜빡인다. 세 번째가 값이 없다 — **미루는 것**이다.
   한 프레임에 굽는 수를 죄고, 예산이 다한 자리에서는 같은 모델의 **다른 크기로 이미
   구워 둔 판**을 늘려(줄여) 찍는다. 한두 프레임 살짝 무를 뿐 곧 제 크기로 갈아 끼워지고,
   덜컥임은 사라진다. 그래서 '가까운 크기'를 찾을 색인이 하나 필요하다(SPRITE_SIZES). */
/* ★ 대타는 **큰 판을 먼저 고른다**(지적: "12배 저그 버벅임 시 건물들 디테일이 유실됨 —
   익스트랙터 창문, 해처리 옥상 가시") ────────────────────────────────────────────────
   그 유실은 버벅임의 **부작용이 아니라 같은 일**이다. 판의 등급(lod)은 굽는 크기가
   정하므로, 대타로 온 **작은 판은 애초에 부품이 적게 구워진 판**이다 — 늘려 찍으면
   흐려지는 데 그치지 않고 창·가시가 아예 없다.
   고르는 자를 바꾼다: 요청보다 **크거나 같은** 판이 있으면 그중 가장 작은 것을 쓴다
   (줄여 찍는 것은 부품을 안 잃는다). 없으면 작은 것 중 가장 큰 것을 쓰되, 그마저
   1.4배 넘게 늘려야 하면 **대타를 포기하고 굽는다** — 그 정도로 흐린 그림을 몇 프레임
   보여 주느니 한 번 덜컥이는 편이 낫다. */
const SUB_MAX_UP9 = 1.4;
/* ★ 예산이 다한 프레임에는 **더 무른 대타까지 받는다**(실기 진단: 테란 132장 14.7MB /
   저그 122장 27.5MB — 저그 유닛 판이 장당 두 배 무겁다) ────────────────────────────────
   두 화면 다 합이 30MB 언저리로 상한(32)에 붙어 있는데, 테란은 그 안에 작업 집합이 들고
   저그는 안 든다. 저그 유닛(히드라·러커·울트라·오버로드)이 테란의 것(마린·SCV)보다
   **모델이 크기 때문**이다 — 판 무게는 그린 크기의 제곱이라 장당 111KB 대 225KB다.
   작업 집합이 예산을 넘으면 캐시는 영영 안 찬다. 그때 '가까운 크기가 없으니 굽는다'로
   물러나면 **한 프레임에 몇 장이고 굽게 된다** — 예산으로 죄어 둔 뜻이 사라진다.
   그래서 예산이 다한 프레임에서는 문턱을 2.5배까지 늘린다: 한두 프레임 무른 그림을
   보이더라도 굽기 폭풍은 안 낸다. 예산이 남은 프레임에서는 종전대로 1.4배까지만이다. */
const SUB_MAX_HARD9 = 2.5;
/* ★ 예산이 다한 프레임의 **마지막 수단은 '아무 크기나'다**(지적: "급 확대시 탭터짐") ──
   대타 고르기는 축소(큰 판을 작게)는 무제한 허용하고 확대(작은 판을 늘림)만 2.5배로
   막는다. 그래서 급 '축소'는 조용한데 급 '확대'는 옛 판이 전부 문턱 밖이라 — 화면의
   판 전체가 **한 프레임에** 다시 굽힌다. 그 순간 옛 세대(캐시) + 새 세대(막 굽는 것)
   + 걷혀서 수거를 기다리는 판들이 겹쳐 봉우리가 서고, 화면 캔버스 45MB 위에 얹히면
   사파리가 탭을 버린다.
   그래서 프레임의 굽기 예산이 다했으면 2.5배 문턱을 접고 **있는 판 중 가장 가까운
   것**을 쓴다. 흐릿한 것은 잠깐이다 — 손짓 중에는 어차피 옛 판을 늘려 보이고 있었고
   (bakeZoom), 그 뒤로 프레임마다 예산만큼 진짜 판이 차오르며 또렷해진다. 폭탄 같은
   한 프레임(굽기 수십 장 + 수거 대기 수십 장)이 1초 남짓의 점진 선명화로 바뀐다. */
/** 입체 건물 판의 크기 사다리 — 한 옥타브를 열둘로 끊는다(칸 사이 5.9%·이상값과 최대 2.9%). */
const BLD_LADDER9 = 12;
const bldLadder9 = (want9: number, B: number): number => {
  if (!(want9 > 0)) return want9;
  const r9 = Math.round(Math.log2(want9) * BLD_LADDER9) / BLD_LADDER9;
  return Math.max(4, Math.round(2 ** r9 * B) / B);
};
/** 대타로 쓸 크기를 고른다 — 크거나 같은 것 우선, 없으면 문턱 안쪽의 작은 것. */
const pickSubSize9 = (
  list: { s: number; k: string }[], want: number, cap = SUB_MAX_UP9,
): string | null => {
  let up9: { s: number; k: string } | null = null;      // 요청 이상 중 가장 작은 것
  let down9: { s: number; k: string } | null = null;    // 요청 미만 중 가장 큰 것
  for (const e9 of list) {
    if (e9.s >= want) { if (!up9 || e9.s < up9.s) up9 = e9; }
    else if (!down9 || e9.s > down9.s) down9 = e9;
  }
  if (up9) return up9.k;
  return down9 && want / down9.s <= cap ? down9.k : null;
};
/** 색인에 한 줄 적는다 — 같은 열쇠는 한 번만, 여섯 벌까지(오래된 것부터 밀어낸다). */
const noteSub9 = (
  map: Map<string, { s: number; k: string }[]>, sub: string, size: number, key: string,
): void => {
  const got9 = map.get(sub);
  if (got9) {
    if (!got9.some((e9) => e9.k === key)) {
      got9.push({ s: size, k: key });
      if (got9.length > 6) got9.shift();
    }
    return;
  }
  if (map.size > SPRITE_SIZES_MAX) map.clear();
  map.set(sub, [{ s: size, k: key }]);
};
/* ★ 굽기는 **장수만이 아니라 시간으로도** 죈다(계측: 3D 드래그 중 "최악프레임 109ms · 그중 굽기 111ms ·
   최악판 droneHold 104ms · 미룸 U412/B237") ────────────────────────────────────────────────────────
   장수 예산(PC 3장)은 판 한 장이 3~5ms일 때 잡은 값이다. 배율 6·입체에서는 판 한 장이 30~100ms라
   세 장이면 프레임이 통째로 넘어간다 — 그 프레임에 그리기는 한 톨도 안 늦었는데 굽기가 109ms를 먹었다.
   시간으로 죄면 판이 큰 자리에서 저절로 한 장(또는 0장)이 된다: 이미 이 프레임에 예산만큼 구웠으면
   나머지는 **대타 판**(같은 모델의 다른 크기)으로 그리고 다음 프레임에 마저 굽는다. 그림은 잠깐 흐릴
   뿐이고(대타는 늘려 찍는다), 화면은 안 멈춘다.
   ★ **손짓 중에는 아예 안 굽는다** — 끄는 동안 새로 굽는 것은 '지금 당장'일 까닭이 가장 적은 일이고,
     그 한 장이 손끝을 100ms씩 붙든다. 대타가 아예 없는 종류(한 번도 안 구운 모델)만 굽는다 —
     그것까지 미루면 그 유닛이 화면에서 사라진다. 손을 떼면 그 프레임부터 예산대로 마저 굽는다. */
let BAKE_MS_PER_FRAME9 = DEV9.bakeMsPerFrame;
/** 한 프레임 굽기의 **천장**(ms) — 부드러운 예산을 넘어도 대타가 없으면 작게라도 굽는데(아래 ★),
 *  그 작은 판마저 수십 장이면 다시 프레임을 넘긴다(계측: 최악프레임 259ms · 그중 굽기 204ms ·
 *  2초에 유닛 213장 1187ms — 958기가 얽힌 한 장에서 처음 보는 열쇠가 프레임마다 수십이었다).
 *  천장을 넘으면 **이번 프레임엔 아예 안 그린다**(판 없이 null). 몇 기가 한두 프레임 늦게 나타나는
 *  것은 그 난전에서 눈에 안 띄지만 259ms 덜컥임은 보인다 — 다음 프레임에 예산이 되살아나 곧 들어온다. */
let BAKE_HARD_MS9 = DEV9.bakeMsPerFrame * 3;
/* ★ **손짓 중에는 천장을 3분의 1로**(계측: 손짓 127ms(미룸) — 그 안에 대타 없는 몸을 굽는 몫이 섞여 있다).
   끄는 동안 새 판을 굽는 것은 이미 막았지만(gestBake9), 대타가 하나도 없는 몸은 그래도 굽는다 —
   그 예외의 상한이 평소와 같으면 손짓 한 장에 36ms가 얹힌다. 끄는 동안에는 12ms(폰 8ms)까지만 굽고
   나머지는 다음 장으로 미룬다: 손끝을 따라가는 것이 그 순간의 유일한 일이다. */
const bakeHardOk9 = (): boolean =>
  SPRITE_PERF.bakeMs + SPRITE_PERF.bldBakeMs
    < (gestBake9.v ? DEV9.bakeMsPerFrame : BAKE_HARD_MS9 * bakeSprint9.v);
/** 채우는 동안 예산을 몇 배로 키우나(1·3·6) — 위 프레임 열기에서 미뤄 둔 장수로 정한다. */
/** 지금 손짓(드래그·핀치)이 도는가 — 붓(UnitLayer)이 프레임마다 적고, 굽기 문지기가 읽는다. */
const gestBake9 = { v: false };
/** 채우는 동안의 굽기 예산 배수(1·3·6) — 미뤄 둔 장수가 정한다(위 프레임 열기의 ★). */
const bakeSprint9 = { v: 1 };
/** 이 프레임에 굽기를 더 해도 되나 — 장수와 시간, 그리고 손짓 여부를 함께 본다. */
const bakeOk9 = (left9: number): boolean => left9 > 0 && !gestBake9.v
  && SPRITE_PERF.bakeMs + SPRITE_PERF.bldBakeMs < BAKE_MS_PER_FRAME9 * bakeSprint9.v;
/** ★ 한 프레임에 **작게 굽는 판**의 상한(실측: 잔잔할 땐 초당 3장인데 순간 360장까지 튄다) ─────────────
 *  대타가 하나도 없는 몸은 예산을 보지 않고(force9) 작은 판을 굽는 길로 떨어진다 — 장수 예산을 통째로
 *  비켜 가므로, 처음 보는 열쇠가 한꺼번에 쏟아지는 순간(큰 싸움·방향 전환)에는 한 프레임에 수십 장이
 *  난다. 캔버스 하나는 제 배킹(iOS면 IOSurface)을 가지므로 그 폭발이 곧 웹킷의 회수(그리기 멎음)를 부른다.
 *  ms 천장(BAKE_HARD_MS9)만으로는 작은 판이 워낙 싸서 안 걸린다 — **장수**로도 막는다. 넘으면 이번
 *  프레임엔 그 몸을 안 그린다(다음 프레임에 곧 들어온다). */
const SMALL_BAKE_PER_FRAME9 = 3;
let smallBakeLeft9 = SMALL_BAKE_PER_FRAME9;
/** 굽기 일꾼 모드의 건물 작은 판 계수기(아래 BAKEW9) — 옛 길(폰)은 유닛과 같은 계수기(smallBakeLeft9)를 그대로 나눠 쓴다. */
let smallBldLeft9 = SMALL_BAKE_PER_FRAME9;
let UNIT_BAKE_PER_FRAME = DEV9.unitBakePerFrame;
let unitBakeLeft9 = UNIT_BAKE_PER_FRAME;
/* ★ **건물도 같다 — 오히려 더하다**(계측: 저그 본진을 배율 6·12로 확대해 재 봤다) ─────
     배율 6  건물 13판 7.7MB (장당 0.59MB)
     배율 12 건물  7판 8.6MB (장당 **1.23MB**)
   폰의 건물 판 예산은 16MB라 12배에서는 **열세 장**이면 찬다. 저그 본진 한 채는 해처리·
   풀·에보·스파이어·성큰·스포어·익스트랙터에 미네랄까지 그보다 많다 — 곧 예산이 넘쳐
   LRU가 쫓아내고, 쫓겨난 자리를 다시 구우면 굽는 판(여백까지 6.6배 넓이)이 8MB다.
   그 한 장이 한 프레임을 먹는다. 유닛과 같은 약을 쓴다: 프레임마다 굽는 수를 죄고,
   예산이 다한 자리에서는 같은 건물의 다른 크기로 구워 둔 판을 늘려 찍는다. */
let BLD_BAKE_PER_FRAME = DEV9.bldBakePerFrame;
let bldBakeLeft9 = BLD_BAKE_PER_FRAME;
const BLD_SPRITE_SIZES = new Map<string, { s: number; k: string }[]>();
/** 크기(pxq)를 뺀 열쇠 → 그 열쇠로 구워 둔 크기들. 예산이 다한 프레임의 대타를 찾는 자다.
 *  보관함이 LRU로 쫓아낸 크기가 남아 있을 수 있으므로, 쓰는 쪽이 실물을 다시 확인한다. */
/* ★ 색인에서 **등급(lod)을 뺀다**(지적: "그냥 보고 있는데 멀쩡히 있던 디테일이 사라지는
   건 다시 그리는 거네") — 정확한 진단이다. 등급은 굽기 열쇠에 들어 있어서, 기기 벌점이
   0에서 1로 넘어가는 순간 화면의 **모든 열쇠가 한꺼번에 안 맞고** 그 프레임에 한 세대를
   통째로 다시 굽는다 — 가장 느린 순간에 가장 큰 삯을 치르는 셈이라 조절기가 스스로 병을
   키웠다. 게다가 그동안 대타도 못 찾는다(새 등급으로 구워 둔 것이 하나도 없으니까).
   색인이 등급을 안 보면 그 순간 **옛 등급의 판**이 대타로 선다: 화면은 그대로(오히려 더
   자세한 채) 있고 새 판은 예산대로 한 장씩 조용히 갈아 끼워진다. 폭풍도 사라짐도 없다.
   그래서 색인은 크기가 아니라 **{크기, 실제 열쇠}**를 든다 — 같은 크기라도 등급이 다르면
   다른 판이라 열쇠를 그대로 들고 있어야 찾을 수 있다. */
const SPRITE_SIZES = new Map<string, { s: number; k: string }[]>();
const SPRITE_SIZES_MAX = 4096;
/* ★ **방위가 비면 이웃 방위를 빌린다**(지적: "아냐 진짜 없어져 · 아예 안 그린다고 · 유닛을") ─────
   위 색인(SPRITE_SIZES)은 subKey — 종류·**방위**·납작·시점·기울기·B·자세·속 — 별로 갈린다.
   그래서 어떤 유닛이 **처음 보는 방위로 돌아선 그 순간**에는 대타가 하나도 없다: 크기만 다른
   판을 찾는 위 길이 통째로 막히고, 굽기 천장까지 찼으면 그 자리는 `return null`이라 **그 몸을
   아예 안 그린다**. 유닛이 깜빡이는 것이 아니라 진짜로 사라졌던 자리가 여기다(짐작이 맞았다:
   "방향이 비어서 그런 거 아닐까").
   그래서 종류마다 **구워 둔 방위 목록**을 따로 들고, 방위 말고는 모두 같은 subKey 중 각이 가장
   가까운 것의 판을 빌린다. 한두 프레임 방향이 한 칸 어긋날 뿐이고, 제 방위는 대기표(bakeWant9)
   에 올라 곧 조용히 갈아 끼워진다. 안 그리는 것보다 언제나 낫다. */
const SPRITE_SUBS9 = new Map<string, string[]>();
const noteKindSub9 = (kind: string, sub: string): void => {
  let l9 = SPRITE_SUBS9.get(kind);
  if (!l9) { if (SPRITE_SUBS9.size > 512) SPRITE_SUBS9.clear(); l9 = []; SPRITE_SUBS9.set(kind, l9); }
  if (l9.indexOf(sub) < 0) { l9.push(sub); if (l9.length > 48) l9.shift(); }
};
/** 방위만 다른 형제 subKey의 판 — 각이 가장 가까운 것. 없으면 null. */
const kinPlate9 = (kind: string, sub: string, pxq: number): UnitPlate9 | null => {
  const subs9 = SPRITE_SUBS9.get(kind);
  if (!subs9 || subs9.length === 0) return null;
  const f9 = sub.split("|");
  const want9 = Number(f9[1]);
  let best9: UnitPlate9 | null = null;
  let bd9 = Infinity;
  for (let i9 = 0; i9 < subs9.length; i9 += 1) {
    const s9 = subs9[i9];
    if (s9 === sub) continue;
    const g9 = s9.split("|");
    if (g9.length !== f9.length) continue;
    let ok9 = true;
    for (let j9 = 0; j9 < f9.length; j9 += 1) { if (j9 !== 1 && g9[j9] !== f9[j9]) { ok9 = false; break; } }
    if (!ok9) continue;
    const d9 = Number.isFinite(want9) && want9 >= 0
      ? Math.abs((((Number(g9[1]) - want9) % 360) + 540) % 360 - 180) : 0;
    if (d9 >= bd9) continue;
    const sizes9 = SPRITE_SIZES.get(s9);
    if (!sizes9) continue;
    const k9 = pickSubSize9(sizes9, pxq, Infinity);
    const pl9 = k9 ? SPRITE_CACHE.get(k9) : undefined;
    if (!pl9) continue;
    best9 = pl9; bd9 = d9;
  }
  return best9;
};
/* ★ 장식이 쓰는 **몸 폭은 자세를 안 탄다**(지적: "뮤탈 날갯짓하면서 그림자 크기도
   바뀌는데 그거도 문제 아니야? 보기에도 정신없고") ────────────────────────────────
   그림자·체력바·링은 '그린 잉크의 폭'(spr.w)을 자로 쓴다. 상자가 아니라 실제로 칠한
   픽셀을 봐야 종류마다 다른 가로세로비에 안 속기 때문이다(그 자리 주석).
   그런데 날갯짓 컷은 **날개를 폈다 접는다** — 잉크 상자가 컷마다 실제로 넓어졌다
   좁아진다. 그 값을 그대로 쓰면 그림자와 체력바가 날갯짓에 맞춰 함께 펄떡인다.
   몸이 커졌다 작아지는 것이 아니라 **자세가 바뀐 것**이므로, 장식의 자는 자세 0(대기)의
   것으로 못 박는다. 종류·방위·보기마다 한 번만 적어 두고 모든 컷이 그것을 나눠 쓴다.
   ※ 값은 '판 크기에 대한 비'라 배율이 바뀌어도 그대로 쓴다. */
/* ★ **자세 0이 아예 안 오는 종류가 있다**(재지적: "그림자 여전히 크기 변하는데?") —
   나는 저그(뮤탈·디바우러)는 flapCutOf가 1·4·3만 돌려주므로 대기 컷(0)이 한 번도 안
   선다. 그래서 '자세 0에서 잰 값'을 기다리는 앞판은 이 종류에서 아무것도 못 적었고,
   장식이 그대로 이번 컷의 잉크를 썼다 — 고친 것이 정작 고쳐야 할 종류만 비켜 갔다.
   기다리지 말고 **본 것 중 가장 작은 자세 번호**의 값을 쓴다. 대기 컷이 있는 종류는
   여전히 0의 값이고, 날갯짓만 하는 종류는 컷 1의 값으로 못 박힌다 — 어느 쪽이든 컷이
   바뀌어도 안 흔들리는 한 값이라는 것이 요점이다(어느 컷의 값인지가 아니라). */
/* ★ **방위도 안 탄다**(지적: "scv가 각도에 따라 그림자가 엄청 넓어지네") ───────────────
   위 두 문단이 '자세'를 못 박았는데 **방위**가 그대로 남아 있었다. 실측(scripts 밖 계측기로
   16방위 잉크 폭): scv 4.88 ~ 6.75(1.38배) · probe 1.29배 · 고스트 1.40배. 모델이 앞뒤로
   길면 옆에서 볼 때 실루엣이 넓어지는 것이라 그림 자체는 옳지만, 그 값을 **그림자**의 자로
   쓰면 제자리에서 도는 일꾼의 발자국이 방위마다 1.4배로 벌어졌다 좁아진다. 그림자는 발자국
   이고 발자국은 도는 것이 아니다(체력바·링·오라도 같다 — 몸이 도는 동안 폭이 변하면 안 된다).
   그래서 열쇠에서 방위를 빼고, 본 방위들의 **평균**을 자로 쓴다(방위마다 처음 잰 값 하나만
   적어 두므로 한 번 차면 안 흔들린다). 자세 규약은 그대로다 — 본 것 중 가장 작은 자세 번호의
   값만 모으고, 더 작은 자세가 오면 처음부터 다시 모은다. */
const INK_W_RATIO9 = new Map<string, { pose: number; by: Map<number, number>; r: number }>();
/* (걷어냄·요청: 부작용이 더 크다) dpr 1 판의 언샤프 마스크(sharpenPlate9) — 경계를 굳히면 계단·밝은 테가 났다.
   dpr 1도 굽는 그대로 쓴다. */
/** 임자 색 마스크(2번: 임자 색을 굽지 말고 그릴 때 입히기) — 판 열쇠에서 색을 뺐다. 개인색 면은 몸판에서 빼고
 *  이 마스크에 흰색(음영 알파 그대로)으로 굽되, 화가 순서상 그 **위**에 오는 고정색 면은 destination-out으로 파낸다
 *  (가림 순서가 그대로 산다 — 옛 주석의 "층을 둘로 가르면 가림이 깨진다"는 이 파내기로 푼다). 그릴 때 임자 색으로
 *  source-in 물들여 몸판 위에 얹는다. 판 가짓수가 임자 수분의 1이 된다. */
type TintPlate9 = {
  cv: PlateImg9; ox: number; oy: number;
  /** 몸판이 광택(silhouetteLight)을 받았나 — 물들인 마스크에도 같은 광택을 얹는다(지적: 포톤 톱니 임자색이 흐림). */
  gloss: boolean;
  /** 색별로 물들인 마스크(한 번 만들어 되쓴다) */
  by?: Map<string, HTMLCanvasElement>;
};
/** 한 마스크가 드는 색별 물들인 판의 상한 — 8인전이면 여덟 벌이다(마스크는 몸판보다 훨씬 작다). */
const TINT_BY_MAX9 = 8;
/** 마스크의 물들인 판을 전부 놓는다(쫓아낼 때) — 바이트 합을 돌려준다. */
const releaseTints9 = (tn: TintPlate9): number => {
  let b = 0;
  if (tn.by) { for (const c of tn.by.values()) { b += canvasBytes(c); RELEASE_Q9.push(c); } tn.by.clear(); }
  return b;
};
type UnitPlate9 = { cv: PlateImg9; ox: number; oy: number; pad: number; l: number; bot: number; cx: number; top: number; w: number; tint?: TintPlate9 | null };
/** 마스크를 임자 색으로 물들인 판 — (마스크, 색)마다 한 번만 만들고 되쓴다(계측: 그릴 때마다 물들이면 찍기가
 *  300 → 451장, 프레임이 1.5배 — 네 번의 캔버스 연산이 유닛마다 붙었다). 마스크는 임자 면 상자만이라 몸판보다 훨씬 작다. */
const tintedOf9 = (tn: TintPlate9, color: string, bytes: { n: number } = spriteBytes): HTMLCanvasElement | null => {
  const got = tn.by?.get(color);
  if (got) return got;
  if (typeof document === "undefined") return null;
  const w = tn.cv.width; const h = tn.cv.height;
  const cv = takeStored9(w, h) ?? ((): HTMLCanvasElement => {
    const c9 = newCanvas9("물들이기");
    c9.width = w; c9.height = h;
    return c9;
  })();
  const tc = cv.getContext("2d");
  if (!tc) return null;
  tc.drawImage(tn.cv, 0, 0);
  tc.globalCompositeOperation = "source-in";
  tc.fillStyle = color;
  tc.fillRect(0, 0, w, h);
  // 임자 면에는 광택을 안 얹는다(지적: 포톤 톱니 임자색이 흐림 — 왼위 14% 흰 빛이 임자색을 씻었다). gloss는 남겨 두되 안 쓴다.
  void tn.gloss;
  if (!tn.by) tn.by = new Map();
  if (tn.by.size >= TINT_BY_MAX9) {
    const first = tn.by.keys().next();
    if (!first.done) { const old = tn.by.get(first.value); if (old) { bytes.n -= canvasBytes(old); RELEASE_Q9.push(old); } tn.by.delete(first.value); }
  }
  tn.by.set(color, cv);
  bytes.n += canvasBytes(cv);
  return cv;
};
/** 물들인 마스크를 몸판과 같은 자리에 얹는다(그리기 변환은 부르는 쪽이 세워 둔 상태). */
const drawTint9 = (
  ctx: CanvasRenderingContext2D, spr: UnitPlate9, color: string, pxqB: number, k: number, B: number,
): void => {
  const tn = spr.tint;
  if (!tn) return;
  const cv = tintedOf9(tn, color);
  if (!cv) return;
  SPRITE_PERF.blit += 1;
  ctx.drawImage(cv,
    (-(spr.pad + pxqB / 2) + tn.ox / B) * k, (-(spr.pad + pxqB / 2) + tn.oy / B) * k, (cv.width / B) * k, (cv.height / B) * k);
};
/** 예산이 다했는데 대타도 없을 때 굽는 **작은 판**의 몫 — 넓이가 9분의 1이라 삯도 그만큼이다
 *  (실측: 최악판 109ms → 12ms 언저리). 늘려 찍으므로 잠깐 흐리고, 이 판은 다음 프레임의 대타로 남는다. */
const BAKE_SMALL_K9 = 3;
/** ★ **미룬 것의 대기표 — 큰 몸부터 굽는다**(계측: 2초에 미룸 U3042/B1624) ────────────────────────
 *  예산은 프레임마다 되돌아오는데, 그 예산을 **무엇에 쓸지**는 여태 아무도 안 골랐다: 그리는 차례가
 *  곧 굽는 차례라 화면 뒤쪽의 점만 한 몸이 예산을 먼저 먹고, 앞의 큰 몸은 대타(늘려 찍은 흐린 판)로
 *  남는 일이 잦다. 큰 몸이 흐린 것은 보이고 작은 몸이 흐린 것은 안 보이므로 이건 거꾸로다.
 *  미룬 열쇠를 크기와 함께 적어 두었다가, 다음 프레임이 열리는 자리에서 **큰 것부터** 예산이 닿는
 *  데까지 굽는다. 총량은 그대로고 순서만 바뀐다. 적는 것은 미룬 자리뿐이라 값이 없다. */
/** 대기표 한 줄 — sub·lod·bld는 굽기 일꾼에 청할 때 쓴다(열쇠·색인을 메인이 그대로 들고, 일꾼은 그림만 낸다). */
type BakeWant9 = { op: UnitDrawOp; pxq: number; B: number; sub?: string; lod?: number; bld?: boolean };
const BAKE_WANT9 = new Map<string, BakeWant9>();
/** 대기표 상한 — 넘으면 오래된 것부터 버린다(Map은 넣은 차례를 지킨다). 다음 프레임에 또 청해 온다. */
const BAKE_WANT_MAX9 = 300;
const bakeWant9 = (key9: string, op: UnitDrawOp, pxq: number, B: number, sub9?: string, lod9?: number, bld9 = false): void => {
  if (BAKE_WANT9.has(key9)) return;
  if (BAKE_WANT9.size >= BAKE_WANT_MAX9) {
    const first9 = BAKE_WANT9.keys().next();
    if (!first9.done) BAKE_WANT9.delete(first9.value);
  }
  BAKE_WANT9.set(key9, { op, pxq, B, sub: sub9, lod: lod9, bld: bld9 });
};
/** 프레임이 열릴 때 — 대기표를 큰 것부터 굽는다. 예산이 닫히면 그만두고, 못 구운 것은 이 프레임에
 *  다시 청해 와 대기표에 도로 오른다(그래서 여기서는 통째로 비운다).
 *  ★ 굽기 일꾼이 켜져 있으면(BAKEW9.on) 메인은 안 굽고 **일꾼에 청한다** — 손짓 중이든 예산이 닫혔든 상관없이
 *    (일꾼의 시간은 메인 프레임이 아니다). 판은 다음 프레임쯤 돌아와 보관함에 꽂힌다. */
function drainBakeWant9(): void {
  const n9 = BAKE_WANT9.size;
  if (BAKEW9.on) { if (n9 > 0) bakeFlush9(); return; }
  if (n9 === 0 || !bakeOk9(unitBakeLeft9)) { if (n9 > 0) BAKE_WANT9.clear(); return; }
  const arr9 = [...BAKE_WANT9.values()].sort((a9, b9) => b9.pxq - a9.pxq);
  BAKE_WANT9.clear();
  for (const w9 of arr9) {
    if (!bakeOk9(unitBakeLeft9)) break;
    if (w9.bld) continue;   // 건물 대기표는 일꾼이 켜졌을 때만 적힌다(아래 buildingSpriteBake) — 인라인 길은 옛 그대로
    unitSprite(w9.op, w9.pxq, w9.B);
  }
}
/* ★ **굽기 일꾼**(요청: "윈도우 크롬에서 CPU·GPU를 최대한" → 계획 3번; "2번(일꾼)으로 가는 게 맞지 않을까") ──────
   메인의 붓이 새 열쇠를 만나면 그 프레임에서 직접 구웠다 — 한 장 3ms인데 시점이 갈리면 수백 장이 한 번에 와
   최장프레임 756ms(붓 571)가 났다. 벤치 단(PC_TIERS9)을 올려도 이 일량은 그대로라 덜컥임 한 번이 길어질 뿐이었다.
   이제 굽기를 일꾼(bakeWorker.ts, OffscreenCanvas)에 맡긴다: 메인은 열쇠·보관함·예산·대타를 그대로 들고, 처음 보는
   열쇠는 대기표(BAKE_WANT9)에 적어 프레임이 열릴 때 큰 것부터 일꾼에 청한다. 그 프레임은 대타(다른 크기·이웃 요잉
   판)를 찍고, 일꾼이 ImageBitmap을 transfer로 돌려주면(복사 없음) 보관함에 꽂아 다음 프레임부터 제 판을 찍는다.
   · 대타가 하나도 없는 몸의 **작은 판**(force9)은 여전히 메인이 굽는다(넓이 9분의 1, 한두 ms) — 유닛이 한 프레임도
     안 사라지게 하는 옛 규약 그대로. 그 판도 곧 일꾼의 제 크기 판으로 갈린다.
   · 손짓 중에도 청한다 — 일꾼의 시간은 메인 프레임이 아니다. 끌면서 판이 도착해 갈린다(옛 길은 손짓 중 안 굽었다).
   · 일꾼 수는 DEV9.bakeWorkers(PC 코어 8 이상 둘, 아니면 하나 · 폰 0). 일꾼마다 BAKEW_INFLIGHT9장까지만 앞서 보내고
     나머지는 대기표에 남긴다 — 다음 프레임에 다시 큰 것부터 고르므로 우선순위가 늘 살아 있다.
   · 못 띄우면(OffscreenCanvas 2D 없음·모듈 없음·던짐) `on`이 거짓이 되어 옛 인라인 길로 돈다 — 진단 '굽기일꾼' 줄에 까닭.
   · `#bakeworker=N`으로 수를 못 박는다(0이면 끔). 폰에 열 때는 DEV9.bakeWorkers만 올리면 된다 — 이 길은 기기를 안 가린다.
   ★ 일꾼에는 메인의 깃발이 없다: lod·pitchFlat은 청할 때 실어 보내고(열쇠와 같은 값), 자세·포탑·불빛·회전은 op로
     래스터 함수가 스스로 세운다(bake9의 rasterUnit9·rasterBld9). 진단 해시는 워커 name으로 간다(hashNow9). */
type BakeReq9 = { key: string; sub: string; op: UnitDrawOp; q: number; B: number; lod: number; bld: boolean; at: number; w: number };
const BAKEW_INFLIGHT9 = 6;
const BAKEW9 = {
  on: false, why: "", starting: false,
  workers: [] as Worker[], busy: [] as number[],
  inflight: new Map<number, BakeReq9>(), keys: new Set<string>(), nextId: 1,
  sent: 0, got: 0, nil: 0, nilWhy: new Map<string, number>(), dup: 0, drop: 0, err: 0, errMsg: "",
  rttSum: 0, rttMax: 0, bakeSum: 0, bakeMax: 0, bakeMaxKind: "",
};
/** 멈춘 화면에서 판이 도착하면 붓 하나를 깨우는 문 — 컴포넌트가 requestPaint9를 꽂는다(재생 중이면 그 함수가 무동작). */
const BAKE_REPAINT9 = { fn: null as (() => void) | null };
function bakeWorkersStart9(): void {
  if (BAKEW9.starting || BAKEW9.workers.length > 0 || typeof window === "undefined") return;
  let n9 = DEV9.bakeWorkers;
  const m9 = /bakeworker=(\d)/.exec(window.location.hash);
  if (m9) n9 = Math.min(3, Number(m9[1]));
  if (!(n9 > 0)) { BAKEW9.why = m9 ? "끔(#bakeworker=0)" : "기기 표(bakeWorkers 0)"; return; }
  if (typeof OffscreenCanvas === "undefined") { BAKEW9.why = "OffscreenCanvas 없음"; return; }
  BAKEW9.starting = true;
  void import("./bakeWorker?worker&inline").then((mod9) => {
    const Ctor9 = (mod9 as { default?: unknown }).default;
    if (typeof Ctor9 !== "function") { BAKEW9.why = "워커 모듈 없음(도구 번들)"; BAKEW9.starting = false; return; }
    let ready9 = 0;
    for (let i9 = 0; i9 < n9; i9 += 1) {
      let w9: Worker;
      try { w9 = new (Ctor9 as new (o?: { name?: string }) => Worker)({ name: window.location.hash }); }
      catch (e9) { BAKEW9.why = `워커 생성 실패 ${String(e9).slice(0, 80)}`; BAKEW9.starting = false; return; }
      const wi9 = i9;
      w9.onmessage = (ev: MessageEvent<{ type: string; ok?: boolean; why?: string; id?: number; out?: import("./bakeWorker").BakeOut9 | null; ms?: number; message?: string }>) => {
        const m = ev.data;
        if (m.type === "ready") {
          if (m.ok) { ready9 += 1; if (ready9 === n9) { BAKEW9.on = true; BAKEW9.starting = false; } }
          else bakeWorkersStop9(`2D 못 엶(${m.why ?? ""})`);
          return;
        }
        if (m.type === "done" && typeof m.id === "number") { bakeDone9(wi9, m.id, m.out ?? null, m.ms ?? 0, m.why); return; }
        if (m.type === "err" && typeof m.id === "number") {
          const r9 = BAKEW9.inflight.get(m.id);
          if (r9) { BAKEW9.inflight.delete(m.id); BAKEW9.keys.delete(r9.key); BAKEW9.busy[wi9] -= 1; }
          BAKEW9.err += 1; BAKEW9.errMsg = m.message ?? "";
        }
      };
      w9.onerror = (ev9) => { bakeWorkersStop9(`워커 오류 ${String(ev9.message ?? ev9).slice(0, 80)}`); };
      w9.postMessage({ type: "env", oneMax: BAKE_ENV9.oneMax, poolBytes: BAKE_ENV9.poolBytes, sideMax: BAKE_ENV9.sideMax });
      BAKEW9.workers.push(w9); BAKEW9.busy.push(0);
    }
  }).catch((e9) => { BAKEW9.why = `모듈 로드 실패 ${String(e9).slice(0, 80)}`; BAKEW9.starting = false; });
}
/** 일꾼을 걷고 인라인 길로 돌아간다 — 날아가던 청은 다음 프레임에 대기표로 다시 오른다. */
function bakeWorkersStop9(why9: string): void {
  for (const w9 of BAKEW9.workers) { try { w9.terminate(); } catch { /* 이미 죽었다 */ } }
  BAKEW9.workers.length = 0; BAKEW9.busy.length = 0;
  BAKEW9.inflight.clear(); BAKEW9.keys.clear();
  BAKEW9.on = false; BAKEW9.starting = false; BAKEW9.why = why9;
}
/** 프레임이 열릴 때 — 대기표를 큰 것부터 일꾼에 청한다(일꾼마다 BAKEW_INFLIGHT9장까지). 남은 것은 버린다(다음 프레임에 다시 온다). */
function bakeFlush9(): void {
  const arr9: [string, BakeWant9][] = [...BAKE_WANT9.entries()].sort((a9, b9) => b9[1].pxq - a9[1].pxq);
  BAKE_WANT9.clear();
  for (const [key9, w9] of arr9) {
    if (BAKEW9.keys.has(key9)) continue;
    if (w9.bld ? BLD_SPRITE_CACHE.has(key9) : SPRITE_CACHE.has(key9)) continue;
    if (w9.sub === undefined || w9.lod === undefined) continue;   // 옛 길의 대기표(작은 판 경로) — 일꾼 정보가 없다
    let wi9 = -1; let least9 = BAKEW_INFLIGHT9;
    for (let i9 = 0; i9 < BAKEW9.busy.length; i9 += 1) if (BAKEW9.busy[i9] < least9) { least9 = BAKEW9.busy[i9]; wi9 = i9; }
    if (wi9 < 0) { BAKEW9.drop += 1; continue; }
    const id9 = BAKEW9.nextId; BAKEW9.nextId += 1;
    BAKEW9.inflight.set(id9, { key: key9, sub: w9.sub, op: w9.op, q: w9.pxq, B: w9.B, lod: w9.lod, bld: !!w9.bld, at: pNow(), w: wi9 });
    BAKEW9.keys.add(key9); BAKEW9.busy[wi9] += 1; BAKEW9.sent += 1;
    BAKEW9.workers[wi9].postMessage({ type: "bake", id: id9, bld: !!w9.bld, op: w9.op, q: w9.pxq, B: w9.B, lod: w9.lod, pitchFlat: pitchFlatNow });
  }
}
/** 일꾼이 판을 돌려줬다 — 보관함·색인·바이트에 꽂는다(메인이 굽던 자리와 같은 규약). 멈춘 화면이면 붓을 깨운다. */
function bakeDone9(wi9: number, id9: number, out9: import("./bakeWorker").BakeOut9 | null, ms9: number, why9?: string): void {
  const r9 = BAKEW9.inflight.get(id9);
  if (!r9) { if (out9) { out9.cv.close(); out9.tint?.cv.close(); } return; }
  BAKEW9.inflight.delete(id9); BAKEW9.keys.delete(r9.key); BAKEW9.busy[wi9] = Math.max(0, BAKEW9.busy[wi9] - 1);
  BAKEW9.got += 1;
  const rtt9 = pNow() - r9.at; BAKEW9.rttSum += rtt9; if (rtt9 > BAKEW9.rttMax) BAKEW9.rttMax = rtt9;
  BAKEW9.bakeSum += ms9; if (ms9 > BAKEW9.bakeMax) { BAKEW9.bakeMax = ms9; BAKEW9.bakeMaxKind = r9.op.kind; }
  if (!out9) { BAKEW9.nil += 1; const k9 = `${r9.bld ? "B" : "U"}:${why9 || "?"}:${r9.op.kind}`; BAKEW9.nilWhy.set(k9, (BAKEW9.nilWhy.get(k9) ?? 0) + 1); return; }
  const dup9 = r9.bld ? BLD_SPRITE_CACHE.has(r9.key) : SPRITE_CACHE.has(r9.key);
  if (dup9) { BAKEW9.dup += 1; out9.cv.close(); out9.tint?.cv.close(); return; }
  const tint9: TintPlate9 | null = out9.tint ? { cv: out9.tint.cv, ox: out9.tint.ox, oy: out9.tint.oy, gloss: out9.tint.gloss } : null;
  const by9 = canvasBytes(out9.cv) + (tint9 ? canvasBytes(tint9.cv) : 0);
  if (r9.bld) {
    const entry9: BldSprite = {
      cv: out9.cv, ox: out9.ox, oy: out9.oy, pad: out9.pad, l: out9.l, side: r9.q,
      bot: out9.box.bot, top: out9.box.top, w: out9.box.w, cx: out9.box.cx, tint: tint9,
    };
    BLD_SPRITE_CACHE.set(r9.key, entry9);
    noteSub9(BLD_SPRITE_SIZES, r9.sub, r9.q, r9.key);
    bldSpriteBytes.n += by9;
  } else {
    const entry9: UnitPlate9 = { cv: out9.cv, ox: out9.ox, oy: out9.oy, pad: out9.pad, l: out9.l, ...out9.box, tint: tint9 };
    SPRITE_CACHE.set(r9.key, entry9);
    noteSub9(SPRITE_SIZES, r9.sub, r9.q, r9.key);
    noteKindSub9(r9.op.kind, r9.sub);
    spriteBytes.n += by9;
  }
  trimBoth9();
  BAKE_REPAINT9.fn?.();
}
/** 진단 '굽기일꾼' 줄. */
function bakewDiag9(): string {
  const b9 = BAKEW9;
  const st9 = b9.on ? "on" : b9.starting ? "준비중" : `off${b9.why ? `(${b9.why})` : ""}`;
  if (!b9.on && b9.sent === 0) return `${st9} · 일꾼 ${DEV9.bakeWorkers}`;
  return `${st9} · 일꾼 ${b9.workers.length} · 보냄 ${b9.sent} 받음 ${b9.got} 빔 ${b9.nil} 겹침 ${b9.dup} 버림 ${b9.drop}`
    + ` · 날아감 ${b9.inflight.size} 대기 ${BAKE_WANT9.size}`
    + ` · 왕복 ${b9.got ? (b9.rttSum / b9.got).toFixed(0) : "-"}/${b9.rttMax.toFixed(0)}ms`
    + ` · 굽기 ${b9.got ? (b9.bakeSum / b9.got).toFixed(1) : "-"}ms 최악 ${b9.bakeMax.toFixed(0)}ms${b9.bakeMaxKind ? `(${b9.bakeMaxKind})` : ""}`
    + (b9.nil > 0 ? ` · 빔까닭[${[...b9.nilWhy.entries()].sort((x9, y9) => y9[1] - x9[1]).slice(0, 4).map(([k9, v9]) => `${k9}×${v9}`).join(" ")}]` : "")
    + (b9.err > 0 ? ` · ⚠오류 ${b9.err} ${b9.errMsg}` : "");
}
function unitSprite(
  op: UnitDrawOp, pxq: number, B: number,
  /** 예산을 안 보고 굽는다 — 위 작은 판을 구울 때만 참이다(아래 ★). */
  force9 = false,
): UnitPlate9 | null {
  const rotB = op.rotDeg !== undefined
    ? ((Math.round(op.rotDeg / 22.5) * 22.5) % 360 + 360) % 360 : -1;
  const vq = op.viewYaw ? Math.max(-36, Math.min(36, Math.round(op.viewYaw / 6) * 6)) : 0;
  // 등급은 상자가 아니라 이 모델이 실제로 칠하는 잉크 폭으로 정한다(위 LOD_INK_* 참고).
  const lod = lodOf((pxq * modelInkOf(op.kind)) / 16, LOD_INK_POINT, LOD_INK_DECO);
  /* 자세 깃발은 **열쇠를 만들기 전에** 세운다 — poseTag가 이 값을 읽고, 아래 면 짜기
     (resolveShapeFaces → 빌더)도 같은 값을 본다. 끝나면 0으로 되돌린다. */
  poseSet9(op.pose ?? 0);
  /* 열쇠를 **크기·등급을 뺀 몫(subKey)과 그 둘**로 가른다 — 위 SPRITE_SIZES가 '같은
     모델의 다른 크기·다른 등급'을 찾으려면 그 앞부분이 따로 있어야 한다. */
  /** 대타 색인의 열쇠 — 크기와 **등급**을 뺀 몫이다(위 SPRITE_SIZES의 ★). */
  // 열쇠에 임자 색이 없다(위 TintPlate9) — 같은 판을 모든 임자가 나눠 쓴다.
  const subKey = `${op.kind}|${rotB}|${op.flat ? 1 : 0}|${vq}|${pitchTag(op.pitch)}`
    + `|${B.toFixed(2)}|${poseTag(op.kind)}|${op.solid ?? ""}`;
  const key = `${subKey}|${lod}|${pxq}`;
  SPRITE_PERF.colorSet.add(op.color);
  const hit = SPRITE_CACHE.get(key);
  if (!hit) uniMissWhy9(op.kind, key);   // 왜 빗나갔나(위 uniMissWhy9) — 굽기 회전의 임자를 가른다
  // 찾은 것은 맨 뒤로 — 그래야 맨 앞이 '가장 오래 안 쓴 것'이 된다(LRU).
  if (hit) {
    SPRITE_PERF.hit += 1;
    poseSet9(0);
    SPRITE_CACHE.delete(key); SPRITE_CACHE.set(key, hit); return hit;
  }
  /* ★ 예산이 다했으면 **이번 프레임엔 안 굽는다** — 같은 모델의 가장 가까운 크기를
     찾아 그것을 돌려준다(부르는 쪽이 판의 실제 크기를 l·pad에서 되읽어 배율을 맞춘다).
     '가까움'은 비로 잰다(로그 거리) — 2배 큰 판과 절반짜리 판 중 어느 쪽이 덜 무른지는
     차가 아니라 비가 정한다. */
  if (!force9 && (BAKEW9.on || !bakeOk9(unitBakeLeft9))) {   // 일꾼이 켜져 있으면 늘 이 길(위 BAKEW9)
    const sizes9 = SPRITE_SIZES.get(subKey);
    if (sizes9) {
      const best9 = pickSubSize9(sizes9, pxq, SUB_MAX_HARD9)
        ?? pickSubSize9(sizes9, pxq, Infinity);   // 마지막 수단(위 ★) — 흐려도 안 터진다
      const alt9 = best9 ? SPRITE_CACHE.get(best9) : undefined;
      if (alt9) {
        /* ★ **대타는 LRU를 안 되살린다**(지적: "12배도 아닌데 모바일 사파리 탭이
           새로고침돼") ─────────────────────────────────────────────────────────────
           여기서 delete + set으로 맨 뒤에 다시 꽂으면 그 판은 '방금 쓴 것'이 되어 안
           쫓겨난다. 그런데 대타는 **옛 세대의 판**이다 — 배율이 바뀌어 새 세대를 굽는
           동안 옛 세대까지 계속 되살아나면, 폰이 두 세대를 통째로 이고 있게 된다.
           예산이 막는 것은 합이지만 그 합이 두 배가 되는 셈이라, 사파리가 탭을 버린다.
           대타는 임시로 빌려 쓰는 그림일 뿐이니 제 나이대로 늙게 둔다 — 새 세대가 다
           구워지면 옛 세대는 예정대로 쫓겨난다. */
        SPRITE_PERF.hit += 1;
        SPRITE_PERF.defer += 1;
        poseSet9(0);
        bakeWant9(key, { ...op }, pxq, B, subKey, lod);   // 대기표에 적는다 — 다음 프레임에 큰 것부터(위 ★)
        return alt9;
      }
    }
    /* ★ 대타가 **하나도 없으면 작게 굽는다**(계측: 예산을 넣고도 최악프레임 242ms · 그중 굽기 209ms) ─────
       예산의 구멍이 여기였다. 한 번도 안 구운 열쇠는 대타가 없어 이 문을 그냥 지나 **제 크기로** 구웠고,
       배율 6·입체의 그 한 장이 109ms다(최악판 probe). 큰 싸움에서는 그런 열쇠가 프레임마다 여럿이라
       예산이 뜻을 잃는다.
       안 굽는 길은 없다 — 그러면 그 유닛이 화면에서 사라진다. 대신 **넓이를 9분의 1로** 줄여 굽는다:
       삯도 그만큼이고(109 → 12ms 언저리), 늘려 찍으니 잠깐 흐릴 뿐이며, 그 판이 곧 다음 프레임의
       대타가 되어 예산이 열릴 때 제 크기가 조용히 갈아 끼워진다. */
    /* 천장을 넘었으면 작은 판도 안 굽는다(위 BAKE_HARD_MS9). 그래도 **안 그리진 않는다** —
       방위만 다른 형제 판을 빌린다(위 kinPlate9의 ★). 빌릴 것조차 없을 때만 이 몸을 거른다. */
    if (!bakeHardOk9() || smallBakeLeft9 <= 0) {
      poseSet9(0);
      SPRITE_PERF.defer += 1;
      const kin9 = kinPlate9(op.kind, subKey, pxq);
      if (kin9) { SPRITE_PERF.hit += 1; bakeWant9(key, { ...op }, pxq, B, subKey, lod); return kin9; }
      return null;
    }
    const small9 = Math.max(8, Math.round(pxq / BAKE_SMALL_K9));
    if (small9 < pxq) {
      poseSet9(0);
      smallBakeLeft9 -= 1;
      bakeWant9(key, { ...op }, pxq, B, subKey, lod);
      return unitSprite(op, small9, B, true);
    }
  }
  unitBakeLeft9 -= 1;
  SPRITE_PERF.bake += 1;
  /* ★ 굽는 시간을 **계측판에 올린다**(실측: 최악 프레임 399ms 가운데 붓:유닛캔버스가
     336ms) — 굽기는 이 붓 **안에서** 도는데, 여태 세는 것은 횟수뿐이라(SPRITE_PERF)
     콘솔에서만 보였다. 그러면 "덜컥인 그 프레임이 굽기였나"를 화면에서 못 가른다.
     시간으로 올리면 ⚠최악프레임 줄에 이름이 그대로 찍힌다. */
  const pBk9 = PERF9 ? pNow() : 0;
  // 늘 켜 두는 눈금(위 SPRITE_PERF의 ★) — 굽기는 드물고 이미 비싸, 시계 두 번은 공짜다.
  const tBk9 = pNow();
  const r9 = rasterUnit9(op, pxq, B, lod);
  if (!r9) return null;
  const { pad, l, box } = r9;
  const cr = { cv: r9.cv as HTMLCanvasElement, ox: r9.ox, oy: r9.oy };
  const tint: TintPlate9 | null = r9.tint ? { ...r9.tint, cv: r9.tint.cv as HTMLCanvasElement } : null;
  const entry: UnitPlate9 = { cv: cr.cv, ox: cr.ox, oy: cr.oy, pad, l, ...box, tint };
  SPRITE_CACHE.set(key, entry);
  /* ★ 색인에 적는다 — **이 줄이 여태 없었다.** 그래서 유닛 쪽 대타 경로는 한 번도 선
     적이 없고(색인이 늘 비어 있으니 찾을 것이 없다), '굽기를 프레임에 나눠 문다'가
     사실상 건물에만 걸려 있었다. */
  noteSub9(SPRITE_SIZES, subKey, pxq, key);
  noteKindSub9(op.kind, subKey);
  spriteBytes.n += canvasBytes(cr.cv) + (tint ? canvasBytes(tint.cv) : 0);
  trimBoth9();
  SPRITE_PERF.noteBake(op.kind, pNow() - tBk9, false);
  if (PERF9) pAdd("굽기:유닛판", pNow() - pBk9);
  return entry;
}
/** 공중은 늘 위층 — 지상 z가 아무리 커도(맵 256타일 × Z_TILE) 못 넘는 값이어야 한다. */
const Z_AIR = 10000000;
/* 그림자 색은 검정으로 되돌렸다(지적: "그림자의 개인색 적용 롤백") — 임자 색을 0.34로
   눌러 칠하던 shadowTint와 그 캐시를 통째로 걷었다. 부르는 데가 없어진 함수를 남겨 두면
   noUnusedLocals가 막는 죽은 코드라 정의째 지운다. 짙기(건물 0.5 · 부양 0.5/0.34 ·
   지상 0.32)는 색과 무관한 다른 지적("그림자가 너무 흐려 안 보인다")으로 올려 둔 값이라
   롤백 대상이 아니다 — 색만 되돌린다. */
/** 건물 모델의 발·가로중심 자리 [cx몫, bot몫] — 구운 판 크기에 대한 비로 잰다.
 *  종류마다 한 번만 재는 것이 핵심이다(지적: 같은 넥서스인데 하나만 살짝 오른쪽으로
 *  나온다): 판은 요잉 6도 칸마다 따로 굽는데, 잉크 테두리 상자의 가로중심은 칸마다
 *  조금씩 달라 같은 건물이 자리마다 다르게 밀렸다. 채움 몫(BLD_FILL_CACHE)과 같은
 *  결로 한 번 재서 모두에게 같은 보정을 준다. */
const BLD_ANCHOR_CACHE = new Map<string, [number, number]>();
/* 발자국 대비 그릴 몫 — 기본은 0.95(발자국을 꽉 채운다). 본진 셋만 예외로 넘겨 그린다
   (요청: "넥서스 해처리 커맨드는 예외로 더 크게, 실제 게임처럼") — 원작에서도 이 셋의
   그림은 4×3 발자국을 넘어 앉는다. 레어·하이브는 해처리의 다음 단계라 같은 몫이다. */
export const BLD_FILL_TARGET: Record<string, number> = {
  /* 커맨드는 1.2로 되돌린다(요청: "1.2로 내리고 모델링쪽 봐봐") — 채움을 1.4·1.6으로
     올려도 "안 커보여"가 그대로였다. 실측을 보면 이유가 있다: 커맨드의 잉크는 이미
     도록에서 가장 넓은데(적용 후 폭 25.4로 넥서스 22.2·배럭 14.2보다 크다) **높이/폭이
     0.75로 유독 납작하다**(배럭 1.10 · 아머리 1.25 · 해처리 0.96). 넓적한 것은 아무리
     넓혀도 '큰 건물'이 아니라 '넓은 접시'로 읽힌다 — 손잡이가 아니라 모델의 몫이라
     아래 tomb 모델의 돔 키를 올렸다. */
  tomb: 1.2, pyramidWide: 1.2,
  /* 해처리만 5% 죈다(요청: "해처리만 크기 5프로 축소") — 1.2 × 0.95 = 1.14.
     레어·하이브는 제 목표를 따로 들고 있으므로(아래) 이 값에 안 끌려간다.
     ★ 여기만 고치면 화면은 한 톨도 안 바뀐다 — 그리는 쪽은 BLD_NORM만 보므로
       `npm run bld-norm -- --emit`을 다시 돌려 둘을 맞춰야 한다. 해처리는 상자
       상한에 안 걸려 있어(BLD_NORM에 그 표시가 없다) 목표에 배수가 비례한다. */
  hatchery: 1.14,
  /* 레어·하이브는 해처리보다 더 준다(요청: "레어 하이브가 해처리보다 작아보여 키워줘
     뿔기둥은 크기에서 빼야해") — 진단이 맞다. 셋 다 같은 1.2였는데, 정규화가 재는 것은
     **잉크 폭 전체**라 레어·하이브의 검은 뿔기둥(끝이 x −3.9 ~ +5.9까지 뻗는다)이 그
     폭을 대신 채운다. 해처리에는 그 뿔이 없으니 같은 목표에서 몸통만 훨씬 크다.
     부품을 골라 빼는 자를 새로 만드는 대신 이 표로 되돌린다 — 스타포트의 안테나,
     게이트웨이 아치의 바깥 다리를 다룬 그 자리와 같은 손잡이다. 뿔은 조금 넘치게 두고
     몸통이 발자국을 채우게 한다. 하이브가 뿔이 더 많아 한 단 더 준다. */
  // 한 번 더 키운다(재요청: "레어 하이브 확대") — 1.45·1.55 → 1.7·1.8.
  /* 다시 죈다(요청: "레어 크기 -20프로 하이브 크기 -10프로") — 1.7 → 1.36 · 1.8 → 1.62.
     크기는 이 표가 정하고 BLD_NORM은 그 목표를 맞추려고 **생성기가 낸 값**이라, 여기만
     고치고 `npm run bld-norm -- --emit`을 다시 돌려 둘을 맞춰야 한다(표만 고치면 화면은
     한 톨도 안 바뀐다 — 그리는 쪽은 BLD_NORM만 본다). */
  /* ★ 하이브의 목표가 어중간한 까닭(1.62가 아니라 1.447) — 하이브는 **상자 상한에
     걸려 있었다**. 뿔이 사방으로 뻗어 잉크가 넓은 탓에 생성기가 목표(1.8)를 못 맞추고
     상한이 주는 최댓값(1.466)을 내고 있었고, 그래서 목표를 1.62로 낮춰도 배수가 한 톨도
     안 움직였다(여전히 상한 아래였다). 상한 밑으로 내려가는 목표를 직접 풀었다:
     상한 밖에서는 배수가 목표에 비례하므로(실측: 목표 1.00에서 배수 0.912) 원하는
     배수 1.466 × 0.9 = 1.319를 얻는 목표가 1.447이다. 실제로 1.320이 나왔다. */
  lair: 1.36, hive: 1.447,
  /* 스타포트·게이트웨이가 제 발자국보다 좁아 보인다(지적: "일부 건물들이 실제 캔버스보다
     작게(좁게) 그려지는 느낌 … 게이트웨이 스타포트 등" · "스타포트는 안테나를 크기계산
     에서 살짝 빼줘야하고") — 진단이 맞다. 정규화가 재는 것은 **잉크 폭 전체**라, 몸통
     밖으로 가늘게 뻗은 것(스타포트의 안테나 팔, 게이트웨이 아치의 바깥 다리)이 폭을
     대신 채우면 정작 몸통은 발자국의 절반 언저리에 머문다. 부품을 골라 빼는 자를 새로
     만드는 대신, 이 표가 원래 그 손잡이다(풀 1.3·파일런 1.425와 같은 자리): 목표를
     올려 몸통이 발자국을 채우게 하고 가는 팔은 조금 넘치게 둔다. */
  plane: 1.12,
  /* 프로토스 쪽이 한 무리로 작게 보인다(지적: "아카이브 트리뷰널 비콘 스타게이트
     게이트웨이 어시밀 작게 모델링된듯") — 여섯 다 몸이 가늘거나 속이 빈 형태라(아치·
     기둥·고리), 잉크 폭을 발자국의 95%에 맞춰도 눈에 잡히는 덩어리는 그 절반이다.
     같은 무리를 같은 몫으로 올린다 — 스타게이트(arch)만 상자 상한이 낮아 덜 오른다. */
  // 게이트만 한 단 내린다(요청: "게이트 살짝 축소") — 1.25 → 1.12.
  gate: 1.12, tribunal: 1.15, fleetbeacon: 1.15,
  /* 스포닝 풀이 너무 작게 나온다(지적) — 이 모델은 바닥 크립 얼룩(반지름 6.8)이
     16-상자를 거의 가득 채워, 채움 보정이 '이미 큰 건물'로 재고 몸을 도로 줄였다.
     실제로 보이는 웅덩이·두렁은 상자의 절반쯤뿐이다. 목표 채움을 올려 몸을 키운다. */
  pool: 1.3,
  /* 요청: "파일런 수정. 크기 1.5배로 키우고" — 화면에 찍히는 덩치는 모델 좌표가 아니라
     이 표가 정한다(구운 판의 잉크 폭을 재서 발자국의 몇 할이 되게 다시 굽는다). 그래서
     파일런은 모델을 건드리는 대신 기본값 0.95의 1.5배인 1.425를 못 박아, 다른 건물보다
     반쯤 더 크게 선다. */
  /* 파일런 1.425 → 1.6(요청: "파일런 확대") — 여백을 든 덕에 이제 실제로 오른다. */
  diamond: 1.6,
  /* ── 눈으로 고른 한 벌(요청) ────────────────────────────────────────────────
     "작아 보이는 것"과 "커 보이는 것"을 화면에서 짚어 준 목록이다. 정규화는 잉크 폭을
     한 목표로 맞출 뿐 **덩어리가 눈에 얼마나 잡히는가**는 모른다 — 속이 빈 고리·가는
     기둥·납작한 판은 같은 폭이어도 작아 보이고, 통짜 상자는 커 보인다. 그 몫을 이
     표가 받는다.
     ★ 값이 상자 상한에 걸리는 종류는 여기서 올려도 안 커진다(굽는 판이 잘리므로
       bld-norm이 상한에서 멈춘다). 지금 걸리는 것은 파일런(diamond)·스파이어(spire)
       둘이고, 아래 값은 그 둘에 대해서는 뜻이 없다. */
  // 작아 보이는 것들 — 키운다.
  /* (되돌림·요청: "벙커 그려지는 크기 10프로 줄였던 거 원복") — 1.08 → 1.2.
     짝이 되는 BLD_NORM.tombFlat은 아래에서 다시 잰 값이다. */
  tombFlat: 1.2,       // 벙커
  turret: 1.45,        // 터렛(재요청: "터렛 확대" — 1.2에서 더)
  trapezoid: 1.2,      // 서플라이
  /* 엔베는 한 번 더(재지적: "엔베 크기 확대") — 1.2로도 작았다. 지붕이 낮고 넓은
     판이라 잉크 폭을 다 써도 눈에 잡히는 덩어리가 얇다. */
  ebay: 1.45,          // 엔지니어링 베이
  /* (취소·요청: "아니다 취소하고") 아카데미 크기 축소 — 되돌린다. 높이 20%(withModelZ)만
     남는다. 서플라이도 같다: 크기는 손대지 않고(1.2 그대로) 높이만 올렸다. */
  // 아모리는 줄인다(요청: "아모리 축소").
  armory: 0.8,
  coil: 1.2,           // 포토 캐논
  hydraden: 1.2,       // 히드라 덴
  evo: 1.2,            // 에볼루션 챔버
  creep: 1.2, sunken: 1.2, sunkenfire: 1.2, spore: 1.2,   // 크립·성큰·스포어
  spire: 1.2, gspire: 1.2,                                // 스파이어(상한에 걸림)
  forge: 1.2,          // 포지
  citadel: 1.2,        // 시타델 오브 아둔
  archives: 1.35,      // 템플러 아카이브(1.15에서 더)
  /* 스타게이트 — 1.15 → 1.35로 키웠다가 **1.18로 내린다**(지적: "스타게이트가 윗건물
     (뒷건물)과 겹쳐 보이는 현상"). 발자국이 게이트웨이와 똑같은 4×3인데 목표만 1.35라
     잉크 폭이 5.24타일(게이트웨이 4.48)이었고, 건물은 발자국 아랫변에 앉으므로 커진
     몫이 전부 **위쪽(뒤)** 으로 자라 뒷건물 타일까지 올라갔다. 잎을 가운데로 모으는
     손질(arch 빌더의 R 2.62 → 2.18)과 짝이다 — 상자가 좁아진 만큼 몸은 덜 작아진다. */
  arch: 1.18,
  // 커 보이는 것들 — 줄인다.
  observatory: 0.8,
  // 애드온은 한 단 더 줄인다(재요청: "애드온 건물들 축소") — 0.8 → 0.66.
  comsat: 0.66, nsilo: 0.66, mshop: 0.66, ctower: 0.66, covert: 0.66, physlab: 0.66,
  // 가스 셋은 도로 살짝 올린다(요청: "가스 건물즐 살짝씩 확대") — 0.8 → 0.92.
  refinery: 0.92, assim: 0.92, extract: 0.92,
};
const BLD_SPRITE_CACHE = new Map<string, BldSprite>();
const bldSpriteBytes = { n: 0 };

/** ★ 건물 판이 **왜** 빗나갔나(실측: 핵 창에서 건물 261장·573ms를 구웠다) ────────────────────
 *  굽기가 값의 임자인 것까지는 수로 나왔는데, 한꺼번에 갈린 까닭은 열쇠의 **어느 칸**이 바뀌었느냐다:
 *  시점 칸(팬·확대)인지 · 회전 칸(도는 부품)인지 · 불빛(생산 깜빡임)인지 · 단계인지. 종류마다 마지막
 *  열쇠를 적어 두고, 빗나갈 때 첫 번째로 다른 칸의 이름을 센다. 값은 문자열 나누기 한 번이다. */
const BLD_KEYF9 = ["종류", "회전", "평면", "시점", "기울기", "배킹", "단계", "포탑", "불빛", "회전칸", "LOD", "옆면"];
/** 유닛 판 열쇠의 칸 이름(아래 subKey와 **같은 차례**여야 한다). */
const UNI_KEYF9 = ["종류", "회전", "평면", "시점", "기울기", "배킹", "자세", "덩이", "LOD", "크기"];
const UNI_MISS9 = { last: new Map<string, string>(), why: new Map<string, number>() };
function uniMissWhy9(kind9: string, key9: string): void {
  const prev9 = UNI_MISS9.last.get(kind9);
  UNI_MISS9.last.set(kind9, key9);
  if (!prev9) return;
  const a9 = prev9.split("|");
  const b9 = key9.split("|");
  for (let i = 0; i < b9.length; i += 1) {
    if (a9[i] === b9[i]) continue;
    const n9 = UNI_KEYF9[i] ?? `#${i}`;
    UNI_MISS9.why.set(n9, (UNI_MISS9.why.get(n9) ?? 0) + 1);
    return;
  }
}
/** 최근 창의 상위 셋 — 유닛·건물을 같은 꼴로 보인다. */
function missTop9(m9: Map<string, number>): string {
  const a9 = [...m9.entries()].sort((x9, y9) => y9[1] - x9[1]).slice(0, 3);
  return a9.length === 0 ? "-" : a9.map(([k9, v9]) => `${k9}${v9}`).join(" ");
}
const BLD_MISS9 = { last: new Map<string, string>(), why: new Map<string, number>() };
function bldMissWhy9(kind9: string, key9: string): void {
  const prev9 = BLD_MISS9.last.get(kind9);
  BLD_MISS9.last.set(kind9, key9);
  if (!prev9) return;
  const a9 = prev9.split("|");
  const b9 = key9.split("|");
  for (let i = 0; i < b9.length; i += 1) {
    if (a9[i] === b9[i]) continue;
    const n9 = BLD_KEYF9[i] ?? `#${i}`;
    BLD_MISS9.why.set(n9, (BLD_MISS9.why.get(n9) ?? 0) + 1);
    return;
  }
}
/** 가장 많이 갈린 칸 셋 — "시점210 회전칸30 불빛21" 꼴. */
function bldMissTop9(): string {
  const a9 = [...BLD_MISS9.why.entries()].sort((x9, y9) => y9[1] - x9[1]).slice(0, 3);
  return a9.length === 0 ? "-" : a9.map(([k9, v9]) => `${k9}${v9}`).join(" ");
}
type BldSprite = {
  cv: PlateImg9; ox: number; oy: number; pad: number; l: number;
  side: number; bot: number; top: number; w: number; cx: number;
  /** 임자 색 마스크(유닛과 같은 규약, 위 TintPlate9) — 건물 판 열쇠에도 색이 없다. */
  tint?: TintPlate9 | null;
};
function buildingSprite(op: UnitDrawOp, sideQ: number, B: number): BldSprite | null {
  const prev9 = headYawNow;
  headYawSet(op.headDeg === undefined ? 0
    : (((op.headDeg - (op.rotDeg ?? 0)) % 360) + 540) % 360 - 180, op.headDeg !== undefined);
  try {
    return buildingSpriteBake(op, sideQ, B);
  } finally {
    headYawSet(prev9, false);
    bldLitSet(false);
    bldSpinRawSet9(0);
  }
}
function buildingSpriteBake(
  op: UnitDrawOp, sideQ: number, B: number,
  /** 예산을 안 보고 굽는다 — 작은 판을 구울 때만 참이다(유닛 쪽 ★와 같은 손). */
  force9 = false,
): BldSprite | null {
  /* ★ 건물의 시각 밀림 칸을 6도 → **12도**로(지적: "유독 저그 쪽만 더 심해") ────────────
     밀림 각(viewYaw)은 **화면 자리**가 정한다. 그래서 같은 종류의 건물이 화면을 가로질러
     늘어서 있으면 저마다 다른 칸에 들어가 **같은 그림이 여러 벌 구워진다**. 6도 칸이면
     −36~36에서 열세 벌이다.
     그 줄이 가장 길게 서는 곳이 저그의 성큰·스포어 벽이다(사용자 화면에 성큰 일곱이
     한 줄로 있었다) — 하나가 0.45MB이니 같은 성큰이 3MB를 먹는다. 실측(perf-check
     --top, 아이폰 흉내 dpr 3): 간헐천 하나가 **세 벌 2.75MB**로 그 화면의 건물 예산
     3분의 1이었다. 종류가 아니라 **자리**가 판을 늘리고 있었다.
     칸을 두 배로 넓히면 벌 수가 절반이다. 잃는 것은 밀림의 결이 최대 6도 어긋나는
     것인데, 이 밀림은 건물이 화면 가장자리로 갈수록 살짝 기우는 정도의 몫이라 한 칸의
     차이가 눈에 잘 안 든다(유닛은 종전 6도 그대로 둔다 — 작게 그려져 칸을 넓혀도 얻는
     것이 적고, 대신 수가 많아 칸 경계를 자주 넘나든다). */
  const vq = op.viewYaw ? Math.max(-36, Math.min(36, Math.round(op.viewYaw / 12) * 12)) : 0;
  const lod = lodOf(sideQ);
  /* 공사 단계(요청: "3단계로 하고 실제 모델의 부품을 일부만 표현하다가 완성되는 형태로
     수정. 아래쪽 부품부터 표현 → 점점 위로") — stageFaces가 **부품을 골라** 준다.
     예전에는 굽는 좌표계의 아래쪽만 오려 냈는데, 그건 결과가 같지 않았다(지적):
     기둥이 반 토막 나고 지붕이 가로로 잘려 '짓는 중'이 아니라 '가려진' 것으로 보였다.
     단계가 캐시 열쇠에 들어가므로 판은 단계별로 따로 구워져 프레임 비용이 없다. */
  const stg = op.buildStage ?? 0;
  /* 불빛 깃발은 **열쇠를 만들기 전에** 세운다 — litTag가 이 값을 읽고, 아래 면 짜기도
     같은 값으로 돈다. 굽기가 끝나면 반드시 도로 끈다(finally). */
  bldLitSet(!!op.lit);
  bldSpinRawSet9(op.spin ?? 0);
  // 크기(sideQ)를 뺀 몫과 크기로 가른다 — 대타를 찾으려면 앞부분이 따로 있어야 한다.
  // 열쇠에 임자 색이 없다(유닛과 같은 마스크 규약) — 같은 건물 판을 모든 임자가 나눠 쓴다.
  const subKey = `${op.kind}|${op.rotDeg ?? 0}|${op.flat ? 1 : 0}|${vq}|${pitchTag(op.pitch)}|${B.toFixed(2)}|${stg}|${headTag(op.kind)}|${litTag(op.kind)}|${spinTag(op.kind)}`;
  const key = `${subKey}|${lod}|${sideQ}`;
  const hit = BLD_SPRITE_CACHE.get(key);
  if (hit) {
    SPRITE_PERF.bldHit += 1;
    BLD_SPRITE_CACHE.delete(key); BLD_SPRITE_CACHE.set(key, hit); return hit;
  }
  bldMissWhy9(op.kind, key);   // 왜 빗나갔나 — 열쇠의 어느 칸이 갈렸는지 센다(아래 ★)
  /* ★ 예산이 다했으면 이번 프레임엔 안 굽고, 같은 건물의 **가장 가까운 크기**를 돌려준다
     (부르는 쪽이 판의 실제 크기 bspr.side로 배율을 맞춘다 — 유닛 쪽과 같은 약이다). */
  if (!force9 && (BAKEW9.on || !bakeOk9(bldBakeLeft9))) {
    if (BAKEW9.on) bakeWant9(key, { ...op }, sideQ, B, subKey, lod, true);   // 일꾼에 청한다(위 BAKEW9) — 이 프레임은 대타
    const sizes9 = BLD_SPRITE_SIZES.get(subKey);
    if (sizes9) {
      const best9 = pickSubSize9(sizes9, sideQ, SUB_MAX_HARD9)
        ?? pickSubSize9(sizes9, sideQ, Infinity);   // 마지막 수단(위 ★)
      const alt9 = best9 ? BLD_SPRITE_CACHE.get(best9) : undefined;
      if (alt9) {
        // 대타는 LRU를 안 되살린다 — 유닛 쪽의 ★ 주석과 같은 까닭이다.
        SPRITE_PERF.bldHit += 1;
        SPRITE_PERF.bldDefer += 1;
        return alt9;
      }
    }
    // 대타가 하나도 없으면 작게 굽는다(유닛 쪽 ★와 같은 약 — 건물 판은 더 크므로 이득도 더 크다).
    /* ★ 그 작은 판도 **천장 아래에서만** 굽는다(실측: 핵 창에서 한 프레임 굽기 230ms · 2초에 건물 261장
       573ms) ─────────────────────────────────────────────────────────────────────────────────────
       유닛 쪽에는 이 문이 있는데(BAKE_HARD_MS9의 ★) 건물 쪽에는 없었다. force9로 들어가는 이 길은 장수
       예산도 ms 예산도 **아예 안 본다** — 처음 보는 열쇠가 한꺼번에 수십·수백 장 생기는 순간(핵으로 판이
       갈리는 그 프레임)에는 그것들을 한 프레임에 다 구웠다. 폰의 천장이 24ms인데 230ms를 쓴 까닭이 이것이다.
       천장을 넘으면 이번 프레임엔 이 건물을 **안 그린다**: 다음 프레임에 예산이 되살아나 곧 들어오고,
       한두 프레임 늦게 나타나는 것은 눈에 안 띄지만 230ms 덜컥임은 보인다. */
    /* 일꾼 모드에서는 건물이 제 계수기(smallBldLeft9)를 쓴다 — 모든 건물이 이 길로 오므로 유닛 몫을 다 먹으면
       유닛이 직접 그리기(가장 비싼 길)로 떨어진다(실측: 직접 606장/프레임 → 700ms). 옛 길은 그대로 나눠 쓴다. */
    if (!bakeHardOk9() || (BAKEW9.on ? smallBldLeft9 : smallBakeLeft9) <= 0) return null;
    const small9 = Math.max(8, Math.round(sideQ / BAKE_SMALL_K9));
    if (small9 < sideQ) {
      if (BAKEW9.on) smallBldLeft9 -= 1; else smallBakeLeft9 -= 1;
      return buildingSpriteBake(op, small9, B, true);
    }
  }
  bldBakeLeft9 -= 1;
  SPRITE_PERF.bldBake += 1;
  const pBb9 = PERF9 ? pNow() : 0;
  const tBb9 = pNow();
  /* ★ 굽는 시각 밀림도 **열쇠의 칸(vq)** 그대로(지적: "3D에서 세로 중앙 좌우쪽 건물들이 자꾸 시점이 흔들리는 문제 —
     서플라이·터렛처럼 부품이 변하는 경우") — 열쇠는 12도 칸인데 면은 op.viewYaw 원값으로 지어(resolveShapeFaces
     안에서 6도 칸) 같은 열쇠 안에 두 기하가 섞였다: viewYaw 4도와 −4도는 열쇠가 둘 다 0인데 면은 +6·−6도로 다르다.
     붙박이 건물은 한 번 굽고 끝이라 안 드러났지만, 포탑 각·불빛처럼 열쇠가 자주 바뀌는 건물은 굽을 때마다 **먼저
     온 건물의 각**으로 구워져, 같은 열쇠를 나눠 쓰는 이웃 건물의 판이 +6과 −6 사이를 오갔다. 칸 값으로 지으면
     같은 열쇠는 늘 같은 기하다. */
  const r9 = rasterBld9(op, sideQ, B, lod);
  if (!r9) return null;
  const { pad, l, box: box9 } = r9;
  const cr9 = { cv: r9.cv as HTMLCanvasElement, ox: r9.ox, oy: r9.oy };
  const tintB9: TintPlate9 | null = r9.tint ? { ...r9.tint, cv: r9.tint.cv as HTMLCanvasElement } : null;
  const entry: BldSprite = {
    cv: cr9.cv, ox: cr9.ox, oy: cr9.oy,
    pad, l, side: sideQ, bot: box9.bot, top: box9.top, w: box9.w, cx: box9.cx, tint: tintB9,
  };
  BLD_SPRITE_CACHE.set(key, entry);
  // 이 열쇠로 구운 크기를 색인에 적는다(유닛 쪽 SPRITE_SIZES와 같은 규약).
  noteSub9(BLD_SPRITE_SIZES, subKey, sideQ, key);
  bldSpriteBytes.n += canvasBytes(cr9.cv) + (tintB9 ? canvasBytes(tintB9.cv) : 0);
  trimBoth9();
  SPRITE_PERF.noteBake(op.kind, pNow() - tBb9, true);
  if (PERF9) pAdd("굽기:건물판", pNow() - pBb9);
  return entry;
}
// 포톤은 플라즈마와 같은 그림이다(CSS의 .scr-tracer-plasma, .scr-tracer-photon 합집합).
FX_BEAM.photon = FX_BEAM.plasma;
FX_IMPACT.photon = FX_IMPACT.plasma;
/** 맞은 **몸에서** 튀는 것(요청: "생명체는 피 프로토스는 에너지 기계는 불꽃 등등을
 *  작게 맞은 부위에") — 죽음 효과(scr-die-*)와 같은 넷·같은 색이다. 죽을 때 크게
 *  한 번 터지는 것이 맞을 때마다 작게 튄다고 보면 된다.
 *  core는 맞은 자리의 얼룩, drop은 사방으로 튀는 낱알의 색·개수다. */
/* flash는 맞는 순간의 섬광(결마다 흰빛에 제 색을 한 방울) — 후보판의 팔레트 그대로. */
const FX_MAT: Record<string, { core: string; drop: string; deep: string; flash: string; n: number; r: number }> = {
  bio: { core: "rgba(200,35,27,0.95)", drop: "rgba(239,90,69,0.95)", deep: "rgba(122,18,16,0.95)", flash: "#ffd9d2", n: 5, r: 0.62 },
  zerg: { core: "rgba(178,30,40,0.95)", drop: "rgba(232,78,78,0.95)", deep: "rgba(104,14,22,0.95)", flash: "#ffd4cf", n: 6, r: 0.7 },   // 보라끼 걷고 붉게(요청)
  toss: { core: "rgba(143,208,255,0.95)", drop: "rgba(230,244,255,0.95)", deep: "rgba(58,143,255,0.95)", flash: "#ffffff", n: 5, r: 0.66 },
  mech: { core: "rgba(255,138,61,0.95)", drop: "rgba(255,209,102,0.95)", deep: "rgba(255,90,31,0.95)", flash: "#fff4d0", n: 5, r: 0.62 },
};
/** 다친 건물의 상처 — **캔버스 판**(요청: "어쨌든 돔효과 캔버스로 옮기긴 해야하지") ──────────────
 *  스팬 시절의 그림(.scr-wound-*)을 그대로 옮긴 작은 그림 여섯 장이다. 한 번만 굽고 그릴 때는
 *  blit 한 번이라, 불꽃이 백 개여도 층은 늘지 않는다(옛 판은 불꽃 하나가 가짜 요소 둘에 흐리기와
 *  섞임을 지고 **끝없이** 돌았다 — 브라우저가 층마다 따로 그리고 배경까지 읽어 왔다).
 *  기준 상자는 64(둥근 것)·48×128(혀)이고, 그릴 때 제 크기로 늘린다. */
const WOUND_SPR9 = new Map<string, HTMLCanvasElement>();
function woundSpr9(name: string): HTMLCanvasElement {
  const hit9 = WOUND_SPR9.get(name);
  if (hit9) return hit9;
  const tongue9 = name === "flame" || name === "candle";
  const cw9 = tongue9 ? 48 : 64;
  const ch9 = tongue9 ? 128 : 64;
  const cv9 = newCanvas9("상처");
  cv9.width = cw9; cv9.height = ch9;
  const c2 = cv9.getContext("2d");
  if (c2) {
    if (tongue9) {
      /* 혀 — 밑동이 넓고 끝이 뾰족하다. 그러데이션은 밑에서 위로(CSS의 to top 그대로). */
      const g9 = c2.createLinearGradient(0, ch9, 0, 0);
      if (name === "flame") {
        g9.addColorStop(0, "rgba(255,120,30,0.95)"); g9.addColorStop(0.3, "rgba(255,200,70,0.95)");
        g9.addColorStop(0.48, "rgba(255,240,160,0.85)"); g9.addColorStop(0.7, "rgba(255,140,40,0.5)");
        g9.addColorStop(1, "rgba(255,140,40,0)");
      } else {
        g9.addColorStop(0, "rgba(120,220,255,0.95)"); g9.addColorStop(0.35, "rgba(210,245,255,0.95)");
        g9.addColorStop(0.6, "rgba(255,255,255,0.7)"); g9.addColorStop(1, "rgba(255,255,255,0)");
      }
      c2.fillStyle = g9;
      c2.beginPath();
      /* 통통한 혀 — 밑동에서 곧 제 폭을 채우고 위 3분의 1에서만 좁아진다(CSS의
         border-radius: 50% 50% 40% 40% / 80% 80% 25% 25% 가 만들던 덩이 꼴이다.
         바로 뾰족해지면 바늘이 되어 불꽃으로 안 읽힌다). */
      c2.moveTo(cw9 * 0.5, ch9);
      c2.bezierCurveTo(cw9 * -0.02, ch9 * 0.94, cw9 * 0.04, ch9 * 0.46, cw9 * 0.28, ch9 * 0.13);
      c2.bezierCurveTo(cw9 * 0.4, ch9 * -0.02, cw9 * 0.6, ch9 * -0.02, cw9 * 0.72, ch9 * 0.13);
      c2.bezierCurveTo(cw9 * 0.96, ch9 * 0.46, cw9 * 1.02, ch9 * 0.94, cw9 * 0.5, ch9);
      c2.closePath(); c2.fill();
    } else if (name === "drop") {
      /* 핏방울 — 위가 밝고 아래가 검붉다(CSS의 to top 그대로). 둘레의 옅은 번짐은 box-shadow 자리. */
      const g9 = c2.createLinearGradient(0, ch9, 0, 0);
      g9.addColorStop(0, "rgba(140,20,24,0.2)"); g9.addColorStop(1, "rgba(222,52,52,0.95)");
      c2.fillStyle = g9;
      c2.beginPath(); c2.ellipse(cw9 / 2, ch9 / 2, cw9 * 0.42, ch9 * 0.47, 0, 0, Math.PI * 2); c2.fill();
    } else {
      /* 둥근 후광 셋(잉걸·연기·사이언 아지랑이) — CSS의 radial-gradient 칸을 그대로 옮긴다. */
      const cy9 = name === "ember" || name === "haze" ? ch9 * 0.7 : ch9 * 0.5;
      const g9 = c2.createRadialGradient(cw9 / 2, cy9, 0, cw9 / 2, cy9, cw9 / 2);
      if (name === "ember") {
        g9.addColorStop(0, "rgba(255,170,60,0.5)"); g9.addColorStop(0.16, "rgba(255,170,60,0.5)");
        g9.addColorStop(0.4, "rgba(200,70,20,0.28)"); g9.addColorStop(0.62, "rgba(200,70,20,0)");
      } else if (name === "haze") {
        g9.addColorStop(0, "rgba(150,230,255,0.45)"); g9.addColorStop(0.18, "rgba(150,230,255,0.45)");
        g9.addColorStop(0.4, "rgba(90,170,220,0.2)"); g9.addColorStop(0.62, "rgba(90,170,220,0)");
      } else {
        g9.addColorStop(0, "rgba(120,120,118,0.42)"); g9.addColorStop(0.45, "rgba(120,120,118,0.42)");
        g9.addColorStop(0.72, "rgba(120,120,118,0)");
      }
      c2.fillStyle = g9;
      c2.fillRect(0, 0, cw9, ch9);
    }
  }
  WOUND_SPR9.set(name, cv9);
  return cv9;
}
/** 되풀이 삼각파(0→1→0) — CSS의 `alternate`가 하는 일이다. */
const triW9 = (x9: number): number => { const u9 = x9 - Math.floor(x9); return u9 < 0.5 ? u9 * 2 : 2 - u9 * 2; };
/** 부드럽게(ease-in-out) — 삼각파의 모서리를 죽인다. */
const easeW9 = (u9: number): number => u9 * u9 * (3 - 2 * u9);
/** 밑동을 축으로 세워 그린다 — 혀(불꽃·촛불)는 transform-origin이 50% 100%였다.
 *  돌릴 때는 바탕 변환 **위에** 겹치고 save/restore로 돌려놓는다(아래 ★). */
function tongueW9(ctx: CanvasRenderingContext2D, spr9: HTMLCanvasElement,
  bx9: number, by9: number, w9: number, h9: number, rot9: number, a9: number): void {
  if (a9 <= 0.01 || w9 < 0.3) return;
  ctx.globalAlpha = a9;
  if (rot9 === 0) { ctx.drawImage(spr9, bx9 - w9 / 2, by9 - h9, w9, h9); return; }
  /* ★ 바탕 변환을 **짐작하지 않는다**(수리: "트레이서 위치도 이상하고") ─────────────────────
     앞판은 끝나고 setTransform(Bd,0,0,Bd,0,0)로 되돌렸다. 그것은 '이 자리의 바탕은 늘 그것'이라는
     짐작인데, 한 번이라도 틀리면 **그 뒤에 그리는 것이 전부 밀린다** — 효과 다음에 그려지는
     트레이서가 어긋난 것이 그 모양이다. save/restore는 무엇이든 있던 그대로 돌려놓는다.
     삯도 문제가 안 된다: 파편 수천 개가 아니라 효과 몇 개당 한 번이다. */
  ctx.save();
  const c9 = Math.cos(rot9); const s9 = Math.sin(rot9);
  ctx.transform(c9, s9, -s9, c9, bx9, by9);
  ctx.drawImage(spr9, -w9 / 2, -h9, w9, h9);
  ctx.restore();
}
/** 다친 건물 **하나**의 상처 — 불꽃 여럿을 여기서 흩는다(op은 건물마다 한 장이다).
 *  흩는 자리는 건물 번호와 불꽃 번호의 **순수 함수**라, 엔진이 쓰던 해시를 그대로 다시 돌린다
 *  (프레임마다 떨리면 안 된다 — 자리는 무작위가 아니라 결정된 값이다).
 *  f.wrace가 결 · f.size가 불꽃 상자 · f.mx·my가 흩는 자 · f.tier가 단 · f.clk가 시계(초)다.
 *  CSS 시절의 키프레임을 식으로 옮겼다(자리·주기·세기 모두 그 값 그대로). */
export function drawWound9(ctx: CanvasRenderingContext2D, f: FxOp, ax: number, ay: number, zoom: number, Bd9: number): void {
  const W9 = (f.size ?? 3) * zoom;
  if (W9 < 1.2) return;                       // 한 화소도 안 되는 것은 그리지 않는다
  const t9 = f.clk ?? 0;
  const lv2 = (f.tier ?? 1) >= 2;
  const race9 = f.wrace ?? "terran";
  const op0 = ctx.globalAlpha;
  const gco0 = ctx.globalCompositeOperation;
  /* 불빛은 **더하기**로 겹친다 — CSS의 `mix-blend-mode: screen` 자리다. 다만 여기서는 우리가 이미
     칠하고 있는 한 장 안에서 일어나므로, 합성 층도 배경 읽기도 생기지 않는다(그것이 옮긴 까닭이다). */
  if (race9 !== "zerg") ctx.globalCompositeOperation = "lighter";
  const sx9 = (f.mx ?? 0) * zoom;
  const sy9 = (f.my ?? 0) * zoom;
  /* 수는 상처가 심할수록 많다(요청): 1단 2개 · 2단 5개. */
  const n9 = lv2 ? 5 : 2;
  for (let kk9 = 0; kk9 < n9; kk9 += 1) {
  const h9 = (((f.seed ?? 0) * 2654435761 + kk9 * 40503) >>> 0);
  /* 흩는 폭 ±0.16 · 살짝 왼쪽으로(−0.08) — 엔진이 쓰던 그 식 그대로다. */
  const x9 = ax + (((h9 % 1000) / 1000 - 0.5) * 0.32 - 0.08) * sx9;
  const y9 = ay + ((((h9 >>> 10) % 1000) / 1000 - 0.5) * 0.32) * sy9;
  const top9 = y9 - W9 / 2;                   // 스팬 상자(W×W)의 위 모서리 — CSS의 translate(-50%,-50%)
  const dl9 = ((h9 >>> 20) % 100) / 100;      // animation-delay(0~1초)
  if (race9 === "terran" || race9 === "toss") {
    /* 밑동 후광 — 테란은 잉걸(0.62초), 프로토스는 사이언 아지랑이(1.9초). */
    const glowP9 = easeW9(triW9((t9 + dl9) / (race9 === "terran" ? 0.62 : 1.9) / 2));
    const ga9 = race9 === "terran" ? 0.72 + 0.28 * glowP9 : 0.5 + 0.35 * glowP9;
    const gs9 = race9 === "terran" ? 0.88 + 0.2 * glowP9 : 0.9 + 0.16 * glowP9;
    ctx.globalAlpha = ga9;
    ctx.drawImage(woundSpr9(race9 === "terran" ? "ember" : "haze"),
      x9 - (W9 * gs9) / 2, y9 - (W9 * gs9) / 2, W9 * gs9, W9 * gs9);
    /* 혀 — 테란은 하나(0.5초), 프로토스는 둘(0.55초·0.42초, 뒤엣것은 오른쪽으로 치우쳐 작다). */
    const flame9 = woundSpr9(race9 === "terran" ? "flame" : "candle");
    if (race9 === "terran") {
      const u9 = easeW9(triW9((t9 + dl9) / 0.5 / 2));
      tongueW9(ctx, flame9, x9, top9 + W9 * 0.58,
        W9 * 0.34 * (0.92 + 0.12 * u9), W9 * 1.5 * (0.8 + 0.35 * u9),
        ((-4 + 7 * u9) * Math.PI) / 180, 0.8 + 0.2 * u9);
    } else {
      const u9 = easeW9(triW9((t9 + dl9) / 0.55 / 2));
      tongueW9(ctx, flame9, x9, top9 + W9 * 0.6,
        W9 * 0.22 * (1 + 0.08 * u9), W9 * 1.7 * (0.82 + 0.3 * u9), 0, 0.75 + 0.25 * u9);
      const v9 = easeW9(triW9((t9 + dl9 + 0.2) / 0.42 / 2));
      tongueW9(ctx, flame9, x9 + W9 * 0.12, top9 + W9 * 0.6,
        W9 * 0.14 * (1 + 0.08 * v9), W9 * 1.2 * (0.82 + 0.3 * v9), 0, 0.75 + 0.25 * v9);
    }
    /* 연기는 **2단(체력 빨강)에서만**(요청) — 상자 위로 피어올라 퍼지며 사라진다(2.1초). */
    if (race9 === "terran" && lv2) {
      const s9 = ((t9 + dl9) / 2.1) % 1;
      const sa9 = s9 < 0.25 ? (s9 / 0.25) * 0.55 : 0.55 * (1 - (s9 - 0.25) / 0.75);
      const ss9 = W9 * 0.62 * (0.5 + s9);
      ctx.globalAlpha = Math.max(0, sa9);
      ctx.drawImage(woundSpr9("smoke"), x9 - ss9 / 2, top9 - ss9 * (0.5 + 2.2 * s9), ss9, ss9);
    }
  } else {
    /* 저그 — 솟구치는 피 둘. x는 등속, y는 포물선(위로 솟았다 떨어짐)이라 중력을 탄다.
       CSS 키프레임(11칸)의 식을 그대로 쓴다: y% = 10 − 280u + 350u². */
    const drop9 = woundSpr9("drop");
    const dw9 = W9 * 0.34; const dh9 = dw9 * 1.8;
    const oy9 = top9 + W9 * 0.46;
    const spurt9 = (per9: number, off9: number, w9: number, sx9: number, dir9: number): void => {
      const u9 = (((t9 + dl9 + off9) / per9) % 1 + 1) % 1;
      const py9 = (10 - 280 * u9 + 350 * u9 * u9) / 100;
      const px9 = dir9 * (1.5 * u9);
      const a9 = u9 < 0.1 ? u9 / 0.1 : u9 < 0.6 ? 1 : Math.max(0, 1 - (u9 - 0.6) / 0.4);
      const k9 = u9 < 0.4 ? 0.5 + 1.25 * u9 : 1;
      const hh9 = dh9 * (u9 < 0.4 ? 0.62 + 1.57 * u9 : 0.9);
      tongueW9(ctx, drop9, x9 + W9 * sx9 + px9 * w9, oy9 + py9 * hh9 + hh9,
        w9 * k9, hh9, (dir9 * (-15 + 95 * u9) * Math.PI) / 180, a9);
    };
    spurt9(1.1, 0, dw9, 0, 1);
    spurt9(1.3, 0.55, W9 * 0.26, -0.08, -1);
  }
  }
  ctx.globalAlpha = op0;
  ctx.globalCompositeOperation = gco0;
}
/** 옛 DOM 효과 층 — **캔버스 판**(요청: "나머지 효과도 캔버스로 옮겨줘") ─────────────────────────
 *  상처(drawWound9)와 같은 자다. 스팬 시절의 그림(.scr-motion-*·.scr-fx-*)을 그대로 옮긴다:
 *  그러데이션은 작은 판으로 한 번만 굽고, 키프레임은 식으로 적어 나이(age)로 잰다.
 *  합성 층도 배경 읽기도 안 생긴다 — 우리가 이미 칠하는 한 장 안에서 겹친다. */
const DOM_SPR9 = new Map<string, HTMLCanvasElement>();
/** 이름표로 한 번만 굽는 작은 판 — 그린 뒤로는 blit만 한다. */
function domSpr9(key9: string, draw9: (c9: CanvasRenderingContext2D, S9: number) => void, S9 = 64): HTMLCanvasElement {
  const hit9 = DOM_SPR9.get(key9);
  if (hit9) return hit9;
  const cv9 = newCanvas9("효과판");
  cv9.width = S9; cv9.height = S9;
  const c29 = cv9.getContext("2d");
  if (c29) draw9(c29, S9);
  DOM_SPR9.set(key9, cv9);
  return cv9;
}
/** CSS `radial-gradient(circle at cx cy, …)` 한 겹 — 기본 크기는 farthest-corner다(그 자가 CSS의 자다). */
function radLay9(c9: CanvasRenderingContext2D, S9: number, stops9: [number, string][], cx9 = 0.5, cy9 = 0.5): void {
  const r9 = Math.hypot(Math.max(cx9, 1 - cx9), Math.max(cy9, 1 - cy9)) * S9;
  const g9 = c9.createRadialGradient(S9 * cx9, S9 * cy9, 0, S9 * cx9, S9 * cy9, r9);
  for (const [p9, col9] of stops9) g9.addColorStop(Math.min(1, p9), col9);
  c9.fillStyle = g9;
  c9.fillRect(0, 0, S9, S9);
}
/** 세 점 사이의 잇기(키프레임 세 칸) — CSS 키프레임을 식으로 옮길 때 쓰는 자. */
const key3v9 = (u9: number, a9: number, b9: number, c9: number, m9: number): number => (u9 < m9
  ? a9 + ((b9 - a9) * u9) / m9 : b9 + ((c9 - b9) * (u9 - m9)) / (1 - m9));
/** cubic-bezier(x1,y1,x2,y2)의 진행 — 이분법 여덟 번이면 화면에선 구분이 안 된다. */
function cbez9(x19: number, y19: number, x29: number, y29: number, t9: number): number {
  let lo9 = 0; let hi9 = 1; let m9 = t9;
  for (let i9 = 0; i9 < 8; i9 += 1) {
    m9 = (lo9 + hi9) / 2;
    const mm9 = 1 - m9;
    const x9 = 3 * mm9 * mm9 * m9 * x19 + 3 * mm9 * m9 * m9 * x29 + m9 * m9 * m9;
    if (x9 < t9) lo9 = m9; else hi9 = m9;
  }
  const mm9 = 1 - m9;
  return 3 * mm9 * mm9 * m9 * y19 + 3 * mm9 * m9 * m9 * y29 + m9 * m9 * m9;
}
/** 죽음·붕괴·마인의 화구 팔레트(CSS의 radial-gradient 칸 그대로). */
const DOM_RAD9: Record<string, [number, string][]> = {
  "die-bio": [[0, "rgba(230,80,60,0.9)"], [0.55, "rgba(160,40,30,0.5)"], [0.75, "rgba(160,40,30,0)"]],
  "die-mech": [[0, "rgba(255,220,130,0.95)"], [0.45, "rgba(255,120,50,0.75)"], [0.7, "rgba(255,120,50,0)"]],
  "die-toss": [[0, "rgba(210,235,255,0.95)"], [0.5, "rgba(110,170,255,0.6)"], [0.75, "rgba(110,170,255,0)"]],
  "die-zerg": [[0, "rgba(235,60,55,0.92)"], [0.55, "rgba(140,20,24,0.6)"], [0.75, "rgba(140,20,24,0)"]],
  "die-cocoon": [[0, "rgba(224,164,138,0.9)"], [0.55, "rgba(138,106,154,0.5)"], [0.75, "rgba(138,106,154,0)"]],
  mine: [[0, "rgba(255,228,150,0.95)"], [0.4, "rgba(255,110,50,0.85)"], [0.6, "rgba(120,60,30,0.4)"], [0.72, "rgba(120,60,30,0)"]],
  "clp-terran-core": [[0, "rgba(255,224,140,0.95)"], [0.4, "rgba(255,120,50,0.85)"], [0.7, "rgba(255,120,50,0)"]],
  "clp-terran-smoke": [[0, "rgba(120,120,125,0.55)"], [0.55, "rgba(80,80,85,0.35)"], [0.75, "rgba(80,80,85,0)"]],
  "clp-zerg-core": [[0, "rgba(222,74,62,0.9)"], [0.5, "rgba(132,28,30,0.6)"], [0.72, "rgba(132,28,30,0)"]],
  "clp-zerg-smoke": [[0, "rgba(124,58,48,0.5)"], [0.55, "rgba(82,38,34,0.3)"], [0.75, "rgba(82,38,34,0)"]],
  "clp-toss-core": [[0, "rgba(255,255,255,0.98)"], [0.35, "rgba(170,215,255,0.9)"], [0.55, "rgba(110,170,255,0.6)"], [0.74, "rgba(110,170,255,0)"]],
  irrad: [[0, "rgba(190,255,90,0.55)"], [0.45, "rgba(140,220,60,0.3)"], [0.7, "rgba(140,220,60,0)"]],
  mael: [[0, "rgba(190,120,255,0.45)"], [0.45, "rgba(190,120,255,0.45)"], [0.65, "rgba(140,80,220,0.25)"], [0.75, "rgba(140,80,220,0)"]],
  yamato: [[0, "rgba(255,255,255,0.95)"], [0.16, "rgba(255,255,255,0.95)"], [0.38, "rgba(160,205,255,0.85)"], [0.62, "rgba(95,145,255,0.4)"], [0.72, "rgba(95,145,255,0)"]],
};
/** 한 겹짜리 화구 판을 든다(위 표) — 없는 이름이면 흰 점. */
const radOf9 = (n9: string): HTMLCanvasElement => domSpr9(`r:${n9}`, (c9, S9) => {
  radLay9(c9, S9, DOM_RAD9[n9] ?? [[0, "rgba(255,255,255,0.9)"], [0.7, "rgba(255,255,255,0)"]]);
});
/** 겹이 여럿인 그림(플레이그·인스네어) — CSS는 **먼저 적은 겹이 위**라 뒤에서부터 칠한다. */
const CAST_LAYERS9: Record<string, { s: [number, string][]; x: number; y: number }[]> = {
  plague: [
    { s: [[0, "rgba(190,60,30,0.5)"], [0.18, "rgba(190,60,30,0.5)"], [0.2, "rgba(190,60,30,0)"]], x: 0.35, y: 0.4 },
    { s: [[0, "rgba(170,50,25,0.45)"], [0.22, "rgba(170,50,25,0.45)"], [0.24, "rgba(170,50,25,0)"]], x: 0.65, y: 0.55 },
    { s: [[0, "rgba(200,70,35,0.4)"], [0.15, "rgba(200,70,35,0.4)"], [0.17, "rgba(200,70,35,0)"]], x: 0.45, y: 0.72 },
    { s: [[0, "rgba(150,40,20,0.3)"], [0.6, "rgba(150,40,20,0.3)"], [0.7, "rgba(150,40,20,0)"]], x: 0.5, y: 0.5 },
  ],
  ensnare: [
    { s: [[0, "rgba(120,200,60,0.45)"], [0.3, "rgba(120,200,60,0.45)"], [0.34, "rgba(120,200,60,0)"]], x: 0.4, y: 0.4 },
    { s: [[0, "rgba(100,180,50,0.4)"], [0.26, "rgba(100,180,50,0.4)"], [0.3, "rgba(100,180,50,0)"]], x: 0.62, y: 0.62 },
    { s: [[0, "rgba(90,170,40,0.3)"], [0.55, "rgba(90,170,40,0.3)"], [0.65, "rgba(90,170,40,0)"]], x: 0.5, y: 0.5 },
  ],
};
/** 다크 스웜의 덩이 자리(CSS의 radial-gradient 목록 그대로) — [x%, y%, 알파, 반지름%]. */
const SWARM_A9: [number, number, number, number][] = [
  [55.9, 51.3, 0.52, 17.0], [41.0, 55.3, 0.60, 21.0], [53.9, 37.1, 0.68, 25.0], [56.9, 64.4, 0.52, 20.4],
  [33.2, 43.2, 0.60, 24.4], [68.7, 43.0, 0.68, 19.9], [40.1, 69.3, 0.52, 23.9], [43.8, 27.5, 0.60, 19.3],
  [71.1, 63.2, 0.68, 23.3], [24.2, 54.8, 0.52, 18.7], [66.6, 28.0, 0.60, 22.7], [52.7, 78.8, 0.68, 18.1],
  [27.6, 29.8, 0.52, 22.1], [81.3, 49.8, 0.60, 17.6], [26.2, 72.1, 0.68, 21.6],
];
const SWARM_B9: [number, number, number, number][] = [
  [52.1, 56.0, 0.24, 13.0], [40.3, 44.7, 0.29, 17.9], [63.9, 46.5, 0.34, 15.1], [40.7, 64.1, 0.28, 20.0],
  [47.0, 31.0, 0.33, 17.2], [66.6, 63.2, 0.27, 14.4], [27.0, 51.6, 0.32, 19.3], [67.1, 32.0, 0.26, 16.5],
  [49.5, 76.4, 0.31, 13.7], [31.6, 29.1, 0.25, 18.6], [79.1, 53.1, 0.30, 15.8],
];
/** 구름 한 벌을 굽는다 — 큰 한 장이 아니라 작은 덩이 여럿이라야 과녁이 안 된다(CSS 주석의 까닭 그대로). */
const swarmSpr9 = (b9: boolean): HTMLCanvasElement => domSpr9(`swarm:${b9 ? "b" : "a"}`, (c9, S9) => {
  for (const [x9, y9, al9, r9] of (b9 ? SWARM_B9 : SWARM_A9)) {
    const rr9 = (r9 / 100) * Math.hypot(Math.max(x9 / 100, 1 - x9 / 100), Math.max(y9 / 100, 1 - y9 / 100)) * S9;
    const g9 = c9.createRadialGradient((x9 / 100) * S9, (y9 / 100) * S9, 0, (x9 / 100) * S9, (y9 / 100) * S9, rr9);
    const rgb9 = b9 ? "236,146,56" : "128,62,18";
    g9.addColorStop(0, `rgba(${rgb9},${al9})`);
    g9.addColorStop(1, `rgba(${rgb9},0)`);
    c9.fillStyle = g9;
    c9.fillRect(0, 0, S9, S9);
  }
}, 192);
/** 스캔 별가루 — 네 갈래 별(CSS의 clip-path 다각형 그대로), 작은 별 하나를 45도로 겹친다. */
const dustSpr9 = (): HTMLCanvasElement => domSpr9("dust", (c9, S9) => {
  const star9 = (k9: number, al9: number, rot9: number): void => {
    const pts9 = [[50, 0], [57, 43], [100, 50], [57, 57], [50, 100], [43, 57], [0, 50], [43, 43]];
    c9.save();
    c9.translate(S9 / 2, S9 / 2); c9.rotate(rot9); c9.scale(k9, k9); c9.translate(-S9 / 2, -S9 / 2);
    c9.globalAlpha = al9;
    c9.fillStyle = "rgba(238,248,255,0.92)";
    c9.beginPath();
    pts9.forEach(([px9, py9], i9) => { const X9 = (px9 / 100) * S9; const Y9 = (py9 / 100) * S9; if (i9 === 0) c9.moveTo(X9, Y9); else c9.lineTo(X9, Y9); });
    c9.closePath(); c9.fill();
    c9.restore();
  };
  star9(1, 1, 0);
  star9(0.55, 0.65, Math.PI / 4);
}, 32);
/** 리콜의 소용돌이 — conic-gradient를 부채꼴 일흔둘로 흉내 낸다(한 번만 굽는다). */
const recallSpr9 = (): HTMLCanvasElement => domSpr9("recall", (c9, S9) => {
  const at9 = (u9: number): number => {           // CSS 칸: 0→.55 · 30%→0 · 50%→.55 · 80%→0 · 100%→.55
    if (u9 < 0.3) return 0.55 * (1 - u9 / 0.3);
    if (u9 < 0.5) return 0.55 * ((u9 - 0.3) / 0.2);
    if (u9 < 0.8) return 0.55 * (1 - (u9 - 0.5) / 0.3);
    return 0.55 * ((u9 - 0.8) / 0.2);
  };
  const N9 = 180;   /* 부채꼴이 성기면 이음매가 줄무늬로 보인다 — 한 번만 굽는 판이라 촘촘해도 값이 없다. */
  for (let i9 = 0; i9 < N9; i9 += 1) {
    c9.globalAlpha = at9((i9 + 0.5) / N9);
    c9.fillStyle = "rgb(120,180,255)";
    c9.beginPath();
    c9.moveTo(S9 / 2, S9 / 2);
    c9.arc(S9 / 2, S9 / 2, S9 / 2, (i9 / N9) * Math.PI * 2 - Math.PI / 2, ((i9 + 1.02) / N9) * Math.PI * 2 - Math.PI / 2);
    c9.closePath(); c9.fill();
  }
});
/** 디스럽션 웹 — 바큇살 열둘 + 그 살을 잇는 고리, 그 아래 보랏빛 그늘. */
const dwebSpr9 = (): HTMLCanvasElement => domSpr9("dweb", (c9, S9) => {
  const R9 = S9 / 2;
  const RR9 = Math.hypot(0.5, 0.5) * S9;          // CSS 백분율의 자(farthest-corner)
  c9.beginPath(); c9.arc(R9, R9, R9, 0, Math.PI * 2); c9.clip();   // border-radius: 50%
  radLay9(c9, S9, [[0, "rgba(46,32,70,0.6)"], [0.52, "rgba(46,32,70,0.6)"], [0.74, "rgba(38,26,58,0.38)"], [0.88, "rgba(38,26,58,0)"]]);
  c9.strokeStyle = "rgba(186,170,235,0.42)";
  c9.lineWidth = Math.max(0.6, S9 / 110);
  for (let r9 = 0.09; r9 < 1; r9 += 0.09) {      // 고리 — CSS의 repeating-radial 간격(9%)
    c9.beginPath(); c9.arc(R9, R9, r9 * RR9, 0, Math.PI * 2); c9.stroke();
  }
  c9.strokeStyle = "rgba(186,170,235,0.5)";
  c9.lineWidth = Math.max(0.7, S9 / 120);
  for (let k9 = 0; k9 < 12; k9 += 1) {            // 바큇살 열둘
    const a9 = (k9 / 12) * Math.PI * 2;
    c9.beginPath(); c9.moveTo(R9, R9); c9.lineTo(R9 + Math.cos(a9) * R9, R9 + Math.sin(a9) * R9); c9.stroke();
  }
}, 128);
/** 용접 실 한 올 — 밑동(앵커 쪽)이 희고 끝으로 갈수록 스러진다. 둘레의 옅은 빛무리는 box-shadow 자리. */
const weldSpr9 = (): HTMLCanvasElement => domSpr9("weld", (c9, S9) => {
  const g9 = c9.createLinearGradient(0, 0, 0, S9);
  g9.addColorStop(0, "#eafcff"); g9.addColorStop(0.65, "#6fe4ff"); g9.addColorStop(1, "rgba(90,230,255,0)");
  c9.globalAlpha = 0.45; c9.fillStyle = g9; c9.fillRect(S9 * 0.25, 0, S9 * 0.5, S9);
  c9.globalAlpha = 1; c9.fillRect(S9 * 0.42, 0, S9 * 0.16, S9);
}, 64);
/** 럴커 흙덩이의 튀는 방향(CSS의 nth-child 값 그대로) — [dx%, dy%, 지연, 색]. */
const CLODS9: [number, number, number, string][] = [
  [-260, -240, 0, "#7a563a"], [210, -300, 0, "#6b4a2e"], [-120, -380, 0.04, "#5a3d26"],
  [300, -180, 0.07, "#7a563a"], [40, -320, 0.02, "#6b4a2e"],
];
/** 옛 DOM 효과 하나 — f.style이 갈래, f.sub가 결, f.age가 나이(초)다.
 *  CSS 키프레임을 식으로 옮겼다(자리·주기·세기 모두 그 값 그대로). */
export function drawDomFx9(ctx: CanvasRenderingContext2D, f: FxOp, ax: number, ay: number,
  zoom: number, Bd9: number, tz9: number): void {
  const W9 = (f.size ?? 8) * zoom;
  if (W9 < 1) return;
  const u0 = f.age ?? 0;
  if (u0 < 0) return;
  const op09 = ctx.globalAlpha;
  const gco09 = ctx.globalCompositeOperation;
  /** 가운데를 축으로 판을 얹는다 — 크기 k9배, 세로 밀림 dy9(화면 px). */
  const blit9 = (spr9: HTMLCanvasElement, k9: number, al9: number, dy9 = 0): void => {
    if (al9 <= 0.01 || k9 <= 0) return;
    ctx.globalAlpha = al9;
    ctx.drawImage(spr9, ax - (W9 * k9) / 2, ay + dy9 - (W9 * k9) / 2, W9 * k9, W9 * k9);
  };
  /** 바닥에 눕혀 그린다(입체) — CSS의 skewX·scaleY 자리(위 skx·sky). */
  const lay9 = (draw9: () => void): void => {
    if (f.skx === undefined) { draw9(); return; }
    const sy9 = f.sky ?? 1;
    /* (ax, ay)를 축으로: X = x + skx·(y−ay) · Y = ay + sky·(y−ay). 바탕 변환 **위에** 겹치고
       save/restore로 돌려놓는다(위 tongueW9의 ★ — 바탕을 짐작하면 뒤엣것이 다 밀린다). */
    ctx.save();
    ctx.transform(1, 0, f.skx, sy9, -f.skx * ay, ay * (1 - sy9));
    draw9();
    ctx.restore();
  };
  switch (f.style) {
    case "die": {
      /* 죽음 여운 0.32초 — 캔버스 파편(burst)이 서는 2배 아래에서만 나온다(옛 스팬과 같은 칸). */
      const u9 = u0 / 0.32;
      if (u9 > 1) break;
      blit9(radOf9(`die-${f.sub ?? "mech"}`), key3v9(u9, 0.45, 1.05, 1.5, 0.55), key3v9(u9, 0.9, 0.8, 0, 0.55));
      break;
    }
    case "mine": {
      const u9 = u0 / 1.2;
      if (u9 > 1) break;
      blit9(radOf9("mine"), key3v9(u9, 0.2, 1, 2, 0.25), key3v9(u9, 0.2, 1, 0, 0.25));
      break;
    }
    case "clp": {
      /* 건물 붕괴 1초 — 화구 + (테란·저그)연기 또는 (프로토스)에너지 고리. */
      const u9 = u0 / 1;
      if (u9 > 1) break;
      const rk9 = f.sub ?? "terran";
      const ly9 = -(f.lift ?? 0) * zoom;
      const kc9 = u9 < 0.18 ? 0.3 + (1 - 0.3) * (u9 / 0.18) : key3v9((u9 - 0.18) / 0.82, 1, 1.5, 1.9, 0.51);
      const ac9 = u9 < 0.18 ? 0.2 + 0.8 * (u9 / 0.18) : key3v9((u9 - 0.18) / 0.82, 1, 0.5, 0, 0.51);
      if (rk9 === "toss") {
        blit9(radOf9("clp-toss-core"), kc9, ac9, ly9);
        const kr9 = u9 < 0.16 ? 0.2 + 0.5 * (u9 / 0.16) : key3v9((u9 - 0.16) / 0.84, 0.7, 1.9, 2.5, 0.52);
        const ar9 = u9 < 0.16 ? u9 / 0.16 : key3v9((u9 - 0.16) / 0.84, 1, 0.7, 0, 0.52);
        if (ar9 > 0.01) {
          ctx.globalAlpha = ar9;
          ctx.strokeStyle = "rgba(150,200,255,0.85)";
          ctx.lineWidth = Math.max(0.6, 2 * zoom);
          ctx.beginPath(); ctx.arc(ax, ay + ly9, (W9 * kr9) / 2, 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        blit9(radOf9(`clp-${rk9}-smoke`), key3v9(u9, 0.6, 1.1, 1.6, 0.3),
          key3v9(u9, 0, 0.8, 0, 0.3), ly9 + key3v9(u9, 0, -4, -14, 0.3) * zoom);
        blit9(radOf9(`clp-${rk9}-core`), kc9, ac9, ly9);
      }
      break;
    }
    case "land": {
      /* 착지 충격파 1.2초 — 무게감 있게 천천히 밀려 나가는 고리(CSS의 베지어 그대로). */
      const u9 = u0 / 1.2;
      if (u9 > 1) break;
      const k9 = 0.5 + 0.5 * cbez9(0.34, 0.5, 0.24, 1, u9);
      const al9 = u9 < 0.18 ? (u9 / 0.18) * 0.85 : 0.85 * (1 - (u9 - 0.18) / 0.82);
      if (al9 <= 0.01) break;
      lay9(() => {
        ctx.globalAlpha = al9;
        ctx.strokeStyle = "rgba(226,214,190,0.75)";
        ctx.lineWidth = Math.max(0.5, zoom);
        ctx.beginPath();
        ctx.ellipse(ax, ay, (W9 * k9) / 2, (((f.len ?? f.size ?? 8) * zoom) * k9) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      break;
    }
    case "dig": {
      /* 럴커 흙덩이 0.45초 — 다섯 알이 옆·뒤로 튀어 올랐다 떨어진다. 상자는 2:1 납작. */
      const bw9 = W9; const bh9 = W9 / 2;
      const sd9 = (f.seed ?? 0) % 4;
      const flip9 = sd9 === 1 || sd9 === 3 ? -1 : 1;
      const rot9 = sd9 === 2 ? (22 * Math.PI) / 180 : sd9 === 3 ? (-22 * Math.PI) / 180 : 0;
      const cw9 = bw9 * 0.09; const ch9 = bh9 * 0.18;
      for (const [dx9, dy9, dl9, col9] of CLODS9) {
        const u9 = (u0 - dl9) / 0.45;
        if (u9 < 0 || u9 > 1) continue;
        const e9 = cbez9(0.2, 0.7, 0.4, 1, u9);
        const px9 = u9 < 0.55 ? (dx9 / 100) * cw9 * (e9 / cbez9(0.2, 0.7, 0.4, 1, 0.55))
          : (dx9 / 100) * cw9 * (1 + 0.3 * ((u9 - 0.55) / 0.45));
        const py9 = u9 < 0.55 ? (dy9 / 100) * ch9 * (e9 / cbez9(0.2, 0.7, 0.4, 1, 0.55))
          : (dy9 / 100) * ch9 * (1 - 0.85 * ((u9 - 0.55) / 0.45));
        const k9 = u9 < 0.55 ? 0.6 + 0.4 * (u9 / 0.55) : 1 - 0.2 * ((u9 - 0.55) / 0.45);
        const al9 = u9 < 0.15 ? u9 / 0.15 : u9 < 0.55 ? 1 : 1 - (u9 - 0.55) / 0.45;
        const rx9 = Math.max(0.6, (cw9 / 2) * k9); const ry9 = Math.max(0.6, (ch9 / 2) * k9);
        const c9 = Math.cos(rot9); const s9 = Math.sin(rot9);
        const ox9 = px9 * flip9; const oy9 = py9;
        ctx.globalAlpha = al9;
        ctx.fillStyle = col9;
        ctx.beginPath();
        ctx.ellipse(ax + ox9 * c9 - oy9 * s9, ay - bh9 * 0.05 + ox9 * s9 + oy9 * c9, rx9, ry9, rot9, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "weld": {
      /* 테란 용접 불티 1.7초 — 파팟 두 번, 그리고 침묵. 실 다섯이 같은 박자로 함께 튄다. */
      const ws9 = (f.size ?? 1) * zoom;
      const i9 = f.seed ?? 0;
      const u9 = (((u0 + (i9 % 5) / 10) / 1.7) % 1 + 1) % 1;
      const al9 = u9 < 0.04 ? u9 / 0.04 : u9 < 0.1 ? 1 : u9 < 0.13 ? 1 - (u9 - 0.1) / 0.03
        : u9 < 0.17 ? 0 : u9 < 0.2 ? (u9 - 0.17) / 0.03 : u9 < 0.27 ? 1 : u9 < 0.31 ? 1 - (u9 - 0.27) / 0.04 : 0;
      if (al9 <= 0.02) break;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = al9;
      const spr9 = weldSpr9();
      for (let k9 = 0; k9 < 5; k9 += 1) {
        const len9 = (0.4 + ((i9 * 7 + k9 * 5) % 5) * 0.28) * ws9;
        const deg9 = -90 + (k9 - 2) * 34 + ((i9 * 13 + k9 * 29) % 22) - 11;
        const a9 = ((deg9 + 90) * Math.PI) / 180;       // CSS의 0도는 아래쪽이다
        const c9 = Math.cos(a9); const s9 = Math.sin(a9);
        ctx.save();
        ctx.transform(c9, s9, -s9, c9, ax + -s9 * 0.2 * ws9, ay + c9 * 0.2 * ws9);
        ctx.drawImage(spr9, -Math.max(0.4, 0.6 * zoom) / 2, 0, Math.max(0.4, 0.6 * zoom), len9);
        ctx.restore();
      }
      break;
    }
    case "storm": {
      /* ★ 사이오닉 스톰 — **모델 판을 얹는다**(요청: "둘다 옮겨"). 무늬는 회전 칸(spin)이
         씨앗이라 칸이 바뀔 때마다 벼락이 통째로 다시 친다(초당 14칸).
         판 크기는 **칸 전부가 캐시에 들어가도록** 예산으로 죈다 — 한 칸이 너무 크면 캐시가
         칸마다 어긋나 초당 열네 번 큰 판을 새로 굽는다(옛 지적: "고배율에서 스톰에 뮤탈이
         많이 맞을 때 느려짐"). 번짐 효과라 조금 흐려도 티가 안 난다.
         **더하기(lighter)로** 얹는다(요청: "더 글로우한 느낌") — 옛 DOM 층은 그냥 덮어
         그렸다. 어두운 땅 위에서 후광 겹이 서로 더해져 진짜 빛으로 읽힌다. */
      const spin9 = Math.floor(u0 * 14) % (STORM_SEEDS * STORM_STAGES);
      const bud9 = FX_RASTER_MAX / (STORM_SEEDS * STORM_STAGES * 1.5);
      const want9 = Math.min(W9 * Bd9, Math.sqrt(bud9 / 4), FX_RASTER_CAP);
      const q9 = Math.max(64, Math.ceil(want9 / 64) * 64);   // 64 칸으로 갈무리 — 배율이 조금 달라져도 다시 안 굽는다
      const cv9 = fxModelCv9({
        kind: "storm", spin: spin9, flat: !(f.pv ?? false), pitchView: f.pv ?? false,
        viewYaw: f.deg ?? 0, cw: q9, ch: q9,
      });
      if (cv9) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 1;
        ctx.drawImage(cv9, ax - W9 / 2, ay - W9 / 2, W9, W9);
      }
      break;
    }
    case "nuke": {
      /* ★ 핵 — 조준점 · 떨어지는 탄두와 꼬리 연기 · 폭발(충격파·섬광·버섯구름) ─────────────
         스팬 시절엔 이 연출이 CSS 키프레임이라 **벽시계**로 돌았다. 배속을 걸면 폭발만 느긋했고,
         그 어긋남을 메우려고 붓이 프레임마다 닻을 내려 주는 자(nukeClockTick9)까지 있었다.
         캔버스에서는 전부 **나이의 함수**라 배속·일시정지·되감기가 저절로 맞는다 — 되감으면
         구름이 도로 밝아진다. 키프레임의 마디는 그대로 옮겼다. */
      const pk9 = f.pk ?? 1;
      const hp9 = NUKE_HEAD_PX * pk9 * tz9;     // 탄두 자(타일 8px 기준 — 폰에서 안 커진다)
      const fp9 = NUKE_FALL_PX * pk9 * tz9;     // 떨어지기 시작하는 높이
      /* 입체의 낙하 축은 수직이 아니다 — 사영이 높이를 옆으로도 미므로 그만큼 기운다. */
      const lean9 = f.pv ? Math.tan(((f.deg ?? 0) * Math.PI) / 180) * (VIEW_LEAN_K / 0.9) : 0;
      const drop9 = Math.min(1, Math.max(0, (u0 - (NUKE_FALL_SEC - NUKE_DROP_SEC)) / NUKE_DROP_SEC));
      const landed9 = (f.tier ?? 1) >= 2;
      const spin9 = (f.seed ?? 0) % SPIN_STEPS;
      if (u0 < NUKE_FALL_SEC && (!landed9 || drop9 <= 0)) {
        /* 표적 점 — 거의 꺼졌다(0.12) 완전히 켜지길 되풀이한다(0.55초). 작아진 만큼
           눈에 띄는 몫은 크기가 아니라 **점멸**이 진다. */
        const b9 = easeW9(triW9(u0 / 0.55 / 2));
        const r9 = Math.max(0.25, 0.25 * zoom);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (0.25 + 0.6 * b9) * 0.8;
        ctx.drawImage(domSpr9("nglow", (c9, S9) => {
          radLay9(c9, S9, [[0, "rgba(255,26,26,0.9)"], [0.35, "rgba(255,26,26,0.45)"], [0.72, "rgba(255,26,26,0)"]]);
        }), ax - r9 * (3 + 3 * b9), ay - r9 * (3 + 3 * b9), r9 * (6 + 6 * b9), r9 * (6 + 6 * b9));
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.12 + 0.88 * b9;
        ctx.fillStyle = "#ff1a1a";
        ctx.beginPath(); ctx.arc(ax, ay, r9, 0, Math.PI * 2); ctx.fill();
        break;
      }
      if (u0 < NUKE_FALL_SEC) {
        /* ★ 낙하는 **가속**이다(h ∝ t²) — 남은 높이를 1 − p²로 준다: 처음엔 거의 제자리에
           떠 있다가 마지막 순간에 내리꽂힌다. 흐려짐·회전도 같은 곡선을 탄다. */
        const yh9 = -fp9 * (1 - drop9 ** 2) - hp9 * 0.275;   // 코를 조준점에 맞추는 몫(0.275)
        const yc9 = yh9 - hp9 * 1.42;                        // 꼬리 연기의 **가운데**
        /* 옆 밀림은 띠의 **밑동**(가운데 + 키의 절반 아래) 높이로 잰다 — 가운데로 재면
           밑동이 키의 절반만큼 더 밀려 탄두에서 떨어진다(지적: 연기가 너무 바깥쪽). */
        const sw9 = hp9 * 0.62; const sh9 = hp9 * 2.6;
        tongueW9(ctx, domSpr9("nsmoke", (c9, S9) => {
          const g9 = c9.createLinearGradient(0, S9, 0, 0);
          g9.addColorStop(0, "rgba(214,220,228,0.42)"); g9.addColorStop(0.32, "rgba(196,204,214,0.26)");
          g9.addColorStop(0.64, "rgba(176,186,198,0.10)"); g9.addColorStop(1, "rgba(176,186,198,0)");
          c9.filter = "blur(2px)";
          c9.fillStyle = g9;
          c9.beginPath();
          c9.ellipse(S9 / 2, S9 / 2, S9 * 0.34, S9 * 0.48, 0, 0, Math.PI * 2);
          c9.fill();
          c9.filter = "none";
        }), ax + -(yc9 + hp9 * 1.3) * lean9, ay + yc9 + sh9 / 2, sw9, sh9,
        Math.atan(lean9), 0.25 + 0.6 * drop9);
        /* ★ **돌면서 떨어진다** — 떨어지는 축이 곧 화면 밖으로 나오는 축이라, 스팬을 돌리는
           대신 모델의 요잉을 준다(명암·단면이 함께 돌아 몸이 도는 것으로 읽힌다). 두 바퀴를
           높이와 같은 가속 곡선으로, 반시계로. 각은 22.5도 칸 — 굽기 열쇠가 그 칸이다. */
        const rd9 = -(Math.round((drop9 ** 2.5 * 720) / 22.5) * 22.5);
        const qh9 = Math.max(64, Math.min(512, 2 ** Math.ceil(Math.log2(Math.max(1, hp9 * Bd9)))));
        const cvh9 = fxModelCv9({
          kind: "nuke", fit: false, rotDeg: rd9, flat: !f.pv, pitchView: f.pv,
          viewYaw: f.deg ?? 0, cw: qh9, ch: qh9, color: f.col ?? "#fff",
        });
        if (cvh9) {
          ctx.globalAlpha = 0.4 + 0.6 * drop9 ** 2;
          ctx.drawImage(cvh9, ax + -yh9 * lean9 - hp9 / 2, ay + yh9 - hp9 / 2, hp9, hp9);
        }
        break;
      }
      /* 폭발 — 땅에 눕는 충격파, 한순간의 백열 섬광, 솟아 부푸는 버섯구름. 셋 다 빛이라
         **더하기**로 얹는다(옛 mix-blend-mode: screen 자리). 자리 비율(2.173·50.3% ·
         1.013·77.9%)은 두 모델의 잉크 창에서 잰 값 그대로다 — 그래야 폭심이 조준점에 앉는다. */
      const ab9 = u0 - NUKE_FALL_SEC;
      ctx.globalCompositeOperation = "lighter";
      const qb9 = Math.max(64, Math.min(FX_RASTER_CAP, Math.ceil((W9 * 1.7 * Bd9) / 128) * 128));
      const uw9 = ab9 / 2.6;
      if (uw9 < 1) {
        const k9 = uw9 < 0.12 ? 0.25 + 0.7 * (uw9 / 0.12) : 0.95 + 0.3 * ((uw9 - 0.12) / 0.88);
        const a9 = uw9 < 0.12 ? uw9 / 0.12 : 1 - (uw9 - 0.12) / 0.88;
        const cv9 = fxModelCv9({
          kind: "nukeblast", spin: spin9, flat: !f.pv, pitchView: f.pv, viewYaw: f.deg ?? 0,
          cw: qb9, ch: Math.round(qb9 / 2.173),
        });
        if (cv9 && a9 > 0.01) {
          const w9 = W9 * k9; const h9 = w9 / 2.173;
          ctx.globalAlpha = a9;
          ctx.drawImage(cv9, ax - w9 * 0.5, ay - h9 * 0.503, w9, h9);
        }
      }
      const uf9 = ab9 / 0.9;
      if (uf9 < 1) {
        const k9 = uf9 < 0.12 ? 0.2 + 0.8 * (uf9 / 0.12) : 1 + 0.35 * ((uf9 - 0.12) / 0.88);
        const a9 = uf9 < 0.12 ? uf9 / 0.12 : 1 - (uf9 - 0.12) / 0.88;
        const w9 = W9 * k9;
        ctx.globalAlpha = Math.max(0, a9);
        ctx.drawImage(domSpr9("nflash", (c9, S9) => {
          radLay9(c9, S9, [[0, "rgba(255,255,255,0.6)"], [0.3, "rgba(255,240,200,0.35)"], [0.7, "rgba(255,240,200,0)"]]);
        }), ax - w9 / 2, ay - w9 / 2, w9, w9);
      }
      const uc9 = ab9 / 2.8;
      if (uc9 < 1) {
        const k9 = uc9 < 0.16 ? 0.3 + 0.75 * (uc9 / 0.16) : 1.05 + 0.65 * ((uc9 - 0.16) / 0.84);
        const ty9 = uc9 < 0.16 ? 6 - 12 * (uc9 / 0.16) : -6 - 28 * ((uc9 - 0.16) / 0.84);
        const a9 = uc9 < 0.16 ? uc9 / 0.16 : 1 - (uc9 - 0.16) / 0.84;
        const cv9 = fxModelCv9({
          kind: "nukecloud", spin: spin9, flat: !f.pv, pitchView: f.pv, viewYaw: f.deg ?? 0,
          cw: qb9, ch: Math.round(qb9 / 1.013),
        });
        if (cv9 && a9 > 0.01) {
          const w9 = W9 * k9; const h9 = w9 / 1.013;
          ctx.globalAlpha = a9;
          ctx.drawImage(cv9, ax - w9 * 0.5, ay - h9 * 0.779 + (ty9 / 100) * h9, w9, h9);
        }
      }
      break;
    }
    case "swarm": {
      /* 다크 스웜 — 두 벌이 서로 반대로 천천히 돌며 우글거린다(끝이 없다). */
      const tri9 = (x9: number): number => { const v9 = x9 - Math.floor(x9); return v9 < 0.5 ? v9 * 2 : 2 - v9 * 2; };
      lay9(() => {
        const pa9 = tri9(u0 / 3.6 / 2);
        const ka9 = 0.97 + 0.06 * pa9; const ra9 = ((-4 + 8 * pa9) * Math.PI) / 180;
        const pb9 = tri9((u0 + 0.4) / 2.7 / 2);
        const kb9 = (1.03 - 0.07 * pb9) * 0.9; const rb9 = ((7 - 14 * pb9) * Math.PI) / 180;
        const one9 = (spr9: HTMLCanvasElement, k9: number, rot9: number, al9: number): void => {
          ctx.save();
          ctx.globalAlpha = al9;
          ctx.translate(ax, ay); ctx.rotate(rot9); ctx.translate(-ax, -ay);
          ctx.drawImage(spr9, ax - (W9 * k9) / 2, ay - (W9 * k9) / 2, W9 * k9, W9 * k9);
          ctx.restore();
        };
        one9(swarmSpr9(false), ka9, ra9, 0.82 + 0.18 * pa9);
        one9(swarmSpr9(true), kb9, rb9, 0.72 + 0.26 * pb9);
      });
      break;
    }
    case "cast": {
      const cls9 = f.sub ?? "";
      /* 지역 마법 — 갈래마다 제 주기와 그림이 있다(CSS의 .scr-fx-* 그대로). */
      if (cls9 === "scan") {
        /* 스캐너 스윕 — 얇은 바깥 테두리 하나가 한 번 커지고(0.7초), 탐지 시간(9초) 동안 옅어진다. */
        const gr9 = u0 < 0.7 ? 0.12 + 0.88 * cbez9(0.2, 0.8, 0.3, 1, u0 / 0.7) : 1;
        const fd9 = u0 / 9;
        if (fd9 > 1) break;
        const al9 = fd9 < 0.8 ? 1 - 0.2 * (fd9 / 0.8) : 0.8 * (1 - (fd9 - 0.8) / 0.2);
        ctx.globalCompositeOperation = "lighter";
        lay9(() => {
          ctx.globalAlpha = al9 * 0.55;
          ctx.strokeStyle = f.col ?? "#fff";
          ctx.lineWidth = Math.max(0.4, 0.3 * zoom);
          ctx.beginPath(); ctx.ellipse(ax, ay, (W9 * gr9) / 2, (W9 * gr9) / 2, 0, 0, Math.PI * 2); ctx.stroke();
          /* 별가루(요청) — 네 갈래 별이 어긋난 박자로 반짝인다. */
          const dsp9 = dustSpr9();
          const dw9 = W9 * 0.035;
          for (const [dx9, dy9, dl9] of SCAN_DUST) {
            const tw9 = (((u0 + dl9) / 1.7) % 1 + 1) % 1;
            const da9 = tw9 < 0.45 ? tw9 / 0.45 : tw9 < 0.7 ? 1 - 0.5 * ((tw9 - 0.45) / 0.25) : 0.5 * (1 - (tw9 - 0.7) / 0.3);
            const dk9 = tw9 < 0.45 ? 0.35 + 0.65 * (tw9 / 0.45) : tw9 < 0.7 ? 1 - 0.2 * ((tw9 - 0.45) / 0.25) : 0.8 - 0.45 * ((tw9 - 0.7) / 0.3);
            if (da9 * al9 <= 0.02) continue;
            ctx.globalAlpha = da9 * al9;
            const px9 = ax + ((dx9 - 50) / 100) * W9 * gr9;
            const py9 = ay + ((dy9 - 50) / 100) * W9 * gr9;
            ctx.drawImage(dsp9, px9 - (dw9 * dk9) / 2, py9 - (dw9 * dk9) / 2, dw9 * dk9, dw9 * dk9);
          }
        });
        break;
      }
      if (cls9 === "emp") {
        /* EMP — 퍼져 나가는 파란 고리 한 번(1.5초). */
        const u9 = u0 / 1.5;
        if (u9 > 1) break;
        ctx.globalCompositeOperation = "lighter";
        lay9(() => {
          ctx.globalAlpha = 0.9 * (1 - u9) * 0.8;
          ctx.strokeStyle = "rgba(120,190,255,0.8)";
          ctx.lineWidth = Math.max(0.6, 2 * zoom);
          ctx.beginPath(); ctx.arc(ax, ay, (W9 * (0.15 + 0.85 * u9)) / 2, 0, Math.PI * 2); ctx.stroke();
        });
        break;
      }
      if (cls9 === "yamato") {
        const u9 = u0 / 2.2;
        if (u9 > 1) break;
        ctx.globalCompositeOperation = "lighter";
        blit9(radOf9("yamato"), 1, u9 < 0.14 ? 0.25 + 0.75 * (u9 / 0.14) : u9 < 0.55 ? 1 : 1 - (u9 - 0.55) / 0.45);
        break;
      }
      if (cls9 === "irrad" || cls9 === "mael") {
        /* 맥동 — 이레디에이트는 끝없이(0.8초), 마엘스톰은 네 번(0.5초) 뛰고 멎는다. */
        const per9 = cls9 === "irrad" ? 0.8 : 0.5;
        const n9 = cls9 === "irrad" ? Infinity : 4;
        const done9 = Math.min(u0 / per9, n9);
        const ph9 = done9 >= n9 ? 0 : ((done9 % 2 < 1 ? done9 % 1 : 1 - (done9 % 1)));
        ctx.globalCompositeOperation = "lighter";
        lay9(() => { blit9(radOf9(cls9), 0.9 + 0.15 * ph9, 0.5 + 0.5 * ph9); });
        break;
      }
      if (cls9 === "recall") {
        const rot9 = ((u0 % 1) / 1) * Math.PI * 2;
        ctx.globalCompositeOperation = "lighter";
        lay9(() => {
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.translate(ax, ay); ctx.rotate(rot9); ctx.translate(-ax, -ay);
          ctx.drawImage(recallSpr9(), ax - W9 / 2, ay - W9 / 2, W9, W9);
          ctx.restore();
        });
        break;
      }
      if (cls9 === "dweb") {
        const tri9 = (x9: number): number => { const v9 = x9 - Math.floor(x9); return v9 < 0.5 ? v9 * 2 : 2 - v9 * 2; };
        lay9(() => { blit9(dwebSpr9(), 1, 0.72 + 0.23 * tri9(u0 / 2.4 / 2)); });
        break;
      }
      /* 플레이그·인스네어 — 얼룩 여러 겹이 6초에 걸쳐 스러진다. */
      const lys9 = CAST_LAYERS9[cls9];
      if (!lys9) break;
      const fd9 = u0 / 6;
      if (fd9 > 1) break;
      const al9 = fd9 < 0.8 ? 1 - 0.2 * (fd9 / 0.8) : 0.8 * (1 - (fd9 - 0.8) / 0.2);
      lay9(() => {
        ctx.globalAlpha = al9;
        ctx.drawImage(domSpr9(`cast:${cls9}`, (c9, S9) => {
          for (let i9 = lys9.length - 1; i9 >= 0; i9 -= 1) radLay9(c9, S9, lys9[i9].s, lys9[i9].x, lys9[i9].y);
        }), ax - W9 / 2, ay - W9 / 2, W9, W9);
      });
      break;
    }
    default:
      break;
  }
  ctx.globalAlpha = op09;
  ctx.globalCompositeOperation = gco09;
}
/** 죽음·파괴 **파편 폭발**(요청) ────────────────────────────────────────────────────────
 *  덩어리가 낱개로 갈라져 날아가는 그림 하나로 넷을 낸다 — 결(mat)이 낱개의 색·수·중력과 곁들이는
 *  겹을 정한다.
 *    mech 기계·테란 건물: 노란 섬광 → 주황 화염, 검은 쇳조각이 튀고 회색 연기 셋이 오른다.
 *    toss 프로토스: 흰 심에서 푸른 플라즈마 고리가 퍼지고, 금빛 조각이 날며 희게 타서 사라진다.
 *    zerg 저그: 검붉은 살점이 무겁게 떨어지고 바닥에 피떡이 번진다. bio(테란 생체)는 붉은 살점.
 *  자는 f.size(보이는 몸 폭·발자국 폭, 렌즈 px)이고 p는 0~1 진행이다. 낱개는 씨앗(seed)으로
 *  개체마다 다르게 흩되 프레임마다는 같다(무작위면 지지직거린다). save/restore 없이 네 점을
 *  손으로 돌려 채운다(계측: save 하나가 CPU 8%였다). */
function drawBurst9(ctx: CanvasRenderingContext2D, f: FxOp, ax: number, ay: number, zoom: number, p: number, tz9 = zoom): void {
  const W = Math.max(3, (f.size ?? 4) * zoom);
  /* ★ 파편의 **수는 몸집 단으로, 크기는 조금만**(요청: "유닛간 크기 차이에 따라 파편 크기를 배율로 키우기보다는 크기는
     약간만 커지고 파편 수를 달리하기 — 3단계") — 여태 낱개 크기가 W(몸 폭)에 비례해 울트라는 마린의 다섯 배 조각이
     튀었다. 이제 낱개 자는 **타일 자**(tz9)에 단별 작은 배수(0.85·1·1.2)만 곱하고, 수는 단별 0.6·1·1.6배다. 건물의
     테란·저그는 조각을 더 잘게(0.65) 더 많이(1.7배) 낸다(요청). 튀는 거리(v)는 여전히 몸 폭이라 큰 몸은 넓게 퍼진다. */
  const tier9 = f.tier ?? 2;
  const szK9 = tier9 === 1 ? 0.85 : tier9 === 3 ? 1.2 : 1;
  const nK9 = tier9 === 1 ? 0.6 : tier9 === 3 ? 1.6 : 1;
  const mat = f.mat ?? "mech";
  const bld = f.bld === true;
  let sd = ((f.seed ?? 1) * 2654435761) >>> 0;
  const rnd = (): number => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const ease = 1 - (1 - p) * (1 - p);
  const wet = mat === "zerg" || mat === "bio";
  // ① 바닥·뒤 겹 — 결마다 다른 한 장.
  if (wet) {
    // 피떡: 바닥에 납작하게 번지는 검붉은 타원, 오래 남는다.
    const rr = W * (0.18 + 0.55 * ease);
    ctx.globalAlpha = (mat === "zerg" ? 0.6 : 0.5) * (1 - p * 0.6);
    ctx.fillStyle = mat === "zerg" ? "#5c0e14" : "#5a0f0c";   // 저그 핏자국: 자주 → 짙은 빨강(요청: "너무 보라빛")
    ctx.beginPath(); ctx.ellipse(ax, ay + W * 0.12, rr, rr * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  } else if (mat === "mech") {
    /* 불색 폭발 구(요청: "테란 건물·기계 사망 효과에 폭발(불색) 구도 있어야 해") — 여태는
       0.55 위상까지만 사는 작은 주황 원 하나라, 파편이 튀는 동안 정작 '터지는 구'가 없어
       기계·건물은 쇳조각만 흩어지는 꼴이었다. 프로토스의 플라즈마 구(아래 else: 푸른 구·
       연푸른 속·흰 심·밝은 테)와 같은 문법을 불색으로 짠다 — 짙은 주홍 바깥 구, 주황 속,
       연노랑 심, 노란 테. 구는 위상 내내 커지며 스러지고(ease), 심은 빨리 꺼진다.
       건물은 몸이 커서 구를 한 단 크게 잡는다(0.78 대 0.62). */
    const R9 = W * ((bld ? 0.2 : 0.18) + (bld ? 0.58 : 0.44) * ease);
    const fade = 1 - p;
    const cy9 = ay - W * 0.05;
    ctx.globalAlpha = 0.38 * fade; ctx.fillStyle = "#ff4a12";
    ctx.beginPath(); ctx.arc(ax, cy9, R9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.5 * fade; ctx.fillStyle = "#ff9a2e";
    ctx.beginPath(); ctx.arc(ax, cy9, R9 * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = Math.max(0, 1 - p * 1.6) ** 1.2; ctx.fillStyle = "#fff1b0";
    ctx.beginPath(); ctx.arc(ax, cy9, R9 * 0.4 * (1 - p * 0.5), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.55 * fade; ctx.strokeStyle = "#ffc86b"; ctx.lineWidth = Math.max(0.8, W * 0.03);
    ctx.beginPath(); ctx.arc(ax, cy9, R9, 0, Math.PI * 2); ctx.stroke();
  } else if (mat === "cocoon") {
    /* 고치(지적: 흰빛 도는 푸른 파동이 보임 — 이 갈래가 없어 아래 프로토스 플라즈마 구로 떨어졌다) — 살빛 점액 얼룩만
       옅게 깔고 파편은 아래 공통 고리가 낸다. 구·섬광·테는 없다. */
    const rr = W * (0.14 + 0.4 * ease);
    ctx.globalAlpha = 0.35 * (1 - p * 0.7);
    ctx.fillStyle = "#b07a62";
    ctx.beginPath(); ctx.ellipse(ax, ay + W * 0.1, rr, rr * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  } else if (bld) {
    /* ★ 프로토스 **건물**은 종전대로 **플라즈마 폭발**이다(지적: "프로토스 건물이 왜 플라즈마 폭발구가 아니라
       사이오닉 연기도 나는 거 같지") ─────────────────────────────────────────────────────────────────────
       아래 연기는 **유닛**의 죽음을 다시 짠 것인데(원작의 프로토스 몸은 터지지 않고 기운으로 풀린다), 이 갈래가
       결(mat)만 보고 갈려 있어 건물까지 함께 끌려갔다. 건물은 원작에서도 터진다 — 푸른 플라즈마 구가 부풀며
       옅어지고 가운데에 흰 에너지 심이 선다. 그 그림을 되돌린다(겹 셋 + 밝은 테). 조각은 여전히 안 낸다. */
    const R9 = W * (0.22 + 0.78 * ease);
    const fade = 1 - p;
    ctx.globalAlpha = 0.32 * fade; ctx.fillStyle = "#3a8fff";
    ctx.beginPath(); ctx.arc(ax, ay, R9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.45 * fade; ctx.fillStyle = "#8fd0ff";
    ctx.beginPath(); ctx.arc(ax, ay, R9 * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = Math.min(1, 1.1 * fade) ** 0.8; ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(ax, ay, R9 * 0.38 * (1 - p * 0.5), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = "#cfeaff"; ctx.lineWidth = Math.max(0.8, W * 0.03);
    ctx.beginPath(); ctx.arc(ax, ay, R9, 0, Math.PI * 2); ctx.stroke();
  } else {
    /* ★ 프로토스 **유닛** — **사이오닉 연기로 사라진다**(요청: "원작과 유사하게") ────────────────────────────
       원작의 프로토스는 터져 흩어지지 않는다. 몸이 푸른 기운으로 풀리면서 그 자리에 연기가 피어올라 스러진다.
       여태 이 자리는 부푸는 푸른 구 하나(플라즈마 폭발)라 기계의 불덩이와 문법이 같았다 — 터지는 그림이었다.
       셋으로 다시 짠다:
         ① 흰 심 — 몸이 풀리는 첫 순간만 짧게(앞 4분의 1). 폭발이 아니라 '빛으로 풀림'의 표식이다.
         ② 피어오르는 연기 — 씨앗으로 흩은 뭉치 여섯이 조금씩 늦게 떠서 위로 오르며 부풀고 옅어진다. 뭉치마다
            겉(옅은 남빛)과 속(연푸른)을 겹쳐 가장자리가 무르게 읽힌다.
         ③ 바닥 잔광 — 몸이 있던 자리에 남는 옅고 납작한 푸른 기운. 빨리 스러진다.
       조각은 여전히 안 낸다(아래 낱개 고리가 toss를 0으로 건너뛴다). */
    const fade = 1 - p;
    const fl9 = Math.max(0, 1 - p * 4);
    if (fl9 > 0) {
      ctx.globalAlpha = fl9 ** 0.7;
      ctx.fillStyle = "#eaf6ff";
      ctx.beginPath(); ctx.arc(ax, ay, W * 0.34 * (0.6 + 0.4 * fl9), 0, Math.PI * 2); ctx.fill();
    }
    /* 뭉치의 꼴은 **불꽃 혀**다(요청: "연기가 약간 화염처럼 생겼으면") — 둥근 구름이면 김이 서리는 것처럼 읽힌다.
       밑이 넓고 위로 뾰족한 혀를 그리되 끝을 좌우로 기울여(tilt) 낱개마다 다르게 흔들리게 한다. 색은 사이오닉
       푸른빛 그대로다 — 꼴만 불꽃이고 결은 여전히 기운이다. */
    const tongue9 = (x9: number, y9: number, w9: number, h9: number, tl9: number): void => {
      ctx.beginPath();
      ctx.moveTo(x9 - w9, y9);
      ctx.quadraticCurveTo(x9 - w9 * 0.95, y9 - h9 * 0.55, x9 + tl9 * h9 * 0.38, y9 - h9);
      ctx.quadraticCurveTo(x9 + w9 * 0.95, y9 - h9 * 0.55, x9 + w9, y9);
      ctx.quadraticCurveTo(x9, y9 + h9 * 0.3, x9 - w9, y9);
      ctx.closePath();
      ctx.fill();
    };
    const NP9 = 6;
    for (let i9 = 0; i9 < NP9; i9 += 1) {
      const a09 = rnd() * Math.PI * 2;
      const sp9 = W * (0.10 + rnd() * 0.24);      // 옆으로 흩는 몫
      const up9 = W * (0.55 + rnd() * 0.55);      // 떠오르는 몫
      const wob9 = (rnd() - 0.5) * 1.6;           // 혀끝이 기우는 쪽(낱개 고정)
      const dly9 = (i9 / NP9) * 0.35;             // 한꺼번에 안 뜬다
      const q9 = (p - dly9) / Math.max(0.05, 1 - dly9);
      if (q9 <= 0) continue;
      const eq9 = 1 - (1 - Math.min(1, q9)) * (1 - Math.min(1, q9));
      const x9 = ax + Math.cos(a09) * sp9 * eq9;
      const y9 = ay + Math.sin(a09) * sp9 * eq9 * 0.5 - up9 * eq9;
      const r9 = W * (0.12 + 0.28 * eq9) * (0.75 + (i9 % 3) * 0.18);
      // 너울(flicker) — 위상에 따라 혀 길이가 흔들려 살아 있는 불처럼 읽힌다.
      const fk9 = 1 + 0.22 * Math.sin(p * 17 + i9 * 2.3);
      const al9 = Math.max(0, 1 - q9) ** 1.3;
      const tl9 = wob9 + Math.sin(p * 11 + i9) * 0.25;
      ctx.globalAlpha = 0.20 * al9; ctx.fillStyle = "#5f9de8";
      tongue9(x9, y9 + r9 * 0.5, r9 * 0.92, r9 * 2.3 * fk9, tl9);
      ctx.globalAlpha = 0.28 * al9; ctx.fillStyle = "#bfe0ff";
      tongue9(x9, y9 + r9 * 0.35, r9 * 0.5, r9 * 1.45 * fk9, tl9 * 0.8);
    }
    ctx.globalAlpha = 0.24 * fade * fade;
    ctx.fillStyle = "#6aa8ff";
    ctx.beginPath(); ctx.ellipse(ax, ay + W * 0.1, W * (0.28 + 0.26 * ease), W * (0.11 + 0.1 * ease), 0, 0, Math.PI * 2); ctx.fill();
  }
  // ② 낱개 — 결의 팔레트 셋을 돌려 쓰고, 중력은 살점이 가장 무겁다.
  // 살은 세 톤을 섞는다(재지적): 테란 생체는 빨강·살색·검붉음, 저그는 검붉음·보라·갈색. 핏방울은 따로.
  // 기계는 테란 기본색(강철 회색 둘)을 더 많이, 갈색 부품과 검은 조각·주황 한 조각(재지적).
  const PALS: Record<string, string[]> = {
    mech: ["#6b737e", "#9aa3ad", "#6b4a2b", "#6b737e", "#3a3d44", "#9aa3ad", "#ff8a3d"],
    bio: ["#c8231b", "#e0a48a", "#7a1210"],
    zerg: ["#8f1f28", "#c23a3a", "#5a2a20"], toss: ["#d4af37", "#a8862a", "#e6f4ff"],   // 저그 살점: 보라(#5b3a8a) 걷고 붉은 두 단 + 갈색
    // 고치(변태알·러커알·뮤탈 고치·공사 고치 취소) — 살색이 주(지적)이고 갈색·보라 파편이 섞인다. 피는 없다.
    cocoon: ["#e0a48a", "#c98d72", "#e0a48a", "#6b4a2b", "#e0a48a", "#5b3a8a", "#c98d72"],
  };
  const DROP9: Record<string, string> = { bio: "#ef5a45", zerg: "#c8343c" };
  const pal = PALS[mat] ?? PALS.mech;
  // 기계는 낱개가 더 많다 — 절반이 짧은 막대라(아래) 면 조각 수는 그대로 지킨다.
  const nBase = mat === "mech" ? (bld ? 24 : 16) : (bld ? 16 : 10);
  const bldMore9 = bld && (mat === "mech" || mat === "zerg") ? 1.7 : 1;
  const N = Math.round(nBase * nK9 * bldMore9 * DEV9.hitShardK * crowdShardK9());   // 덜어내기: 1단 절반·2단 3분의 1
  const g = W * (wet ? 1.1 : mat === "toss" ? 0.25 : 0.7);
  for (let i = 0; i < (mat === "toss" ? 0 : N); i += 1) {
    const an = (i / N) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
    const v = W * (0.45 + rnd() * 0.65);
    const sz = tz9 * (0.55 + rnd() * 0.6) * szK9 * (bld && (mat === "mech" || mat === "zerg") ? 0.65 : 1);
    const rot = an + (rnd() - 0.5) * 6 * p;
    const life = mat === "toss" ? 0.75 : 1;
    const q = Math.min(1, p / life);
    if (q >= 1) continue;
    const eq = 1 - (1 - q) * (1 - q);
    const x = ax + Math.cos(an) * v * eq;
    const y = ay + Math.sin(an) * v * eq * 0.6 - W * 0.25 * eq + g * q * q;
    /* 꼴은 셋(재지적: 면만 있으면 꽃가루 같다) — 셋에 하나는 **가는 줄**(핏줄기·부품 막대), 나머지는
       살은 **무작위 타원**(둥근 살점), 기계는 **각진 직사각형**(쇳조각). */
    const cx = Math.cos(rot), sx = Math.sin(rot);
    ctx.globalAlpha = q < 0.7 ? 1 : (1 - q) / 0.3;
    ctx.fillStyle = pal[i % pal.length];
    // 막대는 **짧게 여럿**(재지적: 길어서 어색) — 기계 낱개의 절반, 길이는 조각의 1.0배.
    if (!wet && i % 2 === 1) {
      ctx.strokeStyle = pal[i % pal.length]; ctx.lineWidth = Math.max(0.6, sz * 0.3); ctx.lineCap = "round";
      const L = sz * 1.0;
      ctx.beginPath(); ctx.moveTo(x - cx * L, y - sx * L); ctx.lineTo(x + cx * L, y + sx * L); ctx.stroke();
    } else if (wet) {
      ctx.beginPath(); ctx.ellipse(x, y, sz * (0.7 + (i % 4) * 0.15), sz * (0.5 + (i % 3) * 0.2), rot, 0, Math.PI * 2); ctx.fill();
    } else if (pal[i % pal.length] === "#ff8a3d") {
      // 주황은 화염 조각이라 둥글게(재지적) — 각진 쇳조각과 갈린다.
      ctx.beginPath(); ctx.arc(x, y, sz * 0.9, 0, Math.PI * 2); ctx.fill();
    } else {
      const hw = sz, hh = sz * 0.6;
      ctx.beginPath();
      ctx.moveTo(x + cx * hw - sx * hh, y + sx * hw + cx * hh);
      ctx.lineTo(x - cx * hw - sx * hh, y - sx * hw + cx * hh);
      ctx.lineTo(x - cx * hw + sx * hh, y - sx * hw - cx * hh);
      ctx.lineTo(x + cx * hw + sx * hh, y + sx * hw - cx * hh);
      ctx.closePath(); ctx.fill();
    }
  }
  // 유리 조각(재요청): 기계는 삼각형·평행사변형 등 제각각 꼴의 옅은 청백 조각 몇 개가 더 튄다.
  if (mat === "mech") {
    const NG = bld ? 5 : 3;
    for (let i = 0; i < NG; i += 1) {
      const an = rnd() * Math.PI * 2;
      const v = W * (0.55 + rnd() * 0.7);
      const sz = W * (0.06 + rnd() * 0.07);
      const rot = an + (rnd() - 0.5) * 8 * p;
      const tri = rnd() < 0.5;
      const skew = (rnd() - 0.5) * 1.2;
      const q = p;
      const eq = 1 - (1 - q) * (1 - q);
      const x = ax + Math.cos(an) * v * eq;
      const y = ay + Math.sin(an) * v * eq * 0.6 - W * 0.3 * eq + W * 0.8 * q * q;
      const cx = Math.cos(rot), sx = Math.sin(rot);
      const P = (u: number, w: number): [number, number] => [x + cx * u - sx * w, y + sx * u + cx * w];
      ctx.globalAlpha = (q < 0.7 ? 0.8 : 0.8 * (1 - q) / 0.3);
      ctx.fillStyle = i % 2 ? "#cfe6f5" : "#a9cfe6";
      ctx.beginPath();
      if (tri) {
        const a = P(-sz, sz * 0.7), b = P(sz * 1.2, sz * 0.4), c = P(-sz * 0.2, -sz);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]);
      } else {
        const a = P(-sz + skew * sz, sz * 0.5), b = P(sz + skew * sz, sz * 0.5), c = P(sz - skew * sz, -sz * 0.5), d = P(-sz - skew * sz, -sz * 0.5);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  // ③ 곁들이 — 기계는 연기, 살은 핏방울, 프로토스는 반짝이.
  if (mat === "mech") {
    // 연기는 더 분명하고 크게(재지적) — 넷, 반지름 0.22 → 0.8W, 더 높이 오르고 진하게.
    for (let i = 0; i < 4; i += 1) {
      const ox = (i - 1.5) * W * 0.3 + (rnd() - 0.5) * W * 0.12;
      const q = Math.max(0, Math.min(1, (p - 0.05 - i * 0.05) / 0.9));
      if (q <= 0) continue;
      ctx.globalAlpha = 0.7 * (1 - q * 0.85);
      ctx.fillStyle = i % 2 ? "#5a5e66" : "#7a7f88";
      ctx.beginPath(); ctx.arc(ax + ox, ay - W * 0.15 - W * 0.9 * q, W * (0.22 + 0.58 * q), 0, Math.PI * 2); ctx.fill();
    }
  } else if (wet) {
    ctx.fillStyle = DROP9[mat] ?? pal[0];
    for (let i = 0; i < 8; i += 1) {
      const an = rnd() * Math.PI * 2; const v = W * (0.5 + rnd() * 0.7);
      const x = ax + Math.cos(an) * v * ease, y = ay + Math.sin(an) * v * ease * 0.6 - W * 0.2 * ease + W * 0.9 * p * p;
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.6, W * 0.03), 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 6; i += 1) {
      const an = rnd() * Math.PI * 2; const v = W * (0.4 + rnd() * 0.8);
      ctx.globalAlpha = Math.max(0, 1 - p * 1.3) * 0.9;
      ctx.beginPath(); ctx.arc(ax + Math.cos(an) * v * ease, ay + Math.sin(an) * v * ease * 0.6 - W * 0.3 * ease, Math.max(0.6, W * 0.025), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
/* ── 저배율 마커(요청: "저배율에서 유닛이 많아서 힘드니까 건물과 유닛을 그냥 가벼운
   마커로 표시 — 크기만 종별로, 캔버스 형태와 크기대로, 자원도, 그림자 없이") ─────────
   marker가 켜지면 장면 **전체**가 임자 색 사각으로 찍힌다. 종별 크기는 이미 op에 실려
   온다(유닛 sizePx·건물 wFrac/hFrac이 곧 '캔버스 형태와 크기'다). 스위치는 op마다의
   픽셀 문턱이 아니라 **보기 하나**다 — 처음엔 op별 문턱(유닛 9px·건물 15px)으로 갈랐는데
   건물의 그리는 상자가 발자국이 아니라 몸 상자(약 0.7배)라, PC 전체 보기에서 작은
   건물만 사각이 되고 홀은 모델로 남는 얼룩덜룩한 화면이 됐다. 한 값(markerView)이면
   전환이 통째라 얼룩이 없다.
   무엇이 빠지나 — 판 굽기·resolveShapeFaces·그림자 타원·체력바·틴트·겹침 그림자, 그리고
   op마다의 save/restore(계측: save 하나가 CPU 자기 시간 8%였다). */
/** 체력바 한 줄 — **실드 칸을 따로** 칠한다(요청: "프로토스 체력바중 실드는 흰색으로
 *  표현?").
 *
 *  원작의 셈을 그대로 옮긴다: 자취가 주는 수는 체력+실드 합이고, 실드가 **먼저** 깎인다.
 *  그러니 남은 비율 f를 두 칸으로 가른다(실드 몫을 sh라 하면):
 *    · 체력 칸 — 0 ~ min(f, 1−sh). 색은 **체력만의 비율**로 고른다(합으로 고르면
 *      실드만 깎인 프로토스가 성한데도 노랑·빨강으로 보인다).
 *    · 실드 칸 — (1−sh) ~ f. 흰색. 바의 오른쪽 끝이 곧 실드다.
 *  실드가 없는 종족은 sh가 0이라 흰 칸이 아예 안 생기고, 셈도 옛것과 같아진다. */
function drawHpBar(
  ctx: CanvasRenderingContext2D, op: UnitDrawOp,
  bx: number, by: number, bw: number, bh: number,
): void {
  /* 원작 양식(요청) — OpenBW draw_health_bars 그대로:
       · 폭은 게임 px(hpBarW). 채움 폭은 3의 배수에 맞춘다(filled_width: 최소 3, 나머지 2면 올림·1이면 내림). 3px마다
         1px 금(칸 = 2px 색 + 1px 금). 한 칸의 체력은 최대 체력 ÷ 칸 수 — 칸이 체력 단위가 아니라 폭이 정한다.
       · 실드 없으면 5줄(테 + 색 3줄 + 테). 실드 있으면 **전체 7줄**인데, 원작은 체력 7줄을 먼저 칠하고 위 4줄을 실드
         (테 + 푸른 2줄 + 테)로 덮어쓴다 — 그래서 남는 체력은 아래 3줄(색 2줄 + 테)이고 실드 색 2줄·체력 색 2줄로 높이가
         같다(지적: 플토는 실드 줄이 따로, 체력이 더 높지 않다). 실드의 아래 테가 곧 체력의 위 테다.
       · 색은 체력 비율로 갈린다 — 66% 넘으면 초록, 33% 넘으면 노랑, 그 아래 빨강. 빈 자리는 어두운 바탕.
     한 게임 px 줄의 화면 높이는 uPx(폭에서 온 게임 px)와 bh/5(우리 최소 두께) 중 큰 쪽이다. by는 막대 전체의 윗변이다
     (실드가 있으면 실드 테가 거기 선다). 금은 칸이 화면 1.6px 이상일 때만 긋고(그 아래는 얼룩), 화면 0.6px 아래로는 안 내려간다.
     실드 값은 합산 비율(hpFrac)과 실드 몫(shFrac = 최대 실드 ÷ (최대 체력 + 최대 실드))에서 푼다 — 피해는 실드부터
     깎이므로 합산이 체력 상한을 넘는 몫이 남은 실드다. */
  const W = op.hpBarW ?? 19;
  const uPx = bw / W;
  const f = Math.max(0, Math.min(1, op.hpFrac ?? 0));
  const sh = Math.max(0, Math.min(0.95, op.shFrac ?? 0));
  const hpCap = 1 - sh;
  const hpNow = hpCap > 0 ? Math.min(f, hpCap) / hpCap : 1;
  const shNow = sh > 0 ? Math.max(0, f - hpCap) / sh : 0;
  const hasSh = sh > 0;
  const rowPx = Math.max(uPx, bh / 5);
  const fillW = (part: number): number => {
    let r = Math.floor(Math.floor(part * 100) * W / 100);
    if (r < 3) r = 3;
    else if (r % 3) r = r % 3 > 1 ? r + 3 - (r % 3) : r - (r % 3);
    return Math.min(W, r);
  };
  const BORDER = "#0b0f14";
  const BG = ["#2a3138", "#1c2126", "#12161a"];
  const hpShades = hpNow > 0.66 ? ["#5ce06e", "#39c04f", "#2a9a3d"]
    : hpNow > 0.33 ? ["#f0cc55", "#d9b13b", "#b8922c"] : ["#ee6a5e", "#d5473d", "#b0362e"];
  /** 줄 하나 — 채움(fillPx까지)은 shade, 나머지는 bg. 테 줄은 통째로 테 색. */
  const row = (top: number, shade: string | null, bg: string | null, fillPx: number): void => {
    if (shade === null || bg === null) {
      ctx.fillStyle = BORDER; ctx.globalAlpha = 0.8;
      ctx.fillRect(bx, top, bw, rowPx);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = bg; ctx.globalAlpha = 0.85;
    ctx.fillRect(bx, top, bw, rowPx);
    ctx.globalAlpha = 1;
    if (fillPx > 0) { ctx.fillStyle = shade; ctx.fillRect(bx, top, fillPx, rowPx); }
  };
  const hpFill = (hpNow > 0 ? fillW(hpNow) : 0) * uPx;
  const shFill = (shNow > 0 ? fillW(shNow) : 0) * uPx;
  /* 줄 배열 — [색 배열, 인덱스]: null이면 테. 실드 있으면 원작의 덮어쓰기 결과 그대로 7줄, 없으면 5줄. */
  const top0 = by;
  const rows: (readonly [string, string, number] | null)[] = hasSh
    ? [null, ["#7cc1ff", BG[1], shFill] as const, ["#4fa8ff", BG[2], shFill] as const, null,
      [hpShades[1], BG[1], hpFill] as const, [hpShades[2], BG[2], hpFill] as const, null]
    : [null, [hpShades[0], BG[0], hpFill] as const, [hpShades[1], BG[1], hpFill] as const, [hpShades[2], BG[2], hpFill] as const, null];
  for (let r = 0; r < rows.length; r += 1) {
    const k = rows[r];
    if (k === null) row(by + r * rowPx, null, null, 0);
    else row(by + r * rowPx, k[0], k[1], k[2]);
  }
  // 금 — 막대 전체(실드 포함)를 한 번에.
  if (uPx * 3 >= 1.6) {
    const hTot = by + rows.length * rowPx - top0;
    ctx.fillStyle = BORDER; ctx.globalAlpha = 0.75;
    for (let x = 3; x < W; x += 3) ctx.fillRect(bx + (x - 1) * uPx, top0, Math.max(0.6, uPx), hTot);
    ctx.globalAlpha = 1;
  }
}
/** 판(스프라이트)을 굽는 크기 — 배율을 칸으로 **올림**한다.
 *
 *  배율이 연속이 된 뒤로 생긴 자리다(요청: 휠·핀치 연속 줌). 배율을 그대로 굽는 크기로
 *  쓰면 굳을 때마다 3.17배·3.42배처럼 제각각이 되어, 종류마다 쌓아 둔 판이 전부 헛것이
 *  된다(빗나감 100%). 옛 snapZoom이 값을 칸으로 떨구며 지키던 것이 바로 이 몫이다.
 *  **올림**인 까닭: 가장 가까운 칸으로 떨구면 3.2배를 2배 판으로 늘려 찍어 흐리다.
 *  위 칸으로 구우면 늘 줄여 찍으므로 어느 배율에서도 안 뭉갠다. 칸이 다섯뿐이라 판
 *  종류도 그대로 다섯 벌이고, 굽는 삯·메모리는 연속 줌 이전과 같다. */
/** 마커 칸의 자원 색(요청: "미네랄은 사이언, 가스는 네온 · 스타 플레이어 컬러에 없는
 *  색으로 형광끼 강하게") ────────────────────────────────────────────────────────
 *  왜 팔레트 밖이어야 하나: 이 칸의 네모는 전부 **임자색**이라, 자원까지 그 무리에 섞이면
 *  '누구 것인가'를 한 번 더 읽게 된다. 자원은 임자가 없는 것이니 색부터 갈라야 한다.
 *  원작 팔레트에서 가장 가까운 둘은 청록(teal #088088대)과 초록(#088008대)인데, 아래
 *  두 색은 그보다 훨씬 밝고 채도가 높아(형광) 나란히 놓아도 안 헷갈린다. */
/* 한 단 더 밝게(요청: "자원색 더 밝게") — 채도는 그대로 두고 밝기만 올린다. 마커 칸의
   자원은 어두운 지형 위에 4~8px짜리 점으로 앉으므로, 그 크기에서는 진한 색보다 **밝은
   색**이 먼저 눈에 든다(작은 면적은 채도보다 명도가 읽힌다). */
const MARKER_MIN = "#7cf9ff";   // 미네랄 — 형광 사이언
const MARKER_GAS = "#8bff66";   // 가스 — 네온 그린
const BAKE_STEPS = [1, 2, 4, 8, 16];
function bakeStepOf(z9: number): number {
  return BAKE_STEPS.find((v) => v >= z9 - 1e-6) ?? BAKE_STEPS[BAKE_STEPS.length - 1];
}
/* ★ 창에는 **꾸러미가 뜨는 순간** 내건다(지적: "__scrDiag 이거 안 뜨는데") ──────────
   앞서 자취를 받는 자리(loadEnt)에서 붙였는데, 그 자리는 못 닿는 길이 여럿이다:
   자취 부르개가 아예 없거나, 이미 받았거나, 받다가 던졌거나(그때는 catch로 샌다).
   그리고 정작 진단이 필요한 것이 바로 그 '못 닿은' 경우다.
   여기는 모듈이 읽히는 순간 한 번 도는 자리라, 재생기가 화면에 뜨기만 하면 반드시 있다.
   값이 아직 안 채워졌으면 truthVer 0 · truthWhy ""로 보인다 — **없는 것과 빈 것은
   다른 말**이고, 그 둘을 가릴 수 있어야 "안 뜬다"는 신고를 풀 수 있다. */
if (typeof window !== "undefined") {
  (window as unknown as { __scrDiag?: unknown }).__scrDiag = SCR_DIAG;
}
/** 진단의 **용도**(요청: "diag= 파라미터로 용도를 나누던가") — `#diag`만이면 요약 한 줄, `#diag=draw`(그리기·굽기),
 *  ★ 모드를 주제별로 다시 갈랐다(지적: "diag draw 너무 많아서 정리 · 내용별로 줄바꿈"): `draw`(화면·덜어내기·프레임)
 *    · `bake`(굽기·판갈림·캔버스) · `fog`(안개) · `load`(로딩·지도판·입체) · `gest`(손짓·원점) · `mem` · `worker` · `truth`
 *    · `brush` · `view` · `all`. 한 주제가 한 줄이고 줄 머리에 주제 이름이 선다.
 *  `#diag=mem`(메모리), `#diag=worker`(설계 일꾼), `#diag=truth`(참값), `#diag=all`(전부). 쉼표로 여럿(`mem,worker`). */
export const scrDiagModes = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  const m9 = /diag=([a-z,]+)/.exec(window.location.hash.toLowerCase());
  return new Set(m9 ? m9[1].split(",") : []);
};

function UnitLayer({ ops: opsProp, fx: fxProp, opsSrc, fxSrc, zoom, pan, tilePx, pickedKey, wallMask, maskRects, clipQuad, showShadows, showOverlap, showHp, showCreep, marker: markerProp, markerAt, detailAt, yawAt, moveAt, pitched: pitchedProp, painter, live, gesture, onPainted }: {
  ops: UnitDrawOp[]; zoom: number; pan: { x: number; y: number };
  /** ★ 붓의 보기 원천(실측: 감기 중 React 붓 팬 (−645.8,−821.7) vs 도착 붓 panRef (−646.2,−822.7)로 1px 어긋난 두 그림이
   *  번갈아 찍혔다). 틱·도착 붓은 부모의 zoomRef·panRef를 읽는데 이 effect는 상태 zoom·pan을 읽어, 렌더 사이에 ref만 바뀌면
   *  둘이 갈렸다. 부모가 그 ref들을 넘기면 이 effect도 **같은 원천**을 읽는다 — 어느 길로 어긋나든 두 그림이 같다. */
  viewRefs?: { z: { current: number }; p: { current: { x: number; y: number } } };
  /** 손짓이 도는 중인가(부모 xfGestureRef) — 손끝 보기(live)는 **이때만** 쓴다. 손짓이 끝났는데 남은 값은 옛 자리다(위 viewRefs 주석). */
  gesture?: { current: boolean };
  /** ★ 붓을 React 밖에서 몰 때(4번) — 시계 틱이 여기 넣어 둔 op·효과를 붓이 읽는다(props의 ops·fx보다 앞선다).
   *  driven이 참인 동안 이 effect는 안 칠한다(틱이 칠한다); 멈추면 종전대로 렌더마다 칠한다. */
  opsSrc?: { current: UnitDrawOp[] | null }; fxSrc?: { current: FxOp[] | null }; driven?: { current: boolean };
  /** 사양 게이트(요청) — 끄면 접지·겹침 그림자/체력바/크립을 안 그린다. 기본 켬. */
  showShadows?: boolean; showOverlap?: boolean; showHp?: boolean; showCreep?: boolean;
  /** 1배에서 타일 하나의 CSS px — 렌즈px 상수(트레이서 갈래표 l·w, 가시 높이)를 타일 자로 되돌리는 데 쓴다(아래 tz9). */
  tilePx?: number;
  /** 선택(집기)된 개체의 pickKey — 체력바를 늘 보인다(요청). */
  pickedKey?: string | null;
  /** 크립 차단 마스크(요청: 벽·램프·다리는 크립이 못 뚫는다) — 칸 하나가 픽셀 하나인
   *  지형 캔버스. clipWalk 판들을 깐 직후 destination-out으로 파낸다. */
  wallMask?: HTMLCanvasElement | null;
  /** 마스크를 얹을 화면 자리들 [원본 y, 원본 높이, fx0, fy0, fx1, fy1] — 평면은 맵
   *  전체 한 장, 입체는 원근이 줄마다 달라 지형 한 줄씩 근사한다. */
  maskRects?: [number, number, number, number, number, number][];
  /** 크립을 가두는 맵 네 모서리(분수 좌표, 시계방향) — 평면은 단위 사각형이고 입체는
   *  원근 투영된 사다리꼴이다(재지적: 3D에서 크립이 영역을 벗어남 — 직사각 클립은
   *  평면에서만 맞았다). rotateX 원근은 호모그래피라 변이 직선으로 남아 네 점이면 된다. */
  clipQuad?: [number, number][];
  /** 저배율 마커 보기(요청) — 렌더 쪽 markerView와 같은 값이 내려온다. */
  marker?: boolean;
  /** 마커로 갈아타는 **배율 문턱** — 이 값보다 낮은 배율로 그리면 마커다(지적: "줌
   *  1단계로 갈때 모델나오다가 마커로 바뀌는 현상"). 손짓 중에는 상태(props.zoom)가
   *  아직 안 굳었으므로 boolean 하나로는 늘 한 박자 늦는다 — 문턱을 받아 그리는
   *  그 배율로 그 자리에서 판정해야 손끝과 그림이 같이 간다. */
  markerAt?: number;
  /** 자세함(그림자·전투 효과·체력바)이 켜지는 배율 문턱 — 위와 같은 까닭. */
  detailAt?: number;
  /** 요잉 열여섯 칸이 서는 배율 — 그 아래서는 45도로 눕혀 그린다(붓 쪽 간이화, 아래 ★). */
  yawAt?: number;
  /** 걸음·추진 컷이 서는 배율 — 그 아래서는 기본 자세로 그린다(날갯짓은 늘). */
  moveAt?: number;
  /** 입체 보기인가 — 낮은 배율 죄기(lowZoomTrim9)가 어느 벤치로 잴지 가른다. */
  pitched?: boolean;
  /** 전투 효과(요청: 이펙트 캔버스 이관) — 몸을 다 그린 뒤 맨 위에 그린다. */
  fx?: FxOp[];
  /** 붓 넘기는 자리(수리: 손짓 중 캔버스 CSS 변환) — 렌더마다 이 칸에 그리기 함수를
   *  넣어 두면, 부모가 드래그·핀치 프레임에서 리액트를 안 거치고 곧장 다시 그린다. */
  painter?: { current: ((zoom: number, pan: { x: number; y: number }, bakeZoom: number) => void) | null };
  /** 지금 손끝의 보기 — 손짓이 도는 동안만 값이 있고, 그때는 props의 zoom·pan 대신
   *  이 값으로 그린다. 손짓이 없으면 null. */
  live?: { current: { z: number; p: { x: number; y: number } } | null };
  /** 한 장 그리고 나서 부모에게 알린다 — 부모는 이 보기를 손짓 임시 변환의 **기준**
   *  으로 삼는다. 캔버스에 걸려 있던 변환은 그리는 쪽이 함께 걷으므로, 기준 갈아끼움과
   *  변환 걷기가 언제나 같은 순간이다(둘이 어긋나면 그림이 두 번 밀린다). */
  onPainted?: (z: number, p: { x: number; y: number }) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  /** z 정렬 캐시 — 같은 ops로 두 번 이상 그릴 때(손짓 중 다시 그리기) 정렬을 아낀다. */
  const sortCacheRef = useRef<{ src: UnitDrawOp[] | null; out: UnitDrawOp[] }>({ src: null, out: [] });
  /** 그린 장 수 — 저배율의 격프레임 건너뛰기가 세는 자다(아래 effect 끝). */
  const frameRef = useRef(0);
  /** 마지막으로 **칠한 보기**(배율·팬) — 건너뛰기가 안전한지 가르는 자다(아래 sameView9). */
  const paintedRef = useRef<{ z: number; x: number; y: number } | null>(null);
  // 의존성 없는 effect — 매 렌더(t 걸음)마다 다시 그린다. ops는 렌더마다 새로 모인다.
  useEffect(() => {
    /* 그리기 한 벌을 함수로 뽑았다(수리: 손짓 중 캔버스를 CSS로 밀던 것) — 드래그·
       핀치·휠이 도는 동안 부모(재생기)가 **이 붓을 그대로 다시 쥔다**. 리액트를 안
       거치므로 걷기 루프·JSX diff는 안 돌고, 캔버스만 새 배율·팬으로 다시 그려진다.
       ★ 매개변수 이름이 props의 zoom·pan을 일부러 가린다 — 아래 몸통은 "지금 그릴
         배율·팬"만 알면 되고, 그것이 상태에서 온 값인지 손짓 중의 임시 값인지는
         부르는 쪽이 정한다.
       bakeZoom은 **판을 굽는 크기**에만 쓴다: 손짓 중에는 손짓 시작 배율로 못 박아
       두고 블릿 배율(k)만 달리해, 핀치 한 번에 종류마다 수십 벌을 다시 굽는 일을
       막는다. 자리·크기·잘림은 zoom이 그대로 정하므로 그림은 어긋나지 않는다. */
    const paint = (zoom: number, pan: { x: number; y: number }, bakeZoom: number): void => {
      const cv = ref.current;
      if (!cv) return;
      const ops = opsSrc?.current ?? opsProp;
      if (scrDiagOn()) brushLogPush9(zoom, pan.x, pan.y, ops.length, cv.style.transform);
      const fx = fxSrc?.current ?? fxProp;
      /* 지난 판에서 덜어낸 판들을 여기서 놓는다(위 RELEASE_Q9) — 이 시점에는 어느
         op도 옛 판을 안 들고 있다. */
      flushReleased9();
      const cw = cv.clientWidth;
      const ch = cv.clientHeight;
      /* ★ 이 캔버스는 지도보다 **위로 한 뼘 더 크다**(요청: 지도 위에 그림만 그려지는
         자리) — 그 몫을 CSS에서 되읽는다(부모가 지도, 나 자신이 지도+여유). 좌표 사상은
         **지도 크기**로 하고 그린 뒤 여유만큼 내린다: 그래야 분수 0~1이 여전히 지도의
         위·아래 끝이고, 늘린 몫은 지도 밖으로 솟은 그림만 받는다. */
      const band9 = Math.max(0, ch - (cv.parentElement?.clientHeight ?? ch));
      const mh9 = Math.max(1, ch - band9);
      if (!cw || !ch) return;
      /* 선명한 확대(지적: 확대가 선명하게 돼야) — 렌즈의 CSS 확대에 태우면 배킹 해상도가
         줌을 따라 커져야 해서 한계(4096px)에 막혀 흐려졌다. 이제 캔버스는 렌즈 밖에서
         뷰포트 크기 그대로 두고, 줌·팬을 그리기 좌표에 직접 입힌다 — 어느 배율에서도
         화면 픽셀(dpr) 그대로라 늘 또렷하고, 화면 밖 마커는 걸러 깊은 줌일수록 그릴
         것이 오히려 준다. */
      const dpr = window.devicePixelRatio || 1;
      /* ★ 손짓이 도는 동안은 **덜 칠한다**(요청: "이동 시 더 빠르게 시점 변경") ─────────────────────────────
         계측이 가리키는 병목은 셈이 아니라 **칠하는 픽셀**이다(표본의 3분의 2가 네이티브 칠하기·합성).
         이 깃발이 그 동안 둘을 접는다: ① 접지·부양 그림자(몸마다 한 겹 더 칠하는 몫) ② 배킹 배수(아래 Bd).
         자세함 문턱(detail)은 안 내린다 — 그쪽은 **판 열쇠를 바꿔** 손짓 시작마다 판을 새로 굽게 만든다.
         그림자와 배킹은 열쇠와 무관해 껐다 켜도 굽는 일이 없다. 손을 떼면 그 프레임에 제대로 한 장 그린다. */
      const gest9 = gesture?.current === true;
      gestBake9.v = gest9;   // 굽기 문지기가 읽는다(위 bakeOk9) — 끄는 동안은 새 판을 안 굽는다
      /* ★ **저배율에서는 배킹을 화면 픽셀 1배로 내린다**(요청: "사진처럼 그릴요소가 엄청
         많을때 버벅임을 좀 해결할수있는 방법") ────────────────────────────────────
         계측(scripts/perf-check.mjs — 1000유닛·PC폭·CPU 4배 조임)이 가리키는 자리다:
         프레임 133ms 가운데 83ms가 스프라이트 칠하기이고, 굽기 빗나감은 **0%**다. 곧
         셈이 아니라 **칠하는 픽셀 수**가 병목이다. 그 픽셀 수는 배킹 배수 B의 **제곱**
         으로 는다 — dpr 2 화면이면 넉 배다.
         그런데 그 넉 배가 사는 자리는 확대해서 몸을 들여다볼 때뿐이다. 지도 전체를 보는
         1·2배 칸에서는 유닛 한 마리가 예닐곱 픽셀이라, 배킹을 두 배로 잡아도 눈에 드는
         것이 없다(판도 그 크기로 구워지므로 잉크 자체가 그만큼밖에 없다).
         그래서 자세함 문턱(detailAt = 4배) 아래에서는 B를 1로 죈다. 판을 굽는 크기도
         B를 보므로(unitBakeCap·pxq) 굽는 삯과 판 메모리까지 함께 준다. */
      /* 배킹은 **늘 화면 요구(dpr)**다 — 배율에 따라 죄지 않는다(위 주석). 남는 천장은
         브라우저 캔버스 한 변 한계(4096px)뿐이고, 그것도 큰 PC 화면에서만 닿는다. */
      /* `?dpr=N`이 있으면 그 값으로 누른다(재보기 깃발 — perf9의 DPRCAP9 머리말).
         평소에는 Infinity라 아무 일도 안 한다. */
      /* ★ 작은 기기의 6배 이상은 배킹을 2로 누른다(지적: 폰 6배 대규모 교전에서 판 예산이 찬 채 굽고 버림 —
         요잉 8칸·자세 컷 없이도 179장 35MB로 예산 끝이었다). 한 장의 픽셀이 2.25분의 1이라 같은 예산에 두 배 넘게
         담긴다. 3배 이하는 판이 작아 예산에 여유가 있으니 화면 픽셀(dpr 3) 그대로 둔다. `?dpr=`이 있으면 그것이
         우선이다(더 낮은 쪽). */
      const capSmall9 = smallDevice9 && zoom >= 6 ? 2 : Infinity;
      const B = Math.min(dpr, DPRCAP9, capSmall9, 4096 / Math.max(cw, ch, 1));
      /* ★ 손짓이 도는 동안은 **배킹을 줄여 칠한다**(요청: "이동 시 더 빠르게 시점 변경") ─────────────────────
         병목은 셈이 아니라 칠하는 **픽셀 수**이고(계측: 표본의 3분의 2가 네이티브 칠하기), 그 수는 배킹 배수의
         제곱으로 는다. 끄는 동안 0.7배로 내리면 픽셀이 절반이 된다 — 그만큼 한 장이 싸지고, 주 실마리가 그만큼
         빨리 비어 손끝을 따라온다. 흐려지는 것은 **끄는 동안뿐**이고, 손을 떼면 그 프레임에 제 배킹으로 다시
         칠한다(endGestureXf의 마지막 한 장).
         ★ **판(스프라이트)을 굽는 자는 안 건드린다** — 굽기는 여전히 B를 본다(unitBakeCap·pxq·buildingSprite).
           그 자까지 내리면 손짓을 시작할 때마다 판을 통째로 새로 굽는 꼴이라 되레 느려진다. 여기서 바뀌는 것은
           '그린 판을 화면 픽셀 몇 개에 얹나' 하나뿐이다(판 px → CSS px 환산은 그대로 B다).
         가벼운 자리에서는 안 내린다(직전 한 장이 25ms 아래면 그대로) — 흐릴 까닭이 없다. */
      /* ★ 무거운 자리에서는 **한 단 더**(계측: 실기 3D 드래그에서 최악프레임 83ms · 그중 굽기 0ms —
         곧 순수한 칠하기다). 0.7배는 픽셀이 절반이라 83ms를 55ms 밑으로 못 내린다. 55ms를 넘으면
         0.5배(픽셀 4분의 1)로 내려, 그리기가 미룸 문턱 아래로 떨어지게 한다 — 그러면 다음 손짓 프레임
         부터는 미루지 않고 **손끝을 따라 그린다**. 스스로 되돌아오는 고리다: 싸진 한 장이 xfMsRef9를
         낮추고, 낮아진 값이 다시 그리기를 열고, 손을 떼면 제 배킹으로 한 장 또렷하게 칠한다. */
      /* ★ 몫은 **한 손짓 안에서 내려가기만 한다**(계측: 손짓 48ms → 87ms(미룸)) ─────────────────────
         값이 오르내리면 스스로 진동한다: 무거워서 0.7로 내리면 다음 장이 싸져 보이고(<55) 도로 1로
         올라가고, 그러면 다시 무거워진다 — 재는 값 자체가 그 조치의 결과라 그렇다. 한 손짓 동안은
         가장 낮았던 몫을 지키고, 손을 뗄 때 1로 되돌린다(제 배킹으로 마지막 한 장을 칠한다).
         셋째 칸(0.4)을 더한다 — 이제 남은 벽이 칠하는 픽셀이라(찍기 602장/프레임), 그 칸이 실제로 쓰인다. */
      const kWant9 = xfMsRef9.v >= 70 ? 0.4
        : xfMsRef9.v >= XF_HEAVY_MS9 ? 0.5
          : xfMsRef9.v >= 25 ? 0.7 : 1;
      if (gest9) { if (kWant9 < xfBackK9.k) xfBackK9.k = kWant9; } else xfBackK9.k = 1;
      const Bd = gest9 ? B * xfBackK9.k : B;
      /* ★ 그림자도 **배킹과 같은 자로** 접는다(지적: "드래그 중에 그림자 없어지는 거 봤어") — 위 깃발은 손짓이면
         무조건 그림자를 접었는데, 배킹은 손짓 프레임이 25ms를 넘을 때만 내린다. 6ms 벤치 PC의 손짓 프레임은
         그 문턱 한참 아래라 접을 까닭이 없고, 접으면 끌 때마다 그림자가 깜빡 사라진다. 배킹을 내린 손짓
         (xfBackK9.k < 1)에서만 같이 접는다 — 무거운 기기에서 덜어내던 몫은 그대로다. */
      const shFold9 = gest9 && xfBackK9.k < 1;
      const bw = Math.round(cw * Bd);
      const bh = Math.round(ch * Bd);
      if (cv.width !== bw) cv.width = bw;
      if (cv.height !== bh) cv.height = bh;
      /* 진단 수치는 **켜져 있을 때만** 적는다 — 여기는 프레임마다 도는 자리라,
         꺼져 있는 사람에게 글자 만들기를 시킬 까닭이 없다. */
      if (scrDiagOn()) {
        SCR_DIAG.dpr = dpr;
        SCR_DIAG.zoom = zoom;
        SCR_DIAG.unitCss = `${cw}x${ch}`;
        SCR_DIAG.unitBack = `${cv.width}x${cv.height}`;
        SCR_DIAG.unitB = B;
        /* 잰다 — clientWidth(정수)가 아니라 **실제로 그려지는 폭**과 견줘야 한다. */
        const r9 = cv.getBoundingClientRect();
        SCR_DIAG.unitScale = r9.width > 0
          ? Math.round((cv.width / (r9.width * dpr)) * 10000) / 10000 : 0;
        const fc9: Record<string, number> = {};
        for (const f9 of (fx ?? [])) {
          const k9 = `${f9.kind}:${f9.style ?? "-"}`;
          fc9[k9] = (fc9[k9] ?? 0) + 1;
        }
        SCR_DIAG.fx = fc9;
        /* 바깥(계측 도구)에서 읽을 수 있게 창에 걸어 둔다 — #diag일 때만이라 평소엔 없다. */
        (window as unknown as { __scrDiag?: unknown }).__scrDiag = SCR_DIAG;
      }
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      /* 등급은 배율도 본다(요청: 2.5배부터 전부) — 굽기가 이 값을 읽으므로 그리기 전에
         세워 둔다(lodSetCap·lodPenalty와 같은 결의 모듈 전역이다). */
      /* 마커·자세함은 **지금 그리는 배율**로 판정한다(위 markerAt 주석) — 손짓 중에도
         손끝이 문턱을 넘는 그 프레임에 바로 갈아탄다. 문턱을 안 받았으면 종전대로
         부르는 쪽이 준 boolean을 쓴다. */
      const marker = markerAt !== undefined ? zoom < markerAt : !!markerProp;
      /* 자세함 칸(그림자·체력바·효과) 판정 — 배킹 배수와는 별개다(위 주석: 배킹은 늘
         dpr이고, 문턱이 가리는 것은 '무엇을 그리나'뿐이다). */
      const detail = detailAt === undefined || zoom >= detailAt;
      /* 등급도 굽는 배율을 따른다 — 손짓 중에 등급이 바뀌면 그 프레임에 판을 통째로
         다시 구워야 한다(굽는 크기를 못 박아 둔 뜻이 없어진다). */
      lodSetZoom(bakeZoom);
      ctx.setTransform(Bd, 0, 0, Bd, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      /* (제거·요청) 도형 드롭섀도 — 건물·유닛 그림자를 다 걷었다(떠다니는 것 제외).
         떠 있음은 아래 hover 분기의 발밑 타원만 말한다. */
      // 렌즈 CSS(translate(pan) scale(zoom), 원점 가운데)와 같은 사상 — 분수 자리를
      // 확대·팬이 실린 화면 픽셀로 푼다.
      const zx = (f: number): number => (f - 0.5) * cw * zoom + cw / 2 + pan.x;
      const zy = (f: number): number => (f - 0.5) * mh9 * zoom + mh9 / 2 + pan.y + band9;
      /* 공중은 늘 위층(지적: 공중 유닛이 뒤·아래 건물에 가려짐) — 화가 순서에서 공중
         유닛을 통째로 지상·건물 위로 올린다. 공중끼리는 제 z 순서 그대로다. */
      /* 화면 밖 선별(지적: 줌·드래그 버벅임) — 이완·겹침·그리기 전에 뷰포트 밖(여유
         160px)을 통째로 걸러낸다. 깊은 줌일수록 남는 일이 급감한다. 크립 판은 맵
         전체 클립이라 남긴다. */
      const CULL = 160;
      const inView0 = (o: UnitDrawOp): boolean => {
        const ex0 = (o.wFrac !== undefined
          ? Math.max(o.wFrac, o.hFrac ?? 0) * cw : o.sizePx) * zoom + CULL;
        const vx0 = zx(o.fx);
        const vy0 = zy(o.fy);
        /* ★ **크립 얼룩도 화면 밖은 안 그린다**(조사: "12배 확대에서 저그 기지에서만
           버벅임이 있어, 특히 드래그 시") ─────────────────────────────────────────────
           여기 있던 `if (o.clipWalk) return true`가 그 버벅임의 자리다. 크립 판을 **한
           장도 안 걸러** 늘 다 그렸다 — 지도 전체의 저그 건물마다 하나씩이니 후반 무한
           맵에서는 수십 장이고, 그 전부가 매 프레임 그려졌다.
           배율이 오르면 값이 폭발한다: 얼룩은 못 박은 작은 판(DECAL_BAKE_MAX)에서
           늘려 찍으므로, 12배에서 한 장의 **목적지 사각형**이 5000기기픽셀을 넘는다.
           수십 장이면 한 프레임에 수억 픽셀을 늘려 그리는 셈이다. 드래그는 그 프레임을
           손가락이 움직이는 내내 다시 그리므로 거기서 가장 아프고, 크립은 저그만
           내므로 저그 기지에서만 난다 — 지적의 세 조건이 정확히 이 한 줄에서 나온다.
           걸러도 그림은 안 바뀐다: 화면 밖 얼룩은 아래 클립(지도 상자·사다리꼴)에서도
           어차피 한 픽셀도 안 남는다. 다만 **위쪽 여유 띠 규칙은 안 태운다** — 얼룩은
           크므로 중심이 띠 위에 있어도 아랫자락이 화면을 덮을 수 있다. */
        if (o.clipWalk) {
          return vx0 >= -ex0 && vx0 <= cw + ex0 && vy0 >= -ex0 && vy0 <= ch + ex0;
        }
        /* ★ 위쪽 여유에 그릴 자격은 **발이 상자 안에 있는 것**뿐이다(지적 둘) ──────────
           ① "맨 위가 아닌 아래쪽 화면을 볼 때 유닛도 그 위에 서 있고 그래 … 지금 뷰
              프레임 밖인 거잖아" — 확대·이동해서 지도 가운데를 보고 있으면 상자 위쪽
              바깥은 진짜 지도 내용이다. 그 자리에 선 것을 여유에 그리면 창 밖을
              훔쳐보는 그림이 되고, 그 자리는 지도 밖이라 눌러도 안 잡힌다.
           ② "1배 아니어도 맨 윗줄의 유닛은 추가 그림 영역에 다 그려 줘야 해" — 그렇다고
              여유를 통째로 접으면(먼젓번 손) 지금 보이는 맨 윗줄에 선 키 큰 것이 도로
              잘린다. 접을 것은 여유가 아니라 **자격**이다.
           가르는 자는 발자리다: 발이 상자 안(vy0 ≥ 여유)이면 그 몸이 위로 아무리 솟아도
           다 그린다 — 그 유닛은 지금 보이는 것이고, 발을 누르면 잡힌다. 발이 상자 위끝
           보다 위면 그 유닛은 창 밖이라 한 톨도 안 그린다. 배율·이동과 무관한 한 줄이다. */
        if (band9 > 0 && vy0 < band9 - 0.5) return false;
        return vx0 >= -ex0 && vx0 <= cw + ex0 && vy0 >= -ex0 && vy0 <= ch + ex0;
      };
      /* 그리는 차례(z 순)는 **ops가 그대로면 그대로다** — 손짓 중에는 같은 ops로 여러
         번 다시 그리므로(위 painter), 그때마다 수백 개를 다시 정렬할 까닭이 없다.
         화면 밖 걸러내기(inView0)만 배율·팬을 타므로 그건 매번 한다. */
      if (sortCacheRef.current.src !== ops) {
        sortCacheRef.current = {
          src: ops,
          out: [...ops].sort((a, b) => (a.z + (a.air ? Z_AIR : 0)) - (b.z + (b.air ? Z_AIR : 0))),
        };
      }
      /* ★ **낮은 배율의 간이화는 여기서 한다**(요청: 워커 분리 — "자세·요잉은 둘째 방법") ────────
         엔진(워커)은 늘 자세히 낸다(열여섯 칸 요잉·모든 자세 컷·탱크 차체+포탑). 배율은 프레임에 안
         실리므로, 배율이 바뀌어도 미리 지어 둔 프레임이 산다. 대신 붓이 그릴 때 배율을 보고 깎는다:
           · 요잉: yawAt 아래서는 45도 칸으로 눕힌다(판 캐시가 여덟 칸만 든다).
           · 자세: detailAt 아래서는 공격 컷을 지우고, moveAt 아래서는 걸음·추진 컷도 지운다.
             날갯짓(flap)만은 늘 남긴다(뮤탈의 날개는 세부가 아니라 살아 있다는 표시).
           · 탱크: detailAt 아래서는 차체+포탑 판 대신 한 판(tank·tanksiege)으로 그리고 포신 op은 버린다.
         옛 만드는 쪽 판정(liteView·liteYaw)과 같은 칸에서 같은 답이 나오게 문턱을 그대로 받는다. */
      const lite9 = !detail;
      const liteYaw9 = yawAt !== undefined && zoom < yawAt;
      /* 낮은 배율 죄기 — 배율은 **지금 칠하는 값**으로 잰다(손짓 중에는 React가 안 돌므로
         프롭으로 받으면 한 박자 늦는다). 사정은 lowZoomTrim9 주석에. */
      const trim9 = lowZoomTrim9(zoom, !!pitchedProp);
      const moveOk9 = moveAt === undefined || zoom >= moveAt;
      const sorted = ((): UnitDrawOp[] => {
        const raw9 = sortCacheRef.current.out.filter(inView0);
        if (!lite9 && !liteYaw9) return raw9;
        const out9: UnitDrawOp[] = [];
        for (const op0 of raw9) {
          let op = op0;
          if (lite9 && (op.kind === "tankgun" || op.kind === "tanksiegegun" || op.kind === "tankturret0")) continue;
          let kind = op.kind;
          let pose = op.pose ?? 0;
          let rotDeg = op.rotDeg;
          let viewYaw = op.viewYaw;
          /* 입체 좌우 시점(vq)도 낮은 배율에서 접는다(지적: "3D 충분이라고 판단했는데 실제로는 버벅이고 모델
             굽는 중이 계속" — PC·지도 전체·1562기: 미룸 2242장). 벤치는 채우는 속도를 재지 **판의 가짓수**를
             안 잰다. 입체에서 판 열쇠는 종류 × 요잉 8 × 시점 13칸(±36을 6도로)이라, 온 지도가 보이면 몇천
             장이 되어 굽기가 영영 못 따라간다. 유닛이 몇 px뿐인 배율에서 시점 밀림은 안 읽히므로 1.5배 밑은
             0으로, 그 위 lite 구간은 18도 칸(5칸)으로 접는다 — 판이 13분의 1·2.6분의 1로 준다. */
          if (liteYaw9 && viewYaw) viewYaw = zoom < 1.5 || trim9 >= 1 ? 0 : Math.round(viewYaw / 18) * 18;
          if (lite9) {
            if (kind === "tankbody") kind = "tank";
            else if (kind === "tanksiegebody") kind = "tanksiege";
            const pk9 = POSE_KINDS[kind];
            /* ★ 죄면 **날갯짓도 접는다**(지적: "모바일 저배율에서 고배율마냥 디테일하게 그릴
               필요는 없지") — 날갯짓은 '세부가 아니라 살아 있다는 표시'라 낮은 배율에서도
               남겨 두던 자리다. 그런데 1~3배에서 뮤탈은 일고여덟 화소다: 날개가 접혔는지
               폈는지는 안 읽히면서, 판 열쇠는 자세마다 하나씩 더 갈린다(그만큼 굽는 줄이 길다).
               배율을 올리면 그대로 돌아온다. */
            if (pk9 && !pk9.flap && trim9 < 1) {
              const walk9 = pose === 1 || pose === 3;
              if (!walk9 || !moveOk9 || !(pk9.move || pk9.thrust)) pose = 0;
            } else if (!pk9 || trim9 >= 1) pose = 0;
          }
          /* 요잉 칸 — 죄면 **네 칸**(90도)이다. 45도 칸의 부분집합이라 이미 구운 판이 그대로
             쓰이고, 판 가짓수만 반으로 준다(갈아엎는 전환이 아니다).
             ★ **건물은 아예 손대지 않는다**(지적: "건물이 서있는 방향 자체가 바뀌어서" ·
               "건물까지 요잉해서 다 그릴 필요는 없잖아 무조건 45도인데") ────────────────────
               맞는 말이다. 건물은 모두 한 각(BUILDING_BASE_YAW = 45도)으로 서므로 칸으로
               나눌 것이 애초에 없다 — 아낄 판이 없는데 틀릴 자리만 있었다: 90도 칸에 넣으면
               round(45/90)×90 = 90이라 **모든 건물이 돌아갔다**(45도 칸일 때는 45가 그대로
               45라 우연히 멀쩡했다). 게다가 건물의 방향은 순간의 값이 아니라 **정체**다.
               죄는 값은 유닛의 회전에 있다(실측: 판갈림 유닛 회전 3892 · 건물은 불빛·포탑뿐). */
          /* ★ 칸에 **불감대**를 둔다(지적: "3배 이하에서 유닛이 깜빡여 없어졌다 나타났다 해.
             방향이 비어서 그런 거 아닐까") — 절반은 맞았다. 그냥 반올림하면 44.9도와 45.1도를
             오가는 유닛이 틱마다 0도 ↔ 90도로 **홱 돌아간다**(90도 칸에서는 그 뒤집힘이 앞뒤가
             바뀌는 것이라 깜빡임으로 읽힌다). 게다가 판 열쇠가 둘로 갈려 굽는 줄도 두 배다.
             그래서 직전에 고른 칸을 기억해 두고, 각이 칸의 0.72(90도 칸이면 65도)를 넘어 멀어질
             때에만 옮긴다 — 경계에서 20도쯤의 불감대가 생겨 파닥임이 사라진다. */
          if (liteYaw9 && rotDeg !== undefined && UNIT_KIND_SET.has(kind)) {
            const st9 = trim9 >= 1 ? 90 : 45;
            let q9 = Math.round(rotDeg / st9) * st9;
            const pkq9 = op0.pickKey;
            if (pkq9 !== undefined) {
              const prev9 = YAWQ9.get(pkq9);
              if (prev9 !== undefined && prev9 % st9 === 0
                && Math.abs((((rotDeg - prev9) % 360) + 540) % 360 - 180) < st9 * 0.72) q9 = prev9;
              if (YAWQ9.size > 8000) YAWQ9.clear();
              YAWQ9.set(pkq9, q9);
            }
            rotDeg = ((q9 % 360) + 360) % 360;
          }
          /* ★ 낮은 배율의 **건물은 한 판으로 앉힌다**(실측: 판갈림 건물 불빛512 포탑358 · 미룸 B226) ──
             건물 판의 열쇠에는 포탑 각(16칸)·창문 불빛(2)·도는 부품 칸이 함께 든다. 그래서 캐논 한
             종류가 서른두 판으로 갈라지고, 그 판들이 프레임당 한 장씩만 구워지는 줄에 서서 화면이
             한참 비어 있다. 그런데 1~3배에서 건물은 아홉에서 스물몇 화소다 — 포탑이 어디를 보는지도,
             창에 불이 켜졌는지도, 팬이 도는지도 그 크기에서는 읽히지 않는다.
             그 셋을 못 박으면 종류마다 **한 판**이 되어 줄이 통째로 사라진다. 배율을 올리면 그대로
             돌아온다(죄기는 3배 이하·미달 기기에서만 선다). */
          let head9 = op.headDeg;
          let lit9 = op.lit;
          let spin9 = op.spin;
          if (trim9 >= 1 && !UNIT_KIND_SET.has(kind)) {
            head9 = undefined; lit9 = false; spin9 = 0;
          }
          if (kind !== op.kind || pose !== (op.pose ?? 0) || rotDeg !== op.rotDeg || viewYaw !== op.viewYaw
            || head9 !== op.headDeg || lit9 !== op.lit || spin9 !== op.spin) {
            op = { ...op, kind, pose: pose as UnitDrawOp["pose"], ...(rotDeg !== undefined ? { rotDeg } : {}),
              ...(viewYaw !== undefined ? { viewYaw } : {}),
              headDeg: head9, lit: lit9, spin: spin9 };
          }
          out9.push(op);
        }
        return out9;
      })();
      /* ★ **어차피 덮일 유닛은 안 그린다**(요청: "유닛은 유닛으로 그려야 해. 뭉친 유닛을
         적게 그리는 건 괜찮으려나") ─────────────────────────────────────────────────────
         낮은 배율에서 유닛 하나는 서너 화소다. 뭉친 부대는 같은 화소 몇 개를 수십 번
         덮어 칠하는데, **화면에 남는 것은 맨 나중에 찍은 한 장뿐**이다 — 그 아래 것들은
         한 톨도 안 보이면서 찍는 값은 다 치른다(실측: 찍기 2235장/프레임 · 최악 프레임 505ms).
         그래서 화면을 유닛 크기만 한 칸으로 나누고, 한 칸에서 **맨 나중에 찍힐 하나**만
         남긴다. 점으로 바꾸는 것과 다르다: 남은 것은 그대로 **제 모습의 유닛**이고,
         빠지는 것은 그것에 가려 안 보였을 것들뿐이다.
         · 화가 순서의 **뒤엣것**을 남긴다 — 그것이 곧 눈에 보이던 그 한 장이다.
         · 건물·자원·크립은 안 건드린다(수가 적고 서로 안 겹친다). 고른 개체도 늘 남긴다.
         · 벤치 미달 + 1~3배(저배율죔)에서만 — 멀쩡한 기기와 높은 배율은 종전 그대로다. */
      const drawList9 = ((): UnitDrawOp[] => {
        if (!THIN_ON9 || trim9 < 1 || sorted.length < 64) { THIN9.n = 0; THIN9.drew = 0; return sorted; }
        const thin9 = (o9: UnitDrawOp): boolean => UNIT_KIND_SET.has(o9.kind)
          && !(pickedKey != null && o9.pickKey === pickedKey);
        /* 칸은 그린 유닛 폭 언저리 — 이보다 잘면 덮이지 않은 것까지 빼고, 굵으면 서로
           떨어져 선 것을 뺀다. 타일 폭의 0.7이 한 유닛의 몸 폭에 가깝다. */
        const cell9 = Math.max(2, (tilePx ?? 8) * zoom * 0.7);
        /* ★ 칸 경계의 **깜빡임을 없앤다**(지적: "3배 이하에서 유닛이 깜빡여 없어졌다 나타났다 해") ──
           여기 있던 것은 '한 칸에 하나'였다. 그런데 칸은 화면에 못 박힌 격자라, 이웃해 선 유닛이
           경계를 조금만 넘나들면 같은 칸 ↔ 다른 칸이 틱마다 뒤집힌다 — 같은 칸이면 지워지고
           다른 칸이면 그려지니, 가만히 선 유닛이 30Hz로 깜빡였다.
           고친 자리 둘:
           · **격자 대신 거리**로 본다 — 이미 남긴 것과의 거리가 칸의 절반 안일 때만 뺀다
             (격자는 이웃 3×3 칸을 뒤지는 색인으로만 쓴다). 실제로 덮인 것만 빠진다.
           · 그 거리에 **불감대**를 둔다 — 보이던 것은 0.46칸보다 가까워져야 숨고, 숨은 것은
             0.78칸보다 멀어져야 다시 나온다. 경계에서 오갈 자리가 없어진다.
           남길 쪽은 종전대로 화가 순서의 **뒤엣것**(눈에 보이던 그 한 장)이라, 뒤에서부터 훑고
           끝에 뒤집는다. 건물·자원·크립은 안 건드리고 고른 개체는 늘 남긴다. */
        if (THIN_ST9.size > 8000) THIN_ST9.clear();
        const acc9 = new Map<number, number[]>();
        const ax9: number[] = []; const ay9: number[] = [];
        const out9: UnitDrawOp[] = [];
        for (let i9 = sorted.length - 1; i9 >= 0; i9 -= 1) {
          const o9 = sorted[i9];
          if (!thin9(o9)) { out9.push(o9); continue; }
          const sx9 = zx(o9.fx); const sy9 = zy(o9.fy);
          const pk9 = o9.pickKey;
          const r9 = cell9 * (pk9 !== undefined && THIN_ST9.get(pk9) === 1 ? 0.78 : 0.46);
          const cx9 = Math.floor(sx9 / cell9); const cy9 = Math.floor(sy9 / cell9);
          let cov9 = false;
          for (let dy9 = -1; dy9 <= 1 && !cov9; dy9 += 1) {
            for (let dx9 = -1; dx9 <= 1 && !cov9; dx9 += 1) {
              const lst9 = acc9.get((((cy9 + dy9) & 0xffff) * 65536) + ((cx9 + dx9) & 0xffff));
              if (!lst9) continue;
              for (let k9 = 0; k9 < lst9.length; k9 += 1) {
                const j9 = lst9[k9];
                if (Math.abs(ax9[j9] - sx9) < r9 && Math.abs(ay9[j9] - sy9) < r9) { cov9 = true; break; }
              }
            }
          }
          if (pk9 !== undefined) { if (cov9) THIN_ST9.set(pk9, 1); else THIN_ST9.delete(pk9); }
          if (cov9) continue;
          const ck9 = ((cy9 & 0xffff) * 65536) + (cx9 & 0xffff);
          const lst9 = acc9.get(ck9);
          if (lst9) lst9.push(ax9.length); else acc9.set(ck9, [ax9.length]);
          ax9.push(sx9); ay9.push(sy9);
          out9.push(o9);
        }
        out9.reverse();
        THIN9.n = sorted.length; THIN9.drew = out9.length;
        return out9;
      })();
      /* ── (걷어냄) **겹침 이완** — 이것이 '슬라이딩'의 진범이었다 ────────────────
         지적: "슬라이딩 문제를 완전 잘못 짚은거 같아 … 진짜 원인은 유닛 겹침 허용과
         관련있을거 같거든? 그쪽을 파봐". 맞았다.
         여기 있던 것은 그리기 직전에 화면 픽셀 좌표에서 유닛을 서로·건물과 안 겹치게
         밀어내는 두 번의 이완이었다. 그런데 **누가 밀렸나**를 보면 문제가 드러난다:
         `noSep: !WORKER_KIND_SET.has(kind)`라 **일꾼만 밀리는 쪽**이었고, 나머지 유닛과
         건물은 못 박힌 장애물이었다. 그래서 밭·본진에 몰린 일꾼이 프레임마다 이웃의
         잔떨림에 따라 다른 방향으로 최대 3px씩 밀렸다 — 다리는 안 움직이는데 몸만
         스르르 흐르는 그 그림이 정확히 이것이다("일꾼도 그렇고").
         ★ 무엇보다 **이제 필요가 없다**. 이 이완은 자리를 명령 좌표로 **유추하던**
           시절의 장치다: 그때는 여럿이 한 점에 겹쳐 서므로 화면에서라도 떼어 놓아야
           했다. 지금 자리는 코어가 낸 참값이고, 그 안에는 원작 자신의 충돌 처리가
           이미 들어 있다 — 원작이 놓은 자리가 곧 안 겹치는 자리다. 그 위에 한 겹을
           더 미는 것은 참값을 흔드는 일일 뿐이다.
         (op의 noSep·sepPx 칸은 남겨 둔다 — 인포 팝업·집기가 몸 크기를 잴 때 쓴다.) */
      const paintOps = (list: UnitDrawOp[]) => {
      /* 몸 그림자는 **상시**다(요청: "그 겹침 그림자 있잖아. 그거 상시 노출로 바꿔줘
         그거 있는게 훨씬 멋져") ─────────────────────────────────────────────────
         여태는 이름 그대로 '겹칠 때만'이었다: 균일 격자로 이웃을 훑어 몸이 닿는 짝을
         찾고, 그중 나중에 그려지는(앞) 쪽에만 옅은 드롭섀도를 켰다. 닿을 때만 윤곽이
         갈리니 같은 유닛이 걷다가 그림자가 붙었다 떨어졌다 했고(앞선 지적의 '있다
         없다'와 같은 결), 무엇보다 그림자가 있는 쪽이 훨씬 낫다.
         이제 몸을 찍는 모든 op이 같은 그림자를 진다 — 이웃 탐색(격자 만들기 + 3×3
         버킷 훑기)이 통째로 사라지므로, 그리기 삯은 오히려 준다(그 자리를 캔버스
         shadowBlur가 대신 쓴다).
         사양 게이트는 그대로다(showOverlap = 품질 '고') — 낮은 사양에서는 안 켠다. */
      /* `?noshadow=1`이 이것도 끈다 — 그 깃발의 이름이 약속하는 바이고, 무엇보다
         **한 주소로 A/B가 된다**(그림자 탓인지 판이 큰 탓인지를 가르는 유일한 길). */
      const bodyShadow = showOverlap !== false && !NOSHADOW9 && CROWD9.lv === 0   // 덜어내기 1단부터 끔
        && zoom >= SHADOW_MIN_ZOOM && !marker;
      /* ★ **그림자 끄기는 프레임에 한 번**(계측: 찍기 417장/프레임에 최악프레임 100ms — 그중 굽기는 37ms뿐) ──
         여기 있던 `ctx.shadowColor = "transparent"` 열넷은 개체 하나를 그리는 동안 아홉 번까지 다시 적혔다.
         한 프레임 400개면 3600번이고, 그 대입은 그때마다 색 문자열을 파싱한다.
         그런데 이 캔버스는 shadowBlur가 0이다 — 몸 그림자는 런타임 shadowBlur가 아니라 **구워 둔 그림자 판**
         (shadowPlate)으로 찍는다. blur가 0이면 shadowColor는 아무 일도 안 한다. 곧 그 대입 전부가 헛일이었다.
         프레임 머리에서 한 번 끄고(blur까지 못 박아 뒤에 누가 켜도 이 자리에서 다시 0이다) 안쪽 대입은 걷는다. */
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      for (const op of list) {
        const sx = zx(op.fx);
        const sy = zy(op.fy);
        /* 발이 닿는 세로 자리 — 지면선이 있으면 그것을 쓴다(그림자와 같은 지면 사상). */
        const groundY = op.baseFy !== undefined ? zy(op.baseFy) : undefined;
        // 화면 밖은 걸러낸다 — 깊은 줌에서 그리기가 오히려 줄어드는 이유.
        const ext = (op.wFrac !== undefined
          ? Math.max(op.wFrac, op.hFrac ?? 0) * cw : op.sizePx) * zoom + 24;
        if (sx < -ext || sx > cw + ext || sy < -ext || sy > ch + ext) continue;
        /* ── 저배율 마커(요청) — save() 앞에서 갈라져 op마다의 save/restore·그림자·판
           조회를 통째로 건너뛴다. 상태는 alpha·fillStyle만 만지므로 저장이 필요 없다. */
        if (marker && !op.textGlyph && !op.clipWalk) {
          ctx.globalAlpha = op.alpha;
          ctx.fillStyle = op.color;
          if (op.wFrac !== undefined && op.hFrac !== undefined) {
            /* 건물·자원 — 발자국 폭 그대로의 납작 사각. 바닥선(baseFy)에 앉힌다.
               ★ 자원만 **형광색**으로 못 박는다(요청: "미네랄은 사이언, 가스는 네온으로
                 · 스타 플레이어 컬러에 없는 색으로 형광끼 강하게") — 마커 칸에서는
                 자원도 임자 없는 회청/회갈 네모라, 임자색 네모들 사이에 섞여 '누구
                 것인가'를 한 번 더 읽게 만들었다. 자원은 임자가 없는 것이니 아예
                 팔레트 밖 색이어야 한다(MARKER_MIN·MARKER_GAS 주석). 크기·자리는 그대로다. */
            const res9 = op.kind.startsWith("mineral") ? MARKER_MIN
              : op.kind.startsWith("geyser") ? MARKER_GAS : null;
            if (res9) { ctx.fillStyle = res9; ctx.globalAlpha = 1; }
            const mwPx = Math.max(2, op.wFrac * cw * zoom);
            const mhPx = Math.max(2, op.hFrac * cw * zoom * 0.72);
            const gy9 = groundY ?? sy + (op.hFrac * cw * zoom) / 2;
            ctx.fillRect(sx - mwPx / 2, gy9 - mhPx, mwPx, mhPx);
          } else {
            /* 유닛 — 종별 상자에 비례하는 **동그라미**(요청: "마커 중 유닛은 원으로").
               크기 비례는 네모 시절 그대로다(상자의 0.42) — 그 값이 곧 지름이고,
               반지름은 절반이다. 공중만 살짝 띄워 지상과 갈린다. */
            const px9 = op.sizePx * zoom;
            const mw9 = Math.max(2, px9 * 0.42);
            const my9 = sy - (op.air ? px9 * 0.45 : 0);
            ctx.beginPath();
            ctx.arc(sx, my9, mw9 / 2, 0, Math.PI * 2);
            ctx.fill();
            if (op.selRing) {
              ctx.strokeStyle = op.color;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(sx, my9, mw9 / 2 + 1.5, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          continue;
        }
        /* (걷어냄) op마다의 ctx.save()/restore() — 계측(perf-check --zoom 2.5)에서 save가
           CPU 자기 시간 7%였다. 스택 대신 **블록마다 제가 쓰는 상태를 직접 세팅**한다
           (shadowColor·globalAlpha·fillStyle은 어차피 다 제 값으로 놓고 쓰고 있었다).
           변환이 필요한 곳(스프라이트 블릿·직접 그리기)만 setTransform 합성으로 절대
           좌표를 만들고 끝에 기본(B 배율)으로 되돌린다. */
        /* 건물은 그림자 없음(지적: 떠 보임 — 유닛만 그림자) — SVG 시절 filter:none과 동일.
           공중 유닛도 자체 그림자는 걷는다(지적) — 바닥 타원이 그림자를 맡으니, 몸에 또
           드리우면 그림자가 두 겹이 된다. 일꾼 셋도 떠다니는 기계라 같은 규칙(지적:
           일꾼들도 공중에 떠 있으니 바닥 그림자) — 다만 몸은 안 들어올린다. */
        /* 떠다니는 지상 유닛도 같은 규칙(지적) — 벌처·아콘·다크 아콘·하이 템플러는
           부양 유닛이라 발밑 그림자를 깐다. */
        /* ★ 짐을 진 일꾼도 같은 일꾼이다(지적: "한 유닛이나 건물도 그림자가 있다 없다")
           — 이 목록에 scv·probe·drone만 있어서, 미네랄·가스를 지고 오는 동안(kind가
           scvMin·droneGas로 바뀐다) 같은 일꾼이 부양 갈래에서 지상 갈래로 떨어졌다.
           두 갈래의 타원은 크기도 짙기도 달라, 밭과 홀 사이를 오가는 일꾼의 그림자가
           한 왕복마다 커졌다 작아졌다 했다. 짐 유무는 그림자가 알 일이 아니다. */
        const hover = op.air || HOVER_UNIT_SET.has(op.kind);
        if (op.textGlyph) {
          // 부속건물 + 같은 글자 하나 — 스팬 글자와 같은 굵기·가운데 앵커.
          ctx.globalAlpha = op.alpha;
          ctx.fillStyle = op.color;
          ctx.font = `700 ${op.sizePx * zoom}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(op.textGlyph, sx, sy);
          continue;
        }
        if (op.wFrac !== undefined && op.hFrac !== undefined) {
          // 건물 상자 — 스팬의 % 폭 + aspectRatio(폭 기준)를 그대로 픽셀로 푼 것.
          const wPx = op.wFrac * cw * zoom;
          const hPx = op.hFrac * cw * zoom;
          if (op.boxFit === "fill") {
            // 맨 네모(전용 도형 없는 건물) — 상자를 그대로 채운다(.scr-motion-sq).
            ctx.globalAlpha = op.alpha;
            ctx.fillStyle = op.color;
            ctx.fillRect(sx - wPx / 2, sy - hPx / 2, wPx, hPx);
            continue;
          }
          // keepRatio(xMidYMax meet) — 비율 유지로 상자에 맞추고 바닥 가운데 정렬.
          // 스프라이트로 찍는다(요청: 건물도 병목 감축) — 실패 시 직접 그리기 폴백.
          /* 그릴 때만 키운다(요청: "건물들 지도에 그릴때 1.2배 확대필요해보임") —
             ★ 모델 좌표(BLD_NORM)를 키우는 길은 안 쓴다. 목표 채움을 1.2배로 올려
               다시 재 봤더니 굽는 상자에 걸리는 종류가 **2종에서 12종으로** 늘었다:
               걸린 것들은 1.2배가 아니라 제 상한까지만 커지므로, 건물끼리의 크기 비가
               통째로 어긋난다 — 정규화가 막으려던 바로 그 일이다.
               여기서 키우면 판이 그 크기로 **구워지므로** 흐려지지도 않고, 모델 좌표는
               한 톨도 안 건드려 서로의 비가 그대로 남는다.
             그림자·체력바·발자국 자리는 안 따라 커진다 — 그림자는 발자국의 것이고
             바닥선(baseFy)도 발자국의 것이라, 커진 몸이 같은 땅 위에 앉는다. */
          const sidePx = (op.fitWidth ? wPx : Math.min(wPx, hPx)) * (op.drawK ?? 1);
          /* 상한을 넘겨야 하면 상한 크기로 굽고 아래 k가 늘려 찍는다(위 bldBakeCap 주석).
             굽는 크기는 bakeZoom 몫이다(유닛 pxq와 같은 까닭) — 손짓 중에는 그대로 두고
             블릿 배율(k = sidePx / sideQ)만 달라진다. */
          /* 판 크기를 기기픽셀 격자에 맞춘다 — 유닛 pxq와 같은 까닭이다(그쪽 주석):
             짝수 CSS px로 죄면 블릿 배율(k = sidePx / sideQ)이 1이 아니게 되고, 1에
             가까운 비정수 배율이 모델을 고르게 뭉갠다. 격자에 맞추면 k가 1이 된다. */
          const sideRaw9 = Math.max(4, Math.round((sidePx * bakeZoom / zoom) * B) / B);
          /* ★ **입체에서는 굽는 크기를 비의 사다리에 앉힌다**(계측: 2초에 건물 221장 194ms) ─────────────
             입체에서 건물의 크기는 **화면에서의 깊이**가 정한다(원근). 그래서 화면을 조금만 밀어도 건물마다
             원하는 크기가 조금씩 달라지고, 위 격자는 그것을 기기픽셀 한 톨까지 따라간다 — 곧 열쇠가 한 톨마다
             갈려 같은 건물이 판을 수십 벌 굽는다. 손짓 뒤마다 200장 넘게 다시 굽던 몫이 이것이다(굽는 값도
             값이지만, 그렇게 갈린 판이 보관 예산을 먹어 캐시가 영영 안 차는 것이 더 아프다).
             한 옥타브를 열두 칸으로 끊어 그 칸에 앉힌다 — 이웃 칸과의 차가 5.9%, 이상값과의 차는 최대 2.9%다.
             남는 차이는 블릿 배율(k)이 이미 진다(아래 `bspr.side !== sideWant`). 평면(2D)에서는 크기가 배율로만
             바뀌고 그 배율은 이미 칸으로 죄어 있으므로 종전대로 격자에 딱 맞춰 굽는다(k = 1, 가장 또렷하다). */
          const sideWant = op.pitch ? bldLadder9(sideRaw9, B) : sideRaw9;
          /* ★ **크립은 배율도 시점도 안 탄다**(지적: "크립 아직도 메모리 터져 — 구현 방식
             근본적인 수정 필요") ────────────────────────────────────────────────────────
             크립 얼룩은 3차원 모형이 아니라 **땅에 누운 무늬 한 장**인데, 여태 다른 건물과
             똑같은 열쇠로 구워졌다. 그 열쇠에 든 두 칸이 이 판을 터뜨렸다:
               ① 굽는 크기(sideQ) — 배율을 따라가므로 줌 칸이 바뀔 때마다 새 세대를 굽는다.
               ② 좌우 시점(vq) — `viewYawOf(x, y)`는 **화면 자리**가 정하므로 −36~36을 6도로
                  끊은 **열세 칸**이다. 곧 크립 얼룩 하나가 지도 위 자리마다 다른 판이 되고,
                  화면을 밀 때마다 그 칸이 바뀐다.
             둘을 곱하면 얼룩 한 무늬가 (줌 칸 × 13)장이다. 실측 치수로 깊은 배율 한 칸만
             따져도 3무늬 × 13칸 × 2보기 = 78장 × 0.57MB ≈ 44MB — 폰의 건물 판 예산(16MB)의
             세 배다. 예산이 그만큼 넘치면 LRU가 **매 프레임 쫓아내고 다시 굽는다**. 여기에
             다시 굽는 값(4MB짜리 굽는 판)이 얹히는 것이 터지던 얼개다.
             ── 고치는 자리는 **열쇠**다
             · 크기는 **못 박는다**(DECAL_BAKE_MAX 하나) — 얼룩은 단색 한 겹이라 화소를
               늘려도 더 나올 것이 없고, 늘려 찍는 길(k)이 이미 있다. 그러면 줌으로는
               한 장도 다시 안 굽는다.
             · 시점은 **0으로 못 박는다** — 밀림은 딱딱한 모서리를 기울여 보이게 하는 몫인데
               얼룩에는 모서리가 없다(물결진 blob이다). 게다가 이 판은 잉크 한가운데로
               앉으므로(inkCenter), vq마다 잉크중심이 달라지던 몫이 사라져 **화면을 밀 때
               얼룩이 미세하게 떨리던 것도 함께** 멎는다.
             남는 열쇠는 무늬 셋 × 보기 둘 = **여섯 장**이고, 그 여섯은 경기 내내 안 바뀐다. */
          const decal9 = DECAL_KINDS.has(op.kind);
          const bop9 = decal9 ? { ...op, viewYaw: 0 } : op;
          const sideQ = decal9
            ? Math.min(DECAL_BAKE_MAX, bldBakeCap(B))
            : Math.min(sideWant, bldBakeCap(B));
          const bspr = buildingSprite(bop9, sideQ, B);
          /* 런타임 채움 보정은 없앴다(과제 #67) — 구운 판의 잉크 폭을 재서 발자국의
             95%가 되게 다시 굽던 자리다. 그 일을 이제 BLD_NORM이 모델 좌표에서 한다.
             보정이 있으면 모델을 고칠 때마다 화면 크기가 조용히 흔들리고, 16-상자를
             넘는 종류는 잘린 잉크를 재느라 오차가 겹쳤다. 판도 한 번만 굽는다. */
          /* ★ 발·가로중심 보정은 **그 판에서 직접** 잰다(지적: "코쿤이 실제 건물위치
             기준 왼쪽으로 치우침" → "반대로 해처리가 오른쪽으로 치우친건가" — 뒤쪽이
             맞았다).
             여태 종류마다 한 번만 재서 모든 판이 그 값을 나눠 썼는데, **잉크 가로중심은
             요잉 칸(vq)마다 다르다**: 계측(model-norm --json)에서 해처리의 잉크중심이
             상자 가운데에서 vq 0일 때 −1.94, vq −36일 때 −3.25로 1.3칸을 옮겨 다녔다.
             발자국의 8%, 4타일 건물이면 0.33타일이다. 한 칸에서 잰 값을 다른 칸에 쓰니
             지도 어느 쪽에 섰느냐(vq는 x가 정한다)에 따라 건물이 제 발자국에서 좌우로
             밀렸고, 그 옆의 공사 고치(잉크가 대칭이라 안 밀린다)와 어긋나 보였다.
             판마다 제 값을 쓰면 어느 칸에서도 잉크중심이 발자국 중심에 온다.
             옛 주석이 걱정한 '요잉 칸마다 달라져 흔들린다'는 건물에는 해당이 없다 —
             건물은 제자리에 서 있고 vq는 그 자리가 정하므로 값이 안 흔들린다(이사 비행
             중에만 6도 눈금으로 조금씩 바뀌는데, 그건 실제로 옮겨 가는 것이 맞다). */
          let bAnc = BLD_ANCHOR_CACHE.get(bldAnchorKey(op.kind, op.pitch));
          if (bAnc === undefined) {
            /* 잣대는 **좌우 시점 0의 판**이다 — 그 판의 잉크중심이 곧 '이 모델이 제
               16-상자 안에서 얼마나 치우쳐 그려지나'이고, 그것만이 종류의 성질이다.
               vq가 실린 판의 잉크중심에는 **시각 밀림(withViewShear)**이 섞여 있어,
               그걸 보정에 쓰면 밀림을 도로 빼 버리는 셈이 된다(건물이 지도 자리에 따라
               좌우로 밀리던 원인). 밀림은 모델이 실제로 기우는 것이므로 그대로 둬야
               하고, 발자국에 앉히는 것은 기울기 전의 중심이다.
               한 번만 재서 같은 종류가 어디에 서든 같은 보정을 받는다(옛 지적: "같은
               넥서스인데 하나만 살짝 오른쪽으로 나온다"). */
            /* 별본이면 **본판**을 잣대로 굽는다(engine9 bldAnchorKey의 ★) — 열쇠가 본판 것이므로 잣대도
               본판이어야 한다. 처음 재는 순간이 별본 쪽이면(성큰이 처음 쏠 때) 대역 판의 거친 비가 남는다. */
            const baseKind9 = BLD_NORM_PAIR[op.kind] ?? op.kind;
            const ref9 = bop9.viewYaw || baseKind9 !== op.kind
              ? buildingSprite({ ...bop9, kind: baseKind9, viewYaw: 0 }, sideQ, B) : bspr;
            if (ref9 && ref9.w > 0) {
              bAnc = [(ref9.cx / B) / ref9.l, (ref9.bot / B) / ref9.l];
              BLD_ANCHOR_CACHE.set(bldAnchorKey(op.kind, op.pitch), bAnc);
            }
          }
          /* 같은 잣대를 상자 좌표로도 남긴다(마우스 자국 등 부르는 쪽이 쓴다) — 굽기가
             상자 (8,16)을 놓는 판 위 자리는 (pad + sideQ/2, pad + sideQ)이므로, 잉크
             자리와의 차를 16/sideQ로 되돌리면 '잉크 바닥·가로중심이 상자 좌표 어디인가'가
             나온다. 이쪽은 종류마다 한 번만 — 쓰는 곳이 대략치만 필요로 한다. */
          if (bAnc && bspr && !BLD_INK_BOX.has(bldAnchorKey(op.kind, op.pitch))) {
            BLD_INK_BOX.set(bldAnchorKey(op.kind, op.pitch), [
              8 + ((bspr.cx / B) - (bspr.pad + bspr.side / 2)) * (16 / bspr.side),
              16 + ((bspr.bot / B) - (bspr.pad + bspr.side)) * (16 / bspr.side),
            ]);
          }
          /* 접지 그림자(재재지적: 해처리가 떠 있다) — 상자 바닥 어림이 아니라 구운
             판의 실제 바닥 픽셀(contentBottom)에 붙인다. 모델이 상자를 다 안 채워도
             발이 그림자에 닿는다. */
          if (op.groundShadow && showShadows !== false && CROWD9.lv === 0 && detail && !shFold9) {
            /* 바닥 '발자국'만 덮는다(정정: 칸(hPx)은 모델 높이까지 포함해, 칸 기준 타원은
               건물을 통째로 감싸는 큰 원이었다 — 내접으로 바꿔도 거의 그대로라 "적용 안
               됨"으로 보였다). 발자국 깊이 = 폭 × footRatio, 자리는 칸 바닥에 붙인다. */
            /* 2D는 바닥이 의도적으로 눌려 있다(지적) — 원작 이동 마커와 같은 2:1 지면
               관례라, 그림자 세로도 그만큼(0.55) 줄인다. 3D(pitch)는 사영이 이미 칸을
               눌러 놓아 그대로다. */
            /* 발자국보다 작게(재지적: 건물 그림자가 또 말썽 — 바닥에 맞는 크기로) —
               건물은 45도로 요잉해 세워서, 상자 폭을 그대로 쓰면 실제 닿는 바닥보다
               한참 넓은 타원이 깔린다. 발자국 폭의 0.72만 덮는다. 3D도 지면 사영을
               한 번 더 눌러(0.68) 납작하게 붙인다. */
            /* 그림자를 그린 몸에 맞춘다(지적: 건물 크기를 고치면서 그림자는 그대로라
               너무 작고, 3D에선 바닥에 안 붙고 서 있다) — 폭을 발자국의 0.72배로 못
               박아 두었더니, 채움 보정으로 몸이 커진 뒤엔 발치에 작은 점만 남았다.
               실제로 그려지는 잉크 폭의 0.88배로 잡는다.
               입체에서는 임의 축소를 걷고 바닥면 그대로 눕힌다(지적: 3D 그림자는 바닥
               팔레트에 맞아야 한다) — 세로 한 타일이 화면에서 가로 한 타일의 몇 배로
               보이는지(groundSquash)를 자리마다 실제로 재어 넘겨받는다. 그 값이 곧
               바닥면의 눌림이라, 그림자가 지면 격자와 같은 각도로 깔린다. */
            const squish = 0.55;
            const inkW9 = bspr && bspr.w > 0 ? (bspr.w / B) * (sidePx / bspr.side) : wPx;
            /* 2D는 그린 몸에만 맞춘다(지적: 평면에선 건물이 높이까지 바닥 상자 안으로
               눌려 들어가, 발자국 폭(wPx) 바닥은 그린 몸보다 늘 크다) — 발자국 하한을
               걷고 잉크 폭의 0.72만 덮는다. 입체는 종전대로 발자국 하한을 지킨다. */
            const footW = op.pitch
              ? Math.max(wPx * 0.7, inkW9 * 0.88)
              : inkW9 * 0.72;
            const fdPx = footW * (op.footRatio ?? 0.6) * squish;
            // 검정 그림자로 롤백(지적: "그림자의 개인색 적용 롤백") — 임자 색을 눌러 칠하던
            // 것을 걷고 예전 검정으로 돌아간다. 짙기는 별개 지적으로 올려 둔 값이라 유지:
            // 이제 뜬 건물만 그림자를 지므로 공중 유닛과 같은 짙기다.
            // 살짝 연하게(요청: "유닛 및 뜬 건물 그림자 살짝 연하게") — 0.5 → 0.36.
            ctx.globalAlpha = op.alpha * 0.36;
            ctx.fillStyle = "#000";
            ctx.beginPath();
            if (op.shadowPts && op.shadowPts.length >= 6) {
              /* 바닥에 실제로 그린다(요청) — 발자국 타원을 타일 공간에서 찍어 둔 점들을
                 그대로 화면으로 옮겨 잇는다. 원근이 실려 있어 멀수록 눌리고 가까울수록
                 펴지며, 지면 격자와 같은 평면에 눕는다. */
              const sp = op.shadowPts;
              ctx.moveTo(zx(sp[0]), zy(sp[1]));
              for (let q = 2; q + 1 < sp.length; q += 2) ctx.lineTo(zx(sp[q]), zy(sp[q + 1]));
              ctx.closePath();
            } else {
              ctx.ellipse(
                sx, (groundY ?? sy + hPx / 2) - fdPx / 2, footW * 0.5,
                Math.max(2, fdPx * 0.5), 0, 0, Math.PI * 2,
              );
            }
            ctx.fill();
          }
          if (bspr) {
            /* 상한에 안 걸렸고 손짓 중도 아니면 **구운 크기 그대로**다(1:1) — 위 sideQ 주석. */
            /* 크립은 굽는 크기가 못 박혀 있으므로 **늘 늘려(또는 줄여) 찍는다** — 1:1로
               찍으면 배율과 무관하게 늘 못 박은 크기로 나온다. */
            /* 판의 **실제 크기**로 잰다(bspr.side) — 굽기 예산이 다한 프레임에는 요청과
               다른 크기가 올 수 있다(buildingSpriteBake의 ★). */
            /* 고치 두근거림(op.pulseK)은 여기 블릿 배율에만 얹는다 — 아래 bLeft9·bTop9가 k로 가로 가운데·잉크
               바닥을 잡으므로, 배율이 흔들려도 발은 땅 그 자리다. 판은 안 다시 굽는다. */
            /* 사다리에 앉힌 판(입체)은 **늘 제 크기로 늘려 찍는다** — 판 크기가 요청과 최대 2.9% 다르므로
               1:1로 찍으면 건물이 사다리 칸을 따라 크기가 계단으로 튄다(위 sideWant의 ★). */
            const k = (decal9 || op.pitch || bspr.side !== sideWant || bakeZoom !== zoom
              ? sidePx / bspr.side : 1) * (op.pulseK ?? 1);
            // 겹친 것만 살짝 그림자(확대 적용: 유닛·건물 공통).
            /* 크립은 그림자를 안 진다(지적: "크립은 그림자 없어야 자연스럽게 이어지지")
               — 크립 판(clipWalk)과 건물 밑 크립 얼룩(inkCenter)은 **땅 그 자체**라
               떠 있지 않고, 이웃한 판끼리 이음매 없이 이어져야 한다. 드롭섀도가 붙으면
               판마다 테가 생겨 한 덩어리가 조각보로 갈린다. */
            /* 그림자는 아래 블릿 직전에 **구워 둔 판**으로 찍는다(shadowPlate 주석) —
               여기서는 자격만 정한다. */
            const bShadow9 = bodyShadow && !op.clipWalk && !op.inkCenter;
            ctx.globalAlpha = op.alpha;
            /* 발은 땅에(보정과 짝) — 상자 바닥에 맞추면 모델의 잉크 바닥이 상자보다
               위에 있는 만큼의 틈이 배율만큼 함께 커져 건물이 떠 보인다. 그린 픽셀의
               실제 바닥(bot)을 발자국 바닥선에 앉힌다. */
            /* 뜬 건물은 몸만 띄운다(요청: "뜬 건물에 그림자 필요") — 위 그림자는 지면선
               (groundY) 그대로 깔리므로, 여기서 몸을 올린 몫이 곧 눈에 보이는 높이다. */
            const inkBot9 = (bAnc ? bAnc[1] * bspr.l : bspr.bot / B) * k;
            /* 데칼은 잉크 한가운데를 자리에 맞춘다(지적: "2d(90도)에서 저그 크립이 아직도
               아래로 내려가있어") — 상자 높이로 맞추던 길은 보기마다 답이 달랐다: 평면
               (90도)은 바닥 눌림이 1이라 크립 얼룩의 잉크가 세로로 길어지고, 입체는 눌려
               납작해진다. 상자(hFrac)는 한 값이니 그 차이가 그대로 자리 밀림이 됐다.
               구운 판의 잉크 높이(top~bot)를 여기서 재면 보기와 무관하게 딱 가운데다. */
            /* 뜬 건물의 높이 — 제 배수(op.liftK)가 정한다. 그림자는 지면선 그대로
               깔리므로, 벌어진 몫이 곧 눈에 보이는 높이다. 보기별 축소는 없다(위
               AIR_LIFT_K 주석: 갈래를 걷었다). */
            /* 뜬 높이는 op이 실어 온 **절대 px**을 먼저 본다(위 airPx) — 그린 폭의
               배수(liftK)는 몸집이 곧 높이가 되는 옛 자라 폴백으로만 쓴다. */
            const bLiftPx9 = op.airPx !== undefined ? op.airPx * zoom : wPx * (op.liftK ?? 0);
            const bTop9 = Math.round((op.inkCenter
              ? sy + ((bspr.bot - bspr.top) / B) * k / 2 - inkBot9
              : (groundY ?? sy + hPx / 2) - bLiftPx9 - inkBot9) * B) / B;
            /* 좌우 어긋남 수리(지적: 건물이 살짝 왼쪽·오른쪽으로 어긋난다) — 상자 중심에
               맞춰 찍었는데 모델이 제 16-상자 안에서 치우쳐 그려진 것들이 있다. 발자국을
               채우려 배율을 키우면 그 치우침도 함께 커져 눈에 띈다. 그린 픽셀의 가로
               중심(cx)을 발자국 중심에 앉힌다 — 바닥(bot)을 땅에 앉힌 것과 같은 결. */
            /* ★ 가로는 **상자 한가운데**를 발자국 한가운데에 놓는다(지적: "해처리가 캔버스
             기준 살짝 오른쪽에 있네") — 여태 잉크 가로중심을 놓았다. 그런데 잉크에는
             한쪽으로 뻗은 장식이 함께 실린다: 해처리는 볏 뿔이 뒤로 크게 굽어 잉크중심이
             상자 가운데에서 1.94칸이나 왼쪽이고(계측), 그 중심을 발자국에 맞추면 **몸이
             그만큼 오른쪽으로 밀린다**. 그게 지적한 그림이다.
             모델의 몸은 이미 상자 한가운데(x 0)를 축으로 지어져 있으므로, 상자 중심을
             그대로 쓰면 어느 종류든 발자국 한가운데에 앉는다. 세로(발)는 그대로 잉크
             바닥을 쓴다 — 그건 '땅에 닿는 자리'라 장식이 아니라 실제 발이다. */
          /* 건물도 같은 자다(위 유닛 스냅 주석) — 왼위 모서리를 기기픽셀 격자에 얹는다. */
          const bLeft9 = Math.round((sx - (bspr.pad + bspr.side / 2) * k) * B) / B;
            if (bShadow9) {
              /* ★ 그림자 판도 **예산에 든다**(실기 진단: 건물 16.5/16MB — 예산을
                 넘겨 있었다) — shadowPlate는 바이트만 더하고 덜어내지는 않아, 판마다
                 매달린 그림자가 예산 위로 조용히 넘쳐 있었다. 굽고 나서 한 번 죈다. */
              const bsh9 = shadowPlate(
                bspr, Math.max(1.5, bspr.side * 0.06), 0.4, B, bldSpriteBytes,
              );
              trimBoth9();
              if (bsh9) {
                SPRITE_PERF.bldBlit += 1;
                ctx.drawImage(
                  bsh9.cv,
                  bLeft9 + (bspr.ox / B) * k - bsh9.pad * k,
                  bTop9 + (bspr.oy / B) * k - bsh9.pad * k + Math.max(1, sidePx * 0.04),
                  bsh9.w * k, bsh9.h * k,
                );
              }
            }
            if (bspr.tint) {   // 물들인 마스크를 몸판 **아래**에(unitSprite의 ★ — 건물도 같은 규약)
              const tcv9 = tintedOf9(bspr.tint, op.color, bldSpriteBytes);
              if (tcv9) {
                SPRITE_PERF.bldBlit += 1;
                ctx.drawImage(tcv9, bLeft9 + (bspr.tint.ox / B) * k, bTop9 + (bspr.tint.oy / B) * k, (tcv9.width / B) * k, (tcv9.height / B) * k);
              }
            }
            SPRITE_PERF.bldBlit += 1;
            // 자른 판을 제 자리에 되돌린다(유닛과 같은 규칙) — bLeft9·bTop9는 자르기
            // 전 판의 왼위 모서리다.
            ctx.drawImage(
              bspr.cv,
              bLeft9 + (bspr.ox / B) * k, bTop9 + (bspr.oy / B) * k,
              (bspr.cv.width / B) * k, (bspr.cv.height / B) * k,
            );
            /* ★ 겹쳐 찍는 판(op.attach) — 성큰의 혓바닥이다(유닛 쪽 짐과 같은 규약).
               **같은 자**로 굽는다: 같은 판 크기(sideQ)·같은 배수(NORM_PAIR가 몸 것으로
               접는다)라, 몸과 똑같은 자리·배율에 제 잉크 오프셋(ox·oy)만 달리 주면
               혀가 제 모형 좌표(아가리)에 앉는다.
               차례는 늘 몸 **뒤**다 — 합본에서도 혀는 tagKey 13으로 몸의 지붕(12)보다
               위였으므로, 나중에 찍는 것이 그 그림 그대로다. */
            if (op.attach) {
              const atB9 = buildingSprite({ ...bop9, kind: op.attach }, sideQ, B);
              if (atB9) {
                /* 자리는 **16-상자를 겹쳐** 잡는다 — 몸 판의 상자가 화면에서 차지한
                   네모(왼위 + 크기)를 구한 뒤, 혀 판의 상자를 거기에 포갠다. 예산이
                   다한 프레임에는 대역 판이 와서 두 판의 side가 다를 수 있으므로
                   (buildingSpriteBake의 ★), 혀의 배율은 제 side로 따로 낸다. */
                const boxL9 = bLeft9 + bspr.pad * k;
                const boxT9 = bTop9 + bspr.pad * k;
                const kA9 = (bspr.side * k) / atB9.side;
                SPRITE_PERF.bldBlit += 1;
                ctx.drawImage(
                  atB9.cv,
                  boxL9 - atB9.pad * kA9 + (atB9.ox / B) * kA9,
                  boxT9 - atB9.pad * kA9 + (atB9.oy / B) * kA9,
                  (atB9.cv.width / B) * kA9, (atB9.cv.height / B) * kA9,
                );
              }
            }
            /* 건물 체력바(요청) — 다친 건물 위에만. 유닛 바와 같은 3색. */
            if (showHp !== false && zoom >= DEEP_MIN_ZOOM && op.hpFrac !== undefined && op.hpFrac > 0
              && (op.hpShow || (pickedKey != null && op.pickKey === pickedKey))) {   // 맞은 지 잠깐·선택된 개체만(요청)
              /* 원작 폭(요청: 절대값에 비례 — 옛 잉크 폭·발자국 폭 자는 걷었다) — 엔진이 실어 온 게임 px 폭을 화면 px로
                 (지도 폭 분수 × 지도 화면 폭). 두께는 원작 5게임px과 우리 최소 두께 중 큰 쪽. */
              // 그리기 루프 안이라 return을 쓰지 않는다 — 폭이 없는 op(없어야 한다)는 최소 폭으로.
              const bw3 = Math.max(3, (op.hpBarFrac ?? 0) * cw * zoom);
              const bh3 = Math.max(hpBarH9(zoom), 5 * (bw3 / (op.hpBarW ?? 19)));
              const bx3 = sx - bw3 / 2;
              /* 바는 **몸 아래**다(요청: 원작처럼 모델 아래쪽) — 그려진 픽셀의 바닥선
                 (bspr.bot) 바로 밑이다. 건물은 발자국 아랫변이 곧 땅에 닿는 줄이라,
                 그 아래에 놓으면 원작의 발치 바와 같은 자리가 된다. */
              const byTop = bTop9 + (bspr.bot / B) * k + 2 + wPx * 0.03;   // 살짝 아래로(지적)
              ctx.globalAlpha = op.alpha * 0.9;
              ctx.fillStyle = "rgba(10, 14, 10, 0.75)";
              ctx.fillRect(bx3 - 0.5, byTop - 0.5, bw3 + 1, bh3 + 1);
              drawHpBar(ctx, op, bx3, byTop, bw3, bh3);
            }
            continue;
          }
          const { faces } = resolveShapeFaces(op.kind, op.rotDeg, op.flat, op.viewYaw, op.pitch);
          if (faces) {
            const s = (op.fitWidth ? wPx : Math.min(wPx, hPx)) / 16;
            // 모델 면으로 그리는 길 — save 스택 대신 setTransform 합성(모델 (8,16) 앵커).
            const ty9 = (groundY ?? sy + hPx / 2)
              - (op.airPx !== undefined ? op.airPx * zoom : wPx * (op.liftK ?? 0));
            ctx.setTransform(Bd * s, 0, 0, Bd * s, Bd * (sx - 8 * s), Bd * (ty9 - 16 * s));
            for (const [d, o, fill] of faces) {
              ctx.globalAlpha = op.alpha * shadeBoost(o, fill);
              ctx.fillStyle = fill ?? op.color;
              ctx.fill(pathOf(d));
            }
            ctx.setTransform(Bd, 0, 0, Bd, 0, 0);
          }
          continue;
        }
        const { faces, rot } = resolveShapeFaces(op.kind, op.rotDeg, op.flat, op.viewYaw, op.pitch);
        if (!faces) continue;
        /* 화면 크기는 크기표가 정한다(요청: 모델 정규화 + 원작 치수 크기표) — 옛 '상자
           채움 보정'은 걷었다. 모델이 상자를 채우는 몫은 이제 굽는 쪽(MODEL_NORM)에서
           종류마다 같게 맞춰지고, 남은 몫(MODEL_INK)은 크기표가 미리 나눠 놓았다.
           여기서 잉크 폭을 되재서 되키울 까닭이 없다 — 판을 두 번 굽던 것도 사라진다. */
        const px = op.sizePx * zoom;
        /* 이 종류가 상자에서 잉크로 쓰는 몫(0~1) — 그림자·링·체력바·LOD가 상자가 아니라
           몸을 자로 삼게 하는 열쇠다. 판이 없을 때의 폴백에만 쓴다. */
        const inkK = modelInkOf(op.kind) / 16;
        /* 공중 유닛(요청: 높이 더 높이 + 바닥 그림자) — 발밑 자리에 그림자 타원을 깔고
           몸은 반 키만큼 위로 띄운다. 떠 있음이 땅 유닛과 한눈에 갈린다. */
        // 높이 반으로(재재지적) — 1.6 → 0.8.
        /* 평면(90도)에서는 40%만 띄운다(요청: "90도에서만 2d 특화로 공중유닛 높이 40프로로
           축소") — 입체에서는 몸이 위로 뜬 만큼이 곧 '높이'로 읽히지만, 바로 위에서
           내려다보는 90도에서는 높이가 화면에 남을 자리가 없다. 그래서 같은 몫을 띄우면
           '높이 나는 것'이 아니라 '북쪽으로 밀린 것'으로 보인다 — 그림자만 제자리에 남아
           몸과 벌어진다. 원작 2D도 공중 유닛을 조금만 띄운다. */
        /* 공중 높이는 **op이 실어 온다**(위 airPx) — 여기서 제 몸으로 다시 재면
           몸집이 곧 높이가 된다(그 지적). 옛 식은 폴백으로만 남긴다: airPx를 안 실은
           op(옛 자리·시험용)이 땅에 붙어 버리는 것보다 낫다. */
        const lift = (op.air ? (op.airPx !== undefined ? op.airPx * zoom : px * AIR_LIFT_K) : 0)
          + (op.rise ?? 0) * px;
        /* 판을 먼저 굽는다 — 그림자를 어림 오프셋이 아니라 판의 실제 바닥 픽셀
           (contentBottom)에 붙이기 위해서다(재재지적: 드론이 높이 떠 있다). */
        /* 상한을 넘겨야 하면 상한 크기로 굽고 아래 kU가 늘려 찍는다(위 unitBakeCap 주석).
           굽는 크기는 bakeZoom이 정한다 — 손짓 중에는 손짓 시작 배율에 못 박혀, 핀치
           한 번에 종류마다 수십 벌을 다시 굽지 않는다. 남는 배율 차이는 kU가 진다. */
        /* ★ 판 크기를 **기기픽셀 격자**에 맞춘다(지적: "맵은 선명하고 모델들만 블러야")
           ─────────────────────────────────────────────────────────────────────────
           지도에서 잡은 것과 **같은 병**이다. 여기 있던 `round(x/2)*2`는 판을 짝수
           CSS px로 죄는데, 화면에 찍는 크기(px)는 그 짝수가 아니다. 그러면 블릿 배율
           kU가 1이 아니게 되고, 1에 가까우면서 정수가 아닌 배율은 재표본의 최악이라
           모델이 고르게 뭉갠다. 실측(dpr 3·배율 4):
               일반(상자 393)  마린 화면 23.33 · 판 24 → 배율 0.9723
               전체화면(695)   마린 화면 41.27 · 판 42 → 배율 0.9825
           둘 다 1이 아니고, **작은 쪽(일반 배치)이 늘 더 나쁘다** — 반올림 오차가
           크기에 반비례하기 때문이다. "일반에서만 모델이 블러"의 정체가 이것이다.
           격자에 맞춘다: 판을 기기픽셀 정수로 굽고, 찍는 크기도 그 값으로 쓴다(kU=1).
           크기가 최대 0.5 기기픽셀(dpr 3에서 0.17 CSS px) 달라지는데 그건 눈에 안 든다.
           상한(unitBakeCap)에 걸릴 때만 kU가 1을 넘는다 — 그때는 늘려 찍는 것이 옳다. */
        /* 짝수 기기픽셀로 죈다 — 아래 블릿이 판의 **한가운데**(pxq/2)를 기준으로 삼으니
           홀수면 거기서 반 픽셀이 생겨, 애써 맞춘 격자가 도로 어긋난다. */
        const pxqWant = Math.max(4, (Math.round((op.sizePx * bakeZoom * B) / 2) * 2) / B);
        const pxq = Math.min(pxqWant, unitBakeCap(B));
        const spr = unitSprite(op, pxq, B);
        /* ★ **판의 실제 크기**를 되읽는다 — 굽기 예산이 다한 프레임에는 요청과 다른
           크기가 올 수 있다(unitSprite의 ★). 판은 `l = pxq + 2·pad`로 지어졌으므로
           거꾸로 풀면 그 크기다. 자리·그림자·블릿이 전부 이 값을 써야 대타가 제자리에
           제 크기로 찍힌다. */
        const pxqB = spr ? spr.l - 2 * spr.pad : pxq;
        /* 상한에 안 걸렸으면 **구운 크기 그대로** 찍는다(1:1). 걸렸으면 그만큼 늘린다. */
        const kU = pxqB === pxqWant && bakeZoom === zoom ? 1 : px / pxqB;
        /* 몸의 실제 폭(화면 px) — contentBox가 이미 재 둔 값이라 공짜다(지적: 체력바가
           몸을 덮는다 / 그림자가 몸만큼 크다 / 링이 몸보다 크다). 정규화가 맞추는 것은
           잉크 **상자**이고 폭 몫은 가로세로비 때문에 종류마다 1.7배까지 남는다 —
           모델들의 세로/가로 비가 실제로 그만큼 다르기 때문이라 정규화로는 못 없앤다.
           그러니 장식이 상자(px)가 아니라 이 몸 폭(inkW)을 봐야 한다. 그러면 "바는 제
           유닛보다 넓지 않다" 같은 조건이 종류를 안 가리고 식만으로 보장된다. */
        /** 이 종류·방위·보기의 장식용 몸 폭 비 — 자세 0에서 잰 값 하나를 모든 컷이 쓴다. */
        /* 짐을 든 일꾼은 **맨몸과 같은 자**를 쓴다(NORM_PAIR) — 아니면 밭을 오갈 때마다
           짐만큼 그림자가 넓어졌다 좁아진다(그 집합의 옛 주석이 말한 그 깜빡임이다). */
        const inkKey9 = `${NORM_PAIR[op.kind] ?? op.kind}|${op.flat ? 1 : 0}|${pitchTag(op.pitch)}`;
        const inkB9 = ((Math.round((op.rotDeg ?? 0) / 22.5) % 16) + 16) % 16;
        const inkR9 = spr && spr.w > 0 && pxqB > 0 ? (spr.w / B) / pxqB : 0;
        const inkW = ((): number => {
          const pose9 = op.pose ?? 0;
          let got9 = INK_W_RATIO9.get(inkKey9);
          if (inkR9 > 0 && (!got9 || pose9 < got9.pose)) {
            if (INK_W_RATIO9.size > 1024) INK_W_RATIO9.clear();
            got9 = { pose: pose9, by: new Map(), r: 0 };
            INK_W_RATIO9.set(inkKey9, got9);
          }
          if (inkR9 > 0 && got9 && pose9 === got9.pose && !got9.by.has(inkB9)) {
            got9.by.set(inkB9, inkR9);
            let sum9 = 0;
            got9.by.forEach((v9) => { sum9 += v9; });
            got9.r = sum9 / got9.by.size;
          }
          const r9 = got9 && got9.r > 0 ? got9.r : inkR9;
          return r9 > 0 ? r9 * px : px * inkK;
        })();
        const footY = spr
          ? sy - px * 0.24 - (spr.pad + pxqB / 2) * kU + (spr.bot / B) * kU - 1
          : sy + px * 0.28;
        /* 내용물 가로 중심(재지적: 그림자·링이 몸과 안 맞음) — 상자 중심이 아니라 실제
           그려진 픽셀의 가운데에 붙인다. */
        const footX = spr
          ? sx - (spr.pad + pxqB / 2) * kU + (spr.cx / B) * kU
          : sx;
        /* ★ 그림자는 **모델의 땅 원점**에 놓는다(지적: "디파일러 그림자 위치가 몸이랑 안맞음(너무 아래)",
           "시즈탱크도 그랬고", "그림자 위치가 안맞는 유닛이 있는 이유가 이해가 안돼") ─────────────
           여태 그림자 타원의 세로 자리는 footY = **판의 가장 아래 잉크 픽셀**이었다. 그 자는 다리 달린
           몸(발끝이 가장 아래)에는 맞지만, 굽기는 땅 원점(0,0,0)을 상자 (8, 12)(입체 12.6)에 놓고
           바닥면을 앞뒤(y)로 펼치므로, 가장 아래 픽셀은 발이 아니라 **바닥면의 뒤쪽 가장자리**다 —
           궤도가 바닥까지 꽉 찬 탱크는 뒤 궤도 끝, 꼬리가 뒤로 긴 디파일러는 꼬리 끝이다. 그래서 몸이
           앞뒤로 길수록 그림자가 몸 뒤로 밀렸고, 탱크에만 손값(SHADOW_UP_K9)을 대고 있었다.
           땅 원점의 화면 자리는 잉크와 무관하게 셈이 된다: 판 상자 가운데(sy − 0.24·px)에서 원점 줄
           (12 또는 12.6)까지 (줄 − 8)/16·px, 여기에 종류 배수(modelNormOf, 상자 가운데 축)를 곱한다.
           가로도 잉크 중심이 아니라 원점(sx)이다 — 포신이 한쪽으로 뻗어도 그림자는 차체 밑이다. */
        /* 배수는 이제 땅 원점을 축으로 걸리므로(unitSprite의 noy9) 원점 줄은 배수와 무관하다 — 상자 가운데에서
           (줄 − 8)/16·px 그대로. */
        const groundOy9 = sy - px * 0.24 + (((op.flat ? 12 : 12.6) - 8) / 16) * px;
        /* ★ 덜어내기 중에도 **공중 유닛 그림자는 남긴다**(요청: "떠있는 위치가 안 읽혀서") — 타원 하나라 값이
           거의 없고, 그림자가 없으면 나는 몸의 높이·자리를 읽을 길이 없다. 부양 지상 유닛 그림자만 덜어낸다. */
        if (hover && !op.noShadow && showShadows !== false && (CROWD9.lv === 0 || op.air) && detail && !shFold9) {
          /* 떠다니는 지상 유닛(일꾼·벌처·아콘류)은 겨우 발밑만 떠 있다(지적: 그림자가
             너무 크고 진해) — 높이 나는 공중 유닛보다 작고 옅은 타원. */
          // 그림자 살짝 축소(지적) — 높이 나는 만큼 발밑 그림자는 작고 옅게.
          /* 몸 폭 기준(지적: 그림자가 유닛 크기를 반영 못 한다 / 옵저버·스커지 그림자가
             몸의 세 배다) — 지름이 몸 폭의 0.97배(공중)·0.70배(부양)로 종류를 안 가린다.
             예전 상자 기준으로는 같은 식이 옵저버 1.99배 ~ 다크아콘 0.49배로 4배 벌어졌다. */
          const shw = inkW * (op.air ? 0.44 : 0.32);
          /* (걷어냄) htemp 전용 그림자 당김(shUp) — 요청: "높이는 몸 중심이 아닌
             발밑 기준으로 다 맞추고". 이 손보정이 있던 까닭은 하이템플러 판에 발밑
             흰 빛 타원이 잉크로 들어 있어 판 바닥선이 로브 밑단이 아니라 상자 맨
             아래였기 때문이다(그 타원은 걷었다 — htemp 빌더 주석). 이제 어느 부양
             유닛이든 그림자는 **제 판의 실제 바닥 픽셀**(footY)에 붙는다 — 종류마다
             다른 자를 쓰지 않는다. */
          // 짙기 상향(지적: 그림자가 너무 흐려 안 보인다) — 0.26/0.16 → 0.5/0.34.
          // 색은 검정으로 롤백(지적: "그림자의 개인색 적용 롤백").
          // 다시 한 단 연하게(요청: "유닛 및 뜬 건물 그림자 살짝 연하게") — 0.5/0.34 → 0.36/0.25.
          ctx.globalAlpha = op.alpha * (op.air ? 0.36 : 0.25);
          ctx.fillStyle = "#000";
          /* beginPath 필수(조사: 전 모드 거대 검은 쐐기의 진범) — 경로를 안 비우면
             ellipse가 직전 점에서 타원까지 선분을 이어 붙이며 프레임 내내 누적되고,
             fill이 맵을 가로지르는 검은 다각형들을 채웠다. 요잉과 무관했다. */
          ctx.beginPath();
          /* 발끝에 딱(재재지적: 그림자 각도·위치 — 발에 붙어야 하고 부양 유닛도 훨~씬
             낮게) — 그림자를 스프라이트 바닥선(0.28px)에 놓아 몸과 틈이 없다. 공중
             유닛만 몸이 위로 들려 그 틈이 곧 비행 높이로 읽힌다. */
          /* 바닥과 평행하게(재지적: 그림자 각도가 바닥과 평행이 아니다) — 입체 보기의
             바닥은 눌려 있는데 타원이 덜 납작해 비스듬히 선 판처럼 읽혔다. 입체에선
             세로 반지름을 바닥 기울기만큼 더 누른다. */
          /* 바닥면 전체(재지적: 그림자가 캔버스를 못 채우고 앞쪽만 납작하게) — 가장
             앞 픽셀(footY)에 붙이면 앞모서리 조각만 보인다. 타원을 키우고 중심을
             위로 당겨 몸 아래 발자국을 덮는다. */
          /* 그림자는 땅에(지적: 오버로드 위치는 해처리 위인데 그림자가 훨씬 아래) — 몸은
             lift만큼 '위로' 들리고 땅은 제자리(footY)인데, 여기에 lift를 '더해' 그림자가
             비행 높이만큼 남쪽으로 밀려 있었다. 발밑 땅 자리 그대로 둔다. */
          /* 바닥과 같은 평면에(지적: 그림자가 안 눕는다 → 재지적: "3D에서 그림자 눌림
             현상") — 0.38은 실제 바닥이 0.523으로 눌려 있던 시절에 거기서 한 번 더
             눌러 맞춘 손값이었다. 바닥을 PITCH_FLAT(0.74)으로 바로잡은 뒤에는 그림자만
             바닥의 절반 두께로 남아, 이번엔 반대로 짓눌려 보였다. 바닥 눌림 그대로
             쓴다 — 손값이 아니라 지면과 같은 수다. */
          /* ★ 세로 자리는 **구운 판의 발끝**(footY)이고, 거기서 더 빼지 않는다(지적 둘을
             한 자리에서 맞춘 값) ────────────────────────────────────────────────────
             ① "유닛 그림자가 제 위치보다 위에 표시됨" — 그때 범인은 footY가 아니라 거기서
                또 빼던 `shw × 0.22`였다. 그 몫만 걷는다.
             ② "마린 등 일부 유닛 그림자 위치가 안맞아 … 지도의 위쪽에 나온다" — ①을 고치며
                자리를 앵커(sy)로 옮겼던 것이 이번엔 반대로 넘쳤다. 실측: 판이 상자를 꽉
                채우는 모델에서 footY ≈ sy + 0.26 × px라, sy로 옮기면 마린 기준 5px쯤
                **위로** 올라간다. 그게 이 지적이다.
                sy는 자취의 앵커일 뿐 '발이 닿는 화면 줄'이 아니다 — 몸 판은 그 앵커에서
                −0.24 × px 옮겨 그려지고(아래 by9), 발끝은 판 안의 잉크가 정한다. 그러니
                땅 줄은 footY가 맞다. 지면선(groundY)이 실려 온 것(건물·자원)만 그 값을 쓴다.
             가로는 footX 그대로다(앞선 지적: 그림자·링이 몸과 안 맞음). */
          ctx.ellipse(sx, groundY ?? groundOy9, shw * 1.1, shw * (op.air ? 0.5 : 0.42) * (op.pitch ? pitchFlatNow : 1), 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (showShadows !== false && CROWD9.lv === 0 && detail && !shFold9 && !op.air && !op.clipWalk && !op.noShadow) {
          /* ★ noShadow도 여기서 본다(지적: "버로우 럴커·마인은 그림자 안 그려야 자연스럽" · "다른 저그 버로우도")
             — 위 부양 갈래만 그 깃발을 보고, 땅에 선 몸의 작은 그림자는 안 봤다. 마인은 op에 noShadow가
             이미 실려 있었는데도 그림자가 났던 까닭이다. 버로우한 몸은 엔진이 같은 깃발을 싣는다. */
          /* 지상 유닛 접지 그림자(재지적: 전부 떠 있는 느낌 — 발이 그림자에 닿아야 하고
             훨씬 작아야) — 발끝 자리에 딱 붙는 아주 작은 타원.
             ★ 조건에서 UNIT_KIND_SET을 걷었다(지적: 같은 배율에서도 어떤 건 그림자가
               있고 어떤 건 없다) — 그 집합은 **도록의 '유닛' 갈래**라, 거기 안 든 채
               땅에 서는 것들(스파이더 마인·알·라바·고치·버로우 자국 …)만 그림자가
               통째로 빠져 있었다. 도록에 실렸나는 그리기가 알 일이 아니다: 건물·자원은
               위 상자 갈래에서 이미 갈라져 나갔고, 크립 판만 빼면 여기 남는 것은 전부
               '땅에 선 몸'이다. */
          // 짙기 상향(지적) — 0.15 → 0.32. 색만 검정으로 롤백(지적: "그림자의 개인색 적용 롤백").
          // 다시 한 단 연하게(요청: "유닛 및 뜬 건물 그림자 살짝 연하게") — 0.32 → 0.23.
          ctx.globalAlpha = op.alpha * 0.23;
          ctx.fillStyle = "#000";
          ctx.beginPath();
          /* 그림자는 몸 폭(inkW)으로 잰다(지적: "그림자 크기가 유닛 크기 반영 못한 듯 —
             프로브 질럿 드라군이 다 비슷"). 예전엔 채움 보정이 잉크가 적은 모델만 1.55배
             까지 부풀려 보정 뒤 크기가 서로 가까워졌고, 그래서 보정 전 크기(px0)를 따로
             들고 있어야 했다. 보정이 없어진 지금 상자(px)는 종류마다 몸을 담는 여유가
             달라(잉크 몫 0.26~0.33) 다시 같은 흠이 난다 — 몸 폭이 유일하게 옳은 자다.
             지름은 몸 폭의 0.84배로 모든 종류에서 몸 안에 들어온다. */
          const shR = inkW * 0.42;
          // 세로 자리는 판의 발끝(위 hover 갈래와 같은 지적 둘) — 옛 `− px × 0.09`만 걷는다.
          /* ★ 상자꼴 차량은 그림자 중심을 위로 당긴다(지적: "탱크의 유닛 그림자가 너무 아래쪽") — 타원 중심을 판의 잉크
             바닥(footY)에 두는 자는 다리 달린 몸(발끝 아래로 몸이 없다)에 맞춘 것이라, 궤도가 바닥까지 꽉 찬 탱크는 타원
             절반이 몸 아래로 빠져나와 떠 있는 것처럼 읽혔다(12배에서 뚜렷). 세로 반지름의 몫만큼 올려 몸 밑에 깔리게 한다. */
          const ry9 = shR * 0.58 * (op.pitch ? pitchFlatNow : 1);
          // (걷어냄) SHADOW_UP_K9 — 탱크 손값. 땅 원점(groundOy9)에 두면 손값이 필요 없다(위 주석).
          ctx.ellipse(sx, groundY ?? groundOy9, shR, ry9, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        /* 선택 링(지적: 드래그 선택 구분) — 잡힌 유닛 발밑의 가는 타원 테.
           색은 임자 색이다(요청: 흰색 말고 개인색) — 누가 잡은 유닛인지 링만 보고 안다.
           공중 유닛은 링도 공중이다(지적: 유닛 바닥에) — 들린 몸의 바닥선에 붙인다. */
        if (op.selRing) {
          /* 선 굵기는 화면 고정(지적: 링은 UI 요소 — 확대에 굵어지면 안 됨) — 반지름은
             유닛(px)을 따라가되 굵기에서 zoom을 뺀다. */
          /* ★ 굵기를 되돌린다(지적: "유닛 선택링이 안나와") — 두 번의 "더 가늘게"가
             0.7 → 0.45 → 0.32px까지 내려왔는데, 그 값은 **화면 화소 아래**다. 실측:
             마린의 sizePx는 20 남짓이고 잉크 몫 0.325를 곱한 뒤 0.034를 걸면 0.22라
             늘 하한(0.32)에 걸린다. dpr 1 화면에서 0.32px 선은 3분의 1만 칠해지는
             회색 자국이라, 0.35초 동안 스치고 지나가면 안 보이는 것과 같다.
             1.1px을 바닥으로 잡는다 — 여전히 한 획짜리 가는 테지만 화소 하나는 채운다.
             배수도 0.034 → 0.06으로 올려 큰 몸에서는 조금 더 또렷하다. */
          const ringW = Math.max(1.1, op.sizePx * inkK * 0.06);
          // 링도 내용물 발끝에(재지적) — 상자 고정 오프셋은 작은 모델에서 몸 아래로 떨어졌다.
          const ringY = op.air ? footY - lift : footY - px * 0.03;
          const ringPath = (): void => {
            ctx.beginPath();
            /* 링은 몸 폭의 1.1배 — 발 언저리에 살짝 걸친다(지적: 링이 몸보다 크다).
               상자 기준이던 예전엔 종류에 따라 0.64~2.61배로 벌어졌다. */
            /* 입체에서는 좌우 시점 밀림도 먹인다(요청: 선택 링·마커도 사영 밀림) — 바닥 깊이에 tan(시점각)을
               곱해 x를 미는 것을 캔버스 변환(가로 밀림)으로 얹는다. 변환은 경로를 만드는 동안만 걸고 되돌린다. */
            ctx.save();
            ctx.translate(footX, ringY);
            if (op.pitch && op.viewYaw) ctx.transform(1, 0, Math.tan((op.viewYaw * Math.PI) / 180), 1, 0, 0);
            ctx.ellipse(0, 0, inkW * 0.55, inkW * 0.31 * (op.pitch ? pitchFlatNow : 1), 0, 0, Math.PI * 2);
            ctx.restore();
          };
          /* 검은 테는 걷었다(지적: 깔려면 마우스 마커에도 깔아야 한다) — 링만 두 겹이라
             둘이 따로 놀았다. 임자 색 실선 한 겹으로 통일한다. */
          ctx.globalAlpha = op.alpha * 0.95;
          ctx.strokeStyle = op.color;
          ctx.lineWidth = ringW;
          ringPath();
          ctx.stroke();
        }
        /* 상태 오라(전수조사) — 걸린 유닛 밑에 그 기술의 색빛.
           ★ 자를 **보이는 몸**으로 바로잡았다(요청) — 여기 있던 것은 모델 상자(px)의
             1.1배(rx = px × 0.55)라, 상자가 몸의 세 배 남짓인 만큼 발밑에 몸의 **세 배가
             넘는 원반**이 깔렸다. 스태시스의 하늘색 원반이 그것이었고(위 CAGED_STATUS
             주석), 같은 자를 쓰는 플레이그·인스네어·이레디에이트·마엘스트롬도 마찬가지로
             컸다. 이 파일이 여러 번 되풀이한 착오다 — 상자는 몸이 아니다.
             자리와 비율은 **선택 링과 같은 것**을 쓴다(바로 위 ringPath): 자는 구운 판의
             실제 몸 폭(inkW)이고, 눕는 몫도 그쪽과 한 값이라 둘이 따로 놀지 않는다.
             링(0.55)보다 조금만 크게(0.62) — 링을 삼키지 않으면서 발밑에 깔린다. */
        if (op.tint) {
          ctx.globalAlpha = op.alpha * 0.32;
          ctx.fillStyle = op.tint;
          ctx.beginPath();
          const auraR9 = inkW * 0.62;
          ctx.ellipse(
            footX, op.air ? footY - lift : footY - px * 0.03,
            auraR9, auraR9 * 0.564 * (op.pitch ? pitchFlatNow : 1), 0, 0, Math.PI * 2,
          );
          ctx.fill();
        }
        /* 체력바(요청: 체력을 지니고 다니는 생애주기) — 다친 유닛 머리 위에 원작풍
           바: 초록(>66%)·노랑(>33%)·빨강. 성한 유닛에는 안 띄워 화면을 아낀다. */
        if (showHp !== false && zoom >= DEEP_MIN_ZOOM && op.hpFrac !== undefined && op.hpFrac > 0
              && (op.hpShow || (pickedKey != null && op.pickKey === pickedKey))) {   // 맞은 지 잠깐·선택된 개체만(요청)
          // 원작 폭(요청) — 건물 쪽(bw3)과 같은 자. 옛 잉크 폭·체력 보정 자는 걷었다.
          const bw2 = Math.max(3, (op.hpBarFrac ?? 0) * cw * zoom);
          const bh2 = Math.max(hpBarH9(zoom), 5 * (bw2 / (op.hpBarW ?? 19)));
          const bx2 = sx - bw2 / 2;
          /* ★ 바는 **몸 아래**다(요청: "유닛 건물 체력바를 원작처럼 모델 아래쪽으로
             이동") — 원작의 체력바는 발밑에 깔린다. 여태 머리 위였는데, 그러면 뒤에
             선 유닛의 바가 앞 유닛의 머리와 겹쳐 난전에서 막대밭으로 읽혔다.
             자리는 **그려진 몸의 밑단**이다. footY는 그림자가 앉는 땅 줄이라, 공중
             유닛에서는 몸이 아니라 그림자 곁에 눕는다(지적: "공중유닛 체력바는 모델
             아래로") — 몸은 lift만큼 떠 있으므로 그만큼 함께 올려야 발치에 붙는다.
             지상 유닛은 lift가 0이라 예전과 같은 자리다. */
          const by2 = footY - lift + Math.max(2, px * 0.11);   // 살짝 아래로(지적)
          ctx.globalAlpha = op.alpha * 0.9;
          ctx.fillStyle = "rgba(10, 14, 10, 0.75)";
          ctx.fillRect(bx2 - 0.5, by2 - 0.5, bw2 + 1, bh2 + 1);
          drawHpBar(ctx, op, bx2, by2, bw2, bh2);
        }
        /* 스프라이트로 찍는다(수리: 프레임 뚝뚝) — 면 낱장 fill 대신 구운 판 한 장.
           크기는 2px 칸으로 양자화해 캐시를 맞추고, 블릿에서 잔차 배율을 입힌다. */
        /* 몸의 변환 — save 스택 대신 setTransform 합성: 기본(B 배율)에 이동·회전을
           한 행렬로 접어 넣고, 끝나면 기본으로 되돌린다. 회전 없는 대다수 유닛은
           cos/sin도 안 든다. */
        const bx9 = sx;
        const by9 = sy - px * 0.24 - lift;
        if (rot) {
          const rr9 = (rot * Math.PI) / 180;
          const rc9 = Math.cos(rr9);
          const rs9 = Math.sin(rr9);
          ctx.setTransform(Bd * rc9, Bd * rs9, -Bd * rs9, Bd * rc9, Bd * bx9, Bd * by9);
        } else {
          /* ★ 자리를 **기기픽셀 정수로** 스냅한다(지적: "모델은 전체화면만 선명") ──────
             판 크기를 격자에 맞춰도 **찍는 자리가 반 픽셀 어긋나면** 캔버스가 스프라이트를
             통째로 다시 표본한다 — 크기를 맞춘 것과 똑같은 이유로 고르게 뭉갠다.
             일반 배치에서만 티가 나던 까닭은 크기 반올림 때와 같다: 모델이 작을수록
             같은 반 픽셀이 차지하는 몫이 크다(전체화면은 상자가 1.77배라 절반이 된다).
             0.5 기기픽셀(dpr 3에서 0.17 CSS px)씩 자리가 튀는데, 그 눈금은 눈에 안 든다.
             ※ 돌아가는 몸(위 갈래)은 회전 자체가 표본을 다시 뜨므로 스냅해도 소용없다 —
               거기는 안 건드린다. */
          /* ★ 낮은 배율에서는 스냅하지 않는다(지적: "줌배율이 낮을수록 유닛 이동 움직임이 부드럽지 않음") — 지도
             전체를 보는 배율에서는 유닛의 한 걸음이 프레임당 1 기기픽셀에 못 미쳐(1배·타일 6px·초당 1.5타일이면
             30장에 0.3px), 정수로 죄면 몇 장에 한 번씩 한 픽셀을 툭툭 뛴다. 그 배율의 몸은 예닐곱 픽셀이라
             재표본의 흐림은 눈에 안 들고, 걸음이 끊기는 것만 보인다. 자세함 문턱(detailAt) 위에서만 스냅한다. */
          if (detail) ctx.setTransform(Bd, 0, 0, Bd, Math.round(Bd * bx9), Math.round(Bd * by9));
          else ctx.setTransform(Bd, 0, 0, Bd, Bd * bx9, Bd * by9);
        }
        if (spr) {
          /* ★ 블릿 배율은 **자리를 잡을 때 쓴 그 배율**(kU)이다(지적: "dpr 1에서 지도상
             이미지들이 흐린 듯 보인다") ─────────────────────────────────────────────
             여기 있던 것은 `px / pxq` — 따로 셈한 제2의 배율이었다. 그런데 바로 위에서
             판 크기를 **기기픽셀 격자에 맞춰** 구워 두었고(pxqWant의 ★ 주석) 앵커(footX·
             footY·inkW)는 그 뜻대로 kU를 쓰고 있었다: 상한에 안 걸렸으면 kU가 정확히
             1이라 '구운 그대로 1:1로 찍는다'가 그 약속이다. 그림만 그 약속 밖에 있었다.
             `px / pxq`는 그 격자 맞춤이 남긴 **잔차**다. 곧 1에 가깝지만 정수가 아닌
             배율이고, 그것이 재표본의 최악이라는 것은 바로 위 주석이 이미 적어 두었다.
             왜 dpr 1에서만 도드라지나 — 격자 눈금이 **짝수 기기픽셀**이라, 그 눈금이
             CSS px으로 얼마인지가 dpr에 반비례한다. dpr 3이면 2/3 CSS px이라 잔차가
             1.000 언저리지만, dpr 1이면 눈금이 통째로 2 CSS px이다. 실측(모델 상자
             23.33px): dpr 3에서 판 23.33 → 배율 1.0000이고, dpr 1에서는 판 24 →
             배율 0.9721이다. 그 4%가 모든 몸을 고르게 뭉갠 정체다.
             kU를 쓰면 상한에 안 걸린 흔한 자리에서 배율이 정확히 1이 된다: 판 폭도
             찍는 폭도 같은 정수 기기픽셀이고, 자리도 이미 정수로 스냅해 두었으므로
             (위 setTransform의 Math.round) 화소가 화소에 그대로 얹힌다.
             ★ 크기는 최대 1 기기픽셀 달라진다 — 위 격자 맞춤이 이미 받아들인 값이고
               (그 주석의 "그건 눈에 안 든다"), 뭉갠 그림보다 낫다. 상한에 걸렸거나
               손짓 중이면 kU가 곧 px/pxq라 예전과 똑같이 늘려 찍는다. */
          const k = kU;
          /* 그림자는 **판에 구워 둔 것**을 몸보다 먼저 한 번 찍는다(shadowPlate 주석) —
             여기서 흐림을 돌리지 않는다. 자리는 몸과 같고 번짐 여백(pad)만큼 벌린 뒤
             아래로 조금 내린다. 그 '조금'은 값 하나라 삯이 없다. */
          /* 낮은 배율에서는 지상만 뺀다(위 SHADOW_GROUND_MIN_ZOOM의 ★). */
          if (bodyShadow && (op.air || zoom >= SHADOW_GROUND_MIN_ZOOM)) {
            /* ★ **공중은 더 멀리·더 짙게**(지적: "공중유닛 겹침시 그림자 나와야하는데
               뮤탈모여있는데 안생김") ────────────────────────────────────────────────
               이 그림자는 몸 바로 아래로 px의 7%(뮤탈이면 두 픽셀 남짓)만 내려간다.
               지상 유닛은 원작의 충돌 처리가 서로 떼어 놓으니 그 두 픽셀이 이웃의 몸
               **바깥**에 떨어져 테두리로 읽힌다. 그런데 **공중 유닛은 서로 안 밀어낸다**
               — 뮤탈 뭉치는 몸이 거의 포개져 날므로, 두 픽셀짜리 그림자는 통째로 위에
               그려지는 이웃 몸 밑에 깔려 한 점도 안 보인다.
               게다가 이 그림자는 '띄운 몸이 지는 그림자'이기도 하다: 높이 나는 것일수록
               멀리 져야 맞다. 공중만 몫을 두 배 반으로 키우고 한 단 짙게 한다 — 겹쳐도
               이웃 몸 밖으로 삐져나와 어느 것이 위인지가 읽힌다. */
            // 그림자 판도 예산에 든다 — 건물 쪽의 ★ 주석과 같은 까닭이다.
            const sh9 = shadowPlate(
              spr, Math.max(1.5, pxqB * (op.air ? 0.16 : 0.1)),
              op.air ? 0.55 : 0.4, B, spriteBytes,
            );
            trimBoth9();
            if (sh9) {
              ctx.globalAlpha = op.alpha;
              SPRITE_PERF.blit += 1;
              ctx.drawImage(
                sh9.cv,
                (-(spr.pad + pxqB / 2) + spr.ox / B - sh9.pad) * k,
                (-(spr.pad + pxqB / 2) + spr.oy / B - sh9.pad) * k
                  + Math.max(1, px * (op.air ? 0.18 : 0.07)),
                sh9.w * k, sh9.h * k,
              );
            }
          }
          ctx.globalAlpha = op.alpha;
          SPRITE_PERF.blit += 1;
          /* 자른 판을 제 자리에 되돌린다 — 원래 판의 왼위 모서리가 있던 곳에서
             자른 만큼(ox·oy, 기기 픽셀이라 B로 나눈다) 옮겨 그리면, 통째로 그린 것과
             픽셀 단위로 같은 그림이 나온다. */
          const cw9 = spr.cv.width / B;
          const ch9 = spr.cv.height / B;
          /* ★ 겹쳐 찍는 판(op.attach) — 일꾼이 든 짐이다. **같은 자**로 굽는다: 같은
             크기(pxqB)·같은 배수(NORM_PAIR가 맨몸 것으로 접는다)라, 몸과 똑같은 변환에
             제 잉크 오프셋(ox·oy)만 달리 주면 짐이 제 모형 좌표에 앉는다. 짐 판은 몸의
             5분의 1 크기라 무게가 25분의 1이다 — 몸을 미네랄·가스로 두 벌 굽던 것을 한
             벌로 줄이는 값에 견주면 거저다.
             ★ **앞뒤 차례는 요잉이 정한다** — 짐은 모형의 앞(+y)에 안기므로, 일꾼이 등을
               보이면(요잉 90~270도) 짐은 몸 **뒤**에 있어야 한다. 한 판씩 겹쳐 찍는
               길에는 부품별 깊이가 없으니 차례로 그 몫을 낸다: 등을 보일 때는 짐을 먼저
               깔고 몸으로 덮는다(합본 모델에서 짐이 가려지던 그 그림이 그대로 난다). */
          const atSpr9 = op.attach ? unitSprite({ ...op, kind: op.attach }, pxqB, B) : null;
          /* 둘째 겹판(op.attach2) — 늘 몸 **앞**에 찍는다(시즈 전환의 앞쪽 버팀다리). 같은 배율(attachK)을 탄다. */
          const at2Spr9 = op.attach2 ? unitSprite({ ...op, kind: op.attach2 }, pxqB, B) : null;
          const atDrawOf9 = (sp9: typeof atSpr9, kOverride9?: number): void => {
            if (!sp9) return;
            SPRITE_PERF.blit += 1;
            /* 겹판 배율(op.attachK) — 원점(모델 원점 = 변환의 0,0) 기준이라 시즈 버팀다리가 차체에서 뻗어 나온다. */
            const aK9 = kOverride9 ?? op.attachK ?? 1;
            if (aK9 <= 0.01) return;
            if (aK9 !== 1) { ctx.save(); ctx.scale(aK9, aK9); }
            drawTint9(ctx, sp9, op.color, pxqB, k, B);   // 물들인 마스크를 몸판 **아래**에(unitSprite의 ★)
            ctx.drawImage(
              sp9.cv,
              (-(sp9.pad + pxqB / 2) + sp9.ox / B) * k,
              (-(sp9.pad + pxqB / 2) + sp9.oy / B) * k,
              (sp9.cv.width / B) * k, (sp9.cv.height / B) * k,
            );
            if (aK9 !== 1) ctx.restore();
          };
          const atDraw9 = (): void => atDrawOf9(atSpr9);
          const rb9 = ((Math.round((op.rotDeg ?? 0) / 22.5) * 22.5) % 360 + 360) % 360;
          // 배율 겹판(버팀다리)은 늘 몸 뒤 — 오므린 다리가 차체 위로 안 비친다.
          const atBack9 = op.attachK !== undefined || (rb9 > 90 && rb9 < 270);
          if (atBack9) atDraw9();
          drawTint9(ctx, spr, op.color, pxqB, k, B);   // 물들인 마스크를 몸판 **아래**에(unitSprite의 ★)
          ctx.drawImage(
            spr.cv,
            (-(spr.pad + pxqB / 2) + spr.ox / B) * k,
            (-(spr.pad + pxqB / 2) + spr.oy / B) * k,
            cw9 * k, ch9 * k,
          );
          if (!atBack9) atDraw9();
          atDrawOf9(at2Spr9, op.attach2K);   // 둘째 겹판은 제 배율(attach2K)이 있으면 그것을, 없으면 attachK를 탄다
          ctx.setTransform(Bd, 0, 0, Bd, 0, 0);
          continue;
        }
        // 스프라이트를 못 구우면 예전 직접 그리기로 — 이 갈래도 센다(비싼 길이다).
        SPRITE_PERF.direct += 1;
        const ds9 = px / 16;
        ctx.transform(ds9, 0, 0, ds9, -8 * ds9, -8 * ds9);
        for (const [d, o, fill] of faces) {
          ctx.globalAlpha = op.alpha * shadeBoost(o, fill);
          ctx.fillStyle = fill ?? op.color;
          ctx.fill(pathOf(d));
        }
        ctx.setTransform(Bd, 0, 0, Bd, 0, 0);
      }
      };
      /* 크립은 지형을 못 넘는다(요청: 벽·램프·다리) — 크립 판(clipWalk, z가 제일 낮다)만
         먼저 깔고, 차단 마스크를 destination-out으로 파낸 다음 나머지를 얹는다. 캔버스에
         아직 크립뿐이라 다른 그림은 안 다친다. */
      /* ★ **겹쳐 깔린 얼룩을 솎는다** — 12배 저그 기지에서만 나던 버벅임의 진짜 몫이다
         (지적: "화면 전체를 그리면 다른 종족 기지를 12배로 드래그해도 버벅였어야 하는 거
         아니야?" — 옳은 지적이었다) ────────────────────────────────────────────────────
         앞선 손질(화면 밖 얼룩 걸러내기)은 **덜 중요한 절반**이었다. 화면 밖 그리기는
         브라우저가 캔버스 경계에서 잘라 내므로 부르는 삯만 들 뿐 픽셀 값이 거의 없다 —
         그래서 다른 종족 기지를 볼 때는 티가 안 났던 것이고, 그 지적이 정확히 그 사실을
         짚었다.
         값이 나는 것은 **화면 안에 깔린 얼룩끼리의 겹침**이다. 얼룩 하나는 건물마다
         하나씩 나고 반지름이 크다 — 12배·dpr 3에서 한 장이 화면(1218²)을 거의 다 덮는다.
         저그 본진에는 건물이 스물 남짓이니 **같은 화소를 스무 번 칠하는** 셈이고, 배율의
         제곱으로 는다. 저그만·12배만·드래그할 때만이라는 세 조건이 여기서 다 나온다.
         그런데 그 스물은 거의 같은 자리다: 이웃한 건물의 얼룩은 서로를 덮을 뿐 윤곽을
         넓히지 못한다. 중심이 서로 가까운 것을 솎아도 union은 사실상 그대로다.
         차례는 z 순(먼저 온 것이 뒤)이므로 앞의 것을 남기고 뒤의 것을 버린다 — 얼룩은
         불투명 한 겹이라 어느 것을 남기든 그림이 같다. 문턱은 제 폭의 30%로, 윤곽을
         넓히는 바깥쪽 얼룩은 살아남는다. */
      const creepList = ((): UnitDrawOp[] => {
        if (showCreep === false) return [];
        /* ★ 큰 판부터, 그리고 **큰 판 안에 통째로 든 작은 판만** 솎는다(버그: "해처리 주변의 크립이 안 생기거나
           갑자기 없어지는 경우") — 여태는 줄 차례대로 보며 '가까이에 이미 남긴 판이 있으면' 버렸다. 성큰·스포어의
           작은 판이 먼저 남으면 그 곁의 해처리 큰 판이 통째로 떨어져 나갔고, 콜로니가 서거나 사라질 때마다 해처리
           크립이 생겼다 없어졌다 했다. 반지름이 큰 순서로 세우고, 남긴 판의 반지름에서 제 반지름을 뺀 거리 안에
           가운데가 들어올 때(가려져 안 보이는 판)만 버린다. 같은 크기끼리는 서로 안 버린다. */
        const all9 = sorted.filter((o) => o.clipWalk).sort((a9, b9) => (b9.wFrac ?? 0) - (a9.wFrac ?? 0));
        if (all9.length < 3) return all9;
        /* ★ '통째로 든다'는 **정말로 통째로**여야 한다(지적: "성큰이 완성됐는데 크립이 안 나타나다가 원래 있던
           해처리의 크립이 사라지니 그제서야 보임" — 해처리에서 4타일 안) ────────────────────────────────────
           여태는 큰 판 반지름에서 작은 판 반지름의 85%를 뺀 거리 안에 가운데가 들면 버렸다. 그 15%와 '반지름 차
           안'이라는 어림이 합쳐져, 해처리 곁에서 자라는 콜로니 얼룩(해처리 판보다 작은 동안)은 해처리 판 **밖으로
           삐져나오는데도** 버려졌다 — 그래서 성큰의 크립은 해처리가 죽어 그 판이 사라져야 나타났다. 이제 가로·세로
           각각 '가운데 거리 + 제 반지름 ≤ 남긴 판의 반지름'일 때만 버린다(상자 포함). 세로는 fy(지도 높이 분수)를
           지도 폭 분수로 바꿔 wFrac·hFrac과 같은 자로 잰다. */
        const keep9: UnitDrawOp[] = [];
        const fyK9 = mh9 / cw;
        for (const o9 of all9) {
          const rox9 = (o9.wFrac ?? 0) * 0.5;
          const roy9 = (o9.hFrac ?? o9.wFrac ?? 0) * 0.5;
          if (keep9.some((k9) => {
            const rkx9 = (k9.wFrac ?? 0) * 0.5;
            const rky9 = (k9.hFrac ?? k9.wFrac ?? 0) * 0.5;
            return Math.abs(k9.fx - o9.fx) + rox9 <= rkx9 + 1e-6
              && Math.abs(k9.fy - o9.fy) * fyK9 + roy9 <= rky9 + 1e-6;
          })) continue;
          keep9.push(o9);
        }
        return keep9;
      })();
      /* 클립은 벽 마스크와 무관하다(재지적: 3D에서 아직도 미니맵을 벗어남) — 전에는
         마스크가 있을 때만 이 갈래로 들어와, 마스크가 아직 안 구워진 판에서는 클립
         자체가 안 걸려 크립이 맵 밖으로 샜다. 이제 크립이 있으면 늘 가둔다. */
      if (creepList.length > 0) {
        /* 크립은 맵 밖으로 못 나간다(지적: 미니맵 밖까지 나옴) — 컨테이너가 overflow:
           hidden이 아니라(모서리 마커를 안 자르려고) 가장자리 해처리의 크립 원이 그림
           밖까지 그려졌다. 크립 판만 맵 영역으로 클립한다 — 평면은 사각형, 입체는
           원근 사다리꼴(clipQuad, 재지적: 3D에서 여전히 벗어남). */
        ctx.save();
        /* ★ 크립은 **지도 상자 밖으로 못 나간다**(지적: "크립이 여유 공간까지 그려짐.
           크립은 바닥이라는 설정이라") — 이 캔버스는 지도보다 위로 한 뼘 더 크다(그림
           여유). 그 띠는 **키 큰 몸이 솟는 자리**이지 땅이 아니다: 거기 바닥이 깔리면
           지도가 그만큼 위로 늘어난 것처럼 읽히고, 여유의 뜻 자체가 사라진다.
           아래 클립은 지도 좌표(zy)로 잡으므로 배율·이동이 어긋나면 새어 나갈 수 있다.
           그래서 **캔버스 좌표로 한 겹 더** 가둔다 — 여유 띠는 어떤 셈이 틀려도 안 칠해진다. */
        if (band9 > 0) {
          ctx.beginPath();
          ctx.rect(0, band9, cw, ch - band9);
          ctx.clip();
        }
        ctx.beginPath();
        if (clipQuad && clipQuad.length >= 3) {
          ctx.moveTo(zx(clipQuad[0][0]), zy(clipQuad[0][1]));
          for (let qi = 1; qi < clipQuad.length; qi += 1) {
            ctx.lineTo(zx(clipQuad[qi][0]), zy(clipQuad[qi][1]));
          }
          ctx.closePath();
        } else {
          ctx.rect(zx(0), zy(0), cw * zoom, ch * zoom);
        }
        ctx.clip();
        paintOps(creepList);
        // 지형 차단은 마스크가 구워졌을 때만 파낸다.
        if (wallMask && maskRects && maskRects.length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.shadowColor = "transparent";
          // op별 save를 걷은 뒤로 직전 op의 알파가 남아 있을 수 있다 — 지우개는 꽉 채운다.
          ctx.globalAlpha = 1;
          /* 차단 마스크도 **화면에 걸리는 조각만** 판다(같은 조사) — 이 그리기도 배율을
             그대로 타는 늘려 찍기라, 지도 전체의 조각을 다 파면 크립을 다 그리는 것과
             같은 값이 한 번 더 든다. 화면 밖 조각은 지워 봐야 지울 것이 없다. */
          for (const [sy0, sh, fx0, fy0, fx1, fy1] of maskRects) {
            const dx9 = zx(fx0);
            const dy9 = zy(fy0);
            const dw9 = (fx1 - fx0) * cw * zoom;
            const dh9 = (fy1 - fy0) * ch * zoom;
            if (dx9 + dw9 < 0 || dx9 > cw || dy9 + dh9 < 0 || dy9 > ch) continue;
            ctx.drawImage(wallMask, 0, sy0, wallMask.width, sh, dx9, dy9, dw9, dh9);
          }
          ctx.restore();
        }
        ctx.restore();
        paintOps(drawList9.filter((o) => !o.clipWalk));
      } else {
        paintOps(drawList9);
      }
      /* ── 전투 효과(요청: 이펙트 캔버스 이관) — 몸을 다 그린 위에 얹는다. CSS 키프레임
         이던 애니메이션은 전부 **위상(ph)의 함수**다: 캔버스는 어차피 틱마다 다시
         그리므로 그 프레임의 모습 하나만 내면 된다. 봉투(env*)들은 keyframes의 마디를
         그대로 옮긴 값이다. */
      /* 층은 **가장 이른 갈래**에서 서고, 무엇을 그릴지는 아래 고리가 갈래마다 가린다.
         트레이서(2배)가 그 가장 이른 갈래라 여기서는 그것만 보면 된다. */
      if (fx && fx.length > 0 && (detail || zoom >= TRACER_MIN_ZOOM)) {
        // scr-tracer: 0%→0 · 10~45%→1 · 70%~→0.
        const envBeam = (p9: number): number =>
          (p9 < 0.1 ? p9 / 0.1 : p9 < 0.45 ? 1 : p9 < 0.7 ? (0.7 - p9) / 0.25 : 0);
        // scr-hitflash: 0→0 · 12~55%→1 · 100%→0.
        const envHit = (p9: number): number =>
          (p9 < 0.12 ? p9 / 0.12 : p9 < 0.55 ? 1 : (1 - p9) / 0.45);
        // scr-shieldfx: 0→0 · 16%→1 · 42%→0.4 · 64%→0.95 · 100%→0 (두 번 깜빡).
        const envShield = (p9: number): number => (p9 < 0.16 ? p9 / 0.16
          : p9 < 0.42 ? 1 - ((p9 - 0.16) / 0.26) * 0.6
            : p9 < 0.64 ? 0.4 + ((p9 - 0.42) / 0.22) * 0.55 : (1 - p9) / 0.36 * 0.95);
        ctx.save();
        ctx.shadowColor = "transparent";
        /* 렌즈px 상수의 자(지적: "PC보다 모바일에서 트레이서 크기가 훨씬 큼") — 갈래표의 l·w, 가시 높이
           4.05, 광구 0.7 같은 값은 '1배 CSS px'라 배율만 곱했다. 그런데 타일 하나가 PC에서는 8px 남짓,
           폰에서는 3px라(지도가 화면 폭에 맞춰 선다) 같은 배율의 같은 px가 폰에서는 유닛 대비 2.6배로
           컸다. 유닛·피격(f.size)은 엔진이 타일 자로 내므로 이미 맞다. 이 상수들만 타일 8px를 기준으로
           타일 자에 태운다 — PC(≈8px)는 그대로, 폰은 그만큼 준다. */
        const tz9 = zoom * ((tilePx ?? 8) / 8);
        for (const f of fx) {
          /* ★ 갈래마다 제 칸이 있다(요청: "2배에서 전투효과: 가시 분출 우리 / 4배에서
             전투효과: 피격 / 나머지는 다 8배부터") — 사다리는 FX_MIN_ZOOM이고, 배치의
             바닥(detailAt: PC 2배·폰 8배)과 **둘 중 늦은 쪽**이 실제 칸이다. 트레이서만
             그 바닥 위에 있다(요청: "모든 트레이서류 2배 줌부터") — beam(제자리 번쩍)과
             shot(날아가는 탄)이 곧 무기별 트레이서 전부라, 무기가 무엇이든 유닛이 쏘든
             방어 건물이 쏘든 이 한 줄을 지난다. */
          if (zoom < (FX_NO_FLOOR.has(f.kind)
            ? FX_MIN_ZOOM[f.kind] : Math.max(FX_MIN_ZOOM[f.kind], detailAt ?? 0))) continue;
          /* 낮은 배율 죄기(위 lowZoomTrim9) — 꾸밈부터 덜고, 심하면 트레이서까지 던다.
             무슨 일이 있었나를 말하는 것(죽음 폭발·소환 섬광·우리·스톰·핵·붕괴)은 남는다. */
          if (trim9 >= 1) {
            if (f.kind === "wound") continue;
            if (f.kind === "dom" && TRIM1_SKIP9.has(f.style ?? "")) continue;
            if (trim9 >= 2) {
              if (f.kind === "dom" && TRIM2_SKIP9.has(f.style ?? "")) continue;
              if (f.kind === "beam" || f.kind === "shot" || f.kind === "spike" || f.kind === "erupt") continue;
            }
          }
          const ax = zx(f.fx);
          const ay = zy(f.fy) - f.lift * zoom;
          if (ax < -60 || ax > cw + 60 || ay < -60 || ay > ch + 60) continue;
          const p9 = Math.max(0, Math.min(1, f.ph ?? 0));
          if (f.kind === "burst") {
            drawBurst9(ctx, f, ax, ay, zoom, p9, tz9);
            continue;
          }
          if (f.kind === "wound") {
            drawWound9(ctx, f, ax, ay, zoom, Bd);
            continue;
          }
          if (f.kind === "dom") {
            /* 죽음 여운은 캔버스 파편(burst)이 서는 2배 아래에서만 나온다 — 스팬 시절과 같은 칸이다. */
            if (f.style === "die" && zoom >= FX_MIN_ZOOM.burst) continue;
            drawDomFx9(ctx, f, ax, ay, zoom, Bd, tz9);
            continue;
          }
          if (f.kind === "warp") {
            /* ★ 프로토스 소환 완료의 **섬광**(요청) — 원작은 워프가 끝나는 순간 한 번 친다. 폭발이 아니라
               '문이 닫히는 빛'이라 짧고(0.22초) 조각도 연기도 없다: 흰 심이 확 텄다가 곧 꺼지고, 그 둘레로
               얇은 청백 고리가 한 번 퍼져 나간다. 완공이 잦아도 눈을 안 찌르게 세기는 낮게 잡았다. */
            const R9 = (f.size ?? 4) * zoom;
            const eo9 = 1 - (1 - p9) * (1 - p9);          // 고리는 빠르게 퍼지고
            const fa9 = Math.max(0, 1 - p9) ** 1.4;       // 빛은 뒤로 갈수록 빨리 준다
            ctx.globalAlpha = 0.55 * fa9;
            ctx.fillStyle = "#f2fbff";
            ctx.beginPath(); ctx.arc(ax, ay, R9 * (0.42 + 0.18 * eo9) * (0.5 + 0.5 * fa9), 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.3 * fa9;
            ctx.fillStyle = "#9fd4ff";
            ctx.beginPath(); ctx.arc(ax, ay, R9 * (0.6 + 0.35 * eo9), 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.75 * (1 - p9);
            ctx.strokeStyle = "#dff1ff";
            ctx.lineWidth = Math.max(0.8, R9 * 0.06 * (1 - p9));
            ctx.beginPath(); ctx.arc(ax, ay, R9 * (0.35 + 1.05 * eo9), 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            continue;
          }
          if (f.kind === "hit") {
            /* 피격은 **두 겹**이다(요청: "피격시 무조건 주황색 폭발로 처리되는데") ──
                 ① 때린 무기의 제 그림(FX_IMPACT) — 시즈는 크게 터지고 히드라 가시는
                    초록으로 튄다. 무기를 모르거나 근접이면 이 겹은 없다.
                 ② 맞은 몸의 제 결(FX_MAT) — 살은 피, 프로토스는 에너지, 기계는 불꽃.
                    죽음 효과와 같은 넷이라 "누가 맞았나"가 죽을 때와 같은 색으로 읽힌다.
               여태 이 자리는 무기·몸을 안 가리는 주황 복사 그러데이션 하나였다. */
            const a9 = envHit(p9);
            if (a9 <= 0.02) continue;
            /* ★ 피격은 **섬광 하나 + 파편 셋**이다(후보판에서 고름: "A의 방향에 B의 효과, 충격링은
               없어도 될듯") ──────────────────────────────────────────────────────────────
               옛 판(무기 색 방사 그러데이션 + 결 얼룩 + 낱알 다섯)은 번짐이 커서 색 덩이로 읽혔다.
               이제 ① 맞은 자리에 몸 결의 흰 섬광이 한 점 터져 줄어들고, ② 파편 셋이 **맞은 반대쪽**
               (때린 쪽에서 밀려나는 방향)으로 부채꼴로 날아간다. 피(생체·저그)는 중력을 타고 조금
               떨어진다. 무기의 세기는 섬광·파편의 자에만 실린다(시즈는 크게, 총알은 작게) — 무기의
               제 그림(FX_IMPACT의 그러데이션)은 더 안 그린다. */
            const base9 = f.size ?? 4;
            const r9 = (base9 / 2) * zoom * HIT_FX_K;
            const off9 = (f.dist ?? base9 * 0.71) * zoom;
            const hx9 = ax + (f.dx ?? 0) * off9;
            const hy9 = ay + (f.dy ?? 0) * off9 - r9 * 0.2;
            const im9 = f.style ? FX_IMPACT[f.style] : undefined;
            /** 무기 세기 — 표의 반지름비(총 0.5 · 시즈 1.75)를 1 언저리로 옮긴 배수. */
            const wk9 = im9 ? Math.min(2, Math.max(0.7, im9.r / 0.6)) : 1;
            const mt9 = FX_MAT[f.mat ?? "mech"];
            /* ★ 표적 자리 **스플래시**(커세어 플레어·아콘 잽)는 제 그림 그대로다(지적: "인터셉터 피격효과
               파편이 아직도 너무 큰데") — 이 둘은 맞는 쪽 체력이 아니라 **쏘는 쪽 박자**로 표적에 얹는
               op이고, 자(size)가 쏘는 몸의 **상자 통째**다(옛 그러데이션 타원의 자). 파편 그리기로 넘어가니
               커세어가 쏘는 인터셉터마다 상자만 한 파편 부채가 텄다. 옛 납작 타원(FX_IMPACT flat)을 되살려
               이 갈래만 그것으로 그리고 파편은 안 낸다. */
            // 깃발로 가른다(재지적: "스플래시는 트레이서에 가깝고 피격효과는 나야지") — 같은 무기에
            // **맞아서 체력이 깎인** 피격(splash 없음)은 아래 파편으로 간다.
            if (im9 && f.splash) {
              const ir9 = r9 * im9.r * (0.7 + p9 * 0.5);
              const fl9 = im9.flat ?? 1;
              ctx.globalAlpha = a9;
              if (fl9 !== 1) { ctx.translate(hx9, hy9); ctx.scale(1, fl9); ctx.translate(-hx9, -hy9); }
              const gi9 = ctx.createRadialGradient(hx9, hy9, 0, hx9, hy9, ir9);
              for (const [o9, c9] of im9.g) gi9.addColorStop(o9, c9);
              ctx.fillStyle = gi9;
              ctx.beginPath();
              ctx.arc(hx9, hy9, ir9, 0, Math.PI * 2);
              ctx.fill();
              if (fl9 !== 1) { ctx.translate(hx9, hy9); ctx.scale(1, 1 / fl9); ctx.translate(-hx9, -hy9); }
              continue;
            }
            /* ★ 파편 **스물넷**, **궤적 스트릭**(재요청: 양 4배, 이동 방향으로 길게) — 후보판 B2의
               움직임(짧게 튀어 멈춤, 중력 없음, 섬광·링 없음)은 그대로 두고, 낱개를 점 대신 조금 전
               자리에서 지금 자리까지 잇는 짧은 선으로 그려 꼬리가 생긴다. 각은 부채꼴 ±0.65rad를
               고르게 나누되 낱개마다 고정 흔들림(각·거리·굵기)을 줘 줄 서지 않는다. */
            const hasDir9 = Number.isFinite(f.dx) && Number.isFinite(f.dy) && ((f.dx ?? 0) !== 0 || (f.dy ?? 0) !== 0);
            const away9 = hasDir9 ? Math.atan2(-(f.dy ?? 0), -(f.dx ?? 0)) : 0;
            /* ★ 삯(지적: 모바일이 버거워짐) — 낱개마다 stroke를 부르면 맞는 몸마다 스물네 번이다. 색이 둘뿐이니
               **색별로 한 경로에 몰아** 두 번만 긋는다(굵기는 색별 한 값). 폰은 낱개도 열둘로 줄인다. */
            /* 피격 파편은 **죽음 파편 수가 아니다**(지적: "스커지 자폭에서 왜 프로토스 사별 효과가
               나지") — 여기가 DEV9.dieShards(PC 24·폰 12)를 읽고 있었다. 위 주석의 뜻은 '파편 셋'인데
               스커지(무기 세기 wk9 = 2)가 프로토스를 치면 연푸른 줄 스물넷이 몸 두 배 부채로 터져,
               프로토스 사별의 푸른 구와 같은 색·같은 자로 읽혔다. 스커지 자체는 저그 재질(engine9의
               dk)로 터지므로 이 부채가 곧 '프로토스가 죽었다'로 보인 것이다. 결 표(FX_MAT)의 n
               (5·6)이 피격 낱개 수다 — 죽음(burst)은 따로 dieShards를 쓴다. */
            if (CROWD9.lv >= 2) continue;   // 덜어내기 2단: 피격 불티는 통째로 생략(죽음 burst만 남는다)
            const N9 = Math.max(2, Math.ceil(mt9.n * crowdShardK9()));
            ctx.lineCap = "round";
            for (let ci = 0; ci < 2; ci += 1) {
              ctx.beginPath();
              for (let di = ci; di < N9; di += 2) {
                const j1 = (di * 7) % 5; const j2 = (di * 11) % 4;
                const an9 = hasDir9
                  ? away9 + (di / (N9 - 1) - 0.5) * 1.3 + (j1 - 2) * 0.03
                  : (di / N9) * Math.PI * 2 + 0.3 + (j1 - 2) * 0.05;
                const sp9 = r9 * wk9 * (0.8 + j2 * 0.22);
                const d1 = sp9 * (0.3 + p9 * 1.2);
                const d0 = sp9 * (0.3 + Math.max(0, p9 - 0.28) * 1.2);
                const c9 = Math.cos(an9); const s9 = Math.sin(an9);
                ctx.moveTo(hx9 + c9 * d0, hy9 + s9 * d0 * 0.6 - d0 * 0.15);
                ctx.lineTo(hx9 + c9 * d1, hy9 + s9 * d1 * 0.6 - d1 * 0.15);
              }
              ctx.globalAlpha = a9 * (1 - p9) * 0.95;
              ctx.strokeStyle = ci ? mt9.drop : mt9.core;
              ctx.lineWidth = Math.max(0.6, r9 * wk9 * (ci ? 0.075 : 0.06) * 1.6);
              ctx.stroke();
            }
            ctx.lineCap = "butt";
            continue;
          }
          /* ★ (꺼 둠) 프로토스 실드 방어 효과 — 요청: "제거, 완성도있게 다시 추가할
             예정". 값을 짓는 쪽(걷기·건물 루프)은 그대로 두고 **그리는 이 한 자리**만
             막는다: 다시 켤 때 이 조건의 `false &&`만 지우면 되고, 그동안 값 짓는 코드가
             썩지 않는다(자리·크기·위상을 계속 같은 식으로 셈해 둔다). */
          /* ★ 빙결 우리(요청: "스테이시스는 동그라미 판 하나로 할 건 아니고 각 유닛별로
             하이브 모양으로 가둬야 해. 락다운도 각 유닛별로 원형에 가두고. 색깔은
             스테이시스는 얼음 푸른색, 락다운은 노란기 있는 흰색. 둘 다 반투명") ──────────
             여태 이 둘은 시전 자리에 **판 하나**였다(AREA_FX의 stasis·lock). 그건 '어디에
             걸었나'는 말해도 '누가 걸렸나'는 못 말한다 — 걸린 몸이 판 밖에 서 있기도 하고,
             안 걸린 몸이 판 안에 서 있기도 한다. 원작도 갇힌 몸마다 제 우리가 씌워진다.
             이제 **걸린 몸마다 하나씩** 씌운다(그 판정은 이미 있다 — e.statuses의 빙결).
             생김새로 둘을 가른다:
               스테이시스 — 육각 결정(하이브 꼴). 얼음 푸른빛. 벌집처럼 각진 우리다.
               락다운     — 둥근 구. 노란기 도는 흰빛. 기계를 멎게 하는 전자 우리다.
             둘 다 반투명이고, 아주 느리게 밝아졌다 어두워진다(멎어 있어도 살아 있는 표시).
             ★ 몸 위에 그린다 — 우리는 몸을 **가두는** 것이지 몸 뒤에 깔리는 판이 아니다. */
          if (f.kind === "cage") {
            const ice9 = f.style === "stasis";
            const r9 = ((f.size ?? 8) / 2) * zoom;
            /* ★ 가운데는 **실려 온 자리 그대로**다(요청: "모델에 입힐 수는 있잖아") —
               여기서 반지름의 절반쯤을 더 올리고 있었는데, 그러면 우리의 높이가 제 크기에
               매여 몸과 따로 논다(큰 몸일수록 더 뜬다). 몸에 얹는 일은 값을 싣는 쪽이
               한다 — 거기서 그리는 쪽과 **같은 세 몫**으로 높이를 낸다(cage의 lift 주석).
               그러니 여기서는 한 톨도 더 안 옮긴다. */
            const cy9 = ay;
            /** 숨 — 0.85~1 사이를 아주 느리게 오간다. */
            const br9 = 0.85 + 0.15 * Math.sin((f.ph ?? 0) * Math.PI * 2);
            ctx.globalAlpha = br9;
            /* ★ 속은 **납작하고 아주 옅게** 채운다(지적: "스테이시스 원반 효과 제거가
               안 됐고") — 원반은 딴 데서 오는 것이 아니라 **여기서 났다.** 가장자리로
               갈수록 짙어지는 방사 그러데이션을 깔아 두었는데, 그런 우리 여럿이 겹치면
               테두리끼리 더해져 한 장의 둥근 판으로 읽힌다. 걷어낸 줄 알았던 그 원반이
               모양만 바꿔 되살아나 있었던 셈이다.
               얼음은 속이 비치는 것이라 채움은 '있는 듯 없는 듯'이면 되고, 형태는
               **테두리와 결**이 말한다(아래 stroke). */
            ctx.fillStyle = ice9
              ? "rgba(150,214,255,0.10)" : "rgba(255,248,206,0.09)";
            /** 육각(하이브) 또는 원 — 한 자리에서 길을 만든다. */
            const cagePath = (rx9: number, ry9: number): void => {
              ctx.beginPath();
              if (!ice9) { ctx.ellipse(ax, cy9, rx9, ry9, 0, 0, Math.PI * 2); return; }
              for (let i9 = 0; i9 < 6; i9 += 1) {
                const a9 = ((-90 + i9 * 60) * Math.PI) / 180;
                const px9 = ax + Math.cos(a9) * rx9;
                const py9 = cy9 + Math.sin(a9) * ry9;
                if (i9 === 0) ctx.moveTo(px9, py9); else ctx.lineTo(px9, py9);
              }
              ctx.closePath();
            };
            /* ★ **정육각**이다(지적: "빙결 도형은 정육각형으로. 지금 유닛에 맞춰서
               길쭉") — 세로를 늘려 벌집 한 칸을 세운 꼴로 뒀는데, 그러면 유닛 몸에 맞춘
               자루처럼 보이지 얼음 덩이로 안 읽힌다. 얼음은 제 결대로 깎이지 담긴 것의
               모양을 따르지 않는다. 가로·세로를 같게 두면 어느 유닛에 씌워도 같은
               결정이다. */
            const ry9 = ice9 ? r9 : r9 * 1.02;
            /* ★ 모서리는 **예리하게**(지적: "모서리 선도 너무 둔해 더 예리하고 얇아야 해")
               — 굵기를 절반 아래로 내리고(0.34 → 0.15배율), 이음매를 미터로 못 박아
               꼭짓점이 뭉툭하게 깎이지 않게 한다. 이 고리 안의 다른 갈래가 둥근 끝
               (lineCap "round")을 켜 두고 지나갈 수 있어, 여기서 제 값을 다시 세운다 —
               캔버스 상태는 op 사이에 그대로 흘러간다. */
            ctx.lineJoin = "miter";
            ctx.miterLimit = 10;
            ctx.lineCap = "butt";
            cagePath(r9, ry9);
            ctx.fill();
            ctx.strokeStyle = ice9
              ? "rgba(224,246,255,0.85)" : "rgba(255,252,226,0.8)";
            ctx.lineWidth = Math.max(0.35, 0.15 * zoom);
            ctx.stroke();
            /* (걷어냄) 안쪽 한 겹 — 우리에 '두께'를 주려던 겹인데, 작은 우리에서는 두
               선이 붙어 한 줄이 굵어진 것처럼만 보였다(둔해 보이던 몫의 절반이 이것이다).
               두께는 이제 아래 결이 말한다. */
            /* 얼음의 결(스테이시스만) — 꼭짓점에서 가운데로 긋는 세 줄. 정육각 덩이가
               **깎인 결정**으로 읽히게 하는 최소한의 선이다(요청: "정육각 얼음에 가둔").
               테두리보다 한 단 가늘고 옅게 — 결은 형태를 거들 뿐 형태가 아니다. */
            if (ice9) {
              ctx.globalAlpha = br9 * 0.42;
              ctx.lineWidth = Math.max(0.25, 0.1 * zoom);
              ctx.beginPath();
              for (const k9 of [0, 2, 4]) {
                const a9 = ((-90 + k9 * 60) * Math.PI) / 180;
                ctx.moveTo(ax + Math.cos(a9) * r9, cy9 + Math.sin(a9) * ry9);
                ctx.lineTo(ax, cy9);
              }
              ctx.stroke();
            }
            continue;
          }
          if (f.kind === "shield" && !SHIELD_FX_ON) continue;   // 꺼 두어도 총구 번쩍임 갈래로 흘러가면 안 된다.
          if (f.kind === "shield") {
            /* 막은 **죽음과 갈려야 한다**(지적: "스커지 자폭에서 왜 프로토스 사별 효과가 나지") —
               스커지 자체는 저그 재질로 터진다(engine9의 dk). 프로토스로 보인 것은 **맞은 쪽**의
               실드 피격 막이었다: 여태 흰 심 + 푸른 방사 구 + 테로, 프로토스 사별의 플라즈마 구
               (drawBurst9 toss: 푸른 구·연푸른 속·흰 심·밝은 테)와 같은 문법이었다. 몸의 1.35배로
               0.55초라 스커지 한 방마다 '프로토스가 죽었다'로 읽혔다.
               이제 막은 **가장자리에서만 밝은 껍질**이다 — 안쪽은 거의 비치고 테두리로 갈수록
               연푸른빛이 오르며 얇은 테 하나가 몸을 감싼다. 흰 심이 없고 구가 안 차오르므로
               죽음과 겹칠 일이 없다. 자·길이도 한 단 줄였다(engine9: 1.2배·0.4초). */
            /* **플라즈마 빛**(요청) — 프로토스 결(FX_MAT.toss)과 같은 시안·흰빛이다: 속은 옅은 시안 안개, 테로 갈수록
               밝아져 흰 심이 선 시안 테 하나가 몸을 감싼다. 금빛은 어디에도 없다. 선 굵기는 타일 자(tz9)로 폰을 맞춘다. */
            const a9 = envShield(p9);
            if (a9 <= 0.02) continue;
            /* ★ **우산 같은 구 껍질**(요청: "구 형태로 — 윗부분은 채워지고 아래로 갈수록 투명해지는 보호막. 위에서
               2/3쯤까지만 보이되 칼같지 않게 자리마다 다른 높이에서 스러지고, 위도 완전 불투명이 아니라 반투명. 색은
               청색") ───────────────────────────────────────────────────────────────────────────────────
               원 테두리 하나였던 것을 걷고, 공의 윗둥을 감싼 반투명 청색 껍질로 그린다:
                 · 모양은 원의 윗호 + 아랫변은 **자리마다 다른 높이**의 물결선(각도의 결정론 해시 — 프레임마다 같은
                   모양이라 떨리지 않는다). 평균은 위에서 2/3 지점(가운데 아래 r/3), ±0.15r로 흔든다.
                 · 채움은 위(반투명 청색 0.5)에서 물결선 언저리(0)로 스러지는 세로 그러데이션이라 가장자리가 부드럽다.
                 · 구 느낌은 왼위 하이라이트(옅은 흰빛) 한 겹과, 윗호를 따라 도는 밝은 테(양 끝으로 갈수록 옅어짐)로. */
            const sc9 = 0.92 + p9 * 0.16;
            const r9 = ((f.size ?? 6) / 2) * zoom * sc9;
            const cy9 = ay - r9 * 0.1;
            const N9 = 12;
            const seed9 = Math.round(f.fx * 9973 + f.fy * 7919);
            const kAt9 = (i9: number): number => {
              const h9 = Math.sin(seed9 * 0.37 + i9 * 12.9898) * 43758.5453;
              return 0.33 + ((h9 - Math.floor(h9)) - 0.5) * 0.3;   // 0.18 ~ 0.48 (아래로 +)
            };
            const dome9 = new Path2D();
            const k0 = kAt9(0);
            const kN = kAt9(N9);
            const xl9 = ax - r9 * Math.sqrt(Math.max(0, 1 - k0 * k0));
            const xr9 = ax + r9 * Math.sqrt(Math.max(0, 1 - kN * kN));
            const aL9 = Math.atan2(k0 * r9, xl9 - ax);       // 왼 끝(π 언저리)
            const aR9 = Math.atan2(kN * r9, xr9 - ax);       // 오른 끝(0 언저리)
            dome9.moveTo(xl9, cy9 + k0 * r9);
            dome9.arc(ax, cy9, r9, aL9, aR9 + Math.PI * 2, false);   // 윗호 — 각을 키우며(캔버스 시계) 180·270(꼭대기)·360을 지난다
            for (let i9 = N9 - 1; i9 >= 1; i9 -= 1) {
              const x9 = xl9 + (xr9 - xl9) * (i9 / N9);
              dome9.lineTo(x9, cy9 + kAt9(i9) * r9);
            }
            dome9.closePath();
            ctx.globalAlpha = a9;
            // 스러짐은 물결선의 평균 높이(r/3)에서 거의 0이 되게 — 그래야 들쭉날쭉한 아랫변이 칼같이 안 읽힌다.
            const lg9 = ctx.createLinearGradient(0, cy9 - r9, 0, cy9 + r9 * 0.34);
            lg9.addColorStop(0, "rgba(70,140,255,0.5)");
            lg9.addColorStop(0.4, "rgba(70,140,255,0.36)");
            lg9.addColorStop(0.75, "rgba(80,150,255,0.12)");
            lg9.addColorStop(1, "rgba(90,160,255,0)");
            ctx.fillStyle = lg9;
            ctx.fill(dome9);
            // 왼위 하이라이트 — 구의 빛 받는 자리.
            const hg9 = ctx.createRadialGradient(ax - r9 * 0.35, cy9 - r9 * 0.45, 0, ax - r9 * 0.35, cy9 - r9 * 0.45, r9 * 0.8);
            hg9.addColorStop(0, "rgba(220,240,255,0.28)");
            hg9.addColorStop(1, "rgba(220,240,255,0)");
            ctx.fillStyle = hg9;
            ctx.fill(dome9);
            // 윗호 테 — 꼭대기가 밝고 양 끝으로 옅어진다.
            const sg9 = ctx.createLinearGradient(0, cy9 - r9, 0, cy9 + r9 * 0.35);
            sg9.addColorStop(0, "rgba(190,225,255,0.85)");
            sg9.addColorStop(0.7, "rgba(150,200,255,0.35)");
            sg9.addColorStop(1, "rgba(150,200,255,0)");
            ctx.strokeStyle = sg9;
            ctx.lineWidth = Math.max(0.6, 0.3 * tz9);
            ctx.beginPath();
            ctx.arc(ax, cy9, r9 * 0.97, aL9, aR9 + Math.PI * 2, false);
            ctx.stroke();
            continue;
          }
          /* ★ 승하차 줄(요청: "수송선 탑승이나 내릴 때 갑자기 띡 없어지고 생기니까
             시각적으로 인식이 안 돼. 네온이나 아쿠아색 점선 같은 거라도 연결해 주면
             좋을 듯") ─────────────────────────────────────────────────────────────────
             몸이 선 자리와 배가 있는 자리를 **아쿠아 네온 점선**으로 잇는다. 눈이
             '없어졌다'가 아니라 '저기로 빨려 갔다'로 읽게 하는 것이 전부라 오래 안 둔다 —
             원작의 승하차 딜레이만큼만 살고 그동안 옅어진다(그 창은 몸이 작아지며 도는
             연출과 같은 창이다).
             점선은 **흐른다**: 눈금을 위상만큼 밀어 두면 한쪽으로 빨려 드는 결이 난다.
             두 겹으로 긋는다 — 넓고 옅은 겹이 네온의 번짐이고, 가늘고 밝은 심이 점선이다. */
          if (f.kind === "tether") {
            const bx9 = zx(f.tx ?? f.fx);
            const by9 = zy(f.ty ?? f.fy) - (f.tlift ?? f.lift) * zoom;
            const len9 = Math.hypot(bx9 - ax, by9 - ay);
            // 두 끝이 사실상 겹치면 선이 아니라 점이다 — 안 그린다.
            if (len9 < 2) continue;
            /* 진행 0→1. **끝의 3할에서만 옅어진다**(요청: "눈에 띄게 / 밝게") —
               처음부터 선형으로 죽이면 평균 밝기가 절반이라, 짧은 창에서는 있는 둥 마는 둥
               지나간다. 살아 있는 동안은 제 밝기로 있다가 마지막에 스러지는 편이 눈에 든다. */
            const fade9 = p9 < 0.7 ? 1 : Math.max(0, (1 - p9) / 0.3);
            /* ★ 굵기는 **집 안의 자를 따른다**(지적: "승하차 점선 너무너무 두꺼운 거
               아니야??") — 맞다. 처음 값(심 0.6×배율, 번짐 1.5×배율)은 이 화면에서 가장
               가는 선인 미사일 트레이서(0.5×배율)보다 심이 더 굵고 번짐은 그 세 배였다.
               바닥값도 1.6px이나 되어 1배에서는 유닛 몸(3px 남짓)만큼 굵은 줄이 갔다.
               가는 선의 집안 자는 우리·실드의 테두리(0.3×배율)다. 심은 그보다 가늘게
               (0.2×배율) 두고, 번짐만 그 곱절 남짓하되 아주 옅게 깐다 — 네온은 굵기가
               아니라 **번짐**으로 읽히는 것이라 심이 가늘수록 오히려 네온다워진다.
               눈금도 함께 좁힌다: 굵기가 준 만큼 촘촘해야 실 같은 결이 산다. */
            /* ★ **한 겹, 가늘게**(지적: "점선이 너무 굵고 밝아서 오히려 유닛이 안 보여.
               글로우 없는 단색 얇은 네온색 선으로 변경") — 넓고 옅은 번짐 겹을 걷고 심
               하나만 남긴다. 색도 흰빛을 뺀 **단색 사이언**이다: 흰빛이 섞이면 밝기가
               올라가 곁의 몸을 눌렀다. */
            const dash9 = Math.max(1.6, 1.8 * zoom);
            ctx.setLineDash([dash9, dash9 * 0.85]);
            ctx.lineDashOffset = -p9 * dash9 * 6;
            ctx.lineCap = "butt";
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx9, by9);
            ctx.globalAlpha = fade9 * 0.8;
            ctx.strokeStyle = "rgba(0,224,255,1)";
            ctx.lineWidth = Math.max(0.28, 0.22 * zoom);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
            ctx.lineCap = "butt";
            ctx.globalAlpha = 1;
            continue;
          }
          /* beam · shot · spike — 총구에서 deg 방향으로 뻗는 것들.
             ── 좌표 규약(지적 둘을 함께 고친 자리) ────────────────────────────
             x0·y0은 언제나 **총구**다. 여기서 앞(표적 쪽)으로 얼마나 나갔나가
             headD9, 잔상이 뒤로 얼마나 남나가 tailL9다. 그림은 머리(xh)에서
             꼬리(xt)로 그린다.
             ① 방향 뒤집기 — 예전에는 x0을 탄의 자리로 옮긴 뒤 **거기서 앞으로**
                st.l만큼 그렸다. 그래서 밝은 머리가 총구 쪽이고 꼬리가 표적 쪽이라
                탄이 뒤로 나는 그림이었다("동그란 광전자가 드라군쪽에 있고 그 잔상이
                앞쪽"). 이제 머리가 앞이고 꼬리가 뒤다.
             ② 표적 넘어가기 — 예전 끝점 x1은 늘 x0+st.l이라, 탄이 닿은 뒤에도
                제 길이만큼 표적을 지나쳐 뻗었다. 이제 머리를 reach9(총구→표적
                거리)로 죈다. 꼬리도 총구 뒤로는 안 넘어간다.
             muzzleLit 갈래(총구 화염·화염방사)만 예외로 총구가 밝다 — 표의 주석 참조. */
          const st = FX_BEAM[f.style ?? "base"] ?? FX_BEAM.base;
          let rad9 = ((f.deg ?? 0) * Math.PI) / 180;
          let dxx = -Math.sin(rad9);
          let dyy = Math.cos(rad9);
          const x0 = ax + (f.mx ?? 0) * zoom;
          const y0 = ay + (f.my ?? 0) * zoom;
          let a9 = 1;
          /* ★ 표적 자리가 실려 왔으면 **그 화면 점으로** 방향·거리를 다시 잰다(지적: "3D보기에서 트레이서의
             공중유닛 위치가 잘못 타게팅되는 느낌") — 엔진의 deg·len은 지도를 평면으로 놓고(세로만 pitchFlat)
             센 어림이라, 입체 사영의 시점 밀림(viewYaw의 skew)·깊이 축소(pitchK)가 안 실렸다. 사수와 표적의
             깊이가 다를수록, 그리고 공중(들기가 더해질수록) 끝점이 몸에서 벗어났다. 표적의 분수 자리를 붓이 제
             사영(zx·zy)으로 풀면 어떤 사영에서도 정확히 그 몸이다. */
          let tgtReach9: number | null = null;
          if ((f.kind === "beam" || f.kind === "shot") && f.tx !== undefined && f.ty !== undefined) {
            const x1 = zx(f.tx);
            const y1 = zy(f.ty) - (f.tlift ?? 0) * zoom;
            const vx9 = x1 - x0;
            const vy9 = y1 - y0;
            const vd9 = Math.hypot(vx9, vy9);
            if (vd9 > 0.01) {
              dxx = vx9 / vd9;
              dyy = vy9 / vd9;
              rad9 = Math.atan2(-dxx, dyy);
              tgtReach9 = Math.max(0, vd9 - (f.tgap ?? 0) * zoom);
            }
          }
          /** 총구에서 표적까지(화면 px) — op에 len이 실려 있으면 그만큼이 한계다. */
          /* ★ len은 **몸 가운데**에서 표적까지인데 선은 **총구**(mx·my)에서 시작한다 — 총구가
             겨눈 쪽으로 나와 있는 만큼 빼야 머리가 표적에서 멈춘다(지적: 배틀 트레이서가
             표적을 지나쳐 감 — 배틀은 총구가 앞으로 5타일 가까이 나와 있다). */
          const mzFwd9 = (f.mx ?? 0) * dxx + (f.my ?? 0) * dyy;
          const reach9 = tgtReach9 !== null ? tgtReach9
            : f.len !== undefined && f.len > 0 ? Math.max(0, f.len - mzFwd9) * zoom : Infinity;
          /** 잔상 길이 — 갈래표의 l이 곧 '뒤로 얼마나 남나'다. */
          const tailL9 = st.l * tz9;
          /** 총구에서 머리(표적 쪽 끝)까지. */
          let headD9 = 0;
          /** ★ **실제로 그어지는 길의 전체 길이** — 곡선·머리·꼬리가 다 이 자를 쓴다.
           *
           *  기본은 총구~표적의 화면 거리(reach9)지만, 그 거리가 무너지는 자리에서는
           *  아래 shot 갈래가 갈래 제 길이로 물러난다(run9). 여태 그 물러남이 **머리에만**
           *  실려 있었다 — 아래 연기 덩이는 여전히 reach9로 길을 매개했다. 그러면 머리는
           *  run9까지 나가는데 길은 reach9에서 끝나므로, 덩이가 전부 `t9 = 1`로 죄어져
           *  **표적 점 하나에 통째로 포개진다**: 화면에는 미사일이 아니라 그 자리의 흰 점
           *  하나가 남는다(지적: "골리앗 미사일 트레이서 안나감").
           *  그 자리가 왜 하필 골리앗인가 — 조준 높이는 **표적이 뜬 몫만큼 화면 세로를
           *  깎는다**(위 beamLen). 쏘는 쪽도 날면 제 높이가 그 몫을 되돌려 놓지만(레이스·
           *  발키리·스카우트 대공은 그래서 멀쩡했다), 골리앗은 **땅에 선 채 나는 것을
           *  쏘는** 유일한 갈래라 되돌릴 몫이 없다. 표적이 화면에서 제 높이만큼 아래에
           *  선 순간 세로가 0으로 상쇄되고, 거기서 이 길이 무너졌다. */
          let runD9 = reach9;
          if (f.kind === "beam") {
            /* ★ 산성 포자(디바우러) — 표적 몸에 **들러붙어 남는** 자국이다(만드는 쪽의
               acidAge9 주석에 그 사정이 있다). 위상은 '나이'다: 0이 갓 닿음, 1이 다음
               발 직전.
               그리는 결이 다른 갈래와 다르다 — 이것은 총구에서 뻗는 빛도 날아가는 탄도
               아니라서 방향(deg)도 길이(l)도 뜻이 없다. 몸에 흩뿌려진 **방울 몇**이
               전부고, 그 방울이 몸을 따라 눕는다(세로를 눌러 부감에 맞춘다).
               · 자리 — 황금각으로 흩어 어느 개수에서도 뭉치지 않는다. 마디 번호를
                 씨앗으로 삼아 **프레임마다 안 흔들린다**(난수를 새로 뽑으면 자국이 몸
                 위에서 끓는다 — 연기 덩이가 데었던 그 자리와 같은 까닭이다).
               · 삭음 — 다 삭아도 3할은 남긴다. 다음 발이 덧칠하므로 겨눠진 몸은 끊기지
                 않고 산에 덮인 채로 읽힌다.
               · 색 — 탄과 **같은 결**이다(이 파일의 규약: 나간 빛과 닿은 빛이 같은 색).
                 속은 옅은 보랏빛 흰색, 테로 갈수록 짙은 보라다. */
            if (f.style === "acidspore") {
              const r0 = ((f.size ?? 8) / 2) * zoom;
              if (r0 < 0.6) continue;
              const pop9 = p9 < 0.12 ? p9 / 0.12 : 1;      // 닿는 순간 톡 붙는다
              const fade9 = 1 - p9 * 0.45;                  // 반 넘게 남는다
              for (let i9 = 0; i9 < 5; i9 += 1) {
                const an9 = i9 * 2.399 + 0.7;               // 황금각
                /* 몸 한가운데부터 테두리 밖 한 뼘까지 — 몇은 걸치고 몇은 흘러내린 꼴이
                   돼야 '묻었다'로 읽힌다(다 안에 들면 몸의 무늬가 된다). */
                const rr9 = r0 * (0.35 + 0.5 * (((i9 * 7) % 5) / 5));
                const bx9 = x0 + Math.cos(an9) * rr9;
                const by9 = y0 + Math.sin(an9) * rr9 * 0.62;
                const br9 = Math.max(0.7, r0 * 0.4 * pop9 * (0.72 + 0.28 * (((i9 * 3) % 4) / 4)));
                const gg9 = ctx.createRadialGradient(bx9, by9, 0, bx9, by9, br9);
                gg9.addColorStop(0, "rgba(238,210,255,0.95)");
                gg9.addColorStop(0.45, "rgba(180,110,240,0.75)");
                gg9.addColorStop(1, "rgba(110,50,170,0)");
                ctx.globalAlpha = fade9;
                ctx.fillStyle = gg9;
                ctx.beginPath();
                ctx.arc(bx9, by9, br9, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.globalAlpha = 1;
              continue;
            }
            if (f.style === "heal") {
              // 메딕 — 길이 없는 노란 불빛(scr-tracer-heal + scr-heal-glow 박동).
              const pulse9 = 0.15 + Math.sin(p9 * Math.PI) * 0.85;
              const r9 = 0.7 * tz9 * (0.7 + Math.sin(p9 * Math.PI) * 0.4);
              const g9 = ctx.createRadialGradient(x0, y0, 0, x0, y0, r9);
              g9.addColorStop(0, "rgba(255,250,214,0.98)");
              g9.addColorStop(0.72, "rgba(252,238,150,0.5)");
              g9.addColorStop(0.8, "rgba(252,238,150,0)");
              ctx.globalAlpha = pulse9;
              ctx.fillStyle = g9;
              ctx.beginPath();
              ctx.arc(x0, y0, r9, 0, Math.PI * 2);
              ctx.fill();
              continue;
            }
            a9 = envBeam(p9);
            if (a9 <= 0.02) continue;
            /* 제자리 번쩍임 — 제 길이만큼 앞으로 뻗되 표적을 안 넘는다.
               span 갈래(아콘 지지기)만 표적까지 늘린다 — 표적 거리가 안 실려 온
               자리(reach가 무한)에서는 제 길이로 물러난다. */
            /* ★ span은 **늘이는 쪽으로만** 쓴다(지적: "아콘 지지기 안 보이는데") —
               앞판은 길이를 reach로 **갈아 끼웠는데**, 아콘은 사거리가 2타일이고 몸이
               큰(32×32) 유닛이라 붙어 싸울 때 총구~표적의 화면 거리가 거의 0이다.
               그러면 갈아 끼운 길이도 0이 되어 **전보다 더 안 보인다**. 늘이려던 것이
               지우는 짓이 됐다. 제 길이를 바닥으로 깔고 표적이 멀면 거기까지 뻗는다. */
            headD9 = st.span && Number.isFinite(reach9)
              ? Math.max(reach9, tailL9) : Math.min(tailL9, reach9);
            /* ★ 표적 그림은 **줄기 끝에**(요청: "아콘 공격 트레이서의 스플래시 효과는 공격줄기
               끝으로 고정") — 엔진이 표적 자리에 따로 얹던 hit op를 걷고, 줄기가 실제로
               끝나는 점(headD9)에 같은 그림(FX_IMPACT·같은 자·같은 박자)을 그린다. 붙어
               싸워 줄기가 제 길이(tailL9)로 물러나도 둘이 안 갈린다. */
            const im9 = f.splash && f.size !== undefined && f.style ? FX_IMPACT[f.style] : undefined;
            if (im9) {
              const tipX9 = x0 + dxx * headD9;
              const tipY9 = y0 + dyy * headD9;
              const ir9 = (f.size! / 2) * zoom * HIT_FX_K * im9.r * (0.7 + p9 * 0.5);
              const fl9 = im9.flat ?? 1;
              const keepA9 = ctx.globalAlpha;
              ctx.globalAlpha = envHit(p9);
              if (fl9 !== 1) { ctx.translate(tipX9, tipY9); ctx.scale(1, fl9); ctx.translate(-tipX9, -tipY9); }
              const gi9 = ctx.createRadialGradient(tipX9, tipY9, 0, tipX9, tipY9, ir9);
              for (const [o9, c9] of im9.g) gi9.addColorStop(o9, c9);
              ctx.fillStyle = gi9;
              ctx.beginPath();
              ctx.arc(tipX9, tipY9, ir9, 0, Math.PI * 2);
              ctx.fill();
              if (fl9 !== 1) { ctx.translate(tipX9, tipY9); ctx.scale(1, 1 / fl9); ctx.translate(-tipX9, -tipY9); }
              ctx.globalAlpha = keepA9;
            }
          } else if (f.kind === "shot") {
            // 날아가는 탄 — 머리가 총구에서 진행률만큼 나가 있고, 표적에서 멈춘다.
            /* ★ **화면 거리가 무너져도 탄은 난다**(지적: "골리앗이 대공공격에서 트레이서가
               안 나감(미사일)" — 포탑은 표적을 향해 돌고 있으니 표적은 잡힌 것이다) ──────
               여기 있던 셈은 화면 거리(reach9)에 진행률을 곱한 것뿐이라, 그 거리가 0에
               가까우면 머리도 0이 되고 아래 `headD9 - tailD9 < 0.25`에서 통째로 버려진다.
               공중 표적에서 그 거리가 실제로 무너진다 — beamLen이 조준 높이(foeLift9)를
               빼서 내는 값이라, 사수가 나는 몸 **바로 밑**에 서면 세로가 상쇄된다.
               ★ 이 함정은 **바로 위 span 갈래가 이미 겪고 적어 둔 것**이다("붙어 싸울 때
                 총구~표적의 화면 거리가 거의 0이다 … 늘이려던 것이 지우는 짓이 됐다.
                 제 길이를 바닥으로 깔고"). 그때 beam만 고치고 shot은 그대로 뒀다.
                 앞서 같은 지적으로 **날아가는 시각**(shotU)은 지도 위 거리로 옮겼는데,
                 **그려지는 길이**는 여전히 화면 거리에 매여 있었다 — 반만 고친 셈이다.
               같은 약을 쓴다: 갈래 제 길이를 바닥으로 깔고, 표적이 멀면 거기까지 뻗는다.
               붙어 있을 때 제 길이만큼 넘칠 수는 있지만, 안 보이는 것보다 낫다. */
            /* ★ 물러난 길이는 **길에도 실린다**(위 runD9) — 머리만 물러나면 연기가
               표적 점에 포개진다. 둘은 한 자를 써야 한다. */
            /* ★ **표적을 지나치지 않는다**(지적: "미사일 트레이서 길이가 짧게 못 그리나
               타겟을 지나쳐서 멀리까지 나감") ────────────────────────────────────────
               여기 있던 바닥(`tailL9 × 0.6`)은 갈래표의 잔상 길이 l에 매여 있었다. 그
               바닥은 '화면 거리가 무너지는 자리'(땅에 선 골리앗이 바로 머리 위의 것을 쏠
               때)를 위한 것인데, 미사일의 l을 연기 자취 길이로 쓰면서 5.2 → 24로 키우자
               바닥도 3.1 → 14.4로 함께 커졌다 — 곧 **모든** 사격이 표적을 그만큼 지나쳐
               날았다.
               바닥은 무너진 자리에만 쓴다: 표적이 제 거리를 갖고 있으면(2px 넘게) 길이를
               그 거리로 못 박아 머리가 표적에 정확히 선다. 정말 겹쳐 선 자리에서만 옛
               바닥으로 물러나 짧은 토막이라도 보이게 한다. */
            runD9 = Number.isFinite(reach9)
              ? (reach9 > 2 * zoom ? reach9 : Math.max(reach9, tailL9 * 0.6))
              : tailL9;
            headD9 = runD9 * Math.min(1, Math.max(0, f.u ?? 0));
          } else if (f.kind === "erupt") {
            /* 성큰 가시(scr-spike-erupt의 캔버스 판) — 표적 발밑에서 **화면 수직으로**
               솟는다. u가 혓바닥 시계의 솟음 몫(sin 마루)이라 자람·꺼짐이 거기 실려 온다. */
            const hgt = (f.len ?? 4) * (f.u ?? 1) * zoom;
            if (hgt < 0.5) continue;
            /* ★ 밑변도 함께 자란다(지적: "가시 모양이 땅에서 위로 나오는 거니까 처음엔 밑변이 짧다가 다 나왔을 때
               가장 길어야") — 밑변이 고정된 채 높이만 늘면 납작한 삼각이 서서히 뾰족해지는 그림이다. 땅 위로 드러난
               몫이 곧 가시의 끝부분이므로 밑변은 솟은 몫(u)에 비례한다. 밑변 자체는 0.8배(요청). */
            const hw9 = ((f.size ?? 1) / 2) * zoom * 0.8 * Math.min(1, Math.max(0, f.u ?? 1));
            const g9 = ctx.createLinearGradient(x0, y0, x0, y0 - hgt);
            // 밝은 주황갈색(요청: "성큰 가시색이 너무 빨감") — 밑동 #8a3c0c → #b5642a, 끝 #e8732a → #f0a050.
            g9.addColorStop(0, "#b5642a");
            g9.addColorStop(1, "#f0a050");
            ctx.globalAlpha = 1;
            ctx.fillStyle = g9;
            /* 밑변은 **호**다(지적: "가시가 원래는 입체라 밑변의 모양도 호여야") — 원뿔을 위에서 비껴 보면 밑동
               단면이 타원의 아래 반호로 보인다. 지면 눌림(2D 2:1 관례·3D 30도 눌림 0.5)으로 세로 반지름을 잡는다. */
            ctx.beginPath();
            ctx.moveTo(x0, y0 - hgt);
            ctx.lineTo(x0 + hw9, y0);
            ctx.ellipse(x0, y0, hw9, hw9 * 0.5, 0, 0, Math.PI);
            ctx.closePath();
            ctx.fill();
            continue;
          } else {
            /* 럴커 가시(지적: "길게 나가는게 아니라 성큰같은게 다다다 간격두고
               올라와야함") — 한 줄기가 표적 쪽으로 쭉 자라던 것을 걷는다. 이제
               **가시 낱개가 간격을 두고 차례로 솟았다 지는** 연쇄다. 낱개는 땅에서
               위로 솟으므로 화면 세로로 세운다(진행 방향으로 눕히면 다시 한 줄로
               읽힌다). 앞뒤 간격과 솟는 창(W9)이 겹치지 않아 '다다다'가 된다. */
            const L0 = f.len !== undefined ? f.len * zoom : st.l * tz9;
            /* ★ 앞 가시가 **들어가기 시작한 뒤** 다음이 솟는다(지적: "나오는 타이밍은
               이전 가시가 나오고 다시 들어가기 시작한 후 다음게 나옴") ──────────────
               낱개는 sin(πq)로 솟았다 지므로 q 0.5가 꼭대기, 그 뒤가 들어가는 구간이다.
               앞뒤 간격은 (1−W)/N이고 낱개의 창은 W이니, 둘의 비가 곧 '앞 것이 몇 %쯤
               갔을 때 다음이 나오나'다. 여태 9개·0.26이라 그 비가 0.32 — 앞 가시가 아직
               **오르는 중**에 다음이 튀어나와 여러 개가 동시에 서 있는 그림이었다.
               7개·0.20이면 0.57이라 꼭대기를 지나 내려가기 시작한 뒤에 다음이 솟는다.
               훑는 길이(len)는 안 건드린다 — 그건 늘 최대 사거리다. */
            const N9 = 7;
            const W9 = 0.28;   // 0.2 → 0.14 → 0.28(재지적: "너무 빨리 나오고 사라지는듯") — 낱개가 솟았다 지는 창
            const hw9 = (st.w / 2) * tz9 * 0.85 * 1.2 * 1.2;   // ×1.2(요청: 럴커 가시 크기 1.2배) → 다시 ×1.2(재요청)
            // 높이 2.6 → 3.6 → 5.4(요청: "길이 1.5배 증가") — 땅에서 솟는 뼈라
            // 낮으면 얼룩으로 읽힌다.
            const HH9 = 4.05 * tz9 * 1.2 * 1.2;   // 5.4 → 4.05(요청: 가시 길이 25% 축소) → ×1.2(재요청) → ×1.2(재재요청)
            /* ★ 낱개의 곡선을 **빨리 솟아 오래 서 있다 빨리 지는** 꼴로(요청: "한 가시의 사이클 시간 줄이고
               나오는 간격은 그대로, 최대 길이로 멈춰 있는 시간 늘리기") ─────────────────────────────
               여태 sin(πq)라 창(W9) 내내 오르내리기만 하고 꼭대기에 서 있는 순간이 없었다 — 가시가 '박히는'
               느낌이 없다. 창 길이(W9)와 앞뒤 간격((1−W9)/N9)은 그대로 두고 그 안의 배분만 바꾼다:
               첫 22%에 솟고(smoothstep), 50%를 꼭대기에 서 있다가, 마지막 28%에 진다. 오르내림이 짧아지니
               '사이클'은 빨라 보이고, 멈춤이 길어 가시가 땅에 박혀 있는 시간이 는다. */
            const env9 = (q: number): number => {
              if (q < 0.22) { const u = q / 0.22; return u * u * (3 - 2 * u); }
              if (q > 0.72) { const u = (1 - q) / 0.28; return u * u * (3 - 2 * u); }
              return 1;
            };
            for (let i9 = 0; i9 < N9; i9 += 1) {
              const q9 = (p9 - (i9 / N9) * (1 - W9)) / W9;
              if (q9 <= 0 || q9 >= 1) continue;
              const gz9 = env9(q9);
              const d9 = (L0 * (i9 + 0.5)) / N9;
              const sx9 = x0 + dxx * d9;
              const sy9 = y0 + dyy * d9;
              const gg9 = ctx.createLinearGradient(sx9, sy9, sx9, sy9 - HH9 * gz9);
              for (const [o9, c9] of st.g) gg9.addColorStop(o9, c9);
              ctx.globalAlpha = 1;
              ctx.fillStyle = gg9;
              ctx.beginPath();
              // 밑변도 솟은 몫(gz9)만큼 — 성큰 가시와 같은 까닭(땅에서 드러난 몫이 끝부분이라 밑변은 끝에 가서야 최대).
              // 밑변은 호(입체 원뿔의 밑동 단면 — 성큰 가시와 같은 규약).
              const bw9 = hw9 * gz9;
              ctx.moveTo(sx9, sy9 - HH9 * gz9);
              ctx.lineTo(sx9 + bw9, sy9);
              ctx.ellipse(sx9, sy9, bw9, bw9 * 0.5, 0, 0, Math.PI);
              ctx.closePath();
              ctx.fill();
            }
            continue;
          }
          /* 꼬리는 총구 뒤로 못 간다 — 갓 쏜 탄은 잔상이 짧다가 나아가며 자란다.
             총구가 밝은 갈래(화염)는 꼬리가 늘 총구에 붙어 있다. */
          /* ★ **연기 자취는 총구에 붙는다**(지적: "포탄이 목표한테까지 가는 긴 형태가 아니고
     자기 앞에만 나오네.. 광자포처럼 목표까지 이어져야해~") ────────────────────────────
     날아가는 탄의 잔상은 갈래표의 l(미사일 5.2렌즈px)만큼만 뒤로 남는다. 총알·구슬은
     그것이 맞다 — 잔상은 눈에 남는 몫이지 물체가 아니다. 그런데 **미사일은 연기를
     뿜으며 난다**: 그 연기는 사라지지 않고 총구부터 지금 자리까지 통째로 남는다. 그것이
     원작에서 발키리·터렛의 미사일이 화면에 그리는 선이고, 사용자가 "광자포처럼 목표까지
     이어져야" 한다고 말한 그 선이다.
     그래서 자취 갈래(trail)는 꼬리를 **총구에 못 박는다** — 머리가 나아가는 동안 선이
     자라고, 표적에 닿는 순간 총구에서 표적까지 한 줄로 이어진다. */
  /* ★ span 갈래는 **꼬리도 총구에 붙는다**(지적: 빨갛게 키워도 아무것도 없다 · 진단:
     아콘선 ×4 — 밀고는 있었다) ────────────────────────────────────────────────────
     여기 있던 셈은 '꼬리는 머리 뒤 l만큼'이다. 총알·구슬에는 맞다(잔상은 눈에 남는 몫이라
     제 길이가 있다). 그런데 span은 **머리만** 표적까지 보내 놓았으므로, 꼬리가 그 뒤
     l만큼을 따라가면 실제로 그어지는 것은 늘 l짜리 토막이고 그마저 아콘이 아니라
     **표적 옆**에 뜬다 — 배율 3에서 7px짜리 점이라, 120px짜리 구 옆에서 안 보인다.
     '두 몸 사이에 걸린 번개'는 꼬리가 총구에 못 박혀야 나온다 — 연기 자취(trail)가
     같은 까닭으로 이미 그렇게 하고 있다. */
  const tailD9 = st.muzzleLit || st.span || (st.trail && f.kind === "shot")
    ? 0 : Math.max(0, headD9 - tailL9);
          if (headD9 - tailD9 < 0.25) continue;
          /** 그러데이션 0쪽 = 밝은 끝 — 날아가는 것은 머리, 뿜는 것은 총구. */
          const [lx9, ly9, dx9, dy9] = st.muzzleLit
            ? [x0 + dxx * tailD9, y0 + dyy * tailD9, x0 + dxx * headD9, y0 + dyy * headD9]
            : [x0 + dxx * headD9, y0 + dyy * headD9, x0 + dxx * tailD9, y0 + dyy * tailD9];
          const g9 = ctx.createLinearGradient(lx9, ly9, dx9, dy9);
          for (const [o9, c9] of st.g) g9.addColorStop(o9, c9);
          ctx.globalAlpha = a9;
          /* ★ 미사일 연기는 **동그란 덩이가 늘어선 것**이다(지적: "연기가 그냥 긴 흰 띠가
             아니라 진행 방향을 따라 동그라미 연기가 늘어서는 모양") ─────────────────────
             한 줄 획으로 그으면 굵기가 어디서나 같고 가장자리가 매끈해, 연기가 아니라
             **띠**로 읽힌다(원작 화면에서 이 자취는 덩이 여럿이 줄지어 선 꼴이다).
             실제 로켓 자취는 뿜은 자리마다 덩이가 하나씩 남고, 그 덩이가 시간이 갈수록
             **부풀며 옅어진다** — 그래서 총구 쪽(오래된 것)이 굵고 흐리며 머리 쪽(갓 뿜은
             것)이 작고 짙다. 그 나이를 셈으로 낼 수 있다: 총구에서 d만큼 떨어진 자리의
             연기는 **머리가 거기 있었을 때** 뿜은 것이므로 나이가 (머리 자리 − d)에 비례한다.
             덩이 사이는 굵기에 매어 둔다 — px으로 못 박으면 배율이 바뀔 때 덩이가 떨어졌다
             붙었다 한다. 옆으로 아주 조금 흔든다(반지름의 1/5): 자로 잰 듯 일직선이면
             연기가 아니라 점선으로 읽힌다.
             머리는 따로 그린다 — 연기와 달리 그쪽은 불꽃이라 갈래표의 그러데이션 그대로
             짧은 획 한 번이다. */
          if (st.puff) {
            /* ★ **연기는 탄두 뒤에서 난다**(지적: "탄두에도 연기가 겹쳐지는데 연기는 탄두
               뒤쪽에 따라 나오는 거야") — 여태 덩이를 tailD9~headD9로 깔았는데 머리(headD9)
               가 곧 탄두의 코라, 마지막 덩이 몇이 탄두 위에 그대로 겹쳤다. 로켓의 연기는
               노즐에서 나오므로 **탄두 길이만큼 뒤**에서 시작해야 한다.
               탄두 길이(bodyL9)를 먼저 재고 덩이의 끝을 거기까지로 죈다. */
            const bodyL9 = Math.min(Math.max(0, headD9 - tailD9), st.w * tz9 * 9);
            const smokeEnd9 = st.warhead ? headD9 - bodyL9 : headD9;
            const span9 = Math.max(0, smokeEnd9 - tailD9);
            /* ★ 간격의 바닥을 2 → 0.9px로(재요청: "더 자주 나오게") — 덩이를 4분의 1로
               줄이자 이 바닥이 실제 간격을 지배해, 지름 1.5px짜리 덩이가 2px씩 떨어져
               점선으로 보였다. 바닥은 '한 프레임에 덩이가 수백 개 서지 않게' 막는 안전값
               이므로(위 n9의 상한 30이 그 몫을 다시 받는다) 덩이 지름 아래로 내려도 된다. */
            const step9 = Math.max(1.0, st.w * tz9 * st.puff);
            const n9 = Math.min(30, Math.max(2, Math.round(span9 / step9)));
            /* ★ 미사일은 **휘어 날아간다**(지적: "목표물을 따라 휘는 유도 성질 있음") ────
               앞판은 총구에서 표적까지 곧은 선이었다. 유도탄의 자취가 곧을 리 없다 —
               쏘고 나서 표적 쪽으로 틀기 때문에 연기가 활처럼 굽는다. 그 굽이가 이 무기를
               총알과 가르는 결이라, 곧게 두면 '느린 총알'로 읽힌다.
               길은 **총구 → 표적**의 2차 베지에다: 가운데 조종점을 옆으로 밀면 그 한 번의
               굽이가 곧 '틀었다'가 된다. 굽이의 쪽은 **겨눈 각**에서 뽑는다 — 한 발 안에서는
               각이 안 변하므로 날아가는 동안 굽이가 안 뒤집히고(프레임마다 난수를 뽑으면
               자취가 통째로 펄럭인다), 발마다 각이 다르니 두 발이 같은 활을 안 그린다.
               표적까지의 거리를 모르는 자리(len이 안 실려 온 옛 자료)에서는 곧은 선으로
               물러난다 — 조종점을 놓을 자리가 없기 때문이다. */
            /* 길이는 **그어지는 길의 것**(runD9)이다 — 화면 거리가 무너진 자리에서
               reach9로 매개하면 덩이가 전부 표적 점에 포개진다(위 runD9의 ★). */
            /* ★ 굽이는 **발사 각과 지금 각의 차이**다(요청: "미사일이 나가고 나서 움직이기
               시작했어도 유도탄으로 따라가긴 해야 해 … 가만히 있는데도 처음부터 휘어서
               간다는 게 문제") — 앞 판은 난수 쪽으로 늘 활을 그렸다. 이제 조종점을 **발사
               때 겨눈 방향**(d0)으로 반쯤 나간 자리에 두면: 표적이 그대로면 d0 = deg라
               조종점이 직선 위에 놓여 곧게 가고, 표적이 옮겨 갔으면 출발은 옛 방향, 끝은
               새 자리라 그 사이가 저절로 굽는다 — 그것이 유도다. */
            const rad0 = f.d0 !== undefined ? (f.d0 * Math.PI) / 180 : rad9;
            const dx0 = -Math.sin(rad0);
            const dy0 = Math.cos(rad0);
            const guided9 = Number.isFinite(runD9) && runD9 > 0
              && Math.abs(dx0 - dxx) + Math.abs(dy0 - dyy) > 1e-4;
            const bow9 = guided9 ? 1 : 0;
            const cx0 = x0 + dx0 * (runD9 / 2);
            const cy0 = y0 + dy0 * (runD9 / 2);
            const tx0 = x0 + dxx * runD9;
            const ty0 = y0 + dyy * runD9;
            /** 자취 위의 한 점 — d는 총구에서의 **직선 거리**(굽은 길의 매개변수로 쓴다). */
            const at9 = (d9: number): [number, number] => {
              if (bow9 === 0) return [x0 + dxx * d9, y0 + dyy * d9];
              const t9 = Math.max(0, Math.min(1, d9 / runD9));
              const u9 = 1 - t9;
              return [
                u9 * u9 * x0 + 2 * u9 * t9 * cx0 + t9 * t9 * tx0,
                u9 * u9 * y0 + 2 * u9 * t9 * cy0 + t9 * t9 * ty0,
              ];
            };
            const core9 = st.smoke ?? "#ffffff";
            const edge9 = st.smokeEdge ?? core9;
            for (let i9 = 0; i9 <= n9; i9 += 1) {
              const d9 = tailD9 + (span9 * i9) / n9;   // 탄두 뒤(smokeEnd9)까지만 깔린다
              // 0 머리(갓 뿜음) ~ 1 총구(가장 오래됨).
              const age9 = span9 <= 0 ? 0 : 1 - (d9 - tailD9) / span9;
              /* ★ 크기는 **앞뒤가 같다**(지적: "크기는 앞이나 뒤나 일정한데 살짝 변동은
                 있음(랜덤)") — 앞판은 나이에 따라 부풀렸는데, 그러면 자취가 총구 쪽으로
                 벌어지는 원뿔이 되어 '연기 기둥'으로 읽힌다. 원작의 자취는 같은 크기의
                 덩이가 줄지어 선 것이고, 흔들리는 것은 크기가 아니라 **낱개의 들쭉날쭉**이다.
                 그 흔들림은 **자리에 매인 난수**여야 한다 — 프레임마다 새로 뽑으면 같은
                 덩이가 매 프레임 커졌다 작아져 자취가 통째로 끓는다. 마디 번호를 씨앗으로
                 쓰면 그 덩이는 언제 봐도 같은 크기다. */
              const rnd9 = Math.sin(i9 * 127.1 + 311.7) * 43758.5453;
              const jit9 = (rnd9 - Math.floor(rnd9)) * 2 - 1;          // −1~1
              /* 지름 네 배(지적: "미사일류 트레이서 원이 너무 작아") — 0.95 → 3.8.
                 ★ 간격도 **같이** 네 배여야 한다(갈래표의 puff 3 → 12). 반지름만 키우면
                   덩이가 서로 파묻혀 도로 한 줄기 띠가 된다 — 이 자취를 덩이로 바꾼 까닭
                   자체가 사라지는 셈이다. 간격과 지름은 늘 한 쌍으로 움직인다. */
              const r9 = st.w * tz9 * (3.8 + 0.6 * jit9);   // 타일 자(폰 보정, 핵탄두와 같은 지적)
              const off9 = Math.sin(i9 * 1.9) * r9 * 0.22;
              const [bx9, by9] = at9(d9);
              const cx9 = bx9 - dyy * off9;
              const cy9 = by9 + dxx * off9;
              /* ★ 속은 희고 테는 연한 하늘빛이다(지적) — 한 색으로 채우면 종잇조각 원이라
                 연기가 안 된다. 방사 그러데이션이면 낱개가 저마다 부피를 갖고, 겹칠 때
                 테끼리 섞여 뭉게뭉게한 결이 난다. */
              const rg9 = ctx.createRadialGradient(cx9, cy9, 0, cx9, cy9, r9);
              rg9.addColorStop(0, core9);
              /* 흰 속을 절반까지 꽉 채우고 바깥 절반에서만 하늘빛으로 넘어간다 —
                 이 크기(반지름 몇 px)에서는 완만하게 섞으면 테가 안 남고 통째로
                 옅은 회색 원이 된다(첫 판이 그랬다). 테는 좁고 또렷해야 보인다. */
              rg9.addColorStop(0.62, core9);
              rg9.addColorStop(0.88, edge9);
              rg9.addColorStop(1, edge9);
              ctx.fillStyle = rg9;
              /* 옅어지는 몫만 나이를 탄다 — 총구 쪽이 먼저 사그라들어야 자취가 끝난다.
                 ★ 짙기를 0.72 → 0.94로(지적: "더 하얀색이어야 할 듯") — 반투명한 흰색은
                   어두운 지도 위에서 곧 회색이다. 흰 연기로 읽히려면 바닥이 안 비쳐야 한다.
                   흰 속이 차지하는 몫도 반 → 0.62로 넓혀, 하늘빛은 가장자리 한 테로만 남긴다. */
              ctx.globalAlpha = a9 * 0.94 * (1 - age9 * (st.smokeFade ?? 0.45));
              ctx.beginPath();
              ctx.arc(cx9, cy9, r9, 0, Math.PI * 2);
              ctx.fill();
            }
            /* ★ 앞에 **미사일 몸이 선다**(지적: "미사일 트레이서의 연기만 있고 앞에
               미사일이 없어서 어색함") ────────────────────────────────────────────────
               여태 머리는 갈래표의 그러데이션으로 그은 획 하나뿐이었다. 그 값으로 재 보면
               길이 w×7 = 3.5·굵기 w×1 = 0.5(배율 1 기준)인데, 연기 덩이는 반지름이
               w×3.8이라 **지름이 7.6**이다. 곧 머리는 덩이 하나보다도 짧고 그 7분의 1
               굵기라, 흰 덩이 줄에 통째로 파묻혔다 — 남는 그림이 '연기뿐'인 까닭이다.
               (앞서 덩이를 네 배로 키우면서 머리도 함께 키웠어야 했는데 획만 조금 늘렸다.)
               세 겹으로 나눈다. 뒤에서부터:
                 ① 배기 불꽃 — 갈래표 그러데이션 그대로, 몸 뒤로 뻗는다(옛 획의 몫).
                 ② 몸통 — **불투명한** 흰 캡슐. 연기와 갈리는 것은 크기가 아니라 '속이
                   비치지 않는다'는 점이다: 반투명하면 아무리 키워도 연기의 일부로 읽힌다.
                 ③ 코 — 몸통 끝의 작은 밝은 점. 어느 쪽이 앞인지를 한 점이 말한다.
               셋 다 굽은 길(at9) 위에 얹어 유도 곡선을 그대로 탄다. */
            const flameL9 = Math.min(Math.max(0, headD9 - tailD9), st.w * zoom * 20);
            if (flameL9 > 0.5) {
              const [ex9, ey9] = at9(headD9);
              const [fx9, fy9] = at9(headD9 - flameL9);
              const hg9 = ctx.createLinearGradient(ex9, ey9, fx9, fy9);
              for (const [o9, c9] of st.g) hg9.addColorStop(o9, c9);
              ctx.globalAlpha = a9;
              ctx.strokeStyle = hg9;
              ctx.lineWidth = Math.max(0.6, st.w * tz9 * 1.6);
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(ex9, ey9);
              ctx.lineTo(fx9, fy9);
              ctx.stroke();
            }
            /* ★ **삼각 탄두**(요청) — 코가 진행 방향, 밑변이 뒤다. 여태 이 자리는 흰
               캡슐 획 + 코 점이었는데, 둥근 캡슐은 연기 덩이와 같은 결이라 자취에 묻혔다.
               삼각은 연기(원)와 **모양이 다르다** — 그 다름 하나가 '탄두가 앞에 있다'를
               말한다. 굽은 길(at9) 위의 두 점으로 축을 뽑으므로 유도 곡선을 그대로 탄다.
               ★ 방향(지적: "탄두 삼각형 방향 반대로됐음") — 코를 머리(headD9)에 둔다.
                 일반 tri 갈래는 밑변이 밝은 끝(머리)이고 꼭짓점이 꼬리라 정확히 반대다.
                 그 갈래는 혜성 잔상의 꼴이라 그대로 두고, 탄두는 여기서 따로 그린다. */
            if (bodyL9 > 0.5 && st.warhead) {
              const [ex9, ey9] = at9(headD9);
              const [bx8, by8] = at9(headD9 - bodyL9);
              const vx8 = ex9 - bx8;
              const vy8 = ey9 - by8;
              const vl8 = Math.hypot(vx8, vy8) || 1;
              const hw8 = Math.max(1, st.w * zoom * 1.9);
              ctx.globalAlpha = a9;
              ctx.fillStyle = st.warhead;
              ctx.beginPath();
              ctx.moveTo(ex9, ey9);
              ctx.lineTo(bx8 - (vy8 / vl8) * hw8, by8 + (vx8 / vl8) * hw8);
              ctx.lineTo(bx8 + (vy8 / vl8) * hw8, by8 - (vx8 / vl8) * hw8);
              ctx.closePath();
              /* 테두리 획은 안 두른다(요청: "면 전체를 은/금색으로") — 짙은 테를 두르면
                 이 크기에서 탄두가 통째로 그 테 색이 되어 금속색이 안 남는다. */
              ctx.fill();
            } else if (bodyL9 > 0.5) {
              const [ex9, ey9] = at9(headD9);
              const [bx8, by8] = at9(headD9 - bodyL9);
              /* 속이 안 비치게 — 흰 몸에 옅은 하늘빛 테(연기와 같은 색 결이라 따로 놀지
                 않으면서도, 불투명해서 덩이 위로 또렷이 뜬다). */
              ctx.globalAlpha = a9;
              ctx.strokeStyle = st.smokeEdge ?? "#a8d4ff";
              ctx.lineWidth = Math.max(1.4, st.w * tz9 * 3.4);
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(ex9, ey9);
              ctx.lineTo(bx8, by8);
              ctx.stroke();
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = Math.max(0.9, st.w * tz9 * 2.2);
              ctx.beginPath();
              ctx.moveTo(ex9, ey9);
              ctx.lineTo(bx8, by8);
              ctx.stroke();
              // 코 — 앞을 가리키는 한 점.
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(ex9, ey9, Math.max(0.8, st.w * tz9 * 1.5), 0, Math.PI * 2);
              ctx.fill();
            }
            continue;
          }
          if (st.tri) {
            /* 쐐기(글레이브·파편) — 밑변이 **밝은 끝**, 꼭짓점이 사그라드는 끝이다.
               날아가는 것은 넓은 머리가 앞서고 꼬리로 갈수록 뾰족해진다(혜성 꼴). */
            /* ★ 표창(요청: 뮤탈·벌처 쐐기를 정삼각형에서 각 변을 삼각형으로 판 표창으로 · 뾰족한 쪽이 적을 향하게) ────
               세 꼭짓점의 별이다: 앞 꼭짓점이 머리(lx9·ly9, 나는 방향 dxx·dyy)이고 뒤 두 꼭짓점이 ±120도. 변마다
               가운데를 중심 쪽으로 파(반지름 0.35R) 세 날이 선다. 반폭(st.w/2)이 뒤 날의 벌어짐(0.866R)이다. */
            /* 별의 자는 **타일 자**(tz9)다(지적: "뮤탈 글레이브 크기도 배율 안 먹는듯?") — 여기만 zoom을
               곧장 곱해 폰(타일 3px)에서 유닛 대비 두 배 반으로 크고, PC에서는 몸에 비해 작았다. 다른
               줄기와 같은 자로 옮기고 갈래표의 굵기(glave.w)를 원작 비(타일의 4분의 1)에 맞춘다. */
            const hw9 = (st.w / 2) * tz9;
            const R9 = hw9 / 0.866;
            const r9 = R9 * 0.35;
            const cx9 = lx9 - dxx * R9;
            const cy9 = ly9 - dyy * R9;
            const px9 = -dyy;                      // 수직(왼쪽)
            const py9 = dxx;
            const pt9 = (a9: number, b9: number): [number, number] => [cx9 + dxx * a9 + px9 * b9, cy9 + dyy * a9 + py9 * b9];
            const T0 = pt9(R9, 0);
            const N01 = pt9(0.5 * r9, 0.866 * r9);
            const T1 = pt9(-0.5 * R9, 0.866 * R9);
            const N12 = pt9(-r9, 0);
            const T2 = pt9(-0.5 * R9, -0.866 * R9);
            const N20 = pt9(0.5 * r9, -0.866 * r9);
            ctx.fillStyle = g9;
            ctx.beginPath();
            ctx.moveTo(T0[0], T0[1]);
            ctx.lineTo(N01[0], N01[1]);
            ctx.lineTo(T1[0], T1[1]);
            ctx.lineTo(N12[0], N12[1]);
            ctx.lineTo(T2[0], T2[1]);
            ctx.lineTo(N20[0], N20[1]);
            ctx.closePath();
            ctx.fill();
          } else {
            /* 길 하나를 두 번 긋는다(번짐 + 몸) — 꺾인 갈래는 두 획이 **같은 마디**를
               지나야 하므로 길을 여기서 한 번만 짓는다. */
            const path9 = (): void => {
              ctx.beginPath();
              ctx.moveTo(lx9, ly9);
              const n9 = st.zig ?? 0;
              if (n9 >= 2) {
                const vx9 = dx9 - lx9;
                const vy9 = dy9 - ly9;
                const len9 = Math.hypot(vx9, vy9) || 1;
                /* 튀는 폭 — 길이의 몫과 굵기의 몫 중 작은 쪽이다. 짧은 번개가 제
                   길이만큼 튀면 갈지자가 아니라 뭉치가 된다. */
                const amp9 = Math.min(len9 * 0.16, st.w * zoom * 2.4);
                // 위상을 씨앗으로 — 번쩍이는 동안 무늬가 몇 번 갈린다(위 zig 주석).
                const seed9 = Math.floor(p9 * 5);
                for (let i9 = 1; i9 < n9; i9 += 1) {
                  const q9 = i9 / n9;
                  const r9 = Math.sin((i9 * 12.9898 + seed9 * 78.233) * 43758.5453);
                  // 양 끝은 몸에 붙어야 하므로 가운데가 가장 크게 튄다(sin 봉우리).
                  const off9 = (r9 - Math.floor(r9) - 0.5) * 2 * amp9 * Math.sin(Math.PI * q9);
                  ctx.lineTo(
                    lx9 + vx9 * q9 - (vy9 / len9) * off9,
                    ly9 + vy9 * q9 + (vx9 / len9) * off9,
                  );
                }
              }
              ctx.lineTo(dx9, dy9);
            };
            if (st.glow) {
              /* 테두리도 뿌리에서 함께 사그라든다(위 fadeAt) — 몸만 흐리고 테가 남으면
                 뿌리에 푸른 고리만 동그마니 남는다. */
              ctx.strokeStyle = st.glowEnd !== undefined
                ? ((): CanvasGradient => {
                  const gw9 = ctx.createLinearGradient(lx9, ly9, dx9, dy9);
                  gw9.addColorStop(0, st.glow);
                  gw9.addColorStop(Math.max(0, Math.min(1, st.fadeAt ?? 0.72)), st.glow);
                  gw9.addColorStop(1, st.glowEnd);
                  return gw9;
                })()
                : st.glow;
              ctx.lineWidth = st.w * zoom * (st.glowW ?? 2.6);
              ctx.globalAlpha = a9 * (st.glowA ?? 0.3);
              ctx.lineCap = st.cap ?? "round";
              path9();
              ctx.stroke();
              ctx.globalAlpha = a9;
            }
            ctx.strokeStyle = g9;
            ctx.lineWidth = Math.max(0.4, st.w * zoom);
            ctx.lineCap = st.cap ?? "round";
            ctx.lineJoin = "round";
            path9();
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      /* 다 그렸다 — 캔버스에 걸려 있던 손짓 임시 변환은 **여기서** 걷는다(수리:
         "드래그나 확대 축소시 깜빡이고 배율도 튀고"). 두 일이 같은 자리에 있어야 하는
         까닭: 그린 그림에는 이미 지금 보기가 들어 있는데 변환이 남아 있으면 움직인
         몫이 **두 번** 먹혀 한 프레임 튄다. 여태 그 걷어내기를 부모의 렌즈 effect가
         했는데, 그 effect는 zoom·pan **상태**가 바뀔 때만 돈다 — 손짓 중에는 상태가
         안 바뀌므로 한 번도 안 돌았고, 그 사이 재생 틱이 낸 리렌더마다 그림이 튀었다. */
      if (cv.style.transform !== XF_ID9) { cv.style.transformOrigin = "center"; cv.style.transform = XF_ID9; }
      onPainted?.(zoom, pan);
    };
    /* 부모가 손짓 중에 쥘 붓을 넘긴다 — 렌더마다 새 ops를 문 채로 갈아 끼운다. */
    if (painter) painter.current = paint;
    /* ★ 여기서는 안 칠한다(재설계: 그리는 붓 하나) — 유닛 캔버스를 칠하는 것은 부모의 paintFnRef9뿐이다. 이 층은 붓 클로저를
       내주기만 하고, 렌더로 바뀐 것(배율·팬 거울, 사양 토글, 크기)은 부모가 렌더마다 requestPaint9로 한 장에 모은다. */
  });
  return <canvas ref={ref} className="scr-motion-unitlayer" aria-hidden />;
}

/** ★ 효과 층에 **모델을 놓는 공용 문**(요청: "앞으로 추가될 효과들도 이런 일 겪지 않게
 *  공통화 로직을 잘 만들어놔") ─────────────────────────────────────────────────────
 *  효과 층(.scr-motion-fxlens)에 3D 모델을 놓으면 반드시 두 함정을 밟는다. 스톰이 둘 다
 *  밟았고(지적: "너무 좁게 그려지고 확대 시 화질 깨짐"), 다음에 올 효과도 그럴 것이다.
 *  그래서 그 둘을 **여기서 한 번에** 막고, 새 효과는 이 문만 지나게 한다.
 *
 *  ① 창이 안 찬다 — 효과 모델은 대개 세로로 길거나(번개·화구) 납작하다(방전·파문). 여느
 *     창(16×20)에 비를 지켜 넣으면 **긴 축이 자를 잡아** 짧은 축이 절반쯤만 쓰이고, 화면
 *     에서는 "왜 이렇게 작지"로 보인다. fit이 창을 잉크 상자에 맞춰 그 손실을 없앤다.
 *  ② 확대에서 뭉갠다 — 이 층은 렌즈와 같은 변환을 진다. 웹킷은 변환이 걸린 가지를 **1배로
 *     한 번 래스터**해 두고 늘려 붙이므로, SVG가 벡터인데도 확대에서 뭉갠다(지도가 렌즈
 *     밖으로 나간 것과 같은 사정이다). 층을 옮기는 큰 수술 대신 **과표본**으로 받는다:
 *     안쪽 그림의 레이아웃 크기를 3배로 두고 3분의 1로 줄이면 래스터가 3배 크기에서
 *     일어나 세 배 촘촘한 판이 남는다. 보이는 크기는 한 톨도 안 바뀐다(CSS가 한다).
 *
 *  ※ 핵 화구(nukedome)는 이 문을 안 지난다 — 제 감싸개에 손으로 맞춘 변환·애니가 걸려
 *    있어(솟아오르며 부푸는 몫) 여기 규약과 겹친다. 그쪽을 손볼 일이 생기면 함께 옮긴다. */
/* (걷어냄) fxViewNow·fxViewSet — 재생기가 '타일의 화면 크기'를 적어 두면 FxModel이
   그 수로 배킹을 셈하던 다리다. 이제 FxModel이 **제 상자를 직접 잰다**(시트 덕에
   clientWidth가 곧 화면 px) — 수를 건네는 다리가 통째로 필요 없어졌다. */
/** 과표본 래스터 한 변의 상한(px) — 넓이는 제곱으로 늘어 이 값이 곧 메모리 예산이다.
 *  1400²×4B ≈ 7.8MB. 웹킷은 배킹 확보에 실패하면 그 층을 **통째로 안 그린다**(이 판이
 *  지도·유닛에서 이미 겪은 실패다) — 선명함보다 그리기가 먼저다. */
const FX_RASTER_CAP = 1400;
/** FxModel 래스터 캐시(수리: "스톰 이펙트시 부하") ───────────────────────────────
 *  FxModel은 스프라이트 캐시를 안 타고, spin 칸이 바뀔 때마다(스톰은 초당 12번) 판을
 *  통째로 다시 칠했다 — 771면짜리 스톰을 최대 1400² 캔버스에, 스톰마다. 실측(sprite-check
 *  --pxq 300~1200) 한 장 2.5ms이니 폰 CPU 조임 4~6배면 10~15ms × 12/s × 스톰 수다.
 *  (종류·칸·크기·요잉·피치·평면·색) 열쇠로 한 번만 굽고 되쓴다 — 열두 칸이 다 구워진
 *  뒤로는 blit 한 번이고, 같은 크기의 스톰 여럿이 같은 열두 칸을 나눠 쓴다. LRU·바이트 상한. */
const FX_RASTER_CACHE = new Map<string, HTMLCanvasElement>();
const FX_RASTER_BYTES = { n: 0 };
const FX_RASTER_MAX = DEV9.fxRasterMB * 1024 * 1024;
/** 효과 모델 한 칸을 **판으로 굽는다** — 캔버스 fx(스톰·핵)가 쓰는 문 ───────────────────────
 *  (export는 눈으로 보는 도구 몫이다 — scratchpad의 스톰·핵 대조표가 이 둘을 직접 부른다.
 *   이 파일의 SHAPE_BUILDERS·bldSpinSet을 도구가 부르는 것과 같은 규약이다.)
 *  여태 굽는 손은 FxModel 안에만 있었다. 스톰·핵을 유닛 캔버스로 들이려면 같은 손이 밖에서도
 *  필요하다(요청: "둘다 옮겨"). 열쇠·LRU·바이트 상한은 옛 자리 그대로고, 달라진 것은 **굽는
 *  자리가 곧 캐시**라는 점뿐이다 — 앞판은 제 캔버스에 칠한 뒤 한 장 더 복사했다. */
export function fxModelCv9(o9: {
  kind: string; spin?: number; flat?: boolean; pitchView?: boolean;
  viewYaw?: number; rotDeg?: number; fit?: boolean; cw: number; ch: number; color?: string;
}): HTMLCanvasElement | null {
  const { kind, spin, flat, pitchView, viewYaw } = o9;
  const rotDeg = o9.rotDeg ?? 0;
  const fit = o9.fit ?? true;
  const cw9 = Math.max(1, Math.round(o9.cw));
  const ch9 = Math.max(1, Math.round(o9.ch));
  const cur9 = o9.color ?? "#fff";
  const key9 = `${kind}|${spin ?? -1}|${flat ? 1 : 0}|${pitchView ? 1 : 0}`
    + `|${viewYaw ?? 0}|${rotDeg}|${fit ? 1 : 0}|${cw9}x${ch9}|${cur9}`;
  const hit9 = FX_RASTER_CACHE.get(key9);
  if (hit9) { FX_RASTER_CACHE.delete(key9); FX_RASTER_CACHE.set(key9, hit9); return hit9; }
  /* 면 목록은 ShapeIcon과 같은 문(resolveShapeFaces·같은 캐시)을 지난다 — 회전 칸은
     굽는 동안만 세우고 되돌린다(모듈 전역 깃발의 규약). */
  let r9: ReturnType<typeof resolveShapeFaces>;
  if (spin === undefined) {
    r9 = resolveShapeFaces(kind, rotDeg, flat, viewYaw, pitchView);
  } else {
    bldSpinSet(spin);
    r9 = resolveShapeFaces(kind, rotDeg, flat, viewYaw, pitchView);
    bldSpinSet(0);
  }
  const faces = r9.faces;
  if (!faces || faces.length === 0) return null;
  // 창 — 잉크 상자(fit·여백 2%) 또는 16-상자 그대로.
  let bx0 = 0; let by0 = 0; let bw9 = 16; let bh9 = 16;
  if (fit) {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const [d9] of faces) {
      const [a9, b9, c9, e9] = pathBox(d9);
      if (a9 < x0) x0 = a9;
      if (b9 < y0) y0 = b9;
      if (c9 > x1) x1 = c9;
      if (e9 > y1) y1 = e9;
    }
    if (x1 > x0 && y1 > y0) {
      const pad9 = Math.min(x1 - x0, y1 - y0) * 0.02;
      bx0 = x0 - pad9; by0 = y0 - pad9;
      bw9 = x1 - x0 + pad9 * 2; bh9 = y1 - y0 + pad9 * 2;
    }
  }
  const cvv9 = newCanvas9("효과");
  cvv9.width = cw9; cvv9.height = ch9;
  const c29 = cvv9.getContext("2d");
  if (!c29) return null;
  // meet — 비율 유지, 가운데(SVG의 xMidYMid meet 그대로).
  const sc9 = Math.min(cw9 / bw9, ch9 / bh9);
  c29.setTransform(sc9, 0, 0, sc9,
    (cw9 - bw9 * sc9) / 2 - bx0 * sc9, (ch9 - bh9 * sc9) / 2 - by0 * sc9);
  for (const [d9, op9, fill9] of faces) {
    c29.globalAlpha = op9;
    c29.fillStyle = fill9 ?? cur9;
    c29.fill(pathOf(d9));
  }
  FX_RASTER_CACHE.set(key9, cvv9);
  FX_RASTER_BYTES.n += cw9 * ch9 * 4;
  /* ★ **장수도** 죈다 — 웹킷에서 캔버스는 바이트만이 아니라 개수도 값이다(저마다 배킹과 합성
     자원을 든다). 48장을 넘으면 오래된 것부터 버리고 배킹을 곧장 내준다. */
  /* 장수 상한 48 → **72**(스톰·핵이 함께 캔버스로 온 값) — 스톰이 서른두 칸, 떨어지는 탄두가
     서른두 칸(22.5도)이라 둘이 겹치면 48로는 서로를 밀어내 매 칸 새로 굽는다. 바이트 상한은
     그대로라 큰 판이 많아지지는 않는다. */
  while ((FX_RASTER_BYTES.n > FX_RASTER_MAX || FX_RASTER_CACHE.size > 72) && FX_RASTER_CACHE.size > 1) {
    const [k0, v0] = FX_RASTER_CACHE.entries().next().value as [string, HTMLCanvasElement];
    if (v0 === cvv9) break;
    FX_RASTER_CACHE.delete(k0);
    FX_RASTER_BYTES.n -= v0.width * v0.height * 4;
    releaseCanvas(v0);
  }
  return cvv9;
}
/* (걷어냄) FxModel — 효과 모델을 제 캔버스에 굽고 DOM에 얹던 React 컴포넌트다. 그것을 쓰던
   자리(스톰·핵의 탄두·충격파·버섯구름)가 전부 유닛 캔버스로 옮겨 가 아무도 부르지 않는다.
   굽는 손은 위 fxModelCv9로 남았다 — 그쪽이 이 컴포넌트의 알맹이였다. */
/** 잉크 상자(도록 "최대"가 재는 그 상자) — 면 목록에 실제로 칠해진 넓이의 합집합이다.
 *  acc를 주면 거기에 더해 넓힌다(여러 컷·여러 각을 한 상자로 묶을 때). 빈 목록이면 그대로. */
type InkBox9 = { x0: number; y0: number; x1: number; y1: number };
function inkBox9(faces: ShapeFace[] | undefined, acc?: InkBox9): InkBox9 | undefined {
  let b9 = acc;
  for (const [d9] of faces ?? []) {
    const [a9, c9, e9, f9] = pathBox(d9);
    if (!b9) { b9 = { x0: a9, y0: c9, x1: e9, y1: f9 }; continue; }
    if (a9 < b9.x0) b9.x0 = a9;
    if (c9 < b9.y0) b9.y0 = c9;
    if (e9 > b9.x1) b9.x1 = e9;
    if (f9 > b9.y1) b9.y1 = f9;
  }
  return b9;
}
/** 잉크 상자 → viewBox 넉 자. 여백은 **짧은 변**의 비율이다(긴 변 기준이면 가늘고 긴
 *  모델의 짧은 쪽에만 여백이 몰린다). 기본 0.12는 도록의 값이다. */
function inkView9(b9: InkBox9 | undefined, pad?: number): string | undefined {
  if (!b9 || !(b9.x1 > b9.x0) || !(b9.y1 > b9.y0)) return undefined;
  const p9 = Math.min(b9.x1 - b9.x0, b9.y1 - b9.y0) * (pad ?? 0.12);
  return `${(b9.x0 - p9).toFixed(3)} ${(b9.y0 - p9).toFixed(3)} `
    + `${(b9.x1 - b9.x0 + p9 * 2).toFixed(3)} ${(b9.y1 - b9.y0 + p9 * 2).toFixed(3)}`;
}
/** ★ 여러 컷을 **한 창**으로(지적: "모션컷에 따라 모델 확대율이 달라짐") ───────────────
 *  ShapeIcon의 fit은 그 컷의 잉크에 창을 맞추므로, 자세가 갈리면(팔을 뻗고 다리를 벌리고)
 *  실루엣과 함께 창도 갈리고 모델이 컷마다 커졌다 작아졌다 한다. 도록의 모션 창처럼
 *  **같은 모델의 여러 컷을 나란히** 놓는 자리에서는 그 흔들림이 곧 거짓말이다.
 *  부르는 쪽이 이 함수로 컷들을 미리 훑어 한 상자를 얻고 그것을 세 칸의 fitBox로 내리면,
 *  창이 못 박혀 컷 사이에 오직 **모델의 움직임만** 남는다.
 *  면 목록은 ShapeIcon과 같은 문(resolveShapeFaces·같은 캐시)을 지나므로, 한 번 구운
 *  각·컷을 다시 훑는 것은 거의 공짜다. */
export function shapeFitBox(kind: string, opts?: {
  /** 요잉(도) — 안 주면 지도의 기본 자세(BUILDING_BASE_YAW)다. ShapeIcon과 같은 규약. */
  rotDeg?: number;
  /** 훑을 컷들 — 안 주면 여섯 컷 모두. 그 종류가 안 가진 컷은 idle과 같은 면이라 해가 없다. */
  poses?: readonly (0 | 1 | 2 | 3 | 4 | 5)[];
  flat?: boolean;
  viewYaw?: number;
  pitchView?: boolean;
  /** 여백(짧은 변 비율) — ShapeIcon의 fitPad와 같은 뜻·같은 기본값(0.12). */
  fitPad?: number;
}): string | undefined {
  const poses9 = opts?.poses ?? ([0, 1, 2, 3, 4, 5] as const);
  let box9: InkBox9 | undefined;
  for (const p9 of poses9) {
    /* 컷은 모듈 전역 깃발이라 **굽기 직전에** 세우고 끝나면 되돌린다(ShapeIcon과 같은 규약). */
    poseSet9(p9);
    const r9 = resolveShapeFaces(kind, opts?.rotDeg ?? BUILDING_BASE_YAW, opts?.flat, opts?.viewYaw, opts?.pitchView);
    poseSet9(0);
    box9 = inkBox9(r9.faces, box9);
  }
  return inkView9(box9, opts?.fitPad);
}
export function ShapeIcon({
  kind, className, faces: facesOverride, rotDeg, flat, keepRatio, viewYaw, pitchView, wide, fit, fitPad, fitBox: fitBoxProp,
  spin, pose,
}: {
  kind: string; className?: string;
  /** ★ 자세 컷(요청: 도록에서 idle·이동·액션을 보여 준다) — 0 기본 · 1·3 걸음 ·
   *  2·4·5 공격이다(POSE_* 상수와 같은 번호).
   *  ★ 왜 프롭이 필요한가 — 컷은 모듈 전역 깃발(poseNow)이라 굽기 **직전에** 세우고
   *    끝나면 되돌려야 한다(안 되돌리면 다음에 굽는 남의 모델까지 그 컷으로 굽힌다).
   *    밖에서 poseSet을 부르면 리액트의 그리는 차례와 그 창을 맞출 길이 없다 — 여기
   *    안에서 spin과 **같은 규약**으로 감싼다. */
  pose?: 0 | 1 | 2 | 3 | 4 | 5;
  /** 회전 칸(요청: 스톰을 모델로) — 도는 부품을 가진 종류(SPIN_KINDS)의 변종 번호다.
   *  스톰은 이 값이 **번개 무늬의 씨앗**이라, 칸이 바뀌면 무늬가 통째로 갈린다.
   *  굽기 열쇠(spinTag)가 이 값을 물므로 같은 칸은 늘 같은 그림이다. */
  spin?: number;
  /** 뷰어의 요잉 회전(요청) — withYaw로 다시 투영한 면 목록을 그대로 그린다. */
  faces?: ShapeFace[];
  /** 이동 방향 회전(요청: 유닛 마커도 방향) — 시계방향 도. */
  rotDeg?: number;
  /** 위에서 본 판(요청) — 입체 보기가 아닐 때의 지도 마커가 켠다. */
  flat?: boolean;
  /** 원본 비율 유지(요청: 자료실에서 보는 비율 그대로 — 캔버스에 맞춰 늘리기 금지). */
  keepRatio?: boolean;
  /** 좌우 시점(지적: 입체 보기 시점이 정면 고정) — 카메라가 비껴 본 각(도). */
  viewYaw?: number;
  /** 입체 보기 판(지적: 모델이 맵하고 안 맞음) — 맵과 같은 45도 각으로 굽는다. */
  pitchView?: boolean;
  /** 넓은 창(도록 전용) — 16-상자 밖까지 보여 준다(지적: "스파이어, 파일런 등이 안나옴").
   *  건물 정규화는 잉크를 상자의 1.2~2.8배까지 채우고(파일런 1.88·고치 2.84) 스파이어는
   *  키가 상자를 훌쩍 넘는다. 지도는 그 넘침이 제 모습이지만 도록은 **모델 전체**를
   *  봐야 하므로, 창을 사방으로 한 상자씩 넓혀 32-상자로 본다. */
  wide?: boolean;
  /** 잉크에 창을 맞춘다(도록의 "크기: 최대" — 요청: "최대는 진짜 최대야, 각 유닛을
   *  그리드에 패딩만 빼고 최대로 채우기"). 정규화(MODEL_NORM·BLD_NORM)는 **모델끼리
   *  같은 몫으로 채우는가**를 보는 자라 창을 남기는 것이 제 일이고, 그래서 칸의 절반쯤은
   *  늘 빈다. 여기서는 그 자를 아예 안 태우고 실제로 칠해진 상자를 재서 그 상자를 창으로
   *  삼는다 — 어느 모델이든 칸을 꽉 채운다. 비율은 지키고(meet) 가운데 놓는다.
   *  "인게임"은 이 문을 안 지난다: 거기서는 서로 얼마나 큰지가 물음이라 창이 공통이어야
   *  한다. */
  fit?: boolean;
  /** 잉크 창의 여백(짧은 변 비율) — 도록은 넉넉히(0.12), 효과는 바짝(FxModel이 0.02). */
  fitPad?: number;
  /** 창을 **밖에서 못 박는다**(요청: "최대화 모드에서 각도나 동작 변화에 따라 줌 크기가
   *  달라지면 안 돼") — fit은 그때그때의 잉크에 창을 맞추므로, 자세가 바뀌거나 몸이
   *  돌면 실루엣이 달라지며 창도 함께 달라진다. 그러면 같은 모델이 컷마다 커졌다
   *  작아졌다 하고, 무엇이 실제로 커진 것인지 알 수 없게 된다. 부르는 쪽이 여러 자세·
   *  여러 각을 미리 훑어 **하나의 창**을 정하고 그것을 여기 내려 준다. */
  fitBox?: string;
}) {
  /* 방향은 요잉으로(지적: 화면 회전은 2D 시점에서 모델을 뒤집는다) — 3D 빌더가 있는
     도형은 rotDeg를 화면 회전 대신 모델 요잉 재투영으로 처리한다. 15도 버킷으로 한 번
     굽어 갈무리한다. 위쪽을 봐도 높이는 늘 위를 향한다. */
  const resolved = facesOverride
    ? { faces: facesOverride, rot: SHAPE_ROT[kind] ?? 0 }
    /* 방향을 안 주면 지도의 기본 자세다(요청: "도록에도 지도에 나오듯 +45도 요잉된
       상태로 기본값을 보여줘") — 여태 도록은 rotDeg 없이(요잉 0) 굽고 지도는 45도로
       굽어, 같은 모델이 두 화면에서 다른 각으로 섰다. 모델을 고칠 때마다 "도록에서
       본 앞면이 지도에서는 어디로 가지"를 머리로 환산해야 했고, 그 환산이 이 세션의
       요잉 왕복을 낳았다. 이제 도록이 곧 지도의 자세다 — 방향을 명시한 자리(유닛
       마커의 진행 방향, 뷰어의 요잉 손잡이)는 준 값을 그대로 쓴다. */
    : ((): ReturnType<typeof resolveShapeFaces> => {
      /* 칸은 **굽기 전에** 세우고 끝나면 되돌린다 — poseSet과 같은 규약(모듈 전역
         깃발이라, 안 되돌리면 다음에 굽는 남의 모델까지 그 칸으로 굽힌다). */
      if (spin === undefined && !pose) {
        return resolveShapeFaces(kind, rotDeg ?? BUILDING_BASE_YAW, flat, viewYaw, pitchView);
      }
      if (spin !== undefined) bldSpinSet(spin);
      if (pose) poseSet9(pose);
      const r9 = resolveShapeFaces(kind, rotDeg ?? BUILDING_BASE_YAW, flat, viewYaw, pitchView);
      if (pose) poseSet9(0);
      if (spin !== undefined) bldSpinSet(0);
      return r9;
    })();
  const faces = resolved.faces;
  const rot = resolved.rot;
  /* 잉크 상자 — 칠해진 패스를 다 훑어 합집합을 낸다(inkBox9). 여백은 짧은 변의 12%다
     (요청: "최대화에서도 패딩좀 넉넉히 줘서 안 답답해 보이게" — 처음의 3%는 사실상
     잉크에 창을 딱 붙인 값이라 칸 테두리에 모델이 닿아 답답했다). 아무것도 안 칠해졌으면
     (빈 목록) 여느 창으로.
     ★ 자를 shapeFitBox와 **함께 쓴다** — 밖에서 못 박아 내려 준 창(fitBoxProp)과 여기서
       잰 창이 갈리면 같은 모델이 자리마다 다른 배율로 서기 때문이다. */
  let fitBox: string | undefined = fitBoxProp;
  if (!fitBox && fit && faces && faces.length) {
    fitBox = inkView9(inkBox9(faces), fitPad);
  }
  const uid9 = useId().replace(/[^a-zA-Z0-9]/g, "");
  /** 창(viewBox)의 네 수 — 광택 그러데이션과 가리개가 이 상자를 그대로 덮는다. */
  const vb9 = ((): [number, number, number, number] => {
    const raw9 = fitBox ?? (wide ? "-8 -12 32 32" : "0 0 16 16");
    const n9 = raw9.split(/[\s,]+/).map(Number);
    return [n9[0] ?? 0, n9[1] ?? 0, n9[2] ?? 16, n9[3] ?? 16];
  })();
  return (
    // preserveAspectRatio="none" — 상자(발자국 비율)에 맞춰 그림째 눌린다(요청: 캔버스
    // 비율을 정확하게). 정사각 상자(유닛 마커 등)에서는 아무 일도 안 일어난다.
    <svg
      className={cx("scr-motion-shape-svg", className)}
      viewBox={fitBox ?? (wide ? "-8 -12 32 32" : "0 0 16 16")}
      /* 비율 규약 — 셋이다.
         · fitBox(도록 "최대") : 잉크 창에 비율 맞춰 가운데.
         · keepRatio          : 비율 맞춰 바닥 정렬(자료실).
         · **wide(도록 "인게임")**: 비율 맞춰 가운데. ★ 여기가 새로 갈라진 자리다
           (지적: "확대창에서 인게임 모드로 하면 애들이 폭이 납작해짐") — 여태 이
           갈래가 마지막 "none"으로 떨어졌다. none은 창을 요소 상자에 **늘려 붙이는**
           뜻이라, 지도 마커(발자국 비율 상자)에서는 그것이 맞지만 도록 확대창처럼
           한 칸이 세로로 길쭉한(정사각 창을 셋으로 나눈 1:3) 자리에서는 정사각
           모델이 가로로 3분의 1로 눌렸다. 도록은 어디서도 모델을 안 눌러야 한다.
         · 그 밖(지도 마커)     : none — 상자 비율대로 눌리는 것이 제 일이다. */
      preserveAspectRatio={fitBox || wide ? "xMidYMid meet" : keepRatio ? "xMidYMax meet" : "none"} aria-hidden
    >
      {/* 도록도 모델 공간 정규화를 탄다(지적: 정작 모델을 보는 화면에 정규화가 없어
          "같은 크기로 디자인"을 확인할 수단이 없다) — 굽기(unitSprite)와 **같은 배수·
          같은 축(상자 중심)**이다. 여기서 확인되는 것은 "모든 모델이 제 상자를 같은
          몫으로 채우는가"이지 **지도에서 보이는 크기가 아니다**: ① 도록은 유닛마다
          크기표를 안 태우므로 전 유닛이 같은 크기로 보이는 반면 지도에서는 배틀크루저
          몸 3.74타일 : 저글링 1.75타일로 2.1배 다르고, ② 도록은 base 모드(사선), 지도
          기본은 top 모드라 같은 모델도 −9.1%(스카웃) ~ +15.1%(변태고치)로 어긋난다.
          표에 없는 종류(건물·핵 등)는 1이라 아무 일도 안 일어난다. */}
      {/* ★ 건물 정규화(BLD_NORM)도 여기서 태운다(지적: "지도 크기 끄면 다 크기가
          똑같아야하는거지") — 여태 이 자리는 유닛 표(MODEL_NORM)만 봤고 건물은 배수 1로
          떨어졌다. 그래서 도록은 건물을 **정규화 전 날것**으로 보여 주고 있었다: 실측으로
          날것의 잉크 폭이 6.79~18.15로 2.67배 벌어져 있으니, 도록에서 "이 건물은 작게
          모델링됐다"고 보이던 것 중 상당수가 실은 지도에서는 정규화로 이미 채워지고
          있었다는 뜻이다. 이제 도록과 지도가 같은 배수를 본다.
          축도 지도와 같다 — 유닛은 상자 한가운데(8,8), 건물은 발 가운데(8,16)에서 키운다
          (buildingSprite가 쓰는 그 축이다). */}
      <g id={`sf${uid9}`} transform={fitBox ? (rot ? `rotate(${rot} 8 8)` : undefined) : ([
        rot ? `rotate(${rot} 8 8)` : "",
        // 축은 땅 원점(지도의 unitSprite와 같다 — 상자 가운데였던 것을 옮겼다).
        modelNormOf(kind) !== 1 ? `translate(8 ${pitchView ? 12.6 : 12}) scale(${modelNormOf(kind)}) translate(-8 -${pitchView ? 12.6 : 12})` : "",
        modelNormOf(kind) === 1 && bldNormOf(kind) !== 1
          ? `translate(8 16) scale(${bldNormOf(kind)}) translate(-8 -16)` : "",
      ].filter(Boolean).join(" ") || undefined)}>
        {/* 명암을 지도와 같은 세기로(지적: "도록에서 그림자가 안나오는 느낌") — 캔버스
            유닛 층은 흰·검 덮개 면의 불투명도를 shadeBoost로 1.45배 올려 그리는데,
            SVG로 그리는 이 자리만 원본 값을 그대로 썼다. 같은 모델이 두 화면에서 다른
            대비로 보이던 이유다. 몸판(덮개색 없는 면)은 그대로라 색은 안 변한다. */}
        {faces
          ? faces.map(([d, op, fill], i) => (
            <path key={i} d={d} fill={fill ?? "currentColor"} opacity={shadeBoost(op, fill)} />
          ))
          : <path d={SHAPE_PATHS[kind]} fill="currentColor" />}
      </g>
      {/* ★ 광택도 지도와 같이(지적: "메탈 느낌 주는 건 결국 광택이 답인 거 같은데 모델
          페이지에서 광택이 안 보여서 확인이 어려움") ────────────────────────────────────
          지도의 유닛 층은 다 그린 뒤 **대각선 광택**을 한 겹 덮는다(silhouetteLight):
          왼위에서 흰 14%, 오른아래로 검정 20%를, 그린 잉크 위에만(source-atop) 얹는다.
          그 한 겹이 금속의 절반이다 — 면마다의 명암은 '어느 쪽을 보나'를 말하고, 이 겹은
          '빛이 어디서 오나'를 말한다. 도록은 SVG라 그 겹이 없었고, 그래서 같은 모델이
          지도에서는 금속인데 도록에서는 물감이었다.
          SVG에는 source-atop이 없으니 **마스크**로 같은 일을 한다: 그린 면 무리를 그대로
          가리개로 삼아(use로 다시 부르므로 노드가 두 벌로 안 는다) 그 안쪽에만 그러데이션
          사각을 깐다. 가리개는 밝기가 아니라 **알파**로 읽는다(mask-type) — 밝기로 읽으면
          어두운 면이 뚫려 그늘진 쪽에만 광이 안 얹힌다.
          그러데이션 축은 캔버스와 같은 **상자의 대각선**이다. */}
      <defs>
        <linearGradient id={`sg${uid9}`} gradientUnits="userSpaceOnUse"
          x1={vb9[0]} y1={vb9[1]} x2={vb9[0] + vb9[2]} y2={vb9[1] + vb9[3]}
        >
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.58" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.20" />
        </linearGradient>
        <mask id={`sm${uid9}`} maskUnits="userSpaceOnUse"
          x={vb9[0]} y={vb9[1]} width={vb9[2]} height={vb9[3]}
          style={{ maskType: "alpha" }}
        >
          <use href={`#sf${uid9}`} />
        </mask>
      </defs>
      <rect x={vb9[0]} y={vb9[1]} width={vb9[2]} height={vb9[3]}
        fill={`url(#sg${uid9})`} mask={`url(#sm${uid9})`}
      />
    </svg>
  );
}
/** 땅에 숨을 수 있는 것들(공식) — 저글링·히드라·드론·러커·디파일러·인페스티드
 *  테란. 울트라·퀸·스커지는 못 숨는다. 버로우 커맨드는 고른 무리 전체에 실려
 *  오므로(못 숨는 것이 섞여 있어도 같은 증거가 붙는다) 이 명단으로 거른다. */
/** 전투 효과(트레이서·불티·사망·방어 사격)가 서는 층 — **유닛 캔버스(z 6000) 위**다.
 *
 *  왜 위여야 하나(지적: "포톤캐논 포가 왜 크립에 가려지는 거 같지") ─────────────────
 *  효과는 DOM 스팬이고 유닛·건물·크립은 캔버스 한 장(.scr-motion-unitlayer, z 6000)에
 *  그려진다. 캔버스는 아무것도 안 그린 자리에서는 투명하니 뒤에 있어도 보이는데,
 *  **크립은 칠해진 면**이라 그 위에서는 뒤가 안 비친다. 그래서 저그 진영 안이나 크립이
 *  깔린 자리에서만 트레이서가 통째로 사라졌다.
 *  게다가 옛 값은 자리마다 달랐다: 유닛 효과는 붙박이 1310이고 방어 사격은 건물의 화가
 *  순서(z+2, 지도 위쪽이면 5000 아래·아래쪽이면 9만까지)라, 같은 캐논이라도 지도 어디에
 *  서 있느냐에 따라 보였다 안 보였다 했다.
 *  효과는 늘 몸 위에 얹히는 것이 옳다 — 한 값으로 못 박는다. 사이오닉 스톰 오버레이
 *  (.scr-motion-fxlens, z 7000)보다는 아래다. */
const Z_FX = 6100;
/** 그 마법이 지금 이 몸에 하는 일(요청: 마법 걸린 상태도 피해나 상승 오라도 표시) —
 *  글과 색까지. 피해를 주는 것은 붉게, 묶는 것은 보라, 늦추는 것은 청록이다. */
const STATUS_FX: Record<string, { fx: string; col: string }> = {
  plague: { fx: "지속 피해(체력 1까지)", col: "#e0705a" },
  irr: { fx: "지속 피해 + 곁 아군까지", col: "#e8c84a" },
  ensnare: { fx: "이동·공격 속도 저하", col: "#79c74c" },
  stasis: { fx: "무적·행동 불가", col: "#69b7e8" },
  mael: { fx: "행동 불가(생체)", col: "#a86ae0" },
  lock: { fx: "행동 불가(기계)", col: "#c8c8d2" },
};
/* 스캔 별가루의 자리(%) — 황금각 나선으로 원 안에 고르게 흩고, 반짝임 박자만 어긋낸다.
   한 번 셈해 두는 상수라 프레임마다 자리가 안 바뀐다. */
const SCAN_DUST: [number, number, number][] = Array.from({ length: 16 }, (_, i) => {
  const a9 = i * 2.399963;
  const r9 = Math.sqrt((i + 0.4) / 16) * 42;
  return [50 + Math.cos(a9) * r9, 50 + Math.sin(a9) * r9, ((i * 5) % 16) * 0.11];
});

/** 폭 1칸짜리 실틈은 막힌 것으로 본다(요청: "벽과 벽 사이에 공간이 살짝 있어도 원래
 *  없을법한 적은 타일수면 막힌걸로") — 분석 격자의 틈새로 지상 유닛이 벽을 뚫고 다녔다.
 *  양옆(또는 위아래)이 다 막힌 외길 칸을 지운다. 화면에서만 조인다 — 저장된 지형은
 *  그대로다. */
function closeNarrowGaps(t: TerrainGrid): TerrainGrid {
  const walk = new Uint8Array(t.walk);
  for (let y = 0; y < t.h; y += 1) {
    for (let x = 0; x < t.w; x += 1) {
      const i = y * t.w + x;
      if (!t.walk[i]) continue;
      const blockedL = x <= 0 || !t.walk[i - 1];
      const blockedR = x >= t.w - 1 || !t.walk[i + 1];
      const blockedU = y <= 0 || !t.walk[i - t.w];
      const blockedD = y >= t.h - 1 || !t.walk[i + t.w];
      if ((blockedL && blockedR) || (blockedU && blockedD)) walk[i] = 0;
    }
  }
  return { ...t, walk };
}
/** 프로토스 실드 방어 효과를 그리나 — 지금은 끈다(요청: "프로토스 실드 방어 효과 제거 ·
 *  완성도있게 다시 추가할 예정"). 값을 짓는 쪽(걷기·건물 루프)은 그대로 두고 **그리는 한
 *  자리**만 막는다: 다시 켤 때 이 값만 true로 돌리면 되고, 그동안 값 짓는 코드가 썩지
 *  않는다(자리·크기·위상을 계속 같은 식으로 셈해 둔다).
 *  타입을 boolean으로 못 박아 둔 것은 일부러다 — 리터럴 false면 그 블록이 '닿을 수 없는
 *  코드'가 되어 그 안의 타입 좁힘이 통째로 풀린다(실측: ctx가 null일 수 있다고 뜬다). */
/** 트레이서가 서기 시작하는 배율(요청: "모든 트레이서류 2배 줌부터 나오게 수정") —
 *  이보다 낮으면 beam·shot을 아예 안 그린다. 값을 한 곳에 둔다(그리는 자리 주석 참조). */
const TRACER_MIN_ZOOM = 2;
/* ★ 하나였던 '가장 깊은 칸'을 **둘로 가른다**(지시: "하나는 기능적인 거고 하나는
   심미적인 거야") ─────────────────────────────────────────────────────────────────
   여태 체력바와 겹침 그림자가 상수 하나(8)를 나눠 썼다. 묶어 둔 까닭은 "배치를 안
   가리고 하나로"였는데, 둘은 **뜻이 다르다**:
     · 체력바는 **읽는 것**이다 — 몸이 열댓 픽셀인 칸에서 유닛마다 막대 서넛이 서면
       몸보다 막대가 먼저 읽혀 화면이 막대밭이 된다. 그러니 늦게 서는 데 까닭이 있다.
     · 겹침 그림자는 **보는 것**이다 — 포개진 몸을 떼어 읽게 하는 테두리라, 오히려
       유닛이 빽빽한 낮은 칸에서 값이 더 크다.
   ★ 그리고 값 자체가 **밀려 있었다**(지적: "DEEP_MIN_ZOOM 왜 아직 8이지") ───────────
     8은 옛 사다리 `[1,2,4,8,16]`의 **넷째 칸**이었다. 요청("체력바 8배로 내리고")이 그
     사다리 위에서 한 말이다. 그 뒤 사다리가 `[1,2,3,6,12]`로 갈렸는데(8d3a046) 이 수는
     안 따라와, 지금은 어느 칸도 안 가리키면서 뜻만 **한 칸 뒤로**(넷째 6 → 다섯째 12)
     밀려 있었다. 칸으로 옮겨 적어 그 밀림을 되돌린다.
     ※ 값을 사다리 배열에서 읽어 오지는 않는다 — ZOOM_STEPS는 컴포넌트 안이고 여기는
       모듈 스코프다. 대신 **몇째 칸인지**를 이름과 주석에 박아, 사다리를 또 갈 때
       같이 갈아야 한다는 것이 눈에 띄게 둔다. */
/** 체력바·실드막·승하차 줄이 서는 칸 — 사다리 `[1,2,3,6,12]`의 **넷째(6배)**.
 *  기능(읽기) 쪽이라 몸이 충분히 커진 뒤에 선다. */
const DEEP_MIN_ZOOM = 6;
/** 겹침 그림자가 서는 칸 — **첫째(1배), 곧 늘 켜짐**이다.
 *
 *  가는 길이 두 걸음이었다.
 *   ① 3배로 내려 봤다(지시: "PC는 3배 줌에 겹침 그림자 넣어도 될 것 같기두"). 눈에는
 *      좋았는데 삯이 컸다 — 실측(배포판·PC·3배·개체 1017): 붓:유닛캔버스가 0.31 →
 *      5.24ms, **최악 프레임 50ms 가운데 34.8ms**가 이 붓 하나였다. 프레임 중앙값도
 *      16.2 → 21.7ms(≈62 → 46fps).
 *   ② 그래서 삯 자체를 옮겼다(지시: "1로 가야지 모바일에서도 적용할 수 있잖아") —
 *      흐림을 그리기마다가 아니라 **판마다 한 번** 굽는다(shadowPlate). 프레임에 남는
 *      것은 그림 하나를 더 찍는 일뿐이라, 배율로 막을 까닭이 사라졌다.
 *  ★ 문턱이 1이므로 이 상수는 사실상 '늘 켬'이다. 그래도 값으로 남겨 둔다 — 되돌릴
 *    자리가 한 곳이어야 하고, 사양 게이트(showOverlap = 품질 '고')와는 뜻이 다르다
 *    (그쪽은 낮은 사양에서 아예 안 켜는 문이다). */
const SHADOW_MIN_ZOOM = 1;
/* ★ **낮은 배율에서는 지상 유닛의 그림자를 안 진다**(지적: "모바일 1,2배는 또 다른
   문제 같아 — 너무 많은 양을 구워야 하다 보니 느려지는 듯(개수)") ────────────────────
   개수가 범인이라는 관측은 맞았고, 다만 많은 쪽이 **굽는 판이 아니라 그리는 판**이었다:
   1·2배에서는 굽기가 0장인데(실측) 프레임이 p50 167ms다. 유닛 하나가 판 **두 장**을
   찍기 때문이다 — 몸과 그림자. 게다가 그림자 판은 흐림 여백 탓에 몸보다 **면적이
   두세 배 크다**(흐림 반지름에 바닥값 1.5가 있어, 몸이 작을수록 여백 몫이 커진다).
   곧 낮은 배율에서는 몸보다 그림자를 그리는 값이 더 든다.
   실측(합성 세계·1배·dpr 3·CPU 4배): 그림자를 끄면 p50 166.6 → 116.6ms(−30%),
   p75 466.6 → 216.7ms(−54%).
   ★ 그런데 **공중은 남긴다**(요청) — 이 그림자의 값어치는 '겹쳤을 때 어느 것이 위인지'
     인데, 지상 유닛은 원작 충돌 처리가 서로 떼어 놓아 낮은 배율에서 겹칠 일이 거의 없다.
     반면 공중은 서로 안 밀어내 뮤탈 뭉치가 통째로 포개져 난다 — 거기서는 그림자가
     유일한 단서다(아래 blit의 ★가 적어 둔 그 자리). 그리고 수로도 공중이 소수라,
     지상만 걷어도 이득의 대부분이 온다.
   ★ 건물은 안 건드린다 — 수가 적고(화면에 수십), 낮은 배율에서 지형 위에 앉은 덩어리를
     띄워 보이게 하는 몫이 크다.
   ★ **작은 기기에서만**이다(지시: "모바일만이야") — PC는 이 자리가 안 아프고, 큰 화면
     에서는 1·2배에서도 유닛이 폰보다 크게 그려져 그림자가 제 몫을 한다. 그래서 데스크톱
     에서는 지금 그대로 지상도 그림자를 진다. */
const SHADOW_GROUND_MIN_ZOOM = DEV9.shadowGroundMinZoom;
/** ★ 전투 효과가 **갈래마다** 서는 칸 — 요청: "2배에서 전투효과: 가시 분출 우리 /
 *  4배에서 전투효과: 피격 / 나머지는 다 8배부터 노출".
 *  여기 적힌 것은 **사다리(가장 이른 칸)** 이고, 실제 칸은 배치의 바닥과 함께 잰다
 *  (`fxMinZoom`) — 좁은 자리(폰)는 바닥이 8배라 트레이서 말고는 전부 8배로 눌린다.
 *  갈래를 이렇게 가르는 까닭은 **한 프레임에 몇 개가 뜨느냐**가 갈래마다 다르기 때문이다:
 *   · 가시·분출·우리 — 드물게 몇 개, 게다가 큼직해 작은 몸 옆에서도 읽힌다.
 *   · 피격 — 난전이면 유닛 수만큼 터진다. 2배에서는 화면이 불티로 덮여 몸이 안 보인다.
 *   · 실드막·승하차 줄 — 몸에 딱 붙는 얇은 그림이라 몸이 커야 뜻이 생긴다. */
const FX_MIN_ZOOM: Record<FxOp["kind"], number> = {
  beam: TRACER_MIN_ZOOM, shot: TRACER_MIN_ZOOM,   /* 트레이서 — 배치를 안 가리고 2배 */
  spike: 2, erupt: 2, cage: 2,
  hit: 4,
  shield: 4,   // 실드 피격은 다른 피격과 같은 문턱(요청) — 실드가 있든 없든 '맞았다'가 같은 배율에서 읽혀야 한다.
  tether: DEEP_MIN_ZOOM,
  burst: 2,   // 죽음·파괴 폭발 — 2배부터 캔버스로(그 아래는 DOM 여운 하나)
  /* 다친 건물의 상처 — 스팬 시절 칸이 없었으므로(사양 '중'이면 1배에서도 보였다) 1배 그대로 둔다.
     캔버스로 옮기며 보이는 것이 줄면 안 된다. 아래 FX_NO_FLOOR에 들어 배치 바닥도 안 탄다. */
  wound: 1,
  /* 옛 DOM 효과 층(용접·마인·착지·흙덩이·붕괴·지역 마법·스웜·죽음 여운) — 스팬 시절엔 칸이 없었다.
     캔버스로 옮기며 보이는 것이 줄면 안 되므로 1배 그대로 두고, 아래 FX_NO_FLOOR에 넣어 배치 바닥도 안 탄다. */
  dom: 1,
  warp: 2,    // 프로토스 소환 완료의 섬광 — 폭발과 같은 칸(둘 다 '그 자리에서 무슨 일이 있었다'를 말한다)
};
/** 배치의 바닥(detailAt: 폰 8배)을 **안 타는** 갈래 — 제 칸(FX_MIN_ZOOM)이 곧 실제 칸이다.
 *
 *  ★ 우리(cage)가 여기 든다(요청: "스테이시스 같은 건 표시 레벨을 트레이서랑 같은 급으로
 *    올려야 해, 없으면 뭘 했는지 알 수가 없어") ────────────────────────────────────────
 *    맞는 말이고, 결이 트레이서와 같다: 이것들은 **꾸밈이 아니라 사건**이다. 트레이서가
 *    없으면 누가 싸우는지 모르고, 우리가 없으면 아비터가 무엇을 했는지 모른다 — 스테시스는
 *    한 판을 가르는 한 방인데 그것이 화면에서 통째로 빠지면 경기가 안 읽힌다.
 *    표에는 이미 2배로 적혀 있었는데(cage: 2) 배치 바닥과 **둘 중 늦은 쪽**을 쓰는 규칙에
 *    걸려 폰에서는 8배였다. 그 바닥을 안 타게 한다.
 *  나머지(피격·실드막·승하차 줄)는 꾸밈이라 바닥을 그대로 탄다. */
const FX_NO_FLOOR = new Set<FxOp["kind"]>(["beam", "shot", "cage", "burst", "warp", "wound", "dom"]);
/* ★ 켠다(지적: "프로토스 실드 피격효과를 금색이 아니라 플라즈마 빛으로") — 꺼 둔 동안 실드 op가 아래 갈래에서
   **안 걸러지고** 총구 번쩍임 기본 갈래(FX_BEAM.base, 금빛)로 흘러 들어갔다. 그 금빛 번쩍임이 곧 '금색 실드
   피격'이었다. 이제 실드 막을 플라즈마 빛(흰 심·시안 테)으로 제대로 그리고, 꺼도 아래로 안 흘러가게 막는다. */
const SHIELD_FX_ON: boolean = true;
/* 근접 유닛(지적: 질럿이 가까이 가지 않고 멀리서 싸움) — 이들은 당김 상한(2.5타일)에
   걸려 6~7타일 밖에 멈춰 서면 안 되고, 표적에 몸이 닿을 때까지 걸어 들어가야 한다.
   파이어뱃은 사거리 1타일이라 근접으로 친다. */
/* (걷어냄) MELEE_UNITS — 근접 유닛 이름표다. 파이어뱃이 들어 있어서 사거리 3.5타일짜리
   화염방사기가 통째로 안 그려지고 있었다(요청: "원거리는 무조건 나와야해"). 이제 근접
   여부는 이름이 아니라 무기 사거리표가 정한다(1타일 미만) — 표가 곧 답이라 명단을
   손으로 맞출 일이 없다. */

/** 자취에서 t 시각의 자리 — 사이는 보간(지상은 가운데로 휘는 곡선), 틈이 크면 앞 점에 머문다.
 *  moving(두 점 사이를 미끄러지는 중)과 sinceLast(마지막 명령에서 지난 초)도 함께 낸다 —
 *  "커맨드를 받거나 이동 중이면 이름으로"(요청)의 재료다. */

/* 걸음 시계가 빚을 갚는 속도(요청: 교전 뒤 이동이 부자연스럽다) — 뒤처진 시계는
   1.4배로 달려 따라잡는다. 화면 스무딩 상한(제 걸음 ×1.5)보다 낮아, 따라잡는 동안에도
   몸이 자취를 벗어나 가로지르지 않는다. 빚 상한은 그 위의 안전판이다. */
/* (걷어냄) TRACK_CATCHUP·TRACK_DEBT_MAX — 렌더러가 명령 좌표를 '언제 지날까'로
   어림하던 시절의 빚·따라잡기 상수. 코어 자취는 제 시각에 제자리다. */

/* (걷어냄) nearestTrackSec — 교전이 끝난 뒤 '지금 선 자리와 가장 가까운 앞쪽 시각'을
   찾아 시계를 옮기던 자. 렌더러 교전 당김과 함께. */

/* (걷어냄) unitAt — '이 부대의 우세 유닛' 어림. 개체마다 제 정체(e.kind)가 있으니
   부대의 대표 이름을 고를 일이 없다. */

/** 상세 팝업 자동 확대의 자리 잡기 — 묶음 상세(카드 여럿)에서 첫 판만 확대창을 연다. */
// (삭제·요청: 확대창 완전 제거) — autoBigHolder(묶음 상세의 첫 판만 확대)도 함께 걷었다.

/* 한 번에 한 판만 돈다(요청) — 목록에 게임 카드가 여럿 펼쳐져 있으면 저마다 자동재생을
   시작해 지도가 사방에서 움직인다. 마지막으로 재생을 잡은 플레이어가 앞 임자를 멈춘다. */
let playbackHolder: { current: () => void } | null = null;
function claimPlayback(ref: { current: () => void }) {
  if (playbackHolder && playbackHolder !== ref) playbackHolder.current();
  playbackHolder = ref;
}
function releasePlayback(ref: { current: () => void }) {
  if (playbackHolder === ref) playbackHolder = null;
}
/** 건물 사전셈 캐시 — 자취 배열의 정체를 열쇠로. 로스터(bases)가 바뀌면 다시 센다. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bldPreCache9 = new WeakMap<object, { bases: any; v: any }>();

/* 계측기는 공용 파일에 있다(perf9) — 캔버스 붓 셋(유닛·안개·지도벡터)도 같은 자를
   써야 그 삯이 '브라우저' 한 통에 섞이지 않는다. 그쪽 머리말 참고. */

const fmtClock = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** 로스터의 줄인 이름(재요청: 한글 3자·영문 5자) — 한글은 1, 그 밖(영문·숫자)은 0.6으로
 *  세어 너비 3까지 남긴다(한글 3자 = 영문 5자). 기둥이 좁아진 확대창·모바일 로스터가
 *  같이 쓴다. */
/** 로스터 이름 줄이기 — **한 팀에 몇이냐**가 한도를 정한다(요청: "모바일 로스터
 *  4인일때 말줄임표없이 3글자 제한 / 3명 4글자 / 2명 6글자 / 1명 전체글자").
 *  까닭은 칸 폭이다: 팀 기둥의 폭은 고정인데 사람 수로 나눠 쓰므로, 넷이면 한 칸이
 *  넷 중 하나다. 넷에서 여섯 자를 적으면 어차피 칸 밖으로 나가거나 글자가 뭉갠다.
 *  한 자 폭은 한글 1 · 그 밖 0.6으로 센다(한글이 그만큼 넓다).
 *  말줄임표는 안 붙인다(요청) — 점 셋도 한 자리를 먹는데, 그 자리는 이름 한 글자를
 *  더 보여 주는 데 쓰는 편이 낫다(활동 목록의 clipName과 같은 결). */
const shortName = (name: string, teamSize = 4): string => {
  const lim = teamSize <= 1 ? Infinity : teamSize === 2 ? 6 : teamSize === 3 ? 4 : 3;
  if (!Number.isFinite(lim)) return name;
  let w = 0;
  let out = "";
  for (const ch of name) {
    w += /[ᄀ-ᇿ㄰-㆏가-힯]/.test(ch) ? 1 : 0.6;
    if (w > lim + 0.01) break;
    out += ch;
  }
  return out || name;
};

/** 경기별 현재 재생 시각(요청: 특정 시간으로 카톡 공유) — 재생기가 제 clockKey로 지금
 *  t를 계속 적어 두면, 공유 버튼이 링크에 &t=로 실어 보낸다. */
export const playbackClockOf = new Map<string, number>();
/** 경기별 지금 **보고 있는 자리**(요청: "현재 장면 공유시 내가 보고있던 부분의 위치까지
 *  같이 보내서 들어오는 사람도 거기가 재생되게") — 시각만으로는 같은 장면이 안 된다.
 *  확대해서 한 귀퉁이를 보고 있었으면 받는 쪽도 그 귀퉁이를 봐야 '그 장면'이다.
 *  자리는 **분수**로 적는다(픽셀이 아니라) — 보내는 사람의 지도 상자와 받는 사람의
 *  지도 상자는 크기가 다르다. cx·cy는 화면 한가운데에 오는 지도 위 지점이다. */
/** ★ 확대 상한 — **바깥도 이 값을 본다**(지적: "z=12인데 8배로 나오는 버그") ──────────
 *  공유 링크를 읽는 쪽(GameResultStory)이 `Math.min(8, …)`으로 죄고 있었다. 8은 옛 사다리
 *  (1·2·4·8·16)의 잔재다 — 사다리를 1·2·3·6·12로 갈 때 재생기 안의 상한만 따라오고 링크를
 *  읽는 쪽은 안 따라와, 12배에서 공유한 장면이 받는 쪽에서 8배로 열렸다.
 *  DEEP_MIN_ZOOM이 8에 못 박혀 밀려 있던 것과 **같은 갈래의 흠**이다: 사다리에 매인 수를
 *  두 곳에 적으면 언젠가 한쪽만 고쳐진다. 값을 내보내 자를 하나로 둔다. */
export const PLAYBACK_ZOOM_MAX = 12;
/** 경기별 **지금 배속**(요청: 공유 파라미터에 속도 추가) — 시각·자리와 같은 결이다:
 *  받는 쪽이 같은 장면을 보려면 '어디를'과 '언제'뿐 아니라 '얼마나 빠르게'도 같아야 한다.
 *  1배는 안 싣는다(기본값이라 주소만 길어진다 — &t=·&z=와 같은 규약). */
export const playbackSpeedOf = new Map<string, number>();
/** 경기별 **지금 추적 중인 사람**(요청: "장면 공유·스크랩에 추적 파라미터 추가") —
 *  시각·자리·배속과 같은 결이다. 추적을 켜고 보낸 장면은 '그 사람을 따라가며 보는 장면'
 *  이라, 그것까지 실어야 받는 쪽이 같은 것을 본다. 값은 그 판에서 쓴 게임 아이디(raw)다 —
 *  회원 식별로 적으면 비회원·컴퓨터를 못 가리키고, 아이디를 바꾼 사람의 옛 판이 어긋난다.
 *  안 켜져 있으면 아예 안 담는다(지우고 나간다). */
export const playbackTrackOf = new Map<string, string>();
export const playbackViewOf = new Map<string, {
  /** 배율(1이 기본) */ z: number;
  /** 화면 한가운데의 지도 가로 분수(0~1) */ cx: number;
  /** 세로 분수(0~1) */ cy: number;
  /** 시점 각도(도) */ deg: number;
}>();
/** 메인 개체 표에서 비운 배열들의 자리표(공유) — 같은 참조라 메모리를 안 먹는다. */
const EMPTY_ARR9: never[] = [];
/** React 상태 t를 올리는 간격(ms) — 유닛 캔버스는 틱이 프레임마다 칠하고, React는 이 박자로만 렌더한다(4번). */
const REACT_STEP_MS9 = 100;
/* (옮김) 핵·스톰 동안의 React 박자 — 기기의 **힘**으로 갈라야 해서 nukeStep9로 갔다(CROWD9 옆 ★). */
/** 워커가 보낸 설계도 한 장 — 숫자 배열(unpack9로 푼다) + 안개(바뀐 장에만) + 짓기 ms. 푼 결과는 dec에 붙인다. */
export type PackedFrame9 = {
  t: number; buf: Float32Array; strs: string[];
  fog: { explored: Uint16Array | null; visNow: Uint8Array | null; visSrc: Float32Array } | null;
  ms: number; /** 유닛 op 수(진단) */ n: number; /** 시점 차례(시야 사각형이 바뀔 때마다 오른다) */ seq: number;
  /** 세대 — 시점·명령(탐색·감기·재생/정지·배속)마다 오른다(frameWorker gen). 붓은 세대를 섞어 고르지 않는다. */
  gen: number;
  /** 이 장을 지은 시점 원점(PitchGeom9.ox·oy) — 붓이 그리는 장의 원점을 지형 변환·안개 사영이 따라간다(drawnOrgRef9). */
  ox: number; oy: number;
  /** 이 장의 눈 목록(x·y·반지름·신원 × n) — 장마다 온다(엔진 eyes9 ★). 안개가 꺼졌으면 null. */
  eyes: Float32Array | null;
  /** 안개 갈래 — 시야 주인·전체시야·안개 켬이 바뀔 때만 오른다. 다른 갈래의 안개 판은 섞어 쓰지 않는다. */
  fseq: number; dec?: Frame9;
  /** 보간용 — 이 장의 유닛 op 열쇠 표(뒤 장으로 쓰일 때 한 번 만든다). */
  byKey?: Map<string, UnitDrawOp>;
};
/** 보간 열쇠 — 같은 개체의 같은 부위(몸·포탑·짐)를 두 장에서 잇는다. 열쇠가 없는 op(효과·장식)는 안 잇는다. */
/* 잔상(ghost)은 제 열쇠를 갖는다 — 본체와 같은 pickKey·kind라 열쇠가 겹치면 byKey 표에서
   뒤에 온 잔상이 본체를 덮고, 풀 객체까지 한 개를 나눠 써 본체가 파란 잔상으로 그려졌다
   (하템 귀신 활강: 본체가 안 보이고 환영만 남던 까닭). */
const lerpKey9 = (op: UnitDrawOp): string | null => (op.pickKey ? `${op.pickKey}|${op.kind}|${op.attach ?? ""}${op.ghost ? "|g" : ""}` : null);
const lerpAng9 = (a: number, b: number, u: number): number => {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  if (d > 180) d -= 360;
  return a + d * u;
};

/** 워커에 보낸 시야를 견주는 열쇠 — 렌더가 보내는 자리와 손짓이 보내는 자리가 함께 쓴다. */
function viewKeyOf9(v9: EngineView9): string {
  return `c${v9.crowd}|${v9.mapW}|${v9.mapH}|${v9.tilePx.toFixed(3)}|${v9.pitched ? 1 : 0}|${v9.pitchFlat.toFixed(4)}`
    + `|${v9.geom.w}|${v9.geom.h}|${v9.geom.P.toFixed(1)}|${v9.geom.ox.toFixed(1)},${v9.geom.oy.toFixed(1)}`
    + `|${v9.geom.sox.toFixed(1)}`
    + `|${v9.viewTeam}|${v9.visAll ? 1 : 0}|${v9.fogOn ? 1 : 0}`
    + `|${v9.qAnim ? 1 : 0}${v9.qBuildFx ? 1 : 0}${v9.qDeath ? 1 : 0}${v9.clickFx ? 1 : 0}`
    + `|${v9.cull ? `${v9.cull.x0.toFixed(3)},${v9.cull.x1.toFixed(3)},${v9.cull.y0.toFixed(3)},${v9.cull.y1.toFixed(3)}` : "all"}`;
}
/** ★ 끄는 동안의 실시간 원근은 **기본으로 끈다**(주소에 `?live3d=1`이면 켠다) ────────────────────────
 *  지적 둘로 자리가 드러났다: "흔들림 발생했어. 그리고 두 번째 드래그부터 시점 변화 X".
 *  ① 두 번째부터 안 되던 것 — 문을 '최근 2초의 최악 프레임'으로 여닫았는데, 그 창에 **방금 끈 드래그
 *    자신의 무거운 프레임**이 들어간다. 첫 드래그가 문을 닫고 그 뒤로 영영 안 열렸다. 스스로를 재는 자였다.
 *  ② 흔들림 — 이것이 구조다. 끄는 동안 붓은 **매 프레임 다시 그리지 않는다**(무거우면 미루고 그 사이는
 *    CSS로 민다). CSS 밀기는 순수한 옮기기라 **그 시점의 원근이 얼어 있는 것**과 같고, 다시 그리는 순간
 *    새 원점의 사영으로 **건너뛴다**. 원점이 프레임마다 움직이면 그 건너뜀이 다시 그릴 때마다 나고, 다시
 *    그리는 박자가 고르지 않으니 좌우로 흔들려 보인다.
 *    곧 실시간 원근은 '**매 프레임 다시 그릴 수 있을 때**'만 성립한다(한 장 16ms 언저리). 배율 6·1000기·
 *    3D 미달 기기에서는 한 장이 그 몇 배라 성립하지 않는다 — 원점을 얼려 두는 편(종전 동작)이 옳다.
 *  그래서 길과 계측은 그대로 두고 기본을 끔으로 돌린다. 가벼운 자리에서 손으로 켜 보려면 ?live3d=1. */
/** 손으로 젖히는 자 — `?live3d=1` 강제 켬 · `?live3d=0` 강제 끔 · 없으면 자동(아래). */
const LIVE3D_FORCE9: boolean | null = typeof location === "undefined" ? null
  : /[?&]live3d=1/.test(location.search) ? true
    : /[?&]live3d=0/.test(location.search) ? false : null;
/** ★ 기본은 **3D 벤치를 통과한 기기만**(요청: "3D 벤치 통과 기기에서만 기본 켬") ─────────────────────
 *  실시간 원근은 손짓 중 장을 매 프레임 다시 그릴 수 있을 때만 성립한다. 그 힘을 재는 자가 이미 있다 —
 *  진입 때 한 번 재는 입체 벤치(CROWD9.bench3 · 기준 CROWD_BENCH3D_MS9)다. 미달 기기(weak3)는 종전처럼
 *  원점을 얼려 두고 손을 뗄 때 맞춘다. 손짓이 시작될 때 한 번 읽는다(벤치는 첫 렌더에서 굳는다). */
/* ★ **① 벤치 문턱을 live3d 몫으로 떼어낸다**(지적: "미달 문턱이 좀 높은가") ────────────────────────
   `weak3` 하나가 두 일을 겸하고 있었다 — ㉠ 3D에서 유닛 간이화(단 내림) ㉡ 손짓 중 실시간 원근.
   ㉠은 못 미치면 조금씩 깎는 완만한 조정이고 ㉡은 껐다 켜기다. 한 숫자로 둘을 다 정하니 ㉠에 맞춘
   보수적인 값이 ㉡까지 막았다.
   게다가 그 값 자체가 어긋나 있었다: `benchDevice9(true)`는 2D보다 화소를 2.87배 칠하는데
   (스프라이트 61²/36², 타원 24×10/14×6) 문턱은 24 → 16ms로 **낮췄다**. 곧 3D를 통과하려면
   2D 기준 6ms여야 하니 화소당으로 4배 엄격했다(실측 헤드리스 2D 15 / 3D 40ms — 비 2.67).
   그래서 live3d는 화소당 엄격도를 2D와 같게 맞춘 제 문턱을 갖는다: 24 × 2.87 ≈ 69가 이론값이지만,
   실시간 원근은 '한 장을 프레임 안에 다시 그릴 수 있을 때'만 성립하므로 그렇게까지 늦추지 않고
   **26ms**(2D 문턱 24와 나란한 값)로 둔다. 간이화 판정(weak3·16ms)은 그대로다. */
const LIVE3D_BENCH_MS9 = 26;
/* ★ **② 짐작 대신 실측**(같은 지적) ─────────────────────────────────────────────────────────────
   벤치는 256×256 채우기 한 판이지 이 판의 한 장 값이 아니다. 그런데 손짓이 도는 동안 **진짜 값**을
   이미 매 프레임 재고 있다(applyGestureXf의 xfPaintMs — 실시간 원근이 꺼진 손짓에서도 잰다.
   끄는 동안 밀림 기준을 얼려 두므로 판 열쇠가 안 흔들려, 켠 손짓과 한 장 값이 견줄 만하다).
   그 값을 최근 24장의 **중앙값**으로 들고, 있으면 그것이 벤치를 대신한다. 중앙값을 쓰는 까닭:
   최솟값은 한 번 좋은 프레임에 눌려 영영 안 오르고(자리가 무거워져도 켠 채로 있다), 평균은 한 번의
   튐에 끌려간다. 문턱은 접는 자리(33ms)보다 한 뼘 낮은 24ms — 켤지 말지를 접히기 직전 값으로
   정하면 켜자마자 접히는 일이 잦다.
   이로써 첫 재기가 파싱·GC와 겹쳐 부풀어 굳는 문제(crowdRecheck9가 값을 낮추기만 하는 까닭)도
   사라진다 — 손짓 스무 장이면 기기의 참값이 자를 갈아 끼운다. */
const LIVE3D_DRAW_MS9 = 24;
const XF_MS_RING9 = { v: new Float64Array(24), n: 0 };
/** 손짓 한 장 값을 적는다 — applyGestureXf가 잰 그 값이다. */
function noteXfMs9(ms9: number): void {
  if (!(ms9 > 0)) return;
  const r9 = XF_MS_RING9;
  r9.v[r9.n % r9.v.length] = ms9;
  r9.n += 1;
}
/** 최근 손짓 장들의 중앙값 — 아직 표본이 모자라면 −1(그러면 벤치를 쓴다). */
function xfMsMid9(): number {
  const r9 = XF_MS_RING9;
  const n9 = Math.min(r9.n, r9.v.length);
  if (n9 < 12) return -1;
  const a9 = Array.from(r9.v.subarray(0, n9)).sort((x9, y9) => x9 - y9);
  return a9[n9 >> 1];
}
const live3dOn9 = (): boolean => {
  if (LIVE3D_FORCE9 !== null) return LIVE3D_FORCE9;
  const mid9 = xfMsMid9();
  if (mid9 >= 0) return mid9 <= LIVE3D_DRAW_MS9;          // ② 실측이 있으면 그것이 자다
  return CROWD9.bench3 >= 0 && CROWD9.bench3 <= LIVE3D_BENCH_MS9;   // ① 없으면 제 문턱의 벤치
};
/** ★ **그린 장의 원점 발자국**(왕복 잡기) — 짐작이 세 번 빗나가 자리를 눈으로 보기로 한다.
 *  붓이 장을 바꿔 그릴 때마다 그 장의 원점(ox)을 적고, 방향이 뒤집힌 횟수를 센다.
 *  왕복이 **원점에서 나면** back이 오르고(그러면 장 고르기·보내기 쪽), 원점은 곧게 가는데 화면만
 *  흔들리면 back이 0이다(그러면 붓의 변환·지형 층 쪽). 2초 창으로 굴린다. */
const ORG9 = {
  at: 0, last: NaN as number, lastLive: NaN as number,
  steps: 0, rev: 0, lag: 0, sLast: 0, rLast: 0, lLast: 0, now: 0,
  /** 마지막으로 그린 장의 원값 — 파생값(Δ)만 보면 '늘 어긋남'과 '가끔 튐'을 못 가른다(실측 Δ지금=Δ최대). */
  ox: 0, live: 0, gen: 0, seq: 0,
};
/** 그린 장의 원점 한 걸음 — **손끝 원점과 견줘서** 잰다.
 *  ★ 앞 판은 '그린 원점의 방향이 뒤집힌 횟수'를 셌는데, 그러면 **손가락이 방향을 바꾼 것**과
 *    **파이프라인이 거꾸로 간 것**이 한 칸에 섞인다(실측 17걸음 뒤로1 / 10걸음 뒤로4 — 어느 쪽인지
 *    가릴 수가 없었다). 이제 같은 순간의 손끝 원점과 견준다: 손끝은 앞으로 가는데 그린 원점만
 *    뒤로 가면 **역행**이다. 그 수가 0이 아니면 왕복은 파이프라인의 것이고, 0이면 손짓의 것이다.
 *  최대 뒤짐(lag)은 그린 원점이 손끝에서 얼마나 떨어졌나의 최대값 — 화면에서 보이는 어긋남의 크기다. */
const orgNote9 = (ox: number, liveOx: number): void => {
  const now9 = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (ORG9.at === 0) ORG9.at = now9;
  if (now9 - ORG9.at >= 2000) {
    ORG9.sLast = ORG9.steps; ORG9.rLast = ORG9.rev; ORG9.lLast = ORG9.lag;
    ORG9.steps = 0; ORG9.rev = 0; ORG9.lag = 0; ORG9.at = now9;
  }
  const lag9 = Math.abs(liveOx - ox);
  ORG9.now = lag9;
  ORG9.ox = ox;
  ORG9.live = liveOx;
  if (lag9 > ORG9.lag) ORG9.lag = lag9;
  if (Number.isFinite(ORG9.last) && Number.isFinite(ORG9.lastLive) && ox !== ORG9.last) {
    ORG9.steps += 1;
    const dd9 = Math.sign(ox - ORG9.last);          // 그린 원점이 간 쪽
    const dl9 = Math.sign(liveOx - ORG9.lastLive);  // 손끝 원점이 간 쪽
    if (dd9 !== 0 && dl9 !== 0 && dd9 !== dl9) ORG9.rev += 1;
  }
  ORG9.last = ox;
  ORG9.lastLive = liveOx;
};
/** 손짓 중 시야를 흘려보내는 **최소** 간격(ms) — 손짓 프레임(rAF)마다 한 번이 목표라 바닥만 깔아 둔다.
 *  ★ 120ms에서 8ms로 내렸다(지적: "드래그 중 좌우로 시점이 흔들흔들하는데?") ─────────────────────────
 *  흔들림은 **사영 중심이 계단으로 따라오기 때문**이다. 붓은 손끝을 따라 매끄럽게 미는데(CSS·다시 그리기)
 *  설계도의 원근 중심은 보낸 그 순간에 못 박혀 있어, 다음 장이 올 때까지 유닛이 조금씩 잘못된 원근으로
 *  끌려갔다가 새 장에서 제자리로 튄다 — 그 주기가 곧 보낸 간격이고, 어긋남의 크기는 손 속도 × 간격이다.
 *  간격을 프레임 하나로 줄이면 그 어긋남이 **한 프레임 몫**(16ms × 손 속도, 몇 px)으로 떨어져 눈에 안 띈다.
 *  대가는 워커가 끄는 동안 앞장을 못 짓고 지금 장만 짓는 것인데, 끄는 동안은 그것이 맞는 일이다
 *  (짓기 한 장 ~10ms이라 초당 예순 장 언저리를 낼 수 있다). 손을 떼면 곧바로 앞을 다시 채운다. */
const LIVE_VIEW_MS9 = 8;
export default function ReplayMotionPlayer({
  grid, endSec, bases: basesIn, teamOfRaw, active = true, winnerTeam, side,
  onDetailClose, loadUnitTracks, initialSec, initialSpeed, initialView, initialTrack,
  clockKey, shareNode, onScrap, scrapLabel = "장면 스크랩", onShare, shareLabel = "장면 공유",
  onGuide, guide = true, avatars,
  soleView, melee,
  onFinish,
}: {
  grid: ReplayMapGrid;
  /** 경기 길이(초) — 경기 메타(durationSeconds)에서 온다. 없으면 트랙의 끝으로 잡는다. */
  endSec: number | null;
  /** 본진 로스터(아바타+이름) — 좌표는 옛 요약에서만 왔으므로 이제 없을 수 있다. */
  bases: MotionBase[];
  /** 원본 게임 아이디 → 팀 — 텍스트 색을 가른다. */
  teamOfRaw: (raw: string) => 1 | 2 | undefined;
  /** 화면에 실제로 보이는 카드인가 — 안 보이는 카드의 시계는 세우지 않는다. */
  active?: boolean;
  /** 이긴 편 — 재생이 끝나면 그 편 아바타에 트로피를 얹는다(요청). 무승부·미확정은 없음. */
  winnerTeam?: 1 | 2;
  /** ★ 밀리(프리 포 올)인가(요청: "팀 개념이 아니니") ────────────────────────────────
   *  저장 모형은 team1/team2뿐이라 밀리도 그 두 자리에 담긴다(team1 = 이긴 사람 하나,
   *  team2 = 나머지). 그건 **저장의 사정**이고 화면이 따라야 할 이유가 없다. 참이면:
   *    · 로스터가 **한 테이블**이다 — 1팀/2팀 머리도, 좌우 가름도 없다.
   *    · 팀색 손잡이를 안 단다 — 편이 없으니 팀색이라는 것도 없다(개인색으로 못 박는다).
   *    · 트로피는 **이긴 사람 하나**에만 붙는다(team1이 곧 그 한 사람이라 셈은 같다).
   *  판정은 부르는 쪽이 한다 — 1:1과 밀리는 저장값(matchType 0101)이 같아서, 사람 수까지
   *  봐야 갈린다. */
  melee?: boolean;
  /** 끝까지 재생됐다 — 화면이 그때 승패를 드러낸다(요청: "상세에서는 처음엔 숨기다가
   *  끝까지 재생하면 노출"). 승패는 스포일러라 **언제 보일지는 화면이 정한다** — 여기서는
   *  '끝났다'만 말한다. 여러 번 불릴 수 있다(되감아 다시 끝내면 또 온다). */
  onFinish?: () => void;
  /** 확대 모드에서 맵 오른쪽 영역에 앉는 내용(지적: "리플" = 댓글) — 경기 결과의 댓글
   *  컴포넌트가 온다. 자막 패널로 오해했다가 바로잡았다. 인라인에선 안 그린다. */
  side?: React.ReactNode;
  /** 케밥 메뉴(요청: PC 기본이 확대인 만큼 확대 창에도 케밥·닫기) — 확대 창 오른쪽 위,
   *  닫기(X) 옆에 앉는다. 인라인에선 카드 윗줄의 원본이 이미 있으니 안 그린다. */
  menu?: React.ReactNode;
  /** 확대 창 왼쪽 기둥 맨 위의 타임스탬프(요청) — 경기 시각. */
  stamp?: React.ReactNode;
  /** 확대 창 왼쪽 기둥 맨 아래의 등록자 정보(요청). */
  registrant?: React.ReactNode;
  /** 상세 팝업 닫기(요청: PC는 게임 결과만 확대창이 기본, 기존 상세는 미사용) — 값이
   *  오면 PC에서 마운트되자마자 확대창을 열고, 확대창을 닫을 때 상세까지 함께 닫는다. */
  onDetailClose?: () => void;
  /** 참값 자취 로더 — 서버가 리플레이를 실제로 돌려 구운 것 하나면 화면이 다 선다
   *  (자리·방향·상태·종류·체력·업그레이드·마법·핑·로스터). 없으면 재생기는 아무것도
   *  안 그리고 "재생할 수 없는 게임"이라고만 말한다(요청: 폴백 없음). */
  loadUnitTracks?: () => Promise<{ motion: string | null }>;
  /** 이 시각(초)부터 재생 시작(요청: 카톡 공유 링크의 &t=) — 경기 길이를 넘으면 무시. */
  initialSec?: number;
  /** 이 사람을 **추적한 채로** 시작(요청: 공유 링크의 &tr=) — 그 판에서 쓴 게임 아이디다.
   *  로스터도 함께 켠다(첫 단): 누구를 따라가고 있는지가 안 보이면 추적이 그냥
   *  '화면이 저 혼자 움직이는 일'로만 보인다. */
  initialTrack?: string | null;
  /** 이 배속으로 시작(요청: 공유 파라미터에 속도 추가 — &s=). 사다리에 없는 값은 무시된다. */
  initialSpeed?: number;
  /** 이 자리에서 보기 시작(요청: 공유 링크의 &z=·&cx=·&cy=·&a=) — 보낸 사람이 보던
   *  배율·가운데점·각도다. 지도 상자가 실제로 서고 나서 한 번만 건다. */
  initialView?: { z: number; cx: number; cy: number; deg: number };
  /** 현재 재생 시각을 적어 둘 열쇠(경기번호) — 공유 링크가 &t=로 실어 보낸다. */
  clockKey?: string;
  /** 로스터에 프사를 그릴까(지시: 쓰는 개발자가 API로 켜고 끈다) — 기본은 그린다.
   *  거짓이면 앱이 프사를 꽂아 두었어도 안 그린다(chrome.ts의 replayAvatarOn). */
  avatars?: boolean;
  /** 이 재생기가 화면에 홀로 있나 — 상세 모달이나 게임 페이지처럼 한 판만 보고 있는
   *  화면이다. 갈라진 판 경고는 여기서만 뜬다(목록은 카드마다 재생기가 하나씩이라
   *  경고창이 겹친다). */
  soleView?: boolean;
  /** 진행바 아래 공유 버튼(요청: 케밥은 그대로, 별도 버튼) — 시계 옆에 앉는다. */
  shareNode?: React.ReactNode;
  /** ★ 장면 스크랩 — 함수를 주면 **버튼째** 여기서 그린다(지적: "버튼은 css까지 먹여서 네가 만들어서 기본값 제공해
   *  줘야지, 갖다 쓰는 쪽은 사용 여부 판단하고 기능만 붙이는 거고") ──────────────────────────────────────────────
   *  여태 스크랩은 앱이 제 버튼을 지어 공유 슬롯(shareNode)에 함께 꽂는 물건이었다. 그러다 보니 같은 줄에 선 셋
   *  (스크랩·공유·사용법) 가운데 스크랩만 앱의 기본 버튼 꼴로 남아, 이 파일의 CSS가 뒤늦게 그 꼴을 따라잡는
   *  술래잡기가 됐다(.scr-scrapbtn 규칙이 그 자취다). 꼴을 가진 쪽이 버튼도 가져야 한다.
   *  앱이 지는 것은 **담는 일**뿐이다 — 자리·꼴·단축키(Z)·완료 표시는 여기 몫이다. 안 주면 안 그린다.
   *  참(또는 참으로 풀리는 약속)을 돌려주면 잠깐 "담았어요"로 바뀐다. */
  onScrap?: () => string | boolean | void | Promise<string | boolean | void>;
  /** 스크랩 버튼의 글씨 — 기본 "장면 스크랩". */
  scrapLabel?: string;
  /** ★ 장면 공유 — 스크랩과 **같은 규약**이다(지적: "스크랩 버튼, 공유 버튼은 쓰는 쪽에서 쓸지 말지 선택하는
   *  거고 함수도 알아서 연결해야 해") — 함수를 주면 버튼째 여기서 그리고, 안 주면 안 그린다. 단축키는 X다
   *  (안내에 적힌 그 키). 앱이 지는 것은 **공유하는 일**뿐이다: 카카오든 navigator.share든 링크 복사든
   *  앱마다 다른 물건이라 그 속은 안 건드린다.
   *  글(문자열)을 돌려주면 그 글이, 참을 돌려주면 기본 글("링크 복사됨")이 1.8초 동안 뜬다.
   *  ※ shareNode(슬롯)는 그대로 남는다 — 제 꼴을 가진 버튼(카카오 알약 따위)을 꽂던 옛 길이다. 둘 다 주면
   *    모듈의 버튼이 서고 그 옆에 슬롯이 함께 선다. */
  onShare?: () => string | boolean | void | Promise<string | boolean | void>;
  /** 공유 버튼의 글씨 — 기본 "장면 공유". */
  shareLabel?: string;
  /** 사용법(요청: 공통) — 공유 버튼 옆 '사용법' 버튼. 기본은 재생기가 제 덮개(ReplayGuide)를 띄우고, onGuide를 주면 앱이 대신
   *  연다(제 라우팅으로 띄우고 싶을 때). guide=false면 버튼을 안 낸다. */
  onGuide?: () => void;
  guide?: boolean;
  // (삭제·요청) caps — 자막 표시를 걷으면서 함께.
}) {
  /* ★ 이 렌더가 든 시간을 잰다(조사: "핵폭발 멈춤") — 여기서 재고, 커밋 뒤 effect에서 넘긴다.
     핵·스톰 동안 박자가 25~60Hz로 오르므로(nukeStep9), 한 장이 그 박자보다 길면 그때부터
     주 실마리가 통째로 막힌다. #diag=draw의 "리액트" 줄이 그 둘을 나란히 보인다. */
  const rT09 = pNow();
  /* 렌더 함수 **전체**에 든 JS 시간 — 준비·mapNode만 재면 그 사이 수백 줄의
     훅과 useMemo가 안 잡힌다. 프레임주기에서 이것과 커밋을 빼야 브라우저 몫이 남는다. */
  const pRender9 = PERF9 ? pNow() : 0;
  /* 커밋 몫 — 렌더가 끝난 뒤 리액트가 옛 트리와 맞대 보고(조정) DOM을 실제로 고치는
     시간이다. 레이아웃 이펙트는 그 **직후·칠하기 전**에 도므로, 여기 시각에서 렌더가
     끝난 시각을 빼면 딱 그 몫이 나온다. 의존성을 안 주어 프레임마다 돈다. */
  useLayoutEffect(() => {
    if (PERF9 && perfState9.renderEnd) pAdd("커밋(리액트·DOM)", pNow() - perfState9.renderEnd);
    /* 렌더 + 커밋(이 훅은 커밋 **직후·칠하기 전**에 돈다)이 이 한 장의 값이다 — 위 rT09의 ★. */
    noteReact9(pNow() - rT09);
  });
  /* ★ 관전자는 **아예 없는 사람으로 친다**(요청: "관전자 자동 숨김 / 플레이어 로드시
     기본적으로 관전자쪽 화면은 안 보이게" → "관전자는 로스터에서도 제거") ──────────────
     거르는 자리를 로스터 그리는 데(teamCol)가 아니라 **여기 한 곳**으로 잡는다. 아래
     수십 군데가 bases를 이름·종족·편을 찾는 사전으로 쓰는데, 그리는 자리에서만 걸러 내면
     '표에는 없는데 지도에는 있는 사람'이 남는다 — 실제로 시점 후보·클릭 자국·이름표가
     각기 다른 목록을 보게 된다. 들어오는 문 하나를 좁히면 그 뒤는 저절로 따라온다.
     ★ 목록의 **정체(identity)를 지킨다**(useMemo) — bases는 건물 사전셈 캐시의 열쇠라
       (bldPreCache9) 프레임마다 새 배열을 만들면 그 캐시가 매번 깨진다.
     안 넘겨주면 아무도 안 걸러진다 — observer 칸이 없는 앱에서는 종전 그대로다. */
  const bases = useMemo(
    () => (basesIn.some((b9) => b9.observer) ? basesIn.filter((b9) => !b9.observer) : basesIn),
    [basesIn]);
  /** 관전자 이름 — 참값(entData)에서 온 것들을 거를 때 쓴다. 그쪽은 제 로스터를 따로
   *  들고 있어(entData.players) bases를 안 거치므로, 이름으로 맞춰 봐야 한다. */
  const obsNames = useMemo(
    () => new Set(basesIn.filter((b9) => b9.observer).map((b9) => b9.key)),
    [basesIn]);
  /* 경기 길이는 경기 메타(endSec)가 유일한 주다 — v1 모션을 걷어내면서 '건물·마법
     시각으로 어림하던' 폴백도 함께 걷었다. 메타가 없으면 60초로 서서 눈에 띈다. */
  const total = useMemo(() => (endSec && endSec > 0 ? endSec : 60), [endSec]);

  // 공유 링크의 시작 시각(요청) — 경기 길이 안일 때만 그 시점에서 시계를 세운다.
  const [t, setT] = useState(() =>
    initialSec !== undefined && initialSec > 0 && initialSec < total - 1 ? initialSec : 0);
  const [playing, setPlaying] = useState(true);
  /* 현재 재생 시각 기록(요청: 특정 시간으로 카톡 공유) — 공유 버튼이 이 값을 읽어
     링크에 &t=로 싣는다. 사라질 땐 지워 엉뚱한 경기에 안 붙게 한다. */
  useEffect(() => {
    if (clockKey) playbackClockOf.set(clockKey, t);
  }, [t, clockKey]);
  useEffect(() => () => { if (clockKey) playbackClockOf.delete(clockKey); }, [clockKey]);
  /* 배지 색 규칙(요청) — 배경은 팀 컬러, 테두리는 개인(게임 내) 컬러, 글자는 배경과
     대비되는 흰/검이다. 역할이 고정되면서 팀색/개인색 토글은 걷었다. */
  /* 개인색은 개체 트랙(entData.players[].color)에서만 온다 — v1 모션 트랙의 color는
     걷었다. 아래 modeColor가 이 표를 먼저 보고, 없으면 entData를 직접 뒤진다. */
  const colorByRaw = useMemo(() => new Map<string, string>(), []);
  /* 색은 한 벌만 칠한다(요청: 중복 표시 제거) — 팀색/개인색을 전환 버튼으로 오간다.
     개인색이 없는 옛 기록은 개인색 모드여도 팀색으로 떨어진다. */
  const [colorMode, setColorMode] = useState<"team" | "personal">("personal");
  /** 실제로 쓰는 색 갈래 — 밀리는 편이 없으니 늘 개인색이다(요청: 팀컬러 변경 비활성화). */
  const colorNow = melee ? "personal" : colorMode;
  /* 개체 트랙 — 화면이 그리는 **유일한** 자료다(v1 부대 추적은 걷었다). 뜨자마자 한 번
     내려받고, 못 받으면 아래 보기 줄이 '재분석 필요'라고 말한다: 자료가 없는 것과
     "그 경기엔 아무 일도 없었다"가 화면에서 갈려야 한다. */
  const [entData, setEntData] = useState<TruthWorld | null>(null);
  const [entLoad, setEntLoad] = useState<"idle" | "loading" | "none">("idle");
  /* 유닛의 자리·방향·상태 — 서버가 리플레이를 그대로 돌려 구운 참값이다. 태그로 찾는다.
     (이름이 sim으로 남은 것은 읽는 자리가 수백 군데라서다 — 값의 출처만 바뀌었다.) */
  const [simTracks, setSimTracks] = useState<Map<number, TruthTrack> | null>(null);
  /* 참값 원본 — 자원·실시간 APM은 v2 꼴에 자리가 없어 여기서 직접 읽는다. */
  const [truth, setTruth] = useState<TruthTracks | null>(null);
  /* 갈라진 판 경고(요청: "openbw결과가 부정확한 애들은 처음에 한번 경고창 띄우기 /
     페이지 진입시 한번") — 서버가 구울 때 '어디까지 믿어도 되는지'를 함께 적어 보낸다
     (OBWT 머리말의 믿을프레임). 그 값이 있다는 것은 시뮬이 도중에 실제 경기와 갈라졌다는
     뜻이다. 여태 받아만 놓고 아무 데도 안 쓰고 있었다.
     ★ 이 재생기가 화면에 홀로 있을 때만 띄운다(soleView) — 활동 목록은 카드마다
       재생기가 하나씩이라, 목록에서 띄우면 경고창이 여러 개 겹쳐 뜬다.
       ★ 여태 그 자격을 onDetailClose(상세 모달의 닫기 통로)로 갈음했는데(지적:
         "분석오류도 경고가 안뜨네"), 게임 페이지(활동 › 게임 › 번호)는 그 컨텍스트를
         일부러 안 씌운다("GameDetailClose 컨텍스트를 안 씌우므로" — ActivityScreen).
         그래서 정작 사람이 제일 오래 머무는 화면에서 경고가 한 번도 안 떴다. 자격을
         제 이름의 prop으로 받는다. */
  /* (걷어냄) trustWarn 상태 — 경고가 모달이던 시절, '지금 떠 있나'를 화면이 들고
     있어야 했다. 토스트는 제가 뜨고 제가 진다(showToast) — 화면은 알릴 거리가 생긴
     그 순간에 한 번 부르기만 하면 되고, 들고 있을 상태가 없다. */
  /* 클릭 자국 토글(요청) — 기본은 끔: 클릭이 많은 경기에서는 자국이 화면을 덮는다. */
  /* 손잡이(도구 판의 알약)는 걷었다(요청: 도구 오버레이 미사용) — 값은 남아 이 화면의
     기본으로 굳는다. 다시 켤 때 setter만 도로 꺼내면 된다. */
  const [clickFx] = useState(true); // 기본 켬(요청)
  /* 사양 라디오(요청: "성능 3단계로 수정(저/중/고) 이러면 딱 LOD랑 맞고 편하지") —
     값이 **곧 모델 부품 등급(LOD)**이다: 1 저=형체만 · 2 중=+포인트 · 3 고=+장식.
     렌더 요소도 같은 세 칸에 접었다(옛 다섯 칸의 최저는 저로, 최고는 고로 합쳤다):
       저 1 — 접지 그림자·체력바·죽음 효과
       중 2 — +전투·공사 애니·크립
       고 3 — +겹침 그림자·핑(전부 켬)
     한 자리에서 모델 정밀도와 효과가 같이 오르내려, 고르는 쪽도 한 눈금만 본다. */
  /* 손잡이(품질 알약)는 도구 판과 함께 걷혔다 — 값만 남아 '고'로 굳는다(요청: 미사용).
     다시 켤 때 setter만 도로 꺼내면 된다. */
  const [quality] = useState(3);   // 기본 고(요청)
  // 체력바 보임/숨김(요청: 라디오화) — 사양 게이트와 곱해진다.
  const [hpShow] = useState(true);   // 손잡이는 걷었다(위와 같은 사정) — 늘 켬.
  // 모델 굽기가 이 상한을 읽는다 — 그리기 전에 세워 둔다(모듈 전역, lodPenalty와 같은 결).
  lodSetCap(quality);
  const qHp = true;
  const qDeath = true;
  /* 낮은 사양에서는 그림자를 끈다(요청: "대신 그림자 반사 등 효과를 없애서 부하
     감축하지뭐") — LOD 티어0에 지배색·개인색 부품이 다 들어오면서 부품 솎기로 버는
     몫이 줄었다. 그 값을 화면 효과 쪽에서 치른다. 실루엣 광원은 원래부터 최고 등급
     에서만 얹는다. */
  const qShadows = quality >= 2;
  /* (걷어냄) qCombat — 전투 효과 전체를 사양 '중'부터 켜던 스위치다. 지적으로 갈래가
     새로 그어졌다(요청: "피격효과 트레이서 사망효과는 저사양에서도 나와야해 / 대신
     건물 손상 효과는 중부터").
     그 셋은 **무슨 일이 벌어지는지**를 말하는 그림이라 사양을 안 탄다 — 저에서 꺼 두면
     유닛이 소리 없이 녹고, 재생이 무슨 상황인지 못 읽히는 장면이 된다. 대신 건물 손상
     (불길·연기·피)은 상태를 이미 체력바가 말하고 있으므로 '중'부터다.
     솎기(세 개체에 하나)와 LOD는 그대로라 저사양의 그리기 부담은 여전히 낮다. */
  const qBuildFx = quality >= 2;
  // `#nocreep` 해시로 크립을 끈다(도구용: scene-sheet의 격자 비교 장면 — 크립이 격자를 덮는다).
  const qCreep = quality >= 2 && !(typeof location !== "undefined" && /nocreep/.test(location.hash));
  const qOverlap = quality >= 3;
  const qPing = quality >= 3;
  /** 애니메이션(요청: "품질 저에서 모든 애니메이션 제거하기 / 필수적인거만 살림
   *  (트레이서, 파괴/죽음)") ──────────────────────────────────────────────────────
   *  애니메이션의 삯은 그리는 양이 아니라 **판을 굽는 횟수**다: 자세 컷(걸음 1↔3,
   *  공격 2·4·5)과 회전 칸(톱니·팬·디스크 여덟), 건물 불빛 깜빡임은 전부 굽기 열쇠를
   *  갈라 종류마다 판을 여러 벌 굽게 만든다. 저사양에서 그것을 끄면 종류당 판 한 장만
   *  남아 굽기가 통째로 사라진다.
   *  ★ 트레이서·피격·죽음은 여기 안 든다 — 그것들은 캔버스에 곧장 그리는 fx라 굽기가
   *    없고, 무엇보다 **무슨 일이 벌어지는지**를 말하는 그림이다(앞선 요청: "피격효과
   *    트레이서 사망효과는 저사양에서도 나와야해"). */
  const qAnim = quality >= 2;
  /* (제거·요청) 좌우 동시 보기(비교) — forceEnt·syncKey·syncRole·신호줄까지 걷었다. */
  useEffect(() => {
    if (loadUnitTracks && !entData && entLoad === "idle") void loadEnt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUnitTracks]);
  /* 토글이 아니라 로더다 — 켜고 끄는 길은 없다(갈래가 하나뿐인데 스위치를 두면 거짓말
     이다). 실패는 entLoad === "none"으로 남아 화면에 그대로 드러난다. */
  const loadEnt = async (): Promise<void> => {
    if (entData || !loadUnitTracks || entLoad === "loading") return;
    setEntLoad("loading");
    try {
      /* 자취는 zlib+varint로 눌려 온다 — 푸는 데 26분짜리 8인전이 100ms쯤이다.
         이 안에 자리·체력·업그레이드·마법·핑·로스터가 다 들어 있다. */
      const got = await loadUnitTracks();
      const truth = got.motion ? await decodeTruthTracks(got.motion) : null;
      /* ★ 못 쓴 까닭을 **반드시 적어 둔다**(지적: "지금 모든 경기가 거의 다 재생할 수
         없는 게임이에요라고 나온다") — 여태 진단(truthVer)은 성공 갈래 **안**에만
         있었다. 그래서 정작 알고 싶은 실패한 판에서는 판 번호가 0으로 남아, 서버가
         새 판으로 굽기 시작한 것인지 화면이 못 읽는 것인지 가릴 자료가 없었다.
         못 푼 때는 머리만 따로 엿봐(peekTruthHead) 판을 알아낸다 — 물리친 것과 애초에
         OBWT가 아닌 것은 다른 사건이고, 고칠 자리도 다르다. */
      if (!truth) {
        const h9 = got.motion ? await peekTruthHead(got.motion) : null;
        SCR_DIAG.truthVer = h9?.version ?? 0;
        SCR_DIAG.truthWhy = !got.motion ? "자취를 아예 못 받았다"
          : !h9 ? "못 풀었다(zlib이 아니거나 깨졌다)"
            : !h9.ok ? "OBWT가 아니다"
              : `판 ${h9.version}을 해독기가 물리쳤다 — 이 꾸러미는 2~7만 읽는다`;
      } else if (!truth.tracks.length) {
        SCR_DIAG.truthVer = truth.version;
        SCR_DIAG.truthTrust = truth.trustUntil ?? -1;
        SCR_DIAG.truthWhy = `트랙이 0개다 — 덤퍼가 재구성을 못 했다`
          + `(믿을프레임 ${truth.trustUntil === null ? -1 : Math.round(truth.trustUntil * 24)}`
          + `, 남은 바이트 ${truth.leftover})`;
      } else {
        SCR_DIAG.truthWhy = "";
      }
      /* ★ 창에 **늘** 내건다 — 여태 window.__scrDiag는 유닛 캔버스가 프레임마다 도는
         자리에서, 그것도 #diag가 켜져 있을 때만 붙었다. 그런데 재생을 못 하는 판에는
         유닛 캔버스가 아예 안 서므로 **정작 알고 싶은 때 진단이 없었다**. 여기는 자취를
         받고 한 번 지나는 자리라 값이 안 든다. */
      (window as unknown as { __scrDiag?: unknown }).__scrDiag = SCR_DIAG;
      if (truth && truth.tracks.length) {
        setEntData(truthWorld(truth, (k) => UNIT_BUILD_SEC[k] ?? 0));
        setTruth(truth);
        // 진단용 — 이 뭉치를 어느 판의 덤퍼가 구웠나(위 truthVer 주석).
        SCR_DIAG.truthVer = truth.version;
        SCR_DIAG.truthTrust = truth.trustUntil ?? -1;
        /* 알림을 **확실한 것만** 내도록 좁혔다(2026-08-26).

           옛 알림("재구성이 N까지만 실제와 같아요")은 **거짓 정보였다.** 그 N은 덤퍼의
           `bwdump_trust_frame()`이 어림한 값인데, 실기 1.16.1과 **끝까지 한 프레임도 안
           틀리는** 판 열에 돌렸더니 후보 세 가지가 전부 울었다:
             ①헌 태그 참조 8/8 · ②출생 전 참조 8/8 · ③겨냥 어긋남 — 참값과 26.4분까지
             증명된 일치 구간에서 중앙값 3,000픽셀.
           셋 다 **태그 해석 잡음**을 잰 것이지 시뮬 정확도를 잰 게 아니었다.

           그래서 이제 덤퍼는 두 값만 낸다 — **0(재구성 불가)** 또는 **−1(말 안 함)**.
           0은 어림이 아니라 사실이다: 컴퓨터(AI) 플레이어가 꼈거나, 안 만든 트리거를
           만났거나, 컴퓨터 AI 명령이 나왔다는 뜻이다(그 판 열에서 셋 다 조용했다).
           자세히는 tools/openbw/bwdump.cpp의 bwdump_trust_frame 머리말.

           ⚠ **이미 구워 둔 자취는 옛 어림값(0보다 큰 N)을 그대로 들고 있다.** 그래서
           여기서는 `< 1`인 것만 본다 — 재분석 전에도 거짓 알림이 안 뜬다. */
        if (truth.trustUntil !== null && truth.trustUntil < 1 && soleView) {
          /* 자리는 **지도 한가운데**다(요청) — 이 알림은 body로 포털되므로 제 힘으로는
             지도가 어디인지 모른다. 부르는 이 자리에서 무대(창) 상자를 재서 넘긴다.
             아직 안 서 있으면(상자 0) 안 넘기고 화면 한가운데로 둔다. */
          const box9 = stageRef.current?.getBoundingClientRect();
          replayToast(
            "이 경기는 재구성을 실제와 맞출 수 없어요 — 장면은 참고만 해 주세요.",
            {
              kind: "warn",
              ms: 2500,
              ...(box9 && box9.width > 0
                ? { at: { x: box9.left + box9.width / 2, y: box9.top + box9.height / 2 } }
                : {}),
            },
          );
        }
        // 트랙 지도는 안 만든다 — 참값은 워커에 넘겨 메인의 배열이 비고, 이 값은 '받았다'로만 쓰인다.
        setSimTracks(new Map());
        setEntLoad("idle");
      } else {
        setEntLoad("none");
      }
    } catch (e) {
      /* 여기로 새는 것은 **받는 중에 던진** 경우다(그물·404·서버 오류) — 여태 아무
         말도 안 남겨, 화면의 "재생할 수 없는 게임"이 판 문제인지 배달 문제인지
         가려지지 않았다. */
      SCR_DIAG.truthWhy = `자취를 받다 던졌다 — ${e instanceof Error ? e.message : String(e)}`;
      setEntLoad("none");
    }
  };
  /* v2 어댑터(요청: 건물까지 모든 정보를 한 테이블에 — 나중에 v1만 싹 걷어내게) — 개체
     트랙의 건물·마법을 v1과 똑같은 튜플로 바꿔, 아래의 건물·크립·채굴·마법 렌더 전부가
     소스만 갈아 끼우면 되게 한다. v2를 켜면 장면 전체(유닛·건물·마법)가 v2 데이터다. */
  /* ★ 파생 자료는 **엔진 세계**(deriveWorld9) 하나로 — 옛 useMemo 사슬(건물 행·개체 걷기·생산·업글…)이
     전부 거기 있다. 참값·지도·기지가 바뀔 때만 다시 센다. 화면(UI)이 읽는 것은 여기서 꺼내 쓴다. */
  /** 편 표(임자 → 편) — 세계·워커가 함수 대신 이 표를 쓴다. 문자열 열쇠로 견줘 부모가 매 렌더 새 함수를
   *  내려도 세계를 다시 안 센다. */
  const teamMap9 = useMemo(() => {
    const m9: Record<string, 1 | 2> = {};
    for (const b9 of bases) { const tm9 = teamOfRaw(b9.key); if (tm9) m9[b9.key] = tm9; }
    for (const pl9 of entData?.players ?? []) { const tm9 = teamOfRaw(pl9.name); if (tm9) m9[pl9.name] = tm9; }
    return m9;
  }, [bases, entData, teamOfRaw]);
  const teamKey9 = JSON.stringify(teamMap9);
  const teamMapRef9 = useRef(teamMap9);
  teamMapRef9.current = teamMap9;
  /* ★ 파생 자료는 **워커**가 센다(요청: 메인의 중복 파생 자료 제거). 화면(UI)이 읽는 몇 가지는 워커가 세계를
     세운 뒤 한 번 보내 준다(worldui). 오기 전 몇 ms는 빈 표를 본다. */
  const [worldUi9, setWorldUi9] = useState<WorldUi9 | null>(null);
  /** 워커가 **개체 있는** 세계를 세웠나 — 안개는 이때부터(지적: 첫 장면 뒤 지도가 새까맣게 한 번 깜박임 — 참값 오기 전
   *  빈 세계로 지은 첫 장의 안개가 '본 곳 0%'였다). */
  const [worldEnts9, setWorldEnts9] = useState(false);
  const world: WorldUi9 = worldUi9 ?? emptyWorldUi9();
  const { buildsSrc, castsSrc, nukeLase, gasBuildings, prodDoneAt, prodDoneByRaw, upsByRaw, nukeImpacts } = world;
  /** 걷기 — 추적을 켤 때 워커에 청해 받는다(아래 want walks). 세계가 바뀌면 비운다. */
  const [entWalks9, setEntWalks9] = useState<EngineWorld9["entWalks"]>([]);
  const entWalks = entWalks9;
  const walksAskedRef9 = useRef<string | null>(null);
  /** 세계 세대 — 워커가 새 worldui를 보낼 때마다 오른다(걷기를 다시 청하는 자). */
  const [worldGen9, setWorldGen9] = useState(0);
  /** 워커가 어림한 제 메모리(참값·파생) — ready에 실려 온다. */
  const [memWorker9, setMemWorker9] = useState<{ truth: number; world: number; typed?: number; top?: [string, number][] } | null>(null);
  /* ★ 프레임 워커 = 설계 일꾼(요청) — 주인(여기 재생 상태)의 명령만 받아 앞으로 설계도를 지어 두고, 붓은 받은 것만
     그린다. **길은 이것 하나다**(지적: 메인 엔진 대비 코드는 두 길이라 별로) — 워커가 못 서면 프레임이 없고, 화면은
     마지막 프레임을 든 채 진단(SCR_DIAG.worker)에 까닭을 적는다. 도구 번들(esbuild)에는 워커가 없다. */
  const frameWorkerRef = useRef<Worker | null>(null);
  const wFramesRef = useRef<Map<number, PackedFrame9>>(new Map());
  /** 워커가 보낸 안개 판들(바뀐 장에만 실린다) — 장을 풀 때 그 시각 이하 가장 늦은 판을 붙인다. */
  const fogSnapsRef9 = useRef<{ t: number; fseq: number; fog: NonNullable<PackedFrame9["fog"]> }[]>([]);
  /** ★ **프레임마다 온 눈 목록**(엔진 eyes9 ★) — 시각순. 붓은 안개 판이 아니라 이것으로 앞뒤를 잇는다(fogPairFor9).
   *  뒤로는 2초만 든다(되감기용이 아니다 — 되감으면 워커가 새로 짓는다). 장당 8KB 남짓. */
  const eyeSnapsRef9 = useRef<{ t: number; fseq: number; vis: Float32Array }[]>([]);
  /** 안개 갈래 — 시야 주인·전체시야·안개 켬(fogKey)이 바뀔 때마다 오르고 시야 명령에 실린다. */
  const fogSeqRef9 = useRef({ key: "", seq: 0, seen: 0, firstT: -1 });
  /** 본 가장 높은 세대(위 PackedFrame9.gen) — 붓은 이 세대의 장을 먼저 고른다. */
  const genSeenRef9 = useRef({ seen: 0 });
  /** 붓이 마지막으로 그린 앞 장의 시각 — 고르기는 이보다 뒤 시각의 장으로 **되돌아가지 않는다**(아래 pickWorkerFrame9).
   *  되짚기(감기)에서 새 세대의 첫 장은 명령 시각(t0)에서 시작하는데, 그 사이 붓은 옛 세대의 앞 장을 이미 더 나아가
   *  그렸다. 새 세대를 무조건 먼저 고르면 그림이 t0로 되돌아갔다가 다시 나아가는 톱니가 난다(실측: 0.8초 주기). */
  const lastDrawT9 = useRef(-1);
  /** 붓이 그리는 장의 시점 원점(PackedFrame9.ox·oy) — 지형 CSS 변환과 안개·DOM 효과의 사영이 **이 값**을 쓴다. 굳은
   *  상태의 원점(pitchGeom().ox·oy)은 워커에 보내는 목표이고, 새 세대의 장이 오기까지 화면은 옛 원점으로 한 몸이어야
   *  지도와 유닛이 어긋나지 않는다. 바뀌면 지형 변환을 바로 다시 건다(paintFnRef9). */
  const drawnOrgRef9 = useRef({ ox: 0, oy: 0 });
  /** 마지막으로 **그린 장의 세대** — 고르기가 이보다 낮은 세대로는 안 내려간다(아래 ★ 단조 규칙). */
  const drawnGenRef9 = useRef(-Infinity);
  /* ★ **손짓 중에도 시야(원근 원점)를 흘려보낸다**(요청: "드래그를 놓았을 때 시점이 바뀌는 건 여전한데") ────
     3D의 원근 원점(geom.ox·oy)은 팬·배율에서 나오고, 그 값이 워커에 보내는 시야 열쇠에 들어간다. 그런데
     손짓 중에는 상태(zoom·pan)가 안 움직이므로(refs만 움직인다) 렌더가 안 돌고, 그래서 **원점이 얼어 있었다**:
     워커는 옛 원점으로 계속 설계도를 짓고 붓은 그것을 밀어서(translate) 보여 줄 뿐이라 원근이 안 따라오다가,
     손을 떼는 순간 상태가 굳으며 새 원점으로 다시 사영돼 툭 바뀐다.
     이제 손짓이 그리는 자리에서 **손끝 기하**로 시야를 다시 보낸다(LIVE_VIEW_MS9 간격). 워커는 새 원점으로
     설계도를 지어 보내고, 원점이 바뀐 장이 도착하면 지형·안개도 같은 눈으로 다시 칠해진다(drawnOrgRef9의 그 길).
     간격을 두는 까닭은 원점이 바뀔 때마다 워커가 앞장을 버리고 다시 짓기 때문이다 — 너무 잦으면 짓기만 하다
     한 장도 못 낸다. 평면(2D)에서는 원점이 0이라 아무 일도 안 한다. */
  const engViewRef9 = useRef<EngineView9 | null>(null);
  const colorTableRef9 = useRef<Record<string, string> | null>(null);
  const pitchGeomLiveRef9 = useRef<(() => PitchGeom9) | null>(null);
  const liveViewAtRef9 = useRef(0);
  /** ★ 이 손짓에서 원근을 따라가게 할까 — **손짓이 시작될 때 한 번** 정하고 끝까지 지킨다(계측: 아래 ★★).
   *  도중에 켜고 끄면 재는 값 자체가 그 조치의 결과라 진동한다(배킹 몫에서 이미 겪었다). */
  const liveViewOkRef9 = useRef(false);
  /** 손짓 중 못 박아 둔 **밀림 기준 원점** — 손짓 밖에서는 null(제 원점을 따른다). PitchGeom9.sox의 ★. */
  const shearOxRef9 = useRef<number | null>(null);
  const postLiveView9 = useCallback((): void => {
    const w9 = frameWorkerRef.current;
    const base9 = engViewRef9.current;
    const geomOf9 = pitchGeomLiveRef9.current;
    if (!w9 || !base9 || !base9.pitched || !geomOf9) return;
    if (!liveViewOkRef9.current) return;   // 이 손짓은 종전대로 — 원근은 손을 뗄 때 맞춘다(위 ★)
    const now9 = performance.now();
    if (now9 - liveViewAtRef9.current < LIVE_VIEW_MS9) return;
    const v9: EngineView9 = { ...base9, geom: geomOf9() };
    const key9 = viewKeyOf9(v9);
    const sent9 = viewSentRef9.current;
    if (sent9 && sent9.key === key9) return;
    liveViewAtRef9.current = now9;
    const col9 = colorTableRef9.current ?? sent9?.colors;
    if (!col9) return;
    viewSentRef9.current = { key: key9, colors: col9 };
    wStatRef.current.sentView += 1;
    // 안개 갈래는 안 바뀐다(시야 주인·전체시야·안개 켬 셋이 그대로다) — 지금 번호를 그대로 싣는다.
    /* live: 끄는 중의 시야다 — 워커는 앞으로 안 짓고 지금 한 장만 짓는다(frameWorker의 ★).
       그래야 시야 하나에 뭉치 하나가 안 붙어 큐가 안 밀린다(계측: 뒤짐 403px · 역행 8/19). */
    w9.postMessage({ type: "view", view: v9, seq: wStatRef.current.sentView, fogSeq: fogSeqRef9.current.seq, live: true });
    /* ★ (걷어냄) 여기서 **앞장을 버리던 자리** — 지적: "드래그 중에는 변화가 없다가 놓으면 시점이 막 흔들려
       한동안". 그 증상의 범인이 이 세 줄이었다 ────────────────────────────────────────────────────────
       120ms마다 보내던 시절엔 옛 원점의 앞장이 새 장과 섞여(교차) 보였고, 그래서 보낼 때 앞장을 걷었다.
       그런데 이제는 **프레임마다** 보낸다: 워커가 지금 시각보다 조금 앞선 장을 지어 보내면, 다음 프레임의
       보내기가 그 장을 **그려 보기도 전에** 지워 버린다. 그러니 끄는 동안 화면은 늘 마지막으로 그린 옛 장에
       머물고(변화 없음), 손을 떼 보내기가 멎으면 그제야 쌓인 장들이 차례로 그려지며 한동안 출렁였다.
       계측이 그대로 말한다 — 받은 장 1373 가운데 **쓴 것 412**, 앞 0.1초·22장.
       걷는 일은 받는 쪽 규칙이 이미 한다(새 차례의 장이 도착하면 그 시각 이후의 옛 차례 장을 밀어낸다).
       프레임마다 보내는 지금은 옛 차례래야 한 프레임(16ms) 낡은 원근이라 섞여도 눈에 안 띈다. */
  }, []);
  const instIdRef9 = useRef(0);
  const lastPlaying9 = useRef<boolean | null>(null);
  const wStatRef = useRef({
    got: 0, used: 0, missed: 0, err: "", sentWorld: 0, sentView: 0, sentCmd: 0,
    /** 워커가 세계를 받아 엔진을 세웠다(ready). 세계를 보낸 뒤 오래 안 오면 진단에 '응답 없음'. */
    ready: false, worldAt: 0,
    /** 워커가 잰 프레임 한 장 짓는 시간(ms, 지수 평균) — 폰에서 워커가 시계를 못 따라가는지 본다. */
    buildMs: 0,
    /** 장당 유닛 op 수·싼 크기(KB), 지수 평균 — 컬링이 먹는지 본다. */
    ops: 0, kb: 0,
    /** 짓기의 속(지수 평균): 엔진 ms · 싸기 ms · 안개 쌓기 ms, 누적 안개 횟수·리셋 횟수, 워커 시계 − 주인 t(초). */
    engMs: 0, packMs: 0, fogMs: 0, fogN: 0, resets: 0, skew: 0, duty: 0,
  });
  const lastFrameRef9 = useRef<[Frame9 | null, Frame9 | null]>([null, null]);   // 경로별(칸 0 렌더 · 1 틱) — 위 풀과 같은 까닭
  const fpsMeterRef9 = useRef({ n: 0, at: 0 });
  const fpsOnlyRef9 = useRef(false);
  const [fpsTick9, setFpsTick9] = useState(0);
  void fpsTick9;
  /** 보간 op 풀 — 개체 열쇠마다 op 객체 하나를 두고 장이 바뀌어도 그 객체에 값만 덮어쓴다(그리기마다 객체를 안 만든다). */
  /* ★ 풀·되쓰는 배열은 **부르는 쪽마다 따로**(칸 0 = 렌더 경로 frameAt9(t) · 칸 1 = 틱 경로 frameAt9(tLive)) ─────
     지적: "감을 때 유닛·건물이 흔들리고 안개는 재생 중에도 흔들린다". 두 경로가 한 풀을 나눠 쓰면 렌더가 상태 t(틱보다
     100ms까지 뒤)로 같은 객체·배열에 값을 덮어쓰고, 붓이 그 객체(frameOpsRef9·안개 눈 목록)를 곧 찍으므로 그림이
     't 자리'와 'tLive 자리'를 번갈아 났다. 서로 다른 객체를 쓰면 한 경로의 셈이 다른 경로의 그림을 못 건드린다. */
  const lerpPoolRef9 = useRef<[Map<string, UnitDrawOp>, Map<string, UnitDrawOp>]>([new Map(), new Map()]);
  /** 눈 목록 보간용 되쓰는 배열과 판 번호(아래 lerpFrame9) — 경로별. */
  const visLerpRef9 = useRef<[{ buf: Float32Array | null; ver: number }, { buf: Float32Array | null; ver: number }]>([{ buf: null, ver: 0 }, { buf: null, ver: 0 }]);
  /** ★ 눈 목록의 **단조 빗장**(슬롯별) — 마지막으로 **낸** 목록 한 벌과 그 시각. 아래 ★ 참고. */
  const visMonoRef9 = useRef<[{ buf: Float32Array | null; ver: number; t: number }, { buf: Float32Array | null; ver: number; t: number }]>(
    [{ buf: null, ver: 0, t: -1 }, { buf: null, ver: 0, t: -1 }],
  );
  /** 빗장이 걸린 장을 담아 낼 껍데기(슬롯별 하나) — 앞 장 캐시를 못 건드리므로. */
  const holdFrameRef9 = useRef<[Frame9 | null, Frame9 | null]>([null, null]);
  const lerpFrameRef9 = useRef<[{ frame: Frame9; ops: UnitDrawOp[] } | null, { frame: Frame9; ops: UnitDrawOp[] } | null]>([null, null]);
  /** 붓 박자 통계(진단) — t 걸음(ms)·같은 앞 장을 되풀이한 횟수·뒤 장이 없던 횟수. */
  const brushStatRef9 = useRef({ lastT: -1, stepSum: 0, stepMax: 0, stepN: 0, lastA: -1, sameA: 0, noB: 0, gapB: 0, draws: 0 });
  /** 워커에 마지막으로 보낸(보낼) 세계 — 워커가 늦게 서면(동적 import) 그때 다시 보낸다. */
  const worldMsgRef9 = useRef<unknown>(null);
  /* ★ 붓을 React 밖에서(4번) — 시계 틱이 프레임마다 설계도를 골라 캔버스를 곧장 칠한다(paintFnRef9). React 상태 t는
     초당 열 번만 올린다(REACT_STEP_MS9): 시간 표시·DOM 효과·미니맵·안개는 그 박자면 족하고, 유닛·효과 캔버스는 틱이 쥔다. */
  const tLiveRef9 = useRef(0);
  const tFromTickRef9 = useRef(-1);
  /* 멈춘 동안 새 장이 오면 React를 한 번 깨우는 박자(아래 frame 갈래의 ★) — 100ms에 한 번으로 죈다. */
  const [pausedTick9, setPausedTick9] = useState(0);
  const pausedWakeRef9 = useRef<number | null>(null);
  void pausedTick9;
  const reactAtRef9 = useRef(0);
  /** 지금의 React 박자(ms) — 늘 REACT_STEP_MS9다(핵·스톰이 박자를 올리던 자는 걷혔다). */
  const reactStepRef9 = useRef(REACT_STEP_MS9);
  /** 핵·스톰 연출이 떠 있나 — 붓이 이 깃발일 때만 핵 시계를 긁는다(위 nukeClockTick9). */
  const nukeOnRef9 = useRef(false);
  /** 긴 틈이 있었다 — 다음 rAF에서 배킹이 살아 있나 한 점 찍어 본다(위 LOST9). */
  const lostCheckRef9 = useRef(false);
  const paintFnRef9 = useRef<((tNow: number, rebase?: boolean, fogOnly?: boolean) => void) | null>(null);
  const frameOpsRef9 = useRef<UnitDrawOp[] | null>(null);
  const frameFxRef9 = useRef<FxOp[] | null>(null);
  /** 주인의 지금 상태(렌더마다 갱신) — 프레임 버림·안개 판 정리의 자. */
  const cmdNowRef9 = useRef<{ playing: boolean; t: number; speed: number }>({ playing: false, t: 0, speed: 1 });
  /** 워커에 보낸 마지막 명령 — 바뀔 때만 다시 보낸다(주인의 명령은 매 프레임이 아니다). */
  const cmdSentRef9 = useRef<{ playing: boolean; t0: number; speed: number; at: number } | null>(null);
  const viewSentRef9 = useRef<{ key: string; colors: Record<string, string> } | null>(null);
  /** 워커가 (다시) 서면 렌더를 한 번 일으켜 시점·명령을 보내게 한다(멈춘 화면은 렌더가 없다). */
  const [workerTick9, setWorkerTick9] = useState(0);
  /** 참값은 워커에 **넘긴다**(transfer, 요청: 세계의 주인을 하나로) — 트랙의 형식 배열 버퍼를 통째로 옮기고 메인에는
   *  껍데기(detached 배열)만 남는다. 메인이 트랙 배열을 읽는 자리는 없다(자원 그래프 res·판 번호·개체 표 entData는
   *  넘기기 전에 만든 것이라 남는다). 같은 참값을 두 번 안 넘긴다. */
  const truthRef9 = useRef<TruthTracks | null>(null);
  const entDataRef9 = useRef<TruthWorld | null>(null);
  const truthSentRef9 = useRef<TruthTracks | null | undefined>(undefined);
  const postTruth9 = (w9: Worker): void => {
    const lt09 = pNow();
    const tr9 = truthRef9.current;
    if (truthSentRef9.current === tr9) return;
    truthSentRef9.current = tr9;
    const bufs9: Transferable[] = [];
    if (tr9) {
      const seen9 = new Set<ArrayBufferLike>();
      for (const tk9 of tr9.tracks) {
        for (const arr9 of [tk9.kt, tk9.kxy, tk9.kh, tk9.kst, tk9.done, tk9.air, tk9.cloak, tk9.types, tk9.hp, tk9.ic, tk9.tgt]) {
          if (arr9 && arr9.byteLength > 0 && !seen9.has(arr9.buffer)) { seen9.add(arr9.buffer); bufs9.push(arr9.buffer as ArrayBuffer); }
        }
      }
    }
    w9.postMessage({ type: "truth", truth: tr9 }, bufs9);
    /* 넘긴 뒤 메인의 트랙은 **비운다** — 형식 배열은 transfer로 이미 비었지만 체력·인터셉터·표적 같은 쌍 배열은
       복제라 남는다(계측: 폰에서 메인 참값 40.8MB). 메인이 트랙을 읽는 자리는 없다(개체 표·자원 그래프·판 번호는
       따로 있다). 배열을 비우면 트랙 객체가 통째로 걷힌다. */
    if (tr9) tr9.tracks.length = 0;
    /* 개체 표(entData)의 생애도 체력·인터셉터·표적 쌍 배열을 생애마다 잘라 든다(truthLives의 filter) — 메인의 화면은
       그 셋을 안 읽는다(체력바는 op에 실려 오고, 화면이 읽는 건 명령·자리·생애 경계뿐). 워커는 제 개체 표를 참값에서
       따로 만드니 여기 것은 비워도 된다(계측: 폰 메인 개체 39.7MB). */
    const ed9 = entDataRef9.current;
    /* 메인의 화면이 읽는 생애 필드는 born·died·owner·kind·bld·tag·orders뿐(1번: 개체 표 두 벌 줄이기). 자리 열
       (sites)·이착륙·은신·시즈 구간은 워커 것만 쓰이므로 빈 배열(공유)로 바꿔 놓는다 — 객체는 그대로, 배열만 놓는다. */
    if (ed9) {
      for (const lf9 of ed9.lives) {
        lf9.hp = undefined; lf9.ic = undefined; lf9.tgt = undefined;
        lf9.sites = EMPTY_ARR9; lf9.lifts = EMPTY_ARR9; lf9.cloaks = EMPTY_ARR9; lf9.sieges = EMPTY_ARR9;
      }
    }
    LOAD9.truthMs += pNow() - lt09;
  };
  useEffect(() => {
    if (typeof Worker === "undefined") { wStatRef.current.err = "Worker 없음"; return undefined; }
    let w9: Worker | null = null;
    let dead9 = false;
    const frames9 = wFramesRef.current;
    /* ★ 워커 모듈은 **동적으로** 부른다 — vite는 `?worker&inline`을 인라인 워커 생성자로 만들고,
       도구 스크립트의 esbuild 번들(model-shot·perf-check…)은 그 접미사를 몰라 보통 모듈로 묶는다
       (default가 없다). 그 경우 그냥 워커 없이 간다 — 도구는 워커가 필요 없다. */
    void import("./frameWorker?worker&inline").then((mod9) => {
      if (dead9) return;
      const Ctor9 = (mod9 as { default?: unknown }).default;
      if (typeof Ctor9 !== "function") { wStatRef.current.err = "워커 모듈 없음(도구 번들)"; return; }
      const lw09 = pNow();
      try { w9 = new (Ctor9 as new () => Worker)(); } catch (e9) { wStatRef.current.err = `워커 생성 실패 ${String(e9).slice(0, 80)}`; return; }
      LOAD9.wkMs = pNow() - lw09;
      wire9(w9);
      frameWorkerRef.current = w9;
      viewSentRef9.current = null;
      cmdSentRef9.current = null;
      if (worldMsgRef9.current) {
        wStatRef.current.sentWorld += 1;
        wStatRef.current.ready = false;
        wStatRef.current.worldAt = pNow();
        w9.postMessage(worldMsgRef9.current);
      }
      postTruth9(w9);
      setWorkerTick9((k9) => k9 + 1);
    }).catch((e9) => { wStatRef.current.err = `워커 모듈 못 부름 ${String(e9).slice(0, 80)}`; });
    const wire9 = (wk9: Worker): void => {
    wk9.onmessage = (ev: MessageEvent<{ type: string; message?: string; ui?: WorldUi9 } & Partial<PackedFrame9>>) => {
      if (dead9) return;
      /* 이 실마리에서 워커 장을 받는 값(위 WORK9) — 푸는 것은 워커여도 **받는 것은 메인**이다. */
      const wk09 = pNow();
      const m9 = ev.data;
      if (m9.type === "frame" && m9.buf && m9.strs && typeof m9.t === "number") {
        const pf9: PackedFrame9 = { t: m9.t, buf: m9.buf, strs: m9.strs, fog: m9.fog ?? null, eyes: m9.eyes ?? null, ms: m9.ms ?? 0, n: m9.n ?? 0, seq: m9.seq ?? 0, fseq: m9.fseq ?? 0, gen: m9.gen ?? 0, ox: m9.ox ?? 0, oy: m9.oy ?? 0 };
        /* ★ 세대 경계(지적: "빨리감기 때 유닛·건물이 흔들린다") — 감기·탐색은 시야가 안 바뀌어 seq가 그대로였고, 되짚기
           **전에** 앞으로 지어 둔 장(옛 세대)이 되짚은 뒤 새로 짓는 장 사이사이에 시각순으로 끼어들어 붓이 두 세대를
           번갈아 골랐다(엔진은 상태를 들고 있어 같은 시각이라도 세대마다 자리가 조금 다르다). 새 세대의 첫 장이 오면
           그 시각 이후의 옛 세대 장은 버린다. 그보다 이른 옛 장은 새 장이 올 때까지 이어 주는 몫이라 둔다(아래 고르기가
           새 세대를 먼저 본다). */
        const gq9 = genSeenRef9.current;
        // 옛 세대의 앞 장은 **안 버린다** — 새 세대가 그린 자리를 따라잡을 때까지 그 장들로 앞으로 잇는다(위 lastDrawT9).
        if (pf9.gen > gq9.seen) gq9.seen = pf9.gen;
        /* ★ 안개 갈래가 바뀌면 옛 갈래의 장·안개 판을 **그 시각부터** 걷는다(지적: "추적 끄면 갑자기 안개 계산을 여러 번
           하듯 깜빡임") — 추적을 끄면 시야 주인이 그 사람 → 전체로 바뀌어 안개가 통째로 다른데, 워커가 앞서 지어 둔
           옛 시야의 장들이 새 장 사이사이로 계속 와 그 안개 판이 시각순으로 끼어들었다. 아래 seq 규칙이 옛 **장**은
           밀어냈지만 그 장에 실린 **안개 판**은 그대로 꽂혀, 새 갈래의 장이 시각으로 고른 판이 옛·새를 번갈았다.
           새 갈래의 첫 장이 온 뒤로는 그 시각 이후의 옛 갈래 장은 버리고 판도 안 꽂는다. */
        const fq9 = fogSeqRef9.current;
        if (pf9.fseq > fq9.seen) {
          fq9.seen = pf9.fseq;
          fq9.firstT = pf9.t;
          for (const [k9, f9] of frames9) if (f9.fseq < pf9.fseq && f9.t >= pf9.t - 1e-6) frames9.delete(k9);
          const keepS9 = fogSnapsRef9.current.filter((sn9) => !(sn9.fseq < pf9.fseq && sn9.t >= pf9.t - 1e-6));
          if (keepS9.length !== fogSnapsRef9.current.length) fogSnapsRef9.current = keepS9;
          const keepE9 = eyeSnapsRef9.current.filter((sn9) => !(sn9.fseq < pf9.fseq && sn9.t >= pf9.t - 1e-6));
          if (keepE9.length !== eyeSnapsRef9.current.length) eyeSnapsRef9.current = keepE9;
        } else if (pf9.fseq < fq9.seen && pf9.t >= fq9.firstT - 1e-6) {
          return;   // 새 갈래가 이미 시작된 시각의 옛 갈래 장 — 장도 판도 안 받는다
        }
        /* 시야가 바뀌어 새 차례의 장이 오면, 그 시각 이후의 옛 차례 장은 밀어낸다(지적: 드래그 때 툭툭 — 전에는 시야가
           바뀔 때 버퍼를 통째로 비워 새 장이 올 때까지 마지막 장을 든 채 멎었다. 옛 장은 제 시야 안에서는 여전히 옳다). */
        /* 단, 주인 시각 이하의 옛 장은 남긴다(지적: 많이 드래그하면 유닛이 잠깐 이전 자리로 갔다 돌아옴) — 새 차례는 워커
           시계(주인보다 조금 뒤)에서 시작하므로, 그 사이의 옛 장까지 밀어내면 붓이 새 차례의 더 이른 장으로 되돌아갔다. */
        const tNowSeq9 = cmdNowRef9.current.t;
        for (const [k9, f9] of frames9) if (f9.seq < pf9.seq && f9.t >= pf9.t - 1e-6 && f9.t > tNowSeq9) frames9.delete(k9);
        frames9.set(Math.round(pf9.t * 1000), pf9);
        wStatRef.current.got += 1;
        /* ★ 멈춰 있을 때도 새 장이 오면 다시 그린다(지적: "일시정지 때도 그림을 리프레시해야") — 장은 이 ref에만 쌓여
           React가 모르므로, 멈춘 화면은 멈추던 순간에 고른 장(보간 중이던 옛 장)으로 굳어 있었다. 정지 명령을 받은 워커가
           정확히 그 시각의 장을 지어 보내도, 탐색·팬·줌으로 시야가 바뀌어 새 장이 와도 안 그려졌다. 붓은 ref로 곧장 칠하고
           (React 없이), 안개·DOM 효과·미니맵은 React 박자를 한 번 깨워(100ms에 한 번) 따라오게 한다. 지금 시각보다 앞선
           장(미리 지은 것)은 그릴 것이 없으니 안 깨운다. */
        if (!clockRef.current && pf9.t <= cmdNowRef9.current.t + 0.05) {
          requestPaint9();   // 붓 하나에 청한다(다음 rAF에 한 장)
          if (pausedWakeRef9.current === null) {
            pausedWakeRef9.current = window.setTimeout(() => { pausedWakeRef9.current = null; setPausedTick9((n9) => n9 + 1); }, 100);
          }
        }
        const st9 = wStatRef.current;
        st9.buildMs = st9.buildMs === 0 ? pf9.ms : st9.buildMs * 0.9 + pf9.ms * 0.1;
        st9.ops = st9.ops === 0 ? pf9.n : st9.ops * 0.9 + pf9.n * 0.1;
        st9.kb = st9.kb === 0 ? pf9.buf.byteLength / 1024 : st9.kb * 0.9 + (pf9.buf.byteLength / 1024) * 0.1;
        const x9 = m9 as unknown as { msBuild?: number; msPack?: number; fogCost?: number; fogN?: number; resets?: number; cur?: number; duty?: number};
        const mix9 = (old9: number, v9: number): number => (old9 === 0 ? v9 : old9 * 0.9 + v9 * 0.1);
        st9.engMs = mix9(st9.engMs, x9.msBuild ?? 0);
        st9.packMs = mix9(st9.packMs, x9.msPack ?? 0);
        st9.fogMs = x9.fogCost ?? st9.fogMs;
        st9.fogN = x9.fogN ?? st9.fogN;
        st9.resets = x9.resets ?? st9.resets;
        st9.duty = x9.duty ?? st9.duty;   // 워커가 벽시계의 몇 %를 쓰나(위 DUTY9)
        if (typeof x9.cur === "number") st9.skew = x9.cur - cmdNowRef9.current.t;
        if (pf9.eyes && pf9.eyes.length > 0) {
          const es9 = eyeSnapsRef9.current;
          let ke9 = es9.length;
          while (ke9 > 0 && es9[ke9 - 1].t > pf9.t) ke9 -= 1;
          es9.splice(ke9, 0, { t: pf9.t, fseq: pf9.fseq, vis: pf9.eyes });
          FOGT9.set(pf9.eyes, pf9.t);
          // 뒤로 2초만 — 그 앞은 붓이 다시 볼 일이 없다(되감으면 워커가 새로 짓고 세대가 바뀐다).
          const cutT9 = tLiveRef9.current - 2;
          let drop9 = 0;
          while (drop9 < es9.length - 1 && es9[drop9].t < cutT9) drop9 += 1;
          if (drop9 > 0) es9.splice(0, drop9);
          if (es9.length > 400) es9.splice(0, es9.length - 400);
        }
        const snaps9 = fogSnapsRef9.current;
        if (pf9.fog) {
          // 시각순으로 꽂는다(거의 늘 끝).
          let k9 = snaps9.length;
          while (k9 > 0 && snaps9[k9 - 1].t > pf9.t) k9 -= 1;
          snaps9.splice(k9, 0, { t: pf9.t, fseq: pf9.fseq, fog: pf9.fog });
          FOGT9.set(pf9.fog.visSrc, pf9.t);   // 이 목록이 어느 시각의 것인가(위 FOGT9의 ★)
          /* ★ **뒤로 드는 판은 성기게 든다**(실측: 안개판 45.5MB·872장 — 이 판이 새는 자리였다) ──────────
             창은 6초로 맞다. 터진 것은 **들어오는 밀도**다: 워커가 초당 여든 장씩 보내니 6초에 팔백 장이고,
             큰 지도는 한 장이 52KB(밝힘 시각표 w·h·2 + 눈 목록)라 그대로 45MB가 된다. 메모리가 계단처럼
             40 → 71MB로 오르던 몫이 이것이고, 그 끝이 배킹 손실(그리기 멎음)이다.
             쓰임새를 보면 성길 수 있다 — 이 목록은 **제 안개를 못 실은 장**에 붙여 주는 예비지, 살아 있는
             화면의 자가 아니다(장은 대개 제 안개를 갖고 온다). 그러니
               · 최근 1.5초는 그대로 둔다(지금 그리는 자리라 촘촘해야 한다)
               · 그보다 오래된 것은 0.25초에 한 장만 남긴다(되감기 몫엔 그 눈금이면 넉넉하다)
               · 그래도 여든 장을 넘으면 오래된 것부터 버린다(어떤 경우에도 상한이 있게)
             이러면 6초 창이 팔백 장이 아니라 예순 장 안팎, 곧 45MB가 3MB가 된다. */
          const keepT9 = pf9.t - 1.5;
          let wr9 = 0;
          let lastKept9 = -Infinity;
          for (let i9 = 0; i9 < snaps9.length; i9 += 1) {
            const sn9 = snaps9[i9];
            const dense9 = sn9.t >= keepT9 || sn9.t - lastKept9 >= 0.25 || i9 === snaps9.length - 1;
            if (!dense9) continue;
            if (sn9.t < keepT9) lastKept9 = sn9.t;
            snaps9[wr9] = sn9;
            wr9 += 1;
          }
          if (wr9 !== snaps9.length) snaps9.length = wr9;
          if (snaps9.length > 80) snaps9.splice(0, snaps9.length - 80);
        }
        /* 버림 — 주인 시각보다 반 초 지난 장(붓은 t 이하 가장 늦은 장 하나만 쓴다), 워커가 지을 수 있는 앞(벽시계 3초 +
           2.5초 여유)·배속을 넘어 앞선 장(탐색 전 옛 자리). 안개 판은 15초 뒤·같은 앞 밖. */
        const tNow9 = cmdNowRef9.current.t;
        /* ★ 앞 창을 **기기 예산으로** 좁힌다(실측: 폰에서 앞 2.5초에 225장·14.9MB를 들고 있었다) ─────────
           워커에게는 폰이면 벽시계 1.5초·6MB만 지으라고 이르면서(DEV9.aheadSec·aheadMB), 정작 메인이 들고
           있는 창은 '6초 × 배속 + 1'이라 훨씬 넓었다. 워커가 짓기 2ms로 빨리 지으면 그 창이 빽빽이 차
           수백 장이 쌓인다 — 붓은 그중 한 장만 쓰는데, 남은 몫은 고스란히 메모리·GC다(계측에서 굽기도
           React도 아닌 1918ms 프레임이 나온 자리가 여기로 의심된다).
           같은 자(DEV9)로 맞춘다: 앞은 예산 초 × 배속 + 1초, 그리고 바이트가 예산을 넘으면 **가장 먼
           앞 장부터** 버린다. 붓이 드는 것은 늘 't 이하 가장 늦은 장'이라 앞을 잘라도 안 굶는다. */
        const aheadMax9 = DEV9.aheadSec * Math.max(1, cmdNowRef9.current.speed) + 1;
        if (frames9.size > 8) {
          for (const [k9, f9] of frames9) if (f9.t < tNow9 - 0.5 || f9.t > tNow9 + aheadMax9) frames9.delete(k9);
          let by9 = 0;
          for (const f9 of frames9.values()) by9 += f9.buf.byteLength;
          const cap9 = DEV9.aheadMB * 1024 * 1024;
          if (by9 > cap9) {
            const far9 = [...frames9.entries()].sort((a9, b9) => b9[1].t - a9[1].t);
            for (const [k9, f9] of far9) {
              if (by9 <= cap9 || frames9.size <= 8) break;
              if (f9.t <= tNow9) break;   // 지난 장은 안 버린다 — 그것이 지금 그리는 장이다
              frames9.delete(k9);
              by9 -= f9.buf.byteLength;
            }
          }
        }
        if (snaps9.length > 4) {
          /* ★ 뒤로 드는 안개 판을 15초 → **6초**로 줄인다(실측: 폰에서 안개판만 8.8MB·168장) ──────────
             한 장이 밝힘 시각표(w·h·2바이트)라 128² 지도면 32KB, 큰 지도면 그 네 배다. 이 판을 드는 까닭은
             '조금 되감아도 안개가 안 튀게'인데, 6초면 그 몫을 다 한다(되감기는 어차피 워커가 다시 짓는다).
             배킹 손실(위 LOST9)은 기기 전체의 메모리 압박에서 오므로, 우리 봉우리를 낮추는 것이 곧 덜 잃는 길이다. */
          const keep9 = snaps9.filter((sn9) => sn9.t >= tNow9 - 6 && sn9.t <= tNow9 + aheadMax9 + 2);
          if (keep9.length !== snaps9.length) fogSnapsRef9.current = keep9.length > 0 ? keep9 : snaps9.slice(-1);
        }
      } else if (m9.type === "worldui" && m9.ui) {
        setWorldUi9(m9.ui);
        setWorldEnts9(!!(m9 as unknown as { hasEnts?: boolean }).hasEnts);
        setEntWalks9([]);
        walksAskedRef9.current = null;
        setWorldGen9((g9) => g9 + 1);
        /* 새 세대의 세계다 — 옛 세대로 지은 장(안개가 다르다)은 버린다. 새 장은 이 메시지 바로 뒤에 온다.
           ★ 마지막 장은 **지킨다**(지적: "처음 로딩시 안개 한번 없어졌다 다시 보이는 현상 여전") — 여기서
             lastFrameRef9까지 비우면 새 장이 올 때까지 빈 장(EMPTY_FRAME9, 안개 판 없음)이 그려져 안개 층이
             통째로 내려갔다가 첫 새 장에서 되살아났다. 참값을 다시 실을 때마다(세계 표가 다시 올 때마다)
             그 깜빡임이 났다. 옛 장이 100ms쯤 낡은 것이 안개가 사라지는 것보다 훨씬 낫다. */
        frames9.clear();
        fogSnapsRef9.current = []; eyeSnapsRef9.current = [];
      } else if (m9.type === "walks") {
        setEntWalks9((m9 as unknown as { entWalks: EngineWorld9["entWalks"] }).entWalks ?? []);
      } else if (m9.type === "ready") {
        wStatRef.current.ready = true;
        const b9 = (m9 as unknown as { bytes?: { truth: number; world: number; typed?: number; top?: [string, number][] } }).bytes;
        if (b9) setMemWorker9(b9);
      } else if (m9.type === "err") {
        wStatRef.current.err = m9.message || "워커가 던졌다(내용 없음)";
        // eslint-disable-next-line no-console
        console.error("[scplay] 프레임 워커가 던졌다:", m9.message);
        wk9.terminate();
        frameWorkerRef.current = null;
      }
      WORK9.wk += pNow() - wk09;
    };
    /* 워커 스크립트가 못 서거나(모듈 워커 미지원·문법) 잡히지 않은 채 던지면 여기로 온다. Safari는
       message가 빈 문자열일 때가 있어 자리(파일:줄)도 함께 적는다 — 빈 err는 '문제 없음'으로 보인다. */
    wk9.onerror = (e9) => {
      const ev9 = e9 as ErrorEvent;
      const where9 = ev9.filename ? ` @${String(ev9.filename).slice(-24)}:${ev9.lineno ?? 0}:${ev9.colno ?? 0}` : "";
      wStatRef.current.err = `${ev9.message || "워커 오류(내용 없음)"}${where9}`;
      // eslint-disable-next-line no-console
      console.error("[scplay] 프레임 워커 오류:", wStatRef.current.err, e9);
      wk9.terminate();
      frameWorkerRef.current = null;
    };
    wk9.onmessageerror = () => {
      wStatRef.current.err = "메시지를 못 풀었다(messageerror)";
      // eslint-disable-next-line no-console
      console.error("[scplay] 프레임 워커 messageerror");
    };
    };
    return () => { dead9 = true; w9?.terminate(); frameWorkerRef.current = null; frames9.clear(); fogSnapsRef9.current = []; eyeSnapsRef9.current = []; };
  }, []);
  /* 세계의 작은 조각(지도·기지·팀·길이) — 참값·개체는 안 싣는다(참값은 위 postTruth9로 한 번 넘기고, 개체 표는
     워커가 참값에서 스스로 만든다). 이 조각이 바뀌면 워커가 든 참값으로 다시 센다. */
  useEffect(() => {
    const msg9 = {
      type: "world",
      grid: { width: grid.width, height: grid.height, resources: grid.resources },
      bases: bases.map((b9) => ({ key: b9.key, race: b9.race })), teamMap: teamMap9, total,
    };
    worldMsgRef9.current = msg9;
    const w9 = frameWorkerRef.current;
    if (!w9) return;
    wFramesRef.current.clear();
    /* 안개 판은 **안 비운다**(지적: 처음에 안개가 걷힘 → 적용 → 걷힘 → 적용으로 네 번 바뀜) — 세계·참값을 다시
       보낼 때마다 판을 비우면 새 장이 올 때까지 '판 없음 = 다 걷힘'으로 그려졌다. 같은 지도면 옛 판이 잠깐 낡은
       것이 훨씬 낫다. 지도 크기가 다른 판은 아래 decodeFrame9가 크기로 걸러 안 쓴다. */
    wStatRef.current.sentWorld += 1;
    wStatRef.current.ready = false;
    wStatRef.current.worldAt = pNow();
    w9.postMessage(msg9);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, bases, teamKey9, total]);
  truthRef9.current = truth;
  entDataRef9.current = entData;
  useEffect(() => {
    const w9 = frameWorkerRef.current;
    if (!w9) return;
    wFramesRef.current.clear();
    postTruth9(w9);   // 안개 판은 두고 간다(위 주석)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truth, workerTick9]);
  /* 건물 체력 자취(요청: 건물 체력바 — 실드·회복·불·수리 반영은 분석이 했다) —
     자리 열쇠(raw|x|y)로 그 건물의 체력 변곡점을 찾는다. */
  /** ★ 건물마다 **고른 체력 줄**을 기억해 둔다(성능) ─────────────────────────────────
   *  아래 건물 고리는 프레임마다 `[...arr].filter().sort()[0]`으로 그 건물의 생애 줄을
   *  다시 고른다 — 그런데 그 셈이 보는 것은 `arr`와 그 건물의 지어진 때(sec)뿐이라
   *  **재생 시각과 무관하다**. 곧 매 프레임 같은 답을 내려고 배열을 세 번 만든다
   *  (복사·거르기·정렬). 건물 수백 기 × 초당 서른 프레임이면 그것만으로 헛일이 만 단위다.
   *  표(entBldHp)가 갈리면 이 기억도 통째로 새로 난다 — deps가 그것 하나다. */
  /* 건물 태그 → 자리(지적: 질럿이 해처리에 붙지 않고 멀리서 싸움) — 어택 명령이 찍는
     표적은 해처리 같은 일반 건물일 때가 많은데, 표적 지도(entPosByTag)에 유닛과 방어
     건물만 있어 그 건물을 겨누지도, 다가붙지도 못했다. 건물은 안 움직이니 생애와 중심
     자리만 한 번 색인해 두고, 프레임마다 살아 있는 것만 지도에 올린다. */
  /* ★ 드론 변태의 이음매 — **태그가 잇는다**(위 '같은 건물이 두 번 선다' 주석: 드론
     태그가 그대로 건물의 생애가 된다) ────────────────────────────────────────────
     여기서 두 가지를 낸다.
       ① 시각 — 언제 드론이 고치가 되고(born) 언제 취소돼 도로 드론이 되나(gone).
       ② 미끄럼 몫(dy, 타일) — 2D에서 드론과 고치는 **기준선이 다르다**: 드론은 제
          자리(발자국 한가운데)에 서고, 고치는 발자국 **아랫변**에 앉는다. 그래서
          드론은 고치가 나올 자리보다 늘 발자국 세로의 절반만큼 위에서 사라졌다
          (지적). 그 절반이 곧 footDy다.
     건물→건물 변태(레어·하이브·성큰…)는 드론이 없으므로 뺀다. */
  /* (걷어냄) **벙커 승무원 색인**과 **건설 SCV 떠남 색인** — 둘 다 유추 시절의 증거
     갈래를 읽던 것이라 참값에서는 늘 빈손이었다.
       · 벙커 승무원은 '제 벙커를 찍은 우클릭'을 승선 증거(f=12)로 옮겨 읽었는데, 참값은
         그런 갈래를 안 만든다. 그래서 crew는 언제나 비어 있었고 화면은 실제로는 늘
         '마린 한 기 추정'(presumed)으로 돌고 있었다 — 그 어림만 남긴다.
         되살리려면 자취의 상태(ST_INSIDE)로 새로 짜야 한다: 벙커 발자국 안에서 '안에
         있음'인 유닛이 곧 승무원이다.
       · 건설 SCV 떠남은 일꾼 개체의 건설 증거(f=2)를 읽었는데, 참값에서 건설 자리는
         **건물 생애**에만 달린다(일꾼에게는 안 달린다). 그것을 쓰던 합성 SCV 자체를
         위에서 걷었으므로 함께 걷는다. */
  /* (걷어냄) **테란 건설 중단 판정(bldWork)** — "SCV가 붙어 있는 동안만 건물이 자란다"를
     일꾼의 명령 증거로 되짚던 자리다. 일꾼의 위치 증거로 '붙어 있던 구간'을 만들고, 그
     구간의 합으로 완공 시각을 다시 셈했다. 참값에는 그 증거 갈래가 없어 늘 빈손이었다.
     ★ 완공 시각은 이제 **참값이 직접 말한다**(TruthLife.doneAt) — 자취가 키마다 싣는
       '다 지어졌나'가 처음 켜지는 때다. 어림으로 되짚을 이유가 사라졌다.
     ★ '중단 중'이라는 표시만 없어진다. 되살리려면 참값에서 새로 짜야 한다: 건물 발자국
       곁에 제 임자의 일꾼이 서 있는지를 자취의 자리로 보면 된다. */
  /* 살아 있는 일꾼 수(요청: 일꾼 수도 사망 일꾼 반영해 실시간으로) ────────────────
     옛 값은 생산 **누계**였다 — 한 번 는 뒤로 절대 줄지 않아서, 실측 1855초 팀전에서
     한 테란이 133기로 표시되는 동안 실제로 살아 있는 것은 13기였다(저그는 더 심했다:
     121기 대 0기 — 드론이 건물로 변태한 몫까지 그대로 남아 있었다).
     개체 트랙은 개체마다 태어난 초(b)와 끝난 초(d)를 지닌다. 그 둘을 +1/−1 사건으로
     늘어놓으면 시각별 생존 수가 그대로 나온다. 변태(드론→익스트랙터)도 d가 찍히므로
     저그 가스만 따로 빼 주던 손보정이 필요 없어진다 — 해처리·성큰이 된 드론도 함께
     빠진다(옛 보정은 익스트랙터만 알았다).
     ★ 시작 4기는 커맨드가 없어 트랙에 늦게 나타난다(첫 클릭에야 잡힌다 — 실측으로
       0초에 0기, 10초에 3~4기). 그 공백만 바닥값으로 메운다: max(생존 수, 4 − 여태
       죽은 수). 후반에는 죽은 수가 4를 넘어 바닥이 저절로 0이 되므로 개입하지 않는다. */
  const workerLive = useMemo(() => {
    /** raw → [초, 그때의 생존 일꾼 수] (계단 자취) */
    const m = new Map<string, [number, number][]>();
    if (!entData) return m;
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    const evs = new Map<string, [number, number][]>();
    for (const e of entData.lives) {
      if (e.bld || !WORKER_KINDS.has(e.kind)) continue;
      const raw = nameOfId.get(e.owner);
      if (raw === undefined) continue;
      const a = evs.get(raw) ?? [];
      a.push([e.born, 1]);
      if (e.died !== null) a.push([e.died, -1]);
      evs.set(raw, a);
    }
    for (const [raw, a] of evs) {
      a.sort((p, q) => p[0] - q[0]);
      const series: [number, number][] = [];
      let live = 0;
      let dead = 0;
      for (const [sec, dz] of a) {
        live += dz;
        if (dz < 0) dead += 1;
        const n = Math.max(live, WORKER_START - dead);
        // 같은 초의 사건 여럿은 마지막 값 하나로 — 계단이 한 초에 두 번 서지 않게.
        if (series.length > 0 && series[series.length - 1][0] === sec) series[series.length - 1][1] = n;
        else series.push([sec, n]);
      }
      m.set(raw, series);
    }
    return m;
  }, [entData]);
  /* 인구(요청: 로스터 아래 "인구수 n/m") ────────────────────────────────────────
     일꾼 수와 같은 수법이다 — 개체마다 태어난 초·끝난 초를 ±사건으로 늘어놓고 계단을
     만든다. 먹는 쪽(SUPPLY_COST)은 유닛이, 주는 쪽(SUPPLY_GIVES)은 서플·파일런·
     오버로드·홀이 낸다. 표의 단위는 원작 내부 단위라 화면에 낼 때 반으로 나눈다
     (저글링·스커지가 0.5를 먹기 때문에 표가 정수로 두 배다).
     ★ 시작 밑천은 표에서 안 세고 종족으로 못 박는다 — 실측해 보니 개체 트랙의 0초에
       프로토스는 넥서스가 둘로 잡히고(시작 홀이 겹쳐 들어온다) 저그는 드론이 일곱이다.
       그 자리를 그대로 더하면 시작부터 인구 상한이 두 배가 된다. 그래서 주는 쪽은
       **2초 뒤에 태어난 것만** 세고, 시작 몫(테란 20·프로토스 18·저그 2+오버로드 16)은
       종족이 정한다. */
  const RACE_START_SUPPLY: Record<string, number> = { 테란: 20, 프로토스: 18, 저그: 18 };
  const supplyLive = useMemo(() => {
    /** raw → [초, 먹은 인구(내부단위), 준 인구(내부단위)] 계단 */
    const m = new Map<string, [number, number, number][]>();
    if (!entData) return m;
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    const raceOfId = new Map(entData.players.map((pl) => [pl.owner, pl.race ?? ""]));
    const evs = new Map<string, [number, number, number][]>();
    for (const e of entData.lives) {
      const raw = nameOfId.get(e.owner);
      if (raw === undefined) continue;
      const a = evs.get(raw) ?? [];
      const gives = SUPPLY_GIVES[e.kind] ?? 0;
      const eats = e.bld ? 0 : (SUPPLY_COST[e.kind] ?? 0);
      /* 주는 쪽은 시작 밑천과 겹치지 않게 2초 뒤에 난 것만 센다(위 ★). */
      const g = gives > 0 && e.born > 2 ? gives : 0;
      if (eats === 0 && g === 0) continue;
      a.push([e.born, eats, g]);
      if (e.died !== null) a.push([e.died, -eats, -g]);
      evs.set(raw, a);
    }
    for (const [raw, a] of evs) {
      a.sort((p, q) => p[0] - q[0]);
      const series: [number, number, number][] = [];
      let used = 0;
      let give = 0;
      for (const [sec, du, dg] of a) {
        used += du;
        give += dg;
        if (series.length > 0 && series[series.length - 1][0] === sec) {
          series[series.length - 1][1] = used;
          series[series.length - 1][2] = give;
        } else series.push([sec, used, give]);
      }
      m.set(raw, series);
    }
    void raceOfId;
    return m;
  }, [entData]);
  /** 지금(t)의 인구 — raw별 [먹은 수, 상한] (둘 다 화면 단위). */
  const supplyNow = useMemo(() => {
    const m = new Map<string, [number, number]>();
    const raceOfRaw = new Map((entData?.players ?? []).map((pl) => [pl.name, pl.race ?? ""]));
    for (const [raw, series] of supplyLive) {
      let used = 0;
      let give = 0;
      for (const [sec, u, g] of series) {
        if (sec > t) break;
        used = u; give = g;
      }
      const base = RACE_START_SUPPLY[raceOfRaw.get(raw) ?? ""] ?? 0;
      m.set(raw, [
        Math.round(used / 2),
        Math.min(SUPPLY_CAP, base + give) / 2,
      ]);
    }
    return m;
  }, [supplyLive, entData, t]);
  /** 지금(t) 살아 있는 일꾼 수 — raw별. 개체 트랙이 없는 옛 경기는 비어 있고, 부르는
   *  쪽이 옛 누계 모형으로 떨어진다. */
  /* 지금 이 순간의 미네랄·가스(요청) — 참값이 바뀔 때마다 적어 둔 것을 t로 되짚는다.
     여태 이 칸이 비어 있던 것은 낼 수가 없어서였다: 명령만 보고는 수입도 지출도 모르니
     지어내는 수밖에 없었다. 이제 실제로 그때 얼마 있었는지가 그대로 있다. */
  const resNow = useMemo(() => {
    const out = new Map<string, [number, number]>();
    if (!truth || !entData) return out;
    const nameOf = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    for (const [owner, rows] of truth.res) {
      const raw = nameOf.get(owner);
      if (!raw || !rows.length) continue;
      // 마지막으로 t를 안 넘는 줄 — 줄이 수천 개라 이분법으로 찾는다.
      let lo = 0;
      let hi = rows.length - 1;
      if (rows[0][0] > t) continue;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (rows[mid][0] <= t) lo = mid; else hi = mid - 1;
      }
      out.set(raw, [rows[lo][1], rows[lo][2]]);
    }
    return out;
  }, [truth, entData, t]);
  /* 실시간 APM(지적: APM이 실시간으로 안 바뀌네) — 경기 전체 평균 하나를 내내 띄우고
     있었다. 참값이 명령을 5초 통에 담아 주므로, 지난 1분치를 더하면 그것이 곧 지금의
     APM이다(분당 명령 수).
     ★ 자는 screp과 **같다**(지적: "APM 수치 정확한건가? 막 500넘기도 하고 이상해") —
       원전을 확인했다(icza/screp rep/replay.go): `pd.CmdCount++`를 명령 갈래를 안 가리고
       모두 세고 `APM = CmdCount / 마지막명령프레임의 분`으로 낸다. 곧 고르기·부대지정
       까지 다 드는 **날 APM**이고, 우리 덤퍼도 read_action마다 한 번씩 세므로 정의가
       같다(로스터가 자취 오기 전 screp 값을 보여 주다 뒤에 이 값으로 바뀌므로 둘이
       같은 자여야 한다). 그래서 바쁜 1분에 400~500이 뜨는 것 자체는 거짓이 아니다 —
       screp이 보여 주던 수는 판 전체 평균이라 쉬는 구간까지 섞인 값일 뿐이다.
     ★ 다만 여기 셈에 **부풀리는 구멍이 둘** 있었다(그래서 고친다):
       ① 통은 5초인데 창에 걸친 통을 **통째로** 더했다. 그래서 실제로는 최대 창+10초치를
          더해 놓고 창(60초)으로 나눴다 — 평상시에도 최대 17% 부풀었다.
       ② 판 초반에는 창이 아직 안 찼는데 **흐른 시간으로 나눠** 남은 시간까지 그 기세로
          갈 것처럼 늘려 잡았다. 이게 "5~600" 수의 진짜 몸통이었다(지적: 고치고 나서도
          여전히 치솟네). 시작 5초는 SCV 예약과 우클릭이 몰리는 구간이라 명령 57개가
          예사인데, 그것을 5로 나눠 60을 곱하면 **684**가 된다.
     ★ 그래서 나누는 자를 **늘 60초로 못 박는다**. 이 수의 뜻은 그냥 "지난 1분 동안 낸
       명령 수"다 — 1분이 아직 안 지났으면 지난 만큼만 세고 그대로 1분으로 나눈다.
       판 첫 1분은 낮게 시작해 차오르지만, **위로는 절대 거짓말하지 않는다**.
       실측(temp의 리플레이 전부, 사람 1233명분):
         옛 셈 — 64%가 판 시작 60초 안에 최고점을 찍었고, 평균 180인 사람이 t=5초에
                 816까지 올랐다.
         새 셈 — 시작 60초 안에 최고점을 찍는 사람은 1233명 중 2명, 최고점 500 이상은
                 255명 → 77명(6%)으로 준다.
       남는 77명은 **진짜다** — 죄다 판 전체 평균이 300~400인 사람들이고([Jeong9]가
       대표), 날 APM이라 고르기·부대지정·예약 연타가 다 들어 있어서 그렇다. 이걸 더
       낮추려면 수를 바꾸는 게 아니라 **EAPM으로 갈아타야** 하고, 그건 덤퍼가 명령마다
       '값진 명령인가'를 적어 와야 하므로 재분석이 필요하다(아직 안 했다). */
  const apmNow = useMemo(() => {
    const out = new Map<string, number>();
    if (!truth || !entData) return out;
    const nameOf = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    const WIN = 60;                 // 창은 1분 — 나누는 자도 늘 1분이다(위 ★)
    const from = Math.max(0, t - WIN);
    const bw = Math.max(0.001, truth.apmBucketSec);
    for (const [owner, buckets] of truth.apm) {
      const raw = nameOf.get(owner);
      if (!raw) continue;
      let n = 0;
      for (const [bt, cnt] of buckets) {
        const b1 = bt + bw;
        if (b1 <= from) continue;
        if (bt >= t) break;
        const ov = Math.min(b1, t) - Math.max(bt, from);
        if (ov > 0) n += (cnt * ov) / bw;
      }
      out.set(raw, Math.round((n * 60) / WIN));
    }
    return out;
  }, [truth, entData, t]);
  const workerNow = useMemo(() => {
    const m = new Map<string, number>();
    for (const [raw, series] of workerLive) {
      let n = WORKER_START;   // 첫 증거 전에도 시작 4기는 서 있다
      for (const [sec, v] of series) {
        if (sec > t) break;
        n = v;
      }
      m.set(raw, n);
    }
    return m;
  }, [workerLive, t]);
  /* 그리는 재료는 개체 트랙 하나뿐이다(요청: 정식 운영 — 안 나오면 문제인 것이 보이게).
     예전엔 v1 부대 추적으로 떨어지는 갈래가 있었는데, 그 v1 자리에는 이미 오래전부터
     빈 배열만 실려 왔다(요약 폐지). 폴백이 남아 있으면 트랙 적재가 실패해도 화면이
     그냥 조용히 비어, 고장과 '아무 일도 없던 경기'가 구분되지 않는다. */
  /* 건물 그리는 차례(y 순)는 목록이 설 때 한 번만(계측: perf-check --zoom 2.5 — 이
     정렬이 JSX 안 IIFE라 **그리기 틱마다** 새 배열을 만들어 정렬하고 있었다). 재료가
     같으면 차례도 같으니 프레임 일이 아니다. */
  /* v2 교전 멈춤(지적: 어택땅 중 만나면 멈추고 싸워야 하는데 그냥 감) — 싸움이 시작된
     자리를 기억해, 적이 곁에 있는 동안 거기 세운다. 적이 사라지면(죽거나 멀어지면)
     기억을 걷고 다시 걷는다. 시간을 되감으면(t가 기억보다 앞) 기억을 버린다. */
  /* 사격 박자의 **시작 시각**(요청: "위상은 일부러 어긋내지말고 사거리 들어오면
     자연스럽게 시작하는게 나을거같아") ─────────────────────────────────────────────
     앞 판은 개체 번호로 위상을 어긋냈다(`(t + ei*0.19) % cd`). 부대가 한 박자로 쏘는 것을
     막으려던 손잡이인데, 그러면 **적이 사거리에 들어온 순간과 첫 발이 무관해진다** —
     막 붙었는데 이미 반쯤 날아간 탄이 튀어나오고, 개체 번호가 바뀌면(재정렬) 박자도
     함께 튄다.
     이제 '언제부터 쏘고 있나'를 기억한다. 사거리에 든 첫 프레임이 곧 첫 발이고, 그다음은
     제 쿨다운대로 이어진다. 부대가 저절로 흩어지는 것은 덤이다 — 저마다 붙는 순간이
     다르기 때문이다(지어낸 위상이 아니라 실제로 그렇다).
     열쇠마다 마지막으로 본 시각(at)을 함께 둬, 한 프레임이라도 끊기면(사거리 밖으로
     나감·되감기·배속 점프) 다음 시작을 새로 잡는다. */
  /* 걸음 시계(요청: 교전 시뮬로 움직이다 다음 명령이 오면 막 되돌아가서 부자연스럽다) —
     예전엔 교전으로 멈춘 시간만큼 시계를 '되감아' 이어 걸었는데, 그 되감기가 곧 화면의
     후진이었다: 표적으로 파고든 몸이 싸움이 끝나는 순간 싸우기 전 자리로 물러났다.
     이제 시계는 절대 뒤로 안 간다 — 싸우는 동안 멈춰 있다가(held), 풀리면 지금 서 있는
     자리에 가장 가까운 '앞쪽' 시각으로 건너뛰어(파고든 몫을 걸음으로 인정) 거기서 이어
     걷고, 뒤처진 빚은 TRACK_CATCHUP 걸음으로 천천히 갚는다. */
  /* 화면 위치 스무딩(지적: 유닛이 뚝뚝 끊기고 조금씩 순간이동처럼 움직임) — 대형 오프셋
     변경·교전 멈춤 해제·채굴 위상 전환 같은 잔점프를 지수 이동평균이 흡수한다. 큰 이동
     (6타일 초과 — 드랍·리콜 등 진짜 순간이동)과 시간 되감기는 그대로 점프한다. */
  /* (걷어냄) drawPosRef — 위 화면 추종이 지난 프레임 자리를 기억하던 칸이다. */
  /* (걷어냄) diePosRef — '마지막으로 **그려진** 자리'를 기억해 두던 칸이다. 죽음 연출이
     원자취(명령 좌표)에서 터지던 시절, 화면의 몸은 교전 당김·화면 추종까지 실린 자리에
     있어 둘이 몇 타일씩 벌어졌던 그 자리다(지적: "피격·죽음 효과가 엉뚱한 데서 난다").
     그 보정들이 전부 걷히면서(그리는 자리는 이제 참값 그대로다) 이 기억은 같은 값을
     **다른 시각에** 담는 칸이 됐고, 그 시차가 새 버그가 됐다 — 화면이 안 그린 프레임에는
     갱신되지 않으므로, 안개 속에서·배 안에서 죽은 몸이 한참 전 자리에서 터졌다.
     이제 죽는 자리는 dieAt 시각의 참값을 그 자리에서 읽는다(아래 dp0). */
  /* 초반 무명 개체의 폴백(지적: 일꾼밖에 없는데 저글링이 정찰 감) — 정체를 모르는
     개체는 그 사람의 '첫 전투 유닛이 태어난 시각' 전이면 일꾼으로, 뒤면 종족 보병으로
     그린다. 그 시각 전에는 저글링이 존재할 수 없다(뒤 스토리 제약). */
  /* 클릭 자국(요청: 클릭만 해보자 — 동그라미 안에 점, 납작하게) — 개체 증거 스트림의
     이동 명령 목적지(f=0)가 곧 그 사람의 클릭이다. 같은 클릭이 골라진 유닛 수만큼
     중복돼 있으니(12기 선택 우클릭 = 12개체에 같은 점) 사람·초·자리로 합친다.
     별도 저장이 필요 없어 이미 재분석된 경기에서도 바로 나온다. */
  const entClicks = useMemo<[number, number, number, string, number][]>(() => {
    if (!entData) return [];
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    const seen = new Set<string>();
    /* 다섯째 값은 클릭의 종류(지적: 클릭·우클릭이 구분이 안 된다) — 0 이동 우클릭,
       7 공격 클릭. 선택(드래그)은 자리가 아니라 잡힌 유닛들 몸에 켜지는 링이 맡는다. */
    const out: [number, number, number, string, number][] = [];
    for (const e of entData.lives) {
      if (e.tag < 0) continue;
      const raw = nameOfId.get(e.owner) ?? "";
      if (!raw || obsNames.has(raw)) continue;   // 관전자 손짓은 안 그린다(위 bases 주석)
      for (const o of e.orders) {
        const key = `${e.owner}:${o[0]}:${o[1]}:${o[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push([o[0], o[1], o[2], raw, o[3] ? 7 : 0]);
      }
    }
    return out.sort((a, b) => a[0] - b[0]);
  }, [entData, obsNames]);
  /* 팀색은 미니맵과 한 벌이다(요청: 덜 파스텔·진하게·원작 색) — 값은 ReplayMinimap의
     TEAM_COLOR 한 곳에서만 정한다. 여태 두 파일이 각자 다른 색을 들고 있어(재생 #5ea2ff·
     #ff7d95, 미니맵 #2b9bff·#ff4d68) 같은 팀이 화면마다 다른 파랑이었다. */
  const TEAM_EDGE: Record<1 | 2, string> = { 1: TEAM_COLOR[1], 2: TEAM_COLOR[2] };
  /* 개인색을 아직 모르는 동안의 임시 색(지적: "로스터 처음 로딩시 팀색으로 로딩되는
     문제 — 처음부터 개인색으로 로딩") — 개인색의 유일한 원천은 참값 자취(entData)인데
     그것이 1~2MB라 늦게 온다. 그동안 팀색으로 떨어뜨리면 로스터가 파랑·빨강으로 한 번
     칠해졌다가 개인색으로 갈아입어, 첫 화면이 늘 '팀색으로 로딩'된다.
     **모르는 색을 아는 척하지 않는다** — 자취가 오기 전에는 중립 회색으로 세워 두고,
     오는 순간 제 개인색이 그대로 앉는다. 자취가 끝내 안 오는 옛 기록(entLoad "none")
     에서만 예전처럼 팀색으로 떨어진다. 지도는 자취가 있어야 그려지므로 이 중립색이
     실제로 보이는 자리는 로스터 하나뿐이다. */
  const COLOR_PENDING = "#6b727c";
  /* ★ **개인색이 없는 판이 있다**(지적: "팀구분이 안돼서 같은색으로 나오네 흰색") ─────────
     개인색의 원천은 리마스터 리플레이의 CCLR 구획인데, 옛 판(1.16 이하)에는 그 구획이
     아예 없다. 덤퍼는 그때 흰색(0xffffff)을 적어 보내므로, 화면은 **모두 흰색인 로스터**를
     받아 그대로 칠했다 — 두 사람이 같은 색이면 편이 안 갈린 것처럼 보인다.
     색이 없다는 것은 **모두 같은 색**으로 드러난다: 원작에서 두 사람이 같은 색을 쓰는 일은
     없으므로, 로스터의 색이 한 가지뿐이면 그것은 색이 아니라 '모름'이다. 그때는 팀색으로
     떨어진다(덤퍼 주석이 애초에 약속한 그 동작이다).
     ※ 덤퍼 쪽도 '모름'을 흰색이 아닌 표식으로 내도록 고쳤다 — 다시 구운 판은 한 사람만
       흰색을 골라도 안 헷갈린다. 이 잣대는 **이미 구워 둔 옛 판**을 위한 것이다. */
  const personalUsable = useMemo(() => {
    const cs9 = (entData?.players ?? []).map((pl) => pl.color).filter(Boolean);
    return cs9.length > 1 && new Set(cs9).size > 1;
  }, [entData]);
  /* ★ 참값에 색이 없는 판을 위한 **둘째 원천**(지적: "2010년 이전(1.16 이하) 리플레이에서
     개인색이 안 나오고 팀 2색으로 떨어짐") ────────────────────────────────────────────
     참값 뭉치는 색을 리마스터 리플레이의 CCLR 구획에서 읽는데, 1.16 이하에는 그 구획이
     아예 없어 0xffffffff(색 아님)로 온다 → color: "" → 여기서 팀색으로 떨어졌다
     (openbwTracks의 그 주석이 이미 약속한 동작이다).
     그런데 **색이 없는 것이 아니라 읽는 자리가 다를 뿐**이다: 리플레이의 사람 구조에는
     색 번호(Color.ID 0~7)가 그대로 남아 있고, SC:R 인게임도 screp도 그 번호를 표준
     팔레트로 풀어 색을 낸다. 앱은 이미 screp으로 파싱해 로스터(bases)에 #rrggbb를 싣고
     넘겨준다 — 실측(2010-12-30 판): 여덟 명 전원 Color={"Name":"Brown","ID":5,…}.
     그러니 참값이 못 준 자리를 이 값이 메운다.
     ★ 잣대는 참값 쪽과 **같다**(위 personalUsable) — 로스터 색이 한 가지뿐이면 그것은
       색이 아니라 '모름'이다. 원작에서 두 사람이 같은 색을 쓰는 일은 없다.
     ※ 덤퍼도 이제 색 번호를 풀어 옛 판의 색을 내준다 — 그래서 이 폴백은 **덜 걸린다**.
       그래도 걷지 않는다: 이미 구워 둔 뭉치는 다시 굽기 전까지 옛 값('모름') 그대로다. */
  const rosterColor = useMemo(() => {
    const m9 = new Map<string, string>();
    for (const b9 of bases) {
      const c9 = (b9.color ?? "").trim();
      if (/^#[0-9a-fA-F]{6}$/.test(c9)) m9.set(b9.key, c9);
    }
    return new Set(m9.values()).size > 1 ? m9 : new Map<string, string>();
  }, [bases]);
  const modeColor = (raw: string, team: 1 | 2 | undefined): string => {
    const teamColor = team === 2 ? TEAM_EDGE[2] : TEAM_EDGE[1];
    // 요약 폐지 뒤 개인색의 원천은 개체 트랙이다(수리: 색이 팀 2색으로 퇴행).
    if (colorNow !== "personal") return teamColor;
    /* 참값이 준 개인색이 먼저다 — 그것이 그 경기에서 실제로 칠해진 색이다.
       색이 없는 판(위 personalUsable)에서는 이 칸을 통째로 건너뛴다. */
    const truth9 = personalUsable
      ? (colorByRaw.get(raw) ?? entData?.players.find((pl) => pl.name === raw)?.color)
      : undefined;
    if (truth9) return truth9;
    /* 참값에 없으면 로스터(screp) 색이다 — 1.16 이하가 여기로 온다. 자취를 아직
       기다리는 동안에도 쓴다: 이건 '모르는 색을 아는 척'이 아니라 **이미 아는 색**이라,
       중립 회색으로 세워 둘 까닭이 없다. */
    const roster9 = rosterColor.get(raw);
    if (roster9) return roster9;
    // 둘 다 없다 — 자취가 왔거나 끝내 안 오면 팀색, 아직 오는 중이면 중립(위 주석).
    return entData || entLoad === "none" ? teamColor : COLOR_PENDING;
  };
  /** 엔진에 건네는 색표 — 임자(raw)마다 지금 색 모드의 색. 엔진은 함수를 못 받으므로(워커) 표로 준다. */
  const colorTable9 = useMemo(() => {
    const m9: Record<string, string> = {};
    const raws9 = new Set<string>();
    for (const b9 of bases) raws9.add(b9.key);
    for (const pl9 of entData?.players ?? []) raws9.add(pl9.name);
    for (const r9 of raws9) m9[r9] = modeColor(r9, teamOfRaw(r9));
    return m9;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bases, entData, colorNow, personalUsable, rosterColor, entLoad, colorByRaw]);
  /** 색의 밝기 — 어두운 개인색은 흰 반투명 음영을 받쳐야 보인다(지적). */
  const lumOf = (hex: string): number => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 255;
    return 0.299 * parseInt(hex.slice(1, 3), 16)
      + 0.587 * parseInt(hex.slice(3, 5), 16)
      + 0.114 * parseInt(hex.slice(5, 7), 16);
  };
  /* 건물 이름 글자 — 테두리 없이 음영판만(지적). 어두운 계열(블루 포함, 지적)은 흰 반투명
     배경판, 밝은 계열은 CSS의 검정 음영판. 문턱은 칩(chipStyle의 150)과 같은 값이다
     (지적: 연보라가 칩에선 흰 글자인데 건물 음영판은 검정 — 140/150으로 갈라져 있었다). */
  /* (삭제) 이름 음영판(shapeStyle) — 건물 이름 창이 걷히며 함께 걷었다. */
  /* 도형(●▪▲✕·점)은 건물이든 유닛이든 음영판 없이 제 색 그대로다(지적).
     그림자만 얇게 깐다(요청: "유닛 테두리 검정톤 그림자 약하게 추가") — 아주 밝은
     개인색(연두·노랑·흰색)은 밝은 맵에서 통째로 사라져 더 진한 링을 두른다(지적: "이색은
     흰색 바탕에서 잘 안보여"). */
  /* (걷어냄) glyphStyle — 마지막 쓰임새(전투 효과 스팬의 색)가 캔버스 이관으로 사라졌다. */
  const chipStyle = (raw: string, team: 1 | 2 | undefined): React.CSSProperties => {
    const bg = modeColor(raw, team);
    const lum = lumOf(bg);
    // 배지(칩)는 제 배경색이 있으니 테두리는 안 두른다(지적).
    return {
      background: bg,
      color: lum > 150 ? "#111" : "#fff",
    };
  };
  /* 기술(마법·드랍·태움) 전용 배지(요청: 유닛과 다른 스타일) — 유닛 칩은 제 색을 꽉 채운
     네모, 기술은 어두운 알약에 제 색 테두리다. 배지 꼴만으로 "누구의 부대"와 "무슨 일이
     일어난 자리"가 갈린다. 바탕·글자색은 CSS(.scr-motion-cast)가 정한다. */
  /* (삭제·요청: 배지 더 이상 사용 안 함) — 기술 알약 배지 테두리(castStyle)가 있던 자리. */

  /* 지형(요청: 미니맵 이미지 분석) — 그림에서 걷는 땅 격자를 만들어, 지상 부대의 자취를
     그 위의 경로로 편다. 분석 전·실패 시에는 기존 곡선 폴백. */
  const [terrain, setTerrain] = useState<TerrainGrid | null>(null);
  /* 틈을 조이기 전의 원본 격자(지적: 지상 유닛들이 다 벽을 뚫고 다닌다) — 미니맵 해상도
     에서는 언덕길·초크가 딱 1칸 폭이라, 실틈 조이기(closeNarrowGaps)가 진짜 길목까지 막아
     지역이 통째로 끊겼다. 길찾기가 실패하면 직선 폴백이라 전부 벽을 뚫었다. 조인 격자로
     길이 안 나오면 이 원본으로 한 번 더 찾는다 — 실틈만 조이고 길목은 살리는 절충이다. */
  const [terrainRaw, setTerrainRaw] = useState<TerrainGrid | null>(null);
  /* 랠리 걸음의 경로 갈무리(지적: 벽뚫기) — (출발, 목적지) 짝마다 지형 길을 한 번만 셈한다.
     지형이 갈리면(검수 저장 등) 비운다. */
  const rallyRoutes = useRef(new Map<string, [number, number][]>());
  useEffect(() => { rallyRoutes.current.clear(); }, [terrain, terrainRaw]);
  /* (걷어냄) 시뮬 자취 적재 — 지형·편 지문으로 캐시 열쇠를 만들어 워커에 명령 자취를
     넘기던 자리다. 자리는 이제 서버가 구운 참값으로 오므로(loadEnt) 지형도 편도 걸음에
     쓸 일이 없다. 워커·캐시·지문 열쇠가 전부 여기서 사라졌다. */
  /* 지형 수정(요청: 모든 경기 리플레이 화면에서, 아무나) — 산 버튼이 검수 모달을 연다.
     저장하면 이 자리에서 바로 새 지형으로 갈아 끼운다(맵 캐시는 다음 로드에 새 값을 받는다). */
  useEffect(() => {
    let cancelled = false;
    /* 지형은 **맵 데이터에서 뽑은 참값** 하나뿐이다(요청: 참값 맵과 지형정보만 사용) —
       서버가 리플레이 안의 지도를 OpenBW로 올려 구운 타일 깃발이다. 게임 자신이 쓰는
       값이라 램프·벽·언덕이 한 칸도 안 틀린다.
       (걷음) 그림 색을 훑던 어림(terrainOf)과 사람이 칠하던 검수값(walk) — 둘 다 참값이
       없던 시절의 대역이다. 아직 안 구운 맵은 지형 없이 그린다(재분석이 채운다). */
    if (!grid.terrain) { setTerrain(null); setTerrainRaw(null); return undefined; }
    decodeMapTerrain(grid.terrain).then((mt) => {
      if (cancelled) return;
      if (!mt) return;   // 못 풀면 다음 로드에 다시 본다
      const tg = terrainGridOfMap(mt);
      setTerrain(closeNarrowGaps(tg));
      setTerrainRaw(tg);
    });
    return () => { cancelled = true; };
  }, [grid.terrain]);

  /* (걷어냄·요청) 맵연결 — 저장된 미니맵 그림 중 하나를 골라 이 경기의 맵에 잇던
     버튼과 그 고르기 창이 여기 있었다. 그 기능이 있던 까닭은 **지형을 그림에서
     어림했기 때문**이다: 그림이 없으면 벽도 없어서, 보는 사람이 직접 이어 줘야 했다.
     이제 지형은 맵 데이터에서 참값으로 온다(replay_maps.terrain) — 그림은 배경 취향일
     뿐이고, 그건 운영 메뉴의 미니맵 화면에서 맵마다 잇는다. 재생 화면이 짊어질 일이
     아니다. */
  /* 크립 차단 마스크(요청: 크립은 벽을 못 뚫고, 램프·다리도 못 넘는다) — 지형 칸 하나가
     픽셀 하나인 캔버스. 못 걷는 칸(벽) + 검수 모달에서 사람이 칠한 크립 불가 칸(램프·
     다리)을 검게 채워, 유닛 층이 크립 판을 깐 직후 이 판으로 파낸다. 검수 원본(terrainRaw)
     기준 — 화면용 틈새 메움(closeNarrowGaps)은 크립과 무관하다. */
  const creepMask = useMemo(() => {
    const tg = terrainRaw;
    if (!tg) return null;
    if (typeof document === "undefined") return null;
    const cv = document.createElement("canvas");
    cv.width = tg.w;
    cv.height = tg.h;
    const mx = cv.getContext("2d");
    if (!mx) return null;
    let any = false;
    mx.fillStyle = "#000";
    for (let y = 0; y < tg.h; y += 1) {
      for (let x = 0; x < tg.w; x += 1) {
        const i = y * tg.w + x;
        if (!tg.walk[i] || tg.creep?.[i]) { mx.fillRect(x, y, 1, 1); any = true; }
      }
    }
    return any ? cv : null;
  }, [terrainRaw]);

  /* 자취를 실제 이동으로 편다(지적: 클릭 자리로 순간이동해서 이상하다) — 명령은 도착이
     아니라 출발 신호다: 마커는 명령 시각에 그 자리에서 출발해, 경로(지상은 지형 BFS,
     공중은 직선)를 그 유닛의 속도(속업 포함)로 이동한다. 도착 전에 다음 명령이 오면 가던
     길 그 지점에서 새 목적지로 방향을 튼다. 명령이 없는 동안은 서 있는다 — 순간이동은
     구조적으로 없다. */
  /* (걷어냄) walkTrack — 렌더러가 제 길찾기(A*)·속도표·대기점으로 자취를 펴던 함수.
     코어(simCore)가 걸음의 진실이 되면서 나란한 두 세계 모형 중 이쪽을 걷는다. */
  /* 개체 걷기(v2·요청: 유닛 위치를 저마다 기억하고 브루드워 엔진처럼 분석) — 태그 하나가
     곧 마커 하나다. 저장된 증거 점(이동 명령의 목적지·남이 찍은 자리·건설 자리·정지)을
     그 유닛의 속도와 지형 길찾기(walkTrack)로 걸린다. 걷어낸 옛 부대 어림과 달리 묶고
     가르는 어림이 없어, 갑자기 나타나고 사라지는 유령이 원리상 안 생긴다. 생애의
     죽음(d)이 오면 마커를 걷는다. */
  /* 속업(이동 속도 업그레이드) 목록 — raw별 [초, 업그레이드 영문명].
     ★ 여태 이 자리는 v1 부대 트랙(p.ups)이 채웠는데, 요약이 폐지되며 그 트랙이 빈
       껍데기가 된 뒤로 **속업이 하나도 안 걸리고 있었다**(질럿 다리·오버로드 날개·
       벌처 부스터가 전부 기본 속도로 걸었다). 개체 트랙의 연구 기록에서 곧장 만든다.
     연구가 **끝난** 시각(upsDone)이 있으면 그쪽이 맞다 — ups는 누른 때다. */
  /* 사람별 유닛 완성 시각표 — raw → { 유닛 영문명: [완성 초…] }.
     ★ 이 자리도 v1 부대 트랙(p.prod)이 채우던 곳이라, 요약 폐지 뒤로는 비어 있었다.
       정보 팝업의 '생산 완료·큐'와 벙커 추정 사수가 그 빈 표를 읽고 있었다.
       개체 트랙에서는 개체의 출생(b)이 곧 그 유닛이 완성된 순간이라 곧장 만들 수 있다. */
  /* 나온 자리까지 아는 생산표 — raw → [{ 유닛, 완성 초, 나온 자리 }].
     ★ 지적: "라바 변태의 기록이 모든 해처리 간 공유되는 문제". 아래 prodDoneByRaw는
       **사람별**이라, 팝업이 해처리 하나를 눌러도 그 사람의 저그 유닛 생산이 통째로
       나왔다(배럭도 마찬가지다 — 라바가 워낙 많아 해처리에서 먼저 눈에 띈 것이다).
       분석은 이미 유닛마다 '어느 건물에서 나왔나'를 자리로 정해 둔다(replayUnits의
       출생지 결정: 건물 태그를 알면 그 자리, 라바처럼 모르면 그 종류의 실물 건물 중
       하나를 골라 발자국 아래 출구를 준다). 그 출생 증거가 개체의 첫 증거(f=3)로
       꽂혀 있으므로, 자리를 그대로 읽어 건물별로 가른다. */
  /* ★ 핵을 **미사일 자취**에서 되살린다(지적: "핵 모델과 폭발 표현 안나옴") ─────────
     핵 연출(표적 점→탄두 낙하→폭발)은 casts의 "Nuclear Strike" 기록이 여는데, 그 기록은
     **한 번도 실린 적이 없다**: 덤퍼의 시전 훅은 '기운을 쓰는 마법 발사' 경로에만 있고
     핵은 그 길을 안 지난다(BW_TECH_NAME에 핵 번호 자체가 없는 것도 같은 사정이다).
     전에는 미사일 개체가 종족 폴백 몸으로나마 보였는데(지적: "핵 탄두도 마린으로
     나와서 떨어지던데"), 그 몸을 NO_BODY로 걷으면서 — 연출이 그리는 줄 알고 — 핵이
     통째로 사라졌다.
     기록을 기다릴 것 없이 참값에 이미 다 있다: 미사일 개체 자취의 **죽은 시각이 곧
     착탄**이고, 죽은 자리가 곧 폭심이다. 발사 없이 사일로째 부서진 미사일은 태어난
     자리에서 죽으므로(움직인 거리 0) 거리로 걸러진다 — 착탄만 연출이 된다. */
  /* ★ **고스트가 유도하고 있는 창**(재지적: "고스트 핵 조준 자세 안해 아직도") ────────
     자세 판정이 castsNow를 보고 있었는데, 그 창은 `t − cs < NUKE_FALL_SEC` = **착탄 전
     7초**뿐이다(nukeCasts가 sec을 `died − 7`로 짓는다 — 그 값은 낙하 연출의 길이지
     유도의 길이가 아니다). 그런데 고스트는 미사일이 사는 **내내** 표적을 비춘다.
     참값에 그 창이 그대로 들어 있다: 핵탄두 개체의 born~died가 곧 유도 구간이다.
     자리는 착탄점 — 고스트는 원작 유도 사거리(8타일) 안에 서 있다. */
  /* ★ 핵은 **겹쳐 담기지 않게 거른다**(지적: "가끔 핵이 두방이 아주조금 차이로 두방
     떨어지는 버그가 있늠듯") ─────────────────────────────────────────────────────────
     여태 두 줄기를 그냥 이어 붙였다. 그런데 겹칠 길이 둘이다:
       ① 기록된 시전 자국(castsV2)에도 핵이 실려 오는 판 — 그러면 같은 착탄이 '기록 한
          번 + 합성 한 번'으로 두 번 그려진다. 시각도 자리도 거의 같으니 화면에서는
          **아주 조금 어긋난 두 방**으로 보인다. 지적의 그 그림이다.
       ② 같은 핵의 미사일이 자취에 개체 둘로 실린 판(태그가 갈리는 자리) — 그러면 합성
          끼리 겹친다.
     시각 3초·거리 3타일 안이면 같은 착탄으로 본다. 원작의 핵은 무장에만 한참이 걸려
     같은 자리에 3초 안에 두 방이 떨어지는 일이 없다. 기록이 있으면 그것을 남기고
     합성을 버린다 — 기록 쪽이 시전자(raw)를 제대로 들고 있다. */
  /* 진단 손잡이 — 콘솔에서 `__nukeLase`를 찍으면 이 경기에 유도 구간이 몇 개 잡혔는지,
     그 시각·자리가 무엇인지 바로 보인다. 고스트 자세가 또 안 서면 여기가 비었는지부터
     가른다(비었으면 참값에 핵탄두 개체가 없다는 뜻이고, 그건 재분석 몫이다). */
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__nukeLase = nukeLase;
  }
  /* 유령 부대 흡수(지적: 1시에 쳐들어간 테란 병력이 아무것도 안 하고 계속 서 있음 —
     같은 부대를 다시 드래그하면 선택 묶음(g)이 갈려 새 부대가 되고, 옛 마커가 마지막
     명령 자리에 영영 남았다. 실측: 한 공격 방면에 묶음 여덟이 줄줄이). 부대 A의 마지막
     명령 곁(8타일)에서 150초 안에 딴 부대 B가 첫 명령을 받으면 — 그 자리 유닛들을
     다시 집은 것이다 — A는 그 순간 B에 흡수된 것으로 보고 걷는다. */
  /* ── 교전 붙기(지적: 적이 가까이 있는데 전투를 안 한다 — 시야에 들면 맞붙는 게
     자연스럽다. 근접 유닛은 이동해 붙어서 싸우고, 원거리는 사정거리까지만 이동) —
     그리기 직전의 표시 조정이다. 원본 자취(명령 좌표)는 그대로 두고, 이 프레임의 가장
     가까운 적 유닛 마커를 향해 '남은 거리의 반'만 끌어당긴다. 반씩인 이유: 상대도 같은
     조정으로 다가오므로 양쪽이 반씩 오면 꼭 목표 거리(근접 0.8타일, 원거리 사정거리)
     에서 만나고, 서로 원좌표 기준이라 지나쳐 겹치지 않는다. 시야(9타일) 밖은 안 끈다. */
  /* (걷어냄) 띄운 건물의 비행 보간 afloatPosAt — 재료였던 v1 비행 클릭 자취(fpts)가
     요약 폐지로 사라진 뒤 늘 출발 자리를 그대로 돌려주고 있었다. 개체 트랙은 이·착륙을
     **자리마다 한 줄**로 나눠 싣는다(buildsV2: ev 2·5마다 새 줄) — 뜨기 전 자리와 내린
     자리는 각각 제 줄이 정확히 안다. 잃은 것은 그 사이를 잇는 비행 애니메이션뿐이고,
     그것은 이미 나오지 않고 있었다. */
  /* 핵 착탄들 + 성공 판정(지적: 실패가 더 많다) — 발사가 다 착탄이 아니다(고스트가
     끊기면 불발). 착탄 시각 언저리(−2초~+90초)에 반경 안 건물이 실제로 무너진 발사만
     '터진 핵'으로 본다. 불발은 표적 점만 보이다 만다. 유닛 몰살도 터진 핵만이다. */
  /** 핵으로 **앞당겨진** 걷히는 시각 — 줄 하나에 하나다(줄 배열 자체를 열쇠로 삼는다).
   *
   *  ★ 이 값이 왜 공용이어야 하나(지적: "아무것도 없는데 시야가 남는 경우가 있음 그것도
   *    팀과 무관하게 시야가 확보됨") ────────────────────────────────────────────────
   *    그리는 쪽은 핵 착탄으로 이 시각을 앞당긴다: 파괴 감지가 한참 뒤에 잡힌 줄은 착탄
   *    순간으로 당기고, 폭심 4타일 안의 본진 아닌 건물은 **파괴 기록이 아예 없어도** 걷는다
   *    (그 자리 주석). 그런데 안개·표적 명단은 줄에 적힌 원래 `gone`만 봤다. 그래서
   *      · 감지가 90초 뒤였던 건물은 그 90초 동안,
   *      · 기록이 아예 없던 건물은 **경기 끝까지**,
   *    화면에는 없는데 시야는 그대로인 자리가 남았다. 기본 보기는 모두의 시야를 합치므로
   *    (visAll) 그것이 '팀과 무관하게 확보된 시야'로 보인다 — 지적의 그 그림이다.
   *    표적 명단도 같은 값을 봐야 한다(빈 자리를 계속 쏘던 그 갈래와 한 뿌리다).
   *  이사 비행 줄(liftAt)은 안 건드린다 — 그쪽 `gone`은 파괴가 아니라 **착륙 시각**이다. */

  /* only(요청: 포톤·성큰·스포어가 사거리 안 대상을 안 친다) — 대공 전용(스포어)·대지
     전용(성큰)은 못 치는 갈래를 아예 안 본다. 안 주면 종전대로 아무나 가장 가까운 적. */
  /* 적 명단을 8타일 칸 격자에 담는다(계측: nearestFoe가 CPU 자기 시간 5%) — 여태
     부르는 쪽마다 적 **전부**를 훑고, withBld면 스프레드로 새 배열까지 만들었다.
     고리(ring)를 넓혀 가며 보면 난전에서는 첫 칸에서 끝난다. 판정(팀·공중·은신·시야)은
     아래 tryFoe 한 곳에 그대로 있다 — 격자는 후보 순서만 바꾼다. */
  /* ══ 플레이어 시점 보기(요청: "플레이어 로스터 선택시 해당 선수 화면 보기로 변경 —
     시야 및 맵 밝힘 이력 … 같은 팀과는 시야공유됨을 주의" · "한번더 누르면 전체플레이어
     보기로 다시 돌아옴") ══════════════════════════════════════════════════════════
     원작의 안개는 **세 단**이다(되물어 확정) — 그 셋을 그대로 옮긴다:
       0 안 밝힘 — 한 번도 못 본 칸. 새까맣다.
       1 밝혔으나 지금은 안 보임 — 지형은 어둡게 남고, 그 사이에 본 **건물은 잔상으로**
         남는다(원작이 건물만 기억하는 그것). 적 유닛은 안 그린다.
       2 지금 보임 — 여느 때처럼 다 그린다.
     시야는 **팀 것**이다 — 같은 팀 사람의 유닛·건물이 밝힌 자리는 함께 보인다.
     ★ 카메라는 안 옮긴다(되물어 확정) — 리플레이에 카메라 좌표가 없어서, 옮기려면
       '최근 명령 자리' 같은 것을 지어내야 한다. 보는 자리는 사람이 정한다. */
  /* 추적으로 열린 링크는 시야도 그 사람 것으로 시작한다 — 추적을 켜면 시점도 함께 가는
     규약 그대로다(아래 toggleTrack). */
  const [viewRaw, setViewRaw] = useState<string | null>(initialTrack ?? null);
  const viewTeam = viewRaw ? (teamOfRaw(viewRaw) ?? 0) : 0;
  /* ══ 선수 추적(요청: "로스터 각 멤버 왼쪽에 추적 버튼 추가 · 활성화시 해당유저의 시야
     적용 + 해당유저의 현재(마지막) 유닛/건물 선택 위치를 보여줌 · 배율은 기본 줌인 값")
     ═══════════════════════════════════════════════════════════════════════════════
     시점 보기(위 viewRaw)가 "그 사람의 눈으로 **밝힘**"만 맡았다면, 추적은 거기에
     "그 사람이 **보고 있던 자리**"를 더한다. 그때 카메라를 안 옮긴 까닭은 바로 위에
     적혀 있다 — 리플레이에 카메라 좌표가 없어서다. 그 자리를 이제 **명령**으로 잡는다:
     리플레이가 남기는 것 중 사람의 눈길에 가장 가까운 것이 '방금 무엇을 집어 무엇을
     시켰나'이고, 이 재생기는 이미 그 자국으로 선택 링을 그린다(아래 selNow).
     곧 추적은 새 자료를 지어내지 않는다 — 이미 그리고 있던 것을 카메라가 따라갈 뿐이다.
     추적을 켜면 시점도 그 사람으로 간다(요청) — 남의 눈길을 따라가면서 지도는 내가 다
     보고 있으면, 그 사람이 왜 거기를 보는지가 안 읽힌다. */
  /* 링크가 사람을 가리키면 **켠 채로** 연다(요청: 장면 공유·스크랩의 &tr=) — 받는 쪽이
     같은 장면을 보려면 '언제·어디를·얼마나 빠르게'에 더해 '누구를 따라가며'까지 같아야
     한다. 시야(viewRaw)도 함께 간다: 추적을 켜면 시점도 그 사람으로 가는 규약 그대로다
     (아래 toggleTrack). */
  const [trackRaw, setTrackRaw] = useState<string | null>(initialTrack ?? null);
  /** 추적 켜기·끄기 — 시야(viewRaw)를 함께 끌고 다닌다. 끄면 시야도 전체로 돌아간다. */
  /** 추적을 끈다 — **보던 자리에 머문다**(요청: "추적 보다가 끄면 맵 위치가 기존에 보던 곳으로 돌아가는데
   *  그러지 않게 추적이 보고 있던 곳에서 유지"). 추적 중의 팬은 trackView가 렌더마다 내는 값이라 panBase는
   *  추적을 켜기 전 자리에 그대로 멈춰 있었다 — 끄는 순간 그 옛 자리로 튀었다. 끌 때 추적 카메라의 마지막
   *  팬을 panBase에 옮겨 심는다. 시점(이름 누르기)으로 추적이 풀리는 길도 같은 문을 지난다. */
  const stopTrack9 = (): void => {
    if (trackRaw && trackCamRef.current.raw === trackRaw) setView9(zoomRef.current, { ...trackCamRef.current.pan });
    setTrackRaw(null);
  };
  const toggleTrack = (key: string): void => {
    const on9 = trackRaw !== key;
    if (on9) setTrackRaw(key); else stopTrack9();
    setViewRaw(on9 ? key : null);
    /* 켜는 순간 **한 번만** 당겨 준다(요청: 배율은 기본 줌인 값, 사다리에서) — 그 뒤로는
       사람이 마음대로 바꾼다(요청: "줌은 변경 가능하게"). 끌 때는 안 되돌린다: 보던
       배율이 갑자기 튀면 추적을 껐다 켜는 것만으로 화면이 요동친다. */
    if (on9) setView9(trackZoom9(), panRef.current);   // 폭에 비례 — 가로 24타일(위 trackZoom9)
  };
  /** 태그 → 그 태그의 유닛 생애들 — 변태로 갈린 생애가 같은 태그를 나눠 쓴다. */
  /* 걷기는 추적을 켤 때 워커에 청한다 — 세계가 바뀌었으면(worldGen9) 다시. */
  useEffect(() => {
    if (!trackRaw || walksAskedRef9.current === trackRaw) return;
    const w9 = frameWorkerRef.current;
    if (!w9) return;
    walksAskedRef9.current = trackRaw;
    // 그 임자의 걷기만 — 걷기 창은 참값 키 배열을 가리키므로 복제하면 그 트랙의 키가 통째로 건너온다. 임자 하나면 견딜 만하다.
    w9.postMessage({ type: "want", what: "walks", raw: trackRaw });
  }, [trackRaw, worldGen9, workerTick9]);
  const walksByTag = useMemo(() => {
    const m9 = new Map<number, typeof entWalks>();
    /* 추적을 켜기 전에는 **한 톨도 안 만든다** — 이 표를 쌓는 데 드는 것은 생애 수만큼의
       한 바퀴인데, 안 쓰는 화면에서까지 낼 값은 아니다(로스터를 안 누른 사람이 대부분이다). */
    if (!trackRaw) return m9;
    for (const e9 of entWalks) {
      const a9 = m9.get(e9.tag);
      if (a9) a9.push(e9); else m9.set(e9.tag, [e9]);
    }
    return m9;
  }, [entWalks, trackRaw]);
  /** 태그 → 건물 생애들 — 건물은 자취(entWalks)에 안 들어간다(v1 건물 층이 그린다). */
  const bldsByTag = useMemo(() => {
    const m9 = new Map<number, TruthLife[]>();
    if (!entData || !trackRaw) return m9;
    for (const e9 of entData.lives) {
      if (!e9.bld) continue;
      const a9 = m9.get(e9.tag);
      if (a9) a9.push(e9); else m9.set(e9.tag, [e9]);
    }
    return m9;
  }, [entData, trackRaw]);
  /** 이 태그의 몸이 그 순간 서 있던 타일 — 죽었거나 아직 안 났으면 null. */
  const bodyAt9 = useCallback((tag9: number, sec9: number): { x: number; y: number } | null => {
    for (const e9 of walksByTag.get(tag9) ?? []) {
      if (sec9 < e9.born || (e9.died !== null && sec9 > e9.died)) continue;
      const p9 = posAtW(e9.walk, sec9);
      if (p9) return { x: p9.x, y: p9.y };
    }
    for (const b9 of bldsByTag.get(tag9) ?? []) {
      if (sec9 < b9.born || (b9.died !== null && sec9 > b9.died)) continue;
      /* 건물은 안 걷는다 — 다만 테란은 띄워 옮겨 앉으므로 '그때까지 앉은 마지막 자리'를
         고른다. sites는 발자국 왼쪽 위라 몸 한가운데로 옮겨 준다. */
      const fp9 = FOOTPRINT[b9.kind] ?? [3, 2];
      let st9: [number, number, number] | null = null;
      for (const q9 of b9.sites) if (q9[0] <= sec9) st9 = q9;
      if (st9) return { x: st9[1] + fp9[0] / 2, y: st9[2] + fp9[1] / 2 };
      return { x: b9.bornX, y: b9.bornY };
    }
    return null;
  }, [walksByTag, bldsByTag]);
  /** 추적하는 사람의 **집은 자국** — [초, 그때 명령을 받은 태그들], 오름차순.
   *
   *  같은 순간에 명령을 받은 몸들이 곧 그때 잡혀 있던 무리다. 0.25초 칸으로 모으는 것은
   *  참값이 같은 틱의 명령을 정확히 같은 초로 적지 않을 수 있어서다 — 무리가 둘로
   *  갈리면 카메라가 그 사이에서 흔들린다. */
  const trackPicks = useMemo(() => {
    if (!trackRaw || !entData) return [] as { sec: number; tags: number[] }[];
    const mine9 = new Set(entData.players.filter((pl) => pl.name === trackRaw).map((pl) => pl.owner));
    const by9 = new Map<number, Set<number>>();
    for (const e9 of entData.lives) {
      if (!mine9.has(e9.owner)) continue;
      for (const o9 of e9.orders) {
        const k9 = Math.round(o9[0] * 4) / 4;
        const g9 = by9.get(k9);
        if (g9) g9.add(e9.tag); else by9.set(k9, new Set([e9.tag]));
      }
    }
    return [...by9.entries()]
      .map(([sec, tags]) => ({ sec, tags: [...tags] }))
      .sort((a, b) => a.sec - b.sec);
  }, [trackRaw, entData]);
  /** 지금 추적이 보고 있는 자리(타일) — 마지막 자국의 몸들을 평균한 점.
   *
   *  자국의 **클릭 좌표**가 아니라 집힌 몸의 **지금 자리**다(요청: "선택 위치") — 그래야
   *  카메라가 그 무리를 따라 흐른다. 다 죽었으면 그 앞 자국으로 몇 걸음 물러난다:
   *  방금 집은 것이 방금 죽는 일(교전)이 잦은데, 그때마다 화면이 멎으면 안 된다. */
  const trackAt = ((): { x: number; y: number } | null => {
    if (!trackRaw || trackPicks.length === 0) return null;
    let lo9 = 0;
    let hi9 = trackPicks.length - 1;
    let at9 = -1;
    while (lo9 <= hi9) {
      const mid9 = (lo9 + hi9) >> 1;
      if (trackPicks[mid9].sec <= t) { at9 = mid9; lo9 = mid9 + 1; } else hi9 = mid9 - 1;
    }
    for (let k9 = at9; k9 >= 0 && k9 > at9 - 8; k9 -= 1) {
      let sx9 = 0;
      let sy9 = 0;
      let n9 = 0;
      for (const tg9 of trackPicks[k9].tags) {
        const p9 = bodyAt9(tg9, t);
        if (!p9) continue;
        sx9 += p9.x; sy9 += p9.y; n9 += 1;
      }
      if (n9 > 0) return { x: sx9 / n9, y: sy9 / n9 };
    }
    return null;
  })();
  /** **아무도 안 골랐을 때** — 전체 밝히기가 아니라 **모두의 시야를 합친** 보기다
   *  (요청: "플레이어 미선택시 전체 밝히기가 아니라 전체 시야 개념으로 변경 전체
   *  밝히기는 이제 없음").
   *  뜻이 이렇게 갈린다: 전체 밝히기는 '지도를 다 아는 관전자'이고, 전체 시야는
   *  '경기에 있던 눈을 다 합친 것'이다. 뒤쪽에서는 아무도 안 가 본 구석이 끝까지
   *  검게 남고, 그것이 그 경기에서 실제로 밝혀진 만큼이다.
   *  이 보기에서는 **아무것도 안 가려진다**: 유닛은 언제나 제 임자의 시야 안에 있고,
   *  건물도 제 시야가 저를 덮는다. 곧 달라지는 것은 '아무도 안 본 땅'뿐이다. */
  const visAll = viewTeam !== 1 && viewTeam !== 2;
  /** 안개를 셈할 재료가 있나 — 자취가 없는 옛 기록은 종전대로 통째로 보인다. */
  // 안개는 개체 트랙이 있을 때만(옛 경기는 없다) — 걷기(entWalks)는 이제 추적을 켤 때만 받으므로 그 길이로 가리면 안 된다.
  /* ★ worldEnts9 문을 걷었다(재지적: "처음에 안개 깜빡임 여전") — 참값(entData)이 있으면 안개는 켜진 것이다. 워커의
     첫 세계 표(개체 없음)가 올 때까지 안개를 끄면 지도가 밝게 한 번 보였다가 안개가 덮이는 깜빡임이 났다. 첫 장이
     오기 전에는 아래 fogHold9(전부 안개)를 그린다 — 밝았다 어두워지는 대신 어두운 채로 시작해 걷힌다. */
  /** 안개를 셈할 재료가 있나 — 자취가 있는 경기인가. 켤지 말지는 아래 fogOn이 정한다. */
  const fogReady9 = !!entData && entData.lives.length > 0;
  void worldEnts9;
  const gw9 = grid.width;
  const gh9 = grid.height;
  /** 밝힘 이력 — 칸마다 '그 팀이 **처음 본** 초'. 안 본 칸은 NEVER. */
  const FOG_NEVER = 65535;
  /* 눈길 한 벌 — 이 팀의 **모든 눈이 언제 어디를 봤나**를 한 번 훑는 장치다.
     두 가지가 이 하나에서 나온다:
       · exploredAt — 칸마다 **처음** 본 초(안개의 0단/1단을 가른다). 게임 전체를 훑는다.
       · lastSeen   — 칸마다 **마지막으로** 본 초(건물 잔상의 자격을 가른다). 지금 시각
                      까지만 훑는다. 시점을 갈거나 되감을 때 다시 쌓는다(아래).
     한 곳에서 내는 까닭은 둘이 반드시 같은 눈을 봐야 해서다 — 갈라 두면 '밝히기는
     했는데 본 적은 없는' 같은 앞뒤 안 맞는 상태가 생긴다(실제로 그 버그가 났다). */
  /* ★ 안개 한 통(23.87ms)을 **넷으로 쪼갠다** — 통이 넓으면 범인을 못 짚는다.
     이 구간에는 매 렌더 도는 LOS 앞셈, 밝힘 이력 memo, 시야 쌓기, 기억 훑기가 다 들어
     있었다. 적응 조르기를 넣었는데 값이 그대로였던 것도 그래서다: 조른 것은 셋째뿐인데
     통은 넷을 합쳐 보여 준다. 넷을 갈라야 어느 것이 안 줄었는지 보인다. */
  /* ★ (걷어냄) **nearestFoe — '가장 가까운 적' 찾기** 통째로(지시: "모든 어림과 시야
     체력감소 등 조건 다 제거했지?") ─────────────────────────────────────────────────
     이 한 함수가 어림 넷을 품고 있었다:
       ① 가장 가까운 적을 표적으로 삼기 — 원작 유닛은 제 표적을 따로 들고 다닌다.
       ② 지형 가림(sightBlocked) 판정 — 그 표적을 정말 볼 수 있나를 우리가 되짚던 몫.
          계측에서 CPU 자기 시간 1위였다(24%).
       ③ needHurt — 방어 건물이 '최근 체력이 떨어진 것'만 표적으로 삼던 증거. 참값에
          누구를 쏘는지가 없어 체력 자국으로 뒤를 밟던 자다.
       ④ 못 치는 갈래·은신·스태시스 거르기 — 겨눌 자격을 우리가 다시 매기던 몫.
     참값이 order_target을 실어 준 뒤로 넷 다 물을 일이 없다: **못 겨누는 것은 애초에
     order_target이 아니다.** 표적 지도(entPosByTag)에서 한 번 찾으면 끝이고, '누가 나를
     때렸나'도 그 지도를 뒤집으면 나온다(foeByTarget).
     함께 사라진 것: 적 명단 8타일 격자(foeBins·bldBins)를 매 프레임 다시 담던 일,
     그 격자를 고리로 훑으며 후보마다 레이캐스트를 쏘던 일, 맞은 것만 담던 hurtFoes.
     계측판의 `표적찾기`도 이제 안 뜬다 — 잴 것이 없다. */
  /** ★ 표적 흐름에서 **지금 겨눈 행**을 낸다(참값 판 6) — 방어 건물·벙커 승무원이 쓴다.
   *  흐름이 없으면(옛 판) null, 0이면 '안 겨눔'이라 역시 null이다.
   *  개체 쪽은 제 자리에서 같은 셈을 하고(tgtTag9), 여기는 그 셈을 건물 몫으로 한 번 더
   *  적지 않으려고 문 하나로 낸다. */
  /* 정찰 자취도 걸어서 가고(지적: 갑자기 이동 — 직선이되 일꾼 걸음), 갈래·부대로 갈라
     각자의 점이 된다(지적: 드랍십 순간이동 — 일꾼 정찰과 셔틀 원정이 한 점을 놓고
     밀당했다). 갈래는 이름을 정한다(지적: 오버로드 이름이 안 나온다). */
  /* (걷어냄) 정찰 자취 한 벌 — 일꾼·수송선·단독 클릭의 자취(spts·tpts·opts)를 본진에서
     이어 걷게 하던 어림이다. 재료가 전부 v1 부대 트랙이었고, 요약 폐지 뒤로는 빈
     배열이라 아무것도 그리지 않았다. 지금은 개체 트랙(entWalks)이 정찰 유닛도 제 태그로
     걷게 하므로 따로 어림할 것이 없다. */
  // 기본은 ×3이다(요청: ×8 → ×4였다가 눈금이 1·2·3·5·10·20으로 바뀌며 가장 가까운 값).
  /* ★ 기본은 **1배**다(지시) — 여태 2배로 시작했다. 처음 보는 사람에게 두 배로 흐르는
     화면은 '빠르게 넘긴 것'이 아니라 그냥 어수선한 것이고, 배속은 손잡이가 화면에 있어
     원하면 올리면 된다. 링크가 배속을 실어 왔으면(&s=) 그것으로 시작한다 — 보낸 사람이
     보던 그 장면에는 속도도 들어 있다. */
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(() => {
    const v9 = SPEEDS.find((s9) => s9 === initialSpeed);
    return v9 ?? 1;
  });
  /* 배속도 시각·자리와 같은 결로 적어 둔다(위 playbackSpeedOf) — 공유 버튼이 &s=로 싣는다.
     시계 적기(playbackClockOf)와 나란히 두고 싶지만 그쪽은 speed가 서기 전이라 여기다. */
  useEffect(() => {
    if (clockKey) playbackSpeedOf.set(clockKey, speed);
  }, [speed, clockKey]);
  useEffect(() => () => { if (clockKey) playbackSpeedOf.delete(clockKey); }, [clockKey]);
  /* 탐색바(지적: 다이얼 드래그가 안 되고, 부드럽지 않고 반응이 느림) — 제어 입력은 매
     프레임 React가 값을 덮어써 잡은 손잡이와 싸웠고, 끌 때마다 지도 전체가 그려져 손을
     못 따라왔다. 입력을 비제어로 두고(손잡이는 브라우저 몫), 재생 중의 위치는 ref로 직접
     쓰며, 끌기의 지도 이동(setT)은 rAF로 프레임당 한 번으로 묶는다. */
  const rangeRef = useRef<HTMLInputElement>(null);
  const scrubbing = useRef(false);
  const seekPending = useRef<number | null>(null);

  /* (삭제·요청: 모바일 확대 기능 제거) — 더블탭·핀치 렌즈를 통째로 걷었다. PC 확대는
     이미 걷었으니(마우스 더블클릭 무시) 렌즈는 더 이상 쓸 곳이 없다. 확대는 큰 화면
     보기(확대 모달)가 맡는다. */
  const [done, setDone] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  /* (삭제) 본진 아바타 클립 id — 사진을 도형으로 자르지 않게 되면서(지적) 클립 자체가
     없어졌다. */
  /* PC 상세 넓은 배치(요청: 확대창 제거, 관련 소스까지) — 겹창·포털·가리개는 걷고,
     옛 확대창의 배치(맵 왼쪽 최대 + 오른쪽 기둥에 로스터·조작부·댓글, 케밥·닫기)는
     상세 화면 안 인라인 기본이 됐다(요청: 댓글부를 미니맵 우측으로 — 기존 확대창 방식).
     상세(onDetailClose가 온 자리) + PC 폭에서만 선다. 모바일 확대 버튼도 함께 걷었다 —
     상세가 이미 전체 화면이다. */
  /* 넓은 배치 판정(재지적: 댓글부가 우측으로 안 감 — 원인 찾음) — 여태 "상세(onDetailClose)
     + 창 폭"으로 묶어 뒀는데, 사용자가 보던 화면은 상세가 아니라 '활동 카드'였다. 카드
     자리에서는 창이 아무리 넓어도 게이트가 안 열렸다. 이제 이 플레이어가 앉은 '자리의
     실제 폭'(부모 상자, ≥860px)만 본다 — 상세든 카드든 자리가 넓으면 옛 확대창 배치
     (맵 왼쪽 + 오른쪽 댓글 기둥)를 쓴다. 좁은 자리는 그대로 세로 배치다. 닫기(X·Esc)는
     여전히 상세에서만이다. */
  const rootRef = useRef<HTMLDivElement | null>(null);
  /* ★ 뿌리가 **붙는 때**를 잡는다(지적: "stargayte에서는 부모 폭이 860px 이상이 돼도
     .scr-motion-wide가 안 붙어") — 아래 관찰자는 마운트 때 한 번만 달렸다. 그때 뿌리가 아직
     없으면(자료를 기다리는 동안 다른 갈래를 그리거나, 담는 쪽이 늦게 앉히면) 부모를 못 잡고
     영영 좁은 보기로 남았다. 콜백 ref로 뿌리가 붙을 때마다 상태에 실어 관찰자를 다시 단다. */
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const setRoot = useCallback((el: HTMLDivElement | null): void => { rootRef.current = el; setRootEl(el); }, []);
  const [wide, setWide] = useState(false);
  /* 지도를 '남는 세로에 꽉 맞춘다'(지적: "세로 스크롤 안 만드는 건 좋은데 그건 세로
     높이에 맞추라는 얘기지 저렇게 작게 고정하라는 게 아녀" / "scr-motion-wide 높이를
     페이지 높이랑 맞게! 대신 가로 스크롤은 생길 수도 있겠지").
     앞서 100dvh에서 상수(278/320px)를 빼 봤는데, 그 상수는 페이지 머리와 지도 아래 줄들의
     높이를 어림한 값이라 화면·배치마다 틀렸고 대개 너무 크게 잡혀 지도가 작아졌다.
     이제는 잰다: 지도줄의 화면 위 여백과, 뿌리 상자 안에서 지도줄 아래에 있는 것들의
     높이를 그때그때 재고 남는 세로를 지도 비율로 되돌려 폭으로 준다. 가로가 넘치면
     가로 스크롤이 나는데, 그건 사용자가 받아들인 쪽이다.
     지도가 커지면 뿌리도 커지므로 되먹임이 생길 수 있어 4px보다 작은 변화는 무시한다. */
  useEffect(() => {
    const host = rootEl?.parentElement;
    if (!host) return undefined;
    const measure = (): void => setWide(host.clientWidth >= 860);
    measure();   // 관찰자 첫 발화를 기다리지 않고 바로 한 번 잰다.
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [rootEl]);
  /* 맵 뷰어 크기는 고정이다(요청: "맵뷰어 크기는 1024*1024로 고정, 가로 세로 중 더 긴
     쪽을 맞추면 돼") — 화면 높이에 맞춰 폭을 되돌리던 자동 계산을 통째로 걷었다.
     그 계산은 넓은 배치에서 **한 번도 작동한 적이 없다**: 맵줄(.scr-motion-maprow)이
     display:contents라 상자를 안 만들고, 그런 요소의 getBoundingClientRect()는 전부 0을
     돌려준다. 그래서 남은 세로가 늘 음수로 나와 조기 반환됐고, PC의 맵 크기는 사실
     그리드의 minmax(0,1fr) 칸이 정하고 있었다.
     이제 긴 쪽을 1024에 맞춘다 — 정사각 맵이면 1024×1024, 가로가 긴 맵이면 폭이 1024다.
     좁은 화면(넓은 배치 아님)은 종전대로 폭 100%로 흐른다. */
  const MAP_VIEW_PX = 1024;
  const mapViewW = grid.width >= grid.height
    ? MAP_VIEW_PX : Math.round((MAP_VIEW_PX * grid.width) / grid.height);
  /* ★ 자격은 onDetailClose 하나다(지시) — 여기 있던 `wide`는 얻는 것 없이 막기만 했다.
     onDetailClose는 상세 모달에만 오는 손잡이라 그것만으로 이미 '모달이다'가 되고,
     정작 그 모달의 폭은 820이라 wide(≥860)가 영영 안 열렸다 — 이 Esc는 **여태 한 번도
     안 먹었다**. 키보드 판을 soleView로 옮기며 함께 걷는다(그쪽 주석의 그 사정과 같은
     갈래다: 폭은 '홀로 있나'의 대역이었을 뿐이다).
     ESC가 무엇을 닫을지는 두 판이 pickedRef로 나눠 가른다(그 ref의 주석) — 인포 팝업이
     열려 있으면 그쪽이 먼저 닫고, 아니면 이 판이 상세를 닫는다. */
  useEffect(() => {
    if (!onDetailClose) return undefined;
    // Esc = 닫기 버튼과 같은 길 — 상세를 닫는다.
    const onKey = (e: KeyboardEvent) => {
      /* 팝업이 열려 있으면 손을 뗀다 — 전체화면 나가기 판과 같은 규약(요청: "한 번에
         둘이 닫히면 안 된다"). 이 판이 살아나면서 비로소 필요해진 걸림쇠다: 여태
         죽어 있어(wide가 안 열렸다) 팝업과 겹칠 일이 없었다. */
      if (e.key === "Escape" && pickedRef.current === null) onDetailClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDetailClose]);

  /* 재생이 손잡이를 민다 — 비제어라 React가 안 밀어 주므로 여기서 직접 쓴다. 잡고 있는
     동안은 안 민다(그 순간의 임자는 손이다). */
  useEffect(() => {
    if (scrubbing.current) return;
    const el = rangeRef.current;
    if (!el) return;
    el.value = String(t);
    el.style.setProperty("--p", `${total > 0 ? (t / total) * 100 : 0}%`);
  }, [t, total]);

  /* (삭제·요청: 확대창 완전 제거) — 확대창 자동 열기(autoBigHolder)·closeBig·축소
     기억 전부. 넓은 배치는 위의 wide가 인라인으로 잇는다. */

  /* PC 휠 줌(요청) — 맵 위에서 휠로 확대/축소, 커서 자리를 붙든 채 늘어난다. 팬은 줌
     계산에 함께 실려 경계 밖이 안 보이게 죈다. */
  /* 이어서 늘릴 때의 상한(요청: "재생 확대 최대 8배로 수정") — 휠·핀치처럼 배율이
     연속으로 움직이는 길이 여기까지 간다. 더블클릭·더블탭이 한 번에 뛰는 자리는
     ZOOM_GAME 그대로다(그건 앞서 6 → 4로 낮춰 달라던 값이라 건드리지 않는다).
     핀치 상한이 20이라 다른 길과 안 맞던 것도 여기로 모은다. */
  /* 8 → 16 → 8 → **12**(지시: 사다리를 1·2·3·6·12로) — 맨 위 칸이 곧 상한이다.
     16은 화면에 유닛 한둘만 남아 무슨 상황인지가 안 읽혔고, 12는 그 앞 칸(6)의 두 배라
     '더 크게 보는' 자리를 남기면서도 판이 남는다. */
  const ZOOM_MAX = PLAYBACK_ZOOM_MAX;
  /* 배율을 **다섯 칸**으로 끊는다(제안: "줌 단계를 5개로 줄이고 캐싱하면 좀 덜
     끊기려나") — 맞는 짐작이고, 까닭은 캐시다. 유닛 판은 그리는 크기(sizePx × zoom)를
     2px 칸으로 양자화해 굽는데, 배율이 연속이면 그 칸이 끊임없이 옮겨 간다: 확대하는
     내내 종류마다 새 판을 굽고 옛 판은 버려져, 손짓 한 번에 굽기가 수십 번씩 터진다.
     칸이 다섯뿐이면 한 번씩만 구워 두면 그 뒤로는 **전부 캐시 적중**이다.
     간격은 등비(약 1.68배)로 잡는다 — 확대·축소의 한 칸이 어느 자리에서나 같은 크기로
     느껴진다. 맨 아래가 1(전체), 맨 위가 ZOOM_MAX(게임 화면 배율)다. */
  /* 배율 칸 — **1·2·3·6·12**(지시: "확대 버튼 배율 변경하려고 해, 보기 좋은 배율이
     따로 있었어. 1→1 2→2 4→3 8→6 16→12") ────────────────────────────────────────────
     앞판은 두 배씩(1·2·4·8·16)이었다. 한 칸이 곧 다른 화면이라는 점은 좋았는데, 눈으로
     쓰다 보니 3배와 6배가 실제로 보기 좋은 자리였다 — 2와 4 사이가 비어 있었고, 8·16은
     화면에 남는 유닛이 너무 적었다. 아래 둘(1·2)은 그대로 두고 위 셋만 내린다.
     칸이 다섯이라는 점은 그대로다 — 그게 굽기 캐시를 살리는 자리다(유닛 판은 그리는
     크기를 칸으로 양자화해 굽는데, 배율이 연속이면 확대하는 내내 새 판을 굽는다).
     ★ 문턱들은 **칸 번호로** 걸려 있어 저절로 따라온다(detailAt·markerAt이 ZOOM_STEPS[n]
       을 읽는다) — 그래서 여기 다섯 수만 고치면 된다. 수로 박힌 문턱 둘만 따로 본다:
       트레이서(2배)는 그대로 칸에 있고, 최고 등급 문턱(LOD_ALL_ZOOM 2.5)은 여전히
       '셋째 칸부터'를 뜻한다(2 < 2.5 ≤ 3). 뜻이 안 갈리므로 둘 다 그대로 둔다.
     ★ 8배를 넘으면 판이 굽는 크기 상한(unitBakeCap)에 걸려 **그 판을 늘려 찍는다** —
       더 선명해지지는 않고 크기만 커진다. 맨 위 칸(12)은 '더 크게 보는' 자리이지 '더
       또렷하게 보는' 자리가 아니다. */
  /** 진단 오버레이(#diag) — 주소로 켠다. 한 번만 읽는다(주소가 바뀌면 새로고침). */
  const [diagOn] = useState(scrDiagOn);
  const ZOOM_STEPS = [1, 2, 3, 6, 12];
  /** 더블클릭·더블탭이 **한 번에 뛰는** 배율(요청: "더블클릭 시 맨 위가 아니라 한 칸
   *  아래로") — 이어서 늘리는 길(휠·핀치·한 손 줌)의 상한은 ZOOM_MAX 그대로다. 한 번에
   *  뛰는 자리만 **한 칸 낮다**: 맨 위 칸은 화면에 유닛 한둘만 남아 무슨 상황인지가 안
   *  읽히고, 굽기 상한(unitBakeCap)을 넘어 더 또렷해지지도 않는다. 더 크게 보고 싶으면
   *  그 자리에서 휠·핀치로 한 칸 더 가면 된다.
   *  ★ 수로 안 적고 **사다리에서 꺼낸다** — 칸을 고칠 때 여기가 따라오지 않으면 더블탭이
   *    사다리에 없는 배율로 뛴다(그러면 snapZoom이 곧장 옆 칸으로 끌어당겨 튄다). */
  const ZOOM_TAP = ZOOM_STEPS[ZOOM_STEPS.length - 2];
  /** 가장 가까운 칸으로 — 손짓 중에도 이 값만 쓰므로 굽는 크기가 손짓 내내 안 흔들린다. */
  const snapZoom = (z9: number): number => ZOOM_STEPS.reduce(
    (best, v) => (Math.abs(v - z9) < Math.abs(best - z9) ? v : best), ZOOM_STEPS[0],
  );
  /** 사다리에서 지금 배율의 **바로 위/아래 칸** ────────────────────────────────────────
   *  (지적: "확대 버튼 누를 때 현재 배율이 3.8배면 4배가 돼야 하는데 8배로 감")
   *  여태는 `사다리.indexOf(가장 가까운 칸) + 1`이었다. 그 셈은 배율이 칸에 딱 걸려 있을
   *  때만 맞다 — 휠·핀치·한 손 줌은 3.8 같은 사잇값을 만드는데, 3.8의 가장 가까운 칸이
   *  4이므로 거기서 한 칸을 더 올려 **8로 두 칸을 뛰었다**(내릴 때는 반대로 2로 두 칸).
   *  '가장 가까운 칸'이 아니라 **지금 값보다 큰 첫 칸**(내림은 작은 마지막 칸)을 고른다.
   *  이미 칸에 걸려 있으면(4 → 8) 종전과 같다 — 엡실론이 제 칸을 제외한다. */
  const zoomNext = (z9: number, up9: boolean): number | null => {
    const EPS9 = 1e-3;
    if (up9) return ZOOM_STEPS.find((v9) => v9 > z9 + EPS9) ?? null;
    return [...ZOOM_STEPS].reverse().find((v9) => v9 < z9 - EPS9) ?? null;
  };
  /* 확대 길은 넷이다 — PC 휠 · 모바일 핀치 · 한 손 줌(탭-홀드-세로끌기) · **더블클릭**.
     ★ 더블클릭이 PC에도 돌아왔다(요청: "피시도 더블클릭으로 확대 축소 가능하게") —
       예전에 걷은 까닭은 인포 팝업과 손짓이 겹쳐서였는데("팝업을 두 번 확인하려다
       화면이 확대되고 팝업이 닫힌다"), 그 사이 첫 탭이 한 일을 둘째 탭이 **되돌리는**
       장치가 들어왔다(lastTapRef.act). 이제 두 번 누르면 첫 누름이 연 팝업이 닫히고
       확대만 남는다 — 겹침이 실제로 풀렸으므로 손가락 기기에만 두었던 빗장(coarse)을
       걷고 PC에서도 같은 손짓이 되게 한다. */
  const [zoom, setZoom] = useState(1);
  /* 피칭 보기(요청) — 수직 부감 대신 약간 비스듬한 정면. 바닥(지형 그림과 마커 자리)만
     세로로 눌리고, 건물·유닛 도형은 제 크기로 서 있어 3D로 바닥에 붙는다. 눌림은
     컨테이너 세로비가 맡아서 %자리가 저절로 따라온다. 휠 확대·드래그 이동은 기존
     렌즈(zoom·pan) 그대로다. */
  /* 각도는 이제 켜고 끄는 것이 아니라 칸이다(요청: 각도 5단계, 기본 90도=2D) —
     90도 칸이 예전의 '2D', 48도 칸이 예전의 '3D'다. pitched는 그 값에서 나온다. */
  const [pitchDeg, setPitchDeg] = useState<number>(PITCH_DEGS[0]);
  /** 키 판(v 토글)이 읽는 지금 기울기 — 키 판은 렌더마다 다시 안 걸리므로 ref로 본다. */
  const pitchDegRef9 = useRef(pitchDeg);
  pitchDegRef9.current = pitchDeg;
  const pitched = pitchDeg < 90;
  const pitchFlat = flatOf(pitchDeg);
  /* ★ **입체 보기에서는 안개를 안 쓴다**(요청: "3D 보기 진입시 안개가 걷힌다는 토스트 띄우고
     안개 미사용") ─────────────────────────────────────────────────────────────────────
     안개는 칸마다 '언제 처음 봤나'를 쌓아 판 셋을 굽고, 그 판을 땅에 얹어 그린다. 입체에서는
     그 땅이 기울어 있어 판을 사영해 다시 그려야 하고, 그것이 가장 비싼 층 위에 한 겹 더
     얹힌다. 입체가 무거운 기기에서 먼저 무너지던 자리가 여기다.
     그래서 입체에서는 안개를 통째로 끈다 — 걷힌 지도를 보여 주는 편이 끊기는 안개보다 낫다.
     사람에게는 **토스트로 한 번** 알린다(아래): 화면이 갑자기 밝아지는 것은 설명 없이 두면
     고장으로 읽힌다. */
  const fogOn = fogReady9 && !pitched;
  /** 이 진입에서 이미 알렸나 — 3D에 머무는 동안 각도 칸을 옮겨도 다시 안 띄운다. */
  const fog3dToldRef9 = useRef(false);
  useEffect(() => {
    if (!pitched) { fog3dToldRef9.current = false; return; }
    if (fog3dToldRef9.current || !fogReady9) return;
    fog3dToldRef9.current = true;
    /* 자리는 지도 한가운데 — 토스트는 body로 포털되므로 무대 상자를 여기서 재서 넘긴다. */
    const box9 = stageRef.current?.getBoundingClientRect();
    replayToast("입체 보기에서는 안개가 걷혀요", {
      kind: "info",
      ...(box9 && box9.width > 0
        ? { at: { x: box9.left + box9.width / 2, y: box9.top + box9.height / 2 } }
        : {}),
    });
  }, [pitched, fogReady9]);

  /** 땅을 눕히는 각(=90도 − 시점각) — CSS rotateX에 그대로 들어간다. */
  const pitchTiltDeg = 90 - pitchDeg;
  /* 컴포넌트 밖에서 그리는 둘에게 각을 내려 준다 — 캔버스 층(UnitLayer)의 그림자·링과
     모델 굽기(shapeOblique의 입체 판). 굽기 캐시 열쇠에도 이 값이 들어가야 각을 바꿨을
     때 옛 면이 재활용되지 않는다(아래 resolveShapeFaces 열쇠 참조).
     레이아웃 이펙트에 두는 이유는 그리기가 rAF라 그보다 먼저 서기 때문이다. */
  useLayoutEffect(() => {
    /* 모델 안쪽 바닥 눌림(0.7배)도 이 문이 같이 세운다 — 48도에서 0.743×0.7 = 0.52. 굽기 일꾼도 같은 문을 쓴다. */
    pitchFlatSet9(pitchFlat);
  }, [pitchFlat]);
  /** 정보 팝업으로 집어 둔 몸의 열쇠(요청) — null이면 닫힘. */
  const [picked, setPicked] = useState<string | null>(null);
  /** 인포 팝업이 열려 있으면 닫는다 — 화면 이동·배율 변경의 모든 문에서 부른다(beginGestureXf 주석). */
  const closePicked9 = useCallback((): void => {
    if (pickedRef.current !== null) setPicked(null);
  }, []);
  /* (걷어냄) mobBars — 좁은 화면의 배속·각도 바를 여닫던 상태다. 그 바가 지도 위
     값 버튼으로 바뀌면서 여닫을 것이 없어졌다(요청). */
  /** 이번 프레임에 그린 op — 클릭 판정과 팝업 내용이 여기서 지금 값을 읽는다. */
  const opsRef = useRef<UnitDrawOp[]>([]);
  /** 걷어낸 개체·건물의 미니맵 점(위 miniExtra ★) — 미니맵이 이것도 함께 찍는다. */
  const miniExtraRef = useRef<MiniDot[]>([]);
  /* (걷어냄·요청: "모델크기 토글 제거") — '표준/확대' 라디오와 그 배수(unitMul 3.1·
     bldMul 1.2)가 있던 자리다. 표준이 곧 원작 크기라(아래 크기표 주석) 확대는 원작
     비율을 일부러 어그러뜨리는 손잡이였고, 진형 간격·그림자·체력바는 안 따라 커져
     켤 때마다 몸만 부풀었다. 크기는 이제 크기표 하나가 정한다. */
  // (삭제·요청: 모바일에도 입체 보기 개방) — 터치 기기 판별이 있던 자리.
  const [panBase, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  /* ── 전체화면 재생(요청) ────────────────────────────────────────────────────
     "전체화면 버튼을 누르면 화면을 꽉 채우는 모드로 바뀌고, 지도 비율과 화면 비율이
     안 맞으니 **화면 비율에 맞게 최대 크롭한 부분**이 비춰지며 드래그로 나머지를 본다."
     크롭·드래그는 새 기계를 안 들인다 — 이미 있는 팬 한계식을 한 줄 일반화하면 그대로
     나온다(아래 panLimit): 지금 식은 `(배율−1)×지도폭/2`인데, 그것은 "창 = 지도 상자"일
     때의 특수형이다. 창을 따로 두면 `(지도폭×배율 − 창폭)/2`이고, 창이 지도와 같으면
     옛 식으로 되돌아온다. 전체화면에서는 지도를 화면보다 크게(cover) 깔아 두므로
     배율 1에서도 그 차이만큼 드래그 여유가 생긴다 — 그것이 곧 '크롭한 나머지 보기'다. */
  const [fsOn, setFsOn] = useState(false);
  /* 사용법 덮개(요청: 공통) — 열면 history에 한 칸 밀어 뒤로가기(폰의 제스처 포함)가 덮개를 닫게 한다. 닫기 버튼은 그
     칸을 되돌려(back) 같은 길로 닫는다. */
  const [guideOpen9, setGuideOpen9] = useState(false);
  /** ★ **오버레이 숨기기**(요청: "오른쪽 아래 사용법 버튼 대신 도구 숨기기 아이콘 버튼 추가:
   *  누르면 모든 오버레이가 숨겨지고 숨기기 아이콘 있던 자리에 오버레이 보이기 버튼이 존재,
   *  누르면 이전 오버레이 상태 그대로 복구" · 정정: "도구만 숨겨야 하는데 로스터 미니맵까지
   *  숨기면 안 돼") ─────────────────────────────────────────────────────────────────────
   *  '이전 상태 그대로'가 요점이라 **아무 상태도 안 건드린다** — 판에 클래스 한 겹을 얹어
   *  CSS가 걷을 뿐이다. 로스터 단수·미니맵·아이콘 줄·재생바의 상태는 손대지 않으므로,
   *  다시 켜면 저절로 있던 그대로다(끌 때 상태를 지웠다가 되살리는 길은 어딘가 한 칸을
   *  반드시 흘린다).
   *  단추 자신은 안 걷는다 — 꼬리 줄에 그대로 남아 아이콘만 눈(Eye)으로 바뀐다. 조종부의
   *  다른 줄들이 사라지면 격자의 그 줄들이 0으로 접혀, 단추는 제자리(오른쪽 아래)에 선다. */
  const [fsHide9, setFsHide9] = useState(false);
  const guidePushed9 = useRef(false);
  /* ★ 꼬리 줄의 두 버튼(스크랩·공유) — **하는 일만 앱이 붙이고** 나머지는 여기 몫이다(지적: "쓰는 쪽에서
     쓸지 말지 선택하는 거고 함수도 알아서 연결해야 해"). 누름·완료 표시·단축키가 그 나머지다.
     완료 표시 규약은 하나다 — 글(문자열)을 돌려주면 그 글이, 참을 돌려주면 기본 글이 1.8초 뜬다. 약속이면
     풀릴 때까지 기다린다: 앱이 제목 창을 띄우고 저장하거나 공유 시트를 여는 동안은 아직 끝난 것이 아니다. */
  const [tailDone9, setTailDone9] = useState<{ k: "scrap" | "share"; s: string } | null>(null);
  const tailTimer9 = useRef(0);
  const onScrapRef9 = useRef(onScrap);
  onScrapRef9.current = onScrap;
  const onShareRef9 = useRef(onShare);
  onShareRef9.current = onShare;
  const runTail9 = useCallback(async (k9: "scrap" | "share"): Promise<void> => {
    const f9 = k9 === "scrap" ? onScrapRef9.current : onShareRef9.current;
    if (!f9) return;
    let r9: string | boolean | void;
    try { r9 = await f9(); } catch { r9 = undefined; }
    if (r9 !== true && typeof r9 !== "string") return;
    setTailDone9({ k: k9, s: typeof r9 === "string" ? r9 : k9 === "scrap" ? "담았어요" : "링크 복사됨" });
    if (tailTimer9.current) window.clearTimeout(tailTimer9.current);
    tailTimer9.current = window.setTimeout(() => { tailTimer9.current = 0; setTailDone9(null); }, 1800);
  }, []);
  useEffect(() => () => { if (tailTimer9.current) window.clearTimeout(tailTimer9.current); }, []);
  /* 단축키 Z·X — 안내(ReplayGuide)가 적어 둔 그 둘이다. 버튼을 안 그리는 화면에서는 듣지 않는다(함수가
     없으면 그 키도 없다). 글 치는 칸·수식키에서는 안 듣고, 한글 자판에서도 듣도록 키 자리(e.code)로 본다.
     ★ 자격은 **홀로 있는가**다(지적: "목록 페이지는 카드마다 재생기가 서니까 Z 한 번에 N개가 같이 반응해 —
       예전엔 앱이 soleView로 가려 줬는데 그 가림막이 모듈 안으로 들어오면서 없어졌어") ────────────────────
       창(window)에 붙는 판이라 인스턴스마다 하나씩 붙는다. 활동 목록은 카드마다 재생기가 하나씩이라 그
       판이 N개가 되고, Z 한 번에 N개가 함께 답한다 — 버튼을 옮겨 오면서 앱이 지고 있던 가림막을 함께
       가져왔어야 했다. 자는 이미 있다: soleView(상세 모달이거나 이 경기를 가리키는 게임 페이지) — 아래
       주 키보드 판이 쓰는 그 자격과 같은 것이다. 전체화면(fsOn)도 홀로 있는 자리라 함께 연다.
       `wide`는 안 본다 — 주 키보드 판이 옛 대역으로 남겨 둔 값인데, 넓은 카드가 여럿인 목록에서는
       이 병을 그대로 되살린다(그 자리 주석의 그 사고다). */
  useEffect(() => {
    if (!onScrap && !onShare) return undefined;
    if (!soleView && !fsOn) return undefined;
    const onKey9 = (e: KeyboardEvent): void => {
      const k9 = e.code === "KeyZ" ? "scrap" : e.code === "KeyX" ? "share" : null;
      if (!k9 || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (k9 === "scrap" ? !onScrap : !onShare) return;
      const t9 = e.target as HTMLElement | null;
      if (t9 && (t9.tagName === "INPUT" || t9.tagName === "TEXTAREA" || t9.isContentEditable)) return;
      e.preventDefault();
      void runTail9(k9);
    };
    window.addEventListener("keydown", onKey9);
    return () => window.removeEventListener("keydown", onKey9);
  }, [onScrap, onShare, runTail9, soleView, fsOn]);
  const openGuide9 = (): void => {
    if (onGuide) { onGuide(); return; }
    try { window.history.pushState({ scrGuide: 1 }, ""); guidePushed9.current = true; } catch { guidePushed9.current = false; }
    setGuideOpen9(true);
  };
  const closeGuide9 = (): void => {
    if (guidePushed9.current) { guidePushed9.current = false; window.history.back(); } else setGuideOpen9(false);
  };
  useEffect(() => {
    if (!guideOpen9) return;
    const onPop = (): void => { guidePushed9.current = false; setGuideOpen9(false); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [guideOpen9]);
  const fsOnRef = useRef(false);
  fsOnRef.current = fsOn;
  /** 전체화면 무대(화면을 꽉 채우는 상자) — 지도를 이 크기에 맞춰 덮게 깐다. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  /* ★ 조종부의 **실제 높이**를 재서 위에 앉는 것들에게 알려 준다(지적: 모바일 전체화면
     에서 아이콘 줄이 재생바를 덮는다) ────────────────────────────────────────────────
     여태 그 높이는 CSS가 `32px + 여백 + 안전영역`으로 **조립한 값**이었다. 그 32는 조종부가
     한 줄이던 시절의 안쪽 줄 높이인데, 좁은 화면에서는 조종부가 **두 줄**이다(요청으로
     진행바를 윗줄로 올렸다: 그래야 끌 폭이 화면 전체가 된다). 곧 실제 높이가 조립값보다
     한 줄만큼 크고, 그 차이가 그대로 겹침이 됐다 — 아이콘 줄이 진행바 위에 앉았다.
     조각을 하나 더 더하는 길(‘두 줄이면 22px 더’)은 또 다른 못 박은 수라 언젠가 다시
     어긋난다. 재는 편이 낫다: 조종부가 몇 줄이 되든, 글자가 커지든, 안전영역이 바뀌든
     실제 값이 곧장 따라온다.
     값은 `--scr-fsbot-m`으로 판에 얹고, CSS의 `--scr-fsbot`은 그것이 있으면 그것을 쓰고
     없으면 옛 조립값으로 물러난다(프레임 모드는 제 규칙이 0으로 덮으므로 안 걸린다). */
  /* ★ **붙는 자리(callback ref)로 단다** — effect + useRef로는 안 걸렸다(실측:
     `--scr-fsbot-m`이 끝내 "(없음)"이었다). 까닭은 차례다: 이 판은 자취를 받기 전에는
     조종부를 안 그리므로, 마운트 때 도는 effect의 눈에는 ref가 비어 있다. deps가 []라
     한 번 비면 다시 볼 일이 없다 — 조용히 아무 일도 안 하는 코드가 된다.
     붙는 자리로 두면 그 줄이 **실제로 생기는 순간** 불린다. 사라질 때도 같은 문으로
     불려(el === null) 관찰자를 걷는다. */
  const fsBotObsRef = useRef<ResizeObserver | null>(null);
  const fsBotRef = useCallback((el: HTMLDivElement | null) => {
    fsBotObsRef.current?.disconnect();
    fsBotObsRef.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const lyr = el.closest(".scr-fs-layer") as HTMLElement | null;
    if (!lyr) return;
    const read = (): void => {
      /* ★ **도구를 숨긴 동안은 안 잰다**(지적: "모바일 전체화면에서 도구 숨기면 미니맵이 작아짐") ──
         전체화면 미니맵의 키는 이 실측(--scr-fsbot-m)에서 파생된다(--scr-mini-h). 도구 숨기기
         (is-uihide)는 조종부의 줄들을 display:none으로 걷어 이 상자가 한 줄로 줄고, 관찰자가 그
         줄어든 키를 그대로 올려 미니맵까지 따라 줄었다. 숨긴 것은 도구지 미니맵이 아니다 —
         숨긴 동안은 마지막 실측을 그대로 두고, 다시 보이면 관찰자가 제 값을 도로 잰다. */
      if (lyr.classList.contains("is-uihide")) return;
      const h9 = Math.round(el.getBoundingClientRect().height);
      if (h9 > 0) lyr.style.setProperty("--scr-fsbot-m", `${h9}px`);
      /* ★ 미니맵 키를 오른쪽 조작부에 맞춘다(요청: "미니맵 높이하고 오른쪽 조작부 높이가 맞아야지") — 프레임 모드의 독은
         [미니맵 | 지도 버튼 줄 / 재생부] 격자인데, 미니맵 높이를 손값(--scr-dock-mini)으로 박아 두면 오른쪽 세 줄과 위아래가
         어긋난다. 여기서 실측한다: 지도 버튼의 윗변에서 꼬리 줄의 아랫변까지가 미니맵의 키고, 그 윗변·아랫변이 제 줄의
         가장자리에서 떨어진 만큼이 미니맵의 위·아래 여백이다. 오른쪽이 미니맵보다 낮아 줄이 늘어나 있는 상태에서 재면 한
         번에 안 맞을 수 있으나, 미니맵이 줄면 줄도 줄어 관찰자가 다시 부르고 몇 번 안에 맞물린다(1px 안이면 안 건드린다). */
      if (!lyr.classList.contains("is-fs")) {
        const btns9 = lyr.querySelector(".scr-motion-mapbtns") as HTMLElement | null;
        const btn9 = btns9?.querySelector("button") as HTMLElement | null;
        const tail9 = el.querySelector(".scr-fs-bottom-tail") as HTMLElement | null;
        if (btns9 && btn9 && tail9) {
          const rB9 = btns9.getBoundingClientRect();
          const rb9 = btn9.getBoundingClientRect();
          const rT9 = tail9.getBoundingClientRect();
          const rE9 = el.getBoundingClientRect();
          /* 미니맵 상자의 테두리(위·아래 1px)는 키에서 뺀다 — 안 빼면 판이 그만큼 커져 줄을 밀고 미니맵 윗변이 버튼보다
             2px 올라간다(content-box). */
          const mm9 = lyr.querySelector(".scr-fs-minipanel .scr-fs-minimap") as HTMLElement | null;
          const bd9 = mm9 && getComputedStyle(mm9).boxSizing !== "border-box"
            ? (parseFloat(getComputedStyle(mm9).borderTopWidth) || 0) + (parseFloat(getComputedStyle(mm9).borderBottomWidth) || 0) : 0;
          const mini9 = Math.round(rT9.bottom - rb9.top - bd9);
          /* 여백은 **격자 칸의 가장자리**에서 잰다(지적: 미니맵이 조작부보다 올라가 보임) — 버튼 줄·재생부의 바깥
             margin은 칸 안에 있으므로, 요소의 변이 아니라 변에 margin을 더한 자리가 칸의 변이다. 미니맵 판도 칸에 붙어
             선다(align-self: stretch) — 그래야 이 여백이 곧 미니맵의 자리다. */
          const mtB9 = parseFloat(getComputedStyle(btns9).marginTop) || 0;
          const mbE9 = parseFloat(getComputedStyle(el).marginBottom) || 0;
          const cur9 = parseFloat(lyr.style.getPropertyValue("--scr-dock-mini")) || 0;
          if (mini9 > 40 && Math.abs(mini9 - cur9) >= 1) {
            lyr.style.setProperty("--scr-dock-mini", `${mini9}px`);
            lyr.style.setProperty("--scr-dock-mini-mt", `${Math.max(0, Math.round(rb9.top - (rB9.top - mtB9)))}px`);
            lyr.style.setProperty("--scr-dock-mini-mb", `${Math.max(0, Math.round(rE9.bottom + mbE9 - rT9.bottom))}px`);
          }
        }
      }
    };
    const ro = new ResizeObserver(read);
    ro.observe(el);
    /* 지도 버튼 줄도 함께 본다(지적: 미니맵이 조작부보다 올라가 보임) — 미니맵이 넓어지면 버튼 줄이 좁아져 동그라미가
       줄어드는데(aspect-ratio), 그건 재생부의 크기를 안 바꿔 관찰자가 안 울렸고, 그 사이 4px이 미니맵에 남았다. */
    const btnsObs9 = lyr.querySelector(".scr-motion-mapbtns");
    if (btnsObs9) ro.observe(btnsObs9);
    fsBotObsRef.current = ro;
    read();
  }, []);
  /** 판 뿌리(.scr-fs-root) — 휠은 지도 상자가 아니라 **판 전체**가 받는다(아래 onWheel). */
  const fsRootRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  /** 무대 높이 붙들기(지적: "팬·핀치 뒤 안개·모델이 떨린다") — 무대는 100dvh라 폰의 주소창이 접히고 펴질 때마다 몇 프레임에
   *  걸쳐 높이가 바뀐다. 그 값이 상태(stage)에 실리면 재중심(centerOnTile)·팬 재죔·덮는 폭·캔버스 크기가 줄줄이 돌아 판이
   *  들썩였다. 굵은 포인터 기기에서 폭이 같고 높이 변화가 35% 미만이면 붙든 높이를 쓴다. 회전·전체화면 전환·fsOn 토글은
   *  진짜 변화라 다시 잰다(frameMaxH의 vhHold9와 같은 규칙). */
  const stageHold9 = useRef<{ w: number; h: number } | null>(null);
  /** `#diag=view` — 보기 상태(팬·배율·무대·예산·창 높이)가 최근 3초에 몇 번, 어느 길로 바뀌었나(지적: "팬·핀치·감기 뒤
   *  안개·모델이 떨린다" — 에뮬레이터로는 재현이 안 돼, 폰에서 어느 상태가 흔들리는지 이 줄로 읽는다). 렌더마다 값을 견줘
   *  바뀐 것만 적고, 재죔(clamp)·재중심(center)·손짓 커밋(commit)·무대 붙들기(stagehold)는 그 자리에서 적는다. */
  const viewDiag9 = useRef<{ ev: { t: number; k: string; v: string }[]; last: Record<string, string> }>({ ev: [], last: {} });
  const viewDiagPush9 = (k: string, v: string): void => {
    const d9 = viewDiag9.current;
    d9.ev.push({ t: performance.now(), k, v });
    if (d9.ev.length > 200) d9.ev.splice(0, d9.ev.length - 200);
  };
  /** 무대 크기를 ref로도 들고 있는다 — 팬 한계를 재는 곳 중에는 **한 번만 걸리는
   *  effect 안**(휠 줌)이 있어서, 상태를 읽으면 그 effect가 만들어질 때의 옛 값(0)에
   *  붙들린다. 그러면 전체화면에서 휠로 축소할 때 한계가 평소 배치의 식으로 셈해져,
   *  잡아 줘야 할 자리를 안 잡고 지도 끝이 안으로 들어왔다(지적). */
  const stageSizeRef = useRef({ w: 0, h: 0 });
  /** 지금 유효한 창(보이는 구멍)의 크기 — 평소엔 지도 상자, 전체화면에선 무대다. */
  /* (걷어냄) viewBox — '지금 유효한 창'을 무대와 지도 상자 중 작은 쪽으로 내던 자다.
     팬 한계가 자를 하나로 모으면서(아래 panLimit) 그 셈이 그 안으로 들어갔다. 창의
     세로는 무대가 아니라 **지도 상자**(viewHRef)이고, 3D에서는 회전 전 자로 되돌린다. */
  /** 팬 한계 — 내용(지도 × 배율)이 창보다 큰 만큼만 움직인다.
   *  ★ **한 번만 만든다**(useCallback []) — 읽는 값이 전부 ref라 그래도 늘 최신이다.
   *    여태 렌더마다 새로 나는 보통 함수였는데, 화면 밀기(엣지 스크롤) effect가 이걸
   *    의존 목록에 담고 있어서 **렌더 한 번마다 그 effect가 통째로 다시 걸렸다**.
   *    그 바람에 두 가지가 깨졌다(지적):
   *      · 조작부가 안 닫힌다 — effect가 다시 걸릴 때마다 fsWake()가 불려, 지도를
   *        눌러 끈 오버레이가 그 즉시 도로 켜졌다.
   *      · 화면 밀기가 뚝뚝 끊긴다 — 매 재시작마다 rAF가 갈리고 dt가 0으로 되감기며,
   *        밀던 손짓(beginGestureXf)이 끊겼다 다시 열렸다. */
  /** 지도가 깔리는 **회전 전** 크기(fsCoverW·fsCoverH) — 팬 한계의 유일한 자다. */
  const coverRef = useRef({ w: 0, h: 0 });
  /** 화면에 실제로 보이는 세로(px) — 지도 상자다(무대에서 그림 여유를 뺀 값). */
  const viewHRef = useRef(0);
  /** 3D 눌림(2D는 1) — 눕히면 세로가 이만큼으로 줄어 보인다. */
  const pitchKRef = useRef(1);
  /** ★ 지도 **윗변 위로 더 끌 수 있는 몫**(px, 배율 1 기준) ─────────────────────────
   *  (지적: "맵 맨 위쪽을 보여 줄 때 모델의 윗부분이 그림 영역을 벗어나 잘려 버린다")
   *
   *  모델은 제 발밑 칸에서 **위로** 솟으므로, 지도 맨 윗줄에 선 것은 그림의 위쪽이 지도
   *  밖이다. 여태는 팬 한계가 위아래 대칭이라 지도 윗변이 창 윗변에 딱 붙는 데서 멈췄고,
   *  그 위는 창 밖이라 솟은 몫이 영영 안 보였다.
   *  ★ 자리를 **배치에서 떼지 않는다** — 무대·프레임·예산·지도 크기는 한 톨도 안 건드린다.
   *    앞서 걷어낸 두 꼴(무대 안 띠 · 판 위 여백)이 그 길이었고, 배치가 배율을 타면서
   *    손짓이 흔들렸다. 여기서 바뀌는 것은 **한계값 하나**뿐이라 되먹임이 없다.
   *  ★ 그릴 자리는 이미 있다 — 유닛 캔버스는 렌즈 밖에 서서 무대만 한 몸을 갖고, 지도는
   *    그 안에서 **그리기 좌표로** 움직인다(UnitLayer의 zy). 그러니 위로 더 끌면 지도
   *    윗변이 캔버스 안쪽으로 내려오고, 솟은 몫은 그 위 빈자리에 그대로 그려진다.
   *    캔버스를 늘릴 일도(--scr-mapband), 지형·안개를 손댈 일도 없다.
   *  ★ **배율을 탄다**(지시: "줌에 따라 모델 키가 달라짐에 유의") — 모델의 화면 키는
   *    `상자 × 배율`이라(UnitLayer의 `px = op.sizePx * zoom`), 여유도 같은 배로 커져야
   *    한다. 그래서 이 값은 배율 1 기준이고 아래에서 z를 곱한다.
   *  ★ 입체(3D)도 같다(지시) — 눕는 것은 땅이지 몸이 아니라, 맨 윗줄에 선 것은 거기서도
   *    화면에 곧게 솟는다. 다만 먼 줄이 눌린 만큼 작게 그려지므로 여유도 그 몫이다
   *    (아래 bandRef가 pitchK(0)을 곱한다).
   *  자는 **칸**이다: 가장 큰 것(4×4 건물)이 제 발자리에서 네 칸만큼 솟는다. */
  const BAND_TILES = 4;
  const bandRef = useRef(0);
  /* 창 크기(winW·winH)도 함께 내놓는다 — 추적 카메라가 "지금 그 점이 가장자리에
     닿았나"를 재는 데 쓴다. 한계와 같은 자를 써야 판정과 이동이 안 어긋난다. */
  const panLimit = useCallback((z: number): {
    x: number; y: number; yTop: number; winW: number; winH: number;
  } => {
    const cov = coverRef.current;
    if (cov.w <= 0 || cov.h <= 0) return { x: 0, y: 0, yTop: 0, winW: 0, winH: 0 };
    const st = stageSizeRef.current;
    const k9 = pitchKRef.current;
    /** 가로로 보이는 몫 — 무대 폭(지도가 그보다 좁으면 지도 폭). */
    const winW = st.w > 0 ? Math.min(st.w, cov.w) : cov.w;
    /* ★ 세로로 **화면에 실제로 서는 몫**으로 잰다(지적: "3D에서 줌인 상태로 드래그
       가능한 범위가 너무 넓어. 이미 지도는 끝났는데도 드래그는 계속 가능해") ────────────
       눕힌 지도가 화면에서 차지하는 세로는 상자 세로의 k배다(k = pitchSpan, 45도에서
       0.61). 그런데 여태 상자 세로를 **그대로** 내용 크기로 삼아 한계를 냈다 — 곧 실제
       그림보다 1.6배 큰 것을 옮기는 셈이라, 지도 끝이 지나간 뒤에도 그만큼 더 끌렸다.
       팬·배율은 눕히기 **바깥**에서 먹으므로(렌즈 변환: translate(pan) scale(z) …
       perspective rotateX) 여기 곱할 자는 그 k 하나다. 창의 세로도 무대가 아니라
       **지도 상자**다(그 둘은 그림 여유만큼 다르다).
       가로는 눕혀도 안 줄어든다 — 가까운 변이 상자 폭을 그대로 쓴다(사다리꼴의 밑변). */
    const winH = viewHRef.current > 0 ? viewHRef.current : (st.h > 0 ? st.h : cov.h * k9);
    const y9 = Math.max(0, (cov.h * k9 * z - winH) / 2);
    /* 위쪽만 더 연다 — 아래·좌우는 그대로다(솟는 방향이 위 하나라 아래는 열 까닭이 없다).
       창의 절반을 넘지는 않는다: 그보다 열면 지도가 아니라 하늘을 보는 창이 된다. */
    const band9 = Math.min(bandRef.current * z, winH * 0.45);
    return {
      x: Math.max(0, (cov.w * z - winW) / 2),
      y: y9,
      yTop: y9 + Math.max(0, band9),
      winW,
      winH,
    };
  }, []);
  /* ★ 추적을 켤 때 맞출 배율 — **화면 가로에 드는 타일 수**로 정한다(요청: "6배 고정이
     아닌 폭에 비례해서 실제 게임에서 화면에 들어가는 가로 타일수 1.2배 정도로") ──────────
     6배는 어느 상자에서 잰 값도 아닌 사다리의 한 칸(ZOOM_TAP)이었다. 그래서 폰 세로에서는
     너무 좁고 넓은 전체화면에서는 헐렁했다 — 같은 배율이라도 보이는 타일 수가 상자 모양에
     따라 갑절 넘게 갈리기 때문이다.
     자를 뒤집는다: 보일 타일 수를 못 박고 배율을 그 결과로 낸다.
       타일당 px = cov.w × z ÷ 격자폭 · 보이는 타일 = winW ÷ 타일당 px
       ⇒ z = winW × 격자폭 ÷ (cov.w × 보일 타일 수)
     실제 게임 화면은 640px 폭에 타일 32px이라 가로 **20타일**이고, 그 1.2배가 24타일이다.
     (winW는 배율과 무관한 값이라 panLimit(1)에서 꺼내 쓴다.) */
  const TRACK_TILES9 = 24;
  const trackZoom9 = (): number => {
    const cov9 = coverRef.current;
    const win9 = panLimit(1).winW;
    if (!(cov9.w > 0) || !(win9 > 0) || !(grid.width > 0)) return ZOOM_TAP;
    return Math.min(ZOOM_MAX, Math.max(1, (win9 * grid.width) / (cov9.w * TRACK_TILES9)));
  };
  /** 지도가 무대를 채우는 폭 — 비율은 지킨다.
   *
   *  ★ **전체화면만 덮고(cover), 프레임에서는 높이에 맞춘다**(요청: "모바일 게임상세
   *    진입시 스테이지 높이를 확정한 후에는 맵의 너비를 높이에 맞춰 조절해야해 좌우
   *    필러박스 여백이 생기겠지 상하 필러박스가 생기는 경우는 절대 없음") ──────────────
   *    여태는 두 자리 다 덮었다(짧은 쪽을 무대에 맞춰 긴 쪽이 넘치게). 무대의 세로가
   *    지도 비대로 잡히는 동안은 그게 곧 '높이 맞춤'이라 차이가 없었는데, 무대에는
   *    **천장**이 있다(maxHeight = 프레임 예산 − 줄 몫). 폰처럼 예산이 빠듯하면 그
   *    천장이 물어 무대가 지도 비보다 **납작해지고**, 그때 덮기는 방향이 뒤집힌다:
   *    폭을 무대에 맞추고 세로가 넘쳐 **위아래가 잘린다**.
   *    지도는 위아래가 잘리면 안 된다 — 본진 둘이 대개 위·아래 구석이라, 잘리는 순간
   *    경기의 양 끝이 사라진다(좌우는 가운데 지형이라 덜 아프다).
   *    그래서 프레임에서는 늘 **세로를 꽉 채우고 폭이 따라온다**: 무대가 지도보다
   *    길쭉하면 좌우가 잘리고, 납작하면 좌우에 여백(필러박스)이 남는다. 위아래는 어느
   *    쪽이든 한 톨도 안 남고 안 잘린다.
   *    전체화면은 그대로 덮는다 — 그쪽은 '화면비에 맞게 최대 크롭하고 나머지는 드래그'가
   *    요청이었고(그 자리 주석), 가로로 누운 화면에서 높이만 맞추면 좌우가 통째로 빈다. */
  /** ★ 지도 **위**에 두는 그림 여유(px) — 지도 영역은 아니고, 키 큰 모델이 삐져나와
   *  그려지는 자리다(요청: "2d에서 맵 위쪽에 높이 있는 모델들 위가 잘리자나 … 맵영역은
   *  아닌데 그림은 그려지는 영역을 추가해야할거같아").
   *
   *  모델은 제 발밑 칸에서 위로 솟으므로, 지도 맨 윗줄의 건물은 그림의 위쪽이 상자
   *  밖이다. 무대 세로의 7%(최대 64px)를 지도에서 떼어 그 자리로 둔다 — 그만큼 지도가
   *  짧아지지만, 지도 윗줄이 화면 맨 위에 딱 붙는 것보다 **거기 선 것이 온전히 보이는**
   *  편이 낫다.
   *  ★ 입체(3D)에서는 안 둔다 — 그쪽은 사영이 이미 위쪽을 눕혀 솟은 몫이 안으로 접힌다.
   *    지적도 2D를 짚었다. */
  // (아래로 옮김) 지도 크기·그림 여유 — 세로 예산(stageBudget9)이 먼저 서야 한다.
  /* ★ 프레임은 **화면을 넘지 않는다**(요청: "피시 상세 일반모드에서 가능한 영역을
     벗어나서 좀 안 좋아. 누구도 스크롤하면서 리플레이를 보려고 하진 않을 거야 —
     보여지는 화면에만 꽉 차게. 모바일도 마찬가지") ────────────────────────────────
     여태 크기는 **폭**이 정했다: 넓은 배치는 min(1024px, 100%)이고 높이는 지도 비가
     따라왔다. 정사각 지도면 1024×1024라, 세로 900px 창에서는 아래가 잘려 재생바를
     보려면 스크롤을 해야 했다.
     이제 **높이 예산을 먼저 잡고 폭을 거기 맞춘다**: 예산 = 창 높이 − 프레임 위에
     있는 것(머리·제목 줄) − 아래 여백. 폭은 `예산 × 지도비`와 옛 상한 중 작은 쪽이라,
     어느 화면에서도 판 전체가 한눈에 든다.
     ※ 위 여백은 **문서 기준**으로 잰다(스크롤과 무관) — 화면 기준이면 스크롤할 때마다
       예산이 흔들려 판이 들썩인다. 목록처럼 프레임이 문서 한참 아래에 있는 자리에서는
       그 값이 커지므로 상한(200px)을 둔다. */
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameMaxH, setFrameMaxH] = useState(0);
  /** 폰의 창 높이 붙들기(지적: "드래그·팬 뒤에 안개·모델이 위아래·좌우로 떨린다") — 아래 read가 쓰는 innerHeight는
   *  모바일에서 **주소창이 접히고 펴질 때마다** 바뀐다(스크롤 한 번에 수십 px, 그것도 몇 프레임에 걸쳐). 그때마다 예산이
   *  바뀌면 무대 높이 → 폭(높이가 폭을 정한다) → 캔버스 크기·타일 px이 줄줄이 바뀌어 판 전체가 들썩였다. 폭이 그대로이고
   *  높이 변화가 35% 미만이면 주소창(또는 그 비슷한 브라우저 UI)으로 보고 **처음 잰 높이를 그대로 쓴다**. 폭이 바뀌면(회전)
   *  다시 잰다. 자판(40~50%)은 넘겨 진짜 변화로 친다. */
  const vhHold9 = useRef<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el || typeof window === "undefined") return undefined;
    const read = (): void => {
      const r = el.getBoundingClientRect();
      const above = Math.min(200, Math.max(0, r.top + window.scrollY));
      /* ★ 아래 몫은 **재서 뺀다**(지적, iOS 사파리: "너무 높이가 짧게 나옴 맵이 —
         여기는 탭바/FAB 없는 페이지라 안전영역 확인 다시 해야 해") ────────────────────
         여태 붙박이 88이었다. 그 수는 '아래 탭바 + 안전영역 + 여백'을 뭉뚱그린 어림인데,
         두 가지가 어긋났다:
           ① 이 화면에는 **탭바도 FAB도 없다** — 그런 페이지에서는 76px을 공짜로 버렸다.
           ② 조작 줄이 지도 밖으로 나오면서 그 몫은 이미 따로 빠진다(무대의 max-height가
              rowsH를 뺀다) — 88 안에 그 몫이 또 들어 있으면 **두 번 빼는 셈**이다.
         그래서 실제로 아래를 먹는 것 하나(모바일 탭바)만 재고, 없으면 숨 쉴 자리 12만
         둔다. 안전영역은 여기서 안 뺀다 — 이 판은 화면에 붙박인 것이 아니라 문서 흐름에
         서므로 홈 인디케이터가 판을 먹지 않는다(그 몫은 탭바가 제 여백으로 이미 진다). */
      /* ★ 탭바는 **안 뺀다**(지적: "모바일에서 세로 가용폭을 너무 좁게 잡고 있어. 댓글부를
         보여 줄 공간이 있는데도 스테이지의 세로를 줄이고 있다구" · 앞서 못 박은 규칙의
         3번: "댓글부나 탭바는 고려하지 않아") ─────────────────────────────────────────
         탭바는 화면에 **떠 있는 섬**이지 판이 피해야 할 벽이 아니다. 이 페이지는 문서가
         스크롤되므로, 판이 탭바 아래까지 내려가도 손가락으로 조금 밀면 그만이고 그 아래
         댓글부가 이어진다. 그런데 그 높이(약 81px)를 예산에서 빼면 지도가 그만큼 작아진
         채로 **못 박힌다** — 되찾을 길이 없다.
         남는 것은 숨 쉴 자리 하나(12)뿐이다. */
      const below9 = 12;
      let ih9 = window.innerHeight;
      if (window.matchMedia?.("(pointer: coarse)").matches) {
        const m9 = vhHold9.current;
        if (m9 && m9.w === window.innerWidth && Math.abs(ih9 - m9.h) < m9.h * 0.35) ih9 = m9.h;
        else vhHold9.current = { w: window.innerWidth, h: ih9 };
      }
      const want = Math.round(Math.min(1400, Math.max(300, ih9 - above - below9)));
      // 2px 안쪽 흔들림은 무시한다 — 아래 관찰자와 서로 되먹임하지 않게.
      setFrameMaxH((v) => (Math.abs(v - want) > 2 ? want : v));
      /* ★ 판이 실제로 앉은 자리를 **바깥에 알린다**(지적: "상세에서 타이틀 로우가 중앙정렬이
         안 맞는 것 같으니 확인" → "타이틀 중앙정렬은 이 문제 같아: padding-right 244px")
         ────────────────────────────────────────────────────────────────────────────
         타이틀 줄은 재생기 **밖의 형제**라 판이 어디에 얼마나 넓게 앉았는지를 모른다.
         여태는 그것을 **가정**으로 메웠다: "오른쪽에 댓글 기둥 232 + 사이 12가 있으니
         244를 물러서면 줄의 가운데가 지도의 가운데다." 그 가정은 판이 제 칸을 꽉 채울
         때만 참이다 — 이제 판은 제 폭(높이 예산이 정한다)으로 **칸 안에서 가운데** 서고,
         댓글 기둥이 없는 자리도 있다. 그러면 가정과 실제가 갈리고 그 차의 절반만큼
         제목이 밀린다.
         가정을 걷고 **잰 값**을 넘긴다: 판의 왼끝과 폭을 조상(.scr-story-map)에 CSS 값
         으로 적어 두면, 제목 줄이 그 두 값으로 제 상자를 판에 정확히 겹친다. 배율·예산·
         댓글 유무가 어떻게 바뀌어도 저절로 따라온다(이 함수는 창·문서가 바뀔 때마다 돈다). */
      const host9 = el.closest(".scr-story-map") as HTMLElement | null;
      /* 제목이 겹쳐야 할 것은 **지도**다 — 판은 이제 제 칸을 꽉 채우므로(frameStyle의
         폭 상한 주석) 그 폭을 넘기면 제목이 지도가 아니라 조종부 폭에 맞는다. */
      const lay9 = (el.querySelector(".scr-fs-stage")
        ?? el.querySelector(".scr-fs-layer")) as HTMLElement | null;
      if (host9 && lay9) {
        const hr9 = host9.getBoundingClientRect();
        const lr9 = lay9.getBoundingClientRect();
        if (lr9.width > 0) {
          host9.style.setProperty("--scr-frame-l", `${Math.round(lr9.left - hr9.left)}px`);
          host9.style.setProperty("--scr-frame-w", `${Math.round(lr9.width)}px`);
        }
      }
      /* ★ 로스터도 **지도에 붙어 있어야 한다** — 판이 제 칸을 꽉 채우게 되면서(폭 상한을
         무대로 옮긴 그 손질) 판의 왼끝이 곧 페이지의 왼끝이 됐다. 로스터는 판 기준의
         절대 배치라 그대로 페이지 구석으로 끌려가, 지도에서 한참 떨어져 떴다.
         무대가 제 칸 안에서 가운데 서므로 그 어긋남은 프레임마다 달라진다 — 재서 알린다. */
      const lyr9 = el.querySelector(".scr-fs-layer") as HTMLElement | null;
      const stg9 = el.querySelector(".scr-fs-stage") as HTMLElement | null;
      if (lyr9 && stg9) {
        const a9 = lyr9.getBoundingClientRect();
        const b9 = stg9.getBoundingClientRect();
        lyr9.style.setProperty("--scr-stage-l", `${Math.max(0, Math.round(b9.left - a9.left))}px`);
        lyr9.style.setProperty("--scr-stage-r", `${Math.max(0, Math.round(a9.right - b9.right))}px`);
      }
    };
    read();
    /* ★ **위에 있는 것이 자리를 잡은 뒤에 다시 잰다**(지적: "아래 여백이 너무 높아져
       있어 · 개발자도구를 켜면 또 좁아져 신기해") ────────────────────────────────
       그 '신기함'이 곧 진단이다: 개발자 도구를 열면 창이 줄어 resize가 오고, 그때
       비로소 제대로 잰다 — 곧 **첫 측정이 틀렸고 창이 바뀔 때만 고쳐졌다**는 뜻이다.
       예산은 '프레임 위에 있는 것들의 높이'를 빼서 내는데, 마운트 순간에는 그 위가
       아직 안 자리 잡았다(머리·제목 줄의 글꼴·아바타가 늦게 온다). 그 순간 위가 0에
       가까우면 예산이 창 높이만큼 커지고, 판이 화면 밖까지 자란다.
       그래서 창 크기만이 아니라 **문서가 바뀔 때마다** 다시 잰다: body를 지켜보면
       위쪽 요소가 늦게 커지는 그 순간에 바로 걸린다. 되먹임은 없다 — 예산은 프레임
       **위**의 높이만 보고, 그 높이는 프레임 제 높이와 무관하다. */
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    ro?.observe(document.body);
    /* 무대도 지켜본다 — 위에서 재는 값 가운데 **무대의 왼끝**(--scr-stage-l)은 body가
       그대로여도 바뀐다(판은 제 칸을 꽉 채우고 무대만 상한을 지므로, 창 폭이나 예산이
       달라지면 가운데 선 무대가 옆으로 움직인다). body만 보고 있으면 첫 측정값 0에
       붙박여, 로스터가 지도가 아니라 페이지 구석에 남는다.
       되먹임은 없다 — 이 함수가 무대에 되돌려 주는 것은 예산(frameMaxH)뿐이고 그 값은
       2px 안쪽 흔들림을 무시한다(위 setFrameMaxH). */
    if (stageRef.current) ro?.observe(stageRef.current);
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    window.addEventListener("load", read);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
      window.removeEventListener("load", read);
    };
  }, []);
  /** ★ 좁은 프레임에서는 **조작 줄이 지도 밖으로 흐른다**(요청: "모바일은 버튼 로우와
   *  재생 로우를 맵 밖으로 빼야 할 거 같은데") — 같은 컴포넌트를 그대로 쓴다(CSS만 갈린다).
   *  여기서 할 일은 **가로세로비를 어디에 거는가**뿐이다: 줄이 아래로 흐르면 판의 높이는
   *  '지도 + 두 줄'이라 판에 비를 걸면 지도가 눌린다. 비는 **무대**(지도)가 지고, 판은
   *  그만큼 자라게 둔다. 넓은 배치·전체화면은 종전대로 판이 비를 진다. */
  /* ★ 가르는 것은 **전체화면인가**뿐이다(요청: "PC도 모바일처럼 버튼하고 재생바부는
     맵 밖 아래로 내려줘") — 한동안 좁은 화면에만 걸었는데, 밖으로 내는 까닭(줄이 지도의
     아래 5분의 1을 늘 덮는다)은 폭과 무관했고 배치만 둘로 갈렸다. 전체화면은 지도가 곧
     화면이라 '밖'이라는 자리가 없으니 거기서만 안에 얹는다. */
  const rowsOutside = !fsOn;
  /** ★ 지도 밖으로 흐른 줄들이 차지하는 높이(px) — 무대가 양보할 몫이다 ────────────
   *  (지적, iOS 사파리: "버튼·재생바 부분이 잘려서 아래쪽 75% 정도는 안 보임")
   *  프레임에는 높이 예산(frameMaxH)이 max-height로 걸려 있고 넘치는 것은 잘린다.
   *  줄이 지도 **안**에 떠 있던 시절에는 그 예산이 곧 지도의 몫이라 아무 문제가 없었다.
   *  줄을 밖으로 내면서 판의 높이가 '지도 + 줄들'이 됐는데, 무대는 여전히 제 비만 보고
   *  (폭 100% → 정사각 맵이면 높이도 폭만큼) 예산을 한 톨도 안 본다. 그래서 예산이
   *  빠듯한 화면에서는 **무대가 예산을 다 먹고 줄들이 잘려 나간다**.
   *  왜 아이폰에서만 났나 — 예산은 `innerHeight − 위에 있는 것 − 88`이다. 폰은
   *  innerHeight가 작고(주소창·탭바) 위 제목 줄까지 있어 예산이 400px 언저리인데,
   *  390px 폭 화면의 정사각 지도는 그것만으로 이미 390px이다. 남는 10px에 줄 셋이
   *  들어가려니 대부분이 잘렸다. PC·계측 하네스는 예산이 700px 넘어 안 드러났다.
   *  고침 — 줄들의 실제 높이를 재서 무대의 max-height로 돌려준다. 무대는 폭을 그대로
   *  쓰고 **세로만 잘린다**(지도는 cover로 깔리므로 잘린 만큼은 끌어서 본다 — 이 판이
   *  좁은 화면에서 늘 쓰던 규칙 그대로다). 흐름에 선 형제만 센다: 전체화면에서는
   *  그것들이 겹쳐 뜨므로(position: absolute) 저절로 0이 되어 예전 셈이 그대로 남는다. */
  const [rowsH, setRowsH] = useState(0);
  useLayoutEffect(() => {
    const root9 = fsRootRef.current;
    const st9 = stageRef.current;
    if (!root9 || !st9 || typeof window === "undefined") return undefined;
    const read9 = (): void => {
      /* ★ 독의 높이는 **뿌리에서 무대를 뺀 값**이다(수리: "아직도 아래 공간 엄청 남아")
         ────────────────────────────────────────────────────────────────────────────
         앞판은 흐름에 선 형제들의 높이를 **모두 더했다**. 세로로 쌓여 있을 때는 그것이
         곧 독의 높이였는데, 독을 격자로 바꾸면서(미니맵이 왼쪽 칸을 세로로 다 쓰고
         오른쪽 칸을 버튼·재생바가 나눠 쓴다) 셋이 **겹쳐 선다**. 그런데도 계속 더하고
         있었으니 독이 실제(94)의 두 배(187)로 잡혔고, 그만큼 무대가 짧아져 아래가
         남았다. 배치를 바꿀 때 이 셈을 같이 안 고친 것이 화근이다.
         뿌리에서 무대를 빼면 배치가 어떻든 늘 맞는다 — 세로로 쌓든 격자로 겹치든
         '무대 아래에 실제로 얼마가 붙어 있나'가 곧 그 차다. 되먹임도 없다: 독의 높이는
         무대의 높이와 무관하므로 무대를 늘려도 이 값이 안 바뀐다. */
      const h9 = Math.max(0, root9.offsetHeight - st9.offsetHeight);
      setRowsH((v9) => (Math.abs(v9 - h9) > 1 ? h9 : v9));
    };
    read9();
    /* 줄의 높이는 폭·글꼴·로스터 여닫이에 따라 바뀐다 — 관찰자로 따라간다. 되먹임은
       없다: 무대가 눌려도 줄의 높이는 안 바뀐다(줄은 폭만 100%인 가로 줄이다). */
    const ro9 = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read9) : null;
    for (const c9 of Array.from(root9.children)) {
      if (c9 !== st9 && c9 instanceof HTMLElement) ro9?.observe(c9);
    }
    /* 뿌리도 함께 본다 — 줄이 **생기거나 사라질 때**(로스터 여닫이 3단)는 그 줄에 건
       관찰자가 못 알려 준다. read9는 볼 때마다 자식을 새로 훑으므로 이 한 줄이면 된다.
       되먹임은 없다: 무대가 눌려 뿌리가 줄어도 자식들의 합은 그대로라 값이 안 바뀐다. */
    ro9?.observe(root9);
    window.addEventListener("resize", read9);
    window.addEventListener("orientationchange", read9);
    return () => {
      ro9?.disconnect();
      window.removeEventListener("resize", read9);
      window.removeEventListener("orientationchange", read9);
    };
  }, [rowsOutside, fsOn]);
  /** 무대에 걸 비 — 줄이 밖으로 흐르는 배치에서만 여기 걸린다. */
  /* ★ 무대는 **남는 높이를 쓴다**(지적: "iOS에서 너무 높이가 짧게 나옴 맵이" → "아직도
     하단 공간 엄청 남고 있음") ─────────────────────────────────────────────────────
     여태 무대의 높이는 오직 지도 비가 정했다. 폭이 화면을 꽉 채우므로 정사각 판이면
     높이도 폭만큼이고, 그보다 더 커질 길이 없다 — 390×844 폰에서 지도는 390px에서
     멈추고 아래로 300px 넘게 남는다. 예산을 아무리 넉넉히 잡아도 이 천장은 안 움직인다.
     그 남는 몫을 무대에 준다. 지도는 무대를 **덮게(cover)** 깔리므로, 무대가 비보다
     길어지면 좌우가 잘리고 그만큼 지도가 커진다(잘린 몫은 끌어서 본다 — 이 판이 좁은
     화면에서 늘 쓰던 규칙이다).
     다만 **끝까지 늘리지는 않는다**: 세로로 길쭉한 화면에서 다 채우면 정사각 판의 좌우가
     3할 넘게 잘려 '지도 한복판만 보이는 창'이 된다. 비 높이의 1.35배에서 끊는다 —
     그 값이면 좌우로 잃는 몫이 4분의 1 남짓이고, 얻는 것은 지도가 3할 이상 커지는
     것이다(실측 390폭: 390 → 527). 넘치는 자리는 그대로 둔다.
     ※ 폭은 실측(stage.w)이다 — CSS만으로는 '비가 낸 높이'와 예산을 함께 못 견준다. */
  /** 눕힌 지도가 **화면에서 차지하는 세로**(상자 세로의 몇 배인가) ────────────────────
   *  눌림(C)만으로는 모자란다 — 원근이 먼 변을 한 번 더 줄이기 때문이다. posFrac의 식을
   *  양 끝(v = ±h/2)에 넣어 풀면 위아래가 0.5 ∓ C(1+q·kFar)/4로 나오므로, 차이가 곧
   *  이 값이다. q·kFar = (2d − S)/(2d + S)이고 d는 원근 거리 배수(pitchDistOf)라
   *  **상자 크기에 안 매인다**. 45도에서 0.608이다.
   *  팬 한계(panLimit)와 미니맵 창이 이 값을 나눠 쓴다. */
  const pitchSpan9 = ((): number => {
    if (!pitched) return 1;
    const c9 = pitchFlat;
    const s9 = Math.sqrt(Math.max(0, 1 - c9 * c9));
    const d9 = pitchDistOf(s9);
    const qk9 = (2 * d9 - s9) / Math.max(1e-6, 2 * d9 + s9);
    return Math.max(0.2, (c9 * (1 + qk9)) / 2);
  })();
  /* ★ (걷어냄) 위쪽 여유 — **무대 안 띠**로도 **판 위 여백**으로도 해 봤고 둘 다 걷었다
     (요청: "그냥 위 패딩 제거하고 마무리"). 내력을 남긴다, 다음에 또 이 생각이 날 테니.
       ① 무대 안의 띠 — 지도의 세로를 먹었고, 손대는 곳마다(덮기·앉히기·클립) 새 어긋남이
          났다. 결국 '우주에 뜬 지도'가 됐다.
       ② 판 위의 여백, 배율을 탐 — 확대할 때마다 `패딩 → 예산 → 무대 → 지도`가 줄줄이
          다시 잡혀 끌기·확대가 흔들리고 늦어졌다.
       ③ 판 위의 여백, 못 박은 값 — 흔들림은 없앴지만 **그 자리가 아예 안 먹었다**:
          무대·판뿌리가 `position:absolute; inset:0`이라 패딩 상자를 기준으로 앉는다
          (패딩은 절대배치 자식을 밀지 않는다). 예산에서 뺀 몫만 무대 아래에 남아,
          "공간은 있는데 그림은 안 그려지는" 꼴이 됐다.
     맨 윗줄의 키 큰 모델이 잘리는 것은 원작 화면도 그렇고, 보고 싶으면 조금 끌면 된다. */
  /** 지도가 쓸 수 있는 세로 — 프레임 높이에서 **고정인 조작부**를 뺀 나머지다(요청 ①). */
  const stageBudget9 = frameMaxH > 0 ? Math.max(160, frameMaxH - rowsH) : 0;
  /** 그림 여유의 **바라는 크기** — 자는 세로 예산이다(요청 ①: 조작부는 고정이므로 남는
   *  세로가 곧 지도의 몫이고, 여유도 그 안에서 떼는 것이 맞다).
   *  한때 지도 높이를 자로 썼는데, 그러면 지도가 폭에 눌려 작아질수록 여유도 같이 작아져
   *  정작 필요한 자리에서 0이 됐다 — "조절됐을 때 맨 위 여유 도화지가 안 생기는 문제"가
   *  그것이다. 예산을 자로 쓰면 지도가 어떻게 정해지든 이 몫이 먼저 확보된다.
   *  ★ 몫을 키웠다(재지적: "여유 도화지 아직도 부족해서 좀 더 늘려 줘") — 13%·최대 120px
   *    → **20%·최대 190px**. 지도가 그만큼 작아지는 맞바꿈이라 한 번에 크게 안 가고
   *    한 단씩 올린다(7%·64 → 13%·120 → 20%·190). */


  /* ★ 무대 크기는 **세로가 먼저, 가로가 나중**이다(요청) ─────────────────────────────
       ① 화면에 남은 세로(예산 = 프레임 높이 − 조작부)에 **지도 + 그림 여유**가 들어가게
          지도 크기를 정한다. 조작부는 고정이므로 예산은 그것을 뺀 나머지다.
       ② 그렇게 낸 폭이 가용 가로를 넘으면 가로에 맞춰 더 줄인다.
       ③ 댓글 기둥·탭바는 안 센다 — 댓글은 제 칸을 따로 쓰고, 이 페이지에는 탭바가 없다
          (예산을 재는 read()가 화면에 실제로 뜬 탭바만 잰다).
     ①은 무대의 **폭 상한**(stageCapW9)이 지고, ②는 그 상한에 함께 든 100%가 진다 —
     브라우저의 min()이 둘 중 작은 쪽을 고른다. 여기서는 그 결과(잰 stage.w)를 받아 여유와
     지도 상자를 낸다. */
  /** 무대 폭을 덮으려면 지도가 가져야 할 높이 — 잰 폭이 곧 지도 폭이므로 이것이 지도 높이다. */
  const coverH9 = stage.w > 0 ? (stage.w * grid.height) / Math.max(1, grid.width) : 0;
  /* 같은 값을 두 이름으로 쓰던 자리 — 한 곳에서만 낸다(두 곳에서 셈하면 언젠가 갈린다). */
  const aspectH9 = coverH9;
  /** 지도 상자 — 무대에서 뗄 것이 없으니 무대 세로가 곧 지도 세로다. */
  const fitH9 = Math.max(1, stage.h);
  /* ★ 프레임도 **덮는다**(요청: "컨셉상 프레임일 때도 전체화면처럼 최대 크롭이 맞을 거
     같은데" · "괜찮은 이유: 미니맵이 있어서 전체 전황을 한눈에 확인 가능") ────────────────
     한때 프레임만 '높이 맞춤'으로 두었다. 그 까닭은 "지도가 잘리면 본진 둘이 사라진다"
     였는데, 그 걱정의 답이 이미 화면에 있다 — 미니맵이 늘 전황 전체를 보여 준다. 잘린
     자리는 사라진 것이 아니라 **끌면 나오는 자리**이고, 어디가 잘렸는지는 미니맵의 창이
     말한다.
     이제 두 자리가 한 식이다: 짧은 쪽을 무대에 맞추고 긴 쪽이 넘친다. 넘치는 방향은
     무대의 생김새가 정한다 — 세로로 긴 폰에서는 좌우가, 가로로 누운 전체화면에서는
     위아래가 잘린다. */
  /* ★ 3D는 **안 덮는다**(요청: "우주 배경 만든 건 기존 3D 보기에서 남는 빈 공간
     채우는 용으로") — 한때 눌린 몫만큼 키워 무대를 채우게 했는데, 그러면 좌우가 크게
     잘리고 셈이 곳곳에서 갈렸다. 눕히면 지도가 무대를 못 채우는 것은 눕히기의 성질이고,
     그 남는 자리는 **밤하늘**이 맡는다. 덮는 크기는 2D·3D가 한 식이다. */
  const fsCoverW = stage.w > 0
    ? Math.max(stage.w, (fitH9 * grid.width) / Math.max(1, grid.height))
    : 0;
  const fsCoverH = fsCoverW > 0 ? (fsCoverW * grid.height) / Math.max(1, grid.width) : 0;


  /* 팬 한계가 읽는 자 셋 — 그리는 값과 **같은 렌더에서** 심는다(한 박자 늦으면 손짓이
     낡은 한계로 죄인다). 셋이 한 자리에 있는 것이 요점이다: 갈리면 끌기가 어긋난다. */
  coverRef.current = { w: fsCoverW, h: fsCoverH };
  /** 타일→렌즈 분수 사상(posFrac)의 최신 클로저 — 지도 벡터층의 입체 창 굽기와 **추적
   *  카메라**가 쓴다. 선언이 여기 있는 까닭: posFrac 자체는 이 아래(렌즈 셈 뒤)에 서는데,
   *  추적 카메라는 그보다 위에서 자리를 정해야 한다. 값은 한 렌더 늦은 클로저지만 카메라가
   *  보는 것은 기하(각·상자)이고 그것이 프레임 사이에 바뀌는 일은 손짓 중뿐이라, 한 프레임
   *  늦어도 눈에 안 띈다. */
  const mapFracRef = useRef<((x: number, y: number) => [number, number]) | null>(null);
  /* ── 추적 카메라(요청) — 가장자리에 닿을 때만 다시 잡는다 ────────────────────────
     처음에는 프레임마다 그 점을 화면 한가운데에 못박았다. 그러면 집힌 무리가 걷는 내내
     지도가 같이 흘러 멀미가 난다(지적: "선택된 유닛이 이동할때 화면도 계속 움직여서
     어지럽네"). 원작 관전 카메라도, 사람 손도 그렇게 안 움직인다 — 보고 있으면 가만
     두다가 시야 밖으로 나가려 할 때 한 번 크게 옮긴다.
     그래서 화면 가운데에 **안전한 상자**를 둔다: 그 안에 있는 동안은 카메라가 서 있고,
     가장자리 띠(TRACK_EDGE)에 발을 들이면 그때 다시 잡되 **한가운데로** 데려온다(요청).
     가운데로 오는 까닭은 다음 이동까지 벌 시간이 가장 길어서다 — 가장자리에서 살짝만
     밀어 넣으면 곧바로 또 걸려 카메라가 잘게 떤다.
     ★ 잡아 둔 자리는 ref에 산다 — 상태로 두면 프레임마다 렌더가 한 번 더 돈다. 값이
       안 바뀌는 동안은 **같은 객체**를 그대로 돌려주므로, pan을 의존성으로 쓰는 자리도
       가만있는 화면에서는 다시 안 돈다. */
  /** 가장자리 띠의 비율 — 화면 폭·높이 기준. 0.1이면 바깥 10%에 닿는 순간 다시 잡는다.
   *  곧 가운데 **80%가 안전 상자**다(요청: "60은 좁다 80으로") — 0.2(안전 60%)에서는
   *  화면이 아직 넉넉한데도 카메라가 먼저 움직여, 안 흔들리게 하려던 뜻이 반만 섰다. */
  const TRACK_EDGE = 0.1;
  const trackCamRef = useRef<{ raw: string | null; z: number; pan: { x: number; y: number } }>(
    { raw: null, z: 0, pan: { x: 0, y: 0 } });
  const trackView = ((): { pan: { x: number; y: number } } | null => {
    if (!trackRaw || !trackAt) return null;
    const cov9 = coverRef.current;
    if (cov9.w < 4 || cov9.h < 4) return null;
    /* 배율은 **사람 몫**이다(요청: "줌은 변경 가능하게") — 추적은 켜는 순간 화면 폭에
       맞춘 배율로 한 번 밀어 주고(toggleTrack · trackZoom9), 그 뒤로는 지금 배율을 따른다. */
    const z9 = zoom;
    const lim9 = panLimit(z9);
    /* ★ 자리를 **지도와 같은 사상으로** 잰다(지적: "추적 기능이 3D에서 엉뚱한 데를
       보여 줘") ────────────────────────────────────────────────────────────────────
       여태 이 자리는 타일을 격자 크기로 나눈 **평면 분수**였다. 평면 보기에서는 그것이
       곧 화면 자리지만, 입체에서는 아니다: 눕힌 판은 원근을 먹어 가까운 쪽이 넓고 먼 쪽이
       좁으며(k), 세로는 눌리고(C) 위로 밀린다(cy). 그래서 같은 타일이라도 평면 분수와
       실제 화면 자리가 크게 어긋나고, 그 어긋난 만큼 카메라가 엉뚱한 데를 잡았다.
       지도가 쓰는 그 사상(posFrac)을 그대로 쓴다 — 한 벌이어야 카메라와 그림이 같은 곳을
       가리킨다. 없으면(첫 렌더) 옛 평면 셈으로 물러난다. */
    const fr9 = mapFracRef.current?.(trackAt.x, trackAt.y);
    const cx9 = fr9 ? fr9[0] : trackAt.x / Math.max(1, grid.width);
    const cy9 = fr9 ? fr9[1] : trackAt.y / Math.max(1, grid.height);
    /** 그 점을 한가운데로 데려오는 자리(지도 밖으로는 못 나가게 죈다). */
    const mid9 = {
      x: Math.min(lim9.x, Math.max(-lim9.x, (0.5 - cx9) * cov9.w * z9)),
      y: Math.min(lim9.yTop, Math.max(-lim9.y, (0.5 - cy9) * cov9.h * z9)),
    };
    const cur9 = trackCamRef.current;
    /* 다시 잡아야 하나 — 사람이 바뀌었거나(처음 켬 포함), 배율이 바뀌었거나(잡아 둔
       자리는 그 배율에서 잰 px이라 다른 배율에서는 뜻이 없다), 안전 상자를 벗어났거나. */
    let keep9 = cur9.raw === trackRaw && cur9.z === z9 && lim9.winW > 0 && lim9.winH > 0;
    if (keep9) {
      /** 지금 잡아 둔 자리에서 그 점이 화면 한가운데로부터 떨어진 px. */
      const dx9 = (cx9 - 0.5) * cov9.w * z9 + cur9.pan.x;
      const dy9 = (cy9 - 0.5) * cov9.h * z9 + cur9.pan.y;
      const keepW9 = (lim9.winW / 2) * (1 - 2 * TRACK_EDGE);
      const keepH9 = (lim9.winH / 2) * (1 - 2 * TRACK_EDGE);
      if (Math.abs(dx9) > keepW9 || Math.abs(dy9) > keepH9) keep9 = false;
    }
    if (!keep9) trackCamRef.current = { raw: trackRaw, z: z9, pan: mid9 };
    return { pan: trackCamRef.current.pan };
  })();
  /** 화면에 실제로 먹는 자리 — 추적 중이면 추적이, 아니면 사람이 정한다.
   *  ★ 이 값이 곧 **카메라 잠금**이다(요청: "드래그나 wasd 이동 가장자리 스크롤등 다
   *    막아야해") — 미는 길이 몇이든 결국 손짓 한 벌(applyGestureXf)과 상태(panBase)를
   *    지나는데, 화면이 읽는 것은 이 하나뿐이다. 아래 trackLockRef가 손짓 쪽을 막는다. */
  const pan = trackView ? trackView.pan : panBase;
  /** 추적이 카메라를 쥐고 있나 — 쥐고 있으면 그 자리다(손짓 쪽에서 ref로 읽는다). */
  const trackLockRef = useRef<{ x: number; y: number } | null>(null);
  trackLockRef.current = trackView ? trackView.pan : null;
  viewHRef.current = fitH9;
  pitchKRef.current = pitchSpan9;
  /* (아래로 옮김) 위쪽 여유(bandRef) — 입체의 눌림(pitchK)이 먼저 서야 한다. */
  /** 지금 **끌 여유**가 있나 — 덮은 몫이 있으면 참(전체화면은 저절로 만족한다). */
  /* ★ 위쪽 여유(bandRef)도 '끌 여유'다 — 1배·꼭 맞는 판에서도 위로는 끌 수 있어야
     맨 윗줄에 선 것이 온전히 보인다.
     다만 **bandRef를 여기서 읽으면 안 된다**: 그 값은 pitchK가 선 뒤(아래)에 심으므로
     이 자리에서는 늘 **한 렌더 늦은 값**이다. 여유가 서는 조건은 그 값과 정확히 같으니
     (fsCoverW > 0이면 pitchK는 늘 양수라 band > 0) 조건 쪽을 그대로 쓴다. */
  const panRoom = zoom > 1
    || fsCoverW > 0
    || (stage.w > 0 && (fsCoverW > stage.w + 0.5 || fsCoverH > stage.h + 0.5));

  /* ★ 무대 세로는 **지도가 폭에 딱 맞게 들어가는 높이 + 그림 여유**다(지적: "게임상세
     프레임모드에서 … 가로가 양쪽이 스테이지 안에 못 들어오고 넘쳐") ────────────────────
     여기 있던 것은 '예산이 허락하는 만큼 길쭉하게'(상한 2.2배)였다. 무대가 지도보다
     길쭉해지면 지도는 세로를 채우느라 폭이 무대를 넘어 **좌우가 잘린다** — 폰에서 그
     몫이 실측 41%까지 갔다(무대 358, 지도 608). 그 길쭉함은 한때 "밑에 공간 너무 많이
     남아"를 고치려고 올린 값인데, 남는 자리를 메우려다 지도의 절반 가까이를 창 밖으로
     밀어낸 셈이다.
     이제 천장을 '지도가 꼭 맞는 높이 + 여유'로 못 박는다. 그러면 지도 폭이 정확히 무대
     폭이고(fsCoverW = coverH9 × 지도비 = stage.w) 좌우가 넘치지도, 빈자리로 남지도
     않는다. 위아래도 그대로 안 잘린다 — 여유가 곧 남는 세로의 전부다.
     예산이 그보다 작으면 예산이 이긴다.
     남는 자리는? 실제 화면에서는 거의 없다: 머리·제목 줄과 아래 조작줄을 빼고 나면
     예산은 폭과 엇비슷해진다(실측 폰 예산 391 · 폭 358). 계측 도구처럼 위가 텅 빈
     자리에서만 눈에 띄고, 그 자리에서 남는 것과 지도가 잘리는 것 중에는 남는 편이 낫다. */
  /* 무대 세로 = **지도 + 바라는 여유**, 예산을 넘지 않는다. 폭 상한이 이미 `예산 − 여유`를
     넘지 않게 잡아 두므로 대개 그 합이 그대로 서고, min()은 폭이 100%(또는 1024)에 먼저
     걸려 지도가 더 작아진 때만 일한다 — 그때는 남는 세로가 여유로 더 간다. */
  /* ★ 좁은 배치의 무대는 **예산을 꽉 채운다**(위 fsCoverW 주석: 프레임도 덮는다) —
     덮으려면 무대가 지도보다 길쭉해야 넘칠 것이 생긴다. 넓은 배치는 종전대로 '지도 + 여유'
     에서 멈춘다: 거기서 예산까지 늘리면 무대가 지도보다 **가로로** 길어져 위아래가 잘리는데,
     본진 둘이 대개 위·아래 구석이라 그 방향의 크롭은 가장 아프다(폰은 반대다 — 세로로
     길어 좌우가 잘린다). */
  const stageH9 = aspectH9 > 0 && stageBudget9 > 0
    ? Math.round(Math.max(aspectH9, wide
      ? Math.min(stageBudget9, aspectH9) : stageBudget9)) : 0;
  /** 지도(무대)의 폭 상한 — 이제 **판이 진다**(요청: "PC에서 프레임 모드에서 맵 스테이지
   *  너비와 플레이어 조작부(미니맵~버튼·재생바쪽) 폭은 일치시키기").
   *
   *  한동안은 무대만 이 상한을 지고 판은 제 칸을 꽉 채웠다 — 조종부는 가로로 길수록
   *  재생바를 잘게 짚을 수 있다는 사정이었다. 그런데 그러면 지도 밑변과 조작부의 좌우
   *  끝이 안 맞아, 한 덩이여야 할 것이 지도 한 장과 그 아래 더 넓은 띠 둘로 보인다.
   *  자를 하나로 맞춘다: 이 값은 아래 frameStyle이 판에 걸고, 무대는 판 안에서 100%다.
   *  그러면 무대·미니맵·아이콘 줄·조종부가 모두 같은 폭이고 가운데 정렬도 판이 한 번만
   *  한다(.scr-fs-layer의 margin: 0 auto). */
  const stageCapW9 = ((): string | undefined => {
    if (!rowsOutside || stageBudget9 <= 0) return undefined;
    /* 두 상한 중 작은 쪽 — 세로 예산이 내는 폭(①)과 가용 가로(②). 넓은 배치는 옛 상한
       1024도 함께 든다. **좁은 배치에도 건다**(전에는 넓은 배치뿐이었다): 거기서는 폭이
       늘 100%라 세로 예산이 아무 일도 못 했고, 그래서 예산이 빠듯하면 지도가 조작부를
       밀어냈고 넉넉하면 여유가 들어설 자리가 안 남았다. */
    const caps9 = ["100%"];
    /* 세로가 내는 폭 상한은 **넓은 배치에만** 건다 — 그쪽은 무대가 지도보다 가로로
       길어지면 위아래가 잘리므로 그 선을 넘으면 안 된다(위 stageH9 주석). 좁은 배치는
       폭이 곧 화면이고, 남는 세로는 덮기가 가져간다. */
    if (wide) {
      caps9.push(`${mapViewW}px`);
      caps9.push(`${Math.round((stageBudget9 * grid.width)
        / Math.max(1, grid.height))}px`);
    }
    return `min(${caps9.join(", ")})`;
  })();
  const stageStyle: React.CSSProperties | undefined = rowsOutside
    ? {
      aspectRatio: `${grid.width} / ${grid.height}`,
      /* 폭은 **안 건다** — 판이 이미 상한을 지고 있고(위 stageCapW9), 무대는 그 안에서
         100%다(CSS의 .scr-fs-layer:not(.is-fs) .scr-fs-stage). 여기에도 걸면 같은
         상한이 두 번 접혀 조작부보다 좁아진다. */
      ...(stageH9 > 0 ? { height: `${stageH9}px` } : {}),
      /* ★ 예산은 **무대가 진다** — 판이 아니라(아래 frameStyle의 사정) ──────────────
         줄들의 몫(rowsH)을 빼면 판 전체가 정확히 한 화면에 든다. 다만 그 뺄셈은
         **없어도 되는 보탬**이어야 한다: 재는 값이라 늦게 오거나(첫 그림) 안 올 수도
         있는데(관찰자 없는 환경), 그때 0으로 떨어지면 무대가 예산을 다 먹는다.
         그래도 아무것도 안 잘린다 — 판에서 max-height를 걷었으므로 넘치는 몫은
         페이지가 스크롤로 받는다. 즉 이 값은 '한 화면에 딱 맞추기'를 거들 뿐이고,
         틀려도 대가는 스크롤 한 뼘이지 사라진 재생바가 아니다.
         바닥값(160) — 예산이 아주 빠듯해도 지도 한 뼘은 남긴다. */
      ...(frameMaxH > 0
        ? { maxHeight: `${Math.max(160, frameMaxH - rowsH)}px` } : {}),
    }
    : undefined;
  /** 프레임 크기 — 높이 예산이 폭을 정한다(위). 전체화면은 CSS가 화면을 채운다. */
  const frameStyle = ((): React.CSSProperties => {
    /* ★ 폭을 **높이 예산으로 죄는 것은 넓은 배치뿐**이다(지적: "맵 오른쪽 검정 띠 여백
       보이지 저게 문제였네") — 좁은 화면에서 예산이 폭보다 작게 나오면 판이 줄 폭보다
       좁아지고, 가운데 정렬이라 좌우에 검은 띠가 남는다. 폰은 폭이 곧 화면이라 그 띠가
       그대로 손해다. 좁은 화면에서는 **폭을 꽉 채우고**, 넘치는 세로만 max-height가
       자른다(지도는 덮게 깔리므로 잘린 만큼은 끌어서 본다).
       넓은 배치는 좌우에 여백이 있는 것이 정상이라 예산이 폭을 정해도 된다. */
    const caps = [wide ? `${mapViewW}px` : "100%", "100%"];
    if (wide && frameMaxH > 0) {
      /* 폭 상한은 '이 높이에 지도가 다 들어오려면 폭이 얼마여야 하나'다. 줄이 밖으로
         흐르면 그 높이는 판 전체가 아니라 **무대 몫**이라(줄들이 제 몫을 먼저 가져간다),
         같은 값을 여기서도 써야 한다 — 안 그러면 판이 예산보다 길어진다. */
      const budget9 = rowsOutside ? Math.max(160, frameMaxH - rowsH) : frameMaxH;
      /* ★ 그림 여유 몫을 **폭에서 미리 뺀다**(지적: 여유를 늘려도 안 늘어남) ──────────
         넓은 배치에서는 판 폭이 곧 '이 높이에 지도가 다 들어오는 폭'이라, 그렇게 잡으면
         지도가 무대를 세로로 꽉 채운다 — 남는 높이가 0이니 여유가 들어설 자리가 없다.
         (그 자리를 억지로 떼면 지도 폭이 같이 줄어 좌우에 검은 띠가 생긴다. 앞선 지적이
         그것이었다.) 자리는 **폭을 그만큼 좁혀서** 만든다: 지도가 조금 작아지는 대신
         위에 여유가 생기고, 좌우는 여전히 꽉 찬다. 좁은 배치는 폭이 곧 화면이라 이
         손을 못 쓴다. */
      caps.push(`${Math.round((budget9 * grid.width) / Math.max(1, grid.height))}px`);
    }
    return {
      // 비는 무대가 질 수도 있다(위 rowsOutside) — 그때는 판이 '지도 + 줄'만큼 자란다.
      ...(rowsOutside ? {} : { aspectRatio: `${grid.width} / ${grid.height}` }),
      /* ★ 폭 상한은 **판이** 진다 — 무대와 조종부가 같은 폭이어야 한다(요청: "PC에서
         프레임 모드에서 맵 스테이지 너비와 플레이어 조작부(미니맵~버튼·재생바쪽) 폭은
         일치시키기") ────────────────────────────────────────────────────────────────
         한동안은 반대였다(앞선 요청: "조작부 폭을 지도와 똑같이 제한할 필요는 없을 듯
         — 최대 페이지 너비까지 풀어 줘"). 재생바가 길수록 잘게 짚힌다는 사정이었는데,
         그 대가로 지도 밑변과 조작부의 좌우 끝이 어긋나 한 덩이여야 할 판이 '지도 한
         장 + 그보다 넓은 띠' 둘로 보였다. 이제 자를 하나로 되돌린다.
         상한은 무대가 쓰던 값 그대로다(위 stageCapW9) — 지도가 제 비로 다 들어오는
         폭이므로, 그 폭을 판에 걸면 무대는 판 안에서 100%로 서고 미니맵·아이콘 줄·
         조종부도 같은 폭이 된다. 가운데 정렬은 판이 한 번만 한다(.scr-fs-layer의
         margin: 0 auto). 줄이 지도 **안**에 뜨는 배치(전체화면)에서는 종전대로 아래
         caps가 판을 죈다. */
      width: rowsOutside ? (stageCapW9 ?? "100%") : `min(${caps.join(", ")})`,
      /* ★ 판의 천장은 **줄이 지도 안에 있을 때만** 건다(지적: "너무 위험한 방식으로
         위아래 공간을 만든 거 아니야? 안전하게 가자 — 모든 경우를 테스트할 순 없어")
         ────────────────────────────────────────────────────────────────────────────
         판은 overflow:hidden이라 이 천장은 곧 **가위**다. 줄이 지도 안에 떠 있는 배치
         (넓은 화면·전체화면)에서는 잘리는 것이 지도뿐이라 안전하다 — 지도는 cover로
         깔려 있어 잘린 만큼 끌어서 보면 된다.
         줄이 지도 **밖으로** 흐르는 좁은 배치에서는 그 가위가 조작부를 자른다. 실기기
         iOS에서 재생바 대부분이 사라진 것이 그것이었다. 무대 높이를 재서 맞추는 손도
         써 봤지만, 그건 '재는 값이 맞을 때만' 안전한 방식이다 — 값이 늦거나 틀리면
         **아무 말 없이 다시 잘린다**. 조용히 사라지는 실패는 고쳐도 다시 난다.
         그래서 이 배치에서는 가위 자체를 없앤다. 예산은 무대의 max-height로 옮겨
         (위 stageStyle) 지도만 자르고, 줄은 어떤 경우에도 판 밖으로 안 밀린다:
         판의 높이가 늘 제 내용만큼이므로 넘칠 것이 없다. 예산을 넘기면 페이지가
         스크롤로 받는다 — 최악이 '한 뼘 스크롤'이지 '안 보이는 버튼'이 아니다. */
      ...(frameMaxH > 0 && !rowsOutside ? { maxHeight: `${frameMaxH}px` } : {}),
    };
  })();
  /** 밤하늘 한 장 — **경기마다 다르고 그 경기 안에서는 안 변한다**(요청: "패턴은 좀
   *  다양하게 나왔으면"). 씨앗이 경기번호라 새로 고쳐도 같은 하늘이고, 프레임마다 다시
   *  짓지 않는다(memo가 내는 것은 문자열 하나다). */
  const spaceBg9 = useMemo(() => spaceBackdropUrl(clockKey || "sky"), [clockKey]);
  /* 지금 보는 자리를 계속 적어 둔다(요청: "현재 장면 공유시 내가 보고있던 부분의 위치까지
     같이 보내서 들어오는 사람도 거기가 재생되게") — 공유 버튼(gameShare)이 이 값을 읽어
     링크에 싣는다. 픽셀이 아니라 **분수**로 적는 까닭은 보내는 쪽과 받는 쪽의 지도 상자
     크기가 달라서다: 화면 한가운데에 오는 지도 위 지점을 0~1로 적으면 상자가 아무리
     달라도 같은 곳이 가운데에 온다.
     식은 클릭 판정(pickAt)의 역이다 — 거기서 화면 x = (fx−0.5)·폭·배율 + 폭/2 + pan.x
     이므로, 화면 한가운데(x = 폭/2)에 오는 fx는 0.5 − pan.x/(폭·배율)이다. */
  /* ★ 두 가지를 고쳤다(지적: "장면 스크랩 열어 보면 시간은 맞는데 위치가 다른 곳이
     나오네") — 시각은 그냥 초라 어긋날 데가 없고, 어긋나는 것은 이 분수뿐이다.
     ① **상자가 갈릴 때 다시 안 적었다.** pan은 *내용 픽셀*이라 그 뜻이 상자 크기에
        매여 있는데, 목록에는 zoom·pan·각만 있었다. 전체화면을 켜면 pan은 숫자가 그대로
        인데 덮는 폭(fsCoverW)이 통째로 갈린다 — 실제로 보는 자리는 달라졌는데 적힌
        분수는 **켜기 전 폭으로 잰 옛 값** 그대로다. 켜자마자(끄자마자) 담으면 그 옛
        분수가 링크로 간다. 배치를 재는 값들을 목록에 넣어, 상자가 갈리면 다시 적는다.
     ② **잰 자가 변환을 탔다.** getBoundingClientRect는 눕힘(3D)이 걸린 상자에서
        **돌아간 겉넓이**를 준다 — 받는 쪽은 아직 안 누운 상자로 되풀므로 셈이 갈린다.
        offsetWidth/Height는 변환을 안 타는 배치 상자라 양쪽이 같은 자를 쓴다. */
  useEffect(() => {
    if (!clockKey) return;
    const el = mapRef.current;
    if (!el) return;
    const bw = el.offsetWidth;
    const bh = el.offsetHeight;
    if (bw <= 0 || bh <= 0) return;
    playbackViewOf.set(clockKey, {
      z: zoom,
      cx: 0.5 - pan.x / (bw * zoom),
      cy: 0.5 - pan.y / (bh * zoom),
      deg: pitchDeg,
    });
  }, [clockKey, zoom, pan.x, pan.y, pitchDeg, fsOn, stage.w, stage.h, fsCoverW]);
  useEffect(() => () => { if (clockKey) playbackViewOf.delete(clockKey); }, [clockKey]);
  /* 받은 자리로 옮겨 앉는다(요청: 공유 링크의 &z=·&cx=·&cy=·&a=) — 딱 한 번이다.
     지도 상자가 실제로 설 때까지 프레임마다 기다린다: 자취를 받아 오고 배치가 정해지는
     동안 상자 폭이 0이라, 그때 셈하면 팬이 통째로 0으로 눌린다. 2초(120프레임)를
     기다려도 안 서면 그냥 포기한다 — 못 옮긴 채로라도 재생은 돌아야 한다. */
  const viewDoneRef = useRef(false);
  useEffect(() => {
    if (!initialView) linkLog9("받은 자리 없음(링크에 z·cx·cy가 안 실렸거나 읽는 쪽이 안 넘겼다)");
    else linkLog9(`받음 z${initialView.z} ${initialView.cx},${initialView.cy} 각${initialView.deg}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView]);
  useEffect(() => {
    if (!initialView || viewDoneRef.current) return undefined;
    let raf = 0;
    let tries = 0;
    /* ★ **두 걸음**이다(위 적는 쪽의 지적과 한 짝) ────────────────────────────────
       한 프레임에 배율·각·팬을 한꺼번에 놓으면 팬만 어긋난다. 팬 한계(panLimit)와 지도
       상자는 **그 배율에서의 배치**로 나는 값인데(그림 여유가 배율을 타고 — bandK9 —
       덮는 폭도 그 여유를 뺀 높이에서 난다), 지금 이 프레임의 상자는 아직 **옛 배율**
       것이다. 그 상자로 클램프하면 받은 자리가 한계에 눌려 딴 데가 된다.
       그래서 ① 배율·각만 먼저 놓고, ② 다음 프레임에 새로 선 상자로 팬을 푼다.
       무대(stageSizeRef)가 아직 0인 동안도 기다린다 — panLimit이 창을 무대에서 읽으므로
       0이면 한계가 통째로 어림이고, 1배 링크는 그대로 가운데로 눌린다. */
    let placed9 = false;
    let z9 = 1;
    const step = (): void => {
      const el = mapRef.current;
      const bw = el?.offsetWidth ?? 0;
      const bh = el?.offsetHeight ?? 0;
      /* 상자가 **제 크기(덮는 폭)에 닿은 뒤**에야 잰다(지적: 로딩 때 한번 쿵) — 예전엔 폭 트랜지션 도중의 상자를
         재서 판을 어긋나게 놓았다. 트랜지션은 걷었지만(CSS), 인라인 폭이 아직 안 실린 첫 프레임도 여기서 거른다. */
      const cw9 = coverRef.current.w;
      /* ★ 덮는 폭이 **설 때까지** 기다린다(지적: 공유 링크의 자리가 안 앉고 늘 정가운데) ─────────────────────────
         여태 조건이 `cw9 > 0 && …`이라 **덮는 폭이 0인 프레임을 '다 섰다'로 읽고 통과**시켰다. 그 0은 무대를 잰
         자(stageSizeRef)가 채워진 뒤에도 한 커밋 동안 남는다 — 덮는 폭은 무대 상태에서 나고 coverRef는 렌더에서
         적히기 때문이다. 그 틈으로 빠져나가면 팬 한계(panLimit)가 `cov.w <= 0`을 보고 한계를 통째로 0으로 주고,
         받은 자리는 그 0에 눌려 정가운데가 된다(배율은 앞 걸음에서 이미 걸린 뒤라 '6배인데 가운데'가 난다).
         타이밍이라 되는 날과 안 되는 날이 갈렸다. 덮는 폭은 팬 한계의 유일한 자이니 설 때까지 기다린다.
         다만 **끝내 안 서면** 그냥 진행한다 — 여기서 영영 물러나면 링크의 배율·각까지 통째로 잃는다(옛 꼴로 되돌아감). */
      const ready9 = bw >= 4 && bh >= 4 && stageSizeRef.current.w > 0 && cw9 > 0 && Math.abs(bw - cw9) <= 1;
      /* ★ 못 선 까닭 둘은 **무게가 다르다**(지적: 게이트가 열려도 남는 두 번째 구멍) ─────
         · 덮는 폭이 **0**이다 — 팬 한계(panLimit)가 통째로 0이라, 여기서 앉히면 받은 자리가
           그 0에 눌려 **정가운데**가 된다. 앉히느니만 못한 자리라 오래(10초) 기다린다.
         · 폭이 아직 **안 맞는다**(트랜지션·리플로 중) — 값은 있으니 늦어도 그 값으로
           앉히고, 어긋난 몫은 붙든 자리(linkHoldRef9)가 배치가 서면 고친다. 2초면 넉넉하다. */
      const soft9 = bw >= 4 && bh >= 4 && stageSizeRef.current.w > 0 && cw9 > 0;
      tries += 1;
      if (!ready9 && (soft9 ? tries < 120 : tries < 600)) {
        raf = requestAnimationFrame(step);
        return;
      }
      if (!placed9) {
        linkLog9(`통과 ${tries}프레임 상자 ${bw}x${bh} 덮 ${cw9.toFixed(0)} 무대 ${stageSizeRef.current.w}x${stageSizeRef.current.h}${ready9 ? "" : " ⚠못선채"}`);
      }
      if (!placed9) {
        placed9 = true;
        /* 각도는 우리가 가진 칸 중 가장 가까운 것으로 붙인다 — 링크가 낡아 없는 값이
           와도 화면이 어긋나지 않는다. */
        const deg = PITCH_DEGS.reduce((best, d) =>
          (Math.abs(d - initialView.deg) < Math.abs(best - initialView.deg) ? d : best),
        PITCH_DEGS[0]);
        /* ★ 손가락 기기는 **입체를 무시하고 평면으로 연다**(지시) — 알림은 안 띄운다:
           이 사람은 3D를 누른 적이 없고, 링크가 실어 온 것을 우리가 조용히 접는 것뿐이다.
           누르지도 않은 조작을 안 된다고 말하면 그게 더 이상하다. 자리(z·cx·cy)는 그대로
           살린다 — 못 주는 것은 각 하나뿐이다. */
        setPitchDeg(pitchAllowed() ? deg : PITCH_DEGS[0]);
        z9 = Math.min(ZOOM_MAX, Math.max(1, initialView.z));
        zoomRef.current = z9; setZoom(z9);
        raf = requestAnimationFrame(step);
        return;
      }
      viewDoneRef.current = true;
      /* 앉힌 뒤에도 **5초 동안은 붙들고 있는다**(위 linkHoldRef9) — 배치가 늦게 서는
         자리(PC의 넓은 배치)에서는 이 한 번이 옛 상자에서 난 값이라 딴 데를 가리킨다. */
      linkHoldRef9.current = { cx: initialView.cx, cy: initialView.cy, until: 0 };
      const lim = panLimit(z9);
      const wx9 = (0.5 - initialView.cx) * bw * z9;
      const wy9 = (0.5 - initialView.cy) * bh * z9;
      const gx9 = Math.min(lim.x, Math.max(-lim.x, wx9));
      const gy9 = Math.min(lim.yTop, Math.max(-lim.y, wy9));
      linkLog9(`앉힘 z${z9} 바람 ${wx9.toFixed(0)},${wy9.toFixed(0)} 한계 ${lim.x.toFixed(0)}/${lim.y.toFixed(0)}·${lim.yTop.toFixed(0)} → ${gx9.toFixed(0)},${gy9.toFixed(0)} 상자 ${bw}x${bh}`);
      setView9(z9, { x: gx9, y: gy9 }, true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // panLimit은 렌더마다 새로 나지만 읽는 값(stage·fsOn)은 ref다 — 목록에 안 넣는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView]);
  /** 손가락 기기인가 — 전체화면 배치가 통째로 이 값으로 갈린다(기둥 둘 vs 위·아래 줄). */
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(pointer: coarse)");
    const read = (): void => setCoarse(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  /** 오버레이 조작부가 지금 보이나(요청: 3초 미조작 시 숨김). */
  const [fsUi, setFsUi] = useState(true);
  /** 로스터 판의 **세 꼴**(요청: "테이블 버튼 3단계 — 기본은 로스터만 보이기 ·
   *  2단계는 전체 보이기 · 3단계는 전체 안 보이기") ────────────────────────────────
   *    0 로스터만 — 이름·종족만(판 없이).
   *    1 전체    — 판을 깔고 지표 다섯 칸까지.
   *    2 안 보임 — 아무것도 안 그린다. **여기가 기본이다.**
   *  여닫이가 둘일 때는 '끈 꼴'이 곧 '이름만'이라 **지도를 완전히 비우는 길이 없었다**.
   *  세 꼴이면 그 셋이 한 버튼에서 차례로 돈다.
   *  ★ 기본이 0(이름만)에서 2(안 보임)로 내려왔다(요청: "아이콘을 미활성 상태에선
   *    사람 모양으로, 로스터를 켠 상태에선 테이블로 · 기본값은 미활성 상태로") —
   *    아이콘이 '꺼짐/켜짐'을 말하기로 한 이상, 처음 화면에서 사람 아이콘이 꺼진 꼴로
   *    서 있는데 지도에는 이름이 떠 있으면 그 둘이 서로를 부정한다. 미활성은 아무것도
   *    안 그리는 꼴이어야 말이 맞다. 차례는 그대로여서(v+1) 기본에서 한 번 누르면
   *    이름만 · 두 번이면 전체다 — 없음 → 이름만 → 전체로 자란다. */
  /* ★ 추적으로 열린 링크는 **로스터 첫 단(이름만)으로 연다**(요청: "파라미터 있으면
     자동으로 로스터 1단계 켜고 추적모드 활성화") — 누구를 따라가고 있는지가 안 보이면
     추적은 그냥 '화면이 저 혼자 움직이는 일'로만 보인다. 첫 단인 까닭은 그 한 가지만
     말하면 되기 때문이다: 지표까지 펴면(전체) 지도를 그만큼 더 가린다. */
  // 처음부터 기본 로스터(이름만)로 시작한다(요청: "프레임 모드에서도 기본 로스터는 켠 상태로 시작") — 추적 링크든 아니든.
  const [rosterMode, setRosterMode] = useState<0 | 1 | 2>(0);
  void initialTrack;
  /** 미니맵 판이 켜져 있나(요청: "미니맵 오버레이 및 아이콘 추가") — 로스터와 같은 결로
   *  제 아이콘이 여닫는다.
   *  ★ 기본은 **켜짐**이다(요청: "미니맵은 기본 활성화 상태") — 한동안 꺼짐이었다(그때의
   *    셈: 미니맵이 지도 한 귀퉁이를 가리니 필요할 때 부르자). 원작에서도 미니맵은 늘
   *    떠 있는 것이고, 확대해서 보는 판일수록 '지금 어디를 보고 있나'가 먼저 필요하다.
   *    가리는 것이 싫으면 제 아이콘으로 끈다. */
  const [fsMiniOn, setFsMiniOn] = useState(true);
  /* 배경 음악(요청) — 켜기·끄기와 곡 고르기는 전부 useBgm 안이다. 기기 음량·무음을
     따르는 방법(아무것도 안 건드리기)과 안드로이드의 한계가 그 파일 머리에 적혀 있다.
     재생 여부를 넘긴다(요청: "재생 멈추면 음악도 멈추기") — 일시정지·되감기 잡고
     있는 동안은 음악도 함께 잠든다. */
  const bgm = useBgm(playing);
  const fsUiRef = useRef(true);
  fsUiRef.current = fsUi;
  const fsHideRef = useRef(0);
  /** 손으로 연 조작부인가 — 그러면 저절로 안 숨는다(아래 fsToggleUi). */
  const fsStickRef = useRef(false);
  /** 조작부를 깨우고 3초 뒤 다시 숨긴다 — 조작이 있을 때마다 이 시계가 되감긴다. */
  const fsWake = useCallback((): void => {
    setFsUi(true);
    window.clearTimeout(fsHideRef.current);
    /* 손으로 연 것은 손으로 닫는다 — 시계를 안 건다. */
    if (fsStickRef.current) return;
    fsHideRef.current = window.setTimeout(() => setFsUi(false), 3000);
  }, []);
  /* 지도의 빈 곳을 누르면 조작부를 켰다 껐다 한다(요청: "맵 클릭시 인포팝업뜨는곳
     아니면 도구 오버레이뜸 뜬상태에서 또 클릭시 닫힘") — 유닛·건물을 눌렀을 때는 여기까지
     안 온다. 그건 정보 팝업의 몫이다(아래 onMapPointerUp).
     구석에 떠 있던 '⋯' 깨우기 버튼은 이걸로 갈음하고 걷어냈다(요청: "모바일 전체화면
     메뉴 버튼 제거") — 지도 아무 데나 누르면 되는데 버튼이 하나 더 떠 있을 까닭이 없다. */
  const fsToggleUi = useCallback((): void => {
    window.clearTimeout(fsHideRef.current);
    const next = !fsUiRef.current;
    fsStickRef.current = next;
    setFsUi(next);
  }, []);
  /* (걷어냄) 모서리 쓸어 열기 — 왼쪽·오른쪽 두 번 고쳐도 운영체제 손짓(iOS 뒤로가기·
     안드로이드 손짓 내비게이션)과 계속 겨뤘고, 그 둘은 페이지가 못 막는다. 이제 여는
     길은 **오른쪽 위 아이콘 버튼**과 **엔터**뿐이다(요청) — 눈에 보이고 겨룰 것이 없다. */
  /* 전체화면 들고나기 — 브라우저 전체화면 API를 쓰되, **되는 곳에서만** 쓴다.
     아이폰 사파리는 div에 requestFullscreen이 아예 없으므로(영상 말고는 안 준다),
     성패와 무관하게 CSS로도 화면을 덮는다(.scr-motion-fs가 position:fixed·inset:0).
     그래서 안 되는 기기에서도 '꽉 찬 화면'은 똑같이 나온다 — 다르게 나오는 것은
     주소창이 남느냐뿐이다. */
  const enterFs = useCallback((): void => {
    /* ★ 무대 크기를 **미리 심는다**(지적: "전체화면 전환시 버벅이면서 줌이 맞춰지는
       현상") ──────────────────────────────────────────────────────────────────────
       여태 차례는 이랬다: ① fsOn이 켜지고 판이 붙는다 — 이때 stage는 아직 {0,0}이라
       fsCoverW가 0이고, 지도는 **평소 배치의 폭 그대로**(1024px) 무대 한가운데에
       그려진다. ② 브라우저가 그 화면을 **칠한다**. ③ 그제야 지나가는 이펙트가 무대를
       재고 setStage → 지도가 화면을 덮는 폭으로 튄다.
       ②가 곧 사용자가 본 '한 박자 늦게 줌이 맞춰지는' 그 프레임이다.
       무대는 `.scr-fs-layer`(100vw × 100dvh) 안에 inset:0으로 깔리므로 창 크기가 곧
       그 값이다 — 켜는 이 자리에서 미리 심어 두면 **첫 렌더부터 제 크기**다. 아래
       레이아웃 이펙트가 실제로 잰 값으로 곧 덮어쓰므로 어림이 남지도 않는다. */
    const w9 = window.innerWidth;
    const h9 = window.innerHeight;
    if (w9 > 0 && h9 > 0) {
      stageSizeRef.current = { w: w9, h: h9 };
      stageHold9.current = null;   // 새 무대다 — 다음 읽기를 그대로 받는다.
      setStage({ w: w9, h: h9 });
    }
    setFsOn(true);
    setFsHide9(false);   // 들어갈 때는 늘 보이는 채로(위 fsHide9) — 지난번에 걷어 둔 것이 따라오면 조작부를 잃는다
    /* 그리드(로스터 현황 표)는 **들어갈 때마다 꺼진 채로** 시작한다(요청: "그리드 진입시
       비활성화로") — 전체화면을 켜는 뜻은 지도를 크게 보겠다는 것이고, 숫자 다섯 칸은
       그때 필요하면 부르는 것이다. 꺼져도 이름·종족은 남으므로 누가 하는지는 안 잃는다.
       매번 되돌린다 — 지난번에 켜 둔 것이 다음 진입까지 따라오면 '진입 시 꺼짐'이 아니다. */
    setRosterMode(0);
    /* (걷어냄) setFsMiniOn(false) — 전체화면에 들 때 미니맵을 끄던 줄이다. 기본이
       꺼짐이던 시절에 '진입 시 꺼짐'을 로스터와 맞춘 것인데, 이제 기본이 켜짐이라
       (위) 이 줄이 남으면 **전체화면에서만 미니맵이 사라진다**(실측: 일반 화면은
       떠 있는데 전체화면은 없었다). 로스터와 달리 미니맵은 지도를 크게 볼수록 더
       필요한 것이라, 진입할 때 끌 까닭도 없다. */
    fsWake();
    /* 전체화면 대상은 **문서 뿌리**다(수리: "모바일 전체화면 맨위 스타게이트 로고가
       있어서") — 여태 이 컴포넌트의 뿌리 <div>에 걸었는데, 그 조상인 경기 카드
       (.scr-game-result-trow)에 backdrop-filter가 걸려 있다. backdrop-filter는 자손
       position:fixed의 '담을 상자'를 뷰포트에서 그 요소로 바꿔 놓는다. PC는 전체화면
       API가 먹혀 최상위 층으로 올라가니 티가 안 났지만, div에 requestFullscreen을 안
       주는 아이폰 사파리에서는 CSS 폴백(fixed·inset:0)이 화면이 아니라 **카드**를
       기준으로 깔렸다 — 그래서 화면 맨 위 헤더가 안 덮였다. 오버레이는 이제 body로
       포털하고(아래 fsInner), 전체화면도 문서 뿌리에 건다. */
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  }, [fsWake]);
  const exitFs = useCallback((): void => {
    setFsOn(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);
  /* 브라우저 쪽에서 나간 것(Esc·시스템 제스처)도 우리 상태에 반영한다. CSS 폴백으로만
     덮고 있는 기기에서는 이 이벤트가 안 오므로 Esc를 따로 받는다. */
  useEffect(() => {
    const onFsc = (): void => { if (!document.fullscreenElement) setFsOn(false); };
    const onEsc = (e: KeyboardEvent): void => {
      /* 팝업이 열려 있으면 ESC는 그것부터다(요청) — 한 번에 둘이 닫히면 안 된다. */
      if (e.key === "Escape" && pickedRef.current === null
        && fsOnRef.current && !document.fullscreenElement) exitFs();
    };
    document.addEventListener("fullscreenchange", onFsc);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("fullscreenchange", onFsc);
      window.removeEventListener("keydown", onEsc);
    };
  }, [exitFs]);
  /* 전체화면 동안은 문서가 안 구른다(지적: "피시 전체화면시 세로 스크롤바 생김") —
     전체화면 판은 position:fixed로 화면을 덮을 뿐, 그 밑의 페이지는 그대로 서 있다.
     경기 상세는 화면보다 긴 문서라 오른쪽 스크롤바가 그대로 남았고, 그 폭만큼 100vw가
     넘쳐 가로로도 밀렸다. 켜는 동안만 문서를 잠그고, 나가면 쓰던 값으로 되돌린다. */
  /* 이쪽도 레이아웃 이펙트다(같은 지적) — 지나가는 이펙트면 **첫 프레임은 스크롤바가
     남은 채로** 칠해진다. 그 폭만큼 100vw가 넘쳐 판이 가로로 밀렸다가 다음 프레임에
     제자리로 돌아오는 것이, 전환할 때 한 번 흔들리는 그 몫이다. */
  useLayoutEffect(() => {
    if (!fsOn) return undefined;
    const de = document.documentElement;
    const prevH = de.style.overflow;
    const prevB = document.body.style.overflow;
    /* ★ **스크롤바 자리 예약도 함께 끈다**(지적: "전체화면에서 오른쪽에 스크롤바 부분이
       고정으로 생김") — 문서 뿌리에 `scrollbar-gutter: stable`이 걸려 있어(global.css의
       html 규칙: 스크롤이 생겼다 사라질 때 화면이 안 흔들리게 하는 자다), overflow를
       hidden으로 잠가 스크롤바가 사라져도 그 **자리는 그대로 비워 둔다**. 전체화면
       판은 화면을 통째로 덮는 층이라, 그 15px 남짓이 오른쪽에 붙박이 빈 띠로 남았다.
       판이 떠 있는 동안만 auto로 내리고 나가면 되돌린다. */
    const prevG = de.style.scrollbarGutter;
    /* 가로 넘김 항해도 끈다(지적: "뒤로가기 되는데?") — 크로뮴은 가로로 넘치게 끌면
       뒤/앞으로 간다(overscroll history navigation). 운영체제의 가장자리 손짓과는 딴
       자로, 이쪽은 페이지가 끌 수 있다. 전체화면 동안 가로 끌기는 전부 지도 몫이다. */
    const prevO = de.style.overscrollBehaviorX;
    de.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    de.style.scrollbarGutter = "auto";
    de.style.overscrollBehaviorX = "none";
    return () => {
      de.style.overflow = prevH;
      document.body.style.overflow = prevB;
      de.style.scrollbarGutter = prevG;
      de.style.overscrollBehaviorX = prevO;
    };
  }, [fsOn]);
  /* 무대 크기 — 지도를 이 크기에 맞춰 **덮게**(cover) 깔아야 크롭이 나온다. 화면 회전·
     주소창 여닫힘까지 따라오도록 ResizeObserver로 지켜본다.
     ★ **레이아웃 이펙트**다(같은 지적) — 지나가는 이펙트는 브라우저가 한 번 칠한 **뒤**에
       돈다. 그러면 첫 프레임이 옛 크기로 칠해지고 그다음 프레임에 튄다. 레이아웃
       이펙트는 칠하기 전에 도는 자리라, 재고 다시 그리는 일이 한 프레임 안에서 끝난다.
       (ResizeObserver 쪽은 그대로 비동기다 — 그건 실제로 창이 바뀔 때만 온다.) */
  useLayoutEffect(() => {
    /* 무대는 늘 잰다(요청: 통합) — 예전에는 전체화면일 때만 재고 평소에는 0으로
       비워 뒀다. 이제 프레임에도 같은 무대가 서므로 끌 자리가 없다. */
    /* ★ 무대 크기는 **한 번 실패하면 되살아나야 한다**(증거 사진: 2.1배인데 지도가
       통째로 검고 미니맵 프레임도 없다 — 곧 무대가 0이라는 뜻이다) ──────────────────
       여태 이 효과는 첫 줄에서 `if (!el) return`으로 물러났다. 그러면 그 순간 무대가
       아직 안 붙어 있었을 때(전체화면 포털 이동 중·크기 0으로 접힌 순간) **관찰자도
       안 달고** 끝난다 — 뒤에 무대가 서도 알려 줄 사람이 없어 크기가 0에 얼어붙는다.
       0이면 덮는 폭(fsCoverW)이 0이라 지도가 아예 안 그려지고, 보는 창도 지도 전체로
       나와 미니맵 네모가 상자와 같아진다(=안 보인다). 사진의 두 증상이 한 뿌리다.
       그래서 물러나지 않고 **다음 프레임에 다시 붙는다**. 크기가 0으로 읽힌 동안에도
       계속 다시 읽어, 실제로 설 때 그 값을 잡는다. */
    let raf9 = 0;
    let ro9: ResizeObserver | null = null;
    const read = (ev?: unknown): void => {
      const el9 = stageRef.current;
      if (!el9) return;
      const v = { w: el9.clientWidth, h: el9.clientHeight };
      // 주소창 여닫힘은 안 따라간다(위 stageHold9) — 회전·전체화면 전환 사건만 붙든 값을 갈아 끼운다.
      if (v.w > 0 && v.h > 0 && window.matchMedia?.("(pointer: coarse)").matches) {
        const force9 = ev instanceof Event
          && (ev.type === "orientationchange" || ev.type === "fullscreenchange" || ev.type === "webkitfullscreenchange");
        const m9 = stageHold9.current;
        if (!force9 && m9 && m9.w === v.w && Math.abs(v.h - m9.h) < m9.h * 0.35) {
          if (v.h !== m9.h) viewDiagPush9("stagehold", `${v.h}→${m9.h}`);
          v.h = m9.h;
        } else stageHold9.current = { w: v.w, h: v.h };
      }
      /* ★ 한 번 제대로 잰 뒤의 **0은 안 믿는다**(지적 4단계: "맵이 까맣게 변함. 미니맵
         오버레이 키면 프레임 안 그려져 있음") ──────────────────────────────────────
         그 둘은 한 뿌리다: 지도의 덮는 폭(fsCoverW)과 미니맵의 '보는 창'이 **모두 무대
         크기에서** 나온다. 무대가 0이 되면 지도 상자가 0폭이라 아무것도 안 그려지고
         (까맣다), 창은 지도 전체로 나와 흰 네모가 상자와 같아진다(안 보인다).
         0은 사실이 아니라 **한순간의 사정**이다: 전체화면을 끄면 이 판이 포털에서 제자리로
         옮겨 심기고, 그 사이 잰 값이 0으로 나올 수 있다(붙어 있지 않은 동안).
         그 한순간을 상태에 심으면 지도가 통째로 무너지고, 그다음 리렌더가 없으면
         (멈춰 둔 판) 그대로 남는다.
         그래서 **좋은 값을 쥔 뒤로는 0을 무시하고** 다음 프레임에 다시 잰다. 처음(아직
         아무 값도 없을 때)은 0도 그대로 받는다 — 그때는 그것이 사실이다. */
      const had9 = stageSizeRef.current.w > 0 && stageSizeRef.current.h > 0;
      if ((v.w === 0 || v.h === 0) && had9) {
        raf9 = requestAnimationFrame(read);
        return;
      }
      stageSizeRef.current = v;
      // 같은 값이면 상태를 안 건드린다 — 아래 여러 사건이 겹쳐 와도 헛도는 렌더가 없다.
      setStage((p) => (p.w === v.w && p.h === v.h ? p : v));
      // 아직 0이면 다음 프레임에 또 본다 — 붙는 순간을 놓치지 않는다.
      if (v.w === 0 || v.h === 0) { raf9 = requestAnimationFrame(read); }
    };
    const el = stageRef.current;
    if (!el) {
      // 무대가 아직 없다 — 다음 프레임에 다시 시도한다(물러나면 영영 못 잡는다).
      raf9 = requestAnimationFrame(read);
      return () => cancelAnimationFrame(raf9);
    }
    read();
    /* ★ 전체화면은 크기가 **늦게** 온다(지적: "전체화면 토글 시 미니맵 프레임이 처음에
       안 나오는 현상" · "1배 아닐 때도 그래") ────────────────────────────────────────
       fsOn이 뒤집히는 순간 이 자리는 아직 **옛 크기**다: 전체화면 API는 창을 비동기로
       바꾸고, CSS의 100dvh도 그 뒤에야 새 값이 된다. 그래서 무대 크기가 한 박자 낡고,
       그 값으로 덮는 폭(fsCoverW)을 내면 '보는 창'이 지도 전체(w=h=1)로 나온다 —
       미니맵의 흰 네모가 상자와 같아져 안 보이는 것이 그 순간이다.
       ResizeObserver가 결국 잡아 주지만 그 사이 몇 프레임이 그 꼴이고, 눈에는 "처음에
       안 나온다"로 남는다. 그래서 **창이 바뀌는 그 사건들에서도 다시 잰다**: resize와
       fullscreenchange, 그리고 다음 프레임 한 번(rAF) — 셋 중 무엇이 먼저 와도 그때
       제 크기를 읽는다. read는 같은 값이면 상태를 안 건드리므로 헛돌지 않는다. */
    ro9 = new ResizeObserver(read);
    ro9.observe(el);
    raf9 = requestAnimationFrame(read);
    window.addEventListener("orientationchange", read);
    window.addEventListener("resize", read);
    document.addEventListener("fullscreenchange", read);
    document.addEventListener("webkitfullscreenchange", read);
    return () => {
      ro9?.disconnect();
      cancelAnimationFrame(raf9);
      window.removeEventListener("orientationchange", read);
      window.removeEventListener("resize", read);
      document.removeEventListener("fullscreenchange", read);
      document.removeEventListener("webkitfullscreenchange", read);
    };
    /* ★ **프레임 높이가 바뀌면 그 자리에서 다시 잰다**(지적: "개발자도구가 켜진 상태에서
       요소 선택을 활성화하면 줄어들어") ────────────────────────────────────────────
       그 손짓이 하는 일은 브라우저에게 **레이아웃을 강제로 다시 계산**시키는 것뿐이다.
       그때서야 맞아진다는 것은, 어떤 값이 **낡은 채로 굳어 있다가** 그 계산에 떠밀려
       고쳐졌다는 뜻이다. 여기가 그 자리였다: 무대 크기는 ResizeObserver로만 따라가는데
       그 관찰자는 **다음 프레임에** 온다. 프레임의 높이 예산(frameMaxH)이 뒤늦게 정해질
       때마다 무대는 한 박자 낡은 값으로 남고, 그 사이 덮는 폭(fsCoverW)이 어긋나 판
       아래위에 남는 자리가 생긴다. 예산을 목록에 넣어 **같은 판**에 다시 재게 한다. */
  }, [fsOn, frameMaxH, wide]);
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return undefined;
    /* 업데이터 밖에서 한 번에 계산한다(지적: 줌아웃을 맵 외곽에서 하면 강제로 안쪽
       어딘가로 이동) — 예전엔 setZoom 업데이터 '안'에서 setPan을 불렀는데, 업데이터는
       순수해야 해서 리액트가 재실행하면 커서 고정 보정이 두 번 적용됐다. 한계 죔과
       겹치면 외곽에서 팬이 엉뚱한 안쪽 값으로 튀었다. 지금 값(ref)으로 새 줌·팬을
       같이 셈해 각각 한 번씩만 놓는다. */
    /* 프레임당 한 번만 상태를 놓는다(지적: 줌·드래그 버벅임) — 휠은 초당 수십 번
       튀는데 틱마다 setState면 그때마다 전체 마커 렌더가 돌았다. 목표값을 모아 rAF
       한 번에 반영한다(연타는 pend 기준으로 이어 계산해 커서 고정이 안 깨진다). */
    /* 더블클릭·더블탭 줌은 걷었다(요청: "인포팝업 때문에 더블탭/클릭 줌은 제거") —
       유닛을 눌러 정보 팝업을 여는 것과 같은 손짓이라, 팝업을 두 번 확인하려다 화면이
       확대되고 팝업이 닫히는 일이 잦았다. 확대는 PC 휠과 모바일 핀치 두 길만 남긴다.
       (zoomGate도 함께 필요 없어졌다 — 갈래가 셋일 때 겹침을 막던 빗장이었다.) */
    /* PC 휠 줌 복구(요청) — 없앴던 이유는 버벅임이었다. 원인은 배율 자체가 아니라
       '휠 한 틱마다 setState'였다: 휠은 초당 수십 번 오는데 그때마다 리액트가 마커
       수천 개를 통째로 다시 그렸다. 이제 손짓이 도는 동안은 리액트를 아예 안 건드린다 —
       렌즈 상자의 transform을 직접 써서 합성기(compositor)만 일하게 하고, 휠이 멎은
       뒤(140ms)에 딱 한 번 상태로 굳힌다. 그 사이 zoomRef·panRef는 지금 값을 들고
       있어 더블클릭·드래그 같은 다른 손짓도 어긋나지 않는다. */
    /* 수리(지적: 휠로 조금 한 번 확대되고 마는데다 지도 그림만 커져 맵을 벗어난다) —
       위 방식에 구멍이 둘 있었다.
       ① 재생 중에는 매 프레임 리렌더가 나는데, 렌더마다 하는 zoomRef.current = zoom
          대입이 휠이 방금 올린 배율을 곧바로 옛 상태로 되돌렸다(그래서 한 틱만 먹었다).
          손짓이 도는 동안에는 그 대입을 멈춘다(wheelingRef).
       ② 유닛 캔버스는 렌즈 밖이라 zoom·pan을 '그리기 좌표'로 받는다. 리액트가 굳기
          전까지 캔버스는 옛 배율 그대로여서, 지도 그림만 커지고 유닛은 제자리였다.
          손짓 동안에는 이미 그려진 캔버스를 같은 비율로 옮겨 두고(흐릿하지만 따라온다),
          굳은 뒤 아래 effect가 또렷하게 다시 그리며 그 변환을 걷는다. */
    let wheelTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) < 0.5) return;
      e.preventDefault();
      const lens = lensRef.current;
      if (!lens) return;
      const rect = el.getBoundingClientRect();
      beginGestureXf();
      const z0 = zoomRef.current;
      /* 한 틱에 배율을 곱으로 바꾼다 — 더할 때보다 확대·축소가 대칭이고, 트랙패드의
         잔 델타에도 결이 고르다. 상한은 더블클릭과 같은 게임 화면 배율.
         델타 단위를 먼저 픽셀로 맞춘다(수리) — 브라우저·기기에 따라 휠은 줄(deltaMode 1,
         한 틱에 3쯤)이나 쪽(2)으로도 오는데, 그걸 픽셀로 알고 곱하면 한 틱이 0.5%라
         아무리 굴려도 배율이 안 움직인다. */
      const dy9 = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1);
      /* 감도 0.0016 → 0.0034(요청: "휠 줌 감도 높여야할듯") — 칸이 1·2·4·8·16으로
         벌어지면서 한 칸이 두 배가 됐는데, 옛 감도로는 보통 휠 한 틱(100px)이
         1.17배뿐이라 칸 하나 넘기는 데 서너 번을 굴려야 했다. 0.0034면 한 틱이
         약 1.40배 — 칸 문턱(√2)에 딱 맞아 **한 틱에 한 칸**이 된다. */
      const step = Math.exp(-dy9 * 0.0034);
      /* ★ 굴린 몫은 **연속으로 쌓고**(zoomRaw) 화면에 쓰는 값만 칸으로 끊는다 — 칸 값
         자체에 곱하면 한 틱(약 1.01배)이 다음 칸의 문턱을 못 넘어 제자리로 되돌아온다:
         아무리 굴려도 배율이 안 움직인다. 쌓아 두면 몇 틱 굴린 뒤 문턱을 넘어 다음
         칸으로 딱 떨어진다. */
      const raw0 = zoomRawRef.current > 0 ? zoomRawRef.current : z0;
      const raw1 = Math.min(ZOOM_MAX, Math.max(1, raw0 * step));
      zoomRawRef.current = raw1;
      /* ★ 배율을 **칸으로 끊지 않는다**(지적: "휠도 프레임 단위로 줌되어야 하는데") ──
         여태 여기서 snapZoom으로 1·2·4·8·16 중 하나로 떨궜다. 그러면 굴리는 내내 값이
         **안 바뀌다가** 문턱을 넘는 순간 두 배로 튄다 — 연속 렌더(요청)를 아무리 붙여도
         그릴 새 값이 없으니 화면은 그대로다. 그 스냅이 있던 까닭은 "손짓 중에도 이 값만
         쓰므로 굽는 크기가 안 흔들린다"였는데, 지금은 굽는 크기를 따로 못 박아 둔다
         (zoomCommitRef → paint의 bakeZoom). 곧 스냅이 지키던 몫을 다른 데서 이미 지킨다.
         칸은 여전히 있다 — 마커·자세함 문턱(markerAt·detailAt)과 값 버튼의 눈금이
         그것이고, 그쪽은 연속 배율을 받아도 그대로 판정한다(snapZoom은 그 자리에 남는다). */
      const z1 = raw1;
      const ox = rect.left + rect.width / 2;
      const oy = rect.top + rect.height / 2;
      // 커서 아래의 지도 지점이 그 자리에 남도록 팬을 함께 푼다(더블클릭과 같은 자).
      const ux = (e.clientX - ox - panRef.current.x) / z0;
      const uy = (e.clientY - oy - panRef.current.y) / z0;
      const { x: maxX, y: maxY, yTop: topY } = panLimit(z1);
      const px = Math.min(maxX, Math.max(-maxX, e.clientX - ox - z1 * ux));
      const py = Math.min(topY, Math.max(-maxY, e.clientY - oy - z1 * uy));
      zoomRef.current = z1;
      panRef.current = { x: px, y: py };
      // 렌즈·효과층·유닛 캔버스를 한 벌로(공용 헬퍼) — 굳으면 effect가 다시 맞춘다.
      applyGestureXf();
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => endGestureXf(), 140);
    };
    /* ★ 휠은 **판 전체**가 받는다(지적: "로스터 상시표시 부분이 휠을 먹어버리네") ────
       여태 이 리스너는 지도 상자에만 붙어 있었다. 평소 배치에서는 로스터가 지도 **밖**
       이라 문제가 없었는데, 판을 하나로 합치면서 로스터·도구가 지도 **위에** 얹혔다.
       그 판들은 제 줄이 눌려야 하므로 pointer-events를 받고(선수 줄 = 그 선수 시점),
       그래서 그 위에서 굴린 휠은 지도까지 내려오지 못하고 그대로 죽었다.
       판 뿌리에서 받으면 판 위든 지도 위든 한 자리에서 처리된다. 자리 셈에 쓰는 상자는
       여전히 **지도**(el)다 — 팬은 지도 중심 기준이라 그 값이 바뀌면 안 된다.
       예외 하나: 도구 판은 제 안이 스크롤되므로(overflow:auto) 거기서는 흘려보낸다. */
    const host9 = fsRootRef.current ?? el;
    const onWheelHost = (e: WheelEvent): void => {
      /* ★ **미니맵 위에서 시작한 굴림은 미니맵 것**이다(지적: "미니맵에서 스크롤 시 …
         지금 중점 계산이 잘 안 돼. 그리고 전체화면 미니맵에선 아예 안 먹히는 듯") ──────
         미니맵도 제 손잡이를 달고 거품을 끊지만(그쪽 stopPropagation), 그 하나에만 기대면
         한 자리라도 새면 이 손잡이가 덮어쓴다 — 그리고 이쪽은 커서를 **지도 상자 안으로
         죄므로** 늘 한 구석(미니맵이 앉은 왼쪽 아래)을 축으로 삼는다. 두 자리에서 막는다.
         도구 판과 같은 손이다(제 안이 스크롤되는 자리는 흘려보낸다). */
      if (e.target instanceof Element
        && e.target.closest(".scr-fs-toolpanel, .scr-fs-minipanel, .scr-fs-minimap")) return;
      onWheel(e);
    };
    // passive:false 라야 브라우저의 페이지 스크롤을 막을 수 있다.
    host9.addEventListener("wheel", onWheelHost, { passive: false });
    return () => {
      host9.removeEventListener("wheel", onWheelHost);
      window.clearTimeout(wheelTimer);
    };
    /* ★ 전체화면을 켜고 끄면 **맵 엘리먼트가 갈린다**(지적: "pc에서 전체화면시 휠
       줌안됨") — 지도는 평소 자리와 무대 중 한쪽에만 붙으므로, 켜는 순간 옛 노드가
       사라지고 새 노드가 선다. 마운트 때 한 번만 걸던 이 리스너는 사라진 노드에
       남아 있었다. fsOn이 바뀔 때 다시 건다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsOn]);
  /* 팬 재죔(지적: 줌인아웃하다 맵을 벗어나면 문제) — 팬 한계는 '그때의 맵 상자'로
     계산되는데, 줌 단계·보기 전환(3D 피칭은 세로가 0.74로 눌린다)으로 상자가 변하면
     이미 서 있던 팬이 새 한계를 넘어 맵 가장자리 밖(빈 바탕)이 드러나고 마커가 맵을
     벗어나 그려졌다. 상자가 변할 때마다 팬을 새 한계 안으로 되죈다. */
  /* 맵 상자의 실제 CSS 폭 — 3D 과표본 배수와 원본 그림 승급 판단이 이 값을 쓴다.
     MAP_VIEW_PX(1024)는 넓은 배치의 상한일 뿐이고, 좁은 화면에서는 칸이 정한다. */
  const [mapPx, setMapPx] = useState(0);
  /* (걷음) imgSide — 깔린 <img>의 원본 한 변이었다. 그림이 사라졌다. */
  useEffect(() => {
    const el = mapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setMapPx(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /* 원본 그림 승급(지적: "미니맵 배경이 화질이 너무 안좋아") — 목록으로 내려오는 그림은
     512px 작은 판이다. 이 화면이 실제로 크게 그릴 때, 곧 확대했거나 재생 중이면서 상자가
     화면 픽셀로 560을 넘을 때만 원본(2048px)을 그 한 장 다시 받는다.
     해시마다 한 번만 조르는 것은 훅 안에서 막는다 — 승급이 캐시에 새 객체를 심고 그것이
     이 컴포넌트를 리렌더하므로, 여기서 막으려 들면 무한 루프가 된다. */
  /* (걷음) 그림 승급 — 크게 그릴 때 원본 png를 다시 받던 자리다. 지도는 이제 참값
     지형에서 그 배율로 다시 그린다(벡터) — 갈아 끼울 스냅샷이 없다. */
  /* 지형 대조(지적: "모바일만 그렇네 / 캐시문제같기도") — 지형이 **나중에 구워진** 맵을
     오래 산 탭이 지형 없는 행으로 들고 있으면, 이 화면이 벡터 대신 래스터 그림을 확대해
     흐렸다(폰 사파리는 탭이 며칠씩 산다). 재생 화면이 뜰 때 그런 행만 서버와 한 번
     대조한다 — 지형이 오면 캐시가 갈리고 이 컴포넌트가 벡터층으로 갈아탄다. */
  useEffect(() => {
    if (!grid.terrain) void revalidateReplayMap(grid.hash);
  }, [grid.hash, grid.terrain]);
  /* ★ 이 되죔은 **그리기 전에** 끝나야 한다(지적: "모바일에서 전체화면으로 바꾼 뒤
     우하단쪽을 줌해서 보다가 전체화면을 끄면, 맵의 우하단이 프레임 맨 왼쪽에 그려지고
     나머지는 맵이 아닌 밖이 차지해") ────────────────────────────────────────────────
     값 자체는 맞게 죄고 있었다 — **차례가 늦었다.** 지나가는 이펙트(useEffect)는 화면을
     칠한 **뒤**에 도므로, 전체화면을 끈 그 프레임은 아직 옛 팬으로 칠해진다. 전체화면의
     큰 팬은 작아진 상자에서 한계를 몇 배 넘으므로, 그 한 장이 "지도가 저 멀리 밀려 있고
     나머지는 맵 밖"인 그림이다. 그리고 그 뒤 리렌더가 없으면(멈춰 둔 판) 그대로 남는다.
     레이아웃 이펙트로 올리면 죄는 일이 **칠하기 전에** 끝나 그 한 장이 아예 안 생긴다.
     imperative 붓들(지도·안개·미니맵)이 보는 panRef도 여기서 함께 죈다 — 그쪽은 상태가
     아니라 ref를 읽으므로, 리렌더를 기다리면 또 한 박자 늦는다. */
  useLayoutEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    /* ★ 여유가 없으면 **0으로 되돌린다**(지적: "전체화면 on↔off 간 화면비가 달라서
       위치가 이상하게 어긋나고(맵 외부까지 지도에 보이는 현상) 이럴 땐 드래그도 안 됨")
       ────────────────────────────────────────────────────────────────────────────
       여태 여유가 없으면 여기서 그냥 되돌아갔다. 그런데 여유는 **무대 비**가 정한다:
       전체화면을 켜고 끄면 비가 확 바뀌어, 아까는 끌 여유가 있어 밀어 둔 팬이 이제는
       여유가 0인 자리에서 그대로 남는다. 그 팬만큼 지도가 밀려 바깥(맵 밖)이 드러나고,
       끌어서 되돌리려 해도 드래그 자체가 여유 없음으로 막혀 손도 못 쓴다.
       죌 여유가 없다는 것은 곧 **팬이 0이어야 한다**는 뜻이다 — 되돌아가지 말고 0으로
       놓는다. 이미 0이면 아무 일도 안 한다(같은 값이면 setPan이 새 객체를 안 만든다). */
    if (!panRoom) {
      panRef.current = { x: 0, y: 0 };
      setPan((p) => (p.x === 0 && p.y === 0 ? p : { x: 0, y: 0 }));
      return;
    }
    /* 한계는 팬 한계 한 자리에서 난다(위 panLimit) — 여기서 무대 DOM을 다시 재
       덮는 폭을 손수 셈하던 자리다. 자를 하나로 모으면서 그 셈이 그쪽으로 갔다. */
    const { x: maxX, y: maxY, yTop: topY } = panLimit(zoom);
    const cl9 = (v9: number, m9: number): number => Math.min(m9, Math.max(-m9, v9));
    /* 세로는 위아래 경계가 다르다(위 panLimit의 yTop) — 대칭으로 죄면 위로 끌어 둔
       여유가 여기서 도로 감긴다(배율·무대가 바뀔 때마다 이 되죔이 돈다). */
    const clY9 = (v9: number): number => Math.min(topY, Math.max(-maxY, v9));
    // 붓들이 읽는 ref를 먼저 죈다 — 상태 갱신을 기다리면 한 박자 늦는다(위 주석).
    panRef.current = { x: cl9(panRef.current.x, maxX), y: clY9(panRef.current.y) };
    viewDiagPush9("clamp", `${panRef.current.x.toFixed(1)},${panRef.current.y.toFixed(1)}`);
    setPan((p) => {
      const nx = cl9(p.x, maxX);
      const ny = clY9(p.y);
      return nx === p.x && ny === p.y ? p : { x: nx, y: ny };
    });
    // 전체화면 무대 크기가 바뀌어도 되죈다(크롭 여유가 달라진다).
  }, [zoom, pitched, wide, fsOn, panRoom, stage.w, stage.h]);

  /* 드래그 팬(지적: 확대 후 드래그가 이상함 — 브라우저의 이미지 드래그가 끌려 나왔다)
     — 확대 중에는 드래그로 지도를 민다. 경계 죔은 휠과 같은 식. */
  /* 지도 위에서만 핀치 줌·팬(요청) — 페이지 줌은 도로 막고, 지도(mapRef)에 붙인
     네이티브 두 손가락 처리로 확대·이동한다. 손가락 가운데 점이 고정되도록 pan을
     함께 푼다. 한 손가락 끌기는 기존 pointer 드래그(zoom>1)가 맡는다. */
  /** 렌즈 상자 — 휠 줌이 리액트를 거치지 않고 직접 변환을 쓰는 자리(위 onWheel 주석). */
  const lensRef = useRef<HTMLDivElement | null>(null);
  /** 마법 효과 오버레이(스톰) — 렌즈와 같은 변환을 미러로 받는다(아래 두 자리). */
  const fxLensRef = useRef<HTMLDivElement | null>(null);
  /** 효과 시트가 지금 **레이아웃으로** 안고 있는 배율 — 손짓 미러가 이 값과의 비만큼만
   *  transform을 건다(그 사정은 아래 시트 주석에). */
  const fxSheetZRef = useRef(1);
  /** 지도 벡터층의 붓(요청: "확대 축소시 … 맵을 실시간으로 그리기") — 손짓 중에
   *  부모가 이 붓을 쥐고 손끝 배율로 배경을 다시 굽는다. */
  const mapPaintRef = useRef<((z: number, p: { x: number; y: number }) => void) | null>(null);
  /** 안개 층의 붓 — 손짓 중에도 지도와 **같은 프레임에** 따라오게 한다(지적: "줌시
   *  맵은 변하는데 시야안개는 안변해서 이상함"). 벡터라 다시 그리는 삯이 거의 없어
   *  배율 갈무리 없이 매번 손끝 값으로 곧장 그린다. */
  const fogPaintRef = useRef<((z: number, p: { x: number; y: number }, ov?: FogOverride) => void) | null>(null);
  /** 붓 틱이 마지막으로 안개 층에 넘긴 것 — 같은 판이면 다시 안 칠한다(안개 칠은 등고선·원 채우기라 공짜가 아니다). */
  const fogTickRef9 = useRef<{ vis: Float32Array | null; ver: number | undefined; explored: Uint16Array | null; tq: number; z: number; px: number; py: number; at: number }>({ vis: null, ver: undefined, explored: null, tq: -1, z: 0, px: 0, py: 0, at: 0 });
  /** ★ 그리는 붓 하나(재설계) — 유닛·안개 캔버스를 칠하는 것은 paintFnRef9뿐이다. React effect·장 도착·탐색·거울 갱신은
   *  여기로 "칠해 달라"고만 하고, 다음 rAF에 한 장으로 모은다. 재생 틱이 돌면 그 틱이 곧 칠하므로 아무것도 안 한다. */
  const paintReqRef9 = useRef(0);
  const requestPaint9 = useCallback((fog9 = false): void => {
    if (fog9) fogTickRef9.current.z = -1;   // 안개도 반드시(층이 새로 서거나 바뀜)
    if (clockRef.current) return;
    if (paintReqRef9.current) return;
    paintReqRef9.current = requestAnimationFrame(() => {
      paintReqRef9.current = 0;
      brushSrc9 = "req";
      paintFnRef9.current?.(tLiveRef9.current);
    });
  }, []);
  // 렌더마다 — 멈춘 채 무언가(거울·토글·크기·탐색) 바뀌었으면 붓 하나가 한 장 칠한다. 재생 중엔 무동작.
  useEffect(() => { requestPaint9(); });
  const requestFogPaint9 = useCallback((): void => requestPaint9(true), [requestPaint9]);
  // 굽기 일꾼이 판을 돌려주면 멈춘 화면도 한 장 다시 칠한다(위 BAKE_REPAINT9) — 재생 중이면 requestPaint9가 무동작이다.
  useEffect(() => { BAKE_REPAINT9.fn = () => requestPaint9(); return () => { BAKE_REPAINT9.fn = null; }; }, [requestPaint9]);
  /** 미니맵 붓(요청: 드래그·줌 중에도 프레임이 따라온다) — 안개와 같은 규약이다.
   *  평소 배치와 전체화면 미니맵은 서로 배타라 붓 하나를 나눠 쓴다. */
  const miniPaintRef = useRef<((z: number, p: { x: number; y: number }) => void) | null>(null);
  /** 미니맵을 마지막으로 다시 그린 시각 — 손짓 중에는 이 시계로 뜸하게 그린다(위 applyGestureXf). */
  const miniAtRef9 = useRef(0);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  /* ★ 추적 중에는 **추적이 눈의 주인**이다(지적: "추적모드 고장 — 지도가 늘 정가운데") ────────────────────────────
     보기의 진실은 zoomRef·panRef 하나인데(재설계), 추적의 팬은 상태가 아니라 렌더가 그때그때 내는 값(trackView·위
     trackLockRef)이다. 렌더가 상태로 ref를 덮던 줄을 걷으면서 그 값이 눈에 안 실려, 붓은 굳은 팬(대개 0,0)으로
     칠했다 — 지도가 가운데에 붙박였다. 추적이 켜져 있는 동안은 그 값을 곧장 눈에 쓴다(손짓은 trackLockRef가
     막으므로 다투지 않는다). */
  if (trackLockRef.current) panRef.current = trackLockRef.current;
  /** ★ 보는 눈 하나(재설계) — 보기의 진실은 zoomRef·panRef뿐이다. React 상태 zoom·pan은 UI(단추·미니맵·링크·한계)용
   *  거울이고 어떤 붓도 상태를 읽지 않는다. 상태를 바꾸는 모든 자리는 이 함수를 지난다(ref를 먼저 쓰고 거울을 맞춘다). */
  /** 링크가 준 자리를 **아직 우리가 쥐고 있나** — 사람이 보기를 건드리면 그 순간 놓는다.
   *  ★ 까닭(지적: "모바일 배치에선 잘되는데 PC 배치에선 안 돼") ─────────────────────────
   *  받은 자리를 **한 번만** 앉히는 것이 화근이었다. 그 한 번이 언제인지는 배치가 정하는데,
   *  PC 배치는 늦게 선다: 넓은 배치(wide)는 부모 폭을 관찰자로 재고서야 켜지고(그 전까지는
   *  좁은 배치의 상자다), 그때 무대·덮는 폭·팬 한계가 통째로 다시 난다. 앉힌 뒤에 자가
   *  바뀌므로, 맞게 앉혔어도 그 값이 새 상자에서는 딴 자리다.
   *  그래서 '한 번'을 버리고 **붙들었다가 배치가 바뀔 때마다 다시 앉힌다**. 받은 자리는
   *  픽셀이 아니라 **지도 분수**(cx·cy)라 어느 상자에서든 같은 곳을 가리킨다 — 자가 바뀌면
   *  분수에서 픽셀을 새로 내면 그만이다. 사람이 손을 대면(끌기·핀치·휠·미니맵·추적) 그
   *  순간 놓아, 우리가 남의 보기를 되돌리는 일은 없다. 못 놓은 채 오래 남지도 않게 **배치가
   *  처음 선 뒤로** 5초에서 끊는다 — 배치는 그 안에 다 서고, 한참 뒤의 창 크기 바뀜까지
   *  되돌리면 그게 더 이상하다. 시계를 마운트가 아니라 '선 뒤'로 재는 까닭은, 늦게 서는
   *  자리에서는 서기도 전에 시간이 다 되어 도로 제자리이기 때문이다. */
  const linkHoldRef9 = useRef<{ cx: number; cy: number; until: number } | null>(null);
  const setView9 = useCallback((z9: number, p9: { x: number; y: number }, keepLink9 = false): void => {
    // 사람이 낸 보기다 — 링크가 쥐고 있던 자리를 놓는다(위 linkHoldRef9).
    if (!keepLink9) linkHoldRef9.current = null;
    zoomRef.current = z9; panRef.current = p9; setZoom(z9); setPan(p9);
  }, []);
  /* 배치가 다시 설 때마다 링크의 자리를 **다시 앉힌다**(위 linkHoldRef9) — 죔(clamp)
     레이아웃 이펙트보다 **뒤에** 서야 한다(선언 차례가 곧 도는 차례다): 죔이 먼저 옛 팬을
     새 한계로 자르고, 그다음 여기서 분수로 새로 낸다. */
  useLayoutEffect(() => {
    const hold9 = linkHoldRef9.current;
    if (!hold9) return;
    // 추적이 몰고 있으면 놓는다 — 카메라와 서로 밀 까닭이 없다.
    if (trackRaw) { linkHoldRef9.current = null; return; }
    const el9 = mapRef.current;
    const bw9 = el9?.offsetWidth ?? 0;
    const bh9 = el9?.offsetHeight ?? 0;
    /* 배치가 아직 안 섰으면 **시계도 안 센다** — 5초는 '선 뒤로 5초'라는 뜻이다. 여기서
       시간으로 먼저 놓아 버리면, 늦게 서는 자리(PC)에서는 놓은 뒤에 배치가 서서 도로 제자리다. */
    if (bw9 < 4 || bh9 < 4 || coverRef.current.w <= 0) return;
    // 배치가 처음 선 순간부터 시계를 건다(0은 아직 안 걸린 것).
    if (hold9.until === 0) hold9.until = Date.now() + 5000;
    else if (Date.now() > hold9.until) { linkHoldRef9.current = null; return; }
    const z9 = zoomRef.current;
    const lim9 = panLimit(z9);
    const nx9 = Math.min(lim9.x, Math.max(-lim9.x, (0.5 - hold9.cx) * bw9 * z9));
    const ny9 = Math.min(lim9.yTop, Math.max(-lim9.y, (0.5 - hold9.cy) * bh9 * z9));
    if (Math.abs(nx9 - panRef.current.x) < 0.5 && Math.abs(ny9 - panRef.current.y) < 0.5) return;
    viewDiagPush9("link", `${nx9.toFixed(1)},${ny9.toFixed(1)}`);
    linkLog9(`다시 ${panRef.current.x.toFixed(0)},${panRef.current.y.toFixed(0)} → ${nx9.toFixed(0)},${ny9.toFixed(0)} 상자 ${bw9}x${bh9} 한계 ${lim9.x.toFixed(0)}/${lim9.y.toFixed(0)}`);
    setView9(z9, { x: nx9, y: ny9 }, true);
    // panLimit·setView9는 안 바뀌는 클로저다 — 목록에 넣으면 선언 전(TDZ)에 읽힌다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.w, stage.h, fsOn, pitched, wide, zoom, panRoom, trackRaw]);
  /** 미니맵 등이 '지금 보기'를 읽는 창 — 늘 ref를 비춘다(손끝 보기 xfLive를 따로 두던 것을 걷었다). */
  const viewLive9 = useMemo(() => ({ get current(): { z: number; p: { x: number; y: number } } { return { z: zoomRef.current, p: panRef.current }; } }), []);
  /** 임시 변환 손짓(휠·드래그·핀치)이 도는 중인가 — 도는 동안은 상태로 덮지 않는다
   *  (위 onWheel ① 주석). 이름이 wheeling이던 것을 세 손짓이 함께 쓰며 바꿨다. */
  const xfGestureRef = useRef(false);
  /** 지금 도는 손짓의 '대기 델타 반영' 함수 — 드래그·핀치가 시작할 때 걸고, endGestureXf가 끝내기 직전에 부른다. */
  const pendFlushRef9 = useRef<(() => void) | null>(null);
  /** 캔버스가 마지막으로 **그려진** 배율·팬 — 손짓의 임시 변환은 이 기준에서의
   *  델타다. 굴림 커밋이 들어오면 아래 effect가 이 기준만 갈아 끼운다. */
  const xfBaseRef = useRef({ z: 1, x: 0, y: 0 });
  /** 유닛 캔버스의 붓 — UnitLayer가 렌더마다 여기 넣어 둔다(아래 painter prop). 손짓
   *  프레임에서는 리액트를 안 거치고 이 붓으로 캔버스만 다시 그린다. */
  const unitPaintRef = useRef<((z: number, p: { x: number; y: number }, bz: number) => void) | null>(null);
  /** 지금 손끝의 보기 — 손짓이 도는 동안만 값이 있다. UnitLayer는 이 값이 있으면
   *  props(굳은 상태) 대신 이것으로 그린다: 손짓 중에도 재생 틱이 리렌더를 내는데,
   *  그때 굳은 지 오래인 배율로 한 장 그리면 화면이 한 프레임 뒤로 튄다. */
  /** 캔버스를 마지막으로 **그린** 시각(ms) — 손짓 중 다시 그리는 삯을 여기서 조인다. */
  const xfPaintAtRef = useRef(0);
  /** 휠이 굴린 몫을 연속으로 쌓아 두는 자리(칸으로 끊기 **전**의 배율) — 0이면 아직
   *  안 쌓았다는 뜻이라 그때의 상태 배율에서 시작한다(위 onWheel 참고). */
  const zoomRawRef = useRef(0);
  /** 마지막 한 장이 든 시간(ms) — 다음 다시 그리기까지의 사이를 이 값으로 늘린다.
   *  느린 기기·난전에서는 저절로 뜸해지고(그 사이는 CSS 변환이 잇는다), 빠른 자리
   *  에서는 촘촘해진다. 붙박이 주기로는 이 둘을 한 값으로 못 맞춘다. */
  const xfPaintMsRef = useRef(8);
  /** 마지막으로 본 손끝 배율과 그 배율이 **바뀐** 시각 — 지금 손짓이 '배율을 바꾸는
   *  중'인지 가리는 자다. 팬만 하는 손짓과는 다시 그리는 규칙이 다르다(아래). */
  const xfLastZRef = useRef(0);
  const xfZoomAtRef = useRef(0);
  /** 손끝이 마지막으로 **움직인** 시각 — 무거운 자리에서 '아직 끄는 중인가'를 가른다(아래 xfPaintNow의 ★). */
  const xfMoveAtRef9 = useRef(0);
  /** 손끝이 멈추면 한 장 그리려고 걸어 둔 시계(0이면 없음) — 움직임이 끊기면 rAF도 안 오므로 시계가 대신 부른다. */
  const xfIdleRef9 = useRef(0);
  /** 이번 프레임에 다시 그리기를 예약해 둔 rAF 손잡이(0이면 없음) — 휠·포인터 사건은
   *  한 프레임에 여러 번 올 수 있는데, 그때마다 캔버스를 그리면 같은 그림을 두세 번
   *  그리는 셈이다. 한 프레임에 한 장으로 묶는다. */
  const xfRafRef = useRef(0);
  /** 유닛 캔버스에 마지막으로 건 임시 변환 문자열(위 xfBase 기준 델타) — 손짓 중 틱이 기준 자리에 다시 칠한 뒤 **같은
   *  값**을 도로 건다(붓이 걷어 버리므로). 값이 안 바뀌면 합성기가 움직일 일이 없다. 재기준(다시 칠함)은 ""로 되돌린다. */
  const xfCvXfRef = useRef(XF_ID9);
  /** ★ 안개 캔버스가 **그려져 있는 보기**(지적: "드래그나 키보드로 지도 이동 시 안개가 늦게
   *  따라오고 튄다") ─────────────────────────────────────────────────────────────────────
   *  안개는 손짓 중 150ms마다만 다시 칠한다(FOG_GEST_MS9). 그 사이는 "CSS가 같은 그림을
   *  밀어 준다"가 규약인데, 붓이 한 장 칠할 때마다 안개 캔버스의 임시 변환을 **항등으로
   *  되돌리고** 있었다 — 유닛과 같은 취급을 한 것이다. 유닛은 그 프레임에 다시 칠했으니
   *  항등이 맞지만, 안개는 안 칠한 프레임이 대부분이라 옛 그림이 새 자리에 그냥 서 버린다.
   *  그것이 '늦게 따라오다 튄다'의 정체다(늦은 것이 아니라 **안 밀린** 것이고, 다음 칠에
   *  제자리로 튄다).
   *  그래서 안개는 제 기준을 따로 든다 — 임시 변환은 늘 '지금 보기 − 이 기준'이다. */
  const fogXfRef9 = useRef({ z: 0, x: 0, y: 0 });
  /** 캔버스가 한 장 그려질 때마다 — 그 보기가 곧 임시 변환의 기준이다(자식이 부른다). */
  const onUnitPainted = useCallback((z9: number, p9: { x: number; y: number }): void => {
    xfBaseRef.current = { z: z9, x: p9.x, y: p9.y };
    xfPaintAtRef.current = performance.now();
  }, []);
  /** 굳은 배율 — 판을 굽는 크기는 언제나 이 값이다(손짓 중에도 안 변한다).
   *  ★ 굽는 크기는 **칸으로 올림**한다(배율을 연속으로 바꾸면서 생긴 자리) — 배율이
   *    칸에서 풀리자 굳을 때마다 굽는 크기가 3.17배·3.42배처럼 제각각이 되어, 종류마다
   *    쌓아 둔 판이 전부 헛것이 된다(빗나감 100%). 옛 snapZoom이 지키던 것이 바로
   *    이 몫이었다.
   *    **올림**인 까닭: 가장 가까운 칸으로 떨구면 3.2배를 2배 판으로 늘려 찍어 흐리다.
   *    위 칸으로 구우면 늘 줄여 찍으므로 어느 배율에서도 안 뭉갠다. 칸이 다섯뿐이라
   *    판 종류도 그대로 다섯 벌이다. */
  const zoomCommitRef = useRef(zoom);
  zoomCommitRef.current = bakeStepOf(zoom);
  /** 지도 상자를 지금 잘라야 하나 — 손짓 중에는 굳은 상태(zoom)가 아니라 손끝 배율로
   *  정해야 한다(지적: "피시에서 확대하면 배경 미니맵이 틀을 벗어나서 확대됐다가 다시
   *  자리에 맞게 잘림"). 자르기 조건 자체는 JSX 스타일과 같은 것을 쓴다. */
  /** 배킹을 다시 채운다 — 기억을 버리고 이번 프레임에 처음부터 그린다(위 LOST9의 ★).
   *  ★ `hard9`를 가른 까닭(신고: "다시 돌다가 또 멈춰") ─────────────────────────────────────
   *    첫 판은 되살릴 때마다 판(스프라이트) 캐시를 통째로 버렸다. 그런데 배킹을 잃는 자리는
   *    **메모리 압박**이고, 판을 다 버리면 그 직후에 수백 장을 다시 굽는다 — 압박이 가시기도 전에
   *    다시 크게 집는 셈이라 그대로 되돌이(멈춤 → 복구 → 또 멈춤)가 된다.
   *    그래서 판 버리기는 **확실한 신호**(contextlost/restored · 처음 알아챈 손실)에만 하고,
   *    '아직 비어 있으니 다시 그려 보자'는 되풀이에서는 지도만 다시 굽는다. */
  const recoverCanvas9 = useCallback((hard9: boolean): void => {
    LOST9.n += 1;
    LOST9.at = pNow();
    MAPVEC_LOST9.n += 1;              // 지도 벡터: '이미 구웠다'는 기억을 버린다
    if (hard9) dropPlates9();         // 유닛·건물·효과 판도 캔버스라 함께 비었을 수 있다
    fogTickRef9.current.z = -1;       // 안개: 같은 보기여도 다시 칠한다
    xfBaseRef.current = { z: 0, x: 0, y: 0 };
    fogXfRef9.current = { z: 0, x: 0, y: 0 };
    brushSrc9 = "req";
    paintFnRef9.current?.(tLiveRef9.current, true);
    mapPaintRef.current?.(zoomRef.current, panRef.current);
    miniPaintRef.current?.(zoomRef.current, panRef.current);
  }, []);
  /* 배킹 손실을 **사파리가 알려 줄 때** 곧장 받는다(contextlost/restored는 16.4+) — 못 받는 판에서는
     아래 긴 틈 뒤의 한 점 검사가 받는다. 지도 상자 안의 캔버스 전부에 건다. */
  useEffect(() => {
    const root9 = mapRef.current;
    if (!root9) return undefined;
    const on9 = (): void => { recoverCanvas9(true); };
    const list9 = root9.querySelectorAll<HTMLCanvasElement>("canvas");
    for (let i9 = 0; i9 < list9.length; i9 += 1) {
      list9[i9].addEventListener("contextrestored", on9);
      list9[i9].addEventListener("contextlost", on9);
    }
    return () => {
      for (let i9 = 0; i9 < list9.length; i9 += 1) {
        list9[i9].removeEventListener("contextrestored", on9);
        list9[i9].removeEventListener("contextlost", on9);
      }
    };
  }, [recoverCanvas9]);
  /* 긴 틈(그리기가 0.7초 넘게 멎었다) 뒤에는 **한 점을 찍어 본다** — 비었으면 잃은 것이다.
     붓 틱이 표를 세우고(lostCheckRef9) 여기 rAF가 검사한다: 검사와 복구를 붓 한가운데서 하면
     그 프레임이 또 길어진다. */
  useEffect(() => {
    let raf9 = 0;
    const loop9 = (): void => {
      raf9 = requestAnimationFrame(loop9);
      if (!LOSTQ9.want && !lostCheckRef9.current) return;
      LOSTQ9.want = false;
      lostCheckRef9.current = false;
      const root9 = mapRef.current;
      if (!root9) return;
      LOST9.probe += 1;
      /* 비어 있으면 되살린다 — **처음 한 번만** 판까지 버리고(위 hard9), 그 뒤 되풀이는 지도만. */
      if (canvasLost9(root9)) recoverCanvas9(LOST9.n === 0);
    };
    raf9 = requestAnimationFrame(loop9);
    return () => cancelAnimationFrame(raf9);
  }, [recoverCanvas9]);
  /* 탭이 뒤로 갔다 오면 배킹을 잃었기 쉽다(웹킷이 안 보이는 탭의 그림을 먼저 거둔다) — 돌아올 때 한 번 본다. */
  useEffect(() => {
    const on9 = (): void => { if (!document.hidden) LOSTQ9.want = true; };
    document.addEventListener("visibilitychange", on9);
    window.addEventListener("pageshow", on9);
    return () => {
      document.removeEventListener("visibilitychange", on9);
      window.removeEventListener("pageshow", on9);
    };
  }, []);
  /* 타이머 자(위 TICKM9) — 그리기와 무관한 큐에서 100ms마다 돌며 제 틈을 잰다. */
  useEffect(() => {
    let last9 = pNow();
    TICKM9.at = last9;
    const id9 = window.setInterval(() => {
      const now9 = pNow();
      const dt9 = now9 - last9;
      last9 = now9;
      TICKM9.n += 1;
      if (dt9 > TICKM9.worst) TICKM9.worst = dt9;
      /* ★ 3초마다 **스스로 살핀다**(신고: "금방 돌아오진 않아" · 지도가 까만 채로 남는다) —
         배킹을 잃은 뒤 그림이 안 돌아오는 자리는 둘이다: 우리가 안 그렸거나, 다시 그리려다
         **배킹 확보에 실패**했거나(압박이 가시기 전). 앞엣것은 한 번 되살리면 끝이지만 뒤엣것은
         압박이 가실 때까지 계속 실패한다 — 그러니 한 번 보고 마는 것이 아니라 빈 동안 되풀이해야
         한다. 검사는 1×1 읽기 둘이고, 되살리기는 3초 쉼이 있어 되돌이가 안 난다(canvasLost9). */
      if (TICKM9.n % 30 === 0) LOSTQ9.want = true;
      /* 10초마다 메모리 어림 한 번(위 MEMTR9) — 새는 자리가 있나를 수로 본다. */
      if (TICKM9.n % 100 === 0) {
        let ex9 = 0;
        for (const f9 of wFramesRef.current.values()) ex9 += f9.buf.byteLength;
        for (const sn9 of fogSnapsRef9.current) {
          ex9 += (sn9.fog?.visSrc?.byteLength ?? 0) + (sn9.fog?.explored?.byteLength ?? 0)
            + (sn9.fog?.visNow?.byteLength ?? 0);
        }
        memTrendTick9(mapRef.current, ex9 / 1048576);
      }
    }, 100);
    return () => window.clearInterval(id9);
  }, []);
  /* #noblend·#noblur가 켜져 있으면 지도 상자에 표를 단다(위 NO_BLEND9·NO_BLUR9) — CSS 한 규칙씩이 섞임·흐리기를
     통째로 끈다. 표는 둘 다 붙을 수 있다(#noblend,noblur). */
  useEffect(() => {
    const el9 = mapRef.current;
    if (!el9) return undefined;
    const cls9: string[] = [];
    if (NO_BLEND9) cls9.push("scr-noblend");
    if (NO_BLUR9) cls9.push("scr-noblur");
    if (cls9.length === 0) return undefined;
    el9.classList.add(...cls9);
    return () => el9.classList.remove(...cls9);
  }, []);
  const clipBoxRef = useRef({ fsCover: false, pitched: false });
  clipBoxRef.current = { fsCover: fsCoverW > 0, pitched };
  /* (걷어냄) 렌더가 상태로 ref를 덮던 줄 — 재설계(보는 눈 하나): 보기의 진실은 zoomRef·panRef뿐이고 상태는 거울이다.
     상태를 바꾸는 자리는 전부 setView9를 지나 ref를 먼저 쓴다. */
  /* 손짓 임시 변환 한 벌(드래그 버벅임 수리) — 휠이 쓰던 수법을 셋이 같이 쓴다:
     손짓이 도는 동안 렌즈·효과층·유닛 캔버스를 CSS 변환으로만 움직여 **합성기만**
     일하게 하고(리액트 리렌더 0), 커밋은 굴림(300ms)과 놓을 때뿐이다.
     읽는 값이 전부 ref라 정체성이 안정돼 어느 effect에서 불러도 된다. */
  const applyGestureXf = useCallback((repaint = true): void => {
    /* ★ 손짓이 끝난 뒤의 늦은 부름은 무시한다(실측: 감기 중 React 붓 팬 (−634.4,−1091.6) = 옛 손끝, 틱 붓 panRef 별개) ──
       드래그·핀치는 마지막 한 장을 rAF에 실어 두는데, 손을 떼는 처리(endGestureXf)가 그 rAF보다 먼저 돌면 뒤늦게 온 rAF가
       xfLive를 되살리고 panRef를 옮겼다. 정지·감기 중엔 상태가 안 바뀌어 xfLive가 지워질 기회가 없어, React 붓(xfLive)과
       틱·도착 붓(panRef)이 다른 자리를 번갈아 칠했다. 손짓이 살아 있지 않으면 여기서 아무것도 안 한다. */
    if (!xfGestureRef.current) return;
    /* ★ 추적 중에는 **옮기는 것만** 막는다(요청: "드래그나 wasd 이동 가장자리 스크롤등
       다 막아야해" · "줌은 변경 가능하게") ────────────────────────────────────────────
       미는 길은 넷이다 — 드래그·wasd·가장자리 밀기·핀치. 그런데 넷 다 이 한 자리를
       지나 화면을 움직이므로(begin/apply/endGestureXf), 여기서 자리만 추적이 잡아 둔
       값으로 되돌리면 네 길이 한꺼번에 막힌다. 배율(z1)은 안 건드리므로 휠·핀치·
       더블탭 확대는 그대로 산다.
       입구에서도 한 번 더 막는다(아래 드래그 시작·wasd 키·가장자리 밀기) — 여기서만
       막으면 손짓은 계속 돌면서 아무 일도 안 하는, 헛도는 rAF가 남는다. */
    const lock9 = trackLockRef.current;
    if (lock9) panRef.current = lock9;
    const lens = lensRef.current;
    const z1 = zoomRef.current;
    const px = panRef.current.x;
    const py = panRef.current.y;
    // 손끝이 움직인 시각 — 이 자리는 값이 바뀌었을 때만 불린다(드래그 rAF의 '안 움직였으면 안 그린다').
    xfMoveAtRef9.current = performance.now();
    /* 배율이 실제로 바뀐 시각을 적어 둔다 — 아래 다시 그리기가 '지금 줌 중인가'를
       이 값으로 판단한다(손가락이 잠깐 멈춘 프레임까지 줌으로 쳐 준다: 250ms). */
    if (z1 !== xfLastZRef.current) {
      xfLastZRef.current = z1;
      xfZoomAtRef.current = performance.now();
    }
    if (lens) {
      lens.style.setProperty("--mz", `${z1}`);
      lens.style.transform = z1 > 1 || px !== 0 || py !== 0
        ? `translate(${px}px, ${py}px) scale(${z1})` : "";
      /* 효과 시트는 확대를 **레이아웃으로** 안고 있다(그쪽 주석) — 손짓 동안만, 굳은
         배율과의 비만큼 임시 transform을 건다. 이 순간은 흐려도 된다: 지도 벡터층도
         손짓 중에는 늘려 붙이고 굳을 때 다시 굽는다(같은 흥정). */
      if (fxLensRef.current) {
        fxLensRef.current.style.transform =
          `translate(-50%, -50%) translate(${px}px, ${py}px) scale(${(z1 / Math.max(0.01, fxSheetZRef.current)).toFixed(4)})`;
      }
    }
    /* 지도 상자 자르기도 손끝을 따라간다(지적: PC 확대에서 배경 미니맵이 틀 밖으로
       나갔다가 굳은 뒤에야 잘린다) — JSX의 overflow는 **굳은 zoom**만 보는데, 손짓
       중에는 그 값이 아직 1이라 렌즈가 상자 밖으로 흘러넘쳤다. 굳을 때 리액트가 쓰는
       값과 똑같은 값을 여기서 미리 쓴다(그래서 커밋에 이음매가 없다). */
    const box = mapRef.current;
    if (box) {
      const cb = clipBoxRef.current;
      const ov9 = cb.fsCover ? "visible" : (z1 > 1 || cb.pitched ? "hidden" : "");
      if (box.style.overflow !== ov9) box.style.overflow = ov9;
      /* 확대 중엔 세로 스크롤도 지도 몫이다(지적: 드래그·팬 뒤 떨림) — .scr-motion-map은 pan-y라, 확대한 채 세로로
         끌면 브라우저가 페이지 스크롤로 채가(touchmove가 cancelable이 아니게 되고 pointercancel이 온다) 주소창이
         움직이고 판이 들썩였다. 1배로 돌아오면 CSS의 pan-y로 되돌린다. */
      const ta9 = z1 > 1 ? "none" : "";
      if (box.style.touchAction !== ta9) box.style.touchAction = ta9;
    }
    /* ★ 유닛·안개 캔버스와 지형·미니맵도 **여기서 같은 순간에** 옮긴다(지적: "지형도 마지막에 툭 한 번 움직인다") ──
       실측(팬 프로브): 끄는 동안 렌즈는 −220인데 유닛·안개·지형은 −210으로 **늘 한 프레임 뒤**였다. CSS 이동을 값비싼
       다시 그리기와 함께 rAF로 미뤄 둔 탓이다. 놓는 순간 뒤처진 셋이 한꺼번에 따라붙는 것이 그 '툭'이었다.
       변환 걸기와 지형 자리 옮기기는 값이 거의 안 드니(스타일 한 줄) 렌즈와 나란히 지금 한다. 값비싼 다시 그리기만
       아래 rAF에 남는다. */
    {
      const b9 = xfBaseRef.current;
      const s9 = z1 / b9.z;
      const cv9 = mapRef.current?.querySelector<HTMLCanvasElement>(".scr-motion-unitlayer");
      const fg9 = mapRef.current?.querySelector<HTMLCanvasElement>(".scr-motion-fog");
      const xf9 = s9 === 1 && px === b9.x && py === b9.y ? XF_ID9
        : `translate(${(px - s9 * b9.x).toFixed(2)}px, ${(py - s9 * b9.y).toFixed(2)}px) scale(${s9.toFixed(4)})`;
      xfCvXfRef.current = xf9;
      if (cv9) { cv9.style.transformOrigin = "center"; cv9.style.transform = xf9; }
      /* 안개는 **제 기준**으로 민다(위 fogXfRef9) — 유닛과 다른 박자로 칠해지므로 같은
         델타를 걸면 그만큼 어긋난 자리에 선다. */
      if (fg9) {
        /* ★ 밀어 놓고도 **상자를 못 덮으면 그 자리에서 한 장 칠한다**(지적: 판을 한 뼘 키운 뒤에도
           "아직 빈 띠가 보여") ─────────────────────────────────────────────────────────────────
           여유(fogPad9)는 한 프레임의 움직임을 담자는 것인데, 빠른 던지기(플릭)는 한 프레임에
           그 여유를 넘는다 — 6배에서 손끝 3000px/s면 프레임당 90px이고 폰 여유는 67px이다.
           넘은 그만큼이 곧 안 칠한 띠다. 그러니 여유에 기대지 말고 **재서** 넘으면 지금 칠한다:
           칠하는 삯은 이제 등고선 갈무리 + 길 하나 + 원 몇이라(위 군살 덜기) 손짓 프레임에 얹어도
           되는 몫이고, 넘는 프레임에서만 든다. 이러면 빈 띠는 구조적으로 안 난다. */
        /* ★ 안개도 손끝을 **그대로** 따라간다(지시: "1순위는 손끝 제스처와 화면이 일치하게 움직이는 것") —
           한때 '덮는 자리 밖으로는 안 민다'로 잘라 봤지만 그건 첫째 규칙을 어기는 것이라 걷었다.
           ★ 여기서는 **칠하지 않는다**(지시: "핀치나 드래그가 좀 무거워졌다") — 손끝 사건에 캔버스 일을 얹으면
             입력 처리가 그만큼 밀린다. 칠하는 것은 손짓 rAF 하나이고, 거기서 **유닛보다 먼저** 칠한다
             (지시: "안개를 유닛보다 먼저 세워줘"). 변환·막 띠는 값이 안 드는 일이라 여기서 손끝과 같은
             프레임에 건다. */
        void fg9;
        const gap9 = box ? fogXfApply9(box, fogXfRef9.current, z1, px, py, clipBoxRef.current.pitched) : 0;
        if (gap9 > 0.5) FOGM9.gap = Math.max(FOGM9.gap, gap9);

      }
      mapPaintRef.current?.(z1, panRef.current);
      /* ★ 미니맵은 손짓 중 **뜸하게** 다시 그린다(요청: "이동 시 더 빠르게 시점 변경") ────────────────────────
         이 한 줄이 손짓 프레임마다 미니맵 캔버스를 통째로 다시 그린다(지형 판 + 개체 점 수백). 그런데 미니맵이
         손짓 중에 말하는 것은 '지금 어디를 보나'(흰 네모)뿐이고, 그건 초당 열 번이면 눈에 끊겨 보이지 않는다.
         남는 몫은 그대로 손끝을 받는 데 쓰인다 — 렌즈·지형·캔버스 옮기기는 여기서 계속 매 프레임 돈다. */
      const mnow9 = performance.now();
      if (mnow9 - miniAtRef9.current >= 100) {
        miniAtRef9.current = mnow9;
        miniPaintRef.current?.(z1, panRef.current);
      }
    }
    if (!repaint) return;
    /* 캔버스 다시 그리기는 **프레임당 한 번**으로 묶는다(요청: 줌 연속 렌더) — 휠은
       한 프레임에 두세 번 올 수 있고 핀치의 pointermove는 더 잦다. 사건마다 그리면
       같은 그림을 겹쳐 그리느라 삯만 든다. rAF에 걸어 두면 그 프레임의 마지막 손끝
       값 하나로 한 장만 그린다 — 이것이 '부하 안 걸리는 연속 렌더'의 첫 조임쇠다. */
    if (xfRafRef.current) return;
    xfRafRef.current = requestAnimationFrame(() => {
      xfRafRef.current = 0;
      xfPaintNow();
    });
  }, []);
  /** 손짓 중 한 장 — rAF 안에서만 불린다(위). 지금 손끝 값(refs)으로 그린다. */
  const xfPaintNow = useCallback((): void => {
    const z1 = zoomRef.current;
    const px = panRef.current.x;
    const py = panRef.current.y;
    /* 유닛 캔버스는 렌즈 밖(그리기 좌표)이라 CSS 변환만으로는 못 따라온다 — 뷰포트
       크기 한 장을 밀면 민 만큼 가장자리가 비고(지적: "드래그시 어느 부분이 통째로
       없어지거나 한 모델 안에서 잘리거나"), 축소 손짓에서는 사방에 빈 띠가 남는다.
       그렇다고 손짓 프레임마다 다시 그리면 이번엔 삯이 문제였다(지적: "드래그/확대
       축소/각도변경시 버벅임과 딜레이 심함") — 60Hz로 걷는 캔버스 한 장은 폰에서
       프레임을 통째로 먹는다.
       그래서 **둘을 섞는다**: 프레임 사이는 CSS 변환으로 미끄러지고(합성기만 일한다),
       움직인 몫이 쌓이면 그때 한 번 다시 그린다. 다시 그리는 순간 기준(xfBase)이 지금
       보기로 갈아 끼워지므로 CSS 변환은 0으로 돌아간다 — 빈 가장자리는 '마지막으로
       그린 뒤 움직인 만큼'을 절대 못 넘고(아래 문턱: 24px·2%), 그 사이는 한 프레임
       (24ms)이라 눈에 남지 않는다. */

    /* 지도 배경도 **매 프레임** 부른다(지적: "줌 시 맵이 로딩이 안개보다 느림") —
       안개만 문턱 밖으로 빼 두었더니 이번엔 둘이 반대로 어긋났다. 배경 쪽은 매 프레임
       불러도 값이 안 든다: 벡터층이 맨 앞에서 '이미 구워 둔 창 안인가'를 보고 곧장
       빠져나가고(그쪽 bakedRef), 실제로 다시 굽는 것은 배율 칸(√2)이 바뀌는 몇 번뿐이다. */
    // (옮김) 지형·미니맵·캔버스 변환은 applyGestureXf가 렌즈와 같은 프레임에 한다(그쪽 ★). 여기는 값비싼 다시 그리기만.
    const cv = mapRef.current?.querySelector<HTMLCanvasElement>(".scr-motion-unitlayer");
    const b = xfBaseRef.current;
    const s9 = z1 / b.z;
    const moved = Math.abs(px - b.x) + Math.abs(py - b.y);
    const now9 = performance.now();
    const gap9 = now9 - xfPaintAtRef.current;
    /* 다시 그리는 사이는 **지난번에 든 시간**이 정한다 — 한 장이 8ms면 45ms마다(22Hz),
       60ms나 드는 난전이면 150ms마다다. 프레임 예산의 5분의 1 넘게 그리기에 쓰지 않는
       다는 뜻이라, 손짓이 느려지지 않는다(지적: "못쓸정도로 버벅"). 그 사이는 CSS
       변환이 잇고, 빈 가장자리는 '마지막으로 그린 뒤 움직인 몫'을 못 넘는다. */
    /* ★ **배율이 바뀌는 동안에는 연속으로 그린다**(요청: "줌은 휠이나 손가락 핀치로
       줌할 땐 연속적으로 렌더링해줘 — 부하 안 걸릴 방법은 찾아야 함") ───────────────
       왜 팬과 규칙이 다른가: 팬은 CSS translate가 **정확한 대역**이다(그린 그림을 그대로
       민 것과 픽셀이 같다). 그래서 뜸하게 그려도 티가 안 나고, 티가 나는 것은 민 만큼
       비는 가장자리뿐이다. 줌은 아니다 — CSS scale은 이미 그린 그림을 **늘리는** 것이라
       늘린 동안 모델이 흐려지고 획 굵기가 어긋난다. 그 흐림은 배율이 커질수록 커진다.
       부하는 무엇이 막나 — 세 겹이다.
         ① 프레임당 한 장(위 rAF 묶기).
         ② **지난 한 장이 든 시간이 다음 사이를 정한다.** 4ms짜리면 4.8ms 뒤(=60Hz에서
            매 프레임), 30ms짜리면 36ms 뒤(≈28Hz)다. 곧 그리기에 쓰는 몫이 늘 절반 밑이라
            느린 기기에서도 손짓 자체가 안 느려진다. 붙박이 주기로는 이 둘을 못 맞춘다.
         ③ 판(스프라이트)은 **굳은 배율로 구운 것을 그대로 쓴다**(zoomCommit) — 진짜
            비싼 일은 그리기가 아니라 종류마다 판을 다시 굽는 것이고, 그건 손을 뗄 때 한다.
       팬만 하는 손짓은 종전 규칙 그대로다(45ms 바닥·움직임 12px 문턱). */
    /* ★ 팬도 **연속으로 그린다**(요청: "팬·드래그시 실시간으로 모델을 그릴 순 없나 · 안개도") ────────────────────
       재생 중에는 붓이 이미 매 프레임 유닛·안개를 다시 그린다. 그런데 팬만은 문턱(45ms 바닥·12px)으로 솎고 있어,
       끄는 동안에는 재생보다 오히려 인색했다 — 새로 드러나는 가장자리가 그 문턱만큼 비어 보인 까닭이다. 옛 문턱은
       팬 한 프레임이 **React 커밋 한 번**이던 시절의 값이고, 지금 붓은 React 밖에 있다(재설계).
       줌이 쓰던 자기 조절을 그대로 쓴다: 다음 사이 = 직전 한 장이 든 시간 × 1.2. 곧 그리기에 쓰는 몫이 늘 절반
       밑이라 느린 기기에서도 손짓이 안 느려지고, 빠른 기기에서는 매 프레임이 된다. 그 사이는 CSS 이동이 잇는다. */
    /* ★ 입체의 **원근 중심을 손짓 프레임마다** 손끝에 맞춘다(위 LIVE_VIEW_MS9의 ★ — 흔들림의 까닭과 셈) ────
       그리기를 미루는 무거운 프레임에서도 보낸다: 미루는 것은 이쪽 붓의 일이고 설계도를 짓는 것은 워커의
       일이라 서로 막을 까닭이 없다. 보내기 자체는 postMessage 한 번이라 이 실마리에 얹히는 값이 없다.
       ★ 왜 '붓이 그 장의 시점으로 그리고 CSS가 나머지를 메우는' 길이 아닌가 — 그 둘은 **같은 그림**이다.
         붓의 배율·팬은 옮기고 늘릴 뿐이라, 어느 보기로 그리고 그 차를 CSS로 메우든 최종 화소는 똑같다.
         갈리는 것은 오직 **설계도의 사영 중심**이다: 흔들림은 그 중심이 계단으로 따라오는 데서 나므로,
         고치는 자리도 거기(보내는 간격) 하나뿐이다. */
    postLiveView9();
    const need9 = Math.min(400, xfPaintMsRef.current * 1.2);
    const moved9 = moved >= 1 || Math.abs(s9 - 1) >= 0.0015;
    /* ★ **한 장이 무거우면 끄는 동안은 안 그린다**(지적: "3D 보기에서 드래그·팬 시 바로바로 시점이 바뀌지 않고
       놓아야만 바뀐다") ────────────────────────────────────────────────────────────────────────────────────
       까닭은 자기 조절(need9)의 사각지대다. 그 셈은 '그리기에 쓰는 몫을 절반 밑으로'까지만 지키는데, 한 장이
       200ms면 절반을 지켜도 **한 장을 그리는 200ms 동안 주 실마리가 통째로 막힌다**. 그 사이 들어온 손가락
       움직임(pointermove)도, 그것이 걸 CSS 미끄러짐도 다 밀린다 — 그래서 끄는 내내 화면이 굳어 있다가 손을
       떼면 한꺼번에 따라오는 꼴이 된다. 3D가 유독 그런 것은 한 장 값이 평면의 몇 배라서다(줄마다 원근을 먹인
       모델 + 지형 다시 굽기).
       무거운 자리에서는 **미끄러짐이 그리기보다 낫다**: 그리기를 미루면 주 실마리가 비어 손끝을 바로 따라간다.
       미룬 그림은 두 자리에서 따라잡는다 — ① 손끝이 한 박자(140ms) 쉬면, ② 마지막으로 그린 뒤 상자의 4분의 1을
       넘게 밀었으면(빈 가장자리의 상한). 손을 떼는 순간은 endGestureXf가 최종 보기로 한 장 칠하므로 그대로다.
       가벼운 자리(평면·한산한 판)는 종전대로 실시간이다 — 문턱을 넘지 않으면 이 갈래를 안 탄다. */
    /* ★ 실시간 원근을 켠 손짓은 **매 프레임 다시 그린다**(지적: "왕복이 둘 다 있는데 가벼운 장면은 덜하고
       무거운 장면은 심한 차이") ─────────────────────────────────────────────────────────────────────
       그 '덜하다/심하다'가 곧 까닭이다. 다시 그리는 사이는 CSS로 미는데, 미는 것은 **순수한 옮기기**라
       그 사이의 원근이 얼어 있다: 멀리 있는 몸은 실제보다 덜(혹은 더) 움직였다가 다시 그리는 순간 제자리로
       튄다 — 한 유닛으로 보면 그것이 좌우 왕복이고, 폭은 **다시 그린 뒤 흐른 시간 × 손 속도**다. 무거우면
       그 사이가 기니 폭이 커진다.
       그래서 이 손짓에서는 미룸도 박자 조절도 걷는다 — 프레임마다 다시 그리면 얼어 있는 구간 자체가 없다.
       대가는 무거운 자리에서 프레임이 떨어지는 것인데, 그것이 이 깃발(?live3d=1)의 뜻이다. */
    const live3d9 = liveViewOkRef9.current;
    const box9 = mapRef.current?.offsetWidth ?? 0;
    if (!live3d9 && xfPaintMsRef.current >= XF_HEAVY_MS9
      && !(box9 > 0 && moved >= box9 * XF_FAR_FRAC9)
      && now9 - xfMoveAtRef9.current < XF_STILL_MS9) {
      FOGM9.gest = true; fogBin9().defer += 1;
      /* 유닛은 미뤄도 **안개는 칠한다**(위 붓의 ★) — 값이 2.2ms라 미룸의 까닭(주 실마리를 비운다)에
         걸리지 않고, 이 갈래가 곧 빈 띠가 나던 자리다. */
      brushSrc9 = "xf";
      paintFnRef9.current?.(tLiveRef9.current, false, true);
      if (!xfIdleRef9.current) {
        xfIdleRef9.current = window.setTimeout(() => {
          xfIdleRef9.current = 0;
          if (xfGestureRef.current) xfPaintNow();
        }, XF_STILL_MS9);
      }
      return;
    }
    if ((live3d9 || gap9 >= need9) && moved9) {
      /* 판은 굳은 배율(zoomCommit)로 구운 것을 그대로 쓴다 — 블릿 배율만 달라지므로
         손짓 한 번에 종류마다 판을 다시 굽는 일이 없다(그것이 진짜 삯이다).
         기준 갈아끼움·변환 걷기는 그린 쪽(onUnitPainted·paint)이 함께 한다. */
      if (xfIdleRef9.current) { window.clearTimeout(xfIdleRef9.current); xfIdleRef9.current = 0; }
      const t0 = performance.now();
      brushSrc9 = "xf";
      paintFnRef9.current?.(tLiveRef9.current, true);   // 붓 하나 — 손끝 보기로 다시 칠하고 변환을 걷는다(재기준)
      /* 배경도 **손끝 배율로** 다시 굽는다(요청: "확대 축소시 모델은 그렇다쳐도 맵을
         실시간으로 그리기") — 여태 배경은 굳은 zoom만 보고 있어서, 확대하는 내내
         1배로 구운 그림이 CSS로 늘어난 채(흐릿하게) 따라오다가 손을 떼야 또렷해졌다.
         벡터층이 배율을 √2 칸으로 갈무리하므로 손짓 한 번에 두세 번만 다시 굽는다. */
      xfPaintMsRef.current = performance.now() - t0;
      xfMsRef9.v = xfPaintMsRef.current;   // 붓이 읽는다(위 xfMsRef9) — 배킹을 내릴지 가리는 자.
      /* 실측 자에 적는다(위 ② live3dOn9) — 다음 손짓의 판정이 이 값에서 난다.
         **기울인 손짓만** 적는다: 평면 한 장은 입체보다 훨씬 싸므로, 2D로만 끌던 표본으로
         입체를 판정하면 버거운 기기까지 켜 준다(재는 짐과 판정할 짐이 달라진다). */
      if (pitchDegRef9.current > 0) noteXfMs9(xfPaintMsRef.current);
      /* ★ 한 장이 두 프레임을 넘으면 실시간 원근을 **이 손짓 동안 접는다**(지적: "무거운 장면에선 여러 번
         왔다갔다") ────────────────────────────────────────────────────────────────────────────────
         실시간 원근은 '얼어 있는 구간이 없을 때'만 성립하는데, 한 장이 33ms를 넘으면 그리는 사이가 곧 그
         구간이 된다(그 사이는 CSS가 순수한 옮기기로 밀어 원근이 얼어 있다). 그러면 다시 그릴 때마다 튀고,
         무거울수록 자주·크게 튄다.
         접는 방향은 **한쪽뿐이다** — 한 번 접으면 이 손짓이 끝날 때까지 안 편다. 켰다 껐다 하면 재는 값이
         곧 그 조치의 결과라 진동한다(배킹 몫에서 이미 겪었다). 접으면 워커에 새 원점을 안 보내므로 원근이
         그 자리에서 멎고, 남은 손짓은 종전대로 CSS가 매끄럽게 민다 — 왕복 대신 '원근은 그대로, 자리는 따라옴'
         이 된다. 손을 떼면 그 프레임에 제자리로 맞춰진다. */
      if (liveViewOkRef9.current && xfPaintMsRef.current > 33) liveViewOkRef9.current = false;
      // 손짓 한 장이 든 시간 — 계측 도구가 읽는다(#diag=draw의 자와 같은 자).
      SCR_DIAG.xfms = Math.round(xfPaintMsRef.current);
      return;
    }
    /* 유닛을 안 그리는 프레임(박자·안 움직임)에도 **안개는 프레임마다** 칠한다(위 붓의 ★). */
    brushSrc9 = "xf";
    paintFnRef9.current?.(tLiveRef9.current, false, true);
  }, []);
  /** 손짓 시작 — 이미 도는 중이면 기준을 안 건드린다(휠→드래그 이어짐 등). */
  const beginGestureXf = useCallback((): void => {
    if (xfGestureRef.current) return;
    /* ★ 화면을 움직이면 인포 팝업은 닫는다(요청: "인포 팝업 열린 상태에서 드래그·줌 시 창 닫혀야 하고 키보드로
       이동·줌 시에도") — 휠·핀치·드래그(슬롭 지난 뒤)·가장자리 밀기·WASD가 모두 이 문을 지나므로 여기 한 곳이면
       된다. 단추·키보드 배율(zoomStep9·zoomTo·fsWheelZoom)은 이 문을 안 지나 따로 닫는다. */
    closePicked9();
    // 사람의 손짓이다 — 링크가 쥐고 있던 자리를 여기서 놓는다(위 linkHoldRef9).
    linkHoldRef9.current = null;
    xfGestureRef.current = true;
    xfBackK9.k = 1;   // 새 손짓은 제 배킹에서 시작한다 — 무거우면 그 안에서 내려간다(위 ★)
    /* ★★ 원근을 손끝에 맞추는 일은 **가벼운 자리에서만** 한다(계측: 배율 6·입체·949기에서
       손짓 한 장이 23 → **240ms**로 뛰었다 — 미룸으로 떨어져 끄는 동안 화면이 아예 멎고, 놓는
       순간 쌓인 장이 몰려 한동안 출렁였다. 앞 0.0초·7장 · 시계차 −0.7초가 그 자국이다) ────────
       까닭은 원근 중심이 움직이면 **판 열쇠가 통째로 흔들리기** 때문이다: 유닛마다의 좌우 시점(vq)이
       중심에서 나오므로, 중심이 프레임마다 밀리면 개체들이 시점 칸을 계속 넘나들며 새 판을 부른다
       (그 판에서 2초에 유닛 125장·건물 168장을 굽고 건물 판 188장을 버렸다). 사영을 다시 하는 값이
       아니라 **다시 굽는 값**이 벽이다.
       ★ 그 폭풍은 이제 **밀림 기준을 얼려**(아래 shearOxRef9 · PitchGeom9.sox) 끊었다 — 끄는 동안 판
         열쇠가 한 톨도 안 바뀌므로, 좁혀 뒀던 문(덜어내기 단 0 · 최악 프레임 40ms)을 연다. 남는 값은
         장을 풀고 칠하는 몫뿐이라 난전에서도 견딜 만하다. 다만 아주 무거운 자리(최악 프레임 120ms
         이상 — 굽기가 아직 밀려 있거나 기기가 버거운 때)는 그대로 막는다: 거기서는 원근보다 손끝을
         따라가는 것이 먼저다. 한 손짓 안에서는 안 바꾼다(도중에 뒤집으면 진동한다). */
    /* 밀림 기준을 지금 원점에 못 박는다 — 끄는 동안 판 열쇠가 안 흔들리게(PitchGeom9.sox의 ★).
       끝나면 endGestureXf가 풀어, 손을 뗀 그 프레임에 제 기울기로 한 번 맞춰진다. */
    shearOxRef9.current = pitchGeomLiveRef9.current?.().ox ?? null;
    liveViewOkRef9.current = live3dOn9() && pitchDegRef9.current < 90;
    xfPaintAtRef.current = performance.now();
    zoomRawRef.current = zoomRef.current;
    xfBaseRef.current = { z: zoomRef.current, x: panRef.current.x, y: panRef.current.y };
  }, []);
  /* (걷어냄) 굴림 커밋 — 손짓 중 300ms마다 상태를 굳히던 자리다. 그때는 캔버스가
     CSS로 밀려만 다녀서 빈 가장자리를 메우려면 주기적으로 굳히는 수밖에 없었는데,
     그 한 번이 **걷기 루프·건물 루프·JSX·판 재굽기**를 통째로 부르는 값비싼 커밋이라
     드래그 중간중간 화면이 걸렸다(지적: "드래그/확대 축소시 버벅임과 딜레이 심함").
     이제 손짓 중 캔버스는 제 붓으로 다시 그려지므로(위 applyGestureXf) 굳힐 까닭이
     없다 — 상태는 손을 놓을 때 한 번만 굳는다. */
  /** 손짓 끝 — 마지막 값을 굳힌다. 렌더가 refs를 다시 상태에 맞춘다. */
  const endGestureXf = useCallback((): void => {
    if (!xfGestureRef.current) return;
    shearOxRef9.current = null;   // 밀림 기준을 푼다 — 아래 마지막 한 장이 제 기울기로 그린다(sox의 ★)
    /* ★ 대기 중인 마지막 한 걸음을 먼저 반영한다(지적: "드래그시 다 못 가서 그리고 툭 이동") — 드래그·핀치는 마지막
       움직임을 rAF에 실어 두는데, 손을 떼면 그 rAF는 무시된다(applyGestureXf의 문지기). 안 반영하면 그만큼 못 미친
       자리에서 굳는다. 각 손짓이 제 반영 함수를 걸어 둔다(pendFlushRef9). */
    pendFlushRef9.current?.();
    pendFlushRef9.current = null;
    // 미뤄 둔 한 장의 시계는 걷는다 — 아래에서 최종 보기로 곧장 칠한다(위 XF_HEAVY_MS9).
    if (xfIdleRef9.current) { window.clearTimeout(xfIdleRef9.current); xfIdleRef9.current = 0; }
    /* ★ 지형·렌즈·미니맵도 여기서 최종 보기로 옮긴다(지적: "지형도 마지막에 툭 한 번 움직인다") — 대기 델타를 반영하면
       panRef만 바뀌고 화면은 마지막 rAF 자리에 남는다. 그러면 유닛만 아래에서 최종 자리로 가고 지형은 커밋이 올 때까지
       한 걸음 뒤에 있다가 툭 따라온다. 손짓 중 프레임마다 하던 일(applyGestureXf + mapPaint·miniPaint)을 여기서 마지막으로
       한 번 하면, 지형·렌즈·유닛·안개가 **한 블록 안에서** 같은 자리에 선다. */
    applyGestureXf(false);
    mapPaintRef.current?.(zoomRef.current, panRef.current);
    miniPaintRef.current?.(zoomRef.current, panRef.current);
    xfGestureRef.current = false;
    if (mapRef.current) fogBandSet9(mapRef.current, null);   // 손을 뗐다 — 막 띠를 걷는다(위 ★)
    viewDiagPush9("commit", `z${zoomRef.current.toFixed(2)} ${panRef.current.x.toFixed(1)},${panRef.current.y.toFixed(1)}`);
    /* 예약해 둔 한 장은 걷는다 — 손을 뗀 뒤에 도착하면 아래 커밋이 그릴 그림을 한 번
       더 그리는 셈이고, 그 사이에 컴포넌트가 사라지면 없는 캔버스를 잡는다. */
    if (xfRafRef.current) { cancelAnimationFrame(xfRafRef.current); xfRafRef.current = 0; }
    /* ★ 최종 보기로 **여기서 곧장** 한 장 칠한다(같은 지적) — 여태 이 일을 React 커밋(렌즈 effect)에 맡겼는데, 그 사이
       (폰에서 수십~수백 ms) 지형은 최종 자리에 가 있고 유닛 캔버스는 마지막 걸음만큼 뒤에 남아 있었다. 그것이 '다 못 가서
       그렸다가 툭'이다. 붓 하나를 재기준으로 부르면 내용이 최종 자리로 가고 임시 변환이 걷힌다 — 커밋 타이밍과 무관하다. */
    brushSrc9 = "commit";
    paintFnRef9.current?.(tLiveRef9.current, true);
    setZoom(zoomRef.current);
    setPan({ ...panRef.current });
  }, []);
  /* 3초 미조작이면 숨긴다(요청) — 깨우는 손짓은 기기마다 다르다:
       · PC — 마우스를 **가장자리로** 가져갈 때만(요청). 화면 한복판에서 마우스가
         움직인다고 조작부가 뜨면, 보고 있는 장면을 계속 가린다.
       · 모바일 — 지도의 **빈 곳**을 톡 누를 때만(위 fsToggleUi). 손가락이 지도를 끄는
         동안 조작부가 튀어나오면 그게 더 방해다. 그렇게 손으로 연 것은 손으로 닫는다 —
         3초 시계를 안 건다(fsStickRef).
     조작부 자체를 만지는 동안에는 계속 깨어 있다(그 안의 pointerdown이 fsWake를 부른다). */
  useEffect(() => {
    /* ★ 처음 꼴은 **어디서나 닫힘**이다(요청: 통합 · "전체화면 처음 들어갈 때 오버레이는
       비활") — 여태 평소 배치에서는 늘 켠 채였는데, 판이 하나가 된 지금 그러면 프레임에서
       도구 판이 지도를 덮은 채로 열린다. 지도를 보러 온 자리라 첫 화면을 판이 덮을
       까닭이 없다 — 아이콘이나 엔터로 연다.
       ※ 프레임에서 fsUi가 꺼져도 **아래 조종부(재생바)는 안 사라진다** — 사라지는 것은
         전체화면일 때뿐이다(CSS: .scr-fs-layer.is-fs.is-idle .scr-fs-ui). 3초 자동 숨김도
         전체화면 몫이다(아래 갈래) — 프레임은 판을 연 사람이 닫을 때까지 열어 둔다. */
    if (!fsOn) {
      window.clearTimeout(fsHideRef.current);
      fsStickRef.current = false;
      setFsUi(false);
      return undefined;
    }
    window.clearTimeout(fsHideRef.current);
    fsStickRef.current = false;
    setFsUi(false);
    /* ★ 가장자리는 이제 **화면을 민다**(요청: "피시 전체화면에서 상하좌우 모서리는
       그방향으로 이동(부드럽게) / 기존 오버레이 노출은 클릭으로만") ─────────────────
       원작의 화면 밀기(edge scroll) 그대로다: 마우스가 화면 끝 띠에 들어가 있는 동안
       그쪽으로 계속 흐르고, 깊이 들어갈수록 빠르다(띠 안에서의 깊이에 비례).
       조작부를 깨우던 몫은 걷었다 — 이제 지도를 **클릭**해야 뜬다(fsToggleUi). 떠 있는
       조작부 위에 마우스가 있을 때만 계속 깨어 있게 두는데, 그건 버튼을 겨누는 동안
       사라지면 누를 수가 없어서다.
       미는 일은 손짓 한 벌(beginGestureXf·applyGestureXf·endGestureXf)을 그대로 탄다 —
       드래그와 같은 길이라 캔버스도 같은 규칙으로 다시 그려지고, 띠에서 나오면 그때
       한 번 상태로 굳는다. */
    /* 띠와 속도(지적: "엣지스크롤 너무 뚝뚝 끊기고 느려") — 첫 판은 폭 52px에 속도가
       **깊이에 정비례**(0~1100px/s)라, 띠에 갓 들어간 자리에서는 초당 몇십 픽셀로
       기어갔다. 원작의 화면 밀기는 띠에 닿는 순간부터 제 속도가 붙는다.
       그래서 밑값을 준다: 닿으면 곧바로 520px/s, 끝까지 밀면 1900px/s. 띠도 52 → 68px
       으로 넓혀 화면 끝에서 손이 조금 흔들려도 안 끊긴다. */
    const EDGE = 68;          // 미는 띠 폭(px)
    const EDGE_MIN = 520;     // 띠에 닿는 순간의 초당 픽셀
    const EDGE_MAX = 1900;    // 띠 안쪽 끝에서의 초당 픽셀
    let mx9 = -1;
    let my9 = -1;
    let edgeOn = false;
    let vx9 = 0;                 // 지금 실제로 미는 속도(px/s) — 겨눈 속도로 완화해 붙는다
    let vy9 = 0;
    let raf9 = 0;
    let last9 = 0;
    const onMove = (e: PointerEvent): void => {
      if (e.pointerType !== "mouse") return;
      mx9 = e.clientX;
      my9 = e.clientY;
      /* 이미 떠 있는 조작부 위에 마우스가 있으면 계속 깨어 있는다 — 버튼을 겨누는
         동안 사라지면 누를 수가 없다. */
      if (e.target instanceof Element && e.target.closest(".scr-fs-menubtn")) return;
      /* ★ **이미 떠 있을 때만** 깨어 있게 한다(지적: "엣지 투 스크롤이 안 먹을 때도 있어")
         ────────────────────────────────────────────────────────────────────────────────
         뜻은 '버튼을 겨누는 동안 사라지지 않게'였는데, 조건에 '떠 있나'가 빠져 있어 **닫힌
         조작부를 hover만으로 열었다**. 조종부 줄은 화면 아래 끝에 붙어 있으므로, 아래로
         밀려고 마우스를 내리는 그 길이 곧 그 판 위다 — 닿는 순간 판이 뜨고, 판이 뜨면
         엣지 스크롤은 꺼진다(아래 uiOn9). 아래·오른쪽으로 밀 때만 안 먹던 까닭이다. */
      if (fsUiRef.current && e.target instanceof Element && e.target.closest(".scr-fs-ui")) fsWake();
    };
    const step9 = (now9: number): void => {
      raf9 = requestAnimationFrame(step9);
      const dt9 = last9 ? Math.min(0.05, (now9 - last9) / 1000) : 0;
      last9 = now9;
      const el9 = mapRef.current;
      if (!el9 || mx9 < 0 || dt9 <= 0) return;
      /* 추적 중에는 가장자리로도 안 민다(요청) — 밀던 중이었으면 그 손짓을 접는다. */
      if (trackLockRef.current) {
        if (edgeOn) { edgeOn = false; vx9 = 0; vy9 = 0; endGestureXf(); }
        return;
      }
      /* 조작부가 떠 있으면 안 민다(요청: "전체화면 피시에서 오버레이 활성화시 엣지
         스크롤 끄기") — 오버레이 판은 화면 좌·우·아래 끝에 붙어 있어, 버튼을 겨누러
         가는 길이 곧 미는 띠 안이다. 그래서 로스터나 슬라이드 바를 만지려고만 해도
         지도가 그쪽으로 흘러갔다. 판이 떠 있는 동안은 '보는 중'이 아니라 '만지는
         중'이므로 밀기를 멈춘다. 이미 붙어 있던 속도는 아래 감속으로 부드럽게 선다
         (겨눈 속도를 0으로 두는 것과 같은 길이다). */
      const uiOn9 = fsUiRef.current;
      const vw9 = window.innerWidth;
      const vh9 = window.innerHeight;
      /* 띠 안에서의 깊이(0~1) — 오른쪽 끝이면 화면을 오른쪽으로 보내야 하므로 팬은
         음수다(렌즈를 왼쪽으로 민다). */
      const ux9 = uiOn9 ? 0 : mx9 < EDGE ? (EDGE - mx9) / EDGE
        : mx9 > vw9 - EDGE ? -(EDGE - (vw9 - mx9)) / EDGE : 0;
      const uy9 = uiOn9 ? 0 : my9 < EDGE ? (EDGE - my9) / EDGE
        : my9 > vh9 - EDGE ? -(EDGE - (vh9 - my9)) / EDGE : 0;
      /** 깊이 u(부호 포함)를 겨눈 속도로 — 밑값에서 시작해 안쪽 끝에서 최대다. */
      const vel9 = (u8: number): number => (u8 === 0 ? 0
        : Math.sign(u8) * (EDGE_MIN + (EDGE_MAX - EDGE_MIN) * Math.abs(u8)));
      /* 겨눈 속도로 **미끄러지듯** 붙는다(요청: "드래그 수준으로 부드럽게") — 여태
         띠에 닿는 순간 520px/s가 그대로 꽂히고 나오는 순간 0으로 뚝 떨어져, 시작과
         끝이 계단이었다. 지수 완화(시정수 0.11초)로 따라가면 붙고 떨어지는 자리가
         손으로 끌던 관성처럼 이어진다. 띠 밖에서는 겨눈 속도가 0이라 같은 식이 곧
         감속이 된다 — 그래서 멈춘 뒤에야 손짓을 닫는다. */
      const TAU9 = 0.11;
      const k9 = 1 - Math.exp(-dt9 / TAU9);
      vx9 += (vel9(ux9) - vx9) * k9;
      vy9 += (vel9(uy9) - vy9) * k9;
      if (Math.abs(vx9) < 1.5 && Math.abs(vy9) < 1.5) {
        vx9 = 0;
        vy9 = 0;
        if (edgeOn) { edgeOn = false; endGestureXf(); }
        return;
      }
      if (!edgeOn) { edgeOn = true; beginGestureXf(); }
      const lim9 = panLimit(zoomRef.current);
      panRef.current = {
        x: Math.min(lim9.x, Math.max(-lim9.x, panRef.current.x + vx9 * dt9)),
        y: Math.min(lim9.yTop, Math.max(-lim9.y, panRef.current.y + vy9 * dt9)),
      };
      applyGestureXf();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf9 = requestAnimationFrame(step9);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf9);
      if (edgeOn) endGestureXf();
      window.clearTimeout(fsHideRef.current);
    };
  }, [fsOn, fsWake, beginGestureXf, applyGestureXf, endGestureXf, panLimit]);
  /* 렌즈 변환은 리액트 스타일이 아니라 이 effect가 쓴다(위 렌즈 상자 주석) — 손짓
     동안의 직접 변환과 싸우지 않게. 캔버스에 걸어 뒀던 임시 변환도 여기서 걷는다:
     자식(UnitLayer)의 그리기 effect가 먼저 돌아, 이 시점엔 이미 새 배율로 또렷하다. */
  useEffect(() => {
    /* 손짓 중의 굴림 커밋(드래그 버벅임 수리) — 방금 이 상태로 캔버스가 다시 그려졌으니
       (자식 effect가 먼저 돈다) **기준만** 이 상태로 갈아 끼우고 남은 델타를 다시 건다.
       여기서 상태값으로 덮어 되돌리면 다음 pointermove까지 한 프레임 튄다. 자식 그리기와
       이 리베이스가 같은 effect 묶음(페인트 사이)에서 돌아 화면에는 이음매가 없다. */
    if (xfGestureRef.current) {
      /* 캔버스는 자식(UnitLayer)이 방금 이 렌더에서 **손끝 값(xfLive)으로** 그렸고,
         기준 갈아끼움과 임시 변환 걷기도 그때 함께 끝났다(onUnitPainted). 여기서 할
         일은 렌즈·효과층·상자 자르기를 지금 손끝에 맞추는 것뿐이다. */
      applyGestureXf(false);
      return;
    }
    /* 손짓이 끝났고 상태도 이 렌더로 굳었다 — 이제 손끝 보기를 걷는다(위 endGestureXf
       주석). 자식은 이 렌더에서 이미 그렸는데, 그때 쓴 손끝 값과 지금 상태가 같은
       값이라 그림은 한 톨도 안 바뀐다. */
    const lens = lensRef.current;
    if (lens) {
      /* 배율이 1이어도 **팬은 걸어야 한다**(지적: "전체화면시 맵은 안움직이고 모델들만
         움직여 드래그하면") — 전체화면은 지도를 화면보다 크게 깔아 1배에서도 끌 수
         있는데, 이 줄이 `zoom > 1`일 때만 변환을 걸어 지도 그림만 제자리에 있었다
         (유닛 캔버스는 팬을 그리기 좌표로 받으므로 저 혼자 움직였다). 배율이든 팬이든
         움직인 것이 있으면 건다. */
      lens.style.transform = zoom > 1 || pan.x !== 0 || pan.y !== 0
        ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : "";
      /* 효과 시트 — 굳은 값은 **레이아웃**이 안는다(리액트 인라인과 같은 값·같은 셈).
         여기서도 한 번 더 쓰는 까닭은 렌즈와 같다: 전체화면 전환으로 상자가 새로 나면
         인라인이 아직 옛 상자 값일 수 있어, 굳은 값으로 못을 다시 박는다. */
      if (fxLensRef.current) {
        const fl9 = fxLensRef.current;
        fl9.style.width = `${zoom * 100}%`;
        fl9.style.height = `${zoom * 100}%`;
        fl9.style.transform = `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`;
        fxSheetZRef.current = zoom;
      }
    }
    const cv = mapRef.current?.querySelector<HTMLCanvasElement>(".scr-motion-unitlayer");
    /* ★ 걷기 전에 **칠한다**(지적: "팬 드래그 뒤 조금 이전 위치의 그림") — 틱이 몰 때(driven) 방금 렌더의 UnitLayer
       effect는 안 칠했다. 캔버스 내용은 아직 기준(xfBase) 자리인데 여기서 변환만 걷으면 다음 틱(폰에서 수백 ms)까지
       옛 자리 그림이 보였다가 튄다. 기준이 상태와 다르면 지금 한 장 칠해(붓이 기준을 맞추고 변환을 걷는다) 이음매를 없앤다. */
    /* 굳은 보기와 캔버스에 그려진 보기가 다르면 한 장(전체화면 전환·각도 바뀜처럼 손짓 밖에서 상자가 갈리는 길) —
       손짓 끝은 endGestureXf가 이미 곧장 칠했으므로 여기서는 대개 건너뛴다. */
    {
      const b9 = xfBaseRef.current;
      if (b9.z !== zoom || b9.x !== pan.x || b9.y !== pan.y) {
        brushSrc9 = "commit";
        paintFnRef9.current?.(tLiveRef9.current, true);
      }
    }
    if (cv && cv.style.transform !== XF_ID9) { cv.style.transformOrigin = "center"; cv.style.transform = XF_ID9; }
    {
      // 안개 캔버스도 — 이 렌더의 ReplayFogLayer effect(자식이 먼저 돈다)가 상태 자리로 칠했으니 변환만 걷는다.
      const fcv9 = mapRef.current?.querySelector<HTMLCanvasElement>(".scr-motion-fog");
      if (fcv9 && fcv9.style.transform !== XF_ID9) { fcv9.style.transformOrigin = "center"; fcv9.style.transform = XF_ID9; }
      // 안개 기준도 그 자리다 — 안 맞추면 다음 붓이 엉뚱한 차를 걸어 안개가 튄다(위 fogXfRef9).
      fogXfRef9.current = { z: zoom, x: pan.x, y: pan.y };
    }
    xfCvXfRef.current = XF_ID9;
    // 굳은 배율로 touch-action도 못 박는다(위 applyGestureXf와 같은 규칙 — 한 손 줌이 떼며 되돌린 값을 여기서 바로잡는다).
    if (mapRef.current) mapRef.current.style.touchAction = zoom > 1 ? "none" : "";
    /* ★ fsOn이 목록에 있어야 한다(지적: "확대한 상태에서 전체화면 온오프시 이상한거다 /
       지도는 확대가 안되고 / 화면상에 있던 모델이 그대로 남아있는 현상") — 전체화면은
       지도를 판 안(.scr-fs-stage)으로 옮겨 심으므로 렌즈 상자가 **새로 난다**. 새 상자의
       style.transform은 빈 값이고, 리액트는 여기 손을 안 댄다(위 렌즈 상자 주석: 휠
       손짓과 싸우지 않으려고 일부러 effect가 쓴다). 배율·팬이 안 바뀌었으니 이 effect도
       안 돌아, 새 지도는 1배 제자리에 서 버렸다. 그런데 유닛 캔버스는 배율·팬을 **그리기
       좌표로** 받아 매 렌더 다시 그리므로 저 혼자 확대된 자리에 남는다 — 지도만 안
       확대되고 모델은 옛 자리에 그대로인 그림이 그것이다.
       매 렌더로 돌리면 안 된다 — 그러면 휠 손짓이 방금 쓴 변환을 상태가 계속 되돌린다
       (위 주석의 '휠 확대가 한 번만 먹는다'). 옮겨 심기가 곧 fsOn이니 그 한 칸만 더 본다. */
  }, [zoom, pan, fsOn]);
  useEffect(() => {
    /* 리스너는 전부 문서에 단다(재지적) — 맵은 데이터가 온 뒤에 그려지기도 해서, 마운트
       순간 mapRef가 비어 있으면 맵에 걸려던 리스너가 영영 안 달린다. 그러면 더블탭도
       핀치도 이벤트 자체를 못 받는다. 맵 상자는 이벤트마다 mapRef로 다시 읽으므로
       나중에 생겨도 그대로 동작한다. */
    let pinch: { d: number; z: number; cx: number; cy: number; px: number; py: number } | null = null;
    let pinchPend: { z: number; p: { x: number; y: number } } | null = null;
    let pinchRaf = 0;
    /* (제거·요청) 더블탭 판정에 쓰던 상수·진단기·상태가 있던 자리 — 확대는 이제
       PC 휠과 모바일 핀치 두 길뿐이라 탭을 잴 일이 없다. */
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    /** 두 손가락의 가운데가 지도 안인가 — 지도 밖에서 시작한 손짓은 페이지 몫이다. */
    const twoInMap = (e: TouchEvent): boolean => e.touches.length === 2
      && !onCtl9(e.touches[0]) && !onCtl9(e.touches[1])
      && inMap((e.touches[0].clientX + e.touches[1].clientX) / 2,
        (e.touches[0].clientY + e.touches[1].clientY) / 2);
    const onTS = (e: TouchEvent) => {
      /* 한 손 줌의 둘째 누름은 기본동작째 삼킨다(지적: "사파리 기준 돋보기가 뜨고
         복사 툴팁도 떠") — 탭 직후의 press-drag를 사파리가 **글자 선택**으로 알아
         돋보기(loupe)와 복사 말풍선을 띄운다. user-select·touch-callout none으로는
         안 죽는 갈래라, 여기서 touchstart의 기본동작을 끊는 수밖에 없다(포인터
         이벤트는 그대로 오므로 줌 손짓은 안 다친다). 첫 탭은 안 삼킨다 — 클릭·
         스크롤이 평소대로 굴러야 한다. */
      if (e.touches.length === 1) {
        const lt9 = lastTapRef.current;
        const t9 = e.touches[0];
        if (lt9 && performance.now() - lt9.t <= DTAP_MS
          && Math.hypot(t9.clientX - lt9.x, t9.clientY - lt9.y) <= DTAP_SLOP
          && !onCtl9(t9) && inMap(t9.clientX, t9.clientY)) {
          if (e.cancelable) e.preventDefault();
        }
      }
      /* 두 손가락이면 핀치 줌이다(지적: 모바일 핀치줌이 안 된다).
         한동안 "확대는 더블탭 하나"로 두면서 이 자리가 pinch를 **세우지 않고 지우기만**
         했다. 아래 onTM의 셈(배율 잡기·손가락 가운데 고정)은 그대로 살아 있었는데 시작
         점이 없어 통째로 죽은 코드였다 — 그래서 두 손가락을 벌려도 아무 일도 안 났다. */
      if (!twoInMap(e)) return;
      const el2 = mapRef.current;
      if (!el2) return;
      if (e.cancelable) e.preventDefault();
      /* 두 손가락이 닿는 순간부터 세로 스크롤도 끊는다(지적: 팬·핀치 뒤 떨림) — 1배에서 시작하는 핀치는 아직 pan-y라,
         두 손가락이 같이 움직이면 브라우저가 페이지 스크롤로 채가 주소창이 움직일 수 있다. 굳을 때 배율 규칙이 되돌린다. */
      el2.style.touchAction = "none";
      // 대기 델타 반영(드래그와 같은 규약) — 손을 뗄 때 endGestureXf가 부른다.
      pendFlushRef9.current = (): void => {
        if (pinchRaf) { cancelAnimationFrame(pinchRaf); pinchRaf = 0; }
        if (pinchPend) { zoomRef.current = pinchPend.z; panRef.current = pinchPend.p; pinchPend = null; }
      };
      pinch = {
        d: Math.max(1, dist(e.touches)),
        z: zoomRef.current,
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        px: panRef.current.x,
        py: panRef.current.y,
      };
      gestureRef.current = true;
      // 핀치도 임시 변환 손짓이다(드래그 버벅임 수리와 같은 결) — 리렌더 없이 따라온다.
      beginGestureXf();
    };
    const onTM = (e: TouchEvent) => {
      const el2 = mapRef.current;
      const t1 = e.touches[0];
      /* 지도 안에서 난 손짓만 우리 몫이다 — 문서에서 받으므로(아래 등록 주석) 좌표로
         가른다. 지도 밖의 스크롤·확대는 브라우저에 그대로 넘긴다. */
      const inside = !!t1 && !onCtl9(t1) && inMap(t1.clientX, t1.clientY);
      gestureRef.current = e.touches.length >= 2 && inside;
      /* 삼키는 건 지도 조작일 때만(재재지적: 모바일에서 아래로 스와이프가 안 됨) —
         무조건 preventDefault가 확대 안 한 한 손가락 스와이프(페이지 스크롤)까지
         막았다. 두 손가락(핀치)이거나 확대 중(드래그 팬)일 때만 기본 동작을 끊고,
         평상시 한 손가락은 페이지 스크롤로 흘려보낸다. */
      if (inside && (e.touches.length >= 2 || zoomRef.current > 1 || quickZoomRef.current)) {
        if (e.cancelable) e.preventDefault();
      }
      if (!pinch || e.touches.length !== 2 || !el2) return;
      const r = el2.getBoundingClientRect();
      const ox = r.left + r.width / 2;
      const oy = r.top + r.height / 2;
      // 상한 12 → 20(재요청: 더 높게) — 그 위는 선명도가 배킹 한계(4096px)에 막혀 무의미하다.
      // 핀치도 칸으로 안 끊는다(위 휠과 같은 까닭) — 손가락을 벌린 만큼 그대로 커진다.
      const z = Math.min(ZOOM_MAX, Math.max(1, (pinch.z * dist(e.touches)) / pinch.d));
      const mx2 = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my2 = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      // 핀치 시작점 아래의 지도 지점이 손가락을 따라오도록 pan을 푼다.
      const ux = (pinch.cx - ox - pinch.px) / pinch.z;
      const uy = (pinch.cy - oy - pinch.py) / pinch.z;
      /* 프레임당 한 번만 커밋(지적: 확대축소가 튐) — touchmove는 프레임보다 잦게 와서
         매번 setState하면 무거운 리렌더가 겹겹이 밀려 손을 못 따라왔다. 마지막 값만
         rAF에 실어 한 프레임에 한 번 반영한다. */
      /* 미세 떨림 사구간(지적: 떨림) — 손가락은 가만히 있어도 ±1px씩 떨린다. 배율
         0.4%·이동 0.7px 미만의 변화는 버려 지도가 어른거리지 않게 한다. */
      /* 죄어서 낸다(지적: "축소시 지도 파파팍 튀는거" + "모서리쪽은 딱 고정하고 반대를
         축소") ────────────────────────────────────────────────────────────────
         여태 이 자리는 팬을 **안 죄고** 그대로 놓았고, 배율이 1 이하로 내려가면
         {0,0}으로 툭 스냅했다. 그런데 배율이 바뀔 때마다 아래 '팬 재죔' effect가
         돌아 같은 팬을 한계 안으로 되죈다 — 손가락은 죈 적 없는 값을, effect는 죈
         값을 프레임마다 번갈아 놓아 지도가 파팍 튀었다. 재죔이 하는 일을 여기서
         먼저 해 두면 둘이 같은 값을 말한다.
         모서리 고정도 이 죔에서 저절로 나온다: 축소하면 한계(내용−창)가 줄어드는데,
         손가락 가운데를 붙들려는 팬은 그보다 더 바깥을 가리키므로 한계에 딱 걸린다 —
         닿아 있던 변은 그 자리에 붙어 있고 반대쪽만 줄어든다. */
      const lim = panLimit(z);
      const np = {
        x: Math.min(lim.x, Math.max(-lim.x, mx2 - ox - z * ux)),
        y: Math.min(lim.yTop, Math.max(-lim.y, my2 - oy - z * uy)),
      };
      if (pinchPend || Math.abs(z - zoomRef.current) / zoomRef.current > 0.004
        || Math.hypot(np.x - panRef.current.x, np.y - panRef.current.y) > 0.7) {
        pinchPend = { z, p: np };
      }
      if (!pinchPend) return;
      if (!pinchRaf) {
        pinchRaf = requestAnimationFrame(() => {
          pinchRaf = 0;
          if (pinchPend) {
            /* setState 대신 임시 변환(수리: 핀치 프레임마다 전체 리렌더) — 손가락이
               도는 동안은 합성기만 일하고, 상태는 굴림 커밋(300ms)과 놓을 때뿐이다. */
            zoomRef.current = pinchPend.z;
            panRef.current = pinchPend.p;
            applyGestureXf();
            pinchPend = null;
          }
        });
      }
    };
    const onTE = (e: TouchEvent) => {
      if (e.touches.length < 2 && pinch) {
        pinch = null;
        gestureRef.current = false;
        endGestureXf();   // 대기 델타는 pendFlushRef9(아래 핀치 시작에서 건다)가 반영한다
      } else if (e.touches.length < 2) {
        gestureRef.current = false;
      }
    };
    /* 더블탭 판정은 문서에서 자리로 한다(재지적: 모바일 더블탭 안 됨) — 맵에 건 리스너는
       손가락이 닿은 그 노드가 사라지면 touchend를 못 받는다. 재생 중엔 마커·오버레이가
       프레임마다 다시 그려져, 첫 탭과 둘째 탭 사이에 노드가 바뀌면 이벤트가 통째로
       빠졌다. 문서에서 받아 맵 상자 안인지 좌표로 따지면 어느 자식을 눌렀든 똑같이 센다.
       맵 상자는 그때그때 mapRef로 다시 읽는다(재지적) — 마운트 때 잡아 둔 el을 쓰면
       레이아웃이 바뀌며 맵 엘리먼트가 갈릴 때 낡은 상자로 재게 되고, 그러면 모든 탭이
       "맵 밖"으로 떨어져 더블탭이 통째로 죽는다. */
    const mapBox = (): DOMRect | null => {
      const m = mapRef.current;
      if (!m) return null;
      const r = m.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    };
    const inMap = (x: number, y: number): boolean => {
      const r = mapBox();
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    /* ★ 손짓이 **조작부에서** 났나(지적: "모바일 전체화면에서 재생바 끌기가 안 되는 듯 터치가
       안 잡히나") ────────────────────────────────────────────────────────────────────────
       잡히기는 잡혔다 — 아래 onTM이 그 손짓의 **기본 동작을 끊고** 있었다.
         if (inside && (손가락 둘 || zoom > 1 || 한손줌)) e.preventDefault();
       전체화면에서 지도 상자는 화면 전체(inset:0)이고 조작부는 그 위에 겹쳐 선다 — 곧 재생바를
       만지는 손가락도 **좌표로는 '지도 안'**이다. 게다가 전체화면은 대개 확대 상태(추적이면 늘)라
       `zoom > 1`이 참이어서, 재생바 위의 모든 한 손가락 touchmove가 삼켜졌다. 탐색바는 브라우저의
       기본 동작으로 끌리는 <input type=range>라, 기본 동작이 끊기면 손잡이가 아예 안 따라온다
       (touch-action: none을 이미 준 것과는 별개다 — 그건 브라우저의 스크롤 채감을 막는 자다).
       조작부는 무대의 **형제**라 포인터로도 지도에 안 흘러가므로, 여기서 삼킬 까닭이 애초에 없다.
       터치 사건의 target은 **손가락이 처음 닿은** 요소라 touchmove에서도 그대로 쓸 수 있다. */
    const onCtl9 = (t?: Touch): boolean => {
      const el9 = t?.target;
      return el9 instanceof Element
        && !!el9.closest(".scr-fs-ui, .scr-motion-bar, input, select, textarea");
    };
    /* (제거·요청: "인포팝업 때문에 더블탭/클릭 줌은 제거") — 여기 있던 것은 더블탭
       확대 갈래 전부다: 탭 시작 추적(onDocTS·onDocTM), 두 번째 탭 판정(onDocTE),
       그리고 touch 갈래가 통째로 안 오는 기기를 위한 포인터 판정(onPD·onPM·onPU),
       셋을 한 번으로 묶던 빗장(zoomGate)과 발동부(fireDouble).
       유닛을 눌러 정보 팝업을 여는 것과 같은 손짓이라, 팝업을 두 번 확인하려다 화면이
       확대되고 팝업이 닫히는 일이 잦았다. 확대는 PC 휠과 모바일 핀치 두 길만 남는다.
       핀치가 쓰는 mapBox·inMap과 탭 판정 상수들은 위에 그대로 있다. */
    /* 핀치도 문서에서 받는다(지적: 모바일 핀치줌이 안 된다) — 더블탭이 이미 같은 이유로
       문서로 옮겨 와 있다: 맵은 자료가 온 뒤에 그려지기도 해서 마운트 순간 mapRef가
       비어 있으면 el에 건 리스너가 **영영 안 달렸다**. 그러면 핀치는 코드가 멀쩡해도
       이벤트 자체를 못 받는다. 지도 안인지는 좌표(inMap)로 가린다. */
    /* 사파리의 손짓 이벤트도 막는다 — 아이폰은 touch-action과 별개로 gesturestart로
       페이지 확대를 시작한다. 지도 위에서만 끊고 그 밖은 그대로 둔다. */
    const onGesture = (e: Event) => {
      const g = e as Event & { clientX?: number; clientY?: number };
      if (g.clientX === undefined || g.clientY === undefined) return;
      if (!inMap(g.clientX, g.clientY)) return;
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener("gesturestart", onGesture, { passive: false });
    document.addEventListener("gesturechange", onGesture, { passive: false });
    document.addEventListener("touchstart", onTS, { passive: false });
    document.addEventListener("touchmove", onTM, { passive: false });
    document.addEventListener("touchend", onTE);
    document.addEventListener("touchcancel", onTE);
    return () => {
      if (pinchRaf) cancelAnimationFrame(pinchRaf);
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("touchstart", onTS);
      document.removeEventListener("touchmove", onTM);
      document.removeEventListener("touchend", onTE);
      document.removeEventListener("touchcancel", onTE);
    };
    // 확대창(포털 재부착)이 사라져 맵 엘리먼트는 안 바뀐다 — 마운트에 한 번이면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* 건물 자리 회피(요청: 밟고 지나가지 않고 돌아간다) — 서 있는 건물 발자국(+여유
     0.5타일) 안으로 들어온 유닛 자리는 가장 가까운 변 밖으로 밀어낸다. 선분이 발자국을
     가로지르면 안쪽 구간이 변을 따라 미끄러져, 돌아가는 걸음으로 보인다. */
  /* 입체 보기 원근(지적: 유닛만 원근이고 맵이 그대로) — 지형 그림에 CSS
     perspective+rotateX를 걸고, 마커 자리는 같은 사영 공식으로 매핑해 그림 위 제자리에
     얹는다. 깊이 배율(--mk)도 같은 k를 쓴다. */
  /* 바닥이 상자의 절반밖에 안 찼다(지적: "3D에서 왜 아래쪽 공간을 남기는거야 굳이").
     **상자는 한 픽셀도 안 건드린다**(재지적: "여백은 있어도 되는데 틀 자체가 좁아지면
     안 돼") — 앞서 상자 비율을 바꿨다가 폭이 그리드 칸에 고정된 탓에 세로만 285px
     늘어나 탐색바 아래가 통째로 밀렸다. 이번엔 상자 밖은 손대지 않고 바닥만 키운다.

     원인은 둘이었다.
     ① 회전 전 판이 상자와 같은 세로였다. 45도 회전이 세로를 cos45(0.707)배로 줄이므로
        바닥은 애초에 상자를 못 채운다. 판을 미리 1/cos45배 늘려 두면 회전 뒤에 상자
        세로가 된다.
     ② 원근 거리가 520px 고정이었다. 상자가 커질수록 원근이 상대적으로 세지고, 세질수록
        맞춤 축소(q)가 더 깎는다 — 실측: 상자 폭 360에서 바닥이 60%를 채우는데 1097에서는
        46%뿐이고, 원근 세기도 1.44배에서 3.46배로 제멋대로였다. 같은 경기가 기기마다
        다른 각도로 보였다는 뜻이다. 거리를 상자 세로에 비례시키면 둘 다 고정된다.
     고친 뒤 실측: 어느 크기에서든 바닥 채움 76% · 원근 1.91배.

     덤으로 이미 있던 불일치도 사라진다 — 그림자·트레이서는 바닥 눌림을 0.74로 알고
     그리는데(상자 비율 1/0.74가 그 값을 노린 것이다) 실제 바닥은 0.523으로 눌려
     있었다. 판을 늘리면 실제 눌림이 정확히 0.74가 되어 셋이 같은 바닥을 본다. */
  /* 눌림(PITCH_FLAT)은 예전에 **상자 비율**에 숨어 있었다(지적: "3D에서 맵이 세로로
     길어지는데?" — aspectRatio의 1/0.74). 상자를 1024 고정으로 바꾸면서 그 몫이
     사라져 눌림이 1.0이 되었고, 바닥이 안 눕고 서 버렸다. 눌림은 상자가 아니라 회전
     전 판이 맡는 것이 맞다 — 그래야 상자 크기를 어떻게 바꾸든 눕는 정도가 안 흔들린다.
     원근 거리(pitchDistOf)와 함께 모듈 스코프에 있다. */
  /* 맞춤 축소(지적: 또 예전 끝 잘림) — 원근 확대로 가까운 변이 상자를 넘쳤다. 가까운
     변이 상자에 딱 맞는 배율 q로 전체를 줄이고, 세로는 cy만큼 올려 가운데 정렬한다.
     지형 그림(transform)과 마커 공식이 같은 q·cy를 쓴다. */
  /* ★ 이 렌더에서 **한 번만 잰다**(성능 점검) ────────────────────────────────────────
     이 함수는 눕힌 보기에서 **개체마다 여러 번** 불린다 — pitchK(모델 크기) · posFrac
     (자리) · viewYawOf(좌우 시점)가 저마다 부르고, 그 셋이 개체 고리 안에 있다. 개체가
     수백이면 한 프레임에 천 번 넘게 도는 셈이고, 그때마다 ① clientWidth·clientHeight를
     읽고 ② 여덟 칸짜리 객체를 새로 만든다. 값은 **한 렌더 안에서 안 변한다**(DOM은 렌더
     중에 안 바뀌고, 상자가 갈리는 일—전체화면·회전—은 그 자체가 새 렌더다).
     그래서 렌더마다 비우고 처음 부를 때 한 번만 잰다. 렌더 밖에서 부르는 자리(지도
     벡터층이 mapFracRef로 쥔 posFrac)는 마지막 렌더의 값을 쓰는데, 그 사이 상자가 갈렸다면
     이미 새 렌더가 돌았으므로 어긋날 틈이 없다. */
  /* (걷어냄) 여기 있던 **같은 이름의 지역 타입** — 필드가 하나 늘 때마다 두 곳을 고쳐야 했고,
     실제로 sox를 더할 때 이 그림자가 바깥 타입을 가려 넘기는 자리마다 어긋났다. engine9의 것을
     그대로 쓴다(이 파일 머리에서 이미 import한다). */
  const pgRef = useRef<PitchGeom9 | null>(null);
  pgRef.current = null;
  /* ★ 배율·팬을 **인자로** 받는다(요청: 드래그 중에도 원근이 따라오게) — 원점(ox·oy)은 팬·배율에서
     나오므로, 손끝 값으로도 같은 셈을 할 수 있어야 손짓 중의 시야를 워커에 흘려보낼 수 있다.
     렌더가 부르는 자리는 상태(zoom·pan)를 그대로 넘긴다 — 값이 한 톨도 안 달라진다. */
  const pitchGeomAt9 = (
    z9: number, p9: { x: number; y: number },
    /** 밀림 기준 원점을 밖에서 못 박을 때(손짓 중 — PitchGeom9.sox의 ★). 안 주면 제 원점(ox)과 같다. */
    sox9?: number,
  ): PitchGeom9 => {
    const el = mapRef.current;
    const w = el?.clientWidth ?? 320;
    const h = el?.clientHeight ?? 220;
    /* 각도 바가 오면서 기울기와 눌림이 한 값이 됐다(요청: 각도 5단계) — 눕히는 각이
       곧 (90도 − 시점각)이고, 그 회전이 세로를 cos(기울기) = sin(시점각) = 눌림만큼
       누른다. 예전에는 회전을 45도로 못 박고 scaleY로 눌림을 0.74에 맞춰 넣었는데,
       그 둘이 이제 같은 수라 보정이 1이 되어 사라진다. 48도 칸에서 나오는 화면은
       예전과 같다(눌림 0.743 대 0.74). */
    const C = pitchFlat;
    const S = Math.sqrt(Math.max(0, 1 - C * C));
    /* 회전 전 판의 세로 — 회전이 C배로 누르므로 회전 뒤 세로가 상자의 C배가 된다.
       (옛 식 (h × 눌림)/C에서 눌림 = C가 되어 h만 남았다.) */
    const hPre = h;
    const P = Math.max(240, h * pitchDistOf(S));
    const H = hPre / 2;
    const q = Math.max(0.2, (P - H * S) / P);
    const kFar = P / (P + H * S);
    const cy = (C * H * (1 - q * kFar)) / 2;
    /* 시점 원점(PitchGeom9 주석) — 굳은 배율·팬에서 화면 가운데가 닿는 지도 지점. 원점은 (q·ox, q·C·oy − cy)에 찍히므로
       그 자리가 화면 가운데(−pan/z)가 되게 푼다. 팬 0·배율 1이면 cy만큼 아래 지점이 원점이라 옛 그림과 거의 같다. */
    const ox = pitched ? -p9.x / (z9 * q) : 0;
    const oy = pitched ? (cy - p9.y / z9) / (q * C) : 0;
    return { w, h, hPre, P, S, C, q, cy, ox, oy, sox: sox9 ?? ox };
  };
  const pitchGeomRaw = (): PitchGeom9 => pitchGeomAt9(zoom, pan);
  const pitchGeom = (): PitchGeom9 => {
    pgRef.current ??= pitchGeomRaw();
    return pgRef.current;
  };
  /** 손끝 기하 — 손짓 중에는 상태가 안 움직이므로(refs만 움직인다) 여기서 지금 값을 본다.
   *  밀림 기준(sox)은 손짓이 시작될 때 얼린 값이다(shearOxRef9 · PitchGeom9.sox의 ★). */
  const pitchGeomLive9 = (): PitchGeom9 =>
    pitchGeomAt9(zoomRef.current, panRef.current, shearOxRef9.current ?? undefined);
  // 손짓이 부르는 자리(postLiveView9)는 렌더 밖이라 ref로 건넨다.
  pitchGeomLiveRef9.current = pitchGeomLive9;
  /* (걷음) pitchStyle — 입체일 때 <img>에 입히던 변환이다. 그림이 사라졌다. */

  /** 그리는 장의 원점을 낀 기하 — 안개·DOM 효과·지형 변환이 쓴다(위 drawnOrgRef9). 목표 원점은 pitchGeom()이다. */
  const drawnGeom9 = (): PitchGeom9 => {
    const g9 = pitchGeom();
    const d9 = drawnOrgRef9.current;
    return d9.ox === g9.ox && d9.oy === g9.oy ? g9 : { ...g9, ox: d9.ox, oy: d9.oy };
  };
  const pitchK = (y: number): number => {
    if (!pitched) return 1;
    const { hPre, P, S, q, oy } = drawnGeom9();
    const v = (y / grid.height - 0.5) * hPre - oy;
    return (q * P) / (P - v * S);
  };
  /** 위쪽 여유(배율 1 기준, px) — 지도 윗변 위로 더 끌 수 있는 몫이다(위 panLimit).
   *  자는 **칸 하나의 화면 폭**이고(덮는 폭 ÷ 가로 칸 수), 가장 큰 것(4×4 건물)이 제
   *  발자리에서 네 칸만큼 솟는다.
   *  ★ 입체에도 준다(지시: "3D에도 줘") — 한때 0으로 두었던 까닭은 "사영이 위쪽을 눕혀
   *    솟은 몫을 안으로 접는다"였는데, 접히는 것은 **땅**이지 몸이 아니다: 모델은 눕힌
   *    판에서도 화면에 곧게 서므로 맨 윗줄에 선 것은 여전히 위로 솟고, 그 몫이 창을
   *    넘으면 똑같이 잘린다.
   *    다만 **먼 줄의 눌림**을 함께 곱한다(pitchK(0)) — 눕히면 맨 윗줄이 지평선 쪽으로
   *    눌려 거기 선 것도 그만큼 작게 그려진다(unitGlyphPx가 바로 이 자를 쓴다). 그래서
   *    여유도 같은 몫이면 되고, 2D는 이 값이 1이라 **식 하나가 두 보기를 다 낸다**.
   *  ★ 이 자리에 있는 까닭 — pitchK보다 먼저 셈하면 그 함수가 아직 안 서 있다. 붓이 아니라
   *    손짓이 읽는 값이라(panLimit) 렌더 중 어디서 심든 effect보다는 앞선다. */
  bandRef.current = fsCoverW <= 0
    ? 0 : ((BAND_TILES * fsCoverW) / Math.max(1, grid.width)) * pitchK(0);
  /** 자리의 0~1 분수 — posStyle(%)과 캔버스 유닛 층이 같은 값을 쓴다. */
  /* 지도 벡터층의 입체 창 굽기가 쓰는 타일→분수 사상(지적: 입체 확대 흐림) —
     posFrac은 렌더마다 새 클로저라 ref로 흘려보내 deps를 안 태운다(값은 아래에서
     매 렌더 갱신). */
  const posFrac = (x: number, y: number): [number, number] => {
    if (!pitched) return [x / grid.width, y / grid.height];
    // 엔진(engine9 posFrac)과 같은 식 — 원점은 그리는 장의 것(drawnGeom9).
    const { w, h, hPre, P, S, C, q, cy, ox, oy } = drawnGeom9();
    const u = (x / grid.width - 0.5) * w - ox;
    const v = (y / grid.height - 0.5) * hPre - oy;
    const k = (q * P) / (P - v * S);
    return [0.5 + (q * ox + u * k) / w, 0.5 + (q * C * oy + v * C * k - cy) / h];
  };
  mapFracRef.current = posFrac;
  const posStyle = (x: number, y: number): { left: string; top: string } => {
    const [fx, fy] = posFrac(x, y);
    return { left: `${(fx * 100).toFixed(3)}%`, top: `${(fy * 100).toFixed(3)}%` };
  };
  /** ★ 효과 시트(fxlens)의 **px 게이트 하나**(요청: "css 요소의 배율 적용을 하나의 게이트로 통일") ──
   *  그 시트는 폭 자체가 배율×100%라 안에 적는 px이 곧 화면 px이다. 엔진이 주는 길이는 전부 1배
   *  상자 px이므로 시트에 px을 적는 곳은 **예외 없이** 이 함수를 지난다 — 파손 효과가 12배에서
   *  1/12로 줄었던 것은 한 곳이 이 곱을 빠뜨린 탓이었다. CSS 규칙 안의 px(테두리 등)은 시트의
   *  `--scr-z`(같은 배율)를 calc로 곱한다. 두 길 모두 값은 zoom 하나다. */
  const zpx9 = (v: number): string => `${(v * zoom).toFixed(1)}px`;
  /** 지도 분수 → 타일 — 위 posFrac의 **역함수**다(요청: "전체화면 온오프시와 각도
   *  변경시 보던위치 중앙을 맞춰줘"). 보던 자리를 지키려면 '지금 화면 한가운데에 오는
   *  지도 지점'을 알아야 하는데, 그건 분수에서 타일로 되돌리는 셈이다.
   *
   *  posFrac의 식을 그대로 푼다:
   *    fy = 0.5 + (v·C·k − cy)/h,  k = qP/(P − vS)
   *    → A ≡ ((fy−0.5)·h + cy)/(C·q·P) = v/(P − vS) → v = A·P/(1 + A·S)
   *    → k가 정해지고,  u = (fx−0.5)·w/k
   *  평면(90도)에서는 원근이 없어 분수가 곧 자리다. */
  const tileOfFrac = (fx: number, fy: number): [number, number] => {
    if (!pitched) return [fx * grid.width, fy * grid.height];
    // 목표 원점(pitchGeom)의 역함수 — 시야 사각형·미니맵 창·재중심은 굳은 상태의 눈으로 잰다.
    const { w, h, hPre, P, S, C, q, cy, ox, oy } = pitchGeom();
    const A = ((fy - 0.5) * h + cy - q * C * oy) / Math.max(1e-6, C * q * P);
    const v = (A * P) / (1 + A * S);
    const k = (q * P) / Math.max(1e-6, P - v * S);
    const u = ((fx - 0.5) * w - q * ox) / Math.max(1e-6, k);
    return [((u + ox) / w + 0.5) * grid.width, ((v + oy) / hPre + 0.5) * grid.height];
  };
  /** 지금 화면 한가운데에 오는 지도 지점(타일). 상자가 아직 안 서 있으면 null. */
  const viewCenterTile = (): { x: number; y: number } | null => {
    const el = mapRef.current;
    const r = el?.getBoundingClientRect();
    if (!r || r.width < 4 || r.height < 4) return null;
    const z = zoomRef.current;
    const p = panRef.current;
    /* 렌즈 변환(translate(pan) scale(z), 원점 가운데)의 역 — 화면 가운데(폭/2)에 오는
       분수는 0.5 − pan/(폭·배율)이다. 공유 링크가 적는 값(playbackViewOf)과 같은 식. */
    const [tx, ty] = tileOfFrac(0.5 - p.x / (r.width * z), 0.5 - p.y / (r.height * z));
    return { x: tx, y: ty };
  };
  /** 그 지도 지점을 화면 한가운데로 데려온다 — 성공하면 true. */
  const centerOnTile = (tx: number, ty: number): boolean => {
    const el = mapRef.current;
    const r = el?.getBoundingClientRect();
    if (!r || r.width < 4 || r.height < 4) return false;
    const [fx, fy] = posFrac(tx, ty);
    const z = zoomRef.current;
    const lim = panLimit(z);
    viewDiagPush9("center", `${tx.toFixed(1)},${ty.toFixed(1)}`);
    setView9(z, {
      x: Math.min(lim.x, Math.max(-lim.x, (0.5 - fx) * r.width * z)),
      y: Math.min(lim.yTop, Math.max(-lim.y, (0.5 - fy) * r.height * z)),
    });
    return true;
  };
  /* 보던 자리 지키기(요청) ─────────────────────────────────────────────────────
     전체화면을 켜고 끄면 지도 상자가 통째로 갈리고(무대를 덮는 폭 fsCoverW), 각도를
     바꾸면 같은 타일이 화면의 다른 자리로 사영된다. 여태는 팬을 새 한계 안으로 되죄기만
     해서, 확대해서 보던 전장이 화면 밖으로 밀려났다.
     방법은 둘로 나뉜다: ① 바뀌기 **전** 한가운데 지점을 적어 두고(centerRef),
     ② 바뀐 **뒤** 그 지점을 다시 한가운데로 데려온다(아래 레이아웃 이펙트).
     ①은 지나가는 이펙트(레이아웃 뒤에 도는 패시브)라, 전환이 일어난 커밋에서는 ②가
     먼저 옛 값을 읽고 그다음에 새 값이 적힌다 — 리액트의 이펙트 차례가 그대로 규칙이 된다.
     전환 중에는 ①을 얼려 둔다(holdRef): 전체화면은 무대 크기가 재질 때까지 커밋이 두
     번 나므로, 그 사이의 어중간한 자리가 적히면 두 번째 커밋이 그리로 간다. */
  const centerRef = useRef<{ x: number; y: number } | null>(null);
  const holdRef = useRef<{ x: number; y: number } | null>(null);
  const viewKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (holdRef.current) return;
    centerRef.current = viewCenterTile();
    // 자리·배율·각도·상자가 바뀔 때만 적는다 — 재생 프레임마다 재면 낭비다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, pan.x, pan.y, pitchDeg, fsOn, stage.w, stage.h, mapPx]);
  useLayoutEffect(() => {
    const key = `${fsOn ? 1 : 0}|${pitchDeg}|${Math.round(stage.w)}x${Math.round(stage.h)}`;
    if (viewKeyRef.current === null) { viewKeyRef.current = key; return; }
    if (viewKeyRef.current === key) return;
    viewKeyRef.current = key;
    /* ★ 링크가 준 자리를 아직 쥐고 있으면 **재중심은 물러난다**(지적: PC에서 공유 링크가 늘 정가운데) ─────────
       실기기 진단이 그대로 적어 놨다: `stage×7 center×7 clamp×8 link×1`. PC는 첫 몇 초에 무대가 일곱 번
       다시 서고, 그때마다 이 '보던 자리 지키기'가 돈다. 그런데 그것이 기억한 자리(centerRef)는 링크가 앉기
       **전**의 것 — 곧 지도 한가운데다. 그래서 앉혀 놓은 자리를 일곱 번 걷어차 가운데로 끌고 갔고, 첫 걷어참의
       setView9가 붙든 자리마저 놓아 버려(link×1) 다시 앉히지도 못했다. 폰은 무대가 한 번에 서서 안 걸렸다.
       둘은 같은 일을 겨루는 장치다 — '방금까지 보던 자리'와 '링크가 시킨 자리'. 링크가 살아 있는 동안(사람이
       손대기 전 · 배치가 선 뒤 5초)은 링크가 임자다. 그 뒤로는 종전대로 이것이 지킨다. */
    if (linkHoldRef9.current) return;
    const want = holdRef.current ?? centerRef.current;
    if (!want) return;
    holdRef.current = want;
    // 전체화면은 무대 크기가 재져야 지도 폭이 정해진다 — 그 전 커밋에서는 미룬다.
    if (fsOn && fsCoverW <= 0) return;
    if (centerOnTile(want.x, want.y)) holdRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsOn, pitchDeg, stage.w, stage.h, fsCoverW]);
  /* 크립 차단 마스크의 화면 자리(요청) — 평면은 맵 전체에 한 장이면 되고, 입체는
     원근 배율이 줄마다 달라 지형 한 줄씩 잘라 그 줄의 자리·폭으로 근사해 얹는다. */
  const creepMaskRects: [number, number, number, number, number, number][] = [];
  if (creepMask) {
    if (!pitched) {
      creepMaskRects.push([0, creepMask.height, 0, 0, 1, 1]);
    } else {
      const th = creepMask.height;
      for (let gy = 0; gy < th; gy += 1) {
        const yT0 = (gy / th) * grid.height;
        const yT1 = ((gy + 1) / th) * grid.height;
        const yMid = (yT0 + yT1) / 2;
        const [fx0] = posFrac(0, yMid);
        const [fx1] = posFrac(grid.width, yMid);
        const [, fy0] = posFrac(0, yT0);
        const [, fy1] = posFrac(0, yT1);
        creepMaskRects.push([gy, 1, fx0, fy0, fx1, fy1]);
      }
    }
  }
  /* 좌우 시점(지적: 시점이 정면 고정, 좌우가 없다) — 카메라(화면 가운데, 거리 P)에서
     비껴 보이는 마커는 그 각도만큼 모델 요잉을 틀어 굽는다. 왼쪽 마커는 오른옆이,
     오른쪽 마커는 왼옆이 보인다. */
  const viewYawOf = (x: number, y: number): number => {
    if (!pitched) return 0;
    // 밀림만 제 기준 원점(sox)을 쓴다 — 엔진의 viewYawOf와 같은 자다(PitchGeom9.sox의 ★).
    const { w, P, sox } = drawnGeom9();
    const u = (x / grid.width - 0.5) * w - sox;
    void y; // 자리 호환 — 기울기는 u/P라 세로 좌표가 안 든다.
    /* 요잉이 아니라 시각 밀림의 각(지적: 소실점이 시각을 반영해야 — 돌리면 찌그러짐).
       ShapeIcon이 tan을 취하면 u/P — 지도 남북 선의 소실 기울기 그 값이다(지적:
       노란선-빨간선 정합). 부호는 실화면 확인으로 이쪽이 정답 — 다시 뒤집지 말 것. */
    return (Math.atan2(u, P) * 180) / Math.PI;
  };
  /* 유닛 방향(지적: 멈추면 정면으로 돌아가 어색) — 조금 전이 아니라 '마지막으로 움직인'
     방향을 문다: 가까운 창부터 점점 멀리(최대 15초) 되짚어 처음 잡히는 변위의 방향이다.
     첫 창을 0.3초로 좁혔다(지적: 가끔 옆을 보고 걷는 듯) — 0.8초 창은 모퉁이를 돈 직후
     두 구간에 걸친 평균 방향(대각선)을 물어, 꺾고 나서도 한동안 비껴 보였다. */
  /* 마커별 직전 방향 기억(지적: 회전 부드럽게) — headingOf의 각 스무딩 상태. 마커가
     사라지면 항목이 남지만 몇백 개 수준이라 판 하나 안에서는 무해하다. */
  /* 캔버스 유닛 층의 재료(요청: 캔버스 전환 — 성능) — 이번 렌더에서 그릴 낱개 유닛
     도형들. 아래 마커 계산부가 push하고, 렌즈 안의 <UnitLayer>가 커밋 뒤 한 번에 그린다.
     계산(자리·회피·방향·깊이·순서)은 전부 그대로라 그림은 SVG 시절과 같다. */
  /* (걷어냄) 발사·피격 사건 — 옛 시뮬이 제 전투 판정으로 내던 것이다. 참값 자취에는
     자리·방향·상태만 실려 있어 '누가 누구를 쐈나'가 없다(덤퍼가 아직 안 뽑는다). 그래서
     트레이서와 피격 불티는 다시 렌더 제 교전 판정으로 돌아간다 — 아래 두 자리다.
     [다음 수] bwdump가 발사 사건까지 내주면 여기로 돌아온다. */
  /* 저배율 마커 보기(요청) — 타일 하나가 이 픽셀보다 작으면 유닛이 점 크기라, 몸은
     UnitLayer의 마커 갈래가 찍고 여기서는 **안 보이는 연출의 값**을 접는다: 표적 찾기
     (nearestFoe)·피격 불티·트레이서. 문턱은 UnitLayer의 MARKER_UNIT_PX(상자 9px)와
     같은 자리를 겨눈 값이다 — 유닛 상자가 2~3타일이니 타일 3.4px 언저리에서 만난다. */
  /* (걷어냄) tilePxNow — 타일이 화면에서 몇 px인가로 마커 갈래를 가르던 자다. 배율이
     칸으로 끊긴 뒤로는 칸 번호가 그 일을 한다(아래). */
  /* 자세함은 **배율 칸이 정한다**(요청: "1단계 - 마커 표시 / 2단계부터 실제 그림표시
     인데 3단계부터 효과 자세히 나오고 그림자도 들어가고 / 2단계는 최소한만") ────────
     여태는 타일 픽셀 문턱 하나로 마커냐 아니냐만 갈랐다. 배율이 다섯 칸으로 끊긴
     지금은 칸 번호가 곧 사다리라, 무엇이 언제 켜지는지가 눈금과 같아진다:
       칸 1 — 마커만(몸도 그림자도 효과도 없다)
       칸 2 — 몸만. 그림자·전투 효과·체력바·선택 링을 다 뺀 **최소**다.
       칸 3~5 — 전부(그림자·드롭섀도·전투 효과·체력바), 사양 라디오와 곱해진다.
     칸이 올라갈수록 화면에 남는 유닛 수가 줄므로(화면 밖 걸러내기), 자세함을 그때
     올리는 것이 곧 프레임을 지키는 길이다. */
  /* 손짓 중에는 **손끝 배율**로 칸을 잰다(지적: "줌 1단계로 갈때 모델나오다가 마커로
     바뀌는 현상") — 상태(zoom)는 손을 놓아야 굳으므로, 그때까지 이 칸이 손끝보다 한
     박자 늦었다: 축소하는 내내 몸으로 그리다가 커밋 순간 통째로 마커로 뒤집혔다.
     캔버스 쪽은 문턱을 그대로 받아(아래 markerAt·detailAt) 그리는 배율로 판정한다. */
  const zoomLive = xfGestureRef.current ? zoomRef.current : zoom;
  const zoomStep = ZOOM_STEPS.indexOf(snapZoom(zoomLive));
  /* ★ 마커 보기는 **어느 칸에도 안 선다**(지시: "모바일/PC 모두 1배에서도 모델 표시로
     변경" · "1, 2배가 사실 별 차이 없을 듯") ────────────────────────────────────────
     앞선 요청으로 PC에서 먼저 걷었고("피시에서는 1배줌일때 마커 표시 안하고 모델로
     표시"), 이제 폰에서도 걷는다.
     저배율 마커는 폰에서 유닛 수백을 감당하려고 만든 자리였다. 그 셈이 헐거워진 까닭이
     지시의 뒷말에 있다 — **1배와 2배는 삯이 엇비슷하다**: 낮은 칸은 한 유닛이 작은 대신
     화면에 남는 수가 가장 많고, 높은 칸은 그 반대라 화면 밖 걸러내기가 대부분을 쳐낸다.
     곧 1배만 마커로 두어 아끼는 몫이 생각만큼 크지 않고, 대신 잃는 것은 분명하다 —
     같은 판을 축소했을 뿐인데 유닛이 통째로 점으로 바뀐다.
     간이 보기(liteView)는 그대로 남는다 — 낮은 칸에서 자세 컷·요잉 열여섯 칸·포탑
     판·효과 셈을 접는 그 몫이 실제로 값이 크고, 몸을 점으로 바꾸지도 않는다.
     ⚠ 되돌릴 자리는 이 한 값과 아래 markerAt 둘이다(그리는 쪽이 문턱으로 판정하므로
       손짓 중 한 박자도 안 어긋나려면 둘이 같이 움직여야 한다). 그리는 쪽의 마커 갈래는
       지운 것이 아니라 안 걸리는 것뿐이라, 폰이 못 버티면 여기만 되돌리면 된다. */
  const markerView = false;
  /* ★ **간이 보기** — 1배·2배 칸(요청: "1배(pc에 해당), 2배 줌에서 보여지는 요소들은
     단순화해서 최대한 부하를 줄이고 싶어 … 유닛이 많이 보이는 배율에서는 좀 버거운듯")
     ────────────────────────────────────────────────────────────────────────────
     맞는 진단이다. 낮은 칸은 화면에 남는 유닛이 가장 많은 자리인데(높은 칸은 화면 밖
     걸러내기가 대부분을 쳐낸다) 정작 그 칸에서 한 유닛이 차지하는 픽셀은 가장 작다 —
     곧 **보이지도 않는 것에 가장 많은 삯을 치르는 칸**이다.
     그리는 쪽은 이미 이 칸에서 그림자·체력바·효과를 접는다(detailAt). 그런데 그 값을
     **만드는 쪽**(이 걷기 루프)은 접는 것이 없어, 안 그릴 효과의 표적을 찾고 각을 재고
     DOM 스팬 값을 짓는 일을 유닛마다 그대로 하고 있었다. 그리고 굽기 쪽에는 더 큰
     몫이 있다 — 자세 컷과 요잉 버킷이다:
       · 자세 컷 — 걸음 A/B·공격이 종류마다 판을 서너 벌로 늘리고, 걸음 박자마다
         굽기 캐시를 갈아 끼운다. 1배에서 몸은 대여섯 픽셀이라 그 컷이 안 읽힌다.
       · 요잉 버킷 — 22.5도 열여섯 칸을 45도 여덟 칸으로 묶으면 판이 절반이 된다.
         몇 픽셀짜리 몸에서 22.5도와 45도는 구분되지 않는다.
     넷을 함께 접는다(효과 셈·자세 컷·요잉 절반·포탑 판). 4배부터는 종전 그대로다. */
  /* ★ 문턱을 한 칸 올린다(요청: "확대 2배·4배까지는 정말 단순하게 표현해 줘도 될 것
     같은데 지금 너무 여러 가지 상세히 표현해 주는 듯") — 여태 간이 보기는 1·2배까지였고
     4배부터 그림자·전투 효과·체력바·자세 컷·포탑 판이 한꺼번에 켜졌다. 그 칸은 아직
     유닛이 여럿 보이는 자리라 화면이 잔 것들로 붐빈다. 4배까지 간이로 두면 8배부터가
     '자세히 보는 칸'이 된다 — 그때는 화면에 몇 마리 안 남아 세부가 실제로 읽힌다. */
  /* ★ 그 문턱은 **폰 몫이다**(지적: "체력바 전투 효과는 4배부터, 트레이서는 2배부터로
     통일했을걸?") — 맞다, 8배로 올라간 것은 그 뒤 "2·4배는 정말 단순하게"(f4b8e9f)가
     폰 부하를 두고 한 요청이다. 넓은 자리(PC)는 그 부담이 없다(요청: "PC는 2배에서
     전투효과 자세컷 포탑판 모두 추가 4배에서 체력바 추가") — 1배만 간이로 두고 2배부터
     자세 컷·요잉 열여섯 칸·포탑 판·전투 효과 셈을 다 돌린다. 좁은 자리는 8배 그대로.
     ⚠ 만드는 쪽(이 값)과 그리는 쪽(detailAt) 둘 다 내려야 한다 — 여기서만 내리면
     굽기는 자세해지는데 그리는 쪽이 걸러 아무것도 안 보이고, 반대면 없는 값을 그린다. */
  /* 문턱의 자는 **배치가 모바일로 바뀌는 기점(wide, 상자 폭 860px) 하나**다(요청: 기준이 둘이면
     헷갈린다 — 기기 기준으로 갈라 봤다가 되돌림). 좁은 상자에 앉힌 PC도 폰 문턱을 쓴다. */
  const liteView = zoomStep <= (wide ? 0 : 2);
  /** ★ **요잉만은 셋째 칸까지 묶는다**(요청: "요잉 4배까지는 축소") — 배치를 안 가린다.
   *  굽는 판은 요잉 칸마다 한 벌이라 열여섯 칸은 여덟 칸의 두 배를 굽고 두 배를 이고
   *  있는다. 그 배율에서도 22.5도와 45도 사이의 차이는 몸 윤곽 한두 픽셀이라, 치르는
   *  값에 비해 화면에 남는 것이 적다. 넷째 칸부터 열여섯 칸이다.
   *  ※ 요청 당시의 사다리는 1·2·4·8·16이라 '4배까지'였다. 지금 사다리(1·2·3·6·12)에서는
   *    그 자리가 3배다 — 판정은 **칸 번호**로 걸려 있어 사다리를 갈아도 뜻이 안 갈린다.
   *  (계측: PC 2배에서 판 47장 ↔ 51장 — 4배는 판이 커서 그 몫이 더 크다.) */
  const liteYaw = zoomStep <= (wide ? 1 : 2);
  /** ★ 트레이서가 서는 칸(요청: "모든 트레이서류 2배 줌부터 나오게 수정") — 여태
   *  트레이서는 간이 보기(liteView) 뒤에 숨어 **맨 위 바로 아래 칸부터**였다: 재료를
   *  만드는 쪽은 표적 찾기 자체를 접었고(wantFoe9), 그리는 쪽은 detailAt으로 층을
   *  통째로 걸렀다. 두 자리가 같은 문턱을 봐야 하므로 값은 TRACER_MIN_ZOOM 하나다.
   *  ★ 칸 번호(zoomStep)가 아니라 **배율 그대로** 본다 — 사다리에 안 걸린 손짓 값
   *    (핀치 2.4배)은 indexOf가 −1을 내서 칸으로는 늘 '가장 낮은 칸'이 된다. */
  const tracerView = zoomLive >= TRACER_MIN_ZOOM;
  /* (걷어냄) zoomDetail — 칸 3부터가 '자세히'라는 판정이다. 이제 캔버스가 문턱
     (detailAt)을 받아 **그리는 배율**로 직접 가리므로, 여기서 미리 접을 것이 없다. */
  /* (제거) 어택 명령 표적 집합으로 피격을 그리던 자 — 명령이 찍힌 곳과 실제로 맞는
     곳이 다르고 8초 내내 켜져, 싸움과 무관한 자리에서 불티가 텄다(지적). 이제 각
     개체의 체력 자취가 내려간 순간을 피격으로 삼는다(hurtAt). */
  // 글자 크기 CSS(모바일/PC 미디어)와 같은 값 — 캔버스는 CSS를 못 읽으니 여기서 정한다.
  // 이제 크기는 캔버스가 정한다 — 이 값은 그리기 주기(아래 DRAW_GAP_MS)에만 쓰인다.
  const pcView = typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 1160px)").matches;
  /* 모델 크기 — **크기표가 곧 원작 크기다**(요청: 모델크기 토글 제거). 모델 공간
     정규화(MODEL_NORM·BLD_NORM)가 '상자를 채우는 몫'을 종류마다 같게 맞추고, 원작
     치수표(UNIT_BW_TILES)가 그 위에 실제 크기를 준다(실측: 마린 잉크 폭 0.632타일 =
     원작 0.531타일 언저리, 저글링 0.577, 프로브 0.742). 화면 배수를 따로 곱하던
     자리(unitMul·bldMul)는 그래서 없어졌다 — 곱하면 몸만 부풀고 진형 간격·그림자·
     체력바는 제자리라 비율이 통째로 어긋난다. */
  /* ── 유닛 크기의 자(전수조사·요청: "실제 캔버스 × 소·중·대로 균일하게") ─────────
     예전엔 등급마다 고정 픽셀(모바일 6·8·11 / PC 8·11·15)이었다. 화면 폭이나 맵
     격자와 무관한 값이라, 같은 마린이 맵마다 제멋대로 커 보였다: 64×64 맵의 한 타일은
     128×128의 두 배라 같은 6px이 절반 크기로 읽힌다. 건물은 진작부터 발자국(타일)
     비례였으니 유닛만 홀로 다른 자를 쓰고 있었던 셈이다.
     이제 둘이 한 자를 쓴다 — 한 타일의 화면 픽셀 × 등급비(소·중·대). 줌은 그리기
     단계에서 곱해지므로 어느 배율에서도 타일 대비 크기는 그대로다. */
  const tilePx = Math.max(1.2, (mapRef.current?.clientWidth ?? 320) / Math.max(1, grid.width));
  /* (폐기) 등급 3칸 표(UNIT_TILES 0.8/1.1/1.5) — 소·중·대 셋으로는 벌처와 탱크,
     저글링과 드론을 가르지 못했고, 무엇보다 '상자 크기'라 화면에 보이는 몸이 되지
     못했다. 이제 크기는 원작 치수표(UNIT_BW_TILES)가 유닛마다 정하고, 상자에서 몸으로
     가는 환산(16/MODEL_INK)은 정규화가 잰 값이 맡는다 — 위 unitTilesOf 무리 참고.
     등급은 표에 이름이 없는 유닛의 폴백(CLASS_TILES)으로만 남는다.
     **차지하는 공간은 안 건드린다** — 겹침·충돌은 simCore의 BODY_R이 따로 정하고 그
     값은 원작 그대로다. 화면 진형 간격도 이제 그리기 크기가 아니라 원작 몸 지름
     (UNIT_BODY_TILES → op.sepPx)에서 온다. */
  /** 낱개 유닛 도형 상자(px) — 크기표 × 깊이.
   *  열쇠가 둘이다: drawKind는 **그려지는 모델**(tankbody·burrowhole…), sizeKind는
   *  **원작 치수를 가진 유닛**(tank·hydra…). 둘이 갈리는 자리가 곧 여태 손잡이가
   *  못 닿던 일곱 종류다. */
  const unitGlyphPx = (drawKind: string, sizeKind: string, bulk: 0 | 1 | 2, depthY: number): number =>
    tilePx * unitTilesOf(drawKind, sizeKind, bulk) * pitchK(depthY);
  /** 유닛 이름 → 낱개 도형 상자(px). 그리는 모델이 유닛과 다르면 drawKind로 알려 준다. */
  const unitPxOf = (u: string, depthY: number, drawKind?: string): number => {
    const sk = UNIT_3D[u] ?? "";
    return unitGlyphPx(drawKind ?? sk, sk, u === "?" ? 0 : (UNIT_BULK[u] ?? 1), depthY);
  };
  /** 공중 몸이 뜨는 높이(px, 줌 전) — **몸 크기와 무관하게 한 값**이다(위 AIR_LIFT_REF).
   *  깊이(depthY)만 탄다: 입체에서 먼 줄은 그림 자체가 눌리므로 높이도 같이 눌려야
   *  같은 하늘에 뜬 것으로 읽힌다. 화면의 모든 '떠 있음'이 이 한 함수를 지난다. */
  const airLiftPxOf = (depthY: number): number => unitPxOf(AIR_LIFT_REF, depthY) * AIR_LIFT_K;
  /** 유닛 이름(또는 kind) → 진형 간격용 몸 지름(px, 줌 전) — 원작 충돌 상자 그대로.
   *  UNIT_3D에 없는 이름은 kind로도 한 번 찾는다: 스파이더 마인은 유닛 이름표에 없고
   *  op이 kind("mine")만 아는데, 그 op이 **지금 이완에 드는 유일한 유닛 op**이다. */
  const unitSepPxOf = (u: string): number =>
    tilePx * (UNIT_BODY_TILES[UNIT_3D[u] ?? u]
      ?? CLASS_TILES[u === "?" ? 0 : (UNIT_BULK[u] ?? 1)]);
  /* 시야 사각형(요청: 컬링) — 옛 메인 엔진의 자(cull9)와 **같은 식**(미니맵 흰 네모 fsViewAt). 보이는 사각형에
     앞뒤로 한 화면씩 여유를 붙여(3×3) 보내고, 보이는 사각형이 그 안에 있는 동안은 다시 안 보낸다 — 작은 팬은
     설계도를 안 버린다. 여유가 보이는 것의 20배를 넘으면(많이 당겨 들어옴) 조인다. 1.2배 이하는 지도가 거의
     다 보이니 없음(지도 전체). */
  const visRect9 = ((): { x0: number; x1: number; y0: number; y1: number } | null => {
    const z9 = zoomRef.current;
    if (!(z9 > 1.2)) return null;
    const st9 = stageSizeRef.current;
    const cv9 = coverRef.current;
    if (!(st9.w > 0) || !(st9.h > 0) || !(cv9.w > 0) || !(cv9.h > 0)) return null;
    const winH9 = Math.max(st9.h, viewHRef.current || 0);
    const spanX = st9.w / (cv9.w * z9);
    const spanY = winH9 / (cv9.h * z9);
    const cxF = 0.5 - panRef.current.x / (cv9.w * z9);
    const cyF = 0.5 - panRef.current.y / (cv9.h * z9);
    return { x0: cxF - spanX / 2, x1: cxF + spanX / 2, y0: cyF - spanY / 2, y1: cyF + spanY / 2 };
  })();
  const cullSentRef9 = useRef<{ x0: number; x1: number; y0: number; y1: number } | null>(null);
  const cullRect9 = ((): { x0: number; x1: number; y0: number; y1: number } | null => {
    const sent9 = cullSentRef9.current;
    if (!visRect9) { cullSentRef9.current = null; return null; }
    if (sent9) {
      const inside9 = visRect9.x0 >= sent9.x0 && visRect9.x1 <= sent9.x1 && visRect9.y0 >= sent9.y0 && visRect9.y1 <= sent9.y1;
      const aSent9 = (sent9.x1 - sent9.x0) * (sent9.y1 - sent9.y0);
      const aVis9 = (visRect9.x1 - visRect9.x0) * (visRect9.y1 - visRect9.y0);
      if (inside9 && aSent9 <= aVis9 * 20) return sent9;
    }
    // 여유 — PC는 앞뒤 한 화면씩(3×3), 폰은 반 화면씩(2×2): 설계도 한 장의 op 수·메모리가 그만큼 준다.
    const mk9 = DEV9.cullMargin;
    const mx9 = (visRect9.x1 - visRect9.x0) * mk9;
    const my9 = (visRect9.y1 - visRect9.y0) * mk9;
    const r9 = {
      x0: Math.max(-0.05, visRect9.x0 - mx9), x1: Math.min(1.05, visRect9.x1 + mx9),
      y0: Math.max(-0.05, visRect9.y0 - my9), y1: Math.min(1.05, visRect9.y1 + my9),
    };
    cullSentRef9.current = r9;
    return r9;
  })();
  /* ★★ 프레임은 워커(설계 일꾼)가 낸다. 여기서는 화면 쪽 입력(상자 크기·기울기·시점·색·품질·시야)을 건넨다.
     배율·팬 자체는 안 건넨다 — 낮은 배율의 간이화는 붓이 한다. */
  const engView9: EngineView9 = {
    mapW: mapRef.current?.clientWidth ?? 320, mapH: mapRef.current?.clientHeight ?? 220, tilePx,
    pitched, pitchFlat, geom: pitchGeom(),
    viewTeam, visAll, fogOn, colors: colorTable9,
    qAnim, qBuildFx, qDeath, clickFx,
    cull: cullRect9,
    crowd: CROWD9.lv,
    // `#noscan` 해시(도구용) — 두리번을 끈다.
    ...(typeof location !== "undefined" && /noscan/.test(location.hash) ? { noIdleScan: true } : {}),
  };
  /* 시점 입력이 바뀌면 워커에도 알린다 — 색표는 참조로, 나머지는 값으로 견준다.
     열쇠 만들기는 모듈 자리의 viewKeyOf9다 — 손짓 중에 손끝 기하로 다시 보내는 자리(postLiveView9)와
     **같은 자**를 써야 한다. 둘이 갈리면 같은 시야를 두 번 보내거나 바뀐 시야를 안 보낸다. */
  /* ★ **손짓 중에는 이 자리도 손끝 기하로 잰다**(지적: "역행이 0이어야 했잖아") ───────────────────────
     보내는 자리가 둘이라는 것을 놓쳤다 — 여기(렌더가 부른다)와 postLiveView9(손짓이 부른다). 손짓 중에는
     상태(pan·zoom)가 얼어 있으므로 여기서 만드는 geom은 **손짓이 시작된 자리의 원점**이다. 그런데 React는
     손짓 중에도 REACT_STEP_MS9(100ms)마다 렌더가 도니, 그때마다 얼어붙은 열쇠가 라이브 열쇠와 달라
     "시야가 바뀌었다"가 되어 **옛 원점을 새 차례·새 세대로** 보냈다. 고르기는 세대가 올랐으니 그것을 그리고,
     다음 라이브 전송에 원점이 도로 앞으로 간다 — 세대는 앞으로 가는데 원점만 뒤로 가는 그 역행이다.
     (세대 단조는 원점 단조가 아니다. 앞 판이 못 잡은 까닭이 이것이다.)
     그러니 손짓이 원근을 따라가는 동안에는 여기서도 **손끝 기하**로 열쇠를 만들고 그것을 보낸다 — 대개
     라이브가 방금 보낸 것과 같은 열쇠라 아무것도 안 보내게 된다. 손을 떼면 저절로 종전 자리로 돌아온다. */
  const liveGeom9 = xfGestureRef.current && liveViewOkRef9.current ? pitchGeomLiveRef9.current : null;
  const sendView9: EngineView9 = liveGeom9 ? { ...engView9, geom: liveGeom9() } : engView9;
  const viewKey9 = viewKeyOf9(sendView9);
  /* 손짓 중에 보낼 밑감 — 렌더마다 최신으로 갈아 둔다(손짓 중에는 렌더가 안 도니 마지막 것이 곧 지금 것이다). */
  engViewRef9.current = engView9;
  colorTableRef9.current = colorTable9;
  {
    const w9 = frameWorkerRef.current;
    const sent9 = viewSentRef9.current;
    if (w9 && (!sent9 || sent9.key !== viewKey9 || sent9.colors !== colorTable9)) {
      viewSentRef9.current = { key: viewKey9, colors: colorTable9 };
      // 버퍼는 안 비운다 — 새 차례의 장이 도착하면 그 시각 이후의 옛 장만 밀려난다(위 프레임 받기).
      wStatRef.current.sentView += 1;
      // 안개 갈래 — 안개 판의 내용을 정하는 셋(시야 주인·전체시야·안개 켬)이 바뀔 때만 오른다(팬·줌으로는 안 오른다).
      const fogKey9 = `${engView9.viewTeam}|${engView9.visAll ? 1 : 0}|${engView9.fogOn ? 1 : 0}`;
      const fq9 = fogSeqRef9.current;
      if (fq9.key !== fogKey9) { fq9.key = fogKey9; fq9.seq += 1; }
      w9.postMessage({ type: "view", view: sendView9, seq: wStatRef.current.sentView, fogSeq: fq9.seq, ...(liveGeom9 ? { live: true } : {}) });
    }
  }
  /* 명령(요청: 주인 → 설계 일꾼, 바뀔 때만) — 재생/정지·배속·탐색. 탐색은 "보낸 명령으로 예측한 시각과 지금 t의
     차"로 안다(0.3초 또는 배속×0.15초). 시계가 무거운 프레임에 밀려 처지면 그것도 같은 자로 다시 맞춘다. */
  const playing9 = playing && active;
  {
    // #diag=brush — 인스턴스 번호와 재생 뒤집힘(위 PLAY_FLIPS9)
    if (instIdRef9.current === 0) { INST_SEQ9 += 1; instIdRef9.current = INST_SEQ9; }
    brushInst9 = instIdRef9.current;
    if (lastPlaying9.current !== playing9) {
      if (lastPlaying9.current !== null) { PLAY_FLIPS9.push({ at: performance.now(), inst: instIdRef9.current, on: playing9 }); if (PLAY_FLIPS9.length > 60) PLAY_FLIPS9.splice(0, PLAY_FLIPS9.length - 60); }
      lastPlaying9.current = playing9;
    }
  }
  cmdNowRef9.current = { playing: playing9, t, speed };
  // 밖에서 t가 바뀌었으면(탐색) 틱의 살아 있는 시계도 거기로.
  if (t !== tFromTickRef9.current) tLiveRef9.current = t;
  {
    // #diag=view — 렌더마다 보기 상태를 견줘 바뀐 것만 적는다(위 viewDiag9).
    const d9 = viewDiag9.current;
    const cur9: Record<string, string> = {
      pan: `${pan.x.toFixed(1)},${pan.y.toFixed(1)}`, zoom: zoom.toFixed(3), stage: `${stage.w}x${stage.h}`,
      budget: String(frameMaxH), ih: String(typeof window !== "undefined" ? window.innerHeight : 0),
    };
    for (const k9 of Object.keys(cur9)) if (d9.last[k9] !== undefined && d9.last[k9] !== cur9[k9]) viewDiagPush9(k9, cur9[k9]);
    d9.last = cur9;
  }
  {
    const w9 = frameWorkerRef.current;
    const c9 = cmdSentRef9.current;
    const pred9 = c9 ? (c9.playing ? c9.t0 + ((pNow() - c9.at) / 1000) * c9.speed : c9.t0) : Number.NaN;
    const jumped9 = !c9 || Math.abs(t - pred9) > Math.max(0.3, 0.15 * speed);
    /* 심장박동 — 재생 중엔 1초마다 한 번은 보낸다(값이 그대로여도). 워커는 마지막 명령 뒤 2.5초까지만 제 시계로
       굴리므로, 주인이 멎으면(굽기 홀드·백그라운드) 워커도 곧 선다. */
    const beat9 = !!c9 && playing9 && pNow() - c9.at > 1000;
    if (w9 && (!c9 || c9.playing !== playing9 || c9.speed !== speed || jumped9 || beat9 || DEV9_DIRTY9.v)) {
      DEV9_DIRTY9.v = false;   // 단이 바뀐 뒤 첫 cmd가 새 앞 한도를 싣는다(위 applyBenchTier9)
      cmdSentRef9.current = { playing: playing9, t0: t, speed, at: pNow() };
      wStatRef.current.sentCmd += 1;
      // 앞으로 지어 둘 한도는 기기가 정한다 — 폰은 2초·5MB(스크린샷 한 번의 요동에도 터진다), PC는 3초·10MB.
      w9.postMessage({
        type: "cmd", playing: playing9, t0: t, speed,
        aheadSec: DEV9.aheadSec, aheadBytes: DEV9.aheadMB * 1024 * 1024,
      });
    }
  }
  /** 설계도 고르기 — t보다 앞서지 않은 것 중 가장 늦은 것, 없으면 바로 뒤의 것. 2초 안이면 낡아도 든다(빈 화면보다
   *  낫다). 그 밖(탐색 직후 옛 자리)은 안 든다 — 마지막에 쓴 프레임을 든 채 새 것을 기다린다. */
  const pickWorkerFrame9 = (tNow9: number): PackedFrame9 | null => {
    const frames9 = wFramesRef.current;
    if (frames9.size === 0) return null;
    const near9 = Math.max(2, speed * 2);
    /* 새 세대 먼저(위 genSeenRef9) — 새 세대의 장이 지금 시각 이하에 하나라도 있으면 그 세대에서만 고른다. 아직 없으면
       (첫 장이 앞에 있거나 오는 중) 옛 세대의 가장 늦은 장으로 잇는다. 세대를 섞어 번갈아 고르는 일이 없다. */
    /* ★ 고르는 자를 **'본 가장 높은 세대'에서 '그릴 수 있는 가장 높은 세대'로** 바꾼다(지적: 가벼운 장면에서도
       "시점 되돌림 왔다갔다") ────────────────────────────────────────────────────────────────────────────
       앞 판은 genSeen(받은 것 중 가장 높은 세대)의 장만 후보로 두고, 그 세대에 **지금 시각 이하의 장이 아직
       없으면** 옛 세대에서 '시각이 가장 늦은 장'으로 이었다. 그런데 워커의 시계는 주인보다 조금 앞서므로 새
       세대의 첫 장은 흔히 앞에 떨어진다 — 그러면 한 프레임은 옛 세대(옛 원점), 다음 프레임은 새 세대(새 원점),
       그 다음에 또 새 세대가 앞에 떨어지며 옛 세대… 로 **원점이 앞뒤로 오간다**. 손짓 중에는 세대가 프레임마다
       나므로 그 왕복이 곧 시점이 왔다갔다 하는 그림이다.
       이제 '지금 시각 이하'인 장들 가운데 **세대가 가장 높은 것**을 고르고, 같은 세대 안에서 가장 늦은 장을
       쓴다. 세대는 단조로 오르므로 원점이 뒤로 가는 일이 없다. 시각이 조금 뒤진 장을 드는 경우가 생기지만,
       그 차는 한 장 간격(수십 ms)이고 어긋난 원근보다 훨씬 덜 보인다. */
    /* ★ **세대는 뒤로 안 간다**(계측: 손끝이 앞으로 가는데 그린 원점이 뒤로 간 걸음 4~8회) ────────────
       고르는 길이 셋인데(지금 시각 이하 / 되돌림 이음쇠 / 앞의 첫 장) 앞의 첫 장 갈래가 **세대를 안 봤다**:
       워커 시계가 주인보다 앞서면 새 장들이 죄다 앞에 떨어지고, 그때 이 갈래가 '가장 이른 장'을 집는데 그것이
       옛 세대일 수 있다 — 그러면 원근이 한 걸음 뒤로 간다. 마지막으로 그린 세대를 기억해 **그보다 낮은 세대는
       후보에서 뺀다**(그런 후보밖에 없으면 어쩔 수 없이 든다 — 빈 화면보다 낫다). 세 갈래가 함께 이 자를 쓴다. */
    /* ★ **없으면 옛 세대로 안 내려간다 — 마지막으로 그린 장을 그대로 둔다**(지적: "장이 늦게 온다 해도
       이전 걸 쓰면 되는데 굳이 옛날 걸 써서 흔들리게 하느냐") ─────────────────────────
       앞 판은 세대 바닥을 지키되 '그 바닥을 넘는 후보가 하나도 없으면 어쩔 수 없이 옛 세대를 든다'는 빗장이
       있었다(anyNew). 그런데 손짓 중에는 워커가 시야 하나마다 다시 서므로 새 세대의 장이 오기 전 잠깐 후보가
       비는 일이 흔하다 — 그때마다 이 빗장이 열려 **옛 원점**의 장을 집었고, 다음 프레임에 새 장이 오면 도로
       돌아왔다. 그것이 남아 있던 역행이다. 빈 화면이 걱정돼 둔 빗장이지만 비지 않는다: 고르기가 아무것도 못
       고르면 붓은 마지막으로 그린 장을 그대로 든다(frameAt9의 lastFrameRef9). 시각이 몇십 ms 멈추는 것은 안
       보이고 원근이 뒤로 갔다 오는 것은 보인다.
       다만 워커가 새로 서면 세대가 0부터 다시 매겨지므로, 남은 장의 세대가 죄다 바닥보다 낮으면(= 세대 자가
       바뀌었다) 바닥을 푼다 — 그러지 않으면 영영 마지막 장에 얼어붙는다. */
    let maxGen9 = -Infinity;
    for (const f9 of frames9.values()) if (f9.gen > maxGen9) maxGen9 = f9.gen;
    if (maxGen9 < drawnGenRef9.current) drawnGenRef9.current = -Infinity;
    const gMin9 = drawnGenRef9.current;
    const pass9 = (f9: PackedFrame9): boolean => f9.gen >= gMin9;
    let bestGen9 = -Infinity;
    let best: PackedFrame9 | null = null;
    let bestOld: PackedFrame9 | null = null;
    for (const f9 of frames9.values()) {
      if (f9.t > tNow9 + 1e-6 || !pass9(f9)) continue;
      if (f9.gen > bestGen9) { bestGen9 = f9.gen; best = f9; }
      else if (f9.gen === bestGen9 && (!best || f9.t > best.t)) best = f9;
    }
    // 옛 세대의 가장 늦은 장 — 아래 '되돌아가지 않기'가 쓰는 이음쇠다(손짓 밖에서만).
    for (const f9 of frames9.values()) {
      if (f9.t > tNow9 + 1e-6 || f9.gen >= bestGen9 || !pass9(f9)) continue;
      if (!bestOld || f9.t > bestOld.t) bestOld = f9;
    }
    /* 되돌아가지 않기(위 lastDrawT9) — 앞으로 가는 중(tNow ≥ 마지막 그린 시각)에 새 세대의 장이 마지막 그린 시각보다
       뒤에 있고 옛 세대에 더 나아간 장이 있으면 옛 세대로 잇는다. 새 세대가 따라잡는 순간 그쪽으로 넘어간다. */
    const ld9 = lastDrawT9.current;
    /* ★ 손짓 중에는 이 되돌림을 **끈다**(같은 지적) — 이 규칙은 "새 세대가 아직 뒤처졌으면 옛 세대로 앞으로
       잇는다"는 뜻인데, 손짓 중의 옛 세대는 **옛 원점**이라 자리가 조금 뒤진 것이 아니라 사영이 통째로 다르다.
       끄는 동안에는 시각의 매끄러움보다 원근이 맞는 편이 낫다 — 40ms 낡은 자리는 안 보이지만 어긋난 원근은
       보인다. 손을 떼면 곧바로 종전 규칙으로 돌아간다. */
    /* ★ 되돌리더라도 **원점이 같은 장으로만**(지적: "놓으면 딱 한 번 이전으로 돌아갔다가 오는듯") ────────
       손을 뗀 그 프레임에 이 규칙이 되살아나(손짓 중에는 꺼 둔다) 시각이 더 나아간 옛 세대의 장을 집는데,
       그 장은 **옛 원점**이라 원근이 한 걸음 뒤로 갔다가 다음 장에서 돌아온다 — 놓을 때 딱 한 번 나던 그
       왕복이다. 이 규칙의 뜻은 '세대가 갈렸어도 시각은 앞으로 잇자'이지 '원근을 되돌리자'가 아니므로,
       원점이 같은 장(탐색·배속처럼 시야가 안 바뀐 세대 전환)에만 건다. */
    if (!xfGestureRef.current
      && best && bestOld && bestOld.ox === best.ox && bestOld.oy === best.oy
      && tNow9 >= ld9 - 1e-6 && best.t < ld9 - 1e-6 && bestOld.t > best.t) best = bestOld;
    if (!best) best = bestOld;
    if (best && tNow9 - best.t <= near9) return best;
    /* 앞의 첫 장 — 여기도 **세대가 가장 높은 것 먼저**다(위 ★). 같은 세대 안에서 가장 이른 장. */
    let next: PackedFrame9 | null = null;
    let nextGen9 = -Infinity;
    for (const f9 of frames9.values()) {
      if (f9.t < tNow9 || !pass9(f9)) continue;
      if (f9.gen > nextGen9) { nextGen9 = f9.gen; next = f9; }
      else if (f9.gen === nextGen9 && (!next || f9.t < next.t)) next = f9;
    }
    if (next && next.t - tNow9 <= near9) return next;
    return null;
  };
  /** 설계도 풀기 — 그릴 장만 푼다(한 번 푼 것은 붙여 둔다). 안개는 장에 실렸으면 그것, 아니면 그 시각 이하 가장
   *  늦은 안개 판, 그것도 없으면 마지막 프레임의 것. */
  /** 이 장(제 안개 판이 없는 장)에 붙일 안개 판 — 그 시각 이하 가장 늦은 판. */
  const fogSnapFor9 = (t9: number, fseq9: number): { explored: Uint16Array | null; visNow: Uint8Array | null; visSrc: Float32Array } | null => {
    const snaps9 = fogSnapsRef9.current;
    const cells9 = grid.width * grid.height;
    let any9: (typeof snaps9)[number]["fog"] | null = null;
    for (let i9 = snaps9.length - 1; i9 >= 0; i9 -= 1) {
      const sf9 = snaps9[i9];
      if (!(sf9.t <= t9 + 1e-6 && (!sf9.fog.explored || sf9.fog.explored.length === cells9))) continue;
      if (sf9.fseq === fseq9) return sf9.fog;   // 같은 갈래의 가장 늦은 판
      if (!any9) any9 = sf9.fog;                 // 같은 갈래가 아직 없으면 아무 판(옛 갈래)이라도 — 빈 안개보다 낫다
    }
    return any9;
  };
  /** ★ **안개는 제 흐름이다 — 판끼리 잇는다**(4차 계측: 역행0/60 · 떨림 비1.2 · 전환17) ────
   *  빗장으로 되돌아감은 멎었는데 떨림이 '잘아진 채' 남았다(지적). 남은 것은 **걸음의 들쭉날쭉**
   *  이다: 예순 장 중 열여섯(앞장8 안맞음8)이 이음 없이 생짜 판으로 툭 건너뛴다.
   *  까닭은 구조에 있었다 — 눈 목록을 **프레임 짝**(앞 장·뒤 장)에서 뽑았다. 안개 판은 프레임
   *  보다 성기게 실리므로 두 프레임이 같은 판을 들면 이을 것이 없고(앞장), 프레임 짝이 우연히
   *  건너뛴 두 판을 물면 짝짓기가 어긋난다(안맞음). 프레임의 박자는 안개의 박자가 아니다.
   *  안개 판은 제 시각을 지닌 제 흐름이니 **판끼리** 이으면 그 둘이 통째로 사라진다: 지금 시각을
   *  감싸는 이웃한 두 판을 골라 그 사이를 잇는다. 워커가 앞으로 지어 두므로 뒤 판은 대개 있다.
   *  갈래(fseq)가 같고 간격이 0.6초 안일 때만 — 성기게 든 옛 판끼리 이으면 반 초를 가로지른다. */
  const fogPairFor9 = (t9: number, fseq9: number): { a: Float32Array; b: Float32Array | null; ta: number; tb: number } | null => {
    /* ★ 프레임마다 온 눈(eyeSnapsRef9)이 있으면 **그것으로** 잇는다 — 장 간격이 40ms라 몸과 같은
       결이다(지적: "비행유닛·부양건물에서 떨림" — 엔진 eyes9 ★). 안개 판은 그것이 없을 때의 예비다. */
    const es9 = eyeSnapsRef9.current;
    let ie9 = -1;
    for (let k9 = es9.length - 1; k9 >= 0; k9 -= 1) {
      const e9 = es9[k9];
      if (e9.t <= t9 + 1e-6 && e9.fseq === fseq9 && e9.vis.length > 0) { ie9 = k9; break; }
    }
    if (ie9 >= 0) {
      const e09 = es9[ie9];
      let e19: (typeof es9)[number] | null = null;
      for (let k9 = ie9 + 1; k9 < es9.length; k9 += 1) {
        const e9 = es9[k9];
        if (e9.fseq !== fseq9 || e9.vis.length === 0) continue;
        if (e9.t > e09.t + 1e-6) { e19 = e9; break; }
      }
      if (e19 && (e19.t - e09.t > 0.6 || e19.t <= t9)) e19 = null;
      return { a: e09.vis, b: e19 ? e19.vis : null, ta: e09.t, tb: e19 ? e19.t : e09.t };
    }
    const snaps9 = fogSnapsRef9.current;
    let i9 = -1;
    for (let k9 = snaps9.length - 1; k9 >= 0; k9 -= 1) {
      const sf9 = snaps9[k9];
      if (sf9.t <= t9 + 1e-6 && sf9.fseq === fseq9 && sf9.fog.visSrc.length > 0) { i9 = k9; break; }
    }
    if (i9 < 0) return null;
    const s09 = snaps9[i9];
    let s19: (typeof snaps9)[number] | null = null;
    for (let k9 = i9 + 1; k9 < snaps9.length; k9 += 1) {
      const sf9 = snaps9[k9];
      if (sf9.fseq !== fseq9 || sf9.fog.visSrc.length === 0) continue;
      if (sf9.t > s09.t + 1e-6) { s19 = sf9; break; }
    }
    if (s19 && (s19.t - s09.t > 0.6 || s19.t <= t9)) s19 = null;
    return { a: s09.fog.visSrc, b: s19 ? s19.fog.visSrc : null, ta: s09.t, tb: s19 ? s19.t : s09.t };
  };
  const decodeFrame9 = (pf9: PackedFrame9): Frame9 => {
    if (pf9.dec) {
      /* ★ 안개 판을 **다시 고른다**(지적: "안개가 가끔 엄청 떨리는 경우 있음 — 드래그하거나 시간 지나면 없어짐") —
         보간의 뒤 장(B)은 앞 장으로 쓰이기 전에 미리 풀린다. 그때 그 시각의 안개 판이 아직 안 왔으면 한 판 전
         안개를 쥔 채 굳고(dec 캐시), 판이 온 뒤 새로 푸는 장들은 새 판을 쥔다. 그래서 잇단 장이 옛 판·새 판을
         번갈아 들어 안개가 한 판씩 앞뒤로 튀었다 — 그것이 '떨림'이고, 끌기(장을 버림)나 시간이 지나면(옛 장이
         걷힘) 저절로 멎었다. 제 판이 없는 장은 쓸 때마다 '그 시각 이하 가장 늦은 판'을 다시 물어 갈아 든다. */
      if (!pf9.fog) {
        const nf9 = fogSnapFor9(pf9.t, pf9.fseq);
        if (nf9 && nf9.visSrc !== pf9.dec.visSrc) { pf9.dec.explored = nf9.explored; pf9.dec.visNow = nf9.visNow; pf9.dec.visSrc = nf9.visSrc; }
      }
      return pf9.dec;
    }
    const body9 = unpack9({ buf: pf9.buf, strs: pf9.strs }) as Pick<Frame9, "unitOps" | "fxOps" | "miniExtra" | "gasBusy">;
    let fog9 = pf9.fog ?? fogSnapFor9(pf9.t, pf9.fseq) ?? undefined;
    if (!fog9) {
      /* 이 시각 이하의 판이 없으면(막 시작·탐색 직후) **가장 최근 판**이라도 붙인다 — 없을 때 '다 걷힘'으로
         떨어지던 것이 처음의 깜빡임이었다. 지도 크기가 맞는 판만. */
      const snaps9 = fogSnapsRef9.current;
      const cells9 = grid.width * grid.height;
      let any9: { explored: Uint16Array | null; visNow: Uint8Array | null; visSrc: Float32Array } | null = null;
      for (let i9 = snaps9.length - 1; i9 >= 0; i9 -= 1) {
        const sf9 = snaps9[i9];
        if (!sf9.fog.explored || sf9.fog.explored.length === cells9) { any9 = sf9.fog; break; }
      }
      /* ★ **차례를 뒤집는다**(지적: "가끔 안개가 뒤 시각의 안개로 왔다갔다 흔들린다") ─────────────────
         위 any9는 시각을 안 보고 고른 **가장 최근** 판이라, 워커가 앞서 지어 둔 장의 안개 —
         곧 **미래의 안개**다. 여태 그것을 먼저 집었으므로, 제 판이 아직 안 온 장은 미래로 한 번
         튀었다가 다음 장에서 제자리로 돌아왔다. 잇달아 그러면 두 시각 사이를 오가는 흔들림이다.
         이어야 할 것은 **지금 화면에 있는 안개**다 — 마지막으로 그린 장의 것이면 튀는 일이 없고,
         제 판이 오는 순간 조용히 갈린다. 미래 판은 그릴 것이 아예 없는 **첫 로딩**의 몫으로만 남긴다
         (그 자리가 원래 any9를 둔 까닭이다 — '다 걷힘'으로 떨어지는 첫 깜빡임 막기). */
      const lf9 = lastFrameRef9.current[1] ?? lastFrameRef9.current[0];
      const last9 = (lf9 && lf9.explored && lf9.explored.length === cells9
        ? { explored: lf9.explored, visNow: lf9.visNow, visSrc: lf9.visSrc } : null) ?? any9;
      fog9 = last9 ? { explored: last9.explored, visNow: last9.visNow, visSrc: last9.visSrc }
        : { explored: null, visNow: null, visSrc: new Float32Array(0) };
    }
    pf9.dec = {
      t: pf9.t, unitOps: body9.unitOps, fxOps: body9.fxOps, miniExtra: body9.miniExtra, gasBusy: body9.gasBusy,
      explored: fog9.explored, visNow: fog9.visNow, visSrc: fog9.visSrc,
      eyes: pf9.eyes ?? EMPTY_FRAME9.eyes,
    };
    return pf9.dec;
  };
  /** 바로 뒤의 설계도(t보다 앞선 것 중 가장 이른 것, 0.6초 안) — 보간의 끝점. */
  const pickNextFrame9 = (a9: PackedFrame9): PackedFrame9 | null => {
    let next: PackedFrame9 | null = null;
    for (const f9 of wFramesRef.current.values()) {
      if (f9.gen !== a9.gen) continue;   // 보간의 뒤 장은 같은 세대에서만(위 세대 경계)
      if (f9.t <= a9.t + 1e-6) continue;
      if (!next || f9.t < next.t) next = f9;
    }
    return next && next.t - a9.t <= 0.6 ? next : null;
  };
  /** ★ 두 설계도 사이 **보간**(지적: "툭툭 살짝씩 순간이동") ─────────────────────────────────────────
   *  붓이 t 이하 가장 늦은 장을 그대로 쓰면 장 간격(워커 박자 40ms, 밀리면 100ms 넘게)만큼 자리가 뛴다. 앞 장(a)과
   *  뒤 장(b)에서 같은 개체(lerpKey9)를 찾아 자리·방향을 t의 비율로 섞는다 — 장 밀도와 무관하게 매끄럽다. 뒤 장이
   *  없으면(워커가 뒤처짐) 앞 장 그대로. 자세·z·알파는 앞 장 것이다. 보간 op는 장마다 한 번 복사해 두고 제자리에서
   *  값만 바꾼다(그리기마다 객체를 안 만든다). */
  const lerpFrame9 = (a9: PackedFrame9, tNow9: number, slot9: 0 | 1): Frame9 => {
    const fa9 = decodeFrame9(a9);
    const bs9 = brushStatRef9.current;
    if (tNow9 <= a9.t + 1e-6) { fogWhy9 = "제장"; return fa9; }
    const b9 = pickNextFrame9(a9);
    if (!b9) {
      bs9.noB += 1;
      for (const f9 of wFramesRef.current.values()) if (f9.t > a9.t + 0.6) { bs9.gapB += 1; break; }
      /* ★ **뒤 장이 없어도 눈 목록은 안 되돌린다**(같은 지적: "과거의 자리로 당겨졌다 다시 돌아와") ──
         여기가 떨림의 큰 몫이었다(계측: 뒤장없음 57). 워커가 한 박자 뒤처지면 이 문으로 나가 앞 장
         **생짜**를 돌려줬는데, 직전 틱은 앞 장보다 u9만큼 앞선 이은 목록을 냈으므로 그 차이가 곧
         뒤로 당김이다. 이제는 직전에 낸 목록을 든 채 넘긴다(최대 네 틱, 눈 수가 같을 때만).
         앞 장 자체(fa9)는 캐시에 든 그 장이라 건드리면 안 되므로 껍데기 하나에 담아 낸다. */
      /* (걷어냄) 여기서 **직전 목록을 들고 가던** 갈래 — 위 이음 자리와 같은 까닭이다(계측이
         집었다: 6배 역행6/60 최대225ms(듦)). 든 목록은 몇 틱 전의 것이라 드는 순간이 곧 역행일
         수 있다. 앞 장 생짜는 늘 실재하는 장의 것이니 그것을 쓴다. */
      /* 이 갈래도 **출구의 단조 빗장**을 지난다(아래 ★) — 뒤 장이 없다고 앞 장 생짜로
         떨어지면 그것 역시 되돌아가는 걸음이다. 앞 장 자체(fa9)는 캐시에 든 그 장이라
         못 건드리므로, 빗장이 걸릴 때만 껍데기 하나에 담아 낸다. */
      fogWhy9 = "뒤장없음";
      const mb9 = visMonoRef9.current[slot9];
      /* 여기서도 프레임이 든 것이 아니라 **그 시각의 안개 판**을 쓴다(위 fogPairFor9의 ★). */
      const fpb9 = fogPairFor9(tNow9, a9.fseq);
      const cb9 = fpb9 ? fpb9.a : fa9.visSrc;
      if (cb9 && cb9.length > 0 && mb9.buf && mb9.t >= 0 && mb9.buf.length === cb9.length) {
        const cbT9 = FOGT9.get(cb9) ?? fa9.t;
        if (cbT9 < mb9.t - 1e-4 && mb9.t - cbT9 < 1) {
          fogWhy9 = "뒤장없음빗장";
          let hf9 = holdFrameRef9.current[slot9];
          if (!hf9) { hf9 = { ...fa9 }; holdFrameRef9.current[slot9] = hf9; }
          else Object.assign(hf9, fa9);
          hf9.visSrc = mb9.buf;
          hf9.visVer = mb9.ver;
          return hf9;
        }
        if (!mb9.buf || mb9.buf.length !== cb9.length) mb9.buf = new Float32Array(cb9.length);
        mb9.buf.set(cb9); mb9.t = cbT9; mb9.ver += 1; FOGT9.set(mb9.buf, cbT9);
      }
      if (cb9 !== fa9.visSrc && cb9.length > 0) {
        let hb9 = holdFrameRef9.current[slot9];
        if (!hb9) { hb9 = { ...fa9 }; holdFrameRef9.current[slot9] = hb9; }
        else Object.assign(hb9, fa9);
        hb9.visSrc = cb9;
        hb9.visVer = undefined;
        return hb9;
      }
      return fa9;
    }
    const fb9 = decodeFrame9(b9);
    const u9 = Math.min(1, (tNow9 - a9.t) / (b9.t - a9.t));
    if (!b9.byKey) {
      b9.byKey = new Map();
      for (const op9 of fb9.unitOps) { const k9 = lerpKey9(op9); if (k9) b9.byKey.set(k9, op9); }
    }
    /* 보간 프레임은 하나를 계속 쓴다 — op 객체는 개체 열쇠별 풀에서 꺼내 앞 장의 값을 덮어쓴다. 그림자 발자국 배열도
       풀 객체의 것을 재사용한다(길이가 다를 때만 새로). 열쇠 없는 op(효과·장식)는 앞 장 객체 그대로. */
    const pool9 = lerpPoolRef9.current[slot9];
    let lf9 = lerpFrameRef9.current[slot9];
    if (!lf9) { lf9 = { frame: { ...fa9 }, ops: [] }; lerpFrameRef9.current[slot9] = lf9; }
    /* ★ op **배열은 그리기마다 새로** 만든다(지적: "뮤탈리스크가 아예 안 그려짐") — 붓의 정렬 캐시가 배열의 정체성으로
       '같은 ops면 다시 안 정렬'하므로, 배열 하나를 되쓰면 첫 그리기의 목록이 영영 남아 뒤에 시야에 든 개체가 안 그려진다.
       객체는 풀에서 되쓰고 배열 하나만 새로 — 그리기당 할당 하나다. */
    const ops9: UnitDrawOp[] = [];
    lf9.ops = ops9;
    const src9 = fa9.unitOps;
    for (let i9 = 0; i9 < src9.length; i9 += 1) {
      const s9 = src9[i9];
      const k9 = lerpKey9(s9);
      if (!k9) { ops9.push(s9); continue; }
      let o9 = pool9.get(k9);
      if (!o9) { o9 = { ...s9 }; if (s9.shadowPts) o9.shadowPts = s9.shadowPts.slice(); pool9.set(k9, o9); }
      else {
        const keep9 = o9.shadowPts;
        // 앞 장에 없는 필드는 지운다(lit·selRing·hpFrac 같은 선택 필드가 옛 장 값으로 남으면 안 된다).
        for (const k9 in o9) if (!(k9 in s9)) delete (o9 as unknown as Record<string, unknown>)[k9];
        Object.assign(o9, s9);
        if (s9.shadowPts) {
          if (keep9 && keep9.length === s9.shadowPts.length) {
            for (let j9 = 0; j9 < keep9.length; j9 += 1) keep9[j9] = s9.shadowPts[j9];
            o9.shadowPts = keep9;
          } else o9.shadowPts = s9.shadowPts.slice();
        } else if (keep9) delete o9.shadowPts;
      }
      const n9 = b9.byKey.get(k9);
      if (n9) {
        o9.fx = s9.fx + (n9.fx - s9.fx) * u9;
        o9.fy = s9.fy + (n9.fy - s9.fy) * u9;
        if (s9.baseFy !== undefined && n9.baseFy !== undefined) o9.baseFy = s9.baseFy + (n9.baseFy - s9.baseFy) * u9;
        if (s9.rotDeg !== undefined && n9.rotDeg !== undefined) o9.rotDeg = lerpAng9(s9.rotDeg, n9.rotDeg, u9);
        if (s9.headDeg !== undefined && n9.headDeg !== undefined) o9.headDeg = lerpAng9(s9.headDeg, n9.headDeg, u9);
        if (s9.rise !== undefined && n9.rise !== undefined) o9.rise = s9.rise + (n9.rise - s9.rise) * u9;
        /* 들썩임(고치의 liftK)도 잇는다(지적: "고치 바운스 잔떨림 심해짐") — 높은 배속에서는 장 하나가 경기 시간
           반 초를 덮어, 장마다 굳은 사인값이 그대로 튀었다. 두 장 사이를 이으면 배속과 무관하게 매끄럽다. */
        if (s9.liftK !== undefined && n9.liftK !== undefined) o9.liftK = s9.liftK + (n9.liftK - s9.liftK) * u9;
        if (s9.pulseK !== undefined && n9.pulseK !== undefined) o9.pulseK = s9.pulseK + (n9.pulseK - s9.pulseK) * u9;
        const sp9 = s9.shadowPts; const np9 = n9.shadowPts; const op9 = o9.shadowPts;
        if (sp9 && np9 && op9 && sp9.length === np9.length && op9.length === sp9.length) {
          for (let j9 = 0; j9 < sp9.length; j9 += 1) op9[j9] = sp9[j9] + (np9[j9] - sp9[j9]) * u9;
        }
      }
      ops9.push(o9);
    }
    // 풀이 너무 크면(개체가 오래 사라짐) 비운다 — 다음 장에서 다시 찬다.
    if (pool9.size > src9.length * 3 + 200) pool9.clear();
    const fr9 = lf9.frame;
    fr9.t = fa9.t; fr9.unitOps = ops9; fr9.fxOps = fa9.fxOps; fr9.miniExtra = fa9.miniExtra; fr9.gasBusy = fa9.gasBusy;
    /* ★ **럴커 가시의 위상도 잇는다**(요청: "애니메이션 프레임이 너무 적은 듯 — 프레임 늘려서 부드럽게") ──
       효과 op은 여태 앞 장 것을 그대로 썼다. 유닛은 두 장 사이를 이어 매끄러운데 가시는 워커 장 박자
       (30장/초, 폰은 그 아래)로만 위상이 바뀌고, 6배속에서는 장 하나가 경기 시간 0.2초라 한 낱개의
       창(0.17초)을 통째로 건너뛰었다 — 그것이 '프레임이 적다'다. 프레임을 늘리는 길은 워커가 아니라 여기다:
       뒤 장에 같은 자리(버로우한 몸이라 자리가 같다)의 가시가 있으면 그 위상까지 u9만큼 잇는다. 위상은
       앞으로만 돈다(감싸기). 한 장 사이에 반 바퀴 넘게 갔으면 딴 사격이라 안 잇는다. */
    if (fa9.fxOps.length > 0 && fb9.fxOps.length > 0 && fa9.fxOps.some((o9) => o9.kind === "spike")) {
      fr9.fxOps = fa9.fxOps.map((o9) => {
        if (o9.kind !== "spike" || o9.ph === undefined) return o9;
        const m9 = fb9.fxOps.find((b9) => b9.kind === "spike" && b9.ph !== undefined
          && Math.abs(b9.fx - o9.fx) < 1e-4 && Math.abs(b9.fy - o9.fy) < 1e-4);
        if (!m9 || m9.ph === undefined) return o9;
        let d9 = m9.ph - o9.ph;
        if (d9 < 0) d9 += 1;
        if (d9 > 0.5) return o9;
        return { ...o9, ph: (o9.ph + d9 * u9) % 1 };
      });
    }
    fr9.explored = fa9.explored; fr9.visNow = fa9.visNow; fr9.visSrc = fa9.visSrc; fr9.visVer = undefined;
    /* ★ **눈 목록도 잇는다**(지적: "안개 떨림 더 심해짐 — 그려야 할 데이터를 잘 못 찾는 느낌") ──────────────────
       유닛은 앞·뒤 장 사이를 보간해 매끄럽게 걷는데 안개(눈 목록)는 앞 장의 것을 그대로 썼다. 높은 배속에서는 장
       하나가 경기 시간 반 초를 덮으므로 시야 원이 몸에서 떨어져 장마다 툭툭 뛰었다 — 몸은 매끄럽고 안개만 튀니
       떨림으로 읽힌다. 두 장의 눈 수가 같으면(개체 출몰이 없는 대부분의 장) 자리(x·y)를 같은 몫으로 잇는다.
       반지름은 앞 장 것. 배열은 되쓰고(할당 없음) 판 번호(visVer)로 바뀜을 알린다. */
    /* 눈 목록의 짝은 **프레임이 아니라 안개 판**에서 고른다(위 fogPairFor9의 ★). 못 고르면
       종전대로 앞·뒤 장의 것을 쓴다(첫 장·탐색 직후). */
    const fp9 = fogPairFor9(tNow9, a9.fseq);
    const va9 = fp9 ? fp9.a : fa9.visSrc;
    const vb9 = fp9 ? fp9.b : fb9.visSrc;
    const uv9 = fp9 && fp9.b && fp9.tb > fp9.ta
      ? Math.min(1, Math.max(0, (tNow9 - fp9.ta) / (fp9.tb - fp9.ta))) : u9;
    /* ★ 눈 수가 같아도 **같은 눈들인지** 확인한다(지적: "전혀 다른 시점·장소의 안개가 중간중간 교차되며 난리") —
       난전에서는 한 장 사이에 죽는 수와 태어나는 수가 같아 길이만 같은 목록이 흔하다. 그러면 바뀐 자리 뒤의 눈이
       전부 한 칸씩 밀려 이웃의 자리로 미끄러졌다 — 시야 원이 지도를 가로질러 날았다. 눈마다 반지름이 같고 자리
       차이가 한 장에 걸을 수 있는 만큼(3타일) 안일 때만 잇고, 하나라도 어긋나면 앞 장 것을 그대로 쓴다. */
    const vl9 = visLerpRef9.current[slot9];
    /* ★ **짝짓는 자가 너무 헐거웠다**(2차 계측: 3배에서 역행0/59인데 떨림 비 5.3 — 시각은 한
       번도 안 되돌아갔는데 눈이 곧은 거리의 다섯 배를 걸었다) ────────────────────────────────
       시간이 아니라 **옆으로** 새고 있었다는 뜻이고, 눈이 옆으로 샐 자리는 하나뿐이다 — 앞·뒤
       장의 눈을 **차례(index)로 짝짓는 것**. 목록에 신원이 없으므로 한 장 사이에 하나가 죽고
       하나가 태어나면 그 뒤의 눈이 전부 한 칸씩 밀리고, 그 밀린 짝이 **'반지름 같음 + 3타일
       안'** 이라는 문을 그냥 통과한다. 본진·밭에서는 같은 종류가 서로 3타일 안에 서 있는 것이
       예사라, 이 문은 사실상 안 걸린 것과 같았다 — 시야 원이 이웃의 자리로 끌려갔다 제자리로
       돌아오기를 되풀이한다. 지적한 "과거의 자리로 당겨졌다 다시 돌아와"가 이것이다(과거가
       아니라 **이웃**의 자리였다).
       문을 **한 장에 실제로 걸을 수 있는 만큼**으로 좁힌다: 가장 빠른 몸이 초당 대여섯 타일이니
       두 장 사이 경기 시간 × 5타일, 바닥은 0.3타일이다(장 간격 40ms면 0.2 → 바닥 0.3). 유닛은
       서로 최소 한 타일은 떨어져 서므로 밀린 짝은 이 문을 못 지난다. 배속이 높아 장 간격이 벌면
       문이 그만큼 넓어지지만, 그때는 잇는 것 자체가 덜 중요하다(장이 성기면 원래 뚝뚝 간다).
       ★ 그리고 **전부-아니면-전무로 되돌린다** — 눈마다 가르면 어떤 눈은 이은 자리에, 어떤
         눈은 앞 장 자리에 있게 되고, 그 갈림이 장마다 뒤집히면 그것 자체가 떨림이다. 한 목록은
         한 시각에서 와야 한다. */
    /* ★ **차례가 아니라 신원으로 짝짓는다**(지적: "이제 안개 뒤로 돌림은 없지만 뚝뚝 끊기네") ──
       떨림과 끊김은 같은 구멍의 앞뒤 면이었다. 목록에 신원이 없어 **차례**로 짝지으니 한 판
       사이에 하나가 죽고 하나가 태어나면 뒤의 눈이 전부 한 칸씩 밀려 이웃의 자리로 끌려갔고
       (떨림), 그 밀린 짝을 거르려고 문을 좁히자 목록 전체가 이음을 포기해 판에서 판으로 툭
       건너뛰었다(끊김). 어느 쪽도 고칠 수 없는 것은 **짝이 틀린 것을 짝이 맞는지로 가릴 수
       없기** 때문이다. 그래서 눈 목록에 신원을 실었다(engine9의 eye ★ — 한 눈이 네 칸이다).
       이제 같은 몸끼리만 잇는다: 뒤 판을 신원 → 자리로 한 번 훑어 표를 짓고(판마다 한 번,
       WeakMap에 담아 되쓴다), 앞 판의 눈마다 제 짝을 찾아 잇는다. 짝이 없으면(이 사이에 죽은
       눈) 제자리에 둔다 — 전부-아니면-전무가 필요 없다. 틀린 짝이 아예 안 생기니까.
       목록의 **길이가 달라도 된다** — 그것이 이 판의 요점이다(여태 길이가 다르면 통째로 포기했다). */
    const dt9 = Math.max(1e-3, fp9 && fp9.b ? fp9.tb - fp9.ta : fb9.t - fa9.t);
    /* 신원이 맞아도 한 판에 걸을 수 없는 거리면 안 잇는다 — 태그 되쓰기·순간이동(리콜)
       한 번에 시야 원이 지도를 가로지르는 것만 막는 빗장이다. */
    const tol9 = Math.max(2, dt9 * 12);
    if (va9 && vb9 && va9.length > 0 && vb9.length > 0 && va9 !== vb9) {
      let map9 = VIS_ID9.get(vb9);
      if (!map9) {
        map9 = new Map<number, number>();
        for (let i9 = 0; i9 + 3 < vb9.length; i9 += 4) {
          const id9 = vb9[i9 + 3];
          if (id9 !== 0) map9.set(id9, i9);
        }
        VIS_ID9.set(vb9, map9);
      }
      if (!vl9.buf || vl9.buf.length !== va9.length) vl9.buf = new Float32Array(va9.length);
      const out9 = vl9.buf;
      let hit9 = 0;
      for (let i9 = 0; i9 + 3 < va9.length; i9 += 4) {
        const id9 = va9[i9 + 3];
        const j9 = id9 !== 0 ? map9.get(id9) : undefined;
        const ok9 = j9 !== undefined
          && Math.abs(va9[i9] - vb9[j9]) <= tol9 && Math.abs(va9[i9 + 1] - vb9[j9 + 1]) <= tol9;
        if (ok9 && j9 !== undefined) {
          hit9 += 1;
          out9[i9] = va9[i9] + (vb9[j9] - va9[i9]) * uv9;
          out9[i9 + 1] = va9[i9 + 1] + (vb9[j9 + 1] - va9[i9 + 1]) * uv9;
        } else {
          out9[i9] = va9[i9];
          out9[i9 + 1] = va9[i9 + 1];
        }
        out9[i9 + 2] = va9[i9 + 2];
        out9[i9 + 3] = id9;
      }
      vl9.ver += 1;
      /* 이은 목록의 시각은 두 판 시각을 같은 몫으로 섞은 값이다(위 FOGT9의 ★). */
      const ta9 = FOGT9.get(va9) ?? fa9.t;
      const tb9 = FOGT9.get(vb9) ?? fb9.t;
      FOGT9.set(out9, ta9 + (tb9 - ta9) * uv9);
      fogWhy9 = hit9 > 0 ? "이음" : "안맞음";
      fr9.visSrc = out9;
      fr9.visVer = vl9.ver;
    } else {
      fogWhy9 = "앞장";
      if (fp9) fr9.visSrc = va9;
    }
    /* ★ **출구에 단조 빗장**(3차 계측: 역행8/60 최대200ms(앞장) · 전환18) ────────────────────
       짝짓는 문을 죄자 이음이 줄고 **앞장**이 주력이 됐는데, 역행이 정확히 그 앞장에서 났다.
       구조는 이렇다 — 이음은 눈을 뒤 장까지 u9만큼 밀어 놓는다. 다음 틱에 못 이으면(짝이 안
       맞거나 뒤 장이 없으면) 앞 장 **생짜**로 떨어지는데, 그 자리는 방금 민 것보다 최대 한 장
       간격만큼 **뒤**다. 그 왕복이 전환18이고 곧 떨림이다.
       고치는 자리는 갈래 하나하나가 아니라 **출구**다: 이 붓이 내는 목록은 시각이 **뒤로 가지
       않는다**. 방금 낸 목록보다 이른 것이 나오면 그것을 버리고 **방금 낸 것을 그대로 다시**
       낸다 — 멈춘 것은 안 읽히고 되돌아가는 것은 읽힌다(이 판의 결론이다).
       ※ 탐색·세대 갈림으로 시각이 크게 뒤로 가면(1초 넘게) 빗장을 푼다 — 안 그러면 영영 옛
         목록에 얼어붙는다. 눈 수가 바뀐 장도 받는다(다른 목록을 억지로 들 까닭이 없다).
       ※ 낸 목록은 한 벌 **베껴** 둔다 — 이음 버퍼는 다음 틱이 덮어쓰므로 가리키기만 하면
         빗장이 제 것을 잃는다. 눈 400이면 4.8KB 옮기기다. */
    const cand9 = fr9.visSrc;
    const mo9 = visMonoRef9.current[slot9];
    if (cand9 && cand9.length > 0) {
      const cT9 = FOGT9.get(cand9) ?? fa9.t;
      const back9 = mo9.buf !== null && mo9.t >= 0 && cT9 < mo9.t - 1e-4;
      if (back9 && mo9.buf && mo9.t - cT9 < 1 && mo9.buf.length === cand9.length) {
        fogWhy9 = "빗장";
        fr9.visSrc = mo9.buf;
        fr9.visVer = mo9.ver;
      } else {
        if (!mo9.buf || mo9.buf.length !== cand9.length) mo9.buf = new Float32Array(cand9.length);
        mo9.buf.set(cand9);
        mo9.t = cT9;
        mo9.ver += 1;
        FOGT9.set(mo9.buf, cT9);
        fr9.visSrc = mo9.buf;
        fr9.visVer = mo9.ver;
      }
    }
    /* (걷어냄) 눈 수가 바뀐 장에서 **직전 목록을 들고 가던** 갈래 — 계측이 그 자리를 그대로
       집었다(6배: 역행6/60 최대225ms(듦)). 든 목록은 최대 네 틱 전의 것이라, 그 사이에 앞 장
       생짜가 더 늦은 시각으로 지나갔으면 드는 순간이 곧 역행이다. 되돌림을 막으려고 넣은 것이
       되돌림을 만들었다 — 앞 장 생짜가 언제나 더 최신이니 그냥 그것을 쓴다. */
    return fr9;
  };
  /** 시각 t의 프레임 — 설계도를 골라(pickWorkerFrame9) 앞·뒤 장 사이를 보간한다. count9면 붓 통계도 센다(틱). */
  const frameAt9 = (tNow9: number, count9: boolean): Frame9 => {
    const wPacked9 = pickWorkerFrame9(tNow9);
    if (count9) {
      const bs9 = brushStatRef9.current;
      if (bs9.lastT >= 0 && tNow9 > bs9.lastT) { const st9 = (tNow9 - bs9.lastT) * 1000; bs9.stepSum += st9; bs9.stepMax = Math.max(bs9.stepMax, st9); bs9.stepN += 1; }
      bs9.lastT = tNow9;
      bs9.draws += 1;
      if (wPacked9) { if (wPacked9.t === bs9.lastA) bs9.sameA += 1; bs9.lastA = wPacked9.t; }
    }
    if (wPacked9) {
      if (count9) {
        wStatRef.current.used += 1; lastDrawT9.current = wPacked9.t;
        orgNote9(wPacked9.ox, pitchGeomLiveRef9.current?.().ox ?? wPacked9.ox);
        ORG9.gen = wPacked9.gen;
        ORG9.seq = wPacked9.seq;
        if (wPacked9.gen > drawnGenRef9.current) drawnGenRef9.current = wPacked9.gen;
        const dOrg9 = drawnOrgRef9.current;
        if (dOrg9.ox !== wPacked9.ox || dOrg9.oy !== wPacked9.oy) {
          drawnOrgRef9.current = { ox: wPacked9.ox, oy: wPacked9.oy };
          // 원점이 바뀐 장 — 지형 변환을 같은 눈으로 다시 건다(ReplayMapVector의 pitchXf가 drawnOrgRef9를 읽는다).
          mapPaintRef.current?.(zoomRef.current, panRef.current);
          fogTickRef9.current.z = -1;   // 안개도 새 원점으로 다시 칠하게
        }
      }
      // 푼 것은 앞 장(그리는 장)과 뒤 장(보간 끝점)만 들고, 그보다 옛 장의 객체는 놓는다(폰 메모리).
      for (const f9 of wFramesRef.current.values()) {
        if (f9.t < wPacked9.t && f9.dec) { f9.dec = undefined; f9.byKey = undefined; }
      }
      const fr9 = wPacked9.t <= tNow9 ? lerpFrame9(wPacked9, tNow9, count9 ? 1 : 0) : decodeFrame9(wPacked9);
      lastFrameRef9.current[count9 ? 1 : 0] = fr9;
      return fr9;
    }
    if (count9) wStatRef.current.missed += 1;
    return lastFrameRef9.current[count9 ? 1 : 0] ?? lastFrameRef9.current[count9 ? 0 : 1] ?? EMPTY_FRAME9;
  };
  /* 틱의 붓 — 살아 있는 시각으로 프레임을 골라 op·효과를 ref에 두고 유닛 캔버스를 곧장 칠한다(React 없이). */
  paintFnRef9.current = (tNow9: number, rebase9 = false, fogOnly9 = false): void => {
    /* 이 붓 한 장이 든 시간(위 WORK9) — 프레임 틈을 누구 몫인지로 가르는 자다. */
    const bw09 = pNow();
    /* fps 계측(요청: "#diag=fps로 오른쪽 귀퉁이에 프레임 오버레이만 작게") — 붓이 칠한 장을 벽시계 0.5초마다
       세어 SCR_DIAG.fps에 적는다. 진단이 꺼져 있으면 셈만 하고(싸다) 아무것도 안 그린다. */
    if (!fogOnly9) {
      const fm9 = fpsMeterRef9.current;
      fm9.n += 1;
      const now9 = pNow();
      if (now9 - fm9.at >= 500) {
        SCR_DIAG.fps = Math.round((fm9.n * 1000) / (now9 - fm9.at));
        fm9.n = 0;
        fm9.at = now9;
        if (fpsOnlyRef9.current) setFpsTick9((k9) => k9 + 1);
      }
    }
    const fr9 = frameAt9(tNow9, true);
    frameOpsRef9.current = fr9.unitOps;
    frameFxRef9.current = fr9.fxOps;
    opsRef.current = fr9.unitOps;
    crowdTick9(fr9.unitOps.length, pitched);   // 덜어내기 단 — 미달 기기에서 유닛 수만으로(입체는 제 판정)
    /* ★ 손짓 중엔 **기준(xfBase) 자리에** 칠한다(지적: "팬 드래그 뒤 조금 이전 위치의 그림이 그려진다") ─────────
       여태 틱은 손끝 팬으로 칠하고 붓이 임시 변환을 걷었다 — 캔버스 내용과 CSS 변환이 **같은 프레임에 함께** 바뀐다.
       사파리는 캔버스 내용을 변환보다 한 프레임 늦게 올릴 수 있어, 그 프레임엔 옛 내용이 걷힌 변환으로(= 조금
       이전 자리에) 보였다가 다음 프레임에 제자리로 온다. 드래그 내내 틱마다 그 일이 나니 떨림이다.
       그래서 손짓 동안 틱은 기준 자리에 새 장만 칠하고(내용만 바뀜), 걷힌 변환을 **같은 문자열로** 도로 건다 —
       스타일은 결국 안 바뀐 셈이라 합성기가 움직이지 않는다. 기준을 손끝으로 옮기는 일(재기준)은 xfPaintNow 하나가
       제 박자로 한다. */
    /* ★ 안개를 **유닛보다 먼저** 칠한다(지시: "안개를 유닛보다 먼저 세워줘") ─────────────────────────
       유닛 한 장은 폰 난전에서 80ms까지 가는데 안개 한 장은 2.2ms다(실측). 그런데 여태 순서가 반대라,
       무거운 프레임에서 손짓 rAF가 유닛을 미루면(xfPaintNow의 미룸 갈래) 안개까지 함께 미뤄져 못 칠한
       띠가 드러났다. 값싼 쪽이 먼저 서야 굶어도 안 굶는다 — 미루는 갈래에서는 이 붓을 '안개만'으로 부른다. */
    /* ★ 안개도 붓 박자로(지적: "유닛은 부드럽게 움직이는데 안개는 뚝뚝 끊겨서 변하는 느낌") — 안개 층은 React
       props(100ms 박자)로만 다시 그려졌다. 붓이 고른 장의 안개(눈 목록·밝힌 판)가 지난 틱과 다르면 곧장 안개
       층에 넘겨 칠한다 — 워커가 쌓는 안개 판(40ms 간격)이 그대로 화면 박자가 된다. 밝힌 판은 시각으로 거르므로
       같은 판이라도 0.25초마다는 한 번 칠한다. */
    /* 틱이 안 몰 때(멈춤·감기)는 안개를 여기서 안 칠한다 — 그때는 안개 층의 React effect가 렌더마다(깨움 100ms) 상태 t의
       눈 목록으로 칠한다. 여기서도 칠하면 방금 온 장(tLive)과 렌더가 고른 장(t)이 다른 장일 때 두 안개가 번갈아 난다
       (지적: 감을 때 흔들림). 유닛 캔버스는 두 경로가 같은 객체(frameOpsRef9)를 찍으므로 그 문제가 없다. */
    /* 안개도 이 붓이 칠한다(재설계: 그리는 붓 하나) — 유닛과 **같은 장·같은 보기**라 두 층이 어긋날 수가 없다. 눈 목록·
       밝힌 판·보기가 그대로면 건너뛴다(아래 fogTickRef9). */
    FOGM9.gest = xfGestureRef.current;
    {
      /* 손짓이 잇달아 도는 사이만 시간에 더한다 — 손짓 밖의 사이가 섞이면 초당 수가 거짓이 된다. */
      const fnow9 = pNow();
      if (FOGM9.gest && FOGM9.was && FOGM9.last > 0) FOGM9.g.ms += fnow9 - FOGM9.last;
      FOGM9.last = fnow9;
      FOGM9.was = FOGM9.gest;
    }
    fogBin9().brush += 1;
    if (!(fr9.visSrc && fr9.explored && fogPaintRef.current)) fogBin9().nosrc += 1;
    if (fr9.visSrc && fr9.explored && fogPaintRef.current) {
      /* 계측: 지금 칠할 목록이 전 장보다 이른 시각인가(위 FOGBACK9의 ★). 칠할지 말지를
         가리기 **전에** 센다 — 같은 목록이라 건너뛴 장은 뒤로 간 것이 아니므로 여기서
         was가 그대로 유지되는 것이 맞다. */
      /* 이 둘은 **진단이 켜졌을 때만** 돈다 — 떨림 자는 눈 목록을 한 벌 베껴 두고 장마다
         훑으므로(눈 1500이면 18KB·4500번) 평소에 낼 값이 아니다. */
      if (scrDiagOn()) { fogBackTick9(fr9.visSrc); fogJitTick9(fr9.visSrc); }
      const ft9 = fogTickRef9.current;
      // 0.25초 → 0.1초(요청: "안개 그리기 빈도 늘리기") — 밝힌 판·눈 목록이 그대로여도 경기 시간 0.1초마다 한 번은 칠한다.
      const tq9 = Math.floor(tNow9 * 10);
      // 보기(배율·팬)도 본다 — 안개 층의 React effect는 틱이 몰 때 안 칠하므로(driven), 커밋·시야 변화 뒤의 자리는 틱이 맡는다.
      const vz9 = zoomRef.current;
      const vx9 = panRef.current.x;
      const vy9 = panRef.current.y;
      const need9 = fr9.visSrc !== ft9.vis || fr9.visVer !== ft9.ver || fr9.explored !== ft9.explored || tq9 !== ft9.tq
        || ft9.z !== vz9 || ft9.px !== vx9 || ft9.py !== vy9;
      /* ★ 손짓이 도는 동안 안개는 **뜸하게** 칠한다(요청: "이동 시 더 빠르게 시점 변경") ────────────────────
         안개 판은 화면을 통째로 덮는 한 겹이라 한 장 값이 유닛에 맞먹는다. 그런데 끄는 동안 안개가 말하는
         것은 '어디가 밝혀졌나' 하나뿐이고 그건 손끝을 따라 실시간일 까닭이 없다 — 그 사이는 CSS가 같은
         그림을 밀어 준다(유닛 캔버스와 같은 규약). 150ms마다 한 번이면 새로 드러나는 가장자리도 눈에 안 빈다.
         손을 떼면 그 프레임에 제 자리로 한 장 칠한다(endGestureXf). */
      /* ★ 손짓 중에도 **안 죈다**(지적: "제스처 중 유닛층은 괜찮은데 안개만 느리다" → "빼줘")
         ────────────────────────────────────────────────────────────────────────────────
         죄는 근거는 '그 사이는 CSS가 같은 그림을 밀어 준다'였는데, 미는 것만으로는 **새로
         드러나는 가장자리**를 못 채운다 — 안개 판은 그때의 보기만큼만 덮으므로, 끄는 쪽
         가장자리에는 칠한 적 없는 띠가 남는다. 그 띠가 다음 칠까지 버티는 것이 '안개만
         느리다'의 정체다. 유닛 층은 같은 문제를 매 프레임 다시 그려서 푼다.
         이 블록 자체가 붓 한 장 안에 있으므로, 죄지 않으면 **유닛과 정확히 같은 박자**다 —
         붓이 미루는 자리에서는 안개도 함께 미뤄지고, 붓이 매 프레임 그리면 안개도 그렇다.
         한동안 무거운 자리(손짓 한 장 ≥ XF_HEAVY_MS9)에만 죔을 남겨 두었는데, 그 문턱은
         **실측이 아니라 짐작**이었다(그리기 값을 따로 재는 자가 없다). 짐작으로 눈에 보이는
         흠을 남기느니 걷는다 — 정말 무거우면 붓 자체가 미루므로 이 한 겹만 따로 죌 까닭이 없다. */
      const FOG_GEST_MS9 = 0;
      const gnow9 = pNow();
      if (need9 && !(xfGestureRef.current && gnow9 - (ft9.at ?? 0) < FOG_GEST_MS9)) {
        ft9.vis = fr9.visSrc; ft9.ver = fr9.visVer; ft9.explored = fr9.explored; ft9.tq = tq9; ft9.z = vz9; ft9.px = vx9; ft9.py = vy9;
        ft9.at = gnow9;
        const pt09 = pNow();
        fogPaintRef.current(zoomRef.current, panRef.current, { vis: fr9.visSrc, exploredAt: fr9.explored, t: tNow9 });
        fogBin9().pms += pNow() - pt09;
        fogXfRef9.current = { z: vz9, x: vx9, y: vy9 };   // 이 보기로 칠했다 — 임시 변환의 새 기준
        fogBin9().paint += 1;
      } else fogBin9().same += 1;
    }
    /* 창 넘김은 **블록 끝**에서 — 위에서 넘기면 붓은 이 창, 칠은 다음 창에 들어가 '칠 > 붓'이 난다. */
    fogMeterTick9();
    /* 핵 창 계량기는 남는다 — 멈춤을 재는 자라 그림이 어디에 있든 쓸모가 있다.
       시계를 긁어 주던 자(nukeClockTick9)는 걷혔다: 연출이 캔버스의 나이 함수라 맞출 것이 없다. */
    nukeMeterTick9(nukeOnRef9.current, reactStepRef9.current, cmdNowRef9.current.playing);
    /* ★ 안개 캔버스의 임시 변환 — **칠했으면 항등, 안 칠했으면 그 사이의 차**다(위 fogXfRef9).
       여태 무조건 항등으로 지워, 안 칠한 프레임에서 옛 그림이 새 자리에 그냥 섰다. */
    {
      if (mapRef.current) {
        fogXfApply9(mapRef.current, fogXfRef9.current, zoomRef.current,
          panRef.current.x, panRef.current.y, clipBoxRef.current.pitched);
      }
    }
    if (fogOnly9) { WORK9.brush += pNow() - bw09; return; }   // 안개만 청한 부름(위 ★)
    brushAT9 = lastDrawT9.current;
    brushInst9 = instIdRef9.current;
    if (brushSrc9 === "react") brushSrc9 = "tick";   // 부르는 쪽이 안 세웠으면 재생 틱이다
    /* ★ 붓은 **늘 지금 보기(panRef)에** 그린다(요청: "팬·드래그시 실시간으로 모델을 그릴 순 없나 · 안개도") ─────────
       여태 손짓 중에는 기준(xfBase) 자리에 그리고 CSS로만 밀었다. 그러면 새로 드러나는 쪽은 그린 적이 없어 영영 빈다 —
       손을 떼야 채워졌다. 이제 누가 부르든 지금 보기에 그리고, 임시 변환은 '지금 보기 − 그려진 보기'의 차일 뿐이다
       (그린 직후엔 0이라 항등). 못 그린 프레임만 그 차가 남아 CSS가 잇는다. rebase9는 부르는 쪽을 가르는 표식으로만 남는다. */
    void rebase9;
    unitPaintRef.current?.(zoomRef.current, panRef.current, zoomCommitRef.current);
    xfCvXfRef.current = XF_ID9;
    // 유닛은 지금 보기로 칠했다 — 그쪽 임시 변환만 항등으로 되돌린다(안 그러면 두 번 먹는다).
    WORK9.brush += pNow() - bw09;
  };
  const frame9: Frame9 = frameAt9(t, false);
  crowdInit9();   // 진입 때 한 번: 기기 벤치(CROWD9) — 첫 렌더에서 돌고 그 뒤로는 값만 읽는다
  // 워커 상태는 늘 적어 둔다(perf-check가 읽는다) — 문자열 하나라 값이 싸다.
  {
    const c9 = CROWD9;
    const grade9 = (w9: boolean, k9: number): string => (w9 ? (k9 < 1 ? "심한미달" : "미달") : "충분");
    /* 저배율 죔(위 lowZoomTrim9) — 지금 배율에서 실제로 몇 단인지 그대로 찍는다. */
    const tr9 = lowZoomTrim9(zoomRef.current, pitched);
    SCR_DIAG.crowd = `벤치 2D ${c9.bench.toFixed(0)}ms ${grade9(c9.weak, c9.k)} · 3D ${c9.bench3.toFixed(0)}ms ${grade9(c9.weak3, c9.k3)}${c9.force >= 0 ? " 강제" : ""}${CROWD9.re > 0 ? ` ↻${CROWD9.re}` : ""} · ${pitched ? "3D" : "2D"} ${c9.lv}단 ${c9.units}기${tr9 > 0 ? ` · 저배율죔 ${tr9}단` : NO_TRIM9 ? " · 저배율죔 끔" : ""}${THIN9.n > 0 ? ` · 겹침생략 ${THIN9.n - THIN9.drew}/${THIN9.n}기` : ""}${bakeSprint9.v > 1 ? ` · 굽기질주 ×${bakeSprint9.v}` : ""}${!smallDevice9 ? ` · PC ${PC_TIER9.v}단${PC_TIER9.force >= 0 ? "(강제)" : ""}` : ""}`;
    const st9 = wStatRef.current;
    const wait9 = !st9.ready && st9.worldAt > 0 ? (pNow() - st9.worldAt) / 1000 : 0;
    let ahead9 = -1e9;
    let bytes9 = 0;
    for (const f9 of wFramesRef.current.values()) {
      if (f9.t - t > ahead9) ahead9 = f9.t - t;
      bytes9 += f9.buf.byteLength + (f9.fog ? f9.fog.visSrc.byteLength + (f9.fog.explored?.byteLength ?? 0) + (f9.fog.visNow?.byteLength ?? 0) : 0);
    }
    SCR_DIAG.bakew = bakewDiag9();
    SCR_DIAG.worker = `${frameWorkerRef.current ? (st9.ready ? "on" : "준비중") : "off"} got ${st9.got} used ${st9.used} missed ${st9.missed}`
      + ` 짓기 ${st9.buildMs.toFixed(1)}ms op ${st9.ops.toFixed(0)}·${st9.kb.toFixed(0)}KB 앞 ${wFramesRef.current.size > 0 ? Math.max(0, ahead9).toFixed(1) : "-"}s·${wFramesRef.current.size}장·${(bytes9 / 1048576).toFixed(1)}MB`
      + ` 시야 ${cullRect9 ? `${((cullRect9.x1 - cullRect9.x0) * 100).toFixed(0)}×${((cullRect9.y1 - cullRect9.y0) * 100).toFixed(0)}%` : "전체"}`
      + ` [엔진 ${st9.engMs.toFixed(0)} 싸기 ${st9.packMs.toFixed(1)} 안개 ${st9.fogMs.toFixed(0)}ms×${st9.fogN} 리셋 ${st9.resets} 일 ${st9.duty.toFixed(0)}% 시계차 ${st9.skew >= 0 ? "+" : ""}${st9.skew.toFixed(1)}s]`
      + ((): string => {
        const b9 = brushStatRef9.current;
        return ` 붓: t걸음 ${b9.stepN ? (b9.stepSum / b9.stepN).toFixed(0) : "-"}/${b9.stepMax.toFixed(0)}ms 같은장 ${b9.sameA}/${b9.draws} 뒤장없음 ${b9.noB}(틈 ${b9.gapB})`;
      })()
      + ` sent(world ${st9.sentWorld} view ${st9.sentView} cmd ${st9.sentCmd})`
      + (wait9 > 15 ? ` ⚠ 세계 보낸 지 ${Math.round(wait9)}초째 응답 없음` : "")
      + (st9.err ? ` ⚠ ${st9.err}` : "");
  }
  if (typeof window !== "undefined" && !(window as unknown as { __scrDiag?: unknown }).__scrDiag) {
    (window as unknown as { __scrDiag?: unknown }).__scrDiag = SCR_DIAG;
  }
  const unitOps = frame9.unitOps;
  const fxOps = frame9.fxOps;
  /* 첫 안개 판이 오기 전의 자리표 — 전부 '안 본 곳'(FOG_NEVER)·지금 보이는 곳 없음. 지도 크기별로 한 번만 만든다. */
  const fogHold9 = useMemo(() => (fogOn
    ? { explored: new Uint16Array(gw9 * gh9).fill(65535), visNow: new Uint8Array(gw9 * gh9) }
    : null), [fogOn, gw9, gh9]);
  /** 진짜 안개 판을 한 번이라도 받았나 — 받은 뒤로는 위 자리표(전부 안개)를 안 쓴다.
   *  ★ 입체에서 평면으로 **돌아올 때**를 위해서다(요청으로 3D에서는 안개를 끈다) — 갈래가
   *    바뀌면 새 안개 판이 올 때까지 100ms쯤 비는데, 그 사이를 이 자리표로 메우면 지도가
   *    새까맣게 한 번 번쩍인다. 자리표의 몫은 **첫 로딩**의 '밝았다 어두워짐'을 막는 것이고
   *    그건 처음 한 번이면 족하다. 그 뒤의 빈 순간은 안개 없이 지나가는 편이 눈에 낫다. */
  const fogSeenRef9 = useRef(false);
  if (frame9.explored) fogSeenRef9.current = true;
  const exploredAt = frame9.explored ?? (fogSeenRef9.current ? null : fogHold9?.explored) ?? null;
  const visNow = frame9.visNow ?? (fogSeenRef9.current ? null : fogHold9?.visNow) ?? null;
  /** DOM 효과 기록 → 스팬. 죽음 여운(dieat)만은 낮은 배율에서 효과 시트로 보낸다(캔버스 burst는 2배부터). */
  /* 입체(3D)에서 CSS 효과의 자·눕기(지적: "스캔 등 CSS 효과가 눕지 않음 · 피격·사망 등 CSS 효과가 너무
     크게 나옴") — 캔버스 op의 자(unitGlyphPx)는 깊이 배율 pitchK(y)를 먹는데, DOM 효과의 폭은 '지도 폭의
     %'(타일 수)라 깊이를 안 먹었다: 멀리 있는 스캔·스웜·무너짐이 가까운 것과 같은 px로 섰다. 폭에
     pitchK(y)를 곱하고, 땅에 눕는 원(스캔·스웜·착지)은 scaleY(pitchFlat)로 눕힌다. 파는 흙(dig)은 제
     transform(뒤집기·기울기)이 있어 폭만 준다. 모델(FxModel)로 그리는 것(스톰·핵)은 제 사영으로 눕고,
     상자 폭만 같이 준다. 2D에서는 둘 다 항등이다. */
  /* 눕히기 + **좌우 시점 밀림**(지적: "스캔 같은 것도 각도가 너무 수직 — 롤링이 안 먹는달까") — 사영은 바닥의
     깊이(화면 아래 방향 dy)에 tan(시점각)을 곱해 x를 민다(project의 ry·납작비·viewShear). 원판 CSS에는 그것이
     skewX(시점각)이다: 납작하게 누른 뒤(scaleY) 기울인다(skewX) — 변환 목록은 오른쪽부터 먹는다. 시점각은
     지도 x 자리가 정한다(viewYawOf). */
  const groundXf9 = pitched ? { transform: `translate(-50%, -50%) scaleY(${pitchFlat.toFixed(3)})` } : {};
  const groundXfAt9 = (x: number, y: number): { transform?: string } => (pitched
    ? { transform: `translate(-50%, -50%) skewX(${viewYawOf(x, y).toFixed(1)}deg) scaleY(${pitchFlat.toFixed(3)})` }
    : {});
  /* ★ 가운데 맞춤을 **translate 속성**으로 하는 요소용(지적: "스캔, 테란 건물 착지시 동심원효과가 우하단에서 확대
     되는데 중심에서 확대돼야 해") — 키프레임이 개별 `scale` 속성으로 커지는 요소에서 `transform: translate(-50%,-50%)`
     을 쓰면 합성 차례(translate·rotate·scale 속성 → transform 속성, 원점은 상자 가운데)가 원점을 옮겨진 상자의
     **우하단**에 남겨, 거기서 커졌다. 가운데 맞춤을 `translate: -50% -50%`(맨 바깥 단계)로 빼면 scale은 제 가운데에서
     일어난다. 이 요소들의 transform에는 눕히기·밀림만 싣는다(2D는 없음). CSS 규칙 쪽도 같은 규약(translate 속성). */
  const groundSkewAt9 = (x: number, y: number): { transform?: string } => (pitched
    ? { transform: `skewX(${viewYawOf(x, y).toFixed(1)}deg) scaleY(${pitchFlat.toFixed(3)})` }
    : {});
  /* (걷어냄) DOM 효과 스팬 — 전부 캔버스 fx(kind "dom", drawDomFx9)로 옮겼다(요청: "나머지 효과도
     캔버스로 옮겨줘"). 용접 불티·마인 폭발·착지 충격파·흙덩이·건물 붕괴·지역 마법·다크 스웜·죽음 여운이
     한 자리에서 그려진다 — 합성 층 0, 배경 읽기 0. 스팬이 지던 흐리기·섞임의 값이 통째로 사라진다. */
  /* 끌기 문턱(지적: 확대된 상태에서 더블탭이 축소가 아니라 조금씩 이동으로 읽힘) —
     여태 문턱이 없어 손가락이 1px만 굴러도 곧장 팬이었다. 탭할 때마다 지도가 밀리고,
     그 흔들림이 더블탭 판정의 '안 끌린 탭' 기준도 함께 넘겨 확대·축소가 안 걸렸다.
     10px을 넘어서야 끌기로 보고, 그 전까지는 아무 일도 하지 않는다. */
  const DRAG_SLOP = 10;
  const dragRef = useRef<
    { id: number; sx: number; sy: number; px: number; py: number; live: boolean } | null
  >(null);
  /* 누른 자리 기억(지적: "인포팝업이 드래그하려고 눌러도 뜨는 문제") — 여태 팝업은
     '끌지 않았으면 클릭'으로 열렸는데, 끌기 판정(dragRef)은 확대했을 때만 만들어졌다.
     그래서 1배에서는 손가락을 아무리 밀어도 dragRef가 없어 늘 '클릭'이었다: 지도를
     쓸어 넘기려고 눌렀다 떼기만 해도 팝업이 떴다. 이제 확대와 무관하게 누른 자리를
     적어 두고, 손가락이 DRAG_SLOP보다 움직였으면 그건 클릭이 아니다. */
  const tapRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  /* 눌러서 감기(요청: "모바일에서 미니맵 오른쪽반은 앞으로 감기 왼쪽반은 뒤로감기
     (누르고 있는경우) ... 드래그하고 간섭안되게") — 손가락을 HOLD_MS 넘게 **가만히**
     누르고 있으면 그때부터 시각이 흐른다. 끌기와 겹치지 않는 유일한 문턱이 '안 움직임'
     이라, 그 안에 손이 DRAG_SLOP을 넘으면 감기는 아예 안 걸린다. 반대로 한 번 걸린
     뒤에는 팬을 끊는다 — 손가락은 이제 감기 손잡이지 지도가 아니다.
     감았으면 뗄 때 탭 취급을 안 한다: 정보 팝업도 안 뜨고 조작부도 안 열린다.
     손가락 기기 전용이다(요청: 모바일) — PC에서 마우스를 누르고 있는 것은 끌기다. */
  const HOLD_MS = 400;
  const holdTimerRef = useRef(0);
  const holdRafRef = useRef(0);
  /** 지금 감고 있나 — 팬을 끊는 표다. */
  const holdOnRef = useRef(false);
  /** 이번 손짓이 한 번이라도 감았나 — **다음 누름에서야** 지워진다. 뗄 때 탭을 막는
   *  것은 이 표다: 창(window)의 안전망과 지도의 onPointerUp 중 누가 먼저 도착하든
   *  판정이 안 뒤집히게 하려면, 떼는 순간에 지워지는 값에 기대면 안 된다. */
  const holdSeekedRef = useRef(false);
  /** 감기 전에 재생 중이었나 — 놓으면 그대로 되돌린다. */
  const holdWasPlaying = useRef(false);
  const holdAtRef = useRef(0);
  const stopHold = (): void => {
    if (holdTimerRef.current) { window.clearTimeout(holdTimerRef.current); holdTimerRef.current = 0; }
    if (holdRafRef.current) { cancelAnimationFrame(holdRafRef.current); holdRafRef.current = 0; }
  };
  const startHold = (dir: 1 | -1): void => {
    holdOnRef.current = true;
    holdSeekedRef.current = true;
    holdAtRef.current = t;
    dragRef.current = null;
    /* ★ 손짓도 여기서 굳혀 끝낸다(실측: 감기 때 "보기 2종 팬x 4.3 팬y 1.7 · react×57 arrive×25") ────────────────
       누르고 기다리는 400ms 사이 손가락이 슬롭을 넘어 흔들리면 드래그 손짓(beginGestureXf)이 먼저 서 있다. 여태 여기서
       드래그만 끊고 손짓은 안 끝내, 감기 내내 xfGesture가 켜진 채 손끝 팬(panRef)과 상태 팬(pan)이 몇 px 어긋나 있었다.
       그 사이 장 도착 붓은 기준 자리에, React 붓은 손끝 자리에 번갈아 칠해 유닛·건물이 떨렸다. */
    endGestureXf();
    setPlaying(false);
    /** 감기 속도(게임초 / 실초) — 20분 판이면 40초/초라 끝에서 끝까지 30초다. */
    const rate = Math.max(8, total / 30);
    let last = performance.now();
    let mirrorAt9 = 0;
    const step = (now: number): void => {
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      const nv = Math.min(total, Math.max(0, holdAtRef.current + dir * rate * dt));
      holdAtRef.current = nv;
      /* 붓 하나: 살아 있는 시각을 곧장 밀고 칠해 달라고 한다. React 거울(t)은 100ms마다 — 렌더 폭풍 없이 시간 표시·
         탐색바만 따라온다(재생 틱과 같은 박자). tFromTick을 같이 적어 렌더가 tLive를 되돌리지 않게 한다. */
      tLiveRef9.current = nv;
      requestPaint9();
      if (now - mirrorAt9 >= REACT_STEP_MS9 || nv >= total) {
        mirrorAt9 = now;
        tFromTickRef9.current = nv;
        setT(nv);
        setDone(nv >= total);
      }
      holdRafRef.current = requestAnimationFrame(step);
    };
    holdRafRef.current = requestAnimationFrame(step);
  };
  /* 안전망 — 손가락이 지도 밖에서 떨어지면 지도의 onPointerUp이 안 온다(포인터 잡기는
     확대·전체화면일 때만 건다). 그때 감기가 안 멈추면 시각이 혼자 계속 흐른다. */
  useEffect(() => {
    const end = (): void => {
      stopHold();
      if (!holdOnRef.current) return;
      holdOnRef.current = false;
      { const tl9 = tLiveRef9.current; tFromTickRef9.current = tl9; setT(tl9); }   // 거울을 감긴 시각에 맞춘다
      if (holdWasPlaying.current) setPlaying(true);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      stopHold();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onMapPointerDown = (e: React.PointerEvent) => {
    tapRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    /* 왼쪽 절반이면 뒤로, 오른쪽 절반이면 앞으로 — 기준은 **화면**이다(지도가 아니라).
       전체화면에서는 지도가 화면보다 크게 깔려 끌려 다니므로, 지도 기준으로 재면
       "오른쪽 절반"이 눈에 보이는 오른쪽과 안 맞는다. */
    holdSeekedRef.current = false;
    /* 한 손 줌 대기(요청: "모바일에서 탭-홀드-위아래로 드래그로 줌") — 탭 직후 같은
       자리를 **다시 눌러** 위아래로 끌면 확대·축소다(지도 앱들의 그 손짓). 갈림은
       '움직였나'다: 안 움직이고 떼면 종전 더블탭 확대가 그대로 돌고, 끌면 이 줌이
       그 탭을 삼킨다. 가만히 오래 누르는 것(감기)은 **앞선 탭이 없을 때**만이라
       서로 안 겹친다. */
    const lt0 = lastTapRef.current;
    if (coarse && lt0 && performance.now() - lt0.t <= DTAP_MS
      && Math.hypot(e.clientX - lt0.x, e.clientY - lt0.y) <= DTAP_SLOP) {
      quickZoomRef.current = {
        id: e.pointerId, ax: e.clientX, ay: e.clientY,
        z0: zoomRef.current, px0: panRef.current.x, py0: panRef.current.y, live: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      /* 줌 손짓 동안 브라우저 세로 스크롤을 끈다(.scr-motion-map은 pan-y) — 안 끄면
         첫 세로 이동에서 브라우저가 페이지 스크롤을 채가고 pointercancel이 날아온다.
         떼면 되돌린다. */
      (e.currentTarget as HTMLElement).style.touchAction = "none";
    }
    if (coarse && !gestureRef.current && !quickZoomRef.current) {
      const dir: 1 | -1 = e.clientX < window.innerWidth / 2 ? -1 : 1;
      holdWasPlaying.current = playing;
      stopHold();
      holdTimerRef.current = window.setTimeout(() => startHold(dir), HOLD_MS);
    }
    if (quickZoomRef.current) return;
    /* 끌 여유가 있으면 1배에도 끈다(위 panRoom) — 지도가 무대보다 크게 깔린 만큼이
       곧 '끌어서 보는 나머지'다. 전체화면이든 프레임이든 같은 물음이다. */
    if (!panRoom || e.button !== 0) return;
    // 추적 중에는 끌어도 안 움직인다(요청) — 아예 안 잡는다.
    if (trackLockRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: e.pointerId, sx: e.clientX, sy: e.clientY, px: panRef.current.x, py: panRef.current.y, live: false,
    };
  };
  /** 한 손 줌 손짓 — 탭-재누름-세로 끌기. ax/ay(둘째 누름 자리)가 확대의 고정점이다. */
  const quickZoomRef = useRef<{
    id: number; ax: number; ay: number; z0: number; px0: number; py0: number; live: boolean;
  } | null>(null);
  const dragRafRef = useRef(0);
  const dragPendRef = useRef<{ x: number; y: number } | null>(null);
  const onMapPointerMove = (e: React.PointerEvent) => {
    /* 핀치 중엔 드래그 팬 봉인(지적: 확대축소 때 전혀 다른 곳이 깜빡) — 두 손가락이
       닿아 있는 동안엔 각 손가락의 pointermove가 저마다 팬으로 처리돼, 핀치가 계산한
       pan과 엉뚱한 pan이 번갈아 이기며 화면이 다른 자리로 튀었다. */
    const tp0 = tapRef.current;
    if (tp0 && tp0.id === e.pointerId && !tp0.moved
      && Math.hypot(e.clientX - tp0.x, e.clientY - tp0.y) > DRAG_SLOP) {
      tp0.moved = true;
      // 아직 안 걸린 감기는 여기서 접는다 — 그건 끌기지 누르고 있는 것이 아니다.
      if (!holdOnRef.current) stopHold();
    }
    // 감는 중에는 지도가 안 따라온다(요청: 드래그와 간섭 없게).
    // 끌다가 감기로 넘어가면 그 손짓은 여기서 끝이다 — 안 끝내면 xfGesture가 켜진 채 남는다.
    if (holdOnRef.current) { dragRef.current = null; endGestureXf(); return; }
    if (gestureRef.current) {
      dragRef.current = null;
      quickZoomRef.current = null;   // 둘째 손가락이 오면 핀치가 임자다.
      stopHold();
      return;
    }
    /* 한 손 줌(요청) — 대기 중인 손가락이 세로로 끌리면 그때부터 줌이다. **위로 끌면
       확대, 아래로 끌면 축소**(지적: "줌인 아웃 방향이 반대야" — 처음엔 지도 앱들의
       아래=확대로 냈다가 뒤집었다). 셈은 휠·핀치와 같다: 둘째 누름 자리
       아래의 지도 지점을 붙들고(고정점) 배율만 지수로 갈아 끼우며 한계를 죈다.
       상태는 안 굳는다 — 휠·드래그와 같은 임시 변환(beginGestureXf)이라 손짓 동안
       리렌더가 없고, 캔버스는 applyGestureXf가 제 박자로 다시 그리며 뗄 때 한 번 굳는다. */
    const qz9 = quickZoomRef.current;
    if (qz9 && qz9.id === e.pointerId) {
      const dyQ = e.clientY - qz9.ay;
      if (!qz9.live) {
        if (Math.abs(dyQ) <= DRAG_SLOP) return;
        qz9.live = true;
        if (tp0 && tp0.id === e.pointerId) tp0.moved = true;
        lastTapRef.current = null;    // 떼도 더블탭 확대가 겹쳐 돌지 않게.
        stopHold();
        beginGestureXf();
      }
      const elQ = mapRef.current;
      if (!elQ) return;
      const rQ = elQ.getBoundingClientRect();
      if (rQ.width < 4 || rQ.height < 4) return;
      // 300px 끌면 약 11배(e^2.4) — 폰 화면 한 뼘으로 1배↔상한을 오간다. 위가 +다.
      const zQ = Math.min(ZOOM_MAX, Math.max(1, qz9.z0 * Math.exp(-dyQ * 0.008)));
      const oxQ = rQ.left + rQ.width / 2;
      const oyQ = rQ.top + rQ.height / 2;
      const uxQ = (qz9.ax - oxQ - qz9.px0) / qz9.z0;
      const uyQ = (qz9.ay - oyQ - qz9.py0) / qz9.z0;
      const limQ = panLimit(zQ);
      zoomRef.current = zQ;
      panRef.current = {
        x: Math.min(limQ.x, Math.max(-limQ.x, qz9.ax - oxQ - zQ * uxQ)),
        y: Math.min(limQ.yTop, Math.max(-limQ.y, qz9.ay - oyQ - zQ * uyQ)),
      };
      applyGestureXf();
      return;
    }
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.live) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) <= DRAG_SLOP) return;
      d.live = true;
    }
    const el = mapRef.current;
    if (!el) return;
    const { x: maxX, y: maxY, yTop: topY } = panLimit(zoomRef.current);
    /* 드래그도 휠과 같은 임시 변환이다(지적: "드래그에서 진짜 버벅여") — 여태 rAF마다
       setPan을 굳혔는데, 팬은 세계를 안 바꾸는데도 상태가 바뀌니 **걷기 루프·건물 루프·
       이펙트 JSX·React diff가 프레임마다 통째로** 다시 돌았다. 이제 손짓 동안은 CSS
       변환만 움직이고(합성기 전용), 300ms 굴림 커밋이 유닛 캔버스의 빈 가장자리만
       때때로 메운다. 놓을 때 최종 커밋. */
    beginGestureXf();
    // 대기 델타 반영을 손짓에 걸어 둔다(endGestureXf가 부른다) — 못 미친 자리에서 굳지 않게.
    pendFlushRef9.current = (): void => {
      if (dragRafRef.current) { cancelAnimationFrame(dragRafRef.current); dragRafRef.current = 0; }
      const p9 = dragPendRef.current;
      dragPendRef.current = null;
      if (p9) panRef.current = p9;
    };
    /* 프레임당 한 번(지적: 드래그 버벅임) — pointermove는 120Hz까지 튄다. */
    dragPendRef.current = {
      x: Math.min(maxX, Math.max(-maxX, d.px + (e.clientX - d.sx))),
      y: Math.min(topY, Math.max(-maxY, d.py + (e.clientY - d.sy))),
    };
    if (!dragRafRef.current) {
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = 0;
        const np9 = dragPendRef.current;
        dragPendRef.current = null;
        if (!np9) return;
        /* ★ **안 움직였으면 안 그린다** — 죄고 나서 값이 그대로면 같은 그림을 다시 그리는
           것이라 한 프레임이 통째로 헛일이다(변환도 캔버스도 똑같이 나온다).
           1배에서 드래그가 열리면서 생긴 자리다(위 panRoom): 위쪽 여유는 세로에만 있으니
           가로로만 끄는 손짓은 죄고 나면 늘 제자리다. 예전에는 그런 손짓이 초입에서
           되돌아갔는데(끌 여유 없음) 이제는 여기까지 온다 — 여기서 끊으면 그 자리의
           일이 예전과 똑같이 0이다. */
        if (np9.x === panRef.current.x && np9.y === panRef.current.y) return;
        panRef.current = np9;
        applyGestureXf();
      });
    }
  };
  /* ── 더블탭 확대(요청: "모바일 더블탭 줌을 넣어야할거같은데 … 줌인은 최대로") ──
     한동안 이 갈래를 걷어 두었다(요청: "인포팝업 때문에 더블탭/클릭 줌은 제거") —
     유닛을 눌러 팝업을 여는 손짓과 같아서, 팝업을 두 번 확인하려다 화면이 확대되고
     팝업이 닫혔기 때문이다. 이번 요청의 물음이 바로 그 자리다("그럼 오버레이 띄우고
     닫기는 어떡하지").

     답: **첫 탭은 지금 그대로 즉시 반응하고, 둘째 탭이 오면 첫 탭이 한 일을 되돌린 뒤
     확대한다.** 흔한 해법인 '250ms 기다렸다 판정'을 안 쓰는 까닭은, 그러면 팝업·
     오버레이가 매번 반 박자 늦게 떠 손가락이 먹통으로 느껴지기 때문이다. 되돌리기는
     세 갈래뿐이고 다 값싸다 — 팝업은 닫고, 전체화면 오버레이와 모바일 세로 바는 한 번
     더 토글하면 원래대로다.
     확대는 한 번에 상한까지 간다(요청: "줌인은 최대로"). 이미 확대돼 있으면 1배로
     되돌아간다 — 같은 손짓이 들어가고 나오는 한 쌍이라야 손이 헤매지 않는다. */
  const DTAP_MS = 320;
  const DTAP_SLOP = 32;
  /** 직전 탭 — act는 그 탭이 한 일이라, 둘째 탭이 그것만 되돌린다. */
  const lastTapRef = useRef<
    { t: number; x: number; y: number; act: "popup" | "ui" | "bars" | null } | null
  >(null);
  /** 누른 자리를 붙든 채 배율만 갈아 끼운다 — 휠·핀치와 같은 셈(커서 고정 + 한계 죔). */
  /** 배율을 **상자 한가운데 기준**으로 z1에 맞춘다 — 지도 위 확대 버튼이 쓴다.
   *  더블탭(tapZoom)은 누른 자리를 축으로 삼지만, 버튼은 누른 자리가 지도 밖이라
   *  한가운데가 유일하게 뜻이 통하는 축이다. 팬은 새 배율의 한계 안으로 죈다 —
   *  안 그러면 축소할 때 지도가 화면 밖으로 밀린 채 남는다. */
  const zoomTo = (z1: number): void => {
    closePicked9();   // 단추 배율도 팝업을 닫는다(요청).
    const el = mapRef.current;
    const r = el?.getBoundingClientRect();
    if (!r || r.width < 4 || r.height < 4) return;
    const z0 = zoomRef.current;
    const lim = panLimit(z1);
    const k = z1 / z0;
    setView9(z1, {
      x: Math.min(lim.x, Math.max(-lim.x, panRef.current.x * k)),
      y: Math.min(lim.yTop, Math.max(-lim.y, panRef.current.y * k)),
    });
  };
  const tapZoom = (cx: number, cy: number): void => {
    const el = mapRef.current;
    const r = el?.getBoundingClientRect();
    if (!r || r.width < 4 || r.height < 4) return;
    const z0 = zoomRef.current;
    // 한 번에 뛰는 배율은 ZOOM_TAP(사다리의 한 칸 아래) — 이미 확대돼 있으면 1배로 돌아간다.
    const z1 = z0 > 1.05 ? 1 : ZOOM_TAP;
    const ox = r.left + r.width / 2;
    const oy = r.top + r.height / 2;
    const ux = (cx - ox - panRef.current.x) / z0;
    const uy = (cy - oy - panRef.current.y) / z0;
    const lim = panLimit(z1);
    setView9(z1, {
      x: Math.min(lim.x, Math.max(-lim.x, cx - ox - z1 * ux)),
      y: Math.min(lim.yTop, Math.max(-lim.y, cy - oy - z1 * uy)),
    });
  };
  const onMapPointerUp = (e: React.PointerEvent) => {
    /* 손짓 끝내기는 **맨 앞**이다(수리: 손짓 표시가 켜진 채 남는 길들) — 아래에는
       감기(holdSeeked)로 먼저 빠져나가는 갈래가 있고, 드래그 도중 감기·핀치가 끼어들면
       dragRef가 지워져 'dragged'가 거짓이 된다. 그 길로 나가면 xfGesture가 켜진 채
       남아, 그 뒤로는 렌즈 effect가 늘 손짓 갈래로만 돌고 refs도 상태와 안 맞아
       모델이 엉뚱한 자리에 그려지거나 안 그려졌다. 핀치가 아직 돌면 그쪽이 끝낸다. */
    if (!gestureRef.current) endGestureXf();
    /* 한 손 줌 마무리 — 위 endGestureXf가 마지막 배율·팬을 이미 굳혔다. 여기서는
       대기표를 걷고, 실제로 끌었던 탭이면 클릭·더블탭 갈래로 안 흘러가게 삼킨다.
       (대기만 하고 안 움직였으면 그대로 흘러 종전 더블탭 확대가 돈다.) */
    const qzU = quickZoomRef.current;
    if (qzU && qzU.id === e.pointerId) {
      quickZoomRef.current = null;
      if (mapRef.current) mapRef.current.style.touchAction = zoomRef.current > 1 ? "none" : "";
      if (qzU.live) {
        stopHold();
        tapRef.current = null;
        lastTapRef.current = null;
        return;
      }
    }
    stopHold();
    if (holdSeekedRef.current) {
      if (holdOnRef.current) {
        holdOnRef.current = false;
        if (holdWasPlaying.current) setPlaying(true);
      }
      dragRef.current = null;
      tapRef.current = null;
      return;
    }
    const dragged = dragRef.current?.id === e.pointerId && dragRef.current.live;
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
    const tp = tapRef.current;
    if (tp?.id === e.pointerId) tapRef.current = null;
    /* 클릭은 '누른 그 손가락이, 거의 안 움직이고, 손짓(핀치) 중이 아닐 때' 뿐이다. */
    if (dragged || !tp || tp.id !== e.pointerId || tp.moved || gestureRef.current) return;
    /* 이 누름이 한 일이 하나면 그것으로 끝이다 — 몸을 집었으면 정보 팝업이 뜬 참이고,
       떠 있던 팝업을 닫았으면 그것이 이 누름의 몫이다. 거기에 조작부까지 함께
       움직이면 한 번 누르는데 두 가지가 바뀐다. */
    /* 둘째 탭인가(위 더블탭 주석) — **PC·손가락 모두**다(요청: "피시도 더블클릭으로
       확대 축소 가능하게"). PC에도 휠이 있지만 두 손짓은 하는 일이 다르다: 휠은
       한 칸씩 이어서 늘리는 것이고, 더블클릭은 한 번에 게임 화면 배율로 뛰었다
       되돌아오는 것이다. */
    const now9 = performance.now();
    const lt9 = lastTapRef.current;
    if (lt9 && now9 - lt9.t <= DTAP_MS
      && Math.hypot(e.clientX - lt9.x, e.clientY - lt9.y) <= DTAP_SLOP) {
      lastTapRef.current = null;
      // 첫 탭이 한 일을 되돌린다 — 두 번 누른 뜻은 확대지 팝업·오버레이가 아니다.
      if (lt9.act === "popup") setPicked(null);
      else if (lt9.act === "ui") fsToggleUi();
      tapZoom(e.clientX, e.clientY);
      return;
    }
    const hadPopup = picked !== null;
    /* ★ 1배에서는 한 번 누름이 몸을 안 집는다(요청: "1배줌에선 유닛/건물 클릭해도
       인포창 안뜨게 해줘. 그냥 오버레이 노출이나 더블탭/탭-홀드로 가게") — 다 보이는
       배율에서는 유닛 하나가 몇 픽셀이라, 지도를 쓸어 보거나 조작부를 부르려는 누름이
       번번이 엉뚱한 몸에 걸렸다. 그 배율의 한 번 누름은 이제 **오버레이 몫**이고,
       팝업은 **확대(더블탭·휠·핀치) 뒤의 누름**으로만 연다. 길게 누르기로 여는 길을
       PC에 하나 뒀다가 걷었다(지적: "PC에서는 길게 누르기는 구지 필요 없는데") —
       PC에는 휠이 있어 확대가 한 손짓이고, 손가락 쪽 길게 누름은 시각 감기가 임자라
       어차피 두 기기에 같은 손짓이 못 된다. 길이 하나면 설명할 것도 없다.
       떠 있던 팝업을 닫는 것은 배율과 무관하다 — 그건 여전히 이 누름의 몫이다. */
    const hit = zoomRef.current > 1 ? pickAt(e.clientX, e.clientY) : false;
    if (!hit && hadPopup) setPicked(null);
    /* 아무것도 안 집힌 빈 곳의 누름 — **닫기만** 한다(요청: "이제 한번 클릭(터치)로
       오버레이 오픈은 아무데도 없음"). 여는 것은 어느 배치든 아이콘 버튼(·엔터)의
       몫이다: 전체화면 조작부는 햄버거, 좁은 배치의 배속·각도 바는 지도 위 슬라이더
       아이콘. 여는 길이 지도 위에 깔려 있으면 지도를 만지다 실수로 열린다. */
    let act9: "popup" | "ui" | "bars" | null = null;
    if (hit || hadPopup) act9 = "popup";
    else if (fsOnRef.current) {
      if (fsUiRef.current) { fsToggleUi(); act9 = "ui"; }
    }
    /* (걷어냄) 좁은 배치의 '바 닫기' 갈래 — 그 바가 없어졌다(위 mobBars 주석). */
    lastTapRef.current = { t: now9, x: e.clientX, y: e.clientY, act: act9 };
  };
  /* 정보 팝업(요청: 유닛·건물 클릭하면 정보 툴팁, 딴 데 누르면 닫힘, 다른 몸을 누르면
     새 툴팁) — 집는 것은 '열쇠' 하나뿐이고, 내용은 프레임마다 지금 그린 op에서 다시
     읽는다. 그래서 체력·생산·업그레이드가 저절로 실시간이다. */
  const pickAt = (clientX: number, clientY: number): boolean => {
    const el = mapRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    let best: string | null = null;
    let bestD = Infinity;
    for (const o of opsRef.current) {
      if (!o.pickKey || o.ghost) continue;   // 잔상 판은 집지 않는다
      // UnitLayer의 분수→화면 사상과 같은 식(zx/zy 주석 참고).
      const ox = (o.fx - 0.5) * r.width * zoom + r.width / 2 + pan.x;
      const oy0 = (o.fy - 0.5) * r.height * zoom + r.height / 2 + pan.y;
      const box = o.wFrac ? Math.max(o.wFrac, o.hFrac ?? 0) * r.width : o.sizePx;
      /* ★ 유닛은 **그린 자리**로 판정해야 한다(지적: "오버로드·라바 인포팝업이 안 뜬다 —
         공중 유닛 전반의 문제일 수 있다") — 맞았다. 그리는 쪽(UnitLayer)은 몸을 발밑
         자리에서 `px·0.24 + lift`만큼 **위로 들어** 찍는데(lift는 공중 0.8px + rise),
         판정은 들기 전 자리에서 재고 있었다. 공중 유닛은 들린 몫(1.04px)이 판정 반경
         (0.5px)보다 커서, **몸을 눌러도 절대 안 잡히고** 몸 아래 빈 땅을 눌러야 잡혔다.
         그리는 식과 같은 값을 그대로 쓴다 — 앞으로 들기가 바뀌어도 한 줄만 따라오면 된다. */
      const pxU = o.sizePx * zoom;
      /* 건물도 들린 만큼 올려 잡는다(지적: 띄운 건물 팝업) — 뜬 건물은 몸이 발자국에서
         `그린 폭 × liftK`만큼 위로 떠 있는데(UnitLayer의 bTop9), 판정만 땅에 남아 있어
         **몸을 눌러도 안 잡히고 몸 아래 빈 땅을 눌러야** 잡혔다. 그리는 식과 같은 값이다. */
      /* ★ 들기 식을 **그리는 쪽과 한 글자까지** 맞춘다(지적: "오버로드가 살짝 몸보다
         위를 눌러야 인포팝업이 뜸") — 두 자가 갈려 있었다:
           · 여기만 있던 `pxU * 0.24` — 그리는 쪽(UnitLayer의 lift)에는 없는 항이다.
             예전 판의 잔재로, 그 몫만큼 판정 중심이 몸보다 위에 떠 있었다.
           · 그리는 쪽의 들기 몫을 여기서는 안 태웠다 — 판정 중심이 몸보다 위에 떴다.
         둘이 겹쳐, 오버로드는 판정 중심이 몸보다 한 몸 가까이 위에 있었다 — 그래서
         몸이 아니라 몸 **위**를 눌러야 잡혔다. 건물의 뜬 높이(liftK)도 같은 병이었다.
         이제 그리는 쪽(UnitLayer의 lift)과 **글자 그대로 같은 식**이다. */
      const liftU = o.wFrac !== undefined
        ? (o.airPx !== undefined ? o.airPx * zoom : (o.liftK ?? 0) * o.wFrac * r.width * zoom)
        : (o.air ? (o.airPx ?? 0) * zoom : 0) + (o.rise ?? 0) * pxU;
      const oy = oy0 - liftU;
      // 작은 유닛도 손가락으로 집을 수 있게 최소 반경을 준다.
      const rad = Math.max(14, box * zoom * 0.5);
      const d = Math.hypot(px - ox, py - oy);
      if (d <= rad && d < bestD) { bestD = d; best = o.pickKey; }
    }
    setPicked(best);
    return best !== null;
  };

  /* 키보드(요청: PC) — ↑↓ 배속, ←→ 5초 뒤/앞. 댓글 입력 중에는 건드리지 않는다.
     여기에 더 붙는 것들: ]/[ 확대·축소 · v 평면/입체 · c 색상 토글 · m 음악 토글 ·
     p 재생/일시정지 · wasd 지도 드래그 이동.
     ★ 오버레이를 깨우는 단축키와 안 깨우는 단축키가 갈린다(요청: "전체화면에서
       키보드 조작시 **그 기능이 오버레이에서 조작하는 기능이면** 오버레이가 활성화
       되어야해"). 앞선 요청("단축키 사용한다고 오버레이 활성화는 아님")을 이 한 줄이
       다듬는다 — 가르는 자는 '그 조작의 손잡이가 어디 있나'다:
         · 깨운다 — 배속(↑↓)·시각(←→)·보기(v)·색상(c)·음악(m)·재생(p). 이것들의 손잡이는
           오버레이에 있으므로, 눌러 놓고 그 값이 어떻게 바뀌었는지 볼 수 있어야 한다.
         · 안 깨운다 — wasd 지도 이동. 손잡이가 없는 조작이고, 화면을 훑으려고 미는
           것이라 판이 뜨면 오히려 보려던 곳을 가린다.
       깨우는 곳은 아래 wakeUi()다(전체화면일 때만 뜻이 있다). */
  /* ── 키보드 조작에 딸린 refs(요청: "wasd 좀더 부드럽게 실제 드래그처럼", "좌우화살표도
     모바일처럼 부드럽게 감기") ─────────────────────────────────────────────────
     둘 다 '누르고 있는 동안'이 있는 조작이라 keydown 한 번으로는 안 된다 — 눌린 키를
     여기 담아 두고 rAF가 그 상태를 매 프레임 읽는다. */
  /** 눌린 이동 키와 지금 미는 속도 — wasd를 손 드래그처럼 만드는 자리. */
  const keyPanRef = useRef({
    keys: new Set<string>(), raf: 0, last: 0, vx: 0, vy: 0, on: false,
  });
  /** 눌린 감기 키 — 톡 누르면 5초, 붙잡고 있으면 모바일과 같은 이어 감기로 넘어간다. */
  const keySeekRef = useRef<{ dir: 0 | 1 | -1; timer: number }>({ dir: 0, timer: 0 });
  /* 감기 손잡이를 키보드에서도 쓴다 — startHold/stopHold는 렌더마다 새로 나므로
     (그때의 t를 물고 있다) 키 판을 다시 붙이지 않으려면 ref로 건넨다. */
  const holdApiRef = useRef<{ start: (d: 1 | -1) => void; stop: () => void; playing: boolean }>({
    start: () => {}, stop: () => {}, playing: false,
  });
  holdApiRef.current = { start: startHold, stop: stopHold, playing };
  /** 음악 토글을 키 판에 흘려보내는 자리 — 렌더마다 최신 것을 담아 둔다(위 m 키 주석). */
  const bgmToggleRef = useRef<() => void>(() => {});
  bgmToggleRef.current = bgm.toggle;
  /** 인포 팝업이 열려 있나 — ESC가 무엇을 닫을지 가른다(두 ESC 판이 함께 읽는다). */
  const pickedRef = useRef<string | null>(null);
  pickedRef.current = picked;

  /* ★ 자격은 **홀로 있는가**다(지적: "피시 프레임모드에서 원래 키보드가 먹었는데 갑자기
     안 먹어") — 여기 있던 것은 `wide`였다 ─────────────────────────────────────────
     `wide`(자리 폭 ≥ 860)는 애초에 묻고 싶던 것의 대역이었다. 진짜 물음은 "이 판이 화면에
     홀로 있나"다 — 활동 목록은 카드마다 재생기가 하나씩이라 거기서 키를 먹으면 어느
     판이 답할지 알 수 없다. 넓으면 대개 상세였으니 그동안은 대역이 맞아떨어졌을 뿐이다.
     게임 페이지의 폭을 셸 폭(860)으로 되돌리자 자리 폭이 820이 되어 그 대역이 무너졌고,
     PC 프레임 모드가 통째로 키를 잃었다.
     같은 물음에 정확히 답하는 값이 이미 있다: soleView(상세 모달이거나 이 경기를 가리키는
     게임 페이지). 갈라진 판 경고가 쓰는 그 자격과 같은 것이라, 자를 하나로 모은다. */
  useEffect(() => {
    if (!soleView && !wide && !fsOn) return undefined;
    const KP = keyPanRef.current;
    /* wasd 밀기 — **손 드래그와 같은 길**로 민다(요청: "실제 드래그처럼"). 옛 조작은
       한 번 누를 때마다 화면의 8분의 1을 순간이동시켰다: 화면이 툭툭 끊겨 뛰었고,
       붙잡고 있으면 이번엔 운영체제의 키 되풀이 박자(첫 지연 0.5초, 뒤이어 초당
       서른 번쯤)에 그림이 얹혀 덜덜거렸다.
       여기서는 눌린 키가 **속도의 목표값**이다 — 속도는 그 목표를 향해 지수로 붙고
       (0.1초 시정수), 자리는 매 프레임 속도 × dt만큼 옮는다. 그래서 누르는 순간
       스르르 붙고 떼는 순간 스르르 선다. 미는 길은 손짓과 똑같은
       begin/apply/endGestureXf라, 확대 한계(panLimit)도 캔버스 다시 그리기도
       드래그와 한 몸이다. */
    const panStep = (now: number): void => {
      const el = mapRef.current;
      if (!el) { KP.raf = 0; KP.last = 0; return; }
      const dt = KP.last ? Math.min(0.05, (now - KP.last) / 1000) : 1 / 60;
      KP.last = now;
      let tx = 0;
      let ty = 0;
      if (KP.keys.has("a")) tx += 1;
      if (KP.keys.has("d")) tx -= 1;
      if (KP.keys.has("w")) ty += 1;
      if (KP.keys.has("s")) ty -= 1;
      const n = Math.hypot(tx, ty);
      /** 초당 미는 거리 — 보이는 폭의 0.9배다(끝에서 끝까지 한 숨). */
      const spd = Math.max(320, (stageSizeRef.current.w || el.clientWidth) * 0.9);
      const ease = 1 - Math.exp(-dt / 0.1);
      KP.vx += ((n ? tx / n : 0) * spd - KP.vx) * ease;
      KP.vy += ((n ? ty / n : 0) * spd - KP.vy) * ease;
      if (!n && Math.abs(KP.vx) < 2 && Math.abs(KP.vy) < 2) {
        KP.vx = 0; KP.vy = 0; KP.raf = 0; KP.last = 0;
        if (KP.on) { KP.on = false; endGestureXf(); }
        return;
      }
      if (!KP.on) { KP.on = true; beginGestureXf(); }
      const lim = panLimit(zoomRef.current);
      panRef.current = {
        x: Math.min(lim.x, Math.max(-lim.x, panRef.current.x + KP.vx * dt)),
        y: Math.min(lim.yTop, Math.max(-lim.y, panRef.current.y + KP.vy * dt)),
      };
      applyGestureXf();
      KP.raf = requestAnimationFrame(panStep);
    };
    /** 감기 놓기 — 이어 감기 중이었다면 멈추고, 감기 전에 돌던 재생을 되살린다. */
    const seekRelease = (): void => {
      const KS = keySeekRef.current;
      if (KS.timer) { window.clearTimeout(KS.timer); KS.timer = 0; }
      if (!KS.dir) return;
      KS.dir = 0;
      holdApiRef.current.stop();
      if (!holdOnRef.current) return;
      holdOnRef.current = false;
      if (holdWasPlaying.current) setPlaying(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const t2 = e.target as HTMLElement | null;
      if (t2 && (t2.tagName === "INPUT" || t2.tagName === "TEXTAREA" || t2.isContentEditable)) return;
      /* 초점이 단추류에 있으면 스페이스·엔터는 **그 단추 몫**이다 — 여기서도 받으면
         로스터 칸 하나를 누른 것이 시점 토글과 재생 토글을 한꺼번에 낸다.
         알트+엔터는 예외다(전체화면 토글은 어디에 초점이 있든 들어야 한다). */
      const onBtn9 = !!t2 && (t2.tagName === "BUTTON" || t2.tagName === "A"
        || t2.tagName === "SELECT" || t2.getAttribute("role") === "button");
      if (onBtn9 && (e.key === " " || (e.key === "Enter" && !e.altKey))) return;
      const k = e.key;
      /** 오버레이에 손잡이가 있는 조작이면 판을 깨운다(위 주석). */
      const wakeUi = (): void => { if (fsOn) fsWake(); };
      /* ★ 키 배치(요청: "확대 축소: 위아래 화살표 · 배속: q/e · 스크랩/공유: z/x", 그 뒤 "로스터, 색깔, 평면입체:
         `, c, v · 조작부 감추기/보이기: f · 도움말에 표기된 단축키 이외의 매핑은 모두 제거"). 글자 키는 e.code(자판
         자리)로 읽어 한글 자판에서도 듣는다. 안내(ReplayGuide)에 적힌 키만 여기 있어야 한다 — 별칭을 더하지 않는다. */
      const zoomStep9 = (up9: boolean): void => {
        closePicked9();   // 키보드 배율도 팝업을 닫는다(요청).
        const el9 = mapRef.current;
        const r9 = el9?.getBoundingClientRect();
        if (!r9 || r9.width < 4) return;
        const z9 = zoomNext(zoomRef.current, up9)
          ?? (up9 ? ZOOM_STEPS[ZOOM_STEPS.length - 1] : ZOOM_STEPS[0]);
        if (z9 === zoomRef.current) return;
        const kk9 = z9 / zoomRef.current;
        const lim9 = panLimit(z9);
        const np9 = {
          x: Math.min(lim9.x, Math.max(-lim9.x, panRef.current.x * kk9)),
          y: Math.min(lim9.yTop, Math.max(-lim9.y, panRef.current.y * kk9)),
        };
        linkHoldRef9.current = null;   // 키보드 배율도 사람의 조작이다(위 linkHoldRef9).
        zoomRef.current = z9;
        panRef.current = np9;
        setZoom(z9);
        setPan(np9);
      };
      if (k === "ArrowUp" || k === "ArrowDown") {
        // 위아래 화살표 = 확대·축소(요청). 옛 ]/[도 아래에 별칭으로 남긴다.
        e.preventDefault();
        wakeUi();
        zoomStep9(k === "ArrowUp");
      } else if (e.code === "KeyQ" || e.code === "KeyE") {
        // q/e = 배속 내리기/올리기(요청).
        e.preventDefault();
        wakeUi();
        const up9 = e.code === "KeyE";
        setSpeed((v) => {
          const i = SPEEDS.indexOf(v);
          return SPEEDS[up9 ? Math.min(SPEEDS.length - 1, i + 1) : Math.max(0, i - 1)];
        });
      } else if (k === "ArrowLeft" || k === "ArrowRight") {
        /* ←→ — 톡 누르면 5초, **붙잡으면 이어 감기**다(요청: "좌우화살표도 모바일처럼
           부드럽게 감기"). 손가락 기기의 길게 누르기와 같은 손잡이(startHold)를 그대로
           쓴다: 판 길이의 1/30초씩 흘러 20분 판이면 끝에서 끝까지 30초다. 되풀이
           keydown은 버린다 — 감기는 rAF가 쥐고 있으니, 운영체제 박자가 끼어들면
           그 박자대로 튄다. */
        e.preventDefault();
        wakeUi();
        if (e.repeat) return;
        const KS = keySeekRef.current;
        if (KS.dir) return;
        const dir: 1 | -1 = k === "ArrowRight" ? 1 : -1;
        KS.dir = dir;
        setT((v) => {
          const nv = Math.min(total, Math.max(0, v + dir * 5));
          setDone(nv >= total);
          return nv;
        });
        holdWasPlaying.current = holdApiRef.current.playing;
        KS.timer = window.setTimeout(() => { holdApiRef.current.start(dir); }, 260);
      } else if (k === " " || k === "Spacebar") {
        /* 재생/일시정지 — p에서 **스페이스바**로 옮겼다(요청). 브라우저의 기본 동작
           (페이지 한 화면 내리기)을 반드시 막아야 한다. */
        e.preventDefault();
        wakeUi();
        if (done) { setT(0); setDone(false); setPlaying(true); return; }
        setPlaying((v) => !v);
      } else if (k === "Enter" && e.altKey) {
        // 알트+엔터 전체화면 토글(요청) — 창 전체화면의 오래된 관례 그대로다.
        e.preventDefault();
        if (fsOnRef.current) exitFs(); else enterFs();
      } else if (e.code === "KeyF") {
        /* f — **조작부 여닫이**(요청: 엔터 → h → f). 오른쪽 위 아이콘과 같은 일이다.
           전체화면이 아닐 때는 여닫을 판이 없으므로 아무 일도 안 한다. */
        if (!fsOnRef.current) return;
        e.preventDefault();
        fsToggleUi();
      } else if (k === "Escape") {
        /* ESC — **인포 팝업이 열려 있으면 그것부터** 닫는다(요청). 전체화면 나가기는
           팝업이 없을 때만이고, 그 몫은 따로 선 ESC 판이 맡는다(그쪽도 같은 ref를
           읽어, 팝업이 열려 있으면 손을 뗀다). */
        if (pickedRef.current === null) return;
        e.preventDefault();
        setPicked(null);
        /* ★ (걷어냄) 좁은 배치를 통째로 삼키던 빈 분기(지시: "키보드 조작을 PC뿐 아니라
           모바일에도 일단 물려 놓기") ─────────────────────────────────────────────────
           여기 `} else if (!wide) {`가 서서, 폰·태블릿에서는 아래 키들(−/= 확대축소 ·
           PageUp/Down · c · wasd)이 **한 줄도 안 닿았다**. 막아 둔 까닭은 "거기는 키보드가
           없고, 있으면 페이지 스크롤을 키로 하는 쪽이 맞다"였다.
           그 전제가 둘 다 약하다: 폰에 블루투스 자판을 붙이는 사람이 있고(태블릿은 흔하다),
           페이지 스크롤은 이 판이 어차피 안 넘긴다(지도 위 손짓은 touchAction: none이다).
           무엇보다 **없는 자판은 아무 키도 안 누른다** — 안 쓰는 자리에 코드가 도는 값은
           0이고, 쓰는 자리에서는 화면이 통째로 조작된다. 막을 까닭이 없다.
           입력칸·단추 초점 걸러내기는 위에 그대로 있어, 자판이 붙어 있어도 글 쓰는 중에는
           안 뺏는다. */
      // (걷어냄) ]/[ 확대·축소 별칭 · 2/3 평면·입체 · r 로스터 · t 색 — 안내에 없는 매핑은 두지 않는다(요청).
      } else if (e.code === "KeyC") {
        // c = 팀색 ↔ 개인색(요청).
        e.preventDefault();
        wakeUi();
        setColorMode((v) => (v === "team" ? "personal" : "team"));
      } else if (e.code === "Backquote") {
        // ` = 로스터 여닫이(이름만 → 전체 → 숨김, 오른쪽 아래 단추와 같은 순서 / 요청).
        e.preventDefault();
        wakeUi();
        setRosterMode((v) => ((v + 1) % 3) as 0 | 1 | 2);
      } else if (e.code === "KeyV") {
        // v = 평면 ↔ 입체 토글(요청). 입체가 막힌 기기면 안내만 띄운다.
        e.preventDefault();
        wakeUi();
        if (pitchDegRef9.current < 90) setPitchDeg(90);
        else if (!pitchAllowed()) pitchDenied();
        else setPitchDeg(PITCH_3D);
      } else if (e.code === "KeyM") {
        /* m — 음악 켜기/끄기(지시). 색상(c)·재생(p)과 같은 결이다: 손잡이가 화면에
           있는 조작이라 **오버레이를 깨운다**(위 wakeUi 주석의 그 규약 — 눌러 놓고
           무엇이 바뀌었는지 볼 수 있어야 한다).
           ★ 부르는 것은 ref다 — bgm.toggle은 렌더마다 새로 날 수 있고, 그것을 이 판의
             의존 목록에 넣으면 키 판이 통째로 다시 걸린다(그 자리 주석: 다시 걸릴 때마다
             fsWake가 불려 오버레이가 도로 켜지고 밀기가 끊긴다). */
        e.preventDefault();
        wakeUi();
        bgmToggleRef.current();
      } else if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") {
        // 추적 중에는 화면을 손으로 못 민다(요청) — 키를 아예 안 담는다.
        if (trackLockRef.current) return;
        /* 눌린 키를 담기만 한다 — 미는 일은 위 panStep이 매 프레임 한다.
           ★ e.key가 아니라 **e.code**를 읽는다: 한글 자판에서는 e.key가 ㅈㅁㄴㅇ로
             오고, 그 넷을 문자열로 훑던 옛 코드가 그래서 자판마다 갈렸다. code는
             자판 배열과 무관한 '그 자리의 키'다. */
        e.preventDefault();
        if (e.repeat) return;
        KP.keys.add(e.code === "KeyW" ? "w" : e.code === "KeyA" ? "a" : e.code === "KeyS" ? "s" : "d");
        if (!KP.raf) { KP.last = 0; KP.raf = requestAnimationFrame(panStep); }
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "KeyW") KP.keys.delete("w");
      else if (e.code === "KeyA") KP.keys.delete("a");
      else if (e.code === "KeyS") KP.keys.delete("s");
      else if (e.code === "KeyD") KP.keys.delete("d");
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") seekRelease();
    };
    /* 창을 떠나면 키를 놓은 것으로 본다 — 알트탭으로 나가면 keyup이 안 와서, 눌린
       채로 남은 키가 돌아왔을 때 지도를 저 혼자 밀고 간다. */
    const onBlur = (): void => { KP.keys.clear(); seekRelease(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      KP.keys.clear();
      if (KP.raf) { cancelAnimationFrame(KP.raf); KP.raf = 0; }
      if (KP.on) { KP.on = false; endGestureXf(); }
      seekRelease();
    };
    // panLimit·viewBox는 렌더마다 새로 나지만 읽는 값(stage·fsOn)은 아래 목록에 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soleView, wide, total, fsOn, done, stage.w, stage.h, fsWake, enterFs, exitFs,
    beginGestureXf, applyGestureXf, endGestureXf]);

  /* 한 번에 한 판만(요청) — 재생을 시작하는 순간 먼저 돌던 판을 멈춘다. */
  const pauseSelf = useRef(() => {});
  useEffect(() => {
    pauseSelf.current = () => setPlaying(false);
  }, []);
  useEffect(() => {
    if (!playing) return undefined;
    claimPlayback(pauseSelf);
    return () => releasePlayback(pauseSelf);
  }, [playing]);

  /* 시야에서 벗어나면 일시정지(요청) — 다시 보일 때 자동으로 되살리지는 않는다(멈춘 걸
     사람이 이어 보는 건 재생 버튼의 몫이다). 확대 모달은 늘 화면 안이라 안 지킨다 —
     여닫는 재부착 순간 IO가 '안 보임'을 쏘아 재생을 멈추던 것(지적: 확대·축소 시
     재생 유지)도 이것으로 막힌다. 맵이 다른 트리로 옮겨 심기면 effect를 다시 걸어 새
     엘리먼트를 관찰한다.
     ★ 전체화면에서는 아예 안 건다(지적: "전체화면모드 처음들어갈때 재생정지되는 문제")
       — 원인은 이 관찰자였다. 전체화면은 지도를 body의 자리에서 떼어 판 안(.scr-fs-stage)
       으로 옮겨 심으므로 맵 엘리먼트가 **갈린다**. 그런데 이 effect의 의존 목록에는
       wide만 있어서 다시 걸리지 않았고, 관찰자는 방금 떨어져 나간 **낡은** 엘리먼트를
       계속 보고 있었다. 떨어진 엘리먼트는 당연히 '안 보임'이라 곧장 재생을 멈췄다.
       fsOn을 목록에 넣어 다시 걸고, 전체화면 동안에는 관찰 자체를 쉰다 — 그때 지도는
       화면을 통째로 덮고 있어 '스크롤 밖으로 나감'이라는 것이 아예 없다. */
  useEffect(() => {
    if (wide || fsOn) return undefined;
    const el = mapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((entries) => {
      /* 이중 잠금 — 전체화면으로 넘어가는 참이면 이 알림은 '스크롤 밖으로 나갔다'가
         아니라 '옮겨 심느라 잠깐 떨어졌다'는 뜻이다. 알림은 다음 그리기 뒤에 오고
         effect 청소는 그 전에 도는 것이 보통이지만, 순서에 기대지 않는다. */
      if (fsOnRef.current) return;
      if (entries.some((e) => !e.isIntersecting)) setPlaying(false);
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [wide, fsOn]);

  /* (삭제) 화면을 벗어날 때의 정지는 이제 스크롤 밖(IntersectionObserver)뿐이다 —
     창 전환(blur) 정지를 걷은 뒤에도 탭 숨김(visibilitychange) 정지가 남아 창을 덮으면
     여전히 멈췄다(지적: "블러시 재생 멈춤 왜 아직도 있지"). 숨은 탭은 브라우저가 rAF를
     세워 어차피 시간이 안 가고, 돌아온 첫 틱은 dt 상한(0.5초)이 점프를 막으므로 명시적
     정지 없이도 이어 보기가 안전하다. */

  /* 진입 프리베이크(요청: "상세 페이지 들어가면 처음에 캐시를 다 굽고(로딩) 끊김없이
     플레이는 못하나") ─────────────────────────────────────────────────────────────
     재생 중 뚝뚝 끊기는 몫의 큰 자리가 **첫 등장 굽기**다: 유닛이 처음 나타나는 프레임
     마다 그 종류·방향의 판을 새로 구우니, 병력이 쏟아지는 구간에서 한 프레임에 수십
     번씩 몰린다. 그 일을 **들어올 때 미리** 해 둔다.
     ★ 무엇을 굽나 — 이 경기의 참값(entData.lives)에 실제로 나오는 **모델 종류**를
       추려 16방향씩 굽는다. 판 굽기의 값비싼 절반은 면을 짜는 일(resolveShapeFaces →
       HEAD_FACES)이고 그것은 **색과 무관**하므로, 임자 색마다 되풀이할 필요가 없다.
       나머지 절반(래스터)은 지금 배율 칸의 크기 하나로 임자 색마다 한 벌씩 데운다.
     ★ 언제 다시 — **배율은 안 본다**(지적: "왜 줌을 바꿀때마다 구워? 한번에 안굽고").
       면의 열쇠는 종류·방향·보기(평면/입체)·요잉 칸뿐이라 배율과 무관하다: 한 번 짜
       두면 어느 배율에서도 그대로 쓰인다. 판(래스터)까지 데우던 첫 판에서는 크기가
       열쇠에 들어가 배율 칸마다 다시 돌아야 했는데, 그 단계를 걷으면서 이 의존성도
       같이 걷혔다. 시점 각(pitch)만은 면을 다시 짜므로 그때 한 번 더 돈다.
     ★ 어떻게 — 한 프레임에 12ms까지만 굽고 rAF로 넘긴다: 굽는 동안에도 화면이 살아
       있고, 진행률이 아래 로딩 띠로 나간다. */
  const [warmAt, setWarmAt] = useState<{ done: number; total: number } | null>(null);
  /** 장면을 보여도 되나 — 자취가 자리 잡고(받았거나 없는 것으로 판명) 모델 굽기가 끝났나.
   *  ★ `entLoad`만 보면 안 된다: 처음 한 박자는 "idle"(아직 안 물어봄)이라 그때 보여
   *    버리면 빈 지도가 한 번 번쩍인 뒤 다시 숨는다. **자취를 실제로 손에 쥐었나**
   *    (entData)나 '끝내 없다'(none)를 본다. 자취를 아예 안 받는 화면(loadUnitTracks가
   *    없는 자리)은 기다릴 것이 없으므로 곧바로 참이다. */
  /* ★ **자취가 왔나**와 **모델을 굽는 중인가**를 가른다(지적: "지도와 미니맵의 지도와
     안개가 모델 굽는 중에 한 번 까맣게 지워졌다가 굽기 완료 시 다시 나옴") ────────────────
     둘을 한 깃발로 묶어 두었더니 굽는 동안 **지형과 안개까지** 함께 사라졌다. 그런데 그
     둘은 굽기와 아무 상관이 없다 — 지형은 이미 그려져 있고 안개도 이미 셈해져 있다.
     굽는 동안 아직 없는 것은 **유닛 몸**뿐이다.
     자취 전(tracksReady 거짓)에만 통째로 감춘다 — 그때는 안개가 없어 지도가 다 밝고
     지형 밑칠(초록)이 그대로 비치므로 보여 줄 수 없다. 굽는 동안은 유닛 층만 감춘다. */
  const tracksReady = !loadUnitTracks || entData !== null || entLoad === "none";
  const baking9 = !!warmAt;
  // (걷어냄) sceneReady — 두 뜻을 묶어 두던 이름이다. 이제 쓰는 쪽이 둘을 따로 본다.
  /** 굽는 중인가 — 재생 틱이 이 깃발을 보고 시간을 멈춘다(핀치와 같은 자리). 상태로
   *  보면 프레임마다 시계 effect가 다시 서므로 ref로 든다. */
  /** 굽는 프레임으로 볼 문턱(ms) · 이어서 멈춰 있을 수 있는 상한(ms) — 위 재생 틱의 ★. */
  /* ★ 10 → 40ms(지적: 폰에서 "터지진 않는데 끊겨") — 폰 6배에서는 판 한 장 굽기가 대개 10ms를 넘어, 굽는
     프레임마다 시간이 멎었다(2초에 16장이면 초당 여덟 번 멈칫). 이 홀드는 200ms짜리 껑충 뛰기를 막는 장치이지
     12ms 늦는 프레임을 잡는 장치가 아니다 — 그 정도는 그냥 조금 늦은 프레임이고, 워커가 지어 둔 다음 장이
     제 시각에 맞게 골라진다. 큰 굽기 뭉치(배율 변경 직후 수십 장)만 여전히 멎는다. */
  const BAKE_HOLD_MS9 = 40;
  const BAKE_HOLD_MAX9 = 1500;
  /** 굽기 멈춤 상태 — ms는 이어 멈춘 길이, win/winDt는 띠를 켜고 끄는 최근 창. */
  const bakeHoldRef = useRef({ ms: 0, win: 0, winDt: 0, shown: false });
  const [bakeHold, setBakeHold] = useState(false);
  /** 재생 품질 알림(위 QUALITY9) — 값이 있으면 지도 오른쪽 위에 3초. */
  const [qualityNote, setQualityNote] = useState<string | null>(null);
  useEffect(() => {
    let tm9 = 0;
    const show9 = (lv9: string): void => {
      setQualityNote(lv9);
      window.clearTimeout(tm9);
      tm9 = window.setTimeout(() => setQualityNote(null), 3000);
    };
    QUALITY9.fn = show9;
    if (QUALITY9.level) show9(QUALITY9.level);   // 첫 벤치는 렌더 중에 돌아 문이 없었다 — 꽂히는 순간 한 번 보인다
    return () => { QUALITY9.fn = null; window.clearTimeout(tm9); };
  }, []);
  const warmingRef = useRef(false);
  useEffect(() => {
    if (!entData || !active) return undefined;
    /* 벤치를 먼저 세운다 — 아래에서 방향 칸 수를 기기의 힘으로 가른다(crowdInit9는 한 번만 돈다). */
    crowdInit9();
    /* 이 경기에 나오는 모델 종류 — 유닛은 이름표(UNIT_3D)로, 건물은 SHAPE_KIND로 푼다.
       버로우·일꾼 별본까지 넣으면 조합이 배로 뛰므로 본판만 데운다(그 별본들은 면을
       나눠 쓰지 않지만 수가 적어 재생 중 한두 번 굽고 만다). */
    const kinds = new Set<string>();
    /* ★ 종류마다 **몇 마리나 쓰나**도 함께 센다(실측: 로딩[예열 1938ms/479개]) ─────────────
       예열은 이 판에서 가장 큰 값인데, 여태 일감 차례가 **나오는 순서**였다. 그러면 경기에
       한 마리뿐인 별종이 마린보다 먼저 데워지고, 절반쯤 데운 시점에도 화면에 가장 많은 것이
       아직 안 되어 있을 수 있다. 많이 쓰는 것부터 데우면 같은 시간에 **화면의 더 많은 몫**이
       준비된다 — 아래에서 이 수로 차례를 매긴다. */
    const useN9 = new Map<string, number>();
    for (const e of entData.lives) {
      if (!e.kind) continue;
      const k9 = e.bld ? SHAPE_KIND[e.kind] : UNIT_3D[e.kind];
      if (k9) { kinds.add(k9); useN9.set(k9, (useN9.get(k9) ?? 0) + 1); }
    }
    if (kinds.size === 0) return undefined;
    /* 일감 — 종류마다 **부품 등급표 한 벌 + 방향 판**이다(건물은 방향이 없어 한 벌).
       ★ **등급표를 여기서 짓는다**(실기 계측: "굽기 7장 314ms · 최악판 devourer 270ms",
         최악 프레임 487ms 중 굽기 289ms) ──────────────────────────────────────────────
         장수는 적은데 값이 큰 것이 실마리였다. 단계로 갈라 재 보니 판 한 장의 값이
         기하 3ms · 칠하기 3~30ms인데 **등급 매기기(autoTier)가 100~170ms**였다.
         그 안을 다시 보니 pathBox는 한 바퀴 8ms로 범인이 아니고, 값은 전부
         `tierTableOf`에 있었다 — 그 함수가 종류마다 **여덟 방위를 다시 구워** 부품
         크기표를 짓는다.
         종류당 한 번뿐이라(TIER_TABLE) 경기 내내 되풀이되지는 않는다. 그런데 그
         '한 번'이 **경기 중에** 온다: 43분 경기에서 새 유닛이 처음 등장할 때마다 한
         프레임이 통째로 그 표에 쓰인다. 실기의 270ms짜리 devourer가 그것이다.
         계측: 테란+저그 72종을 다 지어도 합 2215ms(평균 31ms·최대 115ms)다. 곧 이것은
         '경기 중에 치르기엔 큰 값'이지만 '들어올 때 치르기엔 작은 값'이다 — 그리고 이
         화면은 이미 그 자리를 갖고 있다(요청: "들어가면 처음에 캐시를 다 굽고(로딩)
         끊김없이 플레이"). 표는 이 경기에 실제로 나오는 종류만 짓는다(위 kinds).
       ★ 덤으로 **표가 결정적이 된다** — tierTableOf는 부를 때의 자세 깃발(poseNow)로
         구운 면을 재고 그 표를 종류마다 영영 쥔다. 경기 중에 처음 불리면 그때 마침
         선 자세가 표에 박히는데, 여기서 지으면 늘 기본 자세(0)다. */
    /* ★ **모드 별본의 표까지** 데운다(실기: 새 판에서도 "최악판 tanksiege 230ms") ────
       lives에는 본판 이름만 온다 — 시즈 모드·버로우·일꾼 짐 같은 별본은 **그리는 쪽이
       상태를 보고 갈아 끼우는** 이름이라 위 kinds에 안 잡히고, 경기 중 처음 갈아 끼우는
       순간 제 등급표(tierTableOf: 여덟 방위 다시 굽기)를 그 프레임에 짓는다. 탱크가
       처음 시즈를 박는 순간의 230ms가 그것이다.
       본판이 있으면 그 별본이 나올 것은 확실하므로(시즈 없는 탱크는 있어도, 탱크 없는
       시즈는 없다) 본판의 표를 데울 때 별본의 표도 같이 데운다. 기하(16방위)는 여전히
       본판만이다 — 별본 기하는 3~7ms라 재생 중 한두 번 구워도 안 아프고, 아팠던 것은
       표(수백 ms)뿐이다. */
    const WARM_KIN9: Record<string, readonly string[]> = {
      tank: ["tankbody", "tankgun", "tanksiege", "tanksiegebody", "tanksiegegun", "tanksiegelegs", "tanksiegelegsF", "tankturret0", "tankbarrel", "siegebarrel"],
      tanksiege: ["tanksiegebody", "tanksiegegun", "tank", "tankbody", "tankgun", "tanksiegelegs", "tanksiegelegsF", "tankturret0", "tankbarrel", "siegebarrel"],
      lurker: ["burrowhole", "lurkerburrow", "lurkerfire"],
      scv: ["scvHold", "loadScvMin", "loadScvGas"],
      probe: ["probeHold", "loadProbeMin", "loadProbeGas"],
      drone: ["droneHold", "loadDroneMin", "loadDroneGas"],
      sunken: ["sunkenrear", "sunkentongue"],
      geyser: ["geyserdry"],
    };
    const jobs: { kind: string; rot?: number; table?: boolean }[] = [];
    const tabled9 = new Set<string>();
    const pushTable9 = (k9: string): void => {
      if (tabled9.has(k9) || !SHAPE_BUILDERS[k9]) return;
      tabled9.add(k9);
      jobs.push({ kind: k9, table: true });
    };
    for (const k9 of kinds) {
      pushTable9(k9);
      for (const v9 of WARM_KIN9[k9] ?? []) pushTable9(v9);
      const isBld = !UNIT_KIND_SET.has(k9);
      if (isBld) jobs.push({ kind: k9 });
      /* ★ **그릴 칸만 데운다**(수리: 큰 판에서 "로딩이 거의 안 됨") ────────────────────────
         여기는 늘 열여섯 칸(22.5도)을 데웠는데, 작은 기기의 붓은 그 칸을 **한 번도 안 쓴다**:
         DEV9.yaw8Always가 서 있어 요잉이 늘 여덟 칸(45도)으로 눕고, 낮은 배율에서 죄면 네 칸이다.
         45도 칸은 22.5도 칸의 부분집합이라 데운 것이 안 쓰이는 것이 아니라, **쓰지도 않을 여덟 칸을
         더 데우느라 로딩이 두 배로 길었다**. 종류가 마흔이면 640 → 320 일감이다.
         넓은 자리(PC)는 배율에 따라 열여섯 칸을 쓰므로 그대로 둔다. */
      else {
        /* ★ **그릴 칸만** 데운다 — 작은 기기의 붓은 요잉을 늘 여덟 칸(45도)으로 눕히고
           (DEV9.yaw8Always), 벤치가 미달이면 낮은 배율에서 네 칸(90도)까지 죈다.
           그러니 미달 기기는 **네 칸**만 데운다 — 나머지 넷은 높은 배율로 올라갈 때
           그때 굽는다(그 자리는 보이는 유닛이 몇 안 되므로 값이 작다).
           넓은 자리(PC)는 배율에 따라 열여섯 칸을 쓰므로 그대로다. */
        const rn9 = !DEV9.yaw8Always ? 16 : CROWD9.weak ? 4 : 8;
        for (let r9 = 0; r9 < rn9; r9 += 1) jobs.push({ kind: k9, rot: (r9 * 360) / rn9 });
      }
    }
    // 다른 유닛의 버로우도 맨 구멍을 쓴다 — 저그가 있으면 무조건 데워 둔다(면 몇 장짜리라 값도 없다).
    if ([...kinds].some((k9) => k9 === "zling" || k9 === "hydra" || k9 === "drone")) pushTable9("burrowhole");
    /* ★ **많이 쓰는 종류부터**(위 useN9) — 같은 시간에 화면의 더 많은 몫이 준비된다.
       등급표(table)는 그 종류의 판을 굽기 전에 있어야 하므로 늘 제 방향 판보다 앞이다. */
    jobs.sort((a9, b9) => ((useN9.get(b9.kind) ?? 0) - (useN9.get(a9.kind) ?? 0))
      || (Number(!!b9.table) - Number(!!a9.table)));
    let i9 = 0;
    let raf9 = 0;
    let lastPost9 = 0;
    const flat9 = !pitched;
    const step9 = (): void => {
      /* 한 프레임 예산 12 → 6ms + 개수 상한(8) — 예산은 **일감 사이에서만** 재므로,
         큰 모델 하나가 예산을 넘겨 버리면 그 프레임이 통째로 밀린다(계측: 최악 127ms).
         둘을 함께 조이면 한 프레임이 넘기는 몫이 모델 하나 값을 못 넘는다. */
      const t0 = performance.now();
      let n9 = 0;
      LOAD9.warmN = jobs.length;
      while (i9 < jobs.length && n9 < 8 && performance.now() - t0 < 6) {
        n9 += 1;
        const j9 = jobs[i9];
        i9 += 1;
        try {
          /* **면만** 데운다 — 굽기의 값비싼 절반이고, 무엇보다 색·크기와 무관해서 한 번
             데워 두면 임자 색이 몇이든 어느 크기든 그대로 쓰인다(HEAD_FACES).
             ★ 래스터(판 한 장 찍기)까지 데우려 했다가 걷었다(계측): 판 열쇠에는 크기와
               **좌우 시점(viewYaw)**이 들어가는데 그 둘이 유닛의 화면 자리마다 달라,
               미리 구운 720판 중 실제로 쓰인 것이 거의 없었다(캐시 10판이면 되는 장면
               에서 0.7MB를 굽고 최악 프레임 36 → 127ms). 면은 요잉 칸(vq)만 타므로
               훨씬 적은 수로 실제 쓰임을 덮는다. */
          if (j9.table) tierTableOf(j9.kind);
          else resolveShapeFaces(j9.kind, j9.rot, flat9, 0, pitched);
        } catch { /* 낯선 종류 하나가 로딩을 통째로 막지 않게 — 그건 재생 중 굽는다. */ }
      }
      LOAD9.warmMs += performance.now() - t0;
      if (i9 < jobs.length) {
        warmingRef.current = true;
        /* 진행률은 **띄엄띄엄** 올린다 — 프레임마다 상태를 놓으면 그때마다 리렌더가
           돌아 캔버스를 다시 그리고, 정작 굽는 데 쓸 프레임을 그 일이 먹는다. */
        if (performance.now() - lastPost9 > 160) {
          lastPost9 = performance.now();
          setWarmAt({ done: i9, total: jobs.length });
        }
        raf9 = requestAnimationFrame(step9);
      } else {
        warmingRef.current = false;
        setWarmAt(null);
      }
    };
    raf9 = requestAnimationFrame(step9);
    return () => { cancelAnimationFrame(raf9); warmingRef.current = false; setWarmAt(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entData, active, pitched, pitchDeg]);

  /* 시계 — rAF로 게임 시간 t를 배속만큼 민다. state로 두는 이유는 매 프레임 그리는 것들
     (자취·건물·마법)이 전부 t의 함수라서다. */
  /* 그리기 30Hz(재지적: 1배속도 뚝뚝 — 10Hz의 0.1초 걸음이 눈에 밟혔다). 10Hz는
     마커 span 750개 시절의 처방인데, 유닛이 캔버스(unitOps 일괄 그리기)로 옮겨 간
     뒤로는 리렌더가 한참 가벼워져 33ms 예산 안에 든다. 시간은 매 틱 어김없이
     쌓으므로(accRef) 재생 속도는 어느 주기든 같다. */
  const clockRef = useRef<{ raf: number; last: number; acc: number; drawn: number } | null>(null);
  /* (걷어냄) 핀치 중 **재생 정지** — 두 손가락이 닿아 있는 동안 시간도 표시도 멈추던 자리다.
     ★ 왜 걷었나(지적: "제스처 중 안개 빈 공간이 생기고 **동시에** 핵폭발 시 멈춘다 — 둘이
       같이 나는 게 더 이상하다") ─────────────────────────────────────────────────────
       이상하지 않다. 둘은 **한 줄에서 나온 한 가지**였다: 핀치 동안 `acc = 0`이라 시간이
       안 가고, 그러면 붓 틱(paintFnRef9)도 React 틱(setT)도 안 돈다.
         · 붓이 안 도니 안개가 새로 드러나는 자리를 못 채운다 → 빈 띠
         · React가 안 도니 핵·스톰(재생 시각으로 CSS 애니를 긁는 효과)이 얼어붙는다
       유닛만 멀쩡해 보인 것은 손짓 쪽(applyGestureXf)이 CSS 변환으로 밀고 제 박자로 한 장씩
       칠하기 때문이다 — 즉 '유닛은 괜찮다'가 붓이 돈다는 증거가 아니었다.
       멈춤을 넣은 까닭("폰에서 20Hz 리렌더 하나가 수십 ms")은 붓이 React 안에 있던 시절의
       것이다. 지금 붓은 React 밖이고 React는 100ms 박자다. 게다가 **한 손 드래그는 이 깃발을
       안 세우는데** 거기서는 아무 문제가 없었다 — 핀치만 다르게 둘 까닭이 사라졌다.
       한 번에 뛰는 몫은 아래 80ms 상한(advWall9)이 이미 막는다. */
  const gestureRef = useRef(false);
  useEffect(() => {
    if (!playing || !active) return undefined;
    // 모바일은 20Hz(재지적: 모바일과 PC는 주기가 달라야) — 폰 CPU에서 30Hz 리렌더는
    // 오히려 밀려서 더 뚝뚝해진다. PC는 30Hz.
    /* 손짓 중에는 그리기 주기를 늘린다(지적: "엣지스크롤 너무 뚝뚝 끊기고 느려") —
       손짓이 도는 동안에도 재생 틱은 계속 리렌더를 내고, 그때마다 캔버스 한 장을
       통째로 다시 그린다(자식이 손끝 값으로 그린다). PC 16ms면 초당 60장이라, 난전·
       고배율에서 한 장이 20~30ms 드는 자리에서는 그 자체로 프레임을 먹는다.
       손짓 중에는 33ms(30Hz)로 물린다 — 화면이 흐르는 것은 합성기(CSS 변환)가 맡고
       있으므로 유닛 걸음만 30Hz가 되며, 그 차이는 눈에 안 띈다. */
    /* ★ 모바일 문턱 50 → 33ms(요청: "모바일 프레임 높이자") ──────────────────────────
       계측이 이 값을 바꿀 근거를 줬다. 평소 구간(표본#3)에서 우리가 실제로 쓰는 시간은
       렌더 14.97 + 커밋 0.78 + 붓 4.9 ≈ **21ms**인데 프레임주기는 63ms였다. 그 차이는
       브라우저가 일하는 시간이 아니라 **이 문턱이 열리기를 기다리는 빈 시간**이다.
       곧 평소에 우리는 CPU에 막힌 것이 아니라 **스스로 건 빗장**에 막혀 있었다.
       50ms는 화면이 아무리 한가해도 20Hz를 못 넘게 하는 상한이다. 21ms짜리 일을 33ms
       칸에 넣으면 30Hz가 되고, 그것이 눈에 보이는 차이다 — 여태 줄여 온 몫들은 이
       빗장 뒤에 가려 체감이 안 됐다("체감은 아직 잘 모르겠어").
       무거운 순간에는 일이 33ms를 넘겨 저절로 늦어진다 — 그때는 지금과 똑같이 돈다.
       곧 이 값은 '빠를 때의 상한'만 푼다. `?gap=N`으로 손수 바꿔 눈으로 고를 수 있다. */
    /* ★ 33 → **22**(45fps)(지시: "모바일쪽 프레임 늘려볼까" · 실측 "난전에서 32~45") ──
       프레임주기는 `max(문턱, 일)`이다. 난전의 일이 32~45ms니 그 구간은 문턱을 아무리
       내려도 안 바뀐다 — 바뀌는 것은 **조용한 구간**이다: 일이 10ms인 초중반이 33ms
       천장에 눌려 30fps로 돌고 있었고, 리플레이 시간의 대부분이 그쪽이다.
       그렇다고 16(60fps)까지 풀지는 않는다. 조용한 구간에서 프레임을 두 배로 그리면
       기기가 더 데워지고, 그 열이 **난전에서 조임으로** 돌아온다(실측: 같은 기기에서
       `나머지`가 9 → 16ms로 널뛴 것이 그 자국이다). 22면 조용한 구간이 30 → 45로
       올라가면서 태우는 몫은 절반이다.
       이 값은 참값 표적을 들이며 일이 크게 준 뒤의 값이다 — 표적찾기·시야 레이캐스트가
       통째로 사라졌다(그 자리 주석). 그 전이었으면 22는 헛문턱이었을 것이다. */
    /* 22 → 12ms(지적: "모바일 프레임 제한 있나, 가벼운데 프레임이 낮은 느낌") — 22ms는 60Hz 화면에서 rAF 두 번에 한 번
       (30fps)이었다. 12ms면 60Hz는 매 rAF(60fps), 120Hz는 두 번에 한 번(60fps). 워커·보간이 있어 붓은 그만큼 가볍다. */
    const MOBILE_GAP_MS = 12;
    const drawGapMs = (): number => (
      GAP9 || (pcView ? (xfGestureRef.current ? 33 : 16) : MOBILE_GAP_MS));
    const tick = (now: number) => {
      const c = clockRef.current;
      /* 한 틱 상한 — 브라우저가 rAF를 멈췄다 되살리면(백그라운드 탭) dt가 자리 비운
         시간 전체가 돼, 돌아온 순간 그만큼을 한 번에 건너뛴다. 위의 정지가 대부분 막지만
         blur가 안 오는 경우(다른 모니터로 시선만 이동)를 위한 이중 잠금이다. */
      const dt = c ? Math.min((now - c.last) / 1000, 0.5) : 0;
      if (c) { perfFrame(now - c.last); lodNoteFrame(now - c.last); }
      /* ★ **굽는 프레임에는 시간을 안 보낸다**(제안: "저사양에서는 굽기 버벅임이 생길
         수밖에 없잖아, 차라리 로딩중을 띄우는 게 어때") ─────────────────────────────
         굽기 자체를 0으로 만들 수는 없다. 시간바를 크게 옮기거나 화면을 끌어 새 건물·
         유닛이 들어오면 그 판들은 그 자리에서 처음 구워야 하고, 저사양일수록 오래 걸린다.
         그런데 **눈에 버벅임으로 읽히는 것은 굽느라 느린 것이 아니라 그 사이에 시간이
         그대로 흘러 그림이 껑충 뛰는 것**이다: 200ms짜리 프레임은 재생 시간도 200ms를
         한 번에 밀어, 유닛이 순간이동한 것처럼 보인다.
         그래서 진입 프리베이크가 쓰던 규칙(warmingRef: "굽는 동안 시간은 안 간다")을
         재생 중에도 그대로 쓴다 — 직전 프레임이 굽는 데 10ms 넘게 썼으면 이번 프레임은
         **굽는 프레임**으로 보고 시간을 안 보낸다. 그림은 계속 그려지므로 화면이 멎는
         것이 아니라 **잠깐 느려질** 뿐이고, 다 구우면 곧바로 제 속도로 돌아온다.
         ★ 스스로 풀린다 — 시간이 안 가면 장면이 안 바뀌므로 다음 프레임은 구울 것이
           없다. 그래서 이 멈춤은 '굽을 것이 남은 동안'만 정확히 지속된다(보통 한두
           프레임). 그래도 굽기가 끝없이 이어지는 최악의 기기를 위해 **1.5초 상한**을
           둔다 — 그 뒤로는 시간을 다시 보내, 재생이 영영 안 나가는 일은 없다.
         ★ 로딩 표시는 **오래 걸릴 때만** 뜬다(아래 250ms) — 한두 프레임짜리 멈춤에
           띠가 깜빡이면 그것이 더 성가시다. 재생 중에 늘 띄우는 길은 안 쓴다: 그건
           일을 줄이지 않으면서 정작 보고 있는 장면만 가린다. */
      const bakeMs9 = SPRITE_PERF.last.bakeMs;
      const hold9 = bakeHoldRef.current;
      const holding9 = c !== null && bakeMs9 >= BAKE_HOLD_MS9 && hold9.ms < BAKE_HOLD_MAX9;
      if (holding9 && c) hold9.ms += now - c.last;
      else if (bakeMs9 < BAKE_HOLD_MS9) hold9.ms = 0;
      /* ★ 띠를 켜는 자는 **따로**다 — 위 멈춤은 스스로 한 프레임 만에 풀리므로(시간이
         안 가면 구울 것이 없다) 그 길이로는 '오래 끈다'를 못 잰다. 대신 **최근 창에서
         굽기가 차지한 몫**을 본다: 반 초 가운데 40% 넘게 굽고 있으면 사람이 느끼는
         '지금 버벅인다'가 맞고, 그때만 알린다. 창이 닫힐 때만 상태를 놓으므로(반 초에
         한 번) 이 표시가 정작 구울 프레임을 먹지 않는다. */
      hold9.win += bakeMs9;
      hold9.winDt += c ? now - c.last : 0;
      if (hold9.winDt >= 500) {
        const heavy9 = hold9.win > hold9.winDt * 0.4;
        if (heavy9 !== hold9.shown) { hold9.shown = heavy9; setBakeHold(heavy9); }
        hold9.win = 0;
        hold9.winDt = 0;
      }
      const acc = warmingRef.current || holding9
        ? 0 : (c?.acc ?? 0) + dt;
      const drawnAt = c?.drawn ?? 0;
      const draw = acc > 0 && now - drawnAt >= drawGapMs();
      clockRef.current = {
        raf: requestAnimationFrame(tick), last: now,
        acc: draw ? 0 : acc, drawn: draw ? now : drawnAt,
      };
      if (draw) {
        /* ★ 한 번의 그리기에 나아가는 벽시계 상한 80ms(지적: "툭툭 살짝씩 순간이동" — 계측: t 걸음 평균 34ms, 최대
           273ms). 메인이 잠깐 멎었다 풀리면(GC·DOM·굽기) 쌓인 시간을 한 번에 밀어 유닛이 그만큼 건너뛰었다. 그 몫은
           버린다 — 재생이 벽시계보다 조금 늦어질 뿐이고, 사람 눈에는 뜀보다 늦음이 훨씬 덜 거슬린다. 배속을 곱하기
           전의 벽시계로 잰다(8배에서도 한 번에 0.64초 넘게 안 뛴다). 워커는 시계차가 0.3초를 넘으면 명령으로 다시 맞는다. */
        const advWall9 = Math.min(acc, 0.08);
        /* ★ 붓은 React 밖에서(4번) — 살아 있는 시계(tLiveRef9)를 한 걸음 올리고 그 자리에서 캔버스를 칠한다. React 상태
           t는 초당 열 번(REACT_STEP_MS9)만 올린다. 그래서 React가 두 틱을 한 렌더로 합쳐도 캔버스의 걸음은 안 흔들린다
           (옛 '앞 걸음이 안 그려졌으면 버림' 규칙은 필요가 없어졌다). */
        const cur9 = tLiveRef9.current;
        let next9 = cur9 + advWall9 * speed;
        let ended9 = false;
        if (next9 >= total) { next9 = total; ended9 = true; }
        tLiveRef9.current = next9;
        paintFnRef9.current?.(next9);
        const nowR9 = performance.now();
        if (ended9 || nowR9 - reactAtRef9.current >= reactStepRef9.current) {
          reactAtRef9.current = nowR9;
          tFromTickRef9.current = next9;
          setT(next9);
          // 끝까지 봤다고 바깥에 알린다(요청) — 화면이 그때 승패를 드러낸다.
          if (ended9) { setPlaying(false); setDone(true); onFinish?.(); }
        }
      }
    };
    clockRef.current = { raf: requestAnimationFrame(tick), last: performance.now(), acc: 0, drawn: 0 };
    return () => {
      if (clockRef.current) cancelAnimationFrame(clockRef.current.raf);
      clockRef.current = null;
      /* ★ 멈출 때 살아 있는 시각을 React에 넘긴다(지적: "럴커 버로우 때 재생 중과 일시정지의 위치가 다르다") — 붓은
         tLive로 그려 왔고 React t는 100ms 박자라 그보다 뒤처져 있다. 넘기지 않으면 멈춘 화면이 마지막으로 그린 장보다
         ≤100ms **앞 장**으로 되돌아간다(버로우 지점에 못 박히기 직전 걸어오던 자리 같은). 배속을 바꿀 때도 같다. */
      const tl9 = tLiveRef9.current;
      if (tl9 > 0 && tl9 !== tFromTickRef9.current) { tFromTickRef9.current = tl9; setT(tl9); }
    };
  }, [playing, active, speed, total]);

  /* 생산 시각 되짚기(요청: 생산할 때 건물 이름) — 사람×건물종류별로 [생산 초, 그때 고른
     건물 태그]를 미리 모아, 재생 중에는 "지금 창 안에 있나"만 본다. 태그가 있으면(새
     분석본) 그 건물 하나만 깜빡인다(요청: 어느 건물에서 생산 중인지). */
  /* 값은 [**완성** 시각, 건물 태그, 그 유닛의 생산 시간(초)]이다 — 셋째 칸이 이번에
     붙었다(요청: "생산/업그레이드 중 건물 효과는 끝났을때만 켜지는게 아니라 진행중
     계속 켜지는 거고"). 리플레이에 남는 것은 유닛이 **나온** 시각뿐이라, 뽑고 있던
     구간은 거기서 생산 시간을 빼야 나온다. 인포 팝업은 진작 그렇게 하고 있었는데
     (생산 중 NN% — 아래 making) 건물 불빛만 완성 시각 뒤 4초를 보고 있었다. */
  /* 스캔은 탐지 시간만큼 남는다(요청: 스캔 뿌린 게 효과가 있어야 할 듯) — 여태 6초
     (CAST_HOLD_SEC)만 그려 놓고 탐지는 12초를 먹였다. 눈에 보이는 동안이 곧 그 자리가
     디텍터인 동안이라야, 안 보이던 것이 왜 갑자기 표적이 되는지가 화면에서 읽힌다. */
  const castsNow = castsSrc.filter((c) => c[0] <= t
    && t - c[0] <= (c[3] === "Nuclear Strike" ? NUKE_FALL_SEC + NUKE_BOOM_SEC
      : c[3] === "Dark Swarm" ? 30
        : c[3] === "Disruption Web" ? 25
          : c[3] === "Stasis Field" ? 20
            /* 이레디에이트는 걸린 몸을 따라다니는 30초짜리다(아래 표적 추적 주석) —
               6초짜리 '시전 자국'으로 두면 정작 피해가 도는 동안은 화면에 아무것도 없다.
               상태표(STATUS_CASTS.Irradiate.dur)와 **같은 값**이어야 한다. */
            : c[3] === "Irradiate" ? STATUS_CASTS.Irradiate.dur
              : c[3] === "Scanner Sweep" ? SCAN_DETECT_SEC : CAST_HOLD_SEC));
  /* ★ **React 박자를 올리던 자를 걷는다**(핵·스톰이 캔버스로 간 값) ───────────────────────
     여태 이 둘이 떠 있는 동안에는 React 박자를 100ms에서 25~60Hz까지 끌어올렸다. 그림이
     재생 시각으로 칸·애니를 긁는 DOM이라, 그러지 않으면 낙하가 뚝뚝 끊기고 스톰이 칸을
     건너뛰었기 때문이다. 이제 둘 다 붓이 매 프레임 나이로 그리므로 React는 제 박자(100ms)면
     족하다 — 이 큰 컴포넌트를 초당 예순 번 다시 그리던 일이 통째로 사라진다.
     깃발만 남긴다: 핵 창 계량기(NUKEM9)가 '언제부터 언제까지가 핵 창인가'로 쓴다. */
  const nukeOn9 = castsNow.some((c9) => c9[3] === "Nuclear Strike" || c9[3] === "Psionic Storm");
  reactStepRef9.current = REACT_STEP_MS9;
  nukeOnRef9.current = nukeOn9;

  /* (걷어냄) 수송·드랍 어림 한 벌 — 드랍/태움 신호(drops·loads)와 수송선 자취로
     '내린 자리·태운 자리'를 짚던 어림이다. 재료가 전부 v1 부대 트랙이라 요약 폐지 뒤로는
     아무것도 안 나왔다. 개체 트랙에는 승선(f=12)·하차(f=13)가 개체마다 실려 있어,
     다시 만든다면 어림이 아니라 그 증거로 만드는 것이 맞다. */
  /* 본진이 무너졌나(지적: 본진 기지 건물은 절대 안 망했다 — 시작 홀을 builds에 합성하며
     판정이 생겼다) — 집 자리(3타일)의 내 홀 계보에서 마지막 채가 무너졌고 재건이 없으면
     함락이다. 아바타 로스터의 유령화와 채굴 일꾼 걷기가 같이 쓴다. */
  const fallenHome = (m: MotionBase): boolean => {
    const { x: mx, y: my } = m;
    if (mx === undefined || my === undefined) return false;
    const chain = buildsSrc
      .filter(([bs, x2, y2, bu, br]) => br === m.key && bs <= t
        && ["Command Center", "Nexus", "Hatchery", "Lair", "Hive"].includes(bu)
        && Math.hypot(x2 + footDx(bu) - mx, y2 + footDy(bu) - my) <= 3)
      .sort((a, b) => a[0] - b[0]);
    const last = chain[chain.length - 1];
    return !!last && (last[5] ?? 0) > 0 && t >= (last[5] ?? 0);
  };

  /* 무너진 기지의 유닛도 대개 같이 죽는다(지적: 확률은 높은데 완벽하진 않음 — 그래서
     침묵 조건을 같이 건다) — 내 건물이 무너진 자리 곁(8타일)에 서 있었고, 무너진 뒤로
     새 명령 없이 한참(DEAD_QUIET_SEC) 지난 마커는 그 함락에서 정리된 것으로 본다. */



  /* 폭은 무조건 컨테이너 최대가 아니라 화면 세로 공간이 허락하는 만큼(지적: 노트북처럼
     납작한 화면에서 전체 폭을 쓰면 미니맵이 한 화면에 다 안 들어옴) — 맵 높이가
     (100dvh − 조작부 몫)을 넘지 않게 폭을 비율로 역산해 상한을 걸고 가운데 정렬.
     인라인은 맵 아래 전부(도구줄·조종부)와 위쪽 화면 몫까지 빼서 조종부까지 한 화면에
     들어온다(지적). 큰 화면 모달은 맵+조종부만이라 몫이 작다(190px).
     폰 세로 화면에선 이 상한이 컨테이너 폭보다 커서 아무 영향 없다. */
  /* 아바타 로스터 기둥(요청: 아바타를 맵 밖으로 — 1팀 왼쪽·2팀 오른쪽 세로 한 줄,
     로스터식 아바타+닉네임에 그 사람 색까지) — 맵 위의 본진 자리는 합성된 시작 홀이
     다른 홀과 같은 평범한 기지 도형으로 말한다. */
  /** 로스터 한 팀 — `rows`면 **한 사람 한 줄**로 눕는다(요청: 합친 사이드바 구성).
   *
   *  DOM은 두 꼴이 같다 — 눕히는 일은 CSS(.scr-motion-teamcol-rows)가 한다. 그래야
   *  아바타·이름칩·종족 배지·지표가 두 배치에서 **같은 조각**으로 남고, 하나를 고치면
   *  둘이 함께 따라온다(베껴 두면 반드시 갈린다).
   *  ★ 줄 꼴에서는 이름을 안 줄인다 — 기둥이 넓어 자를 까닭이 없다(칸 꼴은 폭 88px을
   *    사람 수로 나눠 쓰므로 여전히 줄인다). */
  /** bare — **종족까지만** 그리는 최소 꼴(요청: "로스터 비활성화해도 로스터는 항상
   *  표시(현황 데이터 미표시 종족까지만 항상 표시)"). 누가 어느 팀에서 무슨 종족으로
   *  하고 있나는 판을 껐어도 늘 읽혀야 하는 것이고, 숫자 다섯은 '지금 자세히 보겠다'를
   *  켰을 때의 것이다. 자리·글자 크기는 켠 꼴과 같다 — 표에서 지표 칸만 빠진다. */
  /** small — 지도 **위에 얹히는** 판(항시표시 로스터)이다(요청: "로스터쪽 요소들 좀 크기
   *  줄이고 갭 줄여서 로스터가 차지하는 영역을 줄일수 있을까"). 그 판에서는 줄 하나가
   *  먹는 세로가 곧 가려지는 지형이라, 줄 높이를 정하는 두 조각(아바타·종족 배지)을 한 단
   *  줄인다. 기둥(사이드바)의 로스터는 제 칸에 서므로 그대로다.
   *  ★ 폭이 아니라 **어느 판이냐**로 가른다 — 아바타가 서는 구간이 뷰포트 1160px 이상이라
   *    폭으로 가르면 정작 아바타가 보이는 화면에서 안 걸린다(그 판이 곧 이 판이다). */
  const teamCol = (team: 1 | 2, rows = false, bare = false, small = false) => {
    /* 한 팀에 몇이냐가 이름 길이를 정한다(요청) — 칸 폭은 고정인데 그 폭을 사람 수로
       나눠 쓰므로, 넷이면 세 자·셋이면 네 자·둘이면 여섯 자·혼자면 통째로다. */
    /* ★ 밀리는 **한 테이블**이다(요청: "재생 플레이어의 로스터도 똑같이 한 테이블로") —
       저장이 team1/team2에 나눠 담을 뿐 편은 없다. 그래서 1팀 칸이 참가자 전원을 싣고
       2팀 칸은 아예 안 그린다(아래 부르는 쪽이 null을 받는다). */
    const mates = melee
      ? (team === 1 ? bases : [])
      : bases.filter((m) => (m.team === 2 ? 2 : 1) === team);
    if (mates.length === 0 && melee) return null;
    /* ★ **모든 화면이 표 하나**다(요청: "표형식은 모든 화면 다 적용") — 여태 좁은
       화면만 '칸 꼴'(사람마다 세로 한 칸, 가로로 흘림)이었는데, 그 꼴은 컬럼 라벨을
       얹을 자리가 없다. 한 사람이 한 줄, 지표는 세로줄 맞춤 — 사이드바가 쓰던 줄 꼴이
       모든 자리의 기본이 된다. rows는 이제 '사이드바 판'이라는 뜻만 남는다(팀 머리와
       전체 이름을 그린다 — 좁은 판은 이름을 줄이고 팀은 좌우 자리가 말해 준다). */
    return (
    <div className={cx("scr-motion-teamcol", "scr-motion-teamcol-rows",
      bare && "scr-motion-teamcol-bare")}>
      {/* ★ 표 머리와 팀 이름은 **한 줄**이다(지적: "on일 때 헤더줄이 하나 더 생겨서
          로스터 위치가 내려감 → 헤더줄을 별도 줄이 아닌 1팀 2팀 타이틀 줄에 병합") ──
          여태 둘은 따로 선 줄이었다. 그래서 표를 켜면 줄이 하나 늘어 아래 사람들이
          통째로 밀렸고, 켜고 끄는 것이 '숫자가 생긴다'가 아니라 '판이 움직인다'로
          읽혔다. 둘을 한 격자 줄에 넣으면 켜든 끄든 **줄 수가 같다** — 지표 칸의
          글자만 생겼다 사라진다.
          첫 칸이 팀 이름 자리다(이름 칸의 라벨은 원래도 비어 있었다 — 아바타·이름이
          곧 라벨이다). 라벨은 값과 같은 격자를 쓰고 오른쪽 맞춤이라, 라벨과 제 값의
          끝자리가 세로로 이어진다. 광물·가스는 숫자와 같은 색이다. */}
      <div className="scr-motion-teamcol-cols scr-motion-teamrow" aria-hidden>
        {/* ★ 팀 이름이 없는 판(밀리)에서도 **줄 높이를 지킨다**(요청: "밀리전도
            헤더로우 자리 항상 확보해서 감춰도 로스터들이 안올라오게 하기") —
            밀리는 편이 없어 이 칸이 빈 글자였고, 최소 꼴(지표 라벨 없음)과 겹치면
            줄 안의 모든 칸이 빈 span이라 격자 줄이 0으로 오므라들었다. 그러면
            로스터를 껐다 켤 때 사람들이 그 높이만큼 오르내린다.
            공백 한 칸을 넣어 **줄 상자**를 만든다 — 라벨(7~8px)보다 이 칸이
            크므로(9~10px) 줄 높이는 라벨이 있든 없든 이 칸이 정한다. 자를 CSS
            min-height로 못 박지 않는 까닭이 그것이다: 글자 크기가 화면마다
            갈리는데 공백은 저절로 따라간다. */}
        <span className="scr-motion-teamhead">{rows && !melee ? `${team}팀` : "\u00A0"}</span>
        {/* 최소 꼴에서도 라벨을 **DOM에 그대로 둔다** — 글자만 CSS로 감춘다(같은 요청).
            읽히면 안 되는 것은 맞다(아래에 숫자가 없으니 이름표만 남으면 빈 말이다).
            다만 지워 버리면 줄 높이를 정하는 것이 남은 칸 하나뿐이 되어, 켜고 끌 때 줄이
            **다른 글자의 높이**로 다시 잡힌다(밀리에서는 그 칸마저 비어 2px로 오므라들었다
            — 실측). 같은 요소·같은 글꼴을 두고 보임만 끄면 높이가 정의상 같다. */}
        {/* ★ 최소 꼴(1단계)에서 이 칸은 **APM 머리**다(요청: "로스터 1단계에서 APM 헤더
            추가") — 그 꼴에서 값 줄의 첫 지표 칸에 APM이 앉으므로(아래 bare 줄), 머리도
            같은 칸이라야 세로줄이 맞는다. 나머지 라벨은 종전대로 감춘다(값이 없는 칸의
            이름표는 빈 말이다). 감추는 규칙에서 이 칸만 빠지도록 클래스를 단다. */}
        <span className={cx(bare && "scr-motion-collabel-on")}>{bare ? "APM" : "일꾼"}</span>
        <span>인구</span>
        <span className="scr-motion-stat-min">광물</span>
        <span className="scr-motion-stat-gas">가스</span>
        <span>APM</span>
      </div>
      {mates.map((m) => {
        const fallen = m.ghost || fallenHome(m);
        const color = modeColor(m.key, m.team);
        /* 줄 꼴의 다섯 지표 — 값이 없어도 **빈 칸을 그린다**(요청: "컬럼별로 줄맞게").
           칸 꼴처럼 없는 것을 안 그리면 사람마다 칸 수가 달라져 세로줄이 어긋난다. */
        const sup9 = supplyNow.get(m.key);
        const res9 = resNow.get(m.key);
        const apm9 = apmNow.get(m.key) ?? m.apm ?? null;
        return (
          <div
            key={m.key}
            style={{ "--pcol": color } as React.CSSProperties}
            /* 로스터 한 칸을 누르면 **그 선수의 시점**이다(요청) — 한 번 더 누르면
               전체 보기로 돌아온다(요청: "한번더 누르면 전체플레이어 보기로 다시
               돌아옴"). 같은 팀 사람을 누르면 시야가 어차피 팀 공유라 그림은 같고,
               고른 칸 표시만 옮겨 간다. */
            /* ★ 누르는 자리는 **아바타+이름**뿐이다(지적: "로스터 선수시야설정 클릭/터치할수
               있는 부분은 아바타와 닉네임으로 제한 지금은 스탯까지 다 범위라 최소화했늘때
               빈공간도 눌림") — 줄 전체가 버튼이면 지표 칸과 그 사이 빈자리까지 누르는
               자리가 된다. 지표는 값을 **읽는** 칸이고, 최소 꼴(bare)에서는 아예 비어 있어
               말 그대로 허공이 눌린다. 손잡이는 아래 머리 조각(scr-motion-teamcol-pick)으로
               옮겼다 — 이 칸은 자리와 상태 표시(눌림 테·흐림)만 맡는다. */
            className={cx("scr-motion-teamcol-item", "scr-motion-teamrow",
              fallen && "scr-motion-base-ghost",
              viewRaw === m.key && "scr-motion-teamcol-eye",
              viewRaw !== null && viewRaw !== m.key && "scr-motion-teamcol-dim")}
          >
            {/* 위는 아바타+이름 한 줄, 아래는 지표 한 줄이다(요청: "각 로스터 아래
                가운데 정렬로 새로배치") — 지표를 이름 칸 안에 두면 아바타 옆에 붙어
                왼쪽으로 쏠린다. 항목 폭 전체를 쓰게 밖으로 뺀다. */}
            <span className="scr-motion-teamcol-head">
            {/* 추적 버튼(요청: "각 멤버 왼쪽에 추적 버튼") — 이름 왼쪽에 선다.
                시점(이름 누르기)과 **다른 손잡이**여야 한다: 시점은 "그 눈으로 밝혀만
                본다"이고 추적은 거기에 카메라까지 맡기는 것이라, 하나에 묶으면 지도를
                제 손으로 보고 싶은 사람이 시점을 못 켠다. */}
            <button
              type="button"
              className={cx("scr-motion-track-btn", trackRaw === m.key && "scr-motion-track-on")}
              aria-pressed={trackRaw === m.key}
              title={trackRaw === m.key ? `${m.name} 추적 끄기` : `${m.name} 추적 — 시야와 화면을 따라간다`}
              onClick={(ev) => { ev.stopPropagation(); toggleTrack(m.key); }}
            >
              <Crosshair size={11} aria-hidden />
            </button>
            <span
              className="scr-motion-teamcol-pick"
              role="button"
              tabIndex={0}
              aria-pressed={viewRaw === m.key}
              title={viewRaw === m.key ? `${m.name} 시점 끄기` : `${m.name} 시점으로 보기`}
              /* 시점을 손으로 고르면 추적은 놓는다 — 추적이 켜 둔 시야를 그 자리에서
                 갈아 끼우면, 카메라만 딴 사람을 따라가는 짝짝이 화면이 된다. */
              onClick={() => { stopTrack9(); setViewRaw((v) => (v === m.key ? null : m.key)); }}
              onKeyDown={(ev) => {
                if (ev.key !== "Enter" && ev.key !== " ") return;
                ev.preventDefault();
                stopTrack9();
                setViewRaw((v) => (v === m.key ? null : m.key));
              }}
            >
            <span className="scr-motion-base-ring" style={{ boxShadow: `0 0 0 2px ${color}` }}>
              {(() => {
                /* 프사는 **꽂혀 있고 켜져 있어야** 그린다(chrome.ts) — 앱이 주는가와
                   이 화면에서 쓸 것인가는 다른 물음이라 둘 다 본다. */
                const Av9 = replayAvatarOn(avatars);
                /* 지도 위 판은 한 단 작게(요청: 로스터가 먹는 자리 줄이기) — 줄 높이를
                   정하는 것이 이 동그라미다(22 → 18이면 줄이 4px 낮아진다). */
                return Av9
                  ? <Av9 member={{ id: m.memberId, nickname: m.name, avatar: m.avatar }} size={small ? 18 : 22} />
                  : null;
              })()}
            </span>
            <span className="scr-motion-teamcol-text">
              {/* 줄인 이름 하나로(재요청: 한글 3·영문 5 제한) — 전체 이름은 카드·댓글에서. */}
              <span className="scr-motion-teamcol-name" style={chipStyle(m.key, m.team)}>
                {rows ? m.name : shortName(m.name, mates.length)}
              </span>
              {/* 종족 한 글자(요청) — 이름 옆. 종족 고유색 글자만 두는 배지라 자리를
                  거의 안 먹는다. 종족을 못 읽은 경기는 스스로 안 그린다. */}
              {/* 반으로(요청: "종족배지 크기 반으로 줄이고") — 16 → 8. 배지는 읽는
                  표시지 누르는 것이 아니라, 이름을 위해 줄에서 자리를 내주는 쪽이 맞다.
                  ★ 8px에서는 RaceBadge의 **글자 하한**이 걸린다 — 그쪽은 글자를
                    max(8, size × 0.62)로 잡아, 8px 원에 8px 글자가 들어가 테두리를
                    비집고 나온다. 그 하한을 5로 내려 작은 배지가 제 원 안에 들게 했다
                    (size 13 이상은 0.62 쪽이 늘 크므로 한 톨도 안 달라진다). */}
              {(() => {
                const Rb9 = replayChrome().RaceBadge;
                // 8 → 14(요청: 1.8배) · 지도 위 판만 12(요청: 로스터가 먹는 자리 줄이기)
                return m.race && Rb9 ? <Rb9 race={m.race} circleLetter size={small ? 12 : 14} /> : null;
              })()}
            </span>
            </span>
            </span>
              {/* 지표 다섯 칸 — **어느 화면이든 같은 다섯**이다(요청: 표 형식 전면).
                  '일꾼' 라벨은 뗐다(요청) — 그 이름은 이제 위 컬럼 라벨 줄이 한 번만
                  말한다. 값이 없어도 빈 칸을 그려 세로줄을 지킨다. 미네랄·가스는 색만
                  (파랑 미네랄·초록 가스 — 원작 색), APM은 지난 1분치다. */}
              {/* ★ 최소 꼴(1단계)에서도 **APM 하나는 남긴다**(요청: "로스터 1단계 모드에서
                  APM은 옆에 표시하기(닉네임 바로 오른쪽 위치하게)" · "세로 줄 맞추기") ──
                  이름 글자 뒤에 그냥 붙이면 닉네임 길이가 사람마다 달라 숫자가 들쭉날쭉
                  선다. 표의 **첫 지표 칸**(이름 칸 바로 오른쪽, 켠 꼴의 '일꾼' 자리)에
                  앉히면 자리는 닉네임 바로 옆이면서 세로줄이 저절로 맞는다 — 칸 나눔은
                  라벨 줄과 같은 --roster-cols 하나가 쥐기 때문이다. 나머지 네 칸은 빈
                  칸으로 둔다(안 그리면 격자가 어긋난다). */}
              {bare && (
              <span className="scr-motion-stats">
                <span className="scr-motion-stat">{apm9 ?? ""}</span>
                <span className="scr-motion-stat" />
                <span className="scr-motion-stat" />
                <span className="scr-motion-stat" />
                <span className="scr-motion-stat" />
              </span>
              )}
              {!bare && (
              <span
                className="scr-motion-stats"
                style={workerNow.has(m.key) ? undefined : { visibility: "hidden" }}
              >
                <span className="scr-motion-stat">{workerNow.get(m.key) ?? 0}</span>
                <span className="scr-motion-stat">
                  {sup9 ? `${sup9[0]}/${sup9[1]}` : ""}
                </span>
                <span className="scr-motion-stat scr-motion-stat-min">
                  {res9 ? res9[0] : ""}
                </span>
                <span className="scr-motion-stat scr-motion-stat-gas">
                  {res9 ? res9[1] : ""}
                </span>
                <span className="scr-motion-stat">{apm9 ?? ""}</span>
              </span>
              )}
            {winnerTeam && (m.team === 2 ? 2 : 1) === winnerTeam && t >= total - 0.5 && !fallen && (
              <span className="scr-motion-trophy">🏆</span>
            )}
          </div>
        );
      })}
    </div>
    );
  };

  /* (삭제·요청: 안 쓰는 범례 정리) — 건물·유닛·일꾼이 전부 제 모델로 그려져 기호
     범례(■·●)가 더는 화면과 안 맞았다. 범례 한 벌을 통째로 걷는다. */

  /* 버튼 줄(요청: "오른쪽에 색상부터 나머지 버튼류 모두 배치" → "버튼단은 하단으로
     이동") — 넓은 배치에서는 지도 오른쪽 기둥의 맨 아래, 좁은 화면에서는 지도 아래 제
     자리에 선다. 한 벌을 두 자리에 쓰므로 변수로 뽑아 둔다. */
  /* 차례는 색상 → 성능 → 체력바 → 마우스 조작이다. 2D/3D 알약은 없다
     (요청: "기존 2d3d 토글은 피시 모바일 다 제거") — 각도는 지도 오른쪽 슬라이드 바가
     쥔다. */
  /* 모바일 줄(요청: "모바일 구성 — 색상 … 성능 … 현재장면공유버튼 / 재생버튼 …
     진행바 … 진행시각") — 좁은 화면에는 이 둘만 남긴다. 체력바·마우스 조작은
     안 그린다(요청: 버튼 다 제거). 기능은 그대로다 — 상태와 그것을 읽는 렌더 경로는
     한 줄도 안 건드렸고, PC의 오른쪽 기둥에서는 다섯 개가 다 선다. */
  /* fs = 전체화면 하단 줄인가 — 그때는 색상·품질 알약을 **안 그린다**(지적: "모바일
     전체화면에서 색상 성능이 아래에 한번더 나옴"). 전체화면의 그 둘은 햄버거로 여는
     사이드바(viewRowNode)가 이미 들고 있어, 하단에 또 서면 같은 토글이 한 화면에 둘이다.
     하단에는 이 줄만이 가진 것 — 여닫이·공유 — 만 남긴다. */
  /* (걷어냄) mobBarNode — 좁은 화면에서 공유 버튼을 제 줄에 세우던 조각이다. 아래 줄을
     하나로 합치면서(요청) 부를 데가 없어졌다. 품질 알약은 이미 도구 판과 함께 걷혔고,
     남아 있던 것은 shareNode 하나였다. */

  /* 토글을 두 갈래로 나눠 둔다(요청: 전체화면에서 "그아래는 각각 지도 표시 토글류,
     성능 색상 선택류가 배치") — 평소 배치에서는 아래 viewRowNode가 둘을 도로 한 줄로
     이어 붙이므로 지금 화면은 한 톨도 안 바뀐다. 전체화면만 좌우로 갈라 쓴다. */
  /* (걷어냄) perfToggleNode — 도구 판의 품질 알약. */
  /* (걷어냄) mapToggleNode — 도구 판의 체력바·마우스 조작 알약. */
  /* (걷어냄·요청: 도구 오버레이 미사용) viewRowNode — 품질·체력바·마우스 조작 줄. */

  /* 조종간 한 줄(요청: PC·모바일 공통 — [재생 | 탐색바 | 시각]) — 평소 배치와
     전체화면이 **같은 것 하나**를 나눠 쓴다. 탐색바는 비제어(ref)라 두 곳에 동시에
     둘 수 없으므로, 전체화면일 때는 아래쪽 한 벌만 그린다(둘 중 하나만 붙는다). */
  const controlsNode = (
      <div className="scr-motion-bar scr-motion-bar-controls">
        <button
          type="button" className="scr-motion-play"
          onClick={() => {
            if (done) { setT(0); setDone(false); setPlaying(true); return; }
            setPlaying((v) => !v);
          }}
          aria-label={playing ? "일시정지" : "재생"}
        >
          {playing
            ? <Pause size={20} fill="currentColor" />
            : done
              ? <RotateCcw size={20} />
              : <Play size={20} fill="currentColor" />}
        </button>
        {/* 비제어 탐색바(지적: 드래그가 안 먹고 느림 — 위 rangeRef 주석). step이 없어야
            ×4에서도 손잡이가 툭툭 안 뛴다. --p는 지나온 자리를 채우는 그라데이션 경계다. */}
        <input
          ref={rangeRef}
          className="scr-motion-range" type="range"
          min={0} max={total} step="any" defaultValue={t}
          onPointerDown={() => { scrubbing.current = true; }}
          onPointerUp={() => { scrubbing.current = false; }}
          onPointerCancel={() => { scrubbing.current = false; }}
          onInput={(e) => {
            const el = e.target as HTMLInputElement;
            const v = Number(el.value);
            el.style.setProperty("--p", `${total > 0 ? (v / total) * 100 : 0}%`);
            // 지도는 프레임당 한 번만 따라온다 — 끌기 이벤트마다 그리면 손이 밀린다.
            if (seekPending.current === null) {
              requestAnimationFrame(() => {
                const sv = seekPending.current;
                seekPending.current = null;
                if (sv === null) return;
                setT(sv);
                setDone(sv >= total);
              });
            }
            seekPending.current = v;
          }}
          aria-label="재생 위치"
        />
        {/* 시계 폭은 **글자 자신**이 고정한다(지적: "진행바 옆에 자리를 너무 남김 다
            써야지") — 여태 이 칸에 `min-width: 13ch`를 걸어 뒀는데, ch는 이 칸의 글꼴
            (16px)로 재고 정작 글자는 9px이라 자리가 두 배로 잡혔다. 실측(390px 화면):
            칸 115.7px에 글자 52.5px — 63px이 그냥 비어 있었고 그만큼 탐색바가 짧았다.
            9:59에서 10:00로 넘어갈 때 흔들리지 않게 하려던 것이 본뜻이므로, 짧은 쪽을
            숫자폭 빈칸(U+2007)으로 앞을 채워 글자 수를 늘 같게 만든다. tabular-nums와
            짝이라 빈칸 하나가 숫자 하나와 정확히 같은 폭이다. */}
        <span className="scr-motion-clockwrap" style={{ fontVariantNumeric: "tabular-nums" }}>
          <span className="scr-motion-clock">
            {fmtClock(t).padStart(fmtClock(total).length, "\u2007")} / {fmtClock(total)}
          </span>
        </span>
      </div>
  );

  /* 지도 상자 — 평소 배치와 전체화면이 **같은 것 하나**를 나눠 쓴다(요청: 전체화면
     모드). 두 벌로 베끼면 캔버스·렌즈·팝업이 두 트리에 생겨 굽기 캐시도 손짓 상태도
     갈린다. 변수 하나로 두고 붙는 자리만 달리한다. */
  /** 지도 오른쪽 아래에 떠 있는 아이콘 줄 — 평소 배치는 지도 상자 안, 전체화면은
   *  화면 뿌리에 선다(전체화면의 지도는 화면보다 크게 깔려 구석이 잘린다). */
  /* ★ 지도 **오른쪽 아래**의 떠 있는 아이콘 줄(요청: "전체화면 토글 버튼은 오버레이나
     사이드패널이 아닌 지도 최우측하단에 배치 · 그 왼쪽에 로스터 오버레이 온오프토글
     (필요한 경우만) · 그 왼쪽에 도구오버레이 온오프토글(필요한 경우만) · 피시 모바일
     모두") ────────────────────────────────────────────────────────────────────────
     여닫는 손잡이가 **여닫히는 판 안에** 있으면 안 된다 — 판이 사라질 때 손잡이도 함께
     사라져, 다시 열 길이 없어진다(전체화면 햄버거가 안 보이던 사고가 그것이었다).
     차례는 오른쪽부터 전체화면 · 로스터 · 도구다 — 늘 있는 것이 바깥이고, 그 판이 있는
     배치에서만 서는 것이 안쪽이다.
     ★ 붙는 자리는 배치마다 다르다(지적: "피시 전체화면에 아이콘이 하나도 없어") —
       평소 배치에서는 지도 상자 안이 곧 화면 안이라 지도에 붙이면 되지만, 전체화면의
       지도는 **화면보다 크게 깔려 잘린다**(fsCoverW). 그 상자의 오른쪽 아래 구석은
       화면 밖이라, 거기 붙은 줄은 통째로 안 보였다. 전체화면에서는 판 뿌리
       (.scr-fs-root)에 직접 세운다 — 아래 두 자리가 그것이다.
     누름은 여기서 끊는다(stopPropagation) — 지도의 탭 판정이 이 버튼의 누름까지 받으면
     한 번 누름에 두 가지가 움직인다. */
  /* 실기기 진단(#diag) — 지금 화면이 **실제로** 쓰는 수치. 폰에서 이 한 장이면 흐림의
     원인이 갈린다(위 SCR_DIAG 주석): 배킹이 화면 요구를 못 따라간 것인지, 예산에
     막힌 것인지, 배킹은 멀쩡한데 합성이 버린 것인지. 안 켜면 아무것도 안 그린다.
     버튼 줄과 같이 배치마다 붙는 자리가 달라서 변수로 둔다. */
  const diagModes9 = scrDiagModes();
  const memMain9 = useMemo(() => {
    if (!diagOn) return { truth: 0, ent: 0, ui: 0, walks: 0 };
    const seen9 = new Set<object>();
    return { truth: estBytes9(truth, seen9), ent: estBytes9(entData, seen9), ui: estBytes9(world, seen9), walks: estBytes9(entWalks9, seen9) };
  }, [diagOn, truth, entData, world, entWalks9]);
  const dm9 = (k: string): boolean => diagModes9.has(k) || diagModes9.has("all");
  const sheetsMB9 = (SPRITE_PERF.last.bytes + SPRITE_PERF.last.bldBytes) / 1048576;
  /* `#diag=fps` — 오른쪽 위 귀퉁이에 **작은 fps 오버레이만**(요청). 다른 진단 글은 안 그린다.
     붓의 fps 계측(paintFnRef9)이 0.5초마다 fpsTick9를 올려 이 숫자만 다시 그린다. */
  const fpsOnly9 = diagModes9.size === 1 && diagModes9.has("fps");
  fpsOnlyRef9.current = fpsOnly9;
  const diagNode = fpsOnly9 ? (
    <div className="scr-motion-diag scr-diag-fps">
      {SCR_DIAG.fps}<span className="scr-diag-fps-u">fps</span>
      {" · "}{SPRITE_PERF.wLast.worstFrame.toFixed(0)}ms
      {" · 워커 "}{wStatRef.current.buildMs.toFixed(0)}ms
    </div>
  ) : diagOn ? (
  <div className="scr-motion-diag">
                {/* 머리 — 늘 보인다: 배킹(dpr)·배율·어느 판인가. */}
                <div>
                  dpr {SCR_DIAG.dpr} · 배율 {SCR_DIAG.zoom.toFixed(2)}
                  {" · 판 "}{typeof __SCPLAY_BUILD__ !== "undefined" ? __SCPLAY_BUILD__ : "dev"}
                  {SCR_DIAG.unitScale !== 1 || SCR_DIAG.scale !== 1 ? " · ⚠재표본" : ""}
                  {!SCR_DIAG.allocOk ? " · ⚠배킹확보 실패" : ""}
                </div>
                {/* 요약(값 없는 #diag) — 한 줄에 끊김·메모리·워커의 첫 자를 다 둔다. */}
                {diagModes9.size === 0 && (
                  <div>
                    최악프레임 {SPRITE_PERF.wLast.worstFrame.toFixed(0)}ms(굽기 {SPRITE_PERF.wLast.worstFrameBake.toFixed(0)})
                    {" · 굽기 "}{SPRITE_PERF.wLast.bake}장 버림 {SPRITE_PERF.wLast.evict}
                    {" · 판 "}{sheetsMB9.toFixed(1)}/{(SPRITE_TOTAL_MAX / 1048576).toFixed(0)}MB
                    {" · 캔버스 "}{SPRITE_PERF.dom.canvasMB.toFixed(1)}MB
                    {" · 워커 "}{frameWorkerRef.current ? (wStatRef.current.ready ? "on" : "준비중") : "off"}
                    {" "}{wStatRef.current.buildMs.toFixed(0)}ms
                    {wStatRef.current.err ? ` ⚠ ${wStatRef.current.err}` : ""}
                  </div>
                )}
                {/* ★ 진단을 **주제별 줄**로 가른다(지적: "diag draw 너무 많아서 정리 · 내용별로 줄바꿈 — 뭐가 뭔지
                    눈에 안 들어와") — 한 덩이로 이어 붙이던 것을 모드 넷(draw·bake·fog·load·gest)으로 나누고,
                    모드 안에서도 한 주제가 한 줄이다. 줄 머리에 주제 이름. `all`은 여전히 전부. */}
                {dm9("draw") && (
                  <>
                    <div>
                      <b>화면</b>{" "}유닛 {SCR_DIAG.unitCss}css → {SCR_DIAG.unitBack} (B {SCR_DIAG.unitB.toFixed(2)}
                      {SCR_DIAG.dpr && SCR_DIAG.unitB < SCR_DIAG.dpr ? ` · 화질 ${Math.round((SCR_DIAG.unitB / SCR_DIAG.dpr) * 100)}%` : ""})
                      {" · 지도 "}{SCR_DIAG.mapBack} · 타일당 {SCR_DIAG.ppt}/{SCR_DIAG.needed}
                    </div>
                    {SCR_DIAG.crowd ? <div><b>덜어내기</b>{" "}{SCR_DIAG.crowd}</div> : null}
                    <div>
                      <b>프레임</b>{" "}찍기{" "}
                      {SPRITE_PERF.wLast.frames
                        ? Math.round(SPRITE_PERF.wLast.blit / SPRITE_PERF.wLast.frames) : 0}장/프레임
                      {" · 최악프레임 "}{SPRITE_PERF.wLast.worstFrame.toFixed(0)}ms
                      {" (그중 굽기 "}{SPRITE_PERF.wLast.worstFrameBake.toFixed(0)}ms) · 마커 {SPRITE_PERF.dom.markers}개
                      {/* 이 판이 본 가장 긴 프레임과 그 몫(위 WORSTF9) — 핵 창 밖의 끊김도 여기 잡힌다. */}
                      {WORSTF9.ms > 0 ? ` · 최장프레임[${WORSTF9.ms.toFixed(0)}ms ${WORSTF9.parts}]` : ""}
                      {/* 타이머 틈(위 TICKM9) — rAF와 견줘 '주 실마리가 막혔나 · 그리기만 굶었나'를 가른다. */}
                      {TICKM9.n > 0 ? ` · 타이머[최악${TICKM9.worst.toFixed(0)}ms ${TICKM9.n}번]` : ""}
                      {/* 캔버스 배킹 손실(위 LOST9) — 잃고 다시 그린 횟수·검사 횟수. */}
                      {` · 배킹[손실${LOST9.n} 검사${LOST9.probe}${SCR_DIAG.allocOk ? "" : " ⚠확보실패"}]`}
                      {/* React 한 장(위 REACTM9) — 핵·스톰이 뜨면 박자가 25~60Hz로 오른다. */}
                      {SCR_DIAG.react ? ` · 리액트[박자${reactStepRef9.current}ms · ${SCR_DIAG.react}]` : ""}
                      {/* 지난 핵 창(위 NUKEM9) — 멈춘 뒤에 찍어도 남아 있다. */}
                      {SCR_DIAG.nukem ? ` · 핵[${SCR_DIAG.nukem}]` : ""}
                    </div>
                  </>
                )}
                {dm9("bake") && (
                  <>
                    {/* 굽는 값 — 예산 안이어도 프레임마다 다시 굽고 있으면 버벅인다. '버림'이 0이 아니면 예산 압박이
                        다시 굽기를 부르는 것이고, '미룸'이 쌓이면 프레임 굽기 예산에 일이 밀려 있는 것이다. */}
                    <div>
                      <b>굽기</b>{" "}{SPRITE_PERF.wLast.secs.toFixed(0)}초 · 유닛{" "}
                      {SPRITE_PERF.wLast.bake}장 {SPRITE_PERF.wLast.ms.toFixed(0)}ms · 건물{" "}
                      {SPRITE_PERF.wLast.bldBake}장 {SPRITE_PERF.wLast.bldMs.toFixed(0)}ms
                      {" · 버림 "}U{SPRITE_PERF.wLast.evict}/B{SPRITE_PERF.wLast.bldEvict}
                      {" · 미룸 "}U{SPRITE_PERF.wLast.defer}/B{SPRITE_PERF.wLast.bldDefer}
                      {/* 대기표에 남은 수(위 BAKE_WANT9) — 큰 것부터 굽고 남은 몫이다. */}
                      {BAKE_WANT9.size > 0 ? ` 대기${BAKE_WANT9.size}` : ""}
                      {/* ★ 그 굽기 가운데 **잉크 훑기**(getImageData)가 얼마인가 — 판을 GPU가 들고 있으면
                          이 한 줄이 파이프라인을 세워(readback) 한 장에 수십 ms가 되기도 한다. */}
                      {" · 훑기 "}{Math.round(SCAN_MS9.last)}ms
                      {" · 최악판 "}{SPRITE_PERF.wLast.worstKind || "-"}{" "}
                      {SPRITE_PERF.wLast.worst.toFixed(0)}ms
                    </div>
                    {/* 굽기 일꾼(위 BAKEW9) — on/off(까닭) · 보냄/받음 · 날아감/대기 · 왕복 · 일꾼 안 굽기 ms. */}
                    <div><b>굽기일꾼</b>{" "}{SCR_DIAG.bakew || "-"}</div>
                    {/* 판이 왜 갈리나 — 굽기 회전의 임자다(유닛·건물 각각 상위 셋). */}
                    <div><b>판갈림</b>{" "}유닛 {missTop9(UNI_MISS9.why)} · 건물 {missTop9(BLD_MISS9.why)}</div>
                    {/* 캔버스 만듦(위 CVN9)·되쓰기 창고(위 CVSTORE9) — 캔버스를 얼마나 새로 짓고, 얼마나 되쓰나. */}
                    <div>
                      <b>캔버스</b>{" "}만듦 총{CVN9.n} 초당{CVN9.rate.toFixed(0)} 최고{CVN9.peak.toFixed(0)}{CVN9.peakTop ? `(${CVN9.peakTop})` : ""}
                      {` · 창고 든${CVSTORE9.hit} 빗${CVSTORE9.miss} 넣${CVSTORE9.put} 쌓${CVSTORE9.list.length}`}
                    </div>
                  </>
                )}
                {dm9("fog") && SCR_DIAG.fog ? (
                  /* 안개 붓 계량기(위 FOGM9)·역행·떨림 — 안개만 뒤처지거나 떠는 신고를 수로 가른다. */
                  <div><b>안개</b>{" "}{SCR_DIAG.fog}</div>
                ) : null}
                {dm9("load") && (
                  <>
                    {/* ★ 로딩의 초는 어디로 가나(위 LOAD9) — 메인 실마리를 초 단위로 잡을 수 있는
                        자리 넷을 나란히 둔다. 합이 곧 '로딩이 기어간 시간'이고, 큰 칸이 다음 칼이다. */}
                    <div>
                      <b>로딩</b>{" "}지도판{MAPVEC_M9.ms.toFixed(0)} 참값{LOAD9.truthMs.toFixed(0)}
                      {` 워커세움${LOAD9.wkMs.toFixed(0)} 예열${LOAD9.warmMs.toFixed(0)}ms/${LOAD9.warmN}개`}
                    </div>
                    {/* 지도 판(위 MAPVEC_M9) — 다시 구운 수·확보 실패·지금 예산과 한 변. 지도가 까만 채로
                        남는 신고를 '안 구웠나 · 굽다 실패했나'로 가른다. */}
                    <div>
                      <b>지도판</b>{" "}구움{MAPVEC_M9.bake} 실패{MAPVEC_M9.fail} 줄임{MAPVEC_M9.shrink}
                      {` 한변${MAPVEC_M9.side} 예산${(MAPVEC_M9.cap / 1e6).toFixed(1)}Mpx`}
                      {` 굽기${MAPVEC_M9.ms.toFixed(0)}ms(최악${MAPVEC_M9.max.toFixed(0)})`}
                    </div>
                    {/* 입체 흐림 조사(지적: "3D에서 맵 선명하지 않은 거 조사") — 타일당 기기픽셀 셋을 나란히:
                        서피스(합성기가 실제로 래스터하는 해상도) · 배킹(우리가 구운 것) · 요구(화면 맨 앞줄이 보이는 것).
                        서피스 < 요구면 합성 단계가 병목이고, 배킹 < 요구면 굽기가 병목이다. */}
                    {pitched && MAPVEC_M9.tiles > 0 ? (
                      <div>
                        <b>입체</b>{" "}R{MAPVEC_M9.r} 창{MAPVEC_M9.css}css→서피스{MAPVEC_M9.surf}px 배킹{MAPVEC_M9.back}px {MAPVEC_M9.tiles.toFixed(0)}타일
                        {` · 타일당 서피스${(MAPVEC_M9.surf / MAPVEC_M9.tiles).toFixed(0)} 배킹${(MAPVEC_M9.back / MAPVEC_M9.tiles).toFixed(0)} 요구${MAPVEC_M9.need.toFixed(0)}(앞줄×${MAPVEC_M9.pmag.toFixed(2)})`}
                      </div>
                    ) : null}
                  </>
                )}
                {dm9("gest") && (
                  /* 손짓 조사 — 한 장 값(미룸 문턱 XF_HEAVY_MS9)·배킹 몫·그린 장의 원점(ORG9)·세대·차례·실시간 원근 판정. */
                  <div>
                    <b>손짓</b>{" "}{SCR_DIAG.xfms}ms{SCR_DIAG.xfms >= XF_HEAVY_MS9 ? "(미룸)" : ""}
                    {xfBackK9.k !== 1 ? ` 배킹×${xfBackK9.k}` : ""}
                    {" · 원점 그린"}{ORG9.ox.toFixed(0)}{"/지금"}{ORG9.live.toFixed(0)}
                    {" 세대"}{ORG9.gen}{"·차례"}{ORG9.seq}{"/보냄"}{wStatRef.current.sentView}
                    {" "}{live3dOn9() ? (liveViewOkRef9.current ? "live" : "접힘") : "off"}
                    {(() => { const m9 = xfMsMid9(); return m9 >= 0 ? `(실측${m9.toFixed(0)}/${LIVE3D_DRAW_MS9}ms)` : `(벤치${CROWD9.bench3.toFixed(0)}/${LIVE3D_BENCH_MS9}ms)`; })()}
                    {" · "}{ORG9.sLast}걸음 역행{ORG9.rLast}
                  </div>
                )}
                {dm9("mem") && (
                  <>
                    {/* 메모리 흐름(위 MEMTR9) — 처음·지금·최대가 나란하면 새는 데가 없다. */}
                    {MEMTR9.n > 0 ? <div><b>메모리</b>{` 처음${MEMTR9.first.toFixed(0)} 지금${MEMTR9.now.toFixed(0)} 최대${MEMTR9.max.toFixed(0)}MB`}
                      {` · 캔버스${MEMTR9.cv}장 ${MEMTR9.cvMB.toFixed(1)} · 판 ${MEMTR9.plMB.toFixed(1)} · 설계도안개 ${MEMTR9.exMB.toFixed(1)}`}</div> : null}
                    {/* 탭이 터지는 자 — 판(오프스크린)과 화면 캔버스는 서로 다른 것이라 더해야 전체다. */}
                    <div>
                      판 유닛 {SPRITE_PERF.last.keys}장 {(SPRITE_PERF.last.bytes / 1048576).toFixed(1)}MB
                      {" · 건물 "}{SPRITE_PERF.last.bldKeys}장 {(SPRITE_PERF.last.bldBytes / 1048576).toFixed(1)}MB
                      {" / 합 "}{sheetsMB9.toFixed(1)}/{(SPRITE_TOTAL_MAX / 1048576).toFixed(0)}MB
                    </div>
                    <div>
                      캔버스 {SPRITE_PERF.dom.canvases}장 {SPRITE_PERF.dom.canvasMB.toFixed(1)}MB
                      {" + 판 "}{sheetsMB9.toFixed(1)}MB{" = "}{(SPRITE_PERF.dom.canvasMB + sheetsMB9).toFixed(1)}MB
                      {" · 설계도 "}{(((): number => {
                        let b9 = 0;
                        for (const f9 of wFramesRef.current.values()) b9 += f9.buf.byteLength;
                        return b9;
                      })() / 1048576).toFixed(1)}MB {wFramesRef.current.size}장
                      {/* 안개 판 갈무리(fogSnapsRef9) — 되감기용으로 15초를 들고 있다. 칸당 explored가
                          w·h·2바이트라 큰 지도에서는 이 줄이 설계도보다 무거울 수 있다. */}
                      {" · 안개판 "}{(((): number => {
                        let b9 = 0;
                        for (const sn9 of fogSnapsRef9.current) {
                          b9 += (sn9.fog?.visSrc?.byteLength ?? 0) + (sn9.fog?.explored?.byteLength ?? 0)
                            + (sn9.fog?.visNow?.byteLength ?? 0);
                        }
                        return b9;
                      })() / 1048576).toFixed(1)}MB {fogSnapsRef9.current.length}장
                    </div>
                    <div style={{ fontSize: "0.92em", opacity: 0.85 }}>{SPRITE_PERF.dom.list || "-"}</div>
                    {/* 자바스크립트 쪽 큰 덩어리의 어림(memEst9) — 참값은 워커에 넘긴 뒤라 메인은 껍데기만 남아야 한다. */}
                    <div>
                      메모리(어림) 메인: 참값 {mb9(memMain9.truth)} · 개체 {mb9(memMain9.ent)} · UI파생 {mb9(memMain9.ui)}
                      {" · 걷기 "}{mb9(memMain9.walks)}
                      {" | 워커: "}{memWorker9 ? `참값 ${mb9(memWorker9.truth)}(형식 ${mb9(memWorker9.typed ?? 0)}) · 파생 ${mb9(memWorker9.world)}` : "-"}
                    </div>
                    {memWorker9?.top && (
                      <div style={{ fontSize: "0.92em", opacity: 0.85 }}>
                        워커 파생 상위: {memWorker9.top.map(([k9, b9]) => `${k9} ${mb9(b9)}`).join(" · ")}
                      </div>
                    )}
                  </>
                )}
                {dm9("truth") && (
                  <div>
                    {SCR_DIAG.truthWhy ? `⚠ ${SCR_DIAG.truthWhy} · ` : ""}
                    참값 판 {SCR_DIAG.truthVer || "?"} · 갈림{" "}
                    {SCR_DIAG.truthTrust < 0 ? "없음"
                      : `${Math.floor(SCR_DIAG.truthTrust / 60)}분 ${Math.floor(SCR_DIAG.truthTrust % 60)}초`}
                  </div>
                )}
                {dm9("worker") && (
                  /* 프레임 워커 — on/준비중/off · 받은/쓴/놓친 장수 · 한 장 짓는 ms · op·KB · 앞 · 시야 · [속] · 오류(⚠). */
                  <div style={{ wordBreak: "break-all" }}>워커 {SCR_DIAG.worker || "-"}</div>
                )}
                {dm9("brush") && (
                  <div style={{ wordBreak: "break-all" }}>붓 2초: {brushLogSummary9()}</div>
                )}
                {dm9("view") && ((): React.ReactNode => {
                  /* 보기 상태 변화(위 viewDiag9) — 최근 3초의 종류별 횟수, 지금 값, 마지막 여덟 사건(몇 초 전). */
                  const d9 = viewDiag9.current;
                  const now9 = performance.now();
                  const recent9 = d9.ev.filter((e9) => now9 - e9.t < 3000);
                  const cnt9: Record<string, number> = {};
                  for (const e9 of recent9) cnt9[e9.k] = (cnt9[e9.k] ?? 0) + 1;
                  return (
                    <div style={{ wordBreak: "break-all" }}>
                      보기 3초: {Object.entries(cnt9).map(([k9, n9]) => `${k9}×${n9}`).join(" ") || "-"}
                      {` · 지금 팬 ${d9.last.pan ?? "-"} 배율 ${d9.last.zoom ?? "-"} 무대 ${d9.last.stage ?? "-"} 예산 ${d9.last.budget ?? "-"} 창 ${d9.last.ih ?? "-"}`}
                      {` · 최근 ${recent9.slice(-8).map((e9) => `${e9.k}@${((now9 - e9.t) / 1000).toFixed(1)}s`).join(" ") || "-"}`}
                      <div>링크: {linkDiag9.join(" ‖ ") || "-"}</div>
                    </div>
                  );
                })()}
              </div>
  ) : null;
  /** 확대 버튼에 적을 값 — 화면의 지금 배율이다(핀치·더블탭·휠·한 손 줌 공통). 칸에
   *  딱 떨어지면 정수(4배), 손짓으로 온 어중간한 값이면 소수 한 자리(3.6배)다. */
  const zoomText = `${zoomLive >= 9.95 ? Math.round(zoomLive) : Math.round(zoomLive * 10) / 10}배`;
  const mapBtnRow = (
    <div
      // (걷어냄) is-up — 도구 판이 없어져 밀어 줄 것이 없다(요청).
      className="scr-motion-mapbtns"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {/* 차례는 **배속 → 줌 → 컬러 → 보기 → 전체화면**이다(요청). 전체화면에만 있는
          둘(도구·로스터)은 그 다섯을 안 끊게 맨 앞에 붙인다 — 배치가 바뀌어도 늘 쓰는
          다섯의 상대 차례가 그대로여서 손이 자리를 다시 안 익혀도 된다. */}
      {/* (걷어냄·요청: "도구 오버레이 버튼 제거 · 그 안에서 쓰는 기능도 일단 미사용
          — 일반/전체 모두에서") — 이 버튼이 열던 도구 판(품질·체력바·마우스 조작 ·
          PC 미니맵)을 통째로 안 그린다. 여는 손잡이만 남기면 열 것이 없다. */}
      {/* 로스터 오버레이 — 이것도 어느 배치에나 있다(위와 같은 사정: 평소 배치의
          로스터가 '문서의 한 줄'이던 시절의 게이트가 남아 있었다).
          ★ 아이콘이 **꼴을 따라 바뀐다**(요청: "미활성 상태에선 사람 모양으로, 로스터를
            켠 상태에선 테이블로") — 한때 표 하나로 못 박았는데(그때의 셈: 이 버튼이
            여닫는 것은 사람이 아니라 그 사람들의 표다), 그러면 꺼져 있을 때도 표가 떠
            있어 손잡이가 제 상태를 안 말한다. 이제 얼굴이 곧 상태다:
              사람(Users) = 표가 안 떠 있다 · **사람+표**(RosterTableIcon) = 지표 다섯
              칸까지 떠 있다.
          ★ 켠 얼굴은 루시드의 Table이 아니라 **직접 그린 사람+표**다(요청: "사람+테이블
            로도 가능한가") — 이 판이 여닫는 것은 빈 표가 아니라 '그 사람들의 표'다.
            루시드에 그 뜻의 글리프가 없는 사정과, 12px에서 버티게 획을 짜는 방법은
            그 파일(RosterTableIcon) 머리에 적어 뒀다. */}
      {(
        <button
          type="button"
          /* 켠 표시는 **전체 꼴**에만 — 안 보임 꼴은 흐리게 해 '지금 아무것도 없다'를,
             이름만 꼴은 아무 표시 없이 그 사이를 말한다. */
          /* 켠 표시는 이름만(0)·전체(1) 둘 다(지적: "기본 로스터일 때 버튼 활성화 표시가 안 되는 문제") — 숨김(2)만 흐리다. */
          className={cx("scr-motion-litbtn scr-motion-mapbtn",
            rosterMode !== 2 && "is-on", rosterMode === 2 && "is-mute")}
          onClick={() => setRosterMode((v) => ((v + 1) % 3) as 0 | 1 | 2)}
          aria-label={rosterMode === 0 ? "로스터 현황 보이기"
            : rosterMode === 1 ? "로스터 숨기기" : "로스터 이름만 보이기"}
          title={rosterMode === 0 ? "로스터 — 이름만" : rosterMode === 1 ? "로스터 — 전체" : "로스터 — 숨김"}
        >
          {rosterMode === 1 ? <RosterTableIcon size={18} /> : <Users size={18} />}
        </button>
      )}
      {/* 미니맵 오버레이(요청) — 로스터와 같은 자리·같은 결의 여닫이다. 아이콘은 지도
          모양: 이 버튼이 여는 것이 '작은 지도' 그 자체다. 전체화면에만 둔다 — 일반 화면
          에서 미니맵은 지도 밖 독에 제 자리를 가져 지도를 안 가린다.
          ★ 한 번 걷었다가 **되돌렸다**(요청: "지도 토글 제거" → 정정: "미니맵 숨기기
            버튼은 있어야겠다 복구") — 미니맵이 조종부와 밑변을 맞춰 내려앉으며 덜 가리게
            됐지만 그 구석도 여전히 지도라, 걷어 보고 싶을 때가 있다. 아래 '도구 숨기기'는
            조작 손잡이만 걷으므로(로스터·미니맵은 남긴다) 겹치지 않는다 — 미니맵을 걷는
            길은 이 단추 하나뿐이다. */}
      {fsOn && (
        <button
          type="button"
          className={cx("scr-motion-litbtn scr-motion-mapbtn", fsMiniOn && "is-on")}
          onClick={() => setFsMiniOn((v) => !v)}
          aria-pressed={fsMiniOn}
          aria-label={fsMiniOn ? "미니맵 숨기기" : "미니맵 보이기"}
          title="미니맵"
        >
          <MapIcon size={18} />
        </button>
      )}
      {/* ★ 배속·각도·확대는 **지도 위에 값으로** 선다(요청: "배속/각도도 사이드패널이나
          오버레이에서 제거하고 맵 버튼로우로 옮겨서 상시 노출 · 버튼은 아이콘이 아닌
          실제 적용된 수치를 표현 · 확대축소도 버튼추가하고 배속이랑 안헷갈리게") ──────
          슬라이드 바는 판 안에 살아서 판을 열어야 보였고, 그래서 '지금 몇 배속인지'를
          알려면 판을 한 번 열어야 했다. 값을 버튼 얼굴에 그대로 적으면 누르지 않아도
          읽힌다 — 손잡이와 표시가 한 몸이 된다.
          ★ 셋을 가르는 것은 **작은 이름표**다(요청: 배속과 안 헷갈리게) — ×2 하나만
            적으면 배속인지 확대인지 알 수 없다. 위에 '배속·보기·확대'를 한 줄로 얹어
            두면 값이 같은 꼴(×2)이어도 서로 안 섞인다. */}
      <button
        type="button"
        /* 기본값이 아니면 켜진 꼴로(요청: "x1 1배 2D 가 기본값이고 다른 값이면 적용 css") —
           셋 다 같은 자다: 배속 ×1 · 확대 1배 · 보기 2D가 아무것도 안 건드린 상태이고,
           거기서 벗어난 값만 버튼이 밝아져 '지금 뭘 만져 뒀는지'가 줄에서 바로 읽힌다. */
        className={cx("scr-motion-litbtn scr-motion-mapbtn scr-motion-mapval", speed !== 1 && "is-on")}
        onClick={() => setSpeed((v) => {
          const i = SPEEDS.indexOf(v as typeof SPEEDS[number]);
          return SPEEDS[(i < 0 ? 0 : i + 1) % SPEEDS.length];
        })}
        aria-label={`배속 ${speed}배 — 누르면 다음 배속`}
        title="배속"
      >
        <span className="scr-motion-mapval-num">×{speed}</span>
      </button>
      {/* 확대는 **다른 손잡이와 값을 나눠 쓴다**(요청: "다른 수단으로 확대축소해도 값
          같이 연동되게") — 여기 적히는 것은 이 버튼이 기억하는 값이 아니라 화면의
          지금 배율(zoomLive)이라, 핀치·더블탭·휠·한 손 줌으로 바꿔도 그대로 따라온다.
          누르면 배율 사다리(ZOOM_STEPS)를 한 칸 올리고 맨 위에서는 1배로 돌아온다. */}
      <button
        type="button"
        className={cx("scr-motion-litbtn scr-motion-mapbtn scr-motion-mapval", zoomLive !== 1 && "is-on")}
        onClick={() => {
          /* 한 칸 위로, 맨 위에서는 1배로 돌아온다 — 사잇값에서도 **한 칸만** 오른다
             (위 zoomNext 주석: 3.8이면 4이지 8이 아니다). */
          zoomTo(zoomNext(zoomLive, true) ?? ZOOM_STEPS[0]);
        }}
        aria-label={`확대 ${zoomLive.toFixed(1)}배 — 누르면 다음 단계`}
        title="확대"
      >
        {/* 값끼리 서로 안 헷갈리게 **꼴을 달리 적는다**(이름표를 걷은 뒤의 몫) —
            배속은 앞에 ×(×2), 확대는 뒤에 배(4배), 보기는 2D/3D다. 세 토큰이 서로
            안 겹치므로 라벨 없이도 어느 값인지 읽힌다.
            핀치로 온 어중간한 값은 글자가 길어지므로(3.6배) 한 단 작게 적는다 —
            동그라미 안에 들어가야 한다. */}
        <span className={cx("scr-motion-mapval-num", zoomText.length >= 4 && "is-long")}>
          {zoomText}
        </span>
      </button>
      {/* ★ 색 전환(요청: "색 전환 아이콘버튼 추가 오버레이에선 제거" → "색전환 버튼은
          전체화면 아니어도 지도에 표시로 변경 기존 버툰부에서 제거") ────────────────
          개인색·팀색은 **지도를 보면서** 바꾸는 것이다 — 누가 누구 편인지 헷갈릴 때
          한 번 눌러 팀색으로 갈랐다가 도로 돌리는 식이라, 알약 두 개를 찾아 누르는
          도구 판보다 지도 위 한 번 누름이 맞다. 그래서 이 줄에서는 배치를 안 가린다:
          평소 배치에도 전체화면에도 늘 선다(도구 판·모바일 버튼 줄의 색상 알약은
          같은 요청으로 걷었다 — 한 가지 일에 손잡이는 하나다). */}
      {/* 밀리에는 안 단다(요청: "팀컬러 변경 비활성화") — 편이 없으니 팀색이라는 것도
          없다. 손잡이만 남기면 눌러도 아무 일이 없는 버튼이 된다. */}
      {!melee && (
        <button
          type="button"
          className={cx("scr-motion-litbtn scr-motion-mapbtn", colorMode === "team" && "is-on")}
          onClick={() => setColorMode((v) => (v === "team" ? "personal" : "team"))}
          aria-pressed={colorMode === "team"}
          aria-label={colorMode === "team" ? "개인색으로" : "팀색으로"}
          title={colorMode === "team" ? "팀색 (누르면 개인색)" : "개인색 (누르면 팀색)"}
        >
          <Palette size={18} />
        </button>
      )}
      <button
        type="button"
        className={cx("scr-motion-litbtn scr-motion-mapbtn scr-motion-mapval", pitched && "is-on")}
        onClick={() => {
          if (!pitchAllowed()) { pitchDenied(); return; }
          setPitchDeg((v) => (v === 90 ? PITCH_3D : 90));
        }}
        aria-pressed={pitched}
        aria-label={pitched ? "입체 보기 — 누르면 평면" : "평면 보기 — 누르면 입체"}
        title="보기"
      >
        <span className="scr-motion-mapval-num">{pitched ? "3D" : "2D"}</span>
      </button>
      {/* ★ 배경 음악(요청: "음악 on/off 아이콘 추가 · 전체화면 아이콘 왼쪽에") —
          아이콘은 하나고 **켜지면 밝아진다**(로스터·색 전환과 같은 결). 끈 꼴이 기본
          상태라 따로 표시하지 않는다 — 이 줄에서 밝은 것이 곧 '지금 켜 둔 것'이다.
          누르는 그 순간에 재생을 시작해야 브라우저가 허락한다(자동재생 규칙). */}
      <button
        type="button"
        className={cx("scr-motion-litbtn scr-motion-mapbtn", bgm.on && "is-on")}
        onClick={bgm.toggle}
        aria-pressed={bgm.on}
        aria-label={bgm.on ? "배경 음악 끄기" : "배경 음악 켜기"}
        title={bgm.on ? `음악 — ${bgm.now ?? "재생 중"} (누르면 끔)` : "음악 켜기"}
      >
        <Music size={18} />
      </button>
      <button
        type="button"
        className="scr-motion-litbtn scr-motion-mapbtn"
        onClick={() => (fsOn ? exitFs() : enterFs())}
        aria-label={fsOn ? "전체화면 나가기" : "전체화면"}
        title={fsOn ? "전체화면 나가기 (Alt+Enter)" : "전체화면 (Alt+Enter)"}
      >
        {fsOn ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
    </div>
  );
  /* ★ 건물마다 `buildsSrc` **전체를 세 번** 훑던 것을 한 번만 (실측: 건물본체 13.58ms,
     건물 322기 → 프레임마다 31만 번) ─────────────────────────────────────────────────
     셋 다 **시간과 무관**하다: `landedHere`(방금 날아와 앉았나)·`flownFrom`(어디서 날아
     왔나)·`FADE_SEC`(종족별 페이드)은 조건에 `t`가 한 번도 안 든다 — 곧 판이 정해지면
     끝까지 같은 답이다. 넷째(`razed`: 같은 자리에 후속 건물이 섰나)만 `s2 <= t`를 보는데,
     그것도 **후속이 선 가장 이른 시각** 하나만 미리 구해 두면 프레임마다 비교 한 번이다.
     자취가 그대로면 값도 그대로이므로 배열 정체를 열쇠로 삼아 캐싱한다(훅이 아니라서
     부르는 자리를 안 가린다). */
  /* ★ **화면 밖은 안 그린다**(계측: 프레임 40ms 중 우리 JS가 14ms, 나머지 26ms가
     리액트 조정·DOM·합성이다 — 노드 수가 곧 그 값이다) ────────────────────────────
     4배로 당겨 보면 지도의 1/16만 화면에 든다. 그런데 여태 개체 964기·건물 482기를
     **한 기도 빠짐없이** 만들어 DOM에 얹었다. 안 보이는 것을 빼면 JS도 줄지만 무엇보다
     **브라우저가 만질 노드**가 줄어, 지금 가장 큰 덩어리를 직접 친다.

     자리 판정은 화면에 놓을 때 쓰는 `posFrac`(눕힘·원근까지 든 그 함수) 그대로다 —
     그리는 자와 거르는 자가 같아야 어긋나지 않는다. 변환은 `translate(pan) scale(zoom)`
     이므로 분수 fx가 화면에 드는 구간은
         fx ∈ 0.5 + (∓무대폭/2 − pan.x) / (덮개폭 × 배율)
     이다. 여기에 **여유를 반 칸씩** 더 준다(span의 50%):
       · 큰 몸(캐리어·해처리)과 그 그림자는 중심이 밖이어도 몸이 걸친다.
       · 화면 밖 사수가 안쪽 표적에 쏘는 트레이서가 사라지면 안 된다.
     그래도 4배에서 그리는 몫이 1/4로 준다. 배율이 1.2 미만이면(거의 다 보인다)
     아무것도 안 거른다 — 이득이 없는데 위험만 지는 짓이다. */
  const pMap9 = PERF9 ? pNow() : 0;
  const mapNode = (
        <div
          /* ★ 준비될 때까지 판을 **안 보인다**(요청: "처음에 미니맵 전체 보였다가 모델들과
             안개가 뒤늦게 적용되는데 부자연스러워 — 로딩 완료되면 미니맵도 안개·모델과
             같이 뜨게") ────────────────────────────────────────────────────────────
             셋은 준비되는 때가 서로 다르다: 지도는 격자만 있으면 그 자리에서 그려지고,
             유닛은 자취를 받아야(1~2MB) 하고, 안개는 그 자취에서 셈해야 나온다. 그래서
             빈 지도가 먼저 뜬 뒤 모델과 안개가 차례로 얹히는 그림이 났다 — 없던 것이
             생겨나는 꼴이라 '아직 덜 됐다'가 아니라 '고장 났다'로 읽힌다.
             한 벌로 묶어 다 되면 함께 나타나게 한다. 그동안 무엇을 기다리는지는 가운데
             글줄(자취 받는 중·모델 굽는 중)이 말한다 — 그건 이 상자 밖이라 안 가려진다. */
          /* ★ 층 빼보기 깃발(`?hide=`)은 **여기** 붙는다(지적: "유닛 보였는데") ─────────
             여태 렌즈(.scr-motion-lens)에 붙어 있었다. 그런데 그 깃발이 겨누는 층들은
             렌즈의 **자식이 아니라 형제**다 — 안개·유닛 캔버스·지형 벡터는 전부 이 상자의
             직계 자식이고(CSS의 `.scr-motion-map > …` 전이 규칙이 그 증거다), 그것들이
             렌즈 밖으로 나간 데는 까닭이 있었다(렌즈의 CSS 확대에 실리면 그림이 뭉갠다).
             그래서 `.scr-hide-unit .scr-motion-unitlayer`가 **한 번도 안 걸렸다** — 층을
             뺐다고 믿고 잰 값들이 전부 '아무것도 안 뺀' 값이었다.
             자를 든 자리를 옮긴다. NOSHADOW9는 렌즈에 그대로 둔다 — 그쪽이 겨누는 것은
             렌즈 안의 DOM 마커 그림자라 자리가 맞다. */
          className={cx("scr-motion-map", pitched && "scr-motion-pitched",
            !tracksReady && "is-warming", baking9 && "is-baking") + HIDECLS9} ref={mapRef}
          /* (이동) 손짓 받는 자리 — **무대**로 올렸다(아래 stageNode의 onPointerDown
             주석). 손짓은 여기서 시작해도 거품처럼 올라가 무대가 받으므로 지도 위 동작은
             한 톨도 안 달라진다. */
          style={{
            /* 넓은 배치에서만 고정 크기다(요청: 1024 고정) — 좁은 화면은 폭 100%로 흐른다.
               보기(2D·3D)와 무관하다: 3D일 때만 상자를 넓히면 보기를 바꿀 때마다 세로가
               달라져 탐색바 아래가 통째로 밀린다(실측 285px). 3D의 눕힘은 상자가 아니라
               회전 전 판(pitchGeom의 hPre)이 맡는다. */
            /* 1024는 상한이다(요청: min(1024px, 100%)) — 고정만 두면 왼쪽 기둥(232)과
               댓글 기둥(232)에 간격까지 476px을 더한 값이 화면을 넘어, 대략 1560px보다
               좁은 화면에서 페이지에 가로 스크롤이 생겼다(실측: 1440에서 28px, 1280에서
               188px). 100%는 그리드 칸(minmax(0,1fr)) 폭이라 순환하지 않는다. */
            /* 오른쪽에 세로 바 기둥이 생기면서 줄이지는 몫이 필요해졌다(요청: PC 세로 바)
               — flex 0 0 auto는 한 톨도 안 줄어들어, 좁은 PC에서 바 폭(약 104px)만큼
               페이지에 가로 스크롤이 생긴다. 1024는 어차피 상한이므로 줄어드는 것은
               허용하고(0 1 auto) 가로세로비가 세로를 따라오게 둔다. */
            /* (걷어냄) 넓은 배치의 폭 상한 — 이제 **프레임**이 쥔다(아래 stageNode의
               style). 지도는 그 안에서 늘 덮게(cover) 깔리므로 제 폭을 스스로 정할
               일이 없다. 가로세로비만 남긴다 — 덮기가 0인(꼭 맞는) 프레임에서 높이를
               내는 것이 이 값이다. */
            aspectRatio: `${grid.width} / ${grid.height}`,
            /* ★ 확대·입체에서는 지도가 스스로 자르는데, **위쪽만은 여유만큼 열어 둔다**
               (요청) — overflow는 네 변을 한꺼번에 자르므로 clip-path로 바꾼다. 위 여유를
               음수 inset으로 주면 좌우·아래는 상자에서 자르고 위만 그만큼 더 그린다. */
            /* ★ 확대·입체에서는 지도가 스스로 자르는데, **위쪽만은 여유만큼 열어 둔다** —
               overflow는 네 변을 한꺼번에 자르므로 clip-path로 바꾼다. 위 여유를 음수
               inset으로 주면 좌우·아래는 상자에서 자르고 위만 그만큼 더 그린다.
               열어 두어도 창 밖이 안 비치는 까닭은 그리는 쪽이 발자리로 가르기 때문이다
               (UnitLayer의 inView0 주석) — 지도 그림 자체는 이 상자 안에만 있다. */
            /* ★ 확대·입체에서는 지도가 스스로 자르는데, **위쪽 여백만은 열어 둔다**
               (지적: "뭐지 공간은 있는데 그림은 안 그려지는데?") ────────────────────────
               맞다. 판에 여백은 났는데 정작 그 위를 이 상자가 잘라, 유닛 캔버스가 아무리
               제 몸을 늘려도(--scr-mapband) 여기서 잘려 나갔다 — 1배에서는 이 클립 자체가
               안 걸려 멀쩡했고 확대하는 순간 사라졌다.
               overflow는 네 변을 한꺼번에 자르므로 clip-path로 바꾼다: 위 여백만큼 음수
               inset을 주면 좌우·아래는 상자에서 자르고 위만 그만큼 더 그린다.
               열어도 **지도 그림은 안 샌다** — 지형 캔버스는 제 상자(.scr-motion-mapvec)가
               overflow:hidden으로 따로 자르고, 안개도 상자 크기 그대로다. 위로 나가는 것은
               유닛 캔버스 하나뿐이고, 그쪽은 발자리로 창 밖을 가른다(inView0 주석). */
            ...(zoom > 1 || pitched ? { overflow: "hidden" as const } : {}),
            ...(zoom > 1 || fsOn ? { cursor: dragRef.current ? "grabbing" : "grab" } : {}),
            /* 전체화면 — 지도를 화면보다 **크게**(cover) 깔고, 자르는 일은 무대에
               맡긴다(요청: "지도비율과 화면이 안맞으니 화면비율에 맞게끔 최대 크롭한
               부분이 비춰지며 드래그로 나머지 부분을 보는식"). 여기서 자르면(overflow
               hidden) 배율을 올렸을 때 상자 밖 내용이 창 안인데도 잘려 빈 자리가 난다. */
            /* 덮기(cover)는 **늘** 건다(요청: 일반/전체화면 통합) — 프레임의 가로세로비를
               지도와 같게 주므로 평소에는 덮는 몫이 0(꼭 맞음)이고, 화면비가 다른
               전체화면에서만 실제 크롭이 생긴다. 식 하나가 두 자리를 다 낸다. */
            ...(fsCoverW > 0 ? {
              position: "absolute" as const,
              /* 위 여유가 있으면 **아래에 붙인다** — 가운데로 두면 그 여유가 위아래로
                 반씩 갈려, 정작 필요한 위쪽에 절반밖에 안 남는다. */
              left: "50%",
              /* ★ 상자는 **창 한가운데**에 앉는다 — 2D·3D가 한 식이다(지적: "여전히 맵
                 세로가 무대를 넘치는 경우는 아예 여백 도화지가 안 보이는데? 2D에서") ─────
                 여기 있던 것은 `bottom: 0`, 곧 상자를 **무대** 바닥에 붙이는 것이었다.
                 상자 세로가 창(= 무대 − 띠)과 같던 시절에는 그게 곧 창 바닥이라 맞았는데,
                 덮기가 들어오면서 상자가 창보다 커졌다(fsCoverH > fitH9). 그러면 무대
                 바닥에 붙인 상자의 **한가운데**가 창 한가운데보다 위로 치우친다 —
                 실측(무대 325·띠 63·상자 358): 창 가운데 194, 상자 가운데 146으로 48px.
                 팬 한계는 상자 가운데를 기준으로 대칭이라(±48), 아무리 끌어도 그 치우친
                 48을 못 메운다. 그래서 내용의 윗변이 띠 아래까지 **영영 못 내려왔다** —
                 맨 위로 끌어도 하늘이 안 보이던 것이 그것이다.
                 창 가운데에 앉히면 그 어긋남이 0이 되고, 상자와 창이 같은 크기인 옛
                 경우(fsCoverH = fitH9)에는 이 식이 그대로 `bottom: 0`이 된다.
                 3D도 같은 식이면 된다 — 회전이 그림을 상자 안 가운데로 눌러 놓으므로
                 상자 가운데가 곧 그림 가운데다. */
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: `${fsCoverW}px`, flex: "0 0 auto", minWidth: 0,
              overflow: "visible" as const, borderRadius: 0,
              /* 유닛 캔버스가 이 값을 읽어 제 몸을 위로 늘린다(.scr-motion-unitlayer).
                 늘림은 **배율과 무관하게 늘 켠다**(지적: "1배 아니어도 맨 윗줄의 유닛은
                 추가 그림 영역에 다 그려 줘야 해"). 창 밖을 안 그리는 일은 여기서 접는
                 것이 아니라 그리는 쪽이 발자리로 가른다(UnitLayer의 inView0 주석). */
            } : {}),
            /* 손짓 격리(지적 둘: 맵 조정 시 모달이 딸려 움직임 + 2D 모드에서 드래그가
               모달로 전파) — 맵 위 손짓은 확대 여부와 무관하게 브라우저에 안 넘긴다.
               확대 전 세로 스크롤만 열어 두던 pan-y가 2D에서 모달을 끌었다. 모달 훑기는
               맵 밖(로스터·댓글)에서 하면 된다. */
            touchAction: "none",
          }}
        >
            {/* 전체화면 버튼(요청) — 네 귀퉁이 꺾쇠(변 중간이 끊어진 사각형) 아이콘이다.
              지도 오른쪽 위 구석에 반투명으로 뜬다. 지도의 팬·줌 손짓에 안 딸리게
              눌림을 끊는다. 전체화면 안에서는 오버레이가 나가기 버튼을 맡는다.
              ★ 넓은 배치에만 선다(요청: "전체화면 온오프 버튼을 여기로 이동") — 좁은
                배치에서는 아래 색상·성능 줄의 여닫이 버튼이 그 몫이라, 지도 구석에
                또 두면 같은 일을 하는 버튼이 둘이다. */}
          {/* (이동) 전체화면 버튼 — 지도 **밖** 오른쪽 아래로 옮겼다(요청: "전체화면
              버튼 맵 밖 오른쪽 하단"). 지도 위에 얹혀 있으면 어느 자리에 두든 그 자리의
              지형·유닛을 가리고, 확대하면 상자가 잘라 낸다(overflow). 이제 오른쪽
              기둥(2팀 로스터·각도 바와 같은 칸) 맨 아래에 선다. */}
        {/* 받는 중 — 자취는 눌러도 한 판에 1~2MB라 잠깐 걸린다. 다 온 뒤에는 안 뜬다. */}
          {!simTracks && entLoad === "loading" && (
            <span className="scr-motion-simnote">자취 받는 중…</span>
          )}
          {/* 모델 굽기 진행(요청: 들어올 때 다 굽고 시작) — 굽는 동안 시간은 멈춰 있다. */}
          {warmAt && (
            <span className="scr-motion-simnote scr-motion-warmnote">
              모델 굽는 중… {Math.min(99, Math.round((warmAt.done / warmAt.total) * 100))}%
            </span>
          )}
          {/* 재생 중 굽기 몰림 — 시간바를 크게 옮기거나 새 기지를 끌어 들어왔을 때다.
              진행률이 없다(몇 장이 남았는지는 그릴 때가 되어야 안다) — 대신 '멈춰서
              굽고 있다'는 사실만 알린다. 한두 프레임짜리 멈춤에는 안 뜬다(250ms). */}
          {!warmAt && bakeHold && (
            <span className="scr-motion-simnote scr-motion-warmnote">모델 굽는 중…</span>
          )}
          {/* 재생 품질(위 QUALITY9) — 진입·벤치 변경 때 오른쪽 위에 3초. */}
          {qualityNote && (
            <span className="scr-motion-qualitynote">재생품질: {qualityNote}</span>
          )}
          {/* (걷어냄·요청: "미니맵 연결해주세요는 이제 없애야해") — "미연결 상태에선
             유닛이 벽을 뚫고 다녀요"라는 한 줄이 여기 있었다. 그 말은 지형(벽)을 미니맵
             그림에서 어림하던 시절의 것이다: 그림이 없으면 벽도 없었다.
             지금은 지형이 **맵 데이터에서 참값으로** 온다(replay_maps.terrain) — 그림을
             연결하든 말든 유닛은 벽을 안 뚫는다. 남겨 두면 틀린 말이 된다.
             ⚠ JSX 자식 자리의 주석은 {}로 감싸야 한다 — 맨 주석은 **글자 그대로 화면에
             찍힌다**(지적: "뭔데 주석이 보이지" — 지도 위에 이 문단이 통째로 떠 있었다). */}
          {/* ★ 지도 벡터층은 **렌즈 밖**이다(지적: "전체화면 모드를 실행하면 모델들이
              선명해져 맵은 안선명해져" — 그리고 #diag가 타일당 100%·배킹확보 성공을
              찍어 줬다) ─────────────────────────────────────────────────────────────
              배킹은 옳게 구워지는데 화면만 흐렸다면 **합성이 그 해상도를 버린 것**이다.
              렌즈는 scale(z)를 쓰고, 웹킷은 변환이 걸린 가지를 1배로 한 번 래스터해 두고
              z배로 늘려 붙인다. 같은 화면의 유닛 캔버스가 또렷했던 것이 대조군이다 —
              그쪽은 진작 이 이유로 렌즈 밖으로 나갔다(그쪽 주석: "렌즈의 CSS 확대에
              태우면 … 이제 렌즈 밖에서 줌·팬을 그리기 좌표에 직접 입힌다").
              지도도 같은 길로 보낸다. 렌즈가 해 주던 '분수 자리 → 화면 자리'는 벡터층이
              픽셀로 직접 셈한다(그쪽 place()). 렌즈보다 **앞**에 두어 밑에 깔린다.
              입체(각도)일 때만 예외로 컨테이너가 변환을 지므로, 렌즈 몫(translate·scale)을
              여기서 앞에 붙여 넘긴다 — 조상이 하던 일을 그대로 이어받는 순서다. */}
          {grid.terrain && (
            <ReplayMapVector
              grid={grid} zoom={zoom} pan={pan} pitched={pitched} painter={mapPaintRef}
              tileFrac={mapFracRef} pitchSig={pitched ? pitchTiltDeg.toFixed(1) : ""}
              /* 입체의 줄별 화면 배율(재지적: "3D에서 지도 선명하지 않은 문제 아직 있음") — 지도 층이 굽는 창의 맨 앞줄
                 값을 읽어 그 창이 실제로 요구하는 해상도를 낸다(그쪽 pmag9 주석). */
              pitchKAt={pitched ? pitchK : undefined}
              /* 입체 변환은 **함수로** 넘긴다(재지적: 3D 드래그에서 지도가 안 따라옴) —
                 문자열로 박아 넘기면 그 값이 커밋된 pan·zoom으로 굳어, 손짓 중에는
                 지도가 멈춰 있고 놓는 순간 튄다(그쪽 pitchXf 주석). */
              pitchXf={pitched ? ((z9, p9) => {
                /* 시점 원점(drawnGeom9의 ox·oy — 그리는 장의 눈)을 낀 변환: 원점을 가운데로 옮겨 기울이고 원근을 먹인 뒤
                   (ox, C·oy)로 되돌린다. 메인·엔진 posFrac의 식과 같은 자리다(그쪽 주석). ox=oy=0이면 옛 문자열과 같다. */
                const { q, cy, P, C, ox, oy } = drawnGeom9();
                const org9 = ox !== 0 || oy !== 0
                  ? ` translate(${ox.toFixed(1)}px, ${(C * oy).toFixed(1)}px) perspective(${P.toFixed(0)}px) rotateX(${pitchTiltDeg.toFixed(2)}deg) translate(${(-ox).toFixed(1)}px, ${(-oy).toFixed(1)}px)`
                  : ` perspective(${P.toFixed(0)}px) rotateX(${pitchTiltDeg.toFixed(2)}deg)`;
                return `translate(${p9.x.toFixed(1)}px, ${p9.y.toFixed(1)}px) scale(${z9}) translateY(${(-cy).toFixed(1)}px) scale(${q.toFixed(4)})${org9}`;
              }) : undefined}
            />
          )}
          {/* 렌즈 상자 — PC 휠 줌(요청)이 이 층을 통째로 키운다(마커·자취까지 같이). */}
          <div
            ref={lensRef}
            className={`scr-motion-lens${NOSHADOW9 ? " scr-motion-noshadow" : ""}`}
            style={{
              /* 줌 역배율 변수(지적: 클릭 마커·링은 UI라 확대에 굵어지면 안 됨) —
                 UI성 마커가 scale(1/--mz)로 제 화면 크기를 지킨다. */
              "--mz": zoom,
              /* transform은 여기서 안 쓴다(수리: 휠 확대가 한 번만 먹는다) — 재생 중엔
                 매 프레임 리렌더가 나서, 상태에서 나온 변환이 휠이 방금 쓴 변환을 계속
                 되돌렸다. 아래 lensZoom effect가 상태가 바뀔 때만 써 준다. */
            } as React.CSSProperties}
          >
          {/* 지도 배경은 **참값 지형 하나**다(요청: 참값 맵과 지형정보만 사용).
              벡터층이 그 배율로 그때그때 다시 그리므로 확대해도 안 뭉개진다.

              (걷음) 없을 때 깔던 두 갈래 — 사람이 올린 미니맵 그림과, 그림이 없을 때
              리플레이 타일 격자로 그리던 초록 개략도다. 둘 다 참값 지형이 없던 시절의
              대역이고, 대역을 남겨 두면 어느 판이 참값이고 어느 판이 어림인지 화면에서
              구분되지 않는다. 아직 안 구운 맵은 지도 없이 그린다 — 아바타·화살표는 좌표를
              비율로 얹으므로 바탕이 없어도 제자리에 놓인다(재분석이 지형을 채운다). */}
          {/* 건물(요청: 합치기 대신) — 기본은 작은 이름이 늘 떠 있되, 가까이 겹치는 같은
              이름은 하나만 적고 나머지는 점(지적: 겹치면 안 보인다). 긴 이름은 폰트를 한
              단계 줄인다. 생산·연구 중이면 심장처럼 뛴다(요청). */}


          {/* 채굴 일꾼(요청, 지적: 방향 반대) — 자원 지대마다, 그 시점에 서 있는 가장
              가까운 본진 건물(시작 본진·확장 포함)을 찾아 그리로 오간다. 가까운 홀이 없는
              자원(아직 안 편 멀티)은 비워 둔다. */}
          {/* 자원 지물(요청: 미네랄·가스 모델링해서 맵에 배치) — 지대마다 가스 깃발이면
              간헐천, 아니면 미네랄 결정 무더기. 팀색과 무관한 고정 색이다.
              차례는 건물·유닛과 **같은 층에서 자리 순**이다(아래 z 주석) — 예전처럼
              통째로 아래 층에 깔면 뒤에 선 건물도 앞 자원을 덮는다. */}
          {/* 스파이더 마인(요청) — 안 터졌으면 모델, 터지는 1.2초는 폭발 스팬. */}
          {/* 저그 크립(요청) — 살아 있는 저그 건물마다 발밑에 보라 크립 블롭을 깐다.
              불투명 단색이라 이웃 크립과 겹치며 이음매 없이 한 덩어리로 이어지고,
              건물이 없어지면 페이드와 함께 곧 걷힌다(지적). 층은 자원(900)보다 아래. */}
          {/* 착지 충격파(요청: "내리면서 충격파 표현정도 더해주면 될듯") — 날아온 건물이
              땅에 닿는 순간, 발자국 둘레로 먼지 고리가 한 번 퍼졌다 잦아든다. 이사 두 줄의
              넘겨주기가 페이드 없이 딱 끊기므로(위 landedAway), 그 이음매를 이 한 박자가
              메운다: 바뀐 것이 '사라지고 나타남'이 아니라 '내려앉음'으로 읽힌다.
              앉은 자리 줄(landedHere)이 제 시작 시각에 그린다 — 날아온 것만이라, 새로 지은
              건물은 여기 안 걸린다. */}
          {/* 건물 소멸 효과(요청: 종족별) — 무너진 순간 2초: 테란 주황 폭발+회색 연기,
              저그 보라 살점 퍼짐, 프로토스 파란 빛 붕괴. 이륙 이사·같은 계보 대체(진화·
              재건)는 폭발이 아니라 제외한다. */}
          {/* (걷어냄) 채굴 일꾼 점 층 — 일꾼 '수'로 자원 곁에 점을 찍던 v1 장식 어림이다.
              실제 조작과 무관하게 그려져, 가스를 안 지었는데도 캐러 다니곤 했다(지적).
              개체 트랙에서는 실제 일꾼 개체가 제 클릭을 따라 움직이므로 어림이 필요 없다. */}
          {/* 개체 트랙 v2(요청: 태그 단위 분석을 별도 테이블에 담아 비교) — 태그 하나가
              곧 마커 하나다. 부대 어림의 묶음·흡수·합류 규칙이 전혀 없이, 각 개체가 제
              증거를 따라 걷고 제 죽음(d)에 종족 효과와 함께 걷힌다. 유닛 층만 바꿔 그리고
              건물·자원·크립·마법은 v1 그대로다. 정체를 모르는 개체는 그 종족의 기본 보병
              꼴을 반투명으로 — 아는 척은 안 하되 존재는 보인다. */}


          {/* 마법 — 떨어진 자리에 이름이 잠깐 떠오른다. 핵만은 이름에 폭발 파문까지
              얹는다(요청: "핵 떨어지는거도 효과") — 경기 하나에 몇 번 없는, 그 판의 가장
              큰 사건이라 다른 마법과 같은 글자 한 줄로는 안 보였다. */}
          {/* (옮김) 클릭 자국·미니맵 핑 → 아래 효과 렌즈(.scr-motion-fxlens). 지적: 크립 위·안개 지역에서 안 보임 —
              이 렌즈는 transform으로 제 쌓임 맥락을 만들어 안의 z가 유닛 캔버스(6000)·안개(5500)와 못 겨룬다. */}


          </div>
          {/* 유닛 캔버스 층(요청: 캔버스 전환 — 성능, 지적: 확대가 선명해야) — 렌즈 밖에
              둔다: CSS 확대에 태우지 않고 줌·팬을 그리기 좌표에 직접 입혀, 어느 배율에서도
              화면 해상도 그대로 또렷하다. unitOps는 렌즈 안 마커 계산부가 이 렌더에서
              채우고, 커밋 뒤 effect가 그린다. */}
          {/* 정보 팝업(요청) — 그린 op 목록을 붙들어 둬 클릭 판정이 훑는다. UnitLayer가
              겹침 이완으로 fx를 손보므로, 판정도 '그려진 자리'와 같은 값을 본다. */}
          {/* 가스 건물 창에 불 켜기(요청) — 걷기 루프가 다 돈 지금에야 "안에 일꾼이
              있나"의 답이 있다(gasBusy). 건물 op는 그 앞에서 밀렸으므로 여기서 표를
              찍는다: 판 열쇠에 실려 어두운 컷·불 켠 컷이 따로 캐시된다. */}
          {((): null => {
            opsRef.current = unitOps;
            miniExtraRef.current = frame9.miniExtra;
            return null;
          })()}
          {(() => {
            if (!picked) return null;
            const op = unitOps.find((o) => o.pickKey === picked);
            // 죽거나 무너져 이번 프레임에 없으면 팝업도 닫힌 것처럼 사라진다.
            if (!op) return null;
            const en = op.pickName ?? "";
            const ko = op.pickBld ? BUILDING_KO[en] ?? en : UNIT_KO[en] ?? en;
            const max = op.hpMax ?? 0;
            const cur = Math.max(0, Math.round((op.hpFrac ?? 1) * max));
            const sh = op.pickBld ? (BLD_STATS[en]?.[1] ?? 0) : (UNIT_STATS[en]?.sh ?? 0);
            const lines: React.ReactNode[] = [];
            /* 진행 바(요청: 스타 원작처럼 칸 수를 따라) — 원작 진행 바는 통짜가 아니라
               칸이 하나씩 차오른다. 열 칸으로 나눠 채운 만큼만 밝힌다. */
            const bar = (label: string, p9: number, col = "#6fe36f"): React.ReactNode => (
              <div className="scr-motion-info-prog" key={`${label}${p9.toFixed(2)}`}>
                <span className="scr-motion-info-line">{label}</span>
                <span className="scr-motion-info-bar">
                  {Array.from({ length: 10 }, (_, k) => (
                    <i
                      key={k}
                      className={k < Math.round(p9 * 10) ? "is-on" : undefined}
                      style={k < Math.round(p9 * 10) ? { background: col } : undefined}
                    />
                  ))}
                </span>
              </div>
            );
            /* 걸린 마법은 제 줄에 효과까지(요청) — 무엇에 걸렸는지보다 '그래서 어떻게
               되는가'가 읽는 사람이 알고 싶은 것이다. */
            if (op.pickStatus && STATUS_FX[op.pickStatus]) {
              const sfx = STATUS_FX[op.pickStatus];
              lines.push(
                <div className="scr-motion-info-line" key="fx" style={{ color: sfx.col }}>
                  {`${STATUS_KO[op.pickStatus] ?? op.pickStatus} — ${sfx.fx}`}
                </div>,
              );
            }
            if (op.pickState) {
              // 건설·변태도 글 대신 칸 바로(요청).
              const m9 = /(\d+)%$/.exec(op.pickState);
              if (m9) lines.push(bar(op.pickState.replace(/\s*\d+%$/, ""), Number(m9[1]) / 100));
              else lines.push(op.pickState);
            }
            /* 실드는 따로 한 줄(요청) — 원작은 실드부터 깎이므로, 남은 값이 체력 몫을
               넘으면 그 초과분이 곧 남은 실드다. */
            /* 체력·실드도 원작 색을 따른다(요청: 실드 흰색·체력 연녹색 등 게임 테마를
               충실히) — 원작 체력 바는 가득하면 연녹, 절반 아래로 노랑, 3분의 1 아래로
               빨강이다. 실드는 그 위에 흰(옅은 하늘) 칸으로 얹힌다. */
            const hpOnly = Math.max(1, max - sh);
            const hpCur = Math.min(cur, hpOnly);
            const hpR = hpCur / hpOnly;
            /* 체력·실드는 **숫자만**(요청: "인포팝업의 체력바 제거 숫자만 표시") — 열 칸 바는
               걷고 글자만 남긴다. 색은 원작 체력 바의 세 단(연녹·노랑·빨강)을 글자에 그대로 입혀
               위험한 정도는 여전히 한눈에 읽힌다. 진행 바(건설·연구·생산)는 그대로다. */
            lines.push(
              <div className="scr-motion-info-line" key="hp"
                style={{ color: hpR > 0.5 ? "#7ee07e" : hpR > 0.33 ? "#e8d94a" : "#e05a4a" }}>
                {`체력 ${hpCur} / ${hpOnly}`}
              </div>,
            );
            if (sh > 0) {
              const shCur = Math.max(0, cur - hpOnly);
              lines.push(<div className="scr-motion-info-line" key="sh" style={{ color: "#f2f6ff" }}>{`실드 ${shCur} / ${sh}`}</div>);
            }
            if (op.pickBld && op.pickWip) {
              /* 짓는 중인 건물은 아무 일도 못 한다(요청: "건설중 건물에 생산중이나 큐가
                 있으면 안돼 / 업그레이드 진행도 물론") — 원작에서 미완성 건물은 아직
                 명령을 받지 않는다. 여태 이 갈래가 없어서, 착공 자리 언저리에서 나온
                 옛 생산 기록이 짓는 중인 새 건물에도 그대로 붙어 '생산 중'·'큐'가 떴다.
                 상태 줄(건설 중 NN%)과 체력만 남기고 여기서 끝낸다. */
            } else if (op.pickBld) {
              /* 생산·연구·큐(요청) — 생산 기록은 '완성 시각'이라, 지금 창 안이면 방금
                 나온 것, 앞엣것은 큐로 읽는다(무엇이 언제 나오는지가 그대로 큐다). */
              /* 이 건물에서 나온 것만(지적: 라바 변태 기록이 해처리끼리 공유된다) —
                 출생 자리가 이 발자국 언저리인 것만 센다. 건물 태그를 아는 생산은 발자국
                 원점에, 라바처럼 모르는 생산은 발자국 아래 출구에 꽂히므로 두 규약을 다
                 담게 아래로 한 뼘 더 넓힌다. 자리를 모르는 옛 자취(출생 증거가 없는 것)는
                 사람별 표로 물러난다 — 안 그러면 팝업이 통째로 비어 버린다. */
              const fp9 = FOOTPRINT[en] ?? [4, 3];
              const bx9 = op.pickX;
              const by9 = op.pickY;
              /* 낳은 자리가 **누구 것인가**(지적: "인포팝업에 다른 건물의 생산이 공유돼서
                 생산바가 여러개 나옴") — 여태 '내 발자국 ±1.5타일 창 안'이면 다 내 것으로
                 셌다. 배럭 둘이 나란히 서면 두 창이 3타일이나 겹쳐, 옆 건물이 뽑은 것이
                 양쪽 팝업에 함께 떴다. 창은 그대로 두되(자리가 정확히 안 남는 생산이
                 있다) 겹치는 자리는 **더 가까운 건물이 가져간다** — 같은 사람의, 그때
                 서 있던, 그 유닛을 뽑을 수 있는 건물들끼리만 견준다. */
              const nearer9 = (rx: number, ry: number, u: string): boolean => {
                if (bx9 === undefined || by9 === undefined) return true;
                const myD = Math.hypot(rx - (bx9 + fp9[0] / 2), ry - (by9 + fp9[1] / 2));
                for (const [os9, ox9, oy9, ou9, or9, og9] of buildsSrc) {
                  if (or9 !== op.pickRaw) continue;
                  if (ox9 === bx9 && oy9 === by9) continue;           // 나 자신
                  if (os9 > t || ((og9 ?? 0) > 0 && t >= (og9 ?? 0))) continue;
                  if (!(PRODUCED_BY[ou9] ?? []).includes(u)) continue;
                  const of9 = FOOTPRINT[ou9] ?? [4, 3];
                  const d9 = Math.hypot(rx - (ox9 + of9[0] / 2), ry - (oy9 + of9[1] / 2));
                  if (d9 < myD - 0.01) return false;                  // 더 가까운 임자가 있다
                }
                return true;
              };
              const mine9 = bx9 === undefined || by9 === undefined ? null
                : (prodDoneAt.get(op.pickRaw ?? "") ?? []).filter((r9) =>
                  r9.x >= bx9 - 1.5 && r9.x <= bx9 + fp9[0] + 1.5
                  && r9.y >= by9 - 1.5 && r9.y <= by9 + fp9[1] + 2
                  && nearer9(r9.x, r9.y, r9.u));
              const evs: [number, string, number][] = [];
              const kinds9 = new Set(PRODUCED_BY[en] ?? []);
              if (mine9 && mine9.length > 0) {
                for (const r9 of mine9) {
                  if (!kinds9.has(r9.u)) continue;
                  evs.push([r9.s, UNIT_KO[r9.u] ?? r9.u, UNIT_BUILD_SEC[r9.u] ?? 30]);
                }
              } else {
                for (const u of PRODUCED_BY[en] ?? []) {
                  const sec = UNIT_BUILD_SEC[u] ?? 30;
                  for (const ps of prodDoneByRaw.get(op.pickRaw ?? "")?.[u] ?? []) evs.push([ps, UNIT_KO[u] ?? u, sec]);
                }
              }
              evs.sort((a, b) => a[0] - b[0]);
              /* 진행률(요청) — 리플레이에 남는 건 완성 시각뿐이라, 거기서 생산 시간을
                 빼 시작을 되짚는다. 지금이 그 사이면 '생산 중 NN%'다. */
              /* 건물은 한 번에 **하나만** 뽑는다(지적: 생산바가 여러 개) — 자리로 가른
                 뒤에도 자리를 모르는 옛 생산이 사람별 표에서 흘러들 수 있고, 그때는
                 같은 창에 여럿이 걸린다. 가장 먼저 나올 것 하나만 바로 세우고 나머지는
                 아래 큐 칸으로 내려보낸다 — 원작 생산 패널이 그 꼴이다. */
              const making = evs
                .filter(([ps, , sec]) => t < ps && t >= ps - sec)
                .sort((a, b) => a[0] - b[0])
                .slice(0, 1);
              /* ★ 큐는 **지금 뽑는 것에 이어지는 것들**뿐이다(지적: "인포팝업 큐 넘어감
                 구현이 안돼있는듯") ────────────────────────────────────────────────
                 여태는 '아직 시작 안 한 것' 전부에서 앞 넷을 잘랐다. 그러면 몇 분 뒤에
                 나올 유닛까지 늘 네 칸을 채우고 앉아 있어, 앞의 것이 완성돼도 칸이 그대로
                 남는다 — 그래서 '안 넘어간다'로 보였다.
                 원작의 큐는 **줄줄이 이어 뽑는 것들**이다: 앞의 것이 나오는 순간 다음
                 것이 시작한다. 그러니 앞 것의 완성 시각과 다음 것의 시작 시각이 맞물리는
                 동안만 한 줄이고, 사이가 뜨면 거기서 끊는다(그 뒤는 그때 가서 누른
                 것이지 지금 줄 서 있는 것이 아니다). 이러면 앞의 것이 완성될 때마다
                 칸이 하나씩 앞으로 당겨진다. */
              const chain9 = [...evs].sort((a, b) => a[0] - b[0]);
              const queue: [number, string, number][] = [];
              {
                const headEnd9 = making.length > 0 ? making[0][0] : t;
                let prevEnd9 = headEnd9;
                for (const ev9 of chain9) {
                  if (ev9[0] <= headEnd9) continue;              // 이미 나왔거나 지금 뽑는 것
                  if (ev9[0] - ev9[2] > prevEnd9 + 1.5) break;   // 사이가 뜨면 줄이 아니다
                  queue.push(ev9);
                  prevEnd9 = ev9[0];
                  if (queue.length >= 4) break;
                }
              }
              const justOut = evs.filter(([ps]) => ps <= t && t - ps <= PROD_FLASH_SEC);
              /* ★ 유닛을 못 뽑는 건물에는 생산 줄을 아예 안 쓴다(지적: "업글건물에
                 생산대기가 뜸") — 엔지니어링 베이·포지·에볼루션 챔버 같은 연구 전용
                 건물은 PRODUCED_BY에 아무것도 없어서, 위 evs가 늘 비고 그래서 '생산
                 대기'만 떴다. 그 건물은 애초에 뽑을 것이 없으니 대기랄 것도 없다 —
                 아래 '연구 중'이 뜨거나, 아무 일도 안 하면 아무 줄도 안 뜬다. */
              if ((PRODUCED_BY[en] ?? []).length > 0) {
                if (making.length > 0) {
                  for (const [ps, n, sec] of making) {
                    lines.push(bar(`생산 중 ${n}`, Math.min(0.99, (t - (ps - sec)) / sec)));
                  }
                } else if (justOut.length > 0) {
                  lines.push(`생산 완료 ${justOut.map(([, n]) => n).join(" · ")}`);
                } else lines.push("생산 대기");
              }
              /* 큐는 **바가 없고 칸이 옆으로 늘어선다**(요청: "큐 목록은 바가 없어야되고
                 4칸인가 큐된 목록이 옆으로 쭉 나오면 돼") — 원작 생산 패널이 그렇다:
                 지금 뽑는 것 하나만 진행 바를 갖고, 뒤에 선 것들은 칸에 담겨 옆으로
                 늘어선다. 남은 초는 안 적는다 — 좁은 칸에 숫자까지 넣으면 이름이 잘린다. */
              if (queue.length > 0) {
                lines.push(
                  <div className="scr-motion-info-queue" key="queue">
                    <span className="scr-motion-info-line">큐</span>
                    <span className="scr-motion-info-slots">
                      {queue.map(([ps, n], qi) => <i key={`${ps}${qi}`}>{n}</i>)}
                    </span>
                  </div>,
                );
              }
              /* ★ 연구 중 — 표는 **연구 이름 → 그 연구를 하는 건물**인데 여태 건물
                 이름으로 뒤지고 있었다(RESEARCH_BUILDING["Engineering Bay"]는 없다).
                 그래서 이 줄은 어느 건물에서도 한 번도 안 떴다 — 업그레이드 건물이
                 '생산 대기'만 달고 서 있던 나머지 절반이다.
                 라바 계보(해처리·레어·하이브)는 세 이름이 같은 연구를 하므로 홀 이름
                 하나로 모아서 견준다.
                 ★ **대표 건물에만 적는다**(지적: "업그레이드 상황이 같은 종류의 건물
                   인포팝업에 공통으로 뜨는 현상") — 견주는 자가 임자와 종류뿐이라, 포지가
                   셋이면 셋 다 같은 연구를 띄웠다. 연구 기록(ups)에 건물이 안 남으므로
                   어느 포지인지는 원리적으로 모른다: 아는 척하는 대신 하나만 고른다.
                   태그가 실려 오면(덤프 판 7) 그 건물 하나만, 안 실려 오면 지도와 같은
                   대표 어림으로 — 어느 쪽이든 **불이 든 건물과 연구가 적히는 건물이 같다**.
                   여태는 불은 하나인데 팝업은 전부라 서로 다른 말을 하고 있었다.
                 ★ 창의 **방향도 바로잡는다**(같은 결의 어긋남) — 지도는 진작 [us−90, us]로
                   뒤집었는데(그쪽 주석: us는 연구가 **끝난** 시각이다) 팝업만 옛 [us, us+90]
                   그대로였다. 그래서 팝업은 연구가 끝난 **뒤** 90초 동안 '연구 중'이라고
                   적었다 — 정확히 한 연구 길이만큼 늦은 말이다. 진행률도 함께 뒤집는다:
                   남은 시간(us − t)이 줄수록 차오른다. */
              const hall9 = en === "Lair" || en === "Hive" ? "Hatchery" : en;
              const doing = (upsByRaw.get(op.pickRaw ?? "") ?? []).filter(([us, n, utag]) =>
                RESEARCH_BUILDING[n] === hall9 && t < us && us - t <= RESEARCH_SEC
                && (utag > 0 && op.pickTag !== undefined
                  ? utag === op.pickTag : op.pickRep !== false));
              for (const [us, n] of doing) {
                lines.push(bar(`연구 중 ${researchKo(n)}`,
                  Math.min(0.99, (RESEARCH_SEC - (us - t)) / RESEARCH_SEC)));
              }
            } else {
              /* 그 유닛에 실제로 걸리는 공/방 줄만 레벨로 보여 준다(요청: 인게임보다
                 풍부하게 — 해당 유닛의 업그레이드 상태). 줄 고르기는 종족과 공중 여부,
                 테란만 보병/메카닉 갈래를 더 본다. */
              const race9 = bases.find((b) => b.key === op.pickRaw)?.race ?? "";
              const pairs = ARMOR_WEAPON_PAIRS[race9] ?? [];
              const air9 = isAirUnit(en);
              const infantry9 = new Set(["Marine", "Firebat", "Medic", "Ghost", "SCV"]);
              const melee9 = new Set(["Zergling", "Ultralisk", "Broodling", "Drone"]);
              const pick9 = pairs.find((pr) => {
                const w = pr.weapon;
                if (race9 === "테란") {
                  return air9 ? w === "Terran Ship Weapons"
                    : infantry9.has(en) ? w === "Terran Infantry Weapons" : w === "Terran Vehicle Weapons";
                }
                if (race9 === "저그") {
                  return air9 ? w === "Zerg Flyer Attacks"
                    : melee9.has(en) ? w === "Zerg Melee Attacks" : w === "Zerg Missile Attacks";
                }
                return air9 ? w === "Protoss Air Weapons" : w === "Protoss Ground Weapons";
              });
              const lv = (name: string): number =>
                (upsByRaw.get(op.pickRaw ?? "") ?? []).filter(([us, n]) => n === name && us <= t).length;
              /* 공방실속사(요청: "공방실드속업사업은 이름 말고 이해하기 쉽게 공방실속사로")
                 — 이름을 늘어놓으면 좁은 팝업에서 두세 줄이 되고, 정작 궁금한 '몇 단계인가'
                 는 이름 뒤에 숨는다. 한 글자 + 숫자로 접으면 한 줄에 다 든다:
                   공2 방1  … 그 유닛에 걸리는 공/방 줄의 단계
                   실2      … 프로토스만(실드는 종족 전체에 걸린다)
                   속 사    … 속업·사업은 단계가 없으므로 글자만 켠다
                 어느 줄(보병/메카닉/저글링/히드라…)인지는 팝업 제목이 곧 그 유닛이라
                 말할 필요가 없다(줄 이름표 UPGRADE_LINE_KO는 통계 화면 쪽에 남는다). */
              const upBits: string[] = [];
              if (pick9) upBits.push(`공${lv(pick9.weapon)}`, `방${lv(pick9.armor)}`);
              if (race9 === "프로토스") upBits.push(`실${lv(PLASMA_SHIELD_UPGRADE)}`);
              /* ★ 그 유닛에 **실제로 걸리는** 연구만(지적: "유닛 인포팝업에 다른 유닛의
                 업그레이드까지 뜸") — 여태는 임자가 마친 것 중 공/방이 아닌 것을 전부
                 늘어놓아, 마린을 눌러도 저글링 속업이 떴다. 이제 연구마다 걸리는 유닛을
                 적은 표(UPGRADE_UNITS)로 거른다. 표에 없는 이름은 안 띄운다 — 모르면
                 지어내지 않는다. 공/방은 위 줄이 단계까지 따로 말한다. */
              const other = (upsByRaw.get(op.pickRaw ?? "") ?? []).filter(([us, n]) =>
                us <= t
                && n !== PLASMA_SHIELD_UPGRADE
                && !pairs.some((pr) => pr.weapon === n || pr.armor === n)
                && (UPGRADE_UNITS[n] ?? []).includes(en));
              /* 속·사는 위 한 줄로 접고, 나머지는 이름 그대로 남긴다(요청: 공방실속사) —
                 에너지업·시야업까지 한 글자로 접으면 무엇인지 알 수가 없다. 이름은 그
                 유닛의 것이 자명하므로 유닛 이름을 뗀 딱지(UNIT_UPGRADE_TAG)를 쓰고,
                 표에 없는 것만 연구 이름표(researchKo)로 떨어진다. */
              const rest9: string[] = [];
              for (const [, n] of other) {
                const tag9 = UNIT_UPGRADE_TAG[n as keyof typeof UNIT_UPGRADE_TAG]?.tag;
                const one9 = tag9 ? UPGRADE_ONE_LETTER[tag9] : undefined;
                if (one9) { if (!upBits.includes(one9)) upBits.push(one9); }
                else rest9.push(tag9 ?? researchKo(n));
              }
              if (upBits.length > 0) lines.push(upBits.join(" "));
              if (rest9.length > 0) lines.push(`연구 완료 ${rest9.slice(-6).join(" · ")}`);
            }
            const el = mapRef.current;
            const w9 = el?.clientWidth ?? 1;
            const h9 = el?.clientHeight ?? 1;
            /* ★ 물리는 자리는 지도가 아니라 **보이는 창**이다(지적: "모바일 전체화면에서
               인포팝업 클램프가 안 되는듯 화면 밖으로 나가서 뜸") ──────────────────────
               전체화면에서 지도는 무대보다 **크게(cover)** 깔리고, 자르는 일은 무대가
               맡는다(위 mapNode의 fsCoverW 주석: "지도를 화면보다 크게 깔고 자르는 일은
               무대에"). 그런데 아래 물림자는 지도 상자(w9·h9)였다 — 잘려 나간 바깥까지
               '자리 있음'으로 세니, 가장자리 유닛을 누르면 팝업이 크롭된 자리에 앉아
               화면 밖이 된다. 지도비와 화면비가 많이 다른 폰일수록 그 몫이 커진다
               (세로 폰에서 정사각 맵이면 좌우로 각각 수백 px이 창 밖이다).
               두 상자의 실제 사각형으로 겹치는 창을 낸다. 지도는 무대 한가운데에 앉으므로
               (left/top 50% + translate(-50%, -50%)) 넘치는 몫이 좌우·위아래로 반씩이고,
               그 반씩이 여기서 vx0·vy0로 잡힌다. 프레임 모드는 덮는 몫이 0이라 vx0·vy0가
               0, vx1·vy1이 w9·h9가 되어 예전 식과 한 톨도 안 달라진다.
               지도 상자에 걸린 변환은 이동(translate)뿐이라 사각형 폭이 clientWidth와
               같다 — 눕힌 보기의 회전은 이 상자가 아니라 안쪽 렌즈가 진다. */
            const mr9 = el?.getBoundingClientRect();
            const sr9 = stageRef.current?.getBoundingClientRect();
            const vx09 = mr9 && sr9 ? Math.max(0, sr9.left - mr9.left) : 0;
            const vx19 = mr9 && sr9 ? Math.min(w9, sr9.right - mr9.left) : w9;
            const vy09 = mr9 && sr9 ? Math.max(0, sr9.top - mr9.top) : 0;
            const vy19 = mr9 && sr9 ? Math.min(h9, sr9.bottom - mr9.top) : h9;
            const lx = ((op.fx - 0.5) * zoom + 0.5) * w9 + pan.x;
            /* 세로는 **그린 몸**에 맞춘다(같은 지적 결) — op.fy는 발밑 자리라, 공중
               유닛처럼 들려 그려지는 몸은 팝업이 몸 아래를 겨눴다. 들기 식은 판정
               (pickAt)·그리기(UnitLayer)와 같은 것을 쓴다. */
            const pxU9 = op.sizePx * zoom;
            const liftU9 = op.wFrac !== undefined
              ? (op.airPx !== undefined ? op.airPx * zoom : (op.liftK ?? 0) * op.wFrac * w9 * zoom)
              : (op.air ? (op.airPx ?? 0) * zoom : 0) + (op.rise ?? 0) * pxU9;
            const ly = ((op.fy - 0.5) * zoom + 0.5) * h9 + pan.y - liftU9;
            /* 팝업은 지도 밖으로 안 나간다(지적: "나오는 위치도 이상함 · 미니맵 내부로
               제한") — 여태는 마커 자리에 그대로 띄워, 가장자리 유닛을 누르면 상자가
               지도 밖(또는 화면 밖)으로 반쯤 잘려 나갔다.
               폭은 CSS가 못 박은 값이라 여기서 그대로 쓸 수 있고,
               높이는 줄 수로 어림한다(막대 줄은 두 줄 몫). 위로 띄울 자리가 모자라면
               마커 아래로 뒤집는다 — 지도 위쪽 유닛이 그 경우다. */
            const PAD9 = 6;
            /* 폭은 CSS가 못 박은 값(116 + 좌우 여백 18)이다(요청: "정보팝업 모달 너비
               반으로 축소") — 232에서 절반으로 줄였으니 여기 상한도 절반이다. */
            const PW9 = Math.min(134, vx19 - vx09 - PAD9 * 2);
            const barN9 = lines.filter((ln) => typeof ln !== "string").length;
            const PH9 = 28 + (lines.length - barN9) * 17 + barN9 * 26;
            /* ★ 팝업은 **집은 몸을 안 가린다**(지적: "인포팝업위치가 유닛이나 건물을
               가려서 안가리게 위치 조정해줘") ────────────────────────────────────
               여태는 마커 바로 위(위가 좁으면 바로 아래)에 **가운데 맞춤**으로 떴다.
               곧 팝업의 한 변이 늘 몸에 붙어 있어서, 상자가 조금만 커지거나(생산 큐가
               붙으면 열 줄이 넘는다) 배율이 낮으면 집은 몸을 그대로 덮었다.
               이제 **옆으로** 비킨다: 몸의 화면 반지름만큼 띄워 오른쪽에 세우고,
               오른쪽에 자리가 없으면 왼쪽으로 넘긴다. 둘 다 안 되는 좁은 화면에서만
               예전처럼 위·아래로 물러난다. 세로는 몸 높이에 맞춰 가운데다.
               ★ 몸의 화면 크기는 **집는 판정(pickAt)과 같은 식**으로 잰다 — 두 자가
                 갈리면 '눌러서 잡히는 몸'과 '피해 서는 몸'이 서로 다른 것이 된다. */
            /* ★ 비키는 거리는 **몸(잉크) 폭**이지 상자 폭이 아니다(지적: "인포팝업 너무
               멀리 뜸 특히 고배율일수록") — op.sizePx는 그리는 **상자**라 실제 보이는
               몸은 그 3분의 1 남짓이다(MODEL_INK). 상자로 재면 배율이 커질수록 그 차이가
               그대로 벌어져, 16배에서는 팝업이 몸에서 한참 떨어진 허공에 떴다.
               건물은 발자국 상자가 곧 몸이라 종전대로다. 그래도 아주 높은 배율에서는
               '가리지 않을 만큼'이면 충분하므로 벌어짐에 상한을 둔다. */
            const bodyW9 = op.wFrac !== undefined
              ? Math.max(op.wFrac, op.hFrac ?? 0) * w9 * zoom
              : op.sizePx * (modelInkOf(op.kind) / 16) * zoom;
            const halfB9 = Math.min(72, Math.max(10, bodyW9 * 0.5) + 8);
            const rightX9 = lx + halfB9 + PW9 / 2;
            const leftX9 = lx - halfB9 - PW9 / 2;
            /** 옆으로 설 자리가 있나 — 오른쪽 먼저, 없으면 왼쪽. */
            const side9 = rightX9 + PW9 / 2 <= vx19 - PAD9 ? 1
              : leftX9 - PW9 / 2 >= vx09 + PAD9 ? -1 : 0;
            const cx9 = side9 === 1 ? rightX9 : side9 === -1 ? leftX9
              : Math.min(Math.max(lx, vx09 + PW9 / 2 + PAD9), vx19 - PW9 / 2 - PAD9);
            /* 옆에 설 때는 세로 가운데, 위아래로 물러날 때만 종전처럼 몸 위(아래)다. */
            const flip9 = side9 === 0 && ly - PH9 - 14 < vy09 + PAD9;
            const cy9 = side9 !== 0
              ? Math.min(Math.max(ly, vy09 + PH9 / 2 + PAD9), vy19 - PH9 / 2 - PAD9)
              : flip9
                ? Math.min(ly, vy19 - PH9 - 14 - PAD9)
                : Math.min(Math.max(ly, vy09 + PH9 + 14 + PAD9), vy19 - PAD9);
            return (
              <div
                /* ★ 집은 몸이 바뀌면 상자를 **새로 세운다**(지적: "인포 팝업을 연속으로 열 때 기존 팝업 글자가 남아서
                   섞여 보인다") — 여태 상자 하나를 되쓰며 글자만 갈았다. 이 상자는 backdrop-filter(블러) 층이라
                   자리와 글자가 같은 프레임에 바뀌면 합성기가 옛 글자 판을 한 박자 더 비춰 새 글자와 겹쳐 보였다.
                   열쇠를 집은 몸으로 두면 다른 몸을 집는 순간 DOM이 통째로 새것이라 옛 판이 남을 데가 없다. */
                key={picked}
                className="scr-motion-info"
                style={{
                  left: Math.round(cx9),
                  top: Math.round(cy9),
                  ...(side9 !== 0
                    ? { transform: "translate(-50%, -50%)" }
                    : flip9 ? { transform: "translate(-50%, 14px)" } : {}),
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="scr-motion-info-name">{ko}</div>
                {lines.map((ln, li) => (typeof ln === "string"
                  ? <div key={li} className="scr-motion-info-line">{ln}</div>
                  : <React.Fragment key={li}>{ln}</React.Fragment>))}
              </div>
            );
          })()}
          {/* ★ 전장의 안개 — **유닛 캔버스 바로 위**다(지적: "크립이 안개를 안먹는
              문제"). 처음에는 지도 배경 위(렌즈 안)에 두었는데, 크립·자원·잔상 건물처럼
              **캔버스에 그려지는 지물**이 전부 그 위로 나와 안개를 안 먹었다.
              렌즈 **밖**에 서는 것도 중요하다 — 렌즈의 CSS 변환에 실리면 그린 그림이
              늘어나 확대할수록 뭉개진다. 팬·줌은 그리는 쪽이 좌표에 직접 먹인다
              (유닛 캔버스와 같은 규약이라 두 층이 언제나 같은 자리에 있다).
              덮여도 되는 것들이다 — 제 팀 유닛은 늘 밝은 자리에 있고(시야의 임자다),
              잔상 건물은 원작에서도 안개 밑에 잠겨 보인다. 마법 효과 층(z 7000)은
              이보다 위라 안개에 안 잠긴다. */}
          {/* 안 움직이는 막(위 CSS의 ★) — 안개 판이 못 덮는 네 띠에만 선다. 자리는 손짓이 적는다. */}
          {fogOn && exploredAt && visNow && (
            <div className="scr-motion-fogbg" aria-hidden>
              <i /><i /><i /><i />
            </div>
          )}
          {fogOn && exploredAt && visNow && (
              <ReplayFogLayer
                className="scr-motion-fog"
                w={gw9} h={gh9} exploredAt={exploredAt} t={t}
                vis={frame9.visSrc} proj={posFrac}
                zoom={zoom} pan={pan}
                tilePx={(mapRef.current?.clientWidth ?? 320) / grid.width}
                flatK={pitched ? pitchFlat : 1} flat={!pitched}
                painter={fogPaintRef} onNeedPaint={requestFogPaint9}
              />
            )}

          <UnitLayer
            ops={unitOps} fx={fxOps} opsSrc={frameOpsRef9} fxSrc={frameFxRef9}
            zoom={zoom} pan={pan} tilePx={tilePx} wallMask={creepMask} maskRects={creepMaskRects}
            /* 손짓(드래그·핀치·휠) 중에는 부모가 이 붓으로 캔버스만 다시 그린다 —
               리액트를 안 거치고, 그린 자리는 손끝 그대로다(xfLive). */
            painter={unitPaintRef} onPainted={onUnitPainted}
            /* 손짓이 도는가 — 배킹을 내린 손짓에서만 그림자를 접는다(위 shFold9). */
            gesture={xfGestureRef}
            /* 사양 라디오 × 배율 칸(요청) — 둘 다 켜져야 켜진다. 칸 2 이하는 몸만.
               칸 판정은 **문턱을 넘겨** 캔버스가 그리는 배율로 한다(손짓 중 한 박자
               늦지 않게) — 여기 boolean은 사양 라디오 몫만 진다. */
            showShadows={qShadows}
            showOverlap={qOverlap}
            showHp={qHp && hpShow} pickedKey={picked}
            showCreep={qCreep}
            marker={markerView}
            /* 0 = 마커가 어느 칸에도 안 선다(위 markerView) — 배치를 안 가린다.
               사다리에서 마커 칸이 빠지고 '몸만(간이) → 자세히'만 남는다. */
            markerAt={0}
            /* 그리는 쪽 문턱도 같이 올린다(위 liteView) — 만드는 쪽과 그리는 쪽이
               다른 칸에서 갈리면, 안 그릴 것의 값을 만들거나 그 반대가 된다. */
            /* ★ PC는 **2배부터 자세히**(요청: "PC/모바일의 그래픽을 똑같이 가져가면
               안될거 같아 … PC는 화면이 넓어서 2배줌부터도 꽤 자세히보이거든. 그림자가
               필요해보여" → "PC는 2배에서 전투효과 자세컷 포탑판 모두 추가 4배에서 체력바
               추가") — 넓은 자리는 지도 상자가 1024px이라 2배면 한 유닛이 열댓 픽셀이고,
               그 크기에서 그림자·불티가 없으면 몸이 바닥에서 떠 보인다. 좁은 자리(폰)는
               종전 문턱(8배) 그대로다 — 같은 2배라도 유닛이 대여섯 픽셀이고, 화면에 남는
               유닛 수는 가장 많은 칸이라 삯을 그대로 다 치른다. */
            detailAt={liteFlag9 ? Infinity : wide ? ZOOM_STEPS[1] : ZOOM_STEPS[3]}
            /* 붓 쪽 간이화 문턱(엔진은 늘 자세히 낸다 — UnitLayer의 ★ 주석): 요잉 열여섯 칸은 넓은
               자리 셋째 칸(3배)·좁은 자리 넷째 칸(6배)부터, 걸음·추진 컷은 넓은 자리 2배·좁은 자리 3배부터. */
            /* ★ 작은 기기는 요잉을 늘 여덟 칸으로(지적: 폰 6배 대규모 교전에서 판 굽기·버림이 초당 35장 —
               판 예산 36MB가 찬 채 LRU가 굽고 버리기를 되풀이했다. dpr 2로 눌러도 그대로였으니 픽셀이 아니라
               **판의 가짓수**다: 종류×요잉 16×색×자세. 요잉을 여덟 칸으로 하면 가짓수가 반으로 준다). */
            /* ★ 난전에서는 배율과 무관하게 **여덟 칸**이다(계측: 배율 6·958기에서 2초에 판 213장 1187ms —
               처음 보는 열쇠가 끝없이 났다). 판 열쇠의 요잉 칸이 열여섯이라, 같은 종류·같은 자세도 방향이
               한 칸 다르면 새 판이다. 덜어내기 단이 선 자리(미달 기기 + 60기 이상)에서 여덟 칸으로 눕히면
               **열쇠 수가 절반**이 되고, 45도 칸은 22.5도 칸의 부분집합이라 이미 구운 판이 그대로 쓰인다
               (갈아엎는 전환이 아니다). 조용한 화면에서는 종전대로 열여섯 칸이다. */
            yawAt={DEV9.yaw8Always || liteFlag9 || CROWD9.lv >= 1
              ? Infinity : wide ? ZOOM_STEPS[2] : ZOOM_STEPS[3]}
            moveAt={wide ? ZOOM_STEPS[1] : ZOOM_STEPS[2]}
            pitched={pitched}
            /* 크립을 가두는 맵 모서리(재지적: 3D에서 크립이 영역을 벗어남) — 입체는 원근
               투영된 사다리꼴이라 네 모서리를 posFrac으로 투영해 넘긴다. 평면은 단위
               사각형이 나와 기존 직사각 클립과 같다. */
            clipQuad={[
              posFrac(0, 0), posFrac(grid.width, 0),
              posFrac(grid.width, grid.height), posFrac(0, grid.height),
            ]}
          />
          {/* 마법 효과 오버레이(지시: 스톰은 모든 유닛 위에) — 렌즈와 같은 좌표계
              (posStyle %)와 같은 변환(줌·팬 미러)을 쓰되, 유닛 캔버스(z 6000)보다 위에
              선다. 지금은 사이오닉 스톰만 여기 산다. */}
          {/* ★ 효과 시트 — 확대를 transform이 아니라 **레이아웃 크기**로 먹는다(지적:
              "아이폰에서만 CSS 효과가 다 흐려 — 사망 효과와 스톰·핵". 선명한 것(가시·
              트레이서)은 캔버스가 그리고, 흐린 것은 전부 이 층의 DOM이었다) ─────────
              iOS 웹킷은 transform으로 확대된 무리를 1배로 굽고 GPU로 늘린다 — 그 안의
              DOM(그러데이션·clip-path·블렌드)은 무엇을 해도 흐리다. 층의 **폭 자체**를
              배율×100%로 두면 % 자식들이 화면 크기로 눕고, 래스터가 그 크기에서 일어나
              어느 엔진에서도 또렷하다. px로 적힌 것만 배율을 손수 곱한다(탄두·사망).
              손짓 동안은 굳은 배율과의 비만큼 임시 transform이 덮는다(잠깐 흐림 — 지도
              벡터층과 같은 흥정). 팬은 translate 그대로다(translate는 래스터와 무관). */}
          <div
            className="scr-motion-fxlens"
            ref={fxLensRef}
            style={{
              width: `${zoom * 100}%`, height: `${zoom * 100}%`,
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
              // px 게이트(zpx9)의 CSS 쪽 짝 — 규칙 안의 px은 calc(Npx * var(--scr-z))로 곱한다.
              ["--scr-z" as string]: zoom,
            }}
          >
          {/* 클릭 자국(요청: 동그라미 안에 점, 납작하게 + 토글) — 브루드워의 이동 클릭
              표시처럼, 명령이 떨어진 자리에 찍은 사람 색의 납작한 고리+가운데 점이 잠깐
              남는다. v2 데이터로 그리므로 v2 모드 + 클릭 토글이 켜져 있을 때만이다. */}
          {clickFx && entClicks.map(([cs, cx2, cy2, raw, ck], i) => {
            if (t < cs || t - cs > 0.9) return null;
            /* 시점 보기에서는 **상대편 손짓을 안 보여 준다**(지적: "상대편 마우스조작은
               감춰야해 이땐") — 클릭 자국은 '그 사람이 무엇을 눌렀나'라, 안개로 유닛을
               가려 놓고 조작만 보이면 시야를 가린 뜻이 사라진다. 같은 팀은 보인다
               (시야를 나누는 사이라 손짓도 함께 본다). */
            if (fogOn && !visAll && teamOfRaw(raw) !== viewTeam) return null;
            /* UI 고정 크기 — 가장 축소(줌 1)에서도 또렷한 18px 기준(재지적). 타일 비례는
               큰 화면에서만 그보다 커진다. */
            /* ★ 크기는 **배율을 따라간다**(요청: "마우스 클릭 마커크기를 배율에 따라 다르게
               조정 — 4배율 이상에서는 실제 마커크기(타일에 대비한 크기)로 보이게, 1·2배율에선
               그렇게 하면 너무 작아서 안보여서 강제 확대(4배율 기준으로)") ────────────────
               이 자국은 렌즈 안에 살지만 CSS가 `scale(1/줌)`으로 배율을 도로 지운다 — 곧
               여기 넣는 px이 곧 **화면에 보이는 px**이다. 그래서 원작 크기(타일의 0.55배)를
               내려면 화면 타일 크기(상자 타일 px × 줌)에 곱해야 한다.
               4배 미만에서는 줌 대신 4를 쓴다: 1배에서 타일이 8px이면 자국이 4px이라 점도
               못 되는데, 4배 기준으로 잡으면 18px 남짓으로 눈에 든다. 4배부터는 줌이 그대로
               들어가므로 자국이 타일과 함께 커진다 — 확대할수록 원작 비율에 수렴한다. */
            // 핑과 같은 자(재요청: 복잡하지 않게) — 4배부터 배율 그대로, 타일의 0.7배(12배에서 작다는 지적으로 0.55 → 0.7).
            const ckw = Math.max(10, ((mapRef.current?.clientWidth ?? 320) / grid.width) * Math.max(4, zoom) * 0.7);
            // 공격 클릭은 붉은 고리로 갈라 보인다(지적: 클릭 종류 구분).
            return (
              <span
                key={`clk-${i}`}
                className={cx("scr-motion-clickfx", ck === 7 && "scr-clickfx-atk")}
                style={{
                  /* ★ 유닛 캔버스 **위**다(지적: "크립위에 마우스 조작 안보임..
                     트레이서 안보이던거랑 같은 문제인가?" — 같은 문제가 맞다) ────────
                     자국은 DOM 스팬인데 z가 1490이라 유닛 캔버스(z 6000)보다 아래였다.
                     캔버스는 아무것도 안 그린 자리가 투명해서 맨땅에서는 비쳐 보였고,
                     **크립처럼 캔버스가 실제로 칠하는 자리**에서만 통째로 가려졌다.
                     트레이서가 안 보이던 것도 같은 결이었다(그쪽은 아예 캔버스로 옮겨
                     풀었다). 자국은 몇 개 안 되는 0.9초짜리라 캔버스로 옮길 값이
                     아니므로 층만 올린다 — Z_FX(6100)가 캔버스 바로 위 DOM 효과 층이다. */
                  // 효과 렌즈 안이다 — 배율은 층의 폭이 먹으므로 px은 곧 화면 px, 역배율은 안 건다.
                  ...posStyle(cx2, cy2), color: modeColor(raw, teamOfRaw(raw)), zIndex: 20,
                  "--ckw": `${(ckw * pitchK(cy2)).toFixed(1)}px`,
                  ...groundXfAt9(cx2, cy2),   // 입체: 눕히기 + 시점 밀림(요청)
                } as React.CSSProperties}
              />
            );
          })}

          {/* 미니맵 핑(요청: 클릭도 기록 — 리플레이에 좌표가 온전히 남는다) — v2 트랙에만
              있다. 찍은 사람 색의 물결 고리가 3초 동안 퍼진다. 카메라 시야는 리플레이에
              저장되지 않아 못 그린다(엔진 재시뮬레이션의 몫). */}
          {qPing && (entData?.pings ?? []).map(([ps, px, py, ppid], i) => {
            if (t < ps || t - ps > 3) return null;
            const raw = entData?.players.find((pl) => pl.owner === ppid)?.name ?? "";
            /* 관전자 핑은 안 그린다 — 클릭 자국과 달리 여기는 **실제로 걸린다**: 핑은
               유닛이 없어도 찍을 수 있어, 관전자가 지도 위에 남기는 유일한 자국이다. */
            if (obsNames.has(raw)) return null;
            // 핑도 같은 자(위 클릭 자국 주석) — 상대편 것은 시점 보기에서 안 보인다.
            if (fogOn && !visAll && teamOfRaw(raw) !== viewTeam) return null;
            return (
              <span
                key={`ping-${i}`}
                className="scr-motion-pingfx"
                // 핑도 같은 사정 — 캔버스 위로 올린다(크립·유닛 위에서도 보인다).
                /* 크기도 배율을 따른다(요청: 마커처럼) — 4배 기준 아래서는 강제 확대, 위로는 타일 1.4배. */
                style={{
                  ...posStyle(px, py), color: modeColor(raw, teamOfRaw(raw)), zIndex: 25,
                  "--pgw": `${(((mapRef.current?.clientWidth ?? 320) / grid.width) * Math.max(4, zoom) * 1.4 * pitchK(py)).toFixed(1)}px`,
                  ...groundXfAt9(px, py),   // 입체: 눕히기 + 시점 밀림(요청)
                } as React.CSSProperties}
              />
            );
          })}
            {/* (걷어냄) 핵의 DOM 스팬 한 벌 — 조준점·꼬리 연기·낙하 탄두·충격파·섬광·버섯구름이
                전부 캔버스 fx(kind "dom" · style "nuke")로 옮겼다(요청: "둘다 옮겨").
                여기 있어야 했던 까닭(렌즈가 유닛 캔버스를 못 덮는다)은 캔버스 fx가 몸을 다 그린
                위에 얹히면서 사라졌고, 덤으로 연출이 **나이의 함수**가 되어 배속·일시정지·되감기가
                저절로 맞는다 — CSS 키프레임의 벽시계를 게임 시계에 맞춰 주던 자(nukeClockTick9)와
                그 계기(NUKEM9)도 함께 걷었다. 사정은 엔진의 Nuclear Strike 갈래에. */}
            {/* (걷어냄) 사이오닉 스톰의 DOM 스팬 — 캔버스 fx(kind "dom" · style "storm")로 옮겼다
                (요청: "둘다 옮겨"). 모델·요잉·피치는 그대로고, 그리는 자리만 유닛 캔버스 위다.
                한때 여기 있어야 했던 까닭(렌즈가 유닛 캔버스를 못 덮는다)은 캔버스 fx가 몸을 다
                그린 위에 얹히면서 사라졌다. 엔진의 Psionic Storm 갈래에 그 사정이 적혀 있다. */}
          {/* (걷어냄) **드론 변태·취소의 자국** — 요청("드론이 공사 고치로 변태하거나
              취소할 때 효과 추가")으로 넣었다가 요청("건물 변태 링 효과 제거")으로 걷는다.
              안으로 조여드는 고리가 변태, 밖으로 터지는 고리가 취소였다. 되살리려면
              droneMorph(위)가 그대로 있으니 그 값으로 span 둘을 다시 세우면 된다 —
              CSS(.scr-motion-morphfx)와 keyframes(scr-morph-in/out)도 함께 걷었다. */}
          </div>
          {/* (걷어냄) 좁은 화면의 배속·각도 슬라이드 바 — 지도 위에 얹혀 지형을 가리고,
              값을 보려면 지도를 눌러 켜야 했다. 이제 지도 오른쪽 아래 버튼 줄이 그 둘을
              **값으로 늘 보여 준다**(요청). 그 바를 여닫던 상태(mobBars)와 지도 탭의
              '닫기' 갈래도 함께 걷었다 — 여닫을 것이 없어졌다. */}
          {/* (옮김) 떠 있는 아이콘 줄·진단 오버레이 — 이제 **늘** 판 뿌리(.scr-fs-root)에
              선다. 지도 상자는 무대를 덮게 깔려 잘리므로 그 구석이 창 밖일 수 있고,
              그 사정은 전체화면만의 것이 아니라 프레임에서도 배율을 올리면 같다.
              한 자리에만 두면 '어느 쪽에 있나'를 따질 일 자체가 없어진다. */}
          {/* (삭제) PC 확대 조절바 — PC에서는 확대 기능을 통째로 걷었다(요청). 확대·이동은
              이제 모바일 손짓(더블탭·두 손가락)만의 것이다. */}
        </div>
  );

  /** 그리는 자리 → **평면 지도 분수**(지적: "3D모드에서 미니맵의 지도는 그대론데
   *  요소들이 3D각도로 누워서 안맞는 문제") — op의 fx·fy는 입체 원근이 이미 먹은
   *  값(posFrac)인데 미니맵 배경은 늘 평면이라, 그대로 찍으면 점만 사다리꼴로 누웠다.
   *  posFrac의 역함수(tileOfFrac)로 타일을 되찾아 격자 크기로 나눈다 — 평면 보기에서는
   *  두 셈이 서로 지워져 값이 한 톨도 안 움직인다. */
  /** 미니맵의 분수 좌표 → 지도 타일 분수 — 입체 보기에서 눌린 자리를 되편다. */
  const miniUnproject = (fx9: number, fy9: number): [number, number] => {
    const [tx9, ty9] = tileOfFrac(fx9, fy9);
    return [tx9 / Math.max(1, grid.width), ty9 / Math.max(1, grid.height)];
  };
  /** 위의 역 — 미니맵이 짚은 **평면 지도 분수**를 그리는 자리 분수로 되돌린다.
   *  미니맵을 끌었을 때 팬을 푸는 셈(normSeek·fsSeek)이 그 자리에서 산다. */
  /** 미니맵 좌표(0~1) → 그리는 자리의 분수 — 지도와 같은 사상을 쓴다. */
  const miniProject = (mx9: number, my9: number): [number, number] =>
    posFrac(mx9 * grid.width, my9 * grid.height);
  /** 미니맵에 깔 안개(요청: "시야안개를 미니맵에도 보여주고") — 큰 지도의 안개 층과
   *  **같은 근거**(밝힘 이력·지금 덮임)를 그대로 넘긴다. */
  /** 미니맵에 넘길 안개 — 켜져 있고 자료가 다 있을 때만. */
  const miniFog = fogOn && exploredAt && visNow
    ? { w: gw9, h: gh9, explored: exploredAt, vis: visNow, t } : null;
  /* 미니맵이 읽는 '지금 보는 창' — 지도 분수 좌표다. 그리는 쪽의 사상(zx/zy)을 그대로
     뒤집으면 나온다: 분수 f는 화면에서 (f−0.5)·지도폭·배율 + 지도폭/2 + 팬에 놓이므로,
     창의 양 끝을 f로 되돌리면 중심 0.5 − 팬/(지도폭·배율), 폭 창폭/(지도폭·배율)이다. */
  /* 덮은 지도의 높이 — 위 panRoom이 쓰는 fsCoverH와 같은 값이다(한 자리에서 낸다). */
  /* 값이 아니라 **함수**다(요청: "맵 드래그나 줌시 미니맵의 프레임도 실시간으로 변경")
     — 손짓이 도는 동안 zoom·pan 상태는 아직 안 굳는다(굳는 것은 손을 뗄 때다). 굳은
     값으로 셈한 네모를 넘기면 프레임이 손 뗄 때까지 얼어 있으므로, 미니맵이 손끝 값을
     넣어 그때그때 셈할 수 있게 셈 자체를 넘긴다. */
  /** 미니맵이 읽는 '지금 보는 창' — 값이 아니라 셈이라 손짓 중에도 프레임이 따라온다. */
  const fsViewAt = (z9: number, p9: { x: number; y: number }) => ({
    cx: fsCoverW > 0 ? 0.5 - p9.x / (fsCoverW * z9) : 0.5,
    /* ★ 여기에는 눌림(pitchSpan)이 **안 들어간다**(지적: "3D에서 확대를 많이 하면
       미니맵하고 실제 지도가 안 맞는 현상") — 한때 넣었다가 틀렸다.
       이 분수의 자는 posFrac이고, posFrac이 내는 fy는 **이미 사영을 지난 값**이다
       (0.5 ± span/2 사이에 든다). 그 위에 렌즈가 하는 일은 `scale(z) translate(pan)`
       뿐이라, 화면 y = (fy − 0.5)·상자세로·배율 + 상자세로/2 + pan.y — 눌림이 다시 곱해질
       자리가 없다. 팬 한계(panLimit)에 눌림이 드는 것과 헷갈리기 쉬운데 그쪽은 재는 것이
       **화면 위 길이**라 다르다: 같은 눌림이 한 곳에서는 이미 들어 있고 한 곳에서는
       아직 안 들어 있다. 확대할수록 그 곱이 벌어져 미니맵이 지도와 어긋났다. */
    cy: fsCoverH > 0 ? 0.5 - p9.y / (fsCoverH * z9) : 0.5,
    w: fsCoverW > 0 ? stage.w / (fsCoverW * z9) : 1,
    /* ★ 세로로 보이는 몫의 자는 무대가 아니라 **지도 상자**다(지적: "1배 줌에서 미니맵에
       프레임이 위아래나 좌우가 안 보이는 경우가 많아") ────────────────────────────────
       그 시절 무대는 지도 위에 그림 여유를 얹은 값이라 지도보다 늘 그만큼 높았고, 그
       값으로 나누면 1배에서 보는 창이 지도의 1.15배로 나와 흰 네모가 상자 밖으로 나갔다.
       여유가 무대 밖(판의 여백)으로 나간 지금은 무대가 곧 지도 상자라 h가 1이다 —
       그래도 자는 fitH9로 못 박아 둔다: 다시 무대 안에 무엇을 얹더라도 여기가 안 갈린다.
       가로(위 w)는 무대 폭이 맞다 — 지도가 무대보다 넓으면 실제로 좌우가 잘린다.
       ★ 3D에서는 그 세로를 **회전 전 자로 되돌린다**(÷ 눌림) — 팬 한계와 같은 사정이다
         (panLimit의 winH 주석). 안 되돌리면 미니맵의 흰 네모가 실제로 보는 몫보다
         눌린 만큼 작게 나와, 끌 수 있는 자리와 표시가 어긋난다. */
    h: fsCoverH > 0 ? fitH9 / (fsCoverH * z9) : 1,
  });
  /* (걷어냄) normViewAt·normSeek — 평소 배치 전용 미니맵이 읽던 창·끌기다. 판이
     하나가 되면서 미니맵도 하나가 됐다(fsViewAt·fsSeek) — 무대 크기는 프레임이든
     전체화면이든 같은 자(stage)로 재므로 셈이 갈릴 자리가 없다.
  /** 미니맵을 끌었다 — 그 분수 자리가 화면 한가운데로 오게 팬을 푼다(위 식의 역). */
  /** 미니맵을 짚으면 그 자리가 가운데로 온다. */
  const fsSeek = (mx: number, my: number): void => {
    if (fsCoverW <= 0 || fsCoverH <= 0) return;
    const [fx, fy] = miniProject(mx, my);
    const zS9 = zoomRef.current;
    const lim = panLimit(zS9);
    setView9(zS9, {
      x: Math.min(lim.x, Math.max(-lim.x, (0.5 - fx) * fsCoverW * zS9)),
      y: Math.min(lim.yTop, Math.max(-lim.y, (0.5 - fy) * fsCoverH * zS9)),
    });
  };
  /* ★ 전체화면을 껐다 켜면 미니맵을 **다시 칠한다**(지적: "전체화면 off 시 미니맵이
     초록색 그걸로 그려져 있음") — 그 전환에서 미니맵 상자의 크기가 갈리고, 새 크기의
     지형이 아직 안 구워졌으면 밑칠(초록)만 그려진다. 재생 중이면 다음 틱이 곧 다시
     칠하지만 멈춰 두었으면 그 그림이 그대로 남는다. 몇 박자에 걸쳐 몇 번 더 칠한다 —
     구워지는 대로 제 그림이 올라온다(부트 스크립트의 늦은 재측정과 같은 손이다). */
  useEffect(() => {
    const ids = [0, 90, 280, 700].map((d9) => window.setTimeout(() => {
      miniPaintRef.current?.(zoomRef.current, panRef.current);
    }, d9));
    return () => ids.forEach((i9) => window.clearTimeout(i9));
  }, [fsOn]);
  /** 미니맵 위 휠 — **그 자리를 가운데 두고** 한 칸 확대·축소한다(지적: "지금은 좌하단
   *  기준으로 하는 듯"). 지도 쪽 휠은 지도 상자 안의 커서 자리를 축으로 삼는데, 커서가
   *  미니맵 위에 있으면 그 자리가 늘 상자의 한 구석으로 잡힌다.
   *  배율 칸은 버튼·키보드와 같은 문(zoomNext)을 쓰고, 자리는 미니맵의 자(miniProject)로
   *  푼 다음 그 점이 화면 한가운데에 오게 팬을 맞춘다 — fsSeek와 같은 식이다. */
  const fsWheelZoom = (mx: number, my: number, up: boolean): void => {
    if (fsCoverW <= 0 || fsCoverH <= 0) return;
    const z9 = zoomNext(zoomRef.current, up);
    if (z9 === null || z9 === zoomRef.current) return;
    closePicked9();   // 미니맵 위 휠 배율도 팝업을 닫는다(요청).
    const [fx9, fy9] = miniProject(mx, my);
    const lim9 = panLimit(z9);
    setView9(z9, {
      x: Math.min(lim9.x, Math.max(-lim9.x, (0.5 - fx9) * fsCoverW * z9)),
      y: Math.min(lim9.y, Math.max(-lim9.y, (0.5 - fy9) * fsCoverH * z9)),
    });
  };
  /* ── 전체화면 오버레이(요청) ────────────────────────────────────────────────
     PC는 "좌우하단 조작부는 현재 PC화면과 동일한 위치와 형태, 구성" — 그래서 여기 서는
     것은 전부 위에서 이미 만든 조각 그대로다(teamCol · SlideBar · mapToggleNode ·
     perfToggleNode · controlsNode · shareNode). 새로 만든 것은 미니맵 하나뿐이다.

     ★ 판은 **body로 포털한다**(수리) — 이 컴포넌트의 조상인 경기 카드에 backdrop-filter가
       걸려 있어, 그 아래의 position:fixed는 화면이 아니라 카드를 기준으로 깔린다.
       전체화면 API가 먹는 PC는 최상위 층으로 올라가 티가 안 났지만, 아이폰 사파리는
       CSS 폴백뿐이라 화면 맨 위(헤더·로고)가 안 덮였다(지적). 포털하면 그 사정에서
       완전히 벗어난다 — 평소 배치(.scr-motion-fs)는 그동안 통째로 숨는다. */
  /** 배속·각도 바는 세 배치(PC 평소·PC 전체화면·모바일 전체화면)가 같은 것을 나눠 쓴다. */
  /* (걷어냄) 배속·각도 슬라이드 바 — 판 안에 살아서 판을 열어야 보였고, 그래서
     '지금 몇 배속인지'를 알려면 판을 한 번 열어야 했다. 이제 지도 위 버튼이 **값을
     얼굴에 적고** 늘 서 있다(요청: mapBtnRow의 배속·보기·확대). 각도는 그러면서
     다섯 눈금에서 2D/3D 둘로 줄었다(요청) — 위 PITCH_DEGS 주석. */
  /* (걷어냄) sideNode — 평소 배치의 합친 사이드바(왼쪽 기둥에 로스터·버튼부·미니맵)
     다. 판이 하나가 되면서(요청: 일반/전체화면 통합) 그 조각들은 전부 지도 위에
     얹힌 판(.scr-fs-panel)으로 갔다. 기둥 자리를 지키던 CSS(.scr-motion-sidepanel
     계열)도 함께 걷었다 — 관리포인트를 줄이는 것이 이 통합의 뜻이다.
     ※ 여기 있던 "네 배치가 이 하나를 쓴다"는 다짐은 이제 구조가 대신한다:
       배치가 하나뿐이라 베낄 자리가 없다. */
  /* 나가기 — 넓은 배치(PC) 전용이다. 손가락 기기의 나가기는 아래 색상·성능 줄의
     여닫이 버튼이 맡는다(요청: "전체화면 온오프 버튼을 여기로 이동") — 한때 맨 윗줄
     가운데에도 뒀지만, 같은 일을 하는 버튼이 한 화면에 둘일 까닭이 없다. */
  /* (걷어냄) 전체화면 나가기 버튼 — 이제 지도 오른쪽 아래 떠 있는 줄의 맨 오른쪽
     아이콘이 들고나기를 한 손잡이로 맡는다(요청). 들어가는 버튼과 나가는 버튼이
     화면마다 딴 데 있으면 그건 토글이 아니다. */
  /* 손가락 기기의 전체화면 배치(요청: "모바일 도구 오버레이 배치 잘해서 패널 남는 공간
     많이 줄일수 있을듯 안그래도 화면 좁은데 맵 다가려져") — 여태 좌우로 148px짜리 기둥
     둘이 서서 폭 390px 화면에서 지도에 94px만 남겼다. 기둥을 걷고 이렇게 앉힌다:
       · 맨 위 한 줄 — [1팀 로스터] [나가기] [2팀 로스터]
       · 지도 좌우 **가장자리**에 배속·각도 바(지도 위에 얹되 세로 한가운데)
       · 맨 아래 두 줄 — [색상·성능·공유] / [재생·진행바·시각]
     가운데는 통째로 지도다. */
  /* ★ **판은 하나다**(요청: "일반화면을 전체화면과 구분하지 않고 전체화면을 프레임
     안에 표현하는 걸로 변경 · 일반화면 전용 CSS는 없어져야 맞아 — 관리포인트 줄이기")
     ────────────────────────────────────────────────────────────────────────────
     여태 이 파일은 같은 재생기를 **두 벌** 그렸다: 평소 배치(로스터는 지도 위 한 줄
     또는 왼쪽 기둥, 버튼은 지도 아래 줄)와 전체화면 배치(로스터·도구가 지도 위에 뜬
     판). 조각(teamCol·controlsNode·viewRowNode)은 나눠 썼지만 **감싸는 틀이 둘**이라,
     고칠 때마다 두 군데를 맞춰야 했고 실제로 갈렸다 — 표 머리 한 줄이 한쪽에서만
     자리를 밀던 것이 그 증상이다.
     이제 틀도 하나다. 아래 stageNode가 그 하나이고, 전체화면은 그것을 body로 **옮겨
     심는** 일일 뿐이다(fixed·inset:0). 평소에는 제자리에서 프레임 크기로 선다.
     크롭도 저절로 하나가 된다: 지도는 늘 무대를 덮게(cover) 깔리는데, 프레임의
     가로세로비를 지도와 같게 주므로 평소에는 덮는 몫이 0이다(=꼭 맞는다). */
  const stageNode = (
    <div
      className={cx("scr-motion", "scr-fs-layer", fsOn && "is-fs", !fsUi && "is-idle",
        fsOn && fsHide9 && "is-uihide")}
      /* 프레임일 때의 크기 — 지도와 같은 가로세로비다(위). 전체화면에서는 CSS가
         화면을 채우므로 이 값이 안 쓰인다(is-fs가 덮는다). */
      /* 프레임 크기 — 비는 **지도 것**이라 크롭 0이 기본이고(지적: PC에서 높이가 낮음),
         오버레이가 설 최소 높이는 CSS가 받친다(.scr-fs-layer의 min-height). 폭 상한은
         넓은 배치에서만, 지도가 쓰던 값 그대로. */
      style={fsOn ? undefined : frameStyle}
    >
      {/* 지도 비를 CSS에 알린다(--scr-mini-ar) — 전체화면의 미니맵은 **키를 먼저 정하고**
          폭을 그 비로 낸다(요청: "미니맵 영역 높이를 버튼 최대값일 때 오른쪽 조작부 높이에
          맞춰서"). 폭은 아이콘 줄·조종부의 왼 끝이 함께 보는 값이라(--scr-mini-w) 셋이
          한 식에서 나와야 안 어긋난다. */}
      <div
        className="scr-fs-root" ref={fsRootRef}
        style={{ ["--scr-mini-ar" as string]: `${grid.width / Math.max(1, grid.height)}` } as React.CSSProperties}
      >
        <div
          className="scr-fs-stage" ref={stageRef}
          style={{
            ...stageStyle,
            touchAction: "none",
          }}
          /* ★ 손짓은 **무대가 받는다**(요청: "나머지 부분은 그 아래 맵으로 흘려서
             더블클릭/탭 줌으로 작동하게") ────────────────────────────────────────────
             여태 이 넷은 지도 상자에 붙어 있었다. 그런데 무대에는 지도 말고도 두 가지가
             더 산다 — 그 위에 뜬 로스터다. 실측:
             로스터가 세로 24~114인데 지도 상자는 89부터라, 로스터의 3분의 2가 **지도
             밖**이다. 로스터에서 손짓을 흘려보내 봐야 그 아래에 지도가 없으니 아무 일도
             안 일어났다.
             무대로 올리면 그 띠까지 한 상자가 된다 — 지도 위에서 시작한 손짓은 거품처럼
             올라와 여전히 여기 닿으므로 종전 동작은 그대로고, 여유 띠와 로스터의 빈자리
             에서도 같은 손짓이 먹는다. 좌표 셈은 지도 상자를 자로 쓰므로(mapRef의
             getBoundingClientRect) 바뀔 것이 없다.
             조작부(.scr-fs-ui)·미니맵은 무대의 **형제**라 여기 안 걸린다. */
          onPointerDown={onMapPointerDown}
          onPointerMove={onMapPointerMove}
          onPointerUp={onMapPointerUp}
          onPointerCancel={onMapPointerUp}
        >
          {/* ★ 밤하늘은 **무대의 빈자리**를 채운다 — 처음엔 눕힌 보기 전용이었다(요청: "우주
              배경 만든 건 기존 3D 보기에서 남는 빈 공간 채우는 용으로 쓰고(맵에 병합 X)"):
              눕히면 지도가 무대를 못 채워 네 귀퉁이가 빈다. 그 뒤 평면에도 **위쪽 여유
              도화지**(맨 윗줄의 키 큰 유닛이 그려지는 띠, --scr-mapband)가 생겨 거기가 맨
              바닥색으로 비었다 — 그 띠에도 같은 하늘을 깐다(요청: "2D의 위쪽 추가 도화지에도
              3D처럼 우주 배경"). 지도가 덮는 자리에서는 지도 아래라 안 보이니 평면에 늘
              두어도 그림은 띠에서만 드러난다. 지도에 **안 섞는다**: 무대 바닥에 한 장 깔릴
              뿐이라 지도 이미지·굽기와 한 톨도 안 얽힌다. 제 합성 층이고 안 움직이므로
              (CSS 주석) 평면에 늘 두어도 끌기·확대 비용이 안 는다. */}
          <div className="scr-fs-space" style={{ backgroundImage: spaceBg9 }} aria-hidden />
          {mapNode}
        </div>
        {/* 떠 있는 아이콘 줄 — 전체화면에서는 **화면 뿌리**에 선다(위 mapBtnRow 주석):
            지도 상자는 화면보다 크게 깔려 잘리므로 그 구석이 화면 밖이다. */}
        {mapBtnRow}
        {/* ★ 미니맵 판은 **아래 독의 왼쪽**에 선다(요청: "PC/모바일 공통으로 미니맵까지
            아래로 내려줘 — 미니맵이 좌측에 배치되고 그 오른쪽에 위는 버튼부 아래는
            재생바부, 공통 CSS야") ────────────────────────────────────────────────────
            지도 밖으로 나온 것이 이제 셋이다: 미니맵 · 아이콘 줄 · 조종부. 셋을 한 격자
            (.scr-fs-root의 grid)에 앉혀 왼쪽 한 칸을 미니맵이 세로로 다 쓰고, 오른쪽
            칸을 위아래로 갈라 버튼과 재생바가 나눠 쓴다 — 원작의 조작부 배치 그대로다.
            자리는 CSS가 정하므로 JSX는 형제 셋을 순서대로 세우기만 한다.
            ※ 전체화면에서는 셋 다 지도 위에 겹쳐야 한다(지도가 곧 화면이라 '밖'이 없다)
              — 그때는 이 판이 예전처럼 절대 자리로 왼쪽 아래 구석에 앉는다. 뿌리와 무대가
              같은 상자라 그 셈이 그대로 맞는다(한동안 무대 안에 넣어 두었던 것은 좁은
              배치에서만 뿌리가 무대보다 길어져 밑값이 어긋났기 때문이고, 이제 그 배치
              에서는 절대 자리를 아예 안 쓴다). */}
        {/* 일반 화면에서는 늘 켠다(여닫이가 전체화면에만 있다 — 위 버튼 주석). */}
        {/* ★ 미니맵은 **판을 안 두른다**(요청: "미니맵은 패널 없게 수정 미니맵 자체가
            패널로 인식가능") — 미니맵은 제 테두리를 가진 네모라, 그 밖에 또 판을 두르면
            테두리가 겹으로 서고 그 사이 여백이 지도를 가린다. 자리 잡는 몫만 남긴다
            (.scr-fs-minipanel이 그 일을 이제 스스로 한다). */}
        {(fsOn ? fsMiniOn : true) && (
          <div className="scr-fs-minipanel">
            <div className="scr-motion-minibox">
              <ReplayFullscreenMinimap
                grid={grid}
                ratio={grid.width / Math.max(1, grid.height)}
                dotsRef={opsRef}
                extraRef={miniExtraRef}
                tick={t}
                viewAt={fsViewAt}
                zoom={zoom} pan={pan}
                painter={miniPaintRef} live={viewLive9}
                onSeek={fsSeek}
                onWheelZoom={fsWheelZoom}
                unproject={miniUnproject}
                fog={miniFog}
                /* 큰 지도와 **같은 순간에** 나타난다(지적: 미니맵만 그대로였다) — 그쪽은
                   is-warming으로 제 층을 통째로 감춘다(global.css). */
                warming={!tracksReady}
              />
            </div>
          </div>
        )}
        {diagNode}
        {/* ★ 조작부는 **아이콘 버튼**으로 연다(요청: "아니다 탭버튼으로 변경 ·
            햄버거 메뉴나 필터 아이콘 · 피시도 마찬가지로 아이콘으로 변경 — 원클릭으로
            열기가 아니고 아이콘") ─────────────────────────────────────────────────
            모서리 쓸기는 두 번 고쳐도 운영체제와 계속 겨뤘다(iOS 뒤로가기·안드로이드
            손짓 내비게이션은 페이지가 못 막는다). 버튼은 그 겨룸이 원천적으로 없고,
            무엇보다 **보인다** — 쓸기는 표시가 없으면 있는 줄도 모른다.
            자리는 **오른쪽 아래** 구석이다(지적: "햄버거는 아래에 있는게 정석") —
            엄지가 닿는 자리고, 위 구석은 노치·브라우저 UI와 겨룬다. 조작부가 떠 있는
            동안은 안 그리므로 아래 조종부 줄과 겹칠 일도 없다(닫는 것은 지도 누르기·엔터).
            ★ **.scr-fs-ui 바깥**에 선다(지적: "오버레이 활성화 버튼 안보임") — 조작부가
              숨을 때 그 판이 통째로 `opacity: 0`이 되는데, 투명도는 무리 전체에 걸리는
              성질이라 **자식이 1로 되돌릴 수 없다**. 손잡이가 그 안에 있으면 여는 길이
              함께 사라진다. 무대와 형제로 두면 그 사정에서 벗어난다. */}
        {/* ★ 로스터 판과 도구 판은 **완전히 따로 산다**(요청: "로스터/도구 오버레이
            완전 분리 및 각각 움직이고") ────────────────────────────────────────────
            여태는 둘이 한 기둥(sideNode) 안에 있어 여닫이가 하나였고, 그래서 '조작부는
            껐는데 로스터는 보고 싶다'를 만들려고 **로스터를 한 벌 더** 그려 두고 둘 중
            하나만 켜는 시늉을 했다. 같은 표가 소스에 둘이면 반드시 갈린다.
            이제 각자 제 판이고 제 여닫이다 — 켜고 끄는 조합 넷이 저절로 나온다.
            둘 다 여닫히는 판(.scr-fs-ui) **바깥**이다: 그 판은 숨을 때 통째로
            opacity:0이 되는데 투명도는 무리 전체에 걸려 자식이 되돌릴 수 없다. */}
        {/* ★ 로스터는 **꺼도 사라지지 않는다**(요청: "로스터 비활성화해도 로스터는 항상
            표시(현황 데이터 미표시 종족까지만 항상 표시) 자리는 활성화시와 같게하고
            패널은 미표시") — 여닫이가 끄는 것은 '판과 숫자'지 '누가 하고 있나'가
            아니다. 끈 꼴은 같은 자리에 이름+종족만 남고, 판(바탕·테두리·그림자)은
            안 그린다: 자리·여백을 그대로 두므로 켤 때 글자가 한 톨도 안 움직이고,
            지도를 가리는 것은 판뿐이라 그 판만 걷으면 시야가 열린다. */}
        {rosterMode !== 2 && (
          <div className={cx("scr-fs-panel scr-fs-roster-fixed",
            rosterMode === 0 && "scr-fs-panel-bare")}>
            {teamCol(1, true, rosterMode === 0, true)}
            {teamCol(2, true, rosterMode === 0, true)}
          </div>
        )}
        {/* (걷어냄·요청) 도구 판 — 품질·체력바·마우스 조작 줄(viewRowNode)이 들어 있던
            판이다. "일단 미사용"이라 그리지 않는다. */}
        {/* 깨우기는 **캡처**로 받는다 — 슬라이드 바가 제 누름을 stopPropagation으로
            끊으므로(지도 끌기와 겹치지 않게), 올라오는 길로는 여기까지 못 온다.
            내려가는 길에서 먼저 받으면 바를 만지는 동안에도 조작부가 안 사라진다. */}
        {/* 모서리 띠의 누름은 **깨우지 않는다** — 이 캡처가 그것까지 받으면 띠를 만지는
            순간 조작부가 3초 떴다 사라져, 쓸어 여는 손짓이 뜻을 잃는다. */}
        <div
          className="scr-fs-ui"
          onPointerDownCapture={(e) => {
            if (e.target instanceof Element && e.target.closest(".scr-fs-menubtn")) return;
            fsWake();
          }}
        >
          {/* (옮김) 로스터·도구는 이 판 밖에서 각자 산다(위) — 여기 남는 것은
              아래 조종부 줄뿐이고, 그것은 도구 여닫이를 함께 탄다. */}
          {/* ★ 아래 줄은 **하나**다(요청: "모바일도 장면공유 버튼은 재생바 로우에 병합
              한 줄로 피시처럼") — 여태 손가락 기기만 공유를 제 줄(.scr-motion-mobrow)에
              따로 세워 아래가 두 겹이었다. 그 겹 때문에 아이콘 줄·미니맵의 밑값이 배치
              마다 갈렸고, 실제로 공유 버튼이 아이콘 줄 뒤에 깔리기도 했다.
              한 줄로 합치면 갈릴 자리가 없어진다 — 재생·진행바가 남는 폭을 먹고, 공유는
              꼬리에 붙는다. */}
          <div className="scr-fs-bottom" ref={fsBotRef}>
            {controlsNode}
            {/* 꼬리 줄(요청: 재생부 셋째 줄) — 스크랩·공유(shareNode) 옆에 사용법. 격자가 이 줄을 통째로 준다(replay.css). */}
            <div className="scr-fs-bottom-tail">
              {/* ★ 장면 스크랩 — 앱이 onScrap을 주면 여기서 그린다(위 프롭 주석). 차례는 안내(ReplayGuide)와 같다:
                  스크랩(Z) → 공유(X) → 사용법. 꼴은 같은 줄의 공유·사용법과 한 벌이다(.scr-scrapbtn). */}
              {onScrap && (
                <button
                  type="button"
                  className={cx("scr-kakao-share-btn scr-scrapbtn", tailDone9?.k === "scrap" && "is-done")}
                  onClick={() => { void runTail9("scrap"); }}
                  aria-label={scrapLabel}
                  title={`${scrapLabel} (Z)`}
                >
                  <Bookmark />
                  {tailDone9?.k === "scrap" ? tailDone9.s : scrapLabel}
                </button>
              )}
              {onShare && (
                <button
                  type="button"
                  className={cx("scr-kakao-share-btn scr-sharebtn", tailDone9?.k === "share" && "is-done")}
                  onClick={() => { void runTail9("share"); }}
                  aria-label={shareLabel}
                  title={`${shareLabel} (X)`}
                >
                  <Share2 />
                  {tailDone9?.k === "share" ? tailDone9.s : shareLabel}
                </button>
              )}
              {shareNode}
              {/* ★ 전체화면의 꼬리는 **숨기기 단추**다(요청) — 사용법은 지도가 곧 화면인
                  자리에서 덮개를 하나 더 얹는 것이라, 그 구석은 '지금 보고 있는 것을
                  가리는 것들을 걷는' 손잡이가 쓴다. 프레임에서는 종전대로 사용법이다
                  (거기서는 오버레이가 지도 밖 독이라 걷을 까닭이 없다). */}
              {fsOn ? (
                <button
                  type="button"
                  className="scr-kakao-share-btn scr-fs-hidebtn"
                  onClick={() => setFsHide9((v9) => !v9)}
                  aria-pressed={fsHide9}
                  aria-label={fsHide9 ? "도구 보이기" : "도구 숨기기"}
                  title={fsHide9 ? "도구 보이기" : "도구 숨기기"}
                >
                  {fsHide9 ? <Eye /> : <EyeOff />}
                  {fsHide9 ? "도구 보이기" : "도구 숨기기"}
                </button>
              ) : guide && (
                <button type="button" className="scr-kakao-share-btn scr-guide-btn" onClick={openGuide9} aria-label="사용법" title="사용법">
                  <BookOpen />
                  사용법
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  /* 전체화면은 이 판을 body로 옮겨 심는 일이다 — 조상 카드에 backdrop-filter가 걸려
     있으면 fixed의 담을 상자가 그 카드로 바뀌므로(위 enterFs 주석) 반드시 body다. */
  const fsInner = fsOn ? createPortal(stageNode, document.body) : null;
  const guideNode9 = guideOpen9
    ? createPortal(<div className="scr-guide-overlay"><ReplayGuide onClose={closeGuide9} /></div>, document.body) : null;

  /* ══ 몸통 — **프레임 하나와 댓글 기둥**뿐이다(요청: 일반/전체화면 통합) ═════════
     여기 있던 것들을 전부 걷었다: 맵줄(.scr-motion-maprow)·좁은 화면 로스터 줄
     (.scr-motion-rosterwrap)·합친 사이드바(sideNode/.scr-motion-sidepanel)·지도 기둥
     (.scr-motion-mapcol)·도구줄(.scr-motion-toolrow)·지도 아래 색상 줄·조종부·공유 줄.
     그 자리는 stageNode 하나가 대신한다 — 같은 조각들이 지도 **위에 얹힌 판**으로 선다.
     전체화면일 때는 그 판이 body로 가 있으므로(fsInner) 프레임은 자리만 지킨다:
     빈 채로 두면 페이지가 그만큼 접혔다가 나올 때 도로 펴져 스크롤이 튄다. */
  /* 개체 그리기(mapNode) — `entWalks.map`으로 개체 천여 기의 마커를 만드는 자리다.
     앞선 계측에서 '본체만들기'가 0.02ms로 나온 까닭이 이것이다: 무거운 부분은 body가
     아니라 **그보다 앞서 만들어지는 mapNode**에 있어 창 밖이었다. */
  if (PERF9) pAdd("개체그리기(mapNode)", pNow() - pMap9);
  const pBody9 = PERF9 ? pNow() : 0;
  const body = (
    <div
      ref={setRoot}
      className={cx("scr-motion", "scr-motion-root", wide && "scr-motion-wide")}
      style={{ margin: "0 auto" }}
    >
      <div className="scr-motion-frame" ref={frameRef}>
        {fsOn ? (
          /* 전체화면 동안의 자리지기 — 판이 body로 나가 있는 사이 높이를 지킨다. */
          <div
            className="scr-motion-frame-hold"
            style={frameStyle}
          />
        ) : stageNode}
      </div>
      {/* 오른쪽 댓글 영역(요청: PC에서 댓글부를 미니맵 우측으로). */}
      {wide && side ? <div className="scr-motion-sidewrap">{side}</div> : null}
      {fsInner}
      {guideNode9}
    </div>
  );

  /* (삭제·요청: PC 확대창 관련 소스 완전 제거) — 포털 모달·가리개·폭 공식 전부.
     넓은 배치는 wide가 인라인으로 그린다. */
  /* 자료가 없으면 한마디만 한다(요청: 폴백 없음) — 옛 경기·분석 실패·아직 안 구운 판이
     여기 걸린다. 여태는 명령에서 유추한 그림이라도 띄웠지만, 그건 실제로 벌어진 일이
     아니었다. 없는 것은 없다고 말하는 편이 낫다. */
  if (entLoad === "none") {
    /* ★ 껍데기는 **그대로 둔다**(지적: "재생할 수 없는 게임이에요 뜰 때만 댓글 추가가
       아래에 뜨네 / 항상 일관된 디자인이 필요 맵영역 크기도 버튼들도") — 여태 이
       갈래는 한마디짜리 상자 하나만 돌려주고 나머지 배치를 통째로 버렸다. 그러면
       ① 지도 자리가 220px짜리 띠로 쪼그라들고 ② 넓은 배치에서 오른쪽에 서던 댓글
       기둥이 갈 곳을 잃어 아래로 흘러내린다. 재생할 수 없다는 것은 **지도 안의 사정**
       이지 페이지 배치가 알 일이 아니다.
       그래서 같은 뼈대(맵줄 · 양옆 로스터 · 오른쪽 댓글 기둥)를 그대로 세우고, 지도가
       설 자리에 그 한마디만 앉힌다 — 상자 크기도 비율도 재생되는 판과 같다.
       조작 줄은 안 단다: 없는 것을 조작하는 버튼은 일관성이 아니라 거짓말이다. */
    /* 껍데기는 재생되는 판과 **같은 프레임**이다(요청: 통합) — 상자 크기·비율·자리가
       한 자리(.scr-fs-layer)에서 나온다. 그 안에 로스터 판과 한마디만 앉힌다:
       조작 줄은 안 단다(없는 것을 조작하는 버튼은 일관성이 아니라 거짓말이다). */
    return (
      <div
        ref={setRoot}
        className={cx("scr-motion", "scr-motion-root", wide && "scr-motion-wide")}
        style={{ margin: "0 auto" }}
      >
        <div className="scr-motion-frame">
          <div
            className="scr-motion scr-fs-layer"
            style={frameStyle}
          >
            <div className="scr-fs-root">
              <div className="scr-fs-stage scr-motion-nodata">
                <span>재생할 수 없는 게임이에요</span>
              </div>
              <div className="scr-fs-panel scr-fs-roster-fixed scr-fs-panel-bare">
                {teamCol(1, true, true, true)}
                {teamCol(2, true, true, true)}
              </div>
            </div>
          </div>
        </div>
        {wide && side ? <div className="scr-motion-sidewrap">{side}</div> : null}
      </div>
    );
  }
  /* 화면 계측판 — `?perf=1`일 때만. 재생을 가리지 않게 위쪽에 얇게 얹고, 손가락이
     닿아도 아래 화면이 먹히도록 pointerEvents는 끈다. */
  /* 본체(JSX) 만들기에 든 시간 — 프레임주기에서 이것과 준비를 빼면 남는 것이
     **리액트 조정과 브라우저 그리기** 몫이다. 그 셋을 갈라야 어디를 손댈지 정해진다. */
  if (PERF9) pAdd("본체만들기", pNow() - pBody9);
  if (PERF9) { const e9 = pNow(); pAdd("렌더전체(JS)", e9 - pRender9); perfState9.renderEnd = e9; }
  if (!PERF9) return body;
  return (
    <>
      {body}
      <div
        style={{
          position: "fixed", left: 0, right: 0, top: 0, zIndex: 99999,
          background: "rgba(0,0,0,0.78)", color: "#9f9", pointerEvents: "none",
          font: "11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace",
          padding: "4px 6px", whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}
      >
        {perfLine9()}
      </div>
    </>
  );
}
