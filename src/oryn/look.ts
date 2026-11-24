import type { Camera } from "@babylonjs/core/Cameras/camera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Engines/Extensions/engine.multiRender";
import "@babylonjs/core/Engines/Extensions/engine.rawTexture";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.multiRender";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.rawTexture";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Materials/Textures/baseTexture.polynomial";
import { CubeMapToSphericalPolynomialTools } from "@babylonjs/core/Misc/HighDynamicRange/cubemapToSphericalPolynomial";
import { ColorGradingTexture } from "@babylonjs/core/Materials/Textures/colorGradingTexture";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { HDRFiltering } from "@babylonjs/core/Materials/Textures/Filtering/hdrFiltering";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { ReflectionProbe } from "@babylonjs/core/Probes/reflectionProbe";
import { RenderingGroup } from "@babylonjs/core/Rendering/renderingGroup";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/ShadersWGSL/geometry.fragment";
import file from "../../game/look.json";
import { assetUrl } from "./assets";
import type { Quality } from "./settings";

export type ToneMapping = "aces" | "neutral" | "standard" | "none";

export interface LookConfig {
  sky: { top: string; horizon: string; bottom: string };
  environment: { intensity: number; texture?: string };
  sun: { direction: [number, number, number]; color: string; intensity: number };
  ambient: { sky: string; ground: string; intensity: number };
  fog: { color: string; density: number };
  toneMapping: ToneMapping;
  exposure: number;
  contrast: number;
  saturation: number;
  shadows: { enabled: boolean; distance: number; darkness: number };
  bloom: { enabled: boolean; threshold: number; weight: number; kernel: number };
  vignette: number;
  /** Blur in front of and behind `focusDistance` metres; medium and high quality. */
  depthOfField: { enabled: boolean; focusDistance: number; fStop: number };
  /** `temperature` −1 cool to 1 warm, `tint` −1 green to 1 magenta; `lut` a .3dl or PNG colour lookup under public/assets/. */
  grade: { temperature: number; tint: number; lut?: string };
  /** Edge sharpening, 0 off; medium and high quality. */
  sharpen: number;
  /** Film grain, 0 off. */
  grain: number;
}

export const DEFAULT_LOOK: LookConfig = {
  sky: { top: "#4f86c6", horizon: "#cfe0ec", bottom: "#8a8f86" },
  environment: { intensity: 1 },
  sun: { direction: [0.45, -0.7, 0.55], color: "#fff1dc", intensity: 3 },
  ambient: { sky: "#cfe3ff", ground: "#5d5a4e", intensity: 0.25 },
  fog: { color: "#cbd9e3", density: 0.009 },
  toneMapping: "aces",
  exposure: 1,
  contrast: 1.1,
  saturation: 1,
  shadows: { enabled: true, distance: 60, darkness: 0.25 },
  bloom: { enabled: true, threshold: 0.85, weight: 0.25, kernel: 48 },
  vignette: 0.3,
  depthOfField: { enabled: false, focusDistance: 20, fStop: 2.8 },
  grade: { temperature: 0, tint: 0 },
  sharpen: 0.2,
  grain: 0,
};

const TONE_MAPPING: Record<Exclude<ToneMapping, "none">, number> = {
  aces: ImageProcessingConfiguration.TONEMAPPING_ACES,
  neutral: ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL,
  standard: ImageProcessingConfiguration.TONEMAPPING_STANDARD,
};

const QUALITY = {
  low: { pixelRatio: 0.8, shadowMap: 0, cascades: 0, samples: 1, fxaa: true, bloom: false, lens: false },
  medium: { pixelRatio: 1.5, shadowMap: 1024, cascades: 2, samples: 1, fxaa: true, bloom: true, lens: true },
  high: { pixelRatio: 2, shadowMap: 2048, cascades: 3, samples: 4, fxaa: false, bloom: true, lens: true },
} satisfies Record<Quality, unknown>;

