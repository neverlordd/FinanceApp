import { FinanceData } from "./types";
import {
  getTelegramCloudStorage,
  readTelegramCloudData,
  writeTelegramCloudData,
} from "./telegramCloudStorage";

const telegramInitData = () => window.Telegram?.WebApp.initData ?? "";
const isStaticStorage = import.meta.env.VITE_STATIC_STORAGE === "true";

const defaultData = (): FinanceData => ({
  baselineMonthlyIncome: 0,
  baselineBalance: 0,
  monthlyBudgets: [],
  debts: [],
});

const localStorageKey = () => {
  const telegramUserId = window.Telegram?.WebApp.initDataUnsafe?.user?.id;
  return `finance-tracker-data:v1:${telegramUserId ? `telegram:${telegramUserId}` : "browser"}`;
};

const browserStorageKey = "finance-tracker-data:v1:browser";

const staticResponse = (body: unknown, status = 200, provider = "browser", needsCloudRepair = false) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Storage-Provider": provider,
      "X-Storage-Persistent": "true",
      ...(needsCloudRepair ? { "X-Storage-Needs-Repair": "true" } : {}),
    },
  });

const readLocalData = (): FinanceData | null => {
  const keys = [...new Set([localStorageKey(), browserStorageKey])];
  let firstSavedData: FinanceData | null = null;

  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (!value) continue;
    const parsed = JSON.parse(value) as FinanceData;
    firstSavedData ??= parsed;
    if (
      parsed.baselineMonthlyIncome !== 0 ||
      parsed.baselineBalance !== 0 ||
      parsed.monthlyBudgets.length > 0 ||
      parsed.debts?.length ||
      parsed.workoutWeeks?.length ||
      parsed.expenseTemplateOverrides?.length ||
      parsed.activeMonths?.length
    ) return parsed;
  }

  return firstSavedData;
};

const writeLocalData = (data: FinanceData) => {
  localStorage.setItem(localStorageKey(), JSON.stringify(data));
};

const hasUserData = (data: FinanceData) =>
  data.baselineMonthlyIncome !== 0 ||
  data.baselineBalance !== 0 ||
  data.monthlyBudgets.length > 0 ||
  Boolean(data.debts?.length) ||
  Boolean(data.workoutWeeks?.length) ||
  Boolean(data.expenseTemplateOverrides?.length) ||
  Boolean(data.activeMonths?.length);

const staticApiFetch = async (input: RequestInfo | URL, init: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;

  if (url.endsWith("/api/data") && (!init.method || init.method === "GET")) {
    try {
      const localData = readLocalData();
      const cloudStorage = getTelegramCloudStorage();
      if (!cloudStorage) return staticResponse(localData ?? defaultData());

      try {
        const cloudData = await readTelegramCloudData(cloudStorage);

        if (cloudData) {
          if (!hasUserData(cloudData) && localData && hasUserData(localData)) {
            await writeTelegramCloudData(cloudStorage, localData);
            return staticResponse(localData, 200, "telegram-cloud");
          }
          try { writeLocalData(cloudData); } catch { /* Cloud remains the source of truth. */ }
          return staticResponse(cloudData, 200, "telegram-cloud");
        }

        if (localData && hasUserData(localData)) {
          await writeTelegramCloudData(cloudStorage, localData);
        }
        return staticResponse(localData ?? defaultData(), 200, "telegram-cloud");
      } catch (error) {
        console.error("Telegram cloud read failed:", error);
        return staticResponse(localData ?? defaultData(), 200, "browser", error instanceof SyntaxError);
      }
    } catch {
      return staticResponse({ error: "Unable to read browser storage" }, 500);
    }
  }

  if (url.endsWith("/api/data/sync") && init.method === "POST") {
    try {
      const data = JSON.parse(String(init.body)) as FinanceData;
      writeLocalData(data);

      const cloudStorage = getTelegramCloudStorage();
      if (cloudStorage) {
        try {
          await writeTelegramCloudData(cloudStorage, data);
          return staticResponse({ success: true, data }, 200, "telegram-cloud");
        } catch (error) {
          console.error("Telegram cloud save failed:", error);
          return staticResponse({ error: "Saved on this device, but Telegram cloud sync failed" }, 503);
        }
      }

      return staticResponse({ success: true, data });
    } catch {
      return staticResponse({ error: "Unable to save data in this browser" }, 507);
    }
  }

  return staticResponse({ error: "Not found" }, 404);
};

export const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  if (isStaticStorage) return staticApiFetch(input, init);

  const headers = new Headers(init.headers);
  const initData = telegramInitData();
  if (initData) headers.set("X-Telegram-Init-Data", initData);

  return fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
  });
};
