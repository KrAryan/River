/* Refract a water-surface mesh onto the floor plane; the fragment
   stage measures beam compression with screen-space derivatives
   (the core trick from Evan Wallace's WebGL caustics article). */
uniform vec3 uSunDir;
varying vec2 vOld;
varying vec2 vNew;

void main(){
  /* grid spans well past the visible floor so the refracted mesh
     leaves no uncovered strip; the sim texture clamps at its edge */
  vec2 suv = (uv - 0.5) * (FLOORM * 1.3) + 0.5;
  vec2 wxz = simToWorld(suv);
  float h = waterHeight(suv);
  vec3 n = waterNormalW(suv, 2.5);
  vec3 P = vec3(wxz.x, h, wxz.y);
  vec3 refr = refract(uSunDir, n, IOR);
  float tHit = (FLOOR_Y - P.y) / refr.y;
  vec3 NP = P + refr * tHit;
  vec3 refr0 = refract(uSunDir, vec3(0.0, 1.0, 0.0), IOR);
  float t0 = FLOOR_Y / refr0.y;
  vec3 OP = vec3(wxz.x, 0.0, wxz.y) + refr0 * t0;
  vOld = OP.xz;
  vNew = NP.xz;
  gl_Position = vec4(NP.x / (HX * FLOORM), -NP.z / (HZ * FLOORM), 0.0, 1.0);
}
