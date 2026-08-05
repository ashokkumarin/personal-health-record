import { File, Directory, Paths } from "expo-file-system";

const RECORDS_DIR = "records";

function ensureRecordsDir(): Directory {
  const dir = new Directory(Paths.document, RECORDS_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

// Copies a locally-picked file (from expo-image-picker/expo-document-picker)
// into the app's durable document directory, keyed by record id — unlike
// Paths.cache (see download.ts), this survives OS cache eviction so an
// offline-created record's file is still there after a reboot.
export function storeLocalFile(sourceUri: string, recordId: string, ext: string): string {
  const dir = ensureRecordsDir();
  const source = new File(sourceUri);
  const dest = new File(dir, `${recordId}.${ext}`);
  if (dest.exists) dest.delete();
  source.copy(dest);
  return dest.uri;
}

// Pulls a record's file down from the server into the same durable store, so
// once synced, viewing it no longer needs a network round trip.
export async function downloadToLocalStore(url: string, recordId: string, ext: string): Promise<string> {
  const dir = ensureRecordsDir();
  const dest = new File(dir, `${recordId}.${ext}`);
  const downloaded = await File.downloadFileAsync(url, dest, { idempotent: true });
  return downloaded.uri;
}

export function deleteLocalFile(recordId: string, ext: string): void {
  const file = new File(Paths.document, RECORDS_DIR, `${recordId}.${ext}`);
  if (file.exists) file.delete();
}

export function fileExtensionForType(fileType: string): string {
  if (fileType === "application/pdf") return "pdf";
  if (fileType === "image/png") return "png";
  return "jpg";
}
