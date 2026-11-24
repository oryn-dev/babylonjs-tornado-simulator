import { Constants } from "@babylonjs/core/Engines/constants";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import type { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import type { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { FUNNEL_UNIFORMS, funnelShader } from "./funnel-shader";
import { shaderMaterial } from "./shader-kit";
import { STORM, type FunnelShape } from "./state";

const tmp = { a: new Vector4(), b: new Vector4(), c: new Vector4(), d: new Vector4() };

export function setShape(material: ShaderMaterial, s: FunnelShape) {
  material.setVector4("tw0", tmp.a.set(s.x, s.z, s.height, s.time));
  material.setVector4("tw1", tmp.b.set(s.baseR, s.topR, s.power, s.flareR));
  material.setVector4("tw2", tmp.c.set(s.leanX, s.leanZ, s.wobble, s.spin));
  material.setVector4("tw3", tmp.d.set(s.dustR, s.dustH, s.density, s.growth));
}

export class Funnel {
  private mesh;
  private material: ShaderMaterial;
  /** March steps: more is smoother and slower. */
  steps = 56;
  private depth;
  private frame = 0;

  constructor(private scene: Scene, private camera: TargetCamera, noise: BaseTexture) {
    this.depth = scene.enableDepthRenderer(camera, false, false, Texture.NEAREST_SAMPLINGMODE, true);
    this.mesh = CreateCylinder("funnel", { height: 1, diameter: 2, tessellation: 28 }, scene);
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.alphaIndex = 20;
    const m = shaderMaterial(scene, "twFunnel", funnelShader, { uniforms: FUNNEL_UNIFORMS, samplers: ["noiseTex", "depthTex"], blend: true });
    // Inside faces, drawn over everything: the scene's depth ends each ray instead.
    m.cullBackFaces = false;
    m.depthFunction = Constants.ALWAYS;
    m.disableDepthWrite = true;
    m.alphaMode = Constants.ALPHA_PREMULTIPLIED;
    m.setTexture("noiseTex", noise);
    m.setTexture("depthTex", this.depth.getDepthMap());
    m.setVector3("sun", new Vector3(...STORM.sun).normalize());
    this.material = this.mesh.material = m;
  }

  update(s: FunnelShape) {
    const { mesh, material, camera, scene } = this;
    const reach = Math.max(s.topR + s.flareR, s.baseR, s.dustR * 0.9) * 1.5 + Math.hypot(s.leanX, s.leanZ) * 0.5 + s.wobble * 1.2;
    const cx = s.x + s.leanX / 2;
    const cz = s.z + s.leanZ / 2;
    mesh.position.set(cx, s.height / 2, cz);
    // A little wider than the analytic bound: the mesh has flat sides.
    mesh.scaling.set(reach * 1.02, s.height, reach * 1.02);
    setShape(material, s);
    const engine = scene.getEngine();
    material.setVector3("eye", camera.globalPosition);
    material.setVector3("forward", camera.getDirection(Vector3.Forward()));
    material.setVector4("bounds", new Vector4(cx, cz, reach, (this.frame++ % 32) * 0.618));
    material.setVector4("screen", new Vector4(1 / engine.getRenderWidth(), 1 / engine.getRenderHeight(), this.steps, 3.9 / this.steps));
    const g = s.growth;
    const f = STORM.flash;
    material.setColor3("lightCol", new Color3(0.36 - 0.16 * g + f * 0.5, 0.385 - 0.185 * g + f * 0.55, 0.35 - 0.17 * g + f * 0.6));
    material.setColor3("darkCol", new Color3(0.06 - 0.04 * g + f * 0.1, 0.072 - 0.047 * g + f * 0.12, 0.066 - 0.042 * g + f * 0.14));
    material.setColor3("dustCol", new Color3(...STORM.dust));
    material.setColor3("warmCol", new Color3(0.36, 0.27, 0.13));
    material.setVector4("fogCol", new Vector4(...STORM.fog, scene.fogDensity));
  }
}
