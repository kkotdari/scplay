/* 프레임 워커 = **설계 일꾼**(요청: 두 일꾼 — 설계 일꾼은 주인 명령만 받아 여유가 있을 때마다 더 멀리 설계도를
 *  지어 두고, 그림 일꾼(메인의 붓)은 받은 설계도만 그린다. 단방향.) ─────────────────────────────────
 *
 *  통신 규약(메인 → 워커)
 *    world  { entData, truth, grid, bases, teamMap, total }   참값·지도·기지 — 경기마다 한 번.
 *    view   { view: EngineView9 }                            상자 크기·기울기·시점·색·품질·**시야 사각형** — 바뀔 때.
 *    cmd    { playing, t0, speed }                            주인의 명령 — 재생/정지·탐색·배속 때만(매 프레임이 아니다).
 *  (워커 → 메인)
 *    ready                                                   세계를 받아 엔진을 세웠다.
 *    worldui { ui }                                          화면(UI)이 읽는 파생 자료 몇 가지 — 메인은 제 것을 안 만든다.
 *    frame  { t, buf, strs, fog, ms }                        시각 t의 설계도(숫자 배열 + 문자열 표, transfer) · 안개는 바뀐 장만.
 *    err    { message }                                      셈이 던졌다 — 메인은 마지막 프레임을 든 채 진단에 적는다.
 *
 *  시계: 명령의 (t0, 배속)에서 제 벽시계로 굴린다 — 주인을 기다리지 않는다. 정지면 t0에 멈춘 한 장만.
 *  박자: 한 장 = speed/30초(짓기가 느리면 벌린다, 최소 초당 8장). 앞으로 AHEAD_WALL_SEC(벽시계)·AHEAD_BYTES까지
 *        지어 두고, 한도에 닿으면 시계가 흐를 때까지 쉰다.
 *  튐:   시계가 지은 창 뒤로 갔으면(되감기) 엔진 기억을 비우고 그 자리부터. 앞으로 튄 것(건너뛰기·뒤처짐)은 기억을
 *        두고 그 자리로 뛴다. 시점·시야가 바뀌면 기억은 두고 지금 시각부터.
 *
 *  ⚠ 이 파일은 ReplayMotionPlayer 모듈을 통째로 끌어온다(엔진이 그 안의 표·헬퍼를 쓴다). React도 함께
 *    묶이지만 DOM은 안 만진다 — 워커에서 `document`를 만지는 줄이 생기면 여기서 던지고 메인 진단에 적힌다. */
import {
  createEngine9, deriveWorld9, pickWorldUi9, type EngineView9, type EngineWorld9, type Frame9,
} from "./engine9";
import { pack9 } from "./framePack";
import { estBytes9 } from "./memEst9";
import { UNIT_BUILD_SEC } from "./unitStats";
import type { TruthTracks } from "../../utils/openbwTracks";
import { truthWorld } from "../../utils/truthLives";

const FPS9 = 30;
/** 가장 성긴 박자 — 짓기가 아무리 느려도 초당 이만큼은 낸다(그보다 느리면 그냥 뒤처진다). */
const FPS_MIN9 = 8;
/** 앞으로 지어 두는 한도의 기본값 — 벽시계 초(배속을 곱해 게임 시각이 된다)와 바이트. 주인이 명령에 실어 기기에
 *  맞게 정한다(폰 2초·5MB, PC 3초·10MB — 폰은 스크린샷 한 번의 메모리 요동에도 터진다). */
const AHEAD_WALL_SEC = 3;
const AHEAD_BYTES = 10 * 1024 * 1024;

type WorldMsg = {
  type: "world";
  grid: { width: number; height: number; resources?: [number, number, 0 | 1][] };
  bases: { key: string; race?: string }[]; teamMap: Record<string, 1 | 2>; total: number;
};
/** 참값 — 메인이 transfer로 **넘긴** 것(메인에는 껍데기만 남는다). 개체 표(entData)는 여기서 스스로 만든다. */
type TruthMsg = { type: "truth"; truth: TruthTracks | null };
type ViewMsg = { type: "view"; view: EngineView9 };
type CmdMsg = { type: "cmd"; playing: boolean; t0: number; speed: number; aheadSec?: number; aheadBytes?: number };
type WantMsg = { type: "want"; what: "walks"; raw?: string };
type Msg = WorldMsg | TruthMsg | ViewMsg | CmdMsg | WantMsg;

