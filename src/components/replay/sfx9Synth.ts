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
/** 효과음 전체 크기 — 갈래마다의 봉우리(peak)에 곱한다. 0.75(2026-10-22, 요청: "효과음 볼륨 반으로" → "더 반으로" → "다시 0.4 정도로 복귀" → "효과음 75 로 올리고" · 1 → 0.5 → 0.25 → 0.4 → 0.75).
 *  이제 Web Audio 라 음량 손잡이(주 GainNode)도 곱해진다(sfx9 ★). */
const SFX_LEVEL9 = 0.75;

/** ★ 둥근 알갱이(2026-11-08, 지적: "저그 효과음 잡음 심함 — 건물 터지거나 유닛 죽을 때") — 옛 소리들은 표본 **한 개**짜리 무작위 튐(초당 50~110번)을 '질척 · 파편'으로 썼는데,
 *  한 표본 튐은 온 대역에 퍼져 **지글거리는 잡음**으로 들렸다. 튐을 낮은 거르개(hz)에 통과시켜 짧은 둥근 '톡'으로 바꾼다(거르면 작아지므로 gain 으로 되돌린다). */
class Grain9 {
  private f: Biquad9;
  constructor(hz: number, private gain = 3) { this.f = new Biquad9("lp", hz, 0.7); }
  run(x: number): number { return this.f.run(x) * this.gain; }
}
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

/** 총(마린·골리앗 기관포·고스트) — **빠른 연발 두두두두**(2026-11-02, 요청: "소총류 소리를 더 빠른 두두두두 소리로") — 딱 하는 잡음 터짐 + 짧은 몸 한 방을
 *  48ms 간격으로 네 번(뒤로 갈수록 0.82배씩 작게 · 한 방마다 높이·길이 살짝 흔들림). 옛: 한 방(0.11초). */
function gun9(v: number): Float32Array {
  const r = rng9(101 + v);
  const hp = new Biquad9("hp", 900 + v * 150, 0.8);
  const lp = new Biquad9("lp", 5200, 0.7);
  const N9 = 4; const GAP9 = 0.048; const ONE9 = 0.07;
  const jit9 = Array.from({ length: N9 }, () => r());
  const raw9 = render9(GAP9 * (N9 - 1) + ONE9, (t) => {
    const fn9 = hp.run(r() * 2 - 1);   // 거르개는 한 표본에 한 번(겹친 방마다 돌리면 상태가 깨진다)
    let o = 0;
    for (let k = 0; k < N9; k += 1) {
      const tk = t - k * GAP9;
      if (tk < 0 || tk > ONE9) continue;
      const g = Math.pow(0.82, k);
      const f0 = 150 - jit9[k] * 30;
      const body = Math.sin(2 * Math.PI * (f0 - tk * 700) * tk) * exp9(tk, 75) * 0.6;
      o += (fn9 * exp9(tk, 55 + v * 6 + jit9[k] * 10) + body) * g;
    }
    return sat9(lp.run(o), 1.6);
  });
  /* ★ 울림(2026-11-03, 요청: "소총류 소리가 너무 마른 느낌 · 조금 울림을") — 작은 방 메아리 둘(41ms 되먹임 0.30 · 97ms 0.20 — 엇갈린 길이라 빗살 소리가 안 난다)을
     어둡게(울림만 3.2kHz 아래로) 얹는다. 원음은 그대로 · 꼬리 0.4초 남짓. */
  const lpW9 = new Biquad9("lp", 3200, 0.7);
  const wet9 = echo9(echo9(Float32Array.from(raw9), 0.041, 0.30), 0.097, 0.20);
  const out9 = new Float32Array(wet9.length);
  for (let i = 0; i < wet9.length; i += 1) out9[i] = (i < raw9.length ? raw9[i] : 0) + lpW9.run(wet9[i] - (i < raw9.length ? raw9[i] : 0)) * 0.85;
  return finish9(out9, 0.55);
}

/** ★ 소총 **한 발**(2026-11-05, 요청: "소리도 좀 더 다발총 소리처럼 변형 · 마린 같은 경우 공격 중에 다다다 다다다 가 아니라 다다다다다다 이렇게 똑같은 박자로
 *  이어지게 계산해서") — 묶음(gun9 네 발)을 공격마다 틀던 것을 걷고, 이 한 발을 sfx9 gunBeat9 가 사수 쿨다운으로 셈한 고른 간격으로 잇는다.
 *  기관총 결: 터지는 딱(고역 잡음 · 빠른 꺼짐) + 짖는 가운데(700Hz 띠 잡음) + 낮은 퍽(110 → 60Hz) + 노리쇠 찰칵(12ms 뒤 짧은 쇳소리) · 작은 방 울림 한 겹. */
function gunShot9(v: number): Float32Array {
  /* ★ **타**(2026-11-09 셋째, 요청: "마린 — 4개가 정확히 타타타타라고 들리게") — 한 발을 짧고 또렷하게: 날카로운 딱 + 짧게 터지는 몸(꺼짐 빠르게) + 짧은 쿵.
     울림은 **흩어진 잔향**(23 · 37 · 53ms 겹침 · 낮은 되먹임)으로 — 옛 메아리(0.17 · 0.29초 · 둘째)는 묶음 안 다음 발 사이에 또 한 번 '타'로 들려 발 수가 흐려졌다. */
  const r = rng9(301 + v);
  const hp = new Biquad9("hp", 2400, 0.7);
  const bp = new Biquad9("bp", 1000, 0.7);
  const lp = new Biquad9("lp", 7500, 0.7);
  const raw9 = render9(0.09, (t) => {
    const n = r() * 2 - 1;
    const crack = hp.run(n) * exp9(t, 260) * 1.5;
    const blast = bp.run(n) * exp9(t, 55) * 2.0;
    const thump = Math.sin(2 * Math.PI * (110 - t * 600) * t) * exp9(t, 45) * 0.8;
    return sat9(lp.run(crack + blast + thump), 2.2);
  });
  const lpW9 = new Biquad9("lp", 2600, 0.7);
  const wet9 = echo9(echo9(echo9(Float32Array.from(raw9), 0.023, 0.32), 0.037, 0.3), 0.053, 0.26);
  const out9 = new Float32Array(Math.min(wet9.length, Math.round(0.36 * SFX_RATE9)));
  for (let i = 0; i < out9.length; i += 1) {
    const d9 = i < raw9.length ? raw9[i] : 0;
    out9[i] = d9 + lpW9.run(wet9[i] - d9) * 0.55 * Math.exp(-i / SFX_RATE9 * 7);
  }
  return finish9(out9, 0.6);
}

/** 굵은 포(시즈탱크·골리앗 대공 아님) — 쿵 + 잡음 꼬리. */
function cannon9(v: number): Float32Array {
  /* 잡음 걷기(2026-11-09 여섯째, 지적: "탱크 공격 소리인지 피격 소리인지에 잡음 있음") — 옛: 갈색 + **흰 잡음 0.5** 를 2.4kHz 저역으로 · 포화 1.4 라 쉬익 지글이 섞였다.
     이제 흰 잡음을 걷고 갈색만 1.1kHz 아래로 · 쿵(90 → 55Hz · 2배음) 몸을 키우고 · 포화 1.15. */
  const r = rng9(131 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 1100, 0.7);
  let ph = 0;
  return finish9(render9(0.45, (t) => {
    ph += (55 + 35 * exp9(t, 9)) / SFX_RATE9;
    const thump = (Math.sin(2 * Math.PI * ph) + Math.sin(4 * Math.PI * ph) * 0.35) * ad9(t, 0.003, 9);
    return sat9(thump * 1.2 + lp.run(br()) * ad9(t, 0.003, 10) * 0.9, 1.15);
  }, (t) => lp.set(700 * exp9(t, 6) + 120)), 0.8);   // 1100 → 700(2026-11-09 여덟째 · 탱크 잡음 둘째)
}

/** 기계·건물 폭발 — 저음 쿵 + 갈색 잡음 덩어리 + 바스락 파편. big 이면 길고 낮다. */
function boom9(v: number, big: boolean): Float32Array {
  /* 잡음 걷기 둘째(2026-11-09 여덟째, 지적: "탱크 착탄에 아직 잡음 강함") — 흰 잡음 · 파편 알갱이를 다 걷고, 몸은 **갈색 잡음만** 저역(600Hz → 120Hz 로 닫힘)으로 ·
     쿵(75 → 45Hz · 배음 둘)을 키우고 · 포화 1.5 → 1.1(찌그러짐이 지글거림으로 들렸다). 큰 폭발(boomBig)도 같은 몸. */
  const r = rng9((big ? 211 : 201) + v); const br = brown9(r);
  const lp = new Biquad9("lp", 600, 0.7);
  const dur = big ? 1.5 : 0.8;
  const k = big ? 2.6 : 4.5;
  let ph = 0;
  return finish9(render9(dur, (t) => {
    ph += ((big ? 40 : 45) + (big ? 25 : 30) * exp9(t, 6)) / SFX_RATE9;
    const thump = (Math.sin(2 * Math.PI * ph) + Math.sin(4 * Math.PI * ph) * 0.4 + Math.sin(6 * Math.PI * ph) * 0.15) * ad9(t, 0.004, big ? 4 : 6.5);
    const body = lp.run(br() * 1.4) * ad9(t, 0.006, k);
    return sat9(thump * 1.0 + body * 1.1, 1.1);
  }, (t) => lp.set(600 * exp9(t, big ? 2.2 : 3.5) + 120)), big ? 0.9 : 0.7);
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
    return sat9(splat + low + bub, 1.3);
  }), 0.8);
}

/** ★ 저그 유닛 죽음 — **생체 조직 폭발 + 저그 울음**(2026-11-02, 요청: "저그 죽음 소리 저거 말고 생체 조직 폭발과 저그 울음소리여야 · 다 변경") — 옛: 꾸웩 하나(톱니 성대만).
 *  ① 울음 — 톱니 성대 340 → 150Hz 로 꺾이며 떨고(느린 떨림 + 빠른 그르렁) · 꼭지 셋 620·1350·2500Hz · 거친 숨 · 0.7초
 *  ② 폭발 — 살이 터지는 철퍽(저역 갈색 잡음 · 900 → 300Hz 로 닫힘) + 깊은 쿵(80 → 45Hz) + 흩어지는 질척 알갱이. pk = 높낮이 배수(소형 저글링·드론·브루들링·스커지 1.35 · 뮤탈 2.2 — "진짜 뮤탈 건 훨씬 높아야" · 꼭지는 √pk). */
function squeal9(v: number, pk = 1): Float32Array {
  /* ★ 저그 죽음 — **짐승 단말마**(2026-11-09 열여섯째, 지적: "저그 울음소리 너무 우스꽝스럽게 들려") — 옛: 340Hz 성대 펄스가 1.08 → 0.44 로 길게 미끄러지는(0.8초 내내) '삐요~'라
     만화 같았다. 이제 목 깊은 **으르렁 + 쉰 비명**: 낮은 성대(기본음 115Hz × pk · 반 박자마다 세기가 갈리는 이중 주기 = 짐승 목 · 느린 지터) → 넓은 공명 셋(Klatt · 500/160 · 1100/220 ·
     2400/320 × √pk)으로 '아악' · 음높이는 짧게 솟았다(1 → 1.12 · 0.08초) 조금만 처진다(0.85 까지 · 미끄럼 없음) · 위에 쉰 바람(띠 잡음 2.6kHz · 음 없음) · 밑에 젖은 철퍽 · 쿵.
     pk: 소형 1.35 · 뮤탈 2.2 · 0.7초. */
  const r = rng9(401 + v + (pk !== 1 ? 53 : 0)); const br = brown9(r);
  const fk = Math.sqrt(pk);
  const R = [new Reso9(500 * fk, 160), new Reso9(1100 * fk, 220), new Reso9(2400 * fk, 320)];
  const bpH = new Biquad9("bp", 2600 * fk, 1.0);
  const lp = new Biquad9("lp", 900, 0.7);
  let ph = 0; let jit = 0; let odd = false; let lastP = 0;
  return finish9(render9(0.7, (t) => {
    jit += ((r() * 2 - 1) - jit) * 0.004;
    const cont = t < 0.08 ? 1 + 0.12 * (t / 0.08) : Math.max(0.85, 1.12 - (t - 0.08) * 0.5);
    const f0 = 115 * pk * cont * (1 + 0.03 * jit);
    ph += f0 / SFX_RATE9;
    const p = ph % 1;
    if (p < lastP) odd = !odd;
    lastP = p;
    const glot = (p < 0.45 ? Math.sin(Math.PI * p / 0.45) : 0) * (odd ? 0.55 : 1);
    const env = ad9(t, 0.02, 3.6);
    let x = (glot - 0.3) * env; let cry = 0;
    for (let k = 0; k < 3; k += 1) { x = R[k].run(x); cry += x * [1, 0.7, 0.4][k]; }
    const hiss = bpH.run(r() * 2 - 1) * ad9(t, 0.01, 5) * 0.35;
    const splat = lp.run(br() * 1.8) * ad9(t, 0.005, 6.5) * 0.9;
    const thump = Math.sin(2 * Math.PI * (80 - t * 50) * t) * exp9(t, 9) * 0.7;
    return sat9(cry * 3.2 + hiss + splat + thump, 1.2);
  }, (t) => { lp.set(900 - 600 * Math.min(1, t / 0.5)); }), 0.62);
}

