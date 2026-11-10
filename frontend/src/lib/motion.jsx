import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { prepareTypewriter, supportsTypewriter, typedLength } from "@/lib/typewriter";

/*
 * Motion language
 * - Everything enters like a motion-graphics layer: it rises a few pixels,
 *   de-blurs and fades in on a long expo-out curve, never pops.
 * - Interactive elements use springs so they settle naturally.
 * - With the JetBrains Mono font, text is typed out instead (lib/typewriter.js):
 *   KineticText, FadeText and text-only Reveals type; cards and media still rise.
 */

export const EASE_OUT = [0.16, 1, 0.3, 1];
export const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 };
export const SPRING_SOFT = { type: "spring", stiffness: 160, damping: 24, mass: 1 };
export const SPRING_SNAPPY = { type: "spring", stiffness: 520, damping: 36 };
// Headline words rise past their resting line and settle back, like the Pop Up and
// Swing Up presets in the After Effects extension. It overshoots by about a tenth of
// the travel, which the word mask leaves room for (see KineticText).
export const SPRING_BOUNCE = { type: "spring", stiffness: 240, damping: 18, mass: 1 };

export const riseVariants = {
  hidden: { opacity: 0, y: 24, filter: "blur(10px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" }, transition: { duration: 0.9, ease: EASE_OUT } },
};

/** True when text should be typed: the JetBrains Mono font, motion allowed, browser able. */
export function useTypewriterMode() {
  const theme = useTheme();
  const reduce = useReducedMotion();
  return Boolean(theme?.font === "mono" && !reduce && supportsTypewriter);
}

/**
 * Types the text inside `ref` while `active`. The text is hidden before the first
 * paint, then typed `delay` seconds after `when` becomes true (straight away by default).
 */
export function useTypeIn(ref, { active, delay = 0, when = true, msPerChar, maxDuration, onDone } = {}) {
  const controller = useRef(null);
  const started = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

  useLayoutEffect(() => {
    if (!active) return undefined;
    started.current = false;
    controller.current = prepareTypewriter(ref.current, { msPerChar, maxDuration, onDone: () => done.current?.() });
    return () => {
      controller.current?.cancel();
      controller.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || !when || started.current || !controller.current) return;
    started.current = true;
    controller.current.start(delay * 1000);
  }, [active, when, delay]);
}

// A Reveal is typed only when it holds a short run of plain text: anything with
// media, links, buttons, lists or tables keeps the normal rise.
const NOT_PLAIN_TEXT = "img,video,iframe,canvas,table,button,input,select,textarea,ul,ol,a,[role=button],[role=tab]";
function isPlainText(element) {
  if (!element || element.querySelector(NOT_PLAIN_TEXT)) return false;
  const length = typedLength(element);
  return length > 0 && length <= 360;
}

