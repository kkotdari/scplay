/* ★ 효과음 합성(2026-10-22, 요청: "재생기에 소리 효과 — 전투·폭발(기계·건물)·생체 폭발(저그 건물)·괴물 꾸웩(저그 유닛)·남녀 비명(테란)·
   전기 지지는 소리(프로브·아콘)·미사일·추진체·광자포·채집(칼 가는 소리)·천둥(스톰)·연기류 발사·글레이브·용접(SCV)·탑승/내림·버로우·신비한 소리(플토 소환)").
   소리 파일을 싣지 않는다 — 원작 소리는 쓸 수 없고 패키지도 커진다. **순수 JS 로 PCM 을 셈해 WAV 로 굽는다**(AudioContext 를 열지 않는다:
   사파리가 무음 스위치를 무시하는 세션으로 넘어간다 — useBgm.ts 머리의 규칙). 구운 WAV 는 <audio> 로 튼다(sfx9.ts).
   한 종류마다 갈래(variant) 몇 벌을 구워 같은 소리가 되풀이되는 티를 줄인다. 22.05kHz 모노 16비트. */

export const SFX_RATE9 = 22050;

/** 굳은 씨앗의 난수(mulberry32) — 같은 갈래는 늘 같은 소리. */
function rng9(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 2차 거르개(RBJ) — 주파수를 표본마다 바꿀 수 있게 계수를 그때그때 셈한다(32 표본마다). */
class Biquad9 {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(private type: "lp" | "hp" | "bp", f: number, private q: number) { this.set(f); }
  set(f: number, q = this.q): void {
    const w = 2 * Math.PI * Math.min(Math.max(f, 20), SFX_RATE9 * 0.45) / SFX_RATE9;
    const c = Math.cos(w); const s = Math.sin(w); const al = s / (2 * q);
    let b0: number; let b1: number; let b2: number;
    if (this.type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (this.type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

type Voice9 = (t: number, i: number) => number;
/** dur 초짜리 판에 fn 을 적고, 32 표본마다 tick(t) 를 부른다(거르개 주파수 갈기). */
function render9(dur: number, fn: Voice9, tick?: (t: number) => void): Float32Array {
  const n = Math.max(1, Math.round(dur * SFX_RATE9));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SFX_RATE9;
    if (tick && (i & 31) === 0) tick(t);
    out[i] = fn(t, i);
  }
  return out;
}
const exp9 = (t: number, k: number): number => Math.exp(-t * k);
/** 앞 a 초 동안 차오르고 그 뒤 k 로 사그라진다. */
const ad9 = (t: number, a: number, k: number): number => (t < a ? t / a : Math.exp(-(t - a) * k));
const sat9 = (x: number, g: number): number => Math.tanh(x * g);

/** 갈색 잡음(적분한 흰 잡음) — 우르릉·폭발의 몸. */
function brown9(r: () => number): () => number {
  let b = 0;
  return () => { b = (b + (r() * 2 - 1) * 0.06) * 0.996; return b * 3.2; };
}

/** 메아리(되먹임 지연) — 판에 직접 더한다. */
function echo9(buf: Float32Array, sec: number, fb: number): Float32Array {
  const d = Math.round(sec * SFX_RATE9);
  const out = new Float32Array(buf.length + d * 4);
  out.set(buf);
  for (let i = d; i < out.length; i += 1) out[i] += out[i - d] * fb;
  return out;
}

/** 봉우리를 peak 로 맞추고 끝 4ms 를 접는다(딸깍 소리 막기). */
function finish9(buf: Float32Array, peak: number): Float32Array {
  let m = 0;
  for (let i = 0; i < buf.length; i += 1) m = Math.max(m, Math.abs(buf[i]));
  const k = m > 0 ? peak / m : 0;
  const tail = Math.min(buf.length, Math.round(0.004 * SFX_RATE9));
  for (let i = 0; i < buf.length; i += 1) {
    const f = i >= buf.length - tail ? (buf.length - i) / tail : 1;
    buf[i] *= k * f;
  }
  return buf;
}

/* ── 소리 조리법 ───────────────────────────────────────────────────────────── */

/** 총(마린·골리앗 기관포·고스트) — 딱 하는 잡음 터짐 + 짧은 몸. */
function gun9(v: number): Float32Array {
  const r = rng9(101 + v);
  const hp = new Biquad9("hp", 900 + v * 150, 0.8);
  const lp = new Biquad9("lp", 5200, 0.7);
  return finish9(render9(0.11, (t) => {
    const n = r() * 2 - 1;
    const body = Math.sin(2 * Math.PI * (140 - t * 600) * t) * exp9(t, 60) * 0.6;
    return sat9(lp.run(hp.run(n)) * exp9(t, 38 + v * 6) + body, 1.6);
  }), 0.55);
}

/** 굵은 포(시즈탱크·골리앗 대공 아님) — 쿵 + 잡음 꼬리. */
function cannon9(v: number): Float32Array {
  const r = rng9(131 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 2400, 0.7);
  return finish9(render9(0.45, (t) => {
    const thump = Math.sin(2 * Math.PI * (90 - t * 120) * t) * exp9(t, 11);
    return sat9(thump * 1.1 + lp.run(br() + (r() * 2 - 1) * 0.5) * exp9(t, 9), 1.4);
  }, (t) => lp.set(2400 * exp9(t, 6) + 200)), 0.8);
}

/** 기계·건물 폭발 — 저음 쿵 + 갈색 잡음 덩어리 + 바스락 파편. big 이면 길고 낮다. */
function boom9(v: number, big: boolean): Float32Array {
  const r = rng9((big ? 211 : 201) + v); const br = brown9(r);
  const lp = new Biquad9("lp", 3000, 0.8);
  const dur = big ? 1.5 : 0.8;
  const k = big ? 2.6 : 4.5;
  return finish9(render9(dur, (t) => {
    const thump = Math.sin(2 * Math.PI * ((big ? 55 : 75) - t * 30) * t) * exp9(t, big ? 4 : 7);
    const body = lp.run(br() * 1.4 + (r() * 2 - 1) * 0.35) * ad9(t, 0.006, k);
    const debris = t > 0.05 && r() < 0.004 * exp9(t, 3) ? (r() * 2 - 1) * 0.8 : 0;
    return sat9(thump * 0.9 + body + debris, 1.8);
  }, (t) => lp.set(3200 * exp9(t, big ? 2.2 : 3.5) + 120)), big ? 0.9 : 0.7);
}

/** 생체 폭발(저그 건물) — 질척한 터짐 · 출렁이는 띠 거르개 · 거품 방울. */
function bioBoom9(v: number): Float32Array {
  const r = rng9(301 + v); const br = brown9(r);
  const bp = new Biquad9("bp", 400, 2.2);
  const lp = new Biquad9("lp", 900, 0.7);
  let bubT = 0; let bubF = 0;
  return finish9(render9(1.2, (t) => {
    const wob = 350 + 250 * Math.sin(2 * Math.PI * (7 + v) * t) * exp9(t, 1.5);
    bp.set(wob);
    const splat = bp.run(br() * 1.2 + (r() * 2 - 1) * 0.4) * ad9(t, 0.01, 3.2) * 1.6;
    const low = lp.run(br()) * exp9(t, 4) * 0.9;
    if (t > bubT) { bubT = t + 0.05 + r() * 0.12; bubF = 180 + r() * 380; }
    const bub = Math.sin(2 * Math.PI * bubF * (1 + (t - bubT) * 4) * t) * Math.max(0, 1 - (bubT - t) * 18) * 0.25 * exp9(t, 2);
    return sat9(splat + low + bub, 1.5);
  }), 0.85);
}

/** 괴물 꾸웩(저그 유닛 죽음) — 성대 톱니파가 아래로 꺾이며 떨고, 거친 숨이 섞인다. */
function squeal9(v: number): Float32Array {
  const r = rng9(401 + v);
  const f1 = new Biquad9("bp", 700, 3); const f2 = new Biquad9("bp", 1500, 4); const f3 = new Biquad9("bp", 2600, 5);
  let ph = 0;
  const base = [520, 380, 640][v % 3];
  return finish9(render9(0.55, (t) => {
    const f0 = base * (1.15 - t * 1.2) * (1 + 0.06 * Math.sin(2 * Math.PI * 23 * t));
    ph += Math.max(60, f0) / SFX_RATE9;
    const saw = (ph % 1) * 2 - 1;
    const src = saw * 0.8 + (r() * 2 - 1) * 0.45;
    const voc = f1.run(src) * 1.2 + f2.run(src) * 0.9 + f3.run(src) * 0.5;
    return sat9(voc * ad9(t, 0.02, 4.5) * 2.2, 2.2);
  }, (t) => { f1.set(700 - t * 500); f2.set(1500 - t * 700); }), 0.55);
}

/** 사람 비명(테란 보병) — 성대 펄스 + 'ㅏ' 세 꼭지(F1 800 · F2 1200 · F3 2500) · 떨림 · 끝이 꺾인다. female 이면 높다. */
function scream9(v: number, female: boolean): Float32Array {
  const r = rng9((female ? 551 : 501) + v);
  const f0b = female ? 520 + v * 30 : 260 + v * 25;
  const s = female ? 1.18 : 1;
  const f1 = new Biquad9("bp", 800 * s, 6); const f2 = new Biquad9("bp", 1250 * s, 8); const f3 = new Biquad9("bp", 2600 * s, 10);
  let ph = 0;
  const dur = 0.75;
  return finish9(render9(dur, (t) => {
    const rise = t < 0.08 ? 0.92 + t : 1 - (t - 0.08) * 0.42;
    const f0 = f0b * rise * (1 + 0.035 * Math.sin(2 * Math.PI * 6.5 * t) + 0.012 * (r() * 2 - 1));
    ph += f0 / SFX_RATE9;
    const p = ph % 1;
    const glot = p < 0.4 ? Math.sin(Math.PI * p / 0.4) : 0; // 성대 펄스(닫힌 몫이 있는 반사인)
    const src = (glot - 0.25) * 1.4 + (r() * 2 - 1) * 0.12;
    const voc = f1.run(src) * 1.0 + f2.run(src) * 0.75 + f3.run(src) * 0.35;
    return sat9(voc * ad9(t, 0.03, 2.2) * 3.2, 1.8);
  }), female ? 0.42 : 0.6);
}

/** 전기 지지직(프로브·아콘·질럿 사이오닉) — 낮은 윙 + 듬성한 방전 펄스 + 높은 쉬익. */
function zap9(v: number): Float32Array {
  const r = rng9(601 + v);
  const hp = new Biquad9("hp", 2500, 0.7);
  let crack = 0;
  return finish9(render9(0.32, (t) => {
    const buzz = Math.sign(Math.sin(2 * Math.PI * (110 + v * 20) * t)) * 0.35 * Math.sin(2 * Math.PI * 7 * t) ** 2;
    if (r() < 0.02) crack = 1;
    crack *= 0.86;
    const spark = (r() * 2 - 1) * crack * 1.4;
    const hiss = hp.run(r() * 2 - 1) * 0.35;
    return sat9((buzz + spark + hiss) * ad9(t, 0.004, 9), 2.5);
  }), 0.5);
}

/** 미사일 발사 — 쿵 + 위로 쓸려 올라가는 쉬익. */
function missile9(v: number): Float32Array {
  const r = rng9(701 + v);
  const bp = new Biquad9("bp", 600, 1.4);
  return finish9(render9(0.6, (t) => {
    const thump = Math.sin(2 * Math.PI * (110 - t * 80) * t) * exp9(t, 22) * 0.9;
    const whoosh = bp.run(r() * 2 - 1) * ad9(t, 0.05, 4.2) * 1.6;
    return sat9(thump + whoosh, 1.6);
  }, (t) => bp.set(500 + t * 3200)), 0.7);
}

/** 추진체 가동(이륙·착륙·공중 수송) — 낮은 우르릉이 차오르고 웅웅 떤다. */
function thruster9(v: number): Float32Array {
  const r = rng9(801 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 500, 0.9);
  const bp = new Biquad9("bp", 1400, 2);
  return finish9(render9(1.0, (t) => {
    const env = t < 0.35 ? t / 0.35 : Math.exp(-(t - 0.35) * 3.2);
    const rumble = lp.run(br()) * 1.4;
    const jet = bp.run(r() * 2 - 1) * 0.5 * (1 + 0.3 * Math.sin(2 * Math.PI * (19 + v * 3) * t));
    return sat9((rumble + jet) * env, 1.4);
  }, (t) => bp.set(900 + t * 900)), 0.4);
}

/** 광자포 — 뿅 하고 아래로 꺾이는 빛 + 반짝 잔향. */
function photon9(v: number): Float32Array {
  let ph = 0; let ph2 = 0;
  const r = rng9(901 + v);
  const raw = render9(0.3, (t) => {
    const f = (1700 + v * 150) * exp9(t, 9) + 220;
    ph += f / SFX_RATE9; ph2 += (f * 1.503) / SFX_RATE9;
    const tone = Math.sin(2 * Math.PI * ph) * 0.8 + Math.sin(2 * Math.PI * ph2) * 0.3;
    return (tone + (r() * 2 - 1) * 0.08 * exp9(t, 40)) * ad9(t, 0.003, 11);
  });
  return finish9(echo9(raw, 0.06, 0.35), 0.5);
}

/** 채집(칼 가는 소리) — 쇠에 긁히는 띠 잡음이 앞뒤로 두 번 · 쇠 울림(빗살 거르개). */
function mine9(v: number): Float32Array {
  const r = rng9(1001 + v);
  const bp = new Biquad9("bp", 3200 + v * 300, 6);
  const d = Math.round(SFX_RATE9 / (1900 + v * 170));
  const ring = new Float32Array(d);
  let k = 0;
  return finish9(render9(0.36, (t) => {
    const stroke = Math.sin(Math.PI * Math.min(1, (t % 0.18) / 0.18)) ** 2;
    const x = bp.run(r() * 2 - 1) * stroke;
    const y = x + ring[k] * 0.55;
    ring[k] = y; k = (k + 1) % d;
    return y * ad9(t, 0.01, 4);
  }, (t) => bp.set(3000 + 900 * Math.sin(2 * Math.PI * 2.8 * t) + v * 300)), 0.32);
}

/** 천둥(사이오닉 스톰) — 찢어지는 딱 + 긴 우르릉 + 지직. */
function thunder9(v: number): Float32Array {
  const r = rng9(1101 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 4000, 0.7);
  const hp = new Biquad9("hp", 3000, 0.7);
  return finish9(render9(2.0, (t) => {
    const crack = hp.run(r() * 2 - 1) * exp9(t, 14) * 1.4;
    const roll = lp.run(br() * 1.5) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 1.7 * t + v)) * ad9(t, 0.04, 1.4);
    const fizz = (r() < 0.01 ? (r() * 2 - 1) : 0) * exp9(t, 1.2);
    return sat9(crack + roll + fizz, 1.6);
  }, (t) => lp.set(3000 * exp9(t, 3) + 140)), 0.9);
}

/** 연기류 발사(산성 포자·포자 촉수·디바우러·스커지 따위) — 퍽 하고 낮아지는 쉬익. */
function puff9(v: number): Float32Array {
  const r = rng9(1201 + v);
  const lp = new Biquad9("lp", 3000, 1.2);
  return finish9(render9(0.38, (t) => {
    const pop = Math.sin(2 * Math.PI * (180 - t * 260) * t) * exp9(t, 30) * 0.7;
    return sat9(lp.run(r() * 2 - 1) * ad9(t, 0.012, 9) * 1.4 + pop, 1.4);
  }, (t) => lp.set(2800 * exp9(t, 7) + 300)), 0.5);
}

/** 글레이브(뮤탈리스크) — 휘이잉 도는 쇠 고리 · 위아래로 떠는 음. */
function glaive9(v: number): Float32Array {
  const r = rng9(1301 + v);
  let ph = 0;
  const bp = new Biquad9("bp", 2000, 4);
  return finish9(render9(0.42, (t) => {
    const f = (900 + v * 80) * (1 + 0.18 * Math.sin(2 * Math.PI * 16 * t)) * (1 - t * 0.5);
    ph += f / SFX_RATE9;
    const ringT = Math.sin(2 * Math.PI * ph) * 0.6 + Math.sin(2 * Math.PI * ph * 2.76) * 0.25;
    const air = bp.run(r() * 2 - 1) * 0.6 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 16 * t));
    return (ringT + air) * ad9(t, 0.02, 7);
  }), 0.45);
}

