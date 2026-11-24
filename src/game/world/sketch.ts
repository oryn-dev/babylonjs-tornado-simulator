// Collects flat-shaded primitives with vertex colours into one mesh. Outward faces wind clockwise (Babylon, left-handed).
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";

export type P3 = [number, number, number];
export type Rgb = [number, number, number];

export class Sketch {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];

  /** A quad whose normal points away from `inside`. Corners in order around. */
  quad(a: P3, b: P3, c: P3, d: P3, color: Rgb, inside: P3 = [0, 0, 0], uv: number[] = [0, 0, 1, 0, 1, 1, 0, 1], normals?: P3[]) {
    const n = cross(sub(b, a), sub(d, a));
    const n2 = cross(sub(c, b), sub(d, b));
    let normal = norm([n[0] + n2[0], n[1] + n2[1], n[2] + n2[2]]);
    const mid: P3 = [(a[0] + b[0] + c[0] + d[0]) / 4 - inside[0], (a[1] + b[1] + c[1] + d[1]) / 4 - inside[1], (a[2] + b[2] + c[2] + d[2]) / 4 - inside[2]];
    const out = dot(normal, mid) >= 0;
    if (!out) normal = [-normal[0], -normal[1], -normal[2]];
    const base = this.positions.length / 3;
    [a, b, c, d].forEach((p, i) => {
      this.positions.push(...p);
      this.normals.push(...(normals ? normals[i] : normal));
      this.colors.push(...color, 1);
      this.uvs.push(uv[i * 2], uv[i * 2 + 1]);
    });
    const order = out ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    this.indices.push(...order.map((i) => base + i));
  }

  /** A box whose top may be smaller (`tx`, `tz` scale it) and shifted. */
  box(c: P3, size: P3, color: Rgb, tx = 1, tz = 1, shift: P3 = [0, 0, 0], top: Rgb = color) {
    const [w, h, d] = [size[0] / 2, size[1] / 2, size[2] / 2];
    const p = (sx: number, sy: number, sz: number): P3 => [
      c[0] + sx * w * (sy > 0 ? tx : 1) + (sy > 0 ? shift[0] : 0),
      c[1] + sy * h,
      c[2] + sz * d * (sy > 0 ? tz : 1) + (sy > 0 ? shift[2] : 0),
    ];
    this.quad(p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1), top, c);
    this.quad(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), color, c);
    this.quad(p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1), color, c);
    this.quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), color, c);
    this.quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), color, c);
    this.quad(p(1, -1, -1), p(1, -1, 1), p(1, 1, 1), p(1, 1, -1), color, c);
    return this;
  }

  /** A wheel or drum lying along x. */
  drum(c: P3, radius: number, width: number, color: Rgb, cap: Rgb = color, sides = 12) {
    const ring = (i: number, x: number): P3 => [c[0] + x, c[1] + Math.cos((i / sides) * Math.PI * 2) * radius, c[2] + Math.sin((i / sides) * Math.PI * 2) * radius];
    for (let i = 0; i < sides; i++) {
      this.quad(ring(i, -width / 2), ring(i + 1, -width / 2), ring(i + 1, width / 2), ring(i, width / 2), color, c);
      for (const s of [-1, 1]) {
        const x = (s * width) / 2;
        const hub: P3 = [c[0] + x, c[1], c[2]];
        this.quad(hub, ring(i, x), ring(i + 1, x), hub, cap, c);
      }
    }
    return this;
  }

  build(name: string, scene: Scene) {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.normals = this.normals;
    data.colors = this.colors;
    data.uvs = this.uvs;
    data.indices = this.indices;
    data.applyToMesh(mesh);
    return mesh;
  }
}

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: P3): P3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
