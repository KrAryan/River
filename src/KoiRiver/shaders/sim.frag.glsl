/* Ping-pong wave equation update (Evan Wallace style):
   r = height, g = velocity. One optional drop splash per step.
   Interaction/fish ripples stay where they are created (the river's
   flow is conveyed by the scrolling surface swell, not by dragging
   these ripples downstream — that made them slide off the cursor). */
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uDropPos;
uniform float uDropRadius;
uniform float uDropStrength;
varying vec2 vUv;

void main(){
  vec4 info = texture2D(uPrev, vUv);
  vec2 e = uTexel;
  float hL  = texture2D(uPrev, vUv + vec2(-e.x,  0.0)).x;
  float hR  = texture2D(uPrev, vUv + vec2( e.x,  0.0)).x;
  float hB  = texture2D(uPrev, vUv + vec2( 0.0, -e.y)).x;
  float hT  = texture2D(uPrev, vUv + vec2( 0.0,  e.y)).x;
  float hTL = texture2D(uPrev, vUv + vec2(-e.x,  e.y)).x;
  float hTR = texture2D(uPrev, vUv + vec2( e.x,  e.y)).x;
  float hBL = texture2D(uPrev, vUv + vec2(-e.x, -e.y)).x;
  float hBR = texture2D(uPrev, vUv + vec2( e.x, -e.y)).x;
  /* isotropic 9-point neighbour average so ripples spread as smooth
     circles, not grid-aligned diamonds (the "pixelated wave" look) */
  float avg = (4.0 * (hL + hR + hB + hT) + (hTL + hTR + hBL + hBR)) / 20.0;
  float vel = info.y + (avg - info.x) * 2.0;
  vel *= 0.984;
  float h = info.x + vel;
  h *= 0.9975;
  if (uDropStrength != 0.0) {
    vec2 d = (vUv - uDropPos) * vec2(2.0 * HX, 2.0 * HZ);
    float r = clamp(length(d) / uDropRadius, 0.0, 1.0);
    h += uDropStrength * (0.5 + 0.5 * cos(PI * r));
  }
  h = clamp(h, -0.25, 0.25);
  vel = clamp(vel, -0.5, 0.5);
  gl_FragColor = vec4(h, vel, 0.0, 1.0);
}
