"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { zipSync, strToU8 } from "fflate";
import { Sidebar } from "@/components/Sidebar";
import { Viewer, type ViewerHandle } from "@/components/Viewer";
import { buildModelDownloadPlan } from "@/lib/model-download";

const SERVER_URL = (
  process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:8080"
).replace(/\/+$/, "");

export interface RawModelEntry {
  modelName: string;
  modelBase: string;
  modelPath: string;
  modelFile: string;
}

export interface ModelEntry {
  name: string;
  base: string;
  path: string;
  file: string;
}

export interface ModelInfo {
  motions: string[];
  facials: string[];
}

export interface DownloadState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
}

/** Read share params from URL once */
function getShareParams(): { model?: string; motion?: string; facial?: string } {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    model: p.get("model") ?? undefined,
    motion: p.get("motion") ?? undefined,
    facial: p.get("facial") ?? undefined,
  };
}

export default function Home() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelEntry | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadState>({
    status: "idle",
  });

  // Share params — consumed once then cleared
  const shareParamsRef = useRef(getShareParams());
  const shareConsumedRef = useRef(false);
  const [viewerReady, setViewerReady] = useState(false);

  // Open sidebar by default on desktop (skip if share link — keep sidebar closed)
  useEffect(() => {
    if (window.innerWidth >= 768 && !shareParamsRef.current.model) setSidebarOpen(true);
  }, []);

  const viewerRef = useRef<ViewerHandle>(null);

  const handleViewerReady = useCallback(() => {
    setViewerReady(true);
  }, []);

  const handleSetSidebarOpen = useCallback((nextOpen: boolean) => {
    setSidebarOpen(nextOpen);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((current) => !current);
  }, []);

  // Fetch models on mount
  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch(`${SERVER_URL}/model_list.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw: RawModelEntry[] = await res.json();
        setModels(
          raw.map((r) => ({
            name: r.modelName,
            base: r.modelBase,
            path: r.modelPath,
            file: r.modelFile,
          }))
        );
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "Failed to fetch");
      } finally {
        setFetchLoading(false);
      }
    }
    fetchModels();
  }, []);

  // Auto-load model from share link after models fetched AND viewer ready
  useEffect(() => {
    const sp = shareParamsRef.current;
    if (shareConsumedRef.current || !sp.model || models.length === 0 || !viewerReady) return;
    shareConsumedRef.current = true;

    const match = models.find((m) => m.name === sp.model);
    if (!match) return;

    setSelectedModel(match);
    setModelInfo(null);
    viewerRef.current?.loadModel(match);
    window.history.replaceState(null, "", window.location.pathname);
  }, [models, viewerReady]);

  const handleModelLoaded = useCallback((info: ModelInfo) => {
    setModelInfo(info);
  }, []);

  // Auto-play motion/facial from share link after model info arrives
  useEffect(() => {
    if (!modelInfo) return;
    const sp = shareParamsRef.current;

    const motionIdx = sp.motion ? modelInfo.motions.indexOf(sp.motion) : -1;
    const facialIdx = sp.facial ? modelInfo.facials.indexOf(sp.facial) : -1;

    // Both present → parallel motion
    if (motionIdx >= 0 && facialIdx >= 0) {
      viewerRef.current?.playParallelMotion([
        { group: "Motion", index: motionIdx },
        { group: "Expression", index: facialIdx },
      ]);
      setActiveMotionName(sp.motion!);
      setActiveFacialName(sp.facial!);
    } else {
      if (motionIdx >= 0) {
        viewerRef.current?.playMotion("Motion", motionIdx);
        setActiveMotionName(sp.motion!);
      }
      if (facialIdx >= 0) {
        viewerRef.current?.playMotion("Expression", facialIdx);
        setActiveFacialName(sp.facial!);
      }
    }
    sp.motion = undefined;
    sp.facial = undefined;
  }, [modelInfo]);

  const handleLoadModel = useCallback((model: ModelEntry) => {
    setSelectedModel(model);
    setModelInfo(null);
    setActiveMotionName(null);
    setActiveFacialName(null);
    viewerRef.current?.loadModel(model);
  }, []);

  // Track last-played motion/facial by name for share links
  const [activeMotionName, setActiveMotionName] = useState<string | null>(null);
  const [activeFacialName, setActiveFacialName] = useState<string | null>(null);

  const handleApplyMotion = useCallback((group: string, index: number) => {
    viewerRef.current?.playMotion(group, index);
    if (group === "Motion" && modelInfo?.motions[index]) {
      setActiveMotionName(modelInfo.motions[index]);
    } else if (group === "Expression" && modelInfo?.facials[index]) {
      setActiveFacialName(modelInfo.facials[index]);
    }
  }, [modelInfo]);

  const handleDownloadZip = useCallback(async () => {
    if (!selectedModel) return;

    setDownloadState({ status: "loading", message: "Preparing ZIP..." });

    try {
      const plan = await buildModelDownloadPlan(SERVER_URL, selectedModel);
      const files = await Promise.all(
        plan.assets.map(async (asset) => {
          const res = await fetch(`${SERVER_URL}/${asset.sourcePath}`);
          if (!res.ok) {
            throw new Error(`Failed to fetch ${asset.archivePath}: HTTP ${res.status}`);
          }
          const buffer = new Uint8Array(await res.arrayBuffer());
          return [asset.archivePath, buffer] as const;
        })
      );

      const zip = zipSync(
        Object.fromEntries([
          ...files.filter(([path]) => path !== plan.modelJsonPath),
          [plan.modelJsonPath, strToU8(plan.modelJsonContent)],
        ])
      );
      const zipBytes = new Uint8Array(zip.byteLength);
      zipBytes.set(zip);
      const blob = new Blob([zipBytes], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = plan.archiveName;
      a.click();
      URL.revokeObjectURL(url);

      setDownloadState({
        status: "success",
        message: `Downloaded ${plan.assets.length} files`,
      });
      window.setTimeout(() => {
        setDownloadState((current) =>
          current.status === "success" ? { status: "idle" } : current
        );
      }, 2000);
    } catch (e) {
      setDownloadState({
        status: "error",
        message: e instanceof Error ? e.message : "Failed to download ZIP",
      });
    }
  }, [selectedModel]);

  return (
    <div className="flex h-dvh">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => handleSetSidebarOpen(false)}
        />
      )}
      <Sidebar
        models={models}
        selectedModel={selectedModel}
        onLoadModel={handleLoadModel}
        onDownloadZip={handleDownloadZip}
        downloadState={downloadState}
        modelInfo={modelInfo}
        onApplyMotion={handleApplyMotion}
        fetchLoading={fetchLoading}
        fetchError={fetchError}
        open={sidebarOpen}
        onToggle={handleToggleSidebar}
        activeMotionName={activeMotionName}
        activeFacialName={activeFacialName}
      />
      <Viewer
        ref={viewerRef}
        serverUrl={SERVER_URL}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onModelLoaded={handleModelLoaded}
        onReady={handleViewerReady}
        selectedModel={selectedModel}
        activeMotionName={activeMotionName}
        activeFacialName={activeFacialName}
      />
    </div>
  );
}
