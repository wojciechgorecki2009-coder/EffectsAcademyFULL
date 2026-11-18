import { useId } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { SHORT_PALM, TALL_PALM } from "@/lib/palmPaths";

/*
 * Vice City backdrop: palm silhouettes on both edges of the window. They slide in
 * from the sides as you scroll down (and back out at the top), and sway like real
 * trees: the trunk leans slowly from its base while the fronds move faster around
 * the crown. They sit behind the content, so they only show in the open space.
 */

const TREES = { tall: TALL_PALM, short: SHORT_PALM };

// One rotate() sway with smooth turnarounds, around a point given in the tree's own units.
function Sway({ degrees, at, seconds, offset }) {
  const [x, y] = at;
  return (
    <animateTransform
      attributeName="transform"
      type="rotate"
      values={`${-degrees} ${x} ${y}; ${degrees} ${x} ${y}; ${-degrees} ${x} ${y}`}
      keyTimes="0; 0.5; 1"
      calcMode="spline"
      keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
      dur={`${seconds}s`}
      begin={`${-offset}s`}
      repeatCount="indefinite"
    />
  );
}

function Palm({ kind, className, style, sway, opacity }) {
  const id = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const tree = TREES[kind];
  const [trunk, ...fronds] = tree.paths;
  return (
    <svg viewBox={tree.viewBox} className={`absolute bottom-0 h-auto ${className}`} style={{ ...style, opacity }} aria-hidden="true">
      <defs>
        {/* Lit from below by the sunset, like the skyline art */}
        <linearGradient id={`palm-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7b208f" />
          <stop offset="70%" stopColor="#c9349b" />
          <stop offset="100%" stopColor="#f36a78" />
        </linearGradient>
      </defs>
      <g fill={`url(#palm-${id})`}>
        {!reduce && <Sway degrees={sway.trunk} at={tree.base} seconds={sway.trunkSeconds} offset={sway.offset} />}
        <path d={trunk} />
        <g>
          {!reduce && <Sway degrees={sway.fronds} at={tree.crown} seconds={sway.frondSeconds} offset={sway.offset * 0.7} />}
          {fronds.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

// Each tree gets its own timing, so the four never move in step.
const SWAYS = {
  leftTall: { trunk: 1.1, trunkSeconds: 9, fronds: 2.6, frondSeconds: 5.4, offset: 0 },
  leftShort: { trunk: 1.4, trunkSeconds: 7.6, fronds: 3.2, frondSeconds: 4.6, offset: 2.3 },
  rightTall: { trunk: 1.2, trunkSeconds: 8.4, fronds: 2.8, frondSeconds: 5.9, offset: 4.1 },
  rightShort: { trunk: 1.5, trunkSeconds: 7.1, fronds: 3.4, frondSeconds: 4.9, offset: 1.2 },
};

export default function PalmBackdrop() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  // 0 at the top of the page, 1 once you've scrolled a little way down.
  const reveal = useSpring(useTransform(scrollY, [40, 520], [0, 1]), { stiffness: 90, damping: 20, mass: 1 });
  const leftX = useTransform(reveal, (p) => `${(1 - p) * -105}%`);
  const rightX = useTransform(reveal, (p) => `${(1 - p) * 105}%`);
  const fade = useTransform(reveal, [0, 0.35, 1], [0, 0.7, 1]);

  return (
    // z-index -5: above the decorative glows and fades that pages put at -10, still below
    // all real content.
    <div className="palm-backdrop pointer-events-none fixed inset-0 -z-[5] hidden overflow-hidden lg:block" aria-hidden="true">
      <motion.div className="absolute inset-y-0 left-0 w-1/2" style={reduce ? undefined : { x: leftX, opacity: fade }}>
        <Palm kind="short" className="left-[7vw]" style={{ height: "60vh", bottom: "-3vh" }} sway={SWAYS.leftShort} opacity={0.22} />
        <Palm kind="tall" className="-left-[7vw]" style={{ height: "96vh", bottom: "-2vh" }} sway={SWAYS.leftTall} opacity={0.34} />
      </motion.div>
      {/* The right side is the same pair, mirrored to lean in toward the page */}
      <motion.div className="absolute inset-y-0 right-0 w-1/2" style={reduce ? undefined : { x: rightX, opacity: fade }}>
        <div className="absolute inset-0 -scale-x-100">
          <Palm kind="short" className="left-[9vw]" style={{ height: "52vh", bottom: "-3vh" }} sway={SWAYS.rightShort} opacity={0.2} />
          <Palm kind="tall" className="-left-[6vw]" style={{ height: "90vh", bottom: "-2vh" }} sway={SWAYS.rightTall} opacity={0.32} />
        </div>
      </motion.div>
    </div>
  );
}
