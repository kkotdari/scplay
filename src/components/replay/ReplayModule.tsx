import type { ReactNode } from "react";
import ReplayMotionPlayer from "./ReplayMotionPlayer";
import type { MotionBase, SceneLink9 } from "./ReplayMotionPlayer";
import type { ReplayMapGrid } from "./mapGrid";
import "./replay.css";

/* 리플레이 재생 모듈 — 페이지 안에 통째로 꽂는 한 벌.
   지도·조작부·전체화면까지 담는다. **경기라는 것을 모른다** — 들어오는 것은
   지도 격자, 로스터 몇 줄, 자취를 가져오는 함수뿐이다. 맵 이름·시각·승패 줄(옛 머리 줄)은
   2026-10-09 에 걷었다 — 앱이 제 페이지 제목 줄에 그린다(요청: 재생기 위 타이틀 상자 제거).
   댓글·공유는 안 만들고 슬롯(side·shareNode)으로 받기만 한다: 앱마다 다른 물건이라
   여기 두면 옮긴 쪽에서 두 벌이 된다.
   붙이는 법과 함께 챙길 것은 이 폴더의 README.md에 있다. */

export interface ReplayModuleProps {
  /** 지도 격자 — 이것이 없으면 그릴 것이 없다(부르는 쪽이 먼저 가린다). */
  grid: ReplayMapGrid;
  /** 판 길이(초). 모르면 null — 자취의 마지막 프레임이 대신한다. */
  endSec: number | null;
  /** 로스터 — 이름·종족·편. 재생기가 색과 기둥을 이걸로 짓는다. */
  bases: MotionBase[];
  /** 그 게임 아이디가 어느 편인가 — 팀색이 이 답을 쓴다. */
  teamOfRaw: (raw: string) => 1 | 2 | undefined;
  /** 참값 자취를 가져오는 길 — 앱이 제 API로 채운다(모듈은 주소를 모른다). */
  loadUnitTracks: () => Promise<{ motion: string | null; chats?: { sec: number; name: string; text: string }[] }>;
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
  /** ★ 장면 스크랩 — 함수를 주면 재생기가 **버튼째** 그린다(요청: "버튼은 css까지 먹여서
   *  네가 만들어서 기본값 제공해 줘야지, 갖다 쓰는 쪽은 사용 여부 판단하고 기능만 붙이는
   *  거고"). 앱은 담는 일만 하면 된다 — 꼴·자리·단축키(Z)·완료 표시는 모듈의 몫이다.
   *  안 주면 버튼을 안 그린다(그것이 곧 '사용 여부 판단'이다).
   *  참을 돌려주면(또는 참으로 풀리는 약속이면) 잠깐 "담았어요"로 바뀐다. */
  onScrap?: () => string | boolean | void | Promise<string | boolean | void>;
  /** 스크랩 버튼의 글씨 — 기본 "장면 스크랩". */
  scrapLabel?: string;
  /** ★ 장면 공유 — 스크랩과 **같은 규약**이다(지적: "스크랩 버튼, 공유 버튼은 쓰는 쪽에서
   *  쓸지 말지 선택하는 거고 함수도 알아서 연결해야 해"). 주면 버튼이 서고(단축키 X),
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
}

export default function ReplayModule({
  grid, endSec, bases, teamOfRaw, loadUnitTracks,
  winnerTeam, melee, soleView, active = true,
  sceneLink, clockKey,
  onFinish, onDetailClose, shareNode, onScrap, scrapLabel, onShare, shareLabel,
  onGuide, guide, side, menu, avatars,
}: ReplayModuleProps) {
  return (
    <div className="scr-story-map">
      <ReplayMotionPlayer
        grid={grid} endSec={endSec}
        bases={bases} teamOfRaw={teamOfRaw} active={active}
        sceneLink={sceneLink}
        clockKey={clockKey}
        shareNode={shareNode}
        onScrap={onScrap}
        scrapLabel={scrapLabel}
        onShare={onShare}
        shareLabel={shareLabel}
        onGuide={onGuide}
        guide={guide}
        onDetailClose={onDetailClose}
        soleView={soleView}
        loadUnitTracks={loadUnitTracks}
        winnerTeam={winnerTeam}
        melee={melee}
        onFinish={onFinish}
        side={side}
        menu={menu}
        avatars={avatars}
      />
    </div>
  );
}
