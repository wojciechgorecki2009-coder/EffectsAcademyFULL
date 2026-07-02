import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Copy, Download, ImageIcon, Link as LinkIcon, LockKeyhole, Pencil, Sparkles, Trash2 } from "lucide-react";
import { CATEGORY_COLORS, api, buildFileUrl, buildDownloadUrl, deriveDownloadFilename, getAuthToken, getPass } from "@/lib/api";
import { useUploadAccess } from "@/lib/uploadAccess";
import { useAuth } from "@/lib/auth";
import AudioPlayer from "@/components/AudioPlayer";
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
  const stamp = asset.created_at || asset.createdAt || asset.updated_at;
  if (!stamp) return false;
  const created = new Date(stamp).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created < 7 * 24 * 60 * 60 * 1000;
};

const isVideoPreview = (url = "") => /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url);

function PreviewMedia({ src, title, className = "", videoClassName = "", imageClassName = "" }) {
  if (!src) return null;
  if (isVideoPreview(src)) {
    return (
      <video
        src={src}
        className={`${className} ${videoClassName}`}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
      />
    );
  }

  return (
    <img
      src={src}
      alt={title || "Asset preview"}
      className={`${className} ${imageClassName}`}
    />
  );
}

async function downloadUrlWithoutLeavingPage(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download request failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename || "download";
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  } catch (error) {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = "Download";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 60000);
  }
}

