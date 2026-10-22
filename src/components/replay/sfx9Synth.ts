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
/** 효과음 전체 크기 — 갈래마다의 봉우리(peak)에 곱한다. 0.25(2026-10-22, 요청: "효과음 볼륨 반으로" → "더 반으로" · 1 → 0.5 → 0.25). 구울 때 곱해야 iOS 도 먹는다(<audio>.volume 을 안 받는다). */
const SFX_LEVEL9 = 0.25;

function finish9(buf: Float32Array, peak: number): Float32Array {
  let m = 0;
  for (let i = 0; i < buf.length; i += 1) m = Math.max(m, Math.abs(buf[i]));
  const k = m > 0 ? (peak * SFX_LEVEL9) / m : 0;
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

/** 건물 이륙(테란 건물 리프트 · 2026-10-22, 요청: "건물 리프트 랜딩 소리 추가") — 낮은 엔진 우르릉이 차오르며 분사음이 위로 올라간다. */
function liftOff9(v: number): Float32Array {
  const r = rng9(801 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 420, 0.9);
  const bp = new Biquad9("bp", 700, 1.6);
  return finish9(render9(1.1, (t) => {
    const env = t < 0.45 ? t / 0.45 : Math.exp(-(t - 0.45) * 3.6);
    const rumble = lp.run(br()) * 1.3;
    const jet = bp.run(r() * 2 - 1) * 0.55 * (1 + 0.25 * Math.sin(2 * Math.PI * (17 + v * 3) * t));
    const motor = Math.sin(2 * Math.PI * (70 + 60 * Math.min(1, t / 0.8)) * t) * 0.25;
    return sat9((rumble + jet + motor) * env, 1.3);
  }, (t) => bp.set(600 + Math.min(1, t / 0.8) * 900)), 0.4);
}

/** 건물 착륙 — 분사음이 아래로 잦아들다 마지막에 묵직한 쿵(받침이 땅에 닿음). */
function landing9(v: number): Float32Array {
  const r = rng9(851 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 420, 0.9);
  const bp = new Biquad9("bp", 1300, 1.6);
  return finish9(render9(1.0, (t) => {
    const jetEnv = t < 0.1 ? t / 0.1 : t < 0.55 ? 1 : Math.exp(-(t - 0.55) * 9);
    const jet = (bp.run(r() * 2 - 1) * 0.5 + lp.run(br()) * 0.9) * jetEnv;
    const thudT = t - 0.55;
    const thud = thudT < 0 ? 0 : Math.sin(2 * Math.PI * (62 - thudT * 40) * thudT) * Math.exp(-thudT * 9) * 1.3;
    return sat9(jet + thud, 1.3);
  }, (t) => bp.set(1300 - Math.min(1, t / 0.55) * 800)), 0.42);
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

/** 채집 — 낮고 부드러운 사각임 두 번 + 아주 옅은 낮은 툭.
 *  ★ 부드럽게(2026-10-22, 요청: "자원캐는 소리 좀더 부드러운 소리로") — 옛 판은 3.2kHz 좁은 띠(Q 6) 잡음에 쇠 울림(빗살 되먹임 0.55)을 얹은 '칼 가는' 소리였다.
 *  ★ 많이 낮게(같은 날, 되요청: "너무 높아 많이 낮춰야 해 부드럽게") — 1.1~1.5kHz 띠 + 2.4kHz 저역 + 1.2kHz 수정 울림도 높게 들렸다. 갈색 잡음을
 *  350~500Hz 넓은 띠(Q 0.8)로 · 위를 800Hz 로 깎고 · 울림을 걷고 · 140Hz 언저리의 부드러운 툭만 남긴다. 봉우리 0.22 → 0.2. */
function mine9(v: number): Float32Array {
  const r = rng9(1001 + v); const br = brown9(r);
  const bp = new Biquad9("bp", 420 + v * 40, 0.8);
  const lp = new Biquad9("lp", 800, 0.7);
  const fk = 130 + v * 12;
  return finish9(render9(0.4, (t) => {
    const ph = t % 0.2;
    const stroke = Math.sin(Math.PI * Math.min(1, ph / 0.2)) ** 2;
    const hush = lp.run(bp.run(br())) * stroke;
    const knock = Math.sin(2 * Math.PI * fk * t) * exp9(ph, 30) * 0.35;
    return (hush + knock) * ad9(t, 0.03, 3);
  }, (t) => bp.set(420 + 80 * Math.sin(2 * Math.PI * 2.5 * t) + v * 40)), 0.2);
}

/** SCV 채집 — 드릴(2026-10-22, 요청: "SCV 채집 소리는 드릴 소리(높지 않게)") — 모터가 도는 낮은 톱니파(170Hz 언저리 · 돌 때 살짝 떨림)를 700Hz 아래로 깎고,
 *  날이 돌을 갈 때의 거친 떨림(45Hz 로 여닫는 잡음)을 얹어 두 번 드르륵. */
function mineScv9(v: number): Float32Array {
  const r = rng9(2501 + v);
  const lp = new Biquad9("lp", 700, 0.8);
  const bp = new Biquad9("bp", 520, 1.2);
  const f = 165 + v * 12;
  let ph = 0;
  return finish9(render9(0.46, (t) => {
    const q = t % 0.23;
    const on = q < 0.19 ? Math.sin(Math.PI * q / 0.19) ** 0.6 : 0;
    ph += (f * (1 + 0.03 * Math.sin(2 * Math.PI * 11 * t))) / SFX_RATE9;
    const saw = lp.run((ph % 1) * 2 - 1) * 0.7;
    const grind = bp.run(r() * 2 - 1) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 45 * t)) * 0.9;
    return (saw + grind) * on * ad9(t, 0.02, 2.2);
  }), 0.2);
}

