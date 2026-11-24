// Two small PBR add-ons: texture coordinates in metres on scaled boxes, and leaves and crops that bend to the storm.
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Material } from "@babylonjs/core/Materials/material";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { Scene } from "@babylonjs/core/scene";

/** Live wind the foliage reads: storm x, z, reach, time, strength. */
export const WIND = { x: 0, z: 0, reach: 20, time: 0, power: 0.2 };

export class MetreUv extends MaterialPluginBase {
  constructor(material: Material, private perMetre: number) {
    super(material, "TwMetreUv", 190, { TW_METRE: false });
    this.registerForExtraEvents = true;
    this._enable(true);
  }
  override isCompatible() {
    return true;
  }
  override getClassName() {
    return "TwMetreUv";
  }
  override prepareDefines(defines: Record<string, unknown>) {
    defines.TW_METRE = true;
  }
  override getUniforms() {
    return { externalUniforms: ["twMetre"] };
  }
  override hardBindForSubMesh(_ubo: UniformBuffer, _scene: Scene, _engine: AbstractEngine, subMesh: SubMesh) {
    subMesh.effect?.setFloat("twMetre", this.perMetre);
  }
  override getCustomCode(shaderType: string, language?: number) {
    if (shaderType !== "vertex") return null;
    return language === 1
      ? { CUSTOM_VERTEX_DEFINITIONS: "uniform twMetre: f32;", CUSTOM_VERTEX_UPDATE_WORLDPOS: `#ifdef UV1
{ let twS = vec3f(length(finalWorld[0].xyz), length(finalWorld[1].xyz), length(finalWorld[2].xyz)) * positionUpdated * uniforms.twMetre; let twN = abs(normalUpdated);
if (twN.y > twN.x && twN.y > twN.z) { uvUpdated = twS.xz; } else if (twN.x > twN.z) { uvUpdated = twS.zy; } else { uvUpdated = twS.xy; } }
#endif` }
      : { CUSTOM_VERTEX_DEFINITIONS: "uniform float twMetre;", CUSTOM_VERTEX_UPDATE_WORLDPOS: `#ifdef UV1
{ vec3 twS = vec3(length(finalWorld[0].xyz), length(finalWorld[1].xyz), length(finalWorld[2].xyz)) * positionUpdated * twMetre; vec3 twN = abs(normalUpdated);
if (twN.y > twN.x && twN.y > twN.z) uvUpdated = twS.xz; else if (twN.x > twN.z) uvUpdated = twS.zy; else uvUpdated = twS.xy; }
#endif` };
  }
}

export class StormBend extends MaterialPluginBase {
  constructor(material: Material, private stiffness: number) {
    super(material, "TwStormBend", 191, { TW_BEND: false });
    this.registerForExtraEvents = true;
    this._enable(true);
  }
  override isCompatible() {
    return true;
  }
  override getClassName() {
    return "TwStormBend";
  }
  override prepareDefines(defines: Record<string, unknown>) {
    defines.TW_BEND = true;
  }
  override getUniforms() {
    return { externalUniforms: ["twWind", "twWind2"] };
  }
  override hardBindForSubMesh(_ubo: UniformBuffer, _scene: Scene, _engine: AbstractEngine, subMesh: SubMesh) {
    subMesh.effect?.setFloat4("twWind", WIND.x, WIND.z, WIND.reach, WIND.time);
    subMesh.effect?.setFloat4("twWind2", WIND.power, this.stiffness, 0, 0);
  }
  override getCustomCode(shaderType: string, language?: number) {
    if (shaderType !== "vertex") return null;
    return language === 1
      ? {
          CUSTOM_VERTEX_DEFINITIONS: "uniform twWind: vec4f; uniform twWind2: vec4f;",
          CUSTOM_VERTEX_UPDATE_WORLDPOS: `{ let twD = uniforms.twWind.xy - worldPos.xz; let twR = max(length(twD), 1.0); let twP = clamp(uniforms.twWind.z / twR, 0.0, 1.3); let twH = max(positionUpdated.y, 0.0) * length(finalWorld[1].xyz) * uniforms.twWind2.y; let twT = uniforms.twWind.w;
let twIn = twD / twR; let twGust = sin(twT * 2.3 + worldPos.x * 0.21 + worldPos.z * 0.17) * 0.5 + sin(twT * 5.1 + worldPos.x * 0.7) * 0.22;
let twB = (twIn * 0.75 + vec2f(-twIn.y, twIn.x) * 0.6) * twP * twP * 0.75 + vec2f(0.8, 0.5) * (0.08 + twGust * (0.1 + twP * 0.2)) * (0.6 + uniforms.twWind2.x);
worldPos.x += twB.x * twH; worldPos.z += twB.y * twH; worldPos.y -= dot(twB, twB) * twH * 0.35; vertexOutputs.vPositionW = worldPos.xyz; }`,
        }
      : {
          CUSTOM_VERTEX_DEFINITIONS: "uniform vec4 twWind; uniform vec4 twWind2;",
          CUSTOM_VERTEX_UPDATE_WORLDPOS: `{ vec2 twD = twWind.xy - worldPos.xz; float twR = max(length(twD), 1.0); float twP = clamp(twWind.z / twR, 0.0, 1.3); float twH = max(positionUpdated.y, 0.0) * length(finalWorld[1].xyz) * twWind2.y; float twT = twWind.w;
vec2 twIn = twD / twR; float twGust = sin(twT * 2.3 + worldPos.x * 0.21 + worldPos.z * 0.17) * 0.5 + sin(twT * 5.1 + worldPos.x * 0.7) * 0.22;
vec2 twB = (twIn * 0.75 + vec2(-twIn.y, twIn.x) * 0.6) * twP * twP * 0.75 + vec2(0.8, 0.5) * (0.08 + twGust * (0.1 + twP * 0.2)) * (0.6 + twWind2.x);
worldPos.x += twB.x * twH; worldPos.z += twB.y * twH; worldPos.y -= dot(twB, twB) * twH * 0.35; vPositionW = worldPos.xyz; }`,
        };
  }
}
