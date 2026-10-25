import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import AssetCard from "@/components/AssetCard";
import { EASE_OUT, KineticText, Reveal } from "@/lib/motion";

// Two compact columns on phones, growing to four on wide screens.
export const GRID_CLASS = "asset-grid grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4";

const GRID_BATCH = 24;

/** Apple-style section heading: small colored eyebrow, big headline, optional "View all ›". */
export function SectionHeader({ eyebrow, eyebrowColor, title, action, className = "" }) {
  return (
    <Reveal className={`mb-6 flex items-end justify-between gap-4 ${className}`} y={18} blur={8}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className={`eyebrow mb-1.5 ${eyebrowColor ? "eyebrow-c" : ""}`} style={eyebrowColor ? { "--c": eyebrowColor } : undefined}>
            {eyebrow}
          </p>
        ) : null}
        <h2 className="display-md text-ink">{title}</h2>
      </div>
      {action}
    </Reveal>
  );
}

export function ViewAllLink({ to, testId, children = "View all" }) {
  return (
    <Link to={to} className="link-more shrink-0 pb-1" data-testid={testId}>
      {children}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

export function BackButton({ onClick, to, children, testId }) {
  const className =
    "group mb-6 inline-flex items-center gap-1 rounded-full py-1 pr-3 text-[15px] font-medium text-tint transition-colors hover:underline hover:underline-offset-4";
  const content = (
    <>
      <ChevronLeft className="h-4 w-4 transition-transform duration-500 ease-spring group-hover:-translate-x-1" />
      {children}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className} data-testid={testId}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} data-testid={testId}>
      {content}
    </button>
  );
}

/**
 * Cards reveal row by row as they scroll into view. Delay is based on column
 * position so each row cascades left to right, like staggered layers.
 * Long lists render in batches as you approach the end, so a category with
 * hundreds of assets doesn't build every card (and thumbnail) up front.
 */
export function AssetGrid({ assets, featuredAssetId = "", onChanged, allAssets }) {
  const reduce = useReducedMotion();
  const [limit, setLimit] = useState(GRID_BATCH);
  const sentinelRef = useRef(null);
  const hasMore = assets.length > limit;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setLimit((value) => value + GRID_BATCH);
      },
      { rootMargin: "1200px 0px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, limit]);

  return (
    <>
    <div className={GRID_CLASS}>
      {assets.slice(0, limit).map((a, idx) => (
        <motion.div
          key={a.id}
          className={a.id === featuredAssetId ? "featured-extension-slot" : ""}
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.85, ease: EASE_OUT, delay: (idx % 4) * 0.07 }}
        >
          <AssetCard asset={a} featured={a.id === featuredAssetId} onChanged={onChanged} allAssets={allAssets || assets} />
        </motion.div>
      ))}
    </div>
    {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
    </>
  );
}

export function AssetSkeletonGrid({ count = 8 }) {
  return (
    <div className={GRID_CLASS} aria-busy="true" aria-label="Loading assets">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="rounded-[22px] bg-panel p-1.5 shadow-[var(--shadow-card),inset_0_0_0_1px_var(--line)]">
          <div className="skeleton aspect-video rounded-2xl" />
          <div className="space-y-2.5 px-2.5 pb-3 pt-4">
            <div className="skeleton h-3 w-20 rounded-full" />
            <div className="skeleton h-4 w-3/4 rounded-full" />
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton mt-4 h-9 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PickerSkeleton() {
  return (
    <div className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="skeleton h-48 rounded-[28px]" />
      ))}
    </div>
  );
}

export function EmptyState({ title = "No assets found", children, action, testId = "empty-state" }) {
  return (
    <Reveal className="flex flex-col items-center rounded-[28px] bg-panel px-6 py-20 text-center shadow-[inset_0_0_0_1px_var(--line)]" data-testid={testId}>
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--fill-2)] text-ink-2">
        <SearchX className="h-6 w-6" />
      </span>
      <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">{children}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </Reveal>
  );
}

