// One small tileable noise map (R broad fbm, G billows, B cells, A fine fbm) that every weather shader reads.
import { Constants } from "@babylonjs/core/Engines/constants";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";

const SIZE = 256;

export function hash(x: number, y: number, seed = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Value noise that repeats every `period` cells. */
export function tileNoise(x: number, y: number, period: number, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const wrap = (v: number) => ((v % period) + period) % period;
  const x0 = wrap(xi);
  const x1 = wrap(xi + 1);
  const y0 = wrap(yi);
  const y1 = wrap(yi + 1);
  const top = hash(x0, y0, seed) + (hash(x1, y0, seed) - hash(x0, y0, seed)) * ux;
  const bottom = hash(x0, y1, seed) + (hash(x1, y1, seed) - hash(x0, y1, seed)) * ux;
  return top + (bottom - top) * uy;
}

export function tileFbm(u: number, v: number, period: number, octaves: number, seed = 0) {
  let sum = 0;
  let amp = 0.5;
  let total = 0;
  let p = period;
  for (let i = 0; i < octaves; i++) {
    sum += tileNoise(u * p, v * p, p, seed + i * 13) * amp;
    total += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / total;
}

function cells(u: number, v: number, period: number) {
  const x = u * period;
  const y = v * period;
  let best = 2;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = Math.floor(x) + i;
      const cy = Math.floor(y) + j;
      const wx = ((cx % period) + period) % period;
      const wy = ((cy % period) + period) % period;
      best = Math.min(best, Math.hypot(cx + hash(wx, wy, 5) - x, cy + hash(wx, wy, 9) - y));
    }
  return Math.min(1, best);
}

export function createNoise(scene: Scene) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const at = (y * SIZE + x) * 4;
      const broad = tileFbm(u, v, 4, 5, 1);
      const billow = tileFbm(u, v, 5, 4, 3);
      data[at] = stretch(broad) * 255;
      data[at + 1] = Math.max(0, 1 - Math.abs(billow * 2 - 1) * 1.6) * 255;
      data[at + 2] = (1 - cells(u, v, 8)) * 255;
      data[at + 3] = stretch(tileFbm(u, v, 16, 3, 7)) * 255;
    }
  const texture = new RawTexture(data, SIZE, SIZE, Constants.TEXTUREFORMAT_RGBA, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

const stretch = (v: number) => Math.min(1, Math.max(0, (v - 0.5) * 1.7 + 0.5));
