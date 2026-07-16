import { FinanceData } from "./types";

type CloudStorage = NonNullable<NonNullable<Window["Telegram"]>["WebApp"]["CloudStorage"]>;

const META_KEY = "finance_data_meta_v1";
const CHUNK_PREFIX = "finance_data_v1_";
const CHUNK_SIZE = 3800;

type CloudMeta = {
  chunks: number;
  updatedAt: number;
};

const getItem = (storage: CloudStorage, key: string) =>
  new Promise<string>((resolve, reject) => {
    storage.getItem(key, (error, value) => {
      if (error) reject(new Error(error));
      else resolve(value ?? "");
    });
  });

const getItems = (storage: CloudStorage, keys: string[]) =>
  new Promise<Record<string, string>>((resolve, reject) => {
    storage.getItems(keys, (error, values) => {
      if (error) reject(new Error(error));
      else resolve(values ?? {});
    });
  });

const setItem = (storage: CloudStorage, key: string, value: string) =>
  new Promise<void>((resolve, reject) => {
    storage.setItem(key, value, (error, stored) => {
      if (error) reject(new Error(error));
      else if (stored === false) reject(new Error("Telegram CloudStorage did not save the value"));
      else resolve();
    });
  });

const removeItems = (storage: CloudStorage, keys: string[]) =>
  new Promise<void>((resolve, reject) => {
    if (keys.length === 0) return resolve();
    storage.removeItems(keys, (error) => {
      if (error) reject(new Error(error));
      else resolve();
    });
  });

const chunkKey = (index: number) => `${CHUNK_PREFIX}${index}`;

const parseMeta = (value: string): CloudMeta | null => {
  if (!value) return null;
  try {
    const meta = JSON.parse(value) as Partial<CloudMeta>;
    if (!Number.isInteger(meta.chunks) || !meta.chunks || meta.chunks < 1 || meta.chunks > 1023) return null;
    return { chunks: meta.chunks, updatedAt: Number(meta.updatedAt) || 0 };
  } catch {
    return null;
  }
};

export const getTelegramCloudStorage = () => window.Telegram?.WebApp.CloudStorage ?? null;

export const readTelegramCloudData = async (storage: CloudStorage): Promise<FinanceData | null> => {
  const meta = parseMeta(await getItem(storage, META_KEY));
  if (!meta) return null;

  const keys = Array.from({ length: meta.chunks }, (_, index) => chunkKey(index));
  const values = await getItems(storage, keys);
  const serialized = keys.map(key => values[key] ?? "").join("");
  if (!serialized) return null;
  return JSON.parse(serialized) as FinanceData;
};

export const writeTelegramCloudData = async (storage: CloudStorage, data: FinanceData): Promise<void> => {
  const previousMeta = parseMeta(await getItem(storage, META_KEY));
  const serialized = JSON.stringify(data);
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(serialized.length / CHUNK_SIZE)) },
    (_, index) => serialized.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );

  if (chunks.length > 1023) throw new Error("Finance data exceeds Telegram CloudStorage capacity");

  for (let index = 0; index < chunks.length; index += 1) {
    await setItem(storage, chunkKey(index), chunks[index]);
  }

  await setItem(storage, META_KEY, JSON.stringify({ chunks: chunks.length, updatedAt: Date.now() }));

  if (previousMeta && previousMeta.chunks > chunks.length) {
    const obsoleteKeys = Array.from(
      { length: previousMeta.chunks - chunks.length },
      (_, index) => chunkKey(chunks.length + index),
    );
    await removeItems(storage, obsoleteKeys);
  }
};
