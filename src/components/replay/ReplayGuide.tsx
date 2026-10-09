import { Bookmark, Map as MapIcon, Maximize, Music, Palette, Play, Share2, Video, X } from "lucide-react";
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
          유닛 자리도 지형도 짐작이 아니라 게임이 쓰던 값 그대로입니다.
        </p>

        <h3 className="scr-guide-h3">도구 상자</h3>
        <p className="scr-guide-sub">
          지도 아래 <strong>쇠판</strong>입니다 — 맨 위에 <strong>전광판 · 미니맵 · 인포창</strong>이 서고, 그 아래 버튼 줄은 왼쪽의 동그란 <strong>버튼들</strong> ·
          오른쪽의 <strong>스크랩 · 공유 · 사용법(?) · 전체화면</strong>, 맨 아래 줄은 <strong>배속 · 재생 · 진행바 · 시간</strong>입니다. 버튼 줄 정가운데의 작은 단추가 <strong>접기(▼)</strong>입니다.
          사람들의 현황은 쇠판 왼쪽의 <b>전광판</b>이 늘 보여 줍니다(폰은 일꾼 / 인구 / 자원 / 데미지 / APM 다섯 쪽이 6초마다 번갈아 넘어갑니다). 그 오른쪽이 <b>미니맵</b>,
          자리가 남으면 <b>인포창</b>이 섭니다 — 좁으면 인포창이 작아지거나(폰 세로) 빠지고, 전광판과 미니맵이 함께 줄어 높이도 낮아집니다.
        </p>
        <p className="scr-guide-sub">
          진행바를 끌면 그 시각으로 갑니다. <strong>스크랩·공유</strong> 두 버튼은 <strong>지금 이 장면</strong>을
          다루는 것들입니다 — <strong>스크랩</strong>은 나만 보게 담고,{" "}
          <strong>공유</strong>는 링크로 만들어 남에게 보냅니다. 둘 다 <b>같은 장면</b>을
          가리킵니다: 받은 사람이 열면 <b>같은 시각·같은 자리·같은 배율</b>에서 시작합니다.
          단, <b>중계를 켠 채</b> 보내면 자리 대신 <b>중계</b>(자동 또는 그 사람)가 실려, 받은 쪽도 같은 중계로 열립니다.
        </p>
        <div className="scr-guide-mock">
          <div className="scr-guide-bar">
            <span className="scr-guide-mbtn scr-guide-mbtn-txt" aria-hidden="true">×2</span>
            <span className="scr-guide-play" aria-hidden="true"><Play size={18} fill="currentColor"/></span>
            <span className="scr-guide-seek"/>
            <span className="scr-guide-time">12:04 / 31:12</span>
            <span className="scr-guide-tbtn" aria-hidden="true"><Bookmark size={15}/></span>
            <span className="scr-guide-tbtn scr-guide-tbtn-share" aria-hidden="true"><Share2 size={15}/></span>
          </div>
          <ul className="scr-guide-legend">
            <li><span className="scr-guide-ic scr-guide-ic-txt">×2</span><span><b>배속</b> — 재생 버튼 왼쪽. 누르면 위로 목록(×1·×2·×4·×8)이 펼쳐집니다. 교전 하나를 뜯어볼 땐 낮추고, 초반 빌드를 넘길 땐 올립니다.</span></li>
            <li><span className="scr-guide-ic"><Play size={14} fill="currentColor"/></span><span><b>재생 / 일시정지</b> — 스페이스와 같습니다. 끝까지 본 뒤 누르면 처음부터(↺).</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">↔</span><span><b>진행바</b> — 끌어서 원하는 시각으로. 좌우 화살표는 누르는 동안 계속 감깁니다.</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">▼</span><span><b>접기</b> — 버튼 줄 정가운데의 작은 단추. 누르면 그 위의 미니맵·인포창이 통째로 접혀 지도가 그만큼 넓어지고, 한 번 더 누르면(▲) 다시 펼쳐집니다.</span></li>
            <li><span className="scr-guide-ic"><Bookmark size={14}/></span><span><b>장면 스크랩</b> — 제목을 붙여 담아 둡니다. 담아 둔 장면은 <b>스크랩</b> 화면에서 다시 엽니다.</span></li>
            <li><span className="scr-guide-ic"><Share2 size={14}/></span><span><b>장면 공유</b> — 카톡으로 보냅니다(안 되면 링크 복사). 시각·자리·배율·각도까지 링크에 실립니다(중계 중이면 자리 대신 중계).</span></li>
          </ul>
        </div>

        <h3 className="scr-guide-h3">도구 상자의 버튼</h3>
        <p className="scr-guide-sub">
          켜지면 <strong>흰 바탕에 검은 그림</strong>으로 뒤집힙니다. <strong>중계</strong>는 버튼 줄이 아니라 <strong>전광판</strong>의 카메라 단추(<Video size={12}/>)로 고릅니다 —
          켜진 단추는 <strong>초록 테</strong>이고, 맨 위 <b>AUTO</b>(자동)는 켜진 동안 <strong>초록으로 깜빡</strong>입니다.
        </p>
        <div className="scr-guide-mock">
          <div className="scr-guide-toolrow">
            <span className="scr-guide-mbtn is-on"><MapIcon size={18}/></span>
            <span className="scr-guide-mbtn scr-guide-colsw is-personal"><Palette size={18}/></span>
            <span className="scr-guide-mbtn scr-guide-mbtn-txt">2D</span>
            <span className="scr-guide-mbtn"><Music size={18}/></span>
            <span className="scr-guide-tpill"><Bookmark size={15}/></span>
            <span className="scr-guide-tpill"><Share2 size={15}/></span>
            <span className="scr-guide-tpill"><QMarkIcon size={15}/></span>
            <span className="scr-guide-tpill"><Maximize size={15}/></span>
          </div>
          <ul className="scr-guide-legend">
            <li><span className="scr-guide-ic"><Video size={15}/></span><span><b>카메라</b>(전광판 이름 왼쪽) — 누르면 그 사람 화면을 따라갑니다. 둘 이상 켜면 그 사람들만 화면을 나눠 보고, 켜진 것을 다시 누르면 놓습니다. 맨 위 <b>AUTO</b>가 자동 중계입니다. 아래 <b>중계 고르기</b>에서 자세히.</span></li>
            <li><span className="scr-guide-ic"><Palette size={15}/></span><span><b>색</b> — 누를 때마다 색 모드가 바뀝니다. 기본인 개인색에서는 <b>꺼진 버튼</b>(바탕 없음)이고, 팀색·주인공색에서는 버튼의 <b>원그래프</b>가 곧 그 모드입니다(아래 <b>색 모드</b>).</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">2D</span><span><b>보기</b> — 평면(2D)과 입체(3D)를 오갑니다. 언덕·램프는 입체에서 더 잘 읽힙니다. PC에만 있습니다.</span></li>
            <li><span className="scr-guide-ic"><Music size={15}/></span><span><b>음악</b> — 누르면 곡 목록이 펼쳐집니다. 고른 곡은 처음부터, 맨 아래 '끄기'로 끕니다. 처음 들어오면 켜져 있습니다.</span></li>
            <li><span className="scr-guide-ic"><QMarkIcon size={15}/></span><span><b>사용법</b> — 지금 보고 있는 이 안내입니다(PC · 전체화면이 아닐 때만).</span></li>
            <li><span className="scr-guide-ic"><Maximize size={15}/></span><span><b>전체화면</b> — 줄의 맨 오른쪽. 전체화면에서는 사용법 버튼이 빠지고, <b>미니맵</b>(<MapIcon size={12}/>) 버튼이 함께 서서 아래 작은 지도를 여닫습니다.</span></li>
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

        {/* ★ 확대 단추가 줄에서 빠지며(2026-09, 요청: "배율 버튼: 모바일 피시에서 제거. 사용법에는 드래그나 핀치조작법 별도로 남기기")
            움직이는 법·키우는 법은 여기 제 절로 선다 — 지도는 손으로만 움직이고 키운다. */}
        <h3 className="scr-guide-h3">지도 움직이기 · 확대</h3>
        <p className="scr-guide-sub">
          지도는 <strong>손으로</strong> 움직이고 키웁니다. 확대 단추는 없습니다 — 배율은 1배부터 <b>한 배씩</b>(1·2·3·4…) 오르내립니다.
        </p>
        <ul className="scr-guide-legend">
          <li><span className="scr-guide-ic scr-guide-ic-txt">↔</span><span><b>끌기</b> — 지도를 잡고 끌면 그쪽으로 움직입니다(PC는 마우스, 폰은 한 손가락). PC에서는 W·A·S·D로도 밀립니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">휠</span><span><b>마우스 휠</b> — 굴리면 그 자리를 중심으로 한 배씩 키우고 줄입니다. ↑·↓ 키는 1·2·4·8·16배를 한 칸씩 오갑니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">✌</span><span><b>핀치</b> — 폰에서 두 손가락을 벌리면 커지고 모으면 작아집니다. 한 손가락으로 끌면서 함께 해도 됩니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">×2</span><span><b>두 번 누르기</b> — 그 자리를 한 번에 8배로 당깁니다(더블클릭·더블탭). 한 번 더 누르면 1배로 돌아옵니다.</span></li>
          <li><span className="scr-guide-ic"><MapIcon size={15}/></span><span><b>미니맵</b> — 쇠판 가운데의 작은 지도를 누르거나 끌면 그 자리로 화면이 갑니다. 그 위에서 휠을 굴려도 확대·축소됩니다(중계가 꺼져 있을 때). 그 위의 <b>이름표</b>를 누르면 그 사람 화면입니다.</span></li>
          <li><span className="scr-guide-ic"><Video size={15}/></span><span><b>중계</b>를 켜면 사람을 따라가며 알아서 당겨 놓습니다 — 켜진 동안은 휠·핀치·↑↓ 배율이 잠깁니다.</span></li>
        </ul>

        <h3 className="scr-guide-h3">중계 고르기</h3>
        <p className="scr-guide-sub">
          <strong>전광판</strong>의 카메라 단추나 <strong>미니맵 위 이름표</strong>로 <strong>누구 화면</strong>을 볼지 고릅니다. 들어오면 <strong>AUTO</strong>(자동)로 켜져 있습니다.
          중계가 켜진 동안은 카메라를 중계가 쥐어, 지도를 손으로 끌어도 안 움직이고 배율도 못 바꿉니다. 화면 아래 가운데에 <b>누구 화면인지</b> 이름표가 서고, 왼아래 작은 미니맵은 그 사람 시야입니다.
        </p>
        <div className="scr-guide-mock">
          <div className="scr-guide-castlist" aria-hidden="true">
            <span className="scr-guide-castitem">전체</span>
            <span className="scr-guide-castitem"><i className="scr-guide-castdot" style={{ background: "#2b62e8" }}/>정구</span>
            <span className="scr-guide-castitem"><i className="scr-guide-castdot" style={{ background: "#f88c14" }}/>팍규</span>
            <span className="scr-guide-castitem is-on">자동</span>
            <span className="scr-guide-castitem">끄기</span>
          </div>
          <ul className="scr-guide-legend">
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">전체</span>
              <span><b>전체</b>(맨 위) — 모든 선수의 화면을 나눠 함께 봅니다. 켜면 아래 이름이 <b>모두 선택된 채</b>로 서고, 거기서 한 사람을
              누르면 그 사람만 빠진 화면 나누기가 됩니다. 칸마다 아래 가운데에 그 사람 이름표가 섭니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">이름</span>
              <span><b>한 사람</b> — 그 사람의 <b>시야</b>로 밝히고, 그 사람이 <b>보고 있던 자리</b>로 화면이 따라갑니다.
              리플레이에는 카메라 좌표가 없어서, ‘방금 무엇을 집어 무엇을 시켰나’를 눈길로 삼습니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">이름+</span>
              <span><b>여러 사람</b> — 카메라 단추를 더 켜면 고른 사람이 늘어나 <b>그 사람들만 화면을 나눠</b> 함께 봅니다.
              켜진 단추를 다시 누르면 빠지고, 모두 켜면 곧 <b>전체</b>입니다. 폰에서는 <b>두 명까지</b>입니다.
              칸마다 그 사람 팀의 <b>시야</b>이고, 칸 안에는 <b>그 사람의</b> 클릭 자국·선택 링·건설 자리와 <b>같은 편의 핑</b>만 보입니다.
              아래 <b>미니맵</b>은 처음엔 전체(관전자)와 같고, 인포창은 <b>'화면을 선택해주세요'</b>만 보입니다. <b>칸을 누르면</b> 미니맵이 그 사람 시야·화면 자리가 되고
              인포창이 그 사람의 것(선택)이 되며 칸에 흰 테가 둘립니다. 한 번 더 누르면 놓습니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic"><Video size={14}/></span>
              <span><b>자동</b>(AUTO) — 지금 가장 볼 만한 사람에게 저절로 갑니다. 교전·견제·마법이 크게 벌어지는 쪽을 장면이
              시작되기 <b>조금 전에</b> 미리 잡아 두고, 일이 이어지면 8초가 넘어도 그 사람에 머뭅니다. 볼 만한 일이 없으면
              <b> 전광판 차례로 팀을 번갈아</b> 8초씩 돌아갑니다. 지도는 다 보이는 채로 카메라만 옮깁니다. 지금 보여 주는 사람은 전광판의 <b>이름이 깜빡이며 빛납니다</b>.
              교전·침공·드랍 견제처럼 <b>맞서는 상대</b>가 있는 장면이면 <b>더 잘 싸운 쪽</b> 한 사람 화면을 보여 주고, 이름표 위에
              <b>'누구를 공격' · '누가 공격함 · 누가 헬프옴' · '누구와 교전'</b> 자막이 뜹니다(왼쪽 띠가 빨강 공격 · 파랑 방어 · 주황 교전). 화면은 늘 하나입니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">끄기</span>
              <span><b>끄기</b> — 보던 자리에 그대로 멈추고 지도를 손으로 움직입니다. 시야도 전체로 돌아옵니다.</span>
            </li>
          </ul>
        </div>

        <h3 className="scr-guide-h3">미니맵 · 인포창</h3>
        <p className="scr-guide-sub">
          지도 바로 아래 가운데에 <strong>전광판</strong>(왼쪽) · <strong>미니맵</strong>(가운데) · <strong>인포창</strong>(오른쪽)이 한 틀로 서 있습니다(좁으면 인포창부터 줄거나 빠집니다).
          미니맵 위의 <strong>이름표</strong>는 각 사람의 진영 자리입니다 — 본진을 잃고 옮기면 따라가고, 진영이 클수록 크며, 나갔거나 생산이 끊긴 사람은 어둡습니다. 누르면 그 사람 화면입니다.
          버튼 줄 정가운데의 <strong>접기(▼)</strong>를 누르면 전광판·인포창이 통째로 접히고, 한 번 더 누르면(▲) 다시 펼쳐집니다 — 프레임·전체화면 어디서나 됩니다.
        </p>
        <ul className="scr-guide-legend">
          <li><span className="scr-guide-ic scr-guide-ic-txt">하나</span><span><b>유닛·건물 하나</b> — 지도에서 누르면 그림 위 가운데에 이름, 그 아래 그림과 체력·실드·에너지, 처치 수, 업그레이드가 섭니다. 건물이 일하는 중이면 진행 줄이 <b>[작은 칸][진행 바]</b> 한 꼴로 섭니다:</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">생산</span><span><b>생산</b> — 왼쪽 칸이 지금 뽑는 유닛, 그 아래 <b>대기 넷</b>(비어 있어도 자리를 지킵니다).</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">연구</span><span><b>연구</b> — 왼쪽 칸이 하는 업그레이드(단계는 칸 오른쪽 아래 숫자), 바에 ‘N단계’. 연구 건물 아래쪽에는 그 건물에서 하는 업그레이드가 둥근 네모 칸으로 늘어섭니다(안 한 것은 흐리게 · 마친 것은 밝게).</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">건설</span><span><b>짓는 중</b> — 큰 그림·이름이 <b>공사장</b>(테란) · <b>소환구</b>(프로토스) · <b>공사 고치</b>(저그)가 되고, 바에 <b>건설중 · 소환중 · 변태중: 건물 이름</b>이 섭니다. 레어·하이브·그레이터 스파이어·성큰·스포어처럼 <b>건물이 변태</b>하면 큰 그림은 원래 건물(해처리…)이고 칸이 새 건물(레어…)입니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">탑승</span><span><b>수송선·벙커</b> — 탄 유닛이 칸으로 섭니다. 2칸짜리는 세로 두 칸 · 4칸짜리(탱크·드라군 같은)는 2×2 입니다. 유닛의 공격·방어·실드 업그레이드도 둥근 네모 칸입니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">여럿</span><span><b>화면 주인의 선택</b> — 중계 중에 아무것도 안 눌렀으면, 그 사람이 지금 고른 부대가 칸으로 섭니다(6칸씩 두 줄 · 왼쪽부터). 칸을 누르면 그 유닛 하나를 봅니다. 고른 것에는 지도에서도 <b>선택 링</b>이 둘립니다.</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">데미지</span><span><b>데미지</b> — <b>준 데미지/입은 데미지</b>(체력+실드 점수 · 유닛과 건물을 합친 값)입니다. 여럿이 함께 잡아도 때린 만큼 갈려 K/D 보다 공정합니다. 천 단위는 12.3k 꼴. 팀전에서는 괄호에 지금까지 <b>우리 팀이 준(입은) 데미지 가운데 내 몫(%)</b>이 섭니다.</span></li>
        </ul>

      </section>

      
      <section id="guide-keys" className="scr-guide-sec">
        <span className="scr-guide-eyebrow">02</span>
        <h2 className="scr-guide-h2">PC 단축키</h2>
        <p className="scr-guide-lede">
          재생 화면에서 바로 먹습니다. <strong>스페이스</strong>와{" "}
          <strong>좌우 화살표</strong> 둘만 익혀도 대부분 됩니다.
        </p>

        <div className="scr-guide-keys">
          <span className="scr-guide-group">재생</span>
          <K keys={["Space"]} title="재생 / 일시정지" desc="끝까지 본 뒤에 누르면 처음부터 다시 돕니다."/>
          <K keys={["←", "→"]} title="되감기 / 빨리감기" desc="누르고 있으면 계속 감깁니다 — 떼면 그 자리에서 멈춥니다."/>
          <K keys={["Q", "E"]} title="배속 내리기 / 올리기"/>

          <span className="scr-guide-group">지도</span>
          <K keys={["W", "A", "S", "D"]} title="지도 움직이기" desc="누르고 있는 동안 계속 밀립니다."/>
          <K keys={["↑", "↓"]} title="확대 / 축소" desc="한 번에 한 칸씩, 마우스 휠로도 됩니다."/>

          <span className="scr-guide-group">장면</span>
          <K keys={["Z"]} title="장면 스크랩" desc="지금 장면을 제목 붙여 담습니다."/>
          <K keys={["X"]} title="장면 공유" desc="지금 장면의 링크를 공유 시트로 보냅니다(안 되면 링크 복사)."/>

          <span className="scr-guide-group">보기</span>
          <K keys={["B"]} title="전광판" desc="전광판 현황 켜기·끄기(이름만 ↔ 전체)."/>
          <K keys={["N"]} title="작은 지도 켜기 / 끄기" desc="전체화면일 때만. 도구 상자의 지도 단추와 같습니다."/>
          <K keys={["C"]} title="색 모드 바꾸기" desc="개인색 → 팀색 → 주인공색. 색 버튼과 같습니다."/>
          <K keys={["V"]} title="평면 ↔ 입체"/>
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
