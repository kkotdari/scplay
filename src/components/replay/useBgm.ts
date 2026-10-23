import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ambientAudio9 } from "./sfx9";

/** ── 배경 음악(요청: "public/audio에 mp3 파일 10개 있어 그거 랜덤하게 재생해 주고,
 *  대신 음악 on/off 아이콘 추가 · 기기 음량 따라가야 하고 음소거(진동·무음 포함)
 *  모드면 안 들려야 됨" · "기본 재생으로 해 줘(무음 모드에선 안 틀기)") ──────────────
 *
 *  ★ 기기 음량·무음을 따르는 길은 **아무것도 안 하는 것**이다.
 *    이 파일에는 `volume`을 건드리는 줄도, `AudioContext`를 만드는 줄도 없다. 둘 다
 *    일부러 뺐다:
 *      · `volume`을 1 미만으로 두면 그 순간부터 '앱 음량'이라는 두 번째 손잡이가
 *        생겨서, 기기 음량을 올려도 안 커지는 소리가 된다. iOS는 아예 읽기 전용이라
 *        기기마다 동작이 갈리기까지 한다. 건드리지 않으면 OS 음량이 그대로 유일한 자다.
 *      · WebAudio(AudioContext)를 열면 사파리가 오디오 세션 갈래를 바꿔 **무음 스위치를
 *        무시하고** 소리를 내는 길로 들어선다. 그래서 웹에서 무음 스위치를 뚫는 꼼수가
 *        늘 WebAudio다 — 우리는 그 반대를 원하므로 평범한 <audio> 하나만 쓴다.
 *    그러면 iOS는 벨소리/무음 스위치와 음량을, 안드로이드는 미디어 음량을 그대로 태운다.
 *  ⚠ (2026-10-22 정정, 지적: "배경음악도 사일런트 모드 대응") — 위 '<audio> 는 무음 스위치를 따른다'는 틀렸다: iOS 사파리의 미디어 엘리먼트는 기본이
 *    'playback' 세션이라 무음 스위치를 **뚫고** 난다. 사파리 16.4+ 의 `navigator.audioSession.type = "ambient"` 로 세션을 바꾸면 무음 스위치를 따르고
 *    남의 음악도 안 끊는다 — sfx9 ambientAudio9 가 하고, 아래 audio() 가 소리를 낼 때마다 부른다(그 API 가 없는 옛 기기는 그대로).
 *
 *  ⚠ 안드로이드의 한계 — 웹에는 '지금 진동·무음 모드인가'를 묻는 길이 없다(그런 API가
 *    없다). 안드로이드에서 미디어 소리는 벨소리와 **다른 줄기**라, 벨을 진동으로 두어도
 *    미디어는 미디어 음량을 따른다. 곧 여기서 지킬 수 있는 것은 '미디어 음량 0이면 안
 *    들린다'까지다. iOS는 무음 스위치가 미디어까지 덮으므로 요청 그대로 동작한다.
 *
 *  ★ (되물림 — 지금은 기본 켜짐 · 아래 wantOn) 기본이 **꺼짐**이다(지시: "안 건드리면 조용하고 켜야 나는 게 맞아") — 켠 적이 있는
 *    사람만 나고, 그 뜻은 브라우저에 남아 다음 경기에도 따라간다(아래 wantOn).
 *  ★ 켜 둔 사람에게도 '켜 둔 뜻'이 곧 '지금 소리가 난다'는 아니다 — 브라우저는 사람의
 *    누름 없이 소리 나는 재생을 막는다. **아이콘은 뜻이 아니라 지금을 말한다**(지적):
 *      ① 판에 서자마자 한 번 튼다. 앱 안에서 경기를 눌러 들어온 길이면 이미 누름이
 *         있었으므로 여기서 그냥 나고, 아이콘도 켜진 얼굴이 된다.
 *      ② 막히면 **꺼진 얼굴로 둔다**. 소리는 없는데 켜졌다고 적혀 있으면, 켜려고 누른
 *         사람이 오히려 끄게 된다. 꺼진 얼굴이면 다음 걸음이 분명하다 — 누르면 난다
 *         (그 누름은 사람의 누름이라 브라우저가 안 막는다).
 *    기억해 둔 뜻은 그대로 둔다 — 막힌 것은 브라우저 사정이지 사람이 끈 것이 아니다.
 */

