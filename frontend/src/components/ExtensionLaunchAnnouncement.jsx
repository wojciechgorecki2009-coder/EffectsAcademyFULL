import { useEffect, useRef, useState } from "react";
import { AnimatePresence, PresenceContext, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, AudioLines, Crown, Download, Folder, Gauge, Music2, Palette, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import AfterEffectsLogo from "@/components/AfterEffectsLogo";
import { EASE_OUT, SPRING, SPRING_SOFT } from "@/lib/motion";

/*
 * Extension update announcement (v1.1). Shown once per visit until the
 * campaign ends, on every page except the standalone and auth routes.
 */
const CAMPAIGN_END = new Date("2026-11-01T23:59:59+00:00").getTime();
const SEEN_KEY = "ea_extension_update_1_1_seen";
const EXTENSION_DESTINATION = "/premium#after-effects-extension";
const HIDDEN_ROUTES = ["/products-i-use", "/login", "/auth/", "/download/"];
const OPEN_DELAY_MS = 900;

const WHATS_NEW = [
  { icon: Palette, title: "A brand-new look", text: "The same Liquid Glass design as the site, with a clean black & white theme." },
  { icon: Gauge, title: "Instant browsing", text: "Jump between Audios, Presets and Project Files without a stutter." },
  { icon: SlidersHorizontal, title: "Make it fit", text: "New card size and interface scale settings for any panel shape." },
  { icon: Music2, title: "Smoother previews", text: "Audio opens in a Dynamic Island-style player, with motion throughout." },
];

// The mock panel cycles through these tabs; cards re-flow to match.
const MOCK_TABS = ["All", "Audios", "Presets", "Projects"];
const MOCK_CARDS = [
  { id: 1, tab: "Audios", tone: "#3a3a3e", icon: AudioLines },
  { id: 2, tab: "Presets", tone: "#2c2c30", icon: SlidersHorizontal },
  { id: 3, tab: "Projects", tone: "#343438", icon: Folder },
  { id: 4, tab: "Audios", tone: "#28282c", icon: AudioLines },
  { id: 5, tab: "Projects", tone: "#38383c", icon: Folder },
  { id: 6, tab: "Presets", tone: "#303034", icon: SlidersHorizontal },
];

const readSeen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};

const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {}
};

const container = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.22 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

