import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

/*
 * Creator credits: the link each creator's name points to (TikTok, YouTube, ...).
 * Moderators set them on the Stats page; the list is public and loaded once, so any
 * creator name on the site can be shown as a link.
 */

const CreditsCtx = createContext({ credits: {}, rows: [], refresh: () => {} });

const key = (name) => String(name || "").trim().toLowerCase();

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
      if (row?.name && row.credit_url) map[key(row.name)] = row.credit_url;
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
  return credits[key(name)] || "";
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
