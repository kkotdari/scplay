import type { ComponentType, ReactNode } from "react";
import ReplayRaceBadge from "./RaceBadge";

/* 앱이 꽂아 주는 것들 — **필수만 패키지에 넣는다**.
     · 프사(Avatar)  안 넣는다. 앱마다 사람의 그림이 다르고, 그리려면 그 앱의 회원 개념이
                     따라온다. 꽂으면 그리고 안 꽂으면 안 그린다.
     · 종족 배지     넣는다(RaceBadge.tsx). 이 판의 알맹이인데 앱 개념을 안 쓴다.
     · 알림(toast)   연결만 받는다. 토스트는 앱의 층(겹침·안전영역·테마)이라 제 것을 띄우면
                     두 벌이 겹친다.
   프롭이 아니라 한 자리에 꽂는 까닭: 쓰는 곳이 로스터 깊숙한 자리라, 프롭으로 내리면 중간
   컴포넌트 여남은 개가 자기와 상관없는 것을 나른다. 화면마다 달라지는 스위치만 프롭이다
   (ReplayModule의 avatars). */

export interface ReplayChromeMember {
  id: string;
  nickname: string;
  avatar: string | null;
}

export type ReplayAvatarComponent = ComponentType<{
  member?: ReplayChromeMember | null;
  size?: number;
  className?: string;
  icon?: ReactNode;
}>;

export type ReplayRaceBadgeComponent = ComponentType<{
  race: string;
  size?: number;
  circleLetter?: boolean;
  className?: string;
}>;

export interface ReplayChrome {
  Avatar?: ReplayAvatarComponent;
  RaceBadge?: ReplayRaceBadgeComponent;
  toast?: (text: string, opts?: { kind?: string; ms?: number }) => void;
}

let chrome: ReplayChrome = { RaceBadge: ReplayRaceBadge };

/** 앱이 부팅에서 한 번 부른다. 준 것만 덮는다. */
export function setReplayChrome(next: ReplayChrome): void { chrome = { ...chrome, ...next }; }

export function replayChrome(): ReplayChrome { return chrome; }

/** 안 꽂혔으면 아무 일도 안 한다 — 부르는 쪽이 갈래를 안 지게. */
export function replayToast(text: string, opts?: { kind?: string; ms?: number }): void {
  chrome.toast?.(text, opts);
}

/** 프사를 그릴까 — 앱이 꽂았고(chrome.Avatar) 이 화면이 켰을 때(on)만. 둘은 다른 물음이다. */
export function replayAvatarOn(on: boolean | undefined): ReplayAvatarComponent | null {
  return on === false ? null : chrome.Avatar ?? null;
}
