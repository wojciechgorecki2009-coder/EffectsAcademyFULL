import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Wand2, UploadCloud, Image as ImageIcon, Download, Crown, ShieldCheck, Sparkles, AlertCircle, Loader2 } from "lucide-react";
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const hasGenerations = usage?.unlimited || (usage?.remaining ?? 0) > 0;
  const canGenerate = user && file && replacementText.trim() && !generating && hasGenerations;

  const planCopy = useMemo(() => {
    if (!usage) return "Checking your daily limit...";
    if (usage.unlimited) return "Unlimited generations for moderators";
    return `${usage.remaining} of ${usage.limit} generations left today`;
  }, [usage]);

  useEffect(() => {
    if (!generating) return;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
      form.append("replacement_text", replacementText.trim());
      form.append("style_notes", styleNotes.trim());
      const { data } = await api.post("/ai-image/edit", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUsage({ used: data.used, limit: data.limit, remaining: data.remaining, unlimited: data.unlimited });
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
            Fal Nano Banana image generation is not configured on the backend yet. Make sure <code>FAL_KEY</code> is saved on the Render API service and redeploy the backend.
          </p>
        </div>
      )}

      <form onSubmit={generate} className="grid lg:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <label
            className="group flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 hover:bg-white/[0.035] transition-colors overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Upload preview" className="h-full max-h-[420px] w-full object-contain" />
            ) : (
              <div className="text-center px-6">
                <UploadCloud className="w-12 h-12 text-neon mx-auto mb-4" />
                <p className="font-display text-2xl font-bold">Drop an image here</p>
                <p className="text-sm text-zinc-500 mt-2">PNG, JPG, JPEG, or WEBP under 8MB</p>
              </div>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </label>
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
            className="relative w-full overflow-hidden rounded-2xl bg-neon text-black py-4 font-display font-black text-lg btn-press disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating && (
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse" />
            )}
            <span className="relative inline-flex items-center justify-center gap-2">
              {generating && <Loader2 className="w-5 h-5 animate-spin" />}
              {generating ? `Generating Ai Text... ${elapsedSeconds}s` : "Generate Ai Text"}
            </span>
          </button>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
            Free users get <span className="text-white">3</span> Nano Banana generations/day. Premium users get <span className="text-white">10</span> Nano Banana 2 generations/day.
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
        {generating ? (
          <div className="min-h-72 rounded-2xl border border-dashed border-neon/20 bg-black/20 flex flex-col items-center justify-center text-center px-6 overflow-hidden relative">
            <div className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent animate-pulse" />
            <Loader2 className="relative w-10 h-10 text-neon animate-spin mb-4" />
            <p className="relative font-display text-xl font-black text-white">Generating your Ai text edit</p>
            <p className="relative text-sm text-zinc-500 mt-2">
              This usually takes around 20–60 seconds. Running for {elapsedSeconds}s.
            </p>
          </div>
        ) : resultUrl ? (
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
