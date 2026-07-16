import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { FinanceData } from "./src/types";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

app.use(express.json());

// Helper to get current date in YYYY-MM
const getCurrentMonthStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// Initial default data matching the user's workflow and screenshot
const getDefaultData = (): FinanceData => {
  const currentMonth = getCurrentMonthStr();
  // We'll place some realistic data, including the screenshot sample
  return {
    baselineMonthlyIncome: 3000,
    baselineBalance: 1500, // starting accumulated savings
    monthlyBudgets: [
      {
        monthStr: "2026-08", // August 2026 to match screenshot
        income: 3000,
        expenses: [
          {
            id: "aug-1",
            category: "Salary",
            description: "Salary advance deduction (2nd part)",
            amount: 675,
            completed: true
          },
          {
            id: "aug-2",
            category: "Debt",
            description: "Debt to Wife",
            amount: 150,
            completed: true
          },
          {
            id: "aug-3",
            category: "Debt",
            description: "Debt to Amal (remaining)",
            amount: 175,
            completed: true
          },
          {
            id: "aug-4",
            category: "Debt",
            description: "Debt to Andrey",
            amount: 250,
            completed: true
          },
          {
            id: "aug-5",
            category: "Debt",
            description: "Small debt",
            amount: 50,
            completed: false
          },
          {
            id: "aug-6",
            category: "Housing",
            description: "Apartment Rent",
            amount: 270,
            completed: false
          },
          {
            id: "aug-7",
            category: "Living",
            description: "Food & Groceries (Tbilisi)",
            amount: 189.39,
            completed: false
          }
        ]
      }
    ]
  };
};

// Safe database reading
const readDB = (): FinanceData => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const dataStr = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(dataStr);
      // Migrate / fallback if structure is old
      if (typeof parsed.baselineMonthlyIncome !== "number" || !Array.isArray(parsed.monthlyBudgets)) {
        console.log("Old DB format detected, resetting to simplified monthly model");
        const fresh = getDefaultData();
        writeDB(fresh);
        return fresh;
      }
      return parsed;
    }
  } catch (err) {
    console.error("Error reading or parsing db.json, resetting to default:", err);
  }
  const defaultData = getDefaultData();
  writeDB(defaultData);
  return defaultData;
};

// Safe database writing
const writeDB = (data: FinanceData) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing db.json:", err);
  }
};

// --- API ENDPOINTS ---

// Get all data
app.get("/api/data", (req, res) => {
  res.json(readDB());
});

// Sync full data
app.post("/api/data/sync", (req, res) => {
  const newData = req.body as FinanceData;
  if (
    typeof newData.baselineMonthlyIncome !== "number" ||
    typeof newData.baselineBalance !== "number" ||
    !Array.isArray(newData.monthlyBudgets)
  ) {
    return res.status(400).json({ error: "Invalid data format" });
  }
  writeDB(newData);
  res.json({ success: true, data: newData });
});

// Start server after setting up Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
