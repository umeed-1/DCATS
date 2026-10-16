/**
 * DCATS — SceneManager.js
 * Procedural Three.js scene helpers (no external assets — offline-first):
 * gradient sky dome, stars / moon / sun, mountain horizon, city skyline with
 * lit windows, mottled ground, and per-type threat drone models.
 * Framework-free so it can be reused outside React.
 */
import * as THREE from 'three';

// Per-environment palette and the city/tree layout counts.
export const ENV_STYLE = {
  urban: {
    ground: 0x7d8574, grid: 0x9fb4c2, blocks: 26, towers: 9, trees: 0,
    road: 0x4b5057, lane: 0xf5f7f9,
    facades: [0xc2bcae, 0xa9b0b6, 0x97a2ae, 0xb08a75],
  },
  rural: {
    ground: 0x6f8f4e, grid: 0xa8cf9a, blocks: 7, towers: 1, trees: 16,
    road: 0x8a7350, lane: 0xd9c9a3,
    facades: [0xc2bcae, 0xa9b0b6, 0x97a2ae],
  },
  forest: {
    ground: 0x3f6b3a, grid: 0x9fd48f, blocks: 0, towers: 0, trees: 64,
    road: 0x6f5b3e, lane: 0xcdbd97,
    facades: [0xc2bcae],
  },
  mixed: {
    ground: 0x6c8464, grid: 0x9fc4b4, blocks: 14, towers: 5, trees: 26,
    road: 0x4b5057, lane: 0xf5f7f9,
    facades: [0xc2bcae, 0xa9b0b6, 0x97a2ae, 0xb08a75],
  },
};

// Time grade applied to every environment colour: scalar dimming plus a mix
// toward the time's key light (warm at dusk, cool blue at night). Day is the
// canonical daylight palette these are authored in.
const TIME_GRADE = {
  day: { mul: 1.0, tint: 0xffffff, mix: 0 },
  dusk: { mul: 0.68, tint: 0xff9d6b, mix: 0.22 },
  night: { mul: 0.34, tint: 0x93a9d6, mix: 0.3 },
};

function gradeColor(hex, timeOfDay) {
  const g = TIME_GRADE[timeOfDay] ?? TIME_GRADE.day;
  const c = new THREE.Color(hex);
  c.multiplyScalar(g.mul);
  if (g.mix) c.lerp(new THREE.Color(g.tint), g.mix);
  return c;
}

// Console tints per threat type — bright on the dark console and clearly
// readable in the daylight 3D scene. Shared by the operator UI and the 3D
// drone models so a type looks the same everywhere.
export const TYPE_TINT = {
  scout: '#f0b23e',
  cargo: '#46d99a',
  kamikaze: '#ff5348',
  ewJammer: '#b98cff',
  decoy: '#ff9a4d',
  swarmNode: '#ff6d68',
  unidentified: '#cbd5e1',
};

// Darker equivalents for the light operator panels (track list, operator
// actions, AI advisory). Same identity per type — the bright tints above
// stay reserved for the scopes and the daylight 3D scene.
export const TYPE_TINT_PANEL = {
  scout: '#a16207',
  cargo: '#1e7b4f',
  kamikaze: '#b3261e',
  ewJammer: '#6d28d9',
  decoy: '#c2410c',
  swarmNode: '#be185d',
  unidentified: '#475569',
};

// Time-of-day palette. window = lit-window emissive strength; glow = threat
// marker glow opacity; stars / moon / sun are 0..1 intensity gates.
export const SKY_STYLE = {
  day: {
    zenith: 0x2f6fae, horizon: 0xc9e2f2, fog: 0xa9c2d4, fogNear: 620, fogFar: 2600,
    hemi: 1.05, dir: 2.5, hemiSky: 0xf2f8ff, dirColor: 0xfff2d6, mountains: 0x6f8d9e,
    stars: 0, moon: 0, sun: 0.95, window: 0.06, glow: 0.38,
  },
  dusk: {
    zenith: 0x2a2150, horizon: 0xf08b5d, fog: 0x624b68, fogNear: 340, fogFar: 1550,
    hemi: 0.68, dir: 1.05, hemiSky: 0xd8bfd7, dirColor: 0xffb88d, mountains: 0x46344c,
    stars: 0.5, moon: 0.55, sun: 0.48, window: 0.58, glow: 0.62,
  },
  night: {
    zenith: 0x020817, horizon: 0x123b62, fog: 0x0b2038, fogNear: 300, fogFar: 1450,
    hemi: 0.42, dir: 0.5, hemiSky: 0x9fc9ff, dirColor: 0xdbe9ff, mountains: 0x102b45,
    stars: 1, moon: 1, sun: 0, window: 1.0, glow: 0.92,
  },
};

