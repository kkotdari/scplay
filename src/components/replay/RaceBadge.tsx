/* 종족 배지 — 패키지의 기본. setReplayChrome({ RaceBadge })로 갈아 끼울 수 있다.
   기본을 두는 까닭: 종족은 이 판의 알맹이라 아무 것도 안 꽂아도 보여야 하고, 이 구현은
   앱의 회원 개념을 하나도 안 쓰므로 들고 있어도 딸려 오는 것이 없다. */

const TONE: Record<string, { fg: string; ch: string }> = {
  테란: { fg: "#5aa9ff", ch: "T" },
  프로토스: { fg: "#ffd24a", ch: "P" },
  저그: { fg: "#c86bff", ch: "Z" },
  랜덤: { fg: "#9aa3ad", ch: "R" },
};

export default function ReplayRaceBadge({
  race, size = 14, circleLetter = false, className,
}: {
  race: string; size?: number; circleLetter?: boolean; className?: string;
}) {
  const t = TONE[race];
  if (!t) return null;                     // 종족을 못 읽은 판 — 아무 것도 안 그린다
  const px = `${size}px`;
  return (
    <span
      className={className}
      title={race}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: px, height: px, flex: "0 0 auto", boxSizing: "border-box",
        fontSize: `${Math.max(8, Math.round(size * 0.62))}px`, fontWeight: 800, lineHeight: 1,
        color: t.fg,
        border: circleLetter ? `1px solid ${t.fg}` : "none",
        borderRadius: "50%",
      }}
    >
      {t.ch}
    </span>
  );
}
