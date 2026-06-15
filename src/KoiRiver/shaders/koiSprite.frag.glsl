/* Sample the koi photo, drop the transparent background, and dapple it
   with the same caustic light as the rest of the scene. Alpha carries the
   depth fraction for the composite pass (like the floor/old koi). */
uniform sampler2D uTex;
uniform sampler2D uCaustics;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDepthF;

vec2 causticsUV(vec2 xz){
  return vec2(xz.x / (HX * FLOORM), -xz.y / (HZ * FLOORM)) * 0.5 + 0.5;
}

void main(){
  vec4 tex = texture2D(uTex, vUv);
  if (tex.a < 0.45) discard;                 /* transparent background */
  vec3 col = tex.rgb;
  /* the water washes the fish out a little; lift saturation so the koi
     still read as the vivid focal point */
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.18);
  vec3 refr0 = refract(uSunDir, vec3(0.0, 1.0, 0.0), IOR);
  vec2 lxz = vWorld.xz + refr0.xz * ((FLOOR_Y - vWorld.y) / refr0.y);
  float ca = min(texture2D(uCaustics, causticsUV(lxz), 1.5).r, 2.0);
  float light = 0.92 + 0.16 * ca;
  gl_FragColor = vec4(col * light, vDepthF);
}
