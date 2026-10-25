import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AudioLines, Crown, Copy, Download, Eye, Film, ImageIcon, Link as LinkIcon, LockKeyhole, Pause, Pencil, Pin, Play, RefreshCw, Trash2 } from "lucide-react";
import { CATEGORY_COLORS, FILE_BASE, api, buildFileUrl, buildDownloadUrl, deriveDownloadFilename, getAuthToken } from "@/lib/api";
import { useUploadAccess } from "@/lib/uploadAccess";
import { useAuth } from "@/lib/auth";
import { playGlobalAudio, toggleGlobalAudio, useGlobalAudio } from "@/lib/globalAudio";
import UploadModal from "@/components/UploadModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const isRecentlyAdded = (asset) => {
  const stamp = asset.created_at || asset.createdAt;
  if (!stamp) return false;
  const created = new Date(stamp).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created < 7 * 24 * 60 * 60 * 1000;
};

const isRecentlyUpdated = (asset) => {
  if (!asset.is_updated || !asset.updated_at) return false;
  const updated = new Date(asset.updated_at).getTime();
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated < 14 * 24 * 60 * 60 * 1000;
};

const isVideoPreview = (url = "") => /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url);

const extractYouTubeId = (url = "") => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (!host.endsWith("youtube.com")) return "";
    if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || "";
  } catch {}
  return "";
};

const youtubeThumbnailUrl = (url = "") => {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
};

