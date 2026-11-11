/* ★ 꾸밈 날씨(2026-11-11, 요청: "꾸밈 요소로 비(+천둥번개)나 눈 내리는 효과(비는 배경 소리도)" → "추천대로 · 비는 꽤 자주 · 한 번 내릴 때 너무 짧지 않게 ·
   경기에 따라 무작위지만 같은 경기에선 늘 같은 현상" → "우주에서도 눈" → "눈 비 다 모든 맵에서 랜덤하게 · 한 경기엔 한 종류만").
   ── 일정은 **경기 열쇠(clockKey = 경기 번호)의 씨앗**으로 한 번 짠다: 종류(비 · 눈 하나) · 내림 토막(시작 · 끝 · 세기) · 번개 시각. 재생 시각의 함수라 되감기·탐색·다시 열기에도
   같은 자리에서 같은 날씨다. 그림은 화면 겹(RMP .scr-wx · CSS 무늬 흘리기 — 장마다 JS 가 칠하지 않는다) · 소리는 sfx9(setRain9 · thunderClap9). */

export type WxKind9 = "rain" | "snow";
export interface WxPlan9 {
  kind: WxKind9;
  /** 내림 토막 — 시작 · 끝(초) · 세기(0~1). */
  eps: { a: number; b: number; pk: number }[];
  /** 번개 시각(초 · 비만). */
  bolts: number[];
}

