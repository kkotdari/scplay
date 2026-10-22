import type { ReactNode } from "react";
import { Map as MapIcon, Maximize, Palette, Play, Search, Share2, Tv, Video, Volume2, X } from "lucide-react";

/* ★ 사용법은 **기능마다 한 줄 · 그 이름 옆에 PC 단축키**(2026-10-22, 요청: "단축키를 각 기능 설명부에 통합 — 기능 옆에 단축키 · 내용 전체적으로 많이 간소화") —
   옛 두 절(01 화면 도구 · 02 PC 단축키)과 도구 상자·전광판 그림은 걷었다. */

/** 기능 이름 옆 단축키 — plus 면 함께 누르는 키(Alt + Enter). */
function Keys({ k, plus = false }: { k: string[]; plus?: boolean }) {
  return (
    <span className="scr-guide-k">
      {k.map((x, i) => (
        <span key={x}>
          {plus && i > 0 && <span className="scr-guide-plus">+</span>}
          <kbd>{x}</kbd>
        </span>
      ))}
    </span>
  );
}

/** 한 기능 — [그림 | 이름 · 단축키 — 설명]. 이름으로 충분한 기능은 설명 없이(같은 날 요청: "설명 필요 없는 기능은 기능 이름만으로 충분"). */
function Row({ ic, name, keys, children }: { ic: ReactNode; name: string; keys?: ReactNode; children?: ReactNode }) {
  return (
    <li>
      <span className="scr-guide-ic">{ic}</span>
      <span><b>{name}</b>{keys}{children && <> — {children}</>}</span>
    </li>
  );
}

const T = ({ s }: { s: string }) => <span className="scr-guide-ic-txt">{s}</span>;

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
        <h1 className="scr-title">재생기 사용법</h1>
        <p className="scr-guide-deck">경기를 실제로 다시 돌린 화면입니다. 기능 옆의 <kbd>키</kbd>는 PC 단축키입니다.</p>
      </header>

      <section className="scr-guide-sec">
        <h3 className="scr-guide-h3">재생</h3>
        <ul className="scr-guide-legend">
          <Row ic={<Play size={14} fill="currentColor"/>} name="재생 / 일시정지" keys={<Keys k={["Space"]}/>}/>
          <Row ic={<T s="↔"/>} name="진행바" keys={<Keys k={["←", "→"]}/>}/>
          <Row ic={<T s="×2"/>} name="배속" keys={<Keys k={["↑", "↓"]}/>}>지도 오른쪽 아래 다이얼.</Row>
          <Row ic={<T s="▼"/>} name="접기">버튼 줄 가운데 단추로 미니맵 · 인포창 · 전광판을 접습니다.</Row>
        </ul>

        <h3 className="scr-guide-h3">지도</h3>
        <ul className="scr-guide-legend">
          <Row ic={<T s="↔"/>} name="움직이기" keys={<Keys k={["W", "A", "S", "D"]}/>}>끌기.</Row>
          <Row ic={<T s="휠"/>} name="확대 / 축소" keys={<Keys k={["Q", "E"]}/>}>휠 · 핀치 · 두 번 누르기.</Row>
          <Row ic={<MapIcon size={15}/>} name="미니맵">누르면 그 자리로(중계 중에는 잠김).</Row>
        </ul>

        <h3 className="scr-guide-h3">중계 — 전광판의 카메라 단추</h3>
        <ul className="scr-guide-legend">
          <Row ic={<Tv size={14}/>} name="자동중계" keys={<Keys k={["."]}/>}>교전 · 견제 · 드랍 자리를 따라갑니다.</Row>
          <Row ic={<Video size={14}/>} name="한 사람" keys={<Keys k={["1~8", "−", "+"]}/>}>그 사람의 시야 · 보던 자리(숫자패드).</Row>
          <Row ic={<T s="전체"/>} name="여럿 · 전체" keys={<Keys k={["9"]}/>}>(PC) 화면을 나눠 봅니다.</Row>
          <Row ic={<T s="끔"/>} name="중계 끄기" keys={<Keys k={["0"]}/>}/>
        </ul>

        <h3 className="scr-guide-h3">도구</h3>
        <ul className="scr-guide-legend">
          <Row ic={<Palette size={15}/>} name="색" keys={<Keys k={["/"]}/>}>개인색 → 팀색 → 주인공색(중계 중).</Row>
          <Row ic={<T s="2D"/>} name="평면 / 입체" keys={<Keys k={["V"]}/>}/>
          <Row ic={<Volume2 size={15}/>} name="소리" keys={<Keys k={["M"]}/>}/>
          <Row ic={<Search size={15}/>} name="검색" keys={<><Keys k={["F"]}/><Keys k={["B", "N"]}/></>}>사람 · 유닛 · 전술로 장면 찾기(예: "정구 드랍") · B · N 이전 · 다음.</Row>
          <Row ic={<Share2 size={14}/>} name="장면 공유" keys={<Keys k={["X"]}/>}>지금 장면을 링크로.</Row>
          <Row ic={<Maximize size={15}/>} name="전체화면" keys={<><Keys k={["Alt", "Enter"]} plus/><Keys k={["Esc"]}/></>}/>
        </ul>

        <h3 className="scr-guide-h3">인포창</h3>
        <ul className="scr-guide-legend">
          <Row ic={<T s="하나"/>} name="유닛 · 건물">지도에서 누르면 상태 · 생산 · 연구를 보여 줍니다.</Row>
          <Row ic={<T s="딜"/>} name="데미지">준 / 입은 데미지 · 팀전은 팀 안 내 몫(%).</Row>
        </ul>
      </section>

      <div className="scr-guide-back">
        <button type="button" className="scr-btn scr-btn-secondary" onClick={closeGuide}>
          닫기
        </button>
      </div>
    </div>);
}
