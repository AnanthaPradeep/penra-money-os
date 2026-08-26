import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Action request bodies default to 1MB, which a multi-year
      // bank statement CSV can exceed even well under our own row-count
      // cap (see MAX_STATEMENT_FILE_BYTES in src/lib/bank-import/limits.ts,
      // which stays the authoritative, enforced limit — this just raises
      // the framework ceiling enough for that check to be the one that
      // actually fires, not a generic "request too large" from Next itself.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
