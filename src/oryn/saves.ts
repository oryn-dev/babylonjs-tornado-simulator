const PREFIX = "save:";

/** Save slots in this browser. Values go through JSON. */
export const saves = {
  async load<T>(slot: string): Promise<T | null> {
    const data = localStorage.getItem(PREFIX + slot);
    return data === null ? null : (JSON.parse(data) as T);
  },
  async save(slot: string, value: unknown): Promise<{ ok: boolean }> {
    try {
      localStorage.setItem(PREFIX + slot, JSON.stringify(value));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },
};
