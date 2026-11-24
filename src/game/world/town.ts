// Main street and the industrial area.
import type { Builder } from "./builder";
import { gableRoof, pick, wall } from "./homes";

const SIGNS = ["#2f5d73", "#8c2f2a", "#3f6145", "#b07a2a", "#4b4264", "#7b5233"];
const BRICKS = ["#b98270", "#a6938a", "#c2a58c", "#8f7468", "#ad9d90"];

export function shop(b: Builder, x: number, z: number, yaw: number, seed: number) {
  const w = 10 + (seed % 3) * 1.5, d = 12, two = seed % 2 === 0;
  const h = two ? 6.6 : 4.2;
  const c = pick(BRICKS, seed * 2 + 1);
  const sign = pick(SIGNS, seed);
  b.begin(pick(["Diner", "Hardware store", "Pharmacy", "Grocery", "Bank", "Cinema", "Laundromat"], seed), "building", x, z, yaw, 2.75, two ? 460000 : 320000, two ? 85 : 75);
  b.part("concrete", 0, 0.1, 0, w + 0.2, 0.24, d + 0.2, { c: "#8d8b85", hold: 99 });
  const o = { c, hold: 0.55, step: 2.6 };
  wall(b, "brick", 0, d / 2, w, h, "x", { ...o, openings: " w  w " });
  wall(b, "brick", -w / 2, 0, d, h, "z", o);
  wall(b, "brick", w / 2, 0, d, h, "z", o);
  if (two) wall(b, "brick", 0, -d / 2, w, 3, "x", { ...o, y: 3.8, openings: "wwwww", tier: 1, hold: 0.1, lit: seed % 3 });
  else wall(b, "brick", 0, -d / 2, w, 0.9, "x", { ...o, y: 3.5, tier: 1, hold: 0.1 });
  for (const s of [-1, 1]) b.part("brick", s * (w / 2 - 0.4), 1.9, -d / 2, 0.8, 3.4, 0.5, { c, hold: 0.5 });
  for (const s of [-1, 1]) b.part("windowLit", s * w * 0.27, 1.9, -d / 2, w * 0.36, 2.6, 0.16, { hold: -0.8 });
  b.part("paint", 0, 1.4, -d / 2, 1.3, 2.5, 0.14, { c: sign, hold: -0.4 });
  b.part("paint", 0, 3.4, -d / 2 - 0.3, w * 0.92, 0.75, 0.24, { c: sign, hold: -0.9, tier: 1 });
  for (let i = 0; i < 3; i++) b.part("paint", -w * 0.3 + i * w * 0.3, 2.95, -d / 2 - 1, w * 0.3, 0.07, 1.8, { c: i % 2 ? "#e6e1d3" : sign, rx: -0.28, hold: -1.3 });
  for (let i = 0; i < 4; i++) b.part("concrete", -w / 2 + (i + 0.5) * (w / 4), h + 0.15, 0, w / 4, 0.2, d, { c: "#6f706d", tier: 2, hold: -0.35 });
  for (const s of [-1, 1]) b.part("brick", 0, h + 0.6, (s * d) / 2, w, 0.8, 0.3, { c, tier: 3, hold: -0.2 });
  b.part("metal", w * 0.2, h + 0.85, 2, 2, 1.2, 1.6, { c: "#b7bbbb", tier: 3, hold: -0.5 });
  b.end();
}

