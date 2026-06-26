import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Download, Repeat } from "lucide-react";
import { toast } from "sonner";
import { api, FILE_BASE } from "@/lib/api";

function fmt(t) {
  if (!isFinite(t) || t < 0) return "0:00";
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

function directUrlEndpoint(src) {
  if (!src) return "";
  const path = src.startsWith(FILE_BASE) ? src.slice(FILE_BASE.length) : src;
  const match = path.match(/\/api\/uploads\/([^/?#]+)/);
  if (!match) return "";
  return `/uploads/${encodeURIComponent(decodeURIComponent(match[1]))}/direct`;
}

export default function AudioPlayer({ src, title, onDownload }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [looping, setLooping] = useState(false);
  const [generatingRate, setGeneratingRate] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [playbackSrc, setPlaybackSrc] = useState("");

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
    a.loop = looping;
  }, [volume, muted, looping]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  useEffect(() => {
    setPlaybackSrc("");
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }, [src]);

  const resolvePlaybackSrc = async () => {
    if (playbackSrc) return playbackSrc;
    const endpoint = directUrlEndpoint(src);
    if (!endpoint) {
      setPlaybackSrc(src);
      return src;
    }
    const { data } = await api.get(endpoint);
    const resolved = data?.url || src;
    setPlaybackSrc(resolved);
    return resolved;
  };

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }

    setLoadingAudio(true);
    try {
      const resolved = await resolvePlaybackSrc();
      if (a.src !== resolved) {
        a.src = resolved;
        a.load();
      }
      await a.play();
      setPlaying(true);
    } catch (error) {
      toast.error("Unable to play this audio yet.");
    } finally {
      setLoadingAudio(false);
    }
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a) return;
    const t = parseFloat(e.target.value);
    if (!isFinite(t)) return;
    a.currentTime = t;
    setProgress(t);
  };

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  const downloadSlowed = async (rate) => {
    if (generatingRate) return;
    setGeneratingRate(rate);
    try {
      const resolved = await resolvePlaybackSrc();
      const response = await fetch(resolved);
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
      const safeTitle = (title || "audio").replace(/[<>:"/\\|?*]+/g, "_").trim() || "audio";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${safeTitle} - ${rate}x slowed.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      await onDownload?.(rate);
      toast.success(`${rate}x slowed version downloaded.`);
    } catch (error) {
      toast.error(error?.message || "Unable to create slowed audio.");
    } finally {
      setGeneratingRate(null);
    }
  };

  return (
    <div
      className="mt-2 p-3 bg-black/40 border border-white/5 rounded-lg"
      data-testid="audio-player"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={loadingAudio}
          className="w-9 h-9 rounded-full bg-neon text-white flex items-center justify-center btn-press shrink-0 disabled:opacity-60"
          data-testid="audio-play-toggle"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-[82px]">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={progress}
            onChange={seek}
            onInput={seek}
            disabled={!duration}
            className="audio-slider audio-slider-progress w-full"
            style={{ "--pct": `${pct}%` }}
            data-testid="audio-progress-slider"
          />
          <div className="text-[10px] font-mono text-zinc-500 mt-1 tabular-nums whitespace-nowrap leading-none">
            {loadingAudio ? "Loading..." : `${fmt(progress)} / ${fmt(duration)}`}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLooping((v) => !v)}
            className={`${looping ? "text-neon bg-neon/10 border-neon/30" : "text-zinc-400 hover:text-white border-white/10"} border rounded-md w-8 h-8 flex items-center justify-center btn-press`}
            data-testid="audio-loop-toggle"
            title={looping ? "Loop is on" : "Loop is off"}
            aria-pressed={looping}
          >
            <Repeat className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMuted((v) => !v)}
            className="text-zinc-400 hover:text-white btn-press"
            data-testid="audio-mute-toggle"
          >
            {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (v > 0) setMuted(false);
            }}
            className="audio-slider audio-slider-volume w-16"
            style={{ "--pct": `${(muted ? 0 : volume) * 100}%` }}
            data-testid="audio-volume-slider"
          />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Download slowed</span>
        <div className="flex items-center gap-2">
          {[0.9, 0.8].map((rate) => (
            <button
              key={rate}
              onClick={() => downloadSlowed(rate)}
              disabled={Boolean(generatingRate)}
              className="px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-xs font-mono font-semibold text-zinc-200 flex items-center gap-1.5 btn-press"
              data-testid={`audio-slow-download-${rate}`}
              title={`Download a ${rate}x slowed version`}
            >
              <Download className="w-3 h-3" />
              {generatingRate === rate ? "Processing…" : rate}
            </button>
          ))}
        </div>
      </div>
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
    </div>
  );
}
