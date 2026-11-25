import * as THREE from 'three';
import { mesh, bevelBox } from '../models/geometry.js';
import { createWall, createCampfire } from '../models/index.js';
import { insideBox } from './rules.js';

export function createBuilding(type) {
  if (type === 'wall') return createWall();
  if (type === 'campfire') {
    const fire = createCampfire();
    const light = new THREE.PointLight('#ff9e42', 4, 9); light.position.y = 1; fire.add(light);
    return fire;
  }
  const group = new THREE.Group(); group.name = type;
  const box = (name, w, h, d, x, y, z, surface = 'wood', color = '#c6a67f') => mesh(group, name, bevelBox(w, h, d), surface, color, [x, y, z]);
  if (type === 'floor' || type === 'roof') {
    for (let i = 0; i < 8; i++) box('plank', .49, .22, 4, (i - 3.5) * .5, type === 'roof' ? 3.2 : .11, 0);
    if (type === 'roof') for (const x of [-1.9, 1.9]) box('post', .14, 3.1, .14, x, 1.55, -1.9);
  }
  if (type === 'door') {
    for (const x of [-1.6, 1.6]) box('frame', .8, 2.9, .22, x, 1.45, 0);
    box('lintel', 4, .3, .24, 0, 2.85, 0);
    const leaf = new THREE.Group(); leaf.name = 'door-leaf'; leaf.position.set(-1.2, 0, 0);
    mesh(leaf, 'door-panel', bevelBox(2.4, 2.65, .15), 'wood', '#a48460', [1.2, 1.325, 0]);
    mesh(leaf, 'handle', new THREE.SphereGeometry(.07, 8, 6), 'stone', '#d6c49a', [2.1, 1.3, .16]);
    group.add(leaf);
  }
  if (type === 'chest') {
    box('body', 1.6, .85, .9, 0, .425, 0);
    box('lid', 1.7, .16, 1, 0, .93, 0, 'wood', '#9f7c51');
    box('lock', .16, .22, .06, 0, .75, .49, 'stone', '#d4c59b');
  }
  if (type === 'bed') {
    box('frame', 1.5, .24, 2.8, 0, .3, 0);
    box('blanket', 1.4, .2, 2.5, 0, .52, 0, 'cloth', '#8aa28b');
    box('pillow', 1.1, .22, .5, 0, .68, -.85, 'cloth', '#ece1bd');
    for (const x of [-.6, .6]) for (const z of [-1.2, 1.2]) box('leg', .13, .3, .13, x, .15, z);
  }
  return group;
}

export function buildingBoxes(b) {
  const base = { x: b.x, z: b.z, yaw: b.yaw, y: b.y, height: 2.9 };
  if (b.type === 'wall') return [{ ...base, halfX: 2, halfZ: .18 }];
  if (b.type === 'door') {
    if (!b.open) return [{ ...base, halfX: 2, halfZ: .18 }];
    return [-1.6, 1.6].map(offset => ({ ...base, x: b.x + Math.cos(b.yaw) * offset, z: b.z - Math.sin(b.yaw) * offset, halfX: .4, halfZ: .18 }));
  }
  if (b.type === 'chest') return [{ ...base, halfX: .8, halfZ: .5, height: 1.05 }];
  if (b.type === 'bed') return [{ ...base, halfX: .75, halfZ: 1.4, height: .8 }];
  if (b.type === 'campfire') return [{ ...base, halfX: .7, halfZ: .7, height: .7 }];
  return [];
}

export function overlaps(a, b) {
  for (const angle of [a.yaw || 0, (a.yaw || 0) + Math.PI / 2, b.yaw || 0, (b.yaw || 0) + Math.PI / 2]) {
    const x = Math.cos(angle), z = -Math.sin(angle);
    const extent = box => Math.abs(x * Math.cos(box.yaw || 0) - z * Math.sin(box.yaw || 0)) * box.halfX + Math.abs(x * Math.sin(box.yaw || 0) + z * Math.cos(box.yaw || 0)) * box.halfZ;
    if (Math.abs((a.x - b.x) * x + (a.z - b.z) * z) >= extent(a) + extent(b) - .04) return false;
  }
  return true;
}

export function placement(type, player, yaw, structures, terrain) {
  let x = Math.round((player.x - Math.sin(player.yaw) * 5) / 4) * 4;
  let z = Math.round((player.z - Math.cos(player.yaw) * 5) / 4) * 4;
  const floor = structures.find(b => b.type === 'floor' && b.x === x && b.z === z);
  if (type === 'wall' || type === 'door') { x += Math.sin(yaw) * 2; z += Math.cos(yaw) * 2; }
  const y = floor ? floor.y + .22 : terrain(x, z);
  return { type, x, y, z, yaw, open: false, items: {} };
}

export function placementReason(b, state, player, terrain, obstacles) {
  if (state.cave) return 'В пещере строить нельзя';
  if (!state[b.type]) return 'Сначала изготовьте комплект в Q';
  if (state.structures.length >= 500) return 'Достигнут лимит 500 построек';
  if (Math.hypot(b.x, b.z) > 138) return 'Слишком близко к воде';
  if (state.structures.some(o => o.type === b.type && Math.hypot(o.x - b.x, o.z - b.z) < .1 && (b.type !== 'wall' || Math.abs(Math.sin(o.yaw - b.yaw)) < .1))) return 'Место уже занято';
  if (['roof', 'bed', 'chest'].includes(b.type) && !state.structures.some(o => o.type === 'floor' && Math.abs(o.x - b.x) < .1 && Math.abs(o.z - b.z) < .1)) return 'Нужен пол под постройкой';
  const footprint = buildingBoxes(b)[0] || { ...b, halfX: 1.95, halfZ: 1.95 };
  if (insideBox(player.x, player.z, footprint, .7) && b.type !== 'roof') return 'Отойдите от места строительства';
  const heights = [-1, 1].flatMap(x => [-1, 1].map(z => terrain(b.x + x * 1.8, b.z + z * 1.8)));
  if (b.type === 'floor' && Math.max(...heights) - Math.min(...heights) > 1.5) return 'Слишком крутой склон';
  if (b.type !== 'roof' && obstacles.some(o => overlaps(footprint, o))) return 'Препятствие на месте строительства';
  if (state.structures.some(o => {
    if (o.type === 'floor' || o.type === 'roof' || b.type === 'floor' || b.type === 'roof') return false;
    const frames = ['wall', 'door'];
    // Adjacent wall ends share a corner on the 4 m foundation grid.
    if (frames.includes(o.type) && frames.includes(b.type) && Math.abs(Math.abs(o.x-b.x)-2)<.05 && Math.abs(Math.abs(o.z-b.z)-2)<.05) return false;
    // An open door still reserves its closed footprint for future use.
    return buildingBoxes({...o,open:false}).some(box => overlaps(footprint, box));
  })) return 'Постройки пересекаются';
  return '';
}