/** 곡 한 줄 — **앱이 준다**(요청: "scplay는 목록을 파라미터로 받고 실제 음악 파일과 목록은 쓰는 쪽에서 제공한다").
 *  재생기는 음악 파일을 갖지 않는다: 한 곡이 6~13MB라 패키지에 넣으면 라이브러리가 너무 커지고(지적), 무엇을 틀지는
 *  앱마다 다르다(곡이 없는 앱도 있다). 그래서 파일은 앱의 public 에 두고, 목록과 주소만 여기로 넘긴다.
 *  옛 고정 목록(public/audio/bgm 의 mp3 열 곡)과 MIDI 두 곡을 굽던 기록은 docs/notes/player-ui.md '배경 음악 목록은 앱이 준다'. */
export interface ReplayBgmTrack {
  /** 곡 목록·툴팁에 적는 이름. */
  title: string;
  /** 파일 주소 — `<audio src>`에 그대로 건다. 공백 따위는 앱이 인코딩해서 넘긴다. */
  src: string;
}

/* 앱이 꽂아 준 목록 — **비어 있으면 음악이 없는 앱이다**: 음악 단추를 안 세우고, 켜 둔 뜻(KEY)이 남아 있어도 아무것도
   틀지 않는다. 꽂는 결은 chrome.ts 와 같지만(부팅에서 한 번), 판이 선 뒤에 바뀌어도 따라오게 구독을 단다. */
let bgmTracks: readonly ReplayBgmTrack[] = [];
const bgmSubs = new Set<() => void>();

/** 앱이 부팅에서 한 번 부른다 — 곡 목록을 통째로 갈아 끼운다(준 차례가 곧 목록의 차례). 빈 목록이면 음악을 끈 앱이다. */
export function setReplayBgm(tracks: readonly ReplayBgmTrack[]): void {
  bgmTracks = tracks.slice();
  bgmSubs.forEach((f9) => f9());
}

const subscribeBgm = (f9: () => void): (() => void) => {
  bgmSubs.add(f9);
  return () => { bgmSubs.delete(f9); };
};
const bgmSnapshot = (): readonly ReplayBgmTrack[] => bgmTracks;

const KEY = "scr.bgm.on";
/* ★ **음량**(2026-10-10, 요청: "재생기 음악 볼륨 조절 버튼 필요하고 처음에 50프로로 시작") — 위 머리말의 '음량은 안 건드린다'를 되물린다: 이제 앱 음량 손잡이가 있고
   기본은 0.5 다(기기 음량 × 0.5). iOS 사파리는 <audio>.volume 을 읽기 전용으로 둬(늘 1) 손잡이가 먹지 않는다 — 써 보고 되읽어 다르면 volumeOk 거짓(슬라이더를 안 세움).
   WebAudio 로 돌리지 않는다(머리말: 무음 스위치를 뚫는다). */
const VOL_KEY = "scr.bgm.vol";
const VOL_DEFAULT = 0.5;
const readVol = (): number => {
  try { const v = Number(localStorage.getItem(VOL_KEY)); return localStorage.getItem(VOL_KEY) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : VOL_DEFAULT; } catch { return VOL_DEFAULT; }
};

/** 사람의 뜻 — **적어 둔 값이 없으면 꺼짐**이다(지시: "안 건드리면 조용하고 켜야 나는
 *  게 맞아") ────────────────────────────────────────────────────────────────────────
 *  앞선 요청("기본 재생으로 해 줘")을 뒤집는다. 그 시절의 뜻은 '판에 들어서면 분위기가
 *  깔린다'였는데, 실제로는 아무 말 없이 소리를 내는 쪽이라 사람이 놀라 끄는 일이 잦다 —
 *  그리고 브라우저가 막으면 아무 소리도 안 나서 켠 얼굴만 남는다(그 지적이 앞서 있었다).
 *  소리는 **사람이 부르는 것**으로 둔다: 켠 적이 있는 사람만 나고, 그 뜻은 그대로 남는다.
 *  ※ 값이 "0"인 사람(예전에 끈 적 있음)도 여기서는 꺼짐이라 달라질 것이 없다. */
