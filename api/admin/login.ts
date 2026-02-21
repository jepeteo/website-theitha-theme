import { signAdminToken } from "../../src/admin/auth.js";
import { getAppEnv } from "../../src/config/env.js";

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

function applyCorsHeaders(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  applyCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204);
    res.end?.();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body as Record<string, unknown> | null | undefined;
  const password = typeof body?.password === "string" ? body.password : null;

  if (!password) {
    res.status(400).json({ error: "Password required" });
    return;
  }

  const env = getAppEnv();

  if (password !== env.adminPassword) {
    // Constant-time comparison isn't critical here — single admin, rate limited by Vercel
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  const token = await signAdminToken(env.adminPassword);
  res.status(200).json({ token });
}
