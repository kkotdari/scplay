import { ComponentType } from 'react';
import { JSX as JSX_2 } from 'react';
import { ReactNode } from 'react';

declare interface BuildPos {
    unit: string;
    frame: number | null;
    x: number;
    y: number;
}

/** 이미 받아 둔 격자 — **훅 밖에서** 한 값만 읽어야 할 때 쓴다(목록의 알약이 대표맵
 *  이름을 쓴다). 아직 안 받았으면 null이다: 부르는 쪽은 목록 렌더 함수라 여기서 조회를
 *  걸 수 없다(그 자리에서 훅을 부를 수 없고, 목록은 이미 primeReplayMaps로 다 받아 둔다). */
export declare function cachedReplayMap(hash: string | null | undefined): ReplayMapGrid | null;

/** 서버가 준 base64 지형을 푼다 — 없거나 꼴이 다르면 null(그러면 옛 어림으로 돌아간다). */
export declare function decodeMapTerrain(b64: string | null | undefined): Promise<MapTerrain | null>;

/** 격자를 캔버스에 그린다 — **썸네일과 내려받는 그림이 이 한 곳을 함께 쓴다**.
 *
 *  베껴 두면 반드시 갈린다(지적: "색깔이 왜 타일하고 달라" — 색 램프는 베끼고 장식
 *  제거는 안 베껴 두 그림이 달라졌다). 배율(pxPerTile)만 다르고 그림은 같아야 한다.
 *
 *  mt(참값 지형)가 있으면 지형으로 칠하고, 없으면 옛 그룹 램프로 돌아간다(아직 지형을
 *  안 구운 맵). 벽은 지형이 있을 때만 **미니타일(8px) 단위**로 한 겹 더 어둡게 긋는다 —
 *  타일로 그리면 한 칸 굵기의 절벽이 통째로 검게 칠해져 지형이 뭉개진다. */
export declare function drawMapGrid(ctx: CanvasRenderingContext2D, grid: {
    width: number;
    height: number;
    palette: number[];
    tiles: string;
    resources?: [number, number, 0 | 1][] | null;
    /** 격자 내용의 해시 — 지형 기하 캐시(terrainGeom)의 열쇠. 없으면 크기·타일셋만으로 가른다(같은 세션 안의 한 지도면 족하다). */
    hash?: string;
}, mt: MapTerrainLike | null, pxPerTile: number, 
/** 자원 점을 찍나 — 재생 화면의 지도 벡터층만 끈다(요청: "지도벡터 상에 자원 표시는
 *  제거"). 거기에는 **진짜 밭과 간헐천 모델**이 그 자리에 서므로, 밑그림의 점은 같은
 *  것을 두 번 말하면서 모델 밑으로 청록 얼룩만 남긴다. 미니맵·내려받는 PNG·썸네일은
 *  모델이 없으니 이 점이 곧 자원 표시라 그대로 둔다. */
drawResources?: boolean, 
/** 3D 벽띠(절벽면)의 높이 배수(요청: "3D 모드에서 벽/언덕 높이 지금의 4배로 증가") —
 *  입체(각도) 보기에서만 크게 준다. 이 그림은 미니맵·내려받는 PNG·썸네일도 함께 쓰는데,
 *  거기서는 위에서 곧바로 내려다보는 그림이라 벽이 높으면 고원이 통째로 남쪽으로 밀린
 *  것처럼 보인다 — 높이가 화면 세로에 실리는 사영이라 그렇다(모델의 z와 같은 사정).
 *  그래서 배수는 부르는 쪽이 정한다. */
wallScale?: number): void;

declare type GameType = "0101" | "0102" | "0103";

declare type Group = ModelCatalogGroup;

declare interface MapTerrain {
    /** 타일 단위 크기. */
    w: number;
    h: number;
    /** 타일셋 번호(0~7). */
    tileset: number;
    /** 구운 판(1·2) — 2부터 타일 바이트에 램프 비트가 있다. */
    ver: number;
    /** 타일마다 한 바이트(위 TILE 깃발). 길이 w*h, 행 우선. */
    tile: Uint8Array;
    /** 미니타일(8px) 통행 비트 — (w*4)*(h*4) 비트. 벽의 실제 모양이다. */
    walkBits: Uint8Array;
    /** 타일마다 실제 색 RGB 세 바이트(판 3부터). 옛 판은 null. */
    rgb: Uint8Array | null;
}