/* ★★ **되물렸다 — 기본은 켜짐이다**(2026-09, 지적: "음악이 기본으로 안켜지는 문제") — 위 '안 건드리면 조용하고'를
   뒤집는다. 이제 적어 둔 값이 **"0"(끈 적이 있다)일 때만** 꺼짐이고, 값이 없거나 "1" 이면 켜짐이다. */
const wantOn = (): boolean => {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
};

/** ★ 첫 곡은 **게임 번호로** 고르고 그 뒤로는 목록 차례대로 돈다(2026-10-22, 요청: "음악 고르기 기능 제거 · 음악은 게임번호로 골라지는 로직 넣어서
 *  골고루 선택되게(처음 곡 골라지면 그 다음 곡이 순차 재생)") — 옛 길은 판마다 섞은 바퀴(shuffled)였다. 게임 번호(숫자)를 곡 수로 나눈 나머지라
 *  번호가 이어지는 경기들은 곡을 한 칸씩 돌아가며 고르게 쓴다. 숫자가 아닌 열쇠는 글자 해시(FNV-1a) · 열쇠가 없으면 제비. */
const startOf = (key: string | undefined, n: number): number => {
  if (n <= 1) return 0;
  if (!key) return Math.floor(Math.random() * n);
  if (/^\d+$/.test(key)) {
    let r = 0;
    for (const ch of key) r = (r * 10 + Number(ch)) % n;
    return r;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % n;
};

export type Bgm = {
  /** 켜 둔 뜻 — 버튼의 켠 표시가 이 값이다(지금 실제로 소리가 나는지와는 다르다:
   *  자동재생이 막힌 동안에도 켜진 얼굴이고, 첫 누름에 소리가 따라온다). */
  on: boolean;
  /** 누름 한 번 = 켜기/끄기. */
  toggle: () => void;
  /** 지금 걸린 곡 이름 — 버튼 툴팁에 적는다(켜져 있을 때만 읽힌다). 한 곡도 안 건
   *  동안만 null이고, 꺼도 그 곡 이름은 남는다. */
  now: string | null;
  /** 곡 수 — 0 이면 앱이 곡을 안 꽂은 것이라(setReplayBgm) 소리 목록에 배경 음악 줄을 안 세운다.
   *  (곡을 골라 트는 목록은 2026-10-22 걷었다 — 첫 곡은 게임 번호가 고른다 · 위 startOf.) */
  count: number;
  /** 끈다(이미 꺼져 있어도 '끈 뜻'을 적는다 — 첫 누름을 기다리던 기본 켜짐도 걷힌다). */
  off: () => void;
  /** 음량 0~1(2026-10-10 · 기본 0.5 · 브라우저에 남는다) · 바꾸기 · 이 기기가 음량을 받나(iOS 사파리는 <audio>.volume 을 무시한다 — 그때는 슬라이더를 안 세운다). */
  volume: number;
  setVolume: (v: number) => void;
  volumeOk: boolean;
};

/**
 * @param seedKey 첫 곡을 고르는 열쇠(게임 번호 — 재생기의 clockKey · 위 startOf).
 * @param playing 재생기가 **지금 돌고 있나**(요청: "재생 멈추면 음악도 멈추기") —
 *   음악은 판의 분위기지 라디오가 아니다. 일시정지는 '이 장면을 들여다보는' 순간이라
 *   거기서 음악만 계속 흐르면, 멈춘 화면과 흐르는 소리가 서로 다른 말을 한다.
 *   끄는 것이 아니라 **재우는** 것이라 켜 둔 뜻(on)도 아이콘도 그대로고, 다시 재생을
 *   누르면 끊긴 자리에서 이어진다. (판을 떠날 때 재우던 것은 걷었다 — 아래 '걷어냄' 자리.)
 */
export function useBgm(playing = true, seedKey?: string): Bgm {
  const [on, setOn] = useState(false);
  const [now, setNow] = useState<string | null>(null);
  const seedRef = useRef(seedKey);
  seedRef.current = seedKey;
  const elRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVol] = useState<number>(readVol);
  const volRef = useRef(volume);
  const [volumeOk, setVolumeOk] = useState(true);
  /** 다음에 걸 곡의 번호 — null 이면 아직 첫 곡 전(startOf 로 고른다). */
  const atRef = useRef<number | null>(null);
  /** 연달아 실패한 곡 수 — 아래 onErr의 바닥. */
  const failRef = useRef(0);
  /** 지금 켜 둔 뜻인가 — 귀(이벤트)들이 리렌더 없이 읽어야 해서 ref로도 든다. */
  const onRef = useRef(false);
  /** 첫 누름을 기다리는 귀를 이미 달아 뒀나(두 번 달면 두 곡이 겹친다). */
  const armedRef = useRef(false);
  /** 재생기가 도는 중인가 — 귀들이 리렌더 없이 읽어야 해서 ref로 든다(위 onRef와 같다). */
  const playingRef = useRef(playing);
  playingRef.current = playing;
  /** 앱이 꽂은 곡 목록(setReplayBgm) — 귀들이 리렌더 없이 읽어야 해서 ref로도 든다. */
  const tracks = useSyncExternalStore(subscribeBgm, bgmSnapshot, bgmSnapshot);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const hasTracks = tracks.length > 0;
  /* 목록이 갈리면 차례를 처음으로 — 옛 목록의 번호로 새 목록을 집으면 엉뚱한 곡이 걸린다. */
  useEffect(() => { atRef.current = null; }, [tracks]);

  /** 오디오 한 대만 쓴다 — 곡이 바뀌어도 같은 대의 src만 갈아 끼운다. 새로 만들면
   *  기기마다 '사람 누름으로 열린 대'라는 허락이 안 따라와 두 곡째부터 막힌다. */
  const audio = useCallback((): HTMLAudioElement => {
    ambientAudio9();   // 무음 스위치를 따르게(sfx9 ambientAudio9 ★) — 소리를 내는 길은 다 여기서 엘리먼트를 받는다
    if (!elRef.current) {
      const a = new Audio();
      // 켜기 전에는 한 바이트도 안 받는다 — 한 곡이 6~13MB다.
      a.preload = "none";
      a.volume = volRef.current;
      elRef.current = a;
    }
    return elRef.current;
  }, []);

  /** 다음 곡을 걸고 튼다 — 첫 곡은 게임 번호가 고르고(startOf) 그 뒤는 목록 차례대로 돈다.
   *
   *  ★ 이 함수는 **누름의 그 자리에서** 불려야 한다(리액트 상태 갱신 함수 안이 아니라).
   *    한때 setOn의 갱신 함수 안에서 불렀는데, 그 함수는 렌더 때 — 곧 누름 처리가 끝난
   *    **뒤에** 돈다. 사파리는 첫 재생을 누름의 호출 스택 안에서만 허락하므로 그 자리에
   *    두면 조용히 막힌다(게다가 StrictMode는 갱신 함수를 두 번 불러 곡이 두 칸 뛴다). */
  const next = useCallback(() => {
    const a = audio();
    const list = tracksRef.current;
    // 곡이 없으면 걸 것이 없다 — 부르는 자리들은 막힌 재생과 같은 길(catch)로 받는다.
    if (list.length === 0) return Promise.reject(new Error("배경 음악 목록이 비었다"));
    const fi9 = (atRef.current ?? startOf(seedRef.current, list.length)) % list.length;
    const t9 = list[fi9];
    atRef.current = fi9 + 1;
    a.src = t9.src;
    setNow(t9.title);
    /* (걷어냄) 첫 곡의 시작 지점을 섞던 것 — 요청: "항상 처음부터 재생". 어느 길로 걸리든 곡은 머리부터다. */
    return a.play();
  }, [audio]);

  /** **걸린 곡이 있으면 이어서, 없으면 첫 곡을 건다** — 소리를 내는 자리들이 나눠 쓰는
   *  한 줄이다(요청: 껐다 켜면 이어서). 곡을 넘기는 것은 곡이 끝났거나 깨졌을 때뿐이고,
   *  '다시 틀기'는 어느 길로 오든 듣던 자리를 지킨다. resume도 같은 규약이다. */
  const playOrNext = useCallback((): Promise<void> => {
    const a = audio();
    return a.src ? a.play() : next();
  }, [audio, next]);

  /* (armFirstGesture 다음에 resume이 온다 — resume이 그것을 부른다.) */
  /** 첫 누름을 기다리는 귀 — 자동재생이 막혔을 때만 단다. 한 번 울리면 스스로 걷힌다. */
  /** 창에 달아 둔 첫 누름 귀들 — 판을 떠날 때 다 걷는다(아래 ★ 이중 재생). */
  const earsRef = useRef(new Set<() => void>());
  const listenOnce = useCallback((go: () => void): void => {
    const h9 = (): void => { earsRef.current.delete(h9); window.removeEventListener("pointerdown", h9, true); window.removeEventListener("keydown", h9, true); go(); };
    earsRef.current.add(h9);
    window.addEventListener("pointerdown", h9, true);
    window.addEventListener("keydown", h9, true);
  }, []);
  const armFirstGesture = useCallback(() => {
    if (armedRef.current) return;
    armedRef.current = true;
    listenOnce(() => {
      armedRef.current = false;
      // 그새 사람이 꺼 두었으면 아무 일도 안 한다.
      if (!onRef.current) return;
      playOrNext().catch(() => { /* 그래도 막히면 다음 누름을 또 기다린다 */ armFirstGesture(); });
    });
  }, [playOrNext, listenOnce]);
  /* ★★ **판을 떠나면 귀도 걷는다**(2026-10-23, 지적: "음악이 이중으로 나오고") — 자료를 기다리는 재생기(pending · 빈 지도)가 먼저 서서 첫 곡을 틀려다 막히면
     창에 '첫 누름에 켜기' 귀를 달았는데, 그 재생기가 진짜 재생기로 갈려 **사라진 뒤에도 귀는 남아** 첫 누름에 죽은 재생기의 오디오를 틀었다. 진짜 재생기의
     귀도 같은 누름에 울려 두 곡이 겹쳤다. 언마운트에 귀를 다 걷는다(armFirstGesture · 아래 처음 켜기 귀 둘 다 listenOnce 를 지난다). */
  useEffect(() => () => { for (const h9 of earsRef.current) { window.removeEventListener("pointerdown", h9, true); window.removeEventListener("keydown", h9, true); } earsRef.current.clear(); }, []);

  /** 소리를 **다시 낸다** — 둘이 다 참일 때만이다: 켜 둔 뜻 · 재생 중.
   *  하나라도 어긋나면 아무 일도 안 한다(부르는 쪽이 조건을 또 따질 일이 없다).
   *  곡이 아직 안 걸렸으면(멈춘 채로 들어와 첫 곡을 아직 안 튼 경우) 첫 곡부터 튼다.
   *  막히면 첫 누름을 기다린다 — 자동재생 규칙의 문은 '처음 한 번'뿐이라 대개는
   *  그냥 난다. */
  const resume = useCallback(() => {
    if (!onRef.current || !playingRef.current || tracksRef.current.length === 0) return;
    const a = audio();
    if (!a.src) { next().catch(() => armFirstGesture()); return; }
    void a.play().catch(() => armFirstGesture());
  }, [audio, next, armFirstGesture]);

  /* ★ 재생이 멈추면 **음악도 멈춘다**(요청) — 위 useBgm의 인자 주석에 까닭이 있다.
     여기서는 재우고 깨우기만 한다: 켜 둔 뜻(onRef)은 안 건드리므로 아이콘이 안 바뀌고,
     pause는 자리를 지키므로 다시 누르면 끊긴 마디에서 이어진다. */
  useEffect(() => {
    if (playing) resume();
    else if (onRef.current) audio().pause();
  }, [playing, resume, audio]);

  /* 한 곡이 끝나면 다음 곡, 한 곡이 깨졌으면 건너뛴다(그 한 곡 때문에 전부 멈추지
     않게).
     ★ 깨진 곡 건너뛰기에는 **바닥**이 있어야 한다 — 파일이 통째로 없으면(배포에서
       빠졌다든지) 열 곡을 순식간에 돌며 error가 꼬리를 물어 무한 고리가 된다. 연달아
       실패한 수를 세어 한 바퀴를 넘기면 조용히 끈다. 한 곡이라도 재생이 시작되면
       (playing) 셈은 0으로 돌아간다. */
  useEffect(() => {
    const a = audio();
    const stop = (): void => { onRef.current = false; setOn(false); setNow(null); };
    const onEnd = (): void => { failRef.current = 0; next().catch(stop); };
    const onPlaying = (): void => { failRef.current = 0; };
    const onErr = (): void => {
      if (!a.src) return;
      failRef.current += 1;
      if (failRef.current > tracksRef.current.length) { stop(); return; }
      next().catch(stop);
    };
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    a.addEventListener("playing", onPlaying);
    return () => {
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onErr);
      a.removeEventListener("playing", onPlaying);
      a.pause();
      // 판을 떠날 때 받던 것을 끊는다 — src를 비우면 진행 중인 내려받기가 멎는다.
      a.removeAttribute("src");
      a.load();
    };
  }, [audio, next]);

  /* (걷어냄) 판을 떠나면 재우던 것(blur·focus·visibilitychange) ─────────────────────────────────────────
     요청: "blur 시 음악 멈춤, 재생 멈춤 안 되게". 옛 까닭은 '소리의 출처를 못 찾는다'였는데, 다른 창에서 일하며
     틀어 두는 쪽을 택한다. 브라우저가 미디어 세션 손잡이(알림창의 멈춤)를 주므로 끄는 길은 사람에게 남아 있다.
     재생(시각)이 멈추면 음악도 재우는 규약은 그대로다(위 playing) — 그건 판 안의 일이다. */

  const toggle = useCallback(() => {
    // 곡이 없는 앱이면 켤 것이 없다 — 단추는 안 서지만 m 키는 여기로 온다.
    if (tracksRef.current.length === 0) return;
    const nv = !onRef.current;
    onRef.current = nv;
    setOn(nv);
    try { localStorage.setItem(KEY, nv ? "1" : "0"); } catch { /* 사파리 사생활 모드 */ }
    const a = audio();
    if (nv) {
      /* ★ 켜면 **처음부터**(요청: "항상 처음부터 재생") — 옛 규약은 끈 자리에서 이어 틀었다("껐다 켜면 이어서").
         이제 걸린 곡이 있으면 그 곡의 머리로 되감아 튼다. 재생 일시정지·판 떠남의 재우기(resume)는 그대로 이어진다 —
         그건 사람이 음악을 만진 것이 아니다. */
      if (a.src) {
        try { a.currentTime = 0; } catch { /* 아직 못 감으면 그대로 */ }
        a.play().catch(() => armFirstGesture());
        return;
      }
      /* 누름의 그 자리에서 튼다(위 next 주석) — 여기서 막힐 일은 사실상 없다.
         멈춰 있어도 튼다: 사람이 음악 버튼을 방금 눌렀는데 아무 소리도 안 나면 버튼이
         고장 난 것으로 읽힌다. 이 한 번은 그 뜻을 그대로 따르고, 다음 일시정지부터
         평소대로 함께 잠든다.
         ★ **걸린 곡이 있으면 이어서 튼다**(요청: "음악 끄기할 때 일시정지로 껐다가 다시
           켜면 이어서 나와야 해") ─────────────────────────────────────────────────
           끄기는 이미 pause라 자리는 지켜져 있었는데, 켤 때 `next()`로 **다음 곡을 새로
           걸어** 그 자리를 버렸다. 곧 잠깐 껐다 켜면 듣던 곡이 통째로 갈렸다.
           이제 걸린 곡이 있으면 그냥 다시 튼다 — 끊긴 마디에서 이어진다. 곡을 넘기는
           것은 곡이 끝났을 때(ended)와 깨졌을 때(error)뿐이다.
           재생 멈춤·판 떠남(resume)이 쓰던 규약과 같은 것을 켜기에도 쓰는 셈이다. */
      playOrNext().catch(() => armFirstGesture());
    } else {
      /* 끄기는 **재우기**다 — pause는 자리를 지키므로 다시 켜면 그 마디에서 이어진다.
         걸린 곡 이름(now)도 안 지운다: 지우면 다시 켤 때 되살릴 길이 없고, 꺼져 있는
         동안은 버튼이 그 값을 안 읽는다(툴팁이 "음악 켜기"다). */
      a.pause();
    }
  }, [audio, playOrNext, armFirstGesture]);

  /* 처음 서면 **켜 둔 뜻대로 튼다** — 켠 적이 있는 사람만 난다(위 wantOn, 기본은 꺼짐).
     ★ 막히면 아이콘을 **꺼진 얼굴로 둔다**(지적: "처음 들어가면 음악 켜짐으로 버튼이
       나오는데 실제론 안 나오잖아 — 그땐 off로 해 놔야 켜서 듣지") ────────────────────
       여기 있던 것은 '켜진 얼굴 + 첫 누름을 기다리는 귀'였다. 그 설계의 약속은 "켜진
       얼굴이면 지금 나거나 곧 난다"였는데, 사람이 보는 것은 **지금**이다: 소리는 없는데
       버튼은 켜졌다고 하니, 켜려고 누르면 오히려 꺼진다. 게다가 그 귀는 아무 누름에나
       울리므로 화면 아무 데나 눌러도 음악이 나기 시작한다 — 누른 사람은 제가 튼 줄도
       모른다.
       실제로 난 것만 켜진 얼굴로 둔다. 막혔으면 꺼진 얼굴이고, 그러면 다음 걸음이
       분명해진다 — 버튼을 누르는 것이다. 그 누름은 사람의 누름이라 브라우저가 안 막는다.
       ★ 기억해 둔 뜻(localStorage)은 **안 건드린다** — 막힌 것은 브라우저 사정이지
         사람이 끈 것이 아니다. 다음 판에서 앱 안을 거쳐 들어오면(누름이 이미 있다)
         그대로 켜진 채로 난다. */
  useEffect(() => {
    // 곡이 없으면 틀 것이 없다 — 앱이 판이 선 뒤에 목록을 꽂으면(hasTracks) 그때 한 번 돈다.
    if (!hasTracks || !wantOn()) return;
    onRef.current = true;
    // 멈춘 채로 들어왔으면 아직 안 튼다 — 재생이 시작될 때 resume이 첫 곡을 건다.
    // 그때는 켜진 얼굴이 참이다: 소리가 없는 까닭이 화면에 이미 있다(멈춘 재생).
    if (!playingRef.current) { setOn(true); return; }
    next().then(() => setOn(true)).catch(() => {
      onRef.current = false;
      setOn(false);
      // 막힌 채로 받아 오지는 않는다 — 한 곡이 6~13MB다. 켤 때 이어서 받는다.
      audio().pause();
      /* ★ 기본이 켜짐이 된 뒤로는 막힌 채 영영 조용하면 '기본으로 안 켜진다'가 그대로 남는다(외부 링크로 바로 들어온 길 —
         브라우저가 누름 전 소리를 막는다). 그래서 **첫 누름에 켠다** — 얼굴은 실제로 소리가 난 뒤에야 켜진다(위 ★ 그대로:
         켜진 얼굴인데 조용한 일은 없다). 그새 사람이 음악 목록에서 끄기를 골랐으면(KEY "0") 안 켠다. */
      listenOnce(() => {
        if (onRef.current || !wantOn()) return;
        onRef.current = true;
        if (!playingRef.current) { setOn(true); return; }
        playOrNext().then(() => { if (onRef.current) setOn(true); else audio().pause(); }).catch(() => { onRef.current = false; setOn(false); });
      });
    });
  }, [next, audio, playOrNext, hasTracks, listenOnce]);

  const off = useCallback(() => {
    onRef.current = false;
    setOn(false);
    try { localStorage.setItem(KEY, "0"); } catch { /* 사파리 사생활 모드 */ }
    audio().pause();
  }, [audio]);

  /* 이 기기가 음량을 받나 — 0.5 를 써 보고 되읽는다. 판에 한 번.
     ★ iOS 는 기기로 가른다(2026-10-22, 지적: "아이폰에 슬라이더 나오는데") — 요즘 iOS 사파리는 써 넣은 0.5 를 그대로 되읽어 주면서 소리에는 안 먹인다(되읽기로는 못 가른다).
     iPhone·iPad·iPod, 그리고 터치 되는 'Macintosh'(데스크톱 사이트로 연 iPad)는 음량을 못 받는 것으로 친다(ReplayMapVector 의 iOS 가름과 같은 자). */
  useEffect(() => {
    const ios9 = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1);
    if (ios9) { setVolumeOk(false); return; }
    const t9 = new Audio();
    t9.volume = 0.5;
    if (Math.abs(t9.volume - 0.5) > 0.01) setVolumeOk(false);
  }, []);
  const setVolume = useCallback((v: number) => {
    const v9 = Math.min(1, Math.max(0, v));
    volRef.current = v9;
    setVol(v9);
    if (elRef.current) elRef.current.volume = v9;
    try { localStorage.setItem(VOL_KEY, String(v9)); } catch { /* 저장 못 하면 이 판에서만 */ }
  }, []);
  return { on, toggle, now, count: tracks.length, off, volume, setVolume, volumeOk };
}
