import type { AudioEngineV2 } from "@babylonjs/core/AudioV2/abstractAudio/audioEngineV2";
import { CreateAudioEngineAsync } from "@babylonjs/core/AudioV2/webAudio/webAudioEngine";
import { onSettings } from "./settings";

/** Starts the audio; it follows the volume setting and goes quiet while the page is hidden. */
export async function createAudio(): Promise<AudioEngineV2> {
  const audio = await CreateAudioEngineAsync({ disableDefaultUI: true, resumeOnInteraction: true });
  let volume = 1;
  let quiet = false;
  const apply = () => {
    const next = document.hidden;
    audio.volume = next ? 0 : volume;
    if (next === quiet) return;
    quiet = next;
    void (quiet ? audio.pauseAsync() : audio.resumeAsync()).catch(() => undefined);
  };
  onSettings((settings) => {
    volume = settings.volume;
    apply();
  });
  document.addEventListener("visibilitychange", apply);
  return audio;
}
