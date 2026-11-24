// The funnel as a real volume: a ray is marched through a spinning, noise-carved density inside a plain cylinder.
// Scene depth cuts the ray, so debris circles in front of, inside and behind the cloud.
import { declare, textures, type ShaderSource } from "./shader-kit";

export const SHAPE_UNIFORMS = ["tw0: v4", "tw1: v4", "tw2: v4", "tw3: v4"];

/** tw0 = x, z, height, time; tw1 = baseR, topR, power, flareR; tw2 = leanX, leanZ, wobble, spin; tw3 = dustR, dustH, density, growth. */
export const SHAPE_GLSL = `
float twRadius(float h) { float f = smoothstep(0.7, 1.0, h); return mix(tw1.x, tw1.y, pow(max(h, 0.0001), tw1.z)) + tw1.w * f * f; }
vec2 twAxis(float h) { float b = tw2.z * h * (1.0 - h) * 4.0; return tw0.xy + tw2.xy * h + vec2(sin(h * 4.5 + tw0.w * 0.9), sin(h * 3.7 - tw0.w * 0.7 + 1.3)) * b; }
`;
export const SHAPE_WGSL = `
fn twRadius(h: f32) -> f32 { let f = smoothstep(0.7, 1.0, h); return mix(uniforms.tw1.x, uniforms.tw1.y, pow(max(h, 0.0001), uniforms.tw1.z)) + uniforms.tw1.w * f * f; }
fn twAxis(h: f32) -> vec2f { let b = uniforms.tw2.z * h * (1.0 - h) * 4.0; return uniforms.tw0.xy + uniforms.tw2.xy * h + vec2f(sin(h * 4.5 + uniforms.tw0.w * 0.9), sin(h * 3.7 - uniforms.tw0.w * 0.7 + 1.3)) * b; }
`;

const uniforms = declare([
  "world: m4", "viewProjection: m4", ...SHAPE_UNIFORMS,
  "eye: v3", "forward: v3", "sun: v3", "lightCol: v3", "darkCol: v3", "dustCol: v3", "warmCol: v3", "fogCol: v4", "screen: v4", "bounds: v4",
]);
const MAX_STEPS = 96;
const tex = textures(["noiseTex", "depthTex"]);
export const FUNNEL_UNIFORMS = uniforms.names;

