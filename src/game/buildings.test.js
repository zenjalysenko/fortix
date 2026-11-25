import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBuilding, buildingBoxes, placement, placementReason, overlaps } from './buildings.js';
import { createState, buildingTypes, insideBox } from './rules.js';
import { createCharacter } from '../models/index.js';
import { equipModels } from './equipment.js';

const terrain=()=>5;
test('all seven building models have finite bounds and an operable door leaf', () => {
  for(const type of buildingTypes){
    const model=createBuilding(type),size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    assert.ok(size.toArray().every(v=>v>0&&Number.isFinite(v)),type);
  }
  const door=createBuilding('door');assert.ok(door.getObjectByName('door-leaf'));
  const b={type:'door',x:0,y:5,z:0,yaw:0};
  assert.equal(buildingBoxes(b).some(box=>insideBox(0,0,box)),true);
  assert.equal(buildingBoxes({...b,open:true}).some(box=>insideBox(0,0,box)),false);
});

test('placement snaps floors and edges, uses floor height and requires support', () => {
  const p={x:0,z:0,yaw:0},s=createState();s.floor=1;s.roof=1;s.wall=1;
  const b=placement('floor',p,0,[],terrain);assert.deepEqual([b.x,b.y,b.z],[0,5,-4]);
  assert.equal(placementReason(b,s,p,terrain,[]),'');
  s.structures.push(b);
  const roof=placement('roof',p,0,s.structures,terrain);assert.equal(roof.y,5.22);
  assert.equal(placementReason(roof,s,p,terrain,[]),'');
  const wall=placement('wall',p,0,s.structures,terrain);assert.equal(wall.z,-2);
  assert.equal(placementReason(wall,s,p,terrain,[]),'');
  const missing=createState();missing.roof=1;assert.match(placementReason(roof,missing,p,terrain,[]),/пол|под постройкой|підлога/);
});

test('placement rejects occupied cells, obstacles, steep ground, cave and missing kit', () => {
  const p={x:0,z:0,yaw:0},s=createState();s.floor=2;
  const b=placement('floor',p,0,[],terrain);
  assert.ok(placementReason(b,s,p,terrain,[{x:0,z:-4,halfX:1,halfZ:1}]));
  assert.ok(placementReason(b,s,p,(x)=>x*2,[]));
  s.structures.push(b);assert.ok(placementReason(b,s,p,terrain,[]));
  s.structures=[];s.cave=true;assert.ok(placementReason(b,s,p,terrain,[]));
  s.cave=false;s.floor=0;assert.ok(placementReason(b,s,p,terrain,[]));
});

test('unsupported walls use final snapped edge height and open doors reserve their footprint', () => {
  const wall=placement('wall',{x:.9,z:0,yaw:0},Math.PI/2,[],(x,z)=>x+z);
  assert.equal(wall.y,wall.x+wall.z);
  const s=createState();s.wall=1;s.structures=[{type:'door',x:0,y:5,z:0,yaw:0,open:true}];
  assert.ok(placementReason({type:'wall',x:0,y:5,z:0,yaw:0},s,{x:0,z:-5},terrain,[]));
});

test('rotated footprints reject crossings and allow touching edges', () => {
  const a={x:0,z:0,halfX:2,halfZ:.2,yaw:0};
  assert.equal(overlaps(a,{...a,yaw:Math.PI/2}),true);
  assert.equal(overlaps(a,{...a,x:4}),false);
  assert.equal(overlaps(a,{...a,z:4,yaw:Math.PI/2}),false);
  const s=createState();s.wall=1;s.structures=[{type:'wall',x:0,y:5,z:2,yaw:0}];
  assert.equal(placementReason({type:'wall',x:2,y:5,z:0,yaw:Math.PI/2},s,{x:0,z:-5},terrain,[]),'');
});

test('equipment models follow selected weapon and passive armor state', () => {
  const avatar=createCharacter(),equipment=equipModels(avatar),s=createState();
  s.equipped='spear';s.armor=1;equipment.update(s);
  assert.equal(avatar.getObjectByName('equipped-spear').visible,true);
  assert.equal(avatar.getObjectByName('equipped-bow').visible,false);
  assert.equal(avatar.getObjectByName('armor-plate').visible,true);
  s.equipped='bow';s.armor=0;equipment.update(s);
  assert.equal(avatar.getObjectByName('equipped-spear').visible,false);
  assert.equal(avatar.getObjectByName('equipped-bow').visible,true);
  assert.equal(avatar.getObjectByName('armor-plate').visible,false);
});
