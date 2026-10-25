import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Check, Cpu, Download, ImagePlus, Layers, Loader2, Maximize2, RefreshCcw, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { PageIntro } from "@/components/Library";
import { EASE_OUT, Reveal, SPRING } from "@/lib/motion";
import {
  ACCEPTED_TYPES,
  MAX_FILE_BYTES,
  MAX_PIXELS,
  MODEL_DOWNLOAD_MB,
  flattenOnto,
  formatBytes,
  loadRemover,
  readImageInfo,
  removeBackground,
} from "@/lib/backgroundRemoval";

const FEATURES = [
  { icon: Cpu, label: "Runs on your device" },
  { icon: ShieldCheck, label: "Nothing is uploaded" },
  { icon: Maximize2, label: "Full original resolution" },
  { icon: Check, label: "Free for everyone" },
];

const BACKGROUNDS = [
  { id: "transparent", label: "Transparent" },
  { id: "#ffffff", label: "White" },
  { id: "#000000", label: "Black" },
  { id: "custom", label: "Custom" },
];

const STAGES = {
  model: "Loading the AI model",
  decode: "Reading your image",
  segment: "Finding the subject",
  compose: "Cutting it out at full resolution",
  encode: "Saving lossless PNG",
};

const CHECKER = {
  backgroundColor: "#fff",
  backgroundImage:
    "linear-gradient(45deg, #e5e5ea 25%, transparent 25%), linear-gradient(-45deg, #e5e5ea 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5ea 75%), linear-gradient(-45deg, transparent 75%, #e5e5ea 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
};

/* Before/after viewer: the cut-out sits over the original and a handle wipes between them. */
function CompareView({ originalUrl, resultUrl, background, width, height }) {
  const reduce = useReducedMotion();
  const frameRef = useRef(null);
  const position = useMotionValue(100);
  const clip = useTransform(position, (v) => `inset(0 ${100 - v}% 0 0)`);
  const handleLeft = useTransform(position, (v) => `${v}%`);

  useEffect(() => {
    if (!resultUrl) {
      position.set(100);
      return undefined;
    }
    if (reduce) {
      position.set(50);
      return undefined;
    }
    // Reveal: sweep the cut-out across, then settle in the middle.
    position.set(0);
    const controls = animate(position, [0, 100, 50], { duration: 2.2, ease: EASE_OUT, times: [0, 0.55, 1] });
    return () => controls.stop();
  }, [resultUrl, reduce, position]);

  const setFromPointer = (event) => {
    const rect = frameRef.current.getBoundingClientRect();
    const next = ((event.clientX - rect.left) / rect.width) * 100;
    position.set(Math.max(0, Math.min(100, next)));
  };

  const backdrop = background === "transparent" ? CHECKER : { backgroundColor: background };

  return (
    <div
      ref={frameRef}
      className="relative mx-auto max-h-[70vh] touch-none select-none overflow-hidden rounded-[20px]"
      style={{ aspectRatio: `${width} / ${height}`, maxWidth: `min(100%, calc(70vh * ${width / height}))` }}
      onPointerDown={(e) => {
        if (!resultUrl) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromPointer(e);
      }}
      onPointerMove={(e) => {
        if (resultUrl && e.buttons) setFromPointer(e);
      }}
    >
      <img src={originalUrl} alt="Original" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
      {resultUrl && (
        <motion.div className="absolute inset-0" style={{ clipPath: clip, ...backdrop }}>
          <img src={resultUrl} alt="Background removed" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        </motion.div>
      )}
      {resultUrl && (
        <motion.div className="pointer-events-none absolute inset-y-0 z-10 -ml-px w-0.5 bg-white shadow-[0_0_12px_rgb(0_0_0/0.4)]" style={{ left: handleLeft }}>
          <span className="media-chip absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-bold">
            ⇆
          </span>
        </motion.div>
      )}
      {resultUrl && (
        <>
          <span className="media-chip chip pointer-events-none absolute left-3 top-3 z-10">Removed</span>
          <span className="media-chip chip pointer-events-none absolute right-3 top-3 z-10">Original</span>
        </>
      )}
    </div>
  );
}

