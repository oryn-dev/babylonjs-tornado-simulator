// Flying pieces. Torn loose they are dragged along the ground, then held in an orbit around the funnel at their own
// height and distance, then let go: that keeps every piece readable on screen, which free physics does not.
import type { Tuning } from "../../oryn/tuning";
import { funnelAxis, funnelRadius } from "../weather/state";
import { State, writeMatrix, type Piece } from "../world/builder";
import type { Tornado } from "./tornado";

const axis = { x: 0, z: 0 };
const PULL_LIMIT = 4.5;

export interface DebrisEvents {
  /** A piece hit the ground. */
  landed(piece: Piece, speed: number): void;
  thrown(piece: Piece): void;
}

export class Debris {
  readonly active: Piece[] = [];

  constructor(private tuning: Tuning, private tornado: Tornado, private events: DebrisEvents) {}

  clear() {
    this.active.length = 0;
  }

  /** Sets a piece free. `pull` false lets it simply fall (it lost its support). */
  release(p: Piece, pull = true) {
    const fresh = p.state === State.Standing || p.state === State.Rest;
    if (!fresh) return;
    p.state = pull ? State.Loose : State.Thrown;
    p.t = 0;
    const r = Math.random;
    p.phase = r() * 6.283;
    p.orbit = 0.72 + r() * r() * 1.15;
    p.climb = (0.35 + r() * 0.65) / (0.6 + p.weight * 0.16);
    p.life = this.tuning.number("orbit_seconds", 5) * (0.55 + r() * 0.8) / (0.75 + p.weight * 0.07);
    const spin = 5 / (0.5 + p.weight);
    p.wx = (r() - 0.5) * spin;
    p.wy = (r() - 0.5) * spin;
    p.wz = (r() - 0.5) * spin;
    p.vy += pull ? 1.5 + r() * 2 : 0;
    this.active.push(p);
  }

  update(dt: number) {
    const limit = this.tuning.number("debris_limit", 700);
    const { active, tornado } = this;
    const gravity = this.tuning.number("gravity", 14);
    const orbitSpeed = this.tuning.number("orbit_speed", 26);
    const s = tornado.shape;
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      p.t += dt;
      const h = Math.min(1, Math.max(0, p.y / s.height));
      funnelAxis(s, h, axis);
      const dx = p.x - axis.x;
      const dz = p.z - axis.z;
      const r = Math.hypot(dx, dz) || 0.01;
      const R = funnelRadius(s, h);
      const nx = dx / r;
      const nz = dz / r;
      const power = tornado.power;

      if (p.state === State.Loose) {
        // Dragged in: swirling wind along the ground, stronger the closer it is.
        const near = Math.min(1.4, (tornado.reach * 1.2) / r);
        const grip = (2.6 * near) / (0.6 + p.weight * 0.35);
        const speed = (7 + power * 4.6) * near;
        p.vx += ((-nx * 0.72 - nz * 0.85) * speed - p.vx) * Math.min(1, grip * dt);
        p.vz += ((-nz * 0.72 + nx * 0.85) * speed - p.vz) * Math.min(1, grip * dt);
        p.vy += ((near * power * 2.6) / (0.5 + p.weight * 0.32) - gravity * 0.72) * dt;
        if (r < R * 1.35 + 2) {
          p.state = active.length > limit ? State.Thrown : State.Orbit;
          p.t = 0;
        } else if (p.t > PULL_LIMIT && r > tornado.reach * 1.6) p.state = State.Thrown;
      } else if (p.state === State.Orbit) {
        const big = Math.min(1, R / 22);
        const target = R * p.orbit + 1 + Math.sin(p.t * 1.3 + p.phase) * R * 0.12;
        const turn = Math.min(orbitSpeed * (0.55 + 0.2 * power) * (0.75 + 0.35 / (0.6 + p.weight * 0.2)), target * 3.4 + 4);
        const radial = Math.max(-26, Math.min(22, (target - r) * 2.6));
        const top = s.height * (0.16 + 0.6 * p.climb * (0.55 + 0.45 * big));
        const lift = (top * (0.6 + 0.4 * Math.sin(p.t * 0.8 + p.phase)) - p.y) * 0.75;
        const grip = Math.min(1, (3.4 / (0.75 + p.weight * 0.1)) * dt);
        p.vx += (-nz * turn + nx * radial + tornado.vx * 0.9 - p.vx) * grip;
        p.vz += (nx * turn + nz * radial + tornado.vz * 0.9 - p.vz) * grip;
        p.vy += (Math.min(20, Math.max(-6, lift)) - p.vy) * grip;
        // Hold the circle: turn the velocity with the orbit.
        const w = turn / Math.max(target, 2);
        p.vx -= nx * turn * w * dt;
        p.vz -= nz * turn * w * dt;
        if (p.t > p.life) {
          const force = this.tuning.number("throw_force", 1);
          p.state = State.Thrown;
          p.t = 0;
          p.vx += nx * (6 + Math.random() * 12) * force;
          p.vz += nz * (6 + Math.random() * 12) * force;
          p.vx *= 1.1;
          p.vz *= 1.1;
          p.vy = Math.max(p.vy, 2) + (3 + Math.random() * 9) * force;
          this.events.thrown(p);
        }
      } else {
        p.vy -= gravity * dt;
        const drag = Math.exp((-0.22 * dt) / (0.4 + p.weight));
        p.vx *= drag;
        p.vz *= drag;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.spin(p, dt);
      this.ground(p, dt);
      if (p.state === State.Rest) {
        active[i] = active[active.length - 1];
        active.pop();
      }
      writeMatrix(p);
    }
  }

