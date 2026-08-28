/* 우주 배경(요청: "3D의 남는 부분, 2D의 여백 도화지 부분 … 우주로 채울 거야. 사진은
   아니고 벡터나 SVG 그려서 채우기(패턴은 좀 다양하게 나왔으면)") ────────────────────
 *
 * 무대(.scr-fs-stage)에서 지도가 안 덮는 자리에 깔린다. 두 자리가 그것이다:
 *   · 2D — 지도 위의 그림 여유 띠(mapBand9). 지도가 아닌데 모델이 삐져나와 그려지는 자리다.
 *   · 3D — 판을 눕히면 네 귀퉁이에 나는 빈 삼각형.
 * 여태 거기는 그냥 판 바탕색이었다. 검은 자리가 '아직 안 그려진 데'로 읽히던 자리다.
 *
 * ★ **DOM이 아니라 한 장의 그림**이다 — 별 수백 개를 <circle>로 붙이면 재생 틱마다
 *   리액트가 그 수백 개를 다시 훑는다(이 파일이 효과 스팬으로 한 번 데인 자리다).
 *   SVG 한 통을 문자열로 지어 data URI로 만들고 CSS 배경으로 깐다 — DOM 노드는 하나,
 *   브라우저는 한 번 그려 캐시한다.
 *
 * ★ **경기마다 다른 하늘**이다(요청: 패턴은 다양하게) — 씨앗 하나(경기번호)로 성운 수·
 *   색·자리, 은하가 있나 없나와 그 기울기, 별 무리의 뭉침, 은하수 띠의 유무가 갈린다.
 *   씨앗이 같으면 늘 같은 하늘이라 프레임마다 별이 떨지 않는다.
 */