/** Fades/rises its children in once they scroll into view (types plain text with the mono font). */
export function Reveal({ as = "div", delay = 0, y = 24, blur = 10, once = true, amount = 0.2, className, children, ...rest }) {
  const reduce = useReducedMotion();
  const typing = useTypewriterMode();
  const ref = useRef(null);
  const [typeIt, setTypeIt] = useState(false);
  const inView = useInView(ref, { once: true, amount });

  useLayoutEffect(() => {
    setTypeIt(typing && isPlainText(ref.current));
  }, [typing]);
  useTypeIn(ref, { active: typeIt, delay, when: inView });

  const Comp = motion[as] || motion.div;
  return (
    <Comp
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: `blur(${blur}px)` }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      viewport={{ once, amount }}
      transition={typeIt ? { duration: 0.01 } : { duration: 0.9, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Staggers direct <StaggerItem> children as the group enters the viewport. */
export function Stagger({ as = "div", stagger = 0.06, delay = 0, amount = 0.08, className, children, ...rest }) {
  const reduce = useReducedMotion();
  const Comp = motion[as] || motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({ as = "div", className, children, ...rest }) {
  const Comp = motion[as] || motion.div;
  return (
    <Comp className={className} variants={riseVariants} {...rest}>
      {children}
    </Comp>
  );
}

/**
 * Splits a line into words that slide up from behind a mask, kinetic-type style.
 * With the mono font the line is typed instead; highlighted words (the shimmer)
 * light up once the typing reaches the end.
 */
export function KineticText({ text, className = "", wordClassName = "", delay = 0, stagger = 0.08, highlight = {} }) {
  const reduce = useReducedMotion();
  const typing = useTypewriterMode();
  const typedRef = useRef(null);
  const [typedDone, setTypedDone] = useState(false);
  useTypeIn(typedRef, { active: typing, delay, msPerChar: 55, maxDuration: 1300, onDone: () => setTypedDone(true) });
  const words = String(text).split(" ");

  if (typing) {
    return (
      <span className={className}>
        <span className="sr-only">{text}</span>
        <span ref={typedRef} aria-hidden="true">
          {words.map((word, index) => (
            <Fragment key={`${word}-${index}`}>
              <span className={`${typedDone && highlight[word] ? `-mx-[0.1em] px-[0.1em] ${highlight[word]}` : ""} ${wordClassName}`}>{word}</span>
              {index < words.length - 1 ? " " : null}
            </Fragment>
          ))}
        </span>
      </span>
    );
  }

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {/* The space goes between the word boxes, not inside them: a space at the end of an
          inline-block is dropped by some browsers, which ran the words together. */}
      {/* The mask only clips top and bottom (the slide is vertical), with room below for
          descenders, so letters that reach past their spacing (e, D, v, the tail of p)
          are never trimmed. The space above also holds the bounce's overshoot. The word's
          own padding lets a shimmer gradient cover the whole letter; the negative margins
          keep the spacing unchanged. */}
      {words.map((word, index) => {
        const wordDelay = delay + index * stagger;
        return (
          <Fragment key={`${word}-${index}`}>
            <span aria-hidden="true" className="inline-block overflow-x-visible overflow-y-clip align-bottom pt-[0.36em] -mt-[0.36em] pb-[0.24em] -mb-[0.24em]">
              <motion.span
                className={`-mx-[0.1em] inline-block px-[0.1em] pb-[0.1em] -mb-[0.1em] ${highlight[word] || ""} ${wordClassName}`}
                initial={reduce ? false : { y: "125%", opacity: 0, filter: "blur(8px)" }}
                animate={{ y: "0%", opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                // Only the rise bounces; the fade and de-blur stay smooth.
                transition={{
                  default: { ...SPRING_BOUNCE, delay: wordDelay },
                  opacity: { duration: 0.55, ease: EASE_OUT, delay: wordDelay },
                  filter: { duration: 0.75, ease: EASE_OUT, delay: wordDelay },
                }}
              >
                {word}
              </motion.span>
            </span>
            {index < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </span>
  );
}

/**
 * A line of text that fades/rises in on mount (page intros, eyebrows), or is typed
 * with the mono font. `x`, `y` and `blur` describe where the fade starts.
 */
export function FadeText({ as = "p", delay = 0, x = 0, y = 12, blur = 6, duration = 0.9, className, children, ...rest }) {
  const reduce = useReducedMotion();
  const typing = useTypewriterMode();
  const ref = useRef(null);
  useTypeIn(ref, { active: typing, delay });
  const Comp = motion[as] || motion.p;
  return (
    <Comp
      ref={ref}
      className={className}
      initial={reduce || typing ? false : { opacity: 0, x, y, ...(blur ? { filter: `blur(${blur}px)` } : {}) }}
      animate={{ opacity: 1, x: 0, y: 0, ...(blur ? { filter: "blur(0px)", transitionEnd: { filter: "none" } } : {}) }}
      transition={{ duration, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Counts up to `value` when it first becomes visible. */
export function CountUp({ value, duration = 1.4, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) {
      setDisplay(value);
      return undefined;
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
    </span>
  );
}
