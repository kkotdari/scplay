/* 7월 도록(사용자가 준 그림 셋)의 **행 차례 → 종류** 표 — 그림 차례 그대로다.
 * 마인·인터셉터·미네랄·간헐천처럼 지금 목록에 없는 종류도 그림에는 있으므로 자리를 지켜 적는다
 * (행 수가 어긋나면 july-cut·hist-compose 가 그 자리에서 터진다 — 그것이 검산이다).
 * hist-compose(합치는 자)와 july-cut(칸을 떼어 내는 자)이 나눠 쓴다. */
export const JULY_KINDS = {
  JT: ["scv","gunner","fbat","inf","vulture","mine","tank","tanksiege","goliath","wraith","dship","vessel","valk","bc",
       "tomb","comsat","nsilo","trapezoid","refinery","cube","ebay","tombFlat","academy","turret","factory","mshop","plane","ctower","armory","scifac","covert","physlab","scaffold"],
  JP: ["probe","zealot","goon","htemp","dtemp","archon","darchon","shuttle","reaver","observer","scout","corsair","carrier","interceptor","arbiter",
       "pyramidWide","diamond","assim","gate","forge","coil","sbattery","cyber","citadel","archives","dome","robobay","observatory","arch","fleetbeacon","tribunal","warpin"],
  JZ: ["drone","ovie","zling","hydra","lurker","muta","scourge","queen","ultra","defiler","guardian","devourer",
       "hatchery","lair","hive","creep","sunken","spore","extract","pool","evo","hydraden","spire","gspire","queensnest","nydus","cavern","dmound","cocoon","mineral","geyser"],
};
/** 그림 파일 이름(스크래치의 원본 시트) */
export const JULY_FILE = { JT: "july_t", JP: "july_p", JZ: "july_z" };
/** 칸 자 — 첫 칸(45° 자리)이 x 264 · 폭 200 · 높이 197 이고, 위·아래 3px 는 칸 판의 테두리 띠다. */
export const JULY_CELL = { x: 272, dy: 3, w: 192, h: 191, jc: 200 };
