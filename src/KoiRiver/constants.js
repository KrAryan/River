/* River world space: water surface at y=0, bed at y=-DEPTH.
   Spans x in [-HX,HX] (the flow axis), z in [-HZ,HZ]. Screen-up = -z. */
export const HX = 1.0;               // half-extents (16:9 landscape)
export const HZ = 0.5625;
export const DEPTH = 1.0;            // water depth
export const CAMH = 3.0;             // camera height above surface
export const FLOORM = 1.4;           // floor/caustics margin factor
export const SIM_W = 1024;           // wave sim resolution (square texels);
export const SIM_H = 576;            //   fine enough that texels stay sub-pixel
export const CAUST_W = 1280;         // caustics map resolution
export const CAUST_H = 720;
export const CAUST_GRID_W = 640;     // refracted-surface grid; the caustic
export const CAUST_GRID_H = 360;     //   network's detail is set by this
export const FLOW = 0.055;           // river flow speed, world units/s (+x)

const fmt = n => n.toFixed(6);

export const GLSL_CONSTS = `
  const float HX = ${fmt(HX)};
  const float HZ = ${fmt(HZ)};
  const float DEPTH = ${fmt(DEPTH)};
  const float FLOOR_Y = ${fmt(-DEPTH)};
  const float CAMH = ${fmt(CAMH)};
  const float FLOORM = ${fmt(FLOORM)};
  const float IOR = 0.750187;
  const float PI = 3.14159265;
  const float FLOWSPD = ${fmt(FLOW)};
`;
