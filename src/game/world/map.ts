import { hash } from "../weather/noise";
import { Builder, type Structure } from "./builder";
import { barn, church, house, shed, trailer } from "./homes";
import { FIELDS, HALF, ROADS } from "./plan";
import * as P from "./props";
import { container, farmBin, gasStation, shop, silo, substation, tank, warehouse, waterTower } from "./town";

const PI = Math.PI;
/** Wires of a pole run to the next one; a pole that falls drops its own and its neighbour's. */
export const wires = new Map<Structure, Structure | null>();

export function buildMap(b: Builder) {
  farmA(b);
  farmB(b);
  trailerPark(b);
  town(b);
  industry(b);
  roadside(b);
  woods(b);
}

function farmA(b: Builder) {
  barn(b, -142, -138, PI / 2);
  house(b, -126, -172, PI / 2 + 0.05, 4);
  farmBin(b, -164, -126);
  farmBin(b, -171, -126);
  shed(b, -168, -150, 0.2, "#93816a");
  shed(b, -116, -146, PI / 2, "#7d8577");
  P.windpump(b, -178, -138);
  P.tractor(b, -152, -158, 0.8);
  P.car(b, -137, -165, 0.4, 3, "pickup");
  P.car(b, -133, -158, 1.9, 4, "sedan");
  for (let i = 0; i < 16; i++) P.bale(b, -196 + (i % 8) * 4.6 + hash(i, 1) * 1.4, -196 - Math.floor(i / 8) * 6 - hash(i, 2) * 2);
  for (let i = 0; i < 7; i++) P.bale(b, -186 + hash(i, 4) * 16, -174 + hash(i, 5) * 12);
  P.fence(b, -200, -188, -118, -188);
  P.fence(b, -200, -188, -200, -108);
  P.fence(b, -200, -108, -162, -108);
  P.fence(b, -182, -166, -182, -144);
  P.fence(b, -112, -186, -112, -156, "board");
  P.fence(b, -112, -186, -138, -186, "board");
  P.mailbox(b, -150, -10, 0);
  P.picnic(b, -134, -180, 0.5);
  P.playset(b, -120, -182, 1.1);
  P.trash(b, -121, -160);
  P.trash(b, -122, -161.5, "#3c4a5a");
  for (const [x, z, s] of [[-112, -176, 11], [-136, -190, 9], [-180, -112, 10], [-116, -128, 8], [-190, -160, 9]]) P.tree(b, x, z, s);
}

function farmB(b: Builder) {
  barn(b, -186, 160, 0, false);
  house(b, -218, 150, PI / 2, 7);
  silo(b, -196, 178, 0.8);
  farmBin(b, -176, 182);
  shed(b, -222, 170, 0.1);
  P.tractor(b, -200, 146, 2.2);
  P.car(b, -212, 162, 1, 9, "pickup");
  for (let i = 0; i < 10; i++) P.bale(b, -176 + (i % 5) * 4, 198 + Math.floor(i / 5) * 4);
  P.fence(b, -234, 126, -160, 126, "board");
  P.fence(b, -160, 126, -160, 208);
  P.fence(b, -234, 126, -234, 208);
  P.windpump(b, -168, 140);
  P.mailbox(b, -205, 8, 0);
  for (const [x, z, s] of [[-228, 140, 10], [-230, 190, 12], [-164, 200, 9]]) P.tree(b, x, z, s);
}

function trailerPark(b: Builder) {
  let n = 0;
  for (const [z, side] of [[-110, 1], [-110, -1], [-190, 1], [-190, -1]] as const)
    for (let x = 34; x < 246; x += 24) {
      const depth = side * 12.5;
      if (z === -190 && side < 0 && n % 5 === 2) {
        n++;
        continue;
      }
      trailer(b, x + hash(x, z) * 3, z + depth, PI / 2 + (side > 0 ? 0 : PI) + (hash(x, z, 2) - 0.5) * 0.14 + PI / 2, n);
      P.mailbox(b, x - 8, z + side * 4, 0);
      if (n % 2 === 0) P.car(b, x + 10.5, z + side * 9, hash(n, 3) > 0.5 ? 0 : PI, n + 2);
      if (n % 3 === 0) P.trash(b, x - 9, z + side * 5);
      if (n % 4 === 1) P.picnic(b, x + 10, z + side * 16, n);
      if (n % 5 === 0) shed(b, x + 11, z + side * 19, 0, "#a3a69c");
      if (n % 3 === 1) P.tree(b, x - 11, z + side * 18, 7 + hash(n, 1) * 3);
      n++;
    }
  P.playset(b, 150, -150, 0.3);
  P.playset(b, 158, -147, 1.3);
  for (let i = 0; i < 4; i++) P.picnic(b, 120 + i * 7, -150 + (i % 2) * 5, i);
  P.fence(b, 18, -208, 256, -208);
  P.fence(b, 272, -206, 272, -94);
  P.sign(b, 12, -104, 0, "#3a5f7d");
}

