// Tiling wall and roof textures drawn from height functions: one albedo and one normal map each.
import { Constants } from "@babylonjs/core/Engines/constants";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import { hash, tileFbm, tileNoise } from "../weather/noise";

export interface Tile {
  albedo: RawTexture;
  normal: RawTexture;
}

type Pixel = { h: number; c: [number, number, number] };

function tile(scene: Scene, size: number, strength: number, pixel: (u: number, v: number) => Pixel): Tile {
  const heights = new Float32Array(size * size);
  const color = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const { h, c } = pixel(x / size, y / size);
      heights[y * size + x] = h;
      color.set([c[0] * 255, c[1] * 255, c[2] * 255, 255].map((v) => Math.min(255, Math.max(0, v))), (y * size + x) * 4);
    }
  const normal = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      normal.set([(dx / l) * 127 + 128, (dy / l) * 127 + 128, (1 / l) * 127 + 128, 255], (y * size + x) * 4);
    }
  const make = (data: Uint8Array, srgb: boolean) => {
    const t = new RawTexture(data, size, size, Constants.TEXTUREFORMAT_RGBA, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
    t.gammaSpace = srgb;
    t.anisotropicFilteringLevel = 8;
    return t;
  };
  return { albedo: make(color, true), normal: make(normal, false) };
}

const grey = (v: number): [number, number, number] => [v, v, v];

/** Lap boards, 8 per tile. */
export const siding = (scene: Scene) =>
  tile(scene, 256, 3, (u, v) => {
    const f = (v * 8) % 1;
    const grain = tileFbm(u, v * 4, 8, 3, 2);
    const stain = tileFbm(u * 2, v, 3, 3, 8);
    return { h: f * 0.9 + grain * 0.06, c: grey((f < 0.1 ? 0.62 : 0.93) - grain * 0.06 - stain * 0.1) };
  });

/** Asphalt shingles in offset rows. */
export const shingle = (scene: Scene) =>
  tile(scene, 256, 3, (u, v) => {
    const row = Math.floor(v * 8);
    const shifted = u * 6 + (row % 2) * 0.5;
    const col = Math.floor(shifted) % 6;
    const fx = shifted % 1;
    const fy = (v * 8) % 1;
    const tone = 0.62 + hash(col, row, 4) * 0.3;
    const gap = fx < 0.05 || fy < 0.1 ? 0.55 : 1;
    return { h: fy * 0.8 * gap + tileNoise(u * 64, v * 64, 64) * 0.15, c: grey(tone * gap - tileNoise(u * 128, v * 128, 128, 3) * 0.12) };
  });

/** Corrugated sheet with a little weathering. */
export const metal = (scene: Scene) =>
  tile(scene, 256, 5, (u, v) => {
    const wave = Math.sin(u * Math.PI * 2 * 8) * 0.5 + 0.5;
    const streak = tileFbm(u * 4, v * 0.5, 8, 3, 6);
    const seam = v % 0.5 < 0.012 ? 0.6 : 1;
    const worn = Math.max(0, streak - 0.56) * 1.5;
    return { h: wave, c: [(0.9 - worn * 0.25) * seam, (0.9 - worn * 0.6) * seam, (0.9 - worn * 0.85) * seam] };
  });

/** Cast concrete and stucco. */
export const concrete = (scene: Scene) =>
  tile(scene, 256, 1.2, (u, v) => {
    const n = tileFbm(u, v, 6, 5, 11);
    const joint = u < 0.008 || v < 0.008 ? 0.75 : 1;
    return { h: n, c: grey((0.72 + n * 0.28) * joint) };
  });

/** A window pane in a white frame; `lit` is the warm room behind it. */
export function windowPane(scene: Scene, lit: boolean) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const frame = u < 0.1 || u > 0.9 || v < 0.1 || v > 0.9 || Math.abs(u - 0.5) < 0.035 || Math.abs(v - 0.5) < 0.035;
      const curtain = Math.abs(u - 0.5) > 0.28;
      const glass = lit ? (curtain ? [235, 170, 92] : [255, 208, 130]) : curtain ? [62, 72, 76] : [26, 34, 38];
      data.set([...(frame ? [214, 212, 204] : glass), 255], (y * size + x) * 4);
    }
  const t = new RawTexture(data, size, size, Constants.TEXTUREFORMAT_RGBA, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  t.gammaSpace = true;
  return t;
}
