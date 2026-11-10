import { SFX_RATE9, SFX_RECIPES9, type SfxKind9 } from "./sfx9Synth";

/* ★ 효과음 틀기(2026-10-22, 요청: "재생기에 소리 효과 … 동시에 너무 많은 소리 안 나게") — 구운 PCM(sfx9Synth)을 **Web Audio**(AudioContext · 버퍼 소스)로 튼다.
   ★ <audio> 묶음 → Web Audio(같은 날, 지적: "모바일에서 효과음 on 시 움직임이 뚝뚝 렉") — 옛 판은 소리마다 <audio> 의 src 를 갈아 끼우고 play() 했다. 폰(특히 iOS)은 그때마다
   메인 스레드에서 미디어 파이프라인을 다시 세워, 전투 중 초당 여러 번이면 장이 끊겼다. 이제 소리는 미리 AudioBuffer 로 올려 두고 버퍼 소스 하나 만들어 start() 만 한다.
   무음 스위치는 그대로 따른다 — 소리를 내기 전에 오디오 세션을 'ambient' 로(ambientAudio9 · 사파리 16.4+). Web Audio 는 iOS 에서 원래 무음 스위치를 따른다(옛 머리말의
   'AudioContext 는 열지 않는다'는 <audio> 가 함께 날 때 세션이 'playback' 으로 넘어가는 경우를 말한 것 — ambient 로 묶어 두면 둘 다 따른다).
   한 판에 소리가 쏟아져도:
     · 동시에 VOICES9 개까지만 난다 — 다 차면 **더 급한 소리**(PRIO)가 가장 덜 급하고 오래된 소리를 끊고 들어가고, 아니면 버린다.
     · 종류마다 동시 수(MAX)와 최소 간격(GAP ms)이 있다 — 총소리 백 발이 한 장에 와도 두 대·70ms 간격까지만.
     · 빨리 감을수록(배속) 간격을 늘리고 덜 급한 소리는 아예 뺀다(play 의 speed).
   iOS 는 누름 안에서 AudioContext 를 깨워야 한다 — 첫 누름에서 만들고 빈 소리를 한 번 튼다(unlockSfx9). 크기는 GainNode 라 iOS 도 음량 손잡이를 탄다. */

