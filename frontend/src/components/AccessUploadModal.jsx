import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUploadAccess } from "@/lib/uploadAccess";
import { toast } from "sonner";

export default function AccessUploadModal({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { tryUnlock, localPasswordEnabled } = useUploadAccess();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const ok = await tryUnlock(password);
      if (ok) {
        toast.success("Welcome, uploader. Upload tools unlocked.");
        setPassword("");
        onOpenChange(false);
      } else {
        setErr("Incorrect password. Please try again.");
      }
    } catch {
      setErr("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="access-upload-modal">
        <DialogHeader className="text-left">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--fill-2)] text-ink">
            <Lock className="h-5 w-5" />
          </span>
          <DialogTitle className="font-display text-2xl font-semibold tracking-[-0.025em]">
            Access Upload
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed">
            {localPasswordEnabled
              ? "Enter the moderator password to unlock the upload tools for this session."
              : "Sign in with an approved moderator Google account to unlock upload tools."}
          </DialogDescription>
        </DialogHeader>
        {localPasswordEnabled ? (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              placeholder="Upload password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="field"
              data-testid="access-upload-password-input"
            />
            {err && (
              <p className="text-[13px] text-[#ff453a]" data-testid="access-upload-error">
                {err}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="btn btn-primary btn-block"
              data-testid="access-upload-submit"
            >
              {loading ? "Verifying..." : "Unlock"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              navigate("/login?returnTo=/");
            }}
            className="btn btn-primary btn-block"
            data-testid="access-upload-google-login"
          >
            Sign in with Google
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
