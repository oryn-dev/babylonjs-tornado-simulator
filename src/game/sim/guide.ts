// Finds the nearest rich cluster the storm can break right now, for the arrow and the drift that help a lost player.
import { State, type Builder, type Structure } from "../world/builder";
import type { Tornado } from "./tornado";

const CELL = 44;

export interface Target {
  x: number;
  z: number;
  name: string;
  distance: number;
}

export class Guide {
  target: Target | null = null;
  /** Seconds since the storm last broke something that counts. */
  quiet = 0;
  private clock = 0;
  private cell = NaN;

  constructor(private builder: Builder, private tornado: Tornado) {}

  reset() {
    this.quiet = this.clock = 0;
    this.target = null;
    this.cell = NaN;
  }

  hit(s: Structure) {
    if (s.kind !== "fence" && s.kind !== "pole") this.quiet = 0;
  }

  update(dt: number) {
    this.quiet += dt;
    this.clock -= dt;
    if (this.clock <= 0) {
      this.clock = 0.5;
      this.search();
    }
    const { x, z } = this.tornado.shape;
    if (this.target) this.target.distance = Math.hypot(this.target.x - x, this.target.z - z);
  }

  private search() {
    const { shape, vx, vz } = this.tornado;
    const power = this.tornado.power;
    const cells = new Map<number, { sum: number; x: number; z: number; top: number; name: string }>();
    for (const s of this.builder.structures) {
      if (s.kind === "fence" || s.kind === "pole") continue;
      let worth = 0;
      for (const p of s.pieces) if (p.state === State.Standing && p.hold < power) worth += p.value;
      if (worth < 2000) continue;
      const key = Math.floor(s.x / CELL) * 1000 + Math.floor(s.z / CELL);
      const c = cells.get(key) ?? { sum: 0, x: 0, z: 0, top: 0, name: "" };
      c.sum += worth;
      c.x += s.x * worth;
      c.z += s.z * worth;
      if (worth > c.top) {
        c.top = worth;
        c.name = s.name;
      }
      cells.set(key, c);
    }
    const last = this.cell;
    let score = 0;
    this.target = null;
    for (const [key, c] of cells) {
      const x = c.x / c.sum;
      const z = c.z / c.sum;
      const distance = Math.hypot(x - shape.x, z - shape.z);
      // What already lies ahead counts more, so the pull follows where the player is heading.
      const ahead = ((x - shape.x) * vx + (z - shape.z) * vz) / Math.max(1, distance * Math.hypot(vx, vz));
      const v = (Math.sqrt(c.sum) / Math.pow(distance + 30, 1.6)) * (1 + 0.6 * ahead) * (key === last ? 1.8 : 1);
      if (v <= score) continue;
      score = v;
      this.cell = key;
      this.target = { x, z, name: c.name, distance };
    }
  }
}
