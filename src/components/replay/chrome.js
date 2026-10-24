import ReplayRaceBadge from "./RaceBadge";
let chrome = { RaceBadge: ReplayRaceBadge };
/** 앱이 부팅에서 한 번 부른다. 준 것만 덮는다. */
export function setReplayChrome(next) { chrome = { ...chrome, ...next }; }
export function replayChrome() { return chrome; }
/** 안 꽂혔으면 아무 일도 안 한다 — 부르는 쪽이 갈래를 안 지게. */
export function replayToast(text, opts) {
    chrome.toast?.(text, opts);
}
/** 프사를 그릴까 — 앱이 꽂았고(chrome.Avatar) 이 화면이 켰을 때(on)만. 둘은 다른 물음이다. */
export function replayAvatarOn(on) {
    return on === false ? null : chrome.Avatar ?? null;
}