function town(b: Builder) {
  let n = 0;
  for (const side of [-1, 1])
    for (let z = 100; z < 246; z += 16) {
      if (Math.abs(z - 112) < 10 || Math.abs(z - 196) < 10) continue;
      shop(b, side * 18.5, z, side > 0 ? PI / 2 : -PI / 2, n++);
    }
  for (let z = 94; z < 248; z += 22) for (const side of [-1, 1]) P.lamp(b, side * 7.4, z + side * 4, (side * -PI) / 2);
  for (let z = 96, i = 0; z < 244; z += 9.5, i++) {
    if (Math.abs(z - 112) < 9 || Math.abs(z - 196) < 9) continue;
    if (hash(z, 1) > 0.3) P.car(b, -5.2, z, PI, i);
    if (hash(z, 2) > 0.4) P.car(b, 5.2, z + 3, 0, i + 4);
    if (hash(z, 3) > 0.6) P.trash(b, 8.6, z + 2, "#4a4d4f");
  }
  n = 0;
  for (const z of [112, 196])
    for (const side of [-1, 1])
      for (let x = -116; x <= 116; x += 22) {
        if (Math.abs(x) < 36) continue;
        if (x > 60 && z === 196 && side > 0) continue;
        if (x > 92 && z === 112 && side > 0) continue;
        const hx = x + hash(x, z) * 3;
        house(b, hx, z + side * 17, side > 0 ? 0 : PI, n);
        if (n % 2 === 0) P.car(b, hx + 8, z + side * 9, side > 0 ? 0 : PI, n + 1);
        P.mailbox(b, hx - 4, z + side * 4.4, 0);
        if (n % 3 === 0) P.fence(b, hx - 9, z + side * 27, hx + 9, z + side * 27, "board");
        P.tree(b, hx - 8.5, z + side * 8.5, 6.5 + hash(n, 5) * 3.5);
        if (n % 2) P.tree(b, hx + 7, z + side * 25, 8 + hash(n, 6) * 4);
        if (n % 4 === 1) P.playset(b, hx - 4, z + side * 26, n);
        if (n % 4 === 2) P.trash(b, hx + 5, z + side * 6);
        for (let k = 0; k < 3; k++) P.tree(b, hx - 4 + k * 4.2, z + side * 11.4, 1.1 + hash(k, n) * 0.4, "bush");
        n++;
      }
  church(b, 96, 214, PI);
  waterTower(b, 60, 228);
  gasStation(b, 26, 24, 0);
  P.car(b, 18, 18, PI / 2, 5);
  P.car(b, 32, 22, PI / 2, 8, "pickup");
  P.truck(b, 46, 18, PI / 2 + 0.2, 1);
}

function industry(b: Builder) {
  warehouse(b, 184, 130, 0, 0);
  warehouse(b, 184, 164, PI, 1);
  warehouse(b, 256, 120, PI / 2, 2);
  warehouse(b, 186, 232, 0, 3);
  silo(b, 246, 176, 1.15);
  silo(b, 258, 176, 1.15);
  silo(b, 270, 176, 1.15);
  silo(b, 252, 166, 0.9);
  tank(b, 290, 120, 6, 9);
  tank(b, 290, 138, 6, 9);
  tank(b, 290, 102, 4.4, 7, "#b9c4c6");
  substation(b, 262, 226);
  for (let i = 0; i < 12; i++) container(b, 234 + (i % 3) * 14, 244 + Math.floor((i % 6) / 3) * 5, (hash(i, 2) - 0.5) * 0.1 + PI / 2 - PI / 2, i, i >= 6 ? 2.65 : 0);
  for (let i = 0; i < 4; i++) container(b, 152, 108 + i * 9, PI / 2, i + 3);
  P.truck(b, 207, 148, 0, 0);
  P.truck(b, 226, 138, PI, 2);
  P.truck(b, 200, 214, 0.2, 1);
  for (let i = 0; i < 8; i++) P.car(b, 222 + i * 3.4, 206, i % 2 ? 0 : PI, i + 11);
  P.fence(b, 140, 94, 208, 94);
  P.fence(b, 220, 94, 310, 94);
  P.fence(b, 310, 94, 310, 190);
  for (let i = 0; i < 6; i++) P.trash(b, 170 + i * 5, 147, "#2f5d73");
}