// ---------------------------------------------------------------- textures

let _glowTex = null;
/** Soft radial glow (white core → transparent). Tinted per use via material color. */
export function makeGlowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

let _groundTex = null;
/** Subtle mottling so the ground is not a flat fill. Multiplied with env color. */
function makeGroundTexture() {
  if (_groundTex) return _groundTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e2e6eb';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 9 + Math.random() * 44;
    const a = 0.03 + Math.random() * 0.05;
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  _groundTex = new THREE.CanvasTexture(c);
  _groundTex.wrapS = _groundTex.wrapT = THREE.RepeatWrapping;
  _groundTex.repeat.set(9, 9);
  _groundTex.colorSpace = THREE.SRGBColorSpace;
  return _groundTex;
}

/** Night-city window grid for the emissiveMap of buildings. */
function makeWindowTexture(variant = 0) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 64, 96);
  const cols = 6;
  const rows = 9;
  const cw = 64 / cols;
  const rh = 96 / rows;
  const palette = ['#cfe6ff', '#ffe3b0', '#9fd4ff', '#ffd9a0', '#bfe3ff'];
  let s = variant * 7919 + 13;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rnd() < 0.38;
      ctx.globalAlpha = lit ? 0.7 + rnd() * 0.3 : 0.03 + rnd() * 0.05;
      ctx.fillStyle = lit ? palette[Math.floor(rnd() * palette.length)] : '#0a1420';
      ctx.fillRect(x * cw + 1.5, y * rh + 1.5, cw - 3, rh - 3);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- sky & horizon

function addSky(scene, sky) {
  // Gradient dome (authored colors, no fog — it IS the backdrop).
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3400, 40, 20),
    new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(sky.zenith) },
        bottomColor: { value: new THREE.Color(sky.horizon) },
        exponent: { value: 1.5 },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float exponent;
        varying vec3 vWorld;
        void main() {
          float h = normalize(vWorld).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  dome.renderOrder = -999;
  scene.add(dome);

  // Stars (night / dusk)
  if (sky.stars > 0) {
    const n = 800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = 200 + Math.random() * 2900;
      const r = Math.sqrt(Math.max(0, 3200 * 3200 - y * y));
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xdce8ff, size: 2, sizeAttenuation: false, transparent: true,
      opacity: sky.stars, depthWrite: false, fog: false,
    }));
    stars.renderOrder = -998;
    scene.add(stars);
  }

  // Moon
  if (sky.moon > 0) {
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(46, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xe6eeff, fog: false }),
    );
    moon.position.set(300, 620, -1500);
    moon.renderOrder = -998;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0xcfe0ff, transparent: true,
      opacity: 0.38 * sky.moon, depthWrite: false, fog: false,
    }));
    halo.position.copy(moon.position);
    halo.scale.setScalar(280);
    halo.renderOrder = -998;
    scene.add(moon, halo);
  }

  // Sun (day / dusk) — glow only, keeps the stylised look
  if (sky.sun > 0) {
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0xffe8b0, transparent: true,
      opacity: 0.85 * sky.sun, depthWrite: false, fog: false,
    }));
    sun.position.set(600, 520, -1400);
    sun.scale.setScalar(560);
    sun.renderOrder = -998;
    scene.add(sun);
  }
}

