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
        className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden !p-0"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div className="border-b border-[var(--line)] px-6 pb-6 pt-7 md:px-8">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-[16px] bg-tint text-tint-ink shadow-[0_10px_30px_-10px_rgb(var(--tint)/0.7)]">
            <FileCheck2 className="h-6 w-6" />
          </span>
          <AlertDialogHeader className="text-left">
            <p className="eyebrow">Premium Asset Licence</p>
            <AlertDialogTitle className="font-display text-[1.875rem] font-bold leading-tight tracking-[-0.035em] md:text-4xl">
              One agreement. Full creative access.
            </AlertDialogTitle>
            <AlertDialogDescription className="max-w-2xl text-[15px] leading-relaxed">
              Please review and accept these terms before using or downloading Premium assets. Your acceptance is saved to your account, so you only need to do this once for this version.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <div className="overflow-y-auto px-6 py-6 md:px-8">
          <div className="grid gap-3 md:grid-cols-2">
            {TERMS.map((term, index) => (
              <div key={term.title} className="rounded-[20px] bg-[var(--fill)] p-4">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--tint)/0.14)] text-[12px] font-bold text-tint">
                    {index + 1}
                  </span>
                  <h3 className="text-[14px] font-semibold text-ink">{term.title}</h3>
                </div>
                <p className="text-[13px] leading-relaxed text-ink-2">{term.text}</p>
              </div>
            ))}
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[20px] p-4 shadow-[inset_0_0_0_1px_var(--line-strong)] transition-shadow duration-300 hover:shadow-[inset_0_0_0_1px_rgb(var(--tint)/0.5)]">
            <Checkbox
              checked={agreed}
              onCheckedChange={(value) => setAgreed(value === true)}
              className="mt-0.5 h-5 w-5 rounded-md border-[var(--line-strong)] data-[state=checked]:border-tint data-[state=checked]:bg-tint data-[state=checked]:text-tint-ink"
            />
            <span className="text-[14px] leading-relaxed text-ink-2">
              I have read and agree to the Premium Asset Licence and understand that sharing Premium assets or my extension access code may result in termination of my membership.
            </span>
          </label>

          {error ? <p className="mt-3 text-[13px] text-[#ff453a]">{error}</p> : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={accept}
              disabled={!agreed || submitting}
              className="btn btn-primary btn-lg flex-1"
            >
              {submitting ? "Saving agreement..." : <><Check /> Accept and continue</>}
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={submitting}
              className="btn btn-ghost btn-lg"
            >
              Sign out
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[12px] text-ink-3">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Account-level acceptance</span>
            <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" /> Required for Premium access</span>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
