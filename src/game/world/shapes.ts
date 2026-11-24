import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Shape } from "./batches";
import { hash } from "../weather/noise";
import { Sketch, type P3, type Rgb } from "./sketch";

const WHITE: Rgb = [1, 1, 1];
const GLASS: Rgb = [0.018, 0.024, 0.028];
const TYRE: Rgb = [0.012, 0.012, 0.012];
const DARK: Rgb = [0.03, 0.03, 0.03];

/** Darkens the lower vertices, a cheap contact shade on every wall. */
function shade(mesh: Mesh, low = 0.74) {
  const p = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const colors: number[] = [];
  for (let i = 0; i < p.length; i += 3) {
    const v = p[i + 1] < 0 ? low : 1;
    colors.push(v, v, v, 1);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  return mesh;
}

function gable(name: string, scene: Scene) {
  const s = new Sketch();
  const a = (z: number): P3 => [-0.5, -0.5, z];
  const b = (z: number): P3 => [0.5, -0.5, z];
  const c = (z: number): P3 => [0, 0.5, z];
  for (const z of [-0.5, 0.5]) s.quad(a(z), b(z), c(z), c(z), WHITE, [0, -0.2, 0]);
  s.quad(a(-0.5), b(-0.5), b(0.5), a(0.5), WHITE, [0, -0.2, 0]);
  s.quad(a(-0.5), c(-0.5), c(0.5), a(0.5), WHITE, [0, -0.2, 0]);
  s.quad(b(-0.5), c(-0.5), c(0.5), b(0.5), WHITE, [0, -0.2, 0]);
  return s.build(name, scene);
}

interface Station {
  z: number;
  w: number;
  low: number;
  belt: number;
  roof: number;
  roofW: number;
  cabin?: boolean;
}

/** A car body lofted through cross-sections, rear to front; panes sit between belt line and roof where `cabin` is set. */
function carBody(s: Sketch, stations: Station[]) {
  const ring = (k: Station): P3[] => [
    [-k.w * 0.9, k.low, k.z], [-k.w, k.low + 0.22, k.z], [-k.w * 0.97, k.belt, k.z], [-k.roofW, k.roof, k.z],
    [k.roofW, k.roof, k.z], [k.w * 0.97, k.belt, k.z], [k.w, k.low + 0.22, k.z], [k.w * 0.9, k.low, k.z],
  ];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    const ra = ring(a);
    const rb = ring(b);
    const inside: P3 = [0, (a.low + a.belt) / 2, (a.z + b.z) / 2];
    for (let j = 0; j < 8; j++) {
      const k = (j + 1) % 8;
      const side = j === 2 || j === 4;
      const glass = (side && a.cabin && b.cabin) || (j === 3 && Math.abs(b.roof - a.roof) > 0.25);
      s.quad(ra[j], ra[k], rb[k], rb[j], glass ? GLASS : j === 7 ? DARK : WHITE, inside);
    }
  }
  for (const k of [stations[0], stations[stations.length - 1]]) {
    const r = ring(k);
    const inside: P3 = [0, (k.low + k.belt) / 2, 0];
    s.quad(r[0], r[1], r[6], r[7], WHITE, inside);
    s.quad(r[1], r[2], r[5], r[6], WHITE, inside);
    s.quad(r[2], r[3], r[4], r[5], WHITE, inside);
  }
}

function wheels(s: Sketch, x: number, front: number, rear: number, r: number, y: number) {
  for (const sx of [-1, 1]) for (const z of [front, rear]) s.drum([sx * x, y, z], r, 0.24, TYRE, [0.22, 0.22, 0.23]);
}

function sedan(scene: Scene) {
  const s = new Sketch();
  const y = -0.72;
  const st = (z: number, w: number, low: number, belt: number, roof: number, roofW: number, cabin = false): Station => ({ z, w, low: low + y, belt: belt + y, roof: roof + y, roofW, cabin });
  carBody(s, [
    st(-2.25, 0.78, 0.36, 0.86, 0.92, 0.66), st(-2.1, 0.86, 0.28, 0.92, 0.98, 0.72), st(-1.45, 0.9, 0.24, 0.94, 1.02, 0.74, true), st(-0.75, 0.9, 0.22, 0.93, 1.42, 0.6, true),
    st(0.05, 0.9, 0.22, 0.91, 1.44, 0.61, true), st(0.95, 0.9, 0.24, 0.9, 0.98, 0.74, true), st(1.9, 0.87, 0.26, 0.82, 0.86, 0.7), st(2.25, 0.74, 0.34, 0.66, 0.7, 0.6),
  ]);
  wheels(s, 0.82, 1.4, -1.4, 0.33, 0.33 + y);
  for (const x of [-0.58, 0.58]) {
    s.box([x, 0.62 + y, 2.2], [0.34, 0.14, 0.14], [1.6, 1.55, 1.4]);
    s.box([x, 0.78 + y, -2.2], [0.36, 0.14, 0.1], [0.5, 0.015, 0.012]);
  }
  return s.build("sedan", scene);
}

