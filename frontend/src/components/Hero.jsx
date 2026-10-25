import { useEffect, useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Search, Sparkles, X } from "lucide-react";
import LiquidGlass from "@/components/LiquidGlass";
import { CountUp, EASE_OUT, KineticText } from "@/lib/motion";

const HERO_BACKGROUND = "/media/hero-background-poster.jpg";

export default function Hero({ query, setQuery, totalAssets }) {
  const sectionRef = useRef(null);
  const inputRef = useRef(null);
  const reduce = useReducedMotion();

  // Scroll-linked exit: the hero recedes like a layer being pushed back in comp space.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.6 });
  const contentY = useTransform(progress, [0, 1], [0, -90]);
  const contentScale = useTransform(progress, [0, 1], [1, 0.92]);
  const contentOpacity = useTransform(progress, [0, 0.75], [1, 0]);
  const bgY = useTransform(progress, [0, 1], [0, 160]);
  const bgScale = useTransform(progress, [0, 1], [1.08, 1.22]);

  // "/" focuses search from anywhere, like most pro tools.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fade = (delay) => ({
    initial: reduce ? false : { opacity: 0, y: 18, filter: "blur(10px)" },
    // Clearing filter afterwards matters: a filtered ancestor would cut glass off from the backdrop.
    animate: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } },
    transition: { duration: 1.1, ease: EASE_OUT, delay },
  });

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex min-h-[82vh] flex-col items-center justify-center overflow-hidden px-5 pb-20 pt-36 text-center md:min-h-[86vh] md:pt-40"
      data-testid="hero-section"
    >
      {/* Background composition */}
      <motion.div className="absolute inset-0 -z-10" style={reduce ? undefined : { y: bgY, scale: bgScale }} aria-hidden="true">
        <img
          src={HERO_BACKGROUND}
          alt=""
          className="h-full w-full object-cover opacity-[0.35] [filter:blur(26px)_saturate(1.4)]"
          data-testid="hero-bg-gif"
        />
      </motion.div>
      <div className="aurora -z-10" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="grain pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 30%, transparent 30%, rgb(var(--canvas) / 0.55) 75%), linear-gradient(to bottom, rgb(var(--canvas) / 0.15), transparent 35%, rgb(var(--canvas)) 96%)",
        }}
        aria-hidden="true"
      />

      <motion.div
        className="flex w-full flex-col items-center"
        style={reduce ? undefined : { y: contentY, scale: contentScale, opacity: contentOpacity }}
      >
        <motion.div {...fade(0.05)}>
          <LiquidGlass
            className="mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-ink"
            refract={false}
            data-testid="hero-badge"
          >
            <Sparkles className="h-3.5 w-3.5 text-tint" />
            Free assets for video editors
          </LiquidGlass>
        </motion.div>

        <h1 className="display-xl max-w-[14ch] text-ink" data-testid="hero-title">
          <KineticText text="Level up your edits." delay={0.15} stagger={0.085} highlight={{ "edits.": "text-shimmer" }} />
        </h1>

        <motion.p className="lede mt-7 max-w-[38rem]" data-testid="hero-description" {...fade(0.55)}>
          Effects Academy is a curated vault for video editors: project files, overlays, presets, audios,
          sound effects, torrents, premium packs, and a free video converter in one clean library.
        </motion.p>

        <motion.div className="mt-11 w-full max-w-[40rem]" {...fade(0.7)}>
          <LiquidGlass className="group flex h-[3.75rem] items-center rounded-full pl-5 pr-2 transition-shadow duration-500 focus-within:shadow-[var(--glass-shadow),0_0_0_4px_rgb(var(--tint)/0.18)]" edge={24} strength={46}>
            <Search className="h-5 w-5 shrink-0 text-ink-2 transition-colors duration-300 group-focus-within:text-tint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets, creators, genres..."
              aria-label="Search assets"
              className="bare h-full min-w-0 flex-1 bg-transparent px-3.5 text-[17px] text-ink outline-none placeholder:text-ink-3"
              data-testid="hero-search-input"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fill-2)] text-ink-2 transition-transform duration-300 ease-spring hover:text-ink active:scale-90"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="mr-2 hidden h-7 min-w-7 items-center justify-center rounded-lg bg-[var(--fill-2)] px-2 font-mono text-xs text-ink-3 sm:flex">/</kbd>
            )}
          </LiquidGlass>
        </motion.div>

        {totalAssets > 0 && (
          <motion.p className="mt-6 text-[13px] font-medium text-ink-3" {...fade(0.85)}>
            <CountUp value={totalAssets} className="tabular-nums text-ink-2" /> assets and counting
          </motion.p>
        )}
      </motion.div>
    </section>
  );
}
