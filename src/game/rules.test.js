import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, craftItem, craftReason, useItem, advanceQuest, enemyIntent, loadSave, seededRandom, insideBox } from './rules.js';

test('crafting is atomic, checks upgrades, uniqueness and proximity to fire', () => {
  const s=createState();s.wood=20;s.stone=10;s.ore=20;
  assert.equal(craftItem(s,'ironAxe',true),false);assert.equal(s.ore,20);
  assert.equal(craftItem(s,'axe',false),true);assert.equal(s.wood,17);assert.equal(s.stone,8);
  assert.equal(craftItem(s,'axe',false),false);assert.equal(s.wood,17);
  assert.equal(craftItem(s,'ironAxe',false),false);assert.equal(craftItem(s,'ironAxe',true),true);
  assert.equal(craftItem(s,'arrows',false),true);assert.equal(s.arrows,5);
  assert.ok(craftReason(s,'missing'));
});

test('flask water can be purified then consumed, meat needs cooking, tools equip', () => {
  const s=createState();s.flask=1;s.dirtyWater=4;s.wood=2;s.meat=1;s.water=20;s.food=20;
  assert.equal(craftItem(s,'cleanWater',false),false);
  assert.equal(craftItem(s,'cleanWater',true),true);
  assert.equal(s.dirtyWater,3);assert.equal(s.cleanWater,1);
  useItem(s,'cleanWater');assert.equal(s.water,65);assert.equal(s.cleanWater,0);
  useItem(s,'meat');assert.equal(s.meat,1);
  assert.equal(craftItem(s,'cookedMeat',true),true);useItem(s,'cookedMeat');assert.equal(s.food,68);
  s.spear=1;useItem(s,'spear');assert.equal(s.equipped,'spear');
  s.torch=1;useItem(s,'torch');assert.equal(s.torchOn,true);
  s.food=100;const berries=s.berries;useItem(s,'berries');assert.equal(s.berries,berries);
});

test('quest sequence requires materials, axe, shelter, a living night through dawn and cave', () => {
  const s=createState();s.caveExplored=true;
  advanceQuest(s);assert.equal(s.quest,0);
  s.gatheredWood=3;s.gatheredStone=2;advanceQuest(s);assert.equal(s.quest,1);
  s.axe=1;advanceQuest(s);assert.equal(s.quest,2);
  s.structures=[{type:'floor',x:0,z:0},{type:'roof',x:0,z:0},
    {type:'door',x:0,z:2,yaw:0},{type:'wall',x:0,z:-2,yaw:0},
    {type:'wall',x:2,z:0,yaw:Math.PI/2},{type:'wall',x:-2,z:0,yaw:Math.PI/2}];
  advanceQuest(s);assert.equal(s.quest,3);
  s.time=21;advanceQuest(s);assert.equal(s.nightDay,1);
  s.day=2;s.time=5;advanceQuest(s);assert.equal(s.quest,3);
  s.hp=0;s.time=6;advanceQuest(s);assert.equal(s.quest,3);
  s.hp=100;advanceQuest(s);assert.equal(s.quest,5);
});

test('enemy behaviors patrol, guard a territory, flee, sleep by day and avoid cave attacks', () => {
  const e={x:0,z:0,spawnX:0,spawnZ:0,hp:6,phase:0,type:'patrol'};
  assert.equal(enemyIntent(e,{x:0,z:0},12,0).speed,0);
  assert.equal(enemyIntent(e,{x:1,z:1},12,0).attack,true);
  assert.equal(enemyIntent(e,{x:50,z:50},12,0).attack,false);
  assert.equal(enemyIntent({...e,type:'skittish'},{x:2,z:0},12,0).x,-2);
  assert.equal(enemyIntent({...e,type:'nocturnal'},{x:1,z:0},12,0).attack,false);
  assert.equal(enemyIntent({...e,type:'nocturnal'},{x:1,z:0},22,0).attack,true);
  assert.equal(enemyIntent({...e,type:'guard',x:25},{x:26,z:0},12,0).attack,false);
  assert.equal(enemyIntent(e,{x:1,z:0,cave:true},22,0).attack,false);
});