/** 사람 비명(테란 보병) — ★ **비명답게**(2026-11-09, 요청: "마린 · 메딕 · 파뱃 · 고스트 등 죽음 소리 더 비명처럼") — 옛: 260Hz 성대 펄스 + 'ㅏ' 세 꼭지(낮은 '아~').
 *  이제: 더 높은 기본음(남 380 · 여 760) · 처음 0.12초에 1.3배로 치솟았다가 끝에서 0.65배로 꺾이는 높낮이 · 굵은 떨림(7Hz ± 5%) · 거친 쇳소리(40~70Hz 떨리는 진폭 + 반 높이
 *  아래음 0.3) · 숨 잡음 · 밝은 꼭지(F1 950 · F2 1500 · F3 3000 · 넓게). female 이면 높다 · pk 높낮이 배수(메딕 · 파뱃). */
function scream9(v: number, female: boolean, pk = 1): Float32Array {
  const r = rng9((female ? 551 : 501) + v + (pk !== 1 ? 37 : 0));
  /* 남자 굵게(2026-11-09 다섯째) — 남자 기본음 240Hz · 포먼트 ×0.85 · 아래 옥타브 0.55 · 가슴 울림(bp 320Hz). 여자(메딕)는 760Hz.
     ★ 잡음 걷기 둘째(2026-11-09 여덟째, 지적: "테란 죽음에 아직 잡음 강함") — 참 까닭은 **찌그러짐**: 목소리를 3.4배 키워 tanh(×2~2.6)에 넣어(합 7~9배) 네모파처럼 깎여
     온 대역이 지글거렸다. 이제 1.3배 · 포화 1.2 · 거친 떨림(rasp 진폭 변조 0.3)도 0.12 로 · 숨 잡음은 걷는다. 비명 꼴(솟았다 떨어지는 음 · 포먼트)은 그대로. */
  const f0b = (female ? 760 + v * 30 : 240 + v * 16) * pk;
  const s = (female ? 1.15 : 0.85) * Math.sqrt(pk);
  const f1 = new Biquad9("bp", 950 * s, 4); const f2 = new Biquad9("bp", 1500 * s, 5); const f3 = new Biquad9("bp", 3000 * s, 6);
  const chest = new Biquad9("bp", 320 * Math.sqrt(pk), 1.5);
  const lpO = new Biquad9("lp", female ? 5000 : 3800, 0.7);
  let ph = 0; let ph2 = 0;
  const dur = 0.85;
  const rf9 = 40 + r() * 30;
  const subK = female ? 0.3 : 0.55;
  let jit9 = 0;
  return finish9(render9(dur, (t) => {
    const rise = t < 0.12 ? 0.85 + (t / 0.12) * 0.45 : t < 0.55 ? 1.3 - (t - 0.12) * 0.25 : 1.19 - (t - 0.55) * 1.8;
    jit9 += ((r() * 2 - 1) - jit9) * 0.002;
    const f0 = f0b * Math.max(0.6, rise) * (1 + 0.05 * Math.sin(2 * Math.PI * 7 * t) + 0.04 * jit9);
    ph += f0 / SFX_RATE9; ph2 += (f0 * 0.5) / SFX_RATE9;
    const p = ph % 1;
    const glot = p < 0.35 ? Math.sin(Math.PI * p / 0.35) : 0;
    const sub = Math.sin(2 * Math.PI * ph2) * subK;
    const rasp = 0.88 + 0.12 * Math.sin(2 * Math.PI * rf9 * t + 3 * Math.sin(2 * Math.PI * 11 * t));
    const src = ((glot - 0.22) * 1.5 + sub) * rasp;
    const voc = f1.run(src) * 1.0 + f2.run(src) * 0.85 + f3.run(src) * 0.5 + (female ? 0 : chest.run(src) * 0.9);
    return sat9(lpO.run(voc) * ad9(t, 0.02, 2.0) * 1.3, 1.2);
  }), female ? 0.42 : 0.58);
}

/** ★ 프로토스 보병 죽음(질럿 · 다크 · 하이템플러 · 아콘 · 2026-11-09, 지적: "질럿 죽을 때 소리에도 지직거림이 있는 듯") — 옛: 전기 지지직(zap9 · 한 표본 방전 펄스 + 네모 윙 +
 *  포화 2.5)이라 갈라졌다. 이제 **사이오닉이 흩어지는** 소리: 620 → 150Hz 로 떨어지는 떨리는 음(6Hz 떨림 · 부드러운 2배음) + 숨 섞인 낮은 잡음(900Hz 아래) +
 *  둥근 반짝이 알갱이(Grain9 · 2.4kHz 아래 · 듬성) — 포화 1.2 · 0.7초. */
