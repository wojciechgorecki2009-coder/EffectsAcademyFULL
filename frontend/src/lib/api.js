import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://effects-academy-api.onrender.com";
export const API = `${BACKEND_URL}/api`;
export const FILE_BASE = BACKEND_URL;

export const api = axios.create({ baseURL: API });

export const UPLOAD_PASSWORD_KEY = "ea_upload_pass";
export const AUTH_TOKEN_KEY = "ea_auth_token";
export const getPass = () => sessionStorage.getItem(UPLOAD_PASSWORD_KEY) || "";
export const setPass = (p) => sessionStorage.setItem(UPLOAD_PASSWORD_KEY, p);
export const clearPass = () => sessionStorage.removeItem(UPLOAD_PASSWORD_KEY);
export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || "";
export const setAuthToken = (token) => localStorage.setItem(AUTH_TOKEN_KEY, token);
export const clearAuthToken = () => localStorage.removeItem(AUTH_TOKEN_KEY);

api.interceptors.request.use((cfg) => {
  const p = getPass();
  if (p) cfg.headers["X-Upload-Password"] = p;
  const token = getAuthToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const CATEGORIES = [
  "Torrents",
  "Project Files",
  "Overlays",
  "Audios",
  "Sound FX",
  "Presets",
  "Videos",
  "Premium",
];

export const AUDIO_CREATORS = [
  "MRBIT AUDIOS",
  "IUSETHIS AUDIOS",
  "NEXLO AUDIOS",
  "ALTOM AUDIOS",
  "S4MURAIAE AUDIOS",
  "ZINC AUDIOS",
];

export const CREATOR_THEMES = {
  "MRBIT AUDIOS":     { from: "#3B0F66", to: "#1A0530", text: "#D8B4FE", accent: "#A855F7" },
  "IUSETHIS AUDIOS":  { from: "#0E2A5C", to: "#040E26", text: "#93C5FD", accent: "#3B82F6" },
  "NEXLO AUDIOS":     { from: "#0B3D2E", to: "#031A14", text: "#6EE7B7", accent: "#10B981" },
  "ALTOM AUDIOS":     { from: "#4A2E07", to: "#1A1004", text: "#FCD34D", accent: "#F59E0B" },
  "S4MURAIAE AUDIOS": { from: "#4A0D2A", to: "#1A0410", text: "#F9A8D4", accent: "#EC4899" },
  "ZINC AUDIOS":      { from: "#053B45", to: "#021519", text: "#5EEAD4", accent: "#14B8A6" },
};

export const SHOWS = [
  "The Boys",
  "Dexter",
  "Daredevil",
  "Welcome to Derry",
  "Punisher",
  "Supernatural",
  "Game of Thrones",
  "Breaking Bad",
  "Prison Break",
  "Lost",
];

export const SHOW_THEMES = {
  "The Boys":         { from: "#3A0C18", to: "#0A0204", text: "#FCA5A5", accent: "#EF4444" },
  "Dexter":           { from: "#1F3A24", to: "#06120A", text: "#86EFAC", accent: "#22C55E" },
  "Daredevil":        { from: "#451414", to: "#180404", text: "#FCA5A5", accent: "#DC2626" },
  "Welcome to Derry": { from: "#3A1E04", to: "#120802", text: "#FDBA74", accent: "#F97316" },
  "Punisher":         { from: "#1F1F1F", to: "#050505", text: "#E5E5E5", accent: "#A1A1AA" },
  "Supernatural":     { from: "#2A1A05", to: "#0C0502", text: "#FCD34D", accent: "#D97706" },
  "Game of Thrones":  { from: "#3D2D08", to: "#100B02", text: "#FDE68A", accent: "#EAB308" },
  "Breaking Bad":     { from: "#1F3010", to: "#0A1004", text: "#BEF264", accent: "#84CC16" },
  "Prison Break":     { from: "#3F1F05", to: "#120802", text: "#FDBA74", accent: "#F97316" },
  "Lost":             { from: "#0B3645", to: "#02141A", text: "#67E8F9", accent: "#06B6D4" },
};

export const SHOW_IMAGES = {
  "The Boys":
    "https://media.discordapp.net/attachments/873315413654659133/1510826877906849933/image.png?ex=6a1e3aad&is=6a1ce92d&hm=ee251d02416f1e61a0d650a2f3a487bf019081423bf03c9ee1cc31897999194e&=&format=webp&quality=lossless",
  "Dexter":
    "https://media.discordapp.net/attachments/873315413654659133/1510827027333255288/MV5BNTE5ZGI2N2UtYmFiMi00ZGIxLWI1ZTMtYWJkZDYxNDZiOTQwXkEyXkFqcGc._V1_.png?ex=6a1e3ad1&is=6a1ce951&hm=9ec520d4b02108c937dd2fc857adc145401c21f9974ae99f9b16d8d5995a8a9c&=&format=webp&quality=lossless&width=233&height=350",
  "Daredevil":
    "https://media.discordapp.net/attachments/873315413654659133/1510827216702017637/MV5BNDBkMWRhMzEtM2M0Ny00OGZhLThkZGMtMTY1NWUwZWNhODdiXkEyXkFqcGc._V1_FMjpg_UX1000_.png?ex=6a1e3afe&is=6a1ce97e&hm=73a8e6aec8531ba4ef22a0f10ab92ae243a181c431f9cb5edd100a3d6682ee26&=&format=webp&quality=lossless&width=648&height=960",
  "Welcome to Derry":
    "https://media.discordapp.net/attachments/873315413654659133/1510827377976934400/it-welcome-to-derry-og.png?ex=6a1e3b24&is=6a1ce9a4&hm=f0a0698a4bc8ae60206ef4aa865f53ffe84326ba1f9b78e287696c33a58a8323&=&format=webp&quality=lossless&width=1522&height=856",
  "Punisher":
    "https://media.discordapp.net/attachments/873315413654659133/1510827484424306788/The_Punisher_One_Last_Kill_poster.png?ex=6a1e3b3e&is=6a1ce9be&hm=4449be8fd2bd49ea61b46649677944c4f68695458f97f5d1993800eb56466592&=&format=webp&quality=lossless",
  "Supernatural":
    "https://media.discordapp.net/attachments/873315413654659133/1510827604578664488/MV5BMDFmMGZmMGItNGRjNC00NjVjLWI5ODEtNzhjMTE5MmJhN2FkXkEyXkFqcGc._V1_.png?ex=6a1e3b5a&is=6a1ce9da&hm=d8631d73187a461a4628ce9416f39979db4fdd0fee12c06a1e72bfa195013065&=&format=webp&quality=lossless",
  "Game of Thrones":
    "https://media.discordapp.net/attachments/873315413654659133/1510827679732076604/MV5BMTNhMDJmNmYtNDQ5OS00ODdlLWE0ZDAtZTgyYTIwNDY3OTU3XkEyXkFqcGc._V1_FMjpg_UX1000_.png?ex=6a1e3b6c&is=6a1ce9ec&hm=68a8805feb82a95cc3abbf35f86bb8b54af3773fc02e4673daf3b7b56773ab00&=&format=webp&quality=lossless&width=641&height=960",
  "Breaking Bad":
    "https://media.discordapp.net/attachments/873315413654659133/1510827852717752481/MV5BMzU5ZGYzNmQtMTdhYy00OGRiLTg0NmQtYjVjNzliZTg1ZGE4XkEyXkFqcGc._V1_.png?ex=6a1e3b95&is=6a1cea15&hm=5f9026faef049f6e3669d0459d9f2f88ba0ce36f140be96bb320f0c3a31839c0&=&format=webp&quality=lossless&width=233&height=350",
  "Prison Break":
    "https://media.discordapp.net/attachments/873315413654659133/1510827947253039175/AAAABaXYpxlQ-t8vAaW9DWwQ3U31NZmXW9aiOo-JELYqGv9RQPHs1-AWxxpPuDUvP-2SPedg6GQ049c2Wt5AEdM1cgCS5PfB8jzYVE8Q.png?ex=6a1e3bac&is=6a1cea2c&hm=60d421fc2cdcb19d28420f1810915469f052f330c31512c8bf5be2936cdb2814&=&format=webp&quality=lossless",
  "Lost":
    "https://media.discordapp.net/attachments/873315413654659133/1510828044414095631/MV5BZmZhY2ViYzYtMTQ0NS00NDcyLWIxZTYtMGUyODE0NDA0NmNkXkEyXkFqcGc._V1_FMjpg_UX1000_.png?ex=6a1e3bc3&is=6a1cea43&hm=298939f6bdddb18a83d667d0778b670cd8a2f5bc45f030c9ef11ae2cbabe6eea&=&format=webp&quality=lossless&width=237&height=350",
};

export function deriveDownloadFilename(asset) {
  if (asset.original_filename) return asset.original_filename;
  const m = (asset.file_url || "").match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = m ? `.${m[1]}` : "";
  const safe = (asset.title || "asset").replace(/[^\w\s.-]/g, "_").trim() || "asset";
  return `${safe}${ext}`;
}

export const CATEGORY_COLORS = {
  Torrents:        { text: "#60A5FA", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" },
  "Project Files": { text: "#FBBF24", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  Overlays:        { text: "#F472B6", bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.3)" },
  Audios:          { text: "#34D399", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  "Sound FX":      { text: "#A78BFA", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)" },
  Presets:         { text: "#22D3EE", bg: "rgba(6,182,212,0.12)",  border: "rgba(6,182,212,0.3)" },
  Videos:          { text: "#F87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.32)" },
  Premium:         { text: "#FDE047", bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.3)" },
};

export const SHOW_GENRES = {
  Action:   ["The Boys", "Daredevil", "Punisher", "Prison Break"],
  "Sci-Fi & Mystery": ["Welcome to Derry", "Supernatural", "Lost", "Game of Thrones"],
  Drama:    ["Dexter", "Breaking Bad"],
};

export function buildFileUrl(url, accessToken = "", uploadPassword = "") {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const out = `${FILE_BASE}${url}`;
  const params = new URLSearchParams();
  if (accessToken) params.set("access_token", accessToken);
  if (uploadPassword) params.set("upload_password", uploadPassword);
  return params.size ? `${out}${out.includes("?") ? "&" : "?"}${params}` : out;
}

export function buildDownloadUrl(url, originalFilename) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const sep = url.includes("?") ? "&" : "?";
  let out = `${FILE_BASE}${url}${sep}download=1`;
  if (originalFilename) {
    out += `&name=${encodeURIComponent(originalFilename)}`;
  }
  const token = getAuthToken();
  if (token) out += `&access_token=${encodeURIComponent(token)}`;
  const uploadPassword = getPass();
  if (uploadPassword) out += `&upload_password=${encodeURIComponent(uploadPassword)}`;
  return out;
}

const FALLBACK_THEMES = [
  { from: "#0E2A5C", to: "#040E26", text: "#93C5FD", accent: "#3B82F6" },
  { from: "#3B0F66", to: "#1A0530", text: "#D8B4FE", accent: "#A855F7" },
  { from: "#0B3D2E", to: "#031A14", text: "#6EE7B7", accent: "#10B981" },
  { from: "#4A2E07", to: "#1A1004", text: "#FCD34D", accent: "#F59E0B" },
  { from: "#4A0D2A", to: "#1A0410", text: "#F9A8D4", accent: "#EC4899" },
  { from: "#053B45", to: "#021519", text: "#5EEAD4", accent: "#14B8A6" },
  { from: "#3A0C18", to: "#0A0204", text: "#FCA5A5", accent: "#EF4444" },
  { from: "#3D2D08", to: "#100B02", text: "#FDE68A", accent: "#EAB308" },
];

export function getTheme(label, predefined = {}) {
  if (predefined[label]) return predefined[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return FALLBACK_THEMES[Math.abs(h) % FALLBACK_THEMES.length];
}