/** 그리는 쪽이 지형에게 물어보는 것들 — mapTerrain.terrainFace 가 만든다(mapTiles.MapTerrainLike 와 같은 꼴 · 순환 피하려 여기 둔다). */
declare interface MapTerrainLike {
    w: number;
    h: number;
    tileset: number;
    levelAt: (x: number, y: number) => number;
    walkAt: (x: number, y: number) => boolean;
    partialAt: (x: number, y: number) => boolean;
    rampAt?: (x: number, y: number) => boolean;
    rgbAt?: (x: number, y: number) => [number, number, number] | null;
    walkAtMini: (mx: number, my: number) => boolean;
}

declare interface MinimapMarker {
    /** 리플레이 원본 게임 아이디 — 목록 키로도 쓴다. */
    key: string;
    /** 화면에 보일 이름. */
    name: string;
    avatar: string | null;
    memberId: string;
    /** ""는 screp이 종족을 못 읽은 드문 경우 — RaceBadge가 그대로 받아 빈칸으로 그린다. */
    race: Race | "";
    /** 그 사람의 **개인색**(#rrggbb) — 앱이 리플레이를 파싱해 넘긴다(screp의 Color.RGB).
     *
     *  왜 이 값이 따로 필요한가: 재생기의 개인색은 원래 참값 뭉치(OBWT)에서만 왔는데,
     *  그쪽은 색을 리마스터 리플레이의 **CCLR 구획**에서 읽는다. 2010년 이전(1.16 이하)
     *  리플레이에는 그 구획이 아예 없어 '색 아님'으로 오고(openbwTracks의 0xffffffff 주석),
     *  그러면 여덟 명이 팀 두 색으로 뭉개졌다. screp은 그 길로 안 간다 — 사람 구조에 남은
     *  색 번호(Color.ID 0~7)를 표준 팔레트로 푼다. SC:R 인게임이 색을 내는 길과 같다.
     *  그래서 참값에 색이 없을 때 이 값이 답이 된다.
     *
     *  안 주면(undefined) 종전대로 참값 → 팀색 순이다 — 이 칸은 보태는 자리지 뺏는
     *  자리가 아니다. */
    color?: string;
    /** 이 사람이 **관전자**인가 — 참이면 재생기가 통째로 안 그린다(요청: "관전자 자동 숨김
     *  기능 / 플레이어 로드시 기본적으로 관전자쪽 화면은 안 보이게 / 관전자는 로스터에서도
     *  제거").
     *
     *  왜 앱이 알려 주어야 하나: 참값 뭉치에도 사람마다 controller 바이트가 실려 오지만
     *  (openbwTracks의 로스터 꼴) 그 값의 뜻은 덤퍼 쪽에 있고 재생기는 여태 한 번도 안
     *  읽었다. '유닛이 하나도 없으면 관전자'로 어림할 수도 있지만, 그러면 자취가 늦게
     *  오는 동안 판단을 못 하고 시작하자마자 나간 사람까지 관전자로 몰린다.
     *  앱은 이미 리플레이를 파싱해 슬롯을 알고 있으니, 아는 쪽이 말하는 편이 옳다.
     *
     *  안 주면(undefined) 아무도 안 숨긴다 — 종전 동작 그대로다. */
    observer?: boolean;
    team: 1 | 2 | undefined;
    /** 타일 좌표. */
    x: number;
    y: number;
    /** 이름까지 함께 보일까 — 본진 표시는 이름을 단다(요청). */
    withName: boolean;
    /** 검색 중 짚어야 할 사람인가 — 로스터를 감춘 모바일에서는 여기가 유일한 표시 자리다. */
    highlight: boolean;
    /** 그 사람의 APM(리플레이 파싱 값, 경기 전체 평균) — 로스터 아래 지표 줄이 쓴다.
     *  수동 등록 경기는 null이라 그 칸을 아예 안 그린다. */
    apm?: number | null;
    /** 그 시점에 궤멸됐거나 빈사 상태인가 — 본진에 해골을 얹는다(요청). */
    downed?: boolean;
    /** 크게 다쳤지만 아직 끝난 건 아닌 상태(요청: 큰 타격·빈사는 해골 말고 반창고만) —
     *  해골과 같은 자리에 ❤️‍🩹만 얹고 아바타는 흑백으로 안 누른다. */
    hurt?: boolean;
    /** 지금 문장에 이름이 나온 사람인가 — 아바타를 크게 키운다(요청). */
    featured?: boolean;
    /** 버리고 떠난 옛 본진인가 — 흑백으로만 남긴다(요청: 본진을 버리고 이동한 경우 본진은
     *  흑백 처리하고 새 기지에 마크를 옮긴다). */
    ghost?: boolean;
    /** 본진에 붙일 이모지 — 화살표가 없는 이야기(생산·테크·경제)에 쓴다(요청: 생산에도 본진에
     *  열심히 생산하는 이모지). 자리는 markAt이 정한다 — 아바타 위가 아니다(요청). */
    mark?: string;
    /** 그 이모지를 얹을 자리(타일) — 본진이 아닌 곳에서 벌어진 일에 쓴다. 입구막기·입구
     *  방어가 그렇다: 그건 본진 안이 아니라 나가는 길목의 이야기라, 이모지도 진짜 입구
     *  자리에 서야 한다(지적: "입구도 본진 입구를 말한 거야 아바타 위가 아니라").
     *  본진에서 한 일이면 그 사람 본진 건물이 실제로 선 자리(요약의 hubs)가 들어온다.
     *  값이 없으면(옛 요약) 본진 자리(x, y) 그대로. */
    markAt?: [number, number];
    /** 그 이모지가 '무엇으로 한 일'인가 — 유닛·건물 이름을 이모지 밑에 적는다(요청: 방패
     *  이모지에도 캡션). 화살표가 있는 이야기는 기둥 위 이름표가 이 일을 하는데, 화살표
     *  없이 본진·입구에 이모지만 서는 이야기에는 그 자리가 없었다.
     *  목록으로 받아 한 줄에 하나씩 쌓는다(지적: 여러 건물이 한 줄에 붙어 보기 나쁘다) —
     *  화살표 기둥 이름표(arrow.label)가 이미 그렇게 하고 있어 규칙도 하나가 된다. */
    markText?: string[];
    /** 아바타 위에 겹쳐 그리는 상태 얼굴 — 트로피·공격자·당한 정도·아군 헬프처럼 그 사람
     *  자체를 가리키는 표시에 쓴다(요청: 해골·트로피 말고도 아바타로 상태를 알려 달라). */
    face?: string;
    /** face가 승리 트로피인가 — 다른 상태 얼굴과 달리 더 크고 계속 바운스한다(요청). */
    faceIsTrophy?: boolean;
    /** 그 판의 BEST PLAYER인가 — 승패 스냅에서만 세운다(요청: 결론 장면 아바타에 표시).
     *  이긴 편 전원이 트로피를 받는 자리라, 그중 한 사람을 가리키는 표시가 따로 필요하다. */
    best?: boolean;
    /** 시작 스냅인가 — 로스터 없이 "게임 시작!"만 보여주는 자리라, 닉네임 글자도 아바타만큼
     *  키운다(요청: 시작시 로스터 대신 아바타·닉네임 확대). */
    introBig?: boolean;
    /** 이 사람이 그 무렵 한 말 — 아바타 위에 말주머니로 띄운다(요청: 스냅으로 선정한 부근의
     *  채팅만 말주머니로). 양쪽이 다 본 말(전체챗)만 온다(요청: 팀챗 없애고 전체챗만). */
    bubble?: string;
    /** 그 시각까지 갖춘 규모(병력 + 건물 몫; 요약의 hp). 닉네임 밑 기세 눈금이 쓴다 —
     *  길이는 규모, 색은 같은 시각의 적정치에 견준 상태다(요청). 없으면 바를 안 그린다. */
    power?: number;
    /** 그 스냅의 시각(초) — 적정치가 시간에 비례해 오르므로 색을 정하려면 필요하다. */
    powerAtSec?: number;
}

