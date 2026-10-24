/** 한글 마지막 글자의 받침 유무 — 중계 자막·검색 묘사의 조사(가/이 · 와/과 · 를/을) 고르기. 한글이 아니면(라틴 이름) 받침 없음으로 본다. */
export const koBatchim9 = (s9) => {
    const c9 = s9.charCodeAt(s9.length - 1);
    return c9 >= 0xac00 && c9 <= 0xd7a3 && (c9 - 0xac00) % 28 !== 0;
};
export const koWa9 = (s9) => (koBatchim9(s9) ? "과" : "와");
export const koEul9 = (s9) => (koBatchim9(s9) ? "을" : "를");
export const koGa9 = (s9) => (koBatchim9(s9) ? "이" : "가");
