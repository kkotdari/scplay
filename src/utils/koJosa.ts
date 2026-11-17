/** 이름 끝 소리의 받침 — 중계 자막·검색 묘사의 조사(가/이 · 와/과 · 를/을 · (으)로) 고르기.
 *  "none" 받침 없음 · "l" ㄹ 받침((으)로 가 "로") · "c" 그 밖의 받침.
 *  ★ 라틴 · 숫자 이름도 읽는 소리로(2026-11-17, 지적: "영어 뒤에 한글 조사가 어색하게 붙는 경우 · netan가 netan는 이 아니라 netan이 netan은 이 자연스러워") —
 *  옛: 한글이 아니면 늘 받침 없음(→ "netan가"). 끝의 기호(_ · ! · ] …)는 건너뛰고 마지막 한글 · 영문 · 숫자로 가른다.
 *  - 숫자: 끝 자리를 읽은 소리(0 영 · 1 일 · 3 삼 · 6 육 · 7 칠 · 8 팔 → 받침 · 1 · 7 · 8 은 ㄹ).
 *  - 대문자만이고 모음이 없으면(SK · KT) 글자 이름: L 엘 · R 알(ㄹ) · M 엠 · N 엔 → 받침 · 나머지 없음.
 *  - 영어 낱말: n · m · ng → 받침 · l · le → ㄹ · 모음 뒤 k · p · t · c(book 북 · cup 컵 · cat 캣 · magic 매직) → 받침 ·
 *    me · ne 로 끝나면 e 를 안 읽어 받침(game 게임 · line 라인) · 그 밖(모음 · r · s · x · d · g · b …)은 받침 없음(tiger 타이거 · rex 렉스 · bed 베드). 어림이다. */
export type KoJong9 = "none" | "l" | "c";

const DIGIT_JONG9: Record<string, KoJong9> = { "0": "c", "1": "l", "2": "none", "3": "c", "4": "none", "5": "none", "6": "c", "7": "l", "8": "l", "9": "none" };
const VOWEL9 = /[aeiouy]/;

export function koJong9(s9: string): KoJong9 {
  /* 마지막 한글 · 영문 · 숫자 */
  let i9 = s9.length - 1;
  while (i9 >= 0 && !/[0-9A-Za-z가-힣]/.test(s9[i9])) i9 -= 1;
  if (i9 < 0) return "none";
  const ch9 = s9[i9];
  const c9 = ch9.charCodeAt(0);
  if (c9 >= 0xac00 && c9 <= 0xd7a3) {
    const j9 = (c9 - 0xac00) % 28;
    return j9 === 0 ? "none" : j9 === 8 ? "l" : "c";
  }
  if (ch9 >= "0" && ch9 <= "9") return DIGIT_JONG9[ch9];
  /* 끝의 영문 덩이 */
  let k9 = i9;
  while (k9 > 0 && /[A-Za-z]/.test(s9[k9 - 1])) k9 -= 1;
  const word9 = s9.slice(k9, i9 + 1);
  if (word9 === word9.toUpperCase() && !/[AEIOU]/.test(word9)) {
    const L9 = word9[word9.length - 1];
    return L9 === "L" || L9 === "R" ? "l" : L9 === "M" || L9 === "N" ? "c" : "none";
  }
  const w9 = word9.toLowerCase();
  const last9 = w9[w9.length - 1];
  const prev9 = w9.length >= 2 ? w9[w9.length - 2] : "";
  if (last9 === "n" || last9 === "m" || w9.endsWith("ng")) return "c";
  if (last9 === "l" || w9.endsWith("le")) return "l";
  if (w9.length >= 3 && (w9.endsWith("me") || w9.endsWith("ne")) && VOWEL9.test(w9[w9.length - 3])) return "c";   // game 게임 · line 라인
  if ((last9 === "k" || last9 === "p" || last9 === "t" || last9 === "c") && VOWEL9.test(prev9) && prev9 !== "y") return "c";
  if (last9 === "k" && prev9 === "c" && w9.length >= 3 && VOWEL9.test(w9[w9.length - 3])) return "c";   // back 백 · rock 록
  return "none";
}

export const koBatchim9 = (s9: string): boolean => koJong9(s9) !== "none";
export const koWa9 = (s9: string): string => (koBatchim9(s9) ? "과" : "와");
export const koEul9 = (s9: string): string => (koBatchim9(s9) ? "을" : "를");
export const koGa9 = (s9: string): string => (koBatchim9(s9) ? "이" : "가");
/** 은/는 — 같은 받침 셈(지적의 "netan은"). */
export const koEun9 = (s9: string): string => (koBatchim9(s9) ? "은" : "는");
/** (으)로 — ㄹ 받침이나 받침 없음은 "로". */
export const koRo9 = (s9: string): string => (koJong9(s9) === "c" ? "으로" : "로");
