import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Cpu,
  Download,
  FileVideo,
  Gauge,
  Info,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { PageIntro } from "@/components/Library";
import { EASE_OUT, Reveal, SPRING } from "@/lib/motion";
import { LITE } from "@/lib/device";
import {
  ENGINE_SIZE_MB,
  FORMATS,
  FREE_MAX_BYTES,
  OUTPUT_LIMIT_BYTES,
  PREMIUM_MAX_BYTES,
  cancelEngine,
  convertFile,
  extOf,
  formatBytes,
  formatDuration,
  loadEngine,
  describeChannels,
  planConversion,
  probeFile,
} from "@/lib/converter";
import { canStream, cancelStream, pickSaveTarget, streamConvert, supportsStreamingSave } from "@/lib/streamConvert";

const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm", "mkv", "avi", "wmv", "flv", "mpg", "mpeg", "3gp", "ts", "mts", "m2ts", "ogv", "gif"];
const GIF_FPS = [10, 15, 24, 30];
const GIF_WIDTHS = [
  { value: 0, label: "Original" },
  { value: 1080, label: "1080" },
  { value: 720, label: "720" },
  { value: 480, label: "480" },
  { value: 320, label: "320" },
];

const STAGE_LABEL = {
  engine: "Starting converter",
  probe: "Reading your file",
  copy: "Copying streams",
  encode: "Converting",
  stream: "Saving to your computer",
};

const FEATURES = [
  { icon: Cpu, label: "Runs on your device" },
  { icon: ShieldCheck, label: "Nothing is uploaded" },
  { icon: Sparkles, label: "Lossless when possible" },
  { icon: Check, label: "Free for everyone" },
];

function isVideoFile(file) {
  return file.type.startsWith("video/") || VIDEO_EXTENSIONS.includes(extOf(file.name));
}

function defaultFormatFor(file) {
  const ext = extOf(file.name);
  if (ext === "mp4" || ext === "m4v") return "mov";
  return "mp4";
}

