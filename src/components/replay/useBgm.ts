import { useCallback, useEffect, useRef, useState } from "react";

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
 *
 *  ⚠ 안드로이드의 한계 — 웹에는 '지금 진동·무음 모드인가'를 묻는 길이 없다(그런 API가
 *    없다). 안드로이드에서 미디어 소리는 벨소리와 **다른 줄기**라, 벨을 진동으로 두어도
 *    미디어는 미디어 음량을 따른다. 곧 여기서 지킬 수 있는 것은 '미디어 음량 0이면 안
 *    들린다'까지다. iOS는 무음 스위치가 미디어까지 덮으므로 요청 그대로 동작한다.
 *
 *  ★ 기본이 **꺼짐**이다(지시: "안 건드리면 조용하고 켜야 나는 게 맞아") — 켠 적이 있는
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

/** public/audio/bgm의 mp3 열 곡(요청: "다시 기존 mp3 열 개로").
 *
 *  ★ (걷어냄) **MIDI 두 곡** — 한동안 이 자리에 `Terran 1.mp3`·`Terran 2.mp3`가 있었다.
 *    이름은 mp3지만 원본은 MIDI였고, 브라우저의 <audio>가 MIDI를 못 열어서(실측 크로뮴:
 *    `canPlayType("audio/midi")`가 빈 문자열, .mid를 걸면 error code 4) 미리 구워 둔
 *    것이었다. 되돌리면서 그 구운 mp3 둘은 지운다 — 원본 `Terran1.mid`·`Terran2.mid`는
 *    같은 자리에 남겨 둔다(작고, 다시 구우려면 그것이 있어야 한다).
 *    다시 구울 일이 있으면 그때 쓴 명령이 이것이다(소리샘은 윈도우 기본 GM):
 *      fluidsynth -ni -q -g 0.5 -r 48000 -F raw.wav C:/Windows/System32/drivers/gm.dls in.mid
 *      ffmpeg -i raw.wav -af volume=<봉우리를 −1.5dBFS로 맞추는 값>dB -b:a 192k out.mp3
 *    ★ 브라우저 안에서 MIDI를 **바로** 트는 길은 앞으로도 없다고 봐야 한다: 신디사이저가
 *      소리를 합성해야 하고 그건 Web Audio가 필요한데, AudioContext를 열면 사파리가
 *      무음 스위치를 무시하는 세션으로 넘어간다(이 파일 머리의 그 규칙). 미리 굽는 길만
 *      그 성질을 지킨다.
 *
 *  이 목록은 **손으로 적는다** — public/은 번들러의 눈 밖이라 import.meta.glob이
 *  안 닿는다. 파일을 더하거나 빼면 여기도 함께 고쳐야 한다. */
const BGM_FILES = [
  "01. Starcraft Main Title.mp3",
  "03. Terran One.mp3",
  "05. Terran Two.mp3",
  "07. Terran Three.mp3",
  "09. Protoss One.mp3",
  "11. Protoss Two.mp3",
  "13. Protoss Three.mp3",
  "15. Zerg One.mp3",
  "17. Zerg Two.mp3",
  "19. Zerg Three.mp3",
];

/** 파일 이름에 공백·마침표가 들어 있어 그대로는 URL이 안 된다 — 조각마다 인코딩한다. */
const srcOf = (f: string): string => `${import.meta.env.BASE_URL}audio/bgm/${encodeURIComponent(f)}`;

/** 곡 제목 — 앞의 트랙 번호와 확장자를 뗀다("03. Terran One.mp3" → "Terran One"). */
export const titleOf = (f: string): string => f.replace(/^\d+\.\s*/, "").replace(/\.mp3$/i, "");

const KEY = "scr.bgm.on";

