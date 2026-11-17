/* ★★ 수송선 드랍 연습실 화면(2026-11-17 · practiceSim9 ★ 머리말의 요청) — 설정 → 그림 굽기 → 놀이.
   조작은 원작 손버릇을 따른다: 왼클릭 고르기 · 끌어 상자 · Shift 더하기 · 오른클릭 알아서(적 → 공격 · 내 수송선 → 타기 · 수송선이 내 유닛 → 태우기 · 땅 → 이동) ·
   Shift + 오른클릭 · Shift + 명령은 예약 · Ctrl + 숫자 부대 지정 · 숫자 부대 부르기(두 번이면 화면 이동) · 화살표 · 화면 가장자리 · 미니맵으로 화면 이동.
   ★ 보이는 화면은 **원작 크기**(2026-11-17, 요청: "원작 정보를 그대로 … 연습실은 보이는 화면의 크기도") — 콘솔 위 게임 화면 640 × 400 게임 px
   (20 × 12.5 타일 · 재생기 ORIG_VIEW9 와 같은 자)를 캔버스에 맞춰 늘이고 남는 곳은 검게 둔다. 휠 확대는 걷었다(원작에 없다).
   명령 키(이동 · 공격 · 정지 · 홀드 · 하차 · 낙하산 · 태우기)는 설정에서 바꾼다(기기에 기억). 하차(U) 다음 땅을 누르면 그 자리로 가서 다 내리고, 수송선 자기를 누르면 그 자리에서 내린다.
   낙하산(D)은 가던 길을 멈추지 않고 한 기씩 떨군다 — Shift + 오른클릭으로 이어 갈 길을 예약해 두면 내리면서 그대로 간다. 화물 칸을 누르면 그 한 기만 지금 자리에 내린다. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayMapGrid } from "./mapGrid";
import { decodeMapTerrain, terrainFace, type MapTerrain } from "../../utils/mapTerrain";
import { drawMapGrid } from "../../utils/mapTiles";
import { FRAME_SEC, fp } from "../../utils/bwUnits";
import {
  CARGO_UNITS9, PRAC_RACES9, PRAC_SPOTS9, PRAC_TICK_MS9, PracticeSim9, UNIT_DEFS9,
  type Ent9, type PracRace9, type PracSetup9,
} from "./practiceSim9";
import { PRAC_COLORS9, bakePracSprite9, type PracSprite9 } from "./practiceSpr9";

export interface PracticeRoomProps {
  /** 빨무 지도(앱이 받아 준다 · 지형 terrain 이 있어야 걷는 칸을 안다). */
  map: ReplayMapGrid | null;
  className?: string;
}

type Act9 = "move" | "attack" | "stop" | "hold" | "unload" | "load" | "burrow" | "siege" | "storm";
const ACTS9: { key: Act9; label: string; def: string; hint: string }[] = [
  { key: "move", label: "이동", def: "M", hint: "다음 클릭 자리로 이동(적을 무시)" },
  { key: "attack", label: "공격", def: "A", hint: "다음 클릭 — 적이면 그 적 · 땅이면 가며 싸우기" },
  { key: "stop", label: "정지", def: "S", hint: "하던 일과 예약을 모두 멈춘다" },
  { key: "hold", label: "홀드", def: "H", hint: "그 자리에서 사거리 안만 쏜다" },
  /* ★ 낙하산은 따로 키가 없다(2026-11-17, 지적: "낙하산은 따로 키가 있는게 아니라 자기 수송선에 내리기를 찍는걸 말하는거야") — 하차 키 뒤 **자기 수송선을 찍으면** 낙하산
     (멈추지 않고 가던 길에 한 기씩 떨군다 · Shift + 오른클릭 예약 길을 그대로 간다). 옛(같은 날 첫 판): 낙하산 키 D. */
  { key: "unload", label: "하차", def: "U", hint: "다음 클릭 자리로 가서 다 내린다 · 자기 수송선을 찍으면 낙하산(멈추지 않고 가던 길에 한 기씩 · Shift 예약 길 그대로)" },
  { key: "load", label: "태우기", def: "L", hint: "다음 클릭한 수송선에 탄다(수송선은 클릭한 유닛을 태운다)" },
  /* 버로우(2026-11-17 둘째) — 원작 럴커는 땅속에서만 쏜다. 원작 키는 버로우 B · 해제 U 인데 U 가 하차와 겹쳐 한 키로 오간다. */
  { key: "burrow", label: "버로우", def: "B", hint: "럴커 — 땅속으로(땅속에서만 쏜다) · 다시 누르면 나온다" },
  /* 하템 · 탱크 드랍(2026-11-17 넷째, 요청: "하템 리버 탱크 드랍이 주라 필수야") — 원작 키 그대로(시즈 O · 스톰 T). */
  { key: "siege", label: "시즈", def: "O", hint: "시즈 탱크 — 시즈 모드(사거리 12타일 · 최소 2타일 · 제 편도 튄다) · 다시 누르면 탱크 모드" },
  { key: "storm", label: "스톰", def: "T", hint: "하이 템플러 — 다음 클릭 자리에 사이오닉 스톰(에너지 75 · 9타일 · 고른 하템 모두가 쓴다)" },
];
/** 누르면 곧바로 되는 명령(자리를 안 기다림). */
const INSTANT9 = new Set<Act9>(["stop", "hold", "burrow", "siege"]);
/** 원작 보이는 화면(게임 px) — 콘솔 위 640 × 400(재생기 ORIG_VIEW9 = 20 × 12.5 타일). */
const VIEW_W9 = 640; const VIEW_H9 = 400;
/* ★ 화면 스크롤 원작 그대로(2026-11-17, 지적: "엣지 투 스크롤이 잘 안됨(원작수준으로 재현 필요)") — 원작 실행 파일을 푼 KopruluSector(n0madic/KopruluSector ·
   native/kp_core/src/ui/kp_ui_scroll.c · docs/research/atlas/p34.md)의 UpdateMapScroll 0x49bf10 · GetEdgeScrollCursorId 0x43e7b0 · 속도표 0x509390 을 옮겼다:
   · 가장자리 = 커서가 화면(640 × 480 · 콘솔 포함) 끝 2px 안(x ≤ 1 · x ≥ 638 · y ≤ 1 · y ≥ 478) — 원작은 커서가 창 안에 갇혀 있어 밀면 끝에 붙는다.
     그래서 여기서도 마우스를 가둔다(Pointer Lock · 게임 화면을 누르면 갇히고 Esc 로 푼다 · 갇힌 동안은 우리 커서를 그린다).
   · 한 걸음마다 가속 단계 0 → 6 · 그 단계의 픽셀만큼(속도 3 = 옵션 기본: 8 · 8 · 16 · 24 · 24 · 32) · 화면 자리는 8px 칸 · 키(화살표)가 먼저고 키로 밀었으면
     커서가 움직일 때까지 가장자리는 쉰다 · 상자 끌기 중엔 안 민다. 걸음은 GameLoop 0x4451f0 이 GetTickCount 로 10ms 를 넘길 때마다(atlas p15) —
     윈도 틱 해상도가 15.625ms 라 실제로는 그만큼마다 한 걸음이다(최고 단계 32px → 초당 약 2048px). */
