import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene } from "@babylonjs/core/scene";

type MetricValue = number | string | boolean;
export type Metric = MetricValue | Record<string, MetricValue>;

/** What the running game shows on `window.__ORYN__`, for tests and bots. */
export const bridge = {
  ready: false,
  frame: 0,
  fps: 0,
  renderer: "",
  errors: [] as string[],
  warnings: [] as string[],
  metrics: {} as Record<string, Metric>,
  /** The controls as the player has them now. */
  input: undefined as undefined | { device: string; touch: { visible: boolean; enabled: boolean } },
};

declare global {
  interface Window {
    __ORYN__: typeof bridge;
  }
}

window.__ORYN__ = bridge;

export function reportError(error: unknown) {
  if (bridge.errors.length < 50) bridge.errors.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}

export function setMetric(name: string, value: Metric) {
  bridge.metrics[name] = value;
}

window.addEventListener("error", (event) => reportError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => reportError(event.reason));

export function watchInput(input: { readonly device: string; readonly touch: { readonly state: { visible: boolean; enabled: boolean } } }) {
  Object.defineProperty(bridge, "input", { enumerable: true, get: () => ({ device: input.device, touch: input.touch.state }) });
}

export function watchFrames(engine: AbstractEngine, scene: Scene) {
  scene.onAfterRenderObservable.add(() => {
    bridge.frame += 1;
    bridge.fps = Math.round(engine.getFps());
    if (bridge.frame === 2) markReady();
  });
}

/** Tells a page that shows the game in a frame that it is up. */
function markReady() {
  bridge.ready = true;
  if (window.parent === window) return;
  for (const type of ["oryn:frameReady", "oryn:gameStarted"]) window.parent.postMessage({ type }, "*");
}
