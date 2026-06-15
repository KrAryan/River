/* Textured koi sprite on a horizontal ribbon. Local space: x is the body
   axis (+0.5 head .. -0.5 tail), z is width. The ribbon bends laterally
   (swim) and follows turns; aS is 0 at the head, 1 at the tail. */
attribute float aS;
uniform float uSwimPhase;
uniform float uTurn;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDepthF;

void main(){
  vUv = uv;
  vec3 p = position;
  float amp = 0.018 + 0.055 * aS * aS;        /* gentle, grows toward the tail */
  p.z += amp * sin(uSwimPhase - aS * 5.0);
  p.z += uTurn * aS * aS * 0.5;               /* lean into turns */
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vDepthF = clamp(-wp.y / DEPTH, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
