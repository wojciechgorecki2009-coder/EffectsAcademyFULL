import { useEffect } from "react";
import { setAuthToken } from "@/lib/api";

export default function GoogleCallbackPage() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    const storedReturnTo = sessionStorage.getItem("ea_google_return_to") || "/premium";
    const returnTo = storedReturnTo.startsWith("/") && !storedReturnTo.startsWith("//")
      ? storedReturnTo
      : "/premium";
    sessionStorage.removeItem("ea_google_return_to");
    if (!token) {
      window.location.replace("/login?error=google-signin");
      return;
    }
    setAuthToken(token);
    window.location.replace(returnTo);
  }, []);

  return (
    <section className="min-h-screen flex items-center justify-center text-zinc-300">
      Finishing Google sign-in&hellip;
    </section>
  );
}
