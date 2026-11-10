import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

/*
 * Creator credits: the link each creator's name points to (TikTok, YouTube, ...).
 * Moderators set them on the Stats page; the list is public and loaded once, so any
 * creator name on the site can be shown as a link.
 */

const CreditsCtx = createContext({ credits: {}, rows: [], refresh: () => {} });

/**
 * One key per creator, so "MrBit" and "MRBIT AUDIOS" are the same person. Case,
 * spacing and punctuation are ignored, and a trailing "audio(s)" is dropped unless
 * that would leave almost nothing (so "Studios" stays "studios").
 * Must match creator_key() in backend/server.py.
 */
export function creatorKey(name) {
  const text = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const match = /^(.*?)(?:audios|audio)$/.exec(text);
  return match && match[1].length >= 3 ? match[1] : text;
}

export function CreatorCreditsProvider({ children }) {
  const [rows, setRows] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/creator-credits");
      setRows(Array.isArray(data) ? data : []);
    } catch {
      // Without the list, names simply show as plain text.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const credits = useMemo(() => {
    const map = {};
    for (const row of rows) {
      if (row?.credit_url) map[row.key || creatorKey(row.name)] = row.credit_url;
    }
    return map;
  }, [rows]);

  const value = useMemo(() => ({ credits, rows, refresh }), [credits, rows, refresh]);
  return <CreditsCtx.Provider value={value}>{children}</CreditsCtx.Provider>;
}

export function useCreatorCredits() {
  return useContext(CreditsCtx);
}

/** The credit link for a creator name, or "" when none is set. */
export function useCreatorCredit(name) {
  const { credits } = useContext(CreditsCtx);
  return credits[creatorKey(name)] || "";
}

/** Which site a credit link goes to, for labels and icons. */
export function creditPlatform(url) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { id: "link", label: "Website" };
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return { id: "tiktok", label: "TikTok" };
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return { id: "youtube", label: "YouTube" };
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return { id: "instagram", label: "Instagram" };
  if (host === "twitch.tv" || host.endsWith(".twitch.tv")) return { id: "twitch", label: "Twitch" };
  if (host === "x.com" || host === "twitter.com" || host.endsWith(".twitter.com")) return { id: "x", label: "X" };
  if (host === "discord.gg" || host === "discord.com" || host.endsWith(".discord.com")) return { id: "discord", label: "Discord" };
  return { id: "link", label: host || "Website" };
}
