/* 모델 z 좌표 코드모드 — 빌더·헬퍼 소스의 **z 자리 숫자를 k배로 접어 쓴다**(요청: "근본 원시값을 수정").
 *
 *   node scripts/model-z-scale.mjs --k 0.8 [--file src/components/replay/bake9.ts] [--dry] [--report out.txt]
 *
 * 어느 식이 z인가는 도형 함수의 **인자 자리**에서 시작한다(shapeOblique·bake9의 함수 선언에서 z·z0·cz·bz·tz·h·hh·dz…
 * 이름의 매개변수, `[number,number,number]` 점 튜플의 셋째, 옵션 객체의 z0·h, path가 내는 점의 셋째). 그 자리의 식을
 * 재귀로 접는다: 리터럴은 값을 k배, 합·차는 양쪽, 곱은 리터럴 쪽만, 지역 상수는 z에서만 쓰이면 선언을 접고 x·y와
 * 나눠 쓰면 z용 쌍둥이 상수(NAMEz9)를 만든다, 지역 함수는 호출 자리가 전부 z면 return을 접고 y·z 겸용이면 선형·동차일
 * 때 인자를 접는다. 그래도 못 접는 식(헬퍼 안에서 반지름이 높이 노릇을 하는 `z + r` 따위)은 `* k`로 감싸고 보고에 적는다.
 * 검산은 scripts/model-faces-snap.mjs(원본 + withModelZ(k) 정답 vs 고친 소스). */
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const has = (n) => argv.includes(n);
const K = Number(flag("--k", 0.8));
const FILE = join(ROOT, String(flag("--file", "src/components/replay/bake9.ts")));
const SIG_FILES = ["src/utils/shapeOblique.ts", "src/components/replay/bake9.ts"].map((f) => join(ROOT, f));
const DRY = has("--dry");
/** ★ **자리를 좁혀 접는다**(2026-09, 요청: "모델의 초기값 자체를 새로 옮겨서 생성") —
 *  `--only 이름1,이름2` 를 주면 그 이름의 **선언 안에 든 편집만** 쓴다. 종류 몇만 키를
 *  고칠 때, 파일 전체를 접으면 안 되기 때문이다. 이름은 빌더 속성(gunner…)·함수 선언
 *  (suitLegs…)·모듈 상수(SUIT_TORSO_Z0…) 셋 다 받는다.
 *  ⚠ 쌍둥이 선언(NAMEz9)은 원 선언문 **뒤**에 붙으므로 그 선언도 --only 에 넣어야 한다. */
const ONLY = flag("--only", null) ? new Set(String(flag("--only")).split(",")) : null;

const Z_NAMES = new Set(["z", "z0", "z1", "z2", "z3", "z9", "zt", "zt9", "zb", "zc", "cz", "cz9", "bz", "bz9", "tz", "tz9", "gz", "gz9",
  "zA", "zB", "zTop", "zBot", "h", "h9", "hh", "hh9", "height", "dz", "dz9", "lift", "lift9", "rz", "rz9", "zLo", "zHi", "zoff", "dzc", "zc9", "hz9", "zBase", "zRoot9", "zTip9", "zT", "zB", "zd9", "zm9", "zTop9", "zBot9"]);
const NOT_POINT = new Set(["up", "dir", "ref", "axis", "n", "normal", "dirs", "nrm"]);
const SKIP_FN = new Set(["lodSetZoom", "lodOf", "lodFilter", "setPitchSquash", "withModelScale", "withModelZ", "tagKey", "tagDepth", "depthNow", "boxFaces", "cylinderFaces"]);
const HOMOG = new Set(["Math.min", "Math.max", "Math.abs", "Math.hypot"]);
/** 순수 기하 커널 — 본문의 리터럴은 방향 벡터·비율이라 안 건드린다(입력은 호출 자리에서 접힌다). */
const KERNEL_FN = new Set(["spirePillar", "tangentAt", "jointBetween", "footAt9", "tuckAt9", "faceGrain9", "pathBox", "widthCurve", "bezier3", "lerp3"]);
function inKernel(n) { let p = n; while (p) { if (ts.isFunctionDeclaration(p) && p.name && KERNEL_FN.has(p.name.text)) return true; if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name) && KERNEL_FN.has(p.parent.name.text)) return true; p = p.parent; } return false; }
/** 값이 이미 '판의 z'인 함수 — 사영 보정(관 축 들기)·기하 무관 값. 접지 않는다. */
const ZVAL_FN = new Set(["tubeAxisLift", "suitShoulderZ"]);

const typeText = (t) => (t ? t.getText().replace(/\s+/g, "").replace(/readonly/g, "") : "");
const isPointType = (t) => t === "[number,number,number]" || t === "Pt3";
const isPointArrType = (t) => t === "[number,number,number][]" || t === "([number,number,number])[]" || t === "Pt3[]";
const isSegArrType = (t) => t === "Seg3[]" || t === "(Seg3)[]";

