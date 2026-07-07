import { useEffect, useState } from "react";
import { Search, Sparkles } from "lucide-react";

export default function Hero({ query, setQuery, totalAssets }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setPan({ x, y });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <section
      className="relative isolate overflow-hidden min-h-[64vh] md:min-h-[58vh] flex flex-col items-center justify-center text-center px-6 pt-24 pb-12 md:pt-20 md:pb-10"
      data-testid="hero-section"
    >
      {/* Animated in-house background layer */}
      <div
        className="absolute inset-0 -z-10 overflow-hidden pointer-events-none hero-animated-backdrop"
        style={{
          transform: `translate3d(${pan.x * 0.4}px, ${pan.y * 0.4}px, 0) scale(1.05)`,
          transition: "transform 0.3s ease-out",
        }}
        data-testid="hero-bg-gradient"
      />
      {/* Soft blend layers */}
      <div className="absolute inset-0 -z-10 hero-theme-overlay" />
      <div className="absolute inset-0 -z-10 hero-theme-gradient" />
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 45%, rgba(82,87,255,0.25) 0%, transparent 70%)",
        }}
      />

      <div
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs uppercase tracking-widest text-zinc-200 mb-8 hero-bounce backdrop-blur-md"
        data-testid="hero-badge"
      >
        <Sparkles className="w-3.5 h-3.5 text-neon" />
        Free assets for video editors
      </div>

      <h1
        className="hero-bounce font-display font-black text-5xl md:text-7xl lg:text-8xl tracking-tighter leading-[0.95] mb-6"
        data-testid="hero-title"
        style={{ textShadow: "0 4px 40px rgba(0,0,0,0.6)" }}
      >
        Level up your{" "}
        <span
          style={{
            color: "#4c61fc",
            filter: "drop-shadow(0 0 30px rgba(76,97,252,0.55))",
          }}
        >
          edits
        </span>
      </h1>

      <p
        className="hero-bounce hero-bounce-delay text-zinc-300 max-w-2xl text-base md:text-lg leading-relaxed mb-10"
        data-testid="hero-description"
        style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}
      >
        Effects Academy is a curated vault for video editors: project files, overlays, presets, audios,
        sound effects, torrents, premium packs, and AI tools in one clean library.
      </p>

      <div className="relative w-full max-w-2xl hero-bounce hero-bounce-delay">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets..."
          className="w-full h-14 pl-14 pr-6 bg-black/40 backdrop-blur-xl border border-white/15 rounded-2xl text-lg focus:border-neon/60 focus:outline-none transition-colors text-white placeholder:text-zinc-400"
          data-testid="hero-search-input"
        />
      </div>

      {totalAssets > 0 && (
        <p className="mt-6 text-xs font-mono uppercase tracking-widest text-zinc-400">
          {totalAssets} assets and counting
        </p>
      )}
    </section>
  );
}
