# fortix

Three.js survival game with animated characters, interactive island objects and generated surface textures.

- [Texture assets and surface mapping](assets/textures/README.md)
- [Animations and integration](src/animations/README.md)
- [3D model catalogue and GLB files](assets/models/README.md)

The game uses the editable Three.js generators in `src/models`. Run `npm run models:export` to regenerate the 20 GLB models. Keep `assets/models` next to `assets/textures` when importing the exported models elsewhere.

Run `npm install` and `npm run dev` to play. Use `npm test` for animation and asset checks, and `npm run build` for a production bundle.
