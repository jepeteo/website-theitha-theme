import { createRemoteJWKSet, jwtVerify } from "jose";
import { GHOST_JWKS_URL } from "../config/constants.js";
import type { AppEnv } from "../config/env.js";
import { ApiError } from "../security/errors.js";

export type VerifiedMemberClaims = {
  sub: string;
  email: string | null;
};

type GhostMemberJwtPayload = {
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  aud?: string | string[];
  iss?: string;
};

const jwksByTtl = new Map<number, ReturnType<typeof createRemoteJWKSet>>();

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, "").toLowerCase();
}

function withWwwVariants(origin: string): string[] {
  const normalized = normalizeOrigin(origin);

  try {
    const url = new URL(normalized);
    const host = url.hostname;
    const candidates = new Set<string>([normalized]);

    if (host.startsWith("www.")) {
      const noWww = `${url.protocol}//${host.slice(4)}`;
      candidates.add(noWww);
    } else {
      const withWww = `${url.protocol}//www.${host}`;
      candidates.add(withWww);
    }

    return [...candidates];
  } catch {
    return [normalized];
  }
}

function readAudienceValues(aud: string | string[] | undefined): string[] {
  if (!aud) {
    return [];
  }

  if (Array.isArray(aud)) {
    return aud.map((entry) => normalizeOrigin(entry));
  }

  return [normalizeOrigin(aud)];
}

function isAllowedIssuer(issuer: string | undefined, env: AppEnv): boolean {
  if (!issuer) {
    return false;
  }

  const actual = normalizeOrigin(issuer);
  const allowed = new Set<string>([
    ...withWwwVariants(env.ghostOrigin),
    ...withWwwVariants(env.publicSiteOrigin)
  ]);

  return allowed.has(actual);
}

function isAllowedAudience(aud: string | string[] | undefined, env: AppEnv): boolean {
  const actualValues = readAudienceValues(aud);
  if (actualValues.length === 0) {
    return false;
  }

  const allowed = new Set<string>([
    ...withWwwVariants(env.publicSiteOrigin),
    ...withWwwVariants(env.ghostOrigin)
  ]);

  return actualValues.some((value) => allowed.has(value));
}

function getJwks(cacheTtlSeconds: number): ReturnType<typeof createRemoteJWKSet> {
  const existing = jwksByTtl.get(cacheTtlSeconds);
  if (existing) {
    return existing;
  }

  const jwks = createRemoteJWKSet(new URL(GHOST_JWKS_URL), {
    cacheMaxAge: cacheTtlSeconds * 1000,
    cooldownDuration: 30_000,
    timeoutDuration: 5_000
  });

  jwksByTtl.set(cacheTtlSeconds, jwks);
  return jwks;
}

export async function verifyMemberJwt(
  jwt: string,
  env: AppEnv
): Promise<VerifiedMemberClaims> {
  try {
    let memberPayload: GhostMemberJwtPayload;

    try {
      const { payload } = await jwtVerify(jwt, getJwks(env.jwksCacheTtlSeconds), {
        issuer: env.ghostOrigin,
        audience: env.publicSiteOrigin
      });
      memberPayload = payload as GhostMemberJwtPayload;
    } catch {
      const { payload } = await jwtVerify(jwt, getJwks(env.jwksCacheTtlSeconds));
      const relaxedPayload = payload as GhostMemberJwtPayload;

      if (!isAllowedIssuer(relaxedPayload.iss, env)) {
        throw new ApiError(401, "INVALID_MEMBER_TOKEN", "Invalid member token issuer");
      }

      if (!isAllowedAudience(relaxedPayload.aud, env)) {
        throw new ApiError(401, "INVALID_MEMBER_TOKEN", "Invalid member token audience");
      }

      memberPayload = relaxedPayload;
    }

    if (!memberPayload.sub || memberPayload.sub.trim() === "") {
      throw new ApiError(401, "INVALID_MEMBER_TOKEN", "Token subject is missing");
    }

    return {
      sub: memberPayload.sub,
      email: memberPayload.email ?? null
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, "INVALID_MEMBER_TOKEN", "Invalid member token");
  }
}
