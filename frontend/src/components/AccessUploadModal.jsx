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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
      <DialogContent
        className="glass border-white/10 text-white max-w-md"
        data-testid="access-upload-modal"
      >
        <DialogHeader>
          <div className="w-12 h-12 rounded-xl bg-neon/10 border border-neon/30 flex items-center justify-center mb-2">
            <Lock className="w-5 h-5 text-neon" />
          </div>
          <DialogTitle className="font-display text-2xl">
            Access Upload
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {localPasswordEnabled
              ? "Enter the moderator password to unlock the upload tools for this session."
              : "Sign in with an approved moderator Google account to unlock upload tools."}
          </DialogDescription>
        </DialogHeader>
        {localPasswordEnabled ? (
          <form onSubmit={submit} className="space-y-4">
            <Input
              type="password"
              placeholder="Upload password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="bg-white/5 border-white/10 text-white focus-visible:ring-neon h-12"
              data-testid="access-upload-password-input"
            />
            {err && (
              <p className="text-sm text-red-400" data-testid="access-upload-error">
                {err}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-neon text-[#05050A] hover:bg-neon/90 font-semibold btn-press h-11"
              data-testid="access-upload-submit"
            >
              {loading ? "Verifying..." : "Unlock"}
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              navigate("/login?returnTo=/");
            }}
            className="w-full bg-neon text-[#05050A] hover:bg-neon/90 font-semibold btn-press h-11"
            data-testid="access-upload-google-login"
          >
            Sign in with Google
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
