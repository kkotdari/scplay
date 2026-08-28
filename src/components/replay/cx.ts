/* 클래스 이름 잇기 — 패키지 제 것이다.
   앱의 utils/format에 같은 함수가 있지만 빌려 쓰지 않는다: 그 한 줄이 있으면 패키지를
   옮길 때 앱의 잡동사니 파일과 그것이 끌고 오는 것들이 따라간다. 의존의 값은 줄 수와
   무관하다 — 중복이 옳은 자리다. */
type ClassValue = string | false | null | undefined;

export const cx = (...a: ClassValue[]): string => a.filter(Boolean).join(" ");
