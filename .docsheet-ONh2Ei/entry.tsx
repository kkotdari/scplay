
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { SHAPE_GALLERY, DocIcon9, galleryYawOf, docAnimOf9, docCellsOf9, docCellBox9, DocTracer9, docWeaponOf9, shapeFitBox } from "/home/user/scplay/src/components/replay/ReplayMotionPlayer";
/* 트레이서 판(--tracer) — 한 발의 나이를 여섯 칸으로. */
window.__docTracer = (kinds) => {
  const host = document.getElementById("host");
  const rows = kinds.map((k) => SHAPE_GALLERY.find((g) => g.kind === k) || { kind: k, label: k, group: "유닛", race: "" });
  const list = h("div", { className: "scr-doc-list" }, rows.map((it) => {
    const st = docWeaponOf9(it.kind);
    return h("section", { key: it.kind, className: "scr-doc-item" }, [
      h("header", { key: "h", className: "scr-doc-itemhead" }, [
        h("h3", { key: "t" }, it.label),
        h("span", { key: "k", className: "scr-doc-kind" }, it.kind + " · " + (st || "무기 없음")),
      ]),
      h("div", { key: "a", className: "scr-doc-angles" }, [0.08, 0.24, 0.4, 0.56, 0.72, 0.88].map((u) =>
        h("div", { key: u, className: "scr-doc-angle" }, [
          st ? h(DocTracer9, { key: "m", kind: it.kind, t: u * 1.1, className: "scr-doc-svg" }) : null,
          h("span", { key: "d" }, "나이 " + u.toFixed(2)),
        ]))),
    ]);
  }));
  createRoot(host).render(h("div", { className: "scr-doc" }, list));
  return rows.length;
};
/* 도록 팝업 판(--anim) — **팝업이 세우는 그 칸들**(docCellsOf9)을 시각 몇 자리에서 뜬다.
   여기서 값을 손으로 못 박지 않는다: 못 박으면 팝업이 실제로 무엇을 보여 주는지가 아니라
   '이 파일이 무엇을 적어 두었나'를 보게 된다(그래서 코어 디스크가 쉬는 중에 도는 것도,
   성큰의 혓바닥이 안 나오는 것도 이 판으로는 안 보였다). */
