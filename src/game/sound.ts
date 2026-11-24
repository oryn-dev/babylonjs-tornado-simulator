// Wind beds that cross-fade with the storm's size, one-shots for what breaks, distant thunder and two music loops.
import type { StaticSound } from "@babylonjs/core/AudioV2/abstractAudio/staticSound";
import type { GameContext } from "../oryn/context";

type Bed = "wind-small" | "wind-medium" | "wind-huge" | "debris-swirl" | "rain";
const BEDS: Bed[] = ["wind-small", "wind-medium", "wind-huge", "debris-swirl", "rain"];
/** Shots by group: files, loudness, shortest gap between two in seconds. */
const SHOTS = {
  wood: { files: ["wood-1", "wood-2", "wood-3", "wood-4"], gain: 0.5, gap: 0.07 },
  metal: { files: ["metal-1", "metal-2", "metal-3", "metal-4"], gain: 0.42, gap: 0.1 },
  glass: { files: ["glass-1", "glass-2"], gain: 0.45, gap: 0.12 },
  brick: { files: ["brick-1", "collapse-1"], gain: 0.5, gap: 0.12 },
  collapse: { files: ["collapse-1", "collapse-2"], gain: 0.9, gap: 0.3 },
  huge: { files: ["collapse-huge"], gain: 1, gap: 0.6 },
  thud: { files: ["thud-1", "thud-3"], gain: 0.4, gap: 0.12 },
  crash: { files: ["thud-2"], gain: 0.55, gap: 0.2 },
  whoosh: { files: ["whoosh-1", "whoosh-2"], gain: 0.35, gap: 0.16 },
  zap: { files: ["zap"], gain: 0.55, gap: 0.15 },
  thunder: { files: ["thunder-1", "thunder-3"], gain: 0.7, gap: 0.5 },
  crack: { files: ["thunder-2"], gain: 0.8, gap: 0.5 },
  siren: { files: ["siren"], gain: 0.2, gap: 5 },
  surge: { files: ["surge"], gain: 0.95, gap: 0.5 },
  ready: { files: ["surge-ready"], gain: 0.5, gap: 0.5 },
  grow: { files: ["grow"], gain: 0.8, gap: 0.5 },
  tap: { files: ["ui-tap"], gain: 0.5, gap: 0.04 },
  star: { files: ["star"], gain: 0.5, gap: 0.05 },
  end: { files: ["end"], gain: 0.8, gap: 1 },
} as const;
export type Shot = keyof typeof SHOTS;

export class StormSound {
  private beds = new Map<Bed, StaticSound>();
  private shots = new Map<string, StaticSound>();
  private music = new Map<string, StaticSound>();
  private last = new Map<Shot, number>();
  private playing = "";
  private levels = new Map<StaticSound, number>();
  private clock = 0;
  private since = 0;
  private surging = false;

  constructor(private ctx: GameContext) {
    void this.load();
  }

  private async load() {
    const { audio, assets } = this.ctx;
    const make = (path: string, loop: boolean, instances = 3) => audio.createSoundAsync(path, assets.url(path), { loop, autoplay: false, volume: loop ? 0 : 1, maxInstances: instances });
    const quietly = <T>(work: Promise<T>) => work.catch((error) => void console.warn("sound", error));
    await Promise.all([
      ...BEDS.map((name) => quietly(make(`sfx/${name}.wav`, true, 1).then((s) => void this.beds.set(name, s)))),
      ...[...new Set(Object.values(SHOTS).flatMap((s) => [...s.files]))].map((name) => quietly(make(`sfx/${name}.mp3`, false).then((s) => void this.shots.set(name, s)))),
      ...["menu", "chase"].map((name) => quietly(make(`music/${name}.mp3`, true, 1).then((s) => void this.music.set(name, s)))),
    ]);
    this.startLoops();
  }

  private startLoops() {
    for (const s of [...this.beds.values(), ...this.music.values()]) s.play();
  }

  play(name: Shot, volume = 1, rate = 1) {
    const shot = SHOTS[name];
    const now = this.clock;
    if (now - (this.last.get(name) ?? -9) < shot.gap) return;
    this.last.set(name, now);
    const file = shot.files[Math.floor(Math.random() * shot.files.length)];
    const sound = this.shots.get(file);
    if (!sound) return;
    sound.playbackRate = rate * (0.92 + Math.random() * 0.16);
    sound.play({ volume: Math.min(1, shot.gain * volume) });
  }

  track(name: "menu" | "chase" | "") {
    this.playing = name;
  }

  private fade(sound: StaticSound | undefined, target: number, k: number) {
    if (!sound) return;
    const now = this.levels.get(sound) ?? 0;
    const next = now + (target - now) * k;
    if (Math.abs(next - now) < 0.0015) return;
    this.levels.set(sound, next);
    sound.volume = next;
  }

  update(dt: number, growth: number, activity: number, surge: boolean, loud: number) {
    this.clock += dt;
    this.since += dt;
    if (this.since < 0.12) return;
    const k = 1 - Math.exp(-this.since * 2.2);
    this.since = 0;
    const g = growth + (surge ? 0.25 : 0);
    const v = this.ctx.tuning.number("wind_volume", 0.75) * loud;
    const bell = (c: number, w: number) => Math.max(0, 1 - Math.abs(g - c) / w);
    this.fade(this.beds.get("wind-small"), v * (0.5 * bell(0, 0.5) + 0.12), k);
    this.fade(this.beds.get("wind-medium"), v * (0.2 + 0.6 * bell(0.4, 0.5)), k);
    this.fade(this.beds.get("wind-huge"), v * Math.min(1, Math.max(0.08, (g - 0.15) * 1.25)), k);
    this.fade(this.beds.get("debris-swirl"), v * 0.6 * Math.min(1, activity), k);
    this.fade(this.beds.get("rain"), v * 0.16, k);
    const music = this.ctx.tuning.number("music_volume", 0.34);
    for (const [name, sound] of this.music) this.fade(sound, name === this.playing ? music : 0, k * 0.6);
    if (surge === this.surging) return;
    this.surging = surge;
    for (const name of ["wind-small", "wind-medium", "wind-huge"] as const) {
      const bed = this.beds.get(name);
      if (bed) bed.playbackRate = surge ? 1.14 : 1;
    }
  }
}