/** 프로브 채집 — 부드러운 입자 빔 웅웅(2026-10-22) — 낮은 두 사인(어긋난 5도)에 18Hz 떨림 · 옅은 쉬익이 빔을 감싼다. */
function mineProbe9(v: number): Float32Array {
  const r = rng9(2601 + v);
  const bp = new Biquad9("bp", 700, 1.0);
  const f = 175 + v * 12;
  return finish9(render9(0.45, (t) => {
    const env = Math.sin(Math.PI * Math.min(1, t / 0.45)) ** 0.8;
    const trem = 0.65 + 0.35 * Math.sin(2 * Math.PI * 18 * t);
    const tone = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.35;
    const air = bp.run(r() * 2 - 1) * 0.25;
    return (tone * trem + air) * env;
  }), 0.2);
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

/** 글레이브(뮤탈) — 타닥타닥 튀는 칼날 소리(2026-10-22, 요청: "글레이브 소리 타닥타닥 · 칼 소리 같은"). 옛 판은 웅웅 떠는 쇳소리 한 줄기였다.
 *  날이 몸에 차례로 튀듯 짧은 쇠 '탁'이 넷(0 · 60 · 115 · 165ms, 뒤로 갈수록 작게) — 탁마다 짧은 잡음 딸깍 + 쇠 울림 둘(낮게 · 빨리 사그라짐). */
function glaive9(v: number): Float32Array {
  const r = rng9(1301 + v);
  const bp = new Biquad9("bp", 2200 + v * 150, 3);
  const hits = [0, 0.06, 0.115, 0.165];
  const f1 = 1350 + v * 90; const f2 = f1 * 1.47;
  return finish9(render9(0.32, (t) => {
    let s = 0; let n = 0;
    hits.forEach((h, k) => {
      const u = t - h;
      if (u < 0) return;
      const g = 1 - k * 0.18;
      n += Math.exp(-u * 90) * g;
      s += (Math.sin(2 * Math.PI * f1 * u) * 0.5 + Math.sin(2 * Math.PI * f2 * u) * 0.25) * Math.exp(-u * 45) * g;
    });
    return bp.run(r() * 2 - 1) * n * 1.2 + s;
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

/** 소환 시작(소환구가 나타남) — 환상적인 겹화음(2026-10-22, 요청: "소환구 소리 좀 더 환상적으로 아름답게") — 레·라·레·미·라(add9) 다섯 음을 아래부터 차례로 부드럽게 열고,
 *  음마다 세 겹(±0.35% 어긋남 · 합창)으로 반짝이게 하고, 높은 별빛 방울을 흩뿌린 뒤 긴 메아리 둘로 공간을 연다. */
function warp9(v: number): Float32Array {
  const r = rng9(1701 + v);
  const base = [293.66, 440, 587.33, 659.25, 880].map((f) => f * [1, 1.122, 0.891][v % 3]);
  const det = [1, 1.0035, 0.9965];
  const ph = base.map(() => det.map(() => 0));
  const twinkles = Array.from({ length: 9 }, (_, k) => ({ at: 0.15 + k * 0.11 + r() * 0.05, f: 1760 * (1 + Math.floor(r() * 4) * 0.25) }));
  const raw = render9(1.5, (t) => {
    let s = 0;
    base.forEach((f, k) => {
      const on = Math.max(0, Math.min(1, (t - k * 0.08) / 0.35));
      det.forEach((d, j) => {
        ph[k][j] += (f * d * (1 + 0.002 * Math.sin(2 * Math.PI * 5.5 * t))) / SFX_RATE9;
        s += Math.sin(2 * Math.PI * ph[k][j]) * on * (0.32 - k * 0.04);
      });
    });
    let tw = 0;
    for (const w of twinkles) { const u = t - w.at; if (u >= 0) tw += Math.sin(2 * Math.PI * w.f * u) * Math.exp(-u * 14) * 0.18; }
    return s * ad9(t, 0.3, 1.6) + tw;
  });
  return finish9(echo9(echo9(raw, 0.13, 0.42), 0.31, 0.3), 0.42);
}

/* ★ 소환구 소리 셋으로 가름(2026-10-22, 요청: "소환구 소환 처음·끝에 나는 소리와 중간에 웅웅 나는 소리 구분") — 처음 = warp(위 · 구가 나타남) ·
   가운데 = warpHum(구가 떠 있는 동안 되풀이 · 낮은 웅웅) · 끝 = warpEnd(물마루가 흐르며 건물이 드러남 · 같은 날 "더 환상적으로 · 특히 완성" → 위로 굴러 오르는 종 칠화음 · 아래 warpEnd9). */
/** 소환구 웅웅 — 낮은 두 사인이 살짝 어긋나 맥놀이(웅–웅) + 한 옥타브 위 옅게. 1.6초 · 앞뒤를 부드럽게 접어 되풀이가 이어진다. */
function warpHum9(v: number): Float32Array {
  const f = 98 + v * 7;
  return finish9(render9(1.6, (t) => {
    const env = Math.sin(Math.PI * Math.min(1, t / 1.6)) ** 0.6;
    const beat = 0.6 + 0.4 * Math.sin(2 * Math.PI * 2.4 * t);
    const s = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * (f + 1.7) * t) * 0.8 + Math.sin(2 * Math.PI * f * 2 * t) * 0.25;
    return s * beat * env;
  }), 0.4);
}

/** 소환 끝(물마루가 흐르며 건물이 드러남) — 가장 아름답게(2026-10-22, 요청: "특히 완성") — 맑은 종이 라장조 칠화음으로 위로 굴러 오르고(라·도#·미·솔#·라·도#),
 *  그 아래 같은 화음이 부풀었다 사라지며, 맨 끝에 높은 별빛 하나. 종 = 사인 셋(1 · 2.01 · 3.98배 · 위로 갈수록 빨리 사그라짐). 메아리 둘(짧게 · 길게)로 여운. */
function warpEnd9(v: number): Float32Array {
  const shift = [1, 1.0595, 0.9439][v % 3];
  const arp = [880, 1108.73, 1318.51, 1661.22, 1760, 2217.46].map((f) => f * shift);
  const pad = [220, 277.18, 329.63, 415.3].map((f) => f * shift);
  const raw = render9(1.6, (t) => {
    let s = 0;
    arp.forEach((f, k) => {
      const u = t - k * 0.075;
      if (u < 0) return;
      const g = 0.42 - k * 0.03;
      s += (Math.sin(2 * Math.PI * f * u) + Math.sin(2 * Math.PI * f * 2.01 * u) * 0.3 * Math.exp(-u * 6) + Math.sin(2 * Math.PI * f * 3.98 * u) * 0.12 * Math.exp(-u * 12))
        * Math.exp(-u * 3.2) * g;
    });
    const swell = t < 0.5 ? t / 0.5 : Math.exp(-(t - 0.5) * 2.6);
    for (const f of pad) s += Math.sin(2 * Math.PI * f * t) * 0.09 * swell;
    const star = t - 0.5;
    if (star >= 0) s += Math.sin(2 * Math.PI * 3520 * shift * star) * Math.exp(-star * 7) * 0.12;
    return s;
  });
  return finish9(echo9(echo9(raw, 0.11, 0.38), 0.27, 0.32), 0.44);
}

/** 저그 공사 고치 — 심장 소리(쿵–쿵 · 2026-10-22, 요청: "공사고치 소리는 약간 심장 소리 비슷하게"). 낮은 사인 두 번(둘째가 작고 조금 높다)에 살 같은 둔탁함. */
function heart9(v: number): Float32Array {
  const r = rng9(2401 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 160, 0.8);
  const f = 52 + v * 5;
  const beat = (t: number, k: number): number => (t < 0 ? 0 : (Math.sin(2 * Math.PI * (f + k * 8) * t) + lp.run(br()) * 0.5) * ad9(t, 0.012, 18));
  return finish9(render9(0.6, (t) => sat9(beat(t, 0) + beat(t - 0.24, 1) * 0.65, 1.3)), 0.5);
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

/* ★ 근접 타격 셋(2026-10-22, 요청: "타격소리도 필요해 — 질럿이나 히드라 저글링 등등") — 옛 판은 근접·가시가 다 칼질(slash) 하나라 누가 때리는지 안 갈렸다. */
/** 사이오닉 칼날(질럿·다크) — 휙 + 사이오닉 지잉(톱니파) + 둔탁한 맞음. */
function blade9(v: number): Float32Array {
  const r = rng9(2001 + v);
  const bp = new Biquad9("bp", 2000, 1.5);
  const f = 220 + v * 25;
  let ph = 0;
  return finish9(render9(0.22, (t) => {
    const swish = bp.run(r() * 2 - 1) * ad9(t, 0.015, 18) * 0.9;
    ph += (f * (1 + 0.5 * exp9(t, 20))) / SFX_RATE9;
    const buzz = sat9(((ph % 1) * 2 - 1) * 1.4, 1.2) * ad9(t, 0.01, 14) * 0.45;
    const thud = Math.sin(2 * Math.PI * 130 * t) * (t > 0.03 ? exp9(t - 0.03, 30) : 0) * 0.7;
    return swish + buzz + thud;
  }, (t) => bp.set(1400 + t * 9000)), 0.5);
}

/** 발톱(저글링·울트라·브루들링) — 젖은 할큄 두 번 + 낮은 퍽. */
function claw9(v: number): Float32Array {
  const r = rng9(2101 + v);
  const lp = new Biquad9("lp", 1600, 0.9);
  const bp = new Biquad9("bp", 900, 3);
  return finish9(render9(0.2, (t) => {
    const k = t < 0.07 ? ad9(t, 0.004, 40) : ad9(t - 0.07, 0.004, 35) * 0.8;
    const rip = lp.run(r() * 2 - 1) * k * 1.4;
    const wet = bp.run(r() * 2 - 1) * k * 0.8;
    const thump = Math.sin(2 * Math.PI * (95 - t * 120) * t) * exp9(t, 22) * 0.6;
    return sat9(rip + wet + thump, 1.4);
  }, (t) => bp.set(700 + 500 * Math.sin(2 * Math.PI * 30 * t) + v * 120)), 0.5);
}

/** 가시(히드라·럴커) — 내리꽂는 휙(높은 음이 떨어짐) + 쉭 + 딱. */
function spine9(v: number): Float32Array {
  const r = rng9(2201 + v);
  const hp = new Biquad9("hp", 2500, 0.8);
  let ph = 0;
  return finish9(render9(0.15, (t) => {
    ph += Math.max(0, 1800 + v * 120 - t * 9000) / SFX_RATE9;
    const whip = Math.sin(2 * Math.PI * ph) * (t < 0.05 ? ad9(t, 0.003, 50) : 0) * 0.5;
    const hiss = hp.run(r() * 2 - 1) * exp9(t, 55) * 0.6;
    const tick = Math.sin(2 * Math.PI * 180 * t) * (t > 0.04 ? exp9(t - 0.04, 45) : 0) * 0.7;
    return whip + hiss + tick;
  }), 0.45);
}

/* ── 갈래 표 ───────────────────────────────────────────────────────────────── */

export type SfxKind9 =
  | "gun" | "cannon" | "boom" | "boomBig" | "bioBoom" | "squeal" | "screamM" | "screamF" | "zap" | "missile"
  | "liftOff" | "landing" | "photon" | "mine" | "thunder" | "puff" | "glaive" | "weld" | "load" | "unload"
  | "burrow" | "unburrow" | "warp" | "flame" | "slash" | "blade" | "claw" | "spine" | "warpHum" | "warpEnd" | "heart" | "mineScv" | "mineProbe";

/** 종류 → [갈래 수, 굽는 함수]. */
export const SFX_RECIPES9: Record<SfxKind9, [number, (v: number) => Float32Array]> = {
  gun: [3, gun9], cannon: [2, cannon9], boom: [3, (v) => boom9(v, false)], boomBig: [2, (v) => boom9(v, true)],
  bioBoom: [2, bioBoom9], squeal: [3, squeal9], screamM: [3, (v) => scream9(v, false)], screamF: [2, (v) => scream9(v, true)],
  zap: [3, zap9], missile: [2, missile9], liftOff: [2, liftOff9], landing: [2, landing9], photon: [2, photon9], mine: [3, mine9],
  thunder: [2, thunder9], puff: [2, puff9], glaive: [2, glaive9], weld: [2, weld9],
  load: [2, (v) => hatch9(v, true)], unload: [2, (v) => hatch9(v, false)],
  burrow: [2, (v) => burrow9(v, true)], unburrow: [2, (v) => burrow9(v, false)], warp: [3, warp9],
  flame: [2, flame9], slash: [3, slash9], blade: [3, blade9], claw: [3, claw9], spine: [3, spine9],
  warpHum: [2, warpHum9], warpEnd: [3, warpEnd9], heart: [2, heart9], mineScv: [2, mineScv9], mineProbe: [2, mineProbe9],
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
