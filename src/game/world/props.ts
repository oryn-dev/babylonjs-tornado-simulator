// Single things that go up whole: trees, cars, fences, poles, signs, bales.
import type { Builder } from "./builder";
import { pick } from "./homes";
import { hash } from "../weather/noise";

const CARS = ["#8f2b24", "#d8d9d6", "#2d4a63", "#3a3d40", "#9aa1a4", "#5f6f4b", "#b7923f", "#16191c", "#e7e4da"];

export function tree(b: Builder, x: number, z: number, size: number, kind: "tree" | "pine" | "bush" = "tree") {
  const r = hash(x, z, 3);
  const c = kind === "pine" ? pick(["#3d5a3c", "#34513a", "#476143"], r * 9) : pick(["#566f3c", "#637a42", "#4d693c", "#76804a", "#5d7548"], r * 11);
  b.begin(kind === "bush" ? "Bush" : size > 9 ? "Big tree" : "Tree", "tree", x, z, r * 6.28, kind === "bush" ? 0.35 : 0.75 + size * 0.07, kind === "bush" ? 200 : 900 + size * 120, kind === "bush" ? 4 : 12 + size * 1.6);
  const w = kind === "pine" ? size * 0.85 : size * (0.9 + r * 0.2);
  b.part(kind, 0, 0, 0, w, size, w, { c, weight: kind === "bush" ? 0.5 : 0.9 + size * 0.09 });
  b.end();
}

export function car(b: Builder, x: number, z: number, yaw: number, seed: number, kind: "sedan" | "pickup" = seed % 3 === 0 ? "pickup" : "sedan") {
  b.begin(kind === "sedan" ? "Car" : "Pickup truck", "vehicle", x, z, yaw, kind === "sedan" ? 1.3 : 1.5, kind === "sedan" ? 24000 : 36000, kind === "sedan" ? 32 : 35);
  b.part(kind, 0, kind === "sedan" ? 0.72 : 0.92, 0, 1, 1, 1, { c: pick(CARS, seed * 5 + 3), weight: kind === "sedan" ? 1.5 : 1.8 });
  b.end();
}

export function tractor(b: Builder, x: number, z: number, yaw: number) {
  b.begin("Tractor", "vehicle", x, z, yaw, 1.75, 90000, 40);
  b.part("tractor", 0, 1.3, 0, 1.1, 1.1, 1.1, { c: "#2f6b34", weight: 2.1 });
  b.end();
}

export function truck(b: Builder, x: number, z: number, yaw: number, seed: number) {
  b.begin("Semi truck", "vehicle", x, z, yaw, 2.25, 140000, 64);
  b.part("metal", 0, 2.3, -2.4, 2.5, 2.8, 11, { c: pick(["#e6e6e2", "#b8bcbd", "#6f8794"], seed), weight: 3, hold: 0 });
  b.part("paint", 0, 0.75, -2.4, 1.2, 0.5, 11, { c: "#2c2e30", hold: 0.2 });
  b.part("paint", 0, 1.9, 5.2, 2.4, 2.7, 2.3, { c: pick(["#8f2b24", "#2d4a63", "#3f6145"], seed), weight: 2.2, hold: 0.1 });
  b.part("window", 0, 2.5, 6.36, 2.1, 1, 0.12, { hold: -0.2 });
  b.part("paint", 0, 1.1, 6.9, 2.2, 1.2, 1.4, { c: pick(["#8f2b24", "#2d4a63", "#3f6145"], seed), weight: 1.6, hold: 0.1 });
  for (const s of [-1, 1]) for (const z2 of [-7, -5.8, 3.4, 6.6]) b.part("pipe", s * 1.1, 0.5, z2, 1, 0.35, 1, { c: "#141414", rz: Math.PI / 2, hold: 0.2 });
  b.end();
}

export function bale(b: Builder, x: number, z: number) {
  b.begin("Hay bale", "loose", x, z, hash(x, z) * 6.28, 0.2, 90, 6);
  b.part("bale", 0, 0.78, 0, 1.05, 1.05, 1.05, { c: "#cda652", weight: 0.5 });
  b.end();
}

export function mailbox(b: Builder, x: number, z: number, yaw: number) {
  b.begin("Mailbox", "loose", x, z, yaw, 0.3, 120, 3);
  b.part("wood", 0, 0.55, 0, 0.12, 1.1, 0.12, { c: "#8a7557", hold: 0.1 });
  b.part("paint", 0, 1.2, 0, 0.28, 0.3, 0.55, { c: pick(["#39424a", "#8f2b24", "#d9d7cf"], x * 3 + z), weight: 0.2 });
  b.end();
}

export function trash(b: Builder, x: number, z: number, c = "#39503f") {
  b.begin("Trash bin", "loose", x, z, hash(x, z) * 6, 0.25, 90, 4);
  b.part("paint", 0, 0.5, 0, 0.6, 1, 0.65, { c, weight: 0.25 });
  b.end();
}

/** A rail or board fence between two points, one structure per section. */
export function fence(b: Builder, x0: number, z0: number, x1: number, z1: number, style: "rail" | "board" = "rail") {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 3.2));
  const yaw = Math.atan2(-(z1 - z0), x1 - x0);
  const c = style === "board" ? "#e4e1d7" : "#8c7a5f";
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const step = len / n;
    b.begin("Fence", "fence", x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, yaw, 0.1 + hash(x0 + i, z0) * 0.25, 260, 5);
    b.part("wood", -step / 2, 0.6, 0, 0.14, 1.2, 0.14, { c, hold: 0.15, weight: 0.3 });
    if (style === "rail") for (const y of [0.42, 0.95]) b.part("wood", 0, y, 0, step, 0.13, 0.07, { c, weight: 0.28 });
    else for (let k = 0; k < 4; k++) b.part("wood", -step / 2 + (k + 0.5) * (step / 4), 0.6, 0.06, step / 4 - 0.12, 1.1, 0.04, { c, weight: 0.2, hold: (k % 2) * 0.1 });
    b.end();
  }
}

