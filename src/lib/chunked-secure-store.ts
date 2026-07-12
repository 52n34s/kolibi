import * as SecureStore from 'expo-secure-store';

/** Stay under iOS Keychain ~2048-byte limit per entry. */
export const SECURE_STORE_CHUNK_MAX_BYTES = 2000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

function splitIntoByteChunks(value: string, maxBytes: number): string[] {
  const bytes = textEncoder.encode(value);

  if (bytes.length <= maxBytes) {
    return [value];
  }

  const chunks: string[] = [];
  let offset = 0;

  while (offset < bytes.length) {
    let end = Math.min(offset + maxBytes, bytes.length);

    if (end < bytes.length) {
      while (end > offset && (bytes[end] & 0xc0) === 0x80) {
        end--;
      }

      if (end === offset) {
        end = Math.min(offset + maxBytes, bytes.length);
      }
    }

    chunks.push(textDecoder.decode(bytes.subarray(offset, end)));
    offset = end;
  }

  return chunks;
}

function parseChunkCount(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }

  const count = Number.parseInt(raw, 10);

  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return count;
}

async function readChunkCount(key: string): Promise<number | null> {
  return parseChunkCount(await SecureStore.getItemAsync(key));
}

async function deleteChunks(key: string, count: number): Promise<void> {
  await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index))),
  );
}

async function getChunkedItem(key: string): Promise<string | null> {
  const count = await readChunkCount(key);

  if (count === null) {
    return null;
  }

  if (count === 0) {
    return '';
  }

  const chunks = await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
  );

  if (chunks.some((chunk) => chunk === null)) {
    return null;
  }

  return chunks.join('');
}

async function setChunkedItem(key: string, value: string): Promise<void> {
  const previousCount = (await readChunkCount(key)) ?? 0;
  const nextChunks = splitIntoByteChunks(value, SECURE_STORE_CHUNK_MAX_BYTES);

  await Promise.all(
    nextChunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)),
  );

  if (previousCount > nextChunks.length) {
    await Promise.all(
      Array.from({ length: previousCount - nextChunks.length }, (_, offset) =>
        SecureStore.deleteItemAsync(chunkKey(key, nextChunks.length + offset)),
      ),
    );
  }

  await SecureStore.setItemAsync(key, String(nextChunks.length));
}

async function removeChunkedItem(key: string): Promise<void> {
  const count = await readChunkCount(key);

  await SecureStore.deleteItemAsync(key);

  if (count !== null && count > 0) {
    await deleteChunks(key, count);
  }
}

export function createChunkedSecureStoreAdapter() {
  return {
    getItem: getChunkedItem,
    setItem: setChunkedItem,
    removeItem: removeChunkedItem,
  };
}
