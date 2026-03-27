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

  // Open sidebar by default on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);

  const viewerRef = useRef<ViewerHandle>(null);

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

  const handleModelLoaded = useCallback((info: ModelInfo) => {
    setModelInfo(info);
  }, []);

  const handleLoadModel = useCallback((model: ModelEntry) => {
    setSelectedModel(model);
    setModelInfo(null);
    viewerRef.current?.loadModel(model);
  }, []);

  const handleApplyMotion = useCallback((group: string, index: number) => {
    viewerRef.current?.playMotion(group, index);
  }, []);

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
          onClick={() => setSidebarOpen(false)}
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
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <Viewer
        ref={viewerRef}
        serverUrl={SERVER_URL}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onModelLoaded={handleModelLoaded}
        selectedModel={selectedModel}
      />
    </div>
  );
}