/* --yaw N : 움직임 판의 요잉을 못 박는다(안 주면 갈래의 기준각) — 총구·표적의 방향 규약을 각마다 견줄 때 쓴다. */
window.__docAnim = (kinds, yawFix, tsFix) => {
  const host = document.getElementById("host");
  const rows = kinds.map((k) => SHAPE_GALLERY.find((g) => g.kind === k) || { kind: k, label: k, group: "건물", race: "" });
  const TS = tsFix && tsFix.length ? tsFix : [0.0, 0.35, 0.7, 1.15, 1.6, 2.3, 3.1, 4.4];
  const cellsOf = (kind, group) => {
    const yaw = yawFix === null || yawFix === undefined ? galleryYawOf(45, group) : yawFix;
    const out = [];
    /* ★ 창은 **scplay 가 낸다**(2026-09, 요청: 두 쪽 안 고치기) — 여기 있던 합집합 셈은
       앱 GalleryScreen 의 그것과 같은 코드였고, 칸에 무엇이 하나 늘 때마다 세 곳을 맞춰야
       했다. 이제 docCellBox9 한 문이 칸마다의 창을 내고(겹판·표적의 치우침까지 아울러),
       이 자는 그 표를 라벨로 찾아 쓰기만 한다. */
    const boxes = docCellBox9(kind, group);
    for (const t of TS) {
      for (const c of docCellsOf9(kind, t, yaw)) {
        const bx = boxes.get(c.label);
        out.push(h("div", { key: c.label + t, className: "scr-doc-angle" }, [
          /* ⚠ **앱과 같은 클래스여야 트레이서가 선다**(2026-09) — 줄기 캔버스의 자리·크기를
             주는 규칙이 scr-doc > scr-doc-popart > scr-doc-shot 하나인데, 이 자가 제
             (⚠ 이 파일의 이 몫은 템플릿 문자열 안이다 — 주석에 역따옴표를 쓰면 문자열이 끊긴다)
             클래스(scr-doc-svg)를 쓰고 있어 캔버스가 1×1 로 서 있었다(그림에 줄기가 아예
             안 보인 까닭이다). 앱이 쓰는 두 클래스를 그대로 쓴다. */
          h("div", { key: "a", className: "scr-doc-popart" }, [
            h(DocIcon9, {
              key: "m", kind: c.kind || kind, rotDeg: c.rotDeg ?? yaw, pose: c.pose, spin: c.spin,
              headDeg: c.headDeg, lit: c.lit, blink: c.blink, attach: c.attach, attachRot: c.attachRot, parts: c.parts,
              flat: true, fit: true, fitBox: bx, className: "scr-doc-svg", gl: !window.__doc2d,
            }),
            c.tracer ? h(DocTracer9, {
              key: "s", kind, t, overlay: true, box: bx, rotDeg: c.rotDeg ?? yaw,
              headDeg: c.headDeg ?? c.attachRot, tgt: c.tgt, tgtUp: c.tgtUp, fx: c.fx, air: c.air, className: "scr-doc-shot",
            }) : null,
          ]),
          h("span", { key: "d" }, c.label + (c.note ? " · " + c.note : "") + " · t" + t.toFixed(2)),
        ]));
      }
    }
    return out;
  };
  const list = h("div", { className: "scr-doc-list" }, rows.map((it) => h("section", { key: it.kind, className: "scr-doc-item" }, [
    h("header", { key: "h", className: "scr-doc-itemhead" }, [
      h("h3", { key: "t" }, it.label), h("span", { key: "k", className: "scr-doc-kind" }, it.kind),
    ]),
    h("div", { key: "a", className: "scr-doc-angles" }, cellsOf(it.kind, it.group)),
  ])));
  createRoot(host).render(h("div", { className: "scr-doc" }, list));
  return rows.length;
};
window.__docSheet = (group, race, rots, narrow, perRow) => {
  const rows = SHAPE_GALLERY.filter((g) => !g.hidden && g.group === group && (race === "전체" || g.race === race));
  const host = document.getElementById("host");
  /* 도록 화면(GalleryScreen)의 마크업 그대로다 — 고르기 줄과 돌아가기 버튼만 뺀다
     (그림에는 담을 것이 아니고, 담으면 종이의 절반을 먹는다). 괄호를 깊게 겹치지 않고
     한 칸씩 이름 붙여 짓는다 — 겹치면 닫는 수를 세다 틀린다(첫 판이 그랬다). */
  /* 각은 **갈래의 기준각**으로 옮겨 그린다(galleryYawOf) — 건물은 지도에서 각이 하나
     (40도)뿐이라 45 눈금을 그대로 쓰면 도록의 건물만 지도와 5도 어긋나 선다. 눈금 글자도
     옮긴 각을 적는다(그림과 숫자가 갈리면 도록이 거짓말을 한다).
     ★ flat(위에서 본 판)으로 굽는다 — 지도의 2D와 **같은 카메라**다(요청: "전부 2D 지도와
       같게"). 안 주면 도록 전용 투영(수직 26.8도)이라 같은 모델이 두 화면에서 다른 높이로
       보였다. */
  const angleCell = (kind, deg, group) => {
    const d9 = galleryYawOf(deg, group);
    return h("div", { key: deg, className: "scr-doc-angle" }, [
      h(DocIcon9, { key: "m", kind, rotDeg: d9, flat: true, fit: true, className: "scr-doc-svg", gl: !window.__doc2d }),
      h("span", { key: "d" }, d9 + "°"),
    ]);
  };
  const itemRow = (it) => h("section", { key: it.kind, className: "scr-doc-item" }, [
    h("header", { key: "h", className: "scr-doc-itemhead" }, [
      h("h3", { key: "t" }, it.label),
      it.race ? h("span", { key: "r", className: "scr-doc-race" }, it.race) : null,
      h("span", { key: "k", className: "scr-doc-kind" }, it.kind),
    ]),
    h("div", {
      key: "a",
      className: "scr-doc-angles" + (narrow ? " is-narrow" : "") + (perRow ? " is-2col" : ""),
    }, rots.map((d) => angleCell(it.kind, d, it.group))),
  ]);
  // 카드 판형(perRow) — 목록을 N 열 격자로 눕힌다(칸의 CSS 는 sheetCss 의 .is-cards 가 맡는다).
  const list = h("div", { className: "scr-doc-list" + (perRow ? " is-cards" : ""), style: perRow ? { "--cards": String(perRow) } : undefined }, rows.map(itemRow));
  createRoot(host).render(h("div", { className: "scr-doc" }, list));
  return rows.length;
};
