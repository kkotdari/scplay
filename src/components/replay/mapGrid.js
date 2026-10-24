/* 지도 격자 — **재생기가 받는 자료의 꼴**이다.
   원래 utils/replayParser.ts 안에 있었는데, 재생기는 파서를 한 번도 안 부른다(전부
   `import type`이었다). 꼴 하나 때문에 파서 전체와 그것이 끌고 오는 것들을 패키지에 넣을
   까닭이 없다 — 재생기가 아는 것은 '이런 모양의 지도가 온다'뿐이고, 그것을 **누가 어떻게
   만드는지는 앱의 일**이다. */
/** ★ 빈 지도(128×128 · 팔레트 0 하나) — 자료를 기다리는 재생기(ReplayModule pending · 2026-10-23)가 받는 자리 채움. 그림은 까만 판에 가려 안 보인다.
 *  타일 16384 바이트(0) = base64 "AAAA" × 5461 + "AA==". */
export const PENDING_GRID9 = {
    hash: "", name: "", width: 128, height: 128, palette: [0], tiles: "AAAA".repeat(5461) + "AA==", resources: [],
};