/** 용접(SCV 건설·수리·채집 가스) — 지지직 튀는 불꽃 + 높은 쉬익 · 아크 윙. */
function weld9(v: number): Float32Array {
  const r = rng9(1401 + v);
  const hp = new Biquad9("hp", 3500, 0.7);
  let burst = 0;
  return finish9(render9(0.55, (t) => {
    if (r() < 0.006) burst = 0.6 + r() * 0.4;
    burst *= 0.993;
    const sizzle = hp.run(r() * 2 - 1) * (0.25 + burst);
    const arc = Math.sin(2 * Math.PI * (120 + v * 10) * t) * 0.12 * (r() < 0.5 ? 1 : 0.6);
    const env = Math.min(1, t / 0.02) * Math.min(1, (0.55 - t) / 0.08);
    return (sizzle + arc) * env;
  }), 0.32);
}

/** 탑승/내림 — 쿵 하는 해치 + 서보 윙(타면 올라가고 내리면 내려간다). */
function hatch9(v: number, up: boolean): Float32Array {
  const r = rng9((up ? 1501 : 1551) + v);
  let ph = 0;
  return finish9(render9(0.42, (t) => {
    const clunk = (Math.sin(2 * Math.PI * 95 * t) * 0.9 + (r() * 2 - 1) * 0.4) * exp9(t, 28);
    const st = Math.max(0, t - 0.05);
    const f = up ? 300 + st * 900 : 620 - st * 700;
    ph += f / SFX_RATE9;
    const servo = (Math.sign(Math.sin(2 * Math.PI * ph)) * 0.18 + Math.sin(2 * Math.PI * ph) * 0.2) * (t > 0.05 ? ad9(st, 0.03, 6) : 0);
    return sat9(clunk + servo, 1.4);
  }), 0.5);
}

