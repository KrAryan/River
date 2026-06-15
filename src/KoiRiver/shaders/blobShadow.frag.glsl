/* Soft radial shadow disc projected on the pond floor. */
uniform float uStrength;
varying vec2 vUv;

void main(){
  vec2 q = vUv * 2.0 - 1.0;
  float a = uStrength * smoothstep(1.0, 0.40, length(q));
  gl_FragColor = vec4(vec3(0.04, 0.08, 0.08), a);
}
