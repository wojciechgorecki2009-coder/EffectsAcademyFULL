import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BadgePercent, Check, Crown, KeyRound, LockKeyhole, MousePointerClick, ShieldCheck, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { hasPremiumAccess, useAuth } from "@/lib/auth";
import TwitchIcon from "@/components/TwitchIcon";

const BENEFITS = [
  "All premium assets included with membership",
  "Unlimited premium asset downloads",
  "30 AI text generator credits every month",
  "Higher quality AI text image generations",
  "New exclusive drops every month",
  "Subscription tied securely to your Google account",
  "Manage or cancel anytime through Stripe",
  "If you cancel, Premium stays active until the paid billing period ends",
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

const PREMIUM_PRICE = 9.99;

const checkoutErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data?.detail) return data.detail;
  if (err?.message) return err.message;
  return fallback;
};

const twitchMessage = (state, broadcaster = "mrbit100", discount = 15) => {
  if (state === "linked") return `Twitch linked. Subscriber discount unlocked for ${discount}% off Premium.`;
  if (state === "not_subscribed") return `Twitch linked, but that account is not currently subscribed to ${broadcaster}.`;
  if (state === "cancelled") return "Twitch linking was cancelled.";
  if (state === "disconnected") return "Twitch account disconnected.";
  if (state === "expired") return "Twitch linking expired. Please try again.";
  if (state === "error") return "Twitch could not verify the subscription. Please try again.";
  return "";
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
  const [extensionPairingCode, setExtensionPairingCode] = useState("");
  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");
  const twitchState = searchParams.get("twitch");
  const twitchNotice = twitchMessage(
    twitchState,
    config.twitch_broadcaster_login,
    config.twitch_discount_percent
  );
  const twitchDiscountPercent = Number(config.twitch_discount_percent || user?.twitch_discount_percent || 15);
  const activePromotion = config.active_premium_promotion;
  const promotionPercent = Number(activePromotion?.percent_off || 0);
  const hasPromotionDiscount = Boolean(activePromotion && promotionPercent > 0);
  const hasTwitchDiscount = Boolean(user?.twitch_discount_eligible && config.stripe_twitch_coupon_configured && !hasPremium);
  const bestDiscountPercent = Math.max(hasTwitchDiscount ? twitchDiscountPercent : 0, hasPromotionDiscount ? promotionPercent : 0);
  const discountSource = bestDiscountPercent > 0
    ? (hasPromotionDiscount && promotionPercent >= (hasTwitchDiscount ? twitchDiscountPercent : 0) ? "promotion" : "twitch")
    : "";
  const discountedPrice = Math.max(0, PREMIUM_PRICE * (1 - bestDiscountPercent / 100));
  const displayPrice = bestDiscountPercent > 0 ? discountedPrice : PREMIUM_PRICE;
  const priceLabel = `$${displayPrice.toFixed(2)}`;

  useEffect(() => {
    if (checkoutState !== "success" || !checkoutSessionId) return;
    let active = true;
    setBusy(true);
    api.post("/billing/confirm-checkout", { session_id: checkoutSessionId })
      .then(() => refreshUser())
      .catch(async (err) => {
        const refreshed = await refreshUser().catch(() => null);
        const premiumActive = hasPremiumAccess(refreshed);
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

  const connectTwitch = async () => {
    if (!user) {
      navigate("/login?returnTo=/premium");
      return;
    }
    if (!config.twitch_configured) {
      setError("Twitch login is not configured yet. Add the Twitch environment variables in Render first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/twitch/connect");
      if (!data.url) throw new Error("No Twitch login URL returned");
      window.location.assign(data.url);
    } catch (err) {
      setError(checkoutErrorMessage(err, "Unable to start Twitch login."));
      setBusy(false);
    }
  };

  const disconnectTwitch = async () => {
    if (!user?.twitch_login) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/twitch/disconnect");
      await refreshUser();
      navigate("/premium?twitch=disconnected", { replace: true });
    } catch (err) {
      setError(checkoutErrorMessage(err, "Unable to sign out of Twitch."));
    } finally {
      setBusy(false);
    }
  };

  const generateExtensionPairingCode = async () => {
    if (!hasPremium) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/extension/pairing-code");
      setExtensionPairingCode(data.code || "");
    } catch (err) {
      setError(checkoutErrorMessage(err, "Unable to create an After Effects pairing code."));
    } finally {
      setBusy(false);
    }
  };

  const resetExtensionDevice = async () => {
    if (!hasPremium) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/extension/reset-device");
      await refreshUser();
    } catch (err) {
      setError(checkoutErrorMessage(err, "Unable to reset your After Effects extension device."));
    } finally {
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
        {twitchNotice && !hasPremium && (
          <div className={`mb-6 rounded-xl border px-5 py-4 ${
            twitchState === "linked"
              ? "border-purple-400/30 bg-purple-400/10 text-purple-100"
              : "border-amber-400/30 bg-amber-400/10 text-amber-100"
          }`}>
            {twitchNotice}
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
                <div>
                  {bestDiscountPercent > 0 && (
                    <div className="mb-1 flex items-center gap-2 text-sm text-purple-200">
                      <span className="line-through text-zinc-500">${PREMIUM_PRICE.toFixed(2)}</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-purple-300/20 bg-purple-300/10 px-2 py-0.5 text-xs font-semibold">
                        <BadgePercent className="w-3 h-3" /> {discountSource === "promotion" ? activePromotion?.name || "Limited promotion" : "Twitch subscriber price"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <span className="font-display text-5xl font-black">{priceLabel}</span>
                    <span className="text-zinc-400 pb-1">USD / month</span>
                  </div>
                  {bestDiscountPercent > 0 && (
                    <p className="mt-2 text-sm text-purple-100">
                      {discountSource === "promotion"
                        ? `${activePromotion?.name || "Limited promotion"} unlocks ${bestDiscountPercent}% off ${activePromotion?.duration === "forever" ? "Premium." : "your first Premium month."}`
                        : `Your verified Twitch sub unlocks ${bestDiscountPercent}% off Premium.`}
                    </p>
                  )}
                </div>
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

            {!hasPremium && (
              <div className="mt-4 rounded-2xl border border-[#9146FF]/30 bg-[#9146FF]/10 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#9146FF]/20 border border-[#9146FF]/30 flex items-center justify-center flex-shrink-0">
                    <TwitchIcon className="w-5 h-5 text-purple-100" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white flex items-center gap-2">
                      Twitch subscriber discount
                      <span className="inline-flex items-center gap-1 rounded-full border border-purple-300/20 bg-purple-300/10 px-2 py-0.5 text-[11px] text-purple-100">
                        <BadgePercent className="w-3 h-3" /> {twitchDiscountPercent}% off
                      </span>
                    </p>
                    <p className="text-sm text-zinc-400 mt-1">
                      Subscribe to <span className="text-purple-100 font-semibold">{config.twitch_broadcaster_login || "mrbit100"}</span> on Twitch, then link Twitch here before checkout.
                    </p>
                    {user?.twitch_login && (
                      <p className={`text-xs mt-2 ${user.twitch_discount_eligible ? "text-emerald-300" : "text-amber-300"}`}>
                        Linked as {user.twitch_login}. {user.twitch_discount_eligible
                          ? config.stripe_twitch_coupon_configured
                            ? "Discount eligible."
                            : "Twitch verified, but the Stripe coupon is not configured yet."
                          : "Subscriber discount not currently verified."}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={connectTwitch}
                      disabled={busy}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#9146FF] hover:bg-[#772ce8] disabled:bg-white/10 disabled:text-zinc-500 text-white px-4 py-2 text-sm font-semibold btn-press"
                      data-testid="premium-twitch-connect"
                    >
                      <TwitchIcon className="w-4 h-4" />
                      {user?.twitch_discount_eligible ? "Recheck Twitch" : "Link Twitch for discount"}
                    </button>
                    {user?.twitch_login && (
                      <button
                        type="button"
                        onClick={disconnectTwitch}
                        disabled={busy}
                        className="mt-3 ml-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/10 disabled:opacity-50 text-zinc-200 px-4 py-2 text-sm font-semibold btn-press"
                        data-testid="premium-twitch-disconnect"
                      >
                        Sign out of Twitch
                      </button>
                    )}
                    {!config.twitch_configured && (
                      <p className="text-xs text-zinc-500 mt-2">
                        Twitch discount is ready in the code. Add Twitch keys in Render to enable it.
                      </p>
                    )}
                    {config.twitch_configured && user?.twitch_discount_eligible && !config.stripe_twitch_coupon_configured && (
                      <p className="text-xs text-amber-300 mt-2">
                        Add <code>STRIPE_TWITCH_COUPON_ID</code> to the backend in Render before checkout can apply the discount.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

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
            {hasPremium && (
              <div className="mt-4 rounded-2xl border border-purple-300/20 bg-purple-300/10 px-4 py-4">
                <p className="text-sm font-semibold text-white">After Effects extension access</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Generate a short pairing code, then type it into the extension Connection settings. Each Premium account can be linked to one extension install at a time.
                </p>
                <button
                  type="button"
                  onClick={generateExtensionPairingCode}
                  disabled={busy}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 text-zinc-100 px-4 py-2 text-sm font-semibold btn-press"
                  data-testid="generate-extension-code"
                >
                  <KeyRound className="w-4 h-4" />
                  Generate AE pairing code
                </button>
                {extensionPairingCode && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code
                      className="rounded-lg border border-purple-300/20 bg-black/30 px-3 py-2 text-purple-100 tracking-[0.18em] select-all cursor-text"
                      onClick={(event) => {
                        const range = document.createRange();
                        range.selectNodeContents(event.currentTarget);
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                      }}
                      title="Click to select, then press Ctrl+C"
                    >
                      {extensionPairingCode}
                    </code>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <MousePointerClick className="w-3.5 h-3.5" />
                      Click code, then Ctrl+C
                    </span>
                    <p className="w-full text-[11px] text-zinc-500">This code expires in 10 minutes and can only be used once. You can also type it manually.</p>
                  </div>
                )}
                {user?.extension_device_linked && (
                  <button
                    type="button"
                    onClick={resetExtensionDevice}
                    disabled={busy}
                    className="mt-3 ml-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 disabled:opacity-50 text-zinc-100 px-4 py-2 text-sm font-semibold btn-press"
                    data-testid="reset-extension-device"
                  >
                    Reset linked extension
                  </button>
                )}
                {user?.extension_device_linked && (
                  <p className="text-[11px] text-zinc-500 mt-2">
                    This account is already linked to an After Effects install. Reset only if you are moving to a new PC or reinstalling.
                  </p>
                )}
              </div>
            )}

            {hasPromotionDiscount && (
              <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-100">
                <p className="font-semibold text-white flex items-center gap-2">
                  <BadgePercent className="w-4 h-4 text-emerald-300" />
                  {activePromotion?.name || "Premium promotion"} is live
                </p>
                <p className="text-emerald-100/80 mt-1">
                  {promotionPercent}% off {activePromotion?.duration === "forever" ? "new Premium subscriptions" : "the first Premium month"} is applied automatically at checkout for new subscribers.
                </p>
              </div>
            )}
            {!hasPremium && user && (
              <p className="text-xs text-zinc-500 mt-3 text-center">After subscribing, this button becomes Manage subscription.</p>
            )}
            <p className="text-xs text-zinc-500 mt-3 text-center">
              If you cancel Premium, you keep access until the end of the paid billing period. After that, your account returns to Free.
            </p>
            <p className="text-xs text-zinc-500 mt-3 text-center">
              [NO REFUNDS!!]
            </p>
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
                    <div className="font-display text-xl font-black text-white mt-1">
                      {bestDiscountPercent > 0 ? (
                        <span className="inline-flex items-baseline gap-2">
                          <span>{priceLabel} / month</span>
                          <span className="text-sm text-zinc-500 line-through">${PREMIUM_PRICE.toFixed(2)}</span>
                        </span>
                      ) : (
                        "$9.99 / month"
                      )}
                    </div>
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