/** 앱이 고르기 알약을 그릴 때 쓰는 표 — 갈래(차례·이름표)와 종족. 한 곳에 두어 앱마다 베끼지 않는다. */
export declare const MODEL_CATALOG_GROUPS: readonly {
    key: ModelCatalogGroup;
    label: string;
}[];

export declare const MODEL_CATALOG_RACES: readonly ModelCatalogRace[];

/** 갈래 고르기 — 유닛·건물이 본 페이지이고, 그 밖은 **따로 한 페이지**다(요청).
 *  한 화면 안의 칸이지만 목록이 통째로 갈리고 종족 고르기도 새로 서므로, 사람에게는
 *  다른 페이지다. 주소에도 제 값이 실린다(?doc=aux).
 *  ★ 고르기 알약(갈래·종족)은 **앱이 그린다**(2026-10, 요청: "도록의 종족 유형까지는 앱에서 만드는거야 파라미터만
 *    scplay에 던지는") — 앱마다 제 디자인 토큰(라이팅 테마 라디오 알약)이 있어 패키지가 그리면 앱과 꼴이 갈린다.
 *    여기는 `group`·`race` 값만 받아 목록을 거른다(race 를 안 주면 "전체"). 표는 위 MODEL_CATALOG_GROUPS·
 *    MODEL_CATALOG_RACES. 종족 상태도 앱 것이라 갈래를 갈아탈 때 되돌릴지 말지는 앱이 정한다(sg-web 은 안 되돌린다). */