/** 문자열 → 32비트 씨앗(FNV-1a). */
function seed9(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** 씨앗 고정 난수(mulberry32). */
function rng9(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 비 55% · 눈 45%. 셋에 하나는 **처음부터** 내린다(첫 토막이 0초 전에 시작 · 2026-11-11, 요청: "시작부터 내리는 판도 있게") · 아니면 20초~2분 20초 사이에.
 *  토막 3~7분 · 사이 1.5~4.5분. 세기(양)는 토막마다 **가랑비 ~ 소나기**(0.15~1 · 한가운데가 두터운 고른 분포 · 같은 요청 "눈 비 양 랜덤하게") · 토막 안에서도 천천히 출렁인다(wxAt9).
 *  번개는 세기 0.45 넘는 비에서 12~40초마다(같은 요청 "번개 더 자주" · 옛: 0.65 넘음 · 25~80초). */
export function wxPlan9(key: string, total: number): WxPlan9 {
  const r = rng9(seed9(`wx|${key}`));
  const kind: WxKind9 = r() < 0.55 ? "rain" : "snow";
  const eps: WxPlan9["eps"] = [];
  const bolts: number[] = [];
  let t = r() < 0.34 ? -(WX_RAMP9 + 5 + r() * 60) : 20 + r() * 120;
  const end9 = Math.max(60, total);
  /* 양은 판 안에서도 갈린다 — 넷에 하나는 **늘 같은 양**(그 판의 한 값) · 나머지는 토막마다 새로(같은 요청 "같은 판 안에서도 다양할 수 있고 같을 수도 있고"). */
  const amt9 = (): number => 0.15 + 0.85 * ((r() + r()) / 2);
  const same9 = r() < 0.25 ? amt9() : -1;
  while (t < end9) {
    const dur = 180 + r() * 240;
    const pk = same9 >= 0 ? same9 : amt9();
    eps.push({ a: t, b: t + dur, pk });
    if (kind === "rain" && pk > 0.45) {
      let bt = Math.max(2, t + 8 + r() * 20);
      while (bt < t + dur - 10) { bolts.push(bt); bt += 12 + r() * 28 * (1.3 - pk); }
    }
    t += dur + 90 + r() * 180;
  }
  bolts.sort((x, y) => x - y);
  return { kind, eps, bolts };
}

/** 오르내림(초) — 토막 앞뒤로 이만큼 서서히. */
const WX_RAMP9 = 25;
/** 번개 번쩍임(초). */
const WX_FLASH9 = 0.7;

/** 그 시각의 세기(0~1) · 번쩍임(0~1) · 바로 앞 번개 시각(없으면 −1). 세기는 토막 안에서 ±20% 천천히 출렁인다(두 사인 · 토막마다 다른 위상). */
export function wxAt9(p: WxPlan9, t: number): { k: number; flash: number; bolt: number } {
  let k = 0;
  for (const e of p.eps) {
    if (t <= e.a || t >= e.b) continue;
    const ramp = Math.min(1, (t - e.a) / WX_RAMP9, (e.b - t) / WX_RAMP9);
    const ph = e.a * 0.37;
    const wob = 1 + 0.2 * (0.6 * Math.sin(t / 23 + ph) + 0.4 * Math.sin(t / 9.7 + ph * 2.1));
    k = Math.max(k, Math.min(1, e.pk * wob) * ramp * ramp * (3 - 2 * ramp));
  }
  let bolt = -1;
  for (const b of p.bolts) { if (b <= t) bolt = b; else break; }
  let flash = 0;
  if (bolt >= 0 && t - bolt < WX_FLASH9) {
    const s = (t - bolt) / WX_FLASH9;
    /* 두 번 번쩍(본 섬광 · 0.25 뒤 작은 섬광) */
    flash = Math.max(0, 1 - s * 4) + (s > 0.32 && s < 0.6 ? 0.55 * (1 - Math.abs(s - 0.42) / 0.18) : 0);
    flash = Math.min(1, Math.max(0, flash));
  }
  return { k, flash, bolt };
}

/** 무늬 판(데이터 주소) — 비: 비스듬한 줄기 · 눈: 부드러운 점. 한 번만 굽는다. */
let tiles9: { rain: string; snow: string } | null = null;
export function wxTiles9(): { rain: string; snow: string } | null {
  if (tiles9) return tiles9;
  if (typeof document === "undefined") return null;
  const S = 256;
  const mk = (): [HTMLCanvasElement, CanvasRenderingContext2D] | null => {
    const c = document.createElement("canvas"); c.width = S; c.height = S;
    const g = c.getContext("2d"); return g ? [c, g] : null;
  };
  const r = rng9(0x51a7);
  const a = mk(); const b = mk();
  if (!a || !b) return null;
  const [rc, rg] = a;
  rg.lineCap = "round";
  for (let i = 0; i < 64; i += 1) {
    const x = r() * S; const y = r() * S; const len = 12 + r() * 20; const al = 0.18 + r() * 0.32;
    rg.strokeStyle = `rgba(205,222,245,${al.toFixed(3)})`; rg.lineWidth = 0.8 + r() * 0.7;
    const dx = 0;   // 곧게 — 기울기는 겹 통째로 돌려 낸다(CSS .scr-wx-rain rotate · 흘림이 세로라 판 한 칸 밀면 이음매 없이 되풀이된다)
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {   // 판 끝을 넘는 줄은 맞은편에 이어 그려 이음매가 없다
      const x0 = x + ox; const y0 = y + oy;
      if (x0 + dx > S + 4 || x0 < -4 - Math.abs(dx) || y0 > S + 4 || y0 + len < -4) continue;
      rg.beginPath(); rg.moveTo(x0, y0); rg.lineTo(x0 + dx, y0 + len); rg.stroke();
    }
  }
  const [sc, sg] = b;
  for (let i = 0; i < 46; i += 1) {
    const x = r() * S; const y = r() * S; const rad = 1.1 + r() * 2.2; const al = 0.45 + r() * 0.5;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const x0 = x + ox; const y0 = y + oy;
      if (x0 < -rad || x0 > S + rad || y0 < -rad || y0 > S + rad) continue;
      const gr = sg.createRadialGradient(x0, y0, 0, x0, y0, rad);
      gr.addColorStop(0, `rgba(255,255,255,${al.toFixed(3)})`); gr.addColorStop(0.55, `rgba(240,246,255,${(al * 0.6).toFixed(3)})`); gr.addColorStop(1, "rgba(240,246,255,0)");
      sg.fillStyle = gr; sg.beginPath(); sg.arc(x0, y0, rad, 0, Math.PI * 2); sg.fill();
    }
  }
  tiles9 = { rain: rc.toDataURL("image/png"), snow: sc.toDataURL("image/png") };
  return tiles9;
}

/** 켬 · 끔(소리 목록의 '날씨' 줄 · 테스터만 · 기기에 저장 · 기본 끔). `#wx=0|1` 로 못 박는다. */
const WX_KEY9 = "scr.wx";
export function wxOnStored9(): boolean {
  if (typeof location !== "undefined") { const m = /(?:^|[#&,])wx=([01])/.exec(location.hash); if (m) return m[1] === "1"; }
  try { return localStorage.getItem(WX_KEY9) === "1"; } catch { return false; }   // 기본 끔(2026-11-11, 요청: "날씨는 테스트 기능으로만 켤 수 있게")
}
export function wxStore9(on: boolean): void { try { localStorage.setItem(WX_KEY9, on ? "1" : "0"); } catch { /* 사생활 모드 */ } }
