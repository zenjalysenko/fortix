import * as THREE from 'three';
import '../css/style.css';
import { createAnimations } from './animations/index.js';
import { terrain, createIsland, createOcean, createPineGeometries, createRockGeometry, createShelter, createCave, createRuins, createCrystal, createCharacter } from './models/index.js';

import { createState, loadSave, seededRandom, labels, recipes, hotbar, buildingTypes, craftReason, craftItem, useItem, quests, advanceQuest, insideBox, enemyIntent } from './game/rules.js';
import { createBuilding, buildingBoxes, placement, placementReason } from './game/buildings.js';
import { createAudio } from './game/audio.js';
import { equipModels } from './game/equipment.js';

let saved = null;
try { saved = loadSave(localStorage.getItem('fortinex-save')); } catch { /* Storage may be disabled. */ }
const state = saved?.state || createState();
if (!saved) state.seed = Math.floor(Math.random() * 4294967295);
const worldRandom = seededRandom(state.seed);
const audio = createAudio();
const root=document.querySelector('#game');

root.innerHTML=`
<div class="ui">
  <div class="freeze-overlay" id="freeze-overlay"></div>
  <div class="bleed-overlay" id="bleed-overlay"></div>
  <div class="top">
    <div class="brand">FORTINEX<span>ОСТРОВ ВЫЖИВАНИЯ</span></div>
    <div class="pill" id="clock"></div>
  </div>
  <div class="boss-hud hidden" id="boss-hud">
    <div class="boss-name" id="boss-name">ДРЕВНИЙ ГОЛЕМ</div>
    <div class="boss-bar-wrap"><div class="boss-bar-fill" id="boss-hp"></div></div>
  </div>
  <div class="objective" id="objective"></div>
  <div class="stats">
    <div class="stat"><span>ЗДОРОВЬЕ</span><div class="bar hp"><i id="hp"></i></div></div>
    <div class="stat"><span>СЫТОСТЬ</span><div class="bar food"><i id="food"></i></div></div>
    <div class="stat"><span>ВОДА</span><div class="bar water"><i id="water"></i></div></div>
    <div class="stat"><span>ТЕПЛО</span><div class="bar temp"><i id="temp"></i></div></div>
    <div class="stat"><span>СТАМИНА</span><div class="bar stamina"><i id="stamina"></i></div></div>
  </div>
  <div class="hotbar" id="hotbar" aria-label="Панель предметов"></div>
  <div class="cross" id="cross">
    <div class="cross-dot"></div>
    <div class="cross-t"></div>
    <div class="cross-b"></div>
    <div class="cross-l"></div>
    <div class="cross-r"></div>
  </div>
  <div class="hint" id="hint"></div>
  <div class="toast" id="toast" role="status"></div>
  <div id="panel" class="panel"><div class="card" id="card"></div></div>
</div>`;

const panel=document.querySelector('#panel'),card=document.querySelector('#card'),hint=document.querySelector('#hint'),toast=document.querySelector('#toast');
const crossEl=document.querySelector('#cross'),freezeEl=document.querySelector('#freeze-overlay'),bleedEl=document.querySelector('#bleed-overlay');
const bossHudEl=document.querySelector('#boss-hud'),bossNameEl=document.querySelector('#boss-name'),bossHpEl=document.querySelector('#boss-hp');

const scene=new THREE.Scene(); scene.background=new THREE.Color('#83b7c2'); scene.fog=new THREE.FogExp2('#9dc8c3',.0028);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,1100);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;root.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight('#d9f4ed','#546858',2.1));const sun=new THREE.DirectionalLight('#fff1cb',3.1);sun.position.set(-75,120,55);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-100;sun.shadow.camera.right=100;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;scene.add(sun);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+worldRandom()*(b-a);
function reserved(x,z){return [[0,0,10],[18,5,13],[-60,-24,15],[-30,37,9],[24,-12,5]].some(([a,b,r])=>Math.hypot(x-a,z-b)<r)}
const island=createIsland();scene.add(island);
const ocean=createOcean();scene.add(ocean);
function wave(t){ocean.material.userData.waveTime.value=t;}

const pineGeometry=createPineGeometries(),trunkG=pineGeometry.trunk,crownG=pineGeometry.crown,rockG=createRockGeometry();
const trees=[],rocks=[],solidBoxes=[];const trunkMat=new THREE.MeshStandardMaterial({color:'#d0b79b',roughness:1}),leafMat=new THREE.MeshStandardMaterial({color:'#c1d6b6',roughness:.9}),rockMat=new THREE.MeshStandardMaterial({color:'#c6ccc5',roughness:1});
trunkMat.userData.surface='wood';leafMat.userData.surface='leaves';rockMat.userData.surface='stone';
const trunk=new THREE.InstancedMesh(trunkG,trunkMat,300),crowns=new THREE.InstancedMesh(crownG,leafMat,300),stones=new THREE.InstancedMesh(rockG,rockMat,135);trunk.castShadow=crowns.castShadow=stones.castShadow=true;const dummy=new THREE.Object3D();let tc=0,sc=0;
for(let i=0;i<300;i++){
  const x=rand(-143,143),z=rand(-143,143),y=terrain(x,z);
  if(y<3||y>20||Math.hypot(x,z)>142||reserved(x,z))continue;
  const s=rand(.72,1.35);
  dummy.position.set(x,y+1.7*s,z);dummy.scale.setScalar(s);dummy.rotation.y=rand(0,Math.PI*2);dummy.updateMatrix();
  trunk.setMatrixAt(tc,dummy.matrix);dummy.position.y=y+5*s;dummy.scale.set(s,rand(.8,1.2),s);dummy.updateMatrix();
  crowns.setMatrixAt(tc,dummy.matrix);trees.push({id:`tree-${tc}`,x,z,y,hp:5,alive:true,index:tc++,radius:.45*s});
}
for(let i=0;i<135;i++){
  const x=rand(-140,140),z=rand(-140,140),y=terrain(x,z);
  if(y<3||y>20||Math.hypot(x,z)>140||reserved(x,z))continue;
  const sx=rand(.6,1.6),sy=rand(.45,1.1),sz=rand(.6,1.5);
  dummy.position.set(x,y+.6,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rand(-.2,.2),rand(0,6),rand(-.2,.2));dummy.updateMatrix();
  stones.setMatrixAt(sc,dummy.matrix);
  const rad=Math.max(sx,sz)*1.1+0.25;
  rocks.push({id:`rock-${sc}`,x,z,y,hp:4,index:sc++,radius:rad,sy});
}
trunk.count=crowns.count=tc;stones.count=sc;scene.add(trunk,crowns,stones);trunk.instanceMatrix.needsUpdate=crowns.instanceMatrix.needsUpdate=stones.instanceMatrix.needsUpdate=true;

function addSolid(x,z,halfX,halfZ,yaw=0){solidBoxes.push({x,z,halfX,halfZ,yaw})}
function worldBlocked(x,z,y,ignore=null){
  if(Math.hypot(x,z)>146)return true;
  for(const o of trees)if(o.alive&&Math.hypot(x-o.x,z-o.z)<.55+o.radius)return true;
  for(const o of rocks)if(Math.hypot(x-o.x,z-o.z)<.58+o.radius)return true;
  for(const b of solidBoxes)if(insideBox(x,z,b))return true;
  for(const b of state.structures)if(b!==ignore&&buildingBoxes(b).some(box=>y<box.y+box.height&&y+2>box.y&&insideBox(x,z,box)))return true;
  return false;
}
function blockedAt(x,z){
  if(state.cave)return x<caveX-27||x>caveX-4.5||Math.abs(z-caveZ)>4.5;
  return worldBlocked(x,z,player.y)||enemies.some(e=>e.alive&&Math.hypot(x-e.x,z-e.z)<(e.isBoss?2.2:1.2));
}
function placeLandmark(model,x,y,z){model.position.set(x,y,z);scene.add(model);for(const b of model.userData.colliders||[])addSolid(x+b.x,z+b.z,b.halfX,b.halfZ);return model}
const campX=18,campZ=5,campY=terrain(campX,campZ);placeLandmark(createShelter(),campX,campY,campZ);
const caveX=-60,caveZ=-24,caveY=terrain(caveX,caveZ);placeLandmark(createCave(),caveX,caveY,caveZ);
const crystal=createCrystal();crystal.position.set(caveX+4,caveY+1,caveZ-4);scene.add(crystal);const caveLight=new THREE.PointLight('#54e9d1',25,20);caveLight.position.copy(crystal.position);scene.add(caveLight);
const ruinX=-30,ruinZ=37,ruinY=terrain(ruinX,ruinZ);placeLandmark(createRuins(),ruinX,ruinY,ruinZ);

