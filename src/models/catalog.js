import { createCharacter, createPine, createRock, createShelter, createCave, createRuins, createWall, createCrystal, createCampfire, createAxe, createTorch, createBackpack, createResource, createIsland, createOcean } from './index.js';

export const modelCatalog = {
  hero: () => createCharacter(),
  wanderer: () => createCharacter({ enemy: true }),
  pine: createPine, rock: createRock, shelter: createShelter, cave: createCave,
  ruins: createRuins, wall: createWall, crystal: createCrystal, campfire: createCampfire,
  axe: createAxe, torch: createTorch, backpack: createBackpack,
  wood: () => createResource('wood'), stone: () => createResource('stone'),
  ore: () => createResource('ore'), berries: () => createResource('berries'), meat: () => createResource('meat'),
  island: createIsland, ocean: createOcean,
};
