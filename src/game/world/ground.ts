// The land: a painted county map with grass and mud detail, a scar the storm digs into it, roads, and far country to the horizon.
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { Look } from "../../oryn/look";
import type { Structure } from "./builder";
import { paintCounty } from "./paint";
import { HALF, ROADS, type Road } from "./plan";
import { Sketch, type P3 } from "./sketch";

const INNER = HALF * 2 + 40;
const OUTER = 3200;
const SCAR = 512;

const SAMPLERS = ["twGrass", "twMud", "twScar", "twNoise"] as const;

class GroundDetail extends MaterialPluginBase {
  constructor(material: PBRMaterial, private tex: Record<(typeof SAMPLERS)[number], BaseTexture>) {
    super(material, "TwGround", 192, { TW_GROUND: false });
    this._enable(true);
  }
  override isCompatible() {
    return true;
  }
  override getClassName() {
    return "TwGroundDetail";
  }
  override prepareDefines(defines: Record<string, unknown>) {
    defines.TW_GROUND = true;
  }
  override getSamplers(samplers: string[]) {
    samplers.push(...SAMPLERS.map((n) => `${n}Sampler`));
  }
  override isReadyForSubMesh() {
    return Object.values(this.tex).every((t) => t.isReady());
  }
  override hasTexture(texture: BaseTexture) {
    return Object.values(this.tex).includes(texture);
  }
  override getActiveTextures(active: BaseTexture[]) {
    active.push(...Object.values(this.tex));
  }
  override bindForSubMesh(ubo: UniformBuffer) {
    for (const [name, t] of Object.entries(this.tex)) ubo.setTexture(`${name}Sampler`, t);
  }
  override getCustomCode(shaderType: string, language?: number) {
    if (shaderType !== "fragment") return null;
    const w = language === 1;
    const get = (n: string, uv: string) => (w ? `textureSample(${n}Sampler, ${n}SamplerSampler, ${uv})` : `texture2D(${n}Sampler, ${uv})`);
    const v2 = w ? "vec2f" : "vec2";
    const v3 = w ? "vec3f" : "vec3";
    const f = w ? "let" : "float";
    const l3 = w ? "let" : "vec3";
    const p = w ? "fragmentInputs.vPositionW.xz" : "vPositionW.xz";
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: SAMPLERS.map((n) => (w ? `var ${n}SamplerSampler: sampler; var ${n}Sampler: texture_2d<f32>;` : `uniform sampler2D ${n}Sampler;`)).join("\n") + (w ? "\nvar<private> twWet: f32 = 0.0;" : "\nfloat twWet = 0.0;"),
      CUSTOM_FRAGMENT_UPDATE_ALBEDO: `
${f} twG1 = ${get("twGrass", `${p} * 0.21`)}.r;
${f} twG2 = ${get("twGrass", `${p} * 0.047 + ${v2}(0.3, 0.7)`)}.r;
${f} twN = ${get("twNoise", `${p} * 0.0071`)}.r;
surfaceAlbedo = surfaceAlbedo * (0.32 + twG1 * 1.15 + twG2 * 0.45) * (0.72 + 0.56 * twN) * mix(${v3}(1.1, 1.0, 0.86), ${v3}(0.9, 1.0, 0.92), ${get("twNoise", `${p} * 0.0143 + ${v2}(0.7, 0.2)`)}.r);
${f} twScarN = ${get("twNoise", `${p} * 0.06`)}.r;
${f} twScar0 = ${get("twScar", `(${p} + ${(INNER / 2).toFixed(1)}) / ${INNER.toFixed(1)}`)}.r;
${f} twCut = smoothstep(0.3, 0.72, twScar0 * 1.35 + (twScarN - 0.5) * 0.5);
${l3} twMudC = pow(${get("twMud", `${p} * 0.17`)}.rgb, ${v3}(2.2)) * ${v3}(0.95, 0.82, 0.66);
surfaceAlbedo = mix(surfaceAlbedo, twMudC * (0.65 + 0.6 * twN), twCut * 0.96);
twWet = smoothstep(0.6, 0.78, ${get("twNoise", `${p} * 0.021 + ${v2}(0.4, 0.1)`)}.r * 0.7 + twG2 * 0.3) * 0.7;
surfaceAlbedo = surfaceAlbedo * (1.0 - 0.22 * twWet);`,
      CUSTOM_FRAGMENT_UPDATE_MICROSURFACE: w ? "microSurface = max(microSurface, twWet * 0.82);" : "microSurface = max(microSurface, twWet * 0.82);",
    };
  }
}