const moteGeo=new THREE.BufferGeometry(),moteData=[];for(let i=0;i<500;i++)moteData.push(rand(-125,125),rand(1,18),rand(-125,125));moteGeo.setAttribute('position',new THREE.Float32BufferAttribute(moteData,3));const motes=new THREE.Points(moteGeo,new THREE.PointsMaterial({color:'#f1e5ab',size:.11,transparent:true,opacity:.5}));scene.add(motes);

const player={x:saved?.player.x||0,z:saved?.player.z||0,y:0,vy:0,yaw:0,pitch:.3,dist:8,ground:true,jumps:0};
function floorAt(x,z){
  if(state.cave)return caveY-5;
  let y=terrain(x,z);
  for(const b of state.structures){
    if(b.type==='floor'&&Math.abs(x-b.x)<=2.05&&Math.abs(z-b.z)<=2.05)y=Math.max(y,b.y+0.28);
    if(b.type==='roof'&&Math.abs(x-b.x)<=2.05&&Math.abs(z-b.z)<=2.05&&player.y>=b.y+3.0)y=Math.max(y,b.y+3.3);
  }
  return y;
}
player.y=floorAt(player.x,player.z);
const avatar=createCharacter();avatar.position.set(player.x,player.y,player.z);scene.add(avatar);

// Enhanced enemies list: 18 regular enemies + 3 unique Bosses!
const enemyConfigs=[
  {type:'scout',x:-32,z:-6,hp:8,maxHp:8,attack:4,scale:.9,tint:'#548760',name:'Разведчик'},
  {type:'warrior',x:56,z:34,hp:16,maxHp:16,attack:7,scale:1.05,tint:'#46494d',name:'Воин Тьмы'},
  {type:'scout',x:-82,z:14,hp:8,maxHp:8,attack:4,scale:.9,tint:'#548760',name:'Разведчик'},
  {type:'shaman',x:77,z:-62,hp:14,maxHp:14,attack:8,scale:1.0,tint:'#663b91',name:'Шаман Бурь'},
  {type:'berserker',x:8,z:-98,hp:28,maxHp:28,attack:14,scale:1.35,tint:'#9c2424',name:'Берсерк'},
  {type:'scout',x:-42,z:83,hp:8,maxHp:8,attack:4,scale:.9,tint:'#548760',name:'Разведчик'},
  {type:'warrior',x:102,z:57,hp:16,maxHp:16,attack:7,scale:1.05,tint:'#46494d',name:'Воин Тьмы'},
  {type:'shaman',x:-112,z:-30,hp:14,maxHp:14,attack:8,scale:1.0,tint:'#663b91',name:'Шаман Бурь'},
  {type:'berserker',x:34,z:108,hp:28,maxHp:28,attack:14,scale:1.35,tint:'#9c2424',name:'Берсерк'},
  {type:'warrior',x:-16,z:-122,hp:16,maxHp:16,attack:7,scale:1.05,tint:'#46494d',name:'Воин Тьмы'},
  {type:'scout',x:12,z:65,hp:8,maxHp:8,attack:4,scale:.9,tint:'#548760',name:'Разведчик'},
  {type:'warrior',x:-65,z:48,hp:16,maxHp:16,attack:7,scale:1.05,tint:'#46494d',name:'Воин Тьмы'},
  {type:'berserker',x:68,z:88,hp:28,maxHp:28,attack:14,scale:1.35,tint:'#9c2424',name:'Берсерк'},
  {type:'shaman',x:-35,z:-85,hp:14,maxHp:14,attack:8,scale:1.0,tint:'#663b91',name:'Шаман Бурь'},
  {type:'warrior',x:85,z:-22,hp:16,maxHp:16,attack:7,scale:1.05,tint:'#46494d',name:'Воин Тьмы'},
  {type:'scout',x:-95,z:-75,hp:8,maxHp:8,attack:4,scale:.9,tint:'#548760',name:'Разведчик'},
  {type:'berserker',x:-15,z:115,hp:28,maxHp:28,attack:14,scale:1.35,tint:'#9c2424',name:'Берсерк'},
  {type:'shaman',x:45,z:-110,hp:14,maxHp:14,attack:8,scale:1.0,tint:'#663b91',name:'Шаман Бурь'},
  // 3 Distinct Bosses!
  {type:'boss',bossType:'golem',x:50,z:50,hp:90,maxHp:90,attack:20,scale:2.3,tint:'#191624',name:'Древний Голем',isBoss:true},
  {type:'boss',bossType:'pyro',x:-50,z:50,hp:110,maxHp:110,attack:18,scale:2.1,tint:'#7a1805',name:'Повелитель Пламени',isBoss:true},
  {type:'boss',bossType:'reaper',x:50,z:-50,hp:85,maxHp:85,attack:18,scale:2.0,tint:'#122238',name:'Жнец Бури',isBoss:true},
];

const enemies=enemyConfigs.map((cfg,i)=>{
  const group=createCharacter({enemy:true});
  const e={...cfg,spawnX:cfg.x,spawnZ:cfg.z,alive:!cfg.isBoss,respawn:0,phase:i*1.8,group};
  group.scale.setScalar(cfg.scale);
  if(e.type==='warrior'&&i===1){
    const cache=createCrystal();cache.scale.setScalar(.6);cache.position.set(cfg.x+2,terrain(cfg.x+2,cfg.z),cfg.z);scene.add(cache);e.cache=cache;e.cacheOre=3;
  }
  const previous=state.enemyState[i];if(previous)Object.assign(e,previous);
  if(e.cache)e.cache.visible=e.cacheOre>0;
  if(e.isBoss){
    const col=cfg.bossType==='pyro'?'#ff4400':cfg.bossType==='reaper'?'#4488ff':'#ff8800';
    const bossGlow=new THREE.PointLight(col,9,16);bossGlow.position.y=2.5;group.add(bossGlow);
    if(!previous)e.alive=false;
  }
  group.position.set(e.x,terrain(e.x,e.z),e.z);scene.add(group);
  group.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(o.material)?o.material:[o.material])m.color.multiply(new THREE.Color(cfg.tint));}});
  return e;
});

const hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);
for(const t of trees)if(state.harvested.includes(t.id)){t.alive=false;trunk.setMatrixAt(t.index,hiddenMatrix);crowns.setMatrixAt(t.index,hiddenMatrix);}
for(let i=rocks.length-1;i>=0;i--)if(state.harvested.includes(rocks[i].id)){stones.setMatrixAt(rocks[i].index,hiddenMatrix);rocks.splice(i,1);}
const animations=createAnimations({scene,avatar,enemies,trunk,crowns,stones,trees,rocks,camp:new THREE.Vector3(campX,campY+.35,campZ)});
const buildings=new Map();
function addBuilding(record){
  const object=createBuilding(record.type);object.position.set(record.x,record.y,record.z);object.rotation.y=record.yaw;
  if(record.type==='door')object.getObjectByName('door-leaf').rotation.y=record.open?-Math.PI/2:0;
  animations.applyTextures(object);scene.add(object);buildings.set(record,object);return object;
}
const equipment=equipModels(avatar);animations.applyTextures(avatar);equipment.update(state);
state.structures.forEach(addBuilding);
const spring=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.8,.18,24),new THREE.MeshStandardMaterial({color:'#55cbd1',roughness:.15,metalness:.3}));
spring.position.set(24,terrain(24,-12)+.12,-12);scene.add(spring);
const torchLight=new THREE.PointLight('#ffae58',0,18);scene.add(torchLight);
const muzzleLight=new THREE.PointLight('#ffdd55',0,18);scene.add(muzzleLight);

