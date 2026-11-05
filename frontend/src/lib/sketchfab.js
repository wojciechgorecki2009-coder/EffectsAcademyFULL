/*
 * Sketchfab model downloads through the official Download API.
 *
 * Model details are public. Downloads need the user's own Sketchfab account:
 * they connect it by pasting their personal API token (sketchfab.com/settings/password),
 * which stays in this browser and is only ever sent to api.sketchfab.com.
 * Only models whose creators made them downloadable can be fetched, and the API
 * offers them as glTF, GLB and USDZ (never the original FBX/OBJ uploads).
 */

const API = "https://api.sketchfab.com/v3";
const TOKEN_KEY = "ea_sketchfab_token";

export const TOKEN_SETTINGS_URL = "https://sketchfab.com/settings/password";

export const FORMATS = [
  { id: "glb", label: "GLB", ext: "glb", detail: "One file with textures. Imports into After Effects, Blender and C4D" },
  { id: "gltf", label: "glTF", ext: "zip", detail: ".gltf, .bin and a textures folder, zipped" },
  { id: "usdz", label: "USDZ", ext: "usdz", detail: "For Apple AR, Reality Composer and iPhone" },
];

/** The 32-character model id in any Sketchfab model, embed or short link, or null. */
export function parseModelUid(text) {
  const match = String(text || "").match(/(?:^|[^a-f0-9])([a-f0-9]{32})(?![a-f0-9])/i);
  return match ? match[1].toLowerCase() : null;
}

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private mode: the token lasts for this visit only.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored.
  }
}

async function get(path, token) {
  let response;
  try {
    response = await fetch(`${API}${path}`, token ? { headers: { Authorization: `Token ${token}` } } : undefined);
  } catch {
    throw Object.assign(new Error("Couldn't reach Sketchfab. Check your connection and try again."), { code: "network" });
  }
  if (response.ok) return response.json();
  const fail = (message, code) => Object.assign(new Error(message), { code, status: response.status });
  if (response.status === 401) throw fail("Sketchfab didn't accept your API token. Connect your account again.", "auth");
  if (response.status === 404) throw fail("There's no Sketchfab model at that link.", "missing");
  if (response.status === 429) throw fail("Sketchfab is limiting requests right now. Wait a minute and try again.", "rate");
  if (response.status === 403) throw fail("Sketchfab won't let this account download that model.", "forbidden");
  throw fail("Sketchfab had a problem. Try again in a moment.", "server");
}

/** Public details of a model: name, creator, license, counts, thumbnails, isDownloadable. */
export const fetchModel = (uid) => get(`/models/${uid}`);

/** The account behind a token: { username, displayName, avatar }. */
export async function fetchAccount(token) {
  const me = await get("/me", token);
  const avatars = me.avatar?.images || [];
  const avatar = avatars.slice().sort((a, b) => a.width - b.width).find((image) => image.width >= 64) || avatars[0];
  return { username: me.username, displayName: me.displayName || me.username, avatar: avatar?.url || "" };
}

/** Temporary links (valid for about 5 minutes) to each format Sketchfab offers for the model. */
export async function requestDownload(uid, token) {
  const links = await get(`/models/${uid}/download`, token);
  return Object.fromEntries(FORMATS.filter((format) => links[format.id]?.url).map((format) => [format.id, links[format.id]]));
}

/** Picks a thumbnail at least `width` wide (or the largest there is). */
export function pickThumbnail(model, width = 1024) {
  const images = (model?.thumbnails?.images || []).slice().sort((a, b) => a.width - b.width);
  return (images.find((image) => image.width >= width) || images[images.length - 1])?.url || "";
}

/** The credit Creative Commons licenses ask for, ready to paste into a video description. */
export function attributionText(model) {
  const author = model.user?.displayName || model.user?.username || "its creator";
  const license = model.license ? ` is licensed under ${model.license.label}${model.license.url ? ` (${model.license.url})` : ""}` : "";
  return `"${model.name}" (${model.viewerUrl}) by ${author} (${model.user?.profileUrl || "https://sketchfab.com"})${license}.`;
}

export function fileName(model, format) {
  const base = (model.name || "model").replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, " ").trim() || "model";
  return format.id === "gltf" ? `${base} (glTF).zip` : `${base}.${format.ext}`;
}

/**
 * Downloads `url` as `name`. Fetching it first gives a proper file name and a
 * progress bar; if the storage host refuses that, the browser downloads it directly.
 */
export async function saveFile(url, name, onProgress) {
  let blob = null;
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error("fetch failed");
    const total = Number(response.headers.get("content-length")) || 0;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (total) onProgress?.(received / total);
    }
    blob = new Blob(chunks);
  } catch {
    blob = null;
  }
  const link = document.createElement("a");
  link.href = blob ? URL.createObjectURL(blob) : url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (blob) setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  return Boolean(blob);
}

export function formatBytes(bytes = 0) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
