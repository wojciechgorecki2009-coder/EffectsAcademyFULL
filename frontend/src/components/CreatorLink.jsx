import { ExternalLink } from "lucide-react";
import { creditPlatform, useCreatorCredit } from "@/lib/creatorCredits";

/* Small brand marks for the credit chip (TikTok and YouTube have no icon in lucide). */
function PlatformIcon({ id, className = "h-3.5 w-3.5" }) {
  if (id === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.07v12.4a2.6 2.6 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.4-2.47V9.7a5.66 5.66 0 0 0-.8-.06 5.66 5.66 0 0 0-5.66 5.66 5.66 5.66 0 0 0 5.66 5.66 5.66 5.66 0 0 0 5.66-5.66V9.03a7.3 7.3 0 0 0 4.3 1.38V7.35a4.3 4.3 0 0 1-3.25-1.53z" />
      </svg>
    );
  }
  if (id === "youtube") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.4A3 3 0 0 0 .5 6.5 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1C4.5 20 12 20 12 20s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.5zM9.6 15.4V8.6l6.3 3.4-6.3 3.4z" />
      </svg>
    );
  }
  if (id === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "twitch") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M4.3 1 1.5 5.4v15.1h5.2V24h2.8l2.8-3.5h4.3l6-6V1H4.3zm16.2 12.4-3.5 3.5h-5.2l-2.8 2.8v-2.8H4.7V3.1h15.8v10.3zM17 7h-2.1v6H17V7zm-5.5 0h-2.1v6h2.1V7z" />
      </svg>
    );
  }
  return <ExternalLink className={className} />;
}

const stop = (event) => event.stopPropagation();

/**
 * A creator's name. When a credit link is set for them it's a link that opens in a new
 * tab; otherwise plain text. Clicks don't bubble, so it's safe inside clickable cards.
 */
export function CreatorName({ name, className = "" }) {
  const url = useCreatorCredit(name);
  if (!name) return null;
  if (!url) return <span className={className}>{name}</span>;
  const platform = creditPlatform(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={stop}
      title={`${name} on ${platform.label}`}
      className={`creator-link ${className}`}
      data-testid="creator-link"
    >
      {name}
    </a>
  );
}

/**
 * A pill for pack headers: the platform icon and name, linking to the creator's page.
 * Renders nothing when the creator has no credit link.
 */
export function CreatorCreditChip({ name, className = "" }) {
  const url = useCreatorCredit(name);
  if (!url) return null;
  const platform = creditPlatform(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={stop}
      className={`creator-credit-chip ${className}`}
      data-testid="creator-credit-chip"
    >
      <PlatformIcon id={platform.id} />
      <span>{name} on {platform.label}</span>
      <ExternalLink className="h-3 w-3 opacity-70" />
    </a>
  );
}

export { PlatformIcon };
