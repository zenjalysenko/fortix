import * as THREE from 'three';
import { mesh, bevelBox, beam, mergeParts, batchByMaterial, crag, material } from './geometry.js';

export function createPineGeometries() {
  const trunk = new THREE.Group(), crown = new THREE.Group();
  mesh(trunk, 'bark', new THREE.CylinderGeometry(.21, .37, 3.4, 9, 3), 'wood', '#ffffff');
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4;
    beam(trunk, 'branch', [0, .1 + i * .18, 0], [Math.cos(angle) * .8, .5 + i * .18, Math.sin(angle) * .8], .12);
  }
  for (let i = 0; i < 4; i++) {
    const height = [2.5, 2.3, 2.05, 1.7][i], radius = [2.2, 1.8, 1.35, .85][i];
    const geometry = new THREE.ConeGeometry(radius, height, 11, 2);
    const positions = geometry.attributes.position;
    for (let v = 0; v < positions.count; v++) {
      const x = positions.getX(v), y = positions.getY(v), z = positions.getZ(v);
      const r = 1 + Math.sin(Math.atan2(z, x) * 5 + i * 2) * .1;
      positions.setXYZ(v, x * r, y + Math.sin(x * 3 + z * 2) * .09, z * r);
    }
    geometry.computeVertexNormals();
    mesh(crown, 'needles', geometry, 'leaves', '#ffffff', [0, -1.25 + i * 1.02, 0]);
  }
  return { trunk: mergeParts(trunk.children), crown: mergeParts(crown.children) };
}

export function createPine() {
  const group = new THREE.Group(); group.name = 'pine';
  const geometry = createPineGeometries();
  mesh(group, 'trunk', geometry.trunk, 'wood', '#d0b79b', [0, 1.7, 0]);
  mesh(group, 'crown', geometry.crown, 'leaves', '#c1d6b6', [0, 5, 0]);
  return group;
}

export function createRockGeometry() {
  const group = new THREE.Group();
  const main = mesh(group, 'rock', crag(1.2, 1, 2), 'stone', '#ffffff');
  main.scale.set(1, .85, .9);
  const shard = mesh(group, 'outcrop', crag(.48, 0, 7), 'stone', '#ffffff', [.72, -.2, .35]);
  shard.rotation.set(.2, .5, -.3);
  return mergeParts(group.children);
}

export function createRock() {
  const group = new THREE.Group(); group.name = 'rock';
  mesh(group, 'boulder', createRockGeometry(), 'stone', '#c6ccc5', [0, .6, 0]);
  return group;
}

export function createShelter() {
  const group = new THREE.Group(); group.name = 'shelter';
  for (let i = 0; i < 14; i++) mesh(group, `deck-${i}`, bevelBox(9, .2, .55), 'wood', i % 3 ? '#c4ad90' : '#b6a18c', [0, .25, (i - 6.5) * .57]);
  for (const x of [-3, 3]) for (const z of [-2, 2]) {
    beam(group, 'post', [x, .35, z], [x, 3.6, z], .25);
    beam(group, 'brace', [x, 2.6, z], [x - Math.sign(x) * .8, 3.4, z], .15);
  }
  for (const z of [-2, 2]) beam(group, 'eave', [-4, 3.55, z], [4, 3.55, z], .2);
  beam(group, 'ridge', [-4.3, 4.55, 0], [4.3, 4.55, 0], .2);
  for (const x of [-3.9, 0, 3.9]) for (const side of [-1, 1]) beam(group, 'rafter', [x, 4.5, 0], [x, 3.45, side * 2.7], .14);
  for (const side of [-1, 1]) {
    const roof = mesh(group, 'canvas-roof', bevelBox(8.7, .08, 2.96), 'cloth', '#c99068', [0, 4, side * 1.36]);
    roof.rotation.x = side * .37;
    for (const x of [-4, 4]) beam(group, 'roof-trim', [x, 4.57, 0], [x, 3.48, side * 2.78], .1);
  }
  for (let i = 0; i < 2; i++) mesh(group, 'step', bevelBox(2.2, .15, .5), 'wood', '#bca185', [0, .08 + i * .12, 4.6 - i * .45]);
  group.userData.colliders = [-3, 3].flatMap(x => [-2, 2].map(z => ({ x, z, halfX: .52, halfZ: .52 })));
  return batchByMaterial(group);
}

export function createCave() {
  const group = new THREE.Group(); group.name = 'cave';
  mesh(group, 'cave-floor', bevelBox(28, .5, 11), 'stone', '#717b73', [-13, -5.25, 0]);
  const vault = new THREE.SphereGeometry(1, 18, 12);
  for (let i = 0; i < vault.index.count; i += 3) {
    const b = vault.index.getX(i + 1); vault.index.setX(i + 1, vault.index.getX(i + 2)); vault.index.setX(i + 2, b);
  }
  for (let i = 0; i < vault.attributes.normal.array.length; i++) vault.attributes.normal.array[i] *= -1;
  const ceiling = mesh(group, 'cave-vault', vault, 'stone', '#555e58', [-13, -1, 0]);
  ceiling.scale.set(15, 6, 7);
  for (let i = 0; i <= 12; i++) {
    const angle = i / 12 * Math.PI;
    const stone = mesh(group, 'arch-stone', crag(1, 1, i), 'stone', i % 2 ? '#879186' : '#a0a59a', [Math.sin(i * 7) * .2, 3 + Math.sin(angle) * 4.3, Math.cos(angle) * 4.3]);
    stone.scale.set(1.05, 1.25, 1.1);
    stone.rotation.x = angle;
  }
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const stone = mesh(group, 'portal-foot', crag(1, 1, i + 3), 'stone', '#90988a', [0, .5 + i, side * 4.3]);
    stone.scale.set(1.1, .9, 1.1);
  }
  for (let i = 0; i < 12; i++) {
    const tooth = mesh(group, 'stalactite', new THREE.ConeGeometry(.22 + i % 3 * .08, 1.1 + i % 4 * .2, 6), 'stone', '#747d72', [-5 - i * 1.6, 2.4 + Math.sin(i) * .4, Math.sin(i * 7) * 3]);
    tooth.rotation.z = Math.PI;
  }
  return batchByMaterial(group);
}

