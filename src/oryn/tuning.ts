import file from "../../game/tuning.json";

export interface Knob {
  id: string;
  label?: string;
  value: number;
  min?: number;
  max?: number;
}

const knobs = new Map<string, Knob>(readKnobs(file).map((knob) => [knob.id, knob]));

function readKnobs(data: unknown): Knob[] {
  const list = (data as { knobs?: unknown })?.knobs;
  if (!Array.isArray(list)) return [];
  return list.filter((knob): knob is Knob => typeof knob?.id === "string" && typeof knob?.value === "number");
}

function clamp(knob: Knob, value: number) {
  return Math.min(knob.max ?? Infinity, Math.max(knob.min ?? -Infinity, value));
}

export const tuning = {
  number(id: string, fallback: number): number {
    const knob = knobs.get(id);
    return knob ? clamp(knob, knob.value) : fallback;
  },
  set(id: string, value: number) {
    const knob = knobs.get(id);
    if (knob) knob.value = clamp(knob, value);
  },
  knobs(): Knob[] {
    return [...knobs.values()];
  },
};

export type Tuning = typeof tuning;