test('save round trip preserves base, chest, spawn, harvested nodes, markers and preferences', () => {
  const state=createState();state.seed=1234;state.caveLoot=true;state.equipped='bow';state.bow=1;
  state.spawn={x:4,z:8};state.markers=[{x:2,z:3}];state.harvested=['tree-2','rock-7'];
  state.structures=[{type:'chest',x:4,y:10,z:8,yaw:Math.PI/2,items:{wood:12}}];
  state.settings={volume:0,sensitivity:2,quality:'low'};
  state.enemyState=[{x:12,z:8,hp:3,alive:true,respawn:0,attack:.4,cacheOre:2},{x:-20,z:8,hp:0,alive:false,respawn:120,attack:0,cacheOre:0}];
  const result=loadSave(JSON.stringify({version:2,state,player:{x:5,z:8}}));
  assert.equal(result.state.structures[0].items.wood,12);assert.deepEqual(result.state.spawn,state.spawn);
  assert.deepEqual(result.state.harvested,state.harvested);assert.deepEqual(result.state.markers,state.markers);
  assert.deepEqual(result.state.settings,state.settings);assert.equal(result.state.caveLoot,true);
  assert.equal(result.state.seed,1234);assert.equal(result.state.equipped,'bow');assert.equal(result.player.x,5);
  assert.deepEqual(result.state.enemyState,state.enemyState);
});

test('save loading handles corruption, invalid coordinates, malicious data and older saves', () => {
  assert.equal(loadSave('{broken'),null);assert.equal(loadSave('null'),null);
  const result=loadSave(JSON.stringify({state:{hp:1000,wood:-2,quest:200,weapon:1,structures:[{type:'bad',x:0,y:0,z:0,yaw:0}],markers:[{x:'bad',z:0}],settings:{volume:-20}},player:{x:Infinity,z:0}}));
  assert.equal(result.state.hp,100);assert.equal(result.state.wood,0);assert.equal(result.state.quest,5);
  assert.equal(result.state.axe,1);assert.equal(result.state.structures.length,0);assert.equal(result.state.markers.length,0);
  assert.equal(result.state.settings.volume,0);assert.equal(result.player.x,0);
});

test('loading bounds quantities, migrates old equipment and rejects inconsistent cave and enemy state', () => {
  assert.equal(loadSave('{"state":[]}'),null);
  const {state,player}=loadSave(JSON.stringify({state:{wood:2.8,axe:200,bow:0,equipped:'bow',torch:true,wallKit:3,cave:true,flask:1,cleanWater:3,dirtyWater:9,
    harvested:['tree-1','tree-1',null,{}],enemyState:[{x:0,z:0,hp:0,alive:true,attack:-10,respawn:500,cacheOre:30}]},player:{x:149,z:0}}));
  assert.equal(state.wood,2);assert.equal(state.axe,1);assert.equal(state.torch,1);assert.equal(state.wall,3);
  assert.equal(state.equipped,'hands');assert.equal(state.cleanWater+state.dirtyWater,4);
  assert.equal(state.cave,false);assert.equal(player.x,0);assert.deepEqual(state.harvested,['tree-1']);
  assert.equal(state.enemyState[0].alive,false);assert.equal(state.enemyState[0].respawn,300);assert.equal(state.enemyState[0].attack,0);
  const cave=loadSave(JSON.stringify({state:{cave:true},player:{x:-76,z:-24}}));assert.equal(cave.state.cave,true);
});

test('seeded generation reproduces world placement and rotated colliders have finite checks', () => {
  const a=seededRandom(123),b=seededRandom(123),c=seededRandom(124);
  for(let i=0;i<100;i++){const v=a();assert.equal(v,b());assert.ok(v>=0&&v<1);}
  assert.notEqual(a(),c());
  const box={x:0,z:0,halfX:2,halfZ:.2,yaw:Math.PI/2};
  assert.equal(insideBox(0,1,box),true);assert.equal(insideBox(1,0,box),false);
});