export default function RemoveBackgroundPage() {
  const reduce = useReducedMotion();
  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [info, setInfo] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [stage, setStage] = useState("");
  const [modelProgress, setModelProgress] = useState(0);
  const [modelState, setModelState] = useState("idle"); // idle | loading | ready | error
  const [result, setResult] = useState(null);
  const [background, setBackground] = useState("transparent");
  const [customColor, setCustomColor] = useState("#0071e3");
  const [error, setError] = useState("");
  const downloads = useRef(new Map());

  const activeBackground = background === "custom" ? customColor : background;

  useEffect(() => () => originalUrl && URL.revokeObjectURL(originalUrl), [originalUrl]);
  useEffect(() => () => result?.url && URL.revokeObjectURL(result.url), [result]);

  const onModelProgress = useCallback(({ loaded, total }) => {
    if (total > 0) setModelProgress(Math.min(1, loaded / total));
  }, []);

  const warmUp = useCallback(async () => {
    setModelState((s) => (s === "ready" ? s : "loading"));
    try {
      await loadRemover(onModelProgress);
      setModelState("ready");
    } catch {
      setModelState("error");
    }
  }, [onModelProgress]);

  const pickFile = async (next) => {
    if (!next) return;
    if (!ACCEPTED_TYPES.includes(next.type)) {
      toast.error("Choose a PNG, JPG, WebP, AVIF, BMP or GIF image.");
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      toast.error(`That file is ${formatBytes(next.size)}. The limit is 200 MB.`);
      return;
    }
    let dims;
    try {
      dims = await readImageInfo(next);
    } catch {
      toast.error("Your browser couldn't open that image.");
      return;
    }
    if (dims.width * dims.height > MAX_PIXELS) {
      toast.error(`That image is ${Math.round((dims.width * dims.height) / 1e6)} megapixels. The limit is 100 megapixels.`);
      return;
    }
    downloads.current.clear();
    setFile(next);
    setOriginalUrl(URL.createObjectURL(next));
    setInfo(dims);
    setResult(null);
    setError("");
    setStatus("idle");
    warmUp();
  };

  const run = async () => {
    if (!file || status === "working") return;
    setStatus("working");
    setError("");
    setResult(null);
    downloads.current.clear();
    try {
      const output = await removeBackground(file, { onStage: setStage, onProgress: onModelProgress });
      setModelState("ready");
      setResult(output);
      setStatus("done");
    } catch (err) {
      setError(err?.message || "Something went wrong removing the background.");
      setStatus("error");
    }
  };

  const download = async () => {
    if (!result) return;
    try {
      let blob = result.blob;
      if (activeBackground !== "transparent") {
        blob = downloads.current.get(activeBackground) || (await flattenOnto(result.blob, activeBackground));
        downloads.current.set(activeBackground, blob);
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(file?.name || "image").replace(/\.[^.]+$/, "")}-no-background.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      toast.error(err?.message || "Could not prepare the download.");
    }
  };

  const reset = () => {
    setFile(null);
    setOriginalUrl("");
    setInfo(null);
    setResult(null);
    setStatus("idle");
    setError("");
  };

  const working = status === "working";

  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-28 pt-32 md:px-8 md:pt-36" data-testid="remove-background-page">
      <PageIntro eyebrow="Background Remover" icon={<Wand2 />} title="Remove any background.">
        Drop in a photo and get a clean cut-out at exactly the same resolution, saved as a lossless PNG.
        The AI runs on your own device, so your images never leave it.
      </PageIntro>

      <Reveal className="mt-7 flex flex-wrap gap-2" delay={0.35}>
        {FEATURES.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fill)] px-3 py-1.5 text-[12.5px] font-medium text-ink-2">
            <Icon className="h-3.5 w-3.5 text-tint" /> {label}
          </span>
        ))}
      </Reveal>

      <div className="mt-12 grid items-start gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Reveal className="surface rounded-[28px] p-2.5">
          {!file ? (
            <label
              className={`group relative flex min-h-[460px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[22px] px-6 text-center transition-[background-color,box-shadow] duration-500 ${
                dragging ? "bg-[rgb(var(--tint)/0.08)] shadow-[inset_0_0_0_2px_rgb(var(--tint)/0.6)]" : "bg-[var(--fill)] shadow-[inset_0_0_0_1.5px_var(--line-strong)]"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              data-testid="remove-bg-dropzone"
            >
              <motion.span
                className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-[26px] bg-tint text-tint-ink shadow-[0_18px_40px_-14px_rgb(var(--tint)/0.8)]"
                animate={reduce ? undefined : dragging ? { y: -6, scale: 1.08 } : { y: [0, -6, 0] }}
                transition={dragging ? SPRING : { duration: 3.2, ease: "easeInOut", repeat: Infinity }}
              >
                <ImagePlus className="h-9 w-9" />
              </motion.span>
              <p className="font-display text-[1.6rem] font-semibold tracking-[-0.025em] text-ink">
                {dragging ? "Drop to load it" : "Drop an image here"}
              </p>
              <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">
                or <span className="text-tint group-hover:underline">choose a file</span>. PNG, JPG, WebP or AVIF, up to 100 megapixels.
              </p>
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
                data-testid="remove-bg-file-input"
              />
            </label>
          ) : (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              <div className="relative flex min-h-[360px] items-center justify-center rounded-[22px] bg-[var(--fill)] p-3">
                <CompareView
                  originalUrl={originalUrl}
                  resultUrl={result?.url}
                  background={activeBackground}
                  width={info.width}
                  height={info.height}
                />
                <AnimatePresence>
                  {working && (
                    <motion.div
                      className="pointer-events-none absolute inset-3 overflow-hidden rounded-[20px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="bg-scan absolute inset-0" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 pb-3 pt-4">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink" title={file.name}>{file.name}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-ink-3">
                    <span>{info.width}×{info.height}</span>
                    <span>{formatBytes(file.size)}</span>
                    {result ? <span>PNG {formatBytes(result.blob.size)}</span> : null}
                  </p>
                </div>
                <button type="button" onClick={reset} disabled={working} className="btn btn-sm btn-secondary">
                  <RefreshCcw /> Choose another
                </button>
              </div>
            </motion.div>
          )}
        </Reveal>

        <Reveal className="surface rounded-[28px] p-6" delay={0.08}>
          <h2 className="font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">Background</h2>
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Background">
            {BACKGROUNDS.map((b) => {
              const active = background === b.id;
              const swatch = b.id === "transparent" ? CHECKER : { backgroundColor: b.id === "custom" ? customColor : b.id };
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setBackground(b.id)}
                  className={`relative flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors duration-300 ${active ? "text-ink" : "text-ink-2 hover:bg-[var(--fill)]"}`}
                  data-testid={`remove-bg-background-${b.id.replace("#", "")}`}
                >
                  {active && (
                    <motion.span
                      layoutId="remove-bg-lens"
                      className="absolute inset-0 rounded-[14px] bg-[rgb(var(--tint)/0.1)] shadow-[inset_0_0_0_1.5px_rgb(var(--tint)/0.65)]"
                      transition={SPRING}
                    />
                  )}
                  <span className="relative h-5 w-5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_var(--line-strong)]" style={swatch} />
                  <span className="relative">{b.label}</span>
                </button>
              );
            })}
          </div>
          <AnimatePresence initial={false}>
            {background === "custom" && (
              <motion.label
                className="mt-3 flex items-center gap-3 overflow-hidden rounded-[14px] bg-[var(--fill)] px-3 py-2 text-[13px] text-ink-2"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              >
                <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="bare h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                <span className="font-mono uppercase text-ink">{customColor}</span>
              </motion.label>
            )}
          </AnimatePresence>

          <div className="mt-5 flex items-start gap-2.5 rounded-[16px] bg-[rgb(48_209_88/0.1)] px-3.5 py-3 text-[13px] leading-snug text-ink">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#30d158]" />
            <span>
              {info
                ? `Output: ${info.width}×${info.height} PNG, the exact size of your image, with the original pixels kept as-is.`
                : "Output keeps your image's exact resolution and pixels, saved as a lossless PNG."}
            </span>
          </div>

          <div className="mt-5">
            <AnimatePresence mode="wait" initial={false}>
              {working ? (
                <motion.div
                  key="working"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                  className="flex items-center justify-center gap-2 rounded-full bg-[var(--fill)] py-3.5 text-[14px] font-medium text-ink"
                  data-testid="remove-bg-working"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-tint" />
                  {stage === "model" && modelState !== "ready"
                    ? `Downloading AI model (${Math.round(modelProgress * 100)}%)`
                    : STAGES[stage] || "Working"}
                </motion.div>
              ) : result ? (
                <motion.div
                  key="done"
                  className="space-y-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                >
                  <button type="button" onClick={download} className="btn btn-primary btn-lg btn-block" data-testid="remove-bg-download">
                    <Download /> Download PNG
                  </button>
                  <p className="text-center text-[12px] text-ink-3">
                    {result.width}×{result.height} · {activeBackground === "transparent" ? "transparent background" : "flattened onto your colour"}
                  </p>
                </motion.div>
              ) : (
                <motion.button
                  key="run"
                  type="button"
                  onClick={run}
                  disabled={!file}
                  className="btn btn-primary btn-lg btn-block"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                  data-testid="remove-bg-run"
                >
                  <Layers /> Remove background
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-3">
            {modelState === "loading"
              ? `Preparing the AI: one-time download (${Math.round(modelProgress * 100)}%), then it's cached.`
              : modelState === "error"
                ? "The AI model couldn't load. Check your connection and try again."
                : `First use downloads the AI model once (about ${Math.min(MODEL_DOWNLOAD_MB.webgpu, MODEL_DOWNLOAD_MB.wasm)}–${Math.max(MODEL_DOWNLOAD_MB.webgpu, MODEL_DOWNLOAD_MB.wasm)} MB). Most accurate on devices with a modern GPU.`}
          </p>
          {error && <p className="mt-2 text-center text-[13px] text-[#ff453a]" data-testid="remove-bg-error">{error}</p>}
        </Reveal>
      </div>
    </section>
  );
}