/** Klatt 공명기(포먼트 하나) — 중심 f · 대역폭 bw(Hz). 목소리 합성용(질럿 사망 '흐어'). */
class Reso9 {
  private a = 0; private b = 0; private c = 0; private y1 = 0; private y2 = 0;
  constructor(f: number, bw: number) { this.set(f, bw); }
  set(f: number, bw: number): void {
    const T = 1 / SFX_RATE9;
    this.c = -Math.exp(-2 * Math.PI * bw * T);
    this.b = 2 * Math.exp(-Math.PI * bw * T) * Math.cos(2 * Math.PI * f * T);
    this.a = 1 - this.b - this.c;
  }
  run(x: number): number { const y = this.a * x + this.b * this.y1 + this.c * this.y2; this.y2 = this.y1; this.y1 = y; return y; }
}
function tossDie9(v: number): Float32Array {
  /* ★ 질럿 사망 — **사람 목소리 '흐어~'**(2026-11-09 열다섯째, 지적: "질럿 죽음 목소리로 흐어야 · 저런 게 아니라") — 열넷째 판은 띠 거르개(Q 3~4 · 넓음)에 80Hz 펄스라
     목소리가 아니라 '웅' 하는 기계음이었다. 이제 **목소리 합성**(Klatt 꼴):
       · 성대 = Rosenberg 펄스(열림 60% · 닫힘 날카롭게) → 한 극 저역(−6dB/옥) · 기본음 128 → 92Hz(신음처럼 천천히 가라앉음) · 느린 떨림(지터 · 진폭 흔들림)
       · 숨 = 성대 주기에 맞춰 출렁이는 잡음(숨 섞인 목소리 · 끝으로 갈수록 숨이 많아짐)
       · 성도 = 공명기 넷 차례로(**ㅓ**: 570/80 · 860/90 · 2450/140 · 3400/220 Hz) — 좁은 대역폭이라 모음이 또렷하다
       · 앞머리 **ㅎ** = 같은 성도를 지나는 숨만 0.14초 → 목소리가 그 위로 차오른다
     울림 = 짧은 잔향(빗살 셋) + 메아리. 1.15초. */
  const r = rng9(2501 + v);
  /* (열일곱째, 요청: "짧게 · 더 음 변화 없고 낮게") — 기본음 128 → 92 를 **88 → 82Hz**(거의 평탄) · 공명 ×0.92(더 굵게) · 1.15 → 0.6초 · 'ㅎ' 0.14 → 0.08초 · 잔향 꼬리 짧게. */
  /* (스물한째, 요청: "질럿 죽음 음 자체가 더 높아야 할 듯") — 기본음 82 → 112Hz(오르내림 꼴은 그대로 · 112 → 129 → 101) · 공명 ×0.92 를 걷어 옛 'ㅓ'(570/860/2450/3400)로. */
  const R = [new Reso9(570, 80), new Reso9(860, 90), new Reso9(2450, 140), new Reso9(3400, 220)];
  const G = [1, 0.7, 0.35, 0.15];
  let ph = 0; let tilt = 0; let jit = 0; let shm = 0;
  const raw = render9(0.6, (t) => {
    jit += ((r() * 2 - 1) - jit) * 0.003; shm += ((r() * 2 - 1) - shm) * 0.004;
    /* 조금 올라갔다 내려오기(열아홉째, 요청: "질럿 목소리는 좀 올라가다가 내려오기") — 82Hz 에서 0.15초에 +15%(94Hz)까지 오르고 끝(0.6초)엔 −10%(74Hz)로. */
    const cont9 = t < 0.15 ? 1 + 0.15 * Math.sin((Math.PI / 2) * (t / 0.15)) : 1.15 - (t - 0.15) * 0.55;
    const f0 = (112 + v * 2) * cont9 * (1 + 0.008 * jit + 0.004 * Math.sin(2 * Math.PI * 5 * t));
    ph += f0 / SFX_RATE9;
    const p = ph % 1;
    const glot = p < 0.4 ? 0.5 * (1 - Math.cos(Math.PI * p / 0.4)) : p < 0.6 ? Math.cos((Math.PI / 2) * (p - 0.4) / 0.2) : 0;
    tilt += (glot - tilt) * 0.35;
    const voiced = t < 0.05 ? 0 : (t < 0.17 ? Math.sin((Math.PI / 2) * (t - 0.05) / 0.12) ** 2 : Math.exp(-(t - 0.17) * 5.5));
    const breathK = t < 0.08 ? Math.min(1, t / 0.02) : 0.22;
    const breath = (r() * 2 - 1) * (t < 0.08 ? 1 : 0.4 + 0.6 * glot) * breathK * (t < 0.08 ? 1 : Math.exp(-(t - 0.08) * 4)) * 0.35;
    const src = (tilt - 0.3) * voiced * (1 + 0.06 * shm) + breath;
    let y = 0; let x = src;
    for (let k = 0; k < 4; k += 1) { x = R[k].run(x); y += x * G[k] * (k === 0 ? 1 : 0.6); }
    return y;
  });
  const out = new Float32Array(raw.length + Math.round(0.3 * SFX_RATE9));
  out.set(raw);
  const wet = new Float32Array(out.length);
  for (const [ms, fb] of [[37, 0.32], [53, 0.3], [71, 0.28]] as const) {
    const d = Math.round(ms / 1000 * SFX_RATE9); const c = new Float32Array(out.length);
    for (let i = 0; i < out.length; i += 1) c[i] = out[i] + (i >= d ? c[i - d] * fb : 0);
    for (let i = 0; i < out.length; i += 1) wet[i] += c[i] / 3;
  }
  for (let i = 0; i < out.length; i += 1) out[i] = out[i] * 0.7 + wet[i] * 0.4;
  return finish9(echo9(out, 0.13, 0.12), 0.5);
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

/** 건물 이륙(테란 건물 리프트) — ★ **공기를 내뿜는다**(2026-11-02, 요청: "테란 건물 띄울 때 공기 내뿜는 소리") — 압축 공기가 터져 나오는 푸슉(넓은 띠 잡음이 확 터졌다
 *  1.4kHz → 600Hz 로 내려가며 잦아듦) + 밑에서 차오르는 낮은 분사 웅(70 → 95Hz) + 끝의 짧은 쉬익 꼬리. 1.1초. 옛: 엔진 우르릉 + 위로 올라가는 분사음. */
function liftOff9(v: number): Float32Array {
  const r = rng9(801 + v); const br = brown9(r);
  const bp = new Biquad9("bp", 1400, 0.9);
  const lp = new Biquad9("lp", 380, 0.8);
  const hp = new Biquad9("hp", 3000, 0.7);
  let ph = 0;
  return finish9(render9(1.1, (t) => {
    const puff = bp.run(r() * 2 - 1) * ad9(t, 0.012, 3.4) * 1.6;
    ph += (70 + 25 * Math.min(1, t / 0.6)) / SFX_RATE9;
    const thrust = (Math.sin(2 * Math.PI * ph) * 0.5 + lp.run(br()) * 0.9) * (t < 0.35 ? t / 0.35 : Math.exp(-(t - 0.35) * 2.4)) * 0.8;
    const tail = hp.run(r() * 2 - 1) * ad9(Math.max(0, t - 0.05), 0.05, 5) * 0.35;
    return sat9(puff + thrust + tail, 1.4);
  }, (t) => bp.set(1400 - 800 * Math.min(1, t / 0.5) + 80)), 0.62);
}

/** 건물 착륙 — ★ **땅에 내려앉는다**(2026-11-02, 요청: "내릴 때 땅에 내리는 소리") — 무거운 쿵(62 → 38Hz) + 다리 받침 두 번 탁탁(엇박 · 쇠) + 흙먼지 쓸림(갈색 잡음 저역) + 끝의 짧은 유압 칙. 0.9초. */
function landing9(v: number): Float32Array {
  const r = rng9(851 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 700, 0.7);
  const hp = new Biquad9("hp", 2600, 0.8);
  const k = [1, 1.06, 0.94][v % 3];
  const foot = (u: number): number => (u < 0 ? 0 : (Math.sin(2 * Math.PI * 310 * k * u) + Math.sin(2 * Math.PI * 820 * k * u) * 0.4) * exp9(u, 40));
  return finish9(render9(0.9, (t) => {
    const thump = Math.sin(2 * Math.PI * (62 * k - t * 30) * t) * exp9(t, 7) * 1.1;
    const legs = foot(t - 0.005) * 0.5 + foot(t - 0.06) * 0.4;
    const dust = lp.run(br() * 1.6) * ad9(t, 0.02, 4.5) * 0.8;
    const t2 = t - 0.32;
    const hiss = t2 > 0 ? hp.run(r() * 2 - 1) * ad9(t2, 0.01, 9) * 0.3 : 0;
    return sat9(thump + legs + dust + hiss, 1.6);
  }), 0.78);
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

/** ★ 포톤 캐넌 — **퉁**(2026-11-01, 요청: "포토 소리 퉁퉁 느낌으로") — 옛 판(photon9 · 1.7kHz 에서 꺾이는 뿅)은 드라군·스카우트(plasma)가 그대로 쓰고,
 *  캐넌만 낮은 북 울림으로 가른다: 170 → 80Hz 로 떨어지는 사인 몸(빠른 감쇠) + 2배음 옅게 + 앞 4ms 의 막힌 잡음 톡(900Hz 아래) + 짧은 메아리 하나. */
function photonC9(v: number): Float32Array {
  let ph = 0;
  const r = rng9(1951 + v);
  const lp = new Biquad9("lp", 900, 0.7);
  const raw = render9(0.32, (t) => {
    const f = 80 + (90 + v * 12) * exp9(t, 22);
    ph += f / SFX_RATE9;
    const body = (Math.sin(2 * Math.PI * ph) + Math.sin(4 * Math.PI * ph) * 0.22) * ad9(t, 0.004, 13);
    const click = lp.run(r() * 2 - 1) * exp9(t, 160) * 0.9;
    return sat9(body + click, 1.4);
  });
  return finish9(echo9(raw, 0.085, 0.22), 0.62);
}

/** ★ 드라군 포 — **웅 하고 날아가는 바람**(2026-11-09 다섯째, 요청: "날아가는 소리가 좀 이상해 · 웅 하고 날아가기 · 음은 거의 없고 바람 소리 같은") — 옛 휘잉(사인 휘파람
 *  700 → 1200Hz)은 음이 또렷해 이상했다. 이제 **음 없는 바람**: 갈색 + 흰 잡음을 낮은 띠(Q 1.1 · 260 → 520 → 340Hz 로 부풀었다 가라앉음)와 저역(lp 180 · 웅 몸)에
 *  통과시킨다 · 0.06초 부풀고 사그라짐 · 0.45초. 맞을 때는 dragoonHit9(펑). */
function dragoonShot9(v: number): Float32Array {
  const r = rng9(2071 + v); const br = brown9(r);
  const bpW = new Biquad9("bp", 300, 1.1);
  const lpB = new Biquad9("lp", 180, 0.7);
  return finish9(render9(0.45, (t) => {
    const n9 = br() * 0.8 + (r() * 2 - 1) * 0.35;
    const wind = bpW.run(n9) * 1.6;
    const body = lpB.run(n9) * 1.1;
    return sat9((wind + body) * ad9(t, 0.06, 6), 1.2);
  }, (t) => { const u9 = Math.min(1, t / 0.3); bpW.set(260 + 260 * Math.sin(Math.PI * u9) + (u9 >= 1 ? 80 : 80 * u9) + v * 20); }), 0.5);
}

/** ★ 드라군 탄 맞음 — **펑**(2026-11-09 셋째) — 둥근 폭발: 낮은 쿵(110 → 45Hz · 2 · 3 배음으로 폰에서도 들림) + 터지는 잡음(1.4kHz → 300Hz 로 닫히는 저역) + 짧은 메아리 · 0.55초. */
function dragoonHit9(v: number): Float32Array {
  let ph = 0;
  const r = rng9(2091 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 1400, 0.7);
  const raw = render9(0.55, (t) => {
    const f = 45 + (65 + v * 6) * exp9(t, 10);
    ph += f / SFX_RATE9;
    const boom = (Math.sin(2 * Math.PI * ph) + Math.sin(4 * Math.PI * ph) * 0.45 + Math.sin(6 * Math.PI * ph) * 0.2) * ad9(t, 0.004, 7) * 1.1;
    const blast = lp.run(br() * 1.4 + (r() * 2 - 1) * 0.5) * ad9(t, 0.003, 9) * 1.2;
    return sat9(boom + blast, 1.5);
  }, (t) => lp.set(300 + 1100 * exp9(t, 8)));
  return finish9(echo9(raw, 0.09, 0.18), 0.72);
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
  const hp = new Biquad9("hp", 2200, 0.7);
  const gF = new Grain9(1500, 3);
  return finish9(render9(2.0, (t) => {
    const crack = hp.run(r() * 2 - 1) * exp9(t, 18) * 0.6;   // 0.9 → 0.6 · 꺼짐 14 → 18(2026-11-09 셋째 · 지지직 줄임)
    const roll = lp.run(br() * 1.5) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 1.7 * t + v)) * ad9(t, 0.04, 1.4);
    /* (2026-11-09, 지적: "스톰 쓰면 지직임 소리 발생") — 옛 fizz 는 **한 표본 튐**(r < 0.01 이면 ±1)이라 지글거렸고(2026-11-08 죽음·폭발에서 고친 그 병), 고역 딱(hp 3kHz)도
       포화(1.6)에 걸려 갈라졌다. 튐은 둥근 알갱이(Grain9 · 1.5kHz 아래)로 · 딱은 2.2kHz 위 · 0.9 · 포화 1.3. */
    const fizz = gF.run(r() < 0.006 ? (r() * 2 - 1) * 0.8 : 0) * exp9(t, 1.2);
    return sat9(crack + roll + fizz, 1.3);
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

/** 용접(SCV 건설·수리·채집 가스) — 부드럽게(2026-10-26, 요청: "용접소리 거슬려서 좀 부드럽게") — 옛 판은 3.5kHz 위 흰 잡음 쉬익에 불꽃이 세게 튀었다.
 *  이제 1.2~2.6kHz 띠의 잔 지글거림(작은 알갱이만 · 큰 튐 없음)을 저역으로 한 번 더 누르고, 아래에 낮은 아크 웅을 옅게 깐다 · 앞뒤를 천천히 연다. */
function weld9(v: number): Float32Array {
  const r = rng9(1401 + v);
  const bp = new Biquad9("bp", 1800 + v * 200, 0.9);
  const lp = new Biquad9("lp", 2600, 0.7);
  let grain = 0;
  return finish9(render9(0.55, (t) => {
    if (r() < 0.02) grain = 0.2 + r() * 0.25;
    grain *= 0.985;
    const sizzle = lp.run(bp.run(r() * 2 - 1) * (0.3 + grain));
    const arc = Math.sin(2 * Math.PI * (110 + v * 8) * t) * 0.07;
    const env = Math.sin(Math.PI * Math.min(1, t / 0.55)) ** 0.8;
    return (sizzle + arc) * env;
  }), 0.22);
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
  /* ★ 땅 파는 '도도도'(2026-11-09 여덟째, 요청: "버로우는 예전에 땅 파는 듯한 도도도 소리 있었던 것 같은데") — 옛: 흙 잡음 한 덩이(쓸려 내려가는 저역)뿐이라 판 맛이 없었다.
     이제 흙을 긁어 파는 박자: 초당 15번(파고들 때 점점 빨라짐 · 나올 때 느려짐) 짧은 '도' — 낮은 퉁(130 → 70Hz) + 흙 덩이(갈색 잡음 lp 900) · 그 밑에 흙 쓸림.
     들어갈 땐 박자가 점점 작아지며 묻히고, 나올 땐 커지다 흙이 털린다. 0.55초. */
  const r = rng9((down ? 1601 : 1651) + v); const br = brown9(r);
  const lpD = new Biquad9("lp", 900, 0.8);
  const lpS = new Biquad9("lp", 500, 0.7);
  const D = 0.55;
  const hits: number[] = [];
  for (let tt = 0.01; tt < D - 0.05;) { hits.push(tt); const u = tt / D; tt += 1 / (down ? 12 + u * 8 : 18 - u * 7) * (0.9 + r() * 0.2); }
  let ph = 0; let last = -1;
  return finish9(render9(D, (t) => {
    let h = -1; for (const a of hits) if (a <= t) h = a;
    if (h !== last) { last = h; ph = 0; }
    const u = t / D;
    const amp = down ? 1 - u * 0.6 : 0.5 + u * 0.5;
    const ht = h >= 0 ? t - h : 1;
    ph += (70 + 60 * exp9(ht, 40)) / SFX_RATE9;
    const thud = Math.sin(2 * Math.PI * ph) * exp9(ht, 45) * 0.9;
    const dirt = lpD.run(br()) * exp9(ht, 30) * 0.9;
    const slide = lpS.run(br()) * 0.25 * Math.sin(Math.PI * Math.min(1, u));
    return sat9((thud + dirt) * amp + slide, 1.15);
  }), 0.5);
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
  /* ★ **전기가 들어오는 소리 · 한 갈래**(2026-11-03, 요청: "프로토스 건물 착공 완공음 갈래 없이 1개로 · 완공음 나팔소리가 아닌 전기 들어오는 소리로 좀 부드럽게") —
     옛 판(미·솔 두 갈래 · 톱니+사인 음)은 음높이가 또렷해 나팔처럼 들렸다. 이제 **음이 아니라 기계가 깨어나는 결**: ① 도는 웅 — 70 → 220Hz 로 감기며 오르는 사인
     (2·3배음 옅게 · 800Hz 저역) ② 전원 웅웅 — 0.15초 뒤 들어오는 120Hz 사인에 3배음 한 줌(잔 맥놀이) ③ 숨 — 띠 거르개 잡음이 300 → 1400Hz 로 열리며 아주 옅게.
     들어옴 0.22초(둥근) · 붙듦 0.6초 · 놓음 0.55초(cos²). 지직·딱 소리는 없다. v 는 안 쓴다(한 갈래). */
  void v;
  const r = rng9(1601);
  const lp = new Biquad9("lp", 800, 0.7);
  const bp = new Biquad9("bp", 300, 1.6);
  let ph = 0; let pm = 0;
  const HOLD9 = 0.8; const REL9 = 0.55;
  return finish9(render9(HOLD9 + REL9, (t) => {
    const f = 70 + 150 * (1 - Math.exp(-t / 0.35));
    ph += f / SFX_RATE9; pm += (120 + 0.8 * Math.sin(2 * Math.PI * 3 * t)) / SFX_RATE9;
    const spin = Math.sin(2 * Math.PI * ph) + Math.sin(4 * Math.PI * ph) * 0.3 + Math.sin(6 * Math.PI * ph) * 0.1;
    const m9 = Math.min(1, Math.max(0, (t - 0.15) / 0.3)); const mains = (Math.sin(2 * Math.PI * pm) + Math.sin(6 * Math.PI * pm) * 0.12) * m9 * m9 * (3 - 2 * m9) * 0.55;
    const air = bp.run(r() * 2 - 1) * 0.08;
    const a9 = Math.min(1, t / 0.22); const att = a9 * a9 * (3 - 2 * a9);
    const rel = t < HOLD9 ? 1 : Math.cos((Math.PI / 2) * Math.min(1, (t - HOLD9) / REL9)) ** 2;
    return sat9(lp.run(spin * 0.5 + mains) + air, 0.7) * att * rel;
  }, (t) => bp.set(300 + 1100 * Math.min(1, t / 0.8))), 0.22);
}

/** 저그 부화(알·번데기가 깨짐 · 2026-10-26, 요청: "저그 부화소리 거슬려서 좀 부드럽게") — 옛 판은 공용 퍽(puff · 3kHz 잡음 + 날 선 팝)이었다.
 *  ★ 다시(2026-10-27, 요청: "저그 알 고치등 부화소리 너무 높고 날카로움 · 좀더 낮고 부드럽게 생물적으로 터지는 느낌") — 10-26 판의 몸은 130→75Hz 사인이라
 *  폰 스피커가 거의 못 내고, 남는 것은 700Hz 2차 거름을 새어 나온 흰 잡음의 위쪽과 208Hz 방울뿐이라 높고 날카롭게 들렸다. 이제 몸이 **갈색 잡음의 '철퍽'**이다:
 *  거름 끝이 900 → 170Hz 로 내려가는 4차 저역(살이 찢어지며 젖어 가라앉는 결) + 그 아래 95→48Hz 둥근 퉁(포화로 배음을 얹어 폰에서도 '낮게' 들린다) +
 *  뒤따르는 작은 방울 셋(185~130Hz 에서 아래로 미끄러지는 짧은 꾸룩)을 같은 저역에 묶는다 — 마지막에 1.1kHz 4차 저역을 한 번 더 걸어 위쪽을 걷는다. 앞머리는 8ms 로 연다. */
function eggPop9(v: number): Float32Array {
  const r = rng9(2501 + v); const br = brown9(r);
  const lpA = new Biquad9("lp", 900, 0.9); const lpB = new Biquad9("lp", 900, 0.6);
  const outA = new Biquad9("lp", 1100, 0.7); const outB = new Biquad9("lp", 1100, 0.7);
  let ph = 0;
  const f0 = 95 + v * 8;
  /** 방울 셋 — 시작(초)·높이(Hz)·크기. 갈래마다 조금씩 다르다. */
  const bub = [[0.07 + r() * 0.03, 185 + r() * 30, 0.2], [0.15 + r() * 0.04, 155 + r() * 25, 0.14], [0.24 + r() * 0.05, 130 + r() * 20, 0.1]];
  const bph = [0, 0, 0];
  return finish9(render9(0.48, (t) => {
    const splat = lpB.run(lpA.run(br() + (r() * 2 - 1) * 0.15)) * ad9(t, 0.008, 9) * 1.4;
    ph += (f0 - 47 * Math.min(1, t / 0.18)) / SFX_RATE9;
    const thump = Math.sin(2 * Math.PI * ph) * ad9(t, 0.01, 11);
    let gl = 0;
    for (let k = 0; k < 3; k += 1) {
      const u = t - bub[k][0];
      if (u < 0) continue;
      bph[k] += (bub[k][1] * (1 - 0.38 * Math.min(1, u / 0.06))) / SFX_RATE9;
      gl += Math.sin(2 * Math.PI * bph[k]) * ad9(u, 0.006, 30) * bub[k][2];
    }
    return outB.run(outA.run(sat9(splat + thump * 0.8 + gl, 1.6)));
  }, (t) => { const f = 170 + 730 * Math.exp(-t * 9); lpA.set(f); lpB.set(f); }), 0.3);
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
function spine9(v: number, k = 1): Float32Array {
  /* k — 작은 판(드론 · k 1.35 · 2026-11-09 스물두째, 요청: "드론 공격 소리를 히드라 소리의 소형 버전으로"): 모든 주파수 × k · 시간 ÷ k(짧게). */
  /* ★ 히드라 — **'퉤' 뱉기**(2026-11-09 스물째, 지적: "히드라 저거 아니야 · 퉤 뱉는 소리(입술 마찰음 + 가시가 툭 하고 뱉어지는 소리)") — 열여덟째 물방울 판을 걷었다.
     ① 터짐 'ㅌ' — 입술이 떨어지는 짧은 파열(2ms 잡음 저역 3k + 낮은 퐁 150Hz)
     ② 입술 마찰 '웨~' — 띠 잡음 두 갈래(입 모양 'ㅔ' — 1.9kHz · 520Hz)를 35Hz 로 떨리는 입술(진폭)로 · 0.13초
     ③ 가시 '툭' — 0.025초에 뱉어지는 둔한 툭(330 → 170Hz · 빨리 꺼짐) + 짧은 나무 딸깍(bp 950 · Q 3). 0.2초. */
  const r = rng9(2201 + v);
  const lpP = new Biquad9("lp", 3000 * k, 0.7);
  const bpF2 = new Biquad9("bp", 1900 * k, 1.6);
  const bpF1 = new Biquad9("bp", 520 * k, 1.4);
  const bpK = new Biquad9("bp", 950 * k, 3);
  let ph = 0;
  return finish9(render9(0.2 / k, (t0) => {
    const t = t0 * k;
    const n = r() * 2 - 1;
    const plo = lpP.run(n) * exp9(t, 700) * 1.4 + Math.sin(2 * Math.PI * 150 * k * t0) * exp9(t, 90) * 0.5;
    const flut = 0.55 + 0.45 * Math.sin(2 * Math.PI * 35 * k * t0 + r() * 0.3);
    const lip = (bpF2.run(n) * 1.1 + bpF1.run(n) * 0.6) * flut * ad9(Math.max(0, t - 0.004), 0.006, 17) * (t > 0.004 ? 1 : 0) * 1.4;
    const tk = t - 0.025;
    let tuk = 0;
    if (tk > 0) { ph += (170 + 160 * exp9(tk, 50)) * k / SFX_RATE9; tuk = Math.sin(2 * Math.PI * ph) * exp9(tk, 55) * 0.9 + bpK.run(n) * exp9(tk, 160) * 0.8; }
    return sat9(plo + lip + tuk, 1.15);
  }), 0.62);
}

/** ★ 질럿 — **창 찌름**(2026-11-10 · 아래 ★) · 옛 **창으로 찌르는 쇠 마찰**(2026-11-09, 요청: "질럿 공격 소리 — 창으로 찌르는 쇠 마찰 소리로") — 옛: 다크와 같은 칼질(blade9). 찌르는 휙(2→5kHz 로 오르는 띠 잡음) +
 *  쇠 긁힘(좁은 띠 두 겹 2.9 · 4.7kHz 가 아래로 미끄러짐) + 쇠 울림(어긋난 배음 1830 · 2710 · 4190Hz 가 0.25초에 걸쳐 잦아듦) + 박히는 퍽. */
function zealotStab9(v: number): Float32Array {
  /* ★ **창 찌름**(2026-11-10, 지적: "질럿 공격 소리 깡통 같아 · 창 느낌으로 변경") — 아홉째 판(맞부딪는 쇳소리 · 어긋난 배음 넷 1.4~4.8kHz)이 깡통처럼 울렸다. 배음 울림을 걷고
     **공기를 가르며 꽂히는 날**로: ① 찌르는 휙 '슉' — 띠 잡음(Q 2.2)이 0.07초에 900 → 3.2kHz 로 빠르게 오른다 · ② 사이오닉 날 끝 '츠' — 1.25kHz 언저리 좁은 띠 잡음(Q 7)이
     짧게(+25% 오르며) 꺼진다 · ③ 박힘 '툭' — 0.03초 뒤 낮은 툭(165 → 95Hz · 빨리 꺼짐). 칼날 둘이라 두 번(0.085초 · 둘째는 ×0.78). 0.24초.
     옛 아홉째 판 몸: 쇳소리 P = [1620, 2710, 3940, 5400] × 0.88 · A = [0.55, 0.45, 0.32, 0.2] · exp9(u, 38 + k·10) 두 번(0.012 · 0.087) + 앞머리 2ms 잡음 · hp 4kHz 쓸림 0.12. */
  const r = rng9(2451 + v);
  const bpW = new Biquad9("bp", 900, 2.2);
  const bpE = new Biquad9("bp", 1250, 7);
  const T2 = 0.085;
  const loc = (t: number): [number, number] => (t < T2 ? [t, 1] : [t - T2, 0.78]);
  let ph = 0;
  let lastG = 1;
  return finish9(render9(0.24, (t) => {
    const n = r() * 2 - 1;
    const [u, g] = loc(t);
    if (g !== lastG) { ph = 0; lastG = g; }
    const whoosh = bpW.run(n) * ad9(u, 0.012, 22) * 1.2;
    const edge = bpE.run(n) * ad9(u, 0.004, 40) * 1.6;
    const tu = u - 0.03;
    let thud = 0;
    if (tu > 0) { ph += (95 + 70 * exp9(tu, 40)) / SFX_RATE9; thud = Math.sin(2 * Math.PI * ph) * exp9(tu, 35) * 0.55; }
    return sat9((whoosh + edge + thud) * g, 1.2);
  }, (t) => {
    const [u] = loc(t);
    bpW.set((900 + 2300 * Math.min(1, u / 0.07)) * (1 + v * 0.03));
    bpE.set(1250 * (1 + 0.25 * Math.min(1, u / 0.05)) * (1 + v * 0.02));
  }), 0.27);
}

/** ★ 가시가 땅을 뚫고 솟음(성큰·럴커 · 2026-11-02, 요청: "성큰 럴커 가시가 땅을 뚫고 솟는 소리") — 흙 깨지는 바스락(갈색 잡음 + 듬성한 알갱이) 위로
 *  띠 거르개가 300 → 2600Hz 로 치솟는 '쑥' · 밑에 짧은 쿵. 0.38초. */
function spikeEarth9(v: number): Float32Array {
  const r = rng9(1301 + v); const br = brown9(r);
  const bp = new Biquad9("bp", 300, 3.5);
  const lp = new Biquad9("lp", 1800, 0.7);
  const gS = new Grain9(1200, 2.5);
  /* ★ 덜 거칠게(2026-11-08, 지적: "저그 효과음 잡음 심한데 성큰 효과음 의심됨") — 성큰 · 럴커가 여럿이면 이 소리가 겹쳐 쌓인다. 알갱이(grit · 흰 잡음 튐) 0.9 → 0.35 · 확률 0.06 → 0.03 ·
     쑥(띠 잡음) 1.4 → 0.8 · 치솟는 끝 2600 → 1700Hz · 포화 1.7 → 1.15(찌그러짐이 잡음으로 들렸다) · 쿵은 조금 더(0.7 → 0.9) · 전체 0.62 → 0.5. */
  return finish9(render9(0.38, (t) => {
    const crack = lp.run(br() * 1.0) * ad9(t, 0.004, 16);
    const grit = gS.run(r() < 0.03 * exp9(t, 12) ? (r() * 2 - 1) * 0.35 : 0);
    const shoot = bp.run(r() * 2 - 1) * ad9(t, 0.03, 11) * 0.8;
    const thump = Math.sin(2 * Math.PI * (110 - t * 160) * t) * exp9(t, 24) * 0.9;
    return sat9(crack + grit + shoot + thump, 1.15);
  }, (t) => bp.set(300 + 1400 * Math.min(1, t / 0.14))), 0.5);
}
/** ★ 가디언 공격 — 낮은 웅~(2026-11-02, 요청: "가디언 낮은 공격 웅~ 소리") — 70Hz 언저리 둥근 소리가 천천히 부풀었다 사그라든다(0.7초) · 살짝 오르는 높이 · 2배음 · 낮은 잡음 숨결. */
function guardHum9(v: number): Float32Array {
  const r = rng9(1351 + v);
  const lp = new Biquad9("lp", 400, 0.7);
  const f0 = 68 + v * 6;
  let ph = 0;
  return finish9(render9(0.7, (t) => {
    ph += (f0 * (1 + 0.12 * Math.min(1, t / 0.35))) / SFX_RATE9;
    const body = Math.sin(2 * Math.PI * ph) + Math.sin(4 * Math.PI * ph) * 0.35 + Math.sin(6 * Math.PI * ph) * 0.1;
    const air = lp.run(r() * 2 - 1) * 0.25;
    return sat9((body + air) * ad9(t, 0.12, 3.6), 1.3);
  }), 0.7);
}
/** ★ 드라군 사망 — 용수철 망가지는 기계 소리(2026-11-02, 요청: "드라군 사망시 기계(스프링 망가지는) 소리") — 떨리며 내려가는 '보잉'(빠른 떨림이 잦아드는 사인 900 → 260Hz)
 *  + 금속 쨍(어긋난 배음 셋) 두 번 + 밑의 작은 퍽. 0.9초. */
function springBreak9(v: number): Float32Array {
  const r = rng9(1401 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 900, 0.7);
  let ph = 0;
  const clank = (u: number, k: number): number => (u < 0 ? 0 : (Math.sin(2 * Math.PI * 1230 * k * u) + Math.sin(2 * Math.PI * 2710 * k * u) * 0.6 + Math.sin(2 * Math.PI * 3960 * k * u) * 0.4) * exp9(u, 22));
  return finish9(render9(0.9, (t) => {
    const f = (900 - 640 * Math.min(1, t / 0.7)) * (1 + 0.18 * Math.sin(2 * Math.PI * (34 - t * 20) * t) * exp9(t, 3));
    ph += (f * (1 + v * 0.05)) / SFX_RATE9;
    const boing = Math.sin(2 * Math.PI * ph) * ad9(t, 0.005, 3.2) * 0.7;
    const hit = clank(t - 0.01, 1) * 0.55 + clank(t - 0.19, 0.93) * 0.35;
    const thud = lp.run(br()) * exp9(t, 10) * 0.8;
    return sat9(boing + hit + thud, 1.5);
  }), 0.62);
}
/** ★ 스캔 — 신비한 울림(2026-11-02, 요청: "스캔 신비한 울림 소리") — 살짝 어긋난 두 음(맥놀이)의 맑은 울림이 부풀었다 잦아들고 높은 종소리 하나 · 긴 메아리. 1.6초. */
function scanHum9(v: number): Float32Array {
  const sh = [1, 1.0595, 0.9439][v % 3];
  const a = 392 * sh; const b = a * 1.006; const c = a * 1.5;
  const raw = render9(1.6, (t) => {
    const sw = t < 0.35 ? t / 0.35 : Math.exp(-(t - 0.35) * 2.1);
    const pad = (Math.sin(2 * Math.PI * a * t) + Math.sin(2 * Math.PI * b * t) + Math.sin(2 * Math.PI * c * t) * 0.45) * sw * 0.35;
    const bell = t > 0.05 ? Math.sin(2 * Math.PI * a * 4 * (t - 0.05)) * Math.exp(-(t - 0.05) * 5) * 0.18 : 0;
    return pad + bell;
  });
  return finish9(echo9(echo9(raw, 0.17, 0.35), 0.37, 0.25), 0.42);
}

/** ★ 소환구 착공 — 에너지가 모이는 낮은 소리(2026-11-02, 요청: "소환구 착공 시도 에너지가 집약되는 듯한 낮은 소리로") — 옛: 마법 공용 warp.
 *  낮은 웅(55 → 98Hz 로 오르며 커진다 · 2·3배음) + 빨려 드는 숨(띠 거르개 잡음이 250 → 1100Hz 로 좁혀 오름) + 끝의 부드러운 '툭'(모임). 1.3초 · 끝이 가장 크다. */
function warpCharge9(v: number): Float32Array {
  /* ★ **부드럽게**(2026-11-03, 요청: "착공음도 좀 부드럽게") — 끝의 '툭'(140Hz 딱)을 걷고 · 빨려 드는 숨(잡음)을 0.9 → 0.35 · 거르개 900 → 600Hz · 포화 1.4 → 0.7 ·
     부풂을 둥근 곡선(smoothstep)으로 · 끝은 0.2초 뚝 대신 0.45초 cos² 로 놓는다. 한 갈래(v 안 씀). */
  void v;
  const r = rng9(1451);
  const bp = new Biquad9("bp", 250, 1.8);
  const lp = new Biquad9("lp", 600, 0.7);
  const UP9 = 1.1; const REL9 = 0.45; const f0 = 55;
  let ph = 0;
  return finish9(render9(UP9 + REL9, (t) => {
    const u = Math.min(1, t / UP9);
    ph += (f0 * (1 + 0.78 * u * u)) / SFX_RATE9;
    const sw = u * u * (3 - 2 * u);
    const rel = t < UP9 ? 1 : Math.cos((Math.PI / 2) * Math.min(1, (t - UP9) / REL9)) ** 2;
    const env = sw * rel;
    const drone = (Math.sin(2 * Math.PI * ph) + Math.sin(4 * Math.PI * ph) * 0.3 + Math.sin(6 * Math.PI * ph) * 0.08) * env;
    const suck = bp.run(r() * 2 - 1) * env * 0.35;
    return sat9(lp.run(drone + suck), 0.7);
  }, (t) => bp.set(250 + 650 * Math.min(1, t / UP9))), 0.5);
}

/** ★ 저글링 타격 — 통(2026-11-02, 요청: "저글링 둥둥둥 치는 소리" → 되요청 "좀 더 울림 있는 통통 소리로") — 울리는 북통: 230 → 175Hz 로 살짝 내리는 몸이
 *  천천히(0.3초) 잦아들고 그 1.48배 둘째 울림 · 짧은 딱 · 작은 메아리 하나(통 안의 울림). 휘두를 때마다(sfx9Cues 박자). */
function zlingHit9(v: number): Float32Array {
  const r = rng9(1501 + v);
  const bp = new Biquad9("bp", 2200, 1.2);
  const f0 = 230 * [1, 1.06, 0.94][v % 3];
  let ph = 0;
  const raw = render9(0.32, (t) => {
    ph += (f0 - (f0 - 175) * Math.min(1, t / 0.06)) / SFX_RATE9;
    const body = Math.sin(2 * Math.PI * ph) * ad9(t, 0.002, 11) + Math.sin(2 * Math.PI * ph * 1.48) * ad9(t, 0.002, 19) * 0.35;
    const tick = bp.run(r() * 2 - 1) * exp9(t, 160) * 0.35;
    return sat9(body + tick, 1.3);
  });
  return finish9(echo9(raw, 0.045, 0.22), 0.6);
}
/** ★ 울트라 타격 — 팍(2026-11-02, 요청: "울트라 팍팍 치는 소리") — 날 선 때림: 1.4kHz 띠 잡음이 확 터졌다 바로 끊기고 밑에 무거운 90Hz 퍽. 0.17초. */
function ultraHit9(v: number): Float32Array {
  const r = rng9(1551 + v); const br = brown9(r);
  const bp = new Biquad9("bp", 1400 * [1, 1.12, 0.9][v % 3], 1.6);
  const lp = new Biquad9("lp", 500, 0.7);
  return finish9(render9(0.17, (t) => {
    const smack = bp.run(r() * 2 - 1) * ad9(t, 0.0015, 34) * 1.6;
    const thud = (Math.sin(2 * Math.PI * (95 - t * 120) * t) * 0.8 + lp.run(br()) * 0.6) * exp9(t, 22);
    return sat9(smack + thud, 1.8);
  }), 0.7);
}

/** ★ 대공 미사일 — 낮은 연기 추진(2026-11-02, 요청: "스카웃 발키리 레이스 대공 낮은 연기추진 소리") — 점화 퍽(85Hz) + 낮게 깔린 연기 분사(갈색 잡음 · 저역 700Hz → 380Hz)
 *  + 떨리는 낮은 추진 웅(60Hz 언저리 · 연기가 터지듯 일렁임). 0.75초 · 천천히 사그라든다. */
function missileLow9(v: number): Float32Array {
  const r = rng9(1601 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 700, 0.8);
  const f0 = 60 * [1, 1.1, 0.92][v % 3];
  let ph = 0;
  return finish9(render9(0.75, (t) => {
    ph += f0 * (1 + 0.15 * Math.sin(2 * Math.PI * 13 * t)) / SFX_RATE9;
    const ign = Math.sin(2 * Math.PI * (85 - t * 60) * t) * exp9(t, 28) * 0.8;
    const smoke = lp.run(br() * 1.5 + (r() * 2 - 1) * 0.25) * ad9(t, 0.04, 3.2) * (1 + 0.3 * Math.sin(2 * Math.PI * 17 * t));
    const hum = Math.sin(2 * Math.PI * ph) * ad9(t, 0.05, 4) * 0.45;
    return sat9(ign + smoke + hum, 1.5);
  }, (t) => lp.set(700 - 320 * Math.min(1, t / 0.6))), 0.62);
}
/** ★ 터렛·골리앗 대공 미사일 — 살짝 높고 가는 추진 + 연기(2026-11-02, 요청: "터렛 골리앗 대공 살짝 높고 가는 추진소리 + 연기소리") — 좁은 띠 쉬익(2.4kHz → 3.4kHz · 가늘다)
 *  위에 옅은 연기 잡음(1.1kHz 넓은 띠)과 작은 점화 톡. 0.5초. */
function missileHi9(v: number): Float32Array {
  const r = rng9(1651 + v);
  const thin = new Biquad9("bp", 2400 * [1, 1.08, 0.94][v % 3], 7);
  const smoke = new Biquad9("bp", 1100, 0.9);
  return finish9(render9(0.5, (t) => {
    const n = r() * 2 - 1;
    const hiss = thin.run(n) * ad9(t, 0.02, 4.6) * 2.2;
    const puff = smoke.run(r() * 2 - 1) * ad9(t, 0.03, 6) * 0.7;
    const ign = Math.sin(2 * Math.PI * (170 - t * 200) * t) * exp9(t, 40) * 0.45;
    return sat9(hiss + puff + ign, 1.4);
  }, (t) => thin.set(2400 + 1000 * Math.min(1, t / 0.35))), 0.5);
}

/** ★ 저그 공사 고치가 펼쳐짐(2026-11-02, 요청: "공사 고치 펼 때 생체조직 펼치는 소리") — 옛: 알 깨짐 공용 뽁(eggPop). 끈적한 살이 늘어나며 벌어진다:
 *  낮게 떨며 오르는 늘어남(70 → 140Hz · 느린 떨림) + 질척임(띠 잡음 400 → 900Hz 가 출렁) + 끈적한 뜯김 톡톡(흩어진 짧은 잡음) + 끝의 축축한 철퍽. 0.9초. */
function fleshUnfold9(v: number): Float32Array {
  const r = rng9(1701 + v); const br = brown9(r);
  const gT = new Grain9(700, 3);
  const bp = new Biquad9("bp", 400, 2.4);
  const lp = new Biquad9("lp", 600, 0.7);
  let ph = 0;
  return finish9(render9(0.9, (t) => {
    const u = Math.min(1, t / 0.7);
    ph += (70 + 70 * u) * (1 + 0.08 * Math.sin(2 * Math.PI * 7 * t)) / SFX_RATE9;
    const stretch = Math.sin(2 * Math.PI * ph) * ad9(t, 0.12, 2.6) * 0.55;
    const squelch = bp.run(br() * 1.2 + (r() * 2 - 1) * 0.3) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 5 * t)) * ad9(t, 0.08, 2.8);
    const tear = gT.run(t > 0.1 && t < 0.75 && r() < 0.0025 ? (r() * 2 - 1) * 0.9 : 0);
    const sk = t - 0.68;
    const splat = sk > 0 ? lp.run(br() * 2) * Math.exp(-sk * 18) * 1.1 : 0;
    return sat9(stretch + squelch + tear + splat, 1.35);
  }, (t) => bp.set(400 + 500 * Math.min(1, t / 0.6))), 0.58);
}

/** ★ 저그 건물 완성 — 고치가 벗겨지며 건물이 섬(2026-11-02, 요청: "완성 시도 알보다 낮고 크고 복잡한 소리로 별도") — 알 깨짐(eggPop)보다 낮고 크고 겹이 많다:
 *  깊은 쿵(58 → 32Hz) + 두꺼운 살덩이 몸(갈색 잡음 저역) + 아래로 미끄러지는 질척임 둘(띠 900 → 300Hz · 엇박) + 껍질 찢어지는 바스락(듬성한 알갱이)
 *  + 낮게 그르렁(42Hz 떨림) · 끝의 거품 방울 몇. 1.4초. */
function zergDone9(v: number): Float32Array {
  /* ★ **팍~ 터지는** 완공(2026-11-09, 요청: "저그 완공 소리 볼륨도 더 줄이고 좀 더 팍~ 터지는 소리로") — 옛: 1.4초 낮은 쿵 + 살 질척 + 끼익 둘 + 으르렁(느리게 부푸는 소리).
     이제 0.7초: 바로 터지는 젖은 팍(넓은 띠 잡음 · 1.8kHz → 500Hz 로 내려가는 띠 · 빠른 꺼짐) + 짧은 쿵(75 → 45Hz) + 흩어지는 점액 알갱이(Grain9 · 0.4초) + 낮은 철퍽 꼬리 · 봉우리 0.85 → 0.5. */
  const r = rng9(1751 + v); const br = brown9(r);
  const bp = new Biquad9("bp", 1800, 0.8);
  const lp = new Biquad9("lp", 500, 0.7);
  const gR = new Grain9(1100, 3);
  const k = [1, 1.07, 0.93][v % 3];
  return finish9(render9(0.7, (t) => {
    const n = r() * 2 - 1;
    const pak = bp.run(n * 0.7 + br() * 0.6) * ad9(t, 0.002, 16) * 2.2;
    const thump = Math.sin(2 * Math.PI * (75 * k - t * 60) * t) * exp9(t, 14) * 0.9;
    const goo = gR.run(t < 0.45 && r() < 0.012 * exp9(t, 6) ? (r() * 2 - 1) * 0.9 : 0);
    const tail = lp.run(br() * 1.6) * ad9(t, 0.01, 7) * 0.7;
    return sat9(pak + thump + goo + tail, 1.5);
  }, (t) => bp.set(500 + 1300 * exp9(t, 9))), 0.5);
}

/** ★ 알 변태 시작(라바 → 알 · 히드라 → 럴커 알 · 뮤탈 → 고치 · 2026-11-02, 요청: "알 변태 시작과 깨짐도 낮고 생체 소리로") — 끈적한 살이 오므라들며 굳는다:
 *  낮게 출렁이며 내려가는 웅(78 → 52Hz · 느린 떨림) + 저역 질척임이 부풀었다 가라앉음 + 낮은 방울 둘. 0.75초. */
function eggStart9(v: number): Float32Array {
  const r = rng9(1801 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 520, 0.8);
  const k = [1, 1.08, 0.93][v % 3];
  let ph = 0; let b1 = 0; let b2 = 0;
  return finish9(render9(0.75, (t) => {
    ph += (78 - 26 * Math.min(1, t / 0.5)) * k * (1 + 0.1 * Math.sin(2 * Math.PI * 6 * t)) / SFX_RATE9;
    const hum = Math.sin(2 * Math.PI * ph) * ad9(t, 0.06, 3.4) * 0.8;
    const goo = lp.run(br() * 1.6) * ad9(t, 0.1, 3.8) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 4 * t));
    const u1 = t - 0.2; const u2 = t - 0.42;
    if (u1 > 0) b1 += (120 * k + u1 * 160) / SFX_RATE9;
    if (u2 > 0) b2 += (100 * k + u2 * 140) / SFX_RATE9;
    const bub = (u1 > 0 ? Math.sin(2 * Math.PI * b1) * Math.exp(-u1 * 22) * 0.35 : 0) + (u2 > 0 ? Math.sin(2 * Math.PI * b2) * Math.exp(-u2 * 22) * 0.28 : 0);
    return sat9(hum + goo + bub, 1.5);
  }), 0.6);
}
/** ★ 알 깨짐(부화) — 옛 eggPop(부드러운 뽁)보다 **낮은 생체**(2026-11-02, 같은 요청): 깊은 퍽(72 → 36Hz) + 축축한 철퍽(저역 600Hz) + 껍질 찢김 바스락 + 낮은 방울 셋. 0.6초. */
function eggHatch9(v: number): Float32Array {
  const r = rng9(1851 + v); const br = brown9(r);
  const gH = new Grain9(700, 3);
  const lp = new Biquad9("lp", 600, 0.7);
  const k = [1, 1.07, 0.92][v % 3];
  let ph = 0;
  const bub = [[0.12, 135], [0.2, 115], [0.3, 98]].map(([s0, f]) => [s0 + r() * 0.03, f * k]);
  const bph = [0, 0, 0];
  return finish9(render9(0.6, (t) => {
    ph += (72 - 36 * Math.min(1, t / 0.15)) * k / SFX_RATE9;
    const thump = Math.sin(2 * Math.PI * ph) * ad9(t, 0.006, 9) * 1.1;
    const splat = lp.run(br() * 1.8 + (r() * 2 - 1) * 0.2) * ad9(t, 0.008, 7) * 1.2;
    const rip = gH.run(t < 0.25 && r() < 0.01 * exp9(t, 8) ? (r() * 2 - 1) * 0.7 : 0);
    let gl = 0;
    for (let i = 0; i < 3; i += 1) {
      const u = t - bub[i][0];
      if (u < 0) continue;
      bph[i] += (bub[i][1] + u * 220) / SFX_RATE9;
      gl += Math.sin(2 * Math.PI * bph[i]) * Math.exp(-u * 26) * (0.32 - i * 0.07);
    }
    return sat9(thump + splat + rip + gl, 1.6);
  }), 0.68);
}

/** ★ 테란 건물 착공(애드온 포함) — 낮은 쇠 "턱"(2026-11-02, 요청: "테란 건물 착공 시 낮은 쇠울림 소리 · 텅" → 되요청 "텅이라기보다 턱 소리") — 울림을 눌러 짧게 끊었다:
 *  두꺼운 쇠판 울림 넷(98Hz × 1·2.76·5.40·8.93)이 0.1초 안에 잦아들고 + 둔한 쿵(무게) + 때린 딱. 0.28초. 옛 '텅'은 1.3초 울렸다. */
function metalClang9(v: number): Float32Array {
  const r = rng9(1901 + v);
  const hp = new Biquad9("hp", 1500, 0.8);
  const lp = new Biquad9("lp", 1600, 0.7);
  const f0 = 98 * [1, 1.06, 0.94][v % 3];
  const modes: [number, number, number][] = [[1, 1, 22], [2.76, 0.5, 34], [5.4, 0.25, 48], [8.93, 0.12, 60]];
  return finish9(render9(0.28, (t) => {
    let ring = 0;
    for (const [m, g, d] of modes) ring += Math.sin(2 * Math.PI * f0 * m * t) * g * Math.exp(-t * d);
    const tick = hp.run(r() * 2 - 1) * exp9(t, 120) * 0.5;
    const thud = Math.sin(2 * Math.PI * (82 - t * 90) * t) * exp9(t, 20) * 0.9;
    return sat9(lp.run(ring * 0.8 + thud) + tick, 1.5);
  }), 0.72);
}
/** ★ 스파이더 마인 발동 — 중간 높이 기계음(2026-11-02, 요청: "마인 발동 소리 중간 높이의 기계음") — 딸깍 둘(걸쇠) + 모터 윙(톱니파 520 → 780Hz 로 오르며 거른 소리 ·
 *  빠른 떨림) + 다리 펴지는 짧은 쉭. 0.42초 · 터지기 직전(engine9 MINE_ARM_SEC9). */
function mineArm9(v: number): Float32Array {
  const r = rng9(1951 + v);
  const bp = new Biquad9("bp", 900, 2);
  const hp = new Biquad9("hp", 2500, 0.8);
  const k = [1, 1.07, 0.94][v % 3];
  let ph = 0;
  return finish9(render9(0.42, (t) => {
    ph += (520 + 260 * Math.min(1, t / 0.3)) * k * (1 + 0.04 * Math.sin(2 * Math.PI * 45 * t)) / SFX_RATE9;
    const saw = ((ph % 1) * 2 - 1);
    const motor = bp.run(saw) * ad9(t, 0.03, 4.5) * 1.2;
    const c1 = t < 0.012 ? hp.run(r() * 2 - 1) * (1 - t / 0.012) : 0;
    const t2 = t - 0.06;
    const c2 = t2 > 0 && t2 < 0.01 ? (r() * 2 - 1) * (1 - t2 / 0.01) * 0.8 : 0;
    const t3 = t - 0.28;
    const shk = t3 > 0 ? hp.run(r() * 2 - 1) * Math.exp(-t3 * 30) * 0.4 : 0;
    return sat9(motor + c1 + c2 + shk, 1.4);
  }, (t) => bp.set((900 + 400 * Math.min(1, t / 0.3)) * k)), 0.55);
}

/** ★ 리버 사망(2026-11-02, 요청: "리버 사망 시 드라군하고 비슷하되 더 울림 있는 소리") — 드라군의 용수철 망가짐(springBreak9)을 낮게(×0.8) · 길게 떨게(1.3초) 하고
 *  쇠통이 울리는 몸(낮은 판 울림 둘)과 메아리 둘을 더했다. */
function reaverBreak9(v: number): Float32Array {
  const r = rng9(2001 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 800, 0.7);
  let ph = 0;
  const clank = (u: number, k: number): number => (u < 0 ? 0 : (Math.sin(2 * Math.PI * 980 * k * u) + Math.sin(2 * Math.PI * 2170 * k * u) * 0.6 + Math.sin(2 * Math.PI * 3170 * k * u) * 0.35) * exp9(u, 12));
  const raw = render9(1.3, (t) => {
    const f = (720 - 520 * Math.min(1, t / 1.0)) * (1 + 0.2 * Math.sin(2 * Math.PI * (28 - t * 14) * t) * exp9(t, 2));
    ph += (f * (1 + v * 0.05)) / SFX_RATE9;
    const boing = Math.sin(2 * Math.PI * ph) * ad9(t, 0.005, 2.1) * 0.7;
    const hit = clank(t - 0.01, 1) * 0.5 + clank(t - 0.24, 0.9) * 0.35;
    const shell = (Math.sin(2 * Math.PI * 140 * t) + Math.sin(2 * Math.PI * 377 * t) * 0.5) * ad9(t, 0.004, 2.6) * 0.4;
    const thud = lp.run(br()) * exp9(t, 7) * 0.9;
    return sat9(boing + hit + shell + thud, 1.5);
  });
  return finish9(echo9(echo9(raw, 0.09, 0.32), 0.21, 0.24), 0.66);
}
/** ★ 사이언스 베슬 폭발(2026-11-02, 요청: "베슬 폭발 시 둥둥둥 세 번 중간음 울리는 소리" → 되요청 "좀 더 귀여운 동동동 울림 있는 소리 세 번") — 높고 동글동글한 '동' 셋:
 *  0.15초 간격으로 523 → 587 → 659Hz(도·레·미 · 한 단씩 오른다) · 때리는 순간 살짝 내려앉는 높이(통통 튀는 맛) · 2배음 옅게 · 0.45초 울림 · 메아리 둘 · 아주 옅은 터짐. 1.3초. */
function vesselBoom9(v: number): Float32Array {
  const r = rng9(2051 + v);
  const lp = new Biquad9("lp", 2200, 0.7);
  const k = [1, 1.06, 0.94][v % 3];
  const hits: [number, number][] = [[0, 587.33], [0.22, 566], [0.44, 546]];   // 되요청("뒤로 갈수록 살짝만 낮아지고 · 한 음이 좀 더 길게") — 3.6%씩 내려가고 0.22초 간격
  const ph = [0, 0, 0];
  const raw = render9(1.6, (t) => {
    let o = 0;
    for (let i = 0; i < 3; i += 1) {
      const u = t - hits[i][0];
      if (u < 0) continue;
      ph[i] += hits[i][1] * k * (1 + 0.12 * Math.exp(-u * 40)) / SFX_RATE9;
      o += (Math.sin(2 * Math.PI * ph[i]) + Math.sin(4 * Math.PI * ph[i]) * 0.18) * ad9(u, 0.003, 3.4);   // 울림 0.45 → 0.9초 남짓
    }
    const pop = lp.run(r() * 2 - 1) * ad9(t, 0.004, 30) * 0.25;
    return o * 0.55 + pop;
  });
  return finish9(echo9(echo9(raw, 0.11, 0.3), 0.23, 0.2), 0.5);
}

/** ★ 오버로드 태우기·내리기 — 생체조직(2026-11-02, 요청: "오버로드 수송 탑승 내리기 시 생체조직 소리로") — 옛: 기계 해치(hatch9). 살 주머니가 열려 삼키고 뱉는다:
 *  탈 때(in) 낮게 꿀꺽(110 → 70Hz 미끄럼) + 질척 · 내릴 때(out) 축축한 퉤(80 → 130Hz 오름) + 철퍽. 0.5초. */
function bioHold9(v: number, inn: boolean): Float32Array {
  const r = rng9((inn ? 2101 : 2151) + v); const br = brown9(r);
  const bp = new Biquad9("bp", inn ? 500 : 700, 2.2);
  const lp = new Biquad9("lp", 650, 0.7);
  const k = [1, 1.07, 0.93][v % 3];
  let ph = 0;
  return finish9(render9(0.5, (t) => {
    const u = Math.min(1, t / 0.3);
    ph += (inn ? 110 - 40 * u : 80 + 50 * u) * k / SFX_RATE9;
    const gulp = Math.sin(2 * Math.PI * ph) * ad9(t, inn ? 0.04 : 0.015, 6) * 0.8;
    const squish = bp.run(br() * 1.3 + (r() * 2 - 1) * 0.25) * ad9(t, 0.02, 7) * 1.0;
    const splat = lp.run(br() * 1.5) * ad9(t, 0.006, 11) * (inn ? 0.5 : 0.9);
    return sat9(gulp + squish + splat, 1.5);
  }, (t) => bp.set((inn ? 500 + 300 * Math.min(1, t / 0.3) : 700 - 300 * Math.min(1, t / 0.3)))), 0.6);
}

/** ★ 옵저버 폭발(2026-11-02, 요청: "옵저버 폭발 시 작은 폭발 소리 + 살짝 높은 징 소리" → 되요청 "그 징 소리가 아니라 삐~ 하는 소리") — 작은 퍽(짧은 잡음 터짐 + 110Hz 쿵 · 0.25초)
 *  위에 맑은 '삐~': 1.4kHz 사인 한 음(아주 옅은 2배음) · 들어옴 15ms · 0.45초 고르게 · 0.7초에 걸쳐 잦아듦. 1.2초. 옛 판의 징(어긋난 울림 다섯)은 걷었다. */
function obsBoom9(v: number): Float32Array {
  const r = rng9(2201 + v); const br = brown9(r);
  const lp = new Biquad9("lp", 2000, 0.7);
  const f0 = 1400 * [1, 1.04, 0.96][v % 3];
  return finish9(render9(1.2, (t) => {
    /* "퍽보다는 펑"(같은 날 되요청) — 터짐이 둥글게 퍼지도록 몸을 늘렸다: 잡음 터짐 잦음 14 → 6 · 저역 3kHz → 400Hz 로 닫히며 · 쿵 95 → 50Hz 잦음 22 → 7. */
    const pop = lp.run(br() * 1.6 + (r() * 2 - 1) * 0.5) * ad9(t, 0.005, 6) * 1.0 + Math.sin(2 * Math.PI * (95 - t * 55) * t) * exp9(t, 7) * 0.8;
    const env = t < 0.015 ? t / 0.015 : t < 0.46 ? 1 : Math.exp(-(t - 0.46) * 4.5);
    const beep = (Math.sin(2 * Math.PI * f0 * t) + Math.sin(4 * Math.PI * f0 * t) * 0.06) * env * 0.28;
    return sat9(pop, 1.3) + beep;
  }, (t) => lp.set(3000 * Math.exp(-t * 5) + 400)), 0.66);
}

/** ★ 럴커 사망(2026-11-02, 요청: "럴커 사망 소리는 낮은 비명과 폭발") — 낮은 괴물 비명(톱니 성대 210 → 90Hz 로 꺾이며 떨고 · 낮은 꼭지 셋 450·950·1900Hz · 거친 숨)
 *  + 생체 폭발(깊은 쿵 60 → 35Hz + 저역 살덩이 터짐 + 흩어지는 철퍽). 0.9초. */
function lurkerDie9(v: number): Float32Array {
  const r = rng9(2251 + v); const br = brown9(r);
  const f1 = new Biquad9("bp", 450, 3); const f2 = new Biquad9("bp", 950, 4); const f3 = new Biquad9("bp", 1900, 5);
  const lp = new Biquad9("lp", 700, 0.7);
  const base = [210, 185, 235][v % 3];
  const gL = new Grain9(500, 3);
  let ph = 0;
  return finish9(render9(0.9, (t) => {
    const f0 = base * Math.max(0.43, 1.05 - t * 1.1) * (1 + 0.08 * Math.sin(2 * Math.PI * 17 * t));
    ph += f0 / SFX_RATE9;
    const src = ((ph % 1) * 2 - 1) * 0.8 + (r() * 2 - 1) * 0.2;
    const howl = (f1.run(src) * 1.2 + f2.run(src) * 0.8 + f3.run(src) * 0.35) * ad9(t, 0.03, 2.8) * 1.7;
    const thump = Math.sin(2 * Math.PI * (60 - t * 28) * t) * exp9(t, 6) * 1.0;
    const blast = lp.run(br() * 1.8) * ad9(t, 0.006, 5) * 0.9;
    const splat = gL.run(t > 0.08 && t < 0.6 && r() < 0.002 ? (r() * 2 - 1) * 0.7 : 0);
    return sat9(howl * 0.8 + thump + blast + splat, 1.35);
  }, (t) => { f1.set(450 - t * 160); f2.set(950 - t * 300); }), 0.82);
}

/** ★ 스팀팩(2026-11-03, 요청: "스팀팩 소리 스와이어~~~ 하는 느낌 · 남자 목소리 추가") — 주사기 압축 가스가 '스와이~' 하고 솟았다 내려앉는 쉭(띠 잡음 1.6 → 4.4 → 2.4kHz)
 *  + 0.12초 뒤 남자의 짧은 '아~'(성대 펄스 120Hz 언저리가 살짝 떨며 내려앉음 · 모음 '아' 포먼트 730·1090·2440Hz · 숨소리 섞음) · 작은 방 메아리. 1.1초. */
function stim9(v: number): Float32Array {
  /* (2026-11-03, 요청: "스팀팩에서 솨~ 소리만 남기고 음성은 제거") — 남자 '아~'(성대 펄스 + 모음 거르개 셋)를 걷고 솨~(띠 잡음이 솟았다 내려앉음)만 남긴다.
     (같은 날 "스팀팩 음 낮추기") 띠 높이 ×0.65 · 고역 거르개 900 → 600Hz · ("처음에 좀 부드럽게") 0.2초 둥근 오름.
     (같은 날 "스팀팩 소리 길이 1.5배") — 시간 자 L9 = 1.5: 길이 1.1 → 1.65초 · 오름 0.2 → 0.3 · 잦아듦 3.2 → 3.2/1.5 · 띠 솟음 0.22 → 0.33초 · 내려앉음 기울기 ÷1.5. */
  /* (같은 날 "좀 더 굵은 톤이어야 함 · 남성적") — 띠 높이 ×0.65 → ×0.45 · 띠 폭 넓게(Q 2.2 → 1.2) · 고역 거르개 600 → 220Hz · 그 아래 갈색 잡음 저역(320Hz)의 '훅' 몸통 0.5 를 깔고
     포화 1.4 → 1.8 로 두께를 더한다. 길이·오름·솟음은 그대로. */
  /* (같은 날 되요청: "몸통 소리 필요 없고 솨~ 하는 소리를 좀 더 크면서 남성적") — 몸통(갈색 잡음 저역)을 걷고, 솨~ 띠에 그 한 옥타브 아래 띠(×0.5 · Q 1.0)를 겹쳐 가슴 울림을 더한다 ·
     포화 1.8 → 1.5 · 끝 크기 0.6 → 0.85(더 크게). */
  const K9 = 0.39; const L9 = 1.5;   // (같은 날 "스왕이아 음정 좀만 낮게") 0.45 → 0.39 · 앞머리 스~ 5.2 → 4.4kHz(약 −15%)
  const r = rng9(2311 + v);
  const hb = new Biquad9("bp", 1600 * K9, 1.2); const hh = new Biquad9("hp", 220, 0.7);
  const hb2 = new Biquad9("bp", 800 * K9, 1.0);
  /* (같은 날 "처음이 스~ 하는 느낌이면 좋겠는데") — 앞머리 '스~': 가는 높은 띠(5.2kHz · Q 3)가 0.06초에 들어와 0.15~0.5초에 걸쳐 빠지고, 그동안 솨~ 띠가 0.35 → 1 로 차오른다. */
  const sb9 = new Biquad9("bp", 3200, 1.4); const shp9 = new Biquad9("hp", 1600, 0.7); const slp9 = new Biquad9("lp", 5000, 0.7);   // (같은 날 "앞머리 스만 음정 더 낮추기") 4.4 → 3.2kHz · 거르개도 같은 비
  const A9 = 0.2 * L9; const UP9 = 0.22 * L9;
  const raw9 = render9(1.1 * L9, (t) => {
    const u9 = Math.min(1, t / A9); const env9 = t < A9 ? u9 * u9 * (3 - 2 * u9) : Math.exp(-(t - A9) * (3.2 / L9));
    const n9 = r() * 2 - 1;
    /* (같은 날 "처음 파찰음이 너무 강해 · 좀만 부드럽게") — 스~ 크기 0.9 → 0.55 · 들어옴 0.06초 곧게 → 0.14초 둥글게 · 띠 Q 3 → 2(덜 날카롭게). */
    /* (같은 날 "더 부드럽게") 0.14 → 0.22초 · 크기 0.55 → 0.35 · Q 2 → 1.4 · 6.5kHz 위 깎음 */
    const sA9 = Math.min(1, t / 0.22); const sU9 = sA9 * sA9 * (3 - 2 * sA9); const sOut9 = 1 - Math.min(1, Math.max(0, (t - 0.15) / 0.35));
    const sEnv9 = sU9 * sOut9 * sOut9;
    const shaU9 = Math.min(1, Math.max(0, (t - 0.1) / 0.35)); const shaK9 = 0.35 + 0.65 * shaU9 * shaU9 * (3 - 2 * shaU9);
    const sss9 = slp9.run(shp9.run(sb9.run(n9))) * sEnv9 * 0.35;
    const hiss = (hh.run(hb.run(n9)) * 1.15 + hb2.run(n9) * 0.9) * env9 * shaK9;
    return sat9(hiss * 0.6 + sss9, 1.5);
  }, (t) => {
    const f9 = K9 * (t < UP9 ? 1600 + (t / UP9) * 2800 : Math.max(2400, 4400 - (t - UP9) * (4000 / L9)));   // 스와이~ : 솟고 내려앉음
    hb.set(f9); hb2.set(f9 * 0.5);
  });
  return finish9(echo9(raw9, 0.07, 0.22), 0.85);
}

/** ★ 알 부화 — **태반 터짐**(2026-11-09 아홉째, 지적: "부화 소리 좀 물 같아 · 물 말고 태반 터지는 소리") — 일곱째 '촤락'(물방울 · 출렁임)은 물소리였다. 이제 살막이 터지는 꼴:
 *  ① 막 찢김 '쩍' — 갈색 잡음을 띠(1.1k → 380Hz)로 거르고 빠른 무작위 덩이(초당 ~90 · 저역으로 둥글린 것)로 끊어 끈적하게 찢어지는 결 · ② 끈적한 '쭈왁' — 공명 큰
 *  저역 거르개(Q 5 · 650 → 170Hz)로 쓸어 내린 갈색 잡음 · ③ 낮은 '퍽' 몸(85 → 45Hz · 배음 하나). 물방울 · 출렁임은 걷었다. pk 는 음높이 배(알 1 · 고치 · 번데기 · 공사 고치 0.72). 0.6초. */
function eggSplash9(v: number, pk: number): Float32Array {
  /* ★ 알껍질 찢김(2026-11-09 열둘째, 요청: "저그 부화 소리에 알껍질이 찢어지는 소리 필요") — 터지기 전 0.22초 동안 질긴 껍질이 **찌이익** 찢어진다: 가죽 · 천 찢김처럼 잘게
     뜯기는 섬유 '틱'들(둥근 알갱이 Grain9 → 띠 1.9kHz · Q 1.4 · 밀도가 점점 빨라짐 초당 60 → 260)과 그 밑의 긁힘(갈색 잡음 띠 1.2kHz · 같은 결로 떨림). 그 뒤 0.18초에 아래 태반 터짐.
     전체 0.78초. */
  const r = rng9(3101 + v + (pk !== 1 ? 17 : 0)); const br = brown9(r);
  const bpT = new Biquad9("bp", 1100 * pk, 1.2);
  const lpQ = new Biquad9("lp", 650 * pk, 5);
  const lpE = new Biquad9("lp", 60, 0.7);
  const gF = new Grain9(3200 * pk, 3);
  const bpF = new Biquad9("bp", 1900 * pk, 1.4);
  const bpR = new Biquad9("bp", 1200 * pk, 2);
  const T0 = 0.18;
  let ph = 0;
  return finish9(render9(0.78, (t) => {
    /* 찢김(0 ~ 0.24초) */
    let rip = 0;
    if (t < 0.26) {
      const u = t / 0.24;
      const rate = 60 + 200 * u * u;
      const tick = r() < rate / SFX_RATE9 ? (r() * 2 - 1) * (0.6 + r() * 0.4) : 0;
      const renv = Math.min(1, t / 0.03) * (t < 0.2 ? 0.6 + 0.4 * u : Math.max(0, 1 - (t - 0.2) / 0.06));
      rip = (bpF.run(gF.run(tick)) * 2.2 + bpR.run(br()) * 0.35 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 47 * t))) * renv;
    }
    /* 태반 터짐(아홉째 · T0 부터) */
    const tb = t - T0;
    let burst = 0;
    if (tb > 0) {
      const n = br();
      const lump = Math.max(0, lpE.run(r() < 0.06 ? (r() * 2 - 1) * 40 : 0));
      const tear = bpT.run(n) * Math.min(1, lump) * ad9(tb, 0.004, 9) * 1.6;
      const squelch = lpQ.run(n) * ad9(Math.max(0, tb - 0.02), 0.03, 5.5) * (tb > 0.02 ? 1 : 0) * 0.55;
      ph += (45 + 40 * exp9(tb, 16)) * pk / SFX_RATE9;
      const puk = (Math.sin(2 * Math.PI * ph) + Math.sin(4 * Math.PI * ph) * 0.35) * ad9(tb, 0.003, 12) * 0.9;
      burst = tear + squelch + puk;
    }
    return sat9(rip + burst, 1.15);
  }, (t) => { const tb = Math.max(0, t - T0); bpT.set((380 + 720 * exp9(tb, 8)) * pk); lpQ.set((170 + 480 * exp9(tb, 6)) * pk); }), 0.5);
}

