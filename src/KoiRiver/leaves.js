import * as THREE from 'three';
import { HX, HZ, DEPTH, FLOW } from './constants.js';
import { rand } from './util.js';
import { SURFACE_VERT, LEAF_FRAG, BLOB_SHADOW_FRAG } from './shaders/index.js';

/* Autumn leaves: spawn at random above the river, flutter down
   (the perspective camera makes height read naturally), kiss the
   surface with a small ripple, then drift downstream and recycle.
   Each leaf casts a soft blob shadow on the riverbed that slides
   into place as it falls. */

const LEAF_COLORS = [
  [0.52, 0.64, 0.38],  /* sage green */
  [0.60, 0.70, 0.44],  /* light olive */
  [0.45, 0.58, 0.34],  /* leaf green */
  [0.68, 0.74, 0.50],  /* pale yellow-green */
  [0.40, 0.54, 0.36]   /* deeper green */
];

const MAX_LEAVES = 9;

function buildLeafGeometry() {
  const pos = [], uvA = [], idx = [];
  const U = 10, V = 6;
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const w = 0.46 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.9);
    for (let j = 0; j <= V; j++) {
      const v = (j / V) * 2 - 1;
      const x = u - 0.45;
      const z = v * w;
      const y = 0.05 * v * v * Math.sin(Math.PI * u) + 0.04 * Math.pow(u, 3);
      pos.push(x, y, z);
      uvA.push(u, j / V);
    }
  }
  for (let i = 0; i < U; i++)
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j, b = a + V + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ctx: { surfaceScene, underScene, uSunDir, uTime, queueDrop } */
export class LeafSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.leafGeo = buildLeafGeometry();
    this.discGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
    this.leaves = [];
    this.spawnTimer = 1.5;

    for (let i = 0; i < MAX_LEAVES; i++) this.leaves.push(this.makeLeaf());
    /* a few already drifting when the scene opens */
    for (let i = 0; i < 3; i++) {
      this.activate(this.leaves[i], true);
    }
  }

  makeLeaf() {
    const col = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCol: { value: new THREE.Vector3(...col) },
        uSeed: { value: rand(0, 10) },
        uTime: this.ctx.uTime
      },
      vertexShader: SURFACE_VERT,
      fragmentShader: LEAF_FRAG,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(this.leafGeo, mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    this.ctx.surfaceScene.add(mesh);

    const shadowMat = new THREE.ShaderMaterial({
      uniforms: { uStrength: { value: 0 } },
      vertexShader: SURFACE_VERT,
      fragmentShader: BLOB_SHADOW_FRAG,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      depthWrite: false
    });
    const shadow = new THREE.Mesh(this.discGeo, shadowMat);
    shadow.visible = false;
    shadow.renderOrder = 1;
    shadow.frustumCulled = false;
    this.ctx.underScene.add(shadow);

    return {
      active: false, mesh, shadow, mat, shadowMat,
      x: 0, z: 0, h: 0, size: 0.07, seed: rand(0, 100),
      rot: 0, rotVel: 0, state: 'fall'
    };
  }

  activate(leaf, preFloating) {
    leaf.active = true;
    leaf.size = rand(0.050, 0.090);
    leaf.seed = rand(0, 100);
    leaf.rot = rand(0, Math.PI * 2);
    leaf.rotVel = rand(-0.3, 0.3);
    /* kept within the crisp central band; the leaf shader still fades
       any that drift toward the feathered edges */
    leaf.z = rand(-HZ * 0.6, HZ * 0.6);
    if (preFloating) {
      leaf.state = 'float';
      leaf.h = 0;
      leaf.x = rand(-HX * 0.7, HX * 0.55);
    } else {
      leaf.state = 'fall';
      leaf.h = rand(0.45, 0.70);
      leaf.x = rand(-HX * 0.8, HX * 0.35);
    }
    leaf.mesh.visible = true;
    leaf.shadow.visible = true;
  }

  update(dt, t) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = rand(4.0, 10.0);
      const free = this.leaves.find(l => !l.active);
      if (free) this.activate(free, false);
    }

    const sd = this.ctx.uSunDir.value;
    for (const leaf of this.leaves) {
      if (!leaf.active) continue;

      if (leaf.state === 'fall') {
        leaf.h -= dt * (0.20 + 0.07 * Math.sin(t * 4.0 + leaf.seed));
        /* flutter sideways while falling */
        leaf.x += dt * (0.05 + 0.10 * Math.sin(t * 2.1 + leaf.seed * 3.0));
        leaf.z += dt * 0.08 * Math.sin(t * 1.7 + leaf.seed * 7.0);
        leaf.rot += dt * leaf.rotVel * 4.0;
        if (leaf.h <= 0) {
          leaf.h = 0;
          leaf.state = 'float';
          this.ctx.queueDrop((leaf.x / HX + 1) / 2, (1 - leaf.z / HZ) / 2,
                             0.04, 0.006);
        }
      } else {
        /* drift downstream with the current */
        leaf.x += dt * FLOW * (0.95 + 0.1 * Math.sin(leaf.seed));
        leaf.z += dt * 0.012 * Math.sin(t * 0.35 + leaf.seed * 5.0);
        leaf.rot += dt * leaf.rotVel * 0.35;
        if (leaf.x > HX + 0.25) {
          leaf.active = false;
          leaf.mesh.visible = false;
          leaf.shadow.visible = false;
          continue;
        }
      }

      const falling = leaf.state === 'fall';
      /* wobble eases out as the leaf nears the surface, so there is
         no snap when it transitions from falling to floating */
      const bob = falling ? 0.05 + 0.32 * Math.min(leaf.h / 0.6, 1.0) : 0.05;
      leaf.mesh.position.set(leaf.x, leaf.h + 0.012, leaf.z);
      leaf.mesh.scale.setScalar(leaf.size);
      leaf.mesh.rotation.set(
        Math.sin(t * 1.3 + leaf.seed) * bob,
        leaf.rot,
        Math.cos(t * 1.1 + leaf.seed * 2.0) * bob
      );

      /* shadow projected along the sun direction onto the bed */
      const st = (DEPTH + leaf.h) / -sd.y;
      leaf.shadow.position.set(leaf.x + sd.x * st, -DEPTH + 0.004, leaf.z + sd.z * st);
      leaf.shadow.scale.setScalar(leaf.size * 1.05);
      leaf.shadowMat.uniforms.uStrength.value =
        falling ? 0.30 * (1 - leaf.h / 0.7) : 0.30;
    }
  }

  dispose() {
    for (const leaf of this.leaves) {
      this.ctx.surfaceScene.remove(leaf.mesh);
      this.ctx.underScene.remove(leaf.shadow);
      leaf.mat.dispose();
      leaf.shadowMat.dispose();
    }
    this.leafGeo.dispose();
    this.discGeo.dispose();
  }
}
