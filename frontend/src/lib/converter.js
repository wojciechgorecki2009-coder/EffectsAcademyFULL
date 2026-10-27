import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { LITE } from "@/lib/device";

/*
 * Browser-side video conversion with ffmpeg.wasm.
 *
 * Everything runs in a Web Worker on the visitor's device: files are never
 * uploaded and the Effects Academy servers do no work. The engine (~10 MB
 * download, ~32 MB unpacked) comes from a public CDN, not our host, and is
 * then browser-cached.
 *
 * Quality policy: copy streams untouched whenever the target container can
 * hold them (zero loss, near-instant); otherwise re-encode only the streams
 * that need it, at visually lossless settings.
 *
 * Surround audio (5.1, 7.1, or any track with more than two channels) is
 * mixed down to stereo by default; mono and stereo tracks are left as-is.
 */

const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
export const ENGINE_SIZE_MB = 10; // compressed transfer size; ~32 MB unpacked
const GB = 1024 * 1024 * 1024;
export const FREE_MAX_BYTES = 2 * GB;
export const PREMIUM_MAX_BYTES = 10 * GB;
// Inputs are read straight from disk (WORKERFS), so they can be huge. The
// result, however, is built inside the engine's 2 GiB WebAssembly memory, so
// outputs must stay comfortably below that. Phones get a much lower ceiling:
// the result briefly exists three times over (engine memory, the copy read
// out of it, the download blob) and mobile browsers kill tabs far sooner.
export const OUTPUT_LIMIT_BYTES = LITE ? 400 * 1024 * 1024 : Math.floor(1.75 * GB);
const OUTPUT_LIMIT_LABEL = LITE ? "400 MB" : "1.75 GB";
const LARGE_ENCODE_BYTES = 1 * GB;

export const FORMATS = [
  { id: "mp4", label: "MP4", ext: "mp4", mime: "video/mp4", kind: "video", detail: "H.264 · plays everywhere" },
  { id: "mov", label: "MOV", ext: "mov", mime: "video/quicktime", kind: "video", detail: "QuickTime · Premiere & AE" },
  { id: "webm", label: "WebM", ext: "webm", mime: "video/webm", kind: "video", detail: "VP8 · made for the web" },
  { id: "mkv", label: "MKV", ext: "mkv", mime: "video/x-matroska", kind: "video", detail: "Matroska · keeps everything" },
  { id: "avi", label: "AVI", ext: "avi", mime: "video/x-msvideo", kind: "video", detail: "Legacy players" },
  { id: "gif", label: "GIF", ext: "gif", mime: "image/gif", kind: "image", detail: "Animated · optimized palette" },
  { id: "mp3", label: "MP3", ext: "mp3", mime: "audio/mpeg", kind: "audio", detail: "Audio only · 320 kbps" },
  { id: "wav", label: "WAV", ext: "wav", mime: "audio/wav", kind: "audio", detail: "Audio only · uncompressed" },
  { id: "m4a", label: "M4A", ext: "m4a", mime: "audio/mp4", kind: "audio", detail: "Audio only · AAC" },
];

// Codecs each container can hold without re-encoding.
const COPYABLE = {
  mp4: { video: ["h264", "hevc", "av1"], audio: ["aac", "mp3", "ac3", "eac3", "alac", "opus"] },
  mov: { video: ["h264", "hevc", "prores", "mpeg4", "mjpeg"], audio: ["aac", "mp3", "alac", "ac3", "pcm_s16le", "pcm_s24le", "pcm_s16be", "pcm_s24be", "pcm_f32le"] },
  mkv: { video: "*", audio: "*" },
  webm: { video: ["vp8", "vp9", "av1"], audio: ["opus", "vorbis"] },
  avi: { video: ["mpeg4", "mjpeg", "h264"], audio: ["mp3", "ac3", "pcm_s16le"] },
  m4a: { video: [], audio: ["aac", "alac"] },
};

const VIDEO_ENCODE = {
  mp4: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p"],
  mov: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p"],
  mkv: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p"],
  // VP8: ffmpeg.wasm's VP9 encoder crashes in single-threaded WebAssembly.
  webm: ["-c:v", "libvpx", "-crf", "6", "-b:v", "25M", "-qmin", "0", "-qmax", "24", "-deadline", "realtime", "-cpu-used", "4"],
  avi: ["-c:v", "mpeg4", "-q:v", "2", "-vtag", "xvid"],
};

const AUDIO_ENCODE = {
  mp4: ["-c:a", "aac", "-b:a", "320k"],
  mov: ["-c:a", "aac", "-b:a", "320k"],
  mkv: ["-c:a", "aac", "-b:a", "320k"],
  webm: ["-c:a", "libopus", "-b:a", "192k"],
  avi: ["-c:a", "libmp3lame", "-b:a", "320k"],
  m4a: ["-c:a", "aac", "-b:a", "320k"],
};

