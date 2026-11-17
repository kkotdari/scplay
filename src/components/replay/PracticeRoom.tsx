/* ★★ 수송선 드랍 연습실 화면(2026-11-17 · practiceSim9 ★ 머리말의 요청) — 설정 → 그림 굽기 → 놀이.
   조작은 원작 손버릇을 따른다: 왼클릭 고르기 · 끌어 상자 · Shift 더하기 · 오른클릭 알아서(적 → 공격 · 내 수송선 → 타기 · 수송선이 내 유닛 → 태우기 · 땅 → 이동) ·
   Shift + 오른클릭 · Shift + 명령은 예약 · Ctrl + 숫자 부대 지정 · 숫자 부대 부르기(두 번이면 화면 이동) · 화살표 · 화면 가장자리 · 미니맵으로 화면 이동 · 휠 확대.
   명령 키(이동 · 공격 · 정지 · 홀드 · 하차 · 낙하산 · 태우기)는 설정에서 바꾼다(기기에 기억). 하차(U) 다음 땅을 누르면 그 자리로 가서 다 내리고, 수송선 자기를 누르면 그 자리에서 내린다.
   낙하산(D)은 가던 길을 멈추지 않고 한 기씩 떨군다 — Shift + 오른클릭으로 이어 갈 길을 예약해 두면 내리면서 그대로 간다. 화물 칸을 누르면 그 한 기만 지금 자리에 내린다. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayMapGrid } from "./mapGrid";
import { decodeMapTerrain, terrainFace, type MapTerrain } from "../../utils/mapTerrain";
import { drawMapGrid } from "../../utils/mapTiles";
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

type Act9 = "move" | "attack" | "stop" | "hold" | "unload" | "para" | "load";
const ACTS9: { key: Act9; label: string; def: string; hint: string }[] = [
  { key: "move", label: "이동", def: "M", hint: "다음 클릭 자리로 이동(적을 무시)" },
  { key: "attack", label: "공격", def: "A", hint: "다음 클릭 — 적이면 그 적 · 땅이면 가며 싸우기" },
  { key: "stop", label: "정지", def: "S", hint: "하던 일과 예약을 모두 멈춘다" },
  { key: "hold", label: "홀드", def: "H", hint: "그 자리에서 사거리 안만 쏜다" },
  { key: "unload", label: "하차", def: "U", hint: "다음 클릭 자리로 가서 다 내린다(수송선 자기를 누르면 그 자리)" },
  { key: "para", label: "낙하산", def: "D", hint: "멈추지 않고 가던 길에 한 기씩 떨군다(Shift + 오른클릭으로 이어 갈 길 예약)" },
  { key: "load", label: "태우기", def: "L", hint: "다음 클릭한 수송선에 탄다(수송선은 클릭한 유닛을 태운다)" },
];
const KEYS_LS9 = "scr.prac.keys";
const SETUP_LS9 = "scr.prac.setup";
const loadJson9 = <T,>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? { ...fb, ...JSON.parse(v) } : fb; } catch { return fb; } };
const saveJson9 = (k: string, v: unknown): void => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 사생활 모드 */ } };
const DEF_KEYS9 = Object.fromEntries(ACTS9.map((a) => [a.key, a.def])) as Record<Act9, string>;
const DEF_SETUP9: PracSetup9 = { myRace: "T", foeRace: "P", ships: 4, cargo: { Marine: 16, Medic: 8, Firebat: 0, Ghost: 0, Vulture: 0, Goliath: 0, "Siege Tank": 0 }, mySpot: "BL", foeSpot: "TR" };
const TP9 = 24;   // 지형 그림 칸(px/타일)