const SCROLL_SPEEDS9 = [
  [0, 0, 8, 8, 16, 16, 16], [0, 0, 8, 8, 16, 16, 24], [0, 8, 8, 16, 16, 24, 24], [0, 8, 8, 16, 24, 24, 32],
  [0, 8, 16, 16, 24, 32, 40], [0, 8, 16, 24, 32, 40, 48], [0, 8, 24, 32, 40, 56, 64],
];
const SCROLL_SPEED9 = 3; const SCROLL_MS9 = 15.625; const EDGE_GAME_PX9 = 2;
/** 우클릭 대상 고리 깜빡임(원작 selectionTimer = 31 · 매 프레임 1 씩 · 남은 값의 8 비트가 켜졌을 때만 고리 — 두 번 깜빡). */
const FLASH_FRAMES9 = 31;
const KEYS_LS9 = "scr.prac.keys";
const SETUP_LS9 = "scr.prac.setup2";   // 2 — 기본값을 수송선 1 · 유닛 0 으로(2026-11-17 요청) 바꾸며 옛 기억(scr.prac.setup)은 버린다
const loadJson9 = <T,>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? { ...fb, ...JSON.parse(v) } : fb; } catch { return fb; } };
const saveJson9 = (k: string, v: unknown): void => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 사생활 모드 */ } };
const DEF_KEYS9 = Object.fromEntries(ACTS9.map((a) => [a.key, a.def])) as Record<Act9, string>;
/** 기본 — 수송선 1 · 유닛 0(2026-11-17, 요청: "선택창에서 기본값은 수송선 1마리에 유닛 0으로" · 옛 4대 · 마린 16 · 메딕 8). */
const DEF_SETUP9: PracSetup9 = { myRace: "T", foeRace: "P", ships: 1, cargo: {}, mySpot: "BL", foeSpot: "TR", ups: true, lv: 0, fullEnergy: true };
/** 물리 키 → 글자(KeyU → U · Digit1 → 1) — e.key 는 한글 입력 상태에서 'ㅕ' 같은 낱자로 와서 키 지정 · 단축키가 안 먹었다(2026-11-17, 지적: "연습실 키설정이 안됨"). */
const keyOf9 = (e: KeyboardEvent): string | null => {
  const m = /^(?:Key([A-Z])|Digit([0-9])|Numpad([0-9]))$/.exec(e.code);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
};
const TP9 = 24;   // 지형 그림 칸(px/타일)

