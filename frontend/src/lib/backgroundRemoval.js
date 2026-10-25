/*
 * Local background removal.
 *
 * The model (see public/workers/background-remover.worker.js) predicts an
 * alpha matte at its working size (1024×1024). Here we upscale that matte to the image's exact
 * size and write it into the alpha channel of the untouched original pixels,
 * then encode a lossless PNG. Nothing is uploaded; nothing is resampled or
 * recompressed except the transparency itself.
 */

// One-time model downloads: BEN2 on WebGPU, ormbg on the CPU fallback.
export const MODEL_DOWNLOAD_MB = { webgpu: 219, wasm: 176 };
// Browsers refuse canvases much beyond this (Chrome ~268 MP, Safari far less).
export const MAX_PIXELS = 100_000_000;
export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/bmp", "image/gif"];

let worker = null;
let readyPromise = null;
let progressListener = null;
let nextId = 1;
const pending = new Map();
let activeDevice = "";

function getWorker() {
  if (worker) return worker;
  worker = new Worker("/workers/background-remover.worker.js", { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.type === "progress") {
      progressListener?.(data);
      return;
    }
    if (data.type === "device") {
      activeDevice = data.device;
      return;
    }
    if (data.type === "ready") {
      activeDevice = data.device;
      pending.get("load")?.resolve(data.device);
      pending.delete("load");
      return;
    }
    const job = pending.get(data.id ?? "load");
    if (!job) return;
    pending.delete(data.id ?? "load");
    if (data.type === "error") job.reject(new Error(data.message));
    else {
      activeDevice = data.device || activeDevice;
      job.resolve(data);
    }
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "The background remover stopped unexpectedly.");
    pending.forEach((job) => job.reject(error));
    pending.clear();
    worker?.terminate();
    worker = null;
    readyPromise = null;
  };
  return worker;
}

/** Downloads (first time) and initialises the model. Resolves with "webgpu" or "wasm". */
export function loadRemover(onProgress) {
  progressListener = onProgress || progressListener;
  if (!readyPromise) {
    readyPromise = new Promise((resolve, reject) => {
      pending.set("load", { resolve, reject });
      getWorker().postMessage({ type: "load" });
    }).catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

export const currentDevice = () => activeDevice;

async function decode(file) {
  // Native resolution, EXIF rotation honoured. Colour is converted to sRGB so
  // wide-gamut photos (e.g. iPhone Display P3) look the same in the PNG;
  // sRGB images come through pixel-identical.
  return createImageBitmap(file, {
    imageOrientation: "from-image",
    premultiplyAlpha: "none",
  });
}

export async function readImageInfo(file) {
  const bitmap = await decode(file);
  const info = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return info;
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || canvas.width !== width || canvas.height !== height) {
    throw new Error("This image is too large for your browser to process.");
  }
  return { canvas, ctx };
}

/**
 * Removes the background. Returns { blob, url, width, height, device }.
 */
export async function removeBackground(file, { onStage, onProgress } = {}) {
  onStage?.("model");
  await loadRemover(onProgress);

  onStage?.("decode");
  const bitmap = await decode(file);
  const { width, height } = bitmap;
  if (width * height > MAX_PIXELS) {
    bitmap.close();
    throw new Error(`This image is ${Math.round((width * height) / 1e6)} megapixels. The limit is 100 megapixels.`);
  }

  onStage?.("segment");
  const forModel = await createImageBitmap(bitmap, { resizeWidth: 1024, resizeHeight: 1024, resizeQuality: "high" });
  const retry = await createImageBitmap(bitmap, { resizeWidth: 1024, resizeHeight: 1024, resizeQuality: "high" });
  const id = nextId++;
  const result = await new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: "segment", id, bitmap: forModel, retryBitmap: retry }, [forModel, retry]);
  });

  onStage?.("compose");
  const { mask, width: maskWidth, height: maskHeight } = result;

  // Matte → canvas, then scale to the exact original size with smooth filtering.
  const small = createCanvas(maskWidth, maskHeight);
  const matte = small.ctx.createImageData(maskWidth, maskHeight);
  for (let i = 0, j = 0; i < mask.length; i += 1, j += 4) {
    matte.data[j] = mask[i];
    matte.data[j + 3] = 255;
  }
  small.ctx.putImageData(matte, 0, 0);

  const scaled = createCanvas(width, height);
  scaled.ctx.imageSmoothingEnabled = true;
  scaled.ctx.imageSmoothingQuality = "high";
  scaled.ctx.drawImage(small.canvas, 0, 0, width, height);
  const alpha = scaled.ctx.getImageData(0, 0, width, height).data;
  scaled.canvas.width = 0;

  // Original pixels, untouched except for the alpha channel.
  const full = createCanvas(width, height);
  full.ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = full.ctx.getImageData(0, 0, width, height, { colorSpace: "srgb" });
  const px = image.data;
  for (let i = 3; i < px.length; i += 4) {
    px[i] = (px[i] * alpha[i - 3] + 127) / 255;
  }
  full.ctx.putImageData(image, 0, 0);

  onStage?.("encode");
  const blob = await new Promise((resolve, reject) =>
    full.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the PNG."))), "image/png")
  );
  full.canvas.width = 0;
  return { blob, url: URL.createObjectURL(blob), width, height, device: currentDevice() };
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
