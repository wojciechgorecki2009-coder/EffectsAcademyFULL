import { useEffect, useState } from "react";

const audio = typeof Audio !== "undefined" ? new Audio() : null;

const state = {
  src: "",
  originalSrc: "",
  title: "",
  subtitle: "",
  creator: "",
  thumbnail: "",
  downloadUrl: "",
  downloadFilename: "",
  assetId: "",
  allowSlowedDownloads: true,
  playing: false,
  loading: false,
  progress: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  looping: false,
  rate: 1,
};

const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener({ ...state }));
}

function patch(next) {
  Object.assign(state, next);
  emit();
}

if (audio) {
  audio.preload = "metadata";
  audio.crossOrigin = "anonymous";
  audio.volume = state.volume;
  // Slower playback lowers the pitch too, matching the 0.9x / 0.8x "slowed" downloads.
  audio.preservesPitch = false;
  audio.webkitPreservesPitch = false;
  audio.mozPreservesPitch = false;

  audio.addEventListener("timeupdate", () => {
    patch({ progress: audio.currentTime || 0 });
  });

  audio.addEventListener("loadedmetadata", () => {
    patch({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
  });

  audio.addEventListener("durationchange", () => {
    patch({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
  });

  audio.addEventListener("waiting", () => patch({ loading: true }));
  audio.addEventListener("canplay", () => patch({ loading: false }));
  audio.addEventListener("play", () => patch({ playing: true, loading: false }));
  audio.addEventListener("pause", () => patch({ playing: false, loading: false }));
  audio.addEventListener("ended", () => patch({ playing: false, progress: 0 }));
}

export function getGlobalAudioState() {
  return { ...state };
}

export function subscribeGlobalAudio(listener) {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function useGlobalAudio() {
  const [snapshot, setSnapshot] = useState(() => getGlobalAudioState());

  useEffect(() => subscribeGlobalAudio(setSnapshot), []);

  return snapshot;
}

export async function playGlobalAudio({ src, originalSrc, title, subtitle, creator, thumbnail, downloadUrl, downloadFilename, assetId, allowSlowedDownloads = true }) {
  if (!audio || !src) return;

  const isNewTrack = audio.src !== src;
  // A slowed preview only makes sense for audio that offers slowed downloads.
  if (!allowSlowedDownloads && state.rate !== 1) setGlobalRate(1);
  patch({
    src,
    originalSrc: originalSrc || src,
    title: title || "Audio preview",
    subtitle: subtitle || "EffectsAcademy audio",
    creator: creator || "",
    thumbnail: thumbnail || "",
    downloadUrl: downloadUrl || originalSrc || src,
    downloadFilename: downloadFilename || "",
    assetId: assetId || "",
    allowSlowedDownloads,
    loading: true,
    ...(isNewTrack ? { progress: 0, duration: 0 } : {}),
  });

  if (isNewTrack) {
    audio.src = src;
    audio.load();
  }

  audio.volume = state.volume;
  audio.muted = state.muted;
  audio.loop = state.looping;
  audio.playbackRate = state.rate;
  await audio.play();
}

export function toggleGlobalAudio() {
  if (!audio || !state.src) return;
  if (audio.paused) {
    audio.play().catch(() => patch({ loading: false, playing: false }));
  } else {
    audio.pause();
  }
}

export function pauseGlobalAudio() {
  if (!audio) return;
  audio.pause();
}

export function seekGlobalAudio(value) {
  if (!audio || !Number.isFinite(value)) return;
  audio.currentTime = value;
  patch({ progress: value });
}

export function setGlobalVolume(value) {
  const volume = Math.max(0, Math.min(1, Number(value) || 0));
  if (audio) audio.volume = volume;
  patch({ volume, muted: volume === 0 ? true : state.muted && volume === 0 });
}

export function toggleGlobalMute() {
  const muted = !state.muted;
  if (audio) audio.muted = muted;
  patch({ muted });
}

export function setGlobalLooping(value) {
  const looping = Boolean(value);
  if (audio) audio.loop = looping;
  patch({ looping });
}

/** Playback speed for previewing how a slowed download will sound (1, 0.9 or 0.8). */
export function setGlobalRate(value) {
  const rate = Number(value) || 1;
  if (audio) {
    // defaultPlaybackRate keeps the speed when the next track loads.
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
  }
  patch({ rate });
}
