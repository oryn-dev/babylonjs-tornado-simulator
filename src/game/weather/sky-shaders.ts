import { declare, textures, type ShaderSource } from "./shader-kit";

const LIGHT = ["sun: v3", "horizonBright: v3", "horizonDark: v3", "zenith: v3", "fog: v3", "cloudLight: v3", "cloudDark: v3", "flash: v4"];
const skyU = declare(["worldViewProjection: m4", ...LIGHT]);
const deckU = declare(["world: m4", "viewProjection: m4", "eye: v3", "shape: v4", ...LIGHT]);
const tex = textures(["noiseTex"]);
export const SKY_UNIFORMS = skyU.names;
export const DECK_UNIFORMS = deckU.names;

/** flash = direction x, z, strength, time. */
const SKY_GLSL = `
vec3 skyColor(vec3 d) {
  float y = d.y;
  vec2 az = normalize(d.xz + 1e-5);
  float toSun = dot(az, normalize(sun.xz)) * 0.5 + 0.5;
  float slot = 0.16 + 0.84 * pow(toSun, 2.0);
  float ang = atan(az.y, az.x) * 0.1591549;
  float n = textureLod(noiseTex, vec2(ang * 4.0 + flash.w * 0.0015, y * 1.6), 0.0).r;
  float n2 = textureLod(noiseTex, vec2(ang * 9.0 - flash.w * 0.002, y * 4.2 + 0.3), 0.0).g;
  float base = n * 0.65 + n2 * 0.35;
  vec3 low = mix(horizonDark, horizonBright, slot);
  float lift = clamp(y * 5.2 + (base - 0.5) * 0.42, 0.0, 1.0);
  vec3 c = mix(low, mix(cloudDark * 2.2, cloudLight * 0.85, base * base) * (0.55 + 0.6 * slot), smoothstep(0.16, 0.62, lift));
  c = mix(c, zenith, smoothstep(0.35, 0.9, y));
  float shaft = textureLod(noiseTex, vec2(ang * 5.0 + y * 0.12, y * 0.05), 0.0).r * textureLod(noiseTex, vec2(ang * 2.0 + 0.4, 0.7), 0.0).r;
  c = mix(c, horizonDark * 0.75, 0.8 * smoothstep(0.1, 0.62, shaft) * smoothstep(0.26, 0.02, y) * (1.0 - 0.75 * slot));
  float f = flash.z * pow(max(dot(az, flash.xy), 0.0), 10.0) * exp(-abs(y) * 3.5) * (0.4 + base);
  c = mix(fog, c, smoothstep(-0.01, 0.085, y));
  return c + vec3(0.75, 0.85, 1.0) * f * 1.1 * smoothstep(0.0, 0.1, y);
}`;
const SKY_WGSL = `
fn skyColor(d: vec3f) -> vec3f {
  let y = d.y; let flash = uniforms.flash;
  let az = normalize(d.xz + 1e-5);
  let toSun = dot(az, normalize(uniforms.sun.xz)) * 0.5 + 0.5;
  let slot = 0.16 + 0.84 * pow(toSun, 2.0);
  let ang = atan2(az.y, az.x) * 0.1591549;
  let n = textureSampleLevel(noiseTex, noiseTexSampler, vec2f(ang * 4.0 + flash.w * 0.0015, y * 1.6), 0.0).r;
  let n2 = textureSampleLevel(noiseTex, noiseTexSampler, vec2f(ang * 9.0 - flash.w * 0.002, y * 4.2 + 0.3), 0.0).g;
  let base = n * 0.65 + n2 * 0.35;
  let low = mix(uniforms.horizonDark, uniforms.horizonBright, slot);
  let lift = clamp(y * 5.2 + (base - 0.5) * 0.42, 0.0, 1.0);
  var c = mix(low, mix(uniforms.cloudDark * 2.2, uniforms.cloudLight * 0.85, base * base) * (0.55 + 0.6 * slot), smoothstep(0.16, 0.62, lift));
  c = mix(c, uniforms.zenith, smoothstep(0.35, 0.9, y));
  let shaft = textureSampleLevel(noiseTex, noiseTexSampler, vec2f(ang * 5.0 + y * 0.12, y * 0.05), 0.0).r * textureSampleLevel(noiseTex, noiseTexSampler, vec2f(ang * 2.0 + 0.4, 0.7), 0.0).r;
  c = mix(c, uniforms.horizonDark * 0.75, 0.8 * smoothstep(0.1, 0.62, shaft) * (1.0 - smoothstep(0.02, 0.26, y)) * (1.0 - 0.75 * slot));
  let f = flash.z * pow(max(dot(az, flash.xy), 0.0), 10.0) * exp(-abs(y) * 3.5) * (0.4 + base);
  c = mix(uniforms.fog, c, smoothstep(-0.01, 0.085, y));
  return c + vec3f(0.75, 0.85, 1.0) * f * 1.1 * smoothstep(0.0, 0.1, y);
}`;

