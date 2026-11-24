// Farm and home buildings. Every function builds one structure at (x, z) facing `yaw`.
import type { Builder } from "./builder";

const pick = <T>(list: T[], i: number) => list[Math.abs(Math.floor(i)) % list.length];
const WALLS = ["#e9e6dc", "#c9d3cf", "#d9c9a3", "#9fb0b5", "#e3d7c3", "#b7a98f", "#8fa08e", "#c7b3a0"];
const ROOFS = ["#4c4a4a", "#5a4438", "#3b4248", "#6a4b40", "#54524c"];

/** A wall run along x, split into panels of about `step` metres, with windows or a door let into some. */
function wall(b: Builder, shape: "siding" | "brick" | "wood" | "metal" | "concrete", x: number, z: number, len: number, h: number, along: "x" | "z", o: { c: string; step?: number; openings?: string; y?: number; hold?: number; tier?: number; lit?: number; thick?: number }) {
  const n = Math.max(1, Math.round(len / (o.step ?? 2.7)));
  const w = len / n;
  const thick = o.thick ?? 0.22;
  const y0 = o.y ?? 0.2;
  for (let i = 0; i < n; i++) {
    const at = -len / 2 + w * (i + 0.5);
    const px = along === "x" ? x + at : x;
    const pz = along === "x" ? z : z + at;
    const size: [number, number, number] = along === "x" ? [w, h, thick] : [thick, h, w];
    b.part(shape, px, y0 + h / 2, pz, ...size, { c: o.c, hold: o.hold ?? 0, tier: o.tier ?? 0 });
    const mark = o.openings?.[i];
    const face = (ww: number, hh: number, dd: number): [number, number, number] => (along === "x" ? [ww, hh, dd] : [dd, hh, ww]);
    if (mark === "w") b.part((i + Math.round(x * 3 + z)) % 3 === (o.lit ?? 0) ? "windowLit" : "window", px, y0 + h * 0.56, pz, ...face(Math.min(1.25, w * 0.55), 1.25, thick + 0.12), { hold: (o.hold ?? 0) - 0.25, tier: o.tier ?? 0 });
    if (mark === "d") b.part("paint", px, y0 + 1.05, pz, ...face(1, 2.1, thick + 0.1), { c: "#6d2f26", hold: (o.hold ?? 0) - 0.2, tier: o.tier ?? 0 });
    if (mark === "g") b.part("paint", px, y0 + 1.2, pz, ...face(w * 0.86, 2.3, thick + 0.1), { c: "#d5d3cb", hold: (o.hold ?? 0) - 0.2, tier: o.tier ?? 0 });
  }
}

/** A gable roof with its ridge along x, in strips on both slopes. */
function gableRoof(b: Builder, shape: "shingle" | "metal" | "wood", len: number, depth: number, y: number, rise: number, strips: number, c: string, tier: number, hold: number, over = 0.45) {
  const slope = Math.atan2(rise, depth / 2);
  const width = Math.hypot(rise, depth / 2) + over;
  const step = (len + over * 2) / strips;
  for (const side of [-1, 1])
    for (let i = 0; i < strips; i++) {
      const x = -len / 2 - over + step * (i + 0.5);
      const out = (width / 2) * Math.cos(slope);
      b.part(shape, x, y + rise - (width / 2) * Math.sin(slope) + 0.08, side * out, step, 0.16, width, { c, rx: side * slope, tier, hold: hold + (i % 2) * 0.08 });
    }
}

