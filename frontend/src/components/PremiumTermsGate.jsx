import { useState } from "react";
import { Check, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";

const TERMS = [
  {
    title: "Your licence",
    text: "While your Premium membership is active, Effects Academy grants you a limited, non-exclusive, non-transferable licence to download and use Premium assets in your own personal or commercial creative projects.",
  },
  {
    title: "No redistribution or resale",
    text: "You must not reupload, share, leak, sell, sublicense, trade, or otherwise distribute any Premium asset—whether unchanged, repackaged, or only lightly modified—for personal gain or for free.",
  },
  {
    title: "Keep access private",
    text: "Your account and unique After Effects extension access code are for you alone. You must not share them or allow anyone else to use your Premium access.",
  },
  {
    title: "Membership and enforcement",
    text: "Premium access lasts only while your membership is active. Effects Academy may suspend or terminate access, without refund, where it reasonably believes these terms have been violated.",
  },
  {
    title: "Payments and refunds",
    text: "Subscription fees are final and non-refundable except where a refund is required by applicable law. You may cancel future renewals through the subscription management page. This does not affect your statutory rights.",
  },
  {
    title: "Responsible use",
    text: "You are responsible for ensuring that your use of an asset, including in client work or published content, complies with applicable laws and any third-party rights. Assets are provided as available and may be updated or removed.",
  },
];

export default function PremiumTermsGate() {
  const { user, loading, acceptPremiumTerms, logout } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const open = !loading && Boolean(user?.premium_terms_required);

  const accept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await acceptPremiumTerms();
      toast.success("Premium Asset Licence accepted.");
    } catch (err) {
      setError(err?.response?.data?.detail || "We could not save your acceptance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent
        className="grid w-[calc(100vw-2rem)] max-w-3xl max-h-[92vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-white/10 bg-[#111114]/95 p-0 text-white shadow-2xl backdrop-blur-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div className="border-b border-white/10 bg-gradient-to-br from-sky-500/15 via-transparent to-violet-500/10 px-6 py-6 md:px-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-400/10">
            <FileCheck2 className="h-5 w-5 text-sky-300" />
          </div>
          <AlertDialogHeader className="text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300">Premium Asset Licence</p>
            <AlertDialogTitle className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              One agreement. Full creative access.
            </AlertDialogTitle>
            <AlertDialogDescription className="max-w-2xl text-sm leading-relaxed text-zinc-400">
              Please review and accept these terms before using or downloading Premium assets. Your acceptance is saved to your account, so you only need to do this once for this version.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <div className="overflow-y-auto px-6 py-5 md:px-8">
          <div className="grid gap-3 md:grid-cols-2">
            {TERMS.map((term, index) => (
              <div key={term.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/10 text-xs font-bold text-sky-300">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-100">{term.title}</h3>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">{term.text}</p>
              </div>
            ))}
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors hover:border-sky-400/30">
            <Checkbox
              checked={agreed}
              onCheckedChange={(value) => setAgreed(value === true)}
              className="mt-0.5 h-5 w-5 rounded-md border-white/25 data-[state=checked]:border-sky-400 data-[state=checked]:bg-sky-500"
            />
            <span className="text-sm leading-relaxed text-zinc-300">
              I have read and agree to the Premium Asset Licence and understand that sharing Premium assets or my extension access code may result in termination of my membership.
            </span>
          </label>

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={accept}
              disabled={!agreed || submitting}
              className="h-12 flex-1 rounded-xl bg-sky-500 font-semibold text-white hover:bg-sky-400"
            >
              {submitting ? "Saving agreement..." : <><Check className="h-4 w-4" /> Accept and continue</>}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={logout}
              disabled={submitting}
              className="h-12 rounded-xl px-5 text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              Sign out
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Account-level acceptance</span>
            <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" /> Required for Premium access</span>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