/** 게임 시계 — 프레임 × 1/23.81초(가장 빠름). */
const fmtTime9 = (tick: number): string => { const s = Math.floor(tick * FRAME_SEC); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export default function PracticeRoom({ map, className }: PracticeRoomProps) {
  const [phase, setPhase] = useState<"setup" | "loading" | "play">("setup");
  const [setup, setSetup] = useState<PracSetup9>(() => loadJson9(SETUP_LS9, DEF_SETUP9));
  const [keys, setKeys] = useState<Record<Act9, string>>(() => loadJson9(KEYS_LS9, DEF_KEYS9));
  const [terrain, setTerrain] = useState<MapTerrain | null | undefined>(undefined);
  const [err, setErr] = useState("");
  useEffect(() => { saveJson9(SETUP_LS9, setup); }, [setup]);
  useEffect(() => { saveJson9(KEYS_LS9, keys); }, [keys]);
  useEffect(() => {
    let live = true;
    setTerrain(undefined);
    if (!map) return undefined;
    decodeMapTerrain(map.terrain).then((t) => { if (live) setTerrain(t); }).catch(() => { if (live) setTerrain(null); });
    return () => { live = false; };
  }, [map]);
  const [run, setRun] = useState(0);
  const start = (): void => {
    if (!terrain || !map) { setErr("지도 지형을 아직 못 받았어요"); return; }
    if (setup.mySpot === setup.foeSpot) { setErr("내 위치와 적 위치가 같아요"); return; }
    setErr(""); setPhase("loading"); setRun((r) => r + 1);
  };
  return (
    <div className={`scr-prac${className ? ` ${className}` : ""}`}>
      {phase === "setup" && (
        <PracSetupPanel setup={setup} setSetup={setSetup} keys={keys} setKeys={setKeys} map={map} terrain={terrain} err={err} onStart={start} />
      )}
      {phase !== "setup" && map && terrain && (
        <PracGame key={run} map={map} terrain={terrain} setup={setup} keys={keys}
          onReady={() => setPhase("play")} onSetup={() => setPhase("setup")} onRestart={() => { setPhase("loading"); setRun((r) => r + 1); }} loading={phase === "loading"} />
      )}
    </div>
  );
}

/* ── 설정 ──────────────────────────────────────────────────────────────────── */
function PracSetupPanel({ setup, setSetup, keys, setKeys, map, terrain, err, onStart }: {
  setup: PracSetup9; setSetup: (f: (s: PracSetup9) => PracSetup9) => void;
  keys: Record<Act9, string>; setKeys: (f: (k: Record<Act9, string>) => Record<Act9, string>) => void;
  map: ReplayMapGrid | null; terrain: MapTerrain | null | undefined; err: string; onStart: () => void;
}) {
  const [listen, setListen] = useState<Act9 | null>(null);
  useEffect(() => {
    if (!listen) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
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
  const units = CARGO_UNITS9[setup.myRace];
  const slots = units.reduce((s, n) => s + (setup.cargo[n] ?? 0) * UNIT_DEFS9[n].slots, 0);
  const cap = setup.ships * 8;
  const mini = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = mini.current; if (!c || !map) return;
    const g = c.getContext("2d"); if (!g) return;
    c.width = map.width * 2; c.height = map.height * 2;
    drawMapGrid(g, map, terrain ? terrainFace(terrain) : null, 2, false);
  }, [map, terrain]);
  const setCargo = (n: string, v: number): void => setSetup((s) => ({ ...s, cargo: { ...s.cargo, [n]: Math.max(0, Math.min(96, Math.round(v) || 0)) } }));
  const race = (r: PracRace9): void => setSetup((s) => ({
    ...s, myRace: r,
    cargo: Object.fromEntries(CARGO_UNITS9[r].map((n) => [n, s.myRace === r ? (s.cargo[n] ?? 0) : 0])),
  }));
  return (
    <div className="scr-prac-setup">
      <h2 className="scr-prac-h">수송선 드랍 연습</h2>
      <div className="scr-prac-row">
        <span className="scr-prac-lab">내 종족</span>
        {PRAC_RACES9.map((r) => (
          <button key={r.key} type="button" className={`scr-prac-pill${setup.myRace === r.key ? " is-on" : ""}`} onClick={() => race(r.key)}>{r.label}</button>
        ))}
        <span className="scr-prac-dim">수송선: {UNIT_DEFS9[PRAC_RACES9.find((r) => r.key === setup.myRace)!.transport].ko}</span>
      </div>
      <div className="scr-prac-row">
        <span className="scr-prac-lab">수송선 수</span>
        <input type="range" min={1} max={12} value={setup.ships} onChange={(e) => setSetup((s) => ({ ...s, ships: Number(e.target.value) }))} />
        <b className="scr-prac-num">{setup.ships}대</b>
      </div>
      <div className="scr-prac-row is-top">
        <span className="scr-prac-lab">태울 유닛</span>
        <div className="scr-prac-cargo">
          {units.map((n) => (
            <label key={n} className="scr-prac-cargo-item">
              <span>{UNIT_DEFS9[n].ko}<i>{UNIT_DEFS9[n].slots}칸</i></span>
              <span className="scr-prac-stepper">
                <button type="button" onClick={() => setCargo(n, (setup.cargo[n] ?? 0) - 1)}>−</button>
                <input type="number" min={0} max={96} value={setup.cargo[n] ?? 0} onChange={(e) => setCargo(n, Number(e.target.value))} />
                <button type="button" onClick={() => setCargo(n, (setup.cargo[n] ?? 0) + 1)}>+</button>
              </span>
            </label>
          ))}
          <span className={`scr-prac-dim${slots > cap ? " is-warn" : ""}`}>칸 {slots} / {cap}{slots > cap ? " — 다 못 태워요(남는 유닛은 땅에 남아요)" : ""}</span>
        </div>
      </div>
      <div className="scr-prac-row">
        <span className="scr-prac-lab">적 종족</span>
        {PRAC_RACES9.map((r) => (
          <button key={r.key} type="button" className={`scr-prac-pill${setup.foeRace === r.key ? " is-on" : ""}`} onClick={() => setSetup((s) => ({ ...s, foeRace: r.key }))}>{r.label}</button>
        ))}
        <span className="scr-prac-dim">방어선 · 일꾼 50 · 본진</span>
      </div>
      <div className="scr-prac-row">
        <span className="scr-prac-lab">업그레이드</span>
        <button type="button" className={`scr-prac-pill${setup.ups ? " is-on" : ""}`} onClick={() => setSetup((s) => ({ ...s, ups: true }))}>연구 다</button>
        <button type="button" className={`scr-prac-pill${!setup.ups ? " is-on" : ""}`} onClick={() => setSetup((s) => ({ ...s, ups: false }))}>연구 없음</button>
        <span className="scr-prac-dim">공방</span>
        {[0, 1, 2, 3].map((v) => (
          <button key={v} type="button" className={`scr-prac-pill is-sm${(setup.lv ?? 0) === v ? " is-on" : ""}`} onClick={() => setSetup((s) => ({ ...s, lv: v }))}>{v}</button>
        ))}
        <span className="scr-prac-dim">두 편 같다 · 연구 = 속업 · 사업 · 스톰 · 시즈 · 스캐럽 · 리버 칸 · 에너지 · 키틴질</span>
      </div>
      <div className="scr-prac-row">
        <span className="scr-prac-lab">시작 에너지</span>
        <button type="button" className={`scr-prac-pill${setup.fullEnergy !== false ? " is-on" : ""}`} onClick={() => setSetup((s) => ({ ...s, fullEnergy: true }))}>가득</button>
        <button type="button" className={`scr-prac-pill${setup.fullEnergy === false ? " is-on" : ""}`} onClick={() => setSetup((s) => ({ ...s, fullEnergy: false }))}>막 뽑음</button>
        <span className="scr-prac-dim">하템 · 메딕 — 가득 = 드랍 전에 모아 둔 상태 · 막 뽑음 = 원작 새 유닛(최대의 1/4)</span>
      </div>
      <div className="scr-prac-row is-top">
        <span className="scr-prac-lab">위치</span>
        <div className="scr-prac-spots">
          <div className="scr-prac-spotmap">
            <canvas ref={mini} />
            {PRAC_SPOTS9.map((p) => {
              const me = setup.mySpot === p.key; const foe = setup.foeSpot === p.key;
              return (
                <button key={p.key} type="button" title={p.label}
                  className={`scr-prac-spot${me ? " is-me" : ""}${foe ? " is-foe" : ""}`}
                  style={{ left: `${(p.x / 4096) * 100}%`, top: `${(p.y / 4096) * 100}%` }}
                  onClick={(e) => setSetup((s) => (e.shiftKey || s.mySpot === p.key ? { ...s, foeSpot: p.key } : { ...s, mySpot: p.key }))}
                  onContextMenu={(e) => { e.preventDefault(); setSetup((s) => ({ ...s, foeSpot: p.key })); }}>
                  {me ? "나" : foe ? "적" : p.label}
                </button>
              );
            })}
          </div>
          <div className="scr-prac-spotlist">
            <div><span className="scr-prac-dim">내 위치</span>{PRAC_SPOTS9.map((p) => (
              <button key={p.key} type="button" className={`scr-prac-pill is-sm${setup.mySpot === p.key ? " is-on" : ""}`} onClick={() => setSetup((s) => ({ ...s, mySpot: p.key }))}>{p.label}</button>))}</div>
            <div><span className="scr-prac-dim">적 위치</span>{PRAC_SPOTS9.map((p) => (
              <button key={p.key} type="button" className={`scr-prac-pill is-sm is-foe${setup.foeSpot === p.key ? " is-on" : ""}`} onClick={() => setSetup((s) => ({ ...s, foeSpot: p.key }))}>{p.label}</button>))}</div>
            <p className="scr-prac-dim">지도: 누르면 내 위치 · 오른클릭(또는 Shift)이면 적 위치</p>
          </div>
        </div>
      </div>
      <div className="scr-prac-row is-top">
        <span className="scr-prac-lab">키 지정</span>
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
      {err && <p className="scr-prac-err">{err}</p>}
      <div className="scr-prac-row">
        <button type="button" className="scr-prac-start" onClick={onStart} disabled={!map || !terrain}>
          {!map ? "지도를 기다리는 중…" : terrain === undefined ? "지형 푸는 중…" : !terrain ? "이 지도는 지형 자료가 없어요" : "시작"}
        </button>
      </div>
      <p className="scr-prac-dim">왼클릭 고르기 · 끌어 상자 · 오른클릭 알아서(적 공격 · 수송선 타기 · 이동) · Shift 예약 · Ctrl+숫자 부대 · 화살표/가장자리/미니맵 화면 이동 · Esc 취소 · 화면은 원작 크기(640 × 400)</p>
    </div>
  );
}

/* ── 놀이 ──────────────────────────────────────────────────────────────────── */
function PracGame({ map, terrain, setup, keys, onReady, onSetup, onRestart, loading }: {
  map: ReplayMapGrid; terrain: MapTerrain; setup: PracSetup9; keys: Record<Act9, string>;
  onReady: () => void; onSetup: () => void; onRestart: () => void; loading: boolean;
}) {
  const sim = useMemo(() => new PracticeSim9(terrain, setup), [terrain, setup]);
  /* 검진 손잡이 — 시험 판(perf · 하네스)이 window.__pracDebug 를 켜 두면 셈 몸을 내준다. */
  const camDbg = useRef({ x: 0, y: 0, z: 1 });
  useEffect(() => { const w = window as unknown as { __pracDebug?: boolean; __pracSim?: PracticeSim9; __pracCam?: unknown }; if (w.__pracDebug) { w.__pracSim = sim; w.__pracCam = camDbg.current; (w as unknown as { __pracCur?: unknown }).__pracCur = cur.current; } }, [sim]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const sprites = useRef(new Map<string, PracSprite9>());
  const terrImg = useRef<HTMLCanvasElement | null>(null);
  const miniImg = useRef<HTMLCanvasElement | null>(null);
  const [baked, setBaked] = useState(0);
  const [toBake, setToBake] = useState(1);
  const [sel, setSel] = useState<number[]>([]);
  const selRef = useRef<number[]>([]); selRef.current = sel;
  const [mode, setModeState] = useState<Act9 | null>(null);
  /* 고르기 판(키를 누른 뒤 자리를 기다림) — 뜻은 ref 가 곧바로 쥔다(같은 손짓 안의 다음 클릭이 옛 값을 읽지 않게 · 하차 뒤 곧바로 Shift+오른클릭이 '취소'로 먹히던 것). */
  const modeRef = useRef<Act9 | null>(null);
  const setMode = (v: Act9 | null): void => { modeRef.current = v; setModeState(v); };
  const [hud, setHud] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false); pausedRef.current = paused;
  const cam = camDbg;
  const groups = useRef<Record<string, number[]>>({});
  const lastGroup = useRef<{ k: string; t: number }>({ k: "", t: 0 });
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

  /* 처음 화면 — 내 수송선 가운데 */
  useEffect(() => {
    const mine = sim.ents.filter((e) => e.owner === 0);
    if (mine.length) { cam.current.x = mine.reduce((s, e) => s + e.x, 0) / mine.length; cam.current.y = mine.reduce((s, e) => s + e.y, 0) / mine.length; }
  }, [sim]);

  /* 지형 그림 · 그림판 굽기 */
  useEffect(() => {
    const t = document.createElement("canvas"); t.width = map.width * TP9; t.height = map.height * TP9;
    const g = t.getContext("2d");
    if (g) drawMapGrid(g, map, terrainFace(terrain), TP9, false);
    terrImg.current = t;
    const m = document.createElement("canvas"); m.width = map.width * 2; m.height = map.height * 2;
    const mg = m.getContext("2d"); if (mg) drawMapGrid(mg, map, terrainFace(terrain), 2, false);
    miniImg.current = m;
    const names = Array.from(new Set(sim.ents.map((e) => e.def.name)));
    if (names.includes("Siege Tank")) names.push("Siege Tank (Siege Mode)");   // 시즈 모드 그림도 미리
    setToBake(names.length);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let n = 0;
    for (const nm of names) {
      if (sprites.current.has(nm)) { n += 1; setBaked(n); continue; }
      bakePracSprite9(nm, dpr, (s) => { sprites.current.set(nm, s); n += 1; setBaked(n); });
    }
  }, [map, terrain, sim]);
  useEffect(() => { if (loading && baked >= toBake) onReady(); }, [loading, baked, toBake, onReady]);

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
  const flash = (t: Ent9 | null): void => { if (t && t.def.name !== "Mineral Field") flashes.current.set(t.id, performance.now()); };

  /* ── 명령 ─────────────────────────────────────────────────── */
  const mySel = (): Ent9[] => selRef.current.map((id) => sim.byId.get(id)).filter((e): e is Ent9 => !!e && !e.dead && e.inside === null && e.owner === 0);
  const smart = (wx: number, wy: number, q: boolean): void => {
    const us = mySel(); if (!us.length) return;
    const t = sim.pick(wx, wy);
    flash(t);   // 우클릭이 유닛을 찍으면 그 고리가 깜빡인다(원작 sub_456490 → selectionTimer 31)
    const ids = us.map((e) => e.id);
    if (t && t.owner === 1 && t.def.name !== "Mineral Field") { sim.order(ids, { t: "attack", id: t.id }, q); return; }
    if (t && t.owner === 0 && t.def.cargo && !us.includes(t)) { sim.order(ids, { t: "load", id: t.id }, q); return; }
    if (t && t.owner === 0 && !t.def.cargo && t.def.slots) {
      const ships = us.filter((e) => e.def.cargo);
      if (ships.length) { sim.order([ships[0].id], { t: "pickup", id: t.id }, q); return; }
    }
    sim.order(ids, { t: "move", x: wx, y: wy }, q);
  };
  const doAct = (a: Act9, wx: number | null, wy: number | null, q: boolean): void => {
    const us = mySel(); const ids = us.map((e) => e.id);
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
    const t = sim.pick(wx, wy);
    if (t && (a === "attack" || a === "load" || a === "unload")) flash(t);
    if (a === "storm") { sim.order(us.filter((e) => e.def.name === "High Templar").map((e) => e.id), { t: "storm", x: wx, y: wy }, q); return; }
    if (a === "move") sim.order(ids, { t: "move", x: wx, y: wy }, q);
    else if (a === "attack") {
      if (t && t.owner === 1 && t.def.name !== "Mineral Field") sim.order(ids, { t: "attack", id: t.id }, q);
      else sim.order(ids, { t: "amove", x: wx, y: wy }, q);
    } else if (a === "unload") {
      const ships = us.filter((e) => e.def.cargo);
      /* 자기(고른) 수송선을 찍으면 낙하산 — 고른 수송선 모두가 가던 길에 한 기씩(위 ACTS9 ★). */
      if (t && ships.some((s) => s.id === t.id)) { sim.paradrop(ships.map((s) => s.id), q); return; }
      for (const s of ships) sim.order([s.id], { t: "moveunload", x: wx, y: wy }, q);
    } else if (a === "load") {
      if (t && t.owner === 0 && t.def.cargo) sim.order(ids.filter((id) => id !== t.id), { t: "load", id: t.id }, q);
      else if (t && t.owner === 0 && t.def.slots) { const s = us.find((e) => e.def.cargo); if (s) sim.order([s.id], { t: "pickup", id: t.id }, q); }
    }
  };

  /* ── 키 ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (loading) return undefined;
    const onDown = (e: KeyboardEvent): void => {
      const tg = e.target as HTMLElement | null;
      if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
      const k = keyOf9(e) ?? e.key;
      keysDown.current.add(e.key);
      if (k.startsWith("Arrow")) e.preventDefault();   // 화살표는 화면 이동 — 바깥 쪽이 같이 굴러가지 않게
      if (k === "Escape") { setMode(null); return; }
      if (/^[0-9]$/.test(k)) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) { groups.current[k] = [...selRef.current]; return; }
        if (e.shiftKey) { setSel((s) => Array.from(new Set([...s, ...(groups.current[k] ?? [])]))); return; }
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
      if (k === "F10" || k === "P") { setPaused((p) => !p); return; }
      const act = ACTS9.find((a) => keys[a.key] === k);
      if (act && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
  const gUp = (button: number, shift: boolean): void => {
    const m = mouse.current; if (!m.down || button !== 0) return;
    gMove();
    m.down = false;
    if (m.box) {
      const [ax, ay] = toWorld(Math.min(m.sx, m.x), Math.min(m.sy, m.y)); const [bx, by] = toWorld(Math.max(m.sx, m.x), Math.max(m.sy, m.y));
      const got = sim.alive().filter((u) => u.owner === 0 && !u.def.bld && u.x >= ax - u.def.rad && u.x <= bx + u.def.rad && u.y >= ay - u.def.rad && u.y <= by + u.def.rad).map((u) => u.id);
      setSel((s) => (shift ? Array.from(new Set([...s, ...got])) : got));
    } else {
      const [wx, wy] = toWorld(m.x, m.y);
      const t = sim.pick(wx, wy);
      if (!t) { if (!shift) setSel([]); }
      else if (shift && t.owner === 0) setSel((s) => (s.includes(t.id) ? s.filter((id) => id !== t.id) : [...s, t.id]));
      else setSel([t.id]);
    }
    m.box = false;
  };
  const gDbl = (): void => {
    gMove(); const [wx, wy] = toWorld(mouse.current.x, mouse.current.y);
    const t = sim.pick(wx, wy); if (!t || t.owner !== 0) return;
    const { w, h } = view(); const [ax, ay] = toWorld(0, 0); const [bx, by] = toWorld(w, h);
    setSel(sim.alive().filter((u) => u.owner === 0 && u.def.name === t.def.name && u.x >= ax && u.x <= bx && u.y >= ay && u.y <= by).map((u) => u.id));
  };
  const miniXY = (): [number, number] => {
    const w = wrapRef.current; const mc = miniRef.current; if (!w || !mc) return [0, 0];
    const a = w.getBoundingClientRect(); const r = mc.getBoundingClientRect();
    const fx = Math.max(0, Math.min(1, (cur.current.x - (r.left - a.left)) / r.width)); const fy = Math.max(0, Math.min(1, (cur.current.y - (r.top - a.top)) / r.height));
    return [fx * sim.W, fy * sim.H];
  };
  const miniDown = (button: number, shift: boolean): void => {
    const [wx, wy] = miniXY();
    if (button === 2) { if (modeRef.current) { doAct(modeRef.current, wx, wy, shift); setMode(null); } else smart(wx, wy, shift); return; }
    if (button !== 0) return;
    if (modeRef.current) { doAct(modeRef.current, wx, wy, shift); if (!shift) setMode(null); return; }
    cam.current.x = wx; cam.current.y = wy; clampCam(); miniDrag.current = true;   // 누른 채 끌면 화면이 따라온다(원작 미니맵)
  };
  /* 창 단위로 듣는다 — 커서가 캔버스를 벗어나도(가장자리 · 창 밖) 자리를 놓치지 않게. */
  useEffect(() => {
    if (loading) return undefined;
    const wrap = wrapRef.current; if (!wrap) return undefined;
    const fromEvent = (e: MouseEvent): void => {
      const c = cur.current;
      if (document.pointerLockElement === wrap) {   // lockedRef 는 pointerlockchange 가 와야 바뀐다 — 그 사이의 움직임도 갇힌 셈으로
        /* 갇힌 뒤 첫 움직임에 크롬이 엉뚱하게 큰 movementX 를 싣는 일이 있다 — 그 한 번은 버린다(커서가 끝으로 튀어 화면이 밀리던 것). */
        if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
        c.x = Math.max(0, Math.min(wrap.clientWidth - 1, c.x + e.movementX)); c.y = Math.max(0, Math.min(wrap.clientHeight - 1, c.y + e.movementY));
      } else {
        /* 갇히고 풀리는 틈에 브라우저가 (0, 0) 자리의 가짜 mousemove 를 쏘는 일이 있다 — 커서가 왼쪽 위 끝으로 튀어 화면이 밀리지 않게 버린다. */
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
      if (mouse.current.down) gUp(e.button, e.shiftKey);
      miniDrag.current = false;
      if (lockedRef.current && e.button === 0 && btnDown.current) {
        const b = btnDown.current; btnDown.current = null;
        if (underCursor()?.closest("button") === b) b.click();
      }
    };
    const onDbl = (e: MouseEvent): void => {
      const el = lockedRef.current ? underCursor() : (e.target as Element | null);
      if (el === cvRef.current) gDbl();
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
  /** 한 걸음 — 원작 UpdateMapScroll(키 먼저 · 아니면 가장자리 · 가속 단계 · 속도표). 가장자리면 그 방향을 돌려준다(커서 그림). */
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
  /** 가장자리 방향 — 갇힌 커서는 틀 끝 2 게임 px · 풀린 커서는 틀 안 끝 띠, 또는 창 밖으로 나간 마지막 자리가 끝 곁이면 그 쪽. */
  const edgeDir = (): [number, number] => {
    const w = wrapRef.current; if (!w) return [0, 0];
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
      if (!pausedRef.current) { acc += dt; while (acc >= PRAC_TICK_MS9) { sim.step(); acc -= PRAC_TICK_MS9; } }
      /* 화면 이동 — 원작 걸음(15.625ms 마다 · 위 SCROLL_ 머리말) */
      const sc = scr.current; sc.acc += dt;
      let k = 0; while (sc.acc >= SCROLL_MS9 && k < 30) { sc.acc -= SCROLL_MS9; scrollStep(); k += 1; }
      if (k === 30) sc.acc = 0;
      clampCam();
      draw();
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

  const draw = (): void => {
    const cv = cvRef.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth; const H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext("2d"); if (!g) return;
    clampCam();
    const { x: cx, y: cy, z } = cam.current;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    /* 원작 화면 밖(남는 띠)은 검게 — 그 안만 그린다. */
    const vx = (W - VIEW_W9 * z) / 2; const vy = (H - VIEW_H9 * z) / 2;
    g.save(); g.beginPath(); g.rect(vx, vy, VIEW_W9 * z, VIEW_H9 * z); g.clip();
    g.fillStyle = "#05060a"; g.fillRect(vx, vy, VIEW_W9 * z, VIEW_H9 * z);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cx * z), dpr * (H / 2 - cy * z));
    const ti = terrImg.current;
    if (ti) { g.imageSmoothingEnabled = true; g.drawImage(ti, 0, 0, sim.W, sim.H); }
    const [vx0, vy0] = toWorld(-80, -80); const [vx1, vy1] = toWorld(W + 80, H + 80);
    const vis = sim.alive().filter((u) => u.x >= vx0 && u.x <= vx1 && u.y >= vy0 && u.y <= vy1);
    const selSet = new Set(selRef.current);
    const ring = (u: Ent9): void => {
      g.beginPath(); g.ellipse(u.x, u.y + (u.def.air ? 0 : u.def.rad * 0.25), u.def.rad + 3, (u.def.rad + 3) * 0.62, 0, 0, Math.PI * 2);
      g.strokeStyle = u.owner === 0 ? "#4dff7a" : "#ff4a3a"; g.lineWidth = 1.6 / z; g.stroke();
    };
    const body = (u: Ent9): void => {
      const sp = sprites.current.get(u.def.name);
      const cell = sp ? sp.cells[u.owner][sp.dirs === 1 ? 0 : ((Math.round((u.face / (Math.PI * 2)) * sp.dirs) % sp.dirs) + sp.dirs) % sp.dirs] : null;
      if (cell && sp) {
        const s = sp.worldPx;
        /* 은신(다크) · 땅속 럴커는 원작처럼 비쳐 보인다(내 것). */
        g.globalAlpha = sim.cloaked(u) ? (u.burrowed ? 0.4 : 0.5) : u.hitT > 0 ? 0.75 : 1;
        g.drawImage(cell, u.x - s / 2, u.y - s / 2, s, s);
        g.globalAlpha = 1;
      } else {
        g.beginPath(); g.arc(u.x, u.y, u.def.rad, 0, Math.PI * 2);
        g.fillStyle = u.def.name === "Mineral Field" ? "#56c7ff" : PRAC_COLORS9[u.owner]; g.fill();
        g.fillStyle = "#fff"; g.font = `${Math.max(9, u.def.rad * 0.8)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(u.def.ko.slice(0, 2), u.x, u.y);
      }
      const hpMax = fp(u.def.hp); const shMax = fp(u.def.sh);
      if (u.def.name !== "Mineral Field" && (u.hp < hpMax || u.sh < shMax || selSet.has(u.id))) {
        const bw = Math.max(18, u.def.rad * 1.6); const by = u.y - u.def.rad - 8;
        g.fillStyle = "rgba(0,0,0,0.7)"; g.fillRect(u.x - bw / 2 - 1, by - 1, bw + 2, 5);
        const f = Math.max(0, u.hp) / hpMax;
        g.fillStyle = f > 0.6 ? "#3ce26a" : f > 0.3 ? "#f2c23c" : "#ff4a3a"; g.fillRect(u.x - bw / 2, by, bw * f, 3);
        if (shMax > 0) { g.fillStyle = "#57a9ff"; g.fillRect(u.x - bw / 2, by - 2, bw * (u.sh / shMax), 1.5); }
      }
      if (u.def.cargo && u.cargo.length) {
        const n = u.cargo.length;
        for (let i = 0; i < n; i += 1) { g.fillStyle = u.para ? "#ffd04a" : "#9be8ff"; g.fillRect(u.x - n * 3 + i * 6, u.y + u.def.rad + 2, 4, 4); }
      }
    };
    const ground = vis.filter((u) => !u.def.air).sort((a, b) => (a.def.bld === b.def.bld ? a.y - b.y : a.def.bld ? -1 : 1));
    /* 고리 — 고른 것 · 우클릭 대상 깜빡임(남은 값의 8 비트가 켜진 동안만 · 고른 것도 깜빡임 동안은 함께 꺼졌다 켜진다). */
    const nowMs = performance.now();
    const ringOn = (u: Ent9): boolean => {
      const t0 = flashes.current.get(u.id);
      if (t0 !== undefined) {
        const t = FLASH_FRAMES9 - 1 - Math.floor((nowMs - t0) / PRAC_TICK_MS9);
        if (t > 0) return (t & 8) !== 0;
        flashes.current.delete(u.id);
      }
      return selSet.has(u.id);
    };
    for (const u of ground) if (ringOn(u)) ring(u);
    for (const u of ground) body(u);
    /* 공중 — 그림자 뒤 몸 */
    const air = vis.filter((u) => u.def.air).sort((a, b) => a.y - b.y);
    for (const u of air) { g.beginPath(); g.ellipse(u.x + 8, u.y + 26, u.def.rad * 0.8, u.def.rad * 0.4, 0, 0, Math.PI * 2); g.fillStyle = "rgba(0,0,0,0.35)"; g.fill(); }
    for (const s of sim.shots) {
      g.strokeStyle = s.col; g.globalAlpha = Math.min(1, s.t / 3); g.lineWidth = 2 / z;
      g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke(); g.globalAlpha = 1;
    }
    for (const u of air) { if (ringOn(u)) ring(u); body(u); }
    /* 스캐럽 — 땅을 기는 작은 불씨. */
    for (const sc of sim.scarabs) { g.beginPath(); g.arc(sc.x, sc.y, 3, 0, Math.PI * 2); g.fillStyle = "#ffb347"; g.fill(); }
    /* 스톰 — 반지름 48 의 푸른 번개 마당(남은 시간만큼 옅어진다). */
    for (const st of sim.storms) {
      const k = Math.max(0, st.life) / 56;
      g.beginPath(); g.arc(st.x, st.y, 48, 0, Math.PI * 2);
      g.fillStyle = `rgba(90, 140, 255, ${0.18 + 0.22 * k})`; g.fill();
      g.strokeStyle = `rgba(190, 215, 255, ${0.5 + 0.4 * k})`; g.lineWidth = 1.5 / z; g.stroke();
      g.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a0 = ((st.life * 0.9 + i * 61) % 360) * (Math.PI / 180); const r0 = 8 + ((i * 17 + st.life * 3) % 36);
        g.moveTo(st.x + Math.cos(a0) * r0, st.y + Math.sin(a0) * r0);
        g.lineTo(st.x + Math.cos(a0 + 0.6) * (r0 * 0.5), st.y + Math.sin(a0 + 0.6) * (r0 * 0.5));
      }
      g.strokeStyle = "rgba(230, 240, 255, 0.85)"; g.lineWidth = 1.2 / z; g.stroke();
    }
    /* 스톰 겨눔 — 자리를 기다리는 동안 마우스 자리에 반지름 48 고리. */
    if (modeRef.current === "storm" && mouse.current.in) {
      const [mx, my] = toWorld(mouse.current.x, mouse.current.y);
      g.beginPath(); g.arc(mx, my, 48, 0, Math.PI * 2); g.strokeStyle = "rgba(140, 190, 255, 0.9)"; g.lineWidth = 1.5 / z; g.stroke();
    }
    for (const b of sim.booms) {
      const k = 1 - b.t / 24;
      g.beginPath(); g.arc(b.x, b.y, b.r * (0.5 + k), 0, Math.PI * 2);
      g.fillStyle = `rgba(255, ${Math.round(170 - 120 * k)}, 60, ${Math.max(0, 0.7 - k * 0.7)})`; g.fill();
    }
    /* 예약된 길 — 고른 내 유닛 */
    g.setLineDash([6 / z, 6 / z]); g.lineWidth = 1.2 / z;
    for (const u of mySel()) {
      if (!u.orders.length) continue;
      g.beginPath(); g.moveTo(u.x, u.y);
      for (const o of u.orders) {
        if (o.t === "move" || o.t === "amove" || (o.t === "moveunload" && !o.self)) { g.lineTo(o.x, o.y); }
      }
      g.strokeStyle = u.def.cargo ? "rgba(255,210,74,0.75)" : "rgba(120,255,140,0.6)"; g.stroke();
      for (const o of u.orders) if (o.t === "moveunload" && !o.self) { g.beginPath(); g.arc(o.x, o.y, 10, 0, Math.PI * 2); g.strokeStyle = "rgba(255,210,74,0.9)"; g.stroke(); }
    }
    g.setLineDash([]);
    g.restore();
    /* 상자 */
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = mouse.current;
    if (m.down && m.box) { g.strokeStyle = "#4dff7a"; g.lineWidth = 1; g.strokeRect(Math.min(m.sx, m.x) + 0.5, Math.min(m.sy, m.y) + 0.5, Math.abs(m.x - m.sx), Math.abs(m.y - m.sy)); }
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
      if (u.def.name === "Mineral Field") continue;
      g.fillStyle = u.owner === 0 ? "#4d8dff" : "#ff4a3a";
      const r = Math.max(1.5, u.def.rad * k * (u.def.bld ? 1 : 1.4));
      g.fillRect(u.x * k - r, u.y * k - r, r * 2, r * 2);
    }
    const { w, h } = view(); const [ax, ay] = toWorld(0, 0); const [bx, by] = toWorld(w, h);
    g.strokeStyle = "#fff"; g.lineWidth = Math.max(1, dpr); g.strokeRect(ax * k, ay * k, (bx - ax) * k, (by - ay) * k);
  };

  /* ── 화물 칸 그림 — 그림판의 정면 칸(아래 보기)을 잉크 상자로 잘라 체력색으로 물들인다(재생기 인포창의 실루엣과 같은 결) ── */
  const icons = useRef(new Map<string, string>());
  const iconOf = (name: string, col: string): string | null => {
    const key = `${name}|${col}`; const hit = icons.current.get(key); if (hit) return hit;
    const sp = sprites.current.get(name); const cell = sp?.cells[0][sp.dirs === 1 ? 0 : Math.round(sp.dirs / 4)];
    if (!cell) return null;
    const w = cell.width; const h = cell.height; const g0 = cell.getContext("2d"); if (!g0) return null;
    const px = g0.getImageData(0, 0, w, h).data;
    let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (px[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const side = Math.max(x1 - x0, y1 - y0) + 4; const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const g = c.getContext("2d"); if (!g) return null;
    const k = 60 / side; const dw = (x1 - x0 + 1) * k; const dh = (y1 - y0 + 1) * k;
    g.drawImage(cell, x0, y0, x1 - x0 + 1, y1 - y0 + 1, (64 - dw) / 2, (64 - dh) / 2, dw, dh);
    g.globalCompositeOperation = "screen"; g.fillStyle = "rgba(90, 90, 90, 1)"; g.fillRect(0, 0, 64, 64);
    g.globalCompositeOperation = "color"; g.fillStyle = col; g.fillRect(0, 0, 64, 64);
    g.globalCompositeOperation = "destination-in"; g.drawImage(cell, x0, y0, x1 - x0 + 1, y1 - y0 + 1, (64 - dw) / 2, (64 - dh) / 2, dw, dh);
    const url = c.toDataURL(); icons.current.set(key, url); return url;
  };

  /* ── 고른 것 · 화물 ───────────────────────────────────────── */
  void hud;
  const selUnits = sel.map((id) => sim.byId.get(id)).filter((e): e is Ent9 => !!e && !e.dead && e.inside === null);
  const ships = selUnits.filter((e) => e.owner === 0 && e.def.cargo);
  const st = sim.stats;
  return (
    <div className={`scr-prac-game${locked ? " is-locked" : ""}`} ref={wrapRef}>
      <canvas ref={cvRef} className="scr-prac-canvas" onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: mode ? "crosshair" : "default" }} />
      {/* 갇힌 동안의 커서(원작은 커서가 창 안에 갇혀 있다) — 보통 화살 · 겨눔 · 가장자리 스크롤 화살 */}
      <div ref={curEl} className="scr-prac-cursor" data-k="arrow" aria-hidden>
        <svg className="is-arrow" width="18" height="24" viewBox="0 0 18 24"><path d="M1 1 L1 19 L6 14 L10 23 L13 22 L9 13 L16 13 Z" fill="#7dff8f" stroke="#04210a" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        <svg className="is-scroll" width="22" height="22" viewBox="0 0 22 22"><path d="M21 11 L8 2 L8 7 L1 7 L1 15 L8 15 L8 20 Z" fill="#7dff8f" stroke="#04210a" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        <svg className="is-aim" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="8" fill="none" stroke="#ffd04a" strokeWidth="2" /><path d="M13 0 V8 M13 18 V26 M0 13 H8 M18 13 H26" stroke="#ffd04a" strokeWidth="2" /></svg>
      </div>
      <div className="scr-prac-top">
        <b>{fmtTime9(st.tick)}</b>
        <span>일꾼 <b>{st.workers}</b>/50</span>
        <span>방어 <b>{st.defense}</b></span>
        <span>건물 <b>{st.buildings}</b></span>
        <span className="is-loss">손실 <b>{st.lost}</b></span>
        {mode && <span className="scr-prac-mode">{ACTS9.find((a) => a.key === mode)?.label} — 자리를 누르세요(Esc 취소)</span>}
        {!locked && !mode && <span className="scr-prac-dim">게임 화면을 누르면 마우스가 화면 안에 갇혀요(원작처럼 가장자리 스크롤) · Esc 로 풀기</span>}
        <span className="scr-prac-sp" />
        <button type="button" onClick={() => setPaused((p) => !p)}>{paused ? "계속" : "멈춤"}</button>
        <button type="button" onClick={onRestart}>다시</button>
        <button type="button" onClick={onSetup}>설정</button>
      </div>
      <div className="scr-prac-bottom">
        <canvas ref={miniRef} className="scr-prac-mini" onContextMenu={(e) => e.preventDefault()} />
        <div className="scr-prac-selbox">
          {selUnits.length === 0 && <span className="scr-prac-dim">유닛을 고르세요 — 수송선을 고르면 화물 칸이 보여요(칸을 누르면 그 한 기만 내림)</span>}
          {ships.length > 0 && ships.slice(0, 6).map((s) => (
            <div key={s.id} className="scr-prac-ship">
              <span className="scr-prac-shipname">{s.def.ko}{s.para ? " · 낙하산" : ""}</span>
              {/* ★ 화물 칸 — 글자 대신 **모델**(2026-11-17, 요청: "수송선 안의 유닛 글자말고 모델로 인포창처럼") — 재생기 인포창의 짐칸과 같은 꼴:
                  4칸 격자 · 칸이 수송 공간만큼(2 = 1×2 · 4 = 2×2) · 그림은 체력색으로 물들인 모델 실루엣 · 남는 자리는 빈 칸. 칸을 누르면 그 한 기만 지금 자리에 내린다. */}
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
          {ships.length === 0 && selUnits.length > 0 && (
            <div className="scr-prac-sellist">
              {Object.entries(selUnits.reduce<Record<string, number>>((m, u) => { m[u.def.ko] = (m[u.def.ko] ?? 0) + 1; return m; }, {})).map(([n, c]) => (
                <span key={n} className={`scr-prac-chip${selUnits[0].owner === 1 ? " is-foe" : ""}`}>{n} ×{c}{(() => {
                  /* 에너지(하템 · 메딕) — 스톰 75 를 셀 수 있게 기마다. */
                  const en = selUnits.filter((u) => u.def.ko === n && sim.maxEnergy(u.def) > 0).map((u) => Math.floor(u.en / 256));
                  return en.length ? ` · 에너지 ${en.join("/")}` : "";
                })()}</span>
              ))}
            </div>
          )}
        </div>
        <div className="scr-prac-cmds">
          {ACTS9.map((a) => (
            <button key={a.key} type="button" title={a.hint} className={`scr-prac-cmd${mode === a.key ? " is-on" : ""}`}
              onClick={() => { if (INSTANT9.has(a.key)) doAct(a.key, null, null, false); else setMode(a.key); }}>
              <b>{keys[a.key]}</b>{a.label}
            </button>
          ))}
        </div>
      </div>
      {loading && <div className="scr-prac-loading">유닛 그림 굽는 중… {baked}/{toBake}</div>}
    </div>
  );
}
