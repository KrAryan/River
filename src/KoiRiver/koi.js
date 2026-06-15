import * as THREE from 'three';
import { HX, HZ, DEPTH, FLOW } from './constants.js';
import { rand, wrapAngle, approach } from './util.js';
import {
  KOI_SPRITE_VERT, KOI_SPRITE_FRAG, SURFACE_VERT, BLOB_SHADOW_FRAG
} from './shaders/index.js';

/* top-down koi sprites (transparent PNGs, head pointing up) and a swimming
   length in world units — photographic sprites read best from this
   straight-down camera. Files live in <assetsBase>/koi/. */
export const KOI_SPRITES = [
  { file: 'koi-00.png', len: 0.21 },
  { file: 'koi-01.png', len: 0.20 },
  { file: 'koi-02.png', len: 0.205 },
  { file: 'koi-03.png', len: 0.195 },
  { file: 'koi-04.png', len: 0.19 },
  { file: 'koi-05.png', len: 0.23 }   /* butterfly — longer fins */
];

/* how much of the river current carries the fish (they swim through the
   rest) so they track their heading instead of sliding sideways */
const FISH_DRIFT = FLOW * 0.32;

/* a flat ribbon along the body axis (x: +0.5 head .. -0.5 tail), width = the
   sprite's aspect, with an aS attribute (0 head .. 1 tail) for the bend */