export default function AssetCard({ asset, onChanged, allAssets = [] }) {
  const { isUploader } = useUploadAccess();
  const { hasPremium } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadCount, setDownloadCount] = useState(asset.download_count || 0);
  const color = CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.Overlays;
  const isAudio = asset.category === "Audios";
  const isSoundEffect = asset.category === "Sound FX";
  const isPremium = asset.category === "Premium";
  const isNew = isRecentlyAdded(asset);
  const isLockedPremium = isPremium && !isUploader && !hasPremium;
  const thumbnailSrc = asset.thumbnail_url
    ? buildFileUrl(asset.thumbnail_url, isPremium && hasPremium ? getAuthToken() : "", isPremium && isUploader ? getPass() : "")
    : "";
  const fileSrc = asset.file_url
    ? buildFileUrl(asset.file_url, isPremium ? getAuthToken() : "", isPremium && isUploader ? getPass() : "")
    : "";
  const displayGenre = asset.genre || (isAudio ? asset.bpm : "");
  const thumbnailIsVideo = isVideoPreview(thumbnailSrc);

  useEffect(() => {
    setDownloadCount(asset.download_count || 0);
  }, [asset.download_count]);

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

  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const pointerX = (e.clientX - r.left) / r.width;
    const pointerY = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty("--asset-glow-x", `${Math.round(pointerX * 100)}%`);
    ref.current.style.setProperty("--asset-glow-y", `${Math.round(pointerY * 100)}%`);
  };
  const onLeave = () => {
    if (!ref.current) return;
    ref.current.style.setProperty("--asset-glow-x", "50%");
    ref.current.style.setProperty("--asset-glow-y", "18%");
  };

  const download = async () => {
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
    if (!isAudio && thumbnailSrc) setPreviewOpen(true);
  };

  return (
    <>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={isLockedPremium ? openPremium : undefined}
        role={isLockedPremium ? "button" : undefined}
        tabIndex={isLockedPremium ? 0 : undefined}
        onKeyDown={isLockedPremium ? (e) => { if (e.key === "Enter" || e.key === " ") openPremium(e); } : undefined}
        className={`tilt-card group rounded-2xl overflow-hidden bg-[var(--site-surface)] backdrop-blur-xl border transition-all duration-300 fade-in ${isPremium ? "border-purple-300/20 shadow-[0_0_32px_rgba(168,85,247,0.13)] hover:border-purple-300/40" : "border-white/5 hover:border-white/15 hover:shadow-[0_18px_50px_rgba(0,0,0,0.28)]"} ${isLockedPremium ? "cursor-pointer" : ""}`}
        data-testid={`asset-card-${asset.id}`}
      >
        <div className="aspect-video w-full bg-black/40 overflow-hidden relative">
          {isPremium && <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-br from-purple-400/10 via-transparent to-transparent opacity-80" />}
          {thumbnailSrc ? (
            <button
              type="button"
              onClick={openPreview}
              disabled={isAudio}
              className={`block w-full h-full text-left ${!isAudio ? "cursor-zoom-in" : "cursor-default"}`}
              title={!isAudio ? "Open larger preview" : undefined}
            >
              <PreviewMedia
                src={thumbnailSrc}
                title={asset.title}
                className="w-full h-full object-cover"
              />
            </button>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700 text-sm">
              No preview
            </div>
          )}
          {thumbnailIsVideo && (
            <div className="absolute bottom-3 left-3 z-[2] bg-black/65 text-[10px] font-mono px-2 py-1 rounded-full text-white border border-white/10">
              VIDEO PREVIEW
            </div>
          )}
          <div className="absolute top-3 left-3 z-[2] flex flex-wrap gap-2">
            {isPremium && (
              <div className="bg-purple-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg shadow-purple-950/40">
                <Crown className="w-3 h-3" /> PREMIUM
              </div>
            )}
            {isNew && (
              <div className="bg-emerald-400/90 text-black text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg shadow-emerald-950/30">
                <Sparkles className="w-3 h-3" /> NEW
              </div>
            )}
          </div>
          {(asset.external_url || asset.has_external_url) && !asset.file_url && (
            <div className="absolute top-3 right-3 bg-black/60 text-[10px] font-mono px-2 py-1 rounded-full flex items-center gap-1 text-white border border-white/10">
              <LinkIcon className="w-3 h-3" />
              EXTERNAL
            </div>
          )}
          {isLockedPremium && (
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center" data-testid={`premium-lock-${asset.id}`}>
              <div className="rounded-full border border-white/15 bg-black/70 px-4 py-2 flex items-center gap-2 text-sm font-semibold text-white">
                <LockKeyhole className="w-4 h-4 text-purple-300" /> Premium locked
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md border"
              style={{ color: color.text, background: color.bg, borderColor: color.border }}
            >
              {asset.category}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
              <Download className="w-3.5 h-3.5" />
              {downloadCount}
            </div>
          </div>

          <h3 className="font-display font-semibold text-lg leading-tight line-clamp-1">
            {asset.title}
          </h3>

          {isPremium && (
            <p className="text-xs text-purple-200 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Included with membership
            </p>
          )}

          {asset.creator_tag && (
            <p className="text-xs text-zinc-500">
              {asset.category === "Audios" ? "Audio by " : "By "}
              <span className="text-zinc-300">{asset.creator_tag}</span>
            </p>
          )}
          {asset.ae_version && (
            <p className="text-xs text-zinc-500">AE: <span className="text-zinc-300">{asset.ae_version}</span></p>
          )}
          {displayGenre && (
            <p className="text-xs text-zinc-500">Genre: <span className="text-zinc-300">{displayGenre}</span></p>
          )}

          {asset.description && (
            <p className="text-sm text-zinc-400 line-clamp-2">{asset.description}</p>
          )}

          {isAudio && asset.file_url && !isLockedPremium && (
            <AudioPlayer
              src={fileSrc}
              title={asset.title}
              allowSlowedDownloads={!isSoundEffect}
              onDownload={async () => {
                toast.success("Starting download...");
                recordDownload();
              }}
            />
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={isLockedPremium ? openPremium : download}
              disabled={downloading}
              className={`flex-1 ${isLockedPremium ? "bg-purple-500 hover:bg-purple-400" : "bg-neon hover:bg-neon/90"} text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 btn-press disabled:opacity-70`}
              data-testid={`download-btn-${asset.id}`}
            >
              {isLockedPremium ? <LockKeyhole className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              {isLockedPremium ? "Unlock Premium" : downloading ? "Downloading..." : "Download"}
            </button>
            {isUploader && (
              <>
                <button
                  type="button"
                  onClick={duplicate}
                  disabled={duplicating}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 rounded-lg btn-press text-zinc-300 disabled:opacity-50"
                  data-testid={`duplicate-btn-${asset.id}`}
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 rounded-lg btn-press text-zinc-300"
                  data-testid={`edit-btn-${asset.id}`}
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 rounded-lg btn-press text-red-400"
                  data-testid={`delete-btn-${asset.id}`}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {isUploader && (
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
          <DialogContent className="glass border-white/10 text-white max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl flex items-center gap-2">
                {isPremium && <Crown className="w-5 h-5 text-purple-300" />}
                {asset.title}
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                {isPremium ? "Included with membership" : asset.category}
              </DialogDescription>
            </DialogHeader>
            {thumbnailSrc ? (
              thumbnailIsVideo ? (
                <video
                  src={thumbnailSrc}
                  className="w-full max-h-[60vh] object-contain rounded-2xl border border-white/10 bg-black/40"
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
                  className="w-full max-h-[60vh] object-contain rounded-2xl border border-white/10 bg-black/40"
                />
              )
            ) : (
              <div className="min-h-72 rounded-2xl border border-white/10 bg-black/40 flex items-center justify-center text-zinc-500">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}
            {asset.description && <p className="text-sm text-zinc-300 leading-relaxed">{asset.description}</p>}

            {relatedAssets.length > 0 && (
              <div className="pt-4 border-t border-white/10">
                <h4 className="font-display font-semibold mb-3">Related assets</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {relatedAssets.map((related) => {
                    const relatedThumb = related.thumbnail_url ? buildFileUrl(related.thumbnail_url) : "";
                    return (
                      <div key={related.id} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <div className="aspect-video bg-black/40">
                          {relatedThumb ? (
                            <PreviewMedia src={relatedThumb} title={related.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No preview</div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold line-clamp-1">{related.title}</p>
                          <p className="text-[11px] text-zinc-500 line-clamp-1">{related.creator_tag || related.category}</p>
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