const VOICES9 = 6;
/** 급한 차례 — 죽음·폭발 > 주문 > 공격 > 일상(채집·용접). */
const PRIO9: Record<SfxKind9, number> = {
  boomBig: 9, boom: 7, bioBoom: 8, screamM: 7, screamF: 7, squeal: 7, thunder: 8, warp: 6,
  missile: 5, photon: 5, photonC: 5, cannon: 6, glaive: 4, zap: 4, flame: 4, puff: 4, slash: 3, gun: 3, blade: 3, claw: 3, spine: 3,
  liftOff: 5, landing: 5, load: 5, unload: 5, burrow: 5, unburrow: 5, mine: 1, weld: 2, warpHum: 1, heart: 1, warpEnd: 6, mineScv: 1, mineProbe: 1, eggPop: 3,
  screamLow: 7, screamHi: 7, springBreak: 7, spikeEarth: 4, guardHum: 4, scanHum: 6, warpCharge: 6, zlingHit: 3, ultraHit: 3, missileLow: 5, missileHi: 5, fleshUnfold: 5, zergDone: 6, eggStart: 3, eggHatch: 3, metalClang: 5, mineArm: 5, reaverBreak: 7, vesselBoom: 8, bioLoad: 5, bioUnload: 5, obsBoom: 7, lurkerDie: 7, squealHi: 7, squealMuta: 7,   // 2026-11-02 새 소리
  stim: 5,   // 2026-11-03
  gunShot: 3,   // 2026-11-05 — gunBeat9 가 따로 튼다(묶음을 안 탄다)
  dragoonShot: 5,   // 2026-11-09
  zealotStab: 3,   // 2026-11-09
  tossDie: 7,   // 2026-11-09
  dragoonHit: 5,   // 2026-11-09
  eggSplash: 4, eggSplashLow: 6, drillLow: 2, lurkerDig: 5, spineSmall: 3,   // 2026-11-09 일곱째(공사 고치 완공은 옛 zergDone 6 자리)
};
/** 종류마다 동시에 나는 수. */
const MAX9: Partial<Record<SfxKind9, number>> = {
  eggSplash: 2, eggSplashLow: 1, drillLow: 1, lurkerDig: 2, spineSmall: 3,
  warpHum: 1, warpEnd: 1, heart: 1, mineScv: 1, mineProbe: 1, gun: 2, slash: 2, blade: 3, claw: 3, spine: 3, zap: 2, glaive: 2, mine: 1, weld: 1, liftOff: 1, landing: 1, thunder: 1, warp: 1,
  screamM: 1, screamF: 1, squeal: 2, boom: 3, boomBig: 2, bioBoom: 2, load: 1, unload: 1, burrow: 1, unburrow: 1, eggPop: 2,
  screamLow: 1, screamHi: 1, springBreak: 2, spikeEarth: 2, guardHum: 2, scanHum: 1, warpCharge: 1, zlingHit: 3, ultraHit: 2, missileLow: 2, missileHi: 2, fleshUnfold: 2, zergDone: 1, eggStart: 2, eggHatch: 2, metalClang: 2, mineArm: 2, reaverBreak: 2, vesselBoom: 2, bioLoad: 1, bioUnload: 1, obsBoom: 2, lurkerDie: 2, squealHi: 2, squealMuta: 2, stim: 1,
};
/** 종류마다 앞 소리와의 최소 간격(ms · 1배속). */
const GAP9: Partial<Record<SfxKind9, number>> = {
  eggSplash: 180, eggSplashLow: 300, drillLow: 700, lurkerDig: 130, spineSmall: 60,
  warpHum: 1450, warpEnd: 400, heart: 880, mineScv: 900, mineProbe: 900, gun: 70, slash: 90, blade: 60, claw: 60, spine: 60, zap: 140, glaive: 160, flame: 200, puff: 160, photon: 120, photonC: 120, missile: 150, cannon: 120,
  mine: 900, weld: 700, boom: 80, boomBig: 200, bioBoom: 200, squeal: 160, screamM: 260, screamF: 380,
  thunder: 600, warp: 500, liftOff: 700, landing: 700, load: 250, unload: 250, burrow: 300, unburrow: 300, eggPop: 220,
  screamLow: 260, screamHi: 380, springBreak: 200, spikeEarth: 160, guardHum: 260, scanHum: 600, warpCharge: 500, zlingHit: 60, ultraHit: 80, missileLow: 150, missileHi: 150, fleshUnfold: 300, zergDone: 400, eggStart: 220, eggHatch: 220, metalClang: 120, mineArm: 120, reaverBreak: 200, vesselBoom: 300, bioLoad: 250, bioUnload: 250, obsBoom: 300, lurkerDie: 200, squealHi: 160, squealMuta: 160, stim: 600,
};
/** 종류마다 크기. */
/* gunShot · gun · slash 는 뺐다(2026-11-09 다섯째 — 공격 묶음 크기 맞춤 sfx9Synth LOUD_ATK_KINDS9 가 맡는다 · 옛 gunShot 0.35 · gun 0.75 · slash 0.8). */
const GAIN9: Partial<Record<SfxKind9, number>> = { spineSmall: 0.6, drillLow: 0.4, warpHum: 0.5, heart: 0.3, mine: 0.55, mineScv: 0.55, mineProbe: 0.55, weld: 0.4, eggPop: 0.45 };   // gunShot 0.7 → 0.35 → 0.175(넷째 "볼륨 반으로") → 0.35(다섯째 "볼륨 2배로") (2026-11-09 셋째 "반 정도로 줄여야 할 듯 너무 커" → "0.7 에서 반" · 사이에 0.48 · 0.24 를 거쳤다) · heart 0.6 → 0.3(2026-11-09, 요청: "저그 공사 고치 두근두근 소리 작게") · eggPop 0.6 → 0.45(2026-10-27 · 몸이 잡음 철퍽이라 들리는 띠가 더 차서)

const KEY9 = "scr.sfx";
const VOL_KEY9 = "scr.sfx.vol";
const read9 = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write9 = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* 사생활 모드 */ } };

