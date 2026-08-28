/* 재생 계측기 — `?perf=1`일 때만 돈다.
 *
 * 왜 따로 파일인가: 그리는 일이 **한 군데가 아니다**. 리액트가 만드는 마커(DOM) 말고도
 * 캔버스 층이 셋(유닛·안개·지도벡터) 있고, 그것들은 모두 렌더가 끝난 **뒤** 제 이펙트에서
 * 칠한다. 계측기가 플레이어 파일 안에만 있으면 그 셋의 삯이 전부 '브라우저(뺄셈)' 한 통에
 * 섞여 보이지 않는다 — 실제로 브라우저 몫 67ms의 정체를 그렇게 놓치고 있었다.
 * 셋이 같은 자를 쓰려면 자가 밖에 있어야 한다.
 */
export const PERF9 = typeof location !== "undefined"
  && /[?&]perf=1/.test(location.search);

/* ★ `?dpr=N` — 캔버스 배킹 배수의 **상한**을 눌러 보는 재보기 깃발.
   왜 이것을 재는가: 배포판 계측에서 프레임 131.82ms 가운데 '나머지(브라우저)'가
   69.70ms, '붓:유닛캔버스'가 23.72ms였다. 둘 다 **칠하는 픽셀 수**에 붙는 삯이고,
   그 픽셀 수는 배킹 배수 B의 **제곱**으로 는다 — 아이폰의 dpr 3은 1배의 아홉 배다.
   (같은 결론이 이미 코드에 적혀 있다: ReplayMotionPlayer의 배킹 주석, "프레임 133ms
   가운데 83ms가 스프라이트 칠하기, 굽기 빗나감은 0%".)
   다만 배킹을 내리는 것은 **화질을 파는 일**이라 내가 정할 수 없다. 그래서 깃발만 단다:
   같은 장면을 `?perf=1`·`?perf=1&dpr=2`·`?perf=1&dpr=1.5`로 보면 그 값이 곧 답이다. */
export const DPRCAP9 = ((): number => {
  if (typeof location === "undefined") return Infinity;
  const m9 = /[?&]dpr=([0-9.]+)/.exec(location.search);
  const v9 = m9 ? Number(m9[1]) : NaN;
  return Number.isFinite(v9) && v9 > 0 ? v9 : Infinity;
})();

/* ★ `?nodom=1` — **만든 마커를 버려 본다**(그리기 고리는 그대로 돌린다).
   '나머지(브라우저)'는 뺄셈으로 낸 값이라 정체를 모른다. dpr을 3에서 1.5로 내려도
   꿈쩍 안 했으니 캔버스 픽셀 수는 아니다. 남은 큰 후보는 **DOM 노드**다 — 개체·건물
   마커 수백 개의 스타일 재계산·배치·칠하기는 우리가 잴 수 없는 자리에서 일어난다.
   그것만 정확히 떼어 보려면 고리는 **그대로 돌리고 결과만 버려야** 한다. 고리를 건너뛰면
   캔버스 명령(unitOps·fxOps)까지 함께 사라져 DOM과 캔버스가 뒤섞인다.
   그래서 이 깃발은 마커 배열을 빈 것으로 갈아 끼우기만 한다:
     · 렌더전체(JS)와 붓:유닛캔버스가 **그대로**이고
     · 나머지(브라우저)만 **무너지면** → 범인은 DOM이다.
     · 셋 다 그대로면 → DOM도 아니다. 그때는 사파리 웹 인스펙터로 직접 봐야 한다. */
export const NODOM9 = typeof location !== "undefined"
  && /[?&]nodom=1/.test(location.search);

/* ★ `?hide=fog,unit,mapvec,mini` — **층을 하나씩 빼 본다**.
   '나머지(브라우저)'가 58~70ms에 붙어 꿈쩍을 안 한다. dpr을 3에서 1.5로 내려도(픽셀 1/4),
   그림자를 꺼도 그대로였다. 그 값이 우리가 그리는 **내용**을 안 따라간다는 뜻이다.
   그렇다면 남은 것은 **층 그 자체**의 삯이다 — 화면을 덮는 캔버스·시트가 넷 다섯이고,
   그 하나하나는 내용이 무엇이든 화면 넓이만큼 래스터·합성된다.
   층을 하나 빼서 나머지가 그 몫만큼 줄면 답이 나온다. 안 줄면 층도 아니다 —
   그때는 뺄셈을 그만두고 사파리 웹 인스펙터로 직접 봐야 한다.

   숨기는 길은 **CSS(display:none)**다 — JSX를 걷어내는 쪽이 아니다. 까닭이 있다:
   그리는 일(캔버스 붓)은 그대로 돌게 두어야 우리 JS 삯이 안 바뀌고, 그래야 줄어든 몫이
   오롯이 **층의 삯**(래스터·합성)임을 알 수 있다. 걷어내면 둘이 뒤섞인다. */
