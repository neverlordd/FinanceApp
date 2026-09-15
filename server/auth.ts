import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { Request, Response } from "express";

const TELEGRAM_HEADER = "x-telegram-init-data";
const SESSION_COOKIE = "finance_session";
const DEFAULT_AUTH_MAX_AGE_SECONDS = 86_400;

type TelegramUser = {
  id: number;
};

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const validateTelegramInitData = (
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramUser | null => {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userJson = params.get("user");
  if (!receivedHash || !Number.isInteger(authDate) || !userJson) return null;

  const maxAge = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS) || DEFAULT_AUTH_MAX_AGE_SECONDS;
  if (authDate > nowSeconds + 60 || nowSeconds - authDate > maxAge) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqual(expectedHash, receivedHash)) return null;

  try {
    const user = JSON.parse(userJson) as TelegramUser;
    return Number.isSafeInteger(user.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
};

const parseCookies = (header: string | undefined): Record<string, string> => {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map(part => {
      const separator = part.indexOf("=");
      if (separator === -1) return [part.trim(), ""];
      return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1))];
    }),
  );
};

const getSessionSecret = (): string | null => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.BOT_TOKEN) {
    return createHash("sha256").update(`finance-session:${process.env.BOT_TOKEN}`).digest("hex");
  }
  return process.env.NODE_ENV === "production" ? null : "finance-development-session-secret";
};

const signSessionId = (sessionId: string, secret: string) =>
  createHmac("sha256", secret).update(sessionId).digest("hex");

const getWebSessionId = (req: Request, res: Response): string | null => {
  const secret = getSessionSecret();
  if (!secret) return null;

  const cookieValue = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (cookieValue) {
    const separator = cookieValue.lastIndexOf(".");
    const sessionId = cookieValue.slice(0, separator);
    const signature = cookieValue.slice(separator + 1);
    if (separator > 0 && safeEqual(signSessionId(sessionId, secret), signature)) return sessionId;
  }

  const sessionId = randomUUID();
  const signature = signSessionId(sessionId, secret);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionId}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  );
  return sessionId;
};

export type RequestIdentity = {
  userKey: string;
  source: "telegram" | "web";
};

export const resolveRequestIdentity = (req: Request, res: Response): RequestIdentity | null => {
  const telegramInitData = req.header(TELEGRAM_HEADER);
  if (telegramInitData) {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return null;
    const telegramUser = validateTelegramInitData(telegramInitData, botToken);
    return telegramUser
      ? { userKey: `telegram:${telegramUser.id}`, source: "telegram" }
      : null;
  }

  const sessionId = getWebSessionId(req, res);
  return sessionId ? { userKey: `web:${sessionId}`, source: "web" } : null;
};