type Voice9 = { src: AudioBufferSourceNode; gain: GainNode; kind: SfxKind9; prio: number; at: number; until: number };
/** ★ 소리를 **스며 끊는다**(2026-11-08, 지적: "효과음 잡음 — 저그만 그런 건 아닌데") — 옛 판은 자리 뺏기(VOICES9 · 같은 종류 MAX9) · 멈춤 · 탐색 때 src.stop() 으로
 *  파형 한가운데를 뚝 잘라 '딱'이 났다. 12ms 에 걸쳐 0 으로 내리고 그 뒤에 멈춘다. */
function fadeStop9(src: AudioBufferSourceNode, gain: GainNode | null): void {
  const c9 = src.context;
  const t9 = c9.currentTime;
  try {
    if (gain) { gain.gain.cancelScheduledValues(t9); gain.gain.setValueAtTime(gain.gain.value, t9); gain.gain.linearRampToValueAtTime(0, t9 + 0.012); }
    src.stop(t9 + (gain ? 0.015 : 0));
  } catch { /* 이미 끝남 */ }
}
const voices9: Voice9[] = [];
/** 종류마다 갈래 PCM(굽기 일꾼) — AudioBuffer 는 소리를 처음 낼 때 그 AudioContext 로 옮겨 담는다(bufsOf9). */
const bank9 = new Map<SfxKind9, Float32Array[]>();
const bufs9 = new Map<SfxKind9, AudioBuffer[]>();
const last9 = new Map<SfxKind9, { at: number; v: number }>();
let enabled9 = read9(KEY9) !== "0";
let volume9 = Number(read9(VOL_KEY9) ?? "0.6");
if (!Number.isFinite(volume9)) volume9 = 0.6;
/** 음량 손잡이를 안 세운 기기(iOS — 배경 음악 <audio>.volume 을 못 바꿔 슬라이더를 숨긴다)는 효과음도 최대(1)로(아래 setSfxFullVolume9). */
let full9 = false;
/** ★ 음악 대비 효과음 몫(2026-11-10, 지적: "음악에 비해 효과음이 너무 큰데 아이폰만 그래?") — 음악(<audio>)과 효과음(주 GainNode)은 같은 손잡이(volume9 · iOS 는 둘 다 1)를 타서
 *  비는 기기마다 같다. 다만 11-09 묶음 크기 맞춤(sfx9Synth LOUD_*)으로 작던 공격음(연사 · 칼질 · 질럿)이 커져 음악을 덮었다 — 효과음 전체를 0.55(−5dB)로. 아이폰은 작은 스피커가
 *  음악의 낮은 몫을 못 내 더 도드라진다. */
const SFX_MIX9 = 0.55;
let ctx9: AudioContext | null = null;
let master9: GainNode | null = null;
const subs9 = new Set<() => void>();
const emit9 = (): void => subs9.forEach((f) => f());

/** 종류 하나의 갈래를 메인에서 굽는다 — 일꾼을 못 띄울 때(도구 번들)만. */
function bakeHere9(kind: SfxKind9): void {
  const [n, make] = SFX_RECIPES9[kind];
  bank9.set(kind, Array.from({ length: n }, (_, v) => make(v)));
}

/** 미리 굽는다 — **굽기 일꾼**(sfx9Worker)에서(2026-10-22, 지적: "소리 추가 후 좀 버벅임"). 옛 판은 메인이 쉴 틈마다 한 종류씩(폰에선 한 번에 100ms 넘게)
 *  구웠고, 아직 안 구운 종류가 울리면 그 장에서 바로 구웠다 — 둘 다 재생 중 멈칫이었다. 이제 구워지기 전의 종류는 **안 난다**(playSfx9).
 *  일꾼 모듈이 없는 도구 번들(esbuild — `?worker&inline` 을 모른다)만 옛 길(쉴 틈마다 메인에서). */
