# KoiRiver

A self-contained, interactive WebGL scene: a calm blue river with koi drifting
across it, falling leaves, real-time caustics, sun light and soft ripples.
Pointer/touch disturbs the water. The scene **feathers its own edges into
white**, so it's designed to sit on a light/white background with no frame.

Built with React + Three.js. The render engine itself is framework-agnostic,
so it can also be used without React (see below).

## Run the demo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
```

## Use it as a React component

1. Copy into your project:
   - the component folder `src/KoiRiver/`
   - the assets folder `public/assets/` (the `koi/` and `floor/` subfolders)
2. Make sure your bundler handles `three` and GLSL `?raw` imports (Vite does out
   of the box; for others add a raw/text loader for `.glsl`).
3. Render it on a light background:

```jsx
import KoiRiver from './KoiRiver';          // from src/KoiRiver/

export default function Hero() {
  return (
    <div style={{ background: '#fff', display: 'flex', justifyContent: 'center' }}>
      <KoiRiver style={{ width: 'min(94vw, 165vh)' }} />
    </div>
  );
}
```

### Props
| prop         | default      | description |
|--------------|--------------|-------------|
| `style`      | —            | merged onto the `<canvas>` (use to size it; defaults to 100% width, 16:9). |
| `className`  | —            | forwarded to the `<canvas>`. |
| `assetsBase` | `"/assets"`  | URL where the `koi/` and `floor/` asset folders are served. |

If your assets aren't at the site root, set `assetsBase` (e.g.
`<KoiRiver assetsBase="/koiriver/assets" />`).

## Use it without React

The engine takes a `<canvas>` and cleans up on `dispose()`:

```js
import { KoiRiverEngine } from './KoiRiver/KoiRiverEngine.js';

const engine = new KoiRiverEngine(canvasEl, { assetsBase: '/assets' });
// later:
engine.dispose();
```

## Notes
- **Background:** the scene fades to white at the edges — place it on a white /
  very light surface.
- **Aspect:** the scene is authored 16:9; size the canvas to that ratio.
- **Performance:** see notes in code — render resolution is capped per device;
  `?fps=1` in the URL shows a live frame-rate readout, `?t0=N` pre-warms the
  clock (for screenshots).
- Credits for bundled assets are in [CREDITS.md](CREDITS.md).