export declare function ModelCatalog({ group, race, onClose }: {
    group: Group;
    race?: RacePick;
    onClose?: () => void;
}): JSX_2.Element;

export declare type ModelCatalogGroup = ShapeGalleryItem["group"];

/** 종족 고르기 값 — "전체"는 거르지 않음. 고르기 알약은 앱이 그린다(ModelCatalog 머리의 ★). */
export declare type ModelCatalogRace = "전체" | "테란" | "프로토스" | "저그";

/** 본진 로스터 한 사람 — 위치(x·y)는 이제 요약이 사라져 실려 오지 않을 수 있다.
 *  좌표가 없으면 지형 앵커·채굴 임자 어림 같은 위치 계산에서 조용히 빠진다. */
export declare type MotionBase = Omit<MinimapMarker, "x" | "y"> & {
    x?: number;
    y?: number;
};

/** 밖으로 내는 꼴 — 사람의 신호를 나감 셋으로 줄인 것(위 ★ ②). */
export declare type ParsedReplay = Omit<ParsedReplay_2, "players" | "team1" | "team2"> & {
    players: ParsedReplayPlayerOut[];
    team1: ParsedReplayPlayerOut[];
    team2: ParsedReplayPlayerOut[];
};

declare interface ParsedReplay_2 {
    fileName: string;
    date: string;
    mapName: string;
    gameTypeId: number | null;
    gameTypeName: string;
    gameStartedAt: string | null;
    durationSeconds: number | null;
    players: ParsedReplayPlayer[];
    team1: ParsedReplayPlayer[];
    team2: ParsedReplayPlayer[];
    matchType: GameType;
    winnerSide: "team1" | "team2" | null;
    guessedObservers: string[];
    teamSplitUncertain: boolean;
    ffa: boolean;
    mapGrid: ReplayMapGrid | null;
    /** 경기 채팅 — name 은 말한 사람의 게임 이름(2026-10-10 · 재생기 중계 자막 gg 선언·노엘 외침). */
    chats: {
        frame: number;
        text: string;
        name?: string;
    }[];
    /** 이 리플레이를 저장한 사람의 게임 이름(2026-10-26) — 서버가 팀챗/전체를 가른다(상대 편 저장본이 그 말을 봤나). 채팅이 없으면 null. */
    chatSaver: string | null;
    startSpots: [number, number][];
}

declare interface ParsedReplayPlayer {
    rawName: string;
    race: Race | "";
    team: number;
    color: string | null;
    apm: number | null;
    eapm: number | null;
    cmdCount: number | null;
    effectiveCmdCount: number | null;
    buildCount: number | null;
    isComputer: boolean;
    startX: number | null;
    startY: number | null;
    signals: ReplayPlayerSignals | null;
}

declare type ParsedReplayPlayerOut = Omit<ParsedReplayPlayer, "signals"> & {
    signals: ReplayLeaveSignals | null;
};

