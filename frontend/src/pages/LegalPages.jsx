import { Link } from "react-router-dom";
import { AlertTriangle, LockKeyhole, Mail, Scale, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/Library";
import { Reveal } from "@/lib/motion";

const SUPPORT_EMAIL = "EffectsAcademy2026@hotmail.com";

function LegalShell({ eyebrow, title, description, icon: Icon, children }) {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-24 pt-32 md:pt-36">
      <PageIntro eyebrow={eyebrow} icon={<Icon />} title={title}>
        {description}
      </PageIntro>
      <Reveal className="mt-8 flex flex-wrap gap-2" delay={0.35}>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="btn btn-sm btn-secondary">
          <Mail /> Contact support
        </a>
        <Link to="/dmca" className="btn btn-sm btn-secondary">
          <ShieldCheck /> DMCA requests
        </Link>
      </Reveal>
      <div className="mt-14 grid gap-4">{children}</div>
    </section>
  );
}

function Card({ title, children, icon: Icon = ShieldCheck }) {
  return (
    <Reveal className="surface rounded-[24px] p-6 md:p-7" y={20} blur={6}>
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--tint)/0.1)] text-tint">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="mb-2 font-display text-[1.1875rem] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
          <div className="space-y-3 text-[15px] leading-relaxed text-ink-2 [&_a]:text-tint [&_a:hover]:underline">{children}</div>
        </div>
      </div>
    </Reveal>
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
        <p>Premium assets are provided under a limited, non-exclusive, non-transferable licence for use in your own personal or commercial creative projects. You may not reupload, leak, share, resell, sublicense, trade, or redistribute the source assets, whether unchanged, repackaged, or lightly modified.</p>
        <p>Your account and unique After Effects extension access code are personal to you and must not be shared. Effects Academy may suspend or terminate Premium access where these terms are violated.</p>
        <p>Subscription fees are non-refundable except where required by applicable law. You may cancel future renewals through subscription management. This does not affect your statutory rights.</p>
      </Card>
      <Card title="AI tools and fair use">
        <p>Effects Academy may offer AI-assisted tools for editing images or text previews. Free accounts may have limited monthly generations, while premium accounts may receive a higher generation allowance.</p>
        <p>Do not use AI tools to create illegal, harmful, deceptive, or rights-infringing content. Generated results may vary and should be reviewed before use in public projects.</p>
      </Card>
      <Card title="Copyright and takedowns">
        <p>If you believe your copyrighted work appears on Effects Academy without permission, use the DMCA page or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </Card>
      <Card title="Contact">
        <p>Questions, support requests, and moderation issues can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
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
        <p>For Premium accounts, Effects Academy also stores the version of the Premium Asset Licence you accepted and the date of acceptance.</p>
        <p>When you submit forms, we store the information you provide, such as DMCA notice details or suggestion text.</p>
      </Card>
      <Card title="Uploads and assets">
        <p>Uploaded files, thumbnails, titles, descriptions, creator tags, categories, and download counts are stored so the asset library can function.</p>
      </Card>
      <Card title="Payments" icon={LockKeyhole}>
        <p>Payments are processed by Stripe. Effects Academy does not store full card details. Stripe provides subscription and checkout status so premium access can be enabled or managed.</p>
      </Card>
      <Card title="Cookies and analytics">
        <p>Effects Academy may use cookies or similar technologies to keep users signed in, protect premium access, remember preferences, measure site performance, and understand how the site is used.</p>
        <p>Browser settings may allow you to block or delete cookies, although some site features may stop working properly if sign-in or preference cookies are disabled.</p>
      </Card>
      <Card title="AI generation usage">
        <p>AI text image generations are linked to your signed-in account so Effects Academy can enforce free and premium usage limits, prevent abuse, and show saved generations to eligible users.</p>
      </Card>
      <Card title="Email and support">
        <p>DMCA notices and suggestions may be delivered to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> so the team can review them.</p>
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
          className="btn btn-sm btn-tinted w-fit !no-underline"
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
          <Link to="/dmca">DMCA page</Link>{" "}
          so the notice includes all the required information.
        </p>
      </Card>
    </LegalShell>
  );
}
