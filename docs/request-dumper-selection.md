# 덤퍼 저장소에 부탁하는 것 — 선택 절(OBWT 판 10)

2026-09 · scplay 의 요청: "중계시(화면 주인의) 건물 선택시 인포팝업 뜨게 해줘" → "보는 사람이 누르는게 아니라 리플레이
기록상 선택한 경우". 재생기(scplay)는 **이미 다 지어 두었다**(판 10 을 읽고, 화면 주인의 선택이 건물 하나면 그 건물의 정보
팝업을 저절로 띄운다). 남은 것은 덤퍼가 그 절을 **굽는 일** 하나다. 이 문서는 그 저장소(`stargayte-api` 의
`openbw/bwdump.cpp` + `openbw-scr.patch`)에 넘길 부탁이다. 건설 명령 절(판 9 — `request-dumper-build-orders.md`)과 같은 꼴이다.

## 무엇을 적어 달라는가

원작 명령 스트림의 **선택을 바꾸는 명령**마다 한 줄이다 — 그 명령을 치른 **뒤의 선택 전체**를 적는다:

| 칸 | 뜻 | 어디서 |
| --- | --- | --- |
| 프레임 | 누른 프레임 | `st.current_frame` |
| 임자 | 0~11 | `owner` |
| 태그들 | 그 명령 뒤 그 사람이 쥔 선택(최대 12) | 선택 배열의 유닛마다 `get_unit_id_32(u).raw_value` (명령 절과 같은 태그 자) |

· 선택은 게임 상태가 아니라 **누른 사람의 손 안의 일**이라 명령 스트림을 지나는 자리 말고는 알아낼 데가 없다 —
  마우스 자국(`bwdump_order`)·건설 명령(`bwdump_build`)과 같은 자리·같은 까닭이다.
· **차이가 아니라 결과**를 적는다 — Select(0x09)·ShiftSelect(0x0A)·ShiftDeselect(0x0B)·부대 지정 불러오기(Hotkey 의
  recall)가 다 선택을 바꾸는데, 차이만 적으면 재생기가 네 가지 셈을 되풀이해야 하고 한 줄만 어긋나도 그 뒤가 다 틀린다.
  덤퍼는 이미 그 셈을 치른 선택 배열을 들고 있다(OpenBW `action_state` 의 사람별 선택).
· 부대 지정 **저장**(recall 이 아닌 assign)은 선택을 안 바꾸므로 안 적는다. 같은 선택이 되풀이되어도 그대로 적어도 된다
  (재생기는 줄마다 '건물 하나인가'만 본다).
· 선택이 **비는** 명령(다 죽어 비었다가 아니라 누른 사람이 비운 경우)은 태그수 0 으로 적는다 — 팝업을 닫는 신호다.

## 어디에 넣는가 — 훅 자리

`openbw-scr.patch` 의 `actions.h`, 선택 배열을 **바꾼 바로 뒤**. OpenBW 에서는 선택 명령을 읽는 갈래(`read_action_select`
꼴 — Select·ShiftSelect·ShiftDeselect)와 부대 지정 불러오기 갈래가 그 사람의 선택을 갈아 끼운다. 각 갈래가 선택을 다 고친
뒤 한 번씩 `bwdump_select(frame, owner, 선택)` 을 부른다(함수 이름은 그쪽 규약대로). 원작도 버리는 명령(남의 유닛·빈 명령)은
적을 것이 없다.

## 이진 꼴 — 판 9 → 10

· 머리의 판 번호 `9 → 10`. 재생기는 **8·9·10 을 다 읽는다**(9 는 이 절이 없는 10 과 같다) — 재분석을 기다리지 않고
  덤퍼만 갈아 끼우면 새로 구운 경기부터 선택 팝업이 선다. 절이 없는 판에서는 재생기가 '그 건물을 눌러야만 생기는 일'
  (생산 시작·연구 시작)로 대신 띄운다.
· 절은 **맨 뒤**(건설명령 절 다음)에 붙는다:

```
선택   u32 개수, 개마다 varint(프레임차) · u8 임자 · u8 태그수 · u32 태그 × 태그수
```

  varint 는 다른 절과 같은 7비트 zigzag(`put_varint`)이고 프레임은 **직전 줄과의 차이**다. 개수 0 이어도 `u32 0` 은 꼭
  적는다(안 적으면 판 10 으로는 열리지 않는다 — 남는 바이트가 아니라 모자란 바이트다).
· 줄 수 어림: 선택은 APM 의 큰 몫이라 20분 경기 한 사람에 수천 줄이다. 줄마다 평균 6~8바이트(태그 하나일 때)라
  8인전이라도 zlib 앞에서 수백 KB — 뭉치(0.8~3.8MB)에 비해 작다. 상한은 다른 절처럼 두면 된다(예: 1,000,000 줄).
· 글자(`--tracks`) 갈래에도 한 줄을 더한다 — 규약 검사가 이진과 맞댄다:

```
#sel\t프레임\t임자\t태그,태그,…
```

## 참고 diff 뼈대(판 9 덤퍼 기준)

```cpp
/* 선택 — [프레임 · 임자 · 그 명령 뒤의 선택 태그들]. actions.h 의 선택 갈래가 적는다(openbw-scr.patch). */
struct sel_ev_t { int frame, owner; std::vector<unsigned> tags; };
static std::vector<sel_ev_t> g_sels;
void bwdump_select(int frame, int owner, const unsigned* tags, int n) {
  if (owner < 0 || owner >= 12 || g_sels.size() >= 1000000) return;
  g_sels.push_back({ frame, owner, std::vector<unsigned>(tags, tags + std::min(n, 12)) });
}
/* bwdump_write_binary — 건설명령 절 **뒤**(맨 뒤). */
put_u32(b, (unsigned)g_sels.size());
{ int pf = 0; for (const auto& e : g_sels) {
    put_varint(b, e.frame - pf); put_u8(b, (unsigned)e.owner); put_u8(b, (unsigned)e.tags.size());
    for (unsigned tg : e.tags) put_u32(b, tg);
    pf = e.frame; } }
/* 글자 갈래 */
for (const auto& e : g_sels) {
  printf("#sel\t%d\t%d\t", e.frame, e.owner);
  for (size_t i = 0; i < e.tags.size(); ++i) printf(i ? ",%u" : "%u", e.tags[i]);
  printf("\n");
}
```

태그는 **명령 절과 같은 자**(1.16 리플레이의 11비트 태그 보정을 거친 값)여야 한다 — 재생기가 그 태그로 건물 생애를 찾는다.

## 검산

scplay 쪽 자물쇠가 이미 판 10 을 안다:

```
node scripts/openbw-tracks-check.mjs                 # 합성 왕복 — 판 8·9·10 ✔ · 7·11 물리침
node scripts/openbw-tracks-check.mjs <구운 뭉치>      # 남은 바이트 0 · "선택 N" 이 찍혀야 한다
OPENBW_BWDUMP=… OPENBW_DATA=… node scripts/openbw-tracks-check.mjs --rep <x.rep>   # 글자 #sel 과 이진을 줄마다 맞댄다
```

재생기 쪽 눈 검산: `node scripts/perf-check.mjs --wide --warm 0 --glblit --selpick --track 정구 --infoprobe`
— 픽스처가 판 10 으로 구워져 44초에 홀 하나를 고르고 50초에 딴 몸으로 갈아탄다. 46초에 "커맨드" 팝업이 서고 50초에 닫힌다.
