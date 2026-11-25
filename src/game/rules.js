export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const labels = {
  wood: 'Деревина', stone: 'Камінь', ore: 'Руда', berries: 'Ягоди', meat: 'Сире м’ясо',
  cookedMeat: 'Смажене м’ясо', dirtyWater: 'Неочищена вода', cleanWater: 'Чиста вода',
  axe: 'Сокира', pickaxe: 'Кирка', spear: 'Спис', bow: 'Лук', arrows: 'Стріли',
  armor: 'Броня', ironAxe: 'Залізна сокира', ironPickaxe: 'Залізна кирка', torch: 'Смолоскип', flask: 'Фляга',
  wall: 'Стіна', floor: 'Підлога', door: 'Двері', roof: 'Дах', chest: 'Скриня', bed: 'Ліжко', campfire: 'Багаття',
};
export const buildingTypes = ['floor', 'wall', 'door', 'roof', 'chest', 'bed', 'campfire'];
export const hotbar = ['berries', 'cookedMeat', 'cleanWater', 'axe', 'pickaxe', 'spear', 'bow', 'torch'];
export const recipes = {
  axe: { cost: { wood: 3, stone: 2 }, unique: true },
  pickaxe: { cost: { wood: 3, stone: 4 }, unique: true },
  spear: { cost: { wood: 4, stone: 2 }, unique: true },
  bow: { cost: { wood: 6, ore: 2 }, unique: true },
  arrows: { cost: { wood: 1, stone: 1 }, amount: 5 },
  armor: { cost: { wood: 4, ore: 6 }, unique: true },
  ironAxe: { cost: { ore: 5, wood: 2 }, requires: 'axe', unique: true, fire: true },
  ironPickaxe: { cost: { ore: 5, wood: 2 }, requires: 'pickaxe', unique: true, fire: true },
  torch: { cost: { wood: 1, ore: 1 }, unique: true },
  flask: { cost: { wood: 2, stone: 2 }, unique: true },
  floor: { cost: { wood: 4 } }, wall: { cost: { wood: 4 } }, door: { cost: { wood: 3, stone: 1 } },
  roof: { cost: { wood: 5 } }, chest: { cost: { wood: 4, stone: 1 } },
  bed: { cost: { wood: 5, berries: 2 } }, campfire: { cost: { wood: 3, stone: 3 } },
  cookedMeat: { cost: { meat: 1, wood: 1 }, fire: true },
  cleanWater: { cost: { dirtyWater: 1, wood: 1 }, fire: true },
};

export function createState() {
  const inventory = Object.fromEntries(Object.keys(labels).map(key => [key, 0]));
  return { ...inventory, berries: 2, hp: 100, food: 88, water: 92, day: 1, time: 8,
    paused: true, cave: false, torchOn: false, equipped: 'hands', quest: 0,
    gatheredWood: 0, gatheredStone: 0, nightDay: 0, caveExplored: false,
    spawn: null, markers: [], structures: [], harvested: [], enemyState: [], seed: 1,
    settings: { volume: .35, sensitivity: 1, quality: 'medium' } };
}

export function craftReason(state, key, nearFire = false) {
  const r = recipes[key];
  if (!r) return 'Невідомий рецепт';
  if (r.unique && state[key]) return 'Уже виготовлено';
  if (r.requires && !state[r.requires]) return `Спочатку: ${labels[r.requires]}`;
  if (r.fire && !nearFire) return 'Підійдіть до багаття';
  if (Object.entries(r.cost).some(([item, count]) => state[item] < count)) return 'Недостатньо матеріалів';
  return '';
}

export function craftItem(state, key, nearFire) {
  if (craftReason(state, key, nearFire)) return false;
  const r = recipes[key];
  for (const [item, count] of Object.entries(r.cost)) state[item] -= count;
  state[key] += r.amount || 1;
  return true;
}

