import { SFX_RATE9, SFX_RECIPES9, wavBytes9, type SfxKind9 } from "./sfx9Synth";

/* ★ 효과음 틀기(2026-10-22, 요청: "재생기에 소리 효과 … 동시에 너무 많은 소리 안 나게") — 구운 WAV(sfx9Synth)를 **<audio> 몇 대의 묶음**으로 튼다.
   AudioContext 는 열지 않는다(사파리 무음 스위치 — useBgm.ts 머리의 규칙). 한 판에 소리가 쏟아져도:
     · 동시에 VOICES9 대까지만 난다 — 다 차면 **더 급한 소리**(PRIO)가 가장 덜 급하고 오래된 소리를 끊고 들어가고, 아니면 버린다.
     · 종류마다 동시 수(MAX)와 최소 간격(GAP ms)이 있다 — 총소리 백 발이 한 장에 와도 두 대·70ms 간격까지만.
     · 빨리 감을수록(배속) 간격을 늘리고 덜 급한 소리는 아예 뺀다(play 의 speed).
   iOS 는 누름 전에 <audio> 를 틀 수 없다 — 첫 누름에서 묶음 전부를 한 번 깨운다(unlockSfx9). iOS 는 volume 을 안 받아 크기는 구울 때 맞춘 그대로다. */

const VOICES9 = 6;
/** 급한 차례 — 죽음·폭발 > 주문 > 공격 > 일상(채집·용접). */
const PRIO9: Record<SfxKind9, number> = {
  boomBig: 9, boom: 7, bioBoom: 8, screamM: 7, screamF: 7, squeal: 7, thunder: 8, warp: 6,
  missile: 5, photon: 5, cannon: 6, glaive: 4, zap: 4, flame: 4, puff: 4, slash: 3, gun: 3, blade: 3, claw: 3, spine: 3,
  thruster: 5, load: 5, unload: 5, burrow: 5, unburrow: 5, mine: 1, weld: 2, warpHum: 1, heart: 1, warpEnd: 6,
};
/** 종류마다 동시에 나는 수. */
const MAX9: Partial<Record<SfxKind9, number>> = {
  warpHum: 1, warpEnd: 1, heart: 1, gun: 2, slash: 2, blade: 3, claw: 3, spine: 3, zap: 2, glaive: 2, mine: 1, weld: 1, thruster: 1, thunder: 1, warp: 1,
  screamM: 1, screamF: 1, squeal: 2, boom: 3, boomBig: 2, bioBoom: 2, load: 1, unload: 1, burrow: 1, unburrow: 1,
};
/** 종류마다 앞 소리와의 최소 간격(ms · 1배속). */
const GAP9: Partial<Record<SfxKind9, number>> = {
  warpHum: 1450, warpEnd: 400, heart: 880, gun: 70, slash: 90, blade: 60, claw: 60, spine: 60, zap: 140, glaive: 160, flame: 200, puff: 160, photon: 120, missile: 150, cannon: 120,
  mine: 900, weld: 700, boom: 80, boomBig: 200, bioBoom: 200, squeal: 160, screamM: 260, screamF: 380,
  thunder: 600, warp: 500, thruster: 700, load: 250, unload: 250, burrow: 300, unburrow: 300,
};
/** 종류마다 크기(데스크톱만 먹는다). */
const GAIN9: Partial<Record<SfxKind9, number>> = { warpHum: 0.5, heart: 0.6, mine: 0.55, weld: 0.6, gun: 0.75, slash: 0.8 };

const KEY9 = "scr.sfx";
const VOL_KEY9 = "scr.sfx.vol";
const read9 = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write9 = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* 사생활 모드 */ } };

type Voice9 = { el: HTMLAudioElement; kind: SfxKind9 | null; prio: number; at: number; until: number };
let voices9: Voice9[] | null = null;
const bank9 = new Map<SfxKind9, { urls: string[]; dur: number }>();
const last9 = new Map<SfxKind9, { at: number; v: number }>();
let enabled9 = read9(KEY9) !== "0";
let volume9 = Number(read9(VOL_KEY9) ?? "0.6");
if (!Number.isFinite(volume9)) volume9 = 0.6;
const subs9 = new Set<() => void>();
const emit9 = (): void => subs9.forEach((f) => f());

const urlOf9 = (bytes: BlobPart): string => URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));

