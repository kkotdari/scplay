/* 프레임 엔진(3번: 파일 분리) — ReplayMotionPlayer.tsx에서 엔진(deriveWorld9·createEngine9)과 그것이 이행적으로
 * 참조하는 표·헬퍼를 통째로 옮겼다(스크립트: scratchpad/split_engine.mjs). React·DOM은 없다 — 워커는 이 모듈만 든다.
 * 붓·UI가 쓰는 이름은 ReplayMotionPlayer가 여기서 import한다. */
import { PERF9, perfHit, pNow, pAdd, pFrame } from "./perf9";
import { type MiniDot } from "./ReplayFullscreenMinimap";
import { cx } from "./cx";
import { TECH_KO } from "../../utils/replayNames";
import { type ReplayMapGrid } from "./mapGrid";
import { AIR_UNITS } from "../../utils/statsMix";
import { BLD_STATS, UNIT_BUILD_SEC, UNIT_STATS } from "./unitStats";
import { acquireTilesOf, bodyRadiusOf, fireRangeTilesOf, isKnownKind, profileOf, reachTiles, weaponVs } from "../../utils/bwCombat";
import { BUILDING_FOOT, FRAME_SEC, GEYSER_FOOT, LURKER_SPINE_SPEED_PX, LURKER_SPINE_TRAVEL_PX, MEDIC_HEAL_RANGE_PX, MINERAL_FOOT, buildingBox, sightTiles } from "../../utils/bwUnits";
import { type TruthWorld } from "../../utils/truthLives";
import { posAtTruth as posAtSim, kN, kS, type TruthTrack, type TruthTracks, TRUTH_ST_CARRY_GAS as ST_CARRY_GAS, TRUTH_ST_CARRY_MIN as ST_CARRY_MIN, TRUTH_ST_BURROW as ST_BURROW, TRUTH_ST_FIGHT as ST_FIGHT, TRUTH_ST_GATHER as ST_GATHER, TRUTH_ST_INSIDE as ST_INSIDE, TRUTH_ST_MOVE as ST_MOVE, kT, tkN, tkT, tkV, tkAt, tkLast, EMPTY_TICKS, type Ticks } from "../../utils/openbwTracks";
import { posAtW, wT, wX, wY, EMPTY_WALK, type WalkView, type TrackPos } from "../../utils/replayTrack";
import { project, withPitchView, withTopView, withViewShear, withYaw } from "../../utils/shapeOblique";
import { TEAM_COLOR } from "./markers";


/* ── 모션 트랙 타입(옛 utils/replayMotion.ts에서 이사) ─────────────────────────────
   요약(summaryData) 생성이 걷히면서 트랙을 만드는 쪽(motionOf)은 사라졌고, 저장돼 있던
   모션을 읽어 그리는 이 파일이 타입의 유일한 사용처라 여기로 옮겨 왔다. 좌표는 전부
   타일이고, 시각은 초(정수)다. */


/** [초, x, y, 건물 영문명, raw, 무너진 초(0이면 살아 있음), 이륙한 초?] — 화면이 읽는
 *  건물 한 줄. 개체 트랙(buildsV2)이 만드는 유일한 꼴이다. */
/* [착공 초, 타일x, 타일y, 종류, 임자, 사라진 초, 이륙 초?, **완공 초**?]
   ★ 여덟째가 완공 초다 — 참값이 키마다 싣는 '다 지어졌나'가 처음 켜지는 때(TruthLife
     .doneAt). 여태 화면은 이 값을 몰라 '착공 + 표의 건설 시간'으로 어림했고, 테란은
     공사가 멈춰 서면 그 어림이 틀려 별도 유추(bldWork)를 돌렸다. 참값이 말하므로 둘 다
     필요 없다. */
export type BuildRow = [number, number, number, string, string, number, number?, number?];
/** [초, x, y, 기술 영문명, raw] — 좌표가 남는 마법 한 줄(스톰·스웜·리콜…). */
export type CastRow = [number, number, number, string, string];

/** 공중 유닛인가 — 마법 유닛(베슬·퀸 등)은 자취 목적상 지상 취급을 유지한다(옛 규칙 그대로). */
/* 오버로드는 통계용 AIR_UNITS(병력 구성 집합)에 없어서 지상으로 정렬됐다(지적: 스포닝
   풀이 오버로드 머리를 덮음) — 공중 우선(+100000) 화가 순서를 못 받아 건물이 풍선 위에
   그려졌다. 재생 판정에만 오버로드를 더한다(직선 비행·이완 제외도 같이 맞는 값이다).
   캐스터 제외(!CASTER_UNITS)도 걷었다(재검토 요청: "옵저버 같은 것도") — 그 조건이
   실제로 떨어뜨리던 것은 지상 캐스터가 아니라 아비터·베슬·퀸(나는 캐스터) 셋뿐이라,
   이들도 지상 취급돼 건물에 덮이고 지형 길찾기로 걸었다. 옵저버는 원래 정상이었다. */
/* ★ 손으로 깁는 셋 — **통계 집합에는 없지만 나는 것들**이다 ─────────────────────────
   AIR_UNITS는 '그 사람이 뽑은 병력'을 세는 집합이라, 뽑는 것이 아닌 나는 것은 애초에
   거기 들 까닭이 없다. 그런데 그리는 쪽이 그 집합을 빌려 쓰므로, 빠진 것마다 땅에
   내려앉는다. 같은 흠으로 세 번 데었다: 오버로드 · 뮤탈 고치 · **인터셉터**(지적).
   ⚠ 고치는 자리는 여기지 AIR_UNITS가 아니다 — 거기 넣으면 인터셉터가 '뽑은 공중 병력'
     으로 세어져 병력 구성 통계가 통째로 틀어진다(캐리어 하나가 여덟 기를 낸다). */
export const isAirUnit = (unit: string): boolean =>
  // 뮤탈 고치는 원작에서도 떠 있다 — 참값이 이제 고치를 제 유닛으로 낸다(태그 그대로
  // 뮤탈 → 고치 → 가디언). 여기 없으면 갓 웅크린 고치가 땅에 내려앉는다.
  unit === "Overlord" || unit === "Mutalisk Cocoon"
  // 인터셉터는 캐리어가 내보내는 것이라 통계 집합에 없다 — 그래도 나는 것이다.
  || unit === "Interceptor"
  || AIR_UNITS.has(unit);

/** 땅에서 떠 다니는 지상 유닛의 들어 올림 — **그리는 상자(px)에 대한 몫**이다
 *  (op.rise와 같은 자). 공중 유닛(air)이 아니므로 화가 순서·지형은 지상 그대로 두고,
 *  몸만 위로 뜨고 그림자는 제자리에 남아 그 사이가 곧 '떠 있음'이 된다.
 *
 *  왜 모델 안에서 안 하나(요청: "하이템플러 프로브 scv 드론 모두 땅에서 같은높이로
 *  띄우는데 실제 리플레이 재생시 티가 잘안나서 좀 많이 띄워야할듯 · 벌처도") — 모델이
 *  제 z0로 띄우면 그 몫이 **잉크 상자 안**이라, 정규화(MODEL_NORM)가 상자를 한 크기로
 *  맞추는 순간 띄운 만큼 몸이 작아진다. 곧 아무리 띄워도 화면에서는 티가 안 난다.
 *  그리는 단계에서 상자째 올리면 그 몫이 고스란히 남는다. */
/* 반으로(요청: "부양 지상유닛들 높이가 너무 높은듯함 반으로 낮추자") — 0.2·0.22·0.24
   → 0.10·0.11·0.12. 이 값은 **판의 바닥 픽셀에서 위로 띄우는 몫**이라(그리는 쪽의
   lift·footY 주석), 곧 발밑과 그림자 사이의 틈 그 자체다. 종류마다 다른 자를 쓰지
   않으므로 '발밑 기준으로 다 맞춘다'가 이 표 하나로 지켜진다. */
/* 값을 절반으로(지적: "부상 유닛(지상에서 살짝 떠있는 유닛) 너무 높아 높이 재조정
   필요") — 0.10~0.12는 몸 상자의 한 할이 넘어, 위에서 내려다보는 그림에서 일꾼이
   제 그림자에서 통째로 떨어져 나갔다. '살짝 떠 있다'는 그림자와 몸 사이에 **틈이
   보이는** 정도면 되고, 그건 상자의 5% 남짓이다. */
export const HOVER_RISE_K: Record<string, number> = {
  Probe: 0.05, SCV: 0.05, Drone: 0.05,
  "High Templar": 0.055,
  /* 호버 바이크 — 원작에서도 가장 확실히 떠 있는 지상 유닛이다(그래서 한 톨 높다). */
  Vulture: 0.06,
};
/** 착공 직후 이름이 떠 있는 시간(초) — 그 뒤로는 곧장 도형+망치다(요청: "건물은 처음
 *  짓기 시작할때 잠깐 이름으로 표시하고 아이콘에 망치"). 예전엔 다 지어지고도 한참
 *  이름이었는데, 그 시간 내내 이름이 화면을 차지했다. 생산·연구가 돌면 그때 다시
 *  이름이 뜬다. */
/** 건물이 바닥 위로 솟는 높이 몫(타일) — 캔버스는 발자국 비율에 이만큼을 더해 세로로
 *  길어지고, 그만큼 위로 올라앉아 바닥선은 발자국 그대로다(지적: "실제 건물은 바닥위에
 *  높이가 있어"). 높이는 발자국 폭에 비례한다(지적: "바닥이 좁으면 대체로 높이도 낮아")
 *  — 4칸짜리 커맨드는 1.6타일, 2칸짜리 파일런은 0.8타일 솟는다. 높은 건물이 제 뒤(위쪽)
 *  건물을 가릴 수 있는 것은 사선 뷰의 원래 모습이고, 겹침 차례는 y가 큰(앞) 건물이
 *  이긴다(렌더 정렬). */
/** 높이가 거의 없는 납작이들(지적: 포토캐논·성큰·벙커) — 높이 몫을 확 줄인다. */
export const FLAT_BUILDINGS = new Set(["Photon Cannon", "Sunken Colony", "Bunker"]);
export const riseOf = (unit: string): number =>
  (FOOTPRINT[unit] ?? [3, 2])[0] * (FLAT_BUILDINGS.has(unit) ? 0.12 : 0.4);
/** 마법 텍스트가 떠 있는 시간(초, 게임 시간). */
export const CAST_HOLD_SEC = 6;
/** 핵 낙하 시간(초) — 조준 시작부터 실제 착탄까지. 폭발 효과는 이 뒤에야 시작한다(지적).
 *  ★ 7 → **14**(지적: "고스트 빨간점 뜨는 조준 시간이 원래 이렇게 짧나 — 게임에서는
 *    꽤 길었던 것 같은데") — 원작은 시전 시작부터 착탄까지 14게임초 남짓이고, 그중
 *    대부분이 빨간 점이 깜빡이는 조준 구간이다. 7초는 점 3초 + 낙하 4초라 조준이
 *    낙하보다 짧았다. 착탄 시각은 안 움직인다: 시전 줄이 `미사일 죽음 − 이 값`으로
 *    합성되므로(nukeCasts), 이 값을 늘리면 점이 **더 일찍부터** 깜빡일 뿐이다.
 *    낙하 창(NUKE_DROP_SEC)도 그대로라 점 10초 + 낙하 4초가 된다. 고스트의 조준
 *    자세 창(t − cs < 이 값)도 함께 길어진다 — 원작에서도 그동안 내내 서서 쏜다. */
export const NUKE_FALL_SEC = 14;
/** 핵 연출을 참값의 착탄 시각보다 **얼마나 앞당겨 시작하나**(초) ────────────────────
 *  (지적: "핵 폭발할 때 유닛·건물이 먼저 터지고 핵이 늦게 터져서 좀 어색한 듯. 핵탄두
 *   떨어지는 타이밍과 폭발 시작 타이밍을 좀 앞당길 수 있어?")
 *  착탄 시각은 참값이 낸 **미사일 개체가 죽은 때**다. 그런데 그 죽음은 피해가 이미
 *  들어간 **뒤**에 적힌다 — 맞은 유닛·건물의 체력은 그 전에 0이 되므로, 화면에서는
 *  터지는 순서가 뒤집혀 보였다: 먼저 다 죽고 나서 핵이 뒤늦게 터진다.
 *  게다가 불덩이는 제자리에서 즉시 피는 것이 아니라 부풀며 커지므로, 시각이 맞아도
 *  '가장 큰 순간'은 그보다 한 박자 늦다. 두 몫을 한 수로 앞당긴다.
 *  이 값은 낙하·폭발·건물 철거 앞당김이 **모두 같이** 보는 자리다(nukeCasts가 한 번만
 *  빼면 nukeImpacts·landed 판정까지 같은 만큼 따라 움직인다) — 늘리거나 줄이려면 여기
 *  한 수만 고치면 된다. */
export const NUKE_LEAD_SEC = 1.1;   // 0.4배(요청: 핵탄두 0.4) — 9px는 1배에서 세 타일 폭이라 컸다
/** 착탄 뒤 폭발 효과가 화면에 남는 시간(초) — 이 창이 끝나면 스팬이 통째로 사라진다.
 *  구름이 옅어지는 데 걸리는 시간(CSS scr-nuke-cloud, 2.8초)보다 길어야 한다 — 짧으면
 *  아직 보이는 구름을 DOM에서 걷어내 **뚝 끊긴다**. 늘리거나 줄일 때 둘을 같이 본다.
 *  ★ 한때 7이었다(구름을 6.5초로 늘렸던 동안) — 되돌렸다(요청: "페이드아웃 시간이 좀
 *    과한거 같아 이전으로 돌려줘 더 스피드감있게").
 *  ★ 두 수가 **같은 자**로 재는 값이 된 것은 폭발을 게임 시간에 물린 뒤부터다(아래
 *    boomClock9). 그전에는 이 창만 게임 초였고 CSS는 벽시계라, ×1에서나 맞는 약속이었다:
 *    ×10이면 창은 0.4초 만에 지나가는데 구름은 제 초를 다 태우려 들어 늘 잘렸다. */
export const NUKE_BOOM_SEC = 4;
/** 크립이 만개까지 퍼지는 시간(초) — 원작은 해처리·콜로니에서 몇 분에 걸쳐 타일이
 *  번져 나간다(정확한 표는 공개돼 있지 않아 체감치). 시작 본진 해처리는 처음부터 만개. */
export const CREEP_SPREAD_SEC = 180;
/** 공중 몸이 뜨는 높이 — **그려진 몸 폭의 배수**다. 보기(2D·3D)와 무관하게 한 값이다.
 *
 *  ★ 보기별 갈래를 **걷었다**(요청: "2D 3D 모두 현재의 3/4 높이로 동일하게 수정하고
 *    손잡이는 제거") ──────────────────────────────────────────────────────────────
 *    여기 있던 것은 `FLAT_AIR_LIFT_K`, 곧 '평면에서는 이만큼만 띄운다'는 축소 손잡이였다.
 *    0.4로 시작해 1이 됐고(요청: "2d에서도 모두 1배로 해줘 그게 안 어색해"), 값이 1이
 *    된 뒤로는 아무 일도 안 하면서 아홉 자리에 조건식만 남겨 두고 있었다 — 갈래가 없는데
 *    갈래를 흉내 내는 코드는 다음 사람에게 "여기서 두 보기가 갈린다"고 거짓말을 한다.
 *    조건식을 통째로 걷고, 높이는 이 한 값이 정한다. 0.8 × 3/4 = 0.6이다.
 *  ★ 뜬 건물도 **같은 하늘에 뜬다**(요청: "건물끼리도 높이 같아야 하고 공중 유닛과 같은
 *    높이로 해 줘") — 한동안 건물은 제 배수(op.liftK, 그린 폭의 0.55)를 따로 들었다.
 *    그러면 건물끼리도 발자국 따라 층이 지고, 곁을 나는 레이스와도 층이 갈린다. 이제
 *    건물도 airLiftPxOf 한 곳에서 높이를 받는다(둥실거림만 제 것으로 얹는다). */
/** ★ 높이는 **제 몸이 아니라 기준 몸**을 잰다(지적: "공중 유닛 크기에 따라 떠 있는
 *  높이가 다른 버그") ────────────────────────────────────────────────────────────────
 *  맞는 지적이고, 원인은 이 배수를 곱하는 **대상**이었다. 여태 아홉 자리가 전부
 *  `제 몸 상자 × 0.6`이라, 뜨는 높이가 몸집에 정비례했다 — 셈해 보면 스커지 1.0타일 ·
 *  뮤탈 1.6 · 스카웃 1.9 · 캐리어 4.1타일이다. 같은 하늘을 나는 것들이 층을 이뤄
 *  떠 있었고, 큰 배일수록 제 그림자에서 멀어져 붕 떠 보였다.
 *  원작은 공중 유닛을 **한 높이**로 띄운다(스프라이트마다 z 오프셋이 같다). 그래서
 *  곱하는 대상만 기준 몸(AIR_LIFT_REF)으로 못 박는다 — 배수(0.6)도, 깊이 눌림(pitchK)도
 *  그대로다. 기준을 레이스로 둔 까닭은 지금 화면의 한가운데 값이기 때문이다: 그 대로
 *  두면 대부분의 공중 유닛은 전과 거의 같은 자리에 뜨고, 층을 이루던 양 끝(스커지·캐리어)
 *  만 그 줄로 모인다. */
export const AIR_LIFT_K = 0.6;
/** 뜨는 높이의 **기준 몸** — 모든 공중 유닛이 이 한 대의 높이로 뜬다. 크기표를 손보면
 *  높이도 저절로 따라오므로 여기 숫자를 적어 두지 않는다(적어 두면 언젠가 갈린다). */
export const AIR_LIFT_REF = "Wraith";


/* ── 나들이 점 걷기(지적: 특히 초반에 유닛 자리가 튄다 — 오버로드인지 갑자기 저 멀리 다른
   기지에 가 있다) ────────────────────────────────────────────────────────────────
   한 사람의 자취(pts)는 그 사람이 내린 이동·공격 명령을 시간순으로 이은 것 하나뿐이다.
   무엇을 골라 내린 명령인지는 대체로 안 남아서(replayParser의 orderPositions.by는 시즈·스톰
   처럼 그 유닛만 하는 커맨드가 있어야 붙는다), 오버로드나 일꾼을 정찰 보낸 클릭 한 번이
   '부대'의 자리로 읽히고 마커가 맵을 가로지른다. 초반에 유독 심한 것은 그때 내리는 명령의
   거의 전부가 정찰이라서다.

   가려내는 근거는 '돌아온다'는 사실이다: 정찰은 저쪽에 잠깐 찍혔다가 곧 이쪽 명령으로
   돌아오지만, 진짜 진군은 간 자리에서 계속 명령이 이어진다. 그래서 앞점에서 멀리 떨어진
   점이 짧게(RUN 이하) 이어지다가 다시 앞점 근처로 돌아오면 그 구간을 통째로 뺀다. 오래
   머무르는 구간(전투·진출)은 길이 조건에서 살아남는다.

   저장된 트랙이 아니라 화면에서 거른다 — 원본을 깎아 두면 되돌릴 수 없고, 이렇게 하면
   이미 등록된 경기도 재분석 없이 곧바로 반듯해진다. */
/* (걷어냄) 부대 어림 한 벌 — 명령 점을 부대 몇으로 묶고 가르던 상수와 함수(SPIKE_*·
   SQUAD_*·TYPE_MERGE_TILES·BY_UNITS·splitSquads·dropSpikes)다. 개체 트랙이 태그마다
   제 자취를 싣는 지금은 묶고 가를 것이 없다. */
/* ── 유닛 속도(요청: 속업 여부 포함) ──────────────────────────────────────────
   값은 타일/초다(브루드워 픽셀/프레임 × 23.81fps ÷ 32px). 표에 없는 유닛은 보병쯤(3.2)으로
   친다. 속업은 리플레이의 업그레이드 기록(트랙의 ups)에서 연구 시점을 읽어, 그 뒤의
   이동에만 붙는다 — 배수는 대부분 1.5배이고 오버로드만 4배다. */
export const UNIT_SPEED: Record<string, number> = {
  Marine: 3.0, Firebat: 3.0, Medic: 3.0, Ghost: 3.0, SCV: 3.7,
  Vulture: 4.8, Goliath: 3.5, "Siege Tank (Tank Mode)": 3.5, "Siege Tank": 3.5,
  Wraith: 5.0, Dropship: 4.1, "Science Vessel": 3.7, Battlecruiser: 1.9, Valkyrie: 4.9,
  Zealot: 3.0, Dragoon: 3.7, "High Templar": 2.4, "Dark Templar": 3.7, Archon: 3.7,
  Reaver: 1.3, Probe: 3.7, Shuttle: 3.3, Observer: 2.5, Scout: 5.0, Corsair: 5.0,
  Carrier: 2.5, Arbiter: 3.7,
  Zergling: 4.1, Hydralisk: 2.7, Lurker: 4.3, Ultralisk: 3.8, Defiler: 3.0,
  Drone: 3.7, Overlord: 0.6, Mutalisk: 5.0, Scourge: 5.0, Queen: 5.0, Guardian: 1.9,
  Devourer: 3.7, "Infested Terran": 4.0,
};
/** 유닛 → 그 유닛의 속도 업그레이드 이름. */
export const SPEED_UP_OF: Record<string, string> = {
  Zergling: "Metabolic Boost", Hydralisk: "Muscular Augments", Ultralisk: "Anabolic Synthesis",
  Overlord: "Pneumatized Carapace", Vulture: "Ion Thrusters", Zealot: "Leg Enhancements",
  Shuttle: "Gravitic Drive", Observer: "Gravitic Boosters", Scout: "Gravitic Thrusters",
};
export const DEFAULT_SPEED = 3.2;

export function speedOf(
  unit: string, atSec: number, ups: [number, string, number][] | undefined,
): number {
  const base = UNIT_SPEED[unit] ?? DEFAULT_SPEED;
  const upName = SPEED_UP_OF[unit];
  if (!upName || !ups) return base;
  const researched = ups.some(([sec, name]) => name === upName && sec <= atSec);
  if (!researched) return base;
  return unit === "Overlord" ? base * 4 : base * 1.5;
}

/** 커맨드를 받은 지 이 안이면 아직 '활동 중'이다(요청) — 이름표를 유지한다. 유닛은 오래
 *  이름으로, 건물은 타이트하게(지적)의 '오래' 쪽. */
/* 12 → 25초(요청: 액티브 상태 더 오래) — 이름이 너무 빨리 점으로 꺼져, 훑어보는 눈이
   따라가기 전에 정보가 사라졌다. */
/** 띄운 건물의 비행 속도(타일/초) — 착륙 이사와 정찰 비행을 잇는 자다.
 *  원작은 건물 종류를 안 가리고 늘 1픽셀/프레임이라 0.744타일/초다: 이·착륙 오더가 최고
 *  속도를 1로 박고(bwgame.h order_BuildingLiftOff), 오더가 끝날 때의 속도 복원이 건물을
 *  빼놓아 원래 값으로 못 돌아온다. 여태 쓰던 1.2는 근거 없는 어림이라 이사·정찰 비행이
 *  1.6배 빨랐다. */
/* (걷어냄) BUILDING_FLY_SPEED — 이사 비행에 걸리는 시간을 '거리 ÷ 속도'로 어림하던
   자다. 참값이 뜬 때와 앉은 때를 둘 다 말하므로(위 이사 비행 주석) 어림할 것이 없다:
   구간이 곧 답이고, 속도는 그 구간에서 저절로 나온다. 원작 값(FLYING_BUILDING_TPS =
   0.744타일/초)은 표에 그대로 남아 있다. */
/* (제거) 재생 전용 이름 보강 SCOUT_KO — 유닛별 완성 시각표(unitDoneByRaw)에서 일꾼을
   걸러내는 데만 쓰던 이름표였다. 그 표를 걷으면서 마지막 쓰임이 없어졌다. */
/** 생산 뒤 이 안이면 그 건물이 '일하는 중'이다(요청: 생산할 때 이름 표시) — 건물의 이름
 *  시간은 유닛(8초)보다 타이트하게(지적). */
/* ★ 여운은 없다(지적: "꺼져야하는데 안꺼지고") — 유닛이 나온 **뒤**에도 4초를 더 켜
   두던 값이다. 창의 앞쪽이 이미 '뽑는 내내'를 덮으므로(완성−생산시간부터), 뒤에 4초를
   더 붙이면 그 몫은 통째로 '아무것도 안 하는데 켜져 있는' 시간이 된다. 큐가 이어지면
   다음 유닛의 창이 곧바로 시작되므로 끊겨 보이지도 않는다. */
export const PROD_FLASH_SEC = 0;

/* 무엇이 어디서 나오나 — 유닛이 나온 순간 그 종류의 건물이 일하고 있었다는 뜻이다. 어느
   채인지는 리플레이가 안 알려줘(생산 커맨드에 건물 번호가 없다) 같은 종류가 함께 켜진다.
   저그는 전부 해처리 계열(라바)이고, 러커·가디언처럼 유닛에서 변태하는 것은 건물 몫이
   아니라 뺀다. */
/* 연구(업그레이드·테크) → 그 연구를 하는 건물(요청: 업그레이드 중인 건물도 심장 뛰기).
   연구가 시작되면 그 건물이 RESEARCH_SEC 동안 뛰는 것으로 본다(정확한 연구 시간은 종류마다
   달라 어림 하나로 뭉친다). 부속 건물(머신샵 등)의 연구는 몸통 건물로 올려 붙인다. */
export const RESEARCH_SEC = 90;
export const RESEARCH_BUILDING: Record<string, string> = {
  "Terran Infantry Weapons": "Engineering Bay", "Terran Infantry Armor": "Engineering Bay",
  "Terran Vehicle Weapons": "Armory", "Terran Vehicle Plating": "Armory",
  "Terran Ship Weapons": "Armory", "Terran Ship Plating": "Armory",
  "U-238 Shells": "Academy", "Stim Packs": "Academy", "Caduceus Reactor": "Academy",
  "Restoration": "Academy", "Optical Flare": "Academy",
  "Ion Thrusters": "Factory", "Spider Mines": "Factory", "Tank Siege Mode": "Factory",
  "Cloaking Field": "Starport", "Apollo Reactor": "Starport",
  "Yamato Gun": "Science Facility", "Titan Reactor": "Science Facility",
  "Personnel Cloaking": "Science Facility", "Lockdown": "Science Facility",
  "Protoss Ground Weapons": "Forge", "Protoss Ground Armor": "Forge", "Protoss Plasma Shields": "Forge",
  "Protoss Air Weapons": "Cybernetics Core", "Protoss Air Armor": "Cybernetics Core",
  "Singularity Charge": "Cybernetics Core",
  "Leg Enhancements": "Citadel of Adun",
  "Psionic Storm": "Templar Archives", "Hallucination": "Templar Archives",
  "Khaydarin Amulet": "Templar Archives", "Maelstrom": "Templar Archives",
  "Mind Control": "Templar Archives", "Argus Talisman": "Templar Archives",
  "Gravitic Drive": "Robotics Support Bay", "Scarab Damage": "Robotics Support Bay",
  "Reaver Capacity": "Robotics Support Bay",
  "Gravitic Boosters": "Observatory", "Sensor Array": "Observatory",
  "Carrier Capacity": "Fleet Beacon", "Gravitic Thrusters": "Fleet Beacon",
  "Apial Sensors": "Fleet Beacon", "Disruption Web": "Fleet Beacon", "Argus Jewel": "Fleet Beacon",
  "Recall": "Arbiter Tribunal", "Stasis Field": "Arbiter Tribunal", "Khaydarin Core": "Arbiter Tribunal",
  "Zerg Melee Attacks": "Evolution Chamber", "Zerg Missile Attacks": "Evolution Chamber",
  "Zerg Carapace": "Evolution Chamber",
  "Zerg Flyer Attacks": "Spire", "Zerg Flyer Carapace": "Spire",
  "Metabolic Boost": "Spawning Pool", "Adrenal Glands": "Spawning Pool",
  "Muscular Augments": "Hydralisk Den", "Grooved Spines": "Hydralisk Den", "Lurker Aspect": "Hydralisk Den",
  "Pneumatized Carapace": "Hatchery", "Ventral Sacs": "Hatchery", "Antennae": "Hatchery", "Burrowing": "Hatchery",
  "Anabolic Synthesis": "Ultralisk Cavern", "Chitinous Plating": "Ultralisk Cavern",
  "Plague": "Defiler Mound", "Consume": "Defiler Mound", "Metasynaptic Node": "Defiler Mound",
  "Ensnare": "Queen's Nest", "Spawn Broodlings": "Queen's Nest", "Gamete Meiosis": "Queen's Nest",
  /* ★ 이름이 두 꼴로 갈려 있던 셋 — 표준 이름(UPGRADE_NAMES)을 함께 적는다. 연구
     기록(upsByRaw)은 normalizeUpgradeName을 지난 **표준 이름**으로 들어오므로, 위의
     복수형 철자만으로는 시타델·옵저버토리·디파일러마운드의 연구가 한 번도 안 맞았다. */
  "Leg Enhancement": "Citadel of Adun",
  "Gravitic Booster": "Observatory",
  "Defiler Energy": "Defiler Mound",
  /* 빠져 있던 연구들 — 애드온·코버트옵스에서 하는 것들이라 표에 없었고, 그래서 그
     건물을 눌러도 진행률이 안 떴다. */
  "Charon Boosters": "Machine Shop",
  "Colossus Reactor": "Physics Lab",
  "Moebius Reactor": "Covert Ops",
  "Ocular Implants": "Covert Ops",
  "EMP Shockwave": "Science Facility",
  "Irradiate": "Science Facility",
};

export const ZERG_LARVA = ["Drone", "Overlord", "Zergling", "Hydralisk", "Mutalisk", "Scourge", "Queen", "Ultralisk", "Defiler"];
export const PRODUCED_BY: Record<string, string[]> = {
  Barracks: ["Marine", "Firebat", "Medic", "Ghost"],
  Factory: ["Vulture", "Siege Tank (Tank Mode)", "Siege Tank", "Goliath"],
  Starport: ["Wraith", "Dropship", "Science Vessel", "Battlecruiser", "Valkyrie"],
  "Command Center": ["SCV"],
  Gateway: ["Zealot", "Dragoon", "High Templar", "Dark Templar"],
  "Robotics Facility": ["Shuttle", "Reaver", "Observer"],
  Stargate: ["Scout", "Corsair", "Carrier", "Arbiter"],
  Nexus: ["Probe"],
  Hatchery: ZERG_LARVA,
  Lair: ZERG_LARVA,
  Hive: ZERG_LARVA,
};

/** 건물 발자국(타일 폭·높이) — 원전 표(bwUnits.BUILDING_FOOT = units.dat tileSize)를
 *  그대로 쓴다. 건설 커맨드의 좌표는 발자국의 왼쪽 위 타일이라(스크렙) 그대로 앵커에
 *  놓으면 건물마다 반 발자국씩 왼쪽 위로 치우친다(지적: "맵 안의 요소들은 또 맵의
 *  왼쪽으로 살짝 치우쳤어") — 반 발자국을 더해 가운데에 그린다.
 *  ★ 여기 손으로 적어 두었던 표는 셋이 어긋나 있었다(건물 틈 조사에서 드러났다):
 *    플릿비콘 4×3 → 3×2, 폴백 3×2로 떨어지던 인페스티드 커맨드 4×3·디파일러 마운드 4×2.
 *    자리 계산이 반 타일씩 밀려 있었다는 뜻이다. 이제 표는 한 곳(bwUnits)뿐이다. */
export const FOOTPRINT: Record<string, [number, number]> = {
  ...BUILDING_FOOT,
  // screp가 쓰는 변형 이름 — 원전 표의 같은 건물로 잇는다.
  ComSat: BUILDING_FOOT["Comsat Station"],
};
export const footDx = (unit: string): number => (FOOTPRINT[unit] ?? [3, 2])[0] / 2;
export const footDy = (unit: string): number => (FOOTPRINT[unit] ?? [3, 2])[1] / 2;

/** 건물 전용 도형(요청) — 파일런 마름모·서플 사다리꼴·벙커 무덤·커맨드 큰 무덤·넥서스
 *  큰 피라미드·게이트 삼각형·해처리 거꾸로 T·레어 육각별·하이브 육각형.
 *  이모지·글꼴 글리프가 아니라 벡터로 직접 그린다(요청) — 이모지는 제 색을 고집해 유저
 *  색을 못 입고, 글꼴 도형은 글꼴마다 크기·잉크가 다르다. currentColor를 채우므로 색은
 *  글자와 똑같이 탄다. 커맨드/넥서스/해처리 계열은 본진 크기(-hall)라 벙커의 작은 무덤과
 *  구분된다. 나머지 건물은 ■/▲/★ 기본 규칙 그대로다. */
export const SHAPE_KIND: Record<string, string> = {
  // 벙커는 납작한 무덤, 포토캐논은 납작한 태엽(요청) — 커맨드의 큰 무덤과 갈린다.
  // 성큰은 동그라미에 가시, 터렛은 네모 위에 기울어진 네모(요청).
  Pylon: "diamond", "Supply Depot": "trapezoid", Bunker: "tombFlat", "Photon Cannon": "coil",
  // 스포어는 봉오리 머리에 밑동 촉수(요청: 게임 스크린샷 참고).
  "Sunken Colony": "sunken", "Spore Colony": "spore", "Missile Turret": "turret",
  "Creep Colony": "creep",
  // 넥서스는 넙적한 세모+양옆 기둥, 게이트는 원 위의 가파른 삼각(요청).
  "Command Center": "tomb", Nexus: "pyramidWide", Gateway: "gate",
  /* 저그 본진 3형제(요청) — 해처리는 곡선 둔덕(각진 T는 부자연스럽다는 지적), 레어는
     그 둔덕의 바닥에 뿔, 하이브는 더 높은 뿔에 안쪽 가시까지 — 단계가 오를수록 뿔이
     자란다. */
  Hatchery: "hatchery", Lair: "lair", Hive: "hive",
  "Spawning Pool": "pool",
  /* 다른 생산 건물도 원래 실루엣을 살린 벡터로(요청) — 배럭은 측면에서 본 정육면체(요청),
     팩토리는 8각 단면 각기둥(스크린샷), 스타포트는 원형 착륙 패드(스크린샷 — 종이비행기
     설명은 오해), 로보틱스는 돔, 스타게이트는 문(아치). */
  Barracks: "cube", Factory: "factory", Starport: "plane",
  "Robotics Facility": "dome", Stargate: "arch",
  // 애드온(요청: 부속건물 전부 모델링) — 여섯 다 제 모델이다.
  // screp가 쓰는 변형 이름(v2 트랙: ComSat·Queens Nest)도 같은 모델로 받는다(지적:
  // 모델 없는 건물이 네모로 나옴).
  ComSat: "comsat", "Queens Nest": "queensnest",
  "Comsat Station": "comsat", "Nuclear Silo": "nsilo",
  "Machine Shop": "mshop", "Control Tower": "ctower",
  "Covert Ops": "covert", "Physics Lab": "physlab",
  // 가스 건물 셋(실물 참고) — 종족별 정제소. 크기는 발자국(4×2)이 맞춘다.
  Refinery: "refinery", Assimilator: "assim", Extractor: "extract",
  // 업그레이드·테크 건물들(요청: 다 만들자).
  Academy: "academy", "Engineering Bay": "ebay", Armory: "armory", "Science Facility": "scifac",
  Forge: "forge", "Cybernetics Core": "cyber", "Citadel of Adun": "citadel",
  "Templar Archives": "archives", "Robotics Support Bay": "robobay", Observatory: "observatory",
  "Fleet Beacon": "fleetbeacon", "Arbiter Tribunal": "tribunal", "Shield Battery": "sbattery",
  "Evolution Chamber": "evo", "Hydralisk Den": "hydraden", Spire: "spire", "Greater Spire": "gspire",
  "Queen's Nest": "queensnest", "Defiler Mound": "dmound", "Ultralisk Cavern": "cavern",
  "Nydus Canal": "nydus",
};
export const SPIN_STEPS = 8;
/* 공격 컷 둘(요청: "질럿 공격 모션 변경 … 왼칼 수평으로 잽-오른칼 수평으로 잽-잠깐 쉼
   … 프레임이 좀더 필요할듯") ────────────────────────────────────────────────────
   컷 2(공격)만으로는 한 동작밖에 못 그린다 — 요청은 **좌우가 번갈아 나가는** 두
   동작이라 컷이 하나 더 필요하다. 그래서 공격 자세를 셋으로 나눈다:
     · 2 — 겨눔(양팔을 직각으로 굽혀 든 채 대기). 사이사이의 '잠깐 쉼'이 이 컷이다.
     · 4 — 왼칼을 수평으로 뻗어 잽.
     · 5 — 오른칼을 수평으로 잽.
   그리는 쪽이 쿨다운 위상으로 4 → 2 → 5 → 2를 돌린다(아래 pose 고르기).
   판은 종류마다 세 벌이 더 구워질 뿐이고, 한 유닛이 찍는 판은 여전히 한 장이다. */
export const POSE_ATK_L = 4;
export const POSE_ATK_R = 5;
/** 이 종류가 어떤 컷을 갖나 — move: 이동 컷 · atk: 공격 컷. 없는 종류는 컷이 없다.
 *  티가 가장 많이 나는 순서로 붙인다(요청) — ① 테란 보병류 ② 프로토스 인간형·드라군
 *  ③ 저그 지상. 재작도가 아직 안 끝난 종류(저글링·퀸·디바우러·아비터)와 리버는 여기
 *  안 넣는다(요청) — 모델이 바뀔 것에 컷부터 붙이면 두 번 일이다. */
/* 나는 것은 **멈춰 있어도 날개를 친다**(요청: 뮤탈·디바우러) — 걸음(move)은 자취가
   움직일 때만 트는 컷이라 제자리에 뜬 비행체는 굳어 버린다. flap은 그 조건을 안 보고
   초당 몇 번인지(Hz)만 받아 늘 두 컷을 오간다. 컷 자체는 걸음과 같은 1↔3이라 빌더는
   walkDir() 하나만 읽으면 된다. */
export const POSE_KINDS: Record<string, { move?: boolean; atk?: boolean; flap?: number;
  /** 추진체 불꽃(요청: 비행체는 이동할 때만 불꽃) — 걸음 컷이 없는 비행체는 이동 중이면 자세 1을 고정으로 받는다. */
  thrust?: boolean;
}> = {
  // ── 비행체: 이동 중이면 자세 1(추진체 불꽃), 아니면 0 ──
  wraith: { thrust: true }, dship: { thrust: true }, valk: { thrust: true }, bc: { thrust: true },
  scout: { thrust: true }, corsair: { thrust: true }, shuttle: { thrust: true }, carrier: { thrust: true },
  gunner: { move: true, atk: true },
  fbat: { move: true, atk: true },
  ghost: { move: true, atk: true },
  // 메딕의 모델 kind는 "inf"다(UNIT_3D: Medic → inf) — "medic"으로 적으면 안 걸린다.
  inf: { move: true, atk: true },
  /* 2차(요청 순서 ② 프로토스 인간형·드라군 ③ 저그 지상 + 발사 모션 지시) —
     재작도가 끝난 종류에만 붙인다. */
  zealot: { move: true, atk: true },   // 걸음 + 검 찌르기
  dtemp: { move: true, atk: true },    // 걸음 + 검 썰기
  // 드라군은 대각 짝 다리가 번갈아 나간다(요청), 히드라는 꼬리가 호로 휜다(요청).
  goon: { move: true, atk: true },
  hydra: { move: true, atk: true },
  // 리버 — 다리로 걷지 않는다. 몸을 구부렸다 폈다 하며 민다(요청).
  reaver: { move: true },
  // 하템은 평소 팔을 내리고 공격에만 든다(요청). 아콘은 팔을 들어 번개를 놓는다(요청).
  htemp: { atk: true },
  archon: { atk: true },
  /* 나는 저그 둘 — 날개막이 늘 친다(요청). 뮤탈은 잰 날갯짓, 디바우러는 덩치가 커
     느릿하다. 공격 컷은 뮤탈이 글레이브를 던지고 디바우러가 산을 뱉는 그 반동이다. */
  // 걷는 것 넷을 더한다(요청) — 울트라·디파일러·골리앗·럴커.
  ultra: { move: true, atk: true },
  defiler: { move: true },
  goliath: { move: true, atk: true },   // 걸음 + 포신 앞뒤 반동(요청)
  /* 탱크는 **포탑 판**만 컷을 갖는다(요청: "탱크도") — 차체 판(tankbody)은 궤도+차체
     라 컷이 없고, 그것까지 표에 넣으면 같은 그림만 두 벌 굽는다. 포탑 op의 자세는
     아래 그리는 쪽이 발포 박자(fireK)로 따로 세운다. */
  tankgun: { atk: true },
  tanksiegegun: { atk: true },
  /* atk 컷(4·5)은 **버로우 파기**다(요청: 럴커는 가라앉는 게 아니라 제자리에서 앞다리 넷이 빠르게 땅을 판다) — 선 럴커는
     공격이 없으니 그 두 컷이 비어 있다. 공격 자세 고르기(fighting)에서는 lurker를 뺀다. */
  lurker: { move: true, atk: true },
  /* 뮤탈 3.2 → 1.8 → **2.4Hz**(지적: "조금 더 빠르게 되돌리기") ────────────────────
     1.8로 내린 것은 컷이 둘뿐이던 시절의 처방이다. 두 컷은 위·아래를 **뒤집을** 뿐이라
     빠르면 떨림으로 읽혔고, 그래서 3.2 → 1.8로 늦춰 떨림을 눌렀다. 이제 가운데를
     지나가므로(FLAP_CYCLE) 같은 박자가 훨씬 느긋해 보인다 — 늦춘 까닭이 사라졌다.
     3.2로 다 되돌리지는 않는다: 컷이 넷이라 초당 갈아 끼우는 횟수는 이 값의 **네 배**다
     (2.4면 9.6번). 그 위로는 재생기의 그리기 주기(30Hz)에 컷이 묻히기 시작한다.
     디바우러(1.7)는 그대로 둔다 — 덩치가 커 느릿한 것이 결이다. */
  muta: { flap: 2.4, atk: true },
  devourer: { flap: 1.7, atk: true },
  zling: { move: true, atk: true },    // 다리 교차 + 낫팔 내리침
  /* (걷어냄) tankbody·tanksiegebody — "포신 앞뒤 이동"으로 적어 두었지만 그 두 판은
     궤도+차체라 포신이 없고, 반동은 이미 **op 자리 밀기**가 한다(포탑 판을 0.09타일
     뒤로 민다). 표에 남겨 두면 그림이 같은 판만 두 벌 굽는다. */
};
/* ★ 컷 고르기를 **한 곳에서 낸다**(지적: "왜 도록에서 변한 것처럼 안 보이고 특히
   다크템플러는 뒤에서만 깔짝 움직이지") ────────────────────────────────────────────
   까닭이 여기 있었다. 박자를 **두 곳이 따로** 적고 있었다 — 재생기는 제 고리 안에서,
   도록은 제 화면 안에서. 그래서 재생기에 컷을 더해도 도록은 옛 박자를 그대로 돌렸다.
   더 나쁜 것은 도록이 공격을 `2 ↔ 0`으로만 돌린다는 점이다: 다크의 들기(4)·후려침(5)은
   **도록에 나온 적이 없다.** 그 상태에서 내가 컷 2를 '들기'에서 '가운데'로 바꿨으니,
   도록의 다크는 오히려 **전보다 덜 움직이게** 됐다. 지적한 그 증상이 내가 만든 것이다.
   두 벌로 두면 반드시 또 갈린다. 박자를 여기서 내고 두 곳이 이것만 부른다. */
/* 날갯짓 한 바퀴 — 위 → 가운데 → 아래 → 가운데(가운데를 지나야 '치는 동작'이 된다).
   ★ 가운데를 **포즈 0이 아니라 4**로 잡는다(지시: "정지 상태에선 날개가 들려 있지 않고
     몸 쪽에 내려앉아 있으면 돼") — 포즈 0은 '정지'다. 그 둘을 한 컷으로 겸하면 정지를
     내려앉히는 순간 날갯짓의 가운데까지 함께 내려앉아, 치는 동작이 '아래에서 위로 한 번'
     이 되어 버린다. 쉼과 가운데는 **다른 자세**이므로 다른 컷이라야 한다.
     4는 좌·우 잽(POSE_ATK_L) 자리인데 나는 저그 둘은 그 컷을 안 쓴다 — 비어 있는 칸을
     빌린다. 굽는 컷이 하나 늘 뿐이고, 그 둘뿐이라 값이 싸다. */
/* ★ 위·아래에 **각각 두 칸**, 그 사이에 가운데 한 칸(지시: "위 아래 2 중간에 가운데 1")
   ─────────────────────────────────────────────────────────────────────────────────
   앞 차례는 [위, 가운데, 아래, 가운데]라 **시간으로는** 위와 아래가 1:1로 공평했다.
   그런데 눈에는 안 그랬다(지적: "아래에 있는 시간이 위에 있는 시간보다 훨씬 짧은 듯").
   까닭은 컷의 생김새다 — 그림으로 맞대 보면 가운데 컷(4)은 날개가 옆으로 활짝 벌어져
   **위 컷과 한 덩어리로 읽히고**, 아래 컷(3)만 날개를 몸에 딱 접어 확연히 다르다.
   그러니 네 칸 가운데 셋이 '위'로 보이고 아래는 하나뿐이었다. 시간이 아니라 **읽히는
   몫**이 3:1이었던 것이다.
   그래서 위와 아래를 각각 두 칸으로 늘리고 가운데는 둘 사이를 잇는 한 칸으로 둔다.
   이제 읽히는 몫이 2:2로 같고, 가운데는 '지나가는 자리'라는 제 뜻대로 짧다.
   ★ 한 바퀴의 **박자는 안 바뀐다** — 칸 수를 길이에서 읽으므로(아래 n9) 여섯 칸이
     여전히 1/hz 초에 한 바퀴다. 붙어 있는 같은 컷 둘은 그림이 안 바뀌므로 실제로
     갈아 끼우는 횟수도 예전과 같은 네 번이다(2.4Hz면 초당 9.6번). */
export const FLAP_CYCLE: readonly (1 | 3 | 4)[] = [1, 1, POSE_ATK_L, 3, 3, POSE_ATK_L];
export function flapCutOf(hz: number, t: number): 1 | 3 | 4 {
  const n9 = FLAP_CYCLE.length;
  return FLAP_CYCLE[Math.floor(t * hz * n9) % n9];
}
/** 공격 한 바퀴의 컷 — `ph`는 쿨다운 안의 위상(0~1)이다.
 *
 *  종류마다 결이 다르다: 질럿은 짧은 잽 둘, 다크는 크게 한 번, 고스트는 총을 꺼냈다
 *  넣는다. 나는 저그(flapHz)는 쏘지 않는 위상에 **기본 자세가 아니라 날갯짓**으로
 *  돌아간다 — 공중의 몸에게 기본 자세는 쉬는 것이 아니라 떨어지는 것이다. */
export function atkCutOf(
  kindMain: string, ph: number, flapHz?: number, t = 0,
): 0 | 1 | 2 | 3 | 4 | 5 {
  /* 질럿 — 왼칼 잽 · 겨눔 · 오른칼 잽 · 쉼(요청). 잽은 짧고 쉼이 길다. */
  if (kindMain === "zealot") {
    if (ph < 0.22) return POSE_ATK_L;
    if (ph < 0.34) return 2;
    if (ph < 0.56) return POSE_ATK_R;
    return 2;
  }
  /* 다크 — 들기(30%) → 지나감(7%) → 후려침(11%) → 쉼. 가운데를 넣되 치는 몫은 그대로
     짧게 둔다: 검이 호를 지나가는 것은 보여야 하지만 '쏵'은 짧아야 힘이 실린다. */
  if (kindMain === "dtemp") {
    if (ph < 0.30) return POSE_ATK_L;
    if (ph < 0.37) return 2;
    if (ph < 0.48) return POSE_ATK_R;
    return 0;
  }
  /* 고스트 — 반쯤 → 겨눔(35%) → 반쯤 → 등에 멤. 오가는 길이 양쪽에 다 있어야
     '꺼냈다'와 '넣었다'가 둘 다 읽힌다. 겨누는 몫은 안 줄인다(사격이 성겨 보인다). */
  if (kindMain === "ghost") {
    if (ph < 0.10) return POSE_ATK_L;
    if (ph < 0.45) return 2;
    if (ph < 0.55) return POSE_ATK_L;
    return 0;
  }
  /* 메딕(kind "inf") — 치료는 한 발씩 쏘는 것이 아니라 **붙어 있는 동안 죽 흐른다**.
     아래 기본 갈래(쿨다운의 35%만 컷 2)를 그대로 태우면 팔이 펌프질하듯 떨렸다 —
     메딕에게는 쿨다운이라는 것 자체가 없다(무기가 없어 cd가 폴백 0.6초로 잡힌다).
     치료 자세를 붙잡고, 박동은 노란 불빛(ATTACK_FX "heal")이 맡는다. */
  if (kindMain === "inf") return 2;
  if (ph < 0.35) return 2;
  return flapHz ? flapCutOf(flapHz, t) : 0;
}
/** 꼴 번호 → 도형 이름 꼬리(①은 이름이 그냥 mineral이라 빈 글자다). */
export const MIN_VARIANT_TAG = ["", "b", "c"] as const;
/* (삭제·요청) 유닛 → 마커 갈래 표 — 전 유닛이 제 모델을 갖게 되어 갈래 표는 걷었다. */
/* 유닛 → 3D 상징물(요청) — 지상 유닛만(지적: 저그도 지상만). 공중은 2D 기호 그대로.
   표에 없는 지상 유닛은 기본 쐐기(wedge)로 방향만 갖는다. */
/** 몸을 안 그리는 개체 — 참값 자취에 실리지만 제 연출이 따로 있는 것들(지적: 핵
 *  탄두가 마린으로 떨어졌다). 여기 없으면 종족 폴백 모델을 뒤집어쓴다. */
export const NO_BODY_UNITS = new Set([
  "Nuclear Missile", "Scanner Sweep", "Disruption Web", "Dark Swarm",
  "Spider Mine Explosion", "Vespene Geyser",
]);
/* ★ 승하차 줄을 **안 긋는** 것들(지적: "핵탄두에도 점선이…") ────────────────────────
   참값의 '안에 들었다'(ST_INSIDE)는 수송선 탑승만 뜻하지 않는다 — 무언가의 안에 있으면
   전부 그 상태다. 그래서 상태만 보고 줄을 그으면 탑승과 무관한 것들이 딸려 온다:
     · 핵탄두 — 쏘기 전까지 **사일로 안**에 들어 있다. 몸도 없는 것이 발사 순간 줄부터
       그었다(그 낙하는 제 연출이 따로 그린다).
     · 인터셉터 — 캐리어 안팎을 쉼 없이 드나든다. 교전 한 번에 수십 줄이 된다.
     · 스캐럽 — 리버 안에 실려 있다.
   (가스 캐는 일꾼은 앞뒤 상태로 가른다 — entWalks의 rides 주석.)
   몸이 없는 것들은 이미 한 명단에 모아 두었으니(NO_BODY_UNITS) 그것을 그대로 쓰고,
   '탈것 안이 제 집'인 둘만 더한다. */
export const RIDE_TETHER_SKIP = new Set([
  "Nuclear Missile", "Scanner Sweep", "Disruption Web", "Dark Swarm",
  "Spider Mine Explosion", "Vespene Geyser",
  "Interceptor", "Scarab",
]);
export const UNIT_3D: Record<string, string> = {
  Marine: "gunner", Firebat: "fbat", Ghost: "ghost", Medic: "inf",
  // 기계·함선(요청: 만들 수 있는 건 다).
  /* 스파이더 마인(지적: "지금 마인이 안보이더라고") — 이름표가 없어 테란 폴백(gunner)
     으로 떨어졌다: 참값 자취에 제 개체로 실려 있는 마인이 **마린 모습으로** 깔려 있었고,
     정작 마인 모델은 명령 기록(casts)으로 그리는 층에서만 나왔다. 이름을 이어 준다. */
  "Spider Mine": "mine",
  Vulture: "vulture", "Siege Tank": "tank", "Siege Tank (Tank Mode)": "tank",
  "Siege Tank (Siege Mode)": "tanksiege",
  Goliath: "goliath", Reaver: "reaver", Wraith: "wraith", Battlecruiser: "bc",
  Valkyrie: "valk", "Science Vessel": "vessel",
  Mutalisk: "muta", Guardian: "guardian", Devourer: "devourer", Scourge: "scourge",
  Queen: "queen", Corsair: "corsair", Scout: "scout", Carrier: "carrier",
  Arbiter: "arbiter", Observer: "observer",
  /* 인터셉터(요청) — 여기 이름이 없어 프로토스 폴백(zealot)으로 떨어졌다. 곧 캐리어를
     쓰는 판마다 **허공에 뜬 질럿 떼**가 날아다녔다. 참값 자취에 제 태그·제 길이가
     그대로 있으니(SHAPE_BUILDERS.interceptor 주석의 실측) 이름만 이어 주면 된다. */
  Interceptor: "interceptor",
  /* 스캐럽(지적) — 여기 이름이 없어 프로토스 폴백(zealot)으로 떨어졌다. 리버가 쏠
     때마다 **작은 질럿**이 땅을 기어 표적으로 갔다. 인터셉터와 같은 사고·같은 처방. */
  Scarab: "scarab",
  /* 수송선 셋(단서: "큰 질럿들이 좀 이따 드라군으로 바뀜") — 이 셋이 표에 없어 부대
     구성의 셔틀이 종족 폴백(질럿·마린·저글링)에 폴백 덩치(대형)로, 게다가 공중이라 떠서
     그려졌다. 구성 순서가 바뀌면 그 자리가 드라군으로 바뀌는 것까지 들어맞는다. */
  Dropship: "dship", Shuttle: "shuttle", Overlord: "ovie",
  Zealot: "zealot", "Dark Templar": "dtemp", Dragoon: "goon", "High Templar": "htemp",
  Archon: "archon", "Dark Archon": "darchon",
  Zergling: "zling", Hydralisk: "hydra", Ultralisk: "ultra", Broodling: "zling",
  "Infested Terran": "zling", Lurker: "lurker", Defiler: "defiler",
  // 일꾼류는 다 직접 모델링(요청).
  SCV: "scv", Probe: "probe", Drone: "drone",
  /* 라바·알·변태 껍질(지적: "라바 위치 및 라바에서 알로 변태 거기서 유닛 태어나기까지
     다 됐지?") — 여기 이름이 없어 저그 폴백(zling)으로 떨어졌다. 곧 **해처리마다
     저글링 서넛이 꿈틀대고 있었다**. 참값 자취를 실측해 보면 이 넷은 지어낼 것이
     하나도 없는 진짜 개체다(실측 한 태그: 라바 35 → 알 36 → 히드라 38 → 럴커알 97 →
     럴커 103, 자리까지 다 실려 있다). 이름만 이어 주면 제 모습으로 선다. */
  Larva: "larva", Egg: "egg", "Lurker Egg": "lurkeregg", "Mutalisk Cocoon": "mutacocoon",
};
/** 종족 → 일꾼 상징물 — 유닛 이름이 없는 일꾼 점(정찰·채굴)용. */
export const workerKindOf = (race?: string): string =>
  race === "테란" ? "scv" : race === "저그" ? "drone" : "probe";
/** 이름 → 종족(지적: "토스가 드론 든 오버로드를 마인드 컨트롤했는데 드론이 프로브로, 공사 표시도
 *  소환구로 나온다") — 여태 몸·공사·죽음·피격의 종족은 **임자의 종족**이었다. 마인드 컨트롤로
 *  임자가 바뀐 개체(와 그 드론이 지은 건물)는 임자 종족과 제 종족이 다르다. 이름을 알면 이름이
 *  종족이고, 이름 없는 개체(무명 일꾼 점)만 임자 종족으로 떨어진다. */
const RACE_OF_NAME9: Record<string, "테란" | "저그" | "프로토스"> = {};
for (const n of ["Larva", "Egg", "Drone", "Overlord", "Zergling", "Hydralisk", "Mutalisk", "Scourge", "Queen",
  "Ultralisk", "Defiler", "Guardian", "Devourer", "Lurker", "Broodling", "Infested Terran", "Lurker Egg",
  "Mutalisk Cocoon", "Cocoon", "Hatchery", "Lair", "Hive", "Extractor", "Spawning Pool", "Evolution Chamber",
  "Hydralisk Den", "Spire", "Greater Spire", "Queen's Nest", "Nydus Canal", "Ultralisk Cavern", "Defiler Mound",
  "Creep Colony", "Sunken Colony", "Spore Colony", "Infested Command Center"]) RACE_OF_NAME9[n] = "저그";
for (const n of ["Probe", "Zealot", "Dragoon", "High Templar", "Dark Templar", "Archon", "Dark Archon", "Reaver",
  "Scarab", "Observer", "Shuttle", "Scout", "Corsair", "Carrier", "Interceptor", "Arbiter", "Nexus", "Pylon",
  "Assimilator", "Gateway", "Forge", "Photon Cannon", "Cybernetics Core", "Shield Battery", "Robotics Facility",
  "Stargate", "Citadel of Adun", "Robotics Support Bay", "Fleet Beacon", "Templar Archives", "Observatory",
  "Arbiter Tribunal"]) RACE_OF_NAME9[n] = "프로토스";
for (const n of ["SCV", "Marine", "Firebat", "Ghost", "Medic", "Vulture", "Vulture Spider Mine", "Siege Tank",
  "Siege Tank (Tank Mode)", "Siege Tank (Siege Mode)", "Goliath", "Wraith", "Dropship", "Science Vessel", "Battlecruiser",
  "Valkyrie", "Nuclear Missile", "Command Center", "Comsat Station", "Nuclear Silo", "Supply Depot", "Refinery",
  "Barracks", "Academy", "Factory", "Machine Shop", "Starport", "Control Tower", "Science Facility", "Covert Ops",
  "Physics Lab", "Engineering Bay", "Armory", "Missile Turret", "Bunker"]) RACE_OF_NAME9[n] = "테란";
export const raceOfName9 = (u: string | undefined): "테란" | "저그" | "프로토스" | undefined =>
  u ? RACE_OF_NAME9[u] : undefined;
/** 짐을 진 일꾼의 **몸** 판 — 미네랄이든 가스든 자세가 같으므로 한 벌이다(위 ★). */
export const workerBodyKind = (base: string, st: number | null): string =>
  (st === ST_CARRY_MIN || st === ST_CARRY_GAS ? `${base}Hold` : base);
/** 그 위에 겹쳐 찍을 **짐** 판 — 없으면 undefined다. */
export const workerAttachKind = (base: string, st: number | null): string | undefined => {
  if (st !== ST_CARRY_MIN && st !== ST_CARRY_GAS) return undefined;
  const b9 = base.charAt(0).toUpperCase() + base.slice(1);
  return `load${b9}${st === ST_CARRY_MIN ? "Min" : "Gas"}`;
};
/* 기본 쐐기도 폐기(요청) — 표에 없는 낯선 유닛은 그 종족의 기본 보병 꼴로 그린다. */
/* 유닛별 전투 효과(요청: 불 말고 무기 특성) — 근접은 없음. */
/* 무기 세분화(재지적: 이왕 한 거 세분화) — 드라군은 포톤캐논과 같은 광자포(photon),
   커세어는 광자 집중 지지기(flare), 배틀·레이스는 광선 뾱뾱(laser, 레이스·골리앗은
   공중 상대면 미사일 — 그리는 쪽에서 가른다), 캐리어는 두두두두 다발총(burst), 아콘은
   번개 줄기 지지기(zap), 뮤탈은 가시 투척(glave를 투척 다트로), 럴커는 초록 줄이 아닌
   가시(spike), 가디언은 노란 독구체(acidball). 템플러는 물리 공격이 없고(스톰은 캐스트
   가 따로 그린다) 스커지는 자폭(죽음이 곧 공격)이라 뺀다. */
/* 갈래는 **무기의 결**로 나눈다(요청: "트레이서 세분화") — 같은 총이라도 지상·대공이
   갈리는 종류(레이스·골리앗·스카우트)는 아래 렌더가 표적의 공중 여부로 갈아 끼운다.
     gun 짧은 노란 빛(마린·고스트·벌처·골리앗 지상·벙커) · heal 노란 작은 동그란 빛(메딕)
     missile 연기 낀 길고 흰 빛(레이스·발키리·골리앗 대공·스카우트 대공·터렛)
     spine 중간 길이 형광 녹색(히드라) · spike 갈색 길고 가는 가시(럴커·성큰)
     flame 중간 길이 붉고 두꺼운 화염(파이어뱃) · plasma 길게 늘어진 플라즈마(드라군·포톤)
     venom 노랑-연두 독구슬(가디언·스포어) · acid 두껍고 연기 낀 보라(디바우러)
     cannon 짧고 두꺼운 주황(탱크 모드) · siege 굵고 긴 주황(시즈 모드) */
export const ATTACK_FX: Record<string, string> = {
  Marine: "gun", Ghost: "gun", Goliath: "gun", Wraith: "laser",
  /* 벌처는 제 무기다(요청: "벌처는 은회색 삼각쐐기") — 총구 갈래(gun)에 묶여 있었는데
     원작의 파편탄은 눈에 보이게 날아가는 탄이다. */
  Vulture: "frag",
  Battlecruiser: "laser", "Siege Tank": "cannon", "Siege Tank (Tank Mode)": "cannon",
  "Siege Tank (Siege Mode)": "siege", Firebat: "flame", Medic: "heal",
  Hydralisk: "spine", Lurker: "spike", Mutalisk: "glave", Devourer: "acid",
  Guardian: "venom", Queen: "acid", Valkyrie: "missile",
  /* 아비터는 **광전자포와 같은 결**이다(요청: "광전자포 사용하면 됨") — 위상 분열포는
     드라군·포톤과 한 갈래의 푸른 플라즈마 탄이다. 옛 "bolt"는 날아가는 탄이 아니라
     제자리 번쩍임이라(PROJECTILE_FX 밖) 무엇이 날아가 맞았는지가 안 읽혔다. */
  Dragoon: "plasma", Scout: "plasma", Corsair: "flare", Arbiter: "plasma", Carrier: "burst",
  Archon: "zap",
  /* ★ 리버는 **제 트레이서가 없다**(지적: "리버 스캐럽은 길을 찾아서 가는 특징도 있음")
     ─────────────────────────────────────────────────────────────────────────────────
     여기 있던 "cannon"은 총구에서 표적까지 곧게 날아가는 포탄이다. 리버가 쏘는 것은
     포탄이 아니라 **스캐럽**이고, 스캐럽은 제 발로 길을 찾아 굴러간다 — 언덕을 돌아가는
     그 몸을 곧은 선으로 그리면 벽을 뚫고 날아가는 그림이 된다.
     그 몸은 이제 참값 자취대로 저 스스로 굴러간다(SHAPE_BUILDERS.scarab) — 그것이 곧
     이 무기의 트레이서다. 여기에 선을 하나 더 그으면 같은 사격이 두 벌이 되고, 그중
     한 벌은 거짓말이다. 캐리어의 인터셉터와 같은 결이다. */
  /* 인터셉터도 제 무기를 갖는다(펄스 캐논) — 이제 참값 자취로 저 스스로 날아다니므로
     캐리어의 장식이 아니라 쏘는 유닛이다. */
  Interceptor: "gun",
  /* 근접은 효과를 안 그린다(요청: 휘두름 호 제거) — 대신 몸이 표적 쪽으로 툭 나갔다
     빠지는 잽으로 때리는 것을 보인다(MELEE_JAB_SEC). 그림 없는 동작이 호보다 읽기
     쉽고, 무엇보다 옆에 뜬 부메랑처럼 보이지 않는다. */
};
/** 쏘는 쪽에 **아무것도 안 그리는** 무기(요청: "커세어는 트레이서가 자기 자신 쪽엔
 *  없고 대상한테 넙적한 타원 형태로 플라즈마 표시가 나와야 해") ────────────────────
 *  원작의 뉴트론 플레어는 총구에서 뻗는 선도, 날아가는 탄도 아니다 — 표적 둘레에서
 *  터지는 방전이다. 그래서 이 갈래는 총구 번쩍임(beam)도 날아가는 탄(shot)도 안 만들고,
 *  맞은 쪽의 피격 그림(FX_IMPACT)만 남긴다. 그 그림이 곧 그 무기의 전부다. */
export const NO_BEAM_FX = new Set(["flare"]);
/** 쏘는 박자에 맞춰 **표적 자리에도** 제 그림을 내는 무기(지적: "아콘 스플래시 안 나와")
 *  ────────────────────────────────────────────────────────────────────────────────
 *  맞는 쪽 그림(FX_IMPACT)은 원래 **맞은 몸의 체력이 실제로 줄어든 순간**에만 뜬다. 그런데
 *  참값의 체력은 띄엄띄엄 적히므로 대부분의 사격에는 아무것도 안 난다 — 커세어가 통째로
 *  안 보이던 그 사정이고(위 NO_BEAM_FX), 스플래시가 곧 그림인 무기는 같은 병을 앓는다.
 *  다른 점은 하나다: 커세어는 **선이 아예 없어** 표적 그림이 전부지만, 아콘은 지지는 선도
 *  있고 터지는 자리도 있어야 한다. 그래서 이 갈래는 표적 그림을 내되 **선도 그대로 그린다**.
 *  ※ 실제로 체력이 주는 순간의 그림과 같은 표(FX_IMPACT)를 쓰므로 둘이 겹쳐도 결이 같다. */
export const TARGET_FX = new Set(["zap"]);
/** 실제로 **날아가는** 무기(요청: "트레이서로 미사일을 적한테 직접 꽂아줘 할수있나?
 *  마린같이 실시간은 어쩔수 없고") ─────────────────────────────────────────────────
 *  예전에 날아가던 것을 지적("움직임 없이 유닛의 공격부에 고정되어 나타나되 방향만
 *  타겟을 향한 선")으로 전부 제자리 번쩍임으로 바꿨었다. 이번 요청이 그 절반을 되돌린다 —
 *  되돌리는 것은 **진짜 탄이 날아가는 무기**뿐이고, 총알·광선처럼 사실상 즉발인 것은
 *  그대로 번쩍인다("마린같이 실시간은 어쩔수 없고"가 그 선이다).
 *  여기 드는 갈래: 히드라 가시·뮤탈 글레이브·드라군 플라즈마·미사일·독구체·포탄. */
export const PROJECTILE_FX = new Set([
  "spine", "glave", "acid", "venom", "missile", "missileG", "plasma", "cannon", "siege", "frag",
  // 레이저(배틀크루저·레이스 지상) — 짧은 광탄이 날아가 꽂힌다(그 표의 ★).
  "laser",
]);
/** 탄이 나는 속도(타일/초) — 원작 자료에 탄속 표가 없어 눈으로 읽히는 값으로 잡는다
 *  [어림]. 너무 느리면 궤적이 줄줄이 늘어서고, 너무 빠르면 즉발과 구분이 안 된다. */
export const SHOT_TILES_PER_SEC = 14;
/* (걷어냄) 변태 중 모습 — '태어난 뒤 40초 동안은 럴커 알·번데기 고치를 그린다'는
   어림이었다. 개체 기록에 껍질이 안 남던 시절의 대역이다.
   참값에는 껍질이 **제 유닛으로** 실린다(럴커 알 97 · 뮤탈 고치 59). 게다가 태그가
   같아 한 몸의 다음 시절로 이어진다 — 실측: 태그 10462가 라바 → 알 → 히드라 →
   럴커 알 → 럴커로 갈아입는다. 그러니 어림을 그대로 두면 **껍질을 두 번** 그린다:
   참값이 낸 진짜 껍질이 지나간 뒤, 갓 깨어난 럴커를 40초 더 알로 덮었다. */
/** 사주경계를 하는 정체([어림] — 위 bodyHdg 주석) — 커뮤니티 문서가 확인해 주는 보병만.
 *  차량·기계·일꾼·공중은 원작에서도 제자리에서 두리번거리지 않는다. */
/* 테란 바이오닉(요청: 사망 효과 "바이오닉-빨강 … 메카닉-주황폭발") — 살로 된 몸은
   터지는 것이 아니라 피가 튄다. 저그·프로토스는 종족 자체가 결을 정하므로 이 명단은
   테란에만 물어본다. SCV는 기계를 입은 사람이라 원작에서도 피가 튄다. */
export const BIONIC_UNITS = new Set(["Marine", "Firebat", "Medic", "Ghost", "SCV"]);
export const IDLE_SCAN = new Set(["Marine", "Firebat", "Ghost", "Medic", "Zergling", "Hydralisk", "Zealot"]);
/** 두리번 주기(초) — [어림]. iscript의 wait 값을 못 읽어 눈대중으로 잡은 박자다. */
export const IDLE_SCAN_SEC = 3.2;
/* (걷어냄) MELEE_JAB_SEC — 근접 유닛이 앞으로 파고들었다 빠지는 '잽' 동작의 길이표.
   그 동작을 만들던 렌더러 교전 당김이 사라지면서(코어가 제 이동 모형으로 붙는다)
   표만 남아 있었다. */
/* 발사 지점(요청: 탱크는 포신, 히드라는 입, 마린·파뱃은 총구, 매딕은 주사기 — 효과가
   몸 중심이 아니라 제 무기 끝에서) — 트레이서를 몸 방향 축으로 이만큼(px) 앞으로 민다.
   회전 뒤 translateY라 어느 방향을 보든 정확히 총구 쪽이다. 표에 없으면 몸 가장자리
   어림(4px). 유닛별 완전 모델링(총구 화염까지 제 모델)은 다음 단계다.
   ⚠ 이 붙박이 px는 이제 **폴백일 뿐이다** — 화면 크기에 매인 값이라 지도가 작을수록
   몸에서 멀리 떨어진다(725px 지도에서 5px = 0.9타일, 폰의 340px 지도에서는 1.9타일).
   앵커가 있는 유닛은 MUZZLE_ANCHOR, 방어 건물은 BLD_MUZZLE이 제 모델의 포구를 준다. */
export const MUZZLE_PX: Record<string, number> = {
  "Siege Tank": 8, "Siege Tank (Tank Mode)": 8, "Siege Tank (Siege Mode)": 10,
  Hydralisk: 5, Marine: 4, Firebat: 4, Ghost: 5, Vulture: 5, Goliath: 6,
  Wraith: 6, Battlecruiser: 9, Valkyrie: 6,
  Dragoon: 6, Zealot: 3, Archon: 6, Reaver: 7, Scout: 6, Corsair: 5, Carrier: 9, Arbiter: 6,
  Zergling: 3, Lurker: 6, Mutalisk: 5, Guardian: 6, Devourer: 6, Queen: 5, Ultralisk: 5,
  "Photon Cannon": 6, "Sunken Colony": 5, "Missile Turret": 7, Bunker: 6,
  "Spore Colony": 5,
};
/** 제 힘으로 쏘는 방어 건물 — 사거리·표적 갈래는 저마다 아래 방어 사격에서 갈린다. */
export const DEF_FIRE = new Set([
  "Missile Turret", "Bunker", "Photon Cannon", "Sunken Colony", "Spore Colony",
]);
/* 총구 모델 앵커(요청: 오프셋 표 말고 모델별로 — 승인) — 모델 공간 [x(우), y(앞), z(위)].
   트레이서가 몸 중심이 아니라 이 점의 '투영 자리'에서 시작한다: 요잉 버킷·시각 밀림·
   피칭까지 스프라이트 굽기와 같은 변환(project)을 태우므로 어느 방향을 보든 정확히 그
   부위(탱크 포신·히드라 입·마린 총구·매딕 주사기)다. 좌표는 각 빌더의 해당 부품
   좌표에서 따 왔고(마린·고스트는 빌더의 총구 캡 그대로), 표에 없는 유닛만 예전 픽셀
   오프셋(MUZZLE_PX)으로 물러난다. */
export const MUZZLE_ANCHOR: Record<string, [number, number, number]> = {
  gunner: [0.15, 2.7, 3.35], ghost: [0.4, 3.6, 3.42], fbat: [0.52, 3.4, 3.15],
  inf: [1.22, 2.05, 3],
  // 탱크 둘은 포탑을 원점에 맞추며 포신이 옮겨졌다(위 tankTurret·siegeTurret 주석) —
  // 값은 새 포신 끝(평시 쌍포신 y 5.95·z 3.75, 시즈 소염기 y 6.85·z 5.9)이다.
  tank: [0.42, 3.5, 3.2], tanksiege: [0, 4.8, 4.4],
  /* 골리앗 [1.4, 2.2, 3.4] → [0, 2.9, 5.62] — 옛 값은 지금 모델에서 **무릎 높이**(z 3.4)의
     허공이었다. 총열은 z 5.62에 있고, 미사일은 좌우 두 줄기로 갈라져 나가므로(lanes9)
     앵커는 몸 한가운데여야 두 발이 양 포드에 하나씩 선다 — x를 0으로 옮긴 까닭이다. */
  goliath: [0, 2.9, 5.62],
  vulture: [0, 3.4, 2.6], wraith: [0, 3.1, 3.88], bc: [0, 4.6, 3.8],
  /* 발키리는 **몸 가운데**에서(지적: "나오는 위치가 안맞고") — x 0.9는 오른쪽 발사관
     하나를 짚은 값이라, 어느 요잉에서는 미사일이 몸 옆 허공에서 났다. 발키리는 좌우
     발사관이 함께 뿜으므로 가운데가 두 줄기의 대표다. */
  valk: [0, 3.4, 5.6],   // 부리 끝
  hydra: [0, 2.6, 4.2], lurker: [0, 3, 2.2], muta: [0, 3, 3], queen: [0, 3, 3],
  guardian: [0, 3.2, 2.8], devourer: [0, 3.2, 2.8], ultra: [0, 3.6, 3.4],
  goon: [0, 3.2, 3.6], zealot: [0.8, 2.4, 3],
  /* ★ 아콘은 **앞으로 안 내민다**(지적: "플라즈마의 시작부가 아콘 쪽이 아니고 표적에
     따라 움직여서 … 한 번 나갔으면 안 움직일걸, 원작은") ───────────────────────────
     이 앵커는 몸의 방향을 따라 투영된다 — 포신이 달린 몸에는 맞는 규약이다(포신은 겨눈
     쪽으로 돌아가니까). 그런데 아콘은 **포신이 없는 에너지 덩이**라 겨눈다는 것이 몸의
     어느 점도 옮기지 않는다. 앞 몫(2.2)을 두면 그 점이 표적을 따라 몸 둘레를 돌아,
     번개가 아콘에서 나가는 것이 아니라 아콘 옆을 스치는 그림이 된다.
     앞을 0으로 두면 남는 것은 높이뿐이라 시작점이 **핵의 한가운데**에 못 박힌다 —
     표적이 어디로 돌든 안 움직인다. */
  archon: [0, 0, 4.4], reaver: [0, 3.6, 2.4],
  scout: [0, 3.4, 3], corsair: [0, 3.2, 3], carrier: [0, 4.4, 3.6], arbiter: [0, 3.4, 3.4],
};
/* 방어 건물의 총구 앵커 — 모델 이름(SHAPE_KIND) → 모델 공간 [x(우), y(앞), z(위)].
   좌표는 저마다 제 빌더에서 따 왔다: 포톤은 가운데 포탑 꼭대기의 주사바늘(hornFaces
   끝 z 7.6), 성큰은 가운데 촉수의 아가리(capFace discPath3(0.35, 0.15, 3.7)), 스포어는
   알덩이 앞면의 아가리, 터렛은 미사일 포드 꼭대기(pvt(1.9, 5) → y 0.67·z 8.5), 벙커는
   앞면 총안 셋(y 2.62·z 0.9~1.5)의 가운데.
   유닛과 갈래가 다른 표를 따로 두는 까닭은 좌표계가 다르기 때문이다 — 유닛은 16-상자
   가운데(8,8)가 앵커지만 건물은 발자국 바닥 가운데(8,16)가 앵커다. */
export const BLD_MUZZLE: Record<string, [number, number, number]> = {
  coil: [0, 0, 7.2], sunken: [0.35, 0.15, 3.7], spore: [-0.35, 2.6, 2.5],
  // 터렛 z 8.2 → 10.8(요청: 밑받침 1.5배 + 포드 여유) — 새 포드 꼭대기 pvt(1.9, 5)다.
  turret: [2.2, 0.6, 10.8], tombFlat: [0, 2.7, 1.2],
};
/** 모델 앵커의 16-상자 투영 좌표 — 스프라이트와 **같은** 버킷·밀림·피칭·부감으로
 *  투영한다(굽기와 한 글자라도 다르면 앵커가 제 부품을 벗어난다). */
export function anchorPoint(
  a: readonly [number, number, number], rotDeg: number | undefined,
  viewYaw: number | undefined, pitch: boolean, flat = false,
): [number, number] {
  const vq = viewYaw ? Math.max(-36, Math.min(36, Math.round(viewYaw / 6) * 6)) : 0;
  const bucket = rotDeg !== undefined ? ((Math.round(rotDeg / 22.5) * 22.5) % 360 + 360) % 360 : 0;
  const sh = Math.tan((vq * Math.PI) / 180);
  const run0 = (): [number, number] =>
    withViewShear(sh, () => withYaw(-bucket, () => project(a[0], a[1], a[2])));
  const run = pitch ? (): [number, number] => withPitchView(run0) : run0;
  // 평면 보기는 굽기가 부감(withTopView)으로 들어간다 — 앵커도 같은 판을 타야 한다.
  return flat ? withTopView(run) : run();
}
/** 총구 앵커의 16-상자 투영 좌표(유닛) — 표에 없는 종류는 픽셀 오프셋 폴백. */
export function muzzlePoint(
  kind: string, rotDeg: number | undefined, viewYaw: number | undefined, pitch: boolean,
): [number, number] | null {
  const a = MUZZLE_ANCHOR[kind];
  return a ? anchorPoint(a, rotDeg, viewYaw, pitch) : null;
}
/** 이미 선 건물이 바뀌어 되는 건물들 — 여기 드는 공사는 고치가 **안 자란다**(지적:
 *  "드론에서 변태시엔 커져야하고 그냥 건물간 변태는 그대로"). 드론이 녹아 되는 건물만
 *  작은 고치에서 자라 오른다. 브루드워의 저그 건물 변태는 이 다섯이 전부다. */
export const BLD_FROM_BLD = new Set([
  "Lair", "Hive", "Greater Spire", "Sunken Colony", "Spore Colony",
]);
/** 드론이 **녹아서** 되는 건물 — 위 BLD_FROM_BLD의 나머지 전부다(저그 건물은 둘 중
 *  하나다). 변태 자국과 드론의 미끄럼(아래 MORPH_SLIDE_SEC)이 이 명단만 본다. */
export const BLD_FROM_DRONE = new Set([
  "Hatchery", "Extractor", "Spawning Pool", "Evolution Chamber", "Hydralisk Den",
  "Spire", "Queen's Nest", "Nydus Canal", "Ultralisk Cavern", "Defiler Mound",
  "Creep Colony",
]);
/** 드론이 고치 자리로 미끄러져 내려가는(취소면 올라오는) 시간(초) — 그리는 자리만
 *  움직이는 값이라 앞뒤 동선에는 한 톨도 안 실린다(요청: "이전/다음 동선에 영향이 없게
 *  변태/취소 딜레이에 넣어야 해"). */
export const MORPH_SLIDE_SEC = 0.34;
/** 변태·취소 자국이 남는 시간(초). */
/** 평면(2D)의 바닥 눌림 — 이 화면은 평면에서도 지면을 2:1로 눕힌다(원작 이동 마커의
 *  관례이고, 건물 접지 그림자가 쓰는 값이 이것이다). 자리 사상(posFrac)은 입체에서만
 *  원근을 실으므로, 평면에서 바닥에 눕는 것은 전부 이 값을 한 번 곱해야 같은 평면에
 *  선다. 여기 쓰는 곳: 착지 충격파. 한 곳에서만 정한다 — 두 벌로 두면 같은 바닥에
 *  누운 두 고리가 서로 다른 각으로 눕는다. */
export const GROUND_SQUISH_2D = 0.55;
/* (걷어냄) MORPH_FX_SEC — 드론 변태 자국이 살던 창(0.5초)이다. 그 자국을 걷으면서
   (요청: "건물 변태 링 효과 제거") 읽는 곳이 없어졌다. 되살릴 때 함께 되살린다. */
export const unitMarkerKind = (u: string, race?: string): string =>
  UNIT_3D[u] ?? (race === "테란" ? "gunner" : race === "저그" ? "zling" : "zealot");
/* 유닛 덩치(요청: 소형/중형/대형 크기 구분) — 브루드워의 유닛 크기 분류를 따른다.
   전수조사(요청) 결과 표가 절반쯤 비어 있었고, 빠진 유닛은 전부 대형으로 떨어졌다.
   대형 폴백은 "큰 쪽이 덜 틀린다"는 어림이었지만, 실제로는 커세어·퀸 같은 중형과
   드라군·탱크 같은 대형이 한 칸에 뭉쳐 크기로는 아무것도 구분되지 않았다. 이제 전
   유닛을 원작 분류(Small/Medium/Large) 그대로 적는다 — 폴백도 대형이 아니라 중형
   (가운데로 틀린다).
   이제 이 등급은 **화면 크기의 손잡이가 아니다** — 크기는 아래 UNIT_BW_TILES(원작
   치수)가 유닛마다 정하고, 이 표는 그 표에 이름이 없는 유닛의 폴백으로만 쓰인다.
   럴커를 대형으로 고쳐 놨던 것은 되돌렸다: 원전 `UnitType.cpp` unitSize[103]은
   Zerg_Lurker = Medium이다(원래가 맞았다). */
export const UNIT_BULK: Record<string, 0 | 1 | 2> = {
  // ── 테란 ──
  SCV: 0, Marine: 0, Firebat: 0, Ghost: 0, Medic: 0, "Spider Mine": 0,
  Vulture: 1,
  "Siege Tank": 2, "Siege Tank (Tank Mode)": 2, "Siege Tank (Siege Mode)": 2,
  Goliath: 2, Wraith: 2, Dropship: 2, "Science Vessel": 2, Battlecruiser: 2, Valkyrie: 2,
  // ── 프로토스 ──
  Probe: 0, Zealot: 0, "High Templar": 0, "Dark Templar": 0, Observer: 0, Interceptor: 0,
  Corsair: 1,
  Dragoon: 2, Archon: 2, "Dark Archon": 2, Reaver: 2, Shuttle: 2, Scout: 2,
  Carrier: 2, Arbiter: 2,
  // ── 저그 ──
  Larva: 0, Drone: 0, Zergling: 0, Mutalisk: 0, Scourge: 0, Broodling: 0,
  "Infested Terran": 0,
  Egg: 1, "Lurker Egg": 1, "Mutalisk Cocoon": 1,
  Hydralisk: 1, Queen: 1, Defiler: 1,
  /* 럴커는 원전이 중형이다 — `UnitType.cpp` unitSize[103](Zerg_Lurker) = Medium.
     여기 있던 "원작에서 대형이다(조사)"라는 주석은 원전과 반대라 지웠다. */
  Lurker: 1, Ultralisk: 2, Overlord: 2, Guardian: 2, Devourer: 2,
};

/* ── 유닛 크기의 세 층(요청: "모델 좌표를 키우는 쪽이 낫겠다. 모든 모델을 같은 크기로
   디자인해놓고 쓸 때만 크기를 달리 적용하는 것", "나중에 커스텀으로 유닛크기를 조절하기도
   쉽게", "표준은 실제 게임 크기") ────────────────────────────────────────────────
   섞으면 안 되는 두 자를 여기서 못박는다.

   ① 모델 공간(MODEL_NORM) — "모델이 제 16-상자를 얼마나 채우나". **설계 공간**의 자다.
      화면에서 몇 픽셀인지와 아무 상관이 없고, 굽기(unitSprite)와 도록(ShapeIcon)에서
      상자 한가운데를 축으로 한 번 걸린다.
   ② 화면 크기(unitTilesOf) — "화면에서 몇 타일인가". **쓰는 자리**의 자다.
      모델이 어떻게 생겼는지와 아무 상관이 없다.

   두 자가 만나는 지점이 곧 이 설계의 핵심이다:
       화면에 보이는 몸(타일) = 상자(타일) × (잉크 상자 / 16)
   그래서 상자를 `원작 치수 × 16 / 잉크 상자`로 잡으면 **보이는 몸이 정확히 원작 치수**가
   된다. 옛 설계처럼 계수 K 하나로 어림하면 모델마다 가로세로비가 달라 2.4배가 어긋난다
   (실측: 마린은 맞고 오버로드 0.67배·스카웃 1.71배). 여기서는 K를 종류마다 잰 값
   (16 / MODEL_INK)으로 나눠 그 어긋남을 0으로 만든다 — 전형값은 16/5.2 = 3.08이다.

   예전엔 이 둘이 한 몸이었다(옛 FILL_CACHE 채움 보정): 화면 크기를 정한 뒤 구운 판의
   잉크 폭을 재서 되키우는 방식이라 ⓐ 모델을 고치면 화면 크기가 따라 흔들리고 ⓑ 상한
   (1.55)에 걸린 모델은 아무리 작아도 더 못 커졌다. 다시 섞지 마라.

   화면 크기는 아래 곱셈 사슬이고, 손잡이가 층으로 갈려 있다:
     최종 타일 = 원작 치수(UNIT_BW_TILES, 자료에서 유도)
               × 16 / MODEL_INK[그리는 kind]   // 모델이 상자를 채운 몫 되돌리기
               × SPRITE_OVERHANG               // 충돌 상자 → 스프라이트 (지금 1)
               × (UNIT_SIZE_TUNE[유닛] ?? 1)   // 종류별 손보기 — 여기만 고치면 그 유닛만
               × UNIT_SIZE_GLOBAL              // 전체 배수
   그리고 SIZE_CONTRAST(시네마틱 비율)가 원작 치수 자리에 지수로 걸린다(1~1.35로 잘린다). */

/** ① 모델 공간 정규화 배수 — 상자 한가운데(8,8)를 축으로 곱한다. **화면 크기가 아니다.**
 *
 *  이 표는 **`npm run model-norm -- --emit`이 낸 값이다. 손으로 고치지 마라.**
 *  모델 면을 한 줄이라도 고쳤으면 그 명령을 다시 돌려 이 표와 MODEL_INK를 함께 갈아라
 *  (안 갈면 그 종류만 조용히 크기가 어긋난다 — 여태 그것을 알아차릴 방법이 없었다).
 *
 *  근거(scripts/model-norm.mjs 실측): 유닛 kind 49종을 **실제로 굽는 사슬 그대로**
 *  (resolveShapeFaces → lodFilter → shadeBoost) 16방향에서 구워 잉크 상자
 *  √(폭×높이)를 쟀다. 기준은 top 모드다 — `pitched`가 useState(false)라 기본 화면이
 *  그것이고, top은 시각 밀림이 구조적으로 0이라(viewYawOf가 `if (!pitched) return 0`)
 *  표가 화면 폭·맵 격자에 안 흔들린다. 입체(pitch) 보기는 높이 배율이 0.66 → 1로 서면서
 *  잉크 상자가 커지는데, 그 몫은 **평균이 아니라 밴드로 적어야 맞다**: 기하평균 1.035배,
 *  종류별로는 0.973배(버로우 구멍) ~ 1.111배(변태고치)로 1.14배가 벌어진다.
 *  즉 입체에서는 어떤 모델이 다른 모델보다 제 크기의 12%쯤 더 커 보인다.
 *  모드마다 표를 따로 두면 표가 세 벌이 되므로 하나로 간다 — 없애려면 MODEL_INK에
 *  pitch 열을 더하는 것이 해법이고, 그 전까지 이 12%는 알고 남기는 오차다.
 *
 *  목표 잉크 상자 = NORM_TARGET_INK(5.2). 넓이(√잉크면적)가 아니라 **상자**를 맞춘다:
 *  화면 크기표가 원작 치수 √(폭×높이)로 유도되므로 같은 자라야 두 층이 같은 말을 한다.
 *  값 5.2는 취향이 아니라 상자가 정한다 — 목표를 올릴수록 16-상자를 넘어 잘리는 종류가
 *  는다(5.20에서 2종, 5.25에서 3종, 5.40에서 7종, 5.6에서 8종). 5.2가 클램프 수가
 *  바닥(2종)을 유지하는 마지막 자리다.
 *
 *  상한: 배수를 곱한 뒤에도 잉크가 16-상자 안에 있어야 한다(굽는 판의 여백은 pad 2px
 *  뿐이라 넘치면 잘리고, 잘린 자리로 발·가로중심·머리(contentBox)까지 밀린다). 상한은
 *  **16방위 × 시각 밀림 ±36도 전 범위(6도 눈금 13칸) × top·pitch·base 세 모드**에서
 *  가장 빡빡한 것을 쓰고 훑기 해상도만큼(0.97) 물러선다. 걸린 것은 둘뿐이다:
 *    scourge 2.057→1.634 (잉크 상자 4.13 = 목표의 79%) · mine 1.465→1.293 (4.59 = 88%).
 *  덤: 지금 코드는 **입체 보기에서 배수 없이도 이미 7종이 잘리고 있다**(ultra가 2.50
 *  모델 단위, dship 1.13, shuttle 0.88, muta 0.75, darchon 0.38, bc 0.25, archon 0.13).
 *  이 표가 그 일곱을 상한 안으로 끌어들여 함께 고친다 — 적용 뒤 넘침 0종을 실측했다.
 *
 *  짝(옛 FILL_PAIR): **이 표에 포신(tankgun·tanksiegegun)은 없다.** 앞선 설계는 포신도
 *  제 배수를 받게 두고 "축이 둘 다 상자 중심이니 상대 위치가 안 어긋난다"고 적었는데,
 *  그 진단이 틀렸다 — 축은 원래부터 같았고 어긋나는 것은 **배율**이다. 포신 op은 차체
 *  op을 `...last`로 복사해 sizePx가 같으므로, 배수가 갈리면 그 몫이 그대로 상대 크기
 *  차가 된다(재측정: 포신/차체 잉크 상자 비가 탱크 1.377배·시즈탱크 1.561배로 8방위
 *  전부에서 일정하고, 시즈탱크 90·135도에서는 포신 상자가 차체보다 커졌다).
 *  그래서 짝은 아래 NORM_PAIR로 **차체 배수를 그대로 물려받는다** — 옛 FILL_PAIR가
 *  하던 일을 채움 보정이 아니라 이 층으로 옮긴 것이다. 스크립트도 짝은 안 찍는다.
 *  표에 없는 종류는 1(모델 그대로)이다 — 건물이 여기로 떨어진다. */
export const MODEL_NORM: Record<string, number> = {
  arbiter: 1.826,  // 상자 상한(원한 배수 2.224)
  archon: 0.480,  // 재측정(model-norm)
  bc: 0.654,
  burrowhole: 0.832,
  carrier: 0.695,
  corsair: 1.203,  // 재측정(model-norm)
  darchon: 0.496,
  defiler: 0.824,   // 0.687 → ×1.2(요청: 디파일러 그리기 1.2배)
  devourer: 0.805,
  drone: 1.078,  // 재측정(model-norm)
  droneGas: 1.040,
  droneMin: 1.071,
  dship: 0.712,  // 포드 축소·안쪽 이동 뒤 재측정(model-norm)
  dtemp: 0.875,  // 재측정(model-norm)
  egg: 1.237,   // 정수리를 둥글게 한 뒤 model-norm 재측정
  fbat: 1.229,
  ghost: 1.552,  // 상자 상한(원한 배수 1.723)
  goliath: 0.671,
  goon: 0.655,  // 재측정(model-norm)
  guardian: 0.754,  // 다리 옆으로 곧게 뒤 재측정(model-norm)
  gunner: 1.327,  // 팔 길이 고정 뒤 model-norm 재측정
  htemp: 1.249,  // 재측정(model-norm)
  hydra: 0.685,
  inf: 1.514,  // 상자 상한(원한 배수 1.615)
  interceptor: 1.555,  // 재측정(model-norm)
  larva: 1.350,  // 상자 상한(원한 배수 1.466)
  lurker: 0.592,
  lurkeregg: 0.886,
  mine: 1.007,  // 모따기·마디 다리 뒤 재측정(model-norm)
  muta: 0.741,
  mutacocoon: 1.826,  // 상자 상한(원한 배수 1.891)
  observer: 1.863,
  ovie: 0.816,  // 뒷다리 요잉 뒤 재측정(model-norm)
  probe: 1.738,  // 다리 두께면을 양쪽으로 고친 뒤 model-norm 재측정
  probeGas: 1.486,
  probeMin: 1.543,
  queen: 0.621,
  reaver: 0.842,  // 재측정(model-norm)
  scarab: 1.514,  // 상자 상한(원한 배수 1.591)
  scourge: 1.293,  // 상자 상한(원한 배수 1.327)
  scout: 0.851,  // 재측정(model-norm)
  scv: 0.767,  // 어깨·몸통 앞뒤 깊이 줄인 뒤 재측정(model-norm)
  scvGas: 0.842,
  scvMin: 0.851,
  shuttle: 0.737,  // 재측정(model-norm)
  /* ★ 시즈탱크 넷은 **차체 하나의 값으로 못 박는다**(지적: "정규화 시 포신 튀어나온
     부분과 시즈모드의 고정다리 크기는 빼고 정규화해야") — 스크립트가 재는 잉크 상자에
     합본(tank·tanksiege)은 포신이, 시즈 차체는 네 귀의 버팀다리가 들어가 하나뿐인
     궤도·차체가 모드마다 다른 배수를 받았다(0.723 / 0.575 = 1.26배). 궤도·차체는 두
     모드가 같은 부품이고 포신은 NORM_PAIR로 차체 배수를 물려받으므로, 넷을 tankbody의
     실측값 하나로 두면 어느 모드·어느 판에서도 차체 크기가 같다. 시즈 다리의 넘침 상한
     (model-norm 상한 1.02)보다 작아 잘리지 않는다. 재측정 스크립트가 다른 값을 내도
     여기는 손으로 지킨다. */
  tank: 0.723,
  tankbody: 0.723,
  tanksiege: 0.723,
  tanksiegebody: 0.723,
  ultra: 0.361,
  valk: 0.672,   // 앞동체 −10% 뒤 재측정(model-norm) 0.840 → ×0.8(요청: 발키리 그리기 0.8배)
  vessel: 0.898,  // 방패 접힘 축·뾰족 위끝 뒤 재측정(model-norm)
  vulture: 0.833,
  wraith: 0.894,  // 재측정(model-norm)
  zealot: 0.803,  // 재측정(model-norm)
  zling: 0.758,
  // tankgun: 없음 — 짝이라 소스의 NORM_PAIR가 tankbody 배수로 접는다.
  // tanksiegegun: 없음 — 짝이라 소스의 NORM_PAIR가 tanksiegebody 배수로 접는다.
};
/** ①-a-짝 부품 → 본체(옛 FILL_PAIR와 같은 뜻, 옮긴 자리만 다르다).
 *  포신 판은 차체 판과 **같은 sizePx·같은 상자 중심**에 그려지므로 배수도 같아야 한다.
 *  다른 배수를 주면 그 비가 그대로 '포탑만 부푼' 그림이 된다 — 옛 채움 보정이 이 표를
 *  두고 있던 이유이고, 재측정에서 포신/차체 1.377배(시즈 1.561배)로 되살아났다.
 *  차체 쪽 상한(head 1.208·1.123)이 포신 쪽보다 빡빡해, 차체 배수를 포신에 씌워도
 *  16-상자를 안 넘는다(넘침 훑기 0종 실측). */
export const NORM_PAIR: Record<string, string> = {
  tankgun: "tankbody", tanksiegegun: "tanksiegebody",
  /* 시즈 버팀다리 홑판(전환 동작용 attach) — 시즈 차체와 같은 자라야 다 펴진 순간 구운 시즈 판과 이어진다. */
  tanksiegelegs: "tanksiegebody",
  /* 버로우한 럴커 두 별본 — 흙 구멍이 같은 크기라야 버로우 자리가 종류마다 안 흔들린다. */
  lurkerburrow: "burrowhole", lurkerfire: "burrowhole",
  /* 짐을 든 일꾼도 **맨몸 배수 그대로**다(요청: 일꾼별 자원 들기 모델) — 짐이 늘어난
     만큼 배수를 다시 재면 그 순간 일꾼의 몸이 쪼그라든다. 짐은 몸 앞에 얹히는 것이지
     몸이 커지는 것이 아니므로, 캐러 갈 때와 돌아올 때 몸 크기가 같아야 한다. */
  scvMin: "scv", scvGas: "scv",
  probeMin: "probe", probeGas: "probe",
  droneMin: "drone", droneGas: "drone",
  /* 몸/짐을 가른 별본도 같은 배수를 쓴다 — 그래야 두 판이 같은 자에서 나와 겹쳐 찍을 때
     짐이 제 자리에 앉는다(SHAPE_BUILDERS.scvHold의 ★). */
  scvHold: "scv", droneHold: "drone", probeHold: "probe",
  loadScvMin: "scv", loadScvGas: "scv",
  loadProbeMin: "probe", loadProbeGas: "probe",
  loadDroneMin: "drone", loadDroneGas: "drone",
};
/** 모델 공간 배수의 유일한 입구 — 굽기·도록·총구 앵커가 전부 이것을 쓴다.
 *  짝은 본체 배수로 접힌다. */
export const modelNormOf = (kind: string): number => MODEL_NORM[NORM_PAIR[kind] ?? kind] ?? 1;
/** 건물 배수의 유일한 입구 — 별본(자세만 다른 판)은 본판 배수를 그대로 물려받는다.
 *  성큰의 혓바닥 판이 제 배수를 따로 가지면, 쏘는 순간 건물이 통째로 커졌다 작아진다. */
export const BLD_NORM_PAIR: Record<string, string> = {
  sunkenfire: "sunken",
  // 혓바닥은 몸과 **같은 배수**라야 겹쳐 찍을 때 아가리에서 나온다(op.attach 규약).
  sunkentongue: "sunken", sunkenrear: "sunken",
  /* 고갈 별본은 본판 배수를 그대로 쓴다 — 안 접으면 정규화가 '줄어든 잉크'를 도로 키워
     덩어리가 줄수록 밭이 커지고, 마른 간헐천이 성한 것보다 커진다. */
  mineral0: "mineral", mineral1: "mineral", mineral2: "mineral", mineral3: "mineral",
  /* 꼴 별본(요청: 미네랄 3종)도 본판 배수를 그대로 쓴다 — 꼴마다 제 배수를 따로 가지면
     같은 밭인데 지도 자리마다 크기가 달라진다. 잉크가 조금 다른 것은 꼴의 성격이지
     크기가 아니다. */
  mineralb: "mineral", mineralc: "mineral",
  mineralb0: "mineral", mineralb1: "mineral", mineralb2: "mineral", mineralb3: "mineral",
  mineralc0: "mineral", mineralc1: "mineral", mineralc2: "mineral", mineralc3: "mineral",
  geyserdry: "geyser",
};
export const bldNormOf = (kind: string): number => BLD_NORM[BLD_NORM_PAIR[kind] ?? kind] ?? 1;
/** ①-a-총구 마커 이름 → 총구 앵커가 실제로 붙어 있는 판.
 *  MUZZLE_ANCHOR의 tank·tanksiege 좌표는 **포신 빌더**에서 따온 것인데, 마커 이름은
 *  합본(tank·tanksiege)이라 그대로 배수를 찾으면 엉뚱한 판의 값이 나온다
 *  (tank 0.766 vs tankgun→tankbody 0.846 = 1.10배, tanksiege 0.660 vs 0.756 = 1.15배;
 *  짝을 안 접었던 앞선 설계에서는 1.52·1.79배까지 벌어졌다).
 *  여기 없는 종류는 마커 이름과 그리는 판이 같다. */
export const MUZZLE_PLATE: Record<string, string> = {
  tank: "tankgun", tanksiege: "tanksiegegun",
};
/** ①-b 정규화가 맞추는 목표 잉크 상자(모델 단위, 16이 상자 한 변). 크기표가 이 값으로
 *  나눈다 — scripts/model-norm.mjs의 TARGET_GM과 **같은 값이어야 한다**. */
export const NORM_TARGET_INK = 5.2;
/** ①-c 목표(NORM_TARGET_INK)에 못 미치는 종류만 적는다. 둘로 갈린다:
 *   · mine·scourge — 상자 상한에 걸려 목표까지 못 큰 것.
 *   · tankgun·tanksiegegun — **일부러** 목표를 안 맞춘 것. 짝이라 차체 배수를 쓰므로
 *     제 잉크 상자는 5.2가 아니다(포신은 완결 유닛이 아니라 부품이다).
 *  이 표도 --emit이 낸 값이다. */
export const MODEL_INK: Record<string, number> = { arbiter: 4.213, ghost: 4.685, inf: 4.874, larva: 4.787, mine: 4.381, mutacocoon: 5.020, scarab: 4.950, scourge: 5.070, tankgun: 3.772, tanksiegegun: 2.528 };
/** 그리는 kind가 정규화 뒤 실제로 차지하는 잉크 상자(모델 단위). */
/* 짝은 본체의 잉크 몫을 물려받는다 — 등급(lod)과 장식 자가 이 값을 보므로, 짐 판만
   따로 재면 짐이 몸과 다른 등급으로 구워져 부품이 빠진다. */
export const modelInkOf = (kind: string): number =>
  MODEL_INK[kind] ?? MODEL_INK[NORM_PAIR[kind] ?? ""] ?? NORM_TARGET_INK;

/** ②-a 원작 자료 — **BWAPI 원전 그대로다. 한 칸도 손보지 마라**(손볼 곳은 UNIT_SIZE_TUNE).
 *  [폭px, 높이px, 등급(0 소·1 중·2 대), 공중(1)]
 *   · 폭·높이: `BWAPILIB/Source/UnitType.cpp` unitDimensions의 L/U/R/D에서
 *     폭 = L+1+R, 높이 = U+1+D (BWAPI 자신의 width()/height() 정의). JBWAPI의 같은 표와
 *     234/234 일치했고 Liquipedia와도 마린 17×20 · 저글링 16×16 · 울트라 38×32로 맞았다.
 *   · 등급: 같은 파일 unitSize[]. 지금 UNIT_BULK가 쓰는 바로 그 자료다.
 *   · 공중: 같은 파일 unitFlags[]의 Flyer 비트.
 *  세 자료가 한 줄에 나란히 있어야 아래 보정 규칙을 자료에서 유도할 수 있다.
 *  **손본 값과 원작값이 한 표에 섞이지 않게** 여기에는 원자료만 두고, 보정은 전부
 *  아래 코드로 유도한다(옛 표는 퀸 48×48을 1.000으로 적어 두어 되찾을 수 없었다). */
export const UNIT_BW_RAW = {
  // ── 테란 ──
  scv: [23, 23, 0, 0], gunner: [17, 20, 0, 0], ghost: [15, 22, 0, 0], fbat: [23, 22, 0, 0],
  inf: [17, 20, 0, 0], vulture: [32, 32, 1, 0], mine: [15, 15, 0, 0], tank: [32, 32, 2, 0],
  tanksiege: [32, 32, 2, 0], goliath: [32, 32, 2, 0], wraith: [38, 30, 2, 1],
  dship: [49, 37, 2, 1], vessel: [65, 50, 2, 1], valk: [49, 37, 2, 1], bc: [75, 59, 2, 1],
  // ── 프로토스 ──
  probe: [23, 23, 0, 0], zealot: [23, 19, 0, 0], dtemp: [24, 26, 0, 0], htemp: [24, 24, 0, 0],
  goon: [32, 32, 2, 0], archon: [32, 32, 2, 0], darchon: [32, 32, 2, 0], reaver: [32, 32, 2, 0],
  shuttle: [40, 32, 2, 1], observer: [32, 32, 0, 1], scout: [36, 32, 2, 1],
  corsair: [36, 32, 1, 1], carrier: [64, 64, 2, 1], arbiter: [44, 44, 2, 1],
  /* 인터셉터 — units.dat 상자 [좌 8·상 8·우 7·하 7] = 16×16, 등급 소형, 비행
     (bwUnits.ts의 Interceptor 줄과 같은 자료다). 저글링과 같은 상자다. */
  interceptor: [16, 16, 0, 1],
  /* 스캐럽 — units.dat 상자 [좌 2·상 2·우 2·하 2] = 5×5, 등급 소형, 지상
     (bwUnits.ts의 Scarab 줄과 같은 자료다). 이 게임에서 가장 작은 몸이다. */
  scarab: [5, 5, 0, 0],
  // ── 저그 ──
  drone: [23, 23, 0, 0], zling: [16, 16, 0, 0], hydra: [21, 23, 1, 0], lurker: [32, 32, 1, 0],
  ultra: [38, 32, 2, 0], defiler: [27, 25, 1, 0], queen: [48, 48, 1, 1], ovie: [50, 50, 2, 1],
  muta: [44, 44, 0, 1], scourge: [24, 24, 0, 1], guardian: [44, 44, 2, 1],
  devourer: [44, 44, 2, 1],
  /* 라바·알·껍질 — bwUnits의 치수표와 같은 값(라바 16×16 소형, 알·껍질 32×32 중형).
     SIZE_BLEND이 0이라 이 줄들이 딴 유닛 크기를 흔들지 않는다(크기는 종류마다 제
     상자만 본다). */
  larva: [16, 16, 0, 0], egg: [32, 32, 1, 0],
  lurkeregg: [32, 32, 1, 0], mutacocoon: [32, 32, 1, 1],
} as const;
/** 기하평균 — '전체 크기감을 안 바꾸는' 평균이다. 곱셈으로 크기를 만지는 이 파일에서
 *  산술평균은 큰 쪽에 끌려간다. */
export const gmOf = (v: number[]): number => Math.exp(v.reduce((t, x) => t + Math.log(x), 0) / v.length);
export const BW_ROWS: readonly (readonly [number, number, number, number])[] = Object.values(UNIT_BW_RAW);
/** 충돌 상자의 대각(타일) = √(폭×높이)/32. 1타일 = 32px. */
export const bwBoxTiles = (r: readonly [number, number, number, number]): number => Math.sqrt(r[0] * r[1]) / 32;
/** 원작 체력바 폭(게임 px) — OpenBW: `width -= (width - 1) % 3; if (width < 19) width = 19;`. 입력은 sprites.dat
 *  health_bar_size 자리의 어림값이다(UnitDrawOp.hpBarW 주석). */
export const hpBarGamePx9 = (size: number): number => {
  let w = Math.round(size);
  w -= (w - 1) % 3;
  return w < 19 ? 19 : w;
};
/** 등급 대표 크기(타일) — **지상 유닛만의 기하평균**이다. 손으로 고른 수가 아니라
 *  자료에서 유도한다(지상 = 충돌 상자가 몸에 딱 붙는 쪽이라 등급의 기준으로 쓸 수 있다).
 *  실측: 소 0.636 · 중 0.864 · 대 1.011. */
export const CLASS_TILES = ([0, 1, 2] as const).map(
  (c) => gmOf(BW_ROWS.filter((r) => r[3] === 0 && r[2] === c).map(bwBoxTiles)),
);
/** 등급을 섞는 무게 — 0.5는 "두 자료(충돌 상자·등급)를 같은 무게로" 곧 기하평균이다.
 *  왜 섞나: units.dat의 기본값 32×32에 벌처·탱크·골리앗·드라군·아콘·다크아콘·리버·러커가
 *  통째로 뭉쳐(41종 중 14종이 세 값에 몰린다) 상자만으로는 벌처(중)와 시즈탱크(대)를
 *  구분하지 못한다 — 있던 자료(unitSize[])를 버리는 셈이다. 섞으면 벌처 0.930 <
 *  탱크 1.005로 제 순서(등급 사이)가 선다. 등급 하나만 쓰면(무게 1) 같은 등급이 전부 한
 *  값이 되어 이번엔 배틀크루저와 레이스가 같아진다. 등급 역전쌍은 무게 0에서 57쌍,
 *  0.5에서 10쌍, 1에서 0쌍이다.
 *  **섞기가 고치는 것은 등급 사이 순서뿐이고, 같은 등급 안 뭉개짐은 못 고친다** —
 *  등급이 같으면 √(상자×등급)이 상자의 단조함수라 상자까지 같은 종은 원리적으로 못
 *  가른다(32×32 대형 지상 일곱, 44×44 대형 공중 셋 …). 그 몫은 UNIT_SIZE_TUNE이 진다.
 *  남는 10쌍도 전부 자료발은 **아니다**: 4쌍(퀸·뮤탈 쪽)만 원상자에서도 역전이고,
 *  6쌍(벌처·럴커 vs 레이스·셔틀·스카웃)은 원상자에서는 정상 순서였는데 AIR_BOX_SLACK
 *  나눗셈이 뒤집은 것이다 — 그래서 그 셋을 손잡이로 되올린다. */
/* 0.5 → 0(요청: "유닛 크기 비율 원작과 똑같이") — 섞기는 units.dat의 기본값 뭉침
   (32×32에 일곱 종)을 등급으로 갈라 주는 대신, 크기 비율을 원작에서 밀어낸다. 이제
   화면 크기는 **원작 상자 그대로**다: 같은 상자·같은 등급인 종류는 화면에서도 같은
   크기가 된다(벌처 = 탱크 = 골리앗 = 드라군 = 아콘 = 리버 = 러커, 다 32×32다).
   섞기로 세워 두던 순서는 그 대가로 사라진다 — 되살리려면 이 값만 0.5로 돌리면 된다. */
export const SIZE_BLEND = 0;
/** ②-b 원작 치수(타일) — 위 원자료에서 **유도한다. 손으로 옮겨 적지 않는다.**
 *  결과 검산(손잡이 전, 41종 전수를 실제로 세어 적는다 — 어림수를 쓰지 않는다):
 *   · 지상 24종이 원상자에서 벗어나는 폭은 −9.7% ~ +16.5%다(전에 "±5% 안"이라고
 *     적었던 것은 **거짓**이었다 — 24종 중 13종이 5%를 넘고, 예시로 들었던 마린조차
 *     +5.09%다). 가장 큰 것부터: 마인 +16.5 · 저글링 +12.8 · 히드라 +12.2 ·
 *     다크템플러 −9.7 · 하이템플러 −7.9 · 벌처/럴커 −7.0 · 일꾼 셋 −5.9 · 고스트 +5.9.
 *     등급을 반 몫 섞으니 당연한 결과이고(그것이 섞는 이유다), 여기 적는 이유는
 *     "원작 그대로"라는 말이 ±5%가 아니라 이 밴드라는 뜻임을 못박기 위해서다.
 *   · 공중은 등급이 말하는 크기 언저리로 앉는다. 1차·2차가 지목한 역전은 전부 풀렸다
 *     (손잡이까지 태운 최종값: 셔틀 0.946 > SCV 0.676, 스카웃 0.934 > 마린 0.606,
 *     뮤탈 0.779 < 아비터 1.041, 벌처 0.874 < 시즈탱크 1.026, 스커지 0.506 < 저글링
 *     0.564). 같은 등급 안에서 원상자 순서가 뒤집힌 쌍은 0이다. */
export const UNIT_BW_TILES: Record<string, number> = Object.fromEntries(
  Object.entries(UNIT_BW_RAW).map(([k, r]) => {
    /* 공중 슬랙도 안 나눈다(요청: 원작 비율 그대로) — 원작 상자가 곧 화면 크기다.
       그 대신 원작 상자가 표적 획득용으로 넉넉한 공중 종류(스커지 24×24·옵저버 32×32·
       오버로드 50×50)는 화면에서도 그만큼 크게 나온다. 되돌리려면 아래 한 줄에서
       AIR_BOX_SLACK을 다시 나누면 된다. */
    const box = bwBoxTiles(r);
    return [k, SIZE_BLEND === 0 ? box : box ** (1 - SIZE_BLEND) * CLASS_TILES[r[2]] ** SIZE_BLEND];
  }),
);
/** ②-c 원작 몸 지름(타일) — **밀어내기 전용**이다. 등급 섞기도 공중 보정도 안 탄
 *  순수 충돌 상자라, 그리기 크기를 아무리 만져도 진형 간격이 안 흔들린다(지적: 크기표가
 *  진형 간격까지 바꾼다). 겹침의 진실은 simCore의 BODY_R이고 이것은 그 화면판이다. */
export const UNIT_BODY_TILES: Record<string, number> = Object.fromEntries(
  Object.entries(UNIT_BW_RAW).map(([k, r]) => [k, bwBoxTiles(r)]),
);
/** ②-d 충돌 상자 → 화면 그림. 원작 스프라이트는 어깨·총·날개가 충돌 상자 밖으로
 *  나가지만 그 크기(GRP 헤더)는 MPQ 없이 못 캔다 — **추측으로 계수를 얹지 않는다.**
 *  1은 "충돌 상자 그대로"라는 뜻이고, GRP를 캐면 여기 한 줄만 갈면 된다. */
export const SPRITE_OVERHANG: number = 1;
/** ③-a-상한 시네마틱 비율의 허용 범위 — 이제 사실상 열려 있다(요청: 나중에 시네마틱
 *  모드로 강한 대비도 설정할 것이라 상한을 없애야 한다).
 *
 *  왜 있었나: 상한의 근거는 크기 자체가 아니라 **스프라이트 보관함의 구멍**이었다.
 *  보관함이 '장수'로만 잘려(700장), 대비를 키우면 한 장이 950×950(DPR 2) ≈ 3.6MB까지
 *  커져 이론상 2.5GB가 됐다. 그래서 "가장 큰 유닛의 그리는 상자가 작은 맵에서도 화면 안"
 *  인 마지막 자리(1.35)에 묶어 두었다.
 *  왜 없앴나: 보관함을 **바이트 예산 + LRU**로 바꾸고(SPRITE_BYTES_MAX), 한 장이 너무
 *  커지면 굽지 않고 직접 그리기로 떨어지는 문(SPRITE_SIDE_MAX)을 냈다. 이제 대비를
 *  키워도 메모리가 그 값에 딸려 오르지 않는다 — 큰 판은 캐시를 안 타고 그때그때
 *  그려질 뿐이다(그만큼 느려지는 것은 화면에 그렇게 큰 유닛이 있을 때뿐이다).
 *  남겨 둔 3은 오타 방지용 안전판이다(원작 대비를 다 살려도 1.7 언저리다). */
export const SIZE_CONTRAST_MAX = 3;
/** ③-a 시네마틱 비율(요청: "유닛간 크기 대비가 커지면서 좀더 역동적인 장면") —
 *  균일 배수로는 '대비'가 안 커지므로 기준 크기에 대한 **지수**로 건다:
 *      크기' = SIZE_REF × (크기 / SIZE_REF) ^ SIZE_CONTRAST
 *  1이면 그대로, 1보다 크면 큰 유닛은 더 크고 작은 유닛은 더 작아진다. **지금은 UI가
 *  없다** — 손잡이 자리만 만들어 둔 것이고, 붙일 때 손댈 곳은 이 상수 하나다.
 *  기준값 SIZE_REF를 기하평균으로 잡는 것은 취향이 아니라 항등식이다: 이 변환의
 *  기하평균은 REF × (기하평균/REF)^C 이므로, 모든 C에서 전체 크기감이 안 변하는 REF는
 *  기하평균뿐이다(중앙값은 중앙값만, 마린 기준은 마린만 고정하고 전체가 부푼다).
 *  실측(41종): C=1.35에서 큰/작은 비 2.21 → 2.92, 기하평균 0.834 불변(산술평균만 +1.9%).
 *  가장 큰 배틀크루저의 몸이 1.207 → 1.374타일(확대에서 4.26타일)로 커맨드센터 발자국
 *  (4타일)만 하다 — 전장을 가리지 않는다. */
/* 1 → 1.35(요청: 소·중·대 구분이 거의 안 된다. 충돌은 그대로 두고 보이는 것만) —
   상한(SIZE_CONTRAST_MAX)까지 올린다. 실측으로 그리는 상자의 큰/작은 비가 원작 충돌
   상자는 4.43배인데 우리는 2.39배였고(등급비도 원작 1:1.40:1.82 대 우리 1:1.31:1.58),
   그 압축의 절반은 등급 섞기(SIZE_BLEND), 절반은 모델 정규화(16/modelInk)가 만든다.
   ★ 충돌·간격은 한 톨도 안 움직인다 — 겹침의 진실은 simCore의 BODY_R이고, 화면
     진형 간격은 UNIT_BODY_TILES(등급 섞기도 이 지수도 안 타는 순수 충돌 상자)가
     정한다. 이 상수는 UNIT_BW_TILES(그리기 전용)에만 걸린다.
   1.35는 옛 상한이 묶어 두던 자리다. 상한은 이제 풀렸으므로(위 SIZE_CONTRAST_MAX)
   시네마틱 모드가 붙을 때 이 값만 올리면 된다 — 원작 충돌 상자의 대비를 다 살리는
   값이 1.7 언저리다. */
/* 1.35 → 1(요청: "유닛 크기 비율 원작과 똑같이") — 이 지수는 원작 비율을 **일부러
   과장하는** 손잡이다(큰 유닛은 더 크게·작은 유닛은 더 작게). 원작 그대로를 원하면
   1이 그 값이다. 시네마틱 모드가 붙을 때 이 상수만 올리면 과장이 돌아온다. */
export const SIZE_CONTRAST: number = 1;
/** 실제로 쓰이는 값 — 1 미만(작은 유닛이 더 커지는 방향)과 상한 밖을 막는다. */
export const SIZE_CONTRAST_C = Math.min(SIZE_CONTRAST_MAX, Math.max(1, SIZE_CONTRAST));
export const SIZE_REF = gmOf(Object.values(UNIT_BW_TILES));
/** ③-b 종류별 손보기(기본 1) — **여기가 사람이 만지는 자리다.** 열쇠는 원작 자료표의
 *  것이라 오타가 컴파일에서 잡힌다(예전 표는 `zergling: 1.2`가 조용히 무시됐다).
 *
 *  왜 채워야 하나: 위 크기표는 원작 자료가 말하는 데까지만 간다. 그런데 units.dat의
 *  치수 열에는 **기본값이 그대로 남은 칸**이 많다 — 32×32에 여덟 종, 44×44에 넷이
 *  몰려 있고, 등급까지 같으면 √(상자×등급)이 상자의 단조함수라 원리적으로 못 가른다.
 *  손보기 전에는 41종 중 19종이 여섯 무리로 뭉쳤고 서로 다른 값이 28개뿐이었다.
 *  아래 15칸을 채워 **동률 19종 → 7종, 서로 다른 값 28 → 37**이 됐다.
 *  남는 7종(SCV·프로브·드론 / 마린·메딕 / 드랍십·발키리)은 **원전 상자가 글자
 *  그대로 같은 값**이라(23×23 · 17×20 · 49×37) 자료에 더 없는 자리다 — 뭉갠 것이
 *  아니라 자료가 같다고 말하는 것이라 손대지 않았다.
 *
 *  값의 출처를 칸마다 밝힌다. 세 갈래다:
 *   (자료-공중) 레이스·스카웃·셔틀 — AIR_BOX_SLACK 상수가 만든 역전을 되돌린다.
 *      상수 1.4413 대신 제 잔차 r을 절반 몫만 쓰는 것과 같게 (1.4413/r)^(1/4)로 잡았다
 *      (상자가 지수 0.5로 들어가므로 슬랙 보정의 반이 네제곱근이다).
 *      레이스 r=1.044 → 1.084 · 스카웃 1.049 → 1.083 · 셔틀 1.106 → 1.068.
 *      덤으로 "UNIT_FILL_TARGET으로 키웠던 레이스가 도리어 0.947배로 작아진다"는
 *      회귀도 이 칸이 닫는다(0.947 × 1.084 = 1.027배 — 지금보다 조금 커진다).
 *   (자료-무리) 32×32·44×44 뭉치 — 순서만 원전의 다른 열에서 끌어온다.
 *      수송칸(unitSpaceRequired) · 인구(unitSupplyRequired) · 내구(HP+실드)를 이 순서로
 *      본다. 세 열 모두 같은 UnitType.cpp에 있고, 수송칸은 "이 유닛이 배에서 몇 칸을
 *      차지하나"라 부피에 가장 가까운 원전 진술이다.
 *      골리앗 수송2·HP125 → 가장 작게 / 드라군 수송4·인구4·내구180 /
 *      탱크 수송4·인구4·내구150(기준, 손 안 댐) / 다크아콘 인구8·내구225 /
 *      시즈탱크(같은 유닛의 편 자세라 탱크보다 조금 크게) / 아콘 인구8·내구360 /
 *      리버 인구8·수송4(가장 둔한 공성 기계) 순.
 *      벌처 수송2 < 럴커 수송4로 32×32 중형 둘도 갈린다.
 *      **폭은 임의다**: 세 열이 순서만 주고 배수는 안 주므로, 울트라(원전 38×32로
 *      실측치가 있는 유일한 대형 지상)의 1.0495를 넘지 않는 선에서 2~4%씩 벌렸다.
 *   (눈대중) 스커지·오버로드·가디언 쪽 — 자료가 아니라 화면을 보고 정한 값이다.
 *      스커지 0.88: 원전 24×24는 공중 표적 획득용 상자이고(잔차 1.179) 실제 몸은
 *      저글링(16×16)보다 작다. 저글링 아래로 내리는 데 필요한 최소치는 0.980인데,
 *      눈에 확실히 작게 보이도록 0.88까지 내렸다 — 이 폭은 **임의다**.
 *      오버로드 1.05: 원전 상자 50×50이 41종 중 넷째로 크지만 울트라와 0.26% 차라
 *      사실상 동률이었다. 4.7%로 벌렸다 — 방향은 자료, **폭은 임의다**.
 *      디바우러 1.02 · 아비터 1.06: 44×44 셋 중 가디언을 기준으로 두고
 *      내구(250 / 350+150)와 인구(4 / 8) 순으로 벌렸다. **폭은 임의다.** */
export const UNIT_SIZE_TUNE: Record<string, number> = {   // 열쇠는 sizeKind(메딕처럼 원작 치수표에 없는 종류도 받는다)
  /* 도록 크기 보정 페이지(?cal)에서 실측해 준 배수(요청). */
  archon: 1.2, darchon: 1.2, corsair: 0.8, interceptor: 0.8, larva: 0.4, egg: 0.4,
  muta: 0.8, scourge: 0.6, ultra: 1.4, guardian: 0.8, lurkeregg: 0.6, mutacocoon: 0.8,
  observer: 0.8,
  gunner: 0.8, inf: 0.8, fbat: 0.8, ghost: 0.8, htemp: 0.6, dtemp: 0.8,   // 마린·메딕(inf)·파뱃·고스트·하템·다템
  scv: 0.8, probe: 0.8, drone: 0.8,   // 일꾼류
  /* (전부 걷음 — 요청: "유닛 크기 보정 모두 제거") — 일꾼·보병 0.68, 메딕 0.612,
     질럿 0.85, 템플러 0.808, 커세어 0.85, 마인 0.53, 옵저버 0.17, 스커지 0.7,
     시즈 1.257, 아콘 1.35, 아비터·디파일러 1.2, 울트라 1.5, 라바·알 0.5, 오버로드
     1.155가 있었다. 이제 화면 크기는 원작 상자(units.dat) 비율 그대로다. 필요하면
     여기 한 줄씩 다시 적는다. */
};
/** ③-c 전체 배수 — "다 조금 크게/작게"를 한 값으로.
 *  1 → 1.12(요청: "유닛들 크기 살짝 키움 실제 게임에서 비율 느낌") — 원작은 마린 하나가
 *  배럭 앞에 서면 문짝만 하다. 우리 화면은 유닛 상자가 원작 치수(√(폭×높이))에서
 *  곧장 나오므로 건물 대비 비가 원작보다 작게 잡혀 있었다: 건물은 발자국을 꽉 채우는데
 *  유닛은 제 충돌 상자만 하니, 같은 자를 써도 눈에는 유닛만 작다.
 *  ★ 건물 쪽 손잡이(BLD_FILL_TARGET)와 달리 이 값은 **모든 유닛에 한꺼번에** 걸린다 —
 *    종류 사이의 비(마린 : 울트라)는 한 톨도 안 바뀌고 무리 전체가 같이 커진다. */
export const UNIT_SIZE_GLOBAL: number = 1.12;
/** 화면 크기의 유일한 입구(타일).
 *  열쇠가 둘인 것이 핵심이다(지적: 손잡이가 못 닿는 종류가 7개) —
 *   · sizeKind(원작 치수)는 **유닛의 성질**이다. 버로우한 히드라의 구멍은 히드라 크기다.
 *   · drawKind(잉크 몫)는 **모델의 성질**이다. 시즈탱크는 tankbody로 그려진다.
 *  이 둘을 갈라 놓으면 tankbody·tankgun·tanksiegebody·tanksiegegun·lurkeregg·
 *  mutacocoon·burrowhole까지 전부 손잡이가 닿는다. */
// 계측 스크립트가 화면과 같은 값을 읽을 수 있게 내보낸다(scripts/… 실측용).
export const unitTilesOf = (drawKind: string, sizeKind: string, bulk: 0 | 1 | 2): number => {
  const bw0 = UNIT_BW_TILES[sizeKind] ?? CLASS_TILES[bulk];
  const bw = SIZE_CONTRAST_C === 1 ? bw0 : SIZE_REF * (bw0 / SIZE_REF) ** SIZE_CONTRAST_C;
  return bw * SPRITE_OVERHANG * (16 / modelInkOf(drawKind))
    * (UNIT_SIZE_TUNE[sizeKind as keyof typeof UNIT_BW_RAW] ?? 1) * UNIT_SIZE_GLOBAL;
};
/** 일꾼 모델 — 겹침 이완에서 제 일꾼끼리는 서로 안 밀어낸다(지적: 자원 곁 포개짐 허용). */
export const WORKER_KIND_SET = new Set([
  "scv", "probe", "drone",
  // 짐을 지고 오는 일꾼도 일꾼이다 — 밭 곁 포개짐은 짐 유무를 안 가린다.
  "scvMin", "scvGas", "probeMin", "probeGas", "droneMin", "droneGas",
]);

/** ShapeIcon의 면 목록 결정을 떼어 낸 것 — 캔버스 유닛 층(UnitLayer)이 같은 판(같은
 *  굽기 캐시)을 그대로 그리려면 SVG 밖에서도 이 결정을 불러야 한다. 결과가 같은 함수
 *  하나이므로 SVG와 캔버스의 픽셀이 같은 도형에서 나온다(품질 동일의 근거). */
/* 본 게임과 같은 요잉(지적: 45도 시계방향) — 건물 모델의 기본 방향을 원작 아이소메트릭
   느낌으로 튼다. 원작 스프라이트 방향이 다른 모델(서플라이 디포 등)은 아래 보정표에
   도(°)를 더한다 — 값은 지적받는 대로 채운다. */
/* 요잉의 부호(요청: "내가 시계방향이라고 하면 일반적인 요잉 정의에서 + 방향") —
   이 코드의 rotDeg도 **+가 시계방향**이라 사용자의 말과 그대로 맞는다. 실측(이 저장소의
   모델을 각 rotDeg로 구워 본 것): 시즈탱크 포신이 0에서 시청자 쪽(남), 45에서 앞-왼쪽,
   90에서 왼쪽(서)을 본다 — 남 → 서 → 북 → 동이 곧 시계방향이다. 그러니 "X를 90도
   시계로"는 그 모델의 withModelSpin에 +90을 얹는 것이다(빌더 안에서 도는 모델 회전).
   여러 번 왕복했던 자리라 여기 못 박아 둔다. */
export const BUILDING_BASE_YAW = 45;
/* 보정표(MODEL_YAW_TWEAK)는 걷었다(요청: "모든 보정표 제거하고, 앞으로 내가 요잉하라고
   하는 건 그릴 때가 아니라 본 모델에서 돌리라는 뜻") — 건물마다 다른 각을 그릴 때마다
   끼워 넣다 보니 합계가 -45·45·90·180·225·315로 흩어져, 같은 종족 건물끼리도 서 있는
   각이 제각각이고 새 모델을 그릴 때마다 "왜 또 돌아가 있지"가 반복됐다. 그 각들은 이제
   빌더 안 withModelSpin에 구워져 모델의 일부다 — 그리는 쪽은 기본 요잉 하나만 쓴다. */
export const buildingYawOf = (): number => BUILDING_BASE_YAW;
/* ★ 벙커의 포구는 **쏘는 쪽을 따라 돈다**(지적: "트레이서가 벙커 위에 나와서 잘 안 보여
   — 벙커 외부에 방향에 맞는 사격하는 부분에 나오게") ────────────────────────────────
   여태 BLD_MUZZLE.tombFlat은 [0, 2.7, 1.2] 한 점이었다. 두 가지가 틀렸다:
     ① 자리 — r 2.7은 뚜껑(돔 r3.6) **안쪽**이고 z 1.2는 그 높이라, 빛이 벙커 지붕
        한가운데서 났다. 밖에서 보면 총구가 아니라 뚜껑 위의 반짝임이다.
     ② 방향 — 건물 포구는 건물 요잉으로만 돌아, 어느 쪽을 쏘든 늘 같은 자리에서 났다.
        벙커는 사방 대칭이고 네 면 모두 사수가 붙는 건물이라, 쏘는 쪽 자락에서 나야 한다.
   그래서 포구를 각의 함수로 만든다. 모형 각을 세계 각에서 얻는 식은 anchorPoint가
   withYaw(−건물요잉)으로 도는 데서 그대로 나온다: 카메라를 −Y 돌리면 모형 점 (mx,my)가
   화면에서 (mx·cosY − my·sinY, mx·sinY + my·cosY) 자리에 서므로, 세계 각 d를 겨누려면
     mx = cos(d + Y),  my = sin(d + Y)
   면 된다(Y = BUILDING_BASE_YAW). 검산: d = 45도면 (mx,my) = (0,1) — 모형의 앞면,
   곧 총안 셋이 난 +y 벽이다. 건물이 45도 돌아 서 있으니 그 벽이 세계 45도를 본다.
   반지름·높이는 **돔에 난 총안** 그 자리다(그 모델의 WZ0~WZ1·domeR9) — 빛이 창에서
   난다. */
export const BUNKER_MUZZLE_R = 3.15;
// 몸의 z가 1.1배가 되었으므로(tombFlat의 withModelScale) 총구 높이도 같은 몫이다.
export const BUNKER_MUZZLE_Z = 1.62 * 1.1;
export const bunkerMuzzleOf = (deg: number): [number, number, number] => {
  const a = ((deg + BUILDING_BASE_YAW) * Math.PI) / 180;
  return [Math.cos(a) * BUNKER_MUZZLE_R, Math.sin(a) * BUNKER_MUZZLE_R, BUNKER_MUZZLE_Z];
};

/* ── 유닛 캔버스 층(요청: 캔버스 전환 — 성능) ─────────────────────────────────────
   낱개 유닛 마커 수백 개를 span+SVG로 매번 재조정하는 것이 재생의 병목이었다(실측:
   중반 4대4 마커 750개, 폰급 CPU에서 1fps). 도형·자리·크기·순서 계산은 전부 그대로 두고
   '그리기'만 캔버스 한 장으로 옮긴다 — 면 목록은 위 resolveShapeFaces(같은 굽기 캐시)를
   그대로 쓰므로 그림 자체는 SVG와 같다. 전투 효과·말풍선·건물은 DOM에 남는다. */
export type UnitDrawOp = {
  /** 렌즈 상자 기준 0~1 분수 자리(회피·입체 사영 반영 뒤). */
  fx: number; fy: number;
  /** 화가 순서 — 기존 zIndex 공식 값 그대로. */
  z: number;
  /** 발밑 접지 그림자(지적: 건물·지상 유닛에도 옅게) — 아주 작은 타원만. */
  groundShadow?: boolean;
  /** 바닥에 실제로 깔리는 그림자 테두리(분수 좌표) — 발자국 타원을 타일 공간에서
   *  띄엄띄엄 찍어 자리 사상으로 옮긴 점들이다(요청: 화면 타원 어림 말고 실제로 바닥에
   *  그려야 한다). 원근이 실린 채 지면에 눕는다. */
  shadowPts?: number[];
  /** 지면선(입체) — 발자국 아랫변을 자리 사상으로 옮긴 세로 자리. 상자 바닥
   *  어림(sy + hPx/2) 대신 이 값에 그린 몸의 발을 앉힌다(지적: 3D에서 건물이
   *  그림자보다 한 칸쯤 아래에 그려짐 — 그림자는 지면에 직접 그린 도형이라 옳고,
   *  몸만 화면 어림을 써서 원근이 실린 만큼 어긋났다). */
  baseFy?: number;
  /** 이 판을 그릴 때만 곱하는 몫 — 모델 좌표는 안 건드린다(정규화가 잰 서로의 비가
   *  그대로 남는다). 건물이 이 값으로 1.2배 크게 앉는다. */
  drawK?: number;
  /** 몸을 지면선에서 얼마나 띄워 그릴까 — **그린 폭의 배수**다(화면 px이 아니라).
   *  건물 전용이다: 유닛은 air·rise가 그 몫을 한다. 그림자는 안 따라 뜬다 — 그
   *  둘이 벌어진 만큼이 곧 '떠 있다'로 읽힌다. */
  liftK?: number;
  /** 발자국 세로/가로 비(건물) — 접지 그림자가 '바닥 발자국'만 덮게 하는 자(지적:
   *  칸(hPx)은 모델 높이까지 포함해, 칸 기준 타원은 건물을 통째로 덮는 큰 원이 됐다). */
  footRatio?: number;
  kind: string; rotDeg?: number; viewYaw?: number; flat?: boolean; pitch?: boolean;
  /** 포탑 각(도, 세계 방향) — 있으면 모델 안의 '포탑부'만 이쪽을 본다(요청: 포톤·터렛).
   *  몸통 요잉(rotDeg)과의 차가 곧 모델 회전이다(위 headYawNow 주석). 값은 22.5도로
   *  갈무리해 넘겨야 한다 — 굽는 판이 칸마다 하나씩 생긴다. */
  headDeg?: number;
  /** ★ 이 판 **위에 같은 자로 겹쳐 찍을** 판(요청: 일꾼 몸/짐 가르기) — 같은 16-상자·같은
   *  배수로 구워지므로, 몸의 자리 보정을 그대로 쓰고 제 잉크 오프셋만 달리 하면 짐이 제
   *  모형 좌표에 앉는다. */
  attach?: string;
  /** 겹쳐 찍는 판만 원점(모델 원점) 기준으로 곱하는 배율 — 시즈 전환의 버팀다리가 몸에서 뻗어 나오고 들어가는
   *  동작이다(요청). 있으면 그 판은 몸 **뒤**에 깐다(오므린 다리가 차체 밖으로 안 비친다). */
  attachK?: number;
  /** 도형 한 변(px) — 크기표 × 깊이 배율까지 포함한 **그리는 상자**다.
   *  화면에 보이는 몸은 이것의 약 1/3(NORM_TARGET_INK/16)이고, 몸을 자로 삼는 장식은
   *  이 값이 아니라 구운 판의 잉크 폭(inkW)을 쓴다. */
  sizePx: number;
  /** 진형 간격용 몸 지름(px, 줌 전) — 원작 충돌 상자다. **그리기 크기와 따로 간다**:
   *  크기표·시네마틱 대비를 아무리 만져도 유닛끼리 벌어지는 간격은
   *  안 바뀐다. 없으면 sizePx 어림으로 물러난다(공사 SCV·마인처럼 안 밀어내는 op). */
  sepPx?: number;
  color: string;
  alpha: number;
  /* ── 건물용(캔버스 전환 둘째 판) — 발자국 비례 상자에 그린다. ───────────────── */
  /** 상자 폭·높이 — 캔버스 '폭'에 대한 분수(스팬의 % 폭 + aspectRatio와 같은 자).
   *  있으면 sizePx 대신 이 상자를 쓴다. */
  wFrac?: number; hFrac?: number;
  /** 상자 채우기 방식 — "meet"는 비율 유지·바닥 정렬(keepRatio), "fill"은 맨 네모 채움. */
  boxFit?: "meet" | "fill";
  /** 공사 단계 1~3 — 모델의 아래쪽 stg/3만 그린다(요청: 아래 부품부터 점점 위로).
   *  0이나 3이면 통째로. */
  buildStage?: number;
  /** meet에서 높이 대신 폭을 기준으로 — 납작 건물(벙커류)은 상자가 낮아 min 규칙이
   *  전체를 줄여 버린다(조사: 벙커가 유난히 작던 이유). */
  fitWidth?: boolean;
  /** 도형 대신 글자 하나(부속건물 +) — kind는 무시된다. */
  textGlyph?: string;
  /** 그림자 끄기 — 건물은 발이 땅에 붙어야 해서 그림자가 없다(유닛만 있다). */
  noShadow?: boolean;
  /** 공중 유닛(요청: 더 높이 + 바닥 그림자) — 몸을 위로 띄우고 발밑에 그림자 타원. */
  air?: boolean;
  /** 그때 이 몸이 뜨는 높이(px, 줌 전) — **몸 크기와 무관한 한 값**이다(위 AIR_LIFT_REF).
   *  공중 유닛과 **뜬 건물**이 같은 칸을 쓴다(요청: 둘이 같은 높이). 건물은 여기에
   *  둥실거림까지 실어 보낸다.
   *  그리는 쪽(UnitLayer)·집는 쪽(pickAt)·팝업이 이 한 칸을 나눠 읽는다: 여태 셋이
   *  각자 `제 몸 × AIR_LIFT_K`를 다시 셈했는데, 그러면 높이를 바꿀 때마다 세 자리를
   *  같이 고쳐야 하고 한 자리를 놓치면 몸과 판정이 어긋난다(이 파일이 여러 번 데인 자리다). */
  airPx?: number;
  /** 추가 부양(요청: 수송 승하차) — 크기 px에 대한 배수만큼 더 띄운다(빔에 빨려 오름). */
  rise?: number;
  /** 크립 판(요청: 크립은 벽·램프·다리를 못 넘는다) — 이 표시가 있는 판들은 먼저 깔고
   *  지형 차단 마스크로 파낸 뒤 나머지를 얹는다. */
  clipWalk?: boolean;
  /** 그림의 **잉크 한가운데**를 fy에 맞춘다(바닥 맞춤 대신) — 바닥에 눕는 데칼용이다.
   *  기본(바닥 맞춤)은 그림 높이가 상자와 다르면 그 차이의 절반만큼 자리가 밀리는데,
   *  그 차이가 보기(평면·입체)마다 달라 한 값으로는 못 맞춘다. 여기 이 갈래는 구운
   *  판에서 잉크 높이를 **그때그때 재서** 맞추므로 어느 보기에서도 정확히 가운데다. */
  inkCenter?: boolean;
  /** 겹침 방지 이완에서 뺀다(지적: 채굴 일꾼이 해처리 밖으로 밀려 엉뚱한 데서 캠) —
   *  채굴 동선은 건물·자원과 겹치는 게 실제 모습이다. */
  noSep?: boolean;
  /** 지금 이 건물이 일하고 있나(요청: 창문 불빛) — 켜지면 창에 불이 든다.
   *  불빛을 가진 종류(LIT_KINDS)에서만 판이 갈린다. */
  lit?: boolean;
  /** 도는 부품의 칸(0~7) — 상시 회전이라 lit와 무관하다(위 bldSpinNow 주석). */
  spin?: number;
  /** 지금 그릴 자세(요청: 애니메이션) — 0 기본 · 1 이동 컷 · 2 공격 컷.
   *  컷을 가진 종류(POSE_KINDS)에서만 판이 갈리고, 나머지는 값이 있어도 무시된다. */
  pose?: 0 | 1 | 2 | 3 | 4 | 5;
  /** 남은 체력 비율 0~1(요청: 스탯을 지닌 생애주기) — 다쳤을 때만 와서 바가 뜬다. */
  hpFrac?: number;
  /** 체력바를 지금 보일 것인가 — 맞은 지 HP_BAR_SEC 안(요청: 공격당한 뒤 한동안만). 선택된 개체는 붓이 따로 늘 보인다. */
  hpShow?: boolean;
  /** 체력바의 **원작 폭**(게임 px, 1타일 = 32px)과 그것을 지도 폭으로 나눈 분수(요청: 잉크 폭이 아니라 절대값에 비례,
   *  원작 양식 그대로). 원작(OpenBW draw_health_bars)은 sprites.dat의 health_bar_size를 3의 배수+1로 내리고 19 아래면
   *  19로 올린 폭에, 3px 간격의 칸(2px 색 + 1px 금)을 긋는다. 그 표는 이 환경에서 못 읽어(위키·staredit 차단) 유닛은
   *  충돌 상자 폭 × 1.3(선택 원 크기 언저리), 건물은 발자국 폭 × 0.95로 어림했다 — hpBarGamePx9. */
  hpBarW?: number;
  hpBarFrac?: number;
  /** 최대 체력(실드 합) — 바의 100% 길이가 이 값에 비례한다(지적: 저글링과 울트라의
   *  만피가 같은 길이면 기준이 이상하다). */
  hpMax?: number;
  /** 만수(hp+실드) 가운데 **실드 몫**(0~1) — 프로토스만 0보다 크다.
   *  체력바가 이 몫만큼을 흰 칸으로 따로 그린다(요청: "프로토스 체력바중 실드는
   *  흰색으로 표현?"). 실드는 체력보다 먼저 깎이므로 바의 **오른쪽 끝**이 실드다. */
  shFrac?: number;
  /** 상태 오라 색(전수조사: 인스네어·플레이그·빙결…) — 몸 밑에 색빛이 밴다. */
  tint?: string;
  /** 이 판을 통째로 한 색으로 굽는다(면의 제 색을 무시) — 잔상처럼 '몸이 아니라 자국'
   *  으로 읽혀야 하는 판에 쓴다. 굽기 열쇠에 들어가므로 본판과 따로 캐시된다. */
  solid?: string;
  /** 방금 명령을 받아 잡혀 있음 — 발밑에 임자 색 선택 링(지적: 드래그 선택 구분). */
  selRing?: boolean;
  /* ── 정보 팝업(요청: 유닛·건물 클릭하면 정보 툴팁) ─────────────────────────────
     클릭 판정과 툴팁이 이 셋만 본다. 열쇠는 프레임이 바뀌어도 같은 몸을 가리켜야
     하므로 유닛은 개체 태그, 건물은 임자·종류·자리로 짓는다. */
  pickKey?: string;
  /** 잔상 판(하템 귀신 활강) — 본체와 같은 pickKey·kind를 지니므로 보간 열쇠와 집기에서
   *  이 깃발로 가른다(지적: "하템 이동시 파란색 환영이 본체보다 살짝 뒤에 나와야 함, 본체도
   *  보여야 하고" — 열쇠가 같아 다음 장 짝 표에서 환영이 본체를 덮어썼고, 둘이 한 풀 객체를
   *  나눠 써 본체까지 파란 환영으로 그려졌다). */
  ghost?: boolean;
  /** 영문 유닛·건물 이름(표 조회용). */
  pickName?: string;
  /** 임자(플레이어 raw). */
  pickRaw?: string;
  /** 건물인가 — 툴팁이 생산·연구·큐를 보여 줄지 가른다. */
  pickBld?: boolean;
  /** 아직 짓는(변태하는) 중인 건물인가 — 그런 건물은 생산도 큐도 연구도 못 한다.
   *  팝업이 그 줄들을 아예 안 쓰는 표다(요청). */
  pickWip?: boolean;
  /** 이 건물이 제 종류의 **대표**인가(지적: "업그레이드 상황이 같은 종류의 건물 인포팝업에
   *  공통으로 뜨는 현상") ─────────────────────────────────────────────────────────────
   *  연구 기록(ups)에는 **어느 건물에서 했는지가 안 남는다** — [초, 이름, 임자]뿐이다.
   *  그래서 임자와 건물 종류만으로 견주면 그 사람의 포지 셋이 모두 같은 연구를 띄운다.
   *  지도 쪽은 이미 '대표 하나에만 단다'로 풀어 두었는데(그리는 곳의 researching), 팝업이
   *  그 잣대를 안 써서 여기서만 새어 나왔다. 그 판정을 op에 실어 두 자리가 같은 것을
   *  보게 한다 — 불이 든 건물과 연구가 적히는 건물이 반드시 같아진다.
   *  대표는 그 종류에서 가장 오래된, 지금 살아 있는 건물이다. */
  pickRep?: boolean;
  /** 이 건물의 **참값 태그** — 연구 기록이 태그를 들고 오는 판(덤프 7)에서 '어느 건물이
   *  하는 연구인가'를 정확히 가린다. 모르면 없음(그때는 위 pickRep 어림으로 돌아간다). */
  pickTag?: number;
  /** 지금 무슨 상태인가(요청: 건설·변태 등 모든 상태 노출) — 툴팁 첫 줄에 그대로 뜬다. */
  pickState?: string;
  /** 걸려 있는 마법(키) — 팝업이 그 효과와 색까지 적는다. */
  pickStatus?: string;
  /** 건물의 발자국 원점(타일) — 팝업이 '이 건물에서 나온 것'만 고르는 자다. */
  pickX?: number; pickY?: number;
};
/* ★ 자취 토막 **커서**(계측: dpr을 ¼로 줄여도 프레임 36ms 그대로 — 범인은 화소가
   아니라 JS, 그중 개체 1020기를 프레임마다 도는 고리였다. 렌더전체 15.4ms 중 준비
   9.6·개체고리 7.7·개체마커 3.4) ────────────────────────────────────────────────────
   그 고리들의 바닥 삯이 개체마다 도는 이분 탐색이다(posAt·posAtSim — 자취가 최장
   8981점). 재생은 시간이 앞으로만 가므로 지난 프레임의 토막이 이번에도 거의 그대로
   맞는다 — 자취마다 커서를 들려 주면 탐색이 사실상 O(1)이다. 결과는 한 토막도 안
   다르다(무작위 200자취 × 300질의 × 2함수로 완전 일치 확인).
   자리(고리)마다 보관함을 따로 둔다 — 같은 자취를 '지금 시각'과 '되짚기'가 번갈아
   물으면 커서가 서로를 밀어내 매번 빗나간다. WeakMap이라 자취가 걷히면 같이 걷힌다. */
export const WALK_CUR_A9 = new WeakMap<object, { i: number }>();   // 개체고리(표적 색인)
export const WALK_CUR_B9 = new WeakMap<object, { i: number }>();   // 개체마커(그리기)
export const TRUTH_CUR9 = new WeakMap<object, { i: number }>();       // 참값 상태(ST_INSIDE)
export const curOf9 = <K extends object>(m9: WeakMap<K, { i: number }>, k9: K): { i: number } => {
  let c9 = m9.get(k9);
  if (!c9) { c9 = { i: -1 }; m9.set(k9, c9); }
  return c9;
};
/* 건물 스프라이트(요청: 건물도 병목 감축) — meet(비율 유지) 상자 건물을 같은 방식으로
   굽는다. 뷰박스 밖으로 살짝 삐치는 모델(높은 첨탑 등)을 위해 15% 머리방을 둔다. */
/* 건물 채움 보정에서 빼는 것들 — 크립 판(clipWalk)은 지형이고, 애드온 통로는 본체와
   부속 사이를 잇는 폭이 곧 제 길이라 늘리면 어긋난다. 미네랄은 발자국이 아니라 덩이
   넷을 흩어 놓은 무리라 요청대로 손대지 않는다. */
/** 화가 순서의 한 타일(수리: 겹치는 건물의 앞뒤가 뒤바뀐다 · 소환구가 앞 건물에 안 가려짐)
 *  — 여태 한 타일이 80이었는데, 건물의 '나이' 항이 최대 30이었다. 그래서 아랫변이
 *  0.375타일 안으로 붙은 두 건물은 **자리가 아니라 나이가 앞뒤를 정했다**: 나란히 선
 *  건물끼리 뒤엣것이 앞을 덮었고, 갓 소환을 시작한 소환구(나이 항이 가장 크다)는 이미
 *  서 있던 앞 건물 위로 올라왔다.
 *  한 타일을 800으로 넓혀 나이는 0.1타일 미만의 **진짜 동점**만 가른다. 층 편향
 *  (자원 +1200 = 1.5타일, 유닛 +400 = 0.5타일)도 같은 배수로 따라온다. */
export const Z_TILE = 800;
/** 같은 줄에서 유닛이 건물을 이기는 몫 — 건물의 나이 가산 상한(60)보다 하나만 크다.
 *  동점을 가르는 것이 일이라 넉넉할 까닭이 없다: 넓게 주면 그만큼 뒤에 선 유닛이
 *  앞 건물을 뚫고 나온다(0.076타일). */
export const Z_UNIT_AHEAD = 61;
/** 자원이 건물보다 앞서는 몫 — **한 타일**이다.
 *  자원은 배경이라 가려지면 지도가 안 읽히고, 건물 모형은 제 발자국보다 크게 그려져
 *  같은 줄에 서 있어도 앞 자원을 덮는다. 그 몫만 메운다.
 *  ★ 2.625 → 1타일(지적: "자원이 앞에있는 건물 뒤에서도 비쳐보임") — 2.6타일은
 *    '건물 그림이 발자국보다 크다'를 메우려던 값인데, 그만큼이면 **정말 앞에 선 건물**
 *    까지 자원이 뚫고 나온다: 미네랄은 반투명(0.55)이라 건물 위에 유령처럼 겹쳐
 *    떠올랐다. 한 타일이면 같은 줄·반 타일 뒤의 건물에는 여전히 자원이 이기고,
 *    한 타일 넘게 앞에 선 건물은 제대로 자원을 가린다.
 *  ★ 값에 **그림 크기가 안 든다**(지적: "앞쪽 자원이 겹친 뒤쪽 자원에 가려진다") —
 *    여태 자원의 깊이 자리를 '그린 상자의 아랫변'(제 자리 + 그림 높이의 절반)으로
 *    잡았는데, 그러면 그림이 큰 자원이 뒤에 서 있어도 이긴다: 간헐천(4타일)은 몫이
 *    +1.5인데 미네랄(3타일)은 +1.125이라, 0.375타일 뒤의 간헐천이 앞 미네랄을 덮었다.
 *    자원끼리는 오직 **제 자리**로만 앞뒤를 가른다 — 그래서 이 몫은 붙박이 상수다. */
export const Z_RES_AHEAD = 800;
/** 건물을 지도에 그릴 때만 곱하는 몫(요청: "건물들 지도에 그릴때 1.2배 확대필요해보임").
 *  모델 좌표(BLD_NORM)가 아니라 그리는 크기라, 건물끼리의 비는 정규화가 잰 그대로다. */
export const BLD_DRAW_K = 1.2;
/** 종류마다 더 얹는 그리기 배수 — 모델 좌표(BLD_NORM)는 정규화가 잰 값이라 손대지 않고,
 *  화면에 그리는 크기만 여기서 조정한다(BLD_DRAW_K와 같은 결).
 *  스파이어 둘 1.2배(요청: "스파이어류 그려지는 크기 1.2배(특히 3d에서 보면 높아
 *  보여야함)") — 스파이어는 발자국이 2×2로 작은데 원작에서는 저그 건물 중 가장 높이
 *  솟는 것이다. 발자국에 맞춰 그리면 그 '높음'이 통째로 사라진다. */
export const BLD_DRAW_TUNE: Record<string, number> = {
  spire: 1.2, gspire: 1.2,
  // 도록 크기 보정 페이지(?cal)에서 실측해 준 배수(요청).
  // 터렛·포톤캐논(coil)·로보틱스(dome)는 1.0으로 되돌려 표에서 뺐다(재요청).
  diamond: 1.2, forge: 0.8, robobay: 1.2,   // comsat 0.6은 걷었다(지적: "컴셋 스테이션 왜 이렇게 작지") — 1.0
  tribunal: 0.8, creep: 1.2, sunken: 1.2, spore: 1.2, queensnest: 1.2, cavern: 1.4,
};
/** 프로토스 소환구 상자(타일)와 지면에서 띄우는 높이(타일) — 요청: 축소 + 더 띄우기. */
export const WARP_TILES = 1.8;
/* 0.75 → 1.35(요청: "프로토스 소환구 높이가 너무 낮아 땅에서 더 높게 띄워줘") —
   소환구는 아직 땅에 안 앉은 빛덩이라, 발자국에 가까이 붙으면 '지어진 건물'로 읽힌다.
   바닥 그림자와의 틈이 곧 높이라서 이 값이 그대로 높이감이 된다. */
export const WARP_LIFT = 1.35;
/** 공사 모델(소환구·고치·공사장)을 발자국 한가운데보다 이만큼 아래(앞)에 앉힌다(요청). */
export const CONSTRUCT_DROP = 0.55;
/** 앵커 캐시의 열쇠 — 종류만으로는 모자란다(지적: "3D에서 크립 위치가 위로 쏠린거같아").
 *  이 표가 적는 건 '판 크기에 대한 잉크 바닥의 **비**'인데, 그 비는 **보기마다 다르다**:
 *  입체(pitch)는 바닥면을 세로로 반쯤 눌러 굽으므로 같은 모델이라도 잉크가 판 안에서
 *  차지하는 세로 몫이 평면(top)의 절반쯤이다. 열쇠에 보기가 없으면 **먼저 그려진 보기의
 *  비가 다른 보기에 그대로 쓰이고**, inkBot9(= 비 × 지금 판의 크기)가 실제 잉크 바닥보다
 *  아래로 잡혀 그림이 그만큼 **위로 밀린다**. 서 있는 건물은 두 보기의 비가 비슷해 티가
 *  덜 났지만, 크립 판처럼 **바닥에 눕는 데칼**은 눌림이 곧 잉크 전부라 밀림이 크게 보였다.
 *  (같은 까닭으로 BLD_INK_BOX도 이 열쇠를 쓴다 — 부르는 쪽이 같은 열쇠를 지어야 한다.) */
export const bldAnchorKey = (kind: string, pitchView?: boolean): string => `${kind}|${pitchView ? "p" : "t"}`;
/** 같은 자리를 **모델 상자 좌표**(16-상자)로 적어 둔 것 [가로중심, 잉크 바닥].
 *  DOM 효과(방어 건물 트레이서)가 모델 위 한 점을 화면에서 다시 찾으려면, 그리기가
 *  실제로 쓴 앵커를 알아야 한다: 판은 상자 (8,16)을 발자국 바닥 가운데에 두고 굽지만,
 *  블릿은 **잉크의 바닥·가로중심**을 그 자리에 앉힌다(위 bTop9·bLeft9). 그 차이가
 *  모델마다 상자의 몇 분의 몇이라, 이 값 없이 (8,16)으로 재면 포구가 그만큼 뜬다.
 *  캔버스 층이 그 건물을 한 번 그리고 나면 채워진다(첫 프레임만 옛 어림). */
export const BLD_INK_BOX = new Map<string, [number, number]>();
/** 건물 모델 공간 정규화 배수 — 발 가운데(8,16)를 축으로 곱한다. **화면 크기가 아니다.**
 *
 *  이 표는 **`npm run bld-norm -- --emit`이 낸 값이다. 손으로 고치지 마라.**
 *  건물 모델 면을 한 줄이라도 고쳤으면 그 명령을 다시 돌려 갈아라.
 *
 *  왜 필요했나(요청: "건물들 크기가 제각각이 되지않도록 모델링은 정규화해놓고 그걸
 *  캔버스에 맞게 사용해야할거 같거든? 건물 모델링 정규화는 아까 안했지?") — 안 했다.
 *  유닛 정규화는 SHAPE_GALLERY의 group === "유닛"만 돌았고, 건물은 배수 1로 떨어졌다.
 *  실측하니 55종의 잉크 폭이 6.79 ~ 18.15로 **2.67배** 벌어져 있었고, 같은 발자국끼리도
 *  갈렸다(4×3: 사이언스 퍼실리티 11.07 대 팩토리 14.30).
 *
 *  화면에서 안 그렇게 보이던 것은 렌더러가 런타임에 가리고 있었기 때문이다 — 구운 판의
 *  잉크 폭을 재서 발자국의 95%가 되게 다시 굽던 BLD_FILL_CACHE다. 유닛에서 걷어낸 바로
 *  그 방식이고 같은 값을 치렀다: 모델을 고치면 화면 크기가 따라 흔들리고, 보정을 kind마다
 *  한 번만 재 캐시하며, 16-상자를 넘는 종류는 **잘린 잉크**를 재느라 오차가 겹쳤다.
 *  이제 그 일을 모델 좌표로 옮겼고 런타임 보정은 지웠다.
 *
 *  자: 건물은 발자국 상자에 fitWidth로 맞추므로(UnitLayer의 `sidePx = op.fitWidth ? wPx`)
 *  덩치를 정하는 것은 **잉크 '폭'** 하나다(유닛은 √(폭×높이)였다). 목표는
 *  BLD_FILL_TARGET(기본 0.95) × 16이고, 상한은 굽는 캔버스(16 + 여백 5.6×2)를
 *  안 넘는 선이다. 상한이 1보다 작은 종류는 이미 넘치고 있다는 뜻이라 "더 키우지만
 *  않는다"로 그친다 — 상한을 이유로 줄이면 멀쩡히 보이던 건물이 갑자기 작아진다.
 *  표에 없는 종류는 1(모델 그대로)이다. */
export const BLD_NORM: Record<string, number> = {
  academy: 1.470,  // 치마형 받침으로 바꾼 뒤 bld-norm 재측정
  arch: 2.079,  // 판 0.9배 뒤 재측정 2.599 × 0.8(요청: 전체 그려지는 크기 0.8배)
  archives: 1.991,  // ×0.8(요청: 그려지는 크기 0.8배) · 옛 2.489
  armory: 1.223,
  assim: 1.627,  // 재작 뒤 재측정(bld-norm)
  cavern: 1.082,
  citadel: 1.780,  // ×0.8(요청: 그려지는 크기 0.8배)
  cocoon: 2.018,
  coil: 1.337,
  comsat: 1.366,
  covert: 1.467,  // 사진 재작도 뒤 재측정(bld-norm)
  creep: 1.232,  // ×0.8(요청: 그리기 0.8배) · 옛 1.540
  ctower: 1.555,
  cube: 1.112,
  cyber: 1.578,  // ×0.8(요청: 그려지는 크기 0.8배)
  diamond: 1.905,  // 상자 상한에 걸림
  dmound: 1.111,
  dome: 1.134,  // ×0.8(요청: 그려지는 크기 0.8배)
  ebay: 1.443,   // 다리 두 마디 20% 축소 뒤 재측정(잉크 폭이 좁아져 배수는 올라간다)
  evo: 1.232,  // ×0.8(요청: 그리기 0.8배) · 옛 1.540
  extract: 0.822,  // ×0.8(요청: 그리기 0.8배) · 옛 1.027
  factory: 1.485,  // 절두체+허리 재작도 뒤 재측정(bld-norm)
  fleetbeacon: 1.700,  // ×0.8(요청: 그려지는 크기 0.8배)
  forge: 1.596,  // 발 걷어낸 뒤 재측정(bld-norm)
  gate: 1.847,  // 기둥 10% 낮춘 뒤 재측정(bld-norm)
  geyser: 1.587,
  gspire: 0.917,  // ×0.8(요청: 그려지는 크기 0.8배) · 옛 1.146
  hatchery: 1.188,
  hive: 1.320,
  hydraden: 1.070,
  lair: 1.299,
  mineral: 1.678,
  mineralb: 1.264,
  mineralc: 1.583,
  mshop: 1.523,  // −90° 요잉 뒤 재측정(bld-norm)
  nsilo: 1.354,
  nydus: 1.184,
  observatory: 1.320,  // ×0.8(요청: 그려지는 크기 0.8배)
  physlab: 1.468,  // 사진 재작도 뒤 재측정(bld-norm)
  plane: 1.200,   // 높이 1.4배 후 bld-norm 재측정
  pool: 1.159,  // ×0.8(요청: 그려지는 크기 0.8배) · 옛 1.449
  pyramidWide: 1.050,  // 재측정(bld-norm)
  queensnest: 1.148,
  refinery: 1.394,  // 입구를 가운데로 옮겨 잉크 폭이 좁아진 만큼 bld-norm 재측정
  robobay: 1.111,  // ×0.8(요청: 그려지는 크기 0.8배) · 옛 1.389
  sbattery: 1.951,  // 빨대 다리 뒤 재측정(bld-norm)
  scifac: 1.445,  // 재작도 + 삼중탑 제거·왼판 축소 뒤 재측정(bld-norm)
  spire: 1.548,  // 상자 상한에 걸림
  spore: 1.333,  // ×0.8(요청: 그리기 0.8배) · 옛 1.666
  sunken: 1.046,  // ×0.8(요청: 그리기 0.8배) · 옛 1.308
  sunkenfire: 1.391,
  tomb: 1.534,
  tombFlat: 1.724,   // 높이 1.1배·계단 2/3·그리기 크기 원복 뒤 재측정
  trapezoid: 2.487,
  tribunal: 1.563,  // ×0.8(요청: 그려지는 크기 0.8배)
  turret: 1.966,  // 받침을 절두체로 바꾸고 다시 잼
  warpin: 2.196,
};

/** 공사 단계 — 모델을 **부품 단위로** 아래에서부터 드러낸다.
 *
 *  여태는 구운 판을 화면 사각형으로 잘라 보여 줬다(지적: "그냥 구운 이미지를 잘라서
 *  보여줬어. 그게 아니라 실제 부품을 아래에서부터 몇개씩 보여주자는 얘기였어").
 *  그러면 기둥이 반 토막 난 채 서고 지붕이 가로로 잘려 '짓는 중'이 아니라 '가려진'
 *  것으로 보인다.
 *
 *  부품 경계는 이미 자료에 있다 — 빌더가 부품마다 tagKey로 깊이 키를 매기고, 키를
 *  안 단 면은 바로 앞 면의 키를 물려받는다(zsorted 규약). 그 묶음이 곧 부품이다.
 *  묶음마다 꼭대기(경로 최소 y — 이 좌표계는 y가 아래로 커진다)를 재고, 꼭대기가
 *  낮은 것부터 세운다: 발판·다리·바닥 슬래브가 먼저 서고 지붕·굴뚝·안테나가 마지막에
 *  얹힌다. 고른 부품은 **통째로** 그리므로 잘린 단면이 안 생긴다.
 *  그리는 차례는 원래 순서 그대로 둔다(칠하는 순서가 곧 앞뒤라 재정렬하면 안 된다). */
/** 공사 단계 수(요청: 3단계 부족하면 5단계로) — 부품이 많은 건물일수록 3칸으로는 한
 *  칸에 3분의 1이 통째로 솟아 '자라는' 대신 '툭 나타나는' 것으로 보인다. */
export const BUILD_STAGES = 5;
/** 전투 효과 op(요청: 이펙트 캔버스 이관) — 트레이서·날아가는 탄·럴커 가시·피격
 *  불티·실드막을 DOM 스팬 대신 이 숫자 묶음으로 UnitLayer 캔버스가 그린다.
 *  좌표 규약은 CSS 시절 그대로다: fx/fy는 렌즈 분수 앵커, 길이·오프셋은 **렌즈 px**
 *  (그릴 때 zoom을 곱한다), deg는 CSS rotate와 같은 시계방향(0 = 화면 아래)이다. */
export type FxOp = {
  kind: "beam" | "shot" | "spike" | "erupt" | "hit" | "shield" | "cage" | "tether" | "burst";
  /** burst(죽음·파괴 폭발): 낱개 흩뿌림의 씨앗(개체마다 다르게) · 건물이면 bld. */
  seed?: number; bld?: boolean;
  fx: number; fy: number;
  /** 가슴 높이 들기(렌즈 px) — 럴커 가시만 0(땅에서 솟는다). */
  lift: number;
  /** 총구 오프셋(렌즈 px) — 앵커에서 이동한 뒤 deg로 돈다(CSS translate→rotate 순서). */
  mx?: number; my?: number;
  deg?: number;
  /** 트레이서 갈래(scr-tracer-*의 이름) — 없으면 기본(총구) 꼴. */
  style?: string;
  /** shot: 표적까지 화면 거리 · spike: 가시 길이(렌즈 px). */
  len?: number;
  /** shot: **발사 때 겨눈 각**(도) — 유도탄은 이 방향으로 나가서 지금 표적 쪽으로 튼다.
   *  표적이 안 움직였으면 deg와 같아 곧게 간다(요청: "가만히 있는데도 처음부터 휘어서 감"). */
  d0?: number;
  /** shot: 진행률 0~1. */
  u?: number;
  /** 반짝 위상 0~1 — beam은 쿨다운 주기, hit/shield는 제 창 안의 진행. */
  ph?: number;
  /** hit: **표적 스플래시**(쏘는 쪽 박자로 표적에 얹는 그림 — 커세어 플레어·아콘 잽). 트레이서에
   *  가까운 것이라 파편이 아니라 제 납작 타원으로 그린다. 맞는 쪽 체력이 깎일 때의 진짜 피격은
   *  이 깃발이 없어 같은 무기 갈래(style)여도 파편이 난다. */
  splash?: boolean;
  /** hit/shield: 기준 크기(렌즈 px) — 몸 상자(fxPx) 비례값이 실려 온다. */
  size?: number;
  /** hit: 맞은 방향 단위벡터(화면) — 없으면 몸 가운데. */
  dx?: number; dy?: number;
  /** hit: **맞은 몸의 결**(요청: "자신의 피해 효과 … 죽음 효과랑 결을 같이") —
   *  살은 피, 프로토스는 에너지, 기계는 불꽃. 죽음 효과(scr-die-*)와 같은 넷이다.
   *  hit의 `style`은 이것과 짝을 이루는 **때린 무기**의 갈래다(FX_IMPACT). */
  mat?: "bio" | "mech" | "toss" | "zerg" | "cocoon";
  /** hit: 몸 가운데에서 **맞은 자리**까지(렌즈 px) — 없으면 size의 0.71배.
   *  건물은 발자국이 몸 상자와 따로 놀아(4×3 해처리) 제 값을 실어 보낸다. */
  dist?: number;
  /** tether: 선의 **반대 끝**(지도 분수) — 이쪽 끝은 fx·fy다. */
  tx?: number; ty?: number;
  /** tether: 반대 끝의 들림(렌즈 px) — 배는 떠 있으므로 이쪽만 따로 든다. 없으면 lift. */
  tlift?: number;
};
/** 트레이서 갈래의 캔버스 값 — CSS(.scr-tracer-*)의 폭·길이·그러데이션을 옮긴 표다.
 *  단위는 렌즈 px(그릴 때 zoom을 곱한다). tri는 쐐기(글레이브·파편·가시), glow는
 *  box-shadow를 흉내 내는 넓고 옅은 밑줄이다. base는 무기 클래스가 없던 스팬의 꼴. */
export const FX_BEAM: Record<string, {
  w: number; l: number; g: [number, string][]; glow?: string; tri?: boolean;
  /** 연기 자취를 남기나 — 참이면 날아가는 동안 꼬리가 총구에 붙어 선이 자란다(미사일). */
  trail?: boolean;
  /** 연기를 **동그란 덩이로** 그리나(지적: "긴 흰 띠가 아니라 진행 방향을 따라 동그라미
   *  연기가 늘어서는 모양") — 값은 덩이 사이 간격을 굵기에 매어 정하는 배수다. 자세한
   *  사정은 그리는 자리의 ★ 주석에. */
  puff?: number;
  /** 그 덩이의 **속**색 — 그러데이션은 머리(불꽃)의 것이라 연기에 그대로 쓸 수 없다. */
  smoke?: string;
  /** 덩이의 **테두리**색(지적: "흰색에 연한 하늘색 테두리(그라데이션)") — 속에서 테로
   *  가는 방사 그러데이션의 바깥 끝이다. */
  smokeEdge?: string;
  /** ★ 연기 자취 앞에 세우는 **삼각 탄두**의 색(요청: "기존 미사일 둥근 연기 늘어섬은
   *  유지하고 삼각 탄두 추가" · "은색의 짧은 삼각형 탄두" · "스카우트는 금색 탄두").
   *  없으면 옛 흰 캡슐 몸통이다. 코가 **진행 방향**을 가리킨다 — 일반 tri 갈래(글레이브·
   *  파편)는 밑변이 앞서는 혜성 꼴이라 탄두와 방향이 정반대다(지적: "탄두 삼각형 방향
   *  반대로됐음"). 그 갈래를 안 건드리고 여기서 따로 그리는 까닭이 이것이다. */
  warhead?: string;
  /** 연기 덩이가 나이 들며 옅어지는 몫(0~1) — 클수록 총구 쪽이 빨리 사라진다. 기본 0.45. */
  smokeFade?: number;
  /** 제자리 번쩍임의 주기(초) — CSS animation-duration을 옮긴 값. 인라인 주기(유닛
   *  쿨다운)가 없는 쪽(방어 건물)이 이 값으로 위상을 만든다. */
  dur?: number;
  /** 그러데이션의 **0 쪽이 총구**인가(지적: "트레이서 디자인 상 방향이 반대로
   *  뒤집혀야할거같아 … 동그란 광전자가 드라군쪽에 있고 그 잔상이 앞쪽인데").
   *
   *  전수조사 결과 갈래는 둘이었다:
   *   · **날아가는 것**(기본) — 밝은 머리가 **앞**(표적 쪽)이고 잔상이 뒤로 남는다.
   *     플라즈마·포톤·미사일·독구슬·가시·글레이브·파편·포탄·시즈·레이저·볼트·
   *     플레어·버스트·잽이 여기다. 여태 전부 거꾸로였다 — 밝은 구슬이 총구에
   *     붙고 꼬리가 표적 쪽으로 뻗어, 탄이 뒤로 나는 그림이었다.
   *   · **총구에서 뿜는 것**(muzzleLit) — 총구가 가장 밝고 앞으로 갈수록 사그라든다.
   *     총구 화염(base·gun)과 화염방사(flame)뿐이다. 이건 뒤집으면 안 된다:
   *     불꽃이 총구에서 떨어져 나와 허공에서 타는 그림이 된다. */
  muzzleLit?: boolean;
  /** **표적까지 잇나**(요청: "아콘 지지기 트레이서 필요") ────────────────────────────
   *  기본 번쩍임은 제 길이(l)만큼만 앞으로 뻗고 표적을 안 넘는다 — 총알·광선처럼 실제로
   *  '길이가 있는 것'의 꼴이다. 그런데 아콘의 사이오닉 충격파는 **닿는 것 자체가 그림**
   *  이라, 토막으로 뻗으면 몸 앞에 파란 조각이 깜빡일 뿐 무엇을 지지는지가 안 읽힌다.
   *  참이면 길이를 표적까지(reach)로 늘려, 쏘는 몸과 맞는 몸이 한 줄기로 이어진다. */
  span?: boolean;
  /** **꺾어 긋나**(지적: "남색선은 구린데") — 마디 수. ─────────────────────────────
   *  곧은 선은 그으면 막대다. 지지기(아콘)는 두 몸 사이에 걸린 번개라, 곧게 그으면
   *  아무리 색을 밝혀도 '남색 막대'로 읽힌다. 마디마다 좌우로 튀게 하면 같은 색·같은
   *  길이가 그대로 번개가 된다 — 고칠 것은 색이 아니라 **꼴**이었다.
   *  튀는 무늬는 위상(ph)을 씨앗으로 뽑는다: 같은 순간은 늘 같은 무늬고(굽기·다시
   *  그리기에 흔들리지 않는다) 번쩍이는 동안 몇 번 갈린다. */
  zig?: number;
  /** 번짐 획의 굵기 배수·짙기(요청: "양쪽 모서리에 푸른 빛으로 처리") ─────────────────
   *  기본은 2.6배·0.3으로, 몸 밖으로 넓게 퍼지는 **후광**이다. 그 값을 좁히고 짙게 하면
   *  같은 획이 후광이 아니라 **테두리**가 된다 — 흰 몸 양옆에 푸른 선이 나란히 서는 꼴이다.
   *  곧 '모서리에 푸른 빛'은 새 획이 아니라 이 두 수의 문제다. */
  glowW?: number;
  glowA?: number;
  /** 끝 마감 — 기본은 둥근 끝(round)이다. 번개처럼 **몸에서 자라 나오는** 것은 둥근
   *  마개가 붙으면 끝에 구슬이 달린 꼴이 되므로 잘린 끝(butt)으로 둔다(지시). */
  cap?: CanvasLineCap;
  /** 나오는 쪽(총구 끝)이 **사그라들기 시작하는 자리**(0=머리 … 1=꼬리) ─────────────
   *  지시: "나오는 쪽은 페이드아웃 살짝 해서 자연스럽게 섞이게". 몸에서 뻗어 나오는
   *  그림은 뿌리가 딱 끊기면 붙여 놓은 막대로 읽힌다 — 뿌리를 흐리면 몸에 스며든다.
   *  몸 색은 표(g)의 마지막 칸으로 직접 적고, 테두리 색은 아래 glowEnd가 맡는다. */
  fadeAt?: number;
  /** 그 자리에서 테두리가 다다를 색 — 같은 색의 알파 0을 적는다(다른 색을 적으면 뿌리에
   *  엉뚱한 물이 든다). fadeAt과 짝이다. */
  glowEnd?: string;
}> = {
  base: { muzzleLit: true, w: 0.25, l: 1.5, dur: 0.22, g: [[0, "rgba(255,232,120,0.98)"], [1, "rgba(255,200,60,0)"]] },
  gun: { muzzleLit: true, w: 0.35, l: 1.1, dur: 0.22, g: [[0, "rgba(255,232,120,0.98)"], [1, "rgba(255,200,60,0)"]] },
  cannon: { dur: 0.85, w: 0.75, l: 1.3, g: [[0, "rgba(255,196,92,0.98)"], [1, "rgba(255,132,30,0)"]] },
  siege: { dur: 1.0, w: 1, l: 3.5, g: [[0, "rgba(255,214,130,0.98)"], [0.25, "rgba(255,214,130,0.98)"], [0.7, "rgba(255,128,24,0.85)"], [1, "rgba(255,110,16,0)"]] },
  flame: { muzzleLit: true, dur: 0.3, w: 1.5, l: 2, g: [[0, "rgba(255,226,150,0.95)"], [0.18, "rgba(255,226,150,0.95)"], [0.55, "rgba(255,110,40,0.9)"], [1, "rgba(220,40,20,0)"]] },
  spine: { dur: 0.45, w: 0.3, l: 2, g: [[0, "rgba(170,255,90,1)"], [1, "rgba(120,230,40,0)"]], glow: "rgba(150,255,80,0.6)" },
  bolt: { dur: 0.6, w: 0.6, l: 2, g: [[0, "rgba(150,200,255,0.95)"], [1, "rgba(150,200,255,0)"]] },
  glave: { dur: 0.24, w: 1.05, l: 1.9, g: [[0, "#6b4732"], [1, "#6b4732"]], tri: true, glow: "rgba(120,84,58,0.6)" },
  frag: { dur: 0.24, w: 0.95, l: 1.8, g: [[0, "#b9bfc6"], [1, "#b9bfc6"]], tri: true, glow: "rgba(200,210,220,0.55)" },
  /* 미사일(요청: "발키리 연기 미사일 트레이서여야함") — 머리는 흰 불꽃, 몸통부터는
     회색 연기가 길게 퍼진다. 옛 값(0.55×3.75)은 너무 가늘고 짧아 총알과 안 갈렸다. */
  /* 미사일의 결은 **흰빛에 푸른 기, 뒤로 갈수록 회색 연기**다(지적: "흰색에 푸른 색
     회색 섞인 톤 주황아님") — 앞판은 머리 바로 뒤가 크림빛(255,224,168)이라 화염으로
     읽혔다. 미사일은 고체 추진제 연기를 뿜는 물건이지 불덩이가 아니다. */
  /* 미사일류는 **가늘게**(요청: "미사일류 트레이서 두께 축소") — 0.8 → 0.5. 이 갈래는
     잔상(trail)까지 달고 길이도 5.2로 가장 긴데, 굵기까지 굵으니 화면에서 미사일이
     아니라 흰 막대로 읽혔다. 두 발이 나란히 나가는 무기라(그 자리 주석) 굵기가 줄면
     두 발이 갈려 보이는 이득도 있다. */
  /* ★ 미사일은 **은색의 짧은 삼각 탄두**다(요청) — 앞판은 길이 5.2에 연기 덩이 열둘을
     달고 흰 그러데이션으로 뿜는 자취라, 탄두가 아니라 '흰 연기 줄'로 읽혔다. 날아가는
     것은 짧고 단단한 쇳덩이여야 그 뒤가 비어 있어도 탄으로 보인다.
     tri를 켜 머리가 뾰족한 삼각으로 그리고(그 갈래가 이미 있다), 길이를 5.2 → 2.1로
     줄이며 연기 자취(trail·puff·smoke)를 통째로 걷는다. 색은 흰빛이 아니라 은색
     계열이라 강철 탄두로 읽힌다. */
  /* ★ 되돌리고 **얹는다**(요청: "기존 미사일 둥근 연기 늘어섬은 유지하고 삼각 탄두
     추가하라는 뜻임") — 앞판은 연기를 통째로 걷고 삼각 하나만 남겼는데, 요청은 연기를
     지우라는 것이 아니라 그 앞에 탄두를 세우라는 것이었다. 연기 덩이(puff·smoke·
     smokeEdge)를 그대로 되살리고, 옛 흰 캡슐 몸통 자리에 **은색 삼각 탄두**를 세운다.
     ★ 자취가 **총구에 안 붙는다**(요청: "기존 연기는 유지하되 더 빠르게 페이드 아웃되게
       유지시간 많이 줄이기") — trail이 켜져 있으면 꼬리가 총구에 못 박혀 연기가 나는
       내내 안 사라진다. 그 못을 뽑으면 꼬리가 머리 뒤 l만큼만 따라오므로, 연기의
       '유지시간'이 곧 머리가 l을 지나는 동안이다. l 24렌즈px이면 3타일 사격에서 자취가
       길의 4분의 1쯤이고 덩이는 다섯 남짓이다 — 늘어선 덩이는 그대로 보이되 총구까지
       이어지지는 않는다. 거기에 나이 몫(smokeFade)을 0.45 → 0.85로 올려 총구 쪽이 거의
       다 지워진 채로 끝난다.
     ★ 크기 20% 축소(요청) — w 0.5 → 0.4. 덩이 반지름·덩이 간격·탄두·불꽃이 전부 이
       하나에 매여 있으므로(그리는 자리의 셈), 한 값만 줄이면 자취가 통째로 같은 비로
       작아진다. 하나씩 줄이면 덩이가 서로 파묻히거나 벌어진다.
     ★ 다시 **75% 축소**(재요청: "탄두랑 연기 모두 75프로 축소") — w 0.4 → 0.1이다.
       그리고 **덩이는 더 촘촘히**(재요청: "연기 트레이서 더 자주 나오게 해 지금 너무
       띄엄띄엄 나옴") — 간격 배수 puff 12 → 5. 이 둘은 한 벌이라야 뜻이 산다: 덩이가
       4분의 1로 작아졌는데 간격을 그대로 두면 점선이 되고, 간격만 줄이면 덩이가 서로
       파묻혀 도로 한 줄기 띠가 된다. 지금 값이면 덩이 지름 0.76 · 간격 0.5(w 단위)라
       이웃끼리 살짝 겹치는 촘촘한 자취가 된다.
     ★ 색에서 **흰색을 걷는다**(요청: "탄두는 흰색 없이 면 전체를 은/금색으로") —
       탄두 #dfe5ec는 사실상 흰색이었고, 배기 불꽃 그러데이션의 0쪽도 순백이라 탄두
       둘레가 늘 하얗게 떴다. 탄두를 제 금속색(은 #a8b0bc · 금 #c9a132)으로 굳히고
       그러데이션·연기 속색도 그 계열의 밝은 값으로 내린다.
     ★ 두 줄기가 겹쳐 하나로 보이던 일도 이 축소가 함께 푼다 — 벌리는 폭은
       `(잉크 폭 − 잔상 굵기) / 2`인데(그 자리 주석), 잔상 굵기가 w에 매여 있어 굵을수록
       벌림이 0으로 죄어졌다. w가 4분의 1이면 그 뺄셈이 남으므로 골리앗·레이스·발키리·
       스카우트의 두 발이 제 간격으로 갈린다(미사일 터렛 건물은 종전대로 한 줄기다). */
  /* ★ 연기 손질 셋(요청: "그리는 빈도 10프로 줄이고 좀 더 전체적으로 푸른빛 가미,
     없어지는 타이밍 더 빠르게") ────────────────────────────────────────────────────
     · 빈도 −10% — 덩이 사이 간격(puff)이 곧 빈도의 역수라 5 → 5.6이다(1/1.11).
       간격의 바닥값(step9의 0.9)도 같은 몫으로 올려, 아주 가까운 사거리에서 바닥이
       실제 간격을 지배할 때도 10%가 그대로 걸리게 한다.
     · 푸른빛 — 속(smoke)과 그러데이션의 파랑을 올리고 빨강·초록을 내린다. 테(smokeEdge)
       는 이미 하늘빛이라 한 단만 더 짙게 한다. 흰 속을 통째로 파랗게 물들이지는 않는다:
       그러면 연기가 아니라 '푸른 광선'이 된다 — 흰 속에 푸른 기가 도는 정도다.
     · 더 빨리 사라짐 — 자취의 수명(dur)을 0.4 → 0.28초로 줄이고, 총구 쪽이 먼저
       사그라드는 몫(smokeFade)을 0.85 → 0.95로 올린다. 둘은 다른 일이다: dur는 자취
       **전체**가 사는 시간이고 smokeFade는 한 자취 **안에서** 꼬리가 옅어지는 기울기다.
       함께 올려야 '뒤가 먼저 지워지며 짧아지다 그친다'가 된다. */
  missile: { dur: 0.28, w: 0.1, l: 24, puff: 5.6, smoke: "#e2ecfa", smokeEdge: "#8fc6ff", smokeFade: 0.95, warhead: "#a8b0bc", g: [[0, "rgba(220,232,248,1)"], [0.1, "rgba(196,218,244,0.94)"], [0.32, "rgba(176,200,232,0.6)"], [0.68, "rgba(154,172,196,0.32)"], [1, "rgba(134,150,174,0)"]], glow: "rgba(168,198,238,0.5)" },
  /* 스카우트의 대공탄 — 미사일과 한 몸이되 **탄두만 금색**이다(요청: "스카우트는 테란과
     달리 금색 탄두 나가기"). 프로토스의 무기는 은색 쇳덩이가 아니라는 결이다. */
  /* 금색(스카우트)은 **색만 그대로** 둔다 — 푸른빛을 섞으면 금이 회색으로 죽어, 테란과
     가르려고 금으로 세운 뜻이 사라진다(요청: "스카우트는 테란과 달리 금색 탄두"). 빈도와
     수명은 같은 무기 갈래이므로 위와 같은 값으로 맞춘다. */
  missileG: { dur: 0.28, w: 0.1, l: 24, puff: 5.6, smoke: "#f4eddc", smokeEdge: "#ffe6a8", smokeFade: 0.95, warhead: "#c9a132", g: [[0, "rgba(248,238,214,1)"], [0.1, "rgba(240,226,190,0.94)"], [0.32, "rgba(224,206,160,0.6)"], [0.68, "rgba(190,170,120,0.32)"], [1, "rgba(160,142,100,0)"]], glow: "rgba(235,210,150,0.5)" },
  acid: { dur: 0.75, w: 1.3, l: 2.25, g: [[0, "rgba(206,150,255,0.95)"], [0.2, "rgba(206,150,255,0.95)"], [0.6, "rgba(150,80,220,0.7)"], [1, "rgba(110,50,170,0)"]] },
  plasma: { dur: 0.24, w: 0.85, l: 2.75, g: [[0, "rgba(232,244,255,0.98)"], [0.18, "rgba(232,244,255,0.98)"], [0.55, "rgba(120,180,255,0.9)"], [1, "rgba(70,120,255,0)"]], glow: "rgba(120,180,255,0.55)" },
  flare: { dur: 0.22, w: 0.5, l: 1.75, g: [[0, "rgba(200,230,255,0.95)"], [1, "rgba(120,180,255,0)"]] },
  /* ★ 레이저는 **날아가는 얇은 주황 선**이다(요청: "배틀크루저(대공/대지) 레이스(대지)
     뾱뾱 공격 — 주황 얇은 선 미사일, 이어지지 않고 얇고 살짝 긴 선이 미사일처럼 이동")
     ────────────────────────────────────────────────────────────────────────────────
     여태 이 갈래는 총구에 못 박힌 번쩍임이었다(PROJECTILE_FX 밖). 그러면 원작의 '뾱뾱'이
     안 산다 — 원작에서 이 둘은 짧은 광탄이 **날아가 꽂히는** 무기이고, 그 날아가는 동안이
     곧 '뾱'이다. 못 박아 두면 총구 앞에 막대가 서 있다 사라질 뿐이라 두 발이 이어진
     한 줄기로 읽힌다.
     색은 붉은빛(255,120,100)에서 **주황**으로, 굵기는 한 단 더 얇게(0.4 → 0.3), 길이는
     살짝 길게(1.75 → 2.4). 얇고 조금 긴 것이 곧 '선이 아니라 탄'의 꼴이다 — 굵으면
     빛줄기가 되고 짧으면 점이 된다.
     쓰는 것은 배틀크루저와 레이스 지상 둘뿐이라, 이 갈래를 고치는 것이 곧 그 둘을 고치는
     것이다(다른 갈래를 새로 만들면 표에 안 쓰는 이름이 하나 는다). */
  laser: { dur: 0.28, w: 0.3, l: 2.4, g: [[0, "rgba(255,236,190,0.98)"], [0.22, "rgba(255,176,72,0.96)"], [1, "rgba(255,138,32,0)"]], glow: "rgba(255,170,70,0.45)" },
  burst: { dur: 0.22, w: 0.4, l: 2, g: [[0, "rgba(255,244,200,0.95)"], [1, "rgba(255,244,200,0)"]] },
  /* 아콘 — **표적까지 잇는다**(요청, 위 span). 양 끝이 밝고 가운데가 옅은 그러데이션은
     그대로 둔다: 늘여 놓으면 그 꼴이 곧 '두 몸 사이에 걸린 번개'가 된다. */
  /* 아콘 — **표적까지 잇는다**(요청, 위 span·zig). 양 끝이 밝고 가운데가 옅은 그러데이션은
     늘여 놓으면 그대로 '두 몸 사이에 걸린 번개'가 된다. 굵기는 0.6 → 0.8 — 토막이던
     시절의 값이라, 길게 걸리고 나서는 한 단 굵어야 번개로 읽힌다. */
  /* 몸은 **순백**, 양옆은 **푸른 테두리**(요청) — 몸 획을 흰색으로만 두고 그 아래 푸른
     획을 1.9배 굵기·0.9 짙기로 깔면, 삐져나온 몫이 좌우에 나란한 푸른 선이 된다. */
  zap: { dur: 0.2, w: 1.15, l: 2.25, span: true, zig: 5, cap: "butt",
    glow: "rgba(96,170,255,0.95)", glowW: 1.9, glowA: 0.9,
    fadeAt: 0.72, glowEnd: "rgba(96,170,255,0)",
    g: [[0, "rgba(255,255,255,1)"], [0.72, "rgba(255,255,255,1)"], [1, "rgba(255,255,255,0)"]] },
  venom: { dur: 0.26, w: 1.05, l: 2.5, g: [[0, "rgba(240,255,140,0.98)"], [0.2, "rgba(240,255,140,0.98)"], [0.55, "rgba(190,230,60,0.85)"], [1, "rgba(140,190,30,0)"]] },
  /* ★ 가시는 **흑갈색**이다(재지적: "럴커 가시 흑갈색변경요청했는데 안된듯") — 앞선
     지적을 성큰의 주황(erupt)만 남기고 이쪽 표를 안 고쳐 여태 주황이었다. 럴커의 가시는
     불이 아니라 **땅에서 솟는 뼈**라 짙은 흙빛이어야 한다: 뿌리가 거의 검고 끝으로 갈수록
     마른 갈색으로 밝아진다(끝이 더 밝아야 솟은 방향이 읽힌다). */
  spike: { dur: 0.6, w: 1, l: 6, g: [[0, "rgba(92,62,38,0.98)"], [1, "rgba(26,17,11,0.98)"]], tri: true },
};
/** 이 갈래가 표적까지 잇나 — 만드는 쪽(사거리 죔)도 이 값을 봐야 한다. */
export const st9Span = (name: string | undefined): boolean => !!(name && FX_BEAM[name]?.span);
/** 무기가 **닿았을 때**의 그림(요청: "피격시 무조건 주황색 폭발로 처리되는데 공격
 *  종류별로 달라야할거 같음. 시즈처럼 피격효과가 별도로 있는건 그대로 그려주고") ──────
 *  갈래 이름은 트레이서 표(FX_BEAM)와 같다 — 나간 빛과 닿은 빛이 같은 색이어야
 *  '저게 저걸 때렸다'가 읽힌다. r은 맞은 몸 상자에 대한 배수, g는 복사 그러데이션,
 *  ring이 있으면 충격파 고리 한 줄이 더 돈다.
 *  표에 **없는 무기와 근접 공격은 여기서 아무것도 안 그린다** — 그때는 아래 몸의 결
 *  (FX_MAT)만 튄다. 여태 무엇에 맞았든 주황 폭발이 났던 자리가 이곳이다. */
/** 피격 그림의 크기 손잡이(요청: "피격 효과 크기 축소") — 아래 표의 r과 몸의 결
 *  (FX_MAT) 얼룩이 **함께** 이 몫을 탄다. 표를 스무 줄 고치는 대신 한 수를 둔 까닭은,
 *  갈래끼리의 크기 차(가시 0.68 · 화염 1 · 미사일 1.1)가 그 무기의 성질이라 그 비는
 *  지키고 전체만 줄여야 하기 때문이다. 더 줄이려면 이 수 하나만 내리면 된다. */
export const HIT_FX_K = 0.72;
export const FX_IMPACT: Record<string, {
  r: number; g: [number, string][]; ring?: string;
  /** 세로 눌림(1이면 원) — 지면에 눕듯 넓적하게 퍼지는 피격에 준다. */
  flat?: number;
}> = {
  gun: { r: 0.5, g: [[0, "rgba(255,250,225,0.95)"], [0.5, "rgba(255,200,110,0.4)"], [1, "rgba(255,180,80,0)"]] },
  base: { r: 0.5, g: [[0, "rgba(255,250,225,0.95)"], [0.5, "rgba(255,200,110,0.4)"], [1, "rgba(255,180,80,0)"]] },
  laser: { r: 0.55, g: [[0, "rgba(255,245,220,0.95)"], [0.45, "rgba(255,176,72,0.5)"], [1, "rgba(255,138,32,0)"]] },
  /* 커세어 — **표적에 넓적한 타원 플라즈마**다(요청: "커세어는 트레이서가 자기 자신
     쪽엔 없고 대상한테 넙적한 타원 형태로 플라즈마 표시가 나와야 해"). 원작의 뉴트론
     플레어는 날아가는 탄이 아니라 표적 둘레에 퍼지는 방전이라, 쏘는 쪽에서 뻗는 선이
     아예 없다(아래 NO_BEAM_FX). 크게(0.55 → 1.05) 잡고 세로로 눌러(0.5) 몸을 감싸는
     넓적한 빛으로, 고리 한 줄을 더해 '퍼진다'를 보인다. */
  /* ★ 프로토스 에너지 피격 둘(커세어·아콘)은 **작고 또렷한 납작 타원**이다(지시:
     "닿는 지점에 넙적 타원 모양으로 선명하게 — 지금처럼 너무 크고 번지는 느낌 X" ·
     "커세어도 마찬가지임") ────────────────────────────────────────────────────────
     번짐으로 읽히던 까닭이 셋이었다:
       ① 크다 — 반지름 배수가 1.05·0.9로 표에서 가장 큰 축이었다. 0.6 안팎으로 줄인다.
       ② 그러데이션이 **일찍 무너진다** — 38%에서 벌써 반투명이라 가운데부터 흐렸다.
          82%까지 거의 불투명으로 끌고 가다 마지막에만 떨어뜨리면 테두리가 선다.
          '선명함'은 색이 아니라 **알파가 언제 꺾이나**다.
       ③ 밖으로 퍼지는 고리(ring)가 달려 있었다 — 그건 충격파의 그림이지 '꽂혔다'의
          그림이 아니다. 뗀다.
     납작비는 커세어의 것(0.5)을 둘이 나눠 쓴다 — 지면에 눕는 타원이라 '닿은 자리'가
     바닥에 붙어 읽힌다. */
  flare: { r: 0.62, flat: 0.42,
    g: [[0, "rgba(255,255,255,1)"], [0.52, "rgba(255,255,255,1)"], [0.8, "rgba(96,170,255,0.95)"], [1, "rgba(96,170,255,0)"]] },
  burst: { r: 0.55, g: [[0, "rgba(255,252,225,0.95)"], [0.45, "rgba(255,238,150,0.45)"], [1, "rgba(255,230,120,0)"]] },
  bolt: { r: 0.75, g: [[0, "rgba(225,240,255,0.95)"], [0.4, "rgba(150,200,255,0.5)"], [1, "rgba(120,170,255,0)"]] },
  /* 줄기와 **같은 결**이다(요청: "스플래시도 마찬가지") — 가운데는 순백, 바깥 테가 푸르다.
     알파를 0.8까지 끌고 가다 끝에서만 떨어뜨려야 그 테가 번짐이 아니라 테두리로 선다. */
  zap: { r: 0.58, flat: 0.42,
    g: [[0, "rgba(255,255,255,1)"], [0.52, "rgba(255,255,255,1)"], [0.8, "rgba(96,170,255,0.95)"], [1, "rgba(96,170,255,0)"]] },
  frag: { r: 0.62, g: [[0, "rgba(255,255,250,0.95)"], [0.4, "rgba(205,214,224,0.5)"], [1, "rgba(180,190,200,0)"]] },
  glave: { r: 0.62, g: [[0, "rgba(240,220,190,0.9)"], [0.45, "rgba(150,105,70,0.5)"], [1, "rgba(107,71,50,0)"]] },
  spine: { r: 0.68, g: [[0, "rgba(230,255,190,0.95)"], [0.4, "rgba(150,235,70,0.5)"], [1, "rgba(120,200,40,0)"]] },
  spike: { r: 0.8, g: [[0, "rgba(150,116,80,0.95)"], [0.4, "rgba(92,62,38,0.6)"], [1, "rgba(26,17,11,0)"]] },
  venom: { r: 0.85, g: [[0, "rgba(250,255,190,0.95)"], [0.35, "rgba(200,240,70,0.6)"], [1, "rgba(140,190,30,0)"]] },
  acid: { r: 0.9, g: [[0, "rgba(238,210,255,0.95)"], [0.35, "rgba(180,110,240,0.6)"], [1, "rgba(110,50,170,0)"]] },
  plasma: { r: 0.82, g: [[0, "rgba(240,250,255,0.98)"], [0.34, "rgba(120,180,255,0.6)"], [1, "rgba(70,120,255,0)"]], ring: "rgba(170,215,255,0.55)" },
  flame: { r: 1, g: [[0, "rgba(255,240,190,0.95)"], [0.3, "rgba(255,140,50,0.65)"], [1, "rgba(200,50,20,0)"]] },
  // 터지는 쪽도 같은 결이다(같은 지적) — 주황 불꽃을 걷고 흰빛 섬광 + 회푸른 연기로.
  missile: { r: 1.1, g: [[0, "rgba(255,255,255,0.98)"], [0.3, "rgba(196,220,255,0.6)"], [0.62, "rgba(158,166,178,0.34)"], [1, "rgba(138,146,158,0)"]], ring: "rgba(220,232,245,0.45)" },
  // 스카우트의 금 탄두(missileG)가 맞는 그림 — 미사일과 같은 결이되 금빛이다.
  missileG: { r: 1.1, g: [[0, "rgba(255,250,232,0.98)"], [0.3, "rgba(255,228,160,0.6)"], [0.62, "rgba(198,172,110,0.34)"], [1, "rgba(170,150,100,0)"]], ring: "rgba(245,228,180,0.45)" },
  cannon: { r: 1, g: [[0, "rgba(255,238,190,0.98)"], [0.32, "rgba(255,150,50,0.7)"], [1, "rgba(210,80,20,0)"]] },
  /* 시즈만 크다 — 원작에서도 이 한 발은 **주위까지 함께 터지는** 유일한 지상 포격이다
     (요청이 "시즈처럼 피격효과가 별도로 있는건"이라고 짚은 그것). 고리가 그 범위다. */
  siege: { r: 1.75, g: [[0, "rgba(255,246,210,0.98)"], [0.22, "rgba(255,190,90,0.85)"], [0.55, "rgba(255,110,30,0.55)"], [1, "rgba(190,60,10,0)"]], ring: "rgba(255,190,110,0.5)" },
};
/* (걷어냄) lowZoomB — 저배율(detailAt 미만)에서 유닛 캔버스 배킹을 1배로 죄던 값이다.
 *
 *  왜 있었나: "칠하는 픽셀 수가 병목"이라는 계측(프레임 133ms 중 83ms가 스프라이트
 *  칠하기)에서 나온 값이고, 픽셀 수는 배킹 배수 B의 **제곱**으로 는다. 그래서 지도
 *  전체를 보는 1·2배 칸에서는 B를 1로 죄어 넉 배(dpr 2)·아홉 배(dpr 3)를 아꼈다.
 *  무엇이 문제였나(지적: "모바일 게임 상세에서 지도는 선명한데 유닛·건물은 아직도
 *  흐리다"): 지도 판은 기기픽셀 격자에 1:1로 굽는데(커밋 4868c88 갈래) 유닛 캔버스만
 *  화면 요구의 1/dpr로 서 있었다. 한 화면 안에서 선명한 지도와 뭉갠 유닛이 나란히
 *  놓이면, 흐린 쪽이 '덜 그려진 것'으로 읽힌다 — 그 대비가 흐림 자체보다 눈에 띈다.
 *  왜 이제 걷나: **다시 쟀더니 값이 안 나왔다.** 옛 기록은 B 1→2가 p50 50.0 → 66.6ms
 *  (+33%)였는데, 같은 명령(perf-check --units 120 --coarse --dpr 3 --zoom 2 --cpu 4)을
 *  지금 판에서 돌리면 B 1이든 dpr이든 **p50 8.3ms로 같다**(밀린 프레임 0.3% → 0.0%,
 *  최악 466 → 9.4ms). 그 사이 지도·모델 판을 기기픽셀 격자에 굽는 손질이 들어가면서
 *  프레임이 더는 스프라이트 칠하기에 묶여 있지 않다.
 *  ⚠ 계측의 한계: 이 자는 rAF 간격이라 120Hz 화면에서 8.3ms에 **포화**한다 — "안 밀린다"
 *    까지만 말하고 여유가 얼마인지는 말하지 못한다. 더 무거운 판(유닛 800·CPU 8배)은
 *    도구 쪽에서 유닛 판이 안 구워져(보관 0판) 비교가 성립하지 않았다.
 *  되돌리려면 이 자리에 문턱을 다시 세우면 된다. 지금 화면이 실제로 무엇을 쓰는지는
 *  주소에 #diag를 붙이면 바로 보인다(SCR_DIAG.unitB·scale). */

/* ── 실기기 진단(요청 배경: "아이폰에서만 흐리다"를 추측으로 두 번 고쳐 놓쳤다) ────
 *  주소 끝에 `#diag`를 붙이면 지도 위에 지금 실제로 쓰이는 수치가 뜬다. 폰에서
 *  스크린샷 한 장이면 원인이 갈린다 — 배킹이 화면 요구(dpr)를 못 따라가는지, 굽기가
 *  예산에 막힌 것인지, 아예 배킹 확보가 실패한 것인지.
 *  값은 그리는 쪽(UnitLayer·ReplayMapVector)이 매 프레임 여기에 적고, 오버레이는
 *  재생 틱마다 읽어 그린다. 꺼져 있으면 적기만 하고 아무도 안 읽는다(값 없음). */
export const SCR_DIAG: {
  dpr: number; unitCss: string; unitBack: string; unitB: number;
  mapCss: string; mapBack: string; ppt: number; needed: number;
  /** 배킹 ÷ 화면 기기픽셀 — **1.0000이 아니면 브라우저가 재표본한다**(그만큼 뭉갠다).
   *  앞판 진단이 올림한 정수끼리 견주다 이 값을 놓쳤다(37/37=100%인데 실제로는 1.0042). */
  scale: number;
  /** 유닛 캔버스도 같은 자로 — 배킹 ÷ (그려지는 폭 × dpr). 1.0000이 아니면 재표본이다.
   *  clientWidth는 **정수로 반올림된 값**이라 이것과 다를 수 있다: 실제 배치 폭이
   *  393.33이면 배킹은 1179인데 화면은 1180이고, 그 어긋남은 clientWidth로는 안 보인다. */
  unitScale: number;
  areaCap: number; allocOk: boolean; zoom: number;
  /** 생산 색인 요약(#diag) — "(임자|건물종류)=건수". 비어 있으면 호스트 찾기 실패다. */
  prod: string;
  /** 프레임 워커 상태 — on/off · 받은 수 · 쓴 수 · 놓친 수. */
  worker: string;
  /** 덜어내기(폰 과밀) — "N단 평균ms 유닛수". */
  crowd: string;
  /** 이 프레임의 효과 op을 '갈래:무기'로 센다 — "이 무기가 안 나간다"는 신고를 눈이
   *  아니라 수로 가리려고 둔다(트레이서는 0.2초짜리라 스크린샷 한 장으로는 못 가린다).
   *  #diag가 켜져 있을 때만 채운다. */
  fx: Record<string, number>;
  /** 참값 뭉치의 **판 번호**와 갈림 시각(초) — 재분석이 정말 새로 구웠는지를 가른다.
   *  갈림 시각은 1분 칸으로 끊겨 있어 조금 밀린 것은 안 보이지만, 판 번호는 덤퍼가
   *  바뀔 때마다 오르므로 '오늘치로 구웠나'가 한눈에 뜬다(openbwTracks의 version 주석).
   *  판이 0이면 자취를 아직 안 받았거나 못 푼 것이다. */
  truthVer: number;
  truthTrust: number;
  /** 자취를 못 쓴 **까닭** — 빈 글자면 멀쩡히 쓰고 있다는 뜻이다.
   *
   *  ★ 왜 두나(지적: "지금 모든 경기가 거의 다 재생할 수 없는 게임이에요라고 나온다") —
   *    그 화면은 entLoad === "none" 하나로 뭉뚱그려져 있었고, 거기 이르는 길이 셋이다:
   *      ① 해독기가 물리쳤다(판이 범위 밖이거나 OBWT가 아니다) — **서버·규약 쪽 일**
   *      ② 풀리긴 했는데 트랙이 0개다 — **덤퍼가 재구성을 못 한 것**(믿을프레임 0)
   *      ③ 아예 못 받았다(그물·404) — 배달 쪽 일
   *    셋이 화면에서 같은 말을 하니 어디를 고쳐야 하는지가 안 보인다. 판 번호와 함께
   *    여기 적어 두면 #diag나 window.__scrDiag로 곧장 읽힌다. */
  truthWhy: string;
} = {
  dpr: 0, unitCss: "", unitBack: "", unitB: 0,
  mapCss: "", mapBack: "", ppt: 0, needed: 0, scale: 0, unitScale: 0,
  areaCap: 0, allocOk: true, zoom: 0, fx: {}, prod: "", worker: "", crowd: "",
  truthVer: 0, truthTrust: -1, truthWhy: "",
};
/** #diag가 켜져 있나 — 주소가 바뀌지 않는 한 한 번만 읽는다. */
export const scrDiagOn = (): boolean =>
  typeof window !== "undefined" && window.location.hash.toLowerCase().includes("diag");

/** 테란 부속건물 — 이름 대신 + 하나로 본체 옆에 붙는다(요청). 제 건설 좌표가 본체
 *  오른쪽 아래라 저절로 옆자리다. */
/* 상태 주문 표(재질문: 모든 기술 전수조사) — 좌표 마법이 그 순간 그 자리의 개체에
   남기는 상태: 지속·반경·종류. 빙결류(스태시스·마엘스톰·락다운)는 그 자리에 얼어붙고,
   나머지는 색 오라로 몸에 밴다. */
/* ★ 지속과 반경을 **원작에서 그대로 옮긴다**(지적: "스테시스 걸린 인터셉터를 포토가
   때림 · 스테시스 풀린 캐리어가 자동공격 안 함" → 260805212842 29:40) ─────────────────
   두 지적이 **한 뿌리**였다: 스테시스를 30초로 잡아 뒀는데 원작은 44초다. 그래서 30초가
   지나면 화면에서는 우리(cage)가 걷히고 표적 명단의 frozen도 풀리는데, 참값 쪽 몸은
   아직 14초를 더 갇혀 있다. 그 14초 동안
     · 캐논은 '이제 칠 수 있다'며 겨누고(그런데 참값은 무적이라 안 죽는다) — ③
     · 캐리어는 '풀렸는데' 참값이 여전히 못 움직이니 아무것도 안 한다 — ④
   가 된다. 어림 하나가 두 증상으로 갈라져 나온 자리다.

   원작 값은 OpenBW(bwgame.h)에서 읽었다 — 상태 시계는 **8프레임마다 한 틱**씩 준다
   (update_unit_status_timers는 cycle_counter가 8이 될 때만 돈다). 그래서
       초 = 틱 × 8 ÷ 23.81
   이고, 반경은 square_at(pos, 반폭)의 그 반폭이다(픽셀 ÷ 32 = 타일):
       스태시스   stasis_timer   131틱 → 44.0초 · 48px → 1.5타일
       락다운     lockdown_timer 131틱 → 44.0초 · 표적 하나(반경은 자취의 시전 좌표를
                                                    몸에 잇는 우리 어림이다)
       인스네어   ensnare_timer   75틱 → 25.2초 · 64px → 2.0타일
       플레이그   plague_timer    75틱 → 25.2초 · 64px → 2.0타일
       이레디에이트 irradiate_timer = 무기표 쿨다운 75틱 → 25.2초 · 표적 하나
       마엘스트롬 maelstrom_timer  22틱 →  7.4초 · 48px → 1.5타일
   ⚠ 원작이 훑는 것은 **정사각형**이고 우리는 원이다. 다만 우리 쪽도 '몸이 걸치면 든다'를
     반지름에 몸 반경을 더해 흉내 내므로(아래 half5), 모서리에 걸친 큰 몸 몇 기 말고는
     같은 답이 나온다. 그것까지 맞추려면 정사각형으로 재야 한다.
   ⚠ 건물은 원작에서 **면역**이다(stasis_field의 ut_building 건너뜀) — 이 표를 읽는 쪽이
     건물을 안 훑으므로(entWalks가 건물을 뺀다) 저절로 맞는다. */
export const STATUS_CASTS: Record<string, { dur: number; r: number; kind: string; any?: boolean }> = {
  Ensnare: { dur: 25.2, r: 2, kind: "ensnare" },
  Plague: { dur: 25.2, r: 2, kind: "plague" },
  "Stasis Field": { dur: 44, r: 1.5, kind: "stasis", any: true },
  Maelstrom: { dur: 7.4, r: 1.5, kind: "mael" },
  Lockdown: { dur: 44, r: 1.2, kind: "lock" },
  Irradiate: { dur: 25.2, r: 1, kind: "irr" },
};
export const FREEZE_STATUS = new Set(["stasis", "mael", "lock"]);
/** 몸마다 **우리**를 씌우는 상태(UnitLayer의 cage 갈래) — 이것들은 발밑 오라를 안 깐다.
 *  ★ 그 오라가 곧 "하늘색 원"이었다(지적: "아래에 하늘색 원 있잖아") — 스태시스의 색
 *    #69b7e8이 모델 상자의 1.65배(px × 0.55) 타원으로 발밑에 깔렸다. 시전 자리의 판을
 *    걷어도 원반이 남아 있던 까닭이 이것이다: 판은 **여기** 있었지 AREA_FX에 있지 않았다.
 *    우리가 '누가 걸렸나'를 이미 말하므로 같은 말을 두 번 할 까닭이 없다. 우리가 없는
 *    상태(마엘스트롬·플레이그·인스네어·이레디에이트)는 그대로 오라가 맡는다. */
export const CAGED_STATUS = new Set(["stasis", "lock"]);
export const BURROWABLE = new Set(["Drone", "Zergling", "Hydralisk", "Lurker", "Defiler", "Infested Terran"]);
/** 땅을 파고 드는 데 드는 시간(초) — 원작의 버로우 애니메이션 길이 언저리(약 1초, 공식 자료는 이 환경에서 못 열어
 *  확인 못 함). 이 창 동안 몸은 버로우 지점에 서서 땅에 잠겨 들고, 럴커는 아직 가시를 안 쏜다(요청). */
export const BURROW_DIG_SEC = 0.9;
/** 시즈 탱크의 모드 전환(시즈·언시즈)에 드는 시간(초) — 원작 전환 애니메이션 길이 언저리(공식 자료는 이 환경에서
 *  못 열어 확인 못 함). 명령 시각이 전환의 **시작**이다: 그 창 동안 몸은 그 자리에 서서 앉았다 일어나며(앞 반은 옛 몸이
 *  가라앉고 뒤 반은 새 몸이 올라온다), 창이 끝나야 사거리·사격이 새 모드다(요청: 버로우와 같은 규약). */
export const SIEGE_XF_SEC = 1.5;
/** 정제소 불빛의 유예(초) — 일꾼이 나간 뒤로도 이만큼은 켜 둔다. 가스 왕복 한 바퀴가
 *  대략 이 언저리라, 한 대만 붙어 캐도 불이 안 끊긴다(지적: 계속 깜빡). */
export const GAS_LIT_HOLD = 12;
/* (걷어냄) burrowStartOf — 버로우 켬/끔 커맨드(f=18/19)를 시간순으로 접어 '판 시각'을
   내던 자다. 참값 자취가 프레임마다 ST_BURROW로 직접 말하므로 접을 것이 없다. */
export const STATUS_TINT: Record<string, string> = {
  ensnare: "#79c74c", plague: "#b4452e", stasis: "#69b7e8",
  mael: "#a86ae0", lock: "#c8c8d2", irr: "#e8c84a",
};
/** 상태의 한국어 이름(요청: 건설·변태 등 모든 상태 노출) — 정보 팝업이 쓴다. */
export const STATUS_KO: Record<string, string> = {
  ensnare: "인스네어", plague: "플레이그", stasis: "스테이시스",
  mael: "마엘스트롬", lock: "락다운", irr: "이레디에이트",
};
/** 디텍터(전수조사: 투명화 카운터) — 이들이 곁에 있으면 은신이 벗겨진다. */
export const DETECTOR_UNITS = new Set(["Overlord", "Observer", "Science Vessel"]);
/* 같은 자리 변태·재건의 계보(지적: 성큰 변태에서 고치가 페이드아웃되고 성큰이 안 남음)
   — 예전엔 'Colony끼리'·'해처리 계열끼리'를 서로 후계로 쳤다. 방향이 없으니 옆에 새로
   심은 크립 콜로니가 방금 변태를 마친 성큰을 제 후계로 잡아 지웠다(저그 본진의 콜로니는
   한 타일 간격으로 붙어 선다). 변태는 한 방향이다 — 크립은 성큰·스포어가 되지만 그
   반대는 없고, 성큰은 종착지다. */
export const MORPH_NEXT: Record<string, string[]> = {
  "Creep Colony": ["Sunken Colony", "Spore Colony"],
  Hatchery: ["Lair", "Hive"],
  Lair: ["Hive"],
};
/** 뒤 건물(to)이 앞 건물(from)의 후계인가 — 같은 종류의 재건이거나 변태의 다음 단계. */
export const succeedsBld = (from: string, to: string): boolean =>
  to === from || (MORPH_NEXT[from] ?? []).includes(to);
/** 같은 자리인가 — ±1.5타일은 한 칸 간격으로 붙어 선 콜로니를 서로 삼켰다(지적). */
export const SAME_SITE_TILES = 0.6;
/** 디텍터가 은신을 벗기는 거리(타일) — 표시 투명도와 표적 판정이 같은 자를 쓴다. */
export const DETECT_TILES = 9;
/** 스캐너 스윕이 그 자리를 디텍터로 만드는 시간(초) — 화면 효과도 같은 길이로 남는다.
 *  원작의 스캔 수명은 220프레임(빠른 속도에서 약 9초)이라 12초는 길었다(지적). */
export const SCAN_DETECT_SEC = 9;
/* (걷어냄) ZERG_HALLS — 라바·변태알을 발치에 그릴 저그 본진 명단이다. 그 장식을
   걷었으므로(위 '라바·변태알 장식' 주석) 명단도 함께. */
export const ADDONS = new Set([
  "Comsat Station", "Nuclear Silo", "Machine Shop", "Control Tower", "Covert Ops", "Physics Lab",
  // v2 트랙의 변형 이름(지적: 커맨드 애드온에 통로가 안 붙음) — screp는 ComSat으로 준다.
  "ComSat",
]);

/** 건물 짓는 시간(초, 어림) — 짓는 동안 반투명 표시(요청)의 창이다. */
/* 건물 짓는 시간(초) — 원작의 프레임 수를 23.81로 나눈 값이다(지적: 3시 첫 포톤캐논이
   너무 빨리 지어진다). 예전엔 열두 개만 적어 두고 나머지는 30초로 뭉갰는데, 게이트웨이
   (37.8)·연결체(75.6)·사이버네틱스(37.8)가 죄다 그 30초로 떨어져 있었다.
   이 리플레이로 상한을 대조했다 — 건설 명령과 '그 건물이 있어야 낼 수 있는 첫 명령'의
   간격은 (짓는 시간 + 일꾼 걸음 + 사람 반응)이라 늘 표값보다 커야 한다:
     게이트웨이 58.3→질럿 100.7 (걸음 2.7 빼고 39.7) ≥ 37.8 ✓
     포지     111.4→캐논 146.5 (걸음 8.5 빼고 26.5) ≥ 25.2 ✓
     사이버   203.1→드라군 246.6 (2 빼고 41.5) ≥ 37.8 ✓
     스포닝풀  50.9→저글링 117.8 ≥ 50.4 ✓   시타델 295.3→발업 353.9 ≥ 37.8 ✓
   앞의 둘은 여유가 2초도 안 되게 딱 맞는다 — 표가 맞다는 가장 센 증거다. */
export const BUILD_SEC: Record<string, number> = {
  // 테란
  "Command Center": 75.6, "Comsat Station": 25.2, "Supply Depot": 25.2, Refinery: 25.2,
  Barracks: 50.4, Academy: 50.4, Factory: 50.4, Starport: 44.1, "Control Tower": 25.2,
  "Science Facility": 37.8, "Covert Ops": 25.2, "Physics Lab": 25.2, "Machine Shop": 25.2,
  "Engineering Bay": 37.8, Armory: 50.4, "Missile Turret": 18.9, Bunker: 18.9,
  "Nuclear Silo": 37.8,
  // 프로토스
  Nexus: 75.6, Pylon: 18.9, Assimilator: 25.2, Gateway: 37.8, Forge: 25.2,
  "Photon Cannon": 31.5, "Shield Battery": 18.9, "Cybernetics Core": 37.8,
  "Citadel of Adun": 37.8, "Templar Archives": 37.8, "Robotics Facility": 50.4,
  "Robotics Support Bay": 18.9, Observatory: 18.9, Stargate: 44.1,
  "Fleet Beacon": 37.8, "Arbiter Tribunal": 37.8,
  // 저그
  Hatchery: 75.6, Lair: 63, Hive: 75.6, Extractor: 25.2, "Spawning Pool": 50.4,
  "Creep Colony": 12.6, "Sunken Colony": 12.6, "Spore Colony": 12.6,
  "Evolution Chamber": 25.2, "Hydralisk Den": 25.2, "Queens Nest": 37.8,
  Spire: 75.6, "Greater Spire": 75.6, "Nydus Canal": 25.2, "Defiler Mound": 37.8,
  "Ultralisk Cavern": 50.4,
};
/* (걷어냄) workedBy·workingAt — 테란 '건설 중단'을 그리려고, 일꾼이 건물에 붙어 있던
   구간을 명령 증거로 되짚어 잇던 짝이다. 참값은 완공 시각을 제 손으로 말하므로(키마다
   실린 '다 지어졌나' 비트 → TruthLife.doneAt) 되짚을 까닭이 없어졌다. 함께 사라진 표시:
   공사가 멈춰 선 동안의 '중단' 표. */

/* (걷어냄) UNIT_SEC — '유닛 뽑는 시간' 어림표. 완성 시각을 되짚는 데 쓰던 자리는
   전부 원작 표(UNIT_BUILD_SEC)와 개체 트랙의 출생 시각으로 옮겨 갔다. */
/* (걷어냄) 자원 고갈 상수(MINERAL_DEPLETE_SEC·GAS_DEPLETE_SEC) — 고갈 어림을
   걷으면서 함께. */

/* 교전 붙기의 자(아래 engagePosOf 주석) — 시야·당김 상한(타일), 근접 유닛, 유닛별
   사정거리(타일, 대략). 싸움과 무관한 유닛(일꾼·수송·캐스터)은 안 끈다 — 시즈 탱크
   (시즈 모드)와 러커는 제자리 화력이라 끌면 오히려 거짓말이 된다. */
/** 방어 건물이 '맞고 있는 표적'으로 인정하는 창(초) — 이보다 오래 체력이 안 떨어진
 *  몸에는 사격을 안 그린다(위 needHurt). 캐논의 쿨다운이 22프레임(약 0.92초)이라
 *  실제로 쏘고 있으면 체력 키가 그 주기로 남는다 — 1.5초면 한 방을 놓쳐도 이어진다. */
/* (걷어냄) DEF_FIRE_EVIDENCE_SEC — '맞은 지 몇 초 안이면 쏘는 중'이라는 증거 창이다.
   방어 건물의 표적을 체력 자국으로 뒤밟던 시절의 값이라, 참값 표적이 온 뒤로 쓸 데가 없다. */
export const ENGAGE_SIGHT_TILES = 9;
/** 죽음 폭발이 사는 시간(초) — 유닛·건물. 캔버스 burst와 DOM 여운·집계 문이 같은 값을 본다. */
/** 체력바가 맞은 뒤 남는 시간(초) — 요청: "체력바는 공격당한 뒤 한동안만 보여준다". 선택된 개체는 늘 보인다. */
export const HP_BAR_SEC = 3;
/** 입체에서 체력바 폭 배수(요청: 3D에서 너무 큼). 깊이 배율 pitchK(y)에 더 곱한다. */
export const HP_BAR_3D_K = 0.7;
export const DIE_FX_SEC = 0.5;
export const BLD_FX_SEC = 1.0;
export const ENGAGE_SKIP = new Set([
  "Worker", "Transport", "Overlord", "Dropship", "Shuttle", "Observer", "Science Vessel",
  "Defiler", "Queen", "High Templar", "Dark Archon", "Lurker",
  /* ★ (걷어냄) "Arbiter"(지적: "아비터 일반 공격 트레이서가 안 나옴") — 시즈 탱크가
     여기 있어서 조용했던 것과 **똑같은 자리**다. 이 명단은 canFight를 거짓으로 만들고,
     그러면 표적 찾기가 통째로 안 돈다 — 표적이 없으니 조준각도 트레이서도 없다.
     아비터를 넣은 까닭은 '마법 유닛'이라서였겠지만, 마법을 쓴다는 것과 **때리지 않는다**는
     것은 다른 말이다. 아비터에는 위상 분열포가 달려 있다(사거리 5).
     ★ (걷어냄) "Medic"(지적: "메딕도 교전 제외인지 봐 줘, 힐 모션이 안 들어가") — 같은
       자리다. 메딕은 **때리지는 않지만 일한다**: 다친 동료에게 붙어 치료한다. 그 동작을
       그리는 길이 공격 갈래 하나뿐인데(ATTACK_FX.Medic = "heal" · 컷 2가 치료 자세다)
       이 명단이 그 앞단을 막고 있었다.
       다만 메딕의 표적은 **적이 아니라 아군**이라, 아래 표적 찾기에서 갈래를 하나 튼다.
     여기 남은 것들은 정말로 아무 일도 안 한다: 디파일러·퀸·하이템·다크아콘(마법은 제
     시전 자국이 따로 있다)·수송·관측·라바 무리. */
  /* ★ (걷어냄) "Siege Tank (Siege Mode)"(지적: "시즈가 타겟을 못잡나봄 검사해봐" — 맞다,
     여기 있었다) — 이 명단은 canFight를 거짓으로 만들고, 그러면 표적 찾기(wantFoe9)가
     통째로 안 돈다. 표적이 없으니 조준각(foeDeg)도 null이라 포탑이 차체를 따르고
     트레이서도 안 나갔다. 앞서 고친 조준 사거리·최소 사거리가 화면에 안 나타난 까닭이
     이것이다 — 그 앞단에서 이미 막혀 있었다.
     시즈 모드는 이 게임에서 가장 전형적인 **공격 자세**다. 여기 있을 까닭이 없다. */
  /* 라바·알·껍질은 싸우지 않는다 — 참값이 이제 이 넷을 진짜 개체로 내므로, 명단에
     없으면 해처리 발치의 라바가 적을 보고 교전 자세를 잡는다. */
  "Larva", "Egg", "Lurker Egg", "Mutalisk Cocoon",
]);

/* ── 재는 자 (`?perf=1`) ────────────────────────────────────────────────────────
   느린 자리를 **짐작으로** 두 번 고쳤는데 여전하다는 지적이 왔다. 그래서 재는 자를 둔다.
   주소에 `?perf=1`을 붙이면 60프레임마다 콘솔에 한 줄이 나온다 — 어느 조각이 몇 밀리초를
   먹는지, 몇 번 불리는지. 끄면(기본) `PERF9`가 거짓이라 호출 자체가 안 돈다. */
/* 개체마다 **안 변하는 것**은 한 번만 (실측: 준비 단계가 프레임당 17.98ms, 개체 964기)
   — 공중인가·이름·표적 자격·버로우 가능·상시 은신은 **시간과 무관**한데 프레임마다
   다시 셈하고 있었다. 개체 객체를 열쇠로 삼는 WeakMap이라 개체가 사라지면 같이 사라지고,
   훅이 아니라서 부르는 자리를 안 가린다. */
export interface EntConst9 { air: boolean; uk: string | undefined; noBody: boolean; burrowable: boolean; alwaysCloak: boolean }
export const entConst9 = new WeakMap<object, EntConst9>();
export const constOf9 = (e: { unit: string }): EntConst9 => {
  let c = entConst9.get(e);
  if (!c) {
    c = {
      air: e.unit !== "" && isAirUnit(e.unit),
      uk: e.unit !== "" ? e.unit : undefined,
      noBody: NO_BODY_UNITS.has(e.unit),
      burrowable: BURROWABLE.has(e.unit),
      alwaysCloak: e.unit === "Dark Templar" || e.unit === "Observer",
    };
    entConst9.set(e, c);
  }
  return c;
};

/* ═══════════════════════════════════════════════════════════════════════════════════════════
   프레임 엔진(요청: 워커 분리 — 셈은 딴 스레드가 미리, 붓만 메인) ──────────────────────────────
   아래 둘은 컴포넌트 밖의 순수 함수다. 화면(React·DOM)을 한 톨도 안 만지므로 웹 워커에서도 돈다.
     · deriveWorld9 — 참값·지도·기지에서 파생하는 **한 번짜리** 자료(옛 useMemo 사슬).
     · createEngine9 — 그 자료로 시각 t의 **프레임**(그릴 op·효과·DOM 기록·안개)을 낸다. 옛 렌더
       함수 안의 걷기·건물 고리를 그대로 옮겼다. 옛 ref들은 엔진 안의 상태가 됐다.
   ★ 자세·요잉은 늘 **자세히**(liteView·liteYaw 없음) 낸다 — 낮은 배율의 간이화는 붓(UnitLayer)이
     그릴 때 한다(요청: 둘째 방법). 배율에 매인 것은 프레임에 안 실리므로 버퍼가 배율 변경에도 산다.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
export type FoeRow = {
  team: number; x: number; y: number; air: boolean; bld?: boolean; k?: string;
  /** 유닛 행일 때의 원작 유닛 이름 — 방어 건물이 공중 표적을 겨눌 때 그 표적의 제
   *  크기를 알아야 조준 높이가 맞는다. `k`는 **건물 행에만** 실리므로(방어 건물
   *  갈래) 공중 갈래에서는 언제나 undefined였다 — 그 자리를 이 필드가 채운다. */
  uk?: string;
  /** 은신·버로우로 '안 보이는' 표적(요청) — 디텍터가 있는 편에게만 표적이 된다. */
  hidden?: boolean;
  /** ★ 스태시스에 갇힌 몸(지적: "걸린 대상을 포탑 등이 공격함 — 원작에선 공격 불가")
   *  — **아무도 못 친다**. 위 hidden과는 다른 종류의 못 침이다: 은신은 '못 보는 것'
   *  이라 디텍터가 있으면 풀리지만, 스태시스는 그 몸이 아예 이 세상에 없는 것처럼
   *  다뤄져 무적이다. 그래서 detectedBy로 뚫리는 hidden에 얹으면 안 되고 제 칸이
   *  있어야 한다.
   *  락다운·마엘스트롬은 **여기 안 든다** — 그 둘은 못 움직일 뿐 얻어맞는다. */
  frozen?: boolean;
  /** 떠 있는 건물(요청: 띄운 건물은 공중 유닛이다) — 대공 무기를 지닌 쪽만 친다. */
  lifted?: boolean;
  /** ★ 마지막으로 **체력이 떨어진** 때(초) — 없으면 이 판에서 한 번도 안 맞았다.
   *  방어 건물의 사격이 이것을 증거로 쓴다(아래 needHurt). */
  hurt?: number;
  /** ★ 지금 남은 체력(실드 포함) — **없으면 아직 한 번도 안 깎였다**(곧 만피다).
   *
   *  메딕이 "고칠 데가 있나"를 이 값으로 묻는다(아래 healing9). 여태 이 명단은
   *  '때릴 수 있나'만 실어 날랐는데, 메딕의 표적은 때릴 몸이 아니라 **고칠 몸**이라
   *  물어야 할 것이 하나 더 있다. 자리는 바로 아래 hurt와 같은 이분 탐색이라 삯이
   *  붙지 않는다(같은 마디를 한 번 찾아 둘을 다 낸다). */
  hp?: number;
};
export type PitchGeom9 = {
  w: number; h: number; hPre: number; P: number; S: number; C: number; q: number; cy: number;
};
/** 캔버스가 아니라 DOM으로 그리는 효과의 기록 — 메인 스레드가 이것으로 스팬을 만든다. */
export type DomFx9 =
  | { k: "buildfx"; key: string; x: number; y: number; z: number; race: string; i: number; ws: number }
  | { k: "wound"; key: string; x: number; y: number; z: number; lift: number; race: string; items: { sz: number; dx: number; dy: number; delay: number }[] }
  | { k: "mineboom"; key: string; x: number; y: number }
  | { k: "touchdown"; key: string; x: number; y: number; wPct: number; hPct: number }
  /** 럴커 버로우 파기의 흙덩이(요청) — 0.15초마다 새 열쇠로 한 움큼씩 튄다. seed로 튀는 방향 갈래를 고른다. */
  | { k: "dig"; key: string; x: number; y: number; seed: number; wPct: number }
  | { k: "collapse"; key: string; x: number; y: number; wPct: number; rk: string; flyUp: number }
  | { k: "castfx"; key: string; x: number; y: number; cls: string; wTiles: number; scan: boolean }
  | { k: "swarm"; key: string; x: number; y: number }
  | { k: "dieat"; key: string; x: number; y: number; dk: string; diePx: number; lift: number };
export type Frame9 = {
  t: number; unitOps: UnitDrawOp[]; fxOps: FxOp[]; miniExtra: MiniDot[]; gasBusy: string[]; dom: DomFx9[];
  explored: Uint16Array | null; visNow: Uint8Array | null; visSrc: Float32Array;
};
/** 워커 프레임이 아직 없을 때 드는 빈 프레임 — 지도만 그려진다. */
export const EMPTY_FRAME9: Frame9 = {
  t: -1, unitOps: [], fxOps: [], miniExtra: [], gasBusy: [], dom: [],
  explored: null, visNow: null, visSrc: new Float32Array(0),
};
export type EngineWorld9 = ReturnType<typeof deriveWorld9>;
export function deriveWorld9(inp: {
  entData: TruthWorld | null; truth: TruthTracks | null;
  grid: { width: number; height: number; resources?: ReplayMapGrid["resources"] };
  bases: readonly { key: string; race?: string }[]; teamOf: (raw: string) => 1 | 2 | undefined; total: number;
}) {
  const { entData, truth, bases, total } = inp;
  const grid = inp.grid;
  const teamOfRaw = inp.teamOf;
  const simTracks: Map<number, TruthTrack> | null = truth ? new Map(truth.tracks.map((tr) => [tr.tag, tr])) : null;
  const buildsV2 = (() => {
    if (!entData) return [];
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    type Row = { born: number; x: number; y: number; k: string; raw: string; gone: number;
      lift?: number; doneAt: number };
    const tagRows: Row[] = [];
    const physRows: (Row & { used?: boolean })[] = [];
    for (const e of entData.lives) {
      if (!e.bld || !e.kind) continue;
      const raw = nameOfId.get(e.owner) ?? "";
      if (!raw) continue;
      const spots = e.sites;
      if (spots.length === 0) continue;
      /* 죽음의 주인은 하나다(과제 #69) — 분석이 체력 자취를 **d에서** 0으로 맞춰
         내보내므로, 여기서 체력 0을 따로 볼 이유가 없어졌다. 옛 코드는 hpZero가 d보다
         이르면 그쪽을 골랐는데, 실측으로 그 둘이 거의 늘 달랐다(경기1: 체력 0에 닿은
         1042기 중 d와 같은 것이 6기, 934기가 평균 6초 일렀고 62기는 증거상 살았는데도
         바가 0이었다). 이제 분석 쪽에서 하나로 모았다. */
      const gone = e.died ?? 0;
      for (let i = 0; i < spots.length; i += 1) {
        const [sSec, x, y] = spots[i];
        const nextS = i + 1 < spots.length ? spots[i + 1][0] : null;
        const lift = e.lifts.find((ls) => ls >= sSec && (nextS === null || ls <= nextS));
        const row: Row = {
          /* 공사 시작은 '자리를 찍은 순간'이다(지적: 첫 홀이 짓는 걸로 나온다) — 예전엔
             건설 앵커(f=2)일 때 개체의 출생(e.born)을 썼는데, 프로토스·테란은 일꾼 태그가
             그대로 건물 생애가 되므로 그 값은 일꾼이 태어난 때(경기 1초)다. 그래서
             90초에 지은 확장 넥서스가 1초부터 공사 중으로 서 있었다. 앵커 시각을 쓴다. */
          born: sSec, x, y, k: e.kind, raw,
          gone: nextS !== null ? nextS : gone,
          // 완공 초는 참값이 말한다 — 옮겨 앉은 뒤(i > 0)에는 이미 다 지어진 몸이다.
          doneAt: i === 0 ? e.doneAt : sSec,
          ...(lift !== undefined ? { lift } : {}),
        };
        (e.tag === -1 ? physRows : tagRows).push(row);
      }
    }
    /* 같은 건물이 두 번 선다(드론→건물 변태 분리의 산물) — 같은 자리엔 물리 줄(건설
       좌표)과 태그 줄(드론 태그가 건물이 된 생애)이 함께 있다. 태그 줄이 정체(변태
       반영: 크립 콜로니→성큰)와 취소를 더 잘 알고, 물리 줄은 발치 공격의 철거를 안다 —
       태그 줄을 남기고 물리 줄의 무너짐만 승계한다. */
    const out: BuildRow[] = [];
    for (const r of tagRows) {
      const twin = physRows.find((p2) => !p2.used && p2.raw === r.raw
        && Math.abs(p2.born - r.born) <= 3 && Math.hypot(p2.x - r.x, p2.y - r.y) <= 1.5);
      let gone = r.gone;
      if (twin) {
        twin.used = true;
        if (gone === 0 && twin.gone > 0) gone = twin.gone;
      }
      out.push([r.born, r.x, r.y, r.k, r.raw, gone, r.lift, r.doneAt]);
    }
    for (const p2 of physRows) {
      if (p2.used) continue;
      out.push([p2.born, p2.x, p2.y, p2.k, p2.raw, p2.gone, p2.lift, p2.doneAt]);
    }
    return out;
  })();
  const castsV2 = (() => {
    if (!entData) return [];
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    return (entData.casts ?? []).map(([s, x, y, tech, pidc]) =>
      [s, x, y, tech, nameOfId.get(pidc) ?? ""] as CastRow);
  })();
  const entBldHp = (() => {
    /* 표적 흐름도 **같은 색인에 함께** 건다(지시: 어림을 다 걷어낸다) — 방어 건물도
       제 order_target을 갖는데, 그 값에 닿으려면 여기와 똑같은 '자리 → 생애' 색인이
       한 벌 더 필요했다. 같은 고리에서 같은 열쇠로 걸어 두면 읽는 쪽이 한 번만 찾는다. */
    const m = new Map<string, {
      born: number; tag: number; hp: Ticks; tgt?: Ticks;
    }[]>();
    if (!entData) return m;
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    for (const e of entData.lives) {
      if (!e.bld || !e.hp || tkN(e.hp) === 0) continue;
      /* ★ **앉았던 자리 전부**에 색인한다(지적: "테란 공중 건물에 공격 트레이서랑 피해
         효과가 안 나옴") ────────────────────────────────────────────────────────────
         여기서 마지막 자리 하나만 담았다. 그런데 읽는 쪽(건물 그리기)은 **그 줄의 자리**로
         찾는다 — 띄워 옮긴 건물은 한 생애가 자리마다 한 줄씩 서므로(buildsV2의 sites 고리),
         옮기기 **전** 줄은 마지막 자리 열쇠와 안 맞아 늘 빈손이었다. 빈손이면 체력이
         '성한 만피'로 떨어지고 맞은 때가 −99라, 그 건물에는 피격 불티도 실드막도 영영
         안 뜬다 — 뜨는 건물에서만 나던 까닭이 이것이다(안 옮긴 건물은 자리가 하나뿐이라
         늘 맞았다).
         자리마다 같은 자취를 걸어 둔다. 어느 줄이 읽어도 제 생애의 체력을 찾는다. */
      const raw = nameOfId.get(e.owner) ?? "";
      for (const site of e.sites) {
        const key = `${raw}|${Math.round(site[1])}|${Math.round(site[2])}`;
        const arr = m.get(key) ?? [];
        // 태그도 함께 — 이 건물이 **맞았을 때** 누가 때렸는지를 뒤집어 찾는 열쇠다.
        arr.push({ born: e.born, tag: e.tag, hp: e.hp, ...(e.tgt ? { tgt: e.tgt } : {}) });
        m.set(key, arr);
      }
    }
    return m;
  })();
  const bldTagSpots = (() => {
    const rows: {
      tag: number; x: number; y: number; raw: string; born: number; gone: number; k: string;
      /** 이륙 시각 — 뜬 뒤로는 표적 자리가 앉았던 자리가 아니라 나는 자리다. */
      lift?: number;
      /** ★ 이륙·착륙 시각 **전부**(요청 조사: "공중 건물에 골리앗 대지 트레이서가 아직도
       *  나간다") — 아래 airborneAt이 '그 순간에 떠 있나'를 이 둘로 가린다. 한 값(lift)
       *  으로는 못 가린다(그 자리 ★ 주석). */
      lifts: number[];
      siteTs: number[];
    }[] = [];
    /* 태그 없는 물리 건물 자리(기획서 2-D) — 시작 홀 등 태그 생애가 없는 건물의
       자리 색인. 태그 미해석 어택의 폴백 표적이 된다. */
    const sites: {
      x: number; y: number; raw: string; born: number; gone: number; k: string; lift?: number;
    }[] = [];
    if (!entData) return { rows, sites };
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    for (const e of entData.lives) {
      if (!e.bld) continue;
      const site = e.sites[e.sites.length - 1];
      if (!site) continue;
      // 죽음의 주인은 하나다(과제 #69) — 위 주석 참조.
      const gone = e.died ?? 0;
      /* 이륙 증거(f=6)를 같이 싣는다 — 여태 이 색인은 건설·착륙(f=2/5/17)만 봐서, 떠서
         날아가는 건물의 표적 자리가 마지막 착륙 지점에 못박혀 있었다(몸은 날아가는데
         어택으로 찍은 총알은 빈 땅으로 갔다). */
      const lifted = [...e.lifts].reverse().find((ls) => ls >= site[0]);
      const row = {
        tag: e.tag, x: site[1] + footDx(e.kind), y: site[2] + footDy(e.kind),
        raw: nameOfId.get(e.owner) ?? "", born: e.born, gone, k: e.kind,
        lifts: [...e.lifts], siteTs: e.sites.map((s9) => s9[0]),
        ...(lifted !== undefined ? { lift: lifted } : {}),
      };
      if (e.tag > 0) rows.push(row);
      else sites.push(row);
    }
    /* 허수아비 방지(기획서 2-D) — 태그 생애가 소멸 시각을 모르면(gone=0) 같은 자리
       물리 행의 철거 시각을 물려받아, 무너진 건물이 45초 표적으로 남지 않게 한다. */
    for (const r of rows) {
      if (r.gone > 0) continue;
      const m = sites.find((s0) => s0.k === r.k && s0.gone > 0
        && Math.abs(s0.x - r.x) <= 3 && Math.abs(s0.y - r.y) <= 3 && s0.gone > r.born);
      if (m) r.gone = m.gone;
    }
    return { rows, sites };
  })();
  const droneMorph = (() => {
    const m = new Map<number, { born: number; gone: number; dy: number; x: number; y: number; k: string }>();
    for (const r of bldTagSpots.rows) {
      if (!BLD_FROM_DRONE.has(r.k)) continue;
      m.set(r.tag, { born: r.born, gone: r.gone, dy: footDy(r.k), x: r.x, y: r.y, k: r.k });
    }
    return m;
  })();
  const bldRecMemo = new Map<string, { born: number; tag: number; hp: Ticks; tgt?: Ticks }>();
  const buildsSrc = buildsV2;
  const buildsDrawOrder = (() => buildsSrc.map((_, i) => i)
    .sort((a, b) => buildsSrc[a][2] - buildsSrc[b][2]))();
  const bldNudge = (() => {
    const m = new Map<number, [number, number]>();
    const placed: {
      x: number; y: number; w: number; h: number; a: number; b: number;
      raw: string; ox: number; oy: number;
    }[] = [];
    const order = buildsSrc.map((_, i) => i).sort((a, b) => buildsSrc[a][0] - buildsSrc[b][0]);
    for (const i of order) {
      const [bs, x, y, u, raw, bg] = buildsSrc[i];
      if (ADDONS.has(u)) continue;
      const [fw, fh] = FOOTPRINT[u] ?? [3, 2];
      let nx = x;
      let ny = y;
      const a = bs;
      const b = (bg ?? 0) > 0 ? (bg as number) : Infinity;
      for (let iter = 0; iter < 6; iter += 1) {
        const hit = placed.find((q) => !(b <= q.a || a >= q.b)
          && !(q.raw === raw && Math.hypot(q.ox - x, q.oy - y) <= 1.5)
          && nx < q.x + q.w && q.x < nx + fw && ny < q.y + q.h && q.y < ny + fh);
        if (!hit) break;
        const pushR = hit.x + hit.w - nx;
        const pushL = nx + fw - hit.x;
        const pushD = hit.y + hit.h - ny;
        const pushU = ny + fh - hit.y;
        const min = Math.min(pushR, pushL, pushD, pushU);
        if (min === pushR) nx = hit.x + hit.w;
        else if (min === pushL) nx = hit.x - fw;
        else if (min === pushD) ny = hit.y + hit.h;
        else ny = hit.y - fh;
      }
      placed.push({ x: nx, y: ny, w: fw, h: fh, a, b, raw, ox: x, oy: y });
      if (nx !== x || ny !== y) m.set(i, [nx - x, ny - y]);
    }
    return m;
  })();
  const entCombatStart = (() => {
    const m = new Map<string, number>();
    if (!entData) return m;
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    for (const e of entData.lives) {
      if (e.bld || !e.kind || e.handoff) continue;   // 손바뀜으로 이어진 생애는 생산·출전이 아니다
      if (e.kind === "SCV" || e.kind === "Probe" || e.kind === "Drone" || e.kind === "Overlord") continue;
      const raw = nameOfId.get(e.owner) ?? "";
      const cur = m.get(raw);
      if (cur === undefined || e.born < cur) m.set(raw, e.born);
    }
    return m;
  })();
  const upsByRaw = (() => {
    /* 셋째 칸은 **그 연구를 한 건물의 참값 태그**다(덤프 판 7부터, 0이면 모름) —
       같은 종류 건물이 여럿일 때 어디서 하는지를 가리는 유일한 자다. */
    const m = new Map<string, [number, string, number][]>();
    if (!entData) return m;
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    const src = entData.ups && entData.ups.length > 0 ? entData.ups : entData.ups;
    for (const [sec, name, pid, utag] of src) {
      const raw = nameOfId.get(pid);
      if (raw === undefined) continue;
      const a = m.get(raw) ?? [];
      a.push([sec, name, utag]);
      m.set(raw, a);
    }
    for (const a of m.values()) a.sort((x, y) => x[0] - y[0]);
    /* #diag — "이 건물이 안 깜빡인다"는 신고를 눈이 아니라 수로 가린다: 색인이 비어
       있으면 호스트 찾기가 실패한 것이고, 차 있으면 갈림은 그 아래 태그 맞대기다. */
    if (scrDiagOn()) {
      SCR_DIAG.prod = [...m.entries()].map(([k9, v9]) => `${k9}=${v9.length}`).join(" · ");
    }
    return m;
  })();
  const prodDoneAt = (() => {
    const m = new Map<string, { u: string; s: number; x: number; y: number }[]>();
    if (!entData) return m;
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    for (const e of entData.lives) {
      if (e.bld || !e.kind || e.handoff) continue;   // 손바뀜으로 이어진 생애는 생산·출전이 아니다
      /* 나온 자리는 **참값이 곧장 안다**(지적: 어댑터 걷기) — 옛 코드는 분석이 꽂아 둔
         출생 증거(f=3)를 읽었는데, 참값은 그런 증거를 안 만드는 대신 그 유닛이 처음
         나타난 **실제 자리**를 안다. 그것이 곧 나온 건물의 출구다. */
      const raw = nameOfId.get(e.owner);
      if (raw === undefined) continue;
      const a = m.get(raw) ?? [];
      a.push({ u: e.kind, s: e.born, x: e.bornX, y: e.bornY });
      m.set(raw, a);
    }
    for (const a of m.values()) a.sort((x, y) => x.s - y.s);
    return m;
  })();
  const prodDoneByRaw = (() => {
    const m = new Map<string, Record<string, number[]>>();
    if (!entData) return m;
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    for (const e of entData.lives) {
      if (e.bld || !e.kind || e.handoff) continue;   // 손바뀜으로 이어진 생애는 생산·출전이 아니다
      const raw = nameOfId.get(e.owner);
      if (raw === undefined) continue;
      const rec = m.get(raw) ?? {};
      (rec[e.kind] ??= []).push(e.born);
      m.set(raw, rec);
    }
    for (const rec of m.values()) for (const a of Object.values(rec)) a.sort((x, y) => x - y);
    return m;
  })();
  const marineBornOf = (() => {
    const m = new Map<string, number>();
    for (const [raw, rec] of prodDoneByRaw) {
      const a = rec.Marine;
      if (a && a.length > 0) m.set(raw, a[0]);
    }
    return m;
  })();
  const entWalks = (() => {
    if (!entData) return [];
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    /* (걷어냄) 같은 클릭을 받은 개체들의 차례표(clickRank) — 명령 좌표로 걸음을 짓던
       시절, 한 클릭을 받은 무리를 행렬로 흩뜨리던 열쇠다. 걸음이 참값이 된 지금은
       흩뜨릴 것이 없다(참값에 이미 저마다 제자리로 흩어져 있다). */
    const out: {
      raw: string; unit: string; born: number; died: number | null; tag: number;
      /** 끝난 갈래 — 'morph'는 사망 효과 없이 다음 생애로 이어진다. */
      end: string;
      /** 건설에 흡수되는 시각(지적: 건설 일꾼 잔상) — 현장 도착부터 숨는다. */
      buildHideAt: number | null;
      /** 공사 중 숨김 구간들(재재지적: 도는 SCV와 원래 SCV 이중 표시) — 앵커마다
       *  [앵커 시각, 다음 위치 증거). 그동안은 합성 건설 일꾼이 그 SCV다. */
      buildHides: [number, number][];
      /** 건설 앵커 자리들 — [시각, 발자국 왼쪽 위 x, y]. */
      buildSites: [number, number, number][];
      /** 공격 명령 목록 [초, 표적 태그, 클릭x, 클릭y] — 어택 표적 겨눔 + 태그
       *  미해석 시 자리 폴백(기획서 2-D)의 재료. */
      atkAt: [number, number, number, number][];
      /** 시즈 켬·해제 [초, 켬1/해제0] — 커맨드 그대로(지적). */
      sieges: [number, number][];
      /** 버로우 켬·해제 [초, 켬1/해제0] — 시즈와 같이 커맨드 그대로. */
      /** 수리·힐 명령 초(지적: 일꾼 수리·매딕 힐) — 곁에서 일하는 효과의 창. */
      /** 체력 변곡점 [초, 퍼센트](요청: 스탯 생애주기) — 체력바의 재료. */
      hp: Ticks;
      /** 인터셉터 개수 변곡점(요청: 실시간 적용) — 캐리어 둘레를 도는 점들. */
      ic: Ticks;
      /** ★ **지금 겨눈 개체** 변곡점 [초, 표적 태그] — 0은 '겨눈 것 없음'(참값 판 6부터).
       *  `undefined`면 그 덤프는 표적을 모르는 옛 판이다 — 그때는 아무 공격도 안 그린다
       *  (어림으로 메우던 자리를 걷었다: 지시 "다른 유닛도 모두 공통으로 다 걷어내"). */
      tgt?: Ticks;
      /** 탑승 구간(요청: 수송선 승하차) — 이 동안 마커를 숨긴다.
       *  이어 주는 선을 그리려면 '언제'만으로는 모자라고 '어디에서 어디로'가 있어야 한다.
       *  이쪽 끝(몸)은 자취가 낸다:
       *      a·ax·ay  탈 때 — 마지막으로 밖에 서 있던 자리
       *      b·bx·by  내릴 때 — 다시 밖에 선 자리
       *  ★ 배 쪽 끝은 **여기 안 담는다**(지적: "점선이 전혀 엉뚱한 데랑 이어져") —
       *    한때 '안에 든 첫·마지막 키'를 배의 자리로 담아 두었는데, 참값은 태우는 순간
       *    그 몸의 자리를 **얼려 둔다**(움직이는 것은 배뿐이다). 곧 그 값은 배가 아니라
       *    '탔던 자리'였다. 배는 그리는 쪽이 그 순간 곁에서 찾는다(rideCarriers9). */
      rides: {
        a: number; b: number;
        ax: number; ay: number; bx: number; by: number;
      }[];
      /** 상태 구간 [시작, 끝, 종류](전수조사) — 빙결은 정지, 나머지는 색 오라. */
      statuses: [number, number, string][];
      /** 개인 클로킹 구간(레이스·고스트 f=14/15). */
      cloaks: [number, number][];
      /** 명령(이동·공격·정지) 시각들 — 선택 링(지적: 드래그 선택 구분)의 재료. */
      orders: number[];
      /** 그 사람의 연구 기록 — 걸음 속도 상한(요청)이 속업을 반영하는 재료. */
      ups: [number, string, number][] | undefined;
      /** 걸음 — 참값 키를 생애 구간만 가리키는 창(WalkView). 복사가 없다(위 replayTrack의 ★). */
      walk: WalkView;
      /** 걸음이 코어(simCore)에서 왔나 — 렌더러 보정을 끄는 열쇠(과제 #61). */
    }[] = [];
    for (const e of entData.lives) {
      // 건물(태그·물리 모두)은 v1 층이 계속 그린다 — 여기는 유닛만.
      /* 건물(태그·물리 -1)은 v1 건물 층이 그린다. 합성 개체(원장 출신, -1000 이하)는
         유닛이다(요청: 한 번도 안 집힌 유닛도 태어나 랠리로 걸어간다). */
      if (e.bld || e.tag === -1) continue;
      const raw = nameOfId.get(e.owner) ?? "";
      const pUps = upsByRaw.get(raw);
      // 위치 없는 증거(생산·랠리, x=-1)는 걷기 재료가 아니다.
      /* 행렬 물리(지적: 이동을 찍으면 한 번에 출발하는 게 아니라 한 줄이 되면서 간다) +
         새 겹침 방지(지적: 다시 넣되 세련되게) — 같은 클릭(같은 사람·초·자리)을 받은
         개체들에 차례를 매겨, (a) 출발을 0.22초씩 늦춰 자연스럽게 한 줄 행렬이 되고,
         (b) 도착 자리는 클릭 지점 둘레 해바라기 나선으로 벌려 서로 안 포개진다 —
         프레임마다 밀치는 이완 대신 목적지 대형으로 푸는 방식이라 떨림이 없다. */
      /* 승선 구간(수리: 태운 아콘이 지도에 남고, 셔틀을 따라 벽을 뚫고 가고, 일부는
         제 발로 걸어가 공격한다) — 예전엔 승선(f=12) 다음에 오는 '아무' 증거를 구간의
         끝으로 삼았다. 그런데 셔틀과 승객을 함께 잡아 둔 채 이동을 찍는 것이 보통이라,
         비행 중에 찍힌 그 명령이 곧바로 구간을 닫았다 — 승객이 배 안에서 도로 튀어나와
         제 발로 100타일을 가로질렀다(실측: 게임 1의 승선 21건 중 5건).
         구간의 끝은 짝이 되는 하차(f=13)다. 하차 기록이 없으면, 배 안에서 낼 수 없는
         제 명령(8초 뒤의 이동·공격)이 나오기 전까지 배 안이다. */
      /* (걷어냄) **승선 구간 색인과 명령 자취(pts)** — 둘 다 유추 시절의 뼈대다.
         · 승선 구간은 승선·하차 증거(f=12·13)로 만들었는데 참값은 그 갈래를 안 낸다.
           배 안인지는 이제 자취의 상태(ST_INSIDE)가 프레임마다 직접 말한다.
         · pts는 명령 좌표를 이어 붙여 만들던 **걸음 후보**였다. 걸음이 참값 자취(wk)로
           바뀐 뒤로는 만들어 놓고 **한 번도 안 읽혔다** — 정렬하고 출발점까지 심어 두고
           버리던 죽은 일이다. 개체 수천 × 명령 수천을 프레임마다 훑던 자리이기도 하다. */
      /* ★ 탑승 구간은 **참값의 상태가 낸다**(요청: 수송선 승하차가 눈에 안 띈다) ────────
         여기 있던 것은 빈 배열 그대로였다 — 승선·하차 증거(f=12·13)로 만들던 자리인데
         참값은 그 갈래를 안 내므로 한 번도 안 찼다(윗줄 걷어냄 주석이 그것이다).
         그 바람에 아래 승하차 연출(빛기둥·축소·회전)이 통째로 죽은 코드였고, 배 안이면
         곧바로 안 그리는 문(simNow.state === ST_INSIDE)만 남아 몸이 한 프레임에 사라졌다.
         그런데 그 답은 이미 자취에 있다 — 상태 ST_INSIDE가 프레임마다 '안에 들었다'를
         말한다(은신 칸과 똑같은 결이다). 잇달아 든 구간을 묶고, 그 앞뒤 키에서 두 끝
         자리를 함께 뜬다. */
      const rideSpans: {
        a: number; b: number;
        ax: number; ay: number; bx: number; by: number;
      }[] = [];
      /* (걷어냄) 증거가 없으면 안 그리던 문 — 걸음이 명령 증거에서 오던 시절의 자다.
         아래에서 보듯 걸음은 이제 참값 자취에서 온다. 참값에는 명령이 없는 유닛(시작
         일꾼·라바·자동 생산분)도 다 들어 있는데, 이 문이 그것들을 통째로 걸렀다 —
         화면에 유닛이 하나도 안 태어나던 원인이다. */
      /* ★ 걸음은 코어 하나뿐이다(과제 #61 → 정식 배포) — 여태는 렌더러가 제 길찾기·
         속도표·대기점으로 자취를 하나 더 만들어 두고 그리기 직전에 코어 자리로
         덮어썼다. 둘이 나란히 돌면 **표적 지도가 덮어쓰기 전 자리를 본다**: 몸은
         코어가 낸 데 서 있는데 겨눠지는 자리는 렌더러 어림이라, 총알이 딴 데로 갔다.
         이제 코어 자취가 없으면 그 개체는 **안 그린다** — 대역으로 비슷한 것을
         지어내면 코어가 못 낸 개체가 있다는 사실이 화면에서 사라진다. */
      const simTr0 = simTracks?.get(e.tag);
      if (!simTr0 || simTr0.kt.length < 1) continue;
      /* ★ 걸음은 **이 생애의 구간만** 담는다(지적: "라바 알이 왜 기어다니냐 라바같은데")
         — 자취 하나가 여러 생애를 품는다: 태그 하나가 라바 → 알 → 드론으로 갈아입고,
         truthLives가 그 경계에서 생애를 가른다. 그런데 여기서 자취의 **모든** 키를
         생애마다 통째로 복사했다. 그러면 라바의 걸음이 드론이 죽을 때까지 이어져,
         아래 그리기의 '언제부터 언제까지 보이나'가 생애가 아니라 태그 전체가 된다 —
         드론 곁에 라바와 알이 평생 따라다녔다. 구간 밖 키를 잘라 그 뿌리를 막는다. */
      const wEnd = e.died ?? Infinity;
      /* 구간 [born, wEnd]의 키 범위 — 키는 시각순이라 이어진 한 토막이다. 복사 없이 창으로 가리킨다. */
      const nK9 = simTr0.kt.length;
      let k0 = 0;
      while (k0 < nK9 && kT(simTr0, k0) < e.born) k0 += 1;
      let k1 = k0;
      while (k1 < nK9 && kT(simTr0, k1) <= wEnd) k1 += 1;
      const wk: WalkView = k1 > k0 ? { tr: simTr0, i0: k0, n: k1 - k0 } : EMPTY_WALK;
      {
        /** 안에 든 첫 키의 자리(-1이면 지금 밖) · 밖에 있던 마지막 키의 자리. */
        let in0 = -1;
        let out9 = -1;
        let last9 = -1;
        const kS9 = (i: number): number => simTr0.kst[i];
        const kX9 = (i: number): number => simTr0.kxy[i * 2] / 32;
        const kY9 = (i: number): number => simTr0.kxy[i * 2 + 1] / 32;
        for (let q = 0; q < nK9; q += 1) {
          const tq9 = kT(simTr0, q);
          if (tq9 < e.born || tq9 > wEnd) continue;
          if (kS9(q) === ST_INSIDE) {
            if (in0 < 0) in0 = q;
          } else {
            /* ★ **가스 캐기는 탑승이 아니다**(지적: "가스 캐는 일꾼들에 없던 아쿠아 점선이
               엄청 연결돼 있고 정신이 하나도 없어") ────────────────────────────────────
               원작에서 일꾼은 가스를 캐는 동안 **정제소 안으로 들어간다** — 참값의 상태로는
               수송선에 탄 것과 똑같은 ST_INSIDE다. 그래서 구간을 상태만 보고 묶으면 가스
               일꾼 하나가 왕복마다 '승하차'를 한 번씩 하는 꼴이 되어, 화면이 점선과 회전으로
               뒤덮인다(한 번 왕복이 2초 남짓이다).
               가르는 자는 **앞뒤 상태**다. 가스 왕복은 들어가기 직전이 채취(ST_GATHER)이거나
               나온 직후가 가스 들기(ST_CARRY_GAS)다 — 둘 다 배에 타고 내리는 몸에는 없는
               상태다. 반대로 수송선·벙커에 드는 몸은 그 앞뒤가 가만·이동이다. */
            const gas9 = (out9 >= 0 && kS9(out9) === ST_GATHER)
              || kS9(q) === ST_CARRY_GAS;
            /* ★ **생산도 탑승이 아니다**(지적: "스타포트에서 드랍십이 생산될 때 둘이
               연결되는 버그") ─────────────────────────────────────────────────────────
               원작에서 건물이 찍어 내는 유닛은 다 될 때까지 **건물 안에 숨어 있다** —
               참값의 상태로는 수송선에 탄 것과 똑같은 ST_INSIDE다(덤퍼가 us_hidden을
               그 값으로 적는다). 그래서 갓 나온 드랍십이 '방금 내렸다'로 읽혔고, 그리는
               쪽은 곁에서 배를 찾다가 제 스타포트 자리를 짚어 줄을 그었다.
               가르는 자는 **밖에 선 적이 있나**다. 진짜 승객은 걸어와서 타므로 그 구간
               앞에 밖의 키가 반드시 있고(out9 ≥ 0), 생산되는 몸은 첫 키가 곧 ST_INSIDE라
               그것이 없다. 없으면 이 구간은 통째로 버린다 — 여태 그 자리를 '배 자리로
               갈음'해 억지로 살려 뒀는데, 갈음할 자리가 없다는 것이 곧 승객이 아니라는
               뜻이었다. */
            if (in0 >= 0 && (gas9 || out9 < 0)) in0 = -1;
            else if (in0 >= 0) {
              rideSpans.push({
                a: kT(simTr0, in0), b: kT(simTr0, q),
                ax: kX9(out9), ay: kY9(out9),
                bx: kX9(q), by: kY9(q),
              });
              in0 = -1;
            }
            out9 = q;
          }
          last9 = q;
        }
        /* 끝까지 안에 있었으면 **내린 적이 없다**(배가 격추됐거나 경기가 끝났다) —
           끝을 무한으로 두어 다시 나타나지 않게 한다. */
        if (in0 >= 0 && out9 >= 0 && kS9(out9) !== ST_GATHER) {
          rideSpans.push({
            a: kT(simTr0, in0), b: Number.POSITIVE_INFINITY,
            ax: kX9(out9), ay: kY9(out9),
            bx: kX9(last9), by: kY9(last9),
          });
        }
      }
      if (wk.n === 0) continue;
      /* 상태(전수조사) — 시전 순간 그 자리에 있었으면 걸린다. 적이 건 것만(스태시스는
         아군 오폭도 언다). */
      const statuses: [number, number, string][] = [];
      for (const [cs5, cx9, cy9, tech5, craw5] of castsV2) {
        const cfg = STATUS_CASTS[tech5];
        if (!cfg) continue;
        if (!cfg.any && craw5 === raw) continue;
        const pp5 = posAtW(wk, cs5);
        if (!pp5) continue;
        /* ★ **제 몸의 반지름만큼 더 센다**(지적: 스태시스에 걸린 무리인데 우리가 하나만
           그려진다) — 여태 시전 자리에서 유닛 **중심**까지의 거리만 봤다. 그런데 원작이
           가두는 것은 그 판에 **몸이 걸친** 유닛이다: 판 가장자리에 반쯤 걸친 큰 몸도
           함께 언다. 중심만 재면 무리 가운데 하나만 걸리고 둘레는 멀쩡히 날아다닌다 —
           화면에서는 '우리가 한 번만 그려진다'로 보인다.
           몸 반지름은 진형 간격을 정하는 그 값(UNIT_BODY_TILES)의 절반이다. */
        const half5 = (UNIT_BODY_TILES[UNIT_3D[e.kind] ?? e.kind]
          ?? CLASS_TILES[1]) / 2;
        if (Math.hypot(cx9 - pp5.x, cy9 - pp5.y) > cfg.r + half5) continue;
        statuses.push([cs5, cs5 + cfg.dur, cfg.kind]);
      }
      /* ★ 은신 구간은 이제 **참값이 낸다**(요청: "참값에 은신 칸 추가하는 쪽으로 가자.
         당연히 근본적인 해결책으로 가야지") ────────────────────────────────────────────
         여태 이 자리는 켬·끔 증거(f=14·15)로 만들려다 늘 빈손이었다 — 참값의 상태에
         '은신'이라는 칸 자체가 없었기 때문이다. 그래서 다크템플러·옵저버처럼 **이름으로
         아는** 상시 은신만 화면에 나왔고, 연구로 켜는 레이스·고스트의 은신은 통째로
         빠져 있었다(핵 쏘는 고스트가 안 투명하던 것이 그것이다).
         이제 덤퍼가 키마다 제 은신 깃발을 싣고(판 5의 상태 바이트 0x20) 자취가 그것을
         구간으로 묶어 준다 — 유추할 것이 없다. 옛 판으로 구운 경기는 빈 배열이라
         종전과 같다(모르는 것은 모르는 대로 둔다). */
      const cloaks: [number, number][] = e.cloaks ?? [];
      /* 건설에 흡수(지적: 테란 일꾼이 건설을 시작하면 복제처럼 둘이 됐다가, 끝나면
         원래 일꾼이 복제된 자리에 영영 서 있음) — 명령받은 진짜 일꾼 개체는 건설
         앵커(f=2)가 마지막 증거라 생존 원칙으로 현장에 박제됐고, 공사 중 모습은 합성
         건설 일꾼 연출이 따로 그려 둘로 보였다. 마지막 위치 증거가 건설 앵커면 현장
         도착(걷기 마지막 점)부터 공사에 흡수시켜 숨긴다 — 그 뒤 제 증거가 생기는
         일꾼은 애초에 이 조건에 안 걸려 그대로 걸어 나온다. */
      /* (걷어냄) **공사 중 일꾼 숨김** — 짓는 동안 진짜 일꾼을 숨기고 그 자리에 합성
         건설 SCV를 세우던 짝이다. 합성 SCV를 위에서 걷었으므로 숨김도 함께 걷는다 —
         안 그러면 짓는 동안 그 자리에 **아무도 없다**. 판정 재료(일꾼에게 달린 건설
         증거 f=2)도 참값에는 없어 어차피 늘 빈손이었다. 참값에서는 진짜 일꾼이 제
         자취대로 현장에 서 있다가 걸어 나간다 — 숨기고 세울 것이 없다. */
      const buildHideAt: number | null = null;
      const buildHides: [number, number][] = [];
      out.push({
        raw, unit: e.kind, born: e.born, died: e.died, end: e.end, tag: e.tag,
        buildHideAt, buildHides, ups: pUps,
        // 건설 자리 — 참값에서는 **건물 생애**에만 달린다(일꾼에게는 안 달린다).
        buildSites: e.sites.map((v) => [v[0], v[1], v[2]] as [number, number, number]),
        /* 공격 명령 [초, 표적 태그, x, y] — 참값의 명령에는 **표적 태그가 없다**(누른
           자리만 남는다). 그래서 표적은 0으로 두고, 아래 교전은 자리로 찾는다.
           (걷어냄) 버로우(18·19)·수리(10)는 참값이 안 내는 갈래라 늘 빈 배열이었다. */
        atkAt: e.orders.filter((o) => o[3])
          .map((o) => [o[0], 0, o[1], o[2]] as [number, number, number, number]),
        sieges: e.sieges.map(([s9, on9]) => [s9, on9 ? 1 : 0] as [number, number]),
        hp: e.hp ?? EMPTY_TICKS,
        ic: e.ic ?? EMPTY_TICKS,
        // 표적은 **없으면 없는 채로** 넘긴다(빈 배열로 바꾸면 '옛 판'과 '안 겨눔'이 섞인다).
        ...(e.tgt ? { tgt: e.tgt } : {}),
        orders: e.orders.map((o) => o[0]),
        // 승선 구간 — 위 rideSpans(짝이 되는 하차까지)를 그대로 쓴다.
        rides: rideSpans,
        // 걸음은 늘 코어가 낸 자취다 — 렌더러가 따로 어림하는 갈래는 없앴다.
        walk: wk,
        statuses,
        cloaks,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })();
  const nukeCasts = (() => entWalks
    .filter((q) => q.unit === "Nuclear Missile" && q.died !== null)
    .map((q) => {
      const at = posAtW(q.walk, q.died ?? 0);
      const from = posAtW(q.walk, q.born);
      if (!at || !from || Math.hypot(at.x - from.x, at.y - from.y) < 6) return null;
      return [(q.died ?? 0) - NUKE_FALL_SEC - NUKE_LEAD_SEC,
        at.x, at.y, "Nuclear Strike", q.raw] as CastRow;
    })
    .filter((c): c is CastRow => c !== null))();
  const nukeLase = (() => entWalks
    .filter((q) => q.unit === "Nuclear Missile" && q.died !== null)
    .map((q) => {
      const at = posAtW(q.walk, q.died ?? 0);
      const from = posAtW(q.walk, q.born);
      if (!at || !from || Math.hypot(at.x - from.x, at.y - from.y) < 6) return null;
      return { t0: q.born, t1: q.died ?? 0, x: at.x, y: at.y };
    })
    .filter((c): c is { t0: number; t1: number; x: number; y: number } => c !== null))();
  const castsSrc = (() => {
    if (nukeCasts.length === 0) return castsV2;
    const out = [...castsV2];
    for (const c9 of nukeCasts) {
      const dup9 = out.some((o9) => o9[3] === "Nuclear Strike"
        && Math.abs(o9[0] - c9[0]) <= 3
        && Math.hypot(o9[1] - c9[1], o9[2] - c9[2]) <= 3);
      if (!dup9) out.push(c9);
    }
    return out;
  })();
  const nukeImpacts = (() => castsSrc
    .filter((c) => c[3] === "Nuclear Strike")
    .map((c) => {
      const sec = c[0] + NUKE_FALL_SEC;
      const bldGone = buildsSrc.some(([bs, bx2, by2, bu, , g2]) => {
        const gone = g2 ?? 0;
        return gone > 0 && gone >= sec - 2 && gone - sec <= 90 && bs <= sec
          && Math.hypot(bx2 + footDx(bu) - c[1], by2 + footDy(bu) - c[2]) <= 5;
      });
      /* 증거를 하나 더 센다(지적: "포토캐논이 핵 한 방에 안 터지는 것") — 폭심에 건물이
         **없거나** 그 건물의 파괴가 안 잡히면 판정이 통째로 불발이 됐다. 그러면 폭발도
         안 그리고 건물도 안 걷힌다: 캐논 하나만 서 있던 자리에 핵이 떨어지면 아무 일도
         안 일어난 것처럼 보인다. 착탄 언저리에 폭심 4타일 안에서 **개체가 죽었으면**
         그것도 터진 증거다. */
      const entDied = entWalks.some((q9) => {
        if (q9.died === null || q9.died < sec - 1 || q9.died > sec + 3) return false;
        const p9 = posAtW(q9.walk, Math.min(q9.died, sec));
        return !!p9 && Math.hypot(p9.x - c[1], p9.y - c[2]) <= 4;
      });
      /* 미사일 자신의 죽음이 곧 착탄 증거다(수리: 핵 연출 복원) — 날아간 미사일이 그
         자리·그 시각에 죽었으면 터진 것이다. 아무것도 못 죽인 핵(빈 땅 착탄)도 이
         증거로는 터진 핵이라, 폭발이 사라지지 않는다. */
      const msHit = entWalks.some((q9) => {
        if (q9.unit !== "Nuclear Missile" || q9.died === null) return false;
        if (Math.abs(q9.died - sec) > 1.5) return false;
        const p9 = posAtW(q9.walk, q9.died);
        return !!p9 && Math.hypot(p9.x - c[1], p9.y - c[2]) <= 3;
      });
      return { sec, x: c[1], y: c[2], confirmed: bldGone || entDied || msHit };
    }))();
  const bldGoneEff = (() => {
    const m9 = new Map<typeof buildsSrc[number], number>();
    for (const b9 of buildsSrc) {
      const [bs9, bx9, by9, bu9, , bg9, bl9] = b9;
      const goneAt = bg9 ?? 0;
      if (bl9 !== undefined) { m9.set(b9, goneAt); continue; }
      let eff = goneAt;
      for (const nk of nukeImpacts) {
        const d9 = Math.hypot(bx9 + footDx(bu9) - nk.x, by9 + footDy(bu9) - nk.y);
        if (goneAt > 0 && nk.sec <= goneAt && goneAt - nk.sec <= 90 && d9 <= 5) {
          eff = Math.min(eff, nk.sec);
        }
        if (nk.confirmed && nk.sec >= bs9 && d9 <= 4
          && !["Command Center", "Nexus", "Hatchery", "Lair", "Hive"].includes(bu9)) {
          eff = eff > 0 ? Math.min(eff, nk.sec) : nk.sec;
        }
      }
      m9.set(b9, eff);
    }
    return m9;
  })();
  const goneEffOf = (b9: typeof buildsSrc[number]): number => bldGoneEff.get(b9) ?? (b9[5] ?? 0);
  const prodByRawType = (() => {
    const m = new Map<string, [number, number, number][]>();
    if (!entData) return m;
    const nameOfId = new Map(entData.players.map((pl) => [pl.owner, pl.name]));
    /* 어느 건물이 냈나는 **참값이 곧장 안다**(지적: 어댑터 걷기) — 옛 코드는 분석이
       꽂아 둔 '이 건물이 일했다'(f=4) 증거를 읽었는데, 참값은 그 갈래를 안 만드는 대신
       **유닛이 처음 나타난 실제 자리**를 안다. 그 자리를 품은 건물이 그 유닛을 낸
       건물이다 — 순번 어림도, 대표 건물 폴백도 필요 없다. */
    const blds = entData.lives.filter((e) => e.bld && e.kind && e.tag !== -1
      && e.sites.length > 0);
    for (const u of entData.lives) {
      if (u.bld || !u.kind) continue;
      const raw = nameOfId.get(u.owner);
      if (raw === undefined) continue;
      /* ★ 자리만으로는 **엉뚱한 건물이 걸린다**(지적: "배럭 생산중 불깜빡 안함") ────────
         출구는 발자국 바로 바깥이라 한 타일 여유를 두는데, 테란은 건물을 벽처럼 붙여
         짓는다 — 배럭 옆에 서플라이가 딱 붙어 있으면 마린이 태어난 칸이 **두 건물의
         여유 구간에 함께** 든다. 그런데 이 찾기는 배열에서 먼저 나오는 것을 집으므로,
         서플라이가 먼저 지어졌으면 그쪽이 '낸 건물'이 된다. 서플라이는 불빛 종류가
         아니라(LIT_KINDS) 아무 데도 안 켜지고, 정작 배럭은 제 생산을 못 받는다.
         **못 뽑는 건물은 후보가 아니다** — 그 표는 이미 있다(PRODUCED_BY). 뽑을 수 있는
         것 중에서 고르고, 그래도 여럿이면 태어난 칸에 **가장 가까운** 것을 집는다.
         표에 없는 건물 종류(부속·방어)는 예전처럼 자리만 본다 — 값이 없다고 못 고르면
         옛 판보다 나빠진다. */
      const near9 = blds.filter((b9) => {
        if (b9.owner !== u.owner || b9.born > u.born || (b9.died ?? Infinity) < u.born) return false;
        const st = b9.sites[b9.sites.length - 1];
        const [fw9, fh9] = FOOTPRINT[b9.kind] ?? [3, 2];
        // 발자국에서 한 타일 여유 — 출구는 발자국 바로 바깥이다.
        return u.bornX >= st[1] - 1 && u.bornX <= st[1] + fw9 + 1
          && u.bornY >= st[2] - 1 && u.bornY <= st[2] + fh9 + 1;
      });
      const makers9 = near9.filter((b9) => (PRODUCED_BY[b9.kind] ?? []).includes(u.kind));
      /* ★ 발자국 곁에 **뽑을 수 있는 건물이 하나도 없으면 조금 더 넓게 본다**(계측:
         진단이 "정구|Supply Depot=2 · 수달이|Pylon=2"를 냈다 — 서플라이와 파일런이
         유닛을 뽑는 건물로 올라 있었다) ─────────────────────────────────────────────
         출구 여유 한 타일은 유닛이 건물 바로 옆에 서 있을 때 이야기다. 붙여 지은 테란
         본진에서는 마린이 배럭이 아니라 옆 서플라이의 여유 구간에서만 잡히는 일이
         생기고, 그러면 뽑는 건물이 서플라이가 된다 — 서플라이는 불빛 종류가 아니니
         그 생산은 통째로 사라지고 배럭은 영영 안 깜빡인다.
         그래서 곁에서 못 찾으면 **여섯 타일 안에서 뽑을 수 있는 것** 중 가장 가까운
         것을 고른다. 그래도 없으면 예전처럼 자리만 본다. */
      const wide9 = makers9.length > 0 ? [] : blds.filter((b9) => {
        if (b9.owner !== u.owner || b9.born > u.born || (b9.died ?? Infinity) < u.born) return false;
        if (!(PRODUCED_BY[b9.kind] ?? []).includes(u.kind)) return false;
        const st = b9.sites[b9.sites.length - 1];
        const [fw9, fh9] = FOOTPRINT[b9.kind] ?? [3, 2];
        return Math.hypot(u.bornX - (st[1] + fw9 / 2), u.bornY - (st[2] + fh9 / 2)) <= 6;
      });
      const pool9 = makers9.length > 0 ? makers9 : (wide9.length > 0 ? wide9 : near9);
      const host = pool9.length <= 1 ? pool9[0] : pool9.reduce((a9, b9) => {
        const d9 = (x9: typeof a9): number => {
          const st9 = x9.sites[x9.sites.length - 1];
          const [fw9, fh9] = FOOTPRINT[x9.kind] ?? [3, 2];
          return Math.hypot(u.bornX - (st9[1] + fw9 / 2), u.bornY - (st9[2] + fh9 / 2));
        };
        return d9(b9) < d9(a9) ? b9 : a9;
      });
      if (!host) continue;
      const key = `${raw}|${host.kind}`;
      const a = m.get(key) ?? [];
      a.push([u.born, host.tag, UNIT_BUILD_SEC[u.kind] ?? 30]);
      if (a.length === 1) m.set(key, a);
    }
    for (const a of m.values()) a.sort((x, y) => x[0] - y[0]);
    /* #diag — "이 건물이 안 깜빡인다"는 신고를 눈이 아니라 수로 가린다: 색인이 비어
       있으면 호스트 찾기가 실패한 것이고, 차 있으면 갈림은 그 아래 태그 맞대기다. */
    if (scrDiagOn()) {
      SCR_DIAG.prod = [...m.entries()].map(([k9, v9]) => `${k9}=${v9.length}`).join(" · ");
    }
    return m;
  })();
  const bldTagAt = (() => {
    const m = new Map<string, number>();
    for (const r of bldTagSpots.rows) {
      m.set(`${r.raw}|${r.k}|${Math.round(r.x)}|${Math.round(r.y)}`, r.tag);
    }
    return m;
  })();
  const tagOrdinals = (() => {
    const m = new Map<string, Map<number, number>>();
    for (const [key, evs] of prodByRawType) {
      const type = key.slice(key.indexOf("|") + 1);
      if (type === "Hatchery" || type === "Lair" || type === "Hive") continue;
      const ord = new Map<number, number>();
      for (const [, tag] of evs) if (tag > 0 && !ord.has(tag)) ord.set(tag, ord.size);
      if (ord.size > 0) m.set(key, ord);
    }
    return m;
  })();
  const buildsByType = (() => {
    const m = new Map<string, number[]>();
    buildsSrc.forEach((b, i) => {
      const key = `${b[4]}|${b[3]}`;
      const arr = m.get(key);
      if (arr) arr.push(i);
      else m.set(key, [i]);
    });
    for (const arr of m.values()) arr.sort((a, b) => buildsSrc[a][0] - buildsSrc[b][0]);
    return m;
  })();
  const halls = (() => buildsSrc
    .filter(([, , , unit]) => ["Command Center", "Nexus", "Hatchery", "Lair", "Hive"].includes(unit))
    .map(([sec, x, y, unit, raw, gone, , doneAt]) => ({
      sec, x: x + footDx(unit), y: y + footDy(unit), raw, gone: gone ?? 0,
      /* 완공 시각 — 참값이 말하고, 없으면 착공 + 표의 건설 시간이다. 자원 반납 숨김이
         이 값을 본다: **짓는 중인 건물은 들어갈 수 있는 곳이 아니다**(아래 inHall). */
      done: doneAt ?? sec + (BUILD_SEC[unit] ?? 30),
    })))();
  const gasBuildings = (() => buildsSrc
    .map((row, i) => [row, i] as const)
    .filter(([[, , , unit]]) => ["Refinery", "Assimilator", "Extractor"].includes(unit))
    .map(([[sec, x, y, unit, raw, gone, , doneAt]]) => ({
      sec, x: x + footDx(unit), y: y + footDy(unit), raw, gone: gone ?? 0,
      /* 창문 불빛이 제 건물을 도로 찾는 열쇠(요청: 가스 캘 때 불빛) — 건물 op의
         pickKey와 **똑같은 자**여야 한다. 그래서 그리는 자리(x+footDx)가 아니라 줄이
         적어 둔 x·y와 종류로 짓는다. */
      litKey: `b${raw}|${unit}|${Math.round(x * 4)}|${Math.round(y * 4)}`,
      // 완공 시각(요청: "간헐천은 건물을 짓는 동안만 보이고 완공되면 안보임") — 참값이 말한다.
      done: doneAt ?? sec + (BUILD_SEC[unit] ?? 30),
    })))();
  const resStageSeries = (() => {
    const m = new Map<string, [number, number][]>();
    for (const [sec9, rx9, ry9, lv9] of entData?.resFields ?? []) {
      const k9 = `${Math.round(rx9 * 2)}|${Math.round(ry9 * 2)}`;
      const arr9 = m.get(k9);
      if (arr9) arr9.push([sec9, lv9]);
      else m.set(k9, [[sec9, lv9]]);
    }
    for (const arr9 of m.values()) arr9.sort((a, b) => a[0] - b[0]);
    return m;
  })();
  const gridHasGasFlags = (grid.resources ?? []).some((r) => r[2] === 1);
  const gasHideOf = (() => {
    const rs = (grid.resources ?? []).filter((r) => !gridHasGasFlags || r[2] === 1);
    return gasBuildings.map((g) => {
      let gx = -1;
      let gy = -1;
      let gd = Infinity;
      for (const r of rs) {
        const d = Math.hypot(g.x - r[0], g.y - r[1]);
        if (d < gd) { gd = d; gx = r[0]; gy = r[1]; }
      }
      return { ...g, gx, gy, gd };
    });
  })();
  const mines = (() => castsSrc
    .filter((c) => c[3] === "Spider Mines")
    .map(([sec, x, y, , raw]) => {
      let boom = 0;
      // (스토리 다이어트) 적 접근은 v2 개체 자취로 잰다 — v1 pts는 더 안 실린다.
      for (const q of entWalks) {
        if (teamOfRaw(q.raw) === teamOfRaw(raw)) continue;
        for (let wi9 = 0; wi9 < q.walk.n; wi9 += 1) {
          const ps = wT(q.walk, wi9);
          const px = wX(q.walk, wi9);
          const py = wY(q.walk, wi9);
          if (ps <= sec + 4 || Math.hypot(px - x, py - y) > 2) continue;
          if (boom === 0 || ps < boom) boom = ps;
          break;
        }
      }
      return { sec, x, y, raw, boom };
    }))();
  const bldPre9 = ((): { fade: number[]; landed: boolean[]; flown: (typeof buildsSrc)[number][];
    succAt: number[] } => {
    const n9 = buildsSrc.length;
    const fade: number[] = new Array(n9);
    const landed: boolean[] = new Array(n9);
    const flown: (typeof buildsSrc)[number][] = new Array(n9);
    const succAt: number[] = new Array(n9).fill(Infinity);
    /* 임자별 색인 — 세 훑기가 모두 `r2 === raw`로 시작한다. 임자로 먼저 갈라 두면
       훑는 길이가 전체가 아니라 그 임자의 건물 수로 준다. */
    const byRaw9 = new Map<string, number[]>();
    for (let j9 = 0; j9 < n9; j9 += 1) {
      const r9 = buildsSrc[j9][4];
      let a9 = byRaw9.get(r9);
      if (!a9) { a9 = []; byRaw9.set(r9, a9); }
      a9.push(j9);
    }
    const raceByKey9 = new Map<string, string | undefined>();
    for (const b9 of bases) raceByKey9.set(b9.key, b9.race);
    for (let i9 = 0; i9 < n9; i9 += 1) {
      const [sec9, x9, y9, unit9, raw9] = buildsSrc[i9];
      fade[i9] = raceByKey9.get(raw9) === "저그" ? 0 : 1.2;
      const mates9 = byRaw9.get(raw9) ?? [];
      let land9 = false;
      let fl9: (typeof buildsSrc)[number] | undefined;
      let sa9 = Infinity;
      for (let mi9 = 0; mi9 < mates9.length; mi9 += 1) {
        const j9 = mates9[mi9];
        const [s2, x2, y2, u2, , g2, l2] = buildsSrc[j9];
        if (sec9 > 0 && u2 === unit9 && (x2 !== x9 || y2 !== y9)) {
          if (l2 !== undefined && (g2 ?? 0) === sec9) land9 = true;
          if (!fl9 && (g2 ?? 0) > 0 && (g2 ?? 0) === sec9) fl9 = buildsSrc[j9];
        }
        if (j9 !== i9 && s2 > sec9 && s2 < sa9
          && Math.hypot(x2 - x9, y2 - y9) <= SAME_SITE_TILES && succeedsBld(unit9, u2)) {
          sa9 = s2;
        }
      }
      landed[i9] = land9;
      flown[i9] = fl9 as (typeof buildsSrc)[number];
      succAt[i9] = sa9;
    }
    const v = { fade, landed, flown, succAt };
    return v;
  })();
  return {
    entData, simTracks, buildsSrc, castsV2, entBldHp, bldTagSpots, droneMorph, buildsDrawOrder, bldNudge,
    entCombatStart, upsByRaw, prodDoneAt, prodDoneByRaw, marineBornOf, entWalks, nukeCasts, nukeLase, castsSrc,
    nukeImpacts, bldGoneEff, goneEffOf, prodByRawType, bldTagAt, tagOrdinals, buildsByType, halls, gasBuildings,
    resStageSeries, gridHasGasFlags, gasHideOf, mines, bldPre9, bldRecMemo, teamOfRaw, bases, grid, total,
  };
}

/** 엔진의 화면 쪽 입력 — 배율·팬은 **안 들어간다**(프레임은 배율과 무관하다). 상자 크기·기울기·시점·색만. */
export type EngineView9 = {
  mapW: number; mapH: number; tilePx: number;
  pitched: boolean; pitchFlat: number; geom: PitchGeom9;
  viewTeam: number; visAll: boolean; fogOn: boolean;
  colors: Record<string, string>;
  qAnim: boolean; qBuildFx: boolean; qDeath: boolean; clickFx: boolean;
  /** 덜어내기 단(0·1·2) — 폰에서 붓이 잰다(ReplayMotionPlayer의 CROWD9: 화면 유닛 수 문턱 +
   *  그리기 ms 방아쇠). 1단부터 홀수 개체의 트레이서를 안 낸다(맞는 중이면 낸다). 그림자·
   *  파편 수는 붓이 제 자리에서 줄인다. 없으면 0. */
  crowd?: number;
  /** 시야 사각형(자리 분수, 여유 포함) — 이 밖의 개체·건물은 op를 안 만든다(미니맵 점만). null이면 지도 전체.
   *  (요청: 컬링 — 옛 메인 엔진의 cull9. 워커는 지도 전체 690기 대신 보이는 170기만 센다.) */
  cull: { x0: number; x1: number; y0: number; y1: number } | null;
};
export function createEngine9(world: EngineWorld9, view0: EngineView9) {
  let view = view0;
  const {
    entData, simTracks, buildsSrc, entBldHp, bldTagSpots, droneMorph, buildsDrawOrder, bldNudge,
    entCombatStart, upsByRaw, marineBornOf, entWalks, nukeLase, castsSrc,
    goneEffOf, prodByRawType, bldTagAt, tagOrdinals, buildsByType, halls, gasBuildings,
    resStageSeries, gridHasGasFlags, gasHideOf, mines, bldPre9, bldRecMemo, teamOfRaw, bases, grid, total,
  } = world;
  const gw9 = grid.width;
  const gh9 = grid.height;
  const FOG_NEVER = 65535;
  /* 옛 ref들 — 엔진의 상태. 프레임 사이를 잇는 기억(발사 위상·조준 고정·굴 판 시각·가스 불·방향 스무딩). */
  const fireStartRef = { current: new Map<string, { start: number; at: number }>() };
  const aimLockRef = { current: new Map<string, { ph: number; deg: number; len: number }>() };
  const burrowAtRef = { current: new Map<string, number>() };
  const gasLitRef = { current: new Map<string, number>() };
  const engageHoldRef = { current: new Map<string, { x: number; y: number; t0: number; tLast: number; adv: number; px: number; py: number; fx: number; fy: number }>() };
  const hdgMemRef = { current: new Map<string, { h: number; t: number; tg: number; px: number; py: number; lb: number }>() };
  const dispHdgRef = { current: new Map<string, { x: number; y: number; h: number; t: number }>() };
  const fogStampRef = { current: { key: "", at: -1e9, ms: -1e9, cost: 0, filled: false } };
  /** 안개를 다시 쌓은 횟수(진단) */
  let fogStampN9 = 0;
  const visSrcRef = { current: new Float32Array(0) };
  const visBufRef = { current: null as Uint8Array | null };
  const lastSeenRef = { current: new Float32Array(0) };
  const lastTRef = { current: -1 };
  const lastViewRef = { current: -1 };
  /* 안개 이력(옛 fogSrc memo) — 시점(viewTeam·visAll)마다 한 번. */
  let fogCache: { key: string; v: { explored: Uint16Array; rebuildLastSeen: (out: Float32Array, tCap: number) => void } | null } | null = null;
  const fogSrcFor = (fogOn: boolean, visAll: boolean, viewTeam: number) => {
    const key = `${fogOn ? 1 : 0}|${visAll ? 1 : 0}|${viewTeam}`;
    if (fogCache && fogCache.key === key) return fogCache.v;
    const v = ((): { explored: Uint16Array; rebuildLastSeen: (out: Float32Array, tCap: number) => void } | null => {
      if (!fogOn) return null;
      const n9 = gw9 * gh9;
      /** 눈 하나 — (x, y, 시야, 보기 시작한 초, 그만 본 초). 유닛 표본은 앞뒤가 같다. */
      type Eye = (x: number, y: number, r: number, from: number, to: number) => void;
      /** 이 팀의 눈길을 차례로 흘린다. tCap 뒤의 눈은 아예 안 낸다(되짚기를 줄인다). */
      const scan = (eye: Eye, tCap: number): void => {
        for (const b9 of buildsSrc) {
          if (!visAll && teamOfRaw(b9[4]) !== viewTeam) continue;
          if (b9[0] > tCap) continue;
          const fp9 = FOOTPRINT[b9[3]] ?? [3, 2];
          const r9 = sightTiles(b9[3]);
          const gone9 = goneEffOf(b9);
          const lift9 = b9[6];
          /* 선 자리 — 뜬 때(있으면)까지, 없으면 걷힐 때까지 그 자리에서 본다. */
          const stop9 = lift9 !== undefined ? lift9 : (gone9 > 0 ? gone9 : Infinity);
          eye(b9[1] + fp9[0] / 2, b9[2] + fp9[1] / 2, r9, b9[0], stop9);
          /* 이사 비행 — 뜬 때부터 앉을 때까지 두 자리 사이를 그리는 쪽과 같은 곡선으로
             훑는다. 건물 줄은 착륙 자리마다 하나씩이라 이 구간이 빠지면 그 길이 통째로
             안 밝혀진다(테란은 커맨드를 띄워 옮기며 정찰한다). */
          if (lift9 === undefined || !(gone9 > lift9)) continue;
          const to9 = buildsSrc.find(([s2, x2, y2, u2, r2]) => r2 === b9[4] && u2 === b9[3]
            && s2 === gone9 && (x2 !== b9[1] || y2 !== b9[2]));
          if (!to9) continue;
          for (let s9 = lift9; s9 <= Math.min(gone9, tCap); s9 += 1) {
            const u9 = Math.min(1, (s9 - lift9) / Math.max(0.1, gone9 - lift9));
            const k9 = u9 * u9 * (3 - 2 * u9);
            eye(b9[1] + (to9[1] - b9[1]) * k9 + fp9[0] / 2,
              b9[2] + (to9[2] - b9[2]) * k9 + fp9[1] / 2, r9, s9, s9);
          }
        }
        /* 유닛 — 제 자취를 1.2초 간격으로 훑는다. **같은 칸이면 건너뛴다**: 무거워지는
           자리는 표본 수가 아니라 찍는 원의 넓이라(시야 8타일이면 원 하나가 200칸),
           서 있는 유닛은 첫 한 번이면 족하다. */
        for (const e9 of entWalks) {
          if ((!visAll && teamOfRaw(e9.raw) !== viewTeam) || e9.walk.n === 0) continue;
          const r9 = sightTiles(e9.unit || "Marine");
          const end9 = Math.min(e9.died ?? total, tCap);
          let lastK = -1;
          for (let s9 = e9.born; s9 <= end9; s9 += 1.2) {
            const q9 = posAtW(e9.walk, s9);
            if (!q9) continue;
            const k9 = Math.floor(q9.y) * gw9 + Math.floor(q9.x);
            if (k9 === lastK) continue;
            lastK = k9;
            eye(q9.x, q9.y, r9, s9, s9);
          }
        }
      };
      /** 원 하나를 찍는다 — 어느 쪽으로 고를지는 부르는 쪽이 정한다(처음/마지막). */
      const disc = (
        out: Uint16Array | Float32Array, cx: number, cy: number, r: number,
        val: number, keepMax: boolean,
      ): void => {
        const r2 = r * r;
        const x0 = Math.max(0, Math.floor(cx - r));
        const x1 = Math.min(gw9 - 1, Math.ceil(cx + r));
        const y0 = Math.max(0, Math.floor(cy - r));
        const y1 = Math.min(gh9 - 1, Math.ceil(cy + r));
        for (let y9 = y0; y9 <= y1; y9 += 1) {
          const dy9 = y9 + 0.5 - cy;
          const row9 = y9 * gw9;
          for (let x9 = x0; x9 <= x1; x9 += 1) {
            const dx9 = x9 + 0.5 - cx;
            if (dx9 * dx9 + dy9 * dy9 > r2) continue;
            const i9 = row9 + x9;
            if (keepMax ? out[i9] < val : out[i9] > val) out[i9] = val;
          }
        }
      };
      const explored = new Uint16Array(n9).fill(FOG_NEVER);
      scan((x9, y9, r9, from9) => {
        disc(explored, x9, y9, r9, Math.min(FOG_NEVER - 1, Math.max(0, Math.round(from9))), false);
      }, Infinity);
      /** 지금 시각까지의 **마지막으로 본 초**를 통째로 다시 쌓는다(정확판). */
      const rebuildLastSeen = (out: Float32Array, tCap: number): void => {
        out.fill(-1);
        scan((x9, y9, r9, from9, to9) => {
          if (from9 > tCap) return;
          disc(out, x9, y9, r9, Math.min(to9, tCap), true);
        }, tCap);
      };
      return { explored, rebuildLastSeen };
      // bldGoneEff까지 본다 — 핵으로 앞당겨진 걷힘이 밝힘 이력에도 실려야 한다.
    })();
    fogCache = { key, v };
    return v;
  };
  const reset = (): void => {
    fireStartRef.current.clear(); aimLockRef.current.clear(); burrowAtRef.current.clear(); gasLitRef.current.clear();
    engageHoldRef.current.clear(); hdgMemRef.current.clear(); dispHdgRef.current.clear();
    fogStampRef.current = { key: "", at: -1e9, ms: -1e9, cost: 0, filled: false }; lastTRef.current = -1;
  };
  const setView = (v: EngineView9): void => { view = v; };
  const build = (t: number): Frame9 => {
    const pitched = view.pitched;
    const pitchFlat = view.pitchFlat;
    const tilePx = view.tilePx;
    const mapW9 = view.mapW;
    const mapH9 = view.mapH;
    const viewTeam = view.viewTeam;
    const visAll = view.visAll;
    const fogOn = view.fogOn;
    const qAnim = view.qAnim;
    const qBuildFx = view.qBuildFx;
    const qDeath = view.qDeath;
    const clickFx = view.clickFx;
    const crowd9 = view.crowd ?? 0;
    const zoom = 6;   // 프레임은 배율과 무관 — 배율이 섞인 옛 식 한 곳(미사일 쌍 간격)에 중간값을 준다.
    const liteView = false; const liteYaw = false; const markerView = false; const tracerView = true;
    void liteView; void liteYaw; void markerView; void tracerView;
    const modeColor = (raw: string, team: 1 | 2 | undefined): string =>
      view.colors[raw] ?? (team === 2 ? TEAM_COLOR[2] : TEAM_COLOR[1]);
    const pitchGeom = (): PitchGeom9 => view.geom;
    const pitchK = (y: number): number => {
      if (!pitched) return 1;
      const { hPre, P, S, q } = pitchGeom();
      const v = (y / grid.height - 0.5) * hPre;
      return (q * P) / (P - v * S);
    };
    const posFrac = (x: number, y: number): [number, number] => {
      if (!pitched) return [x / grid.width, y / grid.height];
      const { w, h, hPre, P, S, C, q, cy } = pitchGeom();
      const u = (x / grid.width - 0.5) * w;
      const v = (y / grid.height - 0.5) * hPre;
      const k = (q * P) / (P - v * S);
      return [0.5 + (u * k) / w, 0.5 + (v * C * k - cy) / h];
    };
    const viewYawOf = (x: number, y: number): number => {
      if (!pitched) return 0;
      const { w, P } = pitchGeom();
      const u = (x / grid.width - 0.5) * w;
      void y;
      return (Math.atan2(u, P) * 180) / Math.PI;
    };
    const unitOps: UnitDrawOp[] = [];
    const miniExtra: MiniDot[] = [];
    const gasBusy = new Set<string>();
    const fxOps: FxOp[] = [];
    const dom: DomFx9[] = [];
    const cull9 = view.cull;
    /** 이 자리가 시야(여유 포함) 안인가 — 밖이면 op를 아예 안 만든다. 밖일 때는 **분수 자리도 함께** 돌려준다:
     *  부르는 쪽이 그 자리에 미니맵 점 하나를 남긴다(miniExtra). */
    const onScreen9 = (x9: number, y9: number): [boolean, number, number] => {
      if (!cull9) return [true, 0, 0];
      const [fx9, fy9] = posFrac(x9, y9);
      const in9 = fx9 >= cull9.x0 && fx9 <= cull9.x1 && fy9 >= cull9.y0 && fy9 <= cull9.y1;
      return [in9, fx9, fy9];
    };
    /** 그 열쇠의 사격 박자 위상(0~1) — 사거리에 든 순간이 0이다. */
    const firePhase = (key: string, cd: number): number => {
      const m9 = fireStartRef.current;
      const prev = m9.get(key);
      /* 이어지는 사격인가 — 앞 프레임에도 쏘고 있었고 시계가 앞으로만 갔으면 잇는다.
         0.6초는 그리기 주기(20Hz)와 배속(최대 8배)을 넉넉히 덮는 값이다. */
      const start = prev && t >= prev.at && t - prev.at <= 0.6 && t >= prev.start
        ? prev.start : t;
      m9.set(key, { start, at: t });
      return ((t - start) % cd) / cd;
    };
    /* ★ **한 마디 동안 겨눔을 못 박는다**(지적: "럴커랑 성큰 가시는 처음 나오는 위치로
       계속 나오는거고 타겟따라 이동하면 안됨") ────────────────────────────────────────
       럴커의 가시도 성큰의 가시도 **땅에서 솟는 것**이라, 한 번 솟기 시작한 자리는 그
       자리다. 그런데 겨눔(방향·거리)을 프레임마다 지금 표적 자리로 다시 재고 있어서,
       표적이 걸어가면 이미 솟아 있는 가시 줄이 통째로 그 뒤를 따라 스윽 돌아갔다 — 땅에
       박힌 뼈가 아니라 표적에 매달린 촉수로 읽힌다.
       그래서 **사격 한 마디**(위상 0→1) 동안은 처음 잰 값을 그대로 쓴다. 위상이 한 바퀴
       돌아 다시 0으로 떨어지는 순간에만 새로 잰다 — 다음 발은 새 자리를 겨눈다. */
    const lockAim = (key: string, ph: number, deg: number, len: number): { deg: number; len: number } => {
      const m9 = aimLockRef.current;
      const prev = m9.get(key);
      // 위상이 뒤로 떨어졌으면 새 마디다(되감기도 여기 걸려 자연히 다시 잰다).
      if (!prev || ph < prev.ph - 1e-6) {
        m9.set(key, { ph, deg, len });
        return { deg, len };
      }
      m9.set(key, { ph, deg: prev.deg, len: prev.len });
      return { deg: prev.deg, len: prev.len };
    };
    const headingOf = (walk: WalkView, pos: { x: number; y: number }, smoothKey?: string): number => {
      let target = 0;
      /* ★ **멈춘 유닛은 되짚기를 4Hz로만**(계측: 개체마커 3.4ms) ─────────────────────
         이 되짚기는 움직이는 유닛에서는 첫 창(0.3초)에 바로 끝나지만, **멈춘 유닛은 여섯
         창을 다 돌고서야** '안 움직였다'를 안다 — 기지의 노는 일꾼·수비 병력일수록 비싸다.
         자리가 지난 프레임과 똑같으면 그 사이에 움직인 것이 없다는 뜻이므로 목표각도
         그대로다. 다만 영영 안 되짚으면 안 된다 — 창(0.3~15초)이 흘러가며 목표각이
         바뀌는 설계라(마지막 움직임이 15초를 넘으면 기본각), 0.25초에 한 번은 제대로
         되짚어 그 흐름을 따라간다. 늦어야 한 창의 4분의 1이라 눈에 안 든다. */
      const mem0 = smoothKey ? hdgMemRef.current.get(smoothKey) : undefined;
      const still9 = mem0 !== undefined && mem0.px === pos.x && mem0.py === pos.y
        && t >= mem0.t && t - mem0.lb < 0.25;
      let lb9 = t;
      if (still9 && mem0) {
        target = mem0.tg;
        lb9 = mem0.lb;
      } else {
        for (const back of [0.3, 0.8, 2, 4, 8, 15]) {
          const hp = posAtW(walk, Math.max(0, t - back));
          if (!hp) break;
          const dx = pos.x - hp.x;
          const dy = pos.y - hp.y;
          if (Math.hypot(dx, dy) > 0.08) { target = (Math.atan2(-dx, dy) * 180) / Math.PI; break; }
        }
      }
      if (!smoothKey) return target;
      /* 회전을 부드럽게(지적: 움직임·회전 좀 부드럽게) — 경유점을 꺾는 순간 방향이 즉시
         홱 돌던 것을, 마커별로 지난 프레임의 각을 기억해 초당 300도 상한으로 따라잡게
         한다. 시킹(시간이 뒤로 가거나 크게 점프)이나 첫 등장은 그대로 스냅. */
      const mem = mem0;
      hdgMemRef.current.set(smoothKey, { h: target, t, tg: target, px: pos.x, py: pos.y, lb: lb9 });
      if (!mem || t <= mem.t || t - mem.t > 1.5) return target;
      let diff = ((target - mem.h) % 360 + 540) % 360 - 180;
      const maxTurn = 300 * (t - mem.t);
      if (Math.abs(diff) > maxTurn) diff = Math.sign(diff) * maxTurn;
      const h = mem.h + diff;
      hdgMemRef.current.set(smoothKey, { h, t, tg: target, px: pos.x, py: pos.y, lb: lb9 });
      return h;
    };
    const headingOfDisplay = (
      key: string, x: number, y: number, fallback: number, stillFace?: number | null,
    ): number => {
      const mem = dispHdgRef.current.get(key);
      if (!mem || t <= mem.t || t - mem.t > 1.5) {
        const h0 = stillFace ?? mem?.h ?? fallback;
        dispHdgRef.current.set(key, { x, y, h: h0, t });
        return h0;
      }
      const dx = x - mem.x;
      const dy = y - mem.y;
      /* 문턱 인하(지적: 방향 전환이 재렌더링 안 될 때가 있음) — 위치 스무딩(EMA)이 프레임당
         변위를 눌러 0.04 문턱을 못 넘기면 방향이 옛값에 얼어붙었다. 스무딩이 떨림을 이미
         걸러 주므로 문턱은 훨씬 낮아도 된다. */
      if (Math.hypot(dx, dy) < 0.008) {
        // 멈춰 있을 때만 표적 쪽으로 몸을 돌린다.
        const hs = stillFace ?? mem.h;
        dispHdgRef.current.set(key, { x, y, h: hs, t });
        return hs;
      }
      const target = (Math.atan2(-dx, dy) * 180) / Math.PI;
      let diff = ((target - mem.h) % 360 + 540) % 360 - 180;
      /* 회전 상한을 크게(요청: 옆으로 걷는 순간이 없어야) — 420도/초는 급회전 때 몇
         프레임 동안 몸과 걸음이 어긋났다. 1200도/초면 한 프레임 안에 따라붙는다. */
      const maxTurn = 1200 * (t - mem.t);
      if (Math.abs(diff) > maxTurn) {
        // 큰 반전은 즉시 돈다 — 문턱도 120 → 60도로 내려 되돌아설 때 등지고 걷지 않는다.
        if (Math.abs(diff) > 60) {
          dispHdgRef.current.set(key, { x, y, h: target, t });
          return target;
        }
        diff = Math.sign(diff) * maxTurn;
      }
      const h = mem.h + diff;
      dispHdgRef.current.set(key, { x, y, h, t });
      return h;
    };
    const resStageAt = (rx: number, ry: number): number => {
      if (resStageSeries.size === 0) return 4;
      const gx9 = Math.round(rx * 2);
      const gy9 = Math.round(ry * 2);
      let arr9: [number, number][] | undefined;
      for (let dx9 = -1; dx9 <= 1 && !arr9; dx9 += 1) {
        for (let dy9 = -1; dy9 <= 1 && !arr9; dy9 += 1) {
          arr9 = resStageSeries.get(`${gx9 + dx9}|${gy9 + dy9}`);
        }
      }
      if (!arr9) return 4;
      let lv9 = 4;
      for (const [s9, v9] of arr9) { if (s9 > t) break; lv9 = v9; }
      return lv9;
    };
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
    const engageFoes: FoeRow[] = [];
    /** **모든** 다 지어진 건물 — 방어 건물의 표적 고르기만 여기까지 본다(요청: "건물대
     *  건물도 되는지 확인").
     *
     *  왜 따로 두나: engageFoes에는 방어 건물 다섯만 든다. 유닛이 지나가다 서플라이·
     *  파일런을 보고 멈춰 서서 쏘면 안 되기 때문이다(그건 원작의 자동 획득 규칙이 아니다 —
     *  유닛은 명시적으로 찍은 건물만 친다). 그런데 **방어 건물은 다르다**: 사거리 안에
     *  들어온 것은 무엇이든 친다. 그래서 캐논이 적 게이트를 부수고 있어도 화면은 조용했다.
     *  두 목록을 갈라 두면 유닛 쪽 규칙은 그대로 두고 방어 건물만 넓힐 수 있다. */
    const bldFoes: FoeRow[] = [];
    /** 아비터 은신장(전수조사) — 같은 사람 유닛이 곁(4.5타일)에 있으면 흐려진다. */
    const arbiterSpots: { raw: string; x: number; y: number }[] = [];
    /** 디텍터 명단 — 적 디텍터가 곁(9타일)이면 은신이 벗겨진다. */
    const detectorSpots: { team: number; x: number; y: number }[] = [];
    /** 지금 무언가의 **안에 든** 개체들 — 자취의 상태가 곧 그 표다(ST_INSIDE).
     *  벙커 사수와 수송선 승객이 여기 든다(요청: "벙커안에서 공격시 트레이서 안나옴"). */
    /* ★ 승무원은 **제 표적을 갖고 들어간다**(지적: "벙커도 조심") — 벙커는 제가 안 쏘고
       안에 든 마린이 쏜다. 그래서 벙커 자신의 order_target은 대개 비어 있고, 참값으로
       '무엇을 쏘나'를 물어야 할 곳은 승무원 쪽이다. 여기 자리와 함께 그 흐름을 담아 두면
       벙커 그리기가 다시 개체를 훑지 않아도 된다. */
    const insideSpots: {
      raw: string; unit: string; x: number; y: number; tgt?: Ticks;
    }[] = [];
    /** 지금 서 있는 **일꾼들**(임자·자리) — 테란 공사 불티가 '진짜 짓는 일꾼' 곁에서
     *  튀게 하는 재료다(지적: "테란 건설시 스파크랑 일꾼 위치 안맞음"). 아래 개체 고리가
     *  어차피 전부 훑으므로 여기서 함께 담는다 — 건물마다 개체를 다시 훑으면 난전에서
     *  건물 수 × 개체 수가 된다. */
    const workerSpots: { raw: string; x: number; y: number }[] = [];
    /* v2 개체의 지금 위치(태그별) — 참값 표적(order_target)이 가리키는 그 몸을 찾는 지도. */
    const entPosByTag = new Map<number, FoeRow>();
    /** ★ **나를 겨누는 쪽**(표적 태그 → 그 표적을 겨눈 몸) — 참값 표적을 뒤집은 색인이다.
     *
     *  '누가 때렸나'는 여태 어림이었다: 맞은 순간 **가장 가까운 적**을 범인으로 삼았고,
     *  그래서 지나가던 유닛이 범인이 되기도 했다(그 자리 주석이 "원거리는 어림"이라 적어
     *  두었다). 이제 참값이 "누가 무엇을 겨누나"를 말하므로, 그것을 뒤집으면 "누가 나를
     *  겨누나"가 **그대로** 나온다 — 추정이 아니다.
     *  여럿이 한 몸을 겨누면 먼저 담긴 하나를 쓴다(피격 그림은 한 겹이라 하나면 된다). */
    const foeByTarget = new Map<number, FoeRow>();
    /** 은신 판정을 뒤로 미루려고 잡아 두는 짝 — 아비터·디텍터 명단이 다 찬 뒤에 매긴다. */
    const pPrep9 = PERF9 ? pNow() : 0;
    const foeEnts: { row: FoeRow; e: (typeof entWalks)[number]; q: TrackPos;
      sim: ReturnType<typeof posAtSim> | null; kc: EntConst9 }[] = [];
    {
      /* 교전 상대 목록은 개체 위치로 채운다(지적: 유닛-건물 상호작용·어택땅 교전) —
         적의 방어 건물(성큰·캐논·터렛·벙커)도 상대다: 행군하던 유닛이 그 곁에서 멈춰
         싸우고, 터렛·벙커 발사도 이 목록으로 겨눈다. */
      const pS9_개체고리 = PERF9 ? pNow() : 0;
      for (const e of entWalks) {
        if (e.walk.n === 0 || t < e.born) continue;
        if (e.died !== null && t >= e.died) continue;
        /* 유령 상대 제거(지적: 주변에 공격할 게 없는데 공격 모션) — 화면 규칙으로 이미
           죽었거나(체력 0 조기 사망) 숨은(수송 탑승·건설 흡수) 개체가 목록에 남아, 곁
           유닛이 빈 땅에 대고 계속 쐈다. 표시와 같은 잣대로 거른다. */
        // 죽음의 주인은 하나다(과제 #69) — 체력 0은 이제 d에서만 나온다.
        const dieAt0 = e.died;
        if (dieAt0 !== null && t >= dieAt0) continue;
        /* ★ (걷어냄) 탑승 구간이면 통째로 건너뛰던 줄 — **벙커를 벙어리로 만든다.**
           이 목록이 빈손이던 시절(rides가 늘 []이었다)에는 아무 일도 안 하던 줄인데,
           이제 참값의 ST_INSIDE에서 구간을 만들면서 실제로 걸리기 시작한다. 그런데 벙커
           사수도 '안에 든 몸'이라, 여기서 걸러 버리면 아래 insideSpots에 못 닿아 벙커가
           쏠 사수를 영영 못 찾는다(그 자리 주석: "이 명단이 곧 벙커 사수다").
           안에 든 몸을 표적에서 빼는 일은 아래 ST_INSIDE 갈래가 이미 **제대로** 한다 —
           빼면서 사수 명단에 옮겨 담는다. 같은 일을 하는 문이 둘일 까닭이 없다. */
        /* ★ **건설에 흡수된 개체**도 뺀다(지적: "유닛이 없는 자리에 피격효과와 사망효과가
           계속 나와") — 위 주석이 "숨은(수송 탑승·건설 흡수) 개체"라고 적어 놓고 정작
           `buildHides`(공사 중 구간)만 걸렀다. 그런데 화면이 일꾼을 지우는 문은 둘이고
           (렌더의 buildHideAt·buildHides), 그중 **buildHideAt은 되돌아오지 않는다** —
           현장에 도착한 순간부터 영영 안 그린다. 그 한 줄이 빠져 있어, 공사 자리에는
           화면에 없는 일꾼이 표적 목록에 계속 남았다.
           그 대가는 '조준 한 번'으로 끝나지 않는다: 곁의 적이 그 빈 자리를 상대로 잡고
           **쿨다운마다** 트레이서를 쏘고, 커세어 같은 무기는 impact 그림을 **표적 자리에
           직접** 그린다(아래 NO_BEAM_FX). 그래서 아무것도 없는 공사터에서 피격 효과가
           끝없이 텄다. 화면과 같은 잣대로 거른다 — 이 블록이 처음부터 하려던 일이다. */
        if (e.buildHideAt !== null && t >= e.buildHideAt) continue;
        /* `.some(클로저)`를 손고리로 — 개체마다 클로저를 하나씩 새로 만들던 자리다
           (프레임당 964개). 하는 일은 같다. */
        let hid9 = false;
        for (let bh9 = 0; bh9 < e.buildHides.length; bh9 += 1) {
          const bb9 = e.buildHides[bh9];
          if (t >= bb9[0] && t < bb9[1]) { hid9 = true; break; }
        }
        if (hid9) continue;
        const q = posAtW(e.walk, t, curOf9(WALK_CUR_A9, e.walk));
        if (!q) continue;
        /* 안에 든 몸은 표적이 아니다 — 태운 것(벙커·수송선)이 표적이다. 화면은 이미
           같은 자로 이 몸을 안 그리는데(아래 렌더의 ST_INSIDE), 표적 지도에는 남아 있어
           적이 빈 벙커 자리에 대고 계속 쐈다. 같은 자리에서 갈라 놓는다.
           이 명단이 곧 벙커 사수다(요청 19) — 여태 승무원 색인이 '늘 빈 목록'이라
           벙커는 아무것도 안 쏘거나 '마린 한 기 추정'에만 기댔다. */
        /* ★ 참값 자취 상태는 **여기서 한 번만** 읽는다 — 아래 은신·버로우 고리가 같은
           `simTracks.get` + `posAtSim`을 개체마다 또 불렀다(같은 값을 두 번 셈). 뽑아
           두었다가 넘긴다. */
        const trIn9 = simTracks?.get(e.tag);
        const sIn9 = trIn9 ? posAtSim(trIn9, t, curOf9(TRUTH_CUR9, trIn9)) : null;
        if (sIn9 && sIn9.state === ST_INSIDE) {
          insideSpots.push({ raw: e.raw, unit: e.unit, x: q.x, y: q.y,
            ...(e.tgt ? { tgt: e.tgt } : {}) });
          continue;
        }
        /* ★ **못 겨누는 개체는 표적이 아니다**(지적: "포톤캐논이 떨어지는 핵에 포를 날리고
           잇음") — 원작의 핵탄두(Nuclear Missile)는 하늘에서 내려오는 **무적·비표적** 개체다.
           그런데 참값 자취에는 다른 유닛과 똑같이 제 태그와 자리로 실려 있어, 표적 지도에
           올라가는 순간 사거리 안의 방어 건물이 전부 그쪽을 겨눴다. 스캐너 스윕·다크 스웜
           같은 시전 자국도 같은 사정이다(개체로 실리되 맞을 수 없다).
           표적 지도에 아예 안 올린다 — 여기서 한 번 거르면 자동 획득·조준각·트레이서·
           방어 건물까지 이 값을 보는 모든 자리가 한꺼번에 옳아진다. */
        const kc9 = constOf9(e);
        if (kc9.noBody) continue;
        /* ★ 표적 자리는 **몸이 그려지는 자리**여야 한다(지적: "디바우러 산성포자 적에게
           붙은 게 안 움직여서 어색") — 그리기는 참값(simNow)이 있으면 그 자리로 몸을
           옮기는데(아래 렌더의 `if (simNow) pos = …`), 표적 지도는 명령 자취(q)만 보고
           있었다. 둘이 갈리는 동안(밀려 움직임·자취 없는 이동) 포자·트레이서가 몸이
           떠난 자리를 겨눴다. 참값이 있으면 참값 자리를 싣는다. */
        const row: FoeRow = {
          team: teamOfRaw(e.raw) ?? 0,
          x: sIn9 ? sIn9.x : q.x, y: sIn9 ? sIn9.y : q.y,
          air: kc9.air,
          uk: kc9.uk,
        };
        engageFoes.push(row);
        foeEnts.push({ row, e, q, sim: sIn9, kc: kc9 });
        if (e.tag > 0) entPosByTag.set(e.tag, row);
        /* 이 몸이 지금 겨눈 태그를 뒤집어 담는다 — 흐름은 바뀔 때만 한 줄이라 훑기가 짧다. */
        if (e.tgt) {
          const tv9 = tkLast(e.tgt, t);
          if (tv9 && !foeByTarget.has(tv9)) foeByTarget.set(tv9, row);
        }
        // 아비터 은신장·디텍터(전수조사) — 이번 프레임 위치를 명단에 올린다.
        if (e.unit === "SCV" || e.unit === "Probe" || e.unit === "Drone") {
          workerSpots.push({ raw: e.raw, x: q.x, y: q.y });
        }
        if (e.unit === "Arbiter") arbiterSpots.push({ raw: e.raw, x: q.x, y: q.y });
        if (DETECTOR_UNITS.has(e.unit)) detectorSpots.push({ team: row.team, x: q.x, y: q.y });
      }
      if (PERF9) pAdd("개체고리", pNow() - pS9_개체고리);
      const pS9_건물고리A = PERF9 ? pNow() : 0;
      for (let bi = 0; bi < buildsSrc.length; bi += 1) {
        const [bs, bx2, by2, bu, br, bg] = buildsSrc[bi];
        /* 다 지어졌고 아직 안 걷힌 건물은 **전부** 방어 건물의 표적 후보다(위 bldFoes
           주석) — 방어 건물 다섯은 아래에서 engageFoes에도 따로 들어간다. */
        if (t >= (buildsSrc[bi][7] ?? bs + (BUILD_SEC[bu] ?? 30))
          && !((bg ?? 0) > 0 && t >= (bg ?? 0))) {
          bldFoes.push({
            team: teamOfRaw(br) ?? 0,
            x: bx2 + footDx(bu), y: by2 + footDy(bu), air: false, bld: true, k: bu,
          });
        }
        if (!["Sunken Colony", "Spore Colony", "Photon Cannon", "Missile Turret", "Bunker"].includes(bu)) continue;
        /* 다 지어져야 쏜다 — 테란 벙커·터렛은 공사가 멈춰 선 동안 완성이 미뤄진다
           (bldWork, 테란 건설 중단). 나머지는 종전대로 착공 + 표의 건설 시간. */
        if (t < (buildsSrc[bi][7] ?? bs + (BUILD_SEC[bu] ?? 30))) continue;
        // 걷히는 시각은 공용 문을 지난다(위 goneEffOf) — 핵으로 앞당겨진 줄까지 함께 본다.
        if (goneEffOf(buildsSrc[bi]) > 0 && t >= goneEffOf(buildsSrc[bi])) continue;
        // 방어 건물도 bld·종류를 실어 발자국 기준 정지·창 규칙을 태운다(기획서 1-D).
        engageFoes.push({
          team: teamOfRaw(br) ?? 0,
          x: bx2 + footDx(bu), y: by2 + footDy(bu), air: false, bld: true, k: bu,
        });
        // 방어 디텍터(전수조사) — 터렛·스포어·캐논은 은신을 벗긴다.
        if (bu === "Missile Turret" || bu === "Spore Colony" || bu === "Photon Cannon") {
          detectorSpots.push({ team: teamOfRaw(br) ?? 0, x: bx2 + footDx(bu), y: by2 + footDy(bu) });
        }
      }
      if (PERF9) pAdd("건물고리A", pNow() - pS9_건물고리A);
      /* 띄운 건물은 공중 유닛이다(요청) — 이륙한 순간부터 지상 무기가 못 닿고 대공이 친다.
         여태 건물은 예외 없이 air:false라, 떠 있는 커맨드 센터를 질럿이 겨누고 정작
         스포어·미사일 터렛은 못 겨눴다. 자리도 마지막 착륙 지점이 아니라 지금 나는 자리다. */
      const pS9_건물고리B = PERF9 ? pNow() : 0;
      for (const brow of buildsSrc) {
        const [, bx3, by3, bu2, br2, , bl2] = brow;
        if (bl2 === undefined || t < bl2) continue;
        const gone3 = goneEffOf(brow);
        if (gone3 > 0 && t >= gone3) continue;
        /* ★ **나는 동안의 자리는 두 자리 사이**다(지적: "테란 비행 건물에 트레이서가 안
           나가는 이유 좀 찾아봐. 거리도 충분히 떨어져 있어") ────────────────────────────
           여기 있던 것은 **떠난 자리**(줄의 좌표)였다. 그런데 그리는 쪽은 이사 비행을
           실제로 잇는다 — 떠난 자리에서 앉을 자리까지 [뜬 때, 앉은 때] 구간을 smoothstep으로
           지난다(그 자리 주석: "떠난 줄이 실제 구간 동안 두 자리 사이를 잇고"). 그래서 몸은
           화면을 가로질러 가는데 표적은 출발점에 못 박혀 있었다: 사수가 **보이는 몸** 곁에
           서 있어도 잰 거리는 출발점까지라, 사거리 밖으로 떨어져 조준각이 null이 되고
           트레이서가 통째로 사라졌다. 몸과 겨눠지는 자리가 갈리면 총알은 늘 빈 땅으로 간다.
           그리는 쪽과 **같은 식**을 쓴다(위 flyTo 주석의 그 셈). */
        let fx3 = bx3;
        let fy3 = by3;
        if (gone3 > bl2) {
          const to3 = buildsSrc.find(([s4, x4, y4, u4, r4]) => r4 === br2 && u4 === bu2
            && s4 === gone3 && (x4 !== bx3 || y4 !== by3));
          if (to3) {
            const u3 = Math.min(1, Math.max(0, (t - bl2) / Math.max(0.1, gone3 - bl2)));
            const k3 = u3 * u3 * (3 - 2 * u3);
            fx3 = bx3 + (to3[1] - bx3) * k3;
            fy3 = by3 + (to3[2] - by3) * k3;
          }
        }
        engageFoes.push({
          team: teamOfRaw(br2) ?? 0,
          x: fx3 + footDx(bu2), y: fy3 + footDy(bu2),
          air: true, bld: true, k: bu2, lifted: true,
        });
      }
      if (PERF9) pAdd("건물고리B", pNow() - pS9_건물고리B);
      /* 일반 건물도 표적 지도에(지적: 질럿이 해처리에 안 붙음) — engageFoes(교전 유발)엔
         안 넣는다: 건물이 보인다고 싸움이 시작되면 안 되고, 어택이 그 태그를 찍었을 때만
         겨눔·접근의 표적이 된다. 유닛 태그와 겹치면 유닛이 우선(위에서 이미 set). */
      for (const bt of bldTagSpots.rows) {
        if (t < bt.born + 2 || (bt.gone > 0 && t >= bt.gone)) continue;
        /* ★ **그 순간에 떠 있나**를 이·착륙 자취로 가린다(재재지적: "공중 건물에 골리앗
           대공이 아닌 대지 트레이서가 아직도 나가") ────────────────────────────────────
           여기 있던 셈은 `bt.lift`, 곧 **마지막 자리 뒤의 이륙 하나**였다. 그 값은 '지금
           떠 있나'를 못 말한다: 건물이 100초에 떴다가 200초에 다른 자리에 내려앉으면
           마지막 자리는 200초이고 100초 이륙은 그 앞이라 걸러진다 — 곧 **떠서 날고 있던
           100~200초 동안 이 명단은 "한 번도 안 떴다"고 답했다.** 사람이 화면에서 뜬 건물을
           보는 시간이 대개 그 구간이라(뜬 건물은 결국 내려앉는다) 늘 지상 무기가 나갔다.
           그리는 쪽(buildsV2)은 자리 **구간마다** 이륙을 찾아 옳게 그리고 있었는데, 표적
           명단만 마지막 구간을 봤다 — 화면과 판정이 갈린 자리가 이것이다.
           이제 이·착륙 시각을 다 들고 와서, 지금(t) 이전의 **가장 마지막 사건**이 이륙이면
           떠 있는 것으로 본다. 착륙(자리 잡음)이 더 나중이면 앉은 것이다. */
        const afloat9 = ((): boolean => {
          let last9 = -Infinity;
          let air9 = false;
          for (const s9 of bt.siteTs) if (s9 <= t && s9 >= last9) { last9 = s9; air9 = false; }
          for (const l9 of bt.lifts) if (l9 <= t && l9 >= last9) { last9 = l9; air9 = true; }
          return air9;
        })();
        /* ★ 이미 **유닛 줄로** 올라온 태그면 그 줄에 '떴다'만 얹는다(재지적: "골리앗 뜬
           건물 상대로 여전히 지상용 트레이서 나감") ─────────────────────────────────────
           테란 건물은 원작에서도 유닛이라, 참값 자취(ents)에 제 태그로 실려 온다. 그래서
           여기 오기 전에 위 유닛 고리가 이미 그 태그를 `air: kc9.air`(건물 상수 = 지상)로
           명단에 넣어 두었고, 이 고리는 `entPosByTag.has(bt.tag)`에 걸려 **통째로 건너뛰었다**
           — 곧 '떴다'는 사실을 아는 유일한 줄(bt.lift)이 명단에 한 번도 안 실렸다. 앞선
           손질에서 읽는 쪽(foe.air)을 고쳤는데도 안 고쳐진 까닭이 이것이다: 읽을 값 자체가
           없었다.
           건너뛰지 말고 **덮어 쓴다**. 자리·편·종류는 유닛 줄의 것이 더 정확하므로 그대로
           두고, 뜬 사실만 두 칸에 얹는다. 이 줄은 engageFoes와 같은 객체라 교전 판정도
           한꺼번에 옳아진다(대공 무기가 없는 쪽은 뜬 건물에 안 붙는다). */
        const had9 = entPosByTag.get(bt.tag);
        if (had9) {
          if (afloat9 && !had9.air) {
            had9.air = true;
            had9.lifted = true;
          }
          continue;
        }
        entPosByTag.set(bt.tag, {
          x: bt.x, y: bt.y,
          team: teamOfRaw(bt.raw) ?? 0, air: afloat9, bld: true, k: bt.k,
          ...(afloat9 ? { lifted: true } : {}),
        });
      }
      // 스캐너 스윕(전수조사) — 12초 동안 그 자리가 디텍터다.
      for (const [cs6, cx10, cy10, tech6, craw6] of castsSrc) {
        if (tech6 !== "Scanner Sweep" || t < cs6 || t - cs6 > SCAN_DETECT_SEC) continue;
        detectorSpots.push({ team: teamOfRaw(craw6) ?? 0, x: cx10, y: cy10 });
      }
      /* 안 보이는 것은 표적이 아니다(요청: 클로킹·아비터 은신장·버로우한 러커를 그냥
         공격하는 일이 없게) — 개인 클록(f=14/15)·상시 은신(다크·옵저버)·아비터 은신장
         ·버로우한 러커에 '은신' 딱지를 붙인다. 아래 nearestFoe와 어택 표적 고르기가
         디텍터 없는 편에게서 이들을 감춘다. 아비터·디텍터 명단이 다 찬 뒤라야 옳게
         매겨지므로 목록을 다 채우고 여기서 한 번에 훑는다(표시 투명도와 같은 잣대). */
      const pS9_상태고리 = PERF9 ? pNow() : 0;
      for (const { row, e, q, sim: sim9, kc: kc9 } of foeEnts) {
        /* 클로저 셋을 손고리로 — 개체마다 `cloaks.some`·`arbiterSpots.some`·`statuses.some`
           을 새로 만들었다(프레임당 셋 × 964). 하는 일은 같다. 아비터가 없는 판이 태반이라
           그쪽은 길이 검사로 통째로 건너뛴다. */
        let cloaked9 = kc9.alwaysCloak;
        if (!cloaked9) {
          for (let ci9 = 0; ci9 < e.cloaks.length; ci9 += 1) {
            const cc9 = e.cloaks[ci9];
            if (t >= cc9[0] && t < cc9[1]) { cloaked9 = true; break; }
          }
        }
        if (!cloaked9 && arbiterSpots.length > 0 && e.unit !== "Arbiter") {
          for (let ai9 = 0; ai9 < arbiterSpots.length; ai9 += 1) {
            const asp = arbiterSpots[ai9];
            if (asp.raw === e.raw && Math.hypot(asp.x - q.x, asp.y - q.y) <= 4.5) {
              cloaked9 = true; break;
            }
          }
        }
        /* 버로우(요청) — 화면의 버로우 판정과 같은 자, 곧 **참값 자취의 상태**다
           (여태는 커맨드 증거 f=18/19였다). */
        // 참값 상태는 위 고리가 이미 읽어 넘겼다(sim9) — 같은 값을 또 안 뽑는다.
        const burrowed9 = kc9.burrowable && sim9?.state === ST_BURROW;
        if (cloaked9 || burrowed9) row.hidden = true;
        /* 스태시스 — 갇힌 동안은 표적 명단에서 통째로 빠진다(위 FoeRow.frozen 주석).
           상태 구간은 화면의 우리(cage)를 그리는 그 값과 **같은 것**이라, 우리가 씌워진
           동안 정확히 못 친다. */
        for (let si9 = 0; si9 < e.statuses.length; si9 += 1) {
          const st9 = e.statuses[si9];
          if (st9[2] === "stasis" && t >= st9[0] && t < st9[1]) { row.frozen = true; break; }
        }
        /* 마지막으로 체력이 떨어진 때 — 뒤에서부터 훑다 지금보다 이른 첫 마디에서 멈춘다.
           체력 키는 **맞았을 때만** 생기므로(덤퍼가 잔물결을 안 적는다) 길지 않다. */
        /* ★ **이분 탐색**이다(지적: "방어 건물 타겟 로직 후 엄청 느려졌어") — 앞판은 배열
           끝에서 뒤로 훑으며 '지금보다 이른 첫 마디'를 찾았다. 끝에서 시작하니 **아직 오지
           않은 키를 전부 지나야** 그 자리에 닿는다: 경기 중반이면 한 개체당 제 체력 키의
           절반 남짓을, 살아 있는 개체 수만큼, 프레임마다 훑는 셈이다(43분 판이면 수만 번).
           체력 키는 시간순이라 이분으로 한 번에 간다 — 로그로 떨어진다. */
        const hp9 = e.hp;
        if (hp9 && tkN(hp9) > 0) {
          const at9 = tkAt(hp9, t);
          if (at9 >= 1 && tkV(hp9, at9) < tkV(hp9, at9 - 1)) row.hurt = tkT(hp9, at9);
          /* 지금 값도 같은 마디에서 낸다 — 아직 마디가 없으면(at9 < 0) 손 탄 적이 없는
             몸이라 만피다. 그때는 칸을 안 채운다(읽는 쪽이 '없음 = 만피'로 읽는다). */
          if (at9 >= 0) row.hp = tkV(hp9, at9);
        }
      }
      if (PERF9) pAdd("상태고리", pNow() - pS9_상태고리);
    }
    const reachTo = (
      attacker: string, foe: { air: boolean; k?: string; uk?: string }, fallback: number,
    ): number => {
      const tgt = foe.k ?? foe.uk;
      if (!tgt || !isKnownKind(attacker) || !isKnownKind(tgt)) return fallback;
      const r9 = reachTiles(attacker, tgt, foe.air);
      return r9 < 0 ? fallback : r9;
    };
    const fogSrc = fogSrcFor(fogOn, visAll, viewTeam);
    const exploredAt = fogSrc?.explored ?? null;
    const FOG_BUDGET = 0.15;
    /** 쉬는 간격의 아래·위 한계(ms) — 첫 판이나 튈 때를 위한 안전대. */
    const FOG_MIN_MS = 60;
    const FOG_MAX_MS = 400;
    /** 경기 시간이 이만큼 튀면(되감기·건너뛰기) 즉시 다시 쌓는다(초). */
    const FOG_JUMP_SEC = 2;
    const pFogVis9 = PERF9 ? pNow() : 0;
    const visNow = ((): Uint8Array | null => {
      if (!fogOn) return null;
      const n9 = gw9 * gh9;
      let buf = visBufRef.current;
      if (!buf || buf.length !== n9) { buf = new Uint8Array(n9); visBufRef.current = buf; }
      /* ★ **매 프레임 다시 쌓지 않는다**(계측: 안개·시야 14.40ms — 우리 자바스크립트에서
         가장 큰 덩어리다) ──────────────────────────────────────────────────────────
         위 최적화(제곱으로 자르고 채우기)로 칸당 비용은 이미 줄였지만, **눈의 수**는 그대로다
         — 유닛 672기 + 건물 338기면 프레임마다 원 천 개를 찍는다.
         그런데 안개는 **천천히 변하는 그림**이다. 유닛이 초당 몇 타일을 걷든 시야 원은 그만큼만
         움직이고, 화면에서 그 경계는 부드럽게 흐려져 있어 한두 프레임 묵은 값과 구별되지 않는다.
         그래서 **실제 시각**이 `FOG_STEP_MS`만큼 흐를 때만 다시 쌓고, 그 사이는
         **지난 판을 그대로 쓴다**. 되감기·건너뛰기처럼 시간이 튀면 즉시 다시 쌓는다(부호 무관
         절대값으로 본다). 배율·시야 주인이 바뀌어도 마찬가지다. */
      /* ★ 조르는 자는 **제 삯에 비례하는 실제 시각**이다 ──────────────────────────
         두 번 틀린 자리라 사정을 다 적어 둔다.

         ① 처음에는 **경기 시간**(0.14초)으로 쟀다. 한 프레임에 흐르는 경기 시간은
            `프레임주기 × 배속`이다. 27ms 프레임에 ×2면 0.054초라 서너 프레임에 한 번만
            쌓지만, 115ms 프레임에 ×2면 0.23초 — 문턱을 매 프레임 넘는다. 곧 느려질수록
            더 자주 쌓고 그래서 더 느려진다. 조르기가 가장 필요한 순간에 정확히 풀린다.
         ② 그래서 실제 시각 100ms로 바꿨는데 **그대로였다**(계측: 안개 22.93ms). 당연하다 —
            프레임주기가 116ms인데 문턱이 100ms면 역시 매 프레임 넘는다. 고정 문턱은
            '프레임이 그보다 느려지는' 바로 그 경우를 못 막는다. 자리만 옮긴 같은 실수다.

         고정 문턱으로는 안 된다. 삯 자체를 자로 삼는다: **한 번 쌓는 데 든 시간의
         1/0.15배만큼 쉰다.** 그러면 안개가 가져가는 몫이 무슨 일이 있어도 15%를 못 넘는다
         — 23ms가 들었으면 153ms를 쉬고, 3ms면 20ms만 쉰다. 기기가 느리든 배속이 높든
         스스로 제자리를 찾는다(위·아래 한계는 첫 판과 튐을 위한 안전대일 뿐이다).
         경기 시간은 이제 '튐'만 본다 — 되감기·건너뛰기(2초 넘는 도약)에서 즉시 다시 쌓는다.
         배속이 높아 그림이 조금 묵는 것은 괜찮다: 시야 경계는 흐릿하게 그려져 한두 프레임
         묵은 값과 구별되지 않는다(위 주석). */
      const fs9 = fogStampRef.current;
      const key9 = `${viewTeam}|${visAll ? 1 : 0}|${n9}`;
      const now9 = pNow();
      const wait9 = Math.min(FOG_MAX_MS, Math.max(FOG_MIN_MS, fs9.cost / FOG_BUDGET));
      /* ★ 워커는 프레임을 **앞으로 몰아** 짓는다(벽시계 1초에 경기 몇 초치) — 벽시계 자만 쓰면 한 장 짓는 데 wait9를
         넘는 느린 기기에서 **매 장** 다시 쌓는다(폰: 짓기 191ms의 큰 몫). 그래서 벽시계와 **경기 시각** 둘 다 wait9만큼
         지나야 다시 쌓는다(경기 시각은 ms를 1배속의 초로 읽는다). 튐(2초 넘는 도약)은 여전히 즉시. */
      if (fs9.filled && fs9.key === key9
        && (now9 - fs9.ms < wait9 || Math.abs(t - fs9.at) < wait9 / 1000)
        && Math.abs(t - fs9.at) < FOG_JUMP_SEC) {
        return buf;
      }
      fs9.key = key9; fs9.at = t; fs9.ms = now9; fs9.filled = true;
      fogStampN9 += 1;
      buf.fill(0);
      /* ★ 이 함수가 이 화면의 **최대 비용**이었다(계측: 자기 시간 7.7%, 1위 — 2배·4배
         모두에서 그랬다) ────────────────────────────────────────────────────────────
         눈 하나마다 (2r+2)² 칸을 돌며 칸마다 제곱근을 뽑는다. 시야 9타일이면 400칸이고,
         눈이 600개면 프레임마다 24만 번이다. 배율과 무관한 붙박이 삯이라 어느 칸에서나
         똑같이 얹힌다.
         값을 한 톨도 안 바꾸면서 일을 줄이는 길이 셋 있다 — 모두 **같은 결과**를 낸다:
           ① 밖은 제곱으로 자른다 — e9 ≤ 0 ⟺ d² ≥ (r+0.5)². 제곱근이 필요 없다.
           ② 안은 제곱으로 채운다 — e9 ≥ 1 ⟺ d² ≤ (r−0.5)². 그 안은 무조건 255다.
              원 넓이의 대부분이 여기라, 제곱근은 **가장자리 한 겹**(둘레 ~2πr)에서만 뽑는다.
              반지름 9면 254칸 중 57칸 — 제곱근의 77%가 사라진다.
           ③ 이미 255인 칸은 건너뛴다 — 여기는 최댓값 합집합이라 255를 넘길 수 없다.
              일꾼 여덟이 붙어 선 본진처럼 눈이 겹치는 자리에서 통째로 빠진다. */
      const disc = (cx: number, cy: number, r: number): void => {
        const x0 = Math.max(0, Math.floor(cx - r - 1));
        const x1 = Math.min(gw9 - 1, Math.ceil(cx + r + 1));
        const y0 = Math.max(0, Math.floor(cy - r - 1));
        const y1 = Math.min(gh9 - 1, Math.ceil(cy + r + 1));
        const rOut = r + 0.5;
        const rIn = r - 0.5;
        const r2out = rOut * rOut;
        const r2in = rIn > 0 ? rIn * rIn : -1;   // 반지름이 반 칸도 안 되면 '안'이 없다
        for (let y9 = y0; y9 <= y1; y9 += 1) {
          const dy9 = y9 + 0.5 - cy;
          const dy2 = dy9 * dy9;
          const row9 = y9 * gw9;
          for (let x9 = x0; x9 <= x1; x9 += 1) {
            const dx9 = x9 + 0.5 - cx;
            const d2 = dx9 * dx9 + dy2;
            if (d2 >= r2out) continue;             // ① 원 밖
            const i9 = row9 + x9;
            if (buf![i9] === 255) continue;        // ③ 이미 꽉 찬 칸
            if (d2 <= r2in) { buf![i9] = 255; continue; }   // ② 원 속
            // 가장자리 한 칸을 0~255로 나눠 적는다 — 이 기울기가 곧 원의 곡선이다.
            const v9 = Math.round((rOut - Math.sqrt(d2)) * 255);
            if (v9 > buf![i9]) buf![i9] = v9;
          }
        }
      };
      /** 안개 층이 쓸 눈 목록 — disc를 부를 때마다 여기에도 적는다. */
      const src9: number[] = [];
      const eye = (cx: number, cy: number, r: number): void => {
        src9.push(cx, cy, r);
        disc(cx, cy, r);
      };
      /* 눈은 **이 프레임에 실제로 서 있는 것들**이다 — 유닛 명단(engageFoes)과 건물
         명단(bldFoes)이 이미 그 값이라 따로 훑지 않는다(둘 다 위에서 t로 걸러졌다). */
      for (const f9 of engageFoes) {
        if (!visAll && f9.team !== viewTeam) continue;
        eye(f9.x, f9.y, sightTiles(f9.uk ?? f9.k ?? "Marine"));
      }
      for (const f9 of bldFoes) {
        if (!visAll && f9.team !== viewTeam) continue;
        eye(f9.x, f9.y, sightTiles(f9.k ?? "Command Center"));
      }
      /* ★ **공사 중인 건물도 제 시야를 갖는다**(물음: "공사중 건물은 원래 시야가 없나?"
         — 없지 않다. 원작은 착공하는 순간 건물 개체를 만들고, 그 개체는 미완성인 채로도
         제 시야 범위를 그대로 낸다. 파일런을 적진에 박아 정찰하는 것이 그 성질이다.
         OpenBW의 시야 셈(unit_sight_range)에도 '미완성이면 줄인다'는 갈래가 없다).
         그런데 여기 명단(bldFoes)은 **다 지어진 것만** 담는다 — 그쪽은 '방어 건물의
         표적'을 고르는 명단이라 그 규칙이 맞지만, 시야는 아니다. 그래서 밝힘 이력은
         착공 시각부터 찍히는데(위 stamp) 정작 지금 시야에는 공사장이 빠져, 짓는 동안
         제자리가 도로 안개에 덮이는 앞뒤 안 맞는 그림이 났다. 여기서 채운다. */
      for (const b9 of buildsSrc) {
        if (!visAll && teamOfRaw(b9[4]) !== viewTeam) continue;
        if (t < b9[0]) continue;                                  // 아직 착공 전
        const gone9 = goneEffOf(b9);
        if (gone9 > 0 && t >= gone9) continue;                    // 걷힌 뒤
        const done9 = b9[7] ?? b9[0] + (BUILD_SEC[b9[3]] ?? 30);
        if (t >= done9) continue;                                 // 완성분은 위 명단이 냈다
        const fp9 = FOOTPRINT[b9[3]] ?? [3, 2];
        eye(b9[1] + fp9[0] / 2, b9[2] + fp9[1] / 2, sightTiles(b9[3]));
      }
      /* 이사 비행 중인 건물은 **나는 자리**에서도 본다(지적: 떠다니는 건물 시야) —
         위 두 명단은 줄에 적힌 붙박이 좌표를 쓰므로 비행 구간이 빠진다. 그리는 쪽과
         같은 곡선으로 지금 자리를 다시 셈해 하나 더 찍는다(겹쳐도 최댓값이라 무해하다). */
      for (const b9 of buildsSrc) {
        if (!visAll && teamOfRaw(b9[4]) !== viewTeam) continue;
        const lift9 = b9[6];
        const land9 = b9[5] ?? 0;   // 이 줄의 gone은 파괴가 아니라 **착륙 시각**이다
        if (lift9 === undefined || t < lift9 || !(land9 > lift9) || t > land9) continue;
        const to9 = buildsSrc.find(([s2, x2, y2, u2, r2]) => r2 === b9[4] && u2 === b9[3]
          && s2 === land9 && (x2 !== b9[1] || y2 !== b9[2]));
        if (!to9) continue;
        const fp9 = FOOTPRINT[b9[3]] ?? [3, 2];
        const u9 = Math.min(1, (t - lift9) / Math.max(0.1, land9 - lift9));
        const k9 = u9 * u9 * (3 - 2 * u9);
        eye(b9[1] + (to9[1] - b9[1]) * k9 + fp9[0] / 2,
          b9[2] + (to9[2] - b9[2]) * k9 + fp9[1] / 2, sightTiles(b9[3]));
      }
      visSrcRef.current = Float32Array.from(src9);
      /* 이번 판에 든 시간을 적어 둔다 — 다음 쉬는 간격을 이 값이 정한다(위 ★ 적응 조르기).
         기기가 느려지거나 눈이 늘면 삯이 커지고, 그러면 저절로 더 오래 쉰다. */
      fs9.cost = pNow() - now9;
      return buf;
    })();
    if (fogOn && exploredAt && visNow) {
      const n9 = gw9 * gh9;
      let ls = lastSeenRef.current;
      if (ls.length !== n9) { ls = new Float32Array(n9); lastSeenRef.current = ls; lastTRef.current = -1; }
      /* ★ **시점이 바뀌면 기억을 새로 쌓는다**(지적: "한번이라도 그려진 건물은 선수시야를
         적용해도 계속 나오는 버그") — 원인이 정확히 여기였다. '마지막으로 본 시각'은
         재생이 흐르는 동안 프레임마다 쌓이는 **한 벌**인데, 시점을 갈아도 그 벌이 그대로
         남았다. 전체 시야(모두의 눈)로 보다가 한 선수 시점으로 바꾸면, 전체 시야일 때
         찍힌 시각이 그대로 남아 **그 선수가 본 적 없는 건물까지 잔상 자격**을 얻었다.
         시점(팀)이 바뀌면 그 벌을 버리고 '처음 본 시각'(exploredAt — 이미 그 팀 것으로
         다시 계산됐다)에서 다시 시작한다. 되감기와 같은 처방이다. */
      const vkey9 = visAll ? 0 : viewTeam;
      if (t < lastTRef.current || lastViewRef.current !== vkey9) {
        /* ★ **통째로 다시 쌓는다**(요청: 그쪽이 낫다면) — 앞선 판은 '처음 본 시각'으로
           물러났는데, 그건 어림이라 시점을 바꾼 직후 잔상 판정이 관대해졌다(한 번 가 본
           자리면 그 뒤에 지은 건물까지 기억으로 쳤다).
           이제 0초부터 지금까지 그 팀의 눈길을 한 번 되짚어 **칸마다 마지막으로 본 초**를
           정확히 낸다. 삯은 시점 전환·되감기 한 번에 수십 ms고(원 찍기가 대부분이다),
           그 뒤로는 프레임마다 지금 보이는 칸만 덧쓰므로 값이 안 든다.
           ※ 성능이 아니라 **정확도**를 사는 자리다 — 프레임 삯은 앞 판과 같다. */
        fogSrc?.rebuildLastSeen(ls, t);
        lastViewRef.current = vkey9;
      }
      for (let i9 = 0; i9 < n9; i9 += 1) if (visNow[i9] >= 128) ls[i9] = t;
      lastTRef.current = t;
    }
    const seenSince = (x9: number, y9: number, since: number): boolean => {
      if (!fogOn) return true;
      const cx = Math.floor(x9);
      const cy = Math.floor(y9);
      if (cx < 0 || cy < 0 || cx >= gw9 || cy >= gh9) return false;
      return lastSeenRef.current[cy * gw9 + cx] >= since;
    };
    /** 그 자리가 지금 어느 단인가 — 0 안 밝힘 · 1 밝혔지만 안 보임 · 2 보임. */
    const seenAt = (x9: number, y9: number): 0 | 1 | 2 => {
      if (!fogOn || !exploredAt || !visNow) return 2;
      const cx = Math.floor(x9);
      const cy = Math.floor(y9);
      if (cx < 0 || cy < 0 || cx >= gw9 || cy >= gh9) return 0;
      const i9 = cy * gw9 + cx;
      // 덮임 값의 절반이 곧 안개 층이 자르는 자리다(그쪽과 같은 문턱이어야 한다).
      if (visNow[i9] >= 128) return 2;
      return exploredAt[i9] <= t ? 1 : 0;
    };
    const FOE_BIN = 8;
    const foeCols = Math.max(1, Math.ceil(grid.width / FOE_BIN));
    const foeRowsN = Math.max(1, Math.ceil(grid.height / FOE_BIN));
    const foeBins: FoeRow[][] = Array.from({ length: foeCols * foeRowsN }, () => []);
    for (const f of engageFoes) {
      const cx9 = Math.min(foeCols - 1, Math.max(0, Math.floor(f.x / FOE_BIN)));
      const cy9 = Math.min(foeRowsN - 1, Math.max(0, Math.floor(f.y / FOE_BIN)));
      foeBins[cy9 * foeCols + cx9].push(f);
    }
    /* ★ **건물도 같은 격자에** (지적: "맞고 있는 표적만 넣고 개선했는데도 너무 느려짐") ──
       여태 방어 건물이 부를 때는 건물 명단(bldFoes)을 **선형으로 전수** 훑었다("수가 적어
       그냥 훑는다"). 그 어림이 '맞고 있는 표적만' 뒤에 무너졌다 — 표적을 못 찾으면 bd가
       무한이라 `d >= bd` 가지치기가 **한 번도 안 걸리고**, 그러면 적 건물 하나하나에
       시야 판정(sightBlocked, 한 번에 수십 칸을 걷는다)이 그대로 돈다. 방어 건물 수 ×
       적 건물 수만큼을, 프레임마다.
       격자에 넣으면 고리가 거리순으로 돌아 **가까운 것에서 bd가 잡히고** 그 뒤는 통째로
       잘린다 — 유닛에 이미 쓰던 그 이득을 건물도 받는다. 답은 같다(같은 tryFoe를 쓴다). */
    const bldBins: FoeRow[][] = Array.from({ length: foeCols * foeRowsN }, () => []);
    for (const f of bldFoes) {
      const cx9 = Math.min(foeCols - 1, Math.max(0, Math.floor(f.x / FOE_BIN)));
      const cy9 = Math.min(foeRowsN - 1, Math.max(0, Math.floor(f.y / FOE_BIN)));
      bldBins[cy9 * foeCols + cx9].push(f);
    }
    if (PERF9) {
      pAdd("준비(개체·상태·격자)", pNow() - pPrep9);
      pAdd("개체수", 0); perfHit["개체수"] = (perfHit["개체수"] ?? 0) + engageFoes.length;
      pAdd("건물수", 0); perfHit["건물수"] = (perfHit["건물수"] ?? 0) + bldFoes.length;
      pFrame();
    }
    const foeOfTgt9 = (arr: Ticks | undefined): FoeRow | null => {
      const v9 = tkLast(arr, t);
      if (!v9) return null;
      return entPosByTag.get(v9) ?? null;
    };
    /** 맞은 방향을 읽어 오는 거리(타일) — 2.5였다: 근접 무기 기준이라, 마린·드라군·탱크처럼 멀리서 쏜
     *  피격은 전부 방향 없음이 되어 파편이 **사방으로 동그랗게** 퍼졌다(지적: 후보판은 반대쪽으로 튀는데
     *  재생기는 둥글게). 방향은 멀리서 맞아도 뜻이 같으므로 가장 긴 사거리(시즈 12)에 여유를 둔다. */
    const HIT_DIR_TILES = 14;
    /* 맞은 쪽이 **어디서 맞았나**(요청: "근접공격시 피격효과(건물포함, 방향주의)") —
       참값에는 '누가 때렸나'가 없다. 체력이 내려간 순간만 있다. 그런데 근접 공격은 붙어야
       때리므로, 맞은 그 순간 **닿아 있는 적**이 곧 때린 쪽이다 — 추정이 아니라 사실상
       확정이다. 원거리는 그 반경 밖이라 아무것도 안 돌려준다: 그때는 방향을 모르는 것이
       맞고, 모르면 몸 가운데에 그대로 둔다(지어내지 않는다).
       돌려주는 것은 **화면** 방향의 단위 벡터다 — 입체에서는 세로가 눌리므로 그 몫을
       곱해야 불티가 몸의 맞는 쪽 테두리를 정확히 짚는다. */
    /* ★ **누가 때렸나 — 참값이 말한다**(지시: "모든 어림과 시야 체력감소 등 조건 다 제거") ──
       여기 있던 것은 '맞은 순간 가장 가까운 적이 때린 쪽'이라는 어림이었다. 근접은 붙어야
       때리니 사실상 확정이었지만 원거리는 지나가던 유닛이 범인이 되기도 했고, 적 방어
       건물은 딴 명단이라 아예 못 찾았다.
       참값에 "누가 무엇을 겨누나"가 실린 뒤로는 **뒤집기만 하면 된다**(위 foeByTarget) —
       나를 겨눈 그 몸이 곧 때린 쪽이다. 방어 건물도 유닛과 같은 색인에 들어 있어 함께 잡힌다.
       ★ 방향은 여전히 **붙어 있을 때만** 준다 — 그건 어림이 아니라 뜻의 문제다: 멀리서
         날아온 것은 몸의 어느 쪽에 맞았는지가 그림으로 안 읽히므로, 모를 때는 몸 가운데다. */
    const hitSrcOf = (
      tag9: number, x9: number, y9: number,
    ): { dir: [number, number] | null; uk?: string; unit?: string } => {
      const f9 = tag9 > 0 ? foeByTarget.get(tag9) : undefined;
      if (!f9) return { dir: null };
      const bd9 = Math.hypot(f9.x - x9, f9.y - y9);
      let dir: [number, number] | null = null;
      if (bd9 <= HIT_DIR_TILES && bd9 >= 0.05) {
        const dx9 = f9.x - x9;
        const dy9 = (f9.y - y9) * (pitched ? pitchFlat : 1);
        const m9 = Math.hypot(dx9, dy9);
        if (m9 >= 0.001) dir = [dx9 / m9, dy9 / m9];
      }
      /* 무기 갈래는 이름을 아는 몸에서만 — 건물이면 k, 유닛이면 uk가 그 이름이다.
         (사거리 확인은 걷었다: 참값이 겨눈 것이면 제 사거리 안이다.) */
      const uk9 = f9.uk ?? f9.k;
      return { dir, uk: uk9 && isKnownKind(uk9) ? uk9 : undefined, unit: uk9 };
    };
    const RIDE_TETHER_SEC = 1.1;
    /* ★ 배 쪽 끝은 **배에게 묻는다**(지적: "드랍십 내리기 점선이 전혀 엉뚱한 데랑 이어져.
       드랍십이 아니라 엄청 먼 곳") ────────────────────────────────────────────────────
       여태 그 자리를 **탄 몸의 자취**에서 뽑았다 — 배 안에 있는 동안 참값이 싣는 자리가
       배의 자리일 것이라 여겼는데, 아니었다. 원작은 태우는 순간 그 몸을 지도에서 걷고
       **자리를 그때 그대로 얼려 둔다**(움직이는 것은 배뿐이다). 그러니 '안에 든 마지막
       키'는 배가 지금 있는 곳이 아니라 **탔던 자리**다 — 배가 지도 반대편까지 날아갔으면
       줄도 거기까지 간다. 실제로 그렇게 보였다.
       (같은 사정으로 태울 때의 줄은 길이가 0이라 여태 아예 안 그려졌다 — 두 끝이 다
       '탔던 자리'였다.)
       그러니 배를 찾아야 한다: 같은 임자의 수송 수단 중, 그 순간 이 몸의 자리에 **가장
       가까운** 것. 승하차는 배가 몸 바로 곁에 있을 때 일어나므로 가장 가까운 하나면 되고,
       너무 멀면(8타일) 못 찾은 것으로 보고 줄을 안 긋는다 — 엉뚱한 데로 긋느니 안 긋는다. */
    const RIDE_CARRIERS = new Set(["Dropship", "Shuttle", "Overlord", "Bunker"]);
    /** 이번 프레임에 그릴 승하차가 하나라도 있나 — 있을 때만 배 명단을 만든다. */
    let rideCarriers9: typeof entWalks | null = null;
    for (const e9 of entWalks) {
      if (e9.rides.length === 0 || RIDE_TETHER_SKIP.has(e9.unit)) continue;
      /* ★ **배는 승객이 될 수 없다**(같은 지적) — 수송선·오버로드·벙커는 원작에서 무엇에도
         안 실린다. 그런데 배 명단(RIDE_CARRIERS)과 승객을 안 갈라 두어, 갓 나온 드랍십이
         승객으로 올라오면 곁의 **다른 드랍십**을 배로 짚는 일까지 났다. 위 생산 걸러 내기와
         겹으로 막는다 — 이 줄은 자료가 어떻게 바뀌어도 참이다. */
      if (RIDE_CARRIERS.has(e9.unit)) continue;
      const rteam9 = teamOfRaw(e9.raw) ?? 0;
      for (const r9 of e9.rides) {
        const inW9 = t >= r9.a && t < r9.a + RIDE_TETHER_SEC;
        const outW9 = t >= r9.b && t < r9.b + RIDE_TETHER_SEC;
        if (!inW9 && !outW9) continue;
        /** 몸 쪽 끝 — 탈 때는 밖에 서 있던 마지막 자리, 내릴 때는 내려선 자리. */
        const ux9 = inW9 ? r9.ax : r9.bx;
        const uy9 = inW9 ? r9.ay : r9.by;
        // 안 보이는 자리의 승하차는 안 알린다 — 몸에 거는 문과 같은 자다.
        if (fogOn && !visAll && rteam9 !== viewTeam && seenAt(ux9, uy9) < 2) continue;
        const at9 = inW9 ? r9.a : r9.b;
        if (!rideCarriers9) {
          rideCarriers9 = entWalks.filter((c9) => RIDE_CARRIERS.has(c9.unit)
            && c9.walk.n > 0);
        }
        /** 그 순간 곁에 있던 **같은 임자의 배** — 가장 가까운 하나. */
        let ship9: (typeof entWalks)[number] | null = null;
        let sd9 = 8;
        for (const c9 of rideCarriers9) {
          if (c9.raw !== e9.raw || c9.tag === e9.tag) continue;
          if (at9 < c9.born || (c9.died !== null && at9 >= c9.died)) continue;
          const cp9 = posAtW(c9.walk, at9);
          if (!cp9) continue;
          const d9 = Math.hypot(cp9.x - ux9, cp9.y - uy9);
          if (d9 >= sd9) continue;
          /* ★ 배 쪽 끝을 **띄운다**(지적: "3D 모드에서는 안 나오던데 왜 그래") ────────────
             안 나온 것이 아니라 **길이가 없었다.** 두 끝을 다 땅에 두었는데, 승하차는 배가
             몸 바로 위에 있을 때 일어나므로 두 자리가 한두 타일밖에 안 떨어진다. 눕히면
             그 세로 거리가 눌림배(0.6)로 더 줄어, 1배 3D에서는 몇 픽셀짜리 선이 되어
             '두 끝이 겹치면 안 그린다'는 문(2px)에 걸리거나 눈에 안 들었다.
             배는 공중이다 — 저쪽 끝을 배가 떠 있는 높이에 두면 줄이 땅에서 하늘로 비스듬히
             서고, 그 길이는 눕혀도 안 줄어든다(들림은 화면 세로 그대로다). 물리로도 그게
             맞다: 몸은 배로 빨려 올라가는 것이지 옆으로 가는 것이 아니다.
             벙커는 건물이라 안 띄운다.
             높이는 **타일로** 잡는다 — 정확한 자(unitPxOf × AIR_LIFT_K)는 아직 안 선
             자리라(그 값은 아래에서 난다) 여기서는 못 부른다. 세 배(드랍십·셔틀·오버로드)의
             그려지는 상자가 2.5타일 남짓이고 들림이 그 0.6배이므로 1.5타일이 그 값이다. */
          sd9 = d9; ship9 = c9;
        }
        // 곁에 배가 없으면 안 긋는다(벙커처럼 자취가 없는 것·자료가 없는 옛 판).
        if (!ship9) continue;
        /* ★ 두 끝은 **지금 시각으로 다시 묻는다**(지적: "승하차 점선은 고정이 아니라 유닛과
           수송선을 따라 실시간으로 움직여야 해 — 보이는 동안") ────────────────────────────
           여태 두 끝을 다 **승하차가 일어난 그 순간(at9)의 자리**로 얼려 두고 1.1초 동안
           그대로 뒀다. 그런데 그 1.1초는 화면에서 짧은 시간이 아니다 — 드랍십은 초당
           5타일을 날고, 내려선 유닛은 바로 걸어 나간다. 얼린 줄은 곧 **아무 데도 안 닿은
           허공의 막대**가 되고, 그 사이 진짜 배는 저만치 가 있다. 이러면 이 줄이 하려던
           일("이 몸과 저 배가 한 짝이다")이 되레 뒤집힌다.
           배를 **고르는** 자리는 여전히 at9다(승하차는 배가 몸 곁에 있을 때 일어나므로
           그때의 거리가 짝을 가리는 유일한 참값이다). 다만 고른 뒤 **그리는** 자리는 t로
           묻는다 — 짝짓기와 그리기를 가른다.
           몸 쪽은 갈래가 다르다. 내릴 때(outW9)는 몸이 이미 지도 위에 있으니 제 자취를
           t로 물으면 걸어 나가는 대로 따라간다. 탈 때(inW9)는 몸이 **배 안**이라 물을
           자취가 없다(원작이 그 자리를 얼려 둔다) — 밖에 서 있던 마지막 자리가 그대로
           맞는 답이므로 그쪽만 얼린 채 둔다. 이때 움직이는 것은 배 쪽 끝뿐인데, 그것이
           곧 '몸을 태우고 떠나는' 그림이라 물리로도 맞다.
           죽은 뒤에는 죽은 자리에 멈춘다(posAt은 자취 끝을 넘어서면 마지막 점을 준다). */
        const snow9 = posAtW(ship9.walk,
          ship9.died !== null ? Math.min(t, ship9.died) : t);
        if (!snow9) continue;
        /** 배가 떠 있는 몫(px) — 배는 **공중**이라 줄의 저쪽 끝은 하늘에 있다. */
        const slift9 = isAirUnit(ship9.unit)
          ? (mapW9 / Math.max(1, grid.width)) * 1.5 : 0;
        const unow9 = outW9
          ? posAtW(e9.walk, e9.died !== null ? Math.min(t, e9.died) : t) : null;
        const [ufx9, ufy9] = posFrac(unow9?.x ?? ux9, unow9?.y ?? uy9);
        const [sfx9, sfy9] = posFrac(snow9.x, snow9.y);
        /* ★ 줄은 **몸 위에서** 시작한다(지적: "점선이 유닛 중간까지 이어서 유닛까지 가려지는
           거 같아") ────────────────────────────────────────────────────────────────────
           여태 이쪽 끝의 들림이 0이라 줄이 **발밑**에서 났다. 배는 늘 몸 바로 위에 있으므로
           그 줄은 몸을 세로로 관통해 올라간다 — 가는 실이어도 몸 한가운데를 가로지르면
           눈에는 그 몸이 가려진 것으로 읽힌다.
           머리 언저리에서 내면 줄이 몸 밖에서만 산다. 자는 **그려지는 몸 폭**이다(모델
           상자에 잉크 몫을 곱한 값 — 이 파일이 몸 크기를 말할 때 늘 쓰는 그 자다).
           물리로도 이쪽이 맞다: 몸은 배에 **빨려 올라가는** 것이라 줄이 머리에서 난다. */
        /* 자는 **집안 것을 그대로** 쓰되 여기서 조립한다 — unitPxOf는 이 자리보다 아래에
           서므로(그 자리 주석) 못 부른다. 그 함수가 하는 일이 곧 아래 세 줄이다:
           크기표(unitTilesOf) × 잉크 몫 × 타일 px. 깊이 눌림(pitchK)만 빠지는데, 이 값이
           정하는 것은 줄이 나는 높이 한 뼘이라 그 오차는 화면에서 안 읽힌다. */
        const uk9 = UNIT_3D[e9.unit] ?? "";
        const ubody9 = uk9
          ? unitTilesOf(uk9, uk9, (UNIT_BULK[e9.unit] ?? 1) as 0 | 1 | 2)
            * (modelInkOf(uk9) / 16)
            * (mapW9 / Math.max(1, grid.width))
          : 0;
        fxOps.push({
          kind: "tether", fx: ufx9, fy: ufy9, tx: sfx9, ty: sfy9,
          lift: ubody9, tlift: slift9,
          ph: ((inW9 ? t - r9.a : t - r9.b) / RIDE_TETHER_SEC),
        });
      }
    }
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
    void unitSepPxOf;
    {
    const rBD9 = buildsDrawOrder.map((i) => {
      const [sec, x, y, unit, raw, gone, liftAt, bldDoneAt] = buildsSrc[i];
      if (sec > t) return null;
      /* ★ 몸이 없는 개체(스캔·다크 스웜 자국 등)는 건물로 안 그린다(지적: 스캔에 동심원 —
         스캔이 건물 자취로 실려 모델 없는 테란 폴백(예전 공사장, 지금 워프인 고리)이
         탐지 반경 크기로 섰다). 그 연출은 캐스트 효과가 따로 낸다. */
      if (NO_BODY_UNITS.has(unit)) return null;
      const goneAt = gone ?? 0;
      // 없어진 건물은 그냥 사라진다(요청: ✕ 표시 없음) — 착륙 이사·변태와도 한 결이다.
      /* 핵 한 방(요청) — 폭발 반경 안에서 무너진 걸로 판정된 건물은 파괴 감지가
         한참 뒤에 눈치챘더라도 착탄 순간 바로 걷는다. 이륙 이사 기록(liftAt)은
         goneAt이 착륙 시각이라 건드리지 않는다. */
      /* 걷히는 시각은 **공용 문**이 낸다(위 goneEffOf) — 여기서만 앞당기면
         안개와 표적 명단이 다른 시각을 보고, 그 차가 그대로 '아무것도 없는데
         남는 시야'가 된다(그 자리 주석). 아래 옛 셈은 그 문 안으로 옮겼다. */
      const goneEff = goneEffOf(buildsSrc[i]);
      /* 페이드 인·아웃(요청) — 지어질 때 1.2초 스르륵 나타나고, 없어질 때 1.2초
         스르륵 사라진다. */
      /* 저그는 페이드가 없다(요청: "저그 드론 건물 변태/취소시 페이드인 아웃 없게")
         — 드론이 그 자리에서 건물로 변하는 것이라, 스르륵 나타나면 '어디선가
         생겨난 것'으로 읽힌다. 취소도 마찬가지로 그 자리에서 도로 드론이 된다. */
      const FADE_SEC = bldPre9.fade[i];   // 사전셈(위 bldPre9)
      /* 날아와 앉은 줄은 스르륵 나타나지 않는다(위 이사 비행 주석) — 같은 몸이
         방금 저기서 왔으므로, 페이드인은 '어디선가 새로 생겨났다'로 읽힌다. */
      const landedHere = bldPre9.landed[i];   // 사전셈
      /* 이 줄이 걷히는 것이 '날아가 저기 앉았다'인가(지적: "건물 오르내릴때도
         그냥 내리면 되는데 페이드아웃되고 새로 나와서 좀 이상해") — 이사는 줄
         둘이 나눠 그린다: 떠난 자리 줄이 목적지까지 날아가고, 앉은 자리 줄이
         그 시각부터 선다. 앉은 줄의 **나타남** 페이드는 이미 껐는데(landedHere)
         떠난 줄의 **사라짐** 페이드는 살아 있어서, 1.2초 동안 같은 건물이 둘로
         겹쳐 보였다 — 하나는 또렷하고 하나는 스러지는 유령이다.
         넘겨주기는 페이드가 아니다. 그 순간 딱 끊는다. */
      /* (걷어냄) landedAway — 띄워 옮긴 건물이 옛 줄을 넘겨주는 순간만 페이드
         없이 끊던 예외다. 이제 **모든 사라짐**이 그 규약이라 예외가 필요 없다. */
      /* ★ **사라짐은 페이드가 없다**(요청: "건물이나 유닛 사망시 페이드아웃
         아니고 바로 삭제") — 걷히는 1.2초 동안 건물이 스러지면, 그 사이에 이미
         폭발 효과가 터지고 잔해 위로 다음 것이 지어지기 시작해 '반쯤 투명한
         건물'이 화면에 남는다. 무너지는 순간은 한 프레임이고, 그 자리를 말하는
         것은 폭발 효과의 몫이다.
         태어나는 쪽 페이드(sec)는 그대로 둔다 — 그건 사라짐이 아니라 완공이
         화면에 드는 결이고, 지적이 가리킨 자리도 아니다.
         landedAway(띄워 옮긴 건물이 옛 줄을 넘겨주는 순간)는 이미 페이드 없이
         끊고 있었다 — 이제 모든 사라짐이 그와 같은 규약이다. */
      const fade = FADE_SEC <= 0 || !(sec > 0) || landedHere
        ? 1 : Math.min(1, (t - sec) / FADE_SEC);
      if (goneEff > 0 && t >= goneEff) return null;
      if (fade <= 0) return null;
      // 떠 있는 구간(지적: 건물 떠 있는 게 표현이 안 된다) — 이륙부터 착륙(=goneAt)
      // 까지 옛 자리에서 둥실거린다.
      const afloat = !!liftAt && t >= liftAt;
      /* ★ **화면 밖 건물은 안 그린다**(위 cull9) — 개체 쪽과 같은 자다.
         다만 **떠 있거나 날아온 줄은 안 거른다**: 그 둘만 자리가 움직여, 지금
         밖이어도 다음 순간 안으로 들어온다(자리 판정은 x·y 하나로 하는데
         비행 중에는 그 값이 출발지라 거짓말이 된다). 그 둘은 몇 기뿐이라
         남겨 두어도 값이 없다. */
      if (cull9 && !afloat && !bldPre9.flown[i]) {
        const [in9, dfx9, dfy9] = onScreen9(x, y);
        if (!in9) {
          /* 건물 점은 **한 단 크게** 찍힌다 — 미니맵이 wFrac의 유무로 유닛과
             건물을 가른다(그쪽 uS·bS). 값은 안 읽으므로 0이면 된다. */
          miniExtra.push({
            fx: dfx9, fy: dfy9, color: modeColor(raw, teamOfRaw(raw) ?? 1), wFrac: 0,
          });
          return null;
        }
      }
      const razed = false;
      /* 같은 자리에 제 후계가 서면(레어 진화·재건·콜로니 변태) 옛 것은 걷는다
         (지적: 비활성 건물이 글자와 도형으로 동시 표시). 계보는 한 방향이고
         자리는 발자국 안이라야 한다(위 succeedsBld 주석 — 성큰이 옆 크립 콜로니에
         지워지던 자리). */
      // 사전셈이 '후속이 선 가장 이른 시각'을 들고 있다 — 비교 한 번이면 된다.
      if (!razed && bldPre9.succAt[i] <= t) {
        return null;
      }
      /* 착륙 이사(요청: 건물 움직임도 추적) — 같은 임자의 같은 건물이 내 시작
         시각에 걷혔으면 거기서 날아온 것이다. 나는 동안은 두 자리 사이를 비행
         속도로 잇는다. */
      let bx = x;
      let by = y;
      /* 겹침 해소(요청: 건물끼리 캔버스 겹침 불가) — 화면 자리만 민다(위 bldNudge). */
      const nud = bldNudge.get(i);
      if (nud) { bx += nud[0]; by += nud[1]; }
      /* 짝의 걷힌 시각이 실제로 있어야(> 0) 한다(지적: 첫 기지가 위에서 내려온다) —
         시작 홀은 시작 시각이 0이라, 조건이 "gone === 0"이 되면 살아 있는 같은 종류
         건물 아무거나와 짝이 돼 거기서 날아왔다. */
      const flownFrom = bldPre9.flown[i] || undefined;   // 사전셈
      /* 이사 비행은 **떠난 자리 줄**이 그린다(지적: "테란 건물 띄운게 표현 안되고
         내린게 건설로 읽히는듯") ────────────────────────────────────────────
         참값은 뜬 때(liftAt)와 앉은 때(goneAt)를 둘 다 안다. 그러니 비행 구간은
         [뜬 때, 앉은 때]다. 여태는 그 구간을 안 보고, **앉은 자리 줄**이 제 시작
         시각부터 어림 속도로 날아오게 그렸다 — 그래서 둘이 겹쳤다:
           · 떠난 자리 줄은 뜬 때부터 앉을 때까지 **제자리에서 둥실**댄다
             (afloat이 자리를 안 옮긴다). 곧 뜨는 것은 보여도 가는 것은 안 보인다.
           · 앉은 자리 줄은 이미 앉은 시각부터 **그제야** 날아온다.
         이제 떠난 줄이 실제 구간 동안 두 자리 사이를 잇고, 앉은 줄은 제 시각에
         이미 앉아 있다(아래 landedFrom이 나타남 페이드를 끈다 — 날아와 앉은 것은
         새로 생겨난 것이 아니다). */
      const flyTo = liftAt !== undefined && goneAt > liftAt
        ? buildsSrc.find(([s2, x2, y2, u2, r2]) => r2 === raw && u2 === unit
          && s2 === goneAt && (x2 !== x || y2 !== y))
        : undefined;
      /** 이 줄의 끝이 **착륙**인가 — 같은 사람의 같은 건물이 goneAt에 새 줄로
       *  이어서면 앉은 것이다(자리를 옮겼든 제자리든). 없으면 공중에서 끝난
       *  것이다: 격추. flyTo는 여기에 '자리가 달라야 한다'를 더한 것이라
       *  제자리 착륙을 못 잡는다 — 내려앉힐지 말지는 이쪽으로 묻는다. */
      const landsAt9 = liftAt !== undefined && goneAt > liftAt
        && buildsSrc.some(([s2,,, u2, r2]) => r2 === raw && u2 === unit && s2 === goneAt);
      /* 이사 비행 중인가 — 떠 있는 건물만 그림자를 지니는 데 쓴다(요청). */
      let landing = false;
      /** 지금 얼마나 떠 있나(0 땅 ~ 1 최고) — 몸을 띄우는 몫이 이 값을 탄다. */
      let hover9 = 0;
      if (afloat) {
        /* 부드럽게 뜨고 내린다(요청: "뜨고 내리는 효과 부드러운 베지어곡선") —
           여태 뜬 순간 몸이 툭 솟고 앉는 순간 툭 떨어졌다. 오르는 데 0.9초,
           내리는 데 0.9초를 쓰고 그 사이는 최고 높이다. 곡선은 smoothstep
           (3u² − 2u³) — 3차 베지에 ease-in-out과 같은 꼴이라 양 끝의 기울기가
           0이다: 땅을 떠나는 순간과 닿는 순간에 속도가 0이라야 '툭'이 없다. */
        const RISE9 = 0.9;
        const ease9 = (u: number): number => {
          const c = Math.min(1, Math.max(0, u));
          return c * c * (3 - 2 * c);
        };
        const up9 = ease9((t - liftAt!) / RISE9);
        /* ★ 내려앉는 것은 **앉을 때뿐**이다(요청: "테란 건물 공중에서 요격 시
           땅으로 떨어지고 터지는데 그냥 공중에서 폭파로 변경") ────────────────
           여태 이 줄의 조건은 '뜬 뒤에 끝난다'(goneAt > liftAt)뿐이라, **끝나는
           까닭을 안 물었다**. 그런데 뜬 건물의 생애가 끝나는 길은 둘이다:
             ① 어딘가에 앉는다 — 참값이 그 자리에 새 줄을 세운다(자리마다 한 줄).
             ② 공중에서 격추된다 — 뒤에 아무 줄도 없다.
           ②까지 마지막 0.9초 동안 곱게 내려앉히니, 맞아 떨어지는 것이 아니라
           **착륙하듯 사뿐히 내려와서** 사라졌다. 이제 뒤에 이어지는 줄이 있을
           때만 내려앉는다 — 제자리 착륙(같은 x·y)도 새 줄을 세우므로 함께 잡힌다.
           격추는 뜬 높이 그대로 있다가 그 높이에서 터진다(아래 소멸 효과). */
        const down9 = landsAt9 ? ease9((goneAt - t) / RISE9) : 1;
        hover9 = Math.min(up9, down9);
      }
      if (flyTo && liftAt !== undefined && t >= liftAt) {
        /* 가로 이동도 같은 곡선이다 — 등속으로 밀면 뜨자마자 최고 속도라
           출발·도착이 뚝뚝 끊긴다. */
        const u9 = Math.min(1, (t - liftAt) / Math.max(0.1, goneAt - liftAt));
        const k = u9 * u9 * (3 - 2 * u9);
        bx = x + (flyTo[1] - x) * k;
        by = y + (flyTo[2] - y) * k;
        landing = true;
      }
      /* 뜬 건물의 자리 — 개체 트랙이 착륙 자리마다 줄을 나눠 싣기 때문에, 이 줄의
         좌표가 곧 지금 그 건물이 있는 자리다. 표적 지도(engageFoes·entPosByTag)도
         같은 좌표를 본다 — 몸과 겨눠지는 자리가 갈리면 총알이 빈 땅으로 간다. */
      // 짓는 동안은 공사중 아이콘(요청: 반투명 말고) — 반투명은 "저기 뭐가 있긴 한데"
      // 로만 읽히고, 도형의 반투명(뒤 비침)과도 헷갈렸다. 날아온 건물은 이미 다 선
      // 건물이라 망치를 안 든다.
      // 시작 건물(합성된 0초 홀)도 망치를 안 든다(지적: 처음 홀에 망치 표시는 왜?) —
      // 경기 시작에 이미 다 서 있던 건물이지, 짓는 중이 아니다.
      // 완성 시각은 참값이 말한다(행의 여덟째 칸) — 없으면 착공 + 표의 건설 시간.
      const bldNeed = BUILD_SEC[unit] ?? 30;
      const doneAt = bldDoneAt ?? sec + bldNeed;
      const raising = !razed && !flownFrom && sec > 0 && t < doneAt;
      /* (걷어냄) '건설 중단' 표시 — 일꾼이 붙어 있는 구간을 명령 증거로 되짚던
         값이라 참값에서는 늘 거짓이었다. 위 주석 참조. */
      const halted = false;
      const team = teamOfRaw(raw);
      const tagOrd = tagOrdinals.get(`${raw}|${unit}`);
      const typeList = buildsByType.get(`${raw}|${unit}`) ?? [];
      const myOrd = typeList.indexOf(i);
      /* 태그를 모르면 대표 하나만(지적: 해처리 생산·업그레이드에 모든 해처리가
         아이콘) — 같은 종류 전부에 달면 어디서 하는지가 아니라 "다 한다"로 읽힌다.
         대표는 그 종류에서 가장 오래된, 지금 살아 있는 건물(대개 본진 쪽)이다. */
      const repOrd = typeList.findIndex((bi) => {
        const [s2, , , , , g2] = buildsSrc[bi];
        return s2 <= t && !((g2 ?? 0) > 0 && t >= (g2 ?? 0));
      });
      /** 이 건물의 참값 태그 — 자리로 찾는다(위 bldTagAt 주석). */
      const myTag9 = bldTagAt.get(
        `${raw}|${unit}|${Math.round(bx + footDx(unit))}|${Math.round(by + footDy(unit))}`,
      );
      const producing = !razed && (prodByRawType.get(`${raw}|${unit}`) ?? [])
        .some(([ps, tag, psec]) => {
          /* **뽑는 내내** 켜진다(요청) — 창은 [완성−생산시간, 완성+여운]이다.
             여태 [완성, 완성+4초]라, 정작 유닛을 만들고 있는 동안은 건물이
             꺼져 있고 다 나온 뒤에야 불이 들어왔다. */
          if (!(t >= ps - psec && t - ps <= PROD_FLASH_SEC)) return false;
          /* ★ 둘 다 참값 태그면 **그대로 맞댄다**(위 bldTagAt 주석) — 순번
             어림을 지나지 않으므로 어긋날 자리가 없다. */
          if (tag > 0 && myTag9 !== undefined) return tag === myTag9;
          // 태그를 알면 그 순번의 건물만(요청) — 모르면 대표 건물만(지적).
          if (!tag || !tagOrd) return myOrd === repOrd;
          const ord = tagOrd.get(tag);
          return ord === undefined || ord === myOrd;
        });
      // 연구 중(요청) — 이 건물에서 하는 연구가 지금 창 안에 시작돼 있나. 어느
      // 건물인지는 안 남으므로 대표 건물에만 단다(지적).
      const hallLike = unit === "Lair" || unit === "Hive" ? "Hatchery" : unit;
      /* ★ 어느 건물인가는 이제 **태그가 말한다**(덤프 판 7) — 연구 줄에 건물
         태그가 실려 오면 그 건물 하나만 켠다. 안 실려 오는 판(6 이하)이나 태그가
         0인 줄은 여태처럼 대표 하나만 켠다: 아는 척하는 대신 하나만 고르는 어림이다.
         판정을 .some **안**으로 넣는다 — 연구마다 태그가 다를 수 있어, 밖에 두면
         태그가 있는 줄까지 대표 어림에 묶인다. */
      const researching = !razed
        /* ★ 창은 **완성 시각 앞쪽**이다(지적: "건물 활성효과 타이밍이 안맞음 …
           켜져야하는데 안켜짐 — 업글보다 효과가 느린듯") ─────────────────────
           자취에 실리는 시각(us)은 업그레이드가 **실제로 올라간 순간**, 곧
           연구가 끝난 때다(덤퍼 주석: "언제 끝났는지가 그대로 나온다"). 그런데
           창을 [us, us+90]으로 잡고 있었다 — 연구가 **끝난 뒤** 90초 동안 불이
           드는 셈이라, 화면에서는 정확히 한 연구 길이만큼 늦었다.
           [us−90, us]로 뒤집는다. 이제 불이 꺼지는 순간이 곧 연구가 끝난 순간이다. */
        && (upsByRaw.get(raw) ?? []).some(([us, name, utag]) =>
          RESEARCH_BUILDING[name] === hallLike && t < us && us - t <= RESEARCH_SEC
          && (utag > 0 && myTag9 !== undefined ? utag === myTag9 : myOrd === repOrd));
      // 이름 창 = 착공 직후 잠깐뿐(요청) — 그 뒤 공사 중에는 도형+망치이고, 생산·
      // 연구 중에도 이름 대신 라임 글로우가 말한다(요청: "생산중인 건물은 이름을
      // 띄우지 말고 액티브").
      // 시작 건물은 액티브도 없다(요청: 처음 등장하는 건물·유닛은 액티브 안 주기).
      // (요청) 착공 직후 이름 창도 걷었다 — 모델이 정체를 말한다.
      const activeBuild = false;
      // 차례 계산에서 빠졌지만(지적: 무조건 신규 건물 우선) 판정 기반은 남겨둔다.
      void activeBuild;
      /* 미세 박동(요청: 유닛 뽑거나 업그레이드 중인 건물은 아주 미세하게 박동) —
         게임 시간 1.6초 주기로 2.5%만 부풀었다 준다. 살아 일한다는 기색만 내고
         시선을 끌 만큼은 아니다. 캔버스 전환 때 끊겼던 심장 뛰기의 계승이다. */
      /* (걷어냄·요청: "건물 활성 효과 다 되면 건물 바운스 모션 제거해주고")
         — 생산·연구 중인 건물을 1.6초 주기로 2.5% 부풀렸다 줄이던 미세 박동이다.
         그 몫은 이제 **창·플라즈마·아가리의 불빛**이 맡는다(op.lit). 크기가
         흔들리면 나란히 선 건물들의 틈이 함께 흔들려, 불빛보다 먼저 눈에 띄었다. */
      const pulse = 1;
      /* (캔버스 전환 둘째 판·요청: 건물도 캔버스로) — 이름 창·아이콘이 다 걷힌
         건물 마커는 도형 하나라, 자리·상자·차례 계산만 그대로 두고 그리기는
         unitOps로 보낸다. DOM에는 효과(전투 불꽃·마법·핵)만 남는다(요청). */
      const shapeKind = SHAPE_KIND[unit];
      /* 부속건물도 제 모델이면 보통 건물과 같은 자리 규칙이다(요청: 부속건물 모델링)
         — + 글자 시절의 스넉 오프셋(-1.6, +0.4)은 모델 없는 폴백에만 남는다. */
      const addonPlus = ADDONS.has(unit) && !shapeKind;
      const fp2 = FOOTPRINT[unit] ?? [3, 2];
      const centerX = bx + footDx(unit);
      const centerY = by + footDy(unit);
      /* 시점 보기 — 건물은 **밝힌 자리면 잔상으로 남는다**(요청: 원작대로 3단).
         원작이 안개 속에 기억해 두는 것이 정확히 건물이다: 한 번 본 적 건물은
         그 자리에 그대로 그려지고(지금 없어졌어도), 지금 보이는 것과는 밝기로
         갈린다. 한 번도 못 본 자리(0단)면 아예 안 그린다.
         ★ 제 팀 건물은 늘 제 밝기다 — 시야 밖에 있어도 제 것은 다 안다. */
      /* 잔상은 **본 적이 있는 것**만이다(지적: "시야가 아닌 잔상위치에 새
         건물 짓는게 보임") — 밝힘 이력만 보면 "저 자리를 가 봤다"까지만 알고,
         그 뒤에 적이 거기 올린 새 건물까지 함께 보였다. 이 건물이 생긴 뒤에도
         눈이 닿은 적이 있어야(seenSince) 기억으로 남는다. */
      const bldSeen9: 0 | 1 | 2 = fogOn && team !== viewTeam
        ? (seenAt(centerX, centerY) === 2 ? 2
          : seenSince(centerX, centerY, sec) ? 1 : 0) : 2;
      if (bldSeen9 === 0) return null;
      /* ★ **떠 있는 건물은 유닛 규칙을 탄다**(요청: "떠있는 건물도 시야 적용
         필요") — 잔상(1단)은 '거기 그대로 서 있을 것'을 기억하는 표시라,
         움직이는 것에는 거짓말이 된다. 이륙한 건물은 지금 나는 자리가 안
         보이면 그냥 사라져야 한다(원작도 그렇다: 옛 자리의 스냅샷은 남고
         실제 건물은 안개 속으로 사라진다 — 그 스냅샷은 이 줄이 아니라 떠난
         자리 줄이 그린다).
         centerX·centerY는 위 비행 보간을 이미 먹은 **지금 나는 자리**다. */
      if (fogOn && team !== viewTeam && afloat && bldSeen9 < 2) return null;
      /** 잔상이면 한 단 어둡게 — 지금 보이는 건물과 기억만 남은 건물을 가른다. */
      const fogDim9 = bldSeen9 === 1 ? 0.55 : 1;
      /** **잔상은 멈춘 그림이다**(요청: "안개에 남은 시야에 없는 잔상에는
       *  애니메이션이나 각종 효과 제거") — 잔상은 '마지막으로 봤을 때 거기
       *  이런 게 있었다'는 기억이지 지금 보고 있는 것이 아니다. 그런데 불빛이
       *  깜빡이고 톱니가 돌고 포탑이 적을 겨누면, 안 보이는 것을 실시간으로
       *  들여다보는 꼴이 된다 — 안개로 가린 뜻이 사라진다.
       *  그래서 잔상에서는 다음을 통째로 끈다: 생산·연구 불빛, 회전 부품,
       *  포탑 조준, 성큰 혓바닥, 손상 효과(불길·연기·피), 체력바, 피격 불티·
       *  실드막, 그리고 방어 사격. */
      const bldFrozen9 = bldSeen9 !== 2;
      /* 그리는 상자는 발자국이 아니라 **몸 상자**다(요청: 건물 틈) — 원작은 건물마다
         자리 상자(발자국, 타일 배수)와 몸 상자(units.dat dimensions)를 따로 들고,
         둘의 차이가 곧 건물 사이의 틈이다. 네 변이 저마다 달라(배럭 좌16·우8·상8·
         하16px) 상자 중심도 발자국 중심에서 조금 밀린다. 그래서 나란히 선 건물
         사이가 종류·배치에 따라 열리고 닫힌다(docs/note-building-gaps.md).
         ⚠ 예전 확정("바닥 폭 = 타일 발자국")을 이 요청이 뒤집는다 — 발자국을 꽉
           채워 그리면 틈이 원리적으로 안 생긴다. */
      const [boxW, boxH, boxOx, boxOy] = buildingBox(unit);
      const bodyX = centerX + boxOx;
      const bodyY = centerY + boxOy;
      const anchorX = bodyX - (addonPlus ? 1.6 : 0);
      const anchorY = bodyY + (addonPlus ? 0.4 : 0)
        + (!addonPlus ? (shapeKind ? -riseOf(unit) / 2 : boxH * 0.1) : 0);
      /* 이 건물이 땅에 닿는 줄(타일 y) — 지면선·가로 자리·그림자가 다 이걸 쓴다.
         ★ 가스 건물 셋만 **발자국** 아랫변이다(지적: "리파이너리 간헐천과 위치가
           반칸정도 어긋나(건물이 오른쪽). 어시밀레이터 익스트랙터는 간헐천보다
           반칸 위로 올라가있음") — 다른 건물은 몸 상자(units.dat)의 아랫변에
           앉는다. 그 상자는 발자국보다 작고 건물마다 다르게 작아서, 그 차이가 곧
           건물 사이의 틈이다(docs/note-building-gaps.md). 보통은 그게 옳지만
           가스 건물만은 **제 발자국이 곧 간헐천의 발자국**이라, 어시밀레이터처럼
           몸 상자가 아래로 0.25타일 짧은 건물은 그만큼 간헐천 위로 떠 보인다. */
      const GAS_ON_GEYSER = unit === "Refinery" || unit === "Assimilator"
        || unit === "Extractor";
      const groundYT = GAS_ON_GEYSER ? centerY + fp2[1] / 2 : bodyY + boxH / 2;
      /* 가로 자리는 **지면선에서** 잰다(같은 지적의 나머지 절반: 건물이 오른쪽) —
         입체 보기의 posFrac은 사다리꼴 수렴을 먹이므로 같은 x라도 y가 다르면
         화면 x가 달라진다. 건물 앵커(anchorY)는 모델 높이의 절반만큼 위라, 지도
         가장자리에 선 건물일수록 그 수렴이 크게 실려 제 발자국에서 옆으로 밀렸다.
         (공사 고치가 액자 오른쪽에 그려지던 것과 **같은 병**이다 — 그쪽은 이미
         이 규칙으로 고쳐 두었는데 완성 건물에는 안 옮겨져 있었다.)
         건물이 놓인 곳은 지면선이므로 가로는 거기서 재고, 세로만 앵커에서 잰다. */
      const [fxF] = posFrac(bodyX, groundYT);
      const [, fyF] = posFrac(anchorX, anchorY);
      const mkK = pitchK(centerY);
      /* 나이는 **진짜 동점만** 가른다(수리: 겹치는 건물의 앞뒤가 뒤바뀜 · 소환구가
         앞 건물에 안 가려짐) — 한 타일이 Z_TILE(800)이고 나이 항은 60까지라,
         아랫변이 0.075타일보다 벌어져 있으면 자리가 언제나 이긴다. 예전에는 한
         타일이 80인데 나이가 30까지여서, 0.375타일 안에 붙은 건물끼리 나이가
         앞뒤를 뒤집었다. */
      /* 평면(90도)도 같은 자로 잰다(지적: 자원·건물 가림) — 여태 평면에서는
         건물끼리 **나이 순**이라, 뒤에 늦게 지은 건물이 앞 건물을 덮었다.
         뜬 건물만 층이 다르다 — 그건 나이가 아니라 공중이므로 air로 올린다. */
      const z = 1000 + Math.round((bodyY + boxH / 2) * Z_TILE)
        + Math.min(60, Math.round(sec / 45));
      /* 뜬 건물도 **불투명**하다(지적: "띄운건물이 페이드아웃되는 현상") —
         여태 0.75를 곱해, 뜬 동안 내내 25% 비쳤다. 반투명은 "떠 있다"를 말할
         길이 그것뿐이던 시절의 표시다. 이제는 몸이 실제로 떠오르고(liftK) 그
         아래 땅에 그림자가 깔리므로 뜬 것이 자리로 읽힌다 — 그런데도 계속
         비치면 그건 '떠 있다'가 아니라 '사라지는 중'으로 보인다.
         페이드(fade)는 그대로 남긴다: 그건 정말로 걷히는 건물의 것이다. */
      /* 시점 보기의 **잔상**은 여기서 흐려진다(위 bldSeen9 주석) — 밝혀 뒀지만
         지금은 안 보이는 적 건물은 '기억'이라 반쯤만 그린다. */
      const alpha = fade * fogDim9;
      const color = modeColor(raw, team);
      if (addonPlus) {
        // 모델 없는 부속건물 폴백 — + 하나(캔버스 전환 첫 판이 모델까지 +로 덮던
        // 것을 바로잡았다: 이제 여섯 애드온 다 모델이 있어 여긴 안전망이다).
        unitOps.push({
          // 폴백 + 글자도 같은 자로(전수조사) — 고정 7/11px이었다.
          fx: fxF, fy: fyF, z, kind: "", sizePx: tilePx * 2 * mkK * pulse,
          color, alpha, textGlyph: "+", noShadow: true,
        });
        return null;
      }
      /* 바닥은 실제 발자국 그대로(요청: 건물 바닥크기를 캔버스에 맞추기) — 기지를
         1.3배 부풀리던 보정을 걷었다: 바닥 폭이 타일 발자국과 같아야 하고, 높이는
         모델 제 비율이 바닥 폭을 따라 정한다(아래 fitWidth). */
      /* 애드온의 1.35배 뻥튀기는 걷었다 — "작은 부속 모델이 상자를 덜 채워
         왜소하다"는 지적을 상자째 키워 때우던 보정인데, 이제 그리기 단계가 잉크
         폭을 재서 발자국을 채우므로(지금은 BLD_NORM) 상자는 제 발자국(2×2) 그대로
         두면 된다. 그대로 두면 부속만 발자국보다 28% 넓게 그려진다. */
      const wTiles = boxW * (shapeKind ? 1 : 0.8);
      const hTiles = wTiles * ((boxH + (shapeKind ? riseOf(unit) : 0)) / boxW);
      const wFrac = (wTiles / grid.width) * mkK;
      const hFrac = (hTiles / grid.width) * mkK;
      const race2 = raceOfName9(unit) ?? bases.find((b) => b.key === raw)?.race;   // 건물의 종족은 이름이 정한다(마인드 컨트롤된 드론의 건물)
      /* (걷어냄) **합성 건설 SCV** — 공사 중 건물 귀퉁이에 SCV 한 기를 지어
         세우던 자리다. 유추 시절에는 어느 일꾼이 짓는지 알 수 없어 필요했지만,
         참값에는 **그 SCV가 제 자취로 이미 거기 서 있다**. 겹쳐 그리면 일꾼이
         둘로 보인다.
         게다가 이 합성 SCV는 지금 **영영 안 사라졌다**: 완공 뒤 걷는 조건이
         builderLeave(일꾼의 건설 증거 f=2)와 bldWork에 달려 있었는데, 참값에는
         그 증거 갈래가 없어 둘 다 늘 빈손이었다. 그래서 지은 건물마다 SCV 한 기가
         경기 끝까지 붙어 있었다(지적: "건설현장에 SCV들이 남는다"). */
      if (raising) {
        // 공사는 종족 공용 모델(고치·소환구·공사장)이 말한다.
        /* 저그 고치는 크기 자체가 두근거린다(요청: 확대 바운스) — 10Hz t의 사인
           박동. 스프라이트는 2px 칸 양자화라 두어 가지 크기를 오가며 캐시된다.
           그리고 게임처럼 단계 성장(재지적: 너무 작음): 공사 진행에 따라 0.7배에서
           1.5배까지 세 단계로 자란다. */
        const prog = Math.min(1, (t - sec) / bldNeed);
        // 시작을 크게(재지적: 처음에 너무 작음 — 훨씬 크게 시작) — 0.7 → 1.0.
        /* 자라되 완성 건물을 넘지 않는다(전수조사: 1.0→1.5배라 4타일 해처리의
           고치가 6.4타일 — 다 지어진 건물보다 컸다). 발자국의 0.8 → 1.0으로. */
        /* 크기는 **처음부터 다 지어진 건물 크기**다(요청: "크기는 처음부터
           건물크기로") — 0.8 → 0.9 → 1.0으로 자라게 뒀더니 변태·공사 내내 고치가
           제 자리보다 작아, 옆의 다 지어진 건물과 견주면 다른 건물처럼 보였다.
           원작의 고치도 처음부터 그 건물 자리를 다 차지한다. 두근거림(beat)만
           남긴다 — 그건 크기가 아니라 살아 있다는 표시다. */
        /* ★ 자라는 단계를 되살린다(지적: "공사고치 작았다가 커지는 단계가
           없어졌네") — 다만 앞서 이걸 걷은 까닭도 그대로 살린다: 그때 흠은
           '자란다'가 아니라 **끝까지 작았다**는 것이었다(0.8 → 1.0이라 공사 내내
           옆의 다 지어진 건물보다 작았다).
           그래서 **일찍 다 자란다**: 0.62에서 시작해 공정의 75%에서 1.0(발자국을
           꽉 채우는 크기)에 닿고, 남은 사분의 일은 제 크기로 두근거리기만 한다.
           자라는 결은 처음이 빠르고 끝이 느긋한 쪽이 살아 있는 것처럼 보인다
           (제곱근). */
        /* ★ 자라는 것은 **드론에서 변태할 때뿐**이다(지적: "드론에서 변태시엔
           커져야하고 그냥 건물간 변태는 그대로") — 레어·하이브·성큰처럼 이미 선
           건물이 다른 건물로 바뀌는 자리는 크기가 그대로여야 한다: 다 자란 몸이
           갑자기 쪼그라들었다 도로 커지면 그건 성장이 아니라 튐이다. */
        /* ★ 단계별 확대폭을 넓힌다(지적: "마지막 커졌을때 크기가 실제 건물에
           비해 너무 작음 단계별 확대폭을 늘려야할듯") — 0.62 → 1.00이던 것을
           0.55 → 1.20으로. 끝값이 1.00이면 고치의 상자가 다 지어진 건물의 상자와
           **꼭 같은데**, 화면에서 같아 보이지 않는 까닭은 그 상자를 채우는 정도가
           다르기 때문이다: 완성 건물은 제 발자국을 넘겨 그리는 종류가 많고
           (BLD_FILL_TARGET — 해처리 1.14 · 레어 1.36 · 하이브 1.45), 고치는 늘
           1.00이다. 그래서 해처리 자리의 고치는 다 자라도 그 건물보다 한참 작았다.
           끝을 1.20으로 올려 그 몫을 메우고, 시작도 함께 내려 자라는 폭이 실제로
           보이게 한다(0.55 → 1.20이면 두 배가 넘는다). */
        const grow9 = Math.min(1, prog / 0.75);
        const stage = BLD_FROM_BLD.has(unit) ? 1 : 0.55 + 0.65 * Math.sqrt(grow9);
        const beat = race2 === "저그" ? stage * (1 + 0.06 * Math.sin(t * 5.2)) : 1;
        /* 공사 모델은 바닥 맞춤(지적: 소환구보다 훨씬 아래쪽에 실제 건물이 생긴다)
           — 완성 모델은 '들어올린 칸'의 바닥 = 발자국 바닥에 앉는데, 소환구·고치는
           제 작은 상자가 칸 중심(위로 들어올린 앵커)에 걸려 바닥이 발자국보다 위에
           떴다. 상자 바닥을 발자국 바닥에 맞춘다. */
        // 소환구는 정사각 상자(재재지적: 3D에서 찌그러짐) — 어디서도 안 눌린다.
        /* 소환구 축소 + 더 띄우기(요청) — 상자 3.4 → 2.4타일이고, 발자국
           바닥에서 0.6타일 위로 띄운다(워프 중인 건물은 아직 땅에 안 앉았다). */
        const modelHT = race2 === "프로토스" ? WARP_TILES
          : ((hFrac * grid.width) / mkK) * beat;
        /* 고치 치우침(재지적) — +0.25타일 보정 대신 모델 자체 무게중심을 상자
           가운데로 옮겨 보정 없이 맞는다. */
        /* 발자국 한가운데가 아니라 조금 아래(앞)로(요청) — 그림자를 줄여 발치에
           맞춘 것과 같은 결이다. 사선 시점에서 상자 중앙에 놓으면 모델이 제
           발자국보다 뒤로 물러나 떠 보인다. */
                const bAnchorY = bodyY + boxH / 2 - modelHT / 2 + CONSTRUCT_DROP
          - (race2 === "프로토스" ? WARP_LIFT : 0);
        /* 가로 자리는 **지면선에서** 잰다(지적: "공사 고치 아직도 액자의 오른쪽에
           그려져있어") — posFrac은 입체에서 사다리꼴 수렴을 먹이므로 같은 x라도
           y가 다르면 화면 x가 달라진다. 공사 모델의 y 기준(bAnchorY)은 모델 높이의
           절반만큼 위라, 고치처럼 키가 큰(정규화 2.86배) 것일수록 그 수렴이 크게
           실려 발자국 액자에서 옆으로 밀려났다. 액자가 놓인 곳은 지면선이므로
           가로는 거기서 재고, 세로만 모델 앵커에서 잰다. */
        const [bfxF] = posFrac(bodyX, groundYT);
        const [, bfyF] = posFrac(bodyX, bAnchorY);
        unitOps.push({
          fx: bfxF, fy: bfyF, z,
          /* 짓는 중에도 집힌다(요청: 건설 중 상태에서도 클릭 가능) — 열쇠는 완성
             뒤와 같은 자로 지어, 다 지어져도 팝업이 그대로 이어진다. */
          pickKey: `b${raw}|${unit}|${Math.round(x * 4)}|${Math.round(y * 4)}`,
          pickName: unit, pickRaw: raw, pickBld: true, pickX: x, pickY: y,
          pickRep: myOrd === repOrd, pickTag: myTag9,
          /* 종류별 배수는 **제 모델을 그릴 때만**(테란 공사) 얹는다 — 저그 고치·
             프로토스 소환구·폴백 공사장은 종류를 안 가리는 공용 모델이라, 거기에
             스파이어의 몫을 얹으면 고치만 커진다. */
          drawK: BLD_DRAW_K
            * (race2 === "테란" ? (BLD_DRAW_TUNE[shapeKind] ?? 1) : 1),
          pickWip: true,
          /* 상태 줄 — 테란은 '건설 중단'을 따로 말한다(요청): 일꾼이 떠나거나
             죽어 공사가 그 진행률에 멈춰 선 동안이다. */
          pickState: race2 === "저그"
            ? `변태 중 ${Math.round(prog * 100)}%`
            : `${halted ? "건설 중단" : "건설 중"} ${Math.round(prog * 100)}%`,
          /* 테란 공사는 제 건물 모델을 아래부터 드러낸다(요청: "3단계로 하고 실제
             모델의 부품을 일부만 표현하다가 완성되는 형태로. 아래쪽 부품부터 →
             점점 위로"). 뼈대·크레인 한 벌(scaffold)을 모든 건물에 똑같이 쓰던
             것을 걷는다 — 무엇을 짓는지 완성될 때까지 알 수 없었다.
             모델이 없는 건물(부속 등 폴백)만 예전 공사장으로 떨어진다. */
          kind: race2 === "저그" ? "cocoon"
            : race2 === "프로토스" ? "warpin"
              : (shapeKind || "warpin"),   // 모델 없는 테란 건물(부속 폴백)은 공사장 대신 프로토스식 워프인 판을 빌린다 — 공사장 모델은 걷었다(요청)
          /* 아래 부품부터 다섯 칸에 나눠 솟는다(요청: 3단계 부족 시 5단계) —
             진행률을 그대로 칸으로 바꾼다. 마지막 칸(=BUILD_STAGES)이 완성 모델
             이라, 다 짓기 전에 완성형이 서 버리지 않게 진행률 1 미만은 한 칸
             아래로 묶어 둔다. 단계가 굽기 캐시 열쇠에 들어가므로 판은 단계마다
             한 번만 구워진다(프레임 비용 없음). */
          ...(race2 === "테란" && shapeKind
            ? { buildStage: Math.max(1, Math.min(BUILD_STAGES - 1,
              Math.ceil(prog * BUILD_STAGES))) }
            : {}),
          // 공사 모델도 45도 요잉(지적) + 종류별 보정(지적: 테란 공사장 반시계 90).
          rotDeg: buildingYawOf(),
          viewYaw: viewYawOf(centerX, centerY), flat: !pitched, pitch: pitched,
          // 공사 모델도 완성 건물과 같은 지면선에 선다.
          baseFy: posFrac(bodyX, groundYT)[1],
          // 공사 모델도 완성 모델과 같은 폭 기준 — 바닥 폭이 발자국과 같아야 한다.
          /* 소환구는 크기 통일(재지적: 게임에서도 모든 건물이 같다) — 발자국과
             무관하게 소형 기준 고정. */
          sizePx: 0,
          wFrac: race2 === "프로토스" ? (WARP_TILES / grid.width) * mkK : wFrac * beat,
          hFrac: race2 === "프로토스" ? (WARP_TILES / grid.width) * mkK : hFrac * beat,
          boxFit: "meet", fitWidth: true,
          /* 소환구는 떠 있다(요청: 그림자 작게 표현해 공중 느낌) — 발자국 폭의
             절반짜리 작은 타원만 바닥에 깔린다. 몸은 WARP_LIFT만큼 떠 있으니
             그 틈이 곧 높이로 읽힌다. 저그 고치·테란 공사장은 땅에 앉는다. */
          ...(race2 === "프로토스"
            ? { groundShadow: true, footRatio: 0.5 }
            : {}),
          color, alpha, noShadow: true,
        });
        /* 공사 애니(요청) — 모델은 캐시 스프라이트라 못 움직이니 CSS 오버레이가
           맡는다: 테란 빨간 불 깜빡, 저그 심장 박동, 프로토스 소환 글로우. */
        /* 스파크 자리(재지적: 일꾼 주변에 작게) — 테란은 SCV가 붙는 건물
           왼쪽 아래 모서리에서 인다. 저그 박동·토스 글로우는 가운데 그대로. */
        /* 모서리에 바짝(재지적: 일꾼이 너무 떨어져 있나) — 0.4 → 0.9타일 안쪽,
           반 타일 위로: 불티가 공사장 몸체에 반쯤 얹힌다. */
        /* 저그 고치도 모델 앵커에(재지적: 고치와 안의 박동 빛 중앙이 안 맞음) —
           고치 모델은 무게중심 보정(+0.25타일)과 바닥 맞춤을 받는데 글로우만
           발자국 가운데였다. 소환구와 같은 식으로 셋 다 제 모델에 묶는다. */
        /* 테란 일꾼은 네 귀퉁이를 돈다(요청: "프로브가 4귀퉁이를 돌면서 공사") —
           여태 왼쪽 아래 한 자리에 붙박이로 서서 용접했다. 건물 번호로 시작
           귀퉁이를 흩어 두고(같은 기지의 공사가 나란히 같은 자리에서 시작하면
           눈에 띄게 어색하다) 6초마다 시계 방향으로 옮긴다.
           ⚠ 원작의 실제 순회 패턴은 아직 대조 전이다(지적: "이 패턴은 공식문서
           조사 필요") — 조사가 오면 이 자리만 바꾸면 된다. */
        /* 불티 자리 — 합성 SCV와 **같은 차례·같은 주기**다(지적: 둘이 따로 돌았다).
           SCV보다 조금 안쪽에 두어 불티가 몸에 반쯤 얹힌다. */
        /* ★ 불티는 **진짜 짓는 일꾼 곁**에서 튄다(지적: "테란 건설시 스파크랑
           일꾼 위치 안맞음") ────────────────────────────────────────────
           여태 자리는 건물 번호로 시작 귀퉁이를 흩고 6초마다 시계방향으로 옮기는
           **지어낸 순회**였다. 합성 SCV를 세우던 시절에는 그 합성이 같은 셈으로
           돌아 둘이 맞았는데, 합성을 걷고 참값 일꾼이 제 자취대로 서게 된 뒤로는
           맞을 근거가 사라졌다 — 불티는 귀퉁이를 도는데 일꾼은 딴 데 서 있다.
           이제 발자국 곁(반폭 + 1.5타일)에 선 그 임자의 일꾼 중 가장 가까운 것을
           찾아 그 자리에서 튀긴다. 못 찾으면(자취가 없는 옛 기록) 옛 순회로
           물러난다 — 아무 데서도 안 튀는 것보다는 낫다. */
        const bldr9 = race2 !== "테란" ? null : ((): { x: number; y: number } | null => {
          const rr9 = Math.max(boxW, boxH) / 2 + 1.5;
          let best9: { x: number; y: number } | null = null;
          let bd9 = rr9 * rr9;
          for (const wk9 of workerSpots) {
            if (wk9.raw !== raw) continue;
            const dx9 = wk9.x - centerX;
            const dy9 = wk9.y - centerY;
            const d9 = dx9 * dx9 + dy9 * dy9;
            if (d9 < bd9) { bd9 = d9; best9 = wk9; }
          }
          return best9;
        })();
        const CORNER_SEC = 6;
        const cIdx = (Math.floor(t / CORNER_SEC) + i) % 4;
        const cDx = (cIdx === 0 || cIdx === 3 ? -1 : 1) * (boxW / 2 - 0.7);
        const cDy = (cIdx === 0 || cIdx === 1 ? 1 : -1) * (boxH / 2 - 0.5);
        const bfxX = race2 === "테란" ? (bldr9 ? bldr9.x : bodyX + cDx) : bodyX;
        const bfxY = race2 === "테란" ? (bldr9 ? bldr9.y : bodyY + cDy)
          : bodyY + boxH / 2 - modelHT / 2;
        /* 멈춰 선 공사에는 불티가 없다(요청: 테란 건설 중단) — 아무도 안 붙어
           있다. 잔상에도 없다(지적: "잔상부분에 다른 유닛이 소환구 소환한 css
           효과가 나오는듯") — 기억으로 남은 자리에서 용접 불티가 튀고 소환구가
           빛나면, 안 보이는 곳의 공사를 실시간으로 들여다보는 꼴이 된다. */
        if (!qBuildFx || halted || bldFrozen9) return null;
        dom.push({
          k: "buildfx", key: `bfx-${i}`, x: bfxX, y: bfxY, z: z + 1,
          race: race2 === "저그" ? "zerg" : race2 === "프로토스" ? "toss" : "terran", i,
          ws: race2 === "테란" ? Math.max(0.3, tilePx / 5) : 0,
        });
        return null;
      }
      /* 건물 체력과 '맞은 순간'(요청: 피격 표현 재검토) — 자취가 내려간 마지막
         변곡점이 곧 이 건물이 맞은 때다. 체력바와 피격 불티가 같은 자를 쓴다. */
      /* ★ 이 건물의 **생애 줄**을 한 번만 고른다 — 체력(아래)과 표적(방어 사격)이
         같은 줄을 본다. 고르는 셈은 t를 안 보므로 한 번 고른 것을 기억해 둔다
         (위 bldRecMemo). 여기로 올린 까닭은 표적도 이 줄에 실려 있어서다. */
      const rec9 = ((): {
        born: number; tag: number; hp: Ticks; tgt?: Ticks;
      } | undefined => {
        const k9 = `${raw}|${Math.round(x)}|${Math.round(y)}`;
        const arr = entBldHp.get(k9);
        if (!arr) return undefined;
        const ck9 = `${k9}|${sec}`;
        let r9 = bldRecMemo.get(ck9);
        if (!r9) {
          r9 = [...arr].filter((r2) => r2.born <= sec + 5)
            .sort((a2, b2) => b2.born - a2.born)[0] ?? arr[0];
          bldRecMemo.set(ck9, r9);
        }
        return r9;
      })();
      const bldHp = ((): { frac: number | undefined; hurt: number } => {
        const rec = rec9;
        if (!rec) return { frac: 1, hurt: -99 }; // 기록 없는 성한 건물도 만피 바(요청).
        /* 체력은 실제 수치다(지적) — 만피는 건물 표에서 가져와 나눈다. */
        const bs0 = BLD_STATS[unit];
        const full0 = bs0 ? bs0[0] + bs0[1] : 850;
        let now0 = full0;
        let hurt = -99;
        for (let hi3 = 0, hn3 = tkN(rec.hp); hi3 < hn3; hi3 += 1) {
          const hs3 = tkT(rec.hp, hi3);
          if (hs3 > t) break;
          const hv3 = tkV(rec.hp, hi3);
          if (hv3 < now0) hurt = hs3;
          now0 = hv3;
        }
        return { frac: Math.max(0.04, Math.min(1, now0 / Math.max(1, full0))), hurt };
      })();
      /* 맞는 건물에도 불티(요청: 유닛·건물 피격 표현 재검토) — 여태 건물은 피격
         연출이 아예 없어, 해처리가 깎이는 동안 화면에서 터지는 것은 때리는 쪽
         유닛의 연기뿐이었다. 그래서 "피해 객체와 멀리 떨어진 곳에서 나온다"로
         보였다. 크기는 발자국에 매어(폭의 0.3배) 작은 건물에서 과하지 않게. */
      const bldTile9 = mapW9 / grid.width;
      /** 발자국 폭(렌즈 px) — 실드막·불티·상처의 크기와 높이가 이 한 자를 쓴다. */
      const bwPx9 = fp2[0] * bldTile9;
      /* ★ **뜬 건물이 화면에서 떠 있는 몫(px)** — 한 자리에서 내어 이 건물의 모든
         효과가 같은 높이를 쓴다(지적: "공중 건물의 피격 효과가 땅에 나오는 경우
         없는지 확인 좀") ────────────────────────────────────────────────────
         확인해 보니 있었다. 피격 불티·실드막은 이 보정을 받고 있었는데(그 자리
         주석), **상처 효과**(불길·피·연기)만 발자국 한가운데에 못 박혀 있었다 —
         날아가는 커맨드센터의 불길이 그 아래 땅에서 타고 있었다.
         몸을 그리는 쪽과 같은 식이다(아래 op의 liftK). 값을 여기서 한 번만 내면 셋이 갈릴 일이
         없다(이 파일이 몇 번이고 데인 자리다: 같은 것을 두 곳에서 셈하면 언젠가
         갈린다). */
      /* ★ 높이는 **공중 유닛과 같은 자**다(요청: "건물끼리도 높이 같아야 하고
         공중 유닛과 같은 높이로 해 줘") ─────────────────────────────────────
         여기 있던 것은 `제 발자국 폭 × 0.55`라, 공중 유닛이 앓던 것과 **같은 병**
         이었다: 커맨드센터(4타일)가 배럭(4타일)과는 같아도 컨트롤타워 딸린
         스타포트와는 갈리고, 무엇보다 곁을 나는 레이스와 층이 달랐다.
         이제 airLiftPxOf 한 곳이 낸다 — 몸집도 종류도 안 탄다.
         ★ 갈래가 하나 더 있었다: 이 값은 **발자국 폭**(bwPx9)에 매였는데 몸을
           그리는 쪽(UnitLayer)은 **그린 상자 폭**(wPx = 발자국 × BLD_DRAW_K)에
           매여 있었다. 곧 효과와 몸이 애초에 서로 다른 높이에 있었다("같은 식"
           이라 적힌 주석이 사실이 아니었다). 절대 px 한 칸(airPx)으로 옮겨 그
           갈래까지 닫는다.
         둥실거림은 비율 그대로다(0.03/0.55 ≈ 5.5%). */
      const bFlyPx9 = afloat
        ? airLiftPxOf(centerY) * hover9 * (1 + 0.055 * Math.sin(t * 1.5)) : 0;
      /* 건물도 실드가 남았으면 막이 번쩍인다(요청) — 프로토스 건물은 전부 실드를
         지녔고, 자취는 체력+실드 합이라 남은 비율로 갈린다. */
      const bs9 = BLD_STATS[unit];
      const bShShare9 = bs9 && bs9[1] > 0 ? bs9[1] / (bs9[0] + bs9[1]) : 0;
      const bShieldUp9 = bShShare9 > 0 && (bldHp.frac ?? 1) > 1 - bShShare9 + 0.001;
      // 건물도 같은 잣대로 잠깐만(지적·요청) — 0.8 → 0.35 → 0.18초.
      /* 건물도 맞은 방향에 튄다(요청: "근접공격시 피격효과(건물포함, 방향주의)")
         — 저글링이 해처리를 물어뜯는 동안 불티가 늘 발자국 한가운데에서 텄다.
         붙어 있는 적 쪽 테두리로 옮긴다: 발자국 반쪽의 0.8배라 벽면 언저리다.
         가로세로가 다른 발자국이라 x·y에 각자의 몫을 곱한다. */
      /* ★ 건물 피격도 **캔버스 fx**로 옮겼다(요청: "프로토스 건물 유닛 피격시
         실드 남아있는 경우 실드로 방어하는 효과가 없어진듯한데 다시 복구") ─────
         없어진 것이 아니라 **덮여 있었다**. 이 자리는 렌즈 안의 DOM 스팬이었는데,
         렌즈는 will-change로 제 스태킹 컨텍스트라 그 안의 스팬은 zIndex와 무관하게
         유닛 캔버스(z 6000) **밑**에 깔린다. 유닛·건물 몸이 전부 그 캔버스로
         이관되면서, 건물 위에서 번쩍여야 할 실드막이 건물 그림 뒤로 들어가
         통째로 안 보이게 됐다(포톤 트레이서가 크립에 가려지던 것과 같은 사정).
         유닛 쪽 피격이 이미 걸어간 길 그대로 FxOp로 밀면 층이 바로 선다. */
      const bHitSrc9 = bldHp.hurt > -99 && t - bldHp.hurt <= 0.18
        ? hitSrcOf(rec9?.tag ?? 0, centerX, centerY) : null;
      const bHitDir9 = bHitSrc9?.dir ?? null;
      if (bHitSrc9 && !bldFrozen9) {
        const [bfx9, bfy9] = posFrac(centerX, centerY);
        const bw9 = bwPx9;
        /* 효과는 몸 위에서 — 건물 앵커는 발자국 한가운데인데 그려지는 몸은
           그보다 위로 선다. 발자국 폭의 0.3배면 대체로 몸통 언저리다.
           ★ **뜬 건물은 그만큼 더 위다**(지적: "떠있는 건물 공격시 … 높이 보정된
             결과에 맞게 트레이서 피격효과가 그려져야 할듯") — 아래 op의 liftK가
             몸을 그린 폭의 그 배수만큼 띄우는데(그 자리 주석), 불티는 발자국
             언저리에 그대로 남아 커맨드센터가 날아가는 동안 그 **밑에서** 텄다.
             같은 식을 쓴다. */
        const bLift9 = bw9 * 0.3 + bFlyPx9;
        if (bShieldUp9) {
          fxOps.push({
            kind: "shield", fx: bfx9, fy: bfy9, lift: bLift9,
            size: bw9 * 0.95, ph: (t - bldHp.hurt) / 0.55,
          });
        } else {
          /* 건물도 제 결로 튄다(요청: 종족별 피해 효과) — 테란은 불꽃, 저그는 피,
             프로토스는 실드가 다 깎인 뒤라야 여기 오므로 에너지다. 종족을 못
             찾은 옛 기록은 실드 유무로 가른다(프로토스 건물만 실드가 있다). */
          const bMat9: "bio" | "mech" | "toss" | "zerg" = race2 === "저그" ? "zerg"
            : race2 === "프로토스" || bShShare9 > 0 ? "toss"
              : race2 === "테란" ? "mech" : "mech";
          const bWpn9 = bHitSrc9.uk ? ATTACK_FX[bHitSrc9.uk] : undefined;
          fxOps.push({
            kind: "hit", fx: bfx9, fy: bfy9, lift: bLift9,
            // 건물도 같은 비(반지름 = 폭의 1/4 → size 0.69·K)로 — 옛 0.3은 거의 안 보였다.
            size: bw9 * 0.69, dist: bw9 * 0.4, mat: bMat9,
            ph: (t - bldHp.hurt) / 0.18,
            ...(bWpn9 ? { style: bWpn9 } : {}),
            ...(bHitDir9 ? { dx: bHitDir9[0], dy: bHitDir9[1] } : {}),
          });
        }
      }

      /* 다친 건물의 상처(요청: "원작 기준 조사해서 각 종족 건물 일정 체력이하에서
         상처효과 추가 — 테란 화재 저그 피 프로토스 연기?에너지?") ────────────
         갈래는 되물어 확인받았다: 테란 화재 · 저그 피 · **프로토스 연기**.
         ★ 원작이 실제로 하는 일(OpenBW bwgame.h의 update_unit_damage_overlay를
           읽고 확인했다 — 추측이 아니다):
             · 덧붙는 그림은 **종족을 안 가리고 불꽃(Flames) 하나**다. 저그의 피도
               프로토스의 에너지도 원작에는 없다 — 해처리도 넥서스도 똑같이 탄다.
             · 붙는 때는 만피의 2/3에서 시작해 1/3에서 가장 심해진다:
                 두몫 = 만피 − 만피/3,  칸 = 두몫/(자리수+1)
                 단계 = (지금체력 − … − 만피/3 − 1) / 칸   (작을수록 심하다)
               곧 2/3 위에서는 아무것도 없고, 1/3 아래는 최대다.
             · 불꽃이 붙는 **자리 수**는 건물마다 다르다(이미지의 부착점 수).
           그래서 '일정 체력 이하'라는 요청의 문턱은 원작 그대로 2/3·1/3 두 단으로
           잡고, **그림만** 요청대로 종족별로 가른다(원작과 다른 대목이라 여기 적어
           둔다 — 되돌리려면 세 클래스를 하나로 합치면 된다).
         크기는 발자국에 매고, 자리는 발자국 안에 결정적으로 흩는다(프레임마다
         떨리면 안 된다 — 자리는 건물 번호의 순수 함수다). */
      const woundLv = (bldHp.frac ?? 1) <= 1 / 3 ? 2 : (bldHp.frac ?? 1) <= 2 / 3 ? 1 : 0;
      /* 건물 손상 효과만 사양 '중'부터다(요청) — 불길·연기·피는 건물마다 스팬을
         여럿 물고 애니도 무겁다. 그리고 그 건물이 얼마나 상했는지는 체력바가 이미
         말하고 있어, 없어도 상황이 안 읽히지는 않는다. */
      const bldWoundFx: DomFx9 | null = qBuildFx && !bldFrozen9 && woundLv > 0 && !raising
        && (goneEff === 0 || t < goneEff) ? {
          /* 자리는 몸 가운데·그 위(요청: 건물 아래에 깔려 안 보임) — 발자국 폭의 0.3만큼 띄워 몸통 위에 앉힌다.
             수는 상처가 심할수록 많다(요청): 1단 2개 · 2단 5개. 그리는 쪽은 캔버스 위 층(dieFx9)에 둔다. */
          k: "wound", key: `bw-${i}`, x: centerX, y: centerY, z: z + 4,
          lift: bFlyPx9 + fp2[0] * bldTile9 * pitchK(centerY) * 0.3,
          race: race2 === "저그" ? "zerg" : race2 === "프로토스" ? "toss" : "terran",
          items: Array.from({ length: woundLv === 2 ? 5 : 2 }, (_, k9) => {
            const h9 = (i * 2654435761 + k9 * 40503) >>> 0;
            const ux9 = ((h9 % 1000) / 1000 - 0.5) * 0.62;
            const uy9 = (((h9 >>> 10) % 1000) / 1000 - 0.5) * 0.62;
            const sz9 = fp2[0] * (woundLv === 2 ? 0.34 : 0.26) * bldTile9 * pitchK(centerY);   // 입체: 깊이 배율
            return { sz: sz9, dx: ux9 * fp2[0] * bldTile9 * pitchK(centerY), dy: uy9 * fp2[1] * bldTile9 * pitchK(centerY) * (pitched ? pitchFlat : 1), delay: ((h9 >>> 20) % 100) / 100 };
          }),
        } : null;
      /** 이 건물이 화면에 내보내는 효과 한 벌 — 이제 상처(계속)뿐이다.
       *  피격 불티·실드막은 위에서 캔버스 fx로 나갔다(그 주석 참조). */
      const bldFx = bldWoundFx;
      /* 성큰은 쏘는 동안 혓바닥을 내민 판으로 바꾼다(요청: "가시가 나오는 타이밍에
         이 모양이") — 아래 방어 사격이 트레이서를 그리는 조건과 **같은 자**를 쓴다:
         사거리 안에 지상 표적이 있고, 다 지어졌고, 아직 안 걷혔을 때. 조건을 따로
         두면 혓바닥과 가시가 서로 다른 순간에 나가 둘 다 거짓말이 된다. */
      /* 사양(qCombat)을 안 탄다(지적: "성큰 혓바닥도 안보이고 가시도 안보이고
         포토도 건물에 안쏴 근데 타겟들은 피가달고 터져") — 피가 달고 터진다는 것은
         자료도 판정도 멀쩡한데 **그림만** 안 나온다는 뜻이다. 그 갈래에서 통째로
         꺼지는 스위치는 사양 라디오 하나뿐이다(저 = qCombat 거짓).
         방어 건물은 화면에 많아야 열 몇 개고 사격 효과도 스팬 한둘이라, 유닛 수백
         개의 트레이서와 달리 아낄 것이 없다. 무엇보다 이것이 없으면 '무슨 일이
         벌어지고 있는지'가 아예 안 보인다 — 성큰·캐논이 조용한 채 유닛만 녹는다. */
      /** 성큰의 사격 박자(0~1) — 혓바닥과 가시가 **같은 시계**를 봐야 한다.
       *  둘이 따로 놀면 혀는 나와 있는데 가시가 없거나 그 반대가 된다. */
      const sunkenPh = unit === "Sunken Colony"
        ? firePhase(`s${raw}|${Math.round(x * 4)}|${Math.round(y * 4)}`,
          Math.max(0.2, (isKnownKind(unit) ? weaponVs(profileOf(unit), false)?.cd : 0) || 1.34))
        : 0;
      const sunkenOut = unit === "Sunken Colony" && !raising && !bldFrozen9
        && (goneEff === 0 || t < goneEff)
        /* 혓바닥은 **들어갔다 나왔다** 한다(지적) — 여태 사거리 안에 적이 있으면
           내내 뻗은 채였다. 그건 지렛대를 한 번 당긴 뒤 놓지 않는 그림이라,
           성큰이 쏘고 있는 것인지 굳어 있는 것인지 알 수 없었다. 한 박자의
           앞 절반만 나와 있는다. */
        && sunkenPh < 0.5
        && (() => {
          /* 표적은 참값이다(지시) — 이 건물의 order_target을 자리 색인에서 찾는다.
             못 찾으면(옛 판·안 겨눔) 혓바닥은 안 나온다. */
          const f9 = foeOfTgt9(rec9?.tgt);
          if (!f9 || f9.air) return false;
          const d9 = Math.hypot(f9.x - centerX, f9.y - centerY);
          return d9 <= reachTo(unit, { air: false, k: f9.k, uk: f9.uk },
            fireRangeTilesOf(unit, false));
        })();
      /* 포탑 조준(요청: "포톤, 터렛, 시즈탱크는 공격방향에 맞게 포탑부를 돌려
         줘야함") — 사거리 안에 제가 칠 수 있는 표적이 있으면 그쪽을 본다. 터렛은
         대공 전용이라 공중만 본다. 각은 22.5도 열여섯 칸으로 갈무리한다: 굽는
         판이 칸마다 하나씩 생기므로 잘게 쪼개면 캐시가 터진다(성큰의 혓바닥 판이
         하나뿐인 것과 같은 사정이다). 표적이 없으면 undefined — 그러면 옛 판을
         그대로 쓰고, 겨눈 자세로 굳어 있지도 않는다. */
      /* 성큰도 여기 든다(요청: "성큰 공격방향으로 혓바닥 내밀어야지") — 여태
         이 표적각은 포탑이 도는 둘(터렛·포톤)만 받았고, 성큰은 혓바닥 별본
         (sunkenfire)으로 **갈아입기만** 하고 각은 늘 기본 요잉이었다. 그래서
         어느 쪽에서 오든 혓바닥이 늘 같은 방향으로 뻗었다. 성큰은 대지 전용이라
         지상만 본다. */
      const headDeg9 = (unit === "Missile Turret" || unit === "Photon Cannon"
        || unit === "Sunken Colony")
        && !raising && !bldFrozen9 && (goneEff === 0 || t < goneEff)
        ? ((): number | undefined => {
          /* ★ 터렛은 **쉴 때도 돈다**(요청: idle 상태에서 포탑부가 돌며 탐지) — 표적이
             없으면 시간에 따라 천천히 한 바퀴(24°/s, 15초에 한 바퀴) 도는 각을 준다.
             자리(centerX·centerY)로 위상을 흩어 여러 터렛이 한 박자로 안 돈다.
             22.5도로 접으므로 캐시 판은 겨눌 때와 같은 16장 안에서 돈다. */
          /* 터렛은 **연속으로** 돈다(지적: "저렇게 도는 게 아니라 빙빙 연속적으로") — 22.5도 칸(16장)은
             24°/s에서 1초에 한 번 툭툭 넘어가는 그림이었다. 터렛만 7.5도 칸(48장)으로 촘촘히 굽는다: 터렛 판은
             2×2 발자국의 작은 판이라 48장이라도 몇 MB이고, 도는 동안 같은 48장을 되쓴다. 겨눌 때도 같은 칸. */
          const HEAD_STEP9 = unit === "Missile Turret" ? 7.5 : 22.5;
          const sweep9 = unit === "Missile Turret"
            ? ((Math.round(((t * 48 + centerX * 37 + centerY * 53) % 360) / HEAD_STEP9) * HEAD_STEP9) % 360 + 360)   // 24 → 48°/s(요청: 2배) % 360
            : undefined;
          const f9 = foeOfTgt9(rec9?.tgt);
          if (!f9) return sweep9;
          /* 못 치는 갈래는 겨누지도 않는다 — 터렛은 하늘만, 성큰은 땅만이다.
             참값이 그런 표적을 줄 일은 없지만, 자리 색인이 어긋나 엉뚱한 행을
             짚었을 때 포탑이 이상한 데를 보는 것보다 안 보는 편이 낫다. */
          if (unit === "Missile Turret" && !f9.air) return sweep9;
          if (unit === "Sunken Colony" && f9.air) return undefined;
          const dd9 = Math.hypot(f9.x - centerX, f9.y - centerY);
          if (dd9 > reachTo(unit, { air: f9.air, k: f9.k, uk: f9.uk },
            fireRangeTilesOf(unit, f9.air))) return sweep9;
          const d9 = (Math.atan2(-(f9.x - centerX), f9.y - centerY) * 180) / Math.PI;
          return ((Math.round(d9 / HEAD_STEP9) * HEAD_STEP9) % 360 + 360) % 360;
        })()
        : undefined;
      /* 이 건물 판의 자리 — 아래 사격 판정이 벙커의 불빛을 나중에 켠다(요청:
         발사 시 창 번쩍임). op 목록은 이 순회가 다 끝난 뒤에야 그려지므로,
         자리만 들고 있다가 뒤에서 고쳐도 늦지 않다. */
      let bldOpIx9 = -1;
      if (shapeKind) {
        bldOpIx9 = unitOps.length;
        unitOps.push({
          /* ★ 몸과 혓바닥을 가른다(위 sunkenTongueFaces의 ★) — 합본(sunkenfire)을
             쓰면 표적을 따라 각 칸을 넘을 때마다 2MB·2000면짜리 몸을 통째로 다시
             굽느라 한 프레임이 날아갔다. 몸(sunkenrear)은 각을 안 물어 평상시 것과
             합해 **두 벌**로 끝나고, 각별로 굽는 것은 기둥 하나짜리 혀뿐이다.
             쏠 때 둔덕이 솟고 낫날이 서는 몫(sunkenFire 깃발)은 그대로 남는다. */
          fx: fxF, fy: fyF, z, kind: sunkenOut ? "sunkenrear" : shapeKind,
          ...(sunkenOut ? { attach: "sunkentongue" } : {}),
          /* 창에 불이 드는 조건(요청: "평소 어둡고 활성 시 노란불") — 이 건물이
             지금 유닛을 뽑거나 연구를 돌리고 있나. 가스 건물(정제소)만은 이 뒤에
             따로 gasBusy가 켠다(일꾼이 안에 들어가 있는 동안). */
          /* 그리고 **깜빡인다**(요청: "진행중 계속 켜지는 거고 깜빡여야해") —
             0.9초 주기로 3분의 2 동안 켜진다. 위상은 건물 번호로 어긋내
             기지 전체가 한 박자로 명멸하지 않게 한다. 판은 lit 두 벌이 이미
             캐시돼 있어(LIT_KINDS) 깜빡임에 굽기가 더 들지 않는다. */
          /* 저사양은 **깜빡임 없이 켜 둔다** — 불빛 자체는 '지금 뭘 하고 있나'
             라 남기되(판 두 벌은 이미 캐시된다), 깜빡임은 그 두 벌을 초당 두 번
             오가게 만들어 굽기 캐시를 흔든다. */
          // 잔상은 불이 안 든다(위 bldFrozen9) — 안 보이는 건물이 뭘 뽑는지 모른다.
          lit: !bldFrozen9 && (producing || researching)
            && (!qAnim || ((((t + i * 0.17) % 0.9) + 0.9) % 0.9) < 0.6),
          /* 도는 부품의 칸(요청: 상시 회전) — 초당 0.6바퀴. 여덟 칸이라
             초당 네 번 판이 바뀐다.
             ★ 포지만은 **연구 중에만** 돈다(요청: "포지 업그레이드중에는 톱니가
               시계방향으로 회전을 해(롤링)") — 놀고 있는 포지의 톱니까지 늘
               구르면 '지금 업그레이드 중'이라는 신호가 안 된다. 걸음도 빠르게
               (0.6 → 1.6): 여덟 칸이 이빨 하나만큼이라(빌더의 roll) 한 바퀴가
               6초쯤 되어 '롤링'으로 읽힌다. */
          // 저사양은 안 돈다(요청) — 회전 칸 여덟이 곧 판 여덟 벌이다.
          /* 도는 부품 — **일하는 동안만** 도는 것과 늘 도는 것이 갈린다.
             포지 톱니·코어 플라즈마 디스크는 연구 장치라 업그레이드 중에만
             돈다(요청: "코어 디스크는 업그레이드 중에만 돌아야함"). 서플라이
             환풍팬은 건물이 서 있는 한 늘 돈다 — 그건 일이 아니라 설비다. */
          spin: !qAnim || bldFrozen9 ? 0
            : shapeKind === "forge" || shapeKind === "cyber"
              ? (researching ? Math.floor(t * 1.6 * SPIN_STEPS) % SPIN_STEPS : 0)
              : Math.floor(t * 0.6 * SPIN_STEPS) % SPIN_STEPS,
          /* 원작처럼 45도 요잉(지적) — 2D에도 적용(재지적: 2D도 45도 요잉해야지).
             쐐기의 진범은 요잉이 아니라 hover 그림자의 beginPath 누락이었다. */
          rotDeg: buildingYawOf(),
          headDeg: headDeg9,
          hpMax: (() => {
            const bs2 = BLD_STATS[unit];
            return bs2 ? bs2[0] + bs2[1] : undefined;
          })(),
          // 잔상은 체력을 모른다 — 마지막으로 본 모습만 남는다(위 bldFrozen9).
          hpFrac: bldFrozen9 ? undefined : bldHp.frac,
          hpShow: bldHp.hurt >= 0 && t - bldHp.hurt <= HP_BAR_SEC,
          // 원작 폭(요청) — 발자국 폭(타일 × 32px)의 0.95를 sprites.dat 값 자리에 넣는다.
          ...((): { hpBarW: number; hpBarFrac: number } => {
            const bwB9 = hpBarGamePx9((FOOTPRINT[unit]?.[0] ?? 4) * 32 * 0.95);
            /* 입체: 깊이 배율을 먹이고 한 단 줄인다(지적: 3D에서 체력바가 너무 큼 — z가 눌려 몸은 작아지는데 바는 2D 폭). */
            return { hpBarW: bwB9, hpBarFrac: (bwB9 / (gw9 * 32)) * (pitched ? pitchK(centerY) * HP_BAR_3D_K : 1) };
          })(),
          // 프로토스 건물은 전부 실드를 지닌다 — 그 몫이 바의 흰 칸이다.
          shFrac: bShShare9,
          /* 정보 팝업 신원(요청) — 건물은 태그가 없어 임자·종류·착공 자리로
             짓는다(같은 자리에 다시 지어도 착공 시각이 다르면 다른 몸이다).
             ★ 자리는 **줄이 적어 둔 x·y**여야 한다(지적: "띄운건물 인포팝업 열면
               바로 닫힘") — 여태 bx·by를 썼는데 그 둘은 그리는 자리다: 이사
               비행 보간과 겹침 회피(bldNudge)가 매 프레임 고쳐 놓는 값이라,
               뜬 건물은 열쇠가 프레임마다 바뀌었다. 팝업은 열쇠로 제 몸을 다시
               찾으므로(unitOps.find), 못 찾은 그다음 프레임에 통째로 닫혔다. */
          pickKey: `b${raw}|${unit}|${Math.round(x * 4)}|${Math.round(y * 4)}`,
          pickName: unit, pickRaw: raw, pickBld: true, pickX: x, pickY: y,
          pickRep: myOrd === repOrd, pickTag: myTag9,
          drawK: BLD_DRAW_K * (BLD_DRAW_TUNE[shapeKind] ?? 1),
          /* 땅에 앉은 건물은 그림자를 안 진다(요청: 건물 바닥 그림자는 제거) —
             건물은 발자국이 곧 제 자리라 바닥 타원이 정보를 더하지 않고, 모델
             발치에 검은 테를 둘러 도형을 흐리기만 했다. 떠 있는 건물만 제 것으로
             따로 만든다(요청: 떠 있는 건물만 자체적으로 제작) — 이륙해 둥실대거나
             이사 비행 중일 때, 발자국보다 작은 타원을 땅에 깔아 높이를 말한다. */
          groundShadow: afloat || landing,
          /* 뜬 건물은 **몸이 떠야** 그림자가 보인다(지적: "뜬 건물에 그림자
             필요") — 그림자는 이미 발자국 아래에 깔리고 있었는데, 몸을 안 띄워서
             그림자가 몸 밑에 통째로 가려 있었다. 그린 폭의 0.3배만큼 띄우고,
             아주 느리게 오르내리게 한다(제자리에 못 박힌 그림자와 벌어졌다
             좁아지는 그 차가 곧 높이다). 앉으면 0이라 예전과 같다. */
          /* 0.3 → 0.55(요청: "건물 좀더 높이 띄우기") — 그림자와 벌어진 몫이
             곧 높이라, 띄울수록 떠 있다는 것이 또렷하다. 오르내림은 hover9가
             부드러운 곡선으로 먹인다(위) — 뜬 채로 있는 동안만 둥실거린다. */
          /* ★ 뜬 높이는 **절대 px 한 칸**으로 싣는다(위 bFlyPx9 주석) — 몸·효과·
             판정·팝업이 한 값을 나눠 읽는다. liftK(그린 폭의 배수)는 이 칸이 없는
             옛 op을 위한 폴백으로만 남긴다. */
          ...(afloat ? { airPx: bFlyPx9 } : {}),
          liftK: afloat
            ? hover9 * (0.55 + 0.03 * Math.sin(t * 1.5)) : undefined,
          // 접지 그림자의 발자국 비(지적: 그림자는 바닥 발자국만) — 세로/가로.
          footRatio: boxH / boxW,
          /* 바닥에 실제로 깔리는 그림자(요청) — 발자국 크기의 타원을 타일 공간
             에서 열두 점으로 찍고, 그 점들을 자리 사상(posFrac)으로 옮긴다.
             화면에서 타원을 눌러 흉내 내는 것이 아니라 지면 위에 그린 도형이라,
             원근·기울기가 지면 격자와 정확히 같다.
             뜬 건물은 발자국의 0.6배로 줄여 깐다 — 몸과 그림자의 크기 차가 곧
             비행 높이로 읽힌다(공중 유닛 그림자와 같은 결). */
          // 평평한 [x0, y0, x1, y1, …](지적: 툭툭 순간이동 — 장마다 점 배열 수천 개를 만들던 것이 GC 멎음의 한 몫).
          shadowPts: ((): number[] => {
            /* 0.6 → 0.85(지적: "띄운건물 그림자 크기 작음") — 발자국의 60%는
               큰 건물에서 몸 밑에 숨는 크기였다. 85%면 몸보다는 작아 '떠 있다'가
               남으면서도 땅에 실린 무게가 읽힌다. */
            const sk9 = 0.85;
            const rx9 = (boxW / 2) * sk9;
            const ry9 = (boxH / 2) * sk9;
            const pts9: number[] = [];
            for (let q9 = 0; q9 < 12; q9 += 1) {
              const a9 = (q9 / 12) * Math.PI * 2;
              const p9 = posFrac(
                bodyX + Math.cos(a9) * rx9 * 0.98,
                bodyY + Math.sin(a9) * ry9 * 0.98,
              );
              pts9.push(p9[0], p9[1]);
            }
            return pts9;
          })(),
          // 지면선 — 몸 상자 아랫변(그림자 타원의 아래 끝과 같은 지면).
          baseFy: posFrac(bodyX, groundYT)[1],
          viewYaw: viewYawOf(centerX, centerY), flat: !pitched, pitch: pitched,
          sizePx: 0, wFrac: wFrac * pulse, hFrac: hFrac * pulse, boxFit: "meet",
          /* 전 건물 폭 기준(요청: 바닥을 발자국에, 높이는 제 비율로) — meet
             (min(w,h)) 규칙은 상자가 낮으면 바닥까지 같이 줄여 발자국보다 작은
             바닥을 만들었다(벙커가 유난히 작던 이유와 같은 갈래). 폭을 기준 삼으면
             바닥이 늘 발자국 폭과 같고 높이는 모델 비율이 따라온다. */
          fitWidth: true,
          color, alpha, noShadow: true,
        });
        /* (걷어냄) **라바·변태알 장식** — 해처리가 제 생산 기록을 규칙표
           (bwUnits.hatchState)에 먹여 "지금 라바가 몇이고 무엇을 품고 있나"를
           되짚어, 발치 여섯 칸에 라바와 알을 앉히던 자리다. 리플레이 개체 기록에
           라바가 안 남던 시절에는 그것이 유일한 길이었다(라바는 명령을 안 받는다).
           ★ 참값에는 **라바도 알도 진짜 개체로 실린다** — 자리·태그·체력까지 다
             있다(실측: 한 판에 라바 키 5,558 · 알 키 5,304, 태그 하나가 라바 →
             알 → 유닛으로 갈아입는다). 그러니 되짚을 것이 없다. 되짚기를 그냥
             두면 진짜 라바 위에 지어낸 라바가 겹쳐 두 벌이 된다.
           함께 사라진 것: 여섯 칸 자리표(SPOT6)와 꿈틀거림. 참값 라바는 제
           자취대로 해처리 발치에서 실제로 꿈틀댄다 — 흉내 낼 까닭이 없다. */
        /* 애드온 연결 통로(지적: 본체와 잇는 방식 고민 — 원작 배치 참고) — 원작
           에서 부속건물은 본체 오른쪽 아래에 붙는다: 애드온 왼쪽 모서리에서 본체
           쪽으로 낮은 복도 판을 깐다. */
        if (ADDONS.has(unit)) {
          const mkA = pitchK(centerY);
          /* 본체를 찾아 정확히 잇는다(재재재지적: 연결이 너무 구림 — 통로가 본체
             오른변에 안 닿고 허공에 떴다) — 같은 임자의 살아 있는 비-애드온 중
             '오른변이 애드온 왼변과 맞닿는' 건물이 부모다. 통로는 부모 오른변에서
             애드온 왼변까지, 양끝을 0.5타일씩 물려 이음매 없이 깐다. */
          /* ★ 부모 찾기를 **죈다**(지적: "팩토리중 애드온 연결부가 이렇게 크고
             이상한 위치인게 가끔 나와") — 여태 가로 2타일·세로 4타일까지 봐 주었다.
             원작에서 부속은 본체 오른변에 **딱 붙어** 서므로(커맨드 4×3의
             (x+4, y+1)) 그만한 여유가 필요 없는데, 그 헐거움 때문에 네 타일 위에
             선 엉뚱한 건물이 부모로 잡히는 일이 생겼다. 그러면 통로가 그 먼
             자리까지 늘어나고, 길이가 곧 모형 배수라(fitWidth) 통째로 커진다 —
             그것이 '크고 이상한 위치'의 정체다. 가로 0.6·세로 2타일로 죈다.
             ★ 그리고 **못 찾으면 안 그린다**(아래) — 허공에서 시작하는 통로보다
               아무것도 없는 편이 낫다. */
          const par = buildsSrc.find(([ps3, pxT, pyT, pu3, pr3, pg3]) =>
            pr3 === raw && !ADDONS.has(pu3) && ps3 <= t
            && ((pg3 ?? 0) === 0 || t < (pg3 ?? 0))
            && Math.abs((pxT + (FOOTPRINT[pu3] ?? [4, 3])[0]) - x) <= 0.6
            && Math.abs(pyT - y) <= 2);
          if (!par) return null;
          /* 두 끝은 **몸 상자** 변이다(요청: 건물 틈) — 발자국 변으로 재면 이제
             본체·애드온이 발자국보다 작게 서므로 통로가 허공에서 시작한다. */
          const parBox = par ? buildingBox(par[3]) : null;
          /* 짧게, 그리고 뒤로(요청: "애드온 연결부 길이줄이고 뒤로 옮겨야대") —
             두 끝을 각각 상자 안으로 0.5 → 1.3타일씩 물린다(길이 1.6타일 축소).
             통로는 두 건물을 잇는 짧은 목이지 다리가 아니라, 벽 앞으로 길게
             뻗으면 둘 사이가 비어 보인다. 세로도 몸 상자 앞(+0.1)에서 뒤
             (−0.18)로 옮긴다 — 사람이 지나는 통로는 건물의 앞면이 아니라
             뒤쪽에 붙는 것이 원작의 그림이고, 앞에 두면 두 건물의 얼굴을 가린다. */
          const LINK_IN = 1.3;
          /* 본건물 쪽은 덜 물린다(요청: "테란 애드온 연결부 본건물 쪽 길이 줄이기") — 1.3 → 0.55. 통로가 본체
             안으로 깊이 파고들던 몫이 줄어 본체 쪽 길이가 짧아지고 가운데도 부속 쪽으로 옮겨 간다. */
          const LINK_IN_MAIN = 0.55;
          const leftEdge = par && parBox
            ? par[1] + footDx(par[3]) + parBox[2] + parBox[0] / 2 - LINK_IN_MAIN
            : bodyX - boxW / 2 - 1.2;
          const rightEdge = bodyX - boxW / 2 + LINK_IN;
          /* 가로 2/3(요청: "애드온 연결부 가로 길이 2/3로 줄이고") — 두 끝을
             안으로 물리는 것(LINK_IN)과 별개로, 남은 길이 자체를 줄인다.
             가운데는 그대로라 양쪽이 똑같이 짧아진다. */
          /* 길이는 위아래로 죈다 — 부모를 죄어도 발자국 표가 틀린 옛 기록에서
             터무니없이 긴 값이 나올 수 있고, 길이가 곧 모형 배수라 그때 통로가
             건물보다 커진다. 통로는 두 건물 사이를 잇는 짧은 목이다. */
          const linkW = Math.max(1.2, Math.min(3.2, (rightEdge - leftEdge) * (2 / 3)));
          /* 자리(요청 셋을 거친 자리) — −0.18 → −0.38 → −0.62 → **−0.12**.
             ★ 마지막 요청이 "애드온 연결부 바닥으로 내리기"다. 이 한 수는
               통로가 앉는 **지면선**이라, 뒤로 밀수록(음수가 클수록) 화면에서는
               위로 올라간다 — 곧 −0.62는 통로를 두 건물 사이 허공에 띄우고
               있었다. 통로는 사람이 걸어 다니는 바닥 구조물이므로 두 건물과
               **같은 땅**에 앉는 것이 맞다: 몸 상자 아랫변 언저리(−0.12)로
               내린다. 모델 자체는 이미 바닥(z 0.4)에서 시작한다. */
          const [lfx, lfy] = posFrac((leftEdge + rightEdge) / 2, bodyY - boxH * 0.12);
          unitOps.push({
            /* 통로도 건물과 같은 45도로 굽는다(지적: "각 옆면에는 수직임") —
               본체·애드온이 다 요잉해 서 있어 서로 마주 보는 옆면도 비스듬한데,
               통로만 요잉 0으로 구우면 그 벽을 비껴 찌른다. 같은 각으로 구워야
               모형의 x축이 두 벽의 법선과 나란해져, 막대가 양쪽 벽에 직각으로
               꽂힌다(까닭은 addonlink 모델 쪽 주석에 적어 두었다). */
            fx: lfx, fy: lfy, z: z - 1, kind: "addonlink",
            rotDeg: buildingYawOf(),
            viewYaw: viewYawOf(centerX, centerY), flat: !pitched, pitch: pitched,
            sizePx: 0, wFrac: (linkW / grid.width) * mkA, hFrac: ((linkW * 0.36) / grid.width) * mkA,
            boxFit: "meet", fitWidth: true, color, alpha, noShadow: true,
          });
        }
        /* 방어 사격(재지적: 터렛은 골리앗 대공과 동일, 벙커는 안에 든 것 따라) —
           사거리 안 적 마커가 있으면 건물에서도 트레이서가 나간다. 터렛은 공중
           상대만 미사일(8타일), 벙커는 총알(6타일)에 임자가 파벳을 뽑아 뒀고 적이
           코앞(3.5타일)이면 화염을 섞는다 — 안에 누가 들었는지는 리플레이에 안
           남아, 그 시점 보유 병종으로 어림한다. */
        /* 포톤·성큰·스포어도 쏜다(지적: 사거리 안에 대상이 있는데 공격을 안 한다)
           — 여태 터렛·벙커만 이 갈래에 들어 있어, 프로토스·저그 방어 건물은
           화력이 체력에만 접혀 있고 화면에는 아무 일도 안 일어났다. 성큰은 대지
           (7타일)·스포어는 대공(7타일)·포톤은 둘 다(7타일)라, 못 치는 갈래는
           nearestFoe의 only로 아예 안 본다. */
        if (DEF_FIRE.has(unit) && !bldFrozen9
          && !raising && (goneEff === 0 || t < goneEff)) {
          /* (걷어냄) teamB — '누구의 적을 찾을까'를 정하던 값이다. 참값 표적은
             제 편을 이미 알고 오므로 편을 다시 물을 일이 없다. */
          /* 벙커 승무원 — **자취가 직접 말한다**(요청: "벙커안에서 공격시 트레이서
             안나옴"). 여태 이 자리는 빈 배열이었다: 옛 승무원 색인은 우클릭 승선
             증거(f=12)로 짓던 것이라 참값에는 그 갈래가 없어 늘 비었고, 그래서
             벙커는 아래 '마린 한 기 추정'이 걸릴 때만 쐈다 — 그 추정마저 그 임자가
             마린을 뽑은 기록이 있어야 서므로, 실제로는 아무것도 안 쏘는 벙커가 많았다.
             이제 상태가 ST_INSIDE인 개체 중 이 발자국 안에 있는 것이 곧 사수다.
             자리 넷을 넘겨 잡히면 먼저 들어간 넷만 센다. */
          const crew: { kind: string; tgt?: Ticks }[] =
            unit !== "Bunker" ? [] : insideSpots
              .filter((q9) => q9.raw === raw
                && Math.abs(q9.x - centerX) <= fp2[0] / 2 + 1
                && Math.abs(q9.y - centerY) <= fp2[1] / 2 + 1)
              .slice(0, 4)
              .map((q9) => ({ kind: q9.unit, ...(q9.tgt ? { tgt: q9.tgt } : {}) }));
          /* 승선 증거가 하나도 없는 벙커는 마린 한 기가 든 것으로 친다 [어림] —
             벙커를 골라 누르는 Load 버튼으로 태우면 우클릭 증거가 안 남기 때문이다.
             빈 벙커로 두면 지어 놓고 지켜 낸 방어선이 화면에서 통째로 사라지고, 넷을
             채운 것으로 치면 아무도 못 본 화력을 지어낸다. 인원을 모를 때 가장 작은
             참값이 1이고, 그 임자가 마린을 뽑은 뒤부터만 그렇게 본다. */
          const presumed = unit === "Bunker" && crew.length === 0
            && (marineBornOf.get(raw) ?? Infinity) <= t;
          const crewGun = presumed
            || crew.some((c9) => c9.kind === "Marine" || c9.kind === "Ghost");
          const crewBat = crew.some((c9) => c9.kind === "Firebat");
          /* 사거리는 표에서 온다(과제 #48) — 여기 박혀 있던 캐논 7·성큰 7·스포어 7·
             터렛 8·벙커 6·화염 3.5는 서로 다른 자리에 흩어진 채 표와 어긋나 있었다
             (터렛은 원작 7이다). 벙커는 표에서 무기가 아예 없으므로 승무원의 무기를
             벙커 보너스(+64px=2타일)와 함께 받아 온다 — profileOf(정체, 업글, 벙커=참)
             가 그 덧셈과 U-238 같은 사거리 업글을 이미 물고 나온다. */
          const bunkUps = unit === "Bunker"
            ? (upsByRaw.get(raw) ?? []).filter(([us9]) => us9 <= t).map(([, nm9]) => nm9) : [];
          // 사거리가 가장 긴 사수가 갈래를 정한다 — 고스트(C-10)가 있으면 그쪽.
          const gunProf = unit === "Bunker"
            ? profileOf(crew.some((c9) => c9.kind === "Ghost") ? "Ghost" : "Marine",
              bunkUps, true) : null;
          const batProf = unit === "Bunker" && crewBat
            ? profileOf("Firebat", bunkUps, true) : null;
          const batRG = batProf ? (weaponVs(batProf, false)?.rangeTiles ?? -1) : -1;
          const rgG = unit === "Bunker"
            ? (crewGun && gunProf ? (weaponVs(gunProf, false)?.rangeTiles ?? -1) : -1)
            : fireRangeTilesOf(unit, false);
          const rgA = unit === "Bunker"
            ? (crewGun && gunProf ? (weaponVs(gunProf, true)?.rangeTiles ?? -1) : -1)
            : fireRangeTilesOf(unit, true);
          /* 못 치는 갈래는 표적으로도 안 삼는다 — 벙커는 승무원이 정한다: 마린·
             고스트는 공중도 치므로(그래서 공중 표적이라고 사격이 통째로 사라지던 것이
             지도가 잡은 버그다) 갈래를 안 나누고, 화염뿐이면 지상 전용이다. */
          const onlyB = unit === "Bunker" ? (crewGun ? undefined : "ground")
            : rgA < 0 ? "ground" : rgG < 0 ? "air" : undefined;
          /* ★ 방어 건물도 **참값 표적**을 본다(지시: 어림을 다 걷어낸다) ────────
             여기 있던 nearestFoe에는 어림이 셋 겹쳐 있었다: 가장 가까운 적 고르기 ·
             지형 가림 판정 · **'맞고 있는 것만'**(needHurt — 표적의 체력이 방금
             줄었나를 증거로 삼던 자다). 셋 다 "이 건물이 무엇을 쏘나"를 우리가
             되짚으려던 대역이고, 참값에는 그 답이 그대로 있다.
             ★ 벙커는 **제가 안 쏜다**(지적: "벙커도 조심") — 안에 든 승무원이 쏘므로
               벙커 자신의 order_target은 대개 비어 있다. 승무원의 표적을 본다.
               넷이 서로 다른 것을 겨눌 수 있는데 화면에 그리는 사격은 한 갈래라,
               명단 차례로 처음 잡히는 표적을 쓴다. */
          const foeB = ((): {
            bx: number; by: number; bd: number; air: boolean; k?: string; uk?: string;
          } => {
            const none9 = { bx: 0, by: 0, bd: Infinity, air: false };
            /* ★ 벙커는 사수를 먼저 묻고, **없으면 제 것을 묻는다** ────────────
               사수의 표적이 첫 번째다(위 주석: 벙커는 제가 안 쏜다). 다만 사수를
               못 짚는 판이 있다 — Load 버튼으로 태우면 승선 자국이 없어 '마린 한
               기 추정'(presumed)으로만 서는데, 그때 crew는 빈 배열이라 물어볼
               표적이 아예 없었다. 곧 추정 벙커는 **영영 안 쏘는 벙커**였다.
               그 자리에서 벙커 자신의 order_target으로 물러난다. 대개 비어 있지만
               (그래서 사수를 먼저 묻는다) 있으면 그것이 참값이므로, 없는 사격을
               지어내는 것이 아니라 있는 사격을 놓치지 않는 쪽이다. */
            const r9 = unit === "Bunker"
              ? (crew.map((c9) => foeOfTgt9(c9.tgt)).find((v9) => v9)
                ?? foeOfTgt9(rec9?.tgt))
              : foeOfTgt9(rec9?.tgt);
            if (!r9) return none9;
            /* 못 치는 갈래면 안 겨눈다 — 참값이 그런 표적을 줄 일은 없지만, 자리
               색인이 어긋나 엉뚱한 줄을 짚었을 때 없는 사격을 그리는 것보다 낫다. */
            if (onlyB === "ground" && r9.air) return none9;
            if (onlyB === "air" && !r9.air) return none9;
            return {
              bx: r9.x, by: r9.y,
              bd: Math.hypot(r9.x - centerX, r9.y - centerY),
              air: r9.air, k: r9.k, uk: r9.uk,
            };
          })();
          /* 실제로 닿는 사거리(위 reachTo 주석) — 벙커는 승무원 무기라 표에서
             못 찾으므로 제 값(rgG·rgA)에 그대로 물러난다. */
          const rgB = reachTo(unit, foeB, foeB.air ? rgA : rgG);
          // 화면 기준 조준(지적: 공중 각도·지면 평행) — 유닛 트레이서와 같은 셈.
          const tPxB = mapW9 / grid.width;
          let dgy = (foeB.by - centerY) * tPxB * (pitched ? pitchFlat : 1);
          /* 표적의 제 크기로 조준 높이를 뺀다 — 표적 유닛 이름은 FoeRow.uk에 있다
             (예전 코드는 건물 행에만 실리는 k를 공중 갈래에서 읽어 늘 폴백이었다).
             ★ 배수는 **그리는 쪽과 같은 값**이라야 한다(지적: "높이가 내려갔는데
               트레이서는 기존 높았던 곳을 향해 발사되고 있어") — 여기만 1.6이라는
               못 박힌 수였다. 그리는 쪽이 0.8이던 시절에도 이미 두 배를 겨누고
               있었고, 높이를 0.6으로 내리자 어긋남이 2.67배로 벌어졌다.
               공유 함수(airLiftPxOf)를 쓰면 앞으로 높이가 바뀌어도 저절로 따라온다 —
               이 파일이 몇 번이고 데인 자리다: 같은 것을 두 곳에서 셈하면 갈린다. */
          if (foeB.air) dgy -= airLiftPxOf(foeB.by);
          const degB = Math.atan2(-((foeB.bx - centerX) * tPxB), dgy) * (180 / Math.PI);
          /** 포구에서 표적까지의 화면 거리(px) — 날아가는 탄이 갈 길이다. */
          const lenB = Math.hypot((foeB.bx - centerX) * tPxB, dgy);
          /* 트레이서가 **제 포구에서** 나간다(요청: "포톤캐논등이 트레이서가 포구가
             아닌 먼곳에 나오는 문제 무조건 포구에 나와야 누구건지 알아") — 여태
             방어 건물은 유닛과 달리 모델 앵커가 없어, 발자국 한가운데에서 붙박이
             픽셀(MUZZLE_PX 5~7px)만큼 앞으로 민 자리에서 쏘았다. 그 픽셀은 화면
             크기에 매인 값이라 지도가 작을수록(폰) 건물 몇 배 밖에서 빛이 났고,
             포톤 여럿이 붙어 서면 누가 쏘는지 알 수 없었다.
             이제 유닛과 같은 셈이다 — 모델 공간의 포구(BLD_MUZZLE)를 굽기와 같은
             변환으로 투영하고, 그 자리를 화면 px로 옮긴다. 좌표계만 유닛과 다르다:
             건물 판은 발자국 **바닥 가운데**(16-상자의 8,16)가 앵커이고 한 변이
             발자국 폭이라, 지면선까지 내려간 뒤 상자 안 자리를 더한다. 앵커도 몸과
             같은 정규화 배수(bldNormOf)를 탄다. */
          /* 포구 오프셋(렌즈 px) — 옛 bTf 문자열 변환을 수 한 쌍으로 옮겼다
             (캔버스 이관·지적: "포톤 트레이서가 크립에 가려짐" — 렌즈가
             will-change로 제 스태킹 컨텍스트라 렌즈 안 스팬은 zIndex와 무관하게
             유닛 캔버스(z 6000) **밑**이고, 크립이 캔버스 잉크라 그 위를 지나는
             빔이 덮였다. 유닛 트레이서처럼 캔버스 fx로 올리면 층이 바로 선다).
             폴백은 rotate→translateY(= 방향×오프셋), 앵커는 translate→rotate
             (안 돌린 오프셋) — CSS 시절 순서 그대로다. */
          /** 이 건물의 모델 포구 하나를 화면 오프셋(렌즈 px)으로. 포구가 여럿인
           *  건물(터렛의 좌우 포드)은 자리를 바꿔 여러 번 부른다. */
          const muzzleAt9 = (mz: [number, number, number] | undefined): [number, number] => {
            const radB9 = (degB * Math.PI) / 180;
            const fallM9 = MUZZLE_PX[unit] ?? 5;
            const fall: [number, number] =
              [-Math.sin(radB9) * fallM9, Math.cos(radB9) * fallM9];
            if (!mz) return fall;
            const mw9 = mapW9;
            const mh9 = mapH9;
            if (!mw9 || !mh9) return fall;
            const [px9, py9] = anchorPoint(
              mz, buildingYawOf(), viewYawOf(centerX, centerY), pitched, !pitched,
            );
            // 16-상자 한 변이 곧 그려지는 발자국 폭이다(UnitLayer의 fitWidth).
            const side9 = wTiles * mkK * (mw9 / grid.width);
            // 앵커도 몸과 같은 배수를 탄다 — 굽기가 상자 (8,16)을 축으로 키운다.
            const bn9 = bldNormOf(shapeKind);
            const ax9 = 8 + (px9 - 8) * bn9;
            const ay9 = 16 + (py9 - 16) * bn9;
            // 그리기가 실제로 앉히는 자리(잉크 바닥·가로중심) 기준으로 잰다.
            const ink9 = BLD_INK_BOX.get(bldAnchorKey(shapeKind, pitched)) ?? [8, 16];
            const [afx9] = posFrac(anchorX, anchorY);
            const [, gfy9] = posFrac(bodyX, groundYT);
            const [cfx9, cfy9] = posFrac(centerX, centerY);
            const dx9 = (afx9 - cfx9) * mw9 + ((ax9 - ink9[0]) * side9) / 16;
            const dy9 = (gfy9 - cfy9) * mh9 + ((ay9 - ink9[1]) * side9) / 16;
            return [dx9, dy9];
          };
          const mzModel9 = unit === "Bunker" ? bunkerMuzzleOf(degB)
            : shapeKind ? BLD_MUZZLE[shapeKind] : undefined;
          const [mzBx, mzBy] = muzzleAt9(mzModel9);
          /* ★ 미사일 터렛은 **두 발이 나간다**(지적: "미사일 터렛 트레이서에서 미사일
             두 방이야 · 포드가 양쪽 두 개잖아 — 골리앗·발키리 대공·스카우트 대공·
             레이스 대공과 같아") ──────────────────────────────────────────────────
             유닛 쪽은 이미 그렇게 나간다(그 자리의 lanes9 주석). 방어 건물만 한 줄기라
             같은 무기가 쏘는 곳에 따라 달라 보였다.
             벌리는 자는 유닛과 다르다. 유닛은 잉크 폭에서 반씩 벌리는 어림을 쓰지만,
             터렛은 **모델이 포드 자리를 알고 있다**(BLD_MUZZLE.turret의 x가 곧 오른쪽
             포드다). 그 x의 부호만 뒤집어 왼쪽 포드를 얻어 각각 제자리에서 쏘면,
             어림이 아니라 그 건물의 진짜 발사관 둘이 된다 — 요잉이 돌아도 두 자리가
             모델과 함께 돈다. */
          /* ★ 터렛은 **한 줄기**다(재지적: "터렛은 이제보니 미사일 한줄만 나가야함")
             — 앞선 요청("두 줄기로 나가야 한다")으로 포드 둘에서 하나씩 내보냈는데,
             원작 화면을 다시 보면 터렛의 발사는 한 줄이다. 포드가 둘인 것과 한 박자에
             두 발이 나가는 것은 다른 이야기였다(유닛 쪽 lanes9는 그대로 둔다 —
             골리앗·레이스·발키리·스카우트는 두 발이 맞다). */
          const mzPair9: [number, number][] = [[mzBx, mzBy]];
          const [dffx9, dffy9] = posFrac(centerX, centerY);
          /** 방어 사격 한 발 — 날아가는 탄이면 shot, 아니면 제 갈래 주기의 번쩍임. */
          const pushDefFx = (style9: string, delay9 = 0): void => {
            const dur9 = FX_BEAM[style9]?.dur ?? 0.22;
            for (const [qx9, qy9] of mzPair9) {
              if (shotB !== null) {
                fxOps.push({
                  kind: "shot", style: style9, fx: dffx9, fy: dffy9, lift: 0,
                  mx: qx9, my: qy9, deg: degB, len: lenB, u: shotB,
                });
              } else {
                fxOps.push({
                  kind: "beam", style: style9, fx: dffx9, fy: dffy9, lift: 0,
                  // len = 포구→표적 — 유닛 쪽과 같은 까닭(표적을 안 넘게 죈다).
                  mx: qx9, my: qy9, deg: degB, len: lenB,
                  ph: ((((t - delay9) % dur9) + dur9) % dur9) / dur9,
                });
              }
            }
          };
          /* 방어 건물의 탄도 날아간다(요청) — 유닛 쪽과 같은 셈이다(그쪽 주석의
             PROJECTILE_FX·SHOT_TILES_PER_SEC를 그대로 쓴다). 박자는 그 건물 무기의
             쿨다운이고, 위상은 건물마다 어긋낸다(i) — 캐논 여럿이 한 박자로 쏘면
             한 문이 쏘는 것처럼 보인다.
             성큰은 여기 안 든다: 혓바닥은 날아가는 탄이 아니라 표적까지 뻗는
             촉수라, 길이가 곧 실거리인 지금 그림이 맞다. 벙커 사수의 총·화염도
             즉발이라 그대로다. */
          const shotB = ((): number | null => {
            const nm9 = unit === "Missile Turret" ? "missile"
              : unit === "Spore Colony" ? "venom"
                : unit === "Photon Cannon" ? "plasma" : null;
            if (!nm9 || !PROJECTILE_FX.has(nm9) || lenB <= 1) return null;
            const pf9 = isKnownKind(unit) ? profileOf(unit) : null;
            const w9 = pf9 ? weaponVs(pf9, foeB.air) : null;
            const cd9 = Math.max(0.15, w9 ? w9.cd : 0.6);
            /* 유닛 쪽과 같은 바닥(그 자리 ★) — 미사일 터렛도 붙어 쏠수록
               탄이 안 보이던 병을 함께 앓았다(1타일 14%). */
            const dist9 = lenB / Math.max(1, tPxB);
            const flySec9 = Math.min(cd9 * 0.9,
              Math.max(0.05, Math.min(cd9 * 0.4, 0.4),
                dist9 / Math.max(1, SHOT_TILES_PER_SEC)));
            const ph9 = firePhase(`b${raw}|${unit}|${Math.round(x * 4)}|${Math.round(y * 4)}`, cd9);
            const u9 = (ph9 * cd9) / flySec9;
            // 닿는 순간을 반드시 그린다 — 유닛 쪽과 같은 까닭(위 주석).
            return u9 < 1.2 ? Math.min(1, u9) : null;
          })();
          /* 포톤은 대공·대지 한 자루, 성큰은 촉수(표적까지 실거리로 뻗는다 — 럴커
             가시와 같은 셈), 스포어는 포자. 사거리 숫자는 위 rgB가 표에서 받아 왔다. */
          if (unit === "Photon Cannon" && foeB.bd <= rgB) pushDefFx("photon");
          /* 성큰(요청: "혓바닥은 지렛대같은거고 그게 나오면 가시가 솟구쳐") ──
             여태 이 자리는 **혓바닥을 표적까지 길게 늘인 선** 하나였다. 그건
             성큰이 촉수로 찔러 맞히는 그림인데, 원작의 성큰은 그렇게 때리지 않는다:
             촉수는 땅속에 힘을 넣는 **지렛대**이고, 실제로 때리는 것은 표적 발밑에서
             **솟구치는 가시**다. 그래서 둘로 나눈다.
               · 혓바닥 — 모델이 진다(sunkenfire 별본이 표적 쪽으로 돈다). 여기서
                 선을 그리지 않는다.
               · 가시 — 표적 자리에서 위로 솟았다 꺼진다. 셋을 조금씩 어긋내 심어
                 한 가닥이 아니라 무더기로 솟는 것으로 읽히게 한다.
             박자는 그 무기의 쿨다운이고, 앞 40% 동안만 솟는다(사인 한 마루라
             솟는 끝과 꺼지는 끝의 속도가 0이다). */
          /* 가시는 **한 가닥**이고 색은 진한 주황이다(지적: "성큰 가시는 한가닥
             진한 주황색톤이어야하고") — 다섯 가닥 상아색 무더기는 성큰이 아니라
             가시덤불로 읽혔다. 그리고 혓바닥과 **같은 시계**를 본다: 지렛대가
             당겨진 뒤(0.12) 솟았다가 지렛대가 돌아가기 전(0.45)에 꺼진다. */
          if (unit === "Sunken Colony" && foeB.bd <= rgB) {
            const upS = sunkenPh > 0.12 && sunkenPh < 0.45
              ? Math.sin(((sunkenPh - 0.12) / 0.33) * Math.PI) : 0;
            if (upS > 0.02) {
              /* 가시는 쏘는 방향이 아니라 표적 발밑에서 **땅 위로** 솟는다 —
                 포구 오프셋 + 방향×실거리 = 표적 자리, 거기서 erupt가 수직으로. */
              /* 겨눔은 이 마디의 것으로 못 박는다(위 lockAim 주석) — 표적이
                 걸어가도 이미 솟은 가시는 처음 자리에 그대로 선다. */
              const aimS9 = lockAim(
                `sk${raw}|${Math.round(x * 4)}|${Math.round(y * 4)}`, sunkenPh, degB, lenB,
              );
              const radS9 = (aimS9.deg * Math.PI) / 180;
              fxOps.push({
                kind: "erupt", fx: dffx9, fy: dffy9, lift: 0,
                mx: mzBx - Math.sin(radS9) * aimS9.len,
                my: mzBy + Math.cos(radS9) * aimS9.len,
                // 1.75 → 1.5(지적: "성큰은 살짝 낮추기") — 럴커 가시와 나란히
                // 두면 성큰 혓바닥이 더 높아 둘의 결이 뒤바뀌어 보였다.
                len: Math.max(6, tPxB * 1.5), u: upS,
                size: Math.max(1.2, tPxB * 0.3),
              });
            }
          }
          // 스포어는 가디언과 같은 독 갈래다(요청: "스포어/가디언은 독느낌 노랑 연두 길게").
          if (unit === "Spore Colony" && foeB.bd <= rgB) pushDefFx("venom");
          if (unit === "Missile Turret" && foeB.air && foeB.bd <= rgB) pushDefFx("missile");
          if (unit === "Bunker" && (crew.length > 0 || presumed)) {
            /* 갈래는 **가우스 소총**이다(표의 그 줄: "gun 짧은 노란 빛(마린·
               고스트·벌처·골리앗 지상·벙커)") — 여기만 "base"를 넘기고 있었다.
               base는 무기 갈래가 없던 시절의 폴백 꼴이라, 벙커에서 나가는 빛만
               밖에 선 마린의 것과 결이 달랐다. */
            const gunOn9 = !!crewGun && rgB >= 0 && foeB.bd <= rgB;
            const batOn9 = !!crewBat && !foeB.air && batRG >= 0 && foeB.bd <= batRG;
            if (gunOn9) pushDefFx("gun");
            // 화염은 지상 전용이고 사거리도 제 것(가우스 6에 견줘 3)이다.
            if (batOn9) pushDefFx("flame", 0.2);
            /* ★ 쏘는 동안 **창이 번쩍인다**(요청) — 박자는 트레이서와 같은 것을
               쓴다(FX_BEAM.gun의 주기). 둘이 같은 시계를 봐야 빛이 창에서 나가는
               것으로 읽힌다. 저사양·잔상은 켜 두기만 한다(깜빡임은 판 두 벌을
               초당 몇 번 오가게 만들어 굽기 캐시를 흔든다 — 다른 건물과 같은 규약). */
            if ((gunOn9 || batOn9) && bldOpIx9 >= 0 && !bldFrozen9) {
              const wd9 = FX_BEAM.gun?.dur ?? 0.22;
              const wp9 = ((((t + i * 0.13) % wd9) + wd9) % wd9) / wd9;
              if (!qAnim || wp9 < 0.5) unitOps[bldOpIx9].lit = true;
            }
          }
        }
        if (bldFx) dom.push(bldFx); return null;
      }
      // 전용 도형이 없는 건물 — 발자국 80% 네모(.scr-motion-sq와 같은 채움·0.82).
      unitOps.push({
        fx: fxF, fy: fyF, z, kind: "",
        sizePx: 0, wFrac: wFrac * pulse, hFrac: hFrac * pulse, boxFit: "fill",
        color, alpha: alpha * 0.82, noShadow: true,
      });
      if (bldFx) dom.push(bldFx); return null;
    });
      void rBD9;
    }
    {
    const rW9 = (grid.resources ?? []).map((res) => {
    /* 시점 보기 — 아직 못 가 본 곳의 자원은 모른다(요청: 3단 안개). 한 번
       밝힌 뒤로는 늘 보인다(원작도 자원 지물은 기억에 남는다). */
    const rSeen9: 0 | 1 | 2 = fogOn ? seenAt(res[0], res[1]) : 2;
    if (rSeen9 === 0) return null;
    const gasSpot = res[2] === 1
      || (!gridHasGasFlags
        && gasBuildings.some((g) => Math.hypot(g.x - res[0], g.y - res[1]) <= 6));
    /* 정확한 좌표 우선(재지적: 겹치더라도 제자리에) — 홀 치마 회피 보정은 걷었다.
       군집도 낱밭 수준(파서 반경 1.2)으로 좁혀, 밭이 홀에 붙은 맵은 붙은 그대로
       그린다. */
    const mkK = pitchK(res[1]);
    const [fx, fy] = posFrac(res[0], res[1]);
    /* 간헐천은 두 칸 폭(지적: 한 칸처럼 작았다). 미네랄은 낱밭 단위가 되면서
       2×1 밭 폭에 맞춘 2.4타일 — 예전 3.2는 지대(여러 밭 묶음) 시절의 폭이다.
       색은 제 기본색(지적): 미네랄은 반투명 파란 수정, 가스는 회갈색 바위. */
    /* 가스 위 건물(재지적: "간헐천에 건물 지을때 간헐천 모델링도 보이면서 겹쳐지게
       해야함(원작 반영)") — 앞선 지적("건물을 지으면 간헐천 모델은 사라져야")을
       뒤집는 요청이다. 원작에서 정제소·어시밀레이터·익스트랙터는 간헐천을 지우지
       않고 그 위에 얹힌다: 건물 몸(정제소 3.5타일)이 간헐천(4타일)보다 좁아 테두리가
       삐져나오고, 그 겹침이 '가스 위에 지었다'를 말한다.
       그래서 감추는 대신 **건물 뒤로 보낸다** — 아래 z에서 자원의 앞섬 몫(+1200)을
       빼고 두 타일치를 더 물려, 같은 자리에 선 건물이 무슨 일이 있어도 앞에 온다.
       ★ 다만 **짓는 동안만**이다(재요청: "완공되면 안보임") — 공사 중에는 간헐천이
         건물 뒤로 비치고, 완공되는 순간 감춘다. 정제소가 뚜껑을 덮는 그림이다. */
    const gasOn = gasSpot ? gasHideOf.find((g) =>
      g.sec <= t && (g.gone === 0 || t < g.gone) && g.gd <= 4
      && Math.abs(g.gx - res[0]) < 0.5 && Math.abs(g.gy - res[1]) < 0.5) : undefined;
    if (gasOn && t >= gasOn.done) return null;
    /* ★ **바닥난 미네랄은 아예 안 그린다**(요청: "미네랄 소진 시 미네랄 모델
       아예 없어져야 해") — 여태 남은 단 0에서도 결정 한 덩이를 남겼다
       (keepN [1, 3, 6, 9, 12]의 그 1). 원작에서 다 캔 밭은 자리째 사라지므로
       한 덩이가 남으면 '아직 캘 것이 있다'로 읽힌다.
       모델을 빈 것으로 만들지 않고 **여기서 거르는** 까닭: 면이 없는 판은 잉크가
       없어 자르기가 원판을 통째로 들고 다니고(빈 판이 보관함에 쌓인다), 정규화
       측정도 0으로 나뉜다. 안 그릴 것은 안 그리는 것이 옳다.
       간헐천은 종전대로 남는다 — 마른 간헐천은 원작에서도 돌그릇이 남는다. */
    if (!gasSpot && resStageAt(res[0], res[1]) === 0) return null;
    const underGas = !!gasOn;
    // 고갈된 미네랄(요청)은 밭이 사라진다. 가스는 아래에서 색만 죽인다.
    /* 고갈 어림은 끈다(지적: 미네랄·간헐천에 모델 적용해야지 — 후반에 자원이
       통째로 사라져 있었다). 일꾼 수로 짐작하던 v1 어림이라 인과 증거가 없었다:
       자원 모델은 늘 세워 둔다. 가스 색이 죽는 연출까지 함께 걷었다. */
    // 미네랄 살짝 확대(요청) — 2.4 → 2.9타일 폭.
    /* 간헐천은 제 발자국 그대로 4타일(전수조사: 6.4타일로 그려져 제 발자국(4×2)
       보다 60% 넓었다 — 그 위에 앉는 정제소(4타일)가 못 덮어 가스 건물 주위로
       간헐천이 삐져나오던 원인이기도 하다). */
    // 미네랄 확대(재지적: 크기도 너무 작아) — 2.9 → 4.2타일 폭.
    /* 미네랄 폭을 4.2 → 3.0타일로(지적: 넥서스와 간헐천에 가려짐) — 실제 밭은
       2×1인데 4.2타일로 그리다 보니, 옆 간헐천(4타일)과 그림이 통째로 겹쳐
       화가 순서가 누가 이기든 한쪽이 가려졌다. 자원끼리의 가림은 순서로는 못
       푼다(둘 다 자원이라 같은 자를 쓴다) — 그림을 제 발자국에 가깝게 되돌려야
       겹치지 않는다. 3.0은 여전히 밭(2타일)보다 5할 크다. */
    /* 20% 축소(요청: "가스미네랄 모델 크기 축소 20프로") — 간헐천 4 → 3.2,
       미네랄 3 → 2.4타일. 간헐천의 제 발자국은 4×2라 3.2는 그보다 좁지만,
       자원은 그 위에 서는 건물·일꾼에 자리를 내주는 지물이라 발자국을 꽉
       채울 까닭이 없다. */
    /* 간헐천만 1.2배(요청: "간헐천 그려지는 크기 1.2배 확대") — 3.2 → 3.84.
       제 발자국이 4×2라 그 안에 여전히 든다(그 위에 서는 가스 건물이 3.0~4.0폭
       이라 덮는 관계도 그대로다). 미네랄은 이번 요청 밖이라 안 건드린다. */
    const wTiles = gasSpot ? 3.84 : 2.4;
    unitOps.push({
      fx, fy,
      /* 자원도 높이를 가진다(지적: 뒤 사물을 가려야) — 990 바닥층이 아니라 건물과
         같은 y순 층에 선다. 기준은 그림 상자의 아랫변(+1.2 — 건물 z가 발자국
         아랫변 기준이라 같은 자로 재야 함): +0.7로는 콜로니 뿔이 앞 미네랄을
         덮었다(지적: 가려짐 에러). */
      /* 자원은 같은 줄 건물보다 앞(지적: 미네랄이 가려진다) — 본진 셋을 발자국
         보다 크게 그리기 시작하면서, 앞줄 미네랄이 뒷줄 본진 그림에 덮였다. 자원의
         z를 반 타일(+40)만큼 올려 같은 줄이면 자원이 이긴다. 정말 앞에 선 건물
         (한 타일 이상 아래)은 여전히 자원을 가린다. */
      /* 화가 순서 기준을 그린 상자 아랫변으로(지적: 미네랄이 다른 요소에
         가려짐) — 고정 +1.2는 밭을 키우고 나서 실제 그림보다 위였다. 건물이
         발자국 아랫변을 쓰는 것과 같은 자로 맞춘다. */
      /* 자원이 건물에 가리는 것을 더 넓게 막는다(지적: 미네랄이 뒤에 있는 가스나
         건물에 가려짐) — 화가 순서는 '그림 아랫변'만 보는데, 건물 모형은 제 발자국
         보다 훨씬 크게 그려져(어시밀레이터의 지느러미·기둥) 한 줄 뒤에 서 있어도
         앞 미네랄을 덮는다. 자원의 앞섬 몫을 반 타일(40)에서 한 타일 반(120)으로
         넓혀, 정말 한 타일 반 넘게 앞에 선 건물만 자원을 가린다. 자원은 배경이라
         가려지면 지도가 안 읽히고, 반대로 자원이 조금 앞서 그려져도 어색하지 않다.
         가스 간헐천은 그 위에 정제소가 서면 아예 감춰지므로 같은 몫을 줘도 안전하다. */
      /* ★ 평면(90도)도 같은 자로 잰다(지적: "앞쪽 자원이 겹친 뒤쪽 자원이나
         뒤쪽 건물에 가려지는거야") — 여태 평면에서는 자원이 900대, 건물·유닛이
         1000대라 **자리와 무관하게 모든 건물이 모든 자원을 덮었고**, 자원끼리는
         배열 차례(ri)로 겹쳤다. 화면 기본값이 90도라 사람이 보는 것이 늘 그
         그림이었다. 90도에서도 모델은 높이를 갖고 그려지므로 화가 차례는
         평면에서도 자리 순이어야 맞는다. */
      z: 1000 + Math.round(res[1] * Z_TILE)
        + (underGas ? -2 * Z_TILE : Z_RES_AHEAD),
      /* 남은 단에 따라 별본을 고른다(요청: 고갈 표현) — 미네랄은 덩어리 수가
         줄고, 간헐천은 바닥나면 네온이 꺼진다. 가득(4)이면 본판 그대로다. */
      kind: gasSpot
        ? (resStageAt(res[0], res[1]) === 0 ? "geyserdry" : "geyser")
        : (() => {
          const lv9 = resStageAt(res[0], res[1]);
          /* ★ 꼴은 **자리가 정한다**(요청: "총 3종으로 할거고 랜덤하게 화면에서
             사용할거야") — 진짜 난수를 쓰면 프레임마다 밭이 다른 꼴로 바뀐다.
             밭의 타일 자리를 섞어 셋 중 하나를 고르면, 흩어진 것처럼 보이면서도
             같은 밭은 언제 봐도 같은 꼴이다(굽기 캐시도 그래야 산다). */
          const h9 = (Math.imul(res[0] | 0, 73856093)
            ^ Math.imul(res[1] | 0, 19349663)) >>> 0;
          const v9 = MIN_VARIANT_TAG[h9 % 3];
          return lv9 >= 4 ? `mineral${v9}` : `mineral${v9}${lv9}`;
        })(),
      viewYaw: viewYawOf(res[0], res[1]), flat: !pitched, pitch: pitched,
      sizePx: 0,
      wFrac: (wTiles / grid.width) * mkK,
      hFrac: ((wTiles * 0.75) / grid.width) * mkK,
      boxFit: "meet", fitWidth: true,
      /* 자원도 지면선에 앉힌다(지적: 간헐천·미네랄 위치도 그렇다) — 건물과 같은
         갈래의 어긋남이다. 상자 바닥을 화면에서 어림하지 않고, 같은 자리를 타일
         공간(칸 아랫변)에서 잡아 자리 사상으로 옮긴다. 평면에서는 값이 같아
         보이던 그대로고, 입체에서만 원근이 실려 제자리로 온다.
         ★ 지면선은 **제 발자국**의 아랫변이다(지적: "리파이너리 간헐천과 위치가
           어긋나") — 여태 '그린 상자'의 절반을 썼는데, 그린 상자는 발자국과
           무관하게 손으로 정한 크기(간헐천 3.2·미네랄 2.4타일)라 간헐천은 제
           발자국보다 0.2타일, 미네랄은 0.4타일 아래에 앉아 있었다. 그 위에 서는
           가스 건물은 발자국을 따르므로 그 차가 그대로 어긋남으로 보인다.
           발자국은 원작 표에서 온다(간헐천 4×2 · 미네랄 2×1). */
      baseFy: posFrac(res[0], res[1] + (gasSpot ? GEYSER_FOOT[1] : MINERAL_FOOT[1]) / 2)[1],
      color: gasSpot ? "#8f8274" : "#8fb9e8",
      /* ★ 미네랄 불투명도 0.55 → 0.9(요청: "미네랄 불투명도 많이 높이기") —
         **여기가 진짜 손잡이다.** 앞선 두 번의 '불투명하게'는 빌더 쪽에서
         바탕색을 진하게·그늘을 옅게 하는 것으로 답했는데(그 자리 주석),
         정작 밭 전체가 이 한 줄에서 알파 0.55로 깔려 있었다 — 무엇을 칠하든
         뒤가 45%씩 비쳤다는 뜻이다. 결정의 '수정 같음'은 알파가 아니라 흰
         광택이 낸다(아래 lit9)므로, 알파는 거의 닫고 광택을 키운다.
         밝혔지만 지금 안 보이는 자리의 자원은 절반만 — 기억이라는 표시다. */
      // 미네랄 밭 알파 0.9 → 0.72(요청: 더 연하고 투명하게) — 비침은 알파가 낸다.
      alpha: (gasSpot ? 1 : 0.72) * (rSeen9 === 1 ? 0.5 : 1), noShadow: true,
    });
    return null;
  });
      void rW9;
    }
    mines.forEach((m, mi) => {
      if (t < m.sec || (m.boom > 0 && t >= m.boom + 1.2)) return;
      const [mfx, mfy] = posFrac(m.x, m.y);
      if (m.boom === 0 || t < m.boom) {
        unitOps.push({
          fx: mfx, fy: mfy, z: 960 + mi, kind: "mine",
          viewYaw: viewYawOf(m.x, m.y), flat: !pitched, pitch: pitched,
          // 스파이더 마인은 원작 분류대로 소형(전수조사: dot 눈금 0.8배였다).
          sizePx: unitGlyphPx("mine", "mine", 0, m.y),
          /* 진형 간격 — 마인은 noSep이 아니라서 이완(밀어내기)에 드는 **유일한**
             유닛 op이다.
             3차 설계는 여기에 원작 몸 지름(15×15 = 0.469타일)을 **고정값**으로 실어
             크기표가 간격을 못 흔들게 했는데, 검증이 그것이 회귀임을
             실측으로 잡았다: 라디오와 크기표는 그림만 키우고 간격은 그대로라, 확대
             화면에서 그려지는 몸폭이 중심거리의 457%가 된다(지금은 68%라 절대 안
             겹친다). 마인은 한 자리에 여럿이 깔리는 물건이라 이게 바로 눈에 띈다.
             그래서 반지름을 **그려지는 몸**에 매단다 — 그려지는 몸폭이
             sizePx × (잉크상자/16)이므로, 그 폭이 중심거리(2×반지름)의 68%가 되는
             값을 쓴다. 라디오를 어디에 두든 비율이 지금 그대로다. */
          sepPx: (unitGlyphPx("mine", "mine", 0, m.y) * modelInkOf("mine")) / 16 / 1.36,
          color: modeColor(m.raw, teamOfRaw(m.raw) ?? 1),
          alpha: 0.95, noShadow: true,
        });
        return;
      }
      dom.push({ k: "mineboom", key: `mine-${mi}`, x: m.x, y: m.y });
    });
    {
    const r9 = buildsSrc.map(([sec, x, y, unit, raw, gone], i) => {
    if (sec > t) return null;
    const race = bases.find((b2) => b2.key === raw)?.race;
    if (race !== "저그") return null;
    const goneAt = gone ?? 0;
    if (goneAt > 0 && t >= goneAt + 1.2) return null;
    const cxb = x + footDx(unit);
    /* ★ 크립의 한가운데는 **발자국 한가운데**다(지적: "3D에서 크립 위치가 아직도
       위쪽으로 쏠린듯") ────────────────────────────────────────────────────────
       여기 있던 것은 `- riseOf(unit) / 2` — 타일 좌표로 크립을 북쪽(화면 위)으로
       반 뼘 밀던 자다. 넣은 까닭은 "건물이 발자국에서 위로 솟아 그려지니 크립도
       그만큼 올리자"였는데, 그건 **같은 증상에 두 번 처방한 것**이었다: 진짜
       원인은 크립 판의 상자와 그림의 비율이 어긋나 잉크 중심이 위로 밀리던 것이고
       (아래 hFrac·inkCenter 주석 — 해처리 15타일이면 1.5타일이나 밀렸다), 그쪽을
       고친 뒤로 이 줄은 **순수한 덤**으로 남아 크립만 위로 떠 있었다.
       게다가 이 밀기는 타일 좌표라 **보기마다 크기가 다르다**: 입체는 바닥이
       세로로 눌려 같은 반 뼘이 화면에서 절반으로 줄고, 평면은 온전히 실린다.
       한 처방이 두 보기에서 다른 그림을 내면 어느 쪽도 맞을 수 없다.
       크립은 땅이다 — 땅의 한가운데는 발자국의 한가운데이지, 그 위에 선 몸의
       무게중심이 아니다. 자리를 원래 자리로 되돌린다(잉크 가운데 맞춤은 그대로라
       '잉크가 곧 발자국 한가운데'가 된다). */
    const cyb = y + footDy(unit);
    const [cfx, cfy] = posFrac(cxb, cyb);
    /* 크립 확산(요청: 원작 규칙) — 해처리(레어·하이브)와 콜로니류만 시간이 갈수록
       크립이 넓게 퍼지고, 나머지 건물은 제 발밑만 적신다. 같은 자리의 앞선 같은
       계열(해처리→레어, 크립→성큰)에서 확산 시계를 이어받고, 경기 시작 본진
       해처리(sec 0)는 처음부터 만개다(원작: 첫 해처리는 크립을 다 깔고 시작). */
    const hallKind = ["Hatchery", "Lair", "Hive"].includes(unit);
    const colonyKind = unit.includes("Colony");
    let wTiles = 8;
    if (hallKind || colonyKind) {
      let startSec = sec;
      for (const [s2, x2, y2, u2, r2] of buildsSrc) {
        // 자리·계보는 위 succeedsBld와 같은 자를 쓴다 — 곁 콜로니의 시계를 안 물어온다.
        if (r2 !== raw || s2 >= startSec
          || Math.hypot(x2 - x, y2 - y) > SAME_SITE_TILES) continue;
        if (succeedsBld(u2, unit)) startSec = s2;
      }
      const maxW = hallKind ? 15 : 11;
      const minW = hallKind ? 8 : 5.5;
      const p = startSec <= 1 ? 1 : Math.min(1, Math.max(0, t - startSec) / CREEP_SPREAD_SEC);
      // 앞이 빠르고 갈수록 느린 번짐 — 반 타일 눈금이라 스프라이트도 계단으로만 다시 굽는다.
      const ease = 1 - (1 - p) * (1 - p);
      wTiles = Math.round((minW + (maxW - minW) * ease) * 2) / 2;
    }
    const mk3 = pitchK(cyb);
    /* 시점 보기 — 한 번도 못 본 자리의 **적 크립**은 안 그린다(요청: 3단 안개).
       밝혀 둔 자리는 그대로 둔다 — 크립은 땅의 모습이라 건물처럼 기억에 남는다. */
    /* 안개 층이 **유닛 캔버스 밑**으로 내려가면서(그쪽 주석) 크립·자원·잔상
       건물은 안개에 안 덮인다 — 대신 제 알파로 물러난다. 한 번도 못 본 자리는
       안 그리고, 밝혔지만 지금 안 보이면 절반만 칠한다. */
    const cSeen9: 0 | 1 | 2 = fogOn && teamOfRaw(raw) !== viewTeam
      ? seenAt(cxb, cyb) : 2;
    if (cSeen9 === 0) return null;
    unitOps.push({
      fx: cfx, fy: cfy, z: 880 + (i % 20),
      kind: i % 3 === 0 ? "creeppatch" : i % 3 === 1 ? "creeppatch2" : "creeppatch3",
      viewYaw: viewYawOf(cxb, cyb), flat: !pitched, pitch: pitched,
      sizePx: 0,
      wFrac: (wTiles / grid.width) * mk3,
      /* 상자 높이는 **그림의 실제 비율**이다(지적: "건물위치도 밀렸듯이 크립도
         밀려서 만들어져") — 0.75로 못 박아 두었는데 크립 얼룩의 잉크는 세로/가로
         0.953이다(실측: 도록으로 세 무늬를 구워 잉크 상자를 쟀다 — 셋 다 300×286).
         그리기가 `fitWidth`로 폭에 맞춰 키우고 `meet`로 **바닥 가운데** 정렬하므로,
         그림이 상자보다 0.203·폭만큼 높으면 그 절반쯤이 위로 삐져나간다:
         잉크 중심이 발자국 중심보다 0.1015·폭 위로 밀린다(해처리 15타일 크립이면
         1.5타일). 상자를 그림에 맞추면 바닥 정렬이 곧 가운데 정렬이 된다. */
      hFrac: ((wTiles * 0.953) / grid.width) * mk3,
      boxFit: "meet", fitWidth: true,
      // 자리는 상자가 아니라 잉크가 정한다(위 inkCenter 주석).
      inkCenter: true,
      color: "#544659",
      alpha: (goneAt > 0 && t >= goneAt ? Math.max(0, 1 - (t - goneAt) / 1.2) : 1)
        * (cSeen9 === 1 ? 0.5 : 1),
      noShadow: true,
      clipWalk: true,
    });
    return null;
  });
      void r9;
    }
    if (qBuildFx) buildsSrc.forEach(([sec, x, y, unit, raw], i) => {
      // 창은 CSS 애니 길이와 같아야 한다(아래 scr-touchdown 1.2초) — 짧으면 파문이
      // 다 퍼지기 전에 스팬이 걷혀 뚝 끊긴다.
      if (sec <= 0 || t < sec || t - sec > 1.2) return;
      const cameFrom = buildsSrc.some(([, x2, y2, u2, r2, g2, l2]) =>
        r2 === raw && u2 === unit && l2 !== undefined && (g2 ?? 0) === sec
        && (x2 !== x || y2 !== y));
      if (!cameFrom) return;
      /* 고리는 **그림자와 같은 평면**에 눕는다(요청: "충격파 그림자와 같은 각도
         눕히기") — 눌림 상수(pitchFlat) 하나로 세로만 줄이면 그건 화면에서 흉내
         낸 타원이라, 원근이 실린 그림자 다각형과 각이 안 맞는다. 자리 사상
         (posFrac)으로 **그 자리에서** 가로·세로 반지름을 각각 재면, 지도가
         그 줄에 실어 놓은 원근·기울기가 그대로 실린다 — 뜬 건물 그림자가
         shadowPts로 하는 일과 같은 자다. */
      const cx9 = x + footDx(unit);
      const cy9 = y + footDy(unit);
      const r9 = ((FOOTPRINT[unit] ?? [4, 3])[0] * 1.4) / 2;
      const wPct = Math.abs(posFrac(cx9 + r9, cy9)[0] - posFrac(cx9 - r9, cy9)[0]) * 100;
      /* 평면(90도)에서는 자리 사상이 눌러 주지 않는다(지적: "리프트랜딩 충격파도
         2디에서 너무 원이야 세로가 눌리지 않고") — posFrac은 입체에서만 원근을
         싣고, 평면에서는 타일 원이 화면 원 그대로 나온다. 그런데 이 화면의 평면
         바닥은 **의도적으로 눌려 있다**(원작 이동 마커와 같은 2:1 지면 관례):
         건물 접지 그림자도 평면에서 0.55를 곱해 깐다. 같은 값을 여기에도 쓴다 —
         충격파와 그림자가 같은 바닥에 누워야 한다는 것이 애초의 요청이다. */
      const hPct = Math.abs(posFrac(cx9, cy9 + r9)[1] - posFrac(cx9, cy9 - r9)[1]) * 100
        * (pitched ? 1 : GROUND_SQUISH_2D);
      dom.push({ k: "touchdown", key: `td-${i}`, x: cx9, y: cy9, wPct, hPct });
    });
    {
    const rW9 = buildsSrc.map(([sec, x, y, unit, raw, gone, liftAt, doneAt9], i) => {
    const goneAt = gone ?? 0;
    // 2 → 1초(요청: "시간 축소해") — CSS 애니도 같은 1초다.
    if (!goneAt || t < goneAt || t > goneAt + 1) return null;
    // 완성된 적이 있는 건물인가 — 공사·소환 중에 사라진 것(취소)은 같은 자리에 다시 서도 폭발을 건너뛰지 않는다(지적).
    const finished9 = (doneAt9 ?? 0) > 0 && (doneAt9 ?? 0) <= goneAt;
    /* ★ 뜬 건물이라고 다 '이사'는 아니다(요청: "테란 건물 공중에서 요격 시 …
       그냥 공중에서 폭파로 변경") ────────────────────────────────────────────
       여기 있던 조건은 `liftAt`뿐이었다 — 뜬 적이 있으면 무조건 폭발을 걸렀다.
       그 뜻은 '이륙 이사는 무너진 것이 아니다'였는데, **격추까지 함께 걸렸다**:
       공중에서 맞아 죽은 건물이 소리 없이 사라졌다. 가르는 자는 몸을 그리는
       쪽과 **같다**(위 landsAt9) — goneAt에 같은 사람의 같은 건물이 새 줄로
       이어서면 앉은 것이고, 없으면 공중에서 끝난 것이다. */
    const landed9 = liftAt !== undefined && goneAt > liftAt
      && buildsSrc.some(([s2,,, u2, r2]) => r2 === raw && u2 === unit && s2 === goneAt);
    if (landed9) return null;
    // 후계가 선 자리는 무너진 것이 아니라 변태·재건이다(위 succeedsBld와 같은 자).
    if (finished9 && buildsSrc.some(([s2, x2, y2, u2, r2], j) => j !== i && r2 === raw
      && s2 > sec && Math.hypot(x2 - x, y2 - y) <= SAME_SITE_TILES
      && succeedsBld(unit, u2))) return null;
    const race = raceOfName9(unit) ?? bases.find((b2) => b2.key === raw)?.race;
    const rk = race === "저그" ? "zerg" : race === "프로토스" ? "toss" : "terran";
    if (!qDeath) return null;
    /* 크기는 건물 발자국의 0.7배(재지적: 그래도 너무 큼 — 반으로) — 퍼센트 폭이라
       맵 확대에도 비례한다. */
    const clpW = (((FOOTPRINT[unit] ?? [3, 2])[0] * 0.56) / grid.width) * 100;   // 20% 축소(요청): 0.7 → 0.56
    /* 격추는 **뜬 높이에서** 터진다(같은 요청) — 몸이 거기 있었으니 불도 거기서
       나야 한다. 높이는 몸을 띄우던 식 그대로다(위 bFlyPx9): 발자국 폭 × 뜬 몫
       × 0.55. 뜬 몫은 죽는 순간의 값으로 **얼린다** — 둥실거림(sin)과 오르내림을
       폭발 1초 동안 계속 먹이면 잔해가 흔들리며 가라앉는다.
       자리 옮김은 margin으로 준다 — transform은 CSS의 가운데 맞춤
       (translate(-50%,-50%))이 이미 쓰고 있어, 인라인으로 덮으면 그 몫이 죽는다. */
    const flyUp9 = liftAt !== undefined && goneAt > liftAt
      ? ((): number => {
        const u9 = Math.min(1, Math.max(0, (goneAt - liftAt) / 0.9));
        const e9 = u9 * u9 * (3 - 2 * u9);
        return (FOOTPRINT[unit] ?? [3, 2])[0]
          * (mapW9 / grid.width) * e9 * 0.55;
      })()
      : 0;
    /* 파편 폭발도 얹는다(요청: 파괴 효과도 파편화) — 자는 발자국 폭, 1초. 옛 연기·심 DOM은 그대로 둔다. */
    // 저그 공사 고치(완성 전 사라짐)는 건물 폭발이 아니라 **작은 고치 파편**(지적: 너무 크고 푸른 파동) — 크기는 발자국의
    // 절반, 건물 갈래(bld) 아님, 아래 DOM 무너짐(충격파·연기)도 안 낸다.
    const cocoonB9 = !finished9 && rk === "zerg";
    if (t >= goneAt && t - goneAt <= BLD_FX_SEC) {
      const [bfx9, bfy9] = posFrac(x + footDx(unit), y + footDy(unit));
      fxOps.push({
        kind: "burst", fx: bfx9, fy: bfy9, lift: flyUp9, bld: !cocoonB9,
        size: (FOOTPRINT[unit] ?? [3, 2])[0] * (mapW9 / grid.width) * (cocoonB9 ? 0.5 : 1),
        ph: (t - goneAt) / BLD_FX_SEC,
        mat: cocoonB9 ? "cocoon" : rk === "terran" ? "mech" : rk, seed: i + 13,
      });
    }
    if (!cocoonB9) dom.push({ k: "collapse", key: `clp-${i}`, x: x + footDx(unit), y: y + footDy(unit), wPct: clpW, rk, flyUp: flyUp9 });
    return null;
  });
      void rW9;
    }
    {
    const r9 = entWalks.map((e, ei) => {
    const rp = e.walk;
    // 이 생애가 시작하기 전에는 안 그린다 — 걸음이 이미 구간으로 잘려 있다(위 ★).
    if (rp.n === 0 || t < e.born) return null;
    /* 죽음의 주인은 하나다(과제 #69) — 시뮬이 돌면 시뮬, 아니면 분석의 d다.
       분석이 체력 자취를 d에서 0으로 맞춰 주므로 '체력바가 0이면 즉사'는 저절로
       성립한다(체력 0 = d). 셋을 견주던 옛 사슬은 걷었다 — 그 셋이 서로 달라서
       화면·시뮬·체력바가 제각각 다른 순간에 유닛을 죽이고 있었다. */
    /* 끝나는 때는 **이 생애의 것**이다 — 자취(태그)의 죽음을 보면 라바가 드론이
       죽을 때까지 살아 있게 된다(위 ★). 변태로 끝난 생애는 여운도 없다: 다음
       생애가 같은 자리에서 바로 서므로, 1.2초를 더 두면 알 위에 라바가 겹친다. */
    const dieAt = e.died;
    /* 사망 여운 1.2 → 0.55 → 0.34초(요청: "지속시간도 더 짧게 줄이기") —
       몸은 죽은 자리에 못박히지만, 그 자리에 오래 남을수록 뒤에 오는 유닛이
       시체 위를 지나간다. CSS 애니(scr-diefx)의 길이와 **같은 값**이어야 한다 —
       여운이 더 길면 다 꺼진 빈 스팬이 남고, 짧으면 불덩이가 도중에 잘린다. */
    if (dieAt !== null && t >= dieAt + (e.end === "morph" || e.end === "own" ? 0 : DIE_FX_SEC)) return null;   // 손바뀜(own)도 여운 없음
    const team = teamOfRaw(e.raw);
    /* 걸음 속도 상한(요청) — 제 속도표로 죈다. 15%만 여유를 둔다: 교전 지연을
       따라잡는 몫이라, 이보다 크면 다시 '순간적으로 빨라짐'이 된다.
       드랍·리콜은 예외 — 원작에서도 순간이동이다. 수송 구간 앞뒤 여유를 두어
       하차 자리로 제때 나타나게 하고, 리콜은 같은 임자의 시전 전후 창으로 뺀다. */
    /* (걷어냄) vCap9 — 화면 추종의 **따라잡기 속도 상한**이었다(그 유닛의 걸음
       ×1.15). 승하차·리콜만 그 상한에서 빼 주던 두 판정(ridingNow9·recallNow9)도
       그 상한을 위한 것이었으므로 함께 걷는다: 추종이 사라진 지금 화면 자리는
       참값 그대로라, 순간이동을 허락할지 말지를 이 자리에서 물을 일이 없다
       (하차·리콜은 참값에서도 순간이동이고, 그것이 실제로 일어난 일이다). */
    /* 걸음 시계 — 코어 자취가 제 시각에 제자리라 지금 시각 그대로다.
       탐색(1.5초 넘는 건너뜀)은 지금 시각으로 맞추고, 싸우는 동안은 멈추며,
       그 밖에는 빚이 있으면 TRACK_CATCHUP으로 달려 따라잡는다. */
    /* 걸음 시계는 코어 것이다(과제 #61 → 정식 배포) — 빚·따라잡기·상한은
       "명령 좌표를 언제 지날까"를 렌더러가 어림하던 시절의 장치다. 코어
       자취는 이미 제 시각에 제자리라, 여기서 시각을 미루면 코어가 낸 값을
       렌더러가 도로 흔드는 꼴이 된다. */
    const eff9 = t;
    const rawPos = posAtW(rp, eff9, curOf9(WALK_CUR_B9, rp));
    if (!rawPos) return null;
    /* 시점 보기 — **적 유닛은 지금 보이는 자리에 있을 때만** 그린다(요청:
       원작대로 3단). 밝혀 둔 자리(1단)라도 유닛은 안 남는다 — 원작이 기억하는
       것은 건물뿐이다(아래 건물 잔상). 제 팀은 늘 그린다. */
    /* ★ **전체 시야 보기에서는 안 가린다**(지적: "유닛 사망폭발효과가 안나오는
       경우가 많은데 왜그래? 거의 대부분 안나오는듯") ────────────────────────────
       아무도 안 고른 기본 보기는 viewTeam이 0이다 — 곧 `team !== viewTeam`이
       **모든 유닛에게 참**이라, 이 문이 제 팀 남의 팀 없이 전부에게 걸려 있었다.
       살아 있는 동안은 그래도 멀쩡했다: 유닛은 언제나 제 임자의 시야 안이니
       seenAt이 2다(이 보기의 전제 — viewTeam 주석). 그런데 **죽는 순간 제 눈도
       함께 꺼진다**(안개를 굽는 쪽이 `end = min(died, …)`로 눈을 거둔다).
       그래서 그 자리를 비추던 것이 저 자신뿐이면 죽자마자 seenAt이 1로 떨어지고,
       사망 효과가 그리기도 전에 여기서 걷혔다. 한 무리가 함께 스러지면 그 무리의
       폭발이 통째로 사라진다 — "거의 대부분 안 나온다"가 그것이다.
       전체 시야 보기의 뜻은 '아무도 안 본 땅만 검다'이므로(그 주석) 이 문을
       그 보기에서는 아예 안 건다. 시점 보기(1·2팀)에서는 그대로다 — 그쪽은
       제 팀이면 문 자체를 안 지나고, 남의 팀이면 **내 눈**이 판정하므로 죽는
       개체가 제 눈을 거두는 것과 무관하다. */
    if (fogOn && !visAll && team !== viewTeam
      && seenAt(rawPos.x, rawPos.y) < 2) return null;
    /* ★ **화면 밖이면 여기서 끝**(위 cull9) — 이 아래로 1300줄이 마커·캔버스 명령·
       효과를 만든다. 4배로 당겨 보는 동안 그 대부분은 아무도 못 보는 것이었다.
       여유를 반 창씩 두었으니 가장자리에서 튀어나오지 않는다. 여기 걸리는 부속
       효과(gasBusy·dieFx9·unitOps·fxOps)는 모두 **그 자리에 그리는 것**이라
       함께 빠져도 어긋날 데가 없다 — 자리가 밖이면 그림도 밖이다. */
    if (cull9) {
      const [in9, dfx9, dfy9] = onScreen9(rawPos.x, rawPos.y);
      if (!in9) {
        // 점 하나만 남긴다 — 미니맵은 화면 밖을 봐야 한다(위 miniExtra ★).
        miniExtra.push({ fx: dfx9, fy: dfy9, color: modeColor(e.raw, team) });
        return null;
      }
    }
    /* ★ 참값 표본을 **여기서 한 번** 뜬다(지적: "증거주의가 아니라 모션 그대로
       재생 방식이야 이제 — 거기서 문제가 생기는듯") — 맞다. 여태 이 표본은
       한참 아래, 이미 교전을 판정하고 자리를 다 정한 **뒤**에 떠서 자리만
       덮어썼다. 그래서 그 사이의 판정들은 전부 유추 시절의 어림을 보고 내려졌다:
       싸우는지 아닌지도, 어디를 보는지도. 자취가 '지금 싸우는 중'을 실어 주는데
       거리 어림으로 다시 정하고 있었던 셈이다.
       표본을 걸음 바로 뒤로 당겨, 아래 모든 판정이 참값을 보고 서게 한다. */
    const simTr = simTracks?.get(e.tag);
    const simNow = simTr ? posAtSim(simTr, t) : null;
    /* 배 안이면 아예 안 그린다(참값이 그렇다고 말한다).
       ★ 승하차는 **점선만으로** 말한다(요청: "타고 내리는 순간이 너무 짧아서
         도는 거는 안 나와도 될 듯. 올라가고 내리는 거도" · "점선으로만 표시") —
         한때 이 문을 태우기 딜레이만큼 열어 몸이 작아지며 돌게 했는데, 그 창이
         0.38초라 회전도 떠오름도 한 결이 되기 전에 끝난다. 짧은 순간에 여러 겹을
         얹으면 읽히는 것이 아니라 어수선해질 뿐이다. 몸은 종전대로 그냥 사라지고,
         '어디로 갔나'는 배와 잇는 점선 하나가 말한다(아래 rideFx). */
    if (simNow && simNow.state === ST_INSIDE) {
      /* ★ **가스 건물의 불은 여기서 켠다**(지적: "가스 건물 활성화 반짝임 안
         나오는 듯") ─────────────────────────────────────────────────────────
         불을 켜던 자리(아래 inGas)는 이 문 **한참 뒤**에 있었다. 그런데 원작에서
         가스를 캐는 일꾼은 정제소 **안으로 들어가고**, 참값의 상태로 그것은 바로
         이 ST_INSIDE다 — 곧 캐는 일꾼은 예외 없이 여기서 돌아서 버려, 아래 자리
         판정에는 한 번도 못 닿았다. 불이 영영 안 켜지던 까닭이 이것이다.
         (아래 것이 잡던 것은 '발자국 한가운데를 지나가는' 일꾼뿐인데, 그건 캐는
          일꾼이 아니라 스쳐 가는 일꾼이다.)
         안에 든 몸이 어느 정제소 안인지는 **자리**가 말한다 — 그 몸의 자리는
         들어간 순간에 얼어 있으므로(참값의 규약) 제 정제소 발자국 안이다. */
      /* 일꾼만 본다 — 수송선 승객이 마침 제 정제소 위에서 얼어 있으면 엉뚱한
         불이 든다(드문 일이지만 문 하나가 값이 싸다).
         ★ `isWorker`가 아니라 `e.unit`을 보는 까닭 — 그 변수는 이 문보다 **아래**
           에서 선언된다(const라 여기서 읽으면 TDZ로 터진다. 타입 검사가 이것을
           안 잡아 줬다). 개체의 정체는 고리 변수가 이미 들고 있으므로 그것을 본다. */
      const isWk9 = e.unit === "SCV" || e.unit === "Probe" || e.unit === "Drone";
      /* ★ 상자가 아니라 **가장 가까운 것**으로 찾는다 ────────────────────────────
         앞판은 발자국만 한 상자(±1.6×1.1)를 놓고 그 안이면 그 정제소로 쳤다.
         그런데 안에 든 몸의 자리는 **들어가기 직전 자리**로 얼어 있고(참값의 규약),
         정제소는 4×2타일이라 그 자리가 발자국 모서리 쪽이면 한가운데서 2타일이
         넘는다 — 상자를 벗어나 아무 일도 안 일어났다.
         가스 건물은 서로 멀리 떨어져 있으므로 '가장 가까운 하나'면 헷갈릴 데가
         없다. 넉넉한 반경(3타일) 안에서 최솟값을 고른다. */
      const gasIn9 = !isWk9 ? undefined : gasBuildings.reduce<
        { litKey: string; d: number } | undefined
      >((best, g) => {
        if (g.raw !== e.raw || t < g.done || (g.gone !== 0 && t >= g.gone)) return best;
        const d9 = Math.hypot(g.x - rawPos.x, g.y - rawPos.y);
        if (d9 > 3) return best;
        return best && best.d <= d9 ? best : { litKey: g.litKey, d: d9 };
      }, undefined);
      if (gasIn9) gasBusy.add(gasIn9.litKey);
      return null;
    }
    /** 참값이 말하는 몸 방향 — 없으면 아래 어림이 맡는다. */
    /* ★ 참값 heading은 **정북이 0**이고, 이 화면의 각도는 **정남이 0**이다
       (지적: "이제보니 다 뒤로걸어"). 화면 쪽 규약은 세 군데가 같은 식을 쓴다 —
       headingOf·headingOfDisplay·표적 조준이 모두 atan2(-dx, dy)라, dy가 +일 때
       (곧 남쪽으로 갈 때) 0도다. 참값은 원작 direction_index 그대로여서 북이 0,
       동이 90이다. 둘을 맞대 보면 딱 반 바퀴 차이다:
         북 참0/화면180 · 동 참90/화면270 · 남 참180/화면0 · 서 참270/화면90.
       곧 화면각 = 참값각 + 180이고, 뒤집힘(거울)은 없다. 여태 이 반 바퀴를 안
       돌려 **모든 유닛이 제 등으로 걸었다**. 참값 자취를 그대로 재생하기
       시작하면서 들어온 자리다 — 그전에는 화면이 제 걸음에서 각을 냈으니
       규약이 저절로 맞았다. */
    const simHdg: number | null = simNow ? (simNow.hdg + 180) % 360 : null;
    /** 참값이 말하는 지금 상태 — 사주경계·교전 판정이 이걸 본다. */
    const simState: number | null = simNow ? simNow.state : null;
/* ★ **걷는 중인가는 참값 상태가 말한다**(지적: "이미 공격중으로 넘어갔는데도
이동중으로 뜨고 아주 느리게 이동 … 일꾼도 그렇고") ─────────────────────────
여태 이 판정은 posAt의 `moving`이었는데, 그건 **앞뒤 키의 좌표가 조금이라도
다른가**일 뿐이다. 자취 키는 3프레임(0.126초)마다인데 원작의 유닛은 붙어 서서
싸울 때도 밭 앞에 줄 설 때도 서로 밀고 밀리며 끊임없이 미세하게 움직인다 —
그 떨림이 전부 '이동 중'으로 읽혔다. 그래서 공격 상태로 넘어간 유닛도, 밭에
붙은 일꾼도 걷기 컷이 계속 돌아 '아주 느리게 이동하는' 것으로 보였다.
참값에는 그 답이 **상태로** 들어 있다(ST_MOVE·ST_CARRY_*). 그걸 쓴다.
참값이 없는 옛 개체만 예전 어림(posAt의 moving)으로 물러난다 — 그쪽도
replayTrack에서 문턱을 뒀다(초당 0.4타일 미만은 안 걷는 것으로 본다). */
    /* ★ 상태와 **실제 속도를 함께** 본다(지적: "정지중에 이동이 잘 이해가
       안돼") — 참값 상태는 그 순간의 일감을 말하지 늘 걸음을 말하지는 않는다:
       쫓아가는 중인데 FIGHT로, 자리를 비켜 주는 중인데 IDLE로 실릴 수 있다.
       그때 상태만 믿으면 다리는 멈춘 채 몸이 흘러가는 그림이 된다.
       그러니 둘 중 하나라도 '간다'면 걷는 것으로 본다 — 상태가 걸음이거나,
       자취가 실제로 초당 0.4타일 넘게 움직이고 있거나(replayTrack의 문턱). */
    const movingNow = simState !== null
      ? (simState === ST_MOVE || simState === ST_CARRY_MIN || simState === ST_CARRY_GAS
        || rawPos.moving)
      : rawPos.moving;
    /* 탑승 중(요청: 수송선 승하차) — 배 안에 있으니 마커를 걷는다.
       ★ (걷어냄) 몸에 걸리던 승하차 연출 넷 — 회전(한 바퀴)·축소·떠오름·페이드다
         (요청: "타고 내리는 순간이 너무 짧아서 도는 거는 안 나와도 될 듯.
         올라가고 내리는 거도" · "점선으로만 표시"). 창이 0.38초(태우기)·0.76초
         (내리기)뿐이라, 그 안에서 한 바퀴 돌고 떠오르기까지 하면 한 결로 안 읽히고
         어수선하기만 하다. 승하차를 말하는 일은 **배와 잇는 점선**이 혼자 맡는다
         (아래 rideFx) — 그쪽은 몸이 그려지든 말든 제 창을 산다. */
    /* 건설에 흡수(지적: 건설 끝난 일꾼이 복제된 자리에 계속 서 있음) — 현장에
       도착한 순간부터 숨는다. 공사 중 모습은 합성 건설 일꾼 연출의 몫이고,
       죽음이 아니라 소멸 효과도 없다. */
    if (e.buildHideAt !== null && t >= e.buildHideAt) return null;
    // 공사 중 구간(재재지적: 이중 표시) — 앵커~다음 증거 사이는 공사에 흡수돼 있다.
    if (e.buildHides.some(([ba2, bb2]) => t >= ba2 && t < bb2)) return null;
    /* 빙결(전수조사: 스태시스·마엘스톰·락다운) — 걸린 자리에 얼어붙는다. */
    const frzSt = e.statuses.find(([sa2, sb2, sk2]) =>
      FREEZE_STATUS.has(sk2) && t >= sa2 && t < sb2);
    const race = raceOfName9(e.unit) ?? bases.find((b) => b.key === e.raw)?.race;   // 개체의 종족은 이름이 정한다(마인드 컨트롤)
    const u = e.unit;
    /* 초반 무명은 일꾼(지적: 일꾼밖에 없는데 저글링이 정찰) — 그 사람의 첫 전투
       유닛이 태어나기 전의 무명 개체는 보병일 수 없다. */
    const drawUnit = u !== "" ? u
      : e.born < (entCombatStart.get(e.raw) ?? Infinity)
        ? (race === "저그" ? "Drone" : race === "테란" ? "SCV" : "Probe") : "";
    const isWorker = drawUnit === "SCV" || drawUnit === "Probe" || drawUnit === "Drone";
    /* 몸이 없는 개체는 안 그린다(지적: "핵 탄두도 마린으로 나와서 떨어지던데?")
       — 참값 자취에는 핵 탄두·스캐너 같은 **연출용 개체**도 제 태그로 실린다.
       그것들은 UNIT_3D에 이름이 없어 종족 폴백(테란이면 gunner)으로 떨어졌고,
       그래서 핵이 마린 모습으로 하늘에서 떨어졌다. 이 개체들의 그림은 이미
       제 연출(핵 낙하·스캔 원)이 그리므로 여기서는 몸을 안 낸다. */
    if (NO_BODY_UNITS.has(drawUnit)) return null;
    /* 버로우(지적: 러커와 버로우 러커가 같이 움직인다 / 변태 알에서 나오자마자
       버로우 상태로 나온다) — 여태 두 벌이었다: '안 움직이면 땅속'이라는 어림,
       그다음엔 커맨드 증거(f=18/19)를 접어 읽기. 이제 **참값 자취가 프레임마다
       직접 말한다**(ST_BURROW). 자리 못 박기도 필요 없다 — 땅속인 동안 자취
       자체가 그 자리에 서 있으므로, 구멍이 미끄러질 일이 없다. */
    const burrowed = BURROWABLE.has(drawUnit) && simState === ST_BURROW;
    /* 밭이 홀에 붙은 무한 맵인가 — 왕복 폭이 발자국보다 좁아, 아래 '홀에 들어간
       순간 숨김' 창이 왕복을 통째로 삼키는 경우를 가른다(지적). */
    let nearMine9 = false;
    const uAir = drawUnit !== "" && isAirUnit(drawUnit);
    /* 교전(지적: 상호작용 없음 + 어택땅 중 만나면 멈추고 싸워야) — 적 개체·방어
       건물이 시야 안이면 싸움이다: 그 자리에 멈춰 서고(engageHoldRef), 트레이서·
       불꽃이 인다. 일꾼·수송·옵저버는 안 싸운다(도망 대상일 뿐). */
    const holdKey = `${e.raw}-v2e${ei}`;
    /* ★ **공중 유닛도 싸운다**(지적: "미사일 류 효과 안보임") ────────────────
       `!uAir`가 여기 있던 까닭은 옛 '교전 붙기'다 — 적이 시야에 들면 그 자리에
       멈춰 서게 하던 장치인데, 나는 것은 멈춰 서지 않고 지나가므로 뺐다.
       그런데 이 값은 그 뒤에 **표적 찾기(wantFoe9)와 fighting**의 문이 되었다.
       그래서 레이스·발키리·스카우트·배틀·뮤탈·커세어… **나는 것 전부가 표적을
       한 번도 안 찾았고**, 표적이 없으니 조준각도 트레이서도 없었다. 미사일 갈래가
       통째로 안 보이던 것이 이것이다(그 넷 중 셋이 공중 유닛이다).
       자리를 밀던 그 장치는 이제 없다 — 그리는 자리는 참값 그대로다. 그러니 이
       값은 순수하게 '이 유닛이 무기를 지녔나'만 말하면 된다: 일꾼과 못 싸우는
       명단(ENGAGE_SKIP)만 뺀다. */
    const canFight = !isWorker
      && !(drawUnit !== "" && ENGAGE_SKIP.has(drawUnit));
    /* (걷어냄) noAir9 — '대공 무기가 없으면 떠 있는 건물은 표적이 아니다'를
       표적 찾기에 걸러 주던 자다. 참값이 표적을 말해 주는 지금은 물을 일이 없다:
       못 치는 것은 애초에 order_target이 안 된다. 같은 까닭으로 사라진 것들이
       아래 '어택 명령 되짚기' 주석에 함께 적혀 있다. */
    /* 표적 찾기는 **싸울 개체만**(계측: scripts/perf-check.mjs — sightBlocked
       24% + nearestFoe 3%로 CPU 자기 시간 1·2위였다) — 여태 걷기만 하는 일꾼
       까지 프레임마다 적 전부를 훑고(nearestFoe) 후보마다 지형 레이캐스트
       (sightBlocked)를 돌렸다. 참값이 있으면 '싸우는가'는 상태(ST_FIGHT)가
       말하고, 안 싸우는 개체의 foe는 아무 데도 안 읽힌다 — 몸 방향(foeDeg)·
       트레이서·조준 전부 fighting 게이트 뒤다. 버로우만 예외로 늘 찾는다
       (lurkStrike가 foe.air를 본다). 참값이 없는 옛 자취는 foe.bd가 곧
       fighting 판정이라 종전대로 찾는다. */
    /* 1·2배 칸에서는 **버로우한 것만** 찾는다(요청: 저배율 단순화) — 그 칸에서
       foe가 읽히는 자리는 조준각(foeDeg)과 트레이서뿐인데 둘 다 위에서 접었다.
       남는 것은 럴커 가시(lurkStrike)뿐이라 그것만 남긴다. 큰 교전에서 유닛
       수백이 저마다 적 전부를 훑고 지형 레이캐스트를 돌리던 삯이 통째로 빠진다. */
    /* ★ **포탑이 도는 유닛은 늘 찾는다**(지적: "탱크 포탑포신 아직도 공격대상
       안바라봄" · "시즈모드 포탑+포신을 목표물로 향하게 돌려야하는데 예전엔 됐는데
       왜 안돼지") ─────────────────────────────────────────────────────────
       이 게이트는 성능을 위해 '싸우는 개체(ST_FIGHT)만 적을 찾는다'로 좁혀 둔
       것이다. 그런데 탱크의 포탑은 **싸움이 시작되기 전에 이미 돌아 있어야** 한다:
       원작의 탱크는 사거리 안에 적이 들어오는 순간 포탑부터 돌리고, 시즈는 12타일
       밖에서 서 있는 동안에도 표적을 겨눈다. 참값의 ST_FIGHT는 실제로 사격 명령이
       붙은 프레임에만 서므로, 걷다 멈춰 선 탱크·박아 둔 시즈는 대부분의 시간 동안
       foe가 Infinity였고 → foeDeg가 null → 포탑이 차체를 그대로 따랐다.
       (예전에 됐던 까닭도 이것이다 — 이 게이트가 없던 시절에는 늘 찾았다.)
       포탑 판을 가진 종류(탱크 두 모드)만 예외로 되돌린다. 개체 수가 적은
       종류라 훑는 삯이 다시 붙어도 큰 교전의 부담이 아니고, 애초에 포탑 판
       자체가 4배 이상(!liteView)에서만 그려지므로 같은 문턱을 함께 쓴다. */
    /* ★ **골리앗도 포탑 유닛이다**(지적: "골리앗 뮤탈 상대로 미사일 트레이서
       안 나옴 — 근본 원인 파악 필요") ────────────────────────────────────────
       원작에서 골리앗의 **대공 무기(Hellfire Missile Pack)는 포탑 부속(Goliath
       Turret)의 것**이고, 본체의 것은 지상 무기(Twin Autocannons)뿐이다. 참값의
       ST_FIGHT는 위 주석대로 **본체에 사격 명령이 붙은 프레임**에만 서므로,
       골리앗이 공중을 쏘는 동안 본체는 FIGHT가 아니다. 그러면 아래 wantFoe9가
       거짓이 되어 **표적조차 안 찾고**, fighting도 거짓이라 트레이서 갈래가
       통째로 건너뛴다 — 지상 표적일 때만 멀쩡했던 까닭이 이것이다(그때는 본체가
       쏜다). 앞서 탄이 보이는 몫을 9~28%에서 48%로 올린 것은 이 자리와 무관해서
       증상이 그대로였다.
       브루드워에서 포탑 부속을 가진 지상 유닛은 시즈 탱크와 골리앗 둘뿐이고,
       탱크는 이미 같은 까닭으로 여기 들어 있다. */
    const turretUnit9 = drawUnit.startsWith("Siege Tank") || drawUnit === "Goliath";
    const tgtTag9 = tkLast(e.tgt, t);
    const wantFoe9 = simState !== null
      /* 표적 찾기의 문턱도 트레이서와 같다(요청: 2배부터) — 겨눈 표적이 없으면
         각도(beamDeg)도 길이(beamLen)도 없어 트레이서를 아예 못 만든다. 포탑
         판은 여전히 4배 이상에서만 얹히지만(아래 gunKind 게이트) 겨눔은 그보다
         낮은 칸에서도 필요해졌다. */
      /* ★ **쫓는 유닛도 찾는다**(지적: "도망가는 오버로드를 상대가 타게팅을 못하는지 트레이서가
         안 나가") — 참값의 ST_FIGHT는 사격 명령이 붙은 프레임에만 서고, 달아나는 표적을 뒤쫓는
         동안은 MOVE다. 표적(order_target)은 참값이 계속 들고 있으므로 MOVE + 표적이면 찾아 두고,
         싸우는지는 아래 chaseAim9가 사거리로 가른다. */
      ? (!markerView && (((simState === ST_FIGHT || turretUnit9
        || (simState === ST_MOVE && tgtTag9 !== 0))
        && canFight && !frzSt && tracerView)
        || burrowed))
      : true;
    /* uk — 표적의 원작 유닛 이름. 그 몸이 떠 있는 높이를 **표적 제 크기**로
       재는 데 쓴다(아래 foeLift9). nearestFoe가 FoeRow에서 실어 준다. */
    /* ★ 표적은 **참값이 말한다**(지시: "지금 갖고 있는 표적을 정확히 명시할 필요가
       있어 보임" · "다른 유닛도 모두 공통으로 다 걷어내") ─────────────────────────
       여기 있던 것은 `nearestFoe` — '가장 가까운 적'이라는 어림이었다. 원작 유닛은
       명령 표적·자동 획득 표적을 따로 들고 있어서 그 어림이 자주 틀렸고, 틀린
       표적이 조준각·트레이서·스플래시에 **한꺼번에** 실려 서로 다른 것을 가리켰다
       (지적: "스플래시와 줄기가 다른 대상을 가리키는 문제").
       이제 덤퍼가 `order_target.unit`을 실어 준다(참값 판 6) — 원작이 매 프레임
       들고 있는 그 값이라 어림이 한 톨도 안 든다. 메딕도 같은 길이다: 치료하는
       동료가 곧 그 유닛의 order_target이라, 아군 찾기 갈래가 통째로 필요 없다.
       ★ 옛 판(tgt 없음)은 **아무 표적도 없다** — 어림으로 메우지 않는다. 그러면
         트레이서·교전 자세가 안 나오는데, 그게 옳다: 그 판은 참값이 모르는 것이고
         대역을 세우면 나중에 참값이 틀려도 아무도 못 찾는다(지시). 다시 구우면 산다.
       ★ 딸려 사라진 삯 — 매 프레임 적 명단을 8타일 격자에 담고, 후보마다 지형
         레이캐스트(sightBlocked)를 쏘고, 어택 명령 45초 창을 역순으로 훑던 일이
         전부 태그 한 번 찾기로 바뀐다(계측에서 표적찾기·시야가 늘 위쪽이었다). */
    /* ★ 편·체력도 함께 싣는다 — 메딕의 표적은 **적이 아니라 아군**이라, 이
       표적이 '고칠 수 있는 몸인가'를 묻는 데 그 둘이 든다(아래 healing9).
       때리는 쪽에는 안 쓰이므로 값을 더 셈하지 않는다(명단이 이미 들고 있다). */
    let foe: {
      bx: number; by: number; bd: number; air: boolean;
      bld?: boolean; k?: string; uk?: string; team?: number; hp?: number;
    } = ((): {
      bx: number; by: number; bd: number; air: boolean;
      bld?: boolean; k?: string; uk?: string; team?: number; hp?: number;
    } => {
      const none9 = { bx: 0, by: 0, bd: Infinity, air: false };
      if (!wantFoe9 || !tgtTag9) return none9;
      const tp9 = entPosByTag.get(tgtTag9);
      /* 표적 지도에 없으면 그 몸은 지금 화면의 것이 아니다(죽었거나 실려 있거나
         지도가 그리는 자원이다) — 참값이 가리켜도 그릴 것이 없으므로 없는 것으로 둔다. */
      if (!tp9) return none9;
      return {
        bx: tp9.x, by: tp9.y,
        bd: Math.hypot(tp9.x - rawPos.x, tp9.y - rawPos.y),
        /* ★ **떠 있는 건물은 공중 표적이다**(지적: "골리앗이 떠 있는 건물 공격할
           때 지상 트레이서가 나감") — 명단은 그 사실을 lifted로 따로 들고 있는데
           (FoeRow의 그 주석: "띄운 건물은 공중 유닛이다"), 여기서 air만 실어
           보내니 아래 무기 고르기가 지상 무기를 골랐다. 골리앗·레이스·스카우트는
           표적이 공중이냐로 대공/지상 무기가 갈리므로 이 한 칸이 곧 그 갈림이다.
           여기서 접어 두면 무기·사거리·조준 높이가 한꺼번에 옳아진다. */
        air: tp9.air || tp9.lifted === true,
        bld: tp9.bld, k: tp9.k, uk: tp9.uk ?? tp9.k,
        team: tp9.team, hp: tp9.hp,
      };
    })();
    /* (걷어냄) **어택 명령 되짚기** — 최근 명령에 실린 태그를 표적으로 삼던 자다.
       참값이 표적을 말해 주는 지금 이 되짚기는 어림을 하나 더 얹는 일일 뿐이다:
       명령은 '누르라고 시킨 것'이고 참값은 '실제로 겨눈 것'이라, 둘이 갈리면
       화면에 나가는 것은 참값이어야 한다(사람이 찍은 표적이 죽었거나, 가는 길에
       다른 것을 자동으로 물었거나 하는 일이 흔하다).
       함께 사라진 것들: 태그 미해석 폴백(클릭 좌표 3타일 안의 적 건물 잇기)·
       스태시스/은신 걸림망·못 치는 표적 거르기·시야 가림 판정 — 전부 '이 표적을
       정말로 겨눌 수 있나'를 우리가 다시 판정하던 몫이고, 참값에는 그 답이 이미
       들어 있다(못 겨누는 것은 애초에 order_target이 아니다). */
    /* 히스테리시스(지적: 이동 중 위치가 앞뒤로 잘게 플리커) — 시야 경계에 선
       적 때문에 교전이 프레임마다 켜졌다 꺼지면, '멈춘 자리'와 '지연 걸음' 사이를
       오가며 흔들렸다. 들어올 땐 시야, 나갈 땐 시야×1.3이라 경계에서 안 떨린다. */
    const engagedBefore = engageHoldRef.current.has(holdKey);
    /* 붙는 거리는 시야가 아니라 **자동 획득 사거리**다(과제 #48) — 여태 이 파일의
       교전은 전부 ENGAGE_SIGHT_TILES 9 하나로 갈렸다. 그래서 저글링(획득 3)이
       화면 반대편의 적을 보고 달려들고, 시즈 모드(12)는 오히려 사거리 안에 든
       적을 보고도 더 걸어 들어갔다. 원작은 시야·자동 획득·무기 사거리가 셋 다
       다른 값이고, 여기 필요한 것은 가운데 것이다. 표에 없는 이름과 획득값 0
       (드랍십·베슬·오버로드처럼 스스로 표적을 안 잡는 것들)만 옛 9로 물러난다 —
       지어낸 값을 쓰느니 알던 어림이 낫고, 그것들은 어차피 canFight에서 걸린다. */
    const acq9 = drawUnit !== "" && isKnownKind(drawUnit)
      ? (acquireTilesOf(drawUnit) || ENGAGE_SIGHT_TILES) : ENGAGE_SIGHT_TILES;
    /* ★ 싸우는가는 **참값이 말한다**(지적: 모션 그대로 재생) — 자취의 상태에
       FIGHT가 실려 있다. 아래 거리 어림(획득 사거리·히스테리시스·어택 명령
       되짚기)은 자리를 유추하던 시절에 "이쯤이면 붙었겠다"를 셈하던 장치라,
       참값 위에 얹으면 실제로 싸운 유닛을 안 싸운다고 하거나 그 반대가 된다.
       참값이 없는 개체(옛 판·굽다 만 판)만 옛 어림으로 물러난다.
       표적(foe)은 그대로 쓴다 — 그건 '싸우나'가 아니라 '어느 쪽을 보고 쏘나'라
       연출의 몫이고, 참값에는 그 답이 없다. */
    /* ★ 인터셉터·스캐럽이 조용하던 까닭은 **참값 쪽**에 있었다(지적: "인터셉터
       트레이서도 안 나옴") — 덤퍼가 싸움(상태 4)으로 치는 명령 넷에 그 둘의 제
       명령(InterceptorAttack·ScarabAttack)이 빠져 있었다. 고치는 자리는 덤퍼다
       (bwdump.cpp의 그 자리) — 여기에 거리 어림을 하나 더 세우면 참값 옆에 대역이
       생기고, 그 둘이 언젠가 다른 답을 낸다. 그 판들은 **다시 덤프하면** 살아난다. */
    /* ★ 포탑 유닛은 **ST_FIGHT 말고 참값의 표적으로도** 싸운다고 본다(위 주석).
       지어내는 것이 아니다: 참값이 준 order_target이 있고 그것이 이 유닛의 제
       사거리 안일 때만이다 — 표적은 참값이고 사거리는 표가 말한다. 포탑이 도는
       둘(탱크·골리앗)에만 걸리므로 다른 유닛의 결은 한 톨도 안 바뀐다. */
    const turretAim9 = turretUnit9 && Number.isFinite(foe.bd)
      && isKnownKind(drawUnit)
      && foe.bd <= reachTiles(drawUnit,
        foe.uk && isKnownKind(foe.uk) ? foe.uk : drawUnit, foe.air);
    /* ★ 쫓으며 쏜다(같은 지적) — 포탑 유닛의 자와 같다: 참값의 표적이 있고, 적이며, 제 사거리 안이면
       MOVE 상태여도 싸우는 것으로 본다. 원작에서 달아나는 표적을 뒤쫓는 유닛은 사거리에 들 때마다
       쏘는데, 그 짧은 사격 프레임은 덤퍼의 키 사이로 빠지기 일쑤였다. */
    const chaseAim9 = simState === ST_MOVE && tgtTag9 !== 0 && Number.isFinite(foe.bd)
      && (foe.team ?? 0) !== (team ?? 0) && isKnownKind(drawUnit)
      && foe.bd <= reachTiles(drawUnit,
        foe.uk && isKnownKind(foe.uk) ? foe.uk : drawUnit, foe.air);
    let fighting = simState !== null
      ? ((simState === ST_FIGHT || turretAim9 || chaseAim9) && canFight && !frzSt && !burrowed)
      : (canFight && !frzSt && !burrowed && Number.isFinite(foe.bd)
        && (foe.bd <= acq9 * (engagedBefore ? 1.3 : 1)
          || (foe.bld === true && foe.bd <= ENGAGE_SIGHT_TILES * 1.6)));
    let pos = rawPos;
    /* ★ 버로우 예고(요청: 럴커 버로우 때 땅 파는 모션 — 이동을 그만큼 일찍 멈추고, 버로우할 자리에서 애니메이션 뒤 바로
       땅속 상태) ─────────────────────────────────────────────────────────────────
       참값이 ST_BURROW로 바뀌는 시각 T1을 **미리** 본다(키를 앞으로 훑는다 — 워커가 앞을 짓는 구조라 값이 싸다).
       [T1−BURROW_DIG_SEC, T1) 동안은 자리를 T1의 자리(버로우 지점)에 못 박고 파는 동작을 하며(아래 digging9),
       T1부터는 곧장 땅속 판이다. 옛 방식(상태가 바뀐 **뒤**에 파기)은 버로우 완성과 첫 가시가 파는 창만큼 늦었다. */
    const burrowNext9 = ((): number | null => {
      if (!simTr || !BURROWABLE.has(e.unit)) return null;
      if (simNow && simNow.state === ST_BURROW) return null;
      const kt9 = simTr.kt;
      const n9 = kN(simTr);
      let lo9 = 0;
      let hi9 = n9;
      while (lo9 < hi9) { const m9 = (lo9 + hi9) >> 1; if (kt9[m9] <= t) lo9 = m9 + 1; else hi9 = m9; }
      for (let i9 = lo9; i9 < n9 && kt9[i9] <= t + BURROW_DIG_SEC; i9 += 1) if (kS(simTr, i9) === ST_BURROW) return kt9[i9];
      return null;
    })();
    if (burrowNext9 !== null && simTr) {
      const spot9 = posAtSim(simTr, burrowNext9) ?? posAtW(rp, burrowNext9);
      if (spot9) pos = { ...pos, x: spot9.x, y: spot9.y, moving: false, sinceLast: 0 };
    }
    /* ★ 시즈·언시즈도 같은 규약(요청) — Siege/Unsiege 커맨드 증거 그대로 판정하되, 명령 시각부터 SIEGE_XF_SEC 동안은
       **전환 중**이다: 자리를 명령 시각의 자리에 못 박고(움직임 없음), 몸은 앉았다 일어나며(아래 rise), 앞 반은 옛 판·
       뒤 반은 새 판(drawUnit2)이다. 사거리·사격·몸 각의 대각 고정(siegeOn)은 창이 **끝나야** 새 모드다. 창 안에 반대
       명령이 오면 마지막 것이 이긴다(전환 시작을 그때로 옮긴다). */
    let siegeOn = 0;
    let siegeXf9: { to: number; u: number; at: number } | null = null;
    for (const [ss2, on2] of e.sieges) {
      if (ss2 > t) break;
      if (on2 === siegeOn) { siegeXf9 = null; continue; }
      if (t < ss2 + SIEGE_XF_SEC) siegeXf9 = { to: on2, u: (t - ss2) / SIEGE_XF_SEC, at: ss2 };
      else { siegeOn = on2; siegeXf9 = null; }
    }
    if (siegeXf9 && drawUnit.startsWith("Siege Tank")) {
      const spotS9 = (simTr ? posAtSim(simTr, siegeXf9.at) : null) ?? posAtW(rp, siegeXf9.at);
      if (spotS9) pos = { ...pos, x: spotS9.x, y: spotS9.y, moving: false, sinceLast: 0 };
    } else siegeXf9 = null;
    /** 그려지는 모드 — 전환 창 동안은 **탱크 차체 + 따로 겹치는 버팀다리 판**(아래 legK9)이고, 구운 시즈 판은 창이
     *  끝나야(시즈) 또는 창이 시작하며(언시즈) 바뀐다. 다리 셋이 몸에서 뻗어 나와 땅을 짚고, 언시즈는 거꾸로 접힌다(요청). */
    const siegeShow9 = siegeXf9 ? 0 : siegeOn;
    const legK9 = siegeXf9
      ? 0.3 + 0.7 * Math.min(1, Math.max(0, siegeXf9.to === 1 ? siegeXf9.u : 1 - siegeXf9.u))
      : null;
    /* 교전 당김·홀드·잽은 코어가 켜지면 안 돈다(과제 #61) — 코어는 표적까지
       걸어가 사거리에서 멈추는 일을 제 이동 모형으로 이미 했다. 여기서 한 번 더
       끌면 두 모형이 같은 몸을 밀고, 어차피 아래에서 코어 자리로 덮여 버려질
       값을 프레임마다 셈하는 것이기도 하다. */
    // 다음 프레임을 위한 걸음 시계 기록 — 싸우는(유예 포함) 동안은 멈춰 둔다.
    /* 가스 왕복(지적: 가스 캐는 일꾼이 하나도 없다) — 배정 클릭은 한 번만 남고
       그 뒤는 게임이 자동 순환이라, 개체가 정제소 위에 서서 건물에 가려져 있었다.
       제 정제소 곁(2타일)에 선 일꾼은 가장 가까운 홀과 그 사이를 결정적으로
       왕복한다 — 어림 장식이 아니라, 그 일꾼이 실제로 가스에 배정된 개체다. */
    /* 채취 왕복도 코어 몫이다(과제 #61) — 코어에는 밭 배정과 왕복이 들어 있다
       (simCore.assignJob). 렌더러의 결정적 왕복은 코어가 없던 때의 대역이라,
       켜져 있으면 같은 일꾼을 두 박자로 흔들 뿐이다. */
    /* 변태·건설로 흡수되기 직전엔 그 자리로 들어간다(요청: 드론 변태도 고치
       중앙에 놔야 자연스럽다) — 예전엔 제자리에서 그냥 사라져, 고치는 발자국
       한가운데에 솟는데 드론은 옆에서 없어졌다. 앵커 1.2초 전부터 발자국 중앙
       (고치와 같은 자리 보정 포함)으로 미끄러져 들어간다. */
    if (isWorker) {
      const site9 = e.buildSites.find((v) => t >= v[0] - 1.2 && t <= v[0] + 0.2);
      if (site9) {
        const bRow9 = buildsSrc.find(([bs9, bx9, by9, , br9]) =>
          br9 === e.raw && Math.abs(bs9 - site9[0]) <= 3
          && Math.abs(bx9 - site9[1]) <= 1.5 && Math.abs(by9 - site9[2]) <= 1.5);
        const fp9 = FOOTPRINT[bRow9 ? bRow9[3] : ""] ?? [3, 2];
        const tx9 = site9[1] + fp9[0] / 2;
        const ty9 = site9[2] + fp9[1] / 2 + CONSTRUCT_DROP;
        const k9 = Math.min(1, Math.max(0, (t - (site9[0] - 1.2)) / 1.2));
        pos = { ...pos, x: pos.x + (tx9 - pos.x) * k9, y: pos.y + (ty9 - pos.y) * k9 };
      }
    }
    /* 자원 반납 순간은 숨는다(요청: 기지 겹침은 허용하되 들어간 순간 렌더링에선
       숨기기) — 왕복 자리가 제 홀 발자국 안이면 그 프레임은 안 그린다. 원작도
       반납하는 일꾼은 건물 속으로 잠깐 사라진다. */
    if (isWorker && !nearMine9) {
      /* 밭이 홀에 붙은 무한 맵에서는 아예 안 숨긴다(지적: 일꾼이 일을 안 하는
         것처럼 보임) — 왕복 폭이 발자국보다 좁아 숨김 창이 왕복을 통째로
         삼켰다. 아래 창은 밭이 3타일 넘게 떨어진 보통 맵에서만 건다. */
      /* 숨김 창을 좁힌다(지적: 첫 4기가 채취하는 게 안 보인다) — ±1.8×1.3타일은
         4×3 발자국의 거의 전부라, 반납 왕복의 절반을 건물 속으로 삼켰다(실측:
         경기 20초에 일꾼 41기가 이 규칙으로 사라졌다). 정말 안으로 들어간
         한가운데(±1.15×0.85)만 숨긴다. */
      /* ★ **완공된** 건물에만 건다(지적: "공사중 scv가 엉뚱한데 나오고 자꾸
         사라졌다 나왔다 함") — 여태 문턱이 `h.sec <= t`, 곧 **착공** 시각이었다.
         그래서 커맨드센터를 짓는 SCV가 제 발자국 한가운데(±1.15×0.85)에 서
         있는 동안 통째로 숨었고, 공사하며 발자국 안팎을 오가면 그 좁은 창을
         넘나들며 깜빡였다 — 보이는 순간은 늘 발자국 가장자리라 '엉뚱한 데'로
         읽혔다. 이 숨김은 '자원 반납하러 건물 안으로 들어간 순간'을 위한 것이지
         짓는 중인 자리를 위한 것이 아니다. */
      const inHall = halls.some((h) => h.raw === e.raw && t >= h.done
        && (h.gone === 0 || t < h.gone)
        && Math.abs(h.x - pos.x) <= 1.15 && Math.abs(h.y - pos.y) <= 0.85);
      if (inHall) return null;
      /* 가스 건물도 같은 규칙(지적: 가스 일꾼이 들어가기 한참 전에 사라짐) —
         발자국 한가운데(문턱 1.4×0.7)에 정말 '들어간 순간'만 숨는다. 다가가는
         동안은 그대로 보인다. */
      /* 가스 건물도 같은 병이었다 — 문턱이 착공(bs6 <= t)이라, 정제소를 짓는
         일꾼은 짓는 내내 숨어 있었다. 완공 시각을 아는 gasBuildings를 쓴다. */
      const inGas = gasBuildings.find((g) => g.raw === e.raw && t >= g.done
        && (g.gone === 0 || t < g.gone)
        && Math.abs(g.x - pos.x) <= 1.4 && Math.abs(g.y - pos.y) <= 0.7);
      if (inGas) {
        // 이 프레임 이 건물은 캐는 중이다 — 창에 불이 든다(아래 gasBusy 소비부).
        gasBusy.add(inGas.litKey);
        return null;
      }
    }
    /* 코어 자리로 못 박는다(기획서 P1, ?sim=1) — 이제 위의 걸음(rawPos)부터가
       코어 자취를 읽은 값이라(과제 #61) 여기서 자리가 달라질 일은 사실상 없다.
       남는 몫은 둘이다: 코어만 아는 몸 방향(hdg)과, 배 안(ST_INSIDE)이면 아예
       안 그리는 판정. 코어 결과가 아직 없으면(계산 중·실패) 렌더러 길 그대로다.
       아래 스무딩도 코어면 건너뛴다 — 이미 제 속도로 적분된 자리다. */
    if (simNow) pos = { ...pos, x: simNow.x, y: simNow.y };
    /* ★ (걷어냄) **언 몸의 자리 못 박기**(지적: "스테이시스 — 걸린 대상이 풀릴
       때 순간이동함 조금") ─────────────────────────────────────────────────
       여기 있던 것은 얼어붙은 동안 몸을 '걸린 그 순간의 자리'에 붙들어 두는
       한 줄이었다. 들어올 때의 사정은 옳았다 — 그때 자리를 대던 것이 **시뮬
       코어**라, 코어가 스태시스를 모르고 제 갈 길을 계속 걸었기 때문이다.
       그 사정이 사라졌다. 지금 자리를 대는 simTracks는 이름만 sim이고 실은
       **서버가 리플레이를 그대로 돌려 구운 참값**이다(그 선언부 주석). 참값의
       언 유닛은 스스로 안 움직인다 — 붙들 것이 없다.
       남은 것은 해악뿐이었다. 붙드는 창의 길이(STATUS_CASTS의 dur = 30초)는
       우리가 적어 넣은 **어림**인데, 참값이 푸는 시각은 게임이 정한 진짜 값이다.
       둘이 어긋나면 어긋난 만큼 몸이 옛 자리에 남아 있다가, 창이 끝나는 순간
       참값 자리로 **순간이동해** 따라붙는다. 지적한 그 튐이 이것이다.
       자리는 참값 그대로 둔다. 어림인 창은 이제 우리(cage)·못 싸움 판정·표적
       제외에만 쓰인다 — 틀려도 대가가 그림 한 겹이지 순간이동이 아니다.
       (같은 교훈이 바로 아래 '서 있는 몸 못 박기'를 걷을 때도 적혔다.) */
    /* (걷어냄) **서 있는 몸 못 박기** — 슬라이딩을 잡겠다고 넣었던 자리다.
       지적: "아까 슬라이딩 문제를 완전 잘못 짚은거 같아 … 이동 관련 보간 보정은
       다 삭제". 맞다: 참값이 정확한데 그 위에 자리를 덮어쓰는 것은 어떤 이름을
       붙이든 보정이고, 실제로 못 박기가 풀릴 때 순간이동을 새로 만들었다.
       그리는 자리는 이제 참값 그대로다 — 슬라이딩의 진범은 아래 겹침 이완이었다
       (UnitLayer 쪽 주석). */
    /* (걷어냄) 땅속 자리 못 박기 — 커맨드 증거로 '판 시각'을 알아내 그 자리에
       고정하던 자리다. 참값 자취는 땅속인 동안 스스로 안 움직이므로 필요 없다. */
    /* ★ (걷어냄) **화면 위치 추종** — 요청: "이제 이동은 정확한 참값을 가지니까
       보정같은거 제거해줘". 그 말이 맞다. 여기 있던 것들의 계보는 이렇다:
         ① 지수 추종(EMA) — 자리를 명령 좌표로 **유추하던** 시절, 명령이 찍힐
            때마다 몸이 순간이동하던 것을 뭉개려고 넣었다.
         ② 속도 제한 추종 — 그 지수 추종이 목표에 가까울수록 느려지는 흠을
            고친 판이다(지적: "목표지점에 다와가서 느려지면서 다가가게 되는").
       둘 다 **없는 자리를 지어내던 시절의 대역**이다. 지금 rawPos는 코어가 낸
       참값 자취를 읽은 값이라 그 자체가 이미 매 순간 제자리이고, 추종을 얹으면
       참값 위에 한 겹을 더 씌워 늘 조금씩 뒤처진 자리를 그린다 — 그 뒤처짐을
       메우는 움직임이 곧 재지적의 "목적지에 다 와서도 아주 느린 속도로 이동"
       이다(추종은 어긋남이 남아 있는 한 계속 기어간다).
       이제 그리는 자리는 참값 그대로다. 잔점프 걱정은 이 자취에는 없다 —
       코어가 프레임마다 제 이동 모형으로 적분한 값이라 애초에 안 튄다. */
    /* ★ 이 고스트가 지금 **유도 중인 핵의 표적**(요청: "고스트 조준중에 사주경계
       안하고 목표지점 향해 총겨누고 고정하고 있어야함") ────────────────────────
       자세(pose)는 이미 이 판정을 하고 있었는데 **몸 방향은 안 봤다** — 고스트는
       가만히 선 유닛이라 사주경계(IDLE_SCAN)에 들어, 총은 겨눈 자세인데 몸이
       제자리에서 두리번거렸다. 원작의 유도는 표적을 향해 **굳는** 일이다.
       값을 여기서 한 번만 내어 방향과 자세가 나눠 쓴다 — 두 곳에서 따로 세면
       조건이 갈리는 날이 온다(자세만 서고 방향은 안 서던 자리가 그것이다).
       근거는 둘이다(그 사정은 아래 pose 주석): 참값의 핵탄두 개체가 사는 구간과,
       시전 자국의 조준 창. 하나가 비어도 다른 하나가 선다. */
    const nukeAim9: [number, number] | null = drawUnit !== "Ghost" ? null : ((): [number, number] | null => {
      const nl9 = nukeLase.find((q9) => t >= q9.t0 && t < q9.t1
        && Math.hypot(q9.x - pos.x, q9.y - pos.y) <= 12);
      if (nl9) return [nl9.x, nl9.y];
      const c9 = castsNow.find(([cs9, cx9, cy9, tk9]) => tk9 === "Nuclear Strike"
        && t - cs9 < NUKE_FALL_SEC && Math.hypot(cx9 - pos.x, cy9 - pos.y) <= 12);
      return c9 ? [c9[1], c9[2]] : null;
    })();
    /* ★ 드론이 고치 자리로 **미끄러져 내려간다**(요청: "고치가 될 때는 아래로
       내려가고 반대일 때는 위로 올라와야 해") ────────────────────────────────
       2D에서 드론과 고치는 기준선이 다르다(위 droneMorph 주석) — 드론은 발자국
       한가운데, 고치는 발자국 아랫변이다. 그래서 드론은 늘 고치가 나올 자리보다
       발자국 세로의 절반만큼 **위에서** 사라졌다: 사라짐과 나타남이 다른 자리라
       한 몸이 이어지는 것으로 안 읽힌다.
       그 절반을 변태 직전 0.34초에 걸쳐 미끄러져 내려가며 메운다. 취소는 그
       역이다 — 고치가 걷힌 자리에서 시작해 제 자리로 올라온다.
       **그리는 자리만** 움직인다(요청: "이전/다음 동선에 영향이 없게") — 원자취
       (pos)는 그대로라 앞뒤 걸음·길찾기·집기 열쇠에 한 톨도 안 실린다.
       결은 처음이 느리고 끝이 빠른 쪽(제곱)이다 — 녹아서 주저앉는 결이다. */
    let morphDy9 = 0;
    if (drawUnit === "Drone") {
      const ms9 = droneMorph.get(e.tag);
      if (ms9) {
        if (ms9.born > 0 && t > ms9.born - MORPH_SLIDE_SEC && t <= ms9.born) {
          const u9 = (t - (ms9.born - MORPH_SLIDE_SEC)) / MORPH_SLIDE_SEC;
          morphDy9 = ms9.dy * u9 * u9;
        } else if (ms9.gone > 0 && t >= ms9.gone && t < ms9.gone + MORPH_SLIDE_SEC) {
          const u9 = 1 - (t - ms9.gone) / MORPH_SLIDE_SEC;
          morphDy9 = ms9.dy * u9 * u9;
        }
      }
    }
    const [ax3, ay3] = [pos.x, pos.y + morphDy9];
    const [fx, fy] = posFrac(ax3, ay3);
    /* 근접 잽은 아래 unitOps.push 직전에서 자리를 살짝 민다 — 여기서는 원래
       자리만 잡는다(효과·체력바·링은 다 이 자리를 기준으로 선다). */
    /* (걷어냄) 건설 일꾼 뒷그물 — **가만히 선** 일꾼이 제 최근 활동 무렵에
       선 내 건물 발자국(+1.2타일) 안에 있으면 통째로 안 그리던 자리다.
       지적: "건설 scv 움직일땐 보이고 서서 스파크 날땐 안보임" — 바로 이것이다.
       용접하는 SCV는 발자국 안에 **서 있으므로** 늘 걸리고, 귀퉁이를 옮기려고
       걷는 동안만 moving이 되어 잠깐 보였다.
       이 그물은 합성 건설 SCV를 따로 세우던 시절의 짝이다: 그때는 합성이 그
       자리를 대신 채웠으므로 진짜 일꾼을 지워야 둘로 안 보였다. 합성을 걷은
       뒤로는 지울 상대가 없어, 짓는 동안 그 자리에 **아무도 없게** 만들 뿐이다.
       게다가 조건이 '공사 중'도 아니라(서 있는 아무 건물이면 된다) 배럭 옆에
       가만히 선 일꾼까지 사라졌다. 참값 자취가 일꾼을 제자리에 세워 주므로
       가릴 까닭이 없다. */
    // 죽음 창(dieAt~+1.2초) — 마커 대신 종족별 사망 효과가 남는다(체력 0 즉사 포함).
    if (dieAt !== null && t >= dieAt) {
      if (!qDeath) return null;
      /* 변태로 끝난 생애는 죽은 것이 아니다 — 같은 몸이 다음 시절로 갈아입는
         것이라(라바 → 알 → 유닛, 히드라 → 럴커 알 → 럴커), 터뜨리면 해처리
         발치가 매번 폭발한다. 위 문이 여운 없이 걷으므로 여기까지 오지도
         않지만, 뜻을 못박아 둔다.
         (걷어냄) 'cap' — 인구 과잉 계상을 원장이 무르던 합성 죽음이다. 참값에는
         그런 무름이 없다(자취에 있는 개체는 실제로 있던 개체다). */
      if (e.end === "morph" || e.end === "own") return null;   // 손바뀜은 죽음이 아니다(다음 생애가 같은 몸)
      /* 죽는 결은 넷이다(요청) — 바이오닉 빨강 · 메카닉 주황 폭발 ·
         프로토스 플라즈마 폭발 · 저그 보라. 여태 테란이 통째로 'mech'라
         마린이 터져도 기계 폭발이 났다(CSS에는 scr-die-bio가 진작 있었는데
         아무도 그 이름을 안 골랐다).
         프로토스는 원작에서 인간형이 연기·기계형이 끈적한 액체로 갈리지만
         여기서는 하나로 묶는다(요청: 통일) — 종족이 곧 결이라야 화면에서
         '누가 죽었나'가 읽힌다. */
      /* 고치 갈래(지적): 변태알·러커알·뮤탈 고치가 취소로 터지면 피 폭발이 아니라 고치색 파편이 튄다. */
      const cocoon9 = e.end === "self"
        && (e.unit === "Egg" || e.unit === "Lurker Egg" || e.unit === "Mutalisk Cocoon");
      const dk = cocoon9 ? "cocoon" : race === "저그" ? "zerg"
        : race === "프로토스" ? "toss"
          : BIONIC_UNITS.has(drawUnit) ? "bio" : "mech";
      /* 죽은 자리에 못박기(지적: 체력 0으로 소멸한 유닛이 폭발하며 움직임) —
         지금 표시 위치(스무딩·걸음이 계속 간다)가 아니라 죽은 '순간'의 자취
         좌표에서 터진다. */
      /* ★ 죽는 자리는 **죽는 순간의 참값**이다(지적: "유닛이 없는 자리에 …
         사망효과가 계속 나와") ────────────────────────────────────────────────
         여태 이 자리는 diePosRef — '마지막으로 **그려진** 자리'를 기억해 두는
         참조였다. 그 기억은 화면이 이 개체를 안 그린 프레임에는 갱신되지 않는데,
         안 그리는 문이 렌더에만 여섯이다(안개 밖·배 안·승하차·건설 흡수·공사
         구간·일꾼이 홀/가스 안). 그래서 안개 속으로 들어갔다가 죽거나, 배에 타고
         옮겨져 죽은 몸은 **한참 전에 마지막으로 보이던 자리**에서 터졌다.
         기억할 까닭도 이제 없다: 이 참조는 그리는 자리에 스무딩·추종이 얹혀 있던
         시절의 것이고, 그 보정들은 전부 걷혔다("그리는 자리는 참값 그대로다").
         코어 자취가 있으면 그쪽을, 없으면 원 자취를 **dieAt 시각으로** 읽는다 —
         언제 그려졌는지와 무관하게 늘 같은 답이 나온다. */
      /* 규칙은 그리는 쪽과 **한 벌**이다(위 pos를 정하는 줄들) — 참값 자취가
         있으면 그쪽을, 없으면 원 자취를 읽는다. 다른 것은 읽는 **시각**뿐이다:
         지금(t)이 아니라 죽는 순간(dieAt)에 묻는다.
         얼어붙음(frzSt) 갈래는 위 pos와 함께 걷었다 — 어림인 창이 참값보다 길면
         이 자리에서도 같은 값이 어긋난다: 스태시스가 진짜로 풀린 뒤 걸어가다
         죽은 몸이 **걸렸던 옛 자리**에서 터졌다. 갇힌 동안은 무적이라 그 창
         안에서 죽는 일 자체가 없으므로, 이 갈래가 맞을 수 있는 경우도 없다. */
      const dsim0 = simTr ? posAtSim(simTr, dieAt) : null;
      const dp0 = dsim0 ?? posAtW(rp, Math.max(wT(rp, 0), dieAt));
      const dpx = dp0 ? dp0.x : ax3;
      const dpy = dp0 ? dp0.y : ay3;
      /** 죽은 몸의 화면 크기 — 뜨는 높이와 터지는 크기가 같은 자를 쓴다. */
      const diePx9 = drawUnit === ""
        ? unitGlyphPx(unitMarkerKind("", race), unitMarkerKind("", race), 0, dpy)
        : unitPxOf(drawUnit, dpy);
      /* 공중은 떠 있던 몸 자리에서 터진다(지적) — 비행 높이만큼 위로. */
      /* 죽음 효과는 사라진 몸이 있던 자리에 서므로, 그 몸이 그려지던 높이를
         그대로 따른다 — 들기 몫의 두 배다(터지는 불꽃이 몸보다 위로 솟는다). */
      /* 지적("지상은 너무 낮고 공중은 너무 높다"): 지상은 발밑(0)이 아니라 몸 한가운데(몸 폭의 0.3)에서, 공중은 들기의
         두 배가 아니라 1.25배에서 터진다. */
      const dieLift = uAir ? airLiftPxOf(dpy) * 1.25 : diePx9 * 0.3;
      /* ★ **파편 폭발**(요청: 단순한 페이드아웃 확대 말고 덩어리가 파편화되어 터지는 꼴 — 기계는
         화염·연기, 프로토스는 플라즈마화, 저그는 살점·피떡) — 캔버스 burst op으로 그린다(2배부터).
         자는 보이는 몸 폭. 그 아래 칸은 옛 DOM 여운 하나만 남긴다. */
      {
        const [bfx9, bfy9] = posFrac(dpx, dpy);
        fxOps.push({
          kind: "burst", fx: bfx9, fy: bfy9, lift: dieLift,
          size: diePx9 * (modelInkOf(UNIT_3D[drawUnit] ?? "") / 16), ph: (t - dieAt) / DIE_FX_SEC,
          mat: dk, seed: e.tag > 0 ? e.tag : ei + 7,
        });
        dom.push({ k: "dieat", key: `v2die-${ei}`, x: dpx, y: dpy, dk, diePx: diePx9, lift: dieLift });
      }
      return null;
    }
    /* 시즈모드(지적: 판정을 리플레이에서) — 위 siegeOn·siegeXf9(전환 창) — 그리는 판은 siegeShow9. */
    const drawUnit2 = siegeShow9 === 1 && drawUnit.startsWith("Siege Tank")
      ? "Siege Tank (Siege Mode)" : drawUnit;
    /* 표적 거리는 '그려지는 몸'에서 다시 잰다(지적: 맞는 대상이 없는데 공격한다 /
       둘이 너무 멀어 따로 놀아 보인다) — foe.bd는 원자취(명령 좌표) 기준인데,
       화면의 몸은 교전 당김·잽·채굴 왕복·겹침까지 실린 딴 자리에 있다. 그 둘이
       몇 타일씩 벌어진 채로 사격 판정과 조준각을 원자취 거리로 내리다 보니, 몸
       옆에 아무도 없는데 트레이서가 나가고 각도도 엉뚱한 데를 겨눴다. 아래 사격
       ·조준·가시 길이는 전부 이 값을 쓴다. */
    const foeDist = Number.isFinite(foe.bd)
      ? Math.hypot(foe.bx - pos.x, foe.by - pos.y) : Infinity;
    /* ★ 메딕은 **고칠 몸이 있어야** 일한다(지적: "메딕이 힐 동작을 해도 타겟 피가
       안 차고 힐할 대상이 없어도 모션을 안 멈춤") ─────────────────────────────
       두 지적은 한 뿌리다. 메딕을 교전 명단(ENGAGE_SKIP)에서 뺄 때, 치료 자세가
       서는 문을 참값의 싸움 상태 하나(ST_FIGHT)에 통째로 맡겼다. 그런데 메딕에게
       그 상태는 '지금 고치는 중'이 아니라 **치료 명령을 들고 있다**에 가깝다:
       다친 몸을 찾아 따라다니는 내내도, 이미 다 나은 몸 곁에 선 동안도 그대로
       선다. 게다가 컷 고르기가 메딕만 위상을 안 본다(atkCutOf: "inf"는 늘 2) —
       한 번 서면 상태가 갈릴 때까지 주사기가 안 내려간다. 그래서 아무도 안 낫는데
       모션만 돌았고, 그게 곧 "피가 안 찬다"의 정체다(고칠 몸이 없으니 찰 피도 없다).
       고치는 자리는 여기다. 치료가 성립하는 조건을 **참값에 직접** 묻는다:
         ① 겨눈 몸이 지금 지도에 있나 — 메딕의 order_target이 곧 치료 대상이다
            (그 갈래는 위 foe 주석이 이미 적어 두었다).
         ② 같은 편의 **지상 유닛**인가 — 건물도 뜬 것도 못 고친다.
         ③ 원작이 고칠 수 있는 몸인가 — 유기물이면서 기계가 아닌 것만이다
            (그 문에 SCV가 걸린다: 표에서 organic이자 mech다. SCV는 수리 대상이지
            치료 대상이 아니다).
         ④ 원작의 치료 사거리(30px) 안인가 — 이 파일의 거리는 중심-중심이므로
            두 몸 반지름을 더한다(bwCombat.reachTiles가 무기에 하는 그 덧셈이다.
            메딕은 무기가 없어 그 함수를 못 쓰니 여기서 같은 셈을 편다).
         ⑤ 그 몸이 **실제로 다쳐 있나** — 참값 체력이 만피보다 적어야 한다.
            다 나은 몸 곁에서는 원작의 메딕도 주사기를 내린다.
       하나라도 아니면 이 프레임의 메딕은 '일하는 중'이 아니다. 자세도 불빛도 이
       값 하나(fighting)를 보므로 둘이 함께 멎는다. */
    const healing9 = drawUnit !== "Medic" ? false : ((): boolean => {
      if (!Number.isFinite(foe.bd) || foe.bld || foe.air) return false;
      if ((foe.team ?? 0) !== (team ?? 0)) return false;
      const uk9 = foe.uk;
      if (!uk9 || !isKnownKind(uk9)) return false;
      const pf9 = profileOf(uk9);
      if (!pf9.organic || pf9.mech) return false;
      if (foeDist > MEDIC_HEAL_RANGE_PX / 32
        + bodyRadiusOf(drawUnit) + pf9.radius) return false;
      const stat9 = UNIT_STATS[uk9];
      const full9 = stat9 ? stat9.hp + (stat9.sh ?? 0) : 0;
      /* 체력 칸이 비었으면 한 번도 안 깎인 몸이다(위 FoeRow.hp) — 만피라 고칠
         데가 없다. 표에 없는 이름도 '모른다'로 두고 안 고친다. */
      return full9 > 0 && foe.hp !== undefined && foe.hp < full9;
    })();
    if (drawUnit === "Medic" && !healing9) fighting = false;
    /* 몸 방향(지적: 트레이서와 불일치 + 뒤로 걷기) — 싸울 땐 표적을 바라보고,
       걸을 땐 실제 화면 이동 방향을 본다(headingOfDisplay). */
    /* ★ 조준각의 사거리는 **그 무기의 사거리**다(지적: "시즈 공격시 포탑이
       공격방향으로 안돌아가는 문제") — 여태 붙박이 9타일(ENGAGE_SIGHT_TILES)로
       쟀는데, 시즈 모드의 사거리는 **12타일**이다. 그래서 시즈가 제 사거리
       끝에서 쏘는 동안(9~12타일)에는 표적각이 null이라, 포탑 판이 차체 방향을
       그대로 물려받아 엉뚱한 데를 겨눈 채 포탄만 날아갔다 — 시즈가 가장 시즈
       답게 쓰이는 거리가 하필 그 구간이다.
       제 사거리를 쓰되 밑값은 옛 9로 둔다(사거리가 짧은 근접 유닛도 눈앞의
       적은 보고 서야 한다). */
    /* ★ 시즈 모드에는 **최소 사거리**가 있다(지적: "자기한테 가까이 붙은거
       공격못하는데 원래") — 원작의 시즈 모드는 2타일 안쪽을 못 친다(무기의
       min range). 그래서 저글링이 붙으면 시즈 탱크는 아무것도 못 하고 서 있다.
       여기서는 그 규칙이 없어, 발밑에 붙은 적을 겨누고 포탄까지 냈다.
       조준·사격이 함께 이 문턱을 본다 — 아래 foeDeg가 null이면 포탑은 차체를
       따르고 트레이서도 안 나간다. */
    const minRange9 = drawUnit2 === "Siege Tank (Siege Mode)" ? 2 : 0;
    /* ★ 조준 문은 **사격 문과 같은 자**를 쓴다(지적: "시즈탱크가 타겟건물을
       안 보는 현상") ────────────────────────────────────────────────────────
       여기 있던 fireRangeTilesOf는 이 파일 머리말이 스스로 적어 둔 어림이다:
       "'몸 반지름을 뺀 순수 사거리'다. 이 파일의 거리 판정은 전부 중심-중심이라
       실제보다 두 몸 반지름만큼 짧게 잡힌다 — 그리기용 게이트라 그대로 둔다."
       작은 몸끼리는 그 오차가 눈에 안 띈다. 그런데 **큰 몸이 큰 몸을 겨눌 때**는
       두 반지름이 몇 타일이라, 원작이 치는 표적을 화면은 사거리 밖으로 친다.
       실측(참값 뭉치): 시즈 모드 탱크가 실제로 겨눈 표적의 중심-중심 거리가
       10.6~15.5타일인데 이 문은 12에서 잘렸다 — 잘린 순간 foeDeg가 null이 되어
       포탑이 표적을 안 본다. 건물은 몸이 가장 크고 늘 최대 사거리에서 맞으므로
       거기서 가장 도드라진다.
       코어의 reachTiles가 두 몸 반지름을 더해 준다(같은 머리말의 그 자). 아래
       사격 문이 이미 그것을 쓰고 있으니, 조준도 같은 자를 쓰면 **'보는 것'과
       '쏘는 것'이 어긋날 자리가 없어진다**. */
    const aimTiles9 = Math.max(
      ENGAGE_SIGHT_TILES,
      isKnownKind(drawUnit2)
        ? reachTiles(drawUnit2,
          foe.uk && isKnownKind(foe.uk) ? foe.uk : drawUnit2, foe.air)
        : 0,
    );
    let foeDeg = foeDist >= minRange9 && foeDist <= aimTiles9
      ? Math.atan2(-(foe.bx - pos.x), foe.by - pos.y) * (180 / Math.PI) : null;
    /* 싸울 때도 '움직이면 이동 방향'이 먼저다(요청) — 표적 고정 요잉은 잽으로
       파고들거나 진형이 밀릴 때 몸이 옆·뒤로 미끄러지게 만들었다. 제자리에 선
       순간에만 표적을 본다. */
    const bodyHdg0 = simHdg !== null ? simHdg : headingOfDisplay(
      holdKey, pos.x, pos.y, headingOf(rp, rawPos),
      fighting && foeDeg !== null ? foeDeg : null,
    );
    /* 사주경계(요청: "제자리 서있는 유닛들이 주기적으로 사주경계를 함 … 하는 유닛이
       있고 안 하는 유닛이 있고 패턴도 다르다") — 원전의 정체는 iscript 옵코드
       turnrand다([OBW] bwgame.h:14921): 몸을 8_dir×a(11.25도의 배수)만큼 돌리되
       네 번에 한 번만 반시계, 나머지는 시계다(시계 쪽으로 치우친 무작위).
       ⚠ **누가 어떤 박자로 도는가는 iscript.bin에 있고 우리 자료에는 없다** —
         BWAPI·units.dat·flingy.dat 어느 덤프에도 스크립트는 안 들어 있다(게임 MPQ를
         IceCC로 풀어야 나온다). 그래서 여기 [어림]은 둘이다:
           ① 도는 유닛 — 커뮤니티 문서가 확인해 주는 보병(마린이 총을 들었다 내리며
              두리번거린다)만 켠다. 차량·기계·일꾼·공중은 안 켠다.
           ② 박자 — 3.2초마다 한 번, 태그로 위상을 흩어 부대가 한꺼번에 안 돈다.
         도는 **양과 방향**만은 원전 그대로다(11.25도 배수·시계 3:1).
       iscript 덤프를 구하면 이 블록의 표만 갈면 정확해진다. */
    const bodyHdg = (() => {
      /* 시즈는 **대각선으로만 박힌다**(요청: "시즈는 무조건 대각선으로 모드를 막게
         돼있음") — 원작의 시즈 모드 그림은 8방위 중 네 대각(45·135·225·315)만
         있고, 자리를 잡을 때 몸이 그 넷 중 가장 가까운 쪽으로 돌아가 앉는다.
         여기서는 시즈가 켜져 있는 동안 몸 각을 그 넷으로 딱 잡는다 — 사주경계도
         걷는 방향도 이보다 위다(박힌 것은 돌지 않는다). */
      /* 핵을 유도하는 고스트는 **표적을 향해 굳는다**(요청) — 시즈가 박히면
         안 도는 것과 같은 갈래다. 화면 각 규약은 atan2(-dx, dy)다(그 주석). */
      if (nukeAim9) {
        return (Math.atan2(-(nukeAim9[0] - pos.x), nukeAim9[1] - pos.y) * 180) / Math.PI;
      }
      if (drawUnit.startsWith("Siege Tank") && (siegeOn === 1 || siegeXf9)) {
        const snap9 = Math.round((bodyHdg0 - 45) / 90) * 90 + 45;
        /* 시즈로 들어가는 전환의 앞 반 동안 몸이 가장 가까운 대각으로 돌아 앉는다(요청: 전환 동작). 언시즈는 창이
           끝날 때까지 박힌 채다. */
        if (siegeXf9 && siegeXf9.to === 1 && siegeOn !== 1) {
          const k9 = Math.min(1, siegeXf9.u / 0.5);
          const d9 = ((snap9 - bodyHdg0 + 540) % 360) - 180;
          return bodyHdg0 + d9 * k9;
        }
        return snap9;
      }
      if (!IDLE_SCAN.has(drawUnit2) || fighting || burrowed) return bodyHdg0;
      if (simState !== null && simState !== 0) return bodyHdg0;   // 0 = ST_IDLE
      const step = Math.floor(t / IDLE_SCAN_SEC + (e.tag % 7) / 7);
      const r = (step * 2654435761 + e.tag * 40503) >>> 0;   // 결정론 난수(같은 입력=같은 그림)
      const amt = 1 + (r % 2);                                // 11.25 또는 22.5도
      const ccw = (r >>> 8) % 4 === 1;                        // 네 번에 한 번만 반시계
      return bodyHdg0 + (ccw ? -1 : 1) * amt * 11.25;
    })();
    /* 지금 체력(요청: 체력을 지니고 다닌다) — 변곡점 목록에서 t 시점 값.
       내려간 변곡점의 시각은 곧 '이 개체가 실제로 맞은 순간'이라, 피격 불티를
       그 자리·그 때에 띄우는 자로 함께 쓴다(요청: 피격 표현 재검토). */
    /* 체력은 실제 수치다(지적: "체력은 반올림 없이 실제 수치로") — 자취의 값이
       곧 남은 체력(실드 포함)이라, 만피는 표에서 가져와 나눈다. */
    const hpFull = (() => {
      const st0 = UNIT_STATS[drawUnit2] ?? UNIT_STATS[drawUnit];
      return st0 ? st0.hp + (st0.sh ?? 0) : 40;
    })();
    let hpNow = hpFull;
    let hurtAt = -99;
    /* ★ 이진 탐색으로(지적: 스톰에 뮤탈이 많이 맞을 때 느려짐) — 여태 표본을 처음부터
       지금까지 매 프레임 훑었다. 맞는 동안 표본이 촘촘히 쌓이는 몸(스톰 아래
       뮤탈)이 수십이면 프레임마다 수만 번이다. 지금 자리를 이진 탐색으로 찾고,
       '마지막으로 깎인 때'는 거기서 3초 안쪽만 거슬러 본다 — 쓰는 곳이 0.55초
       창(실드막·불티)뿐이라 그보다 오래된 깎임은 아무도 안 읽는다. */
    {
      const hp9 = e.hp;
      const at9 = tkAt(hp9, t);
      if (at9 >= 0) {
        hpNow = tkV(hp9, at9);
        for (let i9 = at9; i9 >= 0 && tkT(hp9, i9) >= t - 3; i9 -= 1) {
          const prev9 = i9 > 0 ? tkV(hp9, i9 - 1) : hpFull;
          if (tkV(hp9, i9) < prev9) { hurtAt = tkT(hp9, i9); break; }
        }
      }
    }
    /* 선택 표시(지적: 드래그 선택 구분) — 방금 명령을 받았다는 것은 그 직전에
       (드래그든 부대지정이든) 잡혔다는 뜻이다. 클릭 토글이 켜져 있으면 명령
       직후 0.35초 동안 몸에 흰 링이 켜져, 함께 잡힌 무리가 한눈에 보인다. */
    /* 0.35 → 0.5초 — 모바일 그리기가 20Hz라 0.35초는 일곱 프레임이고,
       그 사이 배속이 빠르면 두어 프레임으로 준다. 잡힌 것을 알아볼 만큼은
       남긴다(요청과 같은 결의 지적: "유닛 선택링이 안나와"). */
    const selNow = clickFx && e.orders.some((os2) => t >= os2 && t - os2 <= 0.5);
    /* 시즈탱크 반동(요청: 발포 시 포탑·포신만) — 차체/포탑을 딴 판으로 밀어,
       쏘는 박자에 포탑 판만 뒤로 살짝 밀렸다 돌아온다. */
    /* 변태 중이면 알·고치다(요청) — 이제 참값이 껍질을 제 유닛으로 내므로
       (럴커 알·뮤탈 고치) 아래 unitMarkerKind가 이름 그대로 껍질을 고른다.
       덧씌우던 어림은 걷었다(위 주석). */
    /* 럴커 가시(지적: 가시 표현이 안 나옴 → 재지적: "가시 및 본체 모델 변화 없음")
       — 럴커는 교전 돌입 목록(ENGAGE_SKIP) 밖이라 fighting이 영영 거짓이었고 가시
       트레이서도 안 나왔다. 원작대로 버로우한 채 적이 사거리 안이면 명령 없이도
       가시를 쏜다. 럴커는 수가 적으니 1/3 솎기도 안 태운다.
       값은 표에서 온다: 무기 사거리 6타일(Subterranean_Spines 192px). 그리고 가시는
       지상 전용 무기라 공중 표적에는 안 나간다.
       ★ 판정을 여기(kind0 앞)로 올린 까닭 — 몸 모델(등 가시가 곧추선 별본)과
         가시 트레이서가 **한 조건**에서 나와야 둘이 같은 순간에 켜진다. 조건을
         따로 두면 가시는 나가는데 몸은 가만히 있는 그림이 된다. */
    const lurkRange = fireRangeTilesOf("Lurker", false);
    /* 버로우한 럴커는 **가림을 안 본다**(위 nearestFoe의 ignoreLos 주석) —
       땅에 묻힌 몸이라 미네랄 덩이·절벽 곁에 자리 잡으면 걷기 격자 어림이
       "안 보인다"로 떨어져 가시가 통째로 안 나갔다(지적). 사거리 안에 지상
       적이 들어왔으면 쏜다. 표적각도 그 자리에서 다시 잰다 — 가림 때문에
       못 보던 적이 상대라면 조준각도 그쪽이어야 한다. */
    /* ★ **벽 너머는 못 친다**(지적: "럴커 벽을 뚫어서 문제임") — 여기 ignoreLos를
       켜 둔 까닭은 '미네랄 덩이·절벽 곁에 묻힌 럴커가 가림 어림에 걸려 통째로
       조용했다'는 앞선 지적이었다. 그 처방이 이번엔 반대로 넘쳤다: 절벽 위아래처럼
       **정말로 못 닿는 자리**까지 가시가 나갔다. 가시는 땅 밑으로 가지만 원작에서도
       높이가 다른 지형과 벽 너머는 못 친다.
       가림을 다시 본다 — 앞선 지적의 자리(자원 덩이 뒤)는 가시 사거리가 6타일로
       짧아 대개 같은 고도의 이웃이라, 그쪽이 다시 조용해지면 가림 어림
       (sightBlocked)이 자원 덩이를 벽으로 치는 쪽을 손봐야 할 일이지 여기서 눈을
       감을 일이 아니다. */
    /* 럴커도 **참값 표적**을 본다(지시: 어림을 다 걷어낸다) — 위 foe가 이미 그
       값이다(버로우는 wantFoe9가 따로 열어 둔다). 여기서 다시 찾을 까닭이 없다. */
    const lurkFoe = burrowed && drawUnit === "Lurker" && Number.isFinite(foe.bd)
      ? foe : null;
    const lurkDist = lurkFoe && Number.isFinite(lurkFoe.bd)
      ? Math.hypot(lurkFoe.bx - pos.x, lurkFoe.by - pos.y) : foeDist;
    /* ★ 묻히는 데 시간이 든다(요청) — 원작의 버로우는 애니메이션이 끝나야 굴이
       완성되고, 럴커는 그 뒤에야 가시를 낸다. 여기서는 상태가 바뀌는 그 프레임에
       곧바로 가시가 튀어나와 '땅에 닿자마자 발사'로 읽혔다.
       ① 파는 창(BURROW_DIG_SEC) 동안은 가시를 안 쏘고,
       ② 그동안 몸은 **선 채로 땅에 잠겨 들어간다**(아래 digging9·rise). */
    /* 파는 창은 상태가 바뀌기 **전**이다(위 burrowNext9) — T1까지 남은 시간으로 진행률을 낸다. T1부터는 곧장 땅속 판. */
    const digU9 = burrowNext9 !== null ? Math.min(1, Math.max(0, 1 - (burrowNext9 - t) / BURROW_DIG_SEC)) : 1;
    const digging9 = burrowNext9 !== null && !burrowed;
    /* 몸이 제자리에서 뜨는 몫(모델 상자 배수) — 호버 유닛의 부양과 땅파기의
       가라앉음이다. 그리는 쪽(op.rise)과 빙결 우리가 **같은 값**을 봐야 우리가
       몸에 붙는다(아래 cage의 lift 주석). */
    /* 럴커는 안 가라앉는다(요청) — 파는 자세(컷 4·5)와 흙덩이(아래 dig)가 그 몫이다. 다른 버로우 유닛은 잠겨 든다. */
    // 시즈 전환은 안 앉는다(요청: 아래로 내려가는 모션 제거) — 버팀다리가 뻗고 접히는 것(legK9)만이 전환 동작이다.
    const rise9 = (HOVER_RISE_K[drawUnit] ?? 0) - (digging9 && drawUnit !== "Lurker" ? digU9 * 0.9 : 0);
    if (digging9 && drawUnit === "Lurker" && !markerView && burrowNext9 !== null) {
      /* 흙덩이(요청) — 0.15초마다 한 움큼. 스팬은 열쇠가 살아 있는 동안만 있으므로 최근 세 움큼을 함께 실어 한 움큼이
         0.45초(CSS 길이)를 다 산다. 폭은 몸 한 타일의 화면 폭이다. */
      const digT0 = burrowNext9 - BURROW_DIG_SEC;
      const nD = Math.floor((t - digT0) / 0.15);
      const wD = Math.abs(posFrac(pos.x + 0.6, pos.y)[0] - posFrac(pos.x - 0.6, pos.y)[0]) * 100;
      for (let j = Math.max(0, nD - 2); j <= nD; j += 1) {
        dom.push({ k: "dig", key: `dig-${e.tag}-${j}`, x: pos.x, y: pos.y + 0.35, seed: j + e.tag, wPct: wD });
      }
    }
    const lurkStrike = burrowed && !digging9
      && !frzSt && !foe.air && lurkDist <= lurkRange;
    if (lurkStrike && lurkFoe && lurkDist < foeDist) {
      foe = { bx: lurkFoe.bx, by: lurkFoe.by, bd: lurkDist, air: false };
      foeDeg = Math.atan2(-(lurkFoe.bx - pos.x), lurkFoe.by - pos.y) * (180 / Math.PI);
    }
    /* 버로우한 럴커는 제 몸을 갖는다(위 지적) — 다른 버로우 유닛만 맨 구멍이다. */
    const kind0 = burrowed && !digging9
      ? (drawUnit === "Lurker" ? (lurkStrike ? "lurkerfire" : "lurkerburrow") : "burrowhole")
      : isWorker ? workerBodyKind(workerKindOf(race), simState)
        : unitMarkerKind(drawUnit2, race);
    /* 짐은 **따로 겹쳐 찍는다**(위 workerAttachKind의 ★) — 몸 판을 미네랄·가스로
       두 벌 굽지 않으려는 것이 요점이다. */
    const load0 = burrowed || !isWorker
      ? undefined : workerAttachKind(workerKindOf(race), simState);
    const gunKind = kind0 === "tank" ? "tankgun" : kind0 === "tanksiege" ? "tanksiegegun" : null;
    /* ★ 저배율은 **합본**이다(지적: "저배율에서 시즈탱크 포탑부를 아예 안 그리는
       문제") — 포탑 판은 4배부터만 얹는데(liteView 게이트, 판을 한 벌 덜 굽는
       저배율 단순화), 차체 판은 늘 몸통 전용(tankbody)이라 그 아래 배율에서는
       **포탑 없는 탱크**가 서 있었다. 판 수를 늘리지 않고 고친다: 저배율에서는
       포탑까지 한 몸인 합본 모델(tank·tanksiege)을 굽는다 — 판은 그대로 하나고,
       포탑이 차체에 붙박이라 돌지 않을 뿐이다(몇 픽셀짜리 몸에서는 안 읽힌다). */
    const kindMain = kind0 === "tank" ? (liteView ? "tank" : "tankbody")
      : kind0 === "tanksiege" ? (liteView ? "tanksiege" : "tanksiegebody") : kind0;
    /* 빙결 우리 — 걸린 몸마다 하나씩(위 cage 갈래 주석). 마엘스트롬은 안 씌운다:
       요청이 짚은 것은 스테이시스와 락다운 둘이고, 그쪽은 제 지역 효과가 있다. */
    if (frzSt && (frzSt[2] === "stasis" || frzSt[2] === "lock") && !markerView) {
      const cpx9 = drawUnit === ""
        ? unitGlyphPx(kindMain, kindMain, 0, ay3)
        : unitPxOf(drawUnit2, ay3, kindMain);
      /* ★ 자는 **화면에 그려진 몸**이다(지적: "유닛별로 제 바닥 크기에 맞게 …
         그것도 크게" · "그래도 모델에 입힐 수는 있잖아") ────────────────────────
         자를 두 번 바꿔 봤다. ① 모델 상자(unitPxOf) — 상자는 몸의 세 배 남짓이라
         우리가 여러 타일을 덮었다. ② 원작 충돌 지름(unitSepPxOf) — 이번엔 반대로
         너무 작다: 우리 모델은 원작 충돌 상자보다 훨씬 크게 그려지므로(스카우트는
         충돌 0.75타일인데 화면의 몸은 두어 타일이다), 발자국에 맞춘 우리는 몸
         한복판에 점처럼 얹힌다.
         우리가 가두는 것은 **화면에 보이는 그 몸**이다 — 그러니 자도 그것이다:
         모델 상자에 잉크 몫(MODEL_INK/16)을 곱한 값이 곧 칠해지는 몸의 폭이다.
         여벌은 안 준다(옛 1.45를 1.0으로) — 몸에 딱 맞는 것이 '가둔' 그림이고,
         여벌은 이웃 몸까지 삼켜 여럿이 한 덩이로 보이게 하던 몫이었다. */
      const body9 = cpx9 * (modelInkOf(kindMain) / 16);
      fxOps.push({
        kind: "cage", style: frzSt[2], fx, fy,
        /* ★ 우리는 **모델에 입힌다**(요청: "그래도 모델에 입힐 수는 있잖아") —
           여태는 공중 몫만 따라 올렸다. 그리는 쪽의 높이는 세 몫의 합이라
           (그 자리: `px × 0.8 × 축소` + `rise × px` + `px × 0.24`), 하나라도
           빠지면 우리가 몸 아래에 처져 딴 자리에 뜬 것처럼 보인다. 세 몫을 그대로
           더해 **몸 한가운데**에 얹는다(그리는 쪽 cy9는 이 자리를 그대로 쓴다). */
        lift: (uAir ? airLiftPxOf(ay3) : 0) + rise9 * cpx9 + cpx9 * 0.24,
        size: body9,
        // 아주 느린 숨 — 2.4초에 한 번.
        ph: (((t - frzSt[0]) % 2.4) + 2.4) % 2.4 / 2.4,
      });
    }
    /* (걷어냄·요청: "근접 잽 애니메이션은 이제 폐기") — 근접 유닛이 때릴 때
       몸을 표적 쪽으로 0.09타일 툭 내밀었다 당기던 자리다. 그릴 효과가 없던
       시절, '때린다'를 자리 밀기로 흉내 내던 대역이었다.
       이제 **공격 컷**이 그 일을 한다(poseNow 2) — 몸이 통째로 움직이는 것이
       아니라 팔·칼이 실제로 나가므로, 자리를 미는 흉내는 겹쳐 보일 뿐이다. */
    /* 은신 규칙(요청) ─────────────────────────────────────────────────
       ① 탐지되어도 **은신 상태로** 그린다 — 여태 적 디텍터가 곁이면 0.72로 '반쯤 벗겨진' 것처럼 그렸는데,
          탐지는 보이게 할 뿐 은신을 푸는 게 아니다. 은신이면 늘 0.4.
       ② 상대 편의 개인 시야에서는 **보는 편의 탐지**가 있어야만 보인다 — 없으면 아예 안 그린다(원작처럼
          안 보이다가, 탐지되면 은신 상태로 나타난다). 전체 보기·제 편은 늘 은신 상태로 보인다. */
    const cloakedNow9 = e.cloaks.some(([ca, cb]) => t >= ca && t < cb)
      || drawUnit === "Dark Templar" || drawUnit === "Observer"
      || (drawUnit !== "Arbiter" && arbiterSpots.some((asp) =>
        asp.raw === e.raw && Math.hypot(asp.x - pos.x, asp.y - pos.y) <= 4.5));
    if (cloakedNow9 && fogOn && !visAll && viewTeam > 0 && team !== viewTeam
      && !detectorSpots.some((dsp) => dsp.team === viewTeam
        && Math.hypot(dsp.x - pos.x, dsp.y - pos.y) <= 9)) return null;
    unitOps.push({
      fx, fy,
      /* 공중은 2D에서도 y순(지적: 공중 유닛 간 앞뒤 섞임) — ei 나머지는 무작위
         순서라 뒤 풍선이 앞을 덮었다. */
      /* 같은 줄이면 유닛이 건물보다 위(지적: 유닛이 건물에 가려짐) — 건물의
         화가 기준은 발자국 아랫변이라 같은 y면 깊이가 같은데, 건물에만 나이
         가산(최대 +60)이 붙어 앞에 선 유닛까지 덮었다. 유닛에 그보다 **딱 한 칸
         큰** 붙박이를 줘 같은 깊이에서는 늘 유닛이 이기게 한다(뒤에 선 유닛은 y가
         작아 여전히 건물 뒤로 간다).
         ★ 그 몫이 400이었다(지적: "앞뒤 순서안맞게 가려짐 문제") — 한 타일이
           Z_TILE(800)이니 **반 타일**이다. 건물 아랫변보다 반 타일이나 뒤에 선
           유닛까지 건물을 뚫고 앞으로 나왔다: 커맨드센터 뒤를 지나는 마린이
           건물 위에 올라탄 것처럼 보이던 것이 이것이다. 동점만 가르면 되므로
           나이 가산의 상한(60)보다 하나 큰 값이면 충분하다 — 어긋남의 폭이
           0.5타일에서 0.076타일(61/800)로 준다. */
      /* 평면(90도)도 자리 순이다(지적: 가림 차례) — 여태 지상 유닛은 평면에서
         `1000 + (ei % 137)`, 곧 **아무 차례도 아니었다**. */
      z: 1000 + Math.round(ay3 * Z_TILE) + Z_UNIT_AHEAD,
      kind: kindMain,
      // 짐 판은 몸 판 위에 같은 자로 겹쳐 찍는다(위 load0).
      ...(load0 ? { attach: load0 } : {}),
      // 시즈 전환 중이면 버팀다리 판을 몸 뒤에 겹쳐, 배율로 뻗고 접는다(위 legK9).
      ...(legK9 !== null && !markerView ? { attach: "tanksiegelegs", attachK: legK9 } : {}),
      selRing: selNow || undefined,
      // 보임 토글이면 만피여도 표시(요청: 모든 유닛·건물 다 표시).
      hpFrac: Math.max(0.04, Math.min(1, hpNow / Math.max(1, hpFull))),
      hpShow: hurtAt >= 0 && t - hurtAt <= HP_BAR_SEC,
      hpMax: hpFull,
      // 원작 폭(요청) — 충돌 상자 폭 × 1.3을 sprites.dat 값 자리에 넣는다(마린 17 → 22 · 저글링 16 → 19 · 질럿 23 → 28).
      ...((): { hpBarW: number; hpBarFrac: number } => {
        const row9 = UNIT_BW_RAW[UNIT_3D[drawUnit] as keyof typeof UNIT_BW_RAW] as readonly number[] | undefined;
        const bwU9 = hpBarGamePx9(row9 ? row9[0] * 1.3 : 19);
        return { hpBarW: bwU9, hpBarFrac: (bwU9 / (gw9 * 32)) * (pitched ? pitchK(ay3) * HP_BAR_3D_K : 1) };   // 입체: 깊이 배율 × 축소(위 건물 쪽 주석)
      })(),
      // 실드 몫 — 표에서 바로 온다(프로토스가 아니면 0이라 흰 칸이 안 생긴다).
      shFrac: (() => {
        const st1 = UNIT_STATS[drawUnit2] ?? UNIT_STATS[drawUnit];
        return st1 && st1.sh ? st1.sh / (st1.hp + st1.sh) : 0;
      })(),
      // 정보 팝업 신원(요청) — 개체 태그가 프레임을 건너 같은 몸을 가리킨다.
      pickKey: `u${e.tag}`, pickName: e.unit, pickRaw: e.raw,
      /* 지금 무슨 상태인가(요청: 모든 상태 노출) — 땅속·은신·얼음·전투까지, 몸이
         이미 아는 것을 글로 옮긴다. 없으면 상태 줄을 안 적는다. */
      pickStatus: (() => {
        const a4 = e.statuses.find(([sa5, sb5]) => t >= sa5 && t < sb5);
        return a4 ? a4[2] : undefined;
      })(),
      pickState: (() => {
        const st: string[] = [];
        if (burrowed) st.push("땅속");
        /* 은신(요청) — 연구로 켠 창(e.cloaks)과 늘 은신인 둘. 아비터 은신장은
           곁 유닛 사정이라 이 자리에서 모른다. */
        if (e.cloaks.some(([ca2, cb2]) => t >= ca2 && t < cb2)
          || e.unit === "Dark Templar" || e.unit === "Observer") st.push("은신");
        const actSt2 = e.statuses.find(([sa4, sb4]) => t >= sa4 && t < sb4);
        if (actSt2) st.push(STATUS_KO[actSt2[2]] ?? actSt2[2]);
        return st.length > 0 ? st.join(" · ") : undefined;
      })(),
      tint: (() => {
        const actSt = e.statuses.find(([sa3, sb3]) => t >= sa3 && t < sb3);
        // 우리를 씌우는 상태는 오라를 안 깐다(위 CAGED_STATUS 주석 — 그 오라가
        // 곧 걷어내려던 하늘색 원반이었다).
        if (!actSt || CAGED_STATUS.has(actSt[2])) return undefined;
        return STATUS_TINT[actSt[2]];
      })(),
      // 승하차 뱅글(요청) — 몸 방향에 한 바퀴를 얹는다. 요잉 버킷이 16방이라
      // 스프라이트는 이미 구워 둔 판을 돌아가며 쓸 뿐, 새로 굽지 않는다.
      /* 요잉은 **4배까지 45도 여덟 칸**으로 묶는다(요청: "요잉 4배까지는 축소") —
         굽는 판이 칸마다 한 벌이라 열여섯 칸이면 종류당 열여섯 벌이다. 몇
         픽셀짜리 몸에서 22.5도 차이는 화면에 안 남으므로, 절반으로 묶으면
         굽기와 캐시가 그대로 절반이 된다. 4배부터는 열여섯 칸 그대로다. */
      rotDeg: burrowed ? undefined
        : liteYaw ? Math.round(bodyHdg / 45) * 45 : bodyHdg,
      viewYaw: viewYawOf(ax3, ay3), flat: !pitched, pitch: pitched,
      /* 크기 열쇠 셋을 바로잡는다(지적 셋을 한 줄에서 고친다):
         ① drawUnit이 아니라 drawUnit2 — 시즈모드 탱크가 "tank" 줄에서 크기를 받아
            tanksiege 손잡이가 죽은 값이었다.
         ② 그리는 모델은 kindMain(tankbody·burrowhole·lurkeregg…)이므로 잉크 몫은
            그쪽에서 찾는다. 원작 치수는 여전히 유닛 것이다(버로우한 히드라 구멍은
            히드라 크기).
         ③ 이름 없는 유닛은 제가 그려지는 모델(kindMain = 종족 기본 보병)의 크기다.
            예전엔 그림은 마린인데 상자는 SCV라 25% 어긋났다. */
      sizePx: (drawUnit === ""
        ? unitGlyphPx(kindMain, kindMain, 0, ay3) : unitPxOf(drawUnit2, ay3, kindMain)),
      // 진형 간격은 원작 몸 지름 — 그리기 크기를 만져도 안 흔들린다.
      sepPx: drawUnit === "" ? unitSepPxOf("?") : unitSepPxOf(drawUnit2),
      /* 자세(요청: 전격 애니메이션화 — 2컷) ────────────────────────────────
         갈아 끼우는 박자가 요점이다:
           · 이동 — 걸음 속도에서 뽑는다. 초당 걸음 ≈ 이속(타일/초) × 2.2로,
             느린 것은 느긋하고 빠른 것은 잰걸음이다(2~9Hz로 죈다).
           · 공격 — 그 무기의 쿨다운에서 뽑는다(firePhase). 주기의 앞 35%만
             때리는 자세이고 나머지는 기본으로 돌아온다 — 공속이 곧 타격 빈도다.
         공격이 이동을 이긴다(싸우는 중에는 걸음이 멈춘다). 마커 배율에서는
         아예 안 고른다 — 그 칸은 몸을 안 그린다. */
      pose: ((): 0 | 1 | 2 | 3 | 4 | 5 => {
        /* ★ 핵을 유도하는 고스트는 **총 겨눈 자세로 굳는다**(요청: "핵 조준중
           고스트 공격자세로 고정" · "고스트 자세 총 겨눈 상태로 고정") ─────────
           원작에서 핵 유도는 고스트가 표적을 조준한 채 꼼짝 않고 서 있는 일이다.
           그런데 여기서는 그동안 고스트가 **가만히 선 유닛**이라 기본 자세였고,
           화면에서는 그냥 노는 고스트와 구분이 안 됐다 — 정작 그 순간이 그 판에서
           가장 큰 사건인데.
           판정은 이 사람의 핵이 **날아가는 중**이고(castsNow가 이미 그 창으로
           걸러 준다) 이 고스트가 그 표적 곁(10타일 — 원작 유도 사거리 8보다 조금
           너그럽게)에 있는가다. 여러 고스트가 있어도 표적 곁에 선 것만 걸린다.
           자세 컷보다 **먼저** 본다 — 걸음·공격 어느 컷보다 이쪽이 세다. */
        /* ★ 창은 **미사일이 사는 동안**이고, 시전자 태그는 안 본다(재지적:
           "고스트 핵 조준 자세 안해 아직도" · "핵 로딩중의 고스트가 사격자세를
           안취하고 총이 등뒤에 걸려있음") ─────────────────────────────────────
           두 가지가 겹쳐 이 자세가 거의 안 섰다.
           ① 시전 자국에 실린 raw는 **명령을 낸 사람** 쪽 값이라 이 개체의 raw와
              늘 같지가 않다 — `cr9 === e.raw`가 대부분 거짓이었다.
           ② 창이 castsNow였는데 그건 착탄 전 7초(NUKE_FALL_SEC)뿐이다. 그 값은
              **낙하 연출의 길이**이지 유도의 길이가 아니다. 고스트는 미사일이
              사는 내내 표적을 비춘다.
           그래서 참값이 아는 구간(핵탄두 개체의 born~died)을 그대로 쓴다. 자리로만
           걸러도 오인이 없다: 날아가는 핵의 착탄점 10타일 안에 선 고스트는 그 핵을
           유도하는 고스트뿐이다(원작 유도 사거리는 8이다).
           자세 컷보다 **먼저** 본다 — 걸음·공격 어느 컷보다 이쪽이 세다. */
        /* 근거를 **둘 다** 본다(재재지적: "고스트 핵조준 안하는데 다시 확인좀")
           — 하나가 비어도 다른 하나가 선다. 참값에 핵탄두 개체가 안 실린 옛
           자취에서는 nukeLase가 비고, 미사일이 너무 짧게 날아 걸러진 경우에는
           시전 자국만 남는다. 거리는 10 → 12타일로 한 뼘 넉넉히 잡는다(원작
           유도 사거리는 8이지만 화면의 몸은 교전 당김이 실린 딴 자리에 있다). */
        // 방향과 **같은 값**을 본다(위 nukeAim9) — 조건이 갈리면 자세만 서고
        // 몸은 두리번거리는 그림이 다시 난다.
        if (nukeAim9) return 2;
        const pk9 = POSE_KINDS[kindMain];
        /* 저사양은 자세 컷을 아예 안 고른다(요청: 저에서 애니메이션 제거).
           1·2배 칸도 같다(요청: 저배율 단순화) — 몸이 대여섯 픽셀이라 컷이
           안 읽히면서, 걸음 박자마다 종류별 판을 갈아 끼우는 삯만 든다. */
        /* ★ **날갯짓만은 간이 보기에서도 친다**(지적: "뮤탈 이동 시 날개짓 안 함")
           — 간이 보기를 4배까지 넓히면서(요청: 2·4배 단순화) 뮤탈·디바우러의
           날개까지 함께 멈춰 버렸다. 그런데 나는 저그에게 날갯짓은 '자세히
           보는 세부'가 아니라 **살아 있다는 표시**다: 멈춘 날개는 단순한 것이
           아니라 죽은 것으로 읽힌다.
           삯도 다르다 — 걸음·공격 컷은 종류마다 판을 서너 벌로 늘리고 박자마다
           갈아 끼우지만, 날갯짓은 두 컷(1↔3)을 오갈 뿐이고 그 둘은 이미 캐시에
           함께 산다. 종류도 둘뿐이다. 그래서 이것만 문턱 밖으로 뺀다. */
        if (!pk9 || markerView || !qAnim) return 0;
        /* 럴커 버로우 파기(요청: "가라앉는 게 아니라 제자리에서 앞다리 넷으로 빠르게 땅을 파는 모션") — 창 동안 4·5 컷을
           9Hz로 오간다(왼·오른 다리가 번갈아 찍는다). 간이 보기 문턱보다 앞이다 — 폰에서도 보여야 한다. */
        if (digging9 && kindMain === "lurker") return Math.floor(t * 18) % 2 === 1 ? 5 : 4;
        /* 간이 보기에서는 **날갯짓이 있는 종류만** 컷을 고른다 — 차례는 아래
           그대로 둔다(공격 컷이 날갯짓보다 앞선다). 여기서 걸러 내기만 한다. */
        /* ★ 이동 컷(걸음·비행 추진)만은 **셋째 칸(3배)부터** 친다(요청) — 판은 컷 수만큼
           늘지만 3배의 판은 작아 삯이 작고, 움직임이 읽히는 것이 먼저다. 공격 컷은 그대로. */
        if (liteView && !pk9.flap && !((pk9.move || pk9.thrust))) return 0;
        // 비행체(thrust): 걸음 컷이 없으니 이동 중이면 자세 1 고정 — 빌더가 그 자세에서만 불꽃을 낸다.
        if (pk9.thrust) return movingNow ? 1 : 0;
        /* ★ **걸음이 공격보다 먼저다**(지적: "질럿 걷기가 적용 안된듯?") —
           여태 공격이 먼저였는데, `fighting`은 '사거리 안에 적이 있다'라
           표적을 향해 **걸어가는 내내** 참이다. 그래서 교전 지역에 들어선
           순간부터 걸음 컷이 통째로 사라졌다 — 질럿처럼 붙으러 가는 유닛이
           가장 크게 손해를 봤다. 원작도 걸으면서 때리지는 않는다: 실제로
           자리를 옮기는 동안은 걸음이고, 멈춰 선 뒤라야 공격이다. */
        if (pk9.move && movingNow) {
          const sp0 = speedOf(drawUnit || "Marine", t, e.ups);
          const cad0 = Math.min(9, Math.max(2, sp0 * 2.2));
          return Math.floor(t * cad0) % 2 === 1 ? 3 : 1;
        }
        /* 컷 고르기는 **공용 문**(atkCutOf·flapCutOf)이 낸다 — 도록도 같은
           문을 지난다. 두 곳이 따로 적어 두었더니 갈렸다(그 함수의 ★ 주석). */
        const flapCut = (): 0 | 1 | 3 | 4 => (pk9.flap ? flapCutOf(pk9.flap, t) : 0);
        if (pk9.atk && fighting && kindMain !== "lurker") {
          const pf9 = isKnownKind(drawUnit) ? profileOf(drawUnit) : null;
          const w9 = pf9 ? weaponVs(pf9, !!foe?.air) : null;
          const cd9 = Math.max(0.2, w9 ? w9.cd : 0.6);
          const ph0 = firePhase(`p${holdKey}`, cd9);
          /* ★ 쉬는 위상에는 **날갯짓으로 되돌아간다**(지적: "뮤탈 이동 시 날개짓
             안 함") — 뮤탈·디바우러는 flap과 atk를 둘 다 갖는데, 사거리 안에
             적이 있으면(fighting) 쿨다운의 65% 동안 기본 자세를 돌려줘 날개가
             통째로 멈췄다. 나는 몸에게 기본 자세는 쉬는 것이 아니라 떨어지는
             것이다. 그 처방이 공용 문 안에 들어가 있다(flapHz 인자). */
          return atkCutOf(kindMain, ph0, pk9.flap, t);
        }
        /* 날갯짓은 **자취가 멈춰 있어도** 돈다(요청) — 공중에 뜬 몸은 늘
           날개를 쳐야 떠 있는 것으로 읽힌다. */
        if (pk9.flap) {
          return flapCut();
        }
        if (pk9.move && movingNow) {
          const sp9 = speedOf(drawUnit || "Marine", t, e.ups);
          const cad9 = Math.min(9, Math.max(2, sp9 * 2.2));
          /* 걸음은 **두 컷을 오간다**(1 ↔ 3) — 기본 자세로 돌아오면 앞으로
             나가는 발이 늘 한쪽이 된다(위 POSE_WALK_B 주석). */
          return Math.floor(t * cad9) % 2 === 1 ? 3 : 1;
        }
        return 0;
      })(),
      /* 태울 땐 떠오르며 사라지고, 내릴 땐 그 반대로 내려오며 드러난다(요청)
         — rideK가 태우기에서 0→1, 내리기에서 1→0이라 한 식이 둘을 다 낸다. */
      /* 파고드는 몫(요청) — 선 몸이 창(BURROW_DIG_SEC) 동안 제 키만큼 땅으로
         잠긴다. rise는 '위로 띄우는 몫'이라 음수가 곧 가라앉음이다. */
      rise: rise9,
      color: modeColor(e.raw, team),
      alpha: (() => {
        /* 클로킹(전수조사) — 개인 클록(f=14/15)·상시 은신(다크·옵저버)·아비터
           은신장. 적 디텍터(오버로드·옵저버·베슬·터렛·스포어·캐논·스캔)가
           곁이면 반쯤 벗겨진다. */
        if (!cloakedNow9) return u === "" ? 0.8 : 1;
        return 0.4;   // 탐지와 무관하게 은신 상태 그대로(위 은신 규칙)
      })(),
      air: uAir,
      /* 뜨는 높이는 **여기서 한 번 재서 실어 보낸다**(지적: "공중 유닛 크기에 따라
         떠 있는 높이가 다른 버그") — 그리는 쪽·집는 쪽·팝업 셋이 이 칸을 나눠
         읽는다(위 airPx 주석). 값은 제 몸이 아니라 기준 몸이 낸다. */
      ...(uAir ? { airPx: airLiftPxOf(ay3) } : {}),
      /* 겹침 이완은 v2에선 안 쓴다(지적: 다시 넣되 새로) — 도착 대형(entWalks의
         해바라기 나선)이 겹침을 미리 푸는 방식이라, 프레임마다 밀치는 이완의
         떨림이 없다.
         ★ 다만 **일꾼은 예외**다(지적: "자원채취중인 일꾼이라도 일꾼끼리만
           겹치는거지 다른 종류 유닛하고는 충돌함") — 일꾼의 자리는 대형이 아니라
           채굴 동선이 정하므로 저 나선을 안 탄다. 그래서 홀 앞에 선 병력 위로
           일꾼이 그대로 올라타 있었다. 일꾼만 이완에 넣고(noSep 해제), 나머지
           유닛은 그 이완에서 **못 박힌 장애물**로 선다: 밀리는 것은 일꾼뿐이라
           병력 대형은 한 톨도 안 흔들리고, 일꾼끼리는 종전대로 포갤 수 있다
           (아래 이완의 같은 임자 일꾼 예외). */
      noSep: !WORKER_KIND_SET.has(kindMain),
    });
    /* 귀신 활강(요청: 하템이 약간 귀신처럼 이동) — 걷는 동안 지나온 자리에
       몸 잔상을 끌고 다닌다. 그림자·체력바·링 없이 몸만.
       ★ 한 장·파란색으로(지적: "하템뒤그림자는 파란색이고 한장만 보이면 될듯")
         — 두 장은 걸음마다 세 몸이 겹쳐 '유닛이 셋'으로 읽혔고, 임자 색 그대로라
         잔상이 아니라 뒤따르는 아군으로 보였다. 잔상은 몸이 아니라 자국이므로
         판을 통째로 사이오닉 푸른빛 한 색으로 굽는다(solid). */
    if (kindMain === "htemp" && movingNow && !fighting) {
      const hr9 = (bodyHdg * Math.PI) / 180;
      const mainOp = unitOps[unitOps.length - 1];
      /* 0.45 → 0.22타일(요청: "환영을 본체에 더 가까이, 약간 겹쳐야 함"). */
      const [gfx9, gfy9] = posFrac(ax3 + Math.sin(hr9) * 0.22, ay3 - Math.cos(hr9) * 0.22);
      unitOps.push({
        ...mainOp, fx: gfx9, fy: gfy9, z: mainOp.z - 1,
        alpha: mainOp.alpha * 0.34, solid: "#5f8dff", ghost: true,
        selRing: undefined, hpFrac: undefined, tint: undefined, noShadow: true,
      });
    }
    /* 포탑 판(요청: 발포 시 포탑·포신만 움직임) — 쏘는 박자(1.5초 주기 앞 0.18초)에
       포탑만 뒤로 0.4타일 밀렸다 돌아온다. 차체 판(kindMain)은 제자리다. */
    // 포탑 판은 4배부터(요청: 저배율 단순화) — 판이 한 벌 더 굽히는 자리다.
    if (gunKind && !markerView && !liteView) {
      const fireK = fighting && foeDeg !== null && ((t + ei * 0.7) % 1.5) < 0.18 ? 1 : 0;
      const gdx = foeDeg !== null ? -Math.sin((foeDeg * Math.PI) / 180) : 0;
      const gdy = foeDeg !== null ? Math.cos((foeDeg * Math.PI) / 180) : 0;
      const last = unitOps[unitOps.length - 1];
      /* 반동 0.4 → 0.09타일(지적: "시즈탱크 포탑부가 몸체의 중앙이 아니며") —
         탱크의 몸이 0.75타일인데 0.4타일을 물리면 쏠 때마다 포탑이 차체 절반을
         벗어나 뒤로 빠진다. 그 순간이 1.5초마다 0.18초씩 오므로, 가만히 보면
         포탑이 늘 뒤쪽에 어긋나 있는 것처럼 읽힌다. 반동은 알아볼 만큼만 있으면
         된다 — 0.09타일이면 몸의 8분의 1이다. */
      const [gfx, gfy] = posFrac(ax3 - gdx * 0.09 * fireK, ay3 - gdy * 0.09 * fireK);
      unitOps.push({
        // 포신 가려짐 해결(지적) — 곁 유닛의 z가 포탑을 얇게 자르지 않게 여유 있게.
        ...last, kind: gunKind, fx: gfx, fy: gfy, z: last.z + 30,
        /* 포신 반동 컷(요청) — 차체 판은 컷이 없으므로 몸 op의 pose를 물려받아
           봐야 늘 0이다. 발포 박자(fireK)가 곧 이 판의 자세다. */
        pose: fireK ? 2 : 0,
        /* 포탑은 **표적을 본다**(요청: "포톤, 터렛, 시즈탱크는 공격방향에 맞게
           포탑부를 돌려줘야함") — 여태 포탑 판이 차체 방향(rotDeg)을 그대로
           물려받아, 옆에서 오는 적을 차체째 돌지 않고는 겨눌 수 없었다. 표적이
           없을 때만 차체를 따른다(포신이 허공을 겨눈 채 굳지 않게).
           축은 포탑 링이다 — 위 tankTurret이 링을 모델 원점에 맞춰 둔 덕이다. */
        rotDeg: foeDeg !== null ? foeDeg : last.rotDeg,
        selRing: undefined, hpFrac: undefined, hpMax: undefined,
        tint: undefined, groundShadow: undefined,
      });
    }
    /* 전투 효과(지적: 효과 다 살리기) — 유닛별 예광탄이 가장 가까운 적 쪽으로
       뻗고, 이따금 퍼프가 터진다. DOM 수를 아끼려 세 개체에 하나만 효과를 단다. */
    /* 피격 연출(지적: 마린 트레이서는 있는데 공격받는 오버로드엔 피격효과가
       없다) — 최근 적 공격 명령의 표적이 '나'면, 싸울 수 없는 유닛(오버로드·
       일꾼·수송)에도 맞는 불꽃이 튄다. */
    /* (걷어냄) 캐리어 둘레를 도는 인터셉터 점열 — 개수(e.ic)만 알고 자리를
       몰라서, 몸 둘레를 일정 반지름으로 도는 점을 지어내 그렸다. 그 자리는
       참값이 아니었다: 인터셉터는 표적까지 날아갔다 돌아오므로 캐리어에서
       한참 떨어져 있는 시간이 더 길다. 그런데 자취에는 인터셉터가 **제 태그와
       제 길**로 이미 들어 있었다(SHAPE_BUILDERS.interceptor 주석의 실측).
       이제 다른 유닛과 같은 길로 저 스스로 그려지므로 지어낼 것이 없다.
       ★ e.ic(개수 변곡점)는 그대로 둔다 — 격납 중인 것까지 세는 값이라
         인포 팝업 같은 자리에서 "지금 몇 기 물고 있나"로 쓸 수 있고, 참값
         꼴을 건드리면 재분석이 든다. */
    /* 피격(요청: 지금은 피해 객체와 멀리 떨어진 곳에서 나오고 크기도 크다) —
       예전엔 '최근 8초 안에 어택 명령이 찍은 태그'를 맞은 것으로 쳤다. 명령이
       찍힌 곳과 실제로 맞는 곳은 다르고(표적은 그 사이 걸어가 있다), 8초 내내
       켜져 있어 싸움과 무관한 자리에서도 불티가 텄다. 이제 제 체력 자취가
       내려간 순간(hurtAt)에만, 제 몸 위에서 짧게 튄다. */
    /* 잠깐만 뜬다(지적: "절대 움직임 없게 잠깐 표시") — 0.7 → 0.3 → 0.15초.
       ★ 더 줄이는 까닭이 있다(요청: "공격은 대부분 멈춰서 하지만 맞는건 움직이면서
         맞음 ... 아주 짧게 보여줘야 하는 이유야") — 맞는 몸은 그 사이에도 계속
         걷는데 불티는 맞은 그 순간의 자리에 서 있어야 한다. 창이 길수록 몸이
         불티를 두고 앞으로 나가, 불티가 몸에서 떨어져 나온 것처럼 보인다.
         0.15초면 20Hz 그리기에서 세 프레임이라 보이기는 하고, 그동안 가장 빠른
         유닛도 반 타일을 못 간다. */
    /* 마커 보기에서는 여기서 끝 — 점 크기 몸 위의 불티·실드막·트레이서는
       안 읽히면서 hitDirOf(표적 탐색)·DOM 스팬 값만 문다. 몸 op는 위에서
       이미 밀어 두었다. */
    /* 낮은 칸도 여기서 끝난다(요청: 저배율 단순화) — 그리는 쪽이 문턱으로 이미
       접는 값들이라 **그림은 한 톨도 안 달라지고**, 유닛마다 표적을 찾고
       (hitDirOf) 각을 재고 스팬 값을 짓던 삯만 사라진다.
       ★ 그 문턱이 이제 **트레이서 것**이다(요청: 2배부터) — 여태 여기서 8배
         미만을 통째로 끊었기 때문에, 트레이서를 그리는 쪽만 열어 봐야 재료가
         없어 아무것도 안 나온다. 2배부터는 흐름을 태우되, 트레이서가 아닌
         값(피격 불티·실드막)은 아래에서 제 문턱으로 다시 막는다. */
    if (markerView || !tracerView) return null;
    /* ★ 피격 불티·실드막은 **여태 문턱 그대로**(8배부터)다 — 내려온 것은
       트레이서뿐이다(요청). 여기서 hitNow를 접어 두면 아래 흐름이 통째로
       그대로 산다: hitSrc9(때린 쪽 찾기)도 안 돌고, hitFx9가 null이라
       "안 싸우는데 맞았다"는 갈래도 저절로 안 걸린다 — 2~4배에서는 싸우는
       몸의 트레이서만 남는다. */
    /* ★ 몸이 없는 개체(스캔·다크 스웜 자국 등)는 피격 불티·실드막을 안 낸다(지적: 스캔에
       동심원) — 스캔 개체는 참값에 체력(에너지)이 깎이는 자취가 실려 '맞았다'로 읽혔고,
       실드막 고리가 탐지 반경 크기로 그려졌다. */
    const hitNow = !liteView && !NO_BODY_UNITS.has(drawUnit) && t - hurtAt <= 0.15;
    /* 덜어내기 1단(요청: 모바일 과밀 — "유닛 수 + 그리기 속도" 문턱) — 홀수 개체의 트레이서를
       안 낸다. 개체 색인(ei)은 장마다 같으므로 깜빡이지 않고, 맞는 중(hitNow)이면 그대로
       살려 피격은 한 번뿐인 것을 안 잃는다. 옛 '세 개체 중 하나' 배율 솎기와 달리 문턱이
       밀도라 한두 기뿐인 장면은 안 건드린다. */
    if (crowd9 >= 1 && (ei & 1) === 1 && !hitNow) return null;
    /* 효과는 가슴 높이(지적: 공격 효과가 너무 낮다 — 발밑에서 튀었다) — 마커
       기준점은 발 자리라, 몸이 실제로 떠 있는 몫만큼 띄워 몸통에 맞춘다.
       ★ 그 몫은 **그리는 쪽과 같은 식**이어야 한다(지적: "공중유닛의 피격효과가
         공중의 몸이 아닌 땅에 나오는 문제") — UnitLayer는 몸을 발 자리에서
         `크기 × (0.24 + 공중이면 0.8 + rise)`만큼 위로 들어 찍는데, 여기서는
         0.34 한 값으로 못 박혀 있었다. 지상 유닛에서는 0.24 + 가슴 몫 0.10이라
         우연히 맞았지만, 공중 유닛은 몸이 0.8만큼 더 떠 있어 불티가 땅에서
         텄다. 같은 식을 쓰면 앞으로 들기가 바뀌어도 한 줄만 따라오면 된다. */
    const fxPx = drawUnit === ""
      ? unitGlyphPx(kindMain, kindMain, 0, ay3) : unitPxOf(drawUnit2, ay3, kindMain);
    /* ★ **평면(2D)에서는 공중을 덜 띄운다**(지적: "공중유닛이나 떠있는 건물 공격시
       2d에서 우리가 일부러 낮게 그리잖아 그걸 고려안하고 높은데를 겨냥하는거같아") —
       맞다. 그리는 쪽(UnitLayer)은 나는 몸을 airLiftPxOf만큼만
       띄운다: 위에서 내려다보는 그림에서 온몫을 띄우면 몸이 제 발자국에서 통째로
       떨어져 나가기 때문이다. 그 축소는 판정(pickAt)과 인포팝업에도 이미 실려
       있는데(그 두 자리 주석), **효과 층에만 안 실려 있었다** — 그래서 트레이서는
       실제 몸보다 한참 위를 겨누고 피격 불티도 허공에서 텄다.
       같은 자를 쓴다. 아래 조준·탄 길이·표적 위 그림까지 전부 이 한 값을 곱한다 —
       앞으로 그리는 쪽이 축소 비를 바꿔도 여기가 저절로 따라온다. */
    /** 공중으로 들리는 몫(px) — 지상은 0. 그리는 쪽과 **같은 함수**를 부른다
     *  (airLiftPxOf) — 여태는 여기서 `제 몸 × AIR_LIFT_K`를 다시 셈했고, 그래서
     *  몸집이 곧 높이가 되는 그 버그를 효과까지 그대로 물려받았다. */
    const airLift9 = uAir ? airLiftPxOf(ay3) : 0;
    const fxBody = fxPx * 0.24 + airLift9;
    /* ── 전투 효과는 캔버스로(요청: 이펙트 캔버스 이관) ────────────────────
       여태 여기서 개체마다 CSS 애니메이션 <span>을 돌려보냈다 — 난전이면 그
       스팬 ~100개가 그리기 틱마다 React 생성·diff·DOM 스타일 패치·컴포짓을
       물었다(계측: perf-check — 중간 배율 CPU 자기 시간의 몸통이 (program)
       34%였고 그 대부분이 이 DOM 경로다). 이제 숫자 몇 개짜리 FxOp만 밀고
       UnitLayer 캔버스가 몸 위에 그린다. CSS 키프레임이던 애니메이션은 전부
       재생 시각 t의 위상으로 옮겼다(그리는 쪽 봉투 함수들). */
    const liftPx9 = fxBody + fxPx * 0.1;
    /* 맞는 쪽 불티(요청: 크기도 몸에 맞게) — 몸 상자의 0.42배, 가슴 높이.
       싸우는 중이어도 맞으면 띄운다 — 맞는 것과 때리는 것은 따로다. */
    /* 프로토스는 실드가 먼저 깎인다(요청) — 남은 비율이 체력 몫보다 크면 아직
       실드가 버티는 중이라, 불티 대신 몸을 감싼 푸른 막이 한 번 번쩍인다. */
    const st9 = UNIT_STATS[drawUnit2] ?? UNIT_STATS[drawUnit];
    const shShare9 = st9 && st9.sh ? st9.sh / (st9.hp + st9.sh) : 0;
    const shieldUp9 = shShare9 > 0
      && hpNow / Math.max(1, hpFull) > 1 - shShare9 + 0.001;
    /* 맞은 방향(요청) — 닿아 있는 적이 곧 때린 쪽이다. 없으면 몸 가운데.
       같은 물음에서 **때린 무기**도 함께 받는다(요청: 공격 종류별 피격 효과). */
    const hitSrc9 = hitNow ? hitSrcOf(e.tag, rawPos.x, rawPos.y) : null;
    const hitDir9 = hitSrc9?.dir ?? null;
    /** 때린 무기의 갈래 — 트레이서와 같은 이름표(ATTACK_FX)를 쓴다. */
    const hitWpn9 = hitSrc9?.uk ? ATTACK_FX[hitSrc9.uk] : undefined;
    /** 맞은 몸의 결 — 죽음 효과가 고르는 것과 **같은 식**이다(요청: 결을 같이). */
    const hitMat9: "bio" | "mech" | "toss" | "zerg" = race === "저그" ? "zerg"
      : race === "프로토스" ? "toss"
        : BIONIC_UNITS.has(drawUnit) ? "bio" : "mech";
    const [fxfx9, fxfy9] = posFrac(ax3, ay3);
    const hitFx9: FxOp | null = hitNow ? (shieldUp9
      /* ★ 실드 막의 자도 **보이는 몸**이다(같은 스크린샷에서 함께 드러났다) —
         fxPx는 모델 상자라 몸의 세 배 남짓이고, 1.05를 곱하면 막 하나가 유닛
         서넛을 덮는 크기가 된다(캐리어에서 실측). 잉크 몫으로 몸 폭을 되찾은 뒤
         1.35배 — 몸을 감싸되 이웃은 안 삼킨다. 아래 hit는 이미 0.42(= 몸의
         1.29배)라 그대로 둔다. */
      /* 크기는 몸에 **정비례**한다(정정: 제곱근으로 해 보니 건물에서 거의 안 보였다 — 되돌림).
         ★ 자는 **보이는 몸 폭**(W = 상자 × 잉크/16)이다(지적: "실제로는 후보판보다 훠얼씬 크게
           나온다") — 옛 0.42×상자는 상자가 몸의 세 배 남짓이라 파편 반지름이 몸 폭의 0.5배,
           튀는 자리(dist 기본 = size×0.71)는 몸 폭 하나 밖이었다. 후보판의 비(반지름 = 몸 폭의
           1/4, 튀는 자리 = 중심에서 몸 폭의 0.32)로 맞춘다. */
      ? { kind: "shield", fx: fxfx9, fy: fxfy9, lift: liftPx9,
        size: fxPx * (modelInkOf(kindMain) / 16) * 1.2, ph: (t - hurtAt) / 0.4 }
      : { kind: "hit", fx: fxfx9, fy: fxfy9, lift: liftPx9,
        size: fxPx * (modelInkOf(kindMain) / 16) * 0.69, dist: fxPx * (modelInkOf(kindMain) / 16) * 0.32,
        /* 스커지 자폭(지적: "스커지 아직도 죽거나 폭발할 때 프로토스 효과") — 맞은 몸의 결이 아니라
           **때린 쪽**의 결이다. 스커지는 무기 표(ATTACK_FX)에 없어(자폭) hitWpn9가 비고, 맞은
           프로토스의 결(toss: 연푸른 줄)로 터져 스커지 자리에서 프로토스 효과가 났다. 자폭은 저그
           살점이 터지는 것이라 저그 결로 낸다. */
        ph: (t - hurtAt) / 0.14, mat: /scourge/i.test(hitSrc9?.unit ?? "") ? "zerg" : hitMat9,
        ...(hitWpn9 ? { style: hitWpn9 } : {}),
        ...(hitDir9 ? { dx: hitDir9[0], dy: hitDir9[1] } : {}) }) : null;
    if (hitFx9 && !fighting) {
      fxOps.push(hitFx9);
      return null;
    }
    /* (걷어낸 채 유지) 수리·힐 연출 — 재료였던 수리·힐 커맨드(f=10)를 참값은
       안 낸다. 되살리려면 상대 개체의 체력이 오르는 구간을 자취에서 읽어야 한다. */
    /* 럴커 가시 — 판정은 위(kind0 앞)에서 이미 냈다. 몸 모델과 가시가 **같은
       순간**에 바뀌어야 해서 그리로 옮겼다. */
    /* 솎기(기획서 1-G) — 근접은 이제 그릴 효과가 없으므로(잽 동작이 대신한다) 덜
       솎을 이유도 없다. 다만 맞은 불티는 솎으면 안 된다 — 맞는 순간은 개체마다
       한 번뿐이라 솎이면 통째로 사라진다. */
    /* ★ (걷어냄) 낮은 칸에서 **셋 중 하나만** 트레이서를 내던 솎기 ──────────────
       `if (liteView && fighting && !lurkStrike && !hitFx9 && ei % 3 !== 0) return null;`
       낮은 칸에서는 화면 밖 걷어내기가 안 듣는다(지도가 통째로 보인다)는 까닭으로
       둔 것인데, 그 대가가 컸다: 한두 기뿐인 종류(아콘·리버·아비터)는 **셋 중 둘이
       통째로 침묵**하고, 골리앗처럼 이미 뜸한 탄은 그 위에 3분의 1이 더 곱해졌다.
       걷어도 되는지 재 봤다 — 폰 판(390×760·DPR 2)에서 fx op을 한 프레임에 그리는
       값이다(번쩍임 75% + 미사일 자취 25%, CPU를 6배 느리게 걸어 저사양 기기에
       맞춘 값):
         op 50개 2.0ms · 100개 2.5ms · 200개 5.0ms · 400개 10.5ms
       폰의 그리기 주기가 20Hz(한 프레임 50ms)이므로, 솎기를 걷어 op이 셋 배가 되어
       400개가 되어도 그리는 값은 프레임의 5분의 1이다. 큰 난전에서도 감당한다.
       ※ 잰 것은 **그리는 값**이다 — 솎기를 걷으면 op을 만드는 자바스크립트도 함께
         는다(표적 기하·총구 앵커). 그쪽은 산술 몇 줄이라 비슷한 크기로 어림하지만
         실측은 아니다. 실제 기기에서 끊기면 '난전일 때만 솎기'로 되돌리면 된다
         (배율이 아니라 **화면에 든 싸우는 개체 수**를 문턱으로 삼는 쪽이 옳다 —
         배율은 그 수의 대리 지표일 뿐이라 한두 기뿐인 종류까지 함께 침묵시켰다). */
    /* 트레이서도 사양을 안 탄다(요청: "피격효과 트레이서 사망효과는 저사양에서도
       나와야해") — 남는 조건은 '싸우고 있나'뿐이다. */
    if (!fighting && !lurkStrike && !hitFx9) return null;
    /* 무엇이 '근접'인가는 **이름표가 아니라 사거리**가 정한다(요청: "원거리는
       무조건 나와야해") — 표가 말하는 사거리가 1타일 미만인 것만 진짜 근접이다. */
    const reach9 = drawUnit !== "" && isKnownKind(drawUnit)
      ? Math.max(fireRangeTilesOf(drawUnit, false), fireRangeTilesOf(drawUnit, true)) : -1;
    const trueMelee = reach9 >= 0 && reach9 < 1;
    if (!lurkStrike && !hitFx9 && (trueMelee || drawUnit === "")) {
      return null;
    }
    if (hitFx9) fxOps.push(hitFx9);
    const fxUnit = drawUnit === "" ? (race === "저그" ? "Zergling" : race === "테란" ? "Marine" : "Zealot") : drawUnit;
    const atkDeg = foeDeg;
    /* 조준각은 화면 기준(지적 둘: 공중 표적 각도 + 지상 사격은 지면과 평행) —
       화면 픽셀 델타로 재고, 공중 표적·공중 사수는 비행 높이를 가감한다. */
    /** 표적이 떠 있는 몫(px) — **표적 제 크기**로 잰다(방어 건물 쪽과 같은 셈).
     *  여태 여기서는 **쏘는 쪽**의 크기(fxPx)로 표적의 높이를 어림했다. 골리앗이
     *  뮤탈을 쏘면 뮤탈의 높이를 골리앗 몸으로 잰 셈이라, 몸집이 갈리는 짝일수록
     *  겨냥이 위아래로 어긋났다. 표적 이름은 FoeRow.uk가 들고 있다. */
    const foeLift9 = foe.air ? airLiftPxOf(foe.by) : 0;
    /* ★ 조준은 **사수 총구 → 표적 몸 가운데**(지적: 배틀크루저의 트레이서가 디바우러 위로 나감) ─────────────
       발사 시작점은 발밑에서 몸높이(liftPx9 = 들기 + 0.34·몸)만큼 위인데, 여태 방향은 발밑→발밑으로 셌다. 그러면
       선 전체가 사수 몸높이만큼 위로 밀려 끝점이 '표적 발밑 + 사수 몸높이'가 된다 — 사수가 크고 표적이 작으면
       표적 위 허공이다. 표적 쪽도 같은 자(0.34·제 몸)로 가운데를 잡는다. 사수·표적이 같은 크기면 옛 그림 그대로다. */
    const foePx9 = foe.uk && isKnownKind(foe.uk) ? unitPxOf(foe.uk, foe.by) : fxPx;
    const foeBody9 = foePx9 * 0.34;
    const aimDeg = (fx9: number, fy9: number, fAir: boolean): number => {
      const tPx9 = mapW9 / grid.width;
      const ddx = (fx9 - pos.x) * tPx9;
      let ddy = (fy9 - pos.y) * tPx9 * (pitched ? pitchFlat : 1);
      if (fAir) ddy -= foeLift9;
      ddy -= foeBody9;
      ddy += liftPx9;
      return (Math.atan2(-ddx, ddy) * 180) / Math.PI;
    };
    const beamDeg = atkDeg !== null ? aimDeg(foe.bx, foe.by, foe.air) : null;
    /** 총구에서 표적까지의 화면 거리(px) — 날아가는 탄이 얼마나 가야 하나. */
    const beamLen = ((): number => {
      if (atkDeg === null) return 0;
      const tPx9 = mapW9 / grid.width;
      const ddx = (foe.bx - pos.x) * tPx9;
      let ddy = (foe.by - pos.y) * tPx9 * (pitched ? pitchFlat : 1);
      if (foe.air) ddy -= foeLift9;
      ddy -= foeBody9;
      ddy += liftPx9;
      return Math.hypot(ddx, ddy);
    })();
    /* 총구 모델 앵커(승인) — 앵커는 몸 각(bodyHdg)으로 뽑고 — 그래서 늘 몸
       정면(포구)이다 — 빛의 기울기만 beamDeg가 정한다. */
    const fxKind = unitMarkerKind(
      siegeOn === 1 && fxUnit.startsWith("Siege Tank") ? "Siege Tank (Siege Mode)" : fxUnit,
      race,
    );
    const mzP = atkDeg !== null
      ? muzzlePoint(fxKind, bodyHdg, viewYawOf(ax3, ay3), pitched) : null;
    /** 그 무기의 **원** 쿨다운(초) — 발사 박자다. 날아가는 탄과 번쩍 주기가 쓴다. */
    const fxCdRaw = (() => {
      const pf9 = isKnownKind(fxUnit) ? profileOf(fxUnit) : null;
      const w9 = pf9 ? weaponVs(pf9, foe.air) : null;
      return Math.max(0.15, w9 ? w9.cd : 0.6);
    })();
    const fxCd = Math.min(0.32, Math.max(0.08, fxCdRaw * 0.35));
    /* 날아가는 탄(요청) — 발사 박자(쿨다운) 안에서 총구 → 표적으로 나아간다.
       1을 넘은 뒤로도 잠깐(20%)은 표적 자리에 못 박아 '꽂혔다'를 만든다. */
    /* ★ 셋은 **지상·대공 무기가 아예 다르다**(요청: "골리앗 지상 공격시 다발총
       트레이서 필요 스카우트 레이스도 지상은 다발총 느낌 트레이서임") ────────────
       원작에서 이 셋은 포탑이 둘이다: 대공은 미사일 발사관, 지상은 **연사 기관포**다
       (골리앗의 오토캐논, 레이스의 버스트 레이저, 스카우트의 이중 광자포). 여태
       대공만 갈아 끼우고 지상은 표의 기본값(골리앗 gun · 레이스 laser · 스카우트
       plasma)에 맡겨 두어, 셋 다 '한 발씩 툭 쏘는' 결이었다.
       지상은 캐리어와 같은 **다발총**(burst)으로 묶는다 — 짧고 밝은 것이 두두두
       이어 나가는 갈래다. 표(ATTACK_FX)를 안 고치고 여기서 가르는 까닭은, 그
       표가 '이 유닛의 무기'를 한 줄로 말하는 자리인데 이 셋은 한 줄로 못 적기
       때문이다(그래서 대공도 이미 여기서 갈리고 있다). */
    const dualFx9 = fxUnit === "Wraith" || fxUnit === "Goliath" || fxUnit === "Scout";
    /* ★ 레이스만 지상이 **제 레이저**다(요청: "레이스(대지) … 주황 얇은 선
       미사일") — 앞선 요청으로 셋을 한꺼번에 다발총(burst)으로 묶었는데, 그중
       레이스의 지상 무기(버스트 레이저)는 다발총이라기보다 짧은 광탄이 뾱뾱
       날아가는 것이라는 지적이다. 골리앗의 오토캐논·스카우트의 이중 광자포는
       종전대로 다발총이다.
       표(ATTACK_FX)의 Wraith가 이미 "laser"이므로 여기서는 갈래를 안 적고
       표로 물러나기만 하면 된다 — 한 곳에만 적힌다. */
    /* 스카우트만 금 탄두(요청) — 나머지 셋(골리앗·레이스·발키리)과 터렛은 은색이다. */
    const fxName9 = dualFx9 && foe.air ? (fxUnit === "Scout" ? "missileG" : "missile")
      : dualFx9 && fxUnit !== "Wraith" ? "burst"
        : ATTACK_FX[fxUnit];
    /** 이 발이 총구에서 표적까지 **나는 데 걸리는 시간**(초) — 지도 위 거리로
     *  잰다(아래 shotU의 ★). 날아가는 탄과 그 탄이 남기는 자국(산성 포자)이
     *  같은 시계를 봐야 '닿는 순간'이 둘에서 갈리지 않는다. */
/* ★ 나는 시간에 **바닥을 깐다**(지적: "골리앗 뮤탈 상대로 트레이서 안 나감") ─────────
       탄은 나는 동안에만 그려진다(아래 shotU의 ★: 안 날면 아무것도 안 그린다 — 총구 앞에
       막대가 서 있던 자리를 걷어낸 것이다). 그러면 화면에 보이는 몫은 곧 `나는 시간 ÷ 쿨다운`
       인데, 실측하면 골리앗 대공이 1타일 9% · 2타일 19% · 3타일 28%다. 뮤탈은 제 사거리가
       3타일이라 딱 그 구간에서 붙는다 — 열에 두 번만 보이니 "안 나간다"로 읽힌다. 게다가
       같은 골리앗의 **지상** 무기는 날아가는 탄이 아니라 번쩍임이라 늘 보여서, 한 유닛 안에서
       상대에 따라 있고 없고가 갈렸다.
       탄속(SHOT_TILES_PER_SEC)은 그 표가 스스로 "[어림]"이라 적어 둔 값이다. 그 어림이 말하려던
       것은 '탄이 눈에 보이게 날아간다'인데, 한 주기의 열에 아홉을 존재하지 않는 탄은 그 말을
       못 지킨다. 그래서 거리로 잰 시간이 너무 짧으면 **쿨다운의 몫**으로 바닥을 깐다(0.4배).
       절대 상한 0.4초를 함께 두는 까닭은 쿨다운이 아주 긴 무기(디바우러 4.2초 · 시즈 3.2초)
       에서 바닥이 그대로 1.7초가 되어 탄이 기어가기 때문이다. */
    /* 디바우러의 부식성 산(acid)은 원작에서 느리게 날아가는 탄이다(지적: 디바우러 탄이 안 보임 — 쿨다운 100프레임에
       비행 0.4초면 한 주기의 1/10만 보였다). 그 탄만 속도를 5타일/초로 낮추고 바닥을 1초로 올려 눈에 들게 한다. */
    const slowAcid9 = fxName9 === "acid";
    const flySec9 = ((cd9v: number, dist9v: number): number => {
      const floor9 = Math.min(cd9v * 0.4, slowAcid9 ? 1.0 : 0.4);
      return Math.min(cd9v * 0.9,
        Math.max(0.05, floor9, dist9v / Math.max(1, slowAcid9 ? 5 : SHOT_TILES_PER_SEC)));
    })(fxCdRaw, foeDist);
    const shotU = ((): number | null => {
      /* ★ 나는 거리는 **지도 위 거리**로 잰다(지적: "골리앗 스카웃 대공 미사일
         안 나감" · "트레이서가 여전히 떠 있는 건물엔 안 나가") ────────────────
         여기 있던 자는 beamLen — 총구에서 표적까지의 **화면** 거리다. 그 값은
         공중 표적일 때 조준 높이를 빼고 내는데(위 beamLen), 사수가 나는 몸
         **바로 밑**에 서면 그 뺄셈이 세로를 상쇄해 0에 가까워진다. 뜬 건물이
         특히 그렇다(제 자리 위에 떠 있으므로 가로 거리가 거의 없다). 그러면
         `beamLen <= 1`에 걸려 탄이 **아예 안 그려졌다** — 트레이서가 통째로
         사라지던 자리가 이것이다.
         날아가는 시간은 애초에 화면이 아니라 세계의 일이다. 지도 위 거리
         (foeDist)로 재면 조준 높이와 무관하고, 사수가 바로 밑에 서도 제 거리가
         남는다. 화면 거리는 그리는 길이·방향에만 쓴다(그건 화면의 일이 맞다). */
      if (!fxName9 || !PROJECTILE_FX.has(fxName9)) return null;
      if (!Number.isFinite(foeDist) || foeDist <= 0.05) return null;
      const ph9 = firePhase(`u${holdKey}`, fxCdRaw);
      const u9 = (ph9 * fxCdRaw) / flySec9;
      return u9 < 1.2 ? Math.min(1, u9) : null;
    })();
    if (beamDeg === null || !fxName9) return null;
    /* ★ 산성 포자 — 디바우러의 산은 **표적에 남는다**(지적: "디바우러 트레이서는
       나가는데 타겟에 산성 효과가 안 남는 거였어") ────────────────────────────
       원작의 부식성 산(Corrosive Acid)은 맞히고 끝나는 무기가 아니다. 맞은 몸에
       **산성 포자**가 들러붙어 눈에 보이게 남고(겹쳐 쌓인다), 그동안 그 몸은 더
       아프게 맞고 더 느리게 쏜다. 디바우러 한 기가 판을 바꾸는 것이 그 자국이지
       한 발의 피해가 아니다.
       그런데 화면에 그 자국이 설 자리가 없었다. 맞는 쪽 그림(FX_IMPACT.acid)은
       **체력이 실제로 줄어든 순간**에만 0.14초 뜨는데, 참값의 체력은 띄엄띄엄
       적히므로 대부분의 사격에는 아무것도 안 난다(커세어가 통째로 안 보이던 그
       사정이다). 게다가 이 무기는 쿨다운이 원작에서 가장 길어(100프레임 = 4.2초)
       탄이 나는 몫은 한 주기의 1/8뿐이다 — 나머지 7/8 동안 표적은 말짱해 보였다.
       그래서 자국을 **탄과 따로** 낸다: 탄이 닿는 위상(flySec/쿨다운)을 지나면
       다음 발이 올 때까지 표적 몸에 포자가 붙어 서서히 삭는다. 곧 한 주기가
       '날아가는 8분의 1 + 남아 있는 8분의 7'로 채워져, 겨눠진 몸이 늘 산에
       덮여 있다.
       ★ 자국의 임자는 **쏘는 쪽**이다 — 참값에는 "이 몸에 포자가 몇 겹인가"가
         없고 "이 디바우러가 무엇을 겨누나"만 있다. 그러니 겨누는 동안만 그린다:
         지어낸 겹수를 몸에 얹는 대신 참값이 아는 만큼만 말한다. 둘이 한 몸을
         겨누면 자국도 두 벌이라 저절로 짙어진다(원작의 겹침과 결이 같다). */
    const acidAge9 = ((): number | null => {
      if (fxName9 !== "acid") return null;
      if (!Number.isFinite(foeDist) || foeDist <= 0.05) return null;
      /** 탄이 닿는 위상 — 그 뒤가 곧 '자국이 남아 있는' 구간이다. */
      const land9 = Math.min(0.9, flySec9 / Math.max(0.05, fxCdRaw));
      const ph9 = firePhase(`u${holdKey}`, fxCdRaw);
      // 아직 안 닿았으면 자국이 없다 — 첫 발 전에 미리 묻히지 않는다.
      return ph9 >= land9 ? (ph9 - land9) / Math.max(0.05, 1 - land9) : null;
    })();
    if (acidAge9 !== null) {
      /* 크기·높이는 **표적 제 몸**의 것이다 — 쏘는 쪽 크기로 어림하면 몸집이
         갈리는 짝에서 자국이 몸을 벗어난다(조준 높이가 데었던 그 자리와 같다).
         ★ 그리고 그 자는 **보이는 몸**이어야 한다 — unitPxOf가 내는 것은 모델
           **상자**이고 모델이 그 상자를 채우는 몫은 3분의 1 남짓이다
           (modelInkOf/16). 상자로 재면 포자가 몸에서 한참 떨어진 허공에 붙는다
           (실드막·미사일 두 발 간격이 똑같이 데었던 자리다). 잉크 폭으로
           되돌린 뒤 아주 조금만 넓혀, 몸 테두리에 걸치게 둔다. */
      const aKind9 = foe.uk ? (UNIT_3D[foe.uk] ?? "") : "";
      const aPx9 = (foe.uk && isKnownKind(foe.uk)
        ? unitPxOf(foe.uk, foe.by) : fxPx) * (modelInkOf(aKind9) / 16) * 1.1;
      const [afx9, afy9] = posFrac(foe.bx, foe.by);
      fxOps.push({
        kind: "beam", style: "acidspore", fx: afx9, fy: afy9,
        lift: foe.air ? foeLift9 : aPx9 * 0.5,
        mx: 0, my: 0, deg: 0, ph: acidAge9, size: aPx9,
      });
    }
    /* 총구 오프셋(렌즈 px) — 모델 앵커가 있으면 CSS의 translate→rotate 순서
       그대로(안 돌린 오프셋), 없으면 옛 픽셀 폴백(rotate→translateY = 방향 ×
       오프셋)이다. 앵커 배수는 몸 판의 것(modelNormOf, 버로우면 구멍 판). */
    const mzS = modelNormOf(burrowed ? kind0 : (MUZZLE_PLATE[fxKind] ?? fxKind));
    const rad9 = (beamDeg * Math.PI) / 180;
    const [mzx9, mzy9]: [number, number] = mzP
      ? [((mzP[0] - 8) * mzS * fxPx) / 16, (((mzP[1] - 8) * mzS * fxPx) / 16) + 0.1 * fxPx]
      : [-Math.sin(rad9) * (MUZZLE_PX[fxUnit] ?? 4), Math.cos(rad9) * (MUZZLE_PX[fxUnit] ?? 4)];
    /* ★ 쏘는 쪽에 선을 안 긋고 **표적 위에 직접 그린다**(요청: "커세어는 트레이서가
       자기 자신 쪽엔 없고 대상한테 넙적한 타원 형태로 플라즈마" · 재지적: "커세어
       플라즈마 공격 안 보임") ────────────────────────────────────────────────
       앞판은 쏘는 쪽만 걷고 맞는 쪽의 피격 그림에 맡겼는데, 그 그림은 **맞은 몸의
       체력이 실제로 줄어든 순간**(hurtAt, 0.15초 창)에만 뜬다. 참값의 체력은 띄엄
       띄엄 적히므로 대부분의 사격에는 아무것도 안 났다 — 그래서 통째로 안 보였다.
       이제 이 무기는 **쏘는 박자에 맞춰 표적 자리에** 제 그림을 낸다: 자리는 적의
       타일, 박자는 이 개체의 쿨다운 위상이다. 맞는 쪽 그림(FX_IMPACT.flare)과 같은
       표를 쓰므로 실제로 체력이 줄 때 나는 그림과 결이 같다. */
    /* ★ 사거리 문은 **스플래시보다 앞**이다(지적: "스플래시와 줄기가 다른 대상을
       가리키는 문제") ────────────────────────────────────────────────────────
       이 문이 아래 줄기 push 직전에 있었다. 그런데 스플래시는 그보다 **먼저**
       밀리므로, 표적이 사거리 밖이면 스플래시만 남고 줄기는 안 나갔다 — 줄기 없는
       스플래시가 엉뚱한 자리에 떠 있는 것이 그 그림이다. 둘은 같은 표적을 가리키는
       한 벌이니 문도 하나여야 한다: 여기서 막으면 둘 다 안 난다. */
    if (st9Span(fxName9) && foeDist > 0.05 && isKnownKind(fxUnit)) {
      const rtq9 = reachTiles(fxUnit, foe.uk && isKnownKind(foe.uk) ? foe.uk : fxUnit,
        foe.air);
      if (rtq9 > 0 && foeDist > rtq9) return null;
    }
    if (fxName9 && (NO_BEAM_FX.has(fxName9) || TARGET_FX.has(fxName9))) {
      /* 거리 문턱은 **선을 안 그리는 갈래에만** 건다 — 그쪽은 거리가 곧 '쏘고
         있나'의 대역이었다. 표적 그림만 더 얹는 갈래(TARGET_FX)는 붙어 싸울수록
         오히려 잘 보여야 하므로 문턱이 없다(아콘은 2타일에서 싸운다). */
      if (beamLen > 1 || TARGET_FX.has(fxName9)) {
        const [tfx9, tfy9] = posFrac(foe.bx, foe.by);
        const dly9 = ((ei * 7) % 5) / 10;
        const tph9 = (((t - dly9) % fxCd) + fxCd) % fxCd / fxCd;
        fxOps.push({
          kind: "hit", style: fxName9, fx: tfx9, fy: tfy9,
          /* ★ 지상 표적도 **몸 위**에 앉힌다(지시: "스플래시가 유닛보다 위에
             보이게") — 0.18은 발치라, 몸이 그 위에 서면 그림이 발밑에 깔린 얼룩이
             된다. 게다가 줄기는 조준 높이(몸 가운데)로 오는데 그림만 발치에 있으니
             둘이 어긋나 안 맞닿았다. 몸 한가운데로 올려 둘을 같은 줄에 세운다.
             공중 표적은 종전대로 제 비행 높이다(foeLift9). */
          /* 지상 표적의 높이는 **표적의 몸**으로(지적: "아콘 플라즈마 스플래시가 지상 유닛을 겨눠도 공중에만
             표시") — fxPx는 쏘는 쪽(아콘)의 몸이라, 작은 지상 표적 위 한참 공중에 떠 있었다. 표적 종류를 알면
             그 몸의 가슴 높이(0.34·몸), 모르면 종전값. */
          lift: foe.air ? foeLift9
            : (foe.uk && isKnownKind(foe.uk) ? unitPxOf(foe.uk, foe.by) : fxPx) * 0.34,
          size: fxPx, dist: 0, dx: 0, dy: 0, ph: tph9, splash: true,
        });
      }
      // 선을 안 그리는 갈래만 여기서 끝난다 — 나머지는 아래로 내려가 선도 그린다.
      if (NO_BEAM_FX.has(fxName9)) return null;
    }
    if (lurkStrike) {
      /* 럴커 가시 — 원작은 표적이 아니라 '방향 × 최대 사거리'로 늘 212px을
         훑는다(iscript behaviour 9). 속도(18.75px/프레임)가 정한 0.475초 주기로
         자란다. ★ CSS 시절 이 가시는 존재하지 않는 keyframes(scr-spike-run)를
         불러 opacity 0에 갇혀 있었다 — 캔버스로 오며 처음으로 실제로 보인다. */
      const tPx9 = mapW9 / grid.width;
      const spikeDur9 = (LURKER_SPINE_TRAVEL_PX / LURKER_SPINE_SPEED_PX) * FRAME_SEC;
      /* 겨눔은 이 마디의 것으로 못 박는다(위 lockAim 주석) — 원작의 가시도 한 번
         나가기 시작하면 그 방향으로 끝까지 훑는다(behaviour 9: 방향 × 최대 사거리).
         표적을 따라 도는 것은 이 무기의 성질이 아니다. */
      const spikePh9 = firePhase(`u${holdKey}`, spikeDur9);
      const aimL9 = lockAim(`lk${holdKey}`, spikePh9, beamDeg, 0);
      fxOps.push({
        kind: "spike", style: "spike", fx: fxfx9, fy: fxfy9, lift: 0,
        /* ★ 시작점은 **몸 한가운데**다(지적: "럴커 가시 이제보니 시작하는 지점이
           럴커 몸 중앙이 아님") — 여기 실리던 mzx9/mzy9는 muzzlePoint가 낸 **선
           럴커의 주둥이** 자리다(총구 앵커표에 버로우 별본이 없어 lurker 판의 값이
           나온다). 총구가 있는 무기라면 그게 맞지만, 가시는 총구에서 나가는 것이
           아니라 **묻힌 몸 밑 땅에서** 줄지어 솟는 것이다. 그러니 앵커는 몸의
           발밑 그대로여야 하고, 오프셋은 0이다. */
        mx: 0, my: 0, deg: aimL9.deg,
        /* ★ 길이는 **늘 같다**(지적: "럴커 가시는 목표물 방향으로 뻗는건 맞는데
           나오는 간격 거리는 항상 동일함 가까이 있는 목표물은 가까운 가시에
           맞는것뿐임") — 원작 그대로다(iscript behaviour 9: 방향 × 최대 사거리로
           늘 212px을 훑는다). 한때 '맞는 것 뒤로 가시가 계속 솟아 누구를 때리는지
           안 읽힌다'며 표적까지 끊었는데, 그건 이 무기의 성질을 화면 읽기 편하려고
           지운 것이었다: 가시는 표적을 겨눠 멈추는 것이 아니라 **줄지어 솟아
           나가는 것**이고, 가까운 적은 그중 가까운 가시에 맞을 뿐이다. */
        len: (LURKER_SPINE_TRAVEL_PX / 32) * tPx9,
        ph: spikePh9,
      });
    } else if (shotU !== null) {
      /* ★ 미사일은 **두 발이 나란히** 나간다(지적: "미사일 2발씩 수평으로 나가고")
         — 원작의 발키리·터렛·골리앗·레이스는 발사관이 좌우 한 쌍이고, 한 박자에
         두 줄기가 함께 뻗는다. 한 줄기로 그리면 기관포와 구분이 안 된다.
         자리는 총구에서 **진행 방향에 수직으로** 반 몸통씩 벌린다(단위벡터
         (cos, sin)이 (−sin, cos)의 수직이다) — 요잉을 따라 함께 도므로 어느
         각도에서도 '나란히'가 유지된다. */
      /* ★ 벌리는 폭의 자는 **보이는 몸**이다(지적: "두 미사일 사이 간격이 유닛폭
         보다 훨씬 넓어 두개 전체의 폭을 유닛 폭 안으로 제한해야해") ────────────
         앞판은 fxPx의 0.3배씩 벌렸는데, fxPx는 화면에 보이는 몸이 아니라 **모델
         상자**다: 모델은 그 상자를 잉크 몫(MODEL_INK/16 ≈ 0.325)만큼만 채우므로
         (위 sizePx 주석의 그 환산), 0.6 × 상자 = 1.85 × 몸이었다 — 곧 발사관이
         몸 바깥 양옆에 떠 있었다.
         이제 **두 발 전체가 몸 폭 하나**다: 바깥 가장자리끼리의 거리(간격 + 잔상
         굵기 한 발)가 잉크 폭과 같게 잡는다. 몸이 잔상보다 가는 유닛(멀리서 본
         작은 몸)은 0으로 죄어 한 줄로 겹친다 — 그 배율에서는 두 발이 어차피 한
         획으로 읽힌다. */
      /* ★ 빼는 값은 **실제로 그려지는 굵기(px)**여야 한다 — 여기 있던
         `FX_BEAM.missile.w`는 갈래표의 **상대** 굵기(0.5)라, 픽셀인 inkPx9에서
         그대로 빼면 단위가 섞인다. 그리는 쪽은 그 값에 zoom과 배수를 곱해 쓰므로
         (몸통 획이 w × zoom × 3.4) 실제 굵기는 배율마다 다르다. 같은 식을 여기서도
         써야 '두 발 전체가 몸 폭 하나'라는 약속이 배율과 무관하게 지켜진다. */
      const inkPx9 = fxPx * (modelInkOf(kindMain) / 16);
      const missW9 = Math.max(1.4, (FX_BEAM.missile?.w ?? 0.5) * zoom * 3.4);
      const half9 = Math.max(0, (inkPx9 - missW9) / 2);
      const twin9 = fxName9 === "missile" || fxName9 === "missileG";
      const perp9: [number, number] = twin9
        ? [Math.cos(rad9) * half9, Math.sin(rad9) * half9] : [0, 0];
      /* ★ 발사 순간의 겨눈 각을 **한 발 동안** 잠근다(요청: 유도탄은 쏜 뒤 표적이
         움직이면 따라가되, 가만히 있으면 처음부터 곧게) — lockAim은 위상이 한 바퀴
         돌 때(다음 발)만 새로 잰다. 끝점은 늘 지금 표적이고, 이 각은 **출발 방향**만
         정한다. 둘이 같으면 직선, 다르면 그 차이만큼 굽는다. */
      const launchDeg9 = lockAim(`m${holdKey}`, firePhase(`u${holdKey}`, fxCdRaw), beamDeg, beamLen).deg;
      const lanes9: number[] = twin9 ? [-1, 1] : [0];
      for (const s9 of lanes9) {
        fxOps.push({
          kind: "shot", style: fxName9, fx: fxfx9, fy: fxfy9, lift: liftPx9,
          mx: mzx9 + perp9[0] * s9, my: mzy9 + perp9[1] * s9,
          deg: beamDeg, len: beamLen, u: shotU, d0: launchDeg9,
        });
      }
    } else if (PROJECTILE_FX.has(fxName9)) {
      /* ★ 탄이 안 날고 있으면 **아무것도 안 그린다**(같은 지적) — 여태 여기서
         총구 번쩍(beam)으로 물러났다. 그 번쩍은 '길이 없는 무기'(레이저·번개)의
         그림인데, 탄을 쏘는 무기에 붙이면 쿨다운의 대부분 동안 총구 앞에 짧은
         막대가 서 있게 된다 — 그것이 "자기 앞에만 나오네"의 정체다. 탄은 날고
         있을 때만 보이는 것이 옳다. */
      return null;
    } else {
      /* 제자리 번쩍 — 주기는 그 무기의 쿨다운(35%, 0.08~0.32초로 죔), 위상은
         개체마다 어긋난다(ei) — 부대 전체가 한 박자로 쏘지 않게. */
      const delay9 = ((ei * 7) % 5) / 10;
      const ph9 = (((t - delay9) % fxCd) + fxCd) % fxCd / fxCd;
      /* ★ 선은 **제 사거리를 안 넘는다**(지적: "원래 이렇게 사거리가 길어?") ──────
         표적은 참값이 말해 주는 것이 아니라 '가장 가까운 적'이라는 어림이다(위
         fighting 주석: 참값에는 누구를 쏘는지가 없다). 잘못 고르면 그 거리가
         그대로 긴 선이 되는데, 토막이던 시절에는 그 어림이 안 드러나다가 표적까지
         잇고 나서 눈에 띈 것이다.
         그릴 길이를 **무기가 닿는 데까지**로 죈다 — 어느 표적을 골랐든 그 유닛이
         실제로 닿는 거리까지만 뻗으므로, 어림이 틀려도 사거리는 거짓말을 안 한다.
         (몸 반지름이 든 자 reachTiles를 쓴다 — 선이 표적 몸에 닿아야 하니까.) */
      /* ★ 시작점은 **핵이 아니라 표면**이다(지시) — 몸 한가운데에서 나오면 아콘
         반지름만큼이 눈에 보이는 길이에 통째로 더해져 사거리가 길어 보인다.
         표적 쪽 표면으로 밀면 그 몫이 빠지고, 번개가 구에서 뻗어 나오는 그림이 된다.
         자는 **그려진 잉크의 반지름**이다(상자가 아니라) — 종류마다 상자를 채우는
         몫이 달라, 상자로 재면 그림 밖에서 나오거나 안에 파묻힌다. */
      const surf9 = (fxPx * modelInkOf(fxKind)) / 16 / 2;
      const mzsx9 = mzx9 - Math.sin(rad9) * surf9;
      const mzsy9 = mzy9 + Math.cos(rad9) * surf9;
      fxOps.push({
        kind: "beam", style: fxName9, fx: fxfx9, fy: fxfy9, lift: liftPx9,
        /* len은 '표적까지'다 — 그리는 쪽이 번쩍임 길이를 이 값으로 죈다
           (지적: "피격대상을 지나서까지 그려지는데"). 붙어 싸울수록 짧아진다. */
        mx: st9Span(fxName9) ? mzsx9 : mzx9,
        my: st9Span(fxName9) ? mzsy9 : mzy9,
        deg: beamDeg,
        /* ★ 끝이 **스플래시 경계에 맞닿는다**(지시) — 두 몫을 뺀다:
             · 표면에서 나가므로 시작이 그만큼 앞이다(surf9).
             · 표적 쪽 끝은 그림의 **가장자리**에서 멈춰야 한다 — 안 빼면 줄기가
               그림 한복판을 뚫고 지나가 둘이 겹쳐 보인다(impR9).
           impR9는 그리는 쪽의 셈을 그대로 옮긴 것이다: 반지름은 상자 절반 ×
           HIT_FX_K × 갈래 배수이고, 자라는 몫(0.7~1.2)의 한복판을 쓴다. */
        len: st9Span(fxName9)
          ? Math.max(0, beamLen - surf9
            - (fxPx / 2) * HIT_FX_K * (FX_IMPACT[fxName9]?.r ?? 0.5) * 0.95)
          : beamLen,
        ph: ph9,
      });
      /* ★ 치료는 **낫는 쪽에도** 보인다(지적: "메딕이 힐 동작을 해도 타겟 피가
         안 차고") ─────────────────────────────────────────────────────────
         여태 이 갈래는 메딕의 주사기 끝에만 불빛을 냈다. 그러면 화면에 남는 것은
         '메딕이 뭔가 하고 있다'뿐이고 **누가 낫는 중인지**가 없다 — 참값의 체력은
         띄엄띄엄 적히므로 체력바가 눈에 띄게 차오르지도 않아, 결국 아무 일도 안
         일어나는 것처럼 보인다. 같은 불빛을 낫는 몸 위에도 얹어 둘을 한 벌로
         읽히게 한다. 여기까지 온 메딕은 위 healing9가 이미 '정말 고치는 중'으로
         가려 낸 것이라(아니면 fighting이 꺼져 이 자리에 못 온다) 거짓 불빛이 설
         자리가 없다. 자리는 표적의 타일·가슴 높이, 박자는 이 메딕의 위상이다. */
      if (fxName9 === "heal" && Number.isFinite(foe.bd)) {
        const [hlx9, hly9] = posFrac(foe.bx, foe.by);
        fxOps.push({
          kind: "beam", style: "heal", fx: hlx9, fy: hly9, lift: liftPx9,
          mx: 0, my: 0, deg: 0, ph: ph9,
        });
      }
    }
    return null;
  });
      void r9;
    }
    {
    const rW9 = castsNow.map(([sec, x, y, tech, raw], i) => {
    if (!TECH_KO[tech]) return null; // 한글명을 모르는 기술은 안 띄운다(요청).
    /* 핵은 여기서 안 그린다(지적: "핵탄두 건물에 가려짐") — 이 묶음은 렌즈
       안에 사는데, 렌즈는 will-change로 **제 쌓임 맥락**을 만든다. 그 안에서
       z를 30000으로 올려 봐야 렌즈 통째가 유닛 캔버스(z 6000)와 겨루므로,
       캔버스가 그리는 건물이 핵을 덮었다. 핵은 아래 효과 렌즈(.scr-motion-fxlens
       — 같은 좌표계·같은 변환이면서 캔버스 위에 서는 층)로 옮겼다. */
    if (tech === "Nuclear Strike") return null;
    {
      /* 특징 기술 효과(요청) — 이름 배지 대신 실제 영역 크기의 전용 효과.
         [클래스, 지름(타일)] — 영역은 인게임 어림이다. */
      const AREA_FX: Record<string, [string, number]> = {
        Plague: ["plague", 5], Ensnare: ["ensnare", 5], Irradiate: ["irrad", 2.5],
        /* (걷어냄) "Stasis Field"·Lockdown — 시전 자리의 판 하나였다.
           요청: 이 둘은 **걸린 몸마다** 우리를 씌운다(UnitLayer의 cage 갈래).
           판은 '어디에 걸었나'는 말해도 '누가 걸렸나'는 못 말한다. */
        "EMP Shockwave": ["emp", 6],
        Maelstrom: ["mael", 5], Recall: ["recall", 4],
        /* 스캔 지름은 실제 탐지 반경 그대로(요청) — 8타일짜리 장식 고리가 아니라,
           그 안의 은신이 벗겨지는 바로 그 원이다. */
        "Scanner Sweep": ["scan", DETECT_TILES * 2], "Disruption Web": ["dweb", 5.5],
        /* 야마토(정정: 리플레이에 FireYamatoGun 명령이 좌표까지 남는다 — "안
           남는다"던 앞선 말은 틀렸다) — 표적에 청백 에너지 구체가 작렬한다. */
        "Yamato Gun": ["yamato", 2.6],
      };
      const fx = AREA_FX[tech];
      if (fx) {
        if (tech === "EMP Shockwave" && t - sec > 1.6) return null;
        if (tech === "Yamato Gun" && t - sec > 2.2) return null;
        /* 이레디에이트는 자리가 아니라 **몸**에 붙는다(지적: "이레디에이트 표현
           위치가 타겟이랑 멀리 떨어짐") ─────────────────────────────────────
           30초 동안 그 유닛을 따라다니며 둘레를 태우는 기술인데, 여태 다른 지역
           마법과 한 갈래로 묶여 **시전 좌표에 못박혀** 있었다. 걸린 유닛은 곧
           걸어가 버리므로, 몇 초 뒤면 빈 땅이 혼자 빛나고 정작 죽어 가는 몸에는
           아무 표시가 없다.
           걸린 몸을 찾는 자는 상태를 매기는 자와 **같아야 한다**(위 statuses):
           시전 순간 시전 자리에서 r타일 안에 있던, 시전자의 것이 아닌 개체다.
           그중 가장 가까운 하나를 표적으로 보고, 그 몸의 **지금** 자리에 얹는다.
           표적이 죽으면 효과도 끝난다(빈 땅에 남기지 않는다). */
        let afx9 = x;
        let afy9 = y;
        if (tech === "Irradiate") {
          let hit9: { x: number; y: number } | null = null;
          let bd9 = STATUS_CASTS.Irradiate.r;
          let found9 = false;
          for (const q9 of entWalks) {
            if (q9.raw === raw || q9.walk.n === 0) continue;
            const p09 = posAtW(q9.walk, sec);
            if (!p09) continue;
            const d09 = Math.hypot(x - p09.x, y - p09.y);
            if (d09 > bd9) continue;
            bd9 = d09;
            found9 = true;
            hit9 = q9.died !== null && t >= q9.died ? null : posAtW(q9.walk, t);
          }
          if (found9 && !hit9) return null;   // 표적이 죽었다 — 효과도 끝이다.
          if (hit9) { afx9 = hit9.x; afy9 = hit9.y; }
        }
        dom.push({ k: "castfx", key: `c-${i}`, x: afx9, y: afy9, cls: fx[0], wTiles: fx[1], scan: tech === "Scanner Sweep" });
        return null;
      }
    }
    if (tech === "Dark Swarm") {
      /* 다크 스웜(요청) — 갈색 반투명 구름이 우글거린다. 실제 지속(약 60초의
         절반만 표시)과 영역(지름 6타일)에 맞춘다. */
      dom.push({ k: "swarm", key: `c-${i}`, x, y });
      return null;
    }
    if (tech === "Psionic Storm") {
      /* 스톰은 여기(렌즈 안)서 안 그린다 — 렌즈는 유닛 캔버스(z 6000) **아래**
         스태킹 컨텍스트라 z-index를 아무리 줘도 유닛을 못 덮는다. 낙뢰는 모든
         유닛 위에 떨어져야 하므로(지시) 캔버스 뒤의 전용 오버레이
         (.scr-motion-fxlens, 아래 UnitLayer 다음)가 같은 자리에 그린다. */
      return null;
    }
    /* (제거·요청: 배지 더 이상 사용 안 함) — 전용 효과가 없는 기술의 이름 알약
       배지가 서던 자리. 효과 있는 기술(스톰·스웜·핵·역병 등)만 그린다. */
    return null;
  });
      void rW9;
    }
    {
    const gm9 = gasLitRef.current;
    for (const k9 of gasBusy) gm9.set(k9, t);
    if (gm9.size) {
      for (const o9 of unitOps) {
        if (!o9.pickBld || !o9.pickKey) continue;
        /* ★ 저그는 "extract"다(SHAPE_KIND.Extractor) — 여기 적혀 있던 "extractor"는
           어느 건물의 kind와도 안 맞아, 익스트랙터는 불이 켜질 자격조차 없었다. */
        if (o9.kind !== "refinery" && o9.kind !== "assim" && o9.kind !== "extract") continue;
        const at9 = gm9.get(o9.pickKey);
        if (at9 === undefined) continue;
        if (at9 > t) { gm9.delete(o9.pickKey); continue; }
        if (t - at9 <= GAS_LIT_HOLD) o9.lit = true;
      }
    }
    }
    return {
      t, unitOps, fxOps, miniExtra, gasBusy: [...gasBusy], dom,
      explored: exploredAt, visNow, visSrc: visSrcRef.current,
    };
  };
  /** 진단 — 마지막 안개 쌓기 비용(ms)과 누적 횟수. */
  const stats = (): { fogCost: number; fogStamps: number } => ({ fogCost: fogStampRef.current.cost, fogStamps: fogStampN9 });
  return { build, setView, reset, stats, get view() { return view; } };
}

/** 화면(UI)이 읽는 파생 자료 — 워커가 세계를 세운 뒤 한 번 보내 준다(요청: 메인의 중복 파생 자료 제거).
 *  메인은 deriveWorld9를 안 부른다 — 폰 메모리에서 가장 큰 덩어리 하나가 빠진다. */
export type WorldUi9 = Pick<EngineWorld9,
  "buildsSrc" | "castsSrc" | "nukeLase" | "gasBuildings" | "prodDoneAt" | "prodDoneByRaw" | "upsByRaw" | "nukeImpacts">;
/** 걷기(entWalks)는 여기 안 든다 — 가장 큰 덩어리인데 추적(로스터 버튼)을 켤 때만 쓴다. 그때 워커에 따로 청한다(want walks). */
export const pickWorldUi9 = (w: EngineWorld9): WorldUi9 => ({
  buildsSrc: w.buildsSrc, castsSrc: w.castsSrc, nukeLase: w.nukeLase, gasBuildings: w.gasBuildings,
  prodDoneAt: w.prodDoneAt, prodDoneByRaw: w.prodDoneByRaw, upsByRaw: w.upsByRaw, nukeImpacts: w.nukeImpacts,
});
export let emptyWorldUiCache9: WorldUi9 | null = null;
/** 워커의 것이 오기 전의 빈 표 — 한 번만 만들어 같은 참조를 준다(메모 deps가 흔들리지 않게). */
export const emptyWorldUi9 = (): WorldUi9 => {
  if (!emptyWorldUiCache9) {
    emptyWorldUiCache9 = pickWorldUi9(deriveWorld9({
      entData: null, truth: null, grid: { width: 1, height: 1 }, bases: [], teamOf: () => undefined, total: 0,
    }));
  }
  return emptyWorldUiCache9;
};
