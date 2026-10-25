import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgePercent, Check, Crown, Download, KeyRound, Loader2, LockKeyhole, Minus, MousePointerClick, ShieldCheck, Sparkles } from "lucide-react";
import { BackButton, SectionHeader } from "@/components/Library";
import { EASE_OUT, KineticText, Reveal, Stagger, StaggerItem } from "@/lib/motion";
import { api } from "@/lib/api";
import { hasPremiumAccess, useAuth } from "@/lib/auth";
import TwitchIcon from "@/components/TwitchIcon";
import AfterEffectsLogo from "@/components/AfterEffectsLogo";

const BENEFITS = [
  "All premium assets included with membership",
  "Unlimited premium asset downloads",
  "Access to the Effects Academy After Effects extension",
  "New exclusive drops every month",
  "Subscription tied securely to your Google account",
  "Manage or cancel anytime through Stripe",
  "If you cancel, Premium stays active until the paid billing period ends",
];

const COMPARISON_ROWS = [
  { feature: "Free assets", free: true, premium: true },
  { feature: "Video file converter", free: true, premium: true },
  { feature: "After Effects extension", free: false, premium: true },
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

const twitchMessage = (state, broadcaster = "mrbit1000", discount = 15) => {
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
      <span className="inline-flex items-center gap-2 font-medium text-ink">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${premium ? "bg-tint text-tint-ink" : "bg-[var(--fill-2)] text-ink"}`}>
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        Included
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-2 text-ink-3">
        <Minus className="h-4 w-4" />
        Not included
      </span>
    );
  }
  return <span className={premium ? "font-semibold text-ink" : "text-ink-2"}>{value}</span>;
}

export default function PremiumPage() {
  const { user, hasPremium, config, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [extensionPairingCode, setExtensionPairingCode] = useState("");
  const [pagePromotion, setPagePromotion] = useState(null);
  const reduce = useReducedMotion();
  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");
  const twitchState = searchParams.get("twitch");
  const twitchNotice = twitchMessage(
    twitchState,
    config.twitch_broadcaster_login,
    config.twitch_discount_percent
  );
  const twitchDiscountPercent = Number(config.twitch_discount_percent || user?.twitch_discount_percent || 15);
  const activePromotion = pagePromotion || config.active_premium_promotion;
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
    let active = true;
    api.get("/auth/config")
      .then(({ data }) => {
        if (active) setPagePromotion(data?.active_premium_promotion || null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

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

  const priceWhole = Math.floor(displayPrice);
  const priceCents = (displayPrice - priceWhole).toFixed(2).slice(1);

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-28 pt-28 sm:px-6 md:pt-32" data-testid="premium-page">
      <div className="aurora -z-10 !opacity-40" aria-hidden="true" style={{ inset: "-30% -10% auto", height: "90vh" }}>
        <span />
        <span />
        <span />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[90vh]"
        style={{ background: "linear-gradient(to bottom, transparent 40%, rgb(var(--canvas)))" }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1120px]">
        <BackButton to="/category/premium">Premium assets</BackButton>

        <div className="space-y-3">
          {checkoutState === "configuration-required" && (
            <div className="notice notice-warn" data-testid="stripe-config-notice">
              Stripe Checkout is ready in the code. Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> to connect the live account.
            </div>
          )}
          {checkoutState === "cancelled" && (
            <div className="notice">Checkout was cancelled. Nothing was charged.</div>
          )}
          {checkoutState === "success" && (
            <div className="notice notice-ok">
              Payment received. Premium access is being activated for your signed-in account.
            </div>
          )}
          {twitchNotice && !hasPremium && (
            <div className={`notice ${twitchState === "linked" ? "notice-accent" : "notice-warn"}`}>
              {twitchNotice}
            </div>
          )}
        </div>

        <header className="mx-auto mt-6 max-w-3xl text-center">
          <motion.p
            className="eyebrow inline-flex items-center gap-1.5 !text-[#ff9f0a]"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
          >
            <Crown className="h-4 w-4" /> Effects Academy Premium
          </motion.p>
          <h1 className="display-lg mt-3 text-ink">
            <KineticText text="Unlock the whole vault." delay={0.1} highlight={{ "vault.": "text-shimmer" }} />
          </h1>
          <motion.p
            className="lede mx-auto mt-5 max-w-2xl"
            initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            transition={{ duration: 1, ease: EASE_OUT, delay: 0.45 }}
          >
            Premium on Effects Academy unlocks our more sophisticated project files, a bigger allowance for our tools across the site, and now our built-in After Effects extension.
          </motion.p>
        </header>

        <div className="mt-14 grid items-start gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Plan */}
          <Reveal className="relative">
            <div
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[48px] opacity-70 blur-3xl"
              style={{ background: "radial-gradient(60% 50% at 30% 20%, rgb(var(--tint) / 0.35), transparent 70%), radial-gradient(50% 50% at 80% 80%, rgb(191 90 242 / 0.28), transparent 70%)" }}
              aria-hidden="true"
            />
            <div className="glass rounded-[32px] p-7 md:p-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[15px] font-semibold text-ink">{hasPremium ? "Premium is active" : "Monthly membership"}</p>
                  <p className="mt-0.5 text-[13px] text-ink-3">{user ? `Signed in as ${user.email}` : "Google sign-in required"}</p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--tint)/0.12)] text-tint">
                  {hasPremium ? <Sparkles className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
                </span>
              </div>

              <div className="mt-8">
                {bestDiscountPercent > 0 && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="text-ink-3 line-through">${PREMIUM_PRICE.toFixed(2)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(48_209_88/0.14)] px-2.5 py-0.5 text-[12px] font-semibold text-[#248a3d] dark:text-[#30d158]">
                      <BadgePercent className="h-3 w-3" /> {discountSource === "promotion" ? activePromotion?.name || "Limited promotion" : "Twitch subscriber price"}
                    </span>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <span className="font-display text-[4.25rem] font-bold leading-none tracking-[-0.05em] text-ink">
                    ${priceWhole}
                    <span className="text-[2rem] tracking-[-0.03em]">{priceCents}</span>
                  </span>
                  <span className="pb-2 text-[15px] text-ink-3">USD / month</span>
                </div>
                {bestDiscountPercent > 0 && (
                  <p className="mt-2 text-[14px] text-ink-2">
                    {discountSource === "promotion"
                      ? `${activePromotion?.name || "Limited promotion"} unlocks ${bestDiscountPercent}% off ${activePromotion?.duration === "forever" ? "Premium." : "your first Premium month."}`
                      : `Your verified Twitch sub unlocks ${bestDiscountPercent}% off Premium.`}
                  </p>
                )}
              </div>

              <Stagger as="ul" className="mt-8 space-y-3.5" stagger={0.05}>
                {BENEFITS.map((benefit) => (
                  <StaggerItem as="li" key={benefit} className="flex items-start gap-3 text-[15px] leading-snug text-ink">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tint text-tint-ink">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {benefit}
                  </StaggerItem>
                ))}
              </Stagger>

              <button
                onClick={hasPremium ? manageSubscription : subscribe}
                disabled={busy}
                className="btn btn-primary btn-lg btn-block mt-9"
                data-testid="premium-checkout-button"
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                {busy ? "Opening Stripe..." : hasPremium ? "Manage subscription" : user ? "Subscribe with Stripe" : "Sign in with Google"}
              </button>
              {error && <p className="mt-3 text-center text-[13px] text-[#ff453a]" data-testid="checkout-error">{error}</p>}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-ink-3">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure checkout hosted by Stripe
              </p>
            </div>
          </Reveal>

          {/* Account & extras */}
          <div className="space-y-5">
            <Reveal delay={0.08}>
              <div className="notice notice-accent flex items-start gap-3 !rounded-[22px] !p-5">
                <Crown className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9f0a]" />
                <span>Included with membership: every Premium asset plus the Effects Academy After Effects extension.</span>
              </div>
            </Reveal>

            {!hasPremium && (
              <Reveal delay={0.12}>
                <div className="surface rounded-[26px] p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#9146FF] shadow-[0_6px_18px_rgb(145_70_255/0.35)]">
                      <TwitchIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
                        Twitch subscriber discount
                        <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(145_70_255/0.14)] px-2 py-0.5 text-[11px] font-semibold text-[#9146FF]">
                          <BadgePercent className="h-3 w-3" /> {twitchDiscountPercent}% off
                        </span>
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
                        Subscribe to <span className="font-semibold text-ink">{config.twitch_broadcaster_login || "mrbit1000"}</span> on Twitch, then link Twitch here before checkout.
                      </p>
                      {user?.twitch_login && (
                        <p className={`mt-2 text-[12.5px] font-medium ${user.twitch_discount_eligible ? "text-[#248a3d] dark:text-[#30d158]" : "text-[#c93400] dark:text-[#ff9f0a]"}`}>
                          Linked as {user.twitch_login}. {user.twitch_discount_eligible
                            ? config.stripe_twitch_coupon_configured
                              ? "Discount eligible."
                              : "Twitch verified, but the Stripe coupon is not configured yet."
                            : "Subscriber discount not currently verified."}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={connectTwitch}
                          disabled={busy}
                          className="btn btn-sm"
                          style={{ background: "#9146FF", color: "#fff" }}
                          data-testid="premium-twitch-connect"
                        >
                          <TwitchIcon className="h-4 w-4" />
                          {user?.twitch_discount_eligible ? "Recheck Twitch" : "Link Twitch for discount"}
                        </button>
                        {user?.twitch_login && (
                          <button
                            type="button"
                            onClick={disconnectTwitch}
                            disabled={busy}
                            className="btn btn-sm btn-secondary"
                            data-testid="premium-twitch-disconnect"
                          >
                            Sign out of Twitch
                          </button>
                        )}
                      </div>
                      {!config.twitch_configured && (
                        <p className="mt-3 text-[12px] text-ink-3">
                          Twitch discount is ready in the code. Add Twitch keys in Render to enable it.
                        </p>
                      )}
                      {config.twitch_configured && user?.twitch_discount_eligible && !config.stripe_twitch_coupon_configured && (
                        <p className="mt-3 text-[12px] text-[#c93400] dark:text-[#ff9f0a]">
                          Add <code>STRIPE_TWITCH_COUPON_ID</code> to the backend in Render before checkout can apply the discount.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>
            )}

            {hasPremium && (
              <Reveal delay={0.12}>
                <div id="after-effects-extension" className="surface scroll-mt-28 rounded-[26px] p-6">
                  <div className="flex items-start gap-4">
                    <AfterEffectsLogo className="h-11 w-11 shrink-0 drop-shadow-[0_6px_16px_rgb(0_0_91/0.35)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink">After Effects extension access</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
                        Generate a short pairing code, then type it into the extension Connection settings. Each Premium account can be linked to one extension install at a time.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a
                          href="/downloads/EffectsAcademy-AE-Extension-1.0.0.zxp"
                          download
                          className="btn btn-sm btn-primary"
                          data-testid="download-ae-extension"
                        >
                          <Download />
                          Download extension 1.0.0
                        </a>
                        <button
                          type="button"
                          onClick={generateExtensionPairingCode}
                          disabled={busy}
                          className="btn btn-sm btn-secondary"
                          data-testid="generate-extension-code"
                        >
                          <KeyRound />
                          Generate AE pairing code
                        </button>
                      </div>
                      <p className="mt-2 text-[12px] text-ink-3">Install the .zxp with ZXP/UXP Installer, then connect your Premium account below.</p>
                      <AnimatePresence>
                        {extensionPairingCode && (
                          <motion.div
                            className="mt-4 rounded-2xl bg-[var(--fill)] p-4"
                            initial={{ opacity: 0, height: 0, filter: "blur(6px)" }}
                            animate={{ opacity: 1, height: "auto", filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.5, ease: EASE_OUT }}
                          >
                            <code
                              className="block cursor-text select-all text-center font-mono text-2xl font-semibold tracking-[0.3em] text-ink"
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
                            <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-ink-3">
                              <MousePointerClick className="h-3.5 w-3.5" />
                              Click code, then Ctrl+C
                            </p>
                            <p className="mt-1 text-center text-[12px] text-ink-3">This code expires in 10 minutes and can only be used once. You can also type it manually.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {user?.extension_device_linked && (
                        <>
                          <button
                            type="button"
                            onClick={resetExtensionDevice}
                            disabled={busy}
                            className="btn btn-sm btn-ghost mt-3 !px-0 !text-tint hover:!bg-transparent hover:underline"
                            data-testid="reset-extension-device"
                          >
                            Reset linked extension
                          </button>
                          <p className="mt-1 text-[12px] text-ink-3">
                            This account is already linked to an After Effects install. Reset only if you are moving to a new PC or reinstalling.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>
            )}

            {hasPromotionDiscount && (
              <Reveal delay={0.16}>
                <div className="notice notice-ok !rounded-[22px] !p-5">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <BadgePercent className="h-4 w-4 text-[#30d158]" />
                    {activePromotion?.name || "Premium promotion"} is live
                  </p>
                  <p className="mt-1 text-ink-2">
                    {promotionPercent}% off {activePromotion?.duration === "forever" ? "new Premium subscriptions" : "the first Premium month"} is applied automatically at checkout for new subscribers.
                  </p>
                </div>
              </Reveal>
            )}

            <Reveal delay={0.2}>
              <ul className="space-y-2.5 px-2 text-[12.5px] leading-relaxed text-ink-3">
                {!hasPremium && user && <li>After subscribing, this button becomes Manage subscription.</li>}
                <li>If you cancel Premium, you keep access until the end of the paid billing period. After that, your account returns to Free.</li>
                <li>Premium Asset Licence acceptance is required before Premium downloads and extension access are enabled.</li>
                <li>Subscription fees are non-refundable except where required by law. This does not affect your statutory rights.</li>
                {!config.stripe_configured && config.dev_login_enabled && <li>Local preview mode — no payment will be submitted.</li>}
              </ul>
            </Reveal>
          </div>
        </div>

        {/* Comparison */}
        <div className="mt-28">
          <SectionHeader eyebrow="Free vs Premium" title="Compare what you get." className="!mb-3" />
          <Reveal>
            <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">
              Free members can browse, download free assets, and use the video converter. Premium unlocks the full vault, the After Effects extension, and early beta features.
            </p>
          </Reveal>

          <Reveal className="mt-8 overflow-x-auto rounded-[28px] bg-panel shadow-[var(--shadow-card),inset_0_0_0_1px_var(--line)]">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="text-left">
                  <th className="px-6 pb-5 pt-7 align-bottom text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3 md:px-8">Feature</th>
                  <th className="px-6 pb-5 pt-7 align-bottom md:px-8">
                    <div className="text-[13px] font-medium text-ink-3">Free</div>
                    <div className="mt-1 font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">$0</div>
                  </th>
                  <th className="bg-[rgb(var(--tint)/0.05)] px-6 pb-5 pt-7 align-bottom md:px-8">
                    <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-tint">
                      <Crown className="h-3.5 w-3.5" /> Premium
                    </div>
                    <div className="mt-1 font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">
                      {bestDiscountPercent > 0 ? (
                        <span className="inline-flex items-baseline gap-2">
                          <span>{priceLabel} / month</span>
                          <span className="text-sm font-normal text-ink-3 line-through">${PREMIUM_PRICE.toFixed(2)}</span>
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
                  <tr key={row.feature} className="border-t border-[var(--line)] transition-colors duration-200 hover:bg-[var(--fill)]">
                    <td className="px-6 py-4 font-medium text-ink md:px-8">{row.feature}</td>
                    <td className="px-6 py-4 md:px-8">
                      <ComparisonValue value={row.free} />
                    </td>
                    <td className="bg-[rgb(var(--tint)/0.05)] px-6 py-4 md:px-8">
                      <ComparisonValue value={row.premium} premium />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
