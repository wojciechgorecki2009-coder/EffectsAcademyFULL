import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { UploadAccessProvider } from "@/lib/uploadAccess";
import { AuthProvider } from "@/lib/auth";
import { motion, useReducedMotion } from "framer-motion";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { EASE_OUT } from "@/lib/motion";
import { LITE } from "@/lib/device";
import { useGlassSheen } from "@/components/LiquidGlass";
import { API } from "@/lib/api";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PersistentAudioBar from "@/components/PersistentAudioBar";
import PremiumTermsGate from "@/components/PremiumTermsGate";
import ExtensionLaunchAnnouncement from "@/components/ExtensionLaunchAnnouncement";
import Home from "@/pages/Home";
import CategoryPage from "@/pages/CategoryPage";
import DmcaPage from "@/pages/DmcaPage";
import SuggestionsPage from "@/pages/SuggestionsPage";
import LoginPage from "@/pages/LoginPage";
import PremiumPage from "@/pages/PremiumPage";
import GoogleCallbackPage from "@/pages/GoogleCallbackPage";
import { PrivacyPage, SupportPage, TermsPage } from "@/pages/LegalPages";
import SetupPage from "@/pages/SetupPage";
import DownloadAccessPage from "@/pages/DownloadAccessPage";
import StatsPage from "@/pages/StatsPage";
import "@/App.css";

// Loaded on demand so the converter (and ffmpeg) never weighs down other pages.
const ConverterPage = lazy(() => import("@/pages/ConverterPage"));
const RemoveBackgroundPage = lazy(() => import("@/pages/RemoveBackgroundPage"));

const ASSETS_CHANGED_EVENT = "effectsacademy:assets-changed";

function GlassSheenRoot({ children }) {
  useGlassSheen();
  return children;
}

// Each route enters like a new shot: a short rise with a de-blur.
// Touch devices skip it: fading the whole page means compositing the entire
// page as one offscreen layer, which is a lot of memory on a phone. The
// sections inside each page still animate in on their own.
function RouteTransition({ children }) {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  if (LITE) return <div key={pathname}>{children}</div>;
  return (
    <motion.div
      key={pathname}
      initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
      // Clearing the filter afterwards keeps fixed children and backdrop blur working normally.
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

function getVisitorId() {
  const key = "ea_visitor_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = `visitor_${window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
  localStorage.setItem(key, next);
  return next;
}

function AnalyticsTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    const visitor_id = getVisitorId();
    const postAnalytics = (payload) => {
      fetch(`${API}/analytics/visit`, {
        method: "POST",
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    };
    const sendVisit = () => postAnalytics({ visitor_id, path: pathname });
    const sendHeartbeat = () => {
      if (document.visibilityState === "visible") {
        postAnalytics({ visitor_id, path: pathname, heartbeat: true });
      }
    };
    sendVisit();
    const timer = window.setInterval(sendHeartbeat, 4 * 60 * 1000);
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") sendHeartbeat();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [pathname]);

  return null;
}

function RefreshableRoutes() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshKey((key) => key + 1);
    window.addEventListener(ASSETS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(ASSETS_CHANGED_EVENT, handler);
  }, []);

  return (
    <main key={refreshKey}>
      <RouteTransition>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/dmca" element={<DmcaPage />} />
        <Route path="/suggestions" element={<SuggestionsPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/premium" element={<PremiumPage />} />
        <Route path="/convert" element={<Suspense fallback={<div className="min-h-[70vh]" />}><ConverterPage /></Suspense>} />
        <Route path="/remove-background" element={<Suspense fallback={<div className="min-h-[70vh]" />}><RemoveBackgroundPage /></Suspense>} />
        <Route path="/ai-image" element={<Navigate to="/convert" replace />} />
        <Route path="/transcribe" element={<Navigate to="/convert" replace />} />
        <Route path="/products-i-use" element={<SetupPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/download/:token" element={<DownloadAccessPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      </Routes>
      </RouteTransition>
    </main>
  );
}

function AppFrame() {
  const { pathname } = useLocation();
  const isSetupMiniSite = pathname === "/products-i-use";
  const { scheme } = useTheme();

  return (
    <GlassSheenRoot>
      <div className={`App min-h-screen ${isSetupMiniSite ? "setup-mini-site-shell" : ""}`}>
        <ScrollToTopOnRouteChange />
        <AnalyticsTracker />
        {!isSetupMiniSite ? <Nav /> : null}
        <RefreshableRoutes />
        {!isSetupMiniSite ? <Footer /> : null}
        {!isSetupMiniSite ? <PersistentAudioBar /> : null}
        <ExtensionLaunchAnnouncement />
        <PremiumTermsGate />
        <Toaster
          theme={scheme}
          position="top-center"
          offset={88}
          mobileOffset={{ top: 80, left: 12, right: 12 }}
          toastOptions={{
            style: {
              background: "var(--glass-tint-strong)",
              backdropFilter: "blur(30px) saturate(190%)",
              WebkitBackdropFilter: "blur(30px) saturate(190%)",
              boxShadow: "var(--glass-shadow), inset 0 0 0 1px var(--line)",
              border: "0",
              borderRadius: "22px",
              color: "rgb(var(--ink))",
              fontFamily: "var(--font-text)",
              padding: "14px 18px",
            },
          }}
        />
      </div>
    </GlassSheenRoot>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UploadAccessProvider>
        <BrowserRouter>
        <AppFrame />
        </BrowserRouter>
        </UploadAccessProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
