type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: {
    user?: {
      id?: number;
    };
  };
  colorScheme: "light" | "dark";
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  CloudStorage?: {
    setItem: (
      key: string,
      value: string,
      callback?: (error: string | null, stored?: boolean) => void,
    ) => void;
    getItem: (
      key: string,
      callback: (error: string | null, value?: string) => void,
    ) => void;
    getItems: (
      keys: string[],
      callback: (error: string | null, values?: Record<string, string>) => void,
    ) => void;
    removeItems: (
      keys: string[],
      callback?: (error: string | null, removed?: boolean) => void,
    ) => void;
  };
};

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export const initTelegramMiniApp = () => {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;

  webApp.setHeaderColor("#06080d");
  webApp.setBackgroundColor("#06080d");
  webApp.expand();
  webApp.ready();
};

export {};
