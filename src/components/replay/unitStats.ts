/* 유닛·건물 기초표 — 재생기가 legacy/replayUnits.ts(211KB)에서 쓰던 것은 이 셋(3.5KB)뿐
   이었다. 그 파일의 본체는 옛 유추 엔진(buildUnitTracks, 4천 줄)인데 참값 재생이 그 길을
   대신한 뒤로 재생기는 안 부른다 — 표 셋 때문에 4천 줄을 패키지에 끌고 갈 까닭이 없다. */

/** 유닛 기본 스탯(요청: 체력·방어력·공격력·기술을 지니고 이벤트를 겪는 생애주기) —
 *  hp는 체력+실드 합, dps는 지상 상대 어림. 원작 수치의 근사값이다. */
export const UNIT_STATS: Record<string, { hp: number; dps: number; sh?: number }> = {
  SCV: { hp: 60, dps: 5 }, Probe: { hp: 20, sh: 20, dps: 4 }, Drone: { hp: 40, dps: 4 },
  Marine: { hp: 40, dps: 6 }, Firebat: { hp: 50, dps: 12 }, Medic: { hp: 60, dps: 0 },
  Ghost: { hp: 45, dps: 7 }, Vulture: { hp: 80, dps: 9 }, Goliath: { hp: 125, dps: 9 },
  "Siege Tank": { hp: 150, dps: 14 }, "Siege Tank (Tank Mode)": { hp: 150, dps: 14 },
  "Siege Tank (Siege Mode)": { hp: 150, dps: 24 },
  Wraith: { hp: 120, dps: 6 }, Dropship: { hp: 150, dps: 0 }, "Science Vessel": { hp: 200, dps: 0 },
  Battlecruiser: { hp: 500, dps: 17 }, Valkyrie: { hp: 200, dps: 8 },
  Zealot: { hp: 100, sh: 60, dps: 13 }, Dragoon: { hp: 100, sh: 80, dps: 10 },
  "High Templar": { hp: 40, sh: 40, dps: 3 },
  "Dark Templar": { hp: 80, sh: 40, dps: 22 }, Archon: { hp: 10, sh: 350, dps: 20 },
  "Dark Archon": { hp: 25, sh: 200, dps: 0 },
  Shuttle: { hp: 80, sh: 60, dps: 0 }, Reaver: { hp: 100, sh: 80, dps: 26 },
  Observer: { hp: 40, sh: 20, dps: 0 },
  Scout: { hp: 150, sh: 100, dps: 8 }, Carrier: { hp: 300, sh: 150, dps: 22 },
  Arbiter: { hp: 200, sh: 150, dps: 7 }, Corsair: { hp: 100, sh: 80, dps: 6 },
  Zergling: { hp: 35, dps: 5 }, Hydralisk: { hp: 80, dps: 8 }, Lurker: { hp: 125, dps: 14 },
  Mutalisk: { hp: 120, dps: 7 }, Scourge: { hp: 25, dps: 0 }, Queen: { hp: 120, dps: 0 },
  Ultralisk: { hp: 400, dps: 18 }, Defiler: { hp: 80, dps: 0 }, Overlord: { hp: 200, dps: 0 },
  "Sunken Colony": { hp: 300, dps: 13 }, "Photon Cannon": { hp: 100, sh: 100, dps: 11 },
  Bunker: { hp: 350, dps: 14 }, "Missile Turret": { hp: 200, dps: 0 },
};

/* 유닛 생산 시간(초, 빠른 속도) — 정보 팝업의 생산 진행률이 이 표로 돈다. 리플레이에
   남는 것은 '완성 시각'뿐이라, 시작 시각은 완성에서 이 값을 빼서 되짚는다.
   ★ 값의 출처 — 널리 인용되는 커뮤니티 문서 기준이고 프레임 단위까지 대조하지는
     않았다. 자원·생산 모델을 붙일 때 이 표만 원전과 맞추면 진행률이 정확해진다. */
export const UNIT_BUILD_SEC: Record<string, number> = {
  SCV: 20, Marine: 24, Firebat: 24, Medic: 30, Ghost: 50,
  Vulture: 30, Goliath: 40, "Siege Tank (Tank Mode)": 50, "Siege Tank (Siege Mode)": 50,
  Wraith: 60, Dropship: 50, "Science Vessel": 80, Battlecruiser: 133, Valkyrie: 50,
  Probe: 20, Zealot: 40, Dragoon: 50, "High Templar": 50, "Dark Templar": 50,
  Archon: 20, "Dark Archon": 20, Shuttle: 60, Reaver: 70, Observer: 40,
  Scout: 80, Corsair: 40, Carrier: 140, Arbiter: 160,
  Drone: 20, Zergling: 28, Hydralisk: 28, Lurker: 40, Mutalisk: 40, Scourge: 30,
  Queen: 50, Defiler: 50, Ultralisk: 60, Guardian: 40, Devourer: 40, Overlord: 40,
  "Infested Terran": 40,
};

export const BLD_STATS: Record<string, [number, number]> = {
  "Command Center": [1500, 0], "Supply Depot": [500, 0], Barracks: [1000, 0], Refinery: [750, 0],
  "Engineering Bay": [850, 0], Academy: [600, 0], Bunker: [350, 0], "Missile Turret": [200, 0],
  Factory: [1250, 0], Starport: [1300, 0], Armory: [750, 0], "Science Facility": [850, 0],
  "Comsat Station": [500, 0], "Machine Shop": [750, 0], "Control Tower": [500, 0],
  Hatchery: [1250, 0], Lair: [1800, 0], Hive: [2500, 0], "Spawning Pool": [750, 0],
  "Hydralisk Den": [850, 0], Spire: [600, 0], "Greater Spire": [1000, 0],
  "Evolution Chamber": [750, 0], Extractor: [750, 0], "Creep Colony": [400, 0],
  "Sunken Colony": [300, 0], "Spore Colony": [400, 0], "Queen's Nest": [850, 0],
  "Queens Nest": [850, 0], "Ultralisk Cavern": [600, 0], "Defiler Mound": [850, 0],
  Nexus: [750, 750], Pylon: [300, 300], Gateway: [500, 500], Assimilator: [450, 450],
  Forge: [550, 550], "Photon Cannon": [100, 100], "Cybernetics Core": [500, 500],
  "Citadel of Adun": [450, 450], "Templar Archives": [500, 500], "Robotics Facility": [500, 500],
  "Robotics Support Bay": [450, 450], Observatory: [250, 250], Stargate: [600, 600],
  "Fleet Beacon": [500, 500], "Arbiter Tribunal": [500, 500], "Shield Battery": [200, 200],
};