const keys=new Set();
let pointer=false,mouseDown=false,elapsed=0,selected=0,hitCooldown=0,toastTimer=0,saveTimer=0,uiTimer=0,stepTimer=0;
let menuKind='start',activeChest=null,buildType=null,buildYaw=0,preview=null,candidate=null,invalidPlacement='',lastHud='';
const projectiles=[];
const compass=document.createElement('div');compass.className='compass';document.querySelector('.ui').append(compass);
const controls=document.createElement('div');controls.className='controls';controls.textContent='1–8 предметы · X взять · Shift бег · Двойной Пробел прыжок · E действие · Q крафт · B стройка · M карта · Esc меню';document.querySelector('.ui').append(controls);

function notify(text){toast.textContent=text;toast.classList.add('show');toastTimer=3.5;}
function button(action,text,extra=''){return `<button class="btn" data-action="${action}" ${extra}>${text}</button>`;}
function nearFire(){return !state.cave&&(Math.hypot(player.x-campX,player.z-campZ)<7||state.structures.some(b=>b.type==='campfire'&&Math.hypot(player.x-b.x,player.z-b.z)<4));}
function nearbyBuilding(type){return state.structures.filter(b=>(!type||b.type===type)&&Math.hypot(player.x-b.x,player.z-b.z)<3.5).sort((a,b)=>Math.hypot(player.x-a.x,player.z-a.z)-Math.hypot(player.x-b.x,player.z-b.z))[0];}
function insideShelter(){return state.structures.some(b=>b.type==='roof'&&Math.abs(player.x-b.x)<2.2&&Math.abs(player.z-b.z)<2.2&&player.y<b.y+3.0);}
function inventory(){return `<div class="inventory">${Object.keys(labels).filter(k=>state[k]>0).map(k=>`<div class="item"><span>${labels[k]}</span><b>${state[k]}</b></div>`).join('')}</div><p>Фляга: ${state.flask?`${state.dirtyWater+state.cleanWater}/4 порций`:'не изготовлена'} · Стрелы: ${state.arrows} · Патроны: ${state.bullets} · Броня: ${state.heavyArmor?'Тяжёлая (−75% урона)':state.armor?'Обычная (−40% урона)':'нет'}</p>`;}
const help='WASD движение · Shift спринт · Пробел (дважды = двойной прыжок) · ЛКМ огонь / удар / ломать стены · E действие / сон · 1–8 выбор · X взять · F факел · Q крафт · I запасы · B стройка · R поворот · M карта · P метка · Esc меню';

function openMenu(kind){
  menuKind=kind;state.paused=true;mouseDown=false;keys.clear();audio.pause();panel.classList.remove('hidden');document.exitPointerLock?.();
  renderMenu();
}
function renderMenu(){
  let html='';
  if(menuKind==='start')html=`<div class="eyebrow">FORTINEX · ОСТРОВ ВЫЖИВАНИЯ</div><h1>Свой путь.<br>Своё убежище.</h1><p>Собирайте ресурсы, развивайте оружие, стройте базу и переживите атаки врагов и боссов!</p><div class="actions">${button('resume',saved?'Продолжить':'Начать игру')}${button('new','Новый остров')}${button('settings','Настройки')}</div><div class="menu-note">${help}</div>`;
  if(menuKind==='pause')html=`<div class="eyebrow">ДЕНЬ ${state.day} · ОСТРОВ ВЫЖИВАНИЯ</div><h1>Привал</h1><div class="actions">${button('resume','Продолжить')}${button('save','Сохранить')}${button('settings','Настройки')}${button('map','Карта')}</div><div class="menu-note">${help}</div>`;
  if(menuKind==='inventory')html=`<h1>Инвентарь</h1>${inventory()}<p>Выберите слот 1–8 и нажмите X. Броня защищает автоматически. Сырое мясо сначала приготовьте.</p>${button('resume','Вернуться · I')}`;
  if(menuKind==='craft'||menuKind==='fire'){
    const fire=nearFire();const keys=Object.keys(recipes).filter(k=>menuKind!=='fire'||recipes[k].fire);
    html=`<div class="eyebrow">${fire?'У КОСТРА':'ПОХОДНАЯ МАСТЕРСКАЯ'}</div><h1>${menuKind==='fire'?'Костёр':'Крафт'}</h1><p>Костёр расходует дерево для приготовления, плавки патронов, пистолета и брони.</p><div class="recipes">${keys.map(k=>{const reason=craftReason(state,k,fire);return button(`craft:${k}`,`${labels[k]}${recipes[k].amount?` ×${recipes[k].amount}`:''}<small>${Object.entries(recipes[k].cost).map(([item,count])=>`${labels[item]} ${count}`).join(' · ')}</small>${reason?`<small>${reason}</small>`:''}`,reason?'disabled':'');}).join('')}</div>${inventory()}${button('resume','Вернуться · Q')}`;
  }
  if(menuKind==='build')html=`<h1>Строительство</h1><p>Сначала изготовьте набор в Q. Пол задаёт сетку 4 × 4 м; стены и двери встают на её край. Крыша, кровать и сундук требуют пола.</p><div class="recipes">${buildingTypes.map(k=>button(`build:${k}`,`${labels[k]} <small>Наборов: ${state[k]}</small>`,state[k]?'':'disabled')).join('')}</div><p>Зелёная схема — можно строить, красная — препятствие. ЛКМ на установленную стену — ломать её. R: поворот на 90°.</p>${button('craft','Изготовить наборы')}${button('resume','Вернуться')}`;
  if(menuKind==='dead')html=`<div class="eyebrow">ПУТЬ ПРОДОЛЖАЕТСЯ</div><h1>Вас победили</h1><p>${state.spawn?'Возрождение у вашей кровати.':'Постройте кровать и активируйте её клавишей E, чтобы сохранить точку возрождения.'} Инвентарь и база сохраняются.</p>${button('respawn','Возродиться')}`;
  if(menuKind==='settings')html=`<h1>Настройки</h1><label class="setting">Громкость <input id="volume" type="range" min="0" max="1" step="0.05" value="${state.settings.volume}"></label><label class="setting">Чувствительность мыши <input id="sensitivity" type="range" min="0.3" max="2.5" step="0.1" value="${state.settings.sensitivity}"></label><label class="setting">Качество графики <select id="quality"><option value="low">Низкое</option><option value="medium">Среднее</option><option value="high">Высокое</option></select></label><p>Низкое качество отключает тени и уменьшает разрешение. Изменения сохраняются автоматически.</p>${button('sound','Прослушать звук')}${button('resume','Вернуться')}`;
  if(menuKind==='map')html=`<h1>Карта острова</h1>${mapMarkup()}<p>Зелёный: лагерь · Голубой: источник · Фиолетовый: пещера · Белый: вы · Жёлтый: ваши метки · Квадраты: база.</p><div class="actions">${button('marker','Отметить моё место')}${button('clear-markers','Очистить метки')}${button('resume','Вернуться · M')}</div>`;
  if(menuKind==='chest'&&activeChest){
    html=`<h1>Сундук</h1><p>Каждое нажатие переносит одну единицу. Вещи остаются здесь после возрождения и перезапуска.</p><div class="storage">${['wood','stone','ore','berries','meat','cookedMeat','dirtyWater','cleanWater','arrows','bullets'].map(k=>`<div class="storage-row"><span>${labels[k]}<small>При себе: ${state[k]} · В сундуке: ${activeChest.items[k]||0}</small></span>${button(`store:${k}`,'→',state[k]?'':'disabled')}${button(`take:${k}`,'←',activeChest.items[k]?'':'disabled')}</div>`).join('')}</div>${button('resume','Вернуться')}`;
  }
  card.innerHTML=html;
  if(menuKind==='settings'){
    card.querySelector('#quality').value=state.settings.quality;
    for(const key of ['volume','sensitivity','quality'])card.querySelector(`#${key}`).oninput=e=>{state.settings[key]=key==='quality'?e.target.value:Number(e.target.value);applySettings();saveGame();};
  }
}
function start(){
  if(state.hp<=0){openMenu('dead');return;}
  menuKind=null;panel.classList.add('hidden');state.paused=false;audio.start(state.settings.volume);
  renderer.domElement.requestPointerLock?.()?.catch?.(()=>notify('Кликните по игре, чтобы включить управление мышью'));
}
function saveGame(){
  state.enemyState=enemies.map(({x,z,hp,alive,respawn,attack,cacheOre})=>({x,z,hp,alive,respawn,attack,cacheOre:cacheOre||0}));
  try{localStorage.setItem('fortinex-save',JSON.stringify({version:2,state:{...state,paused:true},player:{x:player.x,z:player.z}}));return true;}
  catch{notify('Не удалось сохранить: проверьте доступ к хранилищу браузера');return false;}
}
function applySettings(){
  const q=state.settings.quality;renderer.setPixelRatio(Math.min(devicePixelRatio,q==='low'?1:q==='medium'?1.4:2));renderer.shadowMap.enabled=q!=='low';
  scene.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;}});
  audio.volume(state.settings.volume);
}
function resetNight(){if(state.quest===3)state.nightDay=0;}
function respawn(){
  resetNight();state.hp=100;state.food=75;state.water=75;state.temp=100;state.stamina=100;state.bleeding=0;state.sick=0;state.cave=false;state.torchOn=false;
  const spawn=state.spawn||{x:0,z:0};player.x=spawn.x;player.z=spawn.z;player.vy=0;player.ground=true;player.jumps=0;
  for(let r=0;r<8;r++){
    if(!worldBlocked(player.x,player.z,terrain(player.x,player.z)))break;
    player.x=spawn.x+Math.cos(r*Math.PI/4)*3;player.z=spawn.z+Math.sin(r*Math.PI/4)*3;
  }
  player.y=floorAt(player.x,player.z);avatar.visible=true;avatar.position.set(player.x,player.y,player.z);saveGame();start();
}
card.addEventListener('click',e=>{
  const target=e.target.closest('[data-action]');if(!target||target.disabled)return;
  const [action,key]=target.dataset.action.split(':');
  if(action==='resume')start();
  else if(action==='new'){try{localStorage.removeItem('fortinex-save');location.reload();}catch{notify('Хранилище браузера недоступно');}}
  else if(action==='save'){if(saveGame())notify('Остров и инвентарь сохранены');}
  else if(action==='respawn')respawn();
  else if(action==='craft'&&key){if(craftItem(state,key,nearFire())){notify(`Готово: ${labels[key]}`);audio.start(state.settings.volume);audio.play('build');checkQuest();saveGame();renderMenu();refresh();}}
  else if(action==='build'&&key){beginBuild(key);start();}
  else if(action==='sound'){audio.start(state.settings.volume);audio.play('quest');}
  else if(action==='marker'){addMarker();renderMenu();}
  else if(action==='clear-markers'){state.markers=[];saveGame();renderMenu();}
  else if(action==='store'||action==='take'){
    if(!activeChest)return;
    const from=action==='store'?state:activeChest.items,to=action==='store'?activeChest.items:state;
    if(action==='take'&&['cleanWater','dirtyWater'].includes(key)&&(!state.flask||state.cleanWater+state.dirtyWater>=4)){notify('Нужна фляга со свободным местом');return;}
    if(from[key]>0){from[key]--;to[key]=(to[key]||0)+1;saveGame();renderMenu();refresh();}
  }
  else if(['settings','map','craft'].includes(action))openMenu(action);
});