export function house(b: Builder, x: number, z: number, yaw: number, seed: number) {
  const two = seed % 3 === 1;
  const w = 10 + (seed % 3);
  const d = 7.5 + (seed % 2);
  const h = two ? 5.4 : 3;
  const c = pick(WALLS, seed * 3 + 1);
  const roof = pick(ROOFS, seed * 7 + 2);
  const rise = 2 + (seed % 2) * 0.5;
  b.begin(two ? "Two-storey house" : "House", "building", x, z, yaw, 2.1, two ? 310000 : 210000, two ? 60 : 50);
  b.part("concrete", 0, 0.1, 0, w + 0.5, 0.24, d + 0.5, { c: "#8d8b85", hold: 99 });
  b.part("wood", 0, 0.24, 0, w - 0.3, 0.05, d - 0.3, { c: "#9a7a55", hold: 99 });
  const storeys = two ? 2 : 1;
  for (let s = 0; s < storeys; s++) {
    const o = { c, y: 0.2 + s * 2.7, hold: 0.45 - s * 0.35, tier: s, lit: seed % 3 };
    wall(b, "siding", 0, -d / 2, w, two ? 2.7 : 3, "x", { ...o, openings: s ? "wwww" : "wdww" });
    wall(b, "siding", 0, d / 2, w, two ? 2.7 : 3, "x", { ...o, openings: "wwww" });
    wall(b, "siding", -w / 2, 0, d, two ? 2.7 : 3, "z", { ...o, openings: "w w" });
    wall(b, "siding", w / 2, 0, d, two ? 2.7 : 3, "z", { ...o, openings: " w " });
  }
  if (two) b.part("wood", 0, 2.9, 0, w - 0.4, 0.16, d - 0.4, { c: "#8d7654", hold: 0.3, tier: 1 });
  const top = 0.2 + h;
  for (const s of [-1, 1]) b.part("gable", s * (w / 2 - 0.1), top + rise / 2, 0, d, rise, 0.2, { c, ry: Math.PI / 2, tier: 2, hold: -0.1 });
  gableRoof(b, "shingle", w, d, top, rise, 4, roof, 3, -0.4);
  b.part("brick", w * 0.28, top + rise * 0.85, d * 0.2, 0.8, rise + 1, 0.8, { c: "#b9b0a8", tier: 3, hold: -0.2 });
  b.part("wood", 0, 0.35, -d / 2 - 1, w * 0.6, 0.3, 2, { c: "#a39684", hold: 0.2 });
  for (const s of [-1, 0, 1]) b.part("pipe", s * w * 0.27, 1.5, -d / 2 - 1.8, 0.16, 2.3, 0.16, { c: "#e8e6de", hold: -0.4 });
  b.part("shingle", 0, 2.75, -d / 2 - 1, w * 0.62, 0.12, 2.3, { c: roof, rx: -0.16, tier: 1, hold: -0.7 });
  b.part("paint", -w * 0.28, 0.6, d * 0.15, 2, 0.7, 0.9, { c: "#7a4a3a", hold: -0.9 });
  b.part("paint", w * 0.25, 0.55, -d * 0.18, 1.5, 0.5, 2, { c: "#c8cbd0", hold: -0.9 });
  b.part("paint", w * 0.36, 1.1, d * 0.3, 0.8, 1.7, 0.7, { c: "#dfe1e2", hold: -0.8 });
  b.end();
}

export function barn(b: Builder, x: number, z: number, yaw: number, red = true) {
  const w = 16, d = 11, h = 4.6;
  const c = red ? "#b8402c" : "#c9c4b6";
  b.begin("Barn", "building", x, z, yaw, 1.55, 160000, 70);
  b.part("concrete", 0, 0.08, 0, w + 0.4, 0.2, d + 0.4, { c: "#7c766b", hold: 99 });
  const o = { c, hold: 0.45, step: 2.0 };
  wall(b, "wood", 0, -d / 2, w, h, "x", { ...o, openings: "  w  w " });
  wall(b, "wood", 0, d / 2, w, h, "x", { ...o, openings: "  w  w " });
  wall(b, "wood", -w / 2, 0, d, h, "z", o);
  wall(b, "wood", w / 2, 0, d, h, "z", o);
  // Big cross-braced doors on both gable ends.
  for (const s of [-1, 1])
    for (const k of [-1, 1]) {
      b.part("wood", s * (w / 2 + 0.16), 1.95, k * 1.5, 0.12, 3.5, 2.8, { c: red ? "#a23522" : "#a9a394", hold: 0.1 });
      b.part("paint", s * (w / 2 + 0.25), 1.95, k * 1.5, 0.08, 0.2, 4.3, { c: "#ece9df", rx: 0.88 * k, hold: 0 });
      b.part("paint", s * (w / 2 + 0.25), 1.95, k * 1.5, 0.08, 0.2, 4.3, { c: "#ece9df", rx: -0.88 * k, hold: 0 });
      b.part("paint", s * (w / 2 + 0.25), 3.7, k * 1.5, 0.08, 0.22, 2.9, { c: "#ece9df", hold: 0 });
    }
  for (const s of [-1, 1]) {
    b.part("gableWood", s * (w / 2 - 0.1), h + 0.2 + 1.9, 0, d, 3.8, 0.2, { c, ry: Math.PI / 2, tier: 1, hold: 0 });
    b.part("window", s * (w / 2 + 0.06), h + 1.6, 0, 0.2, 1.3, 1.3, { tier: 1, hold: -0.2 });
  }
  for (let i = 0; i < 4; i++) b.part("wood", -w / 2 + 2.6 + i * 3.6, h, 0, 0.26, 0.26, d, { c: "#6b5138", tier: 1, hold: 0.1 });
  gableRoof(b, "metal", w, d, h + 0.2, 3.8, 6, red ? "#8f9698" : "#6f4034", 2, -0.35, 0.6);
  for (let i = 0; i < 7; i++) b.part("bale", -5 + (i % 4) * 3, 0.9 + Math.floor(i / 4) * 1.3, -2.6, 1.1, 1.1, 1.1, { c: "#c9a253", hold: -1.2 });
  b.end();
}

export function shed(b: Builder, x: number, z: number, yaw: number, c = "#8a7f6d") {
  b.begin("Shed", "building", x, z, yaw, 0.75, 14000, 18);
  const o = { c, hold: 0.2, step: 1.6, y: 0.1 };
  wall(b, "wood", 0, -1.7, 4.4, 2.3, "x", { ...o, openings: " d " });
  wall(b, "wood", 0, 1.7, 4.4, 2.3, "x", o);
  wall(b, "wood", -2.2, 0, 3.4, 2.3, "z", o);
  wall(b, "wood", 2.2, 0, 3.4, 2.3, "z", o);
  for (let i = 0; i < 3; i++) b.part("metal", -1.7 + i * 1.7, 2.58, 0, 1.75, 0.08, 4.4, { c: "#a3a7a6", rx: 0.12, tier: 1, hold: -0.2 });
  b.end();
}

