/** ── 사용법 단추의 얼굴 — **테두리 없는 물음표**(2026-09, 요청: "도움말 버튼 물음표 테두리 없는걸로") ─────
 *
 *  루시드의 CircleHelp 는 원 안의 물음표라 단추(동그란 우물) 안에서 원이 두 겹으로 섰다. 루시드에는 원 없는
 *  물음표가 없으므로 CircleHelp 의 물음표 두 획을 그대로 떼어 원이 차지하던 몫만큼(×1.5) 키워 가운데에 앉힌다.
 *  나머지 규격은 루시드 문법 그대로다(24×24 · 획 2 · 둥근 끝·이음 · 칠 없음). */
export default function QMarkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7.6 8.2a4.4 4.4 0 0 1 8.6 1.5c0 3-4.4 4.2-4.4 4.2" />
      <path d="M12 19h.01" strokeWidth={2.6} />
    </svg>
  );
}
