type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: {
    user?: {
      id?: number;
    };
  };
  colorScheme: "light" | "dark";
  isFullscreen?: boolean;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  setBottomBarColor?: (color: string) => void;
  onEvent?: (eventType: string, eventHandler: () => void) => void;
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

  document.documentElement.classList.add("telegram-mini-app");
  webApp.setHeaderColor("#06080d");
  webApp.setBackgroundColor("#06080d");
  webApp.setBottomBarColor?.("#06080d");
  webApp.disableVerticalSwipes?.();
  webApp.ready();

  const enterFullscreen = () => {
    webApp.expand();
    if (
      webApp.isVersionAtLeast?.("8.0") &&
      webApp.requestFullscreen &&
      !webApp.isFullscreen
    ) {
      try {
        webApp.requestFullscreen();
      } catch {
        webApp.expand();
      }
    }
  };

  enterFullscreen();
  webApp.onEvent?.("activated", enterFullscreen);
};

export {};