export const HIDECLS9 = ((): string => {
  if (typeof location === "undefined") return "";
  const m9 = /[?&]hide=([a-z,]+)/.exec(location.search);
  if (!m9) return "";
  return m9[1].split(",").map((n9) => ` scr-hide-${n9}`).join("");
})();

/* ★ `?gap=N` — **모바일 그리기 문턱**(ms)을 손으로 바꿔 본다. 기본값은 아래 참고.
   이 값이 곧 프레임 상한이다: 문턱이 50ms면 아무리 빨라도 20Hz를 못 넘는다.
   부드러움은 숫자가 아니라 **눈**이 정하므로, 몇 값을 직접 보고 고르라고 손잡이를 둔다. */
export const GAP9 = ((): number => {
  if (typeof location === "undefined") return 0;
  const m9 = /[?&]gap=([0-9]+)/.exec(location.search);
  const v9 = m9 ? Number(m9[1]) : NaN;
  return Number.isFinite(v9) && v9 >= 8 ? v9 : 0;
})();

/** `?noshadow=1` — 유닛 도형의 drop-shadow를 꺼 보는 재보기 깃발(보기 규칙이 아니라 자다). */
export const NOSHADOW9 = typeof location !== "undefined"
  && /[?&]noshadow=1/.test(location.search);

export const perfMs: Record<string, number> = {};
export const perfHit: Record<string, number> = {};
let perfFrames = 0;
/** 몇 번째 60렌더 창인가 — 1번은 시작 삯이 든 창이라 못 믿는다(아래 ★). */
let perfWindow = 0;

export const pNow = (): number => (typeof performance !== "undefined" ? performance.now() : 0);

export const pAdd = (k: string, dt: number): void => {
  perfMs[k] = (perfMs[k] ?? 0) + dt;
  perfHit[k] = (perfHit[k] ?? 0) + 1;
};

/** 세는 것만 — 시간이 아니라 개수를 싣는다(개체수·걷어냄 따위). */
export const pCount = (k: string, n: number): void => {
  perfMs[k] = perfMs[k] ?? 0;
  perfHit[k] = (perfHit[k] ?? 0) + n;
};

/** 이 함수에 든 시간을 그 이름으로 싣는다 — 캔버스 붓들이 쓰는 갈래. */
export const pWrap = <T>(k: string, fn: () => T): T => {
  if (!PERF9) return fn();
  const a9 = pNow();
  try { return fn(); } finally { pAdd(k, pNow() - a9); }
};

/** 렌더가 끝난 시각 — 커밋(리액트 조정 + DOM 고치기) 몫을 여기서부터 잰다. */
export const perfState9 = { renderEnd: 0 };

let perfLastAt = 0;
/* ★ 프레임주기는 **중앙값도** 낸다 — 평균만 보다가 잡음에 속을 뻔했다.
   같은 조건을 세 번 재서 107·133·145ms가 나왔다(30% 흔들림). 60렌더는 8초치라 그 사이
   장면이 통째로 바뀌고, 큰 덜컥임 몇 번이 평균을 통째로 끌어간다. 그러면 고친 것이
   먹었는지 아닌지를 못 가른다.
   중앙값은 그 덜컥임에 안 끌린다 — '평소 이만큼'을 말한다. 둘을 같이 보면 벌어진 폭이
   곧 덜컥임의 크기라, 그 자체가 또 하나의 자다. */