/** ★ 럴커 땅 파기(2026-11-09 아홉째, 요청: "럴커 버로우 하는 동작 소리") — 파는 창 동안 흙덩이(engine9 dom dig · 0.15초마다 한 움큼)마다 하나: 다리 가시가 흙에 박히는 '푹'
 *  (낮은 퉁 95 → 50Hz) + 딱딱한 껍질 '딱'(bp 1.6kHz · 3ms) + 흙 튐(갈색 잡음 lp 1000 → 300 · 0.12초) + 낮은 끙(생체 · 70Hz 배음 · 옅게). 0.28초. */
function lurkerDig9(v: number): Float32Array {
  const r = rng9(3301 + v); const br = brown9(r);
  const bpC = new Biquad9("bp", 1600, 3);
  const lpD = new Biquad9("lp", 1000, 0.7);
  let ph = 0; let phG = 0;
  return finish9(render9(0.28, (t) => {
    ph += (50 + 45 * exp9(t, 30)) / SFX_RATE9;
    const stab = Math.sin(2 * Math.PI * ph) * ad9(t, 0.002, 26) * 1.0;
    const click = bpC.run(r() * 2 - 1) * exp9(t, 450) * 0.9;
    const dirt = lpD.run(br()) * ad9(Math.max(0, t - 0.01), 0.008, 16) * 0.9;
    phG += (70 * (1 - t * 0.4)) / SFX_RATE9;
    const grunt = (Math.sin(2 * Math.PI * phG) * 0.6 + Math.sin(4 * Math.PI * phG) * 0.3) * ad9(t, 0.03, 9) * 0.25;
    return sat9(stab + click + dirt + grunt, 1.15);
  }, (t) => lpD.set(300 + 700 * exp9(t, 12))), 0.5);
}

