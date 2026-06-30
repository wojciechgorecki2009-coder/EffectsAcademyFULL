import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { UploadAccessProvider } from "@/lib/uploadAccess";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PersistentAudioBar from "@/components/PersistentAudioBar";
import Home from "@/pages/Home";
import CategoryPage from "@/pages/CategoryPage";
import DmcaPage from "@/pages/DmcaPage";
import SuggestionsPage from "@/pages/SuggestionsPage";
import LoginPage from "@/pages/LoginPage";
import PremiumPage from "@/pages/PremiumPage";
import GoogleCallbackPage from "@/pages/GoogleCallbackPage";
import { PrivacyPage, TermsPage } from "@/pages/LegalPages";
import AiImagePage from "@/pages/AiImagePage";
import "@/App.css";

const ASSETS_CHANGED_EVENT = "effectsacademy:assets-changed";

function MouseParallaxRoot({ children }) {
  useEffect(() => {
    const handler = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      document.documentElement.style.setProperty("--mx", x.toFixed(3));
      document.documentElement.style.setProperty("--my", y.toFixed(3));
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return children;
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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/dmca" element={<DmcaPage />} />
        <Route path="/suggestions" element={<SuggestionsPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/premium" element={<PremiumPage />} />
        <Route path="/ai-image" element={<AiImagePage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      </Routes>
    </main>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UploadAccessProvider>
        <BrowserRouter>
        <MouseParallaxRoot>
          <div className="App min-h-screen bg-[var(--site-bg)] text-white transition-colors duration-300">
            <Nav />
            <RefreshableRoutes />
            <Footer />
            <PersistentAudioBar />
            <Toaster
              theme="dark"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "rgba(13,13,20,0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff",
                },
              }}
            />
          </div>
        </MouseParallaxRoot>
        </BrowserRouter>
        </UploadAccessProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
