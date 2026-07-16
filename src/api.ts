const telegramInitData = () => window.Telegram?.WebApp.initData ?? "";

export const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const initData = telegramInitData();
  if (initData) headers.set("X-Telegram-Init-Data", initData);

  return fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
  });
};
