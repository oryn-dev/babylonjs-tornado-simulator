// Key presses that start and end inside one frame, which polling the held keys never sees.
export class Taps {
  private down = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (!e.repeat) this.down.add(e.code);
    });
  }

  /** True once per press. */
  take(...codes: string[]) {
    let hit = false;
    for (const code of codes) hit = this.down.delete(code) || hit;
    return hit;
  }
}
