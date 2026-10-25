import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Mail, Shield } from "lucide-react";
import { PageIntro, SuccessPanel } from "@/components/Library";
import { Reveal, Stagger, StaggerItem } from "@/lib/motion";

const DMCA_EMAIL = "EffectsAcademy2026@hotmail.com";

export default function DmcaPage() {
  const [form, setForm] = useState({ full_name: "", email: "", content_or_subject: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setDeliveryError("");
    try {
      await api.post("/dmca", form);
      setSent(true);
      toast.success("Your DMCA notice has been received.");
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const message = typeof detail === "string" ? detail : detail?.[0]?.msg || "Could not submit.";
      setDeliveryError(message);
      toast.error("Automatic email delivery is unavailable. Use the direct email button below.");
    }
    setSubmitting(false);
  };

  return (
    <section className="mx-auto max-w-4xl px-5 pb-24 pt-32 md:pt-36" data-testid="dmca-page">
      <PageIntro eyebrow="Copyright support" icon={<Shield />} title="DMCA Removal Requests">
        Effects Academy respects intellectual property rights. If you are a rights holder or authorized representative and believe an asset should be removed, submit the notice below or email us directly at{" "}
        <a className="text-tint hover:underline" href={`mailto:${DMCA_EMAIL}`}>{DMCA_EMAIL}</a>.
      </PageIntro>

      <Stagger className="mt-12 grid gap-3 md:grid-cols-3" stagger={0.07}>
        <InfoCard title="What to include" text="Your name, contact email, asset link/name, and a clear explanation of the copyrighted work." />
        <InfoCard title="What happens next" text="We review notices and may remove or restrict the reported asset while the issue is checked." />
        <InfoCard title="Support email" text={DMCA_EMAIL} mono />
      </Stagger>

      <Reveal className="notice notice-warn mt-4 flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9f0a]" />
        <p>Only submit a DMCA notice if you believe you own the rights or are authorized to act for the rights holder. False or incomplete claims may delay review.</p>
      </Reveal>

      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <SuccessPanel key="sent" testId="dmca-success" title="Notice received">
            We&apos;ll review it and respond at the address you provided.
          </SuccessPanel>
        ) : (
          <Reveal key="form" as="form" onSubmit={submit} className="surface mt-8 space-y-5 rounded-[28px] p-6 md:p-8">
            <FormField label="Full legal name">
              <input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className="field" data-testid="dmca-fullname" />
            </FormField>
            <FormField label="Contact email">
              <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="field" data-testid="dmca-email" />
            </FormField>
            <FormField label="Asset URL / asset name">
              <input required value={form.content_or_subject} onChange={(e) => set("content_or_subject", e.target.value)} className="field" data-testid="dmca-content" />
            </FormField>
            <FormField label="Describe the copyrighted work and issue">
              <textarea required rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} className="field" data-testid="dmca-description" />
            </FormField>
            <button type="submit" disabled={submitting} className="btn btn-primary btn-lg btn-block" data-testid="dmca-submit">
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {submitting ? "Submitting..." : "Submit DMCA Notice"}
            </button>
            {deliveryError && (
              <div className="notice notice-warn" data-testid="dmca-email-fallback">
                <p>{deliveryError}</p>
                <a
                  href={`mailto:${DMCA_EMAIL}?subject=${encodeURIComponent(`DMCA removal request: ${form.content_or_subject}`)}&body=${encodeURIComponent(`Full name: ${form.full_name}\nClaimant email: ${form.email}\nContent URL / asset: ${form.content_or_subject}\n\nDescription of the infringement:\n${form.description}`)}`}
                  className="btn btn-secondary btn-block mt-3"
                  data-testid="dmca-direct-email"
                >
                  <Mail /> Email Notice Directly
                </a>
                <p className="mt-2 text-center text-[12px] text-ink-3">Your email app will open with the notice filled in. Review it and press Send.</p>
              </div>
            )}
          </Reveal>
        )}
      </AnimatePresence>
    </section>
  );
}

function InfoCard({ title, text, mono = false }) {
  return (
    <StaggerItem className="surface rounded-[22px] p-5">
      <h2 className="mb-1.5 font-display text-[15px] font-semibold text-ink">{title}</h2>
      <p className={`${mono ? "break-all font-mono text-[13px] text-tint" : "text-[14px] text-ink-2"} leading-relaxed`}>{text}</p>
    </StaggerItem>
  );
}

function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
