import { verifyAdminToken, extractBearerToken } from "../../../src/admin/auth.js";
import { getAppEnv } from "../../../src/config/env.js";
import { getDbPool } from "../../../src/db/client.js";
import {
  fetchAllSignalsAdmin,
  createSignal
} from "../../../src/db/signals-repository.js";
import type { CreateSignalInput } from "../../../src/contracts/signals.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

  const pool = getDbPool(env);

  // GET — list all signals
  if (req.method === "GET") {
    const signals = await fetchAllSignalsAdmin(pool);
    res.status(200).json({ data: signals });
    return;
  }

  // POST — create signal
  if (req.method === "POST") {
    const body = req.body as Record<string, unknown> | null | undefined;

    if (!body) {
      res.status(400).json({ error: "Request body required" });
      return;
    }

    const required = ["symbol", "direction", "entry", "stopLoss", "tp1"];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === "") {
        res.status(400).json({ error: `Missing required field: ${field}` });
        return;
      }
    }

    const input: CreateSignalInput = {
      symbol: body.symbol as string,
      direction: body.direction as "buy" | "sell",
      entry: Number(body.entry),
      stopLoss: Number(body.stopLoss),
      tp1: Number(body.tp1),
      tp2: body.tp2 != null ? Number(body.tp2) : null,
      description: (body.description as string) || null,
      chartTimeframe: (body.chartTimeframe as CreateSignalInput["chartTimeframe"]) || null,
      expiresAt: (body.expiresAt as string) || null,
      signalDate: (body.signalDate as string) || null
    };

    const signal = await createSignal(pool, input);
    res.status(201).json({ data: signal });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
