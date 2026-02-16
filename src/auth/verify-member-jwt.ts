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
    const { payload } = await jwtVerify(jwt, getJwks(env.jwksCacheTtlSeconds), {
      issuer: env.ghostOrigin,
      audience: env.publicSiteOrigin
    });

    const memberPayload = payload as GhostMemberJwtPayload;

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
