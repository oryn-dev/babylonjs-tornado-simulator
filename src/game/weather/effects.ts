// Dust, splinters, sparks and lightning on Babylon's particle systems. Bursts are queued, so one system serves them all.
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { Look } from "../../oryn/look";
import { STORM, type FunnelShape } from "./state";
import { tileFbm } from "./noise";

interface Burst {
  x: number; y: number; z: number; spread: number; left: number;
}

export class Effects {
  private ring: ParticleSystem;
  private scud: ParticleSystem;
  private dust: ParticleSystem;
  private chips: ParticleSystem;
  private sparks: ParticleSystem;
  private queues = new Map<ParticleSystem, Burst[]>();
  private bolt: Mesh | null = null;
  private boltLeft = 0;
  private nextBolt = 3;
  private boltMaterial: StandardMaterial;
  private sunBase: number;
  private ambientBase: number;
  shape!: FunnelShape;
  onThunder: (distance: number) => void = () => undefined;

  constructor(private scene: Scene, private look: Look, private scale: number) {
    const puff = puffTexture(scene);
    const chip = chipTexture(scene);
    this.ring = this.system("ring", 420 * scale, puff);
    this.ring.emitRate = 120 * scale;
    this.ring.minLifeTime = 1.1;
    this.ring.maxLifeTime = 2.4;
    this.ring.color1 = new Color4(0.34, 0.25, 0.16, 0.34);
    this.ring.color2 = new Color4(0.24, 0.19, 0.13, 0.28);
    this.ring.addColorGradient(0, new Color4(0.5, 0.41, 0.29, 0));
    this.ring.addColorGradient(0.25, new Color4(0.5, 0.41, 0.29, 0.26));
    this.ring.addColorGradient(1, new Color4(0.42, 0.36, 0.27, 0));
    this.ring.addSizeGradient(0, 0.4, 0.8);
    this.ring.addSizeGradient(1, 1.1, 2.1);
    this.ring.startPositionFunction = (_m, position) => {
      const s = this.shape;
      const a = Math.random() * 6.283;
      const r = s.dustR * (0.55 + Math.random() * 0.75);
      position.set(s.x + Math.cos(a) * r, 0.4 + Math.random() * 1.2, s.z + Math.sin(a) * r);
    };
    this.ring.startDirectionFunction = (_m, direction, particle) => {
      const s = this.shape;
      const dx = particle.position.x - s.x;
      const dz = particle.position.z - s.z;
      const r = Math.hypot(dx, dz) || 1;
      const v = 6 + s.baseR * 0.55;
      direction.set((-dz / r) * v - (dx / r) * v * 0.55, 0.6 + Math.random() * 1.6 + s.baseR * 0.05, (dx / r) * v - (dz / r) * v * 0.55);
    };

    // Ragged cloud circling the rim of the wall cloud.
    this.scud = this.system("scud", 90 * scale, puff);
    this.scud.emitRate = 18 * scale;
    this.scud.minLifeTime = 3;
    this.scud.maxLifeTime = 5;
    this.scud.addColorGradient(0, new Color4(0.13, 0.15, 0.145, 0));
    this.scud.addColorGradient(0.3, new Color4(0.13, 0.15, 0.145, 0.16));
    this.scud.addColorGradient(0.7, new Color4(0.11, 0.13, 0.125, 0.16));
    this.scud.addColorGradient(1, new Color4(0.1, 0.12, 0.115, 0));
    this.scud.addSizeGradient(0, 0.5, 0.9);
    this.scud.addSizeGradient(1, 0.9, 1.4);
    this.scud.startPositionFunction = (_m, position) => {
      const s = this.shape;
      const a = Math.random() * 6.283;
      const r = (s.topR + s.flareR) * (1.3 + Math.random() * 1.2);
      position.set(s.x + s.leanX + Math.cos(a) * r, s.height * (0.9 + Math.random() * 0.08), s.z + s.leanZ + Math.sin(a) * r);
    };
    this.scud.startDirectionFunction = (_m, direction, particle) => {
      const dx = particle.position.x - this.shape.x - this.shape.leanX;
      const dz = particle.position.z - this.shape.z - this.shape.leanZ;
      const r = Math.hypot(dx, dz) || 1;
      direction.set((-dz / r) * 7 - (dx / r) * 3, Math.random() - 0.2, (dx / r) * 7 - (dz / r) * 3);
    };

    this.dust = this.system("dust", 340 * scale, puff);
    this.dust.addColorGradient(0, new Color4(0.42, 0.38, 0.32, 0.55));
    this.dust.addColorGradient(1, new Color4(0.28, 0.25, 0.21, 0));
    this.dust.addSizeGradient(0, 1, 2.2);
    this.dust.addSizeGradient(1, 3, 6.5);
    this.dust.minLifeTime = 0.9;
    this.dust.maxLifeTime = 2.1;
    this.burstSystem(this.dust, 5, 0.6);

    this.chips = this.system("chips", 420 * scale, chip);
    this.chips.addColorGradient(0, new Color4(0.5, 0.4, 0.28, 1));
    this.chips.addColorGradient(0.8, new Color4(0.3, 0.25, 0.2, 1));
    this.chips.addColorGradient(1, new Color4(0.3, 0.25, 0.2, 0));
    this.chips.minLifeTime = 0.7;
    this.chips.maxLifeTime = 1.7;
    this.chips.minSize = 0.14;
    this.chips.maxSize = 0.55;
    this.chips.gravity = new Vector3(0, -11, 0);
    this.chips.minAngularSpeed = -9;
    this.chips.maxAngularSpeed = 9;
    this.burstSystem(this.chips, 11, 1);

    this.sparks = this.system("sparks", 160, puff);
    this.sparks.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.sparks.addColorGradient(0, new Color4(1.6, 2.6, 2.4, 1));
    this.sparks.addColorGradient(1, new Color4(0.2, 0.9, 0.8, 0));
    this.sparks.addSizeGradient(0, 1);
    this.sparks.addSizeGradient(1, 0.2);
    this.sparks.minLifeTime = 0.2;
    this.sparks.maxLifeTime = 0.7;
    this.sparks.minSize = 0.4;
    this.sparks.maxSize = 1.8;
    this.sparks.gravity = new Vector3(0, -9, 0);
    this.burstSystem(this.sparks, 7, 0.8);

    this.boltMaterial = new StandardMaterial("bolt", scene);
    this.boltMaterial.disableLighting = true;
    this.boltMaterial.emissiveColor = new Color3(7, 8, 10);
    this.boltMaterial.fogEnabled = false;
    this.sunBase = look.sun.intensity;
    this.ambientBase = look.ambient.intensity;
  }

