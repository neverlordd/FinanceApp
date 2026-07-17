import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { FinanceData } from "./src/types";
import { resolveRequestIdentity } from "./server/auth";
import {
  checkStorage,
  getStorageStatus,
  initStorage,
  readFinanceData,
  writeFinanceData,
} from "./server/storage";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isFinanceData = (value: unknown): value is FinanceData => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<FinanceData>;

  if (
    !isFiniteNumber(data.baselineMonthlyIncome) || data.baselineMonthlyIncome < 0 ||
    !isFiniteNumber(data.baselineBalance) ||
    !Array.isArray(data.monthlyBudgets)
  ) return false;

  if (data.activeMonths !== undefined && (
    !Array.isArray(data.activeMonths) ||
    data.activeMonths.some(month => typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
  )) return false;

  if (data.debts !== undefined && (
    !Array.isArray(data.debts) ||
    data.debts.some(debt =>
      !debt ||
      typeof debt.id !== "string" || debt.id.length === 0 ||
      typeof debt.name !== "string" || debt.name.trim().length === 0 ||
      !isFiniteNumber(debt.totalAmount) || debt.totalAmount <= 0 ||
      typeof debt.createdAt !== "string" ||
      !Array.isArray(debt.payments) ||
      debt.payments.some(payment =>
        !payment ||
        typeof payment.id !== "string" || payment.id.length === 0 ||
        !isFiniteNumber(payment.amount) || payment.amount <= 0 ||
        typeof payment.createdAt !== "string"
      ) ||
      debt.payments.reduce((sum, payment) => sum + payment.amount, 0) > debt.totalAmount + 0.01
    )
  )) return false;

  return data.monthlyBudgets.every(budget =>
    budget &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(budget.monthStr) &&
    isFiniteNumber(budget.income) && budget.income >= 0 &&
    Array.isArray(budget.expenses) &&
    budget.expenses.every(item =>
      item &&
      typeof item.id === "string" && item.id.length > 0 &&
      typeof item.category === "string" && item.category.trim().length > 0 &&
      typeof item.description === "string" &&
      isFiniteNumber(item.amount) && item.amount > 0 &&
      typeof item.completed === "boolean" &&
      (item.type === undefined || item.type === "income" || item.type === "expense")
    )
  );
};

const attachStorageHeaders = (res: express.Response) => {
  const storage = getStorageStatus();
  res.setHeader("X-Storage-Provider", storage.provider);
  res.setHeader("X-Storage-Persistent", String(storage.persistent));
};

app.get("/api/health", async (_req, res) => {
  try {
    await checkStorage();
    res.json({ status: "ok", storage: getStorageStatus() });
  } catch (error) {
    console.error("Storage health check failed:", error);
    res.status(503).json({ status: "unavailable" });
  }
});

app.get("/api/data", async (req, res) => {
  const identity = resolveRequestIdentity(req, res);
  if (!identity) return res.status(401).json({ error: "Invalid Telegram authorization" });

  try {
    const data = await readFinanceData(identity.userKey);
    attachStorageHeaders(res);
    res.json(data);
  } catch (error) {
    console.error("Failed to read finance data:", error);
    res.status(500).json({ error: "Failed to load data" });
  }
});

app.post("/api/data/sync", async (req, res) => {
  const identity = resolveRequestIdentity(req, res);
  if (!identity) return res.status(401).json({ error: "Invalid Telegram authorization" });
  if (!isFinanceData(req.body)) return res.status(400).json({ error: "Invalid data format" });

  try {
    await writeFinanceData(identity.userKey, req.body);
    attachStorageHeaders(res);
    res.json({ success: true, data: req.body });
  } catch (error) {
    console.error("Failed to persist finance data:", error);
    res.status(500).json({ error: "Failed to persist data" });
  }
});

async function startServer() {
  await initStorage();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
