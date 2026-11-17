/* ★★ 수송선 드랍 연습실 화면(2026-11-17 · practiceSim9 ★ 머리말의 요청) — 설정 → 모델 굽기 → 놀이.
   조작은 원작 손버릇을 따른다: 왼클릭 고르기 · 끌어 상자 · Shift 더하기 · 오른클릭 알아서(적 → 공격 · 내 수송선 → 타기 · 수송선이 내 유닛 → 태우기 · 땅 → 이동) ·
   Shift + 오른클릭 · Shift + 명령은 예약 · Ctrl + 숫자 부대 지정 · 숫자 부대 부르기(두 번이면 화면 이동) · 화살표 · 화면 가장자리 · 미니맵으로 화면 이동.
   ★ 보이는 화면은 **원작 크기**(2026-11-17, 요청: "원작 정보를 그대로 … 연습실은 보이는 화면의 크기도") — 콘솔 위 게임 화면 640 × 400 게임 px
   (20 × 12.5 타일 · 재생기 ORIG_VIEW9 와 같은 자)를 캔버스에 맞춰 늘이고 남는 곳은 검게 둔다. 휠 확대는 걷었다(원작에 없다).
   명령 키(이동 · 공격 · 정지 · 홀드 · 하차 · 태우기 …)는 설정에서 바꾼다(기기에 기억). 하차(U) 다음 땅을 누르면 그 자리로 가서 다 내리고, 수송선 자기를 누르면 낙하산 —
   가던 길을 멈추지 않고 한 기씩 떨군다(Shift + 오른클릭으로 이어 갈 길을 예약해 두면 내리면서 그대로 간다). 화물 칸을 누르면 그 한 기만 지금 자리에 내린다.
   ★★ 셋째 판(2026-11-17, 요청: "우리 홈피의 드랍연습도 맵하고 똑같이 · 초중반 선택과 종족, 자리 선택등은 처음에 선택하거나 중간에 톱니바퀴 눌러서 · 키 변경도 계속 ·
   유닛이나 셔틀은 직접 뽑게 설정창에서 제거 · 위치도 지도에서 깃발 옮기기로 · 라디오버튼류 제거 · 설정창은 단순하고 꼭 필요한거만 · 시프트 f234랑 컨트롤 숫자 단축키 ·
   지형과 모델 화질 재생기수준으로"):
     · 설정 = 내 종족 · 적 타워(초반/중반) · 내 자리(지도 위 깃발을 끌어 사람 스타팅 여섯 중 하나에) · 명령 키. 처음에 뜨고 놀이 중엔 톱니(⚙)로 연다(그동안 멈춤).
       종족 · 자리를 바꾸면 새 판 · 적 타워만 바꾸면 적만 새로(맵 비컨처럼 내 기지 · 내 유닛은 그대로).
     · 내 기지는 생산 · 테크 건물이 다 지어진 채 — 건물을 고르면 명령 카드에 생산 · 연구(원작 단축키 글자) · 시간 1/24 · 돈 무한.
     · Shift + F2 · F3 · F4 = 지금 화면 기억 · F2 · F3 · F4 = 그 화면으로. Ctrl + 숫자는 브라우저가 탭 바꾸기로 가로채므로 시작하면 전체 화면 + 키보드 잠금
       (navigator.keyboard.lock — 크롬 · 엣지)으로 받는다(못 잠그는 곳은 Alt + 숫자도 같은 지정).
     · 그림 = 재생기와 같은 GL 붓 — 지형은 GL 지형층(glTerrain9 · 벡터 등고선 · 화면 밀도 그대로), 몸은 GL 메시(gl9 GlUnits9 · 명암 · 바닥 그림자 · 번짐)를 그 자리에서
       화면 배율 그대로 그린다(옛: 지형 24px/타일 2D 판을 늘여 붙임 · 몸은 16방 판을 굽고 늘여 찍음 → 흐렸다). 체력 막대 · 총알 · 표식은 위 2D 층. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReplayMapGrid } from "./mapGrid";
import { decodeMapTerrain, terrainFace, type MapTerrain } from "../../utils/mapTerrain";
import { drawMapGrid, terrainFill } from "../../utils/mapTiles";
import { terrainGeom9, type TerrainGeom9 } from "../../utils/terrainGeom";
import { FRAME_SEC, fp } from "../../utils/bwUnits";
import {
  KILL_PTS9, LOST_DIV9, PRAC_DROP_SEC9, PRAC_PREP_FRAMES9, PRAC_PREP_SEC9, PRAC_RACES9, PRAC_SPOTS9, PRAC_TICK_MS9, PRAC_TURN_FRAMES9, PROD9, PracticeSim9, UNIT_DEFS9, pracLoadout9,
  type Ent9, type PracRace9, type PracSetup9, type PracStage9, type ProdItem9,
} from "./practiceSim9";
import { PRAC_MAP9 } from "./practiceMap9.gen";
import { PRAC_COLORS9, pracWorldPx9 } from "./practiceSpr9";
import { CAM_TOP9, GL_GLOW_KINDS9, GlUnits9, SHADOW_ALPHA9, glIconRequest9 } from "./gl9";
import { glTerrCanvas9 } from "./glTerrain9";
import { BLD_DRAW_TUNE, BUILDING_BASE_YAW, POSE_KINDS, SHAPE_KIND, UNIT_3D, bldNormOf, walkCutOf9, type UnitDrawOp } from "./engine9";
import { DIM as FOG_DIM9 } from "./ReplayFogLayer";
import type { GlFog9 } from "./glTerrain9";
import { STORM_STAGES } from "./bake9";

export interface PracticeRoomProps {
  /** 빨무 지도(앱이 받아 준다 · 지형 terrain 이 있어야 걷는 칸을 안다). */
  map: ReplayMapGrid | null;
  className?: string;
  /** 개인별 명령 키(앱이 계정에 기억한 것 · 2026-11-17 요청 "개인별 단축키 설정 기억하기") — 오면 그걸 쓴다(없으면 이 기기의 기억). */
  keys?: Record<string, string> | null;
  /** 명령 키를 바꿨다 — 앱이 계정에 적는다. */
  onKeys?: (keys: Record<string, string>) => void;
  /** 한 턴이 끝났다 — 앱이 기록을 적고 답(내 최고 · 전체 최고 · 갱신)을 돌려준다. */
  onResult?: (r: PracResult9) => Promise<PracRecordReply9 | null> | void;
}
/** 한 턴의 결과 — 모드(초반/중반)별로 기록한다. */
export interface PracResult9 { mode: PracStage9; race: PracRace9; spot: string; score: number; kills: number; lostPts: number; lostN: number }
/** 기록 답 — 이 판 전의 내 최고 · 전체 최고와 이번 판이 갱신했나. */
export interface PracRecordReply9 { myBest: number | null; top: number | null; topName?: string | null; newMyBest: boolean; newTop: boolean }

type Act9 = "move" | "attack" | "stop" | "hold" | "unload" | "load" | "burrow" | "siege" | "storm" | "web" | "irradiate";
const ACTS9: { key: Act9; label: string; def: string; hint: string }[] = [
  { key: "move", label: "이동", def: "M", hint: "다음 클릭 자리로 이동(적을 무시)" },
  { key: "attack", label: "공격", def: "A", hint: "다음 클릭 — 적이면 그 적 · 땅이면 가며 싸우기" },
  { key: "stop", label: "정지", def: "S", hint: "하던 일과 예약을 모두 멈춘다" },
  { key: "hold", label: "홀드", def: "H", hint: "그 자리에서 사거리 안만 쏜다" },
  /* ★ 낙하산은 따로 키가 없다(2026-11-17, 지적: "낙하산은 따로 키가 있는게 아니라 자기 수송선에 내리기를 찍는걸 말하는거야") — 하차 키 뒤 **자기 수송선을 찍으면** 낙하산. */
  { key: "unload", label: "하차", def: "U", hint: "다음 클릭 자리로 가서 다 내린다 · 자기 수송선을 찍으면 낙하산(멈추지 않고 가던 길에 한 기씩 · Shift 예약 길 그대로)" },
  { key: "load", label: "태우기", def: "L", hint: "다음 클릭한 수송선에 탄다(수송선은 클릭한 유닛을 태운다)" },
  /* 버로우 — 원작 럴커는 땅속에서만 쏜다. 원작 키는 버로우 B · 해제 U 인데 U 가 하차와 겹쳐 한 키로 오간다. */
  { key: "burrow", label: "버로우", def: "B", hint: "럴커 — 땅속으로(땅속에서만 쏜다) · 다시 누르면 나온다" },
  { key: "siege", label: "시즈", def: "O", hint: "시즈 탱크 — 시즈 모드(머신 샵 연구) · 다시 누르면 탱크 모드" },
  { key: "storm", label: "스톰", def: "T", hint: "하이 템플러 — 다음 클릭 자리에 사이오닉 스톰(템플러 아카이브 연구 · 에너지 75)" },
  /* 넷째 판 — 중반 준비 유닛의 기술(원작 키: 디스럽션 웹 D · 디펜시브 매트릭스 D · 이레디에이트 I). 옛 변태 · 합체(R)는 생산을 막으며 걷었다. */
  { key: "web", label: "웹·매트릭스", def: "D", hint: "커세어 — 다음 클릭 자리에 디스럽션 웹(그 아래 지상 몸 · 건물은 못 쏜다) · 사이언스 베슬 — 다음 클릭한 몸에 디펜시브 매트릭스(250 막이)" },
  { key: "irradiate", label: "이레디", def: "I", hint: "사이언스 베슬 — 다음 클릭한 몸에 이레디에이트(둘레 생체 지상 몸에 250 · SCV · 드론이 녹는다)" },
];
/** 누르면 곧바로 되는 명령(자리를 안 기다림). */
const INSTANT9 = new Set<Act9>(["stop", "hold", "burrow", "siege"]);
/** 원작 보이는 화면(게임 px) — 콘솔 위 640 × 400(재생기 ORIG_VIEW9 = 20 × 12.5 타일). */
const VIEW_W9 = 640; const VIEW_H9 = 400;
/* ★ 화면 스크롤 원작 그대로(2026-11-17, 지적: "엣지 투 스크롤이 잘 안됨(원작수준으로 재현 필요)") — KopruluSector(kp_ui_scroll.c)의 UpdateMapScroll 0x49bf10 ·
   GetEdgeScrollCursorId 0x43e7b0 · 속도표 0x509390: 가장자리 = 커서가 화면 끝 2px 안 · 한 걸음마다 가속 단계 0 → 6 · 그 단계의 픽셀만큼(속도 3) · 화면 자리는 8px 칸 ·
   키(화살표)가 먼저 · 상자 끌기 중엔 안 민다 · 걸음은 15.625ms 마다(윈도 틱). 커서는 게임 화면을 누르면 갇힌다(Pointer Lock · Esc 로 푼다). */
const SCROLL_SPEEDS9 = [
  [0, 0, 8, 8, 16, 16, 16], [0, 0, 8, 8, 16, 16, 24], [0, 8, 8, 16, 16, 24, 24], [0, 8, 8, 16, 24, 24, 32],
  [0, 8, 16, 16, 24, 32, 40], [0, 8, 16, 24, 32, 40, 48], [0, 8, 24, 32, 40, 56, 64],
];
const SCROLL_SPEED9 = 3; const SCROLL_MS9 = 15.625; const EDGE_GAME_PX9 = 2;
/** 우클릭 대상 고리 깜빡임(원작 selectionTimer = 31 · 남은 값의 8 비트가 켜졌을 때만 고리 — 두 번 깜빡). */
const FLASH_FRAMES9 = 31;
/* ★ 좌 · 우클릭 원작 그대로(2026-11-17 · KopruluSector kp_ui_input.c ClickSelectAtPoint · BoxSelectUnits · FilterSelectableUnits · RightClickInGame · TargetingLeftClick):
   우클릭 · 겨눈 좌클릭은 유닛이면 깜빡임 · 땅이면 이동 표식 · 미니맵 우클릭은 늘 땅 · 좌클릭 빈 땅은 그대로 · Shift 넣고 빼기 · Ctrl/더블클릭 화면 안 같은 종류 ·
   상자는 내 유닛(건물 빼고) 12 까지(없으면 하나). 셋째 판: 내 생산 건물을 고른 채 우클릭은 **모이는 자리**. */
