/* Riverbed: photographic pebble texture (with normal-map relief),
   organic debris patches, drifting sunlight pools, and caustics.
   Alpha channel carries depth fraction (floor = 1) for the composite. */
uniform sampler2D uCaustics;
uniform sampler2D uFloorTex;
uniform sampler2D uFloorNor;
uniform float uHasTex;
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vWorld;

vec2 causticsUV(vec2 xz){
  return vec2(xz.x / (HX * FLOORM), -xz.y / (HZ * FLOORM)) * 0.5 + 0.5;
}

void main(){
  vec2 tuv = vWorld.xz * 0.85;
  vec3 alb;
  if (uHasTex > 0.5) {
    alb = texture2D(uFloorTex, tuv).rgb;
    /* defined relief from the normal map for crisp 3D pebbles */
    vec3 nm = texture2D(uFloorNor, tuv).xyz * 2.0 - 1.0;
    vec3 n = normalize(vec3(nm.x, nm.z * 1.4, -nm.y));
    alb *= 0.66 + 0.5 * clamp(dot(n, -uSunDir), 0.0, 1.0);
    /* keep most of the pebble colour/detail (only a light sand wash) */
    alb = mix(alb, vec3(0.56, 0.57, 0.51), 0.22);
  } else {
    alb = vec3(0.50, 0.52, 0.46) * (0.88 + 0.24 * fbm(vWorld.xz * 6.0));
  }
  vec3 col = alb;
  /* faint patches of settled organic debris */
  float deb = smoothstep(0.58, 0.74, fbm(vWorld.xz * 1.7 + 17.0));
  col = mix(col, col * vec3(0.62, 0.63, 0.54), deb * 0.30);
  /* sparse dark plant clusters hugging the banks (frame edges) */
  float edgeW = smoothstep(0.60, 0.92, max(abs(vWorld.x) / HX, abs(vWorld.z) / HZ));
  float vegM = smoothstep(0.55, 0.68, fbm(vWorld.xz * 1.4 + 51.0)) * edgeW * 0.45;
  float leaf = vnoise(vWorld.xz * 11.0 + 31.0);
  vec3 vegCol = mix(vec3(0.16, 0.19, 0.15), vec3(0.24, 0.28, 0.20),
                    smoothstep(0.35, 0.8, leaf))
              * (0.80 + 0.30 * fbm(vWorld.xz * 23.0 + 5.0));
  col = mix(col, vegCol, vegM);
  /* large-scale hue drift so the bed never reads as one flat material */
  col *= mix(vec3(0.95, 1.02, 0.98), vec3(1.05, 1.00, 0.94), fbm(vWorld.xz * 0.5 + 9.0));
  /* big drifting pools of sunlight and shade */
  float dap = fbm(vWorld.xz * 0.7 + vec2(uTime * 0.012, -uTime * 0.008));
  col *= mix(0.84, 1.12, smoothstep(0.32, 0.68, dap));
  /* crisp, contrasty caustic light — bright dancing ribbons over cooler
     shade (the hallmark of clear sunlit water); clamped so it doesn't
     blow to white, plant masses sit in their own shade */
  float ca = min(texture2D(uCaustics, causticsUV(vWorld.xz), 1.1).r, 2.6);
  ca *= 1.0 - vegM * 0.5;
  col *= (0.34 + 0.72 * ca) * vec3(1.07, 1.03, 0.92);
  gl_FragColor = vec4(col, 1.0);
}
