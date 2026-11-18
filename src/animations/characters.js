import * as THREE from 'three';
import { createCharacter, characterParts } from '../models/index.js';

export function animateCharacter(group, { enemy = false } = {}) {
  if (!group.getObjectByName('character-rig')) {
    const model = createCharacter({ enemy });
    group.clear();
    group.add(...[...model.children]);
    group.animations = model.animations;
  }
  const { rig, limbs, torso, head, axe, torch } = characterParts(group);
  const flame = torch.getObjectByName('torch-flame');
  let phase = 0, attack = 0, hurt = 0, death = 0, blend = 0, landing = 0, wasGrounded = true;
  return {
    strike() { attack = .42; },
    hit() { hurt = .3; },
    update(dt, { speed = 0, grounded = true, alive = true, equipped = false, hasTorch = false, torchOn = false } = {}) {
      if (grounded && !wasGrounded) landing = .25;
      wasGrounded = grounded;
      landing = Math.max(0, landing - dt);
      axe.visible = !enemy && equipped;
      torch.visible = !enemy && hasTorch;
      flame.visible = torchOn;
      flame.scale.y = 1 + Math.sin(phase * 8) * .18;
      attack = Math.max(0, attack - dt);
      hurt = Math.max(0, hurt - dt);
      death = THREE.MathUtils.damp(death, alive ? 0 : 1, 9, dt);
      blend = THREE.MathUtils.damp(blend, Math.min(1, speed / 5), 12, dt);
      phase += dt * (speed > 7 ? 13 : speed > .1 ? 9 : 1.8);
      const stride = Math.sin(phase) * .65 * blend;
      limbs[0].rotation.x = stride;
      limbs[1].rotation.x = -stride - Math.sin(attack / .42 * Math.PI) * 2.1;
      limbs[2].rotation.x = grounded ? -stride : -.65;
      limbs[3].rotation.x = grounded ? stride : .4;
      for (let i = 0; i < limbs.length; i++) {
        const joint = limbs[i].getObjectByName(`${limbs[i].name}-joint`);
        joint.rotation.x = i < 2 ? -.15 - Math.abs(stride) * .4 : Math.max(0, -Math.sin(phase + (i === 2 ? 0 : Math.PI))) * blend * .65;
      }
      torso.position.y = Math.sin(phase * 2) * .045 * blend + Math.sin(phase) * .018 * (1 - blend);
      torso.rotation.x = grounded ? -.07 * blend : -.12;
      head.rotation.y = Math.sin(phase * .5) * .045 * (1 - blend);
      head.rotation.x = -Math.sin(attack / .42 * Math.PI) * .1;
      rig.position.z = -Math.sin(hurt / .3 * Math.PI) * .15;
      rig.rotation.z = death * Math.PI / 2 + Math.sin(hurt * 50) * hurt * .15;
      rig.scale.setScalar(1 - death * .85);
      rig.scale.y *= 1 - Math.sin(landing / .25 * Math.PI) * .12;
      group.visible = death < .995;
    },
  };
}
