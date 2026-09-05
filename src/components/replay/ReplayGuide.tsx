import { Bookmark, Crosshair, Map as MapIcon, Maximize, Music, Palette, Play, Share2, Users, X } from "lucide-react";
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
            <li><span className="scr-guide-ic"><Share2 size={14}/></span><span><b>장면 공유</b> — 카톡으로 보냅니다(안 되면 링크 복사). 시각·자리·배율·각도까지 링크에 실립니다.</span></li>
          </ul>
        </div>

        <h3 className="scr-guide-h3">지도 오른쪽 아래 도구</h3>
        <p className="scr-guide-sub">
          지도 위에 떠 있는 동그란 버튼들입니다. 켜져 있으면 <strong>환하게</strong> 빛납니다.
        </p>
        <div className="scr-guide-mock">
          <div className="scr-guide-toolrow">
            <span className="scr-guide-mbtn"><Users size={18}/></span>
            <span className="scr-guide-mbtn"><MapIcon size={18}/></span>
            <span className="scr-guide-mbtn scr-guide-mbtn-txt">×2</span>
            <span className="scr-guide-mbtn scr-guide-mbtn-txt">8배</span>
            <span className="scr-guide-mbtn is-on"><Palette size={18}/></span>
            <span className="scr-guide-mbtn scr-guide-mbtn-txt">2D</span>
            <span className="scr-guide-mbtn"><Music size={18}/></span>
            <span className="scr-guide-mbtn"><Maximize size={18}/></span>
          </div>
          <ul className="scr-guide-legend">
            <li><span className="scr-guide-ic"><Users size={15}/></span><span><b>로스터</b> — 누를 때마다 <b>이름만 → 전체 → 숨김</b> 세 단으로 돕니다. 아이콘이 <b>사람+표</b>(<RosterTableIcon size={13}/>)로 바뀌면 APM 같은 지표까지 떠 있는 상태입니다.</span></li>
            <li><span className="scr-guide-ic"><MapIcon size={15}/></span><span><b>미니맵</b> — 전체 판을 한 눈에. 눌러서 그 자리로 바로 갑니다(전체화면에서 여닫습니다).</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">×2</span><span><b>배속</b> — 교전 하나를 뜯어볼 땐 낮추고, 초반 빌드를 넘길 땐 올립니다. <kbd>↑</kbd><kbd>↓</kbd>와 같습니다.</span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">8배</span><span><b>확대</b> — 지도는 그 배율로 매번 다시 그리므로 아무리 키워도 안 뭉개집니다.</span></li>
            <li><span className="scr-guide-ic"><Palette size={15}/></span><span><b>색</b> — <b>팀색</b>은 편을 가르고, <b>개인색</b>은 그 경기에서 각자가 쓰던 색입니다. <kbd>C</kbd></span></li>
            <li><span className="scr-guide-ic scr-guide-ic-txt">2D</span><span><b>보기</b> — 평면(2D)과 입체(3D)를 오갑니다. 언덕·램프는 입체에서 더 잘 읽힙니다. <kbd>V</kbd></span></li>
            <li><span className="scr-guide-ic"><Music size={15}/></span><span><b>음악</b> — 배경음악을 켜고 끕니다. <kbd>M</kbd></span></li>
            <li><span className="scr-guide-ic"><Maximize size={15}/></span><span><b>전체화면</b> — <kbd>Alt</kbd>+<kbd>Enter</kbd>와 같습니다. 안에서 <kbd>Enter</kbd>로 조작부를 감춥니다.</span></li>
          </ul>
        </div>

        <h3 className="scr-guide-h3">로스터에서 한 사람만 따라가기</h3>
        <p className="scr-guide-sub">
          재생 화면 옆 로스터에서 사람마다 버튼이 둘 붙습니다. 4:4처럼 사람이 많은 판을
          <strong> 한 사람 눈으로</strong> 다시 보는 길입니다.
        </p>

        <div className="scr-guide-mock">
          <div className="scr-guide-roster-mock">
            <span className="scr-guide-rbtn" aria-hidden="true"><Crosshair size={12}/></span>
            <span className="scr-guide-rbtn scr-guide-rbtn-face" aria-hidden="true">팍</span>
            <span className="scr-guide-rname">
              <i className="scr-guide-race scr-guide-race-p"/>팍규
            </span>
            <span className="scr-guide-rapm">187 APM</span>
          </div>
          <ul className="scr-guide-legend">
            <li>
              <span className="scr-guide-ic"><Crosshair size={14}/></span>
              <span><b>추적</b> — 그 사람의 <b>시야</b>로 밝히고, 그 사람이 <b>보고 있던 자리</b>로 화면이 따라갑니다.
              리플레이에는 카메라 좌표가 없어서, ‘방금 무엇을 집어 무엇을 시켰나’를 눈길로 삼습니다.</span>
            </li>
            <li>
              <span className="scr-guide-ic scr-guide-ic-txt">얼굴</span>
              <span><b>시점 보기</b> — 로스터의 <b>얼굴</b>을 누릅니다. 그 사람의 시야만 켜고 화면은 안 따라갑니다 —
              내가 보고 싶은 곳을 보면서 “저 사람 눈에는 지금 뭐가 보이나”만 겹쳐 볼 때 씁니다.</span>
            </li>
          </ul>
        </div>

        <div className="scr-guide-note">
          <b>추적을 켜면 시점도 같이 갑니다.</b> 남의 눈길을 따라가면서 지도는 내가 다 보고
          있으면, 그 사람이 왜 거기를 보는지가 안 읽히기 때문입니다. 끄면 둘 다 전체로 돌아옵니다.
        </div>

        
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
          <K keys={["2", "3"]} title="평면 / 입체"/>
          <K keys={["R"]} title="로스터" desc="이름만 → 전체 → 숨김 순으로 돕니다."/>
          <K keys={["T"]} title="팀색 ↔ 개인색"/>
          <K keys={["M"]} title="음악 켜기 / 끄기"/>

          <span className="scr-guide-group">창</span>
          <K keys={["Alt", "Enter"]} plus title="전체화면 들어가기 / 나가기"/>
          <K keys={["Enter"]} title="조작부 감추기 / 보이기" desc="전체화면일 때만. 지도를 넓게 볼 때 씁니다."/>
          <K keys={["Esc"]} title="닫기" desc="유닛 정보창이 열려 있으면 그것부터, 없으면 전체화면에서 나갑니다."/>
        </div>

        
      </section>

      <div className="scr-guide-back">
        
        <button type="button" className="scr-btn scr-btn-secondary" onClick={closeGuide}>
          닫기
        </button>
      </div>
    </div>);
}
