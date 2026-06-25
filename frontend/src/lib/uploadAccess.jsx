import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getPass, setPass, clearPass } from "./api";
import { useAuth } from "./auth";

const UploadCtx = createContext(null);

export function UploadAccessProvider({ children }) {
  const { user, config } = useAuth();
  const [localUnlocked, setLocalUnlocked] = useState(false);
  const role = user?.role || "Viewer";
  const accountUploader = role === "Uploader" || role === "Admin";
  const localPasswordEnabled = Boolean(config?.dev_login_enabled);
  const isUploader = accountUploader || (localPasswordEnabled && localUnlocked);

  useEffect(() => {
    setLocalUnlocked(Boolean(getPass()));
  }, [localPasswordEnabled]);

  const tryUnlock = useCallback(async (password) => {
    if (!localPasswordEnabled) return false;
    const { data } = await api.post("/auth/verify-password", { password });
    if (data.valid) {
      setPass(password);
      setLocalUnlocked(true);
      return true;
    }
    return false;
  }, [localPasswordEnabled]);

  const lock = useCallback(() => {
    clearPass();
    setLocalUnlocked(false);
  }, []);

  return (
    <UploadCtx.Provider value={{ isUploader, tryUnlock, lock, localPasswordEnabled }}>
      {children}
    </UploadCtx.Provider>
  );
}

export const useUploadAccess = () => useContext(UploadCtx);
