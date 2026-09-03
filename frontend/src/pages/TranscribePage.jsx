import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Captions, Check, Clipboard, Download, FileAudio, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ACCEPTED_AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"];

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

export default function TranscribePage() {
  const { config } = useAuth();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState(null);

  const configured = config ? Boolean(config.audio_transcription_configured) : true;
  const maxMb = config?.audio_transcription_max_mb || 25;
  const canTranscribe = file && !transcribing && configured;
  const baseFilename = fileStem(result?.filename || file?.name);

  const segmentSummary = useMemo(() => {
    const count = result?.segments?.length || 0;
    if (!count) return "Text only";
    return `${count} timed caption ${count === 1 ? "segment" : "segments"}`;
  }, [result]);

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
    if (nextFile.size > maxMb * 1024 * 1024) {
      toast.error(`Audio must be under ${maxMb}MB.`);
      return;
    }
    setResult(null);
    setFile(nextFile);
  };

  const transcribe = async (event) => {
    event.preventDefault();
    if (!canTranscribe) return;
    setTranscribing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("audio", file);
      const { data } = await api.post("/transcribe", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      toast.success("Transcription finished.");
    } catch (err) {
      const message = err?.response?.data?.detail || "Unable to transcribe this audio.";
      toast.error(message);
    } finally {
      setTranscribing(false);
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

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 min-w-56">
          <div className="flex items-center gap-2 text-sm text-white">
            <Sparkles className="w-4 h-4 text-neon" />
            Free tool
          </div>
          <p className="text-xs text-zinc-500 mt-1">MP3 or WAV · up to {maxMb}MB</p>
        </div>
      </div>

      {!configured && (
        <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>
            Audio transcription is not configured on the backend yet. Add <code>OPENAI_API_KEY</code> to the Render API service, then redeploy the backend.
          </p>
        </div>
      )}

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
                <p className="text-sm text-zinc-500 mt-2">MP3 or WAV under {maxMb}MB</p>
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
              {transcribing ? `Transcribing... ${elapsedSeconds}s` : "Transcribe audio"}
            </span>
          </button>
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
              <p className="relative font-display text-xl font-black text-white">Listening through the file</p>
              <p className="relative text-sm text-zinc-500 mt-2">
                Building timestamped captions. Running for {elapsedSeconds}s.
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
