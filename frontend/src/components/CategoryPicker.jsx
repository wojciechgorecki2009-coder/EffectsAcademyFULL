import { useState } from "react";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { buildFileUrl, getTheme } from "@/lib/api";
import { useUploadAccess } from "@/lib/uploadAccess";
import EditCategoryModal from "@/components/EditCategoryModal";

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
  const { isUploader } = useUploadAccess();
  const [editing, setEditing] = useState(null);

  const visible = items.filter((label) => !overrides[label]?.deleted);

  return (
    <>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5"
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
            <div
              key={label}
              className="asset-3d-in relative group"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <button
                onClick={() => onPick(label)}
                className="relative h-44 w-full rounded-2xl p-6 text-left btn-press overflow-hidden border border-white/5 hover:border-white/20 transition-colors block"
                style={{
                  background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
                }}
                data-testid={`${testIdPrefix}-${label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {img && (
                  <img
                    src={buildFileUrl(img)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-all duration-500 group-hover:scale-105"
                    style={{
                      opacity: 0.7,
                      filter: blur > 0 ? `blur(${blur}px) saturate(1.05)` : "saturate(1.05)",
                    }}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                )}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, ${theme.from}B3 0%, ${theme.to}E6 100%)`,
                  }}
                />
                <div
                  className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 blur-3xl pointer-events-none"
                  style={{ background: theme.accent }}
                />
                <div className="relative">
                  <div className="absolute -top-1 right-0 text-xs font-mono text-white/60">
                    {count}
                  </div>
                  <div
                    className="font-display text-xl md:text-2xl font-black tracking-tight pr-8 relative"
                    style={{
                      color: theme.text,
                      textShadow: `0 2px 24px rgba(0,0,0,0.65), 0 0 24px ${theme.accent}55`,
                    }}
                  >
                    {label}
                  </div>
                </div>
                <p className="absolute bottom-5 left-6 text-xs uppercase tracking-widest text-white/70 flex items-center gap-1.5 group-hover:text-white transition-colors">
                  View
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </p>
              </button>

              {isUploader && (
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({ label, override: ov, baseTheme, baseImage: images[label] });
                    }}
                    className="w-8 h-8 rounded-md bg-black/70 backdrop-blur-md border border-white/15 text-white hover:bg-black/90 btn-press flex items-center justify-center"
                    data-testid={`${testIdPrefix}-edit-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    title="Customize"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({ label, override: ov, baseTheme, baseImage: images[label], delete: true });
                    }}
                    className="w-8 h-8 rounded-md bg-red-600/40 backdrop-blur-md border border-red-500/40 text-red-100 hover:bg-red-600/60 btn-press flex items-center justify-center"
                    data-testid={`${testIdPrefix}-delete-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    title="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
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
