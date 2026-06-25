import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, clearAuthToken, getAuthToken, setAuthToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState({
    google_client_id: "",
    google_login_uri: "",
    stripe_configured: false,
    dev_login_enabled: false,
  });
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null);
      return null;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      clearAuthToken();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/auth/config").then(({ data }) => data).catch(() => null),
      refreshUser(),
    ]).then(([nextConfig]) => {
      if (!active) return;
      if (nextConfig) setConfig(nextConfig);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [refreshUser]);

  const acceptLogin = useCallback((data) => {
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const { data } = await api.post("/auth/google", { credential });
    return acceptLogin(data);
  }, [acceptLogin]);

  const loginAsLocalViewer = useCallback(async (premium = false) => {
    const { data } = await api.post("/auth/dev-login", { premium });
    return acceptLogin(data);
  }, [acceptLogin]);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    config,
    loading,
    loginWithGoogle,
    loginAsLocalViewer,
    logout,
    refreshUser,
    hasPremium: ["Uploader", "Admin"].includes(user?.role) || ["active", "trialing"].includes(user?.premium_status),
  }), [user, config, loading, loginWithGoogle, loginAsLocalViewer, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
