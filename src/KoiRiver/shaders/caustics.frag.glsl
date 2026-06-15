varying vec2 vOld;
varying vec2 vNew;

void main(){
  float oldArea = length(dFdx(vOld)) * length(dFdy(vOld));
  float newArea = length(dFdx(vNew)) * length(dFdy(vNew));
  float c = oldArea / max(newArea, 1e-7);
  c = clamp(c, 0.0, 4.0);
  gl_FragColor = vec4(vec3(c), 1.0);
}