let world: EngineWorld9 | null = null;
let truthData: TruthTracks | null = null;
let worldParams: Omit<WorldMsg, "type"> | null = null;
let view: EngineView9 | null = null;
let engine: ReturnType<typeof createEngine9> | null = null;
/** 주인의 명령 + 받은 벽시계 시각 — 지금 시각은 이것으로 센다(clockT). */
let clock: { playing: boolean; t0: number; speed: number; at: number; aheadSec: number; aheadBytes: number } = {
  playing: false, t0: 0, speed: 1, at: 0, aheadSec: AHEAD_WALL_SEC, aheadBytes: AHEAD_BYTES,
};
/** 다음에 지을 프레임의 시각. 음수면 '지금 시각부터 새로'. */
let nextT = -1;
/** 지어 둔 창의 **시작** 시각 — 되감기 판정은 이것과 견준다. */
let winStartT = -1;
/** 미뤄 둔 pump 타이머(0이면 없음). */
let pumpTimer = 0;
/** 프레임 한 장 짓는 데 든 시간(ms, 지수 평균) — 박자를 여기에 맞춘다(stepNow). 0이면 아직 모른다. */
let buildMs = 0;
/** 지어 보낸 프레임(시각·바이트) — 앞 한도(바이트)를 세는 자. 시계 뒤의 것은 버린다. */
let built: { t: number; bytes: number }[] = [];
/** 엔진 기억을 비운 횟수(진단) */
let resets = 0;
/** 마지막으로 실어 보낸 안개 판(참조) — 같은 참조면 안 싣는다. 엔진은 바뀔 때만 새 배열을 만든다. */
let fogSent: { explored: Uint16Array | null; visNow: Uint8Array | null; visSrc: Float32Array | null } = {
  explored: null, visNow: null, visSrc: null,
};

const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
/** 주인 명령 없이 제 시계로 굴리는 상한(벽시계 초). 주인은 재생 중 1초마다 심장박동 명령을 보낸다 — 그것이 끊기면
 *  (굽느라 시간을 안 보내는 프레임·멈춘 탭) 주인은 제자리인데 워커만 앞서 달려 설계도를 쌓는다(폰: 앞 9.1초·15MB).
 *  그래서 마지막 명령 뒤 이만큼까지만 굴리고 그 자리에 선다. 주인이 돌아오면 명령이 다시 온다. */
const STALL_WALL_SEC = 2.5;
const clockT = (): number => (clock.playing
  ? clock.t0 + Math.min(STALL_WALL_SEC, (nowMs() - clock.at) / 1000) * clock.speed
  : clock.t0);
const post = (m: unknown, transfer?: Transferable[]): void => {
  const w = self as unknown as Worker;
  if (transfer && transfer.length > 0) w.postMessage(m, transfer); else w.postMessage(m);
};

/** 프레임 사이 게임 시각 간격. 기본 speed/30초. 짓기가 그보다 오래 걸리면(폰·긴 경기) 간격을 벌려 시계를 따라간다 —
 *  벽시계로 한 장에 buildMs면 게임 시각으로는 buildMs·speed만큼 흐른다. 그 1.3배를 간격으로 삼는다. */
const stepNow = (): number => {
  const base = Math.max(1 / 240, clock.speed / FPS9);
  const need = (buildMs / 1000) * clock.speed * 1.3;
  return Math.min(Math.max(base, need), Math.max(base, clock.speed / FPS_MIN9));
};

const restartFrom = (t: number, forget: boolean): void => {
  if (!engine) return;
  if (forget) { engine.reset(); resets += 1; }
  nextT = t;
  winStartT = t;
  built = [];
  // 새 창의 첫 장에는 안개를 꼭 싣는다 — 메인이 옛 창의 안개를 이 창에 붙이면 안 된다(되감기면 미래의 안개다).
  fogSent = { explored: null, visNow: null, visSrc: null };
};

