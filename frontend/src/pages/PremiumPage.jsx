import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Crown, LockKeyhole, ShieldCheck, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const BENEFITS = [
  "All premium assets included with membership",
  "Unlimited premium asset downloads",
  "30 AI text generator credits every month",
  "Higher quality AI text image generations",
  "New exclusive drops every month",
  "Subscription tied securely to your Google account",
  "Manage or cancel anytime through Stripe",
];

const COMPARISON_ROWS = [
  { feature: "AI text generator credits", free: "5 / month", premium: "30 / month" },
  { feature: "AI generation storage", free: "Basic recent results", premium: "Saved generation storage" },
  { feature: "AI image quality", free: "Standard generations", premium: "Higher quality generations" },
  { feature: "Premium assets", free: false, premium: true },
  { feature: "Premium presets", free: false, premium: true },
  { feature: "Premium project files", free: false, premium: true },
  { feature: "Premium asset downloads", free: false, premium: "Unlimited" },
  { feature: "Beta feature access", free: false, premium: true },
  { feature: "Exclusive monthly drops", free: false, premium: true },
  { feature: "Subscription management", free: "Not needed", premium: "Manage in Stripe" },
];

const checkoutErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data?.detail) return data.detail;
  if (err?.message) return err.message;
  return fallback;
};

function ComparisonValue({ value, premium = false }) {
  if (value === true) {
    return (
      <span className={`inline-flex items-center gap-2 font-semibold ${premium ? "text-emerald-300" : "text-zinc-300"}`}>
        <span className="w-7 h-7 rounded-full bg-emerald-400/10 border border-emerald-300/20 flex items-center justify-center">
          <Check className="w-4 h-4 text-emerald-300" />
        </span>
        Included
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-2 text-zinc-500">
        <span className="w-7 h-7 rounded-full bg-rose-400/10 border border-rose-300/15 flex items-center justify-center">
          <X className="w-4 h-4 text-rose-300" />
        </span>
        Not included
      </span>
    );
  }
  return <span className={premium ? "font-semibold text-white" : "text-zinc-300"}>{value}</span>;
}

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
      .catch(async (err) => {
        const refreshed = await refreshUser().catch(() => null);
        const premiumActive = ["active", "trialing"].includes(refreshed?.premium_status) || ["Admin", "Uploader"].includes(refreshed?.role);
        if (active && !premiumActive) {
          setError(checkoutErrorMessage(err, "Payment succeeded, but Premium is still being confirmed. Please refresh in a moment."));
        }
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
              <Crown className="w-4 h-4 flex-shrink-0" /> Included with membership: every Premium asset plus 30 higher-quality AI text generations per month.
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

        <div className="mt-10 rounded-3xl border border-white/10 bg-[var(--site-panel)] overflow-hidden">
          <div className="p-6 md:p-8 border-b border-white/10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-300/10 px-3 py-1 text-xs font-semibold text-purple-200 mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Free vs Premium
              </div>
              <h2 className="font-display text-3xl font-black tracking-tight">Compare what you get</h2>
              <p className="text-zinc-400 mt-2 max-w-2xl">
                Free members can browse, download free assets, and test the AI tools. Premium unlocks the full vault, higher AI limits, saved generation storage, and early beta features.
              </p>
            </div>
            <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
              Premium includes <span className="font-bold text-white">30 AI credits/month</span> plus every Premium asset.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-6 md:px-8 py-5 text-xs uppercase tracking-[0.24em] text-zinc-500">Feature</th>
                  <th className="px-6 md:px-8 py-5">
                    <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Free</div>
                    <div className="font-display text-xl font-black text-white mt-1">$0</div>
                  </th>
                  <th className="px-6 md:px-8 py-5 bg-purple-500/5">
                    <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-purple-200">
                      <Crown className="w-4 h-4" /> Premium
                    </div>
                    <div className="font-display text-xl font-black text-white mt-1">$5.99 / month</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 md:px-8 py-5 font-semibold text-white">{row.feature}</td>
                    <td className="px-6 md:px-8 py-5">
                      <ComparisonValue value={row.free} />
                    </td>
                    <td className="px-6 md:px-8 py-5 bg-purple-500/5">
                      <ComparisonValue value={row.premium} premium />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
