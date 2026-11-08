import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useAnimationControls, useDragControls, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

const TITLE_HEIGHT = 34;
const NAV_CLEARANCE = 80; // keeps the window below the site's floating nav

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Where a new floating window goes: just right of the button that opened it, kept
 * inside the viewport. `origin` is that button in viewport coordinates ({x, y, right}).
 */
export function placeFloatingWindow(origin) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(360, vw - 32);
  const height = Math.min(560, vh - NAV_CLEARANCE - 16);
  return {
    width,
    height,
    left: clamp(origin.right + 24, 16, vw - width - 16),
    top: clamp(origin.y - 60, NAV_CLEARANCE, vh - height - 16),
  };
}

/**
 * A floating After Effects-style panel window: it grows out of the button that opened
 * it, can be dragged by its title bar and closes with × or Escape. `pulse` changes
 * when it's asked to open again while already open, so it nudges to show where it is.
 */
export default function DemoFloatingWindow({ open, title, src, origin, place, pulse, frameRef, onClose, onDragging }) {
  const reduce = useReducedMotion();
  const dragControls = useDragControls();
  const pulseControls = useAnimationControls();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (pulse > 0 && !reduce) pulseControls.start({ scale: [1, 1.04, 1], transition: { duration: 0.5, ease: [0.34, 1.32, 0.64, 1] } });
  }, [pulse, reduce, pulseControls]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // iframes swallow pointer moves, so they stop taking them while the window is dragged.
  const setDrag = (value) => {
    setDragging(value);
    onDragging?.(value);
  };

  // Rendered into <body>: a transformed ancestor (the page transition) would otherwise
  // pin "fixed" to the page instead of the screen.
  return createPortal(
    <AnimatePresence>
      {open && place && origin && (
        <motion.div
          key="floating-window"
          className="fixed z-[70]"
          style={{ left: place.left, top: place.top, width: place.width }}
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragElastic={0.06}
          dragConstraints={{
            left: 8 - place.left,
            right: window.innerWidth - place.left - place.width - 8,
            top: NAV_CLEARANCE - 8 - place.top,
            bottom: window.innerHeight - place.top - TITLE_HEIGHT - 8,
          }}
          onDragStart={() => setDrag(true)}
          onDragEnd={() => setDrag(false)}
          initial={
            reduce
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  scale: 0.16,
                  x: origin.x - (place.left + place.width / 2),
                  y: origin.y - (place.top + place.height / 2),
                  filter: "blur(10px)",
                }
          }
          animate={{ opacity: 1, scale: 1, x: 0, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0.2 } }
              : { opacity: 0, scale: 0.9, filter: "blur(8px)", transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }
          }
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 26,
            mass: 0.9,
            opacity: { duration: 0.22 },
            filter: { duration: 0.4 },
          }}
          role="dialog"
          aria-label={title}
          data-testid="demo-floating-window"
        >
          <motion.div
            animate={pulseControls}
            className="overflow-hidden rounded-[18px] bg-[#1d1d1d] shadow-[0_40px_100px_-30px_rgb(0_0_0/0.85),0_0_0_1px_rgb(255_255_255/0.1)]"
          >
            <div
              onPointerDown={(event) => dragControls.start(event)}
              className={`flex touch-none select-none items-center gap-2 border-b border-white/[0.06] bg-[#232323] pl-4 pr-2 ${
                dragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={{ height: TITLE_HEIGHT }}
            >
              <span className="truncate text-[12px] font-medium text-white/80">{title}</span>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={onClose}
                aria-label={`Close ${title}`}
                className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <iframe
              ref={frameRef}
              src={src}
              title={`${title} demo`}
              className={`block w-full border-0 bg-[#1d1d1d] ${dragging ? "pointer-events-none" : ""}`}
              style={{ height: place.height - TITLE_HEIGHT }}
              allow="autoplay"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
