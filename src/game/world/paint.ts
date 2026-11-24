// Paints the county from above onto a canvas, north up. The far country uses the same painter at a lower resolution.
import { hash } from "../weather/noise";
import type { Structure } from "./builder";
import { FIELDS, YARDS, type Crop } from "./plan";

const CROPS: Record<Crop, [string, string, number]> = {
  corn: ["#4f6330", "#3c4d26", 1.5],
  wheat: ["#a3884a", "#8d7440", 2.2],
  soy: ["#51662f", "#6a6b3c", 2],
  plowed: ["#5b4a38", "#4b3c2d", 1.8],
  pasture: ["#6d7042", "#63693d", 9],
};
const TONES = { gravel: "#77736a", dirt: "#6f5d45", lawn: "#606c3c" };

export function paintCounty(g: CanvasRenderingContext2D, size: number, px: number, structures: Structure[]) {
  const k = px / size;
  const X = (x: number) => (x + size / 2) * k;
  const Y = (z: number) => (size / 2 - z) * k;
  const rect = (r: readonly number[], fill: string) => {
    g.fillStyle = fill;
    g.fillRect(X(r[0]), Y(r[3]), (r[2] - r[0]) * k, (r[3] - r[1]) * k);
  };
  g.fillStyle = "#6a6d42";
  g.fillRect(0, 0, px, px);

  // Far fields on the section grid, drawn around the county.
  const cell = 160;
  for (let i = -10; i < 10; i++)
    for (let j = -10; j < 10; j++) {
      const r = [i * cell + 8, j * cell + 8, (i + 1) * cell - 8, (j + 1) * cell - 8];
      if (r[2] > -330 && r[0] < 330 && r[3] > -330 && r[1] < 330) continue;
      const list: Crop[] = ["corn", "wheat", "soy", "plowed", "pasture", "wheat"];
      field(r, list[Math.floor(hash(i, j, 9) * 6)], hash(j, i, 4) > 0.5 ? 1 : 0);
    }
  for (const f of FIELDS) field(f.r, f.crop, f.angle);

  function field(r: readonly number[], crop: Crop, angle: number) {
    const [a, b, step] = CROPS[crop];
    rect(r, a);
    g.fillStyle = b;
    const w = Math.max(1, step * k * 0.45);
    if (step * k > 1.5) {
      if (angle) for (let x = r[0]; x < r[2]; x += step) g.fillRect(X(x), Y(r[3]), w, (r[3] - r[1]) * k);
      else for (let z = r[1]; z < r[3]; z += step) g.fillRect(X(r[0]), Y(z), (r[2] - r[0]) * k, w);
    }
    // Tractor lanes and uneven patches.
    g.globalAlpha = 0.22;
    for (let n = 0; n < 26; n++) {
      const x = r[0] + hash(n, r[0]) * (r[2] - r[0]);
      const z = r[1] + hash(n, r[1], 2) * (r[3] - r[1]);
      blot(x, z, 4 + hash(n, r[2]) * 14, hash(n, 5) > 0.5 ? "#46502a" : "#a89a5e");
    }
    g.globalAlpha = 1;
  }

  function blot(x: number, z: number, r: number, color: string) {
    const fade = g.createRadialGradient(X(x), Y(z), 0, X(x), Y(z), r * k);
    fade.addColorStop(0, color);
    fade.addColorStop(1, `${color}00`);
    g.fillStyle = fade;
    g.fillRect(X(x - r), Y(z + r), 2 * r * k, 2 * r * k);
  }

  for (const y of YARDS) {
    rect(y.r, TONES[y.tone]);
    const [x0, z0, x1, z1] = y.r;
    g.globalAlpha = 0.5;
    for (let n = 0; n < 90; n++) blot(x0 + hash(n, x0) * (x1 - x0), z0 + hash(n, z0, 3) * (z1 - z0), 2 + hash(n, 8) * 9, y.tone === "lawn" ? (n % 2 ? "#55672f" : "#768246") : n % 2 ? "#5c564b" : "#89826f");
    g.globalAlpha = 1;
  }

  // Contact shade and trodden ground under everything that stands.
  for (const s of structures) {
    if (s.kind === "building") {
      g.globalAlpha = 0.5;
      blot(s.x, s.z, s.radius * 1.5, "#6e614b");
    }
    g.globalAlpha = s.kind === "building" ? 0.75 : 0.5;
    if (s.kind === "building" || s.kind === "vehicle") blot(s.x, s.z, s.radius * 1.15, "#1b1b16");
    else if (s.kind === "tree") blot(s.x, s.z, s.radius * 1.2, "#232815");
  }
  g.globalAlpha = 1;
}
