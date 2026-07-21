import "server-only";
import { put, del, get } from "@vercel/blob";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export class UploadValidationError extends Error {}

export function assertUploadIsValid(file: { type: string; size: number }): void {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new UploadValidationError("Only JPEG, PNG, or PDF files are allowed.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new UploadValidationError("Files must be 5MB or smaller.");
  }
}

/**
 * Uploads a file to Vercel Blob storage using the store's native private
 * access mode — the blob is not reachable via its URL without the
 * server-only BLOB_READ_WRITE_TOKEN. All reads go through the authenticated
 * proxy route (/api/documents/[id]) which fetches the blob server-side and
 * streams it back only after an ownership/role check — see
 * src/app/api/documents/[id]/route.ts.
 */
export async function uploadPrivateFile(
  file: File,
  keyPrefix: string
): Promise<{ storageKey: string; fileName: string; mimeType: string; sizeBytes: number }> {
  assertUploadIsValid(file);

  const pathname = `${keyPrefix}/${crypto.randomUUID()}-${file.name}`;
  const blob = await put(pathname, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.type,
  });

  return {
    storageKey: blob.url,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export async function fetchPrivateFile(storageKey: string): Promise<{ ok: boolean; body: ReadableStream<Uint8Array> | null }> {
  const result = await get(storageKey, { access: "private" });
  if (!result || !result.stream) return { ok: false, body: null };
  return { ok: true, body: result.stream };
}

export async function deletePrivateFile(storageKey: string): Promise<void> {
  await del(storageKey);
}
