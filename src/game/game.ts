import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import type { Game, GameContext, GameMeta } from "../oryn/context";
import { Fx } from "../oryn/fx";
import { saves } from "../oryn/sdk";
import { settings, updateSettings } from "../oryn/settings";
import { StormCamera } from "./camera";
import { QualityControl } from "./quality";
import { Damage } from "./sim/damage";
import { Debris } from "./sim/debris";
import { Guide } from "./sim/guide";
import { Tornado } from "./sim/tornado";
import { StormSound } from "./sound";
import { Taps } from "./taps";
import { Ui, type Screen } from "./ui/ui";
import { Effects } from "./weather/effects";
import { Flecks } from "./weather/flecks";
import { Funnel } from "./weather/funnel";
import { createNoise } from "./weather/noise";
import { StormSky } from "./weather/sky";
import { createBatches } from "./world/batches";
import { Builder, type Piece, type Structure } from "./world/builder";
import { Crops } from "./world/crops";
import { Ground } from "./world/ground";
import { buildMap } from "./world/map";
import { WIND } from "./world/plugins";

export const meta: GameMeta = { title: "Tornado Simulator: Storm County" };

const START = { x: -184, z: -184 };
const SAVE_SLOT = "best";
interface Save {
  best: number;
  stars: number;
}

