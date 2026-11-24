import { WebGPUShaderProcessorGLSL } from "@babylonjs/core/Engines/WebGPU/webgpuShaderProcessorsGLSL";

const SHARED_DECLARATION = /^(\s*uniform\s+(?:(?:highp|mediump|lowp)\s+)?\S+\s+)([^;]+,[^;]+);/;

/**
 * Babylon's WebGPU GLSL reader takes `uniform mat4 world, viewProjection;` as one uniform named "world, viewProjection",
 * so the uniform buffer is too small and every frame fails validation (WebGL2 reads it fine). Each name gets its own line.
 */
export function splitSharedUniforms() {
  const processor = WebGPUShaderProcessorGLSL.prototype;
  const read = processor.uniformProcessor;
  processor.uniformProcessor = function (uniform, isFragment, preProcessors) {
    const shared = SHARED_DECLARATION.exec(uniform);
    if (!shared) return read.call(this, uniform, isFragment, preProcessors);
    return shared[2]
      .split(",")
      .map((name) => read.call(this, `${shared[1]}${name.trim()};`, isFragment, preProcessors))
      .join("\n");
  };
}
