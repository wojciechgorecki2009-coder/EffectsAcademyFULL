import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Mail, Shield } from "lucide-react";

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
    <section className="max-w-4xl mx-auto px-6 pt-28 pb-16 page-soft-enter" data-testid="dmca-page">
      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 md:p-10 mb-8 relative overflow-hidden">
        <div className="absolute -top-32 right-0 w-80 h-80 bg-neon/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-neon/10 border border-neon/30 flex items-center justify-center mb-4">
            <Shield className="w-5 h-5 text-neon" />
          </div>
          <p className="text-xs font-mono uppercase tracking-[0.28em] text-neon mb-3">Copyright support</p>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mb-3">
            DMCA Removal Requests
          </h1>
          <p className="text-zinc-400 leading-relaxed max-w-3xl">
            Effects Academy respects intellectual property rights. If you are a rights holder or authorized representative and believe an asset should be removed, submit the notice below or email us directly at{" "}
            <a className="text-zinc-200 hover:text-neon font-mono text-sm" href={`mailto:${DMCA_EMAIL}`}>{DMCA_EMAIL}</a>.
          </p>
        </div>
      </div>

      <div className="grid gap-4 mb-8 md:grid-cols-3">
        <InfoCard title="What to include" text="Your name, contact email, asset link/name, and a clear explanation of the copyrighted work." />
        <InfoCard title="What happens next" text="We review notices and may remove or restrict the reported asset while the issue is checked." />
        <InfoCard title="Support email" text={DMCA_EMAIL} mono />
      </div>

      <div className="mb-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 flex gap-3 text-sm text-amber-100">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <p>Only submit a DMCA notice if you believe you own the rights or are authorized to act for the rights holder. False or incomplete claims may delay review.</p>
      </div>

      {sent ? (
        <div className="glass rounded-2xl p-10 text-center" data-testid="dmca-success">
          <CheckCircle2 className="w-10 h-10 text-neon mx-auto mb-3" />
          <h2 className="font-display text-2xl font-bold mb-2">Notice received</h2>
          <p className="text-zinc-400">We&apos;ll review it and respond at the address you provided.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="glass rounded-2xl p-6 md:p-8 space-y-5">
          <FormField label="Full legal name">
            <Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className="bg-white/5 border-white/10 mt-1" data-testid="dmca-fullname" />
          </FormField>
          <FormField label="Contact email">
            <Input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="bg-white/5 border-white/10 mt-1" data-testid="dmca-email" />
          </FormField>
          <FormField label="Asset URL / asset name">
            <Input required value={form.content_or_subject} onChange={(e) => set("content_or_subject", e.target.value)} className="bg-white/5 border-white/10 mt-1" data-testid="dmca-content" />
          </FormField>
          <FormField label="Describe the copyrighted work and issue">
            <Textarea required rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} className="bg-white/5 border-white/10 mt-1 resize-none" data-testid="dmca-description" />
          </FormField>
          <Button type="submit" disabled={submitting} className="w-full h-12 bg-neon text-[#05050A] hover:bg-neon/90 font-semibold btn-press" data-testid="dmca-submit">
            {submitting ? "Submitting..." : "Submit DMCA Notice"}
          </Button>
          {deliveryError && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4" data-testid="dmca-email-fallback">
              <p className="text-sm text-amber-100">{deliveryError}</p>
              <a
                href={`mailto:${DMCA_EMAIL}?subject=${encodeURIComponent(`DMCA removal request: ${form.content_or_subject}`)}&body=${encodeURIComponent(`Full name: ${form.full_name}\nClaimant email: ${form.email}\nContent URL / asset: ${form.content_or_subject}\n\nDescription of the infringement:\n${form.description}`)}`}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-300 text-black font-semibold py-2.5 btn-press"
                data-testid="dmca-direct-email"
              >
                <Mail className="w-4 h-4" /> Email Notice Directly
              </a>
              <p className="text-xs text-amber-100/60 mt-2 text-center">Your email app will open with the notice filled in. Review it and press Send.</p>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

function InfoCard({ title, text, mono = false }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="font-display font-semibold mb-1">{title}</h2>
      <p className={`${mono ? "font-mono text-neon" : "text-zinc-500"} text-sm leading-relaxed`}>{text}</p>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