/** ★ 빈 지도(128×128 · 팔레트 0 하나) — 자료를 기다리는 재생기(ReplayModule pending · 2026-10-23)가 받는 자리 채움. 그림은 까만 판에 가려 안 보인다.
 *  타일 16384 바이트(0) = base64 "AAAA" × 5461 + "AA==". */
export declare const PENDING_GRID9: ReplayMapGrid;

/** 경기별 현재 재생 시각(요청: 특정 시간으로 카톡 공유) — 재생기가 제 clockKey로 지금
 *  t를 계속 적어 두면, 공유 버튼이 링크에 &t=로 실어 보낸다. */
export declare const playbackClockOf: Map<string, number>;

export declare type Race = "테란" | "프로토스" | "저그" | "랜덤";

declare type RacePick = ModelCatalogRace;

declare type ReplayAvatarComponent = ComponentType<{
    member?: ReplayChromeMember | null;
    size?: number;
    className?: string;
    icon?: ReactNode;
}>;

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
export declare interface ReplayBgmTrack {
    /** 곡 목록·툴팁에 적는 이름. */
    title: string;
    /** 파일 주소 — `<audio src>`에 그대로 건다. 공백 따위는 앱이 인코딩해서 넘긴다. */
    src: string;
}

export declare interface ReplayChrome {
    Avatar?: ReplayAvatarComponent;
    RaceBadge?: ReplayRaceBadgeComponent;
    toast?: (text: string, opts?: {
        kind?: string;
        ms?: number;
    }) => void;
}

export declare interface ReplayChromeMember {
    id: string;
    nickname: string;
    avatar: string | null;
}

/** 밖으로 내는 신호 — 나감 셋만(위 ★ ②). */
declare interface ReplayLeaveSignals {
    leaveFrame: number | null;
    leaveReason: string | null;
    lastCmdFrame: number | null;
}

export declare type ReplayMapFetcher = (hashes: string[]) => Promise<ReplayMapGrid[]>;

export declare interface ReplayMapGrid {
    /** 격자 내용의 해시 — 서버에서 같은 맵을 두 번 저장하지 않게 하는 열쇠다(요청: 같은
     *  맵이면 미니맵 하나를 함께 쓰자). 이름이 아니라 내용이 기준이다. */
    hash: string;
    /** 그 리플레이에 적혀 있던 맵 이름(사람이 DB를 볼 때의 단서). */
    name: string;
    width: number;
    height: number;
    /** 이 맵에 나오는 타일 그룹 번호들 — tiles의 각 바이트가 이 배열의 첨자다. */
    palette: number[];
    /** width*height개의 팔레트 첨자를 바이트로 늘어놓고 base64로 옮긴 것. */
    tiles: string;
    /** 자원 자리(앞마당·멀티) — 미네랄 밭과 가스를 가까운 것끼리 묶어 '한 자원 지대'로 만든
     *  것이다(요청: 자원 위치 파악). 낱개 미네랄 400개를 다 그리면 노이즈라, 묶어서 지대
     *  중심만 남긴다. [타일x, 타일y, 가스있음(0/1)]. 못 읽었으면 빈 배열. */
    resources: [number, number, 0 | 1][];
    /** 이 맵이 묶인 **대표맵**("빠른무한"·"투혼" 같은 상위 이름). 화면이 리플레이 원본
     *  이름(제어문자 섞임) 대신 이 이름을 쓴다. 안 묶였으면 null. */
    canonId?: number | null;
    canonName?: string | null;
    /** 맵 데이터에서 자동으로 뽑은 **참값 지형**(요청) — 서버가 리플레이 안의 지도를
     *  OpenBW로 올려 구운 타일 깃발이다(zlib "OBWM"을 base64로). 있으면 재생 화면이
     *  그림 색 어림(walk) 대신 이쪽을 쓴다 — 램프·벽·언덕이 한 칸도 안 틀린다.
     *  꼴과 푸는 법은 src/utils/mapTerrain.ts 머리말에 있다. */
    terrain?: string | null;
    /** 그 지형의 타일셋(0~7) — 절벽·물의 색을 고르는 데 쓴다. */
    tileset?: number | null;
}

export declare function ReplayModule({ grid, endSec, bases, teamOfRaw, loadUnitTracks, winnerTeam, melee, soleView, active, sceneLink, clockKey, onFinish, onDetailClose, shareNode, onShare, shareLabel, onGuide, guide, side, menu, avatars, askMode, pending, veil, onReady, }: ReplayModuleProps): JSX_2.Element;

