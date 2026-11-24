// The storm above: the sky dome with its bright gap at the horizon, and the rotating cloud deck the funnel hangs from.
import { Constants } from "@babylonjs/core/Engines/constants";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { DECK_UNIFORMS, SKY_UNIFORMS, deckShader, skyShader } from "./sky-shaders";
import { shaderMaterial } from "./shader-kit";
import { STORM, type FunnelShape } from "./state";

const DECK_REACH = 1500;

export class StormSky {
  private sky: ShaderMaterial;
  private deck: ShaderMaterial;
  private mesh: Mesh;

  constructor(private scene: Scene, noise: BaseTexture) {
    const dome = scene.getMeshByName("sky")!;
    this.sky = shaderMaterial(scene, "twSky", skyShader, { uniforms: SKY_UNIFORMS, samplers: ["noiseTex"] });
    this.sky.backFaceCulling = false;
    this.sky.disableDepthWrite = true;
    this.sky.fogEnabled = false;
    dome.material = this.sky;

    this.mesh = deckMesh(scene);
    this.deck = shaderMaterial(scene, "twDeck", deckShader, { uniforms: DECK_UNIFORMS, samplers: ["noiseTex"], blend: true });
    this.deck.backFaceCulling = false;
    this.deck.disableDepthWrite = true;
    this.deck.alphaMode = Constants.ALPHA_PREMULTIPLIED;
    this.mesh.material = this.deck;
    this.mesh.alphaIndex = 10;

    for (const m of [this.sky, this.deck]) {
      m.setTexture("noiseTex", noise);
      m.setVector3("sun", new Vector3(...STORM.sun).normalize());
      for (const key of ["horizonBright", "horizonDark", "zenith", "fog", "cloudLight", "cloudDark"] as const) m.setColor3(key, new Color3(...STORM[key]));
    }
    this.update({ x: 0, z: 0, height: 80, time: 0, topR: 10, flareR: 10, leanX: 0, leanZ: 0, growth: 0 } as FunnelShape);
  }

  update(s: FunnelShape) {
    const flash = new Vector4(STORM.flashX, STORM.flashZ, STORM.flash, s.time);
    this.sky.setVector4("flash", flash);
    this.deck.setVector4("flash", flash);
    this.mesh.position.set(s.x + s.leanX, s.height, s.z + s.leanZ);
    this.deck.setVector4("shape", new Vector4((s.topR + s.flareR) * 2.1, s.height, s.growth, DECK_REACH));
    this.deck.setVector3("eye", this.scene.activeCamera?.globalPosition ?? Vector3.Zero());
  }
}

/** A disc with dense rings in the middle, where the wall cloud bulges down. */
function deckMesh(scene: Scene) {
  const rings = 56;
  const around = 96;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const r = Math.pow(i / rings, 2.4) * DECK_REACH;
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      positions.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const row = around + 1;
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < around; j++) {
      const a = i * row + j;
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  const mesh = new Mesh("cloud-deck", scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.applyToMesh(mesh);
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.isPickable = false;
  return mesh;
}