export default function ExtensionLaunchAnnouncement() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hasPremium, loading, user } = useAuth();
  const reduce = useReducedMotion();
  const primaryRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(() => Date.now() <= CAMPAIGN_END && !readSeen());

  const routeAllowed = !HIDDEN_ROUTES.some((route) => pathname.startsWith(route));
  const visible = open && ready && !loading && routeAllowed && Date.now() <= CAMPAIGN_END && !user?.premium_terms_required;

  // Let the page settle before the announcement rises over it.
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => setReady(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!visible) return undefined;
    markSeen();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), 500);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [visible]);

  const close = () => setOpen(false);

  const openPremium = () => {
    setOpen(false);
    navigate(EXTENSION_DESTINATION);
    window.setTimeout(() => {
      document.getElementById("after-effects-extension")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 450);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="extension-update"
          className="dialog-overlay fixed inset-0 z-[90] flex justify-center overflow-y-auto overscroll-contain p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.5, ease: EASE_OUT } }}
          exit={{ opacity: 0, pointerEvents: "none", transition: { duration: 0.35, ease: EASE_OUT, delay: 0.05 } }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          data-testid="extension-launch-announcement"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="extension-update-title"
            className="glass solid-on-lite relative my-auto grid w-full max-w-[920px] overflow-hidden rounded-[32px] text-ink md:grid-cols-[1.02fr_1fr]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 48, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 210, damping: 26, mass: 1 } }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97, transition: { duration: 0.3, ease: EASE_OUT } }}
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white/80 shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.2)] transition-[color,transform] duration-300 ease-spring hover:text-white active:scale-90 md:bg-[var(--fill-2)] md:text-ink-2 md:hover:text-ink"
              aria-label="Close extension update announcement"
            >
              <X className="h-4 w-4" />
            </button>

            {/* The preview's looping tab lens and re-flowing cards must never hold
                up the dialog's exit, so they sit outside its presence tracking. */}
            <PresenceContext.Provider value={null}>
              <PanelPreview reduce={reduce} />
            </PresenceContext.Provider>

            <motion.div className="flex flex-col p-5 pt-6 sm:p-8 md:py-10 md:pl-6 md:pr-10" variants={container} initial="hidden" animate="shown">
              <motion.p variants={rise} className="eyebrow inline-flex items-center gap-1.5 text-tint">
                <Sparkles className="h-3.5 w-3.5" /> Extension update · Version 1.1
              </motion.p>
              <motion.h2
                variants={rise}
                id="extension-update-title"
                className="mt-2 font-display text-[1.85rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[2.4rem]"
              >
                Updated
                <br />
                <span className="text-ink-2">Extension</span>
              </motion.h2>
              <motion.p variants={rise} className="mt-3 text-[14px] leading-relaxed text-ink-2 sm:text-[15px]">
                The Effects Academy After Effects extension has been updated with a fresh design, smoother motion and faster browsing.
              </motion.p>

              <motion.ul variants={container} className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:grid-cols-1 sm:gap-3">
                {WHATS_NEW.map(({ icon: Icon, title, text }) => (
                  <motion.li key={title} variants={rise} className="flex items-center gap-3 sm:items-start">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--fill-2)] text-ink shadow-[inset_0_0_0_0.5px_var(--line)]">
                      <Icon className="h-[17px] w-[17px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</span>
                      <span className="block text-[13px] leading-snug text-ink-3 max-sm:hidden">{text}</span>
                    </span>
                  </motion.li>
                ))}
              </motion.ul>

              <motion.p
                variants={rise}
                className="mt-4 inline-flex items-center gap-2 self-start rounded-full sm:mt-5 bg-[rgb(255_179_64/0.12)] px-3 py-1.5 text-[12.5px] font-semibold text-[#ffb340]"
              >
                <Crown className="h-3.5 w-3.5" />
                {hasPremium ? "Included with your Premium membership" : "Available now for Premium members"}
              </motion.p>

              <motion.div variants={rise} className="mt-5 flex gap-2 sm:mt-6">
                <button ref={primaryRef} type="button" onClick={openPremium} className="btn btn-primary group min-w-0 flex-1 sm:flex-none">
                  {hasPremium ? <Download /> : <Crown />}
                  {hasPremium ? "Get the update" : <span>Unlock<span className="max-[400px]:hidden"> with Premium</span></span>}
                  <ArrowRight className="transition-transform duration-500 ease-spring group-hover:translate-x-1" />
                </button>
                <button type="button" onClick={close} className="btn btn-secondary">
                  Not now
                </button>
              </motion.div>
            </motion.div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/*
 * A live miniature of the updated panel: the tab lens glides between
 * categories, the cards re-flow, and the island player opens.
 */
function PanelPreview({ reduce }) {
  const [tab, setTab] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (reduce) return undefined;
    const tabTimer = window.setInterval(() => setTab((value) => (value + 1) % MOCK_TABS.length), 2200);
    const playTimer = window.setTimeout(() => setPlaying(true), 1300);
    return () => {
      window.clearInterval(tabTimer);
      window.clearTimeout(playTimer);
    };
  }, [reduce]);

  const activeTab = MOCK_TABS[tab];
  const cards = MOCK_CARDS.filter((card) => activeTab === "All" || card.tab === activeTab);

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden px-5 pb-3 pt-10 sm:p-7 md:min-h-[540px]"
      style={{
        background:
          "radial-gradient(90% 70% at 30% 20%, rgb(255 255 255 / 0.10), transparent 60%), radial-gradient(80% 60% at 80% 90%, rgb(153 153 255 / 0.14), transparent 65%), #050506",
      }}
      aria-hidden="true"
    >
      <motion.div
        className="relative w-full max-w-[250px] rounded-[22px] sm:max-w-[430px] bg-[#0c0c0d] p-2.5 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.09),inset_0_1px_0_rgb(255_255_255/0.12)]"
        initial={reduce ? false : { opacity: 0, y: 30, rotateX: 14, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.12 }}
        style={{ transformPerspective: 1200 }}
      >
        <div className="flex items-center gap-2 rounded-[14px] bg-white/[0.05] px-2.5 py-2 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]">
          <AfterEffectsLogo className="h-5 w-5 shrink-0" />
          <span className="text-[11px] font-semibold tracking-[-0.01em] text-white">Effects Academy</span>
          <motion.span
            className="rounded-full bg-white px-1.5 py-[1px] text-[9.5px] font-bold text-black"
            initial={reduce ? false : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING, delay: 0.8 }}
          >
            v1.1
          </motion.span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#30d158] shadow-[0_0_8px_#30d158]" />
        </div>

        <div className="mt-2 flex gap-0.5 rounded-full bg-white/[0.05] p-0.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]">
          {MOCK_TABS.map((label, index) => (
            <span key={label} className={`relative flex-1 rounded-full py-1 text-center text-[10px] font-medium ${index === tab ? "text-black" : "text-white/55"}`}>
              {index === tab && (
                <motion.span layoutId="extension-update-lens" className="absolute inset-0 rounded-full bg-white" transition={SPRING_SOFT} />
              )}
              <span className="relative">{label}</span>
            </span>
          ))}
        </div>

        <div className="mt-2 grid aspect-[8/5] grid-cols-3 content-start gap-1.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {cards.map((card, index) => (
              <MockCard key={card.id} card={card} index={index} reduce={reduce} playing={playing && card.id === 1} />
            ))}
          </AnimatePresence>
        </div>

        <IslandPlayer open={playing} reduce={reduce} />
      </motion.div>

    </div>
  );
}

