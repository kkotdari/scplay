import { useEffect, useState } from "react";
import type { ReplayMapGrid } from "./mapGrid";

/* ★ 격자를 **어디서** 받아 오는지는 앱이 정한다(요청: 재생기를 screplayer로 옮기고
   stargayte가 가져다 쓰기)
   ────────────────────────────────────────────────────────────────────────────────
   여기 있던 `import { api }`는 재생 모듈이 **앱의 API 주소를 아는** 유일한 구멍이었다.
   한 줄이지만 값이 크다: 그 줄 때문에 모듈을 옮길 때 api/client.ts와 그것이 끌고 오는
   types·문지기까지 따라갔고, 옮긴 쪽에서는 쓰지도 않을 회원·리그 함수 수백 줄이 실렸다.
   이제 앱이 부팅 때 길을 하나 꽂아 준다(setReplayMapFetcher). 안 꽂으면 격자를 안 받고
   조용히 비운다 — 지도가 없는 것과 같아, 부르는 쪽이 그 자리를 이미 다룬다. */
export type ReplayMapFetcher = (hashes: string[]) => Promise<ReplayMapGrid[]>;
let fetchMaps: ReplayMapFetcher = async () => [];
export function setReplayMapFetcher(fn: ReplayMapFetcher): void { fetchMaps = fn; }

// 미니맵 격자를 해시로 받아 오는 곳 — 경기 응답에는 해시만 있고 격자는 여기서 따로 받는다.
//
// 캐시를 모듈에 두는 이유는 두 가지다.
//   ① 같은 맵을 쓰는 경기가 한 화면에 수십 건씩 있다(클럽이 빠른무한 몇 종류를 계속 돈다).
//      경기마다 22KB짜리를 받으면 같은 값을 되풀이해 받는 셈이다.
//   ② 격자는 내용 해시로 찾는 값이라 절대 바뀌지 않는다 — 한 번 받으면 세션 내내 그대로
//      쓸 수 있고, 무효화를 걱정할 필요가 없다.
//
// 값이 undefined면 아직 안 물어본 것, null이면 서버에 없는 것이다. 없는 것도 캐시에
// 못 박아 둔다 — 안 그러면 그 카드가 뜰 때마다 같은 해시를 계속 다시 묻는다(옛 경기는
// 미니맵이 아예 없으므로 흔한 경우다).
const cache = new Map<string, ReplayMapGrid | null>();
// 아직 안 보낸 해시 / 지금 요청 중인 해시. 두 번째가 없으면 요청이 날아가 있는 동안 뜬
// 카드가 같은 해시를 또 큐에 넣는다.
const waiting = new Set<string>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

// 한 번에 물을 수 있는 개수 — 서버도 같은 상한을 둔다(game_results 라우터 참고).
const BATCH_MAX = 32;

function schedule(): void {
  if (timer !== null) return;
  // 0ms 타이머 하나로 같은 프레임에 뜬 카드들의 해시를 한 요청으로 묶는다.
  timer = setTimeout(() => { timer = null; void flush(); }, 0);
}

async function flush(): Promise<void> {
  const hashes = [...waiting].slice(0, BATCH_MAX);
  if (hashes.length === 0) return;
  for (const h of hashes) { waiting.delete(h); inflight.add(h); }
  try {
    const maps = await fetchMaps(hashes);
    const got = new Map(maps.map((m) => [m.hash, m]));
    for (const h of hashes) cache.set(h, got.get(h) ?? null);
  } catch {
    // 실패는 캐시에 남기지 않는다 — 다음에 그 카드가 다시 뜨면 한 번 더 시도한다.
  } finally {
    for (const h of hashes) inflight.delete(h);
  }
  if (waiting.size > 0) schedule();
  for (const l of listeners) l();
}

/** 목록을 부를 때 필요한 격자를 미리 다 받아 둔다 — 댓글과 같은 이유다(ActivityComments의
 *  primeActivityComments 주석): 카드가 뜬 뒤에 격자가 도착하면 미니맵이 그때 생겨나며 카드
 *  키가 자라고, 그만큼 활동의 스크롤 자리가 밀린다. 이미 받아 둔 해시는 건너뛴다. */
