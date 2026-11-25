import * as THREE from 'three';
import { mesh, bevelBox, beam } from '../models/geometry.js';

export function equipModels(avatar) {
  const hand=avatar.getObjectByName('right-arm'), models={};
  for(const kind of ['pickaxe','spear','bow','pistol']) {
    const group=new THREE.Group(); group.name=`equipped-${kind}`; group.position.set(0,-.65,.2); group.visible=false;
    if(kind==='pickaxe') {
      mesh(group,'handle',new THREE.CylinderGeometry(.045,.045,.9,7),'wood','#c9ac7e');
      const head=mesh(group,'pick-head',new THREE.ConeGeometry(.12,.8,5),'stone','#c2c8c4',[0,.32,0]); head.rotation.z=Math.PI/2;
    }
    if(kind==='spear') {
      mesh(group,'shaft',new THREE.CylinderGeometry(.035,.045,2.2,7),'wood','#c9ac7e');
      mesh(group,'point',new THREE.ConeGeometry(.13,.42,5),'stone','#bbc4bd',[0,1.25,0]);
    }
    if(kind==='bow') {
      const curve=new THREE.EllipseCurve(0,0,.35,.7,-Math.PI/2,Math.PI/2);
      const points=curve.getPoints(16).map(p=>new THREE.Vector3(p.x,p.y,0));
      mesh(group,'bow-frame',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),16,.035,5,false),'wood','#bb9265');
      beam(group,'bow-string',[0,-.7,0],[0,.7,0],.012,'cloth','#eee7cc');
    }
    if(kind==='pistol') {
      mesh(group,'pistol-grip',bevelBox(.07,.24,.1,.02),'wood','#3a2a1d',[0,-.06,-.04]);
      mesh(group,'pistol-barrel',bevelBox(.07,.09,.38,.015),'stone','#232629',[0,.08,.1],{metalness:.85,roughness:.25});
      mesh(group,'pistol-chamber',bevelBox(.08,.11,.14,.015),'stone','#181a1c',[0,.08,-.06],{metalness:.9,roughness:.2});
    }
    hand.add(group);models[kind]=group;
  }
  const torso = avatar.getObjectByName('torso');
  const plate=mesh(torso,'armor-plate',bevelBox(.72,.75,.14),'stone','#a2afb0',[0,1.35,.32],{metalness:.65,roughness:.45});
  const heavyPlate=mesh(torso,'heavy-armor-plate',bevelBox(.78,.82,.22),'stone','#363d42',[0,1.35,.32],{metalness:.85,roughness:.25});
  return {
    update(state) {
      for(const [kind,model] of Object.entries(models))model.visible=state.equipped===kind;
      plate.visible=!!state.armor && !state.heavyArmor;
      heavyPlate.visible=!!state.heavyArmor;
    },
  };
}
