import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Crown, Info } from "lucide-react";
import { BackButton, PageIntro } from "@/components/Library";
import AfterEffectsLogo from "@/components/AfterEffectsLogo";
import { EASE_OUT, Reveal } from "@/lib/motion";
import { FILE_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BASICS_FAQ, DEMO_TABS, TAB_FAQ, findFaqForAction } from "@/lib/extensionDemoFaq";

// The real extension panel in demo mode (see public/extension-demo/demo.js).
const DEMO_SRC = `/extension-demo/index.html?api=${encodeURIComponent(FILE_BASE)}`;
const FLASH_MS = 2600;

function FaqItem({ item, open, flash, onToggle }) {
  const reduce = useReducedMotion();
  return (
    <div
      id={`faq-${item.id}`}
      className={`scroll-mt-28 rounded-[18px] transition-[background-color,box-shadow] duration-700 ${
        flash ? "bg-[rgb(var(--tint)/0.08)] shadow-[inset_0_0_0_1.5px_rgb(var(--tint)/0.55)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold leading-snug text-ink"
      >
        {item.q}
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-3 transition-transform duration-500 ease-spring ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="overflow-hidden"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
          >
            <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-ink-2">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FaqList({ items, openIds, flashId, onToggle }) {
  return (
    <div className="surface divide-y divide-[var(--line)] rounded-[26px] p-1.5">
      {items.map((item) => (
        <FaqItem
          key={item.id}
          item={item}
          open={openIds.has(item.id)}
          flash={flashId === item.id}
          onToggle={() => onToggle(item.id)}
        />
      ))}
    </div>
  );
}

export default function TestExtensionPage() {
  const { hasPremium } = useAuth();
  const frameRef = useRef(null);
  const flashTimer = useRef(0);
  const [tab, setTab] = useState("All");
  const [openIds, setOpenIds] = useState(() => new Set([TAB_FAQ.All.items[0].id]));
  const [flashId, setFlashId] = useState("");

  const toggle = useCallback((id) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Opens and highlights the answer for the button just pressed in the panel.
  const showAnswer = useCallback((actionId, currentTab) => {
    const found = findFaqForAction(actionId, currentTab);
    if (!found) return;
    if (!found.inBasics && found.tab !== currentTab) setTab(found.tab);
    setOpenIds((current) => new Set(current).add(found.item.id));
    setFlashId(found.item.id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(""), FLASH_MS);
    // Side by side, bring the answer into view; on phones the panel stays where it is.
    if (window.matchMedia("(min-width: 1024px)").matches) {
      window.requestAnimationFrame(() => {
        document.getElementById(`faq-${found.item.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }, []);

  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "ea-extension-demo") return;
      if (data.type === "tab" && TAB_FAQ[data.tab]) {
        if (data.tab !== tabRef.current) {
          setTab(data.tab);
          const first = TAB_FAQ[data.tab].items[0];
          if (first) setOpenIds((current) => new Set(current).add(first.id));
        }
      } else if (data.type === "action") {
        showAnswer(data.id, tabRef.current);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(flashTimer.current);
    };
  }, [showAnswer]);

  // Picking a tab here also opens it in the panel.
  const pickTab = (name) => {
    setTab(name);
    const first = TAB_FAQ[name].items[0];
    if (first) setOpenIds((current) => new Set(current).add(first.id));
    frameRef.current?.contentWindow?.postMessage(
      { source: "ea-extension-demo-host", type: "open-tab", tab: name },
      window.location.origin,
    );
  };

  const section = TAB_FAQ[tab] || TAB_FAQ.All;

  return (
    // overflow-clip, not hidden: a hidden box can still be scrolled sideways (focus moving in
    // the iframe did that), and it would stop the panel from staying in view.
    <section className="relative min-h-[calc(100vh-4rem)] overflow-clip px-4 pb-28 pt-28 sm:px-6 md:pt-32" data-testid="test-extension-page">
      <div className="aurora -z-10 !opacity-30" aria-hidden="true" style={{ inset: "-30% -10% auto", height: "80vh" }}>
        <span />
        <span />
        <span />
      </div>

      <div className="mx-auto max-w-[1120px]">
        <BackButton to="/premium">Premium</BackButton>

        <PageIntro eyebrow="Test the extension" icon={<AfterEffectsLogo className="!h-4 !w-4" />} title="Try it before you subscribe.">
          This is the real Effects Academy panel with the live library, running in your browser. Click around: every button tells you
          what it would do in After Effects, and the FAQ beside it explains each tab.
        </PageIntro>

        <Reveal className="mt-8">
          <div className="notice flex items-start gap-3 !rounded-[20px]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This is a demo. Nothing is downloaded, and nothing is added to After Effects.</span>
          </div>
        </Reveal>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-10">
          {/* The panel, framed like a docked After Effects panel */}
          <Reveal className="lg:sticky lg:top-24">
            <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[22px] bg-[#1d1d1d] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.65),0_0_0_1px_rgb(255_255_255/0.08)]">
              <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#232323] px-4 py-2.5">
                <span className="text-[12px] font-medium text-white/80">Effects Academy</span>
                <span className="ml-auto flex items-center gap-1" aria-hidden="true">
                  <span className="h-[3px] w-[3px] rounded-full bg-white/40" />
                  <span className="h-[3px] w-[3px] rounded-full bg-white/40" />
                  <span className="h-[3px] w-[3px] rounded-full bg-white/40" />
                </span>
              </div>
              <iframe
                ref={frameRef}
                src={DEMO_SRC}
                title="Effects Academy extension demo"
                className="block h-[min(760px,78vh)] w-full border-0 bg-[#1d1d1d]"
                allow="autoplay"
                data-testid="extension-demo-frame"
              />
            </div>
          </Reveal>

          {/* FAQ for the open tab, then the basics */}
          <div className="min-w-0">
            <Reveal>
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Extension tabs">
                {DEMO_TABS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-selected={tab === name}
                    onClick={() => pickTab(name)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-300 ${
                      tab === name ? "bg-tint text-tint-ink" : "bg-[var(--fill)] text-ink-2 hover:text-ink"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </Reveal>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={section.title}
                className="mt-6"
                initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <p className="eyebrow">{section.title} tab</p>
                <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">{section.intro}</p>
                <div className="mt-5">
                  <FaqList items={section.items} openIds={openIds} flashId={flashId} onToggle={toggle} />
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-12">
              <p className="eyebrow">{BASICS_FAQ.title}</p>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">The parts of the panel you'll see on every tab.</p>
              <div className="mt-5">
                <FaqList items={BASICS_FAQ.items} openIds={openIds} flashId={flashId} onToggle={toggle} />
              </div>
            </div>

            <Reveal className="mt-12">
              <div className="surface flex flex-col items-start gap-4 rounded-[26px] p-6 sm:flex-row sm:items-center">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--tint)/0.12)] text-tint">
                  <Crown className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">{hasPremium ? "You already have Premium" : "Like what you see?"}</p>
                  <p className="mt-0.5 text-[14px] text-ink-2">
                    {hasPremium
                      ? "Download the extension and connect it from the Premium page."
                      : "The extension comes with Premium, together with every Premium asset."}
                  </p>
                </div>
                <Link to="/premium" className="btn btn-primary shrink-0">
                  {hasPremium ? "Open Premium page" : "Get Premium"}
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
