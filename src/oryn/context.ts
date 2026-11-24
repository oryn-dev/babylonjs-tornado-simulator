import type { AudioEngineV2 } from "@babylonjs/core/AudioV2/abstractAudio/audioEngineV2";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene } from "@babylonjs/core/scene";
import type { Assets } from "./assets";
import type { Metric } from "./bridge";
import type { Input } from "./input";
import type { Look } from "./look";
import type { Tuning } from "./tuning";

export interface GameContext {
  engine: AbstractEngine;
  scene: Scene;
  canvas: HTMLCanvasElement;
  input: Input;
  look: Look;
  tuning: Tuning;
  assets: Assets;
  audio: AudioEngineV2;
  /** Publishes a value on `window.__ORYN__.metrics`, for tests and bots. */
  metric(name: string, value: Metric): void;
}

export interface Game {
  update(dt: number): void;
}

export interface GameMeta {
  /** The page title. */
  title: string;
}
