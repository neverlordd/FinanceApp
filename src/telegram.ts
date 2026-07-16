type TelegramWebApp = {
  initData: string;
  colorScheme: "light" | "dark";
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
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
