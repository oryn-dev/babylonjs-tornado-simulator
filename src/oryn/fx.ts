import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { VolumetricLightScatteringPostProcess } from "@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess";
import type { Scene } from "@babylonjs/core/scene";
import type { Look } from "./look";

export type AmbientKind = "fireflies" | "leaves" | "dust" | "snow" | "rain" | "embers";
export type BurstKind = "sparkle" | "pickup" | "hit" | "dust" | "explosion";
type Shape = "dot" | "leaf";

interface Preset {
  shape: Shape;
  /** Particles a second for ambient, particles per burst. */
  amount: number;
  life: [number, number];
  size: [number, number];
  speed: [number, number];
  gravity: number;
  colors: [string, string];
  additive: boolean;
  /** Ambient: the box around the camera they live in, metres. Burst: how far they fly out. */
  spread: number;
  spin?: number;
  stretched?: boolean;
}

const AMBIENT: Record<AmbientKind, Preset> = {
  fireflies: { shape: "dot", amount: 14, life: [3, 6], size: [0.04, 0.09], speed: [0.05, 0.25], gravity: 0, colors: ["#fff3a0", "#9dff7a"], additive: true, spread: 24 },
  leaves: { shape: "leaf", amount: 10, life: [5, 9], size: [0.12, 0.24], speed: [0.2, 0.6], gravity: -0.35, colors: ["#d8642a", "#e9b04a"], additive: false, spread: 26, spin: 2.5 },
  dust: { shape: "dot", amount: 20, life: [4, 8], size: [0.02, 0.05], speed: [0.02, 0.12], gravity: 0, colors: ["#fff6e0", "#ffe2b0"], additive: true, spread: 14 },
  snow: { shape: "dot", amount: 160, life: [5, 8], size: [0.04, 0.09], speed: [0.1, 0.3], gravity: -1.2, colors: ["#ffffff", "#e8f1ff"], additive: false, spread: 30 },
  rain: { shape: "dot", amount: 900, life: [0.6, 0.9], size: [0.02, 0.03], speed: [0.2, 0.4], gravity: -28, colors: ["#c9d8ff", "#a9bde8"], additive: true, spread: 26, stretched: true },
  embers: { shape: "dot", amount: 24, life: [2, 4], size: [0.03, 0.08], speed: [0.2, 0.6], gravity: 0.8, colors: ["#ffb347", "#ff5a1f"], additive: true, spread: 12 },
};

const BURST: Record<BurstKind, Preset> = {
  sparkle: { shape: "dot", amount: 24, life: [0.3, 0.7], size: [0.05, 0.12], speed: [1.5, 3.5], gravity: -1, colors: ["#ffffff", "#ffe48a"], additive: true, spread: 0.2 },
  pickup: { shape: "dot", amount: 18, life: [0.4, 0.8], size: [0.06, 0.14], speed: [1, 2.5], gravity: 2.5, colors: ["#fff6b0", "#7dffd8"], additive: true, spread: 0.3 },
  hit: { shape: "dot", amount: 20, life: [0.15, 0.35], size: [0.06, 0.16], speed: [3, 6], gravity: -4, colors: ["#ffffff", "#ff6a3d"], additive: true, spread: 0.1 },
  dust: { shape: "dot", amount: 14, life: [0.5, 1], size: [0.25, 0.6], speed: [0.6, 1.4], gravity: 0.3, colors: ["#d9c7a8", "#a8957a"], additive: false, spread: 0.4 },
  explosion: { shape: "dot", amount: 70, life: [0.4, 1.1], size: [0.3, 0.9], speed: [3, 9], gravity: -2, colors: ["#fff1b0", "#ff4a12"], additive: true, spread: 0.5 },
};

const TEXTURE_SIZE = 64;
/** Metres around the camera ambient particles keep clear of. */
const NEAR = 4;

/**
 * Ready effects on Babylon's own systems, on WebGPU and WebGL2: ambient particles around the camera (fireflies,
 * falling leaves, dust motes, snow, rain, embers), short bursts where something happens, a glow on emissive
 * things and god rays from the sun. Each preset takes a colour pair to fit the game's palette.
 */
export class Fx {
  private textures = new Map<Shape, DynamicTexture>();
  private bursts = new Map<string, ParticleSystem>();

  constructor(private scene: Scene, private look: Look) {}