function mapMarkup(){
  const point=(x,z,color,label,size=3)=>`<circle cx="${x}" cy="${z}" r="${size}" fill="${color}"/><text x="${x+5}" y="${z-5}">${label}</text>`;
  return `<svg class="island-map" viewBox="-165 -165 330 330" role="img" aria-label="Карта острова с позицией игрока и метками"><rect x="-165" y="-165" width="330" height="330" fill="#203f4c"/><circle r="146" fill="#506951" stroke="#a3b89a" stroke-width="3"/><path d="M-150 0H150 M0-150V150" stroke="#ffffff18"/><text x="-5" y="-152">N</text>${state.structures.map(b=>`<rect x="${b.x-2}" y="${b.z-2}" width="4" height="4" fill="#c5a777"/>`).join('')}${point(18,5,'#d1edb5','Лагерь')}${point(-60,-24,'#b2a2ff','Пещера')}${point(24,-12,'#77e2ef','Источник')}${point(-30,37,'#bbb','Руины')}${state.markers.map((m,i)=>point(m.x,m.z,'#ffd575',String(i+1))).join('')}${state.spawn?point(state.spawn.x,state.spawn.z,'#f4bb94','Кровать'):''}${point(player.x,player.z,'#fff','Вы',4)}</svg>`;
}
function addMarker(){if(state.markers.length>=20){notify('Лимит: 20 меток. Удалите старые на карте');return;}state.markers.push({x:Math.round(player.x),z:Math.round(player.z)});saveGame();notify('Место отмечено на карте · M');}
function refresh(){
  document.querySelector('#hp').style.width=state.hp+'%';
  document.querySelector('#food').style.width=state.food+'%';
  document.querySelector('#water').style.width=state.water+'%';
  document.querySelector('#temp').style.width=(state.temp||100)+'%';
  document.querySelector('#stamina').style.width=(state.stamina||100)+'%';
  document.querySelector('#clock').textContent=`ДЕНЬ ${String(state.day).padStart(2,'0')} · ${String(Math.floor(state.time)).padStart(2,'0')}:${String(Math.floor(state.time%1*60)).padStart(2,'0')}`;
  const icons=['❋','♨','◉','⚒','⛏','↟','➶','🔫'];
  const html=hotbar.map((key,i)=>`<button class="slot ${selected===i?'active':''} ${state.equipped===key?'equipped':''}" data-slot="${i}" title="${labels[key]} · ${i+1}, X"><small>${i+1}</small><span>${icons[i]}</span><b>${state[key]}</b><em>${labels[key]}</em></button>`).join('');
  if(html!==lastHud){document.querySelector('#hotbar').innerHTML=html;lastHud=html;}
  document.querySelector('#objective').textContent=`${Math.min(5,state.quest+1)}/5 · ${quests[state.quest]}`;
  const heading=((player.yaw*180/Math.PI)%360+360)%360;
  compass.textContent=`${['С','СЗ','З','ЮЗ','Ю','ЮВ','В','СВ'][Math.round(heading/45)%8]} · Лагерь ${Math.round(Math.hypot(player.x-campX,player.z-campZ))} м · Пещера ${Math.round(Math.hypot(player.x-caveX,player.z-caveZ))} м · M карта`;
}
document.querySelector('#hotbar').addEventListener('click',e=>{const slot=e.target.closest('[data-slot]');if(slot&&!state.paused){selected=Number(slot.dataset.slot);useSelected();}});
function checkQuest(){if(advanceQuest(state)){notify(`Задание выполнено! ${quests[state.quest]}`);audio.play('quest');saveGame();}}
function useSelected(){notify(useItem(state,hotbar[selected]));equipment.update(state);audio.play('use');refresh();}
function disposePreview(){if(!preview)return;scene.remove(preview);preview.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});preview=null;}
function beginBuild(type){
  disposePreview();buildType=type;buildYaw=Math.round(player.yaw/(Math.PI/2))*Math.PI/2;
  preview=createBuilding(type);preview.traverse(o=>{if(o.isLight)o.visible=false;if(o.isMesh){o.material=new THREE.MeshBasicMaterial({color:'#93efad',transparent:true,opacity:.4,depthWrite:false});o.castShadow=false;}});scene.add(preview);updatePreview();
}
function obstacles(){return [...solidBoxes,...trees.filter(t=>t.alive).map(t=>({x:t.x,z:t.z,halfX:t.radius+.25,halfZ:t.radius+.25})),...rocks.map(r=>({x:r.x,z:r.z,halfX:r.radius,halfZ:r.radius})),...enemies.filter(e=>e.alive).map(e=>({x:e.x,z:e.z,halfX:.7,halfZ:.7}))];}
function updatePreview(){
  if(!preview)return;
  candidate=placement(buildType,player,buildYaw,state.structures,terrain);invalidPlacement=placementReason(candidate,state,player,terrain,obstacles());
  preview.position.set(candidate.x,candidate.y,candidate.z);preview.rotation.y=candidate.yaw;
  preview.traverse(o=>{if(o.isMesh)o.material.color.set(invalidPlacement?'#ff6b65':'#93efad');});
}
function placeBuilding(){
  updatePreview();if(invalidPlacement){notify(invalidPlacement);return;}
  const record={...candidate,items:{},hp:candidate.type==='wall'?8:candidate.type==='door'?6:8};
  state.structures.push(record);state[buildType]--;addBuilding(record);audio.play('build');checkQuest();saveGame();
  if(!state[buildType]){buildType=null;disposePreview();}refresh();
}