function poleRun(b: Builder, points: [number, number][], yaw: number) {
  let last: Structure | null = null;
  points.forEach(([x, z], i) => {
    const next = points[i + 1];
    P.pole(b, x, z, yaw);
    const s = b.structures[b.structures.length - 1];
    if (next) {
      const dx = next[0] - x;
      const dz = next[1] - z;
      const span = Math.hypot(dx, dz);
      const along = Math.atan2(dx, dz) - yaw;
      for (const side of [-1, 1])
        for (let k = 0; k < 3; k++) {
          const f = (k + 0.5) / 3;
          const drop = [0.45, 0.85, 0.45][k];
          const tilt = [0.09, 0, -0.09][k];
          const lx = side * 1.1 + Math.sin(along) * span * f;
          const lz = Math.cos(along) * span * f;
          b.part("pipe", lx, 8.55 - drop, lz, 0.05, span / 3 + 0.1, 0.05, { c: "#151718", ry: along, rx: PI / 2 + tilt, weight: 0, hold: -0.15 });
        }
      b.end();
    }
    wires.set(s, last);
    last = s;
  });
}

function roadside(b: Builder) {
  const line = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
  poleRun(b, line(-312, 312, 39).map((x) => [x, 9.5]), PI / 2);
  poleRun(b, line(-312, -24, 36).map((z) => [9.5, z]), 0);
  poleRun(b, line(-144, 120, 33).filter((x) => Math.abs(x) > 20).map((x) => [x, 118]), PI / 2);
  poleRun(b, line(30, 248, 36).map((x) => [x, -150]), PI / 2);
  poleRun(b, line(24, 270, 41).map((z) => [220.5, z]), 0);
  for (const [x, z, yaw, s] of [[-90, 13, 0.2, 0], [120, 13, -0.15, 1], [-260, 14, 0.1, 2], [13, -240, PI / 2, 1], [250, -12, PI, 0]]) P.billboard(b, x, z, yaw, s);
  for (const x of [-290, -230, -120, -60, 70, 160, 290]) P.sign(b, x, -7.5, PI, x % 4 ? "#2f6b45" : "#b7923f");
  for (const z of [-280, -220, -60, 60, 290]) P.sign(b, 7.5, z, PI / 2, "#b7923f");
  [[-250, 2.4], [-180, -2.4], [-70, 2.4], [90, -2.4], [150, 2.4], [280, -2.4]].forEach(([x, z], i) => P.car(b, x, z, z > 0 ? -PI / 2 : PI / 2, i));
  [[-2.4, -90], [2.4, -160], [-2.4, -260], [2.4, 60]].forEach(([x, z], i) => P.car(b, x, z, x > 0 ? 0 : PI, i + 6));
  P.truck(b, -36, 2.4, -PI / 2, 2);
  P.truck(b, 200, -2.4, PI / 2, 0);
  P.fence(b, -108, -14, -14, -14);
  P.fence(b, -108, -14, -108, -150);
  P.fence(b, 24, -14, 318, -14);
  P.fence(b, -318, -14, -166, -14);
}

/** Wind breaks between the fields, thin out near roads and buildings. */
function woods(b: Builder) {
  const clear = (x: number, z: number) =>
    ROADS.every((r) => distanceToRoad(x, z, r) > r.width / 2 + 3) && b.structures.every((s) => Math.hypot(s.x - x, s.z - z) > s.radius + 3);
  const row = (x0: number, z0: number, x1: number, z1: number, step: number, kind: "tree" | "pine") => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let d = 0; d < len; d += step) {
      const f = d / len;
      const x = x0 + (x1 - x0) * f + (hash(d, x0) - 0.5) * 5;
      const z = z0 + (z1 - z0) * f + (hash(d, z0, 4) - 0.5) * 5;
      if (clear(x, z)) P.tree(b, x, z, 7 + hash(x, z) * 5, kind);
    }
  };
  row(-203, -318, -203, -70, 11, "tree");
  row(-111, -318, -111, -196, 12, "tree");
  row(-318, 124, -240, 124, 10, "pine");
  row(-318, 222, -150, 222, 11, "tree");
  row(-140, 246, -24, 246, 12, "tree");
  row(24, 82, 136, 82, 12, "tree");
  row(24, -210, 318, -210, 14, "tree");
  row(140, 274, 318, 274, 11, "pine");
  row(-190, 82, -20, 82, 13, "tree");
  row(278, -206, 278, -20, 12, "pine");
  for (let i = 0; i < 70; i++) {
    const x = (hash(i, 21) - 0.5) * HALF * 1.9;
    const z = (hash(i, 22) - 0.5) * HALF * 1.9;
    const inField = FIELDS.some(({ r, crop }) => crop !== "pasture" && x > r[0] && x < r[2] && z > r[1] && z < r[3]);
    if (!inField && clear(x, z)) P.tree(b, x, z, 6 + hash(i, 23) * 5, hash(i, 24) > 0.75 ? "pine" : "tree");
  }
}

function distanceToRoad(x: number, z: number, r: (typeof ROADS)[number]) {
  const dx = r.b[0] - r.a[0];
  const dz = r.b[1] - r.a[1];
  const f = Math.min(1, Math.max(0, ((x - r.a[0]) * dx + (z - r.a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - r.a[0] - dx * f, z - r.a[1] - dz * f);
}