  private spin(p: Piece, dt: number) {
    const gain = p.state === State.Orbit ? 1.5 : 1;
    const ax = p.wx * dt * 0.5 * gain;
    const ay = p.wy * dt * 0.5 * gain;
    const az = p.wz * dt * 0.5 * gain;
    const { qx, qy, qz, qw } = p;
    p.qx = qx + ax * qw + ay * qz - az * qy;
    p.qy = qy + ay * qw + az * qx - ax * qz;
    p.qz = qz + az * qw + ax * qy - ay * qx;
    p.qw = qw - ax * qx - ay * qy - az * qz;
    const l = 1 / Math.hypot(p.qx, p.qy, p.qz, p.qw);
    p.qx *= l; p.qy *= l; p.qz *= l; p.qw *= l;
  }

  private ground(p: Piece, dt: number) {
    const m = p.batch.matrices;
    const o = p.slot * 16;
    // Reach of the turned box below its centre (from last frame's matrix).
    const low = (Math.abs(m[o + 1]) * p.hx) / p.sx + (Math.abs(m[o + 5]) * p.hy) / p.sy + (Math.abs(m[o + 9]) * p.hz) / p.sz;
    const floor = p.batch.name === "tree" || p.batch.name === "pine" || p.batch.name === "bush" ? 0.4 : low;
    if (p.y >= floor || p.vy > 0.2) return;
    const impact = -p.vy;
    p.y = Math.max(p.y, floor);
    if (impact > 4) this.events.landed(p, impact + Math.hypot(p.vx, p.vz) * 0.3);
    p.vy = impact > 3 ? impact * 0.22 : 0;
    const rub = p.state === State.Thrown ? Math.exp(-3.4 * dt) * (impact > 3 ? 0.72 : 1) : Math.exp(-0.5 * dt);
    p.vx *= rub;
    p.vz *= rub;
    if (p.state !== State.Thrown) return;
    p.wx *= 0.9; p.wy *= 0.94; p.wz *= 0.9;
    this.settle(p, dt);
    if (p.vx * p.vx + p.vz * p.vz < 0.6 && impact < 1.5) {
      p.state = State.Rest;
      p.vx = p.vy = p.vz = p.wx = p.wy = p.wz = 0;
    }
  }

  /** Tips a lying piece onto its broad side. */
  private settle(p: Piece, dt: number) {
    const m = p.batch.matrices;
    const o = p.slot * 16;
    const thin = p.hx <= p.hy && p.hx <= p.hz ? 0 : p.hy <= p.hz ? 1 : 2;
    const scale = [p.sx, p.sy, p.sz][thin];
    const ax = m[o + thin * 4] / scale;
    const ay = m[o + thin * 4 + 1] / scale;
    const az = m[o + thin * 4 + 2] / scale;
    const sign = ay >= 0 ? 1 : -1;
    // Turn the thin axis towards straight up: axis × up.
    p.wx += -az * sign * 14 * dt;
    p.wz += ax * sign * 14 * dt;
  }
}
