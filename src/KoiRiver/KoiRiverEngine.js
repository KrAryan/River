import * as THREE from 'three';
import {
  HX, HZ, DEPTH, CAMH, FLOORM, SIM_W, SIM_H,
  CAUST_W, CAUST_H, CAUST_GRID_W, CAUST_GRID_H
} from './constants.js';
import {
  QUAD_VERT, SIM_FRAG, CAUSTICS_VERT, CAUSTICS_FRAG,
  FLOOR_VERT, FLOOR_FRAG, COMPOSITE_FRAG
} from './shaders/index.js';
import { Koi, KOI_SPRITES } from './koi.js';
import { LeafSystem } from './leaves.js';

/* Render pipeline, per frame:
   1. wave sim (ping-pong heightfield, 2 steps)
   2. caustics map (refracted surface mesh -> floor plane)
   3. underwater scene (pebble floor, koi, projected shadows)
   4. composite to screen (refraction, absorption, sun shafts, glints)
   5. surface overlay (floating leaves) */
export class KoiRiverEngine {
  /* options.assetsBase: where the koi/ and floor/ asset folders are served
     from (default "/assets"). */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.assetsBase = (options.assetsBase || '/assets').replace(/\/+$/, '');
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance'
    });

    const simOpts = {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false
    };
    this.simA = new THREE.WebGLRenderTarget(SIM_W, SIM_H, simOpts);
    this.simB = new THREE.WebGLRenderTarget(SIM_W, SIM_H, simOpts);

    this.causticsRT = new THREE.WebGLRenderTarget(CAUST_W, CAUST_H, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
      generateMipmaps: true, depthBuffer: false, stencilBuffer: false
    });

    this.underRT = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: true, stencilBuffer: false, samples: 2
    });

    /* shared uniform objects (same reference handed to several materials) */
    this.uTime = { value: 0 };
    this.uWaterTex = { value: this.simA.texture };
    this.uSimTexel = { value: new THREE.Vector2(1 / SIM_W, 1 / SIM_H) };
    this.uWorldTexel = { value: new THREE.Vector2(2 * HX / SIM_W, 2 * HZ / SIM_H) };
    this.uSunDir = { value: new THREE.Vector3(0.42, -1.0, 0.38).normalize() };
    this.uCaustTex = { value: this.causticsRT.texture };

    this.dummyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadGeo = new THREE.PlaneGeometry(2, 2);

    this.buildSim();
    this.buildCaustics();
    this.buildUnderwater();
    this.buildSurface();
    this.buildComposite();

    /* interaction. Discrete impulses (clicks, fish, leaves) go in the
       queue; pointer hover is coalesced into a single slot that is
       always stamped at the *current* cursor each frame, so the ripple
       tracks the mouse instead of lagging behind a backed-up queue. */
    this.drops = [];
    this.hoverDrop = null;
    this.lastPtr = null;
    this.onPointerMove = e => {
      const [u, v] = this.ptrUV(e);
      if (this.lastPtr) {
        const d = Math.hypot(u - this.lastPtr[0], v - this.lastPtr[1]);
        if (d > 0.004) {
          const s = Math.min(d * 0.05, 0.004);
          if (this.hoverDrop) {
            this.hoverDrop.u = u;
            this.hoverDrop.v = v;
            this.hoverDrop.strength = Math.min(this.hoverDrop.strength + s, 0.0075);
          } else {
            this.hoverDrop = { u, v, radius: 0.062, strength: s };
          }
          this.lastPtr = [u, v];
        }
      } else this.lastPtr = [u, v];
    };
    this.onPointerLeave = () => { this.lastPtr = null; };
    this.onPointerDown = e => {
      const [u, v] = this.ptrUV(e);
      this.queueDrop(u, v, 0.09, 0.014);
    };
    this.onResize = () => this.resize();
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('resize', this.onResize);

    this.resize();

    /* clear sim targets to calm water */
    for (const rt of [this.simA, this.simB]) {
      this.renderer.setRenderTarget(rt);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
    }

    const params = new URLSearchParams(location.search);
    this.clock = new THREE.Clock();
    /* ?t0=8 pre-warms the scene clock (skips the reveal fade) —
       used for deterministic screenshots/tests */
    this.t = parseFloat(params.get('t0') || '0') || 0;
    /* ?probe=u,v injects a steady ripple at a fixed UV each frame so a
       screenshot shows exactly where ripples land (pointer-map check) */
    const probe = params.get('probe');
    this.probe = probe ? probe.split(',').map(Number) : null;
    /* ?fps shows a live frame-rate readout (dev only) */
    if (params.has('fps')) this.initFpsMeter();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  initFpsMeter() {
    this.fpsEl = document.createElement('div');
    this.fpsEl.style.cssText =
      'position:fixed;top:8px;left:8px;z-index:10;padding:3px 7px;border-radius:4px;' +
      'font:12px ui-monospace,monospace;color:#234;background:rgba(255,255,255,.72)';
    this.fpsEl.textContent = '… fps';
    document.body.appendChild(this.fpsEl);
    this.fpsFrames = 0;
    this.fpsLast = performance.now();
  }

  buildSim() {
    this.simMat = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: null },
        uTexel: this.uSimTexel,
        uDropPos: { value: new THREE.Vector2(-10, -10) },
        uDropRadius: { value: 0.05 },
        uDropStrength: { value: 0 }
      },
      vertexShader: QUAD_VERT,
      fragmentShader: SIM_FRAG,
      depthTest: false, depthWrite: false
    });
    this.simScene = new THREE.Scene();
    const quad = new THREE.Mesh(this.quadGeo, this.simMat);
    quad.frustumCulled = false;
    this.simScene.add(quad);
  }

  buildCaustics() {
    this.causticsMat = new THREE.ShaderMaterial({
      uniforms: {
        uWater: this.uWaterTex, uSimTexel: this.uSimTexel,
        uWorldTexel: this.uWorldTexel, uTime: this.uTime,
        uSunDir: this.uSunDir
      },
      vertexShader: CAUSTICS_VERT,
      fragmentShader: CAUSTICS_FRAG,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false, depthWrite: false,
      side: THREE.DoubleSide
    });
    this.causticsScene = new THREE.Scene();
    this.causticsGridGeo = new THREE.PlaneGeometry(2, 2, CAUST_GRID_W, CAUST_GRID_H);
    const grid = new THREE.Mesh(this.causticsGridGeo, this.causticsMat);
    grid.frustumCulled = false;
    this.causticsScene.add(grid);
  }

  buildUnderwater() {
    this.underScene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(
      THREE.MathUtils.radToDeg(2 * Math.atan(HZ / CAMH)), HX / HZ, 0.5, 10
    );
    this.cam.position.set(0, CAMH, 0);
    this.cam.up.set(0, 0, -1);
    this.cam.lookAt(0, 0, 0);

    this.floorMat = new THREE.ShaderMaterial({
      uniforms: {
        uCaustics: this.uCaustTex,
        uSunDir: this.uSunDir,
        uTime: this.uTime,
        uFloorTex: { value: null },
        uFloorNor: { value: null },
        uHasTex: { value: 0 }
      },
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG
    });
    /* photographic riverbed (CC0, Polyhaven "Ganges River Pebbles") */
    const loader = new THREE.TextureLoader();
    let texsReady = 0;
    const onTex = () => {
      texsReady += 1;
      if (texsReady === 2) this.floorMat.uniforms.uHasTex.value = 1;
    };
    loader.load(`${this.assetsBase}/floor/pebbles_diff.jpg`, tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.floorMat.uniforms.uFloorTex.value = tex;
      onTex();
    });
    loader.load(`${this.assetsBase}/floor/pebbles_nor.jpg`, tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      this.floorMat.uniforms.uFloorNor.value = tex;
      onTex();
    });
    this.floorGeo = new THREE.PlaneGeometry(2 * HX * FLOORM, 2 * HZ * FLOORM)
      .rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(this.floorGeo, this.floorMat);
    floor.position.y = -DEPTH;
    floor.renderOrder = 0;
    this.underScene.add(floor);

    /* fish are photographic top-down sprites; each is created once its
       texture (and thus aspect) is known */
    const koiCtx = {
      scene: this.underScene,
      uCaustics: this.uCaustTex,
      uSunDir: this.uSunDir,
      queueDrop: (u, v, r, s) => this.queueDrop(u, v, r, s)
    };
    this.school = [];
    const n = KOI_SPRITES.length;
    for (const spec of KOI_SPRITES) {
      loader.load(`${this.assetsBase}/koi/${spec.file}`, tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        const aspect = tex.image.width / tex.image.height;
        const i = this.school.length;
        this.school.push(new Koi({ texture: tex, aspect, len: spec.len }, i, n, koiCtx));
      });
    }
  }

  buildSurface() {
    /* falling/drifting leaves float above the water; rendered as an
       overlay after the composite pass with the same camera */
    this.surfaceScene = new THREE.Scene();
    this.leaves = new LeafSystem({
      surfaceScene: this.surfaceScene,
      underScene: this.underScene,
      uSunDir: this.uSunDir,
      uTime: this.uTime,
      queueDrop: (u, v, r, s) => this.queueDrop(u, v, r, s)
    });
  }

  buildComposite() {
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        uWater: this.uWaterTex, uSimTexel: this.uSimTexel,
        uWorldTexel: this.uWorldTexel, uTime: this.uTime,
        uUnder: { value: this.underRT.texture },
        uCaustics: this.uCaustTex,
        uSunDir: this.uSunDir,
        uRefr: { value: 0.026 },
        uAbsorb: { value: new THREE.Vector3(0.42, 0.22, 0.14) },
        uScatter: { value: new THREE.Vector3(0.018, 0.044, 0.075) },
        uProbe: { value: new THREE.Vector3(-1, -1, 0) }  /* x,y=uv z=on (debug) */
      },
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false, depthWrite: false
    });
    this.compScene = new THREE.Scene();
    const quad = new THREE.Mesh(this.quadGeo, this.compMat);
    quad.frustumCulled = false;
    this.compScene.add(quad);
  }

  queueDrop(u, v, radius, strength) {
    if (this.drops.length > 8) this.drops.shift();
    this.drops.push({ u, v, radius, strength });
  }

  ptrUV(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    /* render at the display's native pixel density (capped at 2) so the
       water is crisp on Retina — anything below native gets browser-
       upscaled, which reads as a soft/blocky surface. Drop the cap to
       1.5 if frame rate suffers (check ?fps=1). */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.underRT.setSize(Math.round(w * dpr), Math.round(h * dpr));
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.t += dt;
    this.uTime.value = this.t;

    if (this.fpsEl) {
      this.fpsFrames++;
      const now = performance.now();
      if (now - this.fpsLast >= 500) {
        this.fpsEl.textContent =
          Math.round((this.fpsFrames * 1000) / (now - this.fpsLast)) + ' fps';
        this.fpsFrames = 0;
        this.fpsLast = now;
      }
    }

    /* the river surface is disturbed only by the fish below, the
       falling leaves, and the visitor's pointer */
    for (const k of this.school) k.update(dt, this.t, this.school);
    this.leaves.update(dt, this.t);

    /* wave simulation, two steps per frame; ripples advect with
       the river current. The current hover ripple takes the first
       slot, discrete impulses fill the rest. */
    if (this.probe) {
      this.hoverDrop = { u: this.probe[0], v: this.probe[1], radius: 0.062, strength: 0.0075 };
      this.compMat.uniforms.uProbe.value.set(this.probe[0], this.probe[1], 1);
    }
    const frameDrops = [];
    if (this.hoverDrop) {
      frameDrops.push(this.hoverDrop);
      this.hoverDrop = null;
    }
    while (frameDrops.length < 2 && this.drops.length) {
      frameDrops.push(this.drops.shift());
    }
    for (let step = 0; step < 2; step++) {
      const drop = frameDrops[step];
      if (drop) {
        this.simMat.uniforms.uDropPos.value.set(drop.u, drop.v);
        this.simMat.uniforms.uDropRadius.value = drop.radius;
        this.simMat.uniforms.uDropStrength.value = drop.strength;
      } else {
        this.simMat.uniforms.uDropStrength.value = 0;
      }
      this.simMat.uniforms.uPrev.value = this.simA.texture;
      this.renderer.setRenderTarget(this.simB);
      this.renderer.render(this.simScene, this.dummyCam);
      [this.simA, this.simB] = [this.simB, this.simA];
    }
    this.uWaterTex.value = this.simA.texture;

    /* caustics */
    this.renderer.setRenderTarget(this.causticsRT);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.render(this.causticsScene, this.dummyCam);

    /* underwater scene */
    this.renderer.setRenderTarget(this.underRT);
    this.renderer.setClearColor(new THREE.Color(0.04, 0.10, 0.10), 1);
    this.renderer.render(this.underScene, this.cam);

    /* composite to screen */
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.render(this.compScene, this.dummyCam);

    /* floating leaves drawn on top of the water surface */
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.surfaceScene, this.cam);
    this.renderer.autoClear = true;
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('resize', this.onResize);
    if (this.fpsEl) this.fpsEl.remove();
    for (const k of this.school) k.dispose();
    this.leaves.dispose();
    for (const rt of [this.simA, this.simB, this.causticsRT, this.underRT]) rt.dispose();
    for (const g of [this.quadGeo, this.causticsGridGeo, this.floorGeo, this.koiGeo])
      if (g) g.dispose();
    for (const m of [this.simMat, this.causticsMat, this.floorMat, this.compMat]) m.dispose();
    this.renderer.dispose();
  }
}