/** 사람의 뜻 — **적어 둔 값이 없으면 꺼짐**이다(지시: "안 건드리면 조용하고 켜야 나는
 *  게 맞아") ────────────────────────────────────────────────────────────────────────
 *  앞선 요청("기본 재생으로 해 줘")을 뒤집는다. 그 시절의 뜻은 '판에 들어서면 분위기가
 *  깔린다'였는데, 실제로는 아무 말 없이 소리를 내는 쪽이라 사람이 놀라 끄는 일이 잦다 —
 *  그리고 브라우저가 막으면 아무 소리도 안 나서 켠 얼굴만 남는다(그 지적이 앞서 있었다).
 *  소리는 **사람이 부르는 것**으로 둔다: 켠 적이 있는 사람만 나고, 그 뜻은 그대로 남는다.
 *  ※ 값이 "0"인 사람(예전에 끈 적 있음)도 여기서는 꺼짐이라 달라질 것이 없다. */
const wantOn = (): boolean => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

/** 차례를 **섞어 돌린다** — 매번 제비를 뽑으면 같은 곡이 연달아 나오는 일이 흔하다
 *  (열 곡이면 한 번 넘어갈 때마다 10%). 한 바퀴를 섞어 두고 끝나면 다시 섞되, 새 바퀴의
 *  첫 곡이 방금 들은 곡이면 한 칸 밀어 그 이음매까지 막는다. */
const shuffled = (n: number, avoidFirst?: number): number[] => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (n > 1 && avoidFirst !== undefined && a[0] === avoidFirst) {
    [a[0], a[1]] = [a[1], a[0]];
  }
  return a;
};

export type Bgm = {
  /** 켜 둔 뜻 — 버튼의 켠 표시가 이 값이다(지금 실제로 소리가 나는지와는 다르다:
   *  자동재생이 막힌 동안에도 켜진 얼굴이고, 첫 누름에 소리가 따라온다). */
  on: boolean;
  /** 누름 한 번 = 켜기/끄기. */
  toggle: () => void;
  /** 지금 걸린 곡 이름 — 버튼 툴팁에 적는다(켜져 있을 때만 읽힌다). 한 곡도 안 건
   *  동안만 null이고, 꺼도 그 곡 이름은 남는다 — 끄기가 곡을 버리는 것이 아니라
   *  **재우는** 것이라(아래 toggle) 다시 켜면 그 곡이 이어진다. */
  now: string | null;
};

/**
 * @param playing 재생기가 **지금 돌고 있나**(요청: "재생 멈추면 음악도 멈추기") —
 *   음악은 판의 분위기지 라디오가 아니다. 일시정지는 '이 장면을 들여다보는' 순간이라
 *   거기서 음악만 계속 흐르면, 멈춘 화면과 흐르는 소리가 서로 다른 말을 한다.
 *   끄는 것이 아니라 **재우는** 것이라 켜 둔 뜻(on)도 아이콘도 그대로고, 다시 재생을
 *   누르면 끊긴 자리에서 이어진다 — 판을 떠났다 돌아올 때(blur/focus)와 같은 결이다.
 */