/** Large dark media tile used for "Shows or Movies?" style choices. */
export function BranchCard({ label, count, icon, from, to, accent, onClick, testId, index = 0 }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group relative flex h-52 w-full flex-col justify-between overflow-hidden rounded-[28px] p-7 text-left shadow-[var(--shadow-card)] transition-shadow duration-500 hover:shadow-[var(--shadow-card-hover)]"
      style={{ background: `linear-gradient(140deg, ${from} 0%, ${to} 100%)`, color: "#fff" }}
      initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      viewport={{ once: true }}
      transition={{ duration: 0.85, ease: EASE_OUT, delay: index * 0.08 }}
      whileHover={reduce ? undefined : { y: -4 }}
      whileTap={{ scale: 0.98 }}
      data-testid={testId}
    >
      <span
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-40 blur-3xl transition-transform duration-[1200ms] ease-out-expo group-hover:scale-125"
        style={{ background: accent }}
      />
      <span className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08),inset_0_1px_0_rgb(255_255_255/0.12)]" />
      <span
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl backdrop-blur-md [&_svg]:h-6 [&_svg]:w-6"
        style={{ background: "rgb(255 255 255 / 0.12)", boxShadow: "inset 0 0 0 0.5px rgb(255 255 255 / 0.2)" }}
      >
        {icon}
      </span>
      <span className="relative flex items-end justify-between gap-4">
        <span>
          <span className="block font-display text-[2rem] font-semibold leading-none tracking-[-0.03em]">{label}</span>
          <span className="mt-2 block text-sm" style={{ color: "rgb(255 255 255 / 0.65)" }}>
            {count} item{count === 1 ? "" : "s"}
          </span>
        </span>
        <span className="inline-flex items-center gap-0.5 text-sm font-medium" style={{ color: "rgb(255 255 255 / 0.8)" }}>
          Open <ChevronRight className="h-4 w-4 transition-transform duration-500 ease-spring group-hover:translate-x-1" />
        </span>
      </span>
    </motion.button>
  );
}

/** Confirmation panel with a check mark that draws itself in. */
export function SuccessPanel({ title, children, testId }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="surface mt-8 flex flex-col items-center rounded-[28px] px-6 py-14 text-center"
      initial={reduce ? false : { opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
      data-testid={testId}
    >
      <svg viewBox="0 0 52 52" className="mb-5 h-16 w-16 text-[#30d158]" aria-hidden="true">
        <motion.circle
          cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2.5"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        />
        <motion.path
          d="M15 27 l7 7 l15 -16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.55 }}
        />
      </svg>
      <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-[15px] text-ink-2">{children}</p>
    </motion.div>
  );
}

/** Page opening: eyebrow, kinetic headline, lede. */
export function PageIntro({ eyebrow, icon, title, children, center = false, className = "" }) {
  const reduce = useReducedMotion();
  return (
    <header className={`${center ? "mx-auto text-center" : ""} max-w-3xl ${className}`}>
      {eyebrow ? (
        <motion.p
          className={`eyebrow mb-3 inline-flex items-center gap-1.5 [&_svg]:h-4 [&_svg]:w-4`}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        >
          {icon}
          {eyebrow}
        </motion.p>
      ) : null}
      <h1 className="display-lg text-ink">
        <KineticText text={title} delay={0.05} stagger={0.07} />
      </h1>
      {children ? (
        <motion.div
          className={`lede mt-5 ${center ? "mx-auto" : ""} max-w-2xl`}
          initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          transition={{ duration: 1, ease: EASE_OUT, delay: 0.3 }}
        >
          {children}
        </motion.div>
      ) : null}
    </header>
  );
}

export function SubHeading({ icon, children }) {
  return (
    <Reveal as="h2" className="mb-5 flex items-center gap-2.5 font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-ink" y={12} blur={6}>
      {icon ? <span className="text-tint [&_svg]:h-5 [&_svg]:w-5">{icon}</span> : null}
      {children}
    </Reveal>
  );
}
