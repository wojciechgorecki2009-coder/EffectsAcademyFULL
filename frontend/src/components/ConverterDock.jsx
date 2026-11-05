import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, ChevronRight, RefreshCcw, X } from "lucide-react";
import LiquidGlass from "@/components/LiquidGlass";
import { EASE_OUT, SPRING } from "@/lib/motion";
import { useGlobalAudio } from "@/lib/globalAudio";
import { STAGE_LABEL, useConverterField } from "@/lib/converterSession";

const RING = 2 * Math.PI * 17;

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Bottom-left island showing a running conversion while the user browses other
 * pages. Once it finishes away from the converter, it turns into a "ready" (or
 * "failed") notice that links back to the result.
 */
export default function ConverterDock() {
  const reduce = useReducedMotion();
  const { pathname } = useLocation();
  const onConverter = pathname === "/convert";
  const audio = useGlobalAudio();
  const [status] = useConverterField("status");
  const [stage] = useConverterField("stage");
  const [progress] = useConverterField("progress");
  const [file] = useConverterField("file");
  const [format] = useConverterField("format");
  const [startedAt] = useConverterField("startedAt");
  const [notice, setNotice] = useState(null); // "done" | "error" once a conversion ends off the converter page
  const [elapsed, setElapsed] = useState(0);
  const previous = useRef(status);

  useEffect(() => {
    if (status !== "converting" || onConverter) return undefined;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [status, startedAt, onConverter]);

  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (was === "converting" && (status === "done" || status === "error") && !onConverter) setNotice(status);
    if (status === "converting") setNotice(null);
  }, [status, onConverter]);

  // Seeing the result on the converter page clears the notice.
  useEffect(() => {
    if (onConverter) setNotice(null);
  }, [onConverter]);

  // Leaving the site mid-conversion would lose it, so the browser asks first.
  useEffect(() => {
    if (status !== "converting") return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const mode = onConverter ? null : status === "converting" ? "converting" : notice;
  const pct = Math.round(progress * 100);
  const name = file?.name || "Your video";
  const target = (format || "").toUpperCase();

  const title = mode === "done" ? "Conversion ready" : mode === "error" ? "Conversion failed" : name;
  const detail =
    mode === "done"
      ? `${name} → ${target}`
      : mode === "error"
      ? "Open the converter to see what happened"
      : // Some files don't report a duration, so there's no percentage until the end.
        [STAGE_LABEL[stage] || "Converting", pct > 0 && `${pct}%`, clock(elapsed)].filter(Boolean).join(" · ");

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          key="converter-dock"
          className="pointer-events-none fixed left-3 z-50 w-[min(340px,calc(100vw-24px))] transition-[bottom] duration-500 ease-out-expo md:left-5"
          // Sits above the audio player when one is open.
          style={{ bottom: audio.src ? "var(--converter-dock-raised)" : "var(--converter-dock-bottom)" }}
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.92, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={{ opacity: 0, y: 16, scale: 0.94, filter: "blur(8px)", pointerEvents: "none" }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          data-testid="converter-dock"
        >
          <LiquidGlass className="lite-blur lg-strong pointer-events-auto rounded-[24px]" edge={20} strength={36}>
            <div className="relative flex items-center gap-3 py-2.5 pl-2.5 pr-2">
              <Link to="/convert" className="group flex min-w-0 flex-1 items-center gap-3 rounded-[18px]" data-testid="converter-dock-open">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={mode}
                      className={`absolute inset-0 flex items-center justify-center rounded-full ${
                        mode === "done"
                          ? "bg-[rgb(48_209_88/0.16)] text-[#30d158]"
                          : mode === "error"
                          ? "bg-[rgb(255_159_10/0.16)] text-[#ff9f0a]"
                          : "bg-[var(--fill)] text-tint"
                      }`}
                      initial={reduce ? false : { scale: 0.4, opacity: 0, rotate: -40 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={SPRING}
                    >
                      {mode === "done" ? (
                        <Check className="h-5 w-5" strokeWidth={2.75} />
                      ) : mode === "error" ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <RefreshCcw className="h-[18px] w-[18px]" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                  {mode === "converting" && (
                    <svg
                      viewBox="0 0 40 40"
                      className={`pointer-events-none absolute inset-0 -rotate-90 ${pct === 0 && !reduce ? "animate-[spin_1.4s_linear_infinite]" : ""}`}
                      aria-hidden="true"
                    >
                      <circle cx="20" cy="20" r="17" fill="none" stroke="var(--line)" strokeWidth="2.5" />
                      <motion.circle
                        cx="20"
                        cy="20"
                        r="17"
                        fill="none"
                        stroke="rgb(var(--tint))"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={RING}
                        // Without a percentage yet, a spinning quarter arc shows it's working.
                        animate={{ strokeDashoffset: RING * (1 - (pct === 0 ? 0.25 : progress)) }}
                        transition={{ duration: 0.5, ease: EASE_OUT }}
                      />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] tabular-nums text-ink-2">{detail}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-500 ease-spring group-hover:translate-x-0.5" />
              </Link>
              {mode !== "converting" && (
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-[var(--fill)] hover:text-ink"
                  aria-label="Dismiss"
                  data-testid="converter-dock-dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </LiquidGlass>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