export class Ground {
  private scar: DynamicTexture;
  private dirty = false;
  private since = 0;

  constructor(scene: Scene, look: Look, url: (path: string) => string, noise: BaseTexture, structures: Structure[], resolution: number) {
    const photo = (file: string, repeat = true) => {
      const t = new Texture(url(`tex/${file}.jpg`), scene);
      t.anisotropicFilteringLevel = 8;
      t.wrapU = t.wrapV = repeat ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
      return t;
    };
    this.scar = new DynamicTexture("scar", SCAR, scene, true);
    this.scar.wrapU = this.scar.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.clearScar();
    const tex = { twGrass: photo("grass"), twMud: photo("mud"), twScar: this.scar, twNoise: noise };

    const surface = (name: string, size: number, px: number, detailed: boolean) => {
      const map = new DynamicTexture(`${name}-map`, px, scene, true);
      paintCounty(map.getContext() as CanvasRenderingContext2D, size, px, detailed ? structures : []);
      map.update();
      map.anisotropicFilteringLevel = 8;
      map.wrapU = map.wrapV = Texture.CLAMP_ADDRESSMODE;
      const m = new PBRMaterial(name, scene);
      m.albedoTexture = map;
      m.metallic = 0;
      m.roughness = 0.93;
      new GroundDetail(m, tex);
      const mesh = CreateGround(name, { width: size, height: size, subdivisions: 1 }, scene);
      mesh.material = m;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      look.receiveShadows(mesh);
      return mesh;
    };
    surface("county", INNER, resolution, true);
    surface("country", OUTER, 1024, false).position.y = -0.35;
    scene.getMeshByName("country")!.unfreezeWorldMatrix();
    roads(scene, look, url);
  }

  clearScar() {
    const g = this.scar.getContext() as CanvasRenderingContext2D;
    g.fillStyle = "#000";
    g.fillRect(0, 0, SCAR, SCAR);
    this.scar.update(false);
  }

  /** Digs the storm's track at a place. */
  dig(x: number, z: number, radius: number, strength: number) {
    const g = this.scar.getContext() as CanvasRenderingContext2D;
    const k = SCAR / INNER;
    const px = (x + INNER / 2) * k;
    const py = (z + INNER / 2) * k;
    const r = Math.max(1.6, radius * k);
    const fade = g.createRadialGradient(px, py, 0, px, py, r);
    fade.addColorStop(0, `rgba(255,255,255,${strength})`);
    fade.addColorStop(0.6, `rgba(255,255,255,${strength * 0.6})`);
    fade.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = fade;
    g.fillRect(px - r, py - r, r * 2, r * 2);
    this.dirty = true;
  }

  update(dt: number) {
    this.since += dt;
    if (!this.dirty || this.since < 0.2) return;
    this.since = 0;
    this.dirty = false;
    this.scar.update(false);
  }
}