function Segmented({ options, value, onChange, layoutId }) {
  return (
    <div className="flex rounded-full bg-[var(--fill)] p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`relative z-10 flex-1 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-300 ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-full bg-panel shadow-[0_1px_3px_rgb(0_0_0/0.14),0_0_0_0.5px_var(--line)]"
                transition={SPRING}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ConverterPage() {
  const reduce = useReducedMotion();
  const { hasPremium } = useAuth();
  const maxBytes = hasPremium ? PREMIUM_MAX_BYTES : FREE_MAX_BYTES;
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [meta, setMeta] = useState(null);
  const [info, setInfo] = useState(null);
  const [format, setFormat] = useState("mp4");
  const [gifFps, setGifFps] = useState(24);
  const [gifWidth, setGifWidth] = useState(720);
  // Surround audio is mixed down to stereo unless the user picks "Keep".
  const [stereo, setStereo] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [engineState, setEngineState] = useState("idle"); // idle | loading | ready | error
  const [engineProgress, setEngineProgress] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | converting | done | error
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const selectedFormat = FORMATS.find((f) => f.id === format);
  const options = useMemo(() => ({ fps: gifFps, width: gifWidth, stereo }), [gifFps, gifWidth, stereo]);
  const basePlan = useMemo(() => (info ? planConversion(info, format, options, file?.size || 0) : null), [info, format, options, file]);
  // Files whose result would be too big for the in-browser engine stream straight to disk
  // instead (Chrome and Edge on a computer), copying the video as-is.
  const streaming = Boolean(file && info && file.size > OUTPUT_LIMIT_BYTES && supportsStreamingSave() && canStream(info, format));
  const plan = useMemo(() => {
    if (!basePlan || basePlan.error) return basePlan;
    if (streaming) {
      const audio = (info?.audio?.channels || 0) > 2 && stereo ? ` The ${describeChannels(info.audio)} audio is mixed down to stereo.` : "";
      return {
        lossless: true,
        note: `Too big to build inside the browser, so it's saved straight to your computer as it converts: you'll choose where. Video copied as-is with no quality loss.${audio}`,
      };
    }
    if (basePlan.forceEncode && !supportsStreamingSave()) {
      return { ...basePlan, note: `${basePlan.note} Tip: Chrome or Edge on a computer can save files this size straight to disk in minutes, without re-encoding.` };
    }
    return basePlan;
  }, [basePlan, streaming, info, stereo]);
  const surround = (info?.audio?.channels || 0) > 2 && format !== "gif";

  // Free object URLs when they are replaced or the page closes.
  useEffect(() => () => sourceUrl && URL.revokeObjectURL(sourceUrl), [sourceUrl]);
  useEffect(() => () => result?.url && URL.revokeObjectURL(result.url), [result]);

  useEffect(() => {
    if (status !== "converting") return undefined;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [status]);

  const prepareEngine = useCallback(async () => {
    setEngineState((state) => (state === "ready" ? state : "loading"));
    try {
      await loadEngine(({ received, total }) => {
        if (total > 0) setEngineProgress(received / total);
      });
      setEngineState("ready");
      return true;
    } catch {
      setEngineState("error");
      return false;
    }
  }, []);

  const pickFile = async (next) => {
    if (!next) return;
    if (!isVideoFile(next)) {
      toast.error("Choose a video file, like MP4, MOV, WebM, MKV or AVI.");
      return;
    }
    if (next.size > maxBytes) {
      if (!hasPremium && next.size <= PREMIUM_MAX_BYTES) {
        toast.error(`That file is ${formatBytes(next.size)}. Free accounts can convert up to 2 GB. Premium raises the limit to 10 GB.`);
      } else {
        toast.error(`That file is ${formatBytes(next.size)}. The converter supports files up to ${hasPremium ? "10" : "2"} GB.`);
      }
      return;
    }
    setFile(next);
    setSourceUrl(URL.createObjectURL(next));
    setMeta(null);
    setInfo(null);
    setResult(null);
    setError("");
    setStatus("idle");
    setFormat(defaultFormatFor(next));
    setStereo(true);
    if (await prepareEngine()) {
      try {
        const probed = await probeFile(next);
        setInfo(probed);
        if (probed.video?.width && probed.video.width < 720) setGifWidth(0);
      } catch {
        setInfo({ duration: 0, video: { codec: "" }, audio: null });
      }
    }
  };

  const reset = () => {
    setFile(null);
    setSourceUrl("");
    setMeta(null);
    setInfo(null);
    setResult(null);
    setError("");
    setStatus("idle");
  };

  const convert = async () => {
    if (!file || status === "converting") return;
    if (streaming) {
      convertToDisk();
      return;
    }
    setStatus("converting");
    setProgress(0);
    setElapsed(0);
    setError("");
    setResult(null);
    try {
      const output = await convertFile(file, format, {
        options,
        onProgress: setProgress,
        onStage: setStage,
        onDownload: ({ received, total }) => total > 0 && setEngineProgress(received / total),
      });
      setEngineState("ready");
      setResult({ ...output, url: URL.createObjectURL(output.blob), size: output.blob.size });
      setStatus("done");
    } catch (err) {
      if (err?.message === "called FFmpeg.terminate()") return;
      setError(err?.message || "Conversion failed. Try a different format.");
      setStatus("error");
    }
  };

  const convertToDisk = async () => {
    const name = `${file.name.replace(/\.[^.]+$/, "") || "video"}.${selectedFormat.ext}`;
    let handle;
    try {
      handle = await pickSaveTarget(name, format); // must open straight from the click
    } catch {
      toast.error("Your browser couldn't open the Save dialog.");
      return;
    }
    if (!handle) return;
    setStatus("converting");
    setStage("stream");
    setProgress(0);
    setElapsed(0);
    setError("");
    setResult(null);
    try {
      const output = await streamConvert(file, format, handle, { stereo, onProgress: setProgress });
      setResult(output);
      setStatus("done");
    } catch (err) {
      if (err?.message === "cancelled") return;
      setError(err?.message || "Conversion failed. Try a different format.");
      setStatus("error");
    }
  };

  const cancel = async () => {
    if (stage === "stream") {
      await cancelStream();
      setStatus("idle");
      setProgress(0);
      toast("Conversion cancelled.");
      return;
    }
    await cancelEngine();
    setEngineState("idle");
    setStatus("idle");
    setProgress(0);
    toast("Conversion cancelled.");
  };

  const downloadResult = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.url;
    link.download = result.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const width = info?.video?.width || meta?.width;
  const height = info?.video?.height || meta?.height;
  const duration = info?.duration || meta?.duration;
  const converting = status === "converting";

  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-28 pt-32 md:px-8 md:pt-36" data-testid="converter-page">
      <PageIntro eyebrow="Converter" icon={<RefreshCcw />} title="Convert any video.">
        Free video convertor for MP4, GIF, MOV and MKV&apos;s at lossless quality. Don&apos;t have to worry about Adobe
        programs rejecting your file type anymore. Model runs locally on your device, with no queue.
      </PageIntro>

      <Reveal className="mt-7 flex flex-wrap gap-2" delay={0.35}>
        {FEATURES.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fill)] px-3 py-1.5 text-[12.5px] font-medium text-ink-2">
            <Icon className="h-3.5 w-3.5 text-tint" /> {label}
          </span>
        ))}
      </Reveal>

      <div className="mt-12 grid items-start gap-5 lg:grid-cols-[1.12fr_0.88fr]">
        {/* Source */}
        <Reveal className="surface rounded-[28px] p-2.5">
          <AnimatePresence mode="wait" initial={false}>
            {!file ? (
              <motion.label
                key="drop"
                className={`group relative flex min-h-[420px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[22px] px-6 text-center transition-[background-color,box-shadow] duration-500 ${
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
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
                data-testid="converter-dropzone"
              >
                <motion.span
                  className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-[26px] bg-tint text-tint-ink shadow-[0_18px_40px_-14px_rgb(var(--tint)/0.8)]"
                  animate={reduce ? undefined : dragging ? { y: -6, scale: 1.08 } : { y: [0, -6, 0] }}
                  transition={dragging ? SPRING : { duration: 3.2, ease: "easeInOut", repeat: Infinity }}
                >
                  <UploadCloud className="h-9 w-9" />
                </motion.span>
                <p className="font-display text-[1.6rem] font-semibold tracking-[-0.025em] text-ink">
                  {dragging ? "Drop to load it" : LITE ? "Choose a video" : "Drop a video here"}
                </p>
                <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">
                  {LITE ? "Tap to pick one from your files or library" : <>or <span className="text-tint group-hover:underline">choose a file</span></>}. MP4, MOV, WebM, MKV, AVI and more, up to {hasPremium ? "10 GB" : "2 GB"}.
                </p>
                {!hasPremium && (
                  <Link
                    to="/premium"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 inline-flex items-center gap-1 rounded-full bg-[rgb(255_179_64/0.14)] px-3 py-1 text-[12px] font-semibold text-[#c27a00] hover:underline dark:text-[#ffb340]"
                  >
                    Premium converts files up to 10 GB
                  </Link>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/*,.mkv,.avi,.mov,.m4v,.webm,.wmv,.flv,.mts,.m2ts,.ts,.gif"
                  className="hidden"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  data-testid="converter-file-input"
                />
              </motion.label>
            ) : (
              <motion.div
                key="file"
                initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
              >
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[22px] bg-black">
                  <video
                    src={sourceUrl}
                    className="h-full w-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(e) => setMeta({
                      duration: e.currentTarget.duration,
                      width: e.currentTarget.videoWidth,
                      height: e.currentTarget.videoHeight,
                    })}
                    onError={() => setMeta((m) => m || { unsupportedPreview: true })}
                  />
                  {meta?.unsupportedPreview && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: "rgb(255 255 255 / 0.7)" }}>
                      <FileVideo className="h-9 w-9" />
                      <p className="text-[13px]">Your browser can&apos;t preview this format, but it can still be converted.</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3 px-3.5 pb-3 pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink" title={file.name}>{file.name}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
                      <span>{formatBytes(file.size)}</span>
                      {duration ? <span>{formatDuration(duration)}</span> : null}
                      {width && height ? <span>{width}×{height}</span> : null}
                      {info?.video?.fps ? <span>{Math.round(info.video.fps * 100) / 100} fps</span> : null}
                      {info?.video?.codec ? <span className="uppercase">{info.video.codec}</span> : null}
                      {info?.audio?.codec ? (
                        <span>
                          <span className="uppercase">{info.audio.codec}</span>
                          {describeChannels(info.audio) ? ` · ${describeChannels(info.audio)}` : ""}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <button type="button" onClick={reset} disabled={converting} className="btn btn-sm btn-secondary">
                    <RefreshCcw /> Choose another
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Reveal>

        {/* Output */}
        <Reveal className="surface rounded-[28px] p-6" delay={0.08}>
          <h2 className="font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">Convert to</h2>
          <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Output format">
            {FORMATS.map((f) => {
              const active = f.id === format;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={converting}
                  onClick={() => setFormat(f.id)}
                  className={`relative flex flex-col items-start rounded-[16px] px-3 py-2.5 text-left transition-colors duration-300 disabled:opacity-60 ${active ? "text-ink" : "text-ink-2 hover:bg-[var(--fill)]"}`}
                  data-testid={`converter-format-${f.id}`}
                >
                  {active && (
                    <motion.span
                      layoutId="converter-format-lens"
                      className="absolute inset-0 rounded-[16px] bg-[rgb(var(--tint)/0.1)] shadow-[inset_0_0_0_1.5px_rgb(var(--tint)/0.65)]"
                      transition={SPRING}
                    />
                  )}
                  <span className="relative font-display text-[15px] font-semibold tracking-[-0.01em]">{f.label}</span>
                  <span className="relative mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-3">{f.detail}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence initial={false}>
            {format === "gif" && (
              <motion.div
                key="gif-options"
                className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
              >
                <div className="space-y-3 pt-5">
                  <div>
                    <p className="label">Frame rate</p>
                    <Segmented options={GIF_FPS.map((v) => ({ value: v, label: `${v} fps` }))} value={gifFps} onChange={setGifFps} layoutId="gif-fps" />
                  </div>
                  <div>
                    <p className="label">Width (px)</p>
                    <Segmented options={GIF_WIDTHS} value={gifWidth} onChange={setGifWidth} layoutId="gif-width" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {surround && (
              <motion.div
                key="audio-channels"
                className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
              >
                <div className="pt-5" data-testid="converter-audio-channels">
                  <p className="label">Audio · this file has {describeChannels(info.audio)} sound</p>
                  <Segmented
                    options={[
                      { value: "stereo", label: "Stereo" },
                      { value: "keep", label: `Keep ${/^\d+\.\d+/.exec(info.audio.layout || "")?.[0] || `${info.audio.channels} channels`}` },
                    ]}
                    value={stereo ? "stereo" : "keep"}
                    onChange={(value) => setStereo(value === "stereo")}
                    layoutId="audio-channels"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-5 min-h-[3.25rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${format}-${plan?.note || plan?.error || (file ? "reading" : "empty")}`}
                className={`flex items-start gap-2.5 rounded-[16px] px-3.5 py-3 text-[13px] leading-snug ${
                  plan?.error ? "notice-warn" : plan?.lossless ? "bg-[rgb(48_209_88/0.1)] text-ink" : "bg-[var(--fill)] text-ink-2"
                }`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                {plan?.lossless ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#30d158]" /> : plan?.error ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9f0a]" /> : <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />}
                <span>
                  {plan?.error || plan?.note || (file ? "Reading your file..." : `${selectedFormat.label}: ${selectedFormat.detail}. Pick a file to see exactly how it will be converted.`)}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-5">
            <AnimatePresence mode="wait" initial={false}>
              {converting ? (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                >
                  <div className="mb-2 flex items-center justify-between text-[13px]">
                    <span className="inline-flex items-center gap-2 font-medium text-ink">
                      <Loader2 className="h-4 w-4 animate-spin text-tint" />
                      {stage === "engine" && engineState !== "ready"
                        ? `Downloading converter (${Math.round(engineProgress * 100)}%)`
                        : STAGE_LABEL[stage] || "Converting"}
                    </span>
                    <span className="tabular-nums text-ink-3">
                      {Math.round(progress * 100)}% · {formatDuration(elapsed)}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-[var(--fill-2)]">
                    <motion.div
                      className="converter-progress absolute inset-y-0 left-0 rounded-full bg-tint"
                      animate={{ width: `${Math.max(3, progress * 100)}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 24 }}
                    />
                  </div>
                  <button type="button" onClick={cancel} className="btn btn-sm btn-ghost mt-3 w-full">
                    <X /> Cancel
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="convert"
                  type="button"
                  onClick={convert}
                  disabled={!file || !info || Boolean(plan?.error)}
                  className="btn btn-primary btn-lg btn-block"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                  data-testid="converter-convert"
                >
                  {file && !info ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
                  Convert to {selectedFormat.label}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-3">
            {engineState === "loading"
              ? `Preparing the converter: one-time ${ENGINE_SIZE_MB} MB download (${Math.round(engineProgress * 100)}%).`
              : engineState === "error"
                ? "The converter couldn't load. Check your connection and try again."
                : "Speed depends on your device. Large files and re-encodes take longer."}
          </p>
          {error && <p className="mt-2 text-center text-[13px] text-[#ff453a]" data-testid="converter-error">{error}</p>}
        </Reveal>
      </div>

      <AnimatePresence>
        {result && status === "done" && (
          <motion.div
            key={result.url || result.name}
            className="surface mt-5 overflow-hidden rounded-[28px]"
            initial={reduce ? false : { opacity: 0, y: 30, scale: 0.98, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
            data-testid="converter-result"
          >
            <div className="grid gap-6 p-2.5 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-[22px] bg-black">
                {result.streamed ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" style={{ color: "rgb(255 255 255 / 0.75)" }}>
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(48_209_88/0.15)] text-[#30d158]">
                      <Check className="h-7 w-7" strokeWidth={2.5} />
                    </span>
                    <p className="text-[14px]">Saved to your computer</p>
                  </div>
                ) : result.kind === "video" ? (
                  <video src={result.url} className="max-h-[420px] w-full object-contain" controls playsInline />
                ) : result.kind === "image" ? (
                  <img src={result.url} alt="Converted GIF" className="max-h-[420px] w-auto object-contain" />
                ) : (
                  <audio src={result.url} controls className="w-[85%]" />
                )}
              </div>
              <div className="px-4 pb-5 md:px-2 md:pb-0 md:pr-6">
                <p className="eyebrow inline-flex items-center gap-1.5 !text-[#30d158]">
                  <Check className="h-4 w-4" strokeWidth={3} /> Ready
                </p>
                <h3 className="mt-1 break-all font-display text-[1.5rem] font-semibold leading-tight tracking-[-0.025em] text-ink">{result.name}</h3>
                <div className="mt-4 flex items-center gap-3 text-[14px]">
                  <span className="text-ink-3">{formatBytes(file?.size || 0)}</span>
                  <ArrowRight className="h-4 w-4 text-ink-3" />
                  <span className="font-semibold text-ink">{formatBytes(result.size)}</span>
                </div>
                <p className="mt-2 text-[13px] text-ink-2">
                  {result.streamed
                    ? `Saved where you chose. The video was copied with no quality loss${result.lossless ? "." : " and the audio converted to stereo."}`
                    : result.lossless ? "Converted without any quality loss." : "Converted at the highest quality settings for this format."}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {!result.streamed && (
                    <button type="button" onClick={downloadResult} className="btn btn-primary" data-testid="converter-download">
                      <Download /> Download
                    </button>
                  )}
                  <button type="button" onClick={() => setStatus("idle")} className="btn btn-secondary">
                    Convert to another format
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
