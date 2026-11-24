import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { Tuning } from "../oryn/tuning";
import type { Tornado } from "./sim/tornado";

/** Behind and above the storm. Steering sideways swings it round; a drag looks around freely. */
export class StormCamera {
  readonly camera: TargetCamera;
  yaw = Math.PI / 4;
  private pitch = 0;
  private distance = 50;
  private x = 0;
  private z = 0;
  private shakeNow = 0;
  private time = 0;
  /** Extra distance and slow turning while the title or the result shows. */
  idle = false;

  constructor(scene: Scene, private tuning: Tuning, private tornado: Tornado) {
    this.camera = new TargetCamera("camera", new Vector3(0, 20, -50), scene);
    this.camera.minZ = 0.8;
    this.camera.maxZ = 2600;
    scene.activeCamera = this.camera;
  }

  snap() {
    this.x = this.tornado.shape.x;
    this.z = this.tornado.shape.z;
    this.distance = this.wantedDistance();
    this.pitch = 0;
  }

  kick(amount: number) {
    this.shakeNow = Math.min(1.6, this.shakeNow + amount);
  }

  private wantedDistance() {
    const small = this.tuning.number("camera_distance", 50);
    const big = this.tuning.number("camera_distance_big", 165);
    const width = Math.min(1.35, this.tornado.radius / this.tuning.number("radius_big", 36));
    return small + (big - small) * Math.pow(width, 0.8);
  }

  update(dt: number, steer: number, look: { x: number; y: number }) {
    const { camera, tornado } = this;
    const s = tornado.shape;
    this.time += dt;
    this.yaw += (this.idle ? 0.045 : steer * this.tuning.number("turn_rate", 0.6)) * dt + look.x * 0.004;
    if (!this.idle && tornado.edge > 0.2) {
      // Pushing on at the county line swings the view back towards the middle.
      const home = Math.atan2(-s.x, -s.z) - this.yaw;
      this.yaw += Math.atan2(Math.sin(home), Math.cos(home)) * Math.min(1, dt * 1.1 * tornado.edge);
    }
    this.pitch = Math.max(-0.22, Math.min(0.5, this.pitch + look.y * 0.003));
    if (!look.x && !look.y) this.pitch *= Math.exp(-dt * 0.35);
    const k = 1 - Math.exp(-dt * 4.2);
    this.x += (s.x - this.x) * k;
    this.z += (s.z - this.z) * k;
    const portrait = camera.getEngine().getAspectRatio(camera) < 1;
    camera.fov = portrait ? 1.12 : 0.86;
    this.distance += (this.wantedDistance() * (this.idle ? 1.25 : 1) * (portrait ? 1.12 : 1) - this.distance) * (1 - Math.exp(-dt * 1.6));
    const tilt = (this.idle ? 0.3 : this.tuning.number("camera_height", 0.36)) + this.pitch;
    const d = this.distance;
    // Never up through the cloud base.
    const height = Math.max(3, Math.min(d * Math.sin(tilt), s.height * 0.62));
    const flat = d * Math.cos(tilt);
    const base = this.tuning.number("shake", 1);
    const rumble = base * (0.05 + tornado.growth * 0.35 + (tornado.surge > 0 ? 0.45 : 0) + this.shakeNow);
    this.shakeNow *= Math.exp(-dt * 3.2);
    const sx = (Math.sin(this.time * 31) + Math.sin(this.time * 47.3)) * 0.22 * rumble;
    const sy = (Math.sin(this.time * 37.7) + Math.sin(this.time * 53.1)) * 0.2 * rumble;
    camera.position.set(this.x - Math.sin(this.yaw) * flat + sx, height + sy, this.z - Math.cos(this.yaw) * flat);
    camera.setTarget(new Vector3(this.x + sx * 0.4, Math.min(s.height * 0.34, d * (this.idle ? 0.3 : 0.28)) + sy * 0.3, this.z));
  }

  /** A stick direction as a world direction. */
  move(x: number, y: number) {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return { x: x * c + y * s, z: -x * s + y * c };
  }
}
