import { createPool, Pool as MySqlPool, RowDataPacket } from "mysql2/promise";
import { Pool as PostgresPool, PoolConfig } from "pg";
import { FinanceData } from "../src/types";

export type StorageProvider = "memory" | "mysql" | "postgresql";

export interface StorageStatus {
  provider: StorageProvider;
  persistent: boolean;
}

interface FinanceDataRow extends RowDataPacket {
  finance_data: FinanceData | string;
}

const defaultData = (): FinanceData => ({
  baselineMonthlyIncome: 0,
  baselineBalance: 0,
  monthlyBudgets: [],
});

const memoryStore = new Map<string, FinanceData>();
let postgresPool: PostgresPool | null = null;
let mysqlPool: MySqlPool | null = null;
let storageStatus: StorageStatus = { provider: "memory", persistent: false };

const hasMySqlEnvironment = () =>
  Boolean(
    process.env.MYSQL_HOST &&
    process.env.MYSQL_DATABASE &&
    process.env.MYSQL_USER &&
    process.env.MYSQL_PASSWORD,
  );

const initPostgres = async (connectionString: string) => {
  const config: PoolConfig = { connectionString };
  if (process.env.DATABASE_SSL === "true") {
    config.ssl = {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
    };
  }

  postgresPool = new PostgresPool(config);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS finance_user_data (
      user_key TEXT PRIMARY KEY,
      finance_data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  storageStatus = { provider: "postgresql", persistent: true };
};

const initMySql = async (connectionString?: string) => {
  mysqlPool = connectionString
    ? createPool(connectionString)
    : createPool({
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT) || 3306,
        database: process.env.MYSQL_DATABASE,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        waitForConnections: true,
        connectionLimit: 10,
      });

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS finance_user_data (
      user_key VARCHAR(191) PRIMARY KEY,
      finance_data JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  storageStatus = { provider: "mysql", persistent: true };
};

export const initStorage = async () => {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString?.startsWith("postgres://") || connectionString?.startsWith("postgresql://")) {
    await initPostgres(connectionString);
    return;
  }

  if (connectionString?.startsWith("mysql://")) {
    await initMySql(connectionString);
    return;
  }

  if (connectionString) {
    throw new Error("DATABASE_URL must use a postgresql://, postgres://, or mysql:// scheme");
  }

  if (hasMySqlEnvironment()) {
    await initMySql();
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Persistent database configuration is required in production. Set DATABASE_URL or the MYSQL_* variables.",
    );
  }

  console.warn("Database is not configured; using temporary in-memory storage for development");
};

export const getStorageStatus = (): StorageStatus => ({ ...storageStatus });

export const readFinanceData = async (userKey: string): Promise<FinanceData> => {
  if (postgresPool) {
    const result = await postgresPool.query<{ finance_data: FinanceData }>(
      "SELECT finance_data FROM finance_user_data WHERE user_key = $1",
      [userKey],
    );
    return result.rows[0]?.finance_data ?? defaultData();
  }

  if (mysqlPool) {
    const [rows] = await mysqlPool.execute<FinanceDataRow[]>(
      "SELECT finance_data FROM finance_user_data WHERE user_key = ?",
      [userKey],
    );
    const storedData = rows[0]?.finance_data;
    if (!storedData) return defaultData();
    return typeof storedData === "string" ? JSON.parse(storedData) : storedData;
  }

  return memoryStore.get(userKey) ?? defaultData();
};

export const writeFinanceData = async (userKey: string, data: FinanceData): Promise<void> => {
  const serializedData = JSON.stringify(data);

  if (postgresPool) {
    await postgresPool.query(
      `INSERT INTO finance_user_data (user_key, finance_data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_key)
       DO UPDATE SET finance_data = EXCLUDED.finance_data, updated_at = NOW()`,
      [userKey, serializedData],
    );
    return;
  }

  if (mysqlPool) {
    await mysqlPool.execute(
      `INSERT INTO finance_user_data (user_key, finance_data, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE finance_data = VALUES(finance_data), updated_at = CURRENT_TIMESTAMP`,
      [userKey, serializedData],
    );
    return;
  }

  memoryStore.set(userKey, structuredClone(data));
};

export const checkStorage = async (): Promise<void> => {
  if (postgresPool) await postgresPool.query("SELECT 1");
  if (mysqlPool) await mysqlPool.query("SELECT 1");
};
