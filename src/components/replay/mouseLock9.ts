/* ★ **창모드 마우스 가두기**(2026-11-18, 요청: "피시 재생기 창모드, 전체화면 모두 엣지투스크롤 적용하고 창모드에선 견제연습실처럼 마우스 가두기" ·
 * "마우스 풀기 버튼 필요하긴 함" · "풀기 가두기 토글") ────────────────────────────────────────────────────────────────────────────
 *
 * 창모드에서는 마우스가 재생기 틀 밖으로 나가 버려 가장자리 밀기를 할 수 없다 — 연습실처럼 포인터 잠금(requestPointerLock)으로 커서를 가두고
 * **가짜 커서**를 그린다. 잠긴 동안 브라우저는 진짜 마우스 사건을 잠근 요소에만 보내고 clientX · Y 는 굳어 있으므로, 창 캡처 단계에서 진짜 사건을
 * 모두 삼키고 가짜 커서 자리의 요소에 **같은 사건을 다시 쏜다**(좌표 = 가짜 커서). React 는 뿌리에서 거품을 받으므로 지도 · 독 · 단추 · 재생바가
 * 그대로 돈다.
 *   - 누름 → 그 요소에 pointerdown · mousedown · 떼기/움직임은 **누른 요소에**(포인터 잡기 흉내) · 같은 요소 안에서 떼면 click(왼쪽) · auxclick.
 *   - 얹기 → 커서 아래 요소가 바뀌면 pointerout/over · mouseout/over(React 의 Enter/Leave 는 이 둘로 돈다). CSS :hover 는 흉내 못 낸다.
 *   - 휠 → 같은 자리의 wheel(페이지는 안 굴린다).
 *   - 미끄럼(range) → 값을 커서 x 로 적고 input · change 를 쏜다(가짜 사건은 손잡이를 안 끈다).
 *   - 잠긴 동안 setPointerCapture 는 InvalidStateError 를 던진다(명세) — 잠긴 동안만 잡기 셋을 조용히 비운다.
 * 전체화면은 안 가둔다(진짜 커서가 화면 끝에 닿는다 · 연습실과 같다) — 전체화면에 들면 푼다. Esc 는 브라우저가 푼다(가두기 켬은 그대로 · 지도를 다시 누르면 갇힌다).
 */

/** 가장자리 띠(px) — 가둔 커서가 틀 끝 2px 안이면 그쪽으로 민다(연습실 · 재생기 전체화면과 같다). */
export const MLOCK_EDGE9 = 2;
const KEY9 = "scr.mlock";
/** 갇힌 동안 삼키는 진짜 사건(가짜 커서가 같은 이름으로 다시 쏜다 · 얹기/떠남은 커서 아래가 바뀔 때 hoverTo 가). */
const SWALLOW9 = ["mousemove", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "pointerover", "pointerout", "pointerenter", "pointerleave", "mouseover", "mouseout", "mouseenter", "mouseleave"];

/** 가두기 켬 기억 — 손대지 않은 기기는 켬(요청이 가두기). "0" 이면 끔. */
export function mouseLockStored9(): boolean { try { return localStorage.getItem(KEY9) !== "0"; } catch { return true; } }
export function mouseLockStore9(on: boolean): void { try { localStorage.setItem(KEY9, on ? "1" : "0"); } catch { /* 사생활 모드 */ } }

export interface MouseLock9 {
  /** 지금 갇혔나. */
  locked(): boolean;
  /** 가짜 커서 자리(client px). */
  pos(): { x: number; y: number };
  /** 가장자리 방향(−1 · 0 · +1) — 갇힌 커서가 틀 끝 띠에 있으면. 화면을 그쪽으로 보낸다(오른쪽 끝이면 +1). */
  edgeDir(): [number, number];
  /** 진짜 누름 · 클릭(사용자 손짓) 안에서 부른다 — 그 자리부터 가둔다. press 참이면 누른 요소가 잠긴 뒤 떼기를 받는다(누르는 중에 갇힘). */
  request(e: MouseEvent, press?: boolean): void;
  /** 푼다. */
  release(): void;
  dispose(): void;
}