/** ★ 낮은 드릴(2026-11-09 일곱째, 요청: "테란 건설이나 리페어에 지금 소리랑 교차로 낮은 드릴 소리 넣기") — 용접(weld9)과 번갈아(sfx9Cues). 모터 웅(92Hz 톱니를 lp 600 · 갈리는 28Hz 떨림) +
 *  갈리는 잡음(bp 380Hz · 같은 떨림) · 켜졌다 꺼지는 꼴(0.06초 차오름 · 끝 0.1초 접힘) · 0.55초. */
function drillLow9(v: number): Float32Array {
  const r = rng9(3201 + v); const br = brown9(r);
  const lpM = new Biquad9("lp", 600, 0.8);
  const bpG = new Biquad9("bp", 380, 1.2);
  let ph = 0;
  return finish9(render9(0.55, (t) => {
    const f = 92 * (t < 0.08 ? 0.7 + 0.3 * (t / 0.08) : 1) * (1 + 0.015 * Math.sin(2 * Math.PI * 6 * t));
    ph += f / SFX_RATE9;
    const grind = 0.65 + 0.35 * Math.sin(2 * Math.PI * 28 * t);
    const motor = lpM.run(2 * (ph % 1) - 1) * grind * 0.9;
    const chip = bpG.run(br() * 0.8 + (r() * 2 - 1) * 0.3) * grind * 0.9;
    const env = Math.min(1, t / 0.06) * Math.min(1, (0.55 - t) / 0.1);
    return sat9((motor + chip) * env, 1.3);
  }), 0.24);
}

