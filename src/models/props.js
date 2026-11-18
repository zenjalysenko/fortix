import * as THREE from 'three';
import { mesh, bevelBox, beam, batchByMaterial, crag } from './geometry.js';

export function createAxe() {
  const group = new THREE.Group(); group.name = 'axe';
  const handle = mesh(group, 'axe-handle', new THREE.LatheGeometry([new THREE.Vector2(.045, -.4), new THREE.Vector2(.035, -.22), new THREE.Vector2(.04, .12), new THREE.Vector2(.05, .35)], 8), 'wood', '#d7b68d');
  handle.rotation.z = -.08;
  const shape = new THREE.Shape();
  shape.moveTo(-.08, .08); shape.lineTo(.12, .04); shape.lineTo(.43, .1); shape.lineTo(.48, .34); shape.lineTo(.28, .43); shape.lineTo(.02, .33); shape.lineTo(-.1, .3); shape.closePath();
  mesh(group, 'chipped-blade', new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 1, steps: 1 }), 'stone', '#c6cfca', [0, 0, -.045]);
  for (let i = 0; i < 4; i++) {
    const tie = mesh(group, 'blade-binding', new THREE.TorusGeometry(.066, .014, 4, 8), 'leather', '#997758', [0, .15 + i * .047, 0]);
    tie.rotation.x = Math.PI / 2;
  }
  return batchByMaterial(group);
}

export function createTorch() {
  const group = new THREE.Group(); group.name = 'torch';
  mesh(group, 'torch-shaft', new THREE.CylinderGeometry(.04, .065, .7, 8), 'wood', '#d7b68d');
  mesh(group, 'wrapped-head', new THREE.CylinderGeometry(.1, .065, .22, 8), 'cloth', '#d4b688', [0, .34, 0]);
  for (let i = 0; i < 3; i++) {
    const tie = mesh(group, 'torch-binding', new THREE.TorusGeometry(.085, .018, 4, 8), 'leather', '#9c7850', [0, .27 + i * .065, 0]);
    tie.rotation.x = Math.PI / 2;
  }
  const flame = mesh(group, 'torch-flame', new THREE.ConeGeometry(.12, .42, 7), 'flame', '#ffcc6c', [0, .62, 0], { emissive: '#ff861c', emissiveIntensity: 1.6 });
  flame.userData.animated = true;
  return group;
}

export function createBackpack() {
  const group = new THREE.Group(); group.name = 'hero-backpack';
  mesh(group, 'pack-body', bevelBox(.52, .66, .29, .09), 'hero-backpack', '#ffffff');
  mesh(group, 'pack-flap', bevelBox(.55, .18, .33, .06), 'hero-backpack', '#e3dbc8', [0, .22, -.025]);
  mesh(group, 'outer-pocket', bevelBox(.34, .26, .12), 'hero-backpack', '#ffffff', [0, -.12, -.18]);
  for (const x of [-.19, .19]) {
    mesh(group, 'shoulder-strap', bevelBox(.065, .64, .06), 'leather', '#b9a080', [x, .02, .17]);
    mesh(group, 'flap-strap', bevelBox(.05, .3, .04), 'leather', '#a88867', [x * .7, .09, -.21]);
    mesh(group, 'buckle', bevelBox(.075, .055, .025), 'stone', '#d6bc80', [x * .7, -.015, -.24], { metalness: .6, roughness: .4 });
  }
  const loop = mesh(group, 'carry-loop', new THREE.TorusGeometry(.08, .023, 4, 10, Math.PI), 'leather', '#bca080', [0, .34, 0]);
  loop.scale.y = .75;
  return batchByMaterial(group);
}

export function createResource(kind) {
  const group = new THREE.Group(); group.name = kind;
  if (kind === 'wood') {
    for (let i = 0; i < 3; i++) {
      const log = mesh(group, 'log', new THREE.CylinderGeometry(.1, .12, .7, 8), 'wood', '#dabf99', [(i - 1) * .17, .12 + (i === 1 ? .13 : 0), 0]);
      log.rotation.x = Math.PI / 2;
    }
    for (const z of [-.2, .2]) beam(group, 'bundle-cord', [-.3, .2, z], [.3, .2, z], .035, 'leather', '#b19974');
  } else if (kind === 'stone' || kind === 'ore') {
    mesh(group, 'resource-rock', crag(.38, 1, 4), 'stone', '#bac4ba', [0, .2, 0]);
    if (kind === 'ore') for (let i = 0; i < 6; i++) mesh(group, 'mineral', new THREE.OctahedronGeometry(.105), 'stone', '#e6b96c', [Math.sin(i * 2.4) * .3, .35 + i % 3 * .08, Math.cos(i * 2.4) * .3], { metalness: .65, roughness: .35 });
  } else if (kind === 'berries') {
    beam(group, 'berry-stem', [-.25, .1, 0], [.2, .5, 0], .035);
    for (let i = 0; i < 7; i++) mesh(group, 'berry', new THREE.SphereGeometry(.085, 8, 6), 'skin', '#ac3a64', [Math.sin(i * 2.4) * .17, .15 + i * .04, Math.cos(i * 2.4) * .12], { roughness: .5 });
    for (const side of [-1, 1]) {
      const leaf = mesh(group, 'berry-leaf', new THREE.SphereGeometry(.12, 6, 4), 'leaves', '#a6cd8d', [side * .14, .45, 0]);
      leaf.scale.set(1.5, .2, .6); leaf.rotation.z = side * .45;
    }
  } else if (kind === 'meat') {
    const steak = mesh(group, 'steak', new THREE.CylinderGeometry(.3, .32, .14, 12), 'skin', '#b75b57', [0, .1, 0]);
    steak.scale.x = 1.35;
    mesh(group, 'bone', new THREE.CylinderGeometry(.075, .075, .15, 9), 'stone', '#f4e4c9', [.1, .12, 0]);
  } else throw new Error(`Unknown resource: ${kind}`);
  return batchByMaterial(group);
}
