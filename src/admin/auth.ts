import { SignJWT, jwtVerify } from "jose";

const ALGORITHM = "HS256";
const EXPIRY = "7d";
const ISSUER = "theitha-admin";

function getSecret(adminPassword: string): Uint8Array {
  return new TextEncoder().encode(`theitha-admin-jwt::${adminPassword}`);
}

export async function signAdminToken(adminPassword: string): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(EXPIRY)
    .sign(getSecret(adminPassword));
}

export async function verifyAdminToken(
  token: string,
  adminPassword: string
): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret(adminPassword), { issuer: ISSUER });
    return true;
  } catch {
    return false;
  }
}

export function extractBearerToken(
  authHeader: string | string[] | undefined
): string | null {
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}
