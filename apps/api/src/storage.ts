import { createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const MEDIA_ROOT = path.resolve(process.env.MEDIA_ROOT ?? path.join(process.cwd(), "media"));
const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? "http://localhost:4000";
const SIGNING_SECRET = process.env.FILE_SIGNING_SECRET ?? process.env.JWT_SECRET ?? "dev-only-change-me";
const URL_TTL_MS = 15 * 60 * 1000;

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

export function resolveMediaPath(key: string): string {
  const resolved = path.resolve(MEDIA_ROOT, key);
  if (resolved !== MEDIA_ROOT && !resolved.startsWith(MEDIA_ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export function contentTypeForKey(key: string): string {
  return EXTENSION_CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

export async function ensureMediaRoot() {
  await fs.mkdir(MEDIA_ROOT, { recursive: true });
}

export async function uploadObject(key: string, body: Buffer, _contentType: string) {
  const filePath = resolveMediaPath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);
}

export async function deleteObject(key: string) {
  try {
    await fs.unlink(resolveMediaPath(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

function sign(key: string, expires: number): string {
  return createHmac("sha256", SIGNING_SECRET).update(`${key}:${expires}`).digest("hex");
}

export function verifyFileSignature(
  key: string,
  expires: string | undefined,
  signature: string | undefined
): boolean {
  if (!expires || !signature) return false;
  const expiresNum = Number(expires);
  if (!Number.isFinite(expiresNum) || Date.now() > expiresNum) return false;

  const expected = Buffer.from(sign(key, expiresNum));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function getSignedDownloadUrl(key: string): Promise<string> {
  const expires = Date.now() + URL_TTL_MS;
  const signature = sign(key, expires);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return Promise.resolve(`${API_PUBLIC_URL}/files/${encodedKey}?expires=${expires}&sig=${signature}`);
}