let baking9 = false;
export function prebakeSfx9(): void {
  if (baking9 || typeof window === "undefined") return;
  baking9 = true;
  const idleHere9 = (): void => {
    const kinds = (Object.keys(SFX_RECIPES9) as SfxKind9[]).filter((k) => !bank9.has(k));
    const w = window as Window & { requestIdleCallback?: (f: () => void) => void };
    const idle = (cb: () => void): void => { if (w.requestIdleCallback) w.requestIdleCallback(cb); else window.setTimeout(cb, 30); };
    const step = (): void => { const k = kinds.shift(); if (!k) return; bakeHere9(k); idle(step); };
    idle(step);
  };
  void import("./sfx9Worker?worker&inline").then((mod) => {
    const Ctor = (mod as { default?: unknown }).default;
    if (typeof Ctor !== "function") { idleHere9(); return; }
    const wk = new (Ctor as new () => Worker)();
    wk.onmessage = (e: MessageEvent): void => {
      const m = e.data as { kind?: SfxKind9; pcms?: ArrayBuffer[]; done?: boolean };
      if (m.done) { wk.terminate(); return; }
      if (m.kind && m.pcms) bank9.set(m.kind, m.pcms.map((b) => new Float32Array(b)));
    };
    wk.onerror = (): void => { wk.terminate(); idleHere9(); };
  }).catch(idleHere9);
}

/** ★ **무음 스위치를 따른다**(2026-10-22, 요청: "배경음악도 사일런트 모드 대응") — iOS 사파리의 <audio> 는 기본 'playback' 오디오 세션이라 벨소리/무음 스위치를
 *  뚫고 난다. 사파리 16.4+ 의 `navigator.audioSession` 을 'ambient' 로 두면 무음 스위치를 따르고, 남이 틀던 음악도 끊지 않고 섞인다. 배경 음악(useBgm)과
 *  효과음이 소리를 내기 전에 부른다 — 값이 이미 같으면 아무 일도 안 한다. API 가 없는 기기(안드로이드·옛 iOS)는 그대로. */
export function ambientAudio9(): void {
  if (typeof navigator === "undefined") return;
  const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (s && s.type !== "ambient") { try { s.type = "ambient"; } catch { /* 못 바꾸는 판 */ } }
}

/** AudioContext(없으면 만든다) — 음량 손잡이는 주 GainNode. 막혔으면(자동 재생 규칙) 깨우기를 한 번 청한다. 못 만들면 null. */
function ctxOf9(): AudioContext | null {
  if (!ctx9) {
    const C9 = typeof window === "undefined" ? undefined
      : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C9) return null;
    ambientAudio9();   // 세션을 먼저 ambient 로 — 무음 스위치를 따른다(위 ★)
    /* ★ 버퍼를 크게(2026-11-08, 지적: "지지지직 소리" — 종족 무관 · 건물 터지고 유닛 죽을 때) — "interactive"(가장 짧은 버퍼 · 폰 ~5ms)는 그 순간 GL 그림이 가장 무거워
       오디오 스레드가 제때 못 채우면(언더런) 출력이 끊겨 지직거렸다. 재생기 효과음은 수십 ms 늦어도 티가 안 나므로 "playback"(큰 버퍼). 연사 줄기는 AudioContext 시계로 미리 박으니 그대로 고르다. */
    try { ctx9 = new C9({ latencyHint: "playback" }); } catch { try { ctx9 = new C9(); } catch { return null; } }
    master9 = ctx9.createGain();
    master9.gain.value = (full9 ? 1 : volume9) * SFX_MIX9;
    /* ★ 출력 앞 리미터(2026-11-08, 지적: "효과음 잡음 — 저그만 그런 건 아닌데") — 소리 하나는 봉우리 0.75 안팎인데 교전에서 여섯 소리(VOICES9) + 연사 줄기가 겹치면 합이
       1 을 넘어 **잘려(클리핑) 지글거렸다**. 압축기를 리미터로(문턱 −8dB · 무릎 6 · 비 12 · 공격 3ms · 놓음 0.2초) — 겹칠 때만 눌리고 혼자 나는 소리는 그대로다. */
    try {
      const lim9 = ctx9.createDynamicsCompressor();
      lim9.threshold.value = -8; lim9.knee.value = 6; lim9.ratio.value = 12; lim9.attack.value = 0.003; lim9.release.value = 0.2;
      master9.connect(lim9).connect(ctx9.destination);
    } catch { master9.connect(ctx9.destination); }
  }
  if (ctx9.state === "suspended") void ctx9.resume().catch(() => {});
  return ctx9;
}

