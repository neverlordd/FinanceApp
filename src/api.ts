import { FinanceData } from "./types";

const telegramInitData = () => window.Telegram?.WebApp.initData ?? "";
const isStaticStorage = import.meta.env.VITE_STATIC_STORAGE === "true";

const defaultData = (): FinanceData => ({
  baselineMonthlyIncome: 0,
  baselineBalance: 0,
  monthlyBudgets: [],
});

const localStorageKey = () => {
  const telegramUserId = window.Telegram?.WebApp.initDataUnsafe?.user?.id;
  return `finance-tracker-data:v1:${telegramUserId ? `telegram:${telegramUserId}` : "browser"}`;
};

const staticResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Storage-Provider": "browser",
      "X-Storage-Persistent": "true",
    },
  });

const staticApiFetch = async (input: RequestInfo | URL, init: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;

  if (url.endsWith("/api/data") && (!init.method || init.method === "GET")) {
    try {
      const savedData = localStorage.getItem(localStorageKey());
      return staticResponse(savedData ? JSON.parse(savedData) : defaultData());
    } catch {
      return staticResponse({ error: "Unable to read browser storage" }, 500);
    }
  }

  if (url.endsWith("/api/data/sync") && init.method === "POST") {
    try {
      const data = JSON.parse(String(init.body)) as FinanceData;
      localStorage.setItem(localStorageKey(), JSON.stringify(data));
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
