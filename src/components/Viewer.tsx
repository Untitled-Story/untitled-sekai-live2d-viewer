"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { PanelLeft, Loader2, AlertCircle, Camera, Share2, Check } from "lucide-react";
import type { ModelEntry, ModelInfo } from "@/app/page";
import { resolveMotionData } from "@/lib/motion";

import type { Live2DModel } from "untitled-pixi-live2d-engine";

export interface ViewerHandle {
  loadModel: (entry: ModelEntry) => void;
  playMotion: (group: string, index: number) => void;
}

interface ViewerProps {
  serverUrl: string;
  onToggleSidebar: () => void;
  onModelLoaded: (info: ModelInfo) => void;
  onReady: () => void;
  selectedModel: ModelEntry | null;
  sidebarOpen: boolean;
  activeMotionName: string | null;
  activeFacialName: string | null;
}

export const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer(
  {
    serverUrl,
    onToggleSidebar,
    onModelLoaded,
    onReady,
    selectedModel,
    sidebarOpen,
    activeMotionName,
    activeFacialName,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<import("pixi.js").Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const originalSizeRef = useRef<{ w: number; h: number } | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = useCallback(() => {
    if (!selectedModel) return;
    const url = new URL(window.location.href.split("?")[0]);
    url.searchParams.set("model", selectedModel.name);
    if (activeMotionName) url.searchParams.set("motion", activeMotionName);
    if (activeFacialName) url.searchParams.set("facial", activeFacialName);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    });
  }, [selectedModel, activeMotionName, activeFacialName]);

  // Initialize PixiJS
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let app: import("pixi.js").Application | null = null;
    let disposed = false;

    async function init() {
      const { Application } = await import("pixi.js");
      if (disposed) return;
      app = new Application();
      await app.init({
        resizeTo: container!,
        preference: "webgl",
        autoDensity: true,
        resolution: window.devicePixelRatio,
        backgroundAlpha: 0,
        preserveDrawingBuffer: true,
      });
      if (disposed) {
        app.destroy(true);
        return;
      }
      container!.appendChild(app.canvas);
      appRef.current = app;
      onReady();
    }

    init();

    return () => {
      disposed = true;
      if (app) {
        app.destroy(true);
        appRef.current = null;
      }
    };
  }, [onReady]);

  // Shared fit helper — reads refs directly so it's always fresh
  const fitModel = useCallback((_sw: number, sh: number) => {
    const model = modelRef.current;
    if (!model || sh === 0) return;
    const scale = (sh / model.internalModel.originalHeight) * 2.1;
    model.scale.set(scale);
    model.x = _sw / 2;
    model.y = sh * (0.5 + 0.3);
  }, []);

  // Refit model on container resize — debounced to one rAF per burst
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const ro = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const app = appRef.current;
        if (!app) return;
        app.resize();
        fitModel(app.screen.width, app.screen.height);
      });
    });

    ro.observe(container);
    return () => {
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [fitModel]);

  const loadModel = useCallback(
    async (entry: ModelEntry) => {
      const app = appRef.current;
      if (!app) return;

      setModelLoading(true);
      setModelError(null);

      if (modelRef.current) {
        try {
          modelRef.current.destroy();
        } catch {
          // ignore
        }
        modelRef.current = null;
      }
      app.stage.removeChildren();

      try {
        const { Live2DModel } = await import("untitled-pixi-live2d-engine");

        const modelJsonUrl = `${serverUrl}/model/${entry.path}/${entry.file}`;

        const res = await fetch(modelJsonUrl);
        if (!res.ok) { // noinspection ExceptionCaughtLocallyJS
          throw new Error(`Failed to fetch model: HTTP ${res.status}`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model3Json: any = await res.json();

        const motionData = await resolveMotionData(serverUrl, entry);

        if (!model3Json.FileReferences) model3Json.FileReferences = {};

        const motionEntries: Record<string, Array<{ File: string }>> = {};

        const motionFiles: Array<{ File: string }> = [];
        for (const name of motionData.motions) {
          motionFiles.push({
            File: `${serverUrl}/motion/${motionData.motionBasePath}/motion/${name}.motion3.json`,
          });
        }
        for (const name of motionData.additionalMotions) {
          motionFiles.push({
            File: `${serverUrl}/model/${entry.path}/motions/${name}.motion3.json`,
          });
        }
        if (motionFiles.length > 0) {
          motionEntries["Motion"] = motionFiles;
        }

        const facialFiles: Array<{ File: string }> = [];
        for (const name of motionData.facials) {
          facialFiles.push({
            File: `${serverUrl}/motion/${motionData.motionBasePath}/facial/${name}.motion3.json`,
          });
        }
        if (facialFiles.length > 0) {
          motionEntries["Expression"] = facialFiles;
        }

        model3Json.FileReferences.Motions = motionEntries;
        delete model3Json.FileReferences.Expressions;
        model3Json.url = `${serverUrl}/model/${entry.path}/`;

        const live2dModel = await Live2DModel.from(model3Json, {
          autoFocus: false,
          autoHitTest: false,
          breathDepth: 0.3
        });

        const naturalW = live2dModel.width;
        const naturalH = live2dModel.height;
        originalSizeRef.current = { w: naturalW, h: naturalH };

        live2dModel.anchor.set(0.5);

        app.stage.addChild(live2dModel);
        modelRef.current = live2dModel;

        app.resize();
        fitModel(app.screen.width, app.screen.height);

        const motionNames = [
          ...motionData.motions,
          ...motionData.additionalMotions,
        ];
        const facialNames = [...motionData.facials];

        onModelLoaded({ motions: motionNames, facials: facialNames });
      } catch (e) {
        setModelError(
          e instanceof Error ? e.message : "Failed to load model"
        );
      } finally {
        setModelLoading(false);
      }
    },
    [fitModel, serverUrl, onModelLoaded]
  );

  const playMotion = useCallback((group: string, index: number) => {
    const model = modelRef.current;
    if (!model) return;
    model.motion(group, index, 3);
  }, []);

  useImperativeHandle(ref, () => ({
    loadModel,
    playMotion,
  }));

  return (
    <main className="flex-1 relative bg-surface min-w-0 select-none">
      {/* Toggle sidebar button */}
      <button
        onClick={onToggleSidebar}
        className={`absolute z-10 flex items-center justify-center w-10 h-10 rounded-2xl bg-background shadow-md border border-border/60 hover:shadow-lg hover:bg-surface transition-all duration-200 cursor-pointer ${
          sidebarOpen ? "md:hidden" : ""
        }`}
        style={{
          top: "max(0.75rem, env(safe-area-inset-top))",
          left: "0.75rem",
        }}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <PanelLeft size={16} />
      </button>

      {/* Canvas — soft dot-grid background */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          backgroundColor: "var(--background)",
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Loading overlay */}
      {modelLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-background shadow-xl border border-border/50">
            <Loader2 size={16} className="animate-spin text-accent" />
            <span className="text-sm font-medium">Loading model…</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {modelError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-background shadow-xl border border-error/20 max-w-xs mx-4">
            <AlertCircle size={16} className="text-error shrink-0" />
            <span className="text-sm text-error">{modelError}</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedModel && !modelLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-muted text-sm">Select and load a model to preview</p>
        </div>
      )}

      {/* Bottom-right: screenshot button */}
      {selectedModel && !modelLoading && !modelError && (
        <button
          onClick={() => {
            const app = appRef.current;
            if (!app) return;
            const canvas = app.canvas as HTMLCanvasElement;
            canvas.toBlob((blob) => {
              if (!blob) return;
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${selectedModel.name}.png`;
              a.click();
              URL.revokeObjectURL(url);
            }, "image/png");
          }}
          className="absolute flex items-center justify-center w-10 h-10 rounded-2xl bg-background/90 backdrop-blur-sm shadow-md border border-border/50 text-muted hover:bg-background hover:text-foreground hover:shadow-lg transition-all duration-200 cursor-pointer"
          style={{
            bottom: "max(0.75rem, env(safe-area-inset-bottom))",
            right: "0.75rem",
          }}
          aria-label="Screenshot"
        >
          <Camera size={16} />
        </button>
      )}

      {/* Bottom-right: share button */}
      {selectedModel && !modelLoading && !modelError && (
        <button
          onClick={handleShare}
          className="absolute flex items-center justify-center w-10 h-10 rounded-2xl bg-background/90 backdrop-blur-sm shadow-md border border-border/50 text-muted hover:bg-background hover:text-foreground hover:shadow-lg transition-all duration-200 cursor-pointer"
          style={{
            bottom: "max(0.75rem, env(safe-area-inset-bottom))",
            right: "3.75rem",
          }}
          aria-label="Share link"
        >
          {shareCopied ? <Check size={16} className="text-success" /> : <Share2 size={16} />}
        </button>
      )}

      {/* Bottom-left: model name badge */}
      {selectedModel && !modelLoading && !modelError && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(selectedModel.name).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="absolute px-3.5 py-2 rounded-full bg-background/90 backdrop-blur-sm shadow-md border border-border/50 text-xs text-muted hover:bg-background hover:text-foreground hover:shadow-lg transition-all duration-200 cursor-pointer max-w-[calc(100%-5rem)] truncate"
          style={{
            bottom: "max(0.75rem, env(safe-area-inset-bottom))",
            left: "0.75rem",
          }}
        >
          {copied ? "Copied!" : selectedModel.name}
        </button>
      )}
    </main>
  );
});
