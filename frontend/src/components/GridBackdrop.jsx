import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

/*
 * Black & White backdrop: a fine grey grid that rises from the bottom of the window and
 * fades in as you scroll down (and sinks away again at the top). It's slightly blurred
 * and fades out toward the top of the screen, so it reads as a soft floor of light
 * behind the content rather than graph paper. The look is in index.css (.grid-backdrop).
 */
export default function GridBackdrop() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  // 0 at the top of the page, 1 once you've scrolled a little way down.
  const reveal = useSpring(useTransform(scrollY, [40, 560], [0, 1]), { stiffness: 80, damping: 22, mass: 1 });
  const y = useTransform(reveal, (p) => `${(1 - p) * 35}%`);
  const opacity = useTransform(reveal, [0, 1], [0, 1]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden" aria-hidden="true">
      <motion.div className="grid-backdrop absolute inset-0" style={reduce ? undefined : { y, opacity }} />
    </div>
  );
}