/* ── 갈래 표 ───────────────────────────────────────────────────────────────── */

export type SfxKind9 =
  | "gun" | "cannon" | "boom" | "boomBig" | "bioBoom" | "squeal" | "screamM" | "screamF" | "zap" | "missile"
  | "liftOff" | "landing" | "photon" | "photonC" | "mine" | "thunder" | "puff" | "glaive" | "weld" | "load" | "unload"
  | "burrow" | "unburrow" | "warp" | "flame" | "slash" | "blade" | "claw" | "spine" | "warpHum" | "warpEnd" | "heart" | "mineScv" | "mineProbe" | "eggPop"
  | "screamLow" | "screamHi" | "spikeEarth" | "guardHum" | "springBreak" | "scanHum" | "warpCharge" | "zlingHit" | "ultraHit" | "missileLow" | "missileHi" | "fleshUnfold" | "zergDone" | "eggStart" | "eggHatch" | "metalClang" | "mineArm" | "reaverBreak" | "vesselBoom" | "bioLoad" | "bioUnload" | "obsBoom" | "lurkerDie" | "squealHi" | "squealMuta" | "stim" | "gunShot" | "dragoonShot" | "zealotStab" | "tossDie" | "dragoonHit" | "eggSplash" | "eggSplashLow" | "drillLow" | "lurkerDig" | "spineSmall";

