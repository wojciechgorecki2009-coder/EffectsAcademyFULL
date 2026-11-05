/** Small "Beta" pill for features still being tried out. */
export default function BetaBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-[rgb(255_159_10/0.16)] px-1.5 py-px text-[9.5px] font-bold uppercase leading-[1.5] tracking-[0.06em] text-[#ff9f0a] ${className}`}
    >
      Beta
    </span>
  );
}
