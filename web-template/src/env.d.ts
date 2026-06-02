/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Server-side API base (used during SSR in page frontmatter)
  readonly API_URL: string;
  readonly API_VERSION: string;

  // Browser-side API base (used by React islands)
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_API_VERSION: string;

  // CDN / static host that islands may fetch
  readonly PUBLIC_STATIC_URL: string;

  // Canonical site origin — drives canonical URLs, OG tags, JSON-LD
  readonly PUBLIC_SITE_URL: string;

  // Site identity (Layout defaults)
  readonly PUBLIC_SITE_NAME: string;
  readonly PUBLIC_SITE_DESCRIPTION: string;
  readonly PUBLIC_OG_IMAGE: string;

  // Analytics (optional)
  readonly PUBLIC_GA_ID: string;

  // Loki structured logging
  readonly LOKI_URL: string;
  readonly LOKI_APP_NAME: string;

  // Rate limiting
  readonly RATE_LIMIT_WEB_ENABLED: string;
  readonly RATE_LIMIT_WEB_WINDOW_MS: string;
  readonly RATE_LIMIT_WEB_MAX: string;
  readonly RATE_LIMIT_WEB_BAN_THRESHOLD: string;
  readonly RATE_LIMIT_WEB_BAN_DURATION_MS: string;
  readonly RATE_LIMIT_WEB_WHITELIST: string;
  readonly TRUSTED_PROXIES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
