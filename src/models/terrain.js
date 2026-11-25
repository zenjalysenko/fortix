import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function terrain(x, z) {
  if (x > -88 && x < -64 && Math.abs(z + 24) < 6) return 8;
  const d = Math.hypot(x, z), edge = clamp(1 - d / 150, 0, 1);
  const hills = Math.sin(x * .035 + 1.2) * Math.cos(z * .031) * 5 + Math.sin(z * .078 + x * .044) * 2;
  return d < 150 ? Math.max(.3, edge * edge * (hills + 20) + 1.8) : -.8;
}

export function createIsland() {
  const n = 155, span = 320, vertices = [], colors = [], uv = [], indices = [];
  const palette = ['#537d4e', '#a18e69', '#75817b', '#e0e1d2'].map(color => new THREE.Color(color));
  for (let iz = 0; iz <= n; iz++) for (let ix = 0; ix <= n; ix++) {
    const x = (ix / n - .5) * span, z = (iz / n - .5) * span, y = terrain(x, z);
    vertices.push(x, y, z); uv.push(x / 8, z / 8);
    const slope = Math.hypot(terrain(x + 1, z) - y, terrain(x, z + 1) - y);
    const color = palette[y < 2.4 ? 1 : y > 19 ? 3 : slope > 1.7 ? 2 : 0].clone();
    color.multiplyScalar(.98 + Math.sin(ix * 17 + iz * 31) * .06); colors.push(color.r, color.g, color.b);
    if (ix < n && iz < n) { const a = iz * (n + 1) + ix, b = a + 1, c = a + n + 1, d = c + 1; indices.push(a, c, b, b, c, d); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93 }); material.userData.surface = 'ground';
  const island = new THREE.Mesh(geometry, material); island.name = 'island'; island.receiveShadow = true;
  return island;
}

export function createOcean() {
  const material = new THREE.MeshPhysicalMaterial({ color: '#6fc3d0', roughness: .22, metalness: .12, transparent: true, opacity: .88, clearcoat: .5 }); material.userData.surface = 'water';
  const waveTime = { value: 0 };
  material.userData.waveTime = waveTime;
  material.onBeforeCompile = shader => {
    shader.uniforms.waveTime = waveTime;
    shader.vertexShader = 'uniform float waveTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.z += sin(position.x * 0.028 + waveTime * 0.7) * 0.16 + cos(position.y * 0.035 + waveTime * 0.55) * 0.13;`);
    // Analytic derivatives replace the per-frame CPU normal and geometry uploads.
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      objectNormal = normalize(vec3(-0.00448 * cos(position.x * 0.028 + waveTime * 0.7), 0.00455 * sin(position.y * 0.035 + waveTime * 0.55), 1.0));`);
  };
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800, 100, 100), material);
  ocean.name = 'ocean'; ocean.rotation.x = -Math.PI / 2; ocean.position.y = .05;
  return ocean;
}
