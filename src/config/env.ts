import {
  DEFAULT_JWKS_CACHE_TTL_SECONDS,
  DEFAULT_MEMBER_CACHE_TTL_SECONDS,
  DEFAULT_SUMMARY_CACHE_TTL_SECONDS,
  GHOST_ORIGIN,
  PUBLIC_SITE_ORIGIN
} from "./constants.js";

export type AppEnv = {
  publicSiteOrigin: string;
  ghostOrigin: string;
  ghostAdminApiUrl: string;
  ghostAdminApiKey: string;
  databaseUrl: string;
  adminBypassEmails: string[];
  twelveDataApiKey: string;
  adminPassword: string;
  jwksCacheTtlSeconds: number;
  memberCacheTtlSeconds: number;
  summaryCacheTtlSeconds: number;
};

function readCsvEmails(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }

  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
}

function requireNonEmpty(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readPositiveInt(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer for ${name}`);
  }

  return parsed;
}

export function getAppEnv(processEnv: NodeJS.ProcessEnv = process.env): AppEnv {
  const publicSiteOrigin = processEnv.PUBLIC_SITE_ORIGIN ?? PUBLIC_SITE_ORIGIN;
  const ghostOrigin = processEnv.GHOST_ORIGIN ?? GHOST_ORIGIN;

  const ghostAdminApiUrl = requireNonEmpty(
    "GHOST_ADMIN_API_URL",
    processEnv.GHOST_ADMIN_API_URL
  );
  const ghostAdminApiKey = requireNonEmpty(
    "GHOST_ADMIN_API_KEY",
    processEnv.GHOST_ADMIN_API_KEY
  );
  const databaseUrl = requireNonEmpty("DATABASE_URL", processEnv.DATABASE_URL);
  const twelveDataApiKey = requireNonEmpty("TWELVE_DATA_API_KEY", processEnv.TWELVE_DATA_API_KEY);
  const adminPassword = requireNonEmpty("ADMIN_PASSWORD", processEnv.ADMIN_PASSWORD);

  return {
    publicSiteOrigin,
    ghostOrigin,
    ghostAdminApiUrl,
    ghostAdminApiKey,
    databaseUrl,
    twelveDataApiKey,
    adminPassword,
    adminBypassEmails: readCsvEmails(processEnv.ADMIN_BYPASS_EMAILS),
    jwksCacheTtlSeconds: readPositiveInt(
      processEnv.JWKS_CACHE_TTL,
      DEFAULT_JWKS_CACHE_TTL_SECONDS,
      "JWKS_CACHE_TTL"
    ),
    memberCacheTtlSeconds: readPositiveInt(
      processEnv.MEMBER_CACHE_TTL,
      DEFAULT_MEMBER_CACHE_TTL_SECONDS,
      "MEMBER_CACHE_TTL"
    ),
    summaryCacheTtlSeconds: readPositiveInt(
      processEnv.SUMMARY_CACHE_TTL,
      DEFAULT_SUMMARY_CACHE_TTL_SECONDS,
      "SUMMARY_CACHE_TTL"
    )
  };
}