/** Jagged silhouette ring on the horizon — reads as distant mountains at any time of day. */
function makeMountainRing(colorHex) {
  const segments = 150;
  const R = 1220;
  const hAt = (i) => {
    const a = (i / segments) * Math.PI * 2;
    return Math.max(
      0,
      66 +
        88 * Math.sin(a * 3.1 + 1.7) +
        56 * Math.sin(a * 7.3 + 0.4) +
        34 * Math.sin(a * 13.7 + 2.2) +
        22 * Math.sin(a * 23.1 + 5.1),
    );
  };
  const verts = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const r0 = R + 42 * Math.sin(a0 * 5.7 + 0.9);
    const r1 = R + 42 * Math.sin(a1 * 5.7 + 0.9);
    const x0 = Math.cos(a0) * r0;
    const z0 = Math.sin(a0) * r0;
    const x1 = Math.cos(a1) * r1;
    const z1 = Math.sin(a1) * r1;
    const y0 = hAt(i);
    const y1 = hAt(i + 1);
    verts.push(x0, -4, z0, x1, -4, z1, x1, y1, z1);
    verts.push(x0, -4, z0, x1, y1, z1, x0, y0, z0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: colorHex, side: THREE.DoubleSide, fog: false,
  }));
  mesh.renderOrder = -997;
  return mesh;
}

// ---------------------------------------------------------------- terrain relief
// Open-country environments sit on a low-poly rolling height field instead of
// a flat plane: drones cleared over hills read far more naturally, tree lines
// follow the terrain, and the radar rings drape over slopes like a real PPI
// overlay would. Urban/mixed keep the graded (flat) ground a city grid needs.

const TERRAIN_RELIEF = {
  rural: 1,
  forest: 1.05,
  mixed: 0,
  urban: 0,
};

/** 0→1 ramp used to grade the forward-operating pad flat before hills start. */
function smoothstep(lo, hi, v) {
  const k = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return k * k * (3 - 2 * k);
}

/**
 * Terrain elevation (world units/metres) at world (x, z) for an environment.
 * Deterministic (pure sines, no noise lib — offline-first zero assets) and
 * exported for tests + callers that need to plant objects on the ground.
 *
 * Two design rules:
 *  - The landing-pad zone (r < 90) is graded flat like a constructed FOB and
 *    relief ramps in by r ≈ 200.
 *  - Relief is NOT uniform: a low-frequency hilliness mask (~2-3km patches)
 *    spreads plains, farmland dips and raised ridges across the map. Typical
 *    ground sits near-flat (~5-7m swell) and ~10% of the map is ridge patches
 *    reaching ~35m+, so drone tracks at sim altitude (≥80 world units) still
 *    never clip into a hill (rural ceiling 54m, ×1.05 forest).
 */
export function terrainHeight(x, z, environment = 'rural') {
  const amount = TERRAIN_RELIEF[environment] ?? 0;
  if (!amount) return 0;
  const ramp = smoothstep(90, 200, Math.hypot(x, z));

  // Hilliness patchwork: big-ish basins of plain with scattered ridges and
  // hollows (neither a uniform waffle nor uniform rolling).
  const m1 = Math.sin(x * 0.0031 + 0.8) * Math.cos(z * 0.0027 - 0.6);
  const m2 = Math.sin((x + z) * 0.0021 + 1.9);
  const patch = (m1 + 0.6 * m2 + 1.6) / 3.2;
  const hilliness = 0.25 + 0.75 * Math.pow(Math.min(1, Math.max(0, patch)), 1.45);

  const h =
    11 * Math.sin(x * 0.0042 + 1.3) * Math.cos(z * 0.0039) +
    12 * Math.sin(x * 0.0113 - z * 0.0089 + 4.7) +
    13 * Math.sin(x * 0.0161 + z * 0.0096 + 1.7) +
    11 * Math.sin((x - z) * 0.0131 - 0.5) +
    7 * Math.sin((x + z) * 0.0026 + 2.1);
  return h * amount * ramp * hilliness;
}

// ---------------------------------------------------------------- battlefield

