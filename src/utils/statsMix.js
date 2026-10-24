// 통계 화면이 읽는 **생산 구성**의 꼴과, 그것을 그리는 데 필요한 것들.
// 값을 만드는 코드는 여기 없다 — 만드는 쪽은 참값이다.
//
// 예전에는 이 파일이 리플레이 커맨드를 세어 값을 **만들기까지** 했다(statsMix).
// 그 자는 셋을 못 했다: 저그 라바 다중 변태(커맨드 하나에 여러 마리라 적게 셌다),
// 취소·실패(눌렀으면 셌다), 크립 콜로니→성큰 승격(두 번 세거나 한 번 세거나가 자의적).
// 이제 값은 OpenBW가 그 경기를 그대로 돌려 **실제로 태어난 몸**을 세고(덤퍼의 ##STATS##)
// 서버가 갈래로 나눠 내려 준다(api의 truthmix.py). 화면은 받아 그리기만 한다.
//
// 유닛 갈래 집합(방어 건물·마법·공중)이 아직 여기 있는 까닭: 연속 재생(ReplayMotionPlayer)이
// 화면에서 유닛을 가를 때 쓴다. 통계의 갈래 나누기는 서버(truthmix.py)가 하고 두 목록은
// **같은 이름**으로 맞춰 뒀다 — 한쪽만 고치면 화면과 숫자가 어긋난다.
/** 막는 건물 — 나머지 건물은 전부 '생산'으로 본다(요청: 건물 빌드 비율은 생산/방어).
 *  크립 콜로니는 성큰·스포어가 되기 전 단계라 방어로 센다. */
export const DEFENSE_BUILDINGS = new Set([
    "Bunker", "Missile Turret",
    "Photon Cannon", "Shield Battery",
    "Creep Colony", "Sunken Colony", "Spore Colony",
]);
/** 마법 유닛 — 에너지를 쓰는 것이 그 유닛의 존재 이유인 것들. 메딕·고스트는 여기 안 넣는다:
 *  메딕은 바이오닉의 한 부분이고 고스트는 사실상 핵·락다운용이라 수가 아주 적어, 넣으면
 *  '마법 비중'이 그 사람의 운영이 아니라 종족을 말하는 값이 된다. */
export const CASTER_UNITS = new Set([
    "High Templar", "Dark Archon", "Arbiter", "Science Vessel", "Defiler", "Queen",
]);
/** 하늘에 뜨는 것 — 오버로드는 위 NOT_ARMY에서 이미 빠진다. */
export const AIR_UNITS = new Set([
    "Wraith", "Dropship", "Science Vessel", "Valkyrie", "Battlecruiser",
    "Shuttle", "Observer", "Scout", "Corsair", "Carrier", "Arbiter",
    "Mutalisk", "Guardian", "Devourer", "Scourge", "Queen",
]);
/* ── 주요시간대 ────────────────────────────────────────────────────────────────
   초반 4분과 마지막 1분을 뺀 가운데 구간. 앞을 4분으로 자른 건 브루드워에서 그때까지가
   대체로 '정해진 빌드'라 사람 사이에 차이가 안 생기는 구간이기 때문이고, 뒤를 1분 자른
   건 결과가 이미 정해진 뒤의 정리 구간을 빼기 위해서다.
   남는 구간이 3분 미만이면 값을 안 낸다 — 8분도 안 되는 판에서 '주요시간대'라고 부를 만한
   구간이 없고, 짧은 판이 통계에 끼어드는 문제도 여기서 함께 막힌다(요청: 짧은 경기는
   자동으로 안 들어가겠지). */
export function topEntries(d, ko, n, secs, exclude) {
    const merged = {};
    const mergedSecs = {};
    // 서버가 아직 이 갈래를 안 내려주는 사이(프론트만 먼저 배포된 순간)에도 칸이 깨지지
    // 않아야 한다 — 없으면 그냥 빈 목록이다.
    for (const [key, v] of Object.entries(d ?? {})) {
        if (exclude?.has(key))
            continue;
        const name = ko[key];
        if (!name || !(v > 0))
            continue;
        merged[name] = (merged[name] ?? 0) + v;
        const sv = secs?.[key];
        if (typeof sv === "number" && sv > 0)
            mergedSecs[name] = (mergedSecs[name] ?? 0) + sv;
    }
    /* 탱크처럼 영문명 둘이 한국어 하나로 합쳐지는 이름은 시간도 함께 더해진다 — 한 판에서
       시즈/언시즈가 둘 다 나오면 그 판 길이가 두 번 들어가 값이 실제보다 낮게 나온다. 이름이
       갈리는 것은 탱크뿐이고 보수적으로 잡히는 쪽이라 그대로 둔다.
       순위는 10분당 값이 아니라 총합으로 매긴다 — 한 판에만 잠깐 쓴 것이 10분당으로는 커 보여
       상위로 올라오면 "많이 뽑은 다섯"이라는 목록의 뜻이 어긋난다. */
    return Object.entries(merged)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, n)
        .map(([name, count]) => ({
        name,
        perMin: mergedSecs[name] > 0 ? (count / mergedSecs[name]) * PER_WINDOW_SECONDS : null,
    }));
}
/** 이름 → 그 목록에서 몇 번째였나(1부터) — Top5 옆의 전달 대비 순위 화살표에 쓴다(요청).
 *
 *  topEntries와 같은 순서를 매기되 자르지 않는다: 지난달 6위였던 것이 이번 달 3위로 올라온
 *  경우, Top5만 들고 견주면 그 사실을 알 수가 없어 '새로 등장'으로 보인다. 값은 목록에
 *  실제로 실린 것만 담기므로, 여기 없는 이름은 지난달에 아예 안 나온 것이다. */
/** 1분(초) — 주요시간대 합계를 이 길이로 환산한다(요청: 모든 시간관련 지표를 주요시간대
 *  1분당으로, 단위 표시는 "단위/분"). 예전에는 10분이었는데, 경기 전체를 분모로 쓸 때는
 *  분당 값이 너무 잘아 자릿수 차이가 안 읽혔다 — 주요시간대만 세면 값 자체가 커져서
 *  분당으로도 충분히 갈린다(서버의 PER_WINDOW_SECONDS와 같은 값). */
export const PER_WINDOW_SECONDS = 60;
