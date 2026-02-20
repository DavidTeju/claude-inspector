/**
 * Highlights search terms in text by wrapping matches in <mark> tags.
 */
export function highlightTerms(text: string, query: string): string {
  if (!query || !text) return text;
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  let result = text;
  for (const term of terms) {
    const regex = new RegExp(
      `(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    result = result.replace(
      regex,
      '<mark class="bg-accent-500/30 text-accent-300 rounded px-0.5">$1</mark>',
    );
  }
  return result;
}

/**
 * Formats an ISO date string as "Mon DD, HH:MM AM/PM".
 */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats an ISO date string as a relative time ("Just now", "5m ago", etc.)
 */
export function formatRelativeDate(iso: string): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
