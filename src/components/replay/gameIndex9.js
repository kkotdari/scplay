/* ★ **게임 색인**(2026-10-20, 요청: "모든 색인은 주인, 타겟, 대상, 행위, 추가속성 · 유저별로" → "전부 재생기 함수(api 제공)" · "같은 사람의 같은 사건도 합치지 말고 시간별로 저장") —
   재생기 밖(앱의 운영자 재분석)에서 부르는 순수 함수. 참값 자취 + 맵으로 재생기와 **같은 편성표**(castPlan9 · 사건 중계)와 **같은 검색 빌더**(searchIndex9 buildSearchIndex9)를 돌려
   그 rows(사건 한 건 = 한 줄)를 돌려준다. 재생기에서 찾히는 것과 게임 목록에서 찾히는 것이 한 함수에서 나온다.
   앱은 줄을 서버에 따로 담는다(참값 자취와 다른 표 — 참값을 지워도 남는다) · 판을 열 때는 굽지 않는다(운영자 재분석만). */
import { castFocus9, castMoves9, castPlan9 } from "./cast9";
import { buildSearchIndex9 } from "./searchIndex9";
import { UNIT_BUILD_SEC } from "./unitStats";
import { decodeTruthTracks } from "../../utils/openbwTracks";
import { truthWorld } from "../../utils/truthLives";
import { decodeMapTerrain, levelAt, TILE } from "../../utils/mapTerrain";
/** 참값 자취(OBWT · base64 — 재생기가 받는 motion 그대로) → 그 판의 색인 줄. 자취를 못 풀면 null(줄 없음과 가른다). */
export async function gameIndexOf9(motion, opts) {
    const truth9 = await decodeTruthTracks(motion);
    if (!truth9 || truth9.tracks.length === 0)
        return null;
    const world9 = truthWorld(truth9, (k9) => UNIT_BUILD_SEC[k9] ?? 0);
    const g9 = opts.grid ?? null;
    const mt9 = g9?.terrain ? await decodeMapTerrain(g9.terrain) : null;
    const terrain9 = mt9 ? {
        level: (x9, y9) => levelAt(mt9, x9, y9),
        walk: (x9, y9) => x9 >= 0 && y9 >= 0 && x9 < mt9.w && y9 < mt9.h && (mt9.tile[y9 * mt9.w + x9] & TILE.walkable) !== 0,
        ...(mt9.ver >= 2 ? { ramp: (x9, y9) => x9 >= 0 && y9 >= 0 && x9 < mt9.w && y9 < mt9.h && (mt9.tile[y9 * mt9.w + x9] & TILE.ramp) !== 0 } : {}),
    } : undefined;
    const moves9 = castMoves9(truth9.tracks, world9);
    /* 재생기 planAll9 와 같은 자(로스터 · 차례 · 팀 · 자원 · 지형 · 채팅 · 돈 · 리콜/나이더스 · 자취 · 사건 중계). */
    const plan9 = castPlan9(world9, {
        total: opts.endSec > 0 ? opts.endSec : 60,
        ...(opts.skip ? { skip: new Set(opts.skip) } : {}),
        only: new Set(opts.only), order: opts.only,
        ...(opts.teamOf ? { teamOf: opts.teamOf } : {}),
        ...(g9 ? { resources: g9.resources, mapW: g9.width, mapH: g9.height } : {}),
        terrain: terrain9, event: true,
        ...(opts.chats ? { chats: opts.chats } : {}),
        bank: truth9.res,
        moves: moves9,
        tracks: truth9.tracks, // 정찰은 몸이 상대 기지에 들어선 때(재생기와 같은 자 · 2026-10-22)
    });
    const skip9 = new Set(opts.skip ?? []);
    const bases9 = opts.only.filter((k9) => !skip9.has(k9)).map((k9) => ({ key: k9, name: k9 }));
    return buildSearchIndex9({ world: world9, plan: plan9, focus: castFocus9(world9, moves9), bases: bases9 }).rows;
}
