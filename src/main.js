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
root.innerHTML=`<div class="ui"><div class="top"><div class="brand">FORTINEX<span>ОСТРІВ БУР · ВИЖИВАННЯ</span></div><div class="pill" id="clock"></div></div><div class="objective" id="objective"></div><div class="stats"><div class="stat"><span>ЗДОРОВ’Я</span><div class="bar hp"><i id="hp"></i></div></div><div class="stat"><span>СИТІСТЬ</span><div class="bar food"><i id="food"></i></div></div><div class="stat"><span>ВОДА</span><div class="bar water"><i id="water"></i></div></div></div><div class="hotbar" id="hotbar" aria-label="Панель предметів"></div><div class="cross"></div><div class="hint" id="hint"></div><div class="toast" id="toast" role="status"></div><div id="panel" class="panel"><div class="card" id="card"></div></div></div>`;
const panel=document.querySelector('#panel'),card=document.querySelector('#card'),hint=document.querySelector('#hint'),toast=document.querySelector('#toast');
const scene=new THREE.Scene(); scene.background=new THREE.Color('#83b7c2'); scene.fog=new THREE.FogExp2('#9dc8c3',.0028);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,1100);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;root.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight('#d9f4ed','#546858',2.1));const sun=new THREE.DirectionalLight('#fff1cb',3.1);sun.position.set(-75,120,55);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-100;sun.shadow.camera.right=100;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;scene.add(sun);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+worldRandom()*(b-a);
function reserved(x,z){return [[0,0,10],[18,5,13],[-60,-24,15],[-30,37,9],[24,-12,5]].some(([a,b,r])=>Math.hypot(x-a,z-b)<r)}
const island=createIsland();scene.add(island);
const ocean=createOcean();scene.add(ocean);
function wave(t){ocean.material.userData.waveTime.value=t;}
// Single-material stylized tree and rock batches keep the island light on integrated GPUs.
const pineGeometry=createPineGeometries(),trunkG=pineGeometry.trunk,crownG=pineGeometry.crown,rockG=createRockGeometry();
const trees=[],rocks=[],solidBoxes=[];const trunkMat=new THREE.MeshStandardMaterial({color:'#d0b79b',roughness:1}),leafMat=new THREE.MeshStandardMaterial({color:'#c1d6b6',roughness:.9}),rockMat=new THREE.MeshStandardMaterial({color:'#c6ccc5',roughness:1});
trunkMat.userData.surface='wood';leafMat.userData.surface='leaves';rockMat.userData.surface='stone';
const trunk=new THREE.InstancedMesh(trunkG,trunkMat,300),crowns=new THREE.InstancedMesh(crownG,leafMat,300),stones=new THREE.InstancedMesh(rockG,rockMat,135);trunk.castShadow=crowns.castShadow=stones.castShadow=true;const dummy=new THREE.Object3D();let tc=0,sc=0;
for(let i=0;i<300;i++){const x=rand(-143,143),z=rand(-143,143),y=terrain(x,z);if(y<3||y>20||Math.hypot(x,z)>142||reserved(x,z))continue;const s=rand(.72,1.35);dummy.position.set(x,y+1.7*s,z);dummy.scale.setScalar(s);dummy.rotation.y=rand(0,Math.PI*2);dummy.updateMatrix();trunk.setMatrixAt(tc,dummy.matrix);dummy.position.y=y+5*s;dummy.scale.set(s,rand(.8,1.2),s);dummy.updateMatrix();crowns.setMatrixAt(tc,dummy.matrix);trees.push({id:`tree-${tc}`,x,z,y,hp:3,alive:true,index:tc++,radius:.4*s});}
for(let i=0;i<135;i++){const x=rand(-140,140),z=rand(-140,140),y=terrain(x,z);if(y<3||y>20||Math.hypot(x,z)>140||reserved(x,z))continue;dummy.position.set(x,y+.6,z);dummy.scale.set(rand(.6,1.6),rand(.45,1.1),rand(.6,1.5));dummy.rotation.set(rand(-.2,.2),rand(0,6),rand(-.2,.2));dummy.updateMatrix();stones.setMatrixAt(sc,dummy.matrix);rocks.push({id:`rock-${sc}`,x,z,y,hp:3,index:sc++,radius:1.05});}
trunk.count=crowns.count=tc;stones.count=sc;scene.add(trunk,crowns,stones);trunk.instanceMatrix.needsUpdate=crowns.instanceMatrix.needsUpdate=stones.instanceMatrix.needsUpdate=true;
// A hand-built lookout landmark and an open, traversable cave entrance.