export function createBattlefield({ environment = 'urban', timeOfDay = 'day' } = {}) {
  const env = ENV_STYLE[environment] ?? ENV_STYLE.urban;
  const sky = SKY_STYLE[timeOfDay] ?? SKY_STYLE.day;
  const grade = (hex) => gradeColor(hex, timeOfDay);
  const tickers = [];

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sky.zenith);
  scene.fog = new THREE.Fog(sky.fog, sky.fogNear, sky.fogFar);

  // Opening shot: lower and further back than before so the skyline and the
  // sky actually enter the frame (top of view ≈ level with the horizon).
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 4000);
  camera.position.set(0, 240, 600);
  camera.lookAt(0, 48, 0);

  // Lighting
  scene.add(new THREE.HemisphereLight(sky.hemiSky, 0x0a0f1a, sky.hemi));
  const dir = new THREE.DirectionalLight(sky.dirColor, sky.dir);
  dir.position.set(300, 500, 200);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -700;
  dir.shadow.camera.right = 700;
  dir.shadow.camera.top = 700;
  dir.shadow.camera.bottom = -700;
  scene.add(dir);

  addSky(scene, sky);
  scene.add(makeMountainRing(sky.mountains));

  // Ground. Open country (rural/forest) gets a displaced rolling height
  // field; urban/mixed keep the original graded flat plane. Large enough that
  // the fog hides its edge long before it ends.
  const hilly = Boolean(TERRAIN_RELIEF[environment]);
  let ground;
  if (hilly) {
    // PlaneGeometry lies flat in XY before the rotation above, so height
    // octaves read x/z directly after it. Bound: 11+12+13+11+7 = 54 max,
    // then scaled by the hilliness patchwork (plains stay near-flat).
    const seg = 140;
    const geo = new THREE.PlaneGeometry(3200, 3200, seg, seg);
    geo.rotateX(-Math.PI / 2); // bake to world axes so (x, y, z) reads directly
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(grade(env.ground));
    const crop = new THREE.Color(grade(0xb4d78e));
    const cropAlt = new THREE.Color(grade(0xa7c67f));
    const dirt = new THREE.Color(grade(env.road));
    const tint = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z, environment));

      // Paint the farmland onto the slopes: alternating crop bands every
      // 112m along x (same cadence as the old flat strips) and a dirt track
      // near x=150, z=-180 — now conforming to the terrain, so nothing clips.
      let c = grass;
      if (environment === 'rural') {
        const m = ((x % 112) + 112) % 112;
        const band = Math.floor((x + 56) / 112);
        const inField = (m <= 45 || m >= 67) && band >= -4 && band <= 4;
        if (inField) {
          c = band % 2 === 0 ? crop : cropAlt;
        }
        if (Math.abs(x - 150) < 11 || (Math.abs(z + 180) < 10 && Math.abs(x) < 575)) {
          c = dirt;
        }
      } else {
        // Forest: faint darker pockets in the hollows for scattering variety.
        c = tint.copy(grass).multiplyScalar(0.92 + 0.08 * Math.sin(x * 0.013 + z * 0.017));
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    // Slope shading baked into the vertex colours: crests stay bright, facing
    // slopes and hollows darken — without it the gentle lighting leaves the
    // relief nearly invisible from the console's grazing camera angle.
    const nrm = geo.attributes.normal;
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(nrm, i);
      // Gradient magnitude of the normal (0 on flat ground, ≈0.3 at steep
      // faces): slopes/hollows darken, crests keep full brightness.
      const steep = Math.min(1, Math.sqrt(n.x * n.x + n.z * n.z) * 4);
      const shade = 1 - 0.34 * steep;
      colors[i * 3] *= shade;
      colors[i * 3 + 1] *= shade;
      colors[i * 3 + 2] *= shade;
    }
    ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 1, map: makeGroundTexture(),
    }));
  } else {
    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3200, 3200),
      new THREE.MeshStandardMaterial({
        color: grade(env.ground), roughness: 1, map: makeGroundTexture(),
      }),
    );
    ground.rotation.x = -Math.PI / 2;
  }
  ground.receiveShadow = true;
  scene.add(ground);

  // Readable low-poly landmarks: asphalt roads in urban terrain (and shared
  // grid streets in mixed). Open-country landmarks are painted into the
  // rolling terrain by vertex colour instead of flat overlay strips, which
  // would cut through hills.
  if (environment === 'urban' || environment === 'mixed') {
    const surfaceMat = (color, opacity = 0.28) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
    });
    const roadMat = surfaceMat(grade(env.road), 0.85);
    for (const [x, z, w, d] of [[0, 0, 38, 1200], [0, 0, 1200, 38], [260, -220, 24, 720], [-300, 250, 24, 720]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.8, z);
      scene.add(road);
    }
    const laneMat = surfaceMat(grade(env.lane), 0.72);
    for (const z of [-560, -280, 280, 560]) {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(5, 42), laneMat);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(0, 1, z);
      scene.add(lane);
    }
  }

  // Radar grid + range rings. On hilly terrain the flat overlays would cut
  // through the slopes, so the sweep rings and spokes are draped over the
  // terrain instead — reading like sensor plots projected onto the ground.
  const gridColor = grade(env.grid);
  if (hilly) {
    const drapeRing = (r, opacity) => {
      const pts = [];
      const res = 120;
      for (let i = 0; i <= res; i++) {
        const a = (i / res) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        pts.push(new THREE.Vector3(x, terrainHeight(x, z, environment) + 2.4, z));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity }),
      );
      scene.add(line);
    };
    drapeRing(150, 0.42);
    drapeRing(300, 0.38);
    drapeRing(450, 0.32);
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      const pts = [];
      for (let r = 0; r <= 500; r += 25) {
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        pts.push(new THREE.Vector3(x, terrainHeight(x, z, environment) + 1.6, z));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.16 }),
      );
      scene.add(line);
    }
  } else {
    const grid = new THREE.GridHelper(1200, 24, gridColor, gridColor);
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    grid.position.y = 0.5;
    scene.add(grid);
    for (const r of [150, 300, 450]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 1.5, r + 1.5, 96),
        new THREE.MeshBasicMaterial({ color: gridColor, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.6;
      scene.add(ring);
    }
  }

  // City — downtown towers inside, low-rise ring outside. Shared materials.
  const beacons = [];
  if (env.blocks > 0) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mats = env.facades.map((hex, v) => new THREE.MeshStandardMaterial({
      color: grade(hex), roughness: 0.82, metalness: 0.12,
      emissive: 0xffffff, emissiveMap: makeWindowTexture(v % 3),
      emissiveIntensity: sky.window,
    }));
    const mastGeo = new THREE.CylinderGeometry(0.6, 0.9, 16, 6);
    const beaconGeo = new THREE.SphereGeometry(1.4, 8, 6);
    const place = (minR, maxR, minH, maxH, minS, maxS) => {
      const a = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const w = minS + Math.random() * (maxS - minS);
      const d = minS + Math.random() * (maxS - minS);
      const h = minH + Math.random() * (maxH - minH);
      const gx = Math.cos(a) * r;
      const gz = Math.sin(a) * r;
      // Seat on the rolling surface (graded flat pad in urban-like terrain),
      // sunk ~1m so the downslope base edge doesn't float on gentle grades.
      const gy = terrainHeight(gx, gz, environment) - 1.2;
       const m = new THREE.Mesh(geo, mats[Math.floor(Math.random() * mats.length)]);
       m.castShadow = true;
       m.receiveShadow = true;
      m.position.set(gx, gy + h / 2, gz);
      m.scale.set(w, h, d);
      m.rotation.y = Math.random() * Math.PI * 0.5;
      scene.add(m);
      if (h > 95) {
        const mast = new THREE.Mesh(mastGeo, mats[0]);
        mast.position.set(gx, gy + h + 8, gz);
        const beacon = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({
          color: 0xff5040, transparent: true, opacity: 0.8, fog: false,
        }));
        beacon.position.set(gx, gy + h + 17, gz);
        scene.add(mast, beacon);
        beacons.push({ mesh: beacon, phase: Math.random() * Math.PI * 2 });
      }
    };
    const towers = Math.min(env.towers, env.blocks);
    for (let i = 0; i < towers; i++) place(170, 330, 68, 150, 22, 40);
    for (let i = 0; i < env.blocks - towers; i++) place(340, 580, 18, 52, 26, 52);
  }
  if (beacons.length) {
    tickers.push((t) => {
      for (const b of beacons) {
        b.mesh.material.opacity = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 2.4 + b.phase));
      }
    });
  }

  // Trees (rural / forest / mixed)
  if (env.trees) {
    const trunkGeo = new THREE.CylinderGeometry(1.4, 2, 10, 6);
    const topGeo = new THREE.ConeGeometry(8.5, 22, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: grade(0x5c4630) });
    const topMat = new THREE.MeshStandardMaterial({ color: grade(0x3f7a34), roughness: 1 });
    for (let i = 0; i < env.trees; i++) {
      const g = new THREE.Group();
       const trunk = new THREE.Mesh(trunkGeo, trunkMat);
       trunk.castShadow = true;
      trunk.position.y = 5;
       const top = new THREE.Mesh(topGeo, topMat);
       top.castShadow = true;
      top.position.y = 20;
      g.add(trunk, top);
      const a = Math.random() * Math.PI * 2;
      const dist = 160 + Math.random() * 430;
      const gx = Math.cos(a) * dist;
      const gz = Math.sin(a) * dist;
      // Plant on the rolling surface, sunk slightly so the trunk base never
      // floats off a slope (relief is 0 in flat terrain — unchanged there).
      g.position.set(gx, terrainHeight(gx, gz, environment) - 0.4, gz);
      g.scale.setScalar(0.75 + Math.random() * 0.7);
      scene.add(g);
    }
  }

  // Friendly base marker: landing pad + pulsing beacon column
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 17, 6, 24),
    new THREE.MeshStandardMaterial({ color: 0x0f3a2a, emissive: 0x00ff88, emissiveIntensity: 0.35 }),
  );
  base.position.y = 3;
  scene.add(base);
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0x35ff9a, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  beam.position.set(0, 90, 0);
  beam.scale.set(26, 150, 1);
  scene.add(beam);
  tickers.push((t) => { beam.material.opacity = 0.13 + 0.09 * (0.5 + 0.5 * Math.sin(t * 1.6)); });

  // Sensor mast — the console's own radar. The dish rotates at the same rate
  // as the PPI sweep (1.2 rad/s) so the feed and the plot read as one system.
  const steelMat = new THREE.MeshStandardMaterial({ color: grade(0x8b98a5), roughness: 0.62, metalness: 0.55 });
  const mast = new THREE.Group();
  for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 19, 6), steelMat);
    leg.position.set(lx, 9.5, lz);
    leg.castShadow = true;
    mast.add(leg);
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 10), steelMat);
  platform.position.y = 19.5;
  mast.add(platform);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 3.4, 10), steelMat);
  pedestal.position.y = 21.8;
  mast.add(pedestal);
  const dishPivot = new THREE.Group();
  dishPivot.position.y = 24.2;
  const dishTilt = new THREE.Group();
  dishTilt.rotation.z = -0.28;
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 0.7, 2.0, 18),
    new THREE.MeshStandardMaterial({ color: grade(0xd5dade), roughness: 0.35, metalness: 0.7 }),
  );
  dish.rotation.z = Math.PI / 2;
  dish.position.x = 1.0;
  const feedArm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 5.6, 6), steelMat);
  feedArm.rotation.z = Math.PI / 2;
  feedArm.position.x = 3.4;
  const feedTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd8a0 }),
  );
  feedTip.position.x = 6.1;
  dishTilt.add(dish, feedArm, feedTip);
  dishPivot.add(dishTilt);
  mast.add(dishPivot);
  mast.position.set(30, 0, 22);
  scene.add(mast);
  tickers.push((t) => { dishPivot.rotation.y = t * 1.2; });

  // Forward operating compound — low wall with gate gaps where the roads pass.
  const wallMat = new THREE.MeshStandardMaterial({ color: grade(0xa89c86), roughness: 0.95 });
  const wallH = 3.2;
  const gate = 42;
  const half = (116 - gate) / 2;
  const wallGeoX = new THREE.BoxGeometry(half, wallH, 1.1);
  const wallGeoZ = new THREE.BoxGeometry(1.1, wallH, half);
  for (const z of [-58, 58]) {
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wallGeoX, wallMat);
      w.position.set(s * (gate / 2 + half / 2), wallH / 2, z);
      w.castShadow = true;
      scene.add(w);
    }
  }
  for (const x of [-58, 58]) {
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wallGeoZ, wallMat);
      w.position.set(x, wallH / 2, s * (gate / 2 + half / 2));
      w.castShadow = true;
      scene.add(w);
    }
  }

  // Concrete barriers near the pad edge.
  const barrierGeo = new THREE.BoxGeometry(7, 2.4, 1.6);
  const barrierMat = new THREE.MeshStandardMaterial({ color: grade(0xc2c7cc), roughness: 0.9 });
  for (const [bx, bz, ry] of [[-12, 26, 0], [12, 26, 0], [26, -14, Math.PI / 2], [26, 14, Math.PI / 2]]) {
    const b = new THREE.Mesh(barrierGeo, barrierMat);
    b.position.set(bx, 1.2, bz);
    b.rotation.y = ry;
    b.castShadow = true;
    scene.add(b);
  }

  // Parked logistics trucks along the compound road (urban / mixed only).
  if (env.blocks > 0) {
    const bodyGeo = new THREE.BoxGeometry(9, 7, 20);
    const cabGeo = new THREE.BoxGeometry(9, 6, 7);
    const truckMats = [
      new THREE.MeshStandardMaterial({ color: grade(0x5f6f4a), roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: grade(0x55616e), roughness: 0.85 }),
    ];
    for (let i = 0; i < 4; i++) {
      const mat = truckMats[i % 2];
      const truck = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, mat);
      body.position.y = 5.6;
      body.castShadow = true;
      const cab = new THREE.Mesh(cabGeo, mat);
      cab.position.set(0, 4.6, 12.4);
      cab.castShadow = true;
      truck.add(body, cab);
      truck.position.set(-32, 0, -46 + i * 31);
      scene.add(truck);
    }
  }

  return { scene, camera, tickers, glow: sky.glow };
}