export function createRuins() {
  const group = new THREE.Group(); group.name = 'ruins';
  for (let i = 0; i < 4; i++) {
    const x = i % 2 * 5, z = Math.floor(i / 2) * 5, height = [3.2, 3.2, 2.6, 3.7][i];
    mesh(group, 'column-base', bevelBox(1.3, .28, 1.3, .06), 'stone', '#c5baa2', [x, .14, z]);
    for (let j = 0; j < 4; j++) {
      const shaft = mesh(group, 'column-drum', new THREE.CylinderGeometry(.43, .46, (height - .5) / 4 - .025, 9), 'stone', j % 2 ? '#beb7a6' : '#d2c7b0', [x + Math.sin(i + j) * .025, .3 + (j + .5) * (height - .5) / 4, z]);
      shaft.rotation.y = j * .12;
    }
    mesh(group, 'capital', bevelBox(1.12, .22, 1.12), 'stone', '#c9bda5', [x, height - .1, z]);
  }
  for (let i = 0; i < 5; i++) mesh(group, 'lintel-block', bevelBox(1, .4, .85), 'stone', '#c2b59a', [.5 + i, 3.4, 0]);
  group.userData.colliders = Array.from({ length: 4 }, (_, i) => ({ x: i % 2 * 5, z: Math.floor(i / 2) * 5, halfX: .8, halfZ: .8 }));
  return batchByMaterial(group);
}

export function createWall() {
  const group = new THREE.Group(); group.name = 'wall';
  for (let i = 0; i < 8; i++) {
    const height = 2.72 + Math.sin(i * 3.5) * .07;
    mesh(group, 'wall-plank', bevelBox(.47, height, .17), 'wood', i % 2 ? '#d0b293' : '#c5a886', [(i - 3.5) * .5, height / 2, 0]);
  }
  for (const y of [.5, 2.2]) mesh(group, 'crossbar', bevelBox(4, .17, .1), 'wood', '#b6997b', [0, y, -.11]);
  beam(group, 'diagonal-brace', [-1.8, .45, .11], [1.8, 2.25, .11], .07);
  for (const x of [-1.7, 1.7]) for (const y of [.5, 2.2]) mesh(group, 'nail', new THREE.SphereGeometry(.035, 5, 4), 'stone', '#66716e', [x, y, .12], { metalness: .65, roughness: .4 });
  return batchByMaterial(group);
}

export function createCrystal() {
  const group = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const angle = i * 2.4;
    const shard = mesh(group, 'crystal-shard', new THREE.LatheGeometry([new THREE.Vector2(0, -.45), new THREE.Vector2(.2, -.3), new THREE.Vector2(.19, .35), new THREE.Vector2(0, .75)], 6), 'crystal', '#b9ffeb', [i ? Math.cos(angle) * .4 : 0, i ? -.15 : .2, i ? Math.sin(angle) * .4 : 0]);
    shard.scale.setScalar(i ? .6 + i * .045 : 1);
    shard.rotation.set(i ? Math.sin(angle) * .3 : 0, angle, i ? Math.cos(angle) * .3 : 0);
  }
  const object = new THREE.Mesh(mergeParts(group.children), material('crystal', '#bdffed', { emissive: '#23b49b', emissiveIntensity: 1.3, roughness: .28, metalness: .12 }));
  object.name = 'crystal'; object.castShadow = true;
  return object;
}

export function createCampfire() {
  const group = new THREE.Group(); group.name = 'campfire';
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5;
    const stone = mesh(group, 'fire-ring', crag(.22, 0, i), 'stone', '#9fa99e', [Math.cos(angle) * .67, .12, Math.sin(angle) * .67]);
    stone.scale.y = .65;
  }
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + .5;
    beam(group, 'firewood', [Math.cos(angle) * -.47, .15 + i % 2 * .08, Math.sin(angle) * -.47], [Math.cos(angle) * .47, .15 + i % 2 * .08, Math.sin(angle) * .47], .17, 'wood', '#8d6b4e');
  }
  batchByMaterial(group);
  const flames = new THREE.Group(); flames.name = 'campfire-flames';
  for (let i = 0; i < 5; i++) mesh(flames, `flame-${i}`, new THREE.ConeGeometry(.2, .85, 7), 'flame', '#ffcf75', [Math.sin(i * 2.4) * .2, .63, Math.cos(i * 2.4) * .2], { emissive: '#ff8f28', emissiveIntensity: 1.5, transparent: true, opacity: .9, depthWrite: false });
  group.add(flames);
  return group;
}
