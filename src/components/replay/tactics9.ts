/* ★ **판의 전술 낱말**(2026-10-20, 요청: "유닛건물스킬에 전술도 넣을 수 있나? 몰래 배럭 오버로드 사냥 일꾼 견제 입구 막기 포토러시 등 재생기 키워드 검색에 뜨듯" ·
   "누가 그 판을 열어도 채우지 않기 · 운영자 재분석에 포함시키고 참값 제거 시 제거 안 되게") — 재생기 밖(앱의 운영자 재분석)에서 부르는 순수 함수.
   재생기와 **같은 편성표**(castPlan9 · 사건 중계)를 돌려 그 자막(장면 1등 자막 · 사람마다 빌드·전술 이정표 = plan.search · 토막 자막)의 글만 훑는다.
   낱말은 아래 TACTIC_RULES9 가 정한 꼴 하나로 모은다(자막 글귀가 바뀌어도 검색 낱말은 그대로 서게 — "입구를 포토로 막음"·"배럭·서플라이로 입구 막음" → "입구 막기").
   앱은 낱말을 서버에 따로 담는다(참값 자취와 다른 표 — 참값을 지워도 남는다). */
import { castMoves9, castPlan9, type CapPart9, type CastTerrain9 } from "./cast9";
import { UNIT_BUILD_SEC } from "./unitStats";
import type { ReplayMapGrid } from "./mapGrid";
import { decodeTruthTracks } from "../../utils/openbwTracks";
import { truthWorld } from "../../utils/truthLives";
import { decodeMapTerrain, levelAt, TILE } from "../../utils/mapTerrain";

/** [자막 글에서 찾는 꼴, 낱말] — 낱말이 함수면 맞은 조각으로 짓는다(몰래·전진·센터·N드론·X 드랍). 차례는 자동 완성 차례다. */
const TACTIC_RULES9: [RegExp, string | ((m: RegExpExecArray) => string)][] = [
  [/몰래 ([가-힣]+?)(?:으로|로)?(?=[ .·]|$)/g, (m) => `몰래 ${m[1]}`],   // "몰래 배럭 랜딩" · 침투 유닛 "몰래 질럿으로 … 일꾼 견제"
  [/전진 (게이트|배럭|팩토리|스타포트|스타게이트)/g, (m) => `전진 ${m[1]}`],   // "전진 건설 일꾼 잡음"은 건물 이름이 아니다
  [/포토러시/g, "포토러시"],
  [/성큰러시/g, "성큰러시"],
  [/(\d+)드론 스포닝풀/g, (m) => `${m[1]}드론`],
  [/입구를? (?:[^ ]+로 )?막음/g, "입구 막기"],
  [/\(완막\)/g, "입구 완막"],
  [/입구 럴커/g, "입구 럴커"],
  [/오버로드 사냥/g, "오버로드 사냥"],
  [/일꾼 견제/g, "일꾼 견제"],
  [/폭탄드랍/g, "폭탄드랍"],
  [/기지에 ([가-힣]+) 드랍/g, (m) => `${m[1]} 드랍`],   // "기지에 리버 드랍" · "기지에 드랍 시도"는 안 든다
  [/센터 (포토|벙커|터렛|성큰|스포어)/g, (m) => `센터 ${m[1]}`],
  [/언덕탱/g, "언덕탱"],
  [/옆탱/g, "옆탱"],
  [/탱크 조이기/g, "탱크 조이기"],
  [/메카닉 조이기/g, "메카닉 조이기"],
  [/핵 투하/g, "핵 투하"],
  [/기지로 이사/g, "이사"],
  [/선스포닝풀/g, "선스포닝풀"],
  [/선\d?해처리/g, "선해처리"],
  [/선포지/g, "선포지"],
  [/더블넥서스/g, "더블넥서스"],
  [/선가스/g, "선가스"],
  [/선커맨드/g, "선커맨드"],
  [/빠른 앞마당/g, "빠른 앞마당"],
  [/[23](?:게이트|배럭|팩)/g, (m) => m[0]],
];

