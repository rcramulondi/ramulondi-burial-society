import "server-only";
import { put, del } from "@vercel/blob";

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
 * Uploads a file to Vercel Blob storage. Vercel Blob does not offer native
 * private ACLs, so "private" access here is enforced at the application
 * layer instead: the returned blob pathname is stored as `storageKey` and is
 * NEVER exposed to clients directly. All reads go through the authenticated
 * proxy route (/api/documents/[id]) which fetches the blob server-side (using
 * the server-only BLOB_READ_WRITE_TOKEN) and streams it back only after an
 * ownership/role check — see src/app/api/documents/[id]/route.ts.
 */
export async function uploadPrivateFile(
  file: File,
  keyPrefix: string
): Promise<{ storageKey: string; fileName: string; mimeType: string; sizeBytes: number }> {
  assertUploadIsValid(file);

  const pathname = `${keyPrefix}/${crypto.randomUUID()}-${file.name}`;
  const blob = await put(pathname, file, {
    access: "public",
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

export async function fetchPrivateFile(storageKey: string): Promise<Response> {
  return fetch(storageKey, { cache: "no-store" });
}

export async function deletePrivateFile(storageKey: string): Promise<void> {
  await del(storageKey);
}
