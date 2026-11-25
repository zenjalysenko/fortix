# fortix

Three.js survival game with animated characters, interactive island objects and generated surface textures.

- [Texture assets and surface mapping](assets/textures/README.md)
- [Animations and integration](src/animations/README.md)
- [3D model catalogue and GLB files](assets/models/README.md)

The game uses the editable Three.js generators in `src/models`. Run `npm run models:export` to regenerate the 20 GLB models. Keep `assets/models` next to `assets/textures` when importing the exported models elsewhere.

Run `npm install` and `npm run dev` to play. Use `npm test` for animation and asset checks, and `npm run build` for a production bundle.

## Survival guide

The interface is in Ukrainian. The objectives guide you through gathering wood and stone, crafting an axe, building an enclosed shelter, surviving a night and exploring the cave. One island day lasts 18 real minutes while the game is running; menus pause the simulation.

| Controls | Action |
| --- | --- |
| WASD / Shift / Space | Walk / run / jump |
| Mouse / left click | Look / attack or place a building |
| E | Gather, open doors/chests, activate a bed, use a fire or water source |
| 1–8 / X | Select a hotbar slot / consume or equip the selected item |
| Q / I | Crafting / inventory |
| B / R | Building menu or cancel preview / rotate preview 90° |
| M / P | Map / mark current position (up to 20 markers) |
| F / Esc | Toggle a crafted torch / pause |

- **Food and water:** craft a flask in Q, find the marked spring or reach the shore, then press E to fill it with untreated water. The flask holds four servings. At the starting camp or a placed campfire, press E to cook raw meat or purify water; each serving costs one wood. Use cooked meat, berries and clean water through the hotbar. Chests accept food, water, materials and arrows; taking water back requires room in the flask.
- **Building:** craft kits in Q, select a part in B, rotate with R and left-click a green preview. Red previews explain the obstruction. Floors use a 4 m grid; walls and doors snap to its edges. Roofs, beds and chests require a floor. Enclose one floor with three walls, a door and a roof to complete the shelter objective. Uneven terrain, trees, rocks and existing structures can block placement.
- **Base:** E toggles doors, opens chests and sets a respawn point beside a bed. Leave room at the side of the bed. Death resets health, food and water and returns you to your activated bed, or the island center if no bed was activated. Inventory and buildings remain. Dying during the night objective resets that night's progress.
- **Equipment:** X equips a crafted axe, pickaxe, spear or bow. Axes harvest trees faster, pickaxes harvest stone faster and yield more ore, spears have longer melee reach and bows consume crafted arrows. Armor reduces incoming enemy damage by 40%. Iron axe/pickaxe upgrades require the original tool, ore and a nearby fire. A crafted torch can be toggled with F.
- **Enemies:** patrols roam and pursue, skittish wanderers flee, nocturnal enemies are aggressive at night, and guards defend nearby ore caches. Defeat a guard and press E at its cache to collect ore. Enemies collide with buildings and resources and respawn after five minutes of active play.
- **Exploration:** the compass and map show the camp, spring, ruins, cave, base and custom markers. Enter the cave with E, travel west to its inner deposits and press E to explore; return east and use E to leave.
- **Sound and settings:** procedural footsteps, impacts, bow shots and sea ambience start after a user gesture. Volume, mouse sensitivity and low/medium/high graphics quality are available from the start/pause menu. Low quality disables shadows and lowers rendering resolution.

Progress saves automatically every 20 seconds of active play and on page exit; the pause menu also has a save button. Saves include a deterministic world seed, harvested resources, enemy state, buildings, chest contents, respawn point, quest progress, markers and settings. Saves stay in this browser under `fortinex-save`. Existing inventory/position saves are migrated; corrupted saves fall back to a new game. “Новий острів” clears the local save.

The game rules, building placement, save validation and equipment checks live in `src/game/*.test.js` and run with `npm test`. New building/equipment models are generated at runtime; the original exported GLB catalogue remains unchanged.

Browser textures use the checked-in WebP copies in `assets/textures/runtime` (about 0.79 MB total); original PNG sources remain available for GLB exports. Regenerate them with `python scripts/optimize-textures.py` using Pillow. Ocean displacement and analytic normals run on the GPU, and the hotbar DOM is replaced only when its contents or selection change. The simulation checks the HUD at most ten times per second.