/** Screen effects a game with its own rendering keeps; each is off unless it turns it back on. */
export interface PixelEffects {
  fxaa: boolean;
  msaa: boolean;
  bloom: boolean;
  sharpen: boolean;
  grain: boolean;
  depthOfField: boolean;
}

const PIXEL_EFFECTS: PixelEffects = { fxaa: false, msaa: false, bloom: false, sharpen: false, grain: false, depthOfField: false };

/** Hues in radians the grade leans towards: warm orange, and magenta for a positive tint. */
const WARM = (35 * Math.PI) / 180;
const MAGENTA = (300 * Math.PI) / 180;
/** The sky dome sits at this share of the far plane; a camera without one gets INFINITE_SKY. */
const SKY_SHARE = 0.9;
const INFINITE_SKY = 100000;

export function readLook(override: unknown = file): LookConfig {
  return merge(DEFAULT_LOOK, override) as LookConfig;
}

export class Look {
  readonly sun: DirectionalLight;
  readonly ambient: HemisphericLight;
  readonly pipeline: DefaultRenderingPipeline;
  shadows: CascadedShadowGenerator | null = null;

  private casters = new Set<AbstractMesh>();
  private quality: Quality = "high";
  private pixel: PixelEffects | null = null;

  constructor(private scene: Scene, readonly config: LookConfig = readLook()) {
    const { sun, ambient, fog } = config;
    this.sun = new DirectionalLight("sun", new Vector3(...sun.direction).normalize(), scene);
    this.sun.diffuse = Color3.FromHexString(sun.color);
    this.sun.intensity = sun.intensity;
    this.sun.position = this.sun.direction.scale(-80);

    this.ambient = new HemisphericLight("ambient", Vector3.Up(), scene);
    this.ambient.diffuse = Color3.FromHexString(ambient.sky);
    this.ambient.groundColor = Color3.FromHexString(ambient.ground);
    this.ambient.intensity = ambient.intensity;
    this.ambient.specular = Color3.Black();

    scene.clearColor = Color4.FromHexString(`${config.sky.horizon}ff`).toLinearSpace();
    scene.fogMode = fog.density > 0 ? Scene.FOGMODE_EXP2 : Scene.FOGMODE_NONE;
    scene.fogDensity = fog.density;
    scene.fogColor = Color3.FromHexString(fog.color).toLinearSpace();

    this.createEnvironment();
    this.pipeline = this.createPipeline();
    this.setQuality(this.quality);
  }

  castShadows(...meshes: AbstractMesh[]) {
    for (const mesh of meshes.flatMap((mesh) => [mesh, ...mesh.getChildMeshes()])) {
      this.casters.add(mesh);
      mesh.receiveShadows = true;
      this.shadows?.addShadowCaster(mesh, false);
      mesh.onDisposeObservable.addOnce(() => this.casters.delete(mesh));
    }
  }

  receiveShadows(...meshes: AbstractMesh[]) {
    meshes.flatMap((mesh) => [mesh, ...mesh.getChildMeshes()]).forEach((mesh) => (mesh.receiveShadows = true));
  }

  /**
   * For a game that sets its own render resolution: effects stay off whatever the quality asks, except those `keep` turns back on. `null` returns to the quality's own choice.
   */
  setPixel(keep: Partial<PixelEffects> | null = {}) {
    this.pixel = keep && { ...PIXEL_EFFECTS, ...keep };
    this.setQuality(this.quality);
  }

