import { Link } from "react-router-dom";
import { AlertTriangle, LockKeyhole, Mail, Scale, ShieldCheck } from "lucide-react";

const SUPPORT_EMAIL = "EffectsAcademy2026@hotmail.com";

function LegalShell({ eyebrow, title, description, icon: Icon, children }) {
  return (
    <section className="max-w-5xl mx-auto px-6 pt-28 pb-16 page-soft-enter">
      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 md:p-10 overflow-hidden relative">
        <div className="absolute -top-32 right-0 w-80 h-80 bg-neon/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-neon/10 border border-neon/30 flex items-center justify-center mb-4">
            <Icon className="w-5 h-5 text-neon" />
          </div>
          <p className="text-xs font-mono uppercase tracking-[0.28em] text-neon mb-3">{eyebrow}</p>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mb-3">{title}</h1>
          <p className="text-zinc-400 leading-relaxed max-w-3xl">{description}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:border-neon/40 hover:text-neon btn-press">
              <Mail className="w-4 h-4" /> Contact support
            </a>
            <Link to="/dmca" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:border-neon/40 hover:text-neon btn-press">
              <ShieldCheck className="w-4 h-4" /> DMCA requests
            </Link>
          </div>
        </div>
      </div>
      <div className="mt-8 grid gap-5">{children}</div>
    </section>
  );
}

function Card({ title, children, icon: Icon = ShieldCheck }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--site-surface)] p-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-neon" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold mb-2">{title}</h2>
          <div className="text-sm text-zinc-400 leading-relaxed space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Terms of Use"
      icon={Scale}
      description="These terms explain how Effects Academy should be used. The short version: use the site respectfully, only upload assets you are allowed to share, and do not abuse downloads, accounts, or premium access."
    >
      <Card title="Using Effects Academy">
        <p>Effects Academy provides community-curated editing resources such as project files, overlays, presets, audios, sound effects, torrents, and premium drops. You are responsible for how you use anything downloaded from the site.</p>
        <p>Do not use the site to distribute malware, spam, stolen accounts, misleading links, or content that you do not have permission to share.</p>
      </Card>
      <Card title="Uploader responsibilities" icon={AlertTriangle}>
        <p>Uploaders and moderators should only upload assets they have permission to share or assets that are allowed under the rights they hold. If an asset is reported, it may be removed while it is reviewed.</p>
        <p>Effects Academy may remove content, restrict upload access, or disable accounts if the site is being abused.</p>
      </Card>
      <Card title="Premium membership" icon={LockKeyhole}>
        <p>Premium membership unlocks access to premium assets while your subscription is active. Payments and subscription management are handled securely through Stripe.</p>
        <p>Premium access is linked to the Google account used at checkout so your subscription can be restored when you sign in.</p>
      </Card>
      <Card title="AI tools and fair use">
        <p>Effects Academy may offer AI-assisted tools for editing images or text previews. Free accounts may have limited monthly generations, while premium accounts may receive a higher generation allowance.</p>
        <p>Do not use AI tools to create illegal, harmful, deceptive, or rights-infringing content. Generated results may vary and should be reviewed before use in public projects.</p>
      </Card>
      <Card title="Advertising">
        <p>Effects Academy may display advertising to support free tools and free asset access. Ads should not be confused with site navigation, downloads, or official Effects Academy assets.</p>
      </Card>
      <Card title="Copyright and takedowns">
        <p>If you believe your copyrighted work appears on Effects Academy without permission, use the DMCA page or email <a className="text-neon" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </Card>
      <Card title="Contact">
        <p>Questions, support requests, and moderation issues can be sent to <a className="text-neon" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </Card>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Privacy"
      title="Privacy Policy"
      icon={ShieldCheck}
      description="This policy explains what Effects Academy stores so accounts, uploads, premium access, DMCA notices, and suggestions can work properly."
    >
      <Card title="Information we collect">
        <p>When you sign in with Google, Effects Academy may store your Google account ID, email address, display name, role, and subscription status so premium access can be tracked securely.</p>
        <p>When you submit forms, we store the information you provide, such as DMCA notice details or suggestion text.</p>
      </Card>
      <Card title="Uploads and assets">
        <p>Uploaded files, thumbnails, titles, descriptions, creator tags, categories, and download counts are stored so the asset library can function.</p>
      </Card>
      <Card title="Payments" icon={LockKeyhole}>
        <p>Payments are processed by Stripe. Effects Academy does not store full card details. Stripe provides subscription and checkout status so premium access can be enabled or managed.</p>
      </Card>
      <Card title="Cookies, analytics, and advertising">
        <p>Effects Academy may use cookies or similar technologies to keep users signed in, protect premium access, remember preferences, measure site performance, and understand how the site is used.</p>
        <p>If advertising is enabled, third-party vendors including Google may use cookies to serve ads based on visits to Effects Academy or other websites. Google&apos;s use of advertising cookies helps it and its partners serve ads to users based on their visits to this site and other sites on the internet.</p>
        <p>Users can manage Google ad personalization through their Google account ad settings. Browser settings may also allow you to block or delete cookies, although some site features may stop working properly.</p>
      </Card>
      <Card title="AI generation usage">
        <p>AI text image generations are linked to your signed-in account so Effects Academy can enforce free and premium usage limits, prevent abuse, and show saved generations to eligible users.</p>
      </Card>
      <Card title="Email and support">
        <p>DMCA notices and suggestions may be delivered to <a className="text-neon" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> so the team can review them.</p>
      </Card>
      <Card title="Your choices">
        <p>You can contact support to ask about account data, premium access, or submitted notices. For urgent copyright issues, use the DMCA page.</p>
      </Card>
    </LegalShell>
  );
}

export function SupportPage() {
  const supportSubject = encodeURIComponent("Effects Academy support request");

  return (
    <LegalShell
      eyebrow="Support"
      title="Contact Support"
      icon={Mail}
      description="Need help with downloads, premium access, uploads, AI tools, or copyright questions? This page gives you the safest way to reach Effects Academy support."
    >
      <Card title="Support email" icon={Mail}>
        <p>The main support email for Effects Academy is:</p>
        <a
          className="inline-flex w-fit rounded-xl border border-neon/30 bg-neon/10 px-4 py-2 font-semibold text-neon hover:bg-neon/15 transition-colors"
          href={`mailto:${SUPPORT_EMAIL}?subject=${supportSubject}`}
        >
          {SUPPORT_EMAIL}
        </a>
        <p>
          If clicking the email button does not open anything, copy and paste the address into Outlook,
          Gmail, or your preferred email app.
        </p>
      </Card>

      <Card title="What to include">
        <p>To help us fix your issue faster, include:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your Google account email if the issue is about premium, login, or AI credits.</li>
          <li>The asset title or page link if the issue is about a download.</li>
          <li>A short description of what went wrong and any screenshots if useful.</li>
        </ul>
      </Card>

      <Card title="Copyright or takedown requests" icon={ShieldCheck}>
        <p>
          For copyright removal requests, please use the dedicated{" "}
          <Link to="/dmca" className="text-neon hover:underline">DMCA page</Link>{" "}
          so the notice includes all the required information.
        </p>
      </Card>
    </LegalShell>
  );
}
