import { useEffect, useRef } from 'react';
import { KoiRiverEngine } from './KoiRiverEngine.js';

/* Self-contained interactive WebGL scene: a calm blue river with koi
   drifting across it, falling leaves, real-time caustics and sun light.
   Drop it onto a light/white background — the scene feathers its own
   edges into white, so it needs no border or frame from the host.

   Props:
     className, style — forwarded to the <canvas> (use to size it; the
       default fills the parent width at a 16:9 ratio).
     assetsBase — URL where the koi/ and floor/ asset folders are served
       (default "/assets"). Copy public/assets to your site and point here. */
const BASE_STYLE = {
  display: 'block',
  width: '100%',
  aspectRatio: '16 / 9',
  touchAction: 'none',
  cursor: 'crosshair'
};

export default function KoiRiver({ className, style, assetsBase = '/assets' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const engine = new KoiRiverEngine(canvasRef.current, { assetsBase });
    return () => engine.dispose();
  }, [assetsBase]);

  return (
    <canvas ref={canvasRef} className={className} style={{ ...BASE_STYLE, ...style }} />
  );
}
