import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { BackButton } from "@/components/Library";
import { EASE_OUT, SPRING } from "@/lib/motion";

export default function LoginPage() {
  const { user, config, loginWithGoogle, loginAsLocalViewer } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { scheme } = useTheme();
  const reduce = useReducedMotion();
  const returnTo = searchParams.get("returnTo") || "/premium";
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/premium";

  useEffect(() => {
    if (user) navigate(safeReturnTo, { replace: true });
  }, [user, navigate, safeReturnTo]);

  useEffect(() => {
    sessionStorage.setItem("ea_google_return_to", safeReturnTo);
  }, [safeReturnTo]);

  useEffect(() => {
    if (!config.google_client_id || !buttonRef.current) return;
    const render = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
  client_id: config.google_client_id,
  callback: async (response) => {
    if (!response?.credential) {
      setError("Google sign-in did not return a credential.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await loginWithGoogle(response.credential);
      navigate(safeReturnTo, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  },
});
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: scheme === "light" ? "outline" : "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 320,
      });
    };
    if (window.google?.accounts?.id) {
      render();
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", render, { once: true });
      return () => existing.removeEventListener("load", render);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, [config.google_client_id, loginWithGoogle, navigate, safeReturnTo, scheme]);

  const localLogin = async () => {
    setBusy(true);
    setError("");
    try {
      await loginAsLocalViewer(false);
      navigate(safeReturnTo, { replace: true });
    } catch {
      setError("Local preview sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-5 pb-20 pt-32" data-testid="login-page">
      <div className="aurora -z-10 !opacity-50" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <motion.div
        className="glass w-full max-w-[420px] rounded-[34px] p-8 md:p-10"
        initial={reduce ? false : { opacity: 0, y: 30, scale: 0.96, filter: "blur(12px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
        transition={{ duration: 1, ease: EASE_OUT }}
      >
        <BackButton to="/">Browse</BackButton>
        <motion.span
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint text-tint-ink shadow-[0_10px_30px_-8px_rgb(var(--tint)/0.6)]"
          initial={reduce ? false : { scale: 0.5, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.2 }}
        >
          <ShieldCheck className="h-7 w-7" />
        </motion.span>
        <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.035em] text-ink">Sign in for Premium</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Google sign-in securely connects your subscription to one account across devices.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          {config.google_client_id ? (
            <div ref={buttonRef} data-testid="google-login-button" />
          ) : (
            <div className="notice notice-warn w-full">
              Google Login will appear after <code>GOOGLE_CLIENT_ID</code> is configured on the server.
            </div>
          )}
          {config.dev_login_enabled && (
            <button
              onClick={localLogin}
              disabled={busy}
              className="btn btn-secondary btn-block"
              data-testid="dev-viewer-login"
            >
              {busy ? "Signing in…" : "Continue as Viewer (local preview)"}
            </button>
          )}
          {error && <p className="text-[13px] text-[#ff453a]" data-testid="login-error">{error}</p>}
        </div>

        <p className="mt-8 text-center text-[12px] leading-relaxed text-ink-3">
          We store only your Google account ID, email, display name, role, and subscription status.
        </p>
      </motion.div>
    </section>
  );
}
