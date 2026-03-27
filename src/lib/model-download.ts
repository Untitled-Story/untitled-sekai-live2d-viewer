import type { ModelEntry } from "@/app/page";
import { resolveMotionData } from "@/lib/motion";

export interface DownloadModelAsset {
  sourcePath: string;
  archivePath: string;
}

export interface DownloadPlan {
  archiveName: string;
  assets: DownloadModelAsset[];
  modelJsonPath: string;
  modelJsonContent: string;
}

interface Model3FileReferenceEntry {
  FadeInTime?: number;
  FadeOutTime?: number;
  File?: string;
}

interface Model3FileReferences {
  Moc?: string;
  Textures?: string[];
  Physics?: string;
  Pose?: string;
  UserData?: string;
  Motions?: Record<string, Model3FileReferenceEntry[]>;
}

interface Model3Json {
  FileReferences?: Model3FileReferences;
  url?: string;
}

function normalizePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/^\//, "");
}

function normalizeModelJsonPaths(modelJson: Model3Json) {
  const refs = modelJson.FileReferences;
  if (!refs) return;

  refs.Moc = refs.Moc ? normalizePath(refs.Moc) : refs.Moc;
  refs.Physics = refs.Physics ? normalizePath(refs.Physics) : refs.Physics;
  refs.Pose = refs.Pose ? normalizePath(refs.Pose) : refs.Pose;
  refs.UserData = refs.UserData ? normalizePath(refs.UserData) : refs.UserData;
  refs.Textures = refs.Textures?.map(normalizePath);
}

function uniqueAssets(assets: DownloadModelAsset[]): DownloadModelAsset[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.sourcePath}=>${asset.archivePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addAsset(
  assets: DownloadModelAsset[],
  sourcePath: string | undefined,
  archivePath: string | undefined
) {
  if (!sourcePath || !archivePath) return;

  const normalizedSourcePath = normalizePath(sourcePath);
  const normalizedArchivePath = normalizePath(archivePath);
  if (
    !normalizedSourcePath ||
    !normalizedArchivePath ||
    normalizedSourcePath.includes("undefined") ||
    normalizedArchivePath.includes("undefined")
  ) {
    return;
  }

  assets.push({
    sourcePath: normalizedSourcePath,
    archivePath: normalizedArchivePath,
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function buildMotionReference(name: string): Model3FileReferenceEntry {
  return {
    FadeInTime: 0.5,
    FadeOutTime: 0.5,
    File: `motions/${name}.motion3.json`,
  };
}

export async function buildModelDownloadPlan(
  serverUrl: string,
  entry: ModelEntry
): Promise<DownloadPlan> {
  const modelJsonPath = entry.file;
  const modelJson = await fetchJson<Model3Json>(
    `${serverUrl}/model/${entry.path}/${entry.file}`
  );
  const motionData = await resolveMotionData(serverUrl, entry);

  const assets: DownloadModelAsset[] = [];

  if (!modelJson.FileReferences) modelJson.FileReferences = {};
  normalizeModelJsonPaths(modelJson);

  const refs = modelJson.FileReferences;
  if (refs) {
    addAsset(assets, `model/${entry.path}/${refs.Moc}`, refs.Moc);
    addAsset(assets, `model/${entry.path}/${refs.Physics}`, refs.Physics);
    addAsset(assets, `model/${entry.path}/${refs.Pose}`, refs.Pose);
    addAsset(assets, `model/${entry.path}/${refs.UserData}`, refs.UserData);

    for (const texture of refs.Textures ?? []) {
      addAsset(assets, `model/${entry.path}/${texture}`, texture);
    }
  }

  for (const name of motionData.motions) {
    addAsset(
      assets,
      `motion/${motionData.motionBasePath}/motion/${name}.motion3.json`,
      `motions/${name}.motion3.json`
    );
  }

  for (const name of motionData.facials) {
    addAsset(
      assets,
      `motion/${motionData.motionBasePath}/facial/${name}.motion3.json`,
      `motions/${name}.motion3.json`
    );
  }

  for (const name of motionData.additionalMotions) {
    addAsset(
      assets,
      `model/${entry.path}/motions/${name}.motion3.json`,
      `motions/${name}.motion3.json`
    );
  }

  const motionEntries: Record<string, Model3FileReferenceEntry[]> = {};

  for (const name of motionData.motions) {
    motionEntries[name] = [buildMotionReference(name)];
  }

  for (const name of motionData.additionalMotions) {
    motionEntries[name] = [buildMotionReference(name)];
  }

  for (const name of motionData.facials) {
    motionEntries[name] = [buildMotionReference(name)];
  }

  refs.Motions = motionEntries;
  delete modelJson.url;

  return {
    archiveName: `${entry.name}.zip`,
    assets: uniqueAssets(assets),
    modelJsonPath,
    modelJsonContent: JSON.stringify(modelJson, null, 2),
  };
}
