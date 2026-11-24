// Structures are assembled from pieces. A piece knows how much wind it holds against, what it is worth and where it stands.
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { linear, type Batch, type Batches, type Shape } from "./batches";

export const enum State { Standing, Loose, Orbit, Thrown, Rest, Gone }

export interface Piece {
  batch: Batch;
  slot: number;
  s: Structure;
  x: number; y: number; z: number;
  qx: number; qy: number; qz: number; qw: number;
  sx: number; sy: number; sz: number;
  /** Half extents in metres, for ground contact. */
  hx: number; hy: number; hz: number;
  home: [number, number, number, number, number, number, number];
  hold: number;
  tier: number;
  value: number;
  /** 0.2 a shingle .. 10 a water tank; heavy things fly lower, slower and shorter. */
  weight: number;
  state: State;
  health: number;
  vx: number; vy: number; vz: number;
  wx: number; wy: number; wz: number;
  /** Seconds in this state, seconds it stays in the funnel, share of the funnel radius it circles at, climb, phase. */
  t: number; life: number; orbit: number; climb: number; phase: number;
}

export interface Structure {
  name: string;
  /** Sort order for "biggest object lifted": metres times heft. */
  heft: number;
  x: number;
  z: number;
  radius: number;
  pieces: Piece[];
  /** Pieces that can be torn off. */
  total: number;
  lost: number;
  value: number;
  down: boolean;
  kind: StructureKind;
  checkAt: number;
}

export type StructureKind = "building" | "loose" | "tree" | "vehicle" | "pole" | "fence";

export interface PartOptions {
  c?: string;
  hold?: number;
  tier?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  weight?: number;
  value?: number;
}

const DENSITY: Partial<Record<Shape, number>> = { concrete: 1.6, brick: 1.4, metal: 0.5, cyl: 0.7, shingle: 0.8, wood: 0.8, siding: 0.8, window: 0.8, windowLit: 0.8, paint: 0.8, dome: 0.5 };
const q = new Quaternion();
const yawQ = new Quaternion();

export class Builder {
  readonly structures: Structure[] = [];
  readonly pieces: Piece[] = [];
  private s!: Structure;
  private yaw = 0;
  private hold = 1;

  constructor(readonly batches: Batches) {}

  begin(name: string, kind: StructureKind, x: number, z: number, yaw: number, hold: number, value: number, heft: number) {
    this.s = { name, heft, x, z, radius: 0, pieces: [], total: 0, lost: 0, value, down: false, kind, checkAt: 0 };
    this.yaw = yaw;
    this.hold = hold;
    this.structures.push(this.s);
    return this;
  }

  /** A piece at a place in the structure's own frame. A `hold` of 99 never comes loose. */
  part(shape: Shape, x: number, y: number, z: number, w: number, h: number, d: number, o: PartOptions = {}) {
    const { s, yaw } = this;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const wx = s.x + x * cos + z * sin;
    const wz = s.z - x * sin + z * cos;
    Quaternion.RotationYawPitchRollToRef(o.ry ?? 0, o.rx ?? 0, o.rz ?? 0, q);
    Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, yawQ);
    yawQ.multiplyToRef(q, q);
    const batch = this.batches[shape];
    const half = batch.half;
    const hold = (o.hold ?? 0) >= 90 ? 99 : this.hold + (o.hold ?? 0);
    const volume = w * h * d * half[0] * half[1] * half[2] * 8;
    const piece: Piece = {
      batch, slot: batch.add(linear(o.c ?? "#ffffff")), s,
      x: wx, y, z: wz, qx: q.x, qy: q.y, qz: q.z, qw: q.w, sx: w, sy: h, sz: d,
      hx: half[0] * w, hy: half[1] * h, hz: half[2] * d,
      home: [wx, y, wz, q.x, q.y, q.z, q.w],
      hold, tier: o.tier ?? 0, value: o.value ?? 0,
      weight: o.weight ?? Math.min(9, Math.max(0.15, Math.cbrt(volume) * (DENSITY[shape] ?? 0.8))),
      state: State.Standing, health: 1, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, t: 0, life: 0, orbit: 1, climb: 1, phase: 0,
    };
    s.pieces.push(piece);
    this.pieces.push(piece);
    if (hold < 90) s.total++;
    s.radius = Math.max(s.radius, Math.hypot(wx - s.x, wz - s.z) + Math.max(piece.hx, piece.hz));
    writeMatrix(piece);
    return this;
  }

  /** Spreads the structure's value over its pieces by size. */
  end() {
    const { s } = this;
    const loose = s.pieces.filter((p) => p.hold < 90);
    const sum = loose.reduce((n, p) => n + p.weight, 0) || 1;
    for (const p of loose) p.value = (s.value * p.weight) / sum;
    return s;
  }

  finish() {
    for (const batch of Object.values(this.batches)) batch.finish();
  }

  /** Puts everything back where it was built. */
  reset() {
    for (const p of this.pieces) {
      if (p.state === State.Standing && p.health === 1) continue;
      [p.x, p.y, p.z, p.qx, p.qy, p.qz, p.qw] = p.home;
      p.state = State.Standing;
      p.health = 1;
      p.vx = p.vy = p.vz = p.wx = p.wy = p.wz = p.t = 0;
      writeMatrix(p);
    }
    for (const s of this.structures) {
      s.lost = 0;
      s.down = false;
    }
  }
}

export function writeMatrix(p: Piece, hide = false) {
  const m = p.batch.matrices;
  const o = p.slot * 16;
  p.batch.dirty = true;
  if (hide) {
    m.fill(0, o, o + 15);
    m[o + 13] = -50;
    m[o + 15] = 1;
    return;
  }
  const { qx, qy, qz, qw, sx, sy, sz } = p;
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx = qw * x2, wy = qw * y2, wz = qw * z2;
  m[o] = (1 - yy - zz) * sx; m[o + 1] = (xy + wz) * sx; m[o + 2] = (xz - wy) * sx; m[o + 3] = 0;
  m[o + 4] = (xy - wz) * sy; m[o + 5] = (1 - xx - zz) * sy; m[o + 6] = (yz + wx) * sy; m[o + 7] = 0;
  m[o + 8] = (xz + wy) * sz; m[o + 9] = (yz - wx) * sz; m[o + 10] = (1 - xx - yy) * sz; m[o + 11] = 0;
  m[o + 12] = p.x; m[o + 13] = p.y; m[o + 14] = p.z; m[o + 15] = 1;
}
