# 덤퍼 저장소에 부탁하는 것 — 건설 명령 절(OBWT 판 9)

2026-09 · scplay 의 요청: "덤퍼 수정하고 그 정보 이용해서 공사명령후부터 건설전까지 반투명 초록판+건물 모델(투명도 높게)
얹기" — 재생기 쪽(scplay)은 **이미 다 지어 두었다**(판 9 를 읽고 고스트를 그린다). 남은 것은 덤퍼가 그 절을 **굽는 일**
하나다. 이 문서는 그 저장소(`stargayte-api` 의 `openbw/bwdump.cpp` + `openbw-scr.patch`)에 넘길 부탁이다.

## 무엇을 적어 달라는가

원작 명령 스트림의 **건설 명령**(`action_build`) 한 줄마다 여섯 값이다:

| 칸 | 뜻 | 어디서 |
| --- | --- | --- |
| 프레임 | 누른 프레임 | `st.current_frame` |
| 임자 | 0~11 | `owner` |
| 일꾼 태그 | 명령을 받은 유닛 | `get_unit_id_32(u).raw_value` (명령 절과 같은 태그 자) |
| 타일 x · y | **발자국 좌상단 타일**(정수) | `tile_pos.x · tile_pos.y` — 픽셀도 가운데도 아니다 |
| 건물 종류 | units.dat 번호 | `unit_type->id` |

· 고스트가 그리는 것은 "이 자리에 이것이 설 것이다"라 **누른 순간과 자리**가 전부다. 게임 상태에는 안 남는 것
  (누른 사람만 아는 일)이라 명령 스트림을 지나는 `action_build` 말고는 알아낼 데가 없다 — 마우스 자국(`bwdump_order`)과
  같은 자리·같은 까닭이다.
· 자리가 막혀 결국 못 짓는 명령, 취소되는 명령도 **그대로 적는다** — 재생기는 짝(그 건물의 착공)이 없는 줄을 몇 초 뒤
  스러지게 둔다. 덤퍼가 걸러 주지 않아도 된다(걸러 주면 오히려 취소 연출이 사라진다).
· 애드온(`ut_addon`)도 같은 훅을 지난다 — 부속의 tile_pos 가 그대로 실린다.

## 어디에 넣는가 — 훅 자리

`openbw-scr.patch` 의 `action_build`, **`unit_build_order_valid` 검사를 지난 바로 뒤**(`if (ut_addon(unit_type))` 앞).
그 앞의 세 검사(`!u` · 남의 유닛 · 유효하지 않은 명령)는 원작도 버리는 명령이라 적을 것이 없다.

## 이진 꼴 — 판 8 → 9

· 머리의 판 번호 `8 → 9`. 재생기는 **8 과 9 를 둘 다 읽는다**(8 은 이 절이 없는 9 와 같다) — 곧 재분석을 기다리지 않고
  덤퍼만 갈아 끼우면 새로 구운 경기부터 고스트가 선다.
· 절은 **맨 뒤**(자원밭단 절 다음)에 붙는다:

```
건설명령   u32 개수, 개마다 varint(프레임차) · u8 임자 · u32 일꾼태그 · u16 타일x · u16 타일y · u16 건물종류
```

  varint 는 다른 절과 같은 7비트 zigzag(`put_varint`)이고 프레임은 **직전 줄과의 차이**다(명령 절과 같은 꼴).
  개수 0 이어도 `u32 0` 은 꼭 적는다(안 적으면 재생기가 그 뒤를 못 읽는다 — 남는 바이트가 아니라 모자란 바이트라
  판 9 로는 열리지 않는다).
· 글자(`--tracks`) 갈래에도 한 줄을 더한다 — 규약 검사(`scripts/openbw-tracks-check.mjs --rep`)가 이진과 맞댄다:

```
#build\t프레임\t임자\t태그\t타일x\t타일y\t종류
```

## 검산

scplay 쪽 자물쇠가 이미 판 9 를 안다:

```
node scripts/openbw-tracks-check.mjs                 # 합성 왕복 — 판 8·9 ✔ · 7·10 물리침
node scripts/openbw-tracks-check.mjs <구운 뭉치>      # 남은 바이트 0 · "건설명령 N" 이 찍혀야 한다
OPENBW_BWDUMP=… OPENBW_DATA=… node scripts/openbw-tracks-check.mjs --rep <x.rep>   # 글자 #build 와 이진을 줄마다 맞댄다
```

## 참고 diff — 옛 stargayte 트리(판 2 계통)에 그대로 적용한 것

훅 자리·저장·쓰기·글자 줄은 판 8 덤퍼에서도 **같은 자리**다(그 트리에서는 판 번호가 `2 → 3` 이고 절이 APM 뒤에 붙는다 —
판 8 덤퍼에서는 `8 → 9` 이고 **자원밭단 뒤**에 붙인다. 그 두 줄만 다르다).

```diff
diff --git a/tools/openbw/bwdump.cpp b/tools/openbw/bwdump.cpp
index c103f61b..3b9b5c66 100644
--- a/tools/openbw/bwdump.cpp
+++ b/tools/openbw/bwdump.cpp
@@ -402,7 +402,7 @@ static unsigned bwdump_tag(const bwgame::unit_t* u) {
      전체 = zlib( 아래 바이트열 )              ← 작은 끝(little-endian)
 
      머리
-       char[4] "OBWT" · u8 판(=2) · f32 초당프레임 · i32 믿을프레임(-1이면 끝까지)
+       char[4] "OBWT" · u8 판(=3) · f32 초당프레임 · i32 믿을프레임(-1이면 끝까지)
      로스터
        u8 사람수, 사람마다:
          u8 임자(0~11) · u8 리플레이id · u8 종족 · u8 편(force) · u8 controller
@@ -431,6 +431,9 @@ static unsigned bwdump_tag(const bwgame::unit_t* u) {
      명령        u32 개수, 개마다 varint(프레임차) · u32 태그 · u16 x · u16 y · u8 갈래
                  갈래는 0 이동·7 공격(v2의 증거 번호와 같다)
      APM         u32 개수 · u16 통크기(프레임), 개마다 varint(통차) · u8 사람 · varint(명령수)
+     건설명령    (판 3 · 판 8 계통에서는 판 9 — **맨 뒤**) u32 개수, 개마다 varint(프레임차) · u8 사람
+                 · u32 일꾼태그 · u16 타일x · u16 타일y · u16 건물종류(units.dat)
+                 action_build 의 tile_pos = 발자국 **좌상단 타일**(정수 — 픽셀도 가운데도 아니다)
 
    x·y는 픽셀, 프레임은 그대로다. 읽는 쪽이 초·타일·도로 바꾼다.
 
@@ -455,6 +458,10 @@ struct ping_ev_t { int frame, x, y, player; };
    있었나)의 재료다. 태그마다 [프레임, x, y, 갈래(0 이동·7 공격)]. */
 struct ord_ev_t { int frame; unsigned tag; int x, y, kind; };
 static std::vector<ord_ev_t> g_ords;
+/* 건설 명령 — [프레임 · 임자 · 일꾼 태그 · 타일 x · 타일 y · 건물 종류(units.dat)]. actions.h 의 action_build 가 적는다
+   (openbw-scr.patch). 재생기는 이 줄과 그 건물의 착공 시각 사이를 '예정 자리' 고스트로 그린다. */
+struct build_ev_t { int frame, owner; unsigned tag; int tx, ty, type; };
+static std::vector<build_ev_t> g_builds;
 static std::vector<roster_t> g_roster;
 /* 개인색 — 리마스터 리플레이는 사람마다 고른 색을 **CCLR 구획**에 담는다. 그 구획이
    진짜다: 헤더의 색 칸은 색표 번호가 아니라 딴 것이라(판마다 같은 번호가 다른 색으로
@@ -517,6 +524,10 @@ void bwdump_ping(int frame, int owner, int x, int y) {
 void bwdump_order(int frame, int owner, unsigned tag, int x, int y, int kind) {
   if (g_ords.size() < 2000000) g_ords.push_back({ frame, tag, x, y, kind });
 }
+void bwdump_build(int frame, int owner, unsigned tag, int tx, int ty, int type) {
+  if (owner < 0 || owner >= 12) return;
+  if (g_builds.size() < 200000) g_builds.push_back({ frame, owner, tag, tx, ty, type });
+}
 void bwdump_cast(int frame, int owner, int x, int y, int tech) {
   if (g_casts.size() < 100000) g_casts.push_back({frame, x, y, tech, owner});
 }
@@ -537,7 +548,7 @@ static void bwdump_write_binary(const std::map<unsigned, std::vector<track_key_t
     const tick_store_t& hp_store, const tick_store_t& ic_store, int trust_frame) {
   std::vector<uint8_t> b;
   b.push_back('O'); b.push_back('B'); b.push_back('W'); b.push_back('T');
-  put_u8(b, 2);
+  put_u8(b, 3);   /* 판 3 = 판 2 + 맨 뒤 건설 명령 절(아래) — 판 8 계통 덤퍼에서는 8 → 9 */
   { const float fps = 23.81f; uint32_t bits; std::memcpy(&bits, &fps, 4); put_u32(b, bits); }
   put_u32(b, (unsigned)trust_frame);
   /* 로스터 — 임자 번호(0~11)와 리플레이가 적어 둔 사람 정보. 이름은 UTF-8이다
@@ -624,6 +635,13 @@ static void bwdump_write_binary(const std::map<unsigned, std::vector<track_key_t
   { int pb = 0; for (const auto& kv : g_apm) {
       put_varint(b, kv.first.first - pb); put_u8(b, (unsigned)kv.first.second);
       put_varint(b, kv.second); pb = kv.first.first; } }
+  /* 건설 명령 — **맨 뒤** 절이다(판 8 계통에서는 자원밭단 뒤). 프레임 차례대로라 프레임만 차이로 적는다.
+     u32 개수, 개마다 varint(프레임차) · u8 임자 · u32 일꾼태그 · u16 타일x · u16 타일y · u16 건물종류. */
+  put_u32(b, (unsigned)g_builds.size());
+  { int pf = 0; for (const auto& e : g_builds) {
+      put_varint(b, e.frame - pf); put_u8(b, (unsigned)e.owner); put_u32(b, e.tag);
+      put_u16(b, (unsigned)e.tx); put_u16(b, (unsigned)e.ty); put_u16(b, (unsigned)e.type);
+      pf = e.frame; } }
   uLongf out_len = compressBound((uLong)b.size());
   std::vector<uint8_t> out(out_len);
   if (compress2(out.data(), &out_len, b.data(), (uLong)b.size(), 9) != Z_OK)
@@ -634,7 +652,7 @@ static void bwdump_write_binary(const std::map<unsigned, std::vector<track_key_t
   for (const auto& kv : ic_store) icn += kv.second.size();
   fprintf(stderr, "이진 트랙 — 트랙 %zu개 · 체력 %zu · 인터셉터 %zu · 업그레이드 %zu · 마법 %zu · 핑 %zu\n",
     store.size(), hpn, icn, g_ups.size(), g_casts.size(), g_pings.size());
-  fprintf(stderr, "  자원 %zu · APM통 %zu · 명령 %zu\n", g_res.size(), g_apm.size(), g_ords.size());
+  fprintf(stderr, "  자원 %zu · APM통 %zu · 명령 %zu · 건설명령 %zu\n", g_res.size(), g_apm.size(), g_ords.size(), g_builds.size());
   fprintf(stderr, "  편 %.1fMB → 눌러서 %.1fMB\n", b.size() / 1048576.0, out_len / 1048576.0);
 }
 
@@ -1171,6 +1189,8 @@ int main(int argc, char** argv) {
         printf("#apm\t%d\t%d\t%d\n", kv.first.first, kv.first.second, kv.second);
       for (const auto& e : g_ords)
         printf("#ord\t%d\t%u\t%d\t%d\t%d\n", e.frame, e.tag, e.x, e.y, e.kind);
+      for (const auto& e : g_builds)
+        printf("#build\t%d\t%d\t%u\t%d\t%d\t%d\n", e.frame, e.owner, e.tag, e.tx, e.ty, e.type);
       printf("#trust\t%d\n", bwdump_trust_frame());
     }
     if (bin_mode) bwdump_write_binary(store9, hp9, ic9, bwdump_trust_frame());
diff --git a/tools/openbw/openbw-scr.patch b/tools/openbw/openbw-scr.patch
index 694d94f7..e714c9e1 100644
--- a/tools/openbw/openbw-scr.patch
+++ b/tools/openbw/openbw-scr.patch
@@ -2,7 +2,7 @@ diff --git a/actions.h b/actions.h
 index 5a0ad23..e26f313 100644
 --- a/actions.h
 +++ b/actions.h
-@@ -3,6 +3,17 @@
+@@ -3,6 +3,18 @@
  
  #include "bwgame.h"
  
@@ -14,6 +14,7 @@ index 5a0ad23..e26f313 100644
 +void bwdump_when(const char* what, int frame, int owner, int extra);
 +void bwdump_ping(int frame, int owner, int x, int y);
 +void bwdump_order(int frame, int owner, unsigned tag, int x, int y, int kind);
++void bwdump_build(int frame, int owner, unsigned tag, int tx, int ty, int type);
 +void bwdump_gen(int frame, unsigned want, unsigned got, unsigned kind);
 +extern int bwdump_cur_owner;
 +
@@ -38,7 +39,7 @@ index 5a0ad23..e26f313 100644
  			return get_unit(u);
  		}), [](unit_t* u) {
  			return u != nullptr;
-@@ -331,21 +342,27 @@ struct action_functions: state_functions {
+@@ -331,21 +342,33 @@ struct action_functions: state_functions {
  	}
  
  	bool action_train(int owner, const unit_type_t* unit_type) {
@@ -71,6 +72,12 @@ index 5a0ad23..e26f313 100644
 +		if (!u) { bwdump_why("build", 1); bwdump_when("build:고른게없다", (int)st.current_frame, owner, (int)action_st.selection.at(owner).size()); return false; }
 +		if (u->owner != owner) { bwdump_why("build", 2); bwdump_owner("build", owner, u->owner); bwdump_when("build:남의유닛", (int)st.current_frame, owner, u->owner); return false; }
 +		if (!unit_build_order_valid(u, order_type, unit_type, owner)) { bwdump_why("build", 3); return false; }
++		/* 건설 명령 — 재생기의 '예정 자리' 고스트(명령 뒤 착공 전까지 반투명 초록 판 + 건물 모델)의 재료다.
++		   게임 상태에는 안 남는 것(누른 순간의 일)이라 명령 스트림을 지나는 이 자리 말고는 알아낼 데가 없다.
++		   tile_pos 는 발자국 **좌상단 타일**(정수), unit_type->id 는 units.dat 번호다. 자리가 막혀 결국 못 짓는
++		   명령도 적힌다 — 그 줄은 짝(착공)이 없어 재생기가 몇 초 뒤 스러지게 둔다(취소와 같은 꼴). */
++		bwdump_build((int)st.current_frame, owner, get_unit_id_32(u).raw_value,
++			(int)tile_pos.x, (int)tile_pos.y, (int)unit_type->id);
  		if (ut_addon(unit_type)) {
  			xy pos(int(32 * tile_pos.x) + unit_type->placement_size.x / 2, int(32 * tile_pos.y) + unit_type->placement_size.y / 2);
  			if (can_place_building(u, owner, unit_type, pos, false, false)) {
```