const SEL_MAX9 = 12;
const MARK_FRAMES9 = 12;
const KEYS_LS9 = "scr.prac.keys";
const SETUP_LS9 = "scr.prac.setup3";   // 3 — 셋째 판(종족 · 자리 · 적 타워만)으로 옛 기억(setup2 · 수송선 수 · 태울 유닛 · 적 종족 …)은 버린다
const loadJson9 = <T,>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? { ...fb, ...JSON.parse(v) } : fb; } catch { return fb; } };
const saveJson9 = (k: string, v: unknown): void => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 사생활 모드 */ } };
const DEF_KEYS9 = Object.fromEntries(ACTS9.map((a) => [a.key, a.def])) as Record<Act9, string>;
const DEF_SETUP9: PracSetup9 = { myRace: "T", mySpot: "BL", stage: "early" };
/** 설정 기억을 다듬는다(옛 값 · 사람 자리가 아닌 자리). */
const cleanSetup9 = (s: PracSetup9): PracSetup9 => ({
  myRace: PRAC_RACES9.some((r) => r.key === s.myRace) ? s.myRace : "T",
  mySpot: PRAC_SPOTS9.some((p) => p.key === s.mySpot) ? s.mySpot : "BL",
  stage: s.stage === "mid" ? "mid" : "early",
});
/** 물리 키 → 글자(KeyU → U · Digit1 → 1) — e.key 는 한글 입력 상태에서 'ㅕ' 같은 낱자로 와서 키 지정 · 단축키가 안 먹었다(2026-11-17, 지적: "연습실 키설정이 안됨"). */
const keyOf9 = (e: KeyboardEvent): string | null => {
  const m = /^(?:Key([A-Z])|Digit([0-9])|Numpad([0-9]))$/.exec(e.code);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
};
/** 전체 화면에서 잠가 받는 키 — Ctrl + 숫자(탭 바꾸기) · F2 ~ F4(F3 찾기). Esc 는 안 잠근다(전체 화면 · 커서 가둠 풀기). */
const LOCK_KEYS9 = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "F2", "F3", "F4"];
type KbLock9 = { keyboard?: { lock?: (codes?: string[]) => Promise<void>; unlock?: () => void } };
/** 전체 화면 + 키보드 잠금 — 사용자 손짓 안에서만 걸린다. 못 하는 곳은 조용히 그대로. */
const enterFull9 = (el: HTMLElement | null): void => {
  if (!el) return;
  const kb = (navigator as unknown as KbLock9).keyboard;
  const lock = (): void => { try { void kb?.lock?.(LOCK_KEYS9)?.catch(() => undefined); } catch { /* 못 잠금 */ } };
  if (document.fullscreenElement) { lock(); return; }
  try { const r = el.requestFullscreen?.(); if (r) r.then(lock).catch(() => undefined); } catch { /* 막힌 곳 */ }
};

const RACE_KO9: Record<PracRace9, string> = { T: "테란", P: "프로토스", Z: "저그" };
const RES_KO9: Record<string, string> = {
  "Gravitic Drive": "셔틀 속업", "Psionic Storm": "스톰", "Khaydarin Amulet": "하템 에너지", "Leg Enhancements": "발업", "Reaver Capacity": "스캐럽 10",
  "Scarab Damage": "스캐럽 공업", "Tank Siege Mode": "시즈 모드", "Pneumatized Carapace": "오버로드 속업", "Ventral Sacs": "오버로드 수송", "Lurker Aspect": "럴커",
  "Disruption Web": "디스럽션 웹", "Argus Jewel": "커세어 에너지", Irradiate: "이레디에이트", "Titan Reactor": "베슬 에너지", Antennae: "오버로드 시야",
};
/** 준비된 판 한 줄 — "셔틀 2 · 하템 4 … · 스톰 · 발업 … · 공방실드 2". */
const pracLoadoutText9 = (stage: PracStage9, race: PracRace9): string => {
  const lo = pracLoadout9(stage, race);
  const us = lo.units.map(([n, k]) => `${UNIT_DEFS9[n]?.ko ?? n} ${race === "Z" && n === "Overlord" ? `+${k}` : k}`);
  const rs = lo.res.map((r) => RES_KO9[r] ?? r);
  return [...us, ...rs, ...(lo.lv ? [`공방${race === "P" ? "실드" : ""} ${lo.lv}단`] : ["공방업 없음"])].join(" · ");
};

export default function PracticeRoom({ map, className, keys: keysProp, onKeys, onResult }: PracticeRoomProps) {
  const [phase, setPhase] = useState<"setup" | "loading" | "play">("setup");
  const [setup, setSetup] = useState<PracSetup9>(() => cleanSetup9(loadJson9(SETUP_LS9, DEF_SETUP9)));
  const [keys, setKeysState] = useState<Record<Act9, string>>(() => loadJson9(KEYS_LS9, DEF_KEYS9));
  /* 계정에 기억된 키가 오면 그것으로(늦게 와도) — 앱에서 온 값은 앱에 되돌려 적지 않는다. */
  useEffect(() => {
    if (!keysProp) return;
    const next = { ...DEF_KEYS9 } as Record<Act9, string>;
    for (const a of ACTS9) { const v = keysProp[a.key]; if (typeof v === "string" && /^[A-Z0-9]$/.test(v)) next[a.key] = v; }
    setKeysState(next);
  }, [keysProp]);
  const onKeysRef = useRef(onKeys); onKeysRef.current = onKeys;
  const setKeys = useCallback((f: (k: Record<Act9, string>) => Record<Act9, string>): void => {
    setKeysState((k) => { const n = f(k); if (n !== k) queueMicrotask(() => onKeysRef.current?.(n)); return n; });
  }, []);
  const [terrain, setTerrain] = useState<MapTerrain | null | undefined>(undefined);
  const [gear, setGear] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { saveJson9(SETUP_LS9, setup); }, [setup]);
  useEffect(() => { saveJson9(KEYS_LS9, keys); }, [keys]);
  useEffect(() => {
    let live = true;
    setTerrain(undefined);
    if (!map) return undefined;
    decodeMapTerrain(map.terrain).then((t) => { if (live) setTerrain(t); }).catch(() => { if (live) setTerrain(null); });
    return () => { live = false; };
  }, [map]);
  /** 판 번호 — 종족 · 자리가 바뀌거나 '다시'면 새 판. 판이 쥔 설정(종족 · 자리)은 판을 열 때의 것. */
  const [run, setRun] = useState(0);
  const [runSetup, setRunSetup] = useState<PracSetup9>(setup);
  const sizeOk = !!terrain && terrain.w === PRAC_MAP9.w && terrain.h === PRAC_MAP9.h;
  const start = (s: PracSetup9): void => {
    setSetup(s); setRunSetup(s); setGear(false);
    setPhase("loading"); setRun((r) => r + 1);
    enterFull9(rootRef.current);
  };
  /** 톱니에서 적용 — 무엇이든 바뀌었으면 새 턴(턴제 · 2026-11-17) · 키만이면 그 판 그대로. */
  const apply = (s: PracSetup9): void => {
    if (s.myRace !== runSetup.myRace || s.mySpot !== runSetup.mySpot || s.stage !== runSetup.stage) { start(s); return; }
    setGear(false);
  };
  return (
    <div ref={rootRef} className={`scr-prac${className ? ` ${className}` : ""}`}>
      {phase === "setup" && (
        <PracSetupPanel setup={setup} keys={keys} setKeys={setKeys} map={map} terrain={terrain} inGame={false}
          ready={sizeOk} onApply={start} />
      )}
      {phase !== "setup" && map && terrain && (
        <PracGame key={run} map={map} terrain={terrain} setup={runSetup} keys={keys} paused={gear}
          onReady={() => setPhase("play")} onGear={() => setGear(true)} onRestart={() => start(setup)}
          onFull={() => enterFull9(rootRef.current)} loading={phase === "loading"} onResult={onResult} />
      )}
      {phase !== "setup" && gear && (
        <div className="scr-prac-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) setGear(false); }}>
          <PracSetupPanel setup={setup} keys={keys} setKeys={setKeys} map={map} terrain={terrain} inGame ready={sizeOk}
            onApply={apply} onClose={() => setGear(false)} />
        </div>
      )}
    </div>
  );
}

