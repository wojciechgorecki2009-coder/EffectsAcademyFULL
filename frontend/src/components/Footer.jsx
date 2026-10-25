import { Link } from "react-router-dom";
import { Reveal } from "@/lib/motion";

const SUPPORT_EMAIL = "EffectsAcademy2026@hotmail.com";

const linkClass = "text-ink-2 transition-colors duration-200 hover:text-ink hover:underline hover:underline-offset-4";

function Column({ title, children }) {
  return (
    <div>
      <h4 className="mb-3 text-[12px] font-semibold text-ink">{title}</h4>
      <ul className="space-y-2.5 text-[13px]">{children}</ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="mt-12 bg-panel-2/60 px-5 pb-32 pt-14 md:px-8" style={{ boxShadow: "inset 0 1px 0 var(--line)" }} data-testid="footer">
      <Reveal className="mx-auto max-w-[1320px]" y={16} blur={6}>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <img
                src="/apple-touch-icon.png"
                alt="Effects Academy"
                className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
              />
              <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">Effects Academy</span>
            </div>
            <p className="max-w-sm text-[13px] leading-relaxed text-ink-3">
              A curated library of free and premium editing assets for video editors, including project files,
              overlays, presets, audios, sound effects, torrents, videos, and a free video converter.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-4 inline-flex text-[13px] text-tint hover:underline hover:underline-offset-4"
              data-testid="footer-support-email"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
          <Column title="Browse">
            <li><Link to="/category/torrents" className={linkClass}>Torrents</Link></li>
            <li><Link to="/category/project-files" className={linkClass}>Project Files</Link></li>
            <li><Link to="/category/overlays" className={linkClass}>Overlays</Link></li>
            <li><Link to="/category/audios" className={linkClass}>Audios</Link></li>
            <li><Link to="/category/videos" className={linkClass}>Videos</Link></li>
            <li><Link to="/convert" className={linkClass}>Video Converter</Link></li>
          </Column>
          <Column title="Community">
            <li><Link to="/category/sound-fx" className={linkClass}>Sound FX</Link></li>
            <li><Link to="/category/presets" className={linkClass}>Presets</Link></li>
            <li><Link to="/category/premium" className={linkClass}>Premium</Link></li>
            <li>
              <a
                href="https://discord.gg/2VvMq3Pz85"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
                data-testid="footer-discord"
              >
                Discord
              </a>
            </li>
          </Column>
          <Column title="Support & Legal">
            <li><Link to="/dmca" data-testid="footer-dmca" className={linkClass}>DMCA</Link></li>
            <li><Link to="/suggestions" data-testid="footer-suggestions" className={linkClass}>Suggestions</Link></li>
            <li><Link to="/terms" data-testid="footer-terms" className={linkClass}>Terms of Use</Link></li>
            <li><Link to="/privacy" data-testid="footer-privacy" className={linkClass}>Privacy Policy</Link></li>
            <li><Link to="/support" className={linkClass}>Contact support</Link></li>
          </Column>
        </div>
        <div className="mt-12 border-t border-[var(--line)] pt-5 text-[12px] leading-relaxed text-ink-3">
          Copyright © {new Date().getFullYear()} Effects Academy. All trademarks belong to their respective owners. Content may be removed if reported by a rights holder.
        </div>
      </Reveal>
    </footer>
  );
}
