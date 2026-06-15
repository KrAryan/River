/* Composes raw GLSL files with the shared chunks each pass needs. */
import { GLSL_CONSTS } from '../constants.js';
import noise from './chunks/noise.glsl?raw';
import water from './chunks/water.glsl?raw';
import quadVert from './quad.vert.glsl?raw';
import simFrag from './sim.frag.glsl?raw';
import causticsVert from './caustics.vert.glsl?raw';
import causticsFrag from './caustics.frag.glsl?raw';
import floorVert from './floor.vert.glsl?raw';
import floorFrag from './floor.frag.glsl?raw';
import compositeFrag from './composite.frag.glsl?raw';
import surfaceVert from './surface.vert.glsl?raw';
import blobShadowFrag from './blobShadow.frag.glsl?raw';
import leafFrag from './leaf.frag.glsl?raw';
import koiSpriteVert from './koiSprite.vert.glsl?raw';
import koiSpriteFrag from './koiSprite.frag.glsl?raw';

const compose = (...parts) => parts.join('\n');

export const QUAD_VERT = quadVert;
export const SIM_FRAG = compose(GLSL_CONSTS, simFrag);
export const CAUSTICS_VERT = compose(GLSL_CONSTS, noise, water, causticsVert);
export const CAUSTICS_FRAG = causticsFrag;
export const FLOOR_VERT = floorVert;
export const FLOOR_FRAG = compose(GLSL_CONSTS, noise, floorFrag);
export const COMPOSITE_FRAG = compose(GLSL_CONSTS, noise, water, compositeFrag);
export const SURFACE_VERT = surfaceVert;
export const BLOB_SHADOW_FRAG = blobShadowFrag;
export const LEAF_FRAG = compose(GLSL_CONSTS, noise, leafFrag);
export const KOI_SPRITE_VERT = compose(GLSL_CONSTS, koiSpriteVert);
export const KOI_SPRITE_FRAG = compose(GLSL_CONSTS, koiSpriteFrag);