/** 종류 → [갈래 수, 굽는 함수]. ★ **갈래는 모두 1**(2026-11-03, 요청: "모든 효과음은 갈래 없애고 앞에거 1개만 쓰기") — 늘 v = 0(첫 갈래)을 굽는다. */
export const SFX_RECIPES9: Record<SfxKind9, [number, (v: number) => Float32Array]> = {
  gun: [1, gun9], cannon: [1, cannon9], boom: [1, (v) => boom9(v, false)], boomBig: [1, (v) => boom9(v, true)],
  bioBoom: [1, bioBoom9], squeal: [1, (v) => squeal9(v)], screamM: [1, (v) => scream9(v, false)], screamF: [1, (v) => scream9(v, true)],
  zap: [1, zap9], missile: [1, missile9], liftOff: [1, liftOff9], landing: [1, landing9], photon: [1, photon9], photonC: [1, photonC9], mine: [1, mine9],
  thunder: [1, thunder9], puff: [1, puff9], glaive: [1, glaive9], weld: [1, weld9],
  load: [1, (v) => hatch9(v, true)], unload: [1, (v) => hatch9(v, false)],
  burrow: [1, (v) => burrow9(v, true)], unburrow: [1, (v) => burrow9(v, false)], warp: [1, warp9],
  flame: [1, flame9], slash: [1, slash9], blade: [1, blade9], claw: [1, claw9], spine: [1, spine9],
  warpHum: [1, warpHum9], warpEnd: [1, warpEnd9], heart: [1, heart9], mineScv: [1, mineScv9], mineProbe: [1, mineProbe9],
  eggPop: [1, eggPop9],
  screamLow: [1, (v) => scream9(v, false, 0.72)], screamHi: [1, (v) => scream9(v, true, 1.7)],   // 메딕 1.45 → 1.7(2026-11-09, 요청: "메딕 죽음 소리 더 고음으로")
  spikeEarth: [1, spikeEarth9], guardHum: [1, guardHum9], springBreak: [1, springBreak9], scanHum: [1, scanHum9],
  warpCharge: [1, warpCharge9], zlingHit: [1, zlingHit9], ultraHit: [1, ultraHit9],
  missileLow: [1, missileLow9], missileHi: [1, missileHi9],
  fleshUnfold: [1, fleshUnfold9], zergDone: [1, zergDone9],
  eggStart: [1, eggStart9], eggHatch: [1, eggHatch9], metalClang: [1, metalClang9],
  mineArm: [1, mineArm9], reaverBreak: [1, reaverBreak9], vesselBoom: [1, vesselBoom9],
  bioLoad: [1, (v) => bioHold9(v, true)], bioUnload: [1, (v) => bioHold9(v, false)],
  obsBoom: [1, obsBoom9], lurkerDie: [1, lurkerDie9], squealHi: [1, (v) => squeal9(v, 1.35)], squealMuta: [1, (v) => squeal9(v, 2.2)],
  stim: [1, stim9], gunShot: [1, gunShot9], dragoonShot: [1, dragoonShot9], zealotStab: [1, zealotStab9], tossDie: [1, tossDie9], dragoonHit: [1, dragoonHit9],
  eggSplash: [1, (v) => eggSplash9(v, 1)], eggSplashLow: [1, (v) => eggSplash9(v, 0.72)], drillLow: [1, drillLow9],   // 2026-11-09 일곱째
  lurkerDig: [1, lurkerDig9],   // 2026-11-09 아홉째
  spineSmall: [1, (v) => spine9(v, 1.35)],   // 드론 침(2026-11-09 스물두째)
};

