"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { PanelLeft, Loader2, AlertCircle } from "lucide-react";
import type { ModelEntry, ModelInfo } from "@/app/page";
import { resolveMotionData } from "@/lib/motion";

export interface ViewerHandle {
  loadModel: (entry: ModelEntry) => void;
  playMotion: (group: string, index: number) => void;
}

interface ViewerProps {
  serverUrl: string;
  onToggleSidebar: () => void;
  onModelLoaded: (info: ModelInfo) => void;
  selectedModel: ModelEntry | null;
  sidebarOpen: boolean;
}

export const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer(
  { serverUrl, onToggleSidebar, onModelLoaded, selectedModel, sidebarOpen },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<import("pixi.js").Application | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(null);
  const originalSizeRef = useRef<{ w: number; h: number } | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      });
      if (disposed) {
        app.destroy(true);
        return;
      }
      container!.appendChild(app.canvas);
      appRef.current = app;
    }

    init();

    return () => {
      disposed = true;
      if (app) {
        app.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  // Refit model on any container resize (sidebar toggle, window resize, etc.)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const refit = () => {
      const app = appRef.current;
      const model = modelRef.current;
      const size = originalSizeRef.current;
      if (!app || !model || !size) return;
      app.resize();
      const scale =
        Math.min(app.screen.width / size.w, app.screen.height / size.h) * 0.95;
      model.scale.set(scale);
      model.position.set(app.screen.width / 2, app.screen.height / 2);
    };

    const ro = new ResizeObserver(() => refit());
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const loadModel = useCallback(
    async (entry: ModelEntry) => {
      const app = appRef.current;
      if (!app) return;

      setModelLoading(true);
      setModelError(null);

      // Destroy previous model
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

        // Step 1: Fetch model3.json
        const res = await fetch(modelJsonUrl);
        if (!res.ok) throw new Error(`Failed to fetch model: HTTP ${res.status}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model3Json: any = await res.json();

        // Step 2: Resolve motion data
        const motionData = await resolveMotionData(serverUrl, entry);

        // Step 3: Build FileReferences.Motions
        if (!model3Json.FileReferences) model3Json.FileReferences = {};

        const motionEntries: Record<string, Array<{ File: string }>> = {};

        // Motion group: base motions + additional motions
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

        // Expression group: facials from motion base
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

        // Clear Expressions to avoid conflicts
        delete model3Json.FileReferences.Expressions;

        // Step 4: Set base URL for model resources
        model3Json.url = `${serverUrl}/model/${entry.path}/`;

        // Step 5: Load model from JSON object
        const live2dModel = await Live2DModel.from(model3Json, {
          autoFocus: false,
          autoHitTest: false,
        });

        // Save original dimensions for resize calculations
        originalSizeRef.current = {
          w: live2dModel.width,
          h: live2dModel.height,
        };

        // Center and fit
        const scale =
          Math.min(
            app.screen.width / live2dModel.width,
            app.screen.height / live2dModel.height
          ) * 0.95;

        live2dModel.scale.set(scale);
        live2dModel.anchor.set(0.5);
        live2dModel.position.set(
          app.screen.width / 2,
          app.screen.height / 2
        );

        app.stage.addChild(live2dModel);
        modelRef.current = live2dModel;

        // Build motion/facial name lists
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
    [serverUrl, onModelLoaded]
  );

  const playMotion = useCallback((group: string, index: number) => {
    const model = modelRef.current;
    if (!model) return;
    model.motion(group, index);
  }, []);

  useImperativeHandle(ref, () => ({
    loadModel,
    playMotion,
  }));

  return (
    <main className="flex-1 relative bg-background min-w-0 select-none">
      {/* Toggle sidebar — always visible on mobile, only when closed on desktop */}
      <button
        onClick={onToggleSidebar}
        className={`absolute top-3 left-3 z-10 p-2.5 rounded-md bg-surface border border-border hover:bg-surface-hover transition-colors cursor-pointer ${
          sidebarOpen ? "md:hidden" : ""
        }`}
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <PanelLeft size={16} />
      </button>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--border) 25%, transparent 25%, transparent 75%, var(--border) 75%), linear-gradient(45deg, var(--border) 25%, transparent 25%, transparent 75%, var(--border) 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 10px 10px",
        }}
      />

      {/* Loading overlay */}
      {modelLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-border">
            <Loader2 size={16} className="animate-spin text-accent" />
            <span className="text-sm">Loading model...</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {modelError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-error/30">
            <AlertCircle size={16} className="text-error" />
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

      {/* Model info badge — click to copy */}
      {selectedModel && !modelLoading && !modelError && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(selectedModel.name).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="absolute bottom-3 left-3 px-3 py-1.5 rounded-md bg-surface/80 backdrop-blur-sm border border-border text-xs text-muted hover:bg-surface transition-colors cursor-pointer"
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {copied ? "Copied!" : selectedModel.name}
        </button>
      )}
    </main>
  );
});
