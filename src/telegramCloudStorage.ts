import { FinanceData } from "./types";
import { compressToBase64, decompressFromBase64 } from "lz-string";

type CloudStorage = NonNullable<NonNullable<Window["Telegram"]>["WebApp"]["CloudStorage"]>;

const META_KEY = "finance_data_meta_v1";
const LEGACY_CHUNK_PREFIX = "finance_data_v1_";
const CHUNK_PREFIX = "finance_data_v2_";
const CHUNK_SIZE = 3800;
const CLOUD_OPERATION_TIMEOUT_MS = 6000;

type CloudMeta = {
  chunks: number;
  updatedAt: number;
  generation?: string;
  encoding?: "lz-base64-v1";
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

const parseMeta = (value: string): CloudMeta | null => {
  if (!value) return null;
  try {
    const meta = JSON.parse(value) as Partial<CloudMeta>;
    if (!Number.isInteger(meta.chunks) || !meta.chunks || meta.chunks < 1 || meta.chunks > 1023) return null;
    const generation = typeof meta.generation === "string" && /^[a-z0-9_-]+$/i.test(meta.generation)
      ? meta.generation
      : undefined;
    const encoding = meta.encoding === "lz-base64-v1" ? meta.encoding : undefined;
    return { chunks: meta.chunks, updatedAt: Number(meta.updatedAt) || 0, generation, encoding };
  } catch {
    return null;
  }
};

export const getTelegramCloudStorage = () => {
  const webApp = window.Telegram?.WebApp;
  if (!webApp || webApp.platform === "unknown" || !webApp.initDataUnsafe?.user?.id) return null;
  return webApp.CloudStorage ?? null;
};

export const readTelegramCloudData = async (storage: CloudStorage): Promise<FinanceData | null> => {
  const meta = parseMeta(await getItem(storage, META_KEY));
  if (!meta) return null;

  const keys = Array.from({ length: meta.chunks }, (_, index) => chunkKey(index, meta.generation));
  const values = await getItems(storage, keys);
  const serialized = keys.map(key => values[key] ?? "").join("");
  if (!serialized) return null;
  const json = meta.encoding === "lz-base64-v1" ? decompressFromBase64(serialized) : serialized;
  if (!json) throw new SyntaxError("Unable to decompress Telegram CloudStorage data");
  return JSON.parse(json) as FinanceData;
};

export const writeTelegramCloudData = async (storage: CloudStorage, data: FinanceData): Promise<void> => {
  const previousMeta = parseMeta(await getItem(storage, META_KEY));
  const serialized = compressToBase64(JSON.stringify(data));
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(serialized.length / CHUNK_SIZE)) },
    (_, index) => serialized.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );
  const generation = `${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

  if (chunks.length > 1023) throw new Error("Finance data exceeds Telegram CloudStorage capacity");

  for (let index = 0; index < chunks.length; index += 1) {
    await setItem(storage, chunkKey(index, generation), chunks[index]);
  }

  await setItem(storage, META_KEY, JSON.stringify({
    chunks: chunks.length,
    updatedAt: Date.now(),
    generation,
    encoding: "lz-base64-v1",
  }));

  if (previousMeta) {
    const obsoleteKeys = Array.from(
      { length: previousMeta.chunks },
      (_, index) => chunkKey(index, previousMeta.generation),
    );
    try {
      await removeItems(storage, obsoleteKeys);
    } catch (error) {
      console.warn("Unable to clean up old Telegram CloudStorage chunks:", error);
    }
  }
};
