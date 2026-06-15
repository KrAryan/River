/* Floating green leaf: per-leaf tint, midrib + side veins, soft edge
   shading. Rendered in the surface overlay pass (gamma here). */
uniform vec3 uCol;
uniform float uSeed;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;

void main(){
  vec3 col = uCol * (0.84 + 0.30 * fbm(vUv * vec2(5.0, 8.0) + uSeed * 11.0));
  /* midrib */
  float mid = 1.0 - smoothstep(0.0, 0.06, abs(vUv.y - 0.5));
  col *= 1.0 + mid * 0.16;
  /* side veins angling off the midrib */
  float sv = abs(fract(vUv.x * 8.0 + abs(vUv.y - 0.5) * 2.6 + uSeed * 5.0) - 0.5) * 2.0;
  col *= 1.0 + (1.0 - smoothstep(0.0, 0.30, sv)) * 0.07;
  /* slightly darker, cooler edges (no autumn browning) */
  float worn = max(abs(vUv.y - 0.5) * 2.0, smoothstep(0.7, 1.0, vUv.x));
  col = mix(col, col * vec3(0.78, 0.86, 0.66), 0.25 * smoothstep(0.74, 1.0, worn));
  float top = clamp(abs(dot(normalize(vNormal), vec3(0.0, 1.0, 0.0))), 0.0, 1.0);
  col *= 0.82 + 0.30 * top;
  col = pow(max(col, 0.0), vec3(0.4545)); /* overlay pass: gamma here */
  /* fade into the white page near the river edges, matching the water's
     feathered border, so leaves don't sit as solid shapes over it */
  float fx = 1.0 - smoothstep(0.66, 1.0, abs(vWorld.x) / HX);
  float fz = 1.0 - smoothstep(0.70, 1.0, abs(vWorld.z) / HZ);
  float reveal = smoothstep(0.0, 2.5, uTime);
  col = mix(vec3(1.0), col, reveal * fx * fz);
  gl_FragColor = vec4(col, 1.0);
}
