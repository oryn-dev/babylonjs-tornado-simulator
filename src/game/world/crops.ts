// Standing corn, wheat and soy: crossed cards with a leafy canopy card that fills them in from above. The storm flattens them in a swath.
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Look } from "../../oryn/look";
import { hash } from "../weather/noise";
import { StormBend } from "./plugins";
import { FIELDS, type Crop } from "./plan";
import { Sketch } from "./sketch";

const KINDS: Partial<Record<Crop, { h: number; step: number; color: string; w: number }>> = {
  corn: { h: 2.3, step: 2.5, color: "#708642", w: 2.6 },
  wheat: { h: 1, step: 3, color: "#f2d694", w: 3.2 },
  soy: { h: 0.8, step: 3.2, color: "#667d3a", w: 3 },
};
const CELL = 12;

export class Crops {
  private mesh: Mesh;
  private home: Float32Array;
  private live: Float32Array;
  private grid = new Map<number, number[]>();
  private cut: Uint8Array;
  private dirty = false;
  private since = 0;

  constructor(scene: Scene, look: Look, thin: number) {
    const s = new Sketch();
    for (const a of [0, Math.PI / 2]) {
      const c = Math.cos(a) / 2;
      const d = Math.sin(a) / 2;
      const up: [number, number, number] = [0, 1, 0];
      s.quad([-c, 0, -d], [c, 0, d], [c, 1, d], [-c, 1, -d], [1, 1, 1], [0, 0, -9], [0, 0, 0.49, 0, 0.49, 1, 0, 1], [up, up, up, up]);
    }
    const up: [number, number, number] = [0, 1, 0];
    s.quad([-0.62, 0.7, -0.62], [0.62, 0.62, -0.62], [0.62, 0.74, 0.62], [-0.62, 0.66, 0.62], [0.9, 0.9, 0.9], [0, 0, 0], [0.51, 0, 1, 0, 1, 1, 0.51, 1], [up, up, up, up]);
    this.mesh = s.build("crops", scene);
    const m = new PBRMaterial("crops", scene);
    m.albedoTexture = cropTexture(scene);
    m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
    m.alphaCutOff = 0.4;
    m.backFaceCulling = false;
    m.albedoColor = new Color3(1.5, 1.45, 1.35);
    m.roughness = 0.9;
    m.metallic = 0;
    new StormBend(m, 0.4);
    this.mesh.material = m;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.isPickable = false;
    look.receiveShadows(this.mesh);

    const matrices: number[] = [];
    const colors: number[] = [];
    for (const { r, crop } of FIELDS) {
      const kind = KINDS[crop];
      if (!kind) continue;
      const step = kind.step * thin;
      for (let x = r[0] + 2; x < r[2] - 2; x += step)
        for (let z = r[1] + 2; z < r[3] - 2; z += step) {
          const px = x + (hash(x, z) - 0.5) * step * 0.5;
          const pz = z + (hash(z, x) - 0.5) * step * 0.5;
          const a = hash(px, pz, 3) * 6.28;
          const w = kind.w * (0.85 + hash(px, pz, 4) * 0.3) * Math.sqrt(thin);
          const h = kind.h * (0.8 + hash(px, pz, 5) * 0.35);
          const i = matrices.length / 16;
          matrices.push(Math.cos(a) * w, 0, -Math.sin(a) * w, 0, 0, h, 0, 0, Math.sin(a) * w, 0, Math.cos(a) * w, 0, px, 0, pz, 1);
          const tone = 0.78 + hash(px, pz, 6) * 0.4;
          const c = Color3.FromHexString(kind.color).toLinearSpace();
          colors.push(c.r * tone, c.g * tone, c.b * tone, 1);
          const key = cellKey(px, pz);
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key)!.push(i);
        }
    }
    this.home = new Float32Array(matrices);
    this.live = this.home.slice();
    this.cut = new Uint8Array(matrices.length / 16);
    this.mesh.thinInstanceSetBuffer("matrix", this.live, 16, false);
    this.mesh.thinInstanceSetBuffer("color", new Float32Array(colors), 4, true);
  }

  reset() {
    this.live.set(this.home);
    this.cut.fill(0);
    this.dirty = true;
  }

  /** Flattens what stands within `radius`; returns how much went down. */
  flatten(x: number, z: number, radius: number) {
    let n = 0;
    const reach = Math.ceil(radius / CELL);
    for (let i = -reach; i <= reach; i++)
      for (let j = -reach; j <= reach; j++)
        for (const id of this.grid.get(cellKey(x + i * CELL, z + j * CELL)) ?? []) {
          if (this.cut[id]) continue;
          const o = id * 16;
          const d = Math.hypot(this.home[o + 12] - x, this.home[o + 14] - z);
          if (d > radius * (0.75 + hash(id, 1) * 0.4)) continue;
          this.cut[id] = 1;
          this.live[o + 5] *= 0.1 + hash(id, 2) * 0.12;
          n++;
        }
    if (n) this.dirty = true;
    return n;
  }

  update(dt: number) {
    this.since += dt;
    if (!this.dirty || this.since < 0.12) return;
    this.since = 0;
    this.dirty = false;
    this.mesh.thinInstanceBufferUpdated("matrix");
  }
}

const cellKey = (x: number, z: number) => Math.floor(x / CELL) * 4096 + Math.floor(z / CELL);

function cropTexture(scene: Scene) {
  const w = 256;
  const t = new DynamicTexture("crop", { width: w * 2, height: 256 }, scene, true);
  const g = t.getContext() as CanvasRenderingContext2D;
  g.clearRect(0, 0, w * 2, 256);
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const x = 8 + rnd() * (w - 16);
    const h = 120 + rnd() * 120;
    const v = 130 + rnd() * 110;
    g.strokeStyle = g.fillStyle = `rgb(${v},${v},${v * 0.92})`;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, 256);
    g.lineTo(x + (rnd() - 0.5) * 18, 256 - h);
    g.stroke();
    for (let k = 0; k < 4; k++) {
      const y = 256 - h * (0.25 + k * 0.2);
      const dir = rnd() > 0.5 ? 1 : -1;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + dir * 14, y - 22, x + dir * (26 + rnd() * 12), y + 6);
      g.quadraticCurveTo(x + dir * 12, y - 10, x, y + 6);
      g.fill();
    }
    g.beginPath();
    g.ellipse(x, 256 - h, 4, 13, 0, 0, 6.283);
    g.fill();
  }
  for (let i = 0; i < 90; i++) {
    const v = 110 + rnd() * 130;
    g.fillStyle = `rgb(${v},${v},${v * 0.92})`;
    g.save();
    g.translate(w + 34 + rnd() * (w - 68), 34 + rnd() * 188);
    g.rotate(rnd() * 6.283);
    g.beginPath();
    g.ellipse(0, 0, 26, 5.5, 0, 0, 6.283);
    g.fill();
    g.restore();
  }
  t.update();
  t.hasAlpha = true;
  t.anisotropicFilteringLevel = 4;
  return t;
}