  /** Particles that live around the camera all the time; `colors` replaces the preset's pair, `amount` scales it. */
  ambient(kind: AmbientKind, options: { colors?: [string, string]; amount?: number } = {}) {
    const preset = { ...AMBIENT[kind], ...(options.colors ? { colors: options.colors } : {}) };
    const rate = preset.amount * (options.amount ?? 1);
    const system = this.system(`ambient ${kind}`, preset, Math.ceil(rate * preset.life[1] * 1.2));
    const half = preset.spread / 2;
    const top = preset.gravity < 0 ? preset.spread * 0.6 : half;
    system.minEmitBox = new Vector3(-half, preset.gravity < -5 ? top : -half * 0.3, -half);
    system.maxEmitBox = new Vector3(half, top, half);
    system.emitRate = rate;
    system.preWarmCycles = 60;
    system.preWarmStepOffset = 10;
    const at = new Vector3();
    system.emitter = at;
    // Never right at the lens, where a mote fills the screen.
    system.startPositionFunction = (_matrix, position) => {
      const box = system.maxEmitBox, low = system.minEmitBox;
      position.set(low.x + Math.random() * (box.x - low.x), low.y + Math.random() * (box.y - low.y), low.z + Math.random() * (box.z - low.z));
      const flat = Math.hypot(position.x, position.z);
      if (flat < NEAR) position.scaleInPlace(flat > 0.01 ? NEAR / flat : 1).addInPlaceFromFloats(flat > 0.01 ? 0 : NEAR, 0, 0);
      position.addInPlace(at);
    };
    this.scene.onBeforeRenderObservable.add(() => {
      const camera = this.scene.activeCamera;
      if (camera) at.copyFrom(camera.globalPosition);
    });
    system.start();
    return system;
  }

  /** A short burst at `position`: a pickup, a hit, a landing, an explosion. Reuses one system per kind and colour. */
  burst(kind: BurstKind, position: Vector3, colors?: [string, string]) {
    const preset = { ...BURST[kind], ...(colors ? { colors } : {}) };
    const key = `${kind} ${preset.colors.join(" ")}`;
    let system = this.bursts.get(key);
    if (!system) {
      system = this.system(`burst ${key}`, preset, preset.amount * 4);
      system.minEmitBox = new Vector3(-preset.spread, -preset.spread, -preset.spread);
      system.maxEmitBox = new Vector3(preset.spread, preset.spread, preset.spread);
      system.direction1 = new Vector3(-1, 0.4, -1);
      system.direction2 = new Vector3(1, 1.2, 1);
      system.emitRate = 0;
      system.emitter = new Vector3();
      system.start();
      this.bursts.set(key, system);
    }
    (system.emitter as Vector3).copyFrom(position);
    system.manualEmitCount = preset.amount;
  }

  /** Emissive materials glow past their edges: berries, lanterns, magic, neon. */
  glow(intensity = 0.6) {
    const layer = new GlowLayer("fx glow", this.scene, { mainTextureSamples: 2 });
    layer.intensity = intensity;
    return layer;
  }

  /** Light shafts from the sun through trees, windows and fog, seen when the camera faces the sun. */
  godRays(camera: Camera, options: { color?: string; strength?: number } = {}) {
    const rays = new VolumetricLightScatteringPostProcess("fx god rays", 1, camera, undefined, 80, undefined, this.scene.getEngine(), false, this.scene);
    const sun = rays.mesh;
    const color = Color3.FromHexString(options.color ?? this.look.config.sun.color);
    if (sun.material && "diffuseColor" in sun.material) (sun.material as { diffuseColor: Color3 }).diffuseColor = color;
    sun.scaling.setAll(18);
    rays.weight = 0.4 * (options.strength ?? 1);
    rays.exposure = 0.25;
    rays.decay = 0.97;
    rays.density = 0.9;
    this.scene.onBeforeRenderObservable.add(() => {
      sun.position.copyFrom(camera.globalPosition.subtract(this.look.sun.direction.scale(400)));
    });
    return rays;
  }

  private system(name: string, preset: Preset, capacity: number) {
    const system = new ParticleSystem(name, capacity, this.scene);
    system.particleTexture = this.texture(preset.shape);
    const [from, to] = preset.colors.map((hex) => Color4.FromColor3(Color3.FromHexString(hex), 1));
    system.color1 = from;
    system.color2 = to;
    system.colorDead = new Color4(to.r, to.g, to.b, 0);
    system.minLifeTime = preset.life[0];
    system.maxLifeTime = preset.life[1];
    system.minSize = preset.size[0];
    system.maxSize = preset.size[1];
    system.minEmitPower = preset.speed[0];
    system.maxEmitPower = preset.speed[1];
    system.gravity = new Vector3(0, preset.gravity, 0);
    system.direction1 = new Vector3(-1, -1, -1);
    system.direction2 = new Vector3(1, 1, 1);
    system.blendMode = preset.additive ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    if (preset.spin) {
      system.minAngularSpeed = -preset.spin;
      system.maxAngularSpeed = preset.spin;
      system.minInitialRotation = 0;
      system.maxInitialRotation = Math.PI * 2;
    }
    if (preset.stretched) system.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    system.addSizeGradient(0, 0.6);
    system.addSizeGradient(0.2, 1);
    system.addSizeGradient(1, 0.8);
    return system;
  }

  private texture(shape: Shape) {
    let texture = this.textures.get(shape);
    if (texture) return texture;
    texture = new DynamicTexture(`fx ${shape}`, TEXTURE_SIZE, this.scene, true);
    texture.hasAlpha = true;
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    const middle = TEXTURE_SIZE / 2;
    if (shape === "dot") {
      const gradient = ctx.createRadialGradient(middle, middle, 0, middle, middle, middle);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.35, "rgba(255,255,255,0.6)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    } else {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(middle, middle, middle * 0.45, middle * 0.9, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    texture.update();
    this.textures.set(shape, texture);
    return texture;
  }
}