export declare interface ReplayModuleProps {
    /** 지도 격자 — 이것이 없으면 그릴 것이 없다(부르는 쪽이 먼저 가린다). */
    grid: ReplayMapGrid;
    /** 판 길이(초). 모르면 null — 자취의 마지막 프레임이 대신한다. */
    endSec: number | null;
    /** 로스터 — 이름·종족·편. 재생기가 색과 기둥을 이걸로 짓는다. */
    bases: MotionBase[];
    /** 그 게임 아이디가 어느 편인가 — 팀색이 이 답을 쓴다. */
    teamOfRaw: (raw: string) => 1 | 2 | undefined;
    /** 참값 자취를 가져오는 길 — 앱이 제 API로 채운다(모듈은 주소를 모른다). */
    loadUnitTracks?: () => Promise<{
        motion: string | null;
        chats?: {
            sec: number;
            name: string;
            text: string;
            scope?: "team" | "all";
        }[];
    }>;
    /** 이긴 편(트로피). 모르면 undefined. */
    winnerTeam?: 1 | 2;
    /** 편이 없는 판(밀리) — 로스터 한 테이블·팀색 손잡이 없음. */
    melee?: boolean;
    /** 이 재생기가 화면에 홀로 있나 — 키보드 조작과 갈라진 판 경고가 이 자격을 본다. */
    soleView?: boolean;
    /** 지금 실제로 보이는가 — 안 보이는 카드의 재생을 멈춘다. */
    active?: boolean;
    /** 링크로 받은 장면 한 벌(시각·배속·자리·카메라 임자) — `sceneLinkOf9` 가 푼 그대로 넘긴다. */
    sceneLink?: SceneLink9 | null;
    /** 재생 시각을 밖에서 읽는 열쇠(공유 링크가 쓴다). */
    clockKey?: string;
    /** 끝까지 봤다 — 앱이 이때 승패 배지를 드러낸다(배지는 앱의 제목 줄이 그린다). */
    onFinish?: () => void;
    /** 확대 창을 닫는 길 — 있으면 재생기가 닫기 단추를 낸다. */
    onDetailClose?: () => void;
    /** 진행바 아래 슬롯 — 공유처럼 **앱의 것**을 여기 꽂는다. */
    shareNode?: ReactNode;
    /** ★ 장면 공유(지적: "스크랩 버튼, 공유 버튼은 쓰는 쪽에서 쓸지 말지 선택하는 거고 함수도 알아서 연결해야 해" ·
     *  스크랩은 2026-10-22 걷었다). 주면 버튼이 서고(단축키 X),
     *  안 주면 안 선다. 공유하는 일(카카오·공유 시트·링크 복사)만 앱이 붙인다.
     *  글을 돌려주면 그 글이, 참이면 "링크 복사됨"이 잠깐 뜬다. */
    onShare?: () => string | boolean | void | Promise<string | boolean | void>;
    /** 공유 버튼의 글씨 — 기본 "장면 공유". */
    shareLabel?: string;
    /** 사용법 버튼(공통) — 앱이 제 라우팅으로 열고 싶으면 onGuide, 버튼을 안 내려면 guide=false. */
    onGuide?: () => void;
    guide?: boolean;
    /** 확대 모드 오른쪽 슬롯 — 댓글 따위(지시: 모듈은 안 만든다, 받기만 한다). */
    side?: ReactNode;
    /** 오른쪽 위 케밥 — 앱의 메뉴. */
    menu?: ReactNode;
    /** 로스터에 프사를 그릴까 — 기본은 그린다. 프사 그림 자체는 앱이 꽂는다
     *  (setReplayChrome) — 안 꽂혔으면 켜 두어도 안 그린다. */
    avatars?: boolean;
    /** 들어올 때 보기 모드(요약 · 풀)를 묻는다 — 게임 상세(ReplayMotionPlayer askMode). */
    askMode?: boolean;
    /** 자료(게임·지도)를 기다리는 동안 먼저 세우는 재생기 — 빈 지도(PENDING_GRID9)와 함께(ReplayMotionPlayer pending). */
    pending?: boolean;
    /** 로딩이 처음 다 끝날 때까지 재생기 전체를 가린다 · 끝나면 onReady(ReplayMotionPlayer veil ★). */
    veil?: boolean;
    onReady?: () => void;
}

