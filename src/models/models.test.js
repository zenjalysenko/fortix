import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { modelCatalog } from './catalog.js';
import { createCharacter, characterParts, createShelter, createRuins, createWall, createPineGeometries, createRockGeometry, terrain, createIsland, createOcean } from './index.js';

test('ocean waves update one GPU uniform without changing CPU geometry', () => {
  const ocean=createOcean(),positions=ocean.geometry.attributes.position,normals=ocean.geometry.attributes.normal;
  const version=positions.version,normalVersion=normals.version;
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader};
  ocean.material.onBeforeCompile(shader);
  ocean.material.userData.waveTime.value=12;
  assert.equal(shader.uniforms.waveTime.value,12);
  assert.ok(shader.vertexShader.includes('transformed.z += sin'));
  assert.ok(shader.vertexShader.includes('objectNormal = normalize(vec3'));
  assert.equal(positions.version,version);assert.equal(normals.version,normalVersion);
});

test('every model has finite geometry, normals, UVs and nonzero bounds', () => {
  for (const [name, create] of Object.entries(modelCatalog)) {
    const object = create();
    let triangles = 0;
    object.traverse(part => {
      if (!part.isMesh) return;
      const geometry = part.geometry;
      for (const attribute of ['position', 'normal', 'uv']) {
        assert.ok(geometry.attributes[attribute], `${name}: ${attribute}`);
        assert.ok(geometry.attributes[attribute].array.every(Number.isFinite), `${name}: finite ${attribute}`);
      }
      triangles += (geometry.index?.count || geometry.attributes.position.count) / 3;
    });
    const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    assert.ok(size.toArray().every(v => v > 0 && Number.isFinite(v)), name);
    assert.ok(triangles > 20 && triangles < (name === 'island' || name === 'ocean' ? 50000 : 6000), `${name}: triangle budget`);
  }
});

test('character hierarchy supports independent procedural and exported animations', () => {
  for (const enemy of [false, true]) {
    const model = createCharacter({ enemy });
    const parts = characterParts(model);
    assert.ok(parts.rig && parts.torso && parts.head && parts.axe && parts.torch);
    assert.equal(parts.limbs.length, 4);
    assert.deepEqual(model.animations.map(clip => clip.name), ['idle', 'walk', 'run', 'attack', 'jump', 'hurt', 'death']);
    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(model.animations.find(clip => clip.name === 'walk'));
    action.play(); mixer.update(.2);
    assert.ok(Math.abs(parts.limbs[0].quaternion.x) > .1);
    assert.ok(Math.abs(parts.limbs[0].quaternion.x + parts.limbs[1].quaternion.x) < .001);
    const clone = model.clone(true);
    const cloneParts = characterParts(clone);
    cloneParts.head.rotation.y = .4;
    assert.equal(parts.head.rotation.y, 0);
  }
});

test('landmark and wall bounds stay within gameplay footprints', () => {
  for (const create of [createShelter, createRuins]) {
    const object = create();
    assert.equal(object.userData.colliders.length, 4);
    for (const collider of object.userData.colliders) assert.ok([collider.x, collider.z, collider.halfX, collider.halfZ].every(Number.isFinite));
  }
  const wallBounds = new THREE.Box3().setFromObject(createWall());
  assert.ok(wallBounds.min.x >= -2.05 && wallBounds.max.x <= 2.05);
  assert.ok(wallBounds.min.z >= -.175 && wallBounds.max.z <= .175);
  assert.ok(wallBounds.min.y >= -.001 && wallBounds.max.y <= 2.8);
  assert.ok(createPineGeometries().crown.attributes.position.count > 200);
  assert.ok(createRockGeometry().attributes.position.count > 100);
});

test('island mesh and gameplay heights agree, including cave plateau', () => {
  const island = createIsland();
  const positions = island.geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 29) {
    assert.ok(Math.abs(positions.getY(i) - terrain(positions.getX(i), positions.getZ(i))) < .0001);
  }
  assert.equal(terrain(-75, -24), 8);
  assert.equal(terrain(160, 160), -.8);
});

test('all GLB files have valid chunks, buffers, animation references and local textures', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../assets/models/manifest.json', import.meta.url)));
  assert.equal(manifest.models.length, Object.keys(modelCatalog).length);
  for (const model of manifest.models) {
    const file = new URL(`../../assets/models/${model.file}`, import.meta.url);
    const data = readFileSync(file);
    assert.equal(data.readUInt32LE(0), 0x46546c67, model.name);
    assert.equal(data.readUInt32LE(4), 2);
    assert.equal(data.readUInt32LE(8), data.length);
    assert.equal(data.length, model.bytes);
    const jsonSize = data.readUInt32LE(12);
    assert.equal(jsonSize % 4, 0);
    assert.equal(data.readUInt32LE(16), 0x4e4f534a);
    const document = JSON.parse(data.subarray(20, 20 + jsonSize));
    const binaryOffset = 20 + jsonSize;
    assert.equal(data.readUInt32LE(binaryOffset + 4), 0x004e4942);
    const binaryLength = data.readUInt32LE(binaryOffset);
    assert.equal(binaryOffset + 8 + binaryLength, data.length);
    assert.ok(document.buffers[0].byteLength <= binaryLength);
    for (const view of document.bufferViews) assert.ok((view.byteOffset || 0) + view.byteLength <= binaryLength, model.name);
    for (const image of document.images) assert.ok(existsSync(new URL(image.uri, file)), `${model.name}: ${image.uri}`);
    for (const material of document.materials) {
      const transform = material.pbrMetallicRoughness?.baseColorTexture?.extensions?.KHR_texture_transform;
      if (transform) { assert.ok(transform.scale[1] < 0); assert.deepEqual(transform.offset, [0, 1]); }
    }
    for (const animation of document.animations || []) for (const channel of animation.channels) {
      assert.ok(document.nodes[channel.target.node]);
      const sampler = animation.samplers[channel.sampler];
      assert.ok(document.accessors[sampler.input] && document.accessors[sampler.output]);
    }
    if (model.name === 'hero' || model.name === 'wanderer') assert.equal(document.animations.length, 7);
  }
});
