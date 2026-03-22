"use client";

import { useState } from "react";
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  Search,
  Box,
  Play,
  Download,
  Smile,
  Clapperboard,
  Copy,
  Check,
} from "lucide-react";
import type { ModelEntry, ModelInfo } from "@/app/page";

interface SidebarProps {
  models: ModelEntry[];
  selectedModel: ModelEntry | null;
  onLoadModel: (model: ModelEntry) => void;
  modelInfo: ModelInfo | null;
  onApplyMotion: (group: string, index: number) => void;
  fetchLoading: boolean;
  fetchError: string | null;
  open: boolean;
  onToggle: () => void;
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
  modelInfo,
  onApplyMotion,
  fetchLoading,
  fetchError,
  open,
  onToggle,
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
  const [copiedModel, setCopiedModel] = useState<string | null>(null);

  const filteredModels = models.filter((m) => matchesFilter(m.name, filter));

  const motionCount = modelInfo?.motions.length ?? 0;
  const facialCount = modelInfo?.facials.length ?? 0;
  const animCount = motionCount + facialCount;

  const tabs: { key: Tab; label: string; icon: typeof Box; count?: number }[] = [
    { key: "model", label: "Model", icon: Box, count: models.length || undefined },
    { key: "animation", label: "Animation", icon: Clapperboard, count: animCount || undefined },
  ];

  // Current animation sub-tab items
  const isMotionSub = animSub === "motion";
  const currentItems = isMotionSub ? (modelInfo?.motions ?? []) : (modelInfo?.facials ?? []);
  const currentFilter = isMotionSub ? motionFilter : facialFilter;
  const setCurrentFilter = isMotionSub ? setMotionFilter : setFacialFilter;
  const currentSelected = isMotionSub ? selectedMotion : selectedFacial;
  const setCurrentSelected = isMotionSub ? setSelectedMotion : setSelectedFacial;
  const playGroup = isMotionSub ? "Motion" : "Expression";

  return (
    <aside
      className={`flex flex-col border-r border-border bg-surface select-none
        fixed inset-y-0 left-0 z-40 w-[85vw] max-w-80 transition-transform duration-200
        md:relative md:z-auto md:w-80 md:transition-[width]
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0"}
        overflow-hidden shrink-0`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">
          Untitled Sekai Live2D Viewer
        </h1>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
          aria-label="Close sidebar"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === key
                ? "text-accent border-b-2 border-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Icon size={12} />
            {label}
            {count != null && (
              <span className="text-[10px] opacity-60">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Model tab */}
        {activeTab === "model" && (
          <div className="flex flex-col h-full">
            {fetchLoading && (
              <div className="flex items-center justify-center py-6 text-muted">
                <Loader2 size={16} className="animate-spin" />
              </div>
            )}

            {fetchError && (
              <div className="px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs text-error">
                  <AlertCircle size={12} />
                  {fetchError}
                </p>
              </div>
            )}

            {!fetchLoading && !fetchError && models.length === 0 && (
              <div className="flex flex-col items-center py-6 text-muted px-4">
                <Box size={28} strokeWidth={1} />
                <p className="text-xs mt-2">No models found</p>
              </div>
            )}

            {models.length > 0 && (
              <>
                {models.length > 5 && (
                  <div className="px-4 py-2">
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                      />
                      <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter models..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-accent transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  {filteredModels.map((model) => {
                    const uid = `${model.path}/${model.file}`;
                    const isSelected = pendingModel && `${pendingModel.path}/${pendingModel.file}` === uid;
                    const isLoaded = selectedModel && `${selectedModel.path}/${selectedModel.file}` === uid;
                    return (
                      <div
                        key={uid}
                        onClick={() => setPendingModel(model)}
                        className={`group flex items-center gap-1 w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-accent/10 text-accent"
                            : isLoaded
                              ? "bg-surface-hover"
                              : "hover:bg-surface-hover"
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
                          className="shrink-0 p-1.5 -mr-1 rounded opacity-60 md:opacity-0 md:group-hover:opacity-60 md:hover:!opacity-100 transition-opacity cursor-pointer"
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
                    <p className="text-sm text-muted px-4 py-2">No matches</p>
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-border" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
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
                    className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <Download size={14} />
                    Load
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Animation tab */}
        {activeTab === "animation" && (
          <div className="flex flex-col h-full">
            {!modelInfo ? (
              <div className="flex flex-col items-center py-6 text-muted px-4">
                <Clapperboard size={28} strokeWidth={1} />
                <p className="text-xs mt-2">Load a model first</p>
              </div>
            ) : (
              <>
                {/* Sub-toggle: Motion / Facial */}
                <div className="flex mx-4 mt-2 p-0.5 bg-background rounded-md border border-border">
                  <button
                    onClick={() => { setAnimSub("motion"); setCopiedIndex(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      animSub === "motion"
                        ? "bg-surface-hover text-foreground"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Play size={11} />
                    Motion
                    {motionCount > 0 && (
                      <span className="text-[10px] opacity-60">{motionCount}</span>
                    )}
                  </button>
                  <button
                    onClick={() => { setAnimSub("facial"); setCopiedIndex(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      animSub === "facial"
                        ? "bg-surface-hover text-foreground"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Smile size={11} />
                    Facial
                    {facialCount > 0 && (
                      <span className="text-[10px] opacity-60">{facialCount}</span>
                    )}
                  </button>
                </div>

                {currentItems.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-muted px-4">
                    {isMotionSub ? <Play size={28} strokeWidth={1} /> : <Smile size={28} strokeWidth={1} />}
                    <p className="text-xs mt-2">
                      No {isMotionSub ? "motions" : "facials"} available
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Filter */}
                    <div className="px-4 py-2">
                      <div className="relative">
                        <Search
                          size={14}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                        />
                        <input
                          type="text"
                          value={currentFilter}
                          onChange={(e) => setCurrentFilter(e.target.value)}
                          placeholder={`Filter ${isMotionSub ? "motions" : "facials"}...`}
                          className="w-full pl-8 pr-2.5 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-accent transition-colors"
                        />
                      </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                      {currentItems
                        .map((name, i) => ({ name, index: i }))
                        .filter(({ name }) => matchesFilter(name, currentFilter))
                        .map(({ name, index }) => (
                          <div
                            key={index}
                            onClick={() => setCurrentSelected(index)}
                            className={`group flex items-center gap-1 w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                              currentSelected === index
                                ? "bg-accent/10 text-accent"
                                : "hover:bg-surface-hover"
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
                              className="shrink-0 p-1.5 -mr-1 rounded opacity-60 md:opacity-0 md:group-hover:opacity-60 md:hover:!opacity-100 transition-opacity cursor-pointer"
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

                    {/* Play button */}
                    <div className="px-4 py-2.5 border-t border-border" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
                      <button
                        onClick={() => {
                          if (currentSelected >= 0) onApplyMotion(playGroup, currentSelected);
                        }}
                        disabled={currentSelected < 0}
                        className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium border border-accent text-accent rounded-md hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
