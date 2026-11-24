// Picks what this game draws per quality level, and steps down by itself when frames run long.
import type { Scene } from "@babylonjs/core/scene";
import type { Look } from "../oryn/look";
import { settings, type Quality } from "../oryn/settings";
import type { Funnel } from "./weather/funnel";

const LEVELS: Record<Quality, { base: Quality; pixels: number; samples: number; steps: number; shadow: number }> = {
  low: { base: "low", pixels: 0.85, samples: 1, steps: 32, shadow: 0 },
  medium: { base: "medium", pixels: 1.25, samples: 1, steps: 56, shadow: 200 },
  high: { base: "medium", pixels: 1.6, samples: 4, steps: 96, shadow: 300 },
};
const ORDER: Quality[] = ["low", "medium", "high"];

export class QualityControl {
  level: Quality;
  private frames = 0;
  private clock = 0;
  private slow = 0;

  constructor(private scene: Scene, private look: Look, private funnel: Funnel, phone: boolean) {
    this.level = phone && settings.quality === "high" ? "medium" : settings.quality;
    this.apply();
  }

  choose(level: Quality) {
    this.level = level;
    this.slow = -3;
    this.apply();
  }

  apply() {
    const l = LEVELS[this.level];
    this.look.setQuality(l.base);
    this.look.pipeline.samples = l.samples;
    this.look.pipeline.fxaaEnabled = true;
    this.scene.getEngine().setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, l.pixels));
    if (this.look.shadows) this.look.shadows.shadowMaxZ = l.shadow;
    this.funnel.steps = l.steps;
  }

  update(dt: number, playing: boolean) {
    if (!playing) return;
    this.frames++;
    this.clock += dt;
    if (this.clock < 2) return;
    const fps = this.frames / this.clock;
    this.frames = this.clock = 0;
    this.slow = fps < 40 ? this.slow + 1 : Math.min(0, this.slow);
    if (this.slow < 2 || this.level === "low") return;
    this.slow = -2;
    this.level = ORDER[ORDER.indexOf(this.level) - 1];
    this.apply();
  }
}