  private system(name: string, capacity: number, texture: DynamicTexture) {
    const s = new ParticleSystem(name, Math.round(capacity), this.scene);
    s.particleTexture = texture;
    s.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    s.minInitialRotation = 0;
    s.maxInitialRotation = 6.283;
    s.minAngularSpeed = -0.8;
    s.maxAngularSpeed = 0.8;
    s.emitRate = 0;
    s.emitter = Vector3.Zero();
    s.updateSpeed = 1 / 60;
    return s;
  }

  private burstSystem(s: ParticleSystem, speed: number, up: number) {
    const queue: Burst[] = [];
    this.queues.set(s, queue);
    s.startPositionFunction = (_m, position) => {
      const b = queue[0];
      if (!b) return void position.set(0, -100, 0);
      position.set(b.x + (Math.random() - 0.5) * b.spread, b.y + (Math.random() - 0.3) * b.spread * 0.5, b.z + (Math.random() - 0.5) * b.spread);
      if (--b.left <= 0) queue.shift();
    };
    s.startDirectionFunction = (_m, direction) => {
      direction.set((Math.random() - 0.5) * 2 * speed, Math.random() * speed * up, (Math.random() - 0.5) * 2 * speed);
    };
    s.manualEmitCount = 0;
    s.start();
  }

  start() {
    this.ring.start();
    this.scud.start();
  }

  private queue(s: ParticleSystem, x: number, y: number, z: number, spread: number, count: number) {
    const n = Math.max(1, Math.round(count * this.scale));
    const queue = this.queues.get(s)!;
    if (queue.length > 24) return;
    queue.push({ x, y, z, spread, left: n });
    s.manualEmitCount = Math.max(0, s.manualEmitCount) + n;
  }