/* ── 1. 함수 서명표 — 이름 → z 자리 ──────────────────────────────────────── */
function sigOf(name, params) {
  const s = { name, z: new Set(), pt: new Set(), ptArr: new Set(), seg: new Set(), optZ: new Set(), optPath: new Set(), opt: new Set(), n: params.length };
  params.forEach((p, i) => {
    const pn = p.name.getText();
    const tt = typeText(p.type);
    if (ts.isIdentifier(p.name)) {
      if (Z_NAMES.has(pn)) s.z.add(i);
      else if (!NOT_POINT.has(pn) && isPointType(tt)) s.pt.add(i);
      else if (isPointArrType(tt)) s.ptArr.add(i);
      else if (isSegArrType(tt)) s.seg.add(i);
      else if (p.type && ts.isTypeLiteralNode(p.type)) {
        s.opt.add(i);
        for (const m of p.type.members) {
          if (!ts.isPropertySignature(m) || !m.name) continue;
          const mn = m.name.getText();
          if (Z_NAMES.has(mn)) s.optZ.add(mn);
          else if (m.type && ts.isFunctionTypeNode(m.type) && isPointType(typeText(m.type.type))) s.optPath.add(mn);
        }
      }
    } else if (ts.isArrayBindingPattern(p.name) && isPointType(tt)) s.pt.add(i);
  });
  return s;
}
const SIGS = new Map();     // 이름 → sig — shapeOblique 의 export 만(bake9 안의 함수는 선언 노드로 푼다)
const SIG_NODE = new Map(); // 함수 노드 → sig
const sigWarn = [];
function collectSigs(sf, byName) {
  const visit = (n) => {
    let name = null; let params = null; let fn = null;
    if (ts.isFunctionDeclaration(n) && n.name) { name = n.name.text; params = n.parameters; fn = n; }
    else if (ts.isVariableDeclaration(n) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) && ts.isIdentifier(n.name)) { name = n.name.text; params = n.initializer.parameters; fn = n.initializer; }
    if (name && params && !SKIP_FN.has(name)) {
      const s = sigOf(name, params);
      SIG_NODE.set(fn, s);
      if (byName && n.parent && ts.isSourceFile(n.parent.parent ?? n.parent) || (byName && ts.isFunctionDeclaration(n) && ts.isSourceFile(n.parent))) SIGS.set(name, s);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
/** 호출 자리의 서명 — 지역/파일 선언이면 그 노드의 것, 아니면(import) 이름표. */
function sigAt(call) {
  const cal = call.expression;
  if (ts.isIdentifier(cal)) {
    const d = resolve(cal);
    if (d) {
      const fn = fnOfDecl(d); if (!fn) return null;
      let s0 = SIG_NODE.get(fn);
      if (!s0) { s0 = sigOf(cal.text, fn.parameters); SIG_NODE.set(fn, s0); }
      const extra = fn.parameters.map((p, i) => (DECIDE.zParam.has(p) ? i : -1)).filter((i) => i >= 0);
      if (!extra.length) return s0;
      return { ...s0, z: new Set([...s0.z, ...extra]) };
    }
    return SIGS.get(cal.text) ?? null;
  }
  return null;
}

/* ── 2. 스코프·선언 ──────────────────────────────────────────────────────── */
const isScope = (n) => ts.isSourceFile(n) || ts.isBlock(n) || ts.isFunctionLike(n) || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isCatchClause(n) || ts.isCaseBlock(n);
const scopeDecls = new Map();   // scopeNode → Map<name, declNode>
function declare(scope, name, node) {
  let m = scopeDecls.get(scope); if (!m) { m = new Map(); scopeDecls.set(scope, m); }
  if (!m.has(name)) m.set(name, node);
}
function scopeOf(n) { let p = n.parent; while (p && !isScope(p)) p = p.parent; return p; }
function bindNames(pattern, decl, scope) {
  if (ts.isIdentifier(pattern)) declare(scope, pattern.text, decl);
  else if (ts.isArrayBindingPattern(pattern) || ts.isObjectBindingPattern(pattern)) {
    for (const el of pattern.elements) if (ts.isBindingElement(el)) bindNames(el.name, el, scope);
  }
}
function collectDecls(sf) {
  const visit = (n) => {
    if (ts.isVariableDeclaration(n)) {
      // for-of·for 의 선언은 그 루프가 스코프, 나머지는 감싼 블록
      let s = n.parent && n.parent.parent && (ts.isForOfStatement(n.parent.parent) || ts.isForStatement(n.parent.parent) || ts.isForInStatement(n.parent.parent)) ? n.parent.parent : scopeOf(n);
      bindNames(n.name, n, s);
    } else if (ts.isParameter(n)) {
      bindNames(n.name, n, n.parent);
    } else if (ts.isFunctionDeclaration(n) && n.name) declare(scopeOf(n), n.name.text, n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
function resolve(id) {
  const name = id.text;
  let p = id.parent;
  while (p) { if (isScope(p)) { const m = scopeDecls.get(p); if (m && m.has(name)) return m.get(name); } p = p.parent; }
  return null;
}
const isRef = (id) => {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isPropertyAssignment(p) && p.name === id) return false;
  if (ts.isVariableDeclaration(p) && p.name === id) return false;
  if (ts.isParameter(p) && p.name === id) return false;
  if (ts.isBindingElement(p) && p.name === id) return false;
  if (ts.isFunctionDeclaration(p) && p.name === id) return false;
  if (ts.isPropertySignature(p) || ts.isMethodSignature(p)) return false;
  if (ts.isShorthandPropertyAssignment(p)) return true;
  if (ts.isTypeReferenceNode(p) || ts.isTypeQueryNode(p)) return false;
  return true;
};

/* ── 3. 분석 ─────────────────────────────────────────────────────────────── */
const num = (n) => ts.isNumericLiteral(n) ? Number(n.text)
  : (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) ? -Number(n.operand.text)
  : (ts.isParenthesizedExpression(n) ? num(n.expression) : null);
const fmt = (v) => { const s = Number((v).toFixed(4)).toString(); return s; };
const fnOfDecl = (d) => {
  if (ts.isFunctionDeclaration(d)) return d;
  if (ts.isVariableDeclaration(d) && d.initializer) {
    const init = unparen(d.initializer);
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
    // 공장: const up9 = up9For(m8) — 공장의 return 이 화살표 함수면 그것이 up9 다
    if (ts.isCallExpression(init) && ts.isIdentifier(init.expression)) {
      const fd = resolve(init.expression); const fact = fd && fnOfDecl(fd);
      if (fact) { const rets = returnsOf(fact); const r = rets.length === 1 ? unparen(rets[0]) : null; if (r && (ts.isArrowFunction(r) || ts.isFunctionExpression(r))) return r; }
    }
  }
  return null;
};
/** 지역 함수의 return 식들(화살표 식 본문이면 그 식). */
function returnsOf(fn) {
  const out = [];
  if (!ts.isBlock(fn.body)) { out.push(fn.body); return out; }
  const visit = (n) => { if (ts.isFunctionLike(n) && n !== fn) return; if (ts.isReturnStatement(n) && n.expression) out.push(n.expression); ts.forEachChild(n, visit); };
  visit(fn.body);
  return out;
}
const unparen = (e) => (ts.isParenthesizedExpression(e) ? unparen(e.expression) : (ts.isAsExpression(e) || ts.isTypeAssertionExpression(e) || ts.isSatisfiesExpression?.(e)) ? unparen(e.expression) : e);
/** 선형·동차인가 — return 이 매개변수들의 1차 결합(상수항 없음). lp = a + (b−a)·t 꼴. */
function isHomog(fn) {
  const params = new Set(fn.parameters.map((p) => p.name.getText()));
  const rets = returnsOf(fn); if (rets.length !== 1) return false;
  const lin = (e) => { // 매개변수에 대해 1차이고 상수항이 없는가
    e = unparen(e);
    if (ts.isIdentifier(e)) return params.has(e.text) ? 1 : 0;   // 1: 매개변수 항, 0: 상수(계수)
    if (ts.isNumericLiteral(e)) return 0;
    if (ts.isPrefixUnaryExpression(e)) return lin(e.operand);
    if (ts.isBinaryExpression(e)) {
      const a = lin(e.left); const b = lin(e.right); if (a === null || b === null) return null;
      const op = e.operatorToken.kind;
      if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.MinusToken) return a === b ? a : null;   // 항 종류가 섞이면(상수+매개) 동차가 아니다
      if (op === ts.SyntaxKind.AsteriskToken) return a + b <= 1 ? a + b : null;
      if (op === ts.SyntaxKind.SlashToken) return b === 0 ? a : null;
      return null;
    }
    if (ts.isCallExpression(e)) return null;
    return null;
  };
  return lin(rets[0]) === 1;
}

const DECIDE = { zOnly: new Set(), fnZ: new Set(), fnPt: new Map(), twin: new Map(), twinFn: new Map(), elemZ: new Map(), zParam: new Set() };
let refs = { z: new Map(), all: new Map(), calls: new Map(), callsZ: new Map(), ptReq: new Map(), elemReq: new Map(), ptOf: new Set() };
const addSet = (m, k, v) => { let s = m.get(k); if (!s) { s = new Set(); m.set(k, s); } s.add(v); };
let mode = "analyze";   // "analyze" | "edit"
let edits = [];       // {start, end, text}
const wraps = [];       // 보고
let twinsOut = [];    // {declStmtEnd, text}
const sfRef = { sf: null };
const lineOf = (n) => sfRef.sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;

/** 식이 z값을 이미 지니는가(배수 안 걸어도 됨). */
function zlike(e) {
  e = unparen(e);
  if (ts.isIdentifier(e)) { const d = resolve(e); if (!d) return false; if (ts.isParameter(d) && ((ts.isIdentifier(d.name) && Z_NAMES.has(d.name.text)) || DECIDE.zParam.has(d))) return true; if (ts.isBindingElement(d)) return DECIDE.zOnly.has(d); if (ts.isVariableDeclaration(d)) return DECIDE.zOnly.has(d); return false; }
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) { if (ZVAL_FN.has(e.expression.text)) return true; const d = resolve(e.expression); const fn = d && fnOfDecl(d); return !!fn && DECIDE.fnZ.has(fn); }
  if (ts.isPrefixUnaryExpression(e)) return zlike(e.operand);
  if (ts.isElementAccessExpression(e)) return elemZlike(e);
  if (ts.isPropertyAccessExpression(e) && Z_NAMES.has(e.name.text)) return true;
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (k === ts.SyntaxKind.PlusToken || k === ts.SyntaxKind.MinusToken) return zlike(e.left) && zlike(e.right);
    if (k === ts.SyntaxKind.AsteriskToken) return (zlike(e.left) && !zlike(e.right)) || (zlike(e.right) && !zlike(e.left));
    if (k === ts.SyntaxKind.SlashToken) return zlike(e.left);
    return false;
  }
  if (ts.isConditionalExpression(e)) return zlike(e.whenTrue) && zlike(e.whenFalse);
  return false;
}
/** `p[2]`·`pts[i][2]` — 점(튜플) 매개변수·점 상수·점 return 값의 셋째는 z값이다. */
const isPointParam = (d) => ts.isParameter(d) && (isPointType(typeText(d.type)) || isPointArrType(typeText(d.type)));
function elemZlike(e) {
  const idx = num(e.argumentExpression);
  const base = unparen(e.expression);
  if (idx === 2 && ts.isIdentifier(base)) {
    const d = resolve(base);
    if (!d) return false;
    if (isPointParam(d) && isPointType(typeText(d.type))) return true;
    if (ts.isVariableDeclaration(d) && (isPointType(typeText(d.type)) || (DECIDE.elemZ.get(d)?.has(2)))) return true;
    if (ts.isBindingElement(d) && DECIDE.zOnly.has(d)) return true;
    return false;
  }
  if (idx === 2 && ts.isElementAccessExpression(base) && ts.isIdentifier(unparen(base.expression))) {
    const d = resolve(unparen(base.expression));
    return !!d && ((isPointParam(d) && isPointArrType(typeText(d.type))) || (ts.isVariableDeclaration(d) && isPointArrType(typeText(d.type))));
  }
  if (ts.isIdentifier(base)) { const d = resolve(base); return !!d && DECIDE.zOnly.has(d) && (DECIDE.elemZ.get(d)?.has("*") ?? false); }
  return false;
}
const text = (n) => n.getText();
function noteRefs(e) {
  const visit = (n) => {
    if (ts.isIdentifier(n) && isRef(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.expression === n) && !(ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken)) { const d = resolve(n); if (d && (ts.isVariableDeclaration(d) || ts.isBindingElement(d) || ts.isParameter(d))) addSet(refs.z, d, n); if (d) { const fn = fnOfDecl(d); if (fn && ts.isCallExpression(n.parent) && n.parent.expression === n) addSet(refs.callsZ, fn, n.parent); } }
    ts.forEachChild(n, visit);
  };
  visit(e);
}
/* ★ 못 접는 식은 **감싸지 않는다**(`* k`를 붙이지 않는다) — 헬퍼 안의 그런 식은 대개 이미 접힌 입력에서 나온 값이라
   (접선·내적·정규화) 배수를 또 걸면 기하가 깨진다(달걀·기둥이 축으로 무너졌다). 그대로 두고 보고에 적어 사람이 본다. */
function wrapText(e, t) {
  noteRefs(e);
  wraps.push(`${lineOf(e)}: ${t.replace(/\s+/g, " ").slice(0, 70)}`);
  return t;
}
/** z 자리의 식을 접은 글로 낸다(분석 모드에서는 요청만 쌓는다). */
function scaleZ(e0) {
  const e = e0;
  if (ts.isParenthesizedExpression(e)) return `(${scaleZ(e.expression)})`;
  if (ts.isAsExpression(e)) return `${scaleZ(e.expression)} as ${text(e.type)}`;
  const v = num(e);
  if (v !== null) return fmt(v * K);
  if (ts.isPrefixUnaryExpression(e)) {
    const op = ts.tokenToString(e.operator);
    return `${op}${scaleZ(e.operand)}`;
  }
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (k === ts.SyntaxKind.PlusToken || k === ts.SyntaxKind.MinusToken) return `${scaleZ(e.left)} ${e.operatorToken.getText()} ${scaleZ(e.right)}`;
    if (k === ts.SyntaxKind.AsteriskToken) {
      if (num(e.left) !== null) return `${scaleZ(e.left)} * ${text(e.right)}`;
      if (num(e.right) !== null) return `${text(e.left)} * ${scaleZ(e.right)}`;
      if (zlike(e.left)) return `${scaleZ(e.left)} * ${text(e.right)}`;
      if (zlike(e.right)) return `${text(e.left)} * ${scaleZ(e.right)}`;
      // 한쪽이 접을 수 있는 식(리터럴을 품은 곱·상수·동차 호출)이면 그쪽을 접는다
      if (foldable(e.left)) return `${scaleZ(e.left)} * ${text(e.right)}`;
      if (foldable(e.right)) return `${text(e.left)} * ${scaleZ(e.right)}`;
      return wrapText(e, text(e));
    }
    if (k === ts.SyntaxKind.SlashToken) return `${scaleZ(e.left)} / ${text(e.right)}`;
    if (k === ts.SyntaxKind.QuestionQuestionToken) return (foldable(e.left) || zlike(e.left)) && (foldable(e.right) || zlike(e.right)) ? `${scaleZ(e.left)} ?? ${scaleZ(e.right)}` : wrapText(e, `(${text(e)})`);
    return wrapText(e, text(e));
  }
  if (ts.isConditionalExpression(e)) return `${text(e.condition)} ? ${scaleZ(e.whenTrue)} : ${scaleZ(e.whenFalse)}`;
  if (ts.isCallExpression(e)) {
    const cal = text(e.expression);
    if (ZVAL_FN.has(cal)) return text(e);
    if (HOMOG.has(cal)) return `${cal}(${e.arguments.map((a) => (ts.isSpreadElement(a) ? wrapText(a, text(a)) : scaleZ(a))).join(", ")})`;
    if (ts.isIdentifier(e.expression)) {
      const d = resolve(e.expression); const fn = d && fnOfDecl(d);
      if (fn) {
        addSet(refs.callsZ, fn, e);
        if (DECIDE.fnZ.has(fn)) return text(e);                       // return 을 접는다(다른 자리)
        if (isHomog(fn)) return `${cal}(${e.arguments.map((a) => scaleZ(a)).join(", ")})`;
        if (DECIDE.twinFn.has(fn)) return `${DECIDE.twinFn.get(fn)}(${e.arguments.map((a) => text(a)).join(", ")})`;
      }
    }
    return wrapText(e, text(e));
  }
  if (ts.isPropertyAccessExpression(e) && Z_NAMES.has(e.name.text)) return text(e);
  if (ts.isIdentifier(e)) {
    const d = resolve(e);
    if (!d) return wrapText(e, text(e));
    if (ts.isParameter(d)) {
      if (ts.isIdentifier(d.name) && Z_NAMES.has(d.name.text)) return text(e);
      addSet(refs.z, d, e);
      if (DECIDE.zParam.has(d)) return text(e);
      return wrapText(e, text(e));
    }
    if (ts.isBindingElement(d)) { addSet(refs.z, d, e); return DECIDE.zOnly.has(d) ? text(e) : wrapText(e, text(e)); }
    if (ts.isVariableDeclaration(d)) {
      addSet(refs.z, d, e);
      if (DECIDE.zOnly.has(d)) return text(e);
      if (DECIDE.twin.has(d)) return DECIDE.twin.get(d);
      return wrapText(e, text(e));
    }
    return wrapText(e, text(e));
  }
  if (ts.isElementAccessExpression(e)) {
    if (elemZlike(e)) return text(e);
    const base = unparen(e.expression);
    if (ts.isIdentifier(base)) {
      const d = resolve(base);
      if (d && ts.isVariableDeclaration(d)) {
        const idx = num(e.argumentExpression);
        addSet(refs.elemReq, d, idx === null ? "*" : idx);
        if (idx === null) addSet(refs.z, d, base);   // 동적 색인은 배열 전체가 z여야 한다
        if (idx !== null && idx === 2 && DECIDE.elemZ.get(d)?.has(2)) return text(e);
        if (DECIDE.zOnly.has(d)) return text(e);
      }
    }
    return wrapText(e, text(e));
  }
  return wrapText(e, text(e));
}
/** 접을 수 있는 식인가(감싸기 없이) — 곱의 한쪽을 고를 때 쓴다. */
function foldable(e) {
  e = unparen(e);
  if (num(e) !== null) return true;
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (k === ts.SyntaxKind.PlusToken || k === ts.SyntaxKind.MinusToken) return foldable(e.left) && foldable(e.right);
    if (k === ts.SyntaxKind.AsteriskToken) return foldable(e.left) || foldable(e.right);
    if (k === ts.SyntaxKind.SlashToken) return foldable(e.left);
    return false;
  }
  if (ts.isPrefixUnaryExpression(e)) return foldable(e.operand);
  if (ts.isIdentifier(e)) { const d = resolve(e); return !!d && (DECIDE.zOnly.has(d) || DECIDE.twin.has(d) || (ts.isParameter(d) && ts.isIdentifier(d.name) && Z_NAMES.has(d.name.text))); }
  if (ts.isCallExpression(e)) { if (HOMOG.has(text(e.expression))) return e.arguments.every((a) => !ts.isSpreadElement(a) && foldable(a)); if (ts.isIdentifier(e.expression)) { const d = resolve(e.expression); const fn = d && fnOfDecl(d); return !!fn && (DECIDE.fnZ.has(fn) || isHomog(fn)); } return false; }
  return false;
}
/** 점 자리의 식 — 튜플 리터럴이면 셋째를, 호출이면 그 함수의 return 을, 식별자면 그 선언을 점으로 청한다. */
const retIsPtArr = (fn) => !!fn && !!fn.type && isPointArrType(typeText(fn.type));
function scalePoint(e) {
  if (inKernel(e)) return;
  const u = unparen(e);
  if (ts.isArrayLiteralExpression(u)) {
    // 원소가 배열이면 점이 아니라 점 배열이다
    if (u.elements.length && u.elements.every((x) => ts.isArrayLiteralExpression(unparen(x)) || (ts.isCallExpression(unparen(x))))) { scalePointArr(u); return; }
    if (u.elements.length >= 3) seedEdit(u.elements[2], "z");
    return;
  }
  if (ts.isCallExpression(u) && ts.isIdentifier(u.expression)) {
    const d = resolve(u.expression); const fn = d && fnOfDecl(d);
    if (fn) { addSet(refs.ptReq, fn, retIsPtArr(fn) ? "arr" : 2); return; }
  }
  { const cb = arrayCallback(u); if (cb) { for (const r of returnsOf(cb)) (retIsPtArr(cb) ? scalePointArr(r) : scalePoint(r)); return; } }
  if (ts.isIdentifier(u)) { const d = resolve(u); if (d && ts.isVariableDeclaration(d)) { addSet(refs.z, d, u); addSet(refs.elemReq, d, 2); return; } if (d && isPointParam(d)) return; if (d && ts.isBindingElement(d)) { addSet(refs.z, d, u); refs.ptOf.add(d); return; } }
  if (ts.isElementAccessExpression(u) && ts.isIdentifier(unparen(u.expression))) { const d = resolve(unparen(u.expression)); if (d && ts.isVariableDeclaration(d) && d.initializer) { addSet(refs.z, d, unparen(u.expression)); addSet(refs.elemReq, d, "pt*"); return; } if (d && isPointParam(d)) return; }
  if (ts.isCallExpression(u) && ts.isPropertyAccessExpression(u.expression)) return;   // o.path(t) 같은 속성 호출 — 값의 임자가 따로 접는다
  if (ts.isConditionalExpression(u)) { scalePoint(u.whenTrue); scalePoint(u.whenFalse); return; }
  wraps.push(`${lineOf(e)}: 점 자리 못 다룸 ${text(e).replace(/\s+/g, " ").slice(0, 60)} ← ${text(e.parent).replace(/\s+/g, " ").slice(0, 50)}`);
}
/** 배열을 낳는 호출(map · Array.from)의 콜백 — 원소를 내는 return 들. */
function arrayCallback(u) {
  if (!ts.isCallExpression(u)) return null;
  const cal = u.expression;
  if (ts.isPropertyAccessExpression(cal) && cal.name.text === "map") { const cb = u.arguments[0]; if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) return cb; }
  if (ts.isPropertyAccessExpression(cal) && cal.name.text === "from" && ts.isIdentifier(cal.expression) && cal.expression.text === "Array") { const cb = u.arguments[1]; if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) return cb; }
  return null;
}
function scalePointArr(e) {
  if (inKernel(e)) return;
  const u = unparen(e);
  if (ts.isArrayLiteralExpression(u)) { for (const el of u.elements) { if (ts.isSpreadElement(el)) scalePointArr(el.expression); else scalePoint(el); } return; }
  const cb = arrayCallback(u);
  if (cb) { for (const r of returnsOf(cb)) scalePoint(r); return; }
  if (ts.isCallExpression(u) && ts.isIdentifier(u.expression)) { const d = resolve(u.expression); const fn = d && fnOfDecl(d); if (fn) { addSet(refs.ptReq, fn, "arr"); return; } }
  if (ts.isCallExpression(u) && ts.isPropertyAccessExpression(u.expression)) { const nm = u.expression.name.text; if (nm === "slice" || nm === "reverse" || nm === "concat" || nm === "filter") { scalePointArr(u.expression.expression); return; } }
  if (ts.isIdentifier(u)) { const d = resolve(u); if (d && ts.isVariableDeclaration(d) && d.initializer) { addSet(refs.z, d, u); addSet(refs.elemReq, d, "pt*"); return; } if (d && isPointParam(d)) return; }
  if (ts.isElementAccessExpression(u) && ts.isIdentifier(unparen(u.expression))) { const d = resolve(unparen(u.expression)); if (d && ts.isVariableDeclaration(d) && d.initializer) { addSet(refs.z, d, unparen(u.expression)); addSet(refs.elemReq, d, "ptArr*"); return; } }
  if (ts.isConditionalExpression(u)) { scalePointArr(u.whenTrue); scalePointArr(u.whenFalse); return; }
  wraps.push(`${lineOf(e)}: 점 배열 못 다룸 ${text(e).replace(/\s+/g, " ").slice(0, 60)}`);
}
/** 씨앗 편집 — z 자리 식 하나를 접어 편집 목록에 넣는다. */
const seeded = new Set();
function seedEdit(e, ctx) {
  if (inKernel(e)) return;
  if (ctx === "pt") return scalePoint(e);
  if (ctx === "ptArr") return scalePointArr(e);
  if (ctx === "seg") { const u = unparen(e); if (ts.isArrayLiteralExpression(u)) for (const s of u.elements) scalePointArr(s); else wraps.push(`${lineOf(e)}: 곡선 변 못 다룸`); return; }
  if (seeded.has(e)) return;
  // 배열 리터럴은 z 스칼라일 수 없다 — 점(3개)·점 배열로 돌린다(어느 규칙이 잘못 보냈는지는 보고에 적는다)
  { const u = unparen(e); if (ts.isArrayLiteralExpression(u)) { wraps.push(`${lineOf(e)}: 배열이 z 자리로 옴(점으로 처리) ${text(e).replace(/\s+/g, " ").slice(0, 50)}`); if (u.elements.length === 3 && u.elements.every((x) => !ts.isArrayLiteralExpression(unparen(x)))) scalePoint(u); else scalePointArr(u); return; } }
  seeded.add(e);
  const t = scaleZ(e);
  if (mode === "edit" && t !== text(e)) edits.push({ start: e.getStart(), end: e.getEnd(), text: t, line: lineOf(e) });
}

