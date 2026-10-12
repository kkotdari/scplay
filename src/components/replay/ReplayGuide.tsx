import { Bookmark, Map as MapIcon, Maximize, Music, Palette, Play, Search, Share2, Tv, Video, X } from "lucide-react";
import QMarkIcon from "./QMarkIcon";
function K({ keys, plus = false, title, desc }: {
    keys: string[];
    plus?: boolean;
    title: string;
    desc?: string;
}) {
    return (<div className="scr-guide-keyrow">
      <span className="scr-guide-combo">
        {keys.map((k, i) => (<span key={k}>
            {plus && i > 0 && <span className="scr-guide-plus">+</span>}
            <kbd className={k.length > 3 ? "scr-guide-kbd-wide" : undefined}>{k}</kbd>
          </span>))}
      </span>
      <span className="scr-guide-what">
        {title}
        {desc && <small>{desc}</small>}
      </span>
    </div>);
}
/** 사용법(요청: 공통 — 버튼도 페이지도 재생기 안) — 재생기 아래 '사용법' 버튼이 이 문서를 화면 위에 덮는다.
 *  앱은 이 파일을 갖지 않는다. 닫기는 덮개를 걷는 일뿐이다(뒤로가기는 재생기가 history로 맞춘다). */
export default function ReplayGuide({ onClose }: {
    onClose?: () => void;
} = {}) {
    const closeGuide = (): void => { onClose?.(); };

    return (<div className="scr-guide">
      <header className="scr-guide-top">
        
        <button type="button" className="scr-guide-close" onClick={closeGuide} aria-label="사용법 닫기" title="닫기">
          <X size={18}/>
        </button>
        <span className="scr-guide-eyebrow">사용법</span>
        <h1 className="scr-title">보고, 손에 익히기</h1>
        <p className="scr-guide-deck">
          재생 화면의 <b>도구</b>, 그리고 PC에서 손이 기억하게 될{" "}
          <b>단축키</b>. 두 가지면 여기서 할 일은 거의 다 됩니다.
        </p>
        <nav className="scr-guide-jump">
          <a href="#guide-tools"><b>01</b> 화면 도구</a>
          <a href="#guide-keys"><b>02</b> PC 단축키</a>
        </nav>
      </header>

      
      <section id="guide-tools" className="scr-guide-sec">
        <span className="scr-guide-eyebrow">01</span>
        <h2 className="scr-guide-h2">화면 도구</h2>
        <p className="scr-guide-lede">
          재생 화면은 <strong>그 경기를 실제로 다시 돌린 결과</strong>를 그립니다.
          유닛 자리도 지형도 짐작이 아니라 게임이 쓰던 값 그대로입니다. 처음 열면 준비가 끝날 때까지 지도·미니맵이 까맣다가 한꺼번에 켜집니다.
        </p>

        <h3 className="scr-guide-h3">도구 상자</h3>
        <p className="scr-guide-sub">
          지도 아래 <strong>쇠판</strong>입니다 — 맨 위에 <strong>전광판 · 미니맵 · 인포창</strong>이 서고, 그 아래 버튼 줄은 왼쪽의 동그란 <strong>버튼들</strong>(색 · 보기 · 음악 · 검색) ·
          오른쪽의 <strong>스크랩 · 공유 · 사용법(?) · 전체화면</strong>, 맨 아래 줄은 <strong>재생 · 진행바 · 시간</strong>입니다. 버튼 줄 정가운데의 작은 단추가 <strong>접기(▼)</strong>입니다.
          <b>배속</b>은 버튼 줄이 아니라 <b>지도 오른쪽 아래의 세로 다이얼</b>입니다.
        </p>
        <p className="scr-guide-sub">
          진행바를 끌면 그 시각으로 갑니다. <strong>스크랩·공유</strong> 두 버튼은 <strong>지금 이 장면</strong>을
          다루는 것들입니다 — <strong>스크랩</strong>은 나만 보게 담고,{" "}
          <strong>공유</strong>는 링크로 만들어 남에게 보냅니다. 둘 다 <b>같은 장면</b>을
          가리킵니다: 받은 사람이 열면 <b>같은 시각·같은 자리·같은 배율·같은 배속</b>에서 시작합니다.
          단, <b>중계를 켠 채</b> 보내면 자리 대신 <b>중계</b>(자동 또는 그 사람)가 실려, 받은 쪽도 같은 중계로 열립니다.
        </p>
        <div className="scr-guide-mock">
          <div className="scr-guide-bar">
            <span className="scr-guide-play" aria-hidden="true"><Play size={18} fill="currentColor"/></span>
            <span className="scr-guide-seek"/>
            <span className="scr-guide-time">12:04 / 31:12</span>
            <span className="scr-guide-tbtn" aria-hidden="true"><Bookmark size={15}/></span>
            <span className="scr-guide-tbtn scr-guide-tbtn-share" aria-hidden="true"><Share2 size={15}/></span>
          </div>
          <ul className="scr-guide-legend">
            <li><span className="scr-guide-ic"><Play size={14} fill="currentColor"/></span><span><b>재생 / 일시정지</b> — F 키와 같습니다. 끝까지 본 뒤 누르면 처음부터(↺).</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">↔</span><span><b>진행바</b> — 끌어서 원하는 시각으로. 좌우 화살표는 누르는 동안 계속 감깁니다.</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">×2</span><span><b>배속 다이얼</b> — 지도 오른쪽 아래의 세로 눈금(1·2·4·8). 누르거나 위아래로 끌면 ×1~×8 사이에서 부드럽게 바뀌고, 눈금 근처에서는 그 눈금에 붙습니다. PC에서는 그 위에서 <b>휠</b>을 굴려도 되고, 휠은 눈금마다 한 번씩 걸립니다. ↑·↓ 키로도 눈금 한 칸씩. 중계 중에도 됩니다.</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">▼</span><span><b>접기</b> — 버튼 줄 정가운데의 작은 단추. 누르면 그 위의 전광판·미니맵·인포창이 통째로 접혀 지도가 그만큼 넓어지고, 한 번 더 누르면(▲) 다시 펼쳐집니다.</span></li>
            <li><span className="scr-guide-ic"><Bookmark size={14}/></span><span><b>장면 스크랩</b> — 제목을 붙여 담아 둡니다. 담아 둔 장면은 <b>스크랩</b> 화면에서 다시 엽니다.</span></li>
            <li><span className="scr-guide-ic"><Share2 size={14}/></span><span><b>장면 공유</b> — 카톡으로 보냅니다(안 되면 링크 복사). 시각·자리·배율·배속·각도까지 링크에 실립니다(중계 중이면 자리 대신 중계).</span></li>
          </ul>
        </div>

        <h3 className="scr-guide-h3">도구 상자의 버튼</h3>
        <p className="scr-guide-sub">
          켜지면 <strong>흰 바탕에 검은 그림</strong>으로 뒤집힙니다. <strong>중계</strong>는 버튼 줄이 아니라 <strong>전광판</strong>의 카메라 단추(<Video size={12}/>)로 고릅니다(아래 <b>중계 고르기</b>).
        </p>
        <div className="scr-guide-mock">
          <div className="scr-guide-toolrow">
            <span className="scr-guide-mbtn scr-guide-colsw is-personal"><Palette size={18}/></span>
            <span className="scr-guide-mbtn scr-guide-mbtn-txt">2D</span>
            <span className="scr-guide-mbtn"><Music size={18}/></span>
            <span className="scr-guide-mbtn"><Search size={18}/></span>
            <span className="scr-guide-tpill"><Bookmark size={15}/></span>
            <span className="scr-guide-tpill"><Share2 size={15}/></span>
            <span className="scr-guide-tpill"><QMarkIcon size={15}/></span>
            <span className="scr-guide-tpill"><Maximize size={15}/></span>
          </div>
          <ul className="scr-guide-legend">
            <li><span className="scr-guide-ic"><Palette size={15}/></span><span><b>색</b> — 누를 때마다 색 모드가 바뀝니다. 기본인 개인색에서는 <b>꺼진 버튼</b>(바탕 없음)이고, 팀색·주인공색에서는 버튼의 <b>원그래프</b>가 곧 그 모드입니다(아래 <b>색 모드</b>).</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">2D</span><span><b>보기</b> — 평면(2D)과 입체(3D)를 오갑니다. 언덕·램프는 입체에서 더 잘 읽힙니다. PC에만 있고, 중계 중에는 평면으로 고정됩니다.</span></li>
            <li><span className="scr-guide-ic"><Music size={15}/></span><span><b>음악</b> — 누르면 곡 목록이 펼쳐집니다. 고른 곡은 처음부터 나옵니다. 맨 아래 줄은 <b>음량 슬라이더</b>(처음 50% · 떼면 닫힘)와 <b>끄기</b>입니다. 아이폰 사파리는 웹에서 음량을 못 바꿔 끄기만 섭니다(기기 음량을 따릅니다).</span></li>
            <li><span className="scr-guide-ic"><Search size={15}/></span><span><b>검색</b> — 유닛·건물·기술 이름이나 <b>전술</b>(드랍 · 러시 · 견제 · 교전 · 파괴 …), 사람 이름으로 찾습니다(빈칸으로 나눈 말은 다 들어야 맞음 — 예: "정구 드랍"). 검색어를 치고 <b>Enter</b>(또는 찾기 단추)를 눌러야 찾습니다. 찾은 곳은 <b>진행바에 노란 태그</b>로 서고 지금 결과는 빨갛습니다. <b>◀ ▶</b>(또는 다시 Enter · Shift+Enter)로 이전·다음 결과로 가며, 그 일이 벌어지기 2초 전부터 봅니다. 결과가 있을 때 창의 <b>접기</b>는 창만 닫고 결과는 남깁니다 — 검색 단추 곁의 <b>‹ n/N › ✕</b>로 계속 넘기거나 지웁니다. 결과를 지우는 것은 <b>검색 취소</b>입니다.</span></li>
            <li><span className="scr-guide-ic"><QMarkIcon size={15}/></span><span><b>사용법</b> — 지금 보고 있는 이 안내입니다(PC · 전체화면이 아닐 때만).</span></li>
            <li><span className="scr-guide-ic"><Maximize size={15}/></span><span><b>전체화면</b> — 줄의 맨 오른쪽. 전체화면에서도 쇠판(전광판·미니맵·인포창)은 그대로 섭니다.</span></li>
          </ul>
        </div>

        <h3 className="scr-guide-h3">색 모드</h3>
        <p className="scr-guide-sub">
          색 버튼은 세 모드를 돕니다. <strong>주인공색</strong>은 중계가 켜져 있을 때만 고를 수 있고,
          중계를 끄면 <strong>개인색</strong>으로 돌아옵니다. 1:1·개인전에는 편이 없어 팀색을 건너뜁니다.
        </p>
        <ul className="scr-guide-legend">
          <li><span className="scr-guide-colsw scr-guide-colsw-s is-personal" aria-hidden="true"/><span><b>개인색</b>(기본) — 그 경기에서 각자가 쓰던 색입니다. 기본이라 색 버튼은 <b>꺼진 꼴</b>(바탕 없음)입니다.</span></li>
          <li><span className="scr-guide-colsw scr-guide-colsw-s is-team" aria-hidden="true"/><span><b>팀색</b> — 편을 빨강·파랑 둘로 가릅니다.</span></li>
          <li><span className="scr-guide-colsw scr-guide-colsw-s is-hero" aria-hidden="true"/><span><b>주인공색</b> — 원작의 그 모드처럼 <b>나</b>는 청록, <b>우리 편</b>은 노랑, <b>상대</b>는 빨강입니다. ‘나’는 지금 <b>화면 주인</b>이라, 자동 중계가 사람을 바꾸면 색도 그 사람 기준으로 바뀝니다.</span></li>
        </ul>

        <h3 className="scr-guide-h3">지도 움직이기 · 확대</h3>
        <p className="scr-guide-sub">
          지도는 <strong>손으로</strong> 움직이고 키웁니다. 확대 단추는 없습니다 — 배율은 1배부터 <b>한 배씩</b>(1·2·3·4…) 오르내립니다.
          중계가 켜진 동안은 카메라를 중계가 쥐어 끌기·배율이 잠깁니다.
        </p>
        <ul className="scr-guide-legend">
          <li><span className="scr-guide-ic scr-guide-ic-txt">↔</span><span><b>끌기</b> — 지도를 잡고 끌면 그쪽으로 움직입니다(PC는 마우스, 폰은 한 손가락). PC에서는 W·A·S·D로도 밀립니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">휠</span><span><b>마우스 휠</b> — 굴리면 그 자리를 중심으로 한 배씩 키우고 줄입니다. E·Q 키는 1·2·4·8·16배를 한 칸씩 오갑니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">✌</span><span><b>핀치</b> — 폰에서 두 손가락을 벌리면 커지고 모으면 작아집니다. 한 손가락으로 끌면서 함께 해도 됩니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">×2</span><span><b>두 번 누르기</b> — 그 자리를 한 번에 8배로 당깁니다(더블클릭·더블탭). 한 번 더 누르면 1배로 돌아옵니다.</span></li>
          <li><span className="scr-guide-ic"><MapIcon size={15}/></span><span><b>미니맵</b> — 쇠판 가운데의 작은 지도를 누르거나 끌면 그 자리로 화면이 갑니다. 그 위에서 휠을 굴려도 확대·축소됩니다. 중계·개인 화면·분할 중에는 카메라가 잠겨 안내만 뜹니다.</span></li>
        </ul>

        <h3 className="scr-guide-h3">중계 고르기</h3>
        <p className="scr-guide-sub">
          <strong>전광판</strong>의 단추로 <strong>누구 화면</strong>을 볼지 고릅니다. 들어오면 <strong>자동중계</strong>로 켜져 있습니다.
          켜진 단추는 <b>초록</b>이고, 지금 보여 주는 사람은 전광판에서 <b>이름이 빛납니다</b>. 화면 위 가운데에 <b>누구 화면인지</b> 이름표가 서고, 쇠판의 미니맵은 그 사람 시야입니다.
        </p>
        <div className="scr-guide-mock">
          {/* 전광판 머리 줄 + 두 줄(2026-10-11, 지적: "중계고르기 부분 이미지가 다름") — 옛 TV 목록(흰 바탕 AUTO · 색 점) 그림을 지금 전광판 꼴로:
              AUTO·전체 알약 · 줄마다 카메라 단추 + 종족 배지 이름칩 · 켜짐은 반투명 초록 · 보여 주는 사람은 칩이 빛난다. */}
          <div className="scr-guide-castlist" aria-hidden="true">
            <div className="scr-guide-castrow">
              <span className="scr-guide-cam is-on is-pill"><Tv size={14}/>자동중계</span>
              <span className="scr-guide-cam is-pill"><Video size={14}/>전체</span>
            </div>
            <div className="scr-guide-castrow">
              <span className="scr-guide-cam"><Video size={14}/></span>
              <span className="scr-guide-castchip is-shown" style={{ background: "#2b62e8", color: "#fff", ["--pcol" as string]: "#2b62e8" } as React.CSSProperties}><i className="scr-guide-castrace">T</i>정구</span>
            </div>
            <div className="scr-guide-castrow">
              <span className="scr-guide-cam"><Video size={14}/></span>
              <span className="scr-guide-castchip" style={{ background: "#f88c14", color: "#10151a" }}><i className="scr-guide-castrace">Z</i>팍규</span>
            </div>
          </div>
          <ul className="scr-guide-legend">
            <li>
              <span className="scr-guide-ic"><Video size={14}/></span>
              <span><b>자동중계</b> — 지금 가장 볼 만한 사람에게 저절로 갑니다. 큰 교전·기지 공격·견제·드랍·마법이 벌어지는 쪽을 장면이
              시작되기 <b>조금 전에</b> 미리 잡아 두고, 장면이 이어지는 동안은 그 사람에 머뭅니다. 작은 일(몇 기 싸움·일꾼 하나)은 건너뜁니다.
              볼 만한 일이 없으면 <b>전광판 차례로 팀을 번갈아</b> 6초씩 돌아가고, 그 칸에 <b>인구가 막힌</b> 사람이 있으면 그 사람을 먼저 보여 줍니다.
              켜진 자동중계를 다시 누르면 꺼지고, 보던 자리에서 지도를 손으로 움직입니다(시야도 전체로).</span>
            </li>
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">이름</span>
              <span><b>한 사람</b>(이름 왼쪽 카메라) — 그 사람의 <b>시야</b>로 밝히고, 그 사람이 <b>보고 있던 자리</b>로 화면이 따라갑니다.
              리플레이에는 카메라 좌표가 없어서, ‘방금 무엇을 집어 무엇을 시켰나’를 눈길로 삼습니다. 켜진 카메라를 다시 누르면 놓습니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">이름+</span>
              <span><b>여러 사람</b> — 카메라를 더 켜면 <b>그 사람들만 화면을 나눠</b> 함께 봅니다. 폰에서는 <b>두 명까지</b>입니다.
              칸마다 그 사람 팀의 <b>시야</b>이고, 칸 안에는 <b>그 사람의</b> 클릭 자국·선택 링·건설 자리와 <b>같은 편의 핑</b>만 보입니다.
              처음엔 미니맵이 전체이고 인포창은 <b>'화면을 선택해주세요'</b>입니다. <b>칸을 누르면</b> 미니맵·인포창이 그 사람 것이 되고 칸에 흰 테가 둘립니다. 한 번 더 누르면 놓습니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">전체</span>
              <span><b>전체</b>(PC) — 모든 선수의 화면을 나눠 함께 봅니다. 거기서 한 사람의 카메라를 끄면 그 사람만 빠집니다.</span>
            </li>
          </ul>
        </div>

        {/* (걷어냄 · 2026-10-11, 요청: "중계자막 파트는 제거") 중계 자막 절 — 자막 말씨는 cast9 castCaps9 · docs/notes/cast-split.md 에 있다. */}

        <h3 className="scr-guide-h3">미니맵 · 인포창</h3>
        <p className="scr-guide-sub">
          지도 바로 아래에 <strong>전광판</strong>(왼쪽) · <strong>미니맵</strong>(가운데) · <strong>인포창</strong>(오른쪽)이 한 틀로 서 있습니다(좁으면 인포창부터 줄거나 빠집니다).
          전광판은 PC에서 사람마다 일꾼 · 인구 · 자원 · 데미지 · APM을 보여 주고, 폰에서는 팀마다 두 줄로 이름과 카메라 단추만 섭니다.
          미니맵 위의 <strong>이름표</strong>는 각 사람의 <b>기지마다</b> 섭니다 — 본진·멀티·이사한 자리를 따라가고, 나갔거나 생산이 끊긴 사람은 어둡습니다.
        </p>
        <ul className="scr-guide-legend">
          <li><span className="scr-guide-ic scr-guide-ic-txt">하나</span><span><b>유닛·건물 하나</b> — 지도에서 누르면 그림 위 가운데에 이름, 그 아래 그림과 체력·실드·에너지, 처치 수, 업그레이드가 섭니다. 고른 것에는 지도에서 <b>선택 링</b>이 둘리고, 체력바는 링 아래에 섭니다. 건물이 일하는 중이면 진행 줄이 <b>[작은 칸][진행 바]</b> 한 꼴로 섭니다:</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">생산</span><span><b>생산</b> — 왼쪽 칸이 지금 뽑는 유닛, 그 아래 <b>대기 넷</b>(비어 있어도 자리를 지킵니다).</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">연구</span><span><b>연구</b> — 왼쪽 칸이 하는 업그레이드(단계는 칸 오른쪽 아래 숫자), 바에 ‘N단계’. 연구 건물 아래쪽에는 그 건물에서 하는 업그레이드가 둥근 네모 칸으로 늘어섭니다(안 한 것은 흐리게 · 마친 것은 밝게).</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">건설</span><span><b>짓는 중</b> — 큰 그림·이름이 <b>공사장</b>(테란) · <b>소환구</b>(프로토스) · <b>공사 고치</b>(저그)가 되고, 바에 <b>건설중 · 소환중 · 변태중: 건물 이름</b>이 섭니다. 레어·하이브·그레이터 스파이어·성큰·스포어처럼 <b>건물이 변태</b>하면 큰 그림은 원래 건물(해처리…)이고 칸이 새 건물(레어…)입니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">탑승</span><span><b>수송선·벙커</b> — 탄 유닛이 칸으로 섭니다. 2칸짜리는 세로 두 칸 · 4칸짜리(탱크·드라군 같은)는 2×2 입니다. 유닛의 공격·방어·실드 업그레이드도 둥근 네모 칸입니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">여럿</span><span><b>화면 주인의 선택</b> — 중계 중에 아무것도 안 눌렀으면, 그 사람이 지금 고른 부대가 칸으로 섭니다(6칸씩 두 줄 · 왼쪽부터). 칸을 누르면 그 유닛 하나를 봅니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">데미지</span><span><b>데미지</b> — <b>준 데미지/입은 데미지</b>(체력+실드 점수 · 유닛과 건물을 합친 값)입니다. 여럿이 함께 잡아도 때린 만큼 갈려 K/D 보다 공정합니다. 천 단위는 12.3k 꼴. 팀전에서는 괄호에 지금까지 <b>우리 팀이 준(입은) 데미지 가운데 내 몫(%)</b>이 섭니다.</span></li>
        </ul>

      </section>

      
      <section id="guide-keys" className="scr-guide-sec">
        <span className="scr-guide-eyebrow">02</span>
        <h2 className="scr-guide-h2">PC 단축키</h2>
        <p className="scr-guide-lede">
          재생 화면에서 바로 먹습니다. <strong>F</strong>와{" "}
          <strong>좌우 화살표</strong> 둘만 익혀도 대부분 됩니다.
        </p>

        <div className="scr-guide-keys">
          <span className="scr-guide-group">재생</span>
          <K keys={["F"]} title="재생 / 일시정지" desc="끝까지 본 뒤에 누르면 처음부터 다시 돕니다."/>
          <K keys={["←", "→"]} title="되감기 / 빨리감기" desc="누르고 있으면 계속 감깁니다 — 떼면 그 자리에서 멈춥니다."/>
          <K keys={["↑", "↓"]} title="배속 올리기 / 내리기" desc="다이얼 눈금(1·2·4·8)을 한 칸씩."/>

          <span className="scr-guide-group">지도</span>
          <K keys={["W", "A", "S", "D"]} title="지도 움직이기" desc="누르고 있는 동안 계속 밀립니다."/>
          <K keys={["Q", "E"]} title="축소 / 확대" desc="한 번에 한 칸씩, 마우스 휠로도 됩니다."/>

          <span className="scr-guide-group">장면</span>
          <K keys={["Z"]} title="장면 스크랩" desc="지금 장면을 제목 붙여 담습니다."/>
          <K keys={["X"]} title="장면 공유" desc="지금 장면의 링크를 공유 시트로 보냅니다(안 되면 링크 복사)."/>

          <span className="scr-guide-group">보기</span>
          <K keys={["C"]} title="색 모드 바꾸기" desc="개인색 → 팀색 → 주인공색. 색 버튼과 같습니다."/>
          <K keys={["V"]} title="평면 ↔ 입체" desc="중계 중에는 평면 고정."/>
          <K keys={["M"]} title="음악 켜기 / 끄기"/>

          <span className="scr-guide-group">창</span>
          <K keys={["Alt", "Enter"]} plus title="전체화면 들어가기 / 나가기"/>
          <K keys={["Esc"]} title="닫기" desc="지도에서 고른 것이 있으면 그 선택부터 풀고, 없으면 전체화면에서 나갑니다."/>
        </div>

        
      </section>

      <div className="scr-guide-back">
        
        <button type="button" className="scr-btn scr-btn-secondary" onClick={closeGuide}>
          닫기
        </button>
      </div>
    </div>);
}
