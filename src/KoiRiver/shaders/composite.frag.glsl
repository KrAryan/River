/* Final surface pass: refraction through the rippled surface,
   Beer-Lambert absorption, ray-marched sun shafts, specular sun
   glints, fresnel sky reflection, vignette + gamma. */
uniform sampler2D uUnder;
uniform sampler2D uCaustics;
uniform vec3 uSunDir;
uniform float uRefr;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
uniform vec3 uProbe;   /* debug marker: xy=uv, z=enabled */
varying vec2 vUv;

void main(){
  vec2 uv = vUv;
  /* low-pass the simulated heightfield so interaction ripples read as
     smooth water, not the wave grid's texels (the ambient swell keeps
     its detail — its gradient is analytic, not from this stencil) */
  vec3 n = waterNormalW(uv, 1.4);
  vec2 wxz = simToWorld(uv);

  /* refraction through the surface (screen-space, chromatic) */
  vec2 off = vec2(n.x, -n.z) * uRefr;
  vec2 ruv = uv + off;
  float depthF = texture2D(uUnder, ruv).a;
  vec3 under;
  under.r = texture2D(uUnder, uv + off * 0.94).r;
  under.g = texture2D(uUnder, ruv).g;
  under.b = texture2D(uUnder, uv + off * 1.06).b;

  /* Beer-Lambert absorption along the underwater path — a clean blue-cyan
     depth gradient: shallow stays clear, deeper richens in colour */
  float dist = depthF * DEPTH;
  vec3 trans = exp(-uAbsorb * (dist * 1.95 + 0.05));
  vec3 col = under * trans;

  /* ray-marched sun shafts: walk down the view column, sampling
     how much refracted sunlight passes through each depth */
  vec3 refr0 = refract(uSunDir, vec3(0.0, 1.0, 0.0), IOR);
  /* interleaved-gradient noise: a smoother dither than white noise, so
     the few march steps don't leave a grainy speckle on the water */
  float dith = fract(52.9829189 * fract(dot(gl_FragCoord.xy,
                     vec2(0.06711056, 0.00583715))));
  vec3 shaft = vec3(0.0);
  const int STEPS = 11;
  for (int i = 0; i < STEPS; i++) {
    float f = (float(i) + dith) / float(STEPS);
    float y = -f * DEPTH;
    vec2 pxz = wxz * (CAMH - y) / CAMH;          /* perspective spread */
    vec2 lxz = pxz + refr0.xz * ((FLOOR_Y - y) / refr0.y);
    float c = min(texture2D(uCaustics, causticsUV(lxz), (1.0 - f) * 3.0).r, 3.0);
    shaft += exp(-uAbsorb * (f * DEPTH * 1.3)) * c;
  }
  shaft /= float(STEPS);
  /* light scattering in the water column — kept light so it glows without
     turning the water milky/hazy */
  col += uScatter * shaft * 1.3 * vec3(0.85, 0.97, 1.18) + uScatter * 0.05;

  /* surface lighting — bright, blue, sky-reflective */
  vec3 V = vec3(0.0, 1.0, 0.0);
  vec3 H = normalize(V - uSunDir);
  float dnh = max(dot(n, H), 0.0);
  /* a broad, soft sun sheen. A razor-sharp highlight (high exponent)
     becomes sub-pixel thin and aliases into pixelated dashes along the
     crests, so keep it wide enough to anti-alias on its own */
  float spec = pow(dnh, 120.0) * 0.26 + pow(dnh, 12.0) * 0.08;
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  /* reflected sky: a soft drifting cloud gradient, not a flat tint */
  float cloud = fbm(wxz * vec2(1.2, 2.0) + vec2(uTime * 0.018, 0.0));
  vec3 skyLo = mix(vec3(0.46, 0.68, 0.95), vec3(0.70, 0.84, 0.99), cloud);
  vec3 sky = mix(skyLo, vec3(1.0, 1.0, 1.0),
                 clamp(0.5 + n.x * 2.2 + n.z, 0.0, 1.0));
  col = mix(col, sky, clamp(fres * 2.0, 0.0, 1.0));
  col += spec * vec3(1.0, 0.99, 0.96);

  /* bright sunlit foam where caustics focus near the surface */
  vec2 foamUV = causticsUV(wxz + refr0.xz * (FLOOR_Y / refr0.y));
  float caS = min(texture2D(uCaustics, foamUV, 2.2).r, 4.0);
  col = mix(col, vec3(0.97, 0.99, 1.0), smoothstep(1.7, 3.6, caS) * 0.45);

  /* exposure, gamma, then a gentle contrast + saturation for HD pop */
  col *= 1.22;
  col = pow(max(col, 0.0), vec3(0.4545));
  col = clamp((col - 0.5) * 1.12 + 0.5, 0.0, 1.0);
  float clum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(clum), col, 1.14);

  /* soft feathered border + reveal, both dissolving into the white page */
  vec2 ed = min(uv, 1.0 - uv);
  float edge = smoothstep(0.0, 0.17, ed.x) * smoothstep(0.0, 0.15, ed.y);
  float reveal = smoothstep(0.0, 2.5, uTime);
  col = mix(vec3(1.0), col, edge * reveal);

  /* debug (?probe=u,v): mark the intended point in magenta */
  if (uProbe.z > 0.5 && length(uv - uProbe.xy) < 0.008) col = vec3(1.0, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