export async function primeReplayMaps(hashes: (string | null | undefined)[]): Promise<void> {
  const need = [...new Set(hashes.filter((h): h is string => !!h && !cache.has(h)))];
  for (let i = 0; i < need.length; i += BATCH_MAX) {
    const chunk = need.slice(i, i + BATCH_MAX);
    try {
      const maps = await fetchMaps(chunk);
      const got = new Map(maps.map((m) => [m.hash, m]));
      for (const h of chunk) cache.set(h, got.get(h) ?? null);
    } catch {
      // 실패는 캐시에 안 남긴다 — 그 카드가 뜰 때 위 훅이 한 번 더 시도한다.
    }
  }
  for (const l of listeners) l();
}

/** 맵연결 직후(요청: 게임 상세의 맵연결 버튼) — 서버가 돌려준 새 격자(그림 포함)를
 *  캐시에 바로 심어, 그 해시를 쓰는 모든 카드가 즉시 새 그림으로 갈아탄다. */
export function applyReplayMap(grid: ReplayMapGrid): void {
  cache.set(grid.hash, grid);
  for (const l of listeners) l();
}

/* (걷음) 원본 그림 승급(?full=1) — 작은 판으로 받아 두었다가 크게 그릴 때 원본을 다시
   묻던 갈래다. 그림 자체가 사라졌다(요청: 참값 맵과 지형만 쓴다) — 지도는 이제 참값
   지형에서 **그 배율로 그때그때 다시 그린다**(ReplayMapCanvas). 굳은 스냅샷을 갈아
   끼울 일이 없다. */

/* ── 지형 대조 ──────────────────────────────────────────────────────────────────
   "격자는 내용 해시로 찾는 값이라 절대 안 바뀐다"던 위 캐시의 전제는 참값 지형이
   생기며 반쯤 깨졌다: 지형은 맵이 아니라 **서버 사정**으로 나중에 얹힌다(새 경기
   등록·재분석이 같은 해시의 행에 지형을 굽는다). 오래 산 탭(특히 폰 사파리 — 며칠씩
   산다)은 지형 없던 시절의 행을 세션 내내 들고, 재생 화면이 벡터 대신 래스터 그림을
   확대해 흐렸다(지적: "모바일만 그렇네"). 재생 화면이 뜰 때 지형 없는 행만 세션에
   한 번 서버와 대조한다 — 지형이 이미 있는 행은 건드리지 않는다(그건 정말 안 바뀐다). */
const revalidated = new Set<string>();

/** 재생 화면이 뜰 때 그 행을 **세션에 한 번** 서버와 대조한다.
 *
 *  ★ 조건이 "지형이 없을 때"에서 **"세션에 한 번은 무조건"** 으로 바뀌었다(지적: "타일
 *    이미지 굽는 걸 게임 mpq 파일로 정확히 뽑는 걸로 바꿨는데 왜 그전하고 똑같지?").
 *    그 물음의 답이 여기 있었다: 지형은 서버가 **다시 구울 수 있는** 값인데(굽는 규칙이
 *    좋아지면 재분석이 force로 다시 굽는다) 이쪽은 '없을 때만' 물었다. 그래서 한 번
 *    지형을 받은 탭은 서버가 아무리 새로 구워도 **영영 옛 지형**을 들고 있었다 —
 *    오래 사는 폰 사파리는 며칠씩 그랬다.
 *    이제 없든 있든 한 번은 묻는다. 삯은 맵 종류당 요청 하나뿐이고(세션에 한 번),
 *    바뀐 것이 없으면 같은 값이 와 캐시가 그대로다. */