export function useBgm(playing = true): Bgm {
  const [on, setOn] = useState(false);
  const [now, setNow] = useState<string | null>(null);
  const elRef = useRef<HTMLAudioElement | null>(null);
  /** 이번 바퀴의 차례와 지금 몇 번째인가. */
  const orderRef = useRef<number[]>([]);
  const atRef = useRef(0);
  /** 연달아 실패한 곡 수 — 아래 onErr의 바닥. */
  const failRef = useRef(0);
  /** 지금 켜 둔 뜻인가 — 귀(이벤트)들이 리렌더 없이 읽어야 해서 ref로도 든다. */
  const onRef = useRef(false);
  /** 첫 누름을 기다리는 귀를 이미 달아 뒀나(두 번 달면 두 곡이 겹친다). */
  const armedRef = useRef(false);
  /** 재생기가 도는 중인가 — 귀들이 리렌더 없이 읽어야 해서 ref로 든다(위 onRef와 같다). */
  const playingRef = useRef(playing);
  playingRef.current = playing;

  /** 오디오 한 대만 쓴다 — 곡이 바뀌어도 같은 대의 src만 갈아 끼운다. 새로 만들면
   *  기기마다 '사람 누름으로 열린 대'라는 허락이 안 따라와 두 곡째부터 막힌다. */
  const audio = useCallback((): HTMLAudioElement => {
    if (!elRef.current) {
      const a = new Audio();
      // 켜기 전에는 한 바이트도 안 받는다 — 한 곡이 6~13MB다.
      a.preload = "none";
      elRef.current = a;
    }
    return elRef.current;
  }, []);

  /** 다음 곡을 걸고 튼다 — 바퀴가 끝나면 다시 섞는다.
   *
   *  ★ 이 함수는 **누름의 그 자리에서** 불려야 한다(리액트 상태 갱신 함수 안이 아니라).
   *    한때 setOn의 갱신 함수 안에서 불렀는데, 그 함수는 렌더 때 — 곧 누름 처리가 끝난
   *    **뒤에** 돈다. 사파리는 첫 재생을 누름의 호출 스택 안에서만 허락하므로 그 자리에
   *    두면 조용히 막힌다(게다가 StrictMode는 갱신 함수를 두 번 불러 곡이 두 칸 뛴다). */
  const next = useCallback((first: boolean) => {
    const a = audio();
    if (orderRef.current.length === 0 || atRef.current >= orderRef.current.length) {
      const last = orderRef.current[orderRef.current.length - 1];
      orderRef.current = shuffled(BGM_FILES.length, first ? undefined : last);
      atRef.current = 0;
    }
    const f = BGM_FILES[orderRef.current[atRef.current]];
    atRef.current += 1;
    a.src = srcOf(f);
    setNow(titleOf(f));
    /* ★ **시작 지점도 섞는다**(요청: "음악 시작 시간도 랜덤") — 곡을 섞어도 늘 그 곡의
       머리부터면 판을 열 때마다 같은 도입부 열 가지 중 하나를 듣는다. 아무 데서나
       시작하면 열 곡이 훨씬 넓게 들린다.
       ★ **첫 곡에만** 건다 — 이어지는 곡까지 매번 중간부터 끊어 틀면 그건 '음악'이
         아니라 라디오 주파수를 돌리는 소리가 된다. 판을 켤 때 한 번만 어디쯤에서
         집어 든다.
       뒤쪽 3할은 뺀다 — 끝자락에서 집으면 몇 초 듣고 다음 곡으로 넘어간다.
       길이는 메타데이터가 와야 알 수 있으므로 그때 한 번 듣고 스스로 걷히는 귀를 단다.
       (건너뛰기는 서버가 바이트 범위를 받아 줘야 한다 — 정적 호스팅은 다 받아 주고,
        오히려 처음부터 받지 않아 **덜 내려받는다**.) */
    if (first) {
      const seek9 = (): void => {
        a.removeEventListener("loadedmetadata", seek9);
        const d9 = a.duration;
        if (!Number.isFinite(d9) || d9 < 30) return;   // 짧은 곡은 그냥 처음부터.
        try { a.currentTime = Math.random() * d9 * 0.7; } catch { /* 못 감으면 처음부터 */ }
      };
      a.addEventListener("loadedmetadata", seek9);
    }
    return a.play();
  }, [audio]);

  /** **걸린 곡이 있으면 이어서, 없으면 첫 곡을 건다** — 소리를 내는 자리들이 나눠 쓰는
   *  한 줄이다(요청: 껐다 켜면 이어서). 곡을 넘기는 것은 곡이 끝났거나 깨졌을 때뿐이고,
   *  '다시 틀기'는 어느 길로 오든 듣던 자리를 지킨다. resume도 같은 규약이다. */
  const playOrNext = useCallback((): Promise<void> => {
    const a = audio();
    return a.src ? a.play() : next(true);
  }, [audio, next]);

  /* (armFirstGesture 다음에 resume이 온다 — resume이 그것을 부른다.) */
  /** 첫 누름을 기다리는 귀 — 자동재생이 막혔을 때만 단다. 한 번 울리면 스스로 걷힌다. */
  const armFirstGesture = useCallback(() => {
    if (armedRef.current) return;
    armedRef.current = true;
    const go = (): void => {
      window.removeEventListener("pointerdown", go, true);
      window.removeEventListener("keydown", go, true);
      armedRef.current = false;
      // 그새 사람이 꺼 두었으면 아무 일도 안 한다.
      if (!onRef.current) return;
      playOrNext().catch(() => { /* 그래도 막히면 다음 누름을 또 기다린다 */ armFirstGesture(); });
    };
    window.addEventListener("pointerdown", go, true);
    window.addEventListener("keydown", go, true);
  }, [playOrNext]);

  /** 소리를 **다시 낸다** — 셋이 다 참일 때만이다: 켜 둔 뜻 · 재생 중 · 판이 보임.
   *  하나라도 어긋나면 아무 일도 안 한다(부르는 쪽이 조건을 또 따질 일이 없다).
   *  곡이 아직 안 걸렸으면(멈춘 채로 들어와 첫 곡을 아직 안 튼 경우) 첫 곡부터 튼다.
   *  막히면 첫 누름을 기다린다 — 자동재생 규칙의 문은 '처음 한 번'뿐이라 대개는
   *  그냥 난다. */
  const resume = useCallback(() => {
    if (!onRef.current || !playingRef.current || document.hidden) return;
    const a = audio();
    if (!a.src) { next(true).catch(() => armFirstGesture()); return; }
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
    const onEnd = (): void => { failRef.current = 0; next(false).catch(stop); };
    const onPlaying = (): void => { failRef.current = 0; };
    const onErr = (): void => {
      if (!a.src) return;
      failRef.current += 1;
      if (failRef.current > BGM_FILES.length) { stop(); return; }
      next(false).catch(stop);
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

  /* ★ 판을 떠나면 **멈춘다**(요청: "음악은 블러 시 멈추기") ──────────────────────────
     다른 앱·다른 창으로 넘어갔는데 음악만 남아 흐르면, 사람은 소리의 출처를 못 찾는다
     (탭을 여럿 열어 두면 더 그렇다). 돌아오면 이어서 튼다 — 끈 것이 아니라 **멈춘 것**
     이라, 켜 둔 뜻(onRef)은 그대로 두고 소리만 재운다. 아이콘도 켜진 얼굴 그대로다.
     두 귀를 함께 단다: 창 포커스(blur/focus)는 PC에서, 보임(visibilitychange)은 폰에서
     각각 확실히 온다 — 한쪽만 달면 기기에 따라 안 멈추거나 안 돌아온다.
     ⚠ 돌아왔을 때의 play()는 사람의 누름 밖이지만, 이미 한 번 소리를 낸 대라 브라우저가
       막지 않는다(자동재생 규칙은 '처음 한 번'의 문이다). 그래도 막히면 조용히 둔다 —
       다음 누름에 armFirstGesture가 살린다. */
  useEffect(() => {
    const a = audio();
    const sleep9 = (): void => { if (onRef.current) a.pause(); };
    // 돌아왔을 때의 판정은 resume이 통째로 진다 — '재생 중인가'까지 함께 본다.
    const wake9 = (): void => { resume(); };
    const vis9 = (): void => { if (document.hidden) sleep9(); else wake9(); };
    window.addEventListener("blur", sleep9);
    window.addEventListener("focus", wake9);
    document.addEventListener("visibilitychange", vis9);
    return () => {
      window.removeEventListener("blur", sleep9);
      window.removeEventListener("focus", wake9);
      document.removeEventListener("visibilitychange", vis9);
    };
  }, [audio, resume]);

  const toggle = useCallback(() => {
    const nv = !onRef.current;
    onRef.current = nv;
    setOn(nv);
    try { localStorage.setItem(KEY, nv ? "1" : "0"); } catch { /* 사파리 사생활 모드 */ }
    const a = audio();
    if (nv) {
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
    if (!wantOn()) return;
    onRef.current = true;
    // 멈춘 채로 들어왔으면 아직 안 튼다 — 재생이 시작될 때 resume이 첫 곡을 건다.
    // 그때는 켜진 얼굴이 참이다: 소리가 없는 까닭이 화면에 이미 있다(멈춘 재생).
    if (!playingRef.current) { setOn(true); return; }
    next(true).then(() => setOn(true)).catch(() => {
      onRef.current = false;
      setOn(false);
      // 막힌 채로 받아 오지는 않는다 — 한 곡이 6~13MB다. 켤 때 이어서 받는다.
      audio().pause();
    });
  }, [next, audio]);

  return { on, toggle, now };
}
