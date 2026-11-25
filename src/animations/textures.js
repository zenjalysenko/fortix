import * as THREE from 'three';

export const surfaceNames = ['ground', 'sand', 'snow', 'wood', 'leaves', 'stone', 'cloth', 'skin', 'leather', 'crystal', 'water', 'flame'];
export const characterSurfaceNames = ['hero-face', 'hero-jacket', 'hero-trousers', 'hero-backpack', 'enemy-mask', 'enemy-robes'];

// The small canvas is a fallback while project-local WebP textures load.
export function createSurfaceTextures() {
  const palette = {
    ground: ['#d6d7be', '#b8be9f'], wood: ['#d8b68e', '#947254'],
    leaves: ['#b0c48f', '#719369'], stone: ['#c0c5bb', '#828e83'],
    cloth: ['#ede0cb', '#bba895'], crystal: ['#dbfff5', '#69cbbb'],
    water: ['#bce6df', '#7db9bf'], flame: ['#fff3a4', '#f69c43'],
    sand: ['#eee1c4', '#d9c9a6'], snow: ['#ffffff', '#e4e9eb'],
    skin: ['#fff4e8', '#eedbc9'], leather: ['#d3c9b9', '#b0a591'],
    'hero-face': ['#e5b68b', '#e5b68b'], 'hero-jacket': ['#d27e57', '#b96945'],
    'hero-trousers': ['#43584d', '#34443c'], 'hero-backpack': ['#74866b', '#53664d'],
    'enemy-mask': ['#384759', '#293747'], 'enemy-robes': ['#566a7f', '#3f5064'],
  };
  const textures = {};
  for (const [name, colors] of Object.entries(palette)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = colors[1];
    for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) {
      const noise = ((x * 17 + y * 31 + x * y * 7) % 97) / 97;
      ctx.globalAlpha = .12 + noise * .3;
      if (name === 'wood') ctx.fillRect(x, y, 1, 4);
      else if (name === 'cloth') { ctx.fillRect(x, y, 4, 1); ctx.fillRect(x, y, 1, 4); }
      else if (name === 'water') ctx.fillRect(x, y, 4, Math.sin(x * .2 + y) > 0 ? 1 : 2);
      else ctx.fillRect(x, y, 2 + noise * 2, 2 + noise * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    const face = name === 'hero-face' || name === 'enemy-mask';
    texture.repeat.setScalar(name === 'water' ? 80 : face ? 1 : 2);
    if (face) texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;
    texture.name = name;
    textures[name] = texture;
    const url = characterSurfaceNames.includes(name)
      ? new URL(`../../assets/textures/runtime/characters/${name}.webp`, import.meta.url).href
      : new URL(`../../assets/textures/runtime/${name}.webp`, import.meta.url).href;
    new THREE.ImageLoader().load(url, image => {
      texture.image = image;
      texture.needsUpdate = true;
    }, undefined, () => console.warn(`Texture ${name}: using procedural fallback`));
  }
  return textures;
}

export function addTerrainLayers(material, textures) {
  // Blend by local height and slope, matching the island's existing biomes.
  material.onBeforeCompile = shader => {
    shader.uniforms.sandMap = { value: textures.sand };
    shader.uniforms.snowMap = { value: textures.snow };
    shader.uniforms.rockMap = { value: textures.stone };
    shader.vertexShader = 'varying vec2 vTerrain;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrain = vec2(position.y, normal.y);');
    shader.fragmentShader = 'varying vec2 vTerrain;\nuniform sampler2D sandMap;\nuniform sampler2D snowMap;\nuniform sampler2D rockMap;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 surfaceColor = texture2D(map, vMapUv);
        surfaceColor = mix(surfaceColor, texture2D(rockMap, vMapUv), 1.0 - smoothstep(0.48, 0.72, vTerrain.y));
        surfaceColor = mix(surfaceColor, texture2D(sandMap, vMapUv), 1.0 - smoothstep(2.1, 3.0, vTerrain.x));
        surfaceColor = mix(surfaceColor, texture2D(snowMap, vMapUv), smoothstep(18.0, 20.0, vTerrain.x));
        diffuseColor *= surfaceColor;
      #endif
    `);
  };
  material.customProgramCacheKey = () => 'fortinex-terrain-layers-v1';
  material.needsUpdate = true;
}

export function textureScene(scene, textures) {
  scene.traverse(object => {
    if (!object.isMesh) return;
    if (!object.geometry.attributes.uv) {
      const positions = object.geometry.attributes.position;
      const uv = new Float32Array(positions.count * 2);
      for (let i = 0; i < positions.count; i++) {
        uv[i * 2] = positions.getX(i) / 8;
        uv[i * 2 + 1] = positions.getZ(i) / 8;
      }
      object.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.map || !material.isMeshStandardMaterial) continue;
      const type = object.geometry.type;
      if (material.emissiveIntensity > 0 && material.emissive?.getHex() !== 0 && !['crystal', 'flame'].includes(material.userData.surface) && type !== 'OctahedronGeometry') continue;
      const surface = material.userData.surface || object.userData.surface || (type === 'PlaneGeometry' ? 'water'
        : type === 'BufferGeometry' ? 'ground'
        : type === 'CylinderGeometry' ? 'wood'
        : type === 'ConeGeometry' ? 'leaves'
        : type === 'CapsuleGeometry' ? 'cloth'
        : type === 'OctahedronGeometry' ? 'crystal'
        : ['DodecahedronGeometry', 'TorusGeometry', 'SphereGeometry'].includes(type) ? 'stone' : 'wood');
      material.map = textures[surface];
      if (surface === 'ground') addTerrainLayers(material, textures);
      material.needsUpdate = true;
    }
  });
}

export function updateTextures(textures, time) {
  textures.water.offset.set((time * .012) % 1, (time * .008) % 1);
  textures.crystal.offset.y = (time * .035) % 1;
  textures.flame.offset.y = (-time * .7) % 1;
}
