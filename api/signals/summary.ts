import { getAppEnv } from "../../src/config/env.js";
import { getDbPool } from "../../src/db/client.js";
import { fetchSignalSummary } from "../../src/db/signals-repository.js";
import { resolveAuthContextFromRequest } from "../../src/services/auth-context-resolver.js";
import { ApiError, isApiError } from "../../src/security/errors.js";
import { checkRateLimit } from "../../src/security/rate-limit.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

type VercelResponse = {
  status: (statusCode: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Only GET is supported");
    }

    const clientIp = req.socket?.remoteAddress ?? "unknown";
    const rateLimit = checkRateLimit(`summary:${clientIp}`, 60, 60);
    res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
    res.setHeader("X-RateLimit-Reset", String(rateLimit.resetAtEpochMs));

    if (!rateLimit.allowed) {
      throw new ApiError(429, "RATE_LIMITED", "Too many requests");
    }

    await resolveAuthContextFromRequest(req);

    const env = getAppEnv();
    const pool = getDbPool(env);
    const summary = await fetchSignalSummary(pool);

    res.status(200).json(summary);
  } catch (error: unknown) {
    if (isApiError(error)) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error"
    });
  }
}
