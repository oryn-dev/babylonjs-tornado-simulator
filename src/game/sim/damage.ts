// What the wind does to standing things: strain, then pieces tear off, weakest first, and what loses its support falls.
import type { Tuning } from "../../oryn/tuning";
import { State, writeMatrix, type Builder, type Piece, type Structure } from "../world/builder";
import { wires } from "../world/map";
import type { Debris } from "./debris";
import type { Tornado } from "./tornado";

export interface DamageEvents {
  torn(piece: Piece): void;
  down(structure: Structure): void;
  spark(x: number, y: number, z: number): void;
}

export class Damage {
  dollars = 0;
  lifted: Structure | null = null;
  destroyed = 0;
  private clock = 0;

  constructor(private tuning: Tuning, private builder: Builder, private tornado: Tornado, private debris: Debris, private events: DamageEvents) {}

  reset() {
    this.dollars = 0;
    this.destroyed = 0;
    this.lifted = null;
  }

  update(dt: number) {
    const { tornado } = this;
    const { x, z } = tornado.shape;
    const reach = tornado.reach;
    const power = tornado.power;
    const rate = this.tuning.number("tear_rate", 1.9);
    this.clock += dt;
    for (const s of this.builder.structures) {
      const near = reach * 1.9 + s.radius;
      const dx = s.x - x;
      const dz = s.z - z;
      if (dx * dx + dz * dz > near * near) continue;
      for (const p of s.pieces) {
        if (p.state === State.Standing) {
          if (p.hold < 90) this.strain(p, power, reach, rate, dt);
        } else if (p.state === State.Rest) this.relift(p, power, reach);
      }
      if (s.lost > 0 && this.clock >= s.checkAt) this.support(s);
    }
  }

  private strain(p: Piece, power: number, reach: number, rate: number, dt: number) {
    const { shape } = this.tornado;
    const r = Math.hypot(p.x - shape.x, p.z - shape.z);
    const fall = r < reach ? 1 : Math.max(0, 1 - (r - reach) / (reach * 0.85));
    const over = power * (0.3 + 0.7 * fall) * (fall > 0 ? 1 : 0) - p.hold;
    if (over <= -0.35) return;
    if (over > 0) p.health -= over * rate * dt * (0.7 + Math.random() * 0.6) + dt * 0.25;
    if (p.health <= 0) return this.tear(p, true);
    this.shudder(p, Math.min(1, (over + 0.35) * 0.8));
  }

  /** Loaded pieces rattle in place. */
  private shudder(p: Piece, amount: number) {
    const a = amount * 0.07 * (1.6 - p.health);
    const [hx, hy, hz] = p.home;
    p.x = hx + (Math.random() - 0.5) * a * 2;
    p.y = hy + Math.random() * a;
    p.z = hz + (Math.random() - 0.5) * a * 2;
    writeMatrix(p);
  }

  private relift(p: Piece, power: number, reach: number) {
    const { shape } = this.tornado;
    const r = Math.hypot(p.x - shape.x, p.z - shape.z);
    if (r < reach && power > 0.35 + p.weight * 0.42 + Math.random() * 3) this.debris.release(p);
  }

  private tear(p: Piece, pull: boolean) {
    const s = p.s;
    if (p.weight === 0) {
      // A wire: it snaps, flashes and is gone.
      p.state = State.Gone;
      writeMatrix(p, true);
      s.lost++;
      if (Math.random() < 0.3) this.events.spark(p.x, p.y, p.z);
      return;
    }
    this.debris.release(p, pull);
    s.lost++;
    this.dollars += p.value;
    this.tornado.feed(0.6 + p.weight * (0.35 + Math.max(0, p.hold)));
    this.events.torn(p);
    if (s.kind === "pole" && wires.has(s)) this.dropWires(s);
    if (!s.down && s.lost >= s.total * 0.6) {
      s.down = true;
      this.destroyed++;
      if (!this.lifted || s.heft > this.lifted.heft) this.lifted = s;
      this.events.down(s);
    }
  }

  private dropWires(s: Structure) {
    for (const owner of [s, wires.get(s)]) {
      for (const p of owner?.pieces ?? []) {
        if (p.weight !== 0 || p.state === State.Gone) continue;
        this.tear(p, false);
      }
    }
    const top = s.pieces[1];
    this.events.spark(top.home[0], top.home[1], top.home[2]);
  }

  /** Upper pieces without anything standing below them come down. */
  private support(s: Structure) {
    s.checkAt = this.clock + 0.25;
    for (const p of s.pieces) {
      if (p.state !== State.Standing || p.tier === 0 || p.hold >= 90) continue;
      const span = s.kind === "building" ? 5.2 : 3;
      let held = 0;
      for (const o of s.pieces) {
        if (o.state !== State.Standing || o.tier >= p.tier || o.hold >= 90) continue;
        if (Math.abs(o.home[0] - p.home[0]) < span + p.hx * 0.5 && Math.abs(o.home[2] - p.home[2]) < span + p.hz * 0.5 && ++held >= 2) break;
      }
      const needs = s.kind === "building" ? 2 : 1;
      if (held < needs) this.tear(p, this.tornado.power > p.hold * 0.6);
    }
  }

  /** A heavy piece came down on something. */
  impact(p: Piece, speed: number) {
    const blow = (p.weight * speed) / 60;
    if (blow < 0.35) return;
    for (const s of this.builder.structures) {
      if (s === p.s || Math.hypot(s.x - p.x, s.z - p.z) > s.radius + 3) continue;
      for (const q of s.pieces) {
        if (q.state !== State.Standing || q.hold >= 90) continue;
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d > 3.5) continue;
        q.health -= (blow * 1.6) / (0.5 + q.hold * 0.6);
        if (q.health <= 0) this.tear(q, false);
      }
    }
  }
}