function buildSpriteGeometry(aspect, seg = 16) {
  const pos = [], uv = [], aS = [], idx = [];
  const hw = 0.5 * aspect;
  for (let i = 0; i <= seg; i++) {
    const s = i / seg;
    const x = 0.5 - s;
    for (let j = 0; j <= 1; j++) {
      pos.push(x, 0, (j - 0.5) * 2 * hw);
      uv.push(j, 1.0 - s);          /* head -> v=1 (top of the image) */
      aS.push(s);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 2;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setIndex(idx);
  return g;
}

/* spec: { texture, aspect, len }
   ctx:  { scene, uCaustics, uSunDir, queueDrop } */
export class Koi {
  constructor(spec, i, n, ctx) {
    this.ctx = ctx;
    this.len = spec.len;
    this.aspect = spec.aspect;
    this.heading = Math.PI;
    this.face = Math.PI;
    this.baseSpeed = rand(0.055, 0.095);
    this.depthBase = rand(-0.30, -0.14);
    this.phase = rand(0, 100);
    this.swimPhase = rand(0, 10);
    this.y = this.depthBase;
    this.nextRipple = rand(1, 5);

    this.swim = { uSwimPhase: { value: 0 }, uTurn: { value: 0 } };
    this.geo = buildSpriteGeometry(spec.aspect);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.swim,
        uTex: { value: spec.texture },
        uCaustics: ctx.uCaustics,
        uSunDir: ctx.uSunDir
      },
      vertexShader: KOI_SPRITE_VERT,
      fragmentShader: KOI_SPRITE_FRAG,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;

    /* soft blob shadow on the bed, projected along the sun */
    this.discGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
    const shadowMat = new THREE.ShaderMaterial({
      uniforms: { uStrength: { value: 0.3 } },
      vertexShader: SURFACE_VERT,
      fragmentShader: BLOB_SHADOW_FRAG,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,   /* keep floor's depth value intact */
      blendDstAlpha: THREE.OneFactor,
      depthWrite: false
    });
    this.shadow = new THREE.Mesh(this.discGeo, shadowMat);
    this.shadow.renderOrder = 1;
    this.shadow.frustumCulled = false;

    ctx.scene.add(this.mesh, this.shadow);

    if (i < 2) {
      this.beginCrossing(true);
    } else {
      this.resting = true;
      this.restTimer = 3 + i * 4;
      this.x = HX * 3; this.z = 0;
      this.mesh.visible = false;
      this.shadow.visible = false;
    }
  }

  place() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.face;
    this.mesh.scale.setScalar(this.len);
    const sd = this.ctx.uSunDir.value;
    const t = (-DEPTH - this.y) / sd.y;
    this.shadow.position.set(this.x + sd.x * t, -DEPTH + 0.004, this.z + sd.z * t);
    this.shadow.rotation.y = this.face;
    this.shadow.scale.set(this.len * 0.52, 1, this.len * this.aspect * 0.55);
    const fade = THREE.MathUtils.clamp(-this.y / DEPTH, 0, 1);
    this.shadow.material.uniforms.uStrength.value = 0.34 * (1.0 - 0.5 * fade);
  }

  beginCrossing(midRiver = false) {
    this.resting = false;
    /* straight across, left-to-right or right-to-left, gentle vertical drift */
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.z = rand(-HZ * 0.62, HZ * 0.62);
    this.x = -dir * (HX + 0.4);
    this.exit = { x: dir * (HX + 0.45), z: this.z + rand(-0.18, 0.18) };
    if (midRiver) this.x = rand(-HX * 0.6, HX * 0.6);
    this.heading = Math.atan2(-(this.exit.z - this.z), this.exit.x - this.x);
    this.face = this.heading;
    this.place();
    this.mesh.visible = true;
    this.shadow.visible = true;
  }

  update(dt, t, school) {
    if (this.resting) {
      this.restTimer -= dt;
      if (this.restTimer <= 0) this.beginCrossing();
      return;
    }

    const desired = Math.atan2(-(this.exit.z - this.z), this.exit.x - this.x);
    let steer = wrapAngle(desired - this.heading) * 0.8
              + 0.07 * Math.sin(t * 0.22 + this.phase);
    for (const o of school) {
      if (o === this || o.resting) continue;
      const dx = this.x - o.x, dz = this.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.32 && d > 1e-4) {
        const away = Math.atan2(-dz, dx);
        steer += wrapAngle(away - this.heading) * (0.32 - d) * 1.6;
      }
    }
    this.heading += THREE.MathUtils.clamp(steer, -1.0, 1.0) * approach(1.6, dt);

    const sp = this.baseSpeed * (0.94 + 0.06 * Math.sin(t * 0.25 + this.phase * 1.3));
    const vx = Math.cos(this.heading) * sp + FISH_DRIFT;
    const vz = -Math.sin(this.heading) * sp;
    this.x += vx * dt;
    this.z += vz * dt;
    this.y = Math.min(this.depthBase + 0.06 * Math.sin(t * 0.12 + this.phase * 0.9), -0.06);

    const targetFace = Math.atan2(-vz, vx);
    this.face += wrapAngle(targetFace - this.face) * approach(3.0, dt);

    const speed = Math.hypot(vx, vz);
    this.swimPhase += dt * (1.3 + speed * 9.0);

    if (Math.abs(this.x) > HX + 0.45 || Math.abs(this.z) > HZ + 0.45) {
      this.resting = true;
      this.restTimer = rand(6, 16);
      this.mesh.visible = false;
      this.shadow.visible = false;
      return;
    }

    this.place();
    this.swim.uSwimPhase.value = this.swimPhase;
    this.swim.uTurn.value = THREE.MathUtils.clamp(
      wrapAngle(this.heading - this.face) * 1.6, -0.4, 0.4);

    this.nextRipple -= dt;
    if (this.nextRipple <= 0) {
      this.nextRipple = rand(2.5, 7);
      if (this.y > -0.34) {
        const hx = this.x + Math.cos(this.face) * 0.5 * this.len;
        const hz = this.z - Math.sin(this.face) * 0.5 * this.len;
        this.ctx.queueDrop((hx / HX + 1) / 2, (1 - hz / HZ) / 2, 0.045, 0.007);
      }
    }
  }

  dispose() {
    this.ctx.scene.remove(this.mesh, this.shadow);
    this.mesh.material.dispose();
    this.shadow.material.dispose();
    this.geo.dispose();
    this.discGeo.dispose();
  }
}