declare interface ReplayPlayerSignals {
    unitCounts: Record<string, number>;
    lands: {
        frame: number;
        x: number;
        y: number;
    }[];
    lifts?: number[];
    flyPositions?: {
        frame: number;
        x: number;
        y: number;
    }[];
    unloadPositions?: {
        frame: number;
        x: number;
        y: number;
    }[];
    loadPositions?: {
        frame: number;
        x: number;
        y: number;
    }[];
    cancelBuilds: number[];
    buildingMorphs: {
        frame: number;
        to: string;
    }[];
    rallies: {
        frame: number;
        x: number;
        y: number;
        tag: number;
    }[];
    firstUnitFrame: Record<string, number>;
    buildingCounts: Record<string, number>;
    firstBuildingFrame: Record<string, number>;
    unitFrames: Record<string, number[]>;
    trainTags: Record<string, number[]>;
    buildingFrames: Record<string, number[]>;
    buildPositions: BuildPos[];
    orderPositions: {
        frame: number;
        x: number;
        y: number;
        kind?: "attack" | "move";
        g?: number;
        by?: string;
        n?: number;
    }[];
    hits: {
        frame: number;
        x: number;
        y: number;
        whom: string;
    }[];
    techNames: string[];
    upgradeNames: string[];
    firstTechFrame: Record<string, number>;
    firstUpgradeFrame: Record<string, number>;
    techUses: Record<string, number>;
    techFrames: Record<string, number[]>;
    castPositions: {
        tech: string;
        frame: number;
        x: number;
        y: number;
    }[];
    firstTechUseFrame: Record<string, number>;
    chats: {
        frame: number | null;
        text: string;
    }[];
    unloadCount: number;
    firstUnloadFrame: number | null;
    liftOffCount: number;
    firstLiftOffFrame: number | null;
    leaveFrame: number | null;
    leaveReason: string | null;
    firstCmdFrame: number | null;
    lastCmdFrame: number | null;
    cmdCountByThird: [number, number, number];
}

declare type ReplayRaceBadgeComponent = ComponentType<{
    race: string;
    size?: number;
    circleLetter?: boolean;
    className?: string;
}>;

/** 장면 링크의 열쇠 일곱 — 다른 화면으로 옮길 때 떼어 낼 것도 이 목록이다(scplayer ExtShareScreen). */
export declare const SCENE_LINK_KEYS9: readonly ["t", "s", "z", "cx", "cy", "a", "tr"];

/** 링크에서 푼 장면 한 벌 — 없는 값은 없는 대로 둔다(기본값은 재생기가 안다). */
declare type SceneLink9 = {
    /** 시작 시각(초) */ t?: number;
    /** 배속 */ s?: number;
    /** 배율(1~PLAYBACK_ZOOM_MAX) */ z?: number;
    /** 화면 한가운데의 지도 분수(0~1) */ cx?: number;
    cy?: number;
    /** 각도(도) */ a?: number;
    /** 카메라 임자 — 게임 아이디 · `*`(CAST_AUTO_LINK9)는 자동 중계 */ tr?: string;
};

/** 링크의 쿼리(`?…` 문자열이든 URLSearchParams 든)를 장면 한 벌로 — 열쇠 일곱 중 하나도 없으면 null.
 *  값의 자는 여기서 죈다(시각 > 0 · 배속 > 1 · 배율 1~PLAYBACK_ZOOM_MAX · 분수 0~1 · 각은 유한한 수 · 임자는 빈
 *  글자가 아님). 못 읽는 값은 없는 것으로 둔다 — 옛 링크의 배속 5·10·20 은 재생기가 가장 가까운 칸으로 접는다.
 *  ⚠ 임자(tr)가 로스터에 있는 사람인지는 여기서 모른다 — 재생기가 `bases` 로 걸러 낸다(sceneLink prop). */
export declare const sceneLinkOf9: (src: string | URLSearchParams) => SceneLink9 | null;

