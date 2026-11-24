// The county's plan in metres: x east, z north. The ground painter, the roads and the building layout all read it.
export const HALF = 330;

export type Crop = "corn" | "wheat" | "soy" | "plowed" | "pasture";
/** x0, z0, x1, z1 */
export type Rect = [number, number, number, number];

export const FIELDS: { r: Rect; crop: Crop; angle: number }[] = [
  { r: [-318, -318, -205, -70], crop: "corn", angle: 0 },
  { r: [-108, -318, -14, -196], crop: "wheat", angle: 1 },
  { r: [-108, -150, -14, -14], crop: "pasture", angle: 0 },
  { r: [14, -318, 318, -214], crop: "wheat", angle: 0 },
  { r: [-318, 14, -232, 120], crop: "soy", angle: 1 },
  { r: [-186, 14, -20, 78], crop: "wheat", angle: 0 },
  { r: [-318, 226, -150, 318], crop: "corn", angle: 1 },
  { r: [-140, 250, -24, 318], crop: "plowed", angle: 0 },
  { r: [24, 14, 170, 78], crop: "soy", angle: 0 },
  { r: [40, 276, 318, 318], crop: "plowed", angle: 1 },
  { r: [-318, -62, -205, -14], crop: "plowed", angle: 0 },
  { r: [24, -84, 318, -14], crop: "pasture", angle: 0 },
];

export interface Road {
  a: [number, number];
  b: [number, number];
  width: number;
  kind: "highway" | "street" | "dirt";
}

export const ROADS: Road[] = [
  { a: [-1400, 0], b: [1400, 0], width: 10, kind: "highway" },
  { a: [0, -1400], b: [0, 1400], width: 10, kind: "highway" },
  { a: [-128, 112], b: [128, 112], width: 7, kind: "street" },
  { a: [-128, 196], b: [312, 196], width: 7, kind: "street" },
  { a: [-128, 112], b: [-128, 196], width: 7, kind: "street" },
  { a: [5, -110], b: [262, -110], width: 6, kind: "street" },
  { a: [5, -190], b: [262, -190], width: 6, kind: "street" },
  { a: [262, -113], b: [262, -187], width: 6, kind: "street" },
  { a: [214, 5], b: [214, 268], width: 8, kind: "street" },
  { a: [-156, -5], b: [-156, -176], width: 4.5, kind: "dirt" },
  { a: [-156, -160], b: [-118, -160], width: 4.5, kind: "dirt" },
  { a: [-210, 5], b: [-210, 180], width: 4.5, kind: "dirt" },
];

/** Bare yards and gravel lots the ground is worn to. */
export const YARDS: { r: Rect; tone: "gravel" | "dirt" | "lawn" }[] = [
  { r: [-196, -186, -116, -104], tone: "lawn" },
  { r: [-172, -172, -126, -124], tone: "dirt" },
  { r: [-232, 128, -156, 206], tone: "lawn" },
  { r: [-222, 140, -176, 186], tone: "dirt" },
  { r: [14, -206, 254, -94], tone: "lawn" },
  { r: [140, 92, 312, 270], tone: "gravel" },
  { r: [-136, 84, 136, 240], tone: "lawn" },
  { r: [8, 8, 44, 40], tone: "gravel" },
];
