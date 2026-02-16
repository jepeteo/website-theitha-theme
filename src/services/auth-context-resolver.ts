import { verifyMemberJwt } from "../auth/verify-member-jwt.js";
import { getAppEnv } from "../config/env.js";
import type { AuthContext } from "../contracts/auth-context.js";
import type { AppEnv } from "../config/env.js";
import { createGhostAdminClient } from "./ghost-admin-client.js";

export type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

export type ResolveAuthContextDeps = {
  env?: AppEnv;
  verifyJwt?: typeof verifyMemberJwt;
  resolveTier?: (memberId: string) => Promise<"free" | "paid">;
};

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const value = headers[key.toLowerCase()] ?? headers[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function readTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const segments = cookieHeader.split(";").map((segment) => segment.trim());
  for (const segment of segments) {
    const [name, ...rest] = segment.split("=");
    if (name === "ghost-members-ssr") {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

function readBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function resolveAuthContextFromRequest(
  req: RequestLike,
  deps: ResolveAuthContextDeps = {}
): Promise<AuthContext> {
  const env = deps.env ?? getAppEnv();
  const verifyJwt = deps.verifyJwt ?? verifyMemberJwt;
  const resolveTier =
    deps.resolveTier ?? (async (memberId: string) => createGhostAdminClient(env).resolveMemberTier(memberId));

  const authHeader = readHeader(req.headers, "authorization");
  const cookieHeader = readHeader(req.headers, "cookie");
  const token = readBearerToken(authHeader) ?? readTokenFromCookie(cookieHeader);

  if (!token) {
    return {
      memberId: null,
      email: null,
      tier: "anonymous",
      isAuthenticated: false
    };
  }

  const verified = await verifyJwt(token, env);
  const tier = await resolveTier(verified.sub);

  return {
    memberId: verified.sub,
    email: verified.email,
    tier,
    isAuthenticated: true
  };
}