let enginePromise = null;
let coreUrls = null;
let logListener = null;

// The CDN serves the core Brotli-compressed, so Content-Length is the
// compressed size. Track progress against the known unpacked size instead
// (@ffmpeg/util's helper treats that mismatch as a failed download).
const CORE_WASM_BYTES = 32_232_419;

async function fetchBlobURL(url, mimeType, onProgress) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Could not download ${url}`);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.({ received, total: Math.max(received, CORE_WASM_BYTES) });
  }
  onProgress?.({ received, total: received });
  return URL.createObjectURL(new Blob(chunks, { type: mimeType }));
}

async function getCoreUrls(onDownload) {
  if (coreUrls) return coreUrls;
  const [coreURL, wasmURL] = await Promise.all([
    fetchBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    fetchBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm", onDownload),
  ]);
  coreUrls = { coreURL, wasmURL };
  return coreUrls;
}

/** Loads (once) and returns the shared ffmpeg instance. */
export function loadEngine(onDownload) {
  if (!enginePromise) {
    enginePromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => logListener?.(message));
      await ffmpeg.load(await getCoreUrls(onDownload));
      return ffmpeg;
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

/** Stops any running job. The engine reloads (from the browser cache) next time. */
export async function cancelEngine() {
  if (!enginePromise) return;
  const pending = enginePromise;
  enginePromise = null;
  try {
    (await pending).terminate();
  } catch {}
}

async function withLogs(ffmpeg, args, onLine) {
  logListener = onLine;
  try {
    return await ffmpeg.exec(args);
  } finally {
    logListener = null;
  }
}

/* Input staging: mount the file read-only (no copy into wasm memory) when the
   engine supports it, otherwise fall back to writing it into the virtual FS. */
async function stageInput(ffmpeg, file) {
  const dir = "/input";
  try {
    await ffmpeg.createDir(dir);
  } catch {}
  try {
    await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, dir);
    return { path: `${dir}/${file.name}`, cleanup: () => ffmpeg.unmount(dir).catch(() => {}) };
  } catch {
    // Copying into the 2 GiB engine memory only works for modest files.
    if (file.size > LARGE_ENCODE_BYTES) {
      throw new Error("This browser can't stream large files into the converter. Try the latest Chrome, Edge or Firefox.");
    }
    const name = `input.${extOf(file.name) || "bin"}`;
    await ffmpeg.writeFile(name, await fetchFile(file));
    return { path: name, cleanup: () => ffmpeg.deleteFile(name).catch(() => {}) };
  }
}

export function extOf(name = "") {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

// Channel counts for the layout names ffmpeg prints ("stereo", "5.1(side)", "6 channels"...).
const NAMED_LAYOUTS = { mono: 1, stereo: 2, downmix: 2, quad: 4, hexagonal: 6, octagonal: 8, hexadecagonal: 16 };

function channelsFromLayout(layout = "") {
  const name = layout.trim().toLowerCase();
  const count = /^(\d+) channels?/.exec(name);
  if (count) return Number(count[1]);
  const dotted = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(name);
  if (dotted) return Number(dotted[1]) + Number(dotted[2]) + Number(dotted[3] || 0);
  return NAMED_LAYOUTS[name.replace(/\(.*\)$/, "")] || 0;
}

/** "5.1 surround", "7.1 surround" or "6-channel", for notes and the file details. */
export function describeChannels(audio) {
  if (!audio?.channels) return "";
  if (audio.channels === 1) return "mono";
  if (audio.channels === 2) return "stereo";
  const dotted = /^\d+\.\d+/.exec(audio.layout || "");
  return dotted ? `${dotted[0]} surround` : `${audio.channels}-channel`;
}

/** Surround tracks become stereo unless the user chose to keep them. */
export const needsDownmix = (info, options = {}) => (info?.audio?.channels || 0) > 2 && options.stereo !== false;

const AUDIO_LABEL = { mp4: "AAC 320 kbps", mov: "AAC 320 kbps", mkv: "AAC 320 kbps", webm: "Opus 192 kbps", avi: "MP3 320 kbps" };

function parseProbe(lines) {
  const text = lines.join("\n");
  const info = { duration: 0, video: null, audio: null };
  const d = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(text);
  if (d) info.duration = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
  const v = /Stream #\d+:\d+[^:]*: Video: ([a-z0-9_]+)([^\n]*)/i.exec(text);
  if (v) {
    const size = /(\d{2,5})x(\d{2,5})/.exec(v[2]);
    const fps = /([\d.]+) fps/.exec(v[2]);
    info.video = {
      codec: v[1].toLowerCase(),
      width: size ? Number(size[1]) : 0,
      height: size ? Number(size[2]) : 0,
      fps: fps ? Number(fps[1]) : 0,
    };
  }
  const a = /Stream #\d+:\d+[^:]*: Audio: ([a-z0-9_]+)([^\n]*)/i.exec(text);
  if (a) {
    // e.g. "aac (LC), 48000 Hz, 5.1, fltp": the layout follows the sample rate.
    const layout = /\d+ Hz, ([^,]+)/.exec(a[2])?.[1]?.trim() || "";
    info.audio = { codec: a[1].toLowerCase(), layout, channels: channelsFromLayout(layout) };
  }
  return info;
}

const canCopy = (format, kind, codec) => {
  const list = COPYABLE[format]?.[kind];
  if (!codec || !list) return false;
  return list === "*" || list.includes(codec);
};

/** Describes what conversion to `format` will do with this input, for the UI. */
export function planConversion(info, formatId, options = {}, fileSize = 0) {
  const format = FORMATS.find((f) => f.id === formatId);
  if (!format || !info) return null;
  const downmix = needsDownmix(info, options);
  const downmixNote = downmix ? ` The ${describeChannels(info.audio)} audio is mixed down to stereo.` : "";
  if (format.kind === "audio") {
    if (!info.audio) return { error: "This file has no audio track to extract." };
    if (formatId === "wav") return { lossless: true, note: `Uncompressed PCM audio, no quality loss.${downmixNote}` };
    const copy = !downmix && canCopy(formatId, "audio", info.audio.codec);
    return copy
      ? { lossless: true, note: "Audio stream copied as-is. No quality loss." }
      : { lossless: false, note: `${formatId === "mp3" ? "Encoded at 320 kbps, the highest MP3 quality." : "Encoded as AAC at 320 kbps."}${downmixNote}` };
  }
  if (!info.video) return { error: "No video stream was found in this file." };
  if (format.kind === "image") {
    return { lossless: false, note: `GIF is limited to 256 colors. Using an optimized palette at ${options.fps || 24} fps.` };
  }
  const videoCopy = canCopy(formatId, "video", info.video.codec);
  const audioCopy = !info.audio || (!downmix && canCopy(formatId, "audio", info.audio.codec));
  if (videoCopy && fileSize > OUTPUT_LIMIT_BYTES) {
    return {
      lossless: false,
      forceEncode: true,
      note: `Too large to copy as-is inside the browser (results must stay under ${OUTPUT_LIMIT_LABEL}), so it will be re-encoded at visually lossless quality. Expect this to take a long time.${downmixNote}`,
    };
  }
  if (videoCopy && audioCopy) return { lossless: true, note: "Streams copied as-is. No re-encode, no quality loss, done in seconds." };
  if (videoCopy && downmix) {
    return { lossless: true, note: `Video copied as-is with no quality loss. The ${describeChannels(info.audio)} audio is mixed down to stereo (${AUDIO_LABEL[formatId]}).` };
  }
  if (videoCopy) return { lossless: true, note: "Video copied as-is with no quality loss. Only the audio is converted (320 kbps)." };
  return {
    lossless: false,
    note: (fileSize > LARGE_ENCODE_BYTES
      ? "Re-encoded at visually lossless quality. A file this large can take a long time to re-encode in the browser."
      : "Re-encoded at visually lossless quality. This can take a while on longer clips.") + downmixNote,
  };
}

function buildArgs({ input, output, format, info, mode, options }) {
  const base = ["-hide_banner", "-y", "-i", input];
  if (format.id === "gif") {
    const fps = options.fps || 24;
    const scale = options.width ? `,scale=${options.width}:-2:flags=lanczos` : "";
    return [
      ...base,
      "-filter_complex",
      `[0:v:0]fps=${fps}${scale},split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle`,
      "-loop", "0",
      output,
    ];
  }
  // Standard stereo downmix: centre and surrounds folded into left/right.
  const downmix = needsDownmix(info, options);
  const stereo = downmix ? ["-ac", "2"] : [];
  if (format.kind === "audio") {
    if (format.id === "wav") return [...base, "-vn", "-map", "0:a:0", "-c:a", "pcm_s16le", ...stereo, output];
    if (format.id === "mp3") return [...base, "-vn", "-map", "0:a:0", "-c:a", "libmp3lame", "-b:a", "320k", ...stereo, output];
    const copy = mode === "copy" && !downmix && canCopy("m4a", "audio", info.audio?.codec);
    return [...base, "-vn", "-map", "0:a:0", ...(copy ? ["-c:a", "copy"] : [...AUDIO_ENCODE.m4a, ...stereo]), output];
  }

  const videoCopy = mode === "copy" && canCopy(format.id, "video", info.video?.codec);
  const audioCopy = mode === "copy" && !downmix && canCopy(format.id, "audio", info.audio?.codec);
  const args = [...base, "-map", "0:v:0", "-map", "0:a:0?"];
  args.push(...(videoCopy ? ["-c:v", "copy"] : VIDEO_ENCODE[format.id]));
  if (info.audio) args.push(...(audioCopy ? ["-c:a", "copy"] : [...AUDIO_ENCODE[format.id], ...stereo]));
  if (videoCopy && info.video?.codec === "hevc" && (format.id === "mp4" || format.id === "mov")) args.push("-tag:v", "hvc1");
  if (format.id === "mp4" || format.id === "mov") args.push("-movflags", "+faststart");
  args.push(output);
  return args;
}

/**
 * Converts `file` to `formatId`. Calls onProgress(0..1) and onStage(label).
 * Returns { blob, name, mime, lossless }.
 */
export async function convertFile(file, formatId, { options = {}, onProgress, onStage, onDownload } = {}) {
  const format = FORMATS.find((f) => f.id === formatId);
  onStage?.("engine");
  const ffmpeg = await loadEngine(onDownload);
  const staged = await stageInput(ffmpeg, file);
  const output = `output.${format.ext}`;
  let crashed = false;
  let overflow = false;
  try {
    onStage?.("probe");
    const probeLines = [];
    await withLogs(ffmpeg, ["-hide_banner", "-i", staged.path], (line) => probeLines.push(line));
    const info = parseProbe(probeLines);
    const plan = planConversion(info, formatId, options, file.size);
    if (plan?.error) throw new Error(plan.error);

    const run = async (mode) => {
      onStage?.(mode === "copy" && plan?.lossless ? "copy" : "encode");
      onProgress?.(0);
      const args = buildArgs({ input: staged.path, output, format, info, mode, options });
      return withLogs(ffmpeg, args, (line) => {
        // Stop early, with a clear message, if the result outgrows browser memory.
        const size = /size=\s*(\d+)\s*(kB|KiB)/.exec(line);
        if (size && !overflow && Number(size[1]) * 1024 > OUTPUT_LIMIT_BYTES) {
          overflow = true;
          cancelEngine();
        }
        const t = /time=(\d+):(\d+):([\d.]+)/.exec(line);
        if (t && info.duration > 0) {
          const seconds = Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
          onProgress?.(Math.min(0.99, seconds / info.duration));
        }
      });
    };

    let lossless = plan?.lossless ?? false;
    let code = await run(plan?.forceEncode ? "encode" : "copy");
    if (code !== 0 && format.kind !== "image" && formatId !== "wav" && formatId !== "mp3") {
      // Stream copy was refused by the muxer: fall back to a full high-quality encode.
      lossless = false;
      await ffmpeg.deleteFile(output).catch(() => {});
      code = await run("encode");
    }
    if (code !== 0) throw new Error("This file could not be converted to that format.");

    const data = await ffmpeg.readFile(output);
    onProgress?.(1);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "video";
    return {
      blob: new Blob([data], { type: format.mime }),
      name: `${baseName}.${format.ext}`,
      mime: format.mime,
      kind: format.kind,
      lossless,
    };
  } catch (error) {
    if (overflow) {
      throw new Error(`The converted file would be larger than your browser can hold (about ${OUTPUT_LIMIT_LABEL}${LITE ? " on phones and tablets" : ""}). Try GIF, an audio format, or a shorter clip.`);
    }
    // A WebAssembly fault leaves the engine unusable; discard it so the next
    // conversion starts from a fresh instance (cached download, no refetch).
    if (error instanceof WebAssembly.RuntimeError || /RuntimeError|out of bounds|unreachable/i.test(String(error))) {
      crashed = true;
      await cancelEngine();
      throw new Error("The converter ran out of memory on this file. Try a smaller file or a different format.");
    }
    throw error;
  } finally {
    if (!crashed && !overflow) {
      await ffmpeg.deleteFile(output).catch(() => {});
      await staged.cleanup();
    }
  }
}

/** Reads codec/duration info for the UI once the engine is available. */
export async function probeFile(file) {
  const ffmpeg = await loadEngine();
  const staged = await stageInput(ffmpeg, file);
  try {
    const lines = [];
    await withLogs(ffmpeg, ["-hide_banner", "-i", staged.path], (line) => lines.push(line));
    return parseProbe(lines);
  } finally {
    await staged.cleanup();
  }
}

export function formatBytes(bytes = 0) {
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

export function formatDuration(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

