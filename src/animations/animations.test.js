import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { animateCharacter } from './characters.js';
import { animateEnvironment } from './environment.js';
import { addTerrainLayers, createSurfaceTextures, textureScene, updateTextures, surfaceNames, characterSurfaceNames } from './textures.js';
import { readFileSync } from 'node:fs';

test('character movement, hit, death and respawn keep world transforms intact', () => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  group.position.set(3, 4, 5);
  const animation = animateCharacter(group);
  animation.strike();
  animation.hit();
  animation.update(1 / 60, { speed: 9.3, grounded: false });
  const rig = group.children[0];
  assert.ok(rig.children[1].rotation.x < 0);
  assert.equal(rig.children[2].rotation.x, -.65);
  assert.deepEqual(group.position.toArray(), [3, 4, 5]);
  for (let i = 0; i < 120; i++) animation.update(1 / 60, { alive: false });
  assert.equal(group.visible, false);
  for (let i = 0; i < 120; i++) animation.update(1 / 60, { alive: true });
  assert.equal(group.visible, true);
  assert.ok(Math.abs(rig.rotation.z) < .001);
  assert.ok(Math.abs(rig.scale.x - 1) < .001);
});

test('tree and rock destruction end at zero scale; new walls finish at full scale', () => {
  const scene = new THREE.Scene();
  function batch(y) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 1);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, y, 0));
    return mesh;
  }
  const trunk = batch(1.7), crowns = batch(5), stones = batch(.6);
  const tree = { x: 0, y: 0, z: 0, index: 0, alive: true };
  const rock = { x: 0, y: 0, z: 0, index: 0 };
  const animation = animateEnvironment({ scene, trunk, crowns, stones, trees: [tree], rocks: [rock], camp: new THREE.Vector3(), textures: { flame: new THREE.Texture() } });
  const matrix = new THREE.Matrix4();
  animation.update(1 / 60, 1);
  crowns.getMatrixAt(0, matrix);
  assert.ok(Math.abs(matrix.elements[12]) > 0);
  animation.hit(tree, 'tree');
  animation.hit(rock, 'stone');
  animation.update(1 / 60, 1);
  const chips = scene.children.find(object => object.isInstancedMesh);
  assert.equal(chips.count, 10);
  for (let i = 0; i < chips.count; i++) {
    chips.getMatrixAt(i, matrix);
    assert.ok(matrix.elements.every(Number.isFinite));
  }
  for (let i = 0; i < 90; i++) animation.update(1 / 60, i / 60);
  assert.equal(chips.count, 0);
  stones.getMatrixAt(0, matrix);
  assert.equal(matrix.elements[0], 1);
  tree.alive = false;
  animation.hit(tree, 'tree', true);
  animation.hit(rock, 'stone', true);
  assert.ok(scene.getObjectByName('wood'));
  assert.ok(scene.getObjectByName('stone'));
  const wall = new THREE.Mesh();
  animation.place(wall);
  for (let i = 0; i < 120; i++) animation.update(1 / 60, i / 60);
  for (const mesh of [trunk, crowns, stones]) {
    mesh.getMatrixAt(0, matrix);
    assert.ok(matrix.elements.every(Number.isFinite));
    assert.ok(Math.abs(matrix.determinant()) < .000001);
  }
  assert.equal(wall.scale.y, 1);
  assert.equal(scene.getObjectByName('wood'), undefined);
  assert.equal(scene.getObjectByName('stone'), undefined);
});

test('texture motion wraps offsets and leaves solid surfaces alone', () => {
  const textures = Object.fromEntries(['water', 'crystal', 'flame', 'stone'].map(name => [name, new THREE.Texture()]));
  updateTextures(textures, 36000);
  assert.deepEqual(textures.stone.offset.toArray(), [0, 0]);
  for (const texture of Object.values(textures)) {
    assert.ok(texture.offset.toArray().every(v => Number.isFinite(v) && Math.abs(v) < 1));
  }
});

test('terrain gets texture coordinates and glowing eyes retain their material', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 8, 0, 0, 0, 0, 8], 3));
  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshStandardMaterial({ emissive: '#ff9900' }));
  scene.add(terrain, eye);
  const ground = new THREE.Texture();
  textureScene(scene, { ground });
  assert.equal(terrain.material.map, ground);
  assert.deepEqual(Array.from(geometry.attributes.uv.array), [0, 0, 1, 0, 0, 1]);
  assert.equal(eye.material.map, null);
});

test('terrain shader blends all four biome textures', () => {
  const material = new THREE.MeshStandardMaterial();
  const textures = { sand: new THREE.Texture(), snow: new THREE.Texture(), stone: new THREE.Texture() };
  addTerrainLayers(material, textures);
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.sandMap.value, textures.sand);
  assert.equal(shader.uniforms.snowMap.value, textures.snow);
  assert.equal(shader.uniforms.rockMap.value, textures.stone);
  assert.ok(shader.vertexShader.includes('vTerrain = vec2(position.y, normal.y)'));
  assert.ok(shader.fragmentShader.includes('texture2D(map, vMapUv)'));
  assert.ok(!shader.fragmentShader.includes('#include <map_fragment>'));
});