/** 문자열 → 32비트 씨앗(FNV-1a). */
function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — 씨앗 하나로 늘 같은 흐름을 낸다(작고 고르다). */
function rngOf(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 소수 자리를 줄여 문자열을 짧게 — data URI는 짧을수록 좋다. */
const n2 = (v: number): string => (Math.round(v * 10) / 10).toString();

/** 성운의 색갈래 — **검정에 남색만 섞는다**(요청: "우주색을 좀 더 까만 톤에 남색 톤
 *  섞음으로. 지금 보라색 푸른색 없애기").
 *  전에는 보라·자주·청록·주황까지 여섯 갈래라 하늘마다 색이 튀었다. 그건 '다양함'이
 *  아니라 그냥 알록달록한 것이었고, 그 위에 선 유닛의 임자색과도 겨뤘다.
 *  이제 다섯 갈래가 모두 남색 언저리다 — 짙고 옅음과 잿빛이 도는 정도만 다르다.
 *  하늘이 갈리는 몫은 색이 아니라 자리·크기·별 무리가 진다. */
const NEBULA_HUES: [number, number, number][] = [
  [26, 38, 78],    // 진남색
  [18, 30, 62],    // 더 짙은 남색
  [36, 48, 92],    // 옅은 남색
  [22, 40, 72],    // 푸른 잿빛 남색
  [44, 48, 70],    // 잿빛 남색(색이 거의 안 도는 것)
];

/**
 * 우주 배경 한 장을 data URI로 짓는다.
 * @param seed 경기번호처럼 **그 경기에 고유하고 안 변하는** 문자열.
 */
export function spaceBackdropUrl(seed: string): string {
  const rnd = rngOf(seedOf(seed || "sky"));
  /** 0~1 → [a,b] */
  const between = (a: number, b: number): number => a + (b - a) * rnd();
  const pick = <T, >(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

  /* ★ 판이 작을수록 별이 크게 보인다(지적: "별하고 은하 같은 게 너무 잘 안 뵈는 거
     같기두") — 이 그림은 덮기(cover)로 깔리므로 화면에 얹히는 배수가 `상자 ÷ W`다.
     W가 1000이던 때, 폰의 그림 여유 띠(360×90)에서는 그 배수가 0.36이라 반지름 0.5짜리
     별이 **0.18px**로 찍혔다 — 안 보이는 것이 당연하다. W를 520으로 줄이면 같은 자리의
     배수가 0.69가 되어 별이 제 크기의 7할로 선다.
     ★ 그 뒤 하늘이 **지도와 한 몸**이 되면서(렌즈 안 .scr-motion-sky) 한 장이 깔리는
       자리가 '지도 한 폭'이 됐다 — 폰에서 600px 남짓이라 배수가 0.86이고, 520이면
       별이 조금 굵었다. 700으로 올려 그 배수를 되돌린다.
     길이를 적는 자리는 전부 W에 매어 둔다 — 다음에 이 수를 만져도 결이 안 갈린다. */
  const W = 700;
  const defs: string[] = [];
  const body: string[] = [];

  /* ── 바탕 — 위아래로 아주 옅게 갈리는 밤하늘. 완전한 검정은 안 쓴다(화면에서 '구멍'
     으로 읽힌다). 기울기 각도도 씨앗을 탄다. */
  const bgDeg = between(0, 360);
  const br = Math.cos((bgDeg * Math.PI) / 180);
  const bs = Math.sin((bgDeg * Math.PI) / 180);
  defs.push(
    `<linearGradient id="bg" x1="${n2(50 - br * 50)}%" y1="${n2(50 - bs * 50)}%"`
    + ` x2="${n2(50 + br * 50)}%" y2="${n2(50 + bs * 50)}%">`
    /* 바탕은 **거의 검정**이다 — 남색은 성운이 낸다. 완전한 0은 안 쓴다(화면에서
       '구멍'으로 읽힌다).
       한 단 더 내린다(요청: "배경 더 검정색으로 어둡게") — 050710·020307은 밝은 화면
       에서 남색 판으로 읽혔다. 이제 위아래 차만 겨우 남는다. */
    + `<stop offset="0" stop-color="#020307"/>`
    + `<stop offset="1" stop-color="#010103"/></linearGradient>`,
  );
  body.push(`<rect width="${W}" height="${W}" fill="url(#bg)"/>`);

  /* ── 성운 두셋 — 넓고 아주 옅은 얼룩. 겹치면 색이 섞여 하늘마다 결이 달라진다. */
  const nebN = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < nebN; i += 1) {
    const [r9, g9, b9] = pick(NEBULA_HUES);
    const cx = between(0, W);
    const cy = between(0, W);
    const rr = between(W * 0.22, W * 0.55);
    /* 알파는 **바탕이 검게 남을 만큼**만(요청: 더 어둡게) — 0.24~0.46은 얼룩 둘셋이
       겹치면 하늘 절반이 남색으로 찼다. 남색이 남색으로 읽히는 하한만 남긴다. */
    const al = between(0.10, 0.20);
    defs.push(
      `<radialGradient id="n${i}">`
      + `<stop offset="0" stop-color="rgb(${r9},${g9},${b9})" stop-opacity="${n2(al)}"/>`
      + `<stop offset="0.55" stop-color="rgb(${r9},${g9},${b9})" stop-opacity="${n2(al * 0.45)}"/>`
      + `<stop offset="1" stop-color="rgb(${r9},${g9},${b9})" stop-opacity="0"/>`
      + `</radialGradient>`,
    );
    body.push(
      `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(rr)}" ry="${n2(rr * between(0.55, 1))}"`
      + ` transform="rotate(${n2(between(0, 180))} ${n2(cx)} ${n2(cy)})" fill="url(#n${i})"/>`,
    );
  }

  /* ── 은하수 띠 — 절반쯤의 하늘에만 있다. 아주 옅은 먼지 띠 하나가 비스듬히 지난다. */
  if (rnd() < 0.72) {
    const cx = between(W * 0.2, W * 0.8);
    const cy = between(W * 0.2, W * 0.8);
    const deg = between(0, 180);
    defs.push(
      `<radialGradient id="mw">`
      + `<stop offset="0" stop-color="#b6c2e0" stop-opacity="0.09"/>`
      + `<stop offset="0.6" stop-color="#8f9cc0" stop-opacity="0.04"/>`
      + `<stop offset="1" stop-color="#8f9cc0" stop-opacity="0"/></radialGradient>`,
    );
    body.push(
      `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(W * 0.75)}" ry="${n2(between(W * 0.12, W * 0.24))}"`
      + ` transform="rotate(${n2(deg)} ${n2(cx)} ${n2(cy)})" fill="url(#mw)"/>`,
    );
  }

  /* ── 은하 하나 — 셋 중 하나쯤의 하늘에만 있다(사진의 그것). 가운데가 밝고 밖으로
     스러지는 원반에, 나선 팔 두어 줄을 아주 옅게 두른다. */
  if (rnd() < 0.55) {
    const cx = between(W * 0.2, W * 0.8);
    const cy = between(W * 0.15, W * 0.7);
    /* ★ 은하는 **작다**(요청: "은하 크기 대폭 줄이기") — 0.17~0.32W면 지름이 하늘의
       3분의 2까지 차서, 배경이 아니라 그림의 주인공이 됐다. 3분의 1로 줄여 '저 멀리
       은하 하나'로 물러앉힌다. 팔 굵기·나선 폭은 rr에 매여 있어 함께 준다. */
    const rr = between(W * 0.055, W * 0.11);
    const flat = between(0.42, 0.72);
    const deg = between(0, 180);
    defs.push(
      `<radialGradient id="gx">`
      + `<stop offset="0" stop-color="#f7f9ff" stop-opacity="0.85"/>`
      + `<stop offset="0.22" stop-color="#dde3f4" stop-opacity="0.4"/>`
      + `<stop offset="0.6" stop-color="#9fabcc" stop-opacity="0.17"/>`
      + `<stop offset="1" stop-color="#7a86ac" stop-opacity="0"/></radialGradient>`,
    );
    /* ★ 나선 팔은 **선이 아니라 별의 띠**다(지적: 팔이 회색 소시지처럼 보인다) ────────
       처음에는 굵은 폴리라인 한 줄로 그렸다. 굵고 불투명한 획에 둥근 끝이 붙으니 팔이
       아니라 **관**으로 읽혔다 — 사진의 은하는 어디에도 그런 경계선이 없다.
       세 겹으로 나눈다:
         ① 아주 넓고 옅은 밑겹 — 팔이 있는 자리의 흐릿한 빛이다(경계가 없다).
         ② 가는 심 — 팔의 결. 밑겹의 3분의 1 굵기에 옅게.
         ③ **점들** — 팔을 따라 흩뿌린 작은 별. 사진에서 팔이 팔로 읽히는 것은
            이 알갱이 때문이다. 안쪽은 촘촘하고 바깥은 성기다.
       팔은 밖으로 갈수록 가늘어진다 — 한 획으로는 못 하므로 토막마다 굵기를 준다. */
    const arms: string[] = [];
    const armN = 2 + Math.floor(rnd() * 2);
    const wind = between(2.0, 3.2);
    for (let a = 0; a < armN; a += 1) {
      const t0 = (a / armN) * Math.PI * 2 + between(-0.2, 0.2);
      /** 팔 위의 자리 — u는 0(중심)~1(바깥). */
      const at = (u: number, off = 0): [number, number] => {
        const th = t0 + u * wind;
        const rad = rr * (0.14 + u * 0.88) + off;
        return [Math.cos(th) * rad, Math.sin(th) * rad * flat];
      };
      const pts: string[] = [];
      for (let k = 0; k <= 14; k += 1) pts.push(at(k / 14).map(n2).join(","));
      const line = pts.join(" ");
      arms.push(
        /* 밑겹은 **경계가 안 보일 만큼** 옅어야 한다 — 조금만 진해도 둥근 끝이 살아나
           팔이 도로 '관'으로 읽힌다(0.07에서 실제로 회색 활이 보였다). */
        `<polyline points="${line}" fill="none" stroke="#c2cde6" stroke-opacity="0.04"`
        + ` stroke-width="${n2(rr * 0.2)}" stroke-linecap="round"/>`
        + `<polyline points="${line}" fill="none" stroke="#e4e9f6" stroke-opacity="0.09"`
        + ` stroke-width="${n2(rr * 0.08)}" stroke-linecap="round"/>`,
      );
      // 원반이 작아진 만큼 알갱이도 준다 — 안 그러면 점이 뭉쳐 흰 얼룩이 된다.
      const dotN = 14 + Math.floor(rnd() * 10);
      for (let d = 0; d < dotN; d += 1) {
        // 안쪽이 촘촘하게 — u를 제곱해 가운데로 몰고, 팔 두께 안에서 흩는다.
        const u = 0.08 + rnd() * rnd() * 0.92;
        const [dx9, dy9] = at(u, (rnd() - 0.5) * rr * 0.22);
        arms.push(
          `<circle cx="${n2(dx9)}" cy="${n2(dy9 + (rnd() - 0.5) * rr * 0.1)}"`
          + ` r="${n2(0.35 + rnd() * rnd() * 0.9)}" fill="#eef1f8"`
          + ` opacity="${n2(0.3 + rnd() * 0.55)}"/>`,
        );
      }
    }
    body.push(
      `<g transform="translate(${n2(cx)} ${n2(cy)}) rotate(${n2(deg)})">`
      + `<ellipse rx="${n2(rr)}" ry="${n2(rr * flat)}" fill="url(#gx)"/>`
      + arms.join("")
      + `</g>`,
    );
  }

  /* ── 별 — 고르게 뿌리되 **뭉치는 자리 몇**을 따로 둔다. 완전 균등하면 눈이 곧
     '격자'로 읽어 인공물처럼 보인다. */
  const clusters: [number, number, number][] = [];
  const clN = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < clN; i += 1) {
    clusters.push([between(0, W), between(0, W), between(W * 0.08, W * 0.2)]);
  }
  // 별 수를 줄인다(요청: "별 개수 줄이기") — 300~500은 하늘이 소금 뿌린 듯 빽빽했다.
  const starN = 130 + Math.floor(rnd() * 90);
  const stars: string[] = [];
  for (let i = 0; i < starN; i += 1) {
    let x: number;
    let y: number;
    if (rnd() < 0.32 && clusters.length > 0) {
      // 뭉친 별 — 가우스 흉내(둘을 더해 가운데가 두껍다).
      const [cx, cy, cr] = pick(clusters);
      x = cx + (rnd() + rnd() - 1) * cr;
      y = cy + (rnd() + rnd() - 1) * cr;
    } else {
      x = between(0, W);
      y = between(0, W);
    }
    if (x < 0 || x > W || y < 0 || y > W) continue;
    /* 크기는 **작은 것이 압도적으로 많다**(제곱으로 죄어 큰 별을 드물게) — 실제 하늘의
       밝기 분포가 그렇고, 그래야 몇 안 되는 큰 별이 눈에 든다. */
    const u = rnd() * rnd();
    const r = 0.5 + u * 2.3;
    const a = 0.46 + rnd() * 0.54;
    /* 색은 흰빛이 압도적이고, 가끔만 **아주 옅게** 차거나 따뜻하다 — 별 하나하나가
       색을 띠면 하늘이 도로 알록달록해진다(요청: 보라·푸른색 빼기). */
    const c = rnd() < 0.1 ? "#dee6f5" : rnd() < 0.08 ? "#f6ecdc" : "#ffffff";
    stars.push(
      `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(r)}" fill="${c}" opacity="${n2(a)}"/>`,
    );
  }
  body.push(stars.join(""));

  /* ── 밝은 별 몇 — 십자 광채를 두른다. 이것이 '사진 같음'의 대부분을 낸다. */
  const brightN = 5 + Math.floor(rnd() * 6);
  for (let i = 0; i < brightN; i += 1) {
    const x = between(W * 0.05, W * 0.95);
    const y = between(W * 0.05, W * 0.95);
    /* 광채도 줄인다(요청: "십자별 크기 줄이기") — 팔 길이가 하늘 폭의 12%(양쪽 합)
       까지 갔던 것을 5% 아래로. 심지와 획도 같은 몫으로 줄여야 십자가 가늘게 반짝인다. */
    const len = between(W * 0.009, W * 0.024);
    body.push(
      `<g opacity="${n2(between(0.7, 1))}">`
      + `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(between(1.1, 1.9))}" fill="#fff"/>`
      + `<path d="M${n2(x - len)} ${n2(y)}H${n2(x + len)}M${n2(x)} ${n2(y - len)}V${n2(y + len)}"`
      + ` stroke="#fff" stroke-opacity="0.6" stroke-width="0.7"/>`
      + `</g>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}"`
    + ` preserveAspectRatio="xMidYMid slice"><defs>${defs.join("")}</defs>${body.join("")}</svg>`;
  /* `#`만 반드시 달아나면 된다(url() 안에서 조각 구분자로 읽힌다). 통째로 인코딩하면
     길이가 배로 늘어 배경 문자열이 쓸데없이 커진다. */
  return `url("data:image/svg+xml,${svg.replace(/#/g, "%23").replace(/"/g, "'")}")`;
}
