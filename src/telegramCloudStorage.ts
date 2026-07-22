import { FinanceData } from "./types";
import {
  compressToBase64,
  compressToUTF16,
  decompressFromBase64,
  decompressFromUTF16,
} from "lz-string";

type CloudStorage = NonNullable<NonNullable<Window["Telegram"]>["WebApp"]["CloudStorage"]>;

const META_KEY = "finance_data_meta_v1";
const LEGACY_CHUNK_PREFIX = "finance_data_v1_";
const CHUNK_PREFIX = "finance_data_v2_";
const CHUNK_SIZE = 3800;
const CLOUD_OPERATION_TIMEOUT_MS = 5000;
const CLOUD_RETRY_DELAY_MS = 300;
const CLEANUP_BATCH_SIZE = 100;

type CloudMeta = {
  chunks: number;
  updatedAt: number;
  generation?: string;
  encoding?: "lz-base64-v1" | "lz-utf16-v1" | "lz-base64-inline-v1" | "lz-utf16-inline-v1";
  data?: string;
};

const getItem = (storage: CloudStorage, key: string) =>
  new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Telegram CloudStorage read timed out")), CLOUD_OPERATION_TIMEOUT_MS);
    storage.getItem(key, (error, value) => {
      window.clearTimeout(timer);
      if (error) reject(new Error(error));
      else resolve(value ?? "");
    });
  });

const getItems = (storage: CloudStorage, keys: string[]) =>
  new Promise<Record<string, string>>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Telegram CloudStorage read timed out")), CLOUD_OPERATION_TIMEOUT_MS);
    storage.getItems(keys, (error, values) => {
      window.clearTimeout(timer);
      if (error) reject(new Error(error));
      else resolve(values ?? {});
    });
  });

const getKeys = (storage: CloudStorage) =>
  new Promise<string[]>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Telegram CloudStorage key listing timed out")), CLOUD_OPERATION_TIMEOUT_MS);
    storage.getKeys((error, keys) => {
      window.clearTimeout(timer);
      if (error) reject(new Error(error));
      else resolve(keys ?? []);
    });
  });

const setItem = (storage: CloudStorage, key: string, value: string) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Telegram CloudStorage save timed out")), CLOUD_OPERATION_TIMEOUT_MS);
    storage.setItem(key, value, (error, stored) => {
      window.clearTimeout(timer);
      if (error) reject(new Error(error));
      else if (stored === false) reject(new Error("Telegram CloudStorage did not save the value"));
      else resolve();
    });
  });

const removeItems = (storage: CloudStorage, keys: string[]) =>
  new Promise<void>((resolve, reject) => {
    if (keys.length === 0) return resolve();
    const timer = window.setTimeout(() => reject(new Error("Telegram CloudStorage cleanup timed out")), CLOUD_OPERATION_TIMEOUT_MS);
    storage.removeItems(keys, (error) => {
      window.clearTimeout(timer);
      if (error) reject(new Error(error));
      else resolve();
    });
  });

const chunkKey = (index: number, generation?: string) => generation
  ? `${CHUNK_PREFIX}${generation}_${index}`
  : `${LEGACY_CHUNK_PREFIX}${index}`;

const waitBeforeRetry = () => new Promise(resolve => window.setTimeout(resolve, CLOUD_RETRY_DELAY_MS));

const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (firstError) {
    await waitBeforeRetry();
    try {
      return await operation();
    } catch {
      throw firstError;
    }
  }
};

const isFinanceChunkKey = (key: string) =>
  key.startsWith(CHUNK_PREFIX) || key.startsWith(LEGACY_CHUNK_PREFIX);

const cleanupStaleChunks = async (storage: CloudStorage, keepKeys: Set<string>) => {
  const keys = await withRetry(() => getKeys(storage));
  const staleKeys = keys.filter(key => isFinanceChunkKey(key) && !keepKeys.has(key));
  for (let index = 0; index < staleKeys.length; index += CLEANUP_BATCH_SIZE) {
    const batch = staleKeys.slice(index, index + CLEANUP_BATCH_SIZE);
    await withRetry(() => removeItems(storage, batch));
  }
};