function pickup(scene: Scene) {
  const s = new Sketch();
  const y = -0.92;
  const st = (z: number, w: number, low: number, belt: number, roof: number, roofW: number, cabin = false): Station => ({ z, w, low: low + y, belt: belt + y, roof: roof + y, roofW, cabin });
  carBody(s, [
    st(-0.85, 0.98, 0.44, 1.14, 1.2, 0.9, true), st(-0.6, 0.98, 0.42, 1.14, 1.82, 0.74, true), st(0.55, 0.98, 0.42, 1.12, 1.84, 0.74, true),
    st(1.15, 0.98, 0.44, 1.12, 1.2, 0.88, true), st(2.35, 0.95, 0.46, 1.06, 1.12, 0.84), st(2.6, 0.9, 0.5, 0.94, 0.98, 0.78),
  ]);
  s.box([0, 0.66 + y, -1.75], [1.9, 0.5, 1.9], WHITE);
  for (const x of [-0.92, 0.92]) s.box([x, 1.02 + y, -1.75], [0.1, 0.36, 1.9], WHITE);
  s.box([0, 1.02 + y, -2.66], [1.9, 0.36, 0.1], WHITE);
  s.box([0, 0.92 + y, -1.75], [1.72, 0.03, 1.8], DARK);
  wheels(s, 0.9, 1.6, -1.75, 0.42, 0.42 + y);
  for (const x of [-0.66, 0.66]) {
    s.box([x, 0.84 + y, 2.58], [0.36, 0.2, 0.12], [1.6, 1.55, 1.4]);
    s.box([x * 1.3, 0.9 + y, -2.7], [0.14, 0.3, 0.06], [0.5, 0.015, 0.012]);
  }
  return s.build("pickup", scene);
}

function tractor(scene: Scene) {
  const s = new Sketch();
  const y = -1.3;
  s.box([0, 1.15 + y, 0.9], [0.8, 0.7, 2], WHITE, 0.92, 1);
  s.box([0, 0.85 + y, -0.6], [1, 0.8, 1.2], WHITE);
  s.box([0, 1.75 + y, -0.55], [1.15, 1.0, 1.15], GLASS, 0.9, 0.9);
  s.box([0, 2.34 + y, -0.55], [1.3, 0.14, 1.35], WHITE);
  s.box([0.28, 1.8 + y, 1.2], [0.09, 0.7, 0.09], DARK);
  for (const x of [-0.86, 0.86]) {
    s.drum([x, 0.85 + y, -0.75], 0.85, 0.42, TYRE, [0.75, 0.55, 0.06], 14);
    s.drum([x * 0.86, 0.5 + y, 1.45], 0.5, 0.28, TYRE, [0.75, 0.55, 0.06]);
  }
  return s.build("tractor", scene);
}

function bale(scene: Scene) {
  const s = new Sketch();
  const a: Rgb = [1, 1, 1];
  for (const [r, w, c] of [[0.72, 1.16, a], [0.75, 0.3, [0.85, 0.85, 0.85]], [0.6, 1.2, [0.8, 0.78, 0.74]], [0.4, 1.23, [0.66, 0.63, 0.58]], [0.2, 1.25, [0.9, 0.88, 0.82]]] as [number, number, Rgb][])
    s.drum([0, 0, 0], r, w, c, c, 16);
  return s.build("bale", scene);
}