export function trailer(b: Builder, x: number, z: number, yaw: number, seed: number) {
  const w = 14, d = 4.2, h = 2.6;
  const c = pick(["#dcd8cb", "#b9c5c4", "#cfc3a5", "#a9b6a2", "#d3b9a5"], seed);
  const trim = pick(["#5d7a86", "#8a4a3a", "#6a7a4a", "#7d6a52"], seed * 3);
  b.begin("Mobile home", "building", x, z, yaw, 1.15, 72000, 42);
  for (const s of [-1, 0, 1]) b.part("concrete", s * 5, 0.25, 0, 0.8, 0.5, d - 0.6, { c: "#8b877e", hold: 99 });
  b.part("metal", 0, 0.65, 0, w, 0.3, d, { c: "#5b5d5c", hold: 0.75 });
  const o = { c, hold: 0.3, step: 2.4, y: 0.8, lit: seed % 3 };
  wall(b, "siding", 0, -d / 2, w, h, "x", { ...o, openings: "w wdww" });
  wall(b, "siding", 0, d / 2, w, h, "x", { ...o, openings: "ww w w" });
  wall(b, "siding", -w / 2, 0, d, h, "z", { ...o, openings: "w" });
  wall(b, "siding", w / 2, 0, d, h, "z", { ...o, openings: " w" });
  for (const s of [-1, 1]) b.part("paint", 0, 0.45, s * (d / 2 - 0.02), w, 0.7, 0.08, { c: trim, hold: -0.2 });
  for (let i = 0; i < 6; i++) b.part("metal", -w / 2 + (i + 0.5) * (w / 6), 3.5, 0, w / 6, 0.14, d + 0.4, { c: "#c4c8c6", tier: 1, hold: -0.15 });
  b.part("wood", 0.8, 0.5, -d / 2 - 1.1, 2.6, 0.2, 2, { c: "#8e7c63", hold: -0.1 });
  b.part("metal", 0.8, 2.9, -d / 2 - 1.1, 3, 0.07, 2.2, { c: trim, hold: -0.35 });
  for (const s of [-1, 1]) b.part("pipe", 0.8 + s * 1.3, 1.7, -d / 2 - 2, 0.08, 2.4, 0.08, { c: "#dddddd", hold: -0.4 });
  b.part("paint", w / 2 + 0.9, 0.75, 0, 1.3, 1, 0.8, { c: "#e0dfd9", hold: -0.5 });
  b.end();
}

export function church(b: Builder, x: number, z: number, yaw: number) {
  const w = 18, d = 10, h = 5.2;
  const c = "#eceae2";
  b.begin("Church", "building", x, z, yaw, 2.5, 780000, 95);
  b.part("concrete", 0, 0.1, 0, w + 0.6, 0.3, d + 0.6, { c: "#8d8b85", hold: 99 });
  const o = { c, hold: 0.5, step: 2.6, lit: 1 };
  wall(b, "siding", 0, -d / 2, w, h, "x", { ...o, openings: " w w w " });
  wall(b, "siding", 0, d / 2, w, h, "x", { ...o, openings: " w w w " });
  wall(b, "siding", -w / 2, 0, d, h, "z", o);
  wall(b, "siding", w / 2, 0, d, h, "z", { ...o, openings: " d " });
  for (const s of [-1, 1]) b.part("gable", s * (w / 2 - 0.1), h + 0.2 + 2, 0, d, 4, 0.2, { c, ry: Math.PI / 2, tier: 1, hold: 0 });
  gableRoof(b, "shingle", w, d, h + 0.2, 4, 6, "#494b4e", 2, -0.4);
  const tx = w / 2 + 1.2;
  for (const s of [-1, 1]) {
    b.part("siding", tx, 4.6, s * 1.5, 3.2, 9, 0.22, { c, hold: 0.4 });
    b.part("siding", tx + s * 1.5, 4.6, 0, 0.22, 9, 3, { c, hold: 0.4 });
    b.part("windowLit", tx, 7.4, s * 1.5, 1, 1.4, 0.36, { hold: 0 });
  }
  b.part("paint", tx, 9.3, 0, 3.7, 0.4, 3.7, { c: "#d5d3ca", tier: 1, hold: 0.1 });
  b.part("cone", tx, 12, 0, 3.4, 5, 3.4, { c: "#4a4d50", tier: 2, hold: -0.2 });
  b.part("paint", tx, 15.2, 0, 0.16, 1.6, 0.16, { c: "#f4efe0", tier: 3, hold: -0.6 });
  b.part("paint", tx, 15.4, 0, 0.16, 0.16, 0.9, { c: "#f4efe0", tier: 3, hold: -0.6 });
  b.end();
}

export { wall, gableRoof, pick };
