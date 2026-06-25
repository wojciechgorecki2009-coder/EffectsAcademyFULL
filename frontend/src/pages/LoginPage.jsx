import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user, config, loginAsLocalViewer } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
        ux_mode: "redirect",
        login_uri: config.google_login_uri,
      });
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "filled_black",
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
  }, [config.google_client_id, config.google_login_uri]);

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
    <section className="min-h-[calc(100vh-4rem)] pt-28 pb-16 px-6 flex items-center justify-center" data-testid="login-page">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--site-panel)] p-8 md:p-10 shadow-2xl transition-colors duration-300">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to browse
        </Link>
        <div className="w-12 h-12 rounded-2xl bg-neon/10 border border-neon/30 flex items-center justify-center mb-5">
          <ShieldCheck className="w-6 h-6 text-neon" />
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight">Sign in for Premium</h1>
        <p className="text-zinc-400 mt-3 leading-relaxed">
          Google sign-in securely connects your subscription to one account across devices.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          {config.google_client_id ? (
            <div ref={buttonRef} data-testid="google-login-button" />
          ) : (
            <div className="w-full rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">
              Google Login will appear after <code>GOOGLE_CLIENT_ID</code> is configured on the server.
            </div>
          )}
          {config.dev_login_enabled && (
            <button
              onClick={localLogin}
              disabled={busy}
              className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-3 font-semibold btn-press"
              data-testid="dev-viewer-login"
            >
              {busy ? "Signing in…" : "Continue as Viewer (local preview)"}
            </button>
          )}
          {error && <p className="text-sm text-red-400" data-testid="login-error">{error}</p>}
        </div>

        <p className="text-xs text-zinc-600 mt-8 text-center">
          We store only your Google account ID, email, display name, role, and subscription status.
        </p>
      </div>
    </section>
  );
}
