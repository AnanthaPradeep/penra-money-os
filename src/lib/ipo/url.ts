import { validateSourceUrl } from "@/lib/research/url";
import type { IpoSourceOrganization } from "@/lib/ipo/types";

/**
 * Known official hostnames for SEBI/NSE/BSE — deliberately narrow and
 * hand-maintained (never inferred/guessed) so a source_organization of
 * "sebi"/"nse"/"bse" can only ever be backed by a link that actually
 * points at that regulator/exchange's own domain, not merely any HTTPS
 * URL. issuer_ir/other_official have no fixed domain (every company's
 * investor-relations page is different) and so only go through the
 * general SSRF-safe validation in src/lib/research/url.ts, with no
 * additional allowlist check.
 */
const OFFICIAL_HOSTNAME_ALLOWLIST: Record<"sebi" | "nse" | "bse", string[]> = {
  sebi: ["sebi.gov.in", "www.sebi.gov.in"],
  nse: [
    "www.nseindia.com",
    "nsearchives.nseindia.com",
    "archives.nseindia.com",
  ],
  bse: ["www.bseindia.com"],
};

export type IpoUrlValidationResult =
  { success: true; url: string } | { success: false; error: string };

/**
 * Validates a user-supplied IPO source URL: first through the same
 * SSRF-safe checks as every other research source link (HTTPS-only, no
 * credentials, no private/local network), then — only for
 * source_organization "sebi"/"nse"/"bse" — additionally requires the
 * hostname to match that regulator/exchange's own known domain. Never
 * fetches the URL; this only decides whether it is safe to store and
 * render as a link.
 */
export function validateOfficialIpoSourceUrl(
  raw: string,
  sourceOrganization: IpoSourceOrganization,
): IpoUrlValidationResult {
  const base = validateSourceUrl(raw);
  if (!base.success) {
    return base;
  }

  if (
    sourceOrganization === "sebi" ||
    sourceOrganization === "nse" ||
    sourceOrganization === "bse"
  ) {
    const allowed = OFFICIAL_HOSTNAME_ALLOWLIST[sourceOrganization];
    if (!allowed.includes(base.hostname.toLowerCase())) {
      return {
        success: false,
        error: `A "${sourceOrganization.toUpperCase()}" source must link to ${allowed.join(" or ")}.`,
      };
    }
  }

  return { success: true, url: base.url };
}
