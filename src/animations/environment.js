import * as THREE from 'three';
import { createCampfire, createResource } from '../models/index.js';
import { textureScene } from './textures.js';

export function animateEnvironment({ scene, trunk, crowns, stones, trees, camp, textures }) {
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
  const rest = mesh => Array.from({ length: mesh.count }, (_, i) => {
    mesh.getMatrixAt(i, matrix);
    matrix.decompose(position, rotation, scale);
    return { position: position.clone(), rotation: rotation.clone(), scale: scale.clone() };
  });
  const treeRest = rest(trunk), crownRest = rest(crowns), rockRest = rest(stones);
  const hits = new Map(), falls = new Map(), placements = [];
  const debris = [], rewards = [];
  const chips = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .12, .12), new THREE.MeshStandardMaterial({ roughness: 1 }), 48);
  chips.material.userData.surface = 'stone';
  chips.count = 0;
  // Particles can leave their initial bounds during flight.
  chips.frustumCulled = false;
  scene.add(chips);
  const tilt = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1);
  const fire = createCampfire();
  fire.position.copy(camp);
  const flames = fire.getObjectByName('campfire-flames').children;
  for (const flame of flames) flame.material.map = textures.flame;
  const light = new THREE.PointLight('#ffab51', 10, 12);
  light.position.y = 1;
  fire.add(light);
  scene.add(fire);
  const sparkData = new Float32Array(24 * 3);
  const sparks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffd582', size: .055, transparent: true, opacity: .7, depthWrite: false }));
  sparks.geometry.setAttribute('position', new THREE.BufferAttribute(sparkData, 3));
  fire.add(sparks);
  function write(mesh, index, base, angle = 0, shrink = 1, pivot) {
    tilt.setFromAxisAngle(axis, angle);
    rotation.copy(tilt).multiply(base.rotation);
    scale.copy(base.scale).multiplyScalar(shrink);
    position.copy(base.position);
    if (pivot) {
      const height = base.position.y - pivot.y;
      position.x = pivot.x - Math.sin(angle) * height;
      position.y = pivot.y + Math.cos(angle) * height;
    }
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  }
  function loot(kind, target) {
    const model = createResource(kind);
    const y = target.y ?? target.group?.position.y ?? 0;
    model.position.set(target.x + Math.sin(kind.length * 2) * .3, y + .7, target.z + Math.cos(kind.length * 2) * .3);
    model.scale.setScalar(.7);
    textureScene(model, textures);
    scene.add(model);
    rewards.push({ model, age: 0, y: model.position.y });
  }
  return {
    loot,
    hit(target, kind, destroyed = false) {
      if (destroyed) { hits.delete(target); falls.set(target, { age: 0, kind }); loot(kind === 'tree' ? 'wood' : 'stone', target); }
      else hits.set(target, { age: 0, kind });
      for (let i = 0; i < (destroyed ? 12 : 5); i++) {
        if (debris.length === 48) debris.shift();
        const angle = i * 2.4;
        debris.push({ x: target.x, y: target.y + 1, z: target.z, vx: Math.sin(angle) * 1.6, vy: 1.8 + i % 3 * .5, vz: Math.cos(angle) * 1.6, age: 0, color: kind === 'tree' ? '#b08d62' : '#a2aaa1' });
      }
    },
    place(mesh) { placements.push({ mesh, age: 0 }); },
    update(dt, time) {
      for (const item of hits.values()) item.age += dt;
      for (const item of falls.values()) item.age += dt;
      for (const tree of trees) {
        const fall = falls.get(tree), hit = hits.get(tree);
        if (!tree.alive && !fall) continue;
        const angle = fall ? Math.min(1, fall.age / .8) ** 2 * 1.5 : Math.sin(time * 1.7 + tree.x) * .025 + (hit ? Math.sin(hit.age * 45) * .13 * Math.max(0, 1 - hit.age / .4) : 0);
        const shrink = fall ? Math.max(0, 1 - Math.max(0, fall.age - .65) / .3) : 1;
        write(trunk, tree.index, treeRest[tree.index], angle, shrink, tree);
        write(crowns, tree.index, crownRest[tree.index], angle, shrink, tree);
      }
      for (const [target, item] of [...hits, ...falls]) {
        if (item.kind === 'stone') write(stones, target.index, rockRest[target.index], Math.sin(item.age * 48) * .12 * Math.max(0, 1 - item.age / .5), falls.has(target) ? Math.max(0, 1 - item.age / .4) : 1);
        if (item.age > 1) { hits.delete(target); falls.delete(target); }
      }
      trunk.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = stones.instanceMatrix.needsUpdate = true;
      for (let i = debris.length - 1; i >= 0; i--) {
        const chip = debris[i];
        chip.age += dt;
        chip.vy -= dt * 6;
        chip.x += chip.vx * dt;
        chip.y += chip.vy * dt;
        chip.z += chip.vz * dt;
        if (chip.age >= .7) debris.splice(i, 1);
      }
      chips.count = debris.length;
      for (let i = 0; i < debris.length; i++) {
        const chip = debris[i];
        position.set(chip.x, chip.y, chip.z);
        rotation.setFromAxisAngle(axis, chip.age * 7);
        scale.setScalar(1 - chip.age / .7);
        matrix.compose(position, rotation, scale);
        chips.setMatrixAt(i, matrix);
        chips.setColorAt(i, new THREE.Color(chip.color));
      }
      chips.instanceMatrix.needsUpdate = true;
      if (chips.instanceColor) chips.instanceColor.needsUpdate = true;
      for (let i = rewards.length - 1; i >= 0; i--) {
        const reward = rewards[i]; reward.age += dt;
        reward.model.position.y = reward.y + reward.age * .65;
        reward.model.rotation.y += dt * 1.5;
        reward.model.scale.setScalar(.7 * Math.max(0, 1 - Math.max(0, reward.age - .7) / .5));
        if (reward.age >= 1.2) {
          scene.remove(reward.model);
          reward.model.traverse(part => { if (part.isMesh) part.geometry.dispose(); });
          rewards.splice(i, 1);
        }
      }
      for (let i = placements.length - 1; i >= 0; i--) {
        const item = placements[i];
        item.age += dt;
        const t = Math.min(1, item.age / .4);
        item.mesh.scale.y = Math.max(.01, 1 - (1 - t) ** 3 + Math.sin(t * Math.PI) * .12);
        if (t === 1) placements.splice(i, 1);
      }
      flames.forEach((flame, i) => {
        flame.scale.set(1 + Math.sin(time * 9 + i) * .15, 1 + Math.sin(time * 12 + i * 2) * .3, 1);
        flame.rotation.z = Math.sin(time * 6 + i) * .15;
      });
      light.intensity = 9 + Math.sin(time * 13) + Math.sin(time * 19) * .7;
      for (let i = 0; i < 24; i++) {
        const age = (time * .45 + i / 24) % 1;
        sparkData[i * 3] = Math.sin(i * 7 + age * 3) * age * .5;
        sparkData[i * 3 + 1] = .4 + age * 2;
        sparkData[i * 3 + 2] = Math.cos(i * 5 + age * 2) * age * .5;
      }
      sparks.geometry.attributes.position.needsUpdate = true;
    },
  };
}