export function gasStation(b: Builder, x: number, z: number, yaw: number) {
  b.begin("Gas station", "building", x, z, yaw, 2.2, 560000, 78);
  b.part("concrete", 0, 0.05, 0, 30, 0.1, 22, { c: "#7a7b79", hold: 99 });
  const o = { c: "#d9dad4", hold: 0.4, step: 2.5 };
  wall(b, "concrete", 0, 9, 12, 3.6, "x", o);
  wall(b, "concrete", -6, 6, 6, 3.6, "z", o);
  wall(b, "concrete", 6, 6, 6, 3.6, "z", o);
  for (const s of [-1, 0, 1]) b.part("windowLit", s * 3.6, 1.9, 3, 3.2, 3, 0.16, { hold: -0.6 });
  for (let i = 0; i < 4; i++) b.part("concrete", -4.5 + i * 3, 3.9, 6, 3, 0.3, 6.8, { c: "#a8392f", tier: 1, hold: -0.3 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.part("pipe", sx * 5, 2.5, -4 + sz * 2.2, 0.36, 5, 0.36, { c: "#e6e6e2", hold: 0.3 });
  for (let i = 0; i < 4; i++) {
    b.part("paint", -5.4 + i * 3.6, 5.3, -4, 3.6, 0.5, 8, { c: "#f0efea", tier: 1, hold: -0.45 });
    b.part("paint", -5.4 + i * 3.6, 5.3, -8.04, 3.6, 0.5, 0.1, { c: "#b03a2e", tier: 1, hold: -0.6 });
  }
  for (const s of [-1, 1]) for (const k of [-1, 1]) b.part("paint", s * 3.2, 0.95, -4 + k * 1.8, 0.7, 1.7, 0.5, { c: "#b03a2e", hold: -0.5 });
  b.part("pipe", 12, 4, -9, 0.4, 8, 0.4, { c: "#8c8f90", hold: 0.2 });
  b.part("paint", 12, 8.6, -9, 3.6, 2.2, 0.5, { c: "#b03a2e", hold: -0.5, tier: 1 });
  b.part("windowLit", 12, 8.6, -9, 2.6, 1.2, 0.56, { hold: -0.6, tier: 1 });
  b.end();
}

export function warehouse(b: Builder, x: number, z: number, yaw: number, seed: number) {
  const w = 34, d = 20, h = 7.5;
  const c = pick(["#8fa0a4", "#a99f88", "#7d8f86", "#9c8f8a"], seed);
  b.begin("Warehouse", "building", x, z, yaw, 2.95, 980000, 120);
  b.part("concrete", 0, 0.08, 0, w + 1, 0.2, d + 1, { c: "#868681", hold: 99 });
  const o = { c, hold: 0.5, step: 3.6 };
  wall(b, "metal", 0, -d / 2, w, h, "x", { ...o, openings: "  g  g  " });
  wall(b, "metal", 0, d / 2, w, h, "x", o);
  wall(b, "metal", -w / 2, 0, d, h, "z", { ...o, openings: " g  g" });
  wall(b, "metal", w / 2, 0, d, h, "z", o);
  for (const s of [-1, 1]) b.part("gableMetal", s * (w / 2 - 0.1), h + 0.2 + 1.2, 0, d, 2.4, 0.2, { c, ry: Math.PI / 2, tier: 1, hold: 0 });
  for (let i = 0; i < 6; i++) b.part("paint", -w / 2 + 3 + i * 5.6, h, 0, 0.35, 0.5, d, { c: "#7b4a3c", tier: 1, hold: 0.35 });
  gableRoof(b, "metal", w, d, h + 0.2, 2.4, 8, pick(["#9aa0a0", "#74808a", "#8a857a"], seed), 2, -0.4, 0.5);
  for (let i = 0; i < 8; i++) b.part("wood", -12 + (i % 4) * 7, 0.9 + Math.floor(i / 4) * 1.5, 4, 1.6, 1.4, 1.6, { c: "#b08d5c", hold: -2 });
  b.end();
}

export function silo(b: Builder, x: number, z: number, size = 1) {
  const r = 4.2 * size, rings = Math.round(5 * size);
  b.begin("Grain silo", "building", x, z, 0, 3.35, 240000 * size, 105 * size);
  b.part("concrete", 0, 0.2, 0, r * 2.2, 0.5, r * 2.2, { c: "#8a8780", hold: 99 });
  for (let i = 0; i < rings; i++) b.part("cyl", 0, 0.4 + 2.4 * (i + 0.5), 0, r * 2, 2.4, r * 2, { c: "#c3c8c8", hold: 0.5 - i * 0.09, tier: i, weight: 4 });
  b.part("cone", 0, 0.4 + rings * 2.4 + 1.2, 0, r * 2.15, 2.4, r * 2.15, { c: "#b4babb", hold: -0.25, tier: rings, weight: 2.4 });
  b.part("pipe", 0, 0.4 + rings * 2.4 + 2.7, 0, 0.9, 0.8, 0.9, { c: "#8d9394", hold: -0.4, tier: rings + 1 });
  for (let i = 0; i < 3; i++) b.part("pipe", r + 0.35, 2 + i * 3.2, 0, 0.2, 3.2, 0.2, { c: "#7d8283", hold: -0.6 });
  b.end();
}

export function farmBin(b: Builder, x: number, z: number) {
  b.begin("Grain bin", "building", x, z, 0, 1.7, 46000, 46);
  for (let i = 0; i < 3; i++) b.part("cyl", 0, 1 + i * 1.9, 0, 5, 1.9, 5, { c: "#c9cecd", hold: 0.3 - i * 0.12, tier: i, weight: 2.6 });
  b.part("cone", 0, 6.7, 0, 5.3, 1.7, 5.3, { c: "#b7bdbd", hold: -0.2, tier: 3, weight: 1.6 });
  b.end();
}

export function tank(b: Builder, x: number, z: number, r: number, h: number, c = "#d8d8d2") {
  b.begin("Storage tank", "building", x, z, 0, 3.7, 420000, 115);
  const n = Math.max(2, Math.round(h / 3));
  for (let i = 0; i < n; i++) b.part("cyl", 0, (h / n) * (i + 0.5), 0, r * 2, h / n, r * 2, { c, hold: 0.3 - i * 0.1, tier: i, weight: 5 });
  b.part("cone", 0, h + 0.6, 0, r * 2.02, 1.2, r * 2.02, { c: "#c4c4be", hold: -0.2, tier: n, weight: 3 });
  b.end();
}

export function waterTower(b: Builder, x: number, z: number) {
  b.begin("Water tower", "building", x, z, 0.4, 4.15, 1600000, 200);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.part("concrete", Math.cos(a) * 5.2, 0.3, Math.sin(a) * 5.2, 1.6, 0.6, 1.6, { c: "#8a8780", hold: 99 });
    for (let k = 0; k < 2; k++) b.part("pipe", Math.cos(a) * (5 - k * 0.7), 6 + k * 11, Math.sin(a) * (5 - k * 0.7), 0.6, 11.2, 0.6, { c: "#dfe3e2", hold: 0.35 - k * 0.2, tier: k, rx: Math.sin(a) * 0.06, rz: -Math.cos(a) * 0.06 });
  }
  b.part("pipe", 0, 11.5, 0, 1.6, 23, 1.6, { c: "#d3d8d7", hold: 0.3, weight: 4 });
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * Math.PI * 2;
    b.part("pipe", Math.cos(a) * 4.1, 11.5, Math.sin(a) * 4.1, 0.18, 5, 0.18, { c: "#dfe3e2", ry: -a, rx: Math.PI / 2, hold: 0.1, tier: 1 });
  }
  b.part("cyl", 0, 23.2, 0, 13, 0.5, 13, { c: "#c9cfcf", hold: 0.1, tier: 2, weight: 4 });
  b.part("dome", 0, 25.6, 0, 12, 8, 12, { c: "#dfe5e4", hold: 0, tier: 3, weight: 8 });
  b.part("cyl", 0, 27.4, 0, 12, 3.6, 12, { c: "#e4e9e8", hold: -0.05, tier: 3, weight: 8 });
  b.part("cone", 0, 30.9, 0, 12.4, 3.4, 12.4, { c: "#58717a", hold: -0.3, tier: 4, weight: 4 });
  b.end();
}