window.addEventListener('keydown',e=>{
  if(['Space','Tab','Escape'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(state.paused){
    if(e.code==='Enter'&&menuKind==='start')start();
    else if(menuKind!=='dead'&&menuKind!=='start'&&(e.code==='Escape'||(e.code==='KeyI'&&menuKind==='inventory')||(e.code==='KeyQ'&&['craft','fire'].includes(menuKind))||(e.code==='KeyM'&&menuKind==='map')||(e.code==='KeyB'&&menuKind==='build')))start();
    return;
  }
  keys.add(e.code);
  if(e.code==='Escape')openMenu('pause');
  else if(e.code==='KeyI'||e.code==='Tab')openMenu('inventory');
  else if(e.code==='KeyQ')openMenu('craft');
  else if(e.code==='KeyM')openMenu('map');
  else if(e.code==='KeyP')addMarker();
  else if(e.code==='KeyB'){if(buildType){buildType=null;disposePreview();}else openMenu('build');}
  else if(e.code==='KeyR'&&buildType)buildYaw+=Math.PI/2;
  else if(/^Digit[1-8]$/.test(e.code)){selected=Number(e.code.slice(-1))-1;refresh();}
  else if(e.code==='KeyX')useSelected();
  else if(e.code==='KeyF'){notify(useItem(state,'torch'));refresh();}
  else if(e.code==='KeyE')interact();
  else if(e.code==='Space'){
    if(player.ground){
      if(state.stamina>=10){
        state.stamina-=10;player.vy=8.5;player.ground=false;player.jumps=1;
      }
    }else if(player.jumps===1){
      if(state.stamina>=15){
        state.stamina-=15;player.vy=12.2;player.jumps=2;audio.play('jump');notify('Двойной прыжок!');
      }
    }
  }
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();mouseDown=false;if(!state.paused)openMenu('pause');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!state.paused)openMenu('pause');});
document.addEventListener('pointerlockchange',()=>{pointer=document.pointerLockElement===renderer.domElement;if(!pointer){mouseDown=false;if(!state.paused)openMenu('pause');}});
document.addEventListener('mousemove',e=>{if(pointer&&!state.paused){player.yaw-=e.movementX*.0023*state.settings.sensitivity;player.pitch=clamp(player.pitch-e.movementY*.0018*state.settings.sensitivity,-.3,.9);}});
renderer.domElement.addEventListener('mousedown',e=>{if(e.button!==0||state.paused)return;if(!pointer){renderer.domElement.requestPointerLock?.();return;}if(buildType){placeBuilding();return;}mouseDown=true;action();});
window.addEventListener('mouseup',()=>mouseDown=false);
window.addEventListener('wheel',e=>{if(!state.paused)player.dist=clamp(player.dist+e.deltaY*.009,3,13);});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.addEventListener('pagehide',()=>{if(state.hp>0)saveGame();});

// Real crosshair raycasting targeting
const aimRaycaster=new THREE.Raycaster();
function getCrosshairTargetPoint(range=90){
  aimRaycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const targets=enemies.filter(e=>e.alive).map(e=>e.group);
  const hits=aimRaycaster.intersectObjects(targets,true);
  if(hits.length>0&&hits[0].distance<range){
    return {point:hits[0].point,enemyMesh:hits[0].object};
  }
  return {point:aimRaycaster.ray.origin.clone().add(aimRaycaster.ray.direction.clone().multiplyScalar(range)),enemyMesh:null};
}

function closestTarget(range=4.2){
  const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);let best=null,bd=range;
  if(state.cave)return null;
  for(const t of [...trees.filter(t=>t.alive),...rocks,...enemies.filter(e=>e.alive)]){
    const dx=t.x-player.x,dz=t.z-player.z,d=Math.hypot(dx,dz);
    if(d<bd&&(dx*fx+dz*fz)/Math.max(d,.01)>.35){best=t;bd=d;}
  }
  return best;
}
function closestStructure(range=3.8){
  const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);let best=null,bd=range;
  for(const b of state.structures){
    const dx=b.x-player.x,dz=b.z-player.z,d=Math.hypot(dx,dz);
    if(d<bd&&(dx*fx+dz*fz)/Math.max(d,.01)>.35){best=b;bd=d;}
  }
  return best;
}

function gather(t){
  const rock=t.id.startsWith('rock'),tool=state.equipped;
  const dmg=rock?(tool==='pickaxe'?(state.ironPickaxe?4:2):1):(tool==='axe'?(state.ironAxe?5:3):1);
  t.hp-=dmg;
  animations.environment.hit(t,rock?'stone':'tree',t.hp<=0);
  if(t.hp<=0){
    state.harvested.push(t.id);
    if(rock){state.stone+=2;state.gatheredStone+=2;const ore=tool==='pickaxe'?2:1;state.ore+=ore;rocks.splice(rocks.indexOf(t),1);notify(`+2 камня · +${ore} руды`);}
    else{state.wood+=3;state.gatheredWood+=3;state.berries++;t.alive=false;notify('+3 дерева · +1 ягода');}
    checkQuest();
  }
}

function damageEnemy(e,amount){
  e.hp-=amount;animations.enemies.get(e).hit();audio.play('hit');
  if(e.hp<=0){
    e.alive=false;
    e.respawn=e.isBoss?300:100;
    if(e.isBoss){
      state.meat+=4;state.ore+=8;state.bullets+=18;
      if(!state.pistol){state.pistol=1;notify(`🔥 БОСС [${e.name}] ПОВЕРЖЕН! Получен ПИСТОЛЕТ, патроны и руда!`);}
      else if(!state.heavyArmor){state.heavyArmor=1;notify(`🔥 БОСС [${e.name}] ПОВЕРЖЕН! Получена ТЯЖЁЛАЯ БРОНЯ (−75% урона)!`);}
      else notify(`🔥 БОСС [${e.name}] ПОВЕРЖЕН! +18 патронов, +8 руды, +4 мяса!`);
      animations.environment.loot('pistol',e);animations.environment.loot('heavyArmor',e);animations.environment.loot('bullets',e);animations.environment.loot('ore',e);
    }else if(e.type==='scout'){
      const b=Math.floor(rand(2,4));state.bullets+=b;state.berries+=2;
      animations.environment.loot('bullets',e);animations.environment.loot('berries',e);
      notify(`Разведчик повержен · +${b} патрона · +2 ягоды`);
    }else if(e.type==='warrior'){
      const b=Math.floor(rand(2,4));state.meat++;state.ore++;state.bullets+=b;
      animations.environment.loot('meat',e);animations.environment.loot('bullets',e);
      notify(`Воин повержен · +1 мясо · +1 руда · +${b} патрона`);
    }else if(e.type==='berserker'){
      const b=Math.floor(rand(3,6));state.meat+=2;state.ore+=3;state.bullets+=b;
      animations.environment.loot('meat',e);animations.environment.loot('ore',e);animations.environment.loot('bullets',e);
      notify(`Берсерк повержен · +2 мяса · +3 руды · +${b} патронов`);
    }else if(e.type==='shaman'){
      const b=Math.floor(rand(2,5));state.arrows+=4;state.ore+=2;state.bullets+=b;
      animations.environment.loot('bullets',e);animations.environment.loot('ore',e);
      notify(`Шаман повержен · +4 стрелы · +2 руды · +${b} патрона`);
    }
    refresh();
  }
}

