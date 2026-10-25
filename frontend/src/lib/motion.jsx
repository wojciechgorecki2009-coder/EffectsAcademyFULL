import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";

/*
 * Motion language
 * - Everything enters like a motion-graphics layer: it rises a few pixels,
 *   de-blurs and fades in on a long expo-out curve, never pops.
 * - Interactive elements use springs so they settle naturally.
 */

export const EASE_OUT = [0.16, 1, 0.3, 1];
export const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 };
export const SPRING_SOFT = { type: "spring", stiffness: 160, damping: 24, mass: 1 };
export const SPRING_SNAPPY = { type: "spring", stiffness: 520, damping: 36 };

export const riseVariants = {
  hidden: { opacity: 0, y: 24, filter: "blur(10px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" }, transition: { duration: 0.9, ease: EASE_OUT } },
};

/** Fades/rises its children in once they scroll into view. */
export function Reveal({ as = "div", delay = 0, y = 24, blur = 10, once = true, amount = 0.2, className, children, ...rest }) {
  const reduce = useReducedMotion();
  const Comp = motion[as] || motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: `blur(${blur}px)` }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      viewport={{ once, amount }}
      transition={{ duration: 0.9, ease: EASE_OUT, delay }}
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

/** Splits a line into words that slide up from behind a mask, kinetic-type style. */
export function KineticText({ text, className = "", wordClassName = "", delay = 0, stagger = 0.08, highlight = {} }) {
  const reduce = useReducedMotion();
  const words = String(text).split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true" className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]">
          <motion.span
            className={`inline-block ${highlight[word] || ""} ${wordClassName}`}
            initial={reduce ? false : { y: "105%", opacity: 0, filter: "blur(8px)" }}
            animate={{ y: "0%", opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            transition={{ duration: 1.05, ease: EASE_OUT, delay: delay + index * stagger }}
          >
            {word}
          </motion.span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
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
