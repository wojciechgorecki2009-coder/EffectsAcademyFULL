import { useEffect, useState } from "react";
import { ArrowRight, Crown, Download, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const CAMPAIGN_END = new Date("2026-10-02T23:59:59+01:00").getTime();
const EXTENSION_DESTINATION = "/premium#after-effects-extension";

const MOCK_CARDS = [
  ["Audio", "linear-gradient(145deg, #14342b, #20a874)"],
  ["Preset", "linear-gradient(145deg, #2b214d, #7558ff)"],
  ["Project", "linear-gradient(145deg, #45212b, #ec5079)"],
  ["Audio", "linear-gradient(145deg, #173553, #2d92dc)"],
  ["Premium", "linear-gradient(145deg, #49350c, #e6ad23)"],
  ["Preset", "linear-gradient(145deg, #3d1b43, #b350d0)"],
];

export default function ExtensionLaunchAnnouncement() {
  const navigate = useNavigate();
  const { hasPremium, loading, user } = useAuth();
  const [open, setOpen] = useState(() => Date.now() <= CAMPAIGN_END);
  const visible = open && !loading && Date.now() <= CAMPAIGN_END && !user?.premium_terms_required;

  useEffect(() => {
    if (!visible) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible]);

  if (!visible) return null;

  const openPremium = () => {
    setOpen(false);
    navigate(EXTENSION_DESTINATION);
    window.setTimeout(() => {
      document.getElementById("after-effects-extension")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  };

  return (
    <div
      className="extension-launch-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
      data-testid="extension-launch-announcement"
    >
      <section className="extension-launch-modal" role="dialog" aria-modal="true" aria-labelledby="extension-launch-title">
        <button
          type="button"
          className="extension-launch-close"
          onClick={() => setOpen(false)}
          aria-label="Close extension announcement"
        >
          <X aria-hidden="true" />
        </button>

        <div className="extension-launch-visual" aria-hidden="true">
          <div className="extension-launch-halo extension-launch-halo-one" />
          <div className="extension-launch-halo extension-launch-halo-two" />
          <div className="extension-launch-window">
            <div className="extension-launch-window-head">
              <img src="/favicon.png" alt="" />
              <span>EffectsAcademy</span>
              <i /><i /><i />
            </div>
            <div className="extension-launch-window-search">Search your premium library...</div>
            <div className="extension-launch-window-tabs">
              <span>All</span><span>Audios</span><span>Presets</span><span>Projects</span>
            </div>
            <div className="extension-launch-window-grid">
              {MOCK_CARDS.map(([label, background], index) => (
                <div className="extension-launch-window-card" key={`${label}-${index}`}>
                  <div style={{ background }}><Sparkles /></div>
                  <small>{label}</small>
                  <b>Add to comp</b>
                </div>
              ))}
            </div>
          </div>
          <div className="extension-launch-version"><span /> After Effects 2023+</div>
        </div>

        <div className="extension-launch-copy">
          <div className="extension-launch-kicker"><Sparkles /> New Premium release</div>
          <h2 id="extension-launch-title">Effects Academy,<br /><span>inside After Effects.</span></h2>
          <p>
            Browse, preview, and add your Effects Academy assets without leaving your edit. Plus, create animated captions directly on your timeline.
          </p>
          <div className="extension-launch-premium"><Crown /> Available exclusively with Premium</div>
          <div className="extension-launch-actions">
            <button type="button" onClick={openPremium} className="extension-launch-primary">
              {hasPremium ? <Download /> : <Crown />}
              {hasPremium ? "Go to extension download" : "Unlock with Premium"}
              <ArrowRight className="extension-launch-arrow" />
            </button>
            <button type="button" onClick={() => setOpen(false)} className="extension-launch-secondary">Maybe later</button>
          </div>
        </div>
      </section>
    </div>
  );
}
