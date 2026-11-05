import { useSyncExternalStore } from "react";

/*
 * The converter's state lives here rather than in ConverterPage, so a conversion
 * keeps running (and its result stays available) while the user browses other
 * pages. ConverterDock shows its progress everywhere else on the site.
 * Kept free of heavy imports: it loads with every page.
 */

export const STAGE_LABEL = {
  engine: "Starting converter",
  probe: "Reading your file",
  copy: "Copying streams",
  encode: "Converting",
  stream: "Saving to your computer",
  device: "Saving to your device",
};

let state = {
  file: null,
  sourceUrl: "",
  meta: null,
  info: null,
  format: "mp4",
  gifFps: 24,
  gifWidth: 720,
  // Surround audio is mixed down to stereo unless the user picks "Keep".
  stereo: true,
  engineState: "idle", // idle | loading | ready | error
  engineProgress: 0,
  status: "idle", // idle | converting | done | error
  stage: "",
  progress: 0,
  startedAt: 0,
  result: null,
  error: "",
};

const listeners = new Set();
const setters = {};

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Results kept in the site's storage are deleted once replaced.
function disposeResult(result) {
  if (result.url) URL.revokeObjectURL(result.url);
  if (result.deviceFile) import("@/lib/streamConvert").then(({ removeDeviceFile }) => removeDeviceFile(result.deviceFile));
}

/** Sets one field; `value` may be an updater function, like a React state setter. */
export function setConverter(key, value) {
  const prev = state[key];
  const next = typeof value === "function" ? value(prev) : value;
  if (Object.is(prev, next)) return;
  state = { ...state, [key]: next };
  // Object URLs are freed once replaced.
  if (key === "sourceUrl" && prev) URL.revokeObjectURL(prev);
  if (key === "result" && prev) disposeResult(prev);
  listeners.forEach((listener) => listener());
}

/** `[value, setValue]` for one field, like useState but shared across the whole site. */
export function useConverterField(key) {
  const value = useSyncExternalStore(subscribe, () => state[key]);
  setters[key] ??= (next) => setConverter(key, next);
  return [value, setters[key]];
}