function MockCard({ card, index, reduce, playing }) {
  const Icon = card.icon;
  return (
    <motion.div
      layout
      className={`rounded-[11px] bg-white/[0.045] p-1 ${playing ? "shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.55)]" : "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"}`}
      initial={reduce ? false : { opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
      transition={{ ...SPRING_SOFT, delay: reduce ? 0 : 0.25 + index * 0.05 }}
    >
      <div className="relative flex aspect-[16/10] items-center justify-center rounded-[8px]" style={{ background: `linear-gradient(150deg, ${card.tone}, #151517)` }}>
        <Icon className="h-3.5 w-3.5 text-white/45" />
        {playing && (
          <span className="absolute bottom-1 right-1 flex h-2.5 items-end gap-[1.5px]">
            {[0, 1, 2].map((bar) => (
              <motion.i
                key={bar}
                className="block w-[2px] rounded-full bg-white"
                animate={reduce ? { height: "60%" } : { height: ["30%", "100%", "45%", "80%", "30%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: bar * 0.18 }}
              />
            ))}
          </span>
        )}
      </div>
      <div className="mt-1 h-1 w-3/4 rounded-full bg-white/25" />
      <div className="mt-1 h-1 w-1/2 rounded-full bg-white/10" />
      <div className={`mt-1.5 h-2.5 rounded-full ${playing ? "bg-white" : "bg-white/10"}`} />
    </motion.div>
  );
}

function IslandPlayer({ open, reduce }) {
  return (
    <div className="mt-2 flex h-9 justify-center">
      <AnimatePresence>
        {open && (
          <motion.div
            className="flex h-9 w-full items-center gap-2 rounded-full bg-[#1c1c1e] px-1.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08),0_10px_24px_-10px_rgb(0_0_0/0.9)]"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(0% 44% 0% 44% round 999px)", opacity: 0.6 }}
            animate={{ clipPath: "inset(0% 0% 0% 0% round 999px)", opacity: 1 }}
            transition={{ duration: 0.85, ease: EASE_OUT }}
          >
            <span className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-[#4a4a4e] to-[#1a1a1c]" />
            <motion.span
              className="min-w-0 flex-1"
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.35 }}
            >
              <span className="block h-1 w-20 rounded-full bg-white/60" />
              <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-white/15">
                <motion.span
                  className="block h-full origin-left rounded-full bg-white"
                  initial={{ scaleX: 0.05 }}
                  animate={{ scaleX: reduce ? 0.4 : 1 }}
                  transition={{ duration: reduce ? 0 : 14, ease: "linear" }}
                />
              </span>
            </motion.span>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
              <span className="flex gap-[2px]">
                <i className="block h-2 w-[2px] rounded-full bg-black" />
                <i className="block h-2 w-[2px] rounded-full bg-black" />
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