/** 버로우/언버로우 — 흙 파고드는 바스락(굵은 알갱이) · 묻히면 낮아지고 나오면 높아진다. */
function burrow9(v: number, down: boolean): Float32Array {
  const r = rng9((down ? 1601 : 1651) + v);
  const lp = new Biquad9("lp", 1200, 0.9);
  let grain = 0;
  return finish9(render9(0.5, (t) => {
    if (r() < 0.03) grain = 0.5 + r() * 0.5;
    grain *= 0.97;
    const dirt = lp.run((r() * 2 - 1) * (0.35 + grain));
    const env = Math.sin(Math.PI * Math.min(1, t / 0.5));
    return dirt * env * 1.4;
  }, (t) => lp.set(down ? 1800 - t * 2600 : 500 + t * 2600)), 0.5);
}

/** 신비한 소리(플토 소환·차원 관문) — 어긋난 사인 화음이 올라가며 반짝이고 잔향이 남는다. */
function warp9(v: number): Float32Array {
  const r = rng9(1701 + v);
  const notes = [[392, 587, 784, 1175], [440, 659, 880, 1319], [349, 523, 698, 1047]][v % 3];
  const ph = notes.map(() => 0);
  const raw = render9(1.3, (t) => {
    let s = 0;
    notes.forEach((f, k) => {
      const fk = f * (1 + t * 0.12) * (1 + 0.004 * Math.sin(2 * Math.PI * (5 + k) * t));
      ph[k] += fk / SFX_RATE9;
      const on = Math.max(0, Math.min(1, (t - k * 0.09) / 0.12));
      s += Math.sin(2 * Math.PI * ph[k]) * on * (0.6 - k * 0.1);
    });
    const shimmer = (r() * 2 - 1) * 0.05 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 9 * t));
    return (s + shimmer) * ad9(t, 0.25, 2.2);
  });
  return finish9(echo9(raw, 0.11, 0.45), 0.45);
}

