import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { buildFileUrl, getTheme } from "@/lib/api";
import { useUploadAccess } from "@/lib/uploadAccess";
import EditCategoryModal from "@/components/EditCategoryModal";
import { EASE_OUT } from "@/lib/motion";

const DEFAULT_BLUR_PX = 0; // sharper by default per latest spec

/**
 * Reusable category-picker grid for Audio creators / Torrent shows.
 *
 * Props:
 *   items: string[]           — labels (filter key)
 *   themes: object            — predefined themes per label
 *   images: object            — predefined image URL per label
 *   overrides: { [label]: { image_url, color_from, color_to, accent, text_color, blur_px, deleted } }
 *   kind: "creator" | "show"  — for override mutations
 *   getCount: (label) => number
 *   onPick: (label) => void
 *   onChanged: () => void
 *   testIdPrefix: string
 */
export default function CategoryPicker({
  items,
  themes,
  images = {},
  overrides = {},
  kind,
  getCount,
  onPick,
  onChanged,
  testIdPrefix,
}) {
  const { canDelete } = useUploadAccess();
  const [editing, setEditing] = useState(null);
  const reduce = useReducedMotion();

  const visible = items.filter((label) => !overrides[label]?.deleted);

  return (
    <>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-testid={`${testIdPrefix}-grid`}
      >
        {visible.map((label, idx) => {
          const baseTheme = getTheme(label, themes);
          const ov = overrides[label] || {};
          const theme = {
            from: ov.color_from || baseTheme.from,
            to: ov.color_to || baseTheme.to,
            accent: ov.accent || baseTheme.accent,
            text: ov.text_color || baseTheme.text,
          };
          const count = getCount(label);
          const img = ov.image_url || images[label];
          const blur = typeof ov.blur_px === "number" ? ov.blur_px : DEFAULT_BLUR_PX;
          return (
            <motion.div
              key={label}
              className="group relative"
              initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.85, ease: EASE_OUT, delay: (idx % 4) * 0.07 }}
            >
              <button
                onClick={() => onPick(label)}
                className="relative block h-52 w-full overflow-hidden rounded-[24px] text-left shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-700 ease-spring hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(140deg, ${theme.from} 0%, ${theme.to} 100%)`,
                  color: "#fff",
                }}
                data-testid={`${testIdPrefix}-${label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {img && (
                  <img
                    src={buildFileUrl(img)}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out-expo group-hover:scale-[1.07]"
                    style={{
                      opacity: 0.85,
                      filter: blur > 0 ? `blur(${blur}px) saturate(1.05)` : "saturate(1.05)",
                    }}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                )}
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, ${theme.from}33 0%, ${theme.to}cc 62%, ${theme.to} 100%)`,
                  }}
                />
                <span
                  className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-40 blur-3xl transition-transform duration-[1400ms] ease-out-expo group-hover:scale-125"
                  style={{ background: theme.accent }}
                />
                <span className="pointer-events-none absolute inset-0 rounded-[24px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08),inset_0_1px_0_rgb(255_255_255/0.14)]" />

                <span className="media-chip chip absolute left-3.5 top-3.5 tabular-nums">
                  {count} {count === 1 ? "item" : "items"}
                </span>

                <span className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
                  <span
                    className="font-display text-[1.375rem] font-semibold leading-[1.1] tracking-[-0.025em]"
                    style={{ color: theme.text, textShadow: "0 2px 18px rgba(0,0,0,0.45)" }}
                  >
                    {label}
                  </span>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:scale-110"
                    style={{ background: "rgb(255 255 255 / 0.16)", boxShadow: "inset 0 0 0 0.5px rgb(255 255 255 / 0.25)" }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </span>
              </button>

              {canDelete && (
                <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({ label, override: ov, baseTheme, baseImage: images[label] });
                    }}
                    className="media-chip flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300 ease-spring hover:scale-110"
                    data-testid={`${testIdPrefix}-edit-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    title="Customize"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({ label, override: ov, baseTheme, baseImage: images[label], delete: true });
                    }}
                    className="media-chip flex h-8 w-8 items-center justify-center rounded-full !text-[#ff6961] transition-transform duration-300 ease-spring hover:scale-110"
                    data-testid={`${testIdPrefix}-delete-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    title="Delete category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <EditCategoryModal
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        kind={kind}
        label={editing?.label}
        override={editing?.override}
        baseTheme={editing?.baseTheme}
        baseImage={editing?.baseImage}
        defaultDelete={editing?.delete}
        onSaved={() => {
          setEditing(null);
          onChanged?.();
        }}
      />
    </>
  );
}