export function useItem(state, key) {
  if (!state[key]) return 'Предмета немає — виготовіть його або знайдіть';
  if (key === 'berries' || key === 'cookedMeat') {
    if (state.food >= 100) return 'Ви вже ситі';
    state[key]--; state.food = clamp(state.food + (key === 'berries' ? 22 : 48), 0, 100);
    if (key === 'berries') state.water = clamp(state.water + 7, 0, 100);
    return `Використано: ${labels[key]}`;
  }
  if (key === 'cleanWater') {
    if (state.water >= 100) return 'Ви не відчуваєте спраги';
    state.cleanWater--; state.water = clamp(state.water + 45, 0, 100);
    return 'Ви випили чисту воду';
  }
  if (key === 'torch') { state.torchOn = !state.torchOn; return state.torchOn ? 'Смолоскип запалено' : 'Смолоскип погашено'; }
  if (['axe', 'pickaxe', 'spear', 'bow'].includes(key)) { state.equipped = key; return `Споряджено: ${labels[key]}`; }
  return 'Цей предмет використовується через меню';
}

export const quests = [
  'Зберіть 3 деревини та 2 камені', 'Виготовте сокиру в меню Q',
  'Укриття: підлога, 3 стіни, двері та дах', 'Переживіть ніч: залишайтеся живими до світанку',
  'Увійдіть у печеру та дослідіть її глибину', 'Острів освоєно! Розбудовуйте базу й досліджуйте світ',
];
export function advanceQuest(state) {
  const old = state.quest;
  if (state.quest === 0 && state.gatheredWood >= 3 && state.gatheredStone >= 2) state.quest++;
  if (state.quest === 1 && state.axe) state.quest++;
  if (state.quest === 2 && state.structures.some(floor => {
    if (floor.type !== 'floor' || !state.structures.some(b => b.type === 'roof' && Math.hypot(b.x-floor.x,b.z-floor.z)<.1)) return false;
    const edges = [[0,2,0],[0,-2,0],[2,0,Math.PI/2],[-2,0,Math.PI/2]];
    const frames = edges.map(([x,z,yaw]) => state.structures.find(b => ['wall','door'].includes(b.type) && Math.hypot(b.x-floor.x-x,b.z-floor.z-z)<.1 && Math.abs(Math.sin(b.yaw-yaw))<.1));
    return frames.every(Boolean) && frames.some(b => b.type === 'door');
  })) state.quest++;
  if (state.quest === 3 && state.hp > 0) {
    if (state.time >= 20 && !state.nightDay) state.nightDay = state.day;
    if (state.nightDay && state.day > state.nightDay && state.time >= 6 && state.time < 20) state.quest++;
  }
  if (state.quest === 4 && state.caveExplored) state.quest++;
  return state.quest !== old;
}

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function insideBox(x, z, box, radius = .53) {
  const c = Math.cos(box.yaw || 0), s = Math.sin(box.yaw || 0), dx = x - box.x, dz = z - box.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return (lx - clamp(lx, -box.halfX, box.halfX)) ** 2 + (lz - clamp(lz, -box.halfZ, box.halfZ)) ** 2 < radius ** 2;
}

export function enemyIntent(enemy, player, time, elapsed) {
  const dx = player.x - enemy.x, dz = player.z - enemy.z, d = Math.hypot(dx, dz);
  const night = time >= 20 || time < 6;
  if (enemy.type === 'nocturnal' && !night) return { x: enemy.spawnX, z: enemy.spawnZ, speed: .7, attack: false };
  if (enemy.type === 'skittish' && (d < 10 || enemy.hp < 3)) return { x: enemy.x - dx, z: enemy.z - dz, speed: 3.5, attack: false };
  const guardRange = Math.hypot(player.x - enemy.spawnX, player.z - enemy.spawnZ);
  if (!player.cave && d < (enemy.type === 'guard' ? 16 : 23) && (enemy.type !== 'guard' || guardRange < 20)) {
    return { x: player.x, z: player.z, speed: d < 1.65 ? 0 : night ? 2.2 : 1.6, attack: d < 1.9 };
  }
  return { x: enemy.spawnX + Math.sin(elapsed * .16 + enemy.phase) * (enemy.type === 'guard' ? 3 : 8),
    z: enemy.spawnZ + Math.cos(elapsed * .16 + enemy.phase) * (enemy.type === 'guard' ? 3 : 8), speed: .9, attack: false };
}

