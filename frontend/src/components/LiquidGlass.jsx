import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/*
 * Liquid Glass
 *
 * The CSS material (.lg in index.css) provides tint, blur, a specular rim and
 * a pointer-following sheen. On Chromium we go further: an SVG displacement
 * map, generated for the element's exact size, bends the backdrop near the
 * edges the way a thick glass lens does. Other engines keep the CSS material.
 */

const supportsRefraction = (() => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const brands = navigator.userAgentData?.brands || [];
  const isChromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
  if (!isChromium) return false;
  if (window.matchMedia?.("(prefers-reduced-transparency: reduce)")?.matches) return false;
  return window.CSS?.supports?.("backdrop-filter", "url(#a)") ?? false;
})();

function channelMap(width, height, edge, axis) {
  // Red encodes horizontal displacement, green vertical. 128 is neutral; edges
  // push samples inward so the backdrop appears to bend around the rim.
  const color = (v) => (axis === "x" ? `rgb(${v},0,0)` : `rgb(0,${v},0)`);
  const span = axis === "x" ? width : height;
  const e = Math.min(edge, span / 2);
  const p = (px) => `${((px / span) * 100).toFixed(3)}%`;
  const stops = [
    [0, 236], [e * 0.35, 176], [e, 128], [span - e, 128], [span - e * 0.35, 80], [span, 20],
  ]
    .map(([o, v]) => `<stop offset="${p(o)}" stop-color="${color(v)}"/>`)
    .join("");
  const [x2, y2] = axis === "x" ? ["100%", "0%"] : ["0%", "100%"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0%" y1="0%" x2="${x2}" y2="${y2}">${stops}</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function RefractionFilter({ id, width, height, edge, strength }) {
  if (!width || !height) return null;
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <filter
        id={id}
        x="0"
        y="0"
        width={width}
        height={height}
        filterUnits="userSpaceOnUse"
        primitiveUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feImage href={channelMap(width, height, edge, "x")} x="0" y="0" width={width} height={height} preserveAspectRatio="none" result="mx" />
        <feImage href={channelMap(width, height, edge, "y")} x="0" y="0" width={width} height={height} preserveAspectRatio="none" result="my" />
        <feComposite in="mx" in2="my" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

const LiquidGlass = forwardRef(function LiquidGlass(
  { as: Tag = "div", className = "", refract = true, edge = 22, strength = 38, children, style, ...rest },
  forwardedRef
) {
  const innerRef = useRef(null);
  const rawId = useId();
  const filterId = `lg-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const enabled = refract && supportsRefraction;

  const setRefs = (node) => {
    innerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  useLayoutEffect(() => {
    if (!enabled || !innerRef.current) return undefined;
    const node = innerRef.current;
    const measure = () => {
      const w = Math.round(node.offsetWidth);
      const h = Math.round(node.offsetHeight);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [enabled]);

  const active = enabled && size.w > 0 && size.h > 0;

  return (
    <Tag
      ref={setRefs}
      className={`lg lg-refract ${className}`}
      data-refract={active ? "on" : "off"}
      style={active ? { ...style, "--lg-refract-filter": `url(#${filterId})` } : style}
      {...rest}
    >
      {active && <RefractionFilter id={filterId} width={size.w} height={size.h} edge={edge} strength={strength} />}
      {children}
    </Tag>
  );
});

export default LiquidGlass;

/*
 * One passive listener drives the specular sheen on every glass surface: the
 * highlight drifts toward the pointer, like light catching a real lens.
 */
export function useGlassSheen() {
  useEffect(() => {
    if (window.matchMedia?.("(pointer: coarse)")?.matches) return undefined;
    let frame = 0;
    let last = null;
    const onMove = (event) => {
      last = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const target = last?.target?.closest?.(".lg, .glass");
        if (!target) return;
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--px", `${(((last.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
        target.style.setProperty("--py", `${(((last.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
}