const fmtTime9 = (tick: number): string => { const s = Math.floor(tick / 24); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

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
      const k = e.key.length === 1 ? e.key.toUpperCase() : null;
      if (!k || !/^[A-Z0-9]$/.test(k)) return;
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
    cargo: Object.fromEntries(CARGO_UNITS9[r].map((n, i) => [n, s.myRace === r ? (s.cargo[n] ?? 0) : i === 0 ? Math.min(16, s.ships * 4) : 0])),
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
      <p className="scr-prac-dim">왼클릭 고르기 · 끌어 상자 · 오른클릭 알아서(적 공격 · 수송선 타기 · 이동) · Shift 예약 · Ctrl+숫자 부대 · 화살표/가장자리/미니맵 화면 이동 · 휠 확대 · Esc 취소</p>
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
  const camDbg = useRef({ x: 0, y: 0, z: 0.8 });
  useEffect(() => { const w = window as unknown as { __pracDebug?: boolean; __pracSim?: PracticeSim9; __pracCam?: unknown }; if (w.__pracDebug) { w.__pracSim = sim; w.__pracCam = camDbg.current; } }, [sim]);
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
  const toWorld = (sx: number, sy: number): [number, number] => {
    const { w, h } = view(); const { x, y, z } = cam.current;
    return [x + (sx - w / 2) / z, y + (sy - h / 2) / z];
  };
  const clampCam = (): void => {
    const { w, h } = view(); const c = cam.current;
    const hw = w / 2 / c.z; const hh = h / 2 / c.z;
    c.x = Math.max(Math.min(hw, sim.W / 2), Math.min(Math.max(sim.W - hw, sim.W / 2), c.x));
    c.y = Math.max(Math.min(hh, sim.H / 2), Math.min(Math.max(sim.H - hh, sim.H / 2), c.y));
  };

  /* ── 명령 ─────────────────────────────────────────────────── */
  const mySel = (): Ent9[] => selRef.current.map((id) => sim.byId.get(id)).filter((e): e is Ent9 => !!e && !e.dead && e.inside === null && e.owner === 0);
  const smart = (wx: number, wy: number, q: boolean): void => {
    const us = mySel(); if (!us.length) return;
    const t = sim.pick(wx, wy);
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
    if (a === "hold") { sim.order(ids, { t: "hold" }, false); return; }
    if (a === "para") { sim.paradrop(ids); return; }
    if (wx === null || wy === null) { setMode(a); return; }
    const t = sim.pick(wx, wy);
    if (a === "move") sim.order(ids, { t: "move", x: wx, y: wy }, q);
    else if (a === "attack") {
      if (t && t.owner === 1 && t.def.name !== "Mineral Field") sim.order(ids, { t: "attack", id: t.id }, q);
      else sim.order(ids, { t: "amove", x: wx, y: wy }, q);
    } else if (a === "unload") {
      const ships = us.filter((e) => e.def.cargo);
      for (const s of ships) {
        const here = t && t.id === s.id;
        sim.order([s.id], { t: "unload", x: here ? s.x : wx, y: here ? s.y : wy }, q);
      }
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
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
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
        if (act.key === "stop" || act.key === "hold" || act.key === "para") doAct(act.key, null, null, e.shiftKey);
        else setMode(act.key);
      }
    };
    const onUp = (e: KeyboardEvent): void => { keysDown.current.delete(e.key); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, keys, sim]);

  /* ── 마우스 ───────────────────────────────────────────────── */
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const r = e.currentTarget.getBoundingClientRect(); const sx = e.clientX - r.left; const sy = e.clientY - r.top;
    const [wx, wy] = toWorld(sx, sy);
    if (e.button === 2) {
      e.preventDefault();
      if (modeRef.current) { setMode(null); return; }
      smart(wx, wy, e.shiftKey); return;
    }
    if (e.button !== 0) return;
    if (modeRef.current) { doAct(modeRef.current, wx, wy, e.shiftKey); if (!e.shiftKey) setMode(null); return; }
    mouse.current = { ...mouse.current, down: true, sx, sy, box: false };
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const r = e.currentTarget.getBoundingClientRect(); const m = mouse.current;
    m.x = e.clientX - r.left; m.y = e.clientY - r.top; m.in = true;
    if (m.down && (Math.abs(m.x - m.sx) > 5 || Math.abs(m.y - m.sy) > 5)) m.box = true;
  };
  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const m = mouse.current; if (!m.down || e.button !== 0) return;
    m.down = false;
    if (m.box) {
      const [ax, ay] = toWorld(Math.min(m.sx, m.x), Math.min(m.sy, m.y)); const [bx, by] = toWorld(Math.max(m.sx, m.x), Math.max(m.sy, m.y));
      const got = sim.alive().filter((u) => u.owner === 0 && !u.def.bld && u.x >= ax - u.def.rad && u.x <= bx + u.def.rad && u.y >= ay - u.def.rad && u.y <= by + u.def.rad).map((u) => u.id);
      setSel((s) => (e.shiftKey ? Array.from(new Set([...s, ...got])) : got));
    } else {
      const [wx, wy] = toWorld(m.x, m.y);
      const t = sim.pick(wx, wy);
      if (!t) { if (!e.shiftKey) setSel([]); }
      else if (e.shiftKey && t.owner === 0) setSel((s) => (s.includes(t.id) ? s.filter((id) => id !== t.id) : [...s, t.id]));
      else setSel([t.id]);
    }
    m.box = false;
  };
  const onDouble = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const r = e.currentTarget.getBoundingClientRect(); const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
    const t = sim.pick(wx, wy); if (!t || t.owner !== 0) return;
    const { w, h } = view(); const [ax, ay] = toWorld(0, 0); const [bx, by] = toWorld(w, h);
    setSel(sim.alive().filter((u) => u.owner === 0 && u.def.name === t.def.name && u.x >= ax && u.x <= bx && u.y >= ay && u.y <= by).map((u) => u.id));
  };
  /* 휠 확대 — 바깥 쪽(앱 화면)이 함께 굴러가지 않게 native 로 막는다(React 의 onWheel 은 passive 라 못 막는다). */
  useEffect(() => {
    const c = cvRef.current; if (!c) return undefined;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const cm = cam.current; cm.z = Math.max(0.45, Math.min(1.6, cm.z * (e.deltaY > 0 ? 0.9 : 1.1))); clampCam();
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim]);
  const miniAt = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * sim.W, ((e.clientY - r.top) / r.height) * sim.H];
  };
  const onMini = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const [wx, wy] = miniAt(e);
    if (e.button === 2) { e.preventDefault(); if (modeRef.current) { doAct(modeRef.current, wx, wy, e.shiftKey); setMode(null); } else smart(wx, wy, e.shiftKey); return; }
    if (modeRef.current) { doAct(modeRef.current, wx, wy, e.shiftKey); if (!e.shiftKey) setMode(null); return; }
    cam.current.x = wx; cam.current.y = wy; clampCam();
  };

  /* ── 돌리기 · 그리기 ───────────────────────────────────────── */
  useEffect(() => {
    if (loading) return undefined;
    let raf = 0; let last = performance.now(); let acc = 0; let hudT = 0;
    const loop = (now: number): void => {
      const dt = Math.min(250, now - last); last = now;
      if (!pausedRef.current) { acc += dt; while (acc >= PRAC_TICK_MS9) { sim.step(); acc -= PRAC_TICK_MS9; } }
      /* 화면 이동 — 화살표 · 가장자리 */
      const c = cam.current; const kd = keysDown.current; const m = mouse.current; const { w, h } = view();
      const sp = (900 * dt) / 1000 / c.z;
      if (kd.has("ArrowLeft") || (m.in && m.x < 8)) c.x -= sp;
      if (kd.has("ArrowRight") || (m.in && m.x > w - 8)) c.x += sp;
      if (kd.has("ArrowUp") || (m.in && m.y < 8)) c.y -= sp;
      if (kd.has("ArrowDown") || (m.in && m.y > h - 8)) c.y += sp;
      clampCam();
      draw();
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
    const { x: cx, y: cy, z } = cam.current;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#05060a"; g.fillRect(0, 0, W, H);
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
        if (u.hitT > 0) g.globalAlpha = 0.75;
        g.drawImage(cell, u.x - s / 2, u.y - s / 2, s, s);
        g.globalAlpha = 1;
      } else {
        g.beginPath(); g.arc(u.x, u.y, u.def.rad, 0, Math.PI * 2);
        g.fillStyle = u.def.name === "Mineral Field" ? "#56c7ff" : PRAC_COLORS9[u.owner]; g.fill();
        g.fillStyle = "#fff"; g.font = `${Math.max(9, u.def.rad * 0.8)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(u.def.ko.slice(0, 2), u.x, u.y);
      }
      const max = u.def.hp + u.def.sh;
      if (u.def.name !== "Mineral Field" && (u.hp + u.sh < max - 0.5 || selSet.has(u.id))) {
        const bw = Math.max(18, u.def.rad * 1.6); const by = u.y - u.def.rad - 8;
        g.fillStyle = "rgba(0,0,0,0.7)"; g.fillRect(u.x - bw / 2 - 1, by - 1, bw + 2, 5);
        const f = Math.max(0, u.hp) / u.def.hp;
        g.fillStyle = f > 0.6 ? "#3ce26a" : f > 0.3 ? "#f2c23c" : "#ff4a3a"; g.fillRect(u.x - bw / 2, by, bw * f, 3);
        if (u.def.sh > 0) { g.fillStyle = "#57a9ff"; g.fillRect(u.x - bw / 2, by - 2, bw * (u.sh / u.def.sh), 1.5); }
      }
      if (u.def.cargo && u.cargo.length) {
        const n = u.cargo.length;
        for (let i = 0; i < n; i += 1) { g.fillStyle = u.para ? "#ffd04a" : "#9be8ff"; g.fillRect(u.x - n * 3 + i * 6, u.y + u.def.rad + 2, 4, 4); }
      }
    };
    const ground = vis.filter((u) => !u.def.air).sort((a, b) => (a.def.bld === b.def.bld ? a.y - b.y : a.def.bld ? -1 : 1));
    for (const u of ground) if (selSet.has(u.id)) ring(u);
    for (const u of ground) body(u);
    /* 공중 — 그림자 뒤 몸 */
    const air = vis.filter((u) => u.def.air).sort((a, b) => a.y - b.y);
    for (const u of air) { g.beginPath(); g.ellipse(u.x + 8, u.y + 26, u.def.rad * 0.8, u.def.rad * 0.4, 0, 0, Math.PI * 2); g.fillStyle = "rgba(0,0,0,0.35)"; g.fill(); }
    for (const s of sim.shots) {
      g.strokeStyle = s.col; g.globalAlpha = Math.min(1, s.t / 3); g.lineWidth = 2 / z;
      g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke(); g.globalAlpha = 1;
    }
    for (const u of air) { if (selSet.has(u.id)) ring(u); body(u); }
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
        if (o.t === "move" || o.t === "amove" || o.t === "unload") { g.lineTo(o.x, o.y); }
      }
      g.strokeStyle = u.def.cargo ? "rgba(255,210,74,0.75)" : "rgba(120,255,140,0.6)"; g.stroke();
      for (const o of u.orders) if (o.t === "unload") { g.beginPath(); g.arc(o.x, o.y, 10, 0, Math.PI * 2); g.strokeStyle = "rgba(255,210,74,0.9)"; g.stroke(); }
    }
    g.setLineDash([]);
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

  /* ── 고른 것 · 화물 ───────────────────────────────────────── */
  void hud;
  const selUnits = sel.map((id) => sim.byId.get(id)).filter((e): e is Ent9 => !!e && !e.dead && e.inside === null);
  const ships = selUnits.filter((e) => e.owner === 0 && e.def.cargo);
  const st = sim.stats;
  return (
    <div className="scr-prac-game" ref={wrapRef}>
      <canvas ref={cvRef} className="scr-prac-canvas" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={() => { mouse.current.in = false; mouse.current.down = false; mouse.current.box = false; }}
        onDoubleClick={onDouble} onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: mode ? "crosshair" : "default" }} />
      <div className="scr-prac-top">
        <b>{fmtTime9(st.tick)}</b>
        <span>일꾼 <b>{st.workers}</b>/50</span>
        <span>방어 <b>{st.defense}</b></span>
        <span>건물 <b>{st.buildings}</b></span>
        <span className="is-loss">손실 <b>{st.lost}</b></span>
        {mode && <span className="scr-prac-mode">{ACTS9.find((a) => a.key === mode)?.label} — 자리를 누르세요(Esc 취소)</span>}
        <span className="scr-prac-sp" />
        <button type="button" onClick={() => setPaused((p) => !p)}>{paused ? "계속" : "멈춤"}</button>
        <button type="button" onClick={onRestart}>다시</button>
        <button type="button" onClick={onSetup}>설정</button>
      </div>
      <div className="scr-prac-bottom">
        <canvas ref={miniRef} className="scr-prac-mini" onMouseDown={onMini} onContextMenu={(e) => e.preventDefault()} />
        <div className="scr-prac-selbox">
          {selUnits.length === 0 && <span className="scr-prac-dim">유닛을 고르세요 — 수송선을 고르면 화물 칸이 보여요(칸을 누르면 그 한 기만 내림)</span>}
          {ships.length > 0 && ships.slice(0, 6).map((s) => (
            <div key={s.id} className="scr-prac-ship">
              <span className="scr-prac-shipname">{s.def.ko}{s.para ? " · 낙하산" : ""}</span>
              <span className="scr-prac-slots">
                {s.cargo.map((id) => { const u = sim.byId.get(id); return u ? (
                  <button key={id} type="button" className={`scr-prac-slot is-s${u.def.slots}`} title={`${u.def.ko} — 눌러서 지금 내리기`} onClick={() => sim.unloadOne(s.id, id)}>{u.def.ko.slice(0, 2)}</button>
                ) : null; })}
                <i className="scr-prac-free">{8 - sim.usedSlots(s)}칸 남음</i>
              </span>
            </div>
          ))}
          {ships.length === 0 && selUnits.length > 0 && (
            <div className="scr-prac-sellist">
              {Object.entries(selUnits.reduce<Record<string, number>>((m, u) => { m[u.def.ko] = (m[u.def.ko] ?? 0) + 1; return m; }, {})).map(([n, c]) => (
                <span key={n} className={`scr-prac-chip${selUnits[0].owner === 1 ? " is-foe" : ""}`}>{n} ×{c}</span>
              ))}
            </div>
          )}
        </div>
        <div className="scr-prac-cmds">
          {ACTS9.map((a) => (
            <button key={a.key} type="button" title={a.hint} className={`scr-prac-cmd${mode === a.key ? " is-on" : ""}`}
              onClick={() => { if (a.key === "stop" || a.key === "hold" || a.key === "para") doAct(a.key, null, null, false); else setMode(a.key); }}>
              <b>{keys[a.key]}</b>{a.label}
            </button>
          ))}
        </div>
      </div>
      {loading && <div className="scr-prac-loading">유닛 그림 굽는 중… {baked}/{toBake}</div>}
    </div>
  );
}
