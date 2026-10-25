import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Lightbulb, Loader2, Send } from "lucide-react";
import { PageIntro, SuccessPanel } from "@/components/Library";
import { Reveal } from "@/lib/motion";

export default function SuggestionsPage() {
  const [form, setForm] = useState({ content_or_subject: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/suggestions", form);
      setSent(true);
      toast.success("Thanks — your suggestion is in.");
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : detail?.[0]?.msg || "Could not submit.");
    }
    setSubmitting(false);
  };

  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-32 md:pt-36" data-testid="suggestions-page">
      <PageIntro eyebrow="Feedback" icon={<Lightbulb />} title="Suggestions">
        Got an idea for a feature, a pack you&apos;d like to see, or feedback on the
        site? Drop us a line anonymously. Submissions route to{" "}
        <span className="font-medium text-ink">EffectsAcademy2026@hotmail.com</span>.
      </PageIntro>

      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <SuccessPanel key="sent" testId="suggestion-success" title="Got it">
            Your idea has been delivered. Thanks for helping us improve.
          </SuccessPanel>
        ) : (
          <Reveal key="form" as="form" onSubmit={submit} className="surface mt-12 space-y-5 rounded-[28px] p-6 md:p-8" delay={0.2}>
            <Field label="Subject">
              <input
                required
                value={form.content_or_subject}
                onChange={(e) => set("content_or_subject", e.target.value)}
                className="field"
                data-testid="suggestion-subject"
              />
            </Field>
            <Field label="Your suggestion">
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="field"
                data-testid="suggestion-description"
              />
            </Field>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-lg btn-block"
              data-testid="suggestion-submit"
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Send />}
              {submitting ? "Sending..." : "Send Suggestion"}
            </button>
          </Reveal>
        )}
      </AnimatePresence>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
