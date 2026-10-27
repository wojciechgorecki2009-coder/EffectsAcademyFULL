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

/*
 * Streaming conversions for files too big for the in-browser ffmpeg engine.
 *
 * ffmpeg.wasm has to build its whole output in memory (about 1.75 GB at most).
 * When the video can go into the new container as-is (e.g. an HEVC MKV into
 * MP4), this path uses Mediabunny instead: it reads the input in pieces and
 * writes the result straight into the file the user picked in the browser's
 * Save dialog, so size is limited only by disk space. The video is copied
 * untouched; only the audio is converted when needed (surround mixed down to
 * stereo, or a codec the container can't hold).
 *
 * Needs the File System Access API: Chrome, Edge and other Chromium browsers
 * on a computer.
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

let active = null;

export const supportsStreamingSave = () =>
  typeof window !== "undefined" && typeof window.showSaveFilePicker === "function" && typeof window.AudioDecoder === "function";

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

/**
 * Converts `file` into the file behind `handle`. Resolves to
 * { name, size, lossless, streamed: true } once the file is complete on disk.
 */
export async function streamConvert(file, formatId, handle, { stereo = true, onProgress } = {}) {
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
    return { name: handle.name, size: saved.size, lossless: !downmix, streamed: true, kind: "video" };
  } catch (error) {
    // Leave no half-written file behind.
    await writable.abort().catch(() => {});
    await handle.remove?.().catch(() => {});
    if (error instanceof ConversionCanceledError) throw new Error("cancelled");
    throw error;
  } finally {
    active = null;
    input.dispose?.();
  }
}

export async function cancelStream() {
  await active?.cancel();
}