// ---------------------------------------------------------------- threat models

const MODEL_META = {
  scout:     { kind: 'quad',    scale: 2.4,  ring: 22, glow: 48 },
  swarmNode: { kind: 'quad',    scale: 2.2,  ring: 20, glow: 48 },
  decoy:     { kind: 'quad',    scale: 2.35, ring: 22, glow: 46 },
  ewJammer:  { kind: 'jammer',  scale: 2.4,  ring: 24, glow: 50 },
  cargo:     { kind: 'cargo',   scale: 2.6,  ring: 28, glow: 64 },
  kamikaze:  { kind: 'missile', scale: 2.35, ring: 22, glow: 42 },
  unidentified: { kind: 'quad', scale: 2.5,  ring: 24, glow: 56 },
};

/**
 * Build a small procedural drone model per threat type.
 * All models face +Z (heading handled by the caller).
 * Returns { group, core, rotors, lamps, glow, meta }.
 */
export function createThreatModel(type = 'scout', colorHex = '#FF3B3B', { glow = 0.6 } = {}) {
  const meta = MODEL_META[type] ?? MODEL_META.scout;
  const color = new THREE.Color(colorHex);
  const group = new THREE.Group();
  const rotors = [];
  const lamps = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x707b88, roughness: 0.5, metalness: 0.5,
    emissive: color, emissiveIntensity: 0.16,
  });
  const armMat = new THREE.MeshStandardMaterial({ color: 0x4c5560, roughness: 0.65, metalness: 0.45 });
  const accentDim = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.55, roughness: 0.45,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.6, metalness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 1.15, roughness: 0.5,
  });
  const blurMat = new THREE.MeshBasicMaterial({
    color: 0x1a222c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  });
  const bladeGeo = new THREE.BoxGeometry(5.6, 0.12, 0.65);
  const discGeo = new THREE.CylinderGeometry(3.1, 3.1, 0.1, 20);

  const addRotor = (x, z) => {
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 1.7, 8), darkMat);
    mount.position.set(x, 0.75, z);
    const rotor = new THREE.Group();
    const disc = new THREE.Mesh(discGeo, blurMat);
    const b1 = new THREE.Mesh(bladeGeo, darkMat);
    const b2 = new THREE.Mesh(bladeGeo, darkMat);
    b2.rotation.y = Math.PI / 2;
    rotor.add(disc, b1, b2);
    rotor.position.set(x, 1.7, z);
    group.add(mount, rotor);
    rotors.push(rotor);
  };

  const addLamp = (mesh, rate, phase = 0) => { lamps.push({ mesh, rate, phase }); };

  let core;
  if (meta.kind === 'missile') {
    // Kamikaze: missile airframe — nose cone, body, 4 tail fins, exhaust glow.
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 12, 14), darkMat);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.9, 5.4, 14), accentMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 8.7;
    group.add(body, nose);
    core = body;
    for (let i = 0; i < 4; i++) {
      const holder = new THREE.Group();
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.4, 6.4), darkMat);
      fin.position.set(0, 2.4, -4.2);
      holder.add(fin);
      holder.rotation.z = (i * Math.PI) / 2;
      group.add(holder);
    }
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.5, 1.4, 10), accentMat.clone());
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.z = -6.4;
    group.add(exhaust);
    addLamp(exhaust, 0);
  } else {
    // Quad family (scout / swarm / decoy / jammer) and the cargo hexa.
    const isCargo = meta.kind === 'cargo';
    const isJammer = meta.kind === 'jammer';
    const bodyW = isCargo ? 6.4 : 4.4;
    const bodyH = isCargo ? 3.0 : 2.1;
    const bodyD = isCargo ? 8.4 : 5.6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), bodyMat);
    body.position.y = 0.5;
    group.add(body);
    core = body;

    const offsets = isCargo
      ? [[1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]]
      : [[0.68, 0.68], [0.68, -0.68], [-0.68, 0.68], [-0.68, -0.68]];
    const armLen = isCargo ? 8.2 : 6.4;
    for (const [sx, sz] of offsets) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(armLen, 0.6, 1.0),
        accentDim,
      );
      arm.position.set(sx * armLen * 0.62, 0.6, sz * armLen * 0.62);
      arm.rotation.y = -Math.atan2(sz, sx);
      group.add(arm);
      addRotor(sx * armLen, sz * armLen);
    }
    if (isCargo) {
      const container = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.4, 4.6), armMat);
      container.position.y = -2.1;
      group.add(container);
    }
    if (isJammer) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.4, 8), darkMat);
      mast.position.y = 3.1;
      const dish = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.6, 14), darkMat);
      dish.rotation.x = Math.PI / 2;
      dish.position.set(0, 4.6, 0.6);
      group.add(mast, dish);
    }
    const noseLamp = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), accentMat.clone());
    noseLamp.position.set(0, 0.5, bodyD / 2 + 0.5);
    group.add(noseLamp);
    addLamp(noseLamp, isJammer ? 3.2 : 5, 0);
    if (type === 'decoy') {
      const strobe = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8), accentMat.clone());
      strobe.position.set(0, bodyH / 2 + 1.6, 0);
      group.add(strobe);
      addLamp(strobe, 9, 1.3);
    }
    if (type === 'unidentified') {
      // Slow white strobe marks the return as unconfirmed rather than a
      // known platform.
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), accentMat.clone());
      beacon.position.set(0, bodyH / 2 + 1.7, 0);
      group.add(beacon);
      addLamp(beacon, 4.5, 0.7);
    }
  }

  // Soft engine glow that shows position at night.
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color, transparent: true, opacity: glow,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glowSprite.scale.setScalar(meta.glow);
  group.add(glowSprite);

  group.scale.setScalar(meta.scale);
  return { group, core, rotors, lamps, glow: glowSprite, meta };
}

/** Map sim coords (x: -500..500) to world coords 1:1 on XZ plane.
 * The +50 lift keeps air tracks clear of the rolling relief (max ±~59 in
 * forest) while matching the PPI's altitude read at the console distance. */
export function simToWorld(t) {
  return { x: t.x, z: t.y, y: (t.z ?? 100) * 0.6 + 50 };
}

export default { createBattlefield, createThreatModel, makeGlowTexture, simToWorld, terrainHeight, ENV_STYLE, SKY_STYLE, TYPE_TINT, TYPE_TINT_PANEL };