  setQuality(quality: Quality) {
    this.quality = quality;
    const level = QUALITY[quality];
    const engine = this.scene.getEngine();
    if (!this.pixel) engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, level.pixelRatio));
    this.pipeline.samples = this.allows("msaa") ? level.samples : 1;
    this.pipeline.fxaaEnabled = level.fxaa && this.allows("fxaa");
    this.pipeline.bloomEnabled = this.wantsBloom();
    this.syncLens();
    this.createShadows(level.shadowMap, level.cascades);
  }

  private wantsBloom() {
    return this.config.bloom.enabled && QUALITY[this.quality].bloom && this.allows("bloom");
  }

  /** Whether an effect is left to the quality setting. */
  private allows(effect: keyof PixelEffects) {
    return !this.pixel || this.pixel[effect];
  }

  /** Depth of field and sharpening follow the quality; grain stays on every preset. */
  private syncLens() {
    const lens = QUALITY[this.quality].lens;
    // Depth of field needs a camera's depth, so it waits for the first one.
    this.pipeline.depthOfFieldEnabled = lens && this.config.depthOfField.enabled && this.pipeline.cameras.length > 0 && this.allows("depthOfField");
    this.pipeline.sharpenEnabled = lens && this.config.sharpen > 0 && this.allows("sharpen");
    this.pipeline.grainEnabled = this.config.grain > 0 && this.allows("grain");
  }

  private createShadows(mapSize: number, cascades: number) {
    this.shadows?.dispose();
    this.shadows = null;
    const { enabled, distance, darkness } = this.config.shadows;
    if (!enabled || mapSize === 0) return;
    const shadows = new CascadedShadowGenerator(mapSize, this.sun);
    shadows.numCascades = cascades;
    shadows.shadowMaxZ = distance;
    shadows.lambda = 0.75;
    shadows.stabilizeCascades = true;
    shadows.depthClamp = true;
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = CascadedShadowGenerator.QUALITY_MEDIUM;
    shadows.darkness = darkness;
    shadows.bias = 0.006;
    shadows.normalBias = 0.03;
    this.casters.forEach((mesh) => shadows.addShadowCaster(mesh, false));
    this.shadows = shadows;
  }

  private createPipeline() {
    const { config, scene } = this;
    const pipeline = new DefaultRenderingPipeline("look", true, scene, scene.activeCamera ? [scene.activeCamera] : []);
    const image = pipeline.imageProcessing;
    pipeline.imageProcessingEnabled = true;
    image.toneMappingEnabled = config.toneMapping !== "none";
    if (config.toneMapping !== "none") image.toneMappingType = TONE_MAPPING[config.toneMapping];
    image.exposure = config.exposure;
    image.contrast = config.contrast;
    image.vignetteEnabled = config.vignette > 0;
    image.vignetteWeight = config.vignette * 4;
    image.vignetteColor = new Color4(0, 0, 0, 0);
    if (config.saturation !== 1) {
      image.colorCurvesEnabled = true;
      image.colorCurves!.globalSaturation = (config.saturation - 1) * 100;
    }
    pipeline.bloomThreshold = config.bloom.threshold;
    pipeline.bloomWeight = config.bloom.weight;
    pipeline.bloomKernel = config.bloom.kernel;
    pipeline.bloomScale = 0.5;
    pipeline.depthOfField.focusDistance = config.depthOfField.focusDistance * 1000;
    pipeline.depthOfField.fStop = config.depthOfField.fStop;
    pipeline.sharpen.edgeAmount = config.sharpen;
    pipeline.grain.intensity = config.grain * 30;
    pipeline.grain.animated = true;
    this.grade(image);
    scene.onActiveCameraChanged.add(() => scene.activeCamera && this.attach(scene.activeCamera));
    return pipeline;
  }

  /** Temperature and tint as a hue the colour curves lean towards; a LUT on top of them. */
  private grade(image: DefaultRenderingPipeline["imageProcessing"]) {
    const { temperature, tint, lut } = this.config.grade;
    const x = temperature * Math.cos(WARM) + tint * Math.cos(MAGENTA);
    const y = temperature * Math.sin(WARM) + tint * Math.sin(MAGENTA);
    if (x || y) {
      image.colorCurvesEnabled = true;
      image.colorCurves!.globalHue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      image.colorCurves!.globalDensity = Math.min(100, Math.hypot(x, y) * 40);
    }
    if (!lut) return;
    const url = assetUrl(lut);
    image.colorGradingTexture = lut.toLowerCase().endsWith(".3dl")
      ? new ColorGradingTexture(url, this.scene)
      : Object.assign(new Texture(url, this.scene, true, false), { wrapU: Texture.CLAMP_ADDRESSMODE, wrapV: Texture.CLAMP_ADDRESSMODE });
    image.colorGradingEnabled = true;
  }

  private attach(camera: Camera) {
    if (!this.pipeline.cameras.includes(camera)) this.pipeline.addCamera(camera);
    this.syncLens();
  }

  private createEnvironment() {
    const { scene, config } = this;
    scene.environmentIntensity = config.environment.intensity;
    const sky = this.createSky();
    if (config.environment.texture) {
      scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(assetUrl(config.environment.texture), scene);
      return;
    }
    // The sky light is taken once. Not in this call: the game sets up its camera first.
    void Promise.resolve().then(() => {
      const probe = new ReflectionProbe("sky-probe", 128, scene, true, true, true);
      probe.renderList!.push(sky);
      probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      scene.customRenderTargets.push(probe.cubeTexture);
      probe.cubeTexture.onAfterRenderObservable.addOnce(() => {
        scene.customRenderTargets.splice(scene.customRenderTargets.indexOf(probe.cubeTexture), 1);
        this.bakeEnvironment(probe.cubeTexture).catch((error) => console.warn("Sky environment failed", error));
      });
    });
  }

  private async bakeEnvironment(texture: RenderTargetTexture) {
    const polynomial = await CubeMapToSphericalPolynomialTools.ConvertCubeMapTextureToSphericalPolynomial(texture);
    await new HDRFiltering(this.scene.getEngine()).prefilter(texture);
    texture.sphericalPolynomial = polynomial;
    this.scene.environmentTexture = texture;
  }

  private createSky() {
    const { scene, config } = this;
    const gradient = new DynamicTexture("sky-gradient", { width: 4, height: 256 }, scene, false);
    const context = gradient.getContext();
    const fill = context.createLinearGradient(0, 256, 0, 0);
    fill.addColorStop(0, config.sky.top);
    fill.addColorStop(0.3, config.sky.top);
    fill.addColorStop(0.49, config.sky.horizon);
    fill.addColorStop(0.51, config.sky.horizon);
    fill.addColorStop(1, config.sky.bottom);
    context.fillStyle = fill;
    context.fillRect(0, 0, 4, 256);
    gradient.update();

    const material = new StandardMaterial("sky", scene);
    material.emissiveTexture = gradient;
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.fogEnabled = false;
    // Drawn first and leaving no depth, so the world shows wherever it is, however far.
    material.disableDepthWrite = true;

    const sky = CreateSphere("sky", { diameter: 2, segments: 48, sideOrientation: 1 }, scene);
    sky.material = material;
    sky.infiniteDistance = true;
    sky.isPickable = false;
    sky.applyFog = false;
    scene.setRenderingOrder(0, (a, b) => Number(b.getMesh() === sky) - Number(a.getMesh() === sky) || RenderingGroup.PainterSortCompare(a, b));
    // Just inside each camera's far plane, so the sky is never in front of the world. Fitted before
    // the frame too, for the reflection probes that render with the active camera's planes.
    const fit = (camera: Camera | null) => camera && sky.scaling.setAll(SKY_SHARE * (camera.maxZ || INFINITE_SKY));
    scene.onBeforeRenderObservable.add(() => fit(scene.activeCamera));
    scene.onBeforeCameraRenderObservable.add(fit);
    return sky;
  }
}

function merge(base: unknown, override: unknown): unknown {
  if (!isRecord(base) || !isRecord(override)) return override === undefined ? base : override;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) result[key] = merge(base[key], value);
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