/** 한 장 짓고 싸서 보낸다. 시간을 재어 buildMs에 섞고, 바이트를 돌려준다. */
const emit = (t: number): number => {
  if (!engine) return 0;
  const t0 = nowMs();
  const f: Frame9 = engine.build(t);
  const t1 = nowMs();
  const body = pack9({ unitOps: f.unitOps, fxOps: f.fxOps, miniExtra: f.miniExtra, gasBusy: f.gasBusy, dom: f.dom });
  const t2 = nowMs();
  const transfer: Transferable[] = [body.buf.buffer];
  let fog: { explored: Uint16Array | null; visNow: Uint8Array | null; visSrc: Float32Array } | null = null;
  let bytes = body.buf.byteLength;
  if (f.explored !== fogSent.explored || f.visNow !== fogSent.visNow || f.visSrc !== fogSent.visSrc) {
    fogSent = { explored: f.explored, visNow: f.visNow, visSrc: f.visSrc };
    // 엔진이 제 판을 다시 쓰므로 복사해서 넘긴다(transfer는 원본을 떼어 간다).
    fog = {
      explored: f.explored ? f.explored.slice() : null,
      visNow: f.visNow ? f.visNow.slice() : null,
      visSrc: f.visSrc.slice(),
    };
    if (fog.explored) { transfer.push(fog.explored.buffer); bytes += fog.explored.byteLength; }
    if (fog.visNow) { transfer.push(fog.visNow.buffer); bytes += fog.visNow.byteLength; }
    transfer.push(fog.visSrc.buffer); bytes += fog.visSrc.byteLength;
  }
  const ms = nowMs() - t0;
  buildMs = buildMs === 0 ? ms : buildMs * 0.85 + ms * 0.15;
  const st = engine.stats();
  post({
    type: "frame", t: f.t, buf: body.buf, strs: body.strs, fog, ms, n: f.unitOps.length,
    // 진단 — 짓기의 속(엔진·싸기), 안개 비용·횟수, 리셋 횟수, 워커 시계(주인 t와의 차를 메인이 본다)
    msBuild: t1 - t0, msPack: t2 - t1, fogCost: st.fogCost, fogN: st.fogStamps, resets, cur: clockT(),
  }, transfer);
  built.push({ t: f.t, bytes });
  return bytes;
};

const pump = (): void => {
  if (pumpTimer !== 0) { clearTimeout(pumpTimer); pumpTimer = 0; }
  if (!engine) return;
  const step = stepNow();
  const cur = clockT();
  if (nextT < 0) restartFrom(cur, false);
  else if (winStartT >= 0 && cur < winStartT - step * 2) restartFrom(cur, true);          // 되감기
  /* 앞으로 튐(건너뛰기·뒤처짐)은 기억을 **안 비운다** — 시간이 앞으로 가는 것은 엔진에겐 긴 프레임일 뿐이고, 비우면
     안개·방향·사격 위상을 처음부터 다시 쌓아 첫 장들이 무거워진다(폰에서 짓기가 191ms까지 오르던 나선의 한 축). */
  else if (cur > nextT + step * 2) restartFrom(cur, false);
  if (!clock.playing) {
    // 멈춤: 그 시각의 프레임이 창 안에 없을 때만 한 장.
    const have = built.some((b) => Math.abs(b.t - cur) <= step * 1.5);
    if (!have) { emit(cur); nextT = cur + step; winStartT = Math.min(winStartT < 0 ? cur : winStartT, cur); }
    return;
  }
  const until = cur + clock.aheadSec * clock.speed;
  /* 바이트 한도는 **주인의 마지막 시각(t0)** 부터 센다 — 제 시계(cur)부터 세면 주인이 멎어 있는 동안(굽기 홀드)
     t0~cur 사이의 장들이 셈에서 빠져 메인 메모리가 한도를 넘는다(계측: 한도 10MB에 메인 15.6MB). */
  /* 뒤(주인 시각 이전)의 장은 한도에 안 넣는다(계측: 폰 3MB 한도를 t0−0.5초부터 세니 앞으로 쓸 몫이 0.4초뿐이라
     뒤 장이 없는 순간이 10% — 보간이 못 먹고 다음 장에서 뛰었다). 뒤 장은 메인이 제 자로 버린다. */
  const from = Math.min(cur, clock.t0);
  if (built.length > 0 && built[0].t < from) built = built.filter((b) => b.t >= from);
  let bytesAhead = 0;
  for (const b of built) if (b.t >= from) bytesAhead += b.bytes;
  /* 한 번에 여덟 장 또는 60ms까지만 짓고 한숨 돌린다 — 느린 기기에서 여덟 장이 1초를 넘으면 그동안 명령이 줄을 선다. */
  let n = 0;
  const pumpAt = nowMs();
  while (nextT <= until && bytesAhead < clock.aheadBytes && n < 8 && nowMs() - pumpAt < 60) {
    bytesAhead += emit(nextT);
    nextT += stepNow();
    n += 1;
  }
  const more = nextT <= until && bytesAhead < clock.aheadBytes;
  // 더 지을 게 있으면 곧, 한도에 닿았으면 시계가 반 걸음쯤 흐른 뒤에 다시.
  const delay = more ? 0 : Math.max(20, ((step / Math.max(0.01, clock.speed)) * 1000) * 0.5);
  pumpTimer = setTimeout(() => { pumpTimer = 0; pump(); }, delay) as unknown as number;
};

