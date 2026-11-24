import "./oryn/page.css";
import { Scene } from "@babylonjs/core/scene";
import { createGame, meta } from "./game/game";
import { assets } from "./oryn/assets";
import { createAudio } from "./oryn/audio";
import { bridge, reportError, setMetric, watchFrames, watchInput } from "./oryn/bridge";
import { createEngine } from "./oryn/engine";
import { Input } from "./oryn/input";
import { Look } from "./oryn/look";
import { onSettings } from "./oryn/settings";
import { tuning } from "./oryn/tuning";

const MAX_STEP = 0.1;

async function main() {
  const ui = document.querySelector<HTMLElement>("#oryn-ui")!;
  document.title = meta.title;

  const { engine, renderer, canvas } = await createEngine(document.querySelector<HTMLCanvasElement>("#game")!);
  bridge.renderer = renderer;
  const scene = new Scene(engine);
  const input = new Input(canvas, ui);
  watchInput(input);
  const look = new Look(scene);
  const audio = await createAudio();
  onSettings(({ quality }) => look.setQuality(quality));

  const game = await createGame({ engine, scene, canvas, input, look, tuning, assets, audio, metric: setMetric });
  await scene.whenReadyAsync();
  watchFrames(engine, scene);

  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, MAX_STEP);
    input.update(dt);
    game.update(dt);
    scene.render();
  });
  window.addEventListener("resize", () => engine.resize());
  input.touch.setEnabled(true);
}

main().catch((error) => {
  reportError(error);
  console.error(error);
  document.querySelector("#oryn-ui")!.textContent = "This game could not start.";
});