type Cap9 = { set: typeof Element.prototype.setPointerCapture; rel: typeof Element.prototype.releasePointerCapture; has: typeof Element.prototype.hasPointerCapture };

export function mouseLockInstall9(root: HTMLElement, onChange: (locked: boolean) => void): MouseLock9 {
  let vx = -1; let vy = -1;
  let lockedOn = false;
  let down: { el: Element; button: number; id: number; range: HTMLInputElement | null } | null = null;
  let pend: { el: Element; button: number; id: number; x: number; y: number; up: boolean } | null = null;
  let hover: Element | null = null;
  let cap: Cap9 | null = null;
  let edge: [number, number] = [0, 0];

  /* 가짜 커서 — body 에 붙인다(조상의 변환 · overflow 를 안 탄다). 연습실 커서와 같은 꼴(초록 화살 · 가장자리 화살). */
  const cur = document.createElement("div");
  cur.setAttribute("aria-hidden", "true");
  /* will-change — 제 합성 층(2026-11-19, 지적: "프레임모드에서 마우스 움직임이 좀 반응이 느린느낌") — 옮길 때 다시 칠하지 않고 합성만. */
  cur.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483647;display:none;will-change:transform;";
  cur.innerHTML = '<svg data-k="arrow" width="18" height="24" viewBox="0 0 18 24" style="position:absolute;left:0;top:0;overflow:visible;filter:drop-shadow(0 0 1px rgba(0,0,0,.8))"><path d="M1 1 L1 19 L6 14 L10 23 L13 22 L9 13 L16 13 Z" fill="#7dff8f" stroke="#04210a" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    + '<svg data-k="scroll" width="22" height="22" viewBox="0 0 22 22" style="position:absolute;left:-11px;top:-11px;overflow:visible;display:none;filter:drop-shadow(0 0 1px rgba(0,0,0,.8))"><path d="M21 11 L8 2 L8 7 L1 7 L1 15 L8 15 L8 20 Z" fill="#7dff8f" stroke="#04210a" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.appendChild(cur);
  const arrowEl = cur.children[0] as SVGElement; const scrollEl = cur.children[1] as SVGElement;

  /** 가두는 상자 — 뿌리 상자를 창으로 자른다(위로 굴린 페이지면 보이는 끝이 끝). ★ 미리 재 둔다(같은 날 "뚝뚝") — 움직임마다 getBoundingClientRect 는
   *  손짓 붓이 도는 동안 배치를 강제했다. 가둘 때 · 창 크기 · 굴림 · 0.5초마다만 다시 잰다. */
  let boxC = { l: 0, t: 0, r: 0, b: 0 }; let boxAt = -1e9;
  const measure = (): void => {
    const a = root.getBoundingClientRect();
    boxC = { l: Math.max(0, a.left), t: Math.max(0, a.top), r: Math.min(window.innerWidth, a.right) - 1, b: Math.min(window.innerHeight, a.bottom) - 1 };
    boxAt = performance.now();
  };
  const box = (): { l: number; t: number; r: number; b: number } => { if (performance.now() - boxAt > 500) measure(); return boxC; };
  const onResize = (): void => { boxAt = -1e9; };
  const paint = (): void => {
    if (!lockedOn) { cur.style.display = "none"; return; }
    const B = box();
    edge = [vx <= B.l + MLOCK_EDGE9 ? -1 : vx >= B.r - MLOCK_EDGE9 ? 1 : 0, vy <= B.t + MLOCK_EDGE9 ? -1 : vy >= B.b - MLOCK_EDGE9 ? 1 : 0];
    cur.style.display = "block";
    cur.style.transform = `translate(${vx}px, ${vy}px)`;
    const sc = edge[0] !== 0 || edge[1] !== 0;
    arrowEl.style.display = sc ? "none" : "block"; scrollEl.style.display = sc ? "block" : "none";
    if (sc) scrollEl.style.transform = `rotate(${Math.round((Math.atan2(edge[1], edge[0]) * 180) / Math.PI)}deg)`;
  };
  const under = (): Element | null => { const el = document.elementFromPoint(vx, vy); return el && el !== cur && !cur.contains(el) ? el : null; };

  const mouseInit = (src: MouseEvent, extra?: MouseEventInit): MouseEventInit => ({
    bubbles: true, cancelable: true, composed: true, view: window, clientX: vx, clientY: vy, screenX: vx, screenY: vy,
    button: src.button, buttons: src.buttons, ctrlKey: src.ctrlKey, shiftKey: src.shiftKey, altKey: src.altKey, metaKey: src.metaKey,
    movementX: src.movementX, movementY: src.movementY, detail: src.detail, ...extra,
  });
  const fire = (el: Element, type: string, src: MouseEvent, extra?: MouseEventInit): boolean => {
    const init = mouseInit(src, extra);
    const ev = type.startsWith("pointer")
      ? new PointerEvent(type, { ...init, pointerId: (src as PointerEvent).pointerId ?? 1, pointerType: "mouse", isPrimary: true, width: 1, height: 1, pressure: init.buttons ? 0.5 : 0 })
      : new MouseEvent(type, init);
    return el.dispatchEvent(ev);
  };
  /** 미끄럼(range) 값 — 커서 x 를 그 상자 안 몫으로. React 의 값 추적을 지나게 원래 setter 로 적는다. */
  const rangeSet = (r: HTMLInputElement, change: boolean): void => {
    const a = r.getBoundingClientRect(); if (a.width < 2) return;
    const lo = Number(r.min || 0); const hi = Number(r.max || 100); const st = r.step === "any" ? 0 : Number(r.step || 1);
    let v = lo + Math.max(0, Math.min(1, (vx - a.left) / a.width)) * (hi - lo);
    if (st > 0) v = lo + Math.round((v - lo) / st) * st;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(r, String(v)); else r.value = String(v);
    r.dispatchEvent(new Event("input", { bubbles: true }));
    if (change) r.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const hoverTo = (el: Element | null, src: MouseEvent): void => {
    if (el === hover) return;
    const old = hover; hover = el;
    if (old) { fire(old, "pointerout", src, { relatedTarget: el }); fire(old, "mouseout", src, { relatedTarget: el }); }
    if (el) { fire(el, "pointerover", src, { relatedTarget: old }); fire(el, "mouseover", src, { relatedTarget: old }); }
  };

  /** 갇힌 커서를 움직임만큼 옮긴다 — 틀 안으로 죈다(밖으로 민 몫은 안 쌓는다: 되돌리는 순간 곧장 끝에서 떨어진다). */
  const moveBy = (dx: number, dy: number): void => {
    /* 갇힌 뒤 첫 움직임에 크롬이 엉뚱하게 큰 movementX 를 싣는 일이 있다 — 그 한 번은 버린다(연습실과 같다). */
    if (Math.abs(dx) > 500 || Math.abs(dy) > 500) return;
    const B = box();
    vx = Math.max(B.l, Math.min(B.r, vx + dx)); vy = Math.max(B.t, Math.min(B.b, vy + dy));
    paint();
  };
  /* ★ 커서는 **날 사건**으로 옮긴다(2026-11-19, 지적: "프레임모드에서 마우스 움직임이 좀 반응이 느린느낌") — pointermove 는 화면 장에 맞춰 모아 오므로(rAF 정렬)
     무거운 장면에선 한두 장 늦게 왔다. pointerrawupdate(크롬 · 보안 문맥)는 오는 대로 온다 — 받는 기기면 움직임은 그쪽만 세고(겹셈 막기) pointermove 는 사건 다시 쏘기만. */
  let rawSeen = false;
  const onRaw = (e: PointerEvent): void => {
    if (!lockedOn || !e.isTrusted || e.pointerType !== "mouse") return;
    rawSeen = true;
    moveBy(e.movementX, e.movementY);
  };
  /* ── 진짜 사건 삼키기(창 캡처) — 갇힌 동안의 진짜 사건만. 우리가 쏜 사건(isTrusted 거짓)은 지나간다. ── */
  const onMove = (e: PointerEvent): void => {
    if (!lockedOn || !e.isTrusted) return;
    e.stopImmediatePropagation(); e.stopPropagation();
    if (!rawSeen) moveBy(e.movementX, e.movementY);
    const el = under();
    if (down) {
      if (down.range) rangeSet(down.range, false);
      fire(down.el, "pointermove", e); fire(down.el, "mousemove", e);
    } else {
      hoverTo(el, e);
      if (el) { fire(el, "pointermove", e); fire(el, "mousemove", e); }
    }
  };
  const onDown = (e: PointerEvent): void => {
    if (!lockedOn || !e.isTrusted) return;
    e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
    const el = under(); if (!el) return;
    const range = el instanceof HTMLInputElement && el.type === "range" ? el : null;
    down = { el, button: e.button, id: e.pointerId, range };
    fire(el, "pointerdown", e); fire(el, "mousedown", e);
    /* 글 칸은 누름으로 초점이 간다(가짜 누름은 초점을 안 옮긴다). */
    const fo = el.closest("input:not([type=range]),textarea,select,[contenteditable=true]") as HTMLElement | null;
    if (fo) fo.focus();
    if (range) rangeSet(range, false);
  };
  const onUp = (e: PointerEvent): void => {
    if (!lockedOn && pend && e.isTrusted) pend.up = true;   // 잠금이 서기 전에 뗐다 — 잠긴 뒤 그 누름을 이어받지 않는다
    if (!lockedOn || !e.isTrusted) return;
    e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
    const d = down; down = null;
    const el = under();
    if (!d) return;
    if (d.range) rangeSet(d.range, true);
    fire(d.el, "pointerup", e); fire(d.el, "mouseup", e);
    /* 클릭 — 누른 요소와 뗀 요소의 가장 가까운 공통 조상(브라우저와 같다). 왼쪽은 click · 그 밖은 auxclick. 오른쪽 차림표(contextmenu)는 안 쏜다(재생기는 막는다). */
    if (el) {
      let c: Element | null = d.el; while (c && !c.contains(el)) c = c.parentElement;
      if (c) fire(c, d.button === 0 ? "click" : "auxclick", e, { detail: 1 });
    }
    hoverTo(el, e);
  };
  const swallow = (e: Event): void => {
    if (!lockedOn || !e.isTrusted) return;
    e.stopImmediatePropagation(); e.stopPropagation();
    if (e.type === "contextmenu" || e.type === "mousedown" || e.type === "mouseup") e.preventDefault();
  };
  const onWheel = (e: WheelEvent): void => {
    if (!lockedOn || !e.isTrusted) return;
    e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
    const el = under(); if (!el) return;
    el.dispatchEvent(new WheelEvent("wheel", { ...mouseInit(e), deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode }));
  };

  /* 잡기 셋 — 잠긴 동안만 비운다(명세: 잠긴 문서의 setPointerCapture 는 InvalidStateError). */
  const capOff = (): void => {
    if (cap) return;
    const P = Element.prototype; cap = { set: P.setPointerCapture, rel: P.releasePointerCapture, has: P.hasPointerCapture };
    const c0 = cap;
    P.setPointerCapture = function (this: Element, id: number) { if (document.pointerLockElement) return; c0.set.call(this, id); };
    P.releasePointerCapture = function (this: Element, id: number) { if (document.pointerLockElement) return; c0.rel.call(this, id); };
    P.hasPointerCapture = function (this: Element, id: number) { if (document.pointerLockElement) return false; return c0.has.call(this, id); };
  };
  const capOn = (): void => {
    if (!cap) return;
    const P = Element.prototype; P.setPointerCapture = cap.set; P.releasePointerCapture = cap.rel; P.hasPointerCapture = cap.has; cap = null;
  };

  const onLock = (): void => {
    const on = document.pointerLockElement === root;
    if (on === lockedOn) return;
    lockedOn = on;
    if (on) {
      capOff(); measure();
      if (pend) { if (!pend.up) down = { el: pend.el, button: pend.button, id: pend.id, range: null }; pend = null; }
      window.addEventListener("wheel", onWheel, optA);   // 굴림을 막는 휠 듣기는 갇힌 동안만(안 갇힌 페이지 굴림을 늦추지 않게)
      const B = box(); vx = Math.max(B.l, Math.min(B.r, vx)); vy = Math.max(B.t, Math.min(B.b, vy));
      hover = under();
    } else {
      /* 누른 채 풀렸으면(Esc · 전체화면) 그 누름을 끝낸다 — 안 끝내면 지도 끌기 · 상자가 켜진 채 남는다. */
      if (down) {
        const d = down; down = null;
        const src = new PointerEvent("pointerup", { button: d.button, buttons: 0, pointerId: d.id });
        fire(d.el, "pointerup", src); fire(d.el, "mouseup", src);
      }
      hover = null; edge = [0, 0];
      window.removeEventListener("wheel", onWheel, optA);
      capOn();
    }
    paint();
    onChange(on);
  };
  const onLockErr = (): void => { pend = null; };
  const onFs = (): void => { if (document.fullscreenElement && document.pointerLockElement === root) document.exitPointerLock(); };

  const opt = { capture: true } as const;
  const optA = { capture: true, passive: false } as const;
  window.addEventListener("pointermove", onMove, opt);
  const rawOn = typeof window !== "undefined" && "onpointerrawupdate" in window;
  if (rawOn) window.addEventListener("pointerrawupdate" as "pointermove", onRaw, opt);
  window.addEventListener("pointerdown", onDown, opt);
  window.addEventListener("pointerup", onUp, opt);
  window.addEventListener("pointercancel", swallow, opt);
  for (const t of SWALLOW9) window.addEventListener(t, swallow, opt);
  document.addEventListener("pointerlockchange", onLock);
  document.addEventListener("pointerlockerror", onLockErr);
  document.addEventListener("fullscreenchange", onFs);
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onResize, { capture: true, passive: true });

  return {
    locked: () => lockedOn,
    pos: () => ({ x: vx, y: vy }),
    edgeDir: () => (lockedOn ? edge : [0, 0]),
    request(e: MouseEvent, press = true): void {
      if (lockedOn || document.fullscreenElement || !root.requestPointerLock) return;
      pend = { el: e.target as Element, button: e.button, id: (e as PointerEvent).pointerId ?? 1, x: e.clientX, y: e.clientY, up: !press };
      vx = e.clientX; vy = e.clientY;
      try { const r = root.requestPointerLock() as unknown; if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => { pend = null; }); } catch { pend = null; }
    },
    release(): void { if (document.pointerLockElement === root) document.exitPointerLock(); },
    dispose(): void {
      window.removeEventListener("pointermove", onMove, opt);
      if (rawOn) window.removeEventListener("pointerrawupdate" as "pointermove", onRaw, opt);
      window.removeEventListener("pointerdown", onDown, opt);
      window.removeEventListener("pointerup", onUp, opt);
      window.removeEventListener("pointercancel", swallow, opt);
      for (const t of SWALLOW9) window.removeEventListener(t, swallow, opt);
      window.removeEventListener("wheel", onWheel, optA);
      document.removeEventListener("pointerlockchange", onLock);
      document.removeEventListener("pointerlockerror", onLockErr);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, { capture: true } as EventListenerOptions);
      if (document.pointerLockElement === root) document.exitPointerLock();
      capOn();
      cur.remove();
    },
  };
}