function addSolid(x,z,halfX,halfZ,yaw=0){solidBoxes.push({x,z,halfX,halfZ,yaw})}
function worldBlocked(x,z,y,ignore=null){
  if(Math.hypot(x,z)>146)return true;
  for(const o of trees)if(o.alive&&Math.hypot(x-o.x,z-o.z)<.53+o.radius)return true;
  for(const o of rocks)if(Math.hypot(x-o.x,z-o.z)<.53+o.radius)return true;
  for(const b of solidBoxes)if(insideBox(x,z,b))return true;
  for(const b of state.structures)if(b!==ignore&&buildingBoxes(b).some(box=>y<box.y+box.height&&y+2>box.y&&insideBox(x,z,box)))return true;
  return false;
}
function blockedAt(x,z){
  if(state.cave)return x<caveX-27||x>caveX-4.5||Math.abs(z-caveZ)>4.5;
  return worldBlocked(x,z,player.y)||enemies.some(e=>e.alive&&Math.hypot(x-e.x,z-e.z)<1.2);
}
function placeLandmark(model,x,y,z){model.position.set(x,y,z);scene.add(model);for(const b of model.userData.colliders||[])addSolid(x+b.x,z+b.z,b.halfX,b.halfZ);return model}
const campX=18,campZ=5,campY=terrain(campX,campZ);placeLandmark(createShelter(),campX,campY,campZ);
const caveX=-60,caveZ=-24,caveY=terrain(caveX,caveZ);placeLandmark(createCave(),caveX,caveY,caveZ);
const crystal=createCrystal();crystal.position.set(caveX+4,caveY+1,caveZ-4);scene.add(crystal);const caveLight=new THREE.PointLight('#54e9d1',25,20);caveLight.position.copy(crystal.position);scene.add(caveLight);
const ruinX=-30,ruinZ=37,ruinY=terrain(ruinX,ruinZ);placeLandmark(createRuins(),ruinX,ruinY,ruinZ);
// Fireflies / floating atmospheric motes.
const moteGeo=new THREE.BufferGeometry(),moteData=[];for(let i=0;i<500;i++)moteData.push(rand(-125,125),rand(1,18),rand(-125,125));moteGeo.setAttribute('position',new THREE.Float32BufferAttribute(moteData,3));const motes=new THREE.Points(moteGeo,new THREE.PointsMaterial({color:'#f1e5ab',size:.11,transparent:true,opacity:.5}));scene.add(motes);
const player={x:saved?.player.x||0,z:saved?.player.z||0,y:0,vy:0,yaw:0,pitch:.3,dist:8,ground:true};
function floorAt(x,z){
  if(state.cave)return caveY-5;
  let y=terrain(x,z);
  for(const b of state.structures)if(b.type==='floor'&&Math.abs(x-b.x)<2&&Math.abs(z-b.z)<2)y=Math.max(y,b.y+.22);
  return y;
}
player.y=floorAt(player.x,player.z);
const avatar=createCharacter();avatar.position.set(player.x,player.y,player.z);scene.add(avatar);
const enemyTypes=['patrol','guard','skittish','nocturnal'];
const enemies=Array.from({length:10},(_,i)=>{
  const group=createCharacter({enemy:true}),x=[-32,56,-82,77,8,-42,102,-112,34,-16][i],z=[-6,34,14,-62,-98,83,57,-30,108,-122][i];
  const e={x,z,spawnX:x,spawnZ:z,hp:6,alive:true,attack:1,respawn:0,phase:i*2,type:enemyTypes[i%4],group};
  // Resource guards protect a real ore cache rather than an empty patrol point.
  if(e.type==='guard'){
    const cache=createCrystal();cache.scale.setScalar(.6);cache.position.set(x+2,terrain(x+2,z),z);scene.add(cache);e.cache=cache;e.cacheOre=3;
  }
  const previous=state.enemyState[i];if(previous)Object.assign(e,previous);
  if(e.cache)e.cache.visible=e.cacheOre>0;
  group.position.set(e.x,terrain(e.x,e.z),e.z);scene.add(group);
  const tint=['#bdc9b5','#d6b27d','#a0d0ba','#9aa5dc'][i%4];
  group.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(o.material)?o.material:[o.material])m.color.multiply(new THREE.Color(tint));}});
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
const keys=new Set();
let pointer=false,mouseDown=false,elapsed=0,selected=0,hitCooldown=0,toastTimer=0,saveTimer=0,uiTimer=0,stepTimer=0;
let menuKind='start',activeChest=null,buildType=null,buildYaw=0,preview=null,candidate=null,invalidPlacement='',lastHud='';
const projectiles=[];
const compass=document.createElement('div');compass.className='compass';document.querySelector('.ui').append(compass);
const controls=document.createElement('div');controls.className='controls';controls.textContent='1–8 предмети · X використати · E взаємодія · Q крафт · B база · M карта · Esc пауза';document.querySelector('.ui').append(controls);
function notify(text){toast.textContent=text;toast.classList.add('show');toastTimer=3;}
function button(action,text,extra=''){return `<button class="btn" data-action="${action}" ${extra}>${text}</button>`;}
function nearFire(){return !state.cave&&(Math.hypot(player.x-campX,player.z-campZ)<7||state.structures.some(b=>b.type==='campfire'&&Math.hypot(player.x-b.x,player.z-b.z)<4));}
function nearbyBuilding(type){return state.structures.filter(b=>(!type||b.type===type)&&Math.hypot(player.x-b.x,player.z-b.z)<3.5).sort((a,b)=>Math.hypot(player.x-a.x,player.z-a.z)-Math.hypot(player.x-b.x,player.z-b.z))[0];}
function inventory(){return `<div class="inventory">${Object.keys(labels).filter(k=>state[k]>0).map(k=>`<div class="item"><span>${labels[k]}</span><b>${state[k]}</b></div>`).join('')}</div><p>Фляга: ${state.flask?`${state.dirtyWater+state.cleanWater}/4 порцій`:'не виготовлена'} · Стріли: ${state.arrows} · Броня: ${state.armor?'−40% шкоди':'немає'}</p>`;}
const help='WASD рух · Shift біг · Пробіл стрибок · ЛКМ атака / будувати · E взаємодія · 1–8 вибір предмета · X використати / спорядити · F смолоскип · Q крафт · I запаси · B будівництво · R поворот макета · M карта · P позначка · Esc пауза';
function openMenu(kind){
  menuKind=kind;state.paused=true;mouseDown=false;keys.clear();audio.pause();panel.classList.remove('hidden');document.exitPointerLock?.();
  renderMenu();
}
function renderMenu(){
  let html='';
  if(menuKind==='start')html=`<div class="eyebrow">FORTINEX · ОСТРІВ БУР</div><h1>Власний шлях.<br>Власний прихисток.</h1><p>Збирайте ресурси, розбудовуйте базу та переживіть ніч. Завдання у правому куті допоможуть освоїти острів.</p><div class="actions">${button('resume',saved?'Продовжити':'Почати гру')}${button('new','Новий острів')}${button('settings','Налаштування')}</div><div class="menu-note">${help}</div>`;
  if(menuKind==='pause')html=`<div class="eyebrow">ДЕНЬ ${state.day} · ОСТРІВ КЕЛЬ</div><h1>Перепочинок</h1><div class="actions">${button('resume','Продовжити')}${button('save','Зберегти')}${button('settings','Налаштування')}${button('map','Карта')}</div><div class="menu-note">${help}</div>`;
  if(menuKind==='inventory')html=`<h1>Запаси</h1>${inventory()}<p>Виберіть слот 1–8 і натисніть X. Броня захищає автоматично. Сире м’ясо спочатку приготуйте.</p>${button('resume','Повернутися · I')}`;
  if(menuKind==='craft'||menuKind==='fire'){
    const fire=nearFire();const keys=Object.keys(recipes).filter(k=>menuKind!=='fire'||recipes[k].fire);
    html=`<div class="eyebrow">${fire?'БІЛЯ БАГАТТЯ':'ПОХІДНА МАЙСТЕРНЯ'}</div><h1>${menuKind==='fire'?'Багаття':'Ремесло'}</h1><p>Багаття витрачає деревину на приготування та очищення. Фляга вміщує 4 порції води. Набори споруд розміщуються через B.</p><div class="recipes">${keys.map(k=>{const reason=craftReason(state,k,fire);return button(`craft:${k}`,`${labels[k]}${recipes[k].amount?` ×${recipes[k].amount}`:''}<small>${Object.entries(recipes[k].cost).map(([item,count])=>`${labels[item]} ${count}`).join(' · ')}</small>${reason?`<small>${reason}</small>`:''}`,reason?'disabled':'');}).join('')}</div>${inventory()}${button('resume','Повернутися · Q')}`;
  }
  if(menuKind==='build')html=`<h1>Будівництво</h1><p>Спочатку виготовте набір у Q. Підлога задає сітку 4 × 4 м; стіни та двері стають на її край. Дах, ліжко й скриня потребують підлоги.</p><div class="recipes">${buildingTypes.map(k=>button(`build:${k}`,`${labels[k]} <small>Наборів: ${state[k]}</small>`,state[k]?'':'disabled')).join('')}</div><p>Зелений макет — можна будувати, червоний — є перешкода. R: поворот на 90°. B: завершити.</p>${button('craft','Виготовити набори')}${button('resume','Повернутися')}`;
  if(menuKind==='dead')html=`<div class="eyebrow">ШЛЯХ ПРОДОВЖУЄТЬСЯ</div><h1>Вас перемогли</h1><p>${state.spawn?'Відродження біля вашого ліжка.':'Побудуйте ліжко й активуйте його клавішею E, щоб зберегти точку відродження.'} Запаси та база залишаються.</p>${button('respawn','Відродитися')}`;
  if(menuKind==='settings')html=`<h1>Налаштування</h1><label class="setting">Гучність <input id="volume" type="range" min="0" max="1" step="0.05" value="${state.settings.volume}"></label><label class="setting">Чутливість миші <input id="sensitivity" type="range" min="0.3" max="2.5" step="0.1" value="${state.settings.sensitivity}"></label><label class="setting">Якість графіки <select id="quality"><option value="low">Низька</option><option value="medium">Середня</option><option value="high">Висока</option></select></label><p>Низька якість вимикає тіні та зменшує роздільність. Зміни зберігаються автоматично.</p>${button('sound','Прослухати звук')}${button('resume','Повернутися')}`;
  if(menuKind==='map')html=`<h1>Карта острова</h1>${mapMarkup()}<p>Зелений: табір · Блакитний: джерело · Фіолетовий: печера · Білий: ви · Жовтий: власні позначки · Квадрати: база.</p><div class="actions">${button('marker','Позначити моє місце')}${button('clear-markers','Очистити позначки')}${button('resume','Повернутися · M')}</div>`;
  if(menuKind==='chest'&&activeChest){
    html=`<h1>Скриня</h1><p>Кожне натискання переносить одну одиницю. Речі залишаються тут після відродження та перезапуску.</p><div class="storage">${['wood','stone','ore','berries','meat','cookedMeat','dirtyWater','cleanWater','arrows'].map(k=>`<div class="storage-row"><span>${labels[k]}<small>При собі: ${state[k]} · У скрині: ${activeChest.items[k]||0}</small></span>${button(`store:${k}`,'→',state[k]?'':'disabled')}${button(`take:${k}`,'←',activeChest.items[k]?'':'disabled')}</div>`).join('')}</div>${button('resume','Повернутися')}`;
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
  renderer.domElement.requestPointerLock?.()?.catch?.(()=>notify('Клацніть по грі, щоб увімкнути керування мишею'));
}
function saveGame(){
  state.enemyState=enemies.map(({x,z,hp,alive,respawn,attack,cacheOre})=>({x,z,hp,alive,respawn,attack,cacheOre:cacheOre||0}));
  try{localStorage.setItem('fortinex-save',JSON.stringify({version:2,state:{...state,paused:true},player:{x:player.x,z:player.z}}));return true;}
  catch{notify('Не вдалося зберегти: перевірте доступ до сховища браузера');return false;}
}
function applySettings(){
  const q=state.settings.quality;renderer.setPixelRatio(Math.min(devicePixelRatio,q==='low'?1:q==='medium'?1.4:2));renderer.shadowMap.enabled=q!=='low';
  scene.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;}});
  audio.volume(state.settings.volume);
}
function resetNight(){if(state.quest===3)state.nightDay=0;}
function respawn(){
  resetNight();state.hp=100;state.food=75;state.water=75;state.cave=false;state.torchOn=false;
  const spawn=state.spawn||{x:0,z:0};player.x=spawn.x;player.z=spawn.z;player.vy=0;player.ground=true;
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
  else if(action==='new'){try{localStorage.removeItem('fortinex-save');location.reload();}catch{notify('Сховище браузера недоступне');}}
  else if(action==='save'){if(saveGame())notify('Острів і запаси збережено');}
  else if(action==='respawn')respawn();
  else if(action==='craft'&&key){if(craftItem(state,key,nearFire())){notify(`Готово: ${labels[key]}`);audio.start(state.settings.volume);audio.play('build');checkQuest();saveGame();renderMenu();refresh();}}
  else if(action==='build'&&key){beginBuild(key);start();}
  else if(action==='sound'){audio.start(state.settings.volume);audio.play('quest');}
  else if(action==='marker'){addMarker();renderMenu();}
  else if(action==='clear-markers'){state.markers=[];saveGame();renderMenu();}
  else if(action==='store'||action==='take'){
    if(!activeChest)return;
    const from=action==='store'?state:activeChest.items,to=action==='store'?activeChest.items:state;
    if(action==='take'&&['cleanWater','dirtyWater'].includes(key)&&(!state.flask||state.cleanWater+state.dirtyWater>=4)){notify('Потрібна фляга з вільним місцем');return;}
    if(from[key]>0){from[key]--;to[key]=(to[key]||0)+1;saveGame();renderMenu();refresh();}
  }
  else if(['settings','map','craft'].includes(action))openMenu(action);
});
function mapMarkup(){
  const point=(x,z,color,label,size=3)=>`<circle cx="${x}" cy="${z}" r="${size}" fill="${color}"/><text x="${x+5}" y="${z-5}">${label}</text>`;
  return `<svg class="island-map" viewBox="-165 -165 330 330" role="img" aria-label="Карта острова з позицією гравця та позначками"><rect x="-165" y="-165" width="330" height="330" fill="#203f4c"/><circle r="146" fill="#506951" stroke="#a3b89a" stroke-width="3"/><path d="M-150 0H150 M0-150V150" stroke="#ffffff18"/><text x="-5" y="-152">N</text>${state.structures.map(b=>`<rect x="${b.x-2}" y="${b.z-2}" width="4" height="4" fill="#c5a777"/>`).join('')}${point(18,5,'#d1edb5','Табір')}${point(-60,-24,'#b2a2ff','Печера')}${point(24,-12,'#77e2ef','Джерело')}${point(-30,37,'#bbb','Руїни')}${state.markers.map((m,i)=>point(m.x,m.z,'#ffd575',String(i+1))).join('')}${state.spawn?point(state.spawn.x,state.spawn.z,'#f4bb94','Ліжко'):''}${point(player.x,player.z,'#fff','Ви',4)}</svg>`;
}
function addMarker(){if(state.markers.length>=20){notify('Ліміт: 20 позначок. Видаліть старі на карті');return;}state.markers.push({x:Math.round(player.x),z:Math.round(player.z)});saveGame();notify('Місце позначено на карті · M');}
function refresh(){
  document.querySelector('#hp').style.width=state.hp+'%';document.querySelector('#food').style.width=state.food+'%';document.querySelector('#water').style.width=state.water+'%';
  document.querySelector('#clock').textContent=`ДЕНЬ ${String(state.day).padStart(2,'0')} · ${String(Math.floor(state.time)).padStart(2,'0')}:${String(Math.floor(state.time%1*60)).padStart(2,'0')}`;
  const icons=['❋','♨','◉','⚒','⛏','↟','➶','☀'];
  const html=hotbar.map((key,i)=>`<button class="slot ${selected===i?'active':''} ${state.equipped===key?'equipped':''}" data-slot="${i}" title="${labels[key]} · ${i+1}, X"><small>${i+1}</small><span>${icons[i]}</span><b>${state[key]}</b><em>${labels[key]}</em></button>`).join('');
  if(html!==lastHud){document.querySelector('#hotbar').innerHTML=html;lastHud=html;}
  document.querySelector('#objective').textContent=`${Math.min(5,state.quest+1)}/5 · ${quests[state.quest]}`;
  const heading=((player.yaw*180/Math.PI)%360+360)%360;
  compass.textContent=`${['N','NW','W','SW','S','SE','E','NE'][Math.round(heading/45)%8]} · Табір ${Math.round(Math.hypot(player.x-campX,player.z-campZ))} м · Печера ${Math.round(Math.hypot(player.x-caveX,player.z-caveZ))} м · M карта`;
}
document.querySelector('#hotbar').addEventListener('click',e=>{const slot=e.target.closest('[data-slot]');if(slot&&!state.paused){selected=Number(slot.dataset.slot);useSelected();}});
function checkQuest(){if(advanceQuest(state)){notify(`Завдання виконано! ${quests[state.quest]}`);audio.play('quest');saveGame();}}
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
  const record={...candidate,items:{}};state.structures.push(record);state[buildType]--;addBuilding(record);audio.play('build');checkQuest();saveGame();
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
  else if(e.code==='Space'&&player.ground){player.vy=8.5;player.ground=false;}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();mouseDown=false;if(!state.paused)openMenu('pause');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!state.paused)openMenu('pause');});
