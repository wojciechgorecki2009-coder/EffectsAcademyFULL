/*
 * Background remover worker (static file, loaded as a module worker).
 *
 * Runs entirely on the visitor's device with Transformers.js:
 *   - WebGPU available → BEN2 (MIT licence), the most accurate open model
 *     that runs in browsers today.
 *   - Otherwise (or if the GPU path fails) → ormbg (Apache-2.0) on the CPU,
 *     which is several times faster there than BEN2.
 * (BiRefNet was evaluated and rejected: it exceeds WebGPU's 16 storage-buffer
 * limit and runs out of memory on the CPU build.)
 *
 * The worker only produces the alpha matte at the model's working size. The
 * page applies it to the untouched full-resolution original, so the output
 * keeps every original pixel and the exact original dimensions.
 */
import { AutoModel, AutoProcessor, RawImage, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1/dist/transformers.min.js";

const GPU_MODEL = { id: "onnx-community/BEN2-ONNX", device: "webgpu", dtype: "fp16" };
const CPU_MODEL = { id: "onnx-community/ormbg-ONNX", device: "wasm", dtype: "fp32" };
const MODEL_SIZE = 1024;

env.allowLocalModels = false;
env.useBrowserCache = true;

let model = null;
let processor = null;
let active = null;
let loading = null;

async function hasWebGPU() {
  try {
    if (!self.navigator?.gpu) return false;
    return Boolean(await self.navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

function progress(event) {
  if (event.status === "progress" && event.total) {
    self.postMessage({ type: "progress", file: event.file, loaded: event.loaded, total: event.total });
  }
}

async function load(spec) {
  self.postMessage({ type: "device", device: spec.device });
  model = await AutoModel.from_pretrained(spec.id, { device: spec.device, dtype: spec.dtype, progress_callback: progress });
  processor = await AutoProcessor.from_pretrained(spec.id);
  active = spec;
}

function ensureLoaded() {
  if (!loading) {
    loading = (async () => {
      if (await hasWebGPU()) {
        try {
          await load(GPU_MODEL);
          return;
        } catch {}
      }
      await load(CPU_MODEL);
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

async function predict(bitmap) {
  const canvas = new OffscreenCanvas(MODEL_SIZE, MODEL_SIZE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, MODEL_SIZE, MODEL_SIZE);
  bitmap.close?.();
  const pixels = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  // Models take 3-channel RGB; a 4-channel input aborts inside the runtime.
  const image = new RawImage(pixels.data, MODEL_SIZE, MODEL_SIZE, 4).rgb();
  const { pixel_values } = await processor(image);
  const { alphas } = await model({ pixel_values });
  const [, , height, width] = alphas.dims;
  const matte = alphas.clamp(0, 1).mul(255).round().to("uint8");
  return { data: new Uint8Array(matte.data), width, height };
}

function looksBroken(mask) {
  // A failing fp16 GPU graph can return an all-empty matte; detect and retry on CPU.
  let max = 0;
  for (let i = 0; i < mask.data.length; i += 97) if (mask.data[i] > max) max = mask.data[i];
  return max === 0;
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      await ensureLoaded();
      self.postMessage({ type: "ready", device: active.device });
      return;
    }
    if (data.type === "segment") {
      await ensureLoaded();
      let mask = null;
      try {
        mask = await predict(data.bitmap);
      } catch (error) {
        if (active.device !== "webgpu") throw error;
      }
      if (active.device === "webgpu" && (!mask || looksBroken(mask))) {
        await load(CPU_MODEL);
        mask = await predict(data.retryBitmap);
      } else {
        data.retryBitmap?.close?.();
      }
      self.postMessage(
        { type: "mask", id: data.id, mask: mask.data, width: mask.width, height: mask.height, device: active.device },
        [mask.data.buffer]
      );
    }
  } catch (error) {
    // The ONNX runtime sometimes reports internal failures as bare numbers.
    const message = typeof error === "number"
      ? "The AI hit an internal error on this device. Try reloading the page."
      : String(error?.message || error);
    self.postMessage({ type: "error", id: data.id, message });
  }
};