const parseMeta = (value: string): CloudMeta | null => {
  if (!value) return null;
  try {
    const meta = JSON.parse(value) as Partial<CloudMeta>;
    if (
      (meta.encoding === "lz-base64-inline-v1" || meta.encoding === "lz-utf16-inline-v1") &&
      typeof meta.data === "string" &&
      meta.data
    ) {
      return {
        chunks: 0,
        updatedAt: Number(meta.updatedAt) || 0,
        generation: "inline",
        encoding: meta.encoding,
        data: meta.data,
      };
    }
    if (!Number.isInteger(meta.chunks) || !meta.chunks || meta.chunks < 1 || meta.chunks > 1023) return null;
    const generation = typeof meta.generation === "string" && /^[a-z0-9_-]+$/i.test(meta.generation)
      ? meta.generation
      : undefined;
    const encoding = meta.encoding === "lz-base64-v1" || meta.encoding === "lz-utf16-v1"
      ? meta.encoding
      : undefined;
    return { chunks: meta.chunks, updatedAt: Number(meta.updatedAt) || 0, generation, encoding };
  } catch {
    return null;
  }
};

export const getTelegramCloudStorage = () => {
  const webApp = window.Telegram?.WebApp;
  if (!webApp || webApp.platform === "unknown" || !webApp.initDataUnsafe?.user?.id) return null;
  if (webApp.isVersionAtLeast && !webApp.isVersionAtLeast("6.9")) return null;
  return webApp.CloudStorage ?? null;
};

export const readTelegramCloudData = async (storage: CloudStorage): Promise<FinanceData | null> => {
  const meta = parseMeta(await getItem(storage, META_KEY));
  if (!meta) return null;

  if (meta.encoding === "lz-base64-inline-v1" || meta.encoding === "lz-utf16-inline-v1") {
    const json = meta.encoding === "lz-base64-inline-v1"
      ? decompressFromBase64(meta.data ?? "")
      : decompressFromUTF16(meta.data ?? "");
    if (!json) throw new SyntaxError("Unable to decompress Telegram CloudStorage data");
    return JSON.parse(json) as FinanceData;
  }

  const keys = Array.from({ length: meta.chunks }, (_, index) => chunkKey(index, meta.generation));
  const values = await getItems(storage, keys);
  const serialized = keys.map(key => values[key] ?? "").join("");
  if (!serialized) return null;
  const json = meta.encoding === "lz-base64-v1"
    ? decompressFromBase64(serialized)
    : meta.encoding === "lz-utf16-v1"
      ? decompressFromUTF16(serialized)
      : serialized;
  if (!json) throw new SyntaxError("Unable to decompress Telegram CloudStorage data");
  return JSON.parse(json) as FinanceData;
};

export const writeTelegramCloudData = async (storage: CloudStorage, data: FinanceData): Promise<void> => {
  const json = JSON.stringify(data);
  const base64Serialized = compressToBase64(json);
  const base64InlineValue = JSON.stringify({
    chunks: 0,
    updatedAt: Date.now(),
    generation: "inline",
    encoding: "lz-base64-inline-v1",
    data: base64Serialized,
  });

  if (base64InlineValue.length <= 4096) {
    await setItem(storage, META_KEY, base64InlineValue);
    void cleanupStaleChunks(storage, new Set()).catch(error => {
      console.warn("Unable to clean up old Telegram CloudStorage chunks:", error);
    });
    return;
  }

  const utf16Serialized = compressToUTF16(json);
  const utf16InlineValue = JSON.stringify({
    chunks: 0,
    updatedAt: Date.now(),
    generation: "inline",
    encoding: "lz-utf16-inline-v1",
    data: utf16Serialized,
  });

  if (utf16InlineValue.length <= 4096) {
    await setItem(storage, META_KEY, utf16InlineValue);
    void cleanupStaleChunks(storage, new Set()).catch(error => {
      console.warn("Unable to clean up old Telegram CloudStorage chunks:", error);
    });
    return;
  }

  const serialized = base64Serialized;
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(serialized.length / CHUNK_SIZE)) },
    (_, index) => serialized.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );
  const generation = "stable";

  if (chunks.length > 1023) throw new Error("Finance data exceeds Telegram CloudStorage capacity");

  try {
    await cleanupStaleChunks(storage, new Set());
  } catch (error) {
    console.warn("Unable to run Telegram CloudStorage preflight cleanup:", error);
  }

  for (let index = 0; index < chunks.length; index += 1) {
    await setItem(storage, chunkKey(index, generation), chunks[index]);
  }

  await setItem(storage, META_KEY, JSON.stringify({
    chunks: chunks.length,
    updatedAt: Date.now(),
    generation,
    encoding: "lz-base64-v1",
  }));

  const currentKeys = new Set(Array.from({ length: chunks.length }, (_, index) => chunkKey(index, generation)));
  void cleanupStaleChunks(storage, currentKeys).catch(error => {
    console.warn("Unable to clean up old Telegram CloudStorage chunks:", error);
  });
};
