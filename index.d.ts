import * as React from 'react';

export interface KoiRiverProps {
  /** Class forwarded to the underlying <canvas>. */
  className?: string;
  /** Inline style forwarded to the <canvas>; use to size it (defaults to 100% width, 16:9). */
  style?: React.CSSProperties;
  /** Base URL where the `koi/` and `floor/` asset folders are served. Default `"/assets"`. */
  assetsBase?: string;
}

/** Self-contained interactive WebGL koi-river scene. Place on a light/white background. */
declare const KoiRiver: React.FC<KoiRiverProps>;
export default KoiRiver;

export interface KoiRiverEngineOptions {
  /** Base URL where the `koi/` and `floor/` asset folders are served. Default `"/assets"`. */
  assetsBase?: string;
}

/** Framework-agnostic engine. Pass a <canvas>; call dispose() to tear down. */
export class KoiRiverEngine {
  constructor(canvas: HTMLCanvasElement, options?: KoiRiverEngineOptions);
  dispose(): void;
}
