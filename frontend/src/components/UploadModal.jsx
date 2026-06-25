import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Upload, ImagePlus, Plus } from "lucide-react";
import { api, CATEGORIES, AUDIO_CREATORS, SHOWS, FILE_BASE } from "@/lib/api";
import { toast } from "sonner";

const initial = {
  title: "",
  description: "",
  category: "Overlays",
  creator_tag: "",
  ae_version: "",
  bpm: "",
  genre: "",
  show_group: "",
  torrent_type: "Show",
  thumbnail_url: "",
  file_url: "",
  original_filename: "",
  external_url: "",
  pack_id: "",
};

async function compressThumbnail(file) {
  if (!file?.type?.startsWith("image/")) return file;

  const imageUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageUrl;
    });

    const maxWidth = 900;
    const scale = Math.min(1, maxWidth / img.width);
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );

    if (!blob) return file;

    return new File(
      [blob],
      file.name.replace(/\.[^.]+$/, "") + "-thumbnail.jpg",
      { type: "image/jpeg" }
    );
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function UploadModal({ open, onOpenChange, editing, onSaved }) {
  const [form, setForm] = useState(editing || initial);
  const [packs, setPacks] = useState([]);
  const [newPackOpen, setNewPackOpen] = useState(false);
  const [newPackName, setNewPackName] = useState("");
  const [uploadingField, setUploadingField] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [knownCreators, setKnownCreators] = useState([]);
  const [knownShows, setKnownShows] = useState([]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadPacks = async (cat) => {
    const { data } = await api.get("/packs", { params: { category: cat } });
    setPacks(data);
  };

  const loadDistincts = async () => {
    try {
      const [cr, sh] = await Promise.all([
        api.get("/distinct/creators"),
        api.get("/distinct/shows"),
      ]);
      setKnownCreators(cr.data || []);
      setKnownShows(sh.data || []);
    } catch {}
  };

  // load packs when category changes
  const setCategory = async (v) => {
    set("category", v);
    await loadPacks(v);
  };

  const uploadFile = async (file, field) => {
    setUploadingField(field);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({
        ...f,
        [field]: data.url,
        ...(field === "file_url" ? { original_filename: data.original_filename || file.name } : {}),
      }));
      toast.success("File uploaded.");
    } catch (e) {
      toast.error("Upload failed.");
    }
    setUploadingField("");
  };

  const uploadThumbnail = async (file) => {
    const compressed = await compressThumbnail(file);
    await uploadFile(compressed, "thumbnail_url");
  };

  const handleThumbnailPaste = async (e) => {
    const file = Array.from(e.clipboardData?.files || []).find((f) =>
      f.type.startsWith("image/")
    );

    if (!file) return;

    e.preventDefault();
    await uploadThumbnail(file);
  };

  const createPack = async () => {
    if (!newPackName.trim()) return;
    try {
      const { data } = await api.post("/packs", {
        name: newPackName.trim(),
        category: form.category,
      });
      setPacks((p) => [data, ...p]);
      set("pack_id", data.id);
      setNewPackName("");
      setNewPackOpen(false);
      toast.success("Pack created.");
    } catch {
      toast.error("Could not create pack.");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!form.file_url && !form.external_url)
      return toast.error("Provide a file upload or external link.");
    setSubmitting(true);
    try {
      if (editing?.id) {
        await api.patch(`/assets/${editing.id}`, form);
        toast.success("Asset updated.");
      } else {
        await api.post("/assets", form);
        toast.success("Asset published.");
      }
      onSaved?.();
      onOpenChange(false);
      setForm(initial);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save.");
    }
    setSubmitting(false);
  };

  const isAudio = form.category === "Audios";
  const isPF = form.category === "Project Files";
  const isTorrent = form.category === "Torrents";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          if (form.category) loadPacks(form.category);
          loadDistincts();
        }
      }}
    >
      <DialogContent
        className="glass border-white/10 text-white max-w-2xl max-h-[92vh] overflow-y-auto"
        data-testid="upload-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editing ? "Edit Asset" : "Upload Asset"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Pick a category, drop a thumbnail, and add a file or external link.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Title
              </label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="bg-white/5 border-white/10 mt-1"
                data-testid="upload-title-input"
              />
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Category
              </label>
              <Select value={form.category} onValueChange={setCategory}>
                <SelectTrigger
                  className="bg-white/5 border-white/10 mt-1"
                  data-testid="upload-category-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass border-white/10 text-white">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Pack / Group
              </label>
              <div className="flex gap-2 mt-1">
                <Select value={form.pack_id || "_none"} onValueChange={(v) => set("pack_id", v === "_none" ? "" : v)}>
                  <SelectTrigger
                    className="bg-white/5 border-white/10"
                    data-testid="upload-pack-select"
                  >
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent className="glass border-white/10 text-white max-h-60">
                    <SelectItem value="_none">None</SelectItem>
                    {packs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setNewPackOpen((v) => !v)}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 btn-press"
                  data-testid="open-new-pack"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {newPackOpen && (
                <div className="flex gap-2 mt-2 fade-in">
                  <Input
                    placeholder="New pack name"
                    value={newPackName}
                    onChange={(e) => setNewPackName(e.target.value)}
                    className="bg-white/5 border-white/10"
                    data-testid="new-pack-name-input"
                  />
                  <Button
                    type="button"
                    onClick={createPack}
                    className="bg-neon text-[#05050A] hover:bg-neon/90 btn-press"
                    data-testid="create-pack-btn"
                  >
                    Create
                  </Button>
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Description
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                className="bg-white/5 border-white/10 mt-1 resize-none"
                data-testid="upload-description-input"
              />
            </div>

            {isAudio && (
              <>
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                    Creator (type to add a new one)
                  </label>
                  <Input
                    list="creator-suggestions"
                    value={form.creator_tag}
                    onChange={(e) => set("creator_tag", e.target.value)}
                    placeholder="e.g. MRBIT AUDIOS or your own"
                    className="bg-white/5 border-white/10 mt-1"
                    data-testid="upload-creator-input"
                  />
                  <datalist id="creator-suggestions">
                    {[
                      ...AUDIO_CREATORS,
                      ...knownCreators.filter((c) => !AUDIO_CREATORS.includes(c)),
                    ].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                    BPM / Genre
                  </label>
                  <Input
                    value={form.bpm}
                    onChange={(e) => set("bpm", e.target.value)}
                    className="bg-white/5 border-white/10 mt-1"
                  />
                </div>
              </>
            )}

            {!isAudio && (
              <div className="col-span-2">
                <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  Creator Tag
                </label>
                <Input
                  value={form.creator_tag}
                  onChange={(e) => set("creator_tag", e.target.value)}
                  placeholder="e.g. mrbit_100"
                  className="bg-white/5 border-white/10 mt-1"
                />
              </div>
            )}

            {isPF && (
              <div>
                <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  AE Version
                </label>
                <Input
                  value={form.ae_version}
                  onChange={(e) => set("ae_version", e.target.value)}
                  placeholder="e.g. After Effects 2024"
                  className="bg-white/5 border-white/10 mt-1"
                />
              </div>
            )}

            {isTorrent && (
              <>
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                    Type
                  </label>
                  <Select
                    value={form.torrent_type || "Show"}
                    onValueChange={(v) => set("torrent_type", v)}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 mt-1" data-testid="upload-torrent-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass border-white/10 text-white">
                      <SelectItem value="Show">Show</SelectItem>
                      <SelectItem value="Movie">Movie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.torrent_type !== "Movie" && (
                  <div>
                    <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                      Show (type to add a new one)
                    </label>
                    <Input
                      list="show-suggestions"
                      value={form.show_group}
                      onChange={(e) => set("show_group", e.target.value)}
                      placeholder="e.g. The Boys or your own"
                      className="bg-white/5 border-white/10 mt-1"
                      data-testid="upload-show-input"
                    />
                    <datalist id="show-suggestions">
                      {[
                        ...SHOWS,
                        ...knownShows.filter((s) => !SHOWS.includes(s)),
                      ].map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                )}
              </>
            )}

            <div className="col-span-2" onPaste={handleThumbnailPaste}>
              <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Thumbnail URL
              </label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={form.thumbnail_url}
                  onChange={(e) => set("thumbnail_url", e.target.value)}
                  placeholder="https://... or upload"
                  className="bg-white/5 border-white/10"
                  data-testid="upload-thumbnail-url"
                />
                <label className="cursor-pointer bg-white/5 border border-white/10 px-3 rounded-md flex items-center hover:bg-white/10 btn-press">
                  <ImagePlus className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      uploadThumbnail(e.target.files[0])
                    }
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Tip: after using Snipping Tool, click the thumbnail field and press Ctrl+V to paste a compressed thumbnail.
              </p>
              {form.thumbnail_url && (
                <img
                  src={form.thumbnail_url.startsWith("http") ? form.thumbnail_url : `${FILE_BASE}${form.thumbnail_url}`}
                  alt=""
                  className="mt-2 w-full max-h-44 object-cover rounded-lg border border-white/10"
                />
              )}
            </div>

            {isAudio && (
              <div className="col-span-2">
                <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  Audio Preview (mp3/wav)
                </label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={form.audio_preview_url}
                    onChange={(e) => set("audio_preview_url", e.target.value)}
                    placeholder="Optional direct audio file"
                    className="bg-white/5 border-white/10"
                  />
                  <label className="cursor-pointer bg-white/5 border border-white/10 px-3 rounded-md flex items-center hover:bg-white/10 btn-press">
                    <Upload className="w-4 h-4" />
                    <input
                      type="file"
                      accept="audio/*"
                      hidden
                      onChange={(e) =>
                        e.target.files?.[0] &&
                        uploadFile(e.target.files[0], "audio_preview_url")
                      }
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="col-span-2 grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-white/5">
              <div>
                <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  File Upload (≤ 50MB)
                </label>
                <label className="mt-1 flex items-center justify-center gap-2 h-11 cursor-pointer bg-white/5 border border-dashed border-white/15 rounded-md hover:bg-white/10 btn-press text-sm text-zinc-300">
                  <Upload className="w-4 h-4" />
                  {uploadingField === "file_url"
                    ? "Uploading..."
                    : form.file_url
                    ? "File ready ✓"
                    : "Click to upload"}
                  <input
                    type="file"
                    hidden
                    onChange={(e) =>
                      e.target.files?.[0] && uploadFile(e.target.files[0], "file_url")
                    }
                  />
                </label>
              </div>
              <div>
                <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  External URL (Drive / Mega)
                </label>
                <Input
                  value={form.external_url}
                  onChange={(e) => set("external_url", e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="bg-white/5 border-white/10 mt-1"
                  data-testid="upload-external-url"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-neon text-[#05050A] hover:bg-neon/90 font-semibold btn-press h-11"
            data-testid="upload-submit-btn"
          >
            {submitting ? "Saving..." : editing ? "Save Changes" : "Publish Asset"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