/* ── 설정(처음 · 톱니) ─────────────────────────────────────────────────────── */
function PracSetupPanel({ setup, keys, setKeys, map, terrain, inGame, ready, onApply, onClose }: {
  setup: PracSetup9;
  keys: Record<Act9, string>; setKeys: (f: (k: Record<Act9, string>) => Record<Act9, string>) => void;
  map: ReplayMapGrid | null; terrain: MapTerrain | null | undefined; inGame: boolean; ready: boolean;
  onApply: (s: PracSetup9) => void; onClose?: () => void;
}) {
  const [draft, setDraft] = useState<PracSetup9>(setup);
  const [listen, setListen] = useState<Act9 | null>(null);
  useEffect(() => {
    if (!listen) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") { setListen(null); return; }
      const k = keyOf9(e);
      if (!k) return;
      setKeys((m) => {
        const out = { ...m };
        for (const a of ACTS9) if (out[a.key] === k) out[a.key] = m[listen];   // 겹치면 맞바꾼다
        out[listen] = k; return out;
      });
      setListen(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listen, setKeys]);
  /* Esc — 톱니 창이면 닫는다(키 듣는 중이 아니면). */
  useEffect(() => {
    if (!inGame || !onClose) return undefined;
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape" && !listen) { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inGame, onClose, listen]);
  /* 지도 — 깃발을 끌어(또는 누른 자리에서) 가장 가까운 사람 스타팅으로. 나머지 스타팅은 적 기지(맵이 정한 종족). */
  const mini = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  useEffect(() => {
    const c = mini.current; if (!c || !map) return;
    const g = c.getContext("2d"); if (!g) return;
    c.width = map.width * 3; c.height = map.height * 3;
    drawMapGrid(g, map, terrain ? terrainFace(terrain) : null, 3, false);
  }, [map, terrain]);
  const W = PRAC_MAP9.w * 32; const H = PRAC_MAP9.h * 32;
  const fracOf = (e: { clientX: number; clientY: number }): [number, number] | null => {
    const b = box.current?.getBoundingClientRect(); if (!b) return null;
    return [Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), Math.max(0, Math.min(1, (e.clientY - b.top) / b.height))];
  };
  const snap = (f: [number, number]): string => {
    let best = PRAC_SPOTS9[0].key; let bd = Infinity;
    for (const p of PRAC_SPOTS9) { const d = (p.x / W - f[0]) ** 2 + (p.y / H - f[1]) ** 2; if (d < bd) { bd = d; best = p.key; } }
    return best;
  };
  const onDown = (e: React.PointerEvent): void => {
    const f = fracOf(e); if (!f) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag(f);
  };
  const onMove = (e: React.PointerEvent): void => { if (!drag) return; const f = fracOf(e); if (f) setDrag(f); };
  const onUp = (e: React.PointerEvent): void => {
    if (!drag) return;
    const f = fracOf(e) ?? drag; setDrag(null);
    const k = snap(f); setDraft((d) => ({ ...d, mySpot: k }));
  };
  const me = PRAC_SPOTS9.find((p) => p.key === draft.mySpot) ?? PRAC_SPOTS9[0];
  const flagAt: [number, number] = drag ?? [me.x / W, me.y / H];
  const hover = drag ? snap(drag) : null;
  return (
    <div className={`scr-prac-setup${inGame ? " is-modal" : ""}`}>
      <div className="scr-prac-hrow">
        <h2 className="scr-prac-h">빨무 드랍 연습</h2>
        {inGame && onClose && <button type="button" className="scr-prac-x" onClick={onClose} aria-label="닫기">×</button>}
      </div>
      <div className="scr-prac-row">
        <span className="scr-prac-lab">내 종족</span>
        {PRAC_RACES9.map((r) => (
          <button key={r.key} type="button" className={`scr-prac-pill${draft.myRace === r.key ? " is-on" : ""}`} onClick={() => setDraft((d) => ({ ...d, myRace: r.key }))}>{r.label}</button>
        ))}
      </div>
      <div className="scr-prac-row">
        <span className="scr-prac-lab">적 타워</span>
        {([["early", "초반"], ["mid", "중반"]] as [PracStage9, string][]).map(([k, l]) => (
          <button key={k} type="button" className={`scr-prac-pill${draft.stage === k ? " is-on" : ""}`} onClick={() => setDraft((d) => ({ ...d, stage: k }))}>{l}</button>
        ))}
        <span className="scr-prac-dim">{draft.stage === "mid" ? "가장자리까지 도배" : "본진 둘레"}</span>
      </div>
      <div className="scr-prac-row is-top">
        <span className="scr-prac-lab">내 자리</span>
        <div className="scr-prac-spotmap" ref={box} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
          <canvas ref={mini} />
          {PRAC_MAP9.starts.map((st) => {
            if (st.key === draft.mySpot && !drag) return null;
            const near = hover === st.key;
            return (
              <span key={st.key} className={`scr-prac-base is-${st.race.toLowerCase()}${near ? " is-near" : ""}`}
                style={{ left: `${(st.hall[0] / W) * 100}%`, top: `${(st.hall[1] / H) * 100}%` }} title={`${st.name} · 적 ${RACE_KO9[st.race]}`}>
                {st.race}
              </span>
            );
          })}
          <span className={`scr-prac-flag${drag ? " is-drag" : ""}`} style={{ left: `${flagAt[0] * 100}%`, top: `${flagAt[1] * 100}%` }} aria-label="내 자리">
            <svg width="26" height="30" viewBox="0 0 26 30"><path d="M4 29 V2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /><path d="M5 3 L23 8 L5 14 Z" fill="#3a7bff" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </div>
      <div className="scr-prac-row is-top">
        <span className="scr-prac-lab">명령 키</span>
        <div className="scr-prac-keys">
          {ACTS9.map((a) => (
            <div key={a.key} className="scr-prac-keyrow" title={a.hint}>
              <span>{a.label}</span>
              <button type="button" className={`scr-prac-key${listen === a.key ? " is-listen" : ""}`} onClick={() => setListen(a.key)}>{listen === a.key ? "키를 누르세요" : keys[a.key]}</button>
            </div>
          ))}
          <button type="button" className="scr-prac-pill is-sm" onClick={() => setKeys(() => ({ ...DEF_KEYS9 }))}>기본값</button>
        </div>
      </div>
      <div className="scr-prac-row">
        <button type="button" className="scr-prac-start" onClick={() => onApply(draft)} disabled={!ready && !inGame}>
          {inGame ? (draft.myRace !== setup.myRace || draft.mySpot !== setup.mySpot || draft.stage !== setup.stage ? "새 턴 시작" : "닫기") : !map ? "지도를 기다리는 중…" : terrain === undefined ? "지형 푸는 중…" : !ready ? "이 지도는 빨무 지형이 아니에요" : "시작"}
        </button>
      </div>
      <p className="scr-prac-rules">준비된 것({draft.stage === "mid" ? "중반" : "초반"} · {RACE_KO9[draft.myRace]}) — {pracLoadoutText9(draft.stage, draft.myRace)}<br />
        한 턴 = <b>준비 {PRAC_PREP_SEC9}초</b>(태우기 · 날아가기 — 이때 한 드랍은 점수 없음) → <b>드랍 {PRAC_DROP_SEC9}초</b>(한 번 · 내린 뒤엔 다시 못 태움) ·
        점수 = 잡은 일꾼 × {KILL_PTS9} − 잃은 내 유닛 값(광물 + 가스 ÷ {LOST_DIV9} · 수송선이 터지면 화물도) · 일꾼은 수송선을 보면 12기씩 다른 기지로 도망 · 생산 · 연구는 없음</p>
      <p className="scr-prac-dim">Shift+F2~F4 화면 기억 · F2~F4 불러오기 · Ctrl+숫자 부대(전체 화면) · 톱니(⚙)로 이 창</p>
    </div>
  );
}

/* ── 그리는 종류 ───────────────────────────────────────────────────────────── */
/** 건물 모델 종류(맵 꾸밈 포함). */
const bldKind9 = (name: string): string => (name === "Mineral Field" ? "mineral" : name === "Vespene Geyser" ? "geyser" : SHAPE_KIND[name] ?? "tomb");
/** 유닛 모델 종류(땅속 럴커는 그 별본). */
const unitKind9 = (e: Ent9): string => (e.def.name === "Lurker" && (e.burrowed || e.burrowT > 0) ? "lurkerburrow" : UNIT_3D[e.def.name] ?? "gunner");

/* ── 놀이 ──────────────────────────────────────────────────────────────────── */
function PracGame({ map, terrain, setup, keys, paused: gearPaused, onReady, onGear, onRestart, onFull, loading, onResult }: {
  map: ReplayMapGrid; terrain: MapTerrain; setup: PracSetup9; keys: Record<Act9, string>; paused: boolean;
  onReady: () => void; onGear: () => void; onRestart: () => void; onFull: () => void; loading: boolean;
  onResult?: (r: PracResult9) => Promise<PracRecordReply9 | null> | void;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sim = useMemo(() => new PracticeSim9(terrain, setup), [terrain]);
  /* 턴 — 준비 화면(시작 단추) → 돌림(준비 30초 · 드랍 30초 · 셈이 단계를 넘긴다) → 결과. */
  const [turn, setTurn] = useState<"ready" | "run" | "over">("ready");
  const turnRef = useRef(turn); turnRef.current = turn;
  const [reply, setReply] = useState<PracRecordReply9 | null | "wait">(null);
  const onResultRef = useRef(onResult); onResultRef.current = onResult;
  const endTurn = (): void => {
    if (turnRef.current === "over") return;
    turnRef.current = "over"; setTurn("over");
    if (document.pointerLockElement) document.exitPointerLock();
    const sc = sim.score;
    const r: PracResult9 = { mode: sim.setup.stage, race: sim.setup.myRace, spot: sim.setup.mySpot, score: sc.score, kills: sc.kills, lostPts: sc.lostPts, lostN: sc.lostN };
    const p = onResultRef.current?.(r);
    if (p && typeof (p as Promise<unknown>).then === "function") { setReply("wait"); (p as Promise<PracRecordReply9 | null>).then((x) => setReply(x ?? null)).catch(() => setReply(null)); }
  };
  /* 검진 손잡이 — 시험 판(perf · 하네스)이 window.__pracDebug 를 켜 두면 셈 몸을 내준다. */
  const camDbg = useRef({ x: 0, y: 0, z: 1 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const glCvRef = useRef<HTMLCanvasElement>(null);
  const terrCvRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const miniImg = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<GlUnits9 | null>(null);
  const terrGeom = useRef<TerrainGeom9 | null>(null);
  /* 안개 — 재생기 GL 안개(판 17 칸 안개 · GlFog9.tile)에 셈의 타일 보임(앞 · 지금) · 밝힘을 실어 지형층이 그린다 · 미니맵은 작은 판을 덮는다. */
  const fogRef = useRef<{ ver: number; fog: GlFog9 | null; mini: HTMLCanvasElement | null }>({ ver: -1, fog: null, mini: null });
  const fogOf = (): GlFog9 => {
    const f = fogRef.current;
    if (f.ver !== sim.fogVer || !f.fog) {
      const n = sim.tw * sim.th; const data = f.fog?.tile?.data.length === n * 4 ? f.fog.tile.data : new Uint8Array(n * 4);
      for (let i = 0; i < n; i += 1) { data[i * 4] = sim.fogPrev[i] * 255; data[i * 4 + 1] = sim.fogVis[i] * 255; data[i * 4 + 2] = sim.fogExp[i] * 255; data[i * 4 + 3] = 255; }
      f.fog = { loops: [], key: 0, eyes: null, rgb: [5, 8, 14], dim: FOG_DIM9, tile: { w: sim.tw, h: sim.th, data, ver: sim.fogVer, f: 0 } };
      /* 미니맵 덮개 — 안 가 본 곳 짙게 · 가 본 곳 옅게. */
      const mc = f.mini ?? document.createElement("canvas"); f.mini = mc; mc.width = sim.tw; mc.height = sim.th;
      const mg = mc.getContext("2d");
      if (mg) {
        const im = mg.createImageData(sim.tw, sim.th);
        for (let i = 0; i < n; i += 1) { im.data[i * 4 + 3] = sim.fogVis[i] ? 0 : sim.fogExp[i] ? 110 : 225; }
        mg.putImageData(im, 0, 0);
      }
      f.ver = sim.fogVer;
    }
    f.fog!.tile!.f = Math.max(0, Math.min(1, (sim.stats.tick - sim.fogAt) / 6));
    return f.fog!;
  };
  /** 내 편 눈에 지금 그릴 몸인가 — 적 유닛은 보이는 타일만 · 적 건물 · 자원은 한 번 봤으면(안개 속은 옅게). */
  const shown = (u: Ent9): boolean => u.owner === 0 || sim.sees(u.x, u.y) || ((u.def.bld || !!u.def.res) && u.seen);
  const [warm, setWarm] = useState({ done: 0, all: 1 });
  const [sel, setSel] = useState<number[]>([]);
  const selRef = useRef<number[]>([]); selRef.current = sel;
  const [mode, setModeState] = useState<Act9 | null>(null);
  /* 고르기 판(키를 누른 뒤 자리를 기다림) — 뜻은 ref 가 곧바로 쥔다(같은 손짓 안의 다음 클릭이 옛 값을 읽지 않게). */
  const modeRef = useRef<Act9 | null>(null);
  const setMode = (v: Act9 | null): void => { modeRef.current = v; setModeState(v); };
  const [hud, setHud] = useState(0);
  /* 멈춤은 없다(턴제 · 시간이 점수다) — 톱니 창 · 턴 밖에서만 선다. */
  const pausedRef = useRef(false); pausedRef.current = gearPaused || turn !== "run";
  const gearRef = useRef(false); gearRef.current = gearPaused;
  const cam = camDbg;
  const groups = useRef<Record<string, number[]>>({});
  const lastGroup = useRef<{ k: string; t: number }>({ k: "", t: 0 });
  /** 화면 기억(Shift + F2 · F3 · F4). */
  const views = useRef<Record<string, [number, number]>>({});
  const mouse = useRef({ x: 0, y: 0, in: false, down: false, sx: 0, sy: 0, box: false });
  /** 커서(게임 틀 기준 css px) · 창 안에 있나 · 갇혔나(Pointer Lock). */
  const cur = useRef({ x: -1, y: -1, inWin: true });
  const lockedRef = useRef(false); const [locked, setLocked] = useState(false);
  /** 스크롤 — 가속 단계 · 마지막 방향 · 걸음 누적(ms) · 키로 민 뒤 쉬는 중 · 그때의 커서. */
  const scr = useRef({ step: 0, dx: 0, dy: 0, acc: 0, sup: false, sx: -1, sy: -1 });
  const miniDrag = useRef(false);
  const btnDown = useRef<HTMLButtonElement | null>(null);
  /** 우클릭 대상 깜빡임 — id → 시작(ms). */
  const flashes = useRef(new Map<number, number>());
  const curEl = useRef<HTMLDivElement>(null);
  const keysDown = useRef(new Set<string>());
  useEffect(() => { const w = window as unknown as { __pracDebug?: boolean; __pracSim?: PracticeSim9; __pracCam?: unknown; __pracCur?: unknown; __pracGl?: unknown }; if (w.__pracDebug) { w.__pracSim = sim; w.__pracCam = camDbg.current; w.__pracCur = cur.current; w.__pracGl = glRef; } }, [sim]);
  /* 톱니 창이 열리면 커서 가둠을 푼다(창의 단추를 누를 수 있게). */
  useEffect(() => { if (gearPaused && document.pointerLockElement) document.exitPointerLock(); }, [gearPaused]);

  /* 처음 화면 — 내 본진(홀) 가운데 */
  useEffect(() => {
    const hall = sim.ents.find((e) => e.owner === 0 && /^(Command Center|Nexus|Hive)$/.test(e.def.name));
    if (hall) { cam.current.x = hall.x; cam.current.y = hall.y + 60; }
  }, [sim, cam]);

  /* 지형 기하(재생기와 같은 GL 지형층) · 미니맵 그림 */
  useEffect(() => {
    terrGeom.current = terrainGeom9(map.hash, terrainFace(terrain), terrainFill);
    const m = document.createElement("canvas"); m.width = map.width * 2; m.height = map.height * 2;
    const mg = m.getContext("2d"); if (mg) drawMapGrid(mg, map, terrainFace(terrain), 2, false);
    miniImg.current = m;
  }, [map, terrain]);
  /* GL 붓 — 이 판의 캔버스에 제 문맥(재생기 싱글턴과 따로). 판이 끝나면 문맥을 놓는다. */
  useEffect(() => {
    const cv = glCvRef.current; if (!cv) return undefined;
    let g: GlUnits9 | null = null;
    try { g = new GlUnits9(cv, 600, true, true, true); } catch (e) { console.warn("[prac] GL", e); g = null; }
    glRef.current = g;
    return () => { glRef.current = null; try { (g?.gl.getExtension("WEBGL_lose_context") as { loseContext?: () => void } | null)?.loseContext?.(); } catch { /* 이미 잃음 */ } };
  }, []);
  /* 모델 미리 굽기 — 이 판에 나오는 몸 · 내가 뽑을 수 있는 몸을 몇 개씩 나눠 굽는다(첫 장면이 멎지 않게). */
  useEffect(() => {
    if (!loading) return undefined;
    const jobs: (() => void)[] = [];
    const seen = new Set<string>();
    const addU = (kind: string): void => { if (seen.has(`u:${kind}`)) return; seen.add(`u:${kind}`); jobs.push(() => { glRef.current?.unitMesh(kind, 0, 3); }); };
    const addB = (kind: string, lit: boolean): void => {
      const key = `b:${kind}:${lit ? 1 : 0}`; if (seen.has(key)) return; seen.add(key);
      jobs.push(() => { glRef.current?.bldMesh({ kind, fx: 0, fy: 0, z: 0, sizePx: 16, color: PRAC_COLORS9[0], alpha: 1, rotDeg: BUILDING_BASE_YAW, spin: 0, ...(lit ? { lit: true } : {}) } as UnitDrawOp, 3); });
    };
    for (const e of sim.ents) { if (e.def.bld) addB(bldKind9(e.def.name), false); else addU(UNIT_3D[e.def.name] ?? "gunner"); }
    for (const e of sim.ents) if (e.owner === 0 && PROD9[e.def.name]) addB(bldKind9(e.def.name), true);
    for (const e of sim.ents) if (e.owner === 0) for (const it of PROD9[e.def.name] ?? []) if (it.k === "unit") addU(UNIT_3D[it.name] ?? "gunner");
    if (setup.myRace === "T") addU("tanksiege");
    if (setup.myRace === "Z") { addU("lurker"); addU("lurkerburrow"); }
    if (setup.myRace === "P") addU("archon");
    setWarm({ done: 0, all: jobs.length });
    let i = 0; let raf = 0; let dead = false;
    const tick = (): void => {
      if (dead) return;
      const t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 24) { try { jobs[i](); } catch (e) { console.warn("[prac] 굽기", e); } i += 1; }
      setWarm({ done: i, all: jobs.length });
      if (i < jobs.length) raf = requestAnimationFrame(tick); else onReady();
    };
    raf = requestAnimationFrame(tick);
    return () => { dead = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sim]);

  /* ── 좌표 ─────────────────────────────────────────────────── */
  const view = (): { w: number; h: number } => { const c = cvRef.current; return { w: c?.clientWidth ?? 800, h: c?.clientHeight ?? 600 }; };
  /** 원작 화면(640 × 400 게임 px)을 캔버스 안에 가득 · 가운데 — 배율은 캔버스 크기가 정한다. */
  const fitZ = (): number => { const { w, h } = view(); return Math.max(0.1, Math.min(w / VIEW_W9, h / VIEW_H9)); };
  const toWorld = (sx: number, sy: number): [number, number] => {
    const { w, h } = view(); const { x, y, z } = cam.current;
    return [x + (sx - w / 2) / z, y + (sy - h / 2) / z];
  };
  /** 화면 자리 — 왼쪽 위가 8px 칸 위 · 지도 안(원작 SetScreenPosition · & ~7). */
  const clampCam = (): void => {
    const c = cam.current; c.z = fitZ();
    const hw = VIEW_W9 / 2; const hh = VIEW_H9 / 2;
    const tx = Math.max(0, Math.min(sim.W - VIEW_W9, c.x - hw)); const ty = Math.max(0, Math.min(sim.H - VIEW_H9, c.y - hh));
    c.x = Math.floor(tx / 8) * 8 + hw; c.y = Math.floor(ty / 8) * 8 + hh;
  };
  const flash = (t: Ent9 | null): void => { if (t && !t.def.res) flashes.current.set(t.id, performance.now()); };
  /** 땅 표식(원작은 하나 — 새로 찍으면 옮겨 간다). */
  const mark = useRef<{ x: number; y: number; t0: number } | null>(null);
  /** kp_mark_target — 유닛이면 깜빡임 · 땅이면 표식. */
  const markTarget = (wx: number, wy: number, t: Ent9 | null): void => {
    if (t && !t.def.res) flash(t);
    else mark.current = { x: wx, y: wy, t0: performance.now() };
  };
  /** 여러 기 고르기에 들 수 있나(내 유닛 · 건물 아님 · FilterSelectableUnits). */
  const multiOk = (u: Ent9 | undefined): u is Ent9 => !!u && u.owner === 0 && !u.def.bld && !u.dead && u.inside === null;
  /** 보이는 원작 화면(640 × 400) 안의 세계 사각. */
  const screenRect = (): [number, number, number, number] => {
    const c = cam.current; return [c.x - VIEW_W9 / 2, c.y - VIEW_H9 / 2, c.x + VIEW_W9 / 2, c.y + VIEW_H9 / 2];
  };
  /** 화면 안 같은 종류(Ctrl · 더블클릭) — 남의 것 · 건물은 그 하나. Shift 면 고른 것에 더한다(12 까지). */
  const typeSelect = (t: Ent9, shift: boolean): void => {
    let list: number[] = [t.id];
    if (multiOk(t)) {
      const [ax, ay, bx, by] = screenRect();
      list = [t.id, ...sim.alive().filter((u) => u !== t && multiOk(u) && u.def.name === t.def.name && u.burrowed === t.burrowed
        && u.x >= ax && u.x <= bx && u.y >= ay && u.y <= by).sort((a, b) => b.y - a.y).map((u) => u.id)].slice(0, SEL_MAX9);
    }
    const cur0 = selRef.current.map((id) => sim.byId.get(id));
    if (shift && cur0.length && cur0.every(multiOk) && multiOk(t)) setSel(Array.from(new Set([...selRef.current, ...list])).slice(0, SEL_MAX9));
    else setSel(list);
  };

  /* ── 명령 ─────────────────────────────────────────────────── */
  const mySel = (): Ent9[] => selRef.current.map((id) => sim.byId.get(id)).filter((e): e is Ent9 => !!e && !e.dead && e.inside === null && e.owner === 0);
  /** 고른 것이 내 건물 하나면 그 건물(명령 카드 = 생산 · 연구). */
  const selBld = (): Ent9 | null => { const us = mySel(); return us.length === 1 && us[0].def.bld ? us[0] : null; };
  /** 우클릭(RightClickInGame) — ground 면 유닛을 안 고른다(미니맵 우클릭). */
  const smart = (wx: number, wy: number, q: boolean, ground = false): void => {
    const us = mySel(); if (!us.length) return;   // 남의 유닛을 고른 채 우클릭 — 아무 일 없음
    const b = selBld();
    if (b) { if (sim.prodOn && PROD9[b.def.name]?.some((it) => it.k === "unit")) { sim.setRally(b.id, wx, wy); markTarget(wx, wy, null); } return; }   // 생산 건물 — 모이는 자리(생산을 막은 판엔 없음)
    const t = ground ? null : sim.pick(wx, wy);
    if (us.length === 1 && t && t.id === us[0].id) return;   // 하나 고른 유닛이 제 몸을 우클릭 — 아무 일 없음
    if (!t && !us.some((e) => e.mv)) return;   // 땅인데 움직일 것이 없으면 그만
    markTarget(wx, wy, t);   // 유닛이면 고리 깜빡임(selectionTimer 31) · 땅이면 이동 표식
    const ids = us.map((e) => e.id);
    if (t && t.owner === 1 && !t.def.res) { sim.order(ids, { t: "attack", id: t.id }, q); return; }
    if (t && t.owner === 0 && t.def.cargo && !us.includes(t)) { sim.order(ids, { t: "load", id: t.id }, q); return; }
    if (t && t.owner === 0 && !t.def.cargo && t.def.slots) {
      const ships = us.filter((e) => e.def.cargo);
      if (ships.length) { sim.order([ships[0].id], { t: "pickup", id: t.id }, q); return; }
    }
    sim.order(ids, { t: "move", x: wx, y: wy }, q);
  };
  const doAct = (a: Act9, wx: number | null, wy: number | null, q: boolean, ground = false): void => {
    const us = mySel().filter((e) => !e.def.bld); const ids = us.map((e) => e.id);
    if (!ids.length) return;
    if (a === "stop") { sim.stop(ids); return; }
    if (a === "siege") {
      const tk = us.filter((e) => e.def.name === "Siege Tank" || e.def.name === "Siege Tank (Siege Mode)");
      const up = tk.some((e) => e.def.name === "Siege Tank");
      sim.order(tk.filter((e) => e.def.name === (up ? "Siege Tank" : "Siege Tank (Siege Mode)")).map((e) => e.id), { t: up ? "siege" : "unsiege" }, q);
      return;
    }
    if (a === "burrow") {
      const lk = us.filter((e) => e.def.burrowShoot);
      const down = lk.some((e) => !e.burrowed);
      sim.order(lk.map((e) => e.id), { t: down ? "burrow" : "unburrow" }, q);
      return;
    }
    if (a === "hold") { sim.order(ids, { t: "hold" }, false); return; }
    if (wx === null || wy === null) { setMode(a); return; }
    const t = ground ? null : sim.pick(wx, wy);
    markTarget(wx, wy, t);   // 겨눈 좌클릭(TargetingLeftClick) — 유닛 깜빡임 · 땅 표식
    if (a === "storm") { sim.order(us.filter((e) => e.def.name === "High Templar").map((e) => e.id), { t: "storm", x: wx, y: wy }, q); return; }
    if (a === "web") {
      /* 커세어는 땅 자리에 웹 · 베슬은 찍은 몸에 매트릭스(한 기만 — 원작도 고른 것 중 하나가 쓴다). */
      const cs = us.filter((e) => e.def.name === "Corsair");
      if (cs.length) { sim.order([cs[0].id], { t: "web", x: wx, y: wy }, q); return; }
      const vs = us.filter((e) => e.def.name === "Science Vessel");
      if (vs.length && t) sim.order([vs[0].id], { t: "matrix", id: t.id }, q);
      return;
    }
    if (a === "irradiate") {
      const vs = us.filter((e) => e.def.name === "Science Vessel");
      if (vs.length && t && !t.def.res) sim.order([vs[0].id], { t: "irradiate", id: t.id }, q);
      return;
    }
    if (a === "move") sim.order(ids, { t: "move", x: wx, y: wy }, q);
    else if (a === "attack") {
      if (t && t.owner === 1 && !t.def.res) sim.order(ids, { t: "attack", id: t.id }, q);
      else sim.order(ids, { t: "amove", x: wx, y: wy }, q);
    } else if (a === "unload") {
      const ships = us.filter((e) => e.def.cargo);
      /* 자기(고른) 수송선을 찍으면 낙하산 — 고른 수송선 모두가 가던 길에 한 기씩. */
      if (t && ships.some((s) => s.id === t.id)) { sim.paradrop(ships.map((s) => s.id), q); return; }
      for (const s of ships) sim.order([s.id], { t: "moveunload", x: wx, y: wy }, q);
    } else if (a === "load") {
      if (t && t.owner === 0 && t.def.cargo) sim.order(ids.filter((id) => id !== t.id), { t: "load", id: t.id }, q);
      else if (t && t.owner === 0 && t.def.slots) { const s = us.find((e) => e.def.cargo); if (s) sim.order([s.id], { t: "pickup", id: t.id }, q); }
    }
  };
  /** 명령 카드 한 칸(생산 · 연구) — 고른 건물에 건다. */
  const trainKey = (b: Ent9, it: ProdItem9): void => { sim.train(b.id, it.name); setHud((x) => x + 1); };

  /* ── 키 ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (loading) return undefined;
    const onDown = (e: KeyboardEvent): void => {
      if (gearRef.current) return;   // 톱니 창 — 창이 키를 받는다
      /* 턴 밖 — Enter · Space 로 시작 · 다음 턴(그 밖의 키는 안 받는다). */
      if (turnRef.current !== "run") {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (turnRef.current === "ready") setTurn("run"); else onRestart(); }
        return;
      }
      const tg = e.target as HTMLElement | null;
      if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
      /* 화면 기억 — Shift + F2 · F3 · F4 = 지금 화면 · F2 · F3 · F4 = 그 화면으로(원작 그대로). */
      if (/^F[234]$/.test(e.code)) {
        e.preventDefault();
        if (e.shiftKey) views.current[e.code] = [cam.current.x, cam.current.y];
        else { const v = views.current[e.code]; if (v) { cam.current.x = v[0]; cam.current.y = v[1]; clampCam(); } }
        return;
      }
      const k = keyOf9(e) ?? e.key;
      keysDown.current.add(e.key);
      if (k.startsWith("Arrow")) e.preventDefault();   // 화살표는 화면 이동 — 바깥 쪽이 같이 굴러가지 않게
      if (k === "Escape") {
        if (modeRef.current) { setMode(null); return; }
        const b = selBld(); if (b && b.queue.length) sim.cancel(b.id, b.queue.length - 1);   // 원작: 건물 고른 채 Esc = 마지막 칸 무르기
        return;
      }
      if (/^[0-9]$/.test(k)) {
        e.preventDefault();
        /* Ctrl + 숫자 = 지정(Alt + 숫자도 — 키보드를 못 잠그는 브라우저에서 Ctrl + 숫자는 탭 바꾸기로 먹힌다). */
        if (e.ctrlKey || e.metaKey || e.altKey) { groups.current[k] = [...selRef.current]; return; }
        if (e.shiftKey) { setSel((s) => Array.from(new Set([...s, ...(groups.current[k] ?? [])])).slice(0, SEL_MAX9)); return; }
        const g = (groups.current[k] ?? []).filter((id) => { const u = sim.byId.get(id); return u && !u.dead; });
        if (!g.length) return;
        setSel(g);
        const now = performance.now();
        if (lastGroup.current.k === k && now - lastGroup.current.t < 400) {
          const us = g.map((id) => sim.byId.get(id)!).filter((u) => u.inside === null);
          if (us.length) { cam.current.x = us.reduce((s, u) => s + u.x, 0) / us.length; cam.current.y = us.reduce((s, u) => s + u.y, 0) / us.length; clampCam(); }
        }
        lastGroup.current = { k, t: now };
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      /* 건물을 고른 채 — 그 건물 명령 카드의 원작 글자(생산 · 연구)가 먼저다. */
      const b = selBld();
      if (b) {
        const it = (PROD9[b.def.name] ?? []).find((x) => x.key === k);
        if (it) { e.preventDefault(); trainKey(b, it); }
        return;
      }
      const act = ACTS9.find((a) => keys[a.key] === k);
      if (act) {
        e.preventDefault();
        if (INSTANT9.has(act.key)) doAct(act.key, null, null, e.shiftKey);
        else setMode(act.key);
      }
    };
    const onUp = (e: KeyboardEvent): void => { keysDown.current.delete(e.key); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, keys, sim]);

  /* ── 마우스 ───────────────────────────────────────────────
     모든 손짓은 '커서 자리(cur)'로 돈다 — 풀린 동안은 진짜 마우스 자리, 갇힌(Pointer Lock) 동안은 움직임을 쌓아 틀 안에 붙잡은 자리.
     갇힌 동안은 이벤트가 모두 틀(wrap)로 오므로 커서 밑의 요소를 찾아(elementFromPoint) 캔버스 · 미니맵 · 단추로 나눠 준다. */
  const cvXY = (): [number, number] => {
    const w = wrapRef.current; const c = cvRef.current; if (!w || !c) return [0, 0];
    const a = w.getBoundingClientRect(); const b = c.getBoundingClientRect();
    return [cur.current.x - (b.left - a.left), cur.current.y - (b.top - a.top)];
  };
  const underCursor = (): Element | null => {
    const w = wrapRef.current; if (!w) return null;
    const a = w.getBoundingClientRect();
    return document.elementFromPoint(a.left + cur.current.x, a.top + cur.current.y);
  };
  const gMove = (): void => {
    const [sx, sy] = cvXY(); const m = mouse.current; const c = cvRef.current;
    m.x = sx; m.y = sy; m.in = !!c && sx >= 0 && sy >= 0 && sx < c.clientWidth && sy < c.clientHeight;
    if (m.down && (Math.abs(m.x - m.sx) > 5 || Math.abs(m.y - m.sy) > 5)) m.box = true;
  };
  const gDown = (button: number, shift: boolean): void => {
    gMove();
    const m = mouse.current; const [wx, wy] = toWorld(m.x, m.y);
    if (button === 2) {
      if (modeRef.current) { setMode(null); return; }
      smart(wx, wy, shift); return;
    }
    if (button !== 0) return;
    if (modeRef.current) { doAct(modeRef.current, wx, wy, shift); if (!shift) setMode(null); return; }
    m.down = true; m.sx = m.x; m.sy = m.y; m.box = false;
  };
  const gUp = (button: number, shift: boolean, ctrl = false): void => {
    const m = mouse.current; if (!m.down || button !== 0) return;
    gMove();
    m.down = false;
    const cur0 = selRef.current.map((id) => sim.byId.get(id));
    if (m.box) {
      /* BoxSelectUnits — 상자와 겹치는 몸 · 내 유닛(건물 빼고) 앞부터 12 · 없으면 하나(남의 것 · 건물) · 아무것도 없으면 그대로. */
      m.box = false;
      const [ax, ay] = toWorld(Math.min(m.sx, m.x), Math.min(m.sy, m.y)); const [bx, by] = toWorld(Math.max(m.sx, m.x), Math.max(m.sy, m.y));
      const cands = sim.alive().filter((u) => !u.def.res && sim.visibleTo(u, 0)
        && u.x - u.def.box[0] <= bx && u.x + u.def.box[2] >= ax && u.y - u.def.box[1] <= by && u.y + u.def.box[3] >= ay).sort((a, b) => b.y - a.y);
      const own = cands.filter(multiOk).slice(0, SEL_MAX9).map((u) => u.id);
      if (!own.length) { if (cands[0]) setSel([cands[0].id]); return; }
      if (shift && cur0.length && cur0.every(multiOk)) setSel(Array.from(new Set([...selRef.current, ...own])).slice(0, SEL_MAX9));
      else setSel(own);
      return;
    }
    m.box = false;
    /* ClickSelectAtPoint — 빈 땅은 그대로 · Ctrl 은 화면 안 같은 종류 · Shift 는 넣고 빼기. */
    const [wx, wy] = toWorld(m.x, m.y);
    const t = sim.pick(wx, wy);
    if (!t || !sim.visibleTo(t, 0)) return;
    if (ctrl) { typeSelect(t, shift); return; }
    if (!shift || !cur0.length) { setSel([t.id]); return; }
    if (selRef.current.includes(t.id)) { setSel(selRef.current.filter((id) => id !== t.id)); return; }
    if (cur0.length >= SEL_MAX9 || !cur0.every(multiOk) || !multiOk(t)) return;
    setSel([...selRef.current, t.id]);
  };
  /** 더블클릭 — 고른 유닛이면 화면 안 같은 종류(ClickSelectAtPoint 의 double_click). */
  const gDbl = (shift = false): void => {
    gMove(); const [wx, wy] = toWorld(mouse.current.x, mouse.current.y);
    const t = sim.pick(wx, wy); if (!t || !selRef.current.includes(t.id)) return;
    typeSelect(t, shift);
  };
  const miniXY = (): [number, number] => {
    const w = wrapRef.current; const mc = miniRef.current; if (!w || !mc) return [0, 0];
    const a = w.getBoundingClientRect(); const r = mc.getBoundingClientRect();
    const fx = Math.max(0, Math.min(1, (cur.current.x - (r.left - a.left)) / r.width)); const fy = Math.max(0, Math.min(1, (cur.current.y - (r.top - a.top)) / r.height));
    return [fx * sim.W, fy * sim.H];
  };
  const miniDown = (button: number, shift: boolean): void => {
    const [wx, wy] = miniXY();
    /* 미니맵 — 우클릭은 늘 땅(유닛을 안 고른다 · 표식) · 겨눔 중이면 그 명령을 땅에. */
    if (button === 2) { if (modeRef.current) { doAct(modeRef.current, wx, wy, shift, true); setMode(null); } else smart(wx, wy, shift, true); return; }
    if (button !== 0) return;
    if (modeRef.current) { doAct(modeRef.current, wx, wy, shift, true); if (!shift) setMode(null); return; }
    cam.current.x = wx; cam.current.y = wy; clampCam(); miniDrag.current = true;   // 누른 채 끌면 화면이 따라온다(원작 미니맵)
  };
  /* 창 단위로 듣는다 — 커서가 캔버스를 벗어나도(가장자리 · 창 밖) 자리를 놓치지 않게. */
  useEffect(() => {
    if (loading) return undefined;
    const wrap = wrapRef.current; if (!wrap) return undefined;
    const fromEvent = (e: MouseEvent): void => {
      const c = cur.current;
      if (document.pointerLockElement === wrap) {   // lockedRef 는 pointerlockchange 가 와야 바뀐다 — 그 사이의 움직임도 갇힌 셈으로
        /* 갇힌 뒤 첫 움직임에 크롬이 엉뚱하게 큰 movementX 를 싣는 일이 있다 — 그 한 번은 버린다. */
        if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
        c.x = Math.max(0, Math.min(wrap.clientWidth - 1, c.x + e.movementX)); c.y = Math.max(0, Math.min(wrap.clientHeight - 1, c.y + e.movementY));
      } else {
        /* 갇히고 풀리는 틈에 브라우저가 (0, 0) 자리의 가짜 mousemove 를 쏘는 일이 있다 — 버린다. */
        if (e.type === "mousemove" && e.clientX === 0 && e.clientY === 0) return;
        const a = wrap.getBoundingClientRect(); c.x = e.clientX - a.left; c.y = e.clientY - a.top;
      }
      c.inWin = true;
    };
    const onMove = (e: MouseEvent): void => {
      fromEvent(e); gMove();
      if (miniDrag.current) { const [wx, wy] = miniXY(); cam.current.x = wx; cam.current.y = wy; clampCam(); }
    };
    const onDown = (e: MouseEvent): void => {
      if (gearRef.current) return;
      const el = lockedRef.current ? underCursor() : (e.target as Element | null);
      if (!lockedRef.current) fromEvent(e);
      if (el === cvRef.current) {
        e.preventDefault(); gDown(e.button, e.shiftKey);
        /* 원작처럼 커서를 화면 안에 가둔다 — 사용자 손짓(누름) 안에서만 걸 수 있다. */
        if (!lockedRef.current && wrap.requestPointerLock) { try { const r = wrap.requestPointerLock() as unknown; if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => undefined); } catch { /* 막힌 곳 */ } }
        return;
      }
      if (el === miniRef.current) { e.preventDefault(); miniDown(e.button, e.shiftKey); return; }
      if (lockedRef.current) { btnDown.current = (el?.closest("button") as HTMLButtonElement | null) ?? null; e.preventDefault(); }
    };
    const onUp = (e: MouseEvent): void => {
      if (!lockedRef.current) fromEvent(e);
      if (mouse.current.down) gUp(e.button, e.shiftKey, e.ctrlKey || e.metaKey);
      miniDrag.current = false;
      if (lockedRef.current && e.button === 0 && btnDown.current) {
        const b = btnDown.current; btnDown.current = null;
        if (underCursor()?.closest("button") === b) b.click();
      }
    };
    const onDbl = (e: MouseEvent): void => {
      const el = lockedRef.current ? underCursor() : (e.target as Element | null);
      if (el === cvRef.current) gDbl(e.shiftKey);
    };
    const onCtx = (e: MouseEvent): void => { if (lockedRef.current || wrap.contains(e.target as Node)) e.preventDefault(); };
    const onOut = (e: MouseEvent): void => { if (!e.relatedTarget) cur.current.inWin = false; };   // 창 밖으로 — 마지막 자리를 쥔다
    const onLock = (): void => {
      const on = document.pointerLockElement === wrap;
      lockedRef.current = on; setLocked(on);
      if (on) { const c = cur.current; c.x = Math.max(0, Math.min(wrap.clientWidth - 1, c.x)); c.y = Math.max(0, Math.min(wrap.clientHeight - 1, c.y)); }
    };
    window.addEventListener("mousemove", onMove);
    wrap.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    wrap.addEventListener("dblclick", onDbl);
    window.addEventListener("contextmenu", onCtx);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("pointerlockchange", onLock);
    return () => {
      window.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      wrap.removeEventListener("dblclick", onDbl);
      window.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("pointerlockchange", onLock);
      if (document.pointerLockElement === wrap) document.exitPointerLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sim]);
  /** 한 걸음 — 원작 UpdateMapScroll(키 먼저 · 아니면 가장자리 · 가속 단계 · 속도표). */
  const scrollStep = (): void => {
    const sc = scr.current; const kd = keysDown.current; const m = mouse.current;
    if (m.down && m.box) { sc.step = 0; return; }   // 상자 끌기 중엔 안 민다
    let dx = 0; let dy = 0; let moving = false;
    if (kd.has("ArrowLeft")) dx = -1; else if (kd.has("ArrowRight")) dx = 1;
    if (kd.has("ArrowUp")) dy = -1; else if (kd.has("ArrowDown")) dy = 1;
    if (dx || dy) { moving = true; sc.sup = true; sc.sx = cur.current.x; sc.sy = cur.current.y; }
    else {
      [dx, dy] = edgeDir();
      if (sc.sup) { if (cur.current.x === sc.sx && cur.current.y === sc.sy) { dx = 0; dy = 0; } else sc.sup = false; }
      moving = dx !== 0 || dy !== 0;
      if (!moving) sc.step = 0;
    }
    if (moving && sc.step < 6) sc.step += 1;
    if (moving) { sc.dx = dx; sc.dy = dy; }
    if (sc.step) {
      const n = SCROLL_SPEEDS9[SCROLL_SPEED9][sc.step];
      cam.current.x += sc.dx * n; cam.current.y += sc.dy * n; clampCam();
    }
  };
  /** 가장자리 방향 — 갇힌 커서는 틀 끝 2 게임 px · 풀린 커서는 틀 안 끝 띠, 또는 창 밖으로 나간 마지막 자리가 끝 곁이면 그 쪽. 톱니 창 동안은 안 민다. */
  const edgeDir = (): [number, number] => {
    const w = wrapRef.current; if (!w || gearRef.current) return [0, 0];
    const W = w.clientWidth; const H = w.clientHeight; const c = cur.current;
    if (c.x < 0 && c.y < 0) return [0, 0];
    const band = Math.max(2, EDGE_GAME_PX9 * fitZ());
    if (!lockedRef.current) {
      const inside = c.x >= 0 && c.y >= 0 && c.x < W && c.y < H;
      if (!inside && c.inWin) return [0, 0];   // 틀 밖 앱 화면 위 — 안 민다
      const near = c.inWin ? band : 48;          // 창 밖으로 빠져나갔으면 마지막 자리가 끝 곁(48px)이면 그 쪽으로
      const x = Math.max(0, Math.min(W - 1, c.x)); const y = Math.max(0, Math.min(H - 1, c.y));
      return [x <= near ? -1 : x >= W - 1 - near ? 1 : 0, y <= near ? -1 : y >= H - 1 - near ? 1 : 0];
    }
    return [c.x <= band ? -1 : c.x >= W - 1 - band ? 1 : 0, c.y <= band ? -1 : c.y >= H - 1 - band ? 1 : 0];
  };

  /* ── 돌리기 · 그리기 ───────────────────────────────────────── */
  useEffect(() => {
    if (loading) return undefined;
    let raf = 0; let last = performance.now(); let acc = 0; let hudT = 0;
    const loop = (now: number): void => {
      const dt = Math.min(250, now - last); last = now;
      if (!pausedRef.current) { acc += dt; while (acc >= PRAC_TICK_MS9 && sim.phase !== "over") { sim.step(); acc -= PRAC_TICK_MS9; } }
      else acc = 0;
      if (sim.phase === "over" && turnRef.current === "run") endTurn();
      /* 화면 이동 — 원작 걸음(15.625ms 마다) */
      const sc = scr.current; sc.acc += dt;
      let k = 0; while (sc.acc >= SCROLL_MS9 && k < 30) { sc.acc -= SCROLL_MS9; scrollStep(); k += 1; }
      if (k === 30) sc.acc = 0;
      clampCam();
      draw(now);
      /* 갇힌 커서 그림 — 보통 화살 · 겨눔 · 가장자리 스크롤 화살 */
      const ce = curEl.current;
      if (ce) {
        if (!lockedRef.current) ce.style.display = "none";
        else {
          const [ex, ey] = edgeDir();
          ce.style.display = "block";
          ce.style.transform = `translate(${cur.current.x}px, ${cur.current.y}px)`;
          ce.dataset.k = ex || ey ? "scroll" : modeRef.current ? "aim" : "arrow";
          if (ex || ey) ce.style.setProperty("--rot", `${Math.round((Math.atan2(ey, ex) * 180) / Math.PI)}deg`);
        }
      }
      hudT += dt; if (hudT > 150) { hudT = 0; setHud((x) => x + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sim]);

  const draw = (nowMs: number): void => {
    const cv = cvRef.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth; const H = cv.clientHeight;
    if (!W || !H) return;
    const bw = Math.round(W * dpr); const bh = Math.round(H * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    clampCam();
    const { x: cx, y: cy, z } = cam.current;
    const sxOf = (wx: number): number => W / 2 + (wx - cx) * z;
    const syOf = (wy: number): number => H / 2 + (wy - cy) * z;
    /* 원작 화면 네모(CSS px) — 그 밖은 위 2D 층이 검게 덮는다. */
    const vx = (W - VIEW_W9 * z) / 2; const vy = (H - VIEW_H9 * z) / 2; const vw = VIEW_W9 * z; const vh = VIEW_H9 * z;
    const t = nowMs / 1000;
    /* ① 지형 — 재생기와 같은 GL 지형층(지도 네 귀를 화면에 · 벽띠 평면 2 · 또렷이 0.5). 판 재사용은 지형층이 열쇠(네 귀 · 배킹)로 한다. */
    const tcv = terrCvRef.current; const G = terrGeom.current;
    if (tcv && G) {
      const tc = glTerrCanvas9(tcv);
      const x0 = sxOf(0); const y0 = syOf(0); const x1 = sxOf(sim.W); const y1 = syOf(sim.H);
      tc?.draw(G, [x0, y0, x1, y0, x1, y1, x0, y1], bw, bh, W, H, 2, null, fogOf(), 0.5, [vx, vy, vx + vw, vy + vh], null);
    }
    /* ② 몸 — GL 메시(재생기 붓) · 고리는 바닥 도형(prim · 몸보다 먼저) · 공중 고리는 제 깊이 칸(ring). */
    const g = glRef.current;
    const [wx0, wy0] = toWorld(vx - 96, vy - 96); const [wx1, wy1] = toWorld(vx + vw + 96, vy + vh + 96);
    const vis = sim.alive().filter((u) => u.x >= wx0 && u.x <= wx1 && u.y >= wy0 && u.y <= wy1 && shown(u));
    const selSet = new Set(selRef.current);
    const ringOn = (u: Ent9): boolean => {
      const t0 = flashes.current.get(u.id);
      if (t0 !== undefined) {
        const tt = FLASH_FRAMES9 - 1 - Math.floor((nowMs - t0) / PRAC_TICK_MS9);
        if (tt > 0) return (tt & 8) !== 0;
        flashes.current.delete(u.id);
      }
      return selSet.has(u.id);
    };
    const glOk = !!g && !g.lost;
    if (g && glOk) {
      g.view = [vx * dpr, vy * dpr, (vx + vw) * dpr, (vy + vh) * dpr];
      const order = [...vis].sort((a, b) => (a.def.air === b.def.air ? a.y - b.y : a.def.air ? 1 : -1));
      /* 크립 — 저그 건물 밑 얼룩(재생기 크립 판 creeppatch 세 무늬 · 같은 색) · 몸보다 먼저 민다(바닥). 크기는 홀 12 · 콜로니 6 · 나머지 5 타일(어림). */
      for (const u of vis) {
        if (!u.def.bld || u.def.race !== "Z" || u.def.res) continue;
        const wT = /^(Hive|Hatchery|Lair)$/.test(u.def.name) ? 12 : /Colony$/.test(u.def.name) ? 6 : 5;
        const cm = g.bldMesh({ kind: u.id % 3 === 0 ? "creeppatch" : u.id % 3 === 1 ? "creeppatch2" : "creeppatch3", fx: 0, fy: 0, z: 0, sizePx: 16, color: "#3a2d34", alpha: 1, rotDeg: 0, spin: 0 } as UnitDrawOp, 3);
        if (!cm) continue;
        const cf = g.footOf(cm, 0, CAM_TOP9); const ck = (wT * 32 * z) / Math.max(1e-3, cf.w);
        g.push({ mesh: cm, ax: sxOf(u.x) - ck * cf.cx, ay: syOf(u.y) - (ck * (cf.top + cf.bot)) / 2, k: ck, yoff: 0, yawDeg: 0, color: "#3a2d34", alpha: 1, cam: CAM_TOP9, gradR: 1e9, gradCy: 0 });
      }
      for (const u of order) {
        const sx = sxOf(u.x); const sy = syOf(u.y);
        const col = PRAC_COLORS9[u.owner];
        const fogged = u.owner === 1 && !sim.sees(u.x, u.y);   // 안개 속 기억(건물 · 자원) — 재생기처럼 반쯤
        const alpha = fogged ? 0.5 : sim.cloaked(u) ? (u.burrowed ? 0.45 : 0.55) : u.morphT > 0 ? 0.55 + 0.45 * (1 - u.morphT / Math.max(1, u.morphMax)) : 1;
        const ringCol = u.owner === 0 ? "#4dff7a" : u.def.res ? "#f2e14a" : "#ff4a3a";
        const rr = (u.def.rad + 3) * z; const ry = rr * 0.62; const ryOff = (u.def.air ? 0 : u.def.rad * 0.25) * z;
        const rOn = ringOn(u) && !fogged;
        const lw = Math.max(1.2, z * 0.8);
        if (u.def.bld) {
          /* 건물 — 재생기 붓과 같은 앉히기: 잉크 바닥을 발자국 아랫변(지면선)에 · 배수는 발자국 폭 × 종류 배수(BLD_NORM — 모델 잉크를 16-상자에 맞춘 값).
             재생기의 키움(BLD_DRAW_K 1.2)은 안 탄다(원작 크기 — 2026-11-17 둘째 요청). 고리는 모델 원점(그 건물이 선 땅 한가운데)에 발자국만 하게. */
          const kind = bldKind9(u.def.name);
          const lit = u.queue.length > 0;
          const mesh = g.bldMesh({ kind, fx: 0, fy: 0, z: 0, sizePx: 16, color: col, alpha: 1, rotDeg: BUILDING_BASE_YAW, spin: 0, ...(lit ? { lit: true } : {}) } as UnitDrawOp, 3);
          const [fw, fh] = u.def.foot ?? [2, 2];
          if (!mesh) { if (rOn) g.prim(2, sx, sy, fw * 16 * z, fh * 16 * z, ringCol, 1, lw); continue; }
          const k = ((fw * 32 * z) / 16) * bldNormOf(kind) * (BLD_DRAW_TUNE[kind] ?? 1);   // 재생기 종류별 크기 손보기(tune · 2026-11-17 지적 "유닛 크기 tune 적용안된거같음")
          const ft = g.footOf(mesh, -BUILDING_BASE_YAW, CAM_TOP9);
          const gy = sy + fh * 16 * z;
          const oy = gy - k * ft.bot;
          if (rOn) g.prim(2, sx, oy, Math.max(fw * 16, u.def.rad) * z * 0.92, Math.max(fw * 16, u.def.rad) * z * 0.92 * 0.56, ringCol, 1, lw);
          g.push({ mesh, ax: sx, ay: gy, k, yoff: -k * ft.bot, yawDeg: -BUILDING_BASE_YAW, color: col, alpha, cam: CAM_TOP9, gradR: fw * 32 * z * 0.707, gradCy: -8 * k,
            shadow: { ground: true, alpha: SHADOW_ALPHA9 }, over: true });
          continue;
        }
        const kind = unitKind9(u);
        const pk = POSE_KINDS[kind];
        const moving = u.spd > 0.05;
        const pose = pk?.flap ? walkCutOf9(kind, pk.flap, t) : pk?.move && moving ? walkCutOf9(kind, 4, t) : 0;
        const mesh = g.unitMesh(kind, pose, 3) ?? g.unitMesh(kind, 0, 3);
        if (!mesh) continue;
        /* 유닛 — 16-상자 가운데를 몸 자리에(원점 (8, 12) → 아래로 4칸 · 옛 판 그림과 같은 자리) · 배수는 잉크가 units.dat 상자만 하게(pracWorldPx9). */
        const k = (pracWorldPx9(u.def.name) * z) / 16;
        const yaw = 90 - (u.face * 180) / Math.PI;
        if (u.def.air) {
          g.push({ mesh, ax: sx, ay: sy + 4 * k, k, yoff: 0, yawDeg: yaw, color: col, alpha, cam: CAM_TOP9, gradR: k * 11.31, gradCy: 0,
            flat: GL_GLOW_KINDS9.has(kind), shadow: { dy: 24 * z, alpha: 0.3 }, over: true,
            ...(rOn ? { ring: { kind: 2 as const, x: sx, y: sy + ryOff, rx: rr, ry, color: ringCol, alpha: 1, lineW: lw, shear: 0 } } : {}) });
        } else {
          if (rOn) g.prim(2, sx, sy + ryOff, rr, ry, ringCol, 1, lw);
          g.push({ mesh, ax: sx, ay: sy + 4 * k, k, yoff: 0, yawDeg: yaw, color: col, alpha, cam: CAM_TOP9, gradR: k * 11.31, gradCy: 0,
            flat: GL_GLOW_KINDS9.has(kind), shadow: { ground: true, alpha: SHADOW_ALPHA9 } });
        }
      }
      /* 스톰 — 재생기 GL 스톰 모델(벼락 무리 · 더하기 합성 · 칸 21/초) · 반지름 48 의 마당. */
      for (const st of sim.storms) {
        if (!sim.sees(st.x, st.y)) continue;
        const age = (56 - Math.max(0, st.life)) * FRAME_SEC;
        const mesh = g.fxMesh("storm", Math.floor(age * 21) % (2 * STORM_STAGES)); if (!mesh) continue;
        const bx = g.footOf(mesh, 0, CAM_TOP9); const Wd = 48 * 2.2 * z;
        const k = Math.min(Wd / Math.max(1e-3, bx.w), Wd / Math.max(1e-3, bx.bot - bx.top));
        g.push({ mesh, ax: sxOf(st.x) - k * bx.cx, ay: syOf(st.y) - (k * (bx.top + bx.bot)) / 2, k, yoff: 0, yawDeg: 0, color: "#fff", alpha: 1, cam: CAM_TOP9, gradR: 1e9, gradCy: 0, add: true, flat: true });
      }
      g.flush(bw, bh, W, H);
    }
    /* ③ 위 2D 층 — 체력 막대 · 총알 · 표식 · 길 · 상자 · 원작 화면 밖 검정. */
    const c2 = cv.getContext("2d"); if (!c2) return;
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2.clearRect(0, 0, W, H);
    c2.save(); c2.beginPath(); c2.rect(vx, vy, vw, vh); c2.clip();
    c2.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cx * z), dpr * (H / 2 - cy * z));
    if (!glOk) {
      /* GL 이 못 선 곳 — 동그라미로라도(옛 폴백). */
      for (const u of vis) { c2.beginPath(); c2.arc(u.x, u.y, u.def.rad, 0, Math.PI * 2); c2.fillStyle = u.def.res ? "#56c7ff" : PRAC_COLORS9[u.owner]; c2.fill(); }
      for (const st of sim.storms) { c2.beginPath(); c2.arc(st.x, st.y, 48, 0, Math.PI * 2); c2.fillStyle = "rgba(90, 140, 255, 0.3)"; c2.fill(); }
    }
    for (const u of vis) {
      if (u.def.res || (u.owner === 1 && !sim.sees(u.x, u.y))) continue;
      const hpMax = fp(u.def.hp); const shMax = fp(u.def.sh);
      if (u.hp < hpMax || u.sh < shMax || selSet.has(u.id)) {
        const bwid = Math.max(18, u.def.rad * 1.6); const by = u.y - u.def.rad - (u.def.air ? 14 : 8);
        c2.fillStyle = "rgba(0,0,0,0.7)"; c2.fillRect(u.x - bwid / 2 - 1, by - 1, bwid + 2, 5);
        const f = Math.max(0, u.hp) / hpMax;
        c2.fillStyle = f > 0.6 ? "#3ce26a" : f > 0.3 ? "#f2c23c" : "#ff4a3a"; c2.fillRect(u.x - bwid / 2, by, bwid * f, 3);
        if (shMax > 0) { c2.fillStyle = "#57a9ff"; c2.fillRect(u.x - bwid / 2, by - 2, bwid * (u.sh / shMax), 1.5); }
      }
      if (u.def.bld && u.owner === 0 && u.queue.length && u.prodMax > 0) {
        /* 만드는 중 — 건물 아래 진행 막대. */
        const bwid = Math.max(28, u.def.rad * 1.4); const by = u.y + u.def.rad * 0.6;
        c2.fillStyle = "rgba(0,0,0,0.7)"; c2.fillRect(u.x - bwid / 2 - 1, by - 1, bwid + 2, 4);
        c2.fillStyle = "#9be8ff"; c2.fillRect(u.x - bwid / 2, by, bwid * (1 - u.prodT / u.prodMax), 2);
      }
      if (u.def.cargo && u.cargo.length) {
        const n = u.cargo.length;
        for (let i = 0; i < n; i += 1) { c2.fillStyle = u.para ? "#ffd04a" : "#9be8ff"; c2.fillRect(u.x - n * 3 + i * 6, u.y + u.def.rad + 2, 4, 4); }
      }
    }
    /* 검진 — window.__pracFoot 이면 발자국(건물) · 몸 상자(유닛)를 겹쳐 그린다(모델 자리 맞춤 확인용). */
    if ((window as unknown as { __pracFoot?: boolean }).__pracFoot) {
      c2.lineWidth = 1 / z;
      for (const u of vis) {
        c2.strokeStyle = u.def.bld ? "rgba(255,255,0,0.9)" : "rgba(0,255,255,0.9)";
        if (u.def.bld && u.def.foot) c2.strokeRect(u.x - u.def.foot[0] * 16, u.y - u.def.foot[1] * 16, u.def.foot[0] * 32, u.def.foot[1] * 32);
        else c2.strokeRect(u.x - u.def.box[0], u.y - u.def.box[1], u.def.box[0] + u.def.box[2] + 1, u.def.box[1] + u.def.box[3] + 1);
      }
    }
    /* 땅 표식 — 초록 타원 둘이 0.5초 동안 오므라들며 흐려진다. */
    const mk = mark.current;
    if (mk) {
      const f = (nowMs - mk.t0) / PRAC_TICK_MS9;
      if (f >= MARK_FRAMES9) mark.current = null;
      else {
        const kk = f / MARK_FRAMES9; const r = 14 * (1 - 0.6 * kk);
        c2.strokeStyle = `rgba(77, 255, 122, ${0.95 - 0.7 * kk})`; c2.lineWidth = 1.6 / z;
        c2.beginPath(); c2.ellipse(mk.x, mk.y, r, r * 0.62, 0, 0, Math.PI * 2); c2.stroke();
        c2.beginPath(); c2.ellipse(mk.x, mk.y, r * 0.45, r * 0.45 * 0.62, 0, 0, Math.PI * 2); c2.stroke();
      }
    }
    for (const s of sim.shots) {
      if (!sim.sees(s.x2, s.y2) && !sim.sees(s.x1, s.y1)) continue;
      c2.strokeStyle = s.col; c2.globalAlpha = Math.min(1, s.t / 3); c2.lineWidth = 2 / z;
      c2.beginPath(); c2.moveTo(s.x1, s.y1); c2.lineTo(s.x2, s.y2); c2.stroke(); c2.globalAlpha = 1;
    }
    for (const sc of sim.scarabs) { if (!sim.sees(sc.x, sc.y)) continue; c2.beginPath(); c2.arc(sc.x, sc.y, 3, 0, Math.PI * 2); c2.fillStyle = "#ffb347"; c2.fill(); }
    /* 디스럽션 웹 — 보랏빛 그물 마당(반지름 64) · 매트릭스 — 몸 둘레 푸른 막 · 이레디 — 몸 둘레 녹색 빛. */
    for (const w of sim.webs) {
      if (!sim.sees(w.x, w.y)) continue;
      const k = Math.min(1, w.life / 48);
      c2.save(); c2.globalAlpha = 0.55 * k;
      c2.beginPath(); c2.arc(w.x, w.y, 64, 0, Math.PI * 2); c2.fillStyle = "rgba(150, 110, 255, 0.28)"; c2.fill();
      c2.clip(); c2.strokeStyle = "rgba(210, 190, 255, 0.85)"; c2.lineWidth = 1.2 / z; c2.beginPath();
      for (let i = -64; i <= 64; i += 12) { c2.moveTo(w.x + i - 64, w.y - 64); c2.lineTo(w.x + i + 64, w.y + 64); c2.moveTo(w.x + i + 64, w.y - 64); c2.lineTo(w.x + i - 64, w.y + 64); }
      c2.stroke(); c2.restore();
    }
    for (const u of vis) {
      if (u.dm > 0) { c2.beginPath(); c2.arc(u.x, u.y, u.def.rad + 6, 0, Math.PI * 2); c2.strokeStyle = "rgba(120, 200, 255, 0.85)"; c2.lineWidth = 2 / z; c2.stroke(); }
      if (u.irrT > 0) { c2.beginPath(); c2.arc(u.x, u.y, u.def.rad + 4, 0, Math.PI * 2); c2.fillStyle = "rgba(120, 255, 90, 0.28)"; c2.fill(); }
    }
    if ((modeRef.current === "storm" || (modeRef.current === "web" && mySel().some((e) => e.def.name === "Corsair"))) && mouse.current.in) {
      const [mx, my] = toWorld(mouse.current.x, mouse.current.y);
      c2.beginPath(); c2.arc(mx, my, modeRef.current === "storm" ? 48 : 64, 0, Math.PI * 2); c2.strokeStyle = "rgba(140, 190, 255, 0.9)"; c2.lineWidth = 1.5 / z; c2.stroke();
    }
    for (const b of sim.booms) {
      if (!sim.sees(b.x, b.y)) continue;
      const kk = 1 - b.t / 24;
      c2.beginPath(); c2.arc(b.x, b.y, b.r * (0.5 + kk), 0, Math.PI * 2);
      c2.fillStyle = `rgba(255, ${Math.round(170 - 120 * kk)}, 60, ${Math.max(0, 0.7 - kk * 0.7)})`; c2.fill();
    }
    /* 예약된 길 — 고른 내 유닛 · 생산 건물의 모이는 자리 */
    c2.setLineDash([6 / z, 6 / z]); c2.lineWidth = 1.2 / z;
    for (const u of mySel()) {
      if (u.def.bld) {
        if (u.rally) { c2.beginPath(); c2.moveTo(u.x, u.y); c2.lineTo(u.rally[0], u.rally[1]); c2.strokeStyle = "rgba(120,255,140,0.7)"; c2.stroke(); }
        continue;
      }
      if (!u.orders.length) continue;
      c2.beginPath(); c2.moveTo(u.x, u.y);
      for (const o of u.orders) if (o.t === "move" || o.t === "amove" || (o.t === "moveunload" && !o.self)) c2.lineTo(o.x, o.y);
      c2.strokeStyle = u.def.cargo ? "rgba(255,210,74,0.75)" : "rgba(120,255,140,0.6)"; c2.stroke();
      for (const o of u.orders) if (o.t === "moveunload" && !o.self) { c2.beginPath(); c2.arc(o.x, o.y, 10, 0, Math.PI * 2); c2.strokeStyle = "rgba(255,210,74,0.9)"; c2.stroke(); }
    }
    c2.setLineDash([]);
    c2.restore();
    /* 원작 화면 밖 — 검정(지형 · 몸 층은 캔버스 가득 그린다). */
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2.fillStyle = "#000";
    if (vy > 0) { c2.fillRect(0, 0, W, vy); c2.fillRect(0, vy + vh, W, H - vy - vh); }
    if (vx > 0) { c2.fillRect(0, vy, vx, vh); c2.fillRect(vx + vw, vy, W - vx - vw, vh); }
    /* 상자 */
    const m = mouse.current;
    if (m.down && m.box) { c2.strokeStyle = "#4dff7a"; c2.lineWidth = 1; c2.strokeRect(Math.min(m.sx, m.x) + 0.5, Math.min(m.sy, m.y) + 0.5, Math.abs(m.x - m.sx), Math.abs(m.y - m.sy)); }
    drawMini();
  };
  const drawMini = (): void => {
    const c = miniRef.current; const img = miniImg.current; if (!c || !img) return;
    const s = c.clientWidth; const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(s * dpr)) { c.width = Math.round(s * dpr); c.height = Math.round(s * dpr); }
    const g = c.getContext("2d"); if (!g) return;
    const k = c.width / sim.W;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(img, 0, 0, c.width, c.height);
    for (const u of sim.alive()) {
      if (!shown(u)) continue;
      g.fillStyle = u.def.name === "Vespene Geyser" ? "#3fd07a" : u.def.res ? "#56c7ff" : u.owner === 0 ? "#4d8dff" : "#ff4a3a";
      const r = Math.max(1.5, u.def.rad * k * (u.def.bld ? 1 : 1.4));
      g.fillRect(u.x * k - r, u.y * k - r, r * 2, r * 2);
    }
    const fm = fogRef.current.mini;
    if (fm) { g.imageSmoothingEnabled = true; g.drawImage(fm, 0, 0, c.width, c.height); }
    const { w, h } = view(); const z = cam.current.z;
    const vw = Math.min(w, VIEW_W9 * z); const vh = Math.min(h, VIEW_H9 * z);
    const [ax, ay] = toWorld((w - vw) / 2, (h - vh) / 2); const [bx, by] = toWorld((w + vw) / 2, (h + vh) / 2);
    g.strokeStyle = "#fff"; g.lineWidth = Math.max(1, dpr); g.strokeRect(ax * k, ay * k, (bx - ax) * k, (by - ay) * k);
  };

  /* ── 화물 칸 · 카드 그림 — 재생기 도록과 같은 GL 모델(정면)을 한 번 구워 체력색으로 물들인다(인포창의 실루엣과 같은 결) ── */
  const iconBase = useRef(new Map<string, HTMLCanvasElement | null>());
  const icons = useRef(new Map<string, string>());
  const [, setIconN] = useState(0);
  const iconOf = useCallback((name: string, col: string): string | null => {
    const key = `${name}|${col}`; const hit = icons.current.get(key); if (hit) return hit;
    const base = iconBase.current.get(name);
    if (base === undefined) {
      iconBase.current.set(name, null);
      const bld = !!UNIT_DEFS9[name]?.bld;
      glIconRequest9({
        kind: bld ? bldKind9(name) : UNIT_3D[name] ?? "gunner", bld, rotDeg: bld ? BUILDING_BASE_YAW : 0, pose: 0, spin: 0, w: 64, h: 64, color: PRAC_COLORS9[0], pad: 0.06,
        blit: (src, sx, sy, sw, sh) => { const c = document.createElement("canvas"); c.width = sw; c.height = sh; c.getContext("2d")?.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh); iconBase.current.set(name, c); },
        done: () => setIconN((n) => n + 1),
      });
      return null;
    }
    if (!base) return null;
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const gx = c.getContext("2d"); if (!gx) return null;
    gx.drawImage(base, 0, 0, 64, 64);
    gx.globalCompositeOperation = "screen"; gx.fillStyle = "rgba(90, 90, 90, 1)"; gx.fillRect(0, 0, 64, 64);
    gx.globalCompositeOperation = "color"; gx.fillStyle = col; gx.fillRect(0, 0, 64, 64);
    gx.globalCompositeOperation = "destination-in"; gx.drawImage(base, 0, 0, 64, 64);
    const url = c.toDataURL(); icons.current.set(key, url); return url;
  }, []);

  /* ── 고른 것 · 화물 · 명령 카드 ─────────────────────────────── */
  void hud;
  const selUnits = sel.map((id) => sim.byId.get(id)).filter((e): e is Ent9 => !!e && !e.dead && e.inside === null);
  const ships = selUnits.filter((e) => e.owner === 0 && e.def.cargo);
  const bld = selUnits.length === 1 && selUnits[0].owner === 0 && selUnits[0].def.bld ? selUnits[0] : null;
  const card = bld && sim.prodOn ? PROD9[bld.def.name] ?? [] : null;
  const st = sim.stats;
  return (
    <div className={`scr-prac-game${locked ? " is-locked" : ""}`} ref={wrapRef}>
      <div className="scr-prac-stage">
        <canvas ref={terrCvRef} className="scr-prac-layer" aria-hidden />
        <canvas ref={glCvRef} className="scr-prac-layer" aria-hidden />
        <canvas ref={cvRef} className="scr-prac-canvas" onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: mode ? "crosshair" : "default" }} />
      </div>
      {/* 갇힌 동안의 커서(원작은 커서가 창 안에 갇혀 있다) — 보통 화살 · 겨눔 · 가장자리 스크롤 화살 */}
      <div ref={curEl} className="scr-prac-cursor" data-k="arrow" aria-hidden>
        <svg className="is-arrow" width="18" height="24" viewBox="0 0 18 24"><path d="M1 1 L1 19 L6 14 L10 23 L13 22 L9 13 L16 13 Z" fill="#7dff8f" stroke="#04210a" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        <svg className="is-scroll" width="22" height="22" viewBox="0 0 22 22"><path d="M21 11 L8 2 L8 7 L1 7 L1 15 L8 15 L8 20 Z" fill="#7dff8f" stroke="#04210a" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        <svg className="is-aim" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="8" fill="none" stroke="#ffd04a" strokeWidth="2" /><path d="M13 0 V8 M13 18 V26 M0 13 H8 M18 13 H26" stroke="#ffd04a" strokeWidth="2" /></svg>
      </div>
      <div className="scr-prac-top">
        <span>{RACE_KO9[setup.myRace]} · {PRAC_SPOTS9.find((p) => p.key === sim.setup.mySpot)?.label} · 적 타워 {sim.setup.stage === "mid" ? "중반" : "초반"}</span>
        <span>점수 <b>{sim.score.score}</b></span>
        <span>일꾼 <b>{sim.score.kills}</b></span>
        <span className="is-loss">잃음 <b>{sim.score.lostN}</b>{sim.score.lostPts ? ` (−${sim.score.lostPts})` : ""}</span>
        {mode && <span className="scr-prac-mode">{ACTS9.find((a) => a.key === mode)?.label} — 자리를 누르세요(Esc 취소)</span>}
        {!locked && !mode && <span className="scr-prac-dim">게임 화면을 누르면 마우스가 화면 안에 갇혀요(원작처럼 가장자리 스크롤) · Esc 로 풀기</span>}
        <span className="scr-prac-sp" />
        <button type="button" onClick={onRestart} title="이 턴을 버리고 새 턴">턴 다시</button>
        <button type="button" onClick={onFull} title="전체 화면 — Ctrl+숫자 · F3 를 게임이 받아요">전체 화면</button>
        <button type="button" className="scr-prac-gear" onClick={onGear} title="설정(종족 · 자리 · 적 타워 · 키)" aria-label="설정">⚙</button>
      </div>
      <div className="scr-prac-bottom">
        <canvas ref={miniRef} className="scr-prac-mini" onContextMenu={(e) => e.preventDefault()} />
        <div className="scr-prac-selbox">
          {selUnits.length === 0 && <span className="scr-prac-dim">건물을 고르면 생산 · 연구 · 유닛을 고르면 명령 — 수송선을 고르면 화물 칸(칸을 누르면 그 한 기만 내림)</span>}
          {bld && (
            <div className="scr-prac-bld">
              <span className="scr-prac-shipname">{bld.def.ko}{sim.disabled(bld) ? " · 전원 없음" : ""}</span>
              <span className="scr-prac-queue">
                {Array.from({ length: 5 }, (_, i) => {
                  const it = bld.queue[i];
                  if (!it) return <span key={i} className="scr-prac-qslot is-empty" />;
                  const url = it.k === "unit" ? iconOf(it.name, "#6fe36f") : null;
                  const pct = i === 0 && bld.prodMax > 0 ? Math.round((1 - bld.prodT / bld.prodMax) * 100) : 0;
                  return (
                    <button key={i} type="button" className="scr-prac-qslot" title={`${it.ko} — 눌러서 무르기`} onClick={() => sim.cancel(bld.id, i)}>
                      {url ? <img src={url} alt={it.ko} draggable={false} /> : <i>{it.ko}</i>}
                      {i === 0 && <span className="scr-prac-qbar" style={{ width: `${pct}%` }} />}
                    </button>
                  );
                })}
              </span>
              {card?.some((it) => it.k === "unit") && <span className="scr-prac-dim">{bld.rally ? "모이는 자리 있음 · 우클릭으로 옮김" : "우클릭 = 모이는 자리"}</span>}
              {!sim.prodOn && <span className="scr-prac-dim">생산 · 연구는 없어요 — 연습기가 유닛 · 업그레이드를 미리 준비해 둬요</span>}
            </div>
          )}
          {!bld && ships.length > 0 && ships.slice(0, 6).map((s) => (
            <div key={s.id} className="scr-prac-ship">
              <span className="scr-prac-shipname">{s.def.ko}{s.para ? " · 낙하산" : ""}</span>
              {/* ★ 화물 칸 — 재생기 인포창의 짐칸과 같은 꼴(4칸 격자 · 칸이 수송 공간만큼 · 체력색 모델 실루엣) · 칸을 누르면 그 한 기만 지금 자리에 내린다. */}
              <span className="scr-prac-slots">
                {s.cargo.map((id) => { const u = sim.byId.get(id); if (!u) return null;
                  const sp = Math.min(4, u.def.slots); const f = (u.hp + u.sh) / fp(u.def.hp + u.def.sh);
                  const col = f > 0.6 ? "#6fe36f" : f > 0.3 ? "#f2c23c" : "#ff5a4a";
                  const url = iconOf(u.def.name, col);
                  return (
                    <button key={id} type="button" className="scr-prac-slot" title={`${u.def.ko} — 눌러서 지금 내리기`} onClick={() => sim.unloadOne(s.id, id)}
                      style={sp > 1 ? { gridColumn: `span ${sp >= 4 ? 2 : 1}`, gridRow: `span 2` } : undefined}>
                      {url ? <img src={url} alt={u.def.ko} draggable={false} /> : <i>{u.def.ko.slice(0, 2)}</i>}
                    </button>
                  ); })}
                {Array.from({ length: Math.max(0, 8 - sim.usedSlots(s)) }, (_, k) => <span key={`e${k}`} className="scr-prac-slot is-empty" />)}
              </span>
            </div>
          ))}
          {!bld && ships.length === 0 && selUnits.length > 0 && (
            <div className="scr-prac-sellist">
              {Object.entries(selUnits.reduce<Record<string, number>>((m, u) => { m[u.def.ko] = (m[u.def.ko] ?? 0) + 1; return m; }, {})).map(([n, c]) => (
                <span key={n} className={`scr-prac-chip${selUnits[0].owner === 1 ? " is-foe" : ""}`}>{n} ×{c}{(() => {
                  /* 에너지(하템 · 메딕) — 스톰 75 를 셀 수 있게 기마다. */
                  const en = selUnits.filter((u) => u.def.ko === n && sim.maxEnergy(u.def, u.owner) > 0).map((u) => Math.floor(u.en / 256));
                  return en.length ? ` · 에너지 ${en.join("/")}` : "";
                })()}</span>
              ))}
            </div>
          )}
        </div>
        <div className="scr-prac-cmds">
          {card && bld && card.map((it) => {
            const lv = it.k === "unit" ? 0 : sim.lvOf(0, it.name); const max = it.k === "tech" ? 1 : it.k === "up" ? sim.maxLv(it.name) : 0;
            const done = it.k !== "unit" && lv >= max;
            const ok = sim.canQueue(bld, it);
            const url = it.k === "unit" ? iconOf(it.name, "#d8e2f0") : null;
            return (
              <button key={it.name} type="button" className={`scr-prac-cmd${done ? " is-done" : ""}${it.k !== "unit" ? " is-res" : ""}`} disabled={!ok}
                title={`${it.ko}${it.k === "up" && max > 1 ? ` (${lv}/${max})` : ""}${done ? " — 다 했음" : ""}${sim.blocked(it) ? " — 초반 모드는 공방업 불가" : ""}`} onClick={() => trainKey(bld, it)}>
                {url && <img src={url} alt="" draggable={false} />}
                <b>{it.key}</b><span>{it.ko}{it.k === "up" && max > 1 ? ` ${lv}/${max}` : done ? " ✓" : ""}</span>
              </button>
            );
          })}
          {!bld && ACTS9.map((a) => (
            <button key={a.key} type="button" title={a.hint} className={`scr-prac-cmd${mode === a.key ? " is-on" : ""}`}
              onClick={() => { if (INSTANT9.has(a.key)) doAct(a.key, null, null, false); else setMode(a.key); }}>
              <b>{keys[a.key]}</b><span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* 턴 안내 — 위쪽 가운데 · 남은 시간(준비 30초 → 드랍 30초). */}
      {turn === "run" && (() => {
        const prep = sim.phase === "prep";
        const left = Math.max(0, (prep ? PRAC_PREP_FRAMES9 : PRAC_TURN_FRAMES9) - st.tick) * FRAME_SEC;
        return (
          <div className={`scr-prac-banner${prep ? "" : " is-drop"}${left <= 5 ? " is-hurry" : ""}`}>
            <span className="scr-prac-banner-t">{prep ? "드랍을 준비하세요" : "드랍을 성공시키세요"}</span>
            <b className="scr-prac-banner-n">{Math.ceil(left)}</b>
            <span className="scr-prac-banner-s">{prep ? "이때 내린 유닛은 점수가 없어요" : sim.dropAt >= 0 ? "드랍 사용 · 다시 못 태워요" : "드랍은 한 번"}</span>
          </div>
        );
      })()}
      {!loading && turn === "ready" && (
        <div className="scr-prac-turn">
          <h3>{RACE_KO9[setup.myRace]} · {PRAC_SPOTS9.find((p) => p.key === sim.setup.mySpot)?.label} · 적 타워 {sim.setup.stage === "mid" ? "중반" : "초반"}</h3>
          <p className="scr-prac-loadout">준비된 것 — {pracLoadoutText9(sim.setup.stage, sim.setup.myRace)}</p>
          <p><b>준비 {PRAC_PREP_SEC9}초</b> — 태우기 · 날아가기(이때 한 드랍은 점수 없음)</p>
          <p><b>드랍 {PRAC_DROP_SEC9}초</b> — 한 번 드랍해서 일꾼을 잡으세요(내린 뒤엔 다시 못 태워요)</p>
          <p className="scr-prac-dim">점수 = 잡은 일꾼 × {KILL_PTS9} − 잃은 내 유닛 값(광물 + 가스 ÷ {LOST_DIV9} · 수송선이 터지면 화물도) · 일꾼은 수송선을 보면 12기씩 다른 기지로 도망가요</p>
          <button type="button" className="scr-prac-start" onClick={() => setTurn("run")}>시작 (Enter)</button>
        </div>
      )}
      {turn === "over" && (
        <div className="scr-prac-turn is-over">
          <h3>턴 끝</h3>
          <div className="scr-prac-score">
            <span>잡은 일꾼 <b>{sim.score.kills}</b> × {KILL_PTS9}</span><span className="is-plus">+{sim.score.kills * KILL_PTS9}</span>
            <span>잃은 유닛 <b>{sim.score.lostN}</b>기</span><span className="is-minus">−{sim.score.lostPts}</span>
            <span className="is-total">점수</span><b className="is-total">{sim.score.score}</b>
          </div>
          {reply === "wait" && <p className="scr-prac-dim">기록하는 중…</p>}
          {reply && reply !== "wait" && (
            <p className="scr-prac-rec">
              {reply.newTop ? <b className="is-top">🏆 {sim.setup.stage === "mid" ? "중반" : "초반"} 전체 최고기록!</b> : reply.newMyBest ? <b>내 최고기록 갱신!</b> : null}
              <span>내 최고 {reply.newMyBest ? sim.score.score : reply.myBest ?? "—"} · 전체 최고 {reply.newTop ? sim.score.score : reply.top ?? "—"}{!reply.newTop && reply.topName ? ` (${reply.topName})` : ""}</span>
            </p>
          )}
          <div className="scr-prac-row">
            <button type="button" className="scr-prac-start" onClick={onRestart}>다음 턴 (Enter)</button>
            <button type="button" className="scr-prac-pill" onClick={onGear}>설정</button>
          </div>
        </div>
      )}
      {loading && <div className="scr-prac-loading">모델 굽는 중… {warm.done}/{warm.all}</div>}
    </div>
  );
}
