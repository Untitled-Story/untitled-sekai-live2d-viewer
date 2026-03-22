import type { ModelEntry } from "@/app/page";

export interface MotionData {
  motionBasePath: string;
  motions: string[];
  facials: string[];
  additionalMotions: string[];
}

interface BuildMotionData {
  motions?: string[];
  expressions?: string[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Derive the model directory from entry.path.
 * Special cases for collabo paths:
 *   - v2/collabo/21_miku → v2/main/21_miku (collabo → main)
 *   - v2/collabo/egg    → v2/collabo        (go up one level)
 */
function resolveModelDir(entryPath: string): string {
  const parts = entryPath.split("/");
  // modelDir = parent directory (drop last segment which is the model folder)
  const modelDir = parts.slice(0, -1).join("/");

  if (parts.length >= 3 && parts[1] === "collabo") {
    const modelFolder = parts[parts.length - 1];
    // e.g. v2/collabo/21_miku → check if it starts with a number (like "21_miku")
    if (/^\d+_/.test(modelFolder)) {
      // Replace "collabo" with "main"
      const fixed = [...parts];
      fixed[1] = "main";
      return fixed.slice(0, -1).join("/");
    }
    // e.g. v2/collabo/egg → go up one more level
    return parts.slice(0, -2).join("/");
  }

  return modelDir;
}

/**
 * Generate candidate base names from the original modelBaseName.
 * Tries regex transformations: v2_clb prefix, _back models, trailing digits.
 */
function generateBaseNameVariants(baseName: string): string[] {
  const variants: string[] = [];

  // Try replacing "v2_clb" prefix with "v2_"
  if (baseName.startsWith("v2_clb")) {
    variants.push(baseName.replace(/^v2_clb/, "v2_"));
  }

  // For _back models (e.g. v2_20mizuki_school_back_t12):
  // extract character prefix (v2_20mizuki) and form v2_20mizuki_back
  if (baseName.includes("_back")) {
    const charMatch = baseName.match(/^(v2_\d+[a-z]+)/);
    if (charMatch) {
      variants.push(`${charMatch[1]}_back`);
    }
  }

  // Try removing trailing variant suffix (e.g. "v2_04shiho_casual_t04" → "v2_04shiho_casual")
  const withoutTrailingDigits = baseName.replace(/_[a-z]?\d+$/, "");
  if (withoutTrailingDigits !== baseName) {
    variants.push(withoutTrailingDigits);
  }

  return variants;
}

/**
 * Try to find the motion base BuildMotionData.json for a given base name.
 * Returns [data, fullBasePath] or null.
 */
async function tryMotionBase(
  serverUrl: string,
  modelDir: string,
  baseName: string
): Promise<[BuildMotionData, string] | null> {
  const basePath = `${modelDir}/${baseName}_motion_base`;
  const url = `${serverUrl}/motion/${basePath}/BuildMotionData.json`;
  const data = await fetchJson<BuildMotionData>(url);
  if (data) return [data, basePath];
  return null;
}

/**
 * Progressively strip trailing _xxx segments from baseName and retry.
 */
async function tryStrippedBaseNames(
  serverUrl: string,
  modelDir: string,
  baseName: string
): Promise<[BuildMotionData, string] | null> {
  let current = baseName;
  while (current.includes("_")) {
    current = current.replace(/_[^_]+$/, "");
    const result = await tryMotionBase(serverUrl, modelDir, current);
    if (result) return result;
  }
  return null;
}

export async function resolveMotionData(
  serverUrl: string,
  entry: ModelEntry
): Promise<MotionData> {
  const modelDir = resolveModelDir(entry.path);
  const baseName = entry.base;

  // Step 1: Try the direct base name
  let result = await tryMotionBase(serverUrl, modelDir, baseName);

  // Step 1b: Try regex variants
  if (!result) {
    for (const variant of generateBaseNameVariants(baseName)) {
      result = await tryMotionBase(serverUrl, modelDir, variant);
      if (result) break;
    }
  }

  // Step 1c: Progressively strip trailing segments
  if (!result) {
    result = await tryStrippedBaseNames(serverUrl, modelDir, baseName);
  }

  let motionBasePath = "";
  let motions: string[] = [];
  let facials: string[] = [];

  if (result) {
    const [data, path] = result;
    motionBasePath = path;
    motions = data.motions ?? [];
    facials = data.expressions ?? [];
  }

  // Step 2: Additional motions from model path
  const additionalUrl = `${serverUrl}/model/${entry.path}/motions/BuildMotionData.json`;
  const additionalData = await fetchJson<BuildMotionData>(additionalUrl);
  const additionalMotions = additionalData?.motions ?? [];

  return { motionBasePath, motions, facials, additionalMotions };
}