function blockedLine(from,to){
  if(state.cave)return false;
  const boxes=[...solidBoxes,...state.structures.flatMap(buildingBoxes)];
  return boxes.some(box=>[.2,.4,.6,.8].some(t=>insideBox(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t,box,.08)));
}

function action(){
  if(hitCooldown>0||state.paused||state.hp<=0)return;
  const tool=state.equipped;
  hitCooldown=tool==='pistol'?.30:tool==='bow'?.85:(tool==='axe'||tool==='pickaxe')?.45:tool==='spear'?.55:.85;
  animations.player.strike();

  // PISTOL SHOOTING WITH PRECISE CROSSHAIR AIM
  if(tool==='pistol'){
    if(!state.bullets){notify('Нет патронов — выпадают из врагов или плавка в костре!');return;}
    state.bullets--;audio.play('shoot');
    crossEl.classList.add('fired');
    setTimeout(()=>crossEl.classList.remove('fired'),120);

    muzzleLight.position.set(player.x-Math.sin(player.yaw)*.6,player.y+1.5,player.z-Math.cos(player.yaw)*.6);
    muzzleLight.intensity=24;

    const {point:aimTargetPoint}=getCrosshairTargetPoint(85);
    const muzzlePos=new THREE.Vector3(player.x-Math.sin(player.yaw)*.4,player.y+1.4,player.z-Math.cos(player.yaw)*.4);
    const direction=aimTargetPoint.clone().sub(muzzlePos).normalize();

    const bulletGeo=new THREE.CylinderGeometry(.035,.035,.9,6);
    const bulletMat=new THREE.MeshBasicMaterial({color:'#ffee55'});
    const bullet=new THREE.Mesh(bulletGeo,bulletMat);
    bullet.position.copy(muzzlePos);
    bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    scene.add(bullet);
    projectiles.push({mesh:bullet,direction,life:1.2,damage:19,speed:95});
    refresh();
    return;
  }

  // BOW SHOOTING WITH CROSSHAIR AIM
  if(tool==='bow'){
    if(!state.arrows){notify('Нет стрел — изготовьте в Q');return;}
    state.arrows--;audio.play('bow');
    crossEl.classList.add('fired');
    setTimeout(()=>crossEl.classList.remove('fired'),120);

    const {point:aimTargetPoint}=getCrosshairTargetPoint(75);
    const muzzlePos=new THREE.Vector3(player.x,player.y+1.5,player.z);
    const direction=aimTargetPoint.clone().sub(muzzlePos).normalize();

    const arrow=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.8,5),new THREE.MeshStandardMaterial({color:'#e3ca9f'}));
    arrow.position.copy(muzzlePos);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    scene.add(arrow);
    projectiles.push({mesh:arrow,direction,life:1.5,damage:7,speed:36});
    refresh();
    return;
  }

  audio.play('hit');
  const target=closestTarget(tool==='spear'?5.5:4.2);
  if(target){
    if(blockedLine(player,target)){notify('Препятствие закрывает цель');return;}
    if(enemies.includes(target)){
      const dmg=tool==='spear'?4:tool==='axe'?(state.ironAxe?5:3):tool==='pickaxe'?(state.ironPickaxe?4:2):1;
      damageEnemy(target,dmg);
    }else{
      gather(target);
    }
    return;
  }

  // BREAK WALLS / STRUCTURES
  const struct=closestStructure(3.8);
  if(struct){
    if(struct.hp===undefined)struct.hp=struct.type==='wall'?8:struct.type==='door'?6:8;
    const dmg=tool==='axe'||tool==='pickaxe'?3:tool==='spear'?2:1;
    struct.hp-=dmg;
    if(struct.hp<=0){
      scene.remove(buildings.get(struct));
      buildings.delete(struct);
      state.structures.splice(state.structures.indexOf(struct),1);
      state.wood+=2;
      audio.play('build');
      notify(`Постройка (${labels[struct.type]||'стена'}) разрушена! +2 дерева`);
      checkQuest();refresh();
    }else{
      notify(`Удар по постройке! Прочность: ${struct.hp}`);
    }
  }
}

function interact(){
  if(state.cave){
    if(player.x>caveX-5.5){state.cave=false;player.x=caveX+9;player.z=caveZ+8;player.y=floorAt(player.x,player.z);player.vy=0;notify('Вы вернулись на остров');}
    else if(player.x<caveX-22){state.caveExplored=true;state.ore+=state.caveLoot?0:5;state.caveLoot=true;checkQuest();notify('Пещера исследована · найдены залежи руды');}
    else notify('Исследуйте западный конец пещеры; выход — на востоке');return;
  }
  const b=state.structures.filter(b=>['door','chest','bed','campfire'].includes(b.type)&&Math.hypot(player.x-b.x,player.z-b.z)<3.5).sort((a,b)=>Math.hypot(player.x-a.x,player.z-a.z)-Math.hypot(player.x-b.x,player.z-b.z))[0];
  if(b?.type==='door'){
    if(b.open&&insideBox(player.x,player.z,{...b,halfX:1.3,halfZ:.7})){notify('Отойдите от дверного проёма');return;}
    b.open=!b.open;buildings.get(b).getObjectByName('door-leaf').rotation.y=b.open?-Math.PI/2:0;saveGame();return;
  }
  if(b?.type==='chest'){activeChest=b;openMenu('chest');return;}
  if(b?.type==='bed'){
    // Realistic sleep: skip night straight to dawn and restore health & warmth!
    if(state.time>=20||state.time<6){
      state.time=6;state.day++;state.hp=Math.min(100,state.hp+40);state.temp=100;state.stamina=100;state.bleeding=0;
      notify('Вы выспались в тёплой постели. Наступило утро!');
      saveGame();refresh();return;
    }
    const spawn={x:b.x+Math.cos(b.yaw)*1.7,z:b.z-Math.sin(b.yaw)*1.7};
    if(worldBlocked(spawn.x,spawn.z,floorAt(spawn.x,spawn.z),b)){notify('Освободите место сбоку кровати для возрождения');return;}
    state.spawn=spawn;saveGame();notify('Точка возрождения установлена у кровати. Ночью нажмите E для сна!');return;
  }
  if(b?.type==='campfire'||nearFire()){openMenu('fire');return;}
  if(Math.hypot(player.x-24,player.z+12)<4||Math.hypot(player.x,player.z)>138){
    if(!state.flask){notify('Сначала изготовьте флягу в Q');return;}
    const available=4-state.dirtyWater-state.cleanWater;
    if(available<=0){notify('Фляга полна');return;}
    state.dirtyWater+=available;notify(`Набрано ${available} порций. Очистите воду у костра`);refresh();return;
  }
  if(Math.hypot(caveX-player.x,caveZ-player.z)<8){state.cave=true;player.x=caveX-16;player.z=caveZ;player.y=caveY-5;player.vy=0;notify('Пещера · двигайтесь на запад и нажмите E у залежей');return;}
  const cache=enemies.find(e=>e.cacheOre>0&&!e.alive&&Math.hypot(player.x-e.spawnX,player.z-e.spawnZ)<4);
  if(cache){state.ore+=cache.cacheOre;cache.cacheOre=0;cache.cache.visible=false;notify('Тайник стража · +3 руды');return;}
  action();
}

