"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  Search,
  Box,
  Play,
  Download,
  FolderOpen,
  Smile,
  Clapperboard,
  Copy,
  Check,
} from "lucide-react";
import type { DownloadState, ModelEntry, ModelInfo } from "@/app/page";

interface SidebarProps {
  models: ModelEntry[];
  selectedModel: ModelEntry | null;
  onLoadModel: (model: ModelEntry) => void;
  onDownloadZip: () => void;
  downloadState: DownloadState;
  modelInfo: ModelInfo | null;
  onApplyMotion: (group: string, index: number) => void;
  fetchLoading: boolean;
  fetchError: string | null;
  open: boolean;
  onToggle: () => void;
  activeMotionName: string | null;
  activeFacialName: string | null;
}

type Tab = "model" | "animation";
type AnimSub = "motion" | "facial";

function matchesFilter(name: string, filter: string): boolean {
  if (!filter.trim()) return true;
  const target = name.toLowerCase();
  return filter
    .toLowerCase()
    .split(/\s+/)
    .every((term) => target.includes(term));
}

export function Sidebar({
  models,
  selectedModel,
  onLoadModel,
  onDownloadZip,
  downloadState,
  modelInfo,
  onApplyMotion,
  fetchLoading,
  fetchError,
  open,
  onToggle,
  activeMotionName,
  activeFacialName,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("model");
  const [animSub, setAnimSub] = useState<AnimSub>("motion");
  const [filter, setFilter] = useState("");
  const [pendingModel, setPendingModel] = useState<ModelEntry | null>(null);
  const [selectedMotion, setSelectedMotion] = useState<number>(-1);
  const [selectedFacial, setSelectedFacial] = useState<number>(-1);
  const [motionFilter, setMotionFilter] = useState("");
  const [facialFilter, setFacialFilter] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Sync pendingModel when model is loaded externally (e.g. share link)
  useEffect(() => {
    if (selectedModel) setPendingModel(selectedModel);
  }, [selectedModel]);

  // Sync sidebar selection from share link / external state
  const prevMotionName = useRef(activeMotionName);
  const prevFacialName = useRef(activeFacialName);
  useEffect(() => {
    if (!modelInfo) return;
    const motionChanged = activeMotionName !== prevMotionName.current;
    const facialChanged = activeFacialName !== prevFacialName.current;
    prevMotionName.current = activeMotionName;
    prevFacialName.current = activeFacialName;

    if (activeMotionName && motionChanged) {
      const idx = modelInfo.motions.indexOf(activeMotionName);
      if (idx >= 0) {
        setSelectedMotion(idx);
        setActiveTab("animation");
        setAnimSub("motion");
      }
    }
    if (activeFacialName && facialChanged) {
      const idx = modelInfo.facials.indexOf(activeFacialName);
      if (idx >= 0) {
        setSelectedFacial(idx);
        setActiveTab("animation");
        setAnimSub("facial");
      }
    }
  }, [modelInfo, activeMotionName, activeFacialName]);
  const [copiedModel, setCopiedModel] = useState<string | null>(null);

  const filteredModels = models.filter((m) => matchesFilter(m.name, filter));

  const motionCount = modelInfo?.motions.length ?? 0;
  const facialCount = modelInfo?.facials.length ?? 0;
  const animCount = motionCount + facialCount;

  const tabs: { key: Tab; label: string; icon: typeof Box; count?: number }[] = [
    { key: "model", label: "Model", icon: Box, count: models.length || undefined },
    { key: "animation", label: "Animation", icon: Clapperboard, count: animCount || undefined },
  ];

  const isMotionSub = animSub === "motion";
  const currentItems = isMotionSub ? (modelInfo?.motions ?? []) : (modelInfo?.facials ?? []);
  const currentFilter = isMotionSub ? motionFilter : facialFilter;
  const setCurrentFilter = isMotionSub ? setMotionFilter : setFacialFilter;
  const currentSelected = isMotionSub ? selectedMotion : selectedFacial;
  const setCurrentSelected = isMotionSub ? setSelectedMotion : setSelectedFacial;
  const playGroup = isMotionSub ? "Motion" : "Expression";

  return (
    <aside
      className={`flex flex-col bg-background select-none overflow-hidden shrink-0
        fixed inset-y-0 left-0 z-40 w-[85vw] max-w-xs
        shadow-2xl rounded-r-3xl
        transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)]
        md:relative md:z-auto md:rounded-none md:shadow-none
        md:border-r md:border-border
        md:max-w-sm md:transition-[width] md:duration-200
        ${open ? "translate-x-0 md:w-80" : "-translate-x-full md:translate-x-0 md:w-0"}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3.5 border-b border-border"
        style={{ paddingTop: "max(0.875rem, env(safe-area-inset-top))" }}
      >
        <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">
          Untitled Sekai Live2D Viewer
        </h1>
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-surface transition-colors cursor-pointer text-muted hover:text-foreground"
          aria-label="Close sidebar"
        >
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* Pill tabs */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex p-1 bg-surface rounded-2xl">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Icon size={12} />
              {label}
              {count != null && (
                <span className="text-[10px] opacity-50">{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {/* ── Model tab ── */}
        {activeTab === "model" && (
          <div className="flex flex-col h-full min-h-0">
            {fetchLoading && (
              <div className="flex items-center justify-center py-10 text-muted">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}

            {fetchError && (
              <div className="mx-3 mt-2 px-4 py-3 bg-error/5 border border-error/20 rounded-2xl">
                <p className="flex items-center gap-2 text-xs text-error">
                  <AlertCircle size={14} />
                  {fetchError}
                </p>
              </div>
            )}

            {!fetchLoading && !fetchError && models.length === 0 && (
              <div className="flex flex-col items-center py-12 text-muted">
                <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mb-3">
                  <Box size={22} strokeWidth={1.5} />
                </div>
                <p className="text-xs">No models found</p>
              </div>
            )}

            {models.length > 0 && (
              <>
                {models.length > 5 && (
                  <div className="px-3 py-2">
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      />
                      <input
                        type="search"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Search models..."
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-surface rounded-full outline-none focus:ring-2 focus:ring-accent/25 transition-all placeholder:text-muted"
                      />
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-2 py-1">
                  {filteredModels.map((model) => {
                    const uid = `${model.path}/${model.file}`;
                    const isSelected =
                      pendingModel &&
                      `${pendingModel.path}/${pendingModel.file}` === uid;
                    const isLoaded =
                      selectedModel &&
                      `${selectedModel.path}/${selectedModel.file}` === uid;
                    return (
                      <div
                        key={uid}
                        onClick={() => setPendingModel(model)}
                        className={`group flex items-center gap-2 w-full text-left px-3 py-3 rounded-2xl text-sm transition-all duration-150 cursor-pointer mb-0.5 ${
                          isSelected
                            ? "bg-accent/10 text-accent"
                            : isLoaded
                              ? "bg-surface"
                              : "hover:bg-surface"
                        }`}
                      >
                        <span className="truncate flex-1">{model.name}</span>
                        {isLoaded && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-success" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(model.name).then(() => {
                              setCopiedModel(uid);
                              setTimeout(() => setCopiedModel(null), 1200);
                            });
                          }}
                          className="shrink-0 p-1.5 rounded-lg opacity-60 md:opacity-0 md:group-hover:opacity-60 md:hover:!opacity-100 transition-opacity cursor-pointer"
                          aria-label={`Copy ${model.name}`}
                        >
                          {copiedModel === uid ? (
                            <Check size={12} className="text-success" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                  {filteredModels.length === 0 && (
                    <p className="text-xs text-muted px-3 py-3">No matches</p>
                  )}
                </div>

                {/* Actions footer */}
                <div
                  className="px-3 py-3 border-t border-border"
                  style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (pendingModel) {
                          onLoadModel(pendingModel);
                          setSelectedMotion(-1);
                          setSelectedFacial(-1);
                          setMotionFilter("");
                          setFacialFilter("");
                        }
                      }}
                      disabled={!pendingModel}
                      className="flex items-center justify-center gap-2 w-full h-11 text-sm font-semibold bg-accent text-white rounded-2xl hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      <FolderOpen size={14} />
                      Load
                    </button>
                    <button
                      onClick={onDownloadZip}
                      disabled={!selectedModel || downloadState.status === "loading"}
                      className="flex items-center justify-center gap-2 w-full h-11 text-sm font-medium bg-surface text-foreground rounded-2xl hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      aria-label="Download selected model as ZIP"
                    >
                      {downloadState.status === "loading" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : downloadState.status === "success" ? (
                        <Check size={14} className="text-success" />
                      ) : (
                        <Download size={14} />
                      )}
                      ZIP
                    </button>
                  </div>
                  <div
                    className={`grid transition-all duration-300 ${
                      downloadState.status === "idle"
                        ? "mt-0 grid-rows-[0fr] opacity-0 -translate-y-1"
                        : "mt-2 grid-rows-[1fr] opacity-100 translate-y-0"
                    }`}
                    aria-live="polite"
                  >
                    <div className="overflow-hidden">
                      <p className="text-[11px] leading-4 text-muted pb-0.5">
                        {downloadState.message}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Animation tab ── */}
        {activeTab === "animation" && (
          <div className="flex flex-col h-full min-h-0">
            {!modelInfo ? (
              <div className="flex flex-col items-center py-12 text-muted">
                <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mb-3">
                  <Clapperboard size={22} strokeWidth={1.5} />
                </div>
                <p className="text-xs">Load a model first</p>
              </div>
            ) : (
              <>
                {/* Motion / Facial sub-toggle */}
                <div className="px-3 pt-2 pb-1">
                  <div className="flex p-1 bg-surface rounded-2xl">
                    <button
                      onClick={() => { setAnimSub("motion"); setCopiedIndex(null); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-all duration-200 cursor-pointer ${
                        animSub === "motion"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      <Play size={11} />
                      Motion
                      {motionCount > 0 && (
                        <span className="text-[10px] opacity-50">{motionCount}</span>
                      )}
                    </button>
                    <button
                      onClick={() => { setAnimSub("facial"); setCopiedIndex(null); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-all duration-200 cursor-pointer ${
                        animSub === "facial"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      <Smile size={11} />
                      Facial
                      {facialCount > 0 && (
                        <span className="text-[10px] opacity-50">{facialCount}</span>
                      )}
                    </button>
                  </div>
                </div>

                {currentItems.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted">
                    <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mb-3">
                      {isMotionSub
                        ? <Play size={22} strokeWidth={1.5} />
                        : <Smile size={22} strokeWidth={1.5} />}
                    </div>
                    <p className="text-xs">
                      No {isMotionSub ? "motions" : "facials"} available
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-2">
                      <div className="relative">
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          type="search"
                          value={currentFilter}
                          onChange={(e) => setCurrentFilter(e.target.value)}
                          placeholder={`Search ${isMotionSub ? "motions" : "facials"}...`}
                          className="w-full pl-9 pr-3 py-2.5 text-sm bg-surface rounded-full outline-none focus:ring-2 focus:ring-accent/25 transition-all placeholder:text-muted"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 py-1">
                      {currentItems
                        .map((name, i) => ({ name, index: i }))
                        .filter(({ name }) => matchesFilter(name, currentFilter))
                        .map(({ name, index }) => (
                          <div
                            key={index}
                            onClick={() => setCurrentSelected(index)}
                            className={`group flex items-center gap-2 w-full text-left px-3 py-3 rounded-2xl text-sm transition-all duration-150 cursor-pointer mb-0.5 ${
                              currentSelected === index
                                ? "bg-accent/10 text-accent"
                                : "hover:bg-surface"
                            }`}
                          >
                            <span className="truncate flex-1">{name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(name).then(() => {
                                  setCopiedIndex(index);
                                  setTimeout(() => setCopiedIndex(null), 1200);
                                });
                              }}
                              className="shrink-0 p-1.5 rounded-lg opacity-60 md:opacity-0 md:group-hover:opacity-60 md:hover:!opacity-100 transition-opacity cursor-pointer"
                              aria-label={`Copy ${name}`}
                            >
                              {copiedIndex === index ? (
                                <Check size={12} className="text-success" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* Play footer */}
                    <div
                      className="px-3 py-3 border-t border-border"
                      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                    >
                      <button
                        onClick={() => {
                          if (currentSelected >= 0) {
                            onApplyMotion(playGroup, currentSelected);
                            if (window.innerWidth < 768) onToggle();
                          }
                        }}
                        disabled={currentSelected < 0}
                        className="flex items-center justify-center gap-2 w-full h-11 text-sm font-semibold bg-accent text-white rounded-2xl hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        {isMotionSub ? <Play size={14} /> : <Smile size={14} />}
                        Play
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
