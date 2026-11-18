import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { modelCatalog } from '../src/models/catalog.js';
import { characterSurfaceNames } from '../src/animations/textures.js';

// GLTFExporter uses FileReader even when geometry has no browser images.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(result => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const destination = new URL('../assets/models/', import.meta.url);
await mkdir(destination, { recursive: true });
const exporter = new GLTFExporter();
const manifest = { format: 'glTF 2.0 binary', textures: 'External PNGs in ../textures; keep the folders together.', models: [] };

for (const [name, create] of Object.entries(modelCatalog)) {
  const model = create();
  const original = Buffer.from(await exporter.parseAsync(model, { binary: true, animations: model.animations, onlyVisible: true }));
  const jsonSize = original.readUInt32LE(12);
  const document = JSON.parse(original.subarray(20, 20 + jsonSize).toString());
  const textures = new Map();
  document.images = []; document.textures = [];
  document.samplers = [
    { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 },
    { magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 },
  ];
  for (const material of document.materials || []) {
    const surface = material.extras?.surface;
    if (!surface || (material.emissiveFactor?.some(v => v > 0) && !['crystal', 'flame'].includes(surface))) continue;
    const face = surface === 'hero-face' || surface === 'enemy-mask';
    if (!textures.has(surface)) {
      const uri = `../textures/${characterSurfaceNames.includes(surface) ? 'characters/' : ''}${surface}.png`;
      await readFile(new URL(uri, destination));
      const image = document.images.push({ uri, name: surface }) - 1;
      const index = document.textures.push({ source: image, sampler: face ? 1 : 0 }) - 1;
      textures.set(surface, index);
    }
    material.pbrMetallicRoughness.baseColorTexture = {
      index: textures.get(surface),
      // Source PNGs stay unchanged; glTF's image origin is opposite to Three's flipY maps.
      extensions: { KHR_texture_transform: { scale: face ? [1, -1] : surface === 'water' ? [80, -80] : [2, -2], offset: [0, 1] } },
    };
  }
  document.extensionsUsed = [...new Set([...(document.extensionsUsed || []), 'KHR_texture_transform'])];
  const json = Buffer.from(JSON.stringify(document));
  const padding = (4 - json.length % 4) % 4;
  const binaryChunk = original.subarray(20 + jsonSize);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length + padding + binaryChunk.length, 8);
  header.writeUInt32LE(json.length + padding, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, json, Buffer.alloc(padding, 0x20), binaryChunk]);
  await writeFile(new URL(`${name}.glb`, destination), glb);
  const meshes = document.meshes.length;
  const triangles = document.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((count, primitive) => count + document.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3, 0), 0);
  manifest.models.push({ name, file: `${name}.glb`, bytes: glb.length, meshes, triangles, animations: (document.animations || []).map(clip => clip.name), textures: [...textures.keys()] });
  console.log(`${name}.glb: ${Math.round(glb.length / 1024)} KB, ${Math.round(triangles)} triangles`);
}
await writeFile(new URL('manifest.json', destination), JSON.stringify(manifest, null, 2) + '\n');
