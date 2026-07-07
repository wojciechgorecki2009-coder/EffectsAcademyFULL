import { Link } from "react-router-dom";

const SUPPORT_EMAIL = "EffectsAcademy2026@hotmail.com";

export default function Footer() {
  return (
    <footer
      className="border-t border-white/5 mt-24 py-12 px-6 md:px-12"
      data-testid="footer"
    >
      <div className="max-w-[1400px] mx-auto grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img
              src="/apple-touch-icon.png"
              alt="Effects Academy"
              className="h-10 w-10 rounded-full object-cover flex-shrink-0"
              style={{ filter: "drop-shadow(0 0 10px rgba(82,87,255,0.5))" }}
            />
            <span className="font-display font-bold tracking-tight">
              Effects<span className="text-neon">Academy</span>
            </span>
          </div>
          <p className="text-sm text-zinc-500 leading-relaxed">
            A curated library of free and premium editing assets for video editors, including project files,
            overlays, presets, audios, sound effects, torrents, and AI tools.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-4 inline-flex text-xs font-mono text-zinc-400 hover:text-neon transition-colors"
            data-testid="footer-support-email"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
        <div>
          <h4 className="font-display font-semibold mb-3 text-sm">Browse</h4>
          <ul className="space-y-1.5 text-sm text-zinc-400">
            <li><Link to="/category/torrents" className="hover:text-neon transition-colors">Torrents</Link></li>
            <li><Link to="/category/project-files" className="hover:text-neon transition-colors">Project Files</Link></li>
            <li><Link to="/category/overlays" className="hover:text-neon transition-colors">Overlays</Link></li>
            <li><Link to="/category/audios" className="hover:text-neon transition-colors">Audios</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold mb-3 text-sm">Community</h4>
          <ul className="space-y-1.5 text-sm text-zinc-400">
            <li><Link to="/category/sound-fx" className="hover:text-neon transition-colors">Sound FX</Link></li>
            <li><Link to="/category/presets" className="hover:text-neon transition-colors">Presets</Link></li>
            <li><Link to="/category/premium" className="hover:text-neon transition-colors">Premium</Link></li>
            <li>
              <a
                href="https://discord.gg/2VvMq3Pz85"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neon transition-colors"
                data-testid="footer-discord"
              >
                Discord
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold mb-3 text-sm">Support & Legal</h4>
          <ul className="space-y-1.5 text-sm text-zinc-400">
            <li><Link to="/dmca" data-testid="footer-dmca" className="hover:text-neon transition-colors">DMCA</Link></li>
            <li><Link to="/suggestions" data-testid="footer-suggestions" className="hover:text-neon transition-colors">Suggestions</Link></li>
            <li><Link to="/terms" data-testid="footer-terms" className="hover:text-neon transition-colors">Terms of Use</Link></li>
            <li><Link to="/privacy" data-testid="footer-privacy" className="hover:text-neon transition-colors">Privacy Policy</Link></li>
            <li><Link to="/support" className="hover:text-neon transition-colors">Contact support</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto mt-10 pt-6 border-t border-white/5 text-xs text-zinc-600 leading-relaxed">
        © {new Date().getFullYear()} Effects Academy. All trademarks belong to their respective owners. Content may be removed if reported by a rights holder.
      </div>
    </footer>
  );
}
