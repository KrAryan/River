/* Water sampling helpers: sim heightfield + ambient analytic swell.
   Used identically by the caustics pass and the surface composite so
   the refraction and the caustics always agree. */
uniform sampler2D uWater;
uniform vec2 uSimTexel;
uniform vec2 uWorldTexel;
uniform float uTime;

vec2 simToWorld(vec2 uv){
  return vec2((uv.x * 2.0 - 1.0) * HX, -(uv.y * 2.0 - 1.0) * HZ);
}

vec2 causticsUV(vec2 xz){
  return vec2(xz.x / (HX * FLOORM), -xz.y / (HZ * FLOORM)) * 0.5 + 0.5;
}

/* River surface swell. Rather than a sum of fixed sine waves (which
   always looks mechanically regular), the height is a domain-warped,
   multi-scale noise field that scrolls downstream — organic, calm,
   and visibly non-repeating, the way real slow water moves. */
const float STRX = 0.88; /* mild flow alignment (1.0 = fully isotropic) */

float rippleField(vec2 p, float t){
  /* advect downstream, only mildly stretched so ripples stay roughly
     round and organic instead of reading as straight streak lines */
  vec2 q = vec2((p.x - t * FLOWSPD) * STRX, p.y);
  /* strong domain warp so the ripples meander organically and never
     line up into rows */
  vec2 w = vec2(vnoise(q * 1.1 + vec2(0.0, t * 0.05)),
                vnoise(q * 1.1 + vec2(5.2, 1.3 - t * 0.04)));
  q += (w - 0.5) * 2.2;
  /* a few drifting scales of gentle ripple stacked together */
  float h = 0.0;
  h += 0.0030 * (vnoise(q * 2.2 + vec2(t * 0.10, 0.0)) - 0.5);
  h += 0.0021 * (vnoise(q * 4.3 + vec2(t * 0.14, t * 0.05)) - 0.5);
  h += 0.0013 * (vnoise(q * 8.2 - vec2(t * 0.09, 0.0)) - 0.5);
  h += 0.0007 * (vnoise(q * 15.0 + vec2(t * 0.18, t * 0.03)) - 0.5);
  return h;
}

float baseWave(vec2 p, float t){
  return rippleField(p, t);
}

vec2 baseWaveGrad(vec2 p, float t){
  /* central-difference gradient of the noise field */
  float e = 0.011;
  float hx = rippleField(p + vec2(e, 0.0), t) - rippleField(p - vec2(e, 0.0), t);
  float hz = rippleField(p + vec2(0.0, e), t) - rippleField(p - vec2(0.0, e), t);
  return vec2(hx, hz) / (2.0 * e);
}

float waterHeight(vec2 uv){
  return texture2D(uWater, uv).x + baseWave(simToWorld(uv), uTime);
}

/* Surface normal from the simulated heightfield. Uses a Sobel 3x3
   operator (a smoothing differentiator) rather than a 2-tap central
   difference: the 2-tap version returns a piecewise-flat gradient that
   makes low-res ripples show the wave grid as boxy facets in the
   shading and caustics. Sobel reconstructs a smooth gradient from the
   same texture. w scales the sample spacing (extra low-pass). */
vec3 waterNormalW(vec2 uv, float w){
  vec2 e = uSimTexel * w;
  float tl = texture2D(uWater, uv + vec2(-e.x,  e.y)).x;
  float tc = texture2D(uWater, uv + vec2( 0.0,  e.y)).x;
  float tr = texture2D(uWater, uv + vec2( e.x,  e.y)).x;
  float ml = texture2D(uWater, uv + vec2(-e.x,  0.0)).x;
  float mr = texture2D(uWater, uv + vec2( e.x,  0.0)).x;
  float bl = texture2D(uWater, uv + vec2(-e.x, -e.y)).x;
  float bc = texture2D(uWater, uv + vec2( 0.0, -e.y)).x;
  float br = texture2D(uWater, uv + vec2( e.x, -e.y)).x;
  float dhdx = ((tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl))
             / (8.0 * uWorldTexel.x * w);
  /* v+ is screen-up (z-), so the bottom row (v-) minus the top row */
  float dhdz = ((bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr))
             / (8.0 * uWorldTexel.y * w);
  vec2 g = baseWaveGrad(simToWorld(uv), uTime);
  return normalize(vec3(-(dhdx + g.x), 1.0, -(dhdz + g.y)));
}

vec3 waterNormal(vec2 uv){ return waterNormalW(uv, 1.0); }