/** 지금 장면을 링크 쿼리로 — 시각·배속·자리·각도·카메라 임자. 기본값(0초 · 1배속 · 1배율 · 가운데 · 90도 ·
 *  임자 없음)은 안 싣는다(지적: stargayte 처럼 기본값은 빼기) — 주소만 길어진다. 카메라를 기계가 쥔 장면(중계·
 *  추적)은 playbackViewOf 가 자리를 비워 두므로 저절로 각도와 `&tr=` 만 실린다(위 ★). */
export declare const sceneLinkQueryOf9: (clockKey: string) => URLSearchParams;

export declare const SEARCH_ROLES9: string[];

/** 앱이 부팅에서 한 번 부른다 — 곡 목록을 통째로 갈아 끼운다(준 차례가 곧 목록의 차례). 빈 목록이면 음악을 끈 앱이다. */
export declare function setReplayBgm(tracks: readonly ReplayBgmTrack[]): void;

/** 앱이 부팅에서 한 번 부른다. 준 것만 덮는다. */
export declare function setReplayChrome(next: ReplayChrome): void;

export declare function setReplayMapFetcher(fn: ReplayMapFetcher): void;

/** 아틀라스 자리(앱이 준다 · 예: "/spr") — null 이면 끈다. */
export declare function setReplaySpriteAtlas(opt: {
    base: string;
} | null): void;

/** 도록 한 칸 — 밖(앱의 도록 화면)이 이 꼴을 그대로 먹는다. */
declare type ShapeGalleryItem = {
    kind: string;
    label: string;
    /** 갈래 — "부가"는 유닛도 건물도 아닌 것들(자원·크립·버로우 구멍·핵·스톰·탱크 부품). */
    group: "유닛" | "건물" | "부가";
    /** 종족 — 중립(자원)은 빈 글자다. 도록의 종족 고르기가 이 칸을 본다. */
    race: "테란" | "프로토스" | "저그" | "";
    /** ★ **표에는 있되 목록에는 안 서는 종류**(2026-09, 요청: "성큰 발사·시즈모드 별도 목록
     *  없어도 되고 시즈모드는 탱크 기타 동작셀에 넣고 성큰발사는 성큰 공격셀에 넣으면 됨") ──
     *  그 둘은 제 항목으로 설 까닭이 없다 — 탱크의 액션 칸과 성큰의 공격 칸이 이미 그것을
     *  보여 주기 때문이다. 그렇다고 **표에서 지우면 안 된다**: 광택 표(glossOf9)가 이 표로
     *  종족을 찾으므로, 빠지는 순간 그 모델이 제 종족 광택을 잃고 '그 밖' 값으로 그려진다
     *  (터렛을 가를 때 적어 둔 그 함정이다). 그래서 **숨기기**만 한다 — 도록의 목록·도록
     *  뽑기가 이 칸을 보고 건너뛴다. */
    hidden?: true;
};

/** 자동 완성에 늘 서는 전술 낱말(앱의 검색 꼴 · 판마다 실제로 나온 것은 색인 줄 gameIndexOf9 가 돌려준다). */
export declare const TACTIC_TERMS9: readonly string[];

export declare const TEAM_COLOR: Record<number, string>;

/** 그리는 쪽(mapTiles.drawMapGrid)이 쓰는 얼굴로 감싼다 — 그쪽이 이 파일을 임포트하면
 *  순환이 되므로 함수 묶음만 넘긴다. */
export declare function terrainFace(t: MapTerrain): MapTerrainLike;

/** 그 해시의 맵 격자 — 서버에 없으면 null, '아직 조회 중'이면 undefined.
 *  (구분 이유·지적: 조회 중을 null로 뭉개면 카드가 첫 그림에 옛 로스터 폼을 그렸다가
 *  격자가 도착하면 재생 화면으로 갈아타며 로스터가 깜빡하고 사라져 보였다.) */
export declare function useReplayMap(hash: string | null | undefined): ReplayMapGrid | null | undefined;

/** 격자 캐시가 바뀌면 다시 그린다 — 위 cachedReplayMap을 읽는 화면이 붙는다.
 *  값을 안 돌려주는 까닭: 읽는 자리는 저마다 다른 해시를 묻고, 그 읽기는 위 함수가 한다.
 *  여기 몫은 '바뀌었다'를 알리는 것 하나다(뒷장이 실려 격자가 뒤늦게 도착하는 자리). */
export declare function useReplayMapTick(): void;

export { }
