/* Small shared math helpers. */

export const rand = (a, b) => a + Math.random() * (b - a);

/* Wrap an angle to (-PI, PI]. */
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

/* Frame-rate independent smoothing factor for exponential approach:
   value += (target - value) * approach(rate, dt). */
export const approach = (rate, dt) => 1 - Math.exp(-rate * dt);
