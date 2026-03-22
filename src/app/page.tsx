"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Viewer, type ViewerHandle } from "@/components/Viewer";

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

export default function Home() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelEntry | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