function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];p.life-=dt;
    const speed=p.speed||34;
    const step=p.direction.clone().multiplyScalar(speed*dt);p.mesh.position.add(step);
    const pos=p.mesh.position;
    let hit=false;
    if(p.isEnemy){
      if(Math.hypot(pos.x-player.x,pos.z-player.z)<1.1&&Math.abs(pos.y-(player.y+1.1))<1.3){
        const raw=p.damage||8;
        const finalDmg=state.heavyArmor?raw*.25:state.armor?raw*.6:raw;
        state.hp=clamp(state.hp-finalDmg,0,100);
        animations.player.hit();audio.play('hit');
        if(p.isFire)state.temp=Math.min(100,state.temp+10);
        notify(`${p.isFire?'Огненный шар!':'Магический выстрел!'} −${Math.round(finalDmg)} HP`);
        hit=true;
      }
    }else if(!state.cave){
      const hitEnemy=enemies.find(e=>e.alive&&Math.hypot(pos.x-e.x,pos.z-e.z)<(e.isBoss?1.8:.9)&&Math.abs(pos.y-(terrain(e.x,e.z)+1.2))<(e.isBoss?2.5:1.4));
      if(hitEnemy){damageEnemy(hitEnemy,p.damage||6);hit=true;}
    }
    if(hit||p.life<=0||pos.y<floorAt(pos.x,pos.z)||(!state.cave&&worldBlocked(pos.x,pos.z,pos.y))){
      scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();projectiles.splice(i,1);
    }
  }
}

// 3-Minute Wave Spawning and Boss Rotations
let waveTimer=180;
let bossCycleIndex=0;
const bossTypes=['golem','pyro','reaper'];

function updateEnemies(dt){
  // 3-MINUTE ENEMY WAVE REINFORCEMENTS
  waveTimer-=dt;
  if(waveTimer<=0){
    waveTimer=180;
    state.waveCount=(state.waveCount||0)+1;
    // Revive or respawn 4-6 dead enemies anywhere near the player
    let revived=0;
    for(const e of enemies){
      if(!e.isBoss&&!e.alive&&revived<5){
        const ang=Math.random()*Math.PI*2;
        e.x=clamp(player.x+Math.cos(ang)*rand(35,55),-130,130);
        e.z=clamp(player.z+Math.sin(ang)*rand(35,55),-130,130);
        e.hp=e.maxHp;e.alive=true;e.group.position.set(e.x,terrain(e.x,e.z),e.z);
        revived++;
      }
    }
    audio.play('wave');
    notify(`⚔️ НАБЕГ ВРАГОВ (Каждые 3 мин): На остров прибыло подкрепление из ${Math.max(3,revived)} врагов!`);
  }

  // BOSS SPAWN ROTATION (More frequent: every night or every day cycle)
  const night=state.time>=20||state.time<5;
  const anyBossAlive=enemies.some(e=>e.isBoss&&e.alive);
  if(!anyBossAlive&&night&&(state.day!==state.lastBossDay)){
    state.lastBossDay=state.day;
    const chosenType=bossTypes[bossCycleIndex%bossTypes.length];
    bossCycleIndex++;
    const chosenBoss=enemies.find(e=>e.bossType===chosenType);
    if(chosenBoss){
      chosenBoss.hp=chosenBoss.maxHp;
      chosenBoss.alive=true;
      const ang=Math.random()*Math.PI*2;
      chosenBoss.x=clamp(player.x+Math.cos(ang)*45,-120,120);
      chosenBoss.z=clamp(player.z+Math.sin(ang)*45,-120,120);
      chosenBoss.spawnX=chosenBoss.x;chosenBoss.spawnZ=chosenBoss.z;
      chosenBoss.group.position.set(chosenBoss.x,terrain(chosenBoss.x,chosenBoss.z),chosenBoss.z);
      audio.play('boss');
      notify(`🔥 ПРОБУДИЛСЯ БОСС: [${chosenBoss.name}]! Приготовьтесь к бою!`);
    }
  }

  // Update Boss Health Bar on HUD
  const activeBoss=enemies.find(e=>e.isBoss&&e.alive);
  if(activeBoss){
    bossHudEl.classList.remove('hidden');
    bossNameEl.textContent=activeBoss.name;
    bossHpEl.style.width=`${Math.max(0,(activeBoss.hp/activeBoss.maxHp)*100)}%`;
  }else{
    bossHudEl.classList.add('hidden');
  }

  for(const e of enemies){
    const ox=e.x,oz=e.z;
    if(!e.alive){
      animations.enemies.get(e).update(dt,{alive:false});
      e.respawn-=dt;
      if(e.respawn<=0&&!e.isBoss){
        e.x=e.spawnX;e.z=e.spawnZ;e.hp=e.maxHp||8;e.alive=true;e.attack=1;
        e.cacheOre=e.cache?3:0;if(e.cache)e.cache.visible=true;
      }
      continue;
    }
    const intent=enemyIntent(e,{...player,cave:state.cave},state.time,elapsed);

    // Shaman and Pyro Boss ranged magic
    if(e.alive&&intent.shoot&&!state.cave){
      e.castTimer=(e.castTimer||0)-dt;
      if(e.castTimer<=0){
        e.castTimer=e.bossType==='pyro'?2.2:2.6;
        const isFire=e.bossType==='pyro';
        const color=isFire?'#ff5500':'#bb44ff';
        const orb=new THREE.Mesh(new THREE.SphereGeometry(isFire?.35:.2,8,8),new THREE.MeshBasicMaterial({color}));
        orb.position.set(e.x,terrain(e.x,e.z)+1.6,e.z);
        const dir=new THREE.Vector3(player.x-e.x,(player.y+1.1)-(terrain(e.x,e.z)+1.6),player.z-e.z).normalize();
        scene.add(orb);
        if(isFire)audio.play('fireball');
        projectiles.push({mesh:orb,direction:dir,life:2.5,isEnemy:true,isFire,damage:isFire?14:8,speed:isFire?22:19});
      }
    }

    const dx=intent.x-e.x,dz=intent.z-e.z,d=Math.hypot(dx,dz),step=Math.min(d,intent.speed*dt);
    if(d>.05){
      const nx=e.x+dx/d*step,nz=e.z+dz/d*step;
      if(!worldBlocked(nx,e.z,terrain(nx,e.z)))e.x=nx;
      if(!worldBlocked(e.x,nz,terrain(e.x,nz)))e.z=nz;
      e.group.rotation.y=Math.atan2(dx,dz);
    }
    e.attack-=dt;
    if(intent.attack&&!state.cave&&e.attack<=0){
      const clear=!blockedLine(e,player);
      if(clear){
        const baseDmg=e.attackDmg||(e.isBoss?20:7);
        const finalDmg=state.heavyArmor?baseDmg*.25:state.armor?baseDmg*.6:baseDmg;
        state.hp=clamp(state.hp-finalDmg,0,100);
        animations.enemies.get(e).strike();audio.play('hit');
        // Realistic bleeding on heavy hits
        if((e.type==='berserker'||e.isBoss)&&Math.random()<0.45){
          state.bleeding=7;
          notify('У вас открылось кровотечение! Съешьте пищу или отдохните у костра!');
        }
      }
      e.attack=e.isBoss?1.7:1.2;
    }
    e.group.position.set(e.x,terrain(e.x,e.z),e.z);animations.enemies.get(e).update(dt,{speed:Math.hypot(e.x-ox,e.z-oz)/dt});
  }
}

function updateCamera(){
  const target=new THREE.Vector3(player.x,player.y+2.1,player.z),cp=Math.cos(player.pitch),sp=Math.sin(player.pitch);
  const desired=new THREE.Vector3(target.x+Math.sin(player.yaw)*player.dist*cp+Math.cos(player.yaw)*.65,target.y+player.dist*sp+1.2,target.z+Math.cos(player.yaw)*player.dist*cp-Math.sin(player.yaw)*.65);
  camera.position.copy(desired);
  for(let i=1;i<=24;i++){
    const t=i/24,x=target.x+(desired.x-target.x)*t,y=target.y+(desired.y-target.y)*t,z=target.z+(desired.z-target.z)*t;
    if(y<floorAt(x,z)+.8){const safe=Math.max(.05,(i-1)/24);camera.position.copy(target).lerp(desired,safe);break;}
  }
  camera.position.y=Math.max(camera.position.y,floorAt(camera.position.x,camera.position.z)+.8);
  if(state.cave)camera.position.y=Math.min(camera.position.y,caveY+4.1);camera.lookAt(target);
}

