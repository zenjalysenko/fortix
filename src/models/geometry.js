import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const materials = new Map();
export function material(surface, color = '#ffffff', extra = {}) {
  const key = JSON.stringify([surface, color, extra]);
  if (!materials.has(key)) {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .88, ...extra });
    value.userData.surface = surface;
    materials.set(key, value);
  }
  return materials.get(key);
}

export function mesh(parent, name, geometry, surface, color, position = [0, 0, 0], extra) {
  const object = new THREE.Mesh(geometry, material(surface, color, extra));
  object.name = name;
  object.position.fromArray(position);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

export const bevelBox = (w, h, d, radius = .035) => new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 4, h / 4, d / 4));
export function beam(parent, name, start, end, width, surface = 'wood', color = '#ffffff') {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const object = mesh(parent, name, bevelBox(width, a.distanceTo(b), width), surface, color);
  object.position.copy(a).add(b).multiplyScalar(.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return object;
}

export function mergeParts(parts) {
  const baked = parts.map(part => {
    part.updateMatrix();
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    return geometry.applyMatrix4(part.matrix);
  });
  const geometry = mergeGeometries(baked, false);
  for (const part of baked) part.dispose();
  geometry.computeBoundingSphere();
  return geometry;
}

export function batchByMaterial(group) {
  const batches = new Map();
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    if (!batches.has(object.material)) batches.set(object.material, []);
    batches.get(object.material).push(geometry);
  });
  group.clear();
  for (const [surface, geometries] of batches) {
    const object = new THREE.Mesh(mergeGeometries(geometries, false), surface);
    object.name = `${group.name}-${surface.userData.surface}`;
    object.castShadow = object.receiveShadow = true;
    group.add(object);
    for (const geometry of geometries) geometry.dispose();
  }
  return group;
}

export function crag(radius = 1, detail = 1, seed = 0) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const rough = 1 + Math.sin(x * 8 + seed) * Math.cos(z * 7 - y * 6) * .13;
    positions.setXYZ(i, x * rough, Math.max(-radius * .55, y * rough), z * rough);
  }
  geometry.computeVertexNormals();
  return geometry;
}
