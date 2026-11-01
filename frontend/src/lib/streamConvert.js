import {
  ALL_FORMATS,
  BlobSource,
  Conversion,
  ConversionCanceledError,
  Input,
  MkvOutputFormat,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
  canEncodeAudio,
} from "mediabunny";
import { formatBytes } from "@/lib/converter";

/*
 * Streaming conversions for files too big for the in-browser ffmpeg engine.
 *
 * ffmpeg.wasm has to build its whole output in memory (about 1.75 GB at most).
 * When the video can go into the new container as-is (e.g. an HEVC MKV into
 * MP4), this path uses Mediabunny instead: it reads the input in pieces and
 * writes the result straight to disk, so size is limited only by free space.
 * The video is copied untouched; only the audio is converted when needed
 * (surround mixed down to stereo, or a codec the container can't hold).
 *
 * Two places to write to:
 * - "picker": the file the user chooses in the browser's Save dialog (File
 *   System Access API: Chrome, Edge and other Chromium browsers on a computer).
 * - "device": a file in the site's private storage (Origin Private File
 *   System), which is then downloaded or shared. Covers phones (Android Chrome,
 *   iOS Safari 26+) and Safari or Firefox on a computer.
 */

// ffmpeg's codec names (from the probe) → Mediabunny's.
const VIDEO_CODEC = { h264: "avc", hevc: "hevc", av1: "av1", prores: "prores", vp9: "vp9", vp8: "vp8" };
// Video codecs each container takes without re-encoding (matches COPYABLE in converter.js).
const COPYABLE_VIDEO = { mp4: ["avc", "hevc", "av1"], mov: ["avc", "hevc", "prores"], mkv: "*" };
const OUTPUT_FORMAT = {
  // fastStart: false puts the index at the end, so nothing has to be held in memory.
  mp4: () => new Mp4OutputFormat({ fastStart: false }),
  mov: () => new MovOutputFormat({ fastStart: false }),
  mkv: () => new MkvOutputFormat(),
};
const MIME = { mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska" };
const DEVICE_DIR = "converter";

let active = null;

/** Where this browser can stream a conversion to: "picker", "device" or null (neither). */
export function streamingMode() {
  if (typeof window === "undefined" || typeof window.AudioDecoder !== "function") return null;
  if (typeof window.showSaveFilePicker === "function") return "picker";
  if (typeof navigator.storage?.getDirectory === "function" && typeof window.FileSystemFileHandle?.prototype?.createWritable === "function") {
    return "device";
  }
  return null;
}

/** Whether this file's video can be copied as-is into `formatId` by the streaming path. */
export function canStream(info, formatId) {
  const list = COPYABLE_VIDEO[formatId];
  const codec = VIDEO_CODEC[info?.video?.codec];
  if (!list || !codec) return false;
  return list === "*" || list.includes(codec);
}

/**
 * Opens the Save dialog. Call it directly from the click handler: browsers only
 * allow the dialog during a user gesture. Resolves to null if the user cancels.
 */
export async function pickSaveTarget(name, formatId) {
  try {
    return await window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: `${formatId.toUpperCase()} video`, accept: { [MIME[formatId]]: [`.${formatId}`] } }],
    });
  } catch (error) {
    if (error?.name === "AbortError") return null;
    throw error;
  }
}

const deviceDir = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(DEVICE_DIR, { create: true });

/**
 * Creates a file in the site's private storage to convert `file` into, once
 * the browser confirms there's room for it.
 */
export async function createDeviceTarget(file, name) {
  const { quota = 0, usage = 0 } = (await navigator.storage.estimate?.().catch(() => null)) || {};
  const needed = file.size * 1.05;
  if (quota && quota - usage < needed) {
    throw new Error(`Not enough free storage on this device. Converting this file needs about ${formatBytes(needed)} free.`);
  }
  return (await deviceDir()).getFileHandle(`${Date.now()}-${name}`, { create: true });
}

export async function removeDeviceFile(name) {
  try {
    await (await deviceDir()).removeEntry(name);
  } catch {
    // Already gone, or still open in another tab.
  }
}

/** Deletes results left over from earlier visits. */
export async function clearDeviceFiles() {
  try {
    await (await navigator.storage.getDirectory()).removeEntry(DEVICE_DIR, { recursive: true });
  } catch {
    // Nothing stored, or a conversion is running in another tab.
  }
}

/**
 * Converts `file` into the file behind `handle`. Resolves to
 * { name, size, lossless, streamed: true, file } once the file is complete on
 * disk; `file` is the result, read back from disk (not held in memory).
 */
export async function streamConvert(file, formatId, handle, { stereo = true, name = handle.name, onProgress } = {}) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const audioTrack = await input.getPrimaryAudioTrack();
  const audioCodec = audioTrack?.codec;

  // Codecs WebCodecs can't handle natively are loaded only when a file needs them.
  if (audioCodec === "ac3" || audioCodec === "eac3") (await import("@mediabunny/ac3")).registerAc3Decoder();
  if (audioCodec === "dts") (await import("@mediabunny/dts")).registerDtsDecoder();
  // AAC at the best bitrate this browser's encoder accepts (Windows tops out at
  // 192 kbps, still transparent for stereo); without a native encoder, the
  // bundled one does 320 kbps.
  let aacBitrate = 0;
  for (const bitrate of [320e3, 256e3, 192e3]) {
    const quality = new Quality({ bitrate });
    if (audioTrack && (await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: audioTrack.sampleRate, quality }))) {
      aacBitrate = bitrate;
      break;
    }
  }
  if (audioTrack && !aacBitrate) {
    (await import("@mediabunny/aac-encoder")).registerAacEncoder();
    aacBitrate = 320e3;
  }

  const downmix = stereo && (audioTrack?.numberOfChannels || 0) > 2;
  const writable = await handle.createWritable();
  const output = new Output({ format: OUTPUT_FORMAT[formatId](), target: new StreamTarget(writable, { chunked: true }) });

  let conversion = null;
  try {
    conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      audio: downmix ? { numberOfChannels: 2, codec: "aac", quality: new Quality({ bitrate: aacBitrate }) } : undefined,
    });
    const lostAudio = audioTrack && conversion.discardedTracks.some(({ track }) => track.type === "audio");
    if (!conversion.isValid || lostAudio) {
      throw new Error(
        lostAudio
          ? `This browser can't convert the file's ${String(audioCodec || "audio").toUpperCase()} audio. Try MKV, which keeps it as-is.`
          : "This file can't be saved in that format."
      );
    }

    conversion.onProgress = (progress) => onProgress?.(Math.min(0.99, progress));
    active = conversion;
    await conversion.execute(); // finalizes the output, which closes the file
    onProgress?.(1);
    const saved = await handle.getFile();
    return {
      name,
      size: saved.size,
      lossless: !downmix,
      streamed: true,
      kind: "video",
      file: new File([saved], name, { type: MIME[formatId] }),
    };
  } catch (error) {
    // Leave no half-written file behind.
    await writable.abort().catch(() => {});
    await handle.remove?.().catch(() => {});
    if (error instanceof ConversionCanceledError) throw new Error("cancelled");
    if (error?.name === "QuotaExceededError") throw new Error("Your device ran out of storage space while converting.");
    throw error;
  } finally {
    active = null;
    input.dispose?.();
  }
}

export async function cancelStream() {
  await active?.cancel();
}
