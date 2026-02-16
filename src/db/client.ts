import { Pool } from "pg";
import type { AppEnv } from "../config/env.js";

let pool: Pool | null = null;

export function getDbPool(env: AppEnv): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: env.databaseUrl,
    max: 4,
    idleTimeoutMillis: 5000
  });

  return pool;
}