/** 그 종류의 갈래 AudioBuffer — 처음 낼 때 PCM 을 옮겨 담는다(한 종류 몇 KB · 복사뿐). */
function bufsOf9(c9: AudioContext, kind: SfxKind9): AudioBuffer[] | null {
  const got = bufs9.get(kind);
  if (got) return got;
  const pcms = bank9.get(kind);
  if (!pcms) return null;
  const out = pcms.map((p) => { const b = c9.createBuffer(1, p.length, SFX_RATE9); b.getChannelData(0).set(p); return b; });
  bufs9.set(kind, out);
  return out;
}

/** iOS: 사람의 누름 안에서 AudioContext 를 만들고(깨우고) 빈 소리를 한 번 튼다 — 그 뒤로는 누름 없이도 난다. */
let unlocked9 = false;
export function unlockSfx9(): void {
  if (unlocked9 || !enabled9) return;
  const c9 = ctxOf9();
  if (!c9) return;
  unlocked9 = true;
  try {
    const s9 = c9.createBufferSource();
    s9.buffer = c9.createBuffer(1, 1, SFX_RATE9);
    s9.connect(c9.destination);
    s9.start();
  } catch { /* 깨우기 실패는 다음 누름에 */ unlocked9 = false; }
}

export type SfxPlay9 = {
  /** 0~1 — 화면 가운데에서 멀수록 작게. */
  near?: number;
  /** 재생 배속 — 빠를수록 간격을 늘리고 덜 급한 소리를 뺀다. */
  speed?: number;
};

/** 진단 — 종류마다 낸 수(perf-check --sfxprobe 가 window.__sfx9 로 읽는다). */
export const SFX_STAT9: { played: Record<string, number> } = { played: {} };
if (typeof window !== "undefined") (window as unknown as { __sfx9?: typeof SFX_STAT9 }).__sfx9 = SFX_STAT9;

/** 한 소리를 낸다 — 조건(켜짐·동시 수·간격·자리)을 못 넘으면 조용히 버린다. */
export function playSfx9(kind: SfxKind9, opt: SfxPlay9 = {}): void {
  if (!enabled9 || typeof window === "undefined") return;
  if (!bank9.has(kind)) return;   // 아직 안 구워졌다(굽기 일꾼) — 이 장에서 굽지 않는다
  const speed = Math.max(1, opt.speed ?? 1);
  const prio = PRIO9[kind];
  if (speed >= 4 && prio < 5) return;
  if (speed >= 2 && prio < 3) return;
  const now = performance.now();
  const gap = (GAP9[kind] ?? 100) * Math.sqrt(speed);
  const prev = last9.get(kind);
  if (prev && now - prev.at < gap) return;
  for (let i9 = voices9.length - 1; i9 >= 0; i9 -= 1) if (voices9[i9].until <= now) voices9.splice(i9, 1);   // onended 가 늦은 판
  const same = voices9.filter((v) => v.kind === kind).length;
  if (same >= (MAX9[kind] ?? 2)) return;
  /** 다 찼으면 끊고 들어갈 자리 — 가장 덜 급하고 오래된 것(이 소리보다 덜 급할 때만). */
  let slot: Voice9 | null = null;
  if (voices9.length >= VOICES9) {
    const weakest = voices9.reduce((a, b) => (b.prio < a.prio || (b.prio === a.prio && b.at < a.at) ? b : a));
    if (weakest.prio >= prio) return;
    slot = weakest;
  }
  const c9 = ctxOf9();
  const bs9 = c9 && master9 ? bufsOf9(c9, kind) : null;
  if (!c9 || !master9 || !bs9 || bs9.length === 0 || c9.state !== "running") return;
  if (slot) { fadeStop9(slot.src, slot.gain); voices9.splice(voices9.indexOf(slot), 1); }
  SFX_STAT9.played[kind] = (SFX_STAT9.played[kind] ?? 0) + 1;
  let vi = Math.floor(Math.random() * bs9.length);
  if (bs9.length > 1 && prev && vi === prev.v) vi = (vi + 1) % bs9.length;
  last9.set(kind, { at: now, v: vi });
  try {
    const src = c9.createBufferSource();
    src.buffer = bs9[vi];
    const g9 = c9.createGain();
    g9.gain.value = (GAIN9[kind] ?? 1) * (0.45 + 0.55 * Math.max(0, Math.min(1, opt.near ?? 1)));
    src.connect(g9).connect(master9);
    const v9: Voice9 = { src, gain: g9, kind, prio, at: now, until: now + bs9[vi].duration * 1000 };
    src.onended = (): void => { const i9 = voices9.indexOf(v9); if (i9 >= 0) voices9.splice(i9, 1); };
    voices9.push(v9);
    src.start();
  } catch { /* 못 틀면 버린다 */ }
}