const gaps9: number[] = [];
/* ★ **가장 느렸던 한 프레임**을 따로 붙든다(지적: "대체적으로 부드러운데 중간중간 뚝뚝
   느려질 때가 있어") ────────────────────────────────────────────────────────────────
   덜컥임은 평균으로 못 잡는다. 60프레임을 뭉갠 값에서는 40ms짜리 한 프레임이 나머지
   쉰아홉에 묻혀 0.5ms로 보인다 — 실제로 이 판의 평균(15.18)이 중앙값(12.40)보다 높은
   것이 그 자국인데, 자국만 있고 범인이 없다.
   그래서 창 안에서 **주기가 가장 길었던 프레임**을 하나 붙들고, 그 프레임에서 어느
   항목이 컸는지를 함께 적는다. 항목별 값은 창 내내 더해지기만 하므로, 프레임마다
   직전 값과의 **차**를 보면 그 한 프레임의 몫이 그대로 나온다.
   덜컥임의 흔한 뿌리 셋이 이 줄에서 곧장 갈린다:
     · 굽기(모델·지형·미니맵) — 새 조합이 나올 때만 도는 값이라 평균에는 거의 안 뜬다.
     · 리액트 커밋 — 화면에 뜬 마커 수가 확 달라지는 순간.
     · 어느 것도 안 크면 → 우리 JS가 아니다(GC·합성). 그때는 잰 몫의 합보다 주기가
       훨씬 큰 것으로 드러난다. */
let worstGap9 = 0;
let worstLine9 = "";
const prevMs9: Record<string, number> = {};
let line9 = "재는 중…";
export const perfLine9 = (): string => line9;