document.addEventListener('pointerlockchange',()=>{pointer=document.pointerLockElement===renderer.domElement;if(!pointer){mouseDown=false;if(!state.paused)openMenu('pause');}});
document.addEventListener('mousemove',e=>{if(pointer&&!state.paused){player.yaw-=e.movementX*.0023*state.settings.sensitivity;player.pitch=clamp(player.pitch-e.movementY*.0018*state.settings.sensitivity,-.1,.85);}});
renderer.domElement.addEventListener('mousedown',e=>{if(e.button!==0||state.paused)return;if(!pointer){renderer.domElement.requestPointerLock?.();return;}if(buildType){placeBuilding();return;}mouseDown=true;action();});
window.addEventListener('mouseup',()=>mouseDown=false);
window.addEventListener('wheel',e=>{if(!state.paused)player.dist=clamp(player.dist+e.deltaY*.009,3,13);});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.addEventListener('pagehide',()=>{if(state.hp>0)saveGame();});
function closestTarget(range=4.2){
  const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);let best=null,bd=range;
  if(state.cave)return null;
  for(const t of [...trees.filter(t=>t.alive),...rocks,...enemies.filter(e=>e.alive)]){
    const dx=t.x-player.x,dz=t.z-player.z,d=Math.hypot(dx,dz);
    if(d<bd&&(dx*fx+dz*fz)/Math.max(d,.01)>.45){best=t;bd=d;}
  }
  return best;
}
function gather(t){
  const rock=t.id.startsWith('rock'),tool=state.equipped;
  t.hp-=rock?(tool==='pickaxe'?(state.ironPickaxe?3:2):1):(tool==='axe'?(state.ironAxe?3:2):1);
  animations.environment.hit(t,rock?'stone':'tree',t.hp<=0);
  if(t.hp<=0){
    state.harvested.push(t.id);
    if(rock){state.stone+=2;state.gatheredStone+=2;const ore=tool==='pickaxe'?2:1;state.ore+=ore;rocks.splice(rocks.indexOf(t),1);notify(`+2 камені · +${ore} руда`);}
    else{state.wood+=3;state.gatheredWood+=3;state.berries++;t.alive=false;notify('+3 деревини · +1 ягоди');}
    checkQuest();
  }
}
function damageEnemy(e,amount){
  e.hp-=amount;animations.enemies.get(e).hit();audio.play('hit');
  if(e.hp<=0){e.alive=false;e.respawn=300;state.meat++;state.ore++;animations.environment.loot('meat',e);animations.environment.loot('ore',e);notify('Противника переможено · +1 м’ясо · +1 руда');}
}
function blockedLine(from,to){
  if(state.cave)return false;
  const boxes=[...solidBoxes,...state.structures.flatMap(buildingBoxes)];
  return boxes.some(box=>[.2,.4,.6,.8].some(t=>insideBox(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t,box,.08)));
}
function action(){
  if(hitCooldown>0||state.paused||state.hp<=0)return;
  hitCooldown=state.equipped==='bow'?.85:.55;animations.player.strike();
  if(state.equipped==='bow'){
    if(!state.arrows){notify('Немає стріл — виготовіть у Q');return;}
    state.arrows--;audio.play('bow');
    const arrow=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.8,5),new THREE.MeshStandardMaterial({color:'#e3ca9f'}));
    arrow.position.set(player.x,player.y+1.5,player.z);
    const direction=new THREE.Vector3(-Math.sin(player.yaw),-.03,-Math.cos(player.yaw));
    // Aim assistance keeps arrows useful on the island's slopes with the third-person camera.
    const aim=enemies.filter(e=>e.alive&&!state.cave&&Math.hypot(e.x-player.x,e.z-player.z)<40&&!blockedLine(player,e))
      .filter(e=>{const dx=e.x-player.x,dz=e.z-player.z;return (dx*direction.x+dz*direction.z)/Math.max(.01,Math.hypot(dx,dz))>.97;})
      .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];
    if(aim)direction.set(aim.x-player.x,terrain(aim.x,aim.z)+1.2-arrow.position.y,aim.z-player.z).normalize();
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
    scene.add(arrow);projectiles.push({mesh:arrow,direction,life:1.5});return;
  }
  audio.play('hit');const target=closestTarget(state.equipped==='spear'?5.5:4.2);
  if(!target)return;
  if(blockedLine(player,target)){notify('Перешкода закриває ціль');return;}
  if(enemies.includes(target))damageEnemy(target,state.equipped==='spear'?3:state.equipped==='axe'?(state.ironAxe?4:2):1);
  else gather(target);
}
function interact(){
  if(state.cave){
    if(player.x>caveX-5.5){state.cave=false;player.x=caveX+9;player.z=caveZ+8;player.y=floorAt(player.x,player.z);player.vy=0;notify('Ви повернулися на острів');}
    else if(player.x<caveX-22){state.caveExplored=true;state.ore+=state.caveLoot?0:5;state.caveLoot=true;checkQuest();notify('Печеру досліджено · знайдено поклади руди');}
    else notify('Дослідіть західний кінець печери; вихід — на сході');return;
  }
  const b=state.structures.filter(b=>['door','chest','bed','campfire'].includes(b.type)&&Math.hypot(player.x-b.x,player.z-b.z)<3.5).sort((a,b)=>Math.hypot(player.x-a.x,player.z-a.z)-Math.hypot(player.x-b.x,player.z-b.z))[0];
  if(b?.type==='door'){
    if(b.open&&insideBox(player.x,player.z,{...b,halfX:1.3,halfZ:.7})){notify('Відійдіть від дверного отвору');return;}
    b.open=!b.open;buildings.get(b).getObjectByName('door-leaf').rotation.y=b.open?-Math.PI/2:0;saveGame();return;
  }
  if(b?.type==='chest'){activeChest=b;openMenu('chest');return;}
  if(b?.type==='bed'){
    const spawn={x:b.x+Math.cos(b.yaw)*1.7,z:b.z-Math.sin(b.yaw)*1.7};
    if(worldBlocked(spawn.x,spawn.z,floorAt(spawn.x,spawn.z),b)){notify('Звільніть місце збоку ліжка для відродження');return;}
    state.spawn=spawn;saveGame();notify('Точку відродження встановлено біля ліжка');return;
  }
  if(b?.type==='campfire'||nearFire()){openMenu('fire');return;}
  if(Math.hypot(player.x-24,player.z+12)<4||Math.hypot(player.x,player.z)>138){
    if(!state.flask){notify('Спочатку виготовіть флягу в Q');return;}
    const available=4-state.dirtyWater-state.cleanWater;
    if(available<=0){notify('Фляга повна');return;}
    state.dirtyWater+=available;notify(`Набрано ${available} порцій. Очистіть воду біля багаття`);refresh();return;
  }
  if(Math.hypot(caveX-player.x,caveZ-player.z)<8){state.cave=true;player.x=caveX-16;player.z=caveZ;player.y=caveY-5;player.vy=0;notify('Печера · рухайтеся на захід і натисніть E біля покладів');return;}
  const cache=enemies.find(e=>e.cacheOre>0&&!e.alive&&Math.hypot(player.x-e.spawnX,player.z-e.spawnZ)<4);
  if(cache){state.ore+=cache.cacheOre;cache.cacheOre=0;cache.cache.visible=false;notify('Схованка охоронця · +3 руди');return;}
  action();
}
function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];p.life-=dt;
    const step=p.direction.clone().multiplyScalar(32*dt);p.mesh.position.add(step);
    const pos=p.mesh.position;
    const hit=!state.cave&&enemies.find(e=>e.alive&&Math.hypot(pos.x-e.x,pos.z-e.z)<.8&&Math.abs(pos.y-(terrain(e.x,e.z)+1.2))<1.3);
    if(hit)damageEnemy(hit,3);
    if(hit||p.life<=0||pos.y<floorAt(pos.x,pos.z)||(!state.cave&&worldBlocked(pos.x,pos.z,pos.y))){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();projectiles.splice(i,1);}
  }
}
function updateEnemies(dt){
  for(const e of enemies){
    const ox=e.x,oz=e.z;
    if(!e.alive){animations.enemies.get(e).update(dt,{alive:false});e.respawn-=dt;if(e.respawn<=0){e.x=e.spawnX;e.z=e.spawnZ;e.hp=6;e.alive=true;e.attack=1;e.cacheOre=e.cache?3:0;if(e.cache)e.cache.visible=true;}continue;}
    const intent=enemyIntent(e,{...player,cave:state.cave},state.time,elapsed);
    const dx=intent.x-e.x,dz=intent.z-e.z,d=Math.hypot(dx,dz),step=Math.min(d,intent.speed*dt);
    if(d>.05){
      const nx=e.x+dx/d*step,nz=e.z+dz/d*step;
      if(!worldBlocked(nx,e.z,terrain(nx,e.z)))e.x=nx;
      if(!worldBlocked(e.x,nz,terrain(e.x,nz)))e.z=nz;
      e.group.rotation.y=Math.atan2(dx,dz);
    }
    e.attack-=dt;
    if(intent.attack&&!state.cave&&e.attack<=0){
      // Walls must also block attacks at close range.
      const clear=!blockedLine(e,player);
      if(clear){state.hp=clamp(state.hp-(state.armor?4.2:7),0,100);animations.enemies.get(e).strike();audio.play('hit');}
      e.attack=1.2;
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
  state.food=clamp(state.food-dt*.045,0,100);state.water=clamp(state.water-dt*.065,0,100);
  if(!state.food||!state.water)state.hp=clamp(state.hp-dt*1.8,0,100);
  let mx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),mz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0);
  const len=Math.hypot(mx,mz)||1;mx/=len;mz/=len;
  const speed=keys.has('ShiftLeft')?9.3:5.8,sin=Math.sin(player.yaw),cos=Math.cos(player.yaw);
  const nx=player.x+(mx*cos+mz*sin)*speed*dt,nz=player.z+(-mx*sin+mz*cos)*speed*dt;
  if(!blockedAt(nx,player.z))player.x=nx;if(!blockedAt(player.x,nz))player.z=nz;
  const floor=floorAt(player.x,player.z);player.vy-=22*dt;player.y+=player.vy*dt;
  if(player.y<=floor){if(player.vy<-15)state.hp=clamp(state.hp-8,0,100);player.y=floor;player.vy=0;player.ground=true;}else if(player.y>floor+.15)player.ground=false;
  avatar.position.set(player.x,player.y,player.z);avatar.rotation.y=player.yaw+Math.PI;
  const dayAngle=(state.time/24)*Math.PI*2-Math.PI/2;
  sun.position.set(Math.cos(dayAngle)*130,Math.sin(dayAngle)*150,55);sun.intensity=state.cave?.08:clamp(Math.sin(dayAngle)*2.6+.15,.08,2.6);
  if(state.cave)scene.background.set('#151e21');else scene.background.setHSL(.53,.27,clamp(.37+Math.sin(dayAngle)*.2,.12,.62));
  scene.fog.color.copy(scene.background);scene.fog.density=(state.cave?.032:.0028)+Math.sin(elapsed*.17)*.00025;
  updateEnemies(dt);updateProjectiles(dt);updateCamera();
  torchLight.intensity=state.torchOn&&state.torch?8+Math.sin(elapsed*17)*.7:0;torchLight.position.set(player.x,player.y+2,player.z);
  if(state.hp<oldHp)animations.player.hit();
  const movement=Math.hypot(player.x-ox,player.z-oz)/dt;
  equipment.update(state);
  animations.player.update(dt,{speed:movement,grounded:player.ground,alive:state.hp>0,equipped:state.equipped==='axe',hasTorch:!!state.torch,torchOn:state.torchOn});animations.update(dt,elapsed);
  if(movement>.2&&player.ground&&stepTimer<=0){audio.play('step');stepTimer=keys.has('ShiftLeft')?.24:.4;}
  audio.update(Math.hypot(player.x,player.z),elapsed,state.cave);
  crystal.rotation.y=elapsed*.45;crystal.position.y=caveY+1+Math.sin(elapsed*2)*.16;caveLight.intensity=20+Math.sin(elapsed*2)*5;motes.rotation.y=elapsed*.008;
  for(const [record,model] of buildings)if(record.type==='campfire'){const flames=model.getObjectByName('campfire-flames');flames.scale.y=1+Math.sin(elapsed*12)*.12;}
  if(mouseDown)action();
  if(uiTimer>.1){uiTimer=0;checkQuest();refresh();updatePreview();
    hint.textContent=buildType?`${labels[buildType]} · R поворот · ЛКМ поставити · ${invalidPlacement||'Можна будувати'}`:state.cave?'E дослідити / вийти · Компас: захід — поклади, схід — вихід':nearFire()?'E багаття · приготувати їжу / очистити воду':nearbyBuilding()?'E взаємодія зі спорудою':Math.hypot(player.x-24,player.z+12)<4||Math.hypot(player.x,player.z)>138?'E набрати воду у флягу':`E взаємодія · ${labels[hotbar[selected]]}: X використати · Зброя: ${labels[state.equipped]||'Руки'}`;
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
