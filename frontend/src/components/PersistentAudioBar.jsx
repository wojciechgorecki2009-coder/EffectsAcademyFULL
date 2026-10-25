import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "framer-motion";
import { Download, Loader2, Music2, Pause, Play, Volume2, VolumeX, Repeat } from "lucide-react";
import LiquidGlass from "@/components/LiquidGlass";
import { EASE_OUT, SPRING } from "@/lib/motion";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  seekGlobalAudio,
  setGlobalLooping,
  setGlobalVolume,
  toggleGlobalAudio,
  toggleGlobalMute,
  useGlobalAudio,
} from "@/lib/globalAudio";

function fmt(t) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function safeAudioTitle(title = "audio") {
  return (title || "audio").replace(/[<>:"/\\|?*]+/g, "_").trim() || "audio";
}

/*
 * Entrance choreography, modelled on the Dynamic Island: the player appears
 * as a small capsule carrying the artwork and a live equalizer, springs open
 * to full width, then its controls fade up into place. Exit runs in reverse.
 */
const ISLAND_SPRING = { type: "spring", stiffness: 170, damping: 22, mass: 0.9 };

const DOCK_VARIANTS = {
  hidden: { y: 36, opacity: 0, transition: { duration: 0.3, ease: EASE_OUT, delay: 0.32 } },
  shown: { y: 0, opacity: 1, transition: { duration: 0.45, ease: EASE_OUT } },
};

const ISLAND_VARIANTS = {
  hidden: {
    clipPath: "inset(16px 41% 16px 41% round 999px)",
    transition: { ...ISLAND_SPRING, stiffness: 260, damping: 30, delay: 0.12 },
  },
  shown: {
    // Ends outside the box (negative inset) so the glass shadow is never clipped,
    // while keeping a value the exit animation can interpolate back from.
    clipPath: "inset(-64px -12% -64px -12% round 30px)",
    transition: { ...ISLAND_SPRING, delay: 0.12 },
  },
};

const SEED_VARIANTS = {
  hidden: { opacity: 1, scale: 0.9, filter: "blur(0px)", transition: { duration: 0.2 } },
  shown: { opacity: 0, scale: 1.25, filter: "blur(6px)", transition: { duration: 0.35, ease: EASE_OUT, delay: 0.26 } },
};

const CONTENT_VARIANTS = {
  hidden: { opacity: 0, y: 6, filter: "blur(8px)", transition: { duration: 0.16 } },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transitionEnd: { filter: "none" },
    transition: { duration: 0.55, ease: EASE_OUT, delay: 0.34 },
  },
};

export default function PersistentAudioBar() {
  const audio = useGlobalAudio();
  const [generatingRate, setGeneratingRate] = useState(null);
  const reduce = useReducedMotion();
  const [pulseScope, animatePulse] = useAnimate();
  const lastTitle = useRef(audio.title);

  // A gentle "breath" when the track changes while the player is already open.
  useEffect(() => {
    if (lastTitle.current && audio.title && lastTitle.current !== audio.title && pulseScope.current && !reduce) {
      animatePulse(pulseScope.current, { scale: [1, 1.025, 1] }, { duration: 0.55, ease: EASE_OUT });
    }
    lastTitle.current = audio.title;
  }, [audio.title, animatePulse, pulseScope, reduce]);

  const pct = audio.duration > 0 ? Math.min(100, (audio.progress / audio.duration) * 100) : 0;
  const downloadCurrent = () => {
    if (!audio.downloadUrl) {
      toast.error("No download available for this audio.");
      return;
    }
    const link = document.createElement("a");
    link.href = audio.downloadUrl;
    link.download = audio.downloadFilename || "audio";
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (audio.assetId) api.post(`/assets/${audio.assetId}/download`).catch(() => {});
    toast.success("Starting download...");
  };
  const downloadSlowed = async (rate) => {
    if (generatingRate || !audio.allowSlowedDownloads) return;
    setGeneratingRate(rate);
    try {
      const response = await fetch(audio.src);
      if (!response.ok) throw new Error("Unable to load audio");
      const encoded = await response.arrayBuffer();
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass || !window.OfflineAudioContext) throw new Error("Audio processing is not supported in this browser");
      const decoder = new AudioContextClass();
      const decoded = await decoder.decodeAudioData(encoded.slice(0));
      await decoder.close();
      const outputFrames = Math.ceil(decoded.length / rate);
      const offline = new OfflineAudioContext(decoded.numberOfChannels, outputFrames, decoded.sampleRate);
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.playbackRate.value = rate;
      source.connect(offline.destination);
      source.start(0);
      const slowed = await offline.startRendering();
      const blob = audioBufferToWav(slowed);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${safeAudioTitle(audio.title)} - ${rate}x slowed.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      if (audio.assetId) api.post(`/assets/${audio.assetId}/download`).catch(() => {});
      toast.success(`${rate}x slowed version downloaded.`);
    } catch (error) {
      toast.error(error?.message || "Unable to create slowed audio.");
    } finally {
      setGeneratingRate(null);
    }
  };

  const ctrl =
    "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full text-ink-2 transition-[color,background-color,transform] duration-300 ease-spring hover:bg-[var(--fill-2)] hover:text-ink active:scale-90 disabled:opacity-40";
  const muted = audio.muted || audio.volume === 0;

  const slowedButtons = audio.allowSlowedDownloads
    ? [0.9, 0.8].map((rate) => (
        <button
          key={rate}
          type="button"
          onClick={() => downloadSlowed(rate)}
          disabled={Boolean(generatingRate)}
          className={`${ctrl} px-2.5 font-mono text-[12px] font-semibold tabular-nums`}
          title={`Download a ${rate}x slowed version`}
        >
          {generatingRate === rate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3 w-3" />}
          {rate}x
        </button>
      ))
    : null;

  const loopButton = (
    <button
      type="button"
      onClick={() => setGlobalLooping(!audio.looping)}
      className={`${ctrl} w-9 ${audio.looping ? "!bg-[rgb(var(--tint)/0.14)] !text-tint" : ""}`}
      title={audio.looping ? "Loop is on" : "Loop is off"}
      aria-pressed={audio.looping}
      aria-label="Loop"
    >
      <Repeat className="h-4 w-4" />
    </button>
  );

  const volume = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleGlobalMute}
        className={`${ctrl} w-9`}
        aria-label={audio.muted ? "Unmute audio" : "Mute audio"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={audio.muted ? 0 : audio.volume}
        onChange={(e) => setGlobalVolume(parseFloat(e.target.value))}
        className="audio-slider audio-slider-volume bare w-20"
        style={{ "--pct": `${(audio.muted ? 0 : audio.volume) * 100}%` }}
        aria-label="Audio volume"
      />
    </div>
  );

  return (
    <AnimatePresence>
      {audio.src ? (
        <motion.div
          key="audio-dock"
          className="pointer-events-none fixed inset-x-3 bottom-3 z-50 md:bottom-5"
          initial={reduce ? false : "hidden"}
          animate="shown"
          exit="hidden"
          variants={DOCK_VARIANTS}
        >
          <div ref={pulseScope} className="mx-auto max-w-[920px]">
          <LiquidGlass
            as={motion.div}
            className="pointer-events-auto rounded-[30px] lg-strong"
            edge={26}
            strength={44}
            variants={ISLAND_VARIANTS}
          >
            {!reduce && (
              <motion.div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" variants={SEED_VARIANTS} aria-hidden="true">
                <span className="flex items-center gap-2.5">
                  <span className="h-8 w-8 overflow-hidden rounded-full bg-[var(--fill-2)]">
                    {audio.thumbnail ? <img src={audio.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="dock-seed-eq"><i /><i /><i /><i /><i /></span>
                </span>
              </motion.div>
            )}
            <motion.div variants={CONTENT_VARIANTS}>
            <div className="flex items-center gap-3 px-3 pb-2.5 pt-3 md:gap-4 md:px-4">
              <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-[14px] bg-[var(--fill-2)] shadow-[0_4px_14px_rgb(0_0_0/0.18)] sm:block">
                {audio.thumbnail ? (
                  <motion.img
                    key={audio.thumbnail}
                    src={audio.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                    initial={{ opacity: 0, scale: 1.15 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-3">
                    <Music2 className="h-5 w-5" />
                  </div>
                )}
                {audio.playing && (
                  <div className="asset-card-eq !bottom-1 !right-1 !h-2.5 !gap-[2px] !px-1 !py-1" aria-hidden="true">
                    <i className="!w-[2px]" /><i className="!w-[2px]" /><i className="!w-[2px]" /><i className="!w-[2px]" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={audio.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: EASE_OUT }}
                  >
                    <p className="truncate font-display text-[15px] font-semibold tracking-[-0.015em] text-ink">
                      {audio.title || "Audio preview"}
                    </p>
                    <p className="truncate text-[12.5px] text-ink-3">
                      {audio.loading ? "Loading audio..." : audio.subtitle || "Playing from EffectsAcademy"}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="hidden items-center gap-0.5 md:flex">
                <button type="button" onClick={downloadCurrent} className={`${ctrl} w-9`} title="Download audio" aria-label="Download audio">
                  <Download className="h-4 w-4" />
                </button>
                {slowedButtons}
                {loopButton}
                <span className="mx-1 h-5 w-px bg-[var(--line-strong)]" aria-hidden="true" />
                {volume}
              </div>

              <motion.button
                type="button"
                onClick={toggleGlobalAudio}
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-canvas shadow-[0_6px_20px_rgb(0_0_0/0.25)]"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9 }}
                transition={SPRING}
                aria-label={audio.playing ? "Pause audio" : "Play audio"}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={audio.playing ? "pause" : "play"}
                    className="flex"
                    initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.4, rotate: 90 }}
                    transition={SPRING}
                  >
                    {audio.playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>

            <div className="flex items-center gap-3 px-4 pb-3 md:px-5">
              <span className="w-9 text-right font-mono text-[11px] tabular-nums text-ink-3">{fmt(audio.progress)}</span>
              <input
                type="range"
                min={0}
                max={audio.duration || 0}
                step={0.01}
                value={audio.progress}
                onChange={(e) => seekGlobalAudio(parseFloat(e.target.value))}
                onInput={(e) => seekGlobalAudio(parseFloat(e.target.value))}
                disabled={!audio.duration}
                className="audio-slider audio-slider-progress bare min-w-0 flex-1"
                style={{ "--pct": `${pct}%` }}
                aria-label="Audio progress"
              />
              <span className="w-9 font-mono text-[11px] tabular-nums text-ink-3">{fmt(audio.duration)}</span>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2 md:hidden">
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={downloadCurrent} className={`${ctrl} px-3 text-[13px]`} aria-label="Download audio">
                  <Download className="h-4 w-4" /> Download
                </button>
                {slowedButtons}
              </div>
              <div className="flex items-center gap-0.5">
                {loopButton}
                {volume}
              </div>
            </div>
            </motion.div>
          </LiquidGlass>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
