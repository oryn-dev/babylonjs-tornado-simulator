// The player's storm: where it goes, how strong it is, and the funnel shape that follows from both.
import type { Tuning } from "../../oryn/tuning";
import { createShape, type FunnelShape } from "../weather/state";
import { HALF } from "../world/plan";

/** Metres before the county line in which the storm is turned back. */
const EDGE = 48;

export type ShapeName = "auto" | "rope" | "cone" | "wedge";

export class Tornado {
  readonly shape: FunnelShape = createShape();
  vx = 0;
  vz = 0;
  /** 0..1 */
  growth = 0;
  energy = 0;
  surge = 0;
  charge = 0.35;
  /** Sandbox overrides: funnel radius in metres, wind 0..1, a fixed silhouette. */
  sandbox: { radius: number; wind: number } | null = null;
  silhouette: ShapeName = "auto";
  /** 0..1, how deep the storm is in the county's edge, where it is turned back. */
  edge = 0;
  private spin = 0;
  private surgeEase = 0;
  private wide = 0;

  constructor(private tuning: Tuning) {}

  private n(id: string) {
    return this.tuning.number(id, 1);
  }

  reset(x: number, z: number) {
    this.vx = this.vz = this.energy = this.growth = this.surge = this.surgeEase = this.wide = 0;
    this.charge = 0.35;
    this.shape.x = x;
    this.shape.z = z;
    this.shape.leanX = this.shape.leanZ = 0;
    this.shapeUp(1);
  }

  /** Wind strength in hold units; a piece with a lower hold is torn off. */
  get power() {
    return (this.n("power_start") + (this.n("power_full") - this.n("power_start")) * this.growth) + (this.surge > 0 ? this.n("surge_power") : 0);
  }

  get radius() {
    return this.shape.baseR;
  }

  get reach() {
    return this.shape.baseR * this.n("reach") + 3.5;
  }

  /** Enhanced Fujita rating, 0..5. */
  get ef() {
    return Math.min(5, Math.floor(this.growth * 5.0001));
  }

  /** Wind speed for the HUD, mph. */
  get windMph() {
    return Math.round(72 + 190 * this.growth + (this.surge > 0 ? 35 : 0));
  }

  feed(energy: number) {
    this.energy += energy;
    if (!this.sandbox) this.growth = Math.min(1, Math.pow(this.energy / this.n("growth_energy"), this.n("growth_curve")));
    if (this.surge <= 0) this.charge = Math.min(1, this.charge + energy / (this.n("surge_energy") * (0.22 + 0.78 * this.growth)));
  }

  trySurge() {
    if (this.charge < 1 || this.surge > 0) return false;
    this.surge = this.n("surge_seconds");
    this.charge = 0;
    return true;
  }

  update(dt: number, ax: number, az: number) {
    const s = this.shape;
    if (this.sandbox) this.growth += (this.sandbox.wind - this.growth) * Math.min(1, dt * 2);
    const g = this.growth;
    const speed = this.n("move_speed_small") + (this.n("move_speed_big") - this.n("move_speed_small")) * g;
    const k = 1 - Math.exp(-this.n("move_response") * dt);
    const rim = HALF - 18;
    const soft = (v: number) => Math.min(1, Math.max(0, (Math.abs(v) - rim + EDGE) / EDGE));
    const tx = soft(s.x);
    const tz = soft(s.z);
    const outward = (v: number, dir: number) => v * dir > 0;
    this.edge = Math.max(outward(s.x, ax) ? tx : 0, outward(s.z, az) ? tz : 0);
    ax = ax * (outward(s.x, ax) ? 1 - tx : 1) - Math.sign(s.x) * 0.9 * tx * tx;
    az = az * (outward(s.z, az) ? 1 - tz : 1) - Math.sign(s.z) * 0.9 * tz * tz;
    this.vx += (ax * speed - this.vx) * k;
    this.vz += (az * speed - this.vz) * k;
    s.x += this.vx * dt;
    s.z += this.vz * dt;
    if (Math.abs(s.x) > rim) {
      s.x = Math.sign(s.x) * rim;
      this.vx = 0;
    }
    if (Math.abs(s.z) > rim) {
      s.z = Math.sign(s.z) * rim;
      this.vz = 0;
    }
    if (this.surge > 0) this.surge = Math.max(0, this.surge - dt);
    else this.charge = Math.min(1, this.charge + this.n("surge_idle") * dt);
    this.shapeUp(dt);
  }

  private shapeUp(dt: number) {
    const s = this.shape;
    const g = this.growth;
    this.surgeEase += ((this.surge > 0 ? 1 : 0) - this.surgeEase) * Math.min(1, dt * 5);
    const boost = 1 + (this.n("surge_width") - 1) * this.surgeEase;
    const small = this.n("radius_small");
    const grown = small + (this.n("radius_big") - small) * Math.pow(g, 1.25);
    const radius = (this.sandbox ? this.sandbox.radius * (this.silhouette === "rope" ? 0.4 : 1) : grown) * boost;
    this.wide += (radius - this.wide) * Math.min(1, dt * 2.2);
    const pulse = 1 + Math.sin(s.time * 1.7) * 0.05 + Math.sin(s.time * 3.1) * 0.03;
    const auto = { rope: Math.max(0, 1 - g * 2.6), wedge: Math.max(0, (g - 0.55) / 0.45) };
    const rope = this.silhouette === "auto" ? auto.rope : this.silhouette === "rope" ? 1 : 0;
    const wedge = this.silhouette === "auto" ? auto.wedge : this.silhouette === "wedge" ? 1 : 0;
    s.time += dt;
    s.growth = g;
    s.height = this.n("height_small") + (this.n("height_big") - this.n("height_small")) * g;
    s.baseR = Math.max(1.2, this.wide * pulse);
    // A rope stays thin to the cloud, a cone opens upward, a wedge is as wide as it is tall.
    s.topR = s.baseR * (2.6 - 0.9 * rope - 1.15 * wedge) + s.height * (0.07 * (1 - rope) + 0.02 * rope + 0.04 * wedge);
    s.power = 1.35 - 0.2 * rope - 0.35 * wedge;
    s.flareR = s.height * (0.13 + 0.06 * rope);
    s.wobble = s.height * (0.015 + 0.055 * rope) + s.baseR * 0.06;
    s.dustR = s.baseR * (3.1 - 1.1 * wedge) + 6;
    s.dustH = s.height * (0.11 + 0.12 * g) + 3;
    s.density = Math.min(1, 0.55 + 0.5 * g + 0.2 * this.surgeEase);
    const lean = Math.min(1, dt * 0.9);
    s.leanX += (-this.vx * (0.75 + rope * 0.5) - s.leanX) * lean;
    s.leanZ += (-this.vz * (0.75 + rope * 0.5) - s.leanZ) * lean;
    this.spin += dt * (0.62 - 0.34 * g) * (1 + 0.5 * this.surgeEase);
    s.spin = this.spin % 512;
  }
}