export function pole(b: Builder, x: number, z: number, yaw: number) {
  b.begin("Power pole", "pole", x, z, yaw, 1.2, 5200, 26);
  b.part("pipe", 0, 4.5, 0, 0.3, 9, 0.3, { c: "#5d4936", weight: 1.3, hold: 0.1 });
  b.part("wood", 0, 8.3, 0, 2.6, 0.18, 0.16, { c: "#7b6146", hold: 0, tier: 1, weight: 0.4 });
  for (const s of [-1, 1]) b.part("pipe", s * 1.1, 8.5, 0, 0.1, 0.3, 0.1, { c: "#a9c2b8", hold: 0.05, tier: 1 });
  if (hash(x, z, 8) > 0.6) b.part("pipe", 0.35, 7.2, 0, 0.5, 0.9, 0.5, { c: "#8d9494", hold: 0, tier: 1, weight: 0.8 });
  b.end();
}

export function lamp(b: Builder, x: number, z: number, yaw: number) {
  b.begin("Street lamp", "pole", x, z, yaw, 1.35, 3800, 20);
  b.part("pipe", 0, 2.8, 0, 0.16, 5.6, 0.16, { c: "#3d4245", weight: 0.9 });
  b.part("paint", 0, 5.6, -0.7, 0.12, 0.1, 1.5, { c: "#3d4245", weight: 0.4, tier: 1 });
  b.part("windowLit", 0, 5.5, -1.4, 0.34, 0.12, 0.6, { tier: 1, hold: -0.1 });
  b.end();
}

export function billboard(b: Builder, x: number, z: number, yaw: number, seed: number) {
  b.begin("Billboard", "pole", x, z, yaw, 1.25, 18000, 34);
  for (const s of [-1, 1]) b.part("pipe", s * 2.6, 2.6, 0, 0.35, 5.2, 0.35, { c: "#4d5052", hold: 0.3 });
  for (let i = 0; i < 3; i++) b.part("paint", -2.8 + i * 2.8, 6.6, 0, 2.78, 3.4, 0.2, { c: pick(["#d9c27a", "#4f7f94", "#b5563d"], seed), tier: 1, hold: i * 0.07 });
  b.part("paint", -1, 6.9, -0.14, 4.6, 0.5, 0.06, { c: "#f2efe4", tier: 1, hold: -0.2 });
  b.part("paint", -1.6, 6.1, -0.14, 3.2, 0.3, 0.06, { c: "#f2efe4", tier: 1, hold: -0.2 });
  b.end();
}

export function windpump(b: Builder, x: number, z: number) {
  b.begin("Wind pump", "pole", x, z, 0.4, 0.95, 9000, 28);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.part("pipe", sx * 0.8, 4, sz * 0.8, 0.12, 8.2, 0.12, { c: "#9ba09e", hold: 0.2, rx: -sz * 0.09, rz: sx * 0.09 });
  for (const y of [2, 4, 6]) b.part("pipe", 0, y, 0, 0.07, 1.9, 0.07, { c: "#9ba09e", rx: Math.PI / 2, hold: 0.1 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.part("paint", Math.cos(a) * 0.9, 8.4 + Math.sin(a) * 0.9, -0.6, 0.9, 0.34, 0.04, { c: "#c9cdc9", rz: a, rx: 0.2, hold: -0.2, tier: 1 });
  }
  b.part("paint", 0, 8.4, 0.9, 0.05, 0.8, 1.4, { c: "#a33c2c", hold: -0.1, tier: 1 });
  b.end();
}

export function sign(b: Builder, x: number, z: number, yaw: number, c = "#2f6b45") {
  b.begin("Road sign", "pole", x, z, yaw, 0.55, 650, 8);
  b.part("pipe", 0, 1.2, 0, 0.08, 2.4, 0.08, { c: "#9aa0a0", hold: 0.2 });
  b.part("paint", 0, 2.4, -0.06, 1.2, 0.8, 0.05, { c, tier: 1 });
  b.end();
}

export function playset(b: Builder, x: number, z: number, yaw: number) {
  b.begin("Swing set", "loose", x, z, yaw, 0.5, 900, 10);
  for (const s of [-1, 1]) for (const k of [-1, 1]) b.part("pipe", s * 1.6, 1.1, k * 0.5, 0.09, 2.4, 0.09, { c: "#a8443a", rx: -k * 0.42, hold: 0.1 });
  b.part("pipe", 0, 2.2, 0, 0.09, 3.4, 0.09, { c: "#a8443a", rz: Math.PI / 2, tier: 1 });
  for (const s of [-1, 1]) b.part("paint", s * 0.7, 0.7, 0, 0.5, 0.06, 0.25, { c: "#3d6aa0", hold: -0.2 });
  b.end();
}

export function picnic(b: Builder, x: number, z: number, yaw: number) {
  b.begin("Picnic table", "loose", x, z, yaw, 0.4, 350, 7);
  b.part("wood", 0, 0.75, 0, 1.8, 0.08, 0.8, { c: "#a5875c" });
  for (const s of [-1, 1]) b.part("wood", 0, 0.45, s * 0.75, 1.8, 0.07, 0.3, { c: "#a5875c" });
  for (const s of [-1, 1]) b.part("wood", s * 0.6, 0.38, 0, 0.1, 0.75, 1.3, { c: "#8d7250" });
  b.end();
}
