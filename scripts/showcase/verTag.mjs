/* 찍는 코드의 **버전 날짜**(2026-11-02, 요청: "비교샷 장면샷은 이름이나 폴더에 날짜(찍은 날짜 말고 버전날짜) 들어가게") —
 * 그 트리의 HEAD 커밋 날짜(서울 시각 · YYYYMMDD) + 짧은 해시 7자리. 커밋 안 한 손질이 있으면 해시 뒤에 "+" 를 붙인다(그 그림은 커밋에 없는 코드다). */
import { execFileSync } from "node:child_process";
export function verTag(dir, rev = "HEAD") {
  const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", env: { ...process.env, TZ: "Asia/Seoul" } }).trim();
  const date = git("log", "-1", "--date=format-local:%Y%m%d", "--format=%cd", rev);
  const hash = git("rev-parse", "--short=7", rev);
  let dirty = false;
  if (rev === "HEAD") { try { dirty = git("status", "--porcelain", "--untracked-files=no", "--", "src").length > 0; } catch { dirty = false; } }
  return { date, hash, dirty, tag: `${date}-${hash}${dirty ? "+" : ""}`, pretty: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` };
}
