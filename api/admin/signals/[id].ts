import { verifyAdminToken, extractBearerToken } from "../../../src/admin/auth.js";
import { getAppEnv } from "../../../src/config/env.js";
import { getDbPool } from "../../../src/db/client.js";
import {
  updateSignal,
  deleteSignal
} from "../../../src/db/signals-repository.js";
import type { UpdateSignalInput } from "../../../src/contracts/signals.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end?: () => void;
};

function cors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

async function authenticate(
  req: VercelRequest,
  adminPassword: string
): Promise<boolean> {
  const token = extractBearerToken(req.headers["authorization"]);
  if (!token) return false;
  return verifyAdminToken(token, adminPassword);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  cors(res);

  if (req.method === "OPTIONS") {
    res.status(204);
    res.end?.();
    return;
  }

  const env = getAppEnv();

  if (!(await authenticate(req, env.adminPassword))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const idParam = req.query?.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id) {
    res.status(400).json({ error: "Signal ID required" });
    return;
  }

  const pool = getDbPool(env);

  // PATCH — update status or hit timestamps
  if (req.method === "PATCH") {
    const body = req.body as Record<string, unknown> | null | undefined;

    if (!body) {
      res.status(400).json({ error: "Request body required" });
      return;
    }

    const input: UpdateSignalInput = {};

    if (body.status !== undefined) {
      input.status = body.status as UpdateSignalInput["status"];
    }
    if (body.tp1HitAt !== undefined) {
      input.tp1HitAt = (body.tp1HitAt as string) || null;
    }
    if (body.tp2HitAt !== undefined) {
      input.tp2HitAt = (body.tp2HitAt as string) || null;
    }

    const updated = await updateSignal(pool, id, input);

    if (!updated) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    res.status(200).json({ data: updated });
    return;
  }

  // DELETE
  if (req.method === "DELETE") {
    const deleted = await deleteSignal(pool, id);

    if (!deleted) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
