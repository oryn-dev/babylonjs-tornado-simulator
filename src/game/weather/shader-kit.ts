// Small helpers so each weather shader is one GLSL and one WGSL string with the same uniforms.
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
import type { Scene } from "@babylonjs/core/scene";

export interface ShaderSource {
  vertex: { glsl: string; wgsl: string };
  fragment: { glsl: string; wgsl: string };
}

export interface ShaderOptions {
  attributes?: string[];
  uniforms: string[];
  samplers?: string[];
  blend?: boolean;
  instances?: boolean;
}

export function shaderMaterial(scene: Scene, name: string, source: ShaderSource, options: ShaderOptions) {
  const wgsl = scene.getEngine().isWebGPU;
  const store = wgsl ? ShaderStore.ShadersStoreWGSL : ShaderStore.ShadersStore;
  store[`${name}VertexShader`] = wgsl ? source.vertex.wgsl : source.vertex.glsl;
  store[`${name}FragmentShader`] = wgsl ? source.fragment.wgsl : source.fragment.glsl;
  return new ShaderMaterial(name, scene, { vertex: name, fragment: name }, {
    attributes: options.attributes ?? ["position"],
    uniforms: options.uniforms,
    samplers: options.samplers ?? [],
    needAlphaBlending: options.blend ?? false,
    shaderLanguage: wgsl ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
  });
}

/** Uniform declarations from one list: `["time: f", "tw0: v4"]`. */
export function declare(list: string[]) {
  const glsl: Record<string, string> = { f: "float", v2: "vec2", v3: "vec3", v4: "vec4", m4: "mat4" };
  const wgsl: Record<string, string> = { f: "f32", v2: "vec2f", v3: "vec3f", v4: "vec4f", m4: "mat4x4f" };
  const parts = list.map((entry) => entry.split(":").map((s) => s.trim()) as [string, string]);
  return {
    names: parts.map(([name]) => name),
    glsl: parts.map(([name, type]) => `uniform ${glsl[type]} ${name};`).join("\n"),
    wgsl: parts.map(([name, type]) => `uniform ${name}: ${wgsl[type]};`).join("\n"),
  };
}

export const textures = (names: string[]) => ({
  glsl: names.map((n) => `uniform sampler2D ${n};`).join("\n"),
  wgsl: names.map((n) => `var ${n}Sampler: sampler; var ${n}: texture_2d<f32>;`).join("\n"),
});
