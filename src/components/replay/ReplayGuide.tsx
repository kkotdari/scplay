import { Bookmark, Map as MapIcon, Maximize, Music, Palette, Play, Share2, Tv, Users, X } from "lucide-react";
import RosterTableIcon from "./RosterTableIcon";
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

        <h3 className="scr-guide-h3">아래 재생부</h3>
        <p className="scr-guide-sub">
          진행바를 끌면 그 시각으로 갑니다. 그 옆의 두 버튼은 <strong>지금 이 장면</strong>을
          다루는 것들입니다 — <strong>스크랩</strong>은 나만 보게 담고,{" "}
          <strong>공유</strong>는 링크로 만들어 남에게 보냅니다. 둘 다 <b>같은 장면</b>을
          가리킵니다: 받은 사람이 열면 <b>같은 시각·같은 자리·같은 배율</b>에서 시작합니다.
          단, <b>중계를 켠 채</b> 보내면 자리 대신 <b>중계</b>(자동 또는 그 사람)가 실려, 받은 쪽도 같은 중계로 열립니다.
        </p>
        <div className="scr-guide-mock">
          <div className="scr-guide-bar">
            <span className="scr-guide-play" aria-hidden="true"><Play size={18} fill="currentColor"/></span>
            <span className="scr-guide-seek"/>
            <span className="scr-guide-time">12:04 / 31:12</span>
            <span className="scr-guide-tbtn" aria-hidden="true"><Bookmark size={15}/>장면 스크랩</span>
            <span className="scr-guide-tbtn scr-guide-tbtn-share" aria-hidden="true"><Share2 size={15}/>장면 공유</span>
          </div>
          <ul className="scr-guide-legend">
            <li><span className="scr-guide-ic"><Play size={14} fill="currentColor"/></span><span><b>재생 / 일시정지</b> — 스페이스와 같습니다. 끝까지 본 뒤 누르면 처음부터(↺).</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">↔</span><span><b>진행바</b> — 끌어서 원하는 시각으로. 좌우 화살표는 누르는 동안 계속 감깁니다.</span></li>
            <li><span className="scr-guide-ic"><Bookmark size={14}/></span><span><b>장면 스크랩</b> — 제목을 붙여 담아 둡니다. 담아 둔 장면은 <b>스크랩</b> 화면에서 다시 엽니다.</span></li>
            <li><span className="scr-guide-ic"><Share2 size={14}/></span><span><b>장면 공유</b> — 카톡으로 보냅니다(안 되면 링크 복사). 시각·자리·배율·각도까지 링크에 실립니다(중계 중이면 자리 대신 중계).</span></li>
          </ul>
        </div>

        <h3 className="scr-guide-h3">지도 오른쪽 아래 도구</h3>
        <p className="scr-guide-sub">
          지도 위에 떠 있는 동그란 버튼들입니다. 켜져 있으면 <strong>환하게</strong> 빛나고,
          <strong> 중계</strong>만은 켜진 동안 <strong>초록 테두리로 깜빡</strong>입니다.
        </p>
        <div className="scr-guide-mock">
          <div className="scr-guide-toolrow">
            <span className="scr-guide-mbtn scr-guide-mbtn-cast"><Tv size={18}/></span>
            <span className="scr-guide-mbtn"><Users size={18}/></span>
            <span className="scr-guide-mbtn scr-guide-mbtn-txt">×2</span>
            <span className="scr-guide-mbtn scr-guide-colsw is-personal"><Palette size={18}/></span>
            <span className="scr-guide-mbtn scr-guide-mbtn-txt">2D</span>
            <span className="scr-guide-mbtn"><Music size={18}/></span>
            <span className="scr-guide-mbtn"><Maximize size={18}/></span>
          </div>
          <ul className="scr-guide-legend">
            <li><span className="scr-guide-ic"><Tv size={15}/></span><span><b>중계</b> — 누르면 위로 목록이 펼쳐집니다: <b>사람 이름들 · 자동 · 끄기</b>. 아래 <b>중계 고르기</b>에서 자세히.</span></li>
            <li><span className="scr-guide-ic"><Users size={15}/></span><span><b>로스터</b> — 누를 때마다 <b>이름만 → 전체 → 숨김</b> 세 단으로 돕니다. 아이콘이 <b>사람+표</b>(<RosterTableIcon size={13}/>)로 바뀌면 일꾼·자원·인구·K/D·APM까지 떠 있는 상태입니다.</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">×2</span><span><b>배속</b> — 누르면 위로 목록(×1·×2·×4·×8)이 펼쳐집니다. 교전 하나를 뜯어볼 땐 낮추고, 초반 빌드를 넘길 땐 올립니다.</span></li>
            <li><span className="scr-guide-ic"><Palette size={15}/></span><span><b>색</b> — 누를 때마다 색 모드가 바뀝니다. 버튼 바탕이 곧 지금 모드입니다(아래 <b>색 모드</b>).</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">2D</span><span><b>보기</b> — 평면(2D)과 입체(3D)를 오갑니다. 언덕·램프는 입체에서 더 잘 읽힙니다. PC에만 있습니다.</span></li>
            <li><span className="scr-guide-ic"><Music size={15}/></span><span><b>음악</b> — 누르면 곡 목록이 펼쳐집니다. 고른 곡은 처음부터, 맨 위 '끄기'로 끕니다.</span></li>
            <li><span className="scr-guide-ic"><Maximize size={15}/></span><span><b>전체화면</b>. 전체화면에서는 <b>미니맵</b>(<MapIcon size={12}/>) 버튼도 함께 서서 작은 지도를 여닫습니다.</span></li>
          </ul>
        </div>

        <h3 className="scr-guide-h3">색 모드</h3>
        <p className="scr-guide-sub">
          색 버튼은 세 모드를 돕니다. <strong>주인공색</strong>은 중계가 켜져 있을 때만 고를 수 있고,
          중계를 끄면 <strong>개인색</strong>으로 돌아옵니다. 1:1·개인전에는 편이 없어 팀색을 건너뜁니다.
        </p>
        <ul className="scr-guide-legend">
          <li><span className="scr-guide-colsw scr-guide-colsw-s is-personal" aria-hidden="true"/><span><b>개인색</b>(기본) — 그 경기에서 각자가 쓰던 색입니다.</span></li>
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
          <li><span className="scr-guide-ic"><Tv size={15}/></span><span><b>중계</b>를 켜면 사람을 따라가며 알아서 당겨 놓습니다 — 그 뒤 손으로 바꾼 배율은 그대로 둡니다.</span></li>
        </ul>

        <h3 className="scr-guide-h3">중계 고르기</h3>
        <p className="scr-guide-sub">
          <strong>중계</strong> 버튼의 목록에서 <strong>누구 화면</strong>을 볼지 고릅니다. 들어오면 <strong>자동</strong>으로 켜져 있습니다.
          중계가 켜진 동안은 카메라를 중계가 쥐어, 지도를 손으로 끌어도 안 움직입니다(배율은 바꿀 수 있습니다).
        </p>
        <div className="scr-guide-mock">
          <div className="scr-guide-castlist" aria-hidden="true">
            <span className="scr-guide-castitem"><i className="scr-guide-castdot" style={{ background: "#2b62e8" }}/>정구</span>
            <span className="scr-guide-castitem"><i className="scr-guide-castdot" style={{ background: "#f88c14" }}/>팍규</span>
            <span className="scr-guide-castitem is-on">자동</span>
            <span className="scr-guide-castitem">끄기</span>
          </div>
          <ul className="scr-guide-legend">
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">이름</span>
              <span><b>한 사람</b> — 그 사람의 <b>시야</b>로 밝히고, 그 사람이 <b>보고 있던 자리</b>로 화면이 따라갑니다.
              리플레이에는 카메라 좌표가 없어서, ‘방금 무엇을 집어 무엇을 시켰나’를 눈길로 삼습니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic"><Tv size={14}/></span>
              <span><b>자동</b> — 지금 가장 볼 만한 사람에게 저절로 갑니다. 교전·견제·마법이 크게 벌어지는 쪽을 장면이
              시작되기 <b>조금 전에</b> 미리 잡아 두고, 일이 이어지면 8초가 넘어도 그 사람에 머뭅니다. 볼 만한 일이 없으면
              <b> 로스터 차례로 팀을 번갈아</b> 8초씩 돌아갑니다. 지도는 다 보이는 채로 카메라만 옮깁니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">끄기</span>
              <span><b>끄기</b> — 보던 자리에 그대로 멈추고 지도를 손으로 움직입니다. 시야도 전체로 돌아옵니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">이름</span>
              <span><b>시점 보기</b> — 로스터의 <b>이름</b>을 누릅니다. 그 사람의 시야만 켜고 화면은 안 따라갑니다 —
              내가 보고 싶은 곳을 보면서 “저 사람 눈에는 지금 뭐가 보이나”만 겹쳐 볼 때 씁니다.</span>
            </li>
          </ul>
        </div>

        <h3 className="scr-guide-h3">아래 인포창</h3>
        <p className="scr-guide-sub">
          지도 아래 가운데에 늘 떠 있는 창입니다. 오른쪽 위 <strong>▾</strong>로 접으면 맨 윗줄만 남습니다.
        </p>
        <ul className="scr-guide-legend">
          <li><span className="scr-guide-ic scr-guide-ic-txt">윗줄</span><span><b>사람 정보줄</b> — 중계 중에는 <b>지금 누구 화면</b>인지, 중계를 껐을 때는 <b>내가 고른 것의 주인</b>을 보여 줍니다. 팀·이름 옆에 <b>일꾼 · 자원(광물/가스) · 인구 · K/D · APM</b>이 섭니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">하나</span><span><b>유닛·건물 하나</b> — 지도에서 누르면 체력·실드·에너지, 처치 수, 업그레이드, 건물이면 생산 중인 유닛(진행 바 왼쪽)과 그 아래 대기 넷·연구·보급까지, 연구 건물이면 그 건물에서 하는 업그레이드가 칩으로 섭니다(마친 것은 밝게 · 공방은 단계 · 하는 중은 초록 테). 수송선·벙커는 탄 유닛이 칸으로 서고, 2칸짜리는 세로 두 칸 · 4칸짜리(탱크·드라군 같은)는 2×2 입니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">여럿</span><span><b>화면 주인의 선택</b> — 중계 중에 아무것도 안 눌렀으면, 그 사람이 지금 고른 부대가 칸으로 섭니다. 칸을 누르면 그 유닛 하나를 봅니다. 고른 것에는 지도에서도 <b>선택 링</b>이 둘립니다.</span></li>
          <li><span className="scr-guide-ic scr-guide-ic-txt">K/D</span><span><b>K/D</b> — 잡은 적 유닛 수 / 잃은 유닛 수입니다. 건물과 라바·알·인터셉터 같은 것은 안 셉니다.</span></li>
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
          <K keys={["B"]} title="로스터" desc="이름만 → 전체 → 숨김 순으로 돕니다."/>
          <K keys={["N"]} title="작은 지도 켜기 / 끄기" desc="전체화면일 때만. 오른쪽 아래 지도 단추와 같습니다."/>
          <K keys={["C"]} title="색 모드 바꾸기" desc="개인색 → 팀색 → 주인공색. 색 버튼과 같습니다."/>
          <K keys={["V"]} title="평면 ↔ 입체"/>
          <K keys={["M"]} title="음악 켜기 / 끄기"/>

          <span className="scr-guide-group">창</span>
          <K keys={["Alt", "Enter"]} plus title="전체화면 들어가기 / 나가기"/>
          <K keys={["F"]} title="조작부 감추기 / 보이기" desc="전체화면일 때만. 지도를 넓게 볼 때 씁니다."/>
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
