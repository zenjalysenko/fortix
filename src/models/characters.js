import * as THREE from 'three';
import { mesh, bevelBox, material } from './geometry.js';
import { createAxe, createBackpack, createTorch } from './props.js';

function quaternionTrack(name, angles, times = [0, .25, .5, .75, 1], axis = 'x') {
  const values = angles.flatMap(angle => {
    const euler = new THREE.Euler(); euler[axis] = angle;
    return new THREE.Quaternion().setFromEuler(euler).toArray();
  });
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

function characterClips() {
  const stride = (name, duration, amplitude) => {
    const times = [0, duration / 4, duration / 2, duration * .75, duration];
    return new THREE.AnimationClip(name, duration, ['left-arm', 'right-arm', 'left-leg', 'right-leg'].map((part, i) => quaternionTrack(part, [0, amplitude, 0, -amplitude, 0].map(v => v * (i === 1 || i === 2 ? -1 : 1)), times)));
  };
  return [
    new THREE.AnimationClip('idle', 2, [quaternionTrack('head-pivot', [0, .045, 0, -.045, 0], [0, .5, 1, 1.5, 2], 'y')]),
    stride('walk', .8, .55), stride('run', .5, .85),
    new THREE.AnimationClip('attack', .42, [quaternionTrack('right-arm', [0, -.5, -1.9, -.7, 0], [0, .1, .21, .32, .42])]),
    new THREE.AnimationClip('jump', .7, [quaternionTrack('left-leg', [0, -.65, -.65, -.3, 0], [0, .15, .35, .55, .7]), quaternionTrack('right-leg', [0, .4, .4, .2, 0], [0, .15, .35, .55, .7])]),
    new THREE.AnimationClip('hurt', .3, [quaternionTrack('character-rig', [0, .12, -.08, .04, 0], [0, .075, .15, .225, .3], 'z')]),
    new THREE.AnimationClip('death', .8, [quaternionTrack('character-rig', [0, .1, .5, 1.2, Math.PI / 2], [0, .2, .4, .6, .8], 'z')]),
  ];
}

export function createCharacter({ enemy = false } = {}) {
  const root = new THREE.Group(); root.name = enemy ? 'wanderer' : 'hero';
  const rig = new THREE.Group(); rig.name = 'character-rig'; root.add(rig);
  const outfit = enemy ? 'enemy-robes' : 'hero-jacket';
  const legs = enemy ? 'enemy-robes' : 'hero-trousers';
  const limbNames = ['left-arm', 'right-arm', 'left-leg', 'right-leg'];
  for (let i = 0; i < 4; i++) {
    const arm = i < 2, side = i % 2 ? 1 : -1;
    const pivot = new THREE.Group(); pivot.name = limbNames[i];
    pivot.position.set(side * (arm ? .47 : .21), arm ? 1.7 : .82, 0);
    rig.add(pivot);
    mesh(pivot, 'upper-limb', bevelBox(arm ? .24 : .27, arm ? .33 : .37, arm ? .27 : .3, .06), arm ? outfit : legs, '#ffffff', [0, arm ? -.16 : -.18, 0]);
    const lower = new THREE.Group(); lower.name = `${limbNames[i]}-joint`; lower.position.y = arm ? -.31 : -.36; pivot.add(lower);
    mesh(lower, 'lower-limb', bevelBox(arm ? .21 : .23, arm ? .29 : .3, arm ? .23 : .27, .045), arm ? outfit : legs, '#ffffff', [0, -.14, 0]);
    if (arm) {
      mesh(lower, 'hand', bevelBox(.18, .19, .2, .04), enemy ? legs : 'skin', enemy ? '#ffffff' : '#d6b395', [0, -.33, .025]);
      mesh(pivot, 'shoulder-pad', bevelBox(.31, .13, .34), enemy ? 'leather' : outfit, enemy ? '#8b8070' : '#ead9c3', [0, -.015, 0]);
    } else {
      mesh(lower, 'boot', bevelBox(.28, .22, .43, .05), 'leather', '#7c6856', [0, -.31, .07]);
      mesh(lower, 'boot-sole', bevelBox(.29, .055, .44, .02), 'leather', '#514d45', [0, -.405, .07]);
      mesh(pivot, 'knee-pad', bevelBox(.26, .19, .06), 'leather', '#8c816a', [0, -.32, .16]);
    }
  }
  const torso = new THREE.Group(); torso.name = 'torso'; rig.add(torso);
  const body = mesh(torso, enemy ? 'enemy-body' : 'hero-jacket', new THREE.CylinderGeometry(.4, .32, .86, 8), outfit, '#ffffff', [0, 1.33, 0]);
  body.scale.z = .7;
  mesh(torso, 'belt', bevelBox(.69, .11, .51), 'leather', '#8b765d', [0, .95, 0]);
  mesh(torso, 'belt-buckle', bevelBox(.13, .1, .06), 'stone', '#cfb386', [0, .95, .29], { metalness: .6, roughness: .4 });
  mesh(torso, 'collar', new THREE.CylinderGeometry(.2, .24, .13, 8), outfit, '#d5cbbb', [0, 1.79, 0]);
  mesh(torso, 'neck', new THREE.CylinderGeometry(.12, .14, .16, 8), enemy ? outfit : 'skin', enemy ? '#ffffff' : '#d6b395', [0, 1.88, 0]);
  const headPivot = new THREE.Group(); headPivot.name = 'head-pivot'; headPivot.position.y = 2.16; torso.add(headPivot);
  const sideMaterial = material(enemy ? outfit : 'skin', enemy ? '#ffffff' : '#d6b395');
  const hair = material('skin', '#4b3424');
  const face = material(enemy ? 'enemy-mask' : 'hero-face');
  const head = new THREE.Mesh(bevelBox(enemy ? .64 : .54, enemy ? .64 : .57, enemy ? .56 : .48, .075), [sideMaterial, sideMaterial, enemy ? sideMaterial : hair, sideMaterial, face, enemy ? sideMaterial : hair]);
  head.name = enemy ? 'enemy-head' : 'hero-head'; head.castShadow = true; headPivot.add(head);
  if (enemy) {
    const cowl = mesh(torso, 'hood-cowl', new THREE.TorusGeometry(.33, .09, 5, 10), outfit, '#ffffff', [0, 1.88, -.02]); cowl.rotation.x = Math.PI / 2;
    const skirt = mesh(torso, 'robe-skirt', new THREE.CylinderGeometry(.33, .5, .65, 9, 1, true), outfit, '#ffffff', [0, .85, 0]); skirt.scale.z = .72;
    for (const side of [-1, 1]) {
      const eye = mesh(headPivot, 'glowing-eye', new THREE.SphereGeometry(.065, 8, 6), 'enemy-mask', '#ffbd67', [side * .145, .02, .29], { emissive: '#ec7f20', emissiveIntensity: 1.8 });
      eye.scale.set(1, .2, .3);
    }
  } else {
    const cap = mesh(headPivot, 'hair-cap', new THREE.SphereGeometry(.29, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 'skin', '#4b3424', [0, .18, -.015]); cap.scale.set(1, .45, .87);
    for (const x of [-.2, .2]) mesh(torso, 'jacket-pocket', bevelBox(.19, .22, .04), outfit, '#e5d5c1', [x, 1.37, .29]);
    const pack = createBackpack(); pack.position.set(0, 1.42, -.37); torso.add(pack);
  }
  const axe = createAxe(); axe.visible = false; axe.position.set(0, -.65, .16); axe.rotation.x = Math.PI / 2; rig.getObjectByName('right-arm').add(axe);
  const torch = createTorch(); torch.name = 'equipped-torch'; torch.visible = false; torch.position.set(-.48, 1.2, -.15); torso.add(torch);
  root.animations = characterClips();
  return root;
}

export function characterParts(root) {
  const rig = root.getObjectByName('character-rig');
  return {
    rig, torso: rig.getObjectByName('torso'), head: rig.getObjectByName('head-pivot'),
    limbs: ['left-arm', 'right-arm', 'left-leg', 'right-leg'].map(name => rig.getObjectByName(name)),
    axe: rig.getObjectByName('axe'), torch: rig.getObjectByName('equipped-torch'),
  };
}