// Only accept bounded, known values from browser storage; older saves retain inventory and position.
export function loadSave(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw), source = data.state;
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    const state = createState();
    for (const key of Object.keys(labels)) {
      if (Number.isFinite(source[key])) state[key] = clamp(Math.floor(source[key]), 0, 100000);
      if (recipes[key]?.unique) state[key] = source[key] === true || state[key] > 0 ? 1 : 0;
    }
    for (const key of ['hp', 'food', 'water', 'day', 'time', 'quest', 'gatheredWood', 'gatheredStone', 'nightDay', 'seed']) {
      if (Number.isFinite(source[key])) state[key] = clamp(source[key], 0, ['hp', 'food', 'water'].includes(key) ? 100 : 4294967295);
    }
    state.seed = Math.floor(state.seed); state.nightDay = Math.floor(state.nightDay);
    state.day = Math.max(1, Math.floor(state.day)); state.time %= 24; state.quest = Math.min(5, Math.floor(state.quest));
    for (const key of ['cave', 'torchOn', 'caveExplored', 'caveLoot']) state[key] = source[key] === true;
    if (['axe','pickaxe','spear','bow'].includes(source.equipped) && state[source.equipped]) state.equipped = source.equipped;
    if (source.weapon === 1) state.axe = Math.max(1, state.axe);
    if (Number.isFinite(source.wallKit)) state.wall = Math.max(state.wall, clamp(Math.floor(source.wallKit),0,100000));
    if (!state.flask) state.dirtyWater = state.cleanWater = 0;
    state.cleanWater = Math.min(4,state.cleanWater); state.dirtyWater = Math.min(4-state.cleanWater,state.dirtyWater);
    const position = p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.hypot(p.x, p.z) <= 150;
    state.spawn = position(source.spawn) && Math.hypot(source.spawn.x,source.spawn.z)<=146 ? { x: source.spawn.x, z: source.spawn.z } : null;
    state.markers = (Array.isArray(source.markers) ? source.markers : []).filter(position).slice(0, 20).map(p => ({ x: p.x, z: p.z }));
    state.structures = (Array.isArray(source.structures) ? source.structures : []).filter(b => position(b) && buildingTypes.includes(b.type) && Number.isFinite(b.y) && b.y >= -10 && b.y < 40 && Number.isFinite(b.yaw)).slice(0, 500).map(b => ({ type: b.type, x: b.x, y: b.y, z: b.z, yaw: b.yaw, open: b.open === true,
      items: b.type==='chest' ? Object.fromEntries(['wood', 'stone', 'ore', 'berries', 'meat', 'cookedMeat', 'dirtyWater', 'cleanWater', 'arrows'].map(k => [k, Number.isFinite(b.items?.[k]) ? clamp(Math.floor(b.items[k]), 0, 100000) : 0])) : {} }));
    state.harvested = [...new Set((Array.isArray(source.harvested) ? source.harvested : []).filter(id => typeof id === 'string' && /^(tree|rock)-\d{1,3}$/.test(id)))].slice(0,435);
    state.enemyState = (Array.isArray(source.enemyState) ? source.enemyState : []).slice(0,10).map(e => position(e) && Number.isFinite(e.hp) && Number.isFinite(e.respawn) ? {
      x:e.x,z:e.z,hp:clamp(e.hp,0,6),alive:e.alive===true&&e.hp>0,respawn:clamp(e.respawn,0,300),attack:Number.isFinite(e.attack)?clamp(e.attack,0,1.2):1,cacheOre:clamp(Number(e.cacheOre)||0,0,3),
    } : null);
    state.settings.volume = Number.isFinite(source.settings?.volume) ? clamp(source.settings.volume, 0, 1) : .35;
    state.settings.sensitivity = Number.isFinite(source.settings?.sensitivity) ? clamp(source.settings.sensitivity, .3, 2.5) : 1;
    state.settings.quality = ['low', 'medium', 'high'].includes(source.settings?.quality) ? source.settings.quality : 'medium';
    const player = position(data.player) && Math.hypot(data.player.x,data.player.z)<=146 ? { x: data.player.x, z: data.player.z } : { x: 0, z: 0 };
    if (state.cave && (player.x < -87 || player.x > -64.5 || Math.abs(player.z+24)>4.5)) state.cave=false;
    return { state, player };
  } catch { return null; }
}
