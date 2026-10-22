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
  missile: 5, photon: 5, cannon: 6, glaive: 4, zap: 4, flame: 4, puff: 4, slash: 3, gun: 3, blade: 3, claw: 3, spine: 3,
  liftOff: 5, landing: 5, load: 5, unload: 5, burrow: 5, unburrow: 5, mine: 1, weld: 2, warpHum: 1, heart: 1, warpEnd: 6, mineScv: 1, mineProbe: 1,
};
/** 종류마다 동시에 나는 수. */
const MAX9: Partial<Record<SfxKind9, number>> = {
  warpHum: 1, warpEnd: 1, heart: 1, mineScv: 1, mineProbe: 1, gun: 2, slash: 2, blade: 3, claw: 3, spine: 3, zap: 2, glaive: 2, mine: 1, weld: 1, liftOff: 1, landing: 1, thunder: 1, warp: 1,
  screamM: 1, screamF: 1, squeal: 2, boom: 3, boomBig: 2, bioBoom: 2, load: 1, unload: 1, burrow: 1, unburrow: 1,
};
/** 종류마다 앞 소리와의 최소 간격(ms · 1배속). */
const GAP9: Partial<Record<SfxKind9, number>> = {
  warpHum: 1450, warpEnd: 400, heart: 880, mineScv: 900, mineProbe: 900, gun: 70, slash: 90, blade: 60, claw: 60, spine: 60, zap: 140, glaive: 160, flame: 200, puff: 160, photon: 120, missile: 150, cannon: 120,
  mine: 900, weld: 700, boom: 80, boomBig: 200, bioBoom: 200, squeal: 160, screamM: 260, screamF: 380,
  thunder: 600, warp: 500, liftOff: 700, landing: 700, load: 250, unload: 250, burrow: 300, unburrow: 300,
};
/** 종류마다 크기. */
const GAIN9: Partial<Record<SfxKind9, number>> = { warpHum: 0.5, heart: 0.6, mine: 0.55, mineScv: 0.55, mineProbe: 0.55, weld: 0.6, gun: 0.75, slash: 0.8 };

const KEY9 = "scr.sfx";
const VOL_KEY9 = "scr.sfx.vol";
const read9 = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write9 = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* 사생활 모드 */ } };

type Voice9 = { src: AudioBufferSourceNode; kind: SfxKind9; prio: number; at: number; until: number };
const voices9: Voice9[] = [];
/** 종류마다 갈래 PCM(굽기 일꾼) — AudioBuffer 는 소리를 처음 낼 때 그 AudioContext 로 옮겨 담는다(bufsOf9). */
const bank9 = new Map<SfxKind9, Float32Array[]>();
const bufs9 = new Map<SfxKind9, AudioBuffer[]>();
const last9 = new Map<SfxKind9, { at: number; v: number }>();
let enabled9 = read9(KEY9) !== "0";
let volume9 = Number(read9(VOL_KEY9) ?? "0.6");
if (!Number.isFinite(volume9)) volume9 = 0.6;
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
    try { ctx9 = new C9({ latencyHint: "interactive" }); } catch { return null; }
    master9 = ctx9.createGain();
    master9.gain.value = volume9;
    master9.connect(ctx9.destination);
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
  if (slot) { try { slot.src.stop(); } catch { /* 이미 끝남 */ } voices9.splice(voices9.indexOf(slot), 1); }
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
    const v9: Voice9 = { src, kind, prio, at: now, until: now + bs9[vi].duration * 1000 };
    src.onended = (): void => { const i9 = voices9.indexOf(v9); if (i9 >= 0) voices9.splice(i9, 1); };
    voices9.push(v9);
    src.start();
  } catch { /* 못 틀면 버린다 */ }
}

/** 지금 나는 소리를 다 끊는다(멈춤·되감기·탐색). */
export function hushSfx9(): void {
  for (const v of voices9) { try { v.src.stop(); } catch { /* 이미 끝남 */ } }
  voices9.length = 0;
}

export const sfxOn9 = (): boolean => enabled9;
export const sfxVolume9 = (): number => volume9;
export function setSfxOn9(on: boolean): void {
  enabled9 = on;
  write9(KEY9, on ? "1" : "0");
  if (!on) hushSfx9();
  emit9();
}
export function setSfxVolume9(v: number): void {
  volume9 = Math.max(0, Math.min(1, v));
  if (master9) master9.gain.value = volume9;
  write9(VOL_KEY9, String(volume9));
  emit9();
}
export const subscribeSfx9 = (f: () => void): (() => void) => { subs9.add(f); return () => { subs9.delete(f); }; };
