/* 프레임 워커(요청: "워커 분리 — 한 번에 최고 효과로") ─────────────────────────────────────────
 *  재생기의 셈(개체·건물 op·효과·안개)을 **딴 스레드에서 미리** 돌려 프레임을 쌓아 둔다. 메인
 *  스레드에는 붓(캔버스 그리기)과 React만 남는다.
 *
 *  통신 규약(메인 → 워커)
 *    world  { entData, truth, grid, bases, teamMap, total }   참값·지도·기지 — 경기마다 한 번.
 *    view   { view: EngineView9 }                            상자 크기·기울기·시점·색·품질 — 바뀔 때.
 *    clock  { t, speed, playing }                            재생 시계 — 프레임마다(값이 바뀔 때).
 *  (워커 → 메인)
 *    ready                                                   세계를 받아 엔진을 세웠다.
 *    frame  { frame: Frame9 }                                시각 t의 프레임 하나.
 *    err    { message }                                      셈이 던졌다 — 메인은 제 엔진으로 물러난다.
 *
 *  박자: 시계 t에서 앞으로 AHEAD_SEC(게임 시각)까지, 한 프레임 = speed/FPS9 초씩 미리 짓는다.
 *  시계가 뛰면(탐색·배속 변경) 엔진 상태(발사 위상·조준 고정 같은 기억)를 비우고 그 자리부터 다시.
 *  잠깐 멈춤(playing=false)이면 그 시각의 프레임 하나만 지어 둔다.
 *
 *  ⚠ 이 파일은 ReplayMotionPlayer 모듈을 통째로 끌어온다(엔진이 그 안의 표·헬퍼를 쓴다). React도
 *    함께 묶이지만 모듈을 읽기만 할 뿐 DOM은 안 만진다 — 워커에서 `document`를 만지는 줄이 생기면
 *    여기서 던지고, 메인은 err를 받아 제 엔진으로 물러난다(화면은 안 죽는다). */
import {
  createEngine9, deriveWorld9, type EngineView9, type EngineWorld9, type Frame9,
} from "./ReplayMotionPlayer";
import type { TruthTracks } from "../../utils/openbwTracks";
import type { TruthWorld } from "../../utils/truthLives";

const FPS9 = 30;
const AHEAD_SEC = 1.0;

type WorldMsg = {
  type: "world"; entData: TruthWorld | null; truth: TruthTracks | null;
  grid: { width: number; height: number; resources?: [number, number, 0 | 1][] };
  bases: { key: string; race?: string }[]; teamMap: Record<string, 1 | 2>; total: number;
};
type ViewMsg = { type: "view"; view: EngineView9 };
type ClockMsg = { type: "clock"; t: number; speed: number; playing: boolean };
type Msg = WorldMsg | ViewMsg | ClockMsg;

let world: EngineWorld9 | null = null;
let view: EngineView9 | null = null;
let engine: ReturnType<typeof createEngine9> | null = null;
let clock: { t: number; speed: number; playing: boolean } = { t: 0, speed: 1, playing: false };
/** 다음에 지을 프레임의 시각. 음수면 아직 없다. */
let nextT = -1;
/** 지어 둔 프레임의 마지막 시각 — 멈춤 상태에서 같은 t를 두 번 안 짓게. */
let lastBuiltT = -1;
/** 지어 둔 창의 **시작** 시각 — 되감기 판정은 이것과 견준다(lastBuiltT는 창의 끝이다). */
let winStartT = -1;
/** 미뤄 둔 pump 타이머(0이면 없음). */
let pumpTimer = 0;

const post = (m: unknown): void => { (self as unknown as Worker).postMessage(m); };

const rebuildEngine = (): void => {
  if (!world || !view) return;
  engine = createEngine9(world, view);
  nextT = -1;
  lastBuiltT = -1;
  winStartT = -1;
};

const pump = (): void => {
  if (!engine) return;
  const step = Math.max(1 / 240, clock.speed / FPS9);
  /* 시계가 **지어 둔 창 밖**으로 나갔나 — 뒤로 감았거나(behind) 창 끝을 넘어 앞으로 뛰었거나(ahead).
     (전에는 nextT와 견줬는데 nextT는 늘 1초 앞서 있어 매 시계마다 '뛰었다'가 되어 같은 구간을 되풀이해
     지었다 — 10초에 5,900장. 창은 [마지막 지은 시각, nextT]다.) */
  const behind = winStartT >= 0 && clock.t < winStartT - step * 2;
  const ahead = nextT < 0 || clock.t > nextT + step * 2;
  if (behind || ahead) {
    engine.reset();
    nextT = clock.t;
    winStartT = clock.t;
    lastBuiltT = -1;
  }
  if (!clock.playing) {
    // 멈춤: 그 시각의 프레임이 창 안에 없을 때만 한 장.
    const have = winStartT >= 0 && clock.t >= winStartT - step * 1.5 && clock.t <= nextT;
    if (!have) {
      const f = engine.build(clock.t);
      lastBuiltT = clock.t;
      winStartT = clock.t;
      post({ type: "frame", frame: f });
      nextT = clock.t + step;
    }
    return;
  }
  /* 한 번에 여덟 장까지만 짓고 한숨 돌린다(setTimeout 0) — 그 사이에 온 시계·시점 메시지가 먼저 처리되어,
     탐색 직후 옛 자리의 프레임을 계속 짓는 일이 없다. */
  const until = clock.t + AHEAD_SEC * clock.speed;
  let n = 0;
  while (nextT <= until && n < 8) {
    const f = engine.build(nextT);
    lastBuiltT = nextT;
    post({ type: "frame", frame: f });
    nextT += step;
    n += 1;
  }
  if (nextT <= until) {
    if (pumpTimer !== 0) clearTimeout(pumpTimer);
    pumpTimer = setTimeout(() => { pumpTimer = 0; pump(); }, 0) as unknown as number;
  }
};

/* 워커 안에서만 귀를 연다 — 도구 번들이 이 모듈을 보통 모듈로 묶어 메인에서 읽을 때는 아무 일도 않는다. */
const inWorker9 = typeof document === "undefined" && typeof self !== "undefined";
if (inWorker9) self.onmessage = (ev: MessageEvent<Msg>): void => {
  const m = ev.data;
  try {
    if (m.type === "world") {
      const teamMap = m.teamMap;
      world = deriveWorld9({
        entData: m.entData, truth: m.truth, grid: m.grid, bases: m.bases,
        teamOf: (raw: string) => teamMap[raw], total: m.total,
      });
      rebuildEngine();
      post({ type: "ready" });
      pump();
    } else if (m.type === "view") {
      view = m.view;
      if (engine) engine.setView(view); else rebuildEngine();
      // 시점·색이 바뀌면 지어 둔 프레임은 옛 것이다 — 이 시각부터 다시.
      nextT = -1;
      lastBuiltT = -1;
      winStartT = -1;
      pump();
    } else if (m.type === "clock") {
      clock = { t: m.t, speed: m.speed, playing: m.playing };
      pump();
    }
  } catch (e) {
    post({ type: "err", message: e instanceof Error ? e.message : String(e) });
  }
};
