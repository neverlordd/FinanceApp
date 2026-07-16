import { Pool, PoolConfig } from "pg";
import { FinanceData } from "../src/types";

const defaultData = (): FinanceData => ({
  baselineMonthlyIncome: 0,
  baselineBalance: 0,
  monthlyBudgets: [],
});

const memoryStore = new Map<string, FinanceData>();
let pool: Pool | null = null;

export const initStorage = async () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production");
    }
    console.warn("DATABASE_URL is not set; using temporary in-memory storage for development");
    return;
  }

  const config: PoolConfig = { connectionString };
  if (process.env.DATABASE_SSL === "true") {
    config.ssl = {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
    };
  }

  pool = new Pool(config);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_user_data (
      user_key TEXT PRIMARY KEY,
      finance_data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

export const readFinanceData = async (userKey: string): Promise<FinanceData> => {
  if (!pool) return memoryStore.get(userKey) ?? defaultData();

  const result = await pool.query<{ finance_data: FinanceData }>(
    "SELECT finance_data FROM finance_user_data WHERE user_key = $1",
    [userKey],
  );
  return result.rows[0]?.finance_data ?? defaultData();
};

export const writeFinanceData = async (userKey: string, data: FinanceData): Promise<void> => {
  if (!pool) {
    memoryStore.set(userKey, structuredClone(data));
    return;
  }

  await pool.query(
    `INSERT INTO finance_user_data (user_key, finance_data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_key)
     DO UPDATE SET finance_data = EXCLUDED.finance_data, updated_at = NOW()`,
    [userKey, JSON.stringify(data)],
  );
};

export const checkStorage = async (): Promise<void> => {
  if (pool) await pool.query("SELECT 1");
};