  smash(x: number, y: number, z: number, spread: number, amount: number) {
    this.queue(this.dust, x, y, z, spread, amount * 0.6);
    this.queue(this.chips, x, y, z, spread, amount);
  }

  spark(x: number, y: number, z: number) {
    this.queue(this.sparks, x, y, z, 1.4, 26);
  }

  update(dt: number, every: number) {
    const g = this.shape.growth;
    this.ring.emitRate = (70 + 90 * g) * this.scale;
    this.ring.minScaleX = this.ring.maxScaleX = this.ring.minScaleY = this.ring.maxScaleY = 4 + this.shape.baseR * 0.4;
    this.scud.minScaleX = this.scud.maxScaleX = 16 + this.shape.topR * 0.35;
    this.scud.minScaleY = this.scud.maxScaleY = 9 + this.shape.topR * 0.2;
    for (const [s, queue] of this.queues) if (!queue.length) s.manualEmitCount = 0;
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.nextBolt = every * (0.5 + Math.random()) * (1 - 0.35 * g);
      this.strike();
    }
    this.boltLeft -= dt;
    const on = this.boltLeft > 0 && (this.boltLeft > 0.22 || Math.random() > 0.4);
    if (this.bolt) this.bolt.isVisible = on && this.boltLeft > 0.04;
    STORM.flash = Math.max(0, Math.max(STORM.flash * Math.exp(-dt * 7), on ? 0.34 + Math.random() * 0.3 : 0) - 0.002);
    this.look.sun.intensity = this.sunBase * (1 - 0.42 * g) + STORM.flash * 0.9;
    this.look.ambient.intensity = this.ambientBase * (1 - 0.25 * g) + STORM.flash * 0.6;
  }

  private strike() {
    const camera = this.scene.activeCamera!;
    const forward = camera.getDirection(Vector3.Forward());
    const base = Math.atan2(forward.x, forward.z) + (Math.random() - 0.5) * 1.5;
    const distance = 420 + Math.random() * 420;
    const x = camera.globalPosition.x + Math.sin(base) * distance;
    const z = camera.globalPosition.z + Math.cos(base) * distance;
    STORM.flashX = Math.sin(base);
    STORM.flashZ = Math.cos(base);
    const path: Vector3[] = [];
    const top = this.shape.height + 60;
    let px = x + (Math.random() - 0.5) * 90;
    let pz = z;
    for (let i = 0; i <= 16; i++) {
      const f = i / 16;
      path.push(new Vector3(px + (x - px) * f, top * (1 - f), pz));
      px += (Math.random() - 0.5) * 24;
      pz += (Math.random() - 0.5) * 12;
    }
    this.bolt?.dispose();
    this.bolt = CreateTube("bolt", { path, radiusFunction: (i) => 1.1 - i * 0.045, tessellation: 5 }, this.scene);
    this.bolt.material = this.boltMaterial;
    this.bolt.isPickable = false;
    this.bolt.applyFog = false;
    this.boltLeft = 0.34 + Math.random() * 0.2;
    this.onThunder(distance);
  }
}

function puffTexture(scene: Scene) {
  const size = 128;
  const t = new DynamicTexture("puff", size, scene, true);
  const g = t.getContext() as CanvasRenderingContext2D;
  const image = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      const n = tileFbm(x / size, y / size, 4, 4, 5);
      const a = Math.max(0, Math.min(1, (1 - r) * 1.6)) * Math.max(0, Math.min(1, n * 2.1 - 0.35));
      image.data.set([255, 255, 255, a * 255], (y * size + x) * 4);
    }
  g.putImageData(image, 0, 0);
  t.update();
  t.hasAlpha = true;
  return t;
}

function chipTexture(scene: Scene) {
  const t = new DynamicTexture("chip", 32, scene, true);
  const g = t.getContext() as CanvasRenderingContext2D;
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(3, 12);
  g.lineTo(29, 9);
  g.lineTo(27, 18);
  g.lineTo(6, 21);
  g.fill();
  t.update();
  t.hasAlpha = true;
  return t;
}