/* ★ **소총 연사 줄기**(2026-11-05, 요청: "마린 같은 경우 소리가 공격 중에 다다다 다다다 다다다 가 아니라 다다다다다다다다다다다 이렇게 똑같은 박자로 이어지게
   계산해서") — 옛 판은 소총 불티 op 가 설 때마다 네 발 묶음(gun · 0.21초)을 틀어, op 주기(쿨다운 × 0.35)와 묶음 길이가 어긋나 묶음 사이가 비었다.
   이제 한 줄기만 둔다: op 가 서면(gunBeat9) 줄기를 **다음 op 가 올 때까지(cp) + 여유** 살려 두고, 한 발(gunShot) 간격은 엔진이 셈한 gg
   (사수 원 쿨다운 ÷ 공격당 발 수 engine9 GUN_ROUNDS9 — 마린 79ms · 스팀 40ms · 고스트는 0.92초마다 한 발 · 35ms 아래로는 안 줄인다)를 배속으로 나눈다. 발은 AudioContext 시계로 미리(0.15초 앞까지) 박아 장 간격과 무관하게 고르다.
   여러 사수가 쏴도 줄기는 하나(박자는 가장 최근 op 의 사수 것) — 쏘는 몸이 다 그치면 마지막 op 의 cp 뒤에 멎는다. 4배속 위는 옛 규칙대로 소총 소리를 뺀다. */
const gunRun9 = { next: 0, until: 0, gap: 0.079, gain: 1, last: -1, n: 0, spd: 1 };
const gunSrcs9: AudioBufferSourceNode[] = [];
export function gunBeat9(gg: number, cp: number, opt: SfxPlay9 = {}): void {
  if (!enabled9 || typeof window === "undefined" || !bank9.has("gunShot")) return;
  const speed = Math.max(1, opt.speed ?? 1);
  if (speed >= 4) return;
  const c9 = ctxOf9();
  if (!c9 || c9.state !== "running") return;
  const now = c9.currentTime;
  const gap9 = Math.max(0.035, gg) / speed;
  gunRun9.spd = speed;
  gunRun9.gap = gunRun9.until > now ? Math.min(gunRun9.gap, gap9) : gap9;   // 줄기가 살아 있으면 빠른 쪽(마린 사이에 고스트가 쏴도 연사가 안 끊긴다)
  const g9 = (GAIN9.gunShot ?? 1) * (0.45 + 0.55 * Math.max(0, Math.min(1, opt.near ?? 1)));
  gunRun9.gain = gunRun9.until > now ? Math.max(gunRun9.gain, g9) : g9;
  /* 줄기가 멎었으면 다시 연다 — 단 마지막 발에서 한 발 간격이 안 지났으면 그때까지 기다린다(참값 없는 판은 op 가 쿨다운의 0.35 마다 서서, 고스트가 세 배로 쏘던 것). */
  if (gunRun9.until <= now) gunRun9.n = 0;   // 새 줄기는 묶음 첫 발부터
  if (gunRun9.until <= now || gunRun9.next < now) gunRun9.next = Math.max(now, gunRun9.last + gunRun9.gap);
  /* 다음 op 까지 + 0.1초 — 한 발 간격 절반은 뺀다: 한 번에 한 발(고스트)이면 다음 op 가 와야 다음 발이 난다(쏘기를 그친 뒤 헛발이 안 난다). */
  gunRun9.until = Math.max(gunRun9.until, now + cp / speed - gunRun9.gap * 0.5 + 0.1,
    gunRun9.next <= now + cp / speed + 0.05 ? gunRun9.next + 0.001 : 0);   // 기다리던 발이 다음 op 앞에 올 차례면 그 발까지는 낸다
  pumpGun9();
}
/** 줄기의 발을 0.15초 앞까지 박는다 — 효과음 신호(SfxCues9.run)가 장마다 부른다. */
export function pumpGun9(): void {
  if (!ctx9 || !master9 || gunRun9.until <= 0) return;
  const now = ctx9.currentTime;
  if (gunRun9.until <= now) { gunRun9.until = 0; return; }
  const bs9 = bufsOf9(ctx9, "gunShot");
  if (!bs9 || !bs9.length) return;
  const end9 = Math.min(gunRun9.until, now + 0.15);
  while (gunRun9.next < end9) {
    const at9 = Math.max(gunRun9.next, now);
    try {
      const src = ctx9.createBufferSource();
      src.buffer = bs9[0];
      const g9 = ctx9.createGain();
      g9.gain.value = gunRun9.gain * (0.9 + Math.random() * 0.1);
      src.connect(g9).connect(master9);
      src.onended = (): void => { const i9 = gunSrcs9.indexOf(src); if (i9 >= 0) gunSrcs9.splice(i9, 1); };
      gunSrcs9.push(src);
      src.start(at9);
      SFX_STAT9.played.gunShot = (SFX_STAT9.played.gunShot ?? 0) + 1;
    } catch { /* 못 틀면 버린다 */ }
    gunRun9.last = at9;
    /* ★ **네 발씩 끊어서**(2026-11-09, 요청: "마린은 4발씩 끊어서") — 빠른 연사(한 발 간격 < 0.15초 · 마린 · 벙커)는 네 발 묶음(간격 × 0.85) 뒤 쉼(간격 × 4.6) — 평균 박자는
       옛 고른 줄기(2026-11-05 "다다다다")의 반쯤이다. 느린 것(고스트 한 발)은 그대로. */
    gunRun9.n += 1;
    const burst9 = gunRun9.gap < 0.15;
    /* (같은 날 둘째, 지적: "네 발이 아닌 세 발처럼 들려") — 묶음 안 간격 67ms 는 앞 발 꼬리·메아리에 묻혀 한 발이 사라져 들렸다 → 안 간격 ≥ 0.09초 · 쉼 ≥ 0.28초. */
    /* (넷째, "4개가 정확히 타타타타") — 묶음 안 간격 0.1초 고정(배속으로 나눔) · 쉼 ≥ 0.3초. */
    gunRun9.next = at9 + (burst9 ? (gunRun9.n % 4 === 0 ? Math.max(0.3 / gunRun9.spd, gunRun9.gap * 4.6) : 0.1 / gunRun9.spd) : gunRun9.gap);
  }
}