const youtubeEmbedUrl = (url = "") => {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1` : "";
};

const isTypingTarget = (target) => {
  if (!target?.closest) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
};

/*
 * Motion previews only load and play while they are on screen. Dozens of
 * looping videos decoding at once is what runs phones out of memory.
 */
function InViewVideo({ src, className }) {
  const ref = useRef(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setNear(entry.isIntersecting);
        if (entry.isIntersecting) node.play?.().catch(() => {});
        else node.pause?.();
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={near ? src : undefined}
      className={className}
      muted
      loop
      playsInline
      autoPlay={near}
      preload={near ? "metadata" : "none"}
    />
  );
}

function PreviewMedia({ src, title, className = "", videoClassName = "", imageClassName = "" }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src) return null;
  if (isVideoPreview(src)) {
    return <InViewVideo src={src} className={`${className} ${videoClassName}`} />;
  }
  if (broken) {
    return (
      <span className={`${className} flex items-center justify-center text-ink-3`} role="img" aria-label={title || "Asset preview"}>
        <ImageIcon className="h-7 w-7" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={title || "Asset preview"}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={`${className} ${imageClassName}`}
    />
  );
}

async function downloadUrlWithoutLeavingPage(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function directUrlEndpoint(src) {
  if (!src) return "";
  const path = src.startsWith(FILE_BASE) ? src.slice(FILE_BASE.length) : src;
  const match = path.match(/\/api\/uploads\/([^/?#]+)/);
  if (!match) return "";
  return `/uploads/${encodeURIComponent(decodeURIComponent(match[1]))}/direct`;
}

export default function AssetCard({ asset, featured = false, onChanged, allAssets = [] }) {
  const { isUploader, canDelete } = useUploadAccess();
  const { hasPremium } = useAuth();
  const globalAudio = useGlobalAudio();
  const navigate = useNavigate();
  const ref = useRef(null);

  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadCount, setDownloadCount] = useState(asset.download_count || 0);
  const [viewCount, setViewCount] = useState(asset.view_count || 0);
  const color = CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.Overlays;
  const isAudio = asset.category === "Audios";
  const isVideo = asset.category === "Videos";
  const isPremium = asset.category === "Premium";
  const isUpdated = isRecentlyUpdated(asset);
  const isNew = !isUpdated && isRecentlyAdded(asset);
  const isLockedPremium = isPremium && !hasPremium;
  const youtubeThumb = isVideo ? youtubeThumbnailUrl(asset.external_url) : "";
  const youtubeEmbed = isVideo ? youtubeEmbedUrl(asset.external_url) : "";
  const thumbnailSrc = asset.thumbnail_url
    ? buildFileUrl(asset.thumbnail_url, isPremium && hasPremium ? getAuthToken() : "", "")
    : youtubeThumb;
  const fileSrc = asset.file_url
    ? buildFileUrl(asset.file_url, isPremium && hasPremium ? getAuthToken() : "", "")
    : "";
  const isActiveAudio = Boolean(fileSrc) && globalAudio.originalSrc === fileSrc;
  const downloadFilename = deriveDownloadFilename(asset);
  const downloadUrl = asset.file_url ? buildDownloadUrl(asset.file_url, downloadFilename) : "";
  const hasAudioPlayback = isAudio && Boolean(fileSrc) && !isLockedPremium;
  const displayGenre = asset.genre || (isAudio ? asset.bpm : "");
  const thumbnailIsVideo = isVideoPreview(thumbnailSrc);

  useEffect(() => {
    setDownloadCount(asset.download_count || 0);
  }, [asset.download_count]);

  useEffect(() => {
    setViewCount(asset.view_count || 0);
  }, [asset.view_count]);

  const relatedAssets = useMemo(() => {
    if (!allAssets?.length) return [];
    const score = (candidate) => {
      let value = 0;
      if (candidate.category === asset.category) value += 4;
      if (candidate.creator_tag && candidate.creator_tag === asset.creator_tag) value += 4;
      if ((candidate.genre || candidate.bpm) && (candidate.genre || candidate.bpm) === (asset.genre || asset.bpm)) value += 3;
      if (candidate.show_group && candidate.show_group === asset.show_group) value += 3;
      if (candidate.torrent_type && candidate.torrent_type === asset.torrent_type) value += 2;
      if (candidate.pack_id && candidate.pack_id === asset.pack_id) value += 2;
      return value;
    };

    return allAssets
      .filter((candidate) => candidate.id !== asset.id)
      .map((candidate) => ({ candidate, score: score(candidate) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((entry) => entry.candidate);
  }, [allAssets, asset]);

  const openPremium = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    navigate(`/premium?asset=${encodeURIComponent(asset.id)}`);
  };

  const recordDownload = () => {
    api.post(`/assets/${asset.id}/download`).catch(() => {});
    setDownloadCount((count) => count + 1);
  };

  const recordVideoView = () => {
    if (!isVideo) return;
    api.post(`/assets/${asset.id}/view`)
      .then(({ data }) => {
        if (typeof data?.view_count === "number") setViewCount(data.view_count);
      })
      .catch(() => {});
    setViewCount((count) => count + 1);
  };

  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--card-x", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    ref.current.style.setProperty("--card-y", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };

  const download = async () => {
    if (hasAudioPlayback) {
      await playAudio();
      return;
    }
    if (isVideo) {
      setPreviewOpen(true);
      recordVideoView();
      return;
    }
    setDownloading(true);
    toast.success("Starting download...");
    try {
      if (isPremium && (asset.external_url || asset.has_external_url)) {
        const { data } = await api.post(`/assets/${asset.id}/premium-download-link`);
        toast.success("Temporary premium link created.");
        window.location.assign(data.url);
      } else if (asset.file_url) {
        const fname = deriveDownloadFilename(asset);
        await downloadUrlWithoutLeavingPage(buildDownloadUrl(asset.file_url, fname), fname);
        recordDownload();
      } else if (asset.external_url) {
        window.open(asset.external_url, "_blank", "noopener");
        recordDownload();
      } else {
        toast.error("No download available.");
      }
    } finally {
      setTimeout(() => setDownloading(false), 700);
    }
  };

  const duplicate = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDuplicating(true);
    try {
      const copy = {
        title: `${asset.title} Copy`,
        description: asset.description || "",
        category: asset.category,
        creator_tag: asset.creator_tag || "",
        ae_version: asset.ae_version || "",
        bpm: "",
        genre: asset.genre || (isAudio ? asset.bpm || "" : ""),
        show_group: asset.show_group || "",
        torrent_type: asset.torrent_type || "Show",
        thumbnail_url: asset.thumbnail_url || "",
        file_url: asset.file_url || "",
        original_filename: asset.original_filename || "",
        external_url: asset.external_url || "",
        pack_id: asset.pack_id || "",
        custom_category_id: asset.custom_category_id || "",
        is_updated: false,
        updated_at: "",
      };
      await api.post("/assets", copy);
      toast.success("Asset duplicated.");
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not duplicate asset.");
    } finally {
      setDuplicating(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${asset.title}"?`)) return;
    try {
      await api.delete(`/assets/${asset.id}`);
      toast.success("Asset deleted.");
      onChanged?.();
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const openPreview = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isLockedPremium) return openPremium(event);
    if (isVideo && youtubeEmbed) {
      setPreviewOpen(true);
      recordVideoView();
    } else if (!isAudio && thumbnailSrc) {
      setPreviewOpen(true);
    }
  };

  const playAudio = async () => {
    if (!hasAudioPlayback) return;
    if (isActiveAudio) {
      toggleGlobalAudio();
      return;
    }
    try {
      const endpoint = directUrlEndpoint(fileSrc);
      const resolved = endpoint
        ? (await api.get(endpoint)).data?.url || fileSrc
        : fileSrc;
      await playGlobalAudio({
        src: resolved,
        originalSrc: fileSrc,
        title: asset.title || "Audio preview",
        subtitle: asset.creator_tag ? `Audio by ${asset.creator_tag}` : "Playing from EffectsAcademy",
        thumbnail: thumbnailSrc,
        downloadUrl,
        downloadFilename,
        assetId: asset.id,
        allowSlowedDownloads: true,
      });
    } catch {
      toast.error("Unable to play this audio yet.");
    }
  };

  const handleCardClick = (event) => {
    if (isLockedPremium) {
      openPremium(event);
      return;
    }
    if (!hasAudioPlayback) return;
    const interactive = event.target.closest("button, a, input, textarea, select, [role='button']");
    if (interactive && interactive !== event.currentTarget) return;
    playAudio();
  };

  const handleCardKeyDown = (event) => {
    if (isTypingTarget(event.target)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isLockedPremium) {
      openPremium(event);
      return;
    }
    if (!hasAudioPlayback) return;
    event.preventDefault();
    playAudio();
  };

  const actionLabel = isLockedPremium
    ? "Unlock Premium"
    : isVideo
      ? "Watch"
      : hasAudioPlayback
        ? (isActiveAudio && globalAudio.playing ? "Pause" : "Play")
        : downloading
          ? "Downloading..."
          : "Download";
  const ActionIcon = isLockedPremium
    ? LockKeyhole
    : (isVideo || hasAudioPlayback)
      ? (isActiveAudio && globalAudio.playing ? Pause : Play)
      : Download;
  const metaParts = [
    asset.creator_tag ? `${isAudio ? "Audio by" : "By"} ${asset.creator_tag}` : "",
    displayGenre,
    asset.ae_version ? `AE ${asset.ae_version}` : "",
  ].filter(Boolean);

  return (
    <>
      <div
        ref={ref}
        onMouseMove={onMove}
        onClick={handleCardClick}
        role={isLockedPremium || hasAudioPlayback ? "button" : undefined}
        tabIndex={isLockedPremium || hasAudioPlayback ? 0 : undefined}
        onKeyDown={handleCardKeyDown}
        className={`asset-card group ${featured ? "featured-extension-card" : ""} ${isPremium ? "is-premium" : ""} ${isActiveAudio ? "is-playing" : ""} ${isLockedPremium || hasAudioPlayback ? "cursor-pointer" : ""}`}
        data-testid={`asset-card-${asset.id}`}
        data-featured={featured ? "extension-launch" : undefined}
      >
        <div className="asset-card-media">
          {thumbnailSrc ? (
            <button
              type="button"
              onClick={hasAudioPlayback ? playAudio : openPreview}
              className={`block h-full w-full text-left ${hasAudioPlayback ? "cursor-pointer" : !isAudio || isVideo ? "cursor-zoom-in" : "cursor-default"}`}
              title={hasAudioPlayback ? "Play audio" : isVideo ? "Watch video" : !isAudio ? "Open larger preview" : undefined}
            >
              <PreviewMedia
                src={thumbnailSrc}
                title={asset.title}
                className="asset-card-image h-full w-full object-cover"
              />
            </button>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-3">
              {isAudio ? <AudioLines className="h-8 w-8" /> : <ImageIcon className="h-7 w-7" />}
            </div>
          )}

          <div className="asset-card-sheen" aria-hidden="true" />

          <div className="pointer-events-none absolute left-2.5 top-2.5 z-[2] flex flex-wrap gap-1.5">
            {isPremium && (
              <span className="media-chip chip text-[#ffd66b]">
                <Crown /> Premium
              </span>
            )}
            {isNew && (
              <span className="media-chip chip">
                <span className="dot text-[#30d158]" /> New
              </span>
            )}
            {isUpdated && (
              <span className="media-chip chip">
                <RefreshCw className="text-[#ff9f0a]" /> Updated
              </span>
            )}
          </div>

          {(asset.external_url || asset.has_external_url) && !asset.file_url && (
            <span className="media-chip chip pointer-events-none absolute right-2.5 top-2.5 z-[2]">
              <LinkIcon /> External
            </span>
          )}
          {thumbnailIsVideo && (
            <span className="media-chip chip pointer-events-none absolute bottom-2.5 left-2.5 z-[2] max-sm:hidden">
              <Film /> Motion preview
            </span>
          )}
          {featured && (
            <div className="featured-extension-ribbon">
              <Pin className="h-3 w-3" /> Featured launch
            </div>
          )}

          {(isVideo || hasAudioPlayback) && (
            <div className={`asset-card-play ${isVideo || isActiveAudio ? "is-visible" : ""}`} aria-hidden="true">
              <span>
                {isActiveAudio && globalAudio.playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
              </span>
            </div>
          )}

          {isLockedPremium && (
            <div className="asset-card-lock" data-testid={`premium-lock-${asset.id}`}>
              <span className="media-chip chip h-8 px-3.5 text-[12px]">
                <LockKeyhole className="text-[#ffd66b]" /> Premium locked
              </span>
            </div>
          )}

          {isActiveAudio && globalAudio.playing && (
            <div className="asset-card-eq" aria-hidden="true">
              <i /><i /><i /><i />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium sm:gap-3 sm:text-[12px]">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-ink-2">
              <span className="dot shrink-0" style={{ color: color.text }} />
              {asset.category}
            </span>
            {!isVideo ? (
              <span className="inline-flex items-center gap-1 tabular-nums text-ink-3" title="Downloads">
                <Download className="h-3.5 w-3.5" />
                {downloadCount}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 tabular-nums text-ink-3" title="Views">
                <Eye className="h-3.5 w-3.5" />
                {viewCount}
              </span>
            )}
          </div>

          <h3 className="mt-1 line-clamp-2 break-words font-display text-[14.5px] font-semibold leading-snug tracking-[-0.02em] text-ink sm:mt-1.5 sm:line-clamp-1 sm:text-[17px]">
            {asset.title}
          </h3>

          {isPremium && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-2 sm:text-[12.5px]">
              <Crown className="h-3.5 w-3.5 text-[#ffb340]" /> Included with membership
            </p>
          )}

          {metaParts.length > 0 && (
            <p className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-3 sm:text-[12.5px]">{metaParts.join(" · ")}</p>
          )}

          {asset.description && (
            <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2 max-sm:hidden">{asset.description}</p>
          )}

          <div className="mt-auto flex flex-wrap gap-2 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={isLockedPremium ? openPremium : download}
              disabled={downloading}
              className={`btn btn-sm min-w-0 flex-1 ${isLockedPremium ? "btn-secondary" : isActiveAudio ? "btn-primary" : "btn-tinted"}`}
              data-testid={`download-btn-${asset.id}`}
            >
              <ActionIcon />
              <span className="truncate">{actionLabel}</span>
            </button>
            {isUploader && !isLockedPremium && (
              <>
                <button
                  type="button"
                  onClick={duplicate}
                  disabled={duplicating}
                  className="btn btn-sm btn-secondary btn-icon"
                  data-testid={`duplicate-btn-${asset.id}`}
                  title="Duplicate"
                  aria-label="Duplicate"
                >
                  <Copy />
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="btn btn-sm btn-secondary btn-icon"
                  data-testid={`edit-btn-${asset.id}`}
                  title="Edit"
                  aria-label="Edit"
                >
                  <Pencil />
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={remove}
                    className="btn btn-sm btn-danger btn-icon"
                    data-testid={`delete-btn-${asset.id}`}
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {isUploader && !isLockedPremium && (
          <UploadModal
            open={editOpen}
            onOpenChange={setEditOpen}
            editing={asset}
            onSaved={onChanged}
          />
        )}
      </div>

      {!isAudio && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <p className="eyebrow eyebrow-c inline-flex items-center gap-1.5" style={{ "--c": color.text }}>
                <span className="dot" /> {asset.category}
              </p>
              <DialogTitle className="flex items-center gap-2 font-display text-2xl font-semibold tracking-[-0.025em]">
                {isPremium && <Crown className="h-5 w-5 text-[#ff9f0a]" />}
                {asset.title}
              </DialogTitle>
              <DialogDescription>
                {isVideo ? "YouTube playback" : isPremium ? "Included with membership" : asset.category}
              </DialogDescription>
            </DialogHeader>
            {isVideo && youtubeEmbed ? (
              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-[var(--shadow-card)]">
                <iframe
                  src={youtubeEmbed}
                  title={asset.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : thumbnailSrc ? (
              thumbnailIsVideo ? (
                <video
                  src={thumbnailSrc}
                  className="max-h-[60vh] w-full rounded-2xl bg-[var(--fill)] object-contain"
                  controls
                  muted
                  loop
                  playsInline
                  autoPlay
                />
              ) : (
                <img
                  src={thumbnailSrc}
                  alt={asset.title}
                  className="max-h-[60vh] w-full rounded-2xl bg-[var(--fill)] object-contain"
                />
              )
            ) : (
              <div className="flex min-h-72 items-center justify-center rounded-2xl bg-[var(--fill)] text-ink-3">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
            {asset.description && <p className="text-[15px] leading-relaxed text-ink-2">{asset.description}</p>}

            {relatedAssets.length > 0 && (
              <div className="border-t border-[var(--line)] pt-5">
                <h4 className="mb-3 font-display text-[15px] font-semibold text-ink">Related assets</h4>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {relatedAssets.map((related) => {
                    const relatedThumb = related.thumbnail_url ? buildFileUrl(related.thumbnail_url) : "";
                    return (
                      <div key={related.id} className="overflow-hidden rounded-2xl bg-[var(--fill)]">
                        <div className="aspect-video">
                          {relatedThumb ? (
                            <PreviewMedia src={relatedThumb} title={related.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-ink-3">No preview</div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="line-clamp-1 text-[13px] font-semibold text-ink">{related.title}</p>
                          <p className="line-clamp-1 text-[11.5px] text-ink-3">{related.creator_tag || related.category}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