/** 세계를 (다시) 센다 — 참값과 세계 조각이 둘 다 있을 때. 개체 표는 참값에서 여기서 만든다(메인과 같은 함수). */
const deriveNow = (): void => {
  if (!worldParams) return;
  const p = worldParams;
  const entData = truthData && truthData.tracks.length ? truthWorld(truthData, (k) => UNIT_BUILD_SEC[k] ?? 0) : null;
  world = deriveWorld9({
    entData, truth: truthData, grid: p.grid, bases: p.bases,
    teamOf: (raw: string) => p.teamMap[raw], total: p.total,
  });
  rebuildEngine();
  let bytes: { truth: number; world: number; typed: number; top: [string, number][] } | undefined;
  try {
    const seen = new Set<object>();
    const bTruth = estBytes9(truthData, seen);
    // 참값 가운데 형식 배열(키·상태) 몫 — 나머지는 체력·인터셉터·표적 같은 쌍 배열이다(형식으로 바꿀지 정하는 자).
    let typed = 0;
    if (truthData) for (const tk of truthData.tracks) typed += tk.kt.byteLength + tk.kxy.byteLength + tk.kh.byteLength + tk.kst.byteLength + tk.done.byteLength + tk.types.byteLength
      + (tk.air?.byteLength ?? 0) + (tk.cloak?.byteLength ?? 0) + (tk.hp?.byteLength ?? 0) + (tk.ic?.byteLength ?? 0) + (tk.tgt?.byteLength ?? 0);
    const bEnt = estBytes9(entData, seen);
    // 파생 자료는 필드마다 따로 잰다(같은 seen이라 겹치는 것은 먼저 잰 필드에 붙는다) — 어느 것이 큰지 진단에 싣는다.
    const per: [string, number][] = [["entData", bEnt]];
    let bWorld = bEnt;
    for (const k of Object.keys(world as unknown as Record<string, unknown>)) {
      const b = estBytes9((world as unknown as Record<string, unknown>)[k], seen);
      bWorld += b;
      per.push([k, b]);
    }
    per.sort((a, b) => b[1] - a[1]);
    bytes = { truth: bTruth, world: bWorld, typed, top: per.slice(0, 8) };
  } catch { bytes = undefined; }
  post({ type: "ready", bytes });
  // hasEnts: 개체 있는 세계인가 — 메인은 이것이 참일 때만 안개를 켠다(참값 오기 전의 빈 세계 장은 '본 곳 0%'라 새까맣다).
  post({ type: "worldui", ui: pickWorldUi9(world), hasEnts: entData !== null });
  pump();
};
const rebuildEngine = (): void => {
  if (!world || !view) return;
  engine = createEngine9(world, view);
  nextT = -1;
  winStartT = -1;
  built = [];
};

/* 워커 안에서만 귀를 연다 — 도구 번들이 이 모듈을 보통 모듈로 묶어 메인에서 읽을 때는 아무 일도 않는다. */
const inWorker9 = typeof document === "undefined" && typeof self !== "undefined";
if (inWorker9) self.onmessage = (ev: MessageEvent<Msg>): void => {
  const m = ev.data;
  try {
    if (m.type === "world") {
      worldParams = { grid: m.grid, bases: m.bases, teamMap: m.teamMap, total: m.total };
      deriveNow();
    } else if (m.type === "truth") {
      truthData = m.truth;
      deriveNow();
    } else if (m.type === "want") {
      if (m.what === "walks") {
        const all = world?.entWalks ?? [];
        post({ type: "walks", entWalks: m.raw ? all.filter((e) => e.raw === m.raw) : all });
      }
    } else if (m.type === "view") {
      view = m.view;
      if (engine) engine.setView(view); else rebuildEngine();
      // 시점·시야·색이 바뀌면 지어 둔 설계도는 옛 것이다 — 기억은 두고 지금 시각부터 다시.
      nextT = -1;
      pump();
    } else if (m.type === "cmd") {
      clock = {
        playing: m.playing, t0: m.t0, speed: m.speed, at: nowMs(),
        aheadSec: m.aheadSec ?? AHEAD_WALL_SEC, aheadBytes: m.aheadBytes ?? AHEAD_BYTES,
      };
      pump();
    }
  } catch (e) {
    post({ type: "err", message: e instanceof Error ? `${e.message} ${(e.stack ?? "").split("\n")[1] ?? ""}`.trim() : String(e) });
  }
};
