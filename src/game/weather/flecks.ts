// The fine debris cloud: hundreds of small boards, leaves and shingles riding the funnel. Pure decoration, no physics.
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { hash } from "./noise";
import { funnelAxis, funnelRadius, type FunnelShape } from "./state";

const axis = { x: 0, z: 0 };
const TONES = ["#4b4034", "#2d2b28", "#6b5a43", "#57604a", "#8a8375", "#39332c"];

export class Flecks {
  private mesh: Mesh;
  private matrices: Float32Array;

  constructor(scene: Scene, private count: number) {
    this.mesh = CreateBox("flecks", { width: 1, height: 0.08, depth: 0.42 }, scene);
    const m = new PBRMaterial("flecks", scene);
    m.roughness = 0.9;
    m.metallic = 0;
    this.mesh.material = m;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.isPickable = false;
    this.matrices = new Float32Array(count * 16);
    const colors = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const c = Color3.FromHexString(TONES[i % TONES.length]).toLinearSpace();
      colors.set([c.r, c.g, c.b, 1], i * 4);
    }
    this.mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer("color", colors, 4, true);
  }

  update(s: FunnelShape) {
    const m = this.matrices;
    const t = s.time;
    const shown = Math.round(this.count * (0.22 + 0.78 * s.growth));
    this.mesh.thinInstanceCount = shown;
    for (let i = 0; i < shown; i++) {
      const a0 = hash(i, 1);
      const rise = 0.09 + hash(i, 2) * 0.16;
      const life = (t * rise * (0.6 + 0.4 * a0) + hash(i, 3)) % 1;
      const top = 0.12 + hash(i, 4) ** 2 * 0.7;
      const h = life * top;
      funnelAxis(s, h, axis);
      const low = 1 - Math.min(1, h * 9);
      const R = funnelRadius(s, h) * (0.85 + hash(i, 5) * 0.85) + low * s.dustR * 0.35 * hash(i, 6);
      const v = 13 + 12 * hash(i, 7) + 10 * s.growth;
      const a = a0 * 6.283 + (t * Math.min(v / Math.max(R, 2.5), 4.4));
      const size = (0.22 + hash(i, 8) ** 3 * (0.9 + 1.4 * s.growth)) * Math.min(1, life * 8) * Math.min(1, (1 - life) * 6);
      const sp = t * (3 + hash(i, 9) * 6) + i;
      const cs = Math.cos(sp) * size;
      const sn = Math.sin(sp) * size;
      const ca = Math.cos(a + i);
      const sa = Math.sin(a + i);
      const o = i * 16;
      m[o] = ca * cs; m[o + 1] = sn; m[o + 2] = -sa * cs;
      m[o + 4] = -ca * sn; m[o + 5] = cs; m[o + 6] = sa * sn;
      m[o + 8] = sa * size; m[o + 10] = ca * size;
      m[o + 12] = axis.x + Math.cos(a) * R;
      m[o + 13] = 0.5 + h * s.height;
      m[o + 14] = axis.z + Math.sin(a) * R;
      m[o + 15] = 1;
    }
    this.mesh.thinInstanceBufferUpdated("matrix");
  }
}
