import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Logger } from "@babylonjs/core/Misc/logger";
import { splitSharedUniforms } from "./webgpu-shaders";

export type Renderer = "webgpu" | "webgl2";

type Started = { engine: AbstractEngine; renderer: Renderer; canvas: HTMLCanvasElement };

const OPTIONS = { antialias: true, stencil: true, powerPreference: "high-performance" } as const;
const WEBGPU_START_LIMIT_MS = 6000;
const handedOut = new WeakSet<HTMLCanvasElement>();

/** Starts WebGPU when the browser has a real GPU adapter, else WebGL2. The returned canvas is the one the engine draws on. */
export async function createEngine(canvas: HTMLCanvasElement): Promise<Started> {
  if (preferredRenderer() === "webgpu") {
    const engine = await startWebGPU(canvas).catch((error) => {
      console.warn("WebGPU failed, using WebGL2", error);
      return null;
    });
    if (engine) return { engine, renderer: "webgpu", canvas };
    // A canvas that handed out a WebGPU context never gives WebGL2, so that fallback draws on a fresh copy.
    // Without a GPU adapter the canvas stays, which keeps an older main.ts that holds its own canvas working.
    if (handedOut.has(canvas)) canvas = freshCanvas(canvas);
  }
  return { engine: new Engine(canvas, true, OPTIONS, false), renderer: "webgl2", canvas };
}

async function startWebGPU(canvas: HTMLCanvasElement): Promise<WebGPUEngine | null> {
  const adapter = await withinLimit(navigator.gpu?.requestAdapter({ powerPreference: OPTIONS.powerPreference }) ?? Promise.resolve(null));
  if (!adapter || adapter.info?.isFallbackAdapter) return null;
  splitSharedUniforms();
  handedOut.add(canvas);
  const engine = new WebGPUEngine(canvas, {
    ...OPTIONS,
    adaptToDeviceRatio: false,
    deviceDescriptor: { requiredFeatures: ["texture-formats-tier1"] },
  });
  // A failed start falls back to WebGL2, so Babylon's own error line would report a fault the game does not have.
  const levels = Logger.LogLevels;
  Logger.LogLevels = Logger.MessageLogLevel | Logger.WarningLogLevel;
  try {
    await withinLimit(engine.initAsync());
    return engine;
  } catch (error) {
    engine.dispose();
    throw error;
  } finally {
    Logger.LogLevels = levels;
  }
}

function withinLimit<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`WebGPU did not start within ${WEBGPU_START_LIMIT_MS} ms`)), WEBGPU_START_LIMIT_MS)),
  ]);
}

function freshCanvas(canvas: HTMLCanvasElement) {
  const copy = canvas.cloneNode(false) as HTMLCanvasElement;
  canvas.replaceWith(copy);
  return copy;
}

function preferredRenderer(): Renderer {
  const requested = new URLSearchParams(location.search).get("renderer");
  if (requested === "webgpu" || requested === "webgl2") return requested;
  return isWebKitOnly() ? "webgl2" : "webgpu";
}

function isWebKitOnly() {
  const agent = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(agent) && !/Chrome|Chromium|Edg|Android/.test(agent);
  return iOS || safari;
}
