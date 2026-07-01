import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, Copy, Download, ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function formatRemaining(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function DownloadAccessPage() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const [access, setAccess] = useState(null);
  const [error, setError] = useState("");
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    let active = true;
    if (loading) return undefined;
    if (!user) {
      setError("Sign in with the same Premium account to open this temporary link.");
      setLoadingAccess(false);
      return undefined;
    }

    setLoadingAccess(true);
    api.get(`/premium-downloads/${token}`)
      .then(({ data }) => {
        if (!active) return;
        setAccess(data);
        setRemaining(data.seconds_remaining || 0);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setAccess(null);
        setError(err?.response?.data?.detail || "This temporary download link is unavailable.");
      })
      .finally(() => {
        if (active) setLoadingAccess(false);
      });

    return () => {
      active = false;
    };
  }, [loading, token, user]);

  useEffect(() => {
    if (!access) return undefined;
    const interval = setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [access]);

  const expired = access && remaining <= 0;
  const progress = useMemo(() => {
    if (!access?.seconds_remaining) return 0;
    return Math.max(0, Math.min(100, (remaining / access.seconds_remaining) * 100));
  }, [access, remaining]);

  const openDownload = () => {
    if (!access?.download_url || expired) return;
    window.open(access.download_url, "_blank", "noopener");
  };

  const copyLink = async () => {
    if (!access?.download_url || expired) return;
    try {
      await navigator.clipboard.writeText(access.download_url);
      toast.success("Temporary Drive link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  };

  return (
    <section className="min-h-[calc(100vh-4rem)] pt-28 pb-20 px-6 overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.28),transparent_58%)] pointer-events-none" />
      <div className="relative max-w-4xl mx-auto">
        <Link to="/category/premium" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-10">
          <ArrowLeft className="w-4 h-4" /> Back to Premium assets
        </Link>

        <div className="text-center mb-10">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-300/20 flex items-center justify-center shadow-[0_0_46px_rgba(168,85,247,0.35)]">
            <Download className="w-8 h-8 text-purple-300" />
          </div>
          <p className="text-xs uppercase tracking-[0.34em] text-purple-300 font-mono mb-3">Premium download manager</p>
          <h1 className="font-display text-4xl md:text-6xl font-black leading-none">
            {access?.title || "Temporary premium link"}
          </h1>
          <p className="text-zinc-400 mt-4 max-w-xl mx-auto">
            This link is generated only after your Premium or moderator access is checked. It expires automatically to help protect premium drops.
          </p>
        </div>

        <div className="glass border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/30">
          {loadingAccess ? (
            <div className="min-h-72 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full border-2 border-purple-300/20 border-t-purple-300 animate-spin mb-5" />
              <h2 className="font-display text-2xl">Checking access...</h2>
              <p className="text-zinc-500 mt-2">One moment while we prepare your temporary link.</p>
            </div>
          ) : error ? (
            <div className="min-h-72 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-400/20 flex items-center justify-center mb-5">
                <LockKeyhole className="w-7 h-7 text-red-300" />
              </div>
              <h2 className="font-display text-2xl">Access unavailable</h2>
              <p className="text-zinc-400 mt-2 max-w-lg">{error}</p>
              <Link to="/premium" className="mt-6 bg-neon hover:bg-neon/90 text-white font-semibold px-6 py-3 rounded-xl btn-press">
                Check Premium
              </Link>
            </div>
          ) : (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200">
                  <Clock3 className="w-4 h-4 text-yellow-300" /> {formatRemaining(remaining)} remaining
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                  <ShieldCheck className="w-4 h-4" /> {access.access_label || "Access checked"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-purple-300/20 bg-purple-400/10 px-4 py-2 text-sm text-purple-200">
                  <LockKeyhole className="w-4 h-4" /> Temporary access
                </span>
              </div>

              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-400 to-neon transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500 font-mono mb-3">Temporary Google Drive link</p>
                <div className="flex flex-col md:flex-row gap-3">
                  <button
                    type="button"
                    onClick={openDownload}
                    disabled={expired}
                    className="flex-1 bg-neon hover:bg-neon/90 disabled:bg-white/10 disabled:text-zinc-500 text-white font-bold rounded-xl py-4 px-5 flex items-center justify-center gap-2 btn-press"
                  >
                    <ExternalLink className="w-5 h-5" />
                    {expired ? "Link expired" : "Open Google Drive"}
                  </button>
                  <button
                    type="button"
                    onClick={copyLink}
                    disabled={expired}
                    className="md:w-44 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-white font-semibold py-4 px-5 flex items-center justify-center gap-2 btn-press"
                  >
                    <Copy className="w-5 h-5" /> Copy
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-4">
                  If this page expires, go back to the Premium asset and press Download again to generate a fresh link.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