/** screen = pixel size, march steps, step length as a share of the funnel. */
export const funnelShader: ShaderSource = {
  vertex: {
    glsl: `precision highp float; attribute vec3 position; ${uniforms.glsl}
varying vec3 vW;
void main() { vec4 w = world * vec4(position, 1.0); vW = w.xyz; gl_Position = viewProjection * w; }`,
    wgsl: `attribute position: vec3f; ${uniforms.wgsl}
varying vW: vec3f;
@vertex fn main(input: VertexInputs) -> FragmentInputs { let w = uniforms.world * vec4f(vertexInputs.position, 1.0); vertexOutputs.vW = w.xyz; vertexOutputs.position = uniforms.viewProjection * w; }`,
  },
  fragment: {
    glsl: `precision highp float; ${uniforms.glsl}
${tex.glsl}
varying vec3 vW;
${SHAPE_GLSL}
// Density in x, dust share in y, noise in z.
vec4 field(vec3 p, out vec2 nrm) {
  float h = clamp(p.y / tw0.z, 0.0, 1.0);
  vec2 q = p.xz - twAxis(h);
  float r = length(q);
  nrm = q / max(r, 0.001);
  float R = twRadius(h);
  float a = atan(q.y, q.x) * 0.1591549;
  float v = p.y / max(tw1.x + tw1.y, 3.0);
  float n1 = textureLod(noiseTex, vec2(a - tw2.w, v * 0.9 + a - tw0.w * 0.05), 0.0).r;
  float n2 = textureLod(noiseTex, vec2(a * 2.0 - tw2.w * 2.3, v * 2.6 + a * 3.0 - tw0.w * 0.12), 0.0).r;
  float n3 = textureLod(noiseTex, vec2(a - tw2.w * 1.25 + 0.3, v * 1.7 + a * 3.0 - tw0.w * 0.2), 0.0).a;
  float n = clamp((n1 * 0.4 + n2 * 0.35 + n3 * 0.25 - 0.5) * 1.55 + 0.5, 0.0, 1.0);
  float edge = R * (0.55 + 0.7 * n);
  float d = smoothstep(edge, edge * 0.7, r);
  d += 0.2 * smoothstep(R * 1.75, R * 0.85, r) * smoothstep(0.52, 0.8, n2 * 0.55 + n3 * 0.45);
  d *= 1.0 - 0.45 * smoothstep(0.1, 0.0, h) * (1.0 - tw3.w);
  float hd = p.y / tw3.y;
  float ring = r / tw3.x;
  float nd = textureLod(noiseTex, vec2(a * 2.0 - tw2.w * 1.6 + ring * 0.5, hd * 0.3 + ring * 0.6 - tw0.w * 0.16), 0.0).r;
  float nf = textureLod(noiseTex, vec2(a * 1.0 - tw2.w * 1.2 + ring * 0.3, hd * 0.35 + ring * 0.5 - tw0.w * 0.2), 0.0).a;
  float nm = clamp((nd * 0.6 + nf * 0.4 - 0.5) * 1.6 + 0.5, 0.0, 1.0);
  float rd = tw3.x * (0.6 + 0.3 * hd) * (0.5 + 0.9 * nm);
  float dust = smoothstep(rd, rd * 0.3, r) * exp(-hd * hd * (1.1 + 1.4 * ring)) * (0.12 + 1.5 * nm * nm);
  return vec4(d, dust, n, r / max(R, 0.1));
}
void main() {
  vec3 rd = normalize(vW - eye);
  vec2 oc = eye.xz - bounds.xy;
  float A = dot(rd.xz, rd.xz); float B = dot(oc, rd.xz); float C = dot(oc, oc) - bounds.z * bounds.z;
  float disc = B * B - A * C;
  if (disc <= 0.0) discard;
  float sq = sqrt(disc);
  float t0 = max((-B - sq) / A, 0.0); float t1 = (-B + sq) / A;
  float ty0 = (0.0 - eye.y) / rd.y; float ty1 = (tw0.z - eye.y) / rd.y;
  t0 = max(t0, min(ty0, ty1)); t1 = min(t1, max(ty0, ty1));
  float z = texture2D(depthTex, gl_FragCoord.xy * screen.xy).r;
  if (z > 0.0) t1 = min(t1, z / dot(rd, forward));
  if (t1 <= t0) discard;
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + bounds.w) * 43758.5453);
  float t = t0;
  float trans = 1.0; vec3 col = vec3(0.0); float first = -1.0; bool inside = false;
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    if (float(i) >= screen.z) break;
    vec3 p = eye + rd * t;
    float h = clamp(p.y / tw0.z, 0.0, 1.0);
    float R = twRadius(h);
    float outer = max(R * 1.5, p.y < tw3.y * 2.0 ? tw3.x * 1.35 : 0.0);
    float r = length(p.xz - twAxis(h));
    float step = max(outer * screen.w, (r - outer) * 0.62);
    if (t > t1) break;
    if (r < outer * 1.1 && !inside) { inside = true; t += step * jitter; continue; }
    if (inside) {
      vec2 nrm; vec4 f = field(p, nrm);
      float topFade = smoothstep(1.0, 0.86, h);
      float sigma = f.x * tw3.z * 6.5 / max(R, 1.5) * (0.35 + 0.65 * topFade) + f.y * (2.6 + 1.0 * tw3.w) / max(tw3.x * 0.45, 2.0);
      if (sigma > 0.0005) {
        float a = 1.0 - exp(-sigma * step);
        float lam = dot(nrm, normalize(sun.xz)) * 0.5 + 0.5;
        float rim = clamp(f.w, 0.0, 1.2);
        float lum = (0.12 + 0.88 * lam * lam) * (0.16 + 1.25 * f.z) * (0.62 + 0.38 * rim);
        vec3 c = mix(darkCol, lightCol, clamp(lum * 1.25, 0.0, 1.0)) + warmCol * pow(lam, 3.0) * rim * f.z;
        c *= mix(0.6, 1.0, topFade);
        float dirt = clamp(f.y * (2.6 + 1.0 * tw3.w) / max(f.x * tw3.z * 3.0 + f.y, 0.001), 0.0, 1.0);
        dirt = max(dirt, (0.25 + 0.5 * tw3.w) * exp(-h * (7.0 - 3.5 * tw3.w)));
        c = mix(c, dustCol * (0.3 + 1.0 * lum + 0.25 * f.z), clamp(dirt, 0.0, 0.92));
        col += c * a * trans;
        trans *= 1.0 - a;
        if (first < 0.0) first = t;
        if (trans < 0.03) { trans = 0.0; break; }
      }
    }
    t += step;
  }
  float alpha = 1.0 - trans;
  if (alpha < 0.003) discard;
  float fog = 1.0 - exp(-pow(max(first, 0.0) * fogCol.w, 2.0));
  gl_FragColor = vec4(mix(col, fogCol.rgb * alpha, fog), alpha);
}`,
    wgsl: `${uniforms.wgsl}
${tex.wgsl}
varying vW: vec3f;
${SHAPE_WGSL}
struct Field { d: f32, dust: f32, n: f32, rel: f32, nrm: vec2f }
fn field(p: vec3f) -> Field {
  let tw0 = uniforms.tw0; let tw1 = uniforms.tw1; let tw2 = uniforms.tw2; let tw3 = uniforms.tw3;
  let h = clamp(p.y / tw0.z, 0.0, 1.0);
  let q = p.xz - twAxis(h);
  let r = length(q);
  let R = twRadius(h);
  let a = atan2(q.y, q.x) * 0.1591549;
  let v = p.y / max(tw1.x + tw1.y, 3.0);
  let n1 = textureSampleLevel(noiseTex, noiseTexSampler, vec2f(a - tw2.w, v * 0.9 + a - tw0.w * 0.05), 0.0).r;
  let n2 = textureSampleLevel(noiseTex, noiseTexSampler, vec2f(a * 2.0 - tw2.w * 2.3, v * 2.6 + a * 3.0 - tw0.w * 0.12), 0.0).r;
  let n3 = textureSampleLevel(noiseTex, noiseTexSampler, vec2f(a - tw2.w * 1.25 + 0.3, v * 1.7 + a * 3.0 - tw0.w * 0.2), 0.0).a;
  let n = clamp((n1 * 0.4 + n2 * 0.35 + n3 * 0.25 - 0.5) * 1.55 + 0.5, 0.0, 1.0);
  let edge = R * (0.55 + 0.7 * n);
  var d = (1.0 - smoothstep(edge * 0.7, edge, r));
  d += 0.2 * (1.0 - smoothstep(R * 0.85, R * 1.75, r)) * smoothstep(0.52, 0.8, n2 * 0.55 + n3 * 0.45);
  d *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.1, h)) * (1.0 - tw3.w);
  let hd = p.y / tw3.y;
  let ring = r / tw3.x;
  let nd = textureSampleLevel(noiseTex, noiseTexSampler, vec2f(a * 2.0 - tw2.w * 1.6 + ring * 0.5, hd * 0.3 + ring * 0.6 - tw0.w * 0.16), 0.0).r;
  let nf = textureSampleLevel(noiseTex, noiseTexSampler, vec2f(a * 1.0 - tw2.w * 1.2 + ring * 0.3, hd * 0.35 + ring * 0.5 - tw0.w * 0.2), 0.0).a;
  let nm = clamp((nd * 0.6 + nf * 0.4 - 0.5) * 1.6 + 0.5, 0.0, 1.0);
  let rd = tw3.x * (0.6 + 0.3 * hd) * (0.5 + 0.9 * nm);
  let dust = (1.0 - smoothstep(rd * 0.3, rd, r)) * exp(-hd * hd * (1.1 + 1.4 * ring)) * (0.12 + 1.5 * nm * nm);
  return Field(d, dust, n, r / max(R, 0.1), q / max(r, 0.001));
}
@fragment fn main(input: FragmentInputs) -> FragmentOutputs {
  let tw0 = uniforms.tw0; let tw3 = uniforms.tw3; let eye = uniforms.eye;
  let rd = normalize(fragmentInputs.vW - eye);
  let oc = eye.xz - uniforms.bounds.xy;
  let A = dot(rd.xz, rd.xz); let B = dot(oc, rd.xz); let C = dot(oc, oc) - uniforms.bounds.z * uniforms.bounds.z;
  let disc = B * B - A * C;
  if (disc <= 0.0) { discard; }
  let sq = sqrt(max(disc, 0.0));
  var t0 = max((-B - sq) / A, 0.0); var t1 = (-B + sq) / A;
  let ty0 = (0.0 - eye.y) / rd.y; let ty1 = (tw0.z - eye.y) / rd.y;
  t0 = max(t0, min(ty0, ty1)); t1 = min(t1, max(ty0, ty1));
  let z = textureSampleLevel(depthTex, depthTexSampler, fragmentInputs.position.xy * uniforms.screen.xy, 0.0).r;
  if (z > 0.0) { t1 = min(t1, z / dot(rd, uniforms.forward)); }
  if (t1 <= t0) { discard; }
  let jitter = fract(sin(dot(fragmentInputs.position.xy, vec2f(12.9898, 78.233)) + uniforms.bounds.w) * 43758.5453);
  var t = t0; var trans = 1.0; var col = vec3f(0.0); var first = -1.0; var inside = false;
  for (var i = 0; i < ${MAX_STEPS}; i++) {
    if (f32(i) >= uniforms.screen.z) { break; }
    let p = eye + rd * t;
    let h = clamp(p.y / tw0.z, 0.0, 1.0);
    let R = twRadius(h);
    let outer = max(R * 1.5, select(0.0, tw3.x * 1.35, p.y < tw3.y * 2.0));
    let r = length(p.xz - twAxis(h));
    let step = max(outer * uniforms.screen.w, (r - outer) * 0.62);
    if (t > t1) { break; }
    if (r < outer * 1.1 && !inside) { inside = true; t += step * jitter; continue; }
    if (inside) {
      let f = field(p);
      let topFade = 1.0 - smoothstep(0.86, 1.0, h);
      let sigma = f.d * tw3.z * 6.5 / max(R, 1.5) * (0.35 + 0.65 * topFade) + f.dust * (2.6 + 1.0 * tw3.w) / max(tw3.x * 0.45, 2.0);
      if (sigma > 0.0005) {
        let a = 1.0 - exp(-sigma * step);
        let lam = dot(f.nrm, normalize(uniforms.sun.xz)) * 0.5 + 0.5;
        let rim = clamp(f.rel, 0.0, 1.2);
        let lum = (0.12 + 0.88 * lam * lam) * (0.16 + 1.25 * f.n) * (0.62 + 0.38 * rim);
        var c = mix(uniforms.darkCol, uniforms.lightCol, clamp(lum * 1.25, 0.0, 1.0)) + uniforms.warmCol * pow(lam, 3.0) * rim * f.n;
        c *= mix(0.6, 1.0, topFade);
        var dirt = clamp(f.dust * (2.6 + 1.0 * tw3.w) / max(f.d * tw3.z * 3.0 + f.dust, 0.001), 0.0, 1.0);
        dirt = max(dirt, (0.25 + 0.5 * tw3.w) * exp(-h * (7.0 - 3.5 * tw3.w)));
        c = mix(c, uniforms.dustCol * (0.3 + 1.0 * lum + 0.25 * f.n), clamp(dirt, 0.0, 0.92));
        col += c * a * trans;
        trans *= 1.0 - a;
        if (first < 0.0) { first = t; }
        if (trans < 0.03) { trans = 0.0; break; }
      }
    }
    t += step;
  }
  let alpha = 1.0 - trans;
  if (alpha < 0.003) { discard; }
  let fog = 1.0 - exp(-pow(max(first, 0.0) * uniforms.fogCol.w, 2.0));
  fragmentOutputs.color = vec4f(mix(col, uniforms.fogCol.rgb * alpha, fog), alpha);
}`,
  },
};