/** 불꽃(파이어뱃) — 굵은 쉬이익 불길. */
function flame9(v: number): Float32Array {
  const r = rng9(1801 + v); const br = brown9(r);
  const bp = new Biquad9("bp", 900, 0.9);
  return finish9(render9(0.4, (t) => {
    const roar = bp.run((r() * 2 - 1) * 0.7 + br() * 0.6) * (1 + 0.35 * Math.sin(2 * Math.PI * 31 * t));
    return sat9(roar * ad9(t, 0.03, 6) * 1.6, 1.5);
  }, (t) => bp.set(900 + 600 * Math.sin(2 * Math.PI * 4 * t))), 0.5);
}

/** 가시·발톱(저글링·히드라·울트라 근접) — 짧은 휙 + 퍽. */
function slash9(v: number): Float32Array {
  const r = rng9(1901 + v);
  const bp = new Biquad9("bp", 2400, 2);
  return finish9(render9(0.16, (t) => {
    const swish = bp.run(r() * 2 - 1) * ad9(t, 0.02, 25);
    const hit = Math.sin(2 * Math.PI * 160 * t) * (t > 0.05 ? exp9(t - 0.05, 40) : 0) * 0.6;
    return swish * 1.5 + hit;
  }, (t) => bp.set(1800 + t * 6000)), 0.45);
}

