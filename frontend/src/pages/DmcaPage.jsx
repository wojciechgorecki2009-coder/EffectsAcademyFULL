import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Shield, CheckCircle2, Mail } from "lucide-react";

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
    <section className="max-w-3xl mx-auto px-6 pt-28 pb-16" data-testid="dmca-page">
      <div className="w-12 h-12 rounded-xl bg-neon/10 border border-neon/30 flex items-center justify-center mb-4">
        <Shield className="w-5 h-5 text-neon" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mb-3">
        DMCA Policy
      </h1>
      <p className="text-zinc-400 leading-relaxed mb-8 max-w-2xl">
        Effects Academy respects intellectual property rights. If you believe any
        material hosted on this site infringes your copyright, please submit a notice
        below. We review every submission and act in accordance with the Digital
        Millennium Copyright Act. Submissions are routed to{" "}
        <a className="text-zinc-200 hover:text-neon font-mono text-sm" href={`mailto:${DMCA_EMAIL}`}>{DMCA_EMAIL}</a>.
      </p>

      {sent ? (
        <div className="glass rounded-2xl p-10 text-center" data-testid="dmca-success">
          <CheckCircle2 className="w-10 h-10 text-neon mx-auto mb-3" />
          <h2 className="font-display text-2xl font-bold mb-2">Notice received</h2>
          <p className="text-zinc-400">We&apos;ll review and respond at the address you provided.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="glass rounded-2xl p-6 md:p-8 space-y-5">
          <FormField label="Full Name">
            <Input
              required
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              className="bg-white/5 border-white/10 mt-1"
              data-testid="dmca-fullname"
            />
          </FormField>
          <FormField label="Email">
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="bg-white/5 border-white/10 mt-1"
              data-testid="dmca-email"
            />
          </FormField>
          <FormField label="Content URL / Asset Name">
            <Input
              required
              value={form.content_or_subject}
              onChange={(e) => set("content_or_subject", e.target.value)}
              className="bg-white/5 border-white/10 mt-1"
              data-testid="dmca-content"
            />
          </FormField>
          <FormField label="Description of the infringement">
            <Textarea
              required
              rows={5}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="bg-white/5 border-white/10 mt-1 resize-none"
              data-testid="dmca-description"
            />
          </FormField>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-neon text-[#05050A] hover:bg-neon/90 font-semibold btn-press"
            data-testid="dmca-submit"
          >
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

function FormField({ label, children }) {
  return (
    <div>
      <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
