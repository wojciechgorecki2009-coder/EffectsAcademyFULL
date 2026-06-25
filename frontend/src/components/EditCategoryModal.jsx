import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function EditCategoryModal({
  open,
  onOpenChange,
  kind,
  label,
  override = {},
  baseTheme,
  baseImage,
  defaultDelete,
  onSaved,
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [colorFrom, setColorFrom] = useState("");
  const [colorTo, setColorTo] = useState("");
  const [accent, setAccent] = useState("");
  const [textColor, setTextColor] = useState("");
  const [blur, setBlur] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setImageUrl(override.image_url || baseImage || "");
    setColorFrom(override.color_from || baseTheme?.from || "#1A1A22");
    setColorTo(override.color_to || baseTheme?.to || "#0A0A10");
    setAccent(override.accent || baseTheme?.accent || "#5257ff");
    setTextColor(override.text_color || baseTheme?.text || "#ffffff");
    setBlur(
      typeof override.blur_px === "number" ? override.blur_px : 0
    );
  }, [open, override, baseTheme, baseImage]);

  const save = async (deleteFlag = false) => {
    if (!label || !kind) return;
    setSaving(true);
    try {
      await api.put(`/category-overrides/${kind}/${encodeURIComponent(label)}`, {
        image_url: imageUrl || "",
        color_from: colorFrom || "",
        color_to: colorTo || "",
        accent: accent || "",
        text_color: textColor || "",
        blur_px: blur,
        deleted: deleteFlag,
      });
      toast.success(deleteFlag ? `Removed "${label}".` : `Updated "${label}".`);
      onSaved?.();
    } catch {
      toast.error("Could not save.");
    }
    setSaving(false);
  };

  const reset = async () => {
    setSaving(true);
    try {
      await api.delete(`/category-overrides/${kind}/${encodeURIComponent(label)}`);
      toast.success("Reset to defaults.");
      onSaved?.();
    } catch {
      toast.error("Reset failed.");
    }
    setSaving(false);
  };

  const uploadImage = async (file) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImageUrl(data.url);
      toast.success("Image uploaded.");
    } catch {
      toast.error("Upload failed.");
    }
    setUploading(false);
  };

  if (!label) return null;

  const fullImageSrc = imageUrl
    ? imageUrl.startsWith("http")
      ? imageUrl
      : `${process.env.REACT_APP_BACKEND_URL}${imageUrl}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass border-white/10 text-white max-w-lg max-h-[92vh] overflow-y-auto"
        data-testid="edit-category-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {defaultDelete ? "Delete Category" : "Customize Category"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            <span className="text-zinc-200 font-semibold">{label}</span>
            {defaultDelete
              ? " — confirm to hide this category from the picker. Existing assets are kept."
              : " — set background image, colors, and blur for this group card."}
          </DialogDescription>
        </DialogHeader>

        {!defaultDelete && (
          <div className="space-y-5">
            {/* Live preview */}
            <div
              className="relative h-32 rounded-xl overflow-hidden border border-white/10"
              style={{
                background: `linear-gradient(135deg, ${colorFrom} 0%, ${colorTo} 100%)`,
              }}
            >
              {fullImageSrc && (
                <img
                  src={fullImageSrc}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    opacity: 0.7,
                    filter: blur > 0 ? `blur(${blur}px)` : "none",
                  }}
                />
              )}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${colorFrom}B3 0%, ${colorTo}E6 100%)`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center font-display text-2xl font-black tracking-tight"
                style={{
                  color: textColor || "#fff",
                  textShadow: "0 2px 24px rgba(0,0,0,0.65)",
                }}>
                {label}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Background Image
              </label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... or upload"
                  className="bg-white/5 border-white/10"
                  data-testid="edit-cat-image-url"
                />
                <label className="cursor-pointer bg-white/5 border border-white/10 px-3 rounded-md flex items-center hover:bg-white/10 btn-press">
                  <Upload className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                  />
                </label>
              </div>
              {uploading && <p className="mt-1 text-xs text-zinc-400">Uploading...</p>}
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Image Blur — {blur}px
              </label>
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={blur}
                onChange={(e) => setBlur(parseFloat(e.target.value))}
                className="audio-slider w-full mt-2"
                style={{ "--pct": `${(blur / 20) * 100}%` }}
                data-testid="edit-cat-blur-slider"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ColorField label="Color Top" value={colorFrom} onChange={setColorFrom} testId="edit-cat-color-from" />
              <ColorField label="Color Bottom" value={colorTo} onChange={setColorTo} testId="edit-cat-color-to" />
              <ColorField label="Accent Glow" value={accent} onChange={setAccent} testId="edit-cat-accent" />
              <ColorField label="Text Color" value={textColor} onChange={setTextColor} testId="edit-cat-text-color" />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => save(false)}
                disabled={saving}
                className="flex-1 bg-neon text-white hover:bg-neon/90 font-semibold btn-press h-11"
                data-testid="edit-cat-save"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={reset}
                disabled={saving}
                variant="ghost"
                className="bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 btn-press"
                title="Reset to defaults"
                data-testid="edit-cat-reset"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {defaultDelete && (
          <Button
            onClick={() => save(true)}
            disabled={saving}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold btn-press h-11"
            data-testid="edit-cat-delete-confirm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {saving ? "Removing..." : `Delete "${label}"`}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ColorField({ label, value, onChange, testId }) {
  return (
    <div>
      <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
        {label}
      </label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded cursor-pointer border border-white/10 bg-transparent shrink-0"
          data-testid={testId}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-white/5 border-white/10 text-xs font-mono h-9"
        />
      </div>
    </div>
  );
}