/* ★ **묶음별 크기 맞춤**(2026-11-09, 요청: "모든 공격 소리끼리 · 죽음 소리끼리 데시벨을 노멀라이징 해 줘") — 옛 판은 갈래마다 봉우리(finish9 peak)만 맞춰,
   짧고 뾰족한 소리(질럿 찌름 · 칼질)는 작게, 길고 꽉 찬 소리(대포 · 비명)는 크게 들렸다. 이제 **들리는 크기**로 잰다: 귀 무게(100Hz 아래 덜 · 1.5kHz 위 +4dB —
   K 무게 흉내) 를 씌운 **가장 큰 100ms 창의 RMS**(단 소리는 판 전체). 묶음마다 한 목표(LOUD_ATK9 · LOUD_DIE9 — 맞추기 전 묶음의 가운데 값)로 곱하되,
   봉우리가 0.95 를 넘으면 거기서 멈춘다. 공격 = 쏨 · 맞음 · 근접 · 휘두름(연사 한 발 gunShot 포함) · 죽음 = 유닛 죽음(건물 터짐 boomBig · bioBoom · 알 깨짐은 뺀다).
   묶음에 든 갈래는 sfx9 GAIN9 손 배수를 안 탄다. 🔎 재는 판: 이 모듈의 loud9 를 esbuild 로 묶어 SFX_RECIPES9 를 돌린다(docs/notes/player-ui.md '효과음 크기 맞춤'). */
export const LOUD_ATK_KINDS9: readonly SfxKind9[] = [
  "gun", "gunShot", "cannon", "zap", "flame", "spine", "spikeEarth", "glaive", "slash", "blade", "claw", "zealotStab", "zlingHit", "ultraHit",
  "missile", "missileLow", "missileHi", "photon", "photonC", "guardHum", "dragoonShot", "dragoonHit", "spineSmall",
];
export const LOUD_DIE_KINDS9: readonly SfxKind9[] = [
  "screamM", "screamF", "screamLow", "screamHi", "squeal", "squealHi", "squealMuta", "lurkerDie", "tossDie", "springBreak", "reaverBreak", "obsBoom", "vesselBoom", "boom",
];
const LOUD_ATK9 = 0.15;   // 맞추기 전 공격 묶음(GAIN9 곱한 값)의 가운데 0.16 · 연사 한 발(gunShot) 0.047 · 질럿 0.10 · 저글링 0.24
const LOUD_DIE9 = 0.2;   // 맞추기 전 죽음 묶음의 가운데 0.18 · 비명 0.37 · 베슬 0.14
/** 들리는 크기(위 ★) — 귀 무게 씌운 가장 큰 100ms 창의 RMS. */
export function loud9(b: Float32Array): number {
  const hp = new Biquad9("hp", 100, 0.7); const sh = new Biquad9("hp", 1500, 0.7);
  const W = Math.round(0.1 * SFX_RATE9);
  const sq = new Float32Array(b.length);
  for (let i = 0; i < b.length; i += 1) { const x = hp.run(b[i]); const y = x + 0.585 * sh.run(x); sq[i] = y * y; }
  let acc = 0; let best = 0;
  for (let i = 0; i < sq.length; i += 1) { acc += sq[i]; if (i >= W) acc -= sq[i - W]; if (i >= W - 1) best = Math.max(best, acc / W); }
  if (sq.length < W) best = acc / Math.max(1, sq.length);
  return Math.sqrt(best);
}
function loudTo9(b: Float32Array, target: number): Float32Array {
  const l = loud9(b);
  let m = 0;
  for (let i = 0; i < b.length; i += 1) m = Math.max(m, Math.abs(b[i]));
  if (l <= 0 || m <= 0) return b;
  const k = Math.min(target / l, 0.95 / m);
  for (let i = 0; i < b.length; i += 1) b[i] *= k;
  return b;
}
for (const [ks, tg] of [[LOUD_ATK_KINDS9, LOUD_ATK9], [LOUD_DIE_KINDS9, LOUD_DIE9]] as const) {
  for (const k of ks) { const [n, mk] = SFX_RECIPES9[k]; SFX_RECIPES9[k] = [n, (v) => loudTo9(mk(v), tg)]; }
}
