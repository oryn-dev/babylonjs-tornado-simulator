import type { AssetContainer, InstantiatedEntries } from "@babylonjs/core/assetContainer";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";

registerBuiltInLoaders();

export interface Model extends InstantiatedEntries {
  root: TransformNode;
}

const containers = new Map<string, Promise<AssetContainer>>();

/** The address of a file under public/assets/. */
export function assetUrl(path: string) {
  return new URL(path.replace(/^\/+/, ""), new URL("assets/", document.baseURI)).href;
}

export function loadContainer(scene: Scene, path: string) {
  let container = containers.get(path);
  if (!container) {
    container = LoadAssetContainerAsync(assetUrl(path), scene);
    containers.set(path, container);
  }
  return container;
}

export async function spawnModel(scene: Scene, path: string, name = path): Promise<Model> {
  const container = await loadContainer(scene, path);
  const entries = container.instantiateModelsToScene((source) => `${name}:${source}`, false, { doNotInstantiate: false });
  return Object.assign(entries, { root: entries.rootNodes[0] as TransformNode });
}

export const assets = { url: assetUrl, load: loadContainer, spawn: spawnModel };
export type Assets = typeof assets;
