import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Pencil, Trash2, Link as LinkIcon, LockKeyhole } from "lucide-react";
import { CATEGORY_COLORS, api, buildFileUrl, buildDownloadUrl, deriveDownloadFilename, getAuthToken, getPass } from "@/lib/api";
import { useUploadAccess } from "@/lib/uploadAccess";
import { useAuth } from "@/lib/auth";
import AudioPlayer from "@/components/AudioPlayer";
import UploadModal from "@/components/UploadModal";
import { toast } from "sonner";

export default function AssetCard({ asset, onChanged }) {
  const { isUploader } = useUploadAccess();
  const { hasPremium } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [editOpen, setEditOpen] = useState(false);
  const color = CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.Overlays;
  const isAudio = asset.category === "Audios" || asset.category === "Sound FX";
  const isLockedPremium = asset.category === "Premium" && !isUploader && !hasPremium;

  const openPremium = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    navigate(`/premium?asset=${encodeURIComponent(asset.id)}`);
  };

  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.03)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "perspective(900px) rotateY(0) rotateX(0) scale(1)";
  };

  const download = async () => {
    try {
      await api.post(`/assets/${asset.id}/download`);
    } catch {}
    if (asset.file_url) {
      const fname = deriveDownloadFilename(asset);
      const a = document.createElement("a");
      a.href = buildDownloadUrl(asset.file_url, fname);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (asset.external_url) {
      window.open(asset.external_url, "_blank", "noopener");
    } else {
      toast.error("No download available.");
    }
    onChanged?.();
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

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={isLockedPremium ? openPremium : undefined}
      role={isLockedPremium ? "button" : undefined}
      tabIndex={isLockedPremium ? 0 : undefined}
      onKeyDown={isLockedPremium ? (e) => { if (e.key === "Enter" || e.key === " ") openPremium(e); } : undefined}
      className={`tilt-card group rounded-2xl overflow-hidden bg-[var(--site-surface)] backdrop-blur-xl border border-white/5 hover:border-white/15 transition-colors fade-in ${isLockedPremium ? "cursor-pointer" : ""}`}
      data-testid={`asset-card-${asset.id}`}
    >
      <div className="aspect-video w-full bg-black/40 overflow-hidden relative">
        {asset.thumbnail_url ? (
          <img
            src={buildFileUrl(asset.thumbnail_url, asset.category === "Premium" && hasPremium ? getAuthToken() : "", asset.category === "Premium" && isUploader ? getPass() : "")}
            alt={asset.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700 text-sm">
            No preview
          </div>
        )}
        {asset.external_url && !asset.file_url && (
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
            {asset.download_count}
          </div>
        </div>

        <h3 className="font-display font-semibold text-lg leading-tight line-clamp-1">
          {asset.title}
        </h3>

        {asset.creator_tag && (
          <p className="text-xs text-zinc-500">
            {asset.category === "Audios" ? "Audio by " : "By "}
            <span className="text-zinc-300">{asset.creator_tag}</span>
          </p>
        )}
        {asset.ae_version && (
          <p className="text-xs text-zinc-500">AE: <span className="text-zinc-300">{asset.ae_version}</span></p>
        )}
        {asset.bpm && (
          <p className="text-xs text-zinc-500">BPM/Genre: <span className="text-zinc-300">{asset.bpm}</span></p>
        )}

        {asset.description && (
          <p className="text-sm text-zinc-400 line-clamp-2">{asset.description}</p>
        )}

        {isAudio && asset.file_url && !isLockedPremium && (
          <AudioPlayer
            src={buildFileUrl(asset.file_url, asset.category === "Premium" ? getAuthToken() : "", asset.category === "Premium" && isUploader ? getPass() : "")}
            title={asset.title}
            onDownload={async () => {
              try {
                await api.post(`/assets/${asset.id}/download`);
                onChanged?.();
              } catch {}
            }}
          />
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={isLockedPremium ? openPremium : download}
            className={`flex-1 ${isLockedPremium ? "bg-purple-500 hover:bg-purple-400" : "bg-neon hover:bg-neon/90"} text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 btn-press`}
            data-testid={`download-btn-${asset.id}`}
          >
            {isLockedPremium ? <LockKeyhole className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {isLockedPremium ? "Unlock Premium" : "Download"}
          </button>
          {isUploader && (
            <>
              <button
                onClick={() => setEditOpen(true)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 rounded-lg btn-press text-zinc-300"
                data-testid={`edit-btn-${asset.id}`}
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
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
  );
}
