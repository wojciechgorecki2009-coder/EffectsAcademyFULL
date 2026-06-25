import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Lightbulb, CheckCircle2 } from "lucide-react";

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
    <section className="max-w-3xl mx-auto px-6 pt-28 pb-16" data-testid="suggestions-page">
      <div className="w-12 h-12 rounded-xl bg-neon/10 border border-neon/30 flex items-center justify-center mb-4">
        <Lightbulb className="w-5 h-5 text-neon" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mb-3">
        Suggestions
      </h1>
      <p className="text-zinc-400 leading-relaxed mb-8 max-w-2xl">
        Got an idea for a feature, a pack you&apos;d like to see, or feedback on the
        site? Drop us a line anonymously. Submissions route to{" "}
        <span className="text-zinc-200 font-mono text-sm">EffectsAcademy2026@hotmail.com</span>.
      </p>

      {sent ? (
        <div className="glass rounded-2xl p-10 text-center" data-testid="suggestion-success">
          <CheckCircle2 className="w-10 h-10 text-neon mx-auto mb-3" />
          <h2 className="font-display text-2xl font-bold mb-2">Got it</h2>
          <p className="text-zinc-400">Your idea has been delivered. Thanks for helping us improve.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="glass rounded-2xl p-6 md:p-8 space-y-5">
          <Field label="Subject">
            <Input
              required
              value={form.content_or_subject}
              onChange={(e) => set("content_or_subject", e.target.value)}
              className="bg-white/5 border-white/10 mt-1"
              data-testid="suggestion-subject"
            />
          </Field>
          <Field label="Your suggestion">
            <Textarea
              required
              rows={5}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="bg-white/5 border-white/10 mt-1 resize-none"
              data-testid="suggestion-description"
            />
          </Field>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-neon text-[#05050A] hover:bg-neon/90 font-semibold btn-press"
            data-testid="suggestion-submit"
          >
            {submitting ? "Sending..." : "Send Suggestion"}
          </Button>
        </form>
      )}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