test('all generated surface PNGs are present and large enough for game materials', () => {
  for (const name of surfaceNames) {
    const data = readFileSync(new URL(`../../assets/textures/${name}.png`, import.meta.url));
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name);
    assert.ok(data.readUInt32BE(16) >= 512 && data.readUInt32BE(20) >= 512, name);
  }
  for (const name of characterSurfaceNames) {
    const data = readFileSync(new URL(`../../assets/textures/characters/${name}.png`, import.meta.url));
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name);
    assert.ok(data.readUInt32BE(16) >= 512 && data.readUInt32BE(20) >= 512, name);
  }
});

test('axe follows equipment state and landing settles back to neutral', () => {
  const group = new THREE.Group();
  const animation = animateCharacter(group);
  const rig = group.getObjectByName('character-rig'), axe = group.getObjectByName('axe');
  animation.update(1 / 60, { equipped: true, grounded: false });
  assert.equal(axe.visible, true);
  animation.update(1 / 60, { equipped: false, grounded: true });
  assert.equal(axe.visible, false);
  assert.ok(rig.scale.y < 1);
  const torch = group.getObjectByName('equipped-torch');
  animation.update(1 / 60, { hasTorch: true, torchOn: false });
  assert.equal(torch.visible, true);
  assert.equal(torch.getObjectByName('torch-flame').visible, false);
  animation.update(1 / 60, { hasTorch: true, torchOn: true });
  assert.equal(torch.getObjectByName('torch-flame').visible, true);
  for (let i = 0; i < 30; i++) animation.update(1 / 60);
  assert.equal(rig.scale.y, 1);
});

test('hero and enemy use separate face and clothing textures on animated heads', () => {
  const textures = Object.fromEntries([...surfaceNames, ...characterSurfaceNames].map(name => [name, new THREE.Texture()]));
  for (const enemy of [false, true]) {
    const group = new THREE.Group();
    const animation = animateCharacter(group, { enemy });
    textureScene(group, textures);
    const head = group.getObjectByName(enemy ? 'enemy-head' : 'hero-head');
    const body = group.getObjectByName(enemy ? 'enemy-body' : 'hero-jacket');
    assert.equal(head.material[4].map, textures[enemy ? 'enemy-mask' : 'hero-face']);
    assert.equal(body.material.map, textures[enemy ? 'enemy-robes' : 'hero-jacket']);
    animation.strike();
    animation.update(1 / 60, { speed: 0 });
    assert.notEqual(head.parent.rotation.x, 0);
    assert.ok(head.parent.rotation.toArray().slice(0, 3).every(Number.isFinite));
    assert.equal(group.getObjectByName(head.name), head);
  }
});

test('browser texture catalogue is WebP and stays below 2 MB', () => {
  let bytes=0;
  for(const name of [...surfaceNames,...characterSurfaceNames]) {
    const folder=characterSurfaceNames.includes(name)?'characters/':'';
    const data=readFileSync(new URL(`../../assets/textures/runtime/${folder}${name}.webp`,import.meta.url));
    assert.equal(data.subarray(0,4).toString(),'RIFF',name);
    assert.equal(data.subarray(8,12).toString(),'WEBP',name);
    assert.equal(data.readUInt32LE(4)+8,data.length,name);bytes+=data.length;
  }
  assert.ok(bytes<2_000_000,`${bytes} browser texture bytes`);
});

test('runtime WebP textures load from their folder and face decals never repeat', () => {
  const previousDocument = globalThis.document, originalLoad = THREE.ImageLoader.prototype.load;
  const urls = [];
  try {
    globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {} }) }) };
    THREE.ImageLoader.prototype.load = function(url, onLoad) {
      urls.push(url);
      const image = { width: 1024, height: 1024 };
      onLoad(image);
      return image;
    };
    const textures = createSurfaceTextures();
    assert.equal(urls.length, surfaceNames.length + characterSurfaceNames.length);
    for (const name of characterSurfaceNames) {
      assert.ok(urls.some(url => url.endsWith(`/runtime/characters/${name}.webp`)), name);
      assert.equal(textures[name].image.width, 1024);
    }
    for (const name of ['hero-face', 'enemy-mask']) {
      assert.deepEqual(textures[name].repeat.toArray(), [1, 1]);
      assert.equal(textures[name].wrapS, THREE.ClampToEdgeWrapping);
      assert.equal(textures[name].wrapT, THREE.ClampToEdgeWrapping);
    }
    assert.deepEqual(textures['hero-jacket'].repeat.toArray(), [2, 2]);
  } finally {
    THREE.ImageLoader.prototype.load = originalLoad;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