/** 지금 나는 소리를 다 끊는다(멈춤·되감기·탐색). */
export function hushSfx9(): void {
  for (const v of voices9) fadeStop9(v.src, v.gain);
  voices9.length = 0;
  for (const s9 of gunSrcs9) fadeStop9(s9, null);
  gunSrcs9.length = 0;
  gunRun9.until = 0;
  gunRun9.last = -1;
  gunRun9.n = 0;
}

export const sfxOn9 = (): boolean => enabled9;
export function setSfxOn9(on: boolean): void {
  enabled9 = on;
  write9(KEY9, on ? "1" : "0");
  if (!on) hushSfx9();
  emit9();
}
export function setSfxVolume9(v: number): void {
  volume9 = Math.max(0, Math.min(1, v));
  if (master9) master9.gain.value = (full9 ? 1 : volume9) * SFX_MIX9;
  write9(VOL_KEY9, String(volume9));
  emit9();
}
/** ★ 음량 손잡이가 없는 기기는 효과음을 최대로(2026-10-22, 지적: "효과음 볼륨이 아이폰에서만 더 작아?" → "그럼 슬라이더를 안 보여야 하지 않나") — iOS 는 배경 음악
 *  (<audio>)의 음량을 못 바꿔 슬라이더를 숨기는데(useBgm volumeOk), Web Audio 효과음에는 저장된 음량(기본 0.6)이 그대로 곱해져 음악(늘 100%)에 묻혔다.
 *  재생기가 volumeOk 가 거짓이면 켠다 — 그때 주 GainNode 는 1(옛 <audio> 효과음의 iOS 크기와 같다). */
export function setSfxFullVolume9(on: boolean): void {
  full9 = on;
  if (master9) master9.gain.value = (full9 ? 1 : volume9) * SFX_MIX9;
}
export const subscribeSfx9 = (f: () => void): (() => void) => { subs9.add(f); return () => { subs9.delete(f); }; };