export async function createGame(ctx: GameContext): Promise<Game> {
  const { scene, look, tuning, input, assets } = ctx;
  const phone = matchMedia("(pointer: coarse)").matches;
  const noise = createNoise(scene);
  const tornado = new Tornado(tuning);
  const camera = new StormCamera(scene, tuning, tornado);
  const sky = new StormSky(scene, noise);
  const builder = new Builder(createBatches(scene, look, assets.url));
  buildMap(builder);
  builder.finish();
  const ground = new Ground(scene, look, assets.url, noise, builder.structures, phone ? 2048 : 4096);
  const crops = new Crops(scene, look, phone ? 1.35 : 1);
  const funnel = new Funnel(scene, camera.camera, noise);
  const flecks = new Flecks(scene, phone ? 220 : 420);
  const effects = new Effects(scene, look, phone ? 0.6 : 1);
  effects.shape = tornado.shape;
  const rain = new Fx(scene, look).ambient("rain", { colors: ["#8d9a96", "#6f7d79"], amount: (tuning.number("rain_amount", 850) / 900) * (phone ? 0.5 : 1) });
  rain.color1.a = rain.color2.a = 0.4;
  const sound = new StormSound(ctx);
  const guide = new Guide(builder, tornado);
  const taps = new Taps();
  const quality = new QualityControl(scene, look, funnel, phone);

  // WebGPU allows 16 varyings; bumped surfaces under cascaded shadows sit right at that limit.
  for (const m of scene.materials) if (m instanceof PBRMaterial) m.forceIrradianceInFragment = true;

  let screen: Screen = "title";
  let paused = false;
  let timeLeft = 0;
  let record: Save = { best: 0, stars: 0 };
  let muted = settings.volume === 0;
  let volume = settings.volume || 0.8;
  let lastEf = 0;
  let ready = false;
  let activity = 0;
  let titleClock = 0;

  const debris = new Debris(tuning, tornado, {
    landed(piece, speed) {
      if (piece.weight > 1.2 && speed > 9) {
        damage.impact(piece, speed);
        effects.smash(piece.x, 0.5, piece.z, 2 + piece.hx, 7);
        if (near(piece) < 190) sound.play(piece.weight > 2 || piece.s.kind === "vehicle" ? "crash" : "thud", loudness(piece));
        if (piece.weight > 2) camera.kick(Math.min(0.35, (piece.weight * 4) / near(piece)));
      } else if (speed > 12 && near(piece) < 90) sound.play("thud", loudness(piece) * 0.5);
    },
    thrown(piece) {
      if (piece.weight > 0.8 && near(piece) < 120) sound.play("whoosh", loudness(piece), 1.3 / (0.8 + piece.weight * 0.2));
    },
  });
  const damage: Damage = new Damage(tuning, builder, tornado, debris, {
    torn(piece) {
      guide.hit(piece.s);
      activity = Math.min(1.4, activity + 0.05 + piece.weight * 0.02);
      if (piece.weight > 0.35) effects.smash(piece.x, piece.y, piece.z, 1 + Math.max(piece.hx, piece.hz), 3 + piece.weight * 2.5);
      const b = piece.batch.name;
      const group = b === "window" || b === "windowLit" ? "glass" : b === "brick" || b === "concrete" ? "brick" : b === "metal" || b === "cyl" || b === "sedan" || b === "pickup" || b === "tractor" ? "metal" : "wood";
      sound.play(group, loudness(piece));
    },
    down: (structure) => structureDown(structure),
    spark(x, y, z) {
      effects.spark(x, y, z);
      sound.play("zap", 60 / Math.max(60, Math.hypot(x - tornado.shape.x, z - tornado.shape.z)));
    },
  });

  effects.onThunder = (distance) => setTimeout(() => sound.play(distance < 520 ? "crack" : "thunder", 1.2 - distance / 1100), distance * 1.6);

  const near = (p: Piece) => Math.max(1, Vector3.Distance(camera.camera.position, new Vector3(p.x, p.y, p.z)));
  const loudness = (p: Piece) => Math.min(1, 75 / near(p)) * (0.5 + Math.min(0.5, p.weight * 0.2));

  function structureDown(s: Structure) {
    const big = s.kind === "building";
    if (big) {
      sound.play(s.heft > 90 ? "huge" : "collapse", 0.9);
      camera.kick(s.heft / 260);
      effects.smash(s.x, 1.5, s.z, s.radius * 1.4, 30);
    }
    if (screen !== "run" && screen !== "sandbox") return;
    if (big || s.kind === "vehicle" || s.value > 8000) ui.feed(s.name, s.value);
    if (big || s.value > 60000) {
      const at = toScreen(s.x, 8, s.z);
      if (at) ui.popup(at.x, at.y, s.value);
    }
  }

  function toScreen(x: number, y: number, z: number) {
    const engine = ctx.engine;
    const p = Vector3.Project(new Vector3(x, y, z), Matrix.IdentityReadOnly, scene.getTransformMatrix(), new Viewport(0, 0, engine.getRenderWidth(), engine.getRenderHeight()));
    if (p.z < 0 || p.z > 1) return null;
    const k = engine.getHardwareScalingLevel();
    return { x: p.x * k, y: p.y * k };
  }

  function rebuild() {
    debris.clear();
    builder.reset();
    crops.reset();
    ground.clearScar();
  }

  function begin(next: Screen) {
    rebuild();
    damage.reset();
    guide.reset();
    tornado.sandbox = null;
    tornado.silhouette = "auto";
    tornado.reset(START.x, START.z);
    camera.yaw = Math.PI / 4;
    camera.idle = next === "title";
    camera.snap();
    screen = next;
    paused = false;
    lastEf = 0;
    ready = false;
    timeLeft = tuning.number("run_seconds", 180);
    if (next === "sandbox") {
      tornado.sandbox = { radius: 14, wind: 0.55 };
      tornado.silhouette = "cone";
    }
    ui.setScreen(next);
    ui.hideMessages();
    sound.track(next === "title" ? "menu" : "chase");
    if (next === "title") return;
    sound.play("siren");
    ui.hint(input.device === "touch" ? "Drag on the left to steer" : "Steer with <b>WASD</b> or the arrow keys, drag to look around");
  }

  function setPaused(next: boolean) {
    if (screen !== "run" && screen !== "sandbox") return;
    paused = next;
    ui.setPaused(next);
  }

  async function finish() {
    screen = "end";
    camera.idle = true;
    sound.play("end");
    sound.track("menu");
    const stars = starsFor(damage.dollars);
    const newBest = damage.dollars > record.best;
    if (newBest) record = { best: Math.round(damage.dollars), stars };
    ui.setScreen("end");
    ui.result({ dollars: damage.dollars, stars, ef: tornado.ef, lifted: damage.lifted?.name ?? "Nothing", destroyed: damage.destroyed, best: record.best, newBest: newBest && stars > 0 });
    ui.setBest(record.best, record.stars);
    if (newBest) await saves.save(SAVE_SLOT, record).catch(() => undefined);
  }

  const thresholds = [1, 2, 3, 4, 5].map((i) => tuning.number(`star_${i}`, i * 3e6));
  const starsFor = (dollars: number) => thresholds.filter((t) => dollars >= t).length;

  const ui: Ui = new Ui(document.querySelector<HTMLElement>("#oryn-ui")!, {
    start: () => begin("run"),
    sandbox: () => begin("sandbox"),
    resume: () => setPaused(false),
    restart: () => begin(screen === "sandbox" ? "sandbox" : "run"),
    menu: () => begin("title"),
    pause: () => setPaused(true),
    toggleSound() {
      muted = !muted;
      if (settings.volume > 0) volume = settings.volume;
      updateSettings({ volume: muted ? 0 : volume });
      quality.apply();
      ui.setSound(!muted);
    },
    quality(q) {
      updateSettings({ quality: q });
      quality.choose(q);
      ui.setQuality(q);
    },
    tune({ radius, wind, shape }) {
      if (tornado.sandbox && radius !== undefined) tornado.sandbox.radius = radius;
      if (tornado.sandbox && wind !== undefined) tornado.sandbox.wind = wind;
      if (shape) tornado.silhouette = shape;
    },
    rebuild() {
      rebuild();
      damage.reset();
    },
    tap: () => sound.play("tap"),
    star: () => sound.play("star"),
  });
  ui.setSound(!muted);
  ui.setQuality(quality.level);
  ui.setDevice(input.device === "touch");
  input.onDevice((device) => ui.setDevice(device === "touch"));
  input.touch.configure({ stick: true, buttons: [{ action: "jump", label: "Surge" }] });
  void saves.load<Save>(SAVE_SLOT).then((saved) => {
    if (!saved || !(saved.best > record.best)) return;
    record = saved;
    ui.setBest(record.best, record.stars);
  }).catch(() => undefined);

  begin("title");
  effects.start();

  /** Where the guide's target is: its place on screen, or the direction to it as seen from the storm. */
  function aim(t: { x: number; z: number }) {
    const dx = t.x - tornado.shape.x;
    const dz = t.z - tornado.shape.z;
    const c = Math.cos(camera.yaw);
    const s = Math.sin(camera.yaw);
    return { at: toScreen(t.x, 14 + tornado.growth * 12, t.z), angle: Math.atan2(dx * c - dz * s, dx * s + dz * c) };
  }

  function play(dt: number, surge: boolean) {
    const axis = input.axis();
    const go = camera.move(axis.x, axis.y);
    guide.update(dt);
    const target = screen === "run" ? guide.target : null;
    const shown = target && guide.quiet > tuning.number("guide_after", 5) ? target : null;
    ui.guide(shown, shown && aim(shown));
    if (target && (axis.x || axis.y)) {
      // The storm leans a little towards what it can break, and harder the longer it breaks nothing.
      const { x, z, distance } = target;
      const lost = Math.max(0, guide.quiet - tuning.number("guide_after", 5) / 2);
      const pull = Math.max(tuning.number("guide_lean", 0.25) * (1 - tornado.growth) * Math.max(0, 1 - distance / 90), Math.min(tuning.number("guide_pull", 1.1), lost * (0.28 - 0.16 * tornado.growth))) / Math.max(4, distance);
      go.x += (x - tornado.shape.x) * pull;
      go.z += (z - tornado.shape.z) * pull;
      const l = Math.max(1, Math.hypot(go.x, go.z));
      go.x /= l;
      go.z /= l;
    }
    if (surge && tornado.trySurge()) {
      sound.play("surge");
      camera.kick(0.7);
    }
    tornado.update(dt, go.x, go.z);
    damage.update(dt);
    const cut = crops.flatten(tornado.shape.x, tornado.shape.z, tornado.reach * 1.15);
    if (cut) {
      damage.dollars += cut * 22;
      tornado.feed(cut * 0.02);
      activity = Math.min(1.2, activity + cut * 0.004);
    }
    const moved = Math.hypot(tornado.vx, tornado.vz);
    ground.dig(tornado.shape.x, tornado.shape.z, tornado.radius * 1.5 + 1.5, Math.min(0.5, dt * (2.2 + moved * 0.1)));
    if (tornado.ef > lastEf) {
      lastEf = tornado.ef;
      if (screen === "run") {
        ui.banner(lastEf);
        sound.play("grow");
        camera.kick(0.4);
      }
    }
    if (tornado.charge >= 1 && !ready) sound.play("ready");
    ready = tornado.charge >= 1;
    if (screen === "run") {
      timeLeft -= dt;
      if (timeLeft <= 0) void finish();
    }
    const stars = starsFor(damage.dollars);
    ui.hud({
      dollars: damage.dollars, seconds: screen === "run" ? Math.max(0, timeLeft) : null, growth: tornado.growth, ef: tornado.ef, mph: tornado.windMph,
      charge: tornado.charge, surging: tornado.surge > 0, stars, nextStar: damage.dollars / (thresholds[Math.min(4, stars)] || 1),
    });
    camera.update(dt, axis.x, input.look());
  }

  function attract(dt: number) {
    titleClock += dt;
    if (screen === "title") tornado.update(dt, Math.sin(titleClock * 0.5) * 0.16, Math.cos(titleClock * 0.37) * 0.16);
    else tornado.update(dt, Math.sin(titleClock * 0.3) * 0.2, Math.cos(titleClock * 0.3) * 0.2);
    damage.update(dt * 0.5);
    camera.update(dt, 0, { x: 0, y: 0 });
  }

  const game: Game = {
    update(dt) {
      // Both are read every frame, so a press on another screen is not kept for later.
      const jump = taps.take("Space") || input.pressed("jump");
      const escape = taps.take("Escape", "KeyP") || input.pressed("pause");
      if (escape) setPaused(!paused);
      const playing = (screen === "run" || screen === "sandbox") && !paused;
      if (input.touch.state.enabled !== playing) input.touch.setEnabled(playing);
      if (jump && screen === "title") begin("run");
      if (!paused) {
        if (playing) play(dt, jump);
        else attract(dt);
        debris.update(dt);
        const s = tornado.shape;
        WIND.x = s.x;
        WIND.z = s.z;
        WIND.reach = tornado.reach * 1.5;
        WIND.time += dt;
        WIND.power = tornado.growth;
        effects.update(dt, tuning.number("lightning_every", 8));
        flecks.update(s);
        crops.update(dt);
        ground.update(dt);
        sky.update(s);
        funnel.update(s);
        for (const batch of Object.values(builder.batches)) batch.flush();
      }
      activity *= Math.exp(-dt * 0.9);
      sound.update(dt, tornado.growth, activity, tornado.surge > 0, paused ? 0.25 : screen === "title" ? 0.6 : 1);
      quality.update(dt, playing);
      ctx.metric("screen", screen);
      ctx.metric("damage", Math.round(damage.dollars));
      ctx.metric("ef", tornado.ef);
      ctx.metric("growth", Number(tornado.growth.toFixed(3)));
      ctx.metric("time", Math.round(timeLeft));
      ctx.metric("flying", debris.active.length);
      ctx.metric("stars", starsFor(damage.dollars));
      ctx.metric("best", record.best);
    },
  };
  (window as unknown as { __storm?: unknown }).__storm = import.meta.env.DEV ? { scene, look, tornado, damage, debris, builder, camera, guide, input, game, begin, finish, set time(v: number) { timeLeft = v; } } : undefined;
  return game;
}