export async function revalidateReplayMap(hash: string | null | undefined): Promise<void> {
  if (!hash || revalidated.has(hash)) return;
  const cur = cache.get(hash);
  if (!cur) return;
  revalidated.add(hash);
  try {
    const maps = await fetchMaps([hash]);
    const got = maps.find((m) => m.hash === hash);
    if (!got) return;
    /* ★ **지형을 잃는 쪽으로는 절대 안 바꾼다**(지적: "애초에 지형이 왜 안 와… 네가
       전체화면 전환 시 팬 적용 불가 수정하고 나서 그래") ────────────────────────────
       내가 만든 회귀다. 대조를 '없을 때만'에서 '세션에 한 번은 무조건'으로 넓히면서,
       **지형이 안 실린 응답으로 덮어쓰는 길**을 함께 열었다: 그 응답의 terrain이 비면
       아래 비교가 "달라졌다"로 읽고 그 행을 그대로 심는다. 그러면 잘 그려지던 지도가
       그 순간부터 통째로 검어진다(지도는 지형이 풀릴 때까지 아무것도 안 그린다).
       옛 판이 `if (!got?.terrain) return`으로 막고 있던 것이 정확히 이 사고였고,
       넓히면서 그 빗장을 같이 뽑았다.
       규칙을 못 박는다: **있던 지형이 없어지는 교체는 없다.** 서버가 지형을 지우는
       일은 없으니(굽거나 다시 굽거나뿐이다) 비어 온 응답은 사실이 아니라 사정이다
       (아직 안 구움·다른 판이 굽는 중·부분 응답). 그럴 때는 손에 든 것을 지킨다. */
    if (cur.terrain && !got.terrain) return;
    /* 값이 그대로면 캐시를 안 건드린다 — 새 객체를 심으면 이것을 보는 화면이 통째로
       다시 그려진다. 이제 그릴 것을 정하는 값은 지형 하나다. */
    if (got.terrain === cur.terrain) return;
    cache.set(hash, got);
    for (const l of listeners) l();
  } catch {
    revalidated.delete(hash);          // 실패는 못 박지 않는다 — 다음 재생 화면이 다시 묻는다.
  }
}

/** 이미 받아 둔 격자 — **훅 밖에서** 한 값만 읽어야 할 때 쓴다(목록의 알약이 대표맵
 *  이름을 쓴다). 아직 안 받았으면 null이다: 부르는 쪽은 목록 렌더 함수라 여기서 조회를
 *  걸 수 없다(그 자리에서 훅을 부를 수 없고, 목록은 이미 primeReplayMaps로 다 받아 둔다). */
export function cachedReplayMap(hash: string | null | undefined): ReplayMapGrid | null {
  return (hash ? cache.get(hash) : null) ?? null;
}

/** 격자 캐시가 바뀌면 다시 그린다 — 위 cachedReplayMap을 읽는 화면이 붙는다.
 *  값을 안 돌려주는 까닭: 읽는 자리는 저마다 다른 해시를 묻고, 그 읽기는 위 함수가 한다.
 *  여기 몫은 '바뀌었다'를 알리는 것 하나다(뒷장이 실려 격자가 뒤늦게 도착하는 자리). */
export function useReplayMapTick(): void {
  const [, bump] = useState(0);
  useEffect(() => {
    const listen = (): void => bump((n) => n + 1);
    listeners.add(listen);
    return () => { listeners.delete(listen); };
  }, []);
}

/** 그 해시의 맵 격자 — 서버에 없으면 null, '아직 조회 중'이면 undefined.
 *  (구분 이유·지적: 조회 중을 null로 뭉개면 카드가 첫 그림에 옛 로스터 폼을 그렸다가
 *  격자가 도착하면 재생 화면으로 갈아타며 로스터가 깜빡하고 사라져 보였다.) */
export function useReplayMap(hash: string | null | undefined): ReplayMapGrid | null | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    const listen = () => bump((n) => n + 1);
    listeners.add(listen);
    return () => { listeners.delete(listen); };
  }, []);
  useEffect(() => {
    if (!hash || cache.has(hash) || inflight.has(hash)) return;
    waiting.add(hash);
    schedule();
  }, [hash]);
  if (!hash) return null;
  return cache.has(hash) ? cache.get(hash) ?? null : undefined;
}
