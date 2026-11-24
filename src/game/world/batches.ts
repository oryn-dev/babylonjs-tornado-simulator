// Every destructible thing is a thin instance of one of these shapes. One instance buffer per shape holds the standing
// pieces and the flying ones alike; a flying piece just rewrites its own matrix.
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import type { Look } from "../../oryn/look";
import type { Scene } from "@babylonjs/core/scene";
import { createShapes } from "./shapes";
import { createMaterials } from "./materials";

export type Shape =
  | "siding" | "shingle" | "metal" | "brick" | "concrete" | "wood" | "paint" | "window" | "windowLit"
  | "gable" | "gableWood" | "gableMetal" | "cyl" | "pipe" | "cone" | "dome"
  | "sedan" | "pickup" | "tractor" | "bale" | "tree" | "pine" | "bush";

export class Batch {
  matrices = new Float32Array(16 * 64);
  colors = new Float32Array(4 * 64);
  count = 0;
  dirty = false;
  /** Half size of the shape at scale 1. */
  readonly half: [number, number, number];

  constructor(readonly name: Shape, readonly mesh: Mesh, material: PBRMaterial) {
    mesh.material = material;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.isPickable = false;
    mesh.doNotSyncBoundingInfo = true;
    const e = mesh.getBoundingInfo().boundingBox.extendSize;
    this.half = [e.x, e.y, e.z];
  }

  add(color: Color3) {
    if ((this.count + 1) * 16 > this.matrices.length) {
      const grow = (old: Float32Array) => {
        const next = new Float32Array(old.length * 2);
        next.set(old);
        return next;
      };
      this.matrices = grow(this.matrices);
      this.colors = grow(this.colors);
    }
    this.colors.set([color.r, color.g, color.b, 1], this.count * 4);
    return this.count++;
  }

  finish() {
    if (!this.count) return this.mesh.setEnabled(false);
    this.matrices = this.matrices.slice(0, this.count * 16);
    this.mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer("color", this.colors.slice(0, this.count * 4), 4, true);
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.mesh.thinInstanceBufferUpdated("matrix");
  }
}

export type Batches = Record<Shape, Batch>;

export function createBatches(scene: Scene, look: Look, url: (path: string) => string): Batches {
  const materials = createMaterials(scene, url);
  const shapes = createShapes(scene);
  const batches = {} as Batches;
  for (const [name, mesh] of Object.entries(shapes) as [Shape, Mesh][]) {
    batches[name] = new Batch(name, mesh, materials[name]);
    look.castShadows(mesh);
  }
  return batches;
}

const cache = new Map<string, Color3>();
export function linear(hex: string) {
  let c = cache.get(hex);
  if (!c) cache.set(hex, (c = Color3.FromHexString(hex).toLinearSpace()));
  return c;
}