/** 종류 하나의 갈래를 메인에서 굽는다 — 일꾼을 못 띄울 때(도구 번들)만. */
function bakeHere9(kind: SfxKind9): void {
  const [n, make] = SFX_RECIPES9[kind];
  let dur = 0;
  const urls: string[] = [];
  for (let v = 0; v < n; v += 1) {
    const pcm = make(v);
    dur = Math.max(dur, pcm.length / SFX_RATE9);
    urls.push(urlOf9(wavBytes9(pcm) as BlobPart));
  }
  bank9.set(kind, { urls, dur });
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
      const m = e.data as { kind?: SfxKind9; wavs?: ArrayBuffer[]; dur?: number; done?: boolean };
      if (m.done) { wk.terminate(); return; }
      if (m.kind && m.wavs) bank9.set(m.kind, { urls: m.wavs.map((b) => urlOf9(b)), dur: m.dur ?? 0 });
    };
    wk.onerror = (): void => { wk.terminate(); idleHere9(); };
  }).catch(idleHere9);
}

function pool9(): Voice9[] {
  if (!voices9) {
    voices9 = Array.from({ length: VOICES9 }, () => {
      const el = new Audio();
      el.preload = "auto";
      return { el, kind: null, prio: 0, at: 0, until: 0 };
    });
  }
  return voices9;
}

/** ★ **무음 스위치를 따른다**(2026-10-22, 요청: "배경음악도 사일런트 모드 대응") — iOS 사파리의 <audio> 는 기본 'playback' 오디오 세션이라 벨소리/무음 스위치를
 *  뚫고 난다. 사파리 16.4+ 의 `navigator.audioSession` 을 'ambient' 로 두면 무음 스위치를 따르고, 남이 틀던 음악도 끊지 않고 섞인다. 배경 음악(useBgm)과
 *  효과음이 소리를 내기 전에 부른다 — 값이 이미 같으면 아무 일도 안 한다. API 가 없는 기기(안드로이드·옛 iOS)는 그대로. */
export function ambientAudio9(): void {
  if (typeof navigator === "undefined") return;
  const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (s && s.type !== "ambient") { try { s.type = "ambient"; } catch { /* 못 바꾸는 판 */ } }
}

/** iOS: 사람의 누름 안에서 묶음 전부를 한 번 틀어 깨운다(그 뒤로는 누름 없이도 난다). 소리 없는 아주 짧은 WAV. */
let unlocked9 = false;
export function unlockSfx9(): void {
  if (unlocked9 || !enabled9) return;
  unlocked9 = true;
  ambientAudio9();
  const silent = urlOf9(wavBytes9(new Float32Array(220)) as BlobPart);
  for (const v of pool9()) {
    v.el.src = silent;
    v.el.muted = true;
    v.el.play().then(() => { v.el.pause(); v.el.muted = false; }).catch(() => { v.el.muted = false; });
  }
}

export type SfxPlay9 = {
  /** 0~1 — 화면 가운데에서 멀수록 작게(데스크톱만). */
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
  const b = bank9.get(kind);
  if (!b) return;   // 아직 안 구워졌다(굽기 일꾼) — 이 장에서 굽지 않는다
  const speed = Math.max(1, opt.speed ?? 1);
  const prio = PRIO9[kind];
  if (speed >= 4 && prio < 5) return;
  if (speed >= 2 && prio < 3) return;
  const now = performance.now();
  const gap = (GAP9[kind] ?? 100) * Math.sqrt(speed);
  const prev = last9.get(kind);
  if (prev && now - prev.at < gap) return;
  const vs = pool9();
  const same = vs.filter((v) => v.kind === kind && v.until > now).length;
  if (same >= (MAX9[kind] ?? 2)) return;
  let slot = vs.find((v) => v.until <= now);
  if (!slot) {
    const weakest = vs.reduce((a, b) => (b.prio < a.prio || (b.prio === a.prio && b.at < a.at) ? b : a));
    if (weakest.prio >= prio) return;
    slot = weakest;
  }
  SFX_STAT9.played[kind] = (SFX_STAT9.played[kind] ?? 0) + 1;
  let vi = Math.floor(Math.random() * b.urls.length);
  if (b.urls.length > 1 && prev && vi === prev.v) vi = (vi + 1) % b.urls.length;
  last9.set(kind, { at: now, v: vi });
  slot.kind = kind; slot.prio = prio; slot.at = now; slot.until = now + b.dur * 1000;
  const el = slot.el;
  ambientAudio9();
  try {
    el.pause();
    el.src = b.urls[vi];
    el.volume = Math.max(0, Math.min(1, volume9 * (GAIN9[kind] ?? 1) * (0.45 + 0.55 * Math.max(0, Math.min(1, opt.near ?? 1)))));
    el.currentTime = 0;
    el.play().catch(() => { slot!.until = 0; });
  } catch {
    slot.until = 0;
  }
}

/** 지금 나는 소리를 다 끊는다(멈춤·되감기·탐색). */
export function hushSfx9(): void {
  if (!voices9) return;
  for (const v of voices9) { if (v.until > performance.now()) { v.el.pause(); v.until = 0; } }
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
  write9(VOL_KEY9, String(volume9));
  emit9();
}
export const subscribeSfx9 = (f: () => void): (() => void) => { subs9.add(f); return () => { subs9.delete(f); }; };