/** 자동 완성에 늘 서는 전술 낱말(앱의 검색 꼴 · 판마다 실제로 나온 것은 tacticWordsOf9 가 돌려준다). */
export const TACTIC_TERMS9: readonly string[] = [
  "몰래 배럭", "몰래 게이트", "몰래 팩토리", "전진 배럭", "전진 게이트", "포토러시", "성큰러시", "9드론", "입구 막기", "입구 완막", "입구 럴커",
  "오버로드 사냥", "일꾼 견제", "폭탄드랍", "리버 드랍", "하이템플러 드랍", "센터 포토", "센터 벙커", "언덕탱", "옆탱", "탱크 조이기", "메카닉 조이기",
  "핵 투하", "이사", "선스포닝풀", "선해처리", "선포지", "더블넥서스", "선가스", "선커맨드", "빠른 앞마당", "2게이트", "3게이트", "2배럭", "3배럭", "2팩", "3팩",
];

/** 자막 글 한 줄 — 사람 칩은 빈칸으로(이름이 낱말에 섞이지 않게). */
const capText9 = (caps: readonly CapPart9[]): string => caps.map((c9) => (c9.raw !== undefined ? " " : c9.text)).join("");

/** 글 여럿에서 낱말을 뽑는다(차례 = TACTIC_RULES9 · 겹침 없음). */
export function tacticWordsOfText9(texts: readonly string[]): string[] {
  const out9: string[] = [];
  for (const [rx9, word9] of TACTIC_RULES9) {
    for (const t9 of texts) {
      rx9.lastIndex = 0;
      for (let m9 = rx9.exec(t9); m9; m9 = rx9.exec(t9)) {
        const w9 = typeof word9 === "string" ? word9 : word9(m9);
        if (w9 && !out9.includes(w9)) out9.push(w9);
      }
    }
  }
  return out9;
}

export type TacticOpts9 = {
  /** 그 판의 맵 — 자원 점(앞마당 가름) · 크기(센터) · 참값 지형(언덕탱·입구). 없으면 그 판정만 빠진다. */
  grid?: Pick<ReplayMapGrid, "width" | "height" | "resources" | "terrain"> | null;
  /** 경기 길이(초). */
  endSec: number;
  /** 경기 채팅 — 재생기가 받는 꼴 그대로. */
  chats?: readonly { sec: number; name: string; text: string }[];
  /** 로스터(참값 이름) — 안 주면 참값의 사람 전부. */
  only?: readonly string[];
  /** 관전자 등 뺄 이름. */
  skip?: readonly string[];
  /** 이름 → 팀(팀전) — 밀리면 안 준다. */
  teamOf?: Readonly<Record<string, number | undefined>>;
};

/** 참값 자취(OBWT · base64 — 재생기가 받는 motion 그대로) → 그 판의 전술 낱말. 자취를 못 풀면 null(낱말 없음과 가른다). */
export async function tacticWordsOf9(motion: string, opts: TacticOpts9): Promise<string[] | null> {
  const truth9 = await decodeTruthTracks(motion);
  if (!truth9 || truth9.tracks.length === 0) return null;
  const world9 = truthWorld(truth9, (k9) => UNIT_BUILD_SEC[k9] ?? 0);
  const g9 = opts.grid ?? null;
  const mt9 = g9?.terrain ? await decodeMapTerrain(g9.terrain) : null;
  const terrain9: CastTerrain9 | undefined = mt9 ? {
    level: (x9, y9) => levelAt(mt9, x9, y9),
    walk: (x9, y9) => x9 >= 0 && y9 >= 0 && x9 < mt9.w && y9 < mt9.h && (mt9.tile[y9 * mt9.w + x9] & TILE.walkable) !== 0,
    ...(mt9.ver >= 2 ? { ramp: (x9: number, y9: number) => x9 >= 0 && y9 >= 0 && x9 < mt9.w && y9 < mt9.h && (mt9.tile[y9 * mt9.w + x9] & TILE.ramp) !== 0 } : {}),
  } : undefined;
  const plan9 = castPlan9(world9, {
    total: opts.endSec > 0 ? opts.endSec : 60,
    ...(opts.skip ? { skip: new Set(opts.skip) } : {}),
    ...(opts.only && opts.only.length > 0 ? { only: new Set(opts.only), order: opts.only } : {}),
    ...(opts.teamOf ? { teamOf: opts.teamOf } : {}),
    ...(g9 ? { resources: g9.resources, mapW: g9.width, mapH: g9.height } : {}),
    terrain: terrain9, event: true,
    ...(opts.chats ? { chats: opts.chats } : {}),
    bank: truth9.res,
    moves: castMoves9(truth9.tracks, world9),
  });
  const texts9: string[] = [];
  for (const x9 of plan9.search ?? []) texts9.push(capText9(x9.caps));
  for (const s9 of plan9) if (s9.caps) texts9.push(capText9(s9.caps));
  return tacticWordsOfText9(texts9);
}