/** A crown of leaf cards around a trunk; the cards use the left half of the foliage sheet, the bark the right edge. */
function tree(scene: Scene, name: string, kind: "broad" | "pine" | "bush") {
  const s = new Sketch();
  const trunkH = kind === "broad" ? 0.42 : kind === "pine" ? 0.22 : 0.05;
  const bark: Rgb = [0.16, 0.12, 0.09];
  const barkUv = [0.96, 0.5, 0.99, 0.5, 0.99, 0.55, 0.96, 0.55];
  const sides = 6;
  const ring = (i: number, r: number, y: number): P3 => [Math.cos((i / sides) * Math.PI * 2) * r, y, Math.sin((i / sides) * Math.PI * 2) * r];
  if (kind !== "bush")
    for (let i = 0; i < sides; i++) s.quad(ring(i, 0.035, 0), ring(i + 1, 0.035, 0), ring(i + 1, 0.018, trunkH + 0.3), ring(i, 0.018, trunkH + 0.3), bark, [0, 0.3, 0], barkUv);
  const cards = kind === "bush" ? 12 : kind === "pine" ? 30 : 36;
  for (let i = 0; i < cards; i++) {
    const f = (i + 0.5) / cards;
    const a = i * 2.399963;
    let y: number, r: number, size: number;
    if (kind === "pine") {
      y = 0.14 + f * 0.8;
      r = 0.21 * (1 - f) + 0.01;
      size = 0.3 * (1 - f * 0.65);
    } else {
      const up = 1 - 2 * f;
      const spread = Math.sqrt(1 - up * up);
      const jitter = 0.75 + hash(i, 3) * 0.4;
      y = (kind === "bush" ? 0.28 : 0.66) + up * (kind === "bush" ? 0.2 : 0.25) * jitter;
      r = spread * (kind === "bush" ? 0.42 : 0.3) * jitter;
      size = kind === "bush" ? 0.5 : 0.34;
    }
    const c: P3 = [Math.cos(a) * r, y, Math.sin(a) * r];
    const mid: P3 = [0, kind === "pine" ? y - 0.15 : kind === "bush" ? 0.1 : 0.58, 0];
    const n: P3 = [c[0] - mid[0], c[1] - mid[1] + 0.1, c[2] - mid[2]];
    const l = Math.hypot(...n);
    const tilt = hash(i, 7) * 6.28;
    const right: P3 = [Math.cos(a + tilt), hash(i, 5) - 0.5, Math.sin(a + tilt)];
    const up: P3 = kind === "pine" ? [Math.cos(a) * 0.5, 0.75, Math.sin(a) * 0.5] : [-Math.sin(tilt) * 0.6, 0.85, Math.cos(tilt) * 0.6];
    const corner = (x: number, v: number): P3 => [c[0] + (right[0] * x + up[0] * v) * size * 0.55, c[1] + (right[1] * x + up[1] * v) * size * 0.55, c[2] + (right[2] * x + up[2] * v) * size * 0.55];
    const tone = 0.62 + 0.38 * Math.min(1, Math.max(0, (c[1] - 0.2) / 0.7)) * (0.8 + hash(i, 11) * 0.3);
    const color: Rgb = [tone, tone, tone];
    const soft: P3 = [n[0] / l, n[1] / l, n[2] / l];
    const cell = kind === "pine" ? [0.5, 0, 0.94, 0, 0.94, 1, 0.5, 1] : [0, 0, 0.48, 0, 0.48, 1, 0, 1];
    s.quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), color, [0, 0.5, 0], cell, [soft, soft, soft, soft]);
  }
  return s.build(name, scene);
}

export function createShapes(scene: Scene): Record<Shape, Mesh> {
  const box = (name: string, low?: number) => shade(CreateBox(name, { size: 1 }, scene), low);
  return {
    siding: box("siding"), shingle: box("shingle", 0.95), metal: box("metal"), brick: box("brick"), concrete: box("concrete", 0.8), wood: box("wood"), paint: box("paint", 0.85),
    window: box("window", 1), windowLit: box("windowLit", 1),
    gable: gable("gable", scene), gableWood: gable("gableWood", scene), gableMetal: gable("gableMetal", scene),
    cyl: shade(CreateCylinder("cyl", { diameter: 1, height: 1, tessellation: 20 }, scene), 0.8),
    pipe: shade(CreateCylinder("pipe", { diameter: 1, height: 1, tessellation: 8 }, scene), 0.85),
    cone: CreateCylinder("cone", { diameterTop: 0.04, diameterBottom: 1, height: 1, tessellation: 20 }, scene),
    dome: CreateSphere("dome", { diameter: 1, segments: 10 }, scene),
    sedan: sedan(scene), pickup: pickup(scene), tractor: tractor(scene), bale: bale(scene),
    tree: tree(scene, "tree", "broad"), pine: tree(scene, "pine", "pine"), bush: tree(scene, "bush", "bush"),
  };
}