export const pFrame = (): void => {
  /* 프레임 **주기**도 함께 잰다 — 준비가 2ms인데 주기가 60ms면 비용은 딴 데(그리기·
     리액트 조정)에 있다는 뜻이다. 조각 시간만 보면 그것을 영영 못 본다. */
  const now9 = pNow();
  if (perfLastAt) {
    const gap9 = now9 - perfLastAt;
    pAdd("프레임주기", gap9);
    gaps9.push(gap9);
    /* 이 창에서 가장 느렸던 프레임이면, 그 프레임의 항목별 몫(직전과의 차)을 적어 둔다. */
    if (gap9 > worstGap9) {
      worstGap9 = gap9;
      const d9: [string, number][] = [];
      for (const k9 of Object.keys(perfMs)) {
        if (k9 === "프레임주기") continue;
        const dv9 = perfMs[k9] - (prevMs9[k9] ?? 0);
        if (dv9 > 0.05) d9.push([k9, dv9]);
      }
      d9.sort((a9, b9) => b9[1] - a9[1]);
      worstLine9 = d9.slice(0, 4).map(([k9, v9]) => `${k9} ${v9.toFixed(1)}`).join(" · ")
        || "잰 것 없음(GC·합성 쪽)";
    }
  }
  for (const k9 of Object.keys(perfMs)) prevMs9[k9] = perfMs[k9];
  perfLastAt = now9;
  perfFrames += 1;
  if (perfFrames < 60) return;
  /* 남는 몫은 **뺄셈으로** 낸다 — 스타일·배치·칠하기·합성은 우리가 잴 수 없다.
     주기에서 우리가 잰 것(렌더·커밋·캔버스 붓 셋)을 빼면 남는 것이 그것이다.
     ★ 캔버스 붓을 빼는 것이 요점이다(이 파일이 생긴 까닭) — 여태 그 셋이 여기 섞여
       있어서 '브라우저가 느리다'로 읽혔다. 이제 남는 값이 정말로 브라우저 몫이다. */
  const per9 = (k: string): number => (perfMs[k] ?? 0) / perfFrames;
  const rest9 = per9("프레임주기") - per9("렌더전체(JS)") - per9("커밋(리액트·DOM)")
    - per9("붓:유닛캔버스") - per9("붓:안개캔버스") - per9("붓:지도벡터") - per9("붓:미니맵");
  /* 횟수는 **반올림하지 않는다** — 여기서 한 번 속았다. 효과에서 재는 값(커밋·붓 넷)이
     전부 `×0`으로 찍혔는데, 0.5 미만이 0으로 뭉개진 것이었다. 그 0.5가 사실은 가장 중요한
     단서다: 렌더가 커밋의 **두 배**로 돈다는 뜻이고, 그건 개발판 StrictMode의 이중 렌더다.
     뭉갠 값은 단서를 지운다. 1보다 작으면 소수로 적는다. */
  const hit9 = (k: string): string => {
    const v9 = perfHit[k] / perfFrames;
    return v9 >= 1.5 ? String(Math.round(v9)) : v9.toFixed(1);
  };
  const parts = Object.keys(perfMs).sort((a, b) => perfMs[b] - perfMs[a])
    .map((k) => `${k} ${(perfMs[k] / perfFrames).toFixed(2)}ms×${hit9(k)}`);
  if (gaps9.length) {
    const srt9 = gaps9.slice().sort((a, b) => a - b);
    const med9 = srt9[srt9.length >> 1];
    parts.splice(1, 0, `프레임중앙값 ${med9.toFixed(2)}ms`);
  }
  if (perfMs["프레임주기"]) parts.splice(2, 0, `나머지(브라우저·뺄셈) ${rest9.toFixed(2)}ms`);
  /* 덜컥임은 이 줄이 말한다 — 평균 옆에 바로 붙여 둔다(위 worstGap9 주석). */
  if (worstGap9 > 0) {
    parts.splice(3, 0, `⚠최악프레임 ${worstGap9.toFixed(1)}ms(${worstLine9})`);
  }
  /* ★ **어느 판을 재고 있나**를 맨 앞에 박는다 — 이것을 모르면 나머지가 다 헛것이다.
     개발판은 리액트가 StrictMode에서 렌더를 **두 번** 돌리고(효과는 한 번), 검사·경고가
     붙은 느린 빌드다. 그 판의 40ms를 배포판의 40ms로 읽으면 없는 병을 고치게 된다. */
  /* ★ **어느 깃발로 잰 값인지 줄이 스스로 말한다** — 화면을 찍어 견주는 자리라,
     찍힌 그림만 보고는 그것이 기준판인지 `nodom`인지 `hide=all`인지 알 길이 없다.
     실제로 세 판을 받아 놓고 어느 것이 무엇인지 몰라 읽기를 멈춰야 했다. 자를 든 사람이
     자에 무엇을 걸었는지 적어 두지 않으면, 그 뒤의 모든 견줌이 짐작이 된다. */
  const flag9 = (typeof location === "undefined" ? "" : location.search)
    .replace(/^\?/, "").split("&")
    .filter((q9) => q9 && !/^(perf|screen|group|game|t|z|cx|cy)=/.test(q9))
    .join("·");
  /* ★ **몇 번째 표본인지 적는다** — 여기서 크게 속고 있었다 ────────────────────────
     한 표본은 60렌더, 곧 7초 남짓이다. 그런데 화면을 찍는 사람은 페이지가 뜨자마자
     찍게 되므로, 여태 받아 본 모든 값이 **첫 7초**였다 — 마운트·지형 굽기·스프라이트
     첫 굽기·레이아웃 자리잡기가 통째로 든 구간이다.
     증거는 계측 자신이 남겼다: 지도벡터 붓이 열 렌더에 한 번 돈다고 했는데, 갈린
     의존성을 찍어 보니 `0x0→393x393`, `393x393→435x435` — 흔들림이 아니라 **처음 한 번씩**
     이었다. 평균이 중앙값의 두 배인 것도 그 시작 삯이 앞머리에 몰려 있어서다.
     시작 구간을 '평소'로 읽으면 없는 병을 고치게 된다. 표본 번호를 적어, 2번·3번을
     보고 판단할 수 있게 한다(그 창은 이미 다 굽고 자리잡은 뒤다). */
  perfWindow += 1;
  const mode9 = import.meta.env.DEV
    ? `개발판(느림·렌더2회) 표본#${perfWindow}`
    : `배포판 표본#${perfWindow}${perfWindow <= 1 ? "(시작구간·못 믿음)" : ""}`;
  parts.unshift(flag9 ? `${mode9} [${flag9}]` : `${mode9} [기준]`);
  /* PC는 콘솔, **모바일은 화면**(요청: 모바일 사파리라 로그를 못 본다) — 둘 다 남긴다.
     화면 쪽은 컴포넌트가 프레임마다 다시 그리므로 이 문자열만 갈아 두면 저절로 갱신된다. */
  line9 = parts.join(" · ");
  // eslint-disable-next-line no-console
  console.log(`[perf] 프레임당 · ${line9}`);
  gaps9.length = 0;
  worstGap9 = 0;
  worstLine9 = "";
  for (const k of Object.keys(perfMs)) { delete perfMs[k]; delete perfHit[k]; delete prevMs9[k]; }
  perfFrames = 0;
};