/* ── 갈래 표 ───────────────────────────────────────────────────────────────── */

export type SfxKind9 =
  | "gun" | "cannon" | "boom" | "boomBig" | "bioBoom" | "squeal" | "screamM" | "screamF" | "zap" | "missile"
  | "thruster" | "photon" | "mine" | "thunder" | "puff" | "glaive" | "weld" | "load" | "unload"
  | "burrow" | "unburrow" | "warp" | "flame" | "slash";

/** 종류 → [갈래 수, 굽는 함수]. */
export const SFX_RECIPES9: Record<SfxKind9, [number, (v: number) => Float32Array]> = {
  gun: [3, gun9], cannon: [2, cannon9], boom: [3, (v) => boom9(v, false)], boomBig: [2, (v) => boom9(v, true)],
  bioBoom: [2, bioBoom9], squeal: [3, squeal9], screamM: [3, (v) => scream9(v, false)], screamF: [2, (v) => scream9(v, true)],
  zap: [3, zap9], missile: [2, missile9], thruster: [2, thruster9], photon: [2, photon9], mine: [3, mine9],
  thunder: [2, thunder9], puff: [2, puff9], glaive: [2, glaive9], weld: [2, weld9],
  load: [2, (v) => hatch9(v, true)], unload: [2, (v) => hatch9(v, false)],
  burrow: [2, (v) => burrow9(v, true)], unburrow: [2, (v) => burrow9(v, false)], warp: [3, warp9],
  flame: [2, flame9], slash: [3, slash9],
};

/** PCM(−1~1) → 16비트 모노 WAV 바이트. */
export function wavBytes9(pcm: Float32Array): Uint8Array {
  const n = pcm.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const str = (o: number, s: string): void => { for (let i = 0; i < s.length; i += 1) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
  str(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, SFX_RATE9, true); dv.setUint32(28, SFX_RATE9 * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, "data"); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Uint8Array(buf);
}
