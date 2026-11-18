import { animateCharacter } from './characters.js';
import { animateEnvironment } from './environment.js';
import { createSurfaceTextures, textureScene, updateTextures } from './textures.js';

export function createAnimations(context) {
  const textures = createSurfaceTextures();
  const player = animateCharacter(context.avatar);
  const enemies = new Map(context.enemies.map(enemy => [enemy, animateCharacter(enemy.group, { enemy: true })]));
  const environment = animateEnvironment({ ...context, textures });
  textureScene(context.scene, textures);
  return {
    player, enemies, environment,
    applyTextures(object) { textureScene(object, textures); },
    update(dt, time) {
      environment.update(dt, time);
      updateTextures(textures, time);
    },
  };
}
