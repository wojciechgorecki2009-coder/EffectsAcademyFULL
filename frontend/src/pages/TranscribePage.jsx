import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Captions, Check, Clipboard, Cpu, Download, FileAudio, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

const ACCEPTED_AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"];
const MAX_AUDIO_MB = 25;
const TARGET_SAMPLE_RATE = 16000;
const TRANSCRIPTION_MODEL = "Xenova/whisper-tiny";

let transcriberPromise = null;

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function fileStem(name = "effects-academy-transcript") {
  return name.replace(/\.[^/.]+$/, "").replace(/[^\w\s.-]/g, "_").trim() || "effects-academy-transcript";
}

function formatCaptionTimestamp(seconds = 0, separator = ",") {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}${separator}${String(milliseconds).padStart(3, "0")}`;
}

function buildSrt(segments = []) {
  return segments
    .map((segment, index) => [
      String(index + 1),
      `${formatCaptionTimestamp(segment.start)} --> ${formatCaptionTimestamp(segment.end)}`,
      segment.text,
    ].join("\n"))
    .join("\n\n") + (segments.length ? "\n" : "");
}

function buildVtt(segments = []) {
  return "WEBVTT\n\n" + segments
    .map((segment) => [
      `${formatCaptionTimestamp(segment.start, ".")} --> ${formatCaptionTimestamp(segment.end, ".")}`,
      segment.text,
    ].join("\n"))
    .join("\n\n") + (segments.length ? "\n" : "");
}

function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content || ""], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resampleAudio(audioData, sourceRate, targetRate) {
  if (sourceRate === targetRate) return audioData;
  const ratio = sourceRate / targetRate;
  const outputLength = Math.round(audioData.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio;
    const low = Math.floor(sourceIndex);
    const high = Math.min(low + 1, audioData.length - 1);
    const weight = sourceIndex - low;
    output[i] = audioData[low] * (1 - weight) + audioData[high] * weight;
  }
  return output;
}

async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("Your browser does not support local audio decoding.");
  }
  const audioContext = new AudioContextCtor();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channelCount; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      mono[i] += data[i] / channelCount;
    }
  }
  await audioContext.close?.();
  return resampleAudio(mono, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
}

async function loadBrowserTranscriber(onProgress) {
  if (!transcriberPromise) {
    transcriberPromise = import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2").then(async ({ env, pipeline }) => {
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      return pipeline("automatic-speech-recognition", TRANSCRIPTION_MODEL, {
        progress_callback: onProgress,
      });
    });
  }
  return transcriberPromise;
}

function normalizeSegments(transcript) {
  const chunks = Array.isArray(transcript?.chunks) ? transcript.chunks : [];
  const segments = chunks
    .map((chunk, index) => {
      const timestamp = chunk.timestamp || chunk.timestamps || [];
      const start = Number(timestamp[0] ?? index * 4);
      const fallbackEnd = start + Math.max(2, Math.min(6, String(chunk.text || "").split(/\s+/).length * 0.45));
      const end = Number(timestamp[1] ?? fallbackEnd);
      return {
        start: Math.max(0, start),
        end: Math.max(start + 0.01, end),
        text: String(chunk.text || "").trim(),
      };
    })
    .filter((segment) => segment.text);

  if (segments.length) return segments;

  const text = String(transcript?.text || "").trim();
  if (!text) return [];
  return text
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\n+/)
    .filter(Boolean)
    .map((sentence, index) => ({
      start: index * 4,
      end: (index + 1) * 4,
      text: sentence.trim(),
    }));
}

export default function TranscribePage() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [modelStatus, setModelStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const mountedRef = useRef(true);

  const canTranscribe = file && !transcribing;
  const baseFilename = fileStem(result?.filename || file?.name);

  const segmentSummary = useMemo(() => {
    const count = result?.segments?.length || 0;
    if (!count) return "Text only";
    return `${count} timed caption ${count === 1 ? "segment" : "segments"}`;
  }, [result]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!transcribing) return;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [transcribing]);

  const pickFile = (nextFile) => {
    if (!nextFile) return;
    const extensionOk = /\.(mp3|wav)$/i.test(nextFile.name || "");
    if (!ACCEPTED_AUDIO_TYPES.includes(nextFile.type) && !extensionOk) {
      toast.error("Upload an MP3 or WAV audio file.");
      return;
    }
    if (nextFile.size > MAX_AUDIO_MB * 1024 * 1024) {
      toast.error(`Audio must be under ${MAX_AUDIO_MB}MB.`);
      return;
    }
    setResult(null);
    setProgress(0);
    setModelStatus("");
    setFile(nextFile);
  };

  const transcribe = async (event) => {
    event.preventDefault();
    if (!canTranscribe) return;
    setTranscribing(true);
    setResult(null);
    setProgress(0);
    setModelStatus("Preparing audio locally...");

    try {
      const audioData = await decodeAudioFile(file);
      if (!mountedRef.current) return;
      setModelStatus("Loading browser transcription model...");
      const transcriber = await loadBrowserTranscriber((event) => {
        if (!mountedRef.current) return;
        if (event?.status) setModelStatus(event.status.replace(/_/g, " "));
        if (typeof event?.progress === "number") setProgress(Math.round(event.progress));
      });
      if (!mountedRef.current) return;
      setModelStatus("Transcribing on your device...");
      const transcript = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });
      const segments = normalizeSegments(transcript);
      const text = String(transcript?.text || segments.map((segment) => segment.text).join(" ")).trim();
      if (!text) {
        throw new Error("No speech was detected in this audio file.");
      }
      setResult({
        text,
        segments,
        srt: buildSrt(segments),
        vtt: buildVtt(segments),
        filename: file.name,
      });
      setModelStatus("Finished locally");
      toast.success("Transcription finished on your device.");
    } catch (err) {
      toast.error(err?.message || "Unable to transcribe this audio in the browser.");
      setModelStatus("Transcription failed");
    } finally {
      if (mountedRef.current) setTranscribing(false);
    }
  };

  const copyTranscript = async () => {
    if (!result?.text) return;
    await navigator.clipboard.writeText(result.text);
    toast.success("Transcript copied.");
  };

  return (
    <section className="max-w-[1200px] mx-auto px-6 md:px-12 pt-28 pb-24 ai-view-fade-up transcribe-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-md border text-neon bg-neon/10 border-neon/20">
            <Captions className="w-3.5 h-3.5" /> Transcribe
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-black tracking-tighter mt-3">
            Audio to captions.
          </h1>
          <p className="text-zinc-400 max-w-2xl mt-3 text-base md:text-lg">
            Drop in an MP3 or WAV and get plain text plus caption files with timestamps for Premiere, web players, and editing workflows.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 min-w-64">
          <div className="flex items-center gap-2 text-sm text-white">
            <Cpu className="w-4 h-4 text-neon" />
            Free browser-side tool
          </div>
          <p className="text-xs text-zinc-500 mt-1">Your audio stays on your device · MP3/WAV up to {MAX_AUDIO_MB}MB</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100 flex gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          This transcribes in your browser, so it does not cost Effects Academy API money. It can be slower or less accurate depending on your device, browser, audio length, background music, and noise.
        </p>
      </div>

      <form onSubmit={transcribe} className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 transcribe-surface">
          <label
            className="group flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 hover:bg-white/[0.035] transition-colors overflow-hidden text-center px-6 transcribe-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            {file ? (
              <div className="w-full max-w-md">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-neon/15 text-neon border border-neon/20">
                  <FileAudio className="w-10 h-10" />
                </div>
                <p className="font-display text-2xl font-black text-white break-words">{file.name}</p>
                <p className="text-sm text-zinc-500 mt-2">{formatBytes(file.size)}</p>
                {previewUrl && (
                  <audio controls src={previewUrl} className="mt-6 w-full audio-preview" />
                )}
                <p className="text-xs text-zinc-600 mt-5">Click to choose a different audio file</p>
              </div>
            ) : (
              <div>
                <UploadCloud className="w-12 h-12 text-neon mx-auto mb-4" />
                <p className="font-display text-2xl font-bold text-white">Drop audio here</p>
                <p className="text-sm text-zinc-500 mt-2">MP3 or WAV under {MAX_AUDIO_MB}MB</p>
              </div>
            )}
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,.mp3,.wav"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </label>

          <button
            type="submit"
            disabled={!canTranscribe}
            className="mt-5 relative w-full overflow-hidden rounded-2xl bg-neon text-black py-4 font-display font-black text-lg btn-press disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {transcribing && (
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse" />
            )}
            <span className="relative inline-flex items-center justify-center gap-2">
              {transcribing && <Loader2 className="w-5 h-5 animate-spin" />}
              {transcribing ? `Transcribing locally... ${elapsedSeconds}s` : "Transcribe on my device"}
            </span>
          </button>

          {(transcribing || modelStatus) && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                <span className="capitalize">{modelStatus || "Preparing..."}</span>
                {progress > 0 && progress < 100 ? <span>{progress}%</span> : null}
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-neon transition-all duration-300"
                  style={{ width: `${transcribing ? Math.max(progress, 12) : progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 transcribe-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                <Captions className="w-5 h-5 text-neon" /> Transcript result
              </h2>
              <p className="text-sm text-zinc-500 mt-1">{result ? segmentSummary : "Your text and timed captions will appear here."}</p>
            </div>
            <button
              type="button"
              onClick={copyTranscript}
              disabled={!result?.text}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white btn-press disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {result?.text ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
              Copy text
            </button>
          </div>

          {transcribing ? (
            <div className="min-h-[420px] rounded-2xl border border-dashed border-neon/20 bg-black/20 flex flex-col items-center justify-center text-center px-6 overflow-hidden relative">
              <div className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent animate-pulse" />
              <Loader2 className="relative w-10 h-10 text-neon animate-spin mb-4" />
              <p className="relative font-display text-xl font-black text-white">Working locally in your browser</p>
              <p className="relative text-sm text-zinc-500 mt-2">
                {modelStatus || "Building timestamped captions."} Running for {elapsedSeconds}s.
              </p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">Plain text</p>
                <textarea
                  value={result.text}
                  readOnly
                  className="w-full min-h-[220px] rounded-2xl bg-black/30 border border-white/10 p-4 text-white leading-7 outline-none resize-y"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => downloadTextFile(result.srt, `${baseFilename}.srt`, "application/x-subrip;charset=utf-8")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neon text-black px-4 py-4 font-display font-black btn-press"
                >
                  <Download className="w-4 h-4" /> Download SRT
                </button>
                <button
                  type="button"
                  onClick={() => downloadTextFile(result.vtt, `${baseFilename}.vtt`, "text/vtt;charset=utf-8")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 font-display font-black text-white btn-press"
                >
                  <Download className="w-4 h-4" /> Download VTT
                </button>
                <button
                  type="button"
                  onClick={() => downloadTextFile(result.text, `${baseFilename}.txt`, "text/plain;charset=utf-8")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 font-display font-black text-white btn-press"
                >
                  <Download className="w-4 h-4" /> Download TXT
                </button>
              </div>
            </div>
          ) : (
            <div className="min-h-[420px] rounded-2xl border border-dashed border-white/10 bg-black/20 flex flex-col items-center justify-center text-center px-6">
              <Captions className="w-12 h-12 text-zinc-600 mb-4" />
              <p className="font-display text-2xl font-black text-white">Ready when your audio is</p>
              <p className="text-sm text-zinc-500 max-w-md mt-2">
                Upload your file, press transcribe, then download captions for Premiere or copy the transcript.
              </p>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
