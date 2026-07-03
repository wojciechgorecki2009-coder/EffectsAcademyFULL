import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Crown, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const BENEFITS = [
  "All premium assets included with membership",
  "Unlimited premium asset downloads",
  "10 AI text generator credits every week",
  "Higher quality AI text image generations",
  "New exclusive drops every month",
  "Subscription tied securely to your Google account",
  "Manage or cancel anytime through Stripe",
];

const checkoutErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data?.detail) return data.detail;
  if (err?.message) return err.message;
  return fallback;
};

export default function PremiumPage() {
  const { user, hasPremium, config, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");

  useEffect(() => {
    if (checkoutState !== "success" || !checkoutSessionId) return;
    let active = true;
    setBusy(true);
    api.post("/billing/confirm-checkout", { session_id: checkoutSessionId })
      .then(() => refreshUser())
      .catch((err) => {
        if (active) setError(checkoutErrorMessage(err, "Payment succeeded, but Premium is still being confirmed."));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [checkoutState, checkoutSessionId, refreshUser]);

  const subscribe = async () => {
    if (!user) {
      navigate("/login?returnTo=/premium");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/billing/create-checkout-session");
      if (!data.url) throw new Error("No checkout URL returned");
      window.location.assign(data.url);
    } catch (err) {
      setError(checkoutErrorMessage(err, "Unable to start Stripe Checkout."));
      setBusy(false);
    }
  };

  const manageSubscription = async () => {
    if (!user) {
      navigate("/login?returnTo=/premium");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/billing/create-portal-session");
      if (!data.url) throw new Error("No portal URL returned");
      window.location.assign(data.url);
    } catch (err) {
      setError(checkoutErrorMessage(err, "Unable to open Stripe billing portal."));
      setBusy(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-4rem)] pt-28 pb-20 px-6" data-testid="premium-page">
      <div className="max-w-5xl mx-auto">
        <Link to="/category/premium" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Premium assets
        </Link>

        {checkoutState === "configuration-required" && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-amber-100" data-testid="stripe-config-notice">
            Stripe Checkout is ready in the code. Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> to connect the live account.
          </div>
        )}
        {checkoutState === "cancelled" && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-zinc-300">Checkout was cancelled. Nothing was charged.</div>
        )}
        {checkoutState === "success" && (
          <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-emerald-100">
            Payment received. Premium access is being activated for your signed-in account.
          </div>
        )}

        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-8 items-stretch">
          <div className="rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-950/70 via-[#11101c] to-[#07070d] p-8 md:p-12 overflow-hidden relative">
            <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-300/10 px-4 py-1.5 text-sm text-purple-200">
                <Crown className="w-4 h-4" /> Effects Academy Premium
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-black tracking-tighter mt-6">Unlock the whole vault.</h1>
              <p className="text-zinc-300 mt-5 max-w-xl text-lg leading-relaxed">
                Premium packs, project files, presets, curated resources, higher quality AI text images, and more AI text generator credits included with your monthly membership.
              </p>
              <div className="mt-8 flex items-end gap-2">
                <span className="font-display text-5xl font-black">$5.99</span>
                <span className="text-zinc-400 pb-1">USD / month</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[var(--site-panel)] p-8 md:p-10 flex flex-col transition-colors duration-300">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-neon/10 border border-neon/20 flex items-center justify-center">
                {hasPremium ? <Sparkles className="w-5 h-5 text-neon" /> : <LockKeyhole className="w-5 h-5 text-neon" />}
              </div>
              <div>
                <p className="font-semibold">{hasPremium ? "Premium is active" : "Monthly membership"}</p>
                <p className="text-sm text-zinc-500">{user ? `Signed in as ${user.email}` : "Google sign-in required"}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-purple-300/20 bg-purple-300/10 px-4 py-3 text-sm text-purple-100 flex items-center gap-2">
              <Crown className="w-4 h-4 flex-shrink-0" /> Included with membership: every Premium asset plus 10 higher-quality AI text generations per week.
            </div>

            <ul className="space-y-4 mt-6 flex-1">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-zinc-300">
                  <span className="w-6 h-6 rounded-full bg-emerald-400/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>

            <button
              onClick={hasPremium ? manageSubscription : subscribe}
              disabled={busy}
              className="mt-8 w-full rounded-xl bg-neon hover:bg-neon/90 disabled:bg-white/10 disabled:text-zinc-500 text-white font-bold py-3.5 btn-press"
              data-testid="premium-checkout-button"
            >
              {busy ? "Opening Stripe..." : hasPremium ? "Manage subscription" : user ? "Subscribe with Stripe" : "Sign in with Google"}
            </button>
            {!hasPremium && user && (
              <p className="text-xs text-zinc-500 mt-3 text-center">After subscribing, this button becomes Manage subscription.</p>
            )}
            {!config.stripe_configured && config.dev_login_enabled && (
              <p className="text-xs text-zinc-500 mt-3 text-center">Local preview mode — no payment will be submitted.</p>
            )}
            {error && <p className="text-sm text-red-400 mt-3" data-testid="checkout-error">{error}</p>}
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-600 mt-5">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure checkout hosted by Stripe
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