export const skyShader: ShaderSource = {
  vertex: {
    glsl: `precision highp float; attribute vec3 position; ${skyU.glsl} varying vec3 vD;
void main() { vD = position; gl_Position = worldViewProjection * vec4(position, 1.0); }`,
    wgsl: `attribute position: vec3f; ${skyU.wgsl} varying vD: vec3f;
@vertex fn main(input: VertexInputs) -> FragmentInputs { vertexOutputs.vD = vertexInputs.position; vertexOutputs.position = uniforms.worldViewProjection * vec4f(vertexInputs.position, 1.0); }`,
  },
  fragment: {
    glsl: `precision highp float; ${skyU.glsl} ${tex.glsl} varying vec3 vD; ${SKY_GLSL}
void main() { gl_FragColor = vec4(skyColor(normalize(vD)), 1.0); }`,
    wgsl: `${skyU.wgsl} ${tex.wgsl} varying vD: vec3f; ${SKY_WGSL}
@fragment fn main(input: FragmentInputs) -> FragmentOutputs { fragmentOutputs.color = vec4f(skyColor(normalize(fragmentInputs.vD)), 1.0); }`,
  },
};

/** shape = wall cloud radius, deck height, growth, reach. The swirl crossfades two phases, so it never winds up. */
export const deckShader: ShaderSource = {
  vertex: {
    glsl: `precision highp float; attribute vec3 position; ${deckU.glsl} varying vec3 vL; varying vec3 vW;
void main() { float r = length(position.xz); vec3 p = position; float ca = atan(p.z, p.x); float lobe = sin(ca * 13.0 - flash.w * 0.5) * 0.018 + sin(ca * 3.0 + flash.w * 0.25) * 0.06 + sin(ca * 7.0 + flash.w * 0.4) * 0.03; p.y += 42.0 * smoothstep(0.0, 1.0, r / (shape.x * 12.0)); p.y -= shape.y * 0.09 * (1.0 - smoothstep(0.3, 2.3, r / shape.x + lobe)) + shape.y * 0.03 * exp(-pow(r / shape.x * 0.45, 2.0)); p.y += (sin(p.x * 0.085 + flash.w * 0.2) * sin(p.z * 0.1 - flash.w * 0.17) + 0.6 * sin(p.x * 0.21 - flash.w * 0.3) * sin(p.z * 0.18 + 1.0)) * shape.y * 0.008 * exp(-r / (shape.x * 2.2)); vL = p; vec4 w = world * vec4(p, 1.0); vW = w.xyz; gl_Position = viewProjection * w; }`,
    wgsl: `attribute position: vec3f; ${deckU.wgsl} varying vL: vec3f; varying vW: vec3f;
@vertex fn main(input: VertexInputs) -> FragmentInputs { let r = length(vertexInputs.position.xz); var p = vertexInputs.position; let ca = atan2(p.z, p.x); let lobe = sin(ca * 13.0 - uniforms.flash.w * 0.5) * 0.018 + sin(ca * 3.0 + uniforms.flash.w * 0.25) * 0.06 + sin(ca * 7.0 + uniforms.flash.w * 0.4) * 0.03; p.y += 42.0 * smoothstep(0.0, 1.0, r / (uniforms.shape.x * 12.0)); p.y -= uniforms.shape.y * 0.09 * (1.0 - smoothstep(0.3, 2.3, r / uniforms.shape.x + lobe)) + uniforms.shape.y * 0.03 * exp(-pow(r / uniforms.shape.x * 0.45, 2.0)); p.y += (sin(p.x * 0.085 + uniforms.flash.w * 0.2) * sin(p.z * 0.1 - uniforms.flash.w * 0.17) + 0.6 * sin(p.x * 0.21 - uniforms.flash.w * 0.3) * sin(p.z * 0.18 + 1.0)) * uniforms.shape.y * 0.008 * exp(-r / (uniforms.shape.x * 2.2)); vertexOutputs.vL = p; let w = uniforms.world * vec4f(p, 1.0); vertexOutputs.vW = w.xyz; vertexOutputs.position = uniforms.viewProjection * w; }`,
  },
  fragment: {
    glsl: `precision highp float; ${deckU.glsl} ${tex.glsl} varying vec3 vL; varying vec3 vW;
float cloud(vec2 p, float r, float phase, float lod) {
  float a = -(phase * 1.5 + 0.5) * exp(-r / (shape.x * 3.2)) - flash.w * 0.012 - 150.0 / (r + 220.0);
  float c = cos(a); float s = sin(a);
  vec2 q = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  float big = textureLod(noiseTex, q / 620.0, max(lod - 2.0, 0.0)).r;
  float puff = textureLod(noiseTex, q / 360.0 + big * 0.12, max(lod - 1.0, 0.0)).b;
  float lump = textureLod(noiseTex, q / 150.0 + 0.37 + big * 0.2, lod).b;
  return clamp(big * 0.5 + puff * 0.34 + lump * 0.2 + textureLod(noiseTex, q / 70.0, lod).r * 0.1 - 0.12, 0.0, 1.0);
}
float clouds(vec2 p, float r, float lod) {
  float t = flash.w * 0.11;
  float a = fract(t); float b = fract(t + 0.5);
  return mix(cloud(p, r, a, lod), cloud(p + 91.0, r, b, lod), abs(a * 2.0 - 1.0));
}
void main() {
  vec2 p = vL.xz;
  float r = length(p);
  float dist = length(vW.xz - eye.xz);
  float lod = clamp(log2(max(dist, 1.0) / 32.0), 0.0, 5.0);
  float n = clouds(p, r, lod);
  float lit = clouds(p + normalize(sun.xz) * 22.0, r, lod);
  float toSun = dot(normalize(vW.xz - eye.xz), normalize(sun.xz)) * 0.5 + 0.5;
  float core = 1.0 - smoothstep(0.2, 1.0, r / shape.x);
  float ang = atan(p.y, p.x);
  float bands = sin(ang * 2.0 + log(r + 12.0) * 5.5 - flash.w * 0.22 + n * 3.0) * 0.5 + 0.5;
  float relief = clamp(0.5 + (n - lit) * 3.2, 0.0, 1.0);
  float lum = relief * (0.35 + 0.65 * n) * mix(1.0, 0.65 + 0.5 * bands, exp(-r / 420.0));
  vec3 c = mix(cloudDark, cloudLight * (0.55 + 0.75 * toSun), lum);
  float edge = exp(-pow((r - shape.x * 1.75) / (shape.x * 0.5), 2.0));
  c += cloudLight * edge * 0.22 * n;
  c *= 1.0 - (0.5 + 0.25 * shape.z) * core;
  float far = smoothstep(140.0, 720.0, dist);
  c = mix(c, mix(horizonDark, horizonBright * 0.8, 0.1 + 0.9 * toSun * toSun) * (0.62 + 0.38 * n), far * 0.85);
  c += vec3(0.6, 0.7, 0.9) * flash.z * (0.15 + 0.5 * n) * (0.3 + 0.7 * pow(max(dot(normalize(p + 1e-4), flash.xy), 0.0), 3.0)) * 0.6;
  float alpha = 1.0 - smoothstep(430.0, 1150.0, dist - n * 260.0);
  // Seen nearly edge-on the deck thins out, so its rim never draws a line.
  alpha *= smoothstep(0.02, 0.2, (vW.y - eye.y) / max(dist, 1.0) + (n - 0.5) * 0.16);
  gl_FragColor = vec4(c * alpha, alpha);
}`,
    wgsl: `${deckU.wgsl} ${tex.wgsl} varying vL: vec3f; varying vW: vec3f;
fn cloud(p: vec2f, r: f32, phase: f32, lod: f32) -> f32 {
  let a = -(phase * 1.5 + 0.5) * exp(-r / (uniforms.shape.x * 3.2)) - uniforms.flash.w * 0.012 - 150.0 / (r + 220.0);
  let c = cos(a); let s = sin(a);
  let q = vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
  let big = textureSampleLevel(noiseTex, noiseTexSampler, q / 620.0, max(lod - 2.0, 0.0)).r;
  let puff = textureSampleLevel(noiseTex, noiseTexSampler, q / 360.0 + big * 0.12, max(lod - 1.0, 0.0)).b;
  let lump = textureSampleLevel(noiseTex, noiseTexSampler, q / 150.0 + 0.37 + big * 0.2, lod).b;
  return clamp(big * 0.5 + puff * 0.34 + lump * 0.2 + textureSampleLevel(noiseTex, noiseTexSampler, q / 70.0, lod).r * 0.1 - 0.12, 0.0, 1.0);
}
fn clouds(p: vec2f, r: f32, lod: f32) -> f32 {
  let t = uniforms.flash.w * 0.11;
  let a = fract(t); let b = fract(t + 0.5);
  return mix(cloud(p, r, a, lod), cloud(p + 91.0, r, b, lod), abs(a * 2.0 - 1.0));
}
@fragment fn main(input: FragmentInputs) -> FragmentOutputs {
  let shape = uniforms.shape; let flash = uniforms.flash;
  let p = fragmentInputs.vL.xz;
  let r = length(p);
  let dist = length(fragmentInputs.vW.xz - uniforms.eye.xz);
  let lod = clamp(log2(max(dist, 1.0) / 32.0), 0.0, 5.0);
  let n = clouds(p, r, lod);
  let lit = clouds(p + normalize(uniforms.sun.xz) * 22.0, r, lod);
  let toSun = dot(normalize(fragmentInputs.vW.xz - uniforms.eye.xz), normalize(uniforms.sun.xz)) * 0.5 + 0.5;
  let core = 1.0 - smoothstep(0.2, 1.0, r / shape.x);
  let ang = atan2(p.y, p.x);
  let bands = sin(ang * 2.0 + log(r + 12.0) * 5.5 - flash.w * 0.22 + n * 3.0) * 0.5 + 0.5;
  let relief = clamp(0.5 + (n - lit) * 3.2, 0.0, 1.0);
  let lum = relief * (0.35 + 0.65 * n) * mix(1.0, 0.65 + 0.5 * bands, exp(-r / 420.0));
  var c = mix(uniforms.cloudDark, uniforms.cloudLight * (0.55 + 0.75 * toSun), lum);
  let edge = exp(-pow((r - shape.x * 1.75) / (shape.x * 0.5), 2.0));
  c += uniforms.cloudLight * edge * 0.22 * n;
  c *= 1.0 - (0.5 + 0.25 * shape.z) * core;
  let far = smoothstep(140.0, 720.0, dist);
  c = mix(c, mix(uniforms.horizonDark, uniforms.horizonBright * 0.8, 0.1 + 0.9 * toSun * toSun) * (0.62 + 0.38 * n), far * 0.85);
  c += vec3f(0.6, 0.7, 0.9) * flash.z * (0.15 + 0.5 * n) * (0.3 + 0.7 * pow(max(dot(normalize(p + 1e-4), flash.xy), 0.0), 3.0)) * 0.6;
  let rim = (fragmentInputs.vW.y - uniforms.eye.y) / max(dist, 1.0) + (n - 0.5) * 0.16;
  let alpha = (1.0 - smoothstep(430.0, 1150.0, dist - n * 260.0)) * smoothstep(0.02, 0.2, rim);
  fragmentOutputs.color = vec4f(c * alpha, alpha);
}`,
  },
};
