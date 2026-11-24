import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { Shape } from "./batches";
import { MetreUv, StormBend } from "./plugins";
import { concrete, metal, shingle, siding, windowPane } from "./textures";

interface Options {
  albedo?: BaseTexture;
  normal?: BaseTexture;
  rough: number;
  metallic?: number;
  /** Texture repeats per metre; none keeps the mesh's own coordinates. */
  perMetre?: number;
  bump?: number;
}

export function createMaterials(scene: Scene, url: (path: string) => string): Record<Shape, PBRMaterial> {
  const photo = (file: string, srgb = true) => {
    const t = new Texture(url(`tex/${file}.jpg`), scene);
    t.gammaSpace = srgb;
    t.anisotropicFilteringLevel = 8;
    return t;
  };
  const make = (name: string, { albedo, normal, rough, metallic = 0, perMetre, bump = 1 }: Options) => {
    const m = new PBRMaterial(name, scene);
    m.roughness = rough;
    m.metallic = metallic;
    if (albedo) m.albedoTexture = albedo;
    if (normal) {
      m.bumpTexture = normal;
      normal.level = bump;
    }
    if (perMetre) new MetreUv(m, perMetre);
    return m;
  };
  const side = siding(scene);
  const roof = shingle(scene);
  const sheet = metal(scene);
  const cast = concrete(scene);
  const planks = { albedo: photo("planks"), normal: photo("planks-n", false) };
  planks.albedo.level = 2.6;
  const brick = { albedo: photo("brick"), normal: photo("brick-n", false) };
  brick.albedo.level = 1.6;

  const ringSheet = { albedo: sheet.albedo.clone() as Texture, normal: sheet.normal.clone() as Texture };
  for (const t of Object.values(ringSheet)) {
    t.wAng = Math.PI / 2;
    t.uScale = 3;
    t.vScale = 2;
  }

  const window = make("window", { albedo: windowPane(scene, false), rough: 0.14 });
  const litTexture = windowPane(scene, true);
  const windowLit = make("windowLit", { albedo: litTexture, rough: 0.2 });
  windowLit.emissiveTexture = litTexture;
  windowLit.emissiveColor = new Color3(0.9, 0.75, 0.5);

  const leaves = foliage(scene);
  const leafy = (name: string, stiffness: number) => {
    const m = make(name, { albedo: leaves, rough: 0.85 });
    m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
    m.alphaCutOff = 0.45;
    m.backFaceCulling = false;
    m.twoSidedLighting = false;
    m.albedoColor = new Color3(1.45, 1.35, 1.35);
    new StormBend(m, stiffness);
    return m;
  };
  const car = make("car", { rough: 0.22, metallic: 0.1 });
  const cyl = make("cyl", { ...ringSheet, rough: 0.42, metallic: 0.35 });

  return {
    siding: make("siding", { ...side, rough: 0.75, perMetre: 0.6 }),
    shingle: make("shingle", { ...roof, rough: 0.9, perMetre: 0.45 }),
    metal: make("metal", { ...sheet, rough: 0.45, metallic: 0.25, perMetre: 0.5 }),
    brick: make("brick", { ...brick, rough: 0.85, perMetre: 0.5 }),
    concrete: make("concrete", { ...cast, rough: 0.8, perMetre: 0.22 }),
    wood: make("wood", { ...planks, rough: 0.82, perMetre: 0.6 }),
    paint: make("paint", { rough: 0.4 }),
    window, windowLit,
    gable: make("gable", { ...side, rough: 0.75, perMetre: 0.6 }),
    gableWood: make("gableWood", { ...planks, rough: 0.82, perMetre: 0.6 }),
    gableMetal: make("gableMetal", { ...sheet, rough: 0.45, metallic: 0.25, perMetre: 0.5 }),
    cyl, pipe: make("pipe", { rough: 0.55, metallic: 0.15 }),
    cone: make("cone", { albedo: sheet.albedo, rough: 0.4, metallic: 0.35 }),
    dome: make("dome", { rough: 0.35 }),
    sedan: car, pickup: car, tractor: make("tractorPaint", { rough: 0.4 }), bale: make("bale", { rough: 0.95 }),
    tree: leafy("tree", 0.16), pine: leafy("pine", 0.12), bush: leafy("bush", 0.25),
  };
}

/** Leaf clump (left), needle sprays (middle), solid bark strip (right edge). */
function foliage(scene: Scene) {
  const w = 512;
  const h = 256;
  const t = new DynamicTexture("foliage", { width: w, height: h }, scene, true);
  const g = t.getContext() as CanvasRenderingContext2D;
  g.clearRect(0, 0, w, h);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 950; i++) {
    const a = rnd() * 6.283;
    const r = Math.sqrt(rnd()) * 108;
    const v = 165 + rnd() * 90;
    g.fillStyle = `rgb(${v * 0.96},${v},${v * 0.88})`;
    g.save();
    g.translate(122 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    g.rotate(rnd() * 6.283);
    g.beginPath();
    g.ellipse(0, 0, 7.5, 3.6, 0, 0, 6.283);
    g.fill();
    g.restore();
  }
  g.lineWidth = 3;
  for (let i = 0; i < 260; i++) {
    const y = rnd();
    const v = 120 + rnd() * 110;
    g.strokeStyle = `rgb(${v * 0.92},${v},${v * 0.92})`;
    const x = 368 + (rnd() - 0.5) * 24;
    const py = 12 + y * 220;
    const reach = (0.35 + y * 0.65) * 100;
    g.beginPath();
    g.moveTo(x, py);
    g.lineTo(x + (rnd() - 0.5) * 2 * reach, py + 14 + rnd() * 18);
    g.stroke();
  }
  g.fillStyle = "#ffffff";
  g.fillRect(486, 0, 26, h);
  t.update();
  t.hasAlpha = true;
  t.anisotropicFilteringLevel = 4;
  return t;
}
