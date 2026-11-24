// The tornado's shape, shared by the shaders and the debris simulation, so pieces circle exactly where the funnel is drawn.
export interface FunnelShape {
  x: number;
  z: number;
  /** Cloud base height in metres. */
  height: number;
  time: number;
  baseR: number;
  topR: number;
  power: number;
  flareR: number;
  leanX: number;
  leanZ: number;
  wobble: number;
  /** Turns of the visible funnel so far. */
  spin: number;
  dustR: number;
  dustH: number;
  /** 0 a see-through rope, 1 an opaque wall. */
  density: number;
  /** 0..1, how far the storm has grown. */
  growth: number;
}

export const createShape = (): FunnelShape => ({
  x: 0, z: 0, height: 70, time: 0, baseR: 2.5, topR: 9, power: 1.2, flareR: 12, leanX: 0, leanZ: 0,
  wobble: 3, spin: 0, dustR: 8, dustH: 10, density: 0.6, growth: 0,
});

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function funnelRadius(s: FunnelShape, h: number) {
  const f = smooth(0.7, 1, h);
  return s.baseR + (s.topR - s.baseR) * Math.pow(Math.max(h, 0.0001), s.power) + s.flareR * f * f;
}

export function funnelAxis(s: FunnelShape, h: number, out: { x: number; z: number }) {
  const b = s.wobble * h * (1 - h) * 4;
  out.x = s.x + s.leanX * h + Math.sin(h * 4.5 + s.time * 0.9) * b;
  out.z = s.z + s.leanZ * h + Math.sin(h * 3.7 - s.time * 0.7 + 1.3) * b;
  return out;
}

/** The storm's light, shared by every weather shader and the sun. */
export const STORM = {
  /** Towards the sun. */
  sun: [-0.8, 0.42, 0.42] as [number, number, number],
  horizonBright: [0.62, 0.57, 0.33] as [number, number, number],
  horizonDark: [0.105, 0.15, 0.145] as [number, number, number],
  zenith: [0.03, 0.05, 0.05] as [number, number, number],
  cloudLight: [0.3, 0.33, 0.3] as [number, number, number],
  cloudDark: [0.032, 0.045, 0.044] as [number, number, number],
  dust: [0.25, 0.195, 0.125] as [number, number, number],
  fog: [0.186, 0.217, 0.167] as [number, number, number],
  /** Lightning right now: strength and where it stands on the horizon (unit x, z). */
  flash: 0,
  flashX: 0,
  flashZ: 1,
};
