import { SignJWT } from "jose";
import type { AppEnv } from "../config/env.js";
import { TtlCache } from "../security/cache.js";
import { ApiError } from "../security/errors.js";

type GhostMemberProduct = {
  name?: string;
};

type GhostMemberResponse = {
  members?: Array<{
    id?: string;
    uuid?: string;
    email?: string;
    status?: string;
    subscriptions?: Array<{ status?: string }>;
    products?: GhostMemberProduct[];
    tiers?: GhostMemberProduct[];
  }>;
};

type GhostMember = NonNullable<GhostMemberResponse["members"]>[number];

type MemberTier = "free" | "paid";

const memberTierCache = new TtlCache<MemberTier>();

function parseAdminApiKey(adminApiKey: string): { keyId: string; secretHex: string } {
  const [keyId, secretHex] = adminApiKey.split(":");
  if (!keyId || !secretHex) {
    throw new ApiError(500, "INVALID_ADMIN_KEY", "Invalid Ghost Admin API key format");
  }

  return { keyId, secretHex };
}

function isPaidLabel(productName: string): boolean {
  const normalized = productName.toLowerCase();
  return (
    normalized.includes("paid") ||
    normalized.includes("premium") ||
    normalized.includes("pro")
  );
}

function resolveTierFromMemberPayload(member: GhostMember | null): MemberTier {
  const activeSubscription =
    member?.subscriptions?.some((subscription) => subscription.status === "active") ??
    false;

  const paidProduct =
    member?.products?.some((product) =>
      product.name ? isPaidLabel(product.name) : false
    ) ?? false;

  const paidTier =
    member?.tiers?.some((tier) => (tier.name ? isPaidLabel(tier.name) : false)) ??
    false;

  return activeSubscription || paidProduct || paidTier ? "paid" : "free";
}

async function generateAdminJwt(env: AppEnv): Promise<string> {
  const { keyId, secretHex } = parseAdminApiKey(env.ghostAdminApiKey);
  const secret = Buffer.from(secretHex, "hex");
  if (secret.length === 0) {
    throw new ApiError(500, "INVALID_ADMIN_KEY", "Ghost Admin API secret is empty");
  }

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", kid: keyId, typ: "JWT" })
    .setAudience("/ghost/api/admin/")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}

export type GhostAdminClient = {
  createAdminToken: () => Promise<string>;
  fetchMember: (memberId: string) => Promise<GhostMember | null>;
  fetchMemberByUuid: (uuid: string) => Promise<GhostMember | null>;
  resolveMemberTier: (memberId: string, email?: string | null) => Promise<MemberTier>;
  resolveMemberTierByUuid: (uuid: string) => Promise<{ memberId: string; email: string | null; tier: MemberTier } | null>;
};

export function createGhostAdminClient(env: AppEnv): GhostAdminClient {
  async function createAdminToken(): Promise<string> {
    return generateAdminJwt(env);
  }

  async function fetchMember(
    memberId: string
  ): Promise<GhostMember | null> {
    const separator = env.ghostAdminApiUrl.endsWith("/") ? "" : "/";
    const endpoint =
      `${env.ghostAdminApiUrl}${separator}members/${memberId}/` +
      "?include=subscriptions,products,tiers";

    const adminToken = await createAdminToken();

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Ghost ${adminToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as GhostMemberResponse;
    return body.members?.[0] ?? null;
  }

  async function resolveMemberTier(memberId: string, email?: string | null): Promise<MemberTier> {
    const normalizedEmail = email ? email.trim().toLowerCase() : "";
    if (normalizedEmail && env.adminBypassEmails.includes(normalizedEmail)) {
      return "paid";
    }

    const cacheKey = `ghost-tier:${memberId}`;
    const cached = memberTierCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const member = await fetchMember(memberId);
    const tier = resolveTierFromMemberPayload(member);
    memberTierCache.set(cacheKey, tier, env.memberCacheTtlSeconds);

    return tier;
  }

  async function fetchMemberByUuid(
    uuid: string
  ): Promise<GhostMember | null> {
    const separator = env.ghostAdminApiUrl.endsWith("/") ? "" : "/";
    const endpoint =
      `${env.ghostAdminApiUrl}${separator}members/` +
      `?filter=uuid:'${encodeURIComponent(uuid)}'&include=subscriptions,products,tiers`;

    const adminToken = await createAdminToken();

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Ghost ${adminToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as GhostMemberResponse;
    return body.members?.[0] ?? null;
  }

  async function resolveMemberTierByUuid(
    uuid: string
  ): Promise<{ memberId: string; email: string | null; tier: MemberTier } | null> {
    const cacheKey = `ghost-tier-uuid:${uuid}`;
    const cached = memberTierCache.get(cacheKey);

    const member = cached ? null : await fetchMemberByUuid(uuid);
    if (!member && !cached) {
      return null;
    }

    const email = member?.email ?? null;
    const memberId = member?.id ?? uuid;

    const normalizedEmail = email ? email.trim().toLowerCase() : "";
    if (normalizedEmail && env.adminBypassEmails.includes(normalizedEmail)) {
      return { memberId, email, tier: "paid" };
    }

    if (cached) {
      return { memberId, email, tier: cached };
    }

    const tier = resolveTierFromMemberPayload(member);
    memberTierCache.set(cacheKey, tier, env.memberCacheTtlSeconds);

    return { memberId, email, tier };
  }

  return {
    createAdminToken,
    fetchMember,
    fetchMemberByUuid,
    resolveMemberTier,
    resolveMemberTierByUuid
  };
}