function update(dt){
  const ox=player.x,oz=player.z,oldHp=state.hp;elapsed+=dt;hitCooldown-=dt;saveTimer+=dt;uiTimer+=dt;stepTimer-=dt;
  state.time+=dt/45;if(state.time>=24){state.time-=24;state.day++;}

  // REALISTIC SURVIVAL MECHANICS
  state.food=clamp(state.food-dt*.045,0,100);
  state.water=clamp(state.water-dt*.065,0,100);

  // Sickness from raw dirty water
  if(state.sick>0){
    state.sick-=dt;
    state.food=clamp(state.food-dt*.08,0,100);
    state.water=clamp(state.water-dt*.1,0,100);
  }

  // Bleeding
  if(state.bleeding>0){
    state.bleeding-=dt;
    state.hp=clamp(state.hp-dt*1.6,0,100);
    bleedEl.style.opacity=Math.min(0.6,state.bleeding/6);
  }else{
    bleedEl.style.opacity='0';
  }

  // Body Temperature / Warmth
  const night=state.time>=20||state.time<5;
  const inOcean=Math.hypot(player.x,player.z)>138;
  const byFire=nearFire();
  const sheltered=insideShelter();
  const torchWarmth=state.torch&&state.torchOn;

  if(inOcean){
    state.temp=clamp(state.temp-dt*1.2,0,100);
  }else if(byFire){
    state.temp=clamp(state.temp+dt*2.5,0,100);
  }else if(torchWarmth||sheltered){
    state.temp=clamp(state.temp+dt*0.4,0,100);
  }else if(night){
    const coldRate=state.armor?0.15:0.25;
    state.temp=clamp(state.temp-dt*coldRate,0,100);
  }else{
    state.temp=clamp(state.temp+dt*0.12,0,100);
  }

  // Freezing penalty
  if(state.temp<25){
    freezeEl.style.opacity=String((1-state.temp/25)*0.6);
    state.hp=clamp(state.hp-dt*1.2,0,100);
  }else{
    freezeEl.style.opacity='0';
  }

  // Starvation / Dehydration
  if(!state.food||!state.water)state.hp=clamp(state.hp-dt*1.8,0,100);

  // Player Movement & Stamina
  let mx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),mz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0);
  const len=Math.hypot(mx,mz)||1;mx/=len;mz/=len;
  const isMoving=keys.has('KeyW')||keys.has('KeyS')||keys.has('KeyA')||keys.has('KeyD');
  const isSprinting=keys.has('ShiftLeft')&&isMoving&&state.stamina>5&&state.temp>15;

  if(isSprinting){
    state.stamina=clamp(state.stamina-dt*16,0,100);
  }else if(isMoving){
    state.stamina=clamp(state.stamina+dt*8,0,100);
  }else{
    state.stamina=clamp(state.stamina+dt*18,0,100);
  }

  const speedMultiplier=state.temp<20?0.75:1.0;
  const speed=(isSprinting?9.3:5.8)*speedMultiplier;
  const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw);
  const nx=player.x+(mx*cos+mz*sin)*speed*dt,nz=player.z+(-mx*sin+mz*cos)*speed*dt;
  if(!blockedAt(nx,player.z))player.x=nx;if(!blockedAt(player.x,nz))player.z=nz;

  // Push player outside rock collision bounds to prevent ever being trapped under rocks
  for(const r of rocks){
    const dx=player.x-r.x,dz=player.z-r.z,dist=Math.hypot(dx,dz),minDist=r.radius+.65;
    if(dist<minDist&&dist>.01){
      player.x=r.x+(dx/dist)*minDist;
      player.z=r.z+(dz/dist)*minDist;
    }
  }

  // Floor collision & falling
  const floor=floorAt(player.x,player.z);player.vy-=22*dt;player.y+=player.vy*dt;
  if(player.y<=floor){
    if(player.vy<-15)state.hp=clamp(state.hp-8,0,100);
    player.y=floor;player.vy=0;player.ground=true;player.jumps=0;
  }else if(player.y>floor+.15){
    player.ground=false;
  }

  // Ceiling collision inside structures: roof at b.y + 3.2
  for(const b of state.structures){
    if(b.type==='roof'&&Math.abs(player.x-b.x)<=2.05&&Math.abs(player.z-b.z)<=2.05){
      if(player.y<b.y+2.8&&player.y+1.9>=b.y+3.05){
        player.y=b.y+3.05-1.9;
        if(player.vy>0){player.vy=0;audio.play('hit');}
      }
    }
  }

  avatar.position.set(player.x,player.y,player.z);avatar.rotation.y=player.yaw+Math.PI;
  const dayAngle=(state.time/24)*Math.PI*2-Math.PI/2;
  sun.position.set(Math.cos(dayAngle)*130,Math.sin(dayAngle)*150,55);sun.intensity=state.cave?.08:clamp(Math.sin(dayAngle)*2.6+.15,.08,2.6);
  if(state.cave)scene.background.set('#151e21');else scene.background.setHSL(.53,.27,clamp(.37+Math.sin(dayAngle)*.2,.12,.62));
  scene.fog.color.copy(scene.background);scene.fog.density=(state.cave?.032:.0028)+Math.sin(elapsed*.17)*.00025;

  updateEnemies(dt);updateProjectiles(dt);updateCamera();

  torchLight.intensity=state.torchOn&&state.torch?8+Math.sin(elapsed*17)*.7:0;torchLight.position.set(player.x,player.y+2,player.z);
  if(muzzleLight.intensity>0)muzzleLight.intensity=Math.max(0,muzzleLight.intensity-dt*110);

  if(state.hp<oldHp)animations.player.hit();
  const movement=Math.hypot(player.x-ox,player.z-oz)/dt;
  equipment.update(state);
  animations.player.update(dt,{speed:movement,grounded:player.ground,alive:state.hp>0,equipped:state.equipped==='axe',hasTorch:!!state.torch,torchOn:state.torchOn});animations.update(dt,elapsed);
  if(movement>.2&&player.ground&&stepTimer<=0){audio.play('step');stepTimer=keys.has('ShiftLeft')?.24:.4;}
  audio.update(Math.hypot(player.x,player.z),elapsed,state.cave);
  crystal.rotation.y=elapsed*.45;crystal.position.y=caveY+1+Math.sin(elapsed*2)*.16;caveLight.intensity=20+Math.sin(elapsed*2)*5;motes.rotation.y=elapsed*.008;
  for(const [record,model] of buildings)if(record.type==='campfire'){const flames=model.getObjectByName('campfire-flames');flames.scale.y=1+Math.sin(elapsed*12)*.12;}
  if(mouseDown)action();

  // Dynamic crosshair hit indicator
  const {enemyMesh}=getCrosshairTargetPoint(75);
  if(enemyMesh){
    crossEl.classList.add('hit');
  }else{
    crossEl.classList.remove('hit');
  }

  if(uiTimer>.1){
    uiTimer=0;checkQuest();refresh();updatePreview();
    hint.textContent=buildType?`${labels[buildType]} · R поворот · ЛКМ поставить · ${invalidPlacement||'Можно строить'}`:state.cave?'E исследовать / выйти · Компас: запад — залежи, восток — выход':nearFire()?'E костёр · приготовить еду / очистить воду':nearbyBuilding('bed')?'E кровать · установить спавн (ночью — спать)':nearbyBuilding()?'E взаимодействие с постройкой':Math.hypot(player.x-24,player.z+12)<4||Math.hypot(player.x,player.z)>138?'E набрать воду во флягу':`ЛКМ атака / ломать · ${labels[hotbar[selected]]}: X использовать · ${labels[state.equipped]||'Руки'}`;
    hint.classList.add('show');
  }
  if(saveTimer>20){saveTimer=0;if(state.hp>0)saveGame();}
  if(state.hp<=0){resetNight();buildType=null;disposePreview();openMenu('dead');saveGame();}
}

applySettings();openMenu(state.hp>0?'start':'dead');refresh();updateCamera();
let previous=performance.now(),accumulator=0;
const fixed=1/60;
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min((now-previous)/1000,.05);previous=now;
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('show');}
  if(!state.paused){accumulator+=dt;while(accumulator>=fixed){update(fixed);accumulator-=fixed;if(state.paused){accumulator=0;break;}}wave(elapsed);}
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
