export type Quality = "low" | "medium" | "high";

export interface Settings {
  volume: number;
  quality: Quality;
}

const KEY = "oryn:settings";
const listeners = new Set<(settings: Settings) => void>();

export const settings: Settings = { ...defaults(), ...stored() };

function defaults(): Settings {
  return { volume: 0.8, quality: matchMedia("(pointer: coarse)").matches ? "medium" : "high" };
}

function stored(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>;
  } catch {
    return {};
  }
}

export function updateSettings(change: Partial<Settings>) {
  Object.assign(settings, change);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Settings still apply for this session.
  }
  listeners.forEach((listener) => listener(settings));
}

export function onSettings(listener: (settings: Settings) => void) {
  listeners.add(listener);
  listener(settings);
  return () => listeners.delete(listener);
}