/** 호출 자리의 z 씨앗들 — 서명표로. */
function seedCalls(sf) {
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const sig = sigAt(n);
      if (sig) {
        let pos = 0;   // 스프레드를 편 뒤의 실제 인자 자리
        n.arguments.forEach((a) => {
          const i = pos;
          if (ts.isSpreadElement(a)) {
            // 점 스프레드(…up9(x,y,z) · …P) 는 (x,y,z) 세 자리를 먹는다 — 셋째 자리가 z 자리면 그 점을 접는다
            if (sig.z.has(i + 2)) scalePoint(a.expression);
            pos += 3; return;
          }
          pos += 1;
          if (sig.z.has(i)) seedEdit(a, "z");
          else if (sig.pt.has(i)) scalePoint(a);
          else if (sig.ptArr.has(i)) scalePointArr(a);
          else if (sig.seg.has(i)) seedEdit(a, "seg");
          else if (sig.opt.has(i) && ts.isObjectLiteralExpression(unparen(a))) {
            for (const p of unparen(a).properties) {
              if (!ts.isPropertyAssignment(p) || !p.name) continue;
              const pn = p.name.getText();
              if (sig.optZ.has(pn)) seedEdit(p.initializer, "z");
              else if (sig.optPath.has(pn)) { const f = unparen(p.initializer); if (ts.isArrowFunction(f) || ts.isFunctionExpression(f)) for (const r of returnsOf(f)) scalePoint(r); else if (ts.isIdentifier(f)) { const d = resolve(f); const fn = d && fnOfDecl(d); if (fn) addSet(refs.ptReq, fn, 2); } }
            }
          }
        });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const CMP = new Set([ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken]);
/** z양인가 — 이미 접힌 값(zlike)이거나 쌍둥이로 접힐 상수. 전파 판정용. */
function zq(e) {
  e = unparen(e);
  if (zlike(e)) return true;
  if (ts.isPrefixUnaryExpression(e)) return zq(e.operand);
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (k === ts.SyntaxKind.PlusToken || k === ts.SyntaxKind.MinusToken) return zq(e.left) && zq(e.right);
    if (k === ts.SyntaxKind.AsteriskToken) return (zq(e.left) && !zq(e.right)) || (zq(e.right) && !zq(e.left));
    if (k === ts.SyntaxKind.SlashToken) return zq(e.left) && !zq(e.right);
  }
  return false;
}
function propagate(sf) {
  const visit = (n) => {
    if (ts.isBinaryExpression(n)) {
      const k = n.operatorToken.kind;
      const inSeed = (x) => { let p = x; while (p) { if (seeded.has(p)) return true; p = p.parent; } return false; };
      if (!inSeed(n)) {
        if (k === ts.SyntaxKind.PlusToken || k === ts.SyntaxKind.MinusToken || CMP.has(k)) {
          const zl = zq(n.left); const zr = zq(n.right);
          if (zl && !zr && num(n.right) !== null) seedEdit(n.right, "z");
          else if (zr && !zl && num(n.left) !== null) seedEdit(n.left, "z");
          else if (zl !== zr) { const other = zl ? n.right : n.left; if (!ts.isCallExpression(unparen(other)) || HOMOG.has(text(unparen(other).expression))) seedEdit(other, "z"); }
        } else if (k === ts.SyntaxKind.SlashToken && zq(n.left) && !zq(n.right)) seedEdit(n.right, "z");
        else if (k === ts.SyntaxKind.SlashToken && zq(n.right) && !zq(n.left) && (num(n.left) !== null || foldable(n.left))) seedEdit(n.left, "z");
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
/** 모든 참조 세기(전체 참조 = z 참조이면 zOnly). */
function countAllRefs(sf) {
  const visit = (n) => {
    const isAssignLhs = ts.isIdentifier(n) && ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
    if (ts.isIdentifier(n) && isRef(n) && !isAssignLhs && !(ts.isPropertyAccessExpression(n.parent) && n.parent.expression === n)) { const d = resolve(n); if (d) { addSet(refs.all, d, n); const fn = fnOfDecl(d); if (fn && ts.isCallExpression(n.parent) && n.parent.expression === n) addSet(refs.calls, fn, n.parent); } }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
/** 결정 갱신 — 참조 집합에서 zOnly·fnZ·쌍둥이·원소 요청을 낸다. 바뀐 게 있으면 참. */
function decide() {
  let changed = false;
  const before = JSON.stringify([DECIDE.zOnly.size, DECIDE.twin.size, DECIDE.twinFn.size, DECIDE.fnZ.size, DECIDE.zParam.size, [...DECIDE.fnPt.values()].reduce((a, v) => a + v.size, 0), [...DECIDE.elemZ.values()].reduce((a, v) => a + v.size, 0)]);
  DECIDE.zOnly.clear(); DECIDE.twin.clear(); DECIDE.twinFn.clear(); DECIDE.fnZ.clear(); DECIDE.zParam.clear();
  for (const [d, zs] of refs.z) {
    if (ts.isVariableDeclaration(d) && fnOfDecl(d)) continue;   // 함수는 fnZ·twinFn 몫
    const all = refs.all.get(d) ?? new Set();
    const zOnly = [...all].every((r) => zs.has(r));
    if (ts.isParameter(d)) { if (zOnly && all.size > 0 && !DECIDE.zParam.has(d)) { DECIDE.zParam.add(d); changed = true; } continue; }
    const isConst = ts.isVariableDeclaration(d) && !!(d.parent.flags & ts.NodeFlags.Const) && !(d.parent.parent && ts.isForStatement(d.parent.parent));
    if (zOnly && all.size > 0 && !DECIDE.zOnly.has(d)) {
      // 접을 수 있는 선언인가(초기화식 있음)
      const init = ts.isVariableDeclaration(d) ? d.initializer : null;
      const bind = ts.isBindingElement(d);
      if (init || bind) { DECIDE.zOnly.add(d); DECIDE.twin.delete(d); changed = true; }
    } else if (!zOnly && isConst && d.initializer && !DECIDE.twin.has(d) && !refs.elemReq.has(d) && !DECIDE.zOnly.has(d)) {
      // x·y와 나눠 쓴다 — 쌍둥이(const 이고 초기화식이 접히는 것만)
      if (foldable(d.initializer) || num(d.initializer) !== null) { DECIDE.twin.set(d, `${d.name.getText()}z9`); changed = true; }
    }
  }
  for (const [fn, zc] of refs.callsZ) {
    const all = refs.calls.get(fn) ?? new Set();
    if ([...all].every((c) => zc.has(c))) { if (!DECIDE.fnZ.has(fn)) { DECIDE.fnZ.add(fn); changed = true; } }
    else if (!DECIDE.twinFn.has(fn) && !isHomog(fn) && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name) && !ts.isBlock(fn.body)) {
      // y·z 겸용 — return 이 전부 접히면 z용 쌍둥이 함수
      const rets = returnsOf(fn);
      if (rets.length && rets.every((r) => foldable(r))) { DECIDE.twinFn.set(fn, `${fn.parent.name.text}z9`); changed = true; }
    }
  }
  for (const [fn, idxs] of refs.ptReq) { const cur = DECIDE.fnPt.get(fn) ?? new Set(); for (const i of idxs) cur.add(i); DECIDE.fnPt.set(fn, cur); }
  for (const [d, idxs] of refs.elemReq) { const cur = DECIDE.elemZ.get(d) ?? new Set(); for (const i of idxs) cur.add(i); DECIDE.elemZ.set(d, cur); }
  const after = JSON.stringify([DECIDE.zOnly.size, DECIDE.twin.size, DECIDE.twinFn.size, DECIDE.fnZ.size, DECIDE.zParam.size, [...DECIDE.fnPt.values()].reduce((a, v) => a + v.size, 0), [...DECIDE.elemZ.values()].reduce((a, v) => a + v.size, 0)]);
  void changed;
  return before !== after;
}
/** 결정에 따른 2차 씨앗 — zOnly 선언의 초기화식, fnZ 의 return, 점 return 의 셋째, 원소 요청, 구조분해 근원. */
function seedDecided() {
  for (const d of DECIDE.zOnly) {
    if (ts.isVariableDeclaration(d) && d.initializer) {
      const el = DECIDE.elemZ.get(d);
      const init = unparen(d.initializer);
      if (el && ts.isArrayLiteralExpression(init)) {
        if (el.has("pt*")) for (const x of init.elements) scalePoint(x);
        else if (el.has("ptArr*")) for (const x of init.elements) scalePointArr(x);
        else if (el.has("*")) for (const x of init.elements) seedEdit(x, "z");
        else for (const i of el) {
          if (typeof i === "number") { if (init.elements[i]) seedEdit(init.elements[i], "z"); }
          else if (/^p\d+$/.test(i)) { const k = Number(i.slice(1)); if (init.elements[k]) scalePoint(init.elements[k]); }
          else if (i.startsWith("psub")) { const k = Number(i.slice(4)); for (const tup of init.elements) { const u = unparen(tup); if (ts.isArrayLiteralExpression(u) && u.elements[k]) scalePoint(u.elements[k]); } }
          else if (i.startsWith("sub")) { const k = Number(i.slice(3)); for (const tup of init.elements) { const u = unparen(tup); if (ts.isArrayLiteralExpression(u) && u.elements[k]) seedEdit(u.elements[k], "z"); } }
        }
      } else if (el) {
        // 원소 요청인데 리터럴 배열이 아니다 — 배열 호출이면 콜백 return, 호출/식별자면 점 요청으로
        const cb = arrayCallback(init);
        if (cb) { for (const r of returnsOf(cb)) { if (el.has("pt*")) (retIsPtArr(cb) ? scalePointArr(r) : scalePoint(r)); else if (el.has("ptArr*")) scalePointArr(r); else seedEdit(r, "z"); } }
        else if (el.has(2) || el.has("pt*")) scalePoint(init);
        else if (ts.isCallExpression(init) && ts.isIdentifier(init.expression)) { const sd = resolve(init.expression); const fn = sd && fnOfDecl(sd); if (fn) addSet(refs.callsZ, fn, init); else wraps.push(`${lineOf(d)}: 배열 상수 못 접음 ${d.name.getText()}`); }
        else wraps.push(`${lineOf(d)}: 배열 상수 못 접음 ${d.name.getText()}`);
      } else seedEdit(d.initializer, "z");
    } else if (ts.isBindingElement(d)) {
      // 구조분해 — 근원(초기화식 또는 for-of 반복 대상)의 그 원소가 z다
      const pat = d.parent; const idx = pat.elements.indexOf(d);
      const decl = pat.parent;   // VariableDeclaration
      const asPt = refs.ptOf.has(d);   // 이 바인딩은 z 스칼라가 아니라 **점**으로 쓰인다
      const doEl = (x) => (asPt ? scalePoint(x) : seedEdit(x, "z"));
      if (ts.isVariableDeclaration(decl)) {
        const src = decl.initializer ? unparen(decl.initializer) : null;
        const forOf = decl.parent && decl.parent.parent && ts.isForOfStatement(decl.parent.parent) ? decl.parent.parent : null;
        if (forOf) {
          const it = unparen(forOf.expression);
          if (ts.isArrayLiteralExpression(it)) { for (const tup of it.elements) { const u = unparen(tup); if (ts.isArrayLiteralExpression(u) && u.elements[idx]) doEl(u.elements[idx]); else wraps.push(`${lineOf(tup)}: for-of 튜플 못 접음`); } }
          else if (ts.isIdentifier(it)) { const sd = resolve(it); if (sd && ts.isVariableDeclaration(sd)) { addSet(refs.z, sd, it); addSet(refs.elemReq, sd, asPt ? `psub${idx}` : `sub${idx}`); } }
          else wraps.push(`${lineOf(forOf)}: for-of 대상 못 다룸`);
        } else if (src && ts.isArrayLiteralExpression(src)) { if (src.elements[idx]) doEl(src.elements[idx]); }
        else if (src && ts.isCallExpression(src) && ts.isIdentifier(src.expression)) { const sd = resolve(src.expression); const fn = sd && fnOfDecl(sd); if (fn) addSet(refs.ptReq, fn, asPt ? `p${idx}` : idx); else wraps.push(`${lineOf(src)}: 구조분해 근원 호출 못 다룸`); }
        else if (src && ts.isIdentifier(src)) { const sd = resolve(src); if (sd && ts.isVariableDeclaration(sd)) { addSet(refs.z, sd, src); addSet(refs.elemReq, sd, asPt ? `p${idx}` : idx); } }
        else wraps.push(`${lineOf(decl)}: 구조분해 근원 못 다룸`);
      }
    }
  }
  // 원소 요청이 있는데 zOnly 는 아닌 배열 상수(x·y 도 같은 배열에서 읽는다) — 리터럴 색인·sub 요청은 그 원소만 접는다
  for (const [d, idxs] of DECIDE.elemZ) {
    if (DECIDE.zOnly.has(d)) continue;
    const init = ts.isVariableDeclaration(d) && d.initializer ? unparen(d.initializer) : null;
    if (!init) continue;
    const subs = [...idxs].filter((i) => typeof i === "string" && i.startsWith("sub"));
    const psubs = [...idxs].filter((i) => typeof i === "string" && i.startsWith("psub"));
    const pl = [...idxs].filter((i) => typeof i === "string" && /^p\d+$/.test(i));
    const lits = [...idxs].filter((i) => typeof i === "number");
    if (ts.isArrayLiteralExpression(init)) {
      for (const s of subs) { const idx = Number(s.slice(3)); for (const tup of init.elements) { const u = unparen(tup); if (ts.isArrayLiteralExpression(u) && u.elements[idx]) seedEdit(u.elements[idx], "z"); } }
      for (const s of psubs) { const idx = Number(s.slice(4)); for (const tup of init.elements) { const u = unparen(tup); if (ts.isArrayLiteralExpression(u) && u.elements[idx]) scalePoint(u.elements[idx]); } }
      for (const s of pl) { const idx = Number(s.slice(1)); if (init.elements[idx]) scalePoint(init.elements[idx]); }
      for (const idx of lits) if (init.elements[idx]) seedEdit(init.elements[idx], "z");
      if (idxs.has("pt*")) for (const x of init.elements) scalePoint(x);
      if (idxs.has("ptArr*")) for (const x of init.elements) scalePointArr(x);
    } else if (idxs.has("ptArr*")) { const cb = arrayCallback(init); if (cb) for (const r of returnsOf(cb)) scalePointArr(r); else scalePointArr(init); }
    else if (lits.includes(2) || idxs.has("pt*")) {
      // 점 상수인데 리터럴이 아니다(호출·식별자) — 점 요청으로
      scalePoint(init);
    }
  }
  for (const p of DECIDE.zParam) if (p.initializer) seedEdit(p.initializer, "z");
  // zOnly 변수(let)에 대입되는 오른쪽도 z
  {
    const visit = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) {
        const d = resolve(n.left); if (d && DECIDE.zOnly.has(d)) seedEdit(n.right, "z");
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  for (const fn of DECIDE.fnZ) for (const r of returnsOf(fn)) seedEdit(r, "z");
  // (ii) 비-z 문맥의 전파 — z값과 +·−·비교·나눗셈으로 맞물린 반대쪽도 z양이다(`z / 6.4`, `z < DOME_Z`, `ez9 - 5.95`)
  propagate(sf);
  for (const [fn, idxs] of DECIDE.fnPt) for (const r of returnsOf(fn)) { for (const i of idxs) {
    if (i === "arr") { scalePointArr(r); continue; }
    const u = unparen(r);
    if (typeof i === "string" && i.startsWith("p")) { const k = Number(i.slice(1)); if (ts.isArrayLiteralExpression(u)) { if (u.elements[k]) scalePoint(u.elements[k]); } else wraps.push(`${lineOf(r)}: 점 배열 return 못 다룸`); continue; }
    if (ts.isArrayLiteralExpression(u)) { if (u.elements[i]) seedEdit(u.elements[i], "z"); } else if (i === 2) scalePoint(r); else wraps.push(`${lineOf(r)}: 점 return 못 다룸`); } }
}

/* ── 실행 ────────────────────────────────────────────────────────────────── */
collectSigs(ts.createSourceFile(SIG_FILES[0], readFileSync(SIG_FILES[0], "utf8"), ts.ScriptTarget.ES2020, true), true);
const src = readFileSync(FILE, "utf8");
const sf = ts.createSourceFile(FILE, src, ts.ScriptTarget.ES2020, true);
sfRef.sf = sf;
collectSigs(sf, false);
collectDecls(sf);
countAllRefs(sf);
// 분석 — 고정점까지
let prevZ = -1;
for (let round = 0; round < 12; round += 1) {
  seeded.clear(); wraps.length = 0;
  seedCalls(sf); seedDecided();
  seedDecided();
  const nz = [...refs.z.values()].reduce((a, v) => a + v.size, 0);
  const ch = decide();
  if (!ch && nz === prevZ && round > 1) break;
  prevZ = nz;
}
// 편집
mode = "edit"; seeded.clear(); wraps.length = 0; edits.length = 0;
seedCalls(sf); seedDecided(); seedDecided();
// 쌍둥이 선언 — 원 선언문 뒤에 붙인다
for (const [d, name] of DECIDE.twin) {
  const stmt = d.parent.parent;   // VariableStatement
  const t = scaleZ(d.initializer);
  const tt = d.type ? `: ${text(d.type)}` : "";
  twinsOut.push({ pos: stmt.getEnd(), text: ` const ${name}${tt} = ${t}; /* z용 쌍둥이(model-z-scale ×${K}) */` });
}
for (const [fn, name] of DECIDE.twinFn) {
  const d = fn.parent; const stmt = d.parent.parent;
  const rets = returnsOf(fn);
  if (!ts.isBlock(fn.body) && rets.length === 1) {
    const params = fn.parameters.map((p) => text(p)).join(", ");
    const rt = fn.type ? `: ${text(fn.type)}` : "";
    twinsOut.push({ pos: stmt.getEnd(), text: ` const ${name} = (${params})${rt} => ${scaleZ(rets[0])}; /* z용 쌍둥이 함수(model-z-scale ×${K}) */` });
  } else wraps.push(`${lineOf(fn)}: 쌍둥이 함수 본문이 블록이라 못 만듦 ${name}`);
}
// --only — 이름 붙은 선언의 자리 안에 든 편집만 남긴다
let spans = null;
if (ONLY) {
  spans = [];
  const walk = (n) => {
    let nm = null; let node = n;
    if (ts.isPropertyAssignment(n) && n.name) nm = n.name.getText();
    else if (ts.isFunctionDeclaration(n) && n.name) nm = n.name.text;
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) { nm = n.name.text; node = n.parent.parent; }
    if (nm && ONLY.has(nm)) spans.push([node.getStart(), node.getEnd()]);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  const miss = [...ONLY].filter((k) => !spans.length || !spans.some(() => true));
  console.log(`--only ${[...ONLY].join(",")} → 자리 ${spans.length}곳${miss.length ? " ⚠못 찾음 " + miss.join(",") : ""}`);
  const inSpan = (a, b) => spans.some(([s0, e0]) => a >= s0 && b <= e0);
  edits = edits.filter((e) => inSpan(e.start, e.end));
  twinsOut = twinsOut.filter((t) => inSpan(t.pos, t.pos));
}
// 겹치는 편집은 바깥 것만
edits.sort((a, b) => a.start - b.start || b.end - a.end);
const kept = [];
for (const e of edits) { const last = kept[kept.length - 1]; if (last && e.start < last.end) { if (e.end > last.end) console.warn(`겹침 ${e.line}`); continue; } kept.push(e); }
let out = src;
const all = [...kept.map((e) => ({ ...e, kind: "e" })), ...twinsOut.map((t) => ({ start: t.pos, end: t.pos, text: t.text, kind: "t" }))].sort((a, b) => b.start - a.start || (a.kind === "t" ? -1 : 1));
for (const e of all) out = out.slice(0, e.start) + e.text + out.slice(e.end);
if (flag("--why")) {
  const names = new Set(String(flag("--why")).split(","));
  for (const [d, all] of refs.all) {
    const nm = ts.isVariableDeclaration(d) || ts.isBindingElement(d) || ts.isParameter(d) ? d.name.getText() : (ts.isFunctionDeclaration(d) ? d.name?.text : "?");
    if (!names.has(nm)) continue;
    const zs = refs.z.get(d) ?? new Set();
    const non = [...all].filter((r) => !zs.has(r));
    console.log(`${nm}@${lineOf(d)} 참조 ${all.size} z ${zs.size} zOnly ${DECIDE.zOnly.has(d)} 쌍둥이 ${DECIDE.twin.get(d) ?? "-"} 비z: ${non.slice(0, 6).map((r) => `${lineOf(r)}:${text(r.parent).replace(/\s+/g, " ").slice(0, 50)}`).join(" | ")}`);
  }
}
const report = [
  `k=${K} 파일 ${FILE}`,
  `편집 ${kept.length}곳 · zOnly 선언 ${DECIDE.zOnly.size} · 쌍둥이 ${DECIDE.twin.size} · z-return 함수 ${DECIDE.fnZ.size} · 점-return 함수 ${DECIDE.fnPt.size}`,
  `감싼 식 ${wraps.length}:`, ...wraps.map((w) => "  " + w),
  ...(sigWarn.length ? ["서명 경고:", ...sigWarn.map((w) => "  " + w)] : []),
];
console.log(report.slice(0, 3).join("\n") + (wraps.length ? "\n" + wraps.slice(0, 40).map((w) => "  " + w).join("\n") + (wraps.length > 40 ? `\n  … ${wraps.length - 40}개 더` : "") : ""));
if (flag("--report")) writeFileSync(String(flag("--report")), report.join("\n"));
if (!DRY) { writeFileSync(FILE, out); console.log("썼다."); }