/** Road ribbons with painted lines, plus the town's sidewalks. */
function roads(scene: Scene, look: Look, url: (path: string) => string) {
  const kinds: Record<Road["kind"], { y: number; rough: number }> = { highway: { y: 0.07, rough: 0.6 }, street: { y: 0.05, rough: 0.62 }, dirt: { y: 0.03, rough: 0.8 } };
  for (const kind of ["highway", "street", "dirt"] as const) {
    const s = new Sketch();
    ROADS.filter((r) => r.kind === kind).forEach((r, i) => {
      const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]);
      const dir = [(r.b[0] - r.a[0]) / len, (r.b[1] - r.a[1]) / len];
      const side = [-dir[1] * (r.width / 2), dir[0] * (r.width / 2)];
      const y = kinds[kind].y + i * 0.004;
      const parts = Math.ceil(len / 120);
      for (let k = 0; k < parts; k++) {
        const at = (f: number, w: number): P3 => [r.a[0] + dir[0] * len * f + side[0] * w, y, r.a[1] + dir[1] * len * f + side[1] * w];
        const f0 = k / parts;
        const f1 = (k + 1) / parts;
        s.quad(at(f0, -1), at(f0, 1), at(f1, 1), at(f1, -1), [1, 1, 1], [0, -10, 0], [0, (f0 * len) / 12, 1, (f0 * len) / 12, 1, (f1 * len) / 12, 0, (f1 * len) / 12]);
      }
    });
    const mesh = s.build(`road-${kind}`, scene);
    const m = new PBRMaterial(`road-${kind}`, scene);
    m.metallic = 0;
    m.roughness = kinds[kind].rough;
    m.albedoTexture = roadTexture(scene, kind);
    m.bumpTexture = new Texture(url("tex/mud-n.jpg"), scene);
    (m.bumpTexture as Texture).uScale = 2;
    (m.bumpTexture as Texture).vScale = 3;
    m.bumpTexture.level = kind === "dirt" ? 0.5 : 0.12;
    m.zOffset = -1;
    mesh.material = m;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    look.receiveShadows(mesh);
  }
  const walk = new Sketch();
  for (const side of [-1, 1])
    for (const [z0, z1] of [[86, 107], [117, 191], [201, 250]]) walk.box([side * 9.3, 0.06, (z0 + z1) / 2], [3.4, 0.16, z1 - z0], [0.36, 0.36, 0.34]);
  const mesh = walk.build("sidewalk", scene);
  const m = new PBRMaterial("sidewalk", scene);
  m.metallic = 0;
  m.roughness = 0.5;
  mesh.material = m;
  mesh.isPickable = false;
  look.receiveShadows(mesh);
}

function roadTexture(scene: Scene, kind: Road["kind"]) {
  const w = 256;
  const h = 512;
  const t = new DynamicTexture(`road-${kind}`, { width: w, height: h }, scene, true);
  const g = t.getContext() as CanvasRenderingContext2D;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = kind === "dirt" ? "#6b5842" : "#3a3b3c";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const v = kind === "dirt" ? 70 + rnd() * 50 : 44 + rnd() * 36;
    g.fillStyle = kind === "dirt" ? `rgba(${v + 30},${v + 10},${v - 14},0.35)` : `rgba(${v},${v},${v},0.5)`;
    g.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  // Wheel tracks, cracks and patches.
  g.globalAlpha = 0.28;
  g.fillStyle = kind === "dirt" ? "#3c2f22" : "#1d1e1f";
  for (const u of [0.22, 0.36, 0.64, 0.78]) g.fillRect(u * w - 9, 0, 18, h);
  g.globalAlpha = 1;
  if (kind !== "dirt") {
    g.strokeStyle = "rgba(20,20,20,0.8)";
    for (let i = 0; i < 7; i++) {
      let x = rnd() * w;
      let y = rnd() * h;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (rnd() - 0.5) * 34), (y += rnd() * 16));
      g.stroke();
    }
    g.fillStyle = "#c9a23a";
    if (kind === "highway") {
      g.fillRect(w / 2 - 7, 0, 4, h);
      g.fillRect(w / 2 + 3, 0, 4, h * 0.5);
      g.fillStyle = "#c9c8c0";
      g.fillRect(12, 0, 4, h);
      g.fillRect(w - 16, 0, 4, h);
    } else g.fillRect(w / 2 - 2, 0, 4, h * 0.4);
  } else {
    g.fillStyle = "rgba(96,104,58,0.5)";
    for (let i = 0; i < 900; i++) g.fillRect(w / 2 + (rnd() - 0.5) * 46, rnd() * h, 3, 5);
    for (let i = 0; i < 1400; i++) g.fillRect(rnd() < 0.5 ? rnd() * 22 : w - rnd() * 22, rnd() * h, 4, 6);
  }
  t.update();
  t.anisotropicFilteringLevel = 8;
  return t;
}