export function container(b: Builder, x: number, z: number, yaw: number, seed: number, y = 0) {
  b.begin("Shipping container", "vehicle", x, z, yaw, 2.55 - y * 0.1, 22000, 58);
  b.part("metal", 0, y + 1.35, 0, 12, 2.6, 2.5, { c: pick(["#9c4a35", "#3f6079", "#6d7a4e", "#b58a3c", "#7c7f80"], seed), weight: 3.4 });
  b.end();
}

export function substation(b: Builder, x: number, z: number) {
  b.begin("Substation", "building", x, z, 0, 2.3, 900000, 88);
  b.part("concrete", 0, 0.06, 0, 22, 0.14, 16, { c: "#82817b", hold: 99 });
  for (const sx of [-1, 0, 1])
    for (const sz of [-1, 1]) {
      b.part("metal", sx * 6.5, 1.5, sz * 3.6, 2.6, 2.6, 2, { c: "#7f8a80", hold: 0.2, weight: 2.4 });
      for (const k of [-1, 0, 1]) b.part("pipe", sx * 6.5 + k * 0.7, 3.5, sz * 3.6, 0.22, 1.4, 0.22, { c: "#5c3b2c", hold: -0.4, tier: 1 });
    }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.part("pipe", sx * 9.5, 4, sz * 6, 0.3, 8, 0.3, { c: "#9aa0a0", hold: 0.1 });
    b.part("metal", sx * 9.5, 8, 0, 0.5, 0.5, 13, { c: "#9aa0a0", hold: -0.1, tier: 1 });
  }
  b.end();
}
