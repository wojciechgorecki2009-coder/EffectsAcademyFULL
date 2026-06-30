import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Wand2, UploadCloud, Image as ImageIcon, Download, Crown, ShieldCheck, Sparkles, AlertCircle, Paintbrush, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

function limitLabel(user, usage) {
  if (!user) return "Sign in required";
  if (["active", "trialing"].includes(user.premium_status)) return "Premium plan";
  if (["Admin", "Uploader"].includes(user.role)) return "Moderator tools";
  return "Free viewer";
}

export default function AiImagePage() {
  const { user, config, loading: authLoading } = useAuth();
  const [usage, setUsage] = useState(null);
  const [file, setFile] = useState(null);
  const [replacementText, setReplacementText] = useState("");
  const [styleNotes, setStyleNotes] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [brushSize, setBrushSize] = useState(44);
  const [hasMask, setHasMask] = useState(false);
  const imageRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const drawingRef = useRef(false);

  const requiresMask = config?.ai_image_provider === "recraft";
  const canGenerate = user && file && replacementText.trim() && (!requiresMask || hasMask) && !generating && (usage?.remaining ?? 0) > 0;

  const planCopy = useMemo(() => {
    if (!usage) return "Checking your daily limit...";
    return `${usage.remaining} of ${usage.limit} generations left today`;
  }, [usage]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setHasMask(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const prepareMaskCanvas = () => {
    const img = imageRef.current;
    const canvas = maskCanvasRef.current;
    if (!img || !canvas || !img.naturalWidth || !img.naturalHeight) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  };

  const pointerToCanvas = (e) => {
    const canvas = maskCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const paintMask = (e) => {
    const canvas = maskCanvasRef.current;
    if (!canvas || !drawingRef.current) return;
    const { x, y } = pointerToCanvas(e);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(99, 102, 241, 0.62)";
    ctx.beginPath();
    ctx.arc(x, y, brushSize * (canvas.width / canvas.getBoundingClientRect().width), 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  };

  const createMaskBlob = async () => {
    const source = maskCanvasRef.current;
    if (!source || !hasMask) return null;
    const sourceCtx = source.getContext("2d");
    const pixels = sourceCtx.getImageData(0, 0, source.width, source.height);
    const mask = document.createElement("canvas");
    mask.width = source.width;
    mask.height = source.height;
    const maskCtx = mask.getContext("2d");
    const maskPixels = maskCtx.createImageData(mask.width, mask.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const painted = pixels.data[i + 3] > 8;
      maskPixels.data[i] = painted ? 255 : 0;
      maskPixels.data[i + 1] = painted ? 255 : 0;
      maskPixels.data[i + 2] = painted ? 255 : 0;
      maskPixels.data[i + 3] = 255;
    }
    maskCtx.putImageData(maskPixels, 0, 0);
    return new Promise((resolve) => mask.toBlob(resolve, "image/png"));
  };

  const loadUsage = async () => {
    if (!user) return;
    setUsageLoading(true);
    try {
      const { data } = await api.get("/ai-image/usage");
      setUsage(data);
    } catch {
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const pickFile = (nextFile) => {
    if (!nextFile) return;
    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      toast.error("Upload a PNG, JPG, JPEG, or WEBP image.");
      return;
    }
    if (nextFile.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB.");
      return;
    }
    setResultUrl("");
    setFile(nextFile);
  };

  const generate = async (e) => {
    e.preventDefault();
    if (!canGenerate) return;
    setGenerating(true);
    setResultUrl("");
    try {
      const form = new FormData();
      form.append("image", file);
      const maskBlob = await createMaskBlob();
      if (maskBlob) {
        form.append("mask", maskBlob, "text-mask.png");
      }
      form.append("replacement_text", replacementText.trim());
      form.append("style_notes", styleNotes.trim());
      const { data } = await api.post("/ai-image/edit", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUsage({ used: data.used, limit: data.limit, remaining: data.remaining });
      setResultUrl(`data:${data.mime_type || "image/png"};base64,${data.image_base64}`);
      toast.success("AI image edit generated.");
    } catch (err) {
      const message = err?.response?.data?.detail || "Unable to generate image edit.";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = "effects-academy-ai-edit.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (!authLoading && !user) {
    return (
      <section className="max-w-3xl mx-auto px-6 pt-32 pb-24 page-soft-enter">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 md:p-10 text-center overflow-hidden relative">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-neon/10 blur-3xl rounded-full pointer-events-none" />
          <ShieldCheck className="relative w-10 h-10 text-neon mx-auto mb-4" />
          <h1 className="relative font-display text-3xl md:text-4xl font-black tracking-tight mb-3">
            Sign in to use AI Tools
          </h1>
          <p className="relative text-zinc-400 mb-6">
            We use your Google account to track your daily AI image generation limit.
          </p>
          <Link
            to="/login?returnTo=/ai-image"
            className="relative inline-flex items-center justify-center rounded-xl bg-neon text-black px-5 py-3 font-semibold btn-press"
          >
            Sign in with Google
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1200px] mx-auto px-6 md:px-12 pt-28 pb-24 page-soft-enter">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-md border text-neon bg-neon/10 border-neon/20">
            <Wand2 className="w-3.5 h-3.5" /> AI Tools
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mt-3">
            AI Image Text Editor
          </h1>
          <p className="text-zinc-400 max-w-2xl mt-2">
            Upload an image with text, tell the AI what it should say, and download an edited version.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 min-w-56">
          <div className="flex items-center gap-2 text-sm text-white">
            {["active", "trialing"].includes(user?.premium_status) ? (
              <Crown className="w-4 h-4 text-purple-300" />
            ) : (
              <Sparkles className="w-4 h-4 text-neon" />
            )}
            {limitLabel(user, usage)}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {usageLoading ? "Checking usage..." : planCopy}
          </p>
        </div>
      </div>

      {!config?.ai_image_configured && (
        <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>
            AI Image Generation is not configured on the backend yet. For Recraft, save <code>AI_IMAGE_PROVIDER=recraft</code> and <code>RECRAFT_API_KEY</code> on the Render API service, then redeploy the backend.
          </p>
        </div>
      )}

      <form onSubmit={generate} className="grid lg:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          {previewUrl ? (
            <div className="space-y-4">
              <div className="relative rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Upload preview"
                  onLoad={prepareMaskCanvas}
                  className="block max-h-[420px] w-full object-contain select-none"
                  draggable={false}
                />
                <canvas
                  ref={maskCanvasRef}
                  className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    drawingRef.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    paintMask(e);
                  }}
                  onPointerMove={(e) => {
                    e.preventDefault();
                    paintMask(e);
                  }}
                  onPointerUp={(e) => {
                    drawingRef.current = false;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onPointerCancel={() => {
                    drawingRef.current = false;
                  }}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <Paintbrush className="w-4 h-4 text-neon" /> Brush over the old text
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      The purple area is the only part Recraft should edit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearMask}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white btn-press"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear mask
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">Brush</span>
                  <input
                    type="range"
                    min="18"
                    max="90"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full accent-neon"
                  />
                  <span className="text-xs text-zinc-500 w-10 text-right">{brushSize}px</span>
                </div>
                {!hasMask && (
                  <p className="rounded-xl border border-amber-400/15 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                    Brush over the existing word/logo before generating so Recraft knows exactly what to replace.
                  </p>
                )}
              </div>

              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200 hover:text-white transition-colors">
                Change image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
            </div>
          ) : (
            <label
              className="group flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 hover:bg-white/[0.035] transition-colors overflow-hidden"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickFile(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="text-center px-6">
                <UploadCloud className="w-12 h-12 text-neon mx-auto mb-4" />
                <p className="font-display text-2xl font-bold">Drop an image here</p>
                <p className="text-sm text-zinc-500 mt-2">PNG, JPG, JPEG, or WEBP under 8MB</p>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 space-y-5">
          <div>
            <label className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2 block">
              What should the text say?
            </label>
            <textarea
              value={replacementText}
              onChange={(e) => setReplacementText(e.target.value)}
              maxLength={280}
              placeholder='Example: Change the main title to "Effects Academy Pack"'
              className="w-full min-h-28 rounded-2xl bg-black/30 border border-white/10 p-4 text-white placeholder:text-zinc-600 outline-none focus:border-neon/60"
            />
            <p className="text-xs text-zinc-600 mt-1">{replacementText.length}/280</p>
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2 block">
              Style notes <span className="text-zinc-700 normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={styleNotes}
              onChange={(e) => setStyleNotes(e.target.value)}
              maxLength={700}
              placeholder="Example: Keep the same font, glow, angle, and colour."
              className="w-full min-h-24 rounded-2xl bg-black/30 border border-white/10 p-4 text-white placeholder:text-zinc-600 outline-none focus:border-neon/60"
            />
          </div>

          <button
            type="submit"
            disabled={!canGenerate}
            className="w-full rounded-2xl bg-neon text-black py-4 font-display font-black text-lg btn-press disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? "Generating edit..." : "Generate AI Edit"}
          </button>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
            Free viewers get <span className="text-white">3</span> generations/day, moderators get <span className="text-white">5</span>, and Premium users get <span className="text-white">10</span>.
          </div>
        </div>
      </form>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-display text-2xl font-black tracking-tight flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-neon" /> Result
          </h2>
          <button
            onClick={downloadResult}
            disabled={!resultUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white btn-press disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
        {resultUrl ? (
          <img src={resultUrl} alt="Generated AI edit" className="w-full rounded-2xl border border-white/10 bg-black/30 object-contain max-h-[720px]" />
        ) : (
          <div className="min-h-72 rounded-2xl border border-dashed border-white/10 bg-black/20 flex items-center justify-center text-center px-6">
            <p className="text-zinc-500">
              Your edited image will appear here after generation.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
